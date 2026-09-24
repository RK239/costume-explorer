import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import gsap from 'gsap';
import content from './content.json';
import { flags } from './state.js';
import { lockTouch } from './ui/touch-lock.js';
import { createStage } from './stage/scene.js';
import { loadCostumes } from './stage/costumes.js';
import { createDirector } from './stage/director.js';
import { createTurntables } from './stage/turntable.js';
import { mountHeadline } from './ui/attract.js';
import { createHotspots } from './ui/hotspots.js';
import { createStory } from './ui/story.js';

lockTouch();

const canvas = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const stage = createStage(canvas);
mountHeadline(overlay, content.exhibition);

// Dev tools start before loading, so the iPad can show load progress and errors on screen.
const devTools = flags.dev ? await import('./dev.js').then((m) => m.startDevTools(overlay)) : null;
const stats = devTools?.stats;

const costumes = content.costumes.map((c) => (flags.skip.includes(c.id) ? { ...c, model: '' } : c));
const rigs = await loadCostumes(stage.scene, costumes, { onStatus: devTools?.status });
const director = createDirector(stage, rigs);
const turntables = createTurntables({ rigs, canvas, overlay, director });

// Hotspots open stories; a story marks its hotspot as seen.
let story = null;
const hotspots = createHotspots({
  overlay, rigs, camera: stage.camera, canvas, turntables,
  onOpen: (rig, hotspot) => story.open(rig, hotspot),
});
story = createStory({ overlay, content, director, turntables, hotspots });
devTools?.attach({ stage, rigs, director, turntables });

// Open on the lineup, then travel into the first costume. The selector (step 6) and the
// attract state (step 7) replace this with visitor choices.
director.startInAttract();
gsap.delayedCall(0.8, () => director.toCostume(Math.min(Math.max(flags.focus ?? 0, 0), rigs.length - 1)));

// One loop for everything. GSAP's ticker drives both the tweens and the frames, so a camera
// tween, the hotspots that follow the costume and the frame that draws them share one clock.
gsap.ticker.add((time, deltaMs) => {
  stats?.begin();
  turntables.update(deltaMs / 1000);
  director.update();
  stage.camera.updateMatrixWorld();
  hotspots.update();
  stage.render();
  stats?.end();
});
