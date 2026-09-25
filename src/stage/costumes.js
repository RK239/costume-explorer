import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createStandIn } from './stand-in.js';
import { createAir, createDistance } from './atmosphere.js';
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
  off: 0,            // black; dim by intensity, never with visible = false (changing the light count recompiles every shader)
  angle: THREE.MathUtils.degToRad(15),
  penumbra: 0.7,
};
// Below this light level a costume fades out of the scene; above it only the key light changes.
// Down to it, the environment fill stays full, so a neighbour dimmed in the attract state (0.1)
// still reads as part of the gallery. Below it the fill goes out and the costume dissolves into
// the stage colour, so at 0 it's the colour of the empty stage: switched in or out, it's never
// seen appearing or disappearing. Each costume's materials get the environment as their own
// envMap, because three.js ignores a material's envMapIntensity when the light comes from
// scene.environment (so a "dark" costume used to stay lit by the room).
const FADE_BELOW = 0.1;

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
  // The stage colour as it reaches the screen (sRGB), for costumes to fade into.
  const stageColour = scene.background.clone().convertLinearToSRGB();
  scene.add(createDistance({ floor: -PLINTH_HEIGHT }));

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

    // The shaft of light the costume stands in (atmosphere.js). Its haze behind the costume
    // separates dark silk and steel from the black, the job a rim light would do.
    const airLevel = { value: 1 };
    const air = createAir({ x, floor: -PLINTH_HEIGHT, level: airLevel });
    scene.add(air);

    const key = new THREE.SpotLight(0xffffff, KEY.on, 0, KEY.angle, KEY.penumbra, 2);
    key.position.set(x, 0, 0).add(KEY.offset);
    key.target.position.set(x, box.min.y + size.y * 0.55, 0); // the garment's own middle, even when it floats
    scene.add(key, key.target);

    // Every material on the costume and its plinth, collected once so light-up / go-dark can
    // tween them together.
    const materials = [plinth.material, mark.material];
    model.traverse((node) => {
      if (node.isMesh) materials.push(...[node.material].flat());
    });
    const envOn = scene.environmentIntensity;
    for (const material of materials) {
      material.envMap = scene.environment;
      material.envMapIntensity = envOn;
    }
    const fade = { value: 0 };
    for (const material of [...materials, shadow.material]) fadeIntoStage(material, fade, stageColour);

    return {
      id: data.id, data, index, turntable, model, key, materials, envOn, fade, size, box, radius,
      garmentRadius, air, airLevel,
      home: data.yawOffset ?? 0, // the turntable's first position; every attract loop starts from it
      bottom: -PLINTH_HEIGHT,  // the framed height runs from the plinth's underside…
      top: box.max.y,          // …to the top of the costume
    };
  });
}

// Light a costume to `level` (0 = black, 1 = fully lit): its key light, its share of the
// environment fill and the air around it move together. Returns a GSAP timeline, so the
// director can place it inside a bigger move.
export function lightTo(rig, level, duration = MOTION.light.duration, ease = MOTION.light.ease) {
  const { key, env, fade } = lightLevels(rig, level);
  return gsap.timeline()
    .to(rig.key, { intensity: key, duration, ease }, 0)
    .to(rig.materials, { envMapIntensity: env, duration, ease }, 0)
    .to(rig.fade, { value: fade, duration, ease }, 0)
    .to(rig.airLevel, { value: level, duration, ease }, 0);
}

// The same, at once: for a first frame, a thumbnail, or a costume about to come into view.
export function setLight(rig, level) {
  const { key, env, fade } = lightLevels(rig, level);
  rig.key.intensity = key;
  for (const material of rig.materials) material.envMapIntensity = env;
  rig.fade.value = fade;
  rig.airLevel.value = level;
}

function lightLevels(rig, level) {
  const presence = Math.min(1, level / FADE_BELOW); // 0: gone into the stage, 1: fully there
  return {
    key: KEY.off + (KEY.on - KEY.off) * level,
    env: rig.envOn * presence,
    fade: 1 - presence,
  };
}

// Mix a material's final colour towards the stage colour by `fade` (a shared { value } uniform).
// Added once, at the very end of three.js's own shader, after tone mapping and the sRGB output,
// so at 1 the pixel is exactly the stage background. Changing `fade` is only a uniform: no
// recompile. Every costume's materials share one program; each keeps its own uniform.
function fadeIntoStage(material, fade, stageColour) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stageFade = fade;
    shader.uniforms.stageColour = { value: stageColour };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float stageFade;\nuniform vec3 stageColour;\nvoid main() {')
      .replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, stageColour, stageFade );');
  };
}


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
