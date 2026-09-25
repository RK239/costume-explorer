import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { lightTo, setLight } from './costumes.js';
import { MOTION } from '../motion.js';

// The director owns the camera. Visitors never move it; every move is a GSAP tween on `shot`.
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
const HERO_MARGIN = 1.03;  // hero shots fill the frame: almost no breathing room
const HERO_FLOOR = 0.06;   // m of mount or plinth a hero shot keeps below the garment

export function createDirector(stage, rigs) {
  const { camera, renderer } = stage;
  const canvas = renderer.domElement;

  // The live shot. x/y/z: camera position. shiftX/shiftY: lens shift in NDC units.
  const shot = { x: 0, y: EYE_HEIGHT, z: 10, shiftX: 0, shiftY: 0 };
  let locked = false;
  let reframePending = false;
  // Where the story panel sits on screen, in px, supplied by story.js (the director doesn't
  // read the DOM itself). Its layout position, ignoring the slide-in transform.
  let panelRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  // The turntables, set by main.js once they exist (they need the director first).
  let turntables = null;
  // Same for the attract headline, supplied by attract.js.
  let headlineRect = () => ({ left: 0, top: 0, width: 0, height: 0 });

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

  // The attract composition: the costume takes the part of the screen the headline leaves free.
  // Landscape: the headline is a column at the inline end, the costume beside it, like a poster.
  // Portrait: the headline sits at the bottom, the costume above.
  function attractRegion() {
    const { width, height } = viewport();
    const text = headlineRect();
    const inline = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--frame-inline'));
    if (isPortrait()) {
      return {
        left: inline, top: ATTRACT_EDGE, width: width - 2 * inline,
        height: Math.max(80, text.top - PANEL_GAP - ATTRACT_EDGE),
      };
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
  // subject: { x, bottom, top, radius } in metres, standing on the turntable axis at z = 0.
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
    return { x: rig.turntable.position.x, bottom: rig.bottom, top: rig.top, radius: rig.radius };
  }

  function lineupSubject() {
    const xs = rigs.map((rig) => rig.turntable.position.x);
    const reach = Math.max(...rigs.map((rig) => rig.radius));
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      bottom: Math.min(...rigs.map((rig) => rig.bottom)),
      top: Math.max(...rigs.map((rig) => rig.top)),
      radius: (Math.max(...xs) - Math.min(...xs)) / 2 + reach,
    };
  }

  const frameCostume = (rig, region = freeRegion()) => fit(subjectOf(rig), region);
  const frameLineup = (region = freeRegion()) => fit(lineupSubject(), region);
  // Attract shots: the whole lineup, or one costume as large as the composition allows. A hero
  // shot frames the garment itself, not its plinth: a mounted garment's rod and plinth run out
  // of the bottom of the frame, so the costume, not the air below it, fills the height.
  const wideShot = () => frameLineup(attractRegion());
  function heroShot(rig) {
    const subject = {
      x: rig.turntable.position.x,
      bottom: Math.max(rig.bottom, rig.box.min.y - HERO_FLOOR),
      top: rig.top,
      radius: rig.garmentRadius,
    };
    return fit(subject, attractRegion(), EYE_HEIGHT, HERO_MARGIN);
  }

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
    const detailX = rig.turntable.position.x + px * Math.cos(angle) + pz * Math.sin(angle);
    const span = hotspot.frame * (rig.top - rig.bottom);
    const centreY = THREE.MathUtils.clamp(py, rig.bottom + span / 2, rig.top - span / 2);
    // A crop narrower than it is tall, to suit the tall column beside the panel.
    const subject = { x: detailX, bottom: centreY - span / 2, top: centreY + span / 2, radius: span * 0.3 };
    return fit(subject, storyRegion(), centreY);
  }

  // The shot the current mode should hold, used after a resize.
  function shotForMode() {
    if (state.mode === 'attract') return wideShot(); // attract.js re-frames its own hero shots
    const rig = rigs[state.focus];
    if (state.mode === 'story' && state.story) return detailShot(rig, state.story.hotspot, rig.turntable.rotation.y);
    return frameCostume(rig);
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

  // A costume and the shaft of light it stands in show and hide together.
  function show(rig, visible) {
    rig.turntable.visible = rig.air.visible = visible;
  }

  // First frame: the attract wide shot, every costume softly lit, no move.
  function startInAttract() {
    state.mode = 'attract';
    for (const rig of rigs) {
      show(rig, true);
      setLight(rig, ATTRACT_GLOW);
    }
    cut(wideShot());
  }

  // Back to the lineup: every costume shows at the attract glow, the camera pulls back, and
  // every costume turns back to its first position, so the loop never carries on from where
  // the last visitor left it. `extra` lets the caller fold other moves (closing a story) into
  // the same timeline.
  function toAttract(extra) {
    const timeline = gsap.timeline();
    if (extra) timeline.add(extra, 0);
    for (const rig of rigs) show(rig, true);
    rigs.forEach((rig) => timeline.add(lightTo(rig, ATTRACT_GLOW), 0.2));
    timeline.to(shot, { ...wideShot(), ...MOTION.camera }, 0.2);
    turnHome(timeline, 0.2);
    return play(timeline, 'attract');
  }

  // Every costume turns back, the shortest way, to its first position, then stands still until
  // the attract loop sets it turning again. The target is read when the turn starts, since the
  // turntables keep moving until then. Holding again at the end also wins over a story's close,
  // which lets its costume go part-way through.
  function turnHome(timeline, position) {
    const { duration, ease } = MOTION.home;
    rigs.forEach((rig, i) => {
      const rotation = rig.turntable.rotation;
      timeline.call(() => turntables?.hold(i), null, position);
      timeline.to(rotation, { y: () => rotation.y + wrapAngle(rig.home - rotation.y), duration, ease }, position);
      timeline.call(() => turntables?.hold(i), null, position + duration);
    });
  }

  // Into one costume (from the lineup or another costume): the camera travels to it, the costume
  // it leaves fades to black as it goes, and this one comes up out of black as the camera lands,
  // like a cross-fade of stage lights. The accent colour follows. The costume arrives mid-turn and
  // settles facing the visitor as the camera lands, so the first view is always its front, then
  // keeps turning slowly. Once there, the others hide (black by then, so it's never seen), and
  // they cost nothing to draw. `extra` folds another move (closing a story) into the timeline.
  function toCostume(index, extra) {
    const rig = rigs[index];
    const rotation = rig.turntable.rotation;
    const front = rotation.y + wrapAngle(-rotation.y); // the nearest front
    // Switching from another costume, this one was hidden, so it comes into view in black (a
    // neighbour's edge can already sit inside the frame) and is set out of sight to arrive the same
    // way every time: turning forward by the same gentle angle onto its front. Arriving from the
    // lineup it's in view, so it takes the shorter way to its front instead.
    const hidden = !rig.turntable.visible;
    const start = hidden ? front - MOTION.arrive.angle : rotation.y;
    state.focus = index;
    if (hidden) setLight(rig, 0);
    show(rig, true);
    turntables?.hold(index);
    rotation.y = start;
    const timeline = gsap.timeline({
      onComplete: () => {
        rigs.forEach((r, i) => show(r, i === index));
        // Straight into its slow turn: the arrival was a move, not a touch, so no pause.
        turntables?.free(index, { wait: false });
      },
    });
    if (extra) timeline.add(extra, 0);
    const { lightIn, lightOut } = MOTION;
    rigs.forEach((r, i) => {
      if (i === index) timeline.add(lightTo(r, 1, lightIn.duration, lightIn.ease), lightIn.at);
      else timeline.add(lightTo(r, 0, lightOut.duration, lightOut.ease), 0);
    });
    timeline.to(shot, { ...frameCostume(rig), ...MOTION.camera }, 0);
    timeline.to(rotation, { y: front, duration: MOTION.camera.duration, ease: MOTION.arrive.ease }, 0);
    timeline.add(setAccent(rig), 0);
    return play(timeline, 'explore');
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
    attractGlow: ATTRACT_GLOW,
    turnHome,
    freeRegion,
    frameCostume,
    frameLineup,
    wideShot,
    heroShot,
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
