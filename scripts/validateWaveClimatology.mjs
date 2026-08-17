/**
 * ΠΥΛΗ 19 — Η ΚΛΙΜΑΤΟΛΟΓΙΑ ΤΩΝ ΟΔΗΓΩΝ ΛΕΕΙ ΤΑ ΙΔΙΑ ΜΕ ΤΙΣ ΣΕΛΙΔΕΣ ΤΩΝ ΠΑΡΑΛΙΩΝ.
 *
 * Οι οδηγοί πρόθεσης λένε πλέον «η θάλασσα εδώ είναι ήρεμη το 78% των ημερών τον Ιούνιο».
 * Αυτό το νούμερο βγαίνει από Python (scripts/buildWaveClimatology.py) που ΑΝΤΙΓΡΑΦΕΙ τα
 * κατώφλια της εφαρμογής από το utils/waveCharacter.ts. Δύο αντίγραφα της ίδιας αλήθειας
 * σε δύο γλώσσες προγραμματισμού είναι ακριβώς το σχήμα που ξεσυγχρονίζεται σιωπηλά: κάποιος
 * αλλάζει το SEA_STATE_AMBER_M για να διορθώσει ένα χρώμα, και από κει και πέρα ο οδηγός
 * λέει «συνήθως ήρεμα» για παραλία που η σελίδα της βάφει πορτοκαλί. Κανένα τεστ δεν θα
 * χτυπούσε, γιατί και τα δύο μέρη «δουλεύουν».
 *
 * ΤΕΣΣΕΡΑ ΤΜΗΜΑΤΑ:
 *   1. Τα κατώφλια της Python == τα κατώφλια του TypeScript. Αριθμός προς αριθμό.
 *   2. Ο τύπος του swell-equivalent ύψους είναι ο ίδιος και στις δύο γλώσσες.
 *   3. Οι τέσσερις κανόνες τιμιότητας του seaSeasonProfile.mjs ισχύουν στην πράξη.
 *   4. ΤΟ ΚΑΛΩΔΙΟ: το prerender όντως καλεί τη συνάρτηση, με ΤΑΥΤΟΤΗΤΕΣ παραλιών.
 *
 * Το 4 υπάρχει επειδή η 18η πύλη πέρασε πράσινη πάνω σε σαμποταρισμένο κώδικα: έλεγχε τις
 * συναρτήσεις και όχι το σημείο σύνδεσης. Εδώ η αστοχία θα ήταν ακόμα πιο ύπουλη — αν το
 * prerender περάσει αντικείμενα παραλιών αντί για ταυτότητες, η αναζήτηση αποτυγχάνει
 * αθόρυβα, η ενότητα απλώς δεν εμφανίζεται ποτέ, και το build είναι πράσινο.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MIN_BEACHES, REQUIRED_MONTHS, summariseIslandSeason, seaSeasonSection, withSeaSeasonSection,
} from '../utils/seaSeasonProfile.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

const check = (label, condition, detail = '') => {
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const readNumber = (source, name) => {
  const match = source.match(new RegExp(`${name}\\s*=\\s*([0-9]*\\.?[0-9]+)`));
  return match ? Number(match[1]) : null;
};

// ── 1 & 2. Τα δύο αντίγραφα των κατωφλιών ─────────────────────────────────────────────
const waveCharacter = await readFile(path.join(projectRoot, 'utils', 'waveCharacter.ts'), 'utf8');
const builder = await readFile(path.join(projectRoot, 'scripts', 'buildWaveClimatology.py'), 'utf8');

const SHARED = [
  'SEA_STATE_AMBER_M', 'SEA_STATE_ROUGH_M', 'SEA_REFERENCE_PERIOD_S',
  'CHOP_EXPONENT', 'MAX_CHOP_FACTOR',
];
for (const name of SHARED) {
  const ts = readNumber(waveCharacter, name);
  const py = readNumber(builder, name);
  check(`κατώφλι ${name}`, ts !== null, 'δεν βρέθηκε στο utils/waveCharacter.ts');
  check(`κατώφλι ${name}`, py !== null, 'δεν βρέθηκε στο scripts/buildWaveClimatology.py');
  if (ts !== null && py !== null) {
    check(`κατώφλι ${name}`, ts === py, `TypeScript ${ts} ≠ Python ${py}`);
  }
}

// Ο τύπος, όχι μόνο οι σταθερές: μια Python που έγραφε `period / 4` αντί `4 / period` θα
// περνούσε τον έλεγχο σταθερών παραπάνω και θα αντέστρεφε κάθε ταραγμένη θάλασσα σε ήρεμη.
check('τύπος chop στην Python',
  /SEA_REFERENCE_PERIOD_S\s*\/\s*np\.where\(usable,\s*period/.test(builder),
  'ο λόγος αναφοράς/περιόδου δεν έχει τη σωστή φορά');
check('όριο chop στην Python',
  /np\.clip\(raw,\s*1\.0,\s*MAX_CHOP_FACTOR\)/.test(builder),
  'λείπει το ψαλίδισμα στο [1, MAX_CHOP_FACTOR]');
check('η Python συγκρίνει swell-equivalent ύψος',
  /severity\s*=\s*sea_state_severity\(heights,\s*periods\)/.test(builder),
  'φαίνεται να συγκρίνει ωμό ύψος αντί για swell-equivalent');

// ── 3. Οι κανόνες τιμιότητας, δοκιμασμένοι ανάποδα ────────────────────────────────────
const monthsFor = (calmPct) => Object.fromEntries(
  [5, 6, 7, 8, 9, 10].map(m => [String(m), { n: 500, calmPct, medianM: 0.4, roughPct: 5 }]),
);
const climatologyOf = (ids, calmPct = 70) => ({
  source: { resolutionKm: 4.2, years: [2015, 2024], kind: 'hourly-percentiles' },
  beaches: Object.fromEntries(ids.map(id => [String(id), { cellKm: 2, months: monthsFor(calmPct) }])),
});
const monthlyClimatologyOf = (ids, typicalM = 0.5) => ({
  source: { resolutionKm: 4.2, kind: 'monthly-typical' },
  beaches: Object.fromEntries(ids.map(id => [String(id), {
    cellKm: 2,
    months: Object.fromEntries([5, 6, 7, 8, 9, 10].map(
      m => [String(m), { typicalM, rawM: typicalM, tier: 'calm' }])),
  }])),
});

check('κάτω από το ελάχιστο πλήθος παραλιών δεν βγαίνει προφίλ',
  summariseIslandSeason([1, 2], climatologyOf([1, 2])) === null,
  `${MIN_BEACHES - 1} παραλίες παρήγαγαν προφίλ`);
check('με αρκετές παραλίες βγαίνει προφίλ',
  summariseIslandSeason([1, 2, 3], climatologyOf([1, 2, 3])) !== null);

const missingMonth = climatologyOf([1, 2, 3]);
for (const id of ['1', '2', '3']) delete missingMonth.beaches[id].months['9'];
check('με λειψή σεζόν δεν βγαίνει προφίλ',
  summariseIslandSeason([1, 2, 3], missingMonth) === null,
  `λείπει μήνας από τους ${REQUIRED_MONTHS.join('/')} και όμως δημοσιεύτηκε`);

check('χωρίς κλιματολογία δεν σκάει', summariseIslandSeason([1, 2, 3], null) === null);
check('χωρίς κλιματολογία το κείμενο μένει ανέπαφο',
  withSeaSeasonSection({ sections: [{ heading: 'a', body: 'b' }] }, [1, 2, 3], null, 'gr')
    .sections.length === 1);

// Αντικείμενα αντί για ταυτότητες — η σιωπηλή αστοχία που ψάχνει το τμήμα 4.
check('αντικείμενα παραλιών αντί για ταυτότητες δεν παράγουν προφίλ',
  summariseIslandSeason([{ id: 1 }, { id: 2 }, { id: 3 }], climatologyOf([1, 2, 3])) === null);

// Η διάμεσος, όχι ο μέσος όρος: μία ακραία παραλία δεν σέρνει ολόκληρο νησί.
const mixed = climatologyOf([1, 2, 3], 80);
mixed.beaches['3'].months = monthsFor(10);
const mixedProfile = summariseIslandSeason([1, 2, 3], mixed);
check('μία ακραία παραλία δεν σέρνει το νησί',
  mixedProfile && mixedProfile.months['7'].calmPct === 80,
  `βγήκε ${mixedProfile?.months['7']?.calmPct}% αντί για 80%`);

// ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ ΤΕΣΤ ΤΟΥ ΤΜΗΜΑΤΟΣ: μηνιαία δεδομένα (τυπικές τιμές) δεν επιτρέπεται να
// βγάλουν ΠΟΤΕ διατύπωση με ποσοστό ημερών. Ένα ποσοστό συμπερασμένο από μέσο όρο είναι
// εφευρεμένος αριθμός με πειστικό ντύσιμο, και ο αναγνώστης δεν έχει τρόπο να το δει.
const monthlyProfile = summariseIslandSeason([1, 2, 3], monthlyClimatologyOf([1, 2, 3]));
check('τα μηνιαία δεδομένα παράγουν προφίλ', monthlyProfile !== null);
check('τα μηνιαία δεδομένα σημαδεύονται ως τυπικές τιμές', monthlyProfile?.kind === 'typical');
for (const language of ['en', 'gr', 'de', 'fr', 'it']) {
  const body = seaSeasonSection(monthlyProfile, language)?.body || '';
  check(`τυπικές τιμές ${language}: καμία διατύπωση ποσοστού`, !/%/.test(body),
    'μέσος όρος παρουσιάστηκε ως ποσοστό ημερών');
  check(`τυπικές τιμές ${language}: αναφέρει μέτρα`, /\d[.,]\d+\s?(m\b|μ\.)/.test(body));
  // Οι μη-αγγλικές γλώσσες γράφουν υποδιαστολή με κόμμα. «0.88 μ.» μέσα σε ελληνικό
  // κείμενο διαβάζεται ως αμετάφραστο κομμάτι.
  if (language !== 'en') {
    check(`τυπικές τιμές ${language}: υποδιαστολή με κόμμα`, !/\d\.\d/.test(body),
      'βρέθηκε αγγλική υποδιαστολή');
  }
}

// ΤΟ ΜΕΛΤΕΜΙ ΔΕΝ ΦΥΣΑΕΙ ΣΤΟ ΙΟΝΙΟ. Χωρίς αυτόν τον έλεγχο, κάθε οδηγός της Κέρκυρας, της
// Ζακύνθου, της Κεφαλονιάς και της Λευκάδας δημοσίευε «τον Αύγουστο που το μελτέμι είναι
// στα δυνατά του» — λάθος που είχε ήδη συμβεί μία φορά στους ίδιους αυτούς οδηγούς.
const aegeanBody = seaSeasonSection(monthlyProfile, 'gr', 'south-aegean')?.body || '';
const ionianBody = seaSeasonSection(monthlyProfile, 'gr', 'ionian-islands-corfu')?.body || '';
check('το Αιγαίο λέει «μελτέμι»', /μελτέμι/.test(aegeanBody));
check('το Ιόνιο ΔΕΝ λέει «μελτέμι»', !/μελτέμι/.test(ionianBody),
  'ο οδηγός της Κέρκυρας θα έγραφε για άνεμο που δεν φυσάει εκεί');
check('το Ιόνιο λέει τον δικό του άνεμο', /μαΐστρο/.test(ionianBody), ionianBody.slice(0, 90));
// Το μελτέμι είναι ουδέτερο, ο μαΐστρος αρσενικός. Ένα σταθερό «ο» μπροστά έγραφε «ο
// μελτέμι» σε κάθε αιγαιακή σελίδα — μικρό λάθος, πολλαπλασιασμένο επί εκατοντάδες.
check('σωστό άρθρο για το μελτέμι', /το μελτέμι/.test(aegeanBody) && !/ο μελτέμι\b/.test(aegeanBody.replace(/το μελτέμι/g, '')));
check('σωστό άρθρο για τον μαΐστρο', /ο μαΐστρος/.test(ionianBody));

const profile = summariseIslandSeason([1, 2, 3], climatologyOf([1, 2, 3]));
check('τα ωριαία δεδομένα σημαδεύονται ως ποσοστά', profile?.kind === 'percentiles');
for (const language of ['en', 'gr', 'de', 'fr', 'it']) {
  const section = seaSeasonSection(profile, language);
  check(`κείμενο ${language}`, Boolean(section?.heading && section?.body));
  check(`κείμενο ${language} λέει ποσοστό`, /%/.test(section?.body || ''));
  // Κάθε γλώσσα ΠΡΕΠΕΙ να λέει ότι το νούμερο αφορά το ανοιχτό νερό, όχι την παραλία.
  // Χωρίς αυτό, μια προστατευμένη παραλία διαβάζεται ως χειρότερη απ' ό,τι είναι και ο
  // χρήστης δεν έχει τρόπο να το ξέρει.
  const disclaims = /open water|offshore|large|ανοιχτό νερό|vor der Küste|al largo/i.test(section?.body || '');
  check(`κείμενο ${language} δηλώνει το όριό του`, disclaims,
    'δεν λέει πουθενά ότι περιγράφει το ανοιχτό νερό και όχι τον όρμο');
  check(`κείμενο ${language} αναφέρει την πηγή`,
    /Copernicus/.test(section?.body || ''));
  // Και ΔΕΝ αρκεί να την αναφέρει: πρέπει να λέει ότι το νούμερο το βγάζουμε ΕΜΕΙΣ πάνω
  // στα δεδομένα της. Το τυπωμένο ύψος έχει ήδη περάσει διόρθωση αποτομότητας (× έως
  // 1,75), επιλογή κοντινότερου κελιού και διάμεσο σελίδας — «βγαίνουν από το Copernicus»
  // απέδιδε σε τρίτον έναν αριθμό που δεν παρήγαγε αυτός.
  const ownWork = /we calculate|υπολογίζουμε εμείς|berechnen wir|nous calculons|calcoliamo noi/i
    .test(section?.body || '');
  check(`κείμενο ${language} δηλώνει ότι το υπολογίζουμε εμείς`, ownWork,
    'αποδίδει σκέτο στην πηγή έναν αριθμό που έχει περάσει από τρεις δικούς μας μετασχηματισμούς');
}

// ── 4. ΤΟ ΚΑΛΩΔΙΟ ─────────────────────────────────────────────────────────────────────
const prerender = await readFile(path.join(projectRoot, 'scripts', 'prerenderBeachPages.mjs'), 'utf8');
check('το prerender εισάγει τη συνάρτηση',
  /import \{[^}]*withSeaSeasonSection[^}]*\} from '\.\.\/utils\/seaSeasonProfile\.mjs'/.test(prerender));
check('το prerender φορτώνει την κλιματολογία',
  /waveClimatology\.generated\.json/.test(prerender));
check('η φόρτωση είναι ανεκτική σε απόν αρχείο',
  /waveClimatology\.generated\.json'[\s\S]{0,80}\)\.catch\(\(\) => null\)/.test(prerender),
  'ένα καθαρό clone χωρίς λογαριασμό Copernicus θα έσπαγε το build');
const callSite = prerender.match(/withSeaSeasonSection\(([\s\S]{0,220}?)\);/);
check('το prerender καλεί τη συνάρτηση', Boolean(callSite));
if (callSite) {
  // Το όρισμα μπορεί να είναι είτε inline `.map(beach => beach.id)` είτε μεταβλητή. Στη
  // δεύτερη περίπτωση δεν αρκεί να δούμε το όνομα — ελέγχουμε ΠΟΥ ΟΡΙΖΕΤΑΙ. Μια μεταβλητή
  // που λέγεται `beachIds` και κρατάει αντικείμενα περνάει κάθε έλεγχο ονόματος και
  // αποτυγχάνει σιωπηλά στην εκτέλεση, που είναι ακριβώς η αστοχία που φυλάει η πύλη.
  const inlineIds = /\.map\(\s*beach\s*=>\s*beach\.id\s*\)/.test(callSite[1]);
  // ΟΛΑ τα ονόματα του call site, όχι το πρώτο: το πρώτο όρισμα είναι το content και το
  // δεύτερο οι ταυτότητες. Ένας έλεγχος καρφωμένος σε θέση ορίσματος εξετάζει λάθος
  // μεταβλητή μόλις αλλάξει η υπογραφή, και περνάει πράσινος για λάθος λόγο.
  const namedIsIds = (callSite[1].match(/[A-Za-z_$][\w$]*/g) || []).some(name => new RegExp(
    `(?:const|let)\\s+${name}\\s*=\\s*[\\s\\S]{0,120}?\\.map\\(\\s*beach\\s*=>\\s*beach\\.id\\s*\\)`,
  ).test(prerender));
  check('περνάει ΤΑΥΤΟΤΗΤΕΣ παραλιών, όχι αντικείμενα', inlineIds || namedIsIds,
    'χωρίς αυτό η αναζήτηση αποτυγχάνει σιωπηλά και η ενότητα δεν εμφανίζεται ποτέ');
  check('περνάει την κλιματολογία που φόρτωσε',
    /waveClimatology/.test(callSite[1]));
  check('περνάει τη γλώσσα του locale',
    /locale\.language/.test(callSite[1]));
}

// ── Το ίδιο το αρχείο δεδομένων, αν υπάρχει ───────────────────────────────────────────
const climatologyPath = path.join(projectRoot, 'data', 'waveClimatology.generated.json');
const climatology = await readFile(climatologyPath, 'utf8').then(JSON.parse).catch(() => null);
if (!climatology) {
  notes.push('δεν υπάρχει data/waveClimatology.generated.json — '
    + 'οι οδηγοί θα παραλείψουν την ενότητα (τρέξε scripts/buildWaveClimatology.py)');
} else {
  const entries = Object.entries(climatology.beaches || {});
  check('το αρχείο έχει παραλίες', entries.length > 0);
  check('το αρχείο δηλώνει τα κατώφλια που χρησιμοποίησε',
    climatology.thresholds?.calmBelowM === readNumber(waveCharacter, 'SEA_STATE_AMBER_M'),
    `αρχείο ${climatology.thresholds?.calmBelowM} ≠ κώδικας ${readNumber(waveCharacter, 'SEA_STATE_AMBER_M')}`);
  check('το αρχείο κουβαλά το όριό του γραπτώς',
    /not the shoreline|open water/i.test(climatology.limits || ''));
  // Το εύρος ελέγχεται ΑΝΑ ΣΧΗΜΑ. Η πρώτη έκδοση ζητούσε calmPct/medianM από οποιοδήποτε
  // αρχείο και κοκκίνισε και τις 2.766 παραλίες του μηνιαίου — σωστά, γιατί εκείνα τα
  // πεδία δεν υπάρχουν εκεί. Ένας έλεγχος που δεν ξέρει τι διαβάζει δεν ελέγχει τίποτα.
  const kind = climatology.source?.kind;
  check('το αρχείο δηλώνει το είδος του',
    kind === 'monthly-typical' || kind === 'hourly-percentiles', `βρέθηκε "${kind}"`);
  const outOfRange = ([, entry]) => Object.values(entry.months || {}).some(m => (
    kind === 'hourly-percentiles'
      ? !(m.calmPct >= 0 && m.calmPct <= 100) || !(m.medianM >= 0 && m.medianM < 12)
      : !(m.typicalM >= 0 && m.typicalM < 12) || !['calm', 'moderate', 'rough'].includes(m.tier)
  ));
  const bad = entries.filter(outOfRange);
  check('όλα τα νούμερα είναι σε λογικό εύρος', bad.length === 0,
    `${bad.length} παραλίες εκτός εύρους (σχήμα ${kind})`);
  // Ένα αρχείο όπου κάθε παραλία δείχνει την ίδια τιμή σημαίνει ότι η αντιστοίχιση σε
  // κελιά κατέρρευσε σε ένα σημείο — φαινομενικά έγκυρο, τελείως άχρηστο.
  const julyValues = new Set(entries.map(([, e]) => e.months?.['7']?.typicalM
    ?? e.months?.['7']?.calmPct).filter(v => v !== undefined));
  check('οι τιμές διαφέρουν ανά παραλία', julyValues.size > 10,
    `μόνο ${julyValues.size} διακριτές τιμές Ιουλίου σε ${entries.length} παραλίες`);
  notes.push(`${entries.length} παραλίες, σχήμα ${kind}, ${julyValues.size} διακριτές τιμές Ιουλίου`);
}

console.log('\nΠύλη 19 — κλιματολογία κύματος στους οδηγούς');
for (const note of notes) console.log(`  · ${note}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} αστοχίες:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log('✓ κατώφλια, τύπος, κανόνες τιμιότητας και σημείο σύνδεσης συμφωνούν\n');
