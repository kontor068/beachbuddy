/**
 * Η ΧΕΙΡΟΓΡΑΦΗ ΠΑΡΑΓΡΑΦΟΣ ΠΡΟΣΒΑΣΗΣ ΠΕΡΙΓΡΑΦΕΙ ΤΗ ΔΙΚΗ ΤΗΣ ΠΑΡΑΛΙΑ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (βίβλος, 14/08/2026). `metadata.access.notes` είναι ελεύθερο κείμενο, γραμμένο ένα-
 * ένα ανά παραλία, και το `components/BeachCard.tsx` το τυπώνει ΑΥΤΟΛΕΞΕΙ στους Έλληνες
 * επισκέπτες (οι άλλες γλώσσες πέφτουν στην ετικέτα, οπότε δεν το είδαν ποτέ). Βρέθηκε μία φορά:
 * εννιά παραλίες μοιράζονταν την ΙΔΙΑ παράγραφο που ονόμαζε τον Σχινιά (Αττική) — οκτώ από τις
 * εννιά ήταν κρητικές. Κανένα από τα ~46 δίχτυα ποιότητας δεν το έπιασε, γιατί όλα ρωτάνε «είναι
 * αλήθεια αυτό που λέμε;» και αυτό εδώ είναι «λέμε για ΑΛΛΗ παραλία».
 *
 * ΤΙ ΕΛΕΓΧΕΙ ΑΥΤΟ. Διαβάζει το `public/greek_beaches.json` — την πηγή, όχι το χτισμένο tier —
 * γιατί εκεί γράφεται το κείμενο πρώτη φορά.
 *
 *  (1) ΑΝΤΙΓΡΑΦΟ ΣΕ ΑΛΛΗ ΠΕΡΙΟΧΗ. Η ίδια, byte-for-byte, παράγραφος σε δύο παραλίες διαφορετικής
 *      περιοχής. Οι γνωστές γενικές ετικέτες προέλευσης (OSM/Seatrac/«δεν επιβεβαιώθηκε»/η
 *      φόρμουλα εδάφους) επιτρέπονται ρητά — δεν κατονομάζουν ποτέ τόπο. Οτιδήποτε άλλο
 *      επαναλαμβάνεται πέρα από μία περιοχή είναι ύποπτο ΑΠΟ ΚΑΤΑΣΚΕΥΗ: μια αληθινή περιγραφή
 *      «πώς φτάνεις εδώ» δεν ταιριάζει ποτέ σε δύο σημεία 100+ χλμ μακριά.
 *
 * ⛔ ΤΙ ΔΟΚΙΜΑΣΤΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ (16/08/2026): «ξένο όνομα παραλίας μέσα στο κείμενο» — ταίριασμα
 * υποσυμβολοσειράς έναντι ονομάτων παραλιών εθνικά μοναδικών. Στην πράξη βγήκε θόρυβος: «χωματι»
 * ταίριαζε μέσα στο «χωμάτινο», «γέφυρα» και «καθαρά» ταίριαζαν ως ονόματα άσχετων παραλιών αλλού.
 * 502 «ευρήματα» σε μία πρώτη δοκιμή, σχεδόν όλα τυχαία. Ένα φίλτρο τόσο θορυβώδες γίνεται μόνιμη
 * ταμπέλα που κανείς δεν διαβάζει (§9-σκανδάλη-2 το ίδιο μάθημα) — χρειάζεται σωστή ανάλυση λέξεων
 * με όρια, όχι substring, και δεν αξίζει τον κίνδυνο σήμερα. Το αντίγραφο-σε-άλλη-περιοχή από πάνω
 * έπιασε το ίδιο πραγματικό λάθος (Κοκολόκο/Κεφάλα) με μηδέν θόρυβο — αυτό μένει, το άλλο όχι.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν διαβάζει νόημα — δεν ξέρει αν η πρόσβαση είναι σωστή, μόνο αν το ίδιο κείμενο
 * επαναλαμβάνεται σε παραλία αλλού. Ψευδώς αρνητικό είναι πιθανό (κείμενο που περιγράφει λάθος
 * παραλία με ΔΙΑΦΟΡΕΤΙΚΑ λόγια περνάει αόρατο) — αυτό είναι αποδεκτό όριο, γραμμένο εδώ.
 *
 * Run: node scripts/validateAccessNotesProvenance.mjs
 *      node scripts/validateAccessNotesProvenance.mjs --prove   (αυτο-απόδειξη με σαμποτάζ)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'public', 'greek_beaches.json');

const BOILERPLATE_PATTERNS = [
  /^From OpenStreetMap; access not field-verified\.?$/,
  /^From seatrac\.gr official directory; access not field-verified\.?$/,
  /^Δεν έχει επιβεβαιωθεί επιτόπου\.?$/,
  /^Geocoded from Seatrac accessible-beach seed; access not field-verified\.?$/,
  /^Road( or passable dirt-road)? access\. Added from verified .+ audit sources\.?$/,
  /^Added from OpenStreetMap as a .+ beach candidate\./,
  /^Πρόσβαση μέσω χωματόδρομου· δεν φτάνει ασφάλτινος δρόμος ως την παραλία\. Περιορισμένες παροχές\.?$/,
  // Η φόρμουλα εδάφους: μεταβλητός περιγραφέας εδάφους, ποτέ όνομα τόπου.
  /^Πρόσβαση: άσφαλτος μέχρι κοντά στην παραλία\. Έδαφος\/ακτή: /,
];

const readSource = () => JSON.parse(readFileSync(sourcePath, 'utf8'));

/** Μαζεύει κάθε {regionPath, id, name, notes} περπατώντας το βαθιά ένθετο JSON. */
const collectBeaches = (root) => {
  const out = [];
  const walk = (node, regionPath) => {
    if (Array.isArray(node)) {
      for (const beach of node) {
        if (beach && typeof beach === 'object' && typeof beach.name === 'string') {
          const notes = beach?.metadata?.access?.notes;
          out.push({
            regionPath,
            id: beach.id,
            name: beach.name,
            notes: typeof notes === 'string' ? notes.trim() : undefined,
          });
        }
      }
      return;
    }
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) walk(node[key], regionPath ? `${regionPath}/${key}` : key);
    }
  };
  walk(root, '');
  return out;
};

const isBoilerplate = (text) => BOILERPLATE_PATTERNS.some((re) => re.test(text));

const runChecks = (beaches) => {
  const violations = [];

  // (1) Ίδιο κείμενο, διαφορετική περιοχή.
  const byText = new Map();
  for (const b of beaches) {
    if (!b.notes || isBoilerplate(b.notes)) continue;
    if (!byText.has(b.notes)) byText.set(b.notes, []);
    byText.get(b.notes).push(b);
  }
  for (const [text, records] of byText) {
    const regions = new Set(records.map((r) => r.regionPath));
    if (regions.size > 1) {
      violations.push({
        kind: 'cross-region-duplicate',
        text,
        records: records.map((r) => `${r.name} (${r.regionPath}, id=${r.id})`),
      });
    }
  }

  return violations;
};

const args = process.argv.slice(2);
const PROVE = args.includes('--prove');

const source = readSource();
const beaches = collectBeaches(source);
const withNotes = beaches.filter((b) => b.notes);
console.log(`quality:access-notes-provenance — ${beaches.length} παραλίες, ${withNotes.length} με χειρόγραφο κείμενο πρόσβασης.`);

const violations = runChecks(beaches);

if (violations.length) {
  console.log(`\n❌ ${violations.length} ΠΡΟΒΛΗΜΑΤΙΚΕΣ ΠΑΡΑΓΡΑΦΟΙ:\n`);
  for (const v of violations.slice(0, 20)) {
    console.log(`  [αντίγραφο σε άλλη περιοχή] "${v.text.slice(0, 90)}${v.text.length > 90 ? '…' : ''}"`);
    console.log(`    -> ${v.records.join(' | ')}\n`);
  }
  if (violations.length > 20) console.log(`  … και ${violations.length - 20} ακόμα.`);
  if (!PROVE) process.exit(1);
}

if (PROVE) {
  // Αυτο-απόδειξη: σαμποτάρουμε δύο παραλίες διαφορετικής περιοχής με το ίδιο κείμενο και
  // βεβαιωνόμαστε ότι ο έλεγχος το πιάνει· μετά ελέγχουμε ότι το πραγματικό dataset περνάει
  // (ή αποτυγχάνει ρητά αν βρέθηκαν αληθινές παραβιάσεις παραπάνω).
  const fake = [
    { regionPath: 'A', id: 1, name: 'Παραλία Πρόβα Άλφα', notes: 'Πρόσβαση με βατό μονοπάτι μέσα από τα Ξωμέρια.' },
    { regionPath: 'B', id: 2, name: 'Παραλία Πρόβα Βήτα', notes: 'Πρόσβαση με βατό μονοπάτι μέσα από τα Ξωμέρια.' },
  ];
  const fakeViolations = runChecks(fake);
  if (fakeViolations.length === 0) {
    console.log('\n❌ ΑΥΤΟ-ΑΠΟΔΕΙΞΗ ΑΠΕΤΥΧΕ: σαμποτάζ αντιγράφου σε άλλη περιοχή δεν πιάστηκε.');
    process.exit(1);
  }
  console.log(`\n✅ Αυτο-απόδειξη πέρασε: το σαμποτάζ πιάστηκε (${fakeViolations.length} εύρημα).`);
  if (violations.length) {
    console.log(`❌ Αλλά το πραγματικό dataset έχει ${violations.length} πραγματικές παραβιάσεις παραπάνω.`);
    process.exit(1);
  }
}

console.log('\n✅ Καμία παράγραφος πρόσβασης δεν περιγράφει άλλη παραλία.');
