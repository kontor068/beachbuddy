#!/usr/bin/env node
/**
 * ΔΥΟ ΠΑΡΑΛΙΕΣ ΠΟΥ ΔΕΝ ΒΛΕΠΟΥΝ ΘΑΛΑΣΣΑ, ΚΑΙ ΤΟΥΣ ΔΕΙΧΝΟΥΜΕ ΚΥΜΑ
 *
 * ΤΟ ΣΑΡΩΜΑ. Στις 24/08/2026 έτρεξε για πρώτη φορά εθνικά ο γεωμετρικός έλεγχος
 * ακτογραμμής (scripts/auditPinCoastlineDistance.mjs) — είχε δει 40 από τις 2.925 πινέζες.
 * Βρήκε 14 μέσα στη στεριά. Οι 12 ήταν ήδη κρυμμένες με excludeFromApp· δύο όχι.
 *
 * #859 ΠΑΡΑΛΙΑ ΓΑΛΑΝΗΣ ΝΕΣΤΟΥ — 10.228 m από τη θάλασσα. Η πινέζα ΔΕΝ είναι λάθος: το OSM
 * έχει «Galani Beach of Nestos» στο ίδιο ακριβώς σημείο (0 m). Είναι αμμουδιά στον ποταμό
 * Νέστο. Το λάθος είναι ότι σερβίρεται σαν θαλάσσια:
 *   · marine-cell-trust: trusted=false, verdict=too-far, distanceKm=26,06, fetchKm=0
 *     — δείχνουμε κύμα από κελί 26 χλμ μακριά, με ΜΗΔΕΝ ανοιχτό νερό μπροστά της·
 *   · χωρίς orientation και χωρίς marineSamplePoint, άρα ο άνεμος κρίνεται από τη γειτονιά·
 *   · ταξιδεύει ως waterDepth «shallow» από εικασία εδάφους, με popularity tier «popular».
 * Είναι πραγματική και αγαπητή (4,8 με 529 κριτικές) — γι' αυτό ακριβώς δεν πρέπει να της
 * λέμε ψέματα για τον καιρό της.
 *
 * #3040 ΛΟΥΤΡΑΚΙ ΛΙΜΝΗ ΒΟΥΛΙΑΓΜΕΝΗΣ ΗΡΑΙΟΥ — 697 m μέσα, λιμνοθάλασσα. Χειρότερο: το
 * marine-cell-trust τη δηλώνει trusted, αλλά με pinVerdict «other-water» και fetchKm 8,65,
 * επειδή το σημείο δειγματοληψίας σπρώχτηκε 3,49 χλμ έξω από τη λίμνη στον Κορινθιακό. Της
 * δείχνουμε κύμα ανοιχτής θάλασσας ενώ είναι κλειστό νερό.
 *
 * ΓΙΑΤΙ ΑΠΟΚΡΥΨΗ ΚΑΙ ΟΧΙ ΔΙΟΡΘΩΣΗ. Δεν υπάρχει πεδίο «είδος νερού» στο σχήμα, και δεν
 * φτιάχνεται για δύο εγγραφές. Το excludeFromApp είναι η καθιερωμένη απάντηση για ακριβώς
 * αυτή την κατηγορία — 12 από τις 14 πινέζες μέσα στη στεριά είναι ήδη κρυμμένες έτσι. Αυτές
 * οι δύο απλώς ξεχάστηκαν.
 *
 * Χρήση:  node scripts/excludeNonSeaBeaches2026-08.mjs            (dry-run)
 *         node scripts/excludeNonSeaBeaches2026-08.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));

const TARGETS = {
  859: {
    reason: 'river_beach_not_open_sea_nestos',
    note: `Excluded ${STAMP} (national coastline sweep): river beach on the Nestos, 10.228 m inland `
      + 'from the coastline. The pin is CORRECT — OSM has «Galani Beach of Nestos» at the same spot — '
      + 'but the record shipped as a sea beach: marine-cell-trust reports trusted=false, verdict=too-far, '
      + 'the wave cell 26,06 km away with fetchKm 0, and no orientation or marineSamplePoint of its own. '
      + 'Hidden until the schema can describe non-sea bathing water. Coordinates, name and sources unchanged.',
  },
  3040: {
    reason: 'lagoon_not_open_sea_vouliagmeni_lake',
    note: `Excluded ${STAMP} (national coastline sweep): lagoon (Λίμνη Βουλιαγμένης Ηραίου), 697 m inland. `
      + 'Its marine sample point was pushed 3,49 km out of the lagoon into the Corinthian Gulf (fetchKm 8,65, '
      + 'pinVerdict other-water), so the card reported open-sea waves for enclosed water. Hidden until the '
      + 'schema can describe non-sea bathing water. Coordinates, name and sources unchanged.',
  },
};

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const appendNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = m.sourceNotes ? `${m.sourceNotes} ${line}` : line;
};

const applied = [];
const already = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  const spec = TARGETS[Number(node.id)];
  if (spec && node.lat !== undefined && node.metadata) {
    if (node.metadata.excludeFromApp === true) already.push({ id: node.id, name: node.name });
    else {
      node.metadata.excludeFromApp = true;
      node.metadata.excludeReason = spec.reason;
      appendNote(node.metadata, spec.note);
      applied.push({ id: node.id, name: node.name, reason: spec.reason });
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (write && applied.length) writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`excludeNonSeaBeaches — ${write ? 'WRITE' : 'DRY-RUN'}`);
for (const a of applied) console.log(`  →#${a.id} ${a.name}: ${a.reason}`);
for (const a of already) console.log(`  ·#${a.id} ${a.name}: ήταν ήδη κρυμμένη`);
console.log(`${applied.length} κρύφτηκαν${write || !applied.length ? '' : ' — ξανατρέξε με --write'}`);
