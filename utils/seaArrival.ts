import type { GeospatialExposureProfile } from '../types';
import { interpolateSectorGeometry } from './windExposureModel';
import type { SeaArrivalGeometry } from './waveModel';

/**
 * Where a measured sea is arriving from, in this beach's own frame — the input that lets the
 * light-wind cap tell "a real sea running onto this shore" from "a grid cell describing water
 * behind it". Returns undefined when we lack the geometry to judge, in which case the cap falls
 * back to its original direction-blind behaviour.
 *
 * It lives in its own file rather than inside recommendationService for the same reason
 * utils/marineForecastParsing.ts does: a gate could not load it there without dragging in the
 * whole network and analytics graph, and analyticsService uses `import.meta`, which does not
 * compile under the CommonJS build the offline validators run. Decision-grade logic has to be
 * runnable by the thing that checks it. This was found the hard way — scripts/validateEffectiveRanking.ts
 * spent its first run passing `undefined` here, which made its light-wind cap harsher than
 * production's and charged the geometry with harm it does not do.
 */
export const resolveSeaArrival = (
  geospatialProfile: GeospatialExposureProfile | undefined,
  facingDeg: number | null | undefined,
  waveDirectionDeg: number | undefined
): SeaArrivalGeometry | undefined => {
  if (!geospatialProfile) return undefined;
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return undefined;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return undefined;
  return {
    onshore: Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180),
    fetchKm: interpolateSectorGeometry(geospatialProfile, waveDirectionDeg).fetchKm,
  };
};
