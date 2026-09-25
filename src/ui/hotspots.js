import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { t } from './i18n.js';
import { MOTION } from '../motion.js';

// Hotspot markers: buttons in the overlay that follow a point on the costume every frame.
// Like a world-space marker drawn as screen-space UI in Unity: the 3D point is projected
// to the screen, and the button is moved there with a CSS transform.

const FACING_START = 0.05; // dot(normal, toCamera) where a marker starts to appear…
const FACING_END = 0.3;    // …and where it's fully visible
const TAPPABLE = 0.5;      // below this opacity a marker can't be tapped
const EDGE = 24;           // px a label keeps from the screen edge
const LABEL_GAP = 4;       // px beyond the touch target where the label starts (matches ui.css)
const SIDE_DEAD_ZONE = 12; // px either side of the costume's centre line before a label changes side

export function createHotspots({ overlay, rigs, camera, canvas, turntables, onOpen }) {
  const layer = document.createElement('div');
  layer.className = 'hotspots';
  overlay.prepend(layer);
  gsap.set(layer, { autoAlpha: 0 });

  const markers = rigs.flatMap((rig) => rig.data.hotspots.map((data) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hotspot';
    el.setAttribute('aria-label', t(data.label));

    const ring = document.createElement('span');
    ring.className = 'hotspot__ring';
    const bloom = document.createElement('span');
    bloom.className = 'hotspot__bloom';
    const label = document.createElement('span');
    label.className = 'hotspot__label';
    label.textContent = t(data.label);
    el.append(bloom, ring, label);
    layer.append(el);

    const marker = {
      rig, data, el, label, bloom,
      key: `${rig.id}:${data.id}`,
      position: new THREE.Vector3(...data.position),
      normal: new THREE.Vector3(...data.normal).normalize(),
      labelWidth: 0,
      side: '',
    };
    el.addEventListener('click', () => onOpen(rig, data));
    return marker;
  }));

  const world = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  let layerShown = false;
  let labelsShown = true;
  // Back hotspots that have bloomed this visit. The first time one turns into view it blooms
  // once: the reward for turning the costume. Cleared with the seen state on idle reset.
  const bloomed = new Set();

  // Called every frame from the main loop, after the camera has moved.
  function update() {
    // The layer shows in explore and story; it fades out for attract and camera moves.
    const show = state.mode === 'explore' || state.mode === 'story';
    if (show !== layerShown) {
      layerShown = show;
      gsap.to(layer, { autoAlpha: show ? 1 : 0, duration: 0.4, ease: 'power1.inOut' });
    }
    // Labels hide during a fast spin and come back once the turntable settles. In a story only
    // the ring stays: the panel's title already names the detail.
    const labels = !turntables.spinning && state.mode === 'explore';
    if (labels !== labelsShown) {
      labelsShown = labels;
      // overwrite: the newest instruction wins over any fade still running (e.g. a side flip).
      gsap.to(markers.map((m) => m.label), { autoAlpha: labels ? 1 : 0, duration: 0.25, overwrite: true });
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const focus = rigs[state.focus];
    focus.turntable.getWorldQuaternion(quaternion);

    for (const marker of markers) {
      // Only the focused costume's markers; in a story, only the one being read.
      const active = marker.rig === focus
        && (state.mode !== 'story' || state.story?.hotspot === marker.data);
      if (!active) {
        hide(marker);
        continue;
      }

      world.copy(marker.position);
      focus.turntable.localToWorld(world);
      ndc.copy(world).project(camera); // includes the lens shift
      if (ndc.z > 1) {
        hide(marker);
        continue;
      }
      const x = ((ndc.x + 1) / 2) * width;
      const y = ((1 - ndc.y) / 2) * height;

      // Facing test: fade the marker as its spot turns away from the viewer.
      normal.copy(marker.normal).applyQuaternion(quaternion);
      toCamera.copy(camera.position).sub(world).normalize();
      const facing = smoothstep(FACING_START, FACING_END, normal.dot(toCamera));
      const opacity = state.mode === 'story' ? 1 : facing;

      // Label on the outward side: left of the costume's axis on screen → label goes left.
      // Physical left/right on purpose: labels follow the garment, not the reading direction.
      // Sizes are measured once, the first time the marker shows, never per frame (no layout thrash).
      if (!marker.labelWidth) {
        marker.labelWidth = marker.label.offsetWidth;
        marker.hitSize = marker.el.offsetWidth;
      }
      axis.set(0, marker.position.y, 0);
      focus.turntable.localToWorld(axis).project(camera);
      const axisX = ((axis.x + 1) / 2) * width;
      // A dead zone around the centre line, so a marker passing it doesn't flicker sides.
      let side = marker.side || (axisX > x ? 'left' : 'right');
      if (side === 'left' && x > axisX + SIDE_DEAD_ZONE) side = 'right';
      else if (side === 'right' && x < axisX - SIDE_DEAD_ZONE) side = 'left';
      const reach = marker.hitSize / 2 + LABEL_GAP + marker.labelWidth;
      if (side === 'left' && x - reach < EDGE) side = 'right';
      else if (side === 'right' && x + reach > width - EDGE) side = 'left';
      if (side !== marker.side) {
        const flipping = marker.side !== '';
        marker.side = side;
        marker.el.classList.toggle('is-left', side === 'left');
        marker.el.classList.toggle('is-right', side === 'right');
        // Changing side fades the label back in rather than jumping across.
        if (flipping && labelsShown) {
          gsap.fromTo(marker.label, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out', overwrite: true });
        }
      }

      if (marker.data.side === 'back' && state.mode === 'explore' && opacity >= TAPPABLE && !bloomed.has(marker.key)) {
        bloomed.add(marker.key);
        gsap.fromTo(marker.bloom,
          { scale: 1, autoAlpha: 0.95 },
          { scale: 3, autoAlpha: 0, ...MOTION.bloom, repeat: 1, repeatDelay: 0.15 });
      }

      const style = marker.el.style;
      style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
      style.opacity = opacity.toFixed(3);
      style.pointerEvents = opacity >= TAPPABLE && state.mode === 'explore' ? 'auto' : 'none';
      style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }

  function hide(marker) {
    marker.el.style.visibility = 'hidden';
    marker.el.style.pointerEvents = 'none';
  }

  // Seen state: a ring fills once its story has been opened.
  function markSeen(rig, data) {
    const key = `${rig.id}:${data.id}`;
    state.seen.add(key);
    markers.find((m) => m.key === key)?.el.classList.add('is-seen');
  }

  function resetSeen() {
    state.seen.clear();
    bloomed.clear();
    for (const marker of markers) marker.el.classList.remove('is-seen');
  }

  // Where a hotspot is on screen right now, from the 3D projection (no layout read), so the
  // story's connecting line can follow the ring every frame cheaply.
  function project(rig, data) {
    world.set(...data.position);
    rig.turntable.localToWorld(world);
    ndc.copy(world).project(camera);
    return { x: ((ndc.x + 1) / 2) * canvas.clientWidth, y: ((1 - ndc.y) / 2) * canvas.clientHeight };
  }

  // Screen position of a hotspot right now: story.js starts its connection from here.
  function screenPosition(rig, data) {
    const marker = markers.find((m) => m.rig === rig && m.data === data);
    const rect = marker.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  return { update, markSeen, resetSeen, screenPosition, project };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
