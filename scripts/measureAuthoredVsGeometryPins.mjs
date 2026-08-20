#!/usr/bin/env node
/**
 * ΠΟΣΕΣ ΠΙΝΕΖΕΣ ΒΓΑΙΝΟΥΝ ΠΡΑΣΙΝΕΣ ΕΠΑΝΩ ΣΕ ΓΕΩΜΕΤΡΙΑ ΠΟΥ ΛΕΕΙ «ΚΑΤΑΜΟΥΤΡΑ»;
 *
 * Αφορμή: #2020 Αγία Ειρήνη Πάρου στον ΒΔ — γεωμετρία ένταση 83,5 / fetch 10,08 χλμ /
 * onshore 0,99, και η πινέζα πράσινη. Αιτία: το χειρόγραφο προφίλ επιστρέφεται στη
 * `mapExposure.ts:422` ΠΡΙΝ ελεγχθεί η γεωμετρία `exposed` στη `:465`.
 *
 * Η μέτρηση είναι ΜΟΝΟ μέτρηση — δεν αλλάζει τίποτα. Καμία κλήση δικτύου: συνθετικός άνεμος
 * 8 τομείς × 4 εντάσεις πάνω στα αποθηκευμένα προφίλ, ίδιο μοτίβο με το
 * `validateCardVsPinExposure.mjs`.
 *
 *   node scripts/measureAuthoredVsGeometryPins.mjs [--verbose] [--min-intensity=60]
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

const verbose = process.argv.includes('--verbose');
const minIntensityArg = process.argv.find(a => a.startsWith('--min-intensity='));
const MIN_INTENSITY = minIntensityArg ? Number(minIntensityArg.split('=')[1]) : 60;

const SCEN = [
  { sector: 'N', dir: WindDirection.N, deg: 0 }, { sector: 'NE', dir: WindDirection.NE, deg: 45 },
  { sector: 'E', dir: WindDirection.E, deg: 90 }, { sector: 'SE', dir: WindDirection.SE, deg: 135 },
  { sector: 'S', dir: WindDirection.S, deg: 180 }, { sector: 'SW', dir: WindDirection.SW, deg: 225 },
  { sector: 'W', dir: WindDirection.W, deg: 270 }, { sector: 'NW', dir: WindDirection.NW, deg: 315 },
];
const BFS = [{ bft: 3, kmh: 15 }, { bft: 4, kmh: 25 }, { bft: 5, kmh: 35 }, { bft: 6, kmh: 45 }];

const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

const rows = new Map();       // beachId@SECTOR -> row
let comparisons = 0;
let geomExposedStrong = 0;    // τομεοεντάσεις με γεωμετρία exposed & ένταση > MIN

for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const beaches = payload.island?.beaches || [];
  if (!beaches.length) continue;

  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* περιοχή χωρίς γεωμετρία — δεν μπορεί να παραβιαστεί τίποτα εδώ */ }

  for (const { bft, kmh } of BFS) {
    for (const scen of SCEN) {
      for (const beach of beaches) {
        const geo = profiles[beach.id];
        const geoSector = geo?.sectors?.[scen.sector];
        if (!geoSector) continue;
        comparisons += 1;
        const intensity = typeof geoSector.intensity === 'number' ? geoSector.intensity : null;
        if (geoSector.level !== 'exposed' || intensity === null || intensity <= MIN_INTENSITY) continue;
        geomExposedStrong += 1;

        let assessment;
        try {
          assessment = assessBeachWindExposure({
            beach, geospatialProfile: geo,
            windDirectionDeg: scen.deg, windDirection: scen.dir,
            windSpeedKmh: kmh, beaufort: bft, waveHeightMeters: 0.5,
          });
        } catch { continue; }

        const item = {
          beach, exposureLevel: assessment.exposureLevel, orientation: assessment.facingDeg,
          windProfile: assessment.windProfile, windProfileSource: assessment.source,
          windSector: assessment.windSector, warnings: assessment.warnings,
          geospatialExposure: geo,
        };
        const pin = getVisibleMapExposureLevel(item, bft, scen.deg);
        if (pin !== 'protected') continue;

        const key = `${beach.id}@${scen.sector}`;
        const existing = rows.get(key);
        if (existing) { existing.bfts.push(bft); existing.cards.add(assessment.exposureLevel); continue; }
        rows.set(key, {
          key, id: beach.id, name: beach.name?.gr || beach.name?.en || `#${beach.id}`,
          region: regionId, sector: scen.sector, bfts: [bft],
          cards: new Set([assessment.exposureLevel]),
          intensity: Number(intensity.toFixed(1)),
          fetchKm: typeof geoSector.fetchKm === 'number' ? Number(geoSector.fetchKm.toFixed(2)) : null,
          onshore: typeof geoSector.onshore === 'number' ? Number(geoSector.onshore.toFixed(3)) : null,
          blockedRayRatio: typeof geoSector.blockedRayRatio === 'number' ? Number(geoSector.blockedRayRatio.toFixed(3)) : null,
          confidence: assessment.windProfile?.confidence ?? null,
          source: assessment.source ?? null,
          suspectPin: Boolean(assessment.windProfile?.suspectPin),
          shelterLevel: assessment.windProfile?.shelterLevel ?? null,
          fetchExposure: assessment.windProfile?.fetchExposure ?? null,
          facing: typeof assessment.windProfile?.beachFacingDirection === 'number' ? assessment.windProfile.beachFacingDirection : null,
          protectedFromWindDirections: assessment.windProfile?.protectedFromWindDirections ?? [],
          exposedToWindDirections: assessment.windProfile?.exposedToWindDirections ?? [],
        });
      }
    }
  }
}

const all = [...rows.values()].map(r => ({ ...r, bfts: r.bfts.sort((a, b) => a - b), cards: [...r.cards] }));
all.sort((a, b) => b.intensity - a.intensity);
const beachIds = new Set(all.map(r => r.id));

console.log('Πράσινη πινέζα πάνω σε γεωμετρία «κατάμουτρα»');
console.log(`Τομεοεντάσεις με γεωμετρία: ${comparisons.toLocaleString('el-GR')} · από αυτές exposed με ένταση >${MIN_INTENSITY}: ${geomExposedStrong.toLocaleString('el-GR')}`);
console.log(`ΕΥΡΗΜΑΤΑ: ${all.length} τομείς σε ${beachIds.size} παραλίες όπου η πινέζα βγαίνει «protected».\n`);

const byCard = {};
for (const r of all) for (const c of r.cards) byCard[c] = (byCard[c] || 0) + 1;
console.log(`Τι λέει η ΚΑΡΤΑ στους ίδιους τομείς: ${JSON.stringify(byCard)}`);
const suspect = all.filter(r => r.suspectPin);
console.log(`Από αυτούς με suspectPin (ο χάρτης αγνοεί σκόπιμα τη γεωμετρία): ${suspect.length}\n`);

for (const r of all.slice(0, verbose ? 500 : 15)) {
  console.log(`  #${r.id} ${r.name} [${r.region}] @${r.sector} — ένταση ${r.intensity}, fetch ${r.fetchKm} χλμ, onshore ${r.onshore}`);
  console.log(`     κάρτα: ${r.cards.join('/')} · προφίλ: ${r.source}/${r.confidence}${r.suspectPin ? '/suspectPin' : ''} · shelter=${r.shelterLevel} fetchExp=${r.fetchExposure} · protectedFrom=[${r.protectedFromWindDirections}] · Μπφ ${r.bfts.join(',')}`);
}
if (all.length > 15 && !verbose) console.log(`  …και ${all.length - 15} ακόμη (--verbose)`);

const outDir = path.join(root, 'reports/quality');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'authored-over-geometry-pins.json');
fs.writeFileSync(out, JSON.stringify({
  measuredAt: '2026-08-20', minIntensity: MIN_INTENSITY,
  comparisons, geomExposedStrong, sectors: all.length, beaches: beachIds.size, rows: all,
}, null, 2) + '\n', 'utf8');
console.log(`\nΑναφορά: ${path.relative(root, out)}`);
