import * as THREE from 'three';

// Air on the stage. Each costume stands in a shaft of light falling through haze, with dust
// drifting in it, and far off in the dark more shafts of light recede towards the horizon.
// Nothing here is a surface the eye can land on, so the stage reads as deep, open space rather
// than a wall behind the costumes; and because the far lights sit 6–28 m back, they drift
// slower than the costumes when the camera moves (parallax), which is what sells the depth.
// None of it is a real light: it's unlit and added on top of what's behind, so it's cheap.

const time = { value: 0 };
const pixelRatio = { value: 1 };

// Called from the frame loop with GSAP's clock, so the haze and dust move in step with everything
// else. The renderer's pixel ratio (capped, so not the screen's) sizes the dust in real pixels.
export function updateAtmosphere(seconds, ratio) {
  time.value = seconds;
  pixelRatio.value = ratio;
}

// Shaft: a cone from above the frame down to the floor. Metres. Narrow and faint: it should read
// as light falling from above, not as a lit wall behind the costume.
const SHAFT = { height: 4.6, radiusTop: 0.3, radiusBottom: 0.75, colour: 0x15130f };
const POOL = { radius: 1.3, colour: 0x221e1a };
const MOTES = { count: 90, colour: 0xfff0d8, size: 2.2 }; // size in CSS px at 4 m

// Distant shafts of light: [x, z, brightness]. Staggered so none stands directly behind a
// costume, and fainter with distance (atmospheric perspective).
const DISTANT = [
  [-4.6, -7, 0.28], [3.9, -9, 0.24], [-0.9, -14, 0.18], [7.2, -16, 0.15],
  [-8.4, -19, 0.12], [2.6, -24, 0.1], [-4.2, -30, 0.07],
];

// Interleaved gradient noise: breaks up 8-bit banding in the dark gradients.
const DITHER = /* glsl */ `
  float dither(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))) - 0.5; }
`;

const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

// The air around one costume: shaft, floor pool and dust. `level` is a { value } uniform the
// costume's light tweens, so its air brightens and dims with it. `floor` is the floor's height.
export function createAir({ x, floor, level }) {
  const air = new THREE.Group();
  air.position.set(x, floor, 0);
  air.add(createShaft(level), createPool(level), createMotes(level));
  return air;
}

// Faint shafts far back in the dark. They never change. No pools under them: from 10–30 m away
// a pool on the floor is seen almost edge-on and flattens into a horizontal streak, which reads
// as a shelf or the foot of a wall, the very thing this is meant to remove.
export function createDistance({ floor }) {
  const group = new THREE.Group();
  group.name = 'distance';
  for (const [x, z, brightness] of DISTANT) {
    const level = { value: brightness };
    const light = new THREE.Group();
    light.position.set(x, floor, z);
    light.add(createShaft(level));
    group.add(light);
  }
  return group;
}

function createShaft(level) {
  const geometry = new THREE.CylinderGeometry(SHAFT.radiusTop, SHAFT.radiusBottom, SHAFT.height, 64, 1, true);
  geometry.translate(0, SHAFT.height / 2, 0);
  const material = new THREE.ShaderMaterial({
    ...additive,
    // Only the far half of the cone is drawn, so the haze sits behind the costume and never veils it.
    side: THREE.BackSide,
    uniforms: { colour: { value: new THREE.Color(SHAFT.colour) }, level, time, height: { value: SHAFT.height } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vHeight = position.y;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 colour;
      uniform float level;
      uniform float time;
      uniform float height;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      ${NOISE}
      ${DITHER}
      void main() {
        // How squarely we look at the cone's far wall stands in for how much air the line of
        // sight crosses: most through the middle of the shaft, none at its edges.
        float through = pow(abs(dot(vNormal, normalize(cameraPosition - vWorld))), 2.4);
        // Haze above the costume, fading out before it reaches the body, so the space right
        // behind the garment stays dark (the costume stands in front of depth, not a lit wall);
        // it dissolves upwards too, so the source is never seen. The pool marks the floor.
        float h = vHeight / height;
        float vertical = smoothstep(0.2, 0.48, h) * (1.0 - smoothstep(0.55, 0.95, h));
        // Slow haze rising through the beam.
        float drift = noise(vec3(vWorld.x * 1.6, vWorld.y * 0.9 - time * 0.06, vWorld.z * 1.6));
        float haze = through * vertical * mix(0.7, 1.15, drift) * level;
        gl_FragColor = vec4(colour * haze, 1.0);
        #include <colorspace_fragment>
        gl_FragColor.rgb += dither(gl_FragCoord.xy) / 255.0 * step(0.002, haze);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

// Where the shaft meets the floor.
function createPool(level) {
  const geometry = new THREE.PlaneGeometry(POOL.radius * 2, POOL.radius * 2);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    ...additive,
    uniforms: { colour: { value: new THREE.Color(POOL.colour) }, level },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 colour;
      uniform float level;
      varying vec2 vUv;
      ${DITHER}
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float light = exp(-r * r * 3.0) * (1.0 - smoothstep(0.75, 1.0, r)) * level;
        gl_FragColor = vec4(colour * light, 1.0);
        #include <colorspace_fragment>
        gl_FragColor.rgb += dither(gl_FragCoord.xy) / 255.0 * step(0.002, light);
      }
    `,
  });
  const pool = new THREE.Mesh(geometry, material);
  pool.position.y = 0.001;
  return pool;
}

// Dust drifting down through the shaft, catching the light now and then.
function createMotes(level) {
  const seeds = new Float32Array(MOTES.count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const geometry = new THREE.BufferGeometry();
  // The motes are placed in the shader; position only has to exist. The bounding sphere
  // covers the shaft, so the dust is never culled while the shaft is on screen.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES.count * 3), 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.4, 0), 2);

  const material = new THREE.ShaderMaterial({
    ...additive,
    uniforms: {
      colour: { value: new THREE.Color(MOTES.colour) },
      level,
      time,
      size: { value: MOTES.size },
      pixelRatio,
      shape: { value: new THREE.Vector3(SHAFT.radiusBottom, SHAFT.radiusTop, SHAFT.height) },
    },
    vertexShader: /* glsl */ `
      uniform float time;
      uniform float level;
      uniform float size;
      uniform float pixelRatio;
      uniform vec3 shape;   // radius at the floor, radius at the top, height
      attribute vec4 seed;  // angle, radius, height, phase: each 0–1
      varying float vAlpha;
      void main() {
        float phase = seed.w;
        // Falls slowly, each mote at its own pace, through the lower 2.8 m of the shaft.
        float h = fract(seed.z - time * (0.004 + 0.008 * phase));
        float y = h * 2.8;
        float reach = mix(shape.x, shape.y, y / shape.z) * 0.85;
        float r = reach * sqrt(seed.y) * (1.0 + 0.12 * sin(time * 0.13 + phase * 40.0));
        float a = seed.x * 6.2832 + sin(time * 0.05 + phase * 6.2832) * 0.5;
        vec4 view = modelViewMatrix * vec4(cos(a) * r, y, sin(a) * r, 1.0);
        gl_Position = projectionMatrix * view;
        // Nearer motes draw larger but fainter, like dust out of focus close to a lens, so a
        // push-in never fills the frame with bright specks.
        float near = 4.0 / -view.z;
        gl_PointSize = size * pixelRatio * (0.6 + 0.8 * fract(phase * 13.7)) * clamp(near, 0.5, 2.5);
        // Fades in and out at the ends of its fall; glints as it turns in the light.
        float glint = pow(0.5 + 0.5 * sin(time * (0.4 + phase) + phase * 50.0), 3.0);
        vAlpha = level * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.8, 1.0, h))
               * (0.25 + 0.75 * glint) * (1.0 - 0.5 * seed.y) * min(1.0, 1.0 / (near * near));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 colour;
      varying float vAlpha;
      void main() {
        // (1 − smoothstep): GLSL leaves smoothstep undefined when its edges are reversed.
        float soft = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(colour * soft * vAlpha * 0.55, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Points(geometry, material);
}
