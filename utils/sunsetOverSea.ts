import type { Beach } from '../types';
import { WindDirection } from '../types';
import { windDirectionToDegrees } from './windExposure';

/**
 * "Sunset over the sea" window — the months when the setting sun is over the water
 * in front of a beach, computed from shoreline orientation + the sun's setting
 * bearing at the beach's latitude. This is CalmBeach's honest answer to the
 * competitor sun-diagram ("Sunset over the sea: Nov–Jan"), built from data we
 * already have rather than a hand-guessed month range.
 *
 * Honesty: `orientation` records which way the shore FACES, not a surveyed horizon,
 * so a headland or offshore island can still block the sun — the same caveat that
 * already lives in `isSunsetFacingBeach` and in each beach's `orientation.notes`.
 * Treat the window as an orientation-based estimate, never a guarantee.
 */

// Half-width of the open-sea horizon arc we treat as "in front of" the beach. A
// shore facing bearing D is taken to have open water across D ± SEA_ARC_HALF. 67.5°
// (a 135° seaward window) is wide enough to be realistic yet narrow enough that only
// genuinely west-facing beaches ever qualify — an east-facing beach returns nothing.
const SEA_ARC_HALF_DEG = 67.5;

// Mid-month day-of-year (non-leap), used for a month-granularity claim.
const MID_MONTH_DAY_OF_YEAR = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// Solar declination (deg) for a day-of-year — standard low-error approximation
// (±0.2°), plenty for a month-level window. Ranges −23.44° (≈21 Dec) to +23.44° (≈21 Jun).
const solarDeclinationDeg = (dayOfYear: number): number =>
  -23.44 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));

/**
 * Compass bearing (deg clockwise from true north) where the sun SETS at latitude
 * `latDeg` on the given day-of-year. Sweeps ≈240° (WSW, midwinter) → ≈300° (WNW,
 * midsummer) at Greek latitudes. Returns null inside the polar circles where the sun
 * may not set that day (never occurs in Greece).
 */
export const sunsetAzimuthDeg = (latDeg: number, dayOfYear: number): number | null => {
  const decl = solarDeclinationDeg(dayOfYear);
  const cosA = Math.sin(toRad(decl)) / Math.cos(toRad(latDeg));
  if (cosA < -1 || cosA > 1) return null;
  // acos gives the sunRISE bearing (0–180, eastern side); the setting sun mirrors it west.
  return 360 - toDeg(Math.acos(cosA));
};

// Smallest absolute angular gap between two bearings (0–180).
const angularGapDeg = (a: number, b: number): number => {
  const raw = Math.abs((((a - b) % 360) + 360) % 360);
  return raw > 180 ? 360 - raw : raw;
};

// The bearing the shore faces: prefer the precise `orientation.degrees`, else the
// centre of the first octant in `orientation.faces`. null when neither is present.
const facingBearingDeg = (beach: Beach): number | null => {
  const deg = beach.orientation?.degrees;
  if (typeof deg === 'number' && Number.isFinite(deg)) return ((deg % 360) + 360) % 360;
  const faces = beach.orientation?.faces;
  if (Array.isArray(faces) && faces.length > 0) return windDirectionToDegrees(faces[0] as WindDirection);
  return null;
};

export interface SunsetOverSea {
  /** The sun sets over this beach's sea for at least part of the year. */
  everOverSea: boolean;
  /** True every month (a due-west beach). */
  allYear: boolean;
  /** Month indices (0 = Jan) whose mid-month sunset is over the sea. */
  months: number[];
}

/**
 * Which months the sunset is over the sea for a beach. Empty for beaches that never
 * face the setting sun (e.g. east-facing) or that lack orientation/coordinates.
 */
export const sunsetOverSeaWindow = (beach: Beach): SunsetOverSea => {
  const facing = facingBearingDeg(beach);
  const lat = beach.coordinates?.lat;
  if (facing == null || typeof lat !== 'number' || !Number.isFinite(lat)) {
    return { everOverSea: false, allYear: false, months: [] };
  }
  const months: number[] = [];
  for (let m = 0; m < 12; m += 1) {
    const az = sunsetAzimuthDeg(lat, MID_MONTH_DAY_OF_YEAR[m]);
    if (az != null && angularGapDeg(az, facing) <= SEA_ARC_HALF_DEG) months.push(m);
  }
  return { everOverSea: months.length > 0, allYear: months.length === 12, months };
};

/**
 * The (single) contiguous month arc from a `months` set, year-wrap aware
 * (e.g. [0,1,10,11] → { start: 10, end: 1 } = Nov→Feb). Returns null when the
 * window is empty or covers the whole year — callers render those as their own copy.
 * The month set is always one contiguous arc because the sunset bearing moves
 * monotonically between the solstices.
 */
export const sunsetSeasonRange = (months: number[]): { start: number; end: number } | null => {
  if (months.length === 0 || months.length === 12) return null;
  const present = new Set(months);
  // Find a month whose predecessor is absent — that is the arc start.
  const start = [...months].sort((a, b) => a - b).find(m => !present.has((m + 11) % 12));
  if (start == null) return null;
  let end = start;
  while (present.has((end + 1) % 12)) end = (end + 1) % 12;
  return { start, end };
};
