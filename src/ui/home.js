import gsap from 'gsap';
import { state } from '../state.js';
import { t, onLanguage } from './i18n.js';

// The Home button, under the language button in the same corner (so it moves with it when the
// language flips). It takes the visitor back to the lineup: any story closes, the camera pulls
// back to the wide shot and the attract loop carries on. Unlike the idle reset it keeps what
// this visitor has found and their language: they're still here. Shown while exploring or in a
// story; in the attract state you're already home.

const HOUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4.5l8 6.7M6.6 9.6V19.5h10.8V9.6" '
  + 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createHome({ parent, content, onHome }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'home';
  button.innerHTML = `${HOUSE}<span></span>`;
  const label = button.querySelector('span');
  parent.append(button);
  gsap.set(button, { autoAlpha: 0 });

  const render = () => { label.textContent = t(content.ui.home); };
  render();
  onLanguage(render);

  let shown = false;
  button.addEventListener('click', () => {
    if (!onHome()) return;
    shown = false; // leave with the move, not after it
    gsap.to(button, { autoAlpha: 0, duration: 0.3, ease: 'power1.in', overwrite: true });
  });

  // Called every frame; only acts when the mode changes. It stays through a switch between
  // costumes (a transition while shown) and goes once the lineup is reached.
  function update() {
    const show = state.mode === 'explore' || state.mode === 'story' || (state.mode === 'transition' && shown);
    if (show === shown) return;
    shown = show;
    gsap.to(button, { autoAlpha: show ? 1 : 0, duration: 0.4, ease: 'power1.inOut', overwrite: true });
  }

  return { update };
}
