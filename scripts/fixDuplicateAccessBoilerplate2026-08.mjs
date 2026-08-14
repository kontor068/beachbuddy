// Drops access notes that only repeat the chip above them, 14/08/2026 — no API, dry-run by default.
//
// 34 Chania beaches (ids 531-609, one import batch) carry the identical access.notes:
//   "άσφαλτος μέχρι κοντά στην παραλία. Επιβεβαιώθηκε από direct source για τη συγκεκριμένη παραλία."
// while their access.label is "άσφαλτος μέχρι κοντά στην παραλία" — word for word the first
// sentence. components/BeachCard.tsx renders the label as a chip AND the notes as a paragraph
// underneath (line 2354, Greek only), so a Greek visitor reads the same sentence twice.
//
// The second sentence is NOT a lie — checked before touching anything: all 34 carry their own
// per-beach sourceUrls (a dedicated cretanbeaches.com page each), so "confirmed by a direct source
// for this specific beach" is true of every one of them. It is simply not information ABOUT the
// beach: it describes our process, repeated verbatim 34 times. That is the duplicate-robot-copy
// rule — say something comparative or say nothing.
//
// Behaviourally inert, and that was verified rather than assumed: utils/access.ts decides dirt-road
// and easy-access from access.type/label plus a keyword scan over the combined access text, and
// none of these 34 contains a dirt-road keyword in ANY of those fields. Emptying notes therefore
// cannot flip hasDirtRoadAccess or hasTrulyEasyAccess. The surviving label keeps the useful fact.
//
// Empty string, NOT delete: isBeachMetadata (scripts/buildBeachRegionData.mjs:853) requires
// access.notes to be a string, and dropping the key voids the whole metadata object and stops the
// build. makeBeachNarrative already maps a falsy value to accessNotes: undefined, and BeachCard
// skips the paragraph on a falsy value, so "" is the clean way to render nothing.
//
//   node scripts/fixDuplicateAccessBoilerplate2026-08.mjs           # dry run
//   node scripts/fixDuplicateAccessBoilerplate2026-08.mjs --write   # persist, then npm run build:beach-data
// Reverse from the sourceNotes entry, which quotes the removed text in full.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-08-14';

// Each group is one shared paragraph plus the conditions under which clearing it removes a
// duplicate rather than information. Re-running is safe: a cleared record no longer matches.
const GROUPS = [
  {
    text: 'άσφαλτος μέχρι κοντά στην παραλία. Επιβεβαιώθηκε από direct source για τη συγκεκριμένη παραλία.',
    label: 'άσφαλτος μέχρι κοντά στην παραλία',
    type: 'asphalt_road',
    requireSourceUrls: true,
    note: 'the text repeated access.label verbatim and then described our verification process ("Επιβεβαιώθηκε από direct source…"), identically on 34 Chania records. The claim itself was true — this beach has its own sourceUrls — but it says nothing about the beach, and the card printed the same sentence twice.',
  },
  {
    // 21 south-Crete beaches (Heraklion + Rethymno). Every clause was checked separately:
    //   "Πρόσβαση από μικρό βατό χωματόδρομο" → access.label is already "βατός χωματόδρομος".
    //   "άμεση προσέγγιση στον κολπίσκο"      → UNSUPPORTED. public/data/geospatial/exposure
    //      measures 4-5 of 8 sectors blocked on all 21, i.e. the landward half — what any straight
    //      shoreline gives. Not one of them is the enclosed cove the word promises.
    //   "Φυσική, ανοργάνωτη παραλία"          → metadata.organized is already false and the card
    //      renders the amenity state on its own.
    // So there is nothing left to keep. Writing 21 individual descriptions was considered and
    // rejected: the records differ only in terrain (3 distinct values), and inventing the rest is
    // precisely how the Σχινιάς paragraph ended up on Cretan beaches.
    text: 'Πρόσβαση από μικρό βατό χωματόδρομο και μετά άμεση προσέγγιση στον κολπίσκο. Φυσική, ανοργάνωτη παραλία.',
    label: 'βατός χωματόδρομος',
    type: 'passable_dirt_road',
    requireSourceUrls: false,
    note: 'the text repeated access.label ("βατός χωματόδρομος"), duplicated the organized flag, and called every one of 21 south-Crete beaches a "κολπίσκος" — a claim the measured exposure geometry does not support (4-5 of 8 sectors blocked, i.e. the landward half of an ordinary shoreline).',
  },
];

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));

const appendSourceNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = (m.sourceNotes ? m.sourceNotes + ' ' : '') + line;
};

const cleared = [];
const skipped = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const item of node) walk(item); return; }
  if (!node || typeof node !== 'object') return;
  const access = node.metadata?.access;
  const notes = String(access?.notes || '').trim();
  const group = access && notes ? GROUPS.find(g => g.text === notes) : null;
  if (group) {
    // Guards, all of which must hold for "the card already says this" to be true. If a later pass
    // changes any of them the notes carry something the card does not, and removing them would
    // delete information instead of a duplicate.
    const label = String(access.label || '').trim();
    if (label !== group.label) {
      skipped.push({ id: node.id, name: node.name?.gr || node.name, why: `label είναι "${label}", δεν επαναλαμβάνεται` });
    } else if (access.type !== group.type) {
      skipped.push({ id: node.id, name: node.name?.gr || node.name, why: `type είναι "${access.type}", όχι ${group.type}` });
    } else if (group.requireSourceUrls && !(node.metadata.sourceUrls || []).length) {
      skipped.push({ id: node.id, name: node.name?.gr || node.name, why: 'χωρίς sourceUrls — η δήλωση ελέγχου δεν στηρίζεται, θέλει άνθρωπο' });
    } else {
      access.notes = '';
      appendSourceNote(node.metadata, `Access notes cleared ${STAMP}: ${group.note} Removed text: "${group.text}" Access type and label were not changed.`);
      cleared.push({ id: node.id, name: node.name?.gr || node.name });
    }
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(data);

for (const row of cleared) console.log(`  #${row.id} ${String(row.name).padEnd(24)} καθαρό (η ετικέτα το λέει ήδη)`);
for (const row of skipped) console.log(`  #${row.id} ${String(row.name).padEnd(24)} ΔΕΝ πειράχτηκε — ${row.why}`);
console.log(`\nΚαθαρίστηκαν: ${cleared.length}${skipped.length ? ` · αφέθηκαν: ${skipped.length}` : ''}`);

if (!cleared.length) { console.log('Καμία αλλαγή.'); process.exit(0); }
if (write) {
  writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Γράφτηκε ${path.relative(rootDir, sourcePath)}. Τρέξε npm run build:beach-data.`);
} else {
  console.log('Dry run — ξανατρέξε με --write.');
}
