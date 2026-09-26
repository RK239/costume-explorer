import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/rtl.css';
import gsap from 'gsap';
import content from './content.json';
import { flags, state } from './state.js';
import { lockTouch } from './ui/touch-lock.js';
import { createStage } from './stage/scene.js';
import { loadCostumes } from './stage/costumes.js';
import { createDirector } from './stage/director.js';
import { createTurntables } from './stage/turntable.js';
import { createAttract } from './ui/attract.js';
import { createHotspots } from './ui/hotspots.js';
import { createStory } from './ui/story.js';
import { createSelector } from './ui/selector.js';
import { createIdle } from './ui/idle.js';
import { createLabel } from './ui/label.js';
import { captureThumbnails } from './stage/thumbnails.js';
import { setLanguage, createLanguageSwitch } from './ui/i18n.js';
import { createHome } from './ui/home.js';
import { updateAtmosphere } from './stage/atmosphere.js';

lockTouch();

const canvas = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const stage = createStage(canvas);

// Dev tools start before loading, so the iPad can show load progress and errors on screen.
const devTools = flags.dev ? await import('./dev.js').then((m) => m.startDevTools(overlay)) : null;
const stats = devTools?.stats;

const costumes = content.costumes.map((c) => (flags.skip.includes(c.id) ? { ...c, model: '' } : c));
const rigs = await loadCostumes(stage.scene, costumes, { onStatus: devTools?.status });
const director = createDirector(stage, rigs);
const turntables = createTurntables({ rigs, canvas, overlay, director });
director.turntables = turntables;
// Selector thumbnails, rendered from the costumes (this also uploads every texture up front).
const thumbnails = captureThumbnails({ stage, rigs, director });

const attract = createAttract({ overlay, content, rigs, stage, director, turntables });

// Hotspots open stories; a story marks its hotspot as seen.
let story = null;
const hotspots = createHotspots({
  overlay, rigs, camera: stage.camera, canvas, turntables,
  onOpen: (rig, hotspot) => story.open(rig, hotspot),
});
story = createStory({ overlay, content, director, turntables, hotspots });
const selector = createSelector({ overlay, content, rigs, director, story, thumbnails });
const label = createLabel({ overlay, rigs });

// The top corner at the inline end: the language button with Home under it. One container, so
// both move together when the language flips the page.
const corner = document.createElement('div');
corner.className = 'corner';
overlay.append(corner);

// English / Arabic: the words fade, the page flips direction, the camera follows the new layout
// (director.toLanguage). A second tap while that runs is ignored.
let switching = false;
createLanguageSwitch({
  parent: corner,
  content,
  onSwitch: async (lang) => {
    if (switching || director.locked) return;
    switching = true;
    const run = director.toLanguage(() => setLanguage(lang), overlay);
    await (run.then ? run : new Promise((done) => run.eventCallback('onComplete', done)));
    switching = false;
  },
});
devTools?.attach({ stage, rigs, director, turntables });

// Home: back to the lineup with a pull-back to the wide shot, then the attract loop as usual.
// Any open story closes inside the same move. Keeps this visitor's finds and language.
const home = createHome({
  parent: corner,
  content,
  onHome: () => {
    if (director.locked || state.mode === 'attract') return false;
    director.toAttract(state.story ? story.closeTimeline() : undefined);
    return true;
  },
});

// After 45 s with no touch: close any story, forget what was found (the next person is a new
// visitor), reset the language, and go back to the lineup, all in one move.
const idle = createIdle({
  seconds: flags.idleSeconds,
  onIdle: function returnToAttract() {
    if (state.mode === 'attract') return;
    if (director.locked) {
      gsap.delayedCall(1, returnToAttract); // mid-move: try again once it lands
      return;
    }
    const closing = state.story ? story.closeTimeline() : undefined;
    hotspots.resetSeen();
    setLanguage('en');
    director.toAttract(closing);
  },
});

director.startInAttract();
// ?focus=n skips the attract state for testing.
if (flags.focus !== null) {
  gsap.delayedCall(0.8, () => {
    attract.stop();
    director.toCostume(Math.min(Math.max(flags.focus, 0), rigs.length - 1));
  });
}

// One loop for everything. GSAP's ticker drives both the tweens and the frames, so a camera
// tween, the hotspots that follow the costume and the frame that draws them share one clock.
gsap.ticker.add((time, deltaMs) => {
  stats?.begin();
  turntables.update(deltaMs / 1000);
  director.update();
  updateAtmosphere(time, stage.renderer.getPixelRatio());
  stage.camera.updateMatrixWorld();
  hotspots.update();
  story.update();
  selector.update();
  label.update();
  home.update();
  attract.update();
  stage.render();
  stats?.end();
});

if (flags.dev) window.dev.idle = idle;
