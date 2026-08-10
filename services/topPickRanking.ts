import { Accessibility, Beach, SuitableBeach } from '../types';
import { hasDifficultTopPickAccess, hasMainstreamTopPickAccess } from '../utils/access';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import { calculateSeaConditionScore, hasPoorSeaConditions } from '../utils/seaConditions';
import { scoreTopPick } from '../utils/topPickScoreTable';

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
 * The smallest sea difference the podium is allowed to reorder on, in metres of swell-equivalent
 * height. Read off our own model's error, not chosen: the worst per-buoy RMSE in
 * reports/wave-model/buoy-comparison.json is 0,251 m (national 0,184). Below its own error bar the
 * model is not measuring a difference, and a podium that reorders there is publishing noise.
 */
export const PODIUM_SEA_MEANINGFUL_DIFFERENCE_M = 0.25;
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

/**
 * ΠΟΤΕ ΣΤΙΣ ΤΟΠ 3 ΠΑΡΑΛΙΑ ΠΟΥ ΘΕΛΕΙ ΠΛΗΡΩΜΗ ΓΙΑ ΝΑ ΜΠΕΙΣ (Μίλτος, 10/08/2026).
 *
 * A door, not a weight: no amount of shelter buys a place on the podium for a beach you cannot
 * walk onto for free. The flag was already collected and already shown on the card, the map and
 * the beach page — but no ranking file read it, so a paid beach could and did come first.
 *
 * Deliberately narrow: the beach stays on the map, in search, in the guides and in «Υπόλοιπες»,
 * where its card explains why it is not recommended. This removes it from the three slots that
 * answer «πού να πάμε τώρα», nothing else. If a region has only paid beaches its podium is empty,
 * and that is the correct answer rather than a fallback.
 */
export const hasPaidEntryTopPickBlocker = (beach: Beach): boolean => Boolean(
  beach.paidEntry ?? beach.metadata?.paidEntry
);

/**
 * ΣΤΙΣ ΤΟΠ 3 ΜΟΝΟ ΠΑΡΑΛΙΕΣ ΠΟΥ ΣΕ ΠΑΝΕ ΚΑΡΦΩΤΑ ΣΕ PIN (Μίλτος, 11/08/2026).
 *
 * The fourth door. A recommendation whose «Πλοήγηση» button drops the visitor on a coordinate in
 * the middle of a road, or on a Google search for a name that exists in ten places, is not a
 * recommendation — it is a problem handed over at the worst moment, when someone is in a car.
 *
 * Three states fail, all of them for the same reason: we cannot promise the map will land on THIS
 * beach.
 *   · no navigation record at all (830 beaches)
 *   · `mode: 'coordinates'` — set deliberately by the routing audit where a cross-island name
 *     collision made place search risky, so we already know the pin is not ours (254)
 *   · `status` other than 'verified', or verified with no placeId (73)
 *
 * Measured 11/08 over the built dataset: 1.984 of 3.142 records open a real Google place card, and
 * NO region is left with fewer than three of them, which is why this can be a hard door rather
 * than a preference. The beach keeps its place on the map, in search, in the guides and in
 * «Υπόλοιπες» — this removes it only from the three slots that answer «πού να πάμε τώρα».
 */
export const opensGoogleMapsPin = (beach: Beach): boolean => {
  const nav = beach.googleMapsNavigation ?? beach.metadata?.googleMapsNavigation;
  return Boolean(nav && nav.status === 'verified' && nav.placeId && nav.mode !== 'coordinates');
};

/**
 * ΤΟ ΤΟΠ 3 ΘΕΛΕΙ ΠΑΝΩ ΑΠΟ 4,5 ΑΣΤΕΡΙΑ — ΟΤΑΝ ΓΙΝΕΤΑΙ (Μίλτος, 11/08/2026).
 *
 * A PREFERENCE, not a door, and the difference was measured before it was built. Over 3.264
 * region × wind-sector × Beaufort cases, applying >4,5 as a hard filter:
 *
 *   no threshold   92,2% show a full Top 3    3,9% empty
 *   > 4,2          89,2%                      4,9%
 *   > 4,4          82,4%                      6,9%
 *   > 4,5          71,6%                     12,7% empty
 *
 * One podium in eight would go blank, because 4,5 is the national MEDIAN — it cuts half the
 * country, and on a windy day it cuts from a pool that is already small. «Καμία κατάλληλη σήμερα»
 * on a day when a calm 4,4 beach exists is a worse answer than showing it.
 *
 * There is a second reason not to make it a door: the star rating already punishes things this
 * table weighs separately. A beach rated 4,3 for having no parking would be filtered here AND
 * scored down on the facilities axis — the same fact charged twice.
 *
 * So: when three or more well-rated candidates survive every other rule, the podium is only them.
 * Otherwise the preference stands down and the full pool ranks, which keeps the promise wherever
 * it can be kept without ever printing an empty page. Unrated beaches pass — 46 of them clear the
 * other doors, and «no rating» has never meant «bad» anywhere else in this codebase.
 */
export const TOP_PICK_PREFERRED_RATING = 4.5;

const isWellRated = (beach: Beach): boolean => {
  const rating = beach.popularity?.rating ?? beach.metadata?.popularity?.rating;
  return typeof rating !== 'number' || !Number.isFinite(rating) || rating > TOP_PICK_PREFERRED_RATING;
};

/** The preference applied: the well-rated subset when it can fill a podium, otherwise everyone. */
export const preferWellRatedTopPicks = (items: SuitableBeach[]): SuitableBeach[] => {
  const wellRated = items.filter(item => isWellRated(item.beach));
  return wellRated.length >= 3 ? wellRated : items;
};

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

/**
 * The rank of the colour the MAP painted this beach (0 = ΙΔΑΝΙΚΗ … 3 = ΔΥΣΚΟΛΗ), or undefined
 * when no pin has reported one yet. Supplied by the caller, never derived here: App.tsx is
 * forbidden from resolving a condition tone (validateConditionToneAgreement), and this module
 * knows nothing about sea state — the whole point is that both surfaces read ONE answer.
 */
export type PodiumToneRank = (beachId: number) => number | undefined;

export const prioritizeProtectedRecommendations = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup,
  toneRank?: PodiumToneRank
): SuitableBeach[] => {
  // The two doors, applied before anything is scored: pay-to-enter, and beaches whose navigation
  // would hand over a coordinate instead of a Google pin. Both run on the raw pool rather than
  // inside the sort, so a blocked beach cannot occupy a slot even when it would have scored first
  // and so the shelter group is chosen only from beaches that can actually be recommended.
  const recommendable = items.filter(item => (
    !hasPaidEntryTopPickBlocker(item.beach) && opensGoogleMapsPin(item.beach)
  ));
  // The rating preference runs AFTER the weather has narrowed the pool, never before: filtering on
  // stars first could leave three well-rated but exposed beaches and drop the sheltered ones the
  // podium exists to find.
  const candidates = preferWellRatedTopPicks(
    bestShelteredRecommendationGroup(recommendable, beaufort, perBeachWind)
  );
  const poolBeaufort = strongestBeaufortInPool(candidates, beaufort, perBeachWind);
  // Wind-aware ranks. When the pool is windy somewhere, a beach whose OWN shore is calm is
  // ranked as if it had the pool's best shelter — it is neither rewarded for geometry it does
  // not need today nor punished for exposure to a wind that is not reaching it. Below
  // meaningful wind everywhere, the ranks are the plain ones, so calm days are untouched.
  const poolIsWindy = poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT;
  const bestProfile = candidates.length > 0 ? Math.min(...candidates.map(topPickProfilePriority)) : 0;
  const feelsWind = (item: SuitableBeach): boolean => (
    !poolIsWindy || beachOwnBeaufort(item, beaufort, perBeachWind) >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
  );
  /**
   * The same question the ranks ask, but phrased for the weighted table, and NOT the same answer.
   *
   * `feelsWind` returns true on a calm day (`!poolIsWindy`) because the LADDER only ever consulted
   * it inside the windy branches — below 3 Bft nothing above ran at all. The table has no branches:
   * it scores every beach every day. Feeding it `feelsWind` therefore charged 30 points of shelter
   * on a 1 Bft morning, demoting an exposed beach for a wind that was not blowing anywhere — the
   * exact inversion of the rule this project has held since 02/08. Caught by
   * validatePerBeachWindGates on the calm-day fixture.
   *
   * So: on a calm day nobody feels the wind and shelter cannot separate anyone. When the pool is
   * windy, the per-beach answer decides, exactly as the ranks do.
   */
  const shelterCounts = (item: SuitableBeach): boolean => (
    poolIsWindy && beachOwnBeaufort(item, beaufort, perBeachWind) >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
  );
  const profileRank = (item: SuitableBeach): number => (feelsWind(item) ? topPickProfilePriority(item) : bestProfile);

  /**
   * THE COLOUR THE MAP PAINTED IS EVIDENCE, AND IT RANKS BEFORE FAME (10/08/2026).
   *
   * Found by Miltos on the Attica coast: «πώς βγάζεις top 3 πιο προστατευμένες κάποιες κίτρινες
   * ενώ έχεις και μπλε;». Measured the same afternoon against the live forecast
   * (.tmp/reproAttica.mjs + a real browser in «Κοντά μου»):
   *
   *   Βοτσαλάκια, Φρεαττύδος, Καλαμπάκα, Κράκαρης — ΜΠΛΕ pins, protected, 3 Bft on their own shore
   *   Αστέρα Γλυφάδας, Μεγάλο Καβούρι            — ΚΙΤΡΙΝΑ pins, protected, 4 Bft
   *
   * All six are `protected`, so the exposure tier tied and `compareTouristTopPickPriority` — fame,
   * access, amenities — decided the podium. The two famous yellow ones led; the calmest blue beach
   * in the set came third. The exposure tier cannot see the difference, because a pin is blue for
   * THREE reasons (exposure + the wind on that shore + the sea state) and this sort was reading
   * only the first.
   *
   * So the ranking now reads the tone itself, from the same table the map and the «Υπόλοιπες» list
   * already share (App's `mapBeachTones`) — not a second opinion computed here. One piece of
   * evidence, one answer, exactly the rule that closed the same class of bug on 08/08 and this
   * morning.
   *
   * Silent by construction where it should be: no tone table (planner, prerender, first paint) or
   * either beach unpainted → the tier ties and the previous order stands, untouched.
   */
  const toneOf = (item: SuitableBeach): number | undefined => (toneRank ? toneRank(item.beach.id) : undefined);
  const compareTone = (a: SuitableBeach, b: SuitableBeach): number => {
    const aTone = toneOf(a);
    const bTone = toneOf(b);
    if (typeof aTone !== 'number' || typeof bTone !== 'number') return 0;
    return aTone - bTone;
  };

  /**
   * Ο ΠΙΝΑΚΑΣ ΤΩΝ 100 (Μίλτος, 10/08/2026) — the podium is now the first three rows of one
   * weighted score, not the first three survivors of a ladder.
   *
   * The table itself lives in utils/topPickScoreTable.ts with its weights and its reasoning; this
   * function only feeds it the four things it cannot resolve on its own (the wind on that shore,
   * whether the shore feels the wind at all, and the two comfort priorities) and then sorts.
   *
   * TWO THINGS SURVIVE THE REWRITE, AND THEY ARE NOT DECORATION:
   *
   *   1. THE COLOUR THE MAP PAINTED STILL COMES FIRST. Not as a weight — it would double-count the
   *      very three axes the table already scores (shelter + own-shore wind + sea) — but as an
   *      ordering above the score. This project spent 10/08 making the podium, the «Υπόλοιπες»
   *      list and the legend agree; a sum that can place a yellow pin above a blue one re-opens
   *      exactly that wound, and the reader sees it instantly because both are on the same screen.
   *      Within a colour, the score decides everything. Where no pin has reported a tone (planner,
   *      prerender, first paint) this is silent and the score decides outright.
   *   2. THE PROFILE FLOOR. bestShelteredRecommendationGroup already narrowed the pool; the
   *      profile rank stays above the score so a tourist-unready beach cannot buy its way up.
   *
   * The old ladder's remaining rungs are gone: exposure, own-shore wind, sea and comfort are now
   * points, and `compareTouristTopPickPriority` no longer runs here at all — which is the whole
   * point, since it was two points of parking that ordered the East Attica podium on 10/08.
   */
  const scoreOf = (item: SuitableBeach): number => scoreTopPick({
    item,
    ownBeaufort: beachOwnBeaufort(item, beaufort, perBeachWind),
    feelsWind: shelterCounts(item),
    accessPriority: topPickAccessPriority(item.beach),
    amenitiesScore: topPickAmenitiesScore(item.beach),
    // Undefined on every surface where no location was shared, which makes the axis neutral for
    // all of them — see the distance section of the table.
    distanceKm: typeof item.distance === 'number' && Number.isFinite(item.distance) ? item.distance : undefined,
  }).total;

  const scores = new Map<SuitableBeach, number>();
  for (const item of candidates) scores.set(item, scoreOf(item));

  return [...candidates].sort((a, b) => {
    const profileDiff = profileRank(a) - profileRank(b);
    if (poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && profileDiff !== 0) return profileDiff;

    const toneDiff = compareTone(a, b);
    if (toneDiff !== 0) return toneDiff;

    const tableDiff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    if (tableDiff !== 0) return tableDiff;

    // A genuine tie: every axis landed in the same bucket, which means we cannot tell them apart
    // with the evidence we hold. The region score breaks it only to keep the sort deterministic —
    // never as a criterion, because it changes shape when the visitor shares a location.
    return b.score - a.score;
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
