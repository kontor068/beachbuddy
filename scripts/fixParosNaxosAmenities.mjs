// Fills the amenity gap on Paros + Naxos from the one source nobody had asked yet: what
// OpenStreetMap actually maps around each pin.
//
//   node scripts/fixParosNaxosAmenities.mjs --dry
//   node scripts/fixParosNaxosAmenities.mjs
//
// Evidence: reports/amenity-evidence/paros-naxos-osm-sweep.json — for each of the 27 beaches
// whose amenity list was empty, every `amenity` / `shop` / `tourism` / `leisure=beach_resort`
// object OSM holds within 400-500 m of the pin, with its distance and its name.
//
// TWO different findings came out of it, and they need opposite treatment:
//
//   1. 21 beaches have NOTHING mapped within 500 m. Their empty list was not a data gap —
//      it was the truth, silently told. Silence reads as "we didn't look"; «χωρίς σταθερές
//      παροχές» reads as "we looked, bring your own water". Same fact, useful version.
//      Deliberately the softer of the two phrases already in the vocabulary («καμία
//      οργανωμένη παροχή» is the harder one): OSM missing a thing is not proof the thing is
//      absent — that exact lesson is what hid seven real beaches from us on these islands.
//
//   2. 4 beaches have real, NAMED businesses close by that we simply never recorded.
//      Applied only where the evidence is a named POI, and phrased by distance: a cluster
//      inside ~150 m earns «ταβέρνες κοντά», a lone restaurant at 379 m earns the singular.
//      #2040 Μώλος (one hotel at 393 m) and #3177 Στελίδα (one unnamed parking at 483 m) are
//      NOT applied — a single distant generic object is not a facility this beach offers.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'public', 'greek_beaches.json');
const DRY = process.argv.includes('--dry');

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const cyclades = data['South Aegean']['Cyclades'];
const byId = new Map();
for (const island of ['Paros', 'Naxos']) for (const b of cyclades[island] || []) byId.set(b.id, b);

const addSourceNote = (beach, note) => {
  const existing = beach.metadata.sourceNotes;
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  list.push(`Paros/Naxos amenity sweep 2026-08-14: ${note}`);
  beach.metadata.sourceNotes = list;
};

// --- 1. verified-empty ------------------------------------------------------
const VERIFIED_EMPTY = [
  2025, 2026, 2029, 2032, 2050, 2052, 2054, 3175,          // Paros
  1992, 1996, 1999, 2000, 2002, 2004, 2015, 2016, 2018,    // Naxos
  3172, 3173, 3174, 3178,                                  // Naxos (new)
];
const NOTHING = 'χωρίς σταθερές παροχές';

// --- 2. evidence found ------------------------------------------------------
const FOUND = {
  1991: {
    amenities: ['ταβέρνες κοντά', 'καφέ κοντά', 'παροχές οικισμού κοντά'],
    note: 'OSM maps a full cluster within 155 m of the pin: περίπτερο 87 m, «Στης Ειρήνης» 113 m, καφέ «Diogenes» 129 m, «Babylonia» 135 m, μπαρ 145 m, «Vassilis Tavern» 147 m, «Taverna Apostolis» 154 m. The list was empty.',
  },
  1994: {
    amenities: ['ταβέρνες κοντά', 'παροχές οικισμού κοντά'],
    note: 'OSM maps a full cluster within 165 m of the pin: «Kozi» 99 m, σούπερ μάρκετ «Pantelias» 110 m, φούρνος 112 m, «Metaxi mas» 125 m, «Ελληνική Διατροφή» 134 m, «Taverna Apostolis» 135 m. The list was empty.',
  },
  2022: {
    amenities: ['καταλύματα κοντά'],
    note: 'OSM maps six hotels/apartments between 179 m and 308 m (Cosme, Kalypso, Salt Suites, Parian, Aspasia Maria, Kosmitis) plus two restaurants at 377 m and 443 m. Only the accommodation is close enough to record; the restaurants stay out.',
  },
  2024: {
    amenities: ['ταβέρνα κοντά'],
    note: 'OSM maps one named restaurant, «To thalami», 379 m from the pin — the only thing within 500 m. Recorded in the singular, at that distance.',
  },
};

const changes = [];
for (const id of VERIFIED_EMPTY) {
  const b = byId.get(id);
  if (!b) { console.log(`  ! #${id} δεν βρέθηκε`); continue; }
  const list = b.metadata.amenities || [];
  if (list.length) { console.log(`  = #${id} ${b.name}: έχει ήδη παροχές, δεν πειράχτηκε`); continue; }
  b.metadata.amenities = [NOTHING];
  addSourceNote(b, 'Overpass found no amenity, shop, tourism or beach_resort object within 500 m of the pin. The empty list was correct but silent; replaced with the honest wording. Not proof of absence — OSM under-maps rural Greece — so the softer phrase was used.');
  changes.push(`#${id} ${b.name}: κενή λίστα → «${NOTHING}» (επιβεβαιωμένο: τίποτα σε 500 m)`);
}

for (const [idStr, spec] of Object.entries(FOUND)) {
  const b = byId.get(Number(idStr));
  if (!b) { console.log(`  ! #${idStr} δεν βρέθηκε`); continue; }
  const list = b.metadata.amenities || [];
  const added = spec.amenities.filter((a) => !list.includes(a));
  if (!added.length) { console.log(`  = #${idStr} ${b.name}: τα είχε ήδη`); continue; }
  b.metadata.amenities = [...list.filter((a) => a !== NOTHING), ...added];
  addSourceNote(b, spec.note);
  changes.push(`#${idStr} ${b.name}: + ${added.join(', ')}`);
}

console.log(`\n${changes.length} αλλαγές${DRY ? ' (DRY RUN)' : ''}:\n`);
for (const c of changes) console.log('  • ' + c);
if (!DRY) {
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('\nΓράφτηκε public/greek_beaches.json');
}
