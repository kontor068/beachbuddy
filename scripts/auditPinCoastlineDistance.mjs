// Stage 3 of the pin-placement audit: how far is a pin from the SEA?
//
// "Far from any OSM beach" alone cannot tell a wrong pin from a real beach OpenStreetMap
// simply never mapped (Τζάστενη is 13 m from the shoreline yet has no OSM beach at all).
// The discriminator is the coastline: a real beach pin sits ON the shore; the Pelion
// offenders sat 2.9-5.0 km INLAND. This measures the distance from each pin to the nearest
// land-polygon boundary (= coastline) in the offline land mask — no network, no API.
//
//   node scripts/auditPinCoastlineDistance.mjs                       # audits the stage-1/2 report
//   node scripts/auditPinCoastlineDistance.mjs --ids=2669,2722,2686   # audits specific beaches
//   node scripts/auditPinCoastlineDistance.mjs --all                  # every beach in the dataset
//
// Classification: INLAND (>400 m from the sea, and inside land) => the pin is wrong.
//                 COASTAL => pin is plausible; if it is also far from any OSM beach it is
//                 most likely a genuine beach OSM has not mapped (a discovery lead, not a bug).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const MASK = path.resolve(rootDir, arg('land-geojson', '.tmp/geospatial/greece-land-osm-split.geojson'));
const COASTAL_M = Number(arg('coastal', 400));
const REPORT = path.join(rootDir, 'reports', 'quality', 'pin-placement-audit.json');

if (!existsSync(MASK)) { console.error(`Land mask not found: ${MASK}\nRegenerate with: node scripts/fetchHighResLandMask.mjs`); process.exit(1); }

const data = JSON.parse(readFileSync(path.join(rootDir, 'public', 'greek_beaches.json'), 'utf8'));
const all = [];
for (const [region, sub] of Object.entries(data))
  for (const [prefecture, subSub] of Object.entries(sub))
    for (const [municipality, arr] of Object.entries(subSub))
      if (Array.isArray(arr)) for (const b of arr)
        if (Number.isFinite(b.lat) && Number.isFinite(b.lon))
          all.push({ id: b.id, name: b.name, lat: b.lat, lon: b.lon, region, municipality, confidence: b.metadata?.confidence });

let targets;
const idsArg = arg('ids');
if (idsArg) { const want = new Set(idsArg.split(',').map(Number)); targets = all.filter(b => want.has(b.id)); }
else if (process.argv.includes('--all')) targets = all;
else {
  if (!existsSync(REPORT)) { console.error('No audit report; run scripts/auditBeachPinPlacement.mjs first (or pass --ids / --all).'); process.exit(1); }
  const rep = JSON.parse(readFileSync(REPORT, 'utf8'));
  const rows = (rep.confirmed && rep.confirmed.length ? rep.confirmed : rep.suspects) || [];
  const want = new Set(rows.map(r => r.id));
  targets = all.filter(b => want.has(b.id));
}
console.log(`Land mask: ${(readFileSync(MASK).length / 1048576).toFixed(1)} MB · auditing ${targets.length} pins (coastal threshold ${COASTAL_M} m)`);

const geo = JSON.parse(readFileSync(MASK, 'utf8'));
const rings = [];                       // [ring, minLat, maxLat, minLon, maxLon]
const pushPoly = (poly) => { for (const ring of poly) {
  let mnLa = 90, mxLa = -90, mnLo = 180, mxLo = -180;
  for (const [lo, la] of ring) { if (la < mnLa) mnLa = la; if (la > mxLa) mxLa = la; if (lo < mnLo) mnLo = lo; if (lo > mxLo) mxLo = lo; }
  rings.push([ring, mnLa, mxLa, mnLo, mxLo]);
} };
for (const f of (geo.features || [])) {
  const g = f.geometry; if (!g) continue;
  if (g.type === 'Polygon') pushPoly(g.coordinates);
  else if (g.type === 'MultiPolygon') for (const p of g.coordinates) pushPoly(p);
}
console.log(`Coastline rings: ${rings.length}`);

const M_PER_DEG_LAT = 111320;
const mPerDegLon = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
// point-to-segment distance in metres, using a local equirectangular projection
const segDist = (plat, plon, alat, alon, blat, blon, kLon) => {
  const px = plon * kLon, py = plat * M_PER_DEG_LAT;
  const ax = alon * kLon, ay = alat * M_PER_DEG_LAT;
  const bx = blon * kLon, by = blat * M_PER_DEG_LAT;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};
const pointInRing = (plat, plon, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [ring[i][0], ring[i][1]], [xj, yj] = [ring[j][0], ring[j][1]];
    if (((yi > plat) !== (yj > plat)) && (plon < (xj - xi) * (plat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
};

const results = [];
for (const b of targets) {
  const kLon = mPerDegLon(b.lat);
  const pad = 0.06; // ~6.6 km search window, widened on miss
  let best = Infinity, onLand = false;
  for (let attempt = 0; attempt < 3 && !Number.isFinite(best === Infinity ? NaN : best); attempt += 1) {
    const p = pad * (attempt + 1) * 2;
    best = Infinity;
    for (const [ring, mnLa, mxLa, mnLo, mxLo] of rings) {
      if (b.lat < mnLa - p || b.lat > mxLa + p || b.lon < mnLo - p || b.lon > mxLo + p) continue;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const d = segDist(b.lat, b.lon, ring[j][1], ring[j][0], ring[i][1], ring[i][0], kLon);
        if (d < best) best = d;
      }
      if (!onLand && b.lat >= mnLa && b.lat <= mxLa && b.lon >= mnLo && b.lon <= mxLo && pointInRing(b.lat, b.lon, ring)) onLand = true;
    }
  }
  const dist = Number.isFinite(best) ? Math.round(best) : null;
  results.push({ ...b, coastDistM: dist, onLand,
    verdict: dist === null ? 'UNKNOWN' : dist > COASTAL_M ? (onLand ? 'INLAND' : 'OFFSHORE') : 'COASTAL' });
}

results.sort((a, b) => (b.coastDistM ?? -1) - (a.coastDistM ?? -1));
const inland = results.filter(r => r.verdict === 'INLAND');
const offshore = results.filter(r => r.verdict === 'OFFSHORE');
const coastal = results.filter(r => r.verdict === 'COASTAL');

mkdirSync(path.join(rootDir, 'reports', 'quality'), { recursive: true });
writeFileSync(path.join(rootDir, 'reports', 'quality', 'pin-coastline-audit.json'), JSON.stringify({ coastalThresholdM: COASTAL_M, totals: { audited: results.length, inland: inland.length, offshore: offshore.length, coastal: coastal.length }, results }, null, 2) + '\n', 'utf8');

console.log(`\nINLAND (pin is on land, >${COASTAL_M}m from the sea) — WRONG PINS: ${inland.length}`);
for (const r of inland) console.log(`  ${String(r.coastDistM).padStart(6)}m  #${r.id} ${String(r.name).padEnd(30)} ${r.region}/${r.municipality}  conf=${r.confidence || '—'}`);
if (offshore.length) {
  console.log(`\nOFFSHORE (>${COASTAL_M}m from land — pin is in open water): ${offshore.length}`);
  for (const r of offshore.slice(0, 20)) console.log(`  ${String(r.coastDistM).padStart(6)}m  #${r.id} ${String(r.name).padEnd(30)} ${r.region}/${r.municipality}`);
}
console.log(`\nCOASTAL (pin is on the shore — plausible; if also far from OSM it is an unmapped-beach lead): ${coastal.length}`);
console.log(`\nWrote reports/quality/pin-coastline-audit.json`);
