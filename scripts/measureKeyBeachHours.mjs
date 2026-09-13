#!/usr/bin/env node
/**
 * ΟΙ ΚΡΙΣΙΜΕΣ ΩΡΕΣ 10-18 → 10-20: ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΕΤΥΜΗΓΟΡΙΑ, ΕΘΝΙΚΑ (12/09/2026, βίβλος §Γ81 Δ8) — ΜΕΤΡΗΣΗ ΠΡΙΝ ΜΠΕΙ.
 *
 * Τρέχει την ΠΡΑΓΜΑΤΙΚΗ βαθμολογία (calculateBeachScore) για κάθε παραλία της χώρας, δύο φορές: με το παράθυρο
 * που είχε ο κώδικας ως τις 12/09 (τέλος 18) και με το νέο (τέλος 20) — αλλάζοντας ΜΟΝΟ το utils/beachDayWindow
 * μέσα στη διεργασία, ώστε να μετρηθεί ο ίδιος ο κώδικας και όχι αντίγραφό του. Καταγράφει ανά παραλία την
 * ετυμηγορία (excellent/good/caution/avoid), τους πόντους κολύμβησης, το ενεργό Μποφόρ, και προς τα πού πήγε.
 *
 * ΤΙ ΠΕΡΙΜΕΝΟΥΜΕ: μόνο αυστηρότερα (οι ώρες 19-20 προσθέτουν ριπή/δυνάμωμα/χειρότερη ώρα), εκτός από τη βροχή
 * «σε όλες τις κρίσιμες ώρες» που γίνεται σπανιότερη. Ό,τι πάει προς το ηπιότερο γράφεται χωριστά.
 *
 *   node scripts/measureKeyBeachHours.mjs [--day=0]
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
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) { module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename); return; }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React }, fileName: filename }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const dayWindow = require(path.join(root, 'utils/beachDayWindow.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const DAY_INDEX = Number(args.find(a => a.startsWith('--day='))?.slice(6) ?? 0);
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const VARIANTS = [{ key: 'before', end: 18 }, { key: 'after', end: 20 }];
const ORDER = ['excellent', 'good', 'caution', 'avoid', 'avoid_swimming'];
if (dayWindow.KEY_BEACH_HOURS.end !== 20) { console.error(`το utils/beachDayWindow λέει end=${dayWindow.KEY_BEACH_HOURS.end}, περίμενα 20`); process.exit(1); }

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
const pace = async (count) => { for (;;) { const cutoff = performance.now() - 60_000; while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift(); const spent = pointWindow.reduce((s, e) => s + e.count, 0); if (spent + count <= POINTS_PER_MINUTE) break; await sleep(Math.max(1000, pointWindow[0].at + 60_000 - performance.now())); } pointWindow.push({ at: performance.now(), count }); };

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
      const key = resolution.keyByBeachId.get(beach.id);
      const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
      const row = { beachId: beach.id, name: beach.name?.en ?? null, regionId: region.regionId };
      for (const v of VARIANTS) {
        dayWindow.KEY_BEACH_HOURS.end = v.end;
        const s = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        row[v.key] = { comfort: s.swimmingComfort ?? null, score: typeof s.swimmingScore === 'number' ? Math.round(s.swimmingScore) : null, effBft: s.effectiveBeaufort ?? null };
      }
      dayWindow.KEY_BEACH_HOURS.end = 20;
      // ΤΟ «ΓΙΑΤΙ» (13/09/2026): όταν η ετυμηγορία αλλάζει, ποιο σήμα των ωρών 19-20 ξεπέρασε το μέγιστο των 10-18;
      // «άνεμος» = ο μέσος άνεμος έχει ψηλότερη ώρα στις 19-20 (χειρότερη ώρα / απογευματινό δυνάμωμα)·
      // «ριπή» = το άλμα ριπή−μέσος είναι ψηλότερο στις 19-20 ΚΑΙ περνάει το όριο του σκαλιού για το Μποφόρ βάσης
      // (34/32/26/22, Δ5-Β)· «και τα δύο» / «άλλο» (βροχή, κύμα της ώρας, μόνο πόντοι). Μόνο διάγνωση, δεν αλλάζει τίποτα.
      if (row.before.comfort !== row.after.comfort) {
        const hours = (dayForecast.hourly ?? []).map(h => ({ hour: new Date(h.dt * 1000).getHours(), windKmh: (h.wind?.speed ?? 0) * 3.6, spreadKmh: typeof h.wind?.gust === 'number' ? (h.wind.gust - (h.wind.speedBeforeGustFloor ?? h.wind.speed ?? 0)) * 3.6 : null }));
        const core = hours.filter(h => h.hour >= 10 && h.hour <= 18), added = hours.filter(h => h.hour >= 19 && h.hour <= 20);
        const max = (list, pick) => list.reduce((m, h) => (pick(h) == null ? m : Math.max(m, pick(h))), -Infinity);
        const coreWind = max(core, h => h.windKmh), addedWind = max(added, h => h.windKmh);
        const coreSpread = max(core, h => h.spreadKmh), addedSpread = max(added, h => h.spreadKmh);
        const baseBft = getBeaufortLevel(Math.max(coreWind, Number.isFinite(addedWind) ? addedWind : 0));
        const stepT = { 3: 34, 4: 32, 5: 26 }[baseBft] ?? 22;
        const windRose = Number.isFinite(addedWind) && addedWind > coreWind + 0.5;
        const spreadStep = Number.isFinite(addedSpread) && addedSpread > coreSpread && addedSpread >= stepT && baseBft >= 3;
        row.cause = windRose && spreadStep ? 'άνεμος + ριπή 19-20' : windRose ? 'άνεμος 19-20 (χειρότερη ώρα)' : spreadStep ? 'ριπή 19-20 (σκαλί +1)' : 'άλλο (βροχή / κύμα ώρας / πόντοι)';
        row.signals = { coreWindKmh: Math.round(coreWind), addedWindKmh: Number.isFinite(addedWind) ? Math.round(addedWind) : null, coreSpreadKmh: Number.isFinite(coreSpread) ? Math.round(coreSpread) : null, addedSpreadKmh: Number.isFinite(addedSpread) ? Math.round(addedSpread) : null, baseBft, stepT };
      }
      rows.push(row);
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές · ${rows.length} παραλίες`);
    await sleep(200);
  } catch (e) { process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
process.stderr.write('\n');

const comfortIdx = c => ORDER.indexOf(c);
const changed = rows.filter(r => r.before.comfort !== r.after.comfort);
const stricter = changed.filter(r => comfortIdx(r.after.comfort) > comfortIdx(r.before.comfort));
const softer = changed.filter(r => comfortIdx(r.after.comfort) < comfortIdx(r.before.comfort));
const moves = {};
for (const r of changed) { const k = `${r.before.comfort} → ${r.after.comfort}`; moves[k] = (moves[k] || 0) + 1; }
const scoreDelta = rows.map(r => (r.after.score ?? 0) - (r.before.score ?? 0));
const scoreDown = scoreDelta.filter(d => d < 0).length, scoreUp = scoreDelta.filter(d => d > 0).length;
const report = {
  generatedAt: new Date().toISOString(), dayIndex: DAY_INDEX, regions: done, beaches: rows.length,
  change: 'KEY_BEACH_HOURS.end 18 → 20 (utils/beachDayWindow) — ετυμηγορία, ριπές, βροχή, απογευματινό δυνάμωμα',
  verdict: { changed: changed.length, stricter: stricter.length, softer: softer.length, moves },
  causes: { stricter: (() => { const o = {}; for (const r of stricter) o[r.cause ?? '?'] = (o[r.cause ?? '?'] || 0) + 1; return o; })(), softer: (() => { const o = {}; for (const r of softer) o[r.cause ?? '?'] = (o[r.cause ?? '?'] || 0) + 1; return o; })(),
    note: '13/09/2026: «άνεμος 19-20» = ο μέσος άνεμος κορυφώνει μετά τις 18 (χειρότερη ώρα / δυνάμωμα)· «ριπή 19-20» = το άλμα ριπής των 19-20 περνάει το όριο του σκαλιού (34/32/26/22)· «άλλο» = βροχή, κύμα της ώρας ή μόνο πόντοι.' },
  score: { down: scoreDown, up: scoreUp, unchanged: rows.length - scoreDown - scoreUp, medianDownDelta: (() => { const d = scoreDelta.filter(x => x < 0).sort((a, b) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; })() },
  distributionBefore: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r.before.comfort === c).length])),
  distributionAfter: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r.after.comfort === c).length])),
  softerSamples: softer.slice(0, 20), stricterSamples: stricter.slice(0, 20),
  note: 'Δ8 (§Γ81): μία μέρα με τον καιρό που έτυχε. Το «ηπιότερο» μπορεί να προέρχεται μόνο από τη βροχή σε όλες τις κρίσιμες ώρες — έλεγξέ το στα softerSamples.',
};
const out = path.join(root, 'reports/weather', `key-beach-hours-${new Date().toISOString().slice(0, 10)}${DAY_INDEX ? `-d${DAY_INDEX}` : ''}.json`);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nΩΡΕΣ 10-18 → 10-20, μέρα +${DAY_INDEX}: ${rows.length} παραλίες, ${done} περιοχές`);
console.log(`  ετυμηγορία αλλάζει: ${changed.length} (αυστηρότερη ${stricter.length} · ηπιότερη ${softer.length}) · ${JSON.stringify(moves)}`);
console.log(`  γιατί (αυστηρότερες): ${JSON.stringify(report.causes.stricter)}`);
console.log(`  πόντοι: κάτω ${scoreDown} · πάνω ${scoreUp} · ίδιοι ${report.score.unchanged} · διάμεση πτώση ${report.score.medianDownDelta}`);
console.log(`  πριν ${JSON.stringify(report.distributionBefore)}\n  μετά ${JSON.stringify(report.distributionAfter)}`);
console.log(`→ ${path.relative(root, out)}`);
