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

// 6β — ΟΙ ΔΥΟ ΑΞΟΝΕΣ ΕΙΝΑΙ ΧΩΡΙΣΤΟΙ ΑΠΟ 22/08/2026 (άνεμος −0,80 · νερό −0,65). Ο έλεγχος 6
// παραπάνω κινεί ΚΑΙ ΤΑ ΔΥΟ μαζί, οπότε δεν μπορεί να δει αν το ένα ξέφυγε. Εδώ κινείται ένα
// τη φορά — και ο τρίτος έλεγχος είναι ο σημαντικός: αποδεικνύει ότι η πύλη του ΑΝΕΜΟΥ ΔΕΝ
// χαλάρωσε μαζί με του νερού. Αν κάποιος τα ξαναενώσει, αυτός σκάει.
/** Κατεύθυνση (μοίρες) που δίνει ακριβώς αυτή τη συνιστώσα onshore, για ακτή που κοιτάει FACING. */
const dirForOnshore = value => FACING + (Math.acos(value) * 180) / Math.PI;
const OFFSHORE_WIND = FACING + 180;     // onshore −1,00 — όσο απόγειος γίνεται
const seaInside = dirForOnshore(-0.67);
const seaOutside = dirForOnshore(-0.63);
const windTooWeak = dirForOnshore(-0.70);
check('6β νερό μέσα', dep(OFFSHORE_WIND, [{ ...BIG, directionDeg: seaInside }]) === true,
  'νερό στο −0,67 απορρίφθηκε ενώ το κατώφλι νερού είναι −0,65');
check('6β νερό έξω', dep(OFFSHORE_WIND, [{ ...BIG, directionDeg: seaOutside }]) === false,
  'νερό στο −0,63 πέρασε — το κατώφλι νερού −0,65 δεν τηρείται');
check('6β ο άνεμος ΔΕΝ χαλάρωσε', dep(windTooWeak, [{ ...BIG, directionDeg: OFFSHORE_WIND }]) === false,
  'άνεμος στο −0,70 πέρασε — η πύλη ανέμου πρέπει να μείνει στο −0,80, χωριστά από το νερό');
check('6β τα δύο κατώφλια δεν ταυτίζονται',
  shoreWave.DEPARTING_SEA_MAX_ONSHORE > OFFSHORE_FLAT_MAX_ONSHORE,
  'το κατώφλι νερού δεν είναι χαλαρότερο από του ανέμου — η αλλαγή της 22/08 χάθηκε');
check('6β το νερό δεν φτάνει τη ράμπα',
  shoreWave.DEPARTING_SEA_MAX_ONSHORE < shoreWave.SHORE_RAMP_SILENT_ONSHORE,
  'το κατώφλι νερού έφτασε το σημείο σιωπής της ράμπας (−0,5), που η μέτρηση απέρριψε');

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

// 8 — Η ΕΞΑΙΡΕΣΗ ΤΟΥ ΦΡΑΧΤΗ ΤΗΣ ΓΡΑΜΜΗΣ ΗΡΕΜΙΑΣ (22/08/2026, βίβλος §Γ56).
//
// Ο φράχτης `fallsIntoCalm` (utils/beachConditionsReadout, commit c8385652 της 21/08) ανεβάζει
// κάθε αριθμό ακτής που πέφτει κάτω από τη γραμμή ηρεμίας ενώ η ανοιχτή θάλασσα δεν έχει πέσει.
// Γράφτηκε για την ΑΒΑΘΜΟΝΟΜΗΤΗ έκπτωση ×0,5 και έσβηνε μαζί και τη ΜΕΤΡΗΜΕΝΗ απόδειξη ότι όλο
// το νερό φεύγει. Η εξαίρεση περνάει ΜΟΝΟ με το `shoreWaveFromDepartingSea`.
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
/** Ελαφονήσι 22/08 15:00: ανοιχτά 0,88 μ. στα 4,75 s, ακτή 0,41 μ. — ο φράχτης το έκανε 0,80. */
const fenceCase = {
  beachWindSpeedKmph: 25, waveHeightM: 0.88, seaStateWaveM: 0.88, seaStatePeriodS: 4.75,
  shoreWaveHeightM: 0.41, shoreDisplayWaveM: 0.41, language: 'gr',
};
const fenced = buildBeachConditionsReadout(fenceCase);
const exempt = buildBeachConditionsReadout({ ...fenceCase, shoreWaveFromDepartingSea: true });
check('8 ο φράχτης ζει', fenced.waveM > 0.6,
  'ο φράχτης δεν ανέβασε τον αριθμό — η εξαίρεση δεν έχει νόημα, ή ο φράχτης χάθηκε');
check('8 η εξαίρεση περνάει', Math.abs(exempt.waveM - 0.41) < 0.005,
  `με μετρημένη απόδειξη ο αριθμός έπρεπε να μείνει 0,41 — βγήκε ${exempt.waveM}`);
check('8 μόνο προς τα κάτω', exempt.waveM <= fenced.waveM,
  'η εξαίρεση ΑΝΕΒΑΣΕ τον αριθμό — μπορεί μόνο να τον αφήσει όπως τον μέτρησε το μοντέλο');
check('8 δεν αγγίζει την έκπτωση ×0,5',
  Math.abs(buildBeachConditionsReadout({ ...fenceCase, shoreWaveFromDepartingSea: false }).waveM - fenced.waveM) < 0.005,
  'χωρίς μετρημένη απόδειξη ο φράχτης πρέπει να δουλεύει ΑΚΡΙΒΩΣ όπως στις 21/08');
// Και ποτέ πάνω από την ανοιχτή θάλασσα, όπως κάθε άλλος αριθμός ακτής.
check('8 ποτέ πάνω από τα ανοιχτά', exempt.waveM <= fenceCase.waveHeightM,
  'ο αριθμός ακτής ξεπέρασε τη θάλασσα έξω');

// ---- η καλωδίωση: το recommendationService πρέπει ΟΝΤΩΣ να το περνάει ------------------------
const service = fs.readFileSync(path.join(root, 'services/recommendationService.ts'), 'utf8');
check('καλωδίωση import', /isSeaDepartingShore/.test(service) && /from '\.\.\/utils\/shoreWave'/.test(service),
  'το recommendationService δεν εισάγει το isSeaDepartingShore');
check('καλωδίωση χρήση', /departingSea,\s*\n\s*\}\);/.test(service) || /departingSea,/.test(service),
  'το departingSea δεν φτάνει στο estimateShoreWaveHeightM');
check('καλωδίωση συστατικά', /waveDirectionDeg/.test(service) && /swellWaveDirectionDeg/.test(service),
  'δεν περνάνε και οι δύο κατευθύνσεις θάλασσας');
check('καλωδίωση προέλευση', /shoreWaveFromDepartingSea/.test(service),
  'το recommendationService δεν επιστρέφει την προέλευση του αριθμού ακτής');

// ΚΑΙ ΟΤΙ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ. Το επαναλαμβανόμενο σφάλμα αυτού του project δεν είναι ο λάθος
// υπολογισμός — είναι ο σωστός υπολογισμός που ΔΕΝ φτάνει στην κάρτα (βίβλος, 11/08). Και οι
// ΤΡΕΙΣ κλήσεις του readout (κάρτα + δύο του χάρτη) πρέπει να το περνάνε, αλλιώς η κάρτα και η
// πινέζα ξαναρχίζουν να λένε άλλο νούμερο για το ίδιο νερό.
for (const [surface, file, expected] of [
  ['κάρτα', 'components/BeachCard.tsx', 1],
  ['χάρτης', 'components/BeachMap.tsx', 2],
]) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const calls = (source.match(/buildBeachConditionsReadout\(\{[^}]*\}\)/g) || []);
  const carrying = calls.filter(c => c.includes('shoreWaveFromDepartingSea')).length;
  check(`καλωδίωση ${surface}`, calls.length === expected && carrying === expected,
    `${carrying}/${calls.length} κλήσεις του readout περνάνε την προέλευση (αναμενόμενες ${expected})`);
}

if (process.argv.includes('--prove')) {
  // ΠΡΑΓΜΑΤΙΚΟ ΣΑΜΠΟΤΑΖ: αλλάζουμε τη σταθερά που διαβάζει η ΑΛΗΘΙΝΗ συνάρτηση και απαιτούμε να
  // σπάσουν οι παραπάνω κανόνες. Πύλη που περνάει και με χαλασμένο κατώφλι είναι διακοσμητική.
  const offshoreModule = require(path.join(root, 'utils/offshoreFlatWater.ts'));
  const original = offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE;
  const sabotage = [
    ['άνεμος χαλαρωμένος στο 0', 0, () => dep(justOutside, [{ ...BIG, directionDeg: justOutside }]) === false],
    ['άνεμος σφιγμένος στο −2', -2, () => dep(0, [{ ...BIG, directionDeg: 0 }]) === true],
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

  // ΚΑΙ ΤΟ ΝΕΟ ΚΑΤΩΦΛΙ ΤΟΥ ΝΕΡΟΥ: πύλη που δεν σαμποτάρει και τους δύο άξονες ελέγχει τον έναν.
  const seaOriginal = shoreWave.DEPARTING_SEA_MAX_ONSHORE;
  const seaSabotage = [
    ['νερό χαλαρωμένο στο 0', 0, () => dep(OFFSHORE_WIND, [{ ...BIG, directionDeg: dirForOnshore(-0.3) }]) === false],
    ['νερό σφιγμένο στο −2', -2, () => dep(OFFSHORE_WIND, [{ ...BIG, directionDeg: OFFSHORE_WIND }]) === true],
  ];
  let seaCaught = 0;
  for (const [name, value, ruleStillHolds] of seaSabotage) {
    shoreWave.DEPARTING_SEA_MAX_ONSHORE = value;
    const survived = ruleStillHolds();
    shoreWave.DEPARTING_SEA_MAX_ONSHORE = seaOriginal;
    if (survived) fail(`--prove: το σαμποτάζ «${name}» ΕΠΙΒΙΩΣΕ — η συνάρτηση δεν διαβάζει τη σταθερά νερού`);
    else seaCaught += 1;
  }
  check('--prove επαναφορά νερού', shoreWave.DEPARTING_SEA_MAX_ONSHORE === seaOriginal,
    'η σταθερά του νερού δεν επανήλθε');
  caught += seaCaught;
  sabotage.push(...seaSabotage);
  console.log(`--prove: ${caught}/${sabotage.length} σαμποτάζ εντοπίστηκαν`);
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} κανόνας/ες «το νερό φεύγει» έσπασαν.\n`);
  failures.forEach(line => console.error(`  ${line}`));
  console.error('\nΜΗΝ χαλαρώσεις κατώφλι για να περάσει μια περίπτωση. Και τα δύο βγήκαν από εθνική');
  console.error('μέτρηση: ο ΑΝΕΜΟΣ −0,80 (measureDepartingSeaNationally.mjs, 16/08) και το ΝΕΡΟ −0,65');
  console.error('(measureDepartingSeaThreshold.mjs, 22/08, 4 παράθυρα). Στο −0,60 το νερό αρχίζει να ρίχνει');
  console.error('παραλίες από ≥1,00 μ. κατευθείαν στο δάπεδο των 0,10 μ. — εκεί σταματάει η γραμμή.');
  process.exit(1);
}

console.log('PASSED: το ξεκλείδωμα «όλο το νερό φεύγει» τηρεί άνεμο '
  + `${OFFSHORE_FLAT_MAX_ONSHORE} / νερό ${shoreWave.DEPARTING_SEA_MAX_ONSHORE}, `
  + `αγνοεί συστατικά κάτω από ${DEPARTING_SEA_MIN_COMPONENT_M} μ., σιωπά χωρίς κατεύθυνση, `
  + 'δεν παρακάμπτει αποθαλασσιά/εμπιστοσύνη/πινέζα/ράμπα, και ποτέ δεν μεγαλώνει τον αριθμό.');
