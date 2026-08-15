import type { Beach } from '../types';

/**
 * WHERE THE APP ASKS ABOUT WIND, one point per group of nearby beaches.
 *
 * This used to live inside hooks/useWeather.ts. It moved here for the reason utils/seaArrival.ts
 * and utils/marineForecastParsing.ts moved: a gate cannot load useWeather without dragging in
 * React, the network layer and analyticsService (which uses `import.meta`, unavailable under the
 * CommonJS build the offline validators run). Decision-grade logic has to be runnable by the
 * thing that checks it — scripts/validateEffectiveRanking.ts records what happens otherwise: a
 * gate that re-implements its subject passes green against deliberately sabotaged code.
 *
 * Nothing about the behaviour changed in the move. The steps, the target and the centroid rule
 * are the ones that have shipped since the clusters were introduced.
 */

/**
 * Grouping grids, tried coarsest-last. A region is grouped at the first step that lands at or
 * under the target below; if none does, the last step is used whatever it produces.
 */
export const BEACH_FORECAST_CLUSTER_STEPS = [0.05, 0.08, 0.12];

/**
 * A TARGET, NOT A CAP — and deliberately so. Read buildBeachForecastClusters: the last step
 * returns whatever it produced, so large regions exceed this and always have. Measured: Evia 34
 * clusters, Halkidiki 28, Chania 20. 32 of 110 regions are over.
 *
 * DO NOT "fix" this by forcing the number down. Coarser grouping was measured too: at 0.5° Evia
 * collapses to 7 clusters but a beach then takes its forecast from up to 31 km away, while the UI
 * keeps stating the same confident figure. docs/methodology-wind-exposure-GR.md forbids exactly
 * that — never claim calm without positive evidence for THIS shore — so weakening the evidence 4x
 * to save calls is the one change that is not allowed here.
 *
 * The cost is paid the right way instead: since 30/07/2026 these coordinates go out BATCHED, up
 * to 32 points per request (fetchForecastDataBatch), so Evia's 34 clusters cost 2 requests per
 * endpoint rather than 34.
 *
 * The rule that has not changed: if capacity ever tightens again, batch harder or cache longer —
 * do NOT sample fewer places.
 */
export const MAX_BEACH_FORECAST_CLUSTERS = 6;

/**
 * HOW FAR a beach may sit from the point that supplies its wind. Added 09/08/2026, the day the
 * paid Open-Meteo plan (1M calls/month) replaced the free per-IP quota: the rule above — "do NOT
 * sample fewer places" — finally got to run in its natural direction, spending points instead of
 * merely refusing to drop them.
 *
 * The number is MEASURED, not chosen. Live probe against Open-Meteo (09/08/2026, real beach
 * pairs, 48 h of hourly wind each):
 *
 *   pairs 2–3 km apart    → 3/4 got byte-identical wind (same model cell — refining buys nothing)
 *   pairs 3.5–4.5 km      → 3/4 identical
 *   pairs 5–6 km          → 2/4 identical
 *   pairs 6.5–8 km        → 1/4 identical, Beaufort differs in 23% of hours
 *   the old worst cases (8–10 km): different wind in 13/16 pairs, and the BEAUFORT — the unit
 *   every colour and verdict switches on — differed in 36% of hours.
 *
 * So 4 km is the knee: below it the model usually answers from the same cell (identical numbers,
 * pure waste); above it the answers genuinely diverge. National cost, measured over all 110
 * regions before shipping: 714 → 1,156 points (+62%), and the beaches sampled from >4 km away
 * fall from 449 (15.7%) to 0.
 *
 * Splitting is by the same grid family (finer steps), so it stays deterministic and the offline
 * validators run the exact shipped logic.
 */
export const MAX_SAMPLING_DISTANCE_KM = 4;

/** Finer grids used ONLY to split clusters that violate MAX_SAMPLING_DISTANCE_KM. */
const REFINEMENT_STEPS = [0.04, 0.03, 0.02, 0.015];

/**
 * WHY DISTANCE WAS NEVER ENOUGH — measured 15/08/2026, Elafonisi.
 *
 * MAX_SAMPLING_DISTANCE_KM was calibrated (09/08) on the belief that the model answers from a
 * 0.25° grid, so 4 km was comfortably inside one cell. It is not. Open-Meteo's `best_match`
 * answers Greece from a ~0.0625° grid (≈6 km), and — more importantly — it does NOT hand back
 * the nearest cell: the default `cell_selection=land` walks a 90 m elevation model to find a
 * LAND cell of similar height to the point asked about. Two consequences, both measured:
 *
 *   1. A centroid is a synthetic point. Elafonisi's cluster centroid (5 beaches, 3.51 km away —
 *      inside the 4 km budget) resolved to a cell at 34 m elevation reading 50.9 km/h, while the
 *      beach itself resolved to a 1 m cell reading 43.2 km/h. The card said 7 Bft for a beach
 *      having 6, with a live webcam showing flat water.
 *   2. The cell CANNOT be derived offline. Snapping a coordinate to a 0.0625° box predicts the
 *      cell Open-Meteo actually returns for only 48.9% of our 2.862 beaches (probed 15/08) —
 *      the land/elevation walk moves the other half. So the cell has to be measured once and
 *      baked: scripts/bakeForecastModelCells.mjs writes it, buildBeachRegionData stamps it onto
 *      every beach as `forecastCell`, and the pass below is the only consumer.
 *
 * National measurement, 2.862 beaches probed 15/08/2026:
 *   distinct model cells                                     632
 *   clusters before this pass / after                        1.157 → 1.382 (+19.4%)
 *   beaches in a cluster that straddles two or more cells    289 (10.1%)
 *
 * The pass is SPLIT-ONLY on purpose. Grouping straight by cell would cost less (632 points) but
 * it MERGES clusters, and resolveClusterMarinePoint in hooks/useWeather.ts averages the members'
 * marine sample points behind a pairwise-spread guard — bigger clusters make that guard fail and
 * fall back to the centroid, trading a wind fix for a wave regression. Splitting only ever makes
 * the marine side tighter. The cheaper "one grouping for wind, another for waves" shape is a
 * separate change and is NOT what shipped here.
 */
const splitBySharedModelCell = (clusters: Beach[][]): Beach[][] =>
  clusters.flatMap(members => {
    // A region built before the bake — or one beach missing its cell — keeps the old behaviour
    // rather than being split on a half-known signal. Fallback is guarded, not assumed.
    if (members.some(beach => !beach.forecastCell)) return [members];

    const byCell = new Map<string, Beach[]>();
    for (const beach of members) {
      const cell = beach.forecastCell as string;
      byCell.set(cell, [...(byCell.get(cell) || []), beach]);
    }
    return [...byCell.values()];
  });

/**
 * The point that will be sent to Open-Meteo for this group.
 *
 * A centroid is only safe when we cannot do better. When every member shares a baked cell, we
 * send a REAL member coordinate instead — the one nearest the centroid — because that coordinate
 * is the one we probed, so the cell that comes back is the cell we recorded. A centroid carries
 * no such guarantee: it is a point nobody ever asked the model about.
 */
const samplingPointFor = (members: Beach[]): { lat: number; lon: number } => {
  const centroid = centroidOf(members);
  const cell = members[0]?.forecastCell;
  if (!cell || members.some(beach => beach.forecastCell !== cell)) return centroid;

  let best = members[0];
  let bestDistance = Infinity;
  for (const beach of members) {
    const d = distanceKm(centroid.lat, centroid.lon, beach.coordinates.lat, beach.coordinates.lon);
    // Ties break on id so the choice is stable across runs and machines — the offline gates
    // rebuild these clusters and compare them against the shipped ones.
    if (d < bestDistance || (d === bestDistance && beach.id < best.id)) {
      best = beach;
      bestDistance = d;
    }
  }
  return { lat: best.coordinates.lat, lon: best.coordinates.lon };
};

export interface BeachForecastCluster {
  key: string;
  lat: number;
  lon: number;
  beachIds: number[];
}

const roundToCluster = (value: number, step: number): number => Math.round(value / step) * step;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in km. Local copy — this module must stay React/network-free. */
const distanceKm = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const centroidOf = (members: Beach[]): { lat: number; lon: number } => ({
  lat: members.reduce((sum, b) => sum + b.coordinates.lat, 0) / members.length,
  lon: members.reduce((sum, b) => sum + b.coordinates.lon, 0) / members.length,
});

const gridAt = (beaches: Beach[], step: number): Map<string, Beach[]> => {
  const grouped = new Map<string, Beach[]>();
  beaches.forEach(beach => {
    const lat = roundToCluster(beach.coordinates.lat, step);
    const lon = roundToCluster(beach.coordinates.lon, step);
    const key = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
    grouped.set(key, [...(grouped.get(key) || []), beach]);
  });
  return grouped;
};

/**
 * Split any cluster whose furthest member sits beyond MAX_SAMPLING_DISTANCE_KM from the point
 * that would supply its forecast, using successively finer grids. A cluster that a finer grid
 * cannot split (all members in one cell) is kept as-is — density, not distance, is then the
 * limiting factor, and singles obviously stop. Order-independent and pure.
 */
const refineByDistance = (clusters: Beach[][]): Beach[][] => {
  const done: Beach[][] = [];
  let queue = clusters;

  for (const step of REFINEMENT_STEPS) {
    const next: Beach[][] = [];
    for (const members of queue) {
      const at = centroidOf(members);
      const worstKm = Math.max(...members.map(b => distanceKm(b.coordinates.lat, b.coordinates.lon, at.lat, at.lon)));
      if (worstKm <= MAX_SAMPLING_DISTANCE_KM || members.length === 1) {
        done.push(members);
        continue;
      }
      const finer = gridAt(members, step);
      if (finer.size === 1) {
        // This step cannot separate them; a later, finer step might.
        next.push(members);
        continue;
      }
      next.push(...finer.values());
    }
    queue = next;
    if (queue.length === 0) break;
  }

  return [...done, ...queue];
};

export const buildBeachForecastClusters = (beaches: Beach[]): BeachForecastCluster[] => {
  for (const step of BEACH_FORECAST_CLUSTER_STEPS) {
    const grouped = gridAt(beaches, step);

    if (grouped.size <= MAX_BEACH_FORECAST_CLUSTERS || step === BEACH_FORECAST_CLUSTER_STEPS[BEACH_FORECAST_CLUSTER_STEPS.length - 1]) {
      // Distance first, then model cell: refining by distance can only make a group tighter, and
      // a tighter group is never split further by the cell pass than a loose one would be.
      const refined = splitBySharedModelCell(refineByDistance(Array.from(grouped.values())));
      return refined.map(clusterBeaches => {
        const { lat, lon } = samplingPointFor(clusterBeaches);
        // Key from the actual sampling point (4 decimals ≈ 11 m): refined siblings must not
        // collide, and the old snapped-grid key could not tell them apart. Two clusters cannot
        // share a key because they cannot share the beach the point came from.
        return {
          key: `${lat.toFixed(4)}_${lon.toFixed(4)}`,
          lat,
          lon,
          beachIds: clusterBeaches.map(beach => beach.id),
        };
      });
    }
  }

  return [];
};
