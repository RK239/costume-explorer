import gsap from 'gsap';
import { state } from '../state.js';
import { t } from './i18n.js';

// Costume selector: one labelled button per costume, always visible while exploring, one tap
// from any mode. Each shows how many of that costume's hotspots have been found.

export function createSelector({ overlay, content, rigs, director, story }) {
  const nav = document.createElement('nav');
  nav.className = 'selector';
  overlay.append(nav);
  gsap.set(nav, { autoAlpha: 0 });

  const items = rigs.map((rig, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selector__item';
    const name = document.createElement('span');
    name.className = 'selector__name';
    name.textContent = t(rig.data.shortTitle);
    const count = document.createElement('span');
    count.className = 'selector__count';
    button.append(name, count);
    button.addEventListener('click', () => choose(index));
    nav.append(button);
    return { button, count, rig };
  });

  function choose(index) {
    if (director.locked) return;
    if (state.mode === 'attract') return director.toCostume(index);
    if (index === state.focus) {
      // The current costume: from a story, this simply closes the story.
      if (state.mode === 'story') story.close();
      return undefined;
    }
    // From a story, the panel leaves inside the same move as the camera.
    return director.toCostume(index, state.mode === 'story' ? story.closeTimeline() : undefined);
  }

  let shown = false;
  let signature = '';

  // Called every frame; only touches the DOM when something it shows has changed.
  function update() {
    const show = state.mode === 'explore' || state.mode === 'story'
      || (state.mode === 'transition' && shown);
    if (show !== shown) {
      shown = show;
      gsap.to(nav, { autoAlpha: show ? 1 : 0, duration: 0.4, ease: 'power1.inOut' });
    }

    const next = `${state.focus}|${[...state.seen].join()}|${state.lang}`;
    if (next === signature) return;
    signature = next;
    for (const [index, item] of items.entries()) {
      const total = item.rig.data.hotspots.length;
      const found = [...state.seen].filter((key) => key.startsWith(`${item.rig.id}:`)).length;
      item.count.textContent = t(content.ui.found).replace('{n}', found).replace('{total}', total);
      item.button.setAttribute('aria-current', String(index === state.focus));
      item.button.classList.toggle('is-complete', found === total);
    }
  }

  return { update };
}
