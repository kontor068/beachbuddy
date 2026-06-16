// Generates wide-short "context strip" crops for each destination from its hero/card
// source, baking a focal-point crop so the band shows the subject. Native-ish width keeps
// sharpness; the much shorter height roughly halves the bytes vs the full hero/card.
//
// Run: node scripts/optimizeStripImages.mjs   (or: npm run images:strips)
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DEST_ROOT = path.join('public', 'images', 'destinations');
const OUT_JSON = path.join('data', 'destinationStripPhotos.generated.json');
const BAND_ASPECT = 3.6;        // width / height of the generated strip crop
const MAX_WIDTH = 1600;         // cap (heroes); cards stay at their native ~800
const WEBP_QUALITY = 72;

// Vertical focal point (fraction of height) where the default centre crop hides the
// subject. Keep in sync with objectPosition notes in data/photoRegistry.ts.
const FOCAL = { naxos: 0.32, mykonos: 0.30 };

const pickSource = (files) => (
  files.find(f => /-hero\.webp$/.test(f)) || files.find(f => /-card\.webp$/.test(f))
);

const main = async () => {
  const entries = await readdir(DEST_ROOT, { withFileTypes: true });
  const map = {};
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const destId = entry.name;
    const dir = path.join(DEST_ROOT, destId);
    const files = (await readdir(dir)).filter(f => f.endsWith('.webp') && !f.endsWith('-strip.webp'));
    const sourceName = pickSource(files);
    if (!sourceName) continue;

    const sourcePath = path.join(dir, sourceName);
    const meta = await sharp(sourcePath).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (!srcW || !srcH) continue;

    const bandHeight = Math.round(srcW / BAND_ASPECT);
    const focal = FOCAL[destId] ?? 0.5;
    const top = Math.max(0, Math.min(srcH - bandHeight, Math.round(focal * srcH - bandHeight / 2)));
    const outName = `${destId}-strip.webp`;
    const outPath = path.join(dir, outName);

    let pipeline = sharp(sourcePath).extract({ left: 0, top, width: srcW, height: bandHeight });
    let outW = srcW;
    let outH = bandHeight;
    if (srcW > MAX_WIDTH) {
      outW = MAX_WIDTH;
      outH = Math.round(bandHeight * (MAX_WIDTH / srcW));
      pipeline = pipeline.resize(outW);
    }
    await pipeline.webp({ quality: WEBP_QUALITY }).toFile(outPath);

    map[destId] = { src: `/images/destinations/${destId}/${outName}`, width: outW, height: outH };
    console.log(`${destId}: ${sourceName} ${srcW}x${srcH} -> ${outName} ${outW}x${outH}`);
  }

  await mkdir(path.dirname(OUT_JSON), { recursive: true });
  await writeFile(OUT_JSON, JSON.stringify(map, null, 2) + '\n');
  console.log(`\nWrote ${Object.keys(map).length} strip entries -> ${OUT_JSON}`);
};

main().catch(e => { console.error(e); process.exit(1); });
