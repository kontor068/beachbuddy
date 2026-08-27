import type { Beach, DataConfidence, GeospatialExposureProfile, WindSector } from '../types';
import type { ExposureLevel } from '../utils/windExposure';

/**
 * Synthetic region id for the cross-region "Κοντά μου" view. It has no profile file of its
 * own and never will — its beaches are borrowed from the real regions around the user — so
 * it must never reach buildProfileUrl. Lives here, next to the loader that has to know.
 */
export const NEAR_ME_REGION_ID = 'near-me';

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
  marineSamplePoint?: { lat: number; lon: number; bearingDeg: number; distanceKm: number };
  /** «Έχει στεριά ≤0,3 χλμ ανά 15°;» — 24×'0'/'1', utils/offshoreWindNote. Δες το σχόλιο στο normalizeProfiles. */
  windShadow?: string;
  /** false = το κελί κύματος περιγράφει ΑΛΛΟ νερό (auditMarineCellTrust). Δες το σχόλιο στο normalizeProfiles. */
  marineCellTrusted?: boolean;
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
    // beachId 0 is a real beach (ids are 0-indexed source order), so guard on
    // null/undefined — a plain `!profile.beachId` would silently drop id 0.
    if (profile.beachId == null || !profile.sectors) return currentLookup;
    if (!isUsableGeneratedProfile(profile)) return currentLookup;

    currentLookup[profile.beachId] = {
      beachId: profile.beachId,
      facingDeg: profile.facingDeg ?? null,
      sectors: profile.sectors,
      confidence: profile.confidence,
      source: profile.confidence === 'high' ? 'high-res-coastline' : 'natural-earth-baseline',
      marineSamplePoint: profile.marineSamplePoint,
      /* ⚠️ 27/08/2026: αυτό το χτίσιμο πεδίο-πεδίο ΕΚΡΥΒΕ το windShadow από όλο τον client.
         Το αρχείο στον δίσκο το είχε, ο τύπος (types.ts) το είχε, αλλά εδώ δεν αντιγραφόταν —
         οπότε η γραμμή του απόγειου ανέμου (24/08, resolveOffshoreWindNote) δεν άναψε ΠΟΤΕ
         στο live site (windArrivedOverLand σε undefined = false = σιωπή), και η πύλη της
         λέξης «απάνεμη» (27/08) γεννήθηκε νεκρή για τον ίδιο λόγο — ο Μίλτος την είδε να
         μη δουλεύει στη Γλυφάδα την ώρα που το JS ήταν ήδη live. Το γνωστό λάθος του
         13/08 με άλλα ρούχα: κοίτα το JSX/αντικείμενο που ΦΤΑΝΕΙ στην οθόνη, όχι το αρχείο.
         Η πύλη scripts/validateGeospatialProfilePlumbing.mjs υπάρχει για να μην ξανασυμβεί:
         την ώρα που γραφόταν έπιασε αμέσως ΚΑΙ το marineCellTrusted (67 παραλίες) να
         χάνεται εδώ — χωρίς αυτό, ο client έβλεπε κάθε κελί κύματος ως αξιόπιστο και ο
         αποκλεισμός sea_cell του βάθρου δεν μπορούσε να ανάψει ποτέ. */
      windShadow: profile.windShadow,
      marineCellTrusted: profile.marineCellTrusted,
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
        console.warn('Geospatial exposure profiles failed to load — region scores without geometry.', {
          regionId,
          status: response.status,
        });
        // A 404 is permanent: the file is absent from the build and will not appear
        // mid-session, so keep the negative result cached. Everything else (5xx, a proxy
        // hiccup) deserves another attempt, and only then is the entry dropped. Retrying
        // 404s is how one bad region id turned into 866 requests in a day of prod logs.
        if (response.status !== 404 && response.status !== 410) profileCache.delete(regionId);
        return undefined;
      }
      const payload = await response.json() as RawGeospatialExposurePayload;
      return normalizeProfiles(payload);
    })
    .catch(error => {
      console.warn('Geospatial exposure profiles failed to load — region scores without geometry.', {
        regionId,
        error,
      });
      profileCache.delete(regionId);
      return undefined;
    });

  profileCache.set(regionId, request);
  return request;
};

/** The little a caller must know about a beach for its geometry to be findable. */
type ProfileLookupBeach = Pick<Beach, 'id'> & Partial<Pick<Beach, 'regionId' | 'sourceBeachId'>>;

/**
 * Profiles for a beach list, keyed by the id those beaches actually carry.
 *
 * Every caller that holds a region and its beaches should use THIS, not the per-region loader
 * above: "Κοντά μου" is a synthetic region whose beaches come from the real regions near the
 * user and are re-keyed to globally-unique ids, so asking for its own profile file 404s
 * forever. The map got that right and the weather layer did not, and the cost was invisible —
 * with no geometry, resolveBeachMarinePoints has nothing to place a beach's own sea cell with,
 * so every beach up to 40 km apart fell back to a single region-centre reading.
 */
export const loadGeospatialExposureProfilesForBeaches = async (
  regionId: string,
  beaches: ReadonlyArray<ProfileLookupBeach>
): Promise<GeospatialExposureProfileLookup | undefined> => {
  if (regionId !== NEAR_ME_REGION_ID) return loadGeospatialExposureProfiles(regionId);

  const sourceRegionIds = Array.from(
    new Set(beaches.map(beach => beach.regionId).filter((id): id is string => Boolean(id)))
  );
  if (sourceRegionIds.length === 0) return undefined;

  const perRegion = await Promise.all(
    sourceRegionIds.map(id => loadGeospatialExposureProfiles(id).catch(() => undefined))
  );
  const byRegion = new Map(sourceRegionIds.map((id, index) => [id, perRegion[index]]));

  const merged: GeospatialExposureProfileLookup = {};
  for (const beach of beaches) {
    const source = beach.regionId ? byRegion.get(beach.regionId) : undefined;
    // Ids are region-scoped, so the profile is filed under the beach's ORIGINAL id while
    // every downstream lookup uses the synthetic one.
    const profile = source?.[beach.sourceBeachId ?? beach.id];
    if (profile) merged[beach.id] = profile;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};
