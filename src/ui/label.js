import gsap from 'gsap';
import { state } from '../state.js';
import { t, onLanguage } from './i18n.js';

// The costume's title card, like a museum label: its title and one line of wearer/place context,
// centred above the costume while exploring. It arrives once the camera has landed on the
// costume and leaves as soon as the camera moves again (switching, a story, the attract state),
// so it always names what is on screen.

export function createLabel({ overlay, rigs, director }) {
  const label = document.createElement('header');
  label.className = 'costume-label';
  label.innerHTML = `
    <span class="costume-label__rule" aria-hidden="true"></span>
    <h2 class="costume-label__title"></h2>
    <p class="costume-label__context"></p>`;
  overlay.append(label);
  gsap.set(label, { autoAlpha: 0 });

  const title = label.querySelector('.costume-label__title');
  const context = label.querySelector('.costume-label__context');
  let shown = false;
  let tween = null;

  // Called every frame; only acts when the mode changes.
  function update() {
    const show = state.mode === 'explore';
    if (show === shown) return;
    shown = show;
    tween?.kill();
    if (show) {
      render();
      tween = gsap.fromTo(label, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' });
    } else {
      tween = gsap.to(label, { autoAlpha: 0, duration: 0.3, ease: 'power1.in' });
    }
  }

  function render() {
    const rig = rigs[state.focus];
    title.textContent = t(rig.data.title);
    context.textContent = t(rig.data.context);
  }
  onLanguage(render);

  // The director frames each costume below its own card, so it needs to know how far down the
  // card reaches before the card is shown: a long title wraps on a narrow screen, and Arabic runs
  // larger. Measured with a hidden copy of the card, for every costume, once per layout (screen
  // size and language, and again once the web fonts have loaded).
  const probe = label.cloneNode(true);
  probe.setAttribute('aria-hidden', 'true');
  gsap.set(probe, { autoAlpha: 0, y: 0 });
  overlay.append(probe);
  let measured = null;
  document.fonts?.addEventListener?.('loadingdone', () => { measured = null; });
  director.labelBottom = (index) => {
    const key = `${overlay.clientWidth}x${overlay.clientHeight}|${state.lang}`;
    if (measured?.key !== key) {
      measured = {
        key,
        bottoms: rigs.map((rig) => {
          probe.querySelector('.costume-label__title').textContent = t(rig.data.title);
          probe.querySelector('.costume-label__context').textContent = t(rig.data.context);
          return probe.offsetTop + probe.offsetHeight;
        }),
      };
    }
    return measured.bottoms[index];
  };

  return { update };
}
