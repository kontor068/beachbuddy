#!/usr/bin/env node
/**
 * ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΔΕΙΧΝΟΥΝ ΚΥΜΑ ΠΟΥ ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΦΕΥΓΕΙ ΑΠΟ ΑΥΤΕΣ — εθνική μέτρηση, όχι αλλαγή.
 *
 * Αφορμή: Ελαφονήσι 15/08/2026 16:00, ζωντανή κάμερα με ρηχό ήρεμο νερό και η κάρτα να λέει
 * 0,7 μ. Μετρήθηκε: η ανοιχτή θάλασσα 10 χλμ ΝΝΑ έδινε 1,22 μ., από τα οποία 1,14 μ. ΚΥΜΑ ΑΝΕΜΟΥ
 * ερχόμενο από 356°. Η παραλία κοιτάει 159,3°, άρα onshore −0,958: όλο το κύμα ΕΦΕΥΓΕ. Το κελί
 * μέτρησης είναι 10 χλμ ΚΑΤΑΝΤΗ του ανέμου.
 *
 * Είναι ΓΝΩΣΤΗ κατηγορία, γραμμένη στο utils/shoreWave.ts:110-122 (Άγιος Προκόπιος Νάξου, 10/08):
 * «κάθε συστατικό εκείνου του 1,1 μ. ταξίδευε ΜΑΚΡΙΑ από την παραλία, μετρημένο σε κελί 7,66 χλμ
 * κατάντη». Η τότε διόρθωση κάλυψε την ΑΠΟΘΑΛΑΣΣΙΑ. Δεν κάλυψε το ΚΥΜΑ ΑΝΕΜΟΥ — και εδώ αυτό
 * είναι το 93% του αριθμού.
 *
 * ΤΙ ΜΕΤΡΑΕΙ: αν ο κανόνας γινόταν «όταν ΚΑΘΕ μετρημένο συστατικό της θάλασσας φεύγει από την
 * ακτή, τύπωσε το δικό μας μοντέλο ακτής αντί για το κελί κατάντη», πόσες παραλίες αλλάζουν και
 * πόσο — και, κυρίως, πόσες θα γίνονταν ΨΕΥΔΩΣ ΗΡΕΜΕΣ, που είναι η σκανδάλη #1 της §9.
 *
 * Δύο κατώφλια, με το λεξιλόγιο που ήδη υπάρχει:
 *   −0,5  SHORE_RAMP_SILENT_ONSHORE   (εκεί αρχίζει σήμερα η ράμπα ακτής)
 *   −0,8  OFFSHORE_FLAT_MAX_ONSHORE   (εκεί δίνεται πλήρες βάρος)
 *
 *   node scripts/measureDepartingSeaNationally.mjs [ώρα]
 *
 * Ζωντανά στο πληρωμένο Open-Meteo· το κλειδί έρχεται από το Netlify και ΔΕΝ γράφεται πουθενά.
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

const shoreWave = require(path.join(root, 'utils/shoreWave.ts'));
const waveModel = require(path.join(root, 'utils/waveModel.ts'));
const windExposure = require(path.join(root, 'utils/windExposure.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const HOUR = process.argv[2] !== undefined ? Number(process.argv[2]) : new Date().getHours();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const API_KEY = (((await (await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${token}` } })).json()).values) || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('χωρίς κλειδί'); process.exit(1); }
console.log('κλειδί: OK (δεν τυπώνεται) · ώρα', HOUR + ':00');

const getJson = async url => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const payload = await (await fetch(`${url}&apikey=${encodeURIComponent(API_KEY)}`)).json();
      if (!payload?.error) return payload;
      await sleep(15000);
    } catch { await sleep(5000); }
  }
  return null;
};

// ---- παραλίες, συστάδες, γεωμετρία ----------------------------------------------------------
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beaches = [];
const windPoints = new Map();
const seaPoints = new Map();
const pkey = (lat, lon) => `${lat.toFixed(4)}_${lon.toFixed(4)}`;

for (const file of fs.readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const region = file.replace('.json', '');
  const list = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island?.beaches;
  if (!Array.isArray(list) || !list.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  for (const cluster of buildBeachForecastClusters(list)) {
    windPoints.set(pkey(cluster.lat, cluster.lon), { lat: cluster.lat, lon: cluster.lon });
    for (const id of cluster.beachIds) {
      const profile = profiles[String(id)];
      if (!profile || profile.confidence !== 'high') continue;
      const mp = profile.marineSamplePoint;
      if (!mp || typeof profile.facingDeg !== 'number') continue;
      seaPoints.set(pkey(mp.lat, mp.lon), { lat: mp.lat, lon: mp.lon });
      const beach = list.find(b => b.id === id);
      beaches.push({
        id, region, profile,
        name: typeof beach?.name === 'string' ? beach.name : (beach?.name?.gr || ''),
        windKey: pkey(cluster.lat, cluster.lon),
        seaKey: pkey(mp.lat, mp.lon),
      });
    }
  }
}
console.log(`παραλίες high: ${beaches.length} · σημεία ανέμου: ${windPoints.size} · σημεία θάλασσας: ${seaPoints.size}`);

const fetchAll = async (points, host, query, label) => {
  const out = new Map();
  const list = [...points.values()];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const payload = await getJson(`${host}?latitude=${chunk.map(p => p.lat).join(',')}`
      + `&longitude=${chunk.map(p => p.lon).join(',')}&${query}&timezone=Europe%2FAthens&forecast_days=1`);
    if (!Array.isArray(payload)) { console.error(`\n${label}: αποτυχία στο ${i}`); process.exit(1); }
    chunk.forEach((p, k) => out.set(pkey(p.lat, p.lon), payload[k]));
    process.stdout.write(`\r  ${label} ${out.size}/${list.length}`);
  }
  console.log('');
  return out;
};

const wind = await fetchAll(windPoints, 'https://customer-api.open-meteo.com/v1/forecast',
  'hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms', 'άνεμος');
const sea = await fetchAll(seaPoints, 'https://customer-marine-api.open-meteo.com/v1/marine',
  'hourly=wave_height,wave_period,wave_direction,wind_wave_height,wind_wave_direction,'
  + 'swell_wave_height,swell_wave_direction&cell_selection=sea', 'θάλασσα');

// ---- η μέτρηση -------------------------------------------------------------------------------
const onshoreOf = (fromDeg, facingDeg) => Math.cos((fromDeg - facingDeg) * Math.PI / 180);
const MIN_COMPONENT_M = 0.15;   // κάτω από αυτό το συστατικό δεν κρίνει τίποτα

// ΜΙΑ ΛΗΨΗ, ΟΛΗ Η ΜΕΡΑ. Το Open-Meteo επιστρέφει και τις 24 ώρες σε κάθε κλήση, οπότε μετρώντας
// μία ώρα τη φορά πληρώναμε 16 φορές τα ίδια δεδομένα — και, χειρότερα, βγάζαμε συμπέρασμα από
// μία στιγμή. Οι ώρες κολύμβησης είναι 07:00-20:00· έξω από αυτές δεν ενδιαφέρει κανέναν.
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const perHour = [];
const everChanged = new Map();

const measureHour = HOUR => {
const rows = [];
let arriving = 0;
let noDirection = 0;

for (const b of beaches) {
  const w = wind.get(b.windKey)?.hourly;
  const s = sea.get(b.seaKey)?.hourly;
  if (!w || !s) continue;
  const openM = s.wave_height[HOUR];
  if (typeof openM !== 'number' || openM <= 0) continue;

  const facing = b.profile.facingDeg;
  const speedKmh = w.wind_speed_10m[HOUR] * 3.6;
  const windDir = w.wind_direction_10m[HOUR];
  const sector = b.profile.sectors?.[windExposure.windSectorFromDegrees(windDir)];
  if (!sector || typeof sector.fetchKm !== 'number') continue;

  // ΔΥΟ ΠΑΡΑΛΛΑΓΕΣ, γιατί το κόστος τις χωρίζει:
  //   Β = ΜΟΝΟ όσα ζητάει ΗΔΗ η εφαρμογή (συνολικό κύμα + αποθαλασσιά)
  //   Α = και το κύμα ανέμου ξεχωριστά, που θα κόστιζε +30% σε κάθε κλήση θάλασσας
  // Αν οι δύο δίνουν το ίδιο σύνολο παραλιών, η ακριβή παραλλαγή δεν αγοράζει τίποτα.
  const partsB = [
    { name: 'κύμα', h: s.wave_height[HOUR], d: s.wave_direction[HOUR] },
    { name: 'αποθαλασσιά', h: s.swell_wave_height[HOUR], d: s.swell_wave_direction[HOUR] },
  ].filter(p => typeof p.h === 'number' && p.h >= MIN_COMPONENT_M);
  const partsA = [...partsB, { name: 'ανέμου', h: s.wind_wave_height[HOUR], d: s.wind_wave_direction[HOUR] }]
    .filter(p => typeof p.h === 'number' && p.h >= MIN_COMPONENT_M);

  if (partsA.some(p => typeof p.d !== 'number') || partsB.some(p => typeof p.d !== 'number')) { noDirection += 1; continue; }
  if (!partsB.length) continue;

  const worstOnshore = Math.max(...partsA.map(p => onshoreOf(p.d, facing)));
  const worstOnshoreB = Math.max(...partsB.map(p => onshoreOf(p.d, facing)));
  if (worstOnshore > -0.5) { arriving += 1; continue; }

  // Ο άνεμος πρέπει ΚΙ ΑΥΤΟΣ να είναι απόγειος — αλλιώς χτίζει τοπικά κύμα που το κελί δεν είδε.
  const windOnshore = onshoreOf(windDir, facing);
  if (windOnshore > -0.5) { arriving += 1; continue; }

  const smb = waveModel.estimateFetchLimitedWaveHeightM({ windSpeedKmh: speedKmh, fetchKm: sector.fetchKm });
  const proposed = Number(Math.max(shoreWave.SHORE_DISPLAY_FLOOR_M, Math.min(smb, openM)).toFixed(2));
  const speaksToday = typeof shoreWave.estimateShoreWaveHeightM({
    openWaterWaveHeightM: openM, windSpeedKmh: speedKmh, sector, confidence: 'high', arrivingSwellPresent: false,
  }) === 'number';

  rows.push({
    ...b, openM, proposed, smb, speedKmh, worstOnshore, worstOnshoreB, windOnshore,
    fetchKm: sector.fetchKm, blocked: sector.blockedRayRatio, level: sector.level, speaksToday,
    strict: worstOnshore <= -0.8 && windOnshore <= -0.8,
    strictB: worstOnshoreB <= -0.8 && windOnshore <= -0.8,
  });
}

  const changed = rows.filter(r => r.proposed < r.openM && !r.speaksToday);
  return { HOUR, arriving, noDirection, candidates: rows.length, changed, strict: changed.filter(r => r.strict), rows };
};

const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : 0);
const cross = (arr, t) => arr.filter(r => r.openM >= t && r.proposed < t).length;

console.log(`\n============ ΟΛΗ Η ΜΕΡΑ, ΩΡΑ ΠΡΟΣ ΩΡΑ (${beaches.length} παραλίες) ============`);
console.log('ώρα   έρχεται  φεύγουν  αλλάζουν(≤−0,5)  ΑΥΣΤΗΡΟ(≤−0,8)  διάμ.πτώση  <0,50μ');
for (const HOUR of HOURS) {
  const r = measureHour(HOUR);
  perHour.push(r);
  const ds = r.strict.map(x => x.openM - x.proposed).sort((a, b) => a - b);
  console.log(`${String(HOUR).padStart(2)}:00 ${String(r.arriving).padStart(8)} ${String(r.candidates).padStart(8)} ${String(r.changed.length).padStart(14)} ${String(r.strict.length).padStart(14)} ${(ds.length ? q(ds, 0.5).toFixed(2) : '—').padStart(11)} ${String(cross(r.strict, 0.5)).padStart(7)}`);
  for (const row of r.strict) {
    const prev = everChanged.get(row.id);
    const drop = row.openM - row.proposed;
    if (!prev || drop > prev.drop) everChanged.set(row.id, { ...row, drop, hour: HOUR });
  }
}

const allStrict = perHour.flatMap(r => r.strict);
const allStrictB = perHour.flatMap(r => r.changed.filter(x => x.strictB));
const setA = new Set(allStrict.map(r => r.id));
const setB = new Set(allStrictB.map(r => r.id));
console.log(`
ΠΑΡΑΛΛΑΓΗ Α (με ξεχωριστό κύμα ανέμου, +30% κόστος): ${allStrict.length} ώρες×παραλία, ${setA.size} παραλίες`);
console.log(`ΠΑΡΑΛΛΑΓΗ Β (μόνο ό,τι ήδη ζητάμε, +0 κόστος):      ${allStrictB.length} ώρες×παραλία, ${setB.size} παραλίες`);
console.log(`  παραλίες μόνο στην Α: ${[...setA].filter(x => !setB.has(x)).join(', ') || 'καμία'}`);
console.log(`  παραλίες μόνο στη Β:  ${[...setB].filter(x => !setA.has(x)).join(', ') || 'καμία'}`);
const allLoose = perHour.flatMap(r => r.changed);
const dropsStrict = allStrict.map(r => r.openM - r.proposed).sort((a, b) => a - b);
console.log(`\nΣΥΝΟΛΟ ΗΜΕΡΑΣ (14 ώρες κολύμβησης)`);
console.log(`  ώρες×παραλία που αλλάζουν, χαλαρό ≤−0,5   ${allLoose.length}`);
console.log(`  ώρες×παραλία που αλλάζουν, ΑΥΣΤΗΡΟ ≤−0,8  ${allStrict.length}`);
console.log(`  ΔΙΑΚΡΙΤΕΣ παραλίες που αγγίζονται (αυστηρό) ${everChanged.size}`);
if (dropsStrict.length) {
  console.log(`  πτώση: διάμεσος ${q(dropsStrict, 0.5).toFixed(2)} · p90 ${q(dropsStrict, 0.9).toFixed(2)} · μέγιστη ${dropsStrict[dropsStrict.length - 1].toFixed(2)} μ.`);
  console.log(`  περνάνε κάτω από 0,50 μ. ${cross(allStrict, 0.5)} · 0,80 μ. ${cross(allStrict, 0.8)} · 1,20 μ. ${cross(allStrict, 1.2)}`);
}
const toFloor = allStrict.filter(r => r.proposed <= 0.11 && r.openM >= 1);
console.log(`  ⚠ πέφτουν από ≥1,00 μ. κατευθείαν στο δάπεδο 0,10 μ.: ${toFloor.length}`);

console.log('\nΟΙ ΠΑΡΑΛΙΕΣ ΠΟΥ ΑΓΓΙΖΟΝΤΑΙ (αυστηρό), με τη ΜΕΓΑΛΥΤΕΡΗ πτώση της μέρας:');
[...everChanged.values()].sort((a, b) => b.drop - a.drop).forEach(r =>
  console.log(`  #${String(r.id).padEnd(5)} ${r.name.slice(0, 22).padEnd(23)} ${String(r.hour).padStart(2)}:00  ${r.openM.toFixed(2)} → ${r.proposed.toFixed(2)} μ.`
    + ` · κύμα ${r.worstOnshore.toFixed(2)} · άνεμος ${r.windOnshore.toFixed(2)} · άνοιγμα ${r.fetchKm} · ${r.level}`));

const elafHours = perHour.filter(r => r.strict.some(x => x.id === 595)).map(r => r.HOUR);
console.log(`\nΕΛΑΦΟΝΗΣΙ: αλλάζει σε ${elafHours.length} από 14 ώρες${elafHours.length ? ` (${elafHours.join(', ')})` : ''}`);

fs.mkdirSync(path.join(root, 'reports/departing-sea'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/departing-sea/day.json'),
  JSON.stringify({
    measuredAt: new Date().toISOString(), beaches: beaches.length,
    perHour: perHour.map(r => ({ hour: r.HOUR, arriving: r.arriving, candidates: r.candidates, changed: r.changed.length, strict: r.strict.length })),
    distinctStrict: [...everChanged.values()],
  }, null, 2), 'utf8');
console.log('\nγράφτηκε reports/departing-sea/day.json');
