/**
 * ΠΥΛΗ — «το σπαστό κύμα μιλάει, και μιλάει σπάνια».
 *
 * Η γραμμή του `utils/choppySeaCopy` μπήκε επειδή το `isShortPeriodSea` έζησε 18 μέρες ως νεκρός
 * κώδικας: γράφτηκε στις 28/07/2026 με σχόλιο «Used only to choose wording» και **δεν το κάλεσε
 * ποτέ κανείς**. Μια λειτουργία που κανείς δεν καταναλώνει δεν αποτυγχάνει θορυβωδώς — σωπαίνει,
 * και η σιωπή μοιάζει με «όλα καλά». Γι' αυτό η πύλη ελέγχει ΠΡΩΤΑ την καλωδίωση.
 *
 * Τέσσερα σκέλη, το καθένα για λάθος που έχει ήδη συμβεί σε αυτό το project:
 *   1. ΚΑΛΩΔΙΩΣΗ — κάποιος καταναλώνει τη συνάρτηση. (Το ακριβές λάθος του isShortPeriodSea.)
 *   2. ΠΛΗΡΟΤΗΤΑ 5 ΓΛΩΣΣΩΝ — κενό κείμενο σε DE/FR/IT περνάει απαρατήρητο για μήνες.
 *   3. ΚΑΝΕΝΑ ΜΕΤΡΟ ΣΤΟ ΚΕΙΜΕΝΟ — ο αριθμός είναι ήδη από πάνω· δεύτερη αναφορά ύψους είναι το
 *      διπλό ρομποτικό κείμενο που έχει ήδη κοστίσει εκκαθάριση.
 *   4. ΣΠΑΝΙΟΤΗΤΑ ΚΑΙ ΜΟΝΟΤΟΝΙΑ σε συνθετικό πλέγμα ύψους × περιόδου × χρώματος: η γραμμή δεν
 *      επιτρέπεται να μιλάει σε ήπιο κύμα, σε αποθάλασσα, ούτε πάνω από ήδη-προειδοποιημένο
 *      χρώμα. Χωρίς δίκτυο — είναι έλεγχος ΛΟΓΙΚΗΣ, όχι σημερινού καιρού.
 *
 * Run: node scripts/validateChoppySeaCopy.mjs
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
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { buildChoppySeaLine, CHOPPY_MIN_WAVE_M, CHOPPY_MIN_STEEPNESS } =
  require(path.join(root, 'utils/choppySeaCopy.ts'));
const { SEA_REFERENCE_PERIOD_S, waveSteepness } = require(path.join(root, 'utils/waveCharacter.ts'));

const LANGUAGES = ['gr', 'en', 'de', 'fr', 'it'];
const failures = [];
let checks = 0;

// ── 0. ΟΙ ΜΕΤΡΗΜΕΝΕΣ ΣΤΑΘΕΡΕΣ ΕΙΝΑΙ ΚΛΕΙΔΩΜΕΝΕΣ ──────────────────────────────────────────────
// ⚠️ Χωρίς αυτό, το σκέλος 4 παρακάτω ήταν ΤΑΥΤΟΛΟΓΙΑ: υπολόγιζε το «τι έπρεπε να γίνει» από τις
// ΙΔΙΕΣ σταθερές που έλεγχε, οπότε ένα σαμποτάζ που κατέβασε το πάτωμα ύψους σε 0,05 πέρασε
// πράσινο (15/08/2026). Μια πύλη που συμφωνεί με ό,τι κι αν γράψεις δεν είναι πύλη.
//
// Τα δύο νούμερα ΔΕΝ είναι γούστο — βγήκαν από μέτρηση 930 παραλιών σε 14 περιοχές
// (scripts/measureChopExponent.mjs, 15/08/2026): με σκέτη κοντή περίοδο η γραμμή θα μιλούσε στο
// 43,6% (ταμπέλα), με αυτά μιλάει στο 6,9%. Αλλαγή τους απαιτεί ΝΕΑ μέτρηση, όχι νέα γνώμη.
const LOCKED = [
  ['CHOPPY_MIN_WAVE_M', CHOPPY_MIN_WAVE_M, 0.4],
  ['CHOPPY_MIN_STEEPNESS', CHOPPY_MIN_STEEPNESS, 0.035],
];
for (const [name, actual, expected] of LOCKED) {
  checks += 1;
  if (actual !== expected) {
    failures.push(`ΣΤΑΘΕΡΑ: το ${name} είναι ${actual} αντί για ${expected}. Αν η αλλαγή είναι σκόπιμη, ξανατρέξε το scripts/measureChopExponent.mjs, γράψε το νέο μερίδιο στη βίβλο και ενημέρωσε ΚΑΙ αυτή την πύλη.`);
  }
}

// ── 1. ΚΑΛΩΔΙΩΣΗ ─────────────────────────────────────────────────────────────────────────────
const consumers = ['pages/BeachDetailPage.tsx'];
for (const file of consumers) {
  checks += 1;
  const source = readFileSync(path.join(root, file), 'utf8');
  // ⚠️ ΟΡΙΟ ΛΕΞΗΣ, ΟΧΙ `includes`. Η πρώτη εκδοχή έψαχνε υποσυμβολοσειρά και το σαμποτάζ
  // «μετονόμασε την κλήση σε DISABLED_buildChoppySeaLine» ΠΕΡΑΣΕ ΠΡΑΣΙΝΟ (15/08/2026) — το
  // όνομα υπήρχε ακόμα μέσα στο μετονομασμένο, και στο import από πάνω. Μια πύλη καλωδίωσης
  // που πιάνεται από το import δεν ελέγχει καλωδίωση, ελέγχει ορθογραφία.
  if (!/\bbuildChoppySeaLine\s*\(/.test(source)) {
    failures.push(`ΚΑΛΩΔΙΩΣΗ: το ${file} δεν ΚΑΛΕΙ το buildChoppySeaLine — η γραμμή δεν φτάνει σε καμία οθόνη.`);
  }
  if (!/\{choppySeaLine\s*&&/.test(source)) {
    failures.push(`ΚΑΛΩΔΙΩΣΗ: το ${file} υπολογίζει τη γραμμή αλλά δεν τη ζωγραφίζει (λείπει το render).`);
  }
}

// ── 2. ΠΛΗΡΟΤΗΤΑ 5 ΓΛΩΣΣΩΝ ───────────────────────────────────────────────────────────────────
// Είσοδος που ΠΡΕΠΕΙ να μιλήσει: ακριβώς η Σκάλα Κεφαλονιάς της 15/08/2026.
const SPEAKING_INPUT = { waveHeightM: 0.68, periodS: 3.3, tone: 'blue' };
const seen = new Map();
for (const language of LANGUAGES) {
  checks += 1;
  const line = buildChoppySeaLine({ ...SPEAKING_INPUT, language });
  if (!line || !line.trim()) {
    failures.push(`ΓΛΩΣΣΑ: κενή γραμμή στα «${language}» για την περίπτωση που τη γέννησε (0,68 μ. @ 3,3 δλ).`);
    continue;
  }
  if (seen.has(line)) failures.push(`ΓΛΩΣΣΑ: «${language}» και «${seen.get(line)}» δίνουν το ΙΔΙΟ κείμενο — αμετάφραστο.`);
  seen.set(line, language);

  // ── 3. ΚΑΝΕΝΑ ΜΕΤΡΟ ─────────────────────────────────────────────────────────────────────
  checks += 1;
  if (/\d+[.,]?\d*\s*(μ\.|m\b|мет)/i.test(line)) {
    failures.push(`ΜΕΤΡΑ: η γραμμή «${language}» περιέχει ύψος σε μέτρα — ο αριθμός είναι ήδη στην οθόνη.`);
  }
}

// ── 4. ΣΠΑΝΙΟΤΗΤΑ ΚΑΙ ΜΟΝΟΤΟΝΙΑ ──────────────────────────────────────────────────────────────
// Συνθετικό πλέγμα: κάθε συνδυασμός ελέγχεται απέναντι στον κανόνα που ΠΡΕΠΕΙ να ισχύει.
const HEIGHTS = [0.1, 0.2, 0.3, 0.39, 0.4, 0.5, 0.68, 0.9, 1.2, 1.8];
const PERIODS = [1.5, 2, 2.5, 3, 3.3, 3.9, 4, 4.5, 6, 8];
const TONES = ['blue', 'yellow', 'orange', 'red'];
let spoke = 0, total = 0;
for (const waveHeightM of HEIGHTS) {
  for (const periodS of PERIODS) {
    for (const tone of TONES) {
      total += 1;
      checks += 1;
      const line = buildChoppySeaLine({ waveHeightM, periodS, tone, language: 'gr' });
      const steep = waveSteepness(waveHeightM, periodS);
      const shouldSpeak = periodS < SEA_REFERENCE_PERIOD_S
        && waveHeightM >= CHOPPY_MIN_WAVE_M
        && steep >= CHOPPY_MIN_STEEPNESS
        && (tone === 'blue' || tone === 'yellow');
      if (shouldSpeak && !line) {
        failures.push(`ΠΛΕΓΜΑ: σιωπή ενώ έπρεπε να μιλήσει — ${waveHeightM}μ @ ${periodS}s, ${tone} (αποτομότητα ${steep.toFixed(4)}).`);
      }
      if (!shouldSpeak && line) {
        failures.push(`ΠΛΕΓΜΑ: μίλησε ενώ δεν έπρεπε — ${waveHeightM}μ @ ${periodS}s, ${tone} (αποτομότητα ${steep.toFixed(4)}).`);
      }
      if (line) spoke += 1;
    }
  }
}

// Η σπανιότητα είναι ΜΕΡΟΣ του συμβολαίου, όχι παρατήρηση: μια γραμμή που βγαίνει παντού είναι
// μόνιμη ταμπέλα. Το πλέγμα είναι σκόπιμα φορτωμένο με απότομες περιπτώσεις, άρα το ταβάνι εδώ
// είναι χαλαρότερο από το 15% του πραγματικού κόσμου — αλλά «παντού» πρέπει να πέφτει κόκκινο.
checks += 1;
const grid = spoke / Math.max(1, total);
if (grid > 0.2) failures.push(`ΣΠΑΝΙΟΤΗΤΑ: μιλάει στο ${(grid * 100).toFixed(1)}% του πλέγματος (ταβάνι 20%, ανέπαφο 15,0%) — αυτό είναι ταμπέλα, όχι παρατήρηση.`);
if (spoke === 0) failures.push('ΣΠΑΝΙΟΤΗΤΑ: δεν μίλησε ΠΟΤΕ σε όλο το πλέγμα — η λειτουργία είναι νεκρή.');

console.log(`quality:choppy-sea — ${checks} έλεγχοι · πλέγμα ${total} συνδυασμοί, μίλησε σε ${spoke} (${(grid * 100).toFixed(1)}%)`);
if (failures.length) {
  console.error(`\n❌ ${failures.length} αποτυχίες:`);
  for (const failure of failures.slice(0, 20)) console.error(`  · ${failure}`);
  if (failures.length > 20) console.error(`  … και άλλες ${failures.length - 20}`);
  process.exit(1);
}
console.log('✅ Καθαρό.');
