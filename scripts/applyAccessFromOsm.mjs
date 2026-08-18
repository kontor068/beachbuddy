#!/usr/bin/env node
/**
 * Εφαρμόζει τα ευρήματα του scripts/auditUnknownAccessFromOsm.mjs στο public/greek_beaches.json.
 *
 * ΔΥΟ ΠΥΛΕΣ ΠΟΥ ΔΕΝ ΠΑΡΑΚΑΜΠΤΟΝΤΑΙ:
 *
 * 1. ΑΓΓΙΖΕΙ ΜΟΝΟ 'unknown'. Αν κάποιος έχει γράψει «βατός χωματόδρομος» με πηγή, ένα OSM tag
 *    δεν τον ανατρέπει. Ο έλεγχος που κρίνει υπάρχουσες δηλώσεις είναι άλλος
 *    (auditAccessRoadProximity.mjs) και οι διορθώσεις του είναι ανθρώπινη απόφαση.
 *
 * 2. ΤΟ ΣΗΜΕΙΩΜΑ ΛΕΕΙ ΑΠΟ ΠΟΥ ΤΟ ΞΕΡΟΥΜΕ. Το `access.notes` τυπώνεται ΑΥΤΟΥΣΙΟ στην ελληνική
 *    κάρτα (components/BeachCard.tsx), οπότε δεν μπαίνει τεχνική ορολογία ούτε επανάληψη της
 *    ταμπέλας — αυτό ακριβώς άδειασε 100+ σημειώματα τον Αύγουστο (δες
 *    scripts/fixAccessNoteEcho2026-08.mjs). Μπαίνει μία πρόταση που ΠΡΟΣΘΕΤΕΙ κάτι: πόσο μακριά
 *    είναι ο δρόμος. Η προέλευση (OSM way id) πάει στα `sourceNotes`, που είναι εσωτερικά.
 *
 * Χρήση:  node scripts/applyAccessFromOsm.mjs --in <report.json>            (dry run)
 *         node scripts/applyAccessFromOsm.mjs --in <report.json> --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const IN = arg('--in');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));
if (!IN) { console.error('usage: --in <report.json> [--write] [--stamp YYYY-MM-DD]'); process.exit(1); }

// Η ΑΣΦΑΛΤΟΣ ΔΕΝ ΜΠΑΙΝΕΙ ΑΠΟ ΤΟΝ OSM ΜΟΝΟ ΤΟΥ — ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ 18/08/2026.
//
// Η καταγεγραμμένη απόφαση της 16/08 («άγνωστη πρόσβαση μένει άγνωστη· η OSM είναι ένδειξη,
// όχι απόδειξη· ισχύει εθνικά για τις 483 unknown») ζητάει ΔΥΟ ανεξάρτητες πηγές. Ο αγωγός
// της 17/08 την παρέκαμψε σιωπηλά και εφάρμοσε 29 παραλίες από μία πηγή· τα 13 `asphalt_road`
// επαναφέρθηκαν στις 18/08.
//
// ΓΙΑΤΙ Η ΓΡΑΜΜΗ ΜΠΑΙΝΕΙ ΑΚΡΙΒΩΣ ΕΔΩ — ΤΟ ΡΙΣΚΟ ΕΙΝΑΙ ΑΣΥΜΜΕΤΡΟ:
//   · `asphalt_road`   → «Εύκολη πρόσβαση» στην κάρτα (utils/localization.ts) και «περπάτα»
//     στον σχεδιασμό διαδρομής. Είναι ΥΠΟΣΧΕΣΗ: κάποιος βάζει χαμηλό αυτοκίνητο και πάει.
//     Λάθος εδώ = κολλημένο αμάξι σε χωματόδρομο.
//   · `*_dirt_road`    → «Βατός/δύσβατος χωματόδρομος». Είναι ΠΡΟΕΙΔΟΠΟΙΗΣΗ. Λάθος εδώ
//     σημαίνει ότι κάποιος πήγε πιο προσεκτικά απ' όσο χρειαζόταν — ανώδυνο.
//
// Άρα ο χωματόδρομος περνάει με μία πηγή, η άσφαλτος όχι. Για να μπει άσφαλτος χρειάζεται
// δεύτερη ανεξάρτητη ένδειξη (επώνυμος οδηγός, δήμος, επιτόπου έλεγχος) — χειροκίνητα.
// Οι υποψήφιες ΔΕΝ χάνονται: γράφονται κανονικά στην αναφορά για ανθρώπινο μάτι.
const APPLICABLE = new Set(['passable_dirt_road', 'difficult_dirt_road']);
const REQUIRES_SECOND_SOURCE = new Set(['asphalt_road']);

/**
 * ΤΟ ΣΗΜΕΙΩΜΑ ΜΕΝΕΙ ΚΕΝΟ — ΚΑΙ ΑΥΤΟ ΤΟ ΕΜΑΘΑ ΑΠΟ ΤΗΝ ΙΔΙΑ ΜΟΥ ΤΗΝ ΠΥΛΗ (17/08/2026).
 *
 * Η πρώτη εκδοχή έγραφε μια πρόταση ανά τύπο δρόμου («Ο χωματόδρομος φτάνει μέχρι την
 * παραλία.»). Το `quality:access-notes-provenance` το απέρριψε αμέσως: η ίδια ακριβώς φράση
 * βρέθηκε σε 6 παραλίες τεσσάρων διαφορετικών περιοχών — Κύθηρα, Σκύρος, Σκόπελος, Πήλιο.
 * Δηλαδή ακριβώς η robot copy που άδειασε 100+ σημειώματα τον Αύγουστο, ξαναγραμμένη από μένα.
 *
 * Το `access.notes` τυπώνεται ΑΥΤΟΥΣΙΟ στην κάρτα δίπλα στην ταμπέλα. Η ταμπέλα λέει ήδη
 * «Βατός χωματόδρομος»· μια πρόταση που λέει το ίδιο με άλλα λόγια δεν προσθέτει τίποτα και
 * κοστίζει την εμπιστοσύνη που δίνει ένα κείμενο γραμμένο από άνθρωπο. Ο πίνακας ποιότητας
 * συμφωνεί: η πύλη πρόσβασης ΔΕΝ ζητάει `notes` — το ζητούσε παλιά και μετρούσε λάθος πράγμα.
 *
 * Η μέτρηση (ποιος δρόμος, πόσο μακριά, ποιο OSM way) πάει στα `sourceNotes`, που είναι
 * εσωτερικά και δεν τα διαβάζει επισκέπτης.
 */
const noteFor = () => '';

const report = JSON.parse(readFileSync(path.isAbsolute(IN) ? IN : path.join(rootDir, IN), 'utf8'));
const byId = new Map();
const heldForSecondSource = [];
for (const row of report.results || []) {
  if (APPLICABLE.has(row.verdict)) byId.set(Number(row.id), row);
  else if (REQUIRES_SECOND_SOURCE.has(row.verdict)) heldForSecondSource.push(row);
}
// Σιωπηλή παράλειψη = η υποψήφια χάνεται. Τυπώνεται ρητά ώστε να φαίνεται τι περιμένει άνθρωπο.
if (heldForSecondSource.length) {
  console.log(`\n⏸  ${heldForSecondSource.length} υποψήφιες ΑΣΦΑΛΤΟΣ δεν εφαρμόζονται — θέλουν δεύτερη πηγή (απόφαση 16/08 + 18/08):`);
  for (const r of heldForSecondSource) console.log(`     #${r.id} ${r.name} — ${r.evidence || r.label}`);
  console.log('');
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const applied = [];
const skipped = [];

const appendSourceNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = [m.sourceNotes, line].filter(Boolean).join(' ');
};

(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  const row = byId.get(Number(node.id));
  if (row && node.metadata) {
    const current = node.metadata.access || {};
    if (current.type && current.type !== 'unknown') {
      skipped.push({ id: row.id, name: node.name, reason: `έχει ήδη «${current.type}» — δεν το ανατρέπουμε` });
    } else {
      node.metadata.access = {
        ...current,
        type: row.verdict,
        label: row.label,
        notes: noteFor(row.verdict, row.distM),
      };
      appendSourceNote(
        node.metadata,
        `Access from OSM road network ${STAMP}: ${row.evidence}. Previously 'unknown'. No other field changed.`
      );
      applied.push({ id: row.id, name: node.name, verdict: row.verdict, distM: row.distM });
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (write && applied.length) writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');

console.log(`applyAccessFromOsm — ${write ? 'WRITE' : 'DRY-RUN'}`);
const counts = {};
for (const a of applied) counts[a.verdict] = (counts[a.verdict] || 0) + 1;
for (const a of applied) console.log(`  →#${a.id} ${a.name}: ${a.verdict} (${a.distM} m)`);
for (const s of skipped) console.log(`  ·#${s.id} ${s.name}: ${s.reason}`);
console.log(`${applied.length} εφαρμόστηκαν ${JSON.stringify(counts)}, ${skipped.length} παραλείφθηκαν${write || !applied.length ? '' : ' — ξανατρέξε με --write'}`);
