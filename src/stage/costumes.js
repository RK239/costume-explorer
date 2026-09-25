import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createStandIn } from './stand-in.js';
import { MOTION } from '../motion.js';

// Metres between costumes along X. Close enough that the attract wide shot shows them large,
// far enough that a hero shot's neighbours only appear, dimmed, at the edges.
const SPACING = 1.8;

// Key light: front-high and a little off-axis, so it rakes across the fabric.
// Intensities are in candela (three.js physical units), so they fall off with distance.
// The cone is narrow enough not to spill onto the neighbours at this spacing.
const KEY = {
  offset: new THREE.Vector3(1.1, 3.4, 2.8), // from the costume's feet
  on: 55,
  off: 0.5,          // never 0 and never visible = false: changing the light count recompiles every shader
  angle: THREE.MathUtils.degToRad(15),
  penumbra: 0.7,
};const ENV_ON = 1;
const ENV_OFF = 0.08;

// Stage light that costs nothing to render: unlit gradients, added on top of what's behind.
// A glow on a backdrop behind each costume separates dark silk and steel from the black stage
// (the job a rim light would do, without another light every pixel pays for), and a pool of
// light on the floor around the plinth grounds it. Both brighten and dim with the costume.
const GLOW = { width: 3.2, height: 3.6, depth: -1.6, colour: 0x3a332c };
const POOL = { radius: 1.25, colour: 0x2a2520 };

const PLINTH_HEIGHT = 0.04;
const PLINTH_BORDER = 0.12; // metres of plinth showing around the costume's base
const FLOOR_BAND = 0.1;     // metres: the slice of the costume measured for its base

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// Loads every costume at once and stands each on its own turntable in a row.
// Resolves when all of them are ready, so switching never has to wait for a download.
// onStatus(id, text) is optional: the dev tools use it to show load progress on the iPad.
export async function loadCostumes(scene, costumes, { onStatus = () => {} } = {}) {
  const models = await Promise.all(
    costumes.map((data, index) => {
      if (!data.model) {
        onStatus(data.id, 'stand-in');
        return createStandIn(index);
      }
      const start = performance.now();
      const progress = (event) => {
        if (event.total) onStatus(data.id, `downloading ${Math.round((event.loaded / event.total) * 100)}%`);
      };
      // A missing file falls back to a stand-in, so one bad model never blanks the whole stage.
      return loadModel(data.model, progress)
        .then((model) => {
          onStatus(data.id, `ready in ${((performance.now() - start) / 1000).toFixed(1)} s`);
          return model;
        })
        .catch((error) => {
          console.warn(`Could not load ${data.model}; using a stand-in.`, error);
          onStatus(data.id, `FAILED, stand-in used (${error?.message ?? error})`);
          return createStandIn(index);
        });
    }),
  );

  const shadowTexture = createShadowTexture();
  const lightTexture = createLightTexture();

  return costumes.map((data, index) => {
    const model = models[index];
    const x = (index - (costumes.length - 1) / 2) * SPACING;

    // Measured before parenting, so everything is in the costume's own space.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    // The plinth is sized from what touches the floor (a gown's hem, not a dress's outstretched sleeves).
    const base = floorRadius(model, box);
    const plinthRadius = base + PLINTH_BORDER;
    // How far the garment reaches from the turntable axis at any angle (its box's farthest
    // corner), and with its plinth. The camera frames these, so it fits however it's turned.
    const garmentRadius = Math.max(
      Math.hypot(box.min.x, box.min.z), Math.hypot(box.min.x, box.max.z),
      Math.hypot(box.max.x, box.min.z), Math.hypot(box.max.x, box.max.z),
    );
    const radius = Math.max(plinthRadius + 0.02, garmentRadius);

    // The turntable is the pivot visitors turn: like an empty parent GameObject in Unity.
    const turntable = new THREE.Group();
    turntable.name = `turntable-${data.id}`;
    turntable.position.set(x, 0, 0);
    turntable.rotation.y = data.yawOffset ?? 0;
    turntable.add(model);
    scene.add(turntable);

    // Thin plinth that turns with the costume, so the turning reads even on a plain garment.
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(plinthRadius, plinthRadius + 0.02, PLINTH_HEIGHT, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.85 }),
    );
    plinth.position.y = -PLINTH_HEIGHT / 2;
    turntable.add(plinth);

    // A small index mark at the front edge, like the mark on a turntable platter.
    // A plain disc turning looks still; the mark shows it moving and where the front is.
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.004, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.5 }),
    );
    mark.position.set(0, 0.002, plinthRadius - 0.05);
    turntable.add(mark);

    // Fake contact shadow: a soft radial gradient on the plinth top. No shadow maps.
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    shadow.scale.setScalar(base * 2.6);
    turntable.add(shadow);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(GLOW.width, GLOW.height), lightMaterial(lightTexture, GLOW.colour));
    glow.position.set(x, box.min.y + size.y * 0.55, GLOW.depth);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(POOL.radius * 2, POOL.radius * 2), lightMaterial(lightTexture, POOL.colour));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, -PLINTH_HEIGHT + 0.001, 0.15);
    scene.add(glow, pool);

    const key = new THREE.SpotLight(0xffffff, KEY.on, 0, KEY.angle, KEY.penumbra, 2);
    key.position.set(x, 0, 0).add(KEY.offset);
    key.target.position.set(x, box.min.y + size.y * 0.55, 0); // the garment's own middle, even when it floats
    scene.add(key, key.target);

    // Every material on the costume, collected once so light-up / go-dark can tween them together.
    const materials = [];
    model.traverse((node) => {
      if (node.isMesh) materials.push(...[node.material].flat());
    });

    return {
      id: data.id, data, index, turntable, model, key, materials, size, box, radius, garmentRadius,
      stageLights: [glow.material, pool.material],
      bottom: -PLINTH_HEIGHT,  // the framed height runs from the plinth's underside…
      top: box.max.y,          // …to the top of the costume
    };
  });
}

// Light a costume to `level` (0 = dark, 1 = fully lit): its key light and its share of the
// environment fill move together. Returns a GSAP timeline, so the director can place it inside
// a bigger move.
export function lightTo(rig, level, duration = MOTION.light.duration, ease = MOTION.light.ease) {
  return gsap.timeline()
    .to(rig.key, { intensity: KEY.off + (KEY.on - KEY.off) * level, duration, ease }, 0)
    .to(rig.materials, { envMapIntensity: ENV_OFF + (ENV_ON - ENV_OFF) * level, duration, ease }, 0)
    .to(rig.stageLights, { opacity: level, duration, ease }, 0);
}

export const lightUp = (rig, duration) => lightTo(rig, 1, duration);
export const goDark = (rig, duration) => lightTo(rig, 0, duration);

// The costume's radius at floor level: the farthest vertex from the axis in its lowest 10 cm.
function floorRadius(model, box) {
  const limit = box.min.y + FLOOR_BAND;
  const point = new THREE.Vector3();
  let radius = 0;
  model.updateMatrixWorld(true);
  model.traverse((node) => {
    if (!node.isMesh) return;
    const positions = node.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      if (point.y < limit) radius = Math.max(radius, Math.hypot(point.x, point.z));
    }
  });
  return radius;
}

function loadModel(url, onProgress) {
  return loader.loadAsync(url, onProgress).then((gltf) => gltf.scene);
}

// Soft round falloff for the backdrop glow and the floor pool.
function createLightTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.55)');
  gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function lightMaterial(map, colour) {
  return new THREE.MeshBasicMaterial({
    map, color: colour, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function createShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
