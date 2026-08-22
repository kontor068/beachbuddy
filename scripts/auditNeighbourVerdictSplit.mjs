#!/usr/bin/env node
/**
 * ΤΙ ΑΠΟ ΤΟ ΧΑΣΜΑ ΤΩΝ ΓΕΙΤΟΝΩΝ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ.
 *
 * Δεύτερο σκέλος του auditNeighbourWaveSplit: εκείνο μετράει το ΩΜΟ νούμερο του μοντέλου στα
 * δύο σημεία· αυτό τρέχει τον ΙΔΙΟ βαθμολογητή που τρέχει η σελίδα και δείχνει τι τυπώνεται
 * τελικά και τι χρώμα βγαίνει. Χωρίς αυτό δεν ξέρουμε αν το χάσμα το έχουν ήδη σβήσει τα
 * δάπεδα και ο φραγμός ασθενούς ανέμου.
 *
 * Report-only.  node scripts/auditNeighbourVerdictSplit.mjs
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (m, f) => {
  m._compile(ts.transpileModule(readFileSync(f, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: f,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), f);
};
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const report = JSON.parse(readFileSync(path.join(root, 'reports/weather/neighbour-wave-split.json'), 'utf8'));
const byRegion = new Map();
for (const f of report.results) {
  if (!byRegion.has(f.region)) byRegion.set(f.region, []);
  byRegion.get(f.region).push(f);
}

const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const HOURS = [10, 13, 16, 19];
const rows = [];

for (const [region, findings] of byRegion) {
  const island = JSON.parse(readFileSync(path.join(summaryDir, `${region}.json`), 'utf8')).island;
  const profiles = JSON.parse(readFileSync(path.join(exposureDir, `${region}.json`), 'utf8')).profiles;
  const clusters = buildBeachForecastClusters(island.beaches);
  const ids = new Set(findings.flatMap(f => [f.a.id, f.b.id]));
  const dayById = new Map();

  for (const id of ids) {
    const beach = island.beaches.find(b => b.id === id);
    const profile = profiles[String(id)];
    if (!beach || !profile) continue;
    const cluster = clusters.find(c => c.beachIds.includes(id));
    const wind = (await fetchForecastDataBatch([{ lat: cluster.lat, lon: cluster.lon }])).get(forecastPointKey(cluster.lat, cluster.lon))?.data;
    const mp = profile.marineSamplePoint;
    const marine = mp ? ((await fetchMarineForecastDataBatch([{ lat: mp.lat, lon: mp.lon }])).get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    dayById.set(id, { beach, profile, day: processForecastData(mergeMarineForecastData(wind, marine))[0] });
  }

  const scoreAt = (id, hour) => {
    const e = dayById.get(id);
    if (!e?.day?.hourly?.[hour]) return null;
    const h = e.day.hourly[hour];
    const s = calculateBeachScore(e.beach, { ...e.day, ...h, hourly: e.day.hourly }, undefined, undefined,
      { weatherSource: 'beach-cluster', hourlyForecast: e.day.hourly, geospatialProfile: e.profile });
    return { printed: s.shoreDisplayWaveM ?? s.waveHeightM, comfort: s.swimmingComfort, score: s.finalSuitabilityScore, exposure: s.exposureLevel, open: s.marine?.waveHeightM };
  };

  for (const f of findings) {
    for (const hour of HOURS) {
      const A = scoreAt(f.a.id, hour), B = scoreAt(f.b.id, hour);
      if (!A || !B) continue;
      rows.push({
        region, hour, aId: f.a.id, aName: f.a.name, bId: f.b.id, bName: f.b.name,
        beachKm: f.beachKm, facingDiff: f.facingDiff,
        openA: A.open, openB: B.open,
        printedA: A.printed, printedB: B.printed, printedDelta: Number(Math.abs((A.printed ?? 0) - (B.printed ?? 0)).toFixed(2)),
        comfortA: A.comfort, comfortB: B.comfort, comfortSplit: A.comfort !== B.comfort,
        scoreA: A.score, scoreB: B.score,
      });
    }
  }
}

const printedSplits = rows.filter(r => r.printedDelta >= 0.2);
const comfortSplits = rows.filter(r => r.comfortSplit);
console.log(`\nώρες×ζεύγη που εξετάστηκαν: ${rows.length}`);
console.log(`  με διαφορά ≥0,20 μ. στο ΤΥΠΩΜΕΝΟ νούμερο: ${printedSplits.length}`);
console.log(`  με ΔΙΑΦΟΡΕΤΙΚΟ χαρακτηρισμό (χρώμα): ${comfortSplits.length}`);
const shown = new Set();
for (const r of rows.filter(x => x.comfortSplit || x.printedDelta >= 0.2).sort((a, b) => b.printedDelta - a.printedDelta)) {
  const key = `${r.aId}-${r.bId}`;
  if (shown.has(key)) continue;
  shown.add(key);
  console.log(`${String(r.hour).padStart(2)}:00 ${r.aName}#${r.aId} ${r.printedA}μ/${r.comfortA} (ανοιχτά ${r.openA}) `
    + `vs ${r.bName}#${r.bId} ${r.printedB}μ/${r.comfortB} (ανοιχτά ${r.openB}) — ${r.beachKm}χλμ, Δγωνία ${r.facingDiff}°`);
}
writeFileSync(path.join(root, 'reports/weather/neighbour-verdict-split.json'),
  JSON.stringify({ measuredAt: new Date().toISOString(), hours: HOURS, rows }, null, 1));
console.log('\nΑναφορά: reports/weather/neighbour-verdict-split.json');
