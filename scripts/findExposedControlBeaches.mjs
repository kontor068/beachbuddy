/**
 * Θετικοί μάρτυρες για τον κριτή αφρού Sentinel-2: για κάθε παραλία-στόχο βρίσκει την πλησιέστερη
 * (≤25 χλμ) παραλία που είναι ΑΝΟΙΧΤΗ (K_d γεωμετρίας = 1) στη διεύθυνση του κύματος που φέρνει
 * σκιά στον στόχο. Εκεί, τις ίδιες μέρες, ο κριτής ΠΡΕΠΕΙ να βλέπει αφρό — αλλιώς το «καθόλου αφρός»
 * στον στόχο δεν σημαίνει τίποτα.
 *
 * Run: node scripts/findExposedControlBeaches.mjs → .tmp/s2judge/controls.json
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
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { resolveShoreShadowDamping } = require(path.join(root, 'utils/seaArrival.ts'));

// συντεταγμένες από τα χτισμένα αρχεία περιοχής (ό,τι βλέπει η εφαρμογή)
const coords = new Map();
const appDir = path.join(root, 'public/data/beaches/app');
for (const f of fs.readdirSync(appDir).filter((n) => n.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(appDir, f), 'utf8'));
  for (const b of d?.island?.beaches || []) {
    const c = b.coordinates || {};
    if (c.lat != null && c.lon != null) coords.set(b.id, { lat: +c.lat, lon: +c.lon, region: f.replace(/\.json$/, ''), name: b.name?.gr || b.name?.en });
  }
}
const profiles = new Map();
const expDir = path.join(root, 'public/data/geospatial/exposure');
for (const f of fs.readdirSync(expDir).filter((n) => n.endsWith('.json'))) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(expDir, f), 'utf8')); } catch { continue; }
  const list = Array.isArray(d) ? d : Array.isArray(d?.profiles) ? d.profiles : (d?.profiles ? Object.values(d.profiles) : []);
  for (const p of list) if (typeof p?.beachId === 'number') profiles.set(p.beachId, p);
}
const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const shadow = JSON.parse(fs.readFileSync(path.join(root, 'reports/quality/shadow-vs-blocked-arrival.json'), 'utf8'));
const chosen = new Map();
for (const r of shadow.rows) {
  const here = coords.get(r.id);
  if (!here) continue;
  const dir = r.waveDirDeg;
  let best = null;
  for (const [id, p] of profiles) {
    if (id === r.id || chosen.has(id)) continue;
    const c = coords.get(id);
    if (!c) continue;
    const d = km(here, c);
    if (d > 25) continue;
    const open = [-20, -10, 0, 10, 20].every((o) => resolveShoreShadowDamping({ ...p, beachId: -1 }, (dir + o + 360) % 360) === 1);
    if (!open) continue;
    if (!best || d < best.d) best = { id, d, c };
  }
  if (best) chosen.set(best.id, { id: best.id, region: best.c.region, name: best.c.name, forTarget: r.id, targetName: r.name, km: Math.round(best.d * 10) / 10, waveDirDeg: dir });
}
const out = path.join(root, '.tmp/s2judge/controls.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify([...chosen.values()], null, 1));
console.log(`${chosen.size} ανοιχτές παραλίες-μάρτυρες → ${path.relative(root, out)}`);
console.log([...chosen.values()].map((c) => c.id).join(' '));
