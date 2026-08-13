// Second corrective pass for the Paros + Naxos audit — the two calls left open on 13/08.
//
//   node scripts/fixParosNaxosAudit2.mjs --dry
//   node scripts/fixParosNaxosAudit2.mjs
//
// Both were left open because the sources disagreed. Measuring the actual OSM geometry, rather
// than comparing single points, settled them.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'public', 'greek_beaches.json');
const DRY = process.argv.includes('--dry');

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const cyclades = data['South Aegean']['Cyclades'];
const find = (island, id) => {
  const beach = (cyclades[island] || []).find((b) => b.id === id);
  if (!beach) throw new Error(`#${id} not found in ${island}`);
  return beach;
};
const addSourceNote = (beach, note) => {
  const existing = beach.metadata.sourceNotes;
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  list.push(`Paros/Naxos audit 2026-08-14: ${note}`);
  beach.metadata.sourceNotes = list;
};

const changes = [];

// ---------------------------------------------------------------------------
// 1. Κριός ↔ Μαρτσέλο — 51 m apart, indistinguishable on the map.
//
// Comparing single points could not settle which pin was wrong, so the fix came from the
// SHAPE of the beach instead. OSM way/271733594 ("MARTSELO BEACH") is 26 nodes spanning
// 399 m, from 37.09679,25.13963 in the west to 37.09597,25.14401 in the east. Measured
// against that:
//   • our Κριός pin (37.09699,25.14200) lies 211 m from the east end and 212 m from the
//     west end — dead centre of the polygon, which is also exactly where Google resolves
//     «Παραλία Κριός» (primaryType `beach`, distM 0 from our pin).
//   • Google's «Marcelo Beach» (an establishment, not a beach type) sits 37 m from the
//     WEST end of that same polygon.
// So the two names describe two ends of one 400 m shore. Κριός is already on its correct,
// Google-confirmed point; Μαρτσέλο is the one sitting on top of it and belongs at the west
// end. Moving it separates them by ~230 m, each on evidence rather than on each other.
{
  const b = find('Paros', 2037);
  b.lat = 37.09679;
  b.lon = 25.13963;
  addSourceNote(b, 'pin moved from 37.09655,25.14182 to the WEST end of the OSM beach polygon (way/271733594, 399 m long), 37 m from where Google resolves «Marcelo Beach». It previously sat 51 m from #2031 Κριός, which Google places at the polygon\'s centre — the two cards were pointing at the same sand. They are now ~230 m apart, one at each end of the shore.');
  changes.push('#2037 Μαρτσέλο: πινέζα 37.09655,25.14182 → 37.09679,25.13963 (δυτικό άκρο του πολυγώνου· 51 m → ~230 m από τον Κριό)');
}

// ---------------------------------------------------------------------------
// 2. Κάμπος (Νάξος) — I was ready to call this "probably not a beach" and propose deleting
// the page. Measuring killed that idea: the pin is 84 m from the OSM coastline
// (nearest point 37.16467,25.47615). It is genuinely on the shore; what it is NOT is inside
// a tagged `natural=beach` polygon — the nearest of those is 760 m away.
//
// That is the same gap that hid seven real beaches from us on these two islands, so absence
// of an OSM beach tag is not evidence of absence of a beach. The record stays. What stays
// too is the honest low confidence: no source describes the shore here, so we do not say
// whether it is sand, pebble or rock.
{
  const b = find('Naxos', 1996);
  addSourceNote(b, 'pin re-measured: 84 m from the OSM coastline (nearest point 37.16467,25.47615), i.e. genuinely on the shore — the earlier "760 m from any beach" figure was distance to the nearest TAGGED natural=beach polygon, and OSM leaves plenty of real Greek beaches untagged. Deletion rejected on that evidence. Confidence stays low because no source describes the shore itself; the name matches the Κάμπος settlement 780 m inland.');
  changes.push('#1996 Κάμπος: ΔΕΝ διαγράφεται — μετρήθηκε 84 m από την ακτογραμμή· μένει low confidence');
}

console.log(`\n${changes.length} αλλαγές${DRY ? ' (DRY RUN)' : ''}:\n`);
for (const c of changes) console.log('  • ' + c);
if (!DRY) {
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('\nΓράφτηκε public/greek_beaches.json');
}
