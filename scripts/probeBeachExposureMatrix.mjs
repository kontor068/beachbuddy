#!/usr/bin/env node
/**
 * ΤΙ ΛΕΕΙ ΜΙΑ ΠΑΡΑΛΙΑ ΣΕ ΚΑΘΕ ΑΝΕΜΟ — ΚΑΡΤΑ ΚΑΙ ΠΙΝΕΖΑ ΜΑΖΙ, ΠΡΙΝ ΚΑΙ ΜΕΤΑ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το χειρόγραφο `beachFacingDirection` δεν αγγίζεται ποτέ χωρίς μέτρηση, γιατί
 * κουνάει ΤΑΥΤΟΧΡΟΝΑ γωνιακή έκθεση, `fetchExposure` και ταξινόμηση όρμου — σε ΟΛΟΥΣ τους
 * τομείς, όχι σε αυτόν που κοιτάς (PORISMA §Γ28στ). Αυτό εδώ τυπώνει ολόκληρο τον πίνακα
 * 8 τομείς × 4 εντάσεις για μία παραλία, ώστε η αλλαγή να συγκρίνεται γραμμή-γραμμή:
 *
 *   node scripts/probeBeachExposureMatrix.mjs --beach 2020 > πριν.txt
 *   (κάνε την αλλαγή)
 *   node scripts/probeBeachExposureMatrix.mjs --beach 2020 > μετά.txt
 *   diff πριν.txt μετά.txt
 *
 * ΚΑΜΙΑ ΚΛΗΣΗ ΔΙΚΤΥΟΥ, καμία αλλαγή δεδομένων. Συνθετικός άνεμος πάνω στα αποθηκευμένα προφίλ.
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
const { getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));

const getArg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BEACH_ID = Number(getArg('--beach', '0'));
/**
 * ΤΟ ΒΗΜΑ ΤΩΝ 45° ΔΕΝ ΦΤΑΝΕΙ ΓΙΑ ΝΑ ΚΡΙΘΕΙ ΑΛΛΑΓΗ FACING. Ο τομέας κρίνεται από ρητές λίστες
 * (`exposedTo` / `protectedFrom`), αλλά η ΓΩΝΙΑΚΗ διαδρομή — και το `authoredAngularExposed`
 * του `mapExposure.ts` — τρέχει πάνω στις ΠΡΑΓΜΑΤΙΚΕΣ μοίρες του ανέμου. Στα κέντρα των οκτώ
 * τομέων μια λάθος γωνία μπορεί να φαίνεται εντελώς αδρανής και να ζωντανεύει στις ενδιάμεσες.
 */
const STEP = Math.max(1, Number(getArg('--step', '45')) || 45);
if (!BEACH_ID) {
  console.error('Δώσε --beach <id>.');
  process.exit(2);
}

const SCEN = [
  { sector: 'N', dir: WindDirection.N, deg: 0 }, { sector: 'NE', dir: WindDirection.NE, deg: 45 },
  { sector: 'E', dir: WindDirection.E, deg: 90 }, { sector: 'SE', dir: WindDirection.SE, deg: 135 },
  { sector: 'S', dir: WindDirection.S, deg: 180 }, { sector: 'SW', dir: WindDirection.SW, deg: 225 },
  { sector: 'W', dir: WindDirection.W, deg: 270 }, { sector: 'NW', dir: WindDirection.NW, deg: 315 },
];
const SECTOR_OF = (deg) => SCEN.reduce((best, s) => {
  const d = Math.min(Math.abs(s.deg - deg), 360 - Math.abs(s.deg - deg));
  return d < best.d ? { d, s } : best;
}, { d: 999, s: SCEN[0] }).s;
const SCAN = Array.from({ length: Math.round(360 / STEP) }, (_, i) => {
  const deg = (i * STEP) % 360;
  const s = SECTOR_OF(deg);
  return { sector: s.sector, dir: s.dir, deg, label: STEP === 45 ? s.sector : `${s.sector}${String(deg).padStart(4)}°` };
});
const BFS = [{ bft: 3, kmh: 15 }, { bft: 4, kmh: 25 }, { bft: 5, kmh: 35 }, { bft: 6, kmh: 45 }];

const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

let found;
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const beach = (payload.island?.beaches || []).find(b => b.id === BEACH_ID);
  if (!beach) continue;
  let geo;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    const pr = Object.values(p.profiles || {}).find(x => x.beachId === BEACH_ID);
    if (pr) geo = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* καμία γεωμετρία */ }
  found = { beach, geo, region: rf.replace(/\.json$/, '') };
  break;
}
if (!found) {
  console.error(`Δεν βρέθηκε παραλία #${BEACH_ID}.`);
  process.exit(2);
}

const { beach, geo, region } = found;
const name = beach.name?.gr || beach.name?.en || `#${BEACH_ID}`;
console.log(`#${BEACH_ID} ${name} [${region}]`);

const probe = assessBeachWindExposure({
  beach, geospatialProfile: geo, windDirectionDeg: 0, windDirection: WindDirection.N,
  windSpeedKmh: 15, beaufort: 3, waveHeightMeters: 0.5,
});
console.log(`χειρόγραφο facing: ${probe.windProfile?.beachFacingDirection ?? '—'}° · μετρημένο (γεωμετρία): ${geo?.facingDeg ?? '—'}° · πηγή προφίλ: ${probe.source}/${probe.windProfile?.confidence}`);
console.log(`shelter=${probe.windProfile?.shelterLevel} fetchExp=${probe.windProfile?.fetchExposure} exposedTo=[${probe.windProfile?.exposedToWindDirections}] protectedFrom=[${probe.windProfile?.protectedFromWindDirections}]`);
console.log('');
console.log('τομέας  γεωμετρία(ένταση/fetch/onshore)      3 Μπφ      4 Μπφ      5 Μπφ      6 Μπφ');

for (const scen of SCAN) {
  const sec = geo?.sectors?.[scen.sector];
  const geoTxt = sec
    ? `${(sec.level || '—').padEnd(9)} ${String(typeof sec.intensity === 'number' ? sec.intensity.toFixed(0) : '—').padStart(3)}/${String(typeof sec.fetchKm === 'number' ? sec.fetchKm.toFixed(1) : '—').padStart(5)}/${String(typeof sec.onshore === 'number' ? sec.onshore.toFixed(2) : '—').padStart(5)}`
    : '—'.padEnd(25);
  const cells = [];
  for (const { bft, kmh } of BFS) {
    let a;
    try {
      a = assessBeachWindExposure({
        beach, geospatialProfile: geo, windDirectionDeg: scen.deg, windDirection: scen.dir,
        windSpeedKmh: kmh, beaufort: bft, waveHeightMeters: 0.5,
      });
    } catch { cells.push('  σφάλμα '); continue; }
    const pin = getVisibleMapExposureLevel({
      beach, exposureLevel: a.exposureLevel, orientation: a.facingDeg, windProfile: a.windProfile,
      windProfileSource: a.source, windSector: a.windSector, warnings: a.warnings, geospatialExposure: geo,
    }, bft, scen.deg);
    const short = (l) => (l === 'protected' ? 'ΠΡΟ' : l === 'partial' ? 'ΜΕΡ' : l === 'exposed' ? 'ΕΚΤ' : ' — ');
    cells.push(`${short(a.exposureLevel)}/${short(pin)}`.padEnd(10));
  }
  console.log(`${scen.label.padEnd(9)} ${geoTxt}  ${cells.join(' ')}`);
}
console.log('\nκάθε κελί: ΚΑΡΤΑ/ΠΙΝΕΖΑ · ΠΡΟ=Προστατευμένη ΜΕΡ=Μερική ΕΚΤ=Εκτεθειμένη');
