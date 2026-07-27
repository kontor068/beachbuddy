import { Accessibility, Beach, SuitableBeach } from '../types';
import { hasDifficultTopPickAccess, hasMainstreamTopPickAccess } from '../utils/access';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import { calculateSeaConditionScore, hasPoorSeaConditions } from '../utils/seaConditions';

/**
 * TOP-PICK RANKING — the homepage podium's gates and ordering, extracted
 * VERBATIM from App.tsx (2026-07-26) so the trip planner can apply the exact
 * same rules instead of growing a divergent copy. This is a pure move: zero
 * behaviour changes, verified by the recommendation-scenario suite and a
 * before/after planner-report diff.
 *
 * Cycle rule: this module imports ONLY from utils/* and types.ts — never from
 * recommendationService (which has private near-twins of some of these; see
 * the duplication note there).
 */

export const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = 3;
export const PROTECTED_FIRST_BEAUFORT = 5;
export const MAX_TOP_RECOMMENDATION_BEAUFORT = 6;
export const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;
export const MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE = 5;
export const MIN_REMAINING_TOP_PICK_SCORE = 62;

export const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant || beach.amenities?.parking)
);

export const hasTopPickVisitorServices = (beach: Beach): boolean => {
  const metadataAmenities = beach.metadata?.amenities?.join(' ').toLowerCase() || '';

  return Boolean(
    beach.metadata?.organized === true ||
    beach.amenities?.organized ||
    beach.amenities?.beachBar ||
    beach.amenities?.sunbeds ||
    beach.amenities?.taverna ||
    beach.amenities?.restaurant ||
    /beach bar|sunbed|ξαπλώστρ|ομπρέλ|καφέ|cafe|ταβέρν|taverna|restaurant|εστιατόρ/.test(metadataAmenities)
  );
};

export const hasTouristReadyTopPickProfile = (beach: Beach): boolean => {
  if (!hasMainstreamTopPickAccess(beach)) return false;

  return Boolean(
    hasTopPickVisitorServices(beach) ||
    beach.amenities?.parking ||
    beach.environment?.familyFriendly
  );
};

export const isWindProtectedRecommendation = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel' | 'canClaimWindProtection'>): boolean => {
  return item.exposureLevel === 'protected' && item.canClaimWindProtection === true;
};

export const exposurePriority = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel'>): number => {
  if (isWindProtectedRecommendation(item)) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

export const topPickProfilePriority = (item: SuitableBeach): number => {
  return exposurePriority(item);
};

export const topPickPopularityScore = (beach: Beach): number => {
  return getBeachTouristRecognitionScore(beach);
};

export const topPickAccessPriority = (beach: Beach): number => {
  const accessType = beach.metadata?.access?.type;
  if (hasDifficultTopPickAccess(beach)) return 5;
  if (accessType === 'asphalt_road') return 0;
  if (accessType === 'passable_dirt_road') return 1;
  if (accessType === 'hiking_path_easy') return 2;
  if (!accessType && beach.accessibility === Accessibility.EASY) return 0;
  if (!accessType && beach.accessibility === Accessibility.MODERATE) return 1;
  if (hasMainstreamTopPickAccess(beach)) return 3;
  return 4;
};

export const topPickAmenitiesScore = (beach: Beach): number => {
  let score = 0;
  if (hasMainstreamFacilities(beach)) score += 8;
  if (hasTopPickVisitorServices(beach)) score += 6;
  if (beach.amenities?.parking) score += 4;
  if (beach.amenities?.naturalShade) score += 2;
  if (beach.environment?.familyFriendly) score += 2;
  return score;
};

export const compareOptionalDistance = (a: SuitableBeach, b: SuitableBeach): number => {
  const aDistance = typeof a.distance === 'number' && Number.isFinite(a.distance) ? a.distance : undefined;
  const bDistance = typeof b.distance === 'number' && Number.isFinite(b.distance) ? b.distance : undefined;

  if (aDistance === undefined || bDistance === undefined) return 0;
  return aDistance - bDistance;
};

export const compareTouristTopPickPriority = (a: SuitableBeach, b: SuitableBeach): number => {
  const popularityDiff = topPickPopularityScore(b.beach) - topPickPopularityScore(a.beach);
  if (Math.abs(popularityDiff) >= 1) return popularityDiff;

  const accessDiff = topPickAccessPriority(a.beach) - topPickAccessPriority(b.beach);
  if (accessDiff !== 0) return accessDiff;

  const distanceDiff = compareOptionalDistance(a, b);
  if (distanceDiff !== 0) return distanceDiff;

  const amenitiesDiff = topPickAmenitiesScore(b.beach) - topPickAmenitiesScore(a.beach);
  if (amenitiesDiff !== 0) return amenitiesDiff;

  return 0;
};

export const hasHardTopPickAccessBlocker = (beach: Beach): boolean => (
  !hasMainstreamTopPickAccess(beach)
);

export const isLessExposedTopPickCandidate = (item: SuitableBeach): boolean => {
  const lessExposed = item.exposureLevel === 'protected' || item.exposureLevel === 'partial';
  if (!lessExposed || hasHardTopPickAccessBlocker(item.beach)) return false;

  return Boolean(
    isWindProtectedRecommendation(item) ||
    hasTopPickVisitorServices(item.beach) ||
    hasTouristReadyTopPickProfile(item.beach) ||
    topPickPopularityScore(item.beach) >= 82
  );
};

export const getWindPriorityTopPickPool = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  if (beaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  const lessExposed = items.filter(isLessExposedTopPickCandidate);
  return lessExposed.length > 0 ? lessExposed : items;
};

export const bestShelteredRecommendationGroup = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  if (beaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  const bestPriority = Math.min(...items.map(topPickProfilePriority));
  return items.filter(item => topPickProfilePriority(item) === bestPriority);
};

export const prioritizeProtectedRecommendations = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  const candidates = bestShelteredRecommendationGroup(items, beaufort);
  return [...candidates].sort((a, b) => {
    const profileDiff = topPickProfilePriority(a) - topPickProfilePriority(b);
    const exposureDiff = exposurePriority(a) - exposurePriority(b);
    const scoreDiff = b.score - a.score;
    const touristDiff = compareTouristTopPickPriority(a, b);

    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && profileDiff !== 0) return profileDiff;
    if (beaufort >= PROTECTED_FIRST_BEAUFORT) {
      if (exposureDiff !== 0) return exposureDiff;
      return touristDiff || scoreDiff;
    }
    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && exposureDiff !== 0 && Math.abs(scoreDiff) <= 12) {
      return exposureDiff;
    }
    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      return touristDiff || scoreDiff || exposureDiff;
    }
    return scoreDiff || exposureDiff;
  });
};

/**
 * The podium's SEA gate, one implementation for both surfaces: exactly the
 * filter body the homepage applies to its candidates (formerly inline in
 * App.tsx's recommendedSuitableBeaches memo). A beach that fails this is one
 * the podium refuses to show — and the planner must refuse to plan.
 */
export const passesTopPickSeaGate = (
  item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel' | 'waveHeightM' | 'seaStateWaveM' | 'seaStatePeriodS' | 'hourlySeaScore'>,
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): boolean => {
  // Decision-grade sea state, not the cove-guard display value, and with the period so steep
  // chop is not mistaken for the same height of long-period roll.
  const itemWaveHeightM = item.seaStateWaveM ?? item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM, false, item.seaStatePeriodS);
  const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;

  return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
    hasGoodHourlySea &&
    !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM, item.seaStatePeriodS);
};
