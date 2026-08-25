/**
 * ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΔΙΑΒΑΖΕΙ ΤΟΝ ΔΑΠΕΔΟ ΡΙΠΗΣ — ΚΑΤΑΛΟΓΟΣ ΚΑΤΑΝΑΛΩΤΩΝ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (§ΑΞ1/Α3, 21/08/2026). Ο δάπεδος ριπής δουλεύει, αλλά η μέτρηση της ίδιας μέρας
 * (`reports/weather/false-calm-vs-stations-2026-08-21.json`) έδειξε τι ακριβώς είναι: **διόρθωση
 * μεροληψίας, όχι φυσικό μέγεθος**. Στο **23%** των ωρών που λέμε «ήρεμα» η ριπή του μοντέλου
 * είναι φούσκα — μέση ριπή 18,07 χλμ/ώ πάνω σε μέσο 4,6, ενώ το όργανο βλέπει 7,7. Ο δάπεδος
 * πολλαπλασιάζει ΑΚΡΙΒΩΣ αυτή τη μεταβλητή επί 0,50 και βγαίνει καθαρά κερδισμένος
 * (1.233 διορθωμένα Μποφόρ έναντι 886 χαλασμένων), αλλά το κέρδος είναι στατιστικό: το ίδιο
 * νούμερο ΔΕΝ σηκώνει δεύτερη ερμηνεία.
 *
 * Η ΣΥΣΤΑΣΗ ΗΤΑΝ «ΚΑΜΙΑ ΑΛΛΑΓΗ, ΑΛΛΑ ΜΗΝ ΧΤΙΣΕΤΕ ΤΡΙΤΟ ΚΑΝΟΝΑ ΠΑΝΩ ΤΟΥ». Αυτή η πύλη είναι ο
 * μηχανισμός της: ο κατάλογος παρακάτω κλειδώνει ΠΟΙΑ αρχεία της παραγωγής καλούν το
 * `applyGustFloor` και ΠΟΙΑ διαβάζουν τον ωμό μέσο (`speedBeforeGustFloor`). Νέος καταναλωτής
 * ρίχνει την πύλη — όχι επειδή απαγορεύεται, αλλά επειδή πρέπει να τον δει άνθρωπος και να
 * γράψει γιατί ο διορθωμένος αριθμός είναι ο σωστός ΕΚΕΙ.
 *
 * ΤΙ ΔΕΝ ΕΛΕΓΧΕΙ: τη συμπεριφορά του ίδιου του δάπεδου — αυτή ανήκει στο
 * `scripts/validateGustFloorContract.mjs` (δύο πόρτες, μονοτονία, σταθερές, ωμός μέσος ως την
 * προειδοποίηση). Οι δύο πύλες είναι συμπληρωματικές: εκείνη φυλάει το ΤΙ ΚΑΝΕΙ, αυτή το ΠΟΙΟΣ
 * ΤΟ ΔΙΑΒΑΖΕΙ.
 *
 * Run: node scripts/validateGustFloorConsumers.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Ο κώδικας που ΦΤΑΝΕΙ ΣΕ ΕΠΙΣΚΕΠΤΗ. Τα scripts/ είναι εργαλεία και κρίνονται πιο χαλαρά. */
const SHIPPED_DIRS = ['utils', 'services', 'hooks', 'components', 'pages', 'netlify'];

/**
 * ΟΙ ΕΓΚΕΚΡΙΜΕΝΟΙ ΚΑΤΑΝΑΛΩΤΕΣ ΤΟΥ ΔΙΟΡΘΩΜΕΝΟΥ ΑΝΕΜΟΥ.
 *
 * `services/weatherService.ts`   — η κύρια διαδρομή· εδώ γεννιέται ο άνεμος κάθε ώρας και εδώ
 *                                  μπαίνει ο δάπεδος μία και μόνη φορά για όλη την εφαρμογή.
 * `services/nationalConditions.ts` — ο εθνικός χάρτης «τι γίνεται σήμερα στην Ελλάδα», που
 *                                  διαβάζει `current` και όχι την ωριαία σειρά, άρα δεν περνάει
 *                                  από την παραπάνω διαδρομή.
 */
const ALLOWED_APPLY = new Set([
  'services/weatherService.ts',
  'services/nationalConditions.ts',
]);

/**
 * ΟΙ ΕΓΚΕΚΡΙΜΕΝΟΙ ΑΝΑΓΝΩΣΤΕΣ ΤΟΥ ΩΜΟΥ ΜΕΣΟΥ.
 *
 * Ο ωμός μέσος υπάρχει για ΕΝΑΝ λόγο: το «πόσο ριπώδης είναι αυτή η ώρα» πρέπει να μετριέται
 * πάνω στον ΑΔΙΟΡΘΩΤΟ μέσο, αλλιώς ο δάπεδος σβήνει τις προειδοποιήσεις ριπής που ήρθε να
 * ενισχύσει (918 ώρες-παραλίες έχαναν την πύλη κύματος όταν αυτό ξεχάστηκε).
 */
const ALLOWED_RAW = new Set([
  'services/weatherService.ts',
  'services/recommendationService.ts',
  'utils/waveModel.ts',
  'utils/overWaterWind.ts',
  'types.ts',
]);

/**
 * ΟΙ ΕΓΚΕΚΡΙΜΕΝΟΙ ΑΝΑΓΝΩΣΤΕΣ ΤΗΣ ΣΤΕΡΙΑΝΗΣ ΤΑΧΥΤΗΤΑΣ ΠΟΥ ΑΝΤΙΚΑΤΕΣΤΗΣΕ Η ΘΑΛΑΣΣΑ (25/08/2026).
 *
 * Η ταχύτητα του θαλασσινού κελιού (utils/overWaterWind, §Γ51/§Γ52) είναι κι αυτή διόρθωση
 * μεροληψίας — μετρημένη καλύτερη στα αεροδρόμια, όχι φυσικό μέγεθος — και ισχύει ο ίδιος
 * κανόνας: κανένας τρίτος κανόνας από πάνω της. Το `speedBeforeOverWater` υπάρχει για ΕΝΑΝ λόγο:
 * η ριπή του στοιχείου μένει της ΣΤΕΡΙΑΣ, άρα «πόσο ριπώδης είναι η ώρα» πρέπει να πέφτει πίσω
 * στη στεριανή ταχύτητα, όχι στη θαλάσσια. Όποιος άλλος το διαβάσει, να πει γιατί.
 */
const ALLOWED_OVER_WATER_RAW = new Set([
  'services/recommendationService.ts',
  'utils/overWaterWind.ts',
  'types.ts',
]);

const walk = (dir) => {
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
};

const shippedFiles = SHIPPED_DIRS.flatMap(dir => walk(path.join(root, dir)))
  .concat([path.join(root, 'types.ts')].filter(p => { try { statSync(p); return true; } catch { return false; } }));

const rel = (file) => path.relative(root, file).split(path.sep).join('/');

const applyCallers = new Set();
const rawReaders = new Set();
const overWaterRawReaders = new Set();
for (const file of shippedFiles) {
  const source = readFileSync(file, 'utf8');
  const relPath = rel(file);
  if (relPath === 'utils/windGustFloor.ts') continue; // ο ίδιος ο ορισμός
  // Μόνο πραγματικές ΚΛΗΣΕΙΣ, όχι εισαγωγές ή αναφορές μέσα σε σχόλια.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/\bapplyGustFloor\s*\(/.test(code)) applyCallers.add(relPath);
  if (/\bspeedBeforeGustFloor\b/.test(code)) rawReaders.add(relPath);
  if (/\bspeedBeforeOverWater\b/.test(code)) overWaterRawReaders.add(relPath);
}

/** Δεύτερη συνταγή: αρχείο που ΞΑΝΑΓΡΑΦΕΙ τον δάπεδο αντί να τον εισάγει. */
const localCopies = [];
for (const file of walk(path.join(root, 'scripts'))) {
  const source = readFileSync(file, 'utf8');
  if (/(const|let|function)\s+applyGustFloor\s*[=(]/.test(source)) localCopies.push(rel(file));
}

const failures = [];
for (const file of applyCallers) {
  if (!ALLOWED_APPLY.has(file)) failures.push(`ΝΕΟΣ καταναλωτής του applyGustFloor: ${file}`);
}
for (const file of ALLOWED_APPLY) {
  if (!applyCallers.has(file)) failures.push(`Ο εγκεκριμένος καταναλωτής ${file} δεν καλεί πια applyGustFloor — ο δάπεδος έφυγε από διαδρομή που τον χρειαζόταν;`);
}
for (const file of rawReaders) {
  if (!ALLOWED_RAW.has(file)) failures.push(`ΝΕΟΣ αναγνώστης του ωμού μέσου: ${file}`);
}
for (const file of overWaterRawReaders) {
  if (!ALLOWED_OVER_WATER_RAW.has(file)) failures.push(`ΝΕΟΣ αναγνώστης της στεριανής ταχύτητας πριν τη θάλασσα (speedBeforeOverWater): ${file}`);
}

console.log('── Κατάλογος καταναλωτών του δάπεδου ριπής ──');
console.log(`  applyGustFloor:        ${[...applyCallers].sort().join(', ') || '—'}`);
console.log(`  speedBeforeGustFloor:  ${[...rawReaders].sort().join(', ') || '—'}`);
console.log(`  speedBeforeOverWater:  ${[...overWaterRawReaders].sort().join(', ') || '—'}`);
if (localCopies.length) {
  console.log(`  ⚠️ τοπικά αντίγραφα σε εργαλεία (δεν ρίχνουν την πύλη): ${localCopies.join(', ')}`);
  console.log('     Ένα αντίγραφο αποκλίνει σιωπηλά. Αν αυτό το script στηρίζει συμπέρασμα της βίβλου,');
  console.log('     πρέπει να καλεί το πραγματικό utils/windGustFloor.ts.');
}

if (failures.length) {
  console.error('\n❌ Ο κατάλογος άλλαξε:');
  for (const f of failures) console.error(`   • ${f}`);
  console.error('\nΤι να κάνεις: ΜΗΝ προσθέσεις απλώς το αρχείο στη λίστα. Ο δάπεδος ριπής είναι διόρθωση');
  console.error('μεροληψίας (§ΑΞ1/Α3): στο 23% των ήρεμων ωρών η ριπή που τον οδηγεί είναι φούσκα. Γράψε');
  console.error('πρώτα ΓΙΑΤΙ ο διορθωμένος αριθμός είναι ο σωστός σε αυτή τη νέα θέση, και αν μετράς');
  console.error('«πόσο ριπώδης είναι η ώρα» χρησιμοποίησε τον ΩΜΟ μέσο (wind.speedBeforeGustFloor).');
  process.exit(1);
}

console.log('\n✅ Κανένας νέος καταναλωτής.');
