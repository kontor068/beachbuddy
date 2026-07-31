/**
 * WHICH SEA POINT EACH BEACH READS — the single definition, callable from Node.
 *
 * Deliberately dependency-free, for the same reason utils/marineForecastParsing.ts is:
 * services/weatherService.ts pulls in the analytics and provider modules, and a guard that
 * wants to prove this behaviour must not have to load that whole graph to reach one pure
 * function. Here it is importable on its own — so scripts/validateBeachMarineResolution.mjs
 * checks THE code that ships, instead of a second copy of it.
 *
 * That distinction is not theoretical in this repo. scripts/validateEffectiveRanking.ts:16-18
 * records a gate that passed green on deliberately sabotaged code precisely because it had
 * re-implemented what it was checking, and scripts/windSpreadNational.mjs is already a second
 * hand-written copy of the cluster builder. There is no third copy of anything here.
 *
 * THE RULE: a beach asks the wave model about ITS OWN shore.
 *
 * Every beach carries `marineSamplePoint` in its geospatial profile — a point pushed offshore
 * along its own open fetch (bearing = the profile's facingDeg, distance capped at 10 km). This
 * module hands that point back verbatim and never invents a new one:
 *
 *   - no averaging of two beaches' points (the mean of two sides of a cape is the dry land
 *     between them — that is what resolveClusterMarinePoint had to defend against with a
 *     pairwise-spread test, and it fell back to the centroid in 357 of 712 clusters, 50.1%);
 *   - no snapping to a model grid (moving the coordinate can put it on the land side, where
 *     `cell_selection=sea` then walks to a cell we never chose — measured at Σχινιάς, 11.0 km
 *     away across a headland in a different basin);
 *   - a beach with no sample point of its own reads the REGION point, unchanged from today.
 *     Its own coordinate is not a substitute: the pin is on the shore, and the walk to sea from
 *     there is exactly the failure above.
 *
 * Why per beach at all, when one point per region is cheaper: utils/marineForecastParsing.ts
 * pins `ewam` (0.05° ≈ 5 km) as the model that decides the wave, and over 496 meltemi cases the
 * north-vs-south coast difference it resolves was 1.11 m with the correct sign 496 times out of
 * 496. Asking once per region throws that resolution away before it reaches the screen: Γομάτι
 * (faces NE) and Κάσπακας (faces W) on Lemnos, 11 km apart, both printed 1.3 m on 31/07/2026
 * while ewam said 1.80 and 1.20 at their own shores.
 *
 * THE SAFETY NET IS NOT HERE. utils/waveModel.resolveEffectiveWaveHeightM still takes the LARGER
 * of the measurement and this app's own fetch-limited SMB + wind-chop floor. Changing which cell
 * we measure changes only that function's ARGUMENT, never its rule.
 */

/** A coordinate we can ask the marine API about. */
export interface MarinePoint {
  lat: number;
  lon: number;
}

/** The only fields of a geospatial profile this module needs. Structural on purpose, so the
 *  module stays importable without types.ts and the whole graph behind it. */
export interface MarineSampleProfile {
  facingDeg?: number | null;
  marineSamplePoint?: MarinePoint & { bearingDeg?: number; distanceKm?: number };
}

export type MarineSampleProfileLookup = Record<number, MarineSampleProfile | undefined>;

export interface BeachMarineResolution {
  /** Unique coordinates to request, region point first. Feed straight to fetchMarineForecastDataBatch. */
  points: MarinePoint[];
  /** beachId → key into the fetched map. Every beach has an entry; beaches with no sample point
   *  of their own map to the region key, so a caller never has to special-case them. */
  keyByBeachId: Map<number, string>;
  /** The region point's key, for callers that need the area figure itself. */
  regionKey: string;
  /** Beaches reading their own shore. */
  ownShoreBeachIds: number[];
  /** Beaches with no sample point, reading the region cell exactly as before this change. */
  regionFallbackBeachIds: number[];
}

/**
 * Stable key for a point, at the 3-decimal precision the per-point cache keys already use.
 *
 * services/weatherService.ts re-exports THIS function as `forecastPointKey` rather than
 * declaring its own: the resolver decides which points are distinct and the fetch layer decides
 * which responses map back to them, and the day those two disagree a beach silently reads
 * another beach's water.
 */
export const marinePointKey = (lat: number, lon: number): string =>
  `${lat.toFixed(3)},${lon.toFixed(3)}`;

/**
 * The largest number of marine points one region view may request.
 *
 * Not a cap that truncates — nothing is dropped if it is exceeded, because sampling fewer places
 * to save calls is the one change hooks/useWeather.ts forbids outright. It exists so a gate can
 * notice a data change that explodes the request count. Measured 01/08/2026 over all 110 regions:
 * the worst is Halkidiki at 133 points (5 batched requests of 32), then Evia 129, Corfu 105.
 */
export const MAX_EXPECTED_MARINE_POINTS_PER_REGION = 160;

/**
 * Resolve the marine point every beach in a region should read.
 *
 * `regionPoint` is the area coordinate the region forecast itself uses (island.coordinates, or
 * its MARINE_POINT_OVERRIDES entry). It is always included in `points`, both because the region
 * headline needs it and because it is the honest fallback for a beach without its own geometry.
 */
export const resolveBeachMarinePoints = (
  beaches: ReadonlyArray<{ id: number }>,
  profiles: MarineSampleProfileLookup | undefined,
  regionPoint: MarinePoint
): BeachMarineResolution => {
  const regionKey = marinePointKey(regionPoint.lat, regionPoint.lon);
  const points: MarinePoint[] = [regionPoint];
  const seen = new Set<string>([regionKey]);
  const keyByBeachId = new Map<number, string>();
  const ownShoreBeachIds: number[] = [];
  const regionFallbackBeachIds: number[] = [];

  for (const beach of beaches) {
    const sample = profiles?.[beach.id]?.marineSamplePoint;

    if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) {
      keyByBeachId.set(beach.id, regionKey);
      regionFallbackBeachIds.push(beach.id);
      continue;
    }

    const key = marinePointKey(sample.lat, sample.lon);
    // Two beaches whose sample points round to the same 3 decimals are asking about the same
    // coordinate, so one request answers both. This is deduplication of identical questions, not
    // grouping of nearby ones — nothing is moved to make it happen.
    if (!seen.has(key)) {
      seen.add(key);
      points.push({ lat: sample.lat, lon: sample.lon });
    }
    keyByBeachId.set(beach.id, key);
    ownShoreBeachIds.push(beach.id);
  }

  return { points, keyByBeachId, regionKey, ownShoreBeachIds, regionFallbackBeachIds };
};

/** Great-circle distance in km. Used by the gates to decide whether two beaches face water far
 *  enough apart that one shared reading would misdescribe one of them. */
export const marinePointDistanceKm = (a: MarinePoint, b: MarinePoint): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** Smallest angle between two compass bearings, in degrees (0–180). */
export const bearingDifferenceDeg = (a: number, b: number): number => {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
};
