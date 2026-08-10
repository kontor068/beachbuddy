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
/**
 * THE WIND AT EACH BEACH'S OWN SHORE (02/08/2026), keyed by beach id — App.perBeachMapWind,
 * built from the same cluster forecasts that already colour the map.
 *
 * Every function below used to take ONE Beaufort for a whole region, measured at its
 * geometric centre. Measured nationally on 02/08 over 8.550 beach-hours: that number is at
 * least one Beaufort away from the beach's own shore 35,9% of the time, and 1.171 distinct
 * beaches landed on the wrong side of a gate at least once. On the podium specifically, 150
 * beach-hours could reach #1 while their own water blew 5 Bft or more, and 47 were pushed
 * down for a wind that was not blowing there (all in Heraklion).
 *
 * Optional on purpose: a surface with no per-beach readings — the trip planner, the
 * prerender, the first paint before the cluster fetch lands — passes nothing and every beach
 * reads the region wind exactly as it did before. Nothing is ever left unranked.
 */
export type PerBeachWindLookup = ReadonlyMap<number, { beaufort: number }>;

type BeachIdentified = { beach?: { id: number }; beachId?: number };

/** The wind on THIS beach's shore, or the region's when it has no reading of its own. */
export const beachOwnBeaufort = (
  item: BeachIdentified,
  regionBeaufort: number,
  perBeachWind?: PerBeachWindLookup
): number => {
  const id = item.beach?.id ?? item.beachId;
  const own = typeof id === 'number' ? perBeachWind?.get(id)?.beaufort : undefined;
  return typeof own === 'number' && Number.isFinite(own) ? own : regionBeaufort;
};

/**
 * The strongest wind actually blowing on any shore in this pool. It replaces the region wind
 * as the branch selector below, which keeps the comparator a single-scalar decision (a sort
 * comparator that switched rules per pair would not be transitive). The per-beach part is
 * carried by the RANKS, not by the branch: see prioritizeProtectedRecommendations.
 */
const strongestBeaufortInPool = (
  items: readonly BeachIdentified[],
  regionBeaufort: number,
  perBeachWind?: PerBeachWindLookup
): number => {
  if (!perBeachWind || items.length === 0) return regionBeaufort;
  return items.reduce(
    (strongest, item) => Math.max(strongest, beachOwnBeaufort(item, regionBeaufort, perBeachWind)),
    0
  );
};
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

export const getWindPriorityTopPickPool = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup
): SuitableBeach[] => {
  const poolBeaufort = strongestBeaufortInPool(items, beaufort, perBeachWind);
  if (poolBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  // A beach whose own shore is calm is not asked to prove it is sheltered — there is nothing
  // to be sheltered from there today, whatever the rest of the region is doing.
  const lessExposed = items.filter(item => (
    beachOwnBeaufort(item, beaufort, perBeachWind) < MEANINGFUL_WIND_TOP_PICK_BEAUFORT ||
    isLessExposedTopPickCandidate(item)
  ));
  return lessExposed.length > 0 ? lessExposed : items;
};

export const bestShelteredRecommendationGroup = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup
): SuitableBeach[] => {
  const poolBeaufort = strongestBeaufortInPool(items, beaufort, perBeachWind);
  if (poolBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  const bestPriority = Math.min(...items.map(topPickProfilePriority));
  return items.filter(item => (
    beachOwnBeaufort(item, beaufort, perBeachWind) < MEANINGFUL_WIND_TOP_PICK_BEAUFORT ||
    topPickProfilePriority(item) === bestPriority
  ));
};

export const prioritizeProtectedRecommendations = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup
): SuitableBeach[] => {
  const candidates = bestShelteredRecommendationGroup(items, beaufort, perBeachWind);
  const poolBeaufort = strongestBeaufortInPool(candidates, beaufort, perBeachWind);
  // Wind-aware ranks. When the pool is windy somewhere, a beach whose OWN shore is calm is
  // ranked as if it had the pool's best shelter — it is neither rewarded for geometry it does
  // not need today nor punished for exposure to a wind that is not reaching it. Below
  // meaningful wind everywhere, the ranks are the plain ones, so calm days are untouched.
  const poolIsWindy = poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT;
  const bestProfile = candidates.length > 0 ? Math.min(...candidates.map(topPickProfilePriority)) : 0;
  const bestExposure = candidates.length > 0 ? Math.min(...candidates.map(exposurePriority)) : 0;
  const feelsWind = (item: SuitableBeach): boolean => (
    !poolIsWindy || beachOwnBeaufort(item, beaufort, perBeachWind) >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
  );
  const profileRank = (item: SuitableBeach): number => (feelsWind(item) ? topPickProfilePriority(item) : bestProfile);
  const exposureRank = (item: SuitableBeach): number => (feelsWind(item) ? exposurePriority(item) : bestExposure);

  /**
   * LESS WIND ON YOUR OWN SHORE BEATS BEING FAMOUS (10/08/2026).
   *
   * Only inside the shelter-first branch, and only after exposure has had its say: among beaches
   * that are equally protected on paper, the one whose water is actually quieter today comes
   * first. Beaufort is a coarse bucket, so a difference here is a real threshold crossing, not
   * sampling noise.
   *
   * Why it was needed: the tie-break under it is `compareTouristTopPickPriority` — recognition,
   * then access, then amenities. On Naxos at 5 Bft (the day this was found) thirteen beaches tied
   * on exposure, so fame decided the whole podium: Αγία Άννα and Άγιος Προκόπιος, orange pins with
   * 5 Bft on their own shore, led over Ψιλή Άμμος, a yellow pin at 3 Bft with 22 more points. The
   * heading above them reads «Πιο προστατευμένες» — the list has to mean it.
   *
   * A no-op wherever there are no per-beach readings (planner, prerender, first paint): every
   * beach then returns the same region Beaufort, the tier ties, and the old order stands.
   */
  const ownWindRank = (item: SuitableBeach): number => beachOwnBeaufort(item, beaufort, perBeachWind);

  return [...candidates].sort((a, b) => {
    const profileDiff = profileRank(a) - profileRank(b);
    const exposureDiff = exposureRank(a) - exposureRank(b);
    const scoreDiff = b.score - a.score;
    const touristDiff = compareTouristTopPickPriority(a, b);

    if (poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && profileDiff !== 0) return profileDiff;
    if (poolBeaufort >= PROTECTED_FIRST_BEAUFORT) {
      if (exposureDiff !== 0) return exposureDiff;
      const ownWindDiff = ownWindRank(a) - ownWindRank(b);
      if (ownWindDiff !== 0) return ownWindDiff;
      return touristDiff || scoreDiff;
    }
    if (poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && exposureDiff !== 0 && Math.abs(scoreDiff) <= 12) {
      return exposureDiff;
    }
    if (poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
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
