#!/usr/bin/env node
/**
 * ΠΟΣΟ ΣΥΧΝΑ ΜΙΑ «ΗΡΕΜΗ» ΩΡΑ ΕΧΕΙ ΡΙΠΕΣ ΠΟΥ ΝΙΩΘΕΙΣ; — ΜΕΤΡΗΣΗ ΣΕ ΟΡΓΑΝΑ.
 *
 * Αφορμή: §9 σκανδάλη #1 της βίβλου («χρήστης αναφέρει ψεύτικη ηρεμία»), 20/08/2026, Αχαράβη
 * και Άναξος. Και στις δύο ο ωριαίος μέσος είναι 2 Μποφόρ — άρα μπλε πινέζα, και σωστά: το νερό
 * είναι μετρημένα επίπεδο (0,10 μ). Αλλά η ριπή φτάνει 29 και 18 χλμ/ώ, και ο επισκέπτης ΤΗ
 * ΝΙΩΘΕΙ. Η προειδοποίηση ριπής υπάρχει (services/recommendationService.ts) αλλά σωπαίνει διά
 * νόμου κάτω από 3 Μποφόρ: `GUST_MIN_BASE_BEAUFORT = 3`.
 *
 * ΓΙΑΤΙ ΟΡΓΑΝΑ ΚΑΙ ΟΧΙ ΜΟΝΤΕΛΟ: το ερώτημα είναι «τι νιώθει ο άνθρωπος που στέκεται εκεί»,
 * και το μοντέλο στρώνει τις κορυφές πάνω από στεριά (§ δάπεδος ριπής). Η ριπή του METAR είναι
 * μέτρηση, όχι εκτίμηση.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/calm-hour-gusts-<ημερομηνία>.json.
 *
 *   node scripts/measureCalmHourGusts.mjs [ημέρες_πίσω | YYYY-MM-DD:YYYY-MM-DD]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIONS = [
  'LGIR', 'LGSA', 'LGST', 'LGRP', 'LGKO', 'LGMK', 'LGSR', 'LGNX', 'LGPA', 'LGSK',
  'LGKR', 'LGZA', 'LGKF', 'LGPZ', 'LGLM', 'LGMT', 'LGSM', 'LGHI', 'LGKL', 'LGAL',
  'LGKV', 'LGTS', 'LGKC', 'LGML', 'LGLE', 'LGKP', 'LGIK', 'LGSY', 'LGBL', 'LGRX',
];
const KT_TO_KMH = 1.852;
const ARG = process.argv[2] || '21';
const WINDOW = ARG.includes(':') ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Number(ARG);

const bft = kmh => (kmh < 1 ? 0 : kmh <= 5 ? 1 : kmh <= 11 ? 2 : kmh <= 19 ? 3
  : kmh <= 28 ? 4 : kmh <= 38 ? 5 : kmh <= 49 ? 6 : 7);
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);

const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const label = WINDOW ? WINDOW.join(' → ') : `${DAYS_BACK} ημέρες`;

const url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + STATIONS.map(s => `station=${s}`).join('&')
  + `&data=sknt&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const res = await fetch(url, { signal: AbortSignal.timeout(300000) });
if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1); }
const csv = await res.text();
const NEWLINE = String.fromCharCode(10);
const csvLines = csv.split(NEWLINE).slice(1);

/**
 * ΤΟ ΚΕΝΟ ΠΕΔΙΟ ΡΙΠΗΣ ΔΕΝ ΕΙΝΑΙ ΑΓΝΩΣΤΗ ΡΙΠΗ — ΕΙΝΑΙ «ΚΑΜΙΑ ΑΞΙΟΣΗΜΕΙΩΤΗ ΡΙΠΗ».
 * Το METAR αναφέρει `Gxx` μόνο όταν η κορυφή ξεπερνά τον μέσο κατά ≥10 κόμβους. Αν πετάξουμε
 * τις ώρες χωρίς ριπή, κρατάμε ΜΟΝΟ τις ριπώδεις και το ποσοστό εκτοξεύεται — το κλασικό
 * σφάλμα επιλογής. Εδώ η απουσία μετράει ως ριπή ίση με τον μέσο.
 */
const rows = [];
for (const line of csvLines) {
  const [icao, valid, sknt, gust] = line.trim().split(',');
  if (!icao || !valid || sknt === 'M' || sknt === '' || sknt === undefined) continue;
  const kt = Number(sknt);
  if (!Number.isFinite(kt)) continue;
  const g = Number(gust);
  const meanKmh = kt * KT_TO_KMH;
  rows.push({ icao, meanKmh, gustKmh: Number.isFinite(g) ? g * KT_TO_KMH : meanKmh });
}
console.log(`μετρήσεις: ${rows.length} ώρες-σταθμοί · ${label}`);

const calm = rows.filter(r => bft(r.meanKmh) <= 2);
console.log(`\n=== ΩΡΕΣ ΠΟΥ ΤΟ SITE ΘΑ ΕΛΕΓΕ «ΗΡΕΜΑ» (μέσος ≤2 Μποφόρ): ${calm.length} (${pct(calm.length, rows.length)}% όλων) ===`);
console.log('  Σε πόσες από αυτές η ΡΙΠΗ φτάνει:');
const buckets = [
  [12, '3 Μποφόρ (12 χλμ/ώ) — αισθητό αεράκι'],
  [19, '4 Μποφόρ (19) — σηκώνει άμμο, κουνάει ομπρέλα'],
  [28, '5 Μποφόρ (28) — παίρνει ομπρέλα'],
  [38, '6 Μποφόρ (38)'],
];
const out = { window: label, hours: rows.length, calmHours: calm.length, buckets: {}, spread: {}, perStation: {} };
for (const [kmh, name] of buckets) {
  const n = calm.filter(r => r.gustKmh >= kmh).length;
  out.buckets[kmh] = { hours: n, pct: pct(n, calm.length) };
  console.log(`    ≥${String(kmh).padStart(2)} χλμ/ώ · ${name.padEnd(44)} ${String(n).padStart(5)} (${pct(n, calm.length)}%)`);
}
console.log('\n  Και με το ΥΠΑΡΧΟΝ κριτήριο «ριπή μείον μέσος» που χρησιμοποιεί ήδη ο κώδικας:');
for (const s of [10, 14, 18, 22]) {
  const n = calm.filter(r => r.gustKmh - r.meanKmh >= s).length;
  out.spread[s] = { hours: n, pct: pct(n, calm.length) };
  console.log(`    διαφορά ≥${String(s).padStart(2)} χλμ/ώ: ${String(n).padStart(5)} ώρες (${pct(n, calm.length)}%)`);
}

// Ανά σταθμό — για να φανεί αν το φαινόμενο είναι γεωγραφία ή θόρυβος.
console.log('\n=== ΑΝΑ ΣΤΑΘΜΟ: ήρεμες ώρες με ριπή ≥19 χλμ/ώ ===');
const perStation = [];
for (const icao of STATIONS) {
  const rs = calm.filter(r => r.icao === icao);
  if (rs.length < 50) continue;
  const n = rs.filter(r => r.gustKmh >= 19).length;
  perStation.push({ icao, calmHours: rs.length, pct: pct(n, rs.length) });
}
perStation.sort((a, b) => b.pct - a.pct);
for (const p of perStation.slice(0, 6)) console.log(`  ${p.icao}: ${p.pct}% από ${p.calmHours} ήρεμες ώρες`);
console.log(`  ... διάμεσος σταθμού: ${perStation[Math.floor(perStation.length / 2)]?.pct}%`);
out.perStation = perStation;

// ── ΤΟ ΔΕΥΤΕΡΟ ΕΡΩΤΗΜΑ, ΤΟ ΚΡΙΣΙΜΟ ───────────────────────────────────────────
//
// Το παραπάνω λέει ότι «ήρεμα με ριπές» ΔΕΝ ΥΠΑΡΧΕΙ στα όργανα. Αλλά το μοντέλο το λέει (Αχαράβη
// 20/08: μέσος 9,7 · ριπή 29,2 · λόγος 3,0). Άρα το ΜΟΝΤΕΛΟ αυτοαναιρείται — και το ερώτημα που
// κρίνει τη διόρθωση είναι ΠΟΙΟ από τα δύο νούμερά του είναι το λάθος:
//
//   (α) ο ΜΕΣΟΣ είναι πολύ χαμηλός → ο δάπεδος ριπής έχει δίκιο, πρέπει να τον σηκώσει
//   (β) η ΡΙΠΗ είναι πολύ ψηλή     → ο δάπεδος θα εφεύρει άνεμο που δεν υπάρχει
//
// Το κρίνει μόνο μέτρηση: στις ώρες όπου το ΜΟΝΤΕΛΟ λέει «≤2 Μποφόρ με λόγο ριπής ≥3», τι
// διάβασε το όργανο;
const STATION_COORDS = [
  ['LGIR', 35.3397, 25.1803], ['LGSA', 35.5317, 24.1497], ['LGST', 35.2161, 26.1013],
  ['LGRP', 36.4054, 28.0862], ['LGKO', 36.7933, 27.0917], ['LGMK', 37.4351, 25.3481],
  ['LGSR', 36.3992, 25.4793], ['LGNX', 37.0811, 25.3681], ['LGPA', 37.0103, 25.1281],
  ['LGSK', 39.1771, 23.5037], ['LGKR', 39.6019, 19.9117], ['LGZA', 37.7509, 20.8843],
  ['LGKF', 38.1201, 20.5005], ['LGPZ', 38.9255, 20.7653], ['LGLM', 39.9217, 25.2364],
  ['LGMT', 39.0567, 26.5983], ['LGSM', 37.6900, 26.9117], ['LGHI', 38.3432, 26.1406],
  ['LGKL', 37.0683, 22.0255], ['LGAL', 40.8559, 25.9563], ['LGKV', 40.9133, 24.6192],
  ['LGTS', 40.5197, 22.9709], ['LGKC', 36.2743, 23.0170], ['LGML', 36.6969, 24.4769],
  ['LGLE', 37.1849, 26.8003], ['LGKP', 35.4214, 27.1460], ['LGIK', 37.6827, 26.3470],
  ['LGSY', 38.9676, 24.4872], ['LGBL', 39.2196, 22.7943], ['LGRX', 38.1511, 21.4256],
];
// Ξαναχτίζουμε τις παρατηρήσεις με κλειδί ώρας ώστε να ταιριάξουν με το μοντέλο.
const obsByKey = new Map();
for (const line of csvLines) {
  const [icao, valid, sknt, gust] = line.trim().split(',');
  if (!icao || !valid || sknt === 'M' || sknt === '' || sknt === undefined) continue;
  const kt = Number(sknt);
  if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(d.getTime())) continue;
  const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - rounded.getTime());
  const prev = obsByKey.get(key);
  if (prev && prev.gap <= gap) continue;
  const g = Number(gust);
  obsByKey.set(key, { gap, meanKmh: kt * KT_TO_KMH, gustKmh: Number.isFinite(g) ? g * KT_TO_KMH : kt * KT_TO_KMH });
}
const mUrl = 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${STATION_COORDS.map(s => s[1]).join(',')}&longitude=${STATION_COORDS.map(s => s[2]).join(',')}`
  + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC'
  + (WINDOW ? `&start_date=${WINDOW[0]}&end_date=${WINDOW[1]}` : `&past_days=${DAYS_BACK}&forecast_days=1`)
  + '&models=best_match';
const mRes = await fetch(mUrl, { signal: AbortSignal.timeout(120000) });
const mJson = await mRes.json();
const entries = Array.isArray(mJson) ? mJson : [mJson];
const suspect = [];
entries.forEach((e, i) => {
  const st = STATION_COORDS[i];
  if (!st || !e?.hourly) return;
  e.hourly.time.forEach((t, idx) => {
    const mean = e.hourly.wind_speed_10m?.[idx];
    const gust = e.hourly.wind_gusts_10m?.[idx];
    if (typeof mean !== 'number' || typeof gust !== 'number' || mean <= 0) return;
    if (bft(mean) > 2) return;
    if (gust / mean < 3) return;
    const obs = obsByKey.get(`${st[0]}|${t.slice(0, 13)}`);
    if (!obs) return;
    suspect.push({ icao: st[0], time: t, modelMean: mean, modelGust: gust, obsMean: obs.meanKmh, obsGust: obs.gustKmh });
  });
});
console.log(`
=== ΟΤΑΝ ΤΟ ΜΟΝΤΕΛΟ ΛΕΕΙ «≤2 ΜΠΟΦΟΡ ΜΕ ΛΟΓΟ ΡΙΠΗΣ ≥3»: ${suspect.length} ώρες με όργανο δίπλα ===`);
if (suspect.length >= 20) {
  const avg = f => suspect.reduce((s, r) => s + f(r), 0) / suspect.length;
  console.log(`  ο ΜΕΣΟΣ του μοντέλου: ${avg(r => r.modelMean).toFixed(1)} χλμ/ώ · το όργανο διάβασε: ${avg(r => r.obsMean).toFixed(1)}`);
  console.log(`  η ΡΙΠΗ του μοντέλου:  ${avg(r => r.modelGust).toFixed(1)} χλμ/ώ · το όργανο διάβασε: ${avg(r => r.obsGust).toFixed(1)}`);
  const meanTooLow = suspect.filter(r => r.obsMean > r.modelMean).length;
  const gustTooHigh = suspect.filter(r => r.modelGust > r.obsGust).length;
  console.log(`  ο μέσος ήταν ΠΟΛΥ ΧΑΜΗΛΟΣ σε ${pct(meanTooLow, suspect.length)}% των ωρών`);
  console.log(`  η ριπή ήταν ΠΟΛΥ ΨΗΛΗ σε ${pct(gustTooHigh, suspect.length)}% των ωρών`);
  const floorHelps = suspect.filter(r => Math.abs(Math.max(r.modelMean, 0.5 * r.modelGust) - r.obsMean) < Math.abs(r.modelMean - r.obsMean)).length;
  console.log(`  ο ΔΑΠΕΔΟΣ ΡΙΠΗΣ (0,50×ριπή) θα έφερνε τον αριθμό ΠΙΟ ΚΟΝΤΑ στο όργανο σε ${pct(floorHelps, suspect.length)}% των ωρών`);
  out.suspect = {
    hours: suspect.length,
    modelMean: avg(r => r.modelMean), obsMean: avg(r => r.obsMean),
    modelGust: avg(r => r.modelGust), obsGust: avg(r => r.obsGust),
    meanTooLowPct: pct(meanTooLow, suspect.length),
    gustTooHighPct: pct(gustTooHigh, suspect.length),
    floorHelpsPct: pct(floorHelps, suspect.length),
  };
} else {
  console.log('  πολύ λίγες ώρες για συμπέρασμα — το μοντέλο σχεδόν ποτέ δεν λέει κάτι τέτοιο εδώ');
  out.suspect = { hours: suspect.length, note: 'too few' };
}

const OUT_DIR = path.join(root, 'reports/weather');
fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date(endMs).toISOString().slice(0, 10);
const file = path.join(OUT_DIR, `calm-hour-gusts-${stamp}.json`);
fs.writeFileSync(`${file}.tmp`, JSON.stringify(out, null, 2), 'utf8');
fs.renameSync(`${file}.tmp`, file);
console.log(`\nΓράφτηκε ${path.relative(root, file)}`);
