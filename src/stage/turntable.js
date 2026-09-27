import { state } from '../state.js';

// Visitors turn the costume, not the camera. A horizontal drag on the costume turns its turntable;
// it keeps turning with inertia when released, and a slow auto-rotate eases back in a few seconds
// after the last touch. Vertical movement is ignored.
//
// A drag that starts on the empty stage beside the costume (while exploring) turns the revolving
// stage instead (revolve.js): the costume in front follows the finger, the next comes forward,
// and on release the director lands the revolve on a costume, or back where it was.

const AUTO_SPEED = 0.25;   // radians per second, about one turn every 25 s
const AUTO_DELAY = 3;      // seconds after the last touch before auto-rotate returns
const AUTO_RAMP = 1.5;     // seconds to ease back up to speed
const SPEED_GLIDE = 1;     // seconds (time constant) to glide to a new pace, e.g. the attract state's slower turn
const DRAG_GAIN = 1.3;     // >1 because the fabric sits nearer the axis than the costume's outer edge
const MAX_SPEED = 10;      // radians per second (~1.6 turns/s): the clamp on a very fast spin
const DAMPING = 2.2;       // inertia decay per second
const SPIN_ON = 3.5;       // above this the overlay gets .spinning (labels hide)…
const SPIN_OFF = 1.2;      // …and it's removed once the turntable settles below this
const VELOCITY_WINDOW = 100; // ms of recent drag used to measure the release speed
const HOLD_STILL = 60;     // ms: a finger held still this long before lifting releases with no spin
const TAP_MOVE_PX = 8;
const TAP_TIME_MS = 300;
const SWIPE_GAIN = 1.4;    // the revolve turns a little faster than the finger: one costume ≈ 800 px on a 10" iPad
const SWIPE_COMMIT = 0.3;  // let go past this share of a costume's turn and the revolve carries on to it…
const SWIPE_FLICK = 1.2;   // …or flick faster than this (rad/s of revolve) in the same direction

export function createTurntables({ rigs, canvas, overlay, director, revolve }) {
  // One motion state per costume. All of them turn; only the focused one takes touches.
  // speed is the pace auto-rotate aims for; rate glides towards it, so a change of pace never jumps.
  // auto starts at 0: on the first view the turntables ease up from rest, like a motor starting.
  const motion = rigs.map(() => ({ velocity: 0, auto: 0, speed: AUTO_SPEED, rate: AUTO_SPEED }));
  const held = new Set(); // costumes the director is turning (a story is open): no drag, no auto-rotate
  const tapListeners = [];
  let drag = null;
  let lastTouch = -Infinity;
  let spinning = false;

  // The costume turns while exploring and while a story is open (so the visitor can look for the
  // next detail as they read), never while the director is moving or holding it.
  const canTurn = () => !director.locked && (state.mode === 'explore' || state.mode === 'story')
    && !held.has(state.focus);
  const grabListeners = [];

  // Touching a spinning turntable catches it, like putting a hand on a real one.
  function takeHold() {
    drag.turns = true;
    const m = motion[state.focus];
    m.velocity = 0;
    m.auto = 0;
    for (const listener of grabListeners) listener();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (drag) return; // only the first finger counts
    canvas.setPointerCapture(event.pointerId);
    const now = performance.now();
    const rect = canvas.getBoundingClientRect();
    // Exploring, a touch beside the costume may become a swipe of the stage: it starts once the
    // finger has moved like a drag (a tap there stays a tap).
    const onStage = state.mode === 'explore' && !director.locked
      && director.costumeAt(event.clientX - rect.left, event.clientY - rect.top) !== state.focus;
    drag = {
      id: event.pointerId,
      startX: event.clientX, startY: event.clientY, startTime: now,
      lastX: event.clientX, moved: 0,
      samples: [],
      turns: false,
      // A touch that lands mid-transition does nothing while the move runs. If it's still
      // dragging when the move lands, it takes the turntable from there, so a quick visitor
      // isn't ignored; but it never counts as a tap. Outside explore a touch can still be a
      // tap (enter from attract, close a story).
      early: director.locked,
      swipe: onStage ? { started: false, originX: 0, from: 0, samples: [] } : null,
    };
    lastTouch = now;
    if (!onStage && canTurn()) takeHold();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const now = performance.now();
    const dx = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
    lastTouch = now;
    if (drag.swipe) {
      swipeMove(event, now);
      return;
    }
    if (!drag.turns && drag.early && canTurn()) takeHold();
    if (!drag.turns) return;

    const rig = rigs[state.focus];
    const angle = (dx / director.pixelsPerRadian(rig)) * DRAG_GAIN;
    rig.turntable.rotation.y += angle;

    drag.samples.push({ time: now, angle });
    while (drag.samples.length && now - drag.samples[0].time > VELOCITY_WINDOW) drag.samples.shift();
  });

  // The revolve follows the finger from where the swipe began.
  function swipeMove(event, now) {
    const swipe = drag.swipe;
    if (!swipe.started) {
      if (drag.moved < TAP_MOVE_PX) return;
      swipe.started = true;
      swipe.originX = event.clientX;
      swipe.from = revolve.angleFor(revolve.frontAt()); // exactly on a slot
      director.beginSwipe();
    }
    const angle = swipe.from + ((event.clientX - swipe.originX) / director.revolvePixels()) * SWIPE_GAIN;
    revolve.turn.angle = angle;
    swipe.samples.push({ time: now, angle });
    while (swipe.samples.length && now - swipe.samples[0].time > VELOCITY_WINDOW) swipe.samples.shift();
  }

  // Where the revolve should come to rest: the next costume once the swipe went far enough or
  // was flicked that way, more than one for a long swipe, otherwise back where it began.
  function swipeTarget(now) {
    const { from, samples } = drag.swipe;
    const progress = (revolve.turn.angle - from) / revolve.slot;
    let velocity = 0;
    if (samples.length > 1 && now - samples[samples.length - 1].time < HOLD_STILL) {
      const span = (samples[samples.length - 1].time - samples[0].time) / 1000;
      if (span > 0) velocity = (samples[samples.length - 1].angle - samples[0].angle) / span;
    }
    let steps = Math.round(progress);
    if (steps === 0 && (Math.abs(progress) > SWIPE_COMMIT
      || (Math.abs(velocity) > SWIPE_FLICK && Math.sign(velocity) === Math.sign(progress)))) {
      steps = Math.sign(progress);
    }
    return from + steps * revolve.slot;
  }

  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const now = performance.now();
    if (drag.swipe?.started) {
      director.landSwipe(swipeTarget(now));
      lastTouch = now;
      drag = null;
      return;
    }
    const isTap = !drag.early && drag.moved < TAP_MOVE_PX && now - drag.startTime < TAP_TIME_MS;

    if (drag.turns) {
      let velocity = 0;
      const samples = drag.samples.filter((s) => now - s.time <= VELOCITY_WINDOW);
      const last = samples[samples.length - 1];
      if (samples.length > 1 && now - last.time < HOLD_STILL) {
        const total = samples.reduce((sum, s) => sum + s.angle, 0);
        const span = (last.time - samples[0].time) / 1000;
        if (span > 0) velocity = total / span;
      }
      motion[state.focus].velocity = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocity));
    }

    lastTouch = now;
    drag = null;
    if (isTap) for (const listener of tapListeners) listener(event);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // Called every frame from the main loop, with dt in seconds.
  function update(dt) {
    const sinceTouch = (performance.now() - lastTouch) / 1000;

    rigs.forEach((rig, i) => {
      const m = motion[i];
      // In the attract state nobody's hand is on a turntable, so none waits for a touch to end.
      const touched = i === state.focus && state.mode !== 'attract';
      if (held.has(i)) return; // the director is turning it
      if (touched && drag?.turns) return; // the finger is in charge

      m.velocity *= Math.exp(-DAMPING * dt);
      // While a story is open the costume stays where the visitor leaves it: auto-rotate winds
      // down instead of up (a flick still carries on and settles).
      const reading = i === state.focus && state.mode === 'story';
      if (reading) m.auto = Math.max(0, m.auto - dt / AUTO_RAMP);
      else if (!touched || sinceTouch > AUTO_DELAY) m.auto = Math.min(1, m.auto + dt / AUTO_RAMP);
      m.rate += (m.speed - m.rate) * Math.min(1, dt / SPEED_GLIDE);

      const ease = m.auto * m.auto * (3 - 2 * m.auto); // smoothstep: eases up to speed, no jump
      rig.turntable.rotation.y += (m.velocity + m.rate * ease) * dt;
    });

    // Fast-spin state for the focused costume, with hysteresis so it doesn't flicker.
    const speed = Math.abs(motion[state.focus].velocity);
    if (!spinning && speed > SPIN_ON) spinning = true;
    else if (spinning && speed < SPIN_OFF) spinning = false;
    overlay.classList.toggle('spinning', spinning);
  }

  // A story holds its costume still while the director turns the detail to the visitor.
  function hold(index) {
    held.add(index);
    motion[index].velocity = 0;
  }

  // Letting go counts as a touch: auto-rotate waits the usual delay, then eases back in.
  // Only a costume that was held starts again from rest; one already turning keeps turning.
  // The attract state passes its own slower pace, and no wait, since nobody touched anything.
  // `rolling`: the director's move has already brought it up to `speed`, so it carries straight on.
  function free(index, { speed = AUTO_SPEED, wait = true, rolling = false } = {}) {
    const m = motion[index];
    if (held.delete(index)) {
      m.auto = rolling ? 1 : 0;
      if (rolling) m.rate = speed;
    }
    m.speed = speed;
    if (wait) lastTouch = performance.now();
  }

  // How fast a costume is turning right now (rad/s), so a move can pick up from it without a jolt.
  function speedOf(index) {
    if (held.has(index)) return 0;
    const m = motion[index];
    return m.velocity + m.rate * m.auto * m.auto * (3 - 2 * m.auto);
  }

  return {
    update,
    hold,
    free,
    speedOf,
    onTap: (listener) => tapListeners.push(listener),
    onGrab: (listener) => grabListeners.push(listener), // a finger takes a turntable
    get spinning() { return spinning; },
  };
}
