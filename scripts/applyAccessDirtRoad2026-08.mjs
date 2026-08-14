// Honest access downgrade, 14/08/2026 — asphalt_road → passable_dirt_road for two beaches the
// August 6-region recheck showed are reached by a track, not by pavement.
//
// Evidence (scripts/auditAccessRoadProximity.mjs, reports/access-road-proximity/recheck-2026-08-*):
//   #215  Γαλατάκι (Εύβοια)  — nearest paved road 1.129 m, OSM track 156 m, footpath 238 m
//   #1339 Λαγκάδα (Λέσβος)   — nearest paved road 307 m,   OSM track 125 m
// Both are unorganized and carry no parking amenity, so the "OSM merely lacks the road tag"
// exemption that cleared the other 28 suspects does not apply to them.
//
// metadata.access.notes is shown VERBATIM on the Greek card (components/BeachCard.tsx:2292),
// so the note is rewritten too — leaving "εύκολα προσβάσιμο" under a dirt-road label would make
// the card contradict itself. Provenance goes to metadata.sourceNotes, which is internal.
//
//   node scripts/applyAccessDirtRoad2026-08.mjs           # dry run
//   node scripts/applyAccessDirtRoad2026-08.mjs --write   # persist
// Reverse by setting access.type back to 'asphalt_road' with the label/notes quoted below.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-08-14';

const TARGET = new Map([
  [215, {
    was: { type: 'asphalt_road', label: 'άσφαλτος μέχρι κοντά στην παραλία' },
    label: 'χωματόδρομος το τελευταίο κομμάτι',
    notes: 'Η άσφαλτος σταματά περίπου ένα χιλιόμετρο πριν από την παραλία· το τελευταίο κομμάτι είναι χωματόδρομος.',
    evidence: 'άσφαλτος 1.129 m, χωματόδρομος 156 m, μονοπάτι 238 m',
  }],
  // Added 14/08 with the Heraklion pass. Same test as #215: unorganized, no parking amenity, and
  // OSM is demonstrably not blind here — it has the track at 86 m, it just puts the pavement at
  // 562 m. Its old notes were also foreign text (the Σχινιάς paragraph, see
  // scripts/fixContaminatedAccessNotes2026-08.mjs), so nothing true is lost by replacing them.
  [661, {
    was: { type: 'asphalt_road', label: 'άσφαλτος μέχρι κοντά στην παραλία' },
    label: 'χωματόδρομος το τελευταίο κομμάτι',
    notes: 'Η άσφαλτος σταματά αρκετά πριν από την παραλία· το τελευταίο κομμάτι είναι χωματόδρομος. Ελεύθερη, ανοργάνωτη παραλία με χοντρή άμμο και βότσαλο.',
    evidence: 'άσφαλτος 562 m, χωματόδρομος 86 m',
  }],
]);
// #1339 Λαγκάδα (Λέσβος) was the second candidate and is deliberately NOT downgraded: its own
// sourceNotes cite LesvosPost on the NEW asphalt Taxiarchis-Lagkadas road to the beach, which is
// exactly the "OSM has not mapped it yet" case (paved road measured 307 m away). A named local
// source beats an OSM gap.

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));
// Keep the shape sourceNotes already has: collapsing an array of provenance entries into one
// string would rewrite history that other passes appended entry by entry.
const appendSourceNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = (m.sourceNotes ? m.sourceNotes + ' ' : '') + line;
};

const applied = [];
const skipped = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const item of node) walk(item); return; }
  if (!node || typeof node !== 'object') return;
  const plan = TARGET.get(node.id);
  const access = node.metadata?.access;
  if (plan && access) {
    // Identity guard: only downgrade if the record still says what the audit measured.
    if (access.type !== plan.was.type) {
      skipped.push({ id: node.id, why: `type is already "${access.type}"` });
    } else {
      const before = { type: access.type, label: access.label, notes: access.notes };
      access.type = 'passable_dirt_road';
      access.label = plan.label;
      access.notes = plan.notes;
      appendSourceNote(node.metadata, `Access downgrade ${STAMP} (OSM, no API): claimed asphalt but ${plan.evidence}; unorganized and no parking amenity, so the missing-road-tag exemption does not apply. Was type=${before.type}, label="${before.label}", notes="${before.notes}".`);
      applied.push({ id: node.id, name: node.name?.gr || node.name, before, after: { type: access.type, label: access.label, notes: access.notes } });
    }
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(data);

for (const row of applied) {
  console.log(`#${row.id} ${row.name}`);
  console.log(`   ΠΡΙΝ:  ${row.before.type} | ${row.before.label}`);
  console.log(`          ${row.before.notes}`);
  console.log(`   ΤΩΡΑ:  ${row.after.type} | ${row.after.label}`);
  console.log(`          ${row.after.notes}`);
}
for (const row of skipped) console.log(`#${row.id} παραλείφθηκε — ${row.why}`);

if (!applied.length) { console.log('Καμία αλλαγή.'); process.exit(0); }
if (write) {
  writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nΓράφτηκε ${path.relative(rootDir, sourcePath)} (${applied.length}). Τρέξε npm run build:beach-data.`);
} else {
  console.log(`\nDry run — ${applied.length} αλλαγές. Ξανατρέξε με --write.`);
}
