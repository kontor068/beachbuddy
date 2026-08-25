#!/usr/bin/env node
/**
 * ΟΤΙ ΔΕΝ ΦΑΙΝΕΤΑΙ ΣΤΗΝ ΟΘΟΝΗ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΑΛΛΑΖΕΙ ΧΡΩΜΑ — ΚΑΙ ΤΑ ΔΥΟ ΣΗΜΑΤΑ ΤΗΣ ΚΑΡΤΑΣ.
 *
 * ΑΦΟΡΜΗ (Μίλτος, 24/08/2026). Τσερδάκια #2053 και Χρυσή Ακτή #2056, 1,1 χλμ απόσταση, ίδιο κελί
 * ανέμου: **3 Μποφόρ και «~0,1 μ.» και οι δύο** — η μία κίτρινη, η άλλη μπλε. Όλη η διαφορά ήταν
 * 0,80 έναντι 0,78 μ. ανοιχτής θάλασσας: δύο εκατοστά, σε αριθμό που η κάρτα δεν τυπώνει.
 * Μετρημένο εθνικότερα την ίδια μέρα (10 περιοχές, 3.984 παραλιο-ώρες): **308 από 8.526 ζεύγη
 * γειτόνων ≤8 χλμ που τυπώνουν τα ίδια νούμερα φοράνε διαφορετικό χρώμα (3,6%)**.
 *
 * ΔΥΟ ΑΛΛΑΓΕΣ ΜΠΗΚΑΝ, ΚΑΙ ΑΥΤΗ Η ΠΥΛΗ ΦΥΛΑΕΙ ΚΑΙ ΤΙΣ ΔΥΟ:
 *   1. Η κρίση κατεβαίνει στην ακρίβεια που τυπώνεται (`utils/waveCharacter.atDisplayedPrecisionM`).
 *   2. Τα δύο σήματα της κάρτας βάφονται χωριστά (`utils/conditionCause.resolveFactorTones`).
 *
 * ΕΞΙ ΙΣΧΥΡΙΣΜΟΙ:
 *   Α. ΤΟ ΒΗΜΑ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΤΥΠΩΝΕΙ Η ΟΘΟΝΗ. `DISPLAYED_WAVE_STEP_M` πρέπει να συμφωνεί με τα
 *      δεκαδικά που γράφει το `utils/beachConditionsReadout` — διαβάζεται από την ΠΗΓΗ, όχι
 *      αντιγραμμένο εδώ. Αν κάποιος δείξει δύο δεκαδικά και ξεχάσει το βήμα, η πύλη πέφτει.
 *   Β. ΚΑΘΕ ΚΑΤΩΦΛΙ ΣΟΒΑΡΟΤΗΤΑΣ ΕΙΝΑΙ ΑΚΕΡΑΙΟ ΠΟΛΛΑΠΛΑΣΙΟ ΤΟΥ ΒΗΜΑΤΟΣ. Πάνω σε ΑΥΤΟ πατάει η
 *      απόδειξη της μονοδρομίας: για κατώφλι t πολλαπλάσιο του βήματος, `x >= t ⟹ round(x) >= t`.
 *      Κατώφλι στο 0,85 θα έσπαγε την ιδιότητα σιωπηλά — εδώ σπάει θορυβωδώς.
 *   Γ. ΜΟΝΟΔΡΟΜΟΣ ΠΡΟΣ ΤΗΝ ΠΡΟΣΟΧΗ. Σε όλο το πλέγμα 0,00–2,00 μ. ανά εκατοστό, ούτε το ταβάνι
 *      του χρώματος ούτε η λέξη της ετυμηγορίας γίνονται ΠΟΤΕ ηρεμότερα απ' ό,τι ήταν χωρίς τη
 *      στρογγυλοποίηση. Αυτή είναι η σκανδάλη #1 (ψευδής ηρεμία) και δεν αγγίζεται.
 *   Δ. ΙΔΙΟ ΤΥΠΩΜΕΝΟ ΝΟΥΜΕΡΟ → ΙΔΙΑ ΣΟΒΑΡΟΤΗΤΑ. Η καρδιά της αλλαγής: δύο θάλασσες που γράφονται
 *      ολόιδια στην οθόνη δεν επιτρέπεται να δίνουν διαφορετικό ταβάνι χρώματος ή διαφορετική
 *      λέξη. Ελέγχεται στο ίδιο πλέγμα, ομαδοποιημένο κατά τυπωμένη τιμή — και ΡΗΤΑ στο ζευγάρι
 *      του Μίλτου (0,78 vs 0,80).
 *   Ε. Η ΛΕΞΗ ΚΑΙ ΤΟ ΧΡΩΜΑ ΚΡΙΝΟΥΝ ΜΑΖΙ. Σε κάθε τιμή του πλέγματος, «η θάλασσα έχει γνώμη για το
 *      χρώμα» και «η λέξη δεν λέει ήρεμα» πρέπει να συμπίπτουν. Αν μπει η στρογγυλοποίηση στο ένα
 *      και ξεχαστεί στο άλλο, εδώ φαίνεται.
 *   Ζ. ΤΑ ΔΥΟ ΣΗΜΑΤΑ ΔΕΝ ΨΕΥΔΟΝΤΑΙ. Σε πλέγμα (έκθεση × Μποφόρ × θάλασσα): το τελικό χρώμα δεν
 *      είναι ΠΟΤΕ ηρεμότερο από το χειρότερο των δύο σημάτων — αλλιώς η κάρτα θα έδειχνε κίτρινο
 *      κυματάκι πάνω από μπλε πινέζα. Και το σήμα του νερού μένει 'blue' ακριβώς όταν η θάλασσα
 *      δεν κατέβασε το χρώμα, ώστε να μη μπει κίτρινο σύμβολο δίπλα στη λέξη «σχεδόν χωρίς κύμα».
 *
 * Self-proves με --prove: με βήμα 0 (καμία στρογγυλοποίηση) πρέπει να πέσει το Δ, και με
 * σαμποταρισμένα σήματα πρέπει να πέσει το Ζ. Μια πύλη που δεν αποδεικνύει ότι δαγκώνει είναι
 * διακοσμητική.
 *
 *   node scripts/validateDisplayedPrecisionGate.mjs [--prove]
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

const {
  atDisplayedPrecisionM,
  DISPLAYED_WAVE_STEP_M,
  seaStateToneCeiling,
  SEA_STATE_AMBER_M,
  SEA_STATE_ROUGH_M,
} = require(path.join(root, 'utils/waveCharacter.ts'));
const { getSeaStateSeverity } = require(path.join(root, 'utils/seaVerdict.ts'));
const {
  resolveConditionTone,
  IDEAL_MAX_SHORE_SEA_STATE_M,
  CALMNESS_ORDER,
} = require(path.join(root, 'utils/suitabilityTone.ts'));
const { resolveFactorTones } = require(path.join(root, 'utils/conditionCause.ts'));

const PROVE = process.argv.includes('--prove');
const failures = [];
const fail = (claim, msg) => failures.push(`[${claim}] ${msg}`);
const ok = (claim, msg) => console.log(`OK   ${claim}: ${msg}`);

/* ---------------------------------------------------------------- Α. το βήμα */

const readoutSource = fs.readFileSync(path.join(root, 'utils/beachConditionsReadout.ts'), 'utf8');
const printedDecimals = Number(/waveM\.toFixed\((\d)\)/.exec(readoutSource)?.[1]);
if (!Number.isFinite(printedDecimals)) {
  fail('Α·βήμα', 'δεν βρέθηκε το `waveM.toFixed(n)` στο utils/beachConditionsReadout — '
    + 'η πύλη δεν μπορεί να διαβάσει με πόσα δεκαδικά τυπώνεται ο αριθμός');
} else {
  const expectedStep = Number((10 ** -printedDecimals).toFixed(printedDecimals));
  if (DISPLAYED_WAVE_STEP_M !== expectedStep) {
    fail('Α·βήμα', `η οθόνη τυπώνει ${printedDecimals} δεκαδικά (βήμα ${expectedStep}) αλλά το `
      + `DISPLAYED_WAVE_STEP_M είναι ${DISPLAYED_WAVE_STEP_M} — η κρίση και η εμφάνιση ξαναχώρισαν`);
  } else {
    ok('Α·βήμα', `η οθόνη τυπώνει ${printedDecimals} δεκαδικά και η κρίση κατεβαίνει στο ίδιο βήμα (${expectedStep} μ.)`);
  }
}

/* ------------------------------------------- Β. κατώφλια πάνω στο πλέγμα */

const THRESHOLDS = [
  ['SEA_STATE_AMBER_M', SEA_STATE_AMBER_M],
  ['SEA_STATE_ROUGH_M', SEA_STATE_ROUGH_M],
  ['IDEAL_MAX_SHORE_SEA_STATE_M', IDEAL_MAX_SHORE_SEA_STATE_M],
];
let offGrid = 0;
for (const [name, value] of THRESHOLDS) {
  const steps = value / DISPLAYED_WAVE_STEP_M;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) {
    offGrid += 1;
    fail('Β·πλέγμα', `${name} = ${value} δεν είναι ακέραιο πολλαπλάσιο του βήματος `
      + `${DISPLAYED_WAVE_STEP_M} — η απόδειξη μονοδρομίας του atDisplayedPrecisionM δεν ισχύει πια `
      + 'γι\' αυτό το κατώφλι, και η στρογγυλοποίηση μπορεί να κάνει κάτι ΗΡΕΜΟΤΕΡΟ');
  }
}
if (!offGrid) ok('Β·πλέγμα', `${THRESHOLDS.length} κατώφλια σοβαρότητας, όλα ακέραια πολλαπλάσια του βήματος`);

/* --------------------------- Γ+Δ+Ε. το πλέγμα των τιμών θάλασσας */

const CEILING_RANK = { red: 0, orange: 1, yellow: 2, [null]: 3 };
const rawCeiling = (m) => (m >= SEA_STATE_ROUGH_M ? 'red' : m >= SEA_STATE_AMBER_M ? 'yellow' : null);
const rawSeverity = (m) => (m >= SEA_STATE_ROUGH_M ? 'rough' : m >= SEA_STATE_AMBER_M ? 'moderate' : 'calm');
const SEVERITY_RANK = { calm: 0, moderate: 1, rough: 2 };

const grid = [];
for (let cm = 0; cm <= 200; cm += 1) grid.push(Number((cm / 100).toFixed(2)));

let calmer = 0;
let split = 0;
let disagree = 0;
const byPrinted = new Map();
for (const m of grid) {
  const ceiling = seaStateToneCeiling(m);
  const severity = getSeaStateSeverity(m);

  // Γ — ποτέ ηρεμότερα από την ωμή σύγκριση.
  if (CEILING_RANK[ceiling] > CEILING_RANK[rawCeiling(m)]) {
    calmer += 1;
    fail('Γ·μονόδρομος', `στα ${m} μ. το ταβάνι χρώματος έγινε ΗΡΕΜΟΤΕΡΟ (${ceiling}) από το ωμό (${rawCeiling(m)})`);
  }
  if (SEVERITY_RANK[severity] < SEVERITY_RANK[rawSeverity(m)]) {
    calmer += 1;
    fail('Γ·μονόδρομος', `στα ${m} μ. η λέξη έγινε ΗΡΕΜΟΤΕΡΗ (${severity}) από την ωμή (${rawSeverity(m)})`);
  }

  // Ε — η λέξη και το χρώμα κρίνουν μαζί.
  if ((ceiling !== null) !== (severity !== 'calm')) {
    disagree += 1;
    fail('Ε·μαζί', `στα ${m} μ. το χρώμα λέει «${ceiling ?? 'καμία γνώμη'}» και η λέξη «${severity}» — `
      + 'η στρογγυλοποίηση μπήκε στο ένα και όχι στο άλλο');
  }

  // Δ — ομαδοποίηση κατά ΤΥΠΩΜΕΝΗ τιμή.
  const printed = (PROVE ? m : atDisplayedPrecisionM(m)).toFixed(printedDecimals || 1);
  const seen = byPrinted.get(printed);
  const judged = PROVE ? [rawCeiling(m), rawSeverity(m)] : [ceiling, severity];
  if (!seen) byPrinted.set(printed, { m, judged });
  else if (seen.judged[0] !== judged[0] || seen.judged[1] !== judged[1]) {
    split += 1;
    fail('Δ·ίδιο-νούμερο', `${seen.m} μ. και ${m} μ. τυπώνονται ΚΑΙ ΤΑ ΔΥΟ «${printed}» αλλά κρίνονται `
      + `διαφορετικά (${seen.judged.join('/')} vs ${judged.join('/')})`);
  }
}
if (!calmer) ok('Γ·μονόδρομος', `${grid.length} τιμές 0–2,00 μ.: καμία δεν έγινε ηρεμότερη`);
if (!disagree) ok('Ε·μαζί', `${grid.length} τιμές: το χρώμα και η λέξη μιλάνε πάντα ταυτόχρονα`);
if (!split) ok('Δ·ίδιο-νούμερο', `${byPrinted.size} διακριτά τυπωμένα νούμερα, κανένα με δύο κρίσεις από κάτω`);

/* ----------------------------- Δ2. το ζευγάρι που το γέννησε, ρητά */

const TSERDAKIA = { exposureLevel: 'protected', beaufort: 3, windSpeedKmh: 17.95, seaStateM: 0.80, seaArrivalExposureLevel: 'grazing', shoreShadowDamping: 0.1166 };
const CHRYSI = { ...TSERDAKIA, seaStateM: 0.78, shoreShadowDamping: 0.10 };
const toneA = resolveConditionTone(TSERDAKIA);
const toneB = resolveConditionTone(CHRYSI);
if (toneA !== toneB) {
  fail('Δ2·μάρτυρας', `Τσερδάκια (0,80 μ.) και Χρυσή Ακτή (0,78 μ.) τυπώνουν και οι δύο «~0,1 μ.» και `
    + `3 Μποφόρ, αλλά βάφονται ${toneA} και ${toneB} — το περιστατικό της 24/08/2026 ξαναγύρισε`);
} else {
  ok('Δ2·μάρτυρας', `Τσερδάκια και Χρυσή Ακτή βάφονται και οι δύο ${toneA}`);
}

/* -------------------------------------------- Ζ. τα δύο σήματα της κάρτας */

const rank = (t) => CALMNESS_ORDER.indexOf(t);
let liedCalm = 0;
let seaSpokeQuietly = 0;
let cases = 0;
for (const exposureLevel of ['protected', 'partial', 'exposed']) {
  for (let beaufort = 0; beaufort <= 8; beaufort += 1) {
    for (const seaStateM of [undefined, 0.05, 0.35, 0.45, 0.75, 0.85, 1.15, 1.35]) {
      for (const swimVerdictAvoid of [false, true]) {
        const input = { exposureLevel, beaufort, windSpeedKmh: beaufort * 6, seaStateM, swimVerdictAvoid };
        const tone = resolveConditionTone(input);
        // Το σαμποτάζ βάφει και τα δύο σήματα κόκκινα: κάθε κάρτα που ΔΕΝ είναι κόκκινη γίνεται
        // τότε «ηρεμότερη από το χειρότερο σήμα», που είναι ακριβώς η κατάσταση που ο έλεγχος
        // υπάρχει για να πιάσει. (Σαμποτάζ προς το ΜΠΛΕ δεν θα δάγκωνε ποτέ — το μπλε είναι το
        // ηρεμότερο, οπότε καμία κάρτα δεν μπορεί να το ξεπεράσει.)
        const factors = PROVE ? { wind: 'red', sea: 'red' } : resolveFactorTones(input);
        cases += 1;

        // Το τελικό χρώμα δεν επιτρέπεται να είναι ΗΡΕΜΟΤΕΡΟ από το χειρότερο σήμα: η κάρτα θα
        // έδειχνε κίτρινο εικονίδιο πάνω από μπλε πινέζα.
        const worst = rank(factors.wind) <= rank(factors.sea) ? factors.wind : factors.sea;
        if (rank(tone) > rank(worst)) {
          liedCalm += 1;
          fail('Ζ·σήματα', `${exposureLevel} @${beaufort}Μπφ θάλασσα ${seaStateM ?? '—'}: κάρτα ${tone} ενώ `
            + `τα σήματα λένε 💨${factors.wind} 🌊${factors.sea} — το χρώμα είναι ηρεμότερο από το χειρότερο σήμα`);
        }

        // Το νερό βάφεται ΜΟΝΟ όταν κατέβασε το χρώμα.
        const windAlone = resolveConditionTone({ ...input, seaStateM: undefined, swimVerdictAvoid: false });
        const withSea = resolveConditionTone({ ...input, swimVerdictAvoid: false });
        const seaSpoke = rank(withSea) < rank(windAlone);
        if (!PROVE && seaSpoke !== (factors.sea !== 'blue')) {
          seaSpokeQuietly += 1;
          fail('Ζ·σήματα', `${exposureLevel} @${beaufort}Μπφ θάλασσα ${seaStateM ?? '—'}: η θάλασσα `
            + `${seaSpoke ? 'ΚΑΤΕΒΑΣΕ' : 'δεν κατέβασε'} το χρώμα αλλά το σήμα της είναι ${factors.sea}`);
        }
      }
    }
  }
}
if (!liedCalm && !seaSpokeQuietly) {
  ok('Ζ·σήματα', `${cases} συνδυασμοί: κανένα σήμα δεν διαφωνεί με το χρώμα της κάρτας`);
}

/* ------------------------------------------------------------------ έξοδος */

if (PROVE) {
  const bit = (claim) => failures.some(f => f.startsWith(`[${claim}`));
  const bitD = bit('Δ·ίδιο-νούμερο');
  const bitZ = bit('Ζ·σήματα');
  console.log(`\n--prove: Δ δάγκωσε=${bitD}, Ζ δάγκωσε=${bitZ}`);
  if (bitD && bitZ) {
    console.log('PASSED (prove): με σαμποταρισμένη στρογγυλοποίηση και σαμποταρισμένα σήματα η πύλη πέφτει.');
    process.exit(0);
  }
  console.error('FAILED (prove): η πύλη ΔΕΝ δάγκωσε — είναι διακοσμητική.');
  process.exit(1);
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα(τα).`);
  failures.slice(0, 25).forEach(f => console.error('  - ' + f));
  if (failures.length > 25) console.error(`  … και άλλα ${failures.length - 25}`);
  process.exit(1);
}
console.log('\nPASSED: το χρώμα κρίνεται στην ακρίβεια που τυπώνεται, και τα δύο σήματα λένε την αλήθεια.');
