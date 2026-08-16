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
 * THE TEST lives in scripts/lib/marineCellTrust.mjs and is imported, not copied — this file and
 * scripts/optimiseMarineSamplePoints.mjs must never drift into judging by different rules, which
 * is the failure scripts/validateEffectiveRanking.ts records from a gate that had re-implemented
 * its own subject. The network is needed ONLY to learn which cell the API serves; the verdict
 * itself is exact, offline and repeatable from the committed geometry.
 *
 * ── TWO CORRECTIONS MADE 2026-08-16, both of which moved the answer ──────────────────────────
 *
 * 1. IT MUST ASK THE MODEL THAT DECIDES THE WAVE. The first version sent no `models=` parameter,
 *    so it measured Open-Meteo's default. Production sends `models=ewam,meteofrance_wave` and
 *    utils/marineForecastParsing.ts gives ewam (0.05°) every hour it reports a height, falling to
 *    meteofrance_wave (1/12°) only where ewam is silent — measured here, ewam answers for 2796 of
 *    2866 beaches. The two snap to different lattices and different coastlines: at Σχινιάς the
 *    default served a cell 10.97 km from the pin, ewam one 5.80 km away. The 2026-07-27 figures
 *    (1410 pins / 524 effective in the wrong water) answered a question about a model the app only
 *    uses as a fallback.
 *
 * 2. IT MUST JUDGE THE COORDINATE THE RUNTIME REQUESTS. The first version fell back to the
 *    beach's own pin for the beaches with no `marineSamplePoint`. The runtime does not: those
 *    beaches read the REGION point (hooks/useWeather.MARINE_POINT_OVERRIDES, else
 *    island.coordinates) — see utils/marineSamplePoints.resolveBeachMarinePoints. Judging them at
 *    their pin flattered exactly the beaches with the weakest claim to a shore of their own.
 *
 * What is NO LONGER true and used to be printed here as a caveat: the app does not average a
 * cluster of beaches into one coordinate. Since 2026-08-01 `resolveBeachMarinePoints` deduplicates
 * identical sample points at 3 decimals and moves nothing, so the coordinate audited below IS the
 * coordinate requested.
 *
 * COST. Requests are deduplicated to each model's own source lattice — points inside one source
 * cell always snap identically — and ask for ONE variable over ONE day, the lightest request the
 * API bills.
 *
 * Usage:
 *   node scripts/auditMarineCellTrust.mjs            # audit + write the report
 *   node scripts/auditMarineCellTrust.mjs --apply    # bake the verdict into the exposure profiles
 *   node scripts/auditMarineCellTrust.mjs --limit 50 # smoke test on the first N lookups
 */

// Routes this script through the PAID Open-Meteo plan when OPEN_METEO_API_KEY is in the
// environment, and changes nothing when it is not. See scripts/lib/paidOpenMeteo.mjs.
import './lib/paidOpenMeteo.mjs';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODELS, MIN_FETCH_RATIO, MAX_TRUSTED_DISTANCE_KM,
  judge, resolvePoints, isPointResolved,
} from './lib/marineCellTrust.mjs';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const APP_BEACH_DIR = path.join(root, 'public', 'data', 'beaches', 'app');
const REPORT_DIR = path.join(root, 'reports', 'quality');
const REPORT_PATH = path.join(REPORT_DIR, 'marine-cell-trust.json');
/**
 * Every beach's verdict, not just the worst hundred. The summary answers "how bad is it"; this
 * answers "which ones", which is what scripts/optimiseMarineSamplePoints.mjs needs. Separate file
 * because it is 2866 rows and the summary should stay readable.
 */
const PER_BEACH_PATH = path.join(REPORT_DIR, 'marine-cell-trust-per-beach.json');
// v2: the cache from the first version holds default-model answers keyed by a 1/12° lattice, which
// are not answers to this question. A new file rather than a migration, so the old run stays
// reproducible. Shared with the optimiser — a cell lookup is a fact about the model, not about
// which script asked.
const CACHE_PATH = path.join(root, '.tmp', 'marine-cell-snap-cache-v2.json');

/**
 * Marine-only region points for the two regions whose centroid sits too far inland for the wave
 * model to resolve. Mirrors hooks/useWeather.MARINE_POINT_OVERRIDES, which is the source of truth;
 * it lives inside a React hook that cannot be imported from a node script. Two entries, verified
 * against the file on 2026-08-16 — if that list grows, this one has to grow with it.
 */
const MARINE_POINT_OVERRIDES = {
  'central-macedonia-thessaloniki-area': { lat: 40.45, lon: 22.90 },
  'west-greece-achaia-mainland': { lat: 38.28, lon: 21.70 },
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

// ── Load every profile, and the region point its runtime would fall back to ──
const files = readdirSync(EXPOSURE_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
const beaches = [];
const regionsWithoutPoint = [];
for (const file of files) {
  const regionId = file.replace('.json', '');
  let regionPoint = MARINE_POINT_OVERRIDES[regionId] ?? null;
  if (!regionPoint) {
    const appPath = path.join(APP_BEACH_DIR, file);
    if (existsSync(appPath)) {
      const app = JSON.parse(readFileSync(appPath, 'utf8'));
      const coords = app?.island?.coordinates ?? app?.region?.coordinates ?? null;
      if (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lon)) regionPoint = coords;
    }
  }
  if (!regionPoint) regionsWithoutPoint.push(regionId);

  const payload = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
  for (const profile of Object.values(payload.profiles || {})) {
    if (!profile.coordinates || !profile.sectors) continue;
    // Exactly what resolveBeachMarinePoints resolves to: the beach's own sample point, else the
    // region point. Never the pin — the pin is only kept below as the before/after comparison.
    const requestPoint = profile.marineSamplePoint ?? regionPoint;
    beaches.push({ region: regionId, profile, requestPoint, viaSample: Boolean(profile.marineSamplePoint) });
  }
}

// ── Resolve every coordinate this audit needs to judge ───────────────────────
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
const wanted = [];
for (const { profile, requestPoint } of beaches) {
  wanted.push(profile.coordinates);
  if (requestPoint) wanted.push(requestPoint);
}
const outstanding = wanted.filter(point => !isPointResolved(cache, point));

console.log(`Marine cell trust audit  (models: ${MODELS.map(m => m.id).join(', ')})`);
console.log(`  beaches            ${beaches.length}`);
if (regionsWithoutPoint.length) {
  console.log(`  regions with no fallback point: ${regionsWithoutPoint.join(', ')}`);
}
console.log(`  coordinates needing a lookup: ${outstanding.length} of ${wanted.length} (rest cached)`);

const state = {};
if (outstanding.length) {
  await resolvePoints(cache, Number.isFinite(limit) ? outstanding.slice(0, limit) : outstanding, {
    state,
    onProgress: (done, total) => process.stdout.write(`\r  fetched ${done}/${total}`),
  });
  process.stdout.write('\n');
  if (state.quotaHit) {
    console.error('  STOPPED on an API quota reply. Partial results are cached; re-run to continue.');
  }
}
mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf8');

// ── Judge every beach ────────────────────────────────────────────────────────
const tally = key => ({ trusted: 0, 'other-water': 0, 'too-far': 0, unknown: 0, 'no-point': 0, _key: key });
const pinStats = tally('pin (before sample points)');
const prodStats = tally('production');
const sampleOnly = tally('  of which own sample point');
const regionOnly = tally('  of which region fallback');
const modelUsed = { ewam: 0, meteofrance_wave: 0, none: 0 };
const perBeach = [];
const worst = [];

for (const { region, profile, requestPoint, viaSample } of beaches) {
  const pin = judge(cache, profile, profile.coordinates);
  const prod = judge(cache, profile, requestPoint);
  pinStats[pin.verdict] += 1;
  prodStats[prod.verdict] += 1;
  (viaSample ? sampleOnly : regionOnly)[prod.verdict] += 1;
  modelUsed[prod.modelId ?? 'none'] += 1;

  const trusted = prod.verdict === 'trusted';
  perBeach.push({
    beachId: profile.beachId,
    region,
    name: profile.name?.gr || profile.name?.en || '',
    trusted,
    via: viaSample ? 'sample' : 'region',
    pinVerdict: pin.verdict,
    ...prod,
  });
  if (!trusted && prod.distanceKm) {
    worst.push({
      beachId: profile.beachId,
      region,
      name: profile.name?.gr || profile.name?.en || '',
      via: viaSample ? 'sample' : 'region',
      model: prod.modelId,
      verdict: prod.verdict,
      distanceKm: Number(prod.distanceKm.toFixed(1)),
      bearingDeg: Number((prod.bearingDeg ?? 0).toFixed(0)),
      fetchKm: Number((prod.fetchKm ?? 0).toFixed(2)),
    });
  }
}

/**
 * `no-point` must be impossible: every beach has either its own sample point or the region's.
 *
 * It is asserted rather than reported because it appeared ONCE, on 16/08/2026, in a run made
 * straight after the optimiser had been hammering the API — 72 region-fallback beaches came back
 * `no-point` and the next four runs, all fully cached, put the same 72 in `other-water`. A
 * measurement that silently reclassifies a seventh of its subjects between runs is worse than one
 * that fails, so this stops instead of printing a number nobody can trust.
 */
if (prodStats['no-point'] > 0) {
  console.error(`\n  ABORT: ${prodStats['no-point']} beaches resolved to NO request point at all.`);
  console.error('  Every beach must have its own sample point or fall back to the region point, so');
  console.error('  this means a region failed to load its coordinates. The verdict counts below');
  console.error('  would be wrong in a way that looks plausible. Re-run; if it persists, the app');
  console.error('  beach file for the affected region is unreadable.');
  process.exit(1);
}

const productionTrusted = perBeach.filter(b => b.trusted).length;
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;

console.log(`\n  request point                    trusted   other water   too far   unknown   no point`);
for (const s of [pinStats, prodStats, sampleOnly, regionOnly]) {
  console.log(`  ${s._key.padEnd(30)} ${String(s.trusted).padStart(7)} ${String(s['other-water']).padStart(13)} ${String(s['too-far']).padStart(9)} ${String(s.unknown).padStart(9)} ${String(s['no-point']).padStart(10)}`);
}
console.log(`\n  model that answers: ewam ${modelUsed.ewam}, meteofrance_wave ${modelUsed.meteofrance_wave}, neither ${modelUsed.none}`);
console.log(`\n  PRODUCTION: ${productionTrusted}/${beaches.length} beaches read water they actually face (${pct(productionTrusted, beaches.length)})`);
console.log(`  untrusted: ${beaches.length - productionTrusted} — these run on an imported number from somewhere else.`);

worst.sort((a, b) => (b.distanceKm - b.fetchKm) - (a.distanceKm - a.fetchKm));
console.log(`\n  worst offenders (distance to cell vs open fetch toward it):`);
for (const w of worst.slice(0, 10)) {
  console.log(`    #${String(w.beachId).padEnd(5)} ${w.name.slice(0, 24).padEnd(25)} cell ${String(w.distanceKm).padStart(5)} km @ ${String(w.bearingDeg).padStart(3)}°, fetch there ${String(w.fetchKm).padStart(5)} km  [${w.verdict}/${w.model}]`);
}

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  method: `fetchKm(bearing to served cell) >= ${MIN_FETCH_RATIO} x distance(beach, served cell), and distance <= ${MAX_TRUSTED_DISTANCE_KM} km — scripts/lib/marineCellTrust.mjs`,
  judgedAt: 'The coordinate the runtime requests: the beach marineSamplePoint, else the region '
    + 'point (MARINE_POINT_OVERRIDES, else island.coordinates). The pin column is the historical '
    + 'before-sample-points comparison and is NOT what production asks.',
  models: `Asked per model and judged on the one that answers first, mirroring `
    + `utils/marineForecastParsing.ts: ${MODELS.map(m => `${m.id} (${m.gridDeg.toFixed(4)}°)`).join(', ')}.`,
  supersedes: 'The 2026-07-27 run of this file, which sent no models= parameter and so measured '
    + "Open-Meteo's default rather than ewam, and which judged point-less beaches at their pin "
    + 'instead of the region point. Its headline figures (1410 pins / 524 effective untrusted) '
    + 'do not describe production and should not be quoted.',
  minFetchRatio: MIN_FETCH_RATIO,
  maxTrustedDistanceKm: MAX_TRUSTED_DISTANCE_KM,
  beaches: beaches.length,
  pin: pinStats,
  production: prodStats,
  ownSamplePoint: sampleOnly,
  regionFallback: regionOnly,
  modelUsed,
  productionTrusted,
  worst: worst.slice(0, 100),
}, null, 2)}\n`, 'utf8');
console.log(`\n  report: ${path.relative(root, REPORT_PATH)}`);

writeFileSync(PER_BEACH_PATH, `${JSON.stringify(perBeach.map(b => ({
  beachId: b.beachId,
  region: b.region,
  name: b.name,
  trusted: b.trusted,
  via: b.via,
  verdict: b.verdict,
  model: b.modelId ?? null,
  pinVerdict: b.pinVerdict,
  distanceKm: typeof b.distanceKm === 'number' ? Number(b.distanceKm.toFixed(2)) : null,
  bearingDeg: typeof b.bearingDeg === 'number' ? Number(b.bearingDeg.toFixed(0)) : null,
  fetchKm: typeof b.fetchKm === 'number' ? Number(b.fetchKm.toFixed(2)) : null,
})), null, 1)}\n`, 'utf8');
console.log(`  per-beach: ${path.relative(root, PER_BEACH_PATH)}`);

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
  console.log(`  NOTE: no runtime code reads marineCellTrusted yet. Baking it changes nothing a`);
  console.log(`  visitor sees until something consumes it.`);
}
