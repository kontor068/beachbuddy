/**
 * Ο ΜΑΡΤΥΡΑΣ ΤΟΥ ΣΤΕΝΩΜΑΤΟΣ — μία μέτρηση, ένα σημείο.
 *
 * Ήταν γραμμένος μέσα στο `scripts/auditEnclosedWater.mjs` και βγήκε εδώ στις 22/08/2026, ΧΩΡΙΣ
 * καμία αλλαγή συμπεριφοράς, όταν ένα δεύτερο ερώτημα χρειάστηκε την ίδια απάντηση: «το θαλάσσιο
 * κελί που σερβίρεται σε αυτή την παραλία είναι έξω από ένα πραγματικό στόμιο, ή στην ίδια
 * ανοιχτή θάλασσα;». Δύο αντίγραφα του ίδιου ράστερ θα κατέληγαν κάποτε να διαφωνούν για το πού
 * είναι η στεριά, και κανένα από τα δύο δεν θα το έλεγε.
 *
 * ΤΙ ΜΕΤΡΑΕΙ, σε δύο αναγνώσεις πάνω σε ένα ράστερ (πλήρης αιτιολόγηση στην κεφαλίδα του
 * auditEnclosedWater):
 *   1. ΥΠΑΡΧΕΙ ΣΤΕΝΩΜΑ; Απόσταση-μετασχηματισμός ώστε κάθε κελί θάλασσας να ξέρει πόσο απέχει
 *      από στεριά, μετά αναζήτηση πλατύτερης διαδρομής (max-min) από το νερό της παραλίας προς
 *      την άκρη του κουτιού. Αν το στενότερο σημείο της διαδρομής είναι το ίδιο το σημείο
 *      εκκίνησης, τίποτα δεν στένεψε ποτέ — ανοιχτή ακτή.
 *   2. ΠΟΣΟ ΒΑΘΙΑ ΠΙΣΩ ΑΠΟ ΤΟ ΣΤΟΜΙΟ ΚΑΘΕΤΑΙ Η ΠΑΡΑΛΙΑ; Η ενέργεια που μπαίνει από άνοιγμα
 *      πλάτους W απλώνεται καθώς ταξιδεύει, οπότε μετράει το βάθος/W — όχι το W σκέτο.
 *
 * ⚠️ ΟΙ ΠΡΟΕΠΙΛΟΓΕΣ ΕΙΝΑΙ ΑΥΤΕΣ ΠΑΝΩ ΣΤΙΣ ΟΠΟΙΕΣ ΧΤΙΣΤΗΚΕ Η ΕΓΚΕΚΡΙΜΕΝΗ ΛΙΣΤΑ. Αλλάζοντάς τες
 * παίρνεις ΜΕΤΡΗΣΗ, ποτέ λίστα για αντιγραφή — ένα κελί 150 μ. δεν αναλύει όρμο 120 μ.
 */
import { KM_PER_DEG_LAT, kmPerDegLon } from './coastlineMask.mjs';

export const DEFAULT_SEED_SEARCH_KM = 1.2;
export const DEFAULT_BOX_HALF_KM = 15;
export const DEFAULT_CELL_KM = 0.15;

/**
 * Πόσα πλάτη στομίου βαθιά πρέπει να κάθεται η παραλία για να θεωρηθεί ότι η ενέργεια δεν τη
 * φτάνει. Μετρημένο: Αστέρια 7,0 · Ελούντα 4,8 · Σχίσμα 3,5 · Λιβάρι 3,0, έναντι του αντιπάλου
 * της Νάουσας στο 1,37 και της ανοιχτής Παλαιοχώρι Μήλου στο 0,57.
 */
export const MIN_DEPTH_RATIO = 2;

export const measureMouthWidthM = (isLand, lat0, lon0, {
  seedSearchKm = DEFAULT_SEED_SEARCH_KM,
  boxHalfKm = DEFAULT_BOX_HALF_KM,
  cellKm = DEFAULT_CELL_KM,
} = {}) => {
  const SEED_SEARCH_KM = seedSearchKm;
  const BOX_HALF_KM = boxHalfKm;
  const CELL_KM = cellKm;
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


/**
 * ΠΟΣΟ ΣΤΡΑΒΑ ΦΤΑΝΕΙ ΤΟ ΝΕΡΟ ΑΠΟ ΤΟ ΚΕΛΙ ΣΤΗΝ ΠΑΡΑΛΙΑ.
 *
 * Πλημμύρισμα (BFS 8 γειτόνων) πάνω στο ίδιο ράστερ ακτογραμμής. Επιστρέφει τα χλμ διαδρομής
 * μέσα από νερό, ή `null` όταν δεν υπάρχει δρόμος μέσα στο κουτί — που είναι από μόνο του
 * απάντηση: το κελί είναι σε άλλο σώμα νερού.
 *
 * Βγήκε από το `scripts/measureMarineCellReachability.mjs` στις 22/08/2026 όταν το ίδιο ερώτημα
 * χρειάστηκε και ο εθνικός έλεγχος εμπιστοσύνης — μία υλοποίηση, ένα ράστερ.
 */
export const DEFAULT_ROUTE_CELL_M = 250;
export const DEFAULT_MAX_TRAVEL_KM = 32;
export const DEFAULT_ROUTE_MARGIN_KM = 6;

const routeDistanceKm = (aLat, aLon, bLat, bLon) => {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const waterPathKm = (isLand, fromLat, fromLon, toLat, toLon, {
  cellM = DEFAULT_ROUTE_CELL_M,
  maxTravelKm = DEFAULT_MAX_TRAVEL_KM,
  marginKm = DEFAULT_ROUTE_MARGIN_KM,
} = {}) => {
  const CELL_M = cellM;
  const MAX_TRAVEL_KM = maxTravelKm;
  const MARGIN_KM = marginKm;
  const straight = routeDistanceKm(fromLat, fromLon, toLat, toLon);
  if (straight > MAX_TRAVEL_KM) return { straight, path: null, why: 'πέρα από το κουτί' };

  const midLat = (fromLat + toLat) / 2;
  const dLat = CELL_M / 1000 / KM_PER_DEG_LAT;
  const dLon = CELL_M / 1000 / kmPerDegLon(midLat);

  const minLat = Math.min(fromLat, toLat) - MARGIN_KM / KM_PER_DEG_LAT;
  const maxLat = Math.max(fromLat, toLat) + MARGIN_KM / KM_PER_DEG_LAT;
  const minLon = Math.min(fromLon, toLon) - MARGIN_KM / kmPerDegLon(midLat);
  const maxLon = Math.max(fromLon, toLon) + MARGIN_KM / kmPerDegLon(midLat);

  const rows = Math.ceil((maxLat - minLat) / dLat) + 1;
  const cols = Math.ceil((maxLon - minLon) / dLon) + 1;
  if (rows * cols > 400_000) return { straight, path: null, why: 'κουτί πολύ μεγάλο' };

  const sea = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    const lat = minLat + r * dLat;
    for (let c = 0; c < cols; c += 1) {
      const lon = minLon + c * dLon;
      sea[r * cols + c] = isLand(lon, lat) ? 0 : 1;
    }
  }

  const cellOf = (lat, lon) => {
    const r = Math.round((lat - minLat) / dLat);
    const c = Math.round((lon - minLon) / dLon);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return -1;
    return r * cols + c;
  };
  /** Η πινέζα κάθεται στην ακτή· στο ράστερ μπορεί να πέσει σε στεριά. Ψάχνουμε το κοντινότερο νερό. */
  const nearestSea = (lat, lon, maxRings = 8) => {
    const r0 = Math.round((lat - minLat) / dLat);
    const c0 = Math.round((lon - minLon) / dLon);
    for (let ring = 0; ring <= maxRings; ring += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        for (let dc = -ring; dc <= ring; dc += 1) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
          if (sea[r * cols + c]) return r * cols + c;
        }
      }
    }
    return -1;
  };

  const start = nearestSea(fromLat, fromLon);
  const goal = nearestSea(toLat, toLon);
  if (start < 0) return { straight, path: null, why: 'καμία θάλασσα γύρω από την πινέζα' };
  if (goal < 0) return { straight, path: null, why: 'καμία θάλασσα γύρω από το κελί' };

  // BFS 8-γειτόνων· το βήμα διαγωνίου κοστίζει √2 κελιά.
  const stepKm = CELL_M / 1000;
  const dist = new Float32Array(rows * cols).fill(Infinity);
  dist[start] = 0;
  let frontier = [start];
  const maxKm = Math.min(MAX_TRAVEL_KM, straight * 4 + 8);
  while (frontier.length) {
    const next = [];
    for (const idx of frontier) {
      if (idx === goal) return { straight, path: Number(dist[goal].toFixed(2)), why: null };
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const base = dist[idx];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          const nIdx = nr * cols + nc;
          if (!sea[nIdx]) continue;
          const cost = base + stepKm * (dr && dc ? Math.SQRT2 : 1);
          if (cost >= dist[nIdx] || cost > maxKm) continue;
          dist[nIdx] = cost;
          next.push(nIdx);
        }
      }
    }
    frontier = next;
  }
  return {
    straight,
    path: Number.isFinite(dist[goal]) ? Number(dist[goal].toFixed(2)) : null,
    why: Number.isFinite(dist[goal]) ? null : 'δεν υπάρχει δρόμος με νερό',
  };
};

