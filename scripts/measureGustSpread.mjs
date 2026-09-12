#!/usr/bin/env node
/**
 * ΤΟ ΚΑΤΩΦΛΙ ΡΙΠΗΣ 22 ΧΛΜ/Ω — ΑΠΟΚΤΑ ΠΡΟΕΛΕΥΣΗ; (12/09/2026, βίβλος §Γ81 Δ5) — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΙ ΚΡΙΝΕΤΑΙ. Η ετυμηγορία κολύμβησης προσθέτει +1 ενεργό Μποφόρ όταν «ριπή − μέσος ≥ 22 χλμ/ώ»
 * πάνω από 3 Μποφόρ (services/recommendationService.ts, GUST_EFFECTIVE_BFT_SPREAD_KMH). Το 22 δεν
 * έχει προέλευση σε 12.000 γραμμές βίβλου, και η ριπή του μοντέλου είναι παραμετροποιημένο
 * διαγνωστικό, όχι μέτρηση: στους 41 σταθμούς meteo.gr έχει +6 χλμ/ώ μεροληψία (Σάμος +26,
 * Λέντας −13), και στις «ήρεμες» ώρες φούσκα στο 87% (calm-hour-gusts-2026-08-20). Ρωτάμε λοιπόν:
 *   1. Πόσο απέχει η ριπή του μοντέλου από τη ριπή του METAR, ανά σταθμό και ανά Μποφόρ οργάνου;
 *   2. Το «μοντέλο λέει spread ≥ 22» πόσο συχνά συμπίπτει με «το όργανο μέτρησε spread ≥ 22»;
 *      Και ποιο κατώφλι ΜΟΝΤΕΛΟΥ ταιριάζει καλύτερα το παρατηρημένο 22 (ίδιο ποσοστό ωρών,
 *      καλύτερος λόγος σωστών/λάθος);
 *   3. Πόσο συχνά λείπει η ριπή από την απάντηση του μοντέλου (εκεί η σελίδα έβαζε ×1,2 —
 *      services/weatherService.ts:547 — και ο κανόνας έσβηνε σιωπηλά);
 *
 * Ο ΚΡΙΤΗΣ ΚΑΙ ΤΟ ΟΡΙΟ ΤΟΥ. Το METAR γράφει ριπή (Gxx) μόνο όταν η μέγιστη 10-λεπτη ριπή ξεπερνά
 * τον μέσο κατά ≥10 κόμβους (~18,5 χλμ/ώ). Άρα «χωρίς ριπή στο METAR» ΔΕΝ σημαίνει «spread 0»,
 * σημαίνει «spread κάτω από ~18». Γι' αυτό η σύγκριση γίνεται ΜΟΝΟ πάνω στο κατώφλι που ο κριτής
 * μπορεί να δει: παρατηρημένο spread ≥ 22 = «γεγονός», αλλιώς «όχι γεγονός» (συμπεριλαμβανομένης
 * της απουσίας). Το μοντέλο κρίνεται ως ανιχνευτής αυτού του γεγονότος.
 *
 * ΠΑΡΑΘΥΡΑ: τα ίδια με τη δωρεάν λειτουργία της αποσυμπίεσης (C 10-25/07, B 04-18/08, E 20/08-03/09),
 * δωρεάν πόρτα Open-Meteo, 30 παράκτια αεροδρόμια. Ώρες 06-16 UTC (όταν παίρνονται οι αποφάσεις).
 *
 * ΔΕΝ αλλάζει καμία σταθερά. Γράφει reports/weather/gust-spread-vs-stations-<ημερομηνία>.json.
 *   node scripts/measureGustSpread.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { STATIONS, fetchStationHours } from './lib/windStations.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const WINDOWS = { C: ['2026-07-10', '2026-07-25'], B: ['2026-08-04', '2026-08-18'], E: ['2026-08-20', '2026-09-03'] };
const DAY_HOURS_UTC = [6, 16];
const SPREAD_KMH = 22;            // το κατώφλι της ετυμηγορίας
const MIN_BASE_BFT = 3;           // ο κανόνας ισχύει πάνω από 3 Μποφόρ (baseBeaufort ≥ 3)
const METAR_GUST_MIN_KMH = 18.5;  // ~10 κόμβοι: κάτω από εκεί το METAR δεν γράφει ριπή
const CANDIDATE_T = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 38];

const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const round = (n, p = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
};

const rows = [];
let modelHours = 0, modelGustMissing = 0;
for (const [key, [start, end]] of Object.entries(WINDOWS)) {
  process.stderr.write(`· ${key} ${start} → ${end}: όργανα…`);
  const observed = await fetchStationHours(Date.parse(`${start}T00:00:00Z`), Date.parse(`${end}T23:00:00Z`));
  process.stderr.write(` ${observed.size} · μοντέλο…`);
  const meteo = await fetchJson('https://api.open-meteo.com/v1/forecast'
    + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
    + `&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC&start_date=${start}&end_date=${end}`);
  const entries = Array.isArray(meteo) ? meteo : [meteo];
  let n = 0;
  STATIONS.forEach(([icao, name], i) => {
    const m = entries[i];
    if (!m?.hourly?.time) return;
    const { time, wind_speed_10m: ws, wind_gusts_10m: wg } = m.hourly;
    for (let h = 0; h < time.length; h++) {
      const hourUtc = Number(time[h].slice(11, 13));
      if (hourUtc < DAY_HOURS_UTC[0] || hourUtc > DAY_HOURS_UTC[1]) continue;
      const raw = ws?.[h], gust = wg?.[h];
      if (!Number.isFinite(raw)) continue;
      modelHours += 1;
      if (!Number.isFinite(gust)) modelGustMissing += 1;
      const obs = observed.get(`${icao}|${time[h].slice(0, 13)}`);
      if (!obs) continue;
      rows.push({ icao, name, window: key, raw, gust: Number.isFinite(gust) ? gust : null, obs: obs.kmh, obsGust: obs.gustKmh });
      n += 1;
    }
  });
  process.stderr.write(` ${n} ζευγάρια\n`);
}
if (rows.length < 1000) { console.error('πολύ λίγα ζευγάρια — δεν βγάζω συμπέρασμα'); process.exit(1); }

// ── 1. Η ριπή του μοντέλου απέναντι στη ριπή του METAR (μόνο όπου το METAR έγραψε ριπή) ──
const withObsGust = rows.filter(r => r.obsGust !== null && r.gust !== null);
const byStation = {}, byObsBft = {};
for (const r of withObsGust) {
  const d = r.gust - r.obsGust;
  (byStation[r.icao] ||= { name: r.name, n: 0, sum: 0, sumAbs: 0 });
  byStation[r.icao].n += 1; byStation[r.icao].sum += d; byStation[r.icao].sumAbs += Math.abs(d);
  const b = getBeaufortLevel(r.obs);
  (byObsBft[b] ||= { n: 0, sum: 0 }); byObsBft[b].n += 1; byObsBft[b].sum += d;
}
const stationBias = Object.entries(byStation).map(([icao, s]) => ({ icao, name: s.name, n: s.n, biasKmh: round(s.sum / s.n), maeKmh: round(s.sumAbs / s.n) })).sort((a, b) => b.biasKmh - a.biasKmh);
const gustBias = { n: withObsGust.length, biasKmh: round(withObsGust.reduce((t, r) => t + r.gust - r.obsGust, 0) / (withObsGust.length || 1)),
  byObsBft: Object.fromEntries(Object.entries(byObsBft).map(([b, s]) => [b, { n: s.n, biasKmh: round(s.sum / s.n) }])), byStation: stationBias };

// ── 2. Ο κανόνας ως ανιχνευτής: obs spread ≥ 22 vs model spread ≥ T, πάνω από 3 Μποφόρ οργάνου ──
const inScope = rows.filter(r => getBeaufortLevel(r.obs) >= MIN_BASE_BFT);
const event = r => r.obsGust !== null && (r.obsGust - r.obs) >= SPREAD_KMH;
const events = inScope.filter(event).length;
const detector = CANDIDATE_T.map(T => {
  let tp = 0, fp = 0, fn = 0, tn = 0, fires = 0;
  for (const r of inScope) {
    const fired = r.gust !== null && (r.gust - r.raw) >= T;
    const ev = event(r);
    if (fired) fires += 1;
    if (fired && ev) tp += 1; else if (fired && !ev) fp += 1; else if (!fired && ev) fn += 1; else tn += 1;
  }
  return { T, fires, firesPct: pct(fires, inScope.length), hitRate: pct(tp, tp + fn), falseAlarmOfFires: pct(fp, fires), missed: fn, tp, fp, tn, fn };
});
// Το κατώφλι μοντέλου που «ανάβει» σε τόσες ώρες όσες το παρατηρημένο 22 (ισο-συχνότητα).
const eventRatePct = pct(events, inScope.length);
const isoFreq = detector.reduce((best, d) => (best === null || Math.abs(d.firesPct - eventRatePct) < Math.abs(best.firesPct - eventRatePct) ? d : best), null);
const current = detector.find(d => d.T === SPREAD_KMH);
// Τι ΚΑΝΕΙ η παραγωγή σήμερα στις ώρες που το όργανο είδε ≥ 22: πόσες πιάνει.
const scopeSummary = { inScopeHours: inScope.length, obsSpreadEvents: events, eventRatePct, obsGustReportedPct: pct(inScope.filter(r => r.obsGust !== null).length, inScope.length) };

const report = {
  generatedAt: new Date().toISOString(), windows: WINDOWS, dayHoursUtc: DAY_HOURS_UTC, stations: STATIONS.length,
  pairs: rows.length, modelHours, modelGustMissing, modelGustMissingPct: pct(modelGustMissing, modelHours),
  rule: { spreadKmh: SPREAD_KMH, minBaseBft: MIN_BASE_BFT, where: 'services/recommendationService.ts GUST_EFFECTIVE_BFT_SPREAD_KMH' },
  judgeLimit: `το METAR γράφει ριπή μόνο ≥ ~${METAR_GUST_MIN_KMH} χλμ/ώ πάνω από τον μέσο — απουσία = spread κάτω από εκεί, όχι 0`,
  gustBias, scope: scopeSummary, detector, current, isoFrequency: isoFreq,
  note: 'Δ5 (§Γ81): μέτρηση μόνο. Το κατώφλι δεν αλλάζει χωρίς απόφαση Μίλτου.',
};
const outPath = path.join(root, 'reports/weather', `gust-spread-vs-stations-${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nΡΙΠΗ vs METAR (${rows.length} ζευγάρια, ${withObsGust.length} με ριπή στο METAR):`);
console.log(`  ριπή μοντέλου − ριπή οργάνου: μέση ${gustBias.biasKmh} χλμ/ώ · ανά Μπφ οργάνου: ${Object.entries(gustBias.byObsBft).map(([b, s]) => `${b}:${s.biasKmh}`).join(' ')}`);
console.log(`  ακραίοι σταθμοί: ${stationBias.slice(0, 3).map(s => `${s.name} ${s.biasKmh > 0 ? '+' : ''}${s.biasKmh}`).join(' · ')} … ${stationBias.slice(-3).map(s => `${s.name} ${s.biasKmh}`).join(' · ')}`);
console.log(`  ριπή λείπει από το μοντέλο: ${modelGustMissing}/${modelHours} ώρες (${report.modelGustMissingPct}%)`);
console.log(`\nΟ ΚΑΝΟΝΑΣ «spread ≥ 22» ΩΣ ΑΝΙΧΝΕΥΤΗΣ (όργανο ≥ 3 Μπφ, ${inScope.length} ώρες, γεγονότα ${events} = ${eventRatePct}%):`);
for (const d of detector) console.log(`  T=${String(d.T).padStart(2)}: ανάβει ${d.firesPct}% · πιάνει ${d.hitRate}% των γεγονότων · από όσες ανάβει, λάθος ${d.falseAlarmOfFires}%${d.T === SPREAD_KMH ? '  ← σήμερα' : ''}${isoFreq && d.T === isoFreq.T ? '  ← ισο-συχνότητα' : ''}`);
console.log(`\n→ ${path.relative(root, outPath)}`);
