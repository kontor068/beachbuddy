/**
 * ΓΕΩΜΕΤΡΙΑ ΑΝΑΝΤΗ ΑΠΟ DEM — ΚΟΙΝΟ ΕΡΓΑΛΕΙΟ ΤΩΝ ΚΡΙΤΩΝ ΑΝΕΜΟΥ.
 *
 * Ξεκόλλησε από το `scripts/measureLeeWindBias.mjs` στις 25/08/2026, ΧΩΡΙΣ αλλαγή λογικής, για
 * να το μοιραστεί ο δεύτερος κριτής (`scripts/measureMeteosearchWindBias.mjs`, σταθμοί ΝΟΑ σε
 * χωριά/παραλίες). Ένα αντίγραφο = ένα αντίγραφο που παλιώνει σιωπηλά· ο κανόνας του
 * validateGustFloorConsumers ισχύει και εδώ.
 *
 * Τι δίνει: 24 γωνίες ανά 15° (ίδια ανάλυση με το windShadow των παραλιών), δείγματα DEM κάθε
 * 400 μ. ως τα 4 χλμ, και το «πόσο ΨΗΛΟΤΕΡΑ από το σημείο φτάνει το έδαφος ανάντη» για μια
 * γωνία προέλευσης (`upwindRelief`). ΓΙΑΤΙ 400 μ. ΚΑΙ ΟΧΙ 200: το μέγεθος είναι ΜΕΓΙΣΤΟ πάνω
 * σε ράχη χιλιομετρικής κλίμακας — δεν χρειάζεται πυκνότητα ακτογραμμής, και το 200 μ. χτυπούσε
 * το ωριαίο όριο της δωρεάν πόρτας υψομέτρου.
 *
 * ΔΥΟ ΠΗΓΕΣ DEM, ΓΙΑΤΙ Η ΠΡΩΤΗ ΚΛΕΙΔΩΝΕΙ. Η πόρτα υψομέτρου του Open-Meteo (ΤΟ ΙΔΙΟ DEM 90 μ.
 * που διαβάζει ο δάπεδος ριπής) έχει ωριαίο όριο που ~73 κλήσεις το αγγίζουν. Το
 * opentopodata/srtm30m είναι ανεξάρτητη πόρτα πάνω σε SRTM 30 μ. Ελέγχθηκε στο Βάι (ανάντη
 * ΔΒΔ): 90/176 μ. έναντι 109/189 του Open-Meteo — ίδιο βουνό, άλλη ανάλυση. Δηλώνεται στα όρια
 * κάθε αναφοράς που το χρησιμοποιεί.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const SLOTS = 24;
export const STEP_DEG = 360 / SLOTS;
export const SAMPLE_STEP_KM = 0.4;
export const SAMPLE_MAX_KM = 4.0;
export const SAMPLES_PER_RAY = Math.round(SAMPLE_MAX_KM / SAMPLE_STEP_KM);
const EARTH_RADIUS_KM = 6371;

const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

/** Ίδιος τύπος με utils/geospatialExposureModel.destinationPoint (great-circle). */
export const destinationPoint = (from, bearingDeg, distanceKm) => {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 };
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * ΓΙΑΤΙ curl ΚΑΙ ΟΧΙ `fetch`. Το keep-alive του undici σε αυτό το περιβάλλον πέφτει σε
 * ConnectTimeout μετά από ~12 διαδοχικές κλήσεις στην ίδια πόρτα, ενώ το ίδιο URL με curl
 * περνάει 19/20. Η δειγματοληψία θέλει 180+ κλήσεις στη σειρά — με fetch δεν τελειώνει ποτέ.
 * Ο μακρύς κατάλογος συντεταγμένων πάει σε αρχείο (`--data @`) γιατί ξεπερνά το όριο μήκους
 * γραμμής όταν μπει στο URL.
 */
export const curlJson = (url, body) => {
  // ΟΧΙ --retry-all-errors: σε HTTP 4xx το curl ξαναπροσπαθεί ΚΑΙ ΓΡΑΦΕΙ ΚΑΘΕ ΣΩΜΑ, οπότε το
  // JSON.parse έβλεπε τέσσερα κολλημένα αντικείμενα και έσκαγε με «Unexpected non-whitespace».
  const args = ['-s', '--max-time', '120', '--retry', '2', '--retry-delay', '2'];
  if (body) args.push('-G', url, '--data', `@${body}`);
  else args.push(url);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
};

export const fetchJson = async (url, body = null, tries = 6) => {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const text = curlJson(url, body);
      if (!text.trim()) throw new Error('κενή απάντηση');
      const json = JSON.parse(text);
      if (json?.error) {
        const reason = json.reason || 'άγνωστο σφάλμα';
        // Το ωριαίο όριο δεν περνάει με επανάληψη — σταματάμε καθαρά, με την πρόοδο σωσμένη.
        if (/limit exceeded/i.test(reason)) {
          const err = new Error(`ΟΡΙΟ ΠΟΡΤΑΣ: ${reason}`);
          err.rateLimited = true;
          throw err;
        }
        throw new Error(`πόρτα: ${reason}`);
      }
      return json;
    } catch (e) {
      last = e;
      if (e.rateLimited || i === tries - 1) break;
      await sleep(3000 * (i + 1));
    }
  }
  throw last;
};

/** Τα 1 + 24×10 σημεία που περιγράφουν το ανάγλυφο γύρω από ένα σημείο, με τον δείκτη τους. */
export const rayPointsFor = (id, { lat, lon }) => {
  const points = [{ lat, lon }];
  const index = [{ id, slot: -1, step: -1 }];
  for (let slot = 0; slot < SLOTS; slot++) {
    for (let s = 1; s <= SAMPLES_PER_RAY; s++) {
      points.push(destinationPoint({ lat, lon }, slot * STEP_DEG, s * SAMPLE_STEP_KM));
      index.push({ id, slot, step: s });
    }
  }
  return { points, index };
};

/** Από τη λίστα υψομέτρων ξανά στη γεωμετρία `{ selfM, rays[24][10] }` ανά id. */
export const geometryFromElevations = (ids, index, elevations) => {
  const out = {};
  for (const id of ids) out[id] = { selfM: null, rays: Array.from({ length: SLOTS }, () => []) };
  elevations.forEach((m, i) => {
    const { id, slot, step } = index[i];
    if (!out[id]) return;
    if (slot < 0) out[id].selfM = m;
    else out[id].rays[slot][step - 1] = m;
  });
  return out;
};

/**
 * Δειγματολήπτης υψομέτρων σε δέσμες των 100 (το όριο της πόρτας elevation του Open-Meteo), με
 * ενδιάμεσο σώσιμο σε `cacheDir/elevations-partial.json`: 180 κλήσεις είναι αρκετές για να
 * πέσει η γραμμή στη μέση και η δειγματοληψία δεν έχει λόγο να ξαναρχίζει από το μηδέν.
 */
export const createElevationSampler = ({ cacheDir, apiKey = null, demSource, refresh = false }) => {
  const partialPath = path.join(cacheDir, 'elevations-partial.json');
  const DEM_SOURCE = demSource || (apiKey ? 'open-meteo' : 'opentopodata');

  const fetchElevationBatch = async (batch) => {
    const query = path.join(cacheDir, 'query.txt');
    if (DEM_SOURCE === 'open-meteo') {
      fs.writeFileSync(query, `latitude=${batch.map(p => p.lat.toFixed(5)).join(',')}`
        + `&longitude=${batch.map(p => p.lon.toFixed(5)).join(',')}`
        + (apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : ''));
      const json = await fetchJson(apiKey
        ? 'https://customer-api.open-meteo.com/v1/elevation'
        : 'https://api.open-meteo.com/v1/elevation', query);
      if (!Array.isArray(json?.elevation) || json.elevation.length !== batch.length) {
        throw new Error(`η πόρτα υψομέτρου γύρισε ${json?.elevation?.length} για ${batch.length} σημεία`);
      }
      return json.elevation;
    }
    const locations = batch.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('%7C');
    const json = await fetchJson(`https://api.opentopodata.org/v1/srtm30m?locations=${locations}`);
    if (!Array.isArray(json?.results) || json.results.length !== batch.length) {
      throw new Error(`opentopodata: ${json?.results?.length} αποτελέσματα για ${batch.length} σημεία`);
    }
    // Πάνω από θάλασσα το SRTM γυρίζει 0 ή null· και τα δύο σημαίνουν «όχι έδαφος πάνω από το νερό».
    return json.results.map(r => (Number.isFinite(r.elevation) ? r.elevation : 0));
  };

  const fetchElevations = async (points) => {
    fs.mkdirSync(cacheDir, { recursive: true });
    let out = [];
    if (!refresh && fs.existsSync(partialPath)) {
      const saved = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
      if (saved.total === points.length) {
        out = saved.elevation;
        process.stderr.write(`  (συνέχεια από ${out.length}/${points.length})\n`);
      }
    }
    for (let i = out.length; i < points.length; i += 100) {
      const batch = points.slice(i, i + 100);
      out.push(...await fetchElevationBatch(batch));
      if (out.length % 1000 < 100) {
        fs.writeFileSync(partialPath, JSON.stringify({ total: points.length, elevation: out }));
      }
      process.stderr.write(`\r  υψόμετρα: ${out.length}/${points.length}`);
      await sleep(DEM_SOURCE === 'opentopodata' ? 1100 : (apiKey ? 120 : 300));
    }
    process.stderr.write('\n');
    fs.writeFileSync(partialPath, JSON.stringify({ total: points.length, elevation: out }));
    return out;
  };

  /** Τυλίγει τη δειγματοληψία ώστε το ωριαίο όριο να μη χάνει την πρόοδο ούτε να σκάει άσχημα. */
  const fetchElevationsResumable = async (points) => {
    try {
      return await fetchElevations(points);
    } catch (e) {
      if (e?.rateLimited) {
        const saved = fs.existsSync(partialPath) ? JSON.parse(fs.readFileSync(partialPath, 'utf8')).elevation.length : 0;
        console.error(`\n⏸  ${e.message}`);
        console.error(`   σωσμένα ${saved}/${points.length} σημεία. Ξανατρέξε το ΙΔΙΟ σκριπτ την επόμενη ώρα — συνεχίζει από εκεί.`);
        process.exit(2);
      }
      throw e;
    }
  };

  return { demSource: DEM_SOURCE, partialPath, fetchElevationBatch, fetchElevations, fetchElevationsResumable };
};

/**
 * Ανάγλυφο ανάντη για μία γωνία προέλευσης: πόσο ΨΗΛΟΤΕΡΑ από το σημείο φτάνει το έδαφος μέσα
 * σε `radiusKm`, κατά μέσο όρο των ακτίνων του παραθύρου ±`windowDeg`.
 * Επιστρέφει και το κλάσμα δειγμάτων πάνω από το νερό (proxy στεριάς από το ΙΔΙΟ DEM).
 */
export const upwindRelief = (geometry, fromDeg, radiusKm, windowDeg) => {
  const steps = Math.round(radiusKm / SAMPLE_STEP_KM);
  const offsets = [];
  for (let o = -windowDeg; o <= windowDeg; o += STEP_DEG) offsets.push(o);
  let reliefSum = 0, landSum = 0, landCount = 0, rays = 0, reliefMax = -Infinity;
  for (const offset of offsets) {
    const slot = ((Math.round((fromDeg + offset) / STEP_DEG) % SLOTS) + SLOTS) % SLOTS;
    const ray = geometry.rays[slot];
    if (!Array.isArray(ray) || ray.length < steps) continue;
    let peak = -Infinity;
    for (let s = 0; s < steps; s++) {
      const m = ray[s];
      if (!Number.isFinite(m)) continue;
      if (m > peak) peak = m;
      landCount += 1;
      if (m > 0) landSum += 1;
    }
    if (!Number.isFinite(peak)) continue;
    const relief = peak - geometry.selfM;
    reliefSum += relief;
    if (relief > reliefMax) reliefMax = relief;
    rays += 1;
  }
  if (!rays) return null;
  return {
    meanM: reliefSum / rays,
    maxM: reliefMax,
    landFrac: landCount ? landSum / landCount : 0,
  };
};
