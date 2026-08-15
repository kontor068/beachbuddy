// Drops access notes that speak to US instead of to the visitor, 15/08/2026 — no API, dry-run by default.
//
//   node scripts/fixInternalAccessNotes2026-08.mjs           # dry run (prints every group)
//   node scripts/fixInternalAccessNotes2026-08.mjs --write    # persist, then npm run build:beach-data
// Reverse from the sourceNotes entry, which quotes the removed text in full.
//
// WHY. `metadata.access.notes` is printed VERBATIM and GREEK ONLY (components/BeachCard.tsx:2366);
// every other language gets the clean localized label instead. So an internal editorial
// instruction in that field is shown to Greek visitors and to nobody else. 275 beaches carry one,
// and the worst is on 259 of them word for word:
//
//   "Δεν υπάρχει ακόμη source-backed ένδειξη για χωματόδρομο, μονοπάτι ή εύκολη οδική πρόσβαση.
//    Κράτα την πρόσβαση ως μη επιβεβαιωμένη μέχρι να προστεθεί άμεση πηγή."
//
// It gives an order to an editor ("Κράτα την πρόσβαση…"), it uses English inside Greek
// ("source-backed"), and what it actually states — that access is unconfirmed — is already on the
// card as the chip «Πρόσβαση μη επιβεβαιωμένη». Same family as the 34-Chania and Rethymno passes
// (scripts/fixDuplicateAccessBoilerplate2026-08.mjs, scripts/fixAccessNoteEcho2026-08.mjs) and
// the same rule: robot copy is fixed with LESS text, never by inventing per-beach prose.
//
// THE 16 THAT ARE NOT THE BOILERPLATE WERE READ ONE BY ONE before this was written, because ten of
// them looked like they carried real information ("μόνο με σκάφος", "δύσβατος χωματόδρομος",
// "κατάβαση 30 λεπτών"). Every one of those facts is already in `access.label`, in clean Greek:
// #1830 «Μόνο με σκάφος» · #1833 «Δύσβατος χωματόδρομος ή σκάφος» · #1701 «Δύσβατος χωματόδρομος» ·
// #2231 «Δύσκολο μονοπάτι» · #1804 «Μονοπάτι ή σκάφος» · #2015 «Αγροτικός δρόμος με ιδιωτικό
// όχημα». The note was the same fact a second time with our jargon bolted on.
//
// THREE DETAILS DO NOT SURVIVE, and that is recorded rather than hidden: the starting point of the
// Καμινάκι track ("από Μυρμηγκιές"), the ~30-minute descent at Άγιος Ιωάννης Ρίχτης, and the
// "bring water and supplies" warning at Τηλέγραφος. They are real, they are small, and keeping a
// jargon paragraph on 275 cards is the wrong price for them — the honest fix is a proper label,
// which is a content decision, not a sweep. The full text stays in sourceNotes for whoever does it.
//
// BEHAVIOURALLY INERT, VERIFIED NOT ASSUMED. utils/access.ts scans type + label + notes for
// dirt-road keywords, and the boilerplate contains "χωματόδρομο" inside a NEGATION — the defect
// closed in code earlier today (DENIES_KNOWLEDGE). This script re-runs all six real access
// predicates over every touched record before and after, and refuses to write if any moves.
//
// Empty string, NOT delete: isBeachMetadata (scripts/buildBeachRegionData.mjs) requires
// access.notes to be a string, and dropping the key voids the whole metadata object and stops the
// build. BeachCard skips the paragraph on a falsy value, so "" renders nothing.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-08-15';

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const access = require(path.join(rootDir, 'utils/access.ts'));
const PREDICATES = ['hasDirtRoadAccess', 'hasBoatOnlyAccess', 'hasChallengingAccess',
  'hasDifficultTopPickAccess', 'hasPracticalTopPickAccess', 'hasTrulyEasyAccess'];

// The marker of an editorial instruction: our own process vocabulary, which no visitor sentence
// has any reason to contain. Deliberately narrow — it must not catch a note that merely mentions
// a source, only one that talks about our evidence state or tells an editor what to do.
const INTERNAL = /source-backed|Κράτα την πρόσβαση/;

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const raw = readFileSync(sourcePath, 'utf8');
const data = JSON.parse(raw);

// Refuse to touch a 9,5 MB source file whose formatting we cannot reproduce byte for byte —
// otherwise a 275-record edit arrives as a whole-file diff that nobody can review.
if (JSON.stringify(data, null, 2) + '\n' !== raw) {
  console.error('ΣΤΑΜΑΤΗΣΕ: το greek_beaches.json δεν ξαναγράφεται πανομοιότυπα· θα άλλαζε όλο το αρχείο.');
  process.exit(1);
}

const beaches = [];
const walk = node => {
  if (Array.isArray(node)) {
    for (const item of node) if (item && typeof item === 'object' && 'id' in item && 'lat' in item) beaches.push(item);
    return;
  }
  if (node && typeof node === 'object') for (const value of Object.values(node)) walk(value);
};
walk(data);

const targets = beaches.filter(b => INTERNAL.test(b.metadata?.access?.notes || ''));

// The app reads a BUILT beach, where accessNotes mirrors metadata.access.notes — model that shape,
// or the predicates are asked a question the app never asks.
const shape = b => ({
  id: b.id,
  accessibility: b.accessibility,
  metadata: b.metadata,
  environment: b.environment,
  accessNotes: b.metadata?.access?.notes ? { gr: b.metadata.access.notes, en: b.metadata.access.notes } : undefined,
});
const signature = b => PREDICATES.map(name => {
  try { return access[name](shape(b)) ? '1' : '0'; } catch { return 'x'; }
}).join('');

const before = targets.map(signature);

const byText = new Map();
for (const beach of targets) {
  const text = beach.metadata.access.notes.trim();
  byText.set(text, [...(byText.get(text) || []), beach]);
}

console.log(`${targets.length} παραλίες · ${byText.size} διακριτά κείμενα\n`);
for (const [text, group] of [...byText.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(group.length).padStart(3)} × ${text.slice(0, 110)}${text.length > 110 ? '…' : ''}`);
  if (group.length <= 3) {
    for (const beach of group) console.log(`      #${beach.id} ${beach.name} · ταμπέλα που μένει: «${beach.metadata.access.label || '—'}»`);
  }
}

for (const beach of targets) {
  const removed = beach.metadata.access.notes;
  beach.metadata.access.notes = '';
  const entry = `National internal-note sweep ${STAMP}: access.notes cleared. Removed text: "${removed}". It was an internal editorial instruction printed verbatim on the Greek card only (BeachCard.tsx:2366) while every other language showed the localized access label; what it stated is already carried by access.label/type. access.type, access.label, amenities, orientation, confidence and scoring unchanged.`;
  if (Array.isArray(beach.metadata.sourceNotes)) beach.metadata.sourceNotes.push(entry);
  else beach.metadata.sourceNotes = [entry];
}

const after = targets.map(signature);
const moved = [];
before.forEach((sig, index) => {
  if (sig !== after[index]) moved.push(`#${targets[index].id} ${targets[index].name}: ${PREDICATES.join('/')} ${sig} → ${after[index]}`);
});

console.log(`\nπροβλέψεις πρόσβασης που άλλαξαν: ${moved.length}`);
moved.slice(0, 20).forEach(line => console.log(`  ${line}`));

if (moved.length) {
  console.error('\nΔΕΝ ΓΡΑΦΤΗΚΕ ΤΙΠΟΤΑ — το σβήσιμο άλλαξε συμπεριφορά, όχι μόνο κείμενο.');
  process.exit(1);
}

if (!write) {
  console.log('\nDry run. Ξανατρέξε με --write για να γραφτεί, μετά: npm run build:beach-data');
  process.exit(0);
}

const tmp = `${sourcePath}.tmp`;
writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
renameSync(tmp, sourcePath);
console.log(`\nΓΡΑΦΤΗΚΕ: ${targets.length} σημειώματα καθαρίστηκαν, καμία πρόβλεψη πρόσβασης δεν κουνήθηκε.`);
