#!/usr/bin/env node
/**
 * Η ΛΩΡΙΔΑ ΤΗΣ LANDING ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΥΠΟΣΧΕΘΕΙ ΠΕΡΙΣΣΟΤΕΡΕΣ ΑΠΟ ΟΣΕΣ ΔΕΙΧΝΕΙ Ο ΧΑΡΤΗΣ.
 *
 * Το πλακίδιο κάθε περιοχής γράφει «21 προστατευμένες σήμερα». Την ίδια λέξη — «Προστατευμένη»
 * — τη γράφει και ο χάρτης ένα κλικ μετά, από την ίδια συνάρτηση. Αν η landing πει 21 και ο
 * χάρτης δείξει 15, ο επισκέπτης δεν χάνει την εμπιστοσύνη του σε έναν αριθμό· τη χάνει και
 * στους δύο. Ακριβώς έτσι πέθαναν τα Μποφόρ των πλακιδίων τον Αύγουστο.
 *
 * Η ΠΡΟΣΤΑΣΙΑ ΕΙΝΑΙ ΚΑΤΩ ΦΡΑΓΜΑ, ΟΧΙ ΠΡΟΓΝΩΣΗ. Το data/landingShelter.generated.json ψήνεται
 * στα 6 Μποφόρ (buildLandingShelter.mjs). Αυτή η πύλη αποδεικνύει ότι το ψημένο πλήθος είναι
 * ≤ από το πραγματικό σε ΚΑΘΕ ένταση 1–9 Μποφόρ και σε κάθε μία από τις 24 κατευθύνσεις: ο
 * χάρτης δείχνει τουλάχιστον τόσες, ποτέ λιγότερες.
 *
 * ΤΙ ΠΙΑΝΕΙ. Κάθε μελλοντική αλλαγή στο μοντέλο έκθεσης, στα χειρόγραφα προφίλ, στη γεωμετρία
 * ή στα δεδομένα παραλιών που θα έκανε την υπόσχεση ψεύτικη — πριν φύγει live, όχι μετά.
 *
 * ΧΡΗΣΗ:  node scripts/validateLandingShelterBound.mjs
 *         npm run quality:landing-shelter
 *
 * Report-only ως προς τα αρχεία: δεν γράφει τίποτα, σκάει με κωδικό 1 αν σπάσει το φράγμα.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shelterForRegion, exposureLevelFor, BAKE_BEAUFORT } from './buildLandingShelter.mjs';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Το import του buildLandingShelter.mjs έχει ήδη περάσει τον φορτωτή TypeScript στο
// require.extensions, οπότε αυτό δουλεύει — και έτσι ο κατάλογος περιοχών δεν αντιγράφεται.
const { NATIONAL_SAMPLE_REGION_IDS } = createRequire(import.meta.url)(path.join(ROOT, 'services/nationalConditions.ts'));
const BAKED_FILE = path.join(ROOT, 'data/landingShelter.generated.json');
const SUMMARY_DIR = path.join(ROOT, 'public/data/beaches/app/summary');
const EXPOSURE_DIR = path.join(ROOT, 'public/data/geospatial/exposure');

/**
 * Όλο το εύρος που μπορεί να δει ένας επισκέπτης, όχι μόνο το καλοκαιρινό. Το 9 δεν είναι
 * ρεαλιστική μέρα παραλίας — μπαίνει επειδή μια πύλη που ελέγχει μόνο τα βολικά σενάρια δεν
 * είναι πύλη.
 */
const BEAUFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const STEP_DEG = 15;

if (!existsSync(BAKED_FILE)) {
  console.error('✗ Λείπει το data/landingShelter.generated.json. Τρέξε: node scripts/buildLandingShelter.mjs');
  process.exit(1);
}

const baked = JSON.parse(readFileSync(BAKED_FILE, 'utf8'));
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

const violations = [];
let checks = 0;

// ΚΑΛΥΨΗ ΠΡΩΤΑ. Τα σκέλη παρακάτω διατρέχουν ό,τι ΥΠΑΡΧΕΙ στο ψημένο αρχείο, οπότε μια νέα
// περιοχή που μπήκε στη λωρίδα αλλά δεν ξαναψήθηκε θα περνούσε αθόρυβα — με το πλακίδιό της
// να χάνει τον αριθμό του live, δηλαδή ακριβώς το είδος της σιωπηλής υποβάθμισης που κανείς
// δεν παρατηρεί. Ο κατάλογος διαβάζεται από την ΠΗΓΗ του (services/nationalConditions.ts).
const missing = NATIONAL_SAMPLE_REGION_IDS.filter(regionId => !baked.regions[regionId]);
if (missing.length > 0) {
  violations.push(
    `η λωρίδα δείχνει ${missing.length} περιοχές που δεν είναι ψημένες (${missing.join(', ')})`
    + ' — τρέξε node scripts/buildLandingShelter.mjs',
  );
}

for (const [regionId, region] of Object.entries(baked.regions)) {
  const summaryFile = path.join(SUMMARY_DIR, `${regionId}.json`);
  const exposureFile = path.join(EXPOSURE_DIR, `${regionId}.json`);
  if (!existsSync(summaryFile)) {
    violations.push(`${regionId}: λείπει το summary — το ψημένο αρχείο δείχνει περιοχή που δεν υπάρχει πια`);
    continue;
  }

  const beaches = readJson(summaryFile).island?.beaches || [];
  const profiles = existsSync(exposureFile) ? (readJson(exposureFile).profiles || {}) : {};
  // Το ΙΔΙΟ φιλτράρισμα με το build — αλλιώς οι δύο πλευρές μετράνε άλλο σύνολο παραλιών και
  // η σύγκριση δεν σημαίνει τίποτα.
  const usable = beaches.filter(beach => (
    profiles[String(beach.id)] || typeof beach.orientation?.degrees === 'number'
  ));

  if (usable.length !== region.total) {
    violations.push(
      `${regionId}: το ψημένο αρχείο λέει ${region.total} παραλίες με γεωμετρία, τα δεδομένα λένε ${usable.length}`
      + ' — ξαναψήσε (node scripts/buildLandingShelter.mjs)',
    );
    continue;
  }

  for (let bucket = 0; bucket < region.sheltered.length; bucket += 1) {
    const windDirectionDeg = bucket * STEP_DEG;
    const promised = region.sheltered[bucket];
    for (const beaufort of BEAUFORTS) {
      const actual = usable.reduce((count, beach) => (
        exposureLevelFor(beach, profiles[String(beach.id)], windDirectionDeg, beaufort) === 'protected'
          ? count + 1
          : count
      ), 0);
      checks += 1;
      if (promised > actual) {
        violations.push(
          `${regionId} @ ${windDirectionDeg}° / ${beaufort} Μποφόρ: η landing υπόσχεται ${promised},`
          + ` ο χάρτης δείχνει ${actual}`,
        );
      }
    }
  }
}

// Δεύτερο σκέλος: το ψημένο αρχείο να ΕΙΝΑΙ αυτό που παράγουν τα σημερινά δεδομένα. Χωρίς
// αυτό, ένα ξεχασμένο rebuild περνάει την πύλη με παλιούς — αλλά τυχαία συντηρητικούς —
// αριθμούς, δηλαδή σωστό φράγμα γύρω από λάθος περιοχή.
for (const [regionId, region] of Object.entries(baked.regions)) {
  const fresh = shelterForRegion(regionId);
  if (fresh.error) {
    violations.push(`${regionId}: ${fresh.error}`);
    continue;
  }
  if (fresh.sheltered.join(',') !== region.sheltered.join(',')) {
    violations.push(`${regionId}: το ψημένο αρχείο είναι μπαγιάτικο — τρέξε node scripts/buildLandingShelter.mjs`);
  }
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} παραβιάσεις του φράγματος:\n  ${violations.slice(0, 20).join('\n  ')}`);
  if (violations.length > 20) console.error(`  … και άλλες ${violations.length - 20}`);
  process.exit(1);
}

console.log(
  `✓ Το πλήθος προστατευμένων της landing είναι κάτω φράγμα σε ${checks.toLocaleString('el-GR')} ελέγχους`
  + ` (${Object.keys(baked.regions).length} περιοχές × 24 κατευθύνσεις × ${BEAUFORTS.length} εντάσεις,`
  + ` ψημένο στα ${BAKE_BEAUFORT} Μποφόρ).`,
);
