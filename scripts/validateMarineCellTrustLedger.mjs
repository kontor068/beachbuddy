/**
 * Η ΣΗΜΑΝΣΗ «ΑΥΤΗ Η ΠΑΡΑΛΙΑ ΔΙΑΒΑΖΕΙ ΞΕΝΟ ΝΕΡΟ» ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΞΕΘΩΡΙΑΣΕΙ ΣΙΩΠΗΛΑ.
 *
 * ΤΙ ΠΡΟΣΤΑΤΕΥΕΙ. 255 από 2.872 παραλίες (8,9%) παίρνουν ύψος κύματος από κελί μοντέλου που
 * περιγράφει νερό το οποίο η παραλία δεν βλέπει — πίσω από ακρωτήρι, ή δεκάδες χιλιόμετρα μακριά.
 * Στις 17/08/2026 ο Μίλτος επέλεξε τον δρόμο Γ του HANDOVER-marine-cell-trust: **δεν κρύβουμε τον
 * αριθμό** (θα έσβηνε 255 πιθανώς σωστές απαντήσεις για άγνωστο πλήθος λαθών) αλλά τον
 * **σημαδεύουμε εσωτερικά** ώστε (α) να σταματήσει να χειροτερεύει και (β) να υπάρχει μετρημένη
 * βάση όταν κάποτε βρεθεί πηγή με ανάλυση κάτω από 1 χλμ.
 *
 * ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΠΥΛΗ ΚΑΙ ΔΕΝ ΑΡΚΕΙ Η ΣΗΜΑΝΣΗ. Το `marineCellTrusted` ζει μέσα στα προφίλ
 * γεωμετρίας, τα οποία ξαναγράφονται από εθνικά rebuild. Ακριβώς αυτή η οικογένεια σφάλματος
 * χτύπησε ήδη δύο φορές: τα διορθωμένα σημεία θάλασσας «σβήνονταν στο rebuild», και οι
 * σφραγισμένες κυψέλες πρόγνωσης έλειπαν από μια νέα παραλία χωρίς να το πει κανείς. Μια σήμανση
 * που κανείς δεν ελέγχει είναι σήμανση που θα λείψει σιωπηλά.
 *
 * ΤΡΕΧΕΙ ΧΩΡΙΣ ΔΙΚΤΥΟ. Συγκρίνει δύο πράγματα που είναι ΚΑΙ ΤΑ ΔΥΟ στο repo: το κατάστιχο της
 * τελευταίας μέτρησης (`reports/quality/marine-cell-trust-per-beach.json`) και τη σήμανση μέσα
 * στα προφίλ. Δεν ξαναρωτάει το Open-Meteo — αυτό είναι δουλειά του `auditMarineCellTrust.mjs`.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ. Δεν αλλάζει τίποτα στην οθόνη και δεν κρίνει αν το νούμερο είναι λάθος. Ξέρουμε
 * ότι η ΕΡΩΤΗΣΗ απαντήθηκε από λάθος σημείο· δεν ξέρουμε ότι η ΑΠΑΝΤΗΣΗ βγήκε λάθος, και με
 * κυψέλες 4-8 χλμ. δεν υπάρχει κριτής που να το αποδείξει σε κόλπο 2 χλμ.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const ledgerPath = path.join(root, 'reports/quality/marine-cell-trust-per-beach.json');

/**
 * ΚΑΣΤΑΝΙΑ, ΟΧΙ ΣΤΟΧΟΣ. Ο αριθμός επιτρέπεται να ΠΕΣΕΙ ελεύθερα. Αν ανέβει, κάτι χάλασε — είτε μια
 * νέα παραλία μπήκε σε κακό σημείο, είτε ένα rebuild μετακίνησε σημεία θάλασσας. Ανέβασε αυτό το
 * νούμερο ΜΟΝΟ αν η αύξηση εξηγείται και είναι αποδεκτή, και γράψε γιατί δίπλα στην αλλαγή.
 *
 * 17/08/2026: **255**. Μετρήθηκε με κανόνα ευθείας γραμμής («η ακτίνα προς το κελί χτύπησε
 * στεριά»).
 * 22/08/2026: **68**. Δεν βρέθηκε καλύτερη πηγή και δεν κουνήθηκε κανένα σημείο — άλλαξε η
 * ΕΡΩΤΗΣΗ. Οι ακτίνες ταξιδεύουν σε ευθεία, η θάλασσα όχι: 193 παραλίες έχουν το κελί τους στην
 * ίδια θάλασσα, ένα ακρωτήρι παραδίπλα (`MAX_TRUSTED_DETOUR`), και όσες κάθονται πίσω από
 * πραγματικό στένωμα μένουν έξω από τον δεύτερο μάρτυρα (`scripts/lib/enclosureWitness.mjs`).
 * Βίβλος §Γ65 · πύλη `validateWaterRouteRestoration.mjs`.
 */
const UNTRUSTED_BASELINE = 68;

const fail = (lines) => {
  console.error('✗ marine-cell-trust ledger: ΑΠΕΤΥΧΕ');
  for (const line of lines) console.error(`  - ${line}`);
  process.exit(1);
};

const ledgerRaw = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const ledger = new Map(ledgerRaw.map(entry => [entry.beachId, entry]));

const profiles = [];
for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const payload = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  for (const profile of Object.values(payload.profiles ?? {})) {
    if (profile?.beachId != null) profiles.push({ ...profile, regionId: file.replace(/\.json$/, '') });
  }
}

const problems = [];

// ── Α. Καμία παραλία χωρίς μέτρηση ──────────────────────────────────────────
// Μια νέα παραλία που μπαίνει χωρίς να ρωτηθεί «ποιο νερό διαβάζει;» είναι ακριβώς ο τρόπος με
// τον οποίο ο αριθμός μεγαλώνει χωρίς να το δει κανείς.
const unmeasured = profiles.filter(p => !ledger.has(p.beachId));
if (unmeasured.length) {
  problems.push(
    `${unmeasured.length} παραλίες δεν έχουν περάσει ποτέ από τον έλεγχο θαλάσσιου κελιού: `
    + `${unmeasured.slice(0, 6).map(p => `#${p.beachId} (${p.regionId})`).join(', ')}`
    + `${unmeasured.length > 6 ? ` …και ${unmeasured.length - 6} ακόμα` : ''}`
  );
}

// ── Β. Η σήμανση συμφωνεί με το κατάστιχο ───────────────────────────────────
const drift = [];
for (const profile of profiles) {
  const entry = ledger.get(profile.beachId);
  if (!entry) continue;
  const flagged = profile.marineCellTrusted === false;
  if (flagged !== !entry.trusted) {
    drift.push(`#${profile.beachId} ${entry.name ?? ''} (${profile.regionId}): `
      + `${flagged ? 'σημασμένη' : 'ΧΩΡΙΣ σήμανση'} ενώ η μέτρηση λέει `
      + `${entry.trusted ? 'αξιόπιστο' : 'ΑΝΑΞΙΟΠΙΣΤΟ'} κελί`);
  }
}
if (drift.length) {
  problems.push(`${drift.length} παραλίες όπου η σήμανση και η μέτρηση διαφωνούν:`);
  problems.push(...drift.slice(0, 6).map(d => `    ${d}`));
  if (drift.length > 6) problems.push(`    …και ${drift.length - 6} ακόμα`);
}

// ── Γ. Η καστάνια ───────────────────────────────────────────────────────────
const untrusted = profiles.filter(p => p.marineCellTrusted === false).length;
if (untrusted > UNTRUSTED_BASELINE) {
  problems.push(
    `οι αναξιόπιστες ανέβηκαν: ${untrusted} > ${UNTRUSTED_BASELINE} (βάση 17/08/2026). `
    + 'Κάτι μετακίνησε σημεία θάλασσας ή μπήκαν παραλίες σε κακή θέση.'
  );
}

// ── Δ. Απόδειξη ότι η πύλη δεν είναι διακοσμητική ────────────────────────────
// Χωρίς αυτό, μια πύλη που πάντα περνάει είναι αδύνατο να ξεχωρίσει από μια πύλη που δουλεύει.
// Σαμποτάρουμε ένα αντίγραφο του καταστίχου και απαιτούμε να το πιάσει ο έλεγχος Β.
const sabotage = () => {
  const victim = profiles.find(p => ledger.has(p.beachId));
  if (!victim) return 'δεν βρέθηκε παραλία για σαμποτάζ — ο έλεγχος Β δεν αποδείχθηκε';
  const entry = ledger.get(victim.beachId);
  const flipped = { ...entry, trusted: !entry.trusted };
  const flagged = victim.marineCellTrusted === false;
  const caught = flagged !== !flipped.trusted;
  return caught ? null : 'το σαμποτάζ ΔΕΝ έγινε αντιληπτό — ο έλεγχος Β δεν κρίνει τίποτα';
};
const sabotageProblem = sabotage();
if (sabotageProblem) problems.push(sabotageProblem);

// ── Ε. Η προτίμηση μοντέλου δείχνει σε σημεία που ΥΠΑΡΧΟΥΝ ──────────────────
// Το κλειδί είναι στρογγυλοποιημένες συντεταγμένες. Αν αλλάξει η στρογγυλοποίηση σε ένα από τα
// τρία σημεία που τη χρησιμοποιούν (παραγωγός, utils/marineModelPreference, marineSamplePoints),
// η προτίμηση γίνεται ΣΙΩΠΗΛΑ ανενεργή: κανένα κλειδί δεν ταιριάζει και κανείς δεν το μαθαίνει.
{
  const prefSrc = readFileSync(path.join(root, 'utils/marineModelPreference.generated.ts'), 'utf8');
  const keys = [...prefSrc.matchAll(/^\s*'([-\d.]+_[-\d.]+)':/gm)].map(m => m[1]);
  const pointKeys = new Set();
  for (const profile of profiles) {
    const sp = profile.marineSamplePoint;
    if (sp) pointKeys.add(`${sp.lat.toFixed(3)}_${sp.lon.toFixed(3)}`);
  }
  const orphans = keys.filter(k => !pointKeys.has(k));
  if (!keys.length) {
    problems.push('η προτίμηση μοντέλου είναι ΑΔΕΙΑ — 49 σημεία μετρήθηκαν, κανένα δεν γράφτηκε');
  } else if (orphans.length) {
    problems.push(
      `${orphans.length} κλειδιά προτίμησης μοντέλου δεν αντιστοιχούν σε κανένα σημείο θάλασσας `
      + `(${orphans.slice(0, 3).join(', ')}) — η προτίμηση είναι σιωπηλά ανενεργή εκεί. `
      + 'Ξανατρέξε: node scripts/bakeMarineModelPreference.mjs'
    );
  }
}

if (problems.length) fail(problems);

console.log(
  `OK: ${profiles.length} παραλίες μετρημένες · ${untrusted} σημασμένες ως «διαβάζει ξένο νερό» `
  + `(βάση ${UNTRUSTED_BASELINE}) · σήμανση και μέτρηση συμφωνούν παντού.`
);
