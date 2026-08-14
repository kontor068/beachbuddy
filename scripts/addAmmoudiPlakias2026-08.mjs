// Add the missing Αμμούδι (Plakias, Rethymno) — 2026-08-14 region recheck.
//
//   node scripts/addAmmoudiPlakias2026-08.mjs [--write]
//
// Evidence (two independent sources, per the recheck protocol):
//   1. OSM way/175803326 `natural=beach name=Αμμούδι surface=gravel` @ 35.17076,24.42035 —
//      a DISTINCT polygon from way/175785563 «Μικρό Αμμούδι», which is our existing #688 and
//      whose pin matches that other polygon to ~5 m. So #688 is not this beach.
//   2. Our own #688 record cites cretanbeaches.com's "Ammoudi beaches Plakias" page and its
//      sourceNotes call #688 "Small Ammoudi/Ammoudaki **within the Ammoudi beach complex**" —
//      i.e. our own data already says the main beach of the complex exists and we lack it.
//   Corroboration on the ground (Overpass, no paid API): «Amoudi Hotel - Taverna» 35 m away and
//   two `amenity=shower` nodes at 9 m and 50 m — a serviced beach, not an empty cove.
//
// Deliberately conservative, per docs/team/PROMPT-deep-region-recheck.md §2β:
//   · terrain = pebbles only (OSM surface=gravel). No second source for sand, so none claimed.
//   · organized = false although showers + a taverna sit on it — "organized" here means an
//     umbrella/sunbed operation and nothing measured proves one. Under-claim.
//   · waterDepth = deep: the adjoining Ammoudaki (#688) is deep and the shore is gravel. Wrong
//     "deep" costs a family a beach; wrong "shallow" is a safety claim we cannot back.
//   · access asphalt_road: OSM has asphalt residential at 180 m, then steps — the label says the
//     steps out loud instead of promising a car ride to the sand.
//   · activities.surfing set explicitly — buildBeachRegionData invents a deterministic random
//     value when it is missing.
//   · orientation intentionally omitted: it is filled from the measured geospatial profile after
//     buildGeospatialExposureProfiles runs, never by eye (it drives wind exposure and colour).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));

const list = data?.Crete?.Rethymno?.['Crete (Rethymno)'];
if (!Array.isArray(list)) throw new Error('Δεν βρέθηκε ο πίνακας Crete/Rethymno/Crete (Rethymno)');

let maxId = -1;
(function walk(node) {
  if (Array.isArray(node)) { for (const item of node) if (item && item.id != null) maxId = Math.max(maxId, item.id); return; }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(data);

const NEW_ID = maxId + 1;
if (list.some(b => b.name === 'Αμμούδι')) { console.log('Υπάρχει ήδη — καμία αλλαγή.'); process.exit(0); }

const record = {
  id: NEW_ID,
  name: 'Αμμούδι',
  lat: 35.17076,
  lon: 24.42035,
  metadata: {
    access: {
      type: 'asphalt_road',
      label: 'άσφαλτος μέχρι κοντά, μετά σκαλιά',
      notes: '',
    },
    terrain: { types: ['pebbles'], label: 'βότσαλο' },
    organized: false,
    shade: false,
    amenities: ['ντους', 'ταβέρνα κοντά'],
    hasShower: true,
    confidence: 'medium',
    language: 'el',
    waterDepth: {
      type: 'deep',
      label: 'Βαθιά νερά',
      notes: 'Το βάθος συνήθως ανεβαίνει πιο γρήγορα μετά την είσοδο στη θάλασσα.',
    },
    activities: { surfing: false },
    googleMapsNavigation: { status: 'needs-review', mode: 'coordinates', checkedAt: '2026-08-14', method: 'osm-way-centroid' },
    needsVerification: true,
    sourceNotes: [
      'Added 2026-08-14 (Rethymno region recheck, OSM only — no paid API). Gap found by scripts/discoverHiddenBeaches.mjs: OSM way/175803326 "Αμμούδι" (natural=beach, surface=gravel) sits 242 m from our #688 «Μικρό Αμμούδι», whose own pin matches the separate way/175785563 «Μικρό Αμμούδι» — so the two are different beaches and only the small one was in the dataset. Corroborated by #688\'s own sourceNotes, which describe it as "Small Ammoudi/Ammoudaki within the Ammoudi beach complex" on the cretanbeaches.com Ammoudi/Plakias page.',
      'Services 2026-08-14 (Overpass, no API): "Amoudi Hotel - Taverna" (tourism=hotel) at 35 m and two amenity=shower nodes at 9 m and 50 m of the pin → ντους + ταβέρνα κοντά. organized left FALSE: showers and a taverna are not proof of a sunbed operation, and the under-claim rule applies. Terrain taken from OSM surface=gravel only. Access: nearest asphalt (highway=residential) 180 m, highway=steps 182 m, so the label promises asphalt-then-steps rather than a car ride to the sand. Orientation and wind exposure are left to the measured geospatial profile.',
    ],
    sourceUrls: [
      'https://www.openstreetmap.org/way/175803326',
      'https://www.cretanbeaches.com/en/sea-tourism/central-crete-beaches-rethymnon/ammoudi-beaches-plakias',
    ],
  },
};

const at = list.findIndex(b => b.name === 'Αμμόλοφοι Αγίου Παύλου');
if (at >= 0) list.splice(at + 1, 0, record); else list.push(record);

console.log(`Νέα παραλία #${NEW_ID} «${record.name}» @ ${record.lat},${record.lon} στο Crete/Rethymno (σύνολο ${list.length}).`);
console.log(JSON.stringify(record, null, 2).slice(0, 700) + '…');
if (!write) { console.log('\nDRY RUN — ξανά με --write'); process.exit(0); }
writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('\nΓράφτηκε public/greek_beaches.json');
