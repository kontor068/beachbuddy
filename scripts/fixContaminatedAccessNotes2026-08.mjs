// Removes access notes that describe a DIFFERENT beach, 14/08/2026 — no API, dry-run by default.
//
// Found during the Heraklion pass: nine records share one identical access.notes paragraph that
// names Σχινιάς (Marathon, Attica) out loud and promises "αρμυρίκια και φυσική σκιά σε σημεία".
// Eight of the nine are Cretan beaches, which is where it cannot be true.
//
// The discriminator is NOT shade: false — all nine carry that, so it separates nothing. It is
// whether the beach's own amenities list independently mentions shade/tamarisks: #0 Παραλία
// Φλοίσβου does ("φυσική σκιά σε σημεία"), is in Attica, and its terrain really is ψιλό βότσαλο,
// so it is most likely where the paragraph came from. The eight Cretan records echo none of it.
// #0 is therefore left alone and flagged for a human rather than silently stripped.
//
// This matters because components/BeachCard.tsx:2354 renders metadata.access.notes VERBATIM for
// Greek visitors (other languages fall back to the localized access label, so they never saw it).
//
// The fix REPLACES the paragraph with the plain sentence the dataset already uses for an
// asphalt-access beach ("Πρόσβαση με άσφαλτο." — see #634 Καρτερός, #641 Κοκκίνη Χάνι). Nothing
// is invented: each record's own access.type is asphalt_road, and that is all the sentence says.
//
// Deleting the field instead — the obvious first move — is WRONG here and was tried first:
// isBeachMetadata (scripts/buildBeachRegionData.mjs:853) requires access.notes to be a string, so
// removing it makes parseBeachPayload drop the ENTIRE metadata object for that beach, and the
// build then refuses to invent organized/shade from an id hash. The July getDeterministicValue
// guard caught it loudly instead of shipping fabricated amenities, which is exactly its job.
//
//   node scripts/fixContaminatedAccessNotes2026-08.mjs           # dry run
//   node scripts/fixContaminatedAccessNotes2026-08.mjs --write   # persist, then npm run build:beach-data
// Reverse from the sourceNotes entry, which quotes the removed text in full.
//
// #661 Σκούρος is deliberately absent from the count: scripts/applyAccessDirtRoad2026-08.mjs
// already replaced its notes as part of the asphalt→dirt downgrade, so it no longer matches.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-08-14';

// Matched on the exact string, not a fuzzy pattern: this removes user-visible text, so it may
// only touch records that are provably the copy, never ones that merely read similarly.
const CONTAMINATED = 'Πρόσβαση: άσφαλτος μέχρι κοντά στην παραλία. Έδαφος/ακτή: κυρίως ψιλό βότσαλο. Η παραλία είναι ελεύθερη/ανοργάνωτη, σχετικά ήσυχη σε σχέση με τον Σχινιά, με αρμυρίκια και φυσική σκιά σε σημεία.';
const ORIGIN = 'μια παραλία της Αττικής (πιθανότατα #0 Παραλία Φλοίσβου)';

// Beware: id 0 is falsy, so the usual `if (beach.id)` filter drops Παραλία Φλοίσβου silently —
// that is exactly why the first count of this defect came back as 8 instead of 9. Compare with
// `!= null`, never with truthiness.
const KEEP = new Map([[0, 'πιθανή πηγή του κειμένου: Αττική, ψιλό βότσαλο, και οι παροχές του λένε «φυσική σκιά σε σημεία»']]);

// The eight Cretan carriers. Listed explicitly so a re-run after a partial write still converges:
// the first version of this script deleted the field, so some records now have no notes at all and
// no longer match CONTAMINATED. #661 Σκούρος is absent — applyAccessDirtRoad2026-08.mjs owns it.
const CRETAN_CARRIERS = new Set([651, 669, 671, 684, 702, 712, 714]);
const REPLACEMENT = 'Πρόσβαση με άσφαλτο.';

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));

// Keep the shape sourceNotes already has: collapsing an array of provenance entries into one
// string would rewrite history that other passes appended entry by entry.
const appendSourceNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = (m.sourceNotes ? m.sourceNotes + ' ' : '') + line;
};

const cleaned = [];
const kept = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const item of node) walk(item); return; }
  if (!node || typeof node !== 'object') return;
  const access = node.metadata?.access;
  if (access && node.id != null && KEEP.has(node.id) && String(access.notes || '').trim() === CONTAMINATED) {
    kept.push({ id: node.id, name: node.name?.gr || node.name, why: KEEP.get(node.id) });
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
    return;
  }
  const isCarrier = access && node.id != null && CRETAN_CARRIERS.has(node.id)
    && (String(access.notes || '').trim() === CONTAMINATED || access.notes == null);
  if (isCarrier) {
    // Only asphalt records get the asphalt sentence. If a later pass changes the type, this
    // stops rather than writing a sentence that contradicts the chip next to it.
    if (access.type !== 'asphalt_road') {
      kept.push({ id: node.id, name: node.name?.gr || node.name, why: `type είναι "${access.type}", όχι asphalt_road — θέλει άνθρωπο` });
    } else {
      access.notes = REPLACEMENT;
      appendSourceNote(node.metadata, `Access notes replaced ${STAMP}: the previous paragraph described ${ORIGIN}, not this beach — it named Σχινιάς and promised tamarisk shade, and 8 Cretan records carried it verbatim. Replaced with "${REPLACEMENT}", which states only this record's own access.type. Removed text: "${CONTAMINATED}" Access type and label were not changed.`);
      cleaned.push({ id: node.id, name: node.name?.gr || node.name, type: access.type });
    }
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(data);

for (const row of cleaned) console.log(`  #${row.id} ${String(row.name).padEnd(28)} διορθώθηκε (πρόσβαση παραμένει: ${row.type})`);
for (const row of kept) console.log(`  #${row.id} ${String(row.name).padEnd(28)} ΔΕΝ πειράχτηκε — ${row.why}`);
console.log(`\nΠαραλίες με ξένο κείμενο: ${cleaned.length}${kept.length ? ` · αφέθηκαν για άνθρωπο: ${kept.length}` : ''}`);

if (!cleaned.length) { console.log('Καμία αλλαγή.'); process.exit(0); }
if (write) {
  writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Γράφτηκε ${path.relative(rootDir, sourcePath)}. Τρέξε npm run build:beach-data.`);
} else {
  console.log('Dry run — ξανατρέξε με --write.');
}
