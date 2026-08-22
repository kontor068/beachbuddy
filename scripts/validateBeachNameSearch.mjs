/**
 * validateBeachNameSearch.mjs — «τη δείχνει ο χάρτης, δεν τη βρίσκει η αναζήτηση».
 *
 * 22/08/2026: αναζήτηση για «Paralia Paroikias (kentro)» επέστρεφε «We couldn't find …»
 * ενώ η παραλία ήταν εκεί, πάνω στον χάρτη. Ο λόγος: η αναζήτηση κρατούσε ΜΙΑ λατινική
 * γραφή των ελληνικών ονομάτων — τη φωνητική, όπου οι/ει/η/υ γίνονται όλα «i» — και ο
 * κόσμος γράφει την άλλη, γράμμα-γράμμα, όπως τη βλέπει σε Google Maps και σε πινακίδα.
 * 42 παραλίες πανελλαδικά ήταν άφαντες με το όνομά τους: κάθε «Αγία Ειρήνη», κάθε
 * «Άγιοι Ανάργυροι», κάθε «Άγιος Βασίλειος», κάθε «Ντράφι».
 *
 * Η πύλη τρέχει τον ΠΡΑΓΜΑΤΙΚΟ matcher (utils/searchNormalize.ts) πάνω στα ΠΡΑΓΜΑΤΙΚΑ
 * ονόματα των 110 περιοχών, σε τέσσερις γραφές, και είναι αυστηρότερη από την εφαρμογή:
 * δίνει μόνο τα δύο ονόματα της παραλίας, χωρίς aliases. Ό,τι περνάει εδώ περνάει και εκεί.
 *
 *   node scripts/validateBeachNameSearch.mjs            # assert
 *   node scripts/validateBeachNameSearch.mjs --report   # ντετερμινιστικό JSON
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const {
  isSearchMatch,
  toGreeklishSearchText,
  toNaturalLatinSearchText,
} = require('../utils/searchNormalize.ts');

if (typeof toNaturalLatinSearchText !== 'function' || typeof toGreeklishSearchText !== 'function') {
  console.error('✗ Λείπει μία από τις δύο λατινικές γραφές από το utils/searchNormalize.ts — ο κόσμος γράφει και τις δύο.');
  process.exit(1);
}

const reportOnly = process.argv.includes('--report');

// ─── Τα πραγματικά ονόματα, από το tier που τρέχει η εφαρμογή ────────────────
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const beaches = [];
for (const file of readdirSync(summaryDir).filter(name => name.endsWith('.json'))) {
  const parsed = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8'));
  const list = (parsed.island && parsed.island.beaches) || parsed.beaches || [];
  for (const beach of list) {
    if (!beach || !beach.name) continue;
    beaches.push({ region: file.replace('.json', ''), id: beach.id, gr: beach.name.gr, en: beach.name.en });
  }
}

if (beaches.length < 2500) {
  console.error(`✗ Διαβάστηκαν μόνο ${beaches.length} παραλίες — η πύλη δεν κρίνει με μισά δεδομένα.`);
  process.exit(1);
}

/**
 * Οι τέσσερις γραφές με τις οποίες φτάνει ένα όνομα στο πλαίσιο αναζήτησης. Οι δύο
 * λατινικές παράγονται από τις ΙΔΙΕΣ συναρτήσεις που χρησιμοποιεί ο matcher, όχι από
 * δεύτερο πίνακα εδώ: αν κάποιος πειράξει τον πίνακα, αλλάζει ταυτόχρονα ερώτημα και
 * απάντηση — γι' αυτό υπάρχουν και τα καρφωτά ζεύγη πιο κάτω, που δεν αλλάζουν ποτέ.
 */
const SPELLINGS = [
  ['ελληνικά', beach => beach.gr],
  ['αγγλικό όνομα', beach => beach.en],
  ['φωνητικό λατινικό', beach => toGreeklishSearchText(beach.gr || '')],
  ['λατινικό Google Maps', beach => toNaturalLatinSearchText(beach.gr || '')],
];

const failures = [];
for (const [spelling, toQuery] of SPELLINGS) {
  for (const beach of beaches) {
    const query = toQuery(beach);
    if (!query) continue;
    // Μόνο τα δύο ονόματα: η εφαρμογή δίνει και aliases, άρα ό,τι περνάει εδώ περνάει κι εκεί.
    if (!isSearchMatch(query, [beach.gr, beach.en])) {
      failures.push({ region: beach.region, id: beach.id, name: beach.gr, spelling, query });
    }
  }
}

/**
 * Καρφωτά ζεύγη: η γραφή που δίνει το Google Maps για ονόματα όπου οι δύο λατινικές
 * γραφές ΔΙΑΦΩΝΟΥΝ. Αν φύγει η μία από τις δύο, ο βρόχος από πάνω μπορεί να μείνει
 * σιωπηλός (ερώτημα και απάντηση αλλάζουν μαζί) — αυτά εδώ όχι.
 */
const PINNED = [
  ['Paralia Paroikias', 'Παραλία Παροικιάς (κέντρο)', 'Paralia Parikias (kentro)'],
  ['Agia Eirini', 'Αγία Ειρήνη', 'Agia Irini'],
  ['Agioi Anargyroi', 'Άγιοι Ανάργυροι', 'Agii Anargyri'],
  ['Agios Vasileios', 'Άγιος Βασίλειος', 'Agios Vasilios'],
  ['Mega Ntrafi', 'Μέγα Ντράφι', 'Mega Drafi'],
  ['Mikri Kolympithra', 'Μικρή Κολυμπήθρα', 'Mikri Kolympithra'],
  ['Paralia Parikias (kentro)', 'Παραλία Παροικιάς (κέντρο)', 'Paralia Parikias (kentro)'],
];
for (const [query, greekName, englishName] of PINNED) {
  if (!isSearchMatch(query, [greekName, englishName])) {
    failures.push({ region: 'pinned', id: null, name: greekName, spelling: 'καρφωτό', query });
  }
}

/**
 * Αντίστροφη απόδειξη: η πύλη δεν περνάει επειδή ο matcher λέει «ναι» σε όλα. Ονόματα
 * που δεν έχουν καμία σχέση με το ερώτημα πρέπει να μένουν εκτός.
 */
const MUST_NOT_MATCH = [
  ['Paroikia', 'Μύρτος', 'Myrtos'],
  ['Balos', 'Ελαφονήσι', 'Elafonisi'],
  ['Agia Eirini', 'Κολυμπήθρες', 'Kolymbithres'],
];
const overMatches = MUST_NOT_MATCH
  .filter(([query, greekName, englishName]) => isSearchMatch(query, [greekName, englishName]))
  .map(([query, greekName]) => ({ query, name: greekName }));

if (reportOnly) {
  console.log(JSON.stringify({
    beaches: beaches.length,
    spellings: SPELLINGS.map(([label]) => label),
    unfindable: failures.length,
    failures: failures.slice(0, 200),
    overMatches,
  }, null, 2));
  process.exit(0);
}

if (failures.length > 0 || overMatches.length > 0) {
  for (const failure of failures.slice(0, 30)) {
    console.error(`✗ ${failure.name} (${failure.region}#${failure.id}) — γραμμένο «${failure.query}» (${failure.spelling}) δεν τη βρίσκει`);
  }
  if (failures.length > 30) console.error(`  … και άλλες ${failures.length - 30}`);
  for (const over of overMatches) {
    console.error(`✗ «${over.query}» χτυπάει λάθος την «${over.name}» — ο matcher έγινε υπερβολικά ανεκτικός`);
  }
  process.exit(1);
}

console.log(`✓ ${beaches.length} παραλίες βρίσκονται με το όνομά τους σε ${SPELLINGS.length} γραφές (+${PINNED.length} καρφωτά ζεύγη).`);
