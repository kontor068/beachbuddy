/**
 * Marine sampling points — where to ask the wave model about each beach.
 *
 * THE PROBLEM. The app asks the marine API for the wave at the beach pin. The pin is on the
 * coast, so `cell_selection=sea` walks to the nearest cell the model considers water — and on a
 * ~9 km grid that walk regularly lands in a DIFFERENT BODY OF WATER. Measured for Σχινιάς on
 * 2026-07-27: the served cell was 38.2083 / 24.1250, 11.0 km away across the Marathon headland,
 * out in the South Evoian Gulf. The beach's own geometry reports 0.52 km of fetch toward that
 * cell — there is land in between. The app was reading a different sea and reporting it as this
 * beach's.
 *
 * WHY "NEAREST" IS THE WRONG FIX. Probed live, same beach, same hour:
 *   default MFWAM 1/12°   cell 11.0 km away   0.24 m
 *   ewam 0.05° (closer)   cell  5.8 km away   0.12 m   ← closer, and WORSE
 *   ecmwf_wam025          cell 24.4 km away   0.44 m   ← further, and RIGHT
 * Nearshore cells are fetch-truncated: they model a sliver of water hemmed in by land. The cell
 * that describes the sea arriving at this beach is the one out in the corridor the beach faces.
 * So the fix is not a closer point, nor a different model — it is a point pushed OFFSHORE ALONG
 * THE FETCH.
 *
 * WHY THIS NEEDS NO LAND MASK AND NO NETWORK. `sectors[].fetchKm` in the committed exposure
 * profiles is already a ray-cast result: how far rays travelled from this beach on that bearing
 * before hitting land. Pushing out half of it usually lands in the same water as the beach.
 *
 * "Usually", not "by construction" — and the difference matters. The stored figure is the MEAN of a
 * five-ray fan spanning ±30°, so a fan of {25, 25, 0.3, 0.3, 0.3} km averages 10.2 km and would
 * push 5.1 km along a bearing that is actually blocked at 0.3 km. The push also uses the exact
 * facing bearing while the fetch it is validated against is a 45° sector bin. So this is a good
 * heuristic that must be MEASURED, not a guarantee: scripts/auditMarineCellTrust.mjs is what
 * checks where the API actually lands, and it finds 258 sample points still in other water.
 *
 * Beaches with no meaningful fetch in any direction — a deeply enclosed cove — get no sample
 * point at all. That is correct: there is no open-water cell that describes their water, and the
 * runtime should fall back to the modelled wave rather than import a number from outside.
 *
 * Usage:  node scripts/buildMarineSamplePoints.mjs [--dry-run] [--region <id>]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(root, 'public', 'data', 'geospatial', 'exposure');

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SECTOR_BEARING = Object.fromEntries(SECTORS.map((s, i) => [s, i * 45]));

/** Fraction of the open fetch to push out — safely inside the ray's own land-free guarantee. */
const PUSH_FRACTION = 0.5;
/** Never go further than this: beyond it we start describing a different part of the basin. */
const MAX_PUSH_KM = 10;
/** Below this the walk is not worth making — the pin's own cell is as good as anything. */
const MIN_PUSH_KM = 2;
/** A sector must be at least this open to be worth sampling from. */
const MIN_SECTOR_FETCH_KM = 2 * MIN_PUSH_KM / PUSH_FRACTION;

const EARTH_RADIUS_KM = 6371;
const toRad = deg => (deg * Math.PI) / 180;
const toDeg = rad => (rad * 180) / Math.PI;

/** Great-circle destination from a point, given a bearing and distance. */
const destinationPoint = (lat, lon, bearingDeg, distanceKm) => {
  const d = distanceKm / EARTH_RADIUS_KM;
  const brg = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lon2 = lon1 + Math.atan2(
    Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: Number(toDeg(lat2).toFixed(4)),
    lon: Number((((toDeg(lon2) + 540) % 360) - 180).toFixed(4)),
  };
};

/**
 * The bearing to sample along. Preference order:
 *  1. The beach's own facing, when the sector it points into is genuinely open — this is the
 *     water the swimmer is looking at, so it is the water we want a wave for.
 *  2. Otherwise the most open sector, because that is where any sea reaching this beach is
 *     coming from.
 */
const resolveSampleBearing = profile => {
  const openSectors = SECTORS
    .map(sector => ({ sector, ...(profile.sectors?.[sector] || {}) }))
    .filter(s => Number.isFinite(s.fetchKm));
  if (openSectors.length === 0) return null;

  const widest = openSectors.reduce((best, s) => (s.fetchKm > best.fetchKm ? s : best));
  if (widest.fetchKm < MIN_SECTOR_FETCH_KM) return null;

  const facing = profile.facingDeg;
  if (typeof facing === 'number' && Number.isFinite(facing)) {
    const facingSector = SECTORS[((Math.round(facing / 45) % 8) + 8) % 8];
    const atFacing = profile.sectors?.[facingSector];
    if (atFacing && Number.isFinite(atFacing.fetchKm) && atFacing.fetchKm >= MIN_SECTOR_FETCH_KM) {
      return { bearingDeg: facing, fetchKm: atFacing.fetchKm, via: 'facing' };
    }
  }
  return { bearingDeg: SECTOR_BEARING[widest.sector], fetchKm: widest.fetchKm, via: 'widest-sector' };
};

const buildSamplePoint = profile => {
  const coords = profile.coordinates;
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) return null;

  const bearing = resolveSampleBearing(profile);
  if (!bearing) return null;

  const pushKm = Math.min(MAX_PUSH_KM, bearing.fetchKm * PUSH_FRACTION);
  if (pushKm < MIN_PUSH_KM) return null;

  const point = destinationPoint(coords.lat, coords.lon, bearing.bearingDeg, pushKm);
  return {
    ...point,
    bearingDeg: Number(bearing.bearingDeg.toFixed(1)),
    distanceKm: Number(pushKm.toFixed(2)),
    via: bearing.via,
  };
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const regionArg = args.includes('--region') ? args[args.indexOf('--region') + 1] : null;

const files = readdirSync(EXPOSURE_DIR)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .filter(f => !regionArg || f === `${regionArg}.json`);

if (files.length === 0) {
  console.error(regionArg ? `No exposure profile file for region "${regionArg}".` : 'No exposure profile files found.');
  process.exit(1);
}

let totalProfiles = 0;
let withPoint = 0;
let changedFiles = 0;
const viaCounts = { facing: 0, 'widest-sector': 0 };
const distances = [];

for (const file of files) {
  const filePath = path.join(EXPOSURE_DIR, file);
  const payload = JSON.parse(readFileSync(filePath, 'utf8'));
  let fileChanged = false;

  for (const profile of Object.values(payload.profiles || {})) {
    totalProfiles += 1;
    const point = buildSamplePoint(profile);
    const previous = JSON.stringify(profile.marineSamplePoint ?? null);

    if (point) {
      withPoint += 1;
      viaCounts[point.via] += 1;
      distances.push(point.distanceKm);
      profile.marineSamplePoint = { lat: point.lat, lon: point.lon, bearingDeg: point.bearingDeg, distanceKm: point.distanceKm };
    } else if (profile.marineSamplePoint) {
      delete profile.marineSamplePoint;
    }

    if (JSON.stringify(profile.marineSamplePoint ?? null) !== previous) fileChanged = true;
  }

  if (fileChanged) {
    changedFiles += 1;
    // Content-aware stamp: leaving generatedAt alone on unchanged regions keeps 111 files out of
    // the diff and out of every user's HTTP cache.
    if (!dryRun) writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}

distances.sort((a, b) => a - b);
const pct = p => (distances.length ? distances[Math.min(distances.length - 1, Math.floor(distances.length * p))] : 0);

console.log(`Marine sample points${dryRun ? ' (dry run)' : ''}`);
console.log(`  regions scanned      ${files.length}`);
console.log(`  profiles             ${totalProfiles}`);
console.log(`  with sample point    ${withPoint} (${((withPoint / totalProfiles) * 100).toFixed(1)}%)`);
console.log(`    via beach facing   ${viaCounts.facing}`);
console.log(`    via widest sector  ${viaCounts['widest-sector']}`);
console.log(`  no point (enclosed)  ${totalProfiles - withPoint} — these keep running on the modelled wave`);
console.log(`  push distance km     min ${distances[0]?.toFixed(2)}  p50 ${pct(0.5).toFixed(2)}  p90 ${pct(0.9).toFixed(2)}  max ${distances[distances.length - 1]?.toFixed(2)}`);
console.log(`  files ${dryRun ? 'that would change' : 'written'}   ${changedFiles}`);
