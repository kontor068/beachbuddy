#!/usr/bin/env node
/**
 * Netlify "ignore" command — αποφασίζει ΑΝ αξίζει να τρέξει build.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το Netlify Personal χρεώνει με credits ανά deploy (15 credits το
 * production deploy). Με ~100 push στο `main` τον μήνα, το πακέτο των 1.000 credits
 * τελειώνει πριν τα μισά. Ό,τι δεν αλλάζει το `dist/` δεν πρέπει να γίνεται deploy.
 *
 * ΣΥΜΒΑΣΗ ΤΟΥ NETLIFY — ΠΡΟΣΟΧΗ, ΕΙΝΑΙ ΑΝΤΙΣΤΡΟΦΗ ΑΠ' ΟΣΟ ΠΕΡΙΜΕΝΕΙΣ:
 *   exit 0        → ΑΚΥΡΩΣΕ το build (skip)
 *   exit non-zero → ΤΡΕΞΕ το build
 *
 * ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ: fail-open πρoς το build. Σε οτιδήποτε αβέβαιο — δεν βρέθηκε
 * προηγούμενο commit, απέτυχε το git, άγνωστο context — χτίζουμε. Ένα περιττό deploy
 * κοστίζει 15 credits· ένα deploy που ΔΕΝ έγινε ενώ έπρεπε σημαίνει ότι μια διόρθωση
 * δεν έφτασε ποτέ στους επισκέπτες, και τον Αύγουστο αυτό είναι ασύγκριτα χειρότερο.
 */

import { execFileSync } from 'node:child_process';

const SKIP = 0;   // ακύρωσε το build
const BUILD = 1;  // τρέξε το build

/** Διαδρομές που δεν καταλήγουν ΠΟΤΕ στο `dist/`. Ό,τι δεν είναι εδώ, χτίζει. */
const IRRELEVANT = [
  /^docs\//,
  /^reports\//,
  /^\.github\//,
  /^\.claude\//,
  /^[^/]+\.md$/,            // README.md, CLAUDE.md κ.λπ. στη ρίζα
  /^\.gitignore$/,
  /^LICENSE$/,
];

function log(message) {
  process.stdout.write(`[netlify-ignore] ${message}\n`);
}

function decide() {
  const context = process.env.CONTEXT || '';
  const branch = process.env.BRANCH || '';

  // 1. Ό,τι δεν είναι production δεν χτίζεται καθόλου. Τα deploy previews και τα
  //    branch deploys χρεώνονται κι αυτά, και δεν τα βλέπει κανένας επισκέπτης.
  //    Θέλεις preview σε ένα branch; Τρέξε `netlify deploy` τοπικά, ή άλλαξε εδώ.
  if (context && context !== 'production') {
    log(`context="${context}" (branch="${branch}") — δεν είναι production, skip.`);
    return SKIP;
  }

  const previous = process.env.CACHED_COMMIT_REF;
  const current = process.env.COMMIT_REF;

  // 2. Πρώτο build, καθαρό cache, ή rebuild του ίδιου commit από το dashboard:
  //    δεν υπάρχει διαφορά να εξετάσουμε, άρα χτίζουμε.
  if (!previous || !current) {
    log('δεν υπάρχει CACHED_COMMIT_REF/COMMIT_REF — build.');
    return BUILD;
  }
  if (previous === current) {
    log('ίδιο commit με το προηγούμενο deploy (χειροκίνητο rebuild) — build.');
    return BUILD;
  }

  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${previous}..${current}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    // Ρηχό clone, force-push που εξαφάνισε το παλιό commit, οτιδήποτε — χτίζουμε.
    log(`το git diff απέτυχε (${error.message.split('\n')[0]}) — build για ασφάλεια.`);
    return BUILD;
  }

  if (changed.length === 0) {
    log('καμία αλλαγή αρχείου ανάμεσα στα δύο commits — skip.');
    return SKIP;
  }

  const relevant = changed.filter((file) => !IRRELEVANT.some((pattern) => pattern.test(file)));

  if (relevant.length === 0) {
    log(`${changed.length} αλλαγές, καμία δεν αγγίζει το site (docs/reports/CI) — skip.`);
    return SKIP;
  }

  log(`${relevant.length}/${changed.length} αλλαγές αγγίζουν το site (π.χ. ${relevant.slice(0, 3).join(', ')}) — build.`);
  return BUILD;
}

process.exit(decide());
