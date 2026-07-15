// Read-only diagnostic. Recomputes the region-page and sheltered-guide counts
// using the EXACT same logic as scripts/prerenderBeachPages.mjs:
//   - totalBeaches:    beaches.filter(b => Number.isInteger(b.id) && b.name).length   (line ~2964)
//   - shelteredCount:  beaches.filter(b => valid id/name && b.shelteredFromLocalWind === true).length  (line ~2287-2288)
// against public/data/beaches/app/summary/{region}.json for every region in the index.
// Does NOT touch any existing file. Writes nothing except stdout CSV.

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { localWindLabelFor } from '../utils/localWindContext.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

const readJson = async p => JSON.parse(await readFile(p, 'utf8'));

const beachIndex = await readJson(path.join(publicDir, 'data', 'beaches', 'index.json'));

const countValid = beaches => beaches.filter(b => Number.isInteger(b.id) && b.name).length;
const countSheltered = beaches =>
  beaches.filter(b => Number.isInteger(b.id) && b.name && b.shelteredFromLocalWind === true).length;

const rows = [];

for (const region of beachIndex.regions || []) {
  const summaryPath = path.join(publicDir, 'data', 'beaches', 'app', 'summary', `${region.id}.json`);
  let payload;
  try {
    payload = await readJson(summaryPath);
  } catch {
    // fall back to the non-summary app payload, same as prerenderBeachPages.mjs does
    try {
      payload = await readJson(path.join(publicDir, region.appDataPath.replace(/^\/+/, '')));
    } catch (err) {
      console.error(`# SKIP ${region.id}: could not read summary or app data (${err.message})`);
      continue;
    }
  }

  const island = payload.island;
  if (!island?.id || !Array.isArray(island.beaches)) {
    console.error(`# SKIP ${region.id}: no island.beaches array`);
    continue;
  }

  const total = countValid(island.beaches);
  const sheltered = countSheltered(island.beaches);
  const pct = total > 0 ? ((sheltered / total) * 100).toFixed(1) : '0.0';
  const dominantWind = localWindLabelFor(region.id).en;

  rows.push({ region: region.id, total, sheltered, pct, dominantWind });
}

// --- CSV output ---
console.log('region,totalBeaches,shelteredCount,shelteredPct,dominantWind');
for (const r of rows) {
  console.log(`${r.region},${r.total},${r.sheltered},${r.pct},${r.dominantWind}`);
}

// --- Summary ---
const freq = arr => {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const totalFreq = freq(rows.map(r => r.total));
const shelteredFreq = freq(rows.map(r => r.sheltered));

const totalsEq39 = rows.filter(r => r.total === 39).length;
const shelteredEq14 = rows.filter(r => r.sheltered === 14).length;

console.log('');
console.log(`# --- SUMMARY (${rows.length} regions) ---`);
console.log(`# regions with totalBeaches == 39: ${totalsEq39}`);
console.log(`# regions with shelteredCount == 14: ${shelteredEq14}`);
console.log(`# top 5 totalBeaches values: ${totalFreq.slice(0, 5).map(([v, c]) => `${v}(x${c})`).join(', ')}`);
console.log(`# top 5 shelteredCount values: ${shelteredFreq.slice(0, 5).map(([v, c]) => `${v}(x${c})`).join(', ')}`);
