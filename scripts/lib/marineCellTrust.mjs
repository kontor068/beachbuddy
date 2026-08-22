/**
 * IS THE CELL WE ARE SERVED DESCRIBING THE WATER THIS BEACH FACES?
 *
 * One test, imported by everything that asks it, so the auditor and the optimiser can never drift
 * into judging by different rules — the failure mode scripts/validateEffectiveRanking.ts records
 * from a gate that had re-implemented its subject and passed green on sabotaged code.
 *
 *     fetchKm(beach, bearing(beach → cell))  >=  MIN_FETCH_RATIO * distance(beach, cell)
 *
 * The fetch is how far a ray from this beach travelled on that bearing before it hit land. If it is
 * shorter than the distance to the cell, the cell is behind land.
 *
 * ⚠️ THE TEST IS ABOUT FETCH, NOT DISTANCE, and that is deliberate. §Γ1 of the bible killed
 * "distance from a marine cell" as a criterion — it answers "has the model sampled here", not "can
 * a wave get here"; Σταυρός Χανίων is 13.3 km from a cell and is honest open coast. So nothing here
 * may prefer a NEARER cell: a beach with 25 km of open fetch has its sea generated 25 km away.
 */

export const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * The two wave models the app requests, in the order utils/marineForecastParsing.ts prefers them,
 * each with its own native lattice — points inside one source cell always snap the same way, so
 * that is the unit of deduplication and of caching.
 */
export const MODELS = [
  { id: 'ewam', gridDeg: 0.05 },
  { id: 'meteofrance_wave', gridDeg: 1 / 12 },
];

/**
 * How much of the distance to the cell must be open water on that bearing. Below 1.0 because the
 * fetch is a 5-ray MEAN: a cell just past a small islet inside the fan is still the same sea.
 */
export const MIN_FETCH_RATIO = 0.8;

/**
 * Absolute ceiling, set at the ray-cast cap rather than at a model cell width. A tighter cap would
 * be wrong for the reason in the header: local shelter is already handled by the beach's own
 * exposure geometry, which attenuates whatever the open sea is doing. This only rejects readings
 * beyond what the geometry can vouch for at all.
 */
export const MAX_TRUSTED_DISTANCE_KM = 25;

/**
 * ΟΙ ΑΚΤΙΝΕΣ ΤΑΞΙΔΕΥΟΥΝ ΣΕ ΕΥΘΕΙΑ, Η ΘΑΛΑΣΣΑ ΟΧΙ (22/08/2026).
 *
 * Ο έλεγχος από πάνω ρωτάει «βλέπει η παραλία το κελί σε ευθεία γραμμή». Μετρήθηκε εθνικά ότι
 * αυτό κόβει και κελιά που είναι **η ίδια θάλασσα, ένα βραχάκι παραδίπλα**: 157 από τις 246
 * κομμένες έχουν δρόμο μέσα από νερό τόσο ίσιο όσο των ΕΜΠΙΣΤΩΝ παραλιών. Είναι το ίδιο μάθημα
 * που η βίβλος έγραψε όταν έπεσε το πρώτο σχέδιο του γεωμετρικού ταβανιού — το κύμα μπαίνει από
 * το στόμιο και απλώνεται σε γωνίες που καμία ευθεία δεν συνδέει με ανοιχτό νερό.
 *
 * ΤΟ ΟΡΙΟ ΒΓΑΙΝΕΙ ΑΠΟ ΓΕΩΜΕΤΡΙΑ, ΟΧΙ ΑΠΟ ΤΟ ΔΕΙΓΜΑ. Η πρώτη εκδοχή το βαθμονόμησε στις ΕΜΠΙΣΤΕΣ
 * παραλίες (245/246 έχουν στράβωμα ≤ 1,30) — και αυτό ήταν **κυκλικό**: έμπιστες είναι ακριβώς
 * όσες πέρασαν το τεστ ευθείας, άρα η διαδρομή τους είναι ίσια εξ ορισμού. Το σωστό μέτρο είναι
 * το σχήμα της παράκαμψης: γύρω από ακρωτήρι κοστίζει περίπου **π/2 ≈ 1,57×** την ευθεία, γύρω
 * από άκρη νησιού περίπου **π ≈ 3,14×**. Το 2,5 κάθεται ανάμεσά τους: επιτρέπει τα ακρωτήρια,
 * κόβει τους γύρους ολόκληρου νησιού, όπου ο ίδιος άνεμος φτιάχνει άλλη θάλασσα.
 *
 * ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΥΑΙΣΘΗΤΟ ΝΟΥΜΕΡΟ, ΜΕΤΡΗΜΕΝΟ: από 2,0 έως το άπειρο οι επιστροφές πάνε 180 → 192.
 * Τη δουλειά την κάνουν οι άλλοι δύο μάρτυρες — 32 παραλίες δεν έχουν καθόλου δρόμο με νερό και
 * 22 κάθονται πίσω από πραγματικό στένωμα.
 *
 * ⚠️ ΚΑΙ ΜΟΝΟ ΤΟΥ ΔΕΝ ΦΤΑΝΕΙ — ΟΝΟΜΑΣΤΙΚΑ. Το **Σχίσμα Ελούντας**, που τύπωνε 0,94 μ. πάνω από
 * λάδι, έχει το κελί του στον ΙΔΙΟ κόλπο και άρα τέλεια «προσβάσιμο με νερό». Γι' αυτό απαιτείται
 * ΚΑΙ ο δεύτερος μάρτυρας, το στένωμα (`scripts/lib/enclosureWitness.mjs`): όταν η παραλία
 * κάθεται ≥ MIN_DEPTH_RATIO πλάτη στομίου πίσω από πραγματικό στένωμα, το κελί έξω από αυτό δεν
 * περιγράφει το νερό της όσο ίσιος κι αν είναι ο δρόμος. Μετρημένο: Σχίσμα 3,54 → μένει έξω·
 * Κολυμπήθρες 0,76 και ΑΣΤΕΝΩΤΗ → επιστρέφει, όπως λέει ρητά η βίβλος για τη Νάουσα.
 */
export const MAX_TRUSTED_DETOUR = 2.5;

const EARTH_RADIUS_KM = 6371;
const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

export const distanceKm = (aLat, aLon, bLat, bLon) => {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export const bearingDeg = (aLat, aLon, bLat, bLon) => {
  const dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(toRad(bLat));
  const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat))
    - Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/** Great-circle destination, the same one buildMarineSamplePoints walks along a fetch. */
export const destinationPoint = (lat, lon, brg, distKm) => {
  const d = distKm / EARTH_RADIUS_KM;
  const b = toRad(brg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lon2 = lon1 + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: Number(toDeg(lat2).toFixed(4)),
    lon: Number((((toDeg(lon2) + 540) % 360) - 180).toFixed(4)),
  };
};

/** Same lerp between adjacent sectors the runtime resolver uses, so this judges what ships. */
export const interpolatedFetchKm = (sectors, deg) => {
  const pos = (((deg % 360) + 360) % 360) / 45;
  const lo = Math.floor(pos) % 8;
  const hi = (lo + 1) % 8;
  const t = pos - Math.floor(pos);
  const a = sectors?.[SECTORS[lo]]?.fetchKm;
  const b = sectors?.[SECTORS[hi]]?.fetchKm;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a + (b - a) * t;
};

/** Smallest angle between two bearings, 0-180. */
export const bearingGapDeg = (a, b) => {
  const raw = Math.abs(((a - b) % 360 + 360) % 360);
  return raw > 180 ? 360 - raw : raw;
};

export const cacheKey = (modelId, gridDeg, lat, lon) =>
  `${modelId}|${Math.floor(lat / gridDeg)}_${Math.floor(lon / gridDeg)}`;

/**
 * Which model would actually answer at this coordinate: ewam wherever it reports a height, else the
 * next one — mirroring utils/marineForecastParsing.ts. A model that returns an all-null series has
 * not answered, and the runtime moves on, so the verdict has to move with it.
 *
 * `cache` maps cacheKey -> { lat, lon, values } | null.
 */
/**
 * Ποιο κελί εξυπηρετεί αυτό το σημείο σε ΣΥΓΚΕΚΡΙΜΕΝΟ μοντέλο, ανεξάρτητα από το ποιο θα
 * απαντούσε πρώτο στην εκτέλεση. Χρειάζεται όταν ψάχνουμε αν ΚΑΠΟΙΟ μοντέλο βλέπει τη σωστή
 * θάλασσα — ερώτημα διαφορετικό από το «τι θα έπαιρνε σήμερα ο επισκέπτης».
 */
export const servedForModel = (cache, point, modelId) => {
  if (!point) return null;
  const model = MODELS.find(m => m.id === modelId);
  if (!model) return null;
  const served = cache[cacheKey(model.id, model.gridDeg, point.lat, point.lon)];
  return served && served.values > 0 ? { ...served, modelId: model.id } : null;
};

export const servedForRuntime = (cache, point) => {
  if (!point) return null;
  for (const { id, gridDeg } of MODELS) {
    const served = cache[cacheKey(id, gridDeg, point.lat, point.lon)];
    if (served && served.values > 0) return { ...served, modelId: id };
  }
  return null;
};

/** True when every model lookup this point needs is already in the cache. */
export const isPointResolved = (cache, point) =>
  MODELS.every(({ id, gridDeg }) => cacheKey(id, gridDeg, point.lat, point.lon) in cache);

/**
 * The verdict for one beach asking about one coordinate.
 *
 * `profile` needs `coordinates` and `sectors`; `requestPoint` is what the runtime would send.
 */
export const judge = (cache, profile, requestPoint, forceModelId, waterWitness) => {
  if (!requestPoint) return { verdict: 'no-point' };
  // Χωρίς `forceModelId` κρίνεται ό,τι θα έπαιρνε ΣΗΜΕΡΑ ο επισκέπτης. Με αυτό, κρίνεται ένα
  // συγκεκριμένο μοντέλο — για την αναζήτηση «υπάρχει συνδυασμός σημείου × μοντέλου που δουλεύει;».
  const served = forceModelId
    ? servedForModel(cache, requestPoint, forceModelId)
    : servedForRuntime(cache, requestPoint);
  if (!served) return { verdict: 'unknown' };

  const { lat, lon } = profile.coordinates;
  const d = distanceKm(lat, lon, served.lat, served.lon);
  if (d < 0.5) {
    return { verdict: 'trusted', modelId: served.modelId, distanceKm: d, reason: 'cell sits on the beach' };
  }
  const brg = bearingDeg(lat, lon, served.lat, served.lon);
  const fetchKm = interpolatedFetchKm(profile.sectors, brg);
  if (fetchKm === null) return { verdict: 'unknown', modelId: served.modelId };

  const base = { modelId: served.modelId, distanceKm: d, bearingDeg: brg, fetchKm };
  if (d > MAX_TRUSTED_DISTANCE_KM) return { verdict: 'too-far', ...base };
  if (fetchKm >= MIN_FETCH_RATIO * d) return { verdict: 'trusted', ...base };

  /**
   * Η ΕΥΘΕΙΑ ΑΠΕΤΥΧΕ — ΡΩΤΑΜΕ ΤΟ ΝΕΡΟ. `waterWitness` δίνεται ΜΟΝΟ από τον εθνικό έλεγχο, που
   * έχει το ράστερ ακτογραμμής· χωρίς αυτόν η συνάρτηση συμπεριφέρεται ακριβώς όπως πριν.
   *
   * Ο βελτιστοποιητής σημείων ΔΕΝ τον δίνει, και σωστά: όταν ΔΙΑΛΕΓΕΙΣ σημείο, θέλεις ένα που
   * περνάει τον αυστηρό έλεγχο. Η χαλάρωση αφορά μόνο την κρίση ενός σημείου που ήδη υπάρχει.
   */
  const witness = waterWitness ? waterWitness(profile, served) : null;
  if (
    witness
    && typeof witness.detour === 'number' && witness.detour <= MAX_TRUSTED_DETOUR
    && !(witness.constricted === true && typeof witness.depthRatio === 'number' && witness.depthRatio >= witness.minDepthRatio)
  ) {
    return {
      verdict: 'trusted', ...base,
      strictVerdict: 'other-water',
      restoredBy: 'water-route',
      detour: witness.detour,
      waterPathKm: witness.waterPathKm,
      mouthM: witness.mouthM,
      depthRatio: witness.depthRatio,
      constricted: witness.constricted,
    };
  }
  return { verdict: 'other-water', ...base, ...(witness ? {
    detour: witness.detour, waterPathKm: witness.waterPathKm,
    mouthM: witness.mouthM, depthRatio: witness.depthRatio, constricted: witness.constricted,
  } : {}) };
};

const MAX_RETRIES = 4;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Ask ONE model which cell it serves for this coordinate, and whether it has anything to say there.
 * One variable, one day — the lightest request the API bills.
 *
 * Throws on a quota reply so a caller can stop and keep its cache instead of filling it with nulls.
 */
export const lookupServedCell = async (lat, lon, modelId) => {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}`
    + `&hourly=wave_height&forecast_days=1&cell_selection=sea&models=${modelId}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      const json = await res.json();
      if (json?.error) {
        if (String(json.reason || '').includes('limit')) throw new Error(`QUOTA: ${json.reason}`);
        return null;
      }
      if (!Number.isFinite(json?.latitude) || !Number.isFinite(json?.longitude)) return null;
      const series = json?.hourly?.wave_height;
      const values = Array.isArray(series)
        ? series.filter(v => v !== null && v !== undefined).length
        : 0;
      return { lat: json.latitude, lon: json.longitude, values };
    } catch (error) {
      if (String(error.message).startsWith('QUOTA')) throw error;
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
};

/**
 * Fill the cache for a batch of coordinates, deduplicated per model lattice.
 * Returns the number of live lookups made. Sets `state.quotaHit` if the API refused.
 */
export const resolvePoints = async (cache, points, { concurrency = 6, state = {}, onProgress } = {}) => {
  const wanted = new Map();
  for (const point of points) {
    for (const { id, gridDeg } of MODELS) {
      const key = cacheKey(id, gridDeg, point.lat, point.lon);
      if (!(key in cache) && !wanted.has(key)) wanted.set(key, { ...point, modelId: id });
    }
  }
  const queue = [...wanted.entries()];
  const total = queue.length;
  let done = 0;

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length && !state.quotaHit) {
      const [key, point] = queue.shift();
      try {
        cache[key] = await lookupServedCell(point.lat, point.lon, point.modelId);
      } catch (error) {
        if (String(error.message).startsWith('QUOTA')) { state.quotaHit = true; break; }
        cache[key] = null;
      }
      done += 1;
      if (onProgress && done % 50 === 0) onProgress(done, total);
    }
  }));

  return total;
};
