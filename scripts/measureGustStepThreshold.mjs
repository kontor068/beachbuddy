#!/usr/bin/env node
/**
 * ΤΟ ΟΡΙΟ ΤΗΣ ΡΙΠΗΣ «≥22 → +1 ΕΝΕΡΓΟ ΜΠΟΦΟΡ»: ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΕΤΥΜΗΓΟΡΙΑ ΜΕ 22 / 30 / 38 / ΟΡΙΟ ΑΝΑ ΜΠΟΦΟΡ, ΕΘΝΙΚΑ (13/09/2026, βίβλος §Γ81 Δ5) — ΜΟΝΟ ΜΕΤΡΗΣΗ
 *
 * ΓΙΑΤΙ. Η Δ5 (`reports/weather/gust-spread-vs-stations-2026-09-12.json`, 30 METAR, 11.591 ζευγάρια) έδειξε ότι ο κανόνας
 * «ριπή − μέσος ≥ 22 χλμ/ώ σε ≥3 Μποφόρ → +1 ενεργό Μποφόρ» ανάβει στο 30,5% των ωρών ≥3 Μπφ του μοντέλου, ενώ τα ανεμόμετρα
 * βλέπουν τέτοιο άλμα στο 0,8% — ισο-συχνότητα με το όργανο στο ~38. Και ότι η φούσκα ΔΕΝ είναι ομοιόμορφη: ριπή μοντέλου − ριπή
 * οργάνου ανά Μποφόρ οργάνου: 3 Μπφ +11,9 · 4 Μπφ +9,8 · 5 Μπφ +4,5 · 6 Μπφ −0,9 · 7 Μπφ −5,7 · 8 Μπφ −10,4. Δηλαδή στα 3-4 Μποφόρ
 * η ριπή φουσκώνει ~10-12 χλμ/ώ, στα 6+ είναι ειλικρινής ή και χαμηλή. Ψεύτικος συναγερμός, όχι ψεύτικη ηρεμία: σπρώχνει ετυμηγορίες
 * σε «πρόσεχε/μην κολυμπήσεις» χωρίς μάρτυρα. Επειδή η αλλαγή θα ήταν προς το ΗΠΙΟΤΕΡΟ, η βίβλος θέλει πρώτα το μέγεθος.
 *
 * ΟΙ ΠΑΡΑΛΛΑΓΕΣ. t22 = παραγωγή · t30 · t38 (ομοιόμορφο όριο) · **bftT** = όριο ανά Μποφόρ βάσης = 22 + η φούσκα της Δ5 όπου είναι
 * θετική: 3 Μπφ → 34 · 4 Μπφ → 32 · 5 Μπφ → 26 · ≥6 Μπφ → 22 (η προειδοποίηση μένει ακέραιη εκεί που η ριπή του μοντέλου είναι
 * ειλικρινής). Προσοχή: η φούσκα της Δ5 μετρήθηκε ανά Μποφόρ ΟΡΓΑΝΟΥ, ο κανόνας τρέχει με Μποφόρ ΜΟΝΤΕΛΟΥ — πρώτη προσέγγιση.
 *
 * ΠΩΣ. Τρέχει την ΠΡΑΓΜΑΤΙΚΗ βαθμολογία (calculateBeachScore) για κάθε παραλία, μία φορά ανά παραλλαγή. Η σταθερά
 * `GUST_EFFECTIVE_BFT_SPREAD_KMH` (services/recommendationService) είναι εσωτερική, οπότε ΜΟΝΟ κατά τη φόρτωση εδώ (require.extensions)
 * ξαναγράφονται ΔΥΟ γραμμές: η δήλωσή της (αντικείμενο που διαβάζει `globalThis.__CB_GUST_STEP_T`, προεπιλογή 22) και η συνθήκη του
 * σκαλιού (διαβάζει `globalThis.__CB_GUST_STEP_FN(baseBeaufort)` αν υπάρχει). Ακριβώς μία αντικατάσταση η καθεμία, αλλιώς σταματά.
 * Ο κώδικας παραγωγής ΔΕΝ αγγίζεται. Ό,τι άλλο διαβάζει το spread μένει ως έχει και μετριέται ΜΑΖΙ (δεν το μετακινούμε): η σκάλα
 * πόντων ≥14/≥22/≥35 (−5/−10/−18, ή −2/−4/−8 σε προστατευμένη), οι σημειώσεις 18/30 και ο πίνακας Μποφόρ της οθόνης (≥12).
 *
 * ΤΙ ΚΑΤΑΓΡΑΦΕΙ: ετυμηγορία, πόντοι, έκθεση, άνεμος (χλμ/ώ → Μποφόρ βάσης με getBeaufortLevel — το score δεν εξάγει το ενεργό Μποφόρ).
 * ΤΙ ΠΕΡΙΜΕΝΟΥΜΕ: μόνο προς το ηπιότερο (ψηλότερο όριο = ο κανόνας ανάβει σπανιότερα). Ό,τι αυστηρότερο = ανωμαλία.
 * ΟΡΙΑ: μία μέρα με τον καιρό που έτυχε· δεν λέει ΠΟΙΕΣ από τις παραλίες που μαλακώνουν είχαν όντως ριπές (αυτό το λέει το METAR
 * της Δ5 στατιστικά: 97,9% των φορών που ανάβει, το όργανο δεν είδε άλμα).
 *
 *   node scripts/measureGustStepThreshold.mjs [--day=0] [--thresholds=22,30,38]
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
const PRODUCTION_T = 22;
const GUST_DECL = `const GUST_EFFECTIVE_BFT_SPREAD_KMH = ${PRODUCTION_T};`;
const GUST_DECL_MEASURE = `const GUST_EFFECTIVE_BFT_SPREAD_KMH = { valueOf() { return Number(globalThis.__CB_GUST_STEP_T ?? ${PRODUCTION_T}); } };`;
// Κώδικας ΠΡΙΝ τις 13/09/2026 (ένα όριο για όλα τα Μποφόρ): ξαναγράφεται η συνθήκη του σκαλιού.
const GUST_STEP_LINE = 'if (baseBeaufort >= GUST_MIN_BASE_BEAUFORT && (gustSpreadKmph ?? 0) >= GUST_EFFECTIVE_BFT_SPREAD_KMH) effective += 1;';
const GUST_STEP_MEASURE = 'if (baseBeaufort >= GUST_MIN_BASE_BEAUFORT && (gustSpreadKmph ?? 0) >= (globalThis.__CB_GUST_STEP_FN ? globalThis.__CB_GUST_STEP_FN(baseBeaufort) : GUST_EFFECTIVE_BFT_SPREAD_KMH)) effective += 1;';
// Κώδικας ΑΠΟ 13/09/2026 (όριο ανά Μποφόρ βάσης, gustEffectiveStepSpreadKmh): ξαναγράφεται το σώμα της συνάρτησης, ώστε το «t22»
// να ξαναδίνει τον παλιό κανόνα (ομοιόμορφο 22) και το «bftT» τον νέο — έτσι η μέτρηση απαντά και μετά την αλλαγή «πόσο ηπιότερα από ό,τι πριν».
const GUST_FN_EXPR = 'GUST_EFFECTIVE_BFT_SPREAD_KMH_BY_BASE[baseBeaufort] ?? GUST_EFFECTIVE_BFT_SPREAD_KMH';
const GUST_FN_MEASURE = '(globalThis.__CB_GUST_STEP_FN ? globalThis.__CB_GUST_STEP_FN(baseBeaufort) : Number(globalThis.__CB_GUST_STEP_T ?? 22))';
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
    if (source.includes(GUST_FN_EXPR)) {
      codeShape = 'per-beaufort (από 13/09/2026)';
      source = rewriteOnce(source, GUST_FN_EXPR, GUST_FN_MEASURE, 'σώμα της gustEffectiveStepSpreadKmh');
      rewrites += 1; // η δήλωση δεν χρειάζεται ξαναγράψιμο σε αυτό το σχήμα
    } else {
      codeShape = 'uniform 22 (ως 13/09/2026)';
      source = rewriteOnce(source, GUST_DECL, GUST_DECL_MEASURE, 'δήλωση του ορίου ριπής');
      source = rewriteOnce(source, GUST_STEP_LINE, GUST_STEP_MEASURE, 'συνθήκη του σκαλιού +1');
    }
  }
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React }, fileName: filename }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));
if (rewrites !== 2) { console.error(`οι δύο γραμμές του ορίου ριπής δεν ξαναγράφτηκαν (${rewrites}/2)`); process.exit(1); }

const args = process.argv.slice(2);
const DAY_INDEX = Number(args.find(a => a.startsWith('--day='))?.slice(6) ?? 0);
const THRESHOLDS = (args.find(a => a.startsWith('--thresholds='))?.slice(13) ?? '22,30,38').split(',').map(Number);
if (THRESHOLDS[0] !== PRODUCTION_T) { console.error(`η πρώτη παραλλαγή πρέπει να είναι η παραγωγή (${PRODUCTION_T}), βρήκα ${THRESHOLDS[0]}`); process.exit(1); }
// Όριο ανά Μποφόρ βάσης = 22 + max(0, φούσκα Δ5): 3→34, 4→32, 5→26, ≥6→22.
const BFT_T = { 3: 34, 4: 32, 5: 26 };
const bftThreshold = (baseBeaufort) => BFT_T[baseBeaufort] ?? PRODUCTION_T;
const VARIANTS = [...THRESHOLDS.map(t => ({ key: `t${t}`, t, fn: undefined })), { key: 'bftT', t: PRODUCTION_T, fn: bftThreshold }];
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
const pace = async (count) => { for (;;) { const cutoff = performance.now() - 60_000; while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift(); const used = pointWindow.reduce((s, p) => s + p.n, 0); if (used + count <= POINTS_PER_MINUTE) { pointWindow.push({ at: performance.now(), n: count }); return; } await sleep(1000); } };

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
        globalThis.__CB_GUST_STEP_T = v.t;
        globalThis.__CB_GUST_STEP_FN = v.fn;
        const s = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        const windKmh = typeof s.windSpeedKmph === 'number' ? s.windSpeedKmph : null;
        row[v.key] = { comfort: s.swimmingComfort ?? null, score: typeof s.swimmingScore === 'number' ? Math.round(s.swimmingScore) : null, exposure: s.exposureLevel ?? null, windKmh: windKmh === null ? null : Math.round(windKmh), bft: windKmh === null ? null : getBeaufortLevel(windKmh) };
      }
      globalThis.__CB_GUST_STEP_T = PRODUCTION_T; globalThis.__CB_GUST_STEP_FN = undefined;
      rows.push(row);
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές · ${rows.length} παραλίες`);
    await sleep(200);
  } catch (e) { process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
globalThis.__CB_GUST_STEP_T = PRODUCTION_T; globalThis.__CB_GUST_STEP_FN = undefined;
process.stderr.write('\n');

const comfortIdx = c => ORDER.indexOf(c);
const median = (arr) => { const d = [...arr].sort((a, b) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; };
const prod = 't22';
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
    threshold: vdef.fn ? { byBaseBeaufort: BFT_T, otherwise: PRODUCTION_T } : vdef.t,
    verdict: { changed: changed.length, softer: softer.length, stricter: stricter.length, expectedStricter: 0, moves,
      softerByExposure: countBy(softer, r => r[prod].exposure), softerByBaseBeaufort: countBy(softer, r => r[prod].bft),
      avoidLifted: { count: avoidLifted.length, byBaseBeaufort: countBy(avoidLifted, r => r[prod].bft), byExposure: countBy(avoidLifted, r => r[prod].exposure) } },
    score: { up: scoreDelta.filter(d => d > 0).length, down: scoreDelta.filter(d => d < 0).length, medianUpDelta: median(scoreDelta.filter(d => d > 0)) },
    distributionAfter: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r[v].comfort === c).length])),
    softerSamples: softer.slice(0, 20).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
    avoidLiftedSamples: avoidLifted.slice(0, 12).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
    stricterSamples: stricter.slice(0, 20).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
  };
}
const report = {
  generatedAt: new Date().toISOString(), dayIndex: DAY_INDEX, regions: done, beaches: rows.length, codeShape,
  change: 'GUST_EFFECTIVE_BFT_SPREAD_KMH (services/recommendationService) — το σκαλί «+1 ενεργό Μποφόρ από ριπές» σε ≥3 Μπφ· βάση σύγκρισης t22 = ο κανόνας ως 13/09/2026 (ομοιόμορφο 22)· ξαναγράφεται μόνο κατά τη φόρτωση εδώ',
  untouched: 'σκάλα πόντων spread ≥14/≥22/≥35, σημειώσεις 18/30, πίνακας οθόνης beaufortRange (≥12) — μένουν 22 όπως στην παραγωγή',
  evidence: 'Δ5 §Γ81: gust-spread-vs-stations-2026-09-12.json — ο κανόνας ανάβει 30,5% των ωρών ≥3 Μπφ, το όργανο 0,8%, ισο-συχνότητα ~38· ριπή μοντέλου − οργάνου: 3 Μπφ +11,9 · 4 +9,8 · 5 +4,5 · 6 −0,9 · 7 −5,7 · 8 −10,4',
  production: { threshold: PRODUCTION_T, distribution: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r[prod].comfort === c).length])), byBaseBeaufort: countBy(rows, r => r[prod].bft) },
  variants,
  note: 'Μία μέρα με τον καιρό που έτυχε. Ψηλότερο όριο = ο κανόνας ανάβει σπανιότερα → μόνο ηπιότερο. Ό,τι αυστηρότερο = ανωμαλία, δες stricterSamples. Το «bft» είναι Μποφόρ ΒΑΣΗΣ από το windSpeedKmph του score (getBeaufortLevel), όχι το ενεργό.',
};
const out = path.join(root, 'reports/weather', `gust-step-threshold-${new Date().toISOString().slice(0, 10)}${DAY_INDEX ? `-d${DAY_INDEX}` : ''}.json`);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nΟΡΙΟ ΡΙΠΗΣ, μέρα +${DAY_INDEX}: ${rows.length} παραλίες, ${done} περιοχές · παραγωγή ${JSON.stringify(report.production.distribution)} · Μπφ βάσης ${JSON.stringify(report.production.byBaseBeaufort)}`);
for (const [v, r] of Object.entries(variants)) {
  console.log(`  ${v}: ετυμηγορία ${r.verdict.changed} (ηπιότερη ${r.verdict.softer} · αυστηρότερη ${r.verdict.stricter}) ${JSON.stringify(r.verdict.moves)} · ανά Μπφ βάσης ${JSON.stringify(r.verdict.softerByBaseBeaufort)} · ανά έκθεση ${JSON.stringify(r.verdict.softerByExposure)}`);
  console.log(`         «μην κολυμπήσεις» → ηπιότερο: ${r.verdict.avoidLifted.count} ${JSON.stringify(r.verdict.avoidLifted.byBaseBeaufort)} · πόντοι πάνω ${r.score.up} (διάμεσος +${r.score.medianUpDelta})`);
}
console.log(`→ ${path.relative(root, out)}`);
