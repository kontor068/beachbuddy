#!/usr/bin/env node
/**
 * Ο ΔΑΠΕΔΟΣ ΡΙΠΗΣ ΑΝΕΒΑΖΕΙ ΤΟΝ ΑΝΕΜΟ — ΚΑΙ ΔΕΝ ΑΓΓΙΖΕΙ ΤΙΠΟΤΑ ΑΛΛΟ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΠΥΛΗ. Στις 18/08/2026 μπήκε ο δάπεδος ριπής (`utils/windGustFloor.ts`,
 * commit 0a350a87): ο ωριαίος μέσος του μοντέλου στρώνει τις κορυφές, οπότε δεν επιτρέπεται να
 * πέσει κάτω από `GUST_FLOOR_FACTOR × ριπή`. Δύο αριθμοί κρατούν όλη τη διόρθωση — 0,50 και
 * 3,5 — και ΚΑΝΕΝΑΣ έλεγχος δεν τους φύλαγε· υπήρχε μόνο μέτρηση (`measureGustFloorImpact`),
 * που κανείς δεν τρέχει πριν από commit. Ο συντελεστής είναι ΑΠΟΦΑΣΗ ΠΡΟΪΟΝΤΟΣ του Μίλτου με
 * τον πίνακα ανταλλαγής μπροστά του, όχι βελτιστοποίηση: αλλάζει μόνο με νέα απόφαση.
 *
 * Και η διόρθωση έχει ήδη δαγκώσει μία φορά τον ίδιο της τον σκοπό: ανεβάζοντας τον μέσο
 * μίκραινε το «ριπή μείον μέσος», και έσβηνε τις προειδοποιήσεις ριπής που ήρθε να ενισχύσει
 * (μετρημένο εθνικά: 918 ώρες-παραλίες έχαναν την πύλη κύματος, 366 το +1 Μποφόρ). Η κύρια
 * διαδρομή διορθώθηκε· το ΕΦΕΔΡΙΚΟ μονοπάτι — όταν λείπει η ωριαία πρόγνωση — έμεινε πίσω και
 * το βρήκε αυτή εδώ η πύλη στις 20/08/2026.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ, με τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις (καμία επανυλοποίηση, καμία κλήση δικτύου):
 *   Α. ΟΙ ΔΥΟ ΠΟΡΤΕΣ. Σε σημείο με στεριά (>0 μ.) ο δάπεδος ισχύει πάντα. Σε σημείο στο 0 ισχύει
 *      ΜΟΝΟ όταν η απάντηση αυτοαναιρείται — λόγος ριπής/μέσου ≥ INCOHERENT_GUST_RATIO.
 *   Β. ΜΟΝΟΔΡΟΜΟ. Σε καμία είσοδο ο δάπεδος δεν βγάζει ΜΙΚΡΟΤΕΡΟ άνεμο από τον ωμό μέσο.
 *   Γ. ΤΑ ΚΕΝΑ ΔΕΝ ΕΦΕΥΡΙΣΚΟΥΝ. Χωρίς έγκυρη ριπή ή χωρίς γνωστό υψόμετρο → μέσος αμετάβλητος.
 *   Δ. ΟΙ ΔΥΟ ΑΡΙΘΜΟΙ. 0,50 και 3,5 — αν μετακινηθούν, η πύλη πέφτει και ζητάει απόφαση.
 *   Ε. Ο ΩΜΟΣ ΜΕΣΟΣ ΕΠΙΒΙΩΝΕΙ ΩΣ ΤΗΝ ΠΡΟΕΙΔΟΠΟΙΗΣΗ, και στα ΔΥΟ μονοπάτια του spread —
 *      με ωριαία πρόγνωση και χωρίς. Οδηγεί το πραγματικό `calculateBeachScore`.
 *   ΣΤ. ΑΥΤΟΣΑΜΠΟΤΑΖ: ξαναπερνάει το Ε με τον ωμό μέσο σβησμένο και ΑΠΑΙΤΕΙ να πέσει η ένταση
 *      της προειδοποίησης. Χωρίς αυτό η πύλη θα περνούσε ακόμα κι αν κάποιος αφαιρούσε τη
 *      διόρθωση.
 *
 * ΔΕΝ ελέγχει αν ο συντελεστής είναι «σωστός» — αυτό το λέει μόνο μέτρηση έναντι ανεμομέτρων
 * (`scripts/auditWindAgainstStations.mjs`, 32.000 ώρες). Ελέγχει ότι δεν αλλάζει σιωπηλά.
 *
 *   node scripts/validateGustFloorContract.mjs
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
  // Το analyticsService αγγίζει browser globals που δεν υπάρχουν εδώ και δεν έχει καμία σχέση με
  // τον άνεμο — ο ίδιος αποκλεισμός που κάνουν όλα τα scripts που φορτώνουν το recommendationService.
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile(
      'exports.getNegativeFeedbackCount = function () { return 0; };'
      + 'exports.recordOpenMeteoCall = function () {};',
      filename
    );
    return;
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { applyGustFloor, GUST_FLOOR_FACTOR, INCOHERENT_GUST_RATIO } = require(path.join(root, 'utils/windGustFloor.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));

/** Οι αποφασισμένες τιμές, 18/08/2026. Δες τη βίβλο και το utils/windGustFloor.ts. */
const DECIDED_FACTOR = 0.50;
const DECIDED_RATIO = 3.5;

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

// ── Α. οι δύο πόρτες ────────────────────────────────────────────────────────
// στεριά: ισχύει πάντα · θάλασσα: μόνο με ασύμβατη απάντηση.
const LAND = 120;
const SEA = 0;
const doorCases = [
  // [μέσος, ριπή, υψόμετρο, περιμένουμε δάπεδο;, γιατί]
  [5, 20, LAND, true, 'στεριά, λόγος 4,0'],
  [12, 20, LAND, false, 'στεριά αλλά ο μέσος είναι ήδη πάνω από το δάπεδο'],
  [10, 20, LAND, true, 'στεριά, λόγος 2,0 — η στεριά δεν ρωτάει λόγο'],
  [10, 20, SEA, false, 'θάλασσα, λόγος 2,0 — η εξαίρεση κρατάει'],
  [5, 20, SEA, true, 'θάλασσα, λόγος 4,0 — η απάντηση αυτοαναιρείται'],
  [4, 14, SEA, true, `θάλασσα, λόγος ακριβώς ${DECIDED_RATIO}`],
  [4, 13.9, SEA, false, `θάλασσα, λόγος λίγο κάτω από ${DECIDED_RATIO}`],
  [0, 20, SEA, false, 'θάλασσα με μηδενικό μέσο — ο λόγος δεν ορίζεται, δεν εφαρμόζεται'],
];
for (const [speed, gust, elev, shouldFire, why] of doorCases) {
  const got = applyGustFloor(speed, gust, elev);
  const expected = shouldFire ? Math.max(speed, gust * GUST_FLOOR_FACTOR) : speed;
  if (got !== expected) fail('Α', `μέσος ${speed} ριπή ${gust} υψ. ${elev} (${why}) → ${got}, περίμενα ${expected}`);
}
console.log(`Α. οι δύο πόρτες ανοίγουν όπου πρέπει ......... ${failures.length ? '❌' : '✅'}`);

// ── Β. μονόδρομο ────────────────────────────────────────────────────────────
const beforeB = failures.length;
for (let speed = 0; speed <= 60; speed += 1.5) {
  for (const gust of [0.1, 1, 5, 12, 20, 35, 55, 90]) {
    for (const elev of [-5, 0, 0.5, 3, 40, 900]) {
      const got = applyGustFloor(speed, gust, elev);
      if (got < speed) fail('Β', `μέσος ${speed} ριπή ${gust} υψ. ${elev}: ο δάπεδος ΚΑΤΕΒΑΣΕ τον άνεμο σε ${got}`);
      if (!Number.isFinite(got)) fail('Β', `μέσος ${speed} ριπή ${gust} υψ. ${elev}: μη έγκυρο αποτέλεσμα ${got}`);
    }
  }
}
console.log(`Β. ο δάπεδος μόνο ανεβάζει .................... ${failures.length > beforeB ? '❌' : '✅'}`);

// ── Γ. τα κενά κρατούν τη σημερινή συμπεριφορά ──────────────────────────────
const beforeC = failures.length;
const gapCases = [
  [8, undefined, LAND, 'χωρίς ριπή'],
  [8, null, LAND, 'ριπή null'],
  [8, 0, LAND, 'ριπή μηδέν'],
  [8, -3, LAND, 'ριπή αρνητική'],
  [8, Number.NaN, LAND, 'ριπή NaN'],
  [8, 40, undefined, 'χωρίς υψόμετρο'],
  [8, 40, null, 'υψόμετρο null'],
  [8, 40, Number.NaN, 'υψόμετρο NaN'],
];
for (const [speed, gust, elev, why] of gapCases) {
  const got = applyGustFloor(speed, gust, elev);
  if (got !== speed) fail('Γ', `${why}: ο δάπεδος εφαρμόστηκε (${speed} → ${got}) ενώ δεν ξέρει πού πατάει`);
}
if (!Number.isNaN(applyGustFloor(Number.NaN, 40, LAND))) fail('Γ', 'μέσος NaN: περίμενα να επιστραφεί αυτούσιος');
console.log(`Γ. χωρίς ριπή ή υψόμετρο δεν αγγίζει τίποτα ... ${failures.length > beforeC ? '❌' : '✅'}`);

// ── Δ. οι δύο αριθμοί δεν μετακινούνται σιωπηλά ─────────────────────────────
const beforeD = failures.length;
if (GUST_FLOOR_FACTOR !== DECIDED_FACTOR) {
  fail('Δ', `GUST_FLOOR_FACTOR ${GUST_FLOOR_FACTOR} ≠ ${DECIDED_FACTOR} — απόφαση προϊόντος 18/08/2026, όχι ελεύθερη παράμετρος`);
}
if (INCOHERENT_GUST_RATIO !== DECIDED_RATIO) {
  fail('Δ', `INCOHERENT_GUST_RATIO ${INCOHERENT_GUST_RATIO} ≠ ${DECIDED_RATIO} — το 3,0 μετρήθηκε και κόπηκε (σταθερό τίμημα ψεύτικου συναγερμού)`);
}
console.log(`Δ. 0,50 και 3,5 στη θέση τους ................. ${failures.length > beforeD ? '❌' : '✅'}`);

// ── Ε. ο ωμός μέσος φτάνει ως την προειδοποίηση, σε ΚΑΙ ΤΑ ΔΥΟ μονοπάτια ────
// Σενάριο: ωμός μέσος 20 χλμ/ώ, ριπή 52 → ο δάπεδος τον σηκώνει στα 26.
//   με τον ΩΜΟ:        spread 32 ≥ 30 → 'warning'
//   με τον ΔΙΟΡΘΩΜΕΝΟ: spread 26 < 30 → 'info'   ← το σβήσιμο που ψάχνουμε
const RAW_KMH = 20;
const FLOORED_KMH = 26;
const GUST_KMH = 52;
const toMs = (kmh) => kmh / 3.6;

const beach = {
  id: 999001, name: { gr: 'Δοκιμή', en: 'Test' }, coordinates: { lat: 37.0, lon: 25.0 },
  region: 'test', facing: 'S', amenities: {}, metadata: {},
};

const hourItem = (hour) => ({
  dt: Math.floor(new Date(2026, 7, 15, hour, 0, 0).getTime() / 1000),
  dt_txt: `2026-08-15 ${String(hour).padStart(2, '0')}:00:00`,
  main: { temp: 28, temp_min: 26, temp_max: 30, pressure: 1013, sea_level: 1013, grnd_level: 1013, humidity: 50, temp_kf: 0 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  clouds: { all: 0 },
  wind: { speed: toMs(FLOORED_KMH), speedBeforeGustFloor: toMs(RAW_KMH), deg: 0, gust: toMs(GUST_KMH) },
  visibility: 10000, pop: 0, sys: { pod: 'd' },
});

const forecastFor = (hourly) => ({
  date: new Date(2026, 7, 15),
  wind: { speed: toMs(FLOORED_KMH), speedBeforeGustFloor: toMs(RAW_KMH), deg: 0, gust: toMs(GUST_KMH) },
  weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
  temp_min: 26, temp_max: 30,
  hourly,
});

/** Η ένταση της προειδοποίησης ριπής, όπως θα την έβλεπε ο χρήστης. */
const gustSeverity = (dayForecast) => {
  const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
    weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly,
  });
  return score.warnings?.find(w => w.type === 'gusty_wind')?.severity;
};

const beforeE = failures.length;
const WITH_HOURS = forecastFor([hourItem(11), hourItem(13), hourItem(15)]);
const WITHOUT_HOURS = forecastFor([]);

const severityWithHours = gustSeverity(WITH_HOURS);
if (severityWithHours !== 'warning') {
  fail('Ε', `με ωριαία πρόγνωση η προειδοποίηση βγήκε '${severityWithHours}' αντί για 'warning' — το spread μετρήθηκε από τον ανεβασμένο μέσο`);
}
const severityWithoutHours = gustSeverity(WITHOUT_HOURS);
if (severityWithoutHours !== 'warning') {
  fail('Ε', `ΧΩΡΙΣ ωριαία πρόγνωση η προειδοποίηση βγήκε '${severityWithoutHours}' αντί για 'warning' — το εφεδρικό μονοπάτι διαβάζει τον διορθωμένο μέσο`);
}
console.log(`Ε. ο ωμός μέσος επιβιώνει στα δύο μονοπάτια ... ${failures.length > beforeE ? '❌' : '✅'}`);

// ── ΣΤ. αυτοσαμποτάζ ────────────────────────────────────────────────────────
// Σβήνουμε τον ωμό μέσο, όπως θα τον έσβηνε κάποιος που αφαιρεί τη διόρθωση, και ΑΠΑΙΤΟΥΜΕ να
// πέσει η ένταση. Αν δεν πέσει, το Ε είναι διακοσμητικό και δεν πιάνει τίποτα.
const beforeF = failures.length;
const strip = (f) => ({
  ...f,
  wind: { ...f.wind, speedBeforeGustFloor: undefined },
  hourly: f.hourly.map(h => ({ ...h, wind: { ...h.wind, speedBeforeGustFloor: undefined } })),
});
for (const [label, forecast] of [['με ωριαία', WITH_HOURS], ['χωρίς ωριαία', WITHOUT_HOURS]]) {
  const sabotaged = gustSeverity(strip(forecast));
  if (sabotaged === 'warning') {
    fail('ΣΤ', `${label}: σβήνοντας τον ωμό μέσο η ένταση έμεινε 'warning' — η πύλη δεν μπορεί να πιάσει αφαίρεση της διόρθωσης`);
  }
}
console.log(`ΣΤ. το αυτοσαμποτάζ πιάνεται ................. ${failures.length > beforeF ? '❌' : '✅'}`);

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα(τα).`);
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`);
  console.error('\nΕΠΟΜΕΝΟ ΒΗΜΑ: μην περάσεις την πύλη χαλαρώνοντας κανόνα.');
  console.error('· Αν έπεσε το Δ: το 0,50 και το 3,5 είναι ΑΠΟΦΑΣΗ, όχι ρύθμιση. Διάβασε τον πίνακα');
  console.error('  ανταλλαγής στο utils/windGustFloor.ts (κάθε σκαλί πάνω κόβει ψεύτικες ηρεμίες και');
  console.error('  προσθέτει ψεύτικους συναγερμούς) και ζήτα νέα απόφαση πριν αλλάξεις τη σταθερά εδώ.');
  console.error('· Αν έπεσε το Ε: κάπου το «ριπή μείον μέσος» μετριέται από τον ΔΙΟΡΘΩΜΕΝΟ μέσο. Ο ωμός');
  console.error('  ζει στο wind.speedBeforeGustFloor και υπάρχει ΜΟΝΟ για αυτό — δες types.ts:820.');
  console.error('· Αν έπεσε το Α: η εξαίρεση του θαλασσινού σημείου είναι μισή διόρθωση, όχι λεπτομέρεια·');
  console.error('  αφορά το 47,6% των σημείων ανέμου της χώρας.');
  process.exit(1);
}
console.log(`\nPASSED: δάπεδος ${GUST_FLOOR_FACTOR} · λόγος ${INCOHERENT_GUST_RATIO} · ο ωμός μέσος φτάνει ακέραιος στις προειδοποιήσεις ριπής.`);
