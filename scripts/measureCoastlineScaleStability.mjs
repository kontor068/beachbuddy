#!/usr/bin/env node
/**
 * ΤΟ ΤΕΣΤ ΚΛΙΜΑΚΑΣ: κάθεται η πινέζα σε τσέπη νερού, ή σε ανοιχτή ακτή;
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (PORISMA §Γ28στ). Οκτώ παραλίες με `suspectPin` επαναφέρθηκαν, γιατί «η μέτρηση
 * OSM γίνεται ΠΑΝΩ στην πινέζα, άρα εκεί δεν είναι ανεξάρτητη». Το σημείωμα κάθε μιας λέει
 * «η πινέζα κάθεται σε τσέπη νερού 40-80 μ.» — αν ισχύει, ο OSM μετράει την τσέπη, όχι τη
 * θάλασσα, και η συμφωνία του με τη γεωμετρία μας σημαίνει μόνο ότι ψεύδονται μαζί.
 *
 * Ο ΔΙΑΧΩΡΙΣΤΗΣ. Μια τσέπη 40-80 μ. είναι ΜΙΚΡΗ. Αν η πινέζα είναι μέσα της, ο προσανατολισμός
 * αλλάζει δραματικά όταν πλαταίνει το παράθυρο δειγματοληψίας: στα 60 μ. βλέπεις το τοίχωμα της
 * τσέπης, στα 500 μ. την ακτή. Αν η πινέζα είναι σε ανοιχτή ακτή, η απάντηση δεν κουνιέται.
 * Το τεστ ΔΕΝ ρωτάει «ποιος έχει δίκιο» — ρωτάει «είναι έγκυρη η μέτρηση εδώ;».
 *
 * ⚠️ ΟΜΑΔΑ ΕΛΕΓΧΟΥ, ΥΠΟΧΡΕΩΤΙΚΗ. Ίδιο δόγμα με το §Γ28ε: το τεστ τρέχει ΚΑΙ σε παραλίες με
 * πινέζα που ΔΕΝ αμφισβητείται (χειρόγραφο και γεωμετρία συμφωνούν <20°). Αν εκεί η διακύμανση
 * είναι το ίδιο μεγάλη, το τεστ δεν ξεχωρίζει τίποτα και δεν κρίνει κανέναν στόχο.
 *
 * ΤΟ ΚΑΤΩΦΛΙ ΓΡΑΦΤΗΚΕ ΠΡΙΝ ΤΡΕΞΕΙ: STABLE αν η διακύμανση <=45°, POCKET αν >45°.
 *
 * ΜΟΝΟ ΑΝΑΦΟΡΑ. Δεν πειράζει κανένα δεδομένο.
 *   node scripts/measureCoastlineScaleStability.mjs [--control 40]
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { WindDirection } = require(path.join(root, 'types.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));

const getArg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const CONTROL_N = Number(getArg('--control', '40'));
const OUT = getArg('--json', 'reports/quality/coastline-scale-stability.json');

/**
 * Προεπιλογή: οι 8 που επαναφέρθηκαν στο §Γ28στ επειδή η πινέζα τους δεν είναι έμπιστη.
 *
 * Με `--ids` δέχεται οποιαδήποτε λίστα. Χρησιμοποιήθηκε έτσι στο §Γ28η για ΟΛΕΣ τις υπόλοιπες
 * της ουράς: εκεί το αρχικό πέρασμα (§Γ28ε) τις είχε απορρίψει με κριτήριο «διασπορά >60°»,
 * που μετράει πόσο σκορπίζουν τα τμήματα ΜΕΣΑ σε ένα παράθυρο. Το τεστ κλίμακας ρωτάει κάτι
 * αυστηρότερα σχετικό: αλλάζει η ΑΠΑΝΤΗΣΗ όταν αλλάξει το παράθυρο; Καμπυλωτή αλλά συνεπής
 * ακτή δίνει μεγάλη διασπορά και σταθερή απάντηση — η διασπορά μόνη της την καταδίκαζε άδικα.
 */
const SUSPECT = String(getArg('--ids', '')).split(',').map(x => Number(x.trim())).filter(Boolean).length
  ? String(getArg('--ids', '')).split(',').map(x => Number(x.trim())).filter(Boolean)
  : [1702, 1709, 1726, 1898, 1911, 1914, 2011, 2049];
const WINDOWS = [60, 120, 250, 500, 1000];
const SWING_LIMIT = 45;

// -- δίκτυο ------------------------------------------------------------------
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/** Ρητό όριο χρόνου σε ΚΑΘΕ κλήση· ο καθρέφτης που απαντά 200 με άδειο σώμα είναι αποτυχία. */
const fetchOverpass = async (query, attempts = 4) => {
  for (let a = 0; a < attempts; a++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'User-Agent': 'CalmBeachScaleStability/0.1 (calmbeach.gr; marismiltos@gmail.com)',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(120000),
        });
        const text = await res.text();
        if (res.status === 429 || res.status >= 500) continue;
        if (!res.ok || text.trimStart().startsWith('<')) continue;
        const json = JSON.parse(text);
        if (!Array.isArray(json.elements)) continue;
        return json;
      } catch { /* δίκτυο ή λήξη χρόνου -> επόμενος καθρέφτης */ }
    }
    await sleep(2500 * (a + 1));
  }
  return null;
};

// -- γεωμετρία ---------------------------------------------------------------
const R = Math.PI / 180;
const M = 111320;
const xy = (lat, lon, lat0) => ({ x: lon * M * Math.cos(lat0 * R), y: lat * M });
const bearing = (aLat, aLon, bLat, bLon) => {
  const y = Math.sin((bLon - aLon) * R) * Math.cos(bLat * R);
  const x = Math.cos(aLat * R) * Math.sin(bLat * R) - Math.sin(aLat * R) * Math.cos(bLat * R) * Math.cos((bLon - aLon) * R);
  return (Math.atan2(y, x) / R + 360) % 360;
};
const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const circularMean = (bearings, weights) => {
  let sx = 0, sy = 0;
  bearings.forEach((b, i) => { const w = weights[i]; sx += w * Math.cos(b * R); sy += w * Math.sin(b * R); });
  if (sx === 0 && sy === 0) return null;
  return (Math.atan2(sy, sx) / R + 360) % 360;
};
const pointToSegment = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
};

/** Όλα τα τμήματα ακτογραμμής γύρω από την πινέζα, με απόσταση και φορά «προς τα ανοιχτά». */
const segmentsAround = (coords, ways, maxM) => {
  const lat0 = coords.lat;
  const p = xy(coords.lat, coords.lon, lat0);
  const segs = [];
  for (const w of ways) {
    const g = w.geometry || [];
    for (let i = 0; i + 1 < g.length; i++) {
      const a = g[i], b = g[i + 1];
      const d = pointToSegment(p, xy(a.lat, a.lon, lat0), xy(b.lat, b.lon, lat0));
      if (d > maxM) continue;
      segs.push({ d, seaward: (bearing(a.lat, a.lon, b.lat, b.lon) + 90) % 360 });
    }
  }
  return segs.sort((x, y) => x.d - y.d);
};
/** Ο προσανατολισμός με ΣΤΑΘΕΡΟ παράθυρο — αυτό αλλάζει, όχι ο κανόνας. */
const facingAtWindow = (segs, windowM) => {
  const used = segs.filter(s => s.d <= windowM);
  if (!used.length) return null;
  const facing = circularMean(used.map(s => s.seaward), used.map(s => 1 / (s.d + 20)));
  if (facing === null) return null;
  return { facing, segments: used.length };
};

// -- ποιες παραλίες ----------------------------------------------------------
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const targets = [];
const controlPool = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const region = rf.replace(/\.json$/, '');
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* καμία γεωμετρία */ }
  for (const beach of payload.island?.beaches || []) {
    const geo = profiles[beach.id];
    if (!geo?.sectors || !beach.coordinates || typeof geo.facingDeg !== 'number') continue;
    let authored = null;
    try {
      authored = assessBeachWindExposure({
        beach, geospatialProfile: geo, windDirectionDeg: 0, windDirection: WindDirection.N,
        windSpeedKmh: 24, beaufort: 3, waveHeightMeters: 0.5,
      }).windProfile?.beachFacingDirection ?? null;
    } catch { /* noop */ }
    const row = { id: beach.id, name: beach.name?.gr || beach.name?.en, region, coordinates: beach.coordinates, authored, geo: geo.facingDeg };
    if (SUSPECT.includes(beach.id)) { targets.push(row); continue; }
    if (typeof authored === 'number' && angDiff(authored, geo.facingDeg) < 20) controlPool.push(row);
  }
}
const targetRegions = new Set(targets.map(t => t.region));
const sameRegion = controlPool.filter(c => targetRegions.has(c.region));
const step = Math.max(1, Math.floor(sameRegion.length / CONTROL_N));
const control = sameRegion.filter((_, i) => i % step === 0).slice(0, CONTROL_N);

console.log('Στόχοι (suspectPin): ' + targets.length + ' · Ομάδα ελέγχου (ίδιες περιοχές, πινέζα μη αμφισβητούμενη): ' + control.length);
if (targets.length !== SUSPECT.length) console.error('  ! βρέθηκαν ' + targets.length + '/' + SUSPECT.length + ' στόχοι');
if (control.length < 12) { console.error('ΣΤΑΜΑΤΩ: ομάδα ελέγχου < 12 — δεν κρίνεται τίποτα.'); process.exit(2); }

// -- μέτρηση -----------------------------------------------------------------
const all = [...targets.map(t => ({ ...t, kind: 'target' })), ...control.map(c => ({ ...c, kind: 'control' }))];
const CHUNK = 10;
const measure = async (rows) => {
  const out = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const around = chunk.map(b => 'way["natural"="coastline"](around:2500,' + b.coordinates.lat + ',' + b.coordinates.lon + ');').join('');
    const q = '[out:json][timeout:180];(' + around + ');out geom;';
    process.stdout.write('  ' + (i + 1) + '-' + Math.min(i + CHUNK, rows.length) + '/' + rows.length + ' … ');
    const json = await fetchOverpass(q);
    if (!json) { console.log('ΑΠΟΤΥΧΙΑ δικτύου'); chunk.forEach(b => out.push({ ...b, error: 'network' })); continue; }
    const ways = json.elements.filter(e => e.type === 'way' && Array.isArray(e.geometry));
    console.log(ways.length + ' ways');
    for (const b of chunk) {
      const segs = segmentsAround(b.coordinates, ways, 1200);
      if (!segs.length) { out.push({ ...b, error: 'no-coastline' }); continue; }
      const byWindow = {};
      for (const w of WINDOWS) byWindow[w] = facingAtWindow(segs, w);
      const present = WINDOWS.filter(w => byWindow[w]);
      let swing = 0;
      for (const a of present) for (const c of present) swing = Math.max(swing, angDiff(byWindow[a].facing, byWindow[c].facing));
      out.push({ ...b, nearestM: segs[0].d, byWindow, windowsPresent: present.length, swing, verdict: swing <= SWING_LIMIT ? 'STABLE' : 'POCKET' });
    }
    await sleep(1500);
  }
  return out;
};

const rows = await measure(all);
const ok = rows.filter(r => !r.error);
const ctl = ok.filter(r => r.kind === 'control');
const tgt = ok.filter(r => r.kind === 'target');
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const ctlStable = ctl.filter(r => r.verdict === 'STABLE').length;
const ctlStableRate = ctl.length ? ctlStable / ctl.length : 0;
console.log('\n-- ΟΜΑΔΑ ΕΛΕΓΧΟΥ (ξέρουμε ότι η πινέζα είναι καλή) --');
console.log('  μετρήθηκαν: ' + ctl.length + '/' + control.length);
console.log('  διάμεση διακύμανση: ' + (median(ctl.map(r => r.swing)) ?? 0).toFixed(1) + '°');
console.log('  STABLE: ' + ctlStable + '/' + ctl.length + ' (' + (100 * ctlStableRate).toFixed(0) + '%)');
if (ctlStableRate < 0.7) {
  console.error('\nΣΤΑΜΑΤΩ: μόνο ' + (ctlStableRate * 100).toFixed(0) + '% των ΚΑΛΩΝ πινεζών βγαίνει STABLE.');
  console.error('Το τεστ δεν ξεχωρίζει τσέπη από ανοιχτή ακτή — καμία κρίση για τους στόχους.');
}

console.log('\n-- ΟΙ 8 ΥΠΟΠΤΕΣ --');
console.log('id    όνομα            κοντ.  διακύμ.  ' + WINDOWS.map(w => (w + 'μ').padStart(7)).join('') + '   ετυμηγορία');
for (const r of tgt.sort((a, b) => a.swing - b.swing)) {
  console.log(String(r.id).padEnd(6) + (r.name || '').slice(0, 16).padEnd(17)
    + (r.nearestM.toFixed(0) + 'μ').padEnd(7) + (r.swing.toFixed(0) + '°').padStart(7) + '  '
    + WINDOWS.map(w => (r.byWindow[w] ? r.byWindow[w].facing.toFixed(0) + '°' : '—')).map(s => s.padStart(7)).join('')
    + '   ' + r.verdict);
}
for (const r of rows.filter(x => x.error && x.kind === 'target')) console.log(r.id + ' ' + r.name + ': ΣΦΑΛΜΑ ' + r.error);

fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
fs.writeFileSync(path.join(root, OUT), JSON.stringify({
  method: 'coastline facing at fixed sampling windows; swing across windows separates a small water pocket from open coast',
  windows: WINDOWS,
  swingLimitDeg: SWING_LIMIT,
  control: { n: ctl.length, medianSwing: median(ctl.map(r => r.swing)), stableRate: ctlStableRate },
  rows,
}, null, 2));
console.log('\nγράφτηκε ' + OUT);
