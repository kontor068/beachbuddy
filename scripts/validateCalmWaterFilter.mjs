/**
 * Η ΠΥΛΗ ΤΟΥ ΦΙΛΤΡΟΥ «ΗΡΕΜΟ ΝΕΡΟ» — ΤΡΕΧΕΙ ΤΟΝ ΙΔΙΟ ΚΩΔΙΚΑ ΠΟΥ ΤΡΕΧΕΙ Ο ΧΑΡΤΗΣ.
 *
 * Καλεί `resolveCalmWaterState` (utils/calmWaterFilter) — τη συνάρτηση που φτιάχνει το chip —
 * πάνω στο εθνικό δείγμα της 15/08/2026 (110 περιοχές × 5 μέρες, `.tmp/colour-cause-split-cache.json`,
 * που το `scripts/measureColourCauseSplit.mjs --live` γέμισε με πραγματική πρόγνωση). Καμία
 * αναπαραγωγή κανόνα εδώ μέσα: αν το αρχείο έκρινε μόνο του, θα έλεγε «όλα καλά» για κώδικα που
 * κάνει άλλα — το ίδιο λάθος που το `measureColourCauseSplit` αποφεύγει με τον ίδιο τρόπο.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ, και γιατί το καθένα:
 *
 *   Α. ΠΟΤΕ ΑΔΕΙΟ, ΠΟΤΕ ΑΧΡΗΣΤΟ. Όποτε προσφέρεται το chip, ο αριθμός του είναι >0 και <όλες.
 *      Είναι το μάθημα των bundles φίλτρων της 11/08/2026 («άδειο σε 51/110 περιοχές») γραμμένο
 *      σε πύλη: ένα κουμπί που υπόσχεται N παραλίες και δίνει 0 — ή δίνει τις ίδιες N που ήδη
 *      έβλεπες — είναι δύο μορφές του ίδιου ψέματος.
 *
 *   Β. ΟΙ ΔΥΟ ΠΥΛΕΣ ΑΣΦΑΛΕΙΑΣ ΚΡΑΤΑΝΕ. Καμία παραλία με `swimVerdictAvoid` (η εφαρμογή λέει «μην
 *      μπεις») ή `offshoreFlatWater` (το νερό είναι γυαλί επειδή ο αέρας σε σπρώχνει ανοιχτά) δεν
 *      μπαίνει ποτέ στην προσφορά. Το φίλτρο είναι προορισμός, όχι σχόλιο.
 *
 *   Γ. ΣΙΩΠΗ ΣΤΑ ΛΙΓΑ ΜΠΟΦΟΡ. Κάτω από CALM_WATER_MIN_BEAUFORT δεν προσφέρεται τίποτα — μετρημένα
 *      εκεί δεν υπάρχει τίποτα να κοπεί (0 στις 259 σκηνές με 0–2 Μπφ είχαν έστω μία παραλία με
 *      κύμα).
 *
 *   Δ. ΤΟ FEATURE ΔΕΝ ΕΙΝΑΙ ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ — μετρημένο στον ΣΩΣΤΟ ΠΑΡΟΝΟΜΑΣΤΗ (23/08/2026).
 *      Το chip πρέπει να προσφέρεται σε ≥1/3 των σκηνών ΟΠΟΥ ΤΟΥ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΜΙΛΗΣΕΙ, όχι
 *      σε ≥20% του συνόλου. Δες το μπλοκ πάνω από το `evaluateReach` για το γιατί άλλαξε.
 *      Αν κάποια μελλοντική αλλαγή στα κατώφλια το κατεβάσει κάτω από αυτό, δεν έχουμε πια
 *      φίλτρο — έχουμε κουμπί που κανείς δεν βλέπει, και πρέπει να το μάθουμε από την πύλη και
 *      όχι από τη σιωπή.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ: αν το κατώφλι 0,4 μ. είναι το σωστό «ήρεμο». Αυτό είναι απόφαση προϊόντος και
 * ζει στο utils/conditionCause (FLAT_WATER_SEA_STATE_M), από όπου το φίλτρο το ΔΑΝΕΙΖΕΤΑΙ.
 *
 * Run: node scripts/validateCalmWaterFilter.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { resolveCalmWaterState, isCalmWaterPick, CALM_WATER_MIN_BEAUFORT, CALM_WATER_MAX_SHORE_M, calmWaterFilterCopy } =
  require(path.join(root, 'utils/calmWaterFilter.ts'));

/**
 * ΤΑ ΚΑΤΑΣΚΕΥΑΣΜΕΝΑ ΣΕΝΑΡΙΑ ΤΡΕΧΟΥΝ ΠΑΝΤΑ — και υπάρχουν επειδή το εθνικό δείγμα ζει στο `.tmp`,
 * που δεν είναι στο git. Χωρίς αυτά, η πύλη σε καθαρό clone θα «περνούσε» χωρίς να ελέγξει
 * τίποτα, δηλαδή θα ήταν κούφια — ακριβώς ο τύπος πύλης που το project έχει ήδη πληρώσει.
 * Καθένα κλειδώνει μια συμπεριφορά που η αλλαγή ενός κατωφλιού θα έσπαγε σιωπηλά.
 */
const reading = (over = {}) => ({
  tone: 'orange', cause: 'wind', windOnlyTone: 'orange',
  shoreSeaStateM: 0.2, beaufort: 5, swimVerdictAvoid: false, offshoreFlatWater: false, ...over,
});
const syntheticFailures = [];
const expectState = (label, entries, expected) => {
  const state = resolveCalmWaterState(entries);
  const got = state.status === 'offered' ? `offered:${state.count}` : `absent:${state.reason}`;
  if (got !== expected) syntheticFailures.push(`Σ ${label}: περίμενα ${expected}, πήρα ${got}`);
};
expectState('ήρεμη + κυματώδης στα 5 Μπφ', [
  { beachId: 1, reading: reading() },
  { beachId: 2, reading: reading({ shoreSeaStateM: 1.1 }) },
], 'offered:1');
expectState('όλες ήρεμες', [
  { beachId: 1, reading: reading() },
  { beachId: 2, reading: reading() },
], 'absent:all');
expectState('καμία ήρεμη', [
  { beachId: 1, reading: reading({ shoreSeaStateM: 1.1 }) },
  { beachId: 2, reading: reading({ shoreSeaStateM: 0.9 }) },
], 'absent:none');
expectState('άπνοια (2 Μπφ)', [
  { beachId: 1, reading: reading({ beaufort: 2 }) },
  { beachId: 2, reading: reading({ beaufort: 2, shoreSeaStateM: 1.1 }) },
], 'absent:light-wind');
expectState('η ήρεμη είναι avoid_swimming → δεν μετράει', [
  { beachId: 1, reading: reading({ swimVerdictAvoid: true }) },
  { beachId: 2, reading: reading({ shoreSeaStateM: 1.1 }) },
], 'absent:none');
expectState('η ήρεμη είναι απόγειος-γυαλί → δεν μετράει', [
  { beachId: 1, reading: reading({ offshoreFlatWater: true }) },
  { beachId: 2, reading: reading({ shoreSeaStateM: 1.1 }) },
], 'absent:none');
expectState('ακριβώς στο κατώφλι (0,4 μ.) δεν είναι ήρεμο', [
  { beachId: 1, reading: reading({ shoreSeaStateM: CALM_WATER_MAX_SHORE_M }) },
  { beachId: 2, reading: reading({ shoreSeaStateM: 1.1 }) },
], 'absent:none');
expectState('Βάι: 6 Μπφ με 0,1 μ. στην άμμο μένει μέσα', [
  { beachId: 1, reading: reading({ beaufort: 6, shoreSeaStateM: 0.1 }) },
  { beachId: 2, reading: reading({ beaufort: 6, shoreSeaStateM: 1.1 }) },
], 'offered:1');
// Εντολή Μίλτου 15/08: μία ΙΔΑΝΙΚΗ στον χάρτη και το chip σωπαίνει — ο επισκέπτης έχει ήδη
// καθαρή απάντηση, και δεύτερο κουμπί δίπλα της προσθέτει δουλειά αντί για πληροφορία.
expectState('μία ΙΔΑΝΙΚΗ στον χάρτη → σιωπή', [
  { beachId: 1, reading: reading() },
  { beachId: 2, reading: reading({ shoreSeaStateM: 1.1 }) },
  { beachId: 3, reading: reading({ tone: 'blue', shoreSeaStateM: 0.1 }) },
], 'absent:has-ideal');
expectState('καμία ιδανική, μόνο καλές και κάτω → μιλάει', [
  { beachId: 1, reading: reading({ tone: 'yellow' }) },
  { beachId: 2, reading: reading({ tone: 'orange', shoreSeaStateM: 1.1 }) },
], 'offered:1');

console.log(`Κατασκευασμένα σενάρια: ${syntheticFailures.length ? '❌' : '✅'} 10/10`);

/**
 * Ε — ΤΟ ΚΟΥΜΠΙ ΔΕΝ ΣΠΡΩΧΝΕΙ ΤΙΣ ΚΑΡΤΕΣ ΠΡΟΣ ΤΑ ΚΑΤΩ (εντολή Μίλτου, 15/08/2026).
 *
 * «Βάλ' το σαν top filter με εικονίδιο για να ξεχωρίζει, αλλά μη σπρώξει προς τα κάτω τις
 * παραλίες.» Είναι απαίτηση ΔΙΑΤΑΞΗΣ, και οι απαιτήσεις διάταξης είναι ακριβώς αυτές που ένα
 * μελλοντικό «καθάρισμα» χαλάει χωρίς να το καταλάβει — το κουμπί δείχνει σωστό όπου κι αν
 * κάτσει· αυτό που αλλάζει είναι πόσο μακριά πέφτει η πρώτη κάρτα.
 *
 * Τρία πράγματα κρατιούνται:
 *   • το κουμπί κάθεται ΜΕΣΑ στη σειρά του τίτλου της μπάρας ώρας — σειρά που υπάρχει ούτως ή
 *     άλλως, άρα κόστος ύψους μηδέν. Δεν επιτρέπεται να ξαναγυρίσει στη λεζάντα των χρωμάτων:
 *     μετρήθηκε ότι στο 61% των σκηνών όπου βγαίνει, η λεζάντα έχει δύο χρώματα σε μία γεμάτη
 *     σειρά, οπότε ένα τρίτο κελί ανοίγει δεύτερη·
 *   • η σειρά μένει `flex-nowrap`, αλλιώς σε στενή οθόνη το κουμπί τυλίγεται σε δική του γραμμή
 *     και το κόστος ύψους επιστρέφει από την πίσω πόρτα·
 *   • ο σύντομος τίτλος υπάρχει σε ΟΛΕΣ τις γλώσσες και μαζί με τη λέξη του κουμπιού χωράει σε
 *     μία γραμμή στα 320 px (~32 χαρακτήρες στα 11 px).
 */
const mapSource = readFileSync(path.join(root, 'components/BeachMap.tsx'), 'utf8');
const layoutFailures = [];
const helperRow = mapSource.match(/<div className="flex basis-full[^"]*">[\s\S]{0,4000}?<\/div>/);
if (!helperRow || !/hourSliderHelperShort\[language\]/.test(helperRow[0]) || !/canOfferCalmWater/.test(helperRow[0])) {
  layoutFailures.push('Ε: το κουμπί «Ήρεμο νερό» δεν κάθεται πια στη σειρά του τίτλου της μπάρας ώρας. '
    + 'Όπου αλλού κι αν μπει, προσθέτει σειρά — και η εντολή ήταν να μη σπρώχνει τις κάρτες.');
} else if (!/flex-nowrap/.test(helperRow[0])) {
  layoutFailures.push('Ε: η σειρά του τίτλου επιτρέπει πια αναδίπλωση (χάθηκε το flex-nowrap), '
    + 'οπότε σε στενή οθόνη το κουμπί πέφτει σε δική του γραμμή και σπρώχνει τις κάρτες.');
}
/**
 * Το ΑΝΑΜΜΑ του φίλτρου (`onCalmWaterFilterChange?.(!isCalmWaterActive)`) επιτρέπεται σε ΕΝΑ μόνο
 * σημείο, και όχι μέσα στη λεζάντα. Το ΣΒΗΣΙΜΟ (`(false)`) είναι άλλο πράγμα και ζει κανονικά
 * εκεί — είναι το κουμπί «Δείξε όλες τις παραλίες», η μία διέξοδος για κάθε κοπή του χάρτη.
 */
const toggleSites = (mapSource.match(/onCalmWaterFilterChange\?\.\(!isCalmWaterActive\)/g) ?? []).length;
if (toggleSites !== 1) {
  layoutFailures.push(`Ε: το κουμπί «Ήρεμο νερό» υπάρχει σε ${toggleSites} σημεία αντί για ένα. `
    + 'Δεύτερο αντίγραφο σημαίνει δεύτερη σειρά κάπου — μετρημένο: στο 61% των σκηνών όπου βγαίνει, '
    + 'η λεζάντα έχει ήδη δύο χρώματα σε μία γεμάτη σειρά δύο στηλών.');
}
{
  const legendPanel = mapSource.match(/const renderWindColorGuidePanel[\s\S]*?\n  \};/);
  if (legendPanel && /onCalmWaterFilterChange\?\.\(!/.test(legendPanel[0])) {
    layoutFailures.push('Ε: το κουμπί ξαναμπήκε μέσα στη λεζάντα των χρωμάτων, όπου προσθέτει σειρά.');
  }
}
{
  const shortBlock = mapSource.match(/const hourSliderHelperShort[\s\S]{0,400}?\n  \};/);
  if (!shortBlock) {
    layoutFailures.push('Ε: λείπει το hourSliderHelperShort — ο μακρύς τίτλος δίπλα στο κουμπί δεν χωράει σε μία γραμμή.');
  } else {
    for (const [language, words] of Object.entries(calmWaterFilterCopy)) {
      const short = shortBlock[0].match(new RegExp(`${language}: '([^']*)'`))?.[1];
      if (!short) {
        layoutFailures.push(`Ε: το hourSliderHelperShort δεν έχει ${language} — η γλώσσα θα τυπώσει τη μακριά μορφή δίπλα στο κουμπί.`);
        continue;
      }
      const width = short.length + words.label.length;
      if (width > 32) {
        layoutFailures.push(`Ε: ${language} — «${short}» + «${words.label}» = ${width} χαρακτήρες, πάνω από 32. `
          + 'Στα 320 px η σειρά σπάει και το κουμπί κατεβάζει τις κάρτες.');
      }
    }
  }
}
console.log(`Διάταξη (μηδέν επιπλέον ύψος): ${layoutFailures.length ? '❌' : '✅'}`);
layoutFailures.forEach(f => console.log('   ' + f));

const cachePath = path.join(root, '.tmp/colour-cause-split-cache.json');
if (!existsSync(cachePath)) {
  if (syntheticFailures.length || layoutFailures.length) {
    console.error('\n❌ Αστοχίες στα κατασκευασμένα σενάρια:');
    syntheticFailures.forEach(f => console.error('   ' + f));
    process.exit(1);
  }
  console.log('⏭️  Το εθνικό δείγμα (.tmp/colour-cause-split-cache.json) λείπει — παραλείπονται τα Α/Β/Γ/Δ.');
  console.log('   Για πλήρη έλεγχο: node scripts/measureColourCauseSplit.mjs --live');
  process.exit(0);
}

const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
const regions = cache.regions ?? {};

/**
 * Οι γραμμές του cache ΕΙΝΑΙ `ConditionCauseReading` — γράφτηκαν από την `describeConditionCause`
 * του προϊόντος. Δεν ξαναφτιάχνονται εδώ, μόνο ομαδοποιούνται σε σκηνές (περιοχή × μέρα), που
 * είναι ό,τι βλέπει ένας επισκέπτης σε μία οθόνη.
 */
const scenes = [];
for (const [regionId, region] of Object.entries(regions)) {
  const byDay = new Map();
  for (const row of region.rows ?? []) {
    if (typeof row.beaufort !== 'number' || typeof row.shoreSeaStateM !== 'number') continue;
    if (!byDay.has(row.dayIndex)) byDay.set(row.dayIndex, []);
    byDay.get(row.dayIndex).push({ beachId: row.beachId, reading: row, name: row.name });
  }
  for (const [dayIndex, entries] of byDay) scenes.push({ regionId, dayIndex, entries });
}

/**
 * Δ — ΤΟ ΕΡΩΤΗΜΑ ΑΛΛΑΞΕ ΠΑΡΟΝΟΜΑΣΤΗ, ΟΧΙ ΑΥΣΤΗΡΟΤΗΤΑ (23/08/2026).
 *
 * ΤΙ ΕΓΙΝΕ. Το Δ ζητούσε «το chip να προσφέρεται σε ≥20% ΤΩΝ ΣΚΗΝΩΝ, αλλιώς είναι νεκρός
 * κώδικας». Στις 22/08 ανανεώθηκε το εθνικό δείγμα (`measureColourCauseSplit --live`) και η
 * πύλη κοκκίνισε στο **18,5%** — ενώ μία ώρα νωρίτερα, με το δείγμα της 15/08, ήταν πράσινη.
 * Καμία γραμμή του `resolveCalmWaterState` δεν είχε αλλάξει. Άλλαξε ο ΚΑΙΡΟΣ.
 *
 * ΓΙΑΤΙ ΤΟ ΝΟΥΜΕΡΟ ΗΤΑΝ ΛΑΘΟΣ ΕΞ ΑΡΧΗΣ. Στις 550 σκηνές εκείνης της μέρας το chip σώπασε
 * **403 φορές ΕΠΙΤΗΔΕΣ**: 209 «λίγος αέρας» (κάτω από τα μποφόρ που κάνουν την προστασία να
 * σημαίνει κάτι) και 194 «υπάρχουν ήδη ιδανικές» (δεν χρειάζεται φίλτρο για να βρεις ήρεμο
 * νερό όταν ο χάρτης έχει μπλε). Αυτές οι δύο σιωπές ΕΙΝΑΙ ο σχεδιασμός. Μετρώντας τις μέσα
 * στον παρονομαστή, η πύλη τιμωρούσε το προϊόν επειδή ο καιρός ήταν καλός — και θα περνούσε
 * θριαμβευτικά σε μια εβδομάδα μελτεμιού ακόμα κι αν το φίλτρο είχε σπάσει.
 *
 * ⛔ ΤΟ ΟΡΙΟ ΔΕΝ ΚΑΤΕΒΗΚΕ. Το να γράψει κανείς 0,15 αντί για 0,20 θα ήταν ακριβώς ο κανόνας που
 * απαγορεύει η βίβλος («ΠΟΤΕ μην περάσεις την πύλη χαλαρώνοντας το κατώφλι»). Άλλαξε το
 * ΕΡΩΤΗΜΑ: από «πόσο συχνά μιλάει;» σε «**από τις φορές που του επιτρέπεται να μιλήσει, μιλάει;**».
 *
 * ΤΡΕΙΣ ΕΛΕΓΧΟΙ, ΟΧΙ ΕΝΑΣ — γιατί ένας λόγος χωρίς φύλακα στον παρονομαστή του είναι το ίδιο
 * τυφλός με τον προηγούμενο:
 *
 *   Δ1 · ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ. Στις σκηνές που του επιτρέπεται, το chip μιλάει σε ≥1/3. Κάτω από αυτό,
 *        στις ίδιες τις στιγμές που το προϊόν όρισε ως «η ώρα αυτού του φίλτρου», αποτυγχάνει
 *        δύο στις τρεις — αυτό δεν είναι επιλεκτικότητα, είναι βλάβη.
 *   Δ2 · Ο ΛΟΓΟΣ ΠΡΕΠΕΙ ΝΑ ΕΧΕΙ ΠΑΝΩ ΤΙ ΝΑ ΠΑΤΗΣΕΙ. Αν οι επιτρεπόμενες σκηνές πέσουν κάτω από
 *        το 10% του συνόλου, ο λόγος βγαίνει από μια χούφτα και δεν σημαίνει τίποτα — τότε
 *        σπάει ΕΔΩ, αντί να δίνει ένα καθησυχαστικό 100% από 4 σκηνές.
 *   Δ3 · ΟΙ ΔΥΟ ΣΚΟΠΙΜΕΣ ΣΙΩΠΕΣ ΠΡΕΠΕΙ ΝΑ ΥΠΑΡΧΟΥΝ. Αν κάποια από τις δύο μηδενιστεί, κάποιος
 *        την έσβησε από τον κώδικα — και τότε ο παρονομαστής μου έχει αλλάξει νόημα χωρίς να
 *        το πάρει κανείς είδηση. Αυτό είναι το αυτοσαμποτάζ του ίδιου του παρονομαστή.
 *
 * Αυτοαποδεικνύεται: `node scripts/validateCalmWaterFilter.mjs --prove` (δεν θέλει δείγμα).
 */
const MIN_ELIGIBLE_OFFER_SHARE = 1 / 3;
const MIN_ELIGIBLE_SHARE = 0.10;

const evaluateReach = ({ total, offered: offeredCount, absentBy: absent }) => {
  const problems = [];
  const lightWind = absent['light-wind'] ?? 0;
  const hasIdeal = absent['has-ideal'] ?? 0;
  const eligible = total - lightWind - hasIdeal;
  const eligibleShare = total > 0 ? eligible / total : 0;
  const offerShare = eligible > 0 ? offeredCount / eligible : 0;

  if (eligible <= 0 || offerShare < MIN_ELIGIBLE_OFFER_SHARE) {
    problems.push(
      `Δ1: από τις ${eligible} σκηνές όπου ΕΠΙΤΡΕΠΕΤΑΙ να μιλήσει, το chip μιλάει μόνο στις `
      + `${offeredCount} (${(offerShare * 100).toFixed(1)}%, όριο ${(MIN_ELIGIBLE_OFFER_SHARE * 100).toFixed(0)}%) — νεκρός κώδικας`
    );
  }
  if (eligibleShare < MIN_ELIGIBLE_SHARE) {
    problems.push(
      `Δ2: μόνο ${eligible} από ${total} σκηνές (${(eligibleShare * 100).toFixed(1)}%) επιτρέπουν στο chip να μιλήσει `
      + `— ο λόγος του Δ1 βγαίνει από πολύ λίγα και δεν σημαίνει τίποτα`
    );
  }
  if (lightWind === 0 || hasIdeal === 0) {
    problems.push(
      `Δ3: μία από τις δύο σκόπιμες σιωπές έχει μηδενιστεί (λίγος αέρας ${lightWind}, υπάρχουν ιδανικές ${hasIdeal}) `
      + `— ο παρονομαστής του Δ1 έχει αλλάξει νόημα`
    );
  }
  return { problems, eligible, eligibleShare, offerShare };
};

if (process.argv.includes('--prove')) {
  const cases = [
    ['υγιές (η εικόνα της 22/08)', { total: 550, offered: 102, absentBy: { 'light-wind': 209, 'has-ideal': 194, none: 42, all: 3 } }, false],
    ['νεκρό chip', { total: 550, offered: 0, absentBy: { 'light-wind': 209, 'has-ideal': 194, none: 147, all: 0 } }, true],
    ['λόγος από χούφτα', { total: 550, offered: 15, absentBy: { 'light-wind': 300, 'has-ideal': 230, none: 5, all: 0 } }, true],
    ['σβήστηκε η σιωπή «υπάρχουν ιδανικές»', { total: 550, offered: 300, absentBy: { 'light-wind': 209, 'has-ideal': 0, none: 41, all: 0 } }, true],
  ];
  let bad = 0;
  for (const [name, input, mustFail] of cases) {
    const got = evaluateReach(input).problems;
    const failed = got.length > 0;
    const ok = failed === mustFail;
    if (!ok) bad += 1;
    console.log(`${ok ? '✅' : '❌'} ${name}: ${failed ? got.join(' · ') : 'καθαρό'}`);
  }
  console.log(bad ? `\n❌ ${bad} περιπτώσεις δεν συμπεριφέρθηκαν όπως πρέπει.` : '\n✅ Το Δ πιάνει και τις τρεις βλάβες και αφήνει το υγιές να περάσει.');
  process.exit(bad ? 1 : 0);
}

const failures = [...syntheticFailures, ...layoutFailures];
let offered = 0;
const absentBy = { 'light-wind': 0, none: 0, all: 0 };
const sizes = [];

for (const scene of scenes) {
  const state = resolveCalmWaterState(scene.entries);
  const where = `${scene.regionId} d${scene.dayIndex}`;
  const maxBeaufort = Math.max(...scene.entries.map(e => e.reading.beaufort));

  if (state.status !== 'offered') {
    absentBy[state.reason] = (absentBy[state.reason] ?? 0) + 1;
    // Γ — η σιωπή στα λίγα μποφόρ πρέπει να είναι σιωπή ΓΙ' ΑΥΤΟΝ τον λόγο, όχι κατά τύχη.
    if (maxBeaufort < CALM_WATER_MIN_BEAUFORT && state.reason !== 'light-wind') {
      failures.push(`Γ ${where}: ${maxBeaufort} Μπφ αλλά ο λόγος σιωπής είναι «${state.reason}»`);
    }
    continue;
  }

  offered++;
  sizes.push(state.count);

  // Α — προσφορά που δεν κόβει τίποτα, ή που κόβει τα πάντα, δεν επιτρέπεται να υπάρχει.
  if (state.count === 0) failures.push(`Α ${where}: προσφέρθηκε chip με 0 παραλίες`);
  if (state.count === scene.entries.length) {
    failures.push(`Α ${where}: το chip κρατάει ΟΛΕΣ τις ${state.count} — δεν αφαιρεί τίποτα`);
  }
  if (state.count !== state.beachIds.size) {
    failures.push(`Α ${where}: ο αριθμός (${state.count}) διαφέρει από τη λίστα (${state.beachIds.size})`);
  }

  // Γ — ούτε ανάποδα: δεν προσφέρεται chip σε άπνοια.
  if (maxBeaufort < CALM_WATER_MIN_BEAUFORT) {
    failures.push(`Γ ${where}: προσφέρθηκε chip στα ${maxBeaufort} Μπφ`);
  }

  // Β — καμία επικίνδυνη μέσα, και καμία με κύμα πάνω από το κατώφλι.
  for (const entry of scene.entries) {
    if (!state.beachIds.has(entry.beachId)) continue;
    const r = entry.reading;
    if (r.swimVerdictAvoid) failures.push(`Β ${where}: «${entry.name}» είναι avoid_swimming και μπήκε`);
    if (r.offshoreFlatWater) failures.push(`Β ${where}: «${entry.name}» είναι απόγειος-γυαλί και μπήκε`);
    if (r.shoreSeaStateM >= CALM_WATER_MAX_SHORE_M) {
      failures.push(`Β ${where}: «${entry.name}» έχει ${r.shoreSeaStateM} μ. ≥ ${CALM_WATER_MAX_SHORE_M} και μπήκε`);
    }
    // Και η ίδια η ανά-παραλία συνάρτηση πρέπει να συμφωνεί με το σύνολο που παρήγαγε.
    if (!isCalmWaterPick(r)) failures.push(`Β ${where}: «${entry.name}» μπήκε αλλά το isCalmWaterPick το απορρίπτει`);
  }
}

sizes.sort((a, b) => a - b);
const share = offered / Math.max(1, scenes.length);
const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;

console.log('«Ήρεμο νερό» — πύλη φίλτρου');
console.log(`  σκηνές (περιοχή × μέρα): ${scenes.length}`);
console.log(`  προσφέρεται σε: ${offered} (${(share * 100).toFixed(1)}%)`);
console.log(`  παραλίες ανά chip: διάμεσος ${median}${sizes.length ? ` (${sizes[0]}–${sizes[sizes.length - 1]})` : ''}`);
console.log(`  σιωπή: λίγος αέρας ${absentBy['light-wind']} · υπάρχουν ιδανικές ${absentBy['has-ideal'] ?? 0} · καμία ${absentBy.none} · όλες ${absentBy.all}`);

const reach = evaluateReach({ total: scenes.length, offered, absentBy });
console.log(`  ΕΠΙΤΡΕΠΕΤΑΙ να μιλήσει σε: ${reach.eligible} σκηνές (${(reach.eligibleShare * 100).toFixed(1)}%) · από αυτές μιλάει στο ${(reach.offerShare * 100).toFixed(1)}%`);
failures.push(...reach.problems);

if (failures.length) {
  console.error(`\n❌ ${failures.length} αστοχίες:`);
  failures.slice(0, 25).forEach(f => console.error('   ' + f));
  if (failures.length > 25) console.error(`   …και άλλες ${failures.length - 25}`);
  process.exit(1);
}

console.log('\n✅ Α (ποτέ άδειο/άχρηστο) · Β (πύλες ασφαλείας) · Γ (σιωπή στα λίγα μποφόρ) · Δ (όχι νεκρός κώδικας)');
