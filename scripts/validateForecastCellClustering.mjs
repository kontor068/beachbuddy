#!/usr/bin/env node
/**
 * NO FORECAST POINT MAY SPEAK FOR A BEACH IN ANOTHER MODEL CELL.
 *
 * Runs the SHIPPED clustering (utils/beachForecastClusters.ts), not a copy of it — the lesson
 * from scripts/validateEffectiveRanking.ts is that a gate which re-implements its subject passes
 * green against deliberately sabotaged code.
 *
 * Four gates:
 *   1. every beach carries a baked forecastCell                     (the map is complete)
 *   2. every cluster's members share one cell                       (the split actually ran)
 *   3. every cluster's sampling point IS a member beach coordinate  (never a synthetic centroid)
 *   4. the sampling point's own cell is the cluster's cell          (the point we send is the
 *                                                                    point we measured)
 *
 * Gate 3 is the one that matters most and is easiest to lose: a centroid is a coordinate nobody
 * ever probed, so nothing guarantees which cell Open-Meteo answers it from. Elafonisi (15/08/2026)
 * is the worked example — its centroid resolved to a 34 m cell reading 50.9 km/h while the beach
 * sat in a 1 m cell reading 43.2 km/h, and the card said 7 Bft for a beach having 6.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { buildBeachForecastClusters } = require(path.join(rootDir, 'utils/beachForecastClusters.ts'));

const summaryDir = path.join(rootDir, 'public', 'data', 'beaches', 'app', 'summary');
const bakedPath = path.join(rootDir, 'data', 'forecast-cells.generated.json');
const baked = JSON.parse(fs.readFileSync(bakedPath, 'utf8')).cells;

const failures = [];
let totalBeaches = 0;
let totalClusters = 0;
let splitClusters = 0;
let missingCell = 0;

for (const file of fs.readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const region = file.replace('.json', '');
  const parsed = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8'));
  const beaches = parsed.island?.beaches || parsed.beaches;
  if (!Array.isArray(beaches) || beaches.length === 0) continue;

  for (const beach of beaches) {
    totalBeaches += 1;
    if (!beach.forecastCell) {
      missingCell += 1;
      if (failures.length < 40) failures.push(`[1] ${region}#${beach.id} ${beach.name}: no baked forecastCell`);
      continue;
    }
    if (baked[String(beach.id)] && baked[String(beach.id)] !== beach.forecastCell) {
      failures.push(`[1] ${region}#${beach.id}: built cell ${beach.forecastCell} != baked ${baked[String(beach.id)]}`);
    }
  }

  const byId = new Map(beaches.map(b => [b.id, b]));
  const clusters = buildBeachForecastClusters(beaches);
  totalClusters += clusters.length;

  for (const cluster of clusters) {
    const members = cluster.beachIds.map(id => byId.get(id)).filter(Boolean);
    if (members.length !== cluster.beachIds.length) {
      failures.push(`[2] ${region} cluster ${cluster.key}: member id not found in the region`);
      continue;
    }
    if (members.length > 1) splitClusters += 1;

    const cells = new Set(members.map(m => m.forecastCell));
    if (cells.size > 1) {
      failures.push(`[2] ${region} cluster ${cluster.key} spans ${cells.size} model cells: ${[...cells].join(' + ')}`);
      continue;
    }

    // Gate 3 — the point sent to Open-Meteo must be a real beach we probed, not a centroid.
    const onABeach = members.find(m =>
      Math.abs(m.coordinates.lat - cluster.lat) < 1e-9 && Math.abs(m.coordinates.lon - cluster.lon) < 1e-9);
    if (!onABeach) {
      failures.push(`[3] ${region} cluster ${cluster.key}: sampling point is not any member's coordinate`);
      continue;
    }
    // Gate 4 — and that beach's measured cell must be the cluster's cell.
    if (onABeach.forecastCell !== [...cells][0]) {
      failures.push(`[4] ${region} cluster ${cluster.key}: point beach cell ${onABeach.forecastCell} != cluster cell ${[...cells][0]}`);
    }
  }
}

console.log(`Beaches ${totalBeaches} · clusters ${totalClusters} · multi-beach clusters ${splitClusters} · beaches without a baked cell ${missingCell}`);

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} forecast-cell clustering violation(s).`);
  failures.slice(0, 25).forEach(line => console.error(`  ${line}`));
  if (failures.length > 25) console.error(`  ... and ${failures.length - 25} more`);
  console.error('\nIf the beach data was rebuilt without the bake, run: node scripts/bakeForecastModelCells.mjs');
  process.exit(1);
}

console.log('OK: every forecast point sits on a real beach, and no point speaks for a beach in another model cell.');
