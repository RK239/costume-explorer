import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../state.js';
import { t } from './i18n.js';

// Basic attract state (Phase 1): the lineup, a headline, and a tap enters a costume.
// Step 8 designs it properly: light swelling on each costume in turn, bilingual type,
// an invitation that works from 2–3 m.

export function createAttract({ overlay, content, rigs, camera, canvas, director, turntables }) {
  const headline = document.createElement('header');
  headline.className = 'headline';
  const title = document.createElement('h1');
  title.textContent = t(content.exhibition.title);
  const hook = document.createElement('p');
  hook.textContent = t(content.exhibition.hook);
  const invite = document.createElement('p');
  invite.className = 'headline__invite';
  invite.textContent = t(content.ui.touchToBegin);
  headline.append(title, hook, invite);
  overlay.append(headline);

  // A tap anywhere on the stage enters the costume nearest to it on screen, so a visitor
  // doesn't have to hit the costume exactly from 1.5 m away.
  const point = new THREE.Vector3();
  turntables.onTap((event) => {
    if (state.mode !== 'attract' || director.locked) return;
    const rect = canvas.getBoundingClientRect();
    let nearest = 0;
    let best = Infinity;
    rigs.forEach((rig, i) => {
      point.set(0, (rig.top + rig.bottom) / 2, 0);
      rig.turntable.localToWorld(point).project(camera);
      const x = rect.left + ((point.x + 1) / 2) * rect.width;
      const distance = Math.abs(x - event.clientX);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    director.toCostume(nearest);
  });

  let shown = true;

  // Called every frame: the headline belongs to the attract state only.
  function update() {
    const show = state.mode === 'attract';
    if (show !== shown) {
      shown = show;
      gsap.to(headline, { autoAlpha: show ? 1 : 0, duration: 0.6, ease: 'power1.inOut' });
    }
  }

  return { update };
}
