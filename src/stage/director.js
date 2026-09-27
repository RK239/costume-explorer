import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { MOTION } from '../motion.js';

// The director owns the camera and the revolving stage (revolve.js). Visitors never move the
// camera; every move is a GSAP tween on `shot`. The camera stays at the front of the stage and
// the revolve brings each costume to it; a visitor can also turn the revolve with a swipe.
//
// The camera never tilts or pans. It stands level and frames with lens shift
// (camera.setViewOffset), like a view camera's shift lens: verticals stay vertical, and moving
// the costume into a free part of the screen doesn't change its perspective.
// In Unity terms, `shot` is a Cinemachine virtual camera, and a tween between two shots is a blend.

const EYE_HEIGHT = 1.4;   // metres; a standing visitor looking slightly down at the plinth
const MARGIN = 1.1;       // breathing room around the framed costume
const PANEL_GAP = 24;     // px between the story panel and the costume's region
const ATTRACT_GLOW = 0.55; // light level of every costume in the attract wide shot
const ATTRACT_EDGE = 24;   // px the attract framing keeps from the screen's top and bottom
const WIDE_MARGIN = 1.35;  // the attract wide shot: the group with air around it
const HERO_MARGIN = 1.1;   // an attract hero shot: the group, a little closer
const ATTRACT_EYE = 0.8;   // m: the attract loop's camera height, about the costumes' middle, so the three line up around one axis
const HIT_MARGIN = 24;     // px around a costume that still counts as touching it

export function createDirector(stage, rigs, revolve) {
  const { camera, renderer } = stage;
  const canvas = renderer.domElement;

  // The live shot. x/y/z: camera position. shiftX/shiftY: lens shift in NDC units. The costume in
  // front stands at the origin (revolve.js), so every costume shot is framed there.
  const shot = { x: 0, y: EYE_HEIGHT, z: 10, shiftX: 0, shiftY: 0 };
  let locked = false;
  let reframePending = false;
  // Where the story panel sits on screen, in px, supplied by story.js (the director doesn't
  // read the DOM itself). Its layout position, ignoring the slide-in transform.
  let panelRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  // The turntables, set by main.js once they exist (they need the director first).
  let turntables = null;
  // Same for the attract headline, supplied by attract.js: its box, and in portrait where the
  // title block ends and the invitation begins.
  let headlineRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  let headlineBands = () => ({ top: 0, bottom: viewport().height });

  const viewport = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
  // Same test as the CSS (@media (orientation: portrait)), so layout and camera never disagree.
  const isPortrait = () => matchMedia('(orientation: portrait)').matches;
  const isRTL = () => document.documentElement.dir === 'rtl';

  // Where the costume may sit: the screen minus the bands reserved for UI (tokens.css).
  function freeRegion() {
    const { width, height } = viewport();
    const css = getComputedStyle(document.documentElement);
    const top = parseFloat(css.getPropertyValue('--frame-top'));
    const bottom = parseFloat(css.getPropertyValue('--frame-bottom'));
    const inline = parseFloat(css.getPropertyValue('--frame-inline'));
    return { left: inline, top, width: width - 2 * inline, height: height - top - bottom };
  }

  // The free region minus the story panel, taken from where the panel actually sits: a column at
  // the inline end (right in English, left in Arabic) in both orientations. A costume is tall and
  // narrow, so it keeps the full height beside the panel. (Rakesh's call: a bottom sheet in
  // portrait halved the costume's height.)
  function storyRegion() {
    const region = freeRegion();
    const panel = panelRect();
    if (isRTL()) {
      const left = panel.left + panel.width + PANEL_GAP;
      return { ...region, left, width: Math.max(80, region.left + region.width - left) };
    }
    return { ...region, width: Math.max(80, panel.left - PANEL_GAP - region.left) };
  }

  // The attract composition: the costumes take the part of the screen the headline leaves free.
  // Landscape: the headline is a column at the inline end, the costumes beside it, like a poster.
  // Portrait: the title sits at the top and the invitation at the bottom, both centred, and the
  // costumes stand between them.
  function attractRegion() {
    const { width, height } = viewport();
    const text = headlineRect();
    const css = getComputedStyle(document.documentElement);
    const inline = parseFloat(css.getPropertyValue('--frame-inline'));
    if (isPortrait()) {
      const bands = headlineBands();
      const top = bands.top + PANEL_GAP;
      const bottom = bands.bottom - PANEL_GAP;
      return { left: inline, top, width: width - 2 * inline, height: Math.max(80, bottom - top) };
    }
    const top = ATTRACT_EDGE;
    const regionHeight = height - 2 * ATTRACT_EDGE;
    if (isRTL()) {
      const left = text.left + text.width + PANEL_GAP;
      return { left, top, width: Math.max(80, width - inline - left), height: regionHeight };
    }
    return { left: inline, top, width: Math.max(80, text.left - PANEL_GAP - inline), height: regionHeight };
  }

  // The shot that fits a subject inside a screen region.
  // subject: { x, bottom, top, radius } in metres, standing on the turntable axis at z = 0 (the front of the revolve).
  // region: { left, top, width, height } in CSS pixels.
  function fit(subject, region, cameraY = EYE_HEIGHT, margin = MARGIN) {
    const { width: W, height: H } = viewport();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const aspect = W / H;

    // Fit the height with the vertical FOV and the width with the horizontal one, scaled down
    // to the region's share of the screen; take whichever needs the camera further back.
    const height = subject.top - subject.bottom;
    const width = subject.radius * 2;
    const forHeight = (height * H) / (2 * region.height * t);
    const forWidth = (width * W) / (2 * region.width * t * aspect);
    const distance = Math.max(forHeight, forWidth) * margin;

    // Lens shift: move the subject's centre from where a level camera sees it to the region's centre.
    const centreY = (subject.top + subject.bottom) / 2;
    const seenY = (centreY - cameraY) / (distance * t);
    const wantX = ((region.left + region.width / 2) / W) * 2 - 1;
    const wantY = 1 - ((region.top + region.height / 2) / H) * 2;

    return { x: subject.x, y: cameraY, z: distance, shiftX: wantX, shiftY: wantY - seenY };
  }

  function subjectOf(rig) {
    return { x: 0, bottom: rig.bottom, top: rig.top, radius: rig.radius }; // in front, where the revolve brings it
  }

  const frameCostume = (rig, region = freeRegion()) => fit(subjectOf(rig), region);

  // Attract shots frame the group: one costume in front (the hero) with the other two upstage
  // behind it, the stage closed up, fitted into the space beside the headline, so a passer-by
  // sees there are three to choose from. The hero leads by being nearest and best lit. The camera
  // stands lower than for exploring (ATTRACT_EYE, about the costumes' middle), so the three line
  // up around one axis; it rises to eye height as a visitor steps in. Upstage costumes look
  // smaller with distance, so each one is measured as it appears at the hero's depth: its reach,
  // its top, and the front edge of its plinth, which stands nearer the camera than its axis. That
  // depends on the camera distance, so it's refined a few times. `angle` frames the stage
  // part-way round instead (a hand-over, where the two costumes changing places swing out wider
  // than the pair upstage).
  function frameGroup(index, { margin = HERO_MARGIN, angle = revolve.angleFor(index), region = attractRegion() } = {}) {
    const hero = rigs[index];
    const subject = { x: 0, bottom: hero.bottom, top: hero.top, radius: hero.radius };
    let target = fit(subject, region, ATTRACT_EYE, margin);
    for (let k = 0; k < 4; k++) {
      const seen = rigs.map((rig, i) => {
        const { x, z } = revolve.positionAt(i, angle, 1);
        const axis = target.z / (target.z - z);
        const front = target.z / (target.z - z - rig.radius);
        return {
          reach: (Math.abs(x) + rig.radius) * axis,
          top: ATTRACT_EYE + (rig.top - ATTRACT_EYE) * axis,
          bottom: ATTRACT_EYE + (rig.bottom - ATTRACT_EYE) * front,
        };
      });
      subject.radius = Math.max(...seen.map((c) => c.reach));
      subject.top = Math.max(...seen.map((c) => c.top));
      subject.bottom = Math.min(...seen.map((c) => c.bottom));
      target = fit(subject, region, ATTRACT_EYE, margin);
    }
    return target;
  }
  // The wide shot has the revolve in its first position (the middle costume in front) and more
  // air around the group; a hero shot comes in closer on whichever costume is in front.
  const wideShot = (margin = WIDE_MARGIN) => frameGroup(revolve.middle, { margin });
  const heroShot = (rig, margin = HERO_MARGIN) => frameGroup(rig.index, { margin });

  // Turntable angle that turns a hotspot's normal straight at the camera. The camera looks at
  // the costume from +Z, so the normal's yaw a = atan2(nx, nz) must become 0: target = −a,
  // taken the short way round from wherever the turntable is now.
  function facingAngle(rig, hotspot) {
    const [nx, , nz] = hotspot.normal;
    const current = rig.turntable.rotation.y;
    return current + wrapAngle(-Math.atan2(nx, nz) - current);
  }

  // Medium shot of a hotspot, with the turntable at `angle`: `frame` × the costume's height,
  // centred on the detail, camera level at the detail's height, inside the story region.
  function detailShot(rig, hotspot, angle) {
    const [px, py, pz] = hotspot.position;
    const detailX = px * Math.cos(angle) + pz * Math.sin(angle); // the costume stands at the origin
    const span = hotspot.frame * (rig.top - rig.bottom);
    const centreY = THREE.MathUtils.clamp(py, rig.bottom + span / 2, rig.top - span / 2);
    // A crop narrower than it is tall, to suit the tall column beside the panel.
    const subject = { x: detailX, bottom: centreY - span / 2, top: centreY + span / 2, radius: span * 0.3 };
    return fit(subject, storyRegion(), centreY);
  }

  // The shot a mode should hold, used after a resize or a language switch.
  function shotForMode(mode = state.mode) {
    if (mode === 'attract') return wideShot(); // attract.js re-frames its own hero shots
    const rig = rigs[state.focus];
    if (mode === 'story' && state.story) {
      return state.story.overview ? frameCostume(rig, storyRegion()) : detailShot(rig, state.story.hotspot, rig.turntable.rotation.y);
    }
    return frameCostume(rig);
  }

  // In a story, once the visitor starts turning the costume: the camera eases back from the
  // detail to the whole costume beside the panel, so they can find the next hotspot as they read.
  // Not a locked move: their finger is already on the costume.
  function storyOverview(rig) {
    return gsap.to(shot, { ...frameCostume(rig, storyRegion()), ...MOTION.reframe, overwrite: 'auto' });
  }

  // Switching language re-lays the page out: in Arabic the story panel and the attract headline
  // move to the left, so the costume moves right. The words fade out, the page flips while they're
  // hidden (`apply`), the camera glides to the mirrored framing, and the words come back. In the
  // attract state the loop re-frames its own shot, so only the words fade.
  function toLanguage(apply, words) {
    const mode = state.mode;
    const { out, back } = MOTION.language;
    let target = null;
    const aim = (key) => (target ??= shotForMode(mode))[key]; // read after the flip
    const timeline = gsap.timeline();
    timeline.to(words, { opacity: 0, ...out });
    timeline.call(apply);
    if (mode !== 'attract') {
      timeline.to(shot, {
        x: () => aim('x'), y: () => aim('y'), z: () => aim('z'),
        shiftX: () => aim('shiftX'), shiftY: () => aim('shiftY'),
        ...MOTION.reframe,
      });
    }
    timeline.to(words, { opacity: 1, ...back }, mode === 'attract' ? '+=0.1' : '<0.3');
    return mode === 'attract' ? timeline : play(timeline, mode);
  }

  // Runs a mode change. Input is locked until the timeline finishes; then the new mode starts.
  function play(timeline, nextMode) {
    state.mode = 'transition';
    locked = true;
    // Keep any onComplete the timeline already has (e.g. hiding the other costumes).
    const own = timeline.eventCallback('onComplete');
    return new Promise((resolve) => {
      timeline.eventCallback('onComplete', () => {
        own?.();
        locked = false;
        state.mode = nextMode;
        if (reframePending) {
          reframePending = false;
          Object.assign(shot, shotForMode());
        }
        resolve();
      });
    });
  }

  // Jump straight to a shot. Only for the first frame and for resizes, never for a visible move.
  function cut(target) {
    Object.assign(shot, target);
  }

  const accentTo = (color, duration = MOTION.camera.duration) => gsap.to(document.documentElement, {
    '--accent': color, duration, ease: 'power1.inOut',
  });
  const setAccent = (rig) => accentTo(rig.data.accent);

  // A camera move that isn't a mode change (the attract loop), so it doesn't lock input:
  // a touch can interrupt it at any moment.
  function glide(target, duration = MOTION.glide.duration) {
    gsap.killTweensOf(shot);
    return gsap.to(shot, { ...target, duration, ease: MOTION.glide.ease });
  }

  // Stage light: the costume in front at `front`, the upstage ones at `back` (revolve.js mixes
  // them by position). One tween moves the whole stage's light.
  const lightStage = (front, back, vars = MOTION.light) => gsap.to(revolve.light, { front, back, ...vars });
  // In a story the upstage costumes go dark, so nothing competes with the reading; they come back
  // when it closes.
  const upstage = (dark) => lightStage(1, dark ? 0 : revolve.back);

  // First frame: the attract wide shot, the revolve in its first position, every costume softly
  // lit, no move.
  function startInAttract() {
    state.mode = 'attract';
    revolve.layout.attract = 1;
    revolve.turn.angle = revolve.angleFor(revolve.middle);
    Object.assign(revolve.light, { front: ATTRACT_GLOW, back: ATTRACT_GLOW });
    revolve.update();
    cut(wideShot());
  }

  // Back to the lineup (Home, or the idle return after a visitor): the revolve turns back to its
  // first position and closes up, every costume comes up to the attract glow and turns to face
  // front as the camera pulls back, so the loop never carries on from where the visitor left it.
  // `extra` lets the caller fold other moves (closing a story) into the same timeline.
  function toAttract(extra) {
    const timeline = gsap.timeline();
    if (extra) timeline.add(extra, 0);
    timeline.add(lightStage(ATTRACT_GLOW, ATTRACT_GLOW), 0.2);
    timeline.to(revolve.turn, { angle: revolve.angleFor(revolve.middle), ...MOTION.revolve }, 0.2);
    timeline.to(revolve.layout, { attract: 1, ...MOTION.revolve }, 0.2);
    timeline.to(shot, { ...wideShot(), ...MOTION.camera }, 0.2);
    turnHome(timeline, 0.2);
    return play(timeline, 'attract');
  }

  // Every costume turns, the shortest way, to face front (its first position), then stands still
  // until the attract loop sets it turning again: on the way back to the lineup, and at the start
  // of every attract loop. The target is read when the turn starts, since the turntables keep
  // moving until then. Holding again at the end also wins over a story's close, which lets its
  // costume go part-way through.
  function turnHome(timeline, position, duration = MOTION.home.duration) {
    const { ease } = MOTION.home;
    rigs.forEach((rig, i) => {
      const rotation = rig.turntable.rotation;
      timeline.call(() => turntables?.hold(i), null, position);
      timeline.to(rotation, { y: () => rotation.y + wrapAngle(rig.home - rotation.y), duration, ease }, position);
      timeline.call(() => turntables?.hold(i), null, position + duration);
    });
  }

  // Into one costume (from the lineup or another costume): the revolve turns it to the front,
  // the shortest way, while the camera settles on it. Light follows the revolve: it comes up as
  // it comes forward and the one it replaces dims as it goes upstage. The accent colour follows.
  // It settles facing the visitor as it lands, so the first view is always its front, then keeps
  // turning slowly. `extra` folds another move (closing a story) into the timeline.
  function toCostume(index, extra) {
    const timeline = gsap.timeline();
    if (extra) timeline.add(extra, 0);
    timeline.add(lightStage(1, revolve.back), 0);
    return land(timeline, revolve.angleFor(index), MOTION.revolve);
  }

  // The revolve comes to rest at `angle`, with its costume in front: the camera frames it, and it
  // turns its front to the visitor. Coming from the attract loop, the stage opens out around it
  // as the camera moves in. Shared by switching and by a swipe that's let go.
  function land(timeline, angle, { duration, ease }) {
    const index = revolve.frontAt(angle);
    const rig = rigs[index];
    const rotation = rig.turntable.rotation;
    const arriving = index !== state.focus || state.mode === 'attract';
    state.focus = index;
    timeline.to(revolve.turn, { angle, duration, ease }, 0);
    timeline.to(revolve.layout, { attract: 0, duration: Math.max(duration, 0.9), ease: MOTION.revolve.ease }, 0);
    timeline.to(shot, { ...frameCostume(rig), ...MOTION.camera, duration: Math.max(duration, 0.9) }, 0);
    if (arriving) {
      turntables?.hold(index);
      timeline.to(rotation, { y: () => rotation.y + wrapAngle(-rotation.y), duration, ease: MOTION.arrive.ease }, 0);
      timeline.add(setAccent(rig), 0);
      // Straight into its slow turn: the arrival was a move, not a touch, so no pause.
      timeline.eventCallback('onComplete', () => turntables?.free(index, { wait: false }));
    }
    return play(timeline, 'explore');
  }

  // A swipe on the empty stage: the finger turns the revolve (turntable.js sets the angle). The
  // costume's title and hotspots leave while it turns, and input waits until it lands.
  function beginSwipe() {
    state.mode = 'transition';
    locked = true;
  }

  // Let go: the revolve carries on to `angle` (a slot, chosen by turntable.js from how far and
  // how fast the finger went), or back to where it started. The farther it has to go, the longer.
  function landSwipe(angle) {
    const left = Math.abs(angle - revolve.turn.angle) / revolve.slot;
    return land(gsap.timeline(), angle, { duration: 0.5 + 0.8 * left, ease: MOTION.swipe.ease });
  }

  // Pixels on screen per radian of revolve, at the front: the swipe uses it so the costume in
  // front follows the finger.
  function revolvePixels() {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return (revolve.across / (shot.z * t)) * (canvas.clientHeight / 2);
  }

  // A costume's box on screen, in CSS px: its reach around its axis, plinth to top.
  const corner = new THREE.Vector3();
  function screenBox(rig) {
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    const { width: W, height: H } = viewport();
    for (const x of [-rig.radius, rig.radius]) {
      for (const y of [rig.bottom, rig.top]) {
        corner.set(x, y, 0).add(rig.station.position).project(camera);
        const px = ((corner.x + 1) / 2) * W;
        const py = ((1 - corner.y) / 2) * H;
        box.left = Math.min(box.left, px);
        box.right = Math.max(box.right, px);
        box.top = Math.min(box.top, py);
        box.bottom = Math.max(box.bottom, py);
      }
    }
    return box;
  }

  // Which costume a point on the screen touches (with some margin), front first: null for the
  // empty stage. `x`, `y` in CSS px relative to the canvas.
  function costumeAt(x, y) {
    const order = rigs.map((rig, i) => i).sort((a, b) => rigs[b].station.position.z - rigs[a].station.position.z);
    for (const i of order) {
      const rig = rigs[i];
      if (!rig.turntable.visible) continue;
      const box = screenBox(rig);
      if (x > box.left - HIT_MARGIN && x < box.right + HIT_MARGIN && y > box.top - HIT_MARGIN && y < box.bottom + HIT_MARGIN) return i;
    }
    return null;
  }

  // Story in: the turntable turns the detail to the visitor, while the camera pushes in to a
  // medium shot and shifts the costume aside for the panel. Returns the timeline; story.js adds
  // the panel to it and plays it.
  function pushIn(rig, hotspot) {
    const angle = facingAngle(rig, hotspot);
    return gsap.timeline()
      .to(rig.turntable.rotation, { y: angle, ...MOTION.turn }, 0)
      .to(shot, { ...detailShot(rig, hotspot, angle), ...MOTION.push }, 0.1);
  }

  // Story out: back to the full costume in the explore framing.
  function pullBack(rig) {
    return gsap.timeline().to(shot, { ...frameCostume(rig), ...MOTION.pull }, 0);
  }

  // Pixels on screen per radian of turn at the costume's outer edge, for the current shot.
  // The turntable uses it so the costume follows the finger at any camera distance.
  function pixelsPerRadian(rig) {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return (rig.radius / (shot.z * t)) * (canvas.clientHeight / 2);
  }

  // Called every frame from the main loop.
  function update() {
    const { width: W, height: H } = viewport();
    camera.position.set(shot.x, shot.y, shot.z);
    camera.setViewOffset(W, H, (-shot.shiftX * W) / 2, (shot.shiftY * H) / 2, W, H);
  }

  // Orientation changes re-frame straight away; mid-transition, once the move lands.
  stage.onResize(() => {
    if (locked) reframePending = true;
    else cut(shotForMode());
  });

  return {
    shot,
    get locked() { return locked; },
    set panelRect(fn) { panelRect = fn; },
    set turntables(t) { turntables = t; },
    set headlineRect(fn) { headlineRect = fn; },
    set headlineBands(fn) { headlineBands = fn; },
    attractGlow: ATTRACT_GLOW,
    lightStage,
    upstage,
    beginSwipe,
    landSwipe,
    revolvePixels,
    costumeAt,
    toLanguage,
    storyOverview,
    turnHome,
    freeRegion,
    frameCostume,
    wideShot,
    heroShot,
    frameGroup,
    glide,
    accentTo,
    cut,
    play,
    startInAttract,
    toAttract,
    toCostume,
    pushIn,
    pullBack,
    pixelsPerRadian,
    update,
  };
}

// Wrap an angle difference to [−π, π], for the shortest turn.
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
