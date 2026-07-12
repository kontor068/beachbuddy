import type { Beach, GeospatialExposureProfile, WindSector } from '../types';
import type { ExposureLevel } from './windExposure';
import { resolveBeachWindProfile } from './windExposureEngine';

/**
 * Greek summer wind climatology helpers.
 *
 * The dominant summer regime in the Aegean is the Meltemi (a dry north / north-
 * easterly), so a beach's behaviour under N+NE wind is the single most useful
 * "what is this beach usually like in summer" signal. These helpers derive that
 * from the precomputed directional exposure profile at zero extra cost and are
 * used for forward-looking labelling and as a light tiebreak on calm days.
 */

const rank: Record<ExposureLevel, number> = { protected: 0, partial: 1, exposed: 2 };
const moreExposed = (a: ExposureLevel, b: ExposureLevel): ExposureLevel => (rank[a] >= rank[b] ? a : b);

const MELTEMI_SECTORS: WindSector[] = ['N', 'NE'];

/**
 * How a beach behaves in a given wind regime (the more exposed of the regime's
 * sectors — never under-warn). `sectors` is the local summer wind's directions:
 * ['N','NE'] for the Aegean meltemi, ['NW','W'] for the Ionian maistros / Thermaic
 * summer breeze (see utils/localWindContext.mjs). Returns undefined when the
 * profile lacks data.
 *
 * Curated authored knowledge WINS over raw geometry (the model-wide precedence
 * rule): pass the beach so a wind-sport spot (Prasonisi/Vasiliki class) or an
 * explicit curated exposure in a regime sector can never be endorsed as shelter,
 * and suspect-pin geometry makes no seasonal claim at all.
 */
export const summarizeLocalWindBehavior = (
  profile?: GeospatialExposureProfile,
  beach?: Beach,
  sectors: WindSector[] = MELTEMI_SECTORS
): ExposureLevel | undefined => {
  if (beach) {
    const { profile: curated, source } = resolveBeachWindProfile(beach);
    if (source !== 'unknown') {
      if (curated.knownWindSportSpot) return 'exposed';
      if (sectors.some(sector => curated.exposedToWindDirections.includes(sector))) return 'exposed';
      if (curated.suspectPin) return undefined;
    }
  }

  if (!profile?.sectors) return undefined;
  const levels = sectors
    .map(sector => profile.sectors[sector]?.level)
    .filter((level): level is ExposureLevel => Boolean(level));
  if (levels.length === 0) return undefined;
  return levels.reduce(moreExposed);
};

/** True when a beach stays sheltered in a given regime's sectors. */
export const isLocalWindSheltered = (
  profile?: GeospatialExposureProfile,
  beach?: Beach,
  sectors: WindSector[] = MELTEMI_SECTORS
): boolean => summarizeLocalWindBehavior(profile, beach, sectors) === 'protected';

/** Meltemi = the Aegean special case (N+NE). Kept for existing callers. */
export const summarizeMeltemiBehavior = (
  profile?: GeospatialExposureProfile,
  beach?: Beach
): ExposureLevel | undefined => summarizeLocalWindBehavior(profile, beach, MELTEMI_SECTORS);

/** True when a beach stays sheltered in a typical Meltemi (good summer default). */
export const isMeltemiSheltered = (profile?: GeospatialExposureProfile, beach?: Beach): boolean => (
  summarizeMeltemiBehavior(profile, beach) === 'protected'
);
