// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL BEACH CONTRACT — the single source of truth for "what a beach is".
//
// WHY THIS FILE EXISTS (the architecture lesson):
// Before this file, the shape of a beach was defined in THREE places that could
// silently drift apart:
//   1. types.ts                     (compile-time TS types — app only)
//   2. services/beachDataLoader.ts  (runtime guards — app only)
//   3. scripts/validateCriticalBeachData.mjs (hardcoded allow-lists — build only)
// Three definitions of the same truth = three chances to disagree. When they
// disagree, bad data slips through one gate because another gate "already checks
// it". For an app whose #1 promise is DATA RELIABILITY, that is the worst failure
// mode. So we collapse the vocabulary + validation into ONE dependency-free
// module that both worlds import: Node build scripts AND the browser bundle.
//
// This is the "canonical schema seam" — the sacred boundary. Everything else
// (JSON files, SQLite, a future API) is a transport for records that must satisfy
// THIS contract. Keep this file honest and the data stays portable forever.
//
// Plain JavaScript on purpose: `.mjs` runs directly under `node` (build gate)
// with no ts-loader, and Vite/TS import it in the browser via beachContract.d.ts.
// Zero runtime dependencies, zero cost.
// ─────────────────────────────────────────────────────────────────────────────

/** Bump when the canonical shape changes in a breaking way. Baked payloads carry
 *  their own `schemaVersion`; a mismatch is a signal to rebuild, not to crash. */
export const CONTRACT_VERSION = 1;

// --- Canonical vocabularies (must mirror types.ts exactly) -------------------
// Frozen so no consumer can mutate the shared truth at runtime.
export const BEACH_TYPES = Object.freeze(['sandy', 'pebbles', 'sandy-pebbles', 'rocky', 'unknown']);
export const ACCESSIBILITY = Object.freeze(['EASY', 'MODERATE', 'DIFFICULT', 'BOAT_ONLY']);
export const WATER_DEPTH = Object.freeze(['shallow', 'medium', 'deep']);
export const DATA_CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
export const WIND_DIRECTIONS = Object.freeze([
  'North', 'Northeast', 'East', 'Southeast',
  'South', 'Southwest', 'West', 'Northwest',
]);

/** Greece bounding box — a coordinate outside this is a data bug (wrong hemisphere,
 *  swapped lat/lon, or a foreign beach that leaked in). Mirrors the build gate. */
export const GREECE_BOUNDS = Object.freeze({ minLat: 34, maxLat: 42.5, minLon: 19, maxLon: 30.5 });

// --- Primitive predicates ----------------------------------------------------
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/** True if `coordinates` is a valid {lat,lon} inside Greece. */
export const isGreeceCoordinate = (c) =>
  Boolean(c) &&
  isFiniteNumber(c.lat) && isFiniteNumber(c.lon) &&
  c.lat >= GREECE_BOUNDS.minLat && c.lat <= GREECE_BOUNDS.maxLat &&
  c.lon >= GREECE_BOUNDS.minLon && c.lon <= GREECE_BOUNDS.maxLon;

// --- The validator -----------------------------------------------------------
// Validates the CANONICAL CORE: the fields every beach record must always carry
// and carry correctly, in summary OR detail OR raw form. Optional/enum fields are
// checked ONLY when present (a missing optional is not an error; a present-but-
// invalid one is). This keeps the contract strict on identity + safety-relevant
// facts without coupling to whichever transport trimmed the payload.
//
// Returns { valid, errors }, never throws. Each error: { field, code, message }.
// Non-throwing on purpose: a build gate wants ALL violations at once, not the first.

// Shared field-level checks — enum/range validity for any field THAT IS PRESENT.
// Used by both the full-record and the patch validators so the rules never fork.
function collectFieldViolations(beach, fail) {
  if (beach.rating !== undefined && !(isFiniteNumber(beach.rating) && beach.rating >= 0 && beach.rating <= 5)) {
    fail('rating', 'rating_out_of_range', 'rating must be a number in 0..5');
  }
  if (beach.accessibility !== undefined && !ACCESSIBILITY.includes(beach.accessibility)) {
    fail('accessibility', 'bad_accessibility', `accessibility must be one of ${ACCESSIBILITY.join(', ')}`);
  }
  if (beach.beachType !== undefined && !BEACH_TYPES.includes(beach.beachType)) {
    fail('beachType', 'bad_beach_type', `beachType must be one of ${BEACH_TYPES.join(', ')}`);
  }
  if (beach.waterDepth !== undefined && !WATER_DEPTH.includes(beach.waterDepth)) {
    fail('waterDepth', 'bad_water_depth', `waterDepth must be one of ${WATER_DEPTH.join(', ')}`);
  }
  if (beach.protectedFrom !== undefined) {
    if (!Array.isArray(beach.protectedFrom)) {
      fail('protectedFrom', 'protected_from_not_array', 'protectedFrom must be an array of compass directions');
    } else {
      for (const dir of beach.protectedFrom) {
        if (!WIND_DIRECTIONS.includes(dir)) {
          fail('protectedFrom', 'bad_wind_direction', `"${dir}" is not a canonical wind direction`);
          break; // one report per field is enough for a gate
        }
      }
    }
  }
}

/**
 * Validate a FULL beach record (summary or raw form): identity + location are
 * mandatory, plus every present enum must be canonical.
 * @param {any} beach
 * @returns {{ valid: boolean, errors: Array<{ field: string, code: string, message: string }> }}
 */
export function validateBeachRecord(beach) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!beach || typeof beach !== 'object') {
    fail('$', 'not_an_object', 'Beach record is not an object');
    return { valid: false, errors };
  }

  // Identity ------------------------------------------------------------------
  if (!isFiniteNumber(beach.id)) fail('id', 'missing_id', 'id must be a finite number');

  // Name: en + gr are mandatory (the two languages every UI path relies on).
  if (!beach.name || typeof beach.name !== 'object') {
    fail('name', 'missing_name', 'name object is required');
  } else {
    if (!isNonEmptyString(beach.name.en)) fail('name.en', 'missing_name_en', 'name.en is required');
    if (!isNonEmptyString(beach.name.gr)) fail('name.gr', 'missing_name_gr', 'name.gr is required');
  }

  // Location — safety-relevant: a wrong coordinate wrecks wind/geo scoring. -----
  if (!isGreeceCoordinate(beach.coordinates)) {
    fail('coordinates', 'coordinate_out_of_range',
      'coordinates must be a {lat,lon} inside Greece ' +
      `(${GREECE_BOUNDS.minLat}..${GREECE_BOUNDS.maxLat}, ${GREECE_BOUNDS.minLon}..${GREECE_BOUNDS.maxLon})`);
  }

  collectFieldViolations(beach, fail);
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a PARTIAL beach record (a detail/override *patch* that merges onto a
 * summary via mergeBeachDetailData). Identity/location are legitimately absent,
 * so only `id` is required; every field that IS present must still be canonical.
 * Catches a bad enum in an override without false-flagging the omitted fields.
 * @param {any} beach
 * @returns {{ valid: boolean, errors: Array<{ field: string, code: string, message: string }> }}
 */
export function validateBeachPatch(beach) {
  const errors = [];
  const fail = (field, code, message) => errors.push({ field, code, message });

  if (!beach || typeof beach !== 'object') {
    fail('$', 'not_an_object', 'Beach patch is not an object');
    return { valid: false, errors };
  }
  if (!isFiniteNumber(beach.id)) fail('id', 'missing_id', 'patch must carry a numeric id to merge on');

  collectFieldViolations(beach, fail);
  return { valid: errors.length === 0, errors };
}
