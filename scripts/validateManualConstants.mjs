#!/usr/bin/env node
/**
 * ΤΟ ΕΓΧΕΙΡΙΔΙΟ ΤΗΣ ΒΙΒΛΟΥ ΛΕΕΙ ΤΟΥΣ ΑΡΙΘΜΟΥΣ ΠΟΥ ΟΝΤΩΣ ΤΡΕΧΟΥΝ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το κεφάλαιο «ΤΟ ΕΓΧΕΙΡΙΔΙΟ» του `docs/team/PORISMA-KAIROS-2026-08.md` υπόσχεται
 * ρητά: «Αν αλλάξει ο κώδικας, αλλάζει ΑΥΤΟ το κεφάλαιο την ίδια μέρα.» Η υπόσχεση έσπασε δύο
 * φορές:
 *   • 20/08/2026 — η ΚΕΦΑΛΙΔΑ είχε μείνει πίσω από τις 17/08 (σημειωμένο μέσα στη βίβλο).
 *   • 24/08 → 10/09/2026 — το ΕΓΧΕΙΡΙΔΙΟ έμεινε πίσω 17 ημέρες σε ΠΕΝΤΕ σημεία, όλα βαριά:
 *     περιέγραφε δάπεδο ριπής που δεν έτρεχε πια στη στεριά (§Γ69), έλεγε «ΜΟΝΟ η διεύθυνση
 *     έρχεται από το νερό» ενώ από 25/08 ερχόταν και η ΤΑΧΥΤΗΤΑ σε 1.833 παραλίες, έλεγε σταθερό
 *     ×0,5 έκπτωση ακτής ενώ είχε γίνει γωνία K_d(θ) (§Γ71), περιέγραφε ζωντανό τον φράχτη ζώνης
 *     που είχε γκρεμιστεί (§Γ70), και μετρούσε 67 πύλες ενώ ήταν 87.
 *
 * Το ημερολόγιο (§Γ1 και μετά) τα είχε ΟΛΑ σωστά, με σημειώσεις ανατροπής στα ανεστραμμένα §§.
 * Μόνο το κεφάλαιο-περίληψη ξέμεινε — και αυτό είναι το ΜΟΝΟ που διαβάζει όποιος πιάνει δουλείά.
 * Ένα ξεπερασμένο εγχειρίδιο είναι χειρότερο από κανένα: κάποιος θα «διορθώσει» πίσω κάτι που
 * μετρήθηκε. Η υπόσχεση δεν κρατιέται με πρόθεση — κρατιέται με πύλη.
 *
 * ΤΙ ΕΛΕΓΧΕΙ:
 *   Α. ΟΙ ΑΡΙΘΜΟΙ. Κάθε σταθερά που κουβαλάει χρώμα, ετυμηγορία ή τυπωμένο νούμερο διαβάζεται
 *      από τον ΠΗΓΑΙΟ κώδικα και πρέπει να εμφανίζεται αυτούσια στο κείμενο του εγχειριδίου
 *      (ελληνικό κόμμα: 2,392 · 0,75 · 14,8). Αλλάζεις σταθερά → πέφτει η πύλη → ενημερώνεις
 *      το κείμενο στην ΙΔΙΑ συνεδρία, όπως λέει ο κανόνας.
 *   Β. ΤΑ ΠΛΗΘΗ. Πύλες, παραλίες με κελί νερού, σημεία δεύτερου θαλάσσιου μοντέλου, ids
 *      κλειστού νερού — μετρημένα από τα ίδια τα αρχεία, όχι γραμμένα με το χέρι.
 *   Γ. ΟΙ ΝΕΚΡΕΣ ΦΡΑΣΕΙΣ. Διατυπώσεις που ΗΤΑΝ σωστές και έγιναν ψευδείς απαγορεύονται ρητά
 *      (π.χ. «ΜΟΝΟ η διεύθυνση»). Πιάνει την περίπτωση που κάποιος επαναφέρει παλιό κείμενο.
 *   Δ. Η ΑΛΥΣΙΔΑ ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ. Και τα οκτώ στάδια υπάρχουν, με τη σειρά τους.
 *   Ε. ΑΥΤΟΣΑΜΠΟΤΑΖ. Ξαναπερνάει το Α πάνω σε κείμενο με μία σταθερά αλλοιωμένη και ΑΠΑΙΤΕΙ να
 *      πέσει. Χωρίς αυτό, η πύλη θα περνούσε ακόμα κι αν το ταίριασμα ήταν σπασμένο.
 *
 * ΔΕΝ ελέγχει αν οι αριθμοί είναι ΣΩΣΤΟΙ — αυτό το λένε μόνο οι μετρήσεις (reports/weather,
 * reports/quality). Ελέγχει ότι το κείμενο δεν λέει άλλα από τον κώδικα.
 *
 * ⚠️ ΤΟ `docs/team/` ΕΙΝΑΙ GITIGNORED (δημόσιο repo). Στο CI η βίβλος ΔΕΝ υπάρχει — η πύλη τότε
 * περνάει με μήνυμα παράλειψης αντί να σπάσει το build. Τρέχει πραγματικά στο μηχάνημα που έχει
 * το ιδιωτικό clone, δηλαδή εκεί όπου γίνονται και οι αλλαγές του μοντέλου.
 *
 *   node scripts/validateManualConstants.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIBLE = path.join(root, 'docs', 'team', 'PORISMA-KAIROS-2026-08.md');

if (!fs.existsSync(BIBLE)) {
  console.log('⏭️  ΠΑΡΑΛΕΙΨΗ: το docs/team/PORISMA-KAIROS-2026-08.md δεν υπάρχει σε αυτό το');
  console.log('   μηχάνημα (gitignored — δημόσιο repo). Η πύλη τρέχει όπου υπάρχει το ιδιωτικό');
  console.log('   clone. Δες docs/DEV-ENVIRONMENT.md.');
  process.exit(0);
}

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Το κείμενο ΜΟΝΟ του εγχειριδίου: από την επικεφαλίδα του ως την επόμενη «# » επικεφαλίδα. */
const bible = fs.readFileSync(BIBLE, 'utf8');
const startIdx = bible.indexOf('# 📖 ΤΟ ΕΓΧΕΙΡΙΔΙΟ');
if (startIdx < 0) {
  console.error('FAILED: δεν βρέθηκε η επικεφαλίδα «# 📖 ΤΟ ΕΓΧΕΙΡΙΔΙΟ» στη βίβλο.');
  console.error('Αν μετονομάστηκε, ενημέρωσε ΚΑΙ αυτή την πύλη — μη σβήσεις τον έλεγχο.');
  process.exit(1);
}
const rest = bible.slice(startIdx + 10);
const endRel = rest.search(/\n# [^\n]/);
const MANUAL = rest.slice(0, endRel < 0 ? rest.length : endRel);

const failures = [];
const fail = (part, msg) => failures.push(`[${part}] ${msg}`);

/* ─────────────────────────── Α. ΟΙ ΑΡΙΘΜΟΙ ΤΟΥ ΚΩΔΙΚΑ ─────────────────────────── */

/** Διαβάζει `export const NAME = <αριθμός>` από πηγαίο αρχείο. Χωρίς φόρτωση της εφαρμογής. */
const constOf = (rel, name) => {
  const src = read(rel);
  const m = src.match(new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!m) throw new Error(`δεν βρέθηκε η σταθερά ${name} στο ${rel}`);
  return Number(m[1]);
};

/** Ο ίδιος αριθμός όπως γράφεται στα ελληνικά: 2.392 → «2,392», 0.5 → «0,5». */
const gr = (n) => String(n).replace('.', ',');

/**
 * ⚠️ Ο ΚΑΝΟΝΑΣ ΤΩΝ ΑΓΚΙΣΤΡΩΝ: κάθε αριθμός ζητιέται ΜΕ ΤΑ ΣΥΜΦΡΑΖΟΜΕΝΑ ΤΟΥ, ποτέ γυμνός.
 * Το «0,1» σκέτο ταιριάζει σε δεκάδες σημεία ενός κειμένου 280 γραμμών — και τότε ο έλεγχος
 * περνάει ό,τι κι αν λέει ο κώδικας. Το βρήκε το τεστ ΣΤ από κάτω, την ώρα που γραφόταν αυτή η
 * πύλη: αλλάζοντας το δάπεδο του K_d από 0,1 σε 0,15 η πύλη ΔΕΝ έπεσε, επειδή το «0,15» υπήρχε
 * ήδη αλλού στο ίδιο κεφάλαιο (η ιστορία της Αρίλλας). Μια πύλη που δεν πέφτει είναι διακόσμηση.
 */
const PINS = [
  // [ετικέτα, τιμή κώδικα, από πού, πώς πρέπει να φαίνεται στο κείμενο ΜΕ συμφραζόμενα]
  ['αποσυμπίεση: τομή', constOf('utils/windGustFloor.ts', 'WIND_DECOMP_INTERCEPT_KMH'), 'utils/windGustFloor.ts', (v) => `max(μέσος, ${gr(v)} +`],
  ['αποσυμπίεση: κλίση', constOf('utils/windGustFloor.ts', 'WIND_DECOMP_SLOPE'), 'utils/windGustFloor.ts', (v) => `${gr(v)} × μέσος)`],
  ['δάπεδος ριπής (θάλασσα)', constOf('utils/windGustFloor.ts', 'GUST_FLOOR_FACTOR'), 'utils/windGustFloor.ts', (v) => `${gr(v.toFixed(2))} × ριπή`],
  ['λόγος ασυνέπειας ριπής', constOf('utils/windGustFloor.ts', 'INCOHERENT_GUST_RATIO'), 'utils/windGustFloor.ts', (v) => `ριπή/μέσος ≥ **${gr(v)}**`],
  ['πύλη έντασης για τη διεύθυνση από το νερό', constOf('utils/overWaterWind.ts', 'OVER_WATER_MIN_BEAUFORT'), 'utils/overWaterWind.ts', (v) => `από **${v} Μποφόρ** και πάνω, κρινόμενη`],
  ['K_d: μισό άνοιγμα διαδρόμου', constOf('utils/seaArrival.ts', 'SHADOW_CORRIDOR_HALF_DEG'), 'utils/seaArrival.ts', (v) => `±${gr(v)}° από τομέα`],
  ['K_d: μήκος απόσβεσης', constOf('utils/seaArrival.ts', 'SHADOW_DECAY_DEG'), 'utils/seaArrival.ts', (v) => `e^(−θ/${gr(v)}°)`],
  ['K_d: τιμή στην άκρη', constOf('utils/seaArrival.ts', 'SHADOW_KD_AT_EDGE'), 'utils/seaArrival.ts', (v) => `**${gr(v)}** στην **άκρη**`],
  ['K_d: δάπεδο', constOf('utils/seaArrival.ts', 'SHADOW_KD_FLOOR'), 'utils/seaArrival.ts', (v) => `δάπεδο ${gr(v)}**`],
  ['K_d: «ανοιχτός διάδρομος»', constOf('utils/seaArrival.ts', 'SHADOW_OPEN_FETCH_KM'), 'utils/seaArrival.ts', (v) => `fetch ≥${v} χλμ`],
  ['πόρτα των 3 Μποφόρ', constOf('utils/suitabilityTone.ts', 'THREE_BEAUFORT_NO_BUILDABLE_CHOP_MAX_KMH'), 'utils/suitabilityTone.ts', (v) => `${gr(v)} χλμ/ώ`],
  ['δάπεδο «Ιδανική»', constOf('utils/suitabilityTone.ts', 'IDEAL_MAX_SHORE_SEA_STATE_M'), 'utils/suitabilityTone.ts', (v) => `θάλασσα ακτής\n**<${gr(v.toFixed(2))} μ.**`],
  ['ασήμαντη διαφορά θάλασσας στο βάθρο', constOf('services/topPickRanking.ts', 'PODIUM_SEA_MEANINGFUL_DIFFERENCE_M'), 'services/topPickRanking.ts', (v) => `**<${gr(v)} μ. δεν μετράνε**`],
  ['περίοδος αναφοράς κύματος', constOf('utils/waveCharacter.ts', 'SEA_REFERENCE_PERIOD_S'), 'utils/waveCharacter.ts', (v) => `(${v}δλ / T)`],
  ['δάπεδο τυπωμένου αριθμού ακτής', constOf('utils/shoreWave.ts', 'SHORE_DISPLAY_FLOOR_M'), 'utils/shoreWave.ts', (v) => `Δάπεδο ${gr(v.toFixed(2))} μ.`],
  // Οι πόρτες «απόγειος-γυαλί» — προστέθηκαν 10/09/2026, όταν ο έλεγχος του ημερολογίου βρήκε ότι
  // το εγχειρίδιο έγραφε ακόμα «ένταση <15, onshore ≤ −0,8» για την πόρτα των 5, ενώ από 24/08
  // (0d80c6e3) είναι ένταση <25, χωρίς γωνία, με βέτο αποθαλασσιάς. Ξέφυγε και από το πρώτο πέρασμα.
  ['πόρτες απόγειου: ένταση', constOf('utils/offshoreFlatWater.ts', 'OFFSHORE_FLAT_MAX_INTENSITY'), 'utils/offshoreFlatWater.ts', (v) => `**ένταση <${v}** (η ίδια με την πόρτα των 4)`],
  ['πόρτες απόγειου: βέτο αποθαλασσιάς', constOf('utils/swellExposure.ts', 'SWELL_MIN_HEIGHT_M'), 'utils/swellExposure.ts', (v) => `θάλασσα ≥${gr(v)} μ. στο σημείο δειγματοληψίας`],
  ['πόρτα των 4: ήσυχη ακτή', constOf('utils/offshoreFlatWater.ts', 'GLASS_AT_FOUR_MAX_SEA_STATE_M'), 'utils/offshoreFlatWater.ts', (v) => `θάλασσα ακτής <${gr(v.toFixed(2))} μ., **ΚΑΙ** καμία αποθαλασσιά`],
];

// Σταθερές που δεν είναι `export const` — διαβάζονται από το σώμα του αρχείου.
const bodyNumber = (rel, name) => {
  const m = read(rel).match(new RegExp(`const ${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!m) throw new Error(`δεν βρέθηκε η σταθερά ${name} στο ${rel}`);
  return Number(m[1]);
};
PINS.push(
  ['εκθέτης απότομου κύματος', bodyNumber('utils/waveCharacter.ts', 'CHOP_EXPONENT'), 'utils/waveCharacter.ts', (v) => `^${gr(v)}, 1,`],
  ['ταβάνι απότομου κύματος', bodyNumber('utils/waveCharacter.ts', 'MAX_CHOP_FACTOR'), 'utils/waveCharacter.ts', (v) => `1, ${gr(v)})`],
);

/**
 * Το κείμενο τυλίγεται στους ~100 χαρακτήρες και το αρχείο έχει άλλοτε \n και άλλοτε \r\n, οπότε
 * ένα άγκιστρο μπορεί να κόβεται στη μέση από αλλαγή γραμμής. Ισοπεδώνουμε ΚΑΘΕ ακολουθία κενών
 * σε ένα διάστημα — και στο κείμενο και στο άγκιστρο — ώστε ο έλεγχος να κρίνει το ΠΕΡΙΕΧΟΜΕΝΟ
 * και όχι το πού έτυχε να πέσει η αλλαγή γραμμής.
 */
const flat = (s) => s.replace(/\s+/g, ' ');

const checkPins = (text) => checkPinsFlat(flat(text));

/** Ο ίδιος έλεγχος πάνω σε ΗΔΗ ισοπεδωμένο κείμενο — το χρειάζεται το σαμποτάζ του Ε. */
const checkPinsFlat = (haystack) => {
  const missing = [];
  for (const [label, value, where, render] of PINS) {
    const needle = render(value);
    if (!haystack.includes(flat(needle))) missing.push({ label, needle, where, value });
  }
  return missing;
};

let beforeA = failures.length;
for (const m of checkPins(MANUAL)) {
  fail('Α', `«${m.needle}» (${m.label}, ${m.where}) δεν υπάρχει στο κείμενο του εγχειριδίου`);
}
console.log(`Α. οι ${PINS.length} σταθερές του κώδικα είναι γραμμένες .... ${failures.length > beforeA ? '❌' : '✅'}`);

/* ─────────────────────────── Β. ΤΑ ΠΛΗΘΗ ─────────────────────────── */

const beforeB = failures.length;

const gateIds = new Set(
  (read('scripts/runCriticalQualityChecks.mjs').match(/id: '[a-z0-9-]+'/g) || [])
    .map((s) => s.slice(5, -1))
);
const gateCount = gateIds.size;
if (!MANUAL.includes(`**${gateCount} έλεγχοι**`)) {
  fail('Β', `οι πύλες είναι ${gateCount}, το εγχειρίδιο δεν το λέει (ψάξε «**${gateCount} έλεγχοι**»)`);
}
// Κάθε πύλη που ονομάζει το εγχειρίδιο πρέπει να υπάρχει στ' αλήθεια.
for (const named of MANUAL.match(/`[a-z][a-z0-9-]{4,}`/g) || []) {
  const id = named.slice(1, -1);
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(id) && !id.includes('.') && gateIds.has(id) === false) {
    // μόνο ό,τι μοιάζει με id πύλης ΚΑΙ αναφέρεται στην ενότητα των πυλών
    const gatesSection = MANUAL.slice(MANUAL.indexOf('ΟΙ ΠΥΛΕΣ ΠΟΥ ΤΟ ΚΡΑΤΑΝΕ ΟΡΘΙΟ'));
    if (gatesSection.includes(`\`${id}\``)) {
      fail('Β', `το εγχειρίδιο ονομάζει πύλη «${id}» που ΔΕΝ υπάρχει στο runCriticalQualityChecks.mjs`);
    }
  }
}

const seaCells = JSON.parse(read('data/forecast-sea-cells.generated.json'));
if (!MANUAL.includes(`**${seaCells.beachCount.toLocaleString('el-GR')} παραλίες**`)) {
  fail('Β', `οι παραλίες με κελί νερού είναι ${seaCells.beachCount.toLocaleString('el-GR')}, το εγχειρίδιο λέει αλλιώς`);
}
if (!MANUAL.includes(`≥${seaCells.gateKm} χλμ`)) {
  fail('Β', `η πύλη απόστασης του κελιού νερού είναι ${seaCells.gateKm} χλμ`);
}

const enclosedIds = (read('utils/geometricWaveCeiling.ts')
  .match(/VERIFIED_ENCLOSED_WATER_IDS[\s\S]*?\]\)/)?.[0]
  .match(/^\s*\d+,/gm) || []).length;
if (!MANUAL.includes(`μόνο για ${enclosedIds} παραλίες`)) {
  fail('Β', `το ταβάνι γεωμετρίας ισχύει για ${enclosedIds} παραλίες — το εγχειρίδιο πρέπει να το λέει ρητά`);
}

const forcedTailPoints = (read('utils/marineModelPreference.generated.ts')
  .match(/: 'meteofrance_wave'/g) || []).length;
if (!MANUAL.includes(`**${forcedTailPoints} σημεία`)) {
  fail('Β', `τα σημεία που προτιμούν το δεύτερο θαλάσσιο μοντέλο είναι ${forcedTailPoints}`);
}
console.log(`Β. τα πλήθη (πύλες ${gateCount}, κελιά ${seaCells.beachCount}, ids ${enclosedIds}, σημεία ${forcedTailPoints}) ... ${failures.length > beforeB ? '❌' : '✅'}`);

/* ─────────────────────────── Γ. ΟΙ ΝΕΚΡΕΣ ΦΡΑΣΕΙΣ ─────────────────────────── */

const beforeC = failures.length;
// Οι φράσεις είναι ΑΥΤΟΥΣΙΕΣ από το παλιό κείμενο, ώστε μια προειδοποίηση που τις ΠΑΡΑΘΕΤΕΙ
// («αυτό ήταν ψευδές») να μην πυροδοτεί την πύλη.
const DEAD_PHRASES = [
  ['**Διεύθυνση — και ΜΟΝΟ η διεύθυνση — μπορεί να έρθει από το νερό.**', 'από 25/08/2026 έρχεται ΚΑΙ η ταχύτητα από το κελί νερού (§Γ69 τέλος)'],
  ['Ταχύτητα, ριπή και Μποφόρ ΔΕΝ αγγίζονται', 'η ταχύτητα αντικαθίσταται· μόνο η ΡΙΠΗ μένει στεριανή'],
  ['Άρα `ταχύτητα = max(μέσος, 0,50 × ριπή)`', 'στα χερσαία κελιά τρέχει η γραμμική αποσυμπίεση (§Γ69)'],
  ['η έκπτωση ×0,5 της «προστατευμένης»\n**κερδίζεται', 'η απόσβεση ΑΚΤΗΣ είναι πια γωνία K_d(θ) (§Γ71) — το ×0,5 μένει μόνο ως εφεδρεία'],
  ['το νούμερο **ανεβαίνει** ως τη γραμμή', 'ο φράχτης της γραμμής ηρεμίας γκρεμίστηκε 24/08 (§Γ70)'],
  ['**67 έλεγχοι**', 'οι πύλες μεγαλώνουν συνέχεια — ο αριθμός μετριέται, δεν γράφεται από μνήμη'],
  ['`fetchKm≤0,5`, ένταση <15, `onshore ≤ −0,8`.', 'η πόρτα των 5 δεν κοιτάει γωνία από 24/08 (0d80c6e3) — ένταση <25 και βέτο αποθαλασσιάς'],
];
for (const [phrase, why] of DEAD_PHRASES) {
  if (flat(MANUAL).includes(flat(phrase))) fail('Γ', `νεκρή διατύπωση στο εγχειρίδιο: «${phrase}» — ${why}`);
}
console.log(`Γ. καμία νεκρή διατύπωση δεν επέστρεψε ......... ${failures.length > beforeC ? '❌' : '✅'}`);

/* ─────────────────────────── Δ. Η ΑΛΥΣΙΔΑ ─────────────────────────── */

const beforeD = failures.length;
const STAGES = [
  'ΣΤΑΔΙΟ 1 · ΑΠΟ ΠΟΥ ΕΡΧΟΝΤΑΙ ΤΑ ΝΟΥΜΕΡΑ',
  'ΣΤΑΔΙΟ 2 · Ο ΑΝΕΜΟΣ ΤΗΣ ΠΑΡΑΛΙΑΣ',
  'ΣΤΑΔΙΟ 3 · Η ΓΕΩΜΕΤΡΙΑ ΤΗΣ ΠΑΡΑΛΙΑΣ',
  'ΣΤΑΔΙΟ 4 · ΤΟ ΚΥΜΑ',
  'ΣΤΑΔΙΟ 5 · ΤΟ ΧΡΩΜΑ',
  'ΣΤΑΔΙΟ 6 · Η ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ',
  'ΣΤΑΔΙΟ 7 · ΤΙ ΤΥΠΩΝΕΤΑΙ',
  'ΣΤΑΔΙΟ 8 · ΤΙ ΠΡΟΤΕΙΝΟΥΜΕ',
];
let cursor = -1;
for (const stage of STAGES) {
  const at = MANUAL.indexOf(stage);
  if (at < 0) fail('Δ', `λείπει ολόκληρο το «${stage}» από το εγχειρίδιο`);
  else if (at < cursor) fail('Δ', `το «${stage}» είναι εκτός σειράς — η αλυσίδα διαβάζεται με τη σειρά`);
  else cursor = at;
}
if (!MANUAL.includes('κάθε διόρθωση είναι μονόδρομος')) {
  fail('Δ', 'χάθηκε ο κανόνας που διατρέχει και τα οκτώ στάδια («κάθε διόρθωση είναι μονόδρομος»)');
}
console.log(`Δ. τα 8 στάδια υπάρχουν με τη σειρά τους ....... ${failures.length > beforeD ? '❌' : '✅'}`);

/* ─────────────────────────── Ε. ΑΥΤΟΣΑΜΠΟΤΑΖ ─────────────────────────── */

const beforeE = failures.length;
// Σβήνει από ΑΝΤΙΓΡΑΦΟ του κειμένου κάθε σταθερά, μία-μία, και απαιτεί να πέσει ο έλεγχος Α.
// Ένα πέρασμα δεν αρκεί: αν μια σταθερά τύχαινε να ταιριάζει και αλλού στο κείμενο, ο έλεγχός
// της θα ήταν ψεύτικος και μόνο η δική της δοκιμή θα το έδειχνε.
const MANUAL_FLAT = flat(MANUAL);
for (const [label, value, , render] of PINS) {
  const needle = flat(render(value));
  const sabotaged = MANUAL_FLAT.split(needle).join('«ΣΑΜΠΟΤΑΖ»');
  if (!checkPinsFlat(sabotaged).some((m) => m.label === label)) {
    fail('Ε', `σβήνοντας το «${needle}» (${label}) η πύλη ΔΕΝ έπεσε — ο έλεγχος αυτής της σταθεράς είναι διακοσμητικός`);
  }
}
console.log(`Ε. το αυτοσαμποτάζ πιάνεται σε ${PINS.length}/${PINS.length} σταθερές ....... ${failures.length > beforeE ? '❌' : '✅'}`);

/* ───────────────── ΣΤ. ΤΟ ΑΓΚΙΣΤΡΟ ΔΕΝ ΕΙΝΑΙ ΑΜΦΙΣΗΜΟ ───────────────── */

// Το Ε αποδεικνύει ότι ο έλεγχος πέφτει όταν σβήσει το κείμενο. ΔΕΝ αποδεικνύει ότι πέφτει όταν
// αλλάξει ο ΚΩΔΙΚΑΣ — κι αυτή είναι η δουλειά της πύλης. Αν το άγκιστρο είναι γυμνός αριθμός που
// τυχαίνει να υπάρχει αλλού, μια αλλαγμένη σταθερά θα «βρεθεί» στο κείμενο και η πύλη θα περάσει
// ψευδώς. Εδώ προσποιούμαστε ότι κάθε σταθερά άλλαξε, με τρεις διαφορετικούς τρόπους, και
// απαιτούμε το νέο άγκιστρο να ΜΗΝ υπάρχει πουθενά στο κεφάλαιο.
const beforeSt = failures.length;
for (const [label, value, , render] of PINS) {
  const perturbations = [value * 1.5, value + 0.05, Number((value * 0.5).toFixed(4))];
  // Ακέραιος (Μποφόρ, χιλιόμετρα, δευτερόλεπτα): η ρεαλιστική αλλαγή είναι ±1, όχι ×1,5. Χωρίς
  // αυτό η δοκιμή προσπερνάει ακριβώς τις σταθερές που αλλάζουν πιο εύκολα — και το «4 Μποφόρ»
  // υπήρχε ήδη αλλού στο κείμενο, οπότε το άγκιστρο ήταν αμφίσημο και δεν το έπιανε κανείς.
  if (Number.isInteger(value)) perturbations.push(value + 1, value - 1);
  for (const perturbed of perturbations) {
    if (perturbed === value) continue;
    const ghost = render(perturbed);
    if (MANUAL_FLAT.includes(flat(ghost))) {
      fail('ΣΤ', `το άγκιστρο της «${label}» είναι ΑΜΦΙΣΗΜΟ: αν η σταθερά γινόταν ${gr(perturbed)}, το «${ghost}» θα βρισκόταν ήδη στο κείμενο και η πύλη θα περνούσε ψευδώς — δώσε του περισσότερα συμφραζόμενα`);
      break;
    }
  }
}
console.log(`ΣΤ. κανένα άγκιστρο δεν είναι αμφίσημο .......... ${failures.length > beforeSt ? '❌' : '✅'}`);

/* ─────────────────────────── ΑΠΟΤΕΛΕΣΜΑ ─────────────────────────── */

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα(τα) — το εγχειρίδιο της βίβλου δεν λέει ό,τι κάνει ο κώδικας.`);
  for (const f of failures.slice(0, 30)) console.error(`  - ${f}`);
  console.error('\nΕΠΟΜΕΝΟ ΒΗΜΑ: ΜΗΝ χαλαρώσεις την πύλη και ΜΗΝ σβήσεις τον αριθμό από τη λίστα.');
  console.error('Άλλαξες σταθερά του μοντέλου → ενημέρωσε το κεφάλαιο «ΤΟ ΕΓΧΕΙΡΙΔΙΟ» στην ΙΔΙΑ');
  console.error('συνεδρία (ο κανόνας το λέει ρητά στην πρώτη του παράγραφο), και γράψε ΚΑΙ την');
  console.error('εξαίρεση στην κεφαλίδα της βίβλου αν αλλάζει συμπεριφορά μετά το κλείδωμα.');
  console.error('Το ημερολόγιο (§Γ…) ΔΕΝ ξαναγράφεται — προσθέτεις νέα ενότητα με μέτρηση.');
  process.exit(1);
}
console.log(`\nPASSED: ${PINS.length} σταθερές + 4 πλήθη + ${DEAD_PHRASES.length} νεκρές φράσεις + 8 στάδια — το εγχειρίδιο συμφωνεί με τον κώδικα.`);
