/**
 * National marine-cell trust audit.
 *
 * THE QUESTION. For every beach, the app asks the wave model for a wave height at some
 * coordinate. `cell_selection=sea` then walks to the nearest cell the model calls water. Is the
 * cell it lands on actually describing the water THIS beach faces — or a different body of water
 * across a headland?
 *
 * Σχινιάς (2026-07-27) is the case that prompted this: the served cell was 11.0 km away at
 * bearing 46°, and the beach's own geometry reports 0.52 km of fetch in that direction. There is
 * land in between. The app was reading the South Evoian Gulf and calling it Marathon Bay.
 *
 * THE TEST (no network needed once the served cell is known):
 *
 *     fetchKm(beach, bearing(beach → cell))  >=  MIN_FETCH_RATIO * distance(beach, cell)
 *
 * The fetch is how far a ray from this beach travelled on that bearing before it hit land. If it
 * is shorter than the distance to the cell, the cell is behind land. This uses only committed
 * geometry, so it is exact and repeatable — the network is needed ONLY to learn which cell the
 * API serves.
 *
 * Two coordinates are audited per beach: the pin (what the app used to ask for) and the baked
 * `marineSamplePoint` (what it asks for now), so the improvement is measured rather than assumed.
 *
 * COST. Requests are deduplicated to the model's own 1/12° source lattice — points inside one
 * source cell always snap identically — and ask for ONE variable over ONE day, the lightest
 * request the API bills. ~1500 unique lookups for ~2850 beaches.
 *
 * Usage:
 *   node scripts/auditMarineCellTrust.mjs            # audit + write the report
 *   node scripts/auditMarineCellTrust.mjs --apply    # (see caveat) bake the verdict into profiles
 *   node scripts/auditMarineCellTrust.mjs --limit 50 # smoke test on the first N lookups
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const REPORT_DIR = path.join(root, 'reports', 'quality');
const REPORT_PATH = path.join(REPORT_DIR, 'marine-cell-trust.json');
const CACHE_PATH = path.join(root, '.tmp', 'marine-cell-snap-cache.json');

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** The wave model's native source lattice — points inside one cell always snap the same way. */
const SOURCE_GRID_DEG = 1 / 12;
/**
 * How much of the distance to the cell must be open water on that bearing. Below 1.0 because the
 * fetch is a 5-ray MEAN: a cell just past a small islet inside the fan is still the same sea.
 */
const MIN_FETCH_RATIO = 0.8;
/**
 * Absolute ceiling, set at the ray-cast cap rather than at a model cell width. A tighter cap would
 * be wrong: a beach with 25 km of open fetch has its sea GENERATED 25 km away, so a cell far down
 * that corridor describes the water arriving at the shore better than a nearshore cell in the
 * wrong basin does. Local shelter is already handled by the beach's own exposure geometry, which
 * attenuates whatever the open sea is doing — that is the app's architecture. So the fetch test
 * below does the real work and this only rejects readings beyond what the geometry can vouch for.
 */
const MAX_TRUSTED_DISTANCE_KM = 25;

const CONCURRENCY = 6;
const MAX_RETRIES = 4;

const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

const distanceKm = (aLat, aLon, bLat, bLon) => {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const bearingDeg = (aLat, aLon, bLat, bLon) => {
  const dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/** Same lerp between adjacent sectors the runtime resolver uses, so the audit judges what ships. */
const interpolatedFetchKm = (sectors, deg) => {
  const pos = (((deg % 360) + 360) % 360) / 45;
  const lo = Math.floor(pos) % 8;
  const hi = (lo + 1) % 8;
  const t = pos - Math.floor(pos);
  const a = sectors[SECTORS[lo]]?.fetchKm;
  const b = sectors[SECTORS[hi]]?.fetchKm;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a + (b - a) * t;
};

const cellKey = (lat, lon) => `${Math.floor(lat / SOURCE_GRID_DEG)}_${Math.floor(lon / SOURCE_GRID_DEG)}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Ask the API which cell it actually serves for this coordinate. One variable, one day. */
const lookupServedCell = async (lat, lon) => {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}`
    + `&hourly=wave_height&forecast_days=1&cell_selection=sea`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      const json = await res.json();
      if (json?.error) {
        if (String(json.reason || '').includes('limit')) throw new Error(`QUOTA: ${json.reason}`);
        return null;
      }
      if (!Number.isFinite(json?.latitude) || !Number.isFinite(json?.longitude)) return null;
      return { lat: json.latitude, lon: json.longitude };
    } catch (error) {
      if (String(error.message).startsWith('QUOTA')) throw error;
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

// ── Load every profile ───────────────────────────────────────────────────────
const files = readdirSync(EXPOSURE_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
const beaches = [];
for (const file of files) {
  const payload = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
  for (const profile of Object.values(payload.profiles || {})) {
    if (!profile.coordinates || !profile.sectors) continue;
    beaches.push({ region: file.replace('.json', ''), profile });
  }
}

// ── Collect the unique lookups ───────────────────────────────────────────────
const wanted = new Map(); // cellKey -> {lat, lon}
const remember = (lat, lon) => {
  const key = cellKey(lat, lon);
  if (!wanted.has(key)) wanted.set(key, { lat, lon });
  return key;
};
for (const { profile } of beaches) {
  remember(profile.coordinates.lat, profile.coordinates.lon);
  if (profile.marineSamplePoint) remember(profile.marineSamplePoint.lat, profile.marineSamplePoint.lon);
}

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
const todo = [...wanted.entries()].filter(([key]) => !(key in cache)).slice(0, limit);
console.log(`Marine cell trust audit`);
console.log(`  beaches            ${beaches.length}`);
console.log(`  unique lookups     ${wanted.size}  (${wanted.size - todo.length} cached, ${todo.length} to fetch)`);

let done = 0;
let quotaHit = false;
const queue = [...todo];
const workers = Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length && !quotaHit) {
    const [key, point] = queue.shift();
    try {
      cache[key] = await lookupServedCell(point.lat, point.lon);
    } catch (error) {
      if (String(error.message).startsWith('QUOTA')) {
        quotaHit = true;
        console.error(`\n  STOPPED: ${error.message}`);
        console.error('  Partial results are cached; re-run tomorrow to continue where it left off.');
        break;
      }
      cache[key] = null;
    }
    done += 1;
    if (done % 100 === 0) process.stdout.write(`\r  fetched ${done}/${todo.length}`);
  }
});
await Promise.all(workers);
if (todo.length) process.stdout.write(`\r  fetched ${done}/${todo.length}\n`);

mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf8');

// ── Judge every beach ────────────────────────────────────────────────────────
const judge = (profile, requestPoint) => {
  if (!requestPoint) return { verdict: 'no-point' };
  const served = cache[cellKey(requestPoint.lat, requestPoint.lon)];
  if (!served) return { verdict: 'unknown' };

  const { lat, lon } = profile.coordinates;
  const d = distanceKm(lat, lon, served.lat, served.lon);
  if (d < 0.5) return { verdict: 'trusted', distanceKm: d, reason: 'cell sits on the beach' };
  const brg = bearingDeg(lat, lon, served.lat, served.lon);
  const fetchKm = interpolatedFetchKm(profile.sectors, brg);
  if (fetchKm === null) return { verdict: 'unknown' };

  if (d > MAX_TRUSTED_DISTANCE_KM) return { verdict: 'too-far', distanceKm: d, bearingDeg: brg, fetchKm };
  if (fetchKm < MIN_FETCH_RATIO * d) return { verdict: 'other-water', distanceKm: d, bearingDeg: brg, fetchKm };
  return { verdict: 'trusted', distanceKm: d, bearingDeg: brg, fetchKm };
};

const tally = key => ({ trusted: 0, 'other-water': 0, 'too-far': 0, unknown: 0, 'no-point': 0, _key: key });
const pinStats = tally('pin');
const sampleStats = tally('sample');
const perBeach = [];
const worst = [];

for (const { region, profile } of beaches) {
  const pin = judge(profile, profile.coordinates);
  const sample = judge(profile, profile.marineSamplePoint);
  pinStats[pin.verdict] += 1;
  sampleStats[sample.verdict] += 1;

  // What the app will actually rely on: the sample point when there is one, else the pin.
  const effective = profile.marineSamplePoint && sample.verdict !== 'unknown' ? sample : pin;
  const trusted = effective.verdict === 'trusted';
  perBeach.push({ beachId: profile.beachId, region, trusted, via: effective === sample ? 'sample' : 'pin', ...effective });
  if (!trusted && effective.distanceKm) {
    worst.push({
      beachId: profile.beachId,
      region,
      name: profile.name?.gr || profile.name?.en || '',
      verdict: effective.verdict,
      distanceKm: Number(effective.distanceKm.toFixed(1)),
      bearingDeg: Number((effective.bearingDeg ?? 0).toFixed(0)),
      fetchKm: Number((effective.fetchKm ?? 0).toFixed(2)),
    });
  }
}

const effectiveTrusted = perBeach.filter(b => b.trusted).length;
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;

console.log(`\n  request point   trusted   other water   too far   unknown   no point`);
for (const s of [pinStats, sampleStats]) {
  console.log(`  ${s._key.padEnd(14)} ${String(s.trusted).padStart(7)} ${String(s['other-water']).padStart(13)} ${String(s['too-far']).padStart(9)} ${String(s.unknown).padStart(9)} ${String(s['no-point']).padStart(10)}`);
}
console.log(`\n  EFFECTIVE (sample point where baked, else pin): ${effectiveTrusted}/${beaches.length} trusted (${pct(effectiveTrusted, beaches.length)})`);
console.log(`  untrusted: ${beaches.length - effectiveTrusted} beaches — these must run on the modelled wave, not an imported number.`);

worst.sort((a, b) => (b.distanceKm - b.fetchKm) - (a.distanceKm - a.fetchKm));
console.log(`\n  worst offenders (distance to cell vs open fetch toward it):`);
for (const w of worst.slice(0, 10)) {
  console.log(`    #${String(w.beachId).padEnd(5)} ${w.name.slice(0, 24).padEnd(25)} cell ${String(w.distanceKm).padStart(5)} km @ ${String(w.bearingDeg).padStart(3)}°, fetch there ${String(w.fetchKm).padStart(5)} km  [${w.verdict}]`);
}

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  method: `fetchKm(bearing to served cell) >= ${MIN_FETCH_RATIO} x distance(beach, served cell), and distance <= ${MAX_TRUSTED_DISTANCE_KM} km`,
  caveat: 'Judged at each beach OWN pin and sample point. The app issues ONE marine call per '
    + 'cluster, at the mean of that cluster sample points, so these figures describe the '
    + 'coordinates stored in the data and NOT the coordinate the runtime actually requests. '
    + 'Treat as an upper bound on how well the sample points can do, not as production accuracy.',
  minFetchRatio: MIN_FETCH_RATIO,
  maxTrustedDistanceKm: MAX_TRUSTED_DISTANCE_KM,
  beaches: beaches.length,
  pin: pinStats,
  samplePoint: sampleStats,
  effectiveTrusted,
  worst: worst.slice(0, 100),
}, null, 2)}\n`, 'utf8');
console.log(`\n  report: ${path.relative(root, REPORT_PATH)}`);

// ── Optionally bake the verdict ──────────────────────────────────────────────
if (apply) {
  const byBeach = new Map(perBeach.map(b => [b.beachId, b]));
  let changed = 0;
  for (const file of files) {
    const filePath = path.join(EXPOSURE_DIR, file);
    const payload = JSON.parse(readFileSync(filePath, 'utf8'));
    let dirty = false;
    for (const profile of Object.values(payload.profiles || {})) {
      const verdict = byBeach.get(profile.beachId);
      if (!verdict) continue;
      const next = verdict.trusted ? undefined : false;
      const prev = profile.marineCellTrusted;
      if (next === undefined) { if (prev !== undefined) { delete profile.marineCellTrusted; dirty = true; } }
      else if (prev !== next) { profile.marineCellTrusted = next; dirty = true; }
    }
    if (dirty) { writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); changed += 1; }
  }
  console.log(`  baked marineCellTrusted:false into ${changed} region files (trusted beaches carry no flag).`);
}
