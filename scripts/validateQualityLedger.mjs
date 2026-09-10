#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ΕΙΝΑΙ ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΠΟΙΟΤΗΤΑΣ ΠΙΟ ΠΑΛΙΟ ΑΠΟ ΤΟΥΣ ΕΛΕΓΧΟΥΣ ΤΟΥ;
//
// ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Την 01/09/2026 η Κάρπαθος ξανατσεκαρίστηκε: παροχές 73→100,
// πλοήγηση 69→84, κείμενο 78→86. Το `qualityLedger.generated.mjs` είχε χτιστεί
// στις 31/08 και δεν ξαναχτίστηκε, οπότε το εβδομαδιαίο μήνυμα του Telegram
// έβγαλε την Κάρπαθο πρώτη σε προτεραιότητα με τα ΠΑΛΙΑ νούμερα και «έλεγχος
// πριν 22 μέρες» — δουλειά που είχε ήδη γίνει. Το λάθος το έπιασε ο άνθρωπος
// που θυμήθηκε ότι την είχαμε κοιτάξει· χωρίς αυτή τη μνήμη θα ξαναγινόταν.
//
// ΤΙ ΕΛΕΓΧΕΙ. Μόνο ένα πράγμα, και γι' αυτό δεν βγάζει ψεύτικους συναγερμούς:
// η μέρα που χτίστηκε το ημερολόγιο δεν πρέπει να είναι πιο πίσω από το
// τελευταίο commit που άγγιξε ό,τι το τροφοδοτεί (reports/ και τα δεδομένα
// παραλιών). ΔΕΝ ξαναχτίζει και ΔΕΝ συγκρίνει περιεχόμενο — δύο αντίγραφα της
// ίδιας αριθμητικής θα απέκλιναν, και μια πύλη που χτυπάει άδικα καταργείται.
//
// ΤΙ ΔΕΝ ΠΙΑΝΕΙ ΕΠΙΤΗΔΕΣ. Αλλαγές που δεν έχουν γίνει ακόμα commit, και ρηχά
// clones όπου το `git log` δεν ξέρει να απαντήσει — εκεί περνάει σιωπηλά αντί
// να μπλοκάρει ένα build για κάτι που δεν μπορεί να δει.
//
// Χρήση:  node scripts/validateQualityLedger.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledgerFile = path.join(rootDir, 'netlify', 'functions', 'lib', 'qualityLedger.generated.mjs');

/** Τα μονοπάτια που, αν αλλάξουν, αλλάζουν και το ημερολόγιο. */
const INPUTS = ['reports', 'public/data/beaches'];

/** Η μέρα του τελευταίου commit που άγγιξε τη διαδρομή, ή '' αν το git δεν ξέρει. */
const lastCommitDay = (target) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', target], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const at = out.trim();
    // Σε UTC, όπως το generatedAt του buildQualityLedger (new Date().toISOString()). Με τη μέρα της
    // τοπικής ώρας του commit, ένα commit 00:00-03:00 ώρα Ελλάδας «φαινόταν» μία μέρα μετά από ένα
    // ημερολόγιο χτισμένο το ίδιο λεπτό, και η πύλη έπεφτε ώσπου να ξαναχτιστεί την επόμενη μέρα UTC.
    return at ? new Date(at).toISOString().slice(0, 10) : '';
  } catch {
    return '';
  }
};

const ledger = await import(`${pathToFileURL(ledgerFile).href}?t=${Date.now()}`).catch(() => null);
if (!ledger?.generatedAt) {
  console.error('✖ Λείπει το netlify/functions/lib/qualityLedger.generated.mjs (ή δεν έχει generatedAt).');
  console.error('  Τρέξε: npm run quality:ledger');
  process.exit(1);
}

const newest = INPUTS.map((target) => ({ target, at: lastCommitDay(target) })).filter((row) => row.at);

if (!newest.length) {
  console.log('Ημερολόγιο ποιότητας: το git δεν δίνει ημερομηνίες (ρηχό clone) — ο έλεγχος παραλείπεται.');
  process.exit(0);
}

const stale = newest.filter((row) => row.at > ledger.generatedAt);

if (!stale.length) {
  console.log(`Ημερολόγιο ποιότητας: χτισμένο ${ledger.generatedAt}, πιο πρόσφατο από τους ελέγχους του. ✔`);
  process.exit(0);
}

console.error(`✖ Το ημερολόγιο ποιότητας χτίστηκε ${ledger.generatedAt} και έκτοτε άλλαξαν οι πηγές του:`);
for (const row of stale) {
  console.error(`    ${row.target} — τελευταία αλλαγή ${row.at}`);
}
console.error('');
console.error('  Η καρτέλα «Ποιότητα» και το εβδομαδιαίο μήνυμα του Telegram διαβάζουν αυτό το αρχείο,');
console.error('  οπότε δείχνουν κενά που ίσως έχουν ήδη κλείσει και ζητούν δουλειά που ίσως έχει γίνει.');
console.error('');
console.error('  Τρέξε: npm run quality:ledger   και κάνε commit το παραγόμενο αρχείο.');
process.exit(1);
