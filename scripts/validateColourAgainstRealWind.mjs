/**
 * THE MAP'S COLOURS AGAINST THE REAL WIND — truth gate.
 *
 * Every other gate in this project checks SELF-CONSISTENCY: does the pin agree with the chip,
 * does the word agree with the graphic, does the legend agree with the map. Twenty of them pass
 * green, and on 01/08/2026 all twenty passed green over this:
 *
 *   Sounio and Legrena, tomorrow, 5 Bft all day — painted BLUE, "Ιδανική".
 *
 * Consistency without truth is worse than disagreement, because a defect every surface repeats
 * in one voice looks like a working system. This gate is the only one that leaves the building:
 * it fetches the actual forecast for the actual coordinates each beach's cluster asks about, and
 * asks whether the colour we would paint is a lie.
 *
 * WHY IT IS NOT IN quality:critical. That suite is offline and deterministic — same input, same
 * answer, forever. This one needs the network and its answer changes with the weather. Run it by
 * hand, or once a day. A gate that only runs when the sea is calm is worth nothing, so the
 * failure list prints the region and hour, and the numbers are reproducible from the output.
 *
 * A GATE THAT SKIPS IS A GATE THAT LIES. The first national run of this file hit Open-Meteo's
 * rate limit, dropped dozens of regions on the floor with a one-line SKIPPED, and printed PASSED
 * underneath — the same defect it exists to catch, in miniature. So: every request is retried with
 * backoff, a request that still fails ends the run with exit 1 (never a pass), the whole country's
 * points go out in ONE batched sweep of ~30 requests instead of 110 in a burst, and the number of
 * regions actually verified is printed on the final line where it cannot be missed.
 *
 * Run: node scripts/validateColourAgainstRealWind.mjs [--national]
 */
import { readFileSync, readdirSync } from 'node:fs';
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

// THE shipped code, not a copy. utils/beachForecastClusters.ts exists as its own module for
// exactly this reason (see the note at the top of it): scripts/validateEffectiveRanking.ts
// records a gate that passed green against sabotaged code because it re-implemented its subject.
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const beachDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

/**
 * The wind at which a shore stops being swimmable-by-default. Same number the app itself uses:
 * from 5 Bft resolveWindTone can no longer return a calm tone for any exposure, so a calm pin
 * above a real 5 Bft is not a matter of taste — it is the ladder being fed the wrong wind.
 */
const CALM_LIE_BEAUFORT = 5;
/** Tones the user reads as "go" — see utils/suitabilityTone.CALMNESS_ORDER. */
const CALM_TONES = new Set(['blue', 'green']);
/** Sampled hours (Athens). Morning, midday, late afternoon — the day people actually plan. */
const HOURS = ['T08:00', 'T11:00', 'T17:00'];
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const BEAUFORT_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const toBeaufort = (kmh) => {
  let b = 0;
  for (let i = 0; i < BEAUFORT_KMH.length; i += 1) if (kmh >= BEAUFORT_KMH[i]) b = i + 1;
  return b;
};
const sectorOf = (deg) => SECTORS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/**
 * Control regions are small islands where one wind point is genuinely enough. They must PASS.
 * If they ever fail, the gate is measuring noise rather than the defect.
 */
const CONTROL = new Set(['south-aegean-naxos', 'ionian-islands-corfu', 'south-aegean-mykonos', 'south-aegean-sifnos', 'south-aegean-folegandros']);

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

const sample = national
  ? regions
  : [
    ...[...regions].sort((a, b) => b.beaches.length - a.beaches.length).slice(0, 10),
    ...regions.filter(r => CONTROL.has(r.id)),
  ].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);

console.log(`Truth gate — the map's colours against the real wind`);
console.log(`Regions: ${sample.length}${national ? ' (national)' : ' (10 largest + controls)'} · hours: ${HOURS.join(', ')}`);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — plan every region before a single request goes out.
//
// The old shape fetched inside the region loop: 110 regions, one burst each, guaranteed 429 on a
// national run. Planning first means the whole country is ONE deduplicated point list, and a
// region can never be quietly dropped because its own little fetch failed.
// ─────────────────────────────────────────────────────────────────────────────
const pointKey = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const points = new Map();
const requirePoint = (lat, lon) => {
  const key = pointKey(lat, lon);
  if (!points.has(key)) points.set(key, { key, lat, lon, hourly: null });
  return key;
};

const plans = [];
/** Regions the gate could NOT speak for. Never silent, never a pass — see the report below. */
const unverified = [];

for (const region of sample) {
  let profiles = {};
  try { profiles = readJson(path.join(exposureDir, `${region.id}.json`)).profiles ?? {}; } catch { /* no geometry */ }

  const clusters = buildBeachForecastClusters(region.beaches);
  if (!clusters.length) {
    unverified.push({ id: region.id, why: 'no forecast clusters — beaches without coordinates' });
    continue;
  }
  if (!Object.keys(profiles).length) {
    unverified.push({ id: region.id, why: `no exposure geometry (${exposureDir}/${region.id}.json)` });
    continue;
  }

  plans.push({
    region,
    profiles,
    clusters,
    centreKey: requirePoint(region.centre.lat, region.centre.lon),
    clusterKeys: clusters.map(c => requirePoint(c.lat, c.lon)),
    spread: 0,
    checked: 0,
    failures: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — one batched sweep, with retries. A request that will not answer is fatal.
// ─────────────────────────────────────────────────────────────────────────────
const POINTS_PER_REQUEST = 32;
const FETCH_ATTEMPTS = 6;
/**
 * MEASURED, not guessed. Open-Meteo's free tier bills a multi-point request as one call PER POINT
 * and allows roughly 600 per minute, so a national sweep (813 points) physically cannot fit inside
 * one minute — batching alone was never going to be enough, and the run that "passed" on 01/08 was
 * a run that had been rate-limited into skipping. Pacing to 450 points/min leaves headroom and
 * costs about 110 seconds nationally, which is the correct price for an answer that is true.
 */
const POINTS_PER_MINUTE = 450;
/** Rate-limit windows are per minute, so backoff has to be able to outlast one. */
const MAX_BACKOFF_MS = 60_000;
const sleep = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });

const fetchJsonWithBackoff = async (url) => {
  let wait = 10_000;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    let response = null;
    let transportError = null;
    try { response = await fetch(url); } catch (error) { transportError = error; }
    if (response?.ok) return response.json();

    const reason = transportError ? transportError.message : `Open-Meteo HTTP ${response.status}`;
    // 429 is the rate limit and 5xx is their side; a 4xx of ours will not heal by waiting.
    const retryable = transportError !== null || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === FETCH_ATTEMPTS) {
      throw new Error(`${reason} (after ${attempt} attempt${attempt === 1 ? '' : 's'})`);
    }
    console.log(`   … ${reason} — retrying in ${wait / 1000}s`);
    await sleep(wait);
    wait = Math.min(wait * 2, MAX_BACKOFF_MS);
  }
  throw new Error('unreachable');
};

const allPoints = [...points.values()];
const requestCount = Math.ceil(allPoints.length / POINTS_PER_REQUEST);
const paceMs = Math.round((POINTS_PER_REQUEST / POINTS_PER_MINUTE) * 60_000);
console.log(`Wind points: ${allPoints.length} unique (region centres + beach clusters) `
  + `→ ${requestCount} request${requestCount === 1 ? '' : 's'} at ${POINTS_PER_REQUEST}/call, `
  + `paced ${(paceMs / 1000).toFixed(1)}s apart (~${Math.ceil((requestCount - 1) * paceMs / 1000)}s)\n`);

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
    console.error(`\nFAILED: could not read the real wind — ${error.message}`);
    console.error('This gate does not skip. An unanswered request means the colours went unchecked,');
    console.error('and "unchecked" printed as PASSED is the exact failure this file exists to catch.');
    process.exit(1);
  }

  const locations = Array.isArray(body) ? body : [body];
  if (locations.length !== chunk.length) {
    console.error(`\nFAILED: asked Open-Meteo for ${chunk.length} points and got ${locations.length} back.`);
    console.error('Results are matched to points by position, so a short answer would silently');
    console.error('attribute one shore\'s wind to another.');
    process.exit(1);
  }
  locations.forEach((location, k) => { chunk[k].hourly = location.hourly; });

  const done = Math.min(i + POINTS_PER_REQUEST, allPoints.length);
  // Overwrite one line on a terminal; stay quiet in a pipe or CI log where \r just concatenates.
  if (process.stdout.isTTY) process.stdout.write(`\r   fetched ${done}/${allPoints.length} points`);
  if (done < allPoints.length) await sleep(paceMs);
}
if (process.stdout.isTTY) process.stdout.write('\n');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — the colours, against that wind.
// ─────────────────────────────────────────────────────────────────────────────
const seriesAt = (key, hour) => {
  const h = points.get(key).hourly;
  const idxs = h.time.map((t, k) => (t.endsWith(hour) ? k : -1)).filter(k => k >= 0);
  const t = idxs[idxs.length - 1];
  return { kmh: h.wind_speed_10m[t], deg: h.wind_direction_10m[t], when: h.time[t] };
};

const failures = [];
const controlFailures = [];
let checked = 0;
let regionsWithSpread = 0;
const changeTally = { calmerToRougher: 0, sameColour: 0, rougherToCalmer: 0 };
/** What the still-unfixed wind DIRECTION costs — see the mixture note in the beach loop. */
const directionTally = { wouldChange: 0, calmOnlyBecauseRegionDirection: 0 };

for (const plan of plans) {
  const { region, profiles, clusters } = plan;

  const clusterOfBeach = new Map();
  clusters.forEach((c, index) => c.beachIds.forEach(id => clusterOfBeach.set(id, index)));

  let regionSpread = 0;

  for (const hour of HOURS) {
    const centre = seriesAt(plan.centreKey, hour);
    const centreBft = toBeaufort(centre.kmh);
    const localBfts = plan.clusterKeys.map(key => toBeaufort(seriesAt(key, hour).kmh));
    regionSpread = Math.max(regionSpread, Math.max(...localBfts) - Math.min(...localBfts));

    for (const beach of region.beaches) {
      const clusterIndex = clusterOfBeach.get(beach.id);
      if (clusterIndex === undefined) continue;
      const local = seriesAt(plan.clusterKeys[clusterIndex], hour);
      const localBft = toBeaufort(local.kmh);
      const profile = profiles[beach.id];
      const exposureLevel = profile?.sectors?.[sectorOf(centre.deg)]?.level;
      if (!exposureLevel) continue;

      checked += 1;
      plan.checked += 1;

      // THE COLOUR THE APP ACTUALLY PAINTS — both halves of the wind, since 01/08/2026.
      //
      // STRENGTH: App.tsx feeds each beach its own cluster Beaufort (perBeachMapWind →
      // getConsistentVisibleMapExposureLevels) and BeachMap colours the marker from
      // beachBeaufort(item).
      // DIRECTION: getVisibleMapExposureLevel derives the geometry sector from the direction it is
      // handed rather than from the pre-filled windSector. That was the evening's fix; before it,
      // the main geometry signal was still read with the region's direction while this gate painted
      // with the local one — a gate testing a version of the app that did not exist.
      // RULE 2 below proves both halves of that wiring still exist.
      const painted = resolveConditionTone({
        exposureLevel: profile?.sectors?.[sectorOf(local.deg)]?.level ?? exposureLevel,
        beaufort: localBft,
        isEnclosedCove: false,
        // Sea deliberately omitted. The ceiling can only ever make a pin WORSE, so a calm pin
        // here means the WIND alone left it calm — which is exactly the claim under test.
        seaStateM: undefined,
      });
      // What the region DIRECTION would have painted at the same local strength. Kept as a standing
      // measurement of what the direction half of the fix is worth: 452 of 8.550 beach-hours on
      // 01/08, none of them a calm pin over a real blow.
      const withRegionDirection = resolveConditionTone({
        exposureLevel,
        beaufort: localBft,
        isEnclosedCove: false,
        seaStateM: undefined,
      });
      if (withRegionDirection !== painted) directionTally.wouldChange += 1;
      if (CALM_TONES.has(withRegionDirection) && !CALM_TONES.has(painted) && localBft >= 4) {
        directionTally.calmOnlyBecauseRegionDirection += 1;
      }
      // What the region wind alone would have painted — kept to show what the fix is worth.
      const honest = resolveConditionTone({
        exposureLevel,
        beaufort: centreBft,
        isEnclosedCove: false,
        seaStateM: undefined,
      });

      if (painted === honest) changeTally.sameColour += 1;
      else if (CALM_TONES.has(painted) || painted === 'yellow') changeTally.calmerToRougher += 1;
      else changeTally.rougherToCalmer += 1;

      // RULE 1 — no calm pin over a real blow.
      if (CALM_TONES.has(painted) && localBft >= CALM_LIE_BEAUFORT) {
        const hit = {
          region: region.id,
          beach: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
          when: local.when,
          painted,
          centreBft,
          localBft,
          localKmh: local.kmh,
        };
        (CONTROL.has(region.id) ? controlFailures : failures).push(hit);
        plan.failures += 1;
      }
    }
  }

  plan.spread = regionSpread;
  if (regionSpread >= 2) regionsWithSpread += 1;
  if (plan.checked === 0) {
    unverified.push({ id: region.id, why: 'exposure file has no profile for any of its beaches' });
  }
}

// The per-region table. Printed for every region the gate spoke for, so a run that covered less
// than it claims is visible by counting rows rather than by trusting the last line.
const nameWidth = Math.max(24, ...plans.map(p => p.region.id.length));
console.log(`   ${'region'.padEnd(nameWidth)}  beaches  clusters  spread  beach-hours  false-calm`);
for (const plan of plans) {
  console.log(`   ${plan.region.id.padEnd(nameWidth)}  ${String(plan.region.beaches.length).padStart(7)}`
    + `  ${String(plan.clusters.length).padStart(8)}  ${String(plan.spread).padStart(4)} Bft`
    + `  ${String(plan.checked).padStart(11)}  ${String(plan.failures).padStart(10)}`
    + `${CONTROL.has(plan.region.id) ? '   (control)' : ''}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2 — the app actually resolves each beach from its own wind.
//
// Everything above tests pure functions fed the cluster wind. That is worth nothing on its own:
// the functions can be perfect while App keeps passing one region figure for every beach, which
// is precisely the state this gate was written in. These static checks are the wire between the
// two, mirroring RULE 0 of scripts/validateBeachMarineResolution.mjs.
// ─────────────────────────────────────────────────────────────────────────────
const wiringFailures = [];
const appSource = readFileSync(path.join(root, 'App.tsx'), 'utf8');
const mapSource = readFileSync(path.join(root, 'components/BeachMap.tsx'), 'utf8');

if (!/perBeachMapWind/.test(appSource)) {
  wiringFailures.push('App.tsx no longer builds perBeachMapWind — every beach is back on the region wind.');
} else {
  const call = appSource.match(/getConsistentVisibleMapExposureLevels\(\s*mapSuitableBeaches[\s\S]{0,400}?\)/);
  if (!call || !/perBeachMapWind/.test(call[0])) {
    wiringFailures.push('App.tsx builds perBeachMapWind but does not pass it to '
      + 'getConsistentVisibleMapExposureLevels — the canonical pin colours ignore it.');
  }
}
if (!/const\s+beachBeaufort\s*=/.test(mapSource)) {
  wiringFailures.push('components/BeachMap.tsx no longer defines beachBeaufort — the marker is '
    + 'coloured from the region Beaufort again.');
} else if (!/createExposureIcon\([^)]*beachBeaufort\(item\)/.test(mapSource)) {
  wiringFailures.push('components/BeachMap.tsx defines beachBeaufort but the marker icon is not '
    + 'built from it.');
}
if (!/beaufort:\s*beachBeaufort\(item\)/.test(mapSource)) {
  wiringFailures.push('the legend/slider tally no longer reads beachBeaufort — the legend can '
    + 'count colours the pins are not wearing.');
}

// The DIRECTION half. `item.windSector ?? getWindSectorFromDegrees(...)` reads as a harmless
// fallback and is not: App.tsx always fills windSector, so that order silently discards the wind
// direction every caller passes — including this gate's own subject. The order is the fix, so the
// order is what is guarded.
const exposureSource = readFileSync(path.join(root, 'utils/mapExposure.ts'), 'utf8');
const sectorLine = exposureSource.match(/^\s*const sector = .*$/m)?.[0] ?? '';
if (!/getWindSectorFromDegrees\(windDirectionDeg\)\s*\?\?\s*item\.windSector/.test(sectorLine)) {
  wiringFailures.push('utils/mapExposure.ts no longer resolves the geometry sector from the wind '
    + 'direction it is passed (expected `getWindSectorFromDegrees(windDirectionDeg) ?? '
    + 'item.windSector`) — the map is back on the region direction while pretending otherwise.');
}

const verified = plans.filter(p => p.checked > 0);

console.log(`\nRegions verified: ${verified.length}/${sample.length} · beach-hours checked: ${checked}`);
console.log(`Regions where beaches differ by >=2 Bft from each other: ${regionsWithSpread}/${sample.length}`);
console.log(`If each beach used its own wind: ${changeTally.sameColour} unchanged · `
  + `${changeTally.calmerToRougher} would darken · ${changeTally.rougherToCalmer} would lighten`);
console.log(`What the beach's own wind DIRECTION is worth: ${directionTally.wouldChange} beach-hours `
  + `differ from the region direction · ${directionTally.calmOnlyBecauseRegionDirection} of them `
  + `were calm ONLY because of it`);

console.log(`\n${failures.length === 0 ? 'OK  ' : 'FAIL'} no-calm-pin-over-a-real-blow: ${failures.length}`);
const shown = failures.slice(0, 12);
for (const f of shown) {
  console.log(`       ${f.region} · ${f.beach} · ${f.when} → painted "${f.painted}" from region ${f.centreBft} Bft, `
    + `but that shore has ${f.localBft} Bft (${f.localKmh} km/h)`);
}
if (failures.length > shown.length) console.log(`       … and ${failures.length - shown.length} more`);

console.log(`${controlFailures.length === 0 ? 'OK  ' : 'FAIL'} controls-stay-clean (small islands): ${controlFailures.length}`);
for (const f of controlFailures.slice(0, 5)) {
  console.log(`       CONTROL ${f.region} · ${f.beach} · ${f.when} → "${f.painted}" over ${f.localBft} Bft`);
}

console.log(`${wiringFailures.length === 0 ? 'OK  ' : 'FAIL'} app-reads-per-beach-wind: ${wiringFailures.length}`);
for (const f of wiringFailures) console.log(`       ${f}`);

// A region the gate could not speak for is not a region that passed.
console.log(`${unverified.length === 0 ? 'OK  ' : 'FAIL'} every-region-verified: ${unverified.length} unverified`);
for (const u of unverified) console.log(`       ${u.id} — ${u.why}`);

if (failures.length > 0 || controlFailures.length > 0 || wiringFailures.length > 0 || unverified.length > 0) {
  if (failures.length > 0 || controlFailures.length > 0) {
    console.error('\nFAILED: the map paints beaches calm that are not calm.');
    console.error('The colour is resolved from ONE wind measured at the region centre, while the beach');
    console.error('sits in a different cell of the weather model. Fix the SOURCE of the wind, not this gate.');
  } else if (unverified.length > 0 && wiringFailures.length === 0) {
    console.error(`\nFAILED: ${unverified.length} region(s) went unchecked, so this run cannot say the map is honest.`);
    console.error('Restore the missing geometry or coordinates — do not narrow the gate to what it can reach.');
  } else {
    console.error('\nFAILED: the app no longer resolves each beach from its own wind.');
    console.error('The functions above may still be correct; the wiring that feeds them is not.');
  }
  process.exit(1);
}

console.log(`\nPASSED: every calm pin is over water whose own wind is calm — `
  + `${verified.length}/${sample.length} regions, ${checked} beach-hours, ${requestCount} requests.`);
