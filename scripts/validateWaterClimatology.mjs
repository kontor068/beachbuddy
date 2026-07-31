/**
 * ΠΥΛΗ 20 — Η ΘΕΡΜΟΚΡΑΣΙΑ ΣΤΟΥΣ ΟΔΗΓΟΥΣ ΛΕΕΙ ΤΑ ΙΔΙΑ ΜΕ ΤΗΝ ΚΑΡΤΑ «ΝΕΡΟ».
 *
 * Ίδιο σχήμα κινδύνου με την πύλη 19, και μία φορά χτύπησε ήδη: τα κατώφλια ζουν στο
 * pages/BeachDetailPage.tsx ΚΑΙ αντιγραμμένα σε Python + σε αυτό το module. Η πρώτη έκδοση
 * του Python έγραφε «ιδανικό» για `>= 24` ενώ η σελίδα λέει «ιδανικό» μόνο για `> 24`, και
 * **164 μήνες** είχαν λάθος λέξη. Τίποτα δεν έσκαγε· απλώς ο οδηγός θα έλεγε «ιδανικό» για
 * μήνα που η σελίδα της παραλίας βάφει «μέτριο».
 *
 * ΤΕΣΣΕΡΑ ΤΜΗΜΑΤΑ:
 *   1. Τα κατώφλια και ΤΑ ΑΝΟΙΧΤΑ/ΚΛΕΙΣΤΑ ΑΚΡΑ τους συμφωνούν σε τρία σημεία.
 *   2. Οι λέξεις είναι ΟΙ ΛΕΞΕΙΣ ΤΗΣ ΣΕΛΙΔΑΣ, σε κάθε γλώσσα.
 *   3. Οι κανόνες τιμιότητας ισχύουν, δοκιμασμένοι ανάποδα.
 *   4. ΤΟ ΚΑΛΩΔΙΟ: το prerender καλεί τη συνάρτηση με ταυτότητες και με το σωστό αρχείο.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REQUIRED_WATER_MONTHS, WATER_COLD_BELOW_C, WATER_IDEAL_ABOVE_C,
  summariseIslandWater, waterSeasonSection, withWaterSeasonSection,
} from '../utils/waterSeasonProfile.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];
const check = (label, ok, detail = '') => {
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

// ── 1. Τρία αντίγραφα του ίδιου κατωφλιού ─────────────────────────────────────────────
const detailPage = await readFile(path.join(projectRoot, 'pages', 'BeachDetailPage.tsx'), 'utf8');
const builder = await readFile(path.join(projectRoot, 'scripts', 'buildWaterClimatology.py'), 'utf8');

// Η σελίδα: `seaTemperatureC < 21 ? cold : seaTemperatureC <= 24 ? mild : ideal`
const pageCold = detailPage.match(/seaTemperatureC\s*<\s*(\d+)/);
const pageMild = detailPage.match(/seaTemperatureC\s*<=\s*(\d+)/);
check('η σελίδα δηλώνει κατώφλι κρύου', Boolean(pageCold), 'δεν βρέθηκε στο BeachDetailPage');
check('η σελίδα δηλώνει κατώφλι ιδανικού', Boolean(pageMild), 'δεν βρέθηκε στο BeachDetailPage');
if (pageCold) {
  check('κατώφλι κρύου: module vs σελίδα', Number(pageCold[1]) === WATER_COLD_BELOW_C,
    `σελίδα ${pageCold[1]} ≠ module ${WATER_COLD_BELOW_C}`);
}
if (pageMild) {
  check('κατώφλι ιδανικού: module vs σελίδα', Number(pageMild[1]) === WATER_IDEAL_ABOVE_C,
    `σελίδα ${pageMild[1]} ≠ module ${WATER_IDEAL_ABOVE_C}`);
}

const pyCold = builder.match(/WATER_COLD_BELOW_C\s*=\s*([\d.]+)/);
const pyIdeal = builder.match(/WATER_IDEAL_ABOVE_C\s*=\s*([\d.]+)/);
check('η Python δηλώνει τα κατώφλια', Boolean(pyCold && pyIdeal));
if (pyCold && pyIdeal) {
  check('κατώφλια: Python vs module',
    Number(pyCold[1]) === WATER_COLD_BELOW_C && Number(pyIdeal[1]) === WATER_IDEAL_ABOVE_C,
    `Python ${pyCold[1]}/${pyIdeal[1]} ≠ module ${WATER_COLD_BELOW_C}/${WATER_IDEAL_ABOVE_C}`);
}
// ΤΟ ΑΝΟΙΧΤΟ ΑΚΡΟ, που είναι το λάθος που ήδη έγινε: «ιδανικό» ΠΑΝΩ από 24, όχι ΑΠΟ 24.
check('η Python χρησιμοποιεί ΑΥΣΤΗΡΑ μεγαλύτερο για το ιδανικό',
  /median\s*>\s*WATER_IDEAL_ABOVE_C/.test(builder),
  'βρέθηκε >= ή άλλο· στα 24,0 ο οδηγός θα διαφωνούσε με τη σελίδα');
check('η Python μετράει το idealPct με το ίδιο άκρο',
  /arr\s*>\s*WATER_IDEAL_ABOVE_C/.test(builder));

// ── 2 & 3. Λέξεις και κανόνες τιμιότητας ──────────────────────────────────────────────
const monthsAt = (celsius) => Object.fromEntries(
  [4, 5, 6, 7, 8, 9, 10, 11].map(m => [String(m), { n: 150, medianC: celsius, tier: 'x' }]),
);
const waterOf = (ids, celsius = 25, overrides = {}) => ({
  sources: { temperature: { years: [2020, 2024], resolutionKm: 5 } },
  beaches: Object.fromEntries(ids.map(id => [String(id), {
    cellKm: 2, temperature: { months: { ...monthsAt(celsius), ...overrides } },
  }])),
});

check('κάτω από 3 παραλίες δεν βγαίνει προφίλ',
  summariseIslandWater([1, 2], waterOf([1, 2])) === null);
check('με 3 παραλίες βγαίνει προφίλ',
  summariseIslandWater([1, 2, 3], waterOf([1, 2, 3])) !== null);

const missing = waterOf([1, 2, 3]);
for (const id of ['1', '2', '3']) delete missing.beaches[id].temperature.months['7'];
check('με λειψή σεζόν δεν βγαίνει προφίλ',
  summariseIslandWater([1, 2, 3], missing) === null,
  `λείπει μήνας από τους ${REQUIRED_WATER_MONTHS.join('/')} και όμως δημοσιεύτηκε`);

check('χωρίς δεδομένα δεν σκάει', summariseIslandWater([1, 2, 3], null) === null);
check('χωρίς δεδομένα το άρθρο μένει ανέπαφο',
  withWaterSeasonSection({ sections: [{ heading: 'a', body: 'b' }] }, [1, 2, 3], null, 'gr')
    .sections.length === 1);
check('αντικείμενα αντί για ταυτότητες δεν παράγουν προφίλ',
  summariseIslandWater([{ id: 1 }, { id: 2 }, { id: 3 }], waterOf([1, 2, 3])) === null);

// Ακριβώς στο κατώφλι: 24,0 είναι «μέτριο», 24,1 είναι «ιδανικό».
const at24 = summariseIslandWater([1, 2, 3], waterOf([1, 2, 3], 24));
const at241 = summariseIslandWater([1, 2, 3], waterOf([1, 2, 3], 24.1));
check('στους 24,0 ακριβώς η λέξη είναι «μέτριο»', at24?.months['8']?.tier === 'moderate',
  `βγήκε ${at24?.months['8']?.tier}`);
check('στους 24,1 η λέξη είναι «ιδανικό»', at241?.months['8']?.tier === 'ideal',
  `βγήκε ${at241?.months['8']?.tier}`);
check('στους 20,9 η λέξη είναι «κρύο»',
  summariseIslandWater([1, 2, 3], waterOf([1, 2, 3], 20.9))?.months['8']?.tier === 'cold');

// Η αντι-διαισθητική πρόταση λέγεται ΜΟΝΟ όπου ισχύει, και όχι για μισό δέκατο.
const octWarmer = waterOf([1, 2, 3], 22, { 10: { n: 150, medianC: 23.5 }, 6: { n: 150, medianC: 22 } });
const octSame = waterOf([1, 2, 3], 22, { 10: { n: 150, medianC: 22.3 }, 6: { n: 150, medianC: 22 } });
check('«ο Οκτώβρης πιο ζεστός» όταν ισχύει',
  summariseIslandWater([1, 2, 3], octWarmer)?.octoberBeatsJune === true);
check('ΔΕΝ λέγεται για διαφορά κάτω από μισό βαθμό',
  summariseIslandWater([1, 2, 3], octSame)?.octoberBeatsJune === false,
  'διαφορά 0,3 °C είναι μέσα στο σφάλμα του πλέγματος');

// Οι λέξεις πρέπει να είναι ΤΑΥΤΟΣΗΜΕΣ με ό,τι τυπώνει η σελίδα παραλίας.
const PAGE_WORDS = {
  cold: ['cold', 'κρύο', 'kalt', 'fredda', 'froide'],
  moderate: ['mild', 'μέτριο', 'mild', 'tiepida', 'tempérée'],
  ideal: ['ideal', 'ιδανικό', 'ideal', 'ideale', 'idéale'],
};
for (const [tier, words] of Object.entries(PAGE_WORDS)) {
  for (const word of words) {
    check(`η σελίδα παραλίας εξακολουθεί να λέει «${word}» για ${tier}`,
      detailPage.includes(`'${word}'`),
      'άλλαξε η λέξη στη σελίδα και ο οδηγός έμεινε πίσω');
  }
}

const profile = summariseIslandWater([1, 2, 3], waterOf([1, 2, 3], 25.4));
for (const language of ['en', 'gr', 'de', 'fr', 'it']) {
  const section = waterSeasonSection(profile, language);
  check(`κείμενο ${language}`, Boolean(section?.heading && section?.body));
  const body = section?.body || '';
  check(`κείμενο ${language} χρησιμοποιεί τη λέξη της σελίδας`,
    PAGE_WORDS.ideal.some(w => body.includes(w)), body.slice(0, 80));
  // Το όριο: κελί ανοιχτά, όχι ακρογιαλιά. Ο χρήστης πρέπει να ξέρει προς τα πού πέφτει.
  check(`κείμενο ${language} δηλώνει το όριό του`,
    /offshore|ανοιχτά|vor der Küste|au large|al largo/i.test(body),
    'δεν λέει ότι το κελί είναι ανοιχτά και οι ρηχοί κόλποι πιο ζεστοί');
  check(`κείμενο ${language} λέει ότι οι κόλποι είναι πιο ζεστοί`,
    /warmer|πιο ζεστο|wärmer|plus chaudes|più calde/i.test(body));
  if (language !== 'en') {
    check(`κείμενο ${language}: υποδιαστολή με κόμμα`, !/\d\.\d/.test(body),
      'βρέθηκε αγγλική υποδιαστολή');
  }
}

// ── 4. ΤΟ ΚΑΛΩΔΙΟ ─────────────────────────────────────────────────────────────────────
const prerender = await readFile(path.join(projectRoot, 'scripts', 'prerenderBeachPages.mjs'), 'utf8');
check('το prerender εισάγει τη συνάρτηση',
  /import \{[^}]*withWaterSeasonSection[^}]*\} from '\.\.\/utils\/waterSeasonProfile\.mjs'/.test(prerender));
check('το prerender φορτώνει το αρχείο',
  /waterClimatology\.generated\.json/.test(prerender));
check('η φόρτωση είναι ανεκτική σε απόν αρχείο',
  /waterClimatology\.generated\.json'[\s\S]{0,80}\)\.catch\(\(\) => null\)/.test(prerender),
  'ένα clone χωρίς λογαριασμό Copernicus θα έσπαγε το build');
const call = prerender.match(/withWaterSeasonSection\(([\s\S]{0,200}?)\);/);
check('το prerender καλεί τη συνάρτηση', Boolean(call));
if (call) {
  // Δεν αρκεί το ΟΝΟΜΑ της μεταβλητής — μια `beachIds` που κρατάει αντικείμενα περνάει
  // κάθε έλεγχο ονόματος και αποτυγχάνει σιωπηλά στην εκτέλεση. Ελέγχουμε πού ορίζεται.
  const inlineIds = /\.map\(\s*beach\s*=>\s*beach\.id\s*\)/.test(call[1]);
  // ΟΛΑ τα ονόματα του call site, όχι το πρώτο — δες την ίδια σημείωση στην πύλη 19.
  const namedIsIds = (call[1].match(/[A-Za-z_$][\w$]*/g) || []).some(name => new RegExp(
    `(?:const|let)\\s+${name}\\s*=\\s*[\\s\\S]{0,120}?\\.map\\(\\s*beach\\s*=>\\s*beach\\.id\\s*\\)`,
  ).test(prerender));
  check('περνάει ΤΑΥΤΟΤΗΤΕΣ παραλιών, όχι αντικείμενα', inlineIds || namedIsIds,
    'χωρίς αυτό η αναζήτηση αστοχεί σιωπηλά και η ενότητα δεν εμφανίζεται ποτέ');
  // Τα δύο αρχεία μοιάζουν στο όνομα κατά ένα γράμμα (wave/water). Αν μπερδευτούν, το
  // κείμενο θερμοκρασίας δεν βρίσκει `temperature` και εξαφανίζεται αθόρυβα.
  check('περνάει το ΝΕΡΟ, όχι το κύμα', /waterClimatology/.test(call[1])
    && !/waveClimatology/.test(call[1]),
    'μπερδεύτηκε waveClimatology με waterClimatology');
  check('περνάει τη γλώσσα', /locale\.language/.test(call[1]));
}

// ── Το αρχείο δεδομένων ───────────────────────────────────────────────────────────────
const dataPath = path.join(projectRoot, 'data', 'waterClimatology.generated.json');
const data = await readFile(dataPath, 'utf8').then(JSON.parse).catch(() => null);
if (!data) {
  notes.push('δεν υπάρχει data/waterClimatology.generated.json — οι οδηγοί θα παραλείψουν '
    + 'την ενότητα (τρέξε npm run data:water-climatology)');
} else {
  const entries = Object.entries(data.beaches || {});
  check('το αρχείο έχει παραλίες', entries.length > 0);
  check('το αρχείο δηλώνει το ίδιο κατώφλι ιδανικού',
    data.thresholds?.idealAboveC === WATER_IDEAL_ABOVE_C,
    `αρχείο ${data.thresholds?.idealAboveC} ≠ κώδικας ${WATER_IDEAL_ABOVE_C}`);
  // Ο έλεγχος μονάδας: Kelvin αντί Κελσίου δεν σκάει πουθενά, βγάζει «θερμοκρασία 297».
  const all = entries.flatMap(([, e]) =>
    Object.values(e.temperature?.months || {}).map(m => m.medianC));
  const bad = all.filter(v => !(v > 5 && v < 35));
  check('όλες οι θερμοκρασίες σε λογικό εύρος', bad.length === 0,
    `${bad.length} τιμές εκτός 5-35 °C — πιθανό Kelvin`);
  const distinct = new Set(entries.map(([, e]) => e.temperature?.months?.['8']?.medianC));
  check('οι τιμές διαφέρουν ανά παραλία', distinct.size > 10,
    `μόνο ${distinct.size} διακριτές τιμές Αυγούστου`);
  notes.push(`${entries.length} παραλίες, ${distinct.size} διακριτές τιμές Αυγούστου`);
}

console.log('\nΠύλη 20 — θερμοκρασία νερού στους οδηγούς');
for (const note of notes) console.log(`  · ${note}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} αστοχίες:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ κατώφλια, άκρα, λέξεις, κανόνες τιμιότητας και σημείο σύνδεσης συμφωνούν\n');
