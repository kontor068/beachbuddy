#!/usr/bin/env node
/**
 * ΠΟΣΟ ΣΥΧΝΑ ΤΟ ΜΟΝΤΕΛΟ ΜΑΣ ΚΑΘΕΤΑΙ ΚΑΤΩ ΑΠΟ ΤΑ ΥΠΟΛΟΙΠΑ — εθνική μέτρηση, όχι πύλη.
 *
 * Αφορμή: Σταλίδα (#645), 18/08/2026 11:00. Δείχναμε 4,1 χλμ/ώ (1 Μποφόρ) ενώ ECMWF/GFS/UKMO/
 * MeteoFrance έδιναν 6,6-14,0 (2-3 Μποφόρ) και ριπές 18-32 έναντι 9,7 δικών μας. Η κάμερα
 * επιβεβαίωσε τον άνεμο. Το σημείο και η γεωμετρία ήταν σωστά — το `best_match` ήταν το
 * χαμηλότερο από πέντε μοντέλα εκείνη την ώρα.
 *
 * Η ερώτηση που απαντά αυτό το script: είναι μεμονωμένο περιστατικό ή συστηματικό;
 *
 *   node scripts/auditWindModelConsensus.mjs [σημεία_ανά_περιοχή] [ημέρες]
 *
 * Συγκρίνει το `best_match` (αυτό που σερβίρουμε) με τη ΔΙΑΜΕΣΟ τεσσάρων ανεξάρτητων μοντέλων,
 * στα ΠΡΑΓΜΑΤΙΚΑ σημεία ανέμου του app (buildBeachForecastClusters, ό,τι τρέχει live).
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/wind-model-consensus-<ημερομηνία>.json.
 * Το πληρωμένο κλειδί έρχεται από το Netlify και ΔΕΝ γράφεται πουθενά.
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

const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const PER_REGION = Number(process.argv[2] || 3);
const DAYS = Number(process.argv[3] || 2);
const COMPARISON_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'meteofrance_seamless'];
const ALL_MODELS = ['best_match', ...COMPARISON_MODELS];
const BATCH = 20;
const SWIM_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);

// ── κλειδί ────────────────────────────────────────────────────────────────────
const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
const API_KEY = ((await envRes.json()).values || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('χωρίς κλειδί'); process.exit(1); }

// ── τα ΠΡΑΓΜΑΤΙΚΑ σημεία ανέμου του app, δειγματοληπτημένα ανά περιοχή ─────────
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const points = [];
for (const file of fs.readdirSync(summaryDir).filter(f => f.endsWith('.json'))) {
  const beaches = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island?.beaches;
  if (!Array.isArray(beaches) || beaches.length === 0) continue;
  const clusters = buildBeachForecastClusters(beaches);
  if (clusters.length === 0) continue;
  // Ομοιόμορφο δείγμα μέσα στην περιοχή (κάθε ν-οστό), όχι τα πρώτα Ν — το
  // reports/region-forecast-point-audit.md καταγράφει τι κόστισε το «πρώτα Ν».
  const region = file.replace('.json', '');
  const step = Math.max(1, Math.floor(clusters.length / PER_REGION));
  let taken = 0;
  for (let i = 0; i < clusters.length && taken < PER_REGION; i += step) {
    points.push({ region, lat: clusters[i].lat, lon: clusters[i].lon, beaches: clusters[i].beachIds.length });
    taken++;
  }
}
console.log(`σημεία: ${points.length} από ${new Set(points.map(p => p.region)).size} περιοχές · ${DAYS} ημέρες · ${ALL_MODELS.length} μοντέλα`);

// ── λήψη ──────────────────────────────────────────────────────────────────────
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

const rows = [];
for (let i = 0; i < points.length; i += BATCH) {
  const slice = points.slice(i, i + BATCH);
  const url = 'https://customer-api.open-meteo.com/v1/forecast'
    + `?latitude=${slice.map(p => p.lat).join(',')}&longitude=${slice.map(p => p.lon).join(',')}`
    + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens'
    + `&forecast_days=${DAYS}&models=${ALL_MODELS.join(',')}&apikey=${encodeURIComponent(API_KEY)}`;
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : [data];
  list.forEach((entry, k) => {
    const h = entry.hourly;
    if (!h || !slice[k]) return;
    h.time.forEach((t, idx) => {
      if (!SWIM_HOURS.includes(Number(t.slice(11, 13)))) return;
      const speeds = {}, gusts = {};
      for (const m of ALL_MODELS) {
        speeds[m] = h[`wind_speed_10m_${m}`]?.[idx];
        gusts[m] = h[`wind_gusts_10m_${m}`]?.[idx];
      }
      if (typeof speeds.best_match !== 'number') return;
      const others = COMPARISON_MODELS.map(m => speeds[m]).filter(v => typeof v === 'number');
      if (others.length < 3) return;
      const othersG = COMPARISON_MODELS.map(m => gusts[m]).filter(v => typeof v === 'number');
      rows.push({
        region: slice[k].region, time: t,
        ours: speeds.best_match, median: median(others),
        oursG: gusts.best_match, medianG: othersG.length >= 3 ? median(othersG) : null,
      });
    });
  });
  process.stdout.write(`\r  ${Math.min(i + BATCH, points.length)}/${points.length}`);
}
console.log('');

// ── ανάλυση ───────────────────────────────────────────────────────────────────
const total = rows.length;
let under = 0, over = 0, under2 = 0, over2 = 0;
const byRegime = {};                 // καθεστώς = Μποφόρ της διαμέσου
const byRegion = new Map();
let falseCalm = 0;                   // εμείς ≤2 Μπφ ενώ η διάμεσος ≥4
let gate5 = 0, gate5Total = 0;       // εμείς <5 ενώ η διάμεσος ≥5 (κατώφλι που κόβει προτάσεις)
let gate4 = 0, gate4Total = 0;
let gustUnder = 0, gustRows = 0;

for (const r of rows) {
  const bo = getBeaufortLevel(r.ours), bm = getBeaufortLevel(r.median);
  const d = bo - bm;
  if (d <= -1) under++;
  if (d >= 1) over++;
  if (d <= -2) under2++;
  if (d >= 2) over2++;
  const key = bm >= 6 ? '6+' : String(bm);
  (byRegime[key] ||= { slots: 0, under: 0, over: 0, under2: 0 });
  byRegime[key].slots++;
  if (d <= -1) byRegime[key].under++;
  if (d >= 1) byRegime[key].over++;
  if (d <= -2) byRegime[key].under2++;
  if (bo <= 2 && bm >= 4) falseCalm++;
  if (bm >= 5) { gate5Total++; if (bo < 5) gate5++; }
  if (bm >= 4) { gate4Total++; if (bo < 4) gate4++; }
  if (typeof r.medianG === 'number' && typeof r.oursG === 'number') {
    gustRows++;
    if (getBeaufortLevel(r.oursG) - getBeaufortLevel(r.medianG) <= -1) gustUnder++;
  }
  const rg = byRegion.get(r.region) || { slots: 0, under: 0, over: 0, falseCalm: 0 };
  rg.slots++;
  if (d <= -1) rg.under++;
  if (d >= 1) rg.over++;
  if (bo <= 2 && bm >= 4) rg.falseCalm++;
  byRegion.set(r.region, rg);
}

const bias = rows.reduce((s, r) => s + (r.ours - r.median), 0) / (total || 1);

console.log(`\n=== ΑΝΕΜΟΣ: best_match έναντι διαμέσου 4 μοντέλων (${total} ώρες-σημεία, 09:00-19:00) ===`);
console.log(`  ακριβώς ίδιο Μποφόρ      ${pct(total - under - over, total)}%`);
console.log(`  ΕΜΕΙΣ ΧΑΜΗΛΟΤΕΡΑ ≥1 Μπφ  ${pct(under, total)}%   (≥2 Μπφ: ${pct(under2, total)}%)`);
console.log(`  εμείς ψηλότερα ≥1 Μπφ    ${pct(over, total)}%   (≥2 Μπφ: ${pct(over2, total)}%)`);
console.log(`  μέση απόκλιση            ${bias >= 0 ? '+' : ''}${bias.toFixed(2)} χλμ/ώ`);
console.log(`\n  ριπές χαμηλότερα ≥1 Μπφ  ${pct(gustUnder, gustRows)}%  (${gustRows} ώρες)`);

console.log('\n=== ΑΝΑ ΚΑΘΕΣΤΩΣ (Μποφόρ της διαμέσου) ===');
console.log('  Μπφ | ώρες  | εμείς χαμηλότερα | ≥2 Μπφ | εμείς ψηλότερα');
for (const k of Object.keys(byRegime).sort()) {
  const b = byRegime[k];
  console.log(`  ${k.padStart(3)} | ${String(b.slots).padStart(5)} | ${String(pct(b.under, b.slots) + '%').padStart(16)} | ${String(pct(b.under2, b.slots) + '%').padStart(6)} | ${pct(b.over, b.slots)}%`);
}

console.log('\n=== ΕΠΙΠΤΩΣΗ ΣΤΙΣ ΑΠΟΦΑΣΕΙΣ ===');
console.log(`  «ψεύτικη ηρεμία» (εμείς ≤2 Μπφ, διάμεσος ≥4)   ${falseCalm} ώρες = ${pct(falseCalm, total)}%`);
console.log(`  χάνουμε το κατώφλι 4 Μπφ                        ${gate4} από ${gate4Total} ώρες ≥4 Μπφ = ${pct(gate4, gate4Total)}%`);
console.log(`  χάνουμε το κατώφλι 5 Μπφ                        ${gate5} από ${gate5Total} ώρες ≥5 Μπφ = ${pct(gate5, gate5Total)}%`);

const worst = [...byRegion.entries()].filter(([, v]) => v.slots >= 20)
  .map(([k, v]) => ({ region: k, ...v, pctUnder: pct(v.under, v.slots) }))
  .sort((a, b) => b.pctUnder - a.pctUnder).slice(0, 10);
console.log('\n=== 10 ΠΕΡΙΟΧΕΣ ΜΕ ΤΗ ΜΕΓΑΛΥΤΕΡΗ ΥΠΟΕΚΤΙΜΗΣΗ ===');
for (const w of worst) console.log(`  ${w.pctUnder.toFixed(1)}% ${w.region} (${w.slots} ώρες, ψεύτικη ηρεμία ${w.falseCalm})`);

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `wind-model-consensus-${new Date().toISOString().slice(0, 10)}.json`);
const tmp = `${out}.tmp`;
fs.writeFileSync(tmp, JSON.stringify({
  generatedAt: new Date().toISOString(), pointsSampled: points.length, perRegion: PER_REGION, days: DAYS,
  models: { served: 'best_match', comparison: COMPARISON_MODELS }, hours: SWIM_HOURS, slots: total,
  wind: { samePct: pct(total - under - over, total), underPct: pct(under, total), under2Pct: pct(under2, total), overPct: pct(over, total), over2Pct: pct(over2, total), biasKmh: Number(bias.toFixed(3)) },
  gusts: { slots: gustRows, underPct: pct(gustUnder, gustRows) },
  byRegime,
  decisions: { falseCalm, falseCalmPct: pct(falseCalm, total), gate4, gate4Total, gate4Pct: pct(gate4, gate4Total), gate5, gate5Total, gate5Pct: pct(gate5, gate5Total) },
  worstRegions: worst,
}, null, 2), 'utf8');
fs.renameSync(tmp, out);
console.log(`\nαναφορά: ${path.relative(root, out)}`);
