#!/usr/bin/env node
/**
 * Η ΣΗΜΑΙΑ ΠΟΥ ΜΠΗΚΕ ΣΕ ΛΑΘΟΣ ΣΗΜΕΙΟ ΚΑΙ ΔΕΝ ΕΚΡΥΨΕ ΤΙΠΟΤΑ
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Το `excludeFromApp` κρύβει μια παραλία από όλο το site — κάρτα, σελίδα,
 * sitemap, προτάσεις. Ο μόνος αναγνώστης του είναι το buildBeachRegionData.mjs:1001:
 *
 *     const shouldExcludeFromApp = beach => beach.metadata?.excludeFromApp === true;
 *
 * Διαβάζει ΜΟΝΟ μέσα από το `metadata`. Σε εννιά εγγραφές η σημαία γράφτηκε στη ΡΙΖΑ της
 * εγγραφής, δίπλα στο `lat`/`lon`, οπότε δεν την είδε ποτέ κανείς και οι παραλίες
 * σερβίρονται κανονικά — ανάμεσά τους ένα διπλότυπο («Ακτή Παναγίας Φανερωμένης», ίδια
 * παραλία με την κάρτα Φανερωμένης Αντιπάρου) και μία που οι πηγές τη βάζουν σε άλλο νησί
 * («Άγιος Δημήτριος»: Μαγνησία, όχι Εύβοια).
 *
 * ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΠΙΑΣΕ ΚΑΜΙΑ ΠΥΛΗ. Καμία δεν συγκρίνει τα δύο επίπεδα, και το σφάλμα είναι
 * αόρατο: η εγγραφή φαίνεται σωστή σε όποιον τη διαβάσει, απλώς ο κώδικας κοιτάει αλλού.
 *
 * ΤΙ ΚΑΝΕΙ. Μεταφέρει τη σημαία και τον λόγο της μέσα στο `metadata`, αφήνοντας τα πάντα
 * άλλα ανέγγιχτα, και σφραγίζει το `sourceNotes` με το τι έγινε.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν αγγίζει εγγραφή χωρίς γραμμένο λόγο. Μια σημαία χωρίς αιτιολογία δεν
 * είναι απόφαση, είναι υπόλοιπο — και το να κρύψεις σελίδα χωρίς να ξέρεις γιατί είναι
 * χειρότερο από το να τη δείχνεις. Σήμερα αυτό αφορά την #230 Καναπίτσα.
 *
 * Χρήση:  node scripts/fixRootLevelExcludeFlag.mjs            (dry-run)
 *         node scripts/fixRootLevelExcludeFlag.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

// Το sourceNotes είναι άλλοτε πίνακας και άλλοτε σκέτο κείμενο· κρατάμε τον τύπο που βρήκαμε
// ώστε να μη μεγαλώσει το diff χωρίς λόγο.
const appendNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = m.sourceNotes ? `${m.sourceNotes} ${line}` : line;
};

const moved = [];
const skipped = [];

(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;

  if (node.excludeFromApp === true && node.id !== undefined && node.metadata) {
    // Ο λόγος δεν είναι πάντα σε δικό του πεδίο. Η #230 Καναπίτσα τον είχε γραμμένο μέσα στο
    // sourceNotes («…not as a distinct app-facing bathing beach at the stored coordinates.
    // Excluded from app-facing») — τεκμηριωμένη απόφαση, λάθος συρτάρι. Δεχόμαστε και αυτό,
    // αρκεί η σημείωση να λέει ρητά ότι αποκλείστηκε.
    const notes = Array.isArray(node.metadata.sourceNotes)
      ? node.metadata.sourceNotes : [node.metadata.sourceNotes].filter(Boolean);
    const fromNotes = notes.map(String).find((n) => /exclud/i.test(n)) || '';
    const reason = node.excludeReason || node.exclusionReason || fromNotes;
    // Οι περισσότερες εγγραφές με σημαία στη ρίζα την έχουν ΚΑΙ στο metadata — είναι ήδη
    // κρυμμένες και η διπλοεγγραφή δεν βλάπτει κανέναν. Δεν τις αγγίζουμε: θα φούσκωνε το
    // diff σε 31 εγγραφές χωρίς να αλλάξει τίποτα για τον επισκέπτη. Μετρημένο 25/08/2026:
    // 40 με σημαία στη ρίζα, 31 ήδη κρυμμένες, 9 όχι.
    if (node.metadata.excludeFromApp === true) {
      // τίποτα να κάνουμε
    } else if (!reason) {
      skipped.push({ id: node.id, name: node.name });
    } else {
      node.metadata.excludeFromApp = true;
      node.metadata.excludeReason = reason;
      appendNote(
        node.metadata,
        `Root-level excludeFromApp moved into metadata ${STAMP}: the flag sat next to lat/lon, `
        + `where buildBeachRegionData.mjs never reads it, so the record kept shipping. `
        + `Reason as written: "${reason}". No other field changed.`,
      );
      delete node.excludeFromApp; delete node.excludeReason; delete node.exclusionReason;
      moved.push({ id: node.id, name: node.name, reason });
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (write && moved.length) writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`fixRootLevelExcludeFlag — ${write ? 'WRITE' : 'DRY-RUN'}`);
for (const m of moved) console.log(`  →#${m.id} ${m.name} — ${m.reason}`);
for (const s of skipped) console.log(`  ·#${s.id} ${s.name}: χωρίς γραμμένο λόγο — ΔΕΝ κρύβεται`);
console.log(`${moved.length} μεταφέρθηκαν, ${skipped.length} παραλείφθηκαν${write || !moved.length ? '' : ' — ξανατρέξε με --write'}`);
