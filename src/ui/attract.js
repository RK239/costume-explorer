import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { t, onLanguage } from './i18n.js';
import { MOTION } from '../motion.js';

// The attract state: the brief's most important screen, designed to stop someone 2–3 m away.
// One continuous take on the revolving stage. The stage slows into each costume and moves on
// again, and the camera breathes with it: back while the stage turns, in while a costume is on
// show. The framing always holds the whole group, the hero in front and the other two upstage,
// so a passer-by sees there are three to choose from.
//   Hand-over: the stage brings the next costume round from the side away from the headline;
//   the camera eases back and all three are lit, so the revolve is seen turning.
//   Arrival: the stage settles with the costume facing the visitor (it turns to its front as it
//   comes round), the camera closes in, the hero's light swells and the other two sink back
//   upstage, still visible.
//   Hero: it turns to show its back (a ring pulses on the back hotspot: there's something to
//   find), pauses, and comes round to its front, while the camera leans in, very slowly, so the
//   picture is never still.
// After the third, the hand-over widens into the establishing shot: the stage comes round to
// its first position and every costume turns to face front, so each loop starts the same way.
// The wide shot holds, still, all three facing front; as the camera starts to move in onto the
// one in the centre, all three start turning together: the two upstage into their slow turn, the
// one in the centre to show its back, like every other hero. The stage always turns the same way,
// so a new loop never jumps back.
// Whenever a costume stands in the centre, it faces the visitor. Every hero shows its back and
// comes round to its front at one pace, forwards, handing back to the slow turn without a jolt.
// Home and the idle return also turn every costume to face front (director.toAttract).
// A tap enters the costume in front (or, in the establishing shot, the one nearest the touch).
// It speaks the kiosk's language: the whole loop in English, or the whole loop in Arabic, laid out
// right to left (headline on the left, costume on the right). Home keeps a visitor's language;
// the idle reset returns to English.

const MOVE = MOTION.glide.duration; // s: a replay settling on the costume in front
const APPROACH = 3;        // s: the camera's approach onto the first hero from the still wide shot (the stage is still, so it goes gently)
const HANDOVER = 3.4;      // s for the stage to bring the next costume to the front
const WIDE_HOLD = 7.5;     // s the establishing shot holds still, all three facing front: time to take them in before the first hero
const DRIFT = 0.15;        // rad/s: the attract state's slow turn, about one turn in 40 s (explore turns at 0.25)
const TURN = 3.6;          // s for each half turn of a hero (front → back, back → front): one pace for all three
const BACK_HOLD = 1.6;     // s the hero pauses with its back to the visitor
const UPSTAGE = 0.2;       // light level of the two costumes behind a hero: visible, but quieter
// Framing margins around the group (director.frameGroup), next to the director's wide shot (1.35)
// and hero shot (1.1): the camera breathes between them. A hand-over frames the stage halfway
// round, its widest point, so the whole turn stays beside the headline.
// `creep`: the wide shot's slight move in before the first hero, so the opening is never still.
const FRAME = { handover: 1.1, heroIn: 1.04, creep: 1.25 };
const FACING_START = 0.2;  // the teaser ring fades in as the back hotspot turns to face the camera…
const FACING_END = 0.6;    // …and is fully visible from here

export function createAttract({ overlay, content, rigs, stage, director, turntables, revolve }) {
  const { camera } = stage;
  const canvas = stage.renderer.domElement;

  // ── Headline ────────────────────────────────────────────────────────
  const headline = document.createElement('header');
  headline.className = 'attract';
  headline.innerHTML = `
    <span class="attract__rule" aria-hidden="true"></span>
    <h1 class="attract__title"></h1>
    <p class="attract__subtitle"></p>
    <p class="attract__invite"><span class="attract__ring" aria-hidden="true"></span><span class="attract__invite-text"></span></p>`;
  function renderWords() {
    headline.querySelector('.attract__title').textContent = t(content.exhibition.title);
    headline.querySelector('.attract__subtitle').textContent = t(content.exhibition.subtitle);
    headline.querySelector('.attract__invite-text').textContent = t(content.ui.touchToBegin);
  }
  renderWords();
  overlay.append(headline);

  // The director frames the costume beside the headline, so it needs the headline's place.
  director.headlineRect = () => ({
    left: headline.offsetLeft, top: headline.offsetTop, width: headline.offsetWidth, height: headline.offsetHeight,
  });
  // In portrait the words sit above and below the stage: where the title block ends and where the
  // invitation begins, in px from the top.
  const subtitle = headline.querySelector('.attract__subtitle');
  const invite = headline.querySelector('.attract__invite');
  director.headlineBands = () => ({
    top: headline.offsetTop + subtitle.offsetTop + subtitle.offsetHeight,
    bottom: headline.offsetTop + invite.offsetTop,
  });

  // The invitation's ring breathes, in the hotspots' visual language.
  gsap.to(headline.querySelector('.attract__ring'), {
    scale: 1.25, duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true,
  });

  // ── Teaser: a ring on the hero's back hotspot ──────────────────────
  const teaser = document.createElement('div');
  teaser.className = 'teaser';
  teaser.innerHTML = '<span class="teaser__ring"></span><span class="teaser__pulse"></span>';
  overlay.prepend(teaser);
  gsap.fromTo(teaser.querySelector('.teaser__pulse'),
    { scale: 1, autoAlpha: 0.9 },
    { scale: 2.4, autoAlpha: 0, duration: 1.3, ease: 'power1.out', repeat: -1 });

  // ── The loop ────────────────────────────────────────────────────────
  // The opening (the establishing shot flowing into the first hero, the costume in front at the
  // stage's first position), then the heroes the stage brings round, one by one.
  const steps = ['opening', ...rigs.slice(1).map(() => 'next')];
  // The next costume comes in from the side away from the headline: from the left in English
  // (the headline stands on the right), from the right in Arabic.
  const turnWay = () => (document.documentElement.dir === 'rtl' ? -1 : 1);
  const shot = director.shot;
  const glow = director.attractGlow;
  let stepIndex = 0;
  let current = null; // the running step's timeline
  let hero = null;    // index of the costume in front, once it's the hero
  const drift = { speed: DRIFT, wait: false };

  // The stage halfway between the slot it's leaving and `target`: its widest point, where the
  // two costumes changing places swing out furthest. A hand-over is framed for it.
  const halfwayTo = (target) => target - (Math.sign(target - revolve.turn.angle) * revolve.slot) / 2;

  // `again` replays a step with the same costume in front (after a resize or a language switch);
  // a replay turns the shortest way, since the language may have changed the stage's direction.
  function playStep(k, { skipMove = false, again = null, replaying = false } = {}) {
    stepIndex = k % steps.length;
    const way = replaying ? 0 : turnWay();
    const timeline = gsap.timeline({ onComplete: () => playStep(stepIndex + 1) });
    current = timeline;
    if (steps[stepIndex] === 'opening' && again === null) opening(timeline, { skipMove, way });
    else next(timeline, { again, way, replaying });
  }

  // The opening: every loop starts the same way. After the last hero the stage carries on round
  // to its first position while the camera breathes out and back to the wide shot, and every
  // costume turns to face front. The wide shot holds, still, all three facing front, lit alike.
  // Then, as the camera moves in once onto the costume in the centre and its light swells, all
  // three start turning together: the two upstage into their slow turn, the one in the centre to
  // show its back, like every other hero. (From Home, the idle
  // return or start-up, `skipMove`: toAttract has framed the wide shot and turned every costume
  // to face front already; this only catches a costume that moved a hair before the loop began.)
  function opening(timeline, { skipMove, way }) {
    hero = null;
    const index = revolve.middle;
    const rig = rigs[index];
    const settle = skipMove ? 0 : HANDOVER; // the stage at its first position
    let facing = MOVE;                       // when every costume faces front
    if (!skipMove) {
      const target = revolve.angleFor(index, { direction: way });
      if (Math.abs(target - revolve.turn.angle) > 1e-3) {
        timeline.to(shot, { ...director.frameGroup(index, { margin: FRAME.handover, angle: halfwayTo(target) }), duration: HANDOVER / 2, ease: 'sine.inOut' }, 0);
        timeline.to(shot, { ...director.wideShot(), duration: HANDOVER / 2, ease: 'sine.inOut' }, HANDOVER / 2);
        timeline.to(revolve.turn, { angle: target, duration: HANDOVER, ease: 'power2.inOut' }, 0);
        facing = HANDOVER;
      } else {
        timeline.to(shot, { ...director.wideShot(), duration: MOVE, ease: 'power2.inOut' }, 0); // a replay, already in place
      }
    }
    director.turnHome(timeline, 0, facing);
    timeline.add(director.lightStage(glow, glow, { duration: 1.6, ease: MOTION.light.ease }), 0);
    timeline.add(director.accentTo(rig.data.accent, 1.8), Math.max(0, settle - 1.8));
    // Arrival: the camera moves in on the group with it in front, and its light swells. All three
    // start turning as it does (until then turnHome holds them still, facing front).
    const approachAt = settle + WIDE_HOLD;
    const arrive = approachAt + APPROACH;
    timeline.call(() => { hero = index; }, null, approachAt);
    rigs.forEach((r, i) => { if (i !== index) timeline.call(() => turntables.free(i, drift), null, approachAt); });
    timeline.add(director.lightStage(1, UPSTAGE, { duration: 1.6, ease: MOTION.light.ease }), arrive - 1.4);
    const done = reveal(timeline, rig, approachAt);
    // The camera creeps in from the moment the wide shot settles, very slowly, and the creep
    // gathers into the move in and the lean: one move from the wide shot to the hero.
    moveIn(timeline, rig, {
      at: settle, arrivalAt: approachAt, arrival: APPROACH, until: done,
      fromZ: director.wideShot().z, creepZ: director.wideShot(FRAME.creep).z,
    });
  }

  // The next hero. Hand-over: the stage brings it round while the camera eases back, all three
  // lit, and it turns to face the visitor as it comes. Arrival: the camera closes in on the group
  // with it in front; its light swells and the other two sink back upstage, still in view; then
  // it turns to show its back. A replay that catches the stage at rest simply settles on the
  // costume in front; one that catches it mid-turn finishes the turn, the shortest way.
  function next(timeline, { again, way, replaying }) {
    const resting = Math.abs(revolve.turn.angle - revolve.angleFor(revolve.frontAt())) < 1e-3;
    const handover = !replaying || !resting;
    const index = again ?? revolve.frontAt(revolve.turn.angle + turnWay() * revolve.slot);
    const rig = rigs[index];
    hero = index;
    turntables.hold(index);
    const arrive = handover ? HANDOVER : MOVE; // when it stands in front, facing the visitor

    let fromZ = shot.z; // where the camera starts moving in from
    if (handover) {
      const target = revolve.angleFor(index, { direction: way });
      const wide = director.frameGroup(index, { margin: FRAME.handover, angle: halfwayTo(target) });
      fromZ = wide.z;
      timeline.to(shot, { ...wide, duration: HANDOVER / 2, ease: 'sine.inOut' }, 0);
      timeline.to(revolve.turn, { angle: target, duration: HANDOVER, ease: 'power2.inOut' }, 0);
      timeline.add(director.lightStage(glow, glow, { duration: 1.2, ease: MOTION.light.ease }), 0);
    } else {
      timeline.to(revolve.turn, { angle: revolve.angleFor(index), duration: MOVE, ease: 'power2.inOut' }, 0);
    }
    faceFront(timeline, rig, arrive);
    const settleAt = handover ? HANDOVER / 2 : 0;
    const settled = arrive + (handover ? 0.4 : 0);
    timeline.add(director.lightStage(1, UPSTAGE, { duration: 1.6, ease: MOTION.light.ease }), Math.max(0.3, arrive - 1.4));
    timeline.add(director.accentTo(rig.data.accent, 1.8), Math.max(0.3, arrive - 1.8));
    const done = reveal(timeline, rig, arrive);
    moveIn(timeline, rig, { at: settleAt, arrival: settled - settleAt, until: done, fromZ });
  }

  // A costume coming to the centre turns to face the visitor as it arrives, the shortest way, in
  // `duration` (held: the director turns it).
  function faceFront(timeline, rig, duration) {
    const rotation = rig.turntable.rotation;
    timeline.to(rotation, { y: rotation.y + wrapAngle(-rotation.y), duration, ease: 'power2.inOut' }, 0);
  }

  // The hero's turn, from `at`, facing front: it turns to show its back, pauses, comes round to
  // its front and hands back to the slow turn, at one pace for every costume. Returns when done.
  function reveal(timeline, rig, at) {
    const rotation = rig.turntable.rotation;
    timeline.to(rotation, { y: `+=${Math.PI}`, duration: TURN, ease: (p) => hermite(p, 0, 0) }, at);
    const toFrontAt = at + TURN + BACK_HOLD;
    timeline.to(rotation, {
      y: `+=${Math.PI}`,
      duration: TURN,
      ease: (p) => hermite(p, 0, (DRIFT * TURN) / Math.PI),
    }, toFrontAt);
    const done = toFrontAt + TURN;
    timeline.call(() => turntables.free(rig.index, { ...drift, rolling: true }), null, done);
    return done;
  }

  // The camera onto a hero, in one move that never stops, from `at` until `until`: most of the
  // way in over its `arrival` (from `arrivalAt`, to the hero shot), with the slow lean-in running
  // underneath from then on. Before the arrival, an optional slight creep in (to `creepZ`) that
  // gathers into it. Moves in a row would stop between them (move in, stop, creep in): on a still
  // stage that reads as a second zoom. Each part is its own eased share of the distance, summed.
  const settleEase = gsap.parseEase('power2.inOut');
  const smoothEase = gsap.parseEase('sine.inOut');
  function moveIn(timeline, rig, { at, arrivalAt = at, arrival, until, fromZ, creepZ = fromZ }) {
    const held = director.heroShot(rig);
    const leaned = director.heroShot(rig, FRAME.heroIn);
    const duration = until - at;
    const total = fromZ - leaned.z || 1;
    const a0 = (arrivalAt - at) / duration;             // the arrival starts…
    const a1 = (arrivalAt + arrival - at) / duration;   // …and ends, as shares of the move
    const creep = clamp((fromZ - creepZ) / total, 0, 1);
    const reach = clamp((fromZ - held.z) / total - creep, 0, 1);
    const lean = 1 - creep - reach;
    const part = (p, from, to) => clamp((p - from) / (to - from), 0, 1);
    timeline.to(shot, {
      ...leaned,
      duration,
      ease: (p) => creep * smoothEase(part(p, 0, a1))
        + reach * settleEase(part(p, a0, a1))
        + lean * smoothEase(part(p, a0, 1)),
    }, at);
  }

  function start() {
    if (current) return;
    playStep(0, { skipMove: true }); // toAttract / startInAttract already framed the wide shot
  }

  function stop() {
    current?.kill();
    current = null;
    hero = null;
    rigs.forEach((rig, i) => turntables.free(i));
  }

  // A language switch moves the headline to the other side (and its words change length), and
  // rotating the iPad changes the whole layout: the current beat plays again, framed for the new
  // layout, with the same costume in front, and the loop carries on from there.
  function replay() {
    if (state.mode !== 'attract' || !current) return;
    const k = stepIndex;
    const again = hero;
    current.kill();
    rigs.forEach((rig, i) => turntables.free(i, drift)); // everyone back to the slow turn (a hero may be mid-reveal)
    playStep(k, { again, replaying: true });
  }
  onLanguage(() => {
    renderWords();
    replay();
  });
  stage.onResize(replay);

  // ── Touch ───────────────────────────────────────────────────────────
  // A tap enters the costume in the hero shot. In the wide shot, the one nearest the touch,
  // so a visitor doesn't have to hit the costume exactly from 1.5 m away.
  const point = new THREE.Vector3();
  turntables.onTap((event) => {
    if (state.mode !== 'attract' || director.locked) return;
    const index = hero ?? nearestTo(event.clientX);
    stop();
    director.toCostume(index);
  });

  function nearestTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    let nearest = 0;
    let best = Infinity;
    rigs.forEach((rig, i) => {
      point.set(0, (rig.top + rig.bottom) / 2, 0);
      rig.turntable.localToWorld(point).project(camera);
      const distance = Math.abs(rect.left + ((point.x + 1) / 2) * rect.width - clientX);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    return nearest;
  }

  // ── Every frame ─────────────────────────────────────────────────────
  const world = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  let shown = true;

  function update() {
    const attract = state.mode === 'attract';
    if (attract) start();
    else if (current) stop();

    if (attract !== shown) {
      shown = attract;
      gsap.to(headline, { autoAlpha: attract ? 1 : 0, duration: 0.6, ease: 'power1.inOut' });
    }

    // The teaser follows the hero's back hotspot and shows only while it faces the visitor.
    const back = hero !== null ? rigs[hero].data.hotspots.find((h) => h.side === 'back') : null;
    if (!attract || !back) {
      teaser.style.visibility = 'hidden';
      return;
    }
    const turntable = rigs[hero].turntable;
    world.set(...back.position);
    turntable.localToWorld(world);
    turntable.getWorldQuaternion(quaternion);
    normal.set(...back.normal).normalize().applyQuaternion(quaternion);
    toCamera.copy(camera.position).sub(world).normalize();
    const opacity = smoothstep(FACING_START, FACING_END, normal.dot(toCamera));
    world.project(camera);
    teaser.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
    teaser.style.opacity = opacity.toFixed(3);
    teaser.style.transform = `translate3d(${(((world.x + 1) / 2) * canvas.clientWidth).toFixed(1)}px, ${(((1 - world.y) / 2) * canvas.clientHeight).toFixed(1)}px, 0)`;
  }

  return { update, stop };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Wrap an angle to [−π, π], for the shortest turn.
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// An ease from 0 to 1 that starts at slope `start` and ends at slope `end` (speeds as shares of
// the move per its duration): a cubic Hermite curve, so a turn picks up from a costume's slow
// turn, and hands back to it, without a jolt. Stays monotonic for slopes up to 3.
function hermite(p, start, end) {
  const p2 = p * p;
  const p3 = p2 * p;
  return start * (p3 - 2 * p2 + p) + (3 * p2 - 2 * p3) + end * (p3 - p2);
}

function smoothstep(edge0, edge1, x) {
  const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}
