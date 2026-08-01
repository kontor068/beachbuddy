/**
 * WHAT THE REGION WIND HIDES AND RE-RANKS — a measurement, not a gate.
 *
 * The map stopped painting from one wind per region on 01/08/2026. Four decisions did not move
 * with it, and they are heavier than a colour, because they change WHICH beaches a person is
 * shown at all:
 *
 *   ≥5 Bft  App.tsx shouldHideBoatAccessBeaches / BeachSearcherHome hideBoatOnly
 *           — boat-only beaches are REMOVED from the directory.
 *   ≥5 Bft  topPickRanking.prioritizeProtectedRecommendations
 *           — exposure outranks score outright: one Beaufort flips the podium.
 *   ≥3 Bft  recommendationService.isTrustedTopRecommendationCandidate
 *           — every beach with an unknown wind profile is thrown out of the recommendations.
 *   <4 Bft  App.effectiveSortBy — the wind filter switches itself off. Region-wide by nature,
 *           so it is reported separately rather than per beach.
 *
 * All of them read ONE Beaufort for the whole region. This script asks the real forecast how
 * often that number sits on the wrong side of 3 and 5 for a specific beach, and splits the
 * answer into the two directions, which are not equally bad:
 *
 *   UNFAIR   the region says ≥5, the beach's own shore is calmer — a beach is hidden or demoted
 *            on a day it was fine. Costs us trust and traffic.
 *   UNSAFE   the region says <5, the beach's own shore is blowing — we keep recommending a boat
 *            trip, or put a windy beach on the podium. Costs someone their day, or worse.
 *
 * The thresholds and the boat-only test are imported from the shipped code, never re-typed, so
 * this measurement cannot quietly describe a version of the app that does not exist — the defect
 * scripts/validateColourAgainstRealWind.mjs was itself found to have.
 *
 * Report only: it prints, it never fails a build.
 *
 * Run: node scripts/measureRegionWindGating.mjs [--national]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { hasBoatOnlyAccess } = require(path.join(root, 'utils/access.ts'));
const {
  PROTECTED_FIRST_BEAUFORT,
  MEANINGFUL_WIND_TOP_PICK_BEAUFORT,
} = require(path.join(root, 'services/topPickRanking.ts'));

const beachDir = path.join(root, 'public/data/beaches/app');
const HOURS = ['T08:00', 'T11:00', 'T17:00'];
const BEAUFORT_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const toBeaufort = (kmh) => {
  let b = 0;
  for (let i = 0; i < BEAUFORT_KMH.length; i += 1) if (kmh >= BEAUFORT_KMH[i]) b = i + 1;
  return b;
};
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const national = process.argv.includes('--national');

const regions = readdirSync(beachDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const id = f.replace(/\.json$/, '');
    let raw;
    try { raw = readJson(path.join(beachDir, f)); } catch { return null; }
    const beaches = raw.island?.beaches ?? [];
    const centre = raw.island?.coordinates;
    if (!beaches.length || !centre) return null;
    return { id, beaches, centre };
  })
  .filter(Boolean);

const sample = national ? regions : [...regions].sort((a, b) => b.beaches.length - a.beaches.length).slice(0, 12);

console.log('What the region wind hides and re-ranks');
console.log(`Regions: ${sample.length}${national ? ' (national)' : ' (12 largest)'} · hours: ${HOURS.join(', ')}`);
console.log(`Thresholds read from the shipped code: hide/podium ${PROTECTED_FIRST_BEAUFORT} Bft · `
  + `trusted-candidate ${MEANINGFUL_WIND_TOP_PICK_BEAUFORT} Bft\n`);

// ── Network. Same shape as the truth gate: one deduplicated sweep, paced under Open-Meteo's
// per-point minute limit, retried with backoff, and a request that will not answer is fatal —
// a partial measurement that prints a total is the failure mode this whole day was about.
const POINTS_PER_REQUEST = 32;
const POINTS_PER_MINUTE = 450;
const FETCH_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 60_000;
const sleep = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });

const pointKey = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const points = new Map();
const requirePoint = (lat, lon) => {
  const key = pointKey(lat, lon);
  if (!points.has(key)) points.set(key, { key, lat, lon, hourly: null });
  return key;
};

const plans = [];
const skipped = [];
for (const region of sample) {
  const clusters = buildBeachForecastClusters(region.beaches);
  if (!clusters.length) { skipped.push(region.id); continue; }
  plans.push({
    region,
    clusters,
    centreKey: requirePoint(region.centre.lat, region.centre.lon),
    clusterKeys: clusters.map(c => requirePoint(c.lat, c.lon)),
  });
}

const fetchJsonWithBackoff = async (url) => {
  let wait = 10_000;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    let response = null;
    let transportError = null;
    try { response = await fetch(url); } catch (error) { transportError = error; }
    if (response?.ok) return response.json();
    const reason = transportError ? transportError.message : `Open-Meteo HTTP ${response.status}`;
    const retryable = transportError !== null || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === FETCH_ATTEMPTS) throw new Error(`${reason} (after ${attempt} attempts)`);
    console.log(`   … ${reason} — retrying in ${wait / 1000}s`);
    await sleep(wait);
    wait = Math.min(wait * 2, MAX_BACKOFF_MS);
  }
  throw new Error('unreachable');
};

const allPoints = [...points.values()];
const requestCount = Math.ceil(allPoints.length / POINTS_PER_REQUEST);
const paceMs = Math.round((POINTS_PER_REQUEST / POINTS_PER_MINUTE) * 60_000);
console.log(`Wind points: ${allPoints.length} → ${requestCount} requests, paced ${(paceMs / 1000).toFixed(1)}s apart\n`);

for (let i = 0; i < allPoints.length; i += POINTS_PER_REQUEST) {
  const chunk = allPoints.slice(i, i + POINTS_PER_REQUEST);
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${chunk.map(p => p.lat.toFixed(4)).join(',')}`
    + `&longitude=${chunk.map(p => p.lon.toFixed(4)).join(',')}`
    + '&hourly=wind_speed_10m,wind_direction_10m&timezone=Europe%2FAthens'
    + '&forecast_days=2&wind_speed_unit=kmh';
  let body;
  try {
    body = await fetchJsonWithBackoff(url);
  } catch (error) {
    console.error(`\nSTOPPED: could not read the real wind — ${error.message}`);
    console.error('No partial totals are printed: half a measurement reads like a whole one.');
    process.exit(1);
  }
  const locations = Array.isArray(body) ? body : [body];
  if (locations.length !== chunk.length) {
    console.error(`\nSTOPPED: asked for ${chunk.length} points, got ${locations.length}.`);
    process.exit(1);
  }
  locations.forEach((location, k) => { chunk[k].hourly = location.hourly; });
  const done = Math.min(i + POINTS_PER_REQUEST, allPoints.length);
  if (process.stdout.isTTY) process.stdout.write(`\r   fetched ${done}/${allPoints.length} points`);
  if (done < allPoints.length) await sleep(paceMs);
}
if (process.stdout.isTTY) process.stdout.write('\n');

const seriesAt = (key, hour) => {
  const h = points.get(key).hourly;
  const idxs = h.time.map((t, k) => (t.endsWith(hour) ? k : -1)).filter(k => k >= 0);
  const t = idxs[idxs.length - 1];
  return { kmh: h.wind_speed_10m[t], when: h.time[t] };
};

// ── The measurement.
const tally = {
  beachHours: 0,
  boatBeachHours: 0,
  hideUnfair: 0,        // region ≥5, beach calmer — removed from the directory for nothing
  hideUnsafe: 0,        // region <5, beach blowing — boat trip still recommended
  podiumUnfair: 0,      // region ≥5, beach calmer — demoted below sheltered beaches
  podiumUnsafe: 0,      // region <5, beach blowing — can still win the podium on score
  trustedUnfair: 0,     // region ≥3, beach calmer — thrown out of recommendations for nothing
  trustedUnsafe: 0,     // region <3, beach blowing — kept in with no wind evidence required
  sortFilterOffWhileWindy: 0, // region <4 (filter disabled) while this beach has ≥4
  gap1: 0,                    // |region - beach| >= 1 Bft
  gap2: 0,                    // >= 2 Bft
  regionCalmBeachBlowing: 0,  // region <=3 while this shore is >=5 — the two-step miss
};
/**
 * A calm day answers only about a calm day. The hide-at-5 rule cannot fire when no region centre
 * reaches 5 Bft, so on a day like this the boat-only counters read 0 and mean nothing about the
 * rule — only about today. The gap counters below are the part that does not depend on the
 * weather being interesting: they say how far apart the two numbers are at all.
 */
const boatOnlyBeaches = new Set();
const affectedBeaches = new Set();
const boatUnsafeExamples = [];
const perRegion = [];

for (const plan of plans) {
  const { region, clusters } = plan;
  const clusterOfBeach = new Map();
  clusters.forEach((c, index) => c.beachIds.forEach(id => clusterOfBeach.set(id, index)));

  const regionRow = { id: region.id, beaches: region.beaches.length, boat: 0, hideUnfair: 0, hideUnsafe: 0, podiumUnfair: 0, podiumUnsafe: 0 };

  for (const hour of HOURS) {
    const regionBft = toBeaufort(seriesAt(plan.centreKey, hour).kmh);

    for (const beach of region.beaches) {
      const clusterIndex = clusterOfBeach.get(beach.id);
      if (clusterIndex === undefined) continue;
      const local = seriesAt(plan.clusterKeys[clusterIndex], hour);
      const localBft = toBeaufort(local.kmh);
      const boatOnly = hasBoatOnlyAccess(beach);

      tally.beachHours += 1;
      if (boatOnly) { tally.boatBeachHours += 1; boatOnlyBeaches.add(beach.id); }

      const gap = Math.abs(regionBft - localBft);
      if (gap >= 1) tally.gap1 += 1;
      if (gap >= 2) tally.gap2 += 1;
      if (regionBft <= 3 && localBft >= PROTECTED_FIRST_BEAUFORT) tally.regionCalmBeachBlowing += 1;

      const regionHides = regionBft >= PROTECTED_FIRST_BEAUFORT;
      const beachDeserves = localBft >= PROTECTED_FIRST_BEAUFORT;
      if (regionHides !== beachDeserves) {
        affectedBeaches.add(beach.id);
        if (regionHides) {
          tally.podiumUnfair += 1;
          regionRow.podiumUnfair += 1;
          if (boatOnly) { tally.hideUnfair += 1; regionRow.hideUnfair += 1; }
        } else {
          tally.podiumUnsafe += 1;
          regionRow.podiumUnsafe += 1;
          if (boatOnly) {
            tally.hideUnsafe += 1;
            regionRow.hideUnsafe += 1;
            if (boatUnsafeExamples.length < 12) {
              boatUnsafeExamples.push({
                region: region.id,
                beach: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
                when: local.when,
                regionBft,
                localBft,
              });
            }
          }
        }
      }

      const regionTrusts = regionBft >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT;
      const beachTrusts = localBft >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT;
      if (regionTrusts !== beachTrusts) {
        affectedBeaches.add(beach.id);
        if (regionTrusts) tally.trustedUnfair += 1; else tally.trustedUnsafe += 1;
      }

      if (regionBft < 4 && localBft >= 4) tally.sortFilterOffWhileWindy += 1;
      if (boatOnly) regionRow.boat += 1;
    }
  }

  perRegion.push(regionRow);
}

const pct = (n) => `${((n / Math.max(1, tally.beachHours)) * 100).toFixed(1)}%`;

console.log(`Beach-hours measured: ${tally.beachHours} · boat-only beaches in range: ${boatOnlyBeaches.size}`);
console.log(`Region number vs this shore: ${tally.gap1} beach-hours differ by ≥1 Bft (${pct(tally.gap1)}), `
  + `${tally.gap2} by ≥2 (${pct(tally.gap2)}) · region ≤3 while the shore blows ≥5: ${tally.regionCalmBeachBlowing}`);
if (skipped.length) console.log(`Regions with no clusters, not measured: ${skipped.join(', ')}`);
console.log(`Distinct beaches on the wrong side of a threshold at least once: ${affectedBeaches.size}\n`);

console.log(`≥${PROTECTED_FIRST_BEAUFORT} Bft — BOAT-ONLY BEACHES HIDDEN FROM THE DIRECTORY`);
console.log(`   hidden though their own shore is calmer : ${tally.hideUnfair}`);
console.log(`   still shown though their own shore blows: ${tally.hideUnsafe}`);
console.log(`≥${PROTECTED_FIRST_BEAUFORT} Bft — PODIUM: exposure outranks score`);
console.log(`   demoted though calmer                   : ${tally.podiumUnfair} (${pct(tally.podiumUnfair)})`);
console.log(`   can still win though windy              : ${tally.podiumUnsafe} (${pct(tally.podiumUnsafe)})`);
console.log(`≥${MEANINGFUL_WIND_TOP_PICK_BEAUFORT} Bft — RECOMMENDATIONS: unknown wind profile thrown out`);
console.log(`   excluded though calmer                  : ${tally.trustedUnfair} (${pct(tally.trustedUnfair)})`);
console.log(`   kept with no evidence though windy      : ${tally.trustedUnsafe} (${pct(tally.trustedUnsafe)})`);
console.log(`<4 Bft — the wind filter switches itself off region-wide`);
console.log(`   beach-hours at ≥4 Bft while it is off   : ${tally.sortFilterOffWhileWindy} (${pct(tally.sortFilterOffWhileWindy)})`);

if (boatUnsafeExamples.length) {
  console.log(`\nBoat-only beaches still offered while their own water blows:`);
  for (const e of boatUnsafeExamples) {
    console.log(`   ${e.region} · ${e.beach} · ${e.when} → region ${e.regionBft} Bft, this shore ${e.localBft} Bft`);
  }
}

const worst = [...perRegion].sort((a, b) => (b.podiumUnfair + b.podiumUnsafe) - (a.podiumUnfair + a.podiumUnsafe)).slice(0, 15);
console.log(`\nWorst regions by podium threshold disagreement:`);
console.log(`   ${'region'.padEnd(42)}  beaches  demoted-though-calmer  windy-but-eligible`);
for (const r of worst) {
  console.log(`   ${r.id.padEnd(42)}  ${String(r.beaches).padStart(7)}  ${String(r.podiumUnfair).padStart(21)}  ${String(r.podiumUnsafe).padStart(18)}`);
}

const outDir = path.join(root, 'reports', 'region-wind-gating');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, national ? 'national.json' : 'sample.json');
writeFileSync(outPath, JSON.stringify({ thresholds: { PROTECTED_FIRST_BEAUFORT, MEANINGFUL_WIND_TOP_PICK_BEAUFORT }, hours: HOURS, tally, perRegion, boatUnsafeExamples }, null, 2));
console.log(`\nReport: ${outPath}`);
