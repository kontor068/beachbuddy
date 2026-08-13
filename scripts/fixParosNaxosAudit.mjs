// One-off corrective pass for the Paros + Naxos audit of 13/08/2026.
// See docs/team/AUDIT-paros-naxos-2026-08-13.md for the evidence behind every change.
//
//   node scripts/fixParosNaxosAudit.mjs --dry     # print the diff, write nothing
//   node scripts/fixParosNaxosAudit.mjs           # apply to public/greek_beaches.json
//
// Every edit below is backed by a named source that was checked, not by inference:
//   • reports/place-resolution/google-upgrade.json  — the resolved Google place per beach,
//     its coordinates and the distance from our pin (this is what exposed the borrowed
//     placeIds: two beaches resolving to ONE place, one of them >1 km away).
//   • OpenStreetMap relation/way/node geometry, queried live via Overpass.
//   • The beach's own sourceNotes (a shade claim with no source is dropped, never inverted:
//     `metadata.shade` renders only when true, so false = "we don't claim it", not "no shade").
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

const changes = [];
const log = (id, name, what) => changes.push(`#${id} ${name}: ${what}`);

const AUDIT_NOTE = 'Paros/Naxos audit 2026-08-13';

// sourceNotes is an array on most records but a bare string on a few older ones.
const addSourceNote = (beach, note) => {
  const existing = beach.metadata.sourceNotes;
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  list.push(`${AUDIT_NOTE}: ${note}`);
  beach.metadata.sourceNotes = list;
};

// A borrowed placeId sends "Directions" to another beach. Coordinate routing is always
// honest: it opens the map at OUR pin. Dropping the popularity block with it matters just
// as much — a rating copied from the neighbour is a claim about a place the visitor is
// not going to.
const routeByCoordinates = (beach, why) => {
  const nav = beach.metadata.googleMapsNavigation || {};
  delete nav.placeId;
  nav.mode = 'coordinates';
  nav.status = 'verified';
  nav.checkedAt = '2026-08-13';
  nav.method = 'paros-naxos-audit-2026-08-13';
  beach.metadata.googleMapsNavigation = nav;
  delete beach.metadata.popularity;
  addSourceNote(beach, why);
};

// ---------------------------------------------------------------------------
// A. Wrong navigation targets and pins the visitor actually hits
// ---------------------------------------------------------------------------

// A1 — «Χρυσή Ακτή» sat on the Αγκάλη node, 0 m from #2043, so the map drew two pins on one
// point. OSM relation/453222 "Golden Beach" centres the real 700 m beach at 37.00994,25.23940
// (Nominatim independently returns 37.00978,25.23750 for "Golden Beach, Paros").
{
  const b = find('Paros', 2056);
  b.lat = 37.00994;
  b.lon = 25.2394;
  addSourceNote(b, 'pin moved from the Αγκάλη node (37.010658,25.240516) to the centre of the Golden Beach polygon (OSM relation/453222, 37.00994,25.23940), corroborated by Nominatim. It previously sat 0 m from #2043 and drew two pins on one point.');
  log(2056, b.name, 'pin 37.010658,25.240516 → 37.00994,25.2394 (OSM relation/453222)');
}

// A2 — «Παραλία Αγκάλη Χρυσής Ακτής» keeps its own OSM node coordinate but must stop
// borrowing Χρυσή Ακτή's Google place (and its 4,5/187 rating).
{
  const b = find('Paros', 2043);
  routeByCoordinates(b, 'placeId ChIJV8r9unltmBQRE7DMZ5Jvgsg belongs to «Παραλία Χρυσή Ακτή» (#2056) — the same place resolved for both records (google-upgrade.json). Switched to coordinate routing on its own OSM node (node/2407941530) and dropped the borrowed 4,5/187 rating.');
  log(2043, b.name, 'coordinate routing, borrowed Χρυσή Ακτή placeId + rating removed');
}

// A3 — «Ναυτικός όμιλος Πάρου» routed to Marcelo Beach 1.420 m away. google-upgrade.json
// recorded distM:1420 and still left currentlyPlaceRouted:true.
{
  const b = find('Paros', 2041);
  routeByCoordinates(b, 'placeId ChIJbbhTsqlxmBQRSKKzRSECf2Y is «Marcelo Beach» (#2037), 1.420 m away — google-upgrade.json logged distM:1420 while still place-routing. Switched to coordinate routing and dropped the 4,1/576 rating, which is Μαρτσέλο’s.');
  log(2041, b.name, 'coordinate routing, Μαρτσέλο placeId + rating removed (nav was 1,42 km off)');
}

// A4 — «Κλειδός» borrowed «Παραλία Κλειδώ»'s place. OSM maps them as two separate polygons
// (way/404481267 and way/1157948744), so both records stay; only the borrowed identity goes.
{
  const b = find('Naxos', 1999);
  routeByCoordinates(b, 'placeId ChIJDy-QhX0EmBQRenTLBEstyZ4 resolves to «Παραλία Κλειδώ» (#2000, 45 m from its own pin) 383 m away. OSM keeps them as two polygons (way/404481267 vs way/1157948744), so the record stays — the borrowed place and its 4,2/15 rating do not.');
  log(1999, b.name, 'coordinate routing, Κλειδώ placeId + rating removed');
}

// A5 — «Κάμπος» resolved to "Mikra Bay" 754 m away, which is #2005's own place, and its pin
// is 760 m from the nearest mapped beach of any kind (Overpass, 1,5 km radius).
{
  const b = find('Naxos', 1996);
  routeByCoordinates(b, 'placeId ChIJ16MPVNanohQRZ7U2svHoJzI resolves to «Mikra Bay», which is #2005 Μικρά’s own place, 754 m away. The pin is also 760 m from the nearest mapped beach polygon of any kind (Overpass 1,5 km). Identity unverified — routing by coordinates and confidence downgraded until someone confirms a beach exists here.');
  b.metadata.confidence = 'low';
  b.metadata.shade = false;
  log(1996, b.name, 'coordinate routing, Μικρά placeId + rating removed, confidence high → low, unsupported shade dropped');
}

// A6 — «Μικρό Αλυκό» has its own (correct) place «Παραλία, Μικρολίμανο», but its popularity
// block is a byte-for-byte copy of Αλυκό's 4,6/1135. An obscure cove does not share a rating
// count with the island's famous dune beach; the number belongs to #1987.
{
  const b = find('Naxos', 2008);
  delete b.metadata.popularity;
  addSourceNote(b, 'popularity 4,6/1135 was identical to #1987 Αλυκό while the two records resolve to different Google places (ChIJLZLuafoRmBQR-nKbZ0SswTE vs ChIJJcnPsP0RmBQRJ_anR1gu33Y). The rating count belongs to Αλυκό; removed rather than guessed.');
  log(2008, b.name, 'copied 4,6/1135 rating removed (belongs to #1987 Αλυκό)');
}

// ---------------------------------------------------------------------------
// B. Claims the data could not back
// ---------------------------------------------------------------------------

// B1 — organized:true with an empty amenity list promises a beach bar / sunbeds that no
// source supports. The house rule is to under-claim.
{
  const b = find('Naxos', 1991);
  b.metadata.organized = false;
  addSourceNote(b, 'organized:true with an empty amenities list — nothing on disk backs the claim (reverseAmenitySweep.mjs, organized-but-empty). Set to false per the under-claim rule.');
  log(1991, b.name, 'organized true → false (0 παροχές στήριζαν τον ισχυρισμό)');
}

// B2 — shade:true with no umbrella, no tree and nothing in sourceNotes. Kept where the
// source DOES say it (#2040 Μώλος: "tamarisk/juniper shade") or where sunbeds/umbrellas are
// listed (#2006 Μικρή Βίγλα, #2023 Αμπελάς).
for (const [island, id] of [['Paros', 2028], ['Naxos', 1989], ['Naxos', 1990], ['Naxos', 2005], ['Naxos', 2009]]) {
  const b = find(island, id);
  b.metadata.shade = false;
  addSourceNote(b, 'shade:true had no supporting signal — no umbrellas in amenities, no tree/tamarisk mention in any source note. Dropped rather than inverted: the card renders shade only when true, so this removes a claim instead of adding the opposite one. It also stopped the beach matching a "needs shade" family search it could not satisfy.');
  log(id, b.name, 'shade true → false (καμία ένδειξη σκιάς σε καμία πηγή)');
}

// B3 — tavernas standing ON the sand that our amenity list never mentioned. Only the two
// with a named business inside 60 m are applied; «Γρόττα» (Labyrinth bar, 161 m) is not on
// the beach and stays out.
{
  const b = find('Naxos', 2003);
  if (!b.metadata.amenities.includes('ταβέρνα πάνω στην παραλία')) {
    b.metadata.amenities.unshift('ταβέρνα πάνω στην παραλία');
    addSourceNote(b, 'named taverna «Ntoyzenia» sits 58 m from the pin, on the beach itself (google-nearby cache) — the list only said "ταβέρνες κοντά".');
    log(2003, b.name, '+ ταβέρνα πάνω στην παραλία (Ntoyzenia, 58 m)');
  }
}
{
  const b = find('Naxos', 2009);
  if (!b.metadata.amenities.includes('ταβέρνα πάνω στην παραλία')) {
    b.metadata.amenities.unshift('ταβέρνα πάνω στην παραλία');
    addSourceNote(b, 'named restaurant «Sea you soon» sits 23 m from the pin, on the beach itself (google-nearby cache) — the list only said "ταβέρνες κοντά".');
    log(2009, b.name, '+ ταβέρνα πάνω στην παραλία (Sea you soon, 23 m)');
  }
}

// ---------------------------------------------------------------------------
// E. Names a Greek reader trips over
// ---------------------------------------------------------------------------
// The slug, and therefore the page URL, is transliterated from `name` — so the misspelling
// has to be corrected together with the slug it used to live at, or every existing link to
// /…/3072-paralia-monatiri/ dies. `legacySlugs` keeps the old address resolving.
{
  const b = find('Antiparos', 3072);
  b.name = 'Παραλία Μοναστήρι';
  b.legacySlugs = Array.from(new Set([...(b.legacySlugs || []), 'paralia-monatiri']));
  addSourceNote(b, 'spelling: «Μονατήρι» → «Μοναστήρι». The old slug paralia-monatiri is kept in legacySlugs so the existing URL still resolves.');
  log(3072, b.name, 'ορθογραφικό «Μονατήρι» → «Μοναστήρι» (η παλιά διεύθυνση συνεχίζει να δουλεύει)');
}
// `nameGr` overrides the Greek label ONLY — englishName, the slug and every prerendered URL
// keep deriving from `name`. "Hawaii" is the beach's real English name, so it stays there
// and only the Greek list stops showing a Latin word among Greek ones.
{
  const b = find('Naxos', 2019);
  b.nameGr = 'Χαβάη';
  addSourceNote(b, 'Greek display name «Χαβάη» added via nameGr so the Greek list stops showing a Latin name; the English name, slug and URL stay «Hawaii».');
  log(2019, `${b.name} → ${b.nameGr}`, 'ελληνικό όνομα «Χαβάη» (η διεύθυνση δεν αλλάζει)');
}

// ---------------------------------------------------------------------------
console.log(`\n${changes.length} αλλαγές${DRY ? ' (DRY RUN — δεν γράφτηκε τίποτα)' : ''}:\n`);
for (const c of changes) console.log('  • ' + c);

if (!DRY) {
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nΓράφτηκε ${path.relative(rootDir, dataPath)}`);
}
