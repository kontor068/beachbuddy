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

export interface BeachForecastCluster {
  key: string;
  lat: number;
  lon: number;
  beachIds: number[];
}

const roundToCluster = (value: number, step: number): number => Math.round(value / step) * step;

export const buildBeachForecastClusters = (beaches: Beach[]): BeachForecastCluster[] => {
  for (const step of BEACH_FORECAST_CLUSTER_STEPS) {
    const grouped = new Map<string, Beach[]>();

    beaches.forEach(beach => {
      const lat = roundToCluster(beach.coordinates.lat, step);
      const lon = roundToCluster(beach.coordinates.lon, step);
      const key = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
      grouped.set(key, [...(grouped.get(key) || []), beach]);
    });

    if (grouped.size <= MAX_BEACH_FORECAST_CLUSTERS || step === BEACH_FORECAST_CLUSTER_STEPS[BEACH_FORECAST_CLUSTER_STEPS.length - 1]) {
      return Array.from(grouped.entries()).map(([key, clusterBeaches]) => {
        const lat = clusterBeaches.reduce((sum, beach) => sum + beach.coordinates.lat, 0) / clusterBeaches.length;
        const lon = clusterBeaches.reduce((sum, beach) => sum + beach.coordinates.lon, 0) / clusterBeaches.length;
        return {
          key,
          lat,
          lon,
          beachIds: clusterBeaches.map(beach => beach.id),
        };
      });
    }
  }

  return [];
};
