import type { DataConfidence, GeospatialExposureProfile, WindSector } from '../types';
import type { ExposureLevel } from '../utils/windExposure';

export type GeospatialExposureProfileLookup = Record<number, GeospatialExposureProfile>;

type RawGeospatialSectorExposure = {
  level: ExposureLevel;
  fetchKm: number;
  blockedRayRatio: number;
  onshore?: number;
  intensity?: number;
};

type RawGeospatialExposureProfile = {
  beachId: number;
  facingDeg?: number | null;
  sectors: Record<WindSector, RawGeospatialSectorExposure>;
  confidence: DataConfidence;
};

type RawGeospatialExposurePayload = {
  profiles?: Record<string, RawGeospatialExposureProfile>;
};

const windSectors: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const profileCache = new Map<string, Promise<GeospatialExposureProfileLookup | undefined>>();

// Regions whose generated geometry must not reach scoring or the map at all
// (e.g. systematically wrong pins pending re-geocoding). 2026-06-11: the five
// Thessaly/Aetolia regions blocked earlier that day were re-geocoded
// (79 batch-approved pin moves, 23 excludeFromApp), rebuilt, and re-audited
// clean (0 CRITICAL / 0 HIGH) — all unblocked the same day. Keep this set
// around: the national pin audit (scripts/auditNationalPins.mjs) is the
// entry/exit gate for membership.
const BLOCKED_REGION_IDS = new Set<string>([]);

const buildProfileUrl = (regionId: string) => `/data/geospatial/exposure/${regionId}.json`;

const isUsableGeneratedProfile = (profile: RawGeospatialExposureProfile): boolean => {
  const levels = windSectors.map(sector => profile.sectors?.[sector]?.level);
  if (levels.some(level => !level)) return false;

  // All-protected used to signal a degenerate (land-locked) sample. With the
  // geometry model an enclosed bay is legitimately protected from every sector,
  // so only reject all-protected when we also failed to find a facing direction.
  const allProtected = levels.every(level => level === 'protected');
  if (allProtected && (profile.facingDeg === null || profile.facingDeg === undefined)) return false;

  return true;
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
      facingDeg: profile.facingDeg ?? null,
      sectors: profile.sectors,
      confidence: profile.confidence,
      source: profile.confidence === 'high' ? 'high-res-coastline' : 'natural-earth-baseline',
    };
    return currentLookup;
  }, {});

  return Object.keys(lookup).length > 0 ? lookup : undefined;
};

export const loadGeospatialExposureProfiles = async (
  regionId: string
): Promise<GeospatialExposureProfileLookup | undefined> => {
  if (BLOCKED_REGION_IDS.has(regionId)) return undefined;
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
