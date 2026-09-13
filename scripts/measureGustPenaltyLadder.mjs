#!/usr/bin/env node
/**
 * Η ΣΚΑΛΑ ΠΟΝΤΩΝ ΤΗΣ ΡΙΠΗΣ ΑΝΑ ΜΠΟΦΟΡ ΒΑΣΗΣ — ΜΕΤΡΗΣΗ ΕΤΥΜΗΓΟΡΙΩΝ, ΟΧΙ ΑΛΛΑΓΗ (13/09/2026, βίβλος §Γ81 Δ5-Γ).
 *
 * Μετά το σκαλί «+1 ενεργό Μποφόρ» (Δ5-Β, LIVE 13/09: όριο 34/32/26/22 ανά Μποφόρ βάσης 3/4/5/≥6), μένει η ΔΕΥΤΕΡΗ
 * γραμμή που διαβάζει το ίδιο άλμα ριπής: η σκάλα πόντων στο swimmingScore —
 *   ριπή−μέσος ≥35 → −18 (protected −8) · ≥22 → −10 (−4) · ≥14 → −5 (−2), μόνο σε ≥3 Μπφ βάσης.
 * Η ίδια φούσκα της Δ5 (ριπή μοντέλου − οργάνου: 3 Μπφ +11,9 · 4 +9,8 · 5 +4,5 · 6+ ≤0) περνάει και από εδώ.
 * Ερώτηση: αν τα τρία σκαλοπάτια μετατοπιστούν κατά τη φούσκα ανά Μποφόρ βάσης (+12 / +10 / +4 / 0), πόσες
 * ετυμηγορίες αλλάζουν, προς τα πού, και πόσες «μην κολυμπήσεις» σηκώνονται;
 *
 * ΠΩΣ: ξαναγράφονται ΜΟΝΟ οι τρεις γραμμές της σκάλας κατά τη φόρτωση (ακριβώς μία αντικατάσταση, αλλιώς σταματά),
 * ώστε να διαβάζουν `globalThis.__CB_GUST_LADDER(spread, baseBeaufort, exposure)` αν υπάρχει· χωρίς αυτό, η σκάλα
 * της παραγωγής. Το σκαλί +1 και όλα τα άλλα μένουν όπως στην παραγωγή. Παραλλαγές:
 *   prod      14/22/35 για όλους (παραγωγή, βάση σύγκρισης)
 *   bftShift  3 Μπφ 26/34/47 · 4 Μπφ 24/32/45 · 5 Μπφ 18/26/39 · ≥6 14/22/35   (η πρόταση)
 *   shiftAll  26/34/47 για όλους                                              (ό,τι θα έκανε ένα σκέτο +12)
 *   none      καμία ποινή ριπής                                                (το συνολικό αποτύπωμα της σκάλας)
 *
 *   node scripts/measureGustPenaltyLadder.mjs [--day=0]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
const openMeteoKey = await resolveOpenMeteoKey();
const PAID_HOST = { 'https://api.open-meteo.com': 'https://customer-api.open-meteo.com', 'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com' };
if (openMeteoKey) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url === 'string') for (const [free, paid] of Object.entries(PAID_HOST)) if (url.startsWith(free)) return originalFetch(`${paid}${url.slice(free.length)}&apikey=${encodeURIComponent(openMeteoKey)}`, init);
    return originalFetch(input, init);
  };
}

const LADDER_BLOCK = [
  "    if (gustSpreadKmph >= 35) swimmingScore -= finalExposureLevel === 'protected' ? 8 : 18;",
  "    else if (gustSpreadKmph >= 22) swimmingScore -= finalExposureLevel === 'protected' ? 4 : 10;",
  "    else if (gustSpreadKmph >= 14) swimmingScore -= finalExposureLevel === 'protected' ? 2 : 5;",
].join('\n');
const LADDER_MEASURE = "    swimmingScore -= globalThis.__CB_GUST_LADDER ? globalThis.__CB_GUST_LADDER(gustSpreadKmph, baseBeaufort, finalExposureLevel) : (gustSpreadKmph >= 35 ? (finalExposureLevel === 'protected' ? 8 : 18) : gustSpreadKmph >= 22 ? (finalExposureLevel === 'protected' ? 4 : 10) : gustSpreadKmph >= 14 ? (finalExposureLevel === 'protected' ? 2 : 5) : 0);";
// Κώδικας ΑΠΟ 13/09/2026 (σκάλα ανά Μποφόρ βάσης, gustPenaltyStepsKmh): ξαναγράφεται το ίδιο μπλοκ στη νέα του μορφή. Η
// βάση σύγκρισης «prod» παραμένει η ΠΑΛΙΑ σκάλα (14/22/35 παντού), ώστε η μέτρηση να απαντά και μετά την αλλαγή «πόσο ηπιότερα από πριν».
const LADDER_BLOCK_V2 = [
  '    const [minor, major, severe] = gustPenaltyStepsKmh(baseBeaufort);',
  "    if (gustSpreadKmph >= severe) swimmingScore -= finalExposureLevel === 'protected' ? 8 : 18;",
  "    else if (gustSpreadKmph >= major) swimmingScore -= finalExposureLevel === 'protected' ? 4 : 10;",
  "    else if (gustSpreadKmph >= minor) swimmingScore -= finalExposureLevel === 'protected' ? 2 : 5;",
].join('\n');
const LADDER_MEASURE_V2 = "    swimmingScore -= globalThis.__CB_GUST_LADDER ? globalThis.__CB_GUST_LADDER(gustSpreadKmph, baseBeaufort, finalExposureLevel) : (() => { const [minor, major, severe] = gustPenaltyStepsKmh(baseBeaufort); return gustSpreadKmph >= severe ? (finalExposureLevel === 'protected' ? 8 : 18) : gustSpreadKmph >= major ? (finalExposureLevel === 'protected' ? 4 : 10) : gustSpreadKmph >= minor ? (finalExposureLevel === 'protected' ? 2 : 5) : 0; })();";
let rewrites = 0;
let codeShape = null;
const rewriteOnce = (source, from, to, what) => {
  const count = source.split(from).length - 1;
  if (count !== 1) { console.error(`περίμενα ακριβώς 1 «${what}» στο recommendationService, βρήκα ${count}`); process.exit(1); }
  rewrites += 1;
  return source.replace(from, to);
};
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) { module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename); return; }
  let source = readFileSync(filename, 'utf8');
  if (filename.endsWith(`${path.sep}services${path.sep}recommendationService.ts`)) {
    source = source.replace(/\r\n/g, '\n');
    if (source.includes(LADDER_BLOCK_V2)) { codeShape = 'per-beaufort (από 13/09/2026)'; source = rewriteOnce(source, LADDER_BLOCK_V2, LADDER_MEASURE_V2, 'σκάλα πόντων ριπής ανά Μποφόρ (4 γραμμές)'); }
    else { codeShape = 'uniform 14/22/35 (ως 13/09/2026)'; source = rewriteOnce(source, LADDER_BLOCK, LADDER_MEASURE, 'σκάλα πόντων ριπής (3 γραμμές)'); }
  }
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React }, fileName: filename }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));
if (rewrites !== 1) { console.error(`η σκάλα πόντων δεν ξαναγράφτηκε (${rewrites}/1)`); process.exit(1); }

const args = process.argv.slice(2);
const DAY_INDEX = Number(args.find(a => a.startsWith('--day='))?.slice(6) ?? 0);
const PROD = [14, 22, 35];
const PENALTY = (spread, exposure, steps) => {
  const p = exposure === 'protected';
  if (spread >= steps[2]) return p ? 8 : 18;
  if (spread >= steps[1]) return p ? 4 : 10;
  if (spread >= steps[0]) return p ? 2 : 5;
  return 0;
};
// Μετατόπιση = η φούσκα της Δ5 ανά Μποφόρ βάσης, όπως στο σκαλί (34/32/26 = 22 + 12/10/4).
const SHIFT = { 3: 12, 4: 10, 5: 4 };
const shifted = (bft) => PROD.map(s => s + (SHIFT[bft] ?? 0));
const VARIANTS = [
  // «prod» = η παλιά σκάλα (14/22/35 για όλους), ρητά — ίδια βάση σύγκρισης πριν και μετά την αλλαγή του κώδικα.
  { key: 'prod', fn: (spread, bft, exposure) => PENALTY(spread, exposure, PROD) },
  { key: 'bftShift', fn: (spread, bft, exposure) => PENALTY(spread, exposure, shifted(bft)) },
  { key: 'shiftAll', fn: (spread, bft, exposure) => PENALTY(spread, exposure, PROD.map(s => s + 12)) },
  { key: 'none', fn: () => 0 },
];
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const ORDER = ['excellent', 'good', 'caution', 'avoid', 'avoid_swimming'];
const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const p of Object.values(profilesRaw ?? {})) if (p?.beachId != null) profiles[p.beachId] = p;
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch { return null; }
};
const regions = readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json').map(loadRegion).filter(Boolean).filter(r => r.regionPoint && Number.isFinite(r.regionPoint.lat));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pointWindow = []; const POINTS_PER_MINUTE = openMeteoKey ? 600 : 120;
const pace = async (count) => { for (;;) { const cutoff = performance.now() - 60_000; while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift(); const used = pointWindow.reduce((s, p) => s + p.n, 0); if (used + count <= POINTS_PER_MINUTE) break; await sleep(Math.max(1000, pointWindow[0].at + 60_000 - performance.now())); } pointWindow.push({ at: performance.now(), n: count }); };

const rows = [];
let done = 0;
for (const region of regions) {
  try {
    const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    await pace(resolution.points.length + 1);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch([region.regionPoint]), fetchMarineForecastDataBatch(resolution.points)]);
    const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
    if (!wind) continue;
    const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
    const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
    if (!regionDay) continue;
    for (const beach of region.beaches) {
      const k = resolution.keyByBeachId.get(beach.id);
      const beachMarine = k !== resolution.regionKey ? (marineByPoint.get(k)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
      const row = { beachId: beach.id, name: beach.name?.en ?? null, regionId: region.regionId };
      for (const v of VARIANTS) {
        globalThis.__CB_GUST_LADDER = v.fn;
        const s = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        const windKmh = typeof s.windSpeedKmph === 'number' ? s.windSpeedKmph : null;
        row[v.key] = { comfort: s.swimmingComfort ?? null, score: typeof s.swimmingScore === 'number' ? Math.round(s.swimmingScore) : null, exposure: s.exposureLevel ?? null, windKmh: windKmh === null ? null : Math.round(windKmh), bft: windKmh === null ? null : getBeaufortLevel(windKmh) };
      }
      globalThis.__CB_GUST_LADDER = undefined;
      rows.push(row);
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές · ${rows.length} παραλίες`);
    await sleep(200);
  } catch (e) { process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
globalThis.__CB_GUST_LADDER = undefined;
process.stderr.write('\n');

const comfortIdx = c => ORDER.indexOf(c);
const median = (arr) => { const d = [...arr].sort((a, b) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; };
const prod = 'prod';
const countBy = (list, pick) => { const o = {}; for (const r of list) { const k = pick(r) ?? 'unknown'; o[k] = (o[k] || 0) + 1; } return o; };
const variants = {};
for (const vdef of VARIANTS.slice(1)) {
  const v = vdef.key;
  const changed = rows.filter(r => r[prod].comfort !== r[v].comfort);
  const softer = changed.filter(r => comfortIdx(r[v].comfort) < comfortIdx(r[prod].comfort));
  const stricter = changed.filter(r => comfortIdx(r[v].comfort) > comfortIdx(r[prod].comfort));
  const moves = {};
  for (const r of changed) { const m = `${r[prod].comfort} → ${r[v].comfort}`; moves[m] = (moves[m] || 0) + 1; }
  const scoreDelta = rows.map(r => (r[v].score ?? 0) - (r[prod].score ?? 0));
  const avoidLifted = softer.filter(r => r[prod].comfort === 'avoid_swimming');
  variants[v] = {
    ladder: v === 'bftShift' ? { 3: shifted(3), 4: shifted(4), 5: shifted(5), '≥6': PROD } : v === 'shiftAll' ? PROD.map(s => s + 12) : 'none',
    verdict: { changed: changed.length, softer: softer.length, stricter: stricter.length, expectedStricter: 0, moves,
      softerByExposure: countBy(softer, r => r[prod].exposure), softerByBaseBeaufort: countBy(softer, r => r[prod].bft),
      avoidLifted: { count: avoidLifted.length, byBaseBeaufort: countBy(avoidLifted, r => r[prod].bft), byExposure: countBy(avoidLifted, r => r[prod].exposure) } },
    score: { up: scoreDelta.filter(d => d > 0).length, down: scoreDelta.filter(d => d < 0).length, medianUpDelta: median(scoreDelta.filter(d => d > 0)), upByBaseBeaufort: countBy(rows.filter((r, i) => scoreDelta[i] > 0), r => r[prod].bft) },
    distributionAfter: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r[v].comfort === c).length])),
    softerSamples: softer.slice(0, 20).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
    avoidLiftedSamples: avoidLifted.slice(0, 12).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
    stricterSamples: stricter.slice(0, 20).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
  };
}
const report = {
  generatedAt: new Date().toISOString(), dayIndex: DAY_INDEX, regions: done, beaches: rows.length, codeShape,
  change: 'Σκάλα πόντων ριπής στο swimmingScore (services/recommendationService, ≥3 Μπφ βάσης): ≥14/≥22/≥35 → −5/−10/−18 (protected −2/−4/−8). Μετράται μετατόπιση των σκαλοπατιών κατά τη φούσκα της Δ5 ανά Μποφόρ βάσης (+12/+10/+4/0). Το σκαλί «+1 ενεργό Μποφόρ» (ήδη ανά Μποφόρ, LIVE 13/09) και όλα τα υπόλοιπα μένουν όπως στην παραγωγή.',
  evidence: 'Δ5 §Γ81: gust-spread-vs-stations-2026-09-12.json — ριπή μοντέλου − οργάνου ανά Μποφόρ οργάνου: 3 +11,9 · 4 +9,8 · 5 +4,5 · 6 −0,9 · 7 −5,7 · 8 −10,4. Όριο: η φούσκα μετρήθηκε ανά Μποφόρ ΟΡΓΑΝΟΥ, η σκάλα κρίνει με Μποφόρ ΜΟΝΤΕΛΟΥ.',
  production: { ladder: PROD, distribution: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r[prod].comfort === c).length])), byBaseBeaufort: countBy(rows, r => r[prod].bft) },
  variants,
  note: 'Μία μέρα με τον καιρό που έτυχε. Μετατόπιση προς τα πάνω = η ποινή πέφτει σπανιότερα → μόνο ηπιότερο· ό,τι αυστηρότερο = ανωμαλία (stricterSamples). Το «none» δείχνει το συνολικό αποτύπωμα της σκάλας, όχι πρόταση.',
};
const out = path.join(root, 'reports/weather', `gust-penalty-ladder-${new Date().toISOString().slice(0, 10)}${DAY_INDEX ? `-d${DAY_INDEX}` : ''}.json`);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nΣΚΑΛΑ ΠΟΝΤΩΝ ΡΙΠΗΣ, μέρα +${DAY_INDEX}: ${rows.length} παραλίες, ${done} περιοχές · παραγωγή ${JSON.stringify(report.production.distribution)} · Μπφ βάσης ${JSON.stringify(report.production.byBaseBeaufort)}`);
for (const [v, r] of Object.entries(variants)) {
  console.log(`  ${v}: ετυμηγορία ${r.verdict.changed} (ηπιότερη ${r.verdict.softer} · αυστηρότερη ${r.verdict.stricter}) ${JSON.stringify(r.verdict.moves)} · ανά Μπφ βάσης ${JSON.stringify(r.verdict.softerByBaseBeaufort)} · ανά έκθεση ${JSON.stringify(r.verdict.softerByExposure)}`);
  console.log(`         «μην κολυμπήσεις» → ηπιότερο: ${r.verdict.avoidLifted.count} ${JSON.stringify(r.verdict.avoidLifted.byBaseBeaufort)} · πόντοι πάνω ${r.score.up} ${JSON.stringify(r.score.upByBaseBeaufort)} (διάμεσος +${r.score.medianUpDelta})`);
}
console.log(`→ ${path.relative(root, out)}`);
