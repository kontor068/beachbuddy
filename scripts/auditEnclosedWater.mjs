/**
 * ΠΟΙΕΣ ΠΑΡΑΛΙΕΣ ΕΧΟΥΝ ΝΕΡΟ ΠΡΑΓΜΑΤΙΚΑ ΑΠΟΚΟΜΜΕΝΟ ΑΠΟ ΤΟ ΑΝΟΙΧΤΟ ΠΕΛΑΓΟΣ.
 *
 * Rebuilds VERIFIED_ENCLOSED_WATER_IDS in utils/geometricWaveCeiling.ts, which caps the displayed
 * wave at what a beach's own water can physically build. That cap is only safe where the water
 * really is cut off, and THE COMMITTED RAY FAN CANNOT ESTABLISH THAT. Rays travel in straight
 * lines; sea does not. A wave entering a bay mouth spreads inside it and reaches corners no
 * straight line connects to open water.
 *
 * THE ADVERSARY, measured 13/08/2026. Six Νάουσα-bay beaches on Πάρος (Κολυμπήθρες, Κριός,
 * Λάγγερη, Λίμνες, Μαρτσέλο, Μοναστήρι) carry a perfect enclosed signature — blocked = 1 in all
 * eight sectors, 1,5–2,7 km of fetch — and still take a full 5 Bft meltemi, because Νάουσα bay
 * opens 2,5 km wide to the north Aegean. The first draft of the ceiling turned that day into ideal
 * swimming and scripts/validateRecommendationScenarios caught it. Every rule below is validated
 * against those six: none of them may pass.
 *
 * ⚠️ AND THE PINS ARE NOT THE PROBLEM — that theory was tested and killed. OSM places
 * "Κολυμπήθρες" at 37.12932/25.21536, byte-identical to ours. The beach genuinely sits in the
 * sheltered south-west corner of an open bay. Two further theories died with it: a neighbourhood
 * fetch sweep (64 of 65 candidates saturate at 25 km — the radius needed to catch a displaced pin
 * also escapes every bay) and the national pin audit's DFACING/FAR_FROM_COAST signals (they flag
 * three of the six Νάουσα beaches but also flag Ελούντα, which is a true enclosure). Do not
 * re-litigate these without new measurement.
 *
 * THE MEASUREMENT THAT WORKS, in two readings off one raster:
 *
 *   1. IS THERE A CONSTRICTION AT ALL? Rasterise land/sea, distance-transform so every sea cell
 *      knows its clearance from land, then run a max-min (widest-path) search from the middle of
 *      the water the beach faces out to the box edge. If the narrowest point of that route is the
 *      starting cell itself, nothing ever pinched — the water only widens from the beach to the
 *      open sea. That is an OPEN COAST, whatever the ray fan says about the little cove the pin
 *      sits in, and 44 of the 65 candidates are exactly that. Only 21 have a real mouth.
 *
 *   2. HOW DEEP BEHIND THAT MOUTH IS THE BEACH? Energy entering a gap of width W spreads as it
 *      travels, so the number that matters is depth / W — how many gap-widths in the beach sits —
 *      not W alone. Past about 2, a beach off the axis of the opening is firmly in its shadow.
 *      Measured: Αστέρια 7,0 · Μικρό Νεώριο 5,0 · Ελούντα 4,8 · Σχίσμα 3,5 · Λιβάρι 3,0, against
 *      the Νάουσα adversary at 1,37 and below and open Παλαιοχώρι Μήλου at 0,57.
 *
 * ⚠️ THREE EARLIER RULES WERE SHIPPED OR NEARLY SHIPPED AND ARE NOW GONE. Keep them dead:
 *   • Mouth width alone (< 800 m). Wrong because a "mouth" on an open coast is not a mouth at all,
 *     just the seed cell's own clearance — an artefact of how far from land we were allowed to
 *     start. It admitted Λούτσα (300 m mouth, depth 150 m, ratio 0,5) and rejected Λιβάρι
 *     Χαλκιδικής (849 m mouth, 2,55 km deep, ratio 3,0), which is exactly backwards.
 *   • Distance to the nearest marine cell (>= 4 km). It answers "has the wave model sampled here",
 *     which is not the same question as "can a wave get here". Σταυρός Χανίων sits 13,3 km from a
 *     cell and is an OPEN COAST by reading 1.
 *   • Neighbourhood fetch, and the national pin audit's signals. See the paragraph above.
 *
 * NOT A LIVE PATH — offline only; rasterising 30x30 km per beach is not something a page load may
 * do. Re-run after any geometry rebuild (scripts/fetchHighResLandMask.mjs → the exposure build) or
 * after moving a pin, and paste the printed block into utils/geometricWaveCeiling.ts.
 *
 * Run: node --max-old-space-size=4096 scripts/auditEnclosedWater.mjs [--probe 767,2030] [--json <path>]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ── Candidate geometry gates, mirroring utils/geometricWaveCeiling.ts ──────────────────────────
const REQUIRED_BLOCKED_RATIO = 1;
const MAX_FETCH_KM = 3;
const MIN_FETCH_KM = 0.2;


const rad = x => (x * Math.PI) / 180;
const KM_PER_DEG_LAT = 110.574;
const kmPerDegLon = lat => 111.32 * Math.cos(rad(lat));

// ── Land mask (the split-OSM coastline the exposure build uses) ────────────────────────────────
const MASK_PATH = path.join(root, '.tmp/geospatial/greece-land-osm-split.geojson');
const GRID_DEG = 0.05;

const loadMask = () => {
  const fc = JSON.parse(readFileSync(MASK_PATH, 'utf8'));
  const polys = [];
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = f.geometry.coordinates[0];
    if (!ring || ring.length < 4) continue;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    polys.push({ ring, holes: f.geometry.coordinates.slice(1), minLon, maxLon, minLat, maxLat });
  }
  const buckets = new Map();
  polys.forEach((p, i) => {
    for (let r = Math.floor(p.minLat / GRID_DEG); r <= Math.floor(p.maxLat / GRID_DEG); r++) {
      for (let c = Math.floor(p.minLon / GRID_DEG); c <= Math.floor(p.maxLon / GRID_DEG); c++) {
        const k = `${r}:${c}`;
        const b = buckets.get(k);
        if (b) b.push(i); else buckets.set(k, [i]);
      }
    }
  });
  return { polys, buckets };
};

const inRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const makeIsLand = mask => (lon, lat) => {
  const cands = mask.buckets.get(`${Math.floor(lat / GRID_DEG)}:${Math.floor(lon / GRID_DEG)}`);
  if (!cands) return false;
  for (const i of cands) {
    const p = mask.polys[i];
    if (lon < p.minLon || lon > p.maxLon || lat < p.minLat || lat > p.maxLat) continue;
    if (!inRing(lon, lat, p.ring)) continue;
    if (p.holes.some(h => inRing(lon, lat, h))) continue;
    return true;
  }
  return false;
};

/** Where to look for "the middle of the water this beach faces" — see witness 1 in the header. */
const SEED_SEARCH_KM = 1.2;
const BOX_HALF_KM = 15;
const CELL_KM = 0.15;

const measureMouthWidthM = (isLand, lat0, lon0) => {
  const n = Math.ceil((2 * BOX_HALF_KM) / CELL_KM);
  const dLat = CELL_KM / KM_PER_DEG_LAT;
  const dLon = CELL_KM / kmPerDegLon(lat0);
  const latAt = r => lat0 - BOX_HALF_KM / KM_PER_DEG_LAT + r * dLat;
  const lonAt = c => lon0 - BOX_HALF_KM / kmPerDegLon(lat0) + c * dLon;

  const sea = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) {
    const la = latAt(r);
    for (let c = 0; c < n; c++) sea[r * n + c] = isLand(lonAt(c), la) ? 0 : 1;
  }

  // Clearance from land, 8-connected with a 1 / √2 metric.
  const INF = 1e9;
  const clear = new Float32Array(n * n).fill(INF);
  let frontier = [];
  for (let i = 0; i < n * n; i++) if (!sea[i]) { clear[i] = 0; frontier.push(i); }
  const NB = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [1, 1, 1.4142]];
  while (frontier.length) {
    const next = [];
    for (const idx of frontier) {
      const r = (idx / n) | 0, c = idx % n;
      for (const [dr, dc, w] of NB) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const j = rr * n + cc;
        const nd = clear[idx] + w;
        if (nd < clear[j] - 1e-6) { clear[j] = nd; next.push(j); }
      }
    }
    frontier = next;
  }

  // Seed: the middle of the water this beach faces.
  const mid = n >> 1;
  const span = Math.ceil(SEED_SEARCH_KM / CELL_KM);
  let seed = -1, seedClear = -1;
  for (let r = Math.max(0, mid - span); r <= Math.min(n - 1, mid + span); r++) {
    for (let c = Math.max(0, mid - span); c <= Math.min(n - 1, mid + span); c++) {
      const i = r * n + c;
      if (!sea[i]) continue;
      if (Math.hypot(r - mid, c - mid) > span) continue;
      if (clear[i] > seedClear) { seedClear = clear[i]; seed = i; }
    }
  }
  if (seed < 0) return { mouthM: null, reason: 'pin-not-in-sea' };

  // Where each cell's bottleneck was imposed, so we can measure how deep inside the bay the beach
  // sits relative to the gap it is fed through (see BAY_DEPTH_RATIO in the header).
  const via = new Int32Array(n * n).fill(-1);
  const best = new Float32Array(n * n);
  best[seed] = clear[seed];
  via[seed] = seed;
  const heap = [[clear[seed], seed]];
  const pop = () => {
    let bi = 0;
    for (let i = 1; i < heap.length; i++) if (heap[i][0] > heap[bi][0]) bi = i;
    const v = heap[bi];
    heap[bi] = heap[heap.length - 1];
    heap.pop();
    return v;
  };
  while (heap.length) {
    const [bn, idx] = pop();
    if (bn < best[idx] - 1e-6) continue;
    const r = (idx / n) | 0, c = idx % n;
    if (r === 0 || c === 0 || r === n - 1 || c === n - 1) {
      // Straight-line distance from the beach to the narrowest point on its route out — how far
      // inside the bay the beach sits relative to the gap that feeds it.
      const g = via[idx];
      const gr = (g / n) | 0, gc = g % n;
      const depthKm = Math.hypot(gr - mid, gc - mid) * CELL_KM;
      const mouthM = Math.round(2 * bn * CELL_KM * 1000);
      return {
        mouthM,
        reason: 'ok',
        bayDepthKm: Number(depthKm.toFixed(2)),
        depthRatio: mouthM > 0 ? Number((depthKm * 1000 / mouthM).toFixed(2)) : null,
        /**
         * IS THERE A CONSTRICTION AT ALL? The single cleanest reading this raster gives.
         *
         * When the narrowest point of the route out is the seed itself, nothing downstream ever
         * pinched: the water only widens from the beach to the open sea. That is an open coast, and
         * the "mouth width" reported for it is not a mouth — it is just the seed's own clearance,
         * i.e. an artefact of how far from land we were allowed to start. A real bay pinches
         * somewhere beyond the seed, and that cell is its mouth.
         */
        constricted: via[idx] !== seed,
      };
    }
    for (const [dr, dc] of NB) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const j = rr * n + cc;
      if (!sea[j]) continue;
      const cand = Math.min(bn, clear[j]);
      if (cand > best[j] + 1e-6) {
        best[j] = cand;
        // Carry the constriction forward, or record this cell as the new one when it is the tighter.
        via[j] = clear[j] < bn ? j : via[idx];
        heap.push([cand, j]);
      }
    }
  }
  return { mouthM: 0, reason: 'landlocked' };
};


// ── Admission threshold ───────────────────────────────────────────────────────────────────────
/**
 * Gap-widths deep the beach must sit behind its bay mouth. 2 is where a beach off the opening's
 * axis is firmly in its geometric shadow; the measured gap between the classes is wide (nearest
 * admitted 2,15, nearest adversary 1,37), so nothing here is balanced on the threshold.
 */
const MIN_DEPTH_RATIO = 2;

// ── Candidates ────────────────────────────────────────────────────────────────────────────────
const probeArg = process.argv.indexOf('--probe');
const probeIds = probeArg > -1 ? new Set(process.argv[probeArg + 1].split(',').map(Number)) : null;
const jsonArg = process.argv.indexOf('--json');

const dir = path.join(root, 'public/data/geospatial/exposure');
const candidates = [];
for (const file of readdirSync(dir).filter(n => n.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  const profiles = Array.isArray(doc.profiles) ? doc.profiles : Object.values(doc.profiles ?? {});
  for (const p of profiles) {
    const s = SECTORS.map(x => p.sectors?.[x]);
    const complete = s.every(x => x && typeof x.fetchKm === 'number' && typeof x.blockedRayRatio === 'number');
    if (probeIds) {
      if (!probeIds.has(p.beachId)) continue;
    } else {
      if (!complete || p.confidence !== 'high') continue;
      if (s.some(x => x.blockedRayRatio < REQUIRED_BLOCKED_RATIO)) continue;
      const mf = Math.max(...s.map(x => x.fetchKm));
      if (mf > MAX_FETCH_KM || mf < MIN_FETCH_KM) continue;
    }
    candidates.push({
      id: p.beachId,
      name: p.name?.gr ?? p.name?.en,
      region: file.replace('.json', ''),
      lat: p.coordinates.lat,
      lon: p.coordinates.lon,
      pinFetchKm: complete ? Number(Math.max(...s.map(x => x.fetchKm)).toFixed(2)) : null,
    });
  }
}

console.error('Loading coastline mask…');
const mask = loadMask();
const isLand = makeIsLand(mask);
console.error(`Mask: ${mask.polys.length} polygons. Witness 1 — mouth width for ${candidates.length} beaches…`);

const results = [];
for (const [i, c] of candidates.entries()) {
  const t0 = Date.now();
  const { mouthM, reason, bayDepthKm, depthRatio, constricted } = measureMouthWidthM(isLand, c.lat, c.lon);
  results.push({ ...c, mouthM, reason, bayDepthKm, depthRatio, constricted });
  console.error(`  [${i + 1}/${candidates.length}] ${c.name}: mouth ${mouthM === null ? reason : mouthM + ' m'} depth ${bayDepthKm ?? '-'} km ratio ${depthRatio ?? '-'} (${Date.now() - t0} ms)`);
}

// ── Witness 2: distance to the nearest Open-Meteo marine cell ─────────────────────────────────
const haversineKm = (aLat, aLon, bLat, bLon) => {
  const R = 6371;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const chunk = (list, size) => (list.length ? [list.slice(0, size), ...chunk(list.slice(size), size)] : []);
console.error('\nWitness 2 — nearest marine grid cell…');
for (const group of chunk(results, 20)) {
  const url = 'https://marine-api.open-meteo.com/v1/marine' +
    `?latitude=${group.map(c => c.lat).join(',')}&longitude=${group.map(c => c.lon).join(',')}` +
    '&hourly=wave_height&forecast_days=1';
  // A silently-failed batch is the dangerous failure here: it does not crash, it just drops 20
  // beaches out of witness 2 and shrinks the admitted list without saying so. Measured on the first
  // run of this script — 20 beaches, including Σταυρός, vanished that way. Retry, then refuse.
  let cells = null;
  for (let attempt = 1; attempt <= 3 && !cells; attempt++) {
    const body = await fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const arr = Array.isArray(body) ? body : body ? [body] : null;
    if (arr && arr.length === group.length && arr.every(c => typeof c?.latitude === 'number')) cells = arr;
    else console.error(`  batch of ${group.length} failed (attempt ${attempt}/3)`);
  }
  if (!cells) {
    throw new Error(
      `Marine grid unreachable for a batch of ${group.length} (ids ${group.map(c => c.id).join(',')}). ` +
      'Refusing to print a list: witness 2 would be silently missing and the admitted set would shrink.'
    );
  }
  group.forEach((c, i) => {
    c.cellKm = Number(haversineKm(c.lat, c.lon, cells[i].latitude, cells[i].longitude).toFixed(2));
  });
}

// ── Verdict ───────────────────────────────────────────────────────────────────────────────────
for (const r of results) {
  r.admitted = r.constricted === true && typeof r.depthRatio === 'number' && r.depthRatio >= MIN_DEPTH_RATIO;
}
const admitted = results.filter(r => r.admitted).sort((a, b) => a.id - b.id);
const openCoast = results.filter(r => !r.constricted);
const shallowBay = results.filter(r => r.constricted && !r.admitted);

console.log(`\nGeometric candidates: ${results.length}`);
console.log(`  open coast (no constriction on the way out): ${openCoast.length}`);
console.log(`  a real mouth, but the beach sits under ${MIN_DEPTH_RATIO} gap-widths in: ${shallowBay.length}`);
console.log(`  ADMITTED: ${admitted.length}`);
const paros = admitted.filter(r => r.region.includes('paros')).map(r => r.name);
console.log(`Naousa adversary among the admitted: ${paros.length ? paros.join(',') : 'NONE (correct)'}`);

console.log('\nPaste into utils/geometricWaveCeiling.ts:\n');
console.log('export const VERIFIED_ENCLOSED_WATER_IDS = new Set<number>([');
for (const r of admitted) {
  console.log(`  ${r.id}, // ${r.name} [${r.region}] — mouth ${r.mouthM} m, ${r.bayDepthKm} km deep = ${r.depthRatio} gap-widths, fetch ${r.pinFetchKm} km`);
}
console.log(']);\n');
console.log(`Rejected with a real mouth but too shallow behind it (${shallowBay.length}):`);
for (const r of shallowBay.sort((a, b) => b.depthRatio - a.depthRatio)) {
  console.log(`  ${String(r.id).padEnd(5)} ratio ${String(r.depthRatio).padStart(5)}  mouth ${String(r.mouthM + ' m').padStart(7)}  ${r.name} [${r.region}]`);
}
console.log(`
Rejected as open coast (${openCoast.length}): ${openCoast.map(r => r.id).join(', ')}`);
if (jsonArg > -1) {
  writeFileSync(process.argv[jsonArg + 1], JSON.stringify(results, null, 1));
  console.error(`Wrote ${process.argv[jsonArg + 1]}`);
}
