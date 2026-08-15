#!/usr/bin/env node
/**
 * WHICH MODEL CELL DOES OPEN-METEO ACTUALLY ANSWER EACH BEACH FROM?
 *
 * Measured, never derived. Open-Meteo's default `cell_selection=land` walks a 90 m elevation
 * model to find a LAND grid cell of similar height to the coordinate asked about, so the cell
 * that comes back is NOT simply the nearest one. Probed nationally on 15/08/2026: snapping a
 * beach coordinate to a 0.0625° box predicts the returned cell for only 48.9% of 2.862 beaches.
 * That is why this file exists instead of a formula.
 *
 * The cell is what decides the wind a beach is shown. Two beaches in the same cell get
 * byte-identical numbers; two beaches in different cells can differ by a whole Beaufort at 5 km
 * apart (Elafonisi, 15/08: 43.2 km/h in its own cell, 50.9 km/h in the one 3.5 km north). The
 * clustering in utils/beachForecastClusters.ts uses this file to refuse to let one forecast
 * point speak for beaches that sit in different cells.
 *
 *   node scripts/bakeForecastModelCells.mjs           # probe and write
 *   node scripts/bakeForecastModelCells.mjs --check    # re-probe a sample, FAIL on drift
 *   node scripts/bakeForecastModelCells.mjs --check --sample=400
 *
 * DRIFT IS THE REAL RISK. Open-Meteo can change which model serves a region, and the cell map
 * would then be quietly stale — the same class of silent wrongness this whole change exists to
 * remove. --check re-probes a random sample and fails loudly; run it with the other gates.
 *
 * The request below MUST stay byte-identical in its variable list, units and timezone to
 * services/forecast/openMeteoProvider.ts hourlyForecastUrlBatch. A different variable list can
 * make `best_match` pick a different model, and then the baked cell describes a request the app
 * never makes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A BUILD INPUT, not a served file — it lives beside data/beachPhotosById.generated.json rather
// than under public/, so a national id→cell dump never reaches the CDN.
const OUT_PATH = path.join(rootDir, 'data', 'forecast-cells.generated.json');
const REGION_DIR = path.join(rootDir, 'public', 'data', 'beaches');

// Must mirror services/forecast/openMeteoProvider.ts:204 exactly.
const HOURLY = 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,precipitation_probability';
const ORIGIN = process.env.FORECAST_ORIGIN || 'https://api.open-meteo.com';
const CHUNK = 40;
const PAUSE_MS = Number(process.env.BAKE_PAUSE_MS || 6000);

const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const sampleArg = args.find(a => a.startsWith('--sample='));
const sampleSize = sampleArg ? Number(sampleArg.split('=')[1]) : 250;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const readBeaches = () => {
  const beaches = [];
  for (const file of fs.readdirSync(REGION_DIR)) {
    if (!file.endsWith('.json') || /search-index|^index\./.test(file)) continue;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(REGION_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    const list = Array.isArray(parsed)
      ? parsed
      : parsed.beaches || Object.values(parsed).find(value => Array.isArray(value));
    if (!Array.isArray(list)) continue;
    for (const beach of list) {
      const lat = beach.lat ?? beach.latitude ?? beach.coordinates?.lat;
      const lon = beach.lon ?? beach.longitude ?? beach.coordinates?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      beaches.push({ id: beach.id, name: beach.name, region: file.replace('.json', ''), lat, lon });
    }
  }
  return beaches;
};

const probe = async points => {
  const resolved = new Map();
  for (let i = 0; i < points.length; i += CHUNK) {
    const chunk = points.slice(i, i + CHUNK);
    const url = `${ORIGIN}/v1/forecast?latitude=${chunk.map(p => p.lat).join(',')}`
      + `&longitude=${chunk.map(p => p.lon).join(',')}`
      + `&hourly=${HOURLY}&wind_speed_unit=ms&timezone=Europe%2FAthens&forecast_days=1`;

    let payload = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        payload = await (await fetch(url)).json();
        if (Array.isArray(payload)) break;
        // Open-Meteo answers rate limiting with {error:true, reason:'...'} and a 200.
        if (payload?.error) {
          process.stdout.write('  rate limited, waiting 65s\n');
          await sleep(65000);
          payload = null;
          continue;
        }
      } catch {
        await sleep(8000);
      }
    }
    if (!Array.isArray(payload)) {
      throw new Error(`Open-Meteo did not answer for chunk starting at ${i}; refusing to bake a partial map.`);
    }
    chunk.forEach((point, index) => {
      const entry = payload[index];
      resolved.set(`${point.region}#${point.id}`, {
        ...point,
        cell: `${entry.latitude}_${entry.longitude}`,
        elevation: entry.elevation,
      });
    });
    if ((i / CHUNK) % 10 === 0) process.stdout.write(`  probed ${resolved.size}/${points.length}\n`);
    await sleep(PAUSE_MS);
  }
  return resolved;
};

const beaches = readBeaches();

if (checkMode) {
  if (!fs.existsSync(OUT_PATH)) {
    console.error('FAILED: no baked cell map to check. Run without --check first.');
    process.exit(1);
  }
  const baked = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  const missing = beaches.filter(b => !baked.cells[String(b.id)]);
  // Deterministic spread rather than random: a fixed stride re-checks the same beaches every
  // run, so drift shows up as a change in THIS answer rather than as sampling noise.
  const stride = Math.max(1, Math.floor(beaches.length / sampleSize));
  const sample = beaches.filter((_, i) => i % stride === 0).slice(0, sampleSize);
  const resolved = await probe(sample);

  const drifted = [];
  for (const [key, entry] of resolved) {
    const was = baked.cells[String(entry.id)];
    if (was && was !== entry.cell) drifted.push(`${entry.name} [${entry.region}] ${was} -> ${entry.cell}`);
  }

  if (missing.length || drifted.length) {
    if (missing.length) console.error(`FAILED: ${missing.length} beach(es) have no baked forecast cell, e.g. ${missing.slice(0, 5).map(b => b.name).join(', ')}`);
    if (drifted.length) {
      console.error(`FAILED: ${drifted.length}/${sample.length} sampled beaches moved model cell — the baked map is stale.`);
      drifted.slice(0, 10).forEach(line => console.error(`  ${line}`));
      console.error('\nRe-bake with: node scripts/bakeForecastModelCells.mjs');
    }
    process.exit(1);
  }
  console.log(`OK: ${sample.length} sampled beaches still resolve to their baked cell; ${beaches.length} beaches carry one.`);
  process.exit(0);
}

console.log(`Probing ${beaches.length} beaches against ${ORIGIN} ...`);
const resolved = await probe(beaches);
const cells = {};
for (const entry of resolved.values()) cells[String(entry.id)] = entry.cell;

const distinct = new Set(Object.values(cells));
const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'Open-Meteo best_match, cell_selection=land (default) — the cell the app itself reads',
  hourly: HOURLY,
  beachCount: Object.keys(cells).length,
  distinctCells: distinct.size,
  cells,
};
fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 0)}\n`, 'utf8');
console.log(`Wrote ${Object.keys(cells).length} beaches into ${distinct.size} distinct model cells -> ${path.relative(rootDir, OUT_PATH)}`);
