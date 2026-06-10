/**
 * Aggregates the exposure regression between two generated exposure
 * directories (e.g. the pre-rebuild backup vs the fresh build): which beaches
 * changed sector exposure category, by how much, sorted by magnitude.
 *
 * Usage:
 *   node scripts/summarizeExposureRegression.mjs --old <dir> --new <dir> [--json <out.json>] [--top N]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const LEVEL_RANK = { protected: 0, partial: 1, exposed: 2 };

const parseArgValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const oldDir = parseArgValue('--old');
const newDir = parseArgValue('--new');
const jsonOutPath = parseArgValue('--json');
const top = Number(parseArgValue('--top') || 30);
if (!oldDir || !newDir) {
  console.error('Usage: node scripts/summarizeExposureRegression.mjs --old <dir> --new <dir> [--json <out>] [--top N]');
  process.exit(1);
}

const regionFiles = readdirSync(oldDir).filter(name => name.endsWith('.json') && name !== 'index.json');

const rows = [];
let totalBeaches = 0;
let totalSectorChanges = 0;
let towardProtected = 0;
let towardExposed = 0;
let facingLost = 0;
let facingGained = 0;
const shiftHistogram = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };

for (const fileName of regionFiles) {
  const oldPayload = JSON.parse(readFileSync(path.join(oldDir, fileName), 'utf8'));
  const newPath = path.join(newDir, fileName);
  let newPayload;
  try {
    newPayload = JSON.parse(readFileSync(newPath, 'utf8'));
  } catch {
    console.error(`MISSING region in new build: ${fileName}`);
    continue;
  }

  for (const [beachId, oldProfile] of Object.entries(oldPayload.profiles)) {
    totalBeaches += 1;
    const newProfile = newPayload.profiles[beachId];
    if (!newProfile) {
      rows.push({ region: fileName.replace('.json', ''), beachId: Number(beachId), name: oldProfile.name.en, droppedInNew: true, levelRankShift: 99 });
      continue;
    }

    let levelRankShift = 0;
    let changedSectors = [];
    let maxIntensityDelta = 0;
    for (const sector of SECTORS) {
      const o = oldProfile.sectors[sector];
      const n = newProfile.sectors[sector];
      if (typeof o?.intensity === 'number' && typeof n?.intensity === 'number') {
        maxIntensityDelta = Math.max(maxIntensityDelta, Math.abs(n.intensity - o.intensity));
      }
      if (o.level !== n.level) {
        const shift = LEVEL_RANK[n.level] - LEVEL_RANK[o.level];
        levelRankShift += Math.abs(shift);
        totalSectorChanges += 1;
        if (shift < 0) towardProtected += 1;
        else towardExposed += 1;
        changedSectors.push(`${sector}:${o.level[0]}>${n.level[0]}`);
      }
    }

    if (typeof oldProfile.facingDeg === 'number' && typeof newProfile.facingDeg !== 'number') facingLost += 1;
    if (typeof oldProfile.facingDeg !== 'number' && typeof newProfile.facingDeg === 'number') facingGained += 1;

    const bucket = levelRankShift >= 5 ? '5+' : levelRankShift;
    shiftHistogram[bucket] += 1;

    if (levelRankShift > 0) {
      rows.push({
        region: fileName.replace('.json', ''),
        beachId: Number(beachId),
        name: oldProfile.name.en,
        levelRankShift,
        changedSectors: changedSectors.join(' '),
        maxIntensityDelta: Number(maxIntensityDelta.toFixed(1)),
        facingOld: oldProfile.facingDeg,
        facingNew: newProfile.facingDeg,
      });
    }
  }
}

rows.sort((a, b) => (b.levelRankShift - a.levelRankShift) || (b.maxIntensityDelta || 0) - (a.maxIntensityDelta || 0));

console.log(JSON.stringify({
  totalBeaches,
  beachesWithCategoryChange: rows.length,
  totalSectorChanges,
  totalSectorRatings: totalBeaches * 8,
  towardProtected,
  towardExposed,
  facingLost,
  facingGained,
  levelRankShiftHistogram: shiftHistogram,
}, null, 2));

console.log(`\nTop ${top} by magnitude (levelRankShift = sum of category steps across 8 sectors):`);
for (const row of rows.slice(0, top)) {
  if (row.droppedInNew) {
    console.log(`  [${row.region}] #${row.beachId} ${row.name}: DROPPED in new build`);
    continue;
  }
  console.log(`  [${row.region}] #${row.beachId} ${row.name}: shift=${row.levelRankShift} | ${row.changedSectors} | maxDInt=${row.maxIntensityDelta}`);
}

if (jsonOutPath) {
  writeFileSync(jsonOutPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`\nFull sorted regression list written to ${jsonOutPath}`);
}
