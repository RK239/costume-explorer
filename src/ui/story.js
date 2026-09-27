import gsap from 'gsap';
import { state } from '../state.js';
import { t, onLanguage } from './i18n.js';
import { MOTION } from '../motion.js';

// The story: tapping a hotspot turns the detail to the visitor, pushes the camera in and opens
// a panel with three short chapters (Material → How it was made → The artistry), tapped
// through with no scrolling, plus an image.
//
// The transition is connected, not a page swap: as the panel settles, a line draws from the
// hotspot's ring to the panel, and the close-up grows out of the ring into its place in the
// panel, so the image reads as leaning in to that exact spot.

const CHAPTERS = ['material', 'made', 'artistry'];
const RING_RADIUS = 16; // px from the ring's centre where the connecting line starts

export function createStory({ overlay, content, director, turntables, hotspots, onSeen }) {
  // The line sits under the panel; the flying close-up sits above everything.
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  line.setAttribute('class', 'story-line');
  line.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('pathLength', '1'); // so the draw-on works in fractions, whatever the length
  line.append(path);
  overlay.append(line);
  gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });

  const panel = document.createElement('aside');
  panel.className = 'story';
  panel.innerHTML = `
    <figure class="story__figure">
      <div class="story__frame">
        <img class="story__image" alt="" draggable="false" />
        <figcaption class="story__pending"></figcaption>
      </div>
    </figure>
    <button type="button" class="story__close"><span aria-hidden="true">×</span></button>
    <div class="story__body">
      <p class="story__costume"></p>
      <h2 class="story__title"></h2>
      <div class="story__tabs" role="tablist"></div>
      <p class="story__text" role="tabpanel" dir="auto"></p>
    </div>`;
  overlay.append(panel);
  gsap.set(panel, { autoAlpha: 0 });

  const flyer = document.createElement('div');
  flyer.className = 'story-flyer';
  flyer.setAttribute('aria-hidden', 'true');
  overlay.append(flyer);
  gsap.set(flyer, { autoAlpha: 0 });

  const $ = (selector) => panel.querySelector(selector);
  const closeButton = $('.story__close');
  const title = $('.story__title');
  const figure = $('.story__figure');
  const frame = $('.story__frame');
  let lean = null; // the close-up's slow push-in
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
  const panelBox = () => ({
    left: panel.offsetLeft, top: panel.offsetTop, width: panel.offsetWidth, height: panel.offsetHeight,
  });
  director.panelRect = panelBox;
  hotspots.panelRect = panelBox; // their labels keep clear of it

  let chapter = 0;

  function fill(rig, hotspot) {
    closeButton.setAttribute('aria-label', t(content.ui.close));
    $('.story__costume').textContent = t(rig.data.shortTitle);
    title.textContent = t(hotspot.label);
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

  onLanguage(() => {
    if (!state.story) return;
    const { rig, hotspot } = state.story;
    closeButton.setAttribute('aria-label', t(content.ui.close));
    $('.story__costume').textContent = t(rig.data.shortTitle);
    title.textContent = t(hotspot.label);
    tabs.forEach((tab, i) => { tab.textContent = t(content.ui.chapters[CHAPTERS[i]]); });
    pending.textContent = t(content.ui.imagePending);
    image.alt = hotspot.image?.alt ? t(hotspot.image.alt) : '';
    renderChapter(hotspot);
  });

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

  // Where the panel slides in from: the inline end, in both orientations (right in English,
  // left in Arabic).
  function offscreen() {
    return { xPercent: document.documentElement.dir === 'rtl' ? -100 : 100, yPercent: 0 };
  }

  // The close-up growing out of the ring: a copy of the image (or the placeholder) starts as the
  // ring itself and grows into the image frame's place in the panel (tilted like the sheet, for
  // a sketch), then hands over to the real one.
  function grow(rig, hotspot) {
    const ready = image.complete && image.naturalWidth > 0 && hotspot.image?.src;
    const sketch = hotspot.image?.kind === 'sketch';
    flyer.style.backgroundImage = ready ? `url("${image.currentSrc || image.src}")` : '';
    flyer.classList.toggle('is-pending', !ready);
    flyer.classList.toggle('is-sketch', sketch);
    const tilt = sketch ? parseFloat(getComputedStyle(panel).getPropertyValue('--sketch-tilt')) || 0 : 0;
    const ring = () => hotspots.project(rig, hotspot);
    // The frame's layout box, ignoring its tilt: read when the growth starts, with the panel in place.
    const target = () => ({
      left: panel.offsetLeft + figure.offsetLeft + frame.offsetLeft,
      top: panel.offsetTop + figure.offsetTop + frame.offsetTop,
      width: frame.offsetWidth,
      height: frame.offsetHeight,
    });
    // Nothing shows until the growth starts (immediateRender: false): the start is read then, from
    // where the ring is once the camera has landed, and the copy fades in as it leaves the ring.
    return gsap.timeline()
      .fromTo(flyer, {
        left: () => ring().x - RING_RADIUS, top: () => ring().y - RING_RADIUS,
        width: RING_RADIUS * 2, height: RING_RADIUS * 2, borderRadius: RING_RADIUS, rotation: 0,
      }, {
        left: () => target().left, top: () => target().top,
        width: () => target().width, height: () => target().height,
        borderRadius: sketch ? 1 : 0, rotation: tilt,
        ...MOTION.grow,
        immediateRender: false,
      })
      .fromTo(flyer, { autoAlpha: 0 }, { autoAlpha: 1, ...MOTION.growFade, immediateRender: false }, 0)
      .set(figure, { autoAlpha: 1 })
      .call(() => startLean(hotspot))
      .to(flyer, { autoAlpha: 0, duration: 0.2 });
  }

  // "A close-up should feel like leaning in": once it lands, it keeps pushing in, very slowly,
  // continuing the camera's move.
  function startLean(hotspot) {
    lean?.kill();
    gsap.set(image, { scale: 1 });
    if (hotspot.image?.kind === 'closeup') {
      lean = gsap.to(image, { scale: 1.08, duration: 14, ease: 'none' });
    }
  }

  function open(rig, hotspot) {
    if (director.locked) return;
    if (state.mode === 'story') return switchTo(rig, hotspot);
    if (state.mode !== 'explore') return;
    state.story = { rig, hotspot };
    hotspots.markSeen(rig, hotspot);
    onSeen?.();
    fill(rig, hotspot);

    turntables.hold(rig.index);
    const settle = 0.6 + MOTION.panelIn.duration; // when the panel has arrived
    const timeline = gsap.timeline();
    timeline.set(figure, { autoAlpha: 0 }, 0);
    timeline.add(director.pushIn(rig, hotspot), 0);
    timeline.add(director.upstage(true), 0); // the costumes upstage go dark while the visitor reads
    timeline.fromTo(panel,
      { ...offscreen(), autoAlpha: 0 },
      { xPercent: 0, yPercent: 0, autoAlpha: 1, ...MOTION.panelIn },
      0.6);
    timeline.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ...MOTION.draw }, settle - 0.1);
    timeline.add(grow(rig, hotspot), settle - 0.1);
    // Once the story has landed, the costume is the visitor's again: they can turn it to find the
    // next detail while they read (turntable.js keeps it from auto-rotating in a story).
    return director.play(timeline, 'story').then(() => turntables.free(rig.index, { wait: false }));
  }

  // Another hotspot while a story is open: the story moves in place, no closing. The words and the
  // image leave, the costume turns the new detail to the visitor as the camera pushes in on it,
  // and the story returns for it, its image growing out of the new ring as when it first opened.
  // Tapping the detail being read, after turning away from it, pushes in on it again.
  function switchTo(rig, hotspot) {
    const same = hotspot === state.story.hotspot;
    if (same && !state.story.overview) return undefined;
    const body = $('.story__body');
    gsap.killTweensOf(flyer);
    turntables.hold(rig.index);
    const timeline = gsap.timeline();
    timeline.add(director.pushIn(rig, hotspot), 0);
    if (!same) {
      timeline.to([body, figure], { autoAlpha: 0, ...MOTION.swapOut }, 0);
      timeline.to(path, { strokeDashoffset: 1, ...MOTION.retract }, 0);
      timeline.call(() => {
        lean?.kill();
        state.story = { rig, hotspot };
        hotspots.markSeen(rig, hotspot);
        onSeen?.();
        fill(rig, hotspot);
        // The image grows from the new ring once the words are back (built now: it needs the new image).
        timeline.add(grow(rig, hotspot), 1.15);
      }, null, MOTION.swapOut.duration);
      timeline.to(body, { autoAlpha: 1, ...MOTION.swapIn }, 0.9);
      timeline.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ...MOTION.draw }, 1.15);
    } else {
      state.story.overview = false;
    }
    return director.play(timeline, 'story').then(() => turntables.free(rig.index, { wait: false }));
  }

  // The first time the visitor turns the costume in a story, the camera eases back from the
  // detail to the whole costume beside the panel, so the other hotspots are in view.
  turntables.onGrab(() => {
    if (state.mode !== 'story' || !state.story || state.story.overview) return;
    state.story.overview = true;
    director.storyOverview(state.story.rig);
  });

  // The line retracts and the panel leaves: for folding into another timeline (closing,
  // switching costume, the idle reset).
  function closeTimeline() {
    const rig = state.story?.rig;
    const timeline = gsap.timeline({
      onComplete: () => {
        if (rig) turntables.free(rig.index);
        state.story = null;
      },
    });
    gsap.killTweensOf(flyer);
    lean?.kill();
    timeline.set(flyer, { autoAlpha: 0 }, 0);
    timeline.to(path, { strokeDashoffset: 1, ...MOTION.retract }, 0);
    timeline.to(panel, { ...offscreen(), autoAlpha: 0, ...MOTION.panelOut }, 0.1);
    return timeline;
  }

  function close() {
    if (director.locked || state.mode !== 'story') return;
    const rig = state.story.rig;
    const timeline = gsap.timeline();
    timeline.add(closeTimeline(), 0);
    timeline.add(director.pullBack(rig), 0.2);
    timeline.add(director.upstage(false), 0.2);
    return director.play(timeline, 'explore');
  }

  closeButton.addEventListener('click', close);
  // Tapping the stage (not the panel) also closes the story.
  turntables.onTap(() => { if (state.mode === 'story') close(); });

  // Every frame while a story is open: the line runs from the ring's edge to the panel's
  // inline-start edge, level with the title, so it stays attached if the layout changes.
  function update() {
    if (!state.story) return;
    const ring = hotspots.project(state.story.rig, state.story.hotspot);
    const panelLeft = panel.offsetLeft;
    const rtl = document.documentElement.dir === 'rtl';
    const endX = rtl ? panelLeft + panel.offsetWidth : panelLeft;
    const endY = panel.offsetTop + title.offsetTop + title.offsetHeight / 2;
    const angle = Math.atan2(endY - ring.y, endX - ring.x);
    const startX = ring.x + Math.cos(angle) * RING_RADIUS;
    const startY = ring.y + Math.sin(angle) * RING_RADIUS;
    path.setAttribute('d', `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`);
    // The line belongs to the ring: as the visitor turns the detail away, it fades with it.
    line.style.opacity = hotspots.visibility(state.story.rig, state.story.hotspot).toFixed(3);
  }

  return { open, close, closeTimeline, update, get isOpen() { return !!state.story; } };
}
