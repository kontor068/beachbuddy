#!/usr/bin/env node
/**
 * ΔΥΟ ΓΕΙΤΟΝΙΚΕΣ ΠΑΡΑΛΙΕΣ, ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΘΑΛΑΣΣΕΣ — εθνική μέτρηση.
 *
 * ΑΦΟΡΜΗ (22/08/2026): Ραπανιανά #575 τύπωνε 0,86 μ. ανοιχτού νερού και το Κολυμβάρι #3185,
 * 1,05 χλμ πιο δυτικά στην ΙΔΙΑ ευθεία ακτή του κόλπου Χανίων, 0,46 μ. Και οι δύο κοιτούν ΒΑ.
 * Η αιτία δεν ήταν η γεωμετρία της ακτής αλλά ΠΟΥ στέλνει η καθεμία την ερώτηση: το σημείο
 * σπρώχνεται ~10 χλμ ανοιχτά και μια διαφορά 26° στη γωνία βγάζει 4,5 χλμ απόκλιση — αρκετή
 * για δύο διαφορετικά κελιά του ewam (βήμα 0,05° × 0,10°).
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Για κάθε ζεύγος παραλιών κάτω από MAX_BEACH_KM μεταξύ τους που κοιτούν σχεδόν
 * την ίδια κατεύθυνση (≤ MAX_FACING_DIFF_DEG), ρωτάει το ewam στα ΔΙΚΑ ΤΟΥΣ σημεία και
 * συγκρίνει το ύψος κύματος ώρα προς ώρα. Δεν κρίνει ποιο έχει δίκιο — καταγράφει πού η
 * εφαρμογή λέει δύο πράγματα για το ίδιο νερό.
 *
 * Report-only. Δεν γράφει σε δεδομένα, μόνο σε reports/weather/.
 *
 * Χρήση: node scripts/auditNeighbourWaveSplit.mjs
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (m, f) => {
  m._compile(ts.transpileModule(readFileSync(f, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: f,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), f);
};
const { fetchMarineForecastDataBatch, forecastPointKey } = require(path.join(root, 'services/weatherService.ts'));

/** Πόσο κοντά πρέπει να είναι δύο παραλίες για να θεωρηθούν «ίδια ακτή». */
const MAX_BEACH_KM = 1.5;
/** Πόσο μπορεί να διαφέρει η κατεύθυνση που κοιτούν και να παραμένουν «ίδια ακτή». */
const MAX_FACING_DIFF_DEG = 45;
/** Από πόσο και πάνω η διαφορά ύψους είναι εύρημα, όχι θόρυβος. */
const REPORT_DELTA_M = 0.3;

const rad = d => (d * Math.PI) / 180;
const distKm = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beaches = [];
for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json')) continue;
  const d = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  for (const [id, p] of Object.entries(d.profiles || {})) {
    if (!p.coordinates || !p.marineSamplePoint || !Number.isFinite(p.facingDeg)) continue;
    beaches.push({
      region: file.replace('.json', ''), id: Number(id),
      name: p.name?.gr || p.name?.en || String(id),
      c: p.coordinates, m: p.marineSamplePoint, facing: p.facingDeg,
    });
  }
}

const pairs = [];
for (const region of new Set(beaches.map(b => b.region))) {
  const arr = beaches.filter(b => b.region === region);
  for (let i = 0; i < arr.length; i += 1) for (let j = i + 1; j < arr.length; j += 1) {
    const beachKm = distKm(arr[i].c, arr[j].c);
    if (beachKm > MAX_BEACH_KM) continue;
    const facingDiff = angDiff(arr[i].facing, arr[j].facing);
    if (facingDiff > MAX_FACING_DIFF_DEG) continue;
    pairs.push({ a: arr[i], b: arr[j], beachKm, facingDiff, sampleKm: distKm(arr[i].m, arr[j].m) });
  }
}
console.log(`ζεύγη «ίδιας ακτής» (≤${MAX_BEACH_KM} χλμ, ≤${MAX_FACING_DIFF_DEG}°): ${pairs.length}`);

const points = new Map();
for (const p of pairs) for (const side of [p.a, p.b]) {
  points.set(forecastPointKey(side.m.lat, side.m.lon), { lat: side.m.lat, lon: side.m.lon });
}
console.log(`διακριτά σημεία θάλασσας προς ερώτηση: ${points.size}`);

const fetched = await fetchMarineForecastDataBatch([...points.values()]);
const heights = new Map();
for (const [key, entry] of fetched) {
  const rows = entry?.data ?? [];
  const today = rows.length ? String(rows[0].dt_txt ?? '').slice(0, 10) : '';
  const day = rows.filter(r => {
    const txt = String(r.dt_txt ?? '');
    if (!txt.startsWith(today)) return false;
    const h = Number(txt.slice(11, 13));
    return h >= 8 && h <= 19;
  });
  const vals = day.map(r => r.marine?.waveHeightM).filter(v => Number.isFinite(v));
  if (vals.length) heights.set(key, { max: Math.max(...vals), mean: vals.reduce((s, v) => s + v, 0) / vals.length });
}
console.log(`σημεία με απάντηση: ${heights.size}/${points.size}`);

const findings = [];
for (const p of pairs) {
  const ha = heights.get(forecastPointKey(p.a.m.lat, p.a.m.lon));
  const hb = heights.get(forecastPointKey(p.b.m.lat, p.b.m.lon));
  if (!ha || !hb) continue;
  const delta = Math.abs(ha.max - hb.max);
  if (delta < REPORT_DELTA_M) continue;
  findings.push({
    region: p.a.region,
    beachKm: Number(p.beachKm.toFixed(2)), facingDiff: Number(p.facingDiff.toFixed(1)),
    sampleKm: Number(p.sampleKm.toFixed(1)), deltaM: Number(delta.toFixed(2)),
    ratio: Number((Math.max(ha.max, hb.max) / Math.max(0.01, Math.min(ha.max, hb.max))).toFixed(2)),
    a: { id: p.a.id, name: p.a.name, facing: p.a.facing, bearing: p.a.m.bearingDeg, pushKm: p.a.m.distanceKm, maxM: Number(ha.max.toFixed(2)) },
    b: { id: p.b.id, name: p.b.name, facing: p.b.facing, bearing: p.b.m.bearingDeg, pushKm: p.b.m.distanceKm, maxM: Number(hb.max.toFixed(2)) },
  });
}
findings.sort((x, y) => y.deltaM - x.deltaM);

console.log(`\nΕΥΡΗΜΑΤΑ (διαφορά ≥ ${REPORT_DELTA_M} μ. σε γειτονικές παραλίες ίδιας κατεύθυνσης): ${findings.length}`);
for (const f of findings.slice(0, 30)) {
  console.log(`${f.deltaM.toFixed(2)}μ (×${f.ratio}) | ${f.a.name}#${f.a.id} ${f.a.maxM}μ [κοιτά ${f.a.facing}°, ρωτά ${f.a.bearing}° στα ${f.a.pushKm}χλμ]`
    + ` vs ${f.b.name}#${f.b.id} ${f.b.maxM}μ [κοιτά ${f.b.facing}°, ρωτά ${f.b.bearing}° στα ${f.b.pushKm}χλμ] — ${f.region}`);
}

const outDir = path.join(root, 'reports/weather');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'neighbour-wave-split.json');
writeFileSync(outPath, JSON.stringify({
  measuredAt: new Date().toISOString(),
  settings: { MAX_BEACH_KM, MAX_FACING_DIFF_DEG, REPORT_DELTA_M },
  pairsExamined: pairs.length, pointsAsked: points.size, findings: findings.length,
  bearingMismatchCount: findings.filter(f => angDiff(f.a.facing, f.a.bearing) > 45 || angDiff(f.b.facing, f.b.bearing) > 45).length,
  results: findings,
}, null, 1));
console.log(`\nΑναφορά: ${path.relative(root, outPath)}`);
