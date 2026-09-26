import gsap from 'gsap';
import { state } from '../state.js';
import { t, num, onLanguage } from './i18n.js';

// Costume selector: one button per costume, with a thumbnail rendered from the costume itself,
// always visible while exploring, one tap from any mode. Each shows how many of that costume's
// hotspots have been found. Once every hotspot on the current costume is found, the next
// unfinished costume's button pulses gently: an invitation to come back for the others.

export function createSelector({ overlay, content, rigs, director, story, thumbnails = [] }) {
  const nav = document.createElement('nav');
  nav.className = 'selector';
  overlay.append(nav);
  gsap.set(nav, { autoAlpha: 0 });

  const items = rigs.map((rig, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selector__item';
    const thumb = document.createElement('img');
    thumb.className = 'selector__thumb';
    thumb.alt = '';
    thumb.draggable = false;
    if (thumbnails[index]) thumb.src = thumbnails[index];
    const name = document.createElement('span');
    name.className = 'selector__name';
    name.textContent = t(rig.data.shortTitle);
    const count = document.createElement('span');
    count.className = 'selector__count';
    button.append(thumb, name, count);
    button.addEventListener('click', () => choose(index));
    nav.append(button);
    return { button, name, count, rig };
  });
  onLanguage(() => { for (const item of items) item.name.textContent = t(item.rig.data.shortTitle); });

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
  let nudged = null;
  let nudge = null;

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
      item.complete = found === total;
      item.count.textContent = t(content.ui.found).replace('{n}', num(found)).replace('{total}', num(total));
      item.button.setAttribute('aria-current', String(index === state.focus));
      item.button.classList.toggle('is-complete', item.complete);
    }
    updateNudge();
  }

  // The next unfinished costume after the current one, if the current one is complete.
  function updateNudge() {
    let next = null;
    if (items[state.focus].complete) {
      for (let k = 1; k < items.length && !next; k++) {
        const item = items[(state.focus + k) % items.length];
        if (!item.complete) next = item;
      }
    }
    if (next === nudged) return;
    nudge?.kill();
    if (nudged) gsap.set(nudged.button, { clearProps: 'boxShadow' });
    nudged = next;
    if (!next) return;
    const colour = next.rig.data.accent;
    nudge = gsap.fromTo(next.button,
      { boxShadow: `0 0 0 0 ${colour}99` },
      { boxShadow: `0 0 0 14px ${colour}00`, duration: 1.6, ease: 'power2.out', repeat: -1, repeatDelay: 0.8 });
  }

  return { update };
}
