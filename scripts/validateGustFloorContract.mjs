#!/usr/bin/env node
/**
 * Η ΔΙΟΡΘΩΣΗ ΑΝΕΜΟΥ ΑΝΕΒΑΖΕΙ ΤΟΝ ΑΝΕΜΟ — ΚΑΙ ΔΕΝ ΑΓΓΙΖΕΙ ΤΙΠΟΤΑ ΑΛΛΟ.
 *
 * ⚠️ 24/08/2026: το χερσαίο σκέλος ΑΛΛΑΞΕ από «δάπεδος ριπής» σε «γραμμική αποσυμπίεση
 * a + b×v» (μετρημένο σε 4 παράθυρα/30 σταθμούς, απόφαση Μίλτου — δες utils/windGustFloor.ts
 * και reports/weather/wind-decompression-2026-08-24.json). Ο δάπεδος ριπής ζει πλέον ΜΟΝΟ στη
 * θαλάσσια πόρτα. Η πύλη καρφώνει και τα δύο σκέλη, τους τέσσερις αριθμούς, ΚΑΙ την ισοδυναμία
 * μονάδων (η τομή είναι σε χλμ/ώ ενώ η κύρια διαδρομή τρέχει σε m/s). Το ιστορικό από κάτω
 * παραμένει — εξηγεί γιατί υπάρχει πύλη.
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

const { applyGustFloor, GUST_FLOOR_FACTOR, INCOHERENT_GUST_RATIO, WIND_DECOMP_INTERCEPT_KMH, WIND_DECOMP_SLOPE } =
  require(path.join(root, 'utils/windGustFloor.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));

/** Οι αποφασισμένες τιμές: 0,50/3,5 (18/08/2026, θαλάσσια πόρτα) · a/b (24/08/2026, χερσαία
 * αποσυμπίεση — reports/weather/wind-decompression-2026-08-24.json, shipFit). */
const DECIDED_FACTOR = 0.50;
const DECIDED_RATIO = 3.5;
const DECIDED_INTERCEPT_KMH = 2.392;
const DECIDED_SLOPE = 1.0005;
const linearKmh = v => Math.max(v, DECIDED_INTERCEPT_KMH + DECIDED_SLOPE * v);

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

// ── Α. οι δύο πόρτες — και από 24/08/2026 δύο ΔΙΑΦΟΡΕΤΙΚΕΣ διορθώσεις ──────
// στεριά: γραμμική αποσυμπίεση, πάντα, χωρίς να ρωτά τη ριπή · θάλασσα: μόνο με
// αυτοαναιρούμενη απάντηση, και εκεί ισχύει ο ΠΑΛΙΟΣ δάπεδος ριπής.
const LAND = 120;
const SEA = 0;
const doorCases = [
  // [μέσος, ριπή, υψόμετρο, αναμενόμενο, γιατί]
  [5, 20, LAND, linearKmh(5), 'στεριά, λόγος 4,0 — αποσυμπίεση, ΟΧΙ δάπεδος (ο δάπεδος θα έλεγε 10)'],
  [12, 20, LAND, linearKmh(12), 'στεριά — η αποσυμπίεση εφαρμόζεται και όταν ο παλιός δάπεδος θα σιωπούσε'],
  [10, 20, LAND, linearKmh(10), 'στεριά, λόγος 2,0 — η στεριά δεν ρωτάει λόγο'],
  [10, undefined, LAND, linearKmh(10), 'στεριά ΧΩΡΙΣ ριπή — η αποσυμπίεση δεν τη χρειάζεται (κενό του δαπέδου, κλεισμένο)'],
  [10, 20, SEA, 10, 'θάλασσα, λόγος 2,0 — η εξαίρεση κρατάει, ΚΑΜΙΑ αποσυμπίεση πάνω από νερό'],
  [5, 20, SEA, Math.max(5, 20 * GUST_FLOOR_FACTOR), 'θάλασσα, λόγος 4,0 — αυτοαναιρούμενη απάντηση → παλιός δάπεδος'],
  [4, 14, SEA, Math.max(4, 14 * GUST_FLOOR_FACTOR), `θάλασσα, λόγος ακριβώς ${DECIDED_RATIO}`],
  [4, 13.9, SEA, 4, `θάλασσα, λόγος λίγο κάτω από ${DECIDED_RATIO}`],
  [0, 20, SEA, 0, 'θάλασσα με μηδενικό μέσο — ο λόγος δεν ορίζεται, δεν εφαρμόζεται'],
];
for (const [speed, gust, elev, expected, why] of doorCases) {
  const got = applyGustFloor(speed, gust, elev);
  if (Math.abs(got - expected) > 1e-9) fail('Α', `μέσος ${speed} ριπή ${gust} υψ. ${elev} (${why}) → ${got}, περίμενα ${expected}`);
}
console.log(`Α. οι δύο πόρτες ανοίγουν όπου πρέπει ......... ${failures.length ? '❌' : '✅'}`);

// ── Α2. η ισοδυναμία μονάδων — η τομή έχει μονάδα, το λάθος είναι ×3,6 ──────
// Η κύρια διαδρομή (weatherService) καλεί σε m/s· τα εργαλεία και το nationalConditions σε
// km/h. Το ΙΔΙΟ φύσημα πρέπει να πάρει την ΙΔΙΑ διόρθωση όποια μονάδα κι αν φοράει.
{
  const beforeA2 = failures.length;
  for (const kmh of [3, 8, 15, 26, 41, 60]) {
    const viaKmh = applyGustFloor(kmh, kmh * 1.4, LAND, 'kmh');
    const viaMs = applyGustFloor(kmh / 3.6, (kmh * 1.4) / 3.6, LAND, 'ms') * 3.6;
    if (Math.abs(viaKmh - viaMs) > 1e-6) {
      fail('Α2', `${kmh} χλμ/ώ: μέσω kmh → ${viaKmh}, μέσω ms → ${viaMs} — οι δύο μονάδες διαφωνούν`);
    }
  }
  // Και το ανάποδο δίχτυ: αν κάποιος περάσει m/s ΧΩΡΙΣ να το δηλώσει, το αποτέλεσμα πρέπει να
  // γέρνει προς τα ΠΑΝΩ (ψεύτικος συναγερμός), ποτέ προς την ψεύτικη ηρεμία.
  for (const ms of [1, 4, 9]) {
    if (applyGustFloor(ms, null, LAND) < applyGustFloor(ms, null, LAND, 'ms')) {
      fail('Α2', `μέσος ${ms}: η αδήλωτη μονάδα έβγαλε ΛΙΓΟΤΕΡΟ άνεμο από τη σωστή — το λάθος πλευρίζει την ψεύτικη ηρεμία`);
    }
  }
  console.log(`Α2. kmh και ms παίρνουν την ίδια διόρθωση ..... ${failures.length > beforeA2 ? '❌' : '✅'}`);
}

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
// Η αποσυμπίεση χρειάζεται ΜΟΝΟ το υψόμετρο· χωρίς αυτό δεν ξέρει πού πατάει και σιωπά.
// Στη ΘΑΛΑΣΣΑ η ριπή παραμένει προϋπόθεση (ο δάπεδος τη χρειάζεται) — άκυρη ριπή = σιωπή.
const gapCases = [
  [8, 40, undefined, 8, 'χωρίς υψόμετρο — καμία διόρθωση δεν ξέρει πού πατάει'],
  [8, 40, null, 8, 'υψόμετρο null'],
  [8, 40, Number.NaN, 8, 'υψόμετρο NaN'],
  [8, undefined, SEA, 8, 'θάλασσα χωρίς ριπή — η πόρτα της ασυνέπειας δεν έχει τι να μετρήσει'],
  [8, 0, SEA, 8, 'θάλασσα, ριπή μηδέν'],
  [8, -3, SEA, 8, 'θάλασσα, ριπή αρνητική'],
  [8, Number.NaN, SEA, 8, 'θάλασσα, ριπή NaN'],
  // Στη στεριά η άκυρη ριπή ΔΕΝ σταματά πια την αποσυμπίεση — αυτό είναι το κλεισμένο κενό.
  [8, 0, LAND, linearKmh(8), 'στεριά, ριπή μηδέν — η αποσυμπίεση δεν τη ρωτά'],
  [8, Number.NaN, LAND, linearKmh(8), 'στεριά, ριπή NaN — ομοίως'],
];
for (const [speed, gust, elev, expected, why] of gapCases) {
  const got = applyGustFloor(speed, gust, elev);
  if (Math.abs(got - expected) > 1e-9) fail('Γ', `${why}: ${speed} → ${got}, περίμενα ${expected}`);
}
if (!Number.isNaN(applyGustFloor(Number.NaN, 40, LAND))) fail('Γ', 'μέσος NaN: περίμενα να επιστραφεί αυτούσιος');
console.log(`Γ. τα κενά σιωπούν εκεί που πρέπει ............ ${failures.length > beforeC ? '❌' : '✅'}`);

// ── Δ. οι δύο αριθμοί δεν μετακινούνται σιωπηλά ─────────────────────────────
const beforeD = failures.length;
if (GUST_FLOOR_FACTOR !== DECIDED_FACTOR) {
  fail('Δ', `GUST_FLOOR_FACTOR ${GUST_FLOOR_FACTOR} ≠ ${DECIDED_FACTOR} — απόφαση προϊόντος 18/08/2026, όχι ελεύθερη παράμετρος`);
}
if (INCOHERENT_GUST_RATIO !== DECIDED_RATIO) {
  fail('Δ', `INCOHERENT_GUST_RATIO ${INCOHERENT_GUST_RATIO} ≠ ${DECIDED_RATIO} — το 3,0 μετρήθηκε και κόπηκε (σταθερό τίμημα ψεύτικου συναγερμού)`);
}
if (WIND_DECOMP_INTERCEPT_KMH !== DECIDED_INTERCEPT_KMH) {
  fail('Δ', `WIND_DECOMP_INTERCEPT_KMH ${WIND_DECOMP_INTERCEPT_KMH} ≠ ${DECIDED_INTERCEPT_KMH} — βγήκε από το shipFit της 24/08/2026 και μπήκε με απόφαση· νέα τιμή θέλει νέα μέτρηση ΚΑΙ νέα απόφαση`);
}
if (WIND_DECOMP_SLOPE !== DECIDED_SLOPE) {
  fail('Δ', `WIND_DECOMP_SLOPE ${WIND_DECOMP_SLOPE} ≠ ${DECIDED_SLOPE} — ομοίως`);
}
console.log(`Δ. οι τέσσερις αριθμοί στη θέση τους .......... ${failures.length > beforeD ? '❌' : '✅'}`);

// ── Ε. ο ωμός μέσος φτάνει ως την προειδοποίηση, σε ΚΑΙ ΤΑ ΔΥΟ μονοπάτια ────
// Σενάριο: ωμός μέσος 20 χλμ/ώ, ριπή 52, και μια διόρθωση (όποια κι αν είναι) που τον έχει
// ανεβάσει στα 26 — το σενάριο ελέγχει ΤΟ ΜΟΝΟΠΑΤΙ ΤΗΣ ΠΡΟΕΙΔΟΠΟΙΗΣΗΣ, όχι τη διόρθωση.
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
  console.error('· Αν έπεσε το Δ: και οι ΤΕΣΣΕΡΙΣ αριθμοί (0,50 · 3,5 · 2,392 · 1,0005) είναι ΑΠΟΦΑΣΕΙΣ');
  console.error('  πάνω σε μετρήσεις, όχι ρυθμίσεις. Νέα τιμή = νέα μέτρηση (measureWindDecompression για');
  console.error('  τα a/b) ΚΑΙ νέα απόφαση, πριν αλλάξει η σταθερά εδώ.');
  console.error('· Αν έπεσε το Α2: κάποιος άλλαξε τη μεταχείριση μονάδων. Η κύρια διαδρομή περνάει m/s');
  console.error('  και το δηλώνει· λάθος εκεί = ×3,6 στη διόρθωση, στη μισή χώρα.');
  console.error('· Αν έπεσε το Ε: κάπου το «ριπή μείον μέσος» μετριέται από τον ΔΙΟΡΘΩΜΕΝΟ μέσο. Ο ωμός');
  console.error('  ζει στο wind.speedBeforeGustFloor και υπάρχει ΜΟΝΟ για αυτό — δες types.ts:820.');
  console.error('· Αν έπεσε το Α: η εξαίρεση του θαλασσινού σημείου είναι μισή διόρθωση, όχι λεπτομέρεια·');
  console.error('  αφορά το 47,6% των σημείων ανέμου της χώρας.');
  process.exit(1);
}
console.log(`\nPASSED: αποσυμπίεση ${WIND_DECOMP_INTERCEPT_KMH}+${WIND_DECOMP_SLOPE}×v (στεριά) · δάπεδος ${GUST_FLOOR_FACTOR} με λόγο ${INCOHERENT_GUST_RATIO} (θάλασσα) · ο ωμός μέσος φτάνει ακέραιος στις προειδοποιήσεις ριπής.`);
