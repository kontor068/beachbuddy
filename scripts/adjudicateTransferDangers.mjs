/**
 * ΣΤΑΔΙΟ 2, ΞΕΣΚΟΝΙΣΜΑ — ΚΡΙΣΗ ΤΩΝ 15 ΔΙΑΦΩΝΙΩΝ «ΣΩΠΑΙΝΟΥΜΕ ΑΛΛΑ ΜΠΑΙΝΕΙ ΕΝΕΡΓΕΙΑ».
 *
 * Για κάθε συνδυασμό (παραλία, βαθιά διεύθυνση θ) της κλάσης κινδύνου του
 * measureTransferVsGates.mjs, τρεις ερωτήσεις με τη σειρά:
 *
 *  1. ΘΑ ΣΩΠΑΙΝΕ ΟΝΤΩΣ ΣΗΜΕΡΑ; Ο χθεσινός έλεγχος άφησε επίτηδες απέξω τον έλεγχο στομίου
 *     ±90° του isEnclosedDrySector (υπερεκτίμηση σιωπής, γραμμένο εκεί). Εδώ τρέχει ο ΠΛΗΡΗΣ
 *     ζωντανός κανόνας. Αν δεν σωπαίνει → η «διαφωνία» δεν υπάρχει στην πράξη → ΑΚΙΝΔΥΝΟ.
 *  2. ΤΙ ΒΛΕΠΕΙ Η ΠΙΝΕΖΑ; Ευθεία από την πινέζα προς τη θ (τρίτος μάρτυρας, EMODnet raster,
 *     νερό-μόνο): σε πόσα μέτρα συναντά στεριά; Αν βλέπει ≥3 χλμ νερό → το fetch=0 της έκθεσης
 *     είναι το ύποπτο → ΠΡΑΓΜΑΤΙΚΟΣ ΚΙΝΔΥΝΟΣ (ψεύτικη ηρεμία σήμερα).
 *  3. Αλλιώς: η πινέζα όντως κρύβεται και μόνο η ΕΚΚΙΝΗΣΗ του πίνακα (100-300+ μ ανοιχτά)
 *     βλέπει νερό → «αφετηρία-πίσω-από-βραχίονα», artifact της τοποθέτησης εκκίνησης → ο
 *     πίνακας υπερ-ισχυρίζεται, το σήμερα μάλλον σωστό → ΘΕΜΑ ΤΟΥ ΠΙΝΑΚΑ, όχι του site.
 *
 * Report-only. Έξοδος: reports/quality/transfer-danger-adjudication.json + κονσόλα.
 * Run: node scripts/adjudicateTransferDangers.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { isEnclosedDrySector, SHORE_RAMP_SILENT_ONSHORE } = require(path.join(root, 'utils/shoreWave.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { OFFSHORE_FLAT_MIN_BLOCKED_RATIO, OFFSHORE_FLAT_MAX_FETCH_KM } = require(path.join(root, 'utils/offshoreFlatWater.ts'));

// ── Raster ζώνης (νερό-μόνο δειγματοληψία, όπως στον builder) ──────────────
const buf = readFileSync(path.join(root, '.tmp/bathymetry-zones/naxos-paros.tif'));
const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const image = await tiff.getImage();
const [west, south, east, north] = image.getBoundingBox();
const width = image.getWidth(), height = image.getHeight();
const nodata = image.getGDALNoData();
const band = (await image.readRasters())[0];
const pxDeg = (east - west) / width, pyDeg = (north - south) / height;
const waterDepthAt = (lat, lon) => {
  const fx = (lon - west) / pxDeg, fy = (north - lat) / pyDeg;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return null;
  const tx = fx - x0, ty = fy - y0;
  const raw = (x, y) => { const v = band[y * width + x]; return (v === nodata || !Number.isFinite(v)) ? NaN : v; };
  const cells = [
    [raw(x0, y0), (1 - tx) * (1 - ty)], [raw(x0 + 1, y0), tx * (1 - ty)],
    [raw(x0, y0 + 1), (1 - tx) * ty], [raw(x0 + 1, y0 + 1), tx * ty],
  ];
  let sum = 0, wsum = 0;
  for (const [v, w] of cells) if (Number.isFinite(v) && v < 0) { sum += -v * w; wsum += w; }
  return wsum > 0 ? sum / wsum : null;
};
const M = 111320;
const stepTo = (lat, lon, bearingDeg, distM) => {
  const b = bearingDeg * Math.PI / 180;
  return [lat + (distM * Math.cos(b)) / M, lon + (distM * Math.sin(b)) / (M * Math.cos(lat * Math.PI / 180))];
};
// Πόσο μακριά βλέπει νερό η ευθεία από (lat,lon) προς bearing — πρώτη στεριά σε βήμα 50 μ.
const firstLandM = (lat, lon, bearingDeg, maxM = 15000) => {
  for (let off = 50; off <= maxM; off += 50) {
    const [la, lo] = stepTo(lat, lon, bearingDeg, off);
    if (waterDepthAt(la, lo) == null) return off;
  }
  return maxM + 1; // καθαρό ως το τέλος
};

// ── Δεδομένα ───────────────────────────────────────────────────────────────
const table = JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/wave-transfer/naxos-paros.json'), 'utf8'));
const dangers = JSON.parse(readFileSync(path.join(root, 'reports/quality/transfer-vs-gates-naxos-paros.json'), 'utf8')).danger;
const profilesById = {};
for (const rid of ['south-aegean-naxos', 'south-aegean-paros']) {
  const ex = JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/exposure', `${rid}.json`), 'utf8'));
  for (const p of Object.values(ex.profiles ?? {})) if (p?.beachId != null) profilesById[p.beachId] = p;
}

const out = { generatedAt: new Date().toISOString(), verdictKey: {
  'no-silence-today': 'ο πλήρης κανόνας ΔΕΝ σωπαίνει σήμερα — η διαφωνία δεν υπάρχει στην πράξη',
  'real-danger': 'η πινέζα βλέπει ≥3 χλμ νερό προς τη θ — το fetch=0 της έκθεσης είναι το ύποπτο',
  'start-artifact': 'η πινέζα κρύβεται (<3 χλμ), μόνο η εκκίνηση βλέπει — υπερ-ισχυρισμός του πίνακα',
}, cases: [] };

for (const d of dangers) {
  const profile = profilesById[d.id];
  const entry = table.beaches[d.id];
  const theta = d.dirDeg;
  const geo = interpolateSectorGeometry(profile, theta);
  const onshore = onshoreComponent(theta, profile.facingDeg);
  const basePath = geo.blockedRayRatio >= OFFSHORE_FLAT_MIN_BLOCKED_RATIO
    && geo.fetchKm <= OFFSHORE_FLAT_MAX_FETCH_KM && onshore < SHORE_RAMP_SILENT_ONSHORE;
  const fullDry = isEnclosedDrySector(
    { fetchKm: geo.fetchKm, blockedRayRatio: geo.blockedRayRatio }, profile, theta);
  const silencesToday = basePath || fullDry;

  const pin = profile.coordinates ?? {};
  const pinSeesM = firstLandM(pin.lat, pin.lon, theta);
  const startSeesM = firstLandM(entry.start.lat, entry.start.lon, theta);

  let verdict;
  if (!silencesToday) verdict = 'no-silence-today';
  else if (pinSeesM >= 3000) verdict = 'real-danger';
  else verdict = 'start-artifact';

  out.cases.push({ id: d.id, name: profile.name?.gr ?? profile.name?.en ?? String(profile.name), dirDeg: theta, K6: d.K6,
    silencesToday, via: basePath ? 'base' : fullDry ? 'dry-sector' : '—',
    pinSeesKm: +(pinSeesM / 1000).toFixed(2), startSeesKm: +(startSeesM / 1000).toFixed(2),
    startOffsetM: entry.start.offsetM, verdict });
}

writeFileSync(path.join(root, 'reports/quality/transfer-danger-adjudication.json'), JSON.stringify(out, null, 2));
const counts = {};
for (const c of out.cases) counts[c.verdict] = (counts[c.verdict] ?? 0) + 1;
console.log('Κρίθηκαν', out.cases.length, 'συνδυασμοί:', JSON.stringify(counts));
for (const c of out.cases) {
  console.log(` ${c.verdict.padEnd(16)} ${c.name} ${c.dirDeg}° K6=${c.K6} | σωπαίνει σήμερα: ${c.silencesToday ? c.via : 'ΟΧΙ'} | πινέζα βλέπει ${c.pinSeesKm} χλμ, εκκίνηση ${c.startSeesKm} χλμ (@${c.startOffsetM} μ)`);
}
