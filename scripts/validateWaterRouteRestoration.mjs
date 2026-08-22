/**
 * Η ΠΥΛΗ ΤΗΣ ΕΠΙΣΤΡΟΦΗΣ ΕΜΠΙΣΤΟΣΥΝΗΣ «ΤΟ ΝΕΡΟ ΓΥΡΙΖΕΙ ΤΟ ΑΚΡΩΤΗΡΙ» (22/08/2026).
 *
 * ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ ΘΕΛΕΙ ΦΥΛΑΚΑ. Ο έλεγχος εμπιστοσύνης έκρινε με **ευθεία γραμμή** («η
 * ακτίνα προς το κελί χτύπησε στεριά») και έκοβε 255 παραλίες. Μετρήθηκε ότι οι περισσότερες
 * έχουν το κελί τους στην **ίδια θάλασσα, ένα ακρωτήρι παραδίπλα**. Η χαλάρωση επιστρέφει τις
 * περισσότερες — και μια χαλάρωση σε πύλη ασφαλείας είναι ακριβώς το είδος αλλαγής που πρέπει να
 * φυλάγεται, γιατί κινείται προς την **επικίνδυνη** κατεύθυνση: περισσότερες παραλίες γίνονται
 * ξανά προτάσιμες.
 *
 * ΤΡΕΙΣ ΤΡΟΠΟΙ ΝΑ ΓΙΝΕΙ ΨΕΜΑ:
 *   α) να επιστρέψει παραλία που κάθεται **πίσω από πραγματικό στένωμα** — το Σχίσμα Ελούντας,
 *      που τύπωνε 0,94 μ. πάνω από λάδι, έχει το κελί του στον ΙΔΙΟ κόλπο και περνάει άνετα κάθε
 *      έλεγχο διαδρομής. Μόνο ο μάρτυρας του στομίου το κρατάει έξω.
 *   β) να επιστρέψει παραλία με **στραβό δρόμο** — γύρος ολόκληρου νησιού, όπου ο ίδιος άνεμος
 *      φτιάχνει άλλη θάλασσα.
 *   γ) να γίνει η επιστροφή **σιωπηλά**, χωρίς το κατάστιχο να λέει ποιος κανόνας την έδωσε.
 *
 * ΚΡΙΝΕΙ ΤΟ ΚΑΤΑΣΤΙΧΟ ΠΟΥ ΕΙΝΑΙ ΣΤΟ REPO, ΧΩΡΙΣ ΔΙΚΤΥΟ, με τις σταθερές που χρησιμοποιεί ο ίδιος
 * ο κανόνας — αν αλλάξει το όριο εκεί, αλλάζει και η πύλη μαζί του.
 *
 * Run: node scripts/validateWaterRouteRestoration.mjs [--prove]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_TRUSTED_DETOUR } from './lib/marineCellTrust.mjs';
import { MIN_DEPTH_RATIO } from './lib/enclosureWitness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVE = process.argv.includes('--prove');
const ledger = JSON.parse(readFileSync(path.join(root, 'reports/quality/marine-cell-trust-per-beach.json'), 'utf8'));

/**
 * ΟΝΟΜΑΣΤΙΚΟΣ ΑΝΤΙΠΑΛΟΣ. Το Σχίσμα Ελούντας είναι ο λόγος που ο δεύτερος μάρτυρας υπάρχει: η
 * webcam έδειχνε λάδι ενώ η σελίδα τύπωνε 0,94 μ., παρμένα 13,8 χλμ. έξω στο ανοιχτό Μιραμπέλλο
 * — ίδιος κόλπος, άρα τέλεια «προσβάσιμο με νερό» (στράβωμα 1,08). Μετρημένο: 724 μ. στόμιο,
 * 3,54 πλάτη βαθιά. Αν αυτό ξαναγίνει έμπιστο, ο κανόνας έχει σπάσει.
 */
const MUST_STAY_UNTRUSTED = [{ id: 767, name: 'Σχίσμα Ελούντας' }];

const failures = [];
const note = (m) => failures.push(m);

const isRestored = (r) => r.restoredBy === 'water-route';
const behindMouth = (r) => r.constricted === true
  && typeof r.depthRatio === 'number' && r.depthRatio >= MIN_DEPTH_RATIO;

/** Ο κανόνας, ξαναγραμμένος από τα ΚΑΤΑΓΕΓΡΑΜΜΕΝΑ στοιχεία της κάθε γραμμής. */
const shouldRestore = (r) => typeof r.detour === 'number'
  && r.detour <= MAX_TRUSTED_DETOUR
  && !behindMouth(r);

const restored = ledger.filter(isRestored);

// ── Α. Κάθε επιστροφή στέκει στα ίδια της τα στοιχεία ────────────────────────
for (const r of restored) {
  const who = `#${r.beachId} ${r.name ?? ''} (${r.region})`;
  if (r.trusted !== true) note(`${who}: σημειώθηκε ως επιστροφή αλλά δεν είναι έμπιστη.`);
  if (r.strictVerdict !== 'other-water') {
    note(`${who}: επιστροφή πάνω σε «${r.strictVerdict ?? '—'}» — ο κανόνας χαλαρώνει ΜΟΝΟ το «other-water».`);
  }
  if (!shouldRestore(r)) {
    note(`${who}: επιστροφή που τα ίδια της τα νούμερα δεν στηρίζουν `
      + `(στράβωμα ${r.detour ?? '—'} > ${MAX_TRUSTED_DETOUR}, ή ${r.depthRatio ?? '—'} πλάτη πίσω από στένωμα).`);
  }
}

// ── Β. Καμία σιωπηλή χαλάρωση ────────────────────────────────────────────────
const silent = ledger.filter(r => r.trusted === true && r.verdict === 'other-water' && !isRestored(r));
if (silent.length) {
  note(`${silent.length} παραλίες είναι έμπιστες με ετυμηγορία «other-water» χωρίς να λένε ποιος κανόνας τους την έδωσε: `
    + silent.slice(0, 5).map(r => `#${r.beachId}`).join(', '));
}

// ── Γ. Ο ονομαστικός αντίπαλος μένει έξω ─────────────────────────────────────
for (const adversary of MUST_STAY_UNTRUSTED) {
  const row = ledger.find(r => r.beachId === adversary.id);
  if (!row) { note(`ο αντίπαλος #${adversary.id} (${adversary.name}) λείπει από το κατάστιχο.`); continue; }
  if (row.trusted !== false) {
    note(`#${adversary.id} ${adversary.name} ΞΑΝΑΕΓΙΝΕ ΕΜΠΙΣΤΗ — αυτή είναι η παραλία για την οποία `
      + `φτιάχτηκε ο μάρτυρας του στομίου (στράβωμα ${row.detour ?? '—'}, ${row.depthRatio ?? '—'} πλάτη).`);
  }
}

// ── Δ. Ο δεύτερος μάρτυρας δεν είναι διακοσμητικός ───────────────────────────
const keptByMouth = ledger.filter(r => r.trusted === false && behindMouth(r));
if (keptByMouth.length === 0) {
  note('καμία παραλία δεν κρατιέται έξω από στένωμα — ο δεύτερος μάρτυρας δεν κρίνει τίποτα.');
}

// ── Ε. Η χαλάρωση δεν κατάπιε τα πάντα ───────────────────────────────────────
const untrusted = ledger.filter(r => r.trusted === false);
if (untrusted.length === 0) note('καμία παραλία δεν έμεινε αναξιόπιστη — η χαλάρωση κατάπιε τον έλεγχο.');

if (PROVE) {
  /**
   * Σαμποτάρουμε αντίγραφα γραμμών και απαιτούμε να τα πιάσει ο έλεγχος Α. Χωρίς αυτό, μια πύλη
   * που πάντα περνάει είναι αδύνατο να ξεχωρίσει από μια που δουλεύει.
   */
  const victim = restored[0];
  if (!victim) {
    note('--prove: δεν υπάρχει καμία επιστροφή για σαμποτάζ — ο έλεγχος Α δεν αποδείχθηκε.');
  } else {
    const sabotages = [
      { id: 'πίσω από στένωμα', row: { ...victim, constricted: true, depthRatio: MIN_DEPTH_RATIO + 1 } },
      { id: 'στραβός δρόμος', row: { ...victim, detour: MAX_TRUSTED_DETOUR + 0.5 } },
      { id: 'χωρίς διαδρομή', row: { ...victim, detour: undefined } },
    ];
    for (const s of sabotages) {
      if (shouldRestore(s.row)) note(`--prove: το σαμποτάζ «${s.id}» πέρασε — ο κανόνας δεν κρίνει τίποτα.`);
    }
    // Και το αντίστροφο: η ανέγγιχτη γραμμή ΠΡΕΠΕΙ να περνάει, αλλιώς η πύλη απορρίπτει τα πάντα.
    if (!shouldRestore(victim)) note('--prove: η ανέγγιχτη γραμμή απορρίφθηκε — η πύλη λέει όχι σε όλα.');
  }
}

if (failures.length > 0) {
  console.error('Η πύλη της επιστροφής εμπιστοσύνης ΕΠΕΣΕ:');
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`);
  if (failures.length > 25) console.error(`  … και άλλα ${failures.length - 25}`);
  process.exit(1);
}

console.log(
  `Επιστροφή εμπιστοσύνης: ${restored.length} παραλίες πήραν πίσω το κελί τους επειδή το νερό γυρίζει `
  + `το ακρωτήρι (όριο στραβώματος ${MAX_TRUSTED_DETOUR})· ${keptByMouth.length} μένουν έξω από στένωμα· `
  + `${untrusted.length} συνολικά αναξιόπιστες${PROVE ? ' + αυτοαπόδειξη' : ''} — πέρασαν.`
);
