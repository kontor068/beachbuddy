#!/usr/bin/env node
/**
 * Ο ΑΞΟΝΑΣ ΠΕΡΙΟΔΟΥ ΩΣ ΠΥΛΗ — Η ΜΕΤΡΗΣΗ ΠΟΥ ΖΗΤΗΣΕ ΤΟ §Μ6 ΚΑΙ ΔΕΝ ΕΙΧΕ ΓΙΝΕΙ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το §Μ6 (16-17/08/2026) χτίστηκε, μετρήθηκε εθνικά και ΑΠΟΡΡΙΦΘΗΚΕ: ο κανόνας
 * «αν η γωνία απ' όπου δηλώνει το πλέγμα ότι έρχεται το κύμα βρίσκει στεριά, πέτα την ένδειξη»
 * άναβε σε 20.311 από 40.166 ώρες και γύριζε 2.217 χρώματα πινέζας προς το ηρεμότερο. Η ρίζα:
 * ΚΑΘΕ παραλία έχει στεριά στη μισή πυξίδα, άρα «έχει στεριά προς τα εκεί» δεν διακρίνει τίποτα.
 *
 * Το §Μ6 έκλεισε αφήνοντας ΕΝΑΝ αδοκίμαστο δρόμο, γραμμένο ρητά ως εκκρεμότητα:
 *
 *   > «Κύμα ανέμου 5,2 δευτ. τυλίγεται γύρω από ακρωτήρι πολύ λιγότερο από αποθαλασσιά 9 δευτ.
 *   >  Η περίοδος υπάρχει ήδη στα δεδομένα. ΔΕΝ ΕΧΕΙ ΜΕΤΡΗΘΕΙ ΩΣ ΠΥΛΗ.»
 *
 * Η ΦΥΣΙΚΗ, ΣΕ ΜΙΑ ΓΡΑΜΜΗ. Το μήκος κύματος είναι L ~ 1,56*T^2. Στα 2,9 δευτ. είναι 13 μ., στα
 * 5,2 δευτ. 42 μ., στα 9 δευτ. 126 μ. Η περίθλαση γύρω από βραχώδη μύτη 100-200 μ. είναι αμελητέα
 * όταν L << το εμπόδιο και σημαντική όταν L ~ το εμπόδιο. Δηλαδή η περίοδος είναι ΑΚΡΙΒΩΣ η
 * ποσότητα που ξεχωρίζει «μπαίνει» από «δεν μπαίνει» — αυτό που η γεωμετρία μόνη της απέτυχε να
 * κάνει στις 45° του στομίου της Λυγαριάς.
 *
 * ΤΟ ΚΡΙΤΗΡΙΟ ΕΠΙΤΥΧΙΑΣ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΡΕΞΕΙ (ίδιο με του §Μ6, για να είναι συγκρίσιμο):
 *   ρύθμιση όπου η Λυγαριά (#636) διορθώνεται ΚΑΙ οι αλλαγές χρώματος μένουν στη ΔΕΚΑΔΑ.
 *   Μέτρο σύγκρισης: η εγκεκριμένη δικλείδα του §Μ4 γυρίζει 16 χρώματα· ο απορριφθείς κανόνας 783.
 *   Αν καμία ρύθμιση δεν το πετυχαίνει, ο άξονας περιόδου ΔΕΝ βγαίνει και γράφεται ως απορριφθείς.
 *
 * ⚠️ ΚΑΙ ΕΝΑΣ ΟΡΟΣ ΠΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΞΕΧΑΣΤΕΙ. Η αναφορά που γέννησε το §Μ6 (16/08, 19:00)
 * είχε περίοδο 5,2 δευτ. Η αναφορά της 21/08 είχε 2,9 δευτ. Κατώφλι κάτω από 5,2 δευτ. «διορθώνει»
 * μόνο τη σημερινή και αφήνει την αρχική — δηλαδή είναι βαθμονόμηση στον σημερινό καιρό, όχι
 * κανόνας. Ο πίνακας τυπώνει και τη στήλη του μάρτυρα ώστε να μη γίνει αυτό σιωπηλά.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ. Καμία αλλαγή στην παραγωγή. Report-only, όπως κάθε εργαλείο αυτής της οικογένειας.
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
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

/**
 * ⛔ Ο ΑΠΟΡΡΙΦΘΕΙΣ ΓΕΩΜΕΤΡΙΚΟΣ ΚΑΝΟΝΑΣ, ΑΝΤΙΓΡΑΜΜΕΝΟΣ ΑΥΤΟΥΣΙΟΣ ΑΠΟ ΤΟ
 * scripts/sweepBlockedArrivalThresholds.mjs — ΧΩΡΙΣ ΚΑΜΙΑ ΑΛΛΑΓΗ.
 *
 * Είναι το ΑΝΤΙΚΕΙΜΕΝΟ της μέτρησης, όχι βοηθητικό: αν το ξαναγράψω αλλιώς εδώ, τα νούμερα
 * παύουν να συγκρίνονται με τα 783/2.217 του §Μ6 και η μέτρηση δεν απαντάει σε τίποτα. Γι' αυτό
 * οι δύο πρώτες γραμμές του πίνακα είναι ΠΥΛΗ ΑΝΑΠΑΡΑΓΩΓΗΣ: τρέχουν τον κανόνα χωρίς περίοδο και
 * πρέπει να ξαναβγάλουν τα νούμερα του §Μ6 (στον σημερινό καιρό, άρα κατά τάξη μεγέθους).
 */
const MOUTH_OPEN_KM = 3;
const ARRIVAL_FAN_STEP_DEG = 15;
const ARRIVAL_FAN_SLOTS = 24;

const isSeaArrivalLandBlocked = ({ fan, waveDirectionDeg, arrivingSwellPresent, fanDeg, maxFetchKm, maxOpenSlots }) => {
  if (arrivingSwellPresent) return false;
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return false;
  if (!Array.isArray(fan) || fan.length !== ARRIVAL_FAN_SLOTS) return false;

  const openSlots = fan.filter(value => typeof value === 'number' && value > MOUTH_OPEN_KM).length;
  if (openSlots === 0 || openSlots > maxOpenSlots) return false;

  const centreSlot = Math.round((((waveDirectionDeg % 360) + 360) % 360) / ARRIVAL_FAN_STEP_DEG);
  const halfSlots = Math.round(fanDeg / ARRIVAL_FAN_STEP_DEG);
  for (let offset = -halfSlots; offset <= halfSlots; offset += 1) {
    const value = fan[(centreSlot + offset + ARRIVAL_FAN_SLOTS) % ARRIVAL_FAN_SLOTS];
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (value > maxFetchKm) return false;
  }
  return true;
};

/**
 * Ο ΝΕΟΣ ΑΞΟΝΑΣ. Άγνωστη περίοδος ΚΛΕΙΝΕΙ την πόρτα: κανόνας που μόνο προς τα κάτω κινείται δεν
 * επιτρέπεται να ανάβει σε έλλειψη στοιχείων (§9, σκανδάλη #1). `null` = χωρίς πύλη περιόδου.
 */
const passesPeriodGate = (wavePeriodS, maxPeriodS) => {
  if (maxPeriodS === null) return true;
  if (typeof wavePeriodS !== 'number' || !Number.isFinite(wavePeriodS)) return false;
  return wavePeriodS < maxPeriodS;
};

const arrivalFanDir = path.join(root, 'reports/geometry/arrival-fan');
const fansByRegion = new Map();
for (const file of readdirSync(arrivalFanDir)) {
  if (!file.endsWith('.json')) continue;
  fansByRegion.set(file.replace('.json', ''), JSON.parse(readFileSync(path.join(arrivalFanDir, file), 'utf8')).fans || {});
}

const WITNESS_ID = 636;
/** Η περίοδος της αρχικής αναφοράς (16/08 19:00). Κατώφλι κάτω από αυτό δεν τη διορθώνει. */
const WITNESS_ORIGINAL_PERIOD_S = 5.2;
const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

/**
 * Οι δύο γεωμετρίες που το §Μ6 μέτρησε ΚΑΙ διόρθωναν τη Λυγαριά (2.217 και 783 χρώματα), επί τον
 * νέο άξονα. Δεν προστίθενται νέες γεωμετρίες: η ερώτηση είναι «τι κάνει Η ΠΕΡΙΟΔΟΣ», και
 * αλλάζοντας δύο πράγματα ταυτόχρονα δεν μαθαίνεις ποιο από τα δύο μέτρησε.
 */
const CANDIDATES = [
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 24, maxPeriodS: null },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 3, maxPeriodS: null },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 24, maxPeriodS: 7 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 24, maxPeriodS: 6 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 24, maxPeriodS: 5 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 24, maxPeriodS: 4 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 3, maxPeriodS: 7 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 3, maxPeriodS: 6 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 3, maxPeriodS: 5 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 3, maxPeriodS: 4 },
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
  ...c, fired: 0, numberChanged: 0, comfortChanged: 0,
  avoidToCalm: 0, avoidToWild: 0, erasedRealSea: 0,
  maxDrop: 0, dropSum: 0, beaches: new Set(), witnessHours: 0, wentUp: 0,
}));
let scored = 0;
/** Κατανομή περιόδου σε ΟΛΕΣ τις ώρες — απαντάει «διακρίνει καθόλου ο άξονας;» πριν από κάθε ρύθμιση. */
const periodHistogram = { missing: 0, u4: 0, u5: 0, u6: 0, u7: 0, u9: 0, o9: 0 };
const witnessLog = [];

const bucketPeriod = (p) => {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 'missing';
  if (p < 4) return 'u4';
  if (p < 5) return 'u5';
  if (p < 6) return 'u6';
  if (p < 7) return 'u7';
  if (p < 9) return 'u9';
  return 'o9';
};

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
    const mp = profile.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));

    for (const hour of HOURS) {
      const day = days?.[0];
      if (!day?.hourly?.[hour]) continue;
      const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
      const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile };

      const before = calculateBeachScore(beach, slice, undefined, undefined, opts);
      scored += 1;

      const fan = fansByRegion.get(region.id)?.[String(beach.id)];
      const hourMarine = day.hourly[hour]?.marine;
      const waveDirectionDeg = hourMarine?.waveDirectionDeg;
      const wavePeriodS = hourMarine?.wavePeriodS;
      const swellHeightM = hourMarine?.swellWaveHeightM;
      const swellDirectionDeg = hourMarine?.swellWaveDirectionDeg;
      const arrivingSwellPresent = (swellHeightM ?? 0) >= 0.4 && typeof swellDirectionDeg !== 'number';
      periodHistogram[bucketPeriod(wavePeriodS)] += 1;

      /** Ο κανόνας πετάει την ένδειξη του πλέγματος — ίδιο αποτέλεσμα για ΚΑΘΕ ρύθμιση που άναψε,
       *  οπότε υπολογίζεται μία φορά ανά ώρα-παραλίας και όχι μία ανά ρύθμιση. */
      let afterCache;
      const scoreWithoutSea = () => {
        if (afterCache === undefined) {
          afterCache = calculateBeachScore(beach, { ...slice, marine: undefined }, undefined, undefined, opts);
        }
        return afterCache;
      };

      /** Η γεωμετρία δεν εξαρτάται από την περίοδο — υπολογίζεται μία φορά ανά ζεύγος γεωμετρίας. */
      const geometryCache = new Map();
      const geometryFires = (stat) => {
        const key = `${stat.fanDeg}|${stat.maxFetchKm}|${stat.maxOpenSlots}`;
        if (!geometryCache.has(key)) {
          geometryCache.set(key, isSeaArrivalLandBlocked({
            fan, waveDirectionDeg, arrivingSwellPresent,
            fanDeg: stat.fanDeg, maxFetchKm: stat.maxFetchKm, maxOpenSlots: stat.maxOpenSlots,
          }));
        }
        return geometryCache.get(key);
      };

      for (const stat of stats) {
        const fired = geometryFires(stat) && passesPeriodGate(wavePeriodS, stat.maxPeriodS);
        if (fired) stat.fired += 1;
        const after = fired ? scoreWithoutSea() : before;
        if (before.shoreDisplayWaveM === after.shoreDisplayWaveM
          && before.swimmingComfort === after.swimmingComfort) continue;
        stat.numberChanged += 1;
        stat.beaches.add(beach.id);
        if (beach.id === WITNESS_ID) stat.witnessHours += 1;
        if (typeof before.shoreDisplayWaveM === 'number' && typeof after.shoreDisplayWaveM === 'number') {
          const drop = before.shoreDisplayWaveM - after.shoreDisplayWaveM;
          stat.maxDrop = Math.max(stat.maxDrop, drop);
          if (drop > 0) stat.dropSum += drop;
          if (after.shoreDisplayWaveM > before.shoreDisplayWaveM + 0.005) stat.wentUp += 1;
          // Η ΜΕΤΡΗΣΗ ΤΟΥ ΡΙΣΚΟΥ: πόσες φορές σβήνουμε θάλασσα που ήταν ήδη πάνω από την πορτοκαλί
          // γραμμή (0,8 μ.). Εκεί δεν μιλάμε για καλλωπισμό — εκεί στέλνεις κόσμο σε νερό.
          if (before.shoreDisplayWaveM >= 0.8) stat.erasedRealSea += 1;
        }
        if (before.swimmingComfort !== after.swimmingComfort) stat.comfortChanged += 1;
        const wasAvoid = before.swimmingComfort === 'avoid_swimming';
        const isAvoid = after.swimmingComfort === 'avoid_swimming';
        if (wasAvoid && !isAvoid) stat.avoidToCalm += 1;
        if (!wasAvoid && isAvoid) stat.avoidToWild += 1;
      }

      if (beach.id === WITNESS_ID) {
        const w = scoreWithoutSea();
        witnessLog.push({
          hour, wavePeriodS: wavePeriodS ?? null, waveDirectionDeg: waveDirectionDeg ?? null,
          beforeWaveM: before.shoreDisplayWaveM ?? null, afterWaveM: w.shoreDisplayWaveM ?? null,
          beforeComfort: before.swimmingComfort, afterComfort: w.swimmingComfort,
          geometryFiresWide: geometryFires(stats[0]), geometryFiresNarrow: geometryFires(stats[1]),
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

const pct = (n) => `${((n / scored) * 100).toFixed(1)}%`;
console.log(`\nΚΑΤΑΝΟΜΗ ΠΕΡΙΟΔΟΥ σε ${scored} ώρες-παραλίας — ΠΡΙΝ από κάθε κανόνα:`);
console.log(`  <4δ ${periodHistogram.u4} (${pct(periodHistogram.u4)})   4-5δ ${periodHistogram.u5} (${pct(periodHistogram.u5)})   `
  + `5-6δ ${periodHistogram.u6} (${pct(periodHistogram.u6)})   6-7δ ${periodHistogram.u7} (${pct(periodHistogram.u7)})   `
  + `7-9δ ${periodHistogram.u9} (${pct(periodHistogram.u9)})   >=9δ ${periodHistogram.o9} (${pct(periodHistogram.o9)})   `
  + `άγνωστη ${periodHistogram.missing} (${pct(periodHistogram.missing)})`);

console.log('\n ρύθμιση                      │  άναψε   αριθμός  παραλίες  ετυμηγορία  ΧΡΩΜΑ→ήρεμο  →άγριο  σβήνει>=0,8μ  μεγ.πτώση  Λυγαριά');
console.log('──────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────');
for (const s of stats) {
  const gate = s.maxPeriodS === null ? 'χωρίς περίοδο' : `T < ${s.maxPeriodS}δ`;
  const mouth = s.maxOpenSlots === 24 ? 'χωρίς στόμιο' : `στόμιο <=${s.maxOpenSlots * 15}°`;
  console.log(
    `  ${`${gate}, ${mouth}`.padEnd(27)} │ ${String(s.fired).padStart(6)}  ${String(s.numberChanged).padStart(8)}  `
    + `${String(s.beaches.size).padStart(8)}  ${String(s.comfortChanged).padStart(10)}  `
    + `${String(s.avoidToCalm).padStart(11)}  ${String(s.avoidToWild).padStart(6)}  `
    + `${String(s.erasedRealSea).padStart(11)}  ${s.maxDrop.toFixed(2).padStart(9)}  `
    + `${s.witnessHours ? String(s.witnessHours) + ' ώρες ✓' : 'ΟΧΙ ✗'}`
  );
}

console.log(`\nΜΑΡΤΥΡΑΣ #636 ΛΥΓΑΡΙΑ, ανά ώρα (η αρχική αναφορά 16/08 είχε T = ${WITNESS_ORIGINAL_PERIOD_S}δ):`);
for (const w of witnessLog) {
  console.log(`  ${String(w.hour).padStart(2)}:00  T=${w.wavePeriodS ?? '—'}δ  dir=${w.waveDirectionDeg ?? '—'}°  `
    + `${w.beforeWaveM}->${w.afterWaveM} μ.  ${w.beforeComfort}->${w.afterComfort}  `
    + `γεωμετρία: πλατιά=${w.geometryFiresWide ? 'ΝΑΙ' : 'όχι'} στενή=${w.geometryFiresNarrow ? 'ΝΑΙ' : 'όχι'}`);
}

console.log(`\nσυνολικές βαθμολογήσεις ανά ρύθμιση: ${scored}`);

mkdirSync(path.join(root, 'reports/blocked-arrival'), { recursive: true });
writeFileSync(path.join(root, 'reports/blocked-arrival/period-gate-sweep.json'),
  JSON.stringify({
    measuredAt: new Date().toISOString(), scored, periodHistogram,
    witnessId: WITNESS_ID, witnessOriginalPeriodS: WITNESS_ORIGINAL_PERIOD_S, witnessLog,
    candidates: stats.map(s => ({ ...s, beaches: s.beaches.size })),
  }, null, 2), 'utf8');
console.log('γράφτηκε reports/blocked-arrival/period-gate-sweep.json');
