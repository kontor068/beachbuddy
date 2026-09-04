#!/usr/bin/env node
/**
 * ΨΗΝΕΙ ΤΟ ΑΝΑΓΛΥΦΟ ΜΙΑΣ ΠΕΡΙΟΧΗΣ για την «παραλία σε κίνηση» (πιλοτικά Θεσπρωτία, 03/09/2026).
 *
 *   node scripts/bakeBeachRelief.mjs --region epirus-thesprotia-mainland
 *   node scripts/bakeBeachRelief.mjs --region epirus-thesprotia-mainland --dem open-meteo
 *   npm run bake:relief -- --region epirus-thesprotia-mainland
 *
 * Τι κάνει: παίρνει το κουτί των παραλιών της περιοχής, το ανοίγει κατά --margin-km (7) προς
 * κάθε μεριά, το γεμίζει με σημεία ανά --step-m (150 μ.), ρωτά το DEM για το υψόμετρο του
 * καθενός και γράφει το πλέγμα στο public/data/relief/<region>.json ως Int16 base64.
 * Ο 3D ζωγράφος (utils/seaMotionGl) το διαβάζει για να σηκώσει βουνά, ακρωτήρια και απέναντι
 * ακτές γύρω από κάθε παραλία της περιοχής.
 *
 * ΠΗΓΕΣ DEM (scripts/lib/upwindDem.mjs, ο ίδιος δειγματολήπτης με τους κριτές ανέμου):
 *   • opentopodata (SRTM 30 μ.) — χωρίς κλειδί. ~1 κλήση/δλ, 100 σημεία η κλήση,
 *     1.000 κλήσεις/ημέρα: η Θεσπρωτία (~64.000 σημεία) θέλει ~640 κλήσεις ≈ 12 λεπτά.
 *   • open-meteo (DEM 90 μ.) — με OPEN_METEO_API_KEY στο περιβάλλον. Χωρίς κλειδί η δωρεάν
 *     πόρτα κλειδώνει στις ~73 κλήσεις την ώρα, οπότε ΔΕΝ διαλέγεται μόνη της.
 *   • terrarium (AWS Terrain Tiles, Mapzen/Tilezen, SRTM+EU-DEM ~30 μ.) — δημόσια πλακίδια PNG
 *     χωρίς κλειδί, ΠΡΟΕΠΙΛΟΓΗ. Zoom 12: ~30 πλακίδια για μια περιοχή, δευτερόλεπτα αντί για λεπτά. Το
 *     ύψος είναι (R·256 + G + B/256) − 32768· η θάλασσα βγαίνει ≤ 0 (βυθομετρία ETOPO1).
 * Η πρόοδος σώζεται σε .cache/relief/<region>/ — αν κοπεί, ξανατρέξε το ίδιο και συνεχίζει.
 *
 * Το αρχείο ΔΕΝ διαβάζεται από καμία απόφαση, χρώμα ή κατάταξη — μόνο από την εικόνα.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElevationSampler } from './lib/upwindDem.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEACHES_DIR = path.join(ROOT, 'public', 'data', 'beaches');
// Δικός του φάκελος, ΟΧΙ μέσα στο coastline/: εκείνον τον καθαρίζει το stripBuildInputsFromDist.
const OUT_DIR = path.join(ROOT, 'public', 'data', 'relief');
const M_PER_DEG_LAT = 111_320;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = process.argv[i + 1];
  return value === undefined || value.startsWith('--') ? true : value;
};

const regionId = arg('region', null);
if (!regionId || regionId === true) {
  console.error('Χρήση: node scripts/bakeBeachRelief.mjs --region <regionId> [--step-m 150] [--margin-km 7] [--dem opentopodata|open-meteo|terrarium] [--refresh]');
  process.exit(1);
}
const stepM = Number(arg('step-m', 150));
const marginKm = Number(arg('margin-km', 7));
const apiKey = process.env.OPEN_METEO_API_KEY?.trim() || null;
// Προεπιλογή terrarium: χωρίς κλειδί, δευτερόλεπτα. Οι άλλες δύο μένουν για διασταύρωση.
const demSource = arg('dem', 'terrarium');
const refresh = process.argv.includes('--refresh');

const beachesPath = path.join(BEACHES_DIR, `${regionId}.json`);
if (!fs.existsSync(beachesPath)) {
  console.error(`Δεν βρέθηκε ${path.relative(ROOT, beachesPath)}`);
  process.exit(1);
}
const beaches = JSON.parse(fs.readFileSync(beachesPath, 'utf8'))
  .filter(b => Number.isFinite(b?.lat) && Number.isFinite(b?.lon));
if (beaches.length === 0) {
  console.error('Η περιοχή δεν έχει παραλίες με συντεταγμένες.');
  process.exit(1);
}

const lats = beaches.map(b => b.lat);
const lons = beaches.map(b => b.lon);
const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
const dLat = stepM / M_PER_DEG_LAT;
const dLon = stepM / mPerDegLon;
const marginLat = (marginKm * 1000) / M_PER_DEG_LAT;
const marginLon = (marginKm * 1000) / mPerDegLon;
const lat0 = Math.min(...lats) - marginLat;
const lon0 = Math.min(...lons) - marginLon;
const rows = Math.ceil((Math.max(...lats) + marginLat - lat0) / dLat) + 1;
const cols = Math.ceil((Math.max(...lons) + marginLon - lon0) / dLon) + 1;

const points = [];
for (let r = 0; r < rows; r += 1) {
  for (let c = 0; c < cols; c += 1) {
    points.push({ lat: lat0 + r * dLat, lon: lon0 + c * dLon });
  }
}

console.error(`Περιοχή ${regionId}: ${beaches.length} παραλίες, πλέγμα ${cols}×${rows} = ${points.length} σημεία ανά ${stepM} μ. (${demSource}).`);
console.error(`  ≈ ${Math.ceil(points.length / 100)} κλήσεις στην πόρτα υψομέτρου.`);

/**
 * AWS Terrain Tiles: ένα πλακίδιο 256×256 zoom 12 ανά ~10 χλμ. Κατεβαίνουν όσα σκεπάζουν το
 * κουτί (με μια σειρά εικονοστοιχείων περιθώριο για τη διγραμμική παρεμβολή), αποκωδικοποιούνται
 * με sharp, και κάθε σημείο του πλέγματος διαβάζεται διγραμμικά από τα τέσσερα γειτονικά.
 */
const fetchTerrarium = async () => {
  const sharp = (await import('sharp')).default;
  const Z = 12;
  const n = 2 ** Z;
  const toTile = (lat, lon) => {
    const x = ((lon + 180) / 360) * n;
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    return [x, y];
  };
  const tiles = new Map();
  const tileDir = path.join(ROOT, '.cache', 'relief', 'terrarium', String(Z));
  fs.mkdirSync(tileDir, { recursive: true });
  const getTile = async (tx, ty) => {
    const key = `${tx}/${ty}`;
    if (tiles.has(key)) return tiles.get(key);
    const file = path.join(tileDir, `${tx}-${ty}.png`);
    let png;
    if (!refresh && fs.existsSync(file)) png = fs.readFileSync(file);
    else {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      png = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, png);
    }
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const heights = new Float32Array(256 * 256);
    for (let i = 0; i < 256 * 256; i += 1) {
      const o = i * info.channels;
      heights[i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
    }
    tiles.set(key, heights);
    return heights;
  };
  const pixel = async (px, py) => {
    const tx = Math.floor(px / 256);
    const ty = Math.floor(py / 256);
    const tile = await getTile(tx, ty);
    return tile[(py - ty * 256) * 256 + (px - tx * 256)];
  };
  const out = new Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = toTile(points[i].lat, points[i].lon);
    const px = x * 256 - 0.5;
    const py = y * 256 - 0.5;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;
    const h00 = await pixel(x0, y0);
    const h01 = await pixel(x0 + 1, y0);
    const h10 = await pixel(x0, y0 + 1);
    const h11 = await pixel(x0 + 1, y0 + 1);
    out[i] = (h00 * (1 - fx) + h01 * fx) * (1 - fy) + (h10 * (1 - fx) + h11 * fx) * fy;
    if (i % 20000 === 0) console.error(`  ${i}/${points.length} σημεία, ${tiles.size} πλακίδια`);
  }
  console.error(`  ${tiles.size} πλακίδια terrarium.`);
  return out;
};

let elevations;
if (demSource === 'terrarium') {
  elevations = await fetchTerrarium();
} else {
  const cacheDir = path.join(ROOT, '.cache', 'relief', regionId);
  const sampler = createElevationSampler({ cacheDir, apiKey, demSource, refresh });
  elevations = await sampler.fetchElevationsResumable(points);
}

const heights = new Int16Array(points.length);
let maxM = -Infinity;
let landCount = 0;
elevations.forEach((m, i) => {
  const v = Number.isFinite(m) ? Math.max(-32768, Math.min(32767, Math.round(m))) : 0;
  heights[i] = v;
  if (v > maxM) maxM = v;
  if (v > 0) landCount += 1;
});

const bytes = Buffer.from(heights.buffer, heights.byteOffset, heights.byteLength);
const out = {
  v: 1,
  region: regionId,
  generatedAt: new Date().toISOString(),
  demSource,
  stepM,
  marginKm,
  lat0: Number(lat0.toFixed(6)),
  lon0: Number(lon0.toFixed(6)),
  dLat: Number(dLat.toFixed(8)),
  dLon: Number(dLon.toFixed(8)),
  rows,
  cols,
  heights: bytes.toString('base64'),
};
fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `${regionId}.json`);
fs.writeFileSync(outPath, JSON.stringify(out));
console.error(`✅ ${path.relative(ROOT, outPath)} — ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB, ψηλότερο σημείο ${maxM} μ., στεριά ${((100 * landCount) / points.length).toFixed(0)}%.`);
