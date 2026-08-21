#!/usr/bin/env node
/**
 * ΤΟ ΤΥΠΩΜΕΝΟ ΝΟΥΜΕΡΟ ΔΕΝ ΛΕΕΙ «ΗΡΕΜΑ» ΟΤΑΝ Η ΘΑΛΑΣΣΑ ΕΞΩ ΔΕΝ ΕΙΝΑΙ — πύλη (βίβλος §Γ47/§Γ49).
 *
 * ΤΙ ΦΥΛΑΕΙ. Ο επισκέπτης δεν διαβάζει εκατοστά, διαβάζει ΖΩΝΗ: «ήρεμα» / «κύμα» / «φουρτούνα».
 * Η έκπτωση ×0,5 της προστατευμένης ακτής περνούσε και τις δύο γραμμές με μία κίνηση — Παραλία
 * Μαραθώνα, μέρα μελτεμιού: τυπωμένο 0,69 μ. («ήρεμα») πάνω από θάλασσα 1,38 μ., με ετυμηγορία
 * «μην κολυμπήσεις» και πορτοκαλί πινέζα.
 *
 * ΜΕΤΡΗΘΗΚΕ ΕΘΝΙΚΑ ΣΕ ΔΥΟ ΠΑΡΑΘΥΡΑ ΜΕΛΤΕΜΙΟΥ (110/110 περιοχές, 2.873 παραλίες):
 *   2022-09-06 → 105 παραλίες περνούν στο «ήρεμα» (3,7%)· 2024-06-29 → 178 (6,2%).
 *   Και στα δύο, το **100%** αυτών έχει πινέζα που ΔΕΝ είναι ήρεμη.
 *
 * ⚠️ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΕΠΙΑΝΕ ΜΟΝΟ ΤΟ ΔΙΠΛΟ ΑΛΜΑ και εξαιρούσε τις μονές πτώσεις με το
 * επιχείρημα «εκεί η ετυμηγορία είναι συνήθως καλή» — υπόθεση γραμμένη σαν μέτρηση. Όταν
 * μετρήθηκε, βγήκε ανάποδη: από 121 μονές πτώσεις, 61 avoid_swimming + 47 caution = 108 (89%)
 * φέρουν προειδοποίηση, μόνο 13 λένε «καλή». Γι' αυτό η πύλη πιάνει πλέον ΚΑΘΕ πτώση στο «ήρεμα».
 *
 * ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΠΙΑΝΕ ΤΟ `wave-display-agreement`. Εκείνη η πύλη ελέγχει το ίδιο σύμπτωμα ΜΟΝΟ
 * όταν ο άνεμος φυσάει ΠΑΝΩ στην ακτή. Οι περιπτώσεις εδώ είναι ακριβώς οι ανάποδες: η ακτή
 * λέγεται «προστατευμένη» επειδή ο άνεμος είναι απόγειος, και εκεί ακριβώς πληρώνεται η έκπτωση.
 * Οι δύο πύλες είναι συμπληρωματικές, όχι διπλές.
 *
 * ΤΙ ΔΕΝ ΦΥΛΑΕΙ: δεν κρίνει αν το ×0,5 είναι σωστό. Δεν υπάρχει εξωτερικός κριτής για ακτογραμμή
 * (§7δ) και η πύλη δεν προσποιείται ότι υπάρχει — φυλάει το ΣΥΜΠΤΩΜΑ, όχι την αιτία.
 *
 * Καθαρός υπολογισμός, χωρίς δίκτυο.
 *
 * Run: node scripts/validateShoreBandJump.mjs
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
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const {
  seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M,
} = require(path.join(root, 'utils/waveCharacter.ts'));

const bandOf = (severity) => {
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'φουρτούνα';
  if (severity >= SEA_STATE_AMBER_M) return 'κύμα';
  return 'ήρεμα';
};

/**
 * Το πλέγμα περιπτώσεων. Οι περίοδοι είναι και οι δύο πλευρές του `SEA_REFERENCE_PERIOD_S` (4 s),
 * ώστε να δοκιμαστεί ΚΑΙ ο πολλαπλασιαστής απότομου κύματος — ένας φράχτης γραμμένος σε σκέτο
 * ύψος θα περνούσε τα ήρεμα swell και θα άφηνε το κοντό κύμα να ξεφύγει.
 */
const OPEN_WATER_M = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, 2.6, 3.2];
const PERIODS_S = [undefined, 2.5, 3.2, 4, 5.5, 8];
/** Οι εκπτώσεις που μπορεί να φτάσουν στην οθόνη: ×0,5 της προστατευμένης, και ό,τι πιο βαθύ. */
const SHORE_FACTORS = [1, 0.5, 0.35, 0.2, 0.1];

const failures = [];
let cases = 0;
let guarded = 0;
let untouchedSingleDrops = 0;

for (const openM of OPEN_WATER_M) {
  for (const periodS of PERIODS_S) {
    for (const factor of SHORE_FACTORS) {
      const shoreM = Number((openM * factor).toFixed(2));
      const readout = buildBeachConditionsReadout({
        beachWindSpeedKmph: 38,
        waveHeightM: openM,
        seaStateWaveM: openM,
        seaStatePeriodS: periodS,
        shoreDisplayWaveM: shoreM,
        language: 'gr',
      });
      cases += 1;

      const shown = readout.waveM;
      if (typeof shown !== 'number') continue;

      const openBand = bandOf(seaStateSeverityM(openM, periodS));
      const shownBand = bandOf(seaStateSeverityM(shown, periodS));
      const rawBand = bandOf(seaStateSeverityM(shoreM, periodS));
      const label = `ανοιχτό ${openM}μ / περίοδος ${periodS ?? '—'} / ×${factor} → ακτή ${shoreM}μ, τυπώθηκε ${shown}μ`;

      // (1) ΚΑΜΙΑ ΠΤΩΣΗ ΣΤΟ «ΗΡΕΜΑ» ΟΤΑΝ Η ΘΑΛΑΣΣΑ ΕΞΩ ΔΕΝ ΕΙΝΑΙ. Αυτή είναι η πύλη.
      if (openBand !== 'ήρεμα' && openBand !== 'unknown' && shownBand === 'ήρεμα') {
        failures.push(`ΨΕΥΤΙΚΗ ΗΡΕΜΙΑ: ${label} — «${openBand}» έγινε «ήρεμα»`);
      }

      // (2) ΜΟΝΟΔΡΟΜΙΑ. Ο φράχτης επιτρέπεται μόνο να ΑΝΕΒΑΖΕΙ.
      if (shown < shoreM - 1e-9) {
        failures.push(`ΚΑΤΕΒΑΣΕ: ${label} — ο φράχτης δεν επιτρέπεται να μειώνει`);
      }

      // (3) ΠΟΤΕ ΠΑΝΩ ΑΠΟ ΤΟ ΑΝΟΙΧΤΟ ΝΕΡΟ. Θα ήταν υπερ-αυστηρότητα, το λάθος του quality:over-caution.
      if (shown > openM + 1e-9) {
        failures.push(`ΞΕΠΕΡΑΣΕ ΤΟ ΑΝΟΙΧΤΟ: ${label}`);
      }

      if (shown > shoreM + 1e-9) guarded += 1;

      // (4) Η ΜΟΝΗ ΠΤΩΣΗ ΠΙΑΝΕΤΑΙ ΚΙ ΑΥΤΗ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΠΡΟΗΓΟΥΜΕΝΟΥ ΛΑΘΟΥΣ.
      // Η πρώτη εκδοχή εξαιρούσε τις «κύμα → ήρεμα» με το επιχείρημα «εκεί η ετυμηγορία είναι
      // συνήθως καλή». Μετρήθηκε (2024-06-29, εθνικά): 108 από 121 φέρουν προειδοποίηση, μόνο 13
      // λένε «καλή» — το επιχείρημα ήταν αντίστροφο της πραγματικότητας.
      if (openBand === 'κύμα' && rawBand === 'ήρεμα') {
        untouchedSingleDrops += 1;
        if (shownBand === 'ήρεμα') {
          failures.push(`ΑΦΗΣΕ ΜΟΝΗ ΠΤΩΣΗ: ${label} — και οι μονές πτώσεις πρέπει να ανασηκώνονται`);
        }
      }
    }
  }
}

// ── ΤΕΣΣΕΡΙΣ ΟΝΟΜΑΣΤΙΚΕΣ ΔΕΣΜΕΥΣΕΙΣ ──────────────────────────────────────────
// Η Παραλία Μαραθώνα είναι η περίπτωση που γέννησε το εύρημα (μελτέμι 2022-09-06: 1,38 → 0,69).
const marathon = buildBeachConditionsReadout({
  beachWindSpeedKmph: 44, waveHeightM: 1.38, seaStateWaveM: 1.38, seaStatePeriodS: 4,
  shoreDisplayWaveM: 0.69, language: 'gr',
});
if (bandOf(seaStateSeverityM(marathon.waveM, 4)) === 'ήρεμα') {
  failures.push(`ΜΑΡΑΘΩΝΑΣ: τυπώθηκε ${marathon.waveM}μ, ακόμη «ήρεμα» πάνω από θάλασσα 1,38μ`);
}
// Ένας γνήσια κλειστός όρμος σε ήρεμη θάλασσα ΔΕΝ πρέπει να πειραχτεί: 0,3 μ. ανοιχτά, 0,1 στην
// ακτή. Αν ο φράχτης το ανέβαζε, θα είχαμε φτιάξει την υπερ-αυστηρότητα που πολεμάμε.
const calmCove = buildBeachConditionsReadout({
  beachWindSpeedKmph: 20, waveHeightM: 0.3, seaStateWaveM: 0.3, seaStatePeriodS: 5,
  shoreDisplayWaveM: 0.1, language: 'gr',
});
if (calmCove.waveM !== 0.1) {
  failures.push(`ΗΡΕΜΟΣ ΟΡΜΟΣ: τυπώθηκε ${calmCove.waveM}μ αντί 0,1 — ο φράχτης δεν έπρεπε να μιλήσει`);
}

// ── ΔΙΧΤΥ ΠΑΝΩ ΣΤΗΝ ΙΔΙΑ ΤΗΝ ΠΥΛΗ ────────────────────────────────────────────
// Αν ο φράχτης δεν έφτανε ποτέ στον υπολογισμό, κάθε έλεγχος από πάνω θα περνούσε κενός και η
// πύλη θα ήταν διακοσμητική. Απαιτούμε να έχει ΟΝΤΩΣ πυροδοτήσει σε αυτό το πλέγμα.
if (guarded === 0) {
  failures.push('Ο ΦΡΑΧΤΗΣ ΔΕΝ ΠΥΡΟΔΟΤΗΣΕ ΠΟΤΕ σε όλο το πλέγμα — η πύλη είναι διακοσμητική');
}
if (untouchedSingleDrops === 0) {
  failures.push('ΚΑΜΙΑ ΜΟΝΗ ΠΤΩΣΗ στο πλέγμα — ο έλεγχος (4) δεν απέδειξε τίποτα');
}

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} περιπτώσεις (${cases} δοκιμάστηκαν):`);
  failures.slice(0, 20).forEach(line => console.error(`- ${line}`));
  if (failures.length > 20) console.error(`- ...και ${failures.length - 20} ακόμη`);
  console.error('\nΜΗΝ χαλαρώσεις τον φράχτη στο utils/beachConditionsReadout για να περάσει μια');
  console.error('περίπτωση — ξαναφέρνει το ψεύτικο «ήρεμα». Οι μονές πτώσεις ΠΕΡΙΛΑΜΒΑΝΟΝΤΑΙ σκόπιμα:');
  console.error('μετρήθηκαν εθνικά και 108 από 121 φέρουν προειδοποίηση (βίβλος §Γ47, §Γ49).');
  process.exit(1);
}

console.log(`PASS — ${cases} περιπτώσεις· ο φράχτης μίλησε σε ${guarded}, από τις οποίες ${untouchedSingleDrops} ήταν μονές πτώσεις.`);
console.log('Καμία ταραγμένη θάλασσα δεν τυπώνεται ως «ήρεμα», και καμία παραλία δεν έγινε πιο άγρια από το νερό της.');
