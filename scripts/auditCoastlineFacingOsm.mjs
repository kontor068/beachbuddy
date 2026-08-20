#!/usr/bin/env node
/**
 * Ο ΑΝΕΞΑΡΤΗΤΟΣ ΚΡΙΤΗΣ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ: η ακτογραμμή του OSM.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (PORISMA §Γ28δ). Σε 40 παραλίες η κάρτα λέει «Εκτεθειμένη» σε τομέα όπου η δική
 * μας γεωμετρία λέει ότι ο άνεμος φεύγει από τη στεριά, επειδή ο χειρόγραφος προσανατολισμός
 * και ο μετρημένος διαφωνούν 45°-140°. Κανένα δεδομένο του repo δεν κρίνει ποιος δείχνει λάθος
 * πλευρά: το `beach.orientation` ξαναγράφεται από rebuild, και το fetch βγαίνει από την ΙΔΙΑ
 * αφετηρία με το facing — αν εκείνη πήδηξε σε διπλανό κόλπο, ψεύδονται μαζί.
 *
 * Ο OSM είναι εκτός του σπιτιού μας. Η ακτογραμμή του (`natural=coastline`) έχει ΚΑΝΟΝΑ
 * ΚΑΤΕΥΘΥΝΣΗΣ: κάθε way σχεδιάζεται με τη ΣΤΕΡΙΑ ΑΡΙΣΤΕΡΑ και τη ΘΑΛΑΣΣΑ ΔΕΞΙΑ. Άρα η κάθετη
 * προς τα δεξιά της πορείας δείχνει ανοιχτά — ένας προσανατολισμός που δεν χρωστάει τίποτα
 * ούτε στον άνθρωπο που έγραψε το προφίλ ούτε στη δική μας αφετηρία.
 *
 * ⚠️ Η ΜΕΘΟΔΟΣ ΕΛΕΓΧΕΤΑΙ ΠΡΙΝ ΧΡΗΣΙΜΟΠΟΙΗΘΕΙ. Πρώτα τρέχει σε ΟΜΑΔΑ ΕΛΕΓΧΟΥ: παραλίες όπου ο
 * χειρόγραφος και ο μετρημένος προσανατολισμός ΣΥΜΦΩΝΟΥΝ (<20°), δηλαδή ξέρουμε ήδη την
 * απάντηση. Αν εκεί ο OSM δεν πέφτει κοντά, η μέθοδος —ή η φορά του κανόνα— είναι λάθος και το
 * σενάριο ΣΤΑΜΑΤΑΕΙ αντί να κρίνει τις αμφισβητούμενες. Αυτό πιάνει και το κλασικό λάθος των
 * 180°: αν η διάμεσος της ομάδας ελέγχου βγει ~180°, έχω τον κανόνα ανάποδα.
 *
 * ΜΟΝΟ ΑΝΑΦΟΡΑ. Δεν πειράζει κανένα δεδομένο. Γράφει reports/quality/coastline-facing-osm.json.
 *
 *   node scripts/auditCoastlineFacingOsm.mjs [--limit N] [--control N]
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

const getArg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const LIMIT = Number(getArg('--limit', '0')) || 0;
const CONTROL_N = Number(getArg('--control', '45'));

// ── δίκτυο ──────────────────────────────────────────────────────────────────
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/**
 * Ρητό όριο χρόνου σε ΚΑΘΕ κλήση. Χωρίς `signal` ένας νεκρός καθρέφτης δεν αποτυγχάνει, απλώς
 * περιμένει — έχει ήδη κοστίσει δύο ώρες σε προηγούμενο πέρασμα.
 */
const fetchOverpass = async (query, attempts = 4) => {
  for (let a = 0; a < attempts; a++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': 'CalmBeachCoastlineAudit/0.1 (calmbeach.gr; marismiltos@gmail.com)', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(90_000),
        });
        const text = await res.text();
        if (res.status === 429 || res.status >= 500) continue;
        if (!res.ok || text.trimStart().startsWith('<')) continue;
        const json = JSON.parse(text);
        // Ο καθρέφτης που απαντάει 200 με άδειο σώμα είναι αποτυχία, όχι «καμία ακτογραμμή».
        if (!Array.isArray(json.elements)) continue;
        return json;
      } catch { /* δίκτυο ή λήξη χρόνου → επόμενος καθρέφτης */ }
    }
    await sleep(2500 * (a + 1));
  }
  return null;
};

// ── γεωμετρία ───────────────────────────────────────────────────────────────
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
/** Απόσταση σημείου από ευθύγραμμο τμήμα, σε μέτρα, σε τοπικό επίπεδο. */
const pointToSegment = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
};

/**
 * Ο προσανατολισμός της ανοιχτής θάλασσας στη θέση της πινέζας, από τα ways του OSM.
 * Κανόνας OSM: στεριά ΑΡΙΣΤΕΡΑ της πορείας ⇒ θάλασσα ΔΕΞΙΑ ⇒ κάθετη = πορεία + 90°.
 */
const seawardFromCoastline = (beach, ways) => {
  const lat0 = beach.coordinates.lat;
  const p = xy(beach.coordinates.lat, beach.coordinates.lon, lat0);
  const segs = [];
  for (const w of ways) {
    const g = w.geometry || [];
    for (let i = 0; i + 1 < g.length; i++) {
      const a = g[i], b = g[i + 1];
      const d = pointToSegment(p, xy(a.lat, a.lon, lat0), xy(b.lat, b.lon, lat0));
      if (d > 400) continue;
      segs.push({ d, seaward: (bearing(a.lat, a.lon, b.lat, b.lon) + 90) % 360 });
    }
  }
  if (!segs.length) return null;
  segs.sort((x, y) => x.d - y.d);
  const nearest = segs[0].d;
  // Μαζεύουμε ό,τι είναι κοντά στο πλησιέστερο τμήμα ώστε ο θόρυβος ενός σπασμένου βήματος να
  // μη γίνει η απάντηση· ζυγίζουμε αντιστρόφως με την απόσταση.
  const window = Math.max(nearest * 2 + 30, 120);
  const used = segs.filter(s => s.d <= window);
  const facing = circularMean(used.map(s => s.seaward), used.map(s => 1 / (s.d + 20)));
  if (facing === null) return null;
  // Διασπορά: πόσο συμφωνούν μεταξύ τους τα τμήματα. Μεγάλη διασπορά = μύτη/στενό, άρα
  // η απάντηση δεν είναι αξιόπιστη και το λέμε αντί να την κρύψουμε.
  const spread = used.reduce((s, x) => s + angDiff(x.seaward, facing), 0) / used.length;
  return { facing, nearestM: nearest, segments: used.length, spread };
};

// ── ποιες παραλίες ──────────────────────────────────────────────────────────
const SCEN = [
  { sector: 'N', dir: WindDirection.N, deg: 0 }, { sector: 'NE', dir: WindDirection.NE, deg: 45 },
  { sector: 'E', dir: WindDirection.E, deg: 90 }, { sector: 'SE', dir: WindDirection.SE, deg: 135 },
  { sector: 'S', dir: WindDirection.S, deg: 180 }, { sector: 'SW', dir: WindDirection.SW, deg: 225 },
  { sector: 'W', dir: WindDirection.W, deg: 270 }, { sector: 'NW', dir: WindDirection.NW, deg: 315 },
];
const BFS = [3, 4, 5, 6];
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

const disputed = [];
const control = [];
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
    if (!geo?.sectors || !beach.coordinates) continue;
    const sectors = [];
    let authored = null;
    for (const scen of SCEN) {
      const sec = geo.sectors[scen.sector];
      if (!sec || typeof sec.onshore !== 'number' || sec.onshore >= -0.3) continue;
      for (const bft of BFS) {
        let a;
        try {
          a = assessBeachWindExposure({
            beach, geospatialProfile: geo, windDirectionDeg: scen.deg, windDirection: scen.dir,
            windSpeedKmh: bft * 8, beaufort: bft, waveHeightMeters: 0.5,
          });
        } catch { continue; }
        if (a.exposureLevel !== 'exposed') continue;
        authored = a.windProfile?.beachFacingDirection ?? authored;
        if (!sectors.includes(scen.sector)) sectors.push(scen.sector);
        break;
      }
    }
    const gf = geo.facingDeg;
    if (sectors.length && typeof authored === 'number' && typeof gf === 'number') {
      disputed.push({ id: beach.id, name: beach.name?.gr || beach.name?.en, region, coordinates: beach.coordinates, sectors, authored, geo: gf, gap: angDiff(authored, gf) });
      continue;
    }
    // ΟΜΑΔΑ ΕΛΕΓΧΟΥ: εδώ ξέρουμε ήδη την απάντηση, γιατί οι δύο δικές μας πηγές συμφωνούν.
    let auth2 = null;
    try { auth2 = assessBeachWindExposure({ beach, geospatialProfile: geo, windDirectionDeg: 0, windDirection: WindDirection.N, windSpeedKmh: 24, beaufort: 3, waveHeightMeters: 0.5 }).windProfile?.beachFacingDirection ?? null; } catch { /* noop */ }
    if (typeof auth2 === 'number' && typeof gf === 'number' && angDiff(auth2, gf) < 20) {
      control.push({ id: beach.id, name: beach.name?.gr || beach.name?.en, region, coordinates: beach.coordinates, agreed: auth2, geo: gf });
    }
  }
}

// Η ομάδα ελέγχου παίρνεται από ΤΙΣ ΙΔΙΕΣ περιοχές με τις αμφισβητούμενες, ώστε να μη συγκρίνω
// καλά χαρτογραφημένη ακτή με κακή και να το περάσω για επιτυχία της μεθόδου.
const disputedRegions = new Set(disputed.map(d => d.region));
const controlSameRegions = control.filter(c => disputedRegions.has(c.region));
const controlPick = (controlSameRegions.length >= 12 ? controlSameRegions : control)
  .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / CONTROL_N)) === 0)
  .slice(0, CONTROL_N);

console.log(`Αμφισβητούμενες: ${disputed.length} · ομάδα ελέγχου: ${controlPick.length} (από ${controlSameRegions.length} διαθέσιμες στις ίδιες περιοχές)\n`);

// ── ερώτηση στον OSM ────────────────────────────────────────────────────────
const askCoastline = async (beaches) => {
  const out = new Map();
  const batches = [];
  for (let i = 0; i < beaches.length; i += 8) batches.push(beaches.slice(i, i + 8));
  for (let bi = 0; bi < batches.length; bi++) {
    const around = batches[bi].map(b => `way(around:600,${b.coordinates.lat},${b.coordinates.lon})["natural"="coastline"];`).join('\n');
    const json = await fetchOverpass(`[out:json][timeout:90];(\n${around}\n);out geom;`);
    process.stdout.write(`  παρτίδα ${bi + 1}/${batches.length}: ${json ? `${json.elements.length} ways` : 'ΑΠΟΤΥΧΙΑ'}\n`);
    if (!json) continue;
    for (const b of batches[bi]) {
      const res = seawardFromCoastline(b, json.elements);
      if (res) out.set(b.id, res);
    }
    await sleep(1200);
  }
  return out;
};

console.log('ΣΤΑΔΙΟ 1 — ΕΛΕΓΧΟΣ ΜΕΘΟΔΟΥ πάνω σε παραλίες όπου ξέρουμε την απάντηση:');
const controlOsm = await askCoastline(controlPick);
const controlRows = controlPick.filter(c => controlOsm.has(c.id)).map(c => ({ ...c, osm: controlOsm.get(c.id), delta: angDiff(controlOsm.get(c.id).facing, c.agreed) }));
if (controlRows.length < 8) {
  console.error(`\nΣΤΑΜΑΤΩ: μόνο ${controlRows.length} παραλίες ελέγχου πήραν ακτογραμμή. Χωρίς ομάδα ελέγχου δεν έχω δικαίωμα να κρίνω τις αμφισβητούμενες.`);
  process.exit(1);
}
const deltas = controlRows.map(r => r.delta).sort((a, b) => a - b);
const median = deltas[Math.floor(deltas.length / 2)];
const within45 = deltas.filter(d => d < 45).length;
console.log(`\n  ${controlRows.length} παραλίες · διάμεσος απόκλιση OSM vs συμφωνημένου: ${median.toFixed(1)}° · εντός 45°: ${within45}/${deltas.length} (${(100 * within45 / deltas.length).toFixed(0)}%)`);
if (median > 150) {
  console.error('\nΣΤΑΜΑΤΩ: η διάμεσος είναι ~180°, δηλαδή έχω τον κανόνα στεριά-αριστερά ΑΝΑΠΟΔΑ. Γύρνα την κάθετη και ξανατρέξε.');
  process.exit(1);
}
if (median > 45 || within45 < deltas.length * 0.6) {
  console.error(`\nΣΤΑΜΑΤΩ: η μέθοδος δεν αναπαράγει ούτε τις γνωστές απαντήσεις (διάμεσος ${median.toFixed(1)}°). Δεν κρίνω τίποτα με αυτήν.`);
  process.exit(1);
}
console.log('  ✓ Η μέθοδος αναπαράγει τις γνωστές απαντήσεις. Προχωράω.\n');

console.log('ΣΤΑΔΙΟ 2 — ΟΙ ΑΜΦΙΣΒΗΤΟΥΜΕΝΕΣ:');
const target = LIMIT ? disputed.slice(0, LIMIT) : disputed;
const osm = await askCoastline(target);

const rows = [];
for (const d of target) {
  const o = osm.get(d.id);
  if (!o) { rows.push({ ...d, osm: null, verdict: 'ΧΩΡΙΣ ΑΚΤΟΓΡΑΜΜΗ' }); continue; }
  const dA = angDiff(o.facing, d.authored);
  const dG = angDiff(o.facing, d.geo);
  const reliable = o.nearestM <= 250 && o.spread <= 60;
  const verdict = !reliable ? 'ΑΝΑΞΙΟΠΙΣΤΟ (μύτη/μακριά)'
    : Math.abs(dA - dG) < 25 ? 'ΙΣΟΠΑΛΙΑ'
    : dA < dG ? 'ΥΠΕΡ ΧΕΙΡΟΓΡΑΦΟΥ' : 'ΥΠΕΡ ΓΕΩΜΕΤΡΙΑΣ';
  rows.push({ ...d, osm: o, dA, dG, verdict });
}

const cnt = rows.reduce((m, r) => { m[r.verdict] = (m[r.verdict] || 0) + 1; return m; }, {});
console.log('\nΕΤΥΜΗΓΟΡΙΑ ΤΟΥ OSM:', JSON.stringify(cnt, null, 0));
console.log('');
for (const r of rows.sort((a, b) => a.verdict.localeCompare(b.verdict) || a.id - b.id)) {
  const o = r.osm;
  console.log(`  [${r.verdict}] #${r.id} ${r.name} [${r.region}] @${r.sectors.join('/')}`);
  console.log(`      χειρ. ${r.authored}° · γεωμ. ${Math.round(r.geo)}° · OSM ${o ? Math.round(o.facing) + '°' : '—'}`
    + (o ? ` (απόσταση ${Math.round(o.nearestM)}μ, ${o.segments} τμήματα, διασπορά ${Math.round(o.spread)}°) → απέχει ${Math.round(r.dA)}° από το χειρόγραφο, ${Math.round(r.dG)}° από τη γεωμετρία` : ''));
}

const outDir = path.join(root, 'reports/quality');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'coastline-facing-osm.json');
fs.writeFileSync(outFile, JSON.stringify({
  method: 'OSM natural=coastline, land-on-left rule; seaward = segment bearing + 90deg',
  control: { count: controlRows.length, medianDeltaDeg: Number(median.toFixed(1)), within45: within45 },
  verdicts: cnt,
  rows,
}, null, 2));
console.log(`\nΓράφτηκε ${path.relative(root, outFile)}`);
