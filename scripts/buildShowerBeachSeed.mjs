// Build an insert seed for beaches that HAVE a shower but are missing from our dataset.
//
//   node scripts/buildShowerBeachSeed.mjs
//
// Input:  reports/showers/uncovered-beaches-with-showers.json (from rescueOrphanShowers.mjs)
//         scripts/data/shower-orphan-rescue-raw.json          (the polygons themselves)
// Output: scripts/data/shower-beaches-seed.json  → feed to scripts/insertDiscoveredBeaches.mjs
//
// These are natural=beach polygons carrying one or more amenity=shower nodes, >2 km from any
// beach we list. They are UNNAMED in OSM, which is exactly why the name-gated coverage pipeline
// never surfaced them — an organized beach with 8 showers can be invisible to us. We name each
// from its nearest settlement via Nominatim reverse geocoding, slot it next to our nearest
// existing beach, and emit conservative metadata (organized + ντουζ are EVIDENCED by the shower
// nodes; access/terrain stay unknown unless OSM tags say otherwise). Every row goes in as
// confidence:low + needsVerification via the insert script.
import { readFileSync, writeFileSync } from 'node:fs';
import { USER_AGENT, sleep } from './lib/placeResolution.mjs';

const MIN_LENGTH_M = 150;   // ignore degenerate/tiny polygons — we only add substantial beaches

const cands = JSON.parse(readFileSync(new URL('../reports/showers/uncovered-beaches-with-showers.json', import.meta.url), 'utf8'));
const raw = JSON.parse(readFileSync(new URL('./data/shower-orphan-rescue-raw.json', import.meta.url), 'utf8')).elements;
const data = JSON.parse(readFileSync(new URL('../public/greek_beaches.json', import.meta.url), 'utf8'));

const M = 111320, rad = Math.PI / 180;
const dm = (a, b) => Math.hypot((b.lat - a.lat) * M, (b.lon - a.lon) * M * Math.cos(a.lat * rad));

// index our beaches with their region path, so a new beach can be slotted beside its neighbour
const index = [];
for (const [region, sub] of Object.entries(data))
  for (const [subName, subSub] of Object.entries(sub))
    for (const [subSubName, arr] of Object.entries(subSub))
      if (Array.isArray(arr)) for (const b of arr) if (Number.isFinite(b.lat)) index.push({ lat: b.lat, lon: b.lon, region, subName, subSubName, name: b.name, id: b.id });

const ringsOf = (el) => Array.isArray(el.geometry) ? [el.geometry] : Array.isArray(el.members) ? el.members.filter(m => m.role !== 'inner' && Array.isArray(m.geometry)).map(m => m.geometry) : [];
const centroid = (rings) => { let x = 0, y = 0, n = 0; for (const r of rings) for (const p of r) { x += p.lon; y += p.lat; n++; } return n ? { lat: y / n, lon: x / n } : null; };

// OSM surface tag → our terrain vocabulary
const terrainOf = (tags) => {
  const s = String(tags.surface || tags.natural || '').toLowerCase();
  if (/fine_sand|sand/.test(s)) return { types: ['sand'], label: 'άμμος' };
  if (/pebble|gravel/.test(s)) return { types: ['pebbles'], label: 'βότσαλο' };
  if (/rock|stone/.test(s)) return { types: ['rocks'], label: 'βράχια' };
  return { types: ['sand', 'pebbles'], label: 'άμμος και βότσαλο' };
};

const reverse = async (lat, lon) => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1&zoom=14&accept-language=el`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(1500);
  }
  return null;
};

const rows = [];
const skipped = [];
for (const c of cands) {
  if ((c.approxLengthM || 0) < MIN_LENGTH_M) { skipped.push({ poly: c.poly, why: `too small (${c.approxLengthM}m)` }); continue; }
  const [t, id] = c.poly.split('/');
  const el = raw.find(e => e.type === t && String(e.id) === id);
  const rings = el ? ringsOf(el) : [];
  const ctr = rings.length ? centroid(rings) : c.coord;
  if (!ctr) { skipped.push({ poly: c.poly, why: 'no geometry' }); continue; }

  await sleep(1100); // Nominatim: ≤1 req/sec
  const rev = await reverse(ctr.lat, ctr.lon);
  const ad = rev?.address || {};
  const place = ad.village || ad.town || ad.hamlet || ad.suburb || ad.city || ad.municipality || ad.county || null;
  if (!place) { skipped.push({ poly: c.poly, why: 'no locality from reverse geocode' }); continue; }

  // nearest beach of ours → region slot
  let nb = null, nd = Infinity;
  for (const p of index) { const d = dm(ctr, p); if (d < nd) { nd = d; nb = p; } }
  if (!nb) { skipped.push({ poly: c.poly, why: 'no neighbour' }); continue; }

  const nameGr = c.name || `Παραλία ${place}`;
  rows.push({
    nameGr,
    lat: Number(ctr.lat.toFixed(5)),
    lon: Number(ctr.lon.toFixed(5)),
    region: nb.region,
    prefecture: nb.subName,
    municipality: nb.subSubName,
    coordSrc: `OSM ${c.poly} (κέντρο polygon)`,
    sourceNote: `Παραλία με ${c.showers} χαρτογραφημένο/α ντους (OSM amenity=shower) πάνω στο polygon, ~${c.approxLengthM}μ ακτή, κοντά σε ${place}. ΑΝΩΝΥΜΗ στο OSM — γι' αυτό δεν την έπιανε το coverage pipeline που ψάχνει με όνομα. Το όνομα προκύπτει από τον πλησιέστερο οικισμό (ΔΕΝ είναι επιβεβαιωμένο τοπωνύμιο).`,
    sourceUrls: [c.osmUrl, `https://www.openstreetmap.org/?mlat=${ctr.lat}&mlon=${ctr.lon}#map=17/${ctr.lat}/${ctr.lon}`],
    metadata: {
      // organized + shower are EVIDENCED (shower nodes on the polygon); everything else unknown.
      access: { type: 'unknown', label: 'Άγνωστη πρόσβαση', notes: 'Δεν έχει επιβεβαιωθεί επιτόπου.' },
      terrain: terrainOf(el?.tags || {}),
      organized: true,
      shade: false,
      amenities: ['ντους'],
      hasShower: true,
    },
    _showers: c.showers,
    _lengthM: c.approxLengthM,
    _neighbour: `#${nb.id} ${nb.name} (${Math.round(nd)}m)`,
  });
  console.error(`  ${nameGr}  [${c.showers} ντους, ${c.approxLengthM}m] → ${nb.region}/${nb.subName}/${nb.subSubName}`);
}

writeFileSync(new URL('./data/shower-beaches-seed.json', import.meta.url), JSON.stringify({
  batch: 'shower_beach_discovery_2026_07',
  note: 'Unnamed OSM beach polygons carrying amenity=shower nodes, >2km from any beach we list. Found by making every one of the 985 national shower points account for itself. Named from nearest settlement (Nominatim) — names NOT verified. All confidence:low + needsVerification.',
  beaches: rows,
}, null, 2) + '\n', 'utf8');

console.log(`\nSeed rows: ${rows.length} | skipped: ${skipped.length}`);
console.log('skip reasons:', JSON.stringify(skipped.reduce((a, s) => (a[s.why.replace(/\(.*\)/, '')] = (a[s.why.replace(/\(.*\)/, '')] || 0) + 1, a), {})));
console.log('Wrote scripts/data/shower-beaches-seed.json');
