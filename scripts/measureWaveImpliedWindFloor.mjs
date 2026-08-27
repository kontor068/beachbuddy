#!/usr/bin/env node
/**
 * ΜΠΟΡΕΙ ΤΟ ΚΥΜΑ ΝΑ ΔΙΟΡΘΩΣΕΙ ΤΟΝ ΑΝΕΜΟ; — μέτρηση, όχι κανόνας.
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ (27/08/2026, Αχαράβη Κέρκυρας #986, 15:00). Ο Μίλτος: «φυσάει πολύ κι έχει
 * αρκετό κύμα — εμείς λέμε λίγος αέρας, λίγο κύμα, κίτρινη». Η παραγωγή έδινε 13,8 χλμ/ώ
 * (3 Μπφ) από 290°, ενώ το ΙΔΙΟ μοντέλο έδινε ριπές 36-40 χλμ/ώ και το ewam ανεμοκύμα
 * 0,52 μ. / 4 s κατάμουτρα από 24 χλμ άνοιγμα — που με SMB θέλει ~5 Μπφ για να χτιστεί.
 * Δηλαδή το μοντέλο ΚΥΜΑΤΟΣ ήξερε περισσότερο άνεμο απ' όσο τύπωνε το μοντέλο ΑΝΕΜΟΥ.
 *
 * Η ΥΠΟΨΗΦΙΑ ΙΔΕΑ («δάπεδο ανέμου από το ανεμοκύμα»): όταν το κύμα φτάνει κατάμουτρα, είναι
 * ΚΟΝΤΟ (ανεμοκύμα, όχι φουσκοθαλασσιά) και το ύψος του, γυρισμένο ανάποδα μέσα από τον ΙΔΙΟ
 * τύπο SMB που χρησιμοποιεί η εφαρμογή (utils/waveModel.estimateFetchLimitedWaveHeightM) στο
 * άνοιγμα του τομέα, απαιτεί άνεμο ≥1 σκαλί πάνω από τον τυπωμένο — ο τυπωμένος ανεβαίνει.
 * Φυσική, όχι συντελεστής· μονόδρομη· χωρίς ελεύθερη παράμετρο: όλα τα κατώφλια είναι
 * σταθερές που η εφαρμογή ήδη χρησιμοποιεί για άλλους λόγους (ARRIVAL_ONSHORE_MIN,
 * ARRIVAL_MIN_FETCH_KM, GROUND_SWELL_MIN_PERIOD_S).
 *
 * ΓΙΑΤΙ ΔΕΝ ΜΠΑΙΝΕΙ ΧΩΡΙΣ ΑΥΤΟ ΕΔΩ. Ό,τι αλλάζει ΑΡΙΘΜΟ κρίνεται σε όργανο (§ΑΞ1): ο δάπεδος
 * ριπής στη στεριά έμοιαζε προφανής και ΕΧΑΣΕ από τη γραμμική αποσυμπίεση στις 24/08. Ίδιος
 * κριτής εδώ: ανεμόμετρα ελληνικών παράκτιων αεροδρομίων (METAR μέσω αρχείου ASOS Iowa State),
 * ίδια παράθυρα, ίδιες μετρικές με το auditWindAgainstStations. Ο κανόνας δεν έχει τίποτα
 * να βαθμονομήσει, οπότε δεν χρειάζεται μισά-σταθμών· αναφέρεται όμως ανά παράθυρο ΚΑΙ ανά
 * μισό σταθμών (μονοί/ζυγοί) για να φανεί αν στέκει ή αν είναι δύο νησιά που τον σηκώνουν.
 *
 * ΓΕΩΜΕΤΡΙΑ ΣΤΑΘΜΟΥ. Τα αεροδρόμια δεν έχουν προφίλ έκθεσης· δανείζονται το προφίλ της
 * ΠΛΗΣΙΕΣΤΕΡΗΣ παραλίας υψηλής βεβαιότητας (≤ STATION_BEACH_MAX_KM), για facing και άνοιγμα
 * ανά τομέα. Το κύμα ζητιέται στο marineSamplePoint εκείνης της παραλίας (ίδιο κελί που
 * ρωτάει και η εφαρμογή γι' αυτήν), αλλιώς στις συντεταγμένες του σταθμού με cell_selection=sea.
 *
 * ΤΙ ΚΡΙΝΕΙ ΤΗΝ ΑΠΟΦΑΣΗ (προ-δηλωμένο, πριν τρέξει): ο κανόνας μπαίνει ΜΟΝΟ αν, έναντι της
 * σημερινής παραγωγής, (α) το «χαμηλά στα ≥5 Μπφ» πέφτει, (β) η ψεύτικη ηρεμία δεν ανεβαίνει,
 * (γ) ο ψεύτικος συναγερμός δεν ανεβαίνει πάνω από +0,5 μονάδες, και (δ) το σωστό Μπφ δεν
 * πέφτει — σε ΚΑΘΕ παράθυρο και στα δύο μισά σταθμών. Ένα από τα τέσσερα να σπάσει, απορρίπτεται.
 *
 *   node scripts/measureWaveImpliedWindFloor.mjs [ημέρες_πίσω | YYYY-MM-DD:YYYY-MM-DD] [--key=…]
 * Κλειδί: --key, ή OPEN_METEO_API_KEY στο περιβάλλον, ή μέσω NETLIFY_AUTH_TOKEN (.env) όπως το
 * auditWindAgainstStations. ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/wave-implied-wind-floor-<ημ>.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { estimateFetchLimitedWaveHeightM, ARRIVAL_ONSHORE_MIN, ARRIVAL_MIN_FETCH_KM } = require(path.join(root, 'utils/waveModel.ts'));
const { GROUND_SWELL_MIN_PERIOD_S } = require(path.join(root, 'utils/swellExposure.ts'));

const KT_TO_KMH = 1.852;
/** Πιο μακριά από αυτό, η γεωμετρία της παραλίας δεν περιγράφει την ακτή του σταθμού. */
const STATION_BEACH_MAX_KM = 5;
/** Κάτω από αυτό το ύψος το κύμα δεν «ξέρει» τίποτα για τον άνεμο — θόρυβος μοντέλου. */
const MIN_INFORMATIVE_WAVE_M = 0.3;
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);

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

// ── ΟΡΙΣΜΑΤΑ ΚΑΙ ΚΛΕΙΔΙ ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const keyArg = (args.find(a => a.startsWith('--key=')) || '').slice(6);
const ARG = args.find(a => !a.startsWith('--')) || '92';
const WINDOW = /^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(ARG) ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Math.min(92, Number(ARG));

const readKey = async () => {
  if (keyArg) return keyArg;
  if (process.env.OPEN_METEO_API_KEY) return process.env.OPEN_METEO_API_KEY;
  try {
    const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    return ((await res.json()).values || []).map(v => v.value).find(Boolean) || null;
  } catch { return null; }
};
const API_KEY = await readKey();
if (!API_KEY) { console.error('Χωρίς πληρωμένο κλειδί (--key=…, OPEN_METEO_API_KEY, ή .env+.netlify). Το δωρεάν endpoint δεν φτάνει για 92 ημέρες × 30 σταθμούς.'); process.exit(1); }

const fetchJson = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 65000)); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 4000 * (i + 1))); }
  }
};

// ── 1. Η ΓΕΩΜΕΤΡΙΑ ΚΑΘΕ ΣΤΑΘΜΟΥ: Η ΠΛΗΣΙΕΣΤΕΡΗ ΠΑΡΑΛΙΑ ΥΨΗΛΗΣ ΒΕΒΑΙΟΤΗΤΑΣ ────
const km = (aLat, aLon, bLat, bLon) => Math.hypot((bLat - aLat) * 111.32, (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180));
const profiles = [];
for (const f of fs.readdirSync(path.join(root, 'public/data/geospatial/exposure')).filter(x => x.endsWith('.json'))) {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'public/data/geospatial/exposure', f), 'utf8'));
  for (const pr of Object.values(p.profiles || {})) {
    if (pr.confidence !== 'high' || typeof pr.facingDeg !== 'number' || !pr.coordinates) continue;
    profiles.push({ ...pr, region: f.replace(/\.json$/, '') });
  }
}
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = deg => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const stations = STATIONS.map(s => {
  const best = profiles.map(p => ({ p, d: km(s[2], s[3], p.coordinates.lat, p.coordinates.lon) })).sort((a, b) => a.d - b.d)[0];
  return { icao: s[0], name: s[1], lat: s[2], lon: s[3], beach: best && best.d <= STATION_BEACH_MAX_KM ? best.p : null, beachKm: best ? Math.round(best.d * 10) / 10 : null };
}).filter(s => s.beach);
console.log(`Σταθμοί με γεωμετρία παραλίας ≤${STATION_BEACH_MAX_KM} χλμ: ${stations.length}/${STATIONS.length}`);

// ── 2. ΜΕΤΡΗΣΕΙΣ (METAR, αρχείο ASOS) ────────────────────────────────────────
const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + stations.map(s => `station=${s.icao}`).join('&')
  + `&data=sknt&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(240000) });
if (!csvRes.ok) { console.error(`αρχείο μετρήσεων: HTTP ${csvRes.status}`); process.exit(1); }
const observed = new Map();
for (const line of (await csvRes.text()).split('\n').slice(1)) {
  const [icao, valid, sknt] = line.trim().split(',');
  if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
  const kt = Number(sknt); if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`); if (Number.isNaN(d.getTime())) continue;
  const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - rounded.getTime());
  const prev = observed.get(key);
  if (!prev || gap < prev.gap) observed.set(key, { gap, kmh: kt * KT_TO_KMH });
}
console.log(`Μετρήσεις: ${observed.size} ώρες-σταθμοί`);

// ── 3. ΜΟΝΤΕΛΑ: ΑΝΕΜΟΣ ΣΤΟΝ ΣΤΑΘΜΟ, ΚΥΜΑ ΣΤΟ ΣΗΜΕΙΟ ΤΗΣ ΠΑΡΑΛΙΑΣ ────────────
const span = WINDOW ? `&start_date=${WINDOW[0]}&end_date=${WINDOW[1]}` : `&past_days=${DAYS_BACK}&forecast_days=1`;
const windUrl = 'https://customer-api.open-meteo.com/v1/forecast'
  + `?latitude=${stations.map(s => s.lat).join(',')}&longitude=${stations.map(s => s.lon).join(',')}`
  + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC' + span
  + `&apikey=${encodeURIComponent(API_KEY)}`;
const wavePts = stations.map(s => s.beach.marineSamplePoint ? [s.beach.marineSamplePoint.lat, s.beach.marineSamplePoint.lon] : [s.lat, s.lon]);
const waveUrl = 'https://customer-marine-api.open-meteo.com/v1/marine'
  + `?latitude=${wavePts.map(p => p[0]).join(',')}&longitude=${wavePts.map(p => p[1]).join(',')}`
  + '&hourly=wave_height,wave_direction,wave_period&timezone=UTC&cell_selection=sea&models=ewam' + span
  + `&apikey=${encodeURIComponent(API_KEY)}`;
const [windData, waveData] = await Promise.all([fetchJson(windUrl), fetchJson(waveUrl)]);
const windEntries = Array.isArray(windData) ? windData : [windData];
const waveEntries = Array.isArray(waveData) ? waveData : [waveData];

// ── 4. Ο ΑΝΤΙΣΤΡΟΦΟΣ SMB: ΠΟΣΟΣ ΑΝΕΜΟΣ ΧΡΕΙΑΖΕΤΑΙ ΓΙΑ ΑΥΤΟ ΤΟ ΚΥΜΑ ΣΕ ΑΥΤΟ ΤΟ ΑΝΟΙΓΜΑ ──
// Διχοτόμηση πάνω στον ΙΔΙΟ τύπο που τυπώνει η εφαρμογή — καμία δεύτερη φυσική.
const windForWave = (hsM, fetchKm) => {
  let lo = 0, hi = 150;
  if (estimateFetchLimitedWaveHeightM({ windSpeedKmh: hi, fetchKm }) < hsM) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (estimateFetchLimitedWaveHeightM({ windSpeedKmh: mid, fetchKm }) < hsM) lo = mid; else hi = mid;
  }
  return hi;
};

// ── 5. ΟΙ ΓΡΑΜΜΕΣ ───────────────────────────────────────────────────────────
const rows = [];
stations.forEach((s, k) => {
  const w = windEntries[k]?.hourly, m = waveEntries[k]?.hourly;
  if (!w || !m) return;
  const facing = s.beach.facingDeg;
  const waveByTime = new Map(m.time.map((t, i) => [t, i]));
  w.time.forEach((t, i) => {
    const obs = observed.get(`${s.icao}|${t.slice(0, 13)}`);
    const raw = w.wind_speed_10m[i], gust = w.wind_gusts_10m[i];
    if (!obs || !Number.isFinite(raw)) return;
    // Η ΣΗΜΕΡΙΝΗ ΠΑΡΑΓΩΓΗ στη στεριά: γραμμική αποσυμπίεση στο υψόμετρο του σημείου.
    const production = applyGustFloor(raw, gust, windEntries[k].elevation ?? 1, 'kmh');
    const j = waveByTime.get(t);
    const hs = j != null ? m.wave_height[j] : null, from = j != null ? m.wave_direction[j] : null, period = j != null ? m.wave_period[j] : null;
    let implied = null, fires = false, reason = 'no-wave';
    if (Number.isFinite(hs) && Number.isFinite(from) && Number.isFinite(period)) {
      const onshore = Math.cos(((from - facing) * Math.PI) / 180);
      const fetchKm = s.beach.sectors?.[sectorOf(from)]?.fetchKm ?? 0;
      if (hs < MIN_INFORMATIVE_WAVE_M) reason = 'wave-too-small';
      else if (onshore < ARRIVAL_ONSHORE_MIN) reason = 'not-onshore';
      else if (fetchKm < ARRIVAL_MIN_FETCH_KM) reason = 'no-fetch';
      else if (period >= GROUND_SWELL_MIN_PERIOD_S) reason = 'swell-not-wind-sea';
      else {
        implied = windForWave(hs, fetchKm);
        fires = getBeaufortLevel(implied) >= getBeaufortLevel(production) + 1;
        reason = fires ? 'fires' : 'agrees';
      }
    }
    rows.push({
      station: s.icao, half: k % 2 === 0 ? 'A' : 'B', time: t, obs: obs.kmh, production,
      hs, period, implied, fires, reason,
      // Δύο υποψήφιοι: πλήρης (ό,τι λέει το κύμα) και συντηρητικός (+1 σκαλί το πολύ).
      full: fires ? Math.max(production, implied) : production,
      capped: fires ? Math.max(production, Math.min(implied, thresholdOfBeaufort(getBeaufortLevel(production) + 1))) : production,
    });
  });
});
function thresholdOfBeaufort(b) { // η ΧΑΜΗΛΟΤΕΡΗ ταχύτητα που τυπώνεται ως αυτό το Μπφ
  const edges = [0, 1.01, 5.01, 11.01, 19.01, 28.01, 38.01, 49.01, 61.01, 74.01, 88.01, 102.01, 117.01];
  return edges[Math.min(b, 12)];
}

// ── 6. ΜΕΤΡΙΚΕΣ ─────────────────────────────────────────────────────────────
const metrics = (rs, f) => {
  const n = rs.length || 1;
  const b = r => getBeaufortLevel(f(r)), o = r => getBeaufortLevel(r.obs);
  const obs5 = rs.filter(r => o(r) >= 5);
  return {
    hours: rs.length,
    maeKmh: Number((rs.reduce((s, r) => s + Math.abs(f(r) - r.obs), 0) / n).toFixed(2)),
    biasKmh: Number((rs.reduce((s, r) => s + (f(r) - r.obs), 0) / n).toFixed(2)),
    exactBftPct: pct(rs.filter(r => b(r) === o(r)).length, n),
    underPct: pct(rs.filter(r => b(r) <= o(r) - 1).length, n),
    overPct: pct(rs.filter(r => b(r) >= o(r) + 1).length, n),
    lowAt5PlusPct: pct(obs5.filter(r => b(r) < 5).length, obs5.length || 1),
    falseCalmPct: pct(rs.filter(r => o(r) >= 5 && b(r) <= 3).length, n),
    falseAlarmPct: pct(rs.filter(r => o(r) <= 3 && b(r) >= 5).length, n),
  };
};
const CANDIDATES = [['σήμερα (παραγωγή)', r => r.production], ['κύμα → άνεμος, πλήρης', r => r.full], ['κύμα → άνεμος, +1 σκαλί το πολύ', r => r.capped]];
const verdictFor = (rs) => {
  const base = metrics(rs, r => r.production);
  const out = {};
  for (const [label, f] of CANDIDATES.slice(1)) {
    const c = metrics(rs, f);
    out[label] = {
      ...c,
      passes: c.lowAt5PlusPct < base.lowAt5PlusPct && c.falseCalmPct <= base.falseCalmPct
        && c.falseAlarmPct <= base.falseAlarmPct + 0.5 && c.exactBftPct >= base.exactBftPct,
    };
  }
  return { base, candidates: out };
};

const fired = rows.filter(r => r.fires);
console.log(`\nΓραμμές με μέτρηση: ${rows.length.toLocaleString('el-GR')} · ο κανόνας ανάβει σε ${fired.length.toLocaleString('el-GR')} (${pct(fired.length, rows.length)}%)`);
const reasons = {}; for (const r of rows) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
console.log('  γιατί ΔΕΝ ανάβει:', Object.entries(reasons).map(([k, v]) => `${k} ${pct(v, rows.length)}%`).join(' · '));

const printTable = (title, rs) => {
  console.log(`\n=== ${title} (${rs.length.toLocaleString('el-GR')} ώρες) ===`);
  console.log('  υποψήφιος                         | σφάλμα | μερολ. | σωστό Μπφ | χαμηλά ≥1 | ψηλά ≥1 | χαμηλά @≥5 | ψευτ.ηρεμία | ψευτ.συναγ.');
  for (const [label, f] of CANDIDATES) {
    const c = metrics(rs, f);
    console.log(`  ${label.padEnd(33)} | ${String(c.maeKmh).padStart(6)} | ${(c.biasKmh >= 0 ? '+' : '') + c.biasKmh} | ${(c.exactBftPct + '%').padStart(9)} | ${(c.underPct + '%').padStart(9)} | ${(c.overPct + '%').padStart(7)} | ${(c.lowAt5PlusPct + '%').padStart(10)} | ${(c.falseCalmPct + '%').padStart(11)} | ${c.falseAlarmPct}%`);
  }
};
printTable('ΟΛΕΣ ΟΙ ΩΡΕΣ', rows);
printTable('ΜΟΝΟ ΟΙ ΩΡΕΣ ΠΟΥ ΑΝΑΒΕΙ Ο ΚΑΝΟΝΑΣ', fired);
printTable('ΜΙΣΟ Α (ζυγοί σταθμοί)', rows.filter(r => r.half === 'A'));
printTable('ΜΙΣΟ Β (μονοί σταθμοί)', rows.filter(r => r.half === 'B'));

const months = [...new Set(rows.map(r => r.time.slice(0, 7)))].sort();
for (const mo of months) printTable(`ΜΗΝΑΣ ${mo}`, rows.filter(r => r.time.startsWith(mo)));

const byStation = {};
for (const r of rows) { const s = byStation[r.station] = byStation[r.station] || { hours: 0, fires: 0 }; s.hours += 1; if (r.fires) s.fires += 1; }
console.log('\nΠΟΥ ΑΝΑΒΕΙ (ανά σταθμό):');
for (const [icao, v] of Object.entries(byStation).sort((a, b) => b[1].fires / b[1].hours - a[1].fires / a[1].hours).slice(0, 10)) {
  console.log(`  ${icao} ${stations.find(s => s.icao === icao)?.name.padEnd(15)} ${String(v.fires).padStart(5)} / ${String(v.hours).padStart(5)} (${pct(v.fires, v.hours)}%)`);
}

const overall = verdictFor(rows);
const halves = { A: verdictFor(rows.filter(r => r.half === 'A')), B: verdictFor(rows.filter(r => r.half === 'B')) };
const perMonth = Object.fromEntries(months.map(mo => [mo, verdictFor(rows.filter(r => r.time.startsWith(mo)))]));
console.log('\n=== ΕΤΥΜΗΓΟΡΙΑ (προ-δηλωμένα κριτήρια: χαμηλά@≥5 ↓, ψευτ.ηρεμία ≤, ψευτ.συναγ. ≤ +0,5, σωστό Μπφ ≥) ===');
for (const label of Object.keys(overall.candidates)) {
  const everywhere = overall.candidates[label].passes && halves.A.candidates[label].passes && halves.B.candidates[label].passes
    && months.every(mo => perMonth[mo].candidates[label].passes);
  console.log(`  ${label.padEnd(33)} → σύνολο ${overall.candidates[label].passes ? '✓' : '✗'} · μισό Α ${halves.A.candidates[label].passes ? '✓' : '✗'} · μισό Β ${halves.B.candidates[label].passes ? '✓' : '✗'} · μήνες ${months.map(mo => perMonth[mo].candidates[label].passes ? '✓' : '✗').join('')} → ${everywhere ? 'ΠΕΡΝΑΕΙ ΠΑΝΤΟΥ' : 'ΑΠΟΡΡΙΠΤΕΤΑΙ'}`);
}

const out = path.join(root, 'reports/weather', `wave-implied-wind-floor-${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  ranAt: new Date().toISOString(), window: WINDOW || `${DAYS_BACK} days`, stations: stations.map(s => ({ icao: s.icao, beachId: s.beach.beachId, beachKm: s.beachKm })),
  constants: { STATION_BEACH_MAX_KM, MIN_INFORMATIVE_WAVE_M, ARRIVAL_ONSHORE_MIN, ARRIVAL_MIN_FETCH_KM, GROUND_SWELL_MIN_PERIOD_S },
  rows: rows.length, fired: fired.length, reasons, overall, halves, perMonth, byStation,
}, null, 2));
console.log(`\nΓράφτηκε: ${path.relative(root, out)}`);
