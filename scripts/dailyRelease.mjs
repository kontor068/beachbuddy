#!/usr/bin/env node
/**
 * `npm run release` — το ημερήσιο πέρασμα από το `dev` στο `main`.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το Netlify χρεώνει **πάγιο 15 credits ανά production deploy** (μετρημένο
 * 31/07/2026: 66 deploys = 983 από τα 1.000 credits του πακέτου, ενώ τα λεπτά build ήταν
 * μόλις 58′ συνολικά). Δηλαδή δεν πληρώνεις τον χρόνο, πληρώνεις το ΠΛΗΘΟΣ. Δέκα push σε
 * μια μέρα κοστίζουν δεκαπλάσια από ένα — για το ίδιο αποτέλεσμα στον επισκέπτη.
 *
 * Η ροή που επιβάλλει: δουλεύεις και κάνεις push στο `dev` όσο θέλεις (κανένα deploy,
 * κανένα credit), και μία φορά την ημέρα τρέχεις αυτό. Ένα deploy, 15 credits.
 *
 * ΔΥΟ ΣΧΕΔΙΑΣΤΙΚΕΣ ΕΠΙΛΟΓΕΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΤΥΧΑΙΕΣ:
 *
 * 1. ΔΕΝ ΚΑΝΕΙ CHECKOUT. Ενημερώνει το τοπικό `main` με `git push . dev:main`, δηλαδή
 *    χωρίς να αλλάξει ο φάκελος εργασίας. Ο φάκελος έχει μόνιμα ~110 αρχεία
 *    `public/data/coastline/shape/*.json` «αλλαγμένα» επειδή κάθε build ξαναγράφει το
 *    `generatedAt` τους. Ένα `git checkout main` θα τα κουβαλούσε ή θα σκόνταφτε πάνω
 *    τους. Έτσι, ο φάκελος μένει ακριβώς όπως τον άφησες.
 *
 * 2. ΔΕΝ ΚΑΝΕΙ PUSH. Σταματάει αφού ετοιμάσει το τοπικό `main` και σου δείχνει ΤΙ ακριβώς
 *    θα ανέβει. Το push είναι δική σου κίνηση, με τα μάτια σου στη λίστα — ένα push
 *    ανεβάζει ΟΛΟ το branch, όχι το τελευταίο commit.
 */

import { execFileSync } from 'node:child_process';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const OFF = '\x1b[0m';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function fail(message, hint) {
  console.error(`\n${RED}${BOLD}✖ ${message}${OFF}`);
  if (hint) console.error(`  ${hint}`);
  console.error('');
  process.exit(1);
}

console.log(`\n${BOLD}Ημερήσιο release: dev → main${OFF}\n`);

// ── 1. Είμαστε στο σωστό branch; ────────────────────────────────────────────
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'dev') {
  fail(
    `Είσαι στο branch "${branch}", όχι στο "dev".`,
    'Η δουλειά γίνεται στο dev. Τρέξε: git switch dev',
  );
}

// ── 2. Υπάρχει κάτι να βγει; ─────────────────────────────────────────────────
const [behind, ahead] = git('rev-list', '--left-right', '--count', 'main...dev')
  .split(/\s+/)
  .map(Number);

if (ahead === 0) {
  console.log(`${GREEN}Το main είναι ήδη ενημερωμένο — δεν υπάρχει τίποτα να βγει.${OFF}`);
  console.log('Κανένα deploy, κανένα credit.\n');
  process.exit(0);
}

// Το main δεν πρέπει να έχει δικά του commits. Αν έχει, κάποιος δούλεψε κατευθείαν
// εκεί και το fast-forward θα τα έσβηνε — σταματάμε αντί να «λύσουμε» κάτι μόνοι μας.
if (behind > 0) {
  fail(
    `Το main έχει ${behind} commit(s) που δεν υπάρχουν στο dev.`,
    'Κάποιος έγραψε κατευθείαν στο main. Τρέξε πρώτα: git switch dev && git merge main',
  );
}

console.log(`${ahead} commit(s) περιμένουν:\n`);
console.log(git('log', '--oneline', '--no-decorate', 'main..dev').split('\n').map((l) => `  ${l}`).join('\n'));
console.log('');

// ── 3. Το δίχτυ ποιότητας, ΠΡΙΝ ξοδευτούν τα credits ────────────────────────
// Ένα deploy που βγαίνει σπασμένο κοστίζει 30 credits: αυτό, συν το επόμενο που το
// διορθώνει. Ο έλεγχος είναι φθηνότερος από το δεύτερο deploy.
console.log(`${BOLD}Έλεγχοι ποιότητας…${OFF}\n`);
try {
  execFileSync('npm', ['run', 'quality:critical'], { stdio: 'inherit', shell: true });
} catch {
  fail(
    'Οι κρίσιμοι έλεγχοι απέτυχαν — το release σταμάτησε.',
    'Διόρθωσε τα παραπάνω στο dev και ξανατρέξε. Δεν ξοδεύτηκε κανένα credit.',
  );
}

// ── 4. Ενημέρωση του τοπικού main, χωρίς checkout ───────────────────────────
try {
  git('push', '.', 'dev:main');
} catch (error) {
  fail(`Δεν μπόρεσα να ενημερώσω το τοπικό main: ${error.message.split('\n')[0]}`);
}
console.log(`\n${GREEN}✔ Το τοπικό main ενημερώθηκε (ο φάκελος εργασίας δεν πειράχτηκε).${OFF}`);

// ── 5. Τι θα ανέβει πραγματικά ──────────────────────────────────────────────
let pending = [];
try {
  pending = git('log', '--oneline', '--no-decorate', 'origin/main..main').split('\n').filter(Boolean);
} catch {
  // Δεν υπάρχει origin/main τοπικά (φρέσκο clone) — προχωράμε χωρίς τη λίστα.
}

console.log(`\n${BOLD}Θα ανέβουν ${pending.length} commit(s) στην παραγωγή:${OFF}\n`);
console.log(pending.map((l) => `  ${l}`).join('\n') || '  (άγνωστο — τρέξε git fetch origin)');

console.log(`\n${YELLOW}Κόστος: 1 production deploy = 15 credits.${OFF}`);
console.log(`\n${BOLD}Αν η λίστα είναι σωστή, ανέβασέ το εσύ:${OFF}`);
console.log(`\n    git push origin main\n`);
