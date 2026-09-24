import * as THREE from 'three';

// Dress-form stand-ins, used while a costume's `model` is empty in content.json.
// Three different silhouettes so the lineup reads as three costumes, plus a small marker on
// the front so the turning is visible. Profiles are [radius, height] in metres.
const PROFILES = [
  // straight robe
  [[0.001, 1.5], [0.07, 1.5], [0.08, 1.44], [0.2, 1.36], [0.17, 1.15], [0.14, 1.0], [0.19, 0.75], [0.24, 0.3], [0.26, 0]],
  // full gown
  [[0.001, 1.5], [0.07, 1.5], [0.08, 1.44], [0.19, 1.36], [0.15, 1.15], [0.12, 1.02], [0.3, 0.8], [0.5, 0.35], [0.56, 0]],
  // structured coat
  [[0.001, 1.55], [0.08, 1.55], [0.09, 1.48], [0.26, 1.4], [0.24, 1.1], [0.22, 0.9], [0.25, 0.5], [0.27, 0]],
];

const COLOURS = [0x55504a, 0x46505a, 0x5a5040];

const MARKER_HEIGHT = 1.22;

export function createStandIn(index) {
  const points = PROFILES[index % PROFILES.length];
  // LatheGeometry wants the profile bottom-up for its faces to point outward.
  const profile = points.map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const material = new THREE.MeshStandardMaterial({ color: COLOURS[index % COLOURS.length], roughness: 0.75 });

  const form = new THREE.Group();
  form.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48), material));

  const front = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.3, metalness: 0.6 }),
  );
  front.position.set(0, MARKER_HEIGHT, radiusAt(points, MARKER_HEIGHT) + 0.01);
  form.add(front);

  return Promise.resolve(form);
}

// The profile's radius at a given height, interpolated between its points.
function radiusAt(points, height) {
  for (let i = 0; i < points.length - 1; i++) {
    const [r1, y1] = points[i];
    const [r2, y2] = points[i + 1];
    if (height <= y1 && height >= y2) return r1 + ((y1 - height) / (y1 - y2)) * (r2 - r1);
  }
  return 0.2;
}
