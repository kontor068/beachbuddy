#!/usr/bin/env node
/**
 * ΣΤΑ 3 ΜΠΟΦΟΡ ΤΟ ΧΡΩΜΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΟ ΚΥΜΑ, ΟΧΙ ΑΠΟ ΤΗΝ ΤΑΜΠΕΛΑ — ΚΑΙ ΤΟ 14,8 ΕΙΝΑΙ ΜΕΤΡΗΣΗ.
 *
 * Ο κανόνας (utils/suitabilityTone.holdsNoBuildableChopAtThree, 20/08/2026) στηρίζεται σε ΕΝΑΝ
 * ισχυρισμό για τον πραγματικό κόσμο: *κάτω από 14,8 χλμ/ώ καμία ελληνική ακτή δεν μπορεί να
 * έχει χτίσει κύμα 0,30 μ.* Αυτό δεν είναι γούστο — είναι ιδιότητα του συνδυασμού «SMB μας ×
 * τα fetch που έχουμε στη βάση», και **αλλάζει μόνη της** αν αλλάξει το ταβάνι των ακτίνων, το
 * SMB, ή τα προφίλ έκθεσης. Χωρίς αυτή την πύλη, ένα rebuild γεωμετρίας μπορεί να ακυρώσει
 * σιωπηλά τη βάση του κανόνα και να αφήσει τον κανόνα να τρέχει.
 *
 * ΠΕΝΤΕ ΙΣΧΥΡΙΣΜΟΙ:
 *   Α. Η ΒΑΣΗ: πάνω σε ΟΛΟΥΣ τους τομείς `exposed` της χώρας, λίγο κάτω από τη σταθερά κανένας
 *      δεν φτάνει τα 0,30 μ. — και λίγο ΠΑΝΩ της, στο μεγαλύτερο fetch, κάποιος τα φτάνει.
 *      Οι δύο μαζί κλειδώνουν τη σταθερά και από τις δύο πλευρές: ούτε χαλαρή ούτε άσκοπα
 *      σφιχτή. (Η πρώτη γραφή έλεγε 14,9 και ΑΥΤΟΣ Ο ΕΛΕΓΧΟΣ την έριξε — το SMB στρογγυλοποιεί
 *      στα δύο δεκαδικά, οπότε η εμφανιζόμενη τιμή πιάνει 0,30 από τα 14,82.)
 *   Β. Η ΣΥΜΠΕΡΙΦΟΡΑ: 3 Μπφ + `exposed` + ταχύτητα κάτω από τη σταθερά → ΜΠΛΕ· από τη σταθερά
 *      και πάνω → ΚΙΤΡΙΝΟ. Ελέγχεται εκατέρωθεν του κατωφλιού.
 *   Γ. ΤΟ ΒΛΗΜΑ ΔΕΝ ΞΕΦΕΥΓΕΙ: σε 4 επίπεδα έκθεσης × 8 Μποφόρ × 40 ταχύτητες, καμία απάντηση
 *      δεν αλλάζει έξω από το «3 Μπφ + exposed». Τίποτα στα ≥4, τίποτα σε protected/partial.
 *   Δ. ΧΩΡΙΣ ΤΑΧΥΤΗΤΑ, ΚΑΜΙΑ ΑΛΛΑΓΗ: όλο το πλέγμα χωρίς `windSpeedKmh` πρέπει να δίνει
 *      ακριβώς ό,τι έδινε πριν υπάρξει ο κανόνας.
 *   Ε. ΤΟ ΤΑΒΑΝΙ ΤΗΣ ΘΑΛΑΣΣΑΣ ΤΡΕΧΕΙ ΜΕΤΑ: μια πινέζα που ανέβηκε σε μπλε πρέπει να μπορεί
 *      ακόμα να τραβηχτεί πίσω από φουρτούνα. Ο κανόνας ΔΕΝ είναι παράκαμψη.
 *
 * Self-proves με --prove: ανεβάζοντας τη σταθερά στα 19 (όλη η ζώνη μπλε) πρέπει να πέσουν
 * τα Α και Γ.
 *
 *   node scripts/validateThreeBeaufortChopGate.mjs [--prove]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const {
  resolveConditionTone,
  holdsNoBuildableChopAtThree,
  THREE_BEAUFORT_NO_BUILDABLE_CHOP_MAX_KMH: CUT,
} = require(path.join(root, 'utils/suitabilityTone.ts'));
const { estimateFetchLimitedWaveHeightM: smb } = require(path.join(root, 'utils/waveModel.ts'));

const PROVE = process.argv.includes('--prove');
/** Η γραμμή που ο κανόνας υπόσχεται ότι δεν περνιέται. Ζει εδώ ΚΑΙ στο σχόλιο της σταθεράς. */
const CHOP_LINE_M = 0.30;
const failures = [];
const fail = (claim, msg) => failures.push(`[${claim}] ${msg}`);

// Η σταθερά που ΔΟΚΙΜΑΖΕΤΑΙ. Με --prove τη σαμποτάρουμε για να αποδείξουμε ότι η πύλη δαγκώνει.
const cut = PROVE ? 19 : CUT;

// ── Α. Η ΒΑΣΗ ΤΟΥ ΚΑΝΟΝΑ, ΠΑΝΩ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ ΠΡΟΦΙΛ ────────────────────────
const DIR = path.join(root, 'public/data/geospatial/exposure');
const fetches = [];
for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const list = Array.isArray(d.profiles) ? d.profiles : Object.values(d.profiles || {});
  for (const p of list) {
    if (!p?.sectors) continue;
    for (const s of Object.values(p.sectors)) if (s.level === 'exposed') fetches.push(s.fetchKm);
  }
}
if (fetches.length < 1000) fail('Α', `μόνο ${fetches.length} εκτεθειμένοι τομείς — τα προφίλ δεν φορτώθηκαν`);
const maxFetch = Math.max(...fetches);
const justUnder = fetches.filter(f => smb({ windSpeedKmh: cut - 0.01, fetchKm: f }) >= CHOP_LINE_M);
if (justUnder.length) {
  fail('Α', `στα ${(cut - 0.01).toFixed(2)} χλμ/ώ ${justUnder.length} τομείς ΦΤΑΝΟΥΝ τα ${CHOP_LINE_M} μ `
    + `(μεγαλύτερο ${Math.max(...justUnder)} χλμ) — η σταθερά ${cut} δεν είναι πια ασφαλής`);
}
// Και η ΑΛΛΗ κατεύθυνση: η σταθερά δεν επιτρέπεται να είναι άσκοπα σφιχτή. Λίγο πάνω της
// κάποιος τομέας πρέπει ΟΝΤΩΣ να περνάει τη γραμμή, αλλιώς κρατάμε κίτρινο νερό που το ίδιο
// μας το μοντέλο λέει επίπεδο — και κανείς δεν θα το προσέξει.
if (smb({ windSpeedKmh: cut + 0.1, fetchKm: maxFetch }) < CHOP_LINE_M) {
  fail('Α', `ακόμα και στα ${(cut + 0.1).toFixed(2)} χλμ/ώ, στο μεγαλύτερο fetch της χώρας `
    + `(${maxFetch} χλμ), το κύμα μένει ${smb({ windSpeedKmh: cut + 0.1, fetchKm: maxFetch })} μ — `
    + `η σταθερά ${cut} είναι πιο σφιχτή απ' ό,τι χρειάζεται`);
}

// ── Β. Η ΣΥΜΠΕΡΙΦΟΡΑ ΕΚΑΤΕΡΩΘΕΝ ΤΟΥ ΚΑΤΩΦΛΙΟΥ ───────────────────────────────
const tone = (over, speed) => resolveConditionTone({
  exposureLevel: over, beaufort: 3, windSpeedKmh: speed,
});
if (!PROVE) {
  if (tone('exposed', CUT - 0.5) !== 'blue') fail('Β', `3 Μπφ, exposed, ${CUT - 0.5} χλμ/ώ → ${tone('exposed', CUT - 0.5)}, περίμενα blue`);
  if (tone('exposed', CUT) !== 'yellow') fail('Β', `3 Μπφ, exposed, ${CUT} χλμ/ώ → ${tone('exposed', CUT)}, περίμενα yellow`);
  if (tone('exposed', 19) !== 'yellow') fail('Β', 'η κορυφή των 3 Μπφ έπαψε να είναι κίτρινη');
  if (!holdsNoBuildableChopAtThree(3, CUT - 0.1)) fail('Β', 'ο βοηθός δεν ανοίγει κάτω από τη σταθερά');
  if (holdsNoBuildableChopAtThree(4, 5)) fail('Β', 'ο βοηθός άνοιξε σε 4 Μποφόρ');
  if (holdsNoBuildableChopAtThree(3, undefined)) fail('Β', 'ο βοηθός άνοιξε χωρίς ταχύτητα');
}

// ── Γ+Δ. ΤΟ ΠΛΕΓΜΑ: πού επιτρέπεται να αλλάξει κάτι, και πού όχι ─────────────
const LEVELS = ['protected', 'partial', 'exposed', undefined];
const SPEEDS = Array.from({ length: 40 }, (_, i) => 1 + i * 1.5);
const getBft = kmh => (kmh < 1 ? 0 : kmh <= 5 ? 1 : kmh <= 11 ? 2 : kmh <= 19 ? 3
  : kmh <= 28 ? 4 : kmh <= 38 ? 5 : kmh <= 49 ? 6 : 7);
let changed = 0;
for (const level of LEVELS) {
  for (const speed of SPEEDS) {
    const bft = getBft(speed);
    const withSpeed = resolveConditionTone({ exposureLevel: level, beaufort: bft, windSpeedKmh: speed });
    const without = resolveConditionTone({ exposureLevel: level, beaufort: bft });
    if (withSpeed === without) continue;
    changed++;
    const legal = bft === 3 && level === 'exposed' && speed < cut && withSpeed === 'blue' && without === 'yellow';
    if (!legal) {
      fail('Γ', `η ταχύτητα άλλαξε απάντηση εκτός της ζώνης της: ${level}/${bft} Μπφ/${speed} χλμ/ώ `
        + `${without} → ${withSpeed}`);
    }
  }
}
if (!PROVE && changed === 0) fail('Δ', 'ο κανόνας δεν άλλαξε ΤΙΠΟΤΑ σε όλο το πλέγμα — νεκρός κώδικας');

// ── Ε. ΤΟ ΤΑΒΑΝΙ ΤΗΣ ΘΑΛΑΣΣΑΣ ΔΕΝ ΠΑΡΑΚΑΜΠΤΕΤΑΙ ─────────────────────────────
if (!PROVE) {
  const lifted = resolveConditionTone({ exposureLevel: 'exposed', beaufort: 3, windSpeedKmh: CUT - 1 });
  const rough = resolveConditionTone({ exposureLevel: 'exposed', beaufort: 3, windSpeedKmh: CUT - 1, seaStateM: 1.4 });
  if (lifted !== 'blue') fail('Ε', 'η προϋπόθεση του ελέγχου έσπασε — η ήρεμη περίπτωση δεν είναι μπλε');
  if (rough === 'blue') fail('Ε', 'με θάλασσα 1,4 μ. η πινέζα έμεινε ΜΠΛΕ — ο κανόνας παρακάμπτει το ταβάνι');
}

// ── ΑΠΟΤΕΛΕΣΜΑ ──────────────────────────────────────────────────────────────
if (PROVE) {
  if (failures.length) {
    console.log(`✅ self-proof: με σταθερά ${cut} η πύλη έπεσε σε ${failures.length} σημεία, όπως έπρεπε`);
    process.exit(0);
  }
  console.error('❌ self-proof: η σαμποταρισμένη σταθερά ΠΕΡΑΣΕ — η πύλη είναι διακοσμητική');
  process.exit(1);
}
if (failures.length) {
  console.error(`❌ ${failures.length} αποτυχίες:`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`✅ 3 Μποφόρ: σταθερά ${CUT} χλμ/ώ επαληθεύτηκε σε ${fetches.length} εκτεθειμένους τομείς `
  + `(μεγαλύτερο fetch ${maxFetch} χλμ) · ${changed} κελιά του πλέγματος άλλαξαν, όλα μέσα στη ζώνη τους`);
