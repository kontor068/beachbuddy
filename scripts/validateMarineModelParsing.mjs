#!/usr/bin/env node
/**
 * Marine model/parser contract guard.
 *
 * The marine request pins explicit Open-Meteo models. That pin lives in TWO places that must
 * agree — the client URL builder (services/forecast/openMeteoProvider.ts, used in `vite dev`)
 * and the edge proxy (netlify/functions/forecast.mjs, which re-sets `models` server-side so a
 * client can never override it) — and it silently changes the SHAPE of the response:
 *
 *   one model   -> hourly.wave_height
 *   two+ models -> hourly.wave_height_meteofrance_wave        (every field suffixed)
 *
 * so utils/marineForecastParsing.ts must read the suffixed names. Nothing throws when this
 * drifts: a lookup that misses just yields undefined, the fields drop out, and the app quietly
 * renders a beach with no waves or no water temperature. That is exactly how the
 * water-temperature card disappeared nationwide when meteofrance_wave was pinned alone — it
 * carries no sea_surface_temperature at all, and no test noticed.
 *
 * This guard fails the build when the three files stop agreeing — and since 2026-07-31 it also
 * RUNS the parser (section 5), because the static half cannot see which of the two wave models
 * actually reaches the user. On that date the pin was updated in the client but not in the
 * proxy, which would have shipped the old model to every visitor while every other check
 * stayed green; section 1 caught it.
 *
 * Run `node scripts/validateMarineModelParsing.mjs --live` to additionally re-verify the
 * upstream assumption (which model actually serves which variable) against Open-Meteo. That
 * needs network, so it is opt-in and never part of the offline gate.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(rootDir, rel), 'utf8');

const PROVIDER = 'services/forecast/openMeteoProvider.ts';
const PROXY = 'netlify/functions/forecast.mjs';
const PARSER = 'utils/marineForecastParsing.ts';

// The variable that regressed. Called out by name so re-pinning a wave-only model — which
// would drop it again — fails loudly here instead of silently in production.
const SST = 'sea_surface_temperature';

const failures = [];
const fail = (msg) => failures.push(msg);

// --- 1. the two pins must declare the same model set -------------------------------------
const providerSrc = read(PROVIDER);
const proxySrc = read(PROXY);
const parserSrc = read(PARSER);

const providerPin = providerSrc.match(/const MARINE_MODEL\s*=\s*'models=([^']+)'/);
const proxyPin = proxySrc.match(/const MARINE_MODEL\s*=\s*'([^']+)'/);

if (!providerPin) fail(`${PROVIDER}: could not find \`const MARINE_MODEL = 'models=...'\`.`);
if (!proxyPin) fail(`${PROXY}: could not find \`const MARINE_MODEL = '...'\`.`);

let models = [];
// The water-temperature route, split off the wave call on 14/08/2026 (models are a per-
// coordinate cost multiplier at Open-Meteo, and this one carried a single field). It is a
// SECOND pin that must agree across the same two files, so it gets the same treatment — the
// original regression this whole guard exists for was exactly "SST quietly stopped arriving".
const providerSstPin = providerSrc.match(/const SEA_TEMPERATURE_MODEL\s*=\s*'models=([^']+)'/);
const proxySstPin = proxySrc.match(/const SEA_TEMPERATURE_MODEL\s*=\s*'([^']+)'/);

if (!providerSstPin) fail(`${PROVIDER}: could not find \`const SEA_TEMPERATURE_MODEL = 'models=...'\`.`);
if (!proxySstPin) fail(`${PROXY}: could not find \`const SEA_TEMPERATURE_MODEL = '...'\`.`);

let sstModels = [];
if (providerSstPin && proxySstPin) {
  const providerSstModels = providerSstPin[1].split(',').map(s => s.trim()).filter(Boolean);
  sstModels = proxySstPin[1].split(',').map(s => s.trim()).filter(Boolean);
  const same =
    providerSstModels.length === sstModels.length &&
    providerSstModels.every((m, i) => m === sstModels[i]);
  if (!same) {
    fail(
      `Water-temperature model pin disagrees between client and proxy.\n` +
      `    ${PROVIDER}: ${providerSstModels.join(',') || '(none)'}\n` +
      `    ${PROXY}:    ${sstModels.join(',') || '(none)'}\n` +
      `    The proxy value wins in production.`
    );
  }
}

if (providerPin && proxyPin) {
  const providerModels = providerPin[1].split(',').map(s => s.trim()).filter(Boolean);
  const proxyModels = proxyPin[1].split(',').map(s => s.trim()).filter(Boolean);
  models = proxyModels;

  const same =
    providerModels.length === proxyModels.length &&
    providerModels.every((m, i) => m === proxyModels[i]);

  if (!same) {
    fail(
      `Marine model pin disagrees between client and proxy.\n` +
      `    ${PROVIDER}: ${providerModels.join(',') || '(none)'}\n` +
      `    ${PROXY}:    ${proxyModels.join(',') || '(none)'}\n` +
      `    The proxy value wins in production, so the client's dev-mode URL would be testing ` +
      `a different model than users get.`
    );
  }
}

// --- 2. every requested variable must be parsed, under a pinned model ---------------------
const hourlyBlock = providerSrc.match(/const MARINE_HOURLY\s*=\s*\[([\s\S]*?)\]\.join/);
if (!hourlyBlock) fail(`${PROVIDER}: could not find the MARINE_HOURLY variable list.`);

const waveVars = hourlyBlock
  ? [...hourlyBlock[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1])
  : [];

// The SST route asks for one field, declared as its own constant.
const sstHourly = providerSrc.match(/const SEA_TEMPERATURE_HOURLY\s*=\s*'([a-z_]+)'/);
if (!sstHourly) fail(`${PROVIDER}: could not find \`const SEA_TEMPERATURE_HOURLY = '...'\`.`);
const sstVars = sstHourly ? [sstHourly[1]] : [];

// The parser reads ONE merged marine row, so from its point of view the two routes are one
// variable list served by one model set. Checking them united is what keeps section 2 honest
// after the split: a field must still be requested somewhere, and parsed from a model that is
// actually pinned somewhere.
const requestedVars = [...waveVars, ...sstVars];
const allModels = [...models, ...sstModels];

// --- 2b. the split itself must not quietly un-split ---------------------------------------
// Putting SST back into MARINE_HOURLY would drag meteofrance_currents back into the wave model
// list, and Open-Meteo charges a FULL extra call per coordinate per model — measured at roughly
// 20,000 calls/day nationally for this one field. Nothing else would fail: the card would keep
// working and the bill would quietly rise by a third. Hence a named check.
if (waveVars.includes(SST)) {
  fail(
    `${PROVIDER}: '${SST}' is back inside MARINE_HOURLY. It has its own route since 14/08/2026 ` +
    `precisely because carrying it there forces a third model onto every wave request, and ` +
    `Open-Meteo prices models per coordinate. Use SEA_TEMPERATURE_HOURLY.`
  );
}
if (models.includes('meteofrance_currents')) {
  fail(
    `${PROXY}/${PROVIDER}: 'meteofrance_currents' is pinned on the WAVE route again. It serves ` +
    `only '${SST}', which now has its own endpoint — leaving it here costs one extra full API ` +
    `call for every coordinate of every wave request.`
  );
}

// How the parser resolves each field: series('<field>', '<model>')
const parsed = new Map();
for (const m of parserSrc.matchAll(/series\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*\)/g)) {
  parsed.set(m[1], m[2]);
}

if (parsed.size === 0) {
  fail(`${PARSER}: found no series('<field>', '<model>') lookups — the marine parser no longer resolves model-suffixed fields.`);
}

for (const variable of requestedVars) {
  if (!parsed.has(variable)) {
    fail(`${PARSER}: requests '${variable}' but never parses it — it would silently read undefined.`);
    continue;
  }
  const model = parsed.get(variable);
  if (allModels.length && !allModels.includes(model)) {
    fail(
      `${PARSER}: parses '${variable}' from model '${model}', which is not pinned on either ` +
      `route (pinned: ${allModels.join(', ')}). That lookup can only ever miss.`
    );
  }
}

for (const [variable, model] of parsed) {
  if (requestedVars.length && !requestedVars.includes(variable)) {
    fail(`${PARSER}: parses '${variable}', which is not in MARINE_HOURLY — dead lookup, or a variable someone forgot to request.`);
  }
  void model;
}

// --- 3. the regression itself: SST must come from a model that actually serves it ---------
if (requestedVars.includes(SST)) {
  const sstModel = parsed.get(SST);
  if (sstModel && /_wave$/.test(sstModel)) {
    fail(
      `${PARSER}: '${SST}' is parsed from '${sstModel}'. Wave models return no sea-surface ` +
      `temperature (measured: 0 of 24 hourly values nationwide), so the water-temperature card ` +
      `would vanish from every beach-detail page. Source it from a currents/ocean model.`
    );
  }
  if (allModels.length && !allModels.some(m => !/_wave$/.test(m))) {
    fail(
      `Only wave model(s) are pinned (${allModels.join(', ')}), but '${SST}' is requested. ` +
      `Nothing in that set can serve it.`
    );
  }
}

// --- 4. the bare-name fallback must survive (CDN keeps the old shape after a deploy) ------
if (!/\?\?\s*marineHourly\[field\]/.test(parserSrc)) {
  fail(
    `${PARSER}: the bare-field fallback in series() is gone. The edge proxy caches marine ` +
    `responses for s-maxage=1800 + stale-while-revalidate=3600, so for ~1.5h after any change ` +
    `to the model list the CDN still serves the PREVIOUS field shape. Without the fallback ` +
    `every wave reading reads undefined for that whole window.`
  );
}

// --- optional: re-verify the upstream assumption -----------------------------------------
if (process.argv.includes('--live') && failures.length === 0) {
  const vars = requestedVars.join(',');
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=36.75&longitude=24.42` +
    `&hourly=${vars}&timezone=auto&forecast_days=1&cell_selection=sea&models=${models.join(',')}`;
  try {
    const res = await fetch(url);
    const body = await res.json();
    const hourly = body?.hourly ?? {};
    for (const [variable, model] of parsed) {
      const series = hourly[`${variable}_${model}`] ?? hourly[variable];
      const nonNull = Array.isArray(series) ? series.filter(v => v !== null && v !== undefined).length : 0;
      if (nonNull === 0) {
        fail(`live: upstream returned no usable values for '${variable}' from '${model}'.`);
      }
    }
    if (failures.length === 0) console.log('Live upstream check: every parsed field returned data.');
  } catch (error) {
    console.warn(`Live check skipped (network error): ${error?.message || error}`);
  }
}

// --- 5. BEHAVIOUR, not just shape: which model actually wins, hour by hour ----------------
//
// Everything above is static analysis. It proves both wave models are parsed from pinned
// names — it cannot see WHICH one reaches the user, and that is the whole point of the
// 2026-07-31 change: ewam (0.05°) where it reports, meteofrance_wave (0.08°) after it runs
// out. Measured against Greek buoys, meteofrance_wave under-reads the sea by 8.2% overall
// and up to 23.9% in strong wind, so silently falling back to it everywhere would undo the
// change while every static check stayed green.
//
// This is the lesson that cost a rewrite earlier the same day: a gate that does not exercise
// the wiring is decorative. Sabotage it by flipping the preference in parseMarineHourly and
// this section fails; the four above do not.
{
  const { readFileSync: read } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const ts = (await import('typescript')).default;
  const req = createRequire(import.meta.url);

  req.extensions['.ts'] = (module, filename) => {
    // Same stub scripts/validateRecommendationScenarios.mjs uses: analyticsService pulls in
    // browser-only globals and Node resolves it ahead of this hook, which breaks the require
    // chain before weatherService is reached.
    if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
      module._compile(
        'exports.recordOpenMeteoCall = function () {};\n' +
        'exports.getNegativeFeedbackCount = function () { return 0; };\n',
        filename,
      );
      return;
    }
    module._compile(ts.transpileModule(read(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText, filename);
  };

  let parseMarineHourly;
  try {
    ({ parseMarineHourly } = req(path.join(rootDir, 'utils/marineForecastParsing.ts')));
  } catch (error) {
    fail(`${PARSER}: could not load parseMarineHourly for the behaviour check — ${error.message}`);
  }

  if (typeof parseMarineHourly === 'function') {
    // Hour 0-1: both models report. Hour 2: ewam has run out (its horizon is ~82 h).
    const hourly = {
      time: ['2026-07-31T00:00', '2026-07-31T01:00', '2026-07-31T02:00'],
      wave_height_ewam: [0.55, 0.60, null],
      wave_period_ewam: [4.1, 4.2, null],
      wave_direction_ewam: [10, 12, null],
      swell_wave_height_ewam: [0.2, 0.2, null],
      swell_wave_period_ewam: [8, 8, null],
      swell_wave_direction_ewam: [20, 20, null],
      wave_height_meteofrance_wave: [1.9, 1.9, 1.4],
      wave_period_meteofrance_wave: [7.7, 7.7, 6.5],
      wave_direction_meteofrance_wave: [200, 200, 210],
      swell_wave_height_meteofrance_wave: [1.1, 1.1, 0.9],
      swell_wave_period_meteofrance_wave: [9, 9, 9],
      swell_wave_direction_meteofrance_wave: [210, 210, 210],
      sea_surface_temperature_meteofrance_currents: [25.5, 25.5, 25.5],
    };
    const rows = parseMarineHourly(hourly);

    if (rows.length !== 3) {
      fail(`${PARSER}: behaviour check expected 3 rows, got ${rows.length}.`);
    } else {
      if (rows[0].marine.waveHeightM !== 0.55 || rows[0].marine.waveModel !== 'ewam') {
        fail(`${PARSER}: hour 0 should take ewam (0.55 m) — got ${rows[0].marine.waveHeightM} m ` +
             `from '${rows[0].marine.waveModel}'. The preferred wave model is not reaching users.`);
      }
      if (rows[2].marine.waveHeightM !== 1.4 || rows[2].marine.waveModel !== 'meteofrance_wave') {
        fail(`${PARSER}: hour 2 (past ewam's horizon) should fall back to meteofrance_wave ` +
             `(1.4 m) — got ${rows[2].marine.waveHeightM} m from '${rows[2].marine.waveModel}'. ` +
             `Days 4-6 and the basins ewam cannot resolve would come back empty.`);
      }
      // The failure this specifically forbids: a height from one model beside a period from
      // the other. utils/waveCharacter turns (height, period) into one severity, so a mixed
      // pair invents a sea neither model reported.
      if (rows[0].marine.wavePeriodS !== 4.1 || rows[2].marine.wavePeriodS !== 6.5) {
        fail(`${PARSER}: height and period came from different models ` +
             `(hour 0 period ${rows[0].marine.wavePeriodS}, hour 2 period ${rows[2].marine.wavePeriodS}).`);
      }
      if (rows[0].marine.seaSurfaceTemperatureC !== 25.5) {
        fail(`${PARSER}: sea temperature lost — it comes from meteofrance_currents and must ` +
             `survive whichever wave model wins the hour.`);
      }
    }

    // ── ΤΟ ΦΡΕΝΟ ΤΟΥ ΗΓΕΤΗ (17/08/2026) ──────────────────────────────────────────────────
    // Αντιγραφή του πραγματικού σφάλματος: Λιμνιώνας Κυθήρων, 17/08/2026, ewam 0,22 -> 3,44 μ.
    // σε μία ώρα με το meteofrance επίπεδο στα 0,18. Εθνικά το φρένο άγγιξε 23 από 15.216 ώρες
    // (0,15%) σε 6 από 317 σημεία, και ΚΑΜΙΑ από τις 454 ώρες πραγματικού κύματος ≥1 μ. όπου τα
    // δύο μοντέλα συμφωνούν — reports/quality/wave-spike-guard.json.
    const spikeHourly = {
      time: ['2026-08-17T14:00', '2026-08-17T15:00', '2026-08-17T16:00',
             '2026-08-17T17:00', '2026-08-17T18:00'],
      // 14:00 ήρεμο και σύμφωνο · 15:00 το άλμα · 16:00-17:00 η ουρά που σβήνει · 18:00 πραγματική
      // θαλασσοταραχή που ΚΑΙ ΤΑ ΔΥΟ μοντέλα βλέπουν — αυτή δεν επιτρέπεται να μπλοκαριστεί.
      wave_height_ewam: [0.22, 3.44, 2.66, 2.2, 2.4],
      wave_period_ewam: [3.5, 10.4, 9.5, 9.1, 8.0],
      wave_direction_ewam: [300, 300, 300, 300, 300],
      swell_wave_height_ewam: [0.1, 3.0, 2.4, 2.0, 2.1],
      swell_wave_period_ewam: [3, 10, 9, 9, 8],
      swell_wave_direction_ewam: [300, 300, 300, 300, 300],
      wave_height_meteofrance_wave: [0.18, 0.18, 0.2, 0.2, 2.2],
      wave_period_meteofrance_wave: [3.4, 3.4, 3.5, 3.5, 7.9],
      wave_direction_meteofrance_wave: [290, 290, 290, 290, 295],
      swell_wave_height_meteofrance_wave: [0.1, 0.1, 0.1, 0.1, 1.9],
      swell_wave_period_meteofrance_wave: [3, 3, 3, 3, 8],
      swell_wave_direction_meteofrance_wave: [290, 290, 290, 290, 295],
      sea_surface_temperature_meteofrance_currents: [26, 26, 26, 26, 26],
    };
    const spikeRows = parseMarineHourly(spikeHourly);

    if (spikeRows.length !== 5) {
      fail(`${PARSER}: spike-guard check expected 5 rows, got ${spikeRows.length}.`);
    } else {
      if (spikeRows[0].marine.waveModel !== 'ewam' || spikeRows[0].marine.waveHeightM !== 0.22) {
        fail(`${PARSER}: a calm hour where both models agree must still take the leader — got ` +
             `${spikeRows[0].marine.waveHeightM} m from '${spikeRows[0].marine.waveModel}'. ` +
             `The guard is firing on normal weather.`);
      }
      for (const index of [1, 2, 3]) {
        if (spikeRows[index].marine.waveModel !== 'meteofrance_wave') {
          fail(`${PARSER}: hour ${index} is a physically impossible jump (+3.22 m in one hour) ` +
               `that the second model does not corroborate, yet it still came from ` +
               `'${spikeRows[index].marine.waveModel}' at ${spikeRows[index].marine.waveHeightM} m. ` +
               `A broken reading is going straight to the swim verdict.`);
        }
      }
      // Η ουρά του επεισοδίου πρέπει να πέφτει ΟΛΟΚΛΗΡΗ: πιάνοντας μόνο την κορυφή αφήναμε
      // 2,66 / 2,20 όρθια, γιατί καθεμία τους είναι ΠΤΩΣΗ και όχι άλμα.
      if (spikeRows[2].marine.wavePeriodS !== 3.5) {
        fail(`${PARSER}: the blocked hour kept the leader's period ` +
             `(${spikeRows[2].marine.wavePeriodS} s) — height and period must fall together.`);
      }
      if (spikeRows[4].marine.waveModel !== 'ewam' || spikeRows[4].marine.waveHeightM !== 2.4) {
        fail(`${PARSER}: a REAL 2.4 m sea that both models report was blocked ` +
             `(got ${spikeRows[4].marine.waveHeightM} m from '${spikeRows[4].marine.waveModel}'). ` +
             `The guard must never hide weather the witness confirms — that is false calm.`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Marine model/parser contract FAILED:\n');
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `Marine model/parser contract OK — pinned [${models.join(', ')}], ` +
  `${parsed.size} field(s) parsed, bare-name fallback present.`
);
