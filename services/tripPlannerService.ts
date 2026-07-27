import type { Beach, DailyForecast, LanguageCode, SuitableBeach, SwimmingComfort, UserPreferences, WindSector } from '../types';
import type { ExposureLevel } from '../utils/windExposure';
import type { GeospatialExposureProfileLookup } from './geospatialExposureService';
import {
  calculateBeachScore,
  filterBeachesByUserPreferences,
  getSuitableBeaches,
  hasHourlyRainRisk,
  hasTrustedWindEvidence,
  isFalseProtectedTopPick,
  isTrustedTopRecommendationCandidate,
  type BeachScore,
} from './recommendationService';
import { getVisibleMapExposureLevel } from '../utils/mapExposure';
import {
  MAX_TOP_RECOMMENDATION_BEAUFORT,
  MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE,
  getWindPriorityTopPickPool,
  passesTopPickSeaGate,
  prioritizeProtectedRecommendations,
} from './topPickRanking';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import { compareBeachSignificance, hasSignificanceSignal } from '../utils/beachSignificance';
import { hasPracticalTopPickAccess } from '../utils/access';
import { isNaturistBeach } from '../utils/naturistBeaches';
import {
  hasGeometryEnclosedProtection,
  isEnclosedCoveGeometry,
  resolveBeachWindProfile,
  windSectorFromDegrees,
} from '../utils/windExposureEngine';
import { getBeaufortLevel } from '../utils/weatherUtils';

// ─────────────────────────────────────────────────────────────────────────────
// TRIP PLANNER — "I'm here for N days: which beach on which day?"
//
// THE AXIS (product decision 2026-07-26): SIGNIFICANCE chooses WHICH beaches;
// the WEATHER arranges them INTO days. A visitor with 3 days on Milos is
// drowning in 42 options — the answer is the 3 beaches they would regret
// missing, each on the day whose wind suits it. NOT "whatever scores highest
// each day": that can produce three obscure beaches and never Sarakiniko,
// which reproduces the overwhelm instead of solving it.
//
// Structure: the trip's ESSENTIALS are the N most significant beaches
// (utils/beachSignificance.ts) that are usable on at least one day of the
// trip. The weather only decides which essential goes on which day. When a
// day supports NONE of the essentials (meltemi), a sheltered REFUGE outside
// the list steps in for that day — explicitly, as the exception, never
// displacing an essential from the selection.
//
// NESTING: the essentials are a prefix of one significance-sorted list, so
// 3 days → {A,B,C} and 4 days → {A,B,C}+D. Day ASSIGNMENTS may shift with
// the forecast; the SET must not look random across N.
//
// This is the one question only we can answer. It needs per-beach shelter
// geometry (baked, 8 wind sectors) crossed with a multi-day forecast — Google
// and every beach directory have the second half and none of the first. On a
// meltemi week the swimmable side of an island flips day to day, and nobody
// tells the visitor that.
//
// WHY NOT DAY-BY-DAY GREEDY: picking each day's best in order burns beaches.
// A cove that is lovely on Monday AND is the only sheltered option on Thursday
// gets spent on Monday, leaving Thursday with nothing. So we assign by
// scarcity: the day with the fewest usable essentials is served first.
//
// HONESTY (the doctrine in docs/methodology-wind-exposure-GR.md): a day-5 wind
// direction is a guess. We still show it, but flagged 'provisional' — and a
// rainy/storm day is returned as "not a beach day" rather than dressed up as
// one. Never claim more certainty than the forecast carries.
// ─────────────────────────────────────────────────────────────────────────────

/** Beyond this index the forecast is too soft to state a pick plainly. */
const FIRM_FORECAST_DAYS = 3;

/**
 * The significance arm of the pool. Chosen by SIGNIFICANCE (recognition +
 * real review-count fame — utils/beachSignificance.ts), never by today's
 * conditions: shortlisting on today would drop precisely the beaches that
 * open up when the wind turns, which is the whole point of the feature.
 */
export const SIGNIFICANCE_POOL_SIZE = 40;

/**
 * Hard ceiling on how many beaches we score per day — the performance
 * envelope. Measured on the largest region (Halkidiki, 133 beaches): 72 × 6
 * days in one shared scoring pass is ~144 ms on desktop, which is the budget
 * a mid-range phone (4-6× slower) can still absorb behind a pending state.
 * Whole-region scoring (275 ms desktop) is explicitly rejected.
 */
export const TRIP_POOL_SIZE = 72;

/** Below this a "best available" pick is not worth sending someone to. */
const MIN_USABLE_SCORE = 35;

// ── Caution tier ────────────────────────────────────────────────────────────
// getSuitableBeaches only returns beaches at score >= 60 that are not
// 'avoid_swimming'. That bar is right for "here is a good beach today", but on
// a trip it produces blank days: the wave used in scoring is the REGIONAL one
// (shelter does not reduce it there), so a fresh afternoon empties an entire
// island even where a cove is calm. A blank day helps nobody planning a week.
//
// So when nothing clears the bar we fall back to the best beach that is merely
// CHOPPY, and label it as such. This never claims calm — the UI shows it as a
// caution — and it never crosses the engine's own hard limits, which stay
// authoritative: the engine's 'avoid_swimming' verdict (effective Beaufort
// >= 6 or effective wave > 1.2 m, computed on the SCORING side) remains an
// absolute veto, so the answer there is still "not a beach day".
const CAUTION_MIN_SWIMMING_SCORE = 30;
const CAUTION_MAX_BEAUFORT = 5;

/** Whole-day wind at which we stop calling it a beach day at all. */
const STORM_BEAUFORT = 8;

export type TripDayStatus = 'beach' | 'no_beach_day';
export type TripDayConfidence = 'firm' | 'provisional';

/**
 * Why a day has no beach. The UI needs this to say something useful — "the
 * meltemi leaves nowhere sheltered here" is actionable (plan the village, the
 * museum, the boat) in a way that a bare "no option" is not.
 */
export type TripDayReason = 'storm' | 'rain' | 'too_windy' | 'no_match';

/**
 * Discrete "why this beach today" token. The SERVICE decides the claim, the
 * UI only renders localized copy for it — never prose from here. Resolution
 * order is honesty-first (see resolveWhyKey): a caution pick or one without
 * trusted wind evidence can NEVER carry a shelter claim.
 */
export type TripWhyKey =
  | 'calm_everywhere'   // ≤2 Bft — shelter is not the story
  | 'cove_refuge'       // enclosed cove, claim earned by geometry
  | 'sheltered'         // protected + canClaimWindProtection
  | 'partial_shelter'   // partial, or protected without an earned claim
  | 'best_available';   // exposed, caution tier, or no trusted evidence

/** What the planner hands the UI for one day. */
export interface TripPick {
  beach: Beach;
  score: number;
  /**
   * Beaufort THIS beach was scored at (scoreResult.windSpeedKmph), not the
   * region's midday number — the per-beach truth the strip exists to show.
   */
  windBeaufort: number;
  windSector?: WindSector;
  /**
   * The canonical DISPLAYED exposure — getVisibleMapExposureLevel, i.e. the
   * exact level the region map colours this pin. Sourced there so the strip
   * can never say "sheltered" for a beach the map paints amber.
   */
  exposureLevel: ExposureLevel;
  canClaimWindProtection: boolean;
  enclosedCove: boolean;
  seaCalmClaimAllowed: boolean;
  swimmingComfort?: SwimmingComfort;
  waveHeightM?: number;
  whyKey: TripWhyKey;
  /**
   * True when this came from the caution tier — i.e. it did NOT clear the normal
   * suitability bar and is choppy. The UI must never present these as calm.
   */
  caution: boolean;
}

export interface TripDayPlan {
  /** Index into the forecast array (0 = today). */
  dayIndex: number;
  date: Date;
  status: TripDayStatus;
  confidence: TripDayConfidence;
  /** The assigned beach; null when status !== 'beach'. */
  pick: TripPick | null;
  /** Runner-up for the same day, so the UI can offer an alternative. */
  alternative: TripPick | null;
  /** Set when status === 'no_beach_day'. */
  reason: TripDayReason | null;
  /**
   * On a day with no beach, the next day of this trip that does have one. Lets
   * the UI say "the sea settles again on Saturday" — useful, and strictly within
   * what we actually know. We deliberately do NOT suggest museums or villages:
   * that is outside what this service can stand behind.
   */
  nextBeachDayIndex: number | null;
  /**
   * True when the only acceptable option was already used earlier in the trip.
   * Variety is a nice-to-have; having an answer is not — so we repeat a beach
   * rather than send someone nowhere, and let the UI say so.
   */
  isRepeat: boolean;
  /**
   * True when the pick is a weather REFUGE from outside the trip's essentials:
   * none of the significant beaches worked this day, so a sheltered fallback
   * stepped in. The UI must present it as the exception ("none of the big
   * names work today — but this cove is closed to the wind"), never as a peer
   * of the essentials.
   */
  isRefuge: boolean;
}

export interface PlanTripInput {
  beaches: Beach[];
  /** Consecutive daily forecasts, index 0 = today (max 6 from processForecastData). */
  forecast: DailyForecast[];
  /** How many days the visitor is staying. */
  days: number;
  language: LanguageCode;
  preferences?: UserPreferences;
  geospatialProfiles?: GeospatialExposureProfileLookup;
  /**
   * The visitor's location, when granted. Not cosmetic: calculateBeachScore
   * switches to a different weighting formula when a location is present, so
   * omitting it here while the homepage passes it would score the same beach
   * two different ways on the same day.
   */
  userLocation?: { lat: number; lon: number };
  /**
   * Whether the HOMEPAGE currently blanks today for rain (its bar is "every
   * beach hour rainy"; ours is >50% of daytime hours). Passed in so day 0 can
   * never say "rain, no beach" directly under three live recommendations.
   * Days 1+ keep the >50% rule — the right bar for planning ahead.
   */
  todayRainBlocked?: boolean;
}

/** Storm-force wind, wind above the podium's ceiling, or persistent daytime rain. */
const badWeatherReason = (
  day: DailyForecast,
  options?: { isFirstDay?: boolean; todayRainBlocked?: boolean }
): TripDayReason | null => {
  const beaufort = getBeaufortLevel((day.wind?.speed ?? 0) * 3.6);
  if (beaufort >= STORM_BEAUFORT) return 'storm';
  // Above the podium's own ceiling the homepage shows NO picks — a planner
  // naming a beach at 7 Bft would contradict the surface right above it.
  if (beaufort > MAX_TOP_RECOMMENDATION_BEAUFORT) return 'too_windy';

  const hours = day.hourly || [];
  if (hours.length === 0) return null;
  // Daytime hours only — overnight rain does not spoil a swim.
  const daytime = hours.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 9 && hour <= 19;
  });
  if (daytime.length === 0) return null;
  const rainy = daytime.filter(hasHourlyRainRisk).length;
  if (rainy / daytime.length > 0.5) {
    // Today defers to the homepage's stricter verdict (see todayRainBlocked).
    if (options?.isFirstDay && options.todayRainBlocked !== true) return null;
    return 'rain';
  }
  return null;
};

/** Wind strong enough that "nothing scored" almost certainly means "nowhere is sheltered". */
const WINDY_DAY_BEAUFORT = 5;

/**
 * Worth sending someone to. Caution-tier picks have already passed their own
 * (stricter, wave/wind-based) gate, and the engine caps their score at 45, so
 * the score floor would wrongly discard them.
 */
const isUsable = (pick: TripPick): boolean => pick.caution || pick.score >= MIN_USABLE_SCORE;

/**
 * The honesty-first "why" resolution. Order is load-bearing:
 * caution and missing evidence FORBID a shelter claim before geometry is even
 * consulted, and ≤2 Bft days say "calm everywhere" instead of crediting
 * shelter nobody needed. Never claim more certainty than the data carries.
 */
const resolveWhyKey = (input: {
  caution: boolean;
  windBeaufort: number;
  hasEvidence: boolean;
  exposureLevel: ExposureLevel;
  canClaimWindProtection: boolean;
  enclosedCove: boolean;
}): TripWhyKey => {
  if (input.caution) return 'best_available';
  // <= 3 Bft, not <= 2: the project rule is that 3-4 Bft is a light/moderate
  // breeze and never earns caution wording (see the beach-card copy doctrine),
  // and the homepage's own day summary already says "most beaches look
  // suitable" at <= 3. Claiming shelter on a day nobody needs it read as
  // over-dramatic on a 32 degree, 3 Bft July Monday.
  if (input.windBeaufort <= 3) return 'calm_everywhere';
  if (!input.hasEvidence) return 'best_available';
  if (input.enclosedCove && input.canClaimWindProtection && input.exposureLevel === 'protected') return 'cove_refuge';
  if (input.exposureLevel === 'protected' && input.canClaimWindProtection) return 'sheltered';
  if (input.exposureLevel === 'partial' || input.exposureLevel === 'protected') return 'partial_shelter';
  return 'best_available';
};

/** Shared shape between a SuitableBeach and a caution-tier BeachScore row. */
interface PickSource {
  beach: Beach;
  score: number;
  waveHeightM?: number;
  exposureLevel?: ExposureLevel;
  windSpeedKmph?: number;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  enclosedCove?: boolean;
  seaCalmClaimAllowed?: boolean;
  swimmingComfort?: SwimmingComfort;
  orientation?: number | null;
  windProfile?: SuitableBeach['windProfile'];
  windProfileSource?: SuitableBeach['windProfileSource'];
  warnings?: SuitableBeach['warnings'];
  confidence?: SuitableBeach['confidence'];
  geospatialExposure?: SuitableBeach['geospatialExposure'];
}

const buildPick = (
  source: PickSource,
  day: DailyForecast,
  caution: boolean,
  geospatialProfiles?: GeospatialExposureProfileLookup
): TripPick => {
  const regionWindKmph = (day.wind?.speed ?? 0) * 3.6;
  // Per-beach wind (gusts/local model), falling back to the region day value.
  const windBeaufort = getBeaufortLevel(source.windSpeedKmph ?? regionWindKmph);
  // The canonical DISPLAYED exposure — exactly what colours this beach's map
  // pin — so strip, pin and card can never disagree on the shelter word.
  const exposureLevel = getVisibleMapExposureLevel(
    {
      exposureLevel: source.exposureLevel,
      geospatialExposure: source.geospatialExposure ?? geospatialProfiles?.[source.beach.id],
      orientation: source.orientation ?? null,
      windProfile: source.windProfile,
      windProfileSource: source.windProfileSource,
      windSector: source.windSector,
      warnings: source.warnings,
      beach: source.beach,
    },
    windBeaufort,
    day.wind?.deg
  );
  const canClaimWindProtection = source.canClaimWindProtection === true;
  const enclosedCove = source.enclosedCove === true;
  const hasEvidence = hasTrustedWindEvidence(
    { confidence: source.confidence, windProfile: source.windProfile, windProfileSource: source.windProfileSource },
    windBeaufort
  );

  return {
    beach: source.beach,
    score: source.score,
    windBeaufort,
    windSector: source.windSector,
    exposureLevel,
    canClaimWindProtection,
    enclosedCove,
    seaCalmClaimAllowed: source.seaCalmClaimAllowed === true,
    swimmingComfort: source.swimmingComfort,
    waveHeightM: source.waveHeightM,
    whyKey: resolveWhyKey({ caution, windBeaufort, hasEvidence, exposureLevel, canClaimWindProtection, enclosedCove }),
    caution,
  };
};

/** Exposure order for ranking: protected beats partial beats exposed; unknown last. */
const exposureRank = (level?: ExposureLevel): number => {
  if (level === 'protected') return 0;
  if (level === 'partial') return 1;
  if (level === 'exposed') return 2;
  return 3;
};

/**
 * Best merely-CHOPPY beaches for a day, ranked. Used only when nothing clears the
 * normal suitability bar. Stops dead at the engine's own hard limits so this can
 * never talk someone into a genuinely rough sea.
 *
 * RANKING DOCTRINE (D12): every key below is a SCORING quantity. The displayed
 * `waveHeightM` is the cove-guard DISPLAY value (display-only by doctrine,
 * services/recommendationService.ts:1944) and is banned from both the filter
 * and the sort — ranking on it would let a presentation transform drive a
 * decision, and its 0.10 m display floor produces mass ties anyway. The old
 * sort ranked on swimmingScore alone, which ties at 49 across an entire region
 * at 5 Bft — so the pick was whichever beach came first in the JSON file.
 *
 * ACCESS IS A GATE HERE, not a tiebreak: on a 5 Bft day, "40 minutes of dirt
 * road to a 30-metre cove" is worse advice than "the organised beach on the
 * lee side has some chop but is fine".
 */
const cautionRanking = (
  pool: Beach[],
  day: DailyForecast,
  dayScores: Map<number, BeachScore>,
  geospatialProfiles?: GeospatialExposureProfileLookup
): TripPick[] => {
  const windSpeedKmph = (day.wind?.speed ?? 0) * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmph);
  if (beaufort > CAUTION_MAX_BEAUFORT) return [];

  return pool
    .filter(beach => hasPracticalTopPickAccess(beach))
    .map(beach => ({ beach, result: dayScores.get(beach.id) }))
    .filter((entry): entry is { beach: Beach; result: BeachScore } => Boolean(entry.result))
    .filter(({ result }) => {
      // The engine's official "do not swim" OVERRIDE (a critical official
      // warning) zeroes the score. That one is absolute.
      if (result.score === 0) return false;

      // Everything else here mirrors the HOMEPAGE's own no-ideal fallback
      // (isNoIdealFallbackCandidate in App.tsx): when nothing is swimmable the
      // app does NOT go silent — it shows the least-exposed options under an
      // honest heading. The planner must answer the same way, or it
      // contradicts the page it sits on.
      //
      // Measured on the real forecast (Naxos, Tue 28 Jul, 4 Bft north, 0.82 m
      // regional wave): the engine returns swimmingComfort='avoid_swimming'
      // and swimmingScore=21 for ALL 39 pool beaches — even Kalantos, whose
      // own cove wave is 0.10 m — because the scoring wave is the REGIONAL
      // one. Requiring 'not avoid_swimming' therefore blanked a day the
      // homepage happily fills, and the visitor was told "no beach worth it"
      // on a day they can swim on the lee coast. So this tier drops that
      // requirement exactly as the homepage fallback does, and leans on the
      // sea-condition score plus the exposure and warning vetoes instead.
      // The UI never calls these calm: they render with the «με κύμα» badge.
      const isExposed = result.exposureLevel ? result.exposureLevel !== 'protected' : true;
      const waveHeightM = result.waveHeightM ?? day.marine?.waveHeightM;
      const seaScore = calculateSeaConditionScore(isExposed, windSpeedKmph, result.exposureLevel, waveHeightM);
      if (result.exposureLevel === 'exposed') return false;
      if (seaScore < MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE) return false;
      const hasHardExclusion = result.warnings?.some(warning =>
        warning.type === 'wind_sport_spot' ||
        (warning.type === 'exposed_to_wind' && result.exposureLevel === 'exposed')
      );
      if (hasHardExclusion) return false;
      if (isFalseProtectedTopPick(result, day.wind?.deg ?? 0, beaufort)) return false;
      return true;
    })
    .sort((a, b) => (
      // Geometry-earned refuge first: an enclosed cove the engine lets claim
      // protection IS the answer on a blowing day.
      Number(b.result.enclosedCove && b.result.canClaimWindProtection) -
        Number(a.result.enclosedCove && a.result.canClaimWindProtection) ||
      exposureRank(a.result.exposureLevel) - exposureRank(b.result.exposureLevel) ||
      (b.result.hourlySeaScore ?? 0) - (a.result.hourlySeaScore ?? 0) ||
      (b.result.swimmingScore ?? 0) - (a.result.swimmingScore ?? 0) ||
      (a.result.modeledWaveHeightM ?? Number.POSITIVE_INFINITY) -
        (b.result.modeledWaveHeightM ?? Number.POSITIVE_INFINITY) ||
      a.beach.id - b.beach.id
    ))
    .map(({ beach, result }) => buildPick(
      {
        beach,
        score: result.score,
        waveHeightM: result.waveHeightM,
        exposureLevel: result.exposureLevel,
        windSpeedKmph: result.windSpeedKmph,
        windSector: result.windSector,
        canClaimWindProtection: result.canClaimWindProtection,
        enclosedCove: result.enclosedCove,
        seaCalmClaimAllowed: result.seaCalmClaimAllowed,
        swimmingComfort: result.swimmingComfort,
        orientation: result.orientation,
        windProfile: result.windProfile,
        windProfileSource: result.windProfileSource,
        warnings: result.warnings,
        confidence: result.confidence,
      },
      day,
      true,
      geospatialProfiles
    ));
};

/**
 * The candidate pool — HYBRID, capped at TRIP_POOL_SIZE. Exported so the
 * safety net can assert its promise (an unrated sheltered cove CAN be in it).
 *
 * Policy and preference filters apply HERE, once, so every tier downstream
 * (suitable, caution refuge, repeats, alternatives) inherits them:
 * - naturist beaches never surface in any recommendation (the same policy
 *   App.tsx applies to the podium — the planner is the surface where the
 *   visitor takes the answer as THE plan, so there is no opt-in here);
 * - hard preference filters (e.g. Blue Flag) must hold on caution days too,
 *   not just inside getSuitableBeaches.
 *
 * Arms, in pool order (order matters — the essentials are a prefix scan):
 *   A. SIGNIFICANCE — the top SIGNIFICANCE_POOL_SIZE by beachSignificance.
 *   B. GENUINE ENCLOSED COVES — isEnclosedCoveGeometry (1-11 per region,
 *      unconditional): the refuges the whole feature exists for; without this
 *      arm an unrated cove can never surface, which defeats the premise.
 *   C. TRIP-SECTOR SHELTER — beaches with geometry-earned protection on at
 *      least one wind sector THIS trip will actually meet, ranked by sectors
 *      covered, then tighter basin (fetch), then residual wind, filling up to
 *      the cap. Uses the UNION of the trip's winds, never one day's — the
 *      pool doctrine ("never shortlist on today") intact.
 */
export const buildTripPool = (
  beaches: Beach[],
  forecast: DailyForecast[],
  days: number,
  geospatialProfiles?: GeospatialExposureProfileLookup,
  preferences?: UserPreferences
): Beach[] => {
  const horizon = Math.max(0, Math.min(days, forecast.length));
  const eligible = filterBeachesByUserPreferences(beaches, preferences)
    .filter(beach => !isNaturistBeach(beach));
  // The comparator ends on beach id, so the pool (and everything downstream)
  // is independent of the order beaches sit in the region file.
  const bySignificance = [...eligible].sort(compareBeachSignificance);

  const poolIds = new Set<number>();
  const pool: Beach[] = [];
  const add = (beach: Beach) => {
    if (!poolIds.has(beach.id)) {
      poolIds.add(beach.id);
      pool.push(beach);
    }
  };

  // Arm A — significance.
  bySignificance.slice(0, SIGNIFICANCE_POOL_SIZE).forEach(add);

  // Arm B — genuine enclosed coves, in significance order.
  for (const beach of bySignificance) {
    const { profile, source } = resolveBeachWindProfile(beach);
    if (isEnclosedCoveGeometry(beach.id, geospatialProfiles?.[beach.id], profile, source)) {
      add(beach);
    }
  }

  // Arm C — sheltered on the winds of THIS trip, ranked, fills to the cap.
  const tripSectors: WindSector[] = [];
  for (let dayIndex = 0; dayIndex < horizon; dayIndex++) {
    const sector = windSectorFromDegrees(forecast[dayIndex].wind?.deg ?? 0);
    if (!tripSectors.includes(sector)) tripSectors.push(sector);
  }
  const armC: Array<{ beach: Beach; covered: number; maxFetchKm: number; maxIntensity: number }> = [];
  for (const beach of bySignificance) {
    if (poolIds.has(beach.id)) continue;
    const geoProfile = geospatialProfiles?.[beach.id];
    if (!geoProfile) continue;
    const { profile } = resolveBeachWindProfile(beach);
    let covered = 0;
    let maxFetchKm = 0;
    let maxIntensity = 0;
    for (const sector of tripSectors) {
      if (!hasGeometryEnclosedProtection(geoProfile, sector, profile.suspectPin)) continue;
      if (profile.exposedToWindDirections?.includes(sector)) continue;
      covered += 1;
      maxFetchKm = Math.max(maxFetchKm, geoProfile.sectors?.[sector]?.fetchKm ?? 0);
      maxIntensity = Math.max(maxIntensity, geoProfile.sectors?.[sector]?.intensity ?? 0);
    }
    if (covered > 0) armC.push({ beach, covered, maxFetchKm, maxIntensity });
  }
  armC.sort((a, b) =>
    b.covered - a.covered ||
    a.maxFetchKm - b.maxFetchKm ||
    a.maxIntensity - b.maxIntensity ||
    compareBeachSignificance(a.beach, b.beach)
  );
  for (const candidate of armC) {
    if (pool.length >= TRIP_POOL_SIZE) break;
    add(candidate.beach);
  }

  return pool;
};

/**
 * Plans one beach per day for a stay of `days`, using each beach at most once so
 * the trip has variety. Returns one entry per requested day, in day order.
 *
 * RELIABILITY CONTRACT: candidates pass the SAME safety gate as the homepage
 * podium (passesTopPickSeaGate + isFalseProtectedTopPick + the engine's
 * avoid_swimming veto, shared via services/topPickRanking) — the planner can
 * never name a beach the podium would refuse. The full editorial trust gate
 * (isTrustedTopRecommendationCandidate) is deliberately a RANKING tier, not a
 * gate: measured on Naxos N 4 Bft it passes 1 of 20 suitable beaches, so as a
 * gate it would blank a meltemi week. Tier A (trusted) always ranks above
 * Tier B (safe but less evidenced).
 */
export const planTrip = ({
  beaches,
  forecast,
  days,
  language,
  preferences,
  geospatialProfiles,
  userLocation,
  todayRainBlocked,
}: PlanTripInput): TripDayPlan[] => {
  const horizon = Math.max(0, Math.min(days, forecast.length));
  if (horizon === 0 || beaches.length === 0) return [];

  const pool = buildTripPool(beaches, forecast, days, geospatialProfiles, preferences);
  if (pool.length === 0) return [];

  // Score every candidate for every day of the stay — ONE scoring pass per
  // day, shared by the suitable tier and the caution tier (they used to run
  // two independent passes that could disagree on the same beach). Where the
  // normal bar leaves a day empty, drop to the caution tier rather than
  // returning a blank day.
  const rankedByDay: TripPick[][] = [];
  for (let dayIndex = 0; dayIndex < horizon; dayIndex++) {
    const day = forecast[dayIndex];
    const windSpeedKmph = (day.wind?.speed ?? 0) * 3.6;
    const beaufort = getBeaufortLevel(windSpeedKmph);

    const dayScores = new Map<number, BeachScore>();
    for (const beach of pool) {
      dayScores.set(beach.id, calculateBeachScore(beach, day, userLocation, preferences, {
        weatherSource: 'island-fallback',
        hourlyForecast: day.hourly,
        geospatialProfile: geospatialProfiles?.[beach.id],
      }));
    }

    const scored = getSuitableBeaches(
      pool,
      day,
      language,
      userLocation,
      day.hourly,
      preferences,
      undefined,
      geospatialProfiles,
      dayScores
    );

    // The podium's safety gate — shared implementation, not a copy.
    const gated = scored.filter(item =>
      item.swimmingComfort !== 'avoid_swimming' &&
      passesTopPickSeaGate(item, windSpeedKmph, day.marine?.waveHeightM) &&
      !isFalseProtectedTopPick(item, day.wind?.deg ?? 0, beaufort)
    );

    // Tier A/B: trusted candidates first, each tier ordered by the podium's
    // own comparator. getWindPriorityTopPickPool FILTERS to the less-exposed
    // subset — for the podium that is the point, but the planner needs the
    // full ranked list (the essentials assignment must see every safe option),
    // so the non-pooled remainder is appended, same ordering.
    const orderTier = (items: SuitableBeach[]): SuitableBeach[] => {
      const pooled = getWindPriorityTopPickPool(items, beaufort);
      const pooledIds = new Set(pooled.map(item => item.beach.id));
      const rest = items.filter(item => !pooledIds.has(item.beach.id));
      return [
        ...prioritizeProtectedRecommendations(pooled, beaufort),
        ...prioritizeProtectedRecommendations(rest, beaufort),
      ];
    };
    const tierA = gated.filter(item => isTrustedTopRecommendationCandidate(item, undefined, beaufort));
    const tierAIds = new Set(tierA.map(item => item.beach.id));
    const tierB = gated.filter(item => !tierAIds.has(item.beach.id));
    const ranked = [...orderTier(tierA), ...orderTier(tierB)]
      .map(entry => buildPick(entry, day, false, geospatialProfiles));

    rankedByDay.push(
      ranked.length > 0 ? ranked : cautionRanking(pool, day, dayScores, geospatialProfiles)
    );
  }

  const plans = new Map<number, TripDayPlan>();
  const usedBeachIds = new Set<number>();
  // How many days each beach has been assigned — repeats round-robin over the
  // least-used option instead of hammering one beach on every constrained day.
  const assignedCount = new Map<number, number>();
  const pendingDays = new Set<number>();

  for (let dayIndex = 0; dayIndex < horizon; dayIndex++) {
    const day = forecast[dayIndex];
    const confidence: TripDayConfidence = dayIndex < FIRM_FORECAST_DAYS ? 'firm' : 'provisional';

    const weatherReason = badWeatherReason(day, { isFirstDay: dayIndex === 0, todayRainBlocked });
    if (weatherReason) {
      // Honest refusal beats a dressed-up bad day.
      plans.set(dayIndex, {
        dayIndex, date: day.date, status: 'no_beach_day', confidence,
        pick: null, alternative: null, reason: weatherReason, isRepeat: false, isRefuge: false, nextBeachDayIndex: null,
      });
      continue;
    }
    pendingDays.add(dayIndex);
  }

  // THE ESSENTIALS (Structure A) are every beach that carries a real
  // significance signal — curated recognition or an actual review base
  // (utils/beachSignificance.ts). NOT "the top N", where N is the day count:
  // that was measured to be far too brittle. On Naxos with a 2-day trip and 38
  // suitable beaches, a west wind knocked out both of the two top-significance
  // beaches and the planner immediately fell to a REFUGE — labelling a calm
  // 3 Bft day as "nowhere big works, here is a sheltered cove", which is
  // nonsense. With the signal-based set, the scarcity loop simply walks down
  // the significance order to the next beach that works.
  //
  // Nesting still holds, and more strongly than before: the set no longer
  // depends on N at all, so 3 days and 4 days agree by construction.
  const significant = pool.filter(hasSignificanceSignal);
  // Guard: in a region where nothing is rated or curated, everything would be
  // a "refuge" and the exception would become the rule. Fall back to the pool.
  const essentialIds = new Set((significant.length > 0 ? significant : pool).map(beach => beach.id));

  // Scarcity-driven assignment OVER THE ESSENTIALS: serve the most CONSTRAINED
  // day first. The weather no longer chooses the beaches — it only decides
  // which essential lands on which day.
  //
  // The obvious metric — regret, i.e. best minus next-best — is wrong here, and
  // a live Paros meltemi week proved it: a day where everything is mediocre has
  // a tiny gap between 1st and 2nd, so it sorted last and was left with the
  // leftovers. That is precisely backwards; the blowing day is the one the
  // visitor needs us for. So rank by how many ACCEPTABLE options a day still
  // has, and only use regret to break ties.
  while (pendingDays.size > 0) {
    let chosenDay = -1;
    let chosenUsable = Infinity;
    let chosenRegret = -Infinity;
    let chosenList: TripPick[] = [];

    for (const dayIndex of pendingDays) {
      const available = rankedByDay[dayIndex].filter(entry =>
        essentialIds.has(entry.beach.id) && !usedBeachIds.has(entry.beach.id));
      const usableCount = available.filter(isUsable).length;
      const best = available[0];
      const second = available[1];
      const regret = best ? best.score - (second?.score ?? 0) : Infinity;

      const isMoreConstrained =
        usableCount < chosenUsable ||
        (usableCount === chosenUsable && regret > chosenRegret);

      if (isMoreConstrained) {
        chosenUsable = usableCount;
        chosenRegret = regret;
        chosenDay = dayIndex;
        chosenList = available;
      }
    }

    if (chosenDay === -1) break;
    pendingDays.delete(chosenDay);

    const day = forecast[chosenDay];
    const confidence: TripDayConfidence = chosenDay < FIRM_FORECAST_DAYS ? 'firm' : 'provisional';
    let best = chosenList[0];
    let isRepeat = false;
    let isRefuge = false;
    let alternativeList = chosenList;

    // None of the essentials works this day (meltemi): a sheltered REFUGE from
    // outside the list steps in — the explicit exception of Structure B. It is
    // reserved like any pick so two blank days don't both name the same cove.
    if (!best || !isUsable(best)) {
      const refugeList = rankedByDay[chosenDay].filter(entry =>
        !essentialIds.has(entry.beach.id) && !usedBeachIds.has(entry.beach.id));
      const refuge = refugeList.find(isUsable);
      if (refuge) {
        best = refuge;
        isRefuge = true;
        alternativeList = refugeList;
      }
    }

    // Still nothing UNUSED is good enough — but a beach we already visited may
    // still be fine. Repeating beats sending someone nowhere, so fall back to
    // the whole ranking for this day, LEAST-USED first so one beach cannot be
    // the repeat answer for every constrained day of the trip.
    if (!best || !isUsable(best)) {
      const anyUsable = [...rankedByDay[chosenDay]]
        .filter(isUsable)
        .sort((a, b) =>
          (assignedCount.get(a.beach.id) ?? 0) - (assignedCount.get(b.beach.id) ?? 0) ||
          b.score - a.score ||
          a.beach.id - b.beach.id
        )[0];
      if (anyUsable) {
        best = anyUsable;
        isRepeat = true;
        alternativeList = rankedByDay[chosenDay];
      }
    }

    if (!best || !isUsable(best)) {
      // Genuinely nothing works. If it is blowing, say so — "the meltemi leaves
      // nowhere sheltered here" is a useful answer; "no option" is not.
      const beaufort = getBeaufortLevel((day.wind?.speed ?? 0) * 3.6);
      plans.set(chosenDay, {
        dayIndex: chosenDay, date: day.date, status: 'no_beach_day', confidence,
        pick: null, alternative: null,
        reason: beaufort >= WINDY_DAY_BEAUFORT ? 'too_windy' : 'no_match',
        isRepeat: false,
        isRefuge: false,
        nextBeachDayIndex: null,
      });
      continue;
    }

    if (!isRepeat) usedBeachIds.add(best.beach.id);
    assignedCount.set(best.beach.id, (assignedCount.get(best.beach.id) ?? 0) + 1);
    plans.set(chosenDay, {
      dayIndex: chosenDay,
      date: day.date,
      status: 'beach',
      confidence,
      // Provisional here; the real alternative is computed in a second pass
      // below, once every day's pick is known (see D6a note there).
      alternative: alternativeList.find(entry => entry.beach.id !== best!.beach.id) ?? null,
      pick: best,
      reason: null,
      isRepeat,
      isRefuge,
      nextBeachDayIndex: null,
    });
  }

  const ordered = Array.from({ length: horizon }, (_, dayIndex) =>
    plans.get(dayIndex) ?? {
      dayIndex,
      date: forecast[dayIndex].date,
      status: 'no_beach_day' as TripDayStatus,
      confidence: (dayIndex < FIRM_FORECAST_DAYS ? 'firm' : 'provisional') as TripDayConfidence,
      pick: null,
      alternative: null,
      reason: 'no_match' as TripDayReason,
      isRepeat: false,
      isRefuge: false,
      nextBeachDayIndex: null,
    }
  );

  // Alternatives, second pass (D6a): the assignment loop runs in SCARCITY
  // order, so a day served early would otherwise offer an "or X" that a later
  // day then takes as its pick — the runner-up must be a beach that is usable
  // this day AND assigned to no day of the trip.
  for (const entry of ordered) {
    if (entry.status !== 'beach' || !entry.pick) {
      continue;
    }
    entry.alternative = rankedByDay[entry.dayIndex].find(candidate =>
      candidate.beach.id !== entry.pick!.beach.id &&
      !usedBeachIds.has(candidate.beach.id) &&
      isUsable(candidate)
    ) ?? null;
  }

  // Backwards pass: on a blank day, point at the next day of the trip that does
  // have a beach ("the sea settles again on Saturday").
  let nextBeachDay: number | null = null;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (ordered[i].status === 'beach') {
      nextBeachDay = ordered[i].dayIndex;
    } else {
      ordered[i].nextBeachDayIndex = nextBeachDay;
    }
  }

  return ordered;
};
