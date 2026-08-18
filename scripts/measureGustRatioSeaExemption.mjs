#!/usr/bin/env node
/**
 * Ο ΑΚΡΑΙΟΣ ΛΟΓΟΣ ΡΙΠΗΣ ΣΠΑΕΙ ΤΗΝ ΕΞΑΙΡΕΣΗ ΤΟΥ ΘΑΛΑΣΣΙΝΟΥ ΚΕΛΙΟΥ — ΤΟ ΜΕΤΡΑΜΕ.
 *
 * ΑΦΟΡΜΗ. Τυρός 18/08/2026 17:00: μέσος 3,9 χλμ/ώ ΜΕ ριπή 22,3 (λόγος 5,7), κάρτα «1 Μπφ |
 * 0,03 μ.», ζωντανή κάμερα με αέρα και κύμα. Ο δάπεδος ριπής δεν έπιασε γιατί το `elevation`
 * της απάντησης ήταν 0.
 *
 * ΤΙ ΑΠΟΡΡΙΦΘΗΚΕ ΠΡΩΤΑ (`auditWindAgainstStations`, 3 παράθυρα). Η πρώτη υπόθεση ήταν ότι το
 * `elevation` διαβάζεται λάθος — είναι του ΣΗΜΕΙΟΥ, όχι του κελιού (αποδείχθηκε: ίδιο κελί,
 * 0 / 242 / 264 ανάλογα ποιο σημείο ρωτήθηκε). Η διόρθωση «ομαδοποίησε κατά κέντρο κελιού»
 * ΚΟΠΗΚΕ από τη μέτρηση: στις ώρες όπου οι δύο ορισμοί διαφωνούν ΥΠΕΡεκτιμούμε κατά +3,1 έως
 * +5,3 χλμ/ώ σε τρία παράθυρα. Η ομαδοποίηση κατά σημείο δίνει καθαρότερους κάδους (θάλασσα:
 * κλίση 1,104 έναντι 0,751). Η σημερινή πύλη είναι ΣΩΣΤΗ ως έχει.
 *
 * ΤΙ ΕΜΕΙΝΕ ΟΡΘΙΟ. Μέσα στις ώρες που η πύλη αφήνει ακάλυπτες (σημείο ≤0), ο λόγος ριπή/μέσος
 * χωρίζει δύο εντελώς διαφορετικά καθεστώτα — δύο παράθυρα, ίδια εικόνα:
 *
 *   λόγος <2,0    μεροληψία +3,33 / +2,26   κλίση 1,087 / 0,936   ← η εξαίρεση είναι ΣΩΣΤΗ
 *   λόγος ≥3,0    μεροληψία −2,79 / −4,26   κλίση 0,094 / 0,146   ← τυφλό μοντέλο
 *
 * Και δεν είναι artifact του μικρού παρονομαστή: με τον ΔΙΚΟ ΜΑΣ μέσο κρατημένο σταθερό, ο
 * υψηλός λόγος υποεκτιμά περισσότερο σε ΚΑΘΕ ζώνη (−4,41 / −0,53 / −1,20 / −1,43 χλμ/ώ).
 *
 * ΤΙ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Μαζεύει τα τέσσερα παράθυρα σε ένα δείγμα, σαρώνει κατώφλι λόγου ×
 * συντελεστή, και κρίνει ΕΚΤΟΣ ΔΕΙΓΜΑΤΟΣ (βαθμονόμηση σε 3 παράθυρα, εξέταση στο 4ο) — ο μόνος
 * τρόπος που έκοψε το «×1,20 πάνω από 4 Μποφόρ». Κριτήριο νίκης είναι το ΧΡΩΜΑ, όχι τα χλμ/ώ.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/gust-ratio-sea-exemption.json.
 *
 *   node scripts/measureGustRatioSeaExemption.mjs [--refresh]
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
const WINDOWS = [['2026-05-20', '2026-06-05'], ['2026-06-20', '2026-07-05'],
                 ['2026-07-10', '2026-07-25'], ['2026-08-04', '2026-08-18']];
const KT_TO_KMH = 1.852;
const CACHE = path.join(root, '.tmp/gust-ratio-sample.json');
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const sign = v => (v >= 0 ? '+' : '') + v.toFixed(1);

const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise(r => setTimeout(r, 3000 * (i + 1))); }
  }
};

const collect = async () => {
  const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
  const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
  const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  const API_KEY = ((await envRes.json()).values || []).map(v => v.value).find(Boolean);
  if (!API_KEY) throw new Error('χωρίς κλειδί Open-Meteo');

  const all = [];
  for (const [from, to] of WINDOWS) {
    const [y1, m1, d1] = from.split('-');
    const [y2, m2, d2] = to.split('-');
    const csv = await (await fetch('https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
      + STATIONS.map(s => `station=${s[0]}`).join('&')
      + `&data=sknt&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
      + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4',
      { signal: AbortSignal.timeout(180000) })).text();
    const observed = new Map();
    for (const line of csv.split('\n').slice(1)) {
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
      if (!prev || gap < prev.gap) observed.set(key, { gap, kmh: kt * KT_TO_KMH });
    }
    const md = await fetchJson('https://customer-api.open-meteo.com/v1/forecast'
      + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
      + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC'
      + `&start_date=${from}&end_date=${to}&apikey=${encodeURIComponent(API_KEY)}`);
    (Array.isArray(md) ? md : [md]).forEach((entry, k) => {
      const st = STATIONS[k];
      const h = entry.hourly;
      if (!st || !h) return;
      h.time.forEach((t, i) => {
        const obs = observed.get(`${st[0]}|${t.slice(0, 13)}`);
        const ours = h.wind_speed_10m?.[i];
        const gust = h.wind_gusts_10m?.[i];
        if (!obs || typeof ours !== 'number' || typeof gust !== 'number' || ours <= 0) return;
        all.push({ w: `${from}:${to}`, name: st[1], obs: obs.kmh, ours, gust,
          pointElevation: typeof entry.elevation === 'number' ? entry.elevation : null });
      });
    });
    console.log(`  ${from} → ${to}: ${all.length} συνολικά`);
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(all), 'utf8');
  return all;
};

const rows = fs.existsSync(CACHE) && !process.argv.includes('--refresh')
  ? JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  : await collect();
console.log(`δείγμα: ${rows.length} ώρες-σταθμοί · ${WINDOWS.length} παράθυρα`);

/**
 * Ο υποψήφιος κανόνας: στο ακάλυπτο μισό (σημείο ≤0), ο ακραίος λόγος ξαναφέρνει τον δάπεδο.
 * Το στεριανό μισό μένει ΑΚΡΙΒΩΣ όπως σήμερα, στο 0,50 — δεν επαναδιαπραγματευόμαστε απόφαση
 * που πάρθηκε με πίνακα μπροστά.
 */
const corrected = (r, threshold, factor) => {
  const overLand = r.pointElevation !== null && r.pointElevation > 0;
  if (overLand) return Math.max(r.ours, r.gust * 0.50);
  return r.gust / r.ours >= threshold ? Math.max(r.ours, r.gust * factor) : r.ours;
};
/** Η σημερινή συμπεριφορά, για δίκαιη σύγκριση στο ΙΔΙΟ δείγμα. */
const today = r => (r.pointElevation !== null && r.pointElevation > 0 ? Math.max(r.ours, r.gust * 0.50) : r.ours);

/** Το ΜΟΝΟ κριτήριο που βλέπει ο χρήστης: το χρώμα της πινέζας. */
const colourScore = (rs, f) => {
  let ok = 0;
  let falseCalm = 0;
  let falseAlarm = 0;
  let total = 0;
  for (const exposureLevel of ['protected', 'partial', 'exposed']) {
    const tone = kmh => resolveConditionTone({ exposureLevel, beaufort: getBeaufortLevel(kmh), isEnclosedCove: false, seaStateM: undefined });
    for (const r of rs) {
      const truth = tone(r.obs);
      const shown = tone(f(r));
      total++;
      if (shown === truth) ok++;
      if (shown === 'blue' && truth !== 'blue') falseCalm++;
      if (shown !== 'blue' && truth === 'blue') falseAlarm++;
    }
  }
  return { okPct: pct(ok, total), falseCalmPct: pct(falseCalm, total), falseAlarmPct: pct(falseAlarm, total) };
};

// ── ΣΑΡΩΣΗ, ΕΚΤΟΣ ΔΕΙΓΜΑΤΟΣ ────────────────────────────────────────────────────
// Κάθε συνδυασμός κρίνεται 4 φορές, μία ανά παράθυρο που ΔΕΝ συμμετείχε στην επιλογή του.
// Αναφέρεται το ΧΕΙΡΟΤΕΡΟ από τα 4: μια διόρθωση που στέκει μόνο σε κάποιες εποχές δεν στέκει.
console.log('\n=== ΣΑΡΩΣΗ — χειρότερο από 4 παράθυρα, μόνο στο ακάλυπτο μισό (σημείο ≤0) ===');
console.log('  κατώφλι | συντ. | ώρες που αγγίζει | σωστό χρώμα | ψεύτικη ηρεμία | ψεύτικος συναγερμός');
const results = [];
for (const threshold of [2.5, 3.0, 3.5]) {
  for (const factor of [0.30, 0.35, 0.40, 0.45, 0.50]) {
    const perWindow = WINDOWS.map(([a, b]) => {
      const test = rows.filter(r => r.w === `${a}:${b}`);
      const before = colourScore(test, today);
      const after = colourScore(test, r => corrected(r, threshold, factor));
      return { window: `${a}:${b}`, before, after,
        touched: test.filter(r => corrected(r, threshold, factor) !== today(r)).length };
    });
    const worstOk = Math.min(...perWindow.map(w => w.after.okPct - w.before.okPct));
    const worstCalm = Math.max(...perWindow.map(w => w.after.falseCalmPct - w.before.falseCalmPct));
    const worstAlarm = Math.max(...perWindow.map(w => w.after.falseAlarmPct - w.before.falseAlarmPct));
    const touched = perWindow.reduce((s, w) => s + w.touched, 0);
    results.push({ threshold, factor, touchedHours: touched, worstOkDelta: worstOk,
      worstFalseCalmDelta: worstCalm, worstFalseAlarmDelta: worstAlarm, perWindow });
    console.log(`  ${threshold.toFixed(1).padStart(7)} | ${factor.toFixed(2)} | ${String(touched).padStart(16)} | `
      + `${sign(worstOk).padStart(11)} | ${sign(worstCalm).padStart(14)} | ${sign(worstAlarm)}`);
  }
}
console.log('\n  «σωστό χρώμα» θέλουμε ≥0 · «ψεύτικη ηρεμία» θέλουμε ΑΡΝΗΤΙΚΟ (λιγότερη) · ο συναγερμός είναι το τίμημα.');

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'gust-ratio-sea-exemption.json');
fs.writeFileSync(`${out}.tmp`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  windows: WINDOWS.map(w => w.join(':')),
  sampleHours: rows.length,
  rule: 'σημείο ≤0 μ. ΚΑΙ ριπή/μέσος ≥ κατώφλι => max(μέσος, ριπή × συντελεστής)· το στεριανό μισό αμετάβλητο στο 0,50',
  sweep: results,
}, null, 2), 'utf8');
fs.renameSync(`${out}.tmp`, out);
console.log(`\nαναφορά: ${path.relative(root, out)}`);
