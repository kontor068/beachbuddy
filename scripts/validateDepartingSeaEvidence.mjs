#!/usr/bin/env node
/**
 * ΜΕΤΡΗΜΕΝΗ ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ ΝΕΡΟ ΦΕΥΓΕΙ — ΠΟΤΕ ΕΙΚΑΣΙΑ, ΠΟΤΕ ΠΡΟΣ ΤΑ ΠΑΝΩ.
 *
 * Οδηγεί τις ΠΡΑΓΜΑΤΙΚΕΣ utils/shoreWave.isSeaDepartingShore και estimateShoreWaveHeightM — όχι
 * αντίγραφο — και απαιτεί επτά πράγματα. Το ξεκλείδωμα των δύο γεωμετρικών πυλών είναι ό,τι πιο
 * επικίνδυνο έχει αυτό το αρχείο: κάνει παραλίες να δείχνουν ΠΙΟ ΗΡΕΜΕΣ, που είναι η σκανδάλη #1
 * της §9. Γι' αυτό κάθε κανόνας εδώ είναι γραμμένος ως «τι ΔΕΝ επιτρέπεται».
 *
 *   node scripts/validateDepartingSeaEvidence.mjs
 *   node scripts/validateDepartingSeaEvidence.mjs --prove   # τρία σαμποτάζ πρέπει να το ρίξουν
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
const { OFFSHORE_FLAT_MAX_ONSHORE } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { isSeaDepartingShore, estimateShoreWaveHeightM, DEPARTING_SEA_MIN_COMPONENT_M } = shoreWave;

const failures = [];
const fail = message => failures.push(message);
const check = (name, condition, message) => { if (!condition) fail(`${name}: ${message}`); };

// Ακτή που κοιτάει νότια (180°). Βοριάς (0°) = τελείως απόγειος. Νοτιάς (180°) = μετωπικός.
const FACING = 180;
const dep = (windDeg, components) => isSeaDepartingShore({ facingDeg: FACING, windDirectionDeg: windDeg, components });
const BIG = { heightM: 1.2 };
const SMALL = { heightM: 0.05 };

// 1 — απόγειος άνεμος ΚΑΙ απόγειο κύμα: η μόνη περίπτωση που επιτρέπεται.
check('1 απόγειο-όλα', dep(0, [{ ...BIG, directionDeg: 0 }]) === true,
  'τελείως απόγειος άνεμος με τελείως απόγειο κύμα δεν αναγνωρίστηκε');

// 2 — ΜΕΤΩΠΙΚΟ κύμα δεν επιτρέπεται ποτέ, όσο απόγειος κι αν είναι ο άνεμος.
check('2 μετωπικό κύμα', dep(0, [{ ...BIG, directionDeg: 180 }]) === false,
  'κύμα που έρχεται κατά πρόσωπο πέρασε ως «φεύγει»');

// 3 — ΜΕΤΩΠΙΚΟΣ άνεμος δεν επιτρέπεται ποτέ: χτίζει τοπικό κύμα που το κελί δεν έχει δει.
check('3 μετωπικός άνεμος', dep(180, [{ ...BIG, directionDeg: 0 }]) === false,
  'θαλάσσιος άνεμος πέρασε επειδή το μακρινό κύμα έφευγε');

// 4 — ΕΝΑ συστατικό που έρχεται ακυρώνει τα υπόλοιπα.
check('4 ένα φτάνει', dep(0, [{ ...BIG, directionDeg: 0 }, { heightM: 0.6, directionDeg: 170 }]) === false,
  'αποθαλασσιά που έρχεται δεν σταμάτησε τον κανόνα');

// 5 — ΥΨΟΣ ΧΩΡΙΣ ΚΑΤΕΥΘΥΝΣΗ = σιωπή. Δεν έχουμε απόδειξη ότι φεύγει.
check('5 χωρίς κατεύθυνση', dep(0, [{ ...BIG, directionDeg: undefined }]) === false,
  'συστατικό χωρίς κατεύθυνση θεωρήθηκε ότι φεύγει');
check('5β καθόλου νερό', dep(0, [SMALL]) === false,
  'μόνο ασήμαντο νερό δεν αρκεί για ισχυρισμό');

// 6 — ΤΟ ΚΑΤΩΦΛΙ ΤΗΡΕΙΤΑΙ ΚΑΙ ΑΠΟ ΤΙΣ ΔΥΟ ΜΕΡΙΕΣ. −0,8 σημαίνει πάνω από 143° εκτός μετωπικής.
const justInside = FACING + 180 - 36;   // onshore ≈ −0,81
const justOutside = FACING + 180 - 38;  // onshore ≈ −0,79
check('6 μέσα', dep(justInside, [{ ...BIG, directionDeg: justInside }]) === true,
  'γωνία μέσα στο κατώφλι απορρίφθηκε');
check('6 έξω', dep(justOutside, [{ ...BIG, directionDeg: justOutside }]) === false,
  'γωνία ΕΞΩ από το κατώφλι πέρασε — το −0,8 δεν τηρείται');

// 7 — ΤΟ ΞΕΚΛΕΙΔΩΜΑ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΜΕΓΑΛΩΣΕΙ ΠΟΤΕ ΤΟΝ ΑΡΙΘΜΟ, ούτε να σπάσει τους άλλους φραγμούς.
// Γεωμετρία τύπου Ελαφονησίου: άνοιγμα 5,44 χλμ και φραγμένες ακτίνες 0,8 — και οι δύο πύλες
// κλειστές σήμερα.
const elafonisiLike = { fetchKm: 5.44, blockedRayRatio: 0.8, onshore: -0.935 };
const base = { openWaterWaveHeightM: 1.22, windSpeedKmh: 28.9, sector: elafonisiLike, confidence: 'high' };
const before = estimateShoreWaveHeightM({ ...base });
const after = estimateShoreWaveHeightM({ ...base, departingSea: true });
check('7 σιωπή χωρίς απόδειξη', before === undefined, 'μίλησε χωρίς μετρημένη απόδειξη');
check('7 μιλάει με απόδειξη', typeof after === 'number', 'δεν μίλησε ενώ όλο το νερό έφευγε');
check('7 ποτέ πιο δυνατά', typeof after !== 'number' || after < base.openWaterWaveHeightM,
  'ο αριθμός της ακτής βγήκε ίσος ή μεγαλύτερος από την ανοιχτή θάλασσα');
check('7 η αποθαλασσιά υπερισχύει',
  estimateShoreWaveHeightM({ ...base, departingSea: true, arrivingSwellPresent: true }) === undefined,
  'αποθαλασσιά που φτάνει δεν σταμάτησε το ξεκλείδωμα');
check('7 η εμπιστοσύνη υπερισχύει',
  estimateShoreWaveHeightM({ ...base, departingSea: true, confidence: 'medium' }) === undefined,
  'γεωμετρία χαμηλής εμπιστοσύνης πέρασε');
check('7 η ύποπτη πινέζα υπερισχύει',
  estimateShoreWaveHeightM({ ...base, departingSea: true, suspectPin: true }) === undefined,
  'ύποπτη πινέζα πέρασε');
// Η ράμπα ΔΕΝ παρακάμπτεται: ακτή με onshore −0,3 μένει σιωπηλή ακόμη κι αν το νερό φεύγει.
check('7 η ράμπα μένει',
  estimateShoreWaveHeightM({ ...base, sector: { ...elafonisiLike, onshore: -0.3 }, departingSea: true }) === undefined,
  'ο έλεγχος της ράμπας παρακάμφθηκε');

// ---- η καλωδίωση: το recommendationService πρέπει ΟΝΤΩΣ να το περνάει ------------------------
const service = fs.readFileSync(path.join(root, 'services/recommendationService.ts'), 'utf8');
check('καλωδίωση import', /isSeaDepartingShore/.test(service) && /from '\.\.\/utils\/shoreWave'/.test(service),
  'το recommendationService δεν εισάγει το isSeaDepartingShore');
check('καλωδίωση χρήση', /departingSea,\s*\n\s*\}\);/.test(service) || /departingSea,/.test(service),
  'το departingSea δεν φτάνει στο estimateShoreWaveHeightM');
check('καλωδίωση συστατικά', /waveDirectionDeg/.test(service) && /swellWaveDirectionDeg/.test(service),
  'δεν περνάνε και οι δύο κατευθύνσεις θάλασσας');

if (process.argv.includes('--prove')) {
  // ΠΡΑΓΜΑΤΙΚΟ ΣΑΜΠΟΤΑΖ: αλλάζουμε τη σταθερά που διαβάζει η ΑΛΗΘΙΝΗ συνάρτηση και απαιτούμε να
  // σπάσουν οι παραπάνω κανόνες. Πύλη που περνάει και με χαλασμένο κατώφλι είναι διακοσμητική.
  const offshoreModule = require(path.join(root, 'utils/offshoreFlatWater.ts'));
  const original = offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE;
  const sabotage = [
    ['κατώφλι χαλαρωμένο στο 0', 0, () => dep(justOutside, [{ ...BIG, directionDeg: justOutside }]) === false],
    ['κατώφλι σφιγμένο στο −2', -2, () => dep(0, [{ ...BIG, directionDeg: 0 }]) === true],
  ];
  let caught = 0;
  for (const [name, value, ruleStillHolds] of sabotage) {
    offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE = value;
    const survived = ruleStillHolds();
    offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE = original;
    if (survived) fail(`--prove: το σαμποτάζ «${name}» ΕΠΙΒΙΩΣΕ — η συνάρτηση δεν διαβάζει τη σταθερά`);
    else caught += 1;
  }
  check('--prove επαναφορά', offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE === original, 'η σταθερά δεν επανήλθε');
  console.log(`--prove: ${caught}/${sabotage.length} σαμποτάζ εντοπίστηκαν`);
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} κανόνας/ες «το νερό φεύγει» έσπασαν.\n`);
  failures.forEach(line => console.error(`  ${line}`));
  console.error('\nΜΗΝ χαλαρώσεις το κατώφλι για να περάσει μια περίπτωση: το −0,8 βγήκε από εθνική');
  console.error('μέτρηση (scripts/measureDepartingSeaNationally.mjs) όπου το −0,5 έδινε 576 ώρες×παραλία');
  console.error('αντί για 44, με άλματα από 1,6 μ. κατευθείαν στο δάπεδο των 0,10 μ.');
  process.exit(1);
}

console.log(`PASSED: το ξεκλείδωμα «όλο το νερό φεύγει» τηρεί το κατώφλι ${OFFSHORE_FLAT_MAX_ONSHORE}, `
  + `αγνοεί συστατικά κάτω από ${DEPARTING_SEA_MIN_COMPONENT_M} μ., σιωπά χωρίς κατεύθυνση, `
  + 'δεν παρακάμπτει αποθαλασσιά/εμπιστοσύνη/πινέζα/ράμπα, και ποτέ δεν μεγαλώνει τον αριθμό.');
