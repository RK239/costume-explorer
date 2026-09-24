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

lockTouch();

const canvas = document.getElementById('stage');
const overlay = document.getElementById('overlay');
const stage = createStage(canvas);
mountHeadline(overlay, content.exhibition);

const rigs = await loadCostumes(stage.scene, content.costumes);
const director = createDirector(stage, rigs);
const turntables = createTurntables({ rigs, canvas, overlay, director });

let stats = null;
if (flags.dev) {
  import('./dev.js')
    .then(({ startDevTools }) => startDevTools({ stage, rigs, overlay, director, turntables }))
    .then((s) => (stats = s));
}

// Open on the lineup, then travel into the first costume. The selector (step 6) and the
// attract state (step 7) replace this with visitor choices.
director.enterAttract();
const firstCostume = Math.min(Math.max(flags.focus, 0), rigs.length - 1);
gsap.delayedCall(0.8, () => director.enterExplore(firstCostume));

// One loop for everything. GSAP's ticker drives both the tweens and the frames, so a camera
// tween and the frame that draws it always use the same clock.
gsap.ticker.add((time, deltaMs) => {
  stats?.begin();
  turntables.update(deltaMs / 1000);
  director.update();
  stage.render();
  stats?.end();
});
