#!/usr/bin/env node
/**
 * ΠΟΣΟ ΣΥΧΝΑ ΘΑ ΜΙΛΟΥΣΕ Η ΦΡΑΣΗ «Ο ΑΕΡΑΣ ΕΡΧΕΤΑΙ ΑΠΟ ΤΗ ΣΤΕΡΙΑ» ΑΝ ΚΑΤΕΒΑΙΝΕ ΣΤΑ 3 ΜΠΟΦΟΡ;
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (12/09/2026). Πυργάκι Νάξου #2013, 11/09 + 12/09, «πιο πολύ αέρα»: οθόνη «3–4 Μπφ»,
 * απόγειος, κύμα 0,06 μ., METAR LGNX 18,5-20 χλμ/ώ (ο αριθμός σωστός), ριπές μοντέλου 28-34 στην άμμο.
 * Ίδια κλάση με την Καστέλια Καρπάθου 15/08. Η μορφή `wind-feels-less` (24/08) δεν άναβε — κάτω όριο
 * 4 Μπφ — και ούτως ή άλλως έλεγε το ΑΝΤΙΘΕΤΟ («στην παραλία θα τον νιώσεις πιο λίγο»).
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Τη ΜΙΚΡΗ-ΚΥΜΑ διακλάδωση της `resolveOffshoreWindNote` (κύμα ακτής <0,40, αέρας πάνω από
 * στεριά ±45°, confidence high, όχι «μην κολυμπήσεις») με τρία κάτω όρια:
 *   τώρα   — μέσος 4-5 Μπφ (όπως είναι live)
 *   Α      — ΚΑΙ μέσος 3 Μπφ όταν το τυπωμένο εύρος φτάνει τα 4 (οι ριπές βγάζουν σκαλί, «3–4 Μπφ»)
 *   Α-ριπή5 — ΚΑΙ μέσος 3 Μπφ μόνο όταν η ριπή της ώρας φτάνει 5 Μπφ (≥29 χλμ/ώ· Πυργάκι 28-34)
 *   Α-χαλαρό — ΚΑΙ κάθε μέσος 3 Μπφ, με ή χωρίς εύρος (για να φανεί τι φιλτράρει το εύρος)
 * Ο κώδικας της εφαρμογής καλείται όπως είναι: ίδιο σκορ, ίδιο τυπωμένο κύμα, ίδιο εύρος Μποφόρ,
 * ίδιο `windShadow` που φτάνει στον browser.
 *
 * ΚΡΙΤΗΡΙΟ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΡΕΞΕΙ (ίδιο με τη μέτρηση της 21/08): >10% των ωρών ή >15% των
 * παραλιών-ημερών = ταπετσαρία, δεν μπαίνει ως έχει. Και πρέπει να ανάβει στο Πυργάκι όταν η οθόνη
 * λέει «3–4» με απόγειο.
 *
 * Report-only. Πόρτα: `OPEN_METEO_API_KEY= node scripts/measureOffshoreWindNoteAtThree.mjs` για
 * τη δωρεάν (με φρενάρισμα)· με το κλειδί του μηχανήματος τρέχει κανονικά (πρόγνωση, όχι αρχείο).
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
const {
  resolveOffshoreWindNote, windArrivedOverLand, OFFSHORE_NOTE_MIN_WAVE_M,
} = require(path.join(root, 'utils/offshoreWindNote.ts'));

const WITNESS_ID = 2013;
const DAYS = 6;
const HOURS = Array.from({ length: 11 }, (_, index) => index + 9); // 09-19, οι ώρες μπάνιου
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

const RULES = ['now', 'A', 'A-gust5', 'A-loose'];
const stats = Object.fromEntries(RULES.map(r => [r, { hours: 0, beachDays: new Set(), beaches: new Set(), atThree: 0 }]));
let scored = 0;
let beachesSeen = 0;
let bigWaveFormsHours = 0;
const beachDaysSeen = new Set();
const witnessLog = [];

const regions = [];
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  if (!island?.beaches?.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  regions.push({ id: file.replace('.json', ''), beaches: island.beaches, profiles });
}

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
    const windData = byBeach.get(beach.id);
    if (!windData) continue;
    const mp = profile?.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));
    beachesSeen += 1;

    for (let d = 0; d < Math.min(DAYS, days?.length ?? 0); d += 1) {
      const day = days[d];
      for (const hour of HOURS) {
        if (!day?.hourly?.[hour]) continue;
        const h = day.hourly[hour];
        const slice = { ...day, ...h, hourly: day.hourly };
        const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile };
        const score = calculateBeachScore(beach, slice, undefined, undefined, opts);
        scored += 1;
        beachDaysSeen.add(`${beach.id}/${d}`);

        // ⚠️ ΜΟΝΑΔΕΣ: wind.speed είναι μ/δευτ. — ο recommendationService το πολλαπλασιάζει επί 3,6.
        const windKmh = typeof h.wind?.speed === 'number' ? h.wind.speed * 3.6 : undefined;
        const bft = getBeaufortLevel(windKmh);
        const high = score.displayedBeaufortHigh;
        const input = {
          profile, windFromDeg: h.wind?.deg, beaufort: bft,
          displayWaveM: score.shoreDisplayWaveM,
          swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
        };
        const form = resolveOffshoreWindNote(input);
        if (form && form !== 'wind-feels-less') bigWaveFormsHours += 1;

        // Η μικρή-κύμα διακλάδωση στα 3 Μπφ: ίδιοι όλοι οι έλεγχοι, απλώς ρωτάμε τη μηχανή με
        // beaufort 4 ώστε να περάσει το κάτω όριο — και μετά κρίνουμε εμείς τα 3.
        const smallWaveAtThree = bft === 3
          && typeof input.displayWaveM === 'number' && input.displayWaveM < OFFSHORE_NOTE_MIN_WAVE_M
          && resolveOffshoreWindNote({ ...input, beaufort: 4 }) === 'wind-feels-less';

        const gustKmh = typeof h.wind?.gust === 'number' ? h.wind.gust * 3.6 : undefined;
        const fires = {
          now: form === 'wind-feels-less',
          A: form === 'wind-feels-less' || (smallWaveAtThree && typeof high === 'number' && high >= 4),
          'A-gust5': form === 'wind-feels-less' || (smallWaveAtThree && typeof gustKmh === 'number' && getBeaufortLevel(gustKmh) >= 5),
          'A-loose': form === 'wind-feels-less' || smallWaveAtThree,
        };
        for (const rule of RULES) {
          if (!fires[rule]) continue;
          const s = stats[rule];
          s.hours += 1;
          s.beachDays.add(`${beach.id}/${d}`);
          s.beaches.add(beach.id);
          if (bft === 3) s.atThree += 1;
        }

        if (beach.id === WITNESS_ID) {
          witnessLog.push({
            day: d, hour, windFromDeg: h.wind?.deg ?? null, bft, high: high ?? null,
            waveM: input.displayWaveM ?? null, overLand: windArrivedOverLand(profile?.windShadow, h.wind?.deg),
            gustKmh: gustKmh ?? null, now: fires.now, A: fires.A, gust5: fires['A-gust5'],
          });
        }
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

const pct = (n, total) => `${((n / total) * 100).toFixed(2)}%`;
console.log(`\n${scored} ώρες-παραλίας (${DAYS} μέρες × 09-19), ${beachesSeen} παραλίες, ${beachDaysSeen.size} παραλίες-ημέρες.`);
console.log(`(οι δύο μορφές του ΚΥΜΑΤΟΣ, που δεν αλλάζουν: ${bigWaveFormsHours} ώρες, ${pct(bigWaveFormsHours, scored)})\n`);
console.log(' κανόνας  │  ώρες    % ωρών │ παραλίες-ημέρες  % │ παραλίες │ από αυτές στα 3 Μπφ');
for (const rule of RULES) {
  const s = stats[rule];
  console.log(`  ${rule.padEnd(8)}│ ${String(s.hours).padStart(6)}  ${pct(s.hours, scored).padStart(7)} │ `
    + `${String(s.beachDays.size).padStart(8)}  ${pct(s.beachDays.size, beachDaysSeen.size).padStart(7)} │ `
    + `${String(s.beaches.size).padStart(8)} │ ${s.atThree}`);
}

const witnessHits = witnessLog.filter(w => w.A && w.bft === 3);
console.log(`\nΜΑΡΤΥΡΑΣ #${WITNESS_ID} ΠΥΡΓΑΚΙ: ${witnessLog.length} ώρες, ${witnessLog.filter(w => w.now).length} ανάβει τώρα, `
  + `${witnessLog.filter(w => w.A).length} με το Α (${witnessHits.length} από αυτές στα 3 Μπφ)`);
for (const w of witnessLog.filter(w => w.overLand && w.bft >= 3)) {
  console.log(`  μέρα ${w.day} ${String(w.hour).padStart(2)}:00  από ${String(w.windFromDeg).padStart(3)}°  `
    + `${w.bft}${w.high ? '–' + w.high : ''} Μπφ  ριπή ${w.gustKmh?.toFixed(0)}  κύμα ${w.waveM}  →  `
    + `τώρα ${w.now ? '✓' : '·'}  Α ${w.A ? '✓' : '·'}  Α-ριπή5 ${w.gust5 ? '✓' : '·'}`);
}

mkdirSync(path.join(root, 'reports/offshore-wind-note'), { recursive: true });
writeFileSync(path.join(root, 'reports/offshore-wind-note/frequency-at-three.json'),
  JSON.stringify({
    measuredAt: new Date().toISOString(), scored, beachesSeen, beachDays: beachDaysSeen.size,
    days: DAYS, hours: HOURS, bigWaveFormsHours,
    rules: Object.fromEntries(RULES.map(r => [r, {
      hours: stats[r].hours, beachDays: stats[r].beachDays.size, beaches: stats[r].beaches.size, atThree: stats[r].atThree,
    }])),
    witnessId: WITNESS_ID, witnessLog,
  }, null, 2), 'utf8');
console.log('\nγράφτηκε reports/offshore-wind-note/frequency-at-three.json');
