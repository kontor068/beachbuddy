#!/usr/bin/env node
/**
 * ΤΟ ΔΑΠΕΔΟ ΤΗΣ ΣΚΙΑΣ ΑΚΤΗΣ K_d 0,1 → 0,25: ΤΙ ΑΛΛΑΖΕΙ ΣΤΟ ΝΟΥΜΕΡΟ ΚΑΙ ΣΤΗΝ ΕΤΥΜΗΓΟΡΙΑ, ΕΘΝΙΚΑ (13/09/2026, βίβλος §Γ81 Δ7) — ΜΟΝΟ ΜΕΤΡΗΣΗ
 *
 * ΓΙΑΤΙ. Ο δορυφόρος (Δ7, `reports/wave-model/shadow-kd-calibration-2026-09-12.json`, 30.513 παραλιο-μέρες) είπε ότι εκεί που η
 * γεωμετρία δίνει K_d≈0,1 (14.899 μέρες) η άμμος αφρίζει σαν K_d ~0,29· στη ζώνη 0,15-0,35 σαν ~0,27· στο 0,5 σαν ~0,63. Δηλαδή η
 * βαθιά σκιά είναι αληθινή αλλά ρηχότερη απ' όσο λέμε ~2,5 φορές — ψεύτικη ηρεμία στο τυπωμένο νούμερο και στην ετυμηγορία (όχι
 * στο χρώμα, που διαβάζει max(K_d, 0,5) — §Γ78). Πρόταση: `SHADOW_KD_FLOOR` (utils/seaArrival) 0,1 → 0,25. Πριν αποφασίσει ο
 * Μίλτος, εδώ μετριέται ΠΟΣΑ νούμερα και ετυμηγορίες αλλάζουν, με τον καιρό της μέρας.
 *
 * ΠΩΣ. Τρέχει την ΠΡΑΓΜΑΤΙΚΗ βαθμολογία (calculateBeachScore) για κάθε παραλία της χώρας, μία φορά ανά παραλλαγή δαπέδου, αλλάζοντας
 * τη σταθερά ΜΕΣΑ στη διεργασία: η μεταγλώττιση TS→CommonJS διαβάζει την `export const SHADOW_KD_FLOOR` μέσω `exports.SHADOW_KD_FLOOR`
 * (ελέγχθηκε 13/09: 4 αναφορές μέσω exports, 0 γυμνές), οπότε `seaArrival.SHADOW_KD_FLOOR = 0,25` αλλάζει ό,τι διαβάζει το score.
 * Μετριέται ο ίδιος ο κώδικας, όχι αντίγραφο. Ο κώδικας παραγωγής ΔΕΝ αγγίζεται.
 *
 * ΤΙ ΚΑΤΑΓΡΑΦΕΙ ανά παραλία και παραλλαγή: ετυμηγορία (swimmingComfort), πόντοι, ύψος στην ακτή (shoreWaveHeightM — αυτό διαβάζει η
 * ετυμηγορία), τυπωμένο (shoreDisplayWaveM), το K_d του χρώματος (toneShoreShadowDamping — περιμένουμε 0 αλλαγές), έκθεση, άφιξη.
 * ΤΙ ΠΕΡΙΜΕΝΟΥΜΕ: μόνο προς την προσοχή (το δάπεδο μόνο ανεβαίνει) — ό,τι πάει προς το ηπιότερο γράφεται ως ανωμαλία.
 *
 * ΤΙ ΕΔΕΙΞΕ ΤΟ ΠΡΩΤΟ ΤΡΕΞΙΜΟ (13/09 01:07, μέρα 0): το δάπεδο αγγίζει ΜΟΝΟ το τυπωμένο νούμερο (652 παραλίες με 0,25) — ετυμηγορία 0,
 * πόντοι 0, K_d χρώματος 0. Γιατί, από τον κώδικα: (α) η ετυμηγορία διαβάζει `shoreWaveM = min(εκτίμηση ακτής, αποσβεσμένο με K_d)`
 * (recommendationService ~2262) και το K_d μπαίνει μόνο στο σκέλος 'protected' (waveCharacter.shoreSeaStateM) — η εκτίμηση ακτής
 * κερδίζει το min παντού όπου το K_d κάθεται στο δάπεδο· (β) το χρώμα διαβάζει max(K_d, 0,5) (§Γ78), οπότε 0,1→0,25 δεν το φτάνει.
 * Άρα η ανάλυση εδώ εστιάζει στο ΤΥΠΩΜΕΝΟ νούμερο: από τι σε τι, και πόσα περνούν τα κατώφλια που βλέπει ο επισκέπτης.
 * ΟΡΙΑ: μία μέρα με τον καιρό που έτυχε (ξανατρέξε σε μέρα μελτεμιού)· το K_d είναι ένα, στη μέση διεύθυνση (Δ11 εκκρεμεί).
 *
 *   node scripts/measureShadowKdFloor.mjs [--day=0] [--floors=0.1,0.25,0.3]
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
const seaArrival = require(path.join(root, 'utils/seaArrival.ts'));
const { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, atDisplayedPrecisionM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const DAY_INDEX = Number(args.find(a => a.startsWith('--day='))?.slice(6) ?? 0);
const FLOORS = (args.find(a => a.startsWith('--floors='))?.slice(9) ?? '0.1,0.25,0.3').split(',').map(Number);
const PRODUCTION_FLOOR = 0.1;
const CALM_M = 0.3; // «ήρεμη» του κριτή στην άμμο (§Γ76): ό,τι τυπώνουμε ≤0,3
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const ORDER = ['excellent', 'good', 'caution', 'avoid', 'avoid_swimming'];
// Η βάση σύγκρισης είναι ΠΑΝΤΑ το 0,1 (ο κανόνας ως 13/09/2026), ό,τι κι αν λέει ο κώδικας σήμερα — από 13/09 ο κώδικας λέει 0,25
// (σε commit), οπότε η μέτρηση απαντά «πόσο αλλάζει σε σχέση με ό,τι έβλεπε ο κόσμος πριν». Το τρέχον του κώδικα γράφεται ως codeDefaultFloor.
const CODE_DEFAULT_FLOOR = seaArrival.SHADOW_KD_FLOOR;
if (FLOORS[0] !== PRODUCTION_FLOOR) { console.error(`η πρώτη παραλλαγή πρέπει να είναι η βάση σύγκρισης (${PRODUCTION_FLOOR}), βρήκα ${FLOORS[0]}`); process.exit(1); }
const key = f => `kd${f}`;

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
const num = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null);

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
      for (const floor of FLOORS) {
        seaArrival.SHADOW_KD_FLOOR = floor;
        const s = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        row[key(floor)] = {
          comfort: s.swimmingComfort ?? null, score: typeof s.swimmingScore === 'number' ? Math.round(s.swimmingScore) : null,
          shoreM: num(s.shoreWaveHeightM), displayM: num(s.shoreDisplayWaveM), seaM: num(s.seaStateWaveM), toneKd: num(s.toneShoreShadowDamping),
          exposure: s.exposureLevel ?? null, arrival: s.seaArrivalExposureLevel ?? null,
        };
      }
      seaArrival.SHADOW_KD_FLOOR = CODE_DEFAULT_FLOOR;
      rows.push(row);
    }
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές · ${rows.length} παραλίες`);
    await sleep(200);
  } catch (e) { process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
seaArrival.SHADOW_KD_FLOOR = CODE_DEFAULT_FLOOR;
process.stderr.write('\n');

const comfortIdx = c => ORDER.indexOf(c);
const median = (arr) => { const d = [...arr].sort((a, b) => a - b); return d.length ? d[Math.floor(d.length / 2)] : null; };
const countByKey = (list, pick) => { const o = {}; for (const r of list) { const k = pick(r) ?? 'unknown'; o[k] = (o[k] || 0) + 1; } return o; };
const prod = key(PRODUCTION_FLOOR);
const variants = {};
for (const floor of FLOORS.slice(1)) {
  const v = key(floor);
  const changedShore = rows.filter(r => r[prod].shoreM !== null && r[v].shoreM !== null && Math.abs(r[v].shoreM - r[prod].shoreM) >= 0.005);
  const shoreDown = changedShore.filter(r => r[v].shoreM < r[prod].shoreM);
  const changedVerdict = rows.filter(r => r[prod].comfort !== r[v].comfort);
  const stricter = changedVerdict.filter(r => comfortIdx(r[v].comfort) > comfortIdx(r[prod].comfort));
  const softer = changedVerdict.filter(r => comfortIdx(r[v].comfort) < comfortIdx(r[prod].comfort));
  const moves = {};
  for (const r of changedVerdict) { const m = `${r[prod].comfort} → ${r[v].comfort}`; moves[m] = (moves[m] || 0) + 1; }
  const scoreDelta = rows.map(r => (r[v].score ?? 0) - (r[prod].score ?? 0));
  const cross = (limit) => rows.filter(r => r[prod].shoreM !== null && r[v].shoreM !== null && r[prod].shoreM <= limit && r[v].shoreM > limit).length;
  const crossBack = (limit) => rows.filter(r => r[prod].shoreM !== null && r[v].shoreM !== null && r[prod].shoreM > limit && r[v].shoreM <= limit).length;
  const byExposure = {};
  for (const r of changedShore) { const e = r[prod].exposure ?? 'unknown'; byExposure[e] = (byExposure[e] || 0) + 1; }
  const toneChanged = rows.filter(r => r[prod].toneKd !== r[v].toneKd).length;
  // Το ΤΥΠΩΜΕΝΟ νούμερο — το μόνο που κουνιέται (βλ. κεφαλίδα).
  const hasDisp = r => r[prod].displayM !== null && r[v].displayM !== null;
  const changedDisp = rows.filter(r => hasDisp(r) && Math.abs(r[v].displayM - r[prod].displayM) >= 0.005);
  const dispCross = (limit) => rows.filter(r => hasDisp(r) && r[prod].displayM <= limit && r[v].displayM > limit).length;
  const dispByExposure = {}; const dispByArrival = {};
  for (const r of changedDisp) { const e = r[prod].exposure ?? 'unknown'; dispByExposure[e] = (dispByExposure[e] || 0) + 1; const a = r[prod].arrival ?? 'unknown'; dispByArrival[a] = (dispByArrival[a] || 0) + 1; }
  // ΟΡΑΤΟ στον επισκέπτη: η σελίδα τυπώνει με βήμα 0,1 μ. (waveCharacter.atDisplayedPrecisionM / toFixed(1)) —
  // 0,05 → 0,10 δείχνει «0,1» και πριν και μετά. Μετράμε μόνο ό,τι αλλάζει ψηφίο.
  const shown = m => atDisplayedPrecisionM(m);
  const visible = changedDisp.filter(r => shown(r[prod].displayM) !== shown(r[v].displayM));
  const visibleMoves = {};
  for (const r of visible) { const m = `${shown(r[prod].displayM).toFixed(1)} → ${shown(r[v].displayM).toFixed(1)}`; visibleMoves[m] = (visibleMoves[m] || 0) + 1; }
  const printedNumber = {
    changed: changedDisp.length, down: changedDisp.filter(r => r[v].displayM < r[prod].displayM).length,
    visibleOnPage: { changed: visible.length, moves: visibleMoves, byExposure: countByKey(visible, r => r[prod].exposure), byArrival: countByKey(visible, r => r[prod].arrival),
      samples: visible.slice(0, 12).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod].displayM, after: r[v].displayM, shownBefore: shown(r[prod].displayM), shownAfter: shown(r[v].displayM), seaM: r[prod].seaM, exposure: r[prod].exposure, arrival: r[prod].arrival })) },
    byExposure: dispByExposure, byArrival: dispByArrival,
    medianBeforeM: median(changedDisp.map(r => r[prod].displayM)), medianAfterM: median(changedDisp.map(r => r[v].displayM)),
    medianRatio: median(changedDisp.map(r => r[v].displayM / Math.max(r[prod].displayM, 0.005))),
    crossings: {
      [`≤${CALM_M} → above («ήρεμη» του κριτή)`]: dispCross(CALM_M), '<0.4 → ≥0.4 (όριο «Ιδανική» του χρώματος, αλλά το χρώμα διαβάζει max(K_d,0,5))': dispCross(0.3999),
      [`→ ≥${SEA_STATE_AMBER_M} (κίτρινο)`]: dispCross(SEA_STATE_AMBER_M - 0.0001), [`→ ≥${SEA_STATE_ROUGH_M} (κόκκινο)`]: dispCross(SEA_STATE_ROUGH_M - 0.0001),
    },
    histogramBefore: Object.fromEntries(['≤0.1', '0.1-0.2', '0.2-0.3', '0.3-0.5', '>0.5'].map((b, i) => [b, changedDisp.filter(r => { const x = r[prod].displayM; return i === 0 ? x <= 0.1 : i === 1 ? x > 0.1 && x <= 0.2 : i === 2 ? x > 0.2 && x <= 0.3 : i === 3 ? x > 0.3 && x <= 0.5 : x > 0.5; }).length])),
    histogramAfter: Object.fromEntries(['≤0.1', '0.1-0.2', '0.2-0.3', '0.3-0.5', '>0.5'].map((b, i) => [b, changedDisp.filter(r => { const x = r[v].displayM; return i === 0 ? x <= 0.1 : i === 1 ? x > 0.1 && x <= 0.2 : i === 2 ? x > 0.2 && x <= 0.3 : i === 3 ? x > 0.3 && x <= 0.5 : x > 0.5; }).length])),
    biggestJumps: [...changedDisp].sort((a, b) => (b[v].displayM - b[prod].displayM) - (a[v].displayM - a[prod].displayM)).slice(0, 12).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod].displayM, after: r[v].displayM, seaM: r[prod].seaM, exposure: r[prod].exposure, arrival: r[prod].arrival })),
  };
  variants[v] = {
    floor,
    printedNumber,
    shoreNumber: {
      changed: changedShore.length, down: shoreDown.length, byExposure,
      medianRatio: median(changedShore.map(r => r[v].shoreM / Math.max(r[prod].shoreM, 0.005))),
      medianDeltaM: median(changedShore.map(r => r[v].shoreM - r[prod].shoreM)),
      crossings: {
        [`calm ≤${CALM_M} → above`]: cross(CALM_M), [`→ ≥${SEA_STATE_AMBER_M} (κίτρινο)`]: cross(SEA_STATE_AMBER_M - 0.0001), [`→ ≥${SEA_STATE_ROUGH_M} (κόκκινο)`]: cross(SEA_STATE_ROUGH_M - 0.0001),
        backwardsAnyTier: crossBack(CALM_M) + crossBack(SEA_STATE_AMBER_M - 0.0001) + crossBack(SEA_STATE_ROUGH_M - 0.0001),
      },
      displayedChanged: rows.filter(r => r[prod].displayM !== r[v].displayM).length,
    },
    verdict: { changed: changedVerdict.length, stricter: stricter.length, softer: softer.length, moves },
    score: { down: scoreDelta.filter(d => d < 0).length, up: scoreDelta.filter(d => d > 0).length, medianDownDelta: median(scoreDelta.filter(d => d < 0)) },
    colour: { toneKdChanged: toneChanged, expected: 0 },
    distributionAfter: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r[v].comfort === c).length])),
    softerSamples: softer.slice(0, 20).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
    stricterSamples: stricter.slice(0, 20).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod], after: r[v] })),
    biggestShoreJumps: [...changedShore].sort((a, b) => (b[v].shoreM - b[prod].shoreM) - (a[v].shoreM - a[prod].shoreM)).slice(0, 12).map(r => ({ beachId: r.beachId, name: r.name, regionId: r.regionId, before: r[prod].shoreM, after: r[v].shoreM, comfortBefore: r[prod].comfort, comfortAfter: r[v].comfort })),
  };
}
const report = {
  generatedAt: new Date().toISOString(), dayIndex: DAY_INDEX, regions: done, beaches: rows.length, codeDefaultFloor: CODE_DEFAULT_FLOOR,
  change: 'SHADOW_KD_FLOOR (utils/seaArrival) — δάπεδο της γωνιακής σκιάς ακτής· βάση σύγκρισης 0,1 (ο κανόνας ως 13/09/2026)· μετριέται ζωντανά μέσα στο πραγματικό calculateBeachScore',
  evidence: 'Δ7 §Γ81: shadow-kd-calibration-2026-09-12.json — kd≈0,1 → εμπειρικό ~0,29 (n=14.899), kd 0,15-0,35 → ~0,27, kd≈0,5 → ~0,63',
  production: { floor: PRODUCTION_FLOOR, distribution: Object.fromEntries(ORDER.map(c => [c, rows.filter(r => r[prod].comfort === c).length])), shoreCalm: rows.filter(r => r[prod].shoreM !== null && r[prod].shoreM <= CALM_M).length },
  variants,
  note: 'Μία μέρα με τον καιρό που έτυχε. Το δάπεδο αγγίζει ΜΟΝΟ το τυπωμένο νούμερο (printedNumber): η ετυμηγορία διαβάζει min(εκτίμηση ακτής, K_d-αποσβεσμένο) και το χρώμα max(K_d, 0,5) — shoreNumber/verdict/colour πρέπει να είναι 0. Ό,τι «ηπιότερο» = ανωμαλία. Το K_d είναι ένα στη μέση διεύθυνση (Δ11 εκκρεμεί).',
};
const out = path.join(root, 'reports/wave-model', `shadow-kd-floor-${new Date().toISOString().slice(0, 10)}${DAY_INDEX ? `-d${DAY_INDEX}` : ''}.json`);
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nΔΑΠΕΔΟ K_d, μέρα +${DAY_INDEX}: ${rows.length} παραλίες, ${done} περιοχές · παραγωγή ${JSON.stringify(report.production.distribution)}, ήρεμο νούμερο (≤${CALM_M}) σε ${report.production.shoreCalm}`);
for (const [v, r] of Object.entries(variants)) {
  console.log(`  ${v}: ΤΥΠΩΜΕΝΟ νούμερο αλλάζει σε ${r.printedNumber.changed} (κάτω ${r.printedNumber.down}) · διάμεσος ${r.printedNumber.medianBeforeM} → ${r.printedNumber.medianAfterM} μ. (×${r.printedNumber.medianRatio}) · ανά έκθεση ${JSON.stringify(r.printedNumber.byExposure)}`);
  console.log(`         ΟΡΑΤΟ στη σελίδα (βήμα 0,1): ${r.printedNumber.visibleOnPage.changed} παραλίες · ${JSON.stringify(r.printedNumber.visibleOnPage.moves)}`);
  console.log(`         διασχίσεις τυπωμένου: ${JSON.stringify(r.printedNumber.crossings)}`);
  console.log(`         ύψος ετυμηγορίας αλλάζει: ${r.shoreNumber.changed} · ετυμηγορία: ${r.verdict.changed} (αυστηρότερη ${r.verdict.stricter} · ηπιότερη ${r.verdict.softer}) · πόντοι κάτω ${r.score.down} / πάνω ${r.score.up} · χρώμα K_d άλλαξε: ${r.colour.toneKdChanged}`);
}
console.log(`→ ${path.relative(root, out)}`);
