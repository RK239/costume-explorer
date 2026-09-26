import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { t, onLanguage } from './i18n.js';
import { MOTION } from '../motion.js';

// Hotspot markers: buttons in the overlay that follow a point on the costume every frame.
// Like a world-space marker drawn as screen-space UI in Unity: the 3D point is projected
// to the screen, and the button is moved there with a CSS transform.

const FACING_START = 0.05; // dot(normal, toCamera) where a marker starts to appear…
const FACING_END = 0.3;    // …and where it's fully visible
const TAPPABLE = 0.5;      // below this opacity a marker can't be tapped
const LABEL_ON = 0.6;      // facing (dot) above which a detail's label draws out…
const LABEL_OFF = 0.45;    // …and below which it draws back; the gap stops it flickering
const STAGGER = 0.1;       // s between rings, or labels, arriving together
const LABEL_DELAY = 0.35;  // s after arriving before the first label follows its ring
const EDGE = 24;           // px a label keeps from the screen edge
const SIDE_DEAD_ZONE = 12; // px either side of the costume's centre line before a label changes side

export function createHotspots({ overlay, rigs, camera, canvas, turntables, onOpen }) {
  const layer = document.createElement('div');
  layer.className = 'hotspots';
  overlay.prepend(layer);
  gsap.set(layer, { autoAlpha: 0 });
  // Ring centre to the label's near edge, from tokens.css, so the edge check matches the layout.
  const labelOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--label-offset'));

  const markers = rigs.flatMap((rig) => rig.data.hotspots.map((data) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hotspot';
    el.setAttribute('aria-label', t(data.label));

    const ring = document.createElement('span');
    ring.className = 'hotspot__ring';
    const bloom = document.createElement('span');
    bloom.className = 'hotspot__bloom';
    const leader = document.createElement('span');
    leader.className = 'hotspot__leader';
    const label = document.createElement('span');
    label.className = 'hotspot__label';
    label.textContent = t(data.label);
    el.append(bloom, ring, leader, label);
    layer.append(el);

    const marker = {
      rig, data, el, ring, leader, label, bloom,
      key: `${rig.id}:${data.id}`,
      position: new THREE.Vector3(...data.position),
      normal: new THREE.Vector3(...data.normal).normalize(),
      labelWidth: 0,
      side: '',
      labelOn: false,   // whether the label is drawn out (or drawing out)
      labelTween: null,
    };
    el.addEventListener('click', () => onOpen(rig, data));
    return marker;
  }));

  onLanguage(() => {
    for (const marker of markers) {
      marker.el.setAttribute('aria-label', t(marker.data.label));
      marker.label.textContent = t(marker.data.label);
      marker.labelWidth = 0; // measured again the next time it shows
    }
  });

  const world = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  let layerShown = false;
  let panelRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  // Back hotspots that have bloomed this visit. The first time one turns into view it blooms
  // once: the reward for turning the costume. Cleared with the seen state on idle reset.
  const bloomed = new Set();

  // Called every frame from the main loop, after the camera has moved.
  function update() {
    // The layer shows in explore and story; it fades out for attract and camera moves.
    const show = state.mode === 'explore' || state.mode === 'story';
    const focus = rigs[state.focus];
    let arriving = false;
    if (show !== layerShown) {
      layerShown = show;
      arriving = show;
      gsap.to(layer, { autoAlpha: show ? 1 : 0, duration: 0.4, ease: 'power1.inOut' });
      // Arriving: the rings come in one after another, like a title sequence, and each
      // label follows its ring (below).
      if (show) {
        gsap.fromTo(markers.filter((m) => m.rig === focus).map((m) => m.ring),
          { scale: 0.4, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, ...MOTION.ringIn, stagger: STAGGER, overwrite: true });
      }
    }
    // Markers and labels show while exploring and while a story is open (the visitor can turn the
    // costume and go to the next detail as they read), not during a fast spin. The detail being
    // read keeps only its ring: the panel's title already names it.
    const reading = state.mode === 'story';
    const live = state.mode === 'explore' || reading;
    const labelsAllowed = !turntables.spinning && live;
    let revealed = 0; // labels drawn out this frame, staggered so they don't all land at once

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // Labels keep clear of the screen edges and, in a story, of the panel.
    let minX = EDGE;
    let maxX = width - EDGE;
    if (reading) {
      const panel = panelRect();
      if (document.documentElement.dir === 'rtl') minX = Math.max(minX, panel.left + panel.width + EDGE);
      else maxX = Math.min(maxX, panel.left - EDGE);
    }
    focus.turntable.getWorldQuaternion(quaternion);

    for (const marker of markers) {
      // Only the focused costume's markers.
      if (marker.rig !== focus) {
        hide(marker);
        continue;
      }
      const current = reading && state.story?.hotspot === marker.data;

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
      const dot = normal.dot(toCamera);
      const opacity = smoothstep(FACING_START, FACING_END, dot);
      marker.opacity = opacity;
      // The ring shows well before the label: the label draws out only once the detail faces
      // the visitor, and draws back as it turns away, so only what can be seen is named.
      let wantLabel = labelsAllowed && !current && dot > (marker.labelOn ? LABEL_OFF : LABEL_ON);

      // Label on the outward side: left of the costume's axis on screen → label goes left.
      // Physical left/right on purpose: labels follow the garment, not the reading direction.
      // Sizes are measured once, the first time the marker shows, never per frame (no layout thrash).
      if (!marker.labelWidth) marker.labelWidth = marker.label.offsetWidth;
      axis.set(0, marker.position.y, 0);
      focus.turntable.localToWorld(axis).project(camera);
      const axisX = ((axis.x + 1) / 2) * width;
      // A dead zone around the centre line, so a marker passing it doesn't flicker sides.
      let side = marker.side || (axisX > x ? 'left' : 'right');
      if (side === 'left' && x > axisX + SIDE_DEAD_ZONE) side = 'right';
      else if (side === 'right' && x < axisX - SIDE_DEAD_ZONE) side = 'left';
      const reach = labelOffset + marker.labelWidth;
      const fitsLeft = x - reach >= minX;
      const fitsRight = x + reach <= maxX;
      if (side === 'left' && !fitsLeft && fitsRight) side = 'right';
      else if (side === 'right' && !fitsRight && fitsLeft) side = 'left';
      // No room on either side (in a story, between the panel and the screen edge): the ring
      // shows alone, and its label draws out once the costume turns it into the clear.
      if (!(side === 'left' ? fitsLeft : fitsRight)) wantLabel = false;
      if (side !== marker.side) {
        const flipping = marker.side !== '';
        marker.side = side;
        marker.el.classList.toggle('is-left', side === 'left');
        marker.el.classList.toggle('is-right', side === 'right');
        // Changing side draws the label out again on its new side rather than jumping across.
        if (flipping && marker.labelOn && wantLabel) reveal(marker, 0);
      }
      if (wantLabel !== marker.labelOn) {
        if (wantLabel) reveal(marker, (arriving ? LABEL_DELAY : 0) + STAGGER * revealed++);
        else conceal(marker);
      }

      if (marker.data.side === 'back' && live && opacity >= TAPPABLE && !bloomed.has(marker.key)) {
        bloomed.add(marker.key);
        gsap.fromTo(marker.bloom,
          { scale: 1, autoAlpha: 0.95 },
          { scale: 3, autoAlpha: 0, ...MOTION.bloom, repeat: 1, repeatDelay: 0.15 });
      }

      const style = marker.el.style;
      style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
      style.opacity = opacity.toFixed(3);
      style.pointerEvents = opacity >= TAPPABLE && live ? 'auto' : 'none';
      style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }

  function hide(marker) {
    marker.opacity = 0;
    marker.el.style.visibility = 'hidden';
    marker.el.style.pointerEvents = 'none';
    if (marker.labelOn) conceal(marker, { instant: true });
  }

  // The hairline draws out from the ring, then the label settles in from the ring's side.
  function reveal(marker, delay) {
    marker.labelOn = true;
    marker.labelTween?.kill();
    const from = marker.side === 'left' ? 12 : -12;
    marker.labelTween = gsap.timeline({ delay })
      .fromTo(marker.leader, { scaleX: 0 }, { scaleX: 1, ...MOTION.hairline }, 0)
      .fromTo(marker.label, { autoAlpha: 0, x: from }, { autoAlpha: 1, x: 0, ...MOTION.labelIn }, 0.12);
  }

  // The label slips back towards the ring and the hairline follows it in.
  function conceal(marker, { instant = false } = {}) {
    marker.labelOn = false;
    marker.labelTween?.kill();
    if (instant) {
      marker.labelTween = null;
      gsap.set(marker.label, { autoAlpha: 0, x: 0 });
      gsap.set(marker.leader, { scaleX: 0 });
      return;
    }
    const to = marker.side === 'left' ? 8 : -8;
    marker.labelTween = gsap.timeline()
      .to(marker.label, { autoAlpha: 0, x: to, ...MOTION.labelOut }, 0)
      .to(marker.leader, { scaleX: 0, ...MOTION.labelOut }, 0.08);
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

  // How visible a hotspot's ring is right now (0–1): the story's line fades with it.
  function visibility(rig, data) {
    return markers.find((m) => m.rig === rig && m.data === data)?.opacity ?? 0;
  }

  return {
    update, markSeen, resetSeen, screenPosition, project, visibility,
    set panelRect(fn) { panelRect = fn; }, // the story panel's place, supplied by story.js
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
