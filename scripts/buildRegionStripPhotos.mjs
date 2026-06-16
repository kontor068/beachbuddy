// Builds homepage "context strip" photos for regions that have no curated destination
// card/hero but DO have a licensed background image (ISLAND_BACKGROUND_IMAGES, credited in
// public/IMAGE_CREDITS.txt). Generates a wide-short crop of each background and emits a
// CuratedPhoto-shaped map keyed by islandId, with attribution carried from IMAGE_CREDITS.
//
// Run: node scripts/buildRegionStripPhotos.mjs   (or: npm run images:region-strips)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join('public', 'images', 'regions');
const OUT_JSON = path.join('data', 'regionStripPhotos.generated.json');
const BAND_ASPECT = 3.6;
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 72;
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

// 1) ISLAND_BACKGROUND_IMAGES (normalized name.en -> "/file-bg.webp")
const app = fs.readFileSync('App.tsx', 'utf8');
const bgStart = app.indexOf('ISLAND_BACKGROUND_IMAGES');
const bgBlock = app.slice(bgStart, bgStart + 8000);
const bgByKey = {};
for (const m of bgBlock.matchAll(/(\w+):\s*'(\/[^']+\.webp)'/g)) bgByKey[m[1]] = m[2];

// 2) islandIds that already have a destination card/hero (skip these)
const adapter = fs.readFileSync('data/destinationPhotoAdapter.ts', 'utf8');
const destIds = new Set();
for (const m of adapter.matchAll(/'([a-z0-9-]+)':\s*'[a-z]+'/g)) destIds.add(m[1]);

// 3) IMAGE_CREDITS.txt -> attribution by background file base name (e.g. "cyclades-kimolos-bg")
const credits = fs.readFileSync(path.join('public', 'IMAGE_CREDITS.txt'), 'utf8').split(/\r?\n/);
const attrByBase = {};
let cur = null;
for (const line of credits) {
  const file = line.match(/^File:\s*(.+?)\s*$/);
  if (file) { cur = { base: file[1].replace(/\.(jpg|jpeg|png|webp)$/i, '') }; attrByBase[cur.base] = cur; continue; }
  if (!cur) continue;
  const img = line.match(/^Image:\s*(.+?)\s*$/);
  const author = line.match(/^Author:\s*(.+?)\s*$/);
  const license = line.match(/^License:\s*(.+?)\s*$/);
  const url = line.match(/^Source URL:\s*(.+?)\s*$/);
  if (img) cur.image = img[1];
  if (author) cur.author = author[1];
  if (license) cur.license = license[1];
  if (url) cur.sourceUrl = url[1];
}

// Require attribution unless the licence explicitly waives it (public domain / CC0 / Pexels).
const attributionRequired = (license) => !/(public\s*domain|cc0|pexels)/i.test(license || '');

// 4) Regions from app summaries
const dir = 'public/data/beaches/app';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
fs.mkdirSync(OUT_DIR, { recursive: true });

const map = {};
let made = 0, skippedNoBg = 0, skippedNoFile = 0;
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  const isl = j.island;
  if (!isl?.id || !isl.name?.en) continue;
  if (destIds.has(isl.id)) continue; // destination strip wins

  const bgPath = bgByKey[norm(isl.name.en)];
  if (!bgPath) { skippedNoBg++; continue; }
  const srcFile = path.join('public', bgPath.replace(/^\//, ''));
  if (!fs.existsSync(srcFile)) { skippedNoFile++; continue; }

  const base = path.basename(bgPath).replace(/\.webp$/, '');
  const attr = attrByBase[base] || {};

  const meta = await sharp(srcFile).metadata();
  const srcW = meta.width ?? 0, srcH = meta.height ?? 0;
  if (!srcW || !srcH) continue;
  const bandH = Math.round(srcW / BAND_ASPECT);
  const top = Math.max(0, Math.min(srcH - bandH, Math.round(0.5 * srcH - bandH / 2)));
  const outName = `${isl.id}-strip.webp`;
  let pipeline = sharp(srcFile).extract({ left: 0, top, width: srcW, height: bandH });
  let outW = srcW, outH = bandH;
  if (srcW > MAX_WIDTH) { outW = MAX_WIDTH; outH = Math.round(bandH * (MAX_WIDTH / srcW)); pipeline = pipeline.resize(outW); }
  await pipeline.webp({ quality: WEBP_QUALITY }).toFile(path.join(OUT_DIR, outName));

  map[isl.id] = {
    src: `/images/regions/${outName}`,
    alt: attr.image || `${isl.name.en}, Greece`,
    width: outW,
    height: outH,
    source: 'wikimedia',
    author: attr.author,
    license: attr.license,
    sourceUrl: attr.sourceUrl,
    attributionRequired: attributionRequired(attr.license),
    verifiedLocation: false,
    usageLabel: isl.name.gr || isl.name.en,
    loading: 'eager',
    fetchPriority: 'high',
  };
  made++;
  console.log(`${isl.id}: ${base} -> ${outName} ${outW}x${outH} | ${attr.author || '?'} / ${attr.license || '?'}`);
}

fs.writeFileSync(OUT_JSON, JSON.stringify(map, null, 2) + '\n');
console.log(`\nGenerated ${made} region strip photos (skipped: noBg=${skippedNoBg}, noFile=${skippedNoFile}) -> ${OUT_JSON}`);
