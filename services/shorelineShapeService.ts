/**
 * Loads the pre-computed shoreline thumbnail geometry (scripts/buildShorelineThumbs.mjs).
 *
 * The payload is tiny (~10KB for a 44-beach region) and is only fetched for regions that
 * actually have a shape file, so regions still on the old placeholder cost nothing.
 */

export type ShorelineShape = {
  /** Polyline points in the 200x120 box, "x,y x,y ..." — sea above the line, land below. */
  points: string;
  /** Seaward normal the shape was rotated by, so callers can place a wind arrow. */
  facingDeg: number;
  /** Distance in metres from the beach pin to the drawn shoreline. */
  pinDistanceM: number;
  /** Metres of real coast across the full frame — the basis for the scale bar. */
  frameWidthM: number;
};

export type ShorelineShapeLookup = Record<number, ShorelineShape>;

export const SHORELINE_BOX = { width: 200, height: 120, pinX: 100, pinY: 78 } as const;

type RawShape = { s?: string; f?: number; d?: number; w?: number };
type RawPayload = { v?: number; beaches?: Record<string, RawShape> };

const shapeCache = new Map<string, Promise<ShorelineShapeLookup | undefined>>();

const buildShapeUrl = (regionId: string) => `/data/coastline/shape/${regionId}.json`;

const normalize = (payload: RawPayload): ShorelineShapeLookup | undefined => {
  if (!payload?.beaches) return undefined;

  return Object.entries(payload.beaches).reduce<ShorelineShapeLookup>((lookup, [id, raw]) => {
    const beachId = Number(id);
    if (!Number.isFinite(beachId)) return lookup;
    if (typeof raw?.s !== 'string' || raw.s.length === 0) return lookup;

    lookup[beachId] = {
      points: raw.s,
      facingDeg: typeof raw.f === 'number' ? raw.f : 0,
      pinDistanceM: typeof raw.d === 'number' ? raw.d : 0,
      frameWidthM: typeof raw.w === 'number' ? raw.w : 0,
    };
    return lookup;
  }, {});
};

export const loadShorelineShapes = (
  regionId: string
): Promise<ShorelineShapeLookup | undefined> => {
  const cached = shapeCache.get(regionId);
  if (cached) return cached;

  const request = fetch(buildShapeUrl(regionId))
    .then(response => (response.ok ? response.json() : undefined))
    .then(payload => (payload ? normalize(payload as RawPayload) : undefined))
    // A missing shape file is the normal state for regions not yet built — stay quiet.
    .catch(() => undefined);

  shapeCache.set(regionId, request);
  return request;
};
