import { setLight } from './costumes.js';

// Selector thumbnails, rendered from the costumes themselves at load: always in step with the
// models, no image files to maintain. Rendering each costume once here also uploads its textures
// to the GPU before anyone can switch to it, so the first switch never stalls on an upload.

const SIZE = { width: 96, height: 128 }; // device px: 2× the 48 × 64 CSS size in the selector
const ANGLE = 0.35;                      // a three-quarter view reads a silhouette better than straight on

export function captureThumbnails({ stage, rigs, director }) {
  const { renderer, scene, camera } = stage;
  const canvas = renderer.domElement;
  const dpr = renderer.getPixelRatio();
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  // Frame each costume into a centred 3:4 window, then crop that window out of the canvas.
  const height = H * 0.84;
  const width = height * 0.75;
  const region = { left: (W - width) / 2, top: (H - height) / 2, width, height };

  const out = document.createElement('canvas');
  out.width = SIZE.width;
  out.height = SIZE.height;
  const ctx = out.getContext('2d');

  const saved = rigs.map((rig) => ({ visible: rig.turntable.visible, rotation: rig.turntable.rotation.y }));
  // Only the costume and its own shaft of light: no neighbours, no distant lights.
  const distance = scene.getObjectByName('distance');
  distance.visible = false;

  const urls = rigs.map((rig, i) => {
    rigs.forEach((r, j) => { r.turntable.visible = r.air.visible = j === i; });
    rig.station.position.set(0, 0, 0); // in front, where the director frames a costume
    rig.turntable.rotation.y = ANGLE;
    setLight(rig, 1);
    director.cut(director.frameCostume(rig, region));
    director.update();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    // Read straight after rendering, in the same task, while the drawing buffer is still valid.
    ctx.drawImage(canvas, region.left * dpr, region.top * dpr, region.width * dpr, region.height * dpr,
      0, 0, SIZE.width, SIZE.height);
    return out.toDataURL('image/jpeg', 0.85);
  });

  rigs.forEach((rig, i) => {
    rig.turntable.visible = saved[i].visible;
    rig.air.visible = true;
    rig.turntable.rotation.y = saved[i].rotation;
  });
  distance.visible = true;
  return urls; // the attract state sets the revolve, lights and camera for the first real frame
}
