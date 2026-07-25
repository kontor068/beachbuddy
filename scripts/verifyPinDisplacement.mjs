/**
 * Stage 2 of the pin audit: turn "far from the OSM centroid" into a real verdict.
 *
 * scripts/auditPinVsOsm.mjs can only compare our pin to OSM's CENTROID, which
 * makes every long beach look displaced — Ελαφονήσι, Φαληράκι and Καλαμάτα all
 * flag at 1-3 km while both points are perfectly correct. Auto-applying that
 * would move correct pins into the middle of a bay.
 *
 * So: fetch the ACTUAL beach geometry for the flagged elements (one batched
 * Overpass call, only for the handful that flagged) and measure the distance
 * from our pin to the beach POLYGON, not its centre.
 *
 *   KEEP  — our pin lies inside, or within KEEP_M of, the beach polygon. The
 *           centroid offset was a length artefact. Nothing to fix.
 *   MOVE  — our pin is genuinely off the beach; the polygon gives a defensible
 *           target (nearest point on the beach).
 *   FLAG  — ambiguous name, or the geometry could not be resolved: human call.
 *
 * Read-only. Writes a report; scripts/applyPinMoves.mjs does the applying.
 *
 * Run: node scripts/verifyPinDisplacement.mjs [--in reports/pin-vs-osm.json] [--json <out>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const IN = arg('--in', 'reports/pin-vs-osm.json');
const OUT = arg('--json', 'reports/pin-displacement-verified.json');
// Inside the polygon, or this close to its edge, the pin is on the beach.
const KEEP_M = 60;
// Upper bound for an UNATTENDED move. Beyond it, review by hand.
const AUTO_MAX_M = 600;

const R = 6371000;
const rad = (x) => (x * Math.PI) / 180;
const distM = (aLat, aLon, bLat, bLon) => {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Local equirectangular projection (metres) — fine at beach scale.
const project = (lat, lon, lat0) => ({ x: rad(lon) * R * Math.cos(rad(lat0)), y: rad(lat) * R });
const pointSegDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const pointInRing = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const report = JSON.parse(readFileSync(IN, 'utf8'));
const flagged = [...(report.autoFixable || []), ...(report.review || [])];
if (!flagged.length) { console.log('nothing flagged'); process.exit(0); }

const wayIds = [];
const relIds = [];
for (const f of flagged) {
  const [kind, id] = String(f.osmId).split('/');
  if (kind === 'way') wayIds.push(id);
  else if (kind === 'relation') relIds.push(id);
}

const parts = [];
if (wayIds.length) parts.push(`way(id:${wayIds.join(',')});`);
if (relIds.length) parts.push(`relation(id:${relIds.join(',')});`);
const query = `[out:json][timeout:180];(${parts.join('')});out geom;`;

console.log(`fetching geometry for ${flagged.length} flagged beaches (${wayIds.length} ways, ${relIds.length} relations)…`);
let osm = null;
for (const mirror of overpassMirrors) {
  try {
    const res = await fetch(mirror, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) { console.log(`   ${mirror} -> ${res.status}, trying next mirror`); await sleep(1500); continue; }
    osm = await res.json();
    console.log(`   ok via ${mirror}`);
    break;
  } catch (err) {
    console.log(`   ${mirror} -> ${err.message}, trying next mirror`);
    await sleep(1500);
  }
}
if (!osm) { console.error('all Overpass mirrors failed'); process.exit(1); }

const geomById = new Map();
for (const el of osm.elements || []) {
  const key = `${el.type}/${el.id}`;
  const rings = [];
  if (el.type === 'way' && Array.isArray(el.geometry)) rings.push(el.geometry);
  if (el.type === 'relation' && Array.isArray(el.members)) {
    for (const m of el.members) if (Array.isArray(m.geometry)) rings.push(m.geometry);
  }
  if (rings.length) geomById.set(key, rings);
}

const results = [];
for (const f of flagged) {
  const rings = geomById.get(f.osmId);
  if (!rings) {
    results.push({ ...f, verdict: 'FLAG', reason: 'OSM geometry not returned', polygonDistM: null });
    continue;
  }
  const lat0 = f.ourLat;
  const p = project(f.ourLat, f.ourLon, lat0);
  let best = Infinity;
  let inside = false;
  let nearest = null;
  for (const ring of rings) {
    const pts = ring.map((g) => ({ ...project(g.lat, g.lon, lat0), lat: g.lat, lon: g.lon }));
    if (pts.length >= 3 && pointInRing(p, pts)) inside = true;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = pointSegDist(p, pts[i], pts[i + 1]);
      if (d < best) {
        best = d;
        // nearest vertex is a defensible, ON-THE-BEACH target (never interpolate
        // into water: an OSM beach vertex is by definition on the beach outline)
        const dA = Math.hypot(p.x - pts[i].x, p.y - pts[i].y);
        const dB = Math.hypot(p.x - pts[i + 1].x, p.y - pts[i + 1].y);
        nearest = dA <= dB ? pts[i] : pts[i + 1];
      }
    }
  }
  const polygonDistM = inside ? 0 : Math.round(best);
  let verdict; let reason;
  if (f.contested) {
    verdict = 'FLAG';
    reason = `the matched OSM beach sits ${f.contestedBy.distanceM} m from our OWN #${f.contestedBy.id} ${f.contestedBy.name} — it describes THAT beach, not this one (possible duplicate entry)`;
  } else if (f.ambiguous) {
    verdict = 'FLAG';
    reason = `name matches ${f.rivals} OSM beaches within range — identity unclear`;
  } else if (polygonDistM <= KEEP_M) {
    verdict = 'KEEP';
    reason = inside
      ? 'pin lies INSIDE the OSM beach polygon — centroid offset was a beach-length artefact'
      : `pin is ${polygonDistM} m from the beach outline — on the beach`;
  } else if (polygonDistM > AUTO_MAX_M) {
    // Past this range a same-name match is more plausibly a different beach (or a
    // multi-part complex like Ελαφονήσι) than a mislocated pin. Cheap to review,
    // expensive to get wrong.
    verdict = 'FLAG';
    reason = `pin is ${polygonDistM} m away — beyond the ${AUTO_MAX_M} m auto-apply range; confirm identity by hand`;
  } else {
    verdict = 'MOVE';
    reason = `pin is ${polygonDistM} m from the OSM beach outline`;
  }
  results.push({
    ...f, verdict, reason, polygonDistM, inside,
    target: verdict === 'MOVE' && nearest ? [Number(nearest.lat.toFixed(6)), Number(nearest.lon.toFixed(6))] : null,
  });
}

const by = (v) => results.filter((r) => r.verdict === v);
console.log('');
console.log(`KEEP (pin already correct, centroid artefact): ${by('KEEP').length}`);
console.log(`MOVE (genuinely off the beach):                ${by('MOVE').length}`);
console.log(`FLAG (needs a human):                          ${by('FLAG').length}`);
console.log('');
for (const v of ['MOVE', 'FLAG', 'KEEP']) {
  const list = by(v);
  if (!list.length) continue;
  console.log(`-- ${v} --`);
  list.forEach((r) => console.log(
    `   #${r.id} ${r.name} [${r.region}] centroid ${r.offsetM} m -> polygon ${r.polygonDistM === null ? '?' : r.polygonDistM + ' m'} :: ${r.reason}`));
  console.log('');
}

writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), keepThresholdM: KEEP_M, results }, null, 1), 'utf8');
console.log(`wrote ${OUT}`);
