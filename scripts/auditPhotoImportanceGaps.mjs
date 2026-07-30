/**
 * Which of the highest-importance beaches are missing a photo — not just "how
 * many total", but WHICH ones matter most. Reuses the already-computed photo
 * presence table from auditBeachPhotoPresence.mjs (does not re-derive the
 * lookup logic — that script is the source of truth for has_photo) and joins
 * it against popularityScore/tier and the TOURISTIC_TIER region list.
 *
 * Requires reports/photo-coverage/beach-photo-presence.json to exist and be
 * fresh — run `npm run photo:presence` first (or use the combined
 * `npm run quality:photo-coverage`, which chains both).
 *
 * Run: node scripts/auditPhotoImportanceGaps.mjs
 * Writes: reports/photo-coverage/importance-gaps.json (+ .csv)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOURISTIC_TIER } from './lib/touristicTier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'public', 'data', 'beaches', 'app');
const presencePath = path.join(rootDir, 'reports', 'photo-coverage', 'beach-photo-presence.json');
const outDir = path.join(rootDir, 'reports', 'photo-coverage');

if (!fs.existsSync(presencePath)) {
  console.error('Missing reports/photo-coverage/beach-photo-presence.json — run `node scripts/auditBeachPhotoPresence.mjs` first.');
  process.exit(1);
}
const presence = JSON.parse(fs.readFileSync(presencePath, 'utf8'));
const touristicSet = new Set(TOURISTIC_TIER);

// id -> { regionFile, popularityScore, tier }
const importanceById = new Map();
for (const file of fs.readdirSync(appDir).filter((f) => f.endsWith('.json'))) {
  const regionId = file.replace(/\.json$/, '');
  const data = JSON.parse(fs.readFileSync(path.join(appDir, file), 'utf8'));
  for (const b of data.island?.beaches || []) {
    importanceById.set(b.id, {
      regionId,
      popularityScore: typeof b.popularityScore === 'number' ? b.popularityScore : 0,
      tier: b.popularity?.tier || 'unknown',
      touristic: touristicSet.has(regionId),
    });
  }
}

const missing = presence
  .filter((r) => !r.hasPhoto)
  .map((r) => ({ ...r, ...(importanceById.get(r.id) || { popularityScore: 0, tier: 'unknown', touristic: false }) }));

const total = presence.length;
const missingTotal = missing.length;
const missingTouristic = missing.filter((r) => r.touristic).length;
const totalTouristic = presence.filter((r) => touristicSet.has(importanceById.get(r.id)?.regionId)).length;

const topMissing = [...missing]
  .sort((a, b) => (b.popularityScore - a.popularityScore) || (b.touristic - a.touristic))
  .slice(0, 40);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'importance-gaps.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    total,
    missingTotal,
    missingPercent: total ? +((missingTotal / total) * 100).toFixed(1) : 0,
    touristicTierRegions: { total: totalTouristic, missing: missingTouristic },
    topMissingByImportance: topMissing,
  }, null, 2),
  'utf8',
);
const csv = [
  'id,nameGr,nameEn,island,regionFile,popularityScore,tier,touristicTier',
  ...topMissing.map((r) => `${r.id},"${r.nameGr}","${r.nameEn}","${r.island}",${r.regionFile},${r.popularityScore},${r.tier},${r.touristic}`),
].join('\r\n');
fs.writeFileSync(path.join(outDir, 'importance-gaps.csv'), csv, 'utf8');

console.log(`Photo coverage vs importance — ${total} beaches`);
console.log(`Missing a photo: ${missingTotal} (${((missingTotal / total) * 100).toFixed(1)}%)`);
console.log(`Missing in the ${TOURISTIC_TIER.length} touristic-tier regions: ${missingTouristic}/${totalTouristic}`);
console.log('\nTop 20 missing beaches by popularityScore:');
for (const r of topMissing.slice(0, 20)) {
  console.log(`  ${String(r.popularityScore).padStart(4)}  [${r.tier}]${r.touristic ? ' *touristic*' : ''}  ${r.nameEn || r.nameGr} (${r.island})`);
}
console.log('\nWrote reports/photo-coverage/importance-gaps.json (+ .csv)');
