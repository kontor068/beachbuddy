/**
 * National pin-vs-OSM audit (offline, zero API cost).
 *
 * Independent check of every beach pin against OpenStreetMap's own beach
 * geometry, using the cached national harvest in scripts/data/osm-beaches-national.json
 * (7,665 elements / ~3,046 named). Nothing is written to app data — this only
 * reports, and ranks candidates for a separate apply step.
 *
 * Two distinct defects are separated, because they need different fixes:
 *
 *   DISPLACED  — our pin and OSM's beach of the SAME NAME sit far apart. The pin
 *                is (probably) in the wrong place. Auto-fixable when the name
 *                match is unambiguous.
 *   ORIGIN     — our pin agrees with OSM, but the exposure geometry derived from
 *                it disagrees with the authored beachFacingDirection by a wide
 *                margin. The PIN is fine; the model sampled the wrong water body
 *                (e.g. a harbour notch next to the real bay). Moving the pin
 *                would NOT fix this and could make it worse.
 *
 * Run: node scripts/auditPinVsOsm.mjs [--json <out>] [--max-km 3]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const OUT = arg('--json', null);
const MAX_KM = Number(arg('--max-km', '3'));

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
const distM = (aLat, aLon, bLat, bLon) => {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const angDiff = (a, b) => {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
};

const normalize = (s) => (s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('el')
  .replace(/\b(παραλια|ormos|ορμος|beach|plaz|πλαζ)\b/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const osm = JSON.parse(readFileSync(path.join('scripts', 'data', 'osm-beaches-national.json'), 'utf8'));
const candidates = (osm.candidates || []).filter((c) => c.coordinates);

// name -> candidates (many beaches share a name nationally, so always distance-gate)
const byName = new Map();
for (const c of candidates) {
  const keys = new Set([normalize(c.name), normalize(c.displayName), ...(c.nameKeys || []).map(normalize)]);
  for (const k of keys) {
    if (!k) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(c);
  }
}

const beachDir = path.join('public', 'data', 'beaches', 'app');
const expoDir = path.join('public', 'data', 'geospatial', 'exposure');

let scanned = 0;
let withOsmName = 0;
const displaced = [];
const originSuspect = [];
const noMatch = [];

// Every beach we ship, for the ownership guard below. Greek beach names repeat
// heavily (four «Μηλιά», three «Πούντα»…), so a same-name OSM element 2 km away
// is far more often a DIFFERENT beach than our pin being wrong. Measured on the
// Alonissos cluster: our «Μηλιά» matched an OSM element that sits 0 m from our
// OWN «Χρυσή Μηλιά» — applying that move would have stacked two beaches.
const allOurs = [];
for (const file of readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json' || file === 'search-index.json') continue;
  try {
    for (const b of JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')).island?.beaches || []) {
      if (typeof b.coordinates?.lat === 'number') {
        allOurs.push({ id: b.id, name: b.name?.gr || b.name?.en || '', lat: b.coordinates.lat, lon: b.coordinates.lon });
      }
    }
  } catch { /* skip */ }
}
/** The beach of ours that sits closest to an OSM element. */
const nearestOwner = (lat, lon) => {
  let best = null;
  for (const o of allOurs) {
    const d = distM(lat, lon, o.lat, o.lon);
    if (!best || d < best.d) best = { ...o, d };
  }
  return best;
};

for (const file of readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json' || file === 'search-index.json') continue;
  const regionId = file.replace(/\.json$/, '');
  let beaches = [];
  try {
    beaches = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')).island?.beaches || [];
  } catch { continue; }
  let profiles = {};
  const ep = path.join(expoDir, `${regionId}.json`);
  if (existsSync(ep)) {
    try { profiles = JSON.parse(readFileSync(ep, 'utf8')).profiles || {}; } catch { /* none */ }
  }

  for (const b of beaches) {
    const lat = b.coordinates?.lat;
    const lon = b.coordinates?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    scanned++;
    const name = b.name?.gr || b.name?.en || '';
    const key = normalize(name);
    const pool = byName.get(key) || [];
    const matches = pool
      .map((c) => ({ c, d: distM(lat, lon, c.coordinates.lat, c.coordinates.lon) }))
      .filter((m) => m.d <= MAX_KM * 1000)
      .sort((a, b2) => a.d - b2.d);

    const geo = profiles[String(b.id)];
    const authoredFacing = b.windProfile?.beachFacingDirection;
    const geoFacing = geo?.facingDeg;

    // ORIGIN defect: pin corroborated (or at least not contradicted) but the
    // derived facing fights the authored one. Independent of OSM matching.
    if (typeof authoredFacing === 'number' && typeof geoFacing === 'number') {
      const diff = angDiff(authoredFacing, geoFacing);
      if (diff >= 90) {
        originSuspect.push({
          id: b.id, name, region: regionId, lat, lon,
          authoredFacing, geoFacing, facingDiffDeg: Math.round(diff),
          osmDistanceM: matches.length ? Math.round(matches[0].d) : null,
          note: 'derived geometry disagrees with authored facing — model may have sampled the wrong water body',
        });
      }
    }

    if (!matches.length) { noMatch.push({ id: b.id, name, region: regionId }); continue; }
    withOsmName++;
    const best = matches[0];
    if (best.d >= 120) {
      const owner = nearestOwner(best.c.coordinates.lat, best.c.coordinates.lon);
      const contested = owner && owner.id !== b.id;
      displaced.push({
        id: b.id, name, region: regionId,
        ourLat: lat, ourLon: lon,
        osmLat: best.c.coordinates.lat, osmLon: best.c.coordinates.lon,
        osmId: best.c.id, osmName: best.c.name,
        offsetM: Math.round(best.d),
        ambiguous: matches.length > 1,
        rivals: matches.length,
        contested,
        contestedBy: contested ? { id: owner.id, name: owner.name, distanceM: Math.round(owner.d) } : null,
      });
    }
  }
}

displaced.sort((a, b) => b.offsetM - a.offsetM);
originSuspect.sort((a, b) => b.facingDiffDeg - a.facingDiffDeg);

const autoFixable = displaced.filter((d) => !d.ambiguous && !d.contested && d.offsetM >= 120 && d.offsetM <= 1500);
const review = displaced.filter((d) => d.ambiguous || d.contested || d.offsetM > 1500);

console.log(`beaches scanned: ${scanned}`);
console.log(`matched an OSM beach of the same name (<=${MAX_KM} km): ${withOsmName}`);
console.log(`no OSM name match: ${noMatch.length}`);
console.log('');
console.log(`DISPLACED pins (>=120 m from the OSM beach of the same name): ${displaced.length}`);
console.log(`   auto-fixable (single unambiguous match, 120 m - 1.5 km): ${autoFixable.length}`);
console.log(`   needs review (ambiguous name or >1.5 km): ${review.length}`);
console.log('');
console.log(`ORIGIN-suspect (authored vs derived facing >=90 deg apart): ${originSuspect.length}`);
console.log('   ^ these are NOT pin errors; moving the pin will not fix them.');
console.log('');
console.log('-- top 15 displaced --');
displaced.slice(0, 15).forEach((d) => console.log(
  `   #${d.id} ${d.name} [${d.region}] ${d.offsetM} m${d.ambiguous ? `  AMBIGUOUS x${d.rivals}` : ''}`));
console.log('');
console.log('-- top 15 origin-suspect --');
originSuspect.slice(0, 15).forEach((d) => console.log(
  `   #${d.id} ${d.name} [${d.region}] authored ${d.authoredFacing}deg vs derived ${d.geoFacing}deg (${d.facingDiffDeg}deg apart), OSM ${d.osmDistanceM === null ? 'no match' : d.osmDistanceM + ' m'}`));

if (OUT) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scanned, withOsmName, noMatch: noMatch.length,
    counts: { displaced: displaced.length, autoFixable: autoFixable.length, review: review.length, originSuspect: originSuspect.length },
    autoFixable, review, originSuspect,
  }, null, 1), 'utf8');
  console.log(`\nwrote ${OUT}`);
}
