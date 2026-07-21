// Generate AVIF siblings for every curated photo referenced in data/photoRegistry.ts,
// so components/photos/CuratedPhotoImage.tsx can serve them via <picture> (AVIF first,
// WebP fallback). ~25% under WebP for the same visual quality.
//
//   node scripts/generateCuratedPhotoAvif.mjs [--force]
//
// RELIABILITY: <picture><source type="image/avif"> commits to AVIF by browser type
// support, not file existence — a missing .avif would 404 with no fallback. So this
// script is the guarantor: it reads the exact src set the app renders and FAILS THE
// BUILD if any source file is missing or any AVIF can't be produced. Wired into `build`.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const registryPath = path.join(rootDir, 'data', 'photoRegistry.ts');
const force = process.argv.includes('--force');
const quality = Number(process.env.PHOTO_AVIF_QUALITY || 55);

const exists = async (p) => { try { await fs.access(p); return true; } catch { return false; } };

const registry = await fs.readFile(registryPath, 'utf8');
const srcs = [...new Set([...registry.matchAll(/src:\s*'([^']+\.webp)'/g)].map((m) => m[1]))];

let created = 0;
let kept = 0;
const missing = [];
let avifTotal = 0;
let webpTotal = 0;

for (const src of srcs) {
  const webpPath = path.join(publicDir, src.replace(/^\//, ''));
  const avifPath = webpPath.replace(/\.webp$/i, '.avif');

  if (!(await exists(webpPath))) { missing.push(src); continue; }
  webpTotal += (await fs.stat(webpPath)).size;

  if ((await exists(avifPath)) && !force) {
    kept += 1;
    avifTotal += (await fs.stat(avifPath)).size;
    continue;
  }

  const tmp = `${avifPath}.tmp`;
  await sharp(webpPath).rotate().avif({ quality, effort: 4 }).toFile(tmp);
  await fs.rename(tmp, avifPath);
  created += 1;
  avifTotal += (await fs.stat(avifPath)).size;
}

const kb = (b) => `${(b / 1024).toFixed(1)}KB`;
console.log(`Curated photo AVIF: ${srcs.length - missing.length}/${srcs.length} covered (${created} new, ${kept} kept)`);
console.log(`WebP ${kb(webpTotal)} -> AVIF ${kb(avifTotal)} (${webpTotal ? Math.round((1 - avifTotal / webpTotal) * 100) : 0}% smaller)`);

if (missing.length > 0) {
  console.error('Missing WebP source for curated photos (cannot make AVIF; <picture> would 404):');
  missing.forEach((s) => console.error(`- public${s}`));
  process.exitCode = 1;
}
