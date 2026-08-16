#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΑΝ Ο ΑΡΙΘΜΟΣ ΤΗΣ ΑΚΤΗΣ ΜΙΛΗΣΕΙ ΚΑΙ ΜΕ ΜΕΓΑΛΟ ΑΝΟΙΓΜΑ — μέτρηση, όχι αλλαγή.
 *
 * Αφορμή: Ελαφονήσι 15/08/2026 16:00. Βοριάς 356°, η παραλία κοιτάει 159° — τελείως απόγειος
 * (onshore −0,935, ένταση 2,1/100) — και η κάρτα τύπωνε 0,7 μ. Αιτία: utils/shoreWave.ts:158
 * σωπαίνει τον υπολογισμό της ακτής όταν fetchKm > 0,5, οπότε τυπώνεται το νούμερο της ανοιχτής
 * θάλασσας. Το δικό μας SMB δίνει ~0,45 μ. εκεί.
 *
 * ΠΡΟΣΟΧΗ — ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΕΡΩΤΗΜΑΤΑ, ΜΗΝ ΜΠΕΡΔΕΥΤΟΥΝ:
 *   (α) να ανάβει το ΧΡΩΜΑ «λάδι» (utils/offshoreFlatWater.sectorHoldsNoWindWave) — ΜΕΤΡΗΘΗΚΕ
 *       ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ: 25 από 41 περιπτώσεις θα δήλωναν λάδι εκεί που το ΔΙΚΟ ΜΑΣ μοντέλο
 *       δίνει 0,30-0,67 μ. Αυτό είναι ψεύτικη ηρεμία, σκανδάλη #1 της §9.
 *   (β) να μιλάει ο ΑΡΙΘΜΟΣ της ακτής (utils/shoreWave.estimateShoreWaveHeightM) — αυτό μετράει
 *       το παρόν αρχείο. Δεν δηλώνει λάδι: βγάζει σταθμισμένο ύψος και έχει φραγμό στη γραμμή 176
 *       που ΑΠΑΓΟΡΕΥΕΙ να ξεπεράσει το νούμερο της ανοιχτής θάλασσας.
 *
 * Τρέχει ΖΩΝΤΑΝΑ στο πληρωμένο Open-Meteo (το κλειδί έρχεται από το Netlify, δεν γράφεται
 * πουθενά), πάνω στις ΠΡΑΓΜΑΤΙΚΕΣ συστάδες και την ΠΡΑΓΜΑΤΙΚΗ γεωμετρία.
 *
 *   node scripts/measureShoreWaveFetchGate.mjs
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};

const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const shoreWave = require(path.join(root, 'utils/shoreWave.ts'));
const offshore = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const waveModel = require(path.join(root, 'utils/waveModel.ts'));
const swellExposure = require(path.join(root, 'utils/swellExposure.ts'));
const windSector = require(path.join(root, 'utils/windExposure.ts'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- κλειδί από το Netlify, στη μνήμη μόνο -------------------------------------------------
const netlifyToken = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
if (!netlifyToken) { console.error('Χωρίς NETLIFY_AUTH_TOKEN στο .env'); process.exit(1); }
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${netlifyToken}` } });
if (!envRes.ok) { console.error('Netlify env API', envRes.status); process.exit(1); }
const record = await envRes.json();
const API_KEY = (record.values || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('Το OPEN_METEO_API_KEY δεν έχει τιμή'); process.exit(1); }
console.log('κλειδί: OK (δεν τυπώνεται)');

const WIND_HOST = 'https://customer-api.open-meteo.com';
const MARINE_HOST = 'https://customer-marine-api.open-meteo.com';

const getJson = async url => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const payload = await (await fetch(`${url}&apikey=${encodeURIComponent(API_KEY)}`)).json();
      if (!payload?.error) return payload;
      await sleep(20000);
    } catch { await sleep(5000); }
  }
  return null;
};

// ---- παραλίες + γεωμετρία -------------------------------------------------------------------
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

const beaches = [];
const clusterPoints = new Map();
for (const file of fs.readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const region = file.replace('.json', '');
  const list = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island?.beaches;
  if (!Array.isArray(list) || !list.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* ok */ }
  for (const cluster of buildBeachForecastClusters(list)) {
    const key = `${cluster.lat.toFixed(4)}_${cluster.lon.toFixed(4)}`;
    clusterPoints.set(key, { lat: cluster.lat, lon: cluster.lon });
    for (const id of cluster.beachIds) {
      const profile = profiles[String(id)];
      if (!profile || profile.confidence !== 'high') continue;
      const beach = list.find(b => b.id === id);
      beaches.push({ id, region, name: typeof beach?.name === 'string' ? beach.name : (beach?.name?.gr || ''), profile, windKey: key });
    }
  }
}
console.log(`παραλίες με γεωμετρία high: ${beaches.length} · σημεία ανέμου: ${clusterPoints.size}`);

// ---- ζωντανός άνεμος ------------------------------------------------------------------------
const points = [...clusterPoints.values()];
const windByKey = new Map();
const CHUNK = 100;
for (let i = 0; i < points.length; i += CHUNK) {
  const chunk = points.slice(i, i + CHUNK);
  const payload = await getJson(`${WIND_HOST}/v1/forecast?latitude=${chunk.map(p => p.lat).join(',')}`
    + `&longitude=${chunk.map(p => p.lon).join(',')}&hourly=wind_speed_10m,wind_direction_10m`
    + `&wind_speed_unit=ms&timezone=Europe%2FAthens&forecast_days=1`);
  if (!Array.isArray(payload)) { console.error('ο άνεμος δεν ήρθε στο', i); process.exit(1); }
  chunk.forEach((p, k) => windByKey.set(`${p.lat.toFixed(4)}_${p.lon.toFixed(4)}`, payload[k]));
  process.stdout.write(`\r  άνεμος ${windByKey.size}/${points.length}`);
}
console.log('');

const HOUR = new Date().getHours();

// ---- ποιες παραλίες μπλοκάρονται ΜΟΝΟ από το άνοιγμα ----------------------------------------
const candidates = [];
for (const b of beaches) {
  const wind = windByKey.get(b.windKey);
  if (!wind?.hourly) continue;
  const speedKmh = wind.hourly.wind_speed_10m[HOUR] * 3.6;
  const dirDeg = wind.hourly.wind_direction_10m[HOUR];
  const sectorKey = windSector.windSectorFromDegrees(dirDeg);
  const sector = b.profile.sectors?.[sectorKey];
  if (!sector) continue;
  if ((sector.blockedRayRatio ?? 0) < offshore.OFFSHORE_FLAT_MIN_BLOCKED_RATIO) continue;
  if (typeof sector.onshore !== 'number' || sector.onshore >= shoreWave.SHORE_RAMP_SILENT_ONSHORE) continue;
  if (sector.fetchKm <= offshore.OFFSHORE_FLAT_MAX_FETCH_KM) continue;   // ήδη μιλάει σήμερα
  const marine = b.profile.marineSamplePoint;
  if (!marine) continue;
  candidates.push({ ...b, speedKmh, dirDeg, sectorKey, sector, marine });
}
console.log(`υποψήφιες ΤΩΡΑ (μπλοκαρισμένες μόνο από το άνοιγμα): ${candidates.length}`);
if (!candidates.length) { console.log('καμία αυτή την ώρα — ξανατρέξε άλλη ώρα.'); process.exit(0); }

// ---- θάλασσα στα σημεία τους ----------------------------------------------------------------
const marineKey = m => `${m.lat.toFixed(4)}_${m.lon.toFixed(4)}`;
const marinePoints = [...new Map(candidates.map(c => [marineKey(c.marine), c.marine])).values()];
const marineByKey = new Map();
for (let i = 0; i < marinePoints.length; i += CHUNK) {
  const chunk = marinePoints.slice(i, i + CHUNK);
  const payload = await getJson(`${MARINE_HOST}/v1/marine?latitude=${chunk.map(p => p.lat).join(',')}`
    + `&longitude=${chunk.map(p => p.lon).join(',')}&hourly=wave_height,wave_period,wave_direction,`
    + `swell_wave_height,swell_wave_period,swell_wave_direction&timezone=Europe%2FAthens&forecast_days=1&cell_selection=sea`);
  if (!Array.isArray(payload)) { console.error('η θάλασσα δεν ήρθε στο', i); process.exit(1); }
  chunk.forEach((p, k) => marineByKey.set(marineKey(p), payload[k]));
  process.stdout.write(`\r  θάλασσα ${marineByKey.size}/${marinePoints.length}`);
}
console.log('');

// ---- η ουρά της estimateShoreWaveHeightM ΧΩΡΙΣ την πύλη ανοίγματος --------------------------
// Αντιγράφονται ΜΟΝΟ οι γραμμές 161-178 και αυτοαποδεικνύεται παρακάτω: όπου η αληθινή
// συνάρτηση μιλάει (άνοιγμα ≤ 0,5) η αντιγραφή πρέπει να δίνει ΤΟ ΙΔΙΟ νούμερο.
const proposedShoreM = ({ openWaterWaveHeightM, windSpeedKmh, sector }) => {
  const weight = shoreWave.shoreRampWeight(sector.onshore);
  const modelledM = waveModel.estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm: sector.fetchKm });
  const blendedM = weight * modelledM + (1 - weight) * openWaterWaveHeightM;
  const rounded = Number(Math.max(shoreWave.SHORE_DISPLAY_FLOOR_M, blendedM).toFixed(2));
  return rounded >= openWaterWaveHeightM ? undefined : rounded;
};

let selfProved = 0;
let selfFailed = 0;
for (const b of beaches.slice(0, 4000)) {
  const s = b.profile.sectors?.N;
  if (!s || typeof s.onshore !== 'number' || s.fetchKm > offshore.OFFSHORE_FLAT_MAX_FETCH_KM) continue;
  if ((s.blockedRayRatio ?? 0) < offshore.OFFSHORE_FLAT_MIN_BLOCKED_RATIO || s.onshore >= shoreWave.SHORE_RAMP_SILENT_ONSHORE) continue;
  const real = shoreWave.estimateShoreWaveHeightM({ openWaterWaveHeightM: 0.9, windSpeedKmh: 30, sector: s, confidence: 'high' });
  const mine = proposedShoreM({ openWaterWaveHeightM: 0.9, windSpeedKmh: 30, sector: s });
  if (real === mine) selfProved += 1; else { selfFailed += 1; }
}
console.log(`αυτοέλεγχος αντιγραφής: ${selfProved} ίδια, ${selfFailed} διαφορετικά`);
if (selfFailed) { console.error('Η αντιγραφή δεν συμφωνεί με την αληθινή συνάρτηση — άκυρη μέτρηση.'); process.exit(1); }

// ---- η μέτρηση ------------------------------------------------------------------------------
const rows = [];
for (const c of candidates) {
  const marine = marineByKey.get(marineKey(c.marine));
  if (!marine?.hourly) continue;
  const openM = marine.hourly.wave_height[HOUR];
  if (typeof openM !== 'number') continue;

  const swell = swellExposure.assessSwellExposure(c.profile, c.profile.facingDeg, {
    swellHeightM: marine.hourly.swell_wave_height[HOUR],
    swellPeriodS: marine.hourly.swell_wave_period[HOUR],
    swellDirectionDeg: marine.hourly.swell_wave_direction[HOUR],
  });
  if (swell?.exposed) { rows.push({ ...c, openM, silencedBySwell: true }); continue; }

  const now = shoreWave.estimateShoreWaveHeightM({
    openWaterWaveHeightM: openM, windSpeedKmh: c.speedKmh, sector: c.sector, confidence: 'high',
    arrivingSwellPresent: false,
  });
  const after = proposedShoreM({ openWaterWaveHeightM: openM, windSpeedKmh: c.speedKmh, sector: c.sector });
  rows.push({ ...c, openM, now, after, silencedBySwell: false });
}

const speaking = rows.filter(r => !r.silencedBySwell && typeof r.after === 'number');
const bySwell = rows.filter(r => r.silencedBySwell);
console.log(`\n================ ΑΠΟΤΕΛΕΣΜΑ (ώρα ${HOUR}:00) ================`);
console.log(`υποψήφιες                                   ${rows.length}`);
console.log(`  σωπαίνουν ΕΤΣΙ ΚΙ ΑΛΛΙΩΣ (αποθαλασσιά)    ${bySwell.length}`);
console.log(`  θα ΑΡΧΙΖΑΝ να μιλάνε                       ${speaking.length}`);
console.log(`  σήμερα μιλάει καμία από αυτές;             ${rows.filter(r => typeof r.now === 'number').length}`);

const drops = speaking.map(r => r.openM - r.after).sort((a, b) => a - b);
if (drops.length) {
  const q = p => drops[Math.min(drops.length - 1, Math.floor(p * drops.length))];
  console.log(`\nΠΤΩΣΗ ΤΟΥ ΤΥΠΩΜΕΝΟΥ ΑΡΙΘΜΟΥ (μ.): διάμεσος ${q(0.5).toFixed(2)} · p90 ${q(0.9).toFixed(2)} · μέγιστη ${drops[drops.length - 1].toFixed(2)}`);
  const cross = t => speaking.filter(r => r.openM >= t && r.after < t).length;
  console.log(`ΠΕΡΝΑΝΕ ΚΑΤΩ ΑΠΟ ΚΑΤΩΦΛΙ ΑΠΟΦΑΣΗΣ:  0,50 μ. → ${cross(0.5)} · 0,80 μ. → ${cross(0.8)} · 1,20 μ. → ${cross(1.2)}`);
  console.log('\nοι 15 μεγαλύτερες πτώσεις:');
  speaking.sort((a, b) => (b.openM - b.after) - (a.openM - a.after)).slice(0, 15).forEach(r =>
    console.log(`  #${String(r.id).padEnd(5)} ${r.name.slice(0, 20).padEnd(21)} [${r.sectorKey.padEnd(3)}] άνοιγμα ${String(r.sector.fetchKm).padStart(6)} onshore ${String(r.sector.onshore).padStart(7)}  ${r.openM.toFixed(2)} → ${r.after.toFixed(2)} μ.`));
}
const elafonisi = rows.find(r => String(r.id) === '595');
console.log(`\nΕΛΑΦΟΝΗΣΙ: ${elafonisi ? (elafonisi.silencedBySwell ? 'σωπαίνει από αποθαλασσιά' : `${elafonisi.openM.toFixed(2)} → ${elafonisi.after?.toFixed(2) ?? 'σιωπή'} μ.`) : 'δεν είναι υποψήφια αυτή την ώρα'}`);
