#!/usr/bin/env node
/**
 * ΜΙΚΡΟΤΕΡΟ ΚΥΜΑ ΔΕΝ ΒΓΑΖΕΙ ΠΟΤΕ ΑΥΣΤΗΡΟΤΕΡΗ ΛΕΞΗ — Η ΠΥΛΗ ΜΟΝΟΤΟΝΙΑΣ (νήμα 16, 14/09/2026).
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΗ ΓΕΝΝΑΕΙ. Στη μέτρηση της ξυστής θάλασσας (`reports/weather/grazing-sea-impact-live.json`)
 * βρέθηκαν **3 ώρες** όπου, ρίχνοντας το ύψος της ακτής 0,50 → 0,43 μ., η ετυμηγορία πήγε
 * `caution` → **`avoid_swimming`**: λιγότερο κύμα, χειρότερη συμβουλή. Μικρό, αλλά ανεξήγητο — και
 * σε σύστημα που συμβουλεύει κόσμο για τη θάλασσα, το ανεξήγητο γίνεται κάποτε μεγάλο.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΑΔΥΝΑΤΟ ΝΑ ΕΙΝΑΙ ΣΩΣΤΟ. Η ετυμηγορία βγαίνει από `swimmingComfortFromScore`, που
 * παίρνει τη ΜΙΛΔΟΤΕΡΗ από δύο απαντήσεις (ανοιχτού νερού και ακτής) με ταβάνι ένα σκαλί. Ένα
 * μικρότερο ύψος ακτής δεν έχει δρόμο να κατεβάσει το αποτέλεσμα. Αν το κατεβάζει, τότε κάποιος
 * άλλος όρος διαβάζει το ίδιο ύψος και γυρίζει ανάποδα — πρώτος ύποπτος ο `relievesOverCaution`
 * (§Γ57), που ανεβάζει `avoid_swimming` → `caution` **μόνο κάτω από 0,6 μ.**
 *
 * ΤΙ ΚΑΝΕΙ ΑΥΤΗ Η ΠΥΛΗ. Οδηγεί την ΠΡΑΓΜΑΤΙΚΗ μηχανή (`calculateBeachScore`) πάνω σε σκάλα υψών
 * **ανά 1 εκατοστό**, με ΟΛΑ τα υπόλοιπα σταθερά, σε πολλά περιβάλλοντα (έκθεση × Μποφόρ × περίοδος
 * × γωνία κύματος), και απαιτεί **μονοτονία**: καθώς το κύμα ανεβαίνει, η ετυμηγορία δεν γίνεται
 * ΠΟΤΕ ηπιότερη· ισοδύναμα, μικρότερο κύμα δεν βγάζει ποτέ αυστηρότερη λέξη. Κάθε αντιστροφή
 * τυπώνεται με τα ακριβή της νούμερα, ώστε να διορθωθεί η ΑΙΤΙΑ και όχι το σύμπτωμα.
 *
 * ΠΡΟΣΟΧΗ ΣΤΗ ΦΟΡΑ. Η πύλη ΔΕΝ λέει «η ετυμηγορία πρέπει να χειροτερεύει» — λέει «δεν επιτρέπεται
 * να ΚΑΛΥΤΕΡΕΥΕΙ με περισσότερο κύμα». Ίδια λέξη σε διαδοχικά σκαλιά είναι φυσιολογική και συχνή.
 *
 * ΑΥΤΟΣΑΜΠΟΤΑΖ (--prove): περνάει την ίδια σκάλα από μια σκόπιμα ανάποδη συνάρτηση και ΑΠΑΙΤΕΙ να
 * πέσει. Χωρίς αυτό, μια πύλη που δεν μπορεί να αποτύχει είναι διακόσμηση.
 *
 *   node scripts/validateVerdictWaveMonotonicity.mjs [--prove] [--step=0.01] [--max-report=12]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));

const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : fallback; };
const PROVE = process.argv.includes('--prove');
const STEP = Number(argVal('--step', '0.01'));
const MAX_REPORT = Number(argVal('--max-report', '12'));

/** Πόσο ΑΥΣΤΗΡΗ είναι η λέξη. Μεγαλύτερο = χειρότερα νέα για τον κολυμβητή. */
const SEVERITY = { excellent: 0, good: 1, caution: 2, avoid_swimming: 3 };

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const profile = (facingDeg, level, fetchKm, intensity) => ({
  beachId: 999160, confidence: 'high', facingDeg,
  sectors: Object.fromEntries(SECTORS.map(key => [key, { fetchKm, blockedRayRatio: 0.5, onshore: 0.5, intensity, level }])),
});
const beach = {
  id: 999160, name: { gr: 'Δοκιμή μονοτονίας κύματος', en: 'Wave monotonicity test' },
  coordinates: { lat: 37.0, lon: 25.0 }, region: 'test', facing: 'S', amenities: {},
  metadata: { confidence: 'high' }, orientation: { facingDeg: 180, confidence: 'high' },
};
const toMs = (kmh) => kmh / 3.6;
const hourItem = (hour, windKmh, windDeg) => ({
  dt: Math.floor(new Date(2026, 7, 15, hour, 0, 0).getTime() / 1000),
  dt_txt: `2026-08-15 ${String(hour).padStart(2, '0')}:00:00`,
  main: { temp: 28, temp_min: 26, temp_max: 30, pressure: 1013, sea_level: 1013, grnd_level: 1013, humidity: 50, temp_kf: 0 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  clouds: { all: 0 },
  wind: { speed: toMs(windKmh), speedBeforeGustFloor: toMs(windKmh), deg: windDeg, gust: toMs(windKmh * 1.15) },
  visibility: 10000, pop: 0, sys: { pod: 'd' },
});
const dayWith = ({ waveHeightM, wavePeriodS, waveDirectionDeg, windKmh, windDeg, swellM }) => ({
  date: new Date(2026, 7, 15),
  wind: { speed: toMs(windKmh), speedBeforeGustFloor: toMs(windKmh), deg: windDeg, gust: toMs(windKmh * 1.15) },
  weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
  temp_min: 26, temp_max: 30,
  hourly: [11, 13, 15, 17, 19].map(h => hourItem(h, windKmh, windDeg)),
  marine: { waveHeightM, wavePeriodS, swellWaveHeightM: swellM, swellWaveDirectionDeg: waveDirectionDeg, swellWavePeriodS: wavePeriodS, waveDirectionDeg, seaSurfaceTemperatureC: 26 },
});

/** Τα περιβάλλοντα: ό,τι αλλάζει ΕΚΤΟΣ από το ύψος. Το ύψος είναι ο μόνος άξονας της σκάλας. */
const CONTEXTS = [];
for (const [level, fetchKm, intensity] of [['protected', 2, 20], ['partial', 10, 40], ['exposed', 25, 75]]) {
  for (const windKmh of [8, 16, 24, 32, 42]) {
    for (const wavePeriodS of [4, 6, 9]) {
      // ΓΩΝΙΑ ΚΥΜΑΤΟΣ: 180 = κατάμουτρα (onshore +1) · 225/270 = λοξά/ξυστά · 315/0 = ΦΕΥΓΕΙ από την
      // ακτή (onshore αρνητικό). Το τελευταίο ΕΛΕΙΠΕ στην πρώτη εκδοχή (14/09) και ήταν ακριβώς η
      // περίπτωση του Πρασονησίου #2457 (ακτή 132°, κύμα 287°, onshore −0,904) που γέννησε το νήμα.
      for (const waveDirectionDeg of [180, 225, 270, 315, 0]) {
        CONTEXTS.push({ level, fetchKm, intensity, windKmh, windDeg: 180, wavePeriodS, waveDirectionDeg, swellM: 0 });
      }
    }
  }
}

const LADDER = [];
for (let h = 0.10; h <= 1.6005; h += STEP) LADDER.push(Number(h.toFixed(2)));

const verdictFor = (ctx, waveHeightM) => {
  const forecast = dayWith({ ...ctx, waveHeightM });
  const score = calculateBeachScore(beach, forecast, undefined, undefined, {
    weatherSource: 'beach-cluster', hourlyForecast: forecast.hourly, geospatialProfile: profile(180, ctx.level, ctx.fetchKm, ctx.intensity),
  });
  return score?.swimmingComfort ?? null;
};

const runLadder = (readVerdict) => {
  const inversions = [];
  let steps = 0, nullVerdicts = 0;
  for (const ctx of CONTEXTS) {
    let prev = null, prevH = null;
    for (const h of LADDER) {
      const v = readVerdict(ctx, h);
      steps += 1;
      if (v === null) { nullVerdicts += 1; continue; }
      if (prev !== null && SEVERITY[v] < SEVERITY[prev]) {
        inversions.push({ ...ctx, fromM: prevH, toM: h, fromVerdict: prev, toVerdict: v });
      }
      prev = v; prevH = h;
    }
  }
  return { inversions, steps, nullVerdicts };
};

console.log('Μικρότερο κύμα δεν βγάζει ποτέ αυστηρότερη λέξη — πύλη μονοτονίας (νήμα 16)\n');
console.log(`  σκάλα ${LADDER[0]} → ${LADDER[LADDER.length - 1]} μ. ανά ${STEP} μ. (${LADDER.length} σκαλιά) × ${CONTEXTS.length} περιβάλλοντα`);
const real = runLadder(verdictFor);
console.log(`  ${real.steps.toLocaleString('el')} κλήσεις της πραγματικής μηχανής${real.nullVerdicts ? ` · ${real.nullVerdicts} χωρίς ετυμηγορία` : ''}`);

const failures = [];
if (real.inversions.length) {
  failures.push(`Α. ${real.inversions.length} αντιστροφές: περισσότερο κύμα έδωσε ΗΠΙΟΤΕΡΗ λέξη`);
  const byPair = {};
  for (const i of real.inversions) byPair[`${i.fromVerdict}→${i.toVerdict}`] = (byPair[`${i.fromVerdict}→${i.toVerdict}`] || 0) + 1;
  console.log(`FAIL Α. ${real.inversions.length} αντιστροφές μονοτονίας · ${JSON.stringify(byPair)}`);
  for (const i of real.inversions.slice(0, MAX_REPORT)) {
    console.log(`       ${i.level} · ${i.windKmh} χλμ/ώ · περίοδος ${i.wavePeriodS}δλ · κύμα από ${i.waveDirectionDeg}° : `
      + `${i.fromM} μ. → «${i.fromVerdict}»  ΑΛΛΑ  ${i.toM} μ. → «${i.toVerdict}»`);
  }
  if (real.inversions.length > MAX_REPORT) console.log(`       …και άλλες ${real.inversions.length - MAX_REPORT}`);
} else {
  console.log(`OK   Α. καμία αντιστροφή σε ${real.steps.toLocaleString('el')} βήματα — η ετυμηγορία δεν καλυτερεύει ποτέ με περισσότερο κύμα`);
}

// ── Αυτοσαμποτάζ: η πύλη ΠΡΕΠΕΙ να πέφτει σε ανάποδη συνάρτηση ────────────────────────────────
if (PROVE) {
  const sabotage = (ctx, h) => (h > 0.8 ? 'good' : 'avoid_swimming'); // ανάποδη εξ ορισμού
  const proven = runLadder(sabotage);
  if (proven.inversions.length) console.log(`OK   Β. αυτοσαμποτάζ: η ανάποδη συνάρτηση έδωσε ${proven.inversions.length} αντιστροφές — η πύλη ΜΠΟΡΕΙ να πέσει`);
  else { failures.push('Β. το αυτοσαμποτάζ πέρασε — η πύλη δεν μπορεί να αποτύχει, άρα δεν φυλάει τίποτα'); console.log('FAIL Β. το αυτοσαμποτάζ πέρασε'); }
}

console.log(failures.length ? `\nΕΠΕΣΕ: ${failures.length}` : '\nΠΕΡΑΣΕ: η ετυμηγορία είναι μονότονη ως προς το ύψος του κύματος.');
process.exit(failures.length ? 1 : 0);
