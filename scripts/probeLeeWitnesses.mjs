#!/usr/bin/env node
/**
 * ΤΟ ΑΝΑΓΛΥΦΟ ΑΝΑΝΤΗ ΣΤΙΣ ΔΥΟ ΠΑΡΑΛΙΕΣ ΠΟΥ ΓΕΝΝΗΣΑΝ ΤΗΝ ΕΡΩΤΗΣΗ — Βάι, Λιβάδια Παροικιάς.
 *
 * Δεν αποδεικνύει τίποτα από μόνο του: δύο παραλίες δεν είναι δείγμα. Υπάρχει για να απαντηθεί
 * το ένα ερώτημα που ΔΕΝ απαντά η μέτρηση των σταθμών — «μοιάζει το ανάγλυφο ανάντη αυτών των
 * παραλιών με ό,τι είδαν τα αεροδρόμια, ή είναι έξω από το εύρος τους;». Αν είναι έξω, ό,τι
 * μετρήθηκε στους σταθμούς ΔΕΝ επεκτείνεται εδώ, και αυτό πρέπει να γραφτεί.
 *
 *   node scripts/probeLeeWitnesses.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLOTS = 24, STEP_DEG = 15, SAMPLE_STEP_KM = 0.4, SAMPLE_MAX_KM = 4.0;
const SAMPLES = Math.round(SAMPLE_MAX_KM / SAMPLE_STEP_KM);
const EARTH_RADIUS_KM = 6371;

const WITNESSES = [
  { id: 730, name: 'Βάι', lat: 35.25459, lon: 26.26516, windFromDeg: 297, shown: '5 Μπφ' },
  { id: 2033, name: 'Λιβάδια Παροικιάς', lat: 37.09343, lon: 25.15494, windFromDeg: 7, shown: '4-5 Μπφ' },
];

const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;
const destinationPoint = (from, bearingDeg, distanceKm) => {
  const angular = distanceKm / EARTH_RADIUS_KM, bearing = toRad(bearingDeg);
  const lat1 = toRad(from.lat), lon1 = toRad(from.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const demBatch = async (batch) => {
  const locations = batch.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('%7C');
  const text = execFileSync('curl', ['-s', '--max-time', '90', '--retry', '2', '--retry-delay', '2',
    `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const json = JSON.parse(text);
  if (!Array.isArray(json?.results)) throw new Error(json?.error || 'opentopodata: χωρίς results');
  return json.results.map(r => (Number.isFinite(r.elevation) ? r.elevation : 0));
};

const out = [];
for (const w of WITNESSES) {
  const points = [{ lat: w.lat, lon: w.lon }];
  for (let slot = 0; slot < SLOTS; slot++) {
    for (let s = 1; s <= SAMPLES; s++) points.push(destinationPoint(w, slot * STEP_DEG, s * SAMPLE_STEP_KM));
  }
  const elevations = [];
  for (let i = 0; i < points.length; i += 100) {
    elevations.push(...await demBatch(points.slice(i, i + 100)));
    await sleep(1100);
  }
  const selfM = elevations[0];
  const rays = Array.from({ length: SLOTS }, (_, slot) => elevations.slice(1 + slot * SAMPLES, 1 + (slot + 1) * SAMPLES));
  const reliefFor = (fromDeg, radiusKm, windowDeg = 45) => {
    const steps = Math.round(radiusKm / SAMPLE_STEP_KM);
    const vals = [];
    for (let o = -windowDeg; o <= windowDeg; o += STEP_DEG) {
      const slot = ((Math.round((fromDeg + o) / STEP_DEG) % SLOTS) + SLOTS) % SLOTS;
      vals.push(Math.max(...rays[slot].slice(0, steps)) - selfM);
    }
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const row = {
    id: w.id, name: w.name, windFromDeg: w.windFromDeg, shown: w.shown, selfM,
    reliefM: { 1: Math.round(reliefFor(w.windFromDeg, 1)), 2: Math.round(reliefFor(w.windFromDeg, 2)), 4: Math.round(reliefFor(w.windFromDeg, 4)) },
    profileAlongWind: rays[((Math.round(w.windFromDeg / STEP_DEG) % SLOTS) + SLOTS) % SLOTS],
  };
  out.push(row);
  console.log(`\n${w.name} #${w.id} — τυπώναμε ${w.shown}, άνεμος από ${w.windFromDeg}°`);
  console.log(`  υψόμετρο πινέζας: ${selfM} μ.`);
  console.log(`  ανάγλυφο ανάντη (μέσος ±45°): 1 χλμ ${row.reliefM[1]} μ. · 2 χλμ ${row.reliefM[2]} μ. · 4 χλμ ${row.reliefM[4]} μ.`);
  console.log(`  προφίλ πάνω στη γωνία του ανέμου (κάθε 400 μ.): ${row.profileAlongWind.join(' → ')}`);
}
const outPath = path.join(root, 'reports', 'weather', 'lee-wind-witnesses.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ note: 'Ανάγλυφο ανάντη στις δύο παραλίες-μάρτυρες (24/08/2026). ΔΕΝ είναι δείγμα — δες scripts/measureLeeWindBias.mjs.', dem: 'opentopodata/srtm30m', witnesses: out }, null, 2));
console.log(`\nγράφτηκε ${path.relative(root, outPath)}`);
