#!/usr/bin/env node
/**
 * ΠΟΙΟΣ ΕΧΕΙ ΔΙΚΙΟ — ΤΟ ΜΟΝΤΕΛΟ ΜΑΣ Ή ΤΑ ΑΛΛΑ; Κριτής: πραγματικό όργανο.
 *
 * Το scripts/auditWindModelConsensus.mjs μετράει το `best_match` έναντι της διαμέσου τεσσάρων
 * άλλων μοντέλων. Αυτό ΔΕΝ αποδεικνύει λάθος: τα άλλα τέσσερα είναι χονδρότερου πλέγματος
 * (ecmwf_ifs025 ~25 χλμ, gfs ~13, ukmo ~10, meteofrance ~10) έναντι ~7 χλμ του best_match, και σε
 * παράκτιο κελί ένα χονδρό πλέγμα «βλέπει» περισσότερη θάλασσα, άρα λιγότερη τριβή, άρα
 * συστηματικά ΠΕΡΙΣΣΟΤΕΡΟ άνεμο. Η διάμεσος μοντέλων δεν είναι αλήθεια, είναι άλλη εκτίμηση.
 *
 * Εδώ ο κριτής είναι ΜΕΤΡΗΣΗ: ανεμόμετρα ελληνικών αεροδρομίων (METAR, 10-λεπτος μέσος στα 10 μ.,
 * το ίδιο μέγεθος που δίνει το Open-Meteo). Τα περισσότερα κάθονται πάνω στην ακτή.
 *
 *   node scripts/auditWindAgainstStations.mjs [ημέρες_πίσω]
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/wind-vs-stations-<ημερομηνία>.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

/** Παράκτια ελληνικά αεροδρόμια με ανεμόμετρο που δημοσιεύει METAR. */
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

/**
 * Δέχεται είτε αριθμό ημερών πίσω, είτε ρητό παράθυρο «YYYY-MM-DD:YYYY-MM-DD».
 * Το ρητό παράθυρο υπάρχει για ΕΝΑ λόγο: μια διόρθωση βαθμονομημένη σε ένα παράθυρο πρέπει να
 * κριθεί σε ΑΛΛΟ. Το Open-Meteo κρατά ιστορικό 92 ημερών στο forecast endpoint.
 */
const ARG = process.argv[2] || '2';
const WINDOW = ARG.includes(':') ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Number(ARG);
/** Πολλαπλασιαστής που δοκιμάζεται· περνιέται 3ο όρισμα ώστε ένα παράθυρο να κρίνει τιμή άλλου. */
const BOOST = Number(process.argv[3] || 1.2);
const COMPARISON_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
const ALL_MODELS = ['best_match', ...COMPARISON_MODELS];
const KT_TO_KMH = 1.852;

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
};

const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
const API_KEY = ((await envRes.json()).values || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('χωρίς κλειδί'); process.exit(1); }

// ── 1. ΜΕΤΡΗΣΕΙΣ ──────────────────────────────────────────────────────────────
// ΟΧΙ το ζωντανό aviationweather.gov: αγνοεί το `hours` πάνω από ~24 και επιστρέφει πάντα μία
// ημέρα, δηλαδή δείγμα ενός καθεστώτος. Το αρχείο ASOS του Iowa State δίνει τα ΙΔΙΑ METAR για
// όσες ημέρες ζητηθούν, οπότε η μέτρηση καλύπτει και μελτέμι και άπνοια.
const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const label = `${WINDOW ? WINDOW.join(' → ') : DAYS_BACK + ' ημέρες'}`;
const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + STATIONS.map(s => `station=${s[0]}`).join('&')
  + `&data=sknt&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(180000) });
if (!csvRes.ok) { console.error(`αρχείο μετρήσεων: HTTP ${csvRes.status}`); process.exit(1); }
const csv = await csvRes.text();

/** κλειδί «ICAO|YYYY-MM-DDTHH» (UTC) -> {kmh, gustKmh} — μία παρατήρηση ανά ώρα, η κοντινότερη στην ακέραιη. */
const observed = new Map();
for (const line of csv.split('\n').slice(1)) {
  const [icao, valid, sknt, gust] = line.trim().split(',');
  if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
  const kt = Number(sknt);
  if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(d.getTime())) continue;
  const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - rounded.getTime());
  const prev = observed.get(key);
  if (!prev || gap < prev.gap) {
    const g = Number(gust);
    observed.set(key, { gap, kmh: kt * KT_TO_KMH, gustKmh: Number.isFinite(g) ? g * KT_TO_KMH : null });
  }
}
console.log(`μετρήσεις: ${observed.size} ώρες-σταθμοί από ${new Set([...observed.keys()].map(k => k.split('|')[0])).size} σταθμούς · ${label}`);

// ── 2. ΜΟΝΤΕΛΑ ΣΤΙΣ ΙΔΙΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ ───────────────────────────────────────
const url = 'https://customer-api.open-meteo.com/v1/forecast'
  + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
  + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC'
  + (WINDOW ? `&start_date=${WINDOW[0]}&end_date=${WINDOW[1]}` : `&past_days=${DAYS_BACK}&forecast_days=1`)
  + `&models=${ALL_MODELS.join(',')}&apikey=${encodeURIComponent(API_KEY)}`;
const modelData = await fetchJson(url);
const entries = Array.isArray(modelData) ? modelData : [modelData];

// Το DEM στο ΚΕΝΤΡΟ κάθε κελιού που απάντησε. Μία κλήση, καμία χρέωση στο κλειδί πρόγνωσης.
const cellCentreElevations = new Map();
{
  const centres = [...new Set(entries
    .filter(e => typeof e.latitude === 'number' && typeof e.longitude === 'number')
    .map(e => `${e.latitude}_${e.longitude}`))];
  if (centres.length) {
    const el = await fetchJson('https://api.open-meteo.com/v1/elevation'
      + `?latitude=${centres.map(c => c.split('_')[0]).join(',')}`
      + `&longitude=${centres.map(c => c.split('_')[1]).join(',')}`);
    centres.forEach((c, i) => cellCentreElevations.set(c, el.elevation?.[i] ?? null));
  }
}

const rows = [];
entries.forEach((entry, k) => {
  const st = STATIONS[k];
  const h = entry.hourly;
  if (!st || !h) return;
  h.time.forEach((t, idx) => {
    const obs = observed.get(`${st[0]}|${t.slice(0, 13)}`);
    if (!obs) return;
    const ours = h[`wind_speed_10m_best_match`]?.[idx];
    const others = COMPARISON_MODELS.map(m => h[`wind_speed_10m_${m}`]?.[idx]).filter(v => typeof v === 'number');
    if (typeof ours !== 'number' || others.length < 3) return;
    rows.push({
      station: st[0], name: st[1], time: t, obs: obs.kmh, obsGust: obs.gustKmh,
      // ΔΥΟ ΥΨΟΜΕΤΡΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ (μετρήθηκε 18/08/2026 απόγευμα).
      //
      // `entry.elevation` ΔΕΝ είναι του κελιού — είναι το DEM 90 μ. ΣΤΟ ΣΗΜΕΙΟ ΠΟΥ ΡΩΤΗΣΕΣ.
      // Απόδειξη: ίδιο κελί 37.3125_22.8125, ίδιος άνεμος 7,6 χλμ/ώ, τρεις κλήσεις — από την
      // πινέζα του Τυρού γυρίζει 0, από το κέντρο του κελιού 242, από άλλο σημείο μέσα στο
      // ίδιο κελί 264. Μια παραλία είναι εξ ορισμού στο 0, άρα η πύλη «κελί στη θάλασσα»
      // αυτοακυρώνεται σε κάθε παραλία με βουνό από πίσω.
      //
      // Το κέντρο του κελιού είναι το `entry.latitude/longitude` — αυτά ΕΙΝΑΙ του κελιού που
      // απάντησε. Το DEM εκεί (`cellCentreElevation`) είναι το υψόμετρο που εννοούσε η πύλη.
      pointElevation: typeof entry.elevation === 'number' ? entry.elevation : null,
      cellCentreElevation: cellCentreElevations.get(`${entry.latitude}_${entry.longitude}`) ?? null,
      ours, median: median(others),
      oursGust: h['wind_gusts_10m_best_match']?.[idx] ?? null,
      medianGust: (() => {
        const g = COMPARISON_MODELS.map(m => h[`wind_gusts_10m_${m}`]?.[idx]).filter(v => typeof v === 'number');
        return g.length >= 3 ? median(g) : null;
      })(),
    });
  });
});

// ── 3. ΠΟΙΟΣ ΠΕΦΤΕΙ ΠΙΟ ΚΟΝΤΑ ΣΤΟ ΟΡΓΑΝΟ ─────────────────────────────────────
const n = rows.length;
const mae = f => rows.reduce((s, r) => s + Math.abs(f(r) - r.obs), 0) / (n || 1);
const bias = f => rows.reduce((s, r) => s + (f(r) - r.obs), 0) / (n || 1);
const bftExact = f => pct(rows.filter(r => getBeaufortLevel(f(r)) === getBeaufortLevel(r.obs)).length, n);
const bftUnder = f => pct(rows.filter(r => getBeaufortLevel(f(r)) <= getBeaufortLevel(r.obs) - 1).length, n);
const bftOver = f => pct(rows.filter(r => getBeaufortLevel(f(r)) >= getBeaufortLevel(r.obs) + 1).length, n);

const ours = r => r.ours, med = r => r.median;
const oursCloser = rows.filter(r => Math.abs(r.ours - r.obs) < Math.abs(r.median - r.obs)).length;

console.log(`\n=== ΚΡΙΤΗΣ: ${n} ώρες-σταθμοί με πραγματική μέτρηση ===`);
console.log('                        | σφάλμα (χλμ/ώ) | μεροληψία | σωστό Μπφ | χαμηλά ≥1 | ψηλά ≥1');
console.log(`  best_match (δικό μας) | ${mae(ours).toFixed(2).padStart(14)} | ${(bias(ours) >= 0 ? '+' : '') + bias(ours).toFixed(2)} | ${(bftExact(ours) + '%').padStart(9)} | ${(bftUnder(ours) + '%').padStart(9)} | ${bftOver(ours)}%`);
console.log(`  διάμεσος 4 μοντέλων   | ${mae(med).toFixed(2).padStart(14)} | ${(bias(med) >= 0 ? '+' : '') + bias(med).toFixed(2)} | ${(bftExact(med) + '%').padStart(9)} | ${(bftUnder(med) + '%').padStart(9)} | ${bftOver(med)}%`);
console.log(`\n  το δικό μας πέφτει πιο κοντά στο όργανο σε ${pct(oursCloser, n)}% των ωρών`);

// Ξεχωριστά στα δυνατά — εκεί που κρίνεται η ασφάλεια.
const strong = rows.filter(r => getBeaufortLevel(r.obs) >= 4);
if (strong.length) {
  const sMaeO = strong.reduce((s, r) => s + Math.abs(r.ours - r.obs), 0) / strong.length;
  const sMaeM = strong.reduce((s, r) => s + Math.abs(r.median - r.obs), 0) / strong.length;
  const sUnderO = pct(strong.filter(r => getBeaufortLevel(r.ours) <= getBeaufortLevel(r.obs) - 1).length, strong.length);
  const sUnderM = pct(strong.filter(r => getBeaufortLevel(r.median) <= getBeaufortLevel(r.obs) - 1).length, strong.length);
  console.log(`\n  ΣΤΑ ≥4 ΜΠΟΦΟΡ (${strong.length} ώρες): σφάλμα δικό μας ${sMaeO.toFixed(2)} vs διάμεσος ${sMaeM.toFixed(2)} χλμ/ώ`);
  console.log(`                              χαμηλότερα ≥1 Μπφ: δικό μας ${sUnderO}% vs διάμεσος ${sUnderM}%`);
}

// ΑΝΑ ΜΕΤΡΗΜΕΝΗ ΕΝΤΑΣΗ — μια υποεκτίμηση στα 2 Μποφόρ δεν πειράζει κανέναν, στα 5 πειράζει.
console.log('\n=== ΑΝΑ ΜΕΤΡΗΜΕΝΟ ΜΠΟΦΟΡ (τι έδειξε το όργανο) ===');
console.log('  Μπφ | ώρες | δικό μας χαμηλά | δικό μας ψηλά | μεροληψία δική μας | μεροληψία διαμέσου');
for (const b of [...new Set(rows.map(r => getBeaufortLevel(r.obs)))].sort()) {
  const rs = rows.filter(r => getBeaufortLevel(r.obs) === b);
  const bo = rs.reduce((s, r) => s + (r.ours - r.obs), 0) / rs.length;
  const bm = rs.reduce((s, r) => s + (r.median - r.obs), 0) / rs.length;
  console.log(`  ${String(b).padStart(3)} | ${String(rs.length).padStart(4)} | `
    + `${(pct(rs.filter(r => getBeaufortLevel(r.ours) < b).length, rs.length) + '%').padStart(15)} | `
    + `${(pct(rs.filter(r => getBeaufortLevel(r.ours) > b).length, rs.length) + '%').padStart(13)} | `
    + `${((bo >= 0 ? '+' : '') + bo.toFixed(1)).padStart(18)} | ${(bm >= 0 ? '+' : '') + bm.toFixed(1)}`);
}

// Ριπές — αυτό που βλέπει η κάμερα.
const gustRows = rows.filter(r => typeof r.obsGust === 'number' && typeof r.oursGust === 'number');
if (gustRows.length) {
  const gO = gustRows.reduce((s, r) => s + Math.abs(r.oursGust - r.obsGust), 0) / gustRows.length;
  const gM = gustRows.reduce((s, r) => s + Math.abs((r.medianGust ?? r.oursGust) - r.obsGust), 0) / gustRows.length;
  const gBiasO = gustRows.reduce((s, r) => s + (r.oursGust - r.obsGust), 0) / gustRows.length;
  console.log(`\n  ΡΙΠΕΣ (${gustRows.length} ώρες με μετρημένη ριπή): σφάλμα δικό μας ${gO.toFixed(2)} vs διάμεσος ${gM.toFixed(2)} χλμ/ώ · μεροληψία ${gBiasO >= 0 ? '+' : ''}${gBiasO.toFixed(2)}`);
}

// ΣΥΜΠΙΕΣΗ Ή ΤΟΠΟΓΡΑΦΙΑ; Το κρίσιμο διαγνωστικό.
// Αν η αιτία ήταν «το αεροδρόμιο είναι πιο ανοιχτό από το κελί», η μεροληψία θα ήταν ΣΤΑΘΕΡΑ
// αρνητική σε κάθε ένταση. Αν η αιτία είναι ότι το μοντέλο ΣΤΡΩΝΕΙ τις κορυφές, η ευθεία
// «μοντέλο = a + b × μέτρηση» έχει κλίση b < 1: υπερεκτιμά την άπνοια, υποεκτιμά το μελτέμι.
const slope = f => {
  const mx = rows.reduce((s, r) => s + r.obs, 0) / n;
  const my = rows.reduce((s, r) => s + f(r), 0) / n;
  const cov = rows.reduce((s, r) => s + (r.obs - mx) * (f(r) - my), 0);
  const varx = rows.reduce((s, r) => s + (r.obs - mx) ** 2, 0);
  return { b: cov / varx, a: my - (cov / varx) * mx };
};
const sO = slope(ours), sM = slope(med);
console.log('\n=== ΣΤΡΩΝΕΙ ΤΙΣ ΚΟΡΥΦΕΣ; (κλίση 1,00 = τέλεια· <1 = συμπιέζει το εύρος) ===');
console.log(`  best_match      κλίση ${sO.b.toFixed(3)} · σταθερά ${sO.a >= 0 ? '+' : ''}${sO.a.toFixed(2)} χλμ/ώ`);
console.log(`  διάμεσος 4      κλίση ${sM.b.toFixed(3)} · σταθερά ${sM.a >= 0 ? '+' : ''}${sM.a.toFixed(2)} χλμ/ώ`);

// Το κατώφλι που όντως κόβει προτάσεις στο app.
const obs5 = rows.filter(r => getBeaufortLevel(r.obs) >= 5);
const obs6 = rows.filter(r => getBeaufortLevel(r.obs) >= 6);
console.log('\n=== ΤΑ ΚΑΤΩΦΛΙΑ ΠΟΥ ΚΡΙΝΟΥΝ ===');
console.log(`  μετρημένα ≥5 Μπφ: ${obs5.length} ώρες — εμείς δείχνουμε <5 σε ${pct(obs5.filter(r => getBeaufortLevel(r.ours) < 5).length, obs5.length)}%`);
console.log(`  μετρημένα ≥6 Μπφ: ${obs6.length} ώρες — εμείς δείχνουμε <5 σε ${pct(obs6.filter(r => getBeaufortLevel(r.ours) < 5).length, obs6.length)}%`);

// ── 4. ΤΙ ΘΑ ΔΙΟΡΘΩΝΕ — δοκιμή υποψήφιων διορθώσεων στα ΙΔΙΑ δεδομένα ─────────
// ⚠️ Η γραμμική διόρθωση βαθμονομείται ΠΑΝΩ στα ίδια δεδομένα που την κρίνουν, άρα κολακεύεται.
// Οι υπόλοιπες όχι — δεν κοιτούν τη μέτρηση καθόλου. Πριν σταλεί οτιδήποτε live θέλει
// επανάληψη σε ΑΛΛΟ παράθυρο ημερών.
const CANDIDATES = [
  ['όπως είναι σήμερα', r => r.ours],
  ['γραμμική (ours-a)/b', r => (r.ours - sO.a) / sO.b],
  ...[0.40, 0.45, 0.50, 0.55, 0.60, 0.65].map(k =>
    [`max(μέσος, ριπή×${k.toFixed(2)})`, r => Math.max(r.ours, (r.oursGust ?? 0) * k)]),
  [`×${BOOST.toFixed(2)} μόνο πάνω από 4 Μπφ`, r => (getBeaufortLevel(r.ours) >= 4 ? r.ours * BOOST : r.ours)],
];
console.log('\n=== ΥΠΟΨΗΦΙΕΣ ΔΙΟΡΘΩΣΕΙΣ (ίδιες 7.633 ώρες) ===');
console.log('  διόρθωση                   | σφάλμα | μεροληψία | σωστό Μπφ | χαμηλά ≥1 | ψηλά ≥1 | χάνει ≥5 Μπφ');
const candidateReport = [];
for (const [label, f] of CANDIDATES) {
  const row = {
    label,
    maeKmh: Number(mae(f).toFixed(2)), biasKmh: Number(bias(f).toFixed(2)),
    bftExactPct: bftExact(f), bftUnderPct: bftUnder(f), bftOverPct: bftOver(f),
    missed5Pct: pct(rows.filter(r => getBeaufortLevel(r.obs) >= 5 && getBeaufortLevel(f(r)) < 5).length,
      rows.filter(r => getBeaufortLevel(r.obs) >= 5).length),
  };
  candidateReport.push(row);
  console.log(`  ${label.padEnd(26)} | ${row.maeKmh.toFixed(2).padStart(6)} | ${((row.biasKmh >= 0 ? '+' : '') + row.biasKmh.toFixed(2)).padStart(9)} | `
    + `${(row.bftExactPct + '%').padStart(9)} | ${(row.bftUnderPct + '%').padStart(9)} | ${(row.bftOverPct + '%').padStart(7)} | ${row.missed5Pct}%`);
}

// ── ΤΟ ΤΕΛΙΚΟ ΤΕΣΤ: ΒΕΛΤΙΩΝΕΙ ΤΟ ΧΡΩΜΑ; ─────────────────────────────────────────
// Το km/h είναι ενδιάμεσο μέγεθος. Ο χρήστης βλέπει ΧΡΩΜΑ. Εδώ τρέχει ο ίδιος κώδικας χρώματος
// της εφαρμογής τρεις φορές — με τη ΜΕΤΡΗΣΗ (αλήθεια), με τον ωμό μέσο (σήμερα) και με τον
// δάπεδο ριπής — και μετράει ποιο συμφωνεί με την αλήθεια. Η γεωμετρία του σταθμού είναι
// άγνωστη, οπότε δοκιμάζονται και τα τρία επίπεδα έκθεσης: το εφέ του ανέμου απομονώνεται.
console.log('\n=== ΤΟ ΧΡΩΜΑ ΠΟΥ ΘΑ ΒΑΦΑΜΕ, ΕΝΑΝΤΙ ΤΗΣ ΜΕΤΡΗΣΗΣ ===');
console.log('  Το km/h είναι ενδιάμεσο· ο χρήστης βλέπει ΧΡΩΜΑ. Κριτής = ο ίδιος κώδικας της εφαρμογής,');
console.log('  αθροισμένος και στα τρία επίπεδα έκθεσης ώστε να απομονωθεί το εφέ του ανέμου.');
console.log('  συντελ. | σωστό χρώμα | ψεύτικη ηρεμία | ψεύτικος συναγερμός');
const toneRows = rows.filter(r => typeof r.oursGust === 'number');
const colourReport = [];
for (const k of [0, 0.45, 0.50, 0.55, 0.60]) {
  let ok = 0, falseCalm = 0, falseAlarm = 0, total = 0;
  for (const exposureLevel of ['protected', 'partial', 'exposed']) {
    const tone = kmh => resolveConditionTone({
      exposureLevel, beaufort: getBeaufortLevel(kmh), isEnclosedCove: false, seaStateM: undefined,
    });
    for (const r of toneRows) {
      const truth = tone(r.obs);
      // Ο δάπεδος ΜΟΝΟ σε κελί με στεριά — η ίδια πύλη που εφαρμόζει το utils/windGustFloor.
      const overLand = typeof r.cellCentreElevation === 'number' && r.cellCentreElevation > 0;
      const shown = tone(k === 0 || !overLand ? r.ours : Math.max(r.ours, r.oursGust * k));
      total++;
      if (shown === truth) ok++;
      if (shown === 'blue' && truth !== 'blue') falseCalm++;
      if (shown !== 'blue' && truth === 'blue') falseAlarm++;
    }
  }
  colourReport.push({ factor: k, okPct: pct(ok, total), falseCalmPct: pct(falseCalm, total), falseAlarmPct: pct(falseAlarm, total) });
  console.log(`  ${(k === 0 ? 'σήμερα' : k.toFixed(2)).padStart(7)} | ${(pct(ok, total) + '%').padStart(11)} | ${(pct(falseCalm, total) + '%').padStart(14)} | ${pct(falseAlarm, total)}%`);
}

// ── ΘΑΛΑΣΣΙΝΟ ΚΕΛΙ Ή ΣΤΕΡΙΑΝΟ; ΚΑΙ ΠΟΙΟ ΥΨΟΜΕΤΡΟ ΤΟ ΛΕΕΙ ──────────────────────
// Η αρχική έκδοση αυτού του πίνακα ομαδοποιούσε κατά `entry.elevation` πιστεύοντας ότι είναι
// του κελιού. Είναι του ΣΗΜΕΙΟΥ. Εδώ τρέχουν ΚΑΙ ΟΙ ΔΥΟ ομαδοποιήσεις πάνω στις ίδιες ώρες,
// ώστε η μέτρηση —όχι η υπόθεση— να πει ποια εξηγεί τη συμπίεση των κορυφών. Αν είναι το ΚΕΛΙ,
// η πύλη πρέπει να διαβάζει το κέντρο του κελιού· αν είναι το ΣΗΜΕΙΟ, ο σημερινός κώδικας
// είναι σωστός και το εύρημα του Τυρού είναι κάτι άλλο.
const bandsFor = key => [
  ['θάλασσα (0 μ.)', r => r[key] !== null && r[key] <= 0],
  ['ακτή (1-20 μ.)', r => r[key] !== null && r[key] > 0 && r[key] <= 20],
  ['στεριά (>20 μ.)', r => r[key] !== null && r[key] > 20],
];
const bandStats = rs => {
  const b = rs.reduce((s, r) => s + (r.ours - r.obs), 0) / rs.length;
  const mx = rs.reduce((s, r) => s + r.obs, 0) / rs.length;
  const my = rs.reduce((s, r) => s + r.ours, 0) / rs.length;
  const denom = rs.reduce((s, r) => s + (r.obs - mx) ** 2, 0);
  const slopeB = denom ? rs.reduce((s, r) => s + (r.obs - mx) * (r.ours - my), 0) / denom : NaN;
  const strong = rs.filter(r => getBeaufortLevel(r.obs) >= 4);
  const strongBias = strong.length ? strong.reduce((s, r) => s + (r.ours - r.obs), 0) / strong.length : null;
  return { biasKmh: b, slope: slopeB, strongHours: strong.length, strongBiasKmh: strongBias,
    underPct: pct(rs.filter(r => getBeaufortLevel(r.ours) <= getBeaufortLevel(r.obs) - 1).length, rs.length) };
};
const fmt = v => ((v >= 0 ? '+' : '') + v.toFixed(2));
const cellReport = {};
for (const [key, title] of [['pointElevation', 'ΤΟΥ ΣΗΜΕΙΟΥ που ρωτήθηκε (η σημερινή πύλη)'],
                            ['cellCentreElevation', 'ΤΟΥ ΚΕΝΤΡΟΥ ΤΟΥ ΚΕΛΙΟΥ (αυτό που εννοούσε)']]) {
  console.log(`\n=== ΑΝΑ ΥΨΟΜΕΤΡΟ ${title} ===`);
  console.log('  κελί            | ώρες | μεροληψία | κλίση | ≥4 Μπφ: μεροληψία | χαμηλά ≥1');
  cellReport[key] = [];
  for (const [bandLabel, test] of bandsFor(key)) {
    const rs = rows.filter(test);
    if (!rs.length) { console.log(`  ${bandLabel.padEnd(15)} | (κανένα δείγμα)`); continue; }
    const st = bandStats(rs);
    cellReport[key].push({ band: bandLabel, hours: rs.length, biasKmh: Number(st.biasKmh.toFixed(2)),
      slope: Number(st.slope.toFixed(3)), strongHours: st.strongHours,
      strongBiasKmh: st.strongBiasKmh === null ? null : Number(st.strongBiasKmh.toFixed(2)), underPct: st.underPct });
    console.log(`  ${bandLabel.padEnd(15)} | ${String(rs.length).padStart(4)} | ${fmt(st.biasKmh).padStart(9)} | `
      + `${st.slope.toFixed(3)} | ${(st.strongBiasKmh === null ? 'n/a' : fmt(st.strongBiasKmh) + ` (${st.strongHours}ω)`).padStart(17)} | ${st.underPct}%`);
  }
}

// Η ΩΡΑ ΤΗΣ ΚΡΙΣΗΣ: οι ώρες όπου οι δύο ομαδοποιήσεις ΔΙΑΦΩΝΟΥΝ — σημείο στο 0 (η σημερινή
// πύλη σβήνει τον δάπεδο) ενώ το κελί είναι στεριά (θα έπρεπε να τον ανάψει). Αυτή είναι η
// περίπτωση του Τυρού και η ΜΟΝΗ ώρα όπου η αλλαγή έχει νόημα.
const disputed = rows.filter(r => r.pointElevation !== null && r.pointElevation <= 0
  && r.cellCentreElevation !== null && r.cellCentreElevation > 20);
console.log(`\n=== ΑΜΦΙΣΒΗΤΟΥΜΕΝΕΣ ΩΡΕΣ (σημείο ≤0 μ. αλλά κελί >20 μ.) — ${disputed.length} ===`);
let disputedStats = null;
if (disputed.length >= 30) {
  const st = bandStats(disputed);
  disputedStats = { hours: disputed.length, biasKmh: Number(st.biasKmh.toFixed(2)), slope: Number(st.slope.toFixed(3)),
    strongHours: st.strongHours, strongBiasKmh: st.strongBiasKmh === null ? null : Number(st.strongBiasKmh.toFixed(2)),
    underPct: st.underPct, stations: [...new Set(disputed.map(r => r.name))] };
  console.log(`  μεροληψία ${fmt(st.biasKmh)} χλμ/ώ · κλίση ${st.slope.toFixed(3)} · στα ≥4 Μπφ `
    + `${st.strongBiasKmh === null ? 'n/a' : fmt(st.strongBiasKmh)} (${st.strongHours}ω) · χαμηλά ≥1 Μπφ ${st.underPct}%`);
  console.log(`  σταθμοί: ${disputedStats.stations.join(', ')}`);
  console.log('  ΚΡΙΣΗ: κλίση <0,9 ή μεροληψία <−1 => η συμπίεση ΥΠΑΡΧΕΙ εδώ => η πύλη πρέπει να διαβάζει το ΚΕΛΙ.');
} else {
  console.log('  λιγότερες από 30 — τα αεροδρόμια δεν καλύπτουν αυτή την περίπτωση· δες τη σημείωση στο windGustFloor.');
}

// ── Η ΕΣΩΤΕΡΙΚΗ ΑΣΥΝΕΠΕΙΑ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΑΠΑΝΤΗΣΗΣ ───────────────────────────────
// Ο Τυρός 18/08 17:00 έδωσε μέσο 3,9 χλμ/ώ ΜΕ ριπή 22,3 — λόγος 5,7. Σε πραγματικό άνεμο ο
// λόγος ριπής προς μέσο κάθεται στο 1,3-2,0· πάνω από 3 το μοντέλο λέει δύο ασύμβατα πράγματα
// για την ίδια ώρα. Αυτό ΔΕΝ χρειάζεται υψόμετρο, γεωγραφία ή υπόθεση: είναι μέσα στην ίδια
// απάντηση. Αν σε αυτές τις ώρες υποεκτιμούμε συστηματικά, εδώ είναι η μετρημένη πύλη.
console.log('\n=== ΑΝΑ ΛΟΓΟ ΡΙΠΗΣ / ΜΕΣΟΥ ΤΟΥ ΜΟΝΤΕΛΟΥ (εσωτερική ασυνέπεια) ===');
console.log('  λόγος     | ώρες | μεροληψία | κλίση | ≥4 Μπφ: μεροληψία | χαμηλά ≥1 | ριπή×0,50 θα έδινε');
const ratioRows = rows.filter(r => typeof r.oursGust === 'number' && r.oursGust > 0 && r.ours > 0);
const ratioBands = [
  ['<1,5', r => r.oursGust / r.ours < 1.5],
  ['1,5-2,0', r => r.oursGust / r.ours >= 1.5 && r.oursGust / r.ours < 2.0],
  ['2,0-3,0', r => r.oursGust / r.ours >= 2.0 && r.oursGust / r.ours < 3.0],
  ['3,0-4,0', r => r.oursGust / r.ours >= 3.0 && r.oursGust / r.ours < 4.0],
  ['≥4,0', r => r.oursGust / r.ours >= 4.0],
];
const ratioReport = [];
for (const [bandLabel, test] of ratioBands) {
  const rs = ratioRows.filter(test);
  if (!rs.length) { console.log(`  ${bandLabel.padEnd(9)} | (κανένα δείγμα)`); continue; }
  const st = bandStats(rs);
  // Τι θα έδινε ο δάπεδος ΕΔΩ, αν έμπαινε ΜΟΝΟ σε αυτή τη ζώνη — μεροληψία μετά τη διόρθωση.
  const afterBias = rs.reduce((s, r) => s + (Math.max(r.ours, r.oursGust * 0.5) - r.obs), 0) / rs.length;
  const afterUnder = pct(rs.filter(r => getBeaufortLevel(Math.max(r.ours, r.oursGust * 0.5)) <= getBeaufortLevel(r.obs) - 1).length, rs.length);
  const afterOver = pct(rs.filter(r => getBeaufortLevel(Math.max(r.ours, r.oursGust * 0.5)) >= getBeaufortLevel(r.obs) + 1).length, rs.length);
  ratioReport.push({ band: bandLabel, hours: rs.length, biasKmh: Number(st.biasKmh.toFixed(2)), slope: Number(st.slope.toFixed(3)),
    strongHours: st.strongHours, strongBiasKmh: st.strongBiasKmh === null ? null : Number(st.strongBiasKmh.toFixed(2)),
    underPct: st.underPct, afterFloorBiasKmh: Number(afterBias.toFixed(2)), afterFloorUnderPct: afterUnder, afterFloorOverPct: afterOver });
  console.log(`  ${bandLabel.padEnd(9)} | ${String(rs.length).padStart(4)} | ${fmt(st.biasKmh).padStart(9)} | `
    + `${st.slope.toFixed(3)} | ${(st.strongBiasKmh === null ? 'n/a' : fmt(st.strongBiasKmh) + ` (${st.strongHours}ω)`).padStart(17)} | `
    + `${String(st.underPct).padStart(9)} | μερ. ${fmt(afterBias)} χαμηλά ${afterUnder}% ψηλά ${afterOver}%`);
}

// ── ΕΛΕΓΧΟΣ: ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΛΗΡΟΦΟΡΙΑ, Ή ΑΠΛΩΣ «Ο ΜΕΣΟΣ ΜΑΣ ΕΙΝΑΙ ΜΙΚΡΟΣ»; ────
// Ο λόγος ριπή/μέσος μεγαλώνει αυτόματα όταν ο παρονομαστής μικραίνει, και σε χαμηλό δικό μας
// μέσο η υποεκτίμηση είναι σχεδόν εξ ορισμού (παλινδρόμηση προς τη μέση τιμή). Αν δεν το
// ξεχωρίσουμε, θα βαθμονομήσουμε πάνω σε artifact — ακριβώς το λάθος που έκανε το «×1,20 πάνω
// από 4 Μποφόρ» να κοπεί. Εδώ ο ΔΙΚΟΣ ΜΑΣ μέσος κρατιέται σταθερός και μέσα σε κάθε ζώνη
// συγκρίνονται χαμηλός έναντι υψηλού λόγου. Αν ο λόγος είναι πληροφορία, η διαφορά επιβιώνει.
console.log('\n=== ΕΛΕΓΧΟΣ ΣΥΓΧΥΣΗΣ: ίδιος δικός μας μέσος, χαμηλός vs υψηλός λόγος ===');
console.log('  δικός μας μέσος | λόγος<2: ώρες/μεροληψία | λόγος≥3: ώρες/μεροληψία | ΔΙΑΦΟΡΑ');
const meanBands = [[0, 5], [5, 10], [10, 15], [15, 20], [20, 30], [30, 100]];
const confoundReport = [];
for (const [lo, hi] of meanBands) {
  const inBand = ratioRows.filter(r => r.ours >= lo && r.ours < hi);
  const low = inBand.filter(r => r.oursGust / r.ours < 2);
  const high = inBand.filter(r => r.oursGust / r.ours >= 3);
  if (low.length < 25 || high.length < 25) {
    console.log(`  ${(lo + '-' + hi + ' χλμ/ώ').padEnd(15)} | δείγμα πολύ μικρό (${low.length} / ${high.length})`);
    continue;
  }
  const bl = low.reduce((s, r) => s + (r.ours - r.obs), 0) / low.length;
  const bh = high.reduce((s, r) => s + (r.ours - r.obs), 0) / high.length;
  confoundReport.push({ meanBand: `${lo}-${hi}`, lowRatioHours: low.length, lowRatioBias: Number(bl.toFixed(2)),
    highRatioHours: high.length, highRatioBias: Number(bh.toFixed(2)), deltaKmh: Number((bh - bl).toFixed(2)) });
  console.log(`  ${(lo + '-' + hi + ' χλμ/ώ').padEnd(15)} | ${String(low.length).padStart(5)} / ${fmt(bl).padStart(6)} `
    + `        | ${String(high.length).padStart(5)} / ${fmt(bh).padStart(6)}         | ${fmt(bh - bl)} χλμ/ώ`);
}
console.log('  Αν η ΔΙΑΦΟΡΑ είναι κοντά στο 0, ο λόγος δεν προσθέτει τίποτα — είναι ο μικρός μέσος που μιλάει.');

// ── ΣΑΡΩΣΗ ΣΥΝΤΕΛΕΣΤΗ ΜΟΝΟ ΣΤΙΣ ΑΣΥΝΕΠΕΙΣ ΩΡΕΣ ─────────────────────────────────
// Αν ο έλεγχος παραπάνω περάσει, ΠΟΣΟ πρέπει να είναι ο δάπεδος εκεί; Το 0,50 μετρήθηκε στο
// σύνολο· στις ακραίες ώρες φαίνεται να υπερδιορθώνει. Σαρώνεται εδώ, στο ίδιο υποσύνολο.
console.log('\n=== ΣΑΡΩΣΗ ΔΑΠΕΔΟΥ ΣΤΙΣ ΩΡΕΣ ΜΕ ΛΟΓΟ ≥3 ===');
console.log('  συντ. | μεροληψία | σωστό Μπφ | χαμηλά ≥1 | ψηλά ≥1');
const extreme = ratioRows.filter(r => r.oursGust / r.ours >= 3);
const sweepReport = [];
for (const k of [0, 0.30, 0.35, 0.40, 0.45, 0.50]) {
  const f = r => (k === 0 ? r.ours : Math.max(r.ours, r.oursGust * k));
  const b = extreme.reduce((s, r) => s + (f(r) - r.obs), 0) / extreme.length;
  const ex = pct(extreme.filter(r => getBeaufortLevel(f(r)) === getBeaufortLevel(r.obs)).length, extreme.length);
  const un = pct(extreme.filter(r => getBeaufortLevel(f(r)) <= getBeaufortLevel(r.obs) - 1).length, extreme.length);
  const ov = pct(extreme.filter(r => getBeaufortLevel(f(r)) >= getBeaufortLevel(r.obs) + 1).length, extreme.length);
  sweepReport.push({ factor: k, biasKmh: Number(b.toFixed(2)), exactPct: ex, underPct: un, overPct: ov });
  console.log(`  ${(k === 0 ? 'σήμερα' : k.toFixed(2)).padStart(6)} | ${fmt(b).padStart(9)} | ${(ex + '%').padStart(9)} | ${(un + '%').padStart(9)} | ${ov}%`);
}

// ── Η ΑΚΡΙΒΗΣ ΕΡΩΤΗΣΗ ΤΟΥ ΤΥΡΟΥ ────────────────────────────────────────────────
// Σήμερα ο δάπεδος σβήνει όταν το σημείο είναι στο 0. Ο Τυρός είναι στο 0 ΚΑΙ έχει λόγο 5,7.
// Άρα: μέσα στις ώρες που η ΣΗΜΕΡΙΝΗ πύλη αφήνει ακάλυπτες (σημείο ≤0), υποεκτιμούμε όταν ο
// λόγος είναι ακραίος; Αν ναι, η διόρθωση δεν είναι «άλλαξε το υψόμετρο» αλλά «ο ακραίος λόγος
// σπάει την εξαίρεση». Αν όχι, ο Τυρός δεν έχει μετρημένο στήριγμα και δεν αλλάζει τίποτα.
console.log('\n=== ΟΙ ΩΡΕΣ ΠΟΥ Η ΣΗΜΕΡΙΝΗ ΠΥΛΗ ΑΦΗΝΕΙ ΑΚΑΛΥΠΤΕΣ (σημείο ≤0 μ.) ===');
console.log('  λόγος   | ώρες | μεροληψία | κλίση | χαμηλά ≥1 | ψηλά ≥1');
const uncovered = ratioRows.filter(r => r.pointElevation !== null && r.pointElevation <= 0);
const uncoveredReport = [];
for (const [bandLabel, test] of [['<2,0', r => r.oursGust / r.ours < 2],
                                 ['2,0-3,0', r => r.oursGust / r.ours >= 2 && r.oursGust / r.ours < 3],
                                 ['≥3,0', r => r.oursGust / r.ours >= 3]]) {
  const rs = uncovered.filter(test);
  if (rs.length < 20) { console.log(`  ${bandLabel.padEnd(7)} | ${String(rs.length).padStart(4)} | δείγμα πολύ μικρό`); continue; }
  const st = bandStats(rs);
  const ov = pct(rs.filter(r => getBeaufortLevel(r.ours) >= getBeaufortLevel(r.obs) + 1).length, rs.length);
  uncoveredReport.push({ band: bandLabel, hours: rs.length, biasKmh: Number(st.biasKmh.toFixed(2)),
    slope: Number(st.slope.toFixed(3)), underPct: st.underPct, overPct: ov,
    stations: [...new Set(rs.map(r => r.name))] });
  console.log(`  ${bandLabel.padEnd(7)} | ${String(rs.length).padStart(4)} | ${fmt(st.biasKmh).padStart(9)} | ${st.slope.toFixed(3)} | `
    + `${(st.underPct + '%').padStart(9)} | ${ov}%   [${[...new Set(rs.map(r => r.name))].join(', ')}]`);
}

const byStation = [...new Set(rows.map(r => r.station))].map(id => {
  const rs = rows.filter(r => r.station === id);
  return {
    station: id, name: rs[0].name, hours: rs.length,
    maeOurs: Number((rs.reduce((s, r) => s + Math.abs(r.ours - r.obs), 0) / rs.length).toFixed(2)),
    biasOurs: Number((rs.reduce((s, r) => s + (r.ours - r.obs), 0) / rs.length).toFixed(2)),
    underPct: pct(rs.filter(r => getBeaufortLevel(r.ours) <= getBeaufortLevel(r.obs) - 1).length, rs.length),
  };
}).sort((a, b) => a.biasOurs - b.biasOurs);
console.log('\n=== ΟΙ 8 ΣΤΑΘΜΟΙ ΟΠΟΥ ΤΟ ΥΠΟΕΚΤΙΜΟΥΜΕ ΠΕΡΙΣΣΟΤΕΡΟ ===');
for (const s of byStation.slice(0, 8)) console.log(`  ${s.biasOurs >= 0 ? '+' : ''}${s.biasOurs} χλμ/ώ · ${s.name} (${s.hours} ώρες, λάθος Μπφ προς τα κάτω ${s.underPct}%)`);
console.log('=== ΚΑΙ ΟΙ 4 ΣΤΗΝ ΑΛΛΗ ΑΚΡΗ (εκεί δεν υποεκτιμούμε) ===');
for (const s of byStation.slice(-4)) console.log(`  ${s.biasOurs >= 0 ? '+' : ''}${s.biasOurs} χλμ/ώ · ${s.name} (${s.hours} ώρες, λάθος Μπφ προς τα κάτω ${s.underPct}%)`);

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `wind-vs-stations-${WINDOW ? WINDOW.join('_') : new Date().toISOString().slice(0, 10)}.json`);
const tmp = `${out}.tmp`;
fs.writeFileSync(tmp, JSON.stringify({
  generatedAt: new Date().toISOString(), window: label, boostTested: BOOST, stations: STATIONS.length, slots: n,
  bestMatch: { maeKmh: Number(mae(ours).toFixed(3)), biasKmh: Number(bias(ours).toFixed(3)), bftExactPct: bftExact(ours), bftUnderPct: bftUnder(ours), bftOverPct: bftOver(ours) },
  medianOfFour: { maeKmh: Number(mae(med).toFixed(3)), biasKmh: Number(bias(med).toFixed(3)), bftExactPct: bftExact(med), bftUnderPct: bftUnder(med), bftOverPct: bftOver(med) },
  oursCloserPct: pct(oursCloser, n),
  compression: { bestMatchSlope: Number(sO.b.toFixed(3)), bestMatchIntercept: Number(sO.a.toFixed(2)), medianSlope: Number(sM.b.toFixed(3)) },
  thresholds: { obs5Hours: obs5.length, missed5Pct: pct(obs5.filter(r => getBeaufortLevel(r.ours) < 5).length, obs5.length) },
  candidates: candidateReport,
  colour: colourReport,
  byElevationDefinition: cellReport,
  byGustRatio: ratioReport,
  ratioConfoundCheck: confoundReport,
  extremeRatioSweep: sweepReport,
  uncoveredByTodaysGate: uncoveredReport,
  disputedHours: disputedStats,
  byStation,
}, null, 2), 'utf8');
fs.renameSync(tmp, out);
console.log(`\nαναφορά: ${path.relative(root, out)}`);
