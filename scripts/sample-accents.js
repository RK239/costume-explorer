// node scripts/sample-accents.js
// The brief asks for "a distinct accent colour taken from each garment". This takes it from the
// garment literally: it reads each optimised model's colour textures, keeps the coloured pixels
// (ignoring near-black, near-white and grey), groups them into hue families and averages each
// family. It prints the three strongest families, so the characteristic one can be chosen and
// named (a silk, a gilding), and lightens each, keeping its hue, until it reads on the dark
// stage at WCAG 4.5:1, because the accent is used for small text and thin lines.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const MODELS = 'public/models';
const STAGE = [0x0b, 0x0b, 0x0c];
const MIN_CONTRAST = 4.5;
const MIN_SATURATION = 0.14; // low enough to catch gilding on steel, which is only faintly yellow

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

for (const file of readdirSync(MODELS).filter((f) => f.endsWith('.glb'))) {
  const document = await io.read(join(MODELS, file));
  const colourTextures = new Set(
    document.getRoot().listMaterials().map((m) => m.getBaseColorTexture()).filter(Boolean),
  );

  const bins = Array.from({ length: 36 }, () => ({ weight: 0, r: 0, g: 0, b: 0, n: 0 }));
  let coloured = 0;
  let total = 0;
  for (const texture of colourTextures) {
    const { data, info } = await sharp(Buffer.from(texture.getImage()))
      .resize(256, 256, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const [h, s, l] = rgbToHsl(r, g, b);
      total++;
      if (s < MIN_SATURATION || l < 0.12 || l > 0.9) continue; // not coloured enough to count
      coloured++;
      const bin = bins[Math.floor(h * 36) % 36];
      bin.weight += s;
      bin.r += r; bin.g += g; bin.b += b; bin.n++;
    }
  }

  // Hue families: 30° wide (three 10° bins), strongest first, never two overlapping.
  const families = [];
  const used = new Set();
  const order = bins.map((bin, i) => i).sort((a, b) => bins[b].weight - bins[a].weight);
  for (const i of order) {
    if (families.length === 3 || !bins[i].n || used.has(i)) continue;
    const members = [i - 1, i, i + 1].map((k) => (k + 36) % 36).filter((k) => !used.has(k));
    members.forEach((k) => used.add(k));
    const sum = members.reduce((acc, k) => ({
      r: acc.r + bins[k].r, g: acc.g + bins[k].g, b: acc.b + bins[k].b, n: acc.n + bins[k].n,
    }), { r: 0, g: 0, b: 0, n: 0 });
    families.push({ hue: i * 10 + 5, n: sum.n, rgb: [sum.r, sum.g, sum.b].map((v) => Math.round(v / sum.n)) });
  }

  console.log(`${file}  (${((coloured / total) * 100).toFixed(1)}% of the texture is coloured)`);
  for (const family of families) {
    const accent = liftToContrast(family.rgb);
    console.log(`  hue ~${String(family.hue).padStart(3)}°  ${((family.n / total) * 100).toFixed(1).padStart(5)}% of texture`
      + `  sampled ${hex(family.rgb)}  →  accent ${hex(accent)}  (${contrast(accent, STAGE).toFixed(1)}:1)`);
  }
}

// Raise lightness in small steps, same hue and saturation, until the contrast target is met.
function liftToContrast(rgb) {
  let [h, s, l] = rgbToHsl(...rgb);
  let out = rgb;
  while (contrast(out, STAGE) < MIN_CONTRAST && l < 0.95) {
    l += 0.01;
    out = hslToRgb(h, s, l);
  }
  return out;
}

function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

function luminance([r, g, b]) {
  const c = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
}

function hex(rgb) {
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
