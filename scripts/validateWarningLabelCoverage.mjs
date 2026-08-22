#!/usr/bin/env node
/**
 * ΚΑΜΙΑ ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΤΗΣ ΚΑΡΤΑΣ ΔΕΝ ΜΙΛΑΕΙ ΑΓΓΛΙΚΑ ΣΕ ΕΛΛΗΝΑ (22/08/2026).
 *
 * ΤΙ ΕΓΙΝΕ. Το `warningLabel` στο `components/BeachCard.tsx` είναι ένα `switch` πάνω στο
 * `WarningFlagType` με `default: return warning.message`. Το `warning.message` το γράφει ο
 * κινητήρας για τον εαυτό του — στα αγγλικά, πάντα. Όποιος τύπος δεν είχε δικό του `case`
 * τύπωνε λοιπόν αυτούσια την αγγλική πρόταση σε ελληνική, γαλλική, γερμανική και ιταλική
 * κάρτα, χωρίς να σπάσει τίποτα και χωρίς να το δει καμία πύλη.
 *
 * Στις 22/08/2026 έλειπαν **έντεκα από τους είκοσι** τύπους. Ο ένας (`heat_uv`) βρέθηκε κατά
 * τύχη· οι δέκα άλλοι βρέθηκαν επειδή κάποιος κοίταξε τη λίστα. Αυτή η πύλη υπάρχει ώστε να
 * μη χρειαστεί ποτέ ξανά η τύχη.
 *
 * Ο ΚΑΝΟΝΑΣ: κάθε τιμή του `WarningFlagType` (types.ts — η μοναδική πηγή) έχει `case` μέσα
 * στο `warningLabel`. Το `default` μένει ως δίχτυ ασφαλείας για τον χρόνο εκτέλεσης, ΟΧΙ ως
 * τρόπος να αποφύγει κανείς να γράψει λεζάντα.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typesSource = readFileSync(path.join(root, 'types.ts'), 'utf8');
const cardSource = readFileSync(path.join(root, 'components/BeachCard.tsx'), 'utf8');

const failures = [];

/** Οι τιμές της ένωσης, από το ίδιο το types.ts — ποτέ χειρόγραφη λίστα εδώ. */
const unionMatch = typesSource.match(/export type WarningFlagType =([\s\S]*?);/);
if (!unionMatch) {
  console.error('FAILED: δεν βρέθηκε το `export type WarningFlagType` στο types.ts — άλλαξε το όνομα ή η μορφή.');
  process.exit(1);
}
const types = [...unionMatch[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
if (types.length < 5) {
  console.error(`FAILED: διάβασα μόνο ${types.length} τύπους προειδοποίησης — το parsing έσπασε, όχι ο κώδικας.`);
  process.exit(1);
}

/** Το σώμα ΜΟΝΟ της warningLabel: αλλιώς ένα `case` από άλλο switch θα μετρούσε για κάλυψη. */
const labelStart = cardSource.indexOf('const warningLabel = (');
if (labelStart === -1) {
  console.error('FAILED: δεν βρέθηκε η `warningLabel` στο components/BeachCard.tsx.');
  process.exit(1);
}
const labelEnd = cardSource.indexOf('\n};', labelStart);
const labelBody = cardSource.slice(labelStart, labelEnd === -1 ? cardSource.length : labelEnd);

const covered = new Set([...labelBody.matchAll(/case '([a-z_]+)':/g)].map(m => m[1]));
const missing = types.filter(type => !covered.has(type));
const stale = [...covered].filter(type => !types.includes(type));

if (missing.length > 0) {
  failures.push(`${missing.length} τύποι χωρίς λεζάντα — τυπώνουν το αγγλικό μήνυμα του κινητήρα: ${missing.join(', ')}`);
}
if (stale.length > 0) {
  failures.push(`${stale.length} λεζάντες για τύπους που δεν υπάρχουν πια στο WarningFlagType: ${stale.join(', ')}`);
}

/**
 * ΤΟ ΔΙΧΤΥ ΠΡΕΠΕΙ ΝΑ ΠΑΡΑΜΕΙΝΕΙ ΔΙΧΤΥ. Αν κάποιος σβήσει το `default`, ένας άγνωστος τύπος
 * θα γύριζε `undefined` και η κάρτα θα έδειχνε κενό τσιπάκι αντί για αγγλικό κείμενο — χειρότερο.
 */
if (!/default:\s*\n\s*return warning\.message;/.test(labelBody)) {
  failures.push('η `warningLabel` έχασε το `default: return warning.message` — χρειάζεται ως δίχτυ ασφαλείας');
}

/**
 * ΟΙ ΛΕΖΑΝΤΕΣ ΕΙΝΑΙ ΜΕΤΑΦΡΑΣΜΕΝΕΣ, ΟΧΙ ΑΝΤΙΓΡΑΦΕΣ. Ελέγχει ότι το ελληνικό μπλοκ `warnings:`
 * δεν περιέχει καμία από τις αγγλικές προτάσεις που γράφει ο κινητήρας. Είναι ο πιο συχνός
 * τρόπος να «κλείσει» κάποιος αυτή την πύλη χωρίς να λύσει το πρόβλημα.
 */
const engineSource = readFileSync(path.join(root, 'services/recommendationService.ts'), 'utf8');
const engineSentences = [...engineSource.matchAll(/message: ['"`]([A-Z][^'"`$]{20,})['"`]/g)].map(m => m[1]);
const greekStart = cardSource.indexOf("  gr: {");
const greekWarnings = greekStart === -1 ? '' : cardSource.slice(greekStart, cardSource.indexOf('\n  fr: {', greekStart));
for (const sentence of engineSentences) {
  if (greekWarnings.includes(sentence)) {
    failures.push(`η ελληνική κάρτα αντιγράφει αυτούσια αγγλική πρόταση του κινητήρα: «${sentence.slice(0, 60)}…»`);
  }
}

if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} πρόβλημα/τα στις λεζάντες προειδοποιήσεων της κάρτας.\n`);
  for (const line of failures) console.error(`  • ${line}`);
  console.error('\nΠΩΣ ΔΙΟΡΘΩΝΕΤΑΙ: για κάθε τύπο που λείπει, γράψε κείμενο και στις ΠΕΝΤΕ γλώσσες μέσα');
  console.error('στο `cardCopy[…].warnings` και πρόσθεσε `case \'<τύπος>\':` στη `warningLabel`.');
  console.error('ΜΗΝ αντιγράψεις το αγγλικό `message`: γράφτηκε για μηχανή, όχι για κάρτα παραλίας.');
  console.error('Αν το μήνυμα κουβαλάει νούμερο, πέρασέ το από το `WarningFlag.values` (types.ts)');
  console.error('και κάνε τη λεζάντα συνάρτηση — ποτέ regex πάνω στο αγγλικό κείμενο.');
  process.exit(1);
}

console.log(`PASSED: και οι ${types.length} τύποι προειδοποίησης έχουν λεζάντα σε πέντε γλώσσες· `
  + 'το αγγλικό μήνυμα του κινητήρα μένει δίχτυ ασφαλείας και δεν φτάνει σε οθόνη.');
