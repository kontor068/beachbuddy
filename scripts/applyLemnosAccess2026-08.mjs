// Λήμνος 16/08/2026 — πρόσβαση, ονόματα, ρομποτικό κείμενο (report-only by default).
//
// Η Λήμνος ήρθε στον επανέλεγχο με **πρόσβαση 68%**: 13 από τις 40 παραλίες είχαν
// `access.type: 'unknown'`, δηλαδή δεν λέγαμε στον επισκέπτη ΤΙΠΟΤΑ για το πώς πάει. Αυτό δεν
// είναι μόνο κενό πληροφορίας — το `hasPracticalTopPickAccess` (utils/access.ts) κόβει ρητά τις
// `unknown` από τις συστάσεις, οπότε 13 παραλίες ήταν αόρατες στα «πού να πάω σήμερα».
//
// ΚΑΝΟΝΑΣ ΕΦΑΡΜΟΓΗΣ (ίδιος με Κάρπαθο 16/08): αλλάζουμε τύπο πρόσβασης ΜΟΝΟ με **δύο
// ανεξάρτητες ενδείξεις** — (α) το οδικό δίκτυο της OSM γύρω από την πινέζα (μετρημένο με
// `auditAccessRoadProximity --types unknown --radius 500`) και (β) επώνυμο ανθρώπινο οδηγό που
// περιγράφει τη διαδρομή. Όπου λείπει το (β), η παραλία **μένει `unknown`** — η απουσία δρόμου
// στην OSM είναι ένδειξη, όχι απόδειξη (μάθημα Πάρου: 7 αληθινές ταβέρνες που η OSM δεν είχε).
//
// Καμία κλήση Google Places. Αντιστρέψιμο: dry-run by default, `--apply` για εγγραφή.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const APPLY = process.argv.includes('--apply');
const STAMP = '2026-08-16';

// --- 1. Πρόσβαση: unknown → τεκμηριωμένος τύπος -------------------------------------------
// `osm` = ό,τι μέτρησε το auditAccessRoadProximity σε ακτίνα 500 m (απόσταση ως το κέντρο του
// δρόμου, όχι ως το κοντινότερο σημείο του — γι' αυτό τα νούμερα είναι συντηρητικά μεγάλα).
const ACCESS = [
  {
    id: 1456, name: 'Νεφτίνα',
    type: 'passable_dirt_road',
    label: 'Χωματόδρομος σε καλή κατάσταση',
    notes: 'Χωματόδρομος σε καλή κατάσταση αμέσως μετά τον Άγιο Αλέξανδρο· περνάει και με απλό αυτοκίνητο. Καμία οργάνωση στην παραλία.',
    osm: 'χωρίς άσφαλτο σε 500 m, χωματόδρομος στα 119 m',
    sources: ['https://limnosguide.com.gr/en/alternative-beaches/neftina', 'https://lovefortravel.gr/limnos-oraioteres-paralies/'],
  },
  {
    id: 1444, name: 'Τρυγή',
    type: 'passable_dirt_road',
    label: 'Χωματόδρομος από το Προπούλι',
    notes: 'Χωματόδρομος από το Προπούλι. Ακτή κυρίως βραχώδης με ένα μικρό αμμώδες τμήμα· μόνο ένα δημοτικό κιόσκι, τίποτε άλλο.',
    osm: 'άσφαλτος στα 642 m, χωματόδρομος στα 244 m',
    sources: ['https://limnosguide.com.gr/en/alternative-beaches/tryges'],
  },
  {
    id: 1462, name: 'Στίβι ή Πλαγίσος Μώλος',
    type: 'passable_dirt_road',
    label: 'Μικρός χωματόδρομος από το Πλατύ',
    notes: 'Μικρός χωματόδρομος από την περιοχή του Πλατέος. Ομπρέλες του Δήμου, χωρίς άλλη οργάνωση.',
    osm: 'δρόμος οικισμού στα 189 m, μονοπάτι στα 129 m',
    sources: ['https://limnosguide.com.gr/en/alternative-beaches/stvi', 'https://www.greeka.com/eastern-aegean/lemnos/beaches/'],
  },
  {
    id: 1441, name: 'Παρθενόμυθος',
    type: 'passable_dirt_road',
    label: 'Χωματόδρομος — με απλό αυτοκίνητο μόνο από τα Καμίνια',
    notes: 'Μόνο χωματόδρομος. Από τα Καμίνια (μέσω Αγίας Σοφίας) περνάει απλό αυτοκίνητο με υπομονή· από τον Μούδρο ο δρόμος θέλει 4x4. Καμία παροχή — νερό, φαγητό και ομπρέλα μαζί σου.',
    osm: 'χωρίς άσφαλτο σε 500 m, χωματόδρομος στα 293 m',
    sources: ['https://limnosguide.com.gr/en/alternative-beaches/parthenomytos', 'https://greece.terrabook.com/el/lemnos/page/parthenomutos/'],
  },
  {
    id: 1443, name: 'Σκίδι',
    type: 'passable_dirt_road',
    label: 'Χωματόδρομος από το Χαβούλι ή την Αγία Σοφία',
    notes: 'Χωματόδρομος· καλύτερος από την Αγία Σοφία, πιο κακοτράχαλος από το Χαβούλι. Απέραντη αμμουδιά χωρίς καμία οργάνωση.',
    osm: 'χωρίς άσφαλτο σε 500 m, χωματόδρομος στα 390 m',
    sources: ['https://lovefortravel.gr/limnos-oraioteres-paralies/', 'http://me-limnia-matia.blogspot.com/p/blog-page_30.html'],
  },
  {
    id: 1469, name: 'Φαρακλού',
    type: 'passable_dirt_road',
    label: 'Χωματόδρομος· και με τα πόδια από την Τρυγή',
    notes: 'Χωματόδρομος ως την ακτή· εναλλακτικά περίπου 800 μ. με τα πόδια από την Τρυγή. Ηφαιστειακοί βράχοι, καμία παροχή.',
    osm: 'χωρίς άσφαλτο σε 500 m, χωματόδρομος στα 88 m, μονοπάτι στα 69 m',
    // Ο οδηγός περιγράφει το Φαρακλού μέσα από τη σελίδα της Τρυγής (800 μ. με τα πόδια από εκεί),
    // και η Τρυγή φτάνεται με χωματόδρομο από το Προπούλι — γι' αυτό οι δύο πηγές είναι η ίδια
    // σελίδα οδηγού ΣΥΝ η OSM, όχι δύο οδηγοί.
    sources: ['https://limnosguide.com.gr/en/alternative-beaches/tryges'],
  },
  {
    id: 1451, name: 'Κατάλακκο',
    type: 'passable_dirt_road',
    label: 'Χωματόδρομος έξω από τη Δάφνη',
    notes: 'Χωματόδρομος που ξεκινάει έξω από το χωριό της Δάφνης. Μικρή, ανοργάνωτη και ήσυχη ακτή.',
    osm: 'άσφαλτος στα 230 m, χωματόδρομος στα 215 m',
    sources: ['http://oraialimnos.blogspot.com/2014/02/blog-post_452.html', 'http://me-limnia-matia.blogspot.com/p/blog-page_30.html'],
  },
];

// --- 2. Ονόματα που λέει ο ντόπιος οδηγός αλλιώς ------------------------------------------
// ΔΕΝ μετονομάζουμε: το slug βγαίνει από το `name` και μια μετονομασία μετακινεί σελίδα. Μπαίνουν
// ως aliases, ώστε η αναζήτηση να τα βρίσκει με το όνομα που ξέρει ο κόσμος.
const ALIASES = [
  { id: 1451, add: ['Παπιά', 'Παραλία Παπιάς'], why: 'Οι ντόπιοι οδηγοί (oraialimnos 39,98966/25,17013 — 75 m από την πινέζα μας, me-limnia-matia, Greeka «Papias») ονομάζουν αυτή την παραλία Παπιά· «Κατάλακκο» είναι το χωριό.' },
  { id: 1459, add: ['Μπουρνιάς', 'Μπουρνιά'], why: 'Ο όρμος του Κότσινα λέγεται Μπουρνιάς — έτσι τον γράφει το mylemnos.gr και ο limnosguide.' },
];

// --- 3. Ρομποτικό κείμενο: ίδια πρόταση, αλλαγμένο μόνο το όνομα --------------------------
// «Ακτή κοντά στον οικισμό Χ, με πρόσβαση από δρόμο. Κυρίως ελεύθερη, …» σε 3 από τις 40.
// Κάθε κομμάτι το λέει ήδη η ταμπέλα πρόσβασης και η λίστα παροχών από κάτω, και καμία δεν
// κρύβει ένδειξη χωματόδρομου (utils/access.ts `hasDirtRoadAccess` διαβάζει αυτό το κείμενο).
const CLEAR_NOTES = [1442, 1450, 1463];

// --- 4. Παροχές: η ανάποδη κατεύθυνση (υπο-δήλωση, όχι υπερβολή) --------------------------
// Το `auditAmenitiesOsm` έβγαλε **0 flags στις 40** — καμία υπερβολική δήλωση. Η δεύτερη
// ανάγνωση των ίδιων στηλών (claimsFood / nearestFoodM) βρήκε ένα κενό προς την άλλη μεριά.
// Μπαίνει ΜΟΝΟ η φράση φαγητού από το λεξιλόγιο του utils/beachCopy.ts — ποτέ `organized`,
// ποτέ beach bar (ίδιος κανόνας με scripts/applyFoodNearby2026-08.mjs).
const FOOD_NEARBY = [
  {
    id: 1445, name: 'Ζεματάς', phrase: 'καφέ κοντά',
    why: 'Δύο καφέ στην OSM γύρω από την πινέζα — ένα ονοματισμένο («Sunrise») στα 101 m και ένα ανώνυμο στα 80 m — ενώ η καρτέλα δεν ανέφερε τίποτα φαγώσιμο. Γράφεται «καφέ κοντά», όχι «ταβέρνες»: το OSM type είναι cafe.',
  },
];

// ------------------------------------------------------------------------------------------
const data = JSON.parse(readFileSync(sourcePath, 'utf8'));
const lemnos = data['North Aegean']?.Lemnos?.Lemnos;
if (!Array.isArray(lemnos)) { console.error('Lemnos list not found'); process.exit(1); }
const byId = new Map(lemnos.map(b => [b.id, b]));

const appendNote = (beach, line) => {
  const prev = beach.metadata.sourceNotes;
  const arr = Array.isArray(prev) ? prev.slice() : (prev ? [prev] : []);
  arr.push(line);
  beach.metadata.sourceNotes = arr.length === 1 ? arr[0] : arr;
};
const addUrls = (beach, urls) => {
  const set = new Set(beach.metadata.sourceUrls || []);
  for (const u of urls) set.add(u);
  beach.metadata.sourceUrls = [...set];
};

let changed = 0;
console.log('=== 1. ΠΡΟΣΒΑΣΗ: unknown → τεκμηριωμένος τύπος ===');
for (const row of ACCESS) {
  const b = byId.get(row.id);
  if (!b) { console.log(`  #${row.id} ΔΕΝ ΒΡΕΘΗΚΕ`); continue; }
  const before = b.metadata.access?.type;
  if (before !== 'unknown') { console.log(`  #${row.id} ${row.name}: ΠΑΡΑΛΕΙΠΕΤΑΙ (είναι ήδη ${before})`); continue; }
  console.log(`  #${row.id} ${row.name}: ${before} → ${row.type}\n      «${row.notes}»\n      OSM: ${row.osm}`);
  if (APPLY) {
    b.metadata.access = { type: row.type, label: row.label, notes: row.notes };
    addUrls(b, row.sources);
    appendNote(b, `Lemnos access pass ${STAMP} (no-API): access.type unknown → ${row.type}. Two independent signals — OSM road network around the pin (${row.osm}, auditAccessRoadProximity --types unknown --radius 500) and named local guides (${row.sources.join(', ')}). Coordinates, windProfile, scoring, amenities and live sea claims were not changed.`);
  }
  changed++;
}

console.log('\n=== 2. ΟΝΟΜΑΤΑ ΠΟΥ ΛΕΕΙ Ο ΝΤΟΠΙΟΣ ΑΛΛΙΩΣ (aliases, καμία μετονομασία) ===');
for (const row of ALIASES) {
  const b = byId.get(row.id);
  if (!b) continue;
  const current = new Set(b.metadata.aliases || b.aliases || []);
  const missing = row.add.filter(a => !current.has(a));
  if (!missing.length) { console.log(`  #${row.id} ${b.name}: ήδη έχει ${row.add.join(', ')}`); continue; }
  console.log(`  #${row.id} ${b.name}: + ${missing.join(', ')}\n      ${row.why}`);
  if (APPLY) {
    b.metadata.aliases = [...current, ...missing];
    appendNote(b, `Lemnos naming pass ${STAMP} (no-API): aliases += ${missing.join(', ')}. ${row.why} Το όνομα εμφάνισης και το slug ΔΕΝ άλλαξαν.`);
  }
  changed++;
}

console.log('\n=== 3. ΡΟΜΠΟΤΙΚΟ ΚΕΙΜΕΝΟ ΠΡΟΣΒΑΣΗΣ (ίδια πρόταση, άλλο όνομα) ===');
for (const id of CLEAR_NOTES) {
  const b = byId.get(id);
  if (!b) continue;
  const notes = b.metadata.access?.notes || '';
  if (!notes) { console.log(`  #${id} ${b.name}: ήδη κενό`); continue; }
  console.log(`  #${id} ${b.name}: σβήνεται «${notes}»`);
  if (APPLY) {
    b.metadata.access.notes = '';
    appendNote(b, `Lemnos robot-copy sweep ${STAMP}: access.notes cleared. Removed text: "${notes}" — ήταν το ίδιο πρότυπο με αλλαγμένο μόνο το όνομα οικισμού σε 3 παραλίες της Λήμνου, και κάθε κομμάτι του το έλεγε ήδη η ταμπέλα πρόσβασης ή η λίστα παροχών. Δεν περιείχε ένδειξη χωματόδρομου (utils/access.ts hasDirtRoadAccess).`);
  }
  changed++;
}

console.log('\n=== 4. ΠΑΡΟΧΕΣ ΠΟΥ ΔΕΝ ΔΗΛΩΝΑΜΕ (υπο-δήλωση) ===');
for (const row of FOOD_NEARBY) {
  const b = byId.get(row.id);
  if (!b) continue;
  const list = b.metadata.amenities || [];
  if (list.includes(row.phrase)) { console.log(`  #${row.id} ${row.name}: ήδη λέει «${row.phrase}»`); continue; }
  console.log(`  #${row.id} ${row.name}: + «${row.phrase}»\n      ${row.why}`);
  if (APPLY) {
    b.metadata.amenities = [...list, row.phrase];
    appendNote(b, `Lemnos amenity under-claim pass ${STAMP} (no-API): amenities += "${row.phrase}". ${row.why} Το organized, τα scoring και οι ζωντανές δηλώσεις θάλασσας ΔΕΝ άλλαξαν.`);
  }
  changed++;
}

console.log(`\n${changed} αλλαγές ${APPLY ? 'ΓΡΑΦΤΗΚΑΝ' : 'σε dry-run (πρόσθεσε --apply)'}`);
if (APPLY) {
  writeFileSync(sourcePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`→ ${path.relative(rootDir, sourcePath)}`);
}
