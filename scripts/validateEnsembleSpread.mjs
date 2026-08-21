#!/usr/bin/env node
/**
 * Ο ΔΕΙΚΤΗΣ ΑΒΕΒΑΙΟΤΗΤΑΣ ΛΕΕΙ ΤΟ ΙΔΙΟ ΜΕ ΤΟ APP — πύλη (βίβλος §Γ50).
 *
 * ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το `netlify/functions/ensemble-spread.mjs` **αντιγράφει** την
 * κλίμακα Μποφόρ, επειδή οι Netlify functions δεν μοιράζονται bundle με το app. Ένα αντίγραφο
 * σταθερών είναι αντίγραφο που ξεχνιέται: αν αύριο αλλάξει το `getBeaufortLevel` και όχι αυτό, ο
 * δείκτης θα κρίνει με άλλη κλίμακα από την κάρτα και **καμία άλλη πύλη δεν θα το δει**. Ίδια
 * οικογένεια με τα δύο σπασμένα μέτρα της 18/08 και με το `validateMarineModelParsing`.
 *
 * ΕΛΕΓΧΕΙ ΤΡΙΑ ΠΡΑΓΜΑΤΑ:
 *   1. Η κλίμακα Μποφόρ της function δίνει ΤΑΥΤΟΣΗΜΟ αποτέλεσμα με το utils/weatherUtils, σε όλο
 *      το εύρος 0-140 km/h με βήμα 0,5 — όχι σε λίγα δείγματα.
 *   2. Τα κατώφλια (2 βαθμίδες · 4 ώρες · παράθυρο 10-18) είναι ΤΑ ΙΔΙΑ με του εργαλείου μέτρησης
 *      `scripts/measureEnsembleSpread.mjs`, από το οποίο βγήκαν τα νούμερα που δικαιολόγησαν όλη
 *      τη δουλειά. Αν αποκλίνουν, η μέτρηση παύει να περιγράφει αυτό που τρέχει.
 *   3. Η ίδια η λογική: συνθετικά σενάρια που ΞΕΡΟΥΜΕ την απάντησή τους.
 *
 * ΤΙ ΔΕΝ ΦΥΛΑΕΙ: δεν κρίνει αν η αβεβαιότητα του μοντέλου είναι σωστή — δεν υπάρχει κριτής γι'
 * αυτό. Φυλάει ότι λέμε παντού το ίδιο πράγμα.
 *
 * Καθαρός υπολογισμός, χωρίς δίκτυο.
 *
 * Run: node scripts/validateEnsembleSpread.mjs
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
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const failures = [];
const fnPath = path.join(root, 'netlify/functions/ensemble-spread.mjs');
const toolPath = path.join(root, 'scripts/measureEnsembleSpread.mjs');
const fnSrc = fs.readFileSync(fnPath, 'utf8');
const toolSrc = fs.readFileSync(toolPath, 'utf8');

// ── 1 · Η ΚΛΙΜΑΚΑ ΜΠΟΦΟΡ, ΟΛΟ ΤΟ ΕΥΡΟΣ ──────────────────────────────────────
// Η αντιγραμμένη συνάρτηση εξάγεται με μια ελεγχόμενη αξιολόγηση του ίδιου της του κειμένου, ώστε
// να δοκιμάζεται ΤΟ ΚΕΙΜΕΝΟ ΠΟΥ ΤΡΕΧΕΙ και όχι μια δεύτερη αντιγραφή του μέσα σε αυτή την πύλη.
const beaufortBlock = fnSrc.match(/const beaufort = \(kmh\) => \{[\s\S]*?\n\};/);
if (!beaufortBlock) {
  failures.push('Δεν βρέθηκε η συνάρτηση beaufort() στο ensemble-spread.mjs — άλλαξε το σχήμα της.');
} else {
  // eslint-disable-next-line no-new-func
  const fnBeaufort = new Function(`${beaufortBlock[0]}\nreturn beaufort;`)();
  let mismatches = 0;
  let firstBad = null;
  for (let kmh = 0; kmh <= 140; kmh += 0.5) {
    const mine = fnBeaufort(kmh);
    const app = getBeaufortLevel(kmh);
    if (mine !== app) {
      mismatches += 1;
      if (!firstBad) firstBad = { kmh, mine, app };
    }
  }
  if (mismatches > 0) {
    failures.push(
      `Η κλίμακα Μποφόρ της function διαφέρει από το app σε ${mismatches} τιμές — πρώτη στα `
      + `${firstBad.kmh} km/h (function ${firstBad.mine}, app ${firstBad.app})`
    );
  }
}

// ── 2 · ΤΑ ΚΑΤΩΦΛΙΑ ΤΑΥΤΙΖΟΝΤΑΙ ΜΕ ΤΟ ΕΡΓΑΛΕΙΟ ΜΕΤΡΗΣΗΣ ─────────────────────
const constOf = (src, name) => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*Number\\(argVal\\('[a-z]+',\\s*'([\\d.]+)'\\)\\)`))
    || src.match(new RegExp(`const ${name}\\s*=\\s*([\\d.]+)`));
  return m ? Number(m[1]) : null;
};
const pairs = [
  ['GAP_RUNGS', 'πόσες βαθμίδες Μποφόρ κάνουν μια ώρα αβέβαιη'],
  ['UNCERTAIN_HOURS_FOR_DAY', 'πόσες αβέβαιες ώρες κάνουν μια ημέρα αβέβαιη'],
  ['SWIM_START_H', 'αρχή του παραθύρου κολύμβησης'],
  ['SWIM_END_H', 'τέλος του παραθύρου κολύμβησης'],
];
for (const [name, what] of pairs) {
  const inFn = constOf(fnSrc, name);
  const inTool = constOf(toolSrc, name);
  if (inFn === null || inTool === null) {
    failures.push(`Δεν διαβάστηκε το ${name} (function: ${inFn}, εργαλείο: ${inTool}) — ${what}`);
  } else if (inFn !== inTool) {
    failures.push(
      `${name}: η function λέει ${inFn}, το εργαλείο μέτρησης ${inTool} — ${what}. `
      + 'Τα νούμερα της βίβλου περιγράφουν πλέον κάτι που δεν τρέχει.'
    );
  }
}

// ── 3 · Η ΛΟΓΙΚΗ, ΣΕ ΠΕΡΙΠΤΩΣΕΙΣ ΠΟΥ ΞΕΡΟΥΜΕ ΤΗΝ ΑΠΑΝΤΗΣΗ ──────────────────
// Αναπαράγει τον βρόχο της function πάνω σε φτιαχτά σενάρια. Δεν αντιγράφει τα κατώφλια: τα
// διαβάζει από το ίδιο το αρχείο, ώστε μια αλλαγή εκεί να αλλάζει ΚΑΙ αυτό το τεστ.
const GAP = constOf(fnSrc, 'GAP_RUNGS');
const HOURS_FOR_DAY = constOf(fnSrc, 'UNCERTAIN_HOURS_FOR_DAY');
const START_H = constOf(fnSrc, 'SWIM_START_H');
const END_H = constOf(fnSrc, 'SWIM_END_H');

if (GAP !== null && HOURS_FOR_DAY !== null) {
  const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
  const dayIsUncertain = (hourlyRungs) => {
    let n = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      if (hour < START_H || hour >= END_H) continue;
      const rungs = [...(hourlyRungs[hour] || [])].sort((a, b) => a - b);
      if (rungs.length < 5) continue;
      if (percentile(rungs, 0.90) - percentile(rungs, 0.10) >= GAP) n += 1;
    }
    return n >= HOURS_FOR_DAY;
  };
  const fill = (maker) => Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, maker(h)]));
  const agreeing = fill(() => [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  const spread = fill(() => [2, 2, 3, 3, 4, 4, 5, 5, 5, 5]);
  const spreadOutsideWindow = fill((h) => (h >= START_H && h < END_H ? [3, 3, 3, 3, 3, 3, 3, 3, 3, 3] : [2, 2, 3, 4, 5, 5, 5, 5, 5, 5]));
  const barelyEnough = fill((h) => (h < START_H + HOURS_FOR_DAY ? [2, 2, 3, 3, 4, 4, 5, 5, 5, 5] : [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]));
  const oneShort = fill((h) => (h < START_H + HOURS_FOR_DAY - 1 ? [2, 2, 3, 3, 4, 4, 5, 5, 5, 5] : [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]));

  const cases = [
    ['σενάρια που συμφωνούν → ΒΕΒΑΙΗ', agreeing, false],
    ['σενάρια που απλώνονται 3 βαθμίδες → ΑΒΕΒΑΙΗ', spread, true],
    ['διαφωνία μόνο ΕΞΩ από το παράθυρο → ΒΕΒΑΙΗ', spreadOutsideWindow, false],
    [`ακριβώς ${HOURS_FOR_DAY} αβέβαιες ώρες → ΑΒΕΒΑΙΗ`, barelyEnough, true],
    [`${HOURS_FOR_DAY - 1} αβέβαιες ώρες → ΒΕΒΑΙΗ`, oneShort, false],
  ];
  for (const [label, data, expected] of cases) {
    const got = dayIsUncertain(data);
    if (got !== expected) failures.push(`ΛΟΓΙΚΗ: ${label} — βγήκε ${got ? 'ΑΒΕΒΑΙΗ' : 'ΒΕΒΑΙΗ'}`);
  }
}

// ── 4 · ΤΟ ΦΡΕΝΟ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΓΙΝΕΙ ΤΑΜΠΕΛΑΚΙ ────────────────────────
// Η βίβλος έχει απορρίψει τα μόνιμα μηνύματα αβεβαιότητας. Αν κάποιος γράψει copy γι' αυτόν τον
// δείκτη, θα φανεί εδώ πριν φτάσει σε οθόνη.
if (/confidence|εμπιστοσύν|αβεβαιότητ/i.test(fnSrc.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
  failures.push('Η function περιέχει κείμενο εμπιστοσύνης/αβεβαιότητας εκτός σχολίων — ο δείκτης είναι ΦΡΕΝΟ, όχι ταμπελάκι.');
}

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} ευρήματα:`);
  failures.forEach((line) => console.error(`- ${line}`));
  console.error('\nΜΗΝ «διορθώσεις» αλλάζοντας το εργαλείο μέτρησης για να ταιριάξει με τη function:');
  console.error('τα νούμερα της βίβλου (§Γ50) βγήκαν από το εργαλείο, και αν αλλάξει το κατώφλι');
  console.error('πρέπει να ΞΑΝΑΜΕΤΡΗΘΕΙ εθνικά, όχι να ευθυγραμμιστεί στα χαρτιά.');
  process.exit(1);
}

console.log('PASS — η κλίμακα Μποφόρ ταυτίζεται σε 281 τιμές, τα 4 κατώφλια συμφωνούν με το');
console.log('εργαλείο μέτρησης, οι 5 λογικές περιπτώσεις βγαίνουν σωστά, κανένα ταμπελάκι.');
