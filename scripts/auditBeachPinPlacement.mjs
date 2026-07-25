// National pin-placement audit: find beach pins that do not sit on a beach.
//
// A beach record whose coordinate is kilometres from ANY mapped beach is not a
// "slightly off" pin — it is a wrong location (the Pelion sweep found pins 2.9-5.0 km
// INLAND, residue of the original synthetic id/lat/lon generator). Those are worse than
// a missing beach: the map, the navigation link and the wind exposure profile are all
// computed for a place that is not the beach.
//
//   node scripts/auditBeachPinPlacement.mjs                 # stage 1 only (offline, free)
//   node scripts/auditBeachPinPlacement.mjs --verify        # + stage 2 on the suspects
//   node scripts/auditBeachPinPlacement.mjs --verify --limit=50 --threshold=1000
//
// STAGE 1 (offline, no network): distance from every beach to the nearest of the ~3046
//   NAMED OSM beaches in scripts/data/osm-beaches-national.json (npm run coverage:harvest).
//   That set has no unnamed polygons, so a large stage-1 distance is only a SUSPICION.
// STAGE 2 (--verify, network): for suspects only, ask Overpass for ANY natural=beach
//   (named AND unnamed) within the radius. This is what separates a genuinely misplaced
//   pin from a correct pin next to an unnamed beach. Throttled + disk-cached.
//
// Output: reports/quality/pin-placement-audit.{json,md}. Read-only — never edits beach data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchOverpassBeaches, distanceMeters, openPlaceCache, sleep } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const VERIFY = process.argv.includes('--verify');
const THRESHOLD = Number(arg('threshold', 1000));   // stage-1 suspicion distance (m)
const LIMIT = Number(arg('limit', 0));              // cap stage-2 lookups (0 = all)
const RADIUS = Number(arg('radius', 1200));         // stage-2 Overpass search radius (m)

const DATA = path.join(rootDir, 'public', 'greek_beaches.json');
const OSM = path.join(rootDir, 'scripts', 'data', 'osm-beaches-national.json');
const OUT_DIR = path.join(rootDir, 'reports', 'quality');

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const osm = JSON.parse(readFileSync(OSM, 'utf8')).candidates
  .map(c => ({ name: c.name, lat: c.coordinates?.lat, lon: c.coordinates?.lon }))
  .filter(o => Number.isFinite(o.lat) && Number.isFinite(o.lon));

const beaches = [];
for (const [region, sub] of Object.entries(data))
  for (const [prefecture, subSub] of Object.entries(sub))
    for (const [municipality, arr] of Object.entries(subSub))
      if (Array.isArray(arr)) for (const b of arr)
        if (Number.isFinite(b.lat) && Number.isFinite(b.lon))
          beaches.push({ id: b.id, name: b.name, lat: b.lat, lon: b.lon, region, prefecture, municipality,
            confidence: b.metadata?.confidence, batch: b.metadata?.batch });

console.log(`Beaches: ${beaches.length} | named OSM beaches: ${osm.length}`);

// ---- stage 1: nearest NAMED OSM beach (offline) ----
// Bucket the OSM set by 0.1deg cell so we only compare against nearby candidates.
const key = (la, lo) => `${Math.floor(la * 10)}:${Math.floor(lo * 10)}`;
const grid = new Map();
for (const o of osm) { const k = key(o.lat, o.lon); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); }
const nearestNamed = (b) => {
  let best = Infinity, ref = null;
  for (let dla = -2; dla <= 2; dla += 1) for (let dlo = -2; dlo <= 2; dlo += 1) {
    for (const o of grid.get(`${Math.floor(b.lat * 10) + dla}:${Math.floor(b.lon * 10) + dlo}`) || []) {
      const d = distanceMeters(b, o); if (d < best) { best = d; ref = o; }
    }
  }
  if (ref === null) for (const o of osm) { const d = distanceMeters(b, o); if (d < best) { best = d; ref = o; } }
  return { d: best, ref };
};

for (const b of beaches) { const n = nearestNamed(b); b.stage1 = Math.round(n.d); b.stage1Ref = n.ref?.name || null; }
const suspects = beaches.filter(b => b.stage1 > THRESHOLD).sort((a, b) => b.stage1 - a.stage1);
console.log(`Stage 1: ${suspects.length} pins >${THRESHOLD}m from any NAMED OSM beach (suspects, incl. false positives near unnamed beaches).`);

// ---- stage 2: confirm against ALL OSM beaches (named + unnamed) ----
let confirmed = [], cleared = [], unresolved = [];
if (VERIFY) {
  const cache = openPlaceCache(path.join(rootDir, '.tmp', 'pin-audit-cache.json'));
  const targets = LIMIT > 0 ? suspects.slice(0, LIMIT) : suspects;
  console.log(`Stage 2: verifying ${targets.length} suspects against ALL OSM beaches within ${RADIUS}m...`);
  let i = 0;
  for (const b of targets) {
    i += 1;
    const hit = await fetchOverpassBeaches({ lat: b.lat, lon: b.lon }, RADIUS, cache);
    if (hit === null) { b.stage2 = 'MIRROR_FAIL'; unresolved.push(b); }
    else if (hit.length === 0) { b.stage2 = 'NO_BEACH_IN_RADIUS'; confirmed.push(b); }
    else {
      let best = Infinity, ref = null;
      for (const o of hit) { const d = distanceMeters(b, { lat: o.location.latitude, lon: o.location.longitude }); if (d < best) { best = d; ref = o; } }
      b.stage2 = Math.round(best); b.stage2Ref = ref?.displayName?.text || '(unnamed)';
      (best > THRESHOLD ? confirmed : cleared).push(b);
    }
    if (i % 25 === 0) { cache.flush(); console.log(`  ...${i}/${targets.length} (confirmed ${confirmed.length}, cleared ${cleared.length})`); }
    await sleep(250);
  }
  cache.flush();
  confirmed.sort((a, b) => (b.stage2 === 'NO_BEACH_IN_RADIUS' ? 1e9 : b.stage2) - (a.stage2 === 'NO_BEACH_IN_RADIUS' ? 1e9 : a.stage2));
}

mkdirSync(OUT_DIR, { recursive: true });
const payload = { thresholdM: THRESHOLD, radiusM: RADIUS, verified: VERIFY, totals: { beaches: beaches.length, suspects: suspects.length, confirmed: confirmed.length, cleared: cleared.length, unresolved: unresolved.length }, confirmed, suspects: VERIFY ? undefined : suspects };
writeFileSync(path.join(OUT_DIR, 'pin-placement-audit.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');

const list = VERIFY ? confirmed : suspects;
const lines = [`# Pin-placement audit`, '', `Beaches: ${beaches.length} · suspects (>${THRESHOLD}m from a named OSM beach): ${suspects.length}`,
  VERIFY ? `Verified against ALL OSM beaches within ${RADIUS}m → **confirmed misplaced: ${confirmed.length}**, cleared: ${cleared.length}, unresolved: ${unresolved.length}` : '_Stage 1 only — re-run with `--verify` to eliminate false positives._', '',
  '| dist | id | beach | region | coords | confidence |', '|---:|---:|---|---|---|---|',
  ...list.slice(0, 200).map(b => `| ${VERIFY ? (b.stage2 === 'NO_BEACH_IN_RADIUS' ? `>${RADIUS}m` : b.stage2 + 'm') : b.stage1 + 'm'} | ${b.id} | ${b.name} | ${b.region} / ${b.municipality} | ${b.lat},${b.lon} | ${b.confidence || '—'} |`)];
writeFileSync(path.join(OUT_DIR, 'pin-placement-audit.md'), lines.join('\n') + '\n', 'utf8');

console.log(`\n${VERIFY ? `CONFIRMED misplaced pins: ${confirmed.length} (cleared ${cleared.length}, unresolved ${unresolved.length})` : `Suspects: ${suspects.length}`}`);
for (const b of list.slice(0, 25))
  console.log(`  ${String(VERIFY ? (b.stage2 === 'NO_BEACH_IN_RADIUS' ? `>${RADIUS}` : b.stage2) : b.stage1).padStart(6)}m  #${b.id} ${String(b.name).padEnd(28)} ${b.region}/${b.municipality}  conf=${b.confidence || '—'}`);
console.log(`\nWrote reports/quality/pin-placement-audit.{json,md}`);
