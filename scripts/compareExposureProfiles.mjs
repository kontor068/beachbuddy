/**
 * Compares two generated exposure region files (old vs new land mask) and
 * reports, per beach: facingDeg shift, per-sector level changes, fetch and
 * intensity deltas. Sorted by magnitude of change so outliers surface first.
 *
 * For the geometry path the stored per-sector level/intensity IS the runtime
 * exposure rating for a wind blowing from that sector (the runtime resolver
 * reproduces the same computeDirectionalExposure on the same inputs), so a
 * sector-aligned wind scenario comparison reduces to comparing stored sectors.
 *
 * Usage:
 *   node scripts/compareExposureProfiles.mjs --old <old-region.json> --new <new-region.json> [--json <out.json>]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const LEVEL_RANK = { protected: 0, partial: 1, exposed: 2 };

const parseArgValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const oldPath = parseArgValue('--old');
const newPath = parseArgValue('--new');
const jsonOutPath = parseArgValue('--json');
if (!oldPath || !newPath) {
  console.error('Usage: node scripts/compareExposureProfiles.mjs --old <file> --new <file> [--json <out>]');
  process.exit(1);
}

const oldProfiles = JSON.parse(readFileSync(oldPath, 'utf8')).profiles;
const newProfiles = JSON.parse(readFileSync(newPath, 'utf8')).profiles;

const angularDelta = (a, b) => {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  const diff = Math.abs(((a - b) % 360 + 360) % 360);
  return Number((diff > 180 ? 360 - diff : diff).toFixed(1));
};

const rows = [];
for (const [beachId, oldProfile] of Object.entries(oldProfiles)) {
  const newProfile = newProfiles[beachId];
  if (!newProfile) {
    rows.push({ beachId: Number(beachId), name: oldProfile.name.en, missingInNew: true, changeScore: 999 });
    continue;
  }

  const sectorChanges = [];
  let maxIntensityDelta = 0;
  let maxFetchDelta = 0;
  let levelChangeCount = 0;
  let levelRankShift = 0;

  for (const sector of SECTORS) {
    const o = oldProfile.sectors[sector];
    const n = newProfile.sectors[sector];
    const intensityDelta = typeof o.intensity === 'number' && typeof n.intensity === 'number'
      ? Number((n.intensity - o.intensity).toFixed(1))
      : null;
    const fetchDelta = Number((n.fetchKm - o.fetchKm).toFixed(2));
    if (intensityDelta !== null) maxIntensityDelta = Math.max(maxIntensityDelta, Math.abs(intensityDelta));
    maxFetchDelta = Math.max(maxFetchDelta, Math.abs(fetchDelta));

    if (o.level !== n.level) {
      levelChangeCount += 1;
      levelRankShift += Math.abs(LEVEL_RANK[n.level] - LEVEL_RANK[o.level]);
      sectorChanges.push({
        sector,
        old: { level: o.level, fetchKm: o.fetchKm, intensity: o.intensity ?? null },
        new: { level: n.level, fetchKm: n.fetchKm, intensity: n.intensity ?? null },
      });
    }
  }

  rows.push({
    beachId: Number(beachId),
    name: oldProfile.name.en,
    facingOld: oldProfile.facingDeg,
    facingNew: newProfile.facingDeg,
    facingDelta: angularDelta(oldProfile.facingDeg, newProfile.facingDeg),
    levelChangeCount,
    levelRankShift,
    maxIntensityDelta,
    maxFetchDelta,
    sectorChanges,
    changeScore: levelRankShift * 100 + maxIntensityDelta,
  });
}

rows.sort((a, b) => b.changeScore - a.changeScore);

const changed = rows.filter(row => row.levelChangeCount > 0 || row.missingInNew);
console.log(`Beaches compared: ${rows.length}; with >=1 sector level change: ${changed.length}\n`);

for (const row of rows) {
  if (row.missingInNew) {
    console.log(`#${row.beachId} ${row.name}: MISSING in new build`);
    continue;
  }
  const facing = row.facingDelta !== null && row.facingDelta >= 10
    ? ` facing ${row.facingOld}->${row.facingNew} (d${row.facingDelta})`
    : '';
  const header = `#${row.beachId} ${row.name}: ${row.levelChangeCount} sector level change(s), max dIntensity ${row.maxIntensityDelta}, max dFetch ${row.maxFetchDelta} km${facing}`;
  if (row.levelChangeCount === 0 && row.maxIntensityDelta < 10 && (row.facingDelta === null || row.facingDelta < 10)) continue;
  console.log(header);
  for (const change of row.sectorChanges) {
    console.log(`    ${change.sector}: ${change.old.level} -> ${change.new.level} | fetch ${change.old.fetchKm} -> ${change.new.fetchKm} km | intensity ${change.old.intensity} -> ${change.new.intensity}`);
  }
}

if (jsonOutPath) {
  writeFileSync(jsonOutPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`\nFull comparison written to ${jsonOutPath}`);
}
