import type { DataConfidence, GeospatialExposureProfile, WindSector } from '../types';
import type { ExposureLevel } from '../utils/windExposure';

export type GeospatialExposureProfileLookup = Record<number, GeospatialExposureProfile>;

type RawGeospatialSectorExposure = {
  level: ExposureLevel;
  fetchKm: number;
  blockedRayRatio: number;
};

type RawGeospatialExposureProfile = {
  beachId: number;
  sectors: Record<WindSector, RawGeospatialSectorExposure>;
  confidence: DataConfidence;
};

type RawGeospatialExposurePayload = {
  profiles?: Record<string, RawGeospatialExposureProfile>;
};

const windSectors: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const profileCache = new Map<string, Promise<GeospatialExposureProfileLookup | undefined>>();

const buildProfileUrl = (regionId: string) => `/data/geospatial/exposure/${regionId}.json`;

const isUsableGeneratedProfile = (profile: RawGeospatialExposureProfile): boolean => {
  const levels = windSectors.map(sector => profile.sectors?.[sector]?.level);
  if (levels.some(level => !level)) return false;

  return !levels.every(level => level === 'protected');
};

const normalizeProfiles = (
  payload: RawGeospatialExposurePayload
): GeospatialExposureProfileLookup | undefined => {
  if (!payload.profiles) return undefined;

  const lookup = Object.values(payload.profiles).reduce<GeospatialExposureProfileLookup>((currentLookup, profile) => {
    if (!profile.beachId || !profile.sectors) return currentLookup;
    if (!isUsableGeneratedProfile(profile)) return currentLookup;

    currentLookup[profile.beachId] = {
      beachId: profile.beachId,
      sectors: profile.sectors,
      confidence: profile.confidence,
      source: 'natural-earth-baseline',
    };
    return currentLookup;
  }, {});

  return Object.keys(lookup).length > 0 ? lookup : undefined;
};

export const loadGeospatialExposureProfiles = async (
  regionId: string
): Promise<GeospatialExposureProfileLookup | undefined> => {
  if (typeof fetch !== 'function') return undefined;

  const cached = profileCache.get(regionId);
  if (cached) return cached;

  const request = fetch(buildProfileUrl(regionId))
    .then(async response => {
      if (!response.ok) {
        profileCache.delete(regionId);
        return undefined;
      }
      const payload = await response.json() as RawGeospatialExposurePayload;
      return normalizeProfiles(payload);
    })
    .catch(() => {
      profileCache.delete(regionId);
      return undefined;
    });

  profileCache.set(regionId, request);
  return request;
};
