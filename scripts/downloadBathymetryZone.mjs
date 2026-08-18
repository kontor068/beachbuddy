/**
 * ΣΤΑΔΙΟ 2, ΒΗΜΑ 1 — ΤΟ ΚΟΥΤΙ ΤΗΣ ΖΩΝΗΣ (HANDOVER-2026-08-17 §8γ σημείο 1).
 *
 * Τα tiles του Σταδίου 1 (.tmp/bathymetry-tiles) είναι στενά κουτιά γύρω από τις πινέζες
 * (+0,02°) — η διάθλαση θέλει ΟΛΟΚΛΗΡΗ τη διαδρομή του κύματος από τα ανοιχτά, δεκάδες χλμ.
 * Εδώ κατεβαίνει ΕΝΑ ενιαίο GeoTIFF ανά ζώνη πιλότου (νησιά + γύρω πέλαγος) από το ίδιο
 * EMODnet WCS (ζωντανό, δωρεάν, ~115 μ/pixel, πρόσημο επαληθευμένο 18/08: αρνητικό = βάθος).
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ: καμία γραμμή παραγωγής δεν διαβάζει τίποτα από εδώ. Offline πρώτη ύλη για
 * τους πίνακες μεταφοράς (backward ray tracing). Cache: .tmp/bathymetry-zones/ (gitignored).
 *
 * Run: node scripts/downloadBathymetryZone.mjs                  (όλες οι ζώνες)
 *      node scripts/downloadBathymetryZone.mjs --force          (αγνόησε το cache)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromArrayBuffer } from 'geotiff';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, '.tmp/bathymetry-zones');
mkdirSync(cacheDir, { recursive: true });

const FORCE = process.argv.includes('--force');
const WCS_BASE = 'https://ows.emodnet-bathymetry.eu/wcs';
const COVERAGE_ID = 'emodnet__mean';

// Πινέζες πιλότου: Νάξος 36.936-37.194 / 25.341-25.594, Πάρος 36.982-37.146 / 25.110-25.287.
// Το κουτί απλώνει ~45 χλμ βόρεια (η ράχη του μελτεμιού), ~35 χλμ νότια και ~35 χλμ Δ/Α, ώστε
// κάθε ανάδρομη ακτίνα να προλαβαίνει να βγει σε βαθύ νερό ή στο όριο του κουτιού (όπου ούτως
// ή άλλως μιλάει το Open-Meteo). Περιλαμβάνει Αντίπαρο, Ηρακλειά, Σχοινούσα, νότια Μύκονο.
const ZONES = {
  'naxos-paros': { minLat: 36.55, maxLat: 37.65, minLon: 24.70, maxLon: 26.00 },
};

const fetchZone = async (zoneId, box) => {
  const cachePath = path.join(cacheDir, `${zoneId}.tif`);
  if (existsSync(cachePath) && !FORCE) {
    console.log(`${zoneId}: υπάρχει στο cache (${cachePath})`);
    return readFileSync(cachePath);
  }
  const url = `${WCS_BASE}?service=WCS&version=2.0.1&request=GetCoverage&coverageId=${COVERAGE_ID}`
    + `&subset=Lat(${box.minLat},${box.maxLat})`
    + `&subset=Long(${box.minLon},${box.maxLon})`
    + `&format=image/tiff`;
  console.log(`${zoneId}: κατεβαίνει…`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  if (!res.ok) throw new Error(`WCS ${res.status} ${res.statusText} για ${zoneId}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const magic = buf.slice(0, 4).toString('latin1');
  if (magic !== 'II*\0' && magic !== 'MM\0*') {
    throw new Error(`${zoneId}: η απάντηση δεν είναι TIFF — ${buf.slice(0, 300).toString('utf8')}`);
  }
  writeFileSync(cachePath, buf);
  return buf;
};

// Υγειονομικός έλεγχος: διαστάσεις, ανάλυση, μερίδιο στεριάς/νερού, και 4 ονομαστικά σημεία
// με γνωστό χαρακτήρα (στενό Πάρου-Νάξου = ρηχό πλατό, ΒΑ Νάξου = ανοιχτό Αιγαίο κ.λπ.).
const inspect = async (zoneId, buf) => {
  const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const image = await tiff.getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const width = image.getWidth(), height = image.getHeight();
  const nodata = image.getGDALNoData();
  const band = (await image.readRasters())[0];
  const pxM = ((east - west) / width) * 111_320 * Math.cos(((south + north) / 2) * Math.PI / 180);
  let land = 0, water = 0, nd = 0, deepest = 0;
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (v === nodata || !Number.isFinite(v)) nd++;
    else if (v >= 0) land++;
    else { water++; if (-v > deepest) deepest = -v; }
  }
  console.log(`${zoneId}: ${width}×${height} px (~${pxM.toFixed(0)} μ/px), κουτί ${west.toFixed(2)}-${east.toFixed(2)}E ${south.toFixed(2)}-${north.toFixed(2)}N`);
  console.log(`  στεριά ${(100 * land / band.length).toFixed(1)}% · νερό ${(100 * water / band.length).toFixed(1)}% · nodata ${(100 * nd / band.length).toFixed(1)}% · βαθύτερο ${deepest.toFixed(0)} μ`);

  const sample = (lat, lon) => {
    const x = Math.round((lon - west) / ((east - west) / width));
    const y = Math.round((north - lat) / ((north - south) / height));
    if (x < 0 || y < 0 || x >= width || y >= height) return NaN;
    return band[y * width + x];
  };
  const checks = [
    ['Στενό Πάρου-Νάξου (μέση)', 37.06, 25.32],
    ['ΒΑ Νάξου, 15 χλμ ανοιχτά', 37.35, 25.75],
    ['Δ Πάρου, 10 χλμ ανοιχτά', 37.05, 24.95],
    ['Κορυφή Νάξου (Ζας, στεριά)', 37.00, 25.50],
  ];
  for (const [label, lat, lon] of checks) {
    const v = sample(lat, lon);
    console.log(`  ${label}: ${Number.isFinite(v) ? v.toFixed(1) + ' μ' : 'nodata'}`);
  }
};

for (const [zoneId, box] of Object.entries(ZONES)) {
  const buf = await fetchZone(zoneId, box);
  console.log(`${zoneId}: ${(buf.length / 1024 / 1024).toFixed(1)} MB στο δίσκο`);
  await inspect(zoneId, buf);
}
