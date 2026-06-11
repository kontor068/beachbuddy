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

// 2026-06-11 TEMPORARY block pending the Thessaly re-geocoding: the national
// pin audit (scripts/auditNationalPins.mjs) found systematic village/POI
// coordinates instead of beach locations in these regions (76 CRITICAL pins —
// Pelion 49, Larissa coast 14, Skopelos 7, Alonissos 6 — plus 8 in
// Aetolia-Acarnania), so their generated geometry is garbage sampled from the
// wrong spots and must not reach scoring or the map at all. Unblock each
// region only after re-geocoding + rebuild + a clean re-audit.
const BLOCKED_REGION_IDS = new Set([
  'thessaly-magnesia-mainland---pelion',
  'thessaly-larissa-coast-agia---kissavos',
  'thessaly-alonissos',
  'thessaly-skopelos',
  'west-greece-aetolia-acarnania-mainland',
]);

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
