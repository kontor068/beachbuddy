import type { GeospatialExposureProfile, WindSector } from '../types';
import type { ExposureLevel } from './windExposure';

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
 * How a beach behaves in a typical Meltemi (the more exposed of its N and NE
 * sectors — never under-warn). Returns undefined when the profile lacks data.
 */
export const summarizeMeltemiBehavior = (
  profile?: GeospatialExposureProfile
): ExposureLevel | undefined => {
  if (!profile?.sectors) return undefined;
  const levels = MELTEMI_SECTORS
    .map(sector => profile.sectors[sector]?.level)
    .filter((level): level is ExposureLevel => Boolean(level));
  if (levels.length === 0) return undefined;
  return levels.reduce(moreExposed);
};

/** True when a beach stays sheltered in a typical Meltemi (good summer default). */
export const isMeltemiSheltered = (profile?: GeospatialExposureProfile): boolean => (
  summarizeMeltemiBehavior(profile) === 'protected'
);
