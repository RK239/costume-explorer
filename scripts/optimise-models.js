// npm run models: optimise every GLB in models-src/ into public/models/ and report its budget.
// Settings live in scripts/models.config.json: texture sizes per slot, and per-model extras such as
// simplifying a dense cloth scan. Uses the gltf-transform library (dev only, never shipped).
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join as joinPath, parse } from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, flatten, join, weld, simplify, prune, textureCompress, meshopt, transformMesh,
} from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = 'models-src';
const OUT = 'public/models';
const config = JSON.parse(readFileSync('scripts/models.config.json', 'utf8'));

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

mkdirSync(OUT, { recursive: true });

// "Vintage Asian Dress Belt.glb" → "vintage-asian-dress-belt.glb"
const slug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.glb') && !f.startsWith('._'));
if (files.length === 0) {
  console.log(`No .glb files in ${SRC}/`);
  process.exit(0);
}

for (const file of files) {
  const input = joinPath(SRC, file);
  const output = joinPath(OUT, `${slug(parse(file).name)}.glb`);
  const own = config[file] ?? {};
  const settings = {
    ...config.defaults,
    ...own,
    textureSize: { ...config.defaults.textureSize, ...own.textureSize },
  };

  const document = await io.read(input);
  await document.transform(
    dedup(),
    flatten(),
    bakeTransforms(),
    ...(settings.place ? [placeOnStage(settings.place)] : []),
    ...(settings.clampUVs ? [clampUVs()] : []),
    ...(settings.materials ? [fixMaterials(settings.materials)] : []),
    // Merge primitives that share a material: fewer draw calls, and no artificial borders left
    // over from exporters that split meshes at 65k vertices (those borders would block simplify).
    join(),
    weld(),
    ...(settings.simplifyRatio
      ? [simplify({
        simplifier: MeshoptSimplifier,
        ratio: settings.simplifyRatio,
        error: settings.simplifyError ?? 0.01,
        lockBorder: true, // hems and the edges of pattern pieces keep their shape
      })]
      : []),
    dropTangents(),
    prune(),
    ...resizeBySlot(settings.textureSize),
    meshopt({ encoder: MeshoptEncoder }),
  );
  await io.write(output, document);

  report(file, input, output, document, settings.budget);
}

// Bake each node's transform into its mesh, so the vertices are in the model's own space.
// Exporters (Sketchfab especially) wrap models in rotated and scaled root nodes.
function bakeTransforms() {
  return (document) => {
    for (const node of document.getRoot().listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      if (mesh.listParents().filter((p) => p.propertyType === 'Node').length > 1) {
        throw new Error(`Mesh "${mesh.getName()}" is shared by several nodes; can't bake it in place.`);
      }
      transformMesh(mesh, node.getWorldMatrix());
      node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    }
  };
}

// Stand a model on the turntable the way the stage expects (ARCHITECTURE.md: feet at y = 0,
// front facing +Z, centred on the axis). For scans and odd exports, set in models.config.json:
//   rotateY  degrees to turn it so the front faces +Z
//   height   its real height in metres, top to bottom (omit to keep the file's scale)
//   lift     metres between the plinth and its lowest point (a garment that ends at the knee
//            floats at knee height, as on an invisible mannequin)
function placeOnStage({ rotateY = 0, height, lift = 0 }) {
  return (document) => {
    const scene = document.getRoot().listScenes()[0];
    const { min, max } = getBounds(scene);
    const s = height ? height / (max[1] - min[1]) : 1;
    const angle = (rotateY * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = (min[0] + max[0]) / 2;
    const cz = (min[2] + max[2]) / 2;

    // p' = s · Ry · (p − c) + (0, lift, 0), with c the bottom-centre of the bounds. Column-major.
    const matrix = [
      s * cos, 0, -s * sin, 0,
      0, s, 0, 0,
      s * sin, 0, s * cos, 0,
      -s * (cos * cx + sin * cz), lift - s * min[1], -s * (-sin * cx + cos * cz), 1,
    ];
    for (const mesh of document.getRoot().listMeshes()) transformMesh(mesh, matrix);
  };
}

// Correct material values that an exporter got wrong, by material name, e.g.
//   "materials": { "material": { "roughnessFactor": 1 } }
// glTF multiplies each factor with its texture, so a factor of 0 wipes the texture out.
function fixMaterials(fixes) {
  const setters = { roughnessFactor: 'setRoughnessFactor', metallicFactor: 'setMetallicFactor' };
  return (document) => {
    for (const material of document.getRoot().listMaterials()) {
      const fix = fixes[material.getName()];
      if (!fix) continue;
      for (const [key, value] of Object.entries(fix)) {
        if (!setters[key]) throw new Error(`fixMaterials: unsupported property "${key}"`);
        material[setters[key]](value);
      }
    }
  };
}

// Scans use one texture atlas, and a few edge UVs often stray a hair outside 0–1. That stops
// meshopt quantising the UVs (they stay 32-bit floats). Clamping them is safe for an atlas.
// Never use it on a model whose UVs tile on purpose.
function clampUVs() {
  return (document) => {
    const element = [];
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const uv = primitive.getAttribute('TEXCOORD_0');
        if (!uv) continue;
        for (let i = 0; i < uv.getCount(); i++) {
          uv.getElement(i, element);
          uv.setElement(i, element.map((v) => Math.min(1, Math.max(0, v))));
        }
      }
    }
  };
}

// three.js derives tangents from screen-space derivatives when a mesh has none, so the stored
// ones are dead weight: 4 values per vertex in the file and in GPU memory.
function dropTangents() {
  return (document) => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) primitive.setAttribute('TANGENT', null);
    }
  };
}

// One WebP pass per texture size, each limited to the slots that get that size. Any slot not
// listed (e.g. specularTexture from KHR_materials_specular) gets the "other" size, so nothing
// ships uncompressed.
function resizeBySlot({ other = 1024, ...sizes }) {
  const bySize = new Map();
  for (const [slot, size] of Object.entries(sizes)) {
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(slot);
  }
  const listed = Object.keys(sizes).join('|');
  const pass = (size, slots) => textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], slots });
  return [
    ...[...bySize].map(([size, slots]) => pass(size, new RegExp(`^(${slots.join('|')})$`))),
    pass(other, new RegExp(`^(?!(${listed})$)`)),
  ];
}

function report(file, input, output, document, budget) {
  const root = document.getRoot();
  let triangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      triangles += (indices ? indices.getCount() : primitive.getAttribute('POSITION').getCount()) / 3;
    }
  }
  // Decoded RGBA plus a third for mipmaps: what the textures cost the GPU, whatever the file size.
  let gpuBytes = 0;
  for (const texture of root.listTextures()) {
    const [width, height] = texture.getSize() ?? [0, 0];
    gpuBytes += width * height * 4 * (4 / 3);
  }

  const before = statSync(input).size / 1e6;
  const after = statSync(output).size / 1e6;
  const gpu = gpuBytes / 1e6;
  const flags = [
    after > budget.fileMB ? `file over ${budget.fileMB} MB` : '',
    gpu > budget.gpuMB ? `GPU over ${budget.gpuMB} MB` : '',
  ].filter(Boolean);

  console.log(
    `${file}: ${before.toFixed(1)} MB → ${output} ${after.toFixed(2)} MB | `
    + `${Math.round(triangles / 1000)}k triangles | ${root.listTextures().length} textures, ~${Math.round(gpu)} MB GPU`
    + (flags.length ? `  ← ${flags.join(', ')}` : ''),
  );
}
