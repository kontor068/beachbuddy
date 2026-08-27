#!/usr/bin/env node
/**
 * ΑΝ ΤΟ «ΣΧΕΔΟΝ ΧΩΡΙΣ ΚΥΜΑ» ΚΟΙΤΟΥΣΕ ΑΝ ΤΟ ΚΥΜΑ ΠΕΦΤΕΙ ΚΑΤΑΜΟΥΤΡΑ, ΠΟΣΕΣ ΛΕΞΕΙΣ ΘΑ ΓΥΡΙΖΑΝ;
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ (27/08/2026, Συκιά Σιθωνίας #445, 13:00). Σχόλιο επισκέπτη: «είχε παραπάνω κύμα
 * απ' όσο δείχνατε». Η σελίδα έγραφε «0,3 μ. · Λίγος αέρας, σχεδόν χωρίς κύμα». Ο αριθμός ήταν
 * σωστός (ewam 0,28 μ., ίδιο σε όλα τα μοντέλα). Η ΛΕΞΗ όχι: το κύμα ερχόταν από 77° σε ακτή που
 * βλέπει 77,6° (resolveSeaArrivalExposureLevel = 'exposed', ανοιχτός τομέας Α με 15,6 χλμ fetch),
 * κοντό (3,85 δ.), σε ρηχή αμμουδιά — 0,3 μ. ανοιχτά που πέφτει ευθεία σε ρηχό πυθμένα σκάει
 * στην ακτή σαν 0,3–0,5 μ. Η βαθμίδα 0,2–0,4 «σχεδόν χωρίς κύμα» (utils/conditionsFeelPhrase.
 * waveFeelLevel) δεν κοιτάει ΠΟΥΘΕΝΑ αν το κύμα πέφτει πάνω στην ακτή ή την προσπερνάει — ενώ η
 * εφαρμογή το ξέρει και το χρησιμοποιεί ήδη για την έκπτωση της ακτής (§Γ59, K_d).
 *
 * Η ΥΠΟΨΗΦΙΑ ΔΙΟΡΘΩΣΗ: στη ζώνη «σχεδόν χωρίς κύμα», όταν η άφιξη είναι 'exposed' (κατάμουτρα
 * και από ανοιχτό τομέα), η λέξη ανεβαίνει ΕΝΑ σκαλί σε «λίγο κύμα». Μονόδρομη: αφαιρεί ηρεμία,
 * δεν προσθέτει ποτέ. Σιωπά σε 'partial' / 'protected' / grazing / undefined / unknown. Χρώμα,
 * ετυμηγορία, κατάταξη, αριθμός: αμετάβλητα — μόνο η λέξη της φράσης.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΕΔΩ, ΠΡΙΝ ΑΠΟΦΑΣΙΣΤΕΙ ΤΙΠΟΤΑ (ίδιο μέτρο με το measureShelterWordLandGate):
 *   1. Σε πόσες ώρες-παραλίας (9-19) τυπώνεται σήμερα «σχεδόν χωρίς κύμα».
 *   2. Πόσες θα γύριζαν σε «λίγο κύμα», σε δύο ζώνες: όλη η βαθμίδα (0,2–0,4) και μόνο το πάνω
 *      μισό της (τυπωμένο ≥0,3 → 0,25–0,4). Η ζώνη κρίνει: 5-15% είναι πληροφορία, 40% ταπετσαρία.
 *   3. Μάρτυρες: Συκιά #445 27/08 13:00 ΠΡΕΠΕΙ να γυρίζει· Καραβοστάσι #680 και Λυγαριά #636 (η
 *      θάλασσα περνάει ξυστά — κάμερες §Γ59) ΠΡΕΠΕΙ να κρατούν. Αν ο κανόνας χάνει τους
 *      μάρτυρες, δεν διορθώνει το feedback — απορρίπτεται.
 *   4. ΕΠΙΠΛΕΟΝ — Η ΚΑΤΑΝΟΜΗ ΟΛΩΝ ΤΩΝ ΛΕΞΕΩΝ: πόσο συχνά τυπώνεται κάθε λέξη ανέμου και κύματος
 *      εθνικά. Τρίτο feedback σε τρεις μέρες με το ίδιο σχήμα (σωστός αριθμός, λέξη πιο
 *      καθησυχαστική) — αν οι δύο χαμηλότερες βαθμίδες καλύπτουν τα 3/4 των ωρών, το λεξιλόγιο
 *      είναι το πρόβλημα, όχι η μία πύλη.
 *
 * ΠΙΣΤΟΤΗΤΑ ΠΡΟΣ ΤΗΝ ΠΑΡΑΓΩΓΗ. Κύμα: ewam (το pin του proxy) στο marineSamplePoint κάθε παραλίας
 * με cell_selection=sea — ό,τι ζητάει ο client. Άνεμος: θαλάσσιο κελί όπου υπάρχει seaWindCell,
 * αλλιώς στεριανό με applyGustFloor — από τη cache της εθνικής σάρωσης της ίδιας μέρας
 * (.tmp/shelter-word-*-3d-<date>.json), ώστε να μη ξαναχρεωθεί. Ο τυπωμένος αριθμός ≈
 * max(πλέγμα, SMB δικό μας στη γωνία) — 🟡 προσέγγιση του max(measured, modeled) της σελίδας
 * χωρίς τον γκρεμό/όρμο· στη ζώνη 0,2–0,4 το πλέγμα κερδίζει σχεδόν πάντα (δες
 * explainBeachWaveNumber). Η λέξη διαβάζει το ύψος της ΑΚΤΗΣ όταν αυτό ηγείται· για άφιξη
 * 'exposed' δεν υπάρχει έκπτωση, άρα για τις υποψήφιες ώρες ο ανοιχτός αριθμός ΕΙΝΑΙ ο σωστός.
 *
 *   node scripts/measureWaveWordArrivalGate.mjs [--days=3] [--limit=N] [--pace=1500]
 */
import "./lib/paidOpenMeteo.mjs";
import "./lib/proxiedOpenMeteo.mjs";
import fs from "node:fs";
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

const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { resolveSeaArrivalExposureLevel, SEA_ARRIVAL_UNKNOWN } = require(path.join(root, 'utils/seaArrival.ts'));
const { waveFeelLevel, windFeelLevel } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
const { estimateFetchLimitedWaveHeightM, printedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { SEA_ARRIVAL_GRAZING, atDisplayedPrecisionM } = require(path.join(root, 'utils/waveCharacter.ts'));

const arg = (name, dflt) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? hit.split('=')[1] : dflt; };
const DAYS = Number(arg('days', '3'));
const LIMIT = Number(arg('limit', '0'));
const PACE_MS = Number(arg('pace', '1500'));
const DAY_START = 9, DAY_END = 19;
const TODAY = new Date().toISOString().slice(0, 10);
const WITNESS_IDS = new Set([445, 680, 636, 730, 1927, 1993, 2017]);
const WAVE_WORDS = ['θάλασσα λάδι', 'σχεδόν χωρίς κύμα', 'λίγο κύμα', 'αρκετό κύμα', 'μεγάλο κύμα'];
const WIND_WORDS = ['Χωρίς αέρα', 'Λίγος αέρας', 'Αρκετός αέρας', 'Πολύς αέρας', 'Δυνατός αέρας'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (n, d) => (d ? Math.round(10000 * n / d) / 100 : 0);
const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      const j = await res.json();
      if (j?.error) throw new Error(j.reason || 'upstream error');
      return j;
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
};

// ── 1. ΠΑΡΑΛΙΕΣ — ΙΔΙΑ ΣΕΙΡΑ ΦΟΡΤΩΣΗΣ ΜΕ ΤΟ measureShelterWordLandGate, γιατί η cache του
//      ανέμου είναι πίνακες με αυτή τη σειρά ─────────────────────────────────────────────
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const bakedCells = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells;
const seaCellGate = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8')).cells || {};
const beaches = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload; try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const list = payload.island?.beaches || []; if (!list.length) continue;
  const profiles = {};
  try { const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8')); for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' }; } catch { /* χωρίς γεωμετρία */ }
  for (const beach of list) {
    const lat = beach.coordinates?.lat, lon = beach.coordinates?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cell = beach.forecastCell || bakedCells[String(beach.id)]; if (!cell) continue;
    beaches.push({ beach, regionId, lat, lon, cell, profile: profiles[beach.id], usesSeaCell: Boolean(seaCellGate[String(beach.id)]), waterDepth: beach.waterDepth, beachType: beach.beachType });
  }
}
const cellKeysAll = [...new Set(beaches.map(b => b.cell))];
const seaAll = beaches.filter(b => b.usesSeaCell);

// ── 2. ΑΝΕΜΟΣ ΑΠΟ ΤΗ CACHE ΤΗΣ ΗΜΕΡΑΣ (δεν ξαναχρεώνεται) ───────────────────────────────
const cacheDir = path.join(root, '.tmp');
const landFile = path.join(cacheDir, `shelter-word-land-${DAYS}d-${TODAY}.json`);
const seaFile = path.join(cacheDir, `shelter-word-sea-${DAYS}d-${TODAY}.json`);
if (!fs.existsSync(landFile) || !fs.existsSync(seaFile)) { console.error(`Λείπει η cache ανέμου της ημέρας (${landFile}). Τρέξε πρώτα measureShelterWordLandGate.mjs --days=${DAYS}.`); process.exit(1); }
const landRows = JSON.parse(fs.readFileSync(landFile, 'utf8'));
const seaRows = JSON.parse(fs.readFileSync(seaFile, 'utf8'));
if (landRows.length !== cellKeysAll.length || seaRows.length !== seaAll.length) { console.error(`Η cache δεν ταιριάζει: land ${landRows.length}/${cellKeysAll.length}, sea ${seaRows.length}/${seaAll.length}`); process.exit(1); }
const landByCell = new Map(cellKeysAll.map((k, i) => [k, { time: landRows[i].hourly.time, speed: landRows[i].hourly.wind_speed_10m, dir: landRows[i].hourly.wind_direction_10m, gust: landRows[i].hourly.wind_gusts_10m, elevation: landRows[i].elevation }]));
const seaByBeachId = new Map(seaAll.map((b, i) => [b.beach.id, { time: seaRows[i].hourly.time, speed: seaRows[i].hourly.wind_speed_10m, dir: seaRows[i].hourly.wind_direction_10m, gust: seaRows[i].hourly.wind_gusts_10m, elevation: seaRows[i].elevation ?? 0 }]));
console.log(`Άνεμος: από cache (${path.relative(root, landFile)} + sea)`);

// ── 3. ΔΕΙΓΜΑ + ΚΥΜΑ (ewam, sea cell, στο marineSamplePoint) ────────────────────────────
const withGeom = beaches.filter(b => b.profile?.marineSamplePoint && Number.isFinite(b.profile.facingDeg));
const sample = LIMIT
  ? withGeom.filter(b => WITNESS_IDS.has(b.beach.id)).concat(withGeom.filter((b, i) => !WITNESS_IDS.has(b.beach.id) && i % Math.max(1, Math.floor(withGeom.length / LIMIT)) === 0).slice(0, LIMIT))
  : withGeom;
const pointKey = p => `${p.lat.toFixed(3)}_${p.lon.toFixed(3)}`;
const points = []; const seenPt = new Map();
for (const b of sample) { const k = pointKey(b.profile.marineSamplePoint); if (!seenPt.has(k)) { seenPt.set(k, points.length); points.push({ lat: b.profile.marineSamplePoint.lat, lon: b.profile.marineSamplePoint.lon }); } b.ptIndex = seenPt.get(k); }
console.log(`Παραλίες: ${sample.length.toLocaleString('el-GR')} (με γεωμετρία: ${withGeom.length.toLocaleString('el-GR')} / ${beaches.length.toLocaleString('el-GR')}) · θαλάσσια σημεία: ${points.length.toLocaleString('el-GR')} · ${DAYS} ημέρες`);

const marineFile = path.join(cacheDir, `wave-word-marine-${DAYS}d-${TODAY}-${LIMIT || 'all'}.json`);
let marineRows;
if (fs.existsSync(marineFile)) { marineRows = JSON.parse(fs.readFileSync(marineFile, 'utf8')); console.log(`  κύμα: από τον δίσκο (${path.relative(root, marineFile)})`); }
else {
  marineRows = [];
  const CHUNK = 32; // MAX_COORDINATE_LIST_ITEMS της πύλης
  for (let i = 0; i < points.length; i += CHUNK) {
    if (i) await sleep(PACE_MS);
    const c = points.slice(i, i + CHUNK);
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=wave_height,wave_direction,wave_period&forecast_days=${DAYS}&timezone=Europe%2FAthens&cell_selection=sea&models=ewam`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`Το marine γύρισε ${rows.length} για ${c.length}`);
    marineRows.push(...rows);
    process.stdout.write(`\r  κύμα: ${marineRows.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  fs.writeFileSync(marineFile, JSON.stringify(marineRows));
}

// ── 4. Η ΜΕΤΡΗΣΗ ────────────────────────────────────────────────────────────────────────
const blank = () => ({ hours: 0, wordHours: 0, printedThreeAny: 0, flipAll: 0, flipUpper: 0, keptNotOnshore: 0, keptPartial: 0, keptProtected: 0, keptGrazing: 0, keptUnknown: 0 });
const total = blank(); const byRegion = new Map();
const waveWordHist = [0, 0, 0, 0, 0], windWordHist = [0, 0, 0, 0, 0];
const flipBeaches = new Set(), wordBeaches = new Set();
const arrivalHist = {};
const witnessLog = new Map();
const flipSamples = [];

for (const b of sample) {
  const m = marineRows[b.ptIndex]?.hourly; if (!m?.time) continue;
  const feed = (b.usesSeaCell && seaByBeachId.get(b.beach.id)) || null;
  const land = landByCell.get(b.cell); if (!land) continue;
  const region = byRegion.get(b.regionId) || blank(); byRegion.set(b.regionId, region);
  for (let h = 0; h < m.time.length; h++) {
    const hour = Number(m.time[h].slice(11, 13)); if (hour < DAY_START || hour > DAY_END) continue;
    const hs = m.wave_height?.[h], wdir = m.wave_direction?.[h];
    if (!Number.isFinite(hs)) continue;
    // Άνεμος της ίδιας ώρας (οι δύο σειρές είναι ίδιου timezone και ίδιας αρχής ημέρας)
    const wi = land.time.indexOf(m.time[h]); if (wi < 0) continue;
    let speed, deg;
    if (feed && Number.isFinite(feed.speed?.[wi]) && Number.isFinite(feed.dir?.[wi])) { speed = applyGustFloor(feed.speed[wi], feed.gust?.[wi], feed.elevation ?? 0); deg = feed.dir[wi]; }
    else if (Number.isFinite(land.speed?.[wi]) && Number.isFinite(land.dir?.[wi])) { speed = applyGustFloor(land.speed[wi], land.gust?.[wi], land.elevation); deg = land.dir[wi]; }
    else continue;
    const bft = getBeaufortLevel(speed);
    // Τυπωμένος αριθμός ≈ max(πλέγμα, SMB δικό μας στη γωνία, μόνο όταν ο άνεμος μπαίνει)
    let modeled = 0;
    try { const g = interpolateSectorGeometry(b.profile, deg); if (onshoreComponent(deg, b.profile.facingDeg) > 0.2) modeled = estimateFetchLimitedWaveHeightM({ windSpeedKmh: speed, fetchKm: g.fetchKm }); } catch { /* χωρίς τομείς */ }
    const printed = printedWaveHeightM(Math.max(hs, modeled)) ?? Math.max(hs, modeled);
    const waveLvl = waveFeelLevel(printed); const windLvl = windFeelLevel(bft);
    waveWordHist[waveLvl] += 1; windWordHist[windLvl] += 1;
    total.hours += 1; region.hours += 1;
    if (waveLvl !== 1) continue;
    total.wordHours += 1; region.wordHours += 1; wordBeaches.add(b.beach.id);
    // Εναλλακτική «λεξιλογίου»: κατώφλι βαθμίδας 0,4 → 0,3 χωρίς να κοιτάς την άφιξη — πόσο θα γύριζε;
    if ((atDisplayedPrecisionM(printed) ?? printed) >= 0.3) { total.printedThreeAny += 1; region.printedThreeAny += 1; }
    const arrival = resolveSeaArrivalExposureLevel(b.profile, wdir);
    const key = arrival === undefined ? 'not-onshore' : String(arrival);
    arrivalHist[key] = (arrivalHist[key] || 0) + 1;
    let outcome;
    if (arrival === 'exposed') {
      total.flipAll += 1; region.flipAll += 1; flipBeaches.add(b.beach.id);
      // Στην ακρίβεια που ΤΥΠΩΝΕΤΑΙ (0,28 → «0,3»), όπως χρώμα/ετυμηγορία (atDisplayedPrecisionM).
      const upper = (atDisplayedPrecisionM(printed) ?? printed) >= 0.3;
      if (upper) { total.flipUpper += 1; region.flipUpper += 1; }
      outcome = `→ λίγο κύμα (${upper ? 'και οι δύο ζώνες' : 'μόνο ζώνη 0,2'})`;
      if (flipSamples.length < 400) flipSamples.push({ id: b.beach.id, name: b.beach.name?.gr || b.beach.name?.en, region: b.regionId, time: m.time[h], hs, printed, wdir, facing: b.profile.facingDeg, bft, waterDepth: b.waterDepth, beachType: b.beachType });
    } else if (arrival === 'partial') { total.keptPartial += 1; region.keptPartial += 1; outcome = 'σχεδόν χωρίς (partial)'; }
    else if (arrival === 'protected') { total.keptProtected += 1; region.keptProtected += 1; outcome = 'σχεδόν χωρίς (protected)'; }
    else if (arrival === SEA_ARRIVAL_GRAZING) { total.keptGrazing += 1; region.keptGrazing += 1; outcome = 'σχεδόν χωρίς (ξυστά)'; }
    else if (arrival === SEA_ARRIVAL_UNKNOWN) { total.keptUnknown += 1; region.keptUnknown += 1; outcome = 'σχεδόν χωρίς (άγνωστο)'; }
    else { total.keptNotOnshore += 1; region.keptNotOnshore += 1; outcome = 'σχεδόν χωρίς (δεν έρχεται)'; }
    if (WITNESS_IDS.has(b.beach.id)) {
      const arr = witnessLog.get(b.beach.id) || []; witnessLog.set(b.beach.id, arr);
      arr.push({ time: m.time[h], hs, printed, wdir, facing: b.profile.facingDeg, bft, arrival: key, outcome });
    }
  }
}

// ── 5. ΑΝΑΦΟΡΑ ──────────────────────────────────────────────────────────────────────────
const line = (label, n, d) => `  ${label.padEnd(46)} ${String(n).padStart(7)}  (${pct(n, d)}%)`;
console.log(`\nΩΡΕΣ-ΠΑΡΑΛΙΑΣ 9-19 με μέτρηση: ${total.hours.toLocaleString('el-GR')} σε ${sample.length.toLocaleString('el-GR')} παραλίες`);
console.log('\nΚΑΤΑΝΟΜΗ ΛΕΞΕΩΝ (όλες οι ώρες):');
WAVE_WORDS.forEach((w, i) => console.log(line(`κύμα: «${w}»`, waveWordHist[i], total.hours)));
WIND_WORDS.forEach((w, i) => console.log(line(`άνεμος: «${w}»`, windWordHist[i], total.hours)));
console.log(`\n«ΣΧΕΔΟΝ ΧΩΡΙΣ ΚΥΜΑ» (0,2-0,4 μ.): ${total.wordHours.toLocaleString('el-GR')} ώρες σε ${wordBeaches.size.toLocaleString('el-GR')} παραλίες`);
console.log(line('→ «λίγο κύμα», άφιξη exposed (όλη η ζώνη)', total.flipAll, total.wordHours));
console.log(line('→ «λίγο κύμα», μόνο τυπωμένο «0,3»+', total.flipUpper, total.wordHours));
console.log(line('ΕΝΑΛΛΑΚΤΙΚΗ: κατώφλι 0,4→0,3 (κάθε άφιξη)', total.printedThreeAny, total.wordHours));
console.log(`  …ως ποσοστό ΟΛΩΝ των ωρών: ${pct(total.printedThreeAny, total.hours)}% (από αυτές, ξυστά/φεύγει/protected: ${pct(total.printedThreeAny - total.flipUpper - 0, total.printedThreeAny)}% δεν πέφτουν κατάμουτρα)`);
console.log(line('κρατά: partial', total.keptPartial, total.wordHours));
console.log(line('κρατά: protected', total.keptProtected, total.wordHours));
console.log(line('κρατά: ξυστά', total.keptGrazing, total.wordHours));
console.log(line('κρατά: δεν έρχεται πάνω', total.keptNotOnshore, total.wordHours));
console.log(line('κρατά: άγνωστο (χωρίς διεύθυνση)', total.keptUnknown, total.wordHours));
console.log(`  παραλίες που γυρίζουν τουλάχιστον μία ώρα: ${flipBeaches.size} / ${wordBeaches.size}`);
console.log(`  ως ποσοστό ΟΛΩΝ των ωρών: ζώνη-όλη ${pct(total.flipAll, total.hours)}% · ζώνη-0,3 ${pct(total.flipUpper, total.hours)}%`);

console.log('\nΜΑΡΤΥΡΕΣ:');
for (const id of WITNESS_IDS) {
  const b = sample.find(x => x.beach.id === id); const log = witnessLog.get(id) || [];
  if (!b) { console.log(`  #${id}: εκτός δείγματος`); continue; }
  const flips = log.filter(l => l.outcome.startsWith('→')).length;
  console.log(`  #${id} ${b.beach.name?.gr || b.beach.name?.en} (βλέπει ${b.profile.facingDeg}°): ${log.length} ώρες στη ζώνη, ${flips} γυρίζουν`);
  for (const l of log.slice(0, 4)) console.log(`     ${l.time.slice(5, 16)}  ${l.hs} μ. (τυπ. ${l.printed}) από ${l.wdir}°  ${l.bft} Μπφ  ${l.arrival} → ${l.outcome}`);
}

const regionTable = [...byRegion.entries()].filter(([, r]) => r.wordHours >= 20).map(([id, r]) => ({ id, ...r, flipPct: pct(r.flipAll, r.wordHours) })).sort((a, b) => b.flipPct - a.flipPct);
console.log('\nΠΕΡΙΟΧΕΣ με τα περισσότερα γυρίσματα (≥20 ώρες στη ζώνη):');
for (const r of regionTable.slice(0, 12)) console.log(`  ${r.id.padEnd(42)} ζώνη ${String(r.wordHours).padStart(5)}  γυρίζουν ${String(r.flipAll).padStart(5)} (${r.flipPct}%)`);

const outDir = path.join(root, 'reports/weather'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `wave-word-arrival-gate-${TODAY}${LIMIT ? `-sample${LIMIT}` : ''}.json`);
fs.writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(), days: DAYS, limit: LIMIT || null, beaches: sample.length, marinePoints: points.length,
  approximation: 'printed ≈ max(ewam wave_height, SMB στη γωνία όταν ο άνεμος μπαίνει)· χωρίς γκρεμό/όρμο· άνεμος από cache της ημέρας (θαλάσσιο κελί όπου υπάρχει)',
  total, wordHist: { wave: Object.fromEntries(WAVE_WORDS.map((w, i) => [w, waveWordHist[i]])), wind: Object.fromEntries(WIND_WORDS.map((w, i) => [w, windWordHist[i]])) },
  arrivalHist, flipBeaches: flipBeaches.size, wordBeaches: wordBeaches.size, byRegion: Object.fromEntries(byRegion), witnesses: Object.fromEntries(witnessLog), flipSamples,
}, null, 2));
console.log(`\nΑναφορά: ${path.relative(root, out)}`);
