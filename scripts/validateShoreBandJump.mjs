#!/usr/bin/env node
/**
 * ΤΟ ΤΥΠΩΜΕΝΟ ΝΟΥΜΕΡΟ ΕΙΝΑΙ ΠΑΝΤΑ ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ — πύλη (24/08/2026, απόφαση Μίλτου).
 *
 * ΙΣΤΟΡΙΚΟ — ΑΥΤΗ Η ΠΥΛΗ ΦΥΛΑΓΕ ΤΟ ΑΝΤΙΘΕΤΟ, ΚΑΙ Η ΑΝΑΣΤΡΟΦΗ ΕΙΝΑΙ ΣΥΝΕΙΔΗΤΗ. Από τις
 * 21/08 (βίβλος §Γ47/§Γ49) το utils/beachConditionsReadout είχε «φράχτη της γραμμής ηρεμίας»:
 * όταν ο αριθμός ακτής έπεφτε στη ζώνη «ήρεμα» ενώ το ανοιχτό νερό όχι, ανέβαζε το τυπωμένο
 * νούμερο ως τη γραμμή AMBER, για να συμφωνεί με το χρώμα της πινέζας. Είχε μετρηθεί εθνικά
 * (105/178 παραλίες σε δύο μέρες μελτεμιού, 100% κάτω από μη ήρεμη πινέζα) και είχε αποκτήσει
 * εξαίρεση για τη μετρημένη «θάλασσα που φεύγει» (§Γ55/§Γ56).
 *
 * ΤΙ ΤΟΝ ΓΚΡΕΜΙΣΕ. Βάι, 24/08/2026, μέρα μελτεμιού: ανοιχτά ~1,1 μ., νερό στην άμμο 0,1 μ.
 * (SMB, όχι το ×0,5 — και ΟΧΙ «θάλασσα που φεύγει», άρα η εξαίρεση δεν έπιανε). Η κάρτα και η
 * πινέζα τύπωναν «~0,8 μ.» — νούμερο που δεν ήταν ούτε η θάλασσα έξω ούτε το νερό στην άμμο —
 * ενώ η σελίδα της παραλίας έλεγε το σωστό 0,1. Ο Μίλτος το είδε live και αποφάσισε: «θέλω να
 * γράφεις το κύμα στην ακτή σε όλα τα εμφανή σημεία, όχι το κύμα στα ανοιχτά». Το νούμερο λέει
 * την αλήθεια της ακτής· την προειδοποίηση την κουβαλούν το χρώμα της πινέζας και η ετυμηγορία,
 * που κρίνουν ΟΠΩΣ ΚΑΙ ΠΡΙΝ με το decision-grade sea state — καμία απόφαση δεν άλλαξε.
 *
 * ΤΟ ΓΝΩΣΤΟ ΚΟΣΤΟΣ, ΓΙΑ ΝΑ ΜΗΝ ΞΑΝΑΜΕΤΡΗΘΕΙ ΩΣ «ΕΥΡΗΜΑ»: σε μέρα μελτεμιού, οι παραλίες με
 * την έκπτωση ×0,5 (105 και 178 στις δύο μετρημένες μέρες) τυπώνουν ξανά «ήρεμο» νούμερο κάτω
 * από πινέζα που προειδοποιεί. Αυτό ΔΕΝ είναι πλέον σφάλμα — είναι το προϊόν: αριθμός = νερό
 * στην ακτή, χρώμα/ετυμηγορία = η σύσταση. Το ×0,5 παραμένει αβαθμονόμητο και χωρίς κριτή
 * (§7δ)· αν βαθμονομηθεί ποτέ, διορθώνεται ο ΑΡΙΘΜΟΣ, όχι η οθόνη από πάνω του.
 *
 * ΤΙ ΦΥΛΑΕΙ ΤΩΡΑ:
 *   (1) το τυπωμένο νούμερο είναι ΑΚΡΙΒΩΣ ο αριθμός ακτής (με ταβάνι το ανοιχτό νερό) —
 *       κανένας «τρίτος» κατασκευασμένος αριθμός ανάμεσά τους·
 *   (2) ποτέ πάνω από το ανοιχτό νερό·
 *   (3) το «~» μπαίνει όταν (και μόνο όταν) ο αριθμός ακτής διαφέρει από τη μέτρηση του
 *       ανοιχτού κατά ≥0,05 μ. — ο αναγνώστης βλέπει ότι είναι εκτίμηση·
 *   (4) τρεις ονομαστικές δεσμεύσεις: Βάι τυπώνει 0,1 πάνω από θάλασσα 1,14 (η περίπτωση που
 *       γέννησε την απόφαση)· ο ήρεμος όρμος 0,3→0,1 μένει 0,1· η Παραλία Μαραθώνα τυπώνει
 *       το δικό της 0,69 — ΟΧΙ το 0,8 του παλιού φράχτη, ΟΧΙ το 1,38 του ανοιχτού.
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

/** Ίδιο πλέγμα με την εποχή του φράχτη — και οι δύο πλευρές της περιόδου αναφοράς των 4 s. */
const OPEN_WATER_M = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, 2.6, 3.2];
const PERIODS_S = [undefined, 2.5, 3.2, 4, 5.5, 8];
/** Οι εκπτώσεις που μπορεί να φτάσουν στην οθόνη: ×0,5 της προστατευμένης, και ό,τι πιο βαθύ. */
const SHORE_FACTORS = [1, 0.5, 0.35, 0.2, 0.1];

const failures = [];
let cases = 0;
let tildeSeen = 0;

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
      const label = `ανοιχτό ${openM}μ / περίοδος ${periodS ?? '—'} / ×${factor} → ακτή ${shoreM}μ, τυπώθηκε ${shown}μ`;

      // (1) Ο ΑΡΙΘΜΟΣ ΑΚΤΗΣ, ΑΥΤΟΥΣΙΟΣ. Κανένα ανασήκωμα, κανένα τρίτο νούμερο.
      const expected = Math.min(shoreM, openM);
      if (typeof shown !== 'number' || Math.abs(shown - expected) > 1e-9) {
        failures.push(`ΑΛΛΟΙΩΜΕΝΟ ΝΟΥΜΕΡΟ: ${label} — έπρεπε ${expected}μ`);
        continue;
      }

      // (2) ΠΟΤΕ ΠΑΝΩ ΑΠΟ ΤΟ ΑΝΟΙΧΤΟ ΝΕΡΟ.
      if (shown > openM + 1e-9) {
        failures.push(`ΞΕΠΕΡΑΣΕ ΤΟ ΑΝΟΙΧΤΟ: ${label}`);
      }

      // (3) ΤΟ «~» ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ: μπαίνει όταν και μόνο όταν ακτή και ανοιχτό διαφέρουν ≥0,05 μ.
      const differs = Math.abs(shown - openM) >= 0.05;
      const hasTilde = typeof readout.waveText === 'string' && readout.waveText.startsWith('~');
      if (differs !== hasTilde) {
        failures.push(`ΛΑΘΟΣ «~»: ${label} — διαφέρει=${differs}, τυπώθηκε «${readout.waveText}»`);
      }
      if (hasTilde) tildeSeen += 1;
    }
  }
}

// ── ΤΡΕΙΣ ΟΝΟΜΑΣΤΙΚΕΣ ΔΕΣΜΕΥΣΕΙΣ ──────────────────────────────────────────────
// Βάι, 24/08/2026 — η περίπτωση που γέννησε την απόφαση: ανοιχτά 1,14 μ. στα 4,2 s, άμμος 0,1 μ.
// Ο παλιός φράχτης τύπωνε «~0,8 μ.»· τώρα πρέπει να βγαίνει το νερό της άμμου.
const vai = buildBeachConditionsReadout({
  beachWindSpeedKmph: 33, waveHeightM: 1.14, seaStateWaveM: 1.14, seaStatePeriodS: 4.2,
  shoreWaveHeightM: 0.1, shoreDisplayWaveM: 0.1, language: 'gr',
});
if (vai.waveM !== 0.1 || vai.waveText !== '~0,1 μ.') {
  failures.push(`ΒΑΪ: τυπώθηκε ${vai.waveM}μ («${vai.waveText}») αντί 0,1 («~0,1 μ.»)`);
}
// Ένας γνήσια κλειστός όρμος σε ήρεμη θάλασσα: 0,3 μ. ανοιχτά, 0,1 στην ακτή — μένει 0,1.
const calmCove = buildBeachConditionsReadout({
  beachWindSpeedKmph: 20, waveHeightM: 0.3, seaStateWaveM: 0.3, seaStatePeriodS: 5,
  shoreDisplayWaveM: 0.1, language: 'gr',
});
if (calmCove.waveM !== 0.1) {
  failures.push(`ΗΡΕΜΟΣ ΟΡΜΟΣ: τυπώθηκε ${calmCove.waveM}μ αντί 0,1`);
}
// Παραλία Μαραθώνα (μελτέμι 2022-09-06: ανοιχτά 1,38, ακτή ×0,5 = 0,69). Η γέννηση του παλιού
// φράχτη — και η συνειδητή του ταφή: τυπώνεται το 0,69 της ακτής. Η προειδοποίηση ζει στην
// πορτοκαλί πινέζα και στην ετυμηγορία «μην κολυμπήσεις», που δεν άλλαξαν.
const marathon = buildBeachConditionsReadout({
  beachWindSpeedKmph: 44, waveHeightM: 1.38, seaStateWaveM: 1.38, seaStatePeriodS: 4,
  shoreDisplayWaveM: 0.69, language: 'gr',
});
if (marathon.waveM !== 0.69) {
  failures.push(`ΜΑΡΑΘΩΝΑΣ: τυπώθηκε ${marathon.waveM}μ αντί για τον αριθμό ακτής 0,69`);
}

// ── ΔΙΧΤΥ ΠΑΝΩ ΣΤΗΝ ΙΔΙΑ ΤΗΝ ΠΥΛΗ ────────────────────────────────────────────
if (tildeSeen === 0) {
  failures.push('ΚΑΝΕΝΑ «~» σε όλο το πλέγμα — ο έλεγχος (3) δεν απέδειξε τίποτα');
}

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} περιπτώσεις (${cases} δοκιμάστηκαν):`);
  failures.slice(0, 20).forEach(line => console.error(`- ${line}`));
  if (failures.length > 20) console.error(`- ...και ${failures.length - 20} ακόμη`);
  console.error('\nΑν το νούμερο ξαναρχίσει να «διορθώνεται» προς τα πάνω, διάβασε πρώτα το ιστορικό');
  console.error('στην κεφαλίδα: ο φράχτης της γραμμής ηρεμίας ΥΠΗΡΞΕ και γκρεμίστηκε συνειδητά στις');
  console.error('24/08/2026 (Βάι). Μην τον ξαναχτίσεις χωρίς απόφαση του Μίλτου στο decision log.');
  process.exit(1);
}

console.log(`PASS — ${cases} περιπτώσεις· το τυπωμένο νούμερο είναι παντού ο αριθμός ακτής (${tildeSeen} με «~»).`);
console.log('Βάι 0,1/1,14 ✓ · ήρεμος όρμος 0,1/0,3 ✓ · Μαραθώνας 0,69/1,38 ✓ — κανένα κατασκευασμένο νούμερο.');
