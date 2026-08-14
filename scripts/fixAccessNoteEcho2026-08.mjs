// Rethymno recheck round, 2026-08-14 — access.notes that echo the card, plus two evidenced
// food amenities.
//
//   node scripts/fixAccessNoteEcho2026-08.mjs          # dry run (prints before/after)
//   node scripts/fixAccessNoteEcho2026-08.mjs --write
//
// Why these four groups and not "rewrite the text":
//   `metadata.access.notes` is printed VERBATIM, Greek only (components/BeachCard.tsx:2354),
//   directly under the access chip that already renders `access.label`. So a note that repeats
//   the label, or repeats `organized`/`shade`/`terrain`, is the same fact twice — and when it
//   repeats them WRONG it is a visible contradiction on one card. Per the 34-Chania and
//   21-south-Crete precedents (docs/team/05-data-engineer-beaches.md §5): robot copy is fixed
//   with LESS text, never with more, because inventing per-beach prose is exactly what put a
//   Schinias description on Cretan beaches.
//
// Safety check done before every deletion: utils/access.ts:14-29 scans type+label+notes for
// dirt-road keywords (χωματοδρομ|dirt road|gravel road|unpaved|sterrato|piste). Every record
// touched here keeps its verdict from `access.type` alone, so clearing `notes` moves no beach
// between access classes. Notes are set to "" and never deleted: scripts/buildBeachRegionData.mjs
// `isBeachMetadata` requires a string and drops the whole metadata object otherwise.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-08-14';

// 1. "Πρόσβαση: <label>. Έδαφος/ακτή: βράχια, βότσαλο. …ελεύθερη/ανοργάνωτη. …σκιά περιορισμένη."
//    Sentence 1 = access.label verbatim · 2 = terrain · 3 = organized · 4 = shade. All four are
//    already on the card from the structured fields — and 5 of the 12 carriers are sand, not
//    "βράχια, βότσαλο", while #692 is organized WITH shade and sunbeds. Nothing survives.
const BOILERPLATE = 'Πρόσβαση: εύκολο μονοπάτι ή σκαλιά. Έδαφος/ακτή: βράχια, βότσαλο. Η παραλία είναι κυρίως ελεύθερη/ανοργάνωτη. Η φυσική σκιά είναι περιορισμένη, οπότε χρειάζεται ομπρέλα.';

// 2. Internal QA process text in ENGLISH, shown verbatim to Greek visitors. #699 is the worst:
//    a Rethymno beach carrying a note that opens "First-pass Chania audit". What it actually
//    says ("verify before marking high confidence") is already carried by confidence/needsVerification.
const FIRST_PASS = /^First-pass .+ audit:/i;

// 3. "Πρόσβαση με άσφαλτο." directly under a chip reading "άσφαλτος μέχρι κοντά στην παραλία".
//    15 of these predate the 2026-08-14 Heraklion pass; the other 7 were written by it as the
//    minimal safe replacement for the Schinias text. Same fact, twice, in two wordings.
const ASPHALT_ECHO = 'Πρόσβαση με άσφαλτο.';

// 4. Food evidence from the region amenity sweep (OSM only, no Places billing). Named POIs, per
//    the under-claim mandate: a single unnamed node would not qualify.
const FOOD = new Map([
  [699, 'Καντίνα του Μανώλη «Peristeres Beach» (restaurant) στα 87 m — ονομάζει την ίδια την παραλία'],
  [687, '«Pavlos» (restaurant) στα 124 m'],
]);
const FOOD_AMENITY = 'ταβέρνα κοντά';

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));

const appendSourceNote = (m, line) => {
  if (!Array.isArray(m.sourceNotes)) m.sourceNotes = [];
  m.sourceNotes.push(line);
};

const changes = { boilerplate: [], firstPass: [], asphaltEcho: [], food: [] };

const walk = (node) => {
  if (Array.isArray(node)) { for (const item of node) walk(item); return; }
  if (!node || typeof node !== 'object') return;

  const m = node.metadata;
  const access = m?.access;
  if (access && node.id != null) {
    const notes = String(access.notes || '').trim();
    const label = String(access.label || '');
    const name = node.name?.gr || node.name;

    if (notes === BOILERPLATE) {
      const terrain = (m.terrain?.types || []).join(',');
      appendSourceNote(m, `Access notes cleared ${STAMP}: the text repeated access.label ("${label}"), then restated terrain/organized/shade, all of which the card already renders from the structured fields — and it described "βράχια, βότσαλο" on terrain=${terrain}, organized=${m.organized}, shade=${m.shade}. Removed text: "${BOILERPLATE}" Access type and label were not changed.`);
      access.notes = '';
      changes.boilerplate.push({ id: node.id, name, terrain, organized: m.organized, shade: m.shade });
    } else if (FIRST_PASS.test(notes)) {
      appendSourceNote(m, `Access notes cleared ${STAMP}: internal first-pass audit text in English was printed verbatim on the Greek card. Its content ("verify before marking high confidence") is already carried by metadata.confidence / needsVerification, and access.type=${access.type} keeps the access class unchanged. Removed text: "${notes}"`);
      access.notes = '';
      changes.firstPass.push({ id: node.id, name, removed: notes.slice(0, 60) });
    } else if (notes === ASPHALT_ECHO && label) {
      appendSourceNote(m, `Access notes cleared ${STAMP}: the note said "${ASPHALT_ECHO}" immediately under the access chip "${label}" — the same fact twice. The label keeps the information.`);
      access.notes = '';
      changes.asphaltEcho.push({ id: node.id, name, label });
    }
  }

  if (m && node.id != null && FOOD.has(node.id)) {
    const amenities = Array.isArray(m.amenities) ? m.amenities : (m.amenities = []);
    if (!amenities.some(a => String(a).includes('ταβέρνα') || String(a).includes('καντίνα'))) {
      amenities.push(FOOD_AMENITY);
      appendSourceNote(m, `Food-nearby ${STAMP} (OSM, no API): ${FOOD.get(node.id)}, while the record claimed no food at all. Added "${FOOD_AMENITY}" only — organized/beach-bar untouched.`);
      changes.food.push({ id: node.id, name: node.name?.gr || node.name, why: FOOD.get(node.id) });
    }
  }

  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
};

walk(data);

const show = (title, list, fmt) => {
  console.log(`\n== ${title}: ${list.length} ==`);
  for (const row of list) console.log('  ' + fmt(row));
};
show('Boilerplate «μονοπάτι/βράχια/ανοργάνωτη/σκιά» → ""', changes.boilerplate,
  r => `#${r.id} ${r.name} (terrain=${r.terrain || '—'}, organized=${r.organized}, shade=${r.shade})`);
show('«First-pass … audit» (αγγλικά στην ελληνική κάρτα) → ""', changes.firstPass,
  r => `#${r.id} ${r.name} :: ${r.removed}…`);
show('«Πρόσβαση με άσφαλτο.» κάτω από την ίδια ετικέτα → ""', changes.asphaltEcho,
  r => `#${r.id} ${r.name} (label="${r.label}")`);
show('Παροχή «ταβέρνα κοντά»', changes.food, r => `#${r.id} ${r.name} :: ${r.why}`);

if (!write) { console.log('\nDRY RUN — τρέξε ξανά με --write'); process.exit(0); }
writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('\nΓράφτηκε public/greek_beaches.json');
