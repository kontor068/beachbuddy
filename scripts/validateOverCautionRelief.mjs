#!/usr/bin/env node
/**
 * Η ΑΝΑΚΟΥΦΙΣΗ ΤΗΣ ΥΠΕΡΒΟΛΙΚΗΣ ΑΥΣΤΗΡΟΤΗΤΑΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΞΕΦΥΓΕΙ.
 *
 * Αυτός ο κανόνας ΑΦΑΙΡΕΙ τη βαρύτερη λέξη που λέει το προϊόν («μην κολυμπήσεις»). Είναι η
 * σκανδάλη #1 της §9 σε καθαρή μορφή, οπότε κάθε έλεγχος εδώ είναι γραμμένος ως «τι ΔΕΝ
 * επιτρέπεται» και οδηγεί την ΠΡΑΓΜΑΤΙΚΗ `utils/overCautionRelief.relievesOverCaution`.
 *
 * ΚΑΙ ΕΝΑΣ ΕΛΕΓΧΟΣ ΚΑΛΩΔΙΩΣΗΣ, ΓΙΑ ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΟΝΤΩΣ ΣΥΝΕΒΗ. Επί 12 μέρες ο κανόνας ρωτούσε
 * το `effectiveWaveHeightM` (τη θάλασσα ~10 χλμ ανοιχτά) αντί για το νερό ΣΤΗΝ ΑΚΤΗ, δηλαδή ο
 * φρουρός απέναντι στην υπερβολική αυστηρότητα ρωτούσε το νούμερο που την προκαλεί. Καμία πύλη
 * δεν το έβλεπε γιατί καμία δεν κοιτούσε ΤΙ του δίνεται. Ο έλεγχος «καλωδίωση» παρακάτω κοιτάει.
 *
 *   node scripts/validateOverCautionRelief.mjs
 *   node scripts/validateOverCautionRelief.mjs --prove   # σαμποτάζ που πρέπει να το ρίξουν
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

const reliefModule = require(path.join(root, 'utils/overCautionRelief.ts'));
const {
  relievesOverCaution, OVER_CAUTION_MAX_SHORE_WAVE_M,
  OVER_CAUTION_MAX_BEAUFORT, OVER_CAUTION_DEPARTING_SEA_MAX_BEAUFORT,
} = reliefModule;
const { SEA_STATE_AMBER_M } = require(path.join(root, 'utils/waveCharacter.ts'));

const failures = [];
const fail = m => failures.push(m);
const check = (name, condition, message) => { if (!condition) fail(`${name}: ${message}`); };

/** Ήσυχη βάση: 3 Μποφόρ, 0,3 μ. νερό στην ακτή, τίποτα να παραμερίσει. */
const calm = { beaufort: 3, seaAtShoreM: 0.3 };

// 1 — Η ΒΑΣΗ ΔΟΥΛΕΥΕΙ. Χωρίς αυτό, όλα τα «false» παρακάτω θα περνούσαν για λάθος λόγο.
check('1 η βάση ανακουφίζει', relievesOverCaution(calm) === true,
  '3 Μποφόρ με 0,3 μ. στην ακτή δεν ανακουφίστηκε — ο κανόνας είναι νεκρός');

// 2 — ΤΑ ≥5 ΜΠΟΦΟΡ ΔΕΝ ΑΝΑΚΟΥΦΙΖΟΝΤΑΙ ΠΟΤΕ, με ή χωρίς απόδειξη. Εκεί μια άρνηση δικαιολογείται.
for (const bft of [5, 6, 7]) {
  check(`2 ${bft} Μποφόρ`, relievesOverCaution({ ...calm, beaufort: bft, departingSea: true }) === false,
    `στα ${bft} Μποφόρ αφαιρέθηκε το «μην κολυμπήσεις» — η πόρτα του ανέμου έσπασε`);
}

// 3 — ΑΠΟ ΕΚΕΙ ΠΟΥ Η ΘΑΛΑΣΣΑ ΜΙΛΑΕΙ ΣΤΟ ΧΡΩΜΑ (SEA_STATE_AMBER_M), ΠΟΤΕ.
// Το κατώφλι έπαψε να είναι ιδιωτικό 0,6 στις 23/08/2026: στο κενό 0,6–0,8 το χρώμα έλεγε
// «ήρεμο» και η ετυμηγορία «μην κολυμπήσεις» (Λέσβος 24/08 10:00 — 16 παραλίες στο κενό).
check('3 μεγάλο νερό', relievesOverCaution({ ...calm, seaAtShoreM: 0.8, departingSea: true }) === false,
  'ανακουφίστηκε με 0,80 μ. στην ακτή — το κατώφλι είναι «κάτω από SEA_STATE_AMBER_M»');
check('3 λίγο κάτω', relievesOverCaution({ ...calm, seaAtShoreM: 0.79 }) === true,
  'δεν ανακουφίστηκε με 0,79 μ. — το κατώφλι μετακινήθηκε');
// 3β — ΤΟ ΚΟΝΤΟΚΥΜΑ ΜΕΤΡΑΕΙ ΟΣΟ ΝΙΩΘΕΤΑΙ: η σύγκριση γίνεται σε swell-equivalent ύψος,
// το ΙΔΙΟ νόμισμα με το χρώμα. 0,7 μ. @ 3 s νιώθει ~0,87 → καμία ανακούφιση· το ίδιο ύψος
// @ 5 s νιώθει 0,70 → ανακούφιση. Χωρίς περίοδο, σκέτο ύψος (καμία επιδείνωση από άγνοια).
check('3β κοντόκυμα', relievesOverCaution({ ...calm, seaAtShoreM: 0.7, periodS: 3 }) === false,
  'ανακουφίστηκε με 0,7 μ. @ 3 s — η σύγκριση έπαψε να γίνεται σε swell-equivalent ύψος');
check('3β μακρύ κύμα', relievesOverCaution({ ...calm, seaAtShoreM: 0.7, periodS: 5 }) === true,
  'δεν ανακουφίστηκε με 0,7 μ. @ 5 s — η περίοδος επιδεινώνει αντί να διακρίνει');
check('3β χωρίς περίοδο', relievesOverCaution({ ...calm, seaAtShoreM: 0.7 }) === true,
  'δεν ανακουφίστηκε με 0,7 μ. χωρίς περίοδο — η άγνοια της περιόδου έγινε ποινή');

// 4 — ΤΑ 4 ΜΠΟΦΟΡ ΜΟΝΟ ΜΕ ΜΕΤΡΗΜΕΝΗ ΑΠΟΔΕΙΞΗ. Το παλιό όριο μένει άθικτο χωρίς αυτήν.
check('4 χωρίς απόδειξη', relievesOverCaution({ ...calm, beaufort: 4 }) === false,
  'τα 4 Μποφόρ ανακουφίστηκαν ΧΩΡΙΣ μετρημένη απόδειξη — η συμπεριφορά της 10/08 άλλαξε');
check('4 με απόδειξη', relievesOverCaution({ ...calm, beaufort: 4, departingSea: true }) === true,
  'τα 4 Μποφόρ δεν ανακουφίστηκαν παρότι όλο το νερό αποδεδειγμένα φεύγει');

// 5 — ΟΙ ΠΑΡΑΜΕΡΙΣΜΟΙ. Καθένας μόνος του αρκεί.
check('5 επίσημη προειδοποίηση',
  relievesOverCaution({ ...calm, departingSea: true, officialWarning: true }) === false,
  'ανακουφίστηκε πάνω από επίσημη προειδοποίηση αρχής');
check('5 μετωπική αποθαλασσιά',
  relievesOverCaution({ ...calm, departingSea: true, directSwell: true }) === false,
  'ανακουφίστηκε με αποθαλασσιά που έρχεται κατά πρόσωπο');
check('5 κυματισμός μεγάλης περιόδου',
  relievesOverCaution({ ...calm, departingSea: true, swellSurgePenalty: 1 }) === false,
  'ανακουφίστηκε με ποινή κυματισμού μεγάλης περιόδου');

// 6 — ΤΑ ΣΚΟΥΠΙΔΙΑ ΔΕΝ ΑΝΑΚΟΥΦΙΖΟΥΝ. Σιωπή είναι η ασφαλής απάντηση.
for (const bad of [undefined, null, NaN, Infinity]) {
  check('6 άκυρο νερό', relievesOverCaution({ ...calm, seaAtShoreM: bad }) === false,
    `ανακουφίστηκε με seaAtShoreM=${String(bad)}`);
  check('6 άκυρα μποφόρ', relievesOverCaution({ ...calm, beaufort: bad }) === false,
    `ανακουφίστηκε με beaufort=${String(bad)}`);
}

// 7 — ΤΑ ΚΑΤΩΦΛΙΑ ΕΙΝΑΙ ΑΥΤΑ ΠΟΥ ΜΕΤΡΗΘΗΚΑΝ — ΚΑΙ ΤΟ ΝΕΡΟ ΕΙΝΑΙ ΕΝΑ ΚΑΤΩΦΛΙ ΜΕ ΤΟ ΧΡΩΜΑ.
check('7 κατώφλι νερού', OVER_CAUTION_MAX_SHORE_WAVE_M === SEA_STATE_AMBER_M,
  `το κατώφλι νερού είναι ${OVER_CAUTION_MAX_SHORE_WAVE_M} αντί ίσο με SEA_STATE_AMBER_M `
  + `(${SEA_STATE_AMBER_M}) — τα δύο συστήματα ξαναχώρισαν και το κενό 0,6–0,8 θα ξαναγεννηθεί`);
check('7 ταβάνι ανέμου', OVER_CAUTION_MAX_BEAUFORT === 4,
  `το ταβάνι χωρίς απόδειξη είναι ${OVER_CAUTION_MAX_BEAUFORT} αντί για 4`);
check('7 ταβάνι με απόδειξη', OVER_CAUTION_DEPARTING_SEA_MAX_BEAUFORT === 5,
  `το ταβάνι με απόδειξη είναι ${OVER_CAUTION_DEPARTING_SEA_MAX_BEAUFORT} αντί για 5`);
check('7 η απόδειξη δεν ξεπερνά τον άνεμο',
  OVER_CAUTION_DEPARTING_SEA_MAX_BEAUFORT <= OVER_CAUTION_MAX_BEAUFORT + 1,
  'η απόδειξη ανεβάζει το ταβάνι πάνω από ένα σκαλί');

// ---- Η ΚΑΛΩΔΙΩΣΗ: ΤΟ ΝΕΡΟ ΠΟΥ ΔΙΝΕΤΑΙ ΕΙΝΑΙ ΤΗΣ ΑΚΤΗΣ ------------------------------------
const service = fs.readFileSync(path.join(root, 'services/recommendationService.ts'), 'utf8');
check('καλωδίωση χρήση', /relievesOverCaution\(\{/.test(service),
  'το recommendationService δεν καλεί τη relievesOverCaution');
const call = (service.match(/relievesOverCaution\(\{[\s\S]*?\n  \}\);/) || [])[0] || '';
// Η κλήση περνάει το `seaAtShoreM` (συντομογραφία ή ρητά)· ο ΟΡΙΣΜΟΣ του είναι που πρέπει να
// βγαίνει από το `shoreWaveM`. Από 22/08/2026 ο αριθμός ορίζεται ΜΙΑ φορά ψηλότερα και τον
// μοιράζονται όλες οι ερωτήσεις για την παραλία (βίβλος §Γ58), οπότε ελέγχονται και τα δύο.
check('καλωδίωση περνάει το νερό ακτής', /(^|[^\w])seaAtShoreM\s*[,:]/m.test(call),
  'η κλήση δεν περνάει καθόλου το `seaAtShoreM`');
check('καλωδίωση νερό ακτής', /const seaAtShoreM = typeof shoreWaveM === 'number'[\s\S]{0,200}\? shoreWaveM/.test(service),
  'το `seaAtShoreM` δεν τροφοδοτείται από το `shoreWaveM` — αυτό ΑΚΡΙΒΩΣ ήταν το σφάλμα των 12 ημερών');
check('καλωδίωση όχι το πέλαγος', !/seaAtShoreM:\s*effectiveWaveHeightM\b/.test(call),
  'το `seaAtShoreM` παίρνει κατευθείαν το `effectiveWaveHeightM` — η θάλασσα του ανοιχτού');
check('καλωδίωση απόδειξη', /departingSea:[\s\S]{0,200}shoreWaveFromDepartingSea/.test(call),
  'το ταβάνι των 4 Μποφόρ δεν κλειδώνεται στη μετρημένη απόδειξη');
check('καλωδίωση περίοδος', /periodS:\s*seaStatePeriodS/.test(call),
  'η κλήση δεν περνάει το `seaStatePeriodS` — το κατώφλι θα συγκρίνει ύψος ενώ το χρώμα '
  + 'συγκρίνει swell-equivalent, και το κοντόκυμα θα παίρνει ανακούφιση που το χρώμα αρνείται');
check('καλωδίωση ένα σκαλί',
  /isLightWindSmallSea && swimmingComfort === 'avoid_swimming'\)\s*\{\s*\n\s*swimmingComfort = 'caution';/.test(service),
  'η ανακούφιση δεν είναι πια «μόνο avoid_swimming → caution» — μπορεί να δώσει παραπάνω από ένα σκαλί');

if (process.argv.includes('--prove')) {
  // ΠΡΑΓΜΑΤΙΚΟ ΣΑΜΠΟΤΑΖ: αντικαθιστούμε τη συνάρτηση με χαλασμένες εκδοχές και απαιτούμε να
  // πέσουν οι κανόνες. Πύλη που περνάει και με σπασμένο κανόνα είναι διακοσμητική.
  const original = reliefModule.relievesOverCaution;
  // ⚠️ ΜΕΣΩ ΤΟΥ MODULE, ΟΧΙ ΤΗΣ ΑΠΟΔΟΜΗΜΕΝΗΣ ΜΕΤΑΒΛΗΤΗΣ. Η πρώτη γραφή καλούσε την
  // `relievesOverCaution` που αποδομήθηκε στην κορυφή — δηλαδή πάντα την ΑΡΧΙΚΗ — και τα τρία
  // σαμποτάζ «επιβίωναν» χωρίς να έχει σπάσει τίποτα. Πύλη που δοκιμάζει τον εαυτό της λάθος
  // είναι χειρότερη από καθόλου πύλη.
  const ask = input => reliefModule.relievesOverCaution(input);
  const sabotage = [
    ['πάντα ναι', () => true, () => ask({ ...calm, beaufort: 6 }) === false],
    ['αγνοεί το νερό', input => input.beaufort < 5, () => ask({ ...calm, seaAtShoreM: 2 }) === false],
    ['αγνοεί την προειδοποίηση', input => input.seaAtShoreM < 0.6,
      () => ask({ ...calm, officialWarning: true }) === false],
  ];
  let caught = 0;
  for (const [name, broken, ruleStillHolds] of sabotage) {
    reliefModule.relievesOverCaution = broken;
    const survived = ruleStillHolds();
    reliefModule.relievesOverCaution = original;
    if (survived) fail(`--prove: το σαμποτάζ «${name}» ΕΠΙΒΙΩΣΕ`);
    else caught += 1;
  }
  check('--prove επαναφορά', reliefModule.relievesOverCaution === original, 'η συνάρτηση δεν επανήλθε');
  console.log(`--prove: ${caught}/${sabotage.length} σαμποτάζ εντοπίστηκαν`);
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} κανόνας/ες της ανακούφισης έσπασαν.\n`);
  failures.forEach(l => console.error(`  ${l}`));
  console.error('\nΑΥΤΟΣ Ο ΚΑΝΟΝΑΣ ΑΦΑΙΡΕΙ ΠΡΟΕΙΔΟΠΟΙΗΣΗ. Μη χαλαρώσεις κατώφλι για να περάσει μια');
  console.error('περίπτωση: μετρήθηκε εθνικά σε 3 παράθυρα (scripts/measureOverCautionRelief.mjs,');
  console.error('~120.700 ώρες×παραλία) και αγγίζει 55 — όλες ένα σκαλί, καμία στα ≥5 Μποφόρ.');
  process.exit(1);
}

console.log('PASSED: η ανακούφιση δεν αγγίζει τα ≥5 Μποφόρ, δεν αγγίζει νερό ≥'
  + `${OVER_CAUTION_MAX_SHORE_WAVE_M} μ. στην ακτή, παραμερίζει για προειδοποίηση/αποθαλασσιά/κυματισμό, `
  + 'τα 4 Μποφόρ μόνο με μετρημένη απόδειξη, και διαβάζει το νερό ΤΗΣ ΑΚΤΗΣ.');
