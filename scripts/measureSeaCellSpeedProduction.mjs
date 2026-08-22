#!/usr/bin/env node
/**
 * ΤΟ §Γ51 ΞΑΝΑΚΡΙΝΕΤΑΙ ΜΕ ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ, ΟΧΙ ΜΕ ΤΟ ΩΜΟ.
 *
 * ΓΙΑΤΙ. Το §Γ51 σύγκρινε ΩΜΟ στεριανό κελί με ΩΜΟ θαλασσινό κελί απέναντι στα ανεμόμετρα και
 * βρήκε τη θάλασσα καλύτερη στα 3-5 χλμ. Αλλά η παραγωγή ΔΕΝ δείχνει τον ωμό αριθμό: περνάει
 * πρώτα από τον δάπεδο ριπής (`utils/windGustFloor`), που σε σημείο με στεριά ανεβάζει τον μέσο
 * στο 0,50×ριπή ΠΑΝΤΑ, ενώ σε σημείο στο 0 μόνο αν ο λόγος ριπής ≥3,5.
 *
 * Δηλαδή η αλλαγή πηγής ΔΕΝ αλλάζει μόνο το κελί — ΣΒΗΝΕΙ ΚΑΙ ΤΟΝ ΔΑΠΕΔΟ, γιατί το θαλασσινό
 * κελί απαντά με υψόμετρο 0. Αυτό το §Γ51 δεν το μέτρησε.
 *
 * ΕΙΝΑΙ ΑΚΡΙΒΩΣ ΤΟ ΛΑΘΟΣ ΠΟΥ Η ΒΙΒΛΟΣ ΕΧΕΙ ΗΔΗ ΚΑΤΑΓΡΑΨΕΙ ΜΙΑ ΦΟΡΑ (§Γ35 για το §Γ34):
 * «σωστό ως μέτρηση και ΛΑΘΟΣ ως συμπέρασμα για την παραγωγή, γιατί συνέκρινε τον ωμό μέσο με
 * το όργανο ενώ ο χρήστης δεν βλέπει ποτέ τον ωμό μέσο».
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΙ ΕΔΩ, και τα τέσσερα απέναντι στο ΙΔΙΟ METAR:
 *   ωμό-στεριά · ΠΑΡΑΓΩΓΗ-στεριά (με δάπεδο, υψόμετρο σημείου) · ωμό-θάλασσα ·
 *   ΠΑΡΑΓΩΓΗ-θάλασσα (με δάπεδο, υψόμετρο 0 → μόνο η πόρτα του λόγου ριπής)
 *
 * ΙΔΙΑ ΠΥΛΗ ΜΕ ΤΟ §Γ51, γραμμένη πριν τρέξει: η θάλασσα κερδίζει μόνο με ΚΑΙ μικρότερο σφάλμα
 * ΚΑΙ περισσότερα σωστά Μποφόρ, στο ΙΔΙΟ ζευγάρι (παραγωγή έναντι παραγωγής).
 *
 * ΔΕΝ αλλάζει τίποτα. → `reports/weather/sea-cell-production-<παράθυρο>.json`
 *
 *   node scripts/measureSeaCellSpeedProduction.mjs [ημέρες | YYYY-MM-DD:YYYY-MM-DD]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATIONS = [
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

const KT_TO_KMH = 1.852;
const GUST_FLOOR_FACTOR = 0.50;
const INCOHERENT_GUST_RATIO = 3.5;
/** Αντίγραφο του `utils/windGustFloor.applyGustFloor` — ίδιοι κανόνες, χωρίς transpile TS. */
const applyGustFloor = (speed, gust, elev) => {
  if (!Number.isFinite(speed) || !Number.isFinite(gust) || gust <= 0 || !Number.isFinite(elev)) return speed;
  if (elev <= 0 && !(speed > 0 && gust / speed >= INCOHERENT_GUST_RATIO)) return speed;
  return Math.max(speed, gust * GUST_FLOOR_FACTOR);
};
const bft = kmh => (kmh < 1 ? 0 : kmh <= 5 ? 1 : kmh <= 11 ? 2 : kmh <= 19 ? 3
  : kmh <= 28 ? 4 : kmh <= 38 ? 5 : kmh <= 49 ? 6 : 7);
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const round = (n, p = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
const distKm = (a, b, c, d) => Math.hypot((a - c) * 111.2, (b - d) * 111.2 * Math.cos((a + c) / 2 * Math.PI / 180));

const ARG = process.argv[2] || '21';
const WINDOW = ARG.includes(':') ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Number(ARG);
const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const label = WINDOW ? WINDOW.join('_') : `${DAYS_BACK}d`;

const fetchJson = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise(s => setTimeout(s, 3000 * (i + 1))); }
  }
};

process.stderr.write('· όργανα…\n');
const asos = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + STATIONS.map(s => `station=${s[0]}`).join('&')
  + `&data=sknt&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const csv = await (await fetch(asos, { signal: AbortSignal.timeout(180000) })).text();
const observed = new Map();
for (const line of csv.split('\n').slice(1)) {
  const [icao, valid, sknt] = line.trim().split(',');
  if (!icao || !valid || !sknt || sknt === 'M') continue;
  const kt = Number(sknt); if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`); if (Number.isNaN(d.getTime())) continue;
  const r = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${r.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - r.getTime());
  if (observed.get(key)?.gap <= gap) continue;
  observed.set(key, { gap, kmh: kt * KT_TO_KMH });
}

const pastDays = Math.min(92, Math.max(1, Math.ceil((Date.now() - startMs) / 86400000)));
const base = 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${STATIONS.map(s => s[1]).join(',')}&longitude=${STATIONS.map(s => s[2]).join(',')}`
  + `&hourly=wind_speed_10m,wind_gusts_10m&past_days=${pastDays}&forecast_days=1`
  + '&timezone=UTC&wind_speed_unit=kmh';
process.stderr.write('· στεριά…\n');
const landRaw = await fetchJson(`${base}&cell_selection=land`);
process.stderr.write('· θάλασσα…\n');
const seaRaw = await fetchJson(`${base}&cell_selection=sea`);
const land = Array.isArray(landRaw) ? landRaw : [landRaw];
const sea = Array.isArray(seaRaw) ? seaRaw : [seaRaw];

const rows = [];
STATIONS.forEach(([icao, lat, lon], i) => {
  const L = land[i], S = sea[i];
  if (!L?.hourly?.time || !S?.hourly?.time) return;
  const landDist = distKm(lat, lon, L.latitude, L.longitude);
  const idx = new Map(S.hourly.time.map((t, k) => [t, k]));
  for (let h = 0; h < L.hourly.time.length; h++) {
    const t = L.hourly.time[h].slice(0, 13);
    const ms = Date.parse(`${t}:00:00Z`);
    if (!(ms >= startMs && ms <= endMs)) continue;
    const obs = observed.get(`${icao}|${t}`); if (!obs) continue;
    const k = idx.get(L.hourly.time[h]); if (k == null) continue;
    const lS = L.hourly.wind_speed_10m[h], lG = L.hourly.wind_gusts_10m[h];
    const sS = S.hourly.wind_speed_10m[k], sG = S.hourly.wind_gusts_10m[k];
    if (![lS, lG, sS, sG].every(Number.isFinite)) continue;
    rows.push({
      icao, landDist, obs: obs.kmh,
      landRawV: lS, seaRawV: sS,
      // ΑΚΡΙΒΩΣ όπως η παραγωγή: στεριά με το υψόμετρο του σημείου, θάλασσα με 0.
      landProd: applyGustFloor(lS, lG, L.elevation),
      seaProd: applyGustFloor(sS, sG, S.elevation ?? 0),
    });
  }
});
process.stderr.write(`· ${rows.length} ζευγάρια\n`);
if (rows.length < 200) { console.error('πολύ λίγα'); process.exit(1); }

const judge = (set, a, b) => {
  const n = set.length;
  const err = k => set.reduce((s, r) => s + Math.abs(r[k] - r.obs), 0) / n;
  const bias = k => set.reduce((s, r) => s + (r[k] - r.obs), 0) / n;
  const ex = k => set.filter(r => bft(r[k]) === bft(r.obs)).length;
  const lo = k => set.filter(r => bft(r[k]) < bft(r.obs)).length;
  const o = {
    n,
    aErr: round(err(a)), bErr: round(err(b)),
    aBias: round(bias(a)), bBias: round(bias(b)),
    aExactPct: pct(ex(a), n), bExactPct: pct(ex(b), n),
    aTooLowPct: pct(lo(a), n), bTooLowPct: pct(lo(b), n),
  };
  o.bWins = o.bErr < o.aErr && o.bExactPct > o.aExactPct;
  return o;
};
const BUCKETS = [['<3 χλμ', d => d < 3], ['3-5 χλμ', d => d >= 3 && d < 5], ['≥5 χλμ', d => d >= 5]];
const groups = {};
for (const r of rows) {
  const key = BUCKETS.find(([, t]) => t(r.landDist))?.[0] ?? '?';
  (groups[key] ||= []).push(r);
}
const calm = rows.filter(r => bft(r.landProd) <= 2);
const calmGroups = {};
for (const r of calm) {
  const key = BUCKETS.find(([, t]) => t(r.landDist))?.[0] ?? '?';
  (calmGroups[key] ||= []).push(r);
}

const report = {
  window: label, generatedAt: new Date().toISOString(),
  question: 'Κερδίζει το θαλασσινό κελί ΣΤΗΝ ΠΑΡΑΓΩΓΗ, δηλαδή αφού και τα δύο περάσουν από τον δάπεδο ριπής;',
  pairedHours: rows.length,
  RAW_landVsSea: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, judge(v, 'landRawV', 'seaRawV')])),
  PRODUCTION_landVsSea: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, judge(v, 'landProd', 'seaProd')])),
  PRODUCTION_whenLandSaysCalm: Object.fromEntries(Object.entries(calmGroups).map(([k, v]) => [k, judge(v, 'landProd', 'seaProd')])),
};
const outDir = path.join(root, 'reports', 'weather');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `sea-cell-production-${label}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

const line = (k, j) => `  ${k.padEnd(9)} n=${String(j.n).padEnd(6)} σφάλμα ${String(j.aErr).padEnd(6)}→${String(j.bErr).padEnd(6)} · σωστό Μπφ ${String(j.aExactPct + '%').padEnd(7)}→${String(j.bExactPct + '%').padEnd(7)} · μεροληψία ${String(j.aBias).padEnd(6)}→${String(j.bBias).padEnd(6)} ${j.bWins ? '★ ΘΑΛΑΣΣΑ' : ''}`;
console.log(`\nΠΑΡΑΘΥΡΟ ${label} · ${rows.length} ζευγάρια\n`);
console.log('ΩΜΑ ΝΟΥΜΕΡΑ (αυτό μέτρησε το §Γ51):');
for (const [k, j] of Object.entries(report.RAW_landVsSea)) console.log(line(k, j));
console.log('\nΠΑΡΑΓΩΓΗ — και τα δύο μετά τον δάπεδο ριπής (αυτό βλέπει ο χρήστης):');
for (const [k, j] of Object.entries(report.PRODUCTION_landVsSea)) console.log(line(k, j));
console.log(`\nΠΑΡΑΓΩΓΗ, μόνο όπου η στεριά λέει ≤2 Μποφόρ (${calm.length} ώρες):`);
for (const [k, j] of Object.entries(report.PRODUCTION_whenLandSaysCalm)) console.log(line(k, j));
console.log(`\n→ ${path.relative(root, outPath)}\n`);
