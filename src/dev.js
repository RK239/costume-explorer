import * as THREE from 'three';
import { state } from './state.js';

// Dev tools, only loaded with ?dev=1. Started before the models load, so an iPad (which has no
// console to read) shows what is happening on screen.
// - Stats panel (frame rate).
// - Load status per model, and any error, in the readout.
// - Tap a costume to get the costume-local position and normal of that spot, ready to paste
//   into content.json as a hotspot. Works the same on the iPad and in a desktop browser.

export async function startDevTools(overlay) {
  const { default: Stats } = await import('three/addons/libs/stats.module.js');
  const stats = new Stats();
  document.body.append(stats.dom);

  const readout = document.createElement('pre');
  readout.className = 'dev-readout';
  overlay.append(readout);

  const lines = new Map();
  const status = (key, text) => {
    lines.set(key, `${key}: ${text}`);
    readout.textContent = [...lines.values()].join('\n');
  };
  status('dev', `loading… (pixel ratio ${window.devicePixelRatio}, ${innerWidth}×${innerHeight})`);

  window.addEventListener('error', (event) => status('error', event.message));
  window.addEventListener('unhandledrejection', (event) => status('error', String(event.reason?.message ?? event.reason)));

  // Called once the stage exists: console handle and the hotspot tap tool.
  function attach({ stage, rigs, director, turntables, revolve }) {
    window.dev = { THREE, state, stage, rigs, director, turntables, revolve, probe };
    status('dev', 'tap a costume to log a hotspot position');

    // Console helper for placing hotspots precisely: fire a ray at costume `index` from one side,
    // at height y (metres) and `across` metres off-centre, in the costume's own space.
    // side: 'front' (+Z), 'back' (−Z), 'left' (−X), 'right' (+X). Returns the hotspot fields.
    function probe(index, side, y, across = 0) {
      const rig = rigs[index];
      const dirs = { front: [0, 0, -1], back: [0, 0, 1], left: [1, 0, 0], right: [-1, 0, 0] };
      const d = new THREE.Vector3(...dirs[side]);
      const origin = side === 'front' || side === 'back'
        ? new THREE.Vector3(across, y, -d.z * 2)
        : new THREE.Vector3(-d.x * 2, y, across);
      rig.turntable.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(
        rig.turntable.localToWorld(origin.clone()),
        d.clone().transformDirection(rig.turntable.matrixWorld),
      );
      const hit = ray.intersectObject(rig.model, true)[0];
      if (!hit) return null;
      const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (worldNormal.dot(ray.ray.direction) > 0) worldNormal.negate();
      const round = (v) => v.toArray().map((n) => Number(n.toFixed(3)));
      return {
        position: round(rig.turntable.worldToLocal(hit.point.clone())),
        normal: round(worldNormal.transformDirection(rig.turntable.matrixWorld.clone().invert())),
      };
    }

    // A small dot where the last tap landed, parented to the turntable so it turns with the costume.
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff3b6b, depthTest: false }),
    );
    dot.renderOrder = 999;

    const raycaster = new THREE.Raycaster();
    const canvas = stage.renderer.domElement;

    // Taps come from the turntable, which already tells a tap from a drag.
    turntables.onTap((event) => {
      const rect = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, stage.camera);

      const hit = raycaster.intersectObjects(rigs.map((rig) => rig.model), true)[0];
      if (!hit) return;
      const rig = rigs.find((r) => isInside(hit.object, r.model));

      // World → the turntable's local space, so the point stays put however the costume is turned.
      const position = rig.turntable.worldToLocal(hit.point.clone());
      const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      // Garments are double-sided; make sure the normal points back towards the side that was tapped.
      if (worldNormal.dot(raycaster.ray.direction) > 0) worldNormal.negate();
      const inverseTurntable = rig.turntable.matrixWorld.clone().invert();
      const normal = worldNormal.transformDirection(inverseTurntable);

      const round = (v) => v.toArray().map((n) => Number(n.toFixed(3)));
      const json = `"position": [${round(position).join(', ')}], "normal": [${round(normal).join(', ')}]`;

      rig.turntable.add(dot);
      dot.position.copy(position);
      status('tap', `${rig.id}\n${json}`);
      console.log(`[hotspot] ${rig.id}  ${json}`);
      navigator.clipboard?.writeText(json).catch(() => {});
    });
  }

  return { stats, status, attach };
}

function isInside(object, root) {
  for (let node = object; node; node = node.parent) if (node === root) return true;
  return false;
}
