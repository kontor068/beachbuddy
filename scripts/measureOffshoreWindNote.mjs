#!/usr/bin/env node
/**
 * ΠΟΣΟ ΣΥΧΝΑ ΘΑ ΕΒΓΑΙΝΕ Η ΓΡΑΜΜΗ «Ο ΑΕΡΑΣ ΕΡΧΕΤΑΙ ΑΠΟ ΤΗ ΣΤΕΡΙΑ»;
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Τρεις κανόνες που θα ΑΛΛΑΖΑΝ τον αριθμό της Λυγαριάς μετρήθηκαν εθνικά και
 * απορρίφθηκαν (§Μ6 γεωμετρία, §Μ6 δρόμος α, 21/08 περίοδος). Ο λόγος ήταν πάντα ο ίδιος: κάθε
 * τέτοιος κανόνας κάνει ΚΑΙ εκατοντάδες άλλες παραλίες πιο ήρεμες απ' ό,τι είναι — σκανδάλη #1
 * της §9. Αυτό εδώ δοκιμάζει τη μόνη εκδοχή που ΔΕΝ έχει αυτό το ρίσκο: να μην αλλάξει τίποτα
 * (ούτε αριθμός, ούτε χρώμα, ούτε πρόταση) και να **γραφτεί** η αλήθεια δίπλα στο νούμερο.
 *
 * ΤΙ ΡΩΤΑΕΙ Ο ΚΑΝΟΝΑΣ. Όχι «κοιτάει η παραλία προς τα εκεί;» (αυτό είναι το `facingDeg`, και στο
 * βάθος ενός όρμου δείχνει το ΣΤΟΜΙΟ, όχι τη μεριά απ' όπου ήρθε ο αέρας — §Μ6). Ρωτάει το
 * μετρήσιμο: **προς τη γωνία ΤΟΥ ΑΝΕΜΟΥ, πόσο μακριά είναι η στεριά;** Αν είναι κοντά, ο αέρας
 * πέρασε πάνω από στεριά και δεν πρόλαβε να χτίσει κύμα μπροστά στην παραλία.
 *
 * ΓΙΑΤΙ ΔΙΑΒΑΖΕΙ ΤΗ ΒΕΝΤΑΛΙΑ ΚΑΙ ΟΧΙ ΤΙΣ 8 ΦΕΤΕΣ. Οι 8 φέτες που στέλνονται στον browser
 * μετριούνται με βήμα ακτίνας 200 μ. και χάνουν λωρίδες στεριάς λεπτότερες από αυτό — μετρημένο:
 * η Λυγαριά έχει αποθηκευμένο 5,00 χλμ στον ΒΔ ενώ το πραγματικό είναι 0,13 (σφάλμα 38,5×,
 * `reports/geometry/ray-step-aliasing.json`). Η βεντάλια (`reports/geometry/arrival-fan`)
 * μετριέται με βήμα **50 μ.** και δίνει στεριά στα 150 μ. προς τις 310°. Με τα χονδρά δεδομένα ο
 * κανόνας δεν θα άναβε ΚΑΙ στην παραλία που τον γέννησε — δηλαδή θα μετρούσαμε λάθος πράγμα.
 *
 * ΤΙ ΚΡΙΝΕΙ ΤΗΝ ΕΠΙΤΥΧΙΑ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΡΕΞΕΙ:
 *   1. Ανάβει στη Λυγαριά (#636) τις ώρες που ο Μίλτος την είδε λάδι.
 *   2. ΔΕΝ γίνεται ταπετσαρία: αν βγαίνει σε >10% των ωρών ή σε >15% των παραλιών, είναι θόρυβος
 *      («no duplicate robot copy») και δεν μπαίνει.
 *   3. Δεν εμφανίζεται ΠΟΤΕ πάνω από θάλασσα που η ίδια η εφαρμογή λέει «μην κολυμπήσεις», ούτε
 *      πάνω από κύμα ≥0,8 μ. (η πορτοκαλί γραμμή). Το τυπώνει ως έλεγχο, δεν το υποθέτει.
 *
 * Report-only.
 */
import './lib/paidOpenMeteo.mjs';
import './lib/proxiedOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const FAN_STEP_DEG = 15;
const FAN_SLOTS = 24;

/** Η στεριά είναι κοντά προς ΚΑΘΕ γωνία μέσα στο παράθυρο γύρω από τη γωνία του ανέμου. */
const windCameOverLand = (fan, windFromDeg, windowDeg, maxLandKm) => {
  if (!Array.isArray(fan) || fan.length !== FAN_SLOTS) return false;
  if (typeof windFromDeg !== 'number' || !Number.isFinite(windFromDeg)) return false;
  const centre = Math.round((((windFromDeg % 360) + 360) % 360) / FAN_STEP_DEG);
  const half = Math.round(windowDeg / FAN_STEP_DEG);
  for (let offset = -half; offset <= half; offset += 1) {
    const value = fan[(centre + offset + FAN_SLOTS) % FAN_SLOTS];
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (value > maxLandKm) return false;
  }
  return true;
};

const arrivalFanDir = path.join(root, 'reports/geometry/arrival-fan');
const fansByRegion = new Map();
for (const file of readdirSync(arrivalFanDir)) {
  if (!file.endsWith('.json')) continue;
  fansByRegion.set(file.replace('.json', ''), JSON.parse(readFileSync(path.join(arrivalFanDir, file), 'utf8')).fans || {});
}

const WITNESS_ID = 636;
const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

/** Κάτω από 3 Μποφόρ κανείς δεν αναρωτιέται γιατί το νούμερο δείχνει κύμα. */
const MIN_BEAUFORT = 3;
/** Πάνω από αυτό δεν λέμε «πιο ήρεμα» με τίποτα — είναι η πορτοκαλί γραμμή της εφαρμογής. */
const MAX_WAVE_M = 0.8;
/**
 * ⚠️ ΤΟ ΚΑΤΩ ΟΡΙΟ ΠΡΟΣΤΕΘΗΚΕ ΜΕΤΑ ΤΗΝ ΠΡΩΤΗ ΜΕΤΡΗΣΗ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ.
 *
 * Χωρίς αυτό η γραμμή έβγαινε σε **21-29% των ωρών και 34-57% των παραλιών** — ταπετσαρία, δηλαδή
 * κομμένη από το ίδιο μου το κριτήριο (>10% ωρών / >15% παραλιών = θόρυβος). Ο λόγος φάνηκε στην
 * κατανομή: **87% των ωρών που άναβε είχαν κύμα κάτω από 0,2 μ.** Εκεί η γραμμή εξηγεί πρόβλημα
 * που δεν υπάρχει — κανείς δεν κοιτάζει το «0,1 μ.» και αναρωτιέται γιατί λέμε κύμα.
 *
 * Η γραμμή χρειάζεται ΜΟΝΟ όταν ο αριθμός είναι αρκετά μεγάλος ώστε να φαίνεται λάθος σε κάποιον
 * που βλέπει λάδι. Το 0,40 ΔΕΝ είναι βαθμονομημένο: είναι το ήδη υπάρχον όριο «εδώ σταματάει να
 * είναι επίπεδο νερό» της εφαρμογής (`FLAT_WATER_SEA_STATE_M` του §Γ16 και
 * `GLASS_AT_FOUR_MAX_SEA_STATE_M` του «απόγειος-γυαλί των 4»). Δανεικό κατώφλι, όπως έκανε το §Γ16.
 */
const MIN_WAVE_M = 0.4;

const CANDIDATES = [
  { windowDeg: 30, maxLandKm: 0.5 },
  { windowDeg: 30, maxLandKm: 0.3 },
  { windowDeg: 45, maxLandKm: 0.5 },
  { windowDeg: 45, maxLandKm: 0.3 },
  { windowDeg: 15, maxLandKm: 0.5 },
  { windowDeg: 60, maxLandKm: 0.3 },
];

const regions = [];
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  if (!island?.beaches?.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  regions.push({ id: file.replace('.json', ''), beaches: island.beaches, profiles });
}

const stats = CANDIDATES.map(c => ({
  ...c,
  geometryOnly: 0, fired: 0, beaches: new Map(), witnessHours: 0,
  blockedByAvoid: 0, blockedByBigWave: 0, blockedByCalm: 0, blockedBySmallWave: 0,
  waveBuckets: { u02: 0, u04: 0, u06: 0, u08: 0 },
}));
let scored = 0;
let beachesSeen = 0;
const witnessLog = [];

for (const region of regions) {
  const clusters = buildBeachForecastClusters(region.beaches);
  const byBeach = new Map();
  let windByPoint;
  try {
    windByPoint = await fetchForecastDataBatch(clusters.map(c => ({ lat: c.lat, lon: c.lon })));
  } catch { continue; }

  const marinePoints = [];
  for (const beach of region.beaches) {
    const mp = region.profiles[String(beach.id)]?.marineSamplePoint;
    if (mp) marinePoints.push({ lat: mp.lat, lon: mp.lon });
  }
  let marineByPoint = new Map();
  try { marineByPoint = await fetchMarineForecastDataBatch(marinePoints); } catch { /* κενό */ }

  for (const cluster of clusters) {
    const wind = windByPoint.get(forecastPointKey(cluster.lat, cluster.lon));
    if (!wind?.data) continue;
    for (const id of cluster.beachIds) byBeach.set(id, wind.data);
  }

  for (const beach of region.beaches) {
    const profile = region.profiles[String(beach.id)];
    if (profile?.confidence !== 'high') continue;
    const windData = byBeach.get(beach.id);
    if (!windData) continue;
    const fan = fansByRegion.get(region.id)?.[String(beach.id)];
    const mp = profile.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));
    beachesSeen += 1;

    for (const hour of HOURS) {
      const day = days?.[0];
      if (!day?.hourly?.[hour]) continue;
      const h = day.hourly[hour];
      const slice = { ...day, ...h, hourly: day.hourly };
      const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile };
      const score = calculateBeachScore(beach, slice, undefined, undefined, opts);
      scored += 1;

      // ⚠️ ΜΟΝΑΔΕΣ: wind.speed είναι μ/δευτ. — ο recommendationService το πολλαπλασιάζει επί 3,6.
      const windKmh = typeof h.wind?.speed === 'number' ? h.wind.speed * 3.6 : undefined;
      const windFromDeg = h.wind?.deg;
      const bft = getBeaufortLevel(windKmh);
      const waveM = score.shoreDisplayWaveM;
      const isAvoid = score.swimmingComfort === 'avoid_swimming';

      for (const stat of stats) {
        const geometry = windCameOverLand(fan, windFromDeg, stat.windowDeg, stat.maxLandKm);
        if (!geometry) continue;
        stat.geometryOnly += 1;

        if (bft < MIN_BEAUFORT) { stat.blockedByCalm += 1; continue; }
        if (isAvoid) { stat.blockedByAvoid += 1; continue; }
        if (typeof waveM !== 'number' || waveM > MAX_WAVE_M) { stat.blockedByBigWave += 1; continue; }
        if (waveM < MIN_WAVE_M) { stat.blockedBySmallWave += 1; continue; }

        stat.fired += 1;
        stat.beaches.set(beach.id, (stat.beaches.get(beach.id) ?? 0) + 1);
        if (beach.id === WITNESS_ID) stat.witnessHours += 1;
        if (waveM < 0.2) stat.waveBuckets.u02 += 1;
        else if (waveM < 0.4) stat.waveBuckets.u04 += 1;
        else if (waveM < 0.6) stat.waveBuckets.u06 += 1;
        else stat.waveBuckets.u08 += 1;
      }

      if (beach.id === WITNESS_ID) {
        witnessLog.push({
          hour, windFromDeg, bft, waveM: waveM ?? null, comfort: score.swimmingComfort,
          fires: stats.map(s => windCameOverLand(fan, windFromDeg, s.windowDeg, s.maxLandKm)),
        });
      }
    }
  }
  process.stdout.write(`\r  ${region.id.padEnd(42)} ${scored}`);
}
console.log('');

if (scored < 20000) {
  console.error(`\nΑΚΥΡΗ ΣΑΡΩΣΗ: μόνο ${scored} βαθμολογήσεις.`);
  process.exit(1);
}

const pct = (n, total) => `${((n / total) * 100).toFixed(1)}%`;
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

console.log(`\n${scored} ώρες-παραλίας, ${beachesSeen} παραλίες με έμπιστη γεωμετρία.`);
console.log('\n παράθυρο  στεριά │ γεωμετρία   ΒΓΑΙΝΕΙ    % ωρών   παραλίες   % παρ.  διάμ.ώρες/παρ. │ κόβεται: ήρεμο/μη-κολύμπι/μεγ.κύμα/μικρό │ Λυγαριά');
console.log('─────────────────┼──────────────────────────────────────────────────────────────────┼───────────────────────────────────┼────────');
for (const s of stats) {
  const perBeach = [...s.beaches.values()];
  console.log(
    `   ±${String(s.windowDeg).padStart(2)}°  ${String(s.maxLandKm).padStart(4)}χλμ │ `
    + `${String(s.geometryOnly).padStart(9)}  ${String(s.fired).padStart(8)}  ${pct(s.fired, scored).padStart(8)}  `
    + `${String(s.beaches.size).padStart(8)}  ${pct(s.beaches.size, beachesSeen).padStart(6)}  ${String(median(perBeach)).padStart(13)} │ `
    + `${String(s.blockedByCalm).padStart(7)}/${String(s.blockedByAvoid).padStart(6)}/${String(s.blockedByBigWave).padStart(6)}/${String(s.blockedBySmallWave).padStart(6)} │ `
    + `${s.witnessHours ? String(s.witnessHours) + ' ✓' : 'ΟΧΙ ✗'}`
  );
}

console.log('\nΜΕΓΕΘΟΣ ΚΥΜΑΤΟΣ ΣΤΙΣ ΩΡΕΣ ΠΟΥ ΒΓΑΙΝΕΙ (αν είναι όλα <0,2 μ., η γραμμή δεν χρειάζεται σε κανέναν):');
for (const s of stats) {
  const b = s.waveBuckets;
  console.log(`   ±${String(s.windowDeg).padStart(2)}° ${String(s.maxLandKm).padStart(4)}χλμ │ `
    + `<0,2μ ${String(b.u02).padStart(6)}   0,2-0,4 ${String(b.u04).padStart(6)}   0,4-0,6 ${String(b.u06).padStart(6)}   0,6-0,8 ${String(b.u08).padStart(6)}`);
}

console.log('\nΜΑΡΤΥΡΑΣ #636 ΛΥΓΑΡΙΑ:');
for (const w of witnessLog) {
  console.log(`  ${String(w.hour).padStart(2)}:00  αέρας από ${String(w.windFromDeg).padStart(3)}°  ${w.bft} Μπφ  `
    + `κύμα ${w.waveM} μ.  ${w.comfort}  →  ${w.fires.map(f => f ? '✓' : '·').join(' ')}`);
}

mkdirSync(path.join(root, 'reports/offshore-wind-note'), { recursive: true });
writeFileSync(path.join(root, 'reports/offshore-wind-note/frequency.json'),
  JSON.stringify({
    measuredAt: new Date().toISOString(), scored, beachesSeen,
    minBeaufort: MIN_BEAUFORT, maxWaveM: MAX_WAVE_M, minWaveM: MIN_WAVE_M,
    witnessId: WITNESS_ID, witnessLog,
    candidates: stats.map(s => ({
      windowDeg: s.windowDeg, maxLandKm: s.maxLandKm,
      geometryOnly: s.geometryOnly, fired: s.fired, beaches: s.beaches.size,
      medianHoursPerBeach: median([...s.beaches.values()]),
      blockedByCalm: s.blockedByCalm, blockedByAvoid: s.blockedByAvoid,
      blockedByBigWave: s.blockedByBigWave, blockedBySmallWave: s.blockedBySmallWave,
      waveBuckets: s.waveBuckets, witnessHours: s.witnessHours,
    })),
  }, null, 2), 'utf8');
console.log('\nγράφτηκε reports/offshore-wind-note/frequency.json');
