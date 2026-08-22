#!/usr/bin/env node
/**
 * Η ΤΑΧΥΤΗΤΑ ΑΠΟ ΤΟ ΝΕΡΟ — ΟΧΙ ΠΑΝΤΟΥ, ΑΛΛΑ ΜΟΝΟ ΟΠΟΥ ΤΟ ΣΤΕΡΙΑΝΟ ΚΕΛΙ ΕΙΝΑΙ ΜΑΚΡΙΑ.
 *
 * ΤΙ ΕΧΕΙ ΗΔΗ ΑΠΑΝΤΗΘΕΙ (§Γ29, `utils/overWaterWind`): η ΔΙΕΥΘΥΝΣΗ του θαλασσινού κελιού
 * κερδίζει όταν το στεριανό κάθεται ≥3 χλμ μακριά (60,1%→63,2% Αύγ., 51,0%→53,9% Ιούν.). Η
 * ΤΑΧΥΤΗΤΑ δοκιμάστηκε ΩΣ ΟΛΙΚΗ ΑΝΤΙΚΑΤΑΣΤΑΣΗ και ΔΕΝ αποδείχθηκε: «κάτω από 3 χλμ η στεριά
 * ήταν σταθερά ΚΑΛΥΤΕΡΗ· το ένα παράθυρο έδειξε τη θάλασσα καλύτερη, το άλλο τη στεριά».
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΑΦΗΝΕΙ. Η διεύθυνση κρίθηκε ΜΕ ΤΗΝ ΑΠΟΣΤΑΣΗ ΩΣ ΔΙΑΧΩΡΙΣΤΗ και κέρδισε· η
 * ταχύτητα κρίθηκε ΧΩΡΙΣ διαχωριστή και έχασε. Κανείς δεν ρώτησε αν η ταχύτητα κερδίζει στο
 * ΙΔΙΟ υποσύνολο όπου κέρδισε η διεύθυνση — δηλαδή στις παραλίες που απαντώνται από κελί βαθιά
 * μέσα στο νησί. Το «σταθερά καλύτερη κάτω από 3 χλμ» δεν λέει τίποτα για τα 7 χλμ.
 *
 * ΓΙΑΤΙ ΤΩΡΑ. Αχαράβη Κέρκυρας, 21/08/2026: το στεριανό κελί κάθεται **7,2 χλμ μέσα** και δίνει
 * 9,2 χλμ/ώ (2 Μπφ, μπλε πινέζα). Το όργανο της Κέρκυρας την ίδια ώρα: 22,2 χλμ/ώ σταθερά.
 * Είναι το ΙΔΙΟ κελί που το `utils/overWaterWind` ήδη κατηγορεί ονομαστικά ότι γυρίζει το χρώμα
 * μέσω της διεύθυνσης. Αν κουβαλά και λάθος ένταση, το ξέρουμε μόνο αν το μετρήσουμε.
 *
 * ΠΩΣ. Το Open-Meteo δέχεται `cell_selection=land|sea`. Ζητάμε ΤΙΣ ΙΔΙΕΣ συντεταγμένες σταθμού
 * δύο φορές και κρίνουμε και τις δύο απαντήσεις με το METAR του σταθμού. Κάθε ώρα μπαίνει σε
 * κάδο ανάλογα με το ΠΟΣΟ ΜΑΚΡΙΑ έπεσε το στεριανό κελί.
 *
 * ΤΙ ΘΑ ΘΕΩΡΗΘΕΙ ΝΙΚΗ — γραμμένο ΠΡΙΝ τρέξει, για να μην επιλεγεί μετά:
 *   Η θάλασσα κερδίζει σε έναν κάδο μόνο αν ΚΑΙ ΤΑ ΔΥΟ ισχύουν σε ΚΑΘΕ παράθυρο που τρέχει:
 *   (α) μικρότερο απόλυτο σφάλμα σε χλμ/ώ, (β) περισσότερα σωστά Μποφόρ. Οτιδήποτε άλλο =
 *   δεν αποδείχθηκε, ακριβώς όπως την πρώτη φορά.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει `reports/weather/sea-cell-speed-by-distance-<ημερομηνία>.json`.
 *
 *   node scripts/measureSeaCellSpeedByDistance.mjs [ημέρες_πίσω | YYYY-MM-DD:YYYY-MM-DD]
 *
 * ΟΡΙΑ. Κριτής = αεροδρόμιο. Τα αεροδρόμια ΔΕΝ είναι παραλίες: κάθονται πιο μέσα και πιο ανοιχτά,
 * οπότε ό,τι κερδίζει η θάλασσα εδώ είναι μάλλον ΥΠΟΤΙΜΗΣΗ του κέρδους σε παραλία — αλλά αυτό
 * είναι επιχείρημα, όχι μέτρηση, και δεν επιτρέπεται να μετρήσει σαν απόδειξη.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATIONS = [
  ['LGIR', 'Ηράκλειο', 35.3397, 25.1803], ['LGSA', 'Χανιά', 35.5317, 24.1497],
  ['LGST', 'Σητεία', 35.2161, 26.1013], ['LGRP', 'Ρόδος', 36.4054, 28.0862],
  ['LGKO', 'Κως', 36.7933, 27.0917], ['LGMK', 'Μύκονος', 37.4351, 25.3481],
  ['LGSR', 'Σαντορίνη', 36.3992, 25.4793], ['LGNX', 'Νάξος', 37.0811, 25.3681],
  ['LGPA', 'Πάρος', 37.0103, 25.1281], ['LGSK', 'Σκιάθος', 39.1771, 23.5037],
  ['LGKR', 'Κέρκυρα', 39.6019, 19.9117], ['LGZA', 'Ζάκυνθος', 37.7509, 20.8843],
  ['LGKF', 'Κεφαλονιά', 38.1201, 20.5005], ['LGPZ', 'Άκτιο', 38.9255, 20.7653],
  ['LGLM', 'Λήμνος', 39.9217, 25.2364], ['LGMT', 'Μυτιλήνη', 39.0567, 26.5983],
  ['LGSM', 'Σάμος', 37.6900, 26.9117], ['LGHI', 'Χίος', 38.3432, 26.1406],
  ['LGKL', 'Καλαμάτα', 37.0683, 22.0255], ['LGAL', 'Αλεξανδρούπολη', 40.8559, 25.9563],
  ['LGKV', 'Καβάλα', 40.9133, 24.6192], ['LGTS', 'Θεσσαλονίκη', 40.5197, 22.9709],
  ['LGKC', 'Κύθηρα', 36.2743, 23.0170], ['LGML', 'Μήλος', 36.6969, 24.4769],
  ['LGLE', 'Λέρος', 37.1849, 26.8003], ['LGKP', 'Κάρπαθος', 35.4214, 27.1460],
  ['LGIK', 'Ικαρία', 37.6827, 26.3470], ['LGSY', 'Σκύρος', 38.9676, 24.4872],
  ['LGBL', 'Ν. Αγχίαλος', 39.2196, 22.7943], ['LGRX', 'Άραξος', 38.1511, 21.4256],
];

const KT_TO_KMH = 1.852;
const bft = kmh => (kmh < 1 ? 0 : kmh <= 5 ? 1 : kmh <= 11 ? 2 : kmh <= 19 ? 3
  : kmh <= 28 ? 4 : kmh <= 38 ? 5 : kmh <= 49 ? 6 : 7);
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const round = (n, p = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
/** Απόσταση σε χλμ (επίπεδη προσέγγιση· αρκεί για κελιά 0,125°). */
const distKm = (aLat, aLon, bLat, bLon) =>
  Math.hypot((aLat - bLat) * 111.2, (aLon - bLon) * 111.2 * Math.cos((aLat + bLat) / 2 * Math.PI / 180));

const ARG = process.argv[2] || '21';
const WINDOW = ARG.includes(':') ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Number(ARG);
const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const label = WINDOW ? WINDOW.join(' → ') : `${DAYS_BACK} ημέρες`;

const fetchJson = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
  }
};

// ── 1. ΤΟ ΟΡΓΑΝΟ ──────────────────────────────────────────────────────────────
process.stderr.write('· κατεβάζω μετρήσεις σταθμών…\n');
const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + STATIONS.map(s => `station=${s[0]}`).join('&')
  + `&data=sknt&data=drct&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(180000) });
if (!csvRes.ok) { console.error(`αρχείο μετρήσεων: HTTP ${csvRes.status}`); process.exit(1); }
const observed = new Map();
for (const line of (await csvRes.text()).split('\n').slice(1)) {
  const [icao, valid, sknt] = line.trim().split(',');
  if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
  const kt = Number(sknt);
  if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(d.getTime())) continue;
  const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - rounded.getTime());
  const prev = observed.get(key);
  if (prev && prev.gap <= gap) continue;
  observed.set(key, { gap, kmh: kt * KT_TO_KMH });
}
process.stderr.write(`· ${observed.size} ώρες-σταθμοί από όργανα\n`);

// ── 2. ΤΟ ΜΟΝΤΕΛΟ, ΔΥΟ ΦΟΡΕΣ: ΣΤΕΡΙΑΝΟ ΚΕΛΙ ΚΑΙ ΘΑΛΑΣΣΙΝΟ ΚΕΛΙ ───────────────
// past_days μετριέται ΑΠΟ ΣΗΜΕΡΑ, όχι από την αρχή του παραθύρου — αλλιώς ένα ιστορικό
// παράθυρο κατεβάζει τις τελευταίες N ημέρες και δεν ζευγαρώνει με τίποτα.
const pastDays = Math.min(92, Math.max(1, Math.ceil((Date.now() - startMs) / 86400000)));
const base = 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${STATIONS.map(s => s[2]).join(',')}`
  + `&longitude=${STATIONS.map(s => s[3]).join(',')}`
  + '&hourly=wind_speed_10m,wind_gusts_10m'
  + `&past_days=${pastDays}&forecast_days=1&timezone=UTC&wind_speed_unit=kmh`;
process.stderr.write('· ζητάω στεριανό κελί…\n');
const landRaw = await fetchJson(`${base}&cell_selection=land`);
process.stderr.write('· ζητάω θαλασσινό κελί…\n');
const seaRaw = await fetchJson(`${base}&cell_selection=sea`);
const land = Array.isArray(landRaw) ? landRaw : [landRaw];
const sea = Array.isArray(seaRaw) ? seaRaw : [seaRaw];

// ── 3. ΖΕΥΓΑΡΩΜΑ ──────────────────────────────────────────────────────────────
const rows = [];
STATIONS.forEach(([icao, name, lat, lon], i) => {
  const L = land[i], S = sea[i];
  if (!L?.hourly?.time || !S?.hourly?.time) return;
  const landDist = distKm(lat, lon, L.latitude, L.longitude);
  const seaDist = distKm(lat, lon, S.latitude, S.longitude);
  const sameCell = L.latitude === S.latitude && L.longitude === S.longitude;
  const idx = new Map(S.hourly.time.map((t, k) => [t, k]));
  for (let h = 0; h < L.hourly.time.length; h++) {
    const t = L.hourly.time[h].slice(0, 13);
    const ms = Date.parse(`${t}:00:00Z`);
    if (!(ms >= startMs && ms <= endMs)) continue;
    const obs = observed.get(`${icao}|${t}`);
    if (!obs) continue;
    const k = idx.get(L.hourly.time[h]);
    const lSpeed = L.hourly.wind_speed_10m[h], sSpeed = k == null ? null : S.hourly.wind_speed_10m[k];
    if (!Number.isFinite(lSpeed) || !Number.isFinite(sSpeed)) continue;
    rows.push({
      icao, name, landDist, seaDist, sameCell,
      landElev: L.elevation, seaElev: S.elevation,
      land: lSpeed, sea: sSpeed, obs: obs.kmh,
    });
  }
});
process.stderr.write(`· ${rows.length} ζευγάρια ώρας\n`);
if (rows.length < 200) { console.error('πολύ λίγα ζευγάρια'); process.exit(1); }

// ── 4. ΚΡΙΣΗ ──────────────────────────────────────────────────────────────────
const judge = set => {
  const n = set.length;
  if (!n) return { n: 0 };
  const err = (key) => set.reduce((s, r) => s + Math.abs(r[key] - r.obs), 0) / n;
  const bias = (key) => set.reduce((s, r) => s + (r[key] - r.obs), 0) / n;
  const exact = (key) => set.filter(r => bft(r[key]) === bft(r.obs)).length;
  const low = (key) => set.filter(r => bft(r[key]) < bft(r.obs)).length;
  const out = {
    n,
    landErr: round(err('land')), seaErr: round(err('sea')),
    landBias: round(bias('land')), seaBias: round(bias('sea')),
    landExactPct: pct(exact('land'), n), seaExactPct: pct(exact('sea'), n),
    landTooLowPct: pct(low('land'), n), seaTooLowPct: pct(low('sea'), n),
  };
  // Η πύλη γράφτηκε πριν τρέξει: ΚΑΙ μικρότερο σφάλμα ΚΑΙ περισσότερα σωστά Μποφόρ.
  out.seaWins = out.seaErr < out.landErr && out.seaExactPct > out.landExactPct;
  return out;
};

const bucketOf = r => (r.sameCell ? 'ίδιο κελί' : r.landDist < 3 ? '<3 χλμ' : r.landDist < 5 ? '3-5 χλμ' : r.landDist < 8 ? '5-8 χλμ' : '≥8 χλμ');
const groups = {};
for (const r of rows) (groups[bucketOf(r)] ||= []).push(r);

/** Το καθεστώς του παραπόνου: εκεί που ΤΟ ΣΤΕΡΙΑΝΟ κελί λέει «ήρεμα». */
const calmRows = rows.filter(r => bft(r.land) <= 2);
const calmGroups = {};
for (const r of calmRows) (calmGroups[bucketOf(r)] ||= []).push(r);

const report = {
  window: label,
  generatedAt: new Date().toISOString(),
  question: 'Κερδίζει η ΤΑΧΥΤΗΤΑ του θαλασσινού κελιού στο ίδιο υποσύνολο όπου κέρδισε η ΔΙΕΥΘΥΝΣΗ (§Γ29): μακρινό στεριανό κελί;',
  winRule: 'ΚΑΙ μικρότερο απόλυτο σφάλμα ΚΑΙ περισσότερα σωστά Μποφόρ — γραμμένο πριν τρέξει',
  pairedHours: rows.length,
  overall: judge(rows),
  byLandCellDistance: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, judge(v)])),
  whenLandSaysCalm: {
    hours: calmRows.length,
    overall: judge(calmRows),
    byLandCellDistance: Object.fromEntries(Object.entries(calmGroups).map(([k, v]) => [k, judge(v)])),
  },
  byStation: Object.fromEntries(STATIONS.map(([icao, name]) => {
    const set = rows.filter(r => r.icao === icao);
    if (!set.length) return [icao, null];
    return [icao, { name, landDistKm: round(set[0].landDist, 1), sameCell: set[0].sameCell, ...judge(set) }];
  }).filter(([, v]) => v)),
};

const outDir = path.join(root, 'reports', 'weather');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `sea-cell-speed-by-distance-${y1}-${String(m1).padStart(2,'0')}-${String(d1).padStart(2,'0')}_${y2}-${String(m2).padStart(2,'0')}-${String(d2).padStart(2,'0')}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

const line = (name, j) => `  ${name.padEnd(12)} n=${String(j.n).padEnd(6)} σφάλμα στεριά ${String(j.landErr).padEnd(6)} θάλασσα ${String(j.seaErr).padEnd(6)} · σωστό Μπφ ${String(j.landExactPct + '%').padEnd(7)} → ${String(j.seaExactPct + '%').padEnd(7)} ${j.seaWins ? '★ ΘΑΛΑΣΣΑ' : ''}`;
console.log(`\nΠΑΡΑΘΥΡΟ ${label} · ${rows.length} ζευγάρια\n`);
console.log('ΟΛΕΣ ΟΙ ΩΡΕΣ, ανά απόσταση στεριανού κελιού:');
for (const [k, j] of Object.entries(report.byLandCellDistance)) console.log(line(k, j));
console.log(`\nΜΟΝΟ ΟΠΟΥ ΤΟ ΣΤΕΡΙΑΝΟ ΚΕΛΙ ΛΕΕΙ ≤2 ΜΠΟΦΟΡ (${calmRows.length} ώρες):`);
for (const [k, j] of Object.entries(report.whenLandSaysCalm.byLandCellDistance)) console.log(line(k, j));
console.log(`\n→ ${path.relative(root, outPath)}\n`);
