#!/usr/bin/env node
/**
 * Η ΓΡΑΜΜΗ ΤΟΥ ΑΠΟΓΕΙΟΥ ΑΝΕΜΟΥ ΜΙΛΑΕΙ ΣΠΑΝΙΑ, ΔΕΝ ΚΑΘΗΣΥΧΑΖΕΙ ΠΟΤΕ ΛΑΘΟΣ — gate.
 *
 * ΤΙ ΦΥΛΑΕΙ (βίβλος §Μ6 + μπλοκ 21/08/2026). Η `utils/offshoreWindNote` λέει «το νερό μπροστά σου
 * είναι πιο ήρεμο απ’ ό,τι λέει ο αριθμός». Είναι καθησυχαστική φράση, δηλαδή κινείται προς τη
 * ΜΟΝΗ κατεύθυνση που μπορεί να βλάψει άνθρωπο — σκανδάλη #1 της §9. Δεν αλλάζει αριθμό, χρώμα ή
 * ετυμηγορία, γι’ αυτό ΔΕΝ είναι εξαίρεση στο κλείδωμα (ίδια κατηγορία με §Γ14/§Γ16) — αλλά η
 * §7δ θέλει δική της πύλη σε ό,τι ακουμπάει αυτή την κατεύθυνση. Αυτή είναι.
 *
 * ⚠️ ΤΟ ΚΕΝΤΡΙΚΟ ΕΥΡΗΜΑ ΠΟΥ ΚΛΕΙΔΩΝΕΤΑΙ ΕΔΩ: **η γεωμετρία ΜΟΝΗ ΤΗΣ δεν διακρίνει τίποτα.**
 * Μετρημένο 21/08 στα ίδια δεδομένα που ψήνει το `buildWindShadow`: **98,5% των παραλιών (2.827
 * από 2.869) μπορούν να ανάψουν σε κάποιον άνεμο**, και κατά μέσο όρο **8,85 από τις 24 γωνίες**
 * περνάνε. Αυτό ΔΕΝ είναι σφάλμα — είναι το ίδιο δομικό γεγονός που σκότωσε τρεις προηγούμενους
 * κανόνες («κάθε παραλία έχει στεριά στη μισή πυξίδα», §Μ6). Αυτό που κάνει τη γραμμή σπάνια
 * (0,8% των ωρών) είναι ΤΟ ΠΑΡΑΘΥΡΟ ΚΥΜΑΤΟΣ [0,40 – 0,80], όχι η γεωμετρία. Όποιος χαλαρώσει το
 * παράθυρο νομίζοντας ότι «η γεωμετρία ούτως ή άλλως φιλτράρει» μετατρέπει τη γραμμή σε
 * ταπετσαρία σε μία γραμμή κώδικα. Ο έλεγχος 5 παρακάτω υπάρχει γι’ αυτό ακριβώς.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const note = require(path.join(root, 'utils/offshoreWindNote.ts'));
const {
  resolveOffshoreWindNote, windArrivedOverLand,
  WIND_SHADOW_LAND_KM, WIND_SHADOW_SLOTS, OFFSHORE_NOTE_WINDOW_DEG,
  OFFSHORE_NOTE_MIN_BEAUFORT, OFFSHORE_NOTE_MIN_WAVE_M, OFFSHORE_NOTE_MAX_WAVE_M,
  OFFSHORE_NOTE_WARNING_MIN_BEAUFORT,
} = note;
const { offshoreWindNoteLabels } = require(path.join(root, 'utils/conditionToneLabels.ts'));

const failures = [];
const fail = (message) => failures.push(message);
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

/* ── 1. ΤΑ ΔΕΔΟΜΕΝΑ ΥΠΑΡΧΟΥΝ ΚΑΙ ΕΧΟΥΝ ΣΩΣΤΟ ΣΧΗΜΑ ───────────────────────────────────────── */
let profilesSeen = 0;
let withShadow = 0;
let malformed = 0;
let firingDirectionsSum = 0;
let couldEverFire = 0;
const witness = { id: 636, region: 'crete-crete-heraklion', shadow: undefined };

for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const doc = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  for (const [beachId, profile] of Object.entries(doc.profiles || {})) {
    profilesSeen += 1;
    const shadow = profile.windShadow;
    if (typeof shadow !== 'string') continue;
    if (shadow.length !== WIND_SHADOW_SLOTS || /[^01]/.test(shadow)) { malformed += 1; continue; }
    withShadow += 1;
    if (Number(beachId) === witness.id) witness.shadow = shadow;

    let firing = 0;
    for (let slot = 0; slot < WIND_SHADOW_SLOTS; slot += 1) {
      if (windArrivedOverLand(shadow, slot * (360 / WIND_SHADOW_SLOTS))) firing += 1;
    }
    firingDirectionsSum += firing;
    if (firing > 0) couldEverFire += 1;
  }
}

if (malformed > 0) fail(`${malformed} προφίλ έχουν windShadow με λάθος σχήμα (θέλει ${WIND_SHADOW_SLOTS} χαρακτήρες '0'/'1').`);
const coverage = profilesSeen ? withShadow / profilesSeen : 0;
if (coverage < 0.95) {
  fail(`Μόνο ${(coverage * 100).toFixed(1)}% των προφίλ έχουν windShadow (όριο 95%). Τρέξε: node scripts/buildWindShadow.mjs`);
}

/* ── 2. ΟΙ ΣΤΑΘΕΡΕΣ ΣΥΜΦΩΝΟΥΝ ΜΕ ΟΣΕΣ ΔΑΝΕΙΣΤΗΚΑΝ ────────────────────────────────────────── */
const bakerSource = readFileSync(path.join(root, 'scripts/buildWindShadow.mjs'), 'utf8');
const bakedLandKm = Number(/const LAND_KM = ([\d.]+);/.exec(bakerSource)?.[1]);
if (bakedLandKm !== WIND_SHADOW_LAND_KM) {
  fail(`Το buildWindShadow ψήνει στα ${bakedLandKm} χλμ ενώ το utils/offshoreWindNote λέει ${WIND_SHADOW_LAND_KM}. `
    + 'Κάθε "1" στο windShadow θα σήμαινε άλλο πράγμα από αυτό που διαβάζει ο κανόνας.');
}

const characterSource = readFileSync(path.join(root, 'utils/waveCharacter.ts'), 'utf8');
const flatWaterM = Number(/FLAT_WATER_SEA_STATE_M\s*=\s*([\d.]+)/.exec(characterSource)?.[1]);
const amberM = Number(/SEA_STATE_AMBER_M\s*=\s*([\d.]+)/.exec(characterSource)?.[1]);
if (Number.isFinite(flatWaterM) && flatWaterM !== OFFSHORE_NOTE_MIN_WAVE_M) {
  fail(`Το κάτω όριο (${OFFSHORE_NOTE_MIN_WAVE_M}) ξέφυγε από το δανεικό FLAT_WATER_SEA_STATE_M (${flatWaterM}).`);
}
if (Number.isFinite(amberM) && amberM !== OFFSHORE_NOTE_MAX_WAVE_M) {
  fail(`Το πάνω όριο (${OFFSHORE_NOTE_MAX_WAVE_M}) ξέφυγε από το δανεικό SEA_STATE_AMBER_M (${amberM}).`);
}

/* ── 3. ΣΥΜΠΕΡΙΦΟΡΑ: ΠΟΤΕ ΔΕΝ ΚΑΘΗΣΥΧΑΖΕΙ ΕΚΕΙ ΠΟΥ ΔΕΝ ΠΡΕΠΕΙ ──────────────────────────────── */
const base = {
  profile: { confidence: 'high', windShadow: '1'.repeat(WIND_SHADOW_SLOTS) },
  windFromDeg: 310,
  beaufort: 4,
  displayWaveM: 0.5,
  swimVerdictAvoid: false,
};
const must = (label, input, expected) => {
  const got = resolveOffshoreWindNote({ ...base, ...input });
  if (got !== expected) fail(`${label}: περίμενα ${expected === null ? 'σιωπή' : expected}, πήρα ${got === null ? 'σιωπή' : got}.`);
};
must('«μην κολυμπήσεις» πρέπει να τη σφραγίζει', { swimVerdictAvoid: true }, null);
must('κύμα κάτω από το παράθυρο', { displayWaveM: OFFSHORE_NOTE_MIN_WAVE_M - 0.01 }, null);
must('κύμα πάνω από το παράθυρο', { displayWaveM: OFFSHORE_NOTE_MAX_WAVE_M + 0.01 }, null);
must('κάτω από το ελάχιστο μποφόρ', { beaufort: OFFSHORE_NOTE_MIN_BEAUFORT - 1 }, null);
must('χωρίς windShadow', { profile: { confidence: 'high' } }, null);
must('χαμηλή εμπιστοσύνη προφίλ', { profile: { confidence: 'low', windShadow: '1'.repeat(WIND_SHADOW_SLOTS) } }, null);
must('άγνωστη γωνία ανέμου', { windFromDeg: undefined }, null);
must('ανοιχτός ορίζοντας στη γωνία του ανέμου', { profile: { confidence: 'high', windShadow: '0'.repeat(WIND_SHADOW_SLOTS) } }, null);
must('στα 3 Μποφόρ μόνο η ανακούφιση', { beaufort: OFFSHORE_NOTE_WARNING_MIN_BEAUFORT - 1 }, 'calmer-than-the-number');
must('από 4 Μποφόρ ΚΑΙ η προειδοποίηση', { beaufort: OFFSHORE_NOTE_WARNING_MIN_BEAUFORT }, 'calmer-but-pulls-out');

/* ── 4. Ο ΜΑΡΤΥΡΑΣ — Η ΠΑΡΑΛΙΑ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ ────────────────────────────────────────────── */
if (!witness.shadow) {
  fail(`Δεν βρέθηκε windShadow για τη Λυγαριά #${witness.id}. Η γραμμή γράφτηκε γι’ αυτήν· χωρίς αυτήν δεν μετριέται τίποτα.`);
} else {
  // Οι δύο γωνίες των δύο αναφορών Μίλτου: 314° (16/08) και 310° (21/08). Πρέπει να μιλάει.
  for (const deg of [310, 314]) {
    if (!windArrivedOverLand(witness.shadow, deg)) {
      fail(`Λυγαριά: ο άνεμος από ${deg}° έρχεται πάνω από στεριά (0,13-0,20 χλμ, μετρημένο) και η γραμμή σωπαίνει.`);
    }
  }
  // Και το ανάποδο, που είναι εξίσου δεσμευτικό: με βοριά μπαίνει ΟΝΤΩΣ θάλασσα από το στόμιο
  // (15°-45°, βίβλος §Μ6). Εκεί μια καθησυχαστική φράση θα ήταν ψεύτικη ηρεμία.
  for (const deg of [15, 30, 45]) {
    if (windArrivedOverLand(witness.shadow, deg)) {
      fail(`Λυγαριά: ο άνεμος από ${deg}° μπαίνει από το στόμιο του όρμου και η γραμμή δεν επιτρέπεται να μιλήσει.`);
    }
  }
}

/* ── 5. ΤΟ ΜΕΓΕΘΟΣ ΔΕΝ ΦΟΥΣΚΩΝΕΙ ΣΙΩΠΗΛΑ ─────────────────────────────────────────────────── */
const meanFiringDirections = withShadow ? firingDirectionsSum / withShadow : 0;
const MEAN_FIRING_CEILING = 10;
if (meanFiringDirections > MEAN_FIRING_CEILING) {
  fail(`Η γεωμετρία άνοιξε: μέσος όρος ${meanFiringDirections.toFixed(2)} από ${WIND_SHADOW_SLOTS} γωνίες ανά παραλία `
    + `(μετρημένο 21/08: 8,85· ταβάνι ${MEAN_FIRING_CEILING}). Είτε φάρδυνε το παράθυρο, είτε σηκώθηκε το όριο στεριάς.`);
}
if (OFFSHORE_NOTE_WINDOW_DEG < 45) {
  fail(`Το παράθυρο έπεσε στις ${OFFSHORE_NOTE_WINDOW_DEG}° — στενότερο παράθυρο σημαίνει ΧΑΛΑΡΟΤΕΡΟΣ κανόνας `
    + '(λιγότερες γωνίες χρειάζεται να είναι κλειστές). Μετρημένο: ±30° διπλασιάζει τις παραλίες (3,2% → 6,1%).');
}

/* ── 6. ΚΑΘΕ ΓΛΩΣΣΑ ΕΧΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΦΡΑΣΕΙΣ ─────────────────────────────────────────────── */
for (const [language, forms] of Object.entries(offshoreWindNoteLabels)) {
  for (const form of ['calmer-than-the-number', 'calmer-but-pulls-out']) {
    const text = forms?.[form];
    if (typeof text !== 'string' || text.trim().length < 20) {
      fail(`Λείπει ή είναι κολοβή η φράση «${form}» στα ${language}.`);
    }
  }
}

/* ── ΑΠΟΤΕΛΕΣΜΑ ──────────────────────────────────────────────────────────────────────────── */
console.log(`προφίλ: ${profilesSeen} · με windShadow: ${withShadow} (${(coverage * 100).toFixed(1)}%)`);
console.log(`μπορούν να ανάψουν σε κάποιον άνεμο: ${couldEverFire} (${(couldEverFire / withShadow * 100).toFixed(1)}%) — `
  + `μέσος όρος ${meanFiringDirections.toFixed(2)}/${WIND_SHADOW_SLOTS} γωνίες`);
console.log('υπενθύμιση: τη ΣΥΧΝΟΤΗΤΑ στην οθόνη τη μετράει το scripts/measureOffshoreWindNote.mjs (θέλει δίκτυο).');

if (failures.length) {
  console.error(`\n❌ ΠΥΛΗ ΑΠΟΓΕΙΟΥ ΑΝΕΜΟΥ — ${failures.length} αποτυχίες:`);
  for (const message of failures) console.error(`  · ${message}`);
  process.exit(1);
}
console.log('\n✅ ΠΥΛΗ ΑΠΟΓΕΙΟΥ ΑΝΕΜΟΥ: πέρασε');
