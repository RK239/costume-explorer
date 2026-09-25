import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { flags } from '../state.js';

// Sharpness cap. 1.5 for now because the test device is an iPad 5th gen; a start-up quality
// check will pick 2 on stronger iPads later. ?dpr= overrides it for measuring.
const MAX_PIXEL_RATIO = 1.5;

// Soft fill from RoomEnvironment. The spot keys do the real lighting.
const ENV_INTENSITY = 0.35;

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, flags.dpr ?? MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral (Khronos PBR Neutral) keeps a textile's base colour close to the scan: it only
  // compresses the brightest highlights. AgX desaturates more, which dulls the silk. ?tone=agx
  // switches for comparison; Rakesh confirms by eye (DECISIONS.md).
  renderer.toneMapping = flags.tone === 'agx' ? THREE.AgXToneMapping : THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const stageColour = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim();
  scene.background = new THREE.Color(stageColour);

  // RoomEnvironment is generated in code, so there's no HDR file to download.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = ENV_INTENSITY;
  pmrem.dispose();

  // ~30° vertical FOV, roughly a 45 mm lens on full frame. Only the director moves it.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const resizeListeners = [];

  // setSize(..., false) leaves the canvas's CSS size alone, so this can't trigger itself again.
  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const listener of resizeListeners) listener(width, height);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    renderer,
    scene,
    camera,
    onResize: (listener) => resizeListeners.push(listener),
    render: () => renderer.render(scene, camera),
  };
}
