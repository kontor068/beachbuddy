#!/usr/bin/env node
/**
 * ΠΟΣΟ «ΙΔΑΝΙΚΗ» ΠΟΥΛΑΜΕ 4-5 ΜΕΡΕΣ ΜΠΡΟΣΤΑ; (12/09/2026, βίβλος §Γ81 Δ10) — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * Το φρένο αβεβαιότητας (§ΑΞ3) είναι σβηστό στην πράξη από 11/09 (χωρίς Professional η πηγή των 51 σεναρίων
 * δεν απαντά). Η μέτρηση της §Γ53 λέει ότι στην +5 μέρα «φαίνεται καλή, δεν είναι» στο 22% των ωρών κολύμβησης
 * (4,6% στην +3, 32% στην +5). Ο τουρίστας που κλείνει 5 μέρες μπροστά είναι ο χρήστης-στόχος. Ερώτηση: πόσες
 * παραλίες βάφονται ΜΠΛΕ («Ιδανική») και πόσες παίρνουν ετυμηγορία «ιδανικά» στις μέρες +4 και +5, σήμερα;
 * Αυτό είναι το μέγεθος που θα άγγιζε ένα στατικό, μονόδρομο φρένο «lead ≥ 4 → όχι Ιδανική».
 *
 * ⚠️ ΔΟΓΜΑ: η πύλη forecast-uncertainty-brake απαιτεί «χωρίς δεδομένα ο πίνακας ημερών επιστρέφεται αυτούσιος»
 * (§ΑΞ3 κανόνας 3: άγνωστο ≠ αβέβαιο). Ένα στατικό φρένο είναι ΝΕΟΣ κανόνας, όχι επέκταση — γι' αυτό εδώ ΜΟΝΟ
 * μετριέται. Η απόφαση είναι του Μίλτου.
 *
 *   node scripts/measureHorizonBlue.mjs [--days=4,5]
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
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const DAYS = (args.find(a => a.startsWith('--days='))?.slice(7) ?? '4,5').split(',').map(Number);
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
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

const tally = Object.fromEntries(DAYS.map(d => [d, { beaches: 0, colour: {}, comfort: {}, date: null }]));
let done = 0;
for (const region of regions) {
  try {
    const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    await pace(resolution.points.length + 1);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch([region.regionPoint]), fetchMarineForecastDataBatch(resolution.points)]);
    const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
    if (!wind) continue;
    const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
    const days = processForecastData(mergeMarineForecastData(wind.data, regionMarine));
    for (const d of DAYS) {
      const regionDay = days[d];
      if (!regionDay) continue;
      tally[d].date = regionDay.date ?? tally[d].date;
      for (const beach of region.beaches) {
        const key = resolution.keyByBeachId.get(beach.id);
        const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
        const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
        const s = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        const t = tally[d];
        t.beaches += 1;
        const c = s.simpleWindSuitability?.suitabilityColor ?? s.suitabilityColor ?? 'unknown';
        t.colour[c] = (t.colour[c] || 0) + 1;
        const v = s.swimmingComfort ?? 'unknown';
        t.comfort[v] = (t.comfort[v] || 0) + 1;
      }
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές`);
    await sleep(200);
  } catch (e) { process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
process.stderr.write('\n');
const report = { generatedAt: new Date().toISOString(), regions: done, days: tally,
  note: 'Δ10 (§Γ81): suitabilityColor = το χρώμα της βαθμολογίας (η πινέζα το διαβάζει μέσω windExposureEngine). Ένα στατικό φρένο lead≥4 θα έκανε τα μπλε κίτρινα και τα «excellent» → «good». Μόνο μέτρηση — αλλάζει δόγμα (§ΑΞ3 κανόνας 3).' };
const out = path.join(root, 'reports/quality', `horizon-blue-${new Date().toISOString().slice(0, 10)}.json`);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
for (const d of DAYS) console.log(`+${d} (${tally[d].date}): ${tally[d].beaches} παραλίες · χρώμα ${JSON.stringify(tally[d].colour)} · ετυμηγορία ${JSON.stringify(tally[d].comfort)}`);
console.log(`→ ${path.relative(root, out)}`);
