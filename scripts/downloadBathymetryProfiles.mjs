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
 * ⚠️ v2 (18/08/2026, ίδια μέρα) — Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΕΛΕΓΕ «ΣΤΕΓΝΟ» ΕΚΕΙ ΠΟΥ ΔΕΝ ΗΞΕΡΕ. Μετρήθηκε με
 * διασταύρωση των δύο μαρτύρων (βάθος ↔ άνοιγμα ακτίνων, .tmp/witness-check): η Ροβινιά Κέρκυρας
 * έδειχνε 0/0/0 βάθος σε τομέα με 15 χλμ ανοιχτό Ιόνιο, οι Άμμες Κεφαλονιάς 0/0/0 με 20 χλμ. Δύο
 * μηχανισμοί, και οι δύο δικοί μας: (α) η ευθεία από την πινέζα διασχίζει τον βραχίονα του όρμου
 * και διαβάζει το ακρωτήρι — η θάλασσα κάνει τον γύρο, η γραμμή όχι (το ανάποδο του μαθήματος
 * «Η αφετηρία πηδάει τον βραχίονα»)· (β) στα 115 μ/pixel η διγραμμική παρεμβολή 100-300 μ από την
 * ακτή ανακατεύει pixel ΣΤΕΡΙΑΣ (+υψόμετρο) στο μέσο όρο και βγάζει ψεύτικα ρηχά. Ένα «ταβάνι
 * θραύσης» πάνω σε τέτοια νούμερα θα κατέβαζε το κύμα της Ροβινιάς πάνω από ανοιχτό πέλαγος —
 * ψεύτικη ηρεμία από δικό μας artifact. Διορθώσεις v2:
 *   1. Παρεμβολή ΜΟΝΟ σε pixel νερού (raster < 0)· τα pixel στεριάς βγαίνουν από τον μέσο όρο και
 *      τα βάρη ξανακανονικοποιούνται. Κανένα υψόμετρο δεν μολύνει πια βάθος.
 *   2. «Δεν είδα νερό» = null, ΟΧΙ 0. Το 0 της v1 μπέρδευε «στεγνό» με «δεν ξέρω» — και πάνω σε
 *      αυτή τη σύγχυση θα χτιζόταν το ταβάνι. Όποιος καταναλώσει αυτά τα δεδομένα οφείλει να
 *      συμπεριφέρεται στο null ως απουσία μάρτυρα (καμία δήλωση), ποτέ ως ρηχό.
 *   3. Νέο πεδίο `firstWaterM` ανά τομέα: σε ποια απόσταση (βήμα 50 μ, ως 600 μ) η ευθεία βρίσκει
 *      πρώτη φορά νερό. Δείχνει πότε ένα null στα 100 μ σημαίνει «ο τομέας ξεκινά σε στεριά/βράχο»
 *      και πότε «δεν υπάρχει νερό πουθενά προς τα εκεί».
 * Η επαλήθευση της v2 είναι γραμμένη στο handover 8β: Ελαφονήσι κρατά τη ρηχή του ζώνη με αριθμούς,
 * Ροβινιά/Άμμες γυρίζουν σε null (όχι ψεύτικο στεγνό), Άγ. Προκόπιος αμετάβλητος.
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
// ΤΟ ΨΗΣΙΜΟ (v2) — παρεμβολή ΜΟΝΟ σε pixel νερού.
//
// Επιστρέφει ΒΑΘΟΣ σε μέτρα (θετικό) ή null. Ο μέσος όρος παίρνει μόνο τα pixel της γειτονιάς 2×2
// που είναι νερό (raster < 0), με τα διγραμμικά βάρη ξανακανονικοποιημένα πάνω τους — ένα pixel
// στεριάς +15 μ. δίπλα στην ακτή δεν μπορεί πια να «ρηχύνει» το δείγμα. Αν κανένα από τα 4 δεν
// είναι νερό, η απάντηση είναι null: δεν είδαμε νερό εκεί, δεν ξέρουμε βάθος — ΟΧΙ «στεγνό».
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
    const waterDepthAt = (x, y) => {
      const v = band[y * width + x];
      if (v === nodata || !Number.isFinite(v)) return null;
      return v < 0 ? -v : null; // στεριά (≥0) = εκτός μέσου όρου, όχι μηδενικό βάθος
    };
    const neighbours = [
      { depth: waterDepthAt(x0, y0), weight: (1 - tx) * (1 - ty) },
      { depth: waterDepthAt(x0 + 1, y0), weight: tx * (1 - ty) },
      { depth: waterDepthAt(x0, y0 + 1), weight: (1 - tx) * ty },
      { depth: waterDepthAt(x0 + 1, y0 + 1), weight: tx * ty },
    ].filter(n => n.depth !== null);
    const weightSum = neighbours.reduce((sum, n) => sum + n.weight, 0);
    if (weightSum <= 0) return null;
    return neighbours.reduce((sum, n) => sum + n.depth * n.weight, 0) / weightSum;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ΑΝΑ ΠΕΡΙΟΧΗ: κατέβασμα → sampler → κάθε παραλία × 8 τομείς × 3 αποστάσεις.
// ─────────────────────────────────────────────────────────────────────────────
let totalBeaches = 0;
let totalSectors = 0;
let noWaterAt100m = 0;
let sectorsWithNoWaterAtAll = 0;
const regionSummaries = [];

/** Σε ποια απόσταση (βήμα 50 μ, ως 600 μ) η ευθεία του τομέα βρίσκει πρώτη φορά νερό — αλλιώς null. */
const FIRST_WATER_STEP_KM = 0.05;
const FIRST_WATER_MAX_KM = 0.6;
const firstWaterKm = (sample, origin, bearingDeg) => {
  for (let d = FIRST_WATER_STEP_KM; d <= FIRST_WATER_MAX_KM + 1e-9; d += FIRST_WATER_STEP_KM) {
    const point = destinationPoint(origin, bearingDeg, d);
    if (sample(point.lat, point.lon) !== null) return d;
  }
  return null;
};

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
        const depthM = sample(point.lat, point.lon);
        const label = `${Math.round(distanceKm * 1000)}m`;
        depths[label] = depthM === null ? null : Number(depthM.toFixed(2));
        if (depthM === null && distanceKm === 0.1) noWaterAt100m += 1;
      }
      const firstKm = firstWaterKm(sample, beach.coordinates, bearingDeg);
      if (firstKm === null) sectorsWithNoWaterAtAll += 1;
      sectors[key] = {
        depths,
        firstWaterM: firstKm === null ? null : Math.round(firstKm * 1000),
      };
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
      // v2: παρεμβολή μόνο σε pixel νερού· null = «δεν είδα νερό», ΠΟΤΕ «στεγνό»· + firstWaterM.
      schemaVersion: 2,
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
console.log(`Χωρίς νερό στα 100 μ. (null, όχι «στεγνό»): ${noWaterAt100m} τομείς (${((noWaterAt100m / Math.max(1, totalSectors)) * 100).toFixed(1)}%).`);
console.log(`Χωρίς νερό ΠΟΥΘΕΝΑ ως τα 600 μ. (η ευθεία μένει σε στεριά): ${sectorsWithNoWaterAtAll} τομείς (${((sectorsWithNoWaterAtAll / Math.max(1, totalSectors)) * 100).toFixed(1)}%).`);
console.log(`Αρχεία: public/data/geospatial/bathymetry/*.json (${regionSummaries.length} νέα).`);
console.log('\nΕΛΕΓΞΕ ΔΕΙΓΜΑ ΠΡΙΝ ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ (§4 Στάδιο 1, ποιοτικός έλεγχος): λίγα βάθη εδώ έναντι ναυτικού χάρτη/γνωστού λιμανιού, με το χέρι.');
