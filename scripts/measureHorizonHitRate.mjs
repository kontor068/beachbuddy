#!/usr/bin/env node
/**
 * ΚΡΑΤΗΣΕ Η «ΙΔΑΝΙΚΗ» ΠΟΥ ΠΟΥΛΗΣΑΜΕ 4 ΜΕΡΕΣ ΠΡΙΝ; (13/09/2026, βίβλος §Γ81 Δ10-Γ) — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * Η Δ10 (scripts/measureHorizonBlue.mjs) μέτρησε πόσες παραλίες βάφονται «Ιδανική» 4-5 μέρες μπροστά (~950 τη
 * μέρα). Η απόφαση του Μίλτου 13/09 («Γ») ήταν: πριν από οποιοδήποτε στατικό φρένο, μέτρησε ΠΟΣΕΣ από αυτές
 * βγήκαν όντως «Ιδανική» την ίδια μέρα. Αυτό το σκριπτ τρέχει την ΠΡΑΓΜΑΤΙΚΗ μηχανή (calculateBeachScore,
 * processForecastData, ο ίδιος διάδρομος ανέμου/κύματος με τη σελίδα) δύο φορές για τις ίδιες περασμένες
 * μέρες:
 *
 *   --lead=4  με ό,τι έλεγε το μοντέλο 4 μέρες πριν από κάθε μέρα-στόχο (Open-Meteo Previous Runs API,
 *             μεταβλητές `*_previous_day4` — άνεμος από τον δωρεάν host previous-runs-api, κύμα από τον
 *             πληρωμένο marine host που σερβίρει και αυτός τα previous runs)
 *   --lead=0  με ό,τι είπε το μοντέλο ΤΗΝ ίδια μέρα (η κοντύτερη πρόγνωση = ό,τι έβλεπε ο επισκέπτης το πρωί)
 *   --compare ενώνει τα δύο ανά παραλία-μέρα και απαντά: από τις «Ιδανική» της +4, πόσες έμειναν «Ιδανική»,
 *             πόσες έγιναν «Καλά», πόσες «Πρόσεχε»/«Μην κολυμπήσεις» — και τι θα πετύχαινε / θα χαλούσε ένα
 *             φρένο «lead ≥ 4 → ποτέ Ιδανική».
 *
 * ΓΙΑΤΙ ΔΥΟ ΔΙΕΡΓΑΣΙΕΣ: το weatherService έχει δική του μνήμη ανά σημείο· δύο εκδοχές στην ίδια διεργασία θα
 * διάβαζαν η μία τα δεδομένα της άλλης. Κάθε lead τρέχει μόνο του και γράφει ένα συμπαγές αρχείο.
 *
 * ΠΩΣ ΓΥΡΙΖΕΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ: το processForecastData πετάει τις μέρες πριν από το «σήμερα» του athensNow(), και
 * το athensNow διορθώνεται από syncClockFromTrustedInstant (κεφαλίδα Date κάθε απάντησης). Μετά τις λήψεις,
 * για κάθε μέρα-στόχο δίνουμε στο ρολόι «έμπιστη στιγμή» = η μέρα-στόχος 06:00 Ελλάδας· το athensNow πάει εκεί,
 * η μέρα-στόχος γίνεται days[0]. Καμία παράκαμψη του Date — μόνο ο μηχανισμός που ήδη έχει η εφαρμογή.
 *
 * ΟΡΙΑ (γραμμένα για να μη διαβαστούν ως ευρήματα):
 *   - «Τι έγινε τελικά» = η πρόγνωση της ίδιας μέρας, ΟΧΙ όργανο. Μετράει αν η υπόσχεση της +4 επιβίωσε ως τη
 *     μέρα — που είναι ακριβώς αυτό που βλέπει ο τουρίστας που έκλεισε 4 μέρες πριν και ξανανοίγει τη σελίδα.
 *   - uv_index και precipitation_probability δεν υπάρχουν στα previous runs → και στις δύο εκδοχές παίρνουν τις
 *     τιμές της ίδιας μέρας (ίδιες, άρα δεν εξηγούν καμία διαφορά). Το ίδιο η θερμοκρασία νερού (SST).
 *   - Ο δωρεάν host του previous-runs δεν παίρνει κλειδί: 1 κλήση ανά περιοχή, 110 συνολικά — μέσα στα όρια.
 *
 *   node scripts/measureHorizonHitRate.mjs --lead=4 [--pastDays=10] [--marineLead=4|0]
 *   node scripts/measureHorizonHitRate.mjs --lead=0 [--pastDays=10]
 *   node scripts/measureHorizonHitRate.mjs --compare [--a=<lead4 file>] [--b=<lead0 file>]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, dflt) => { const hit = args.find(a => a.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : dflt; };
const OUT_DIR = path.join(root, 'reports/quality/horizon-hit');
const runDate = new Date().toISOString().slice(0, 10);

// ───────────────────────────────────────────── compare mode ─────────────────────────────────────────────
if (args.includes('--compare')) {
  const pick = (lead) => arg(lead === 4 ? 'a' : 'b', null) ?? (() => {
    const files = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter(n => n.startsWith(`lead${lead}-`) && n.endsWith('.json')).sort() : [];
    return files.length ? path.join(OUT_DIR, files[files.length - 1]) : null;
  })();
  const fa = pick(4), fb = pick(0);
  if (!fa || !fb) { console.error(`Λείπει αρχείο: lead4=${fa} lead0=${fb}`); process.exit(1); }
  const A = JSON.parse(readFileSync(fa, 'utf8')), B = JSON.parse(readFileSync(fb, 'utf8'));
  const ORDER = ['excellent', 'good', 'caution', 'avoid_swimming', 'avoid'];
  const matrix = {}, matrixColour = {}, byDate = {}, byRegion = {};
  let joined = 0;
  const bump = (obj, a, b) => { obj[a] ??= {}; obj[a][b] = (obj[a][b] || 0) + 1; };
  for (const [regionId, ra] of Object.entries(A.regions)) {
    const rb = B.regions[regionId]; if (!rb) continue;
    const idxB = new Map(rb.beachIds.map((id, i) => [id, i]));
    for (const [date, da] of Object.entries(ra.days)) {
      const db = rb.days[date]; if (!db) continue;
      ra.beachIds.forEach((id, i) => {
        const j = idxB.get(id); if (j == null) return;
        const ca = da.comfort[i], cb = db.comfort[j];
        if (!ca || !cb) return;
        joined += 1;
        bump(matrix, ca, cb);
        bump(matrixColour, da.colour[i], db.colour[j]);
        byDate[date] ??= { ideal4: 0, held: 0, toGood: 0, toWarn: 0 };
        byRegion[regionId] ??= { ideal4: 0, held: 0, toWarn: 0 };
        if (ca === 'excellent') {
          byDate[date].ideal4 += 1; byRegion[regionId].ideal4 += 1;
          if (cb === 'excellent') { byDate[date].held += 1; byRegion[regionId].held += 1; }
          else if (cb === 'good') byDate[date].toGood += 1;
          else { byDate[date].toWarn += 1; byRegion[regionId].toWarn += 1; }
        }
      });
    }
  }
  const ideal4 = matrix.excellent ?? {};
  const nIdeal4 = Object.values(ideal4).reduce((s, v) => s + v, 0);
  const held = ideal4.excellent || 0, toGood = ideal4.good || 0, toCaution = ideal4.caution || 0, toAvoid = (ideal4.avoid_swimming || 0) + (ideal4.avoid || 0), toWarn = toCaution + toAvoid;
  const missed = ORDER.filter(v => v !== 'excellent').reduce((s, v) => s + ((matrix[v] ?? {}).excellent || 0), 0);
  const nIdeal0 = Object.values(matrix).reduce((s, row) => s + (row.excellent || 0), 0);
  const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : '—';
  const blue4 = matrixColour.blue ?? {};
  const nBlue4 = Object.values(blue4).reduce((s, v) => s + v, 0);
  const worstRegions = Object.entries(byRegion).filter(([, r]) => r.ideal4 >= 20).map(([id, r]) => ({ regionId: id, ...r, heldPct: +(100 * r.held / r.ideal4).toFixed(1) })).sort((x, y) => x.heldPct - y.heldPct).slice(0, 12);
  const report = {
    generatedAt: new Date().toISOString(), lead4File: path.relative(root, fa), lead0File: path.relative(root, fb),
    joinedBeachDays: joined, dates: Object.keys(byDate).sort(),
    verdictMatrix_lead4_rows_lead0_cols: matrix, colourMatrix_lead4_rows_lead0_cols: matrixColour,
    headline: {
      ideal4: nIdeal4, heldIdeal: held, heldPct: pct(held, nIdeal4), becameGood: toGood, becameGoodPct: pct(toGood, nIdeal4),
      becameWarning: toWarn, becameWarningPct: pct(toWarn, nIdeal4), becameCaution: toCaution, becameAvoid: toAvoid, becameAvoidPct: pct(toAvoid, nIdeal4),
      promisedVsDelivered: { promisedIdeal4: nIdeal4, idealOnTheDay: nIdeal0, overPromised: nIdeal4 - held, underPromised: missed },
      idealOnTheDay: nIdeal0, idealOnTheDayNotPromised: missed, missedPct: pct(missed, nIdeal0),
      blue4: nBlue4, blueHeld: blue4.blue || 0, blueHeldPct: pct(blue4.blue || 0, nBlue4),
      staticBrakeLead4: { wouldDemote: nIdeal4, rightlyDemoted: nIdeal4 - held, wronglyDemoted: held, wronglyDemotedPct: pct(held, nIdeal4) },
    },
    byDate, worstRegions,
    note: 'Δ10-Γ (§Γ81): lead4 = ό,τι έλεγε το μοντέλο 4 μέρες πριν (previous_day4), lead0 = ό,τι είπε την ίδια μέρα. «Κράτησε» = ίδια ετυμηγορία. Το φρένο lead≥4 θα υποβάθμιζε ΟΛΕΣ τις «Ιδανική» της +4: σωστά όσες δεν κράτησαν, λάθος όσες κράτησαν. Μόνο μέτρηση — αλλάζει δόγμα (§ΑΞ3 κανόνας 3).',
  };
  const out = path.join(root, 'reports/quality', `horizon-hit-rate-${runDate}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Παραλίες-μέρες: ${joined} (${report.dates.length} μέρες: ${report.dates[0]} … ${report.dates[report.dates.length - 1]})`);
  console.log(`«Ιδανική» στην +4: ${nIdeal4} → κράτησε ${held} (${pct(held, nIdeal4)}) · έγινε «Καλά» ${toGood} (${pct(toGood, nIdeal4)}) · έγινε «Πρόσεχε» ${toCaution} (${pct(toCaution, nIdeal4)}) · έγινε «Μην κολυμπήσεις» ${toAvoid} (${pct(toAvoid, nIdeal4)})`);
  console.log(`«Ιδανική» την ίδια μέρα: ${nIdeal0}, από τις οποίες ΔΕΝ είχαν υποσχεθεί στην +4: ${missed} (${pct(missed, nIdeal0)})`);
  console.log(`Μπλε πινέζα στην +4: ${nBlue4} → έμεινε μπλε ${blue4.blue || 0} (${pct(blue4.blue || 0, nBlue4)})`);
  console.log(`Στατικό φρένο lead≥4: θα υποβάθμιζε ${nIdeal4} — σωστά ${nIdeal4 - held}, λάθος ${held} (${pct(held, nIdeal4)})`);
  for (const d of report.dates) { const r = byDate[d]; console.log(`  ${d}: ιδανικές+4 ${r.ideal4} · κράτησαν ${r.held} (${pct(r.held, r.ideal4)}) · καλά ${r.toGood} · προειδοποίηση ${r.toWarn}`); }
  console.log(`→ ${path.relative(root, out)}`);
  process.exit(0);
}

// ───────────────────────────────────────────── merge mode ───────────────────────────────────────────────
// node scripts/measureHorizonHitRate.mjs --merge=retry --lead=4 → οι περιοχές του lead4-<date>-retry.json μπαίνουν στο lead4-<date>.json
if (arg('merge', '')) {
  const lead = Number(arg('lead', NaN)); const tag = arg('merge', '');
  const main = path.join(OUT_DIR, `lead${lead}-${runDate}.json`), extra = path.join(OUT_DIR, `lead${lead}-${runDate}-${tag}.json`);
  const M = JSON.parse(readFileSync(main, 'utf8')), E = JSON.parse(readFileSync(extra, 'utf8'));
  let added = 0;
  for (const [id, rec] of Object.entries(E.regions)) if (Object.keys(rec.days).length) { M.regions[id] = rec; added += 1; }
  M.mergedFrom = [...(M.mergedFrom ?? []), { file: path.basename(extra), regions: added }];
  writeFileSync(main, JSON.stringify(M));
  console.log(`Ενώθηκαν ${added} περιοχές από ${path.basename(extra)} → ${path.basename(main)} (σύνολο ${Object.keys(M.regions).length})`);
  process.exit(0);
}

// ───────────────────────────────────────────── measure mode ─────────────────────────────────────────────
const LEAD = Number(arg('lead', NaN));
if (![0, 1, 2, 3, 4, 5, 6, 7].includes(LEAD)) { console.error('Δώσε --lead=0..7 ή --compare'); process.exit(1); }
const PAST_DAYS = Number(arg('pastDays', 10));
// Προεπιλογή 0: ο marine host δίνει `*_previous_dayN` ΜΟΝΟ για το γενικό μοντέλο (best_match) — με `models=ewam`
// (το μοντέλο που αποφασίζει το κύμα στη σελίδα) γυρίζει όλα null (μετρήθηκε 13/09/2026, Νάξος: 0/72). Άρα το κύμα
// μένει «ίδιας μέρας» και στις δύο εκδοχές· η μέτρηση απαντά τι κάνει ο ΑΝΕΜΟΣ στην υπόσχεση της +4, όπως ακριβώς
// το φρένο ensemble της §Γ50 μιλούσε μόνο για άνεμο. --marineLead=4 τρέχει με το γενικό μοντέλο, για έλεγχο ευαισθησίας.
const MARINE_LEAD = Number(arg('marineLead', 0));
const PLAIN_ONLY = new Set(['uv_index', 'precipitation_probability']); // δεν υπάρχουν στα previous runs
const suffix = (lead) => (lead > 0 ? `_previous_day${lead}` : '');

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
const openMeteoKey = await resolveOpenMeteoKey();
const PAID_HOST = { 'https://api.open-meteo.com': 'https://customer-api.open-meteo.com', 'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com' };
const nativeFetch = globalThis.fetch;
const paidFetch = openMeteoKey ? (input, init) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (typeof url === 'string') for (const [free, paid] of Object.entries(PAID_HOST)) if (url.startsWith(free)) return nativeFetch(`${paid}${url.slice(free.length)}&apikey=${encodeURIComponent(openMeteoKey)}`, init);
  return nativeFetch(input, init);
} : nativeFetch;

const stats = { wind: 0, marine: 0, sst: 0, renamed: 0, nullLead: 0 };
/** Ξαναγράφει ένα URL της εφαρμογής ώστε να διαβάσει τις περασμένες μέρες με το ζητούμενο lead. */
const rewriteUrl = (raw) => {
  const u = new URL(raw);
  const isWind = u.hostname === 'api.open-meteo.com' && u.pathname === '/v1/forecast';
  const isMarine = u.hostname === 'marine-api.open-meteo.com';
  if (!isWind && !isMarine) return { url: raw, lead: 0 };
  const models = u.searchParams.get('models') || '';
  const isSst = isMarine && models.includes('meteofrance_currents');
  const lead = isWind ? LEAD : isSst ? 0 : MARINE_LEAD;
  const vars = (u.searchParams.get('hourly') || '').split(',').filter(Boolean);
  u.searchParams.set('hourly', vars.map(v => (PLAIN_ONLY.has(v) || lead === 0 ? v : `${v}${suffix(lead)}`)).join(','));
  u.searchParams.set('past_days', String(PAST_DAYS));
  u.searchParams.set('forecast_days', '1');
  if (isWind) { u.hostname = 'previous-runs-api.open-meteo.com'; stats.wind += 1; } else if (isSst) stats.sst += 1; else stats.marine += 1;
  return { url: u.toString(), lead };
};
/** Γυρίζει τα κλειδιά `X_previous_dayN` σε `X`, ώστε ο parser της εφαρμογής να δει τη γνωστή μορφή. */
const renameHourly = (obj, lead) => {
  if (!obj || typeof obj !== 'object' || lead === 0) return obj;
  const list = Array.isArray(obj) ? obj : [obj];
  for (const entry of list) {
    const h = entry?.hourly; if (!h) continue;
    for (const key of Object.keys(h)) {
      if (!key.endsWith(suffix(lead))) continue;
      const base = key.slice(0, -suffix(lead).length);
      if (Array.isArray(h[key]) && h[key].every(v => v === null)) stats.nullLead += 1;
      h[base] = h[key]; delete h[key]; stats.renamed += 1;
    }
    if (entry?.hourly_units) for (const key of Object.keys(entry.hourly_units)) if (key.endsWith(suffix(lead))) { entry.hourly_units[key.slice(0, -suffix(lead).length)] = entry.hourly_units[key]; delete entry.hourly_units[key]; }
  }
  return obj;
};
globalThis.fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url;
  if (typeof raw !== 'string' || !raw.includes('open-meteo.com')) return paidFetch(input, init);
  const { url, lead } = rewriteUrl(raw);
  // Ο δωρεάν previous-runs host ΔΕΝ παίρνει κλειδί· ο marine περνάει από το paidFetch όπως πάντα.
  const res = url.includes('previous-runs-api.open-meteo.com') ? await nativeFetch(url, init) : await paidFetch(url, init);
  if (lead === 0) return res;
  const text = await res.text();
  let body = text;
  try { body = JSON.stringify(renameHourly(JSON.parse(text), lead)); } catch { /* μη-JSON: άφησέ το όπως είναι */ }
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
};

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) { module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename); return; }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React }, fileName: filename }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));
const { syncClockFromTrustedInstant } = require(path.join(root, 'utils/athensTime.ts'));

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
const regionFilter = arg('regions', '');
const regions = readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json').map(loadRegion).filter(Boolean)
  .filter(r => r.regionPoint && Number.isFinite(r.regionPoint.lat)).filter(r => !regionFilter || regionFilter.split(',').includes(r.regionId));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pointWindow = []; const POINTS_PER_MINUTE = openMeteoKey ? 600 : 120;
const pace = async (count) => { for (;;) { const cutoff = performance.now() - 60_000; while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift(); const spent = pointWindow.reduce((s, e) => s + e.count, 0); if (spent + count <= POINTS_PER_MINUTE) break; await sleep(Math.max(1000, pointWindow[0].at + 60_000 - performance.now())); } pointWindow.push({ at: performance.now(), count }); };

// Οι μέρες-στόχοι: χθες … πριν PAST_DAYS μέρες (το σήμερα δεν έχει κλείσει, δεν κρίνεται).
const dayKey = (d) => d.toLocaleDateString('en-CA');
const today = new Date();
const targets = Array.from({ length: PAST_DAYS }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (i + 1)); return dayKey(d); }).sort();
console.log(`lead=${LEAD} (κύμα lead=${MARINE_LEAD}) · μέρες-στόχοι ${targets[0]} … ${targets[targets.length - 1]} · ${regions.length} περιοχές`);

const out = { generatedAt: new Date().toISOString(), lead: LEAD, marineLead: MARINE_LEAD, pastDays: PAST_DAYS, dates: targets, regions: {}, missingDays: 0 };
let done = 0;
for (const region of regions) {
  try {
    const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    await pace(resolution.points.length + 1);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch([region.regionPoint]), fetchMarineForecastDataBatch(resolution.points)]);
    const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
    if (!wind) { process.stderr.write(`\n  ${region.regionId}: χωρίς άνεμο\n`); continue; }
    const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
    const merged = mergeMarineForecastData(wind.data, regionMarine);
    const rec = { beachIds: region.beaches.map(b => b.id), days: {} };
    for (const target of targets) {
      // Το «σήμερα» της εφαρμογής = η μέρα-στόχος, 06:00 Ελλάδας (πριν από κάθε ώρα παραλίας).
      syncClockFromTrustedInstant(Date.parse(`${target}T06:00:00+03:00`));
      const days = processForecastData(merged);
      const regionDay = days.find(d => d?.date && dayKey(d.date) === target);
      if (!regionDay) { out.missingDays += 1; continue; }
      const comfort = [], colour = [], windKmh = [];
      for (const beach of region.beaches) {
        const key = resolution.keyByBeachId.get(beach.id);
        const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
        const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
        const s = calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
        comfort.push(s.swimmingComfort ?? null);
        colour.push(s.simpleWindSuitability?.suitabilityColor ?? s.suitabilityColor ?? null);
        windKmh.push(Number.isFinite(dayForecast.wind?.speed) ? Math.round(dayForecast.wind.speed * 3.6) : null);
      }
      rec.days[target] = { comfort, colour, windKmh };
    }
    syncClockFromTrustedInstant(Date.now());
    out.regions[region.regionId] = rec;
    done += 1;
    process.stderr.write(`\r  ${done}/${regions.length} περιοχές`);
    // --regionDelayMs=15000 για επανάληψη με αργό ρυθμό: ο δωρεάν previous-runs host έκοψε (429) στη ~150ή βαριά κλήση της ώρας (13/09).
    await sleep(Number(arg('regionDelayMs', 150)));
  } catch (e) { syncClockFromTrustedInstant(Date.now()); process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`); }
}
process.stderr.write('\n');
out.fetchStats = stats;
mkdirSync(OUT_DIR, { recursive: true });
// --tag=retry → ξεχωριστό αρχείο (π.χ. επανάληψη για περιοχές που έληξαν στον δωρεάν host)· ενώνεται με --merge=<tag>.
const TAG = arg('tag', '');
const file = path.join(OUT_DIR, `lead${LEAD}-${runDate}${TAG ? `-${TAG}` : ''}.json`);
writeFileSync(file, JSON.stringify(out));
const totalRows = Object.values(out.regions).reduce((s, r) => s + Object.values(r.days).reduce((t, d) => t + d.comfort.length, 0), 0);
console.log(`Περιοχές ${done}/${regions.length} · παραλίες-μέρες ${totalRows} · μέρες που δεν βρέθηκαν ${out.missingDays} · κλήσεις άνεμος ${stats.wind} / κύμα ${stats.marine} / SST ${stats.sst} · μετονομασίες ${stats.renamed} (όλες κενές: ${stats.nullLead})`);
console.log(`→ ${path.relative(root, file)}`);
