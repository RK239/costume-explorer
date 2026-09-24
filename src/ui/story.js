import gsap from 'gsap';
import { state } from '../state.js';
import { t } from './i18n.js';

// The story: tapping a hotspot turns the detail to the visitor, pushes the camera in and opens
// a panel with three short chapters (Material → How it was made → The artistry), tapped
// through with no scrolling, plus an image. Phase 1 look: plain panel, plain image.

const CHAPTERS = ['material', 'made', 'artistry'];

export function createStory({ overlay, content, director, turntables, hotspots, onSeen }) {
  const panel = document.createElement('aside');
  panel.className = 'story';
  panel.innerHTML = `
    <button type="button" class="story__close"><span aria-hidden="true">×</span></button>
    <p class="story__costume"></p>
    <h2 class="story__title"></h2>
    <div class="story__tabs" role="tablist"></div>
    <p class="story__text" role="tabpanel"></p>
    <figure class="story__figure">
      <img class="story__image" alt="" draggable="false" />
      <figcaption class="story__pending"></figcaption>
    </figure>`;
  overlay.append(panel);
  gsap.set(panel, { autoAlpha: 0 });

  const $ = (selector) => panel.querySelector(selector);
  const closeButton = $('.story__close');
  const tabs = CHAPTERS.map((chapter, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'story__tab';
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => showChapter(i));
    $('.story__tabs').append(tab);
    return tab;
  });

  const image = $('.story__image');
  const pending = $('.story__pending');
  // Until Rakesh's renders exist, a missing image shows a labelled placeholder, never a broken icon.
  image.addEventListener('error', () => panel.classList.add('is-pending'));
  image.addEventListener('load', () => panel.classList.remove('is-pending'));

  // The director frames the costume beside the panel, so it needs the panel's place on screen.
  // offset* values ignore transforms, so this is right even while the panel is slid off-screen.
  director.panelRect = () => ({
    left: panel.offsetLeft, top: panel.offsetTop, width: panel.offsetWidth, height: panel.offsetHeight,
  });

  let chapter = 0;

  function fill(rig, hotspot) {
    closeButton.setAttribute('aria-label', t(content.ui.close));
    $('.story__costume').textContent = t(rig.data.shortTitle);
    $('.story__title').textContent = t(hotspot.label);
    tabs.forEach((tab, i) => { tab.textContent = t(content.ui.chapters[CHAPTERS[i]]); });
    pending.textContent = t(content.ui.imagePending);
    panel.dataset.kind = hotspot.image?.kind ?? 'closeup';
    image.alt = hotspot.image?.alt ? t(hotspot.image.alt) : '';
    panel.classList.remove('is-pending');
    if (hotspot.image?.src) image.src = hotspot.image.src;
    else panel.classList.add('is-pending');
    chapter = 0;
    renderChapter(state.story.hotspot);
  }

  function renderChapter(hotspot) {
    $('.story__text').textContent = t(hotspot[CHAPTERS[chapter]]);
    tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === chapter)));
  }

  function showChapter(i) {
    if (i === chapter || !state.story) return;
    chapter = i;
    const text = $('.story__text');
    gsap.timeline()
      .to(text, { autoAlpha: 0, duration: 0.15, ease: 'power1.in' })
      .call(() => renderChapter(state.story.hotspot))
      .to(text, { autoAlpha: 1, duration: 0.25, ease: 'power1.out' });
  }

  // Where the panel slides in from: the inline end in landscape (right in English, left in
  // Arabic), the bottom in portrait.
  function offscreen() {
    // Same test as the CSS, so the slide direction always matches the layout.
    if (matchMedia('(orientation: portrait)').matches) return { xPercent: 0, yPercent: 100 };
    return { xPercent: document.documentElement.dir === 'rtl' ? -100 : 100, yPercent: 0 };
  }

  function open(rig, hotspot) {
    if (director.locked || state.mode !== 'explore') return;
    state.story = { rig, hotspot };
    hotspots.markSeen(rig, hotspot);
    onSeen?.();
    fill(rig, hotspot);

    turntables.hold(rig.index);
    const timeline = gsap.timeline();
    timeline.add(director.pushIn(rig, hotspot), 0);
    timeline.fromTo(panel,
      { ...offscreen(), autoAlpha: 0 },
      { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out' },
      0.6);
    return director.play(timeline, 'story');
  }

  // Just the panel leaving, for folding into another timeline (switching costume, idle reset).
  function closeTimeline() {
    const rig = state.story?.rig;
    const timeline = gsap.timeline({
      onComplete: () => {
        if (rig) turntables.free(rig.index);
        state.story = null;
      },
    });
    timeline.to(panel, { ...offscreen(), autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, 0);
    return timeline;
  }

  function close() {
    if (director.locked || state.mode !== 'story') return;
    const rig = state.story.rig;
    const timeline = gsap.timeline();
    timeline.add(closeTimeline(), 0);
    timeline.add(director.pullBack(rig), 0.15);
    return director.play(timeline, 'explore');
  }

  closeButton.addEventListener('click', close);
  // Tapping the stage (not the panel) also closes the story.
  turntables.onTap(() => { if (state.mode === 'story') close(); });

  return { open, close, closeTimeline, get isOpen() { return !!state.story; } };
}
