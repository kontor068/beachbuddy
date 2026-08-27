#!/usr/bin/env node
/**
 * ΑΝ Η «ΑΠΑΝΕΜΗ» ΑΠΑΙΤΟΥΣΕ Ο ΑΝΕΜΟΣ ΝΑ ΕΧΕΙ ΕΡΘΕΙ ΠΑΝΩ ΑΠΟ ΣΤΕΡΙΑ, ΠΟΣΕΣ ΛΕΞΕΙΣ ΘΑ ΓΥΡΙΖΑΝ;
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ (27/08/2026, Γλυφάδα Νάξου #1993, 09:00). Σχόλιο επισκέπτη: «είχε πιο πολύ
 * άνεμο απ' όσο δείχνατε». Η κάρτα έλεγε «4 Μπφ · Β · απάνεμη» και το νούμερο ήταν σωστό
 * (θαλάσσιο κελί 27,5 χλμ/ώ = ταβάνι του 4). Λάθος ήταν η ΥΠΟΣΧΕΣΗ: ο τομέας Β της Γλυφάδας
 * είναι 'protected' για το ΚΥΜΑ (άνοιγμα 0,96 χλμ — δεν προλαβαίνει να χτιστεί), αλλά το
 * `windShadow` λέει ότι ο βοριάς ΔΕΝ ήρθε πάνω από στεριά: τρέχει κατά μήκος της ακτής και
 * χτυπάει τον επισκέπτη αφρέναρος. «Απάνεμη» σε τέτοιο άνεμο είναι η Φυριπλάκα (14/08) ξανά,
 * απλώς κάτω από το ταβάνι των 5 Μπφ που γύρισε τότε τη λέξη σε «από πίσω».
 *
 * Η ΥΠΟΨΗΦΙΑ ΔΙΟΡΘΩΣΗ: στη θέση της λέξης (BeachDetailPage → shelterLabel), όταν το επίπεδο
 * είναι 'protected' και ο άνεμος ≥ ένα κατώφλι, «απάνεμη» λέγεται ΜΟΝΟ αν
 * `windArrivedOverLand(windShadow, windDeg)` — το ίδιο, ήδη βαθμονομημένο εργαλείο της γραμμής
 * απόγειου ανέμου (στεριά ≤0,3 χλμ σε ΟΛΟ το ±45°). Αλλιώς τυπώνεται «πλάγια»: καμία υπόσχεση,
 * ίδια γεωμετρία. Μονόδρομη πύλη — αφαιρεί ανακούφιση, δεν προσθέτει ποτέ.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΕΔΩ, ΠΡΙΝ ΑΠΟΦΑΣΙΣΤΕΙ ΤΙΠΟΤΑ (ίδιο μέτρο με beaufortRange/§16: η ζώνη κρίνει):
 *   1. Σε πόσες ώρες-παραλίας τυπώνεται σήμερα «απάνεμη» (pin 'protected', 3-5 Μπφ).
 *   2. Πόσες από αυτές θα γύριζαν σε «πλάγια», σε δύο ζώνες κατωφλίου (από 3 και από 4 Μπφ).
 *   3. Πόσες παραλίες δεν έχουν καθόλου windShadow/χαμηλή βεβαιότητα — εκεί η πύλη ΣΙΩΠΑ
 *      (κρατάει τη σημερινή λέξη): κανόνας που κρίνει σε άγνωστα δεδομένα δεν μπαίνει.
 *   4. Μάρτυρες: η Γλυφάδα #1993 ΠΡΕΠΕΙ να γυρίζει σε βοριά· Φυριπλάκα #1927 και Λυγαριά #636
 *      (κλασικές υπήνεμες — ο αέρας περνάει πάνω από τη ράχη) ΠΡΕΠΕΙ να κρατούν την «απάνεμη».
 *      Αν ο κανόνας χάνει τους μάρτυρες, δεν διορθώνει το feedback — απορρίπτεται.
 *
 * ΠΙΣΤΟΤΗΤΑ ΠΡΟΣ ΤΗΝ ΠΑΡΑΓΩΓΗ. Ταχύτητα/διεύθυνση όπως τις τυπώνει η εφαρμογή από 25/08:
 * παραλίες με baked seaWindCell (≥3 χλμ στεριανό κελί) παίρνουν το θαλάσσιο κελί (χωρίς
 * αποσυμπίεση — πάνω από νερό το μοντέλο δεν συμπιέζει), οι υπόλοιπες το στεριανό με τη
 * γραμμική αποσυμπίεση (applyGustFloor). Η λέξη κρίνεται στο επίπεδο της ΠΙΝΕΖΑΣ
 * (getVisibleMapExposureLevel), όπως στο hero (mapAlignedExposureLevel).
 *
 * ΟΡΙΑ. Παράθυρο πρόγνωσης λίγων ημερών — αν τρέχει μελτέμι, το δείγμα είναι μελτεμιάρικο και
 * το ποσοστό είναι το ΚΑΛΟΚΑΙΡΙΝΟ αποτύπωμα, όχι του Απρίλη. Αυτό είναι αποδεκτό: η λέξη
 * πονάει ακριβώς τις μέρες μελτεμιού.
 *
 *   node scripts/measureShelterWordLandGate.mjs [--days=3] [--limit=N] [--pace=13000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { degToCompass, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { windArrivedOverLand } = require(path.join(root, 'utils/offshoreWindNote.ts'));

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const DAYS = Number(arg('days', '3'));
const LIMIT = Number(arg('limit', '0'));
const PACE_MS = Number(arg('pace', '13000'));
/** Οι ώρες που πάει κόσμος στην παραλία — ίδιες με κάθε μέτρηση λέξης/χρώματος. */
const DAY_START = 9;
const DAY_END = 19;
/** Η λέξη τυπώνεται από 3 Μπφ (BeachDetailPage:2214) και λέει «απάνεμη» έως και τα 5. */
const WORD_MIN_BFT = 3;
const SHELTER_WORD_MAX_BFT = 5;
const NEUTRAL_SEA_M = 0.4;
/** Οι μάρτυρες: ποιος πρέπει να γυρίσει και ποιος να κρατήσει — δες την κεφαλίδα. */
const WITNESS_IDS = new Set([1993, 1927, 636, 730, 2033, 2017]);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (n, d) => (d ? Math.round(10000 * n / d) / 100 : 0);

const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
};

/** Ίδια εφεδρεία με τις άλλες σαρώσεις: κλειδί από το Netlify αν υπάρχει, αλλιώς δωρεάν. */
const readKey = async () => {
  try {
    const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    if (!token) return null;
    const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return ((await res.json()).values || []).map(v => v.value).find(Boolean) || null;
  } catch { return null; }
};
const API_KEY = await readKey();
const HOST = API_KEY ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
if (!API_KEY) console.log('⚠ χωρίς κλειδί — δωρεάν endpoint, ίδια δεδομένα');

// ── 1. ΠΑΡΑΛΙΕΣ, ΠΡΟΦΙΛ, ΚΕΛΙΑ ──────────────────────────────────────────────
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const bakedCells = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells;
const seaCellGate = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8')).cells || {};

const beaches = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const list = payload.island?.beaches || [];
  if (!list.length) continue;
  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* περιοχή χωρίς γεωμετρία — η μηχανή πέφτει στο authored προφίλ, σωστά */ }
  for (const beach of list) {
    const lat = beach.coordinates?.lat, lon = beach.coordinates?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cell = beach.forecastCell || bakedCells[String(beach.id)];
    if (!cell) continue;
    beaches.push({ beach, regionId, lat, lon, cell, profile: profiles[beach.id], usesSeaCell: Boolean(seaCellGate[String(beach.id)]) });
  }
}
const sample = LIMIT ? beaches.filter(b => WITNESS_IDS.has(b.beach.id))
  .concat(beaches.filter((b, i) => !WITNESS_IDS.has(b.beach.id) && i % Math.max(1, Math.floor(beaches.length / LIMIT)) === 0).slice(0, LIMIT)) : beaches;
const cellKeys = [...new Set(sample.map(b => b.cell))];
const seaSample = sample.filter(b => b.usesSeaCell);
console.log(`Παραλίες: ${sample.length.toLocaleString('el-GR')} (θαλάσσιο κελί: ${seaSample.length.toLocaleString('el-GR')}) · στεριανά κελιά: ${cellKeys.length.toLocaleString('el-GR')} · ${DAYS} ημέρες, ώρες ${DAY_START}-${DAY_END}`);

// ── 2. ΤΑ ΔΥΟ ΣΚΕΛΗ — στεριά ανά κελί, θάλασσα ανά παραλία με seaWindCell ────
const CHUNK = 100;
const chunks = arr => { const out = []; for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK)); return out; };

const fetchArm = async (points, cellSelection, vars) => {
  const out = [];
  for (const c of chunks(points)) {
    if (out.length) await sleep(PACE_MS);
    const url = `${HOST}/v1/forecast?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}`
      + `&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=${vars}&forecast_days=${DAYS}&timezone=Europe%2FAthens&wind_speed_unit=kmh`
      + `&cell_selection=${cellSelection}${API_KEY ? `&apikey=${API_KEY}` : ''}`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`Το ${cellSelection} γύρισε ${rows.length} για ${c.length} σημεία`);
    out.push(...rows);
    process.stdout.write(`\r  ${cellSelection}: ${out.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  return out;
};

const cacheDir = path.join(root, '.tmp');
fs.mkdirSync(cacheDir, { recursive: true });
const cached = async (name, run) => {
  const f = path.join(cacheDir, `shelter-word-${name}-${DAYS}d-${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(f)) { console.log(`  ${name}: από τον δίσκο (${path.relative(root, f)})`); return JSON.parse(fs.readFileSync(f, 'utf8')); }
  const rows = await run();
  fs.writeFileSync(f, JSON.stringify(rows));
  return rows;
};

const landPoints = cellKeys.map(k => { const [lat, lon] = k.split('_').map(Number); return { lat, lon, key: k }; });
const landRows = await cached('land', () => fetchArm(landPoints, 'land', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m'));
const seaRows = await cached('sea', () => fetchArm(seaSample, 'sea', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m'));

const landByCell = new Map();
landPoints.forEach((p, i) => {
  const r = landRows[i];
  landByCell.set(p.key, { time: r.hourly.time, speed: r.hourly.wind_speed_10m, dir: r.hourly.wind_direction_10m, gust: r.hourly.wind_gusts_10m, elevation: r.elevation });
});
const seaByBeachId = new Map();
seaSample.forEach((b, i) => {
  const r = seaRows[i];
  seaByBeachId.set(b.beach.id, { time: r.hourly.time, speed: r.hourly.wind_speed_10m, dir: r.hourly.wind_direction_10m, gust: r.hourly.wind_gusts_10m, elevation: r.elevation });
});

// ── 3. Η ΜΕΤΡΗΣΗ ─────────────────────────────────────────────────────────────
const blank = () => ({
  hoursWithWord: 0,          // pin 'protected', 3-5 Μπφ → σήμερα «απάνεμη»
  flip3: 0,                  // θα γύριζε σε «πλάγια» με κατώφλι 3 Μπφ
  flip4: 0,                  // με κατώφλι 4 Μπφ (στα 3 η λέξη μένει)
  keptLee: 0,                // κράτησε «απάνεμη» επειδή ο άνεμος όντως ήρθε από στεριά
  silentNoShadow: 0,         // η πύλη σιώπησε: χωρίς windShadow/χαμηλή βεβαιότητα
  fromBehindHours: 0,        // ≥6 Μπφ, «από πίσω» — εκτός στόχου, μετριέται για πληρότητα
});
const total = blank();
const byRegion = new Map();
const flipBeaches = new Set();
const wordBeaches = new Set();
const witnessLog = new Map();

for (const b of sample) {
  const feed = (b.usesSeaCell && seaByBeachId.get(b.beach.id)) || null;
  const land = landByCell.get(b.cell);
  if (!land) continue;
  const shadow = b.profile?.windShadow;
  const shadowKnown = typeof shadow === 'string' && b.profile?.confidence === 'high';
  const region = byRegion.get(b.regionId) || blank();
  byRegion.set(b.regionId, region);

  for (let h = 0; h < land.time.length; h++) {
    const hour = Number(land.time[h].slice(11, 13));
    if (hour < DAY_START || hour > DAY_END) continue;
    let speed, deg;
    if (feed && Number.isFinite(feed.speed?.[h]) && Number.isFinite(feed.dir?.[h])) {
      // Θαλάσσιο κελί: η ταχύτητα τυπώνεται ως έχει (πάνω από νερό δεν υπάρχει αποσυμπίεση)·
      // η πόρτα της αυτοαναιρούμενης απάντησης περνάει μέσα από το ίδιο applyGustFloor.
      speed = applyGustFloor(feed.speed[h], feed.gust?.[h], feed.elevation ?? 0);
      deg = feed.dir[h];
    } else {
      if (!Number.isFinite(land.speed?.[h]) || !Number.isFinite(land.dir?.[h])) continue;
      speed = applyGustFloor(land.speed[h], land.gust?.[h], land.elevation);
      deg = land.dir[h];
    }
    const bft = getBeaufortLevel(speed);
    if (bft < WORD_MIN_BFT) continue;

    const a = assessBeachWindExposure({
      beach: b.beach, geospatialProfile: b.profile,
      windDirectionDeg: deg, windDirection: degToCompass(deg),
      windSpeedKmh: speed, beaufort: bft, waveHeightMeters: NEUTRAL_SEA_M,
    });
    const pin = getVisibleMapExposureLevel({
      beach: b.beach, exposureLevel: a.exposureLevel, orientation: a.facingDeg,
      windProfile: a.windProfile, windProfileSource: a.source, windSector: a.windSector,
      warnings: a.warnings, geospatialExposure: b.profile,
    }, bft, deg);
    if (pin !== 'protected') continue;

    if (bft > SHELTER_WORD_MAX_BFT) { total.fromBehindHours += 1; region.fromBehindHours += 1; continue; }

    total.hoursWithWord += 1; region.hoursWithWord += 1;
    wordBeaches.add(b.beach.id);
    let outcome;
    if (!shadowKnown) {
      total.silentNoShadow += 1; region.silentNoShadow += 1;
      outcome = 'απάνεμη (πύλη σιωπά — άγνωστο windShadow)';
    } else if (windArrivedOverLand(shadow, deg)) {
      total.keptLee += 1; region.keptLee += 1;
      outcome = 'απάνεμη (ήρθε από στεριά)';
    } else {
      total.flip3 += 1; region.flip3 += 1;
      if (bft >= 4) { total.flip4 += 1; region.flip4 += 1; }
      flipBeaches.add(b.beach.id);
      outcome = `→ πλάγια (flip${bft >= 4 ? ' και στις δύο ζώνες' : ' μόνο στη ζώνη-3'})`;
    }
    if (WITNESS_IDS.has(b.beach.id)) {
      const log = witnessLog.get(b.beach.id) || { name: b.beach.name?.gr || b.beach.name?.en, rows: [] };
      if (log.rows.length < 8) log.rows.push(`${land.time[h]} ${String(bft)} Μπφ από ${Math.round(deg)}° → ${outcome}`);
      witnessLog.set(b.beach.id, log);
    }
  }
}

// ── 4. ΑΝΑΦΟΡΑ ───────────────────────────────────────────────────────────────
console.log(`\nΩΡΕΣ ΜΕ «ΑΠΑΝΕΜΗ» (pin 'protected', ${WORD_MIN_BFT}-${SHELTER_WORD_MAX_BFT} Μπφ): ${total.hoursWithWord.toLocaleString('el-GR')} σε ${wordBeaches.size.toLocaleString('el-GR')} παραλίες`);
console.log(`  θα γύριζαν σε «πλάγια» — κατώφλι 3 Μπφ: ${total.flip3.toLocaleString('el-GR')} (${pct(total.flip3, total.hoursWithWord)}%)`);
console.log(`  θα γύριζαν σε «πλάγια» — κατώφλι 4 Μπφ: ${total.flip4.toLocaleString('el-GR')} (${pct(total.flip4, total.hoursWithWord)}%)`);
console.log(`  κρατούν «απάνεμη» (άνεμος από στεριά):   ${total.keptLee.toLocaleString('el-GR')} (${pct(total.keptLee, total.hoursWithWord)}%)`);
console.log(`  πύλη σιωπά (χωρίς windShadow/low conf):  ${total.silentNoShadow.toLocaleString('el-GR')} (${pct(total.silentNoShadow, total.hoursWithWord)}%)`);
console.log(`  παραλίες με ≥1 ώρα αλλαγής: ${flipBeaches.size.toLocaleString('el-GR')} / ${wordBeaches.size.toLocaleString('el-GR')} (${pct(flipBeaches.size, wordBeaches.size)}%)`);
console.log(`  ώρες «από πίσω» (≥6 Μπφ, εκτός στόχου): ${total.fromBehindHours.toLocaleString('el-GR')}`);

console.log('\nΟΙ ΜΑΡΤΥΡΕΣ:');
for (const id of WITNESS_IDS) {
  const log = witnessLog.get(id);
  if (!log) { console.log(`  #${id}: καμία ώρα «απάνεμης» στο παράθυρο`); continue; }
  console.log(`  #${id} ${log.name}:`);
  for (const row of log.rows) console.log(`    ${row}`);
}

const regionRows = [...byRegion.entries()].filter(([, t]) => t.flip3 > 0)
  .sort((x, y) => y[1].flip3 - x[1].flip3).slice(0, 12);
console.log('\nΠΕΡΙΟΧΕΣ ΜΕ ΤΙΣ ΠΕΡΙΣΣΟΤΕΡΕΣ ΑΛΛΑΓΕΣ (κατώφλι 3):');
for (const [regionId, t] of regionRows) console.log(`  ${regionId.padEnd(40)} ${String(t.flip3).padStart(6)} / ${String(t.hoursWithWord).padStart(6)} ώρες (${pct(t.flip3, t.hoursWithWord)}%)`);

const outFile = path.join(root, 'reports/weather', `shelter-word-land-gate-${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({
  ranAt: new Date().toISOString(),
  days: DAYS, dayStart: DAY_START, dayEnd: DAY_END, beaches: sample.length,
  what: 'Πόσες ώρες «απάνεμη» (pin protected, 3-5 Μπφ) θα γύριζαν σε «πλάγια» αν η λέξη απαιτούσε windArrivedOverLand — δες την κεφαλίδα του script.',
  total,
  beachesWithWord: wordBeaches.size,
  beachesFlipping: flipBeaches.size,
  witnesses: Object.fromEntries([...witnessLog.entries()].map(([id, l]) => [id, l])),
  byRegion: Object.fromEntries([...byRegion.entries()].filter(([, t]) => t.hoursWithWord > 0)),
}, null, 2));
console.log(`\nΓράφτηκε: ${path.relative(root, outFile)}`);
