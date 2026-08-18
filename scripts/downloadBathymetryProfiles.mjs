/**
 * Ο ΒΥΘΟΣ ΜΠΑΙΝΕΙ ΣΤΟ ΣΠΙΤΙ — Στάδιο 1 (18/08/2026 — HANDOVER-2026-08-17-bathymetry-shore-wave.md §4).
 *
 * ΤΙ ΚΑΝΕΙ. Κατεβάζει EMODnet Digital Bathymetry DTM (ζωντανή υπηρεσία WCS, δωρεάν, ~115 μ.
 * ανάλυση, επαληθεύτηκε 18/08) ανά ΠΕΡΙΟΧΗ — όχι τα 59 ολόκληρα tiles, μόνο το κουτί γύρω από τις
 * παραλίες της κάθε περιοχής, γιατί το WCS δέχεται subset στο ίδιο το αίτημα (GetCoverage +
 * subset=Lat/Long) και δεν χρειάζεται να κατέβει ανοιχτό πέλαγος που δεν θα διαβάσουμε ποτέ. Μετά
 * ψήνει, ανά παραλία × 8 τομείς (ίδιο πλέγμα με utils/windExposureModel), το βάθος στα 100/300/500
 * μ. από την πινέζα ΠΡΟΣ την κατεύθυνση του τομέα — ίδια γεωμετρία `destinationPoint` που ήδη
 * χρησιμοποιεί ο ray-caster της έκθεσης (utils/geospatialExposureModel), οπότε ο τομέας «N» εδώ
 * σημαίνει ακριβώς το ίδιο πράγμα με τον τομέα «N» του ανοίγματος: το νερό ΠΡΟΣ τα εκεί.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ. Καμία γραμμή παραγωγής δεν διαβάζει αυτό το αρχείο ακόμα — μηδέν επίδραση σε
 * σκορ, ετυμηγορία ή χρώμα. Αυτό είναι το «κατέβασμα + ψήσιμο» της §4 Στάδιο 1. Το φυσικό ταβάνι
 * θραύσης (κύμα ≤ 0,78×βάθος) είναι το ΕΠΟΜΕΝΟ βήμα, πάνω σε αυτό το αρχείο.
 *
 * ΤΟ ΠΡΟΤΥΠΟ ΠΡΟΣΗΜΟΥ (επαληθεύτηκε εδώ, 18/08, δύο ζωντανές δοκιμές πριν γραφτεί το pipeline):
 * αρνητικό = βάθος κάτω από την επιφάνεια (Ελληνικό Τάφρος ΝΔ Πελοποννήσου: −5.104 ως −3.514 μ.)·
 * θετικό = υψόμετρο στεριάς (ακτή Νάξου: έως 121,8 μ.). Άρα `depthM = -raster` όταν raster < 0.
 * raster ≥ 0 στα 100 μ. από πινέζα σημαίνει είτε πινέζα πάνω σε στεριά είτε δορυφορικό θόρυβο
 * κοντά στην ακτή (το ίδιο το εγχειρίδιο EMODnet προειδοποιεί γι' αυτό) — σημαδεύεται, δεν πετιέται.
 *
 * ΤΟ ΚΟΥΤΙ ΤΗΣ ΠΕΡΙΟΧΗΣ. bbox = min/max lat/lon όλων των πινέζων της περιοχής (app data, ΟΧΙ μόνο
 * high-confidence — το κατέβασμα είναι φτηνό, το ψήσιμο φιλτράρει μετά) + περιθώριο 0,02° (~2,2
 * χλμ) — άφθονο για δείγματα ως 500 μ. και για διγραμμική παρεμβολή στο άκρο του κουτιού.
 *
 * ΤΟ ΚΡΥΦΟ ΤΟΠΙΚΟ ΑΝΤΙΓΡΑΦΟ. Κάθε GeoTIFF περιοχής μπαίνει σε `.tmp/bathymetry-tiles/` (gitignored,
 * ΠΟΤΕ commit) ώστε ένα ξανατρέξιμο να μην ξαναχτυπά το δίκτυο. `--force` το ξαναφέρνει.
 *
 * Run: node scripts/downloadBathymetryProfiles.mjs                              (όλη η Ελλάδα)
 *      node scripts/downloadBathymetryProfiles.mjs --regions=south-aegean-naxos,south-aegean-paros
 *      node scripts/downloadBathymetryProfiles.mjs --force                      (αγνόησε το cache)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { fromArrayBuffer } from 'geotiff';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

// Η ΙΔΙΑ συνάρτηση destination-point που ήδη χρησιμοποιεί ο ray-caster της έκθεσης — καμία δεύτερη
// υλοποίηση γωνίας/απόστασης, ώστε ο τομέας «N» εδώ να είναι κατά γράμμα ο τομέας «N» εκεί.
const { destinationPoint } = require(path.join(root, 'utils/geospatialExposureModel.ts'));

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const beachDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const cacheDir = path.join(root, '.tmp/bathymetry-tiles');
const outDir = path.join(root, 'public/data/geospatial/bathymetry');
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SAMPLE_DISTANCES_KM = [0.1, 0.3, 0.5];
const BBOX_BUFFER_DEG = 0.02;
const WCS_BASE = 'https://ows.emodnet-bathymetry.eu/wcs';
const COVERAGE_ID = 'emodnet__mean';

const loadRegion = (file) => {
  const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
  const beaches = (app.island?.beaches ?? []).filter(b => b.coordinates
    && Number.isFinite(b.coordinates.lat) && Number.isFinite(b.coordinates.lon));
  if (!beaches.length) return null;

  let profiles = {};
  const exposurePath = path.join(exposureDir, file);
  if (existsSync(exposurePath)) {
    const raw = JSON.parse(readFileSync(exposurePath, 'utf8')).profiles ?? {};
    for (const profile of Object.values(raw)) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
  }
  return { regionId: file.replace(/\.json$/, ''), beaches, profiles };
};

const regions = readdirSync(beachDir)
  .filter(name => name.endsWith('.json'))
  .map(loadRegion)
  .filter(Boolean)
  .filter(region => !regionFilter || regionFilter.includes(region.regionId));

console.log(`${regions.length} περιοχές με πινέζες προς ψήσιμο.`);

// ─────────────────────────────────────────────────────────────────────────────
// ΤΟ ΚΑΤΕΒΑΣΜΑ — ένα WCS αίτημα ανά περιοχή, με cache στο δίσκο.
// ─────────────────────────────────────────────────────────────────────────────
const bboxForRegion = (region) => {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const beach of region.beaches) {
    const { lat, lon } = beach.coordinates;
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
  }
  return {
    minLat: minLat - BBOX_BUFFER_DEG, maxLat: maxLat + BBOX_BUFFER_DEG,
    minLon: minLon - BBOX_BUFFER_DEG, maxLon: maxLon + BBOX_BUFFER_DEG,
  };
};

const fetchTile = async (region) => {
  const cachePath = path.join(cacheDir, `${region.regionId}.tif`);
  if (existsSync(cachePath) && !FORCE) return readFileSync(cachePath);

  const box = bboxForRegion(region);
  const url = `${WCS_BASE}?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${COVERAGE_ID}`
    + `&subset=Lat(${box.minLat.toFixed(6)},${box.maxLat.toFixed(6)})`
    + `&subset=Long(${box.minLon.toFixed(6)},${box.maxLon.toFixed(6)})`
    + `&format=image/tiff`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`WCS ${res.status} ${res.statusText} για ${region.regionId}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Το WCS απαντά με XML σφάλμα (200 ή 400) αν το bbox είναι εκτός κάλυψης· ένα πραγματικό TIFF
  // ξεκινά πάντα με το magic number II*\0 ή MM\0*. Πιάνουμε το ψέμα πριν φτάσει στον parser.
  const magic = buf.slice(0, 4).toString('latin1');
  if (magic !== 'II*\0' && magic !== 'MM\0*') {
    throw new Error(`${region.regionId}: η απάντηση δεν είναι TIFF — ${buf.slice(0, 200).toString('utf8')}`);
  }
  writeFileSync(cachePath, buf);
  return buf;
};

// ─────────────────────────────────────────────────────────────────────────────
// ΤΟ ΨΗΣΙΜΟ — διγραμμική παρεμβολή πάνω στο raster, βάθος = −raster όταν raster < 0.
// ─────────────────────────────────────────────────────────────────────────────
const buildSampler = async (tiffBuffer) => {
  const tiff = await fromArrayBuffer(tiffBuffer.buffer.slice(
    tiffBuffer.byteOffset, tiffBuffer.byteOffset + tiffBuffer.byteLength
  ));
  const image = await tiff.getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  const nodata = image.getGDALNoData();
  const rasters = await image.readRasters();
  const band = rasters[0];
  const pxDeg = (east - west) / width;
  const pyDeg = (north - south) / height;

  return (lat, lon) => {
    // Pixel (0,0) είναι η πάνω-αριστερή γωνία (βόρεια-δυτική) — η γραμμή μεγαλώνει προς νότο.
    const fx = (lon - west) / pxDeg;
    const fy = (north - lat) / pyDeg;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return null;
    const tx = fx - x0, ty = fy - y0;
    const at = (x, y) => {
      const v = band[y * width + x];
      return (v === nodata || !Number.isFinite(v)) ? null : v;
    };
    const v00 = at(x0, y0), v10 = at(x0 + 1, y0), v01 = at(x0, y0 + 1), v11 = at(x0 + 1, y0 + 1);
    if (v00 === null || v10 === null || v01 === null || v11 === null) return null;
    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;
    return top + (bottom - top) * ty;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ΑΝΑ ΠΕΡΙΟΧΗ: κατέβασμα → sampler → κάθε παραλία × 8 τομείς × 3 αποστάσεις.
// ─────────────────────────────────────────────────────────────────────────────
let totalBeaches = 0;
let totalSectors = 0;
let landAt100m = 0;
const regionSummaries = [];

for (const region of regions) {
  let sample;
  try {
    const tiff = await fetchTile(region);
    sample = await buildSampler(tiff);
  } catch (error) {
    console.error(`  ${region.regionId}: ΑΠΕΤΥΧΕ το κατέβασμα/parse — ${error.message}`);
    continue;
  }

  const beachProfiles = {};
  for (const beach of region.beaches) {
    const profile = region.profiles[beach.id];
    const sectors = {};
    for (let index = 0; index < SECTOR_ORDER.length; index += 1) {
      const key = SECTOR_ORDER[index];
      const bearingDeg = index * 45;
      const depths = {};
      for (const distanceKm of SAMPLE_DISTANCES_KM) {
        const point = destinationPoint(beach.coordinates, bearingDeg, distanceKm);
        const raw = sample(point.lat, point.lon);
        const label = `${Math.round(distanceKm * 1000)}m`;
        if (raw === null) { depths[label] = null; continue; }
        const depthM = raw < 0 ? Number((-raw).toFixed(2)) : 0;
        depths[label] = depthM;
        if (raw >= 0 && distanceKm === 0.1) landAt100m += 1;
      }
      sectors[key] = { depths };
      totalSectors += 1;
    }
    beachProfiles[beach.id] = {
      beachId: beach.id,
      confidence: profile?.confidence ?? null,
      sectors,
    };
    totalBeaches += 1;
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, `${region.regionId}.json`),
    `${JSON.stringify({
      regionId: region.regionId,
      source: 'EMODnet Digital Bathymetry DTM (emodnet__mean, WCS)',
      generatedAt: new Date().toISOString(),
      sampleDistancesKm: SAMPLE_DISTANCES_KM,
      profiles: beachProfiles,
    }, null, 2)}\n`
  );
  regionSummaries.push({ regionId: region.regionId, beaches: region.beaches.length });
  process.stderr.write(`\r  ${regionSummaries.length}/${regions.length} περιοχές                    `);
}
process.stderr.write('\n');

console.log(`\nΨήθηκαν ${totalBeaches} παραλίες × 8 τομείς = ${totalSectors} συνδυασμοί σε ${regionSummaries.length} περιοχές.`);
console.log(`Στεριά (ή δορυφορικός θόρυβος) στα 100 μ. από πινέζα: ${landAt100m} τομείς (${((landAt100m / Math.max(1, totalSectors)) * 100).toFixed(1)}%) — δεν πετάχτηκαν, βάθος 0 με σημείωση εδώ στο log.`);
console.log(`Αρχεία: public/data/geospatial/bathymetry/*.json (${regionSummaries.length} νέα).`);
console.log('\nΕΛΕΓΞΕ ΔΕΙΓΜΑ ΠΡΙΝ ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ (§4 Στάδιο 1, ποιοτικός έλεγχος): λίγα βάθη εδώ έναντι ναυτικού χάρτη/γνωστού λιμανιού, με το χέρι.');
