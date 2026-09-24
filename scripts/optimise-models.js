// npm run models: optimise every GLB in models-src/ into public/models/ and report its budget.
// Settings live in scripts/models.config.json: texture sizes per slot, and per-model extras such as
// simplifying a dense cloth scan. Uses the gltf-transform library (dev only, never shipped).
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join as joinPath, parse } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, weld, simplify, prune, textureCompress, meshopt } from '@gltf-transform/functions';
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
  const settings = { ...config.defaults, ...(config[file] ?? {}) };

  const document = await io.read(input);
  await document.transform(
    dedup(),
    // Merge primitives that share a material: fewer draw calls, and no artificial borders left
    // over from exporters that split meshes at 65k vertices (those borders would block simplify).
    flatten(),
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

// three.js derives tangents from screen-space derivatives when a mesh has none, so the stored
// ones are dead weight: 4 values per vertex in the file and in GPU memory.
function dropTangents() {
  return (document) => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) primitive.setAttribute('TANGENT', null);
    }
  };
}

// One WebP pass per texture size, each limited to the slots that get that size.
function resizeBySlot(sizes) {
  const bySize = new Map();
  for (const [slot, size] of Object.entries(sizes)) {
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(slot);
  }
  return [...bySize].map(([size, slots]) => textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    resize: [size, size],
    slots: new RegExp(`^(${slots.join('|')})$`),
  }));
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
