/**
 * EVERY BEACH ASKS THE WAVE MODEL ABOUT ITS OWN SHORE — gate.
 *
 * Reported 31/07/2026 from Lemnos: Γομάτι (id 1433, faces NE) and Κάσπακας (id 1435, faces W),
 * 11 km apart on opposite coasts, both printed 1,3 m. Fetched live the same evening, ewam said
 * 1,80 m at Γομάτι's shore and 1,20 m at Κάσπακας's — a 0,60 m gap the app flattened to zero.
 *
 * The cause was NOT the forecast clustering the first diagnosis blamed. Those two beaches sit in
 * DIFFERENT clusters (39.960_25.200 and 39.960_25.080) and still showed one number, because
 * every beach was scored from the REGION forecast: one sea point for all 40 beaches of Lemnos,
 * 129 of Evia (App.tsx beachScoreById, mapSuitableBeaches, BeachDetailPage's dayForecast). The
 * per-cluster marine leg was fetched, merged and then read by nothing.
 *
 * What that threw away, measured: utils/marineForecastParsing.ts pins `ewam` (0.05° ≈ 5 km) as
 * the model that decides the wave, and over 496 meltemi cases the north-vs-south coast difference
 * it resolves was 1.11 m with the correct sign 496 times out of 496 — against 0.05 m for the
 * 0.08° model it replaced. The resolution was already paid for and already in production.
 *
 * WHY THIS GATE ASSERTS ABOUT THE REQUEST, NOT THE PRINTED NUMBER.
 * "Two beaches facing different ways must not show the same height" cannot be enforced and must
 * not be attempted. resolveEffectiveWaveHeightM is a max() against our own wind-chop floor
 * (utils/waveModel.ts), so at 6 Bft two exposed shores legitimately print 1,0 m each from the
 * FLOOR, and one-decimal rounding merges 1,25 with 1,34. A gate on the number would fire falsely
 * and the pressure would land on the floor — the one thing in this system that never moves.
 * So the claim here is about which water we ask about. That is deterministic, offline, and it is
 * the actual defect.
 *
 * Pure computation over the committed geometry — no network.
 *
 * Run: node scripts/validateBeachMarineResolution.mjs
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
    // The app modules read import.meta.env; there is no bundler here, so neutralise it.
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

// THE code that ships, not a copy of it. scripts/validateEffectiveRanking.ts:16-18 records a gate
// that passed green on deliberately sabotaged code because it had re-implemented its subject.
const {
  resolveBeachMarinePoints,
  marinePointKey,
  marinePointDistanceKm,
  bearingDifferenceDeg,
  MAX_EXPECTED_MARINE_POINTS_PER_REGION,
} = require(path.join(root, 'utils/marineSamplePoints.ts'));

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');

/**
 * Two beaches count as facing different water when BOTH hold: their profiles' facing directions
 * differ by more than 90°, and the points they were pushed offshore to are more than 5 km apart.
 *
 * Both conditions, not either. Facing alone catches the two sides of a 300 m sandbar, where one
 * cell honestly describes both. Distance alone catches two stretches of the same open coast,
 * which differ in degree and not in kind. Together they name the case this gate exists for: a
 * cape with a windward and a lee side, where one reading is right for one shore and wrong for
 * the other by the full height of the sea.
 *
 * 5 km is ewam's own cell (0.05° ≈ 5.5 km at these latitudes). Below it the model itself cannot
 * tell the two points apart, so demanding two requests would be demanding a difference the data
 * cannot carry.
 */
const OPPOSING_FACING_DEG = 90;
const OPPOSING_DISTANCE_KM = 5;

/**
 * Beaches with no marineSamplePoint of their own, nationally, on the day this gate was written.
 * They read the region cell exactly as they did before this change — no worse than yesterday,
 * and their own SMB floor still applies. The number is here so the count cannot quietly grow:
 * a geometry rebuild that drops sample points is a regression this gate has to see.
 */
const REGION_FALLBACK_BASELINE = 295;

/** The pair that started this, asserted by name so a refactor cannot lose the case. */
const INCIDENT = { regionId: 'north-aegean-lemnos', beachIds: [1433, 1435] };

const failures = [];
const notes = [];
let regionsChecked = 0;
let beachesChecked = 0;
let opposingPairsChecked = 0;
let regionFallbackTotal = 0;
let ownShoreTotal = 0;
let distinctPointsTotal = 0;
let worstRegion = { regionId: null, points: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// RULE 0 — the app actually uses this resolver.
//
// Everything below tests a pure function. That is worth nothing on its own: the function can be
// perfect while the app keeps reading the region cell, which is precisely the state this gate was
// written in. These two static checks are the wire between the two. They mirror how
// scripts/validateMarineModelParsing.mjs reads source text to prove each variable is parsed from
// a pinned model.
// ─────────────────────────────────────────────────────────────────────────────
const useWeatherSource = readFileSync(path.join(root, 'hooks/useWeather.ts'), 'utf8');
if (!/resolveBeachMarinePoints/.test(useWeatherSource)) {
  failures.push(
    'RULE 0 — hooks/useWeather.ts does not call resolveBeachMarinePoints. Every beach is still '
    + 'fetching the region (or a cluster-averaged) sea point, so nothing below reaches the screen.'
  );
}

const weatherServiceSource = readFileSync(path.join(root, 'services/weatherService.ts'), 'utf8');
// One definition of the point key, or the resolver decides which points are distinct while the
// fetch layer maps responses back by a different rule — and a beach reads another beach's water.
const declaresOwnKey = /forecastPointKey\s*=\s*\([^)]*\)\s*:\s*string\s*=>\s*\n?\s*`\$\{lat\.toFixed/.test(weatherServiceSource);
if (declaresOwnKey) {
  failures.push(
    'RULE 0 — services/weatherService.ts still declares its own forecastPointKey template. It must '
    + 're-export marinePointKey from utils/marineSamplePoints so there is exactly one definition.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES 1-3 — over the committed geometry, region by region.
// ─────────────────────────────────────────────────────────────────────────────
for (const file of readdirSync(exposureDir).filter(name => name.endsWith('.json') && name !== 'index.json')) {
  let beaches;
  let profiles;
  let regionPoint;
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    beaches = app.island.beaches;
    regionPoint = app.island.coordinates;
    profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
  } catch {
    // A region with geometry but no app bundle is not this gate's business.
    continue;
  }
  const regionId = file.replace(/\.json$/, '');
  if (!regionPoint || !Number.isFinite(regionPoint.lat)) {
    failures.push(`${regionId}: app bundle has no island.coordinates, so there is no region fallback point.`);
    continue;
  }
  regionsChecked += 1;

  // profiles is keyed by beachId AS A STRING in the JSON; the resolver takes numeric keys.
  const profileById = {};
  for (const profile of Object.values(profiles ?? {})) {
    if (profile?.beachId != null) profileById[profile.beachId] = profile;
  }

  const resolution = resolveBeachMarinePoints(beaches, profileById, regionPoint);
  beachesChecked += beaches.length;
  ownShoreTotal += resolution.ownShoreBeachIds.length;
  regionFallbackTotal += resolution.regionFallbackBeachIds.length;
  distinctPointsTotal += resolution.points.length;
  if (resolution.points.length > worstRegion.points) {
    worstRegion = { regionId, points: resolution.points.length };
  }

  if (resolution.points.length > MAX_EXPECTED_MARINE_POINTS_PER_REGION) {
    failures.push(
      `${regionId}: ${resolution.points.length} marine points in one region view, over the expected `
      + `ceiling of ${MAX_EXPECTED_MARINE_POINTS_PER_REGION}. Do not fix this by sampling fewer `
      + 'places (hooks/useWeather.ts forbids it) — find out why the region grew.'
    );
  }

  // RULE 2 — no coordinate is invented.
  const committed = new Set([marinePointKey(regionPoint.lat, regionPoint.lon)]);
  for (const profile of Object.values(profileById)) {
    const sample = profile?.marineSamplePoint;
    if (sample && Number.isFinite(sample.lat)) committed.add(marinePointKey(sample.lat, sample.lon));
  }
  for (const point of resolution.points) {
    const key = marinePointKey(point.lat, point.lon);
    if (!committed.has(key)) {
      failures.push(
        `RULE 2 — ${regionId}: requesting ${key}, which is neither the region point nor any beach's `
        + 'committed marineSamplePoint. A coordinate we invented can sit on the land side, and '
        + 'cell_selection=sea then walks it to a cell nobody chose (Σχινιάς: 11.0 km, wrong basin).'
      );
    }
  }

  // RULE 1 — beaches facing different water must not share one request.
  const candidates = beaches
    .map(beach => ({ beach, profile: profileById[beach.id] }))
    .filter(entry => entry.profile?.marineSamplePoint && Number.isFinite(entry.profile.facingDeg));

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (bearingDifferenceDeg(a.profile.facingDeg, b.profile.facingDeg) <= OPPOSING_FACING_DEG) continue;
      const apart = marinePointDistanceKm(a.profile.marineSamplePoint, b.profile.marineSamplePoint);
      if (apart <= OPPOSING_DISTANCE_KM) continue;

      opposingPairsChecked += 1;
      const keyA = resolution.keyByBeachId.get(a.beach.id);
      const keyB = resolution.keyByBeachId.get(b.beach.id);
      if (keyA === keyB) {
        failures.push(
          `RULE 1 — ${regionId}: ${a.beach.name?.gr ?? a.beach.id} (${Math.round(a.profile.facingDeg)}°) and `
          + `${b.beach.name?.gr ?? b.beach.id} (${Math.round(b.profile.facingDeg)}°) face water `
          + `${apart.toFixed(1)} km apart yet share the request ${keyA}. One of them is being told `
          + "about the other's sea."
        );
      }
    }
  }

  // The incident pair, by name.
  if (regionId === INCIDENT.regionId) {
    const [idA, idB] = INCIDENT.beachIds;
    const keyA = resolution.keyByBeachId.get(idA);
    const keyB = resolution.keyByBeachId.get(idB);
    if (!keyA || !keyB) {
      failures.push(`INCIDENT — Lemnos beaches ${idA}/${idB} are missing from the resolution entirely.`);
    } else if (keyA === keyB) {
      failures.push(
        `INCIDENT — Γομάτι (${idA}) and Κάσπακας (${idB}) still share the marine request ${keyA}. `
        + 'This is the exact pair that printed 1,3 m on both while ewam said 1,80 and 1,20.'
      );
    } else {
      notes.push(`Incident pair resolved apart: Γομάτι → ${keyA}, Κάσπακας → ${keyB}.`);
    }
  }
}

// RULE 3 — coverage does not rot.
if (regionFallbackTotal > REGION_FALLBACK_BASELINE) {
  failures.push(
    `RULE 3 — ${regionFallbackTotal} beaches have no marineSamplePoint of their own, up from the `
    + `${REGION_FALLBACK_BASELINE} committed when this gate was written. Geometry has been rebuilt `
    + 'and lost sample points; those beaches silently fell back to the region cell.'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 4 — nothing but the marine block changes.
//
// The per-beach forecast is the region forecast with its sea swapped. If it ever swaps the WIND
// too, this change quietly becomes a per-beach wind change: the Beaufort, the exposure colour and
// the freshness clock all move, and none of that was measured or asked for. Identity equality is
// the assertion, not deep equality — a copy that happens to match today is a copy that can drift.
// ─────────────────────────────────────────────────────────────────────────────
let applyMarineToDailyForecast;
try {
  ({ applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts')));
} catch (error) {
  failures.push(`RULE 4 — could not load utils/weatherUtils.ts: ${error.message}`);
}

if (typeof applyMarineToDailyForecast !== 'function') {
  failures.push(
    'RULE 4 — utils/weatherUtils.ts does not export applyMarineToDailyForecast. Nothing builds a '
    + 'per-beach forecast yet, so there is no object whose wind can be proven untouched.'
  );
} else {
  const hourly = [0, 1, 2].map(index => ({
    dt: 1_700_000_000 + index * 3600,
    dt_txt: `2026-08-01 0${8 + index}:00:00`,
    wind: { speed: 9, deg: 20 },
    main: { temp: 28 },
    marine: { waveHeightM: 1.2, wavePeriodS: 4.5, source: 'open-meteo-marine' },
  }));
  const base = {
    date: new Date('2026-08-01T08:00:00Z'),
    temp_max: 31,
    temp_min: 23,
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    wind: { speed: 9, deg: 20 },
    marine: { waveHeightM: 1.2, wavePeriodS: 4.5, source: 'open-meteo-marine' },
    hourly,
  };
  const beachMarine = hourly.map(item => ({
    dt_txt: item.dt_txt,
    marine: { waveHeightM: 1.8, wavePeriodS: 5.1, source: 'open-meteo-marine' },
  }));

  const swapped = applyMarineToDailyForecast(base, beachMarine);

  if (swapped === base) {
    failures.push('RULE 4 — applyMarineToDailyForecast returned the base object; the sea was never swapped.');
  }
  if (swapped.wind !== base.wind) {
    failures.push('RULE 4 — the per-beach forecast replaced the WIND object. Wind stays the region wind.');
  }
  if (swapped.weather !== base.weather) {
    failures.push('RULE 4 — the per-beach forecast replaced the WEATHER object.');
  }
  if (swapped.temp_max !== base.temp_max || swapped.temp_min !== base.temp_min) {
    failures.push('RULE 4 — the per-beach forecast changed the temperature.');
  }
  if (!swapped.hourly || swapped.hourly.length !== base.hourly.length) {
    failures.push('RULE 4 — the per-beach forecast dropped or padded hours.');
  } else {
    swapped.hourly.forEach((item, index) => {
      if (item.wind !== base.hourly[index].wind) {
        failures.push(`RULE 4 — hourly[${index}].wind was replaced. Only hourly[].marine may change.`);
      }
      if (item.marine === base.hourly[index].marine) {
        failures.push(`RULE 4 — hourly[${index}].marine was NOT replaced, so the beach still reads the region sea.`);
      }
    });
    if (swapped.hourly[0]?.marine?.waveHeightM !== 1.8) {
      failures.push('RULE 4 — the swapped hour does not carry the beach\'s own wave height.');
    }
  }
  // The daily summary must follow the swapped hours, or App's day-level readers keep the old sea.
  if (swapped.marine?.waveHeightM !== 1.8) {
    failures.push(
      `RULE 4 — the daily marine summary still reads ${swapped.marine?.waveHeightM} m instead of the `
      + "beach's own 1.8 m. summarizeDailyMarine must be re-run over the swapped hours."
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `Beach marine resolution: ${regionsChecked} regions, ${beachesChecked} beaches, `
  + `${distinctPointsTotal} distinct sea points, ${opposingPairsChecked} opposing pairs checked.`
);
console.log(
  `  ${ownShoreTotal} beaches read their own shore, ${regionFallbackTotal} read the region cell `
  + `(baseline ${REGION_FALLBACK_BASELINE}). Largest region view: ${worstRegion.regionId} `
  + `with ${worstRegion.points} points (${Math.ceil(worstRegion.points / 32)} batched requests).`
);
notes.forEach(note => console.log(`  ${note}`));

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} problem(s):\n`);
  failures.slice(0, 25).forEach(failure => console.error(`  - ${failure}`));
  if (failures.length > 25) console.error(`  …and ${failures.length - 25} more.`);
  console.error(
    '\nDo not make this pass by grouping beaches onto shared points or by widening '
    + `OPPOSING_DISTANCE_KM. Both are ways of telling a beach about someone else's sea.`
  );
  process.exit(1);
}

console.log('PASS — every beach asks the wave model about its own shore.');
