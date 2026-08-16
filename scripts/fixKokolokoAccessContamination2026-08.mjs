// Removes an access.notes/access.label paragraph that describes a DIFFERENT beach, 16/08/2026 —
// no API, dry-run by default. Found by the new `quality:access-notes-provenance` gate on its
// first run: Παραλία Κοκολόκο (Attica, id=49) carries the label «χωματόδρομος προς την περιοχή
// Κεφάλας» and notes naming «την παραλία Κεφάλα κοντά στο Μαρμάρι» — Κεφάλα (id=232) and Μαρμάρι
// are both in South Evia, not Attica. The record's own sourceNotes independently identify this
// beach as "Kokoloko near Daskalio" (East Attica) — the access text is the only contaminated part.
//
// The fix keeps the one fact this record's own access.type already asserts (passable_dirt_road)
// and replaces both fields with the plain sentence/label already used by 81 other passable-dirt-
// road beaches nationally, matching scripts/fixContaminatedAccessNotes2026-08.mjs's rule: replace
// with what the record's own verified fields already say, invent nothing new.
//
//   node scripts/fixKokolokoAccessContamination2026-08.mjs           # dry run
//   node scripts/fixKokolokoAccessContamination2026-08.mjs --write   # persist, then npm run build:beach-data
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');

const CONTAMINATED_NOTES = 'Το OSM επιβεβαιώνει την παραλία Κεφάλα κοντά στο Μαρμάρι και πεζοπορική/τοπική πηγή περιγράφει βατό χωματόδρομο από Μεγάλη Άμμο προς άκρα Κεφάλα. Η τελική κατάβαση/στάθμευση στην ακτή παραμένει προς τοπική επιβεβαίωση.';
const CONTAMINATED_LABEL = 'χωματόδρομος προς την περιοχή Κεφάλας';
const NEW_NOTES = 'Πρόσβαση μέσω χωματόδρομου· δεν φτάνει ασφάλτινος δρόμος ως την παραλία. Περιορισμένες παροχές.';
const NEW_LABEL = 'Βατός χωματόδρομος';

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

let found = null;
const walk = (node, regionPath) => {
  if (found) return;
  if (Array.isArray(node)) {
    for (const beach of node) {
      if (beach?.id === 49 && beach?.name === 'Παραλία Κοκολόκο') { found = { beach, regionPath }; return; }
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) walk(node[key], regionPath ? `${regionPath}/${key}` : key);
  }
};
walk(source, '');

if (!found) throw new Error('Παραλία Κοκολόκο (id=49) δεν βρέθηκε — το dataset άλλαξε, ξαναδές το χειρωνακτικά.');

const { beach, regionPath } = found;
const access = beach.metadata?.access;
if (!access) throw new Error('Το metadata.access έλειπε — αναμενόταν να υπάρχει.');

if (access.notes !== CONTAMINATED_NOTES || access.label !== CONTAMINATED_LABEL) {
  console.log('Το κείμενο δεν ταιριάζει πια με το αναμενόμενο — μάλλον διορθώθηκε ήδη. Δεν πειράζω τίποτα.');
  console.log('  notes:', access.notes);
  console.log('  label:', access.label);
  process.exit(0);
}

console.log(`Βρέθηκε στο ${regionPath}. type=${access.type}`);
console.log('ΠΑΛΙΟ notes:', access.notes);
console.log('ΝΕΟ   notes:', NEW_NOTES);
console.log('ΠΑΛΙΟ label:', access.label);
console.log('ΝΕΟ   label:', NEW_LABEL);

if (write) {
  access.notes = NEW_NOTES;
  access.label = NEW_LABEL;
  writeFileSync(sourcePath, JSON.stringify(source, null, 1) + '\n', 'utf8');
  console.log('\n✅ Γράφτηκε. Τρέξε: npm run build:beach-data');
} else {
  console.log('\n(dry run — ξανατρέξε με --write για να γραφτεί)');
}
