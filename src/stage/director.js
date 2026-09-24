import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { lightUp, goDark } from './costumes.js';

// The director owns the camera. Visitors never move it; every move is a GSAP tween on `shot`.
//
// The camera never tilts or pans. It stands level at eye height and frames the costume with
// lens shift (camera.setViewOffset), like a view camera's shift lens: verticals stay vertical,
// and moving the costume into a free part of the screen doesn't change its perspective.
// In Unity terms, `shot` is a Cinemachine virtual camera, and a tween between two shots is a blend.

const EYE_HEIGHT = 1.4;   // metres; a standing visitor looking slightly down at the plinth
const MARGIN = 1.1;       // breathing room around the framed costume
const MOVE = { duration: 1.6, ease: 'power2.inOut' };

export function createDirector(stage, rigs) {
  const { camera, renderer } = stage;
  const canvas = renderer.domElement;

  // The live shot. x/y/z: camera position. shiftX/shiftY: lens shift in NDC units.
  const shot = { x: 0, y: EYE_HEIGHT, z: 10, shiftX: 0, shiftY: 0 };
  let locked = false;
  let reframePending = false;

  // Where the costume may sit: the screen minus the bands reserved for UI (tokens.css).
  function freeRegion() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const css = getComputedStyle(document.documentElement);
    const top = parseFloat(css.getPropertyValue('--frame-top'));
    const bottom = parseFloat(css.getPropertyValue('--frame-bottom'));
    const inline = parseFloat(css.getPropertyValue('--frame-inline'));
    return { left: inline, top, width: width - 2 * inline, height: height - top - bottom };
  }

  // The shot that fits a subject inside a screen region.
  // subject: { x, bottom, top, radius } in metres, standing on the turntable axis at z = 0.
  // region: { left, top, width, height } in CSS pixels.
  function fit(subject, region, cameraY = EYE_HEIGHT) {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
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

  // The shot the current mode should hold, used after a resize.
  function shotForMode() {
    return state.mode === 'attract' ? frameLineup() : frameCostume(rigs[state.focus]);
  }

  // Runs a mode change. Input is locked until the timeline finishes; then the new mode starts.
  function play(timeline, nextMode) {
    state.mode = 'transition';
    locked = true;
    return new Promise((resolve) => {
      timeline.eventCallback('onComplete', () => {
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

  function enterAttract() {
    state.mode = 'attract';
    cut(frameLineup());
  }

  // From the lineup (or another costume) into one costume: it lights up, the others go dark,
  // and the camera travels to it.
  function enterExplore(index) {
    state.focus = index;
    const timeline = gsap.timeline();
    rigs.forEach((rig, i) => timeline.add(i === index ? lightUp(rig) : goDark(rig), 0));
    timeline.to(shot, { ...frameCostume(rigs[index]), ...MOVE }, 0);
    return play(timeline, 'explore');
  }

  // Pixels on screen per radian of turn at the costume's outer edge, for the current shot.
  // The turntable uses it so the costume follows the finger at any camera distance.
  function pixelsPerRadian(rig) {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return (rig.radius / (shot.z * t)) * (canvas.clientHeight / 2);
  }

  // Called every frame from the main loop.
  function update() {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
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
    freeRegion,
    frameCostume,
    frameLineup,
    cut,
    play,
    enterAttract,
    enterExplore,
    pixelsPerRadian,
    update,
  };
}
