import * as THREE from 'three';

// Dev tools, only loaded with ?dev=1.
// - Stats panel (frame rate).
// - Tap a costume to get the costume-local position and normal of that spot, ready to paste
//   into content.json as a hotspot. Works the same on the iPad and in a desktop browser.

export async function startDevTools({ stage, rigs, overlay, director, turntables }) {
  const { default: Stats } = await import('three/addons/libs/stats.module.js');
  const stats = new Stats();
  document.body.append(stats.dom);

  // Handle for poking at the stage from the browser console, e.g. dev.rigs[0].key.intensity.
  window.dev = { stage, rigs, director, turntables };

  const readout = document.createElement('pre');
  readout.className = 'dev-readout';
  readout.textContent = 'Dev: tap a costume to log a hotspot position';
  overlay.append(readout);

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
    readout.textContent = `${rig.id}\n${json}`;
    console.log(`[hotspot] ${rig.id}  ${json}`);
    navigator.clipboard?.writeText(json).catch(() => {});
  });

  return stats;
}

function isInside(object, root) {
  for (let node = object; node; node = node.parent) if (node === root) return true;
  return false;
}
