import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { lightUp, goDark } from './costumes.js';

// The director owns the camera. Visitors never move it; every move is a GSAP tween on `shot`.
//
// The camera never tilts or pans. It stands level and frames with lens shift
// (camera.setViewOffset), like a view camera's shift lens: verticals stay vertical, and moving
// the costume into a free part of the screen doesn't change its perspective.
// In Unity terms, `shot` is a Cinemachine virtual camera, and a tween between two shots is a blend.

const EYE_HEIGHT = 1.4;   // metres; a standing visitor looking slightly down at the plinth
const MARGIN = 1.1;       // breathing room around the framed costume
const MOVE = { duration: 1.6, ease: 'power2.inOut' };
const PANEL_GAP = 24;     // px between the story panel and the costume's region

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

  // The free region minus the story panel, taken from where the panel actually sits.
  // Landscape: the panel is at the inline end (right in English, left in Arabic).
  // Portrait: it's a sheet above the selector.
  function storyRegion() {
    const region = freeRegion();
    const panel = panelRect();
    if (isPortrait()) {
      return { ...region, height: Math.max(80, panel.top - PANEL_GAP - region.top) };
    }
    if (isRTL()) {
      const left = panel.left + panel.width + PANEL_GAP;
      return { ...region, left, width: Math.max(80, region.left + region.width - left) };
    }
    return { ...region, width: Math.max(80, panel.left - PANEL_GAP - region.left) };
  }

  // The shot that fits a subject inside a screen region.
  // subject: { x, bottom, top, radius } in metres, standing on the turntable axis at z = 0.
  // region: { left, top, width, height } in CSS pixels.
  function fit(subject, region, cameraY = EYE_HEIGHT) {
    const { width: W, height: H } = viewport();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const aspect = W / H;

    // Fit the height with the vertical FOV and the width with the horizontal one, scaled down
    // to the region's share of the screen; take whichever needs the camera further back.
    const height = subject.top - subject.bottom;
    const width = subject.radius * 2;
    const forHeight = (height * H) / (2 * region.height * t);
    const forWidth = (width * W) / (2 * region.width * t * aspect);
    const distance = Math.max(forHeight, forWidth) * MARGIN;

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
    const subject = { x: detailX, bottom: centreY - span / 2, top: centreY + span / 2, radius: span * 0.4 };
    return fit(subject, storyRegion(), centreY);
  }

  // The shot the current mode should hold, used after a resize.
  function shotForMode() {
    if (state.mode === 'attract') return frameLineup();
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

  const setAccent = (rig) => gsap.to(document.documentElement, {
    '--accent': rig.data.accent, duration: MOVE.duration, ease: 'power1.inOut',
  });

  // First frame: the lineup, all lit, no move.
  function startInAttract() {
    state.mode = 'attract';
    for (const rig of rigs) rig.turntable.visible = true;
    cut(frameLineup());
  }

  // Back to the lineup: every costume shows and lights up, the camera pulls back.
  // `extra` lets the caller fold other moves (closing a story) into the same timeline.
  function toAttract(extra) {
    const timeline = gsap.timeline();
    if (extra) timeline.add(extra, 0);
    for (const rig of rigs) rig.turntable.visible = true;
    rigs.forEach((rig) => timeline.add(lightUp(rig), 0.2));
    timeline.to(shot, { ...frameLineup(), ...MOVE }, 0.2);
    return play(timeline, 'attract');
  }

  // Into one costume (from the lineup or another costume): it lights up, the others go dark,
  // the camera travels to it and the accent colour follows. Once there, the others hide, so
  // they cost nothing to draw. `extra` folds another move (closing a story) into the timeline.
  function toCostume(index, extra) {
    const rig = rigs[index];
    state.focus = index;
    rig.turntable.visible = true;
    const timeline = gsap.timeline({
      onComplete: () => rigs.forEach((r, i) => { r.turntable.visible = i === index; }),
    });
    if (extra) timeline.add(extra, 0);
    rigs.forEach((r, i) => timeline.add(i === index ? lightUp(r) : goDark(r), 0));
    timeline.to(shot, { ...frameCostume(rig), ...MOVE }, 0);
    timeline.add(setAccent(rig), 0);
    return play(timeline, 'explore');
  }

  // Story in: the turntable turns the detail to the visitor, while the camera pushes in to a
  // medium shot and shifts the costume aside for the panel. Returns the timeline; story.js adds
  // the panel to it and plays it.
  function pushIn(rig, hotspot) {
    const angle = facingAngle(rig, hotspot);
    return gsap.timeline()
      .to(rig.turntable.rotation, { y: angle, duration: 1.3, ease: 'power2.inOut' }, 0)
      .to(shot, { ...detailShot(rig, hotspot, angle), duration: 1.4, ease: 'power2.inOut' }, 0.1);
  }

  // Story out: back to the full costume in the explore framing.
  function pullBack(rig) {
    return gsap.timeline().to(shot, { ...frameCostume(rig), duration: 1.1, ease: 'power2.inOut' }, 0);
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
    freeRegion,
    frameCostume,
    frameLineup,
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
