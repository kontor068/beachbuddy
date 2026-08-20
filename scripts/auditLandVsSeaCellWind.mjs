#!/usr/bin/env node
/**
 * ΣΤΕΡΙΑΝΟ Ή ΘΑΛΑΣΣΙΝΟ ΚΕΛΙ; ΚΡΙΤΗΣ: ΠΡΑΓΜΑΤΙΚΟ ΑΝΕΜΟΜΕΤΡΟ.
 *
 * Αφορμή: Αχαράβη Κέρκυρας 20/08/2026. Η εφαρμογή διαβάζει τον άνεμο από κελί 7,2 χλμ ΜΕΣΑ στο
 * νησί (cell_selection=land, η προεπιλογή του Open-Meteo). Εκείνο το κελί έλεγε Δυτικό 270°
 * / 9,7 χλμ/ώ. Το κελί πάνω από το νερό μπροστά της έλεγε Βορειοδυτικό 320° / 11,2. Στην
 * Αχαράβη ο Δυτικός πιάνει 10 χλμ θάλασσα (μερική έκθεση → μπλε πινέζα) ενώ ο Βορειοδυτικός
 * 24 χλμ κατευθείαν πάνω της (έκθεση → κίτρινη). Δηλαδή η επιλογή κελιού δεν αλλάζει απλώς
 * ένα νούμερο — ΓΥΡΙΖΕΙ ΤΟ ΧΡΩΜΑ.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Η ΣΥΓΚΡΙΣΗ ΜΟΝΤΕΛΟ-ΜΕ-ΜΟΝΤΕΛΟ: δύο κελιά που διαφωνούν δεν λένε ποιο έχει
 * δίκιο. Εδώ ο κριτής είναι μέτρηση — METAR ελληνικών αεροδρομίων (10-λεπτος μέσος στα 10 μ.,
 * ΚΑΙ διεύθυνση), το ίδιο μέγεθος που δίνει το Open-Meteo.
 *
 * ΤΟ ΟΡΙΟ ΤΟΥ ΔΕΙΓΜΑΤΟΣ, ΝΑ ΔΙΑΒΑΣΤΕΙ ΠΡΙΝ ΠΑΡΘΕΙ ΑΠΟΦΑΣΗ: τα αεροδρόμια κάθονται σε επίπεδο
 * παράκτιο έδαφος, άρα το στεριανό τους κελί είναι συνήθως ΚΟΝΤΑ. Η γεωμετρία της Αχαράβης
 * (κελί 7 χλμ μακριά, πίσω από λόφους) υπάρχει στο δείγμα μόνο σε όσους σταθμούς το στεριανό
 * κελί απαντά μακριά. Γι' αυτό ΟΛΑ τα νούμερα βγαίνουν και σπασμένα ανά απόσταση κελιού —
 * η ολική μέση τιμή δεν απαντά στην ερώτηση.
 *
 *   node scripts/auditLandVsSeaCellWind.mjs [ημέρες_πίσω | YYYY-MM-DD:YYYY-MM-DD]
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/land-vs-sea-cell-<ημερομηνία>.json.
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
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));

/** Ίδια λίστα με scripts/auditWindAgainstStations.mjs — παράκτια αεροδρόμια με METAR. */
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

const ARG = process.argv[2] || '14';
const WINDOW = ARG.includes(':') ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Number(ARG);
const KT_TO_KMH = 1.852;
/**
 * Κάτω από αυτό η μετρημένη διεύθυνση δεν σημαίνει τίποτα (το METAR δίνει 0° ή VRB στην άπνοια)
 * και ούτε το χρώμα κρίνεται εκεί — το app είναι μπλε ούτως ή άλλως.
 */
const DIR_MIN_KMH = 7.5;

const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);
/** Κυκλική διαφορά γωνιών σε μοίρες, πάντα 0-180. */
const dirDelta = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
};

/**
 * ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΟ ΕΔΩ — και γι' αυτό υπάρχει εφεδρεία.
 *
 * Το πληρωμένο endpoint δίνει ΤΑ ΙΔΙΑ δεδομένα με το δωρεάν· διαφέρει μόνο στο όριο κλήσεων.
 * Αυτή η μέτρηση κάνει ΔΥΟ κλήσεις συνολικά, άρα χωράει άνετα στο δωρεάν. Αν το Netlify token
 * λήξει (γυρίζει 401), η μέτρηση ΔΕΝ πρέπει να σταματήσει — μια πύλη που δεν τρέχει δεν
 * προστατεύει κανέναν.
 */
const readKey = async () => {
  try {
    const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    if (!token) return null;
    const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return ((await res.json()).values || []).map(v => v.value).find(Boolean) || null;
  } catch { return null; }
};
const API_KEY = await readKey();
const API_HOST = API_KEY ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
if (!API_KEY) console.log('⚠ χωρίς κλειδί (Netlify token ληγμένο;) — δωρεάν endpoint, ίδια δεδομένα');

// ── 1. ΜΕΤΡΗΣΕΙΣ (ταχύτητα ΚΑΙ διεύθυνση) ────────────────────────────────────
const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const label = WINDOW ? WINDOW.join(' → ') : `${DAYS_BACK} ημέρες`;
const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + STATIONS.map(s => `station=${s[0]}`).join('&')
  + `&data=sknt&data=drct&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(300000) });
if (!csvRes.ok) { console.error(`αρχείο μετρήσεων: HTTP ${csvRes.status}`); process.exit(1); }
const csv = await csvRes.text();

const observed = new Map();
for (const line of csv.split('\n').slice(1)) {
  const [icao, valid, sknt, drct, gust] = line.trim().split(',');
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
    const dg = Number(drct), g = Number(gust);
    observed.set(key, {
      gap,
      kmh: kt * KT_TO_KMH,
      dirDeg: Number.isFinite(dg) && dg > 0 && dg <= 360 ? dg % 360 : null,
      gustKmh: Number.isFinite(g) ? g * KT_TO_KMH : null,
    });
  }
}
console.log(`μετρήσεις: ${observed.size} ώρες-σταθμοί από ${new Set([...observed.keys()].map(k => k.split('|')[0])).size} σταθμούς · ${label}`);

// ── 2. ΤΟ ΙΔΙΟ ΜΟΝΤΕΛΟ, ΔΥΟ ΕΠΙΛΟΓΕΣ ΚΕΛΙΟΥ ──────────────────────────────────
const buildUrl = selection => `${API_HOST}/v1/forecast`
  + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
  + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC'
  + (WINDOW ? `&start_date=${WINDOW[0]}&end_date=${WINDOW[1]}` : `&past_days=${DAYS_BACK}&forecast_days=1`)
  + `&models=best_match&cell_selection=${selection}`
  + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : '');

const [landData, seaData] = await Promise.all([fetchJson(buildUrl('land')), fetchJson(buildUrl('sea'))]);
const landEntries = Array.isArray(landData) ? landData : [landData];
const seaEntries = Array.isArray(seaData) ? seaData : [seaData];

const rows = [];
STATIONS.forEach((st, k) => {
  const L = landEntries[k], S = seaEntries[k];
  if (!L?.hourly || !S?.hourly) return;
  const landDist = distKm(st[2], st[3], L.latitude, L.longitude);
  const seaDist = distKm(st[2], st[3], S.latitude, S.longitude);
  const sameCell = L.latitude === S.latitude && L.longitude === S.longitude;
  L.hourly.time.forEach((t, idx) => {
    const obs = observed.get(`${st[0]}|${t.slice(0, 13)}`);
    if (!obs) return;
    const jdx = S.hourly.time.indexOf(t);
    if (jdx < 0) return;
    const landKmh = L.hourly.wind_speed_10m?.[idx];
    const seaKmh = S.hourly.wind_speed_10m?.[jdx];
    if (typeof landKmh !== 'number' || typeof seaKmh !== 'number') return;
    rows.push({
      station: st[0], name: st[1], time: t, sameCell, landDist, seaDist,
      obs: obs.kmh, obsDir: obs.dirDeg, obsGust: obs.gustKmh,
      landKmh, seaKmh,
      landDir: L.hourly.wind_direction_10m?.[idx] ?? null,
      seaDir: S.hourly.wind_direction_10m?.[jdx] ?? null,
      landGust: L.hourly.wind_gusts_10m?.[idx] ?? null,
      seaGust: S.hourly.wind_gusts_10m?.[jdx] ?? null,
    });
  });
});

const n = rows.length;
if (!n) { console.error('καμία ώρα με μέτρηση ΚΑΙ μοντέλο'); process.exit(1); }

// ── 3. ΠΟΙΟ ΚΕΛΙ ΠΕΦΤΕΙ ΠΙΟ ΚΟΝΤΑ ΣΤΟ ΟΡΓΑΝΟ ─────────────────────────────────
const score = (rs, pick) => {
  const m = rs.length || 1;
  const mae = rs.reduce((s, r) => s + Math.abs(pick(r) - r.obs), 0) / m;
  const bias = rs.reduce((s, r) => s + (pick(r) - r.obs), 0) / m;
  const bftExact = pct(rs.filter(r => getBeaufortLevel(pick(r)) === getBeaufortLevel(r.obs)).length, m);
  const bftUnder = pct(rs.filter(r => getBeaufortLevel(pick(r)) <= getBeaufortLevel(r.obs) - 1).length, m);
  return { mae, bias, bftExact, bftUnder };
};
const land = r => r.landKmh, sea = r => r.seaKmh;

const line = (title, rs) => {
  const a = score(rs, land), b = score(rs, sea);
  const closerSea = rs.filter(r => Math.abs(r.seaKmh - r.obs) < Math.abs(r.landKmh - r.obs)).length;
  console.log(`  ${title.padEnd(26)} | ${String(rs.length).padStart(5)} | `
    + `${a.mae.toFixed(2).padStart(6)} ${b.mae.toFixed(2).padStart(6)} | `
    + `${((a.bias >= 0 ? '+' : '') + a.bias.toFixed(2)).padStart(6)} ${((b.bias >= 0 ? '+' : '') + b.bias.toFixed(2)).padStart(6)} | `
    + `${(a.bftExact + '%').padStart(6)} ${(b.bftExact + '%').padStart(6)} | ${pct(closerSea, rs.length)}%`);
};

console.log(`\n=== ΤΑΧΥΤΗΤΑ — ${n} ώρες-σταθμοί με πραγματική μέτρηση ===`);
console.log('                             |  ώρες | σφάλμα χλμ/ώ  |   μεροληψία   |  σωστό Μπφ    | θάλασσα πιο κοντά');
console.log('                             |       | στεριά θάλασ. | στεριά θάλασ. | στεριά θάλασ. |');
line('ΟΛΑ', rows);
const diffCell = rows.filter(r => !r.sameCell);
line('όπου διαφέρει το κελί', diffCell);
for (const [lo, hi, t] of [[0, 3, 'κελί στεριάς <3 χλμ'], [3, 6, 'κελί στεριάς 3-6 χλμ'], [6, 99, 'κελί στεριάς >6 χλμ']]) {
  const rs = diffCell.filter(r => r.landDist >= lo && r.landDist < hi);
  if (rs.length >= 20) line(t, rs);
}
const strong = rows.filter(r => getBeaufortLevel(r.obs) >= 4);
if (strong.length >= 20) line('μετρημένα ≥4 Μπφ', strong);

// ── 4. ΔΙΕΥΘΥΝΣΗ — ΑΥΤΗ ΓΥΡΙΖΕΙ ΤΟ ΧΡΩΜΑ ─────────────────────────────────────
// Το χρώμα δεν κρίνεται από τις μοίρες αλλά από τον 45άρη τομέα: η έκθεση της παραλίας είναι
// αποθηκευμένη ανά Ν/ΒΑ/Α/... Άρα το νούμερο που μετράει είναι «σωστός τομέας», όχι «μέσο
// σφάλμα μοιρών».
const dirRows = rows.filter(r => typeof r.obsDir === 'number' && r.obs >= DIR_MIN_KMH
  && typeof r.landDir === 'number' && typeof r.seaDir === 'number');
const dirLine = (title, rs) => {
  if (!rs.length) return;
  const mL = rs.reduce((s, r) => s + dirDelta(r.landDir, r.obsDir), 0) / rs.length;
  const mS = rs.reduce((s, r) => s + dirDelta(r.seaDir, r.obsDir), 0) / rs.length;
  const secL = pct(rs.filter(r => windSectorFromDegrees(r.landDir) === windSectorFromDegrees(r.obsDir)).length, rs.length);
  const secS = pct(rs.filter(r => windSectorFromDegrees(r.seaDir) === windSectorFromDegrees(r.obsDir)).length, rs.length);
  console.log(`  ${title.padEnd(26)} | ${String(rs.length).padStart(5)} | ${mL.toFixed(1).padStart(6)}° ${mS.toFixed(1).padStart(6)}° | ${(secL + '%').padStart(6)} ${(secS + '%').padStart(6)}`);
};
console.log(`\n=== ΔΙΕΥΘΥΝΣΗ (μόνο ≥${DIR_MIN_KMH} χλμ/ώ μετρημένα — αλλιώς η μέτρηση δεν σημαίνει τίποτα) ===`);
console.log('                             |  ώρες | μέσο σφάλμα   | σωστός τομέας 45°');
console.log('                             |       | στεριά θάλασ. | στεριά θάλασ.');
dirLine('ΟΛΑ', dirRows);
const dirDiff = dirRows.filter(r => !r.sameCell);
dirLine('όπου διαφέρει το κελί', dirDiff);
for (const [lo, hi, t] of [[0, 3, 'κελί στεριάς <3 χλμ'], [3, 6, 'κελί στεριάς 3-6 χλμ'], [6, 99, 'κελί στεριάς >6 χλμ']]) {
  const rs = dirDiff.filter(r => r.landDist >= lo && r.landDist < hi);
  if (rs.length >= 20) dirLine(t, rs);
}

// ── 5. Η ΩΡΑ ΤΗΣ ΑΧΑΡΑΒΗΣ: τα δύο κελιά δίνουν ΑΛΛΟ ΤΟΜΕΑ. Ποιο έχει δίκιο; ──
const clash = dirRows.filter(r => windSectorFromDegrees(r.landDir) !== windSectorFromDegrees(r.seaDir));
console.log(`\n=== ΟΤΑΝ ΤΑ ΔΥΟ ΚΕΛΙΑ ΔΕΙΧΝΟΥΝ ΑΛΛΟ ΤΟΜΕΑ (${clash.length} ώρες, ${pct(clash.length, dirRows.length)}% των ωρών με άνεμο) ===`);
if (clash.length) {
  const wL = clash.filter(r => windSectorFromDegrees(r.landDir) === windSectorFromDegrees(r.obsDir)).length;
  const wS = clash.filter(r => windSectorFromDegrees(r.seaDir) === windSectorFromDegrees(r.obsDir)).length;
  console.log(`  δίκιο η ΣΤΕΡΙΑ: ${wL} (${pct(wL, clash.length)}%) · δίκιο η ΘΑΛΑΣΣΑ: ${wS} (${pct(wS, clash.length)}%) · κανένα: ${clash.length - wL - wS}`);
  const far = clash.filter(r => r.landDist >= 6);
  if (far.length >= 10) {
    const fL = far.filter(r => windSectorFromDegrees(r.landDir) === windSectorFromDegrees(r.obsDir)).length;
    const fS = far.filter(r => windSectorFromDegrees(r.seaDir) === windSectorFromDegrees(r.obsDir)).length;
    console.log(`  μόνο όπου το στεριανό κελί είναι >6 χλμ μακριά (${far.length} ώρες): στεριά ${pct(fL, far.length)}% · θάλασσα ${pct(fS, far.length)}%`);
  }
}

// ── 6. ΑΝΑ ΣΤΑΘΜΟ — για να φανεί αν το εύρημα είναι γεωγραφία ή θόρυβος ───────
console.log('\n=== ΑΝΑ ΣΤΑΘΜΟ (μόνο όπου τα κελιά διαφέρουν) ===');
console.log('  σταθμός        | απόστ. κελιού | ώρες | σφάλμα ταχ. στεριά/θάλ. | σωστός τομέας στεριά/θάλ.');
const perStation = [];
for (const [icao, nm] of STATIONS.map(s => [s[0], s[1]])) {
  const rs = diffCell.filter(r => r.station === icao);
  if (rs.length < 20) continue;
  const a = score(rs, land), b = score(rs, sea);
  const ds = dirDiff.filter(r => r.station === icao);
  const secL = ds.length ? pct(ds.filter(r => windSectorFromDegrees(r.landDir) === windSectorFromDegrees(r.obsDir)).length, ds.length) : null;
  const secS = ds.length ? pct(ds.filter(r => windSectorFromDegrees(r.seaDir) === windSectorFromDegrees(r.obsDir)).length, ds.length) : null;
  perStation.push({ icao, name: nm, landDistKm: rs[0].landDist, hours: rs.length, landMae: a.mae, seaMae: b.mae, landSectorPct: secL, seaSectorPct: secS });
  console.log(`  ${nm.padEnd(14)} | ${rs[0].landDist.toFixed(1).padStart(9)} χλμ | ${String(rs.length).padStart(4)} | `
    + `${a.mae.toFixed(2).padStart(11)} / ${b.mae.toFixed(2).padStart(5)} | `
    + `${(secL === null ? '—' : secL + '%').padStart(17)} / ${secS === null ? '—' : secS + '%'}`);
}

// ── 7. ΑΡΧΕΙΟ ────────────────────────────────────────────────────────────────
const OUT_DIR = path.join(root, 'reports/weather');
fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date(endMs).toISOString().slice(0, 10);
const out = path.join(OUT_DIR, `land-vs-sea-cell-${stamp}.json`);
const tmp = `${out}.tmp`;
fs.writeFileSync(tmp, JSON.stringify({
  generatedAt: new Date(endMs).toISOString(),
  window: label,
  question: 'Το app διαβάζει cell_selection=land. Είναι πιο κοντά στο όργανο από το θαλασσινό κελί;',
  hours: n,
  dirHours: dirRows.length,
  dirMinKmh: DIR_MIN_KMH,
  overall: { land: score(rows, land), sea: score(rows, sea) },
  whereCellsDiffer: { hours: diffCell.length, land: score(diffCell, land), sea: score(diffCell, sea) },
  sectorClash: clash.length ? {
    hours: clash.length,
    landRightPct: pct(clash.filter(r => windSectorFromDegrees(r.landDir) === windSectorFromDegrees(r.obsDir)).length, clash.length),
    seaRightPct: pct(clash.filter(r => windSectorFromDegrees(r.seaDir) === windSectorFromDegrees(r.obsDir)).length, clash.length),
  } : null,
  perStation,
}, null, 2), 'utf8');
fs.renameSync(tmp, out);
console.log(`\nΓράφτηκε ${path.relative(root, out)}`);
