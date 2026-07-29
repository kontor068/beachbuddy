#!/usr/bin/env node
/**
 * Nearshore-slope audit for `waterDepth` — report only, never edits data.
 *
 * ---------------------------------------------------------------------------
 * WHY
 * ---------------------------------------------------------------------------
 * `waterDepth` (shallow / medium / deep) is stated on 2.546 of 2.547 source
 * records as prose with a one-line justification: no number, no measurement, no
 * source. It is a careful opinion, not an observation. It is also not
 * decorative — `scripts/buildBeachRegionData.mjs:513` turns it into
 * `familyFriendly = shallowWaters && organized`, which today marks 839 beaches
 * as suitable for families and feeds both the "Για παιδιά" filter and the
 * "Οικογενειακές" guide. An unverified guess already recommends beaches to
 * parents.
 *
 * The shore-surface field has an independent auditor (`auditBeachTerrain.mjs`,
 * OSM `surface`: 849 of 2.794 covered, 88,5% agreement). Depth had none.
 *
 * ---------------------------------------------------------------------------
 * DATA SOURCE
 * ---------------------------------------------------------------------------
 * EMODnet Bathymetry Digital Terrain Model (DTM) 2024, queried per beach via
 * the public `depth_profile` REST endpoint (1.000 samples along a transect).
 *
 *   EMODnet Bathymetry Consortium (2024). EMODnet Digital Bathymetry (DTM 2024).
 *   https://doi.org/10.12770/c7b53704-999d-4721-b1a3-04ec60c87238
 *   Grid resolution: 1/16 × 1/16 arc-minute ≈ 115 × 115 m.
 *   Built from 22.032 survey datasets contributed by 66 providers.
 *
 * THE RESOLUTION CONSTRAINT, STATED UP FRONT. One cell is ~115 m across. The
 * water a parent cares about — the first 20–30 m — is comfortably INSIDE a
 * single cell. Therefore this audit never reports a depth at 25 m or 50 m: any
 * such number would be interpolation dressed as measurement. Everything below
 * is expressed as a DISTANCE to a depth contour, which is a multiple of the cell
 * size and carries an honest ±115 m uncertainty.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MEASURED, AND WHY THIS QUANTITY
 * ---------------------------------------------------------------------------
 * Two quantities exist in the literature and they are NOT interchangeable:
 *
 *  - BEACH-FACE slope, measured between MSL and mean high water springs, i.e.
 *    the swash zone. Australian in-situ values tan β = 0.01–0.18, median by
 *    state 0.055–0.08 (Vos, K., Deng, W., Harley, M. D., Turner, I. L., and
 *    Splinter, K. D. M., 2022, "Beach-face slope dataset for Australia", Earth
 *    Syst. Sci. Data 14, 1345–1357, https://doi.org/10.5194/essd-14-1345-2022).
 *    This is the quantity that would actually answer "can my child stand up" —
 *    and at 115 m resolution WE CANNOT MEASURE IT. We do not pretend to.
 *
 *  - NEARSHORE slope, the cross-shore gradient of the subaqueous profile from
 *    MSL to the depth of closure. Derived globally from GEBCO at ~900 m by
 *    Athanasiou, P., van Dongeren, A., Giardino, A., Vousdoukas, M., Gaytan-
 *    Aguilar, S., and Ranasinghe, R. (2019), "Global distribution of nearshore
 *    slopes with implications for coastal retreat", Earth Syst. Sci. Data 11,
 *    1515–1529, https://doi.org/10.5194/essd-11-1515-2019.
 *    Global median 0,007; sandy coasts 0,01; 10th–90th percentile 0,001–0,565.
 *    **The Mediterranean is one of the three steepest regions on Earth, median
 *    0,014–0,025** — so a steep Greek reading is normal and must not, by
 *    itself, be treated as alarming. That paper also states the matching
 *    limitation: "at locations where the nearshore slopes are steep, the
 *    resolution of the bathymetry is not high enough to capture a large number
 *    of bathymetry points between the shoreline and the depth of closure".
 *
 * This audit measures the SECOND quantity, at ~8× finer resolution than the
 * published global dataset, and reports it as what it is.
 *
 * ---------------------------------------------------------------------------
 * WHY THE THRESHOLD IS OUR OWN DISTRIBUTION, NOT A LITERATURE NUMBER
 * ---------------------------------------------------------------------------
 * An earlier draft of this script classified beaches with hand-picked cut-offs
 * ("deeper than 2 m at 50 m out = not shallow"). Those numbers came from
 * nobody. Importing a published beach-face threshold instead would be worse: it
 * is a different quantity over a different span, so the comparison would be
 * invalid while looking rigorous.
 *
 * A national-percentile threshold was tried next and also failed, for an
 * instructive reason: the 10th percentile of "distance to the 5 m contour" came
 * out at 0 m, because on many transects the profile steps straight from a land
 * cell to a cell already deeper than 5 m. Ranking on a number that is mostly
 * ties is false precision.
 *
 * "5 m of water within one grid cell of the waterline" was tried third and is
 * also wrong — and a known beach proved it. Παραλία Σχινιά (id 32) is a byword
 * for wading-depth shallows, and that criterion flagged it. Its transect reads
 * −3,37 m at its own waterline, which does not exist there: a 115 m cell
 * straddling the shore contains no shoreline, its centre sits ~57 m offshore,
 * so the first wet value is already well out to sea. Every beach carries that
 * bias. It flagged 489 of 1.321.
 *
 * What survives: a per-beach verdict is taken ONLY where the profile spans
 * enough cells for the shoreline artifact to be diluted — a gradient resolvable
 * over >= 3 cells (345 m) that also sits in the steepest tenth of resolvable
 * profiles. That covers a minority of beaches, and saying so is the point.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS CAN AND CANNOT CONCLUDE
 * ---------------------------------------------------------------------------
 *  - CAN say, at POPULATION level, whether our labels carry information: if
 *    "shallow" beaches sit systematically further from the 5 m contour than
 *    "deep" ones, the field is not noise. This is the audit's strongest output.
 *  - CAN flag individual beaches, but only within the resolvable subset above.
 *  - CANNOT confirm that any beach is shallow, and CANNOT see the wading zone
 *    at all. Nothing here replaces someone standing in the water.
 *  - Unresolved transects are reported as unresolved — never silently counted
 *    as agreement.
 *
 *   node scripts/auditWaterDepth.mjs                # national run (cached)
 *   node scripts/auditWaterDepth.mjs --limit 60     # quick look
 *   node scripts/auditWaterDepth.mjs --region naxos
 *   node scripts/auditWaterDepth.mjs --refresh      # ignore cache
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const APP_DIR = path.join(ROOT, 'public', 'data', 'beaches', 'app');
const DETAIL_DIR = path.join(APP_DIR, 'detail');
const EXPOSURE_DIR = path.join(ROOT, 'public', 'data', 'geospatial', 'exposure');
const OUT_DIR = path.join(ROOT, 'reports', 'water-depth');
const CACHE = path.join(OUT_DIR, 'emodnet-profile-cache.json');
const API = 'https://rest.emodnet-bathymetry.eu/depth_profile';

const args = process.argv.slice(2);
const argValue = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const limit = argValue('--limit') ? Number(argValue('--limit')) : Infinity;
const regionFilter = (argValue('--region', '') || '').toLowerCase();
const refresh = args.includes('--refresh');

// --- Geometry of the measurement -------------------------------------------
// The transect starts INLAND of the pin, not at it.
//
// Started at the pin, 10% of beaches reported the 5 m contour at 0 m — which
// reads as a vertical cliff and is nothing of the sort: many beach pins sit a
// little offshore, so the profile simply began in deep water and there was no
// land→sea crossing to find. Beginning 250 m landward guarantees a real
// waterline, and a beach still wet at its landward end is reported as a pin
// placement problem rather than silently scored as steep.
const LANDWARD_M = 250;
const SEAWARD_M = 1200;         // far enough to cross the 10 m contour on most Greek coasts
const TRANSECT_M = LANDWARD_M + SEAWARD_M;
const SAMPLES = 1000;           // what the endpoint returns along the line
const M_PER_SAMPLE = TRANSECT_M / SAMPLES;
const CELL_M = 115;             // EMODnet DTM 2024 grid spacing
const MIN_SPAN_CELLS = 3;       // never derive a gradient from less than this
const CONTOURS_M = [2, 5, 10];  // depth contours whose distance we report

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

// --- Load beaches, bearings, and the family-friendly flag -------------------
const facingByBeach = new Map();
for (const file of fs.readdirSync(EXPOSURE_DIR).filter((f) => f.endsWith('.json'))) {
  const data = readJson(path.join(EXPOSURE_DIR, file));
  // `profiles` is an object keyed by beach id, not an array.
  const profiles = data?.profiles;
  for (const profile of profiles ? Object.values(profiles) : []) {
    if (typeof profile?.facingDeg === 'number') facingByBeach.set(String(profile.beachId ?? profile.id), profile.facingDeg);
  }
}

const familyByBeach = new Set();
if (fs.existsSync(DETAIL_DIR)) {
  for (const file of fs.readdirSync(DETAIL_DIR).filter((f) => f.endsWith('.json'))) {
    const data = readJson(path.join(DETAIL_DIR, file));
    // The detail tier puts `beaches` at the root — unlike the app tier, which
    // nests them under `island`. Reading the app shape here silently produced an
    // empty set, and the audit cheerfully reported "0 family-friendly beaches
    // affected" out of 489 candidates. A zero that convenient is a bug.
    for (const beach of data?.beaches || data?.island?.beaches || []) {
      if (beach?.environment?.familyFriendly === true) familyByBeach.add(String(beach.id));
    }
  }
}

const beaches = [];
for (const file of fs.readdirSync(APP_DIR).filter((f) => f.endsWith('.json'))) {
  const data = readJson(path.join(APP_DIR, file));
  const region = data?.island?.id || file.replace(/\.json$/, '');
  if (regionFilter && !String(region).toLowerCase().includes(regionFilter)) continue;
  for (const beach of data?.island?.beaches || []) {
    const { lat, lon } = beach.coordinates || {};
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    beaches.push({
      id: beach.id,
      name: beach.name?.en || String(beach.id),
      region,
      lat,
      lon,
      facingDeg: facingByBeach.get(String(beach.id)),
      stated: beach.waterDepth,
      beachType: beach.beachType,
      familyFriendly: familyByBeach.has(String(beach.id)),
    });
  }
}
beaches.sort((a, b) => a.id - b.id);
const work = beaches.slice(0, Number.isFinite(limit) ? limit : beaches.length);

// --- Fetch ------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });
const cache = !refresh && fs.existsSync(CACHE) ? readJson(CACHE) || {} : {};

const destination = (lat, lon, bearing, metres) => {
  const rad = (bearing * Math.PI) / 180;
  return {
    lat: lat + (metres * Math.cos(rad)) / 111320,
    lon: lon + (metres * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180)),
  };
};

const fetchProfile = async (beach) => {
  const key = String(beach.id);
  if (cache[key]) return cache[key];
  const start = destination(beach.lat, beach.lon, beach.facingDeg, -LANDWARD_M);
  const end = destination(beach.lat, beach.lon, beach.facingDeg, SEAWARD_M);
  const geom = `LINESTRING(${start.lon.toFixed(5)} ${start.lat.toFixed(5)},${end.lon.toFixed(5)} ${end.lat.toFixed(5)})`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?geom=${encodeURIComponent(geom)}`, { signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        const values = await res.json();
        if (Array.isArray(values) && values.length) { cache[key] = values; return values; }
        return null;
      }
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
      return null;
    } catch { await sleep(1500 * (attempt + 1)); }
  }
  return null;
};

/**
 * Turn one transect into distances-to-contour and a nearshore gradient.
 * EMODnet reports elevation: positive is land, negative is water.
 */
const readTransect = (values) => {
  const firstWet = values.findIndex((v) => typeof v === 'number' && v < 0);
  if (firstWet < 0) return { resolved: false, reason: 'no water along this bearing' };
  // Already wet at the landward end: the pin is offshore (or the bearing points
  // along the coast), so there is no waterline on this line to measure from.
  if (firstWet === 0) return { resolved: false, reason: `already in water ${LANDWARD_M} m landward of the pin — pin placement or bearing, not a profile`, pinOffshore: true };

  const wet = values.slice(firstWet).filter((v) => typeof v === 'number');
  const distinct = new Set(wet.map((v) => v.toFixed(3))).size;
  if (distinct < 2) return { resolved: false, reason: 'one flat cell offshore — no profile to read' };

  // Distance past the waterline at which each contour is first reached.
  const distanceTo = {};
  for (const contour of CONTOURS_M) {
    const index = values.findIndex((v, i) => i >= firstWet && typeof v === 'number' && -v >= contour);
    distanceTo[contour] = index < 0 ? null : Number(((index - firstWet) * M_PER_SAMPLE).toFixed(0));
  }

  // PRIMARY METRIC: how far you must go before the water is 5 m deep.
  //
  // The first draft made the gradient primary and discarded every beach whose
  // profile was too short to span 3 cells. On a 60-beach trial that threw away
  // 32 of 60 — and every one of them was discarded *for being steep*, i.e. the
  // audit was blind to exactly the beaches it exists to find. Athanasiou et al.
  // (2019) describe this same trap for their own dataset.
  //
  // Distance-to-contour has no such bias: it is a single crossing, honest to
  // ±115 m (one cell), and it is also the quantity a swimmer experiences —
  // "how far out before it is over my head".
  const swimOutM = distanceTo[5];
  if (swimOutM === null) {
    return {
      resolved: false,
      reason: `never reaches 5 m within ${TRANSECT_M} m of shore`,
      distanceTo,
      veryGentle: true,
    };
  }

  // The gradient stays as a secondary, comparable-to-literature figure, and is
  // only reported when the span genuinely covers several grid cells.
  let gradient = null;
  let gradientOver = null;
  for (const contour of [...CONTOURS_M].reverse()) {
    const distance = distanceTo[contour];
    if (distance && distance >= MIN_SPAN_CELLS * CELL_M) {
      gradient = Number((contour / distance).toFixed(4));
      gradientOver = contour;
      break;
    }
  }

  return {
    resolved: true,
    waterlineAtM: Number((firstWet * M_PER_SAMPLE).toFixed(0)),
    distanceTo,
    swimOutM,
    // Below one cell we cannot distinguish "20 m" from "115 m" — say so rather
    // than printing a precise-looking number.
    swimOutBelowCell: swimOutM < CELL_M,
    gradient,
    gradientOver,
  };
};

// --- Run --------------------------------------------------------------------
const results = [];
const tally = { resolved: 0, unresolved: 0, noFacing: 0, fetchFailed: 0, veryGentle: 0, pinOffshore: 0 };
let done = 0;

for (const beach of work) {
  done++;
  if (typeof beach.facingDeg !== 'number') { tally.noFacing++; continue; }

  const wasCached = Boolean(cache[String(beach.id)]);
  const values = await fetchProfile(beach);
  if (!wasCached) await sleep(120);
  if (!values) { tally.fetchFailed++; continue; }

  const read = readTransect(values);
  results.push({ ...beach, ...read });
  if (read.resolved) tally.resolved++;
  else { tally.unresolved++; if (read.veryGentle) tally.veryGentle++; if (read.pinOffshore) tally.pinOffshore++; }

  if (done % 100 === 0) {
    process.stdout.write(`  ${done}/${work.length} · resolved ${tally.resolved} · unresolved ${tally.unresolved}\r`);
    fs.writeFileSync(CACHE, JSON.stringify(cache), 'utf8');
  }
}
fs.writeFileSync(CACHE, JSON.stringify(cache), 'utf8');

// --- Reference distribution: our own coast, not an imported constant --------
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Number((sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)).toFixed(4));
};
const resolved = results.filter((r) => r.resolved);
const swimOuts = resolved.map((r) => r.swimOutM).sort((a, b) => a - b);
const sp = Object.fromEntries([10, 25, 50, 75, 90].map((n) => [n, quantile(swimOuts, n / 100)]));
const gradients = resolved.filter((r) => r.gradient !== null).map((r) => r.gradient).sort((a, b) => a - b);
const gp = Object.fromEntries([10, 50, 90].map((n) => [n, quantile(gradients, n / 100)]));

// THE FLAG — and the fourth method this script threw away.
//
// "5 m of water within one grid cell of the waterline" was tried and it is
// WRONG, proven by a beach everyone in Greece knows. Παραλία Σχινιά (id 32) is
// a byword for wading-depth shallows, and it was flagged. Its transect shows
// why: the first wet sample is already −3,37 m, at the waterline. No such drop
// exists there. A 115 m cell straddling the shore has no shoreline in it — its
// centre sits ~57 m offshore, so the first wet value is the depth well out to
// sea, not at the water's edge. Every beach inherits that bias, which is
// precisely the limitation Athanasiou et al. (2019) describe.
//
// So a per-beach verdict is only taken where the profile spans enough cells for
// the shoreline artifact to be diluted: the gradient must be resolvable over
// >= 3 cells (345 m) AND sit in the steepest tenth of those resolvable
// profiles. Everything else is reported as measured-but-not-conclusive.
const gradientP90 = quantile(gradients, 0.9);
const flagged = resolved.filter((r) => r.stated === 'shallow' && r.gradient !== null && gradientP90 !== null && r.gradient >= gradientP90);
const flaggedFamily = flagged.filter((r) => r.familyFriendly);

console.log(`\n\n=== Nearshore audit · ${work.length} beaches`);
console.log(`  measured (reach 5 m within ${TRANSECT_M} m)   ${tally.resolved}`);
console.log(`  never reach 5 m — very gentle shelf           ${tally.veryGentle}`);
console.log(`  unreadable transect                          ${tally.unresolved - tally.veryGentle}`);
console.log(`  no facing bearing                            ${tally.noFacing}`);
console.log(`  fetch failed                                 ${tally.fetchFailed}`);

if (swimOuts.length) {
  console.log(`\nHow far out before the water is 5 m deep (n=${swimOuts.length}, ±${CELL_M} m):`);
  console.log(`  p10 ${sp[10]}m · p25 ${sp[25]}m · MEDIAN ${sp[50]}m · p75 ${sp[75]}m · p90 ${sp[90]}m`);
}
if (gradients.length) {
  console.log(`\nNearshore gradient where the span covers >=${MIN_SPAN_CELLS} cells (n=${gradients.length}):`);
  console.log(`  p10 ${gp[10]} · MEDIAN ${gp[50]} · p90 ${gp[90]}`);
  console.log(`  Reference — Athanasiou et al. 2019 (ESSD 11, 1515–1529): global median 0.007,`);
  console.log(`  sandy coasts 0.01, Mediterranean among the three steepest regions at 0.014–0.025.`);
  console.log(`  A median inside that band is the sanity check that this method is measuring`);
  console.log(`  the right physical quantity. It is NOT a test of our own depth labels.`);
}

// The decisive question: does our stated label track the seabed at all?
const byStated = {};
for (const r of resolved) (byStated[r.stated] ||= []).push(r.swimOutM);
console.log(`\nDistance to 5 m, split by the depth we STATE — if the labels carry`);
console.log(`information, "shallow" must sit further out than "deep":`);
for (const label of ['shallow', 'medium', 'deep']) {
  const list = byStated[label];
  if (!list?.length) continue;
  const s = [...list].sort((a, b) => a - b);
  console.log(`  ${label.padEnd(8)} n=${String(s.length).padStart(4)}  median ${quantile(s, 0.5)}m   p25 ${quantile(s, 0.25)}m   p75 ${quantile(s, 0.75)}m`);
}
const shallowMedian = byStated.shallow ? quantile([...byStated.shallow].sort((a, b) => a - b), 0.5) : null;
const deepMedian = byStated.deep ? quantile([...byStated.deep].sort((a, b) => a - b), 0.5) : null;

/**
 * Is the ordering real, or could this much separation arise by chance?
 *
 * Two statistics, because they answer different questions and only together do
 * they justify a decision:
 *
 *  - A permutation test on the median difference gives the p-value: could the
 *    labels be shuffled at random and still separate this well? It is used
 *    instead of a t-test because these distributions are heavily skewed and
 *    bounded at zero.
 *  - The common-language effect size (the Mann-Whitney U statistic divided by
 *    n1*n2) gives the size: pick one "shallow" beach and one "deep" beach at
 *    random — how often is the shallow one genuinely further from the 5 m
 *    contour? 0,5 is a coin flip.
 *
 * A tiny p-value with an effect size near 0,5 means "real but nearly useless
 * per beach", which is exactly the case a large sample can hide.
 */
const commonLanguageEffect = (a, b) => {
  const combined = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0]);
  const ranks = new Array(combined.length).fill(0);
  for (let i = 0; i < combined.length;) {
    let j = i;
    while (j + 1 < combined.length && combined[j + 1][0] === combined[i][0]) j++;
    const averaged = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = averaged;
    i = j + 1;
  }
  const rankSumA = combined.reduce((sum, [, group], i) => (group === 0 ? sum + ranks[i] : sum), 0);
  return (rankSumA - (a.length * (a.length + 1)) / 2) / (a.length * b.length);
};

const permutationP = (a, b, observed, iterations = 20000) => {
  const pool = [...a, ...b];
  const median = (v) => { const s = [...v].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // Deterministic generator (mulberry32) — a fixed seed keeps the reported
  // p-value reproducible across runs, which a Math.random() would not.
  let seed = 20260729;
  const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let atLeastAsExtreme = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    if (median(pool.slice(0, a.length)) - median(pool.slice(a.length)) >= observed) atLeastAsExtreme++;
  }
  return (atLeastAsExtreme + 1) / (iterations + 1);
};

let significance = null;
if (byStated.shallow?.length && byStated.deep?.length) {
  const observed = shallowMedian - deepMedian;
  const effect = commonLanguageEffect(byStated.shallow, byStated.deep);
  const pValue = permutationP(byStated.shallow, byStated.deep, observed);
  significance = { observedMedianDifferenceM: observed, commonLanguageEffectSize: Number(effect.toFixed(3)), permutationP: pValue };
  console.log(`  → "shallow" sits ${observed > 0 ? 'FURTHER OUT' : 'NOT further out'} than "deep" by ${observed} m`);
  console.log(`\nIs that real, and is it big enough to act on?`);
  console.log(`  permutation test (20.000 shuffles, fixed seed) : p = ${pValue < 0.0001 ? '< 0.0001' : pValue.toFixed(5)}`);
  console.log(`  effect size — P(random "shallow" is further out) : ${effect.toFixed(3)}   (0.500 = coin flip)`);
  console.log(`  READ IT AS: the labels are not noise, but per single beach they are only`);
  console.log(`  a little better than a coin flip. Enough to keep the field; NOT enough to`);
  console.log(`  print "shallow water" next to a beach name, and thin ground for the`);
  console.log(`  familyFriendly flag that ${familyByBeach.size} beaches currently carry.`);
}

const statedShallow = resolved.filter((r) => r.stated === 'shallow').length;
const shallowResolvable = resolved.filter((r) => r.stated === 'shallow' && r.gradient !== null).length;
console.log(`\n>>> STATED SHALLOW, YET IN THE STEEPEST TENTH OF RESOLVABLE PROFILES (gradient >= ${gradientP90}):`);
console.log(`    ${flagged.length} beaches. Of the ${statedShallow} we call shallow, only ${shallowResolvable} have a`);
console.log(`    profile this grid can resolve at all — the rest are not judged, by design.`);
console.log(`>>> of those, currently flagged family-friendly: ${flaggedFamily.length}`);
for (const r of flaggedFamily.slice(0, 30)) {
  console.log(`    ${String(r.id).padEnd(6)} ${r.name.slice(0, 32).padEnd(32)} ${r.region.slice(0, 22).padEnd(22)} 5m within ${r.swimOutM < CELL_M ? '<' + CELL_M : r.swimOutM}m`);
}

const reportPath = path.join(OUT_DIR, `report-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: {
    dataset: 'EMODnet Bathymetry Digital Terrain Model (DTM) 2024',
    doi: 'https://doi.org/10.12770/c7b53704-999d-4721-b1a3-04ec60c87238',
    gridResolutionM: CELL_M,
    endpoint: API,
  },
  method: {
    primaryMetric: 'horizontal distance from the waterline to the 5 m depth contour',
    secondaryMetric: 'nearshore gradient (subaqueous), NOT beach-face slope',
    transectM: TRANSECT_M,
    contoursM: CONTOURS_M,
    minSpanM: MIN_SPAN_CELLS * CELL_M,
    flagCriterion: 'stated shallow AND a gradient resolvable over >=3 cells that sits in the steepest decile of resolvable profiles',
    rejectedCriteria: [
      'hand-picked depth cut-offs (2 m at 50 m) - not sourced from anywhere',
      'imported beach-face slope thresholds - a different quantity over a different span',
      'p10 of distance-to-5m - degenerate, p10 = 0 m because of grid ties',
      '5 m within one cell of the waterline - false-positives on known-shallow beaches (Schinias id 32 reads -3.37 m at its own waterline)',
    ],
    references: [
      'Athanasiou et al. (2019), Global distribution of nearshore slopes with implications for coastal retreat, ESSD 11, 1515-1529, doi:10.5194/essd-11-1515-2019',
      'Vos et al. (2022), Beach-face slope dataset for Australia, ESSD 14, 1345-1357, doi:10.5194/essd-14-1345-2022',
    ],
  },
  caveat: 'At 115 m grid spacing the wading zone (first 20-30 m) sits inside one cell. Agreement is weak evidence and cannot certify a beach as shallow; only the steep-tail contradictions are actionable, and each still needs a human or local check before any data edit.',
  distribution: {
    distanceTo5m: { n: swimOuts.length, percentiles: sp },
    gradient: { n: gradients.length, percentiles: gp },
    distanceTo5mByStatedLabel: Object.fromEntries(Object.entries(byStated).map(([k, v]) => {
      const s = [...v].sort((a, b) => a - b);
      return [k, { n: s.length, p25: quantile(s, 0.25), median: quantile(s, 0.5), p75: quantile(s, 0.75) }];
    })),
  },
  significance,
  tally,
  flagged: flagged.map((r) => ({ id: r.id, name: r.name, region: r.region, familyFriendly: r.familyFriendly, swimOutM: r.swimOutM, distanceTo: r.distanceTo })),
  results,
}, null, 1), 'utf8');
console.log(`\nReport: ${path.relative(ROOT, reportPath)}`);
