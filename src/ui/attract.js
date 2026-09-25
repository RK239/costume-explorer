import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { t } from './i18n.js';
import { lightTo } from '../stage/costumes.js';
import { MOTION } from '../motion.js';

// The attract state: the brief's most important screen, designed to stop someone 2–3 m away.
// A loop like a film sequence: a wide shot of all three, then each costume in turn as a hero
// shot, large beside the headline, lit while the others fall dark, turning once to show its
// back. When the back comes round, a ring pulses on the back hotspot: there's something to find.
// A tap enters the costume in the hero shot (or, in the wide shot, the one nearest the touch).

const MOVE = MOTION.glide.duration; // s, camera move between shots
const WIDE_HOLD = 3.5;     // s on the wide shot
const TURN = 3.2;          // s for each half turn of the hero (front → back, back → front)
const BACK_HOLD = 1.6;     // s the hero pauses with its back to the visitor
const DIM = 0.1;           // light level of the costumes that aren't the hero
const FACING_START = 0.2;  // the teaser ring fades in as the back hotspot turns to face the camera…
const FACING_END = 0.6;    // …and is fully visible from here

export function createAttract({ overlay, content, rigs, stage, director, turntables }) {
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
  headline.querySelector('.attract__title').textContent = t(content.exhibition.title);
  headline.querySelector('.attract__subtitle').textContent = t(content.exhibition.subtitle);
  headline.querySelector('.attract__invite-text').textContent = t(content.ui.touchToBegin);
  overlay.append(headline);

  // The director frames the costume beside the headline, so it needs the headline's place.
  director.headlineRect = () => ({
    left: headline.offsetLeft, top: headline.offsetTop, width: headline.offsetWidth, height: headline.offsetHeight,
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
  const steps = ['wide', ...rigs.map((rig, i) => i)];
  let stepIndex = 0;
  let current = null; // the running step's timeline
  let hero = null;    // index of the costume in the hero shot, if any

  function playStep(k, { skipMove = false } = {}) {
    stepIndex = k % steps.length;
    const step = steps[stepIndex];
    const timeline = gsap.timeline({ onComplete: () => playStep(stepIndex + 1) });
    current = timeline;

    if (step === 'wide') {
      hero = null;
      rigs.forEach((rig, i) => turntables.free(i)); // all three turn, out of sync
      if (!skipMove) timeline.add(director.glide(director.wideShot(), MOVE), 0);
      rigs.forEach((rig) => timeline.add(lightTo(rig, director.attractGlow, 1.6), 0.3));
      timeline.to({}, { duration: WIDE_HOLD }, skipMove ? 0 : MOVE);
      return;
    }

    // Hero shot: the camera travels to it while its light swells and the others fall dark,
    // it settles facing front, turns to show its back, pauses, and turns home.
    const rig = rigs[step];
    const turntable = rig.turntable.rotation;
    hero = step;
    turntables.hold(step);
    const front = turntable.y + wrapAngle(-turntable.y);
    timeline.add(director.glide(director.heroShot(rig), MOVE), 0);
    rigs.forEach((r, i) => timeline.add(lightTo(r, i === step ? 1 : DIM, 1.8), 0.3));
    timeline.add(director.accentTo(rig.data.accent, 1.8), 0.3);
    timeline.to(turntable, { y: front, duration: MOVE, ease: 'power2.inOut' }, 0);
    timeline.to(turntable, { y: front + Math.PI, duration: TURN, ease: 'power1.inOut' }, MOVE);
    timeline.to(turntable, { y: front + Math.PI * 2, duration: TURN, ease: 'power1.inOut' }, MOVE + TURN + BACK_HOLD);
    timeline.call(() => turntables.free(step), null, MOVE + 2 * TURN + BACK_HOLD);
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

  // Rotating the iPad mid-loop: replay the current shot for the new layout.
  stage.onResize(() => {
    if (state.mode !== 'attract' || !current) return;
    const k = stepIndex;
    stop();
    playStep(k);
  });

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

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function smoothstep(edge0, edge1, x) {
  const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}
