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

type RawRegionIndex = { regions?: Record<string, number[]> };

let regionIndexRequest: Promise<Record<number, string> | undefined> | null = null;

/**
 * Which region holds a given beach's geometry.
 *
 * Beach records carry no `regionId`, and several surfaces legitimately cannot supply one:
 * "Κοντά μου" builds a synthetic region spanning many real ones, saved beaches span
 * whatever the user kept, and the map hover has only a marker. Without this lookup those
 * screens can never resolve their geometry and the drawing silently never appears.
 *
 * Fetched once, and only when a caller-supplied region did not already answer the question.
 */
export const loadShorelineRegionIndex = (): Promise<Record<number, string> | undefined> => {
  if (regionIndexRequest) return regionIndexRequest;

  regionIndexRequest = fetch('/data/coastline/shape/index.json')
    .then(response => (response.ok ? response.json() : undefined))
    .then((payload: RawRegionIndex | undefined) => {
      if (!payload?.regions) return undefined;
      const lookup: Record<number, string> = {};
      for (const [regionId, beachIds] of Object.entries(payload.regions)) {
        for (const beachId of beachIds) lookup[beachId] = regionId;
      }
      return lookup;
    })
    .catch(() => undefined);

  return regionIndexRequest;
};

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
