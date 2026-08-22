#!/usr/bin/env node
/**
 * ΚΑΝΕΝΑ ΝΕΟ ΣΗΜΕΙΟ ΔΕΝ ΔΙΑΛΕΓΕΙ ΣΙΩΠΗΛΑ ΠΟΙΟ ΝΕΡΟ ΘΑ ΡΩΤΗΣΕΙ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΦΥΛΑΕΙ. Το `services/recommendationService.ts` κρατάει δύο διαφορετικά νερά:
 * τη ΘΑΛΑΣΣΑ ΤΗΣ ΠΕΡΙΟΧΗΣ (`effectiveWaveHeightM`, από κελί διάμεσα 10 χλμ ανοιχτά) και το ΝΕΡΟ
 * ΣΤΗΝ ΠΑΡΑΛΙΑ (`seaAtShoreM`). Επί μήνες κανένας κανόνας δεν έλεγε ποια ερώτηση παίρνει ποιο,
 * οπότε κάθε νέο σημείο διάλεγε ό,τι τύχαινε να είναι σε εμβέλεια. Διάλεξε λάθος τέσσερις φορές:
 *
 *   05/08 Σχινιάς · 10/08 Ωρωπός · 13/08 Καβαλικευτά · 22/08 Ελαφονήσι (τρία σημεία σε μία μέρα)
 *
 * Κάθε φορά η διόρθωση γράφτηκε στη βίβλο σαν ΠΕΡΙΣΤΑΤΙΚΟ. Η βίβλος όμως είναι ημερολόγιο
 * τραυμάτων, όχι συνταγή: δεν εμποδίζει το επόμενο σημείο. Αυτή η πύλη το εμποδίζει.
 *
 * ΠΩΣ ΔΟΥΛΕΥΕΙ. Κρατάει ΠΑΓΩΜΕΝΟ τον κατάλογο των γραμμών κώδικα που διαβάζουν το ανοιχτό νερό,
 * με μία δικαιολογία η καθεμία. Αν εμφανιστεί καινούργια, η πύλη σκάει και ζητάει να δηλωθεί —
 * δηλαδή αναγκάζει τον επόμενο να απαντήσει ΡΗΤΑ: «αυτή η ερώτηση αφορά τη θάλασσα ή την
 * παραλία;». Αν εξαφανιστεί κάποια, σκάει επίσης, ώστε ο κατάλογος να μη σαπίζει.
 *
 *   node scripts/validateWaterQuestionRouting.mjs
 *   node scripts/validateWaterQuestionRouting.mjs --list    # τυπώνει τον τρέχοντα κατάλογο
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = 'services/recommendationService.ts';

/**
 * Ο ΠΑΓΩΜΕΝΟΣ ΚΑΤΑΛΟΓΟΣ. Κάθε γραμμή κώδικα που διαβάζει `effectiveWaveHeightM`, με το ΓΙΑΤΙ
 * επιτρέπεται. Όλες ρωτάνε «τι κάνει η θάλασσα στην περιοχή» — καμία δεν ρωτάει «τι θα βρει ο
 * κόσμος σε αυτή την παραλία», γιατί αυτές πέρασαν στο `seaAtShoreM` στις 22/08/2026.
 */
const ALLOWED = [
  ['effectiveWaveHeightM: number;', 1, 'δήλωση τύπου'],
  ['const { effectiveWaveHeightM } = resolveDisplayWaveHeightM({', 1, 'ο ίδιος ο ορισμός (γρήγορη διαδρομή)'],
  ['const { effectiveWaveHeightM, modeledWaveHeightM, realisticMeasuredWaveHeightM, geometricCeilingApplied } = resolveDisplayWaveHeightM({', 1, 'ο ίδιος ο ορισμός'],
  ['effectiveWaveHeightM,', 3, 'περάσματα σε συναρτήσεις που δαμπάρουν ΜΟΝΕΣ τους ή κρίνουν το ανοιχτό: assessment object, getEffectiveBeaufortForComfort, swimmingComfortFromScore (ο κλάδος ΑΝΟΙΧΤΟΥ — ο κλάδος ακτής παίρνει shoreWaveM δίπλα του)'],
  ['assessment.effectiveWaveHeightM,', 1, 'ίδιο πέρασμα, από το assessment'],
  ['const waveRaisedByWind = measuredWaveHeightM !== undefined && effectiveWaveHeightM > measuredWaveHeightM + 0.05;', 1, 'σύγκριση δικού μας μοντέλου με το πλέγμα — και τα δύο είναι ανοιχτής θάλασσας'],
  ['openWaterWaveHeightM: effectiveWaveHeightM,', 1, 'η ΕΙΣΟΔΟΣ του μοντέλου ακτής· εξ ορισμού το ανοιχτό'],
  ['const dampedShoreWaveM = shoreSeaStateM(effectiveWaveHeightM, finalExposureLevel, seaArrivalExposureLevel,', 1, 'δαμπάρει το ανοιχτό ΠΡΟΣ την ακτή· η είσοδος πρέπει να είναι το ανοιχτό'],
  [': effectiveWaveHeightM;', 3, 'τα τρία fallback: seaAtShoreM, seaForCautionM, displayWaveHeightM — όταν δεν υπάρχει αριθμός ακτής'],
  [': effectiveWaveHeightM > (realisticMeasuredWaveHeightM ?? 0) + 0.005', 1, 'seaStateSource: λέει ΑΠΟ ΠΟΥ ήρθε το ανοιχτό νούμερο'],
  ['effectiveWaveHeightM', 1, 'τελευταίο όρισμα του getEffectiveBeaufortForComfort (ο κλάδος ανοιχτού· ο κλάδος ακτής το ξαναβγάζει από το shoreWaveM)'],
  ['if (beachShoreBreaks(beach, seaArrivalExposureLevel, effectiveWaveHeightM, seaStatePeriodS)) {', 1, 'το shoreBreak κρίνει ΜΟΝΟ του την άφιξη (σωπαίνει σε protected/undefined) — δεν χρειάζεται δαμπαρισμένο ύψος'],
  ['measuredWaveHeightM !== undefined ? effectiveWaveHeightM : modeledWaveHeightM', 1, 'η ποινή ανοιχτού νερού στον βαθμό — ΕΠΙΣΤΡΕΦΕΤΑΙ αυτούσια στον κλάδο ακτής της ετυμηγορίας'],
  ['? Math.min(coveDisplayM, effectiveWaveHeightM)', 1, 'το καπάκι του όρμου: ποτέ πάνω από το ανοιχτό'],
  [': windAssessment.enclosedCove && windIsOffshoreForCove && !swell.hasSwell && coveDisplayCandidateM < effectiveWaveHeightM', 1, 'ίδιο καπάκι, ο άλλος κλάδος'],
  ['seaStateM: seaStateSeverityM(effectiveWaveHeightM, seaStatePeriodS),', 1, 'το χρώμα της πινέζας — το resolveConditionTone εφαρμόζει ΜΟΝΟ του το shoreSeaStateM παρακάτω (utils/suitabilityTone.capToneBySeaState)'],
  ['seaStateSeverityM(effectiveWaveHeightM, seaStatePeriodS),', 1, 'το τσιπ της κάρτας — ίδιος λόγος με το χρώμα'],
  ['seaStateWaveM: effectiveWaveHeightM,', 1, 'επιστρέφεται ΩΣ ανοιχτό, με το όνομά του'],
];

/** Οι γραμμές κώδικα (χωρίς σχόλια) που αναφέρουν το σύμβολο. */
const codeLinesMentioning = (source, symbol) => {
  const out = [];
  let inBlockComment = false;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    const wasInBlock = inBlockComment;
    if (line.startsWith('/*')) inBlockComment = true;
    if (inBlockComment && line.includes('*/')) inBlockComment = false;
    if (wasInBlock || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) continue;
    if (line.includes(symbol)) out.push(line);
  }
  return out;
};

const source = fs.readFileSync(path.join(root, FILE), 'utf8');
const found = codeLinesMentioning(source, 'effectiveWaveHeightM');

if (process.argv.includes('--list')) {
  const counts = new Map();
  for (const l of found) counts.set(l, (counts.get(l) || 0) + 1);
  for (const [l, n] of counts) console.log(`  [${JSON.stringify(l)}, ${n}, ''],`);
  process.exit(0);
}

const failures = [];
const actual = new Map();
for (const l of found) actual.set(l, (actual.get(l) || 0) + 1);
const expected = new Map(ALLOWED.map(([line, n]) => [line, n]));

for (const [line, n] of actual) {
  if (!expected.has(line)) {
    failures.push(`ΝΕΟ σημείο διαβάζει την ανοιχτή θάλασσα και δεν είναι δηλωμένο:\n      ${line}`);
  } else if (expected.get(line) !== n) {
    failures.push(`Το σημείο «${line}» εμφανίζεται ${n} φορές, δηλωμένες ${expected.get(line)}`);
  }
}
for (const [line, n] of expected) {
  if (!actual.has(line)) failures.push(`Δηλωμένο σημείο ΕΞΑΦΑΝΙΣΤΗΚΕ (σβήσε το από τον κατάλογο): ${line}`);
  else if (actual.get(line) !== n) { /* ήδη αναφέρθηκε */ }
}

// ── Οι δύο ονομασμένοι αριθμοί υπάρχουν και έχουν το σωστό σχήμα ────────────────────────────
const hasShore = /const seaAtShoreM = typeof shoreWaveM === 'number' && Number\.isFinite\(shoreWaveM\)\s*\n\s*\? shoreWaveM\s*\n\s*: effectiveWaveHeightM;/.test(source);
if (!hasShore) failures.push('Λείπει ή άλλαξε ο ορισμός του `seaAtShoreM` (νερό στην παραλία, με fallback στο ανοιχτό)');

const hasCaution = /const seaForCautionM = shoreWaveFromDepartingSea && shoreWaveM === shoreModelWaveM\s*\n\s*\? seaAtShoreM\s*\n\s*: effectiveWaveHeightM;/.test(source);
if (!hasCaution) {
  failures.push('Λείπει ή άλλαξε ο ορισμός του `seaForCautionM` — η προειδοποίηση φουρτούνας ΔΕΝ επιτρέπεται '
    + 'να σωπαίνει με αβαθμονόμητο αριθμό· μόνο με μετρημένη απόδειξη ότι το νερό φεύγει');
}

// Η προειδοποίηση φουρτούνας διαβάζει ΜΟΝΟ τον αυστηρό αριθμό.
const roughBlock = (source.match(/type: 'rough_sea',[\s\S]{0,220}?\}\);/g) || []);
if (!roughBlock.length) failures.push('Δεν βρέθηκε καμία προειδοποίηση rough_sea — άλλαξε το σχήμα;');
for (const block of roughBlock) {
  if (/seaAtShoreM/.test(block) && !/seaForCautionM/.test(block)) {
    failures.push('Η προειδοποίηση rough_sea διαβάζει το `seaAtShoreM` αντί για το `seaForCautionM`');
  }
}

// Το μπλοκ της ακτής πρέπει να είναι ΠΑΝΩ από την πρώτη ερώτηση που το χρειάζεται.
const shoreAt = source.indexOf('const seaAtShoreM =');
const firstUse = source.indexOf('} else if (seaForCautionM >= 1.2) {');
if (shoreAt < 0 || firstUse < 0 || shoreAt > firstUse) {
  failures.push('Ο αριθμός της ακτής υπολογίζεται ΜΕΤΑ από ερώτηση που τον χρειάζεται — '
    + 'αυτό ακριβώς ήταν η αιτία των τεσσάρων επαναλήψεων του σφάλματος');
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα/τα στη δρομολόγηση «ποιο νερό ρωτάει ποιος».\n`);
  failures.forEach(f => console.error(`  ${f}`));
  console.error(`
Ο ΚΑΝΟΝΑΣ, ΜΙΑ ΓΡΑΜΜΗ Ο ΚΑΘΕΝΑΣ:
  • «τι κάνει η ΘΑΛΑΣΣΑ σε αυτή την περιοχή;»   → effectiveWaveHeightM
  • «τι θα βρει ο κόσμος ΣΕ ΑΥΤΗ ΤΗΝ ΠΑΡΑΛΙΑ;»  → seaAtShoreM
  • «να σβήσω προειδοποίηση;»                    → seaForCautionM (μόνο με μετρημένη απόδειξη)

Αν το νέο σημείο ρωτάει για την ΠΕΡΙΟΧΗ, πρόσθεσέ το στον κατάλογο ALLOWED με μία δικαιολογία.
Αν ρωτάει για την ΠΑΡΑΛΙΑ, χρησιμοποίησε seaAtShoreM. Τρέξε --list για τον τρέχοντα κατάλογο.
Ιστορικό: βίβλος §Γ55-§Γ58.`);
  process.exit(1);
}

console.log(`PASSED: ${found.length} σημεία διαβάζουν την ανοιχτή θάλασσα, όλα δηλωμένα και δικαιολογημένα· `
  + 'το νερό της παραλίας έχει ένα όνομα (seaAtShoreM), οι προειδοποιήσεις ένα αυστηρότερο '
  + '(seaForCautionM), και υπολογίζονται πριν από την πρώτη ερώτηση που τα χρειάζεται.');
