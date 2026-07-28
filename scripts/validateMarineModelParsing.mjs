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
 * so services/weatherService.ts must read the suffixed names. Nothing throws when this drifts:
 * a lookup that misses just yields undefined, the fields drop out, and the app quietly renders
 * a beach with no waves or no water temperature. That is exactly how the water-temperature card
 * disappeared nationwide when meteofrance_wave was pinned alone — it carries no
 * sea_surface_temperature at all, and no test noticed.
 *
 * This guard fails the build when the three files stop agreeing.
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
const PARSER = 'services/weatherService.ts';

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

const requestedVars = hourlyBlock
  ? [...hourlyBlock[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1])
  : [];

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
  if (models.length && !models.includes(model)) {
    fail(
      `${PARSER}: parses '${variable}' from model '${model}', which is not pinned ` +
      `(pinned: ${models.join(', ')}). That lookup can only ever miss.`
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
  if (models.length && !models.some(m => !/_wave$/.test(m))) {
    fail(
      `Only wave model(s) are pinned (${models.join(', ')}), but '${SST}' is requested. ` +
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

if (failures.length > 0) {
  console.error('Marine model/parser contract FAILED:\n');
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `Marine model/parser contract OK — pinned [${models.join(', ')}], ` +
  `${parsed.size} field(s) parsed, bare-name fallback present.`
);
