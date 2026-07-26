import type { Beach, DailyForecast, LanguageCode, SuitableBeach, UserPreferences } from '../types';
import type { ExposureLevel } from '../utils/windExposure';
import type { GeospatialExposureProfileLookup } from './geospatialExposureService';
import { calculateBeachScore, getSuitableBeaches, hasHourlyRainRisk } from './recommendationService';
import { compareBeachSignificance } from '../utils/beachSignificance';
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
 * How many beaches we score per day. Chosen by SIGNIFICANCE (recognition +
 * real review-count fame — utils/beachSignificance.ts), never by today's
 * conditions: shortlisting on today would drop precisely the beaches that
 * open up when the wind turns, which is the whole point of the feature.
 */
const CANDIDATE_POOL_SIZE = 40;

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
// caution — and it never crosses the engine's own hard limits below, which stay
// authoritative: at >= 6 Bft or > 1.2 m the answer remains "not a beach day".
const CAUTION_MIN_SWIMMING_SCORE = 30;
const CAUTION_MAX_WAVE_M = 1.2;
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

/** What the planner hands the UI for one day. */
export interface TripPick {
  beach: Beach;
  score: number;
  waveHeightM?: number;
  exposureLevel?: ExposureLevel;
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
}

/** Storm-force wind or persistent daytime rain — nobody should be sent to a beach. */
const badWeatherReason = (day: DailyForecast): TripDayReason | null => {
  const beaufort = getBeaufortLevel((day.wind?.speed ?? 0) * 3.6);
  if (beaufort >= STORM_BEAUFORT) return 'storm';

  const hours = day.hourly || [];
  if (hours.length === 0) return null;
  // Daytime hours only — overnight rain does not spoil a swim.
  const daytime = hours.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 9 && hour <= 19;
  });
  if (daytime.length === 0) return null;
  const rainy = daytime.filter(hasHourlyRainRisk).length;
  return rainy / daytime.length > 0.5 ? 'rain' : null;
};

/** Wind strong enough that "nothing scored" almost certainly means "nowhere is sheltered". */
const WINDY_DAY_BEAUFORT = 5;

/**
 * Worth sending someone to. Caution-tier picks have already passed their own
 * (stricter, wave/wind-based) gate, and the engine caps their score at 45, so
 * the score floor would wrongly discard them.
 */
const isUsable = (pick: TripPick): boolean => pick.caution || pick.score >= MIN_USABLE_SCORE;

const toPick = (entry: SuitableBeach): TripPick => ({
  beach: entry.beach,
  score: entry.score,
  waveHeightM: entry.waveHeightM,
  exposureLevel: entry.exposureLevel,
  caution: false,
});

/**
 * Best merely-CHOPPY beaches for a day, ranked. Used only when nothing clears the
 * normal suitability bar. Stops dead at the engine's own hard limits so this can
 * never talk someone into a genuinely rough sea.
 */
const cautionRanking = (
  pool: Beach[],
  day: DailyForecast,
  preferences?: UserPreferences,
  geospatialProfiles?: GeospatialExposureProfileLookup
): TripPick[] => {
  if (getBeaufortLevel((day.wind?.speed ?? 0) * 3.6) > CAUTION_MAX_BEAUFORT) return [];

  return pool
    .map(beach => {
      const result = calculateBeachScore(beach, day, undefined, preferences, {
        weatherSource: 'island-fallback',
        hourlyForecast: day.hourly,
        geospatialProfile: geospatialProfiles?.[beach.id],
      });
      return { beach, result };
    })
    .filter(({ result }) => {
      // The engine's official "do not swim" override is absolute.
      if (result.score === 0) return false;
      if ((result.swimmingScore ?? 0) < CAUTION_MIN_SWIMMING_SCORE) return false;
      if (typeof result.waveHeightM === 'number' && result.waveHeightM > CAUTION_MAX_WAVE_M) return false;
      return true;
    })
    .sort((a, b) => (b.result.swimmingScore ?? 0) - (a.result.swimmingScore ?? 0))
    .map(({ beach, result }) => ({
      beach,
      score: result.score,
      waveHeightM: result.waveHeightM,
      exposureLevel: result.exposureLevel,
      caution: true,
    }));
};

/**
 * Plans one beach per day for a stay of `days`, using each beach at most once so
 * the trip has variety. Returns one entry per requested day, in day order.
 *
 * Scoring is delegated to getSuitableBeaches (the same engine the region view
 * uses) so a planned day and a browsed day can never disagree.
 */
export const planTrip = ({
  beaches,
  forecast,
  days,
  language,
  preferences,
  geospatialProfiles,
}: PlanTripInput): TripDayPlan[] => {
  const horizon = Math.max(0, Math.min(days, forecast.length));
  if (horizon === 0 || beaches.length === 0) return [];

  // Candidate pool by SIGNIFICANCE — see CANDIDATE_POOL_SIZE. The comparator
  // ends on beach id, so the pool (and everything downstream) is independent
  // of the order beaches sit in the region file.
  const pool = [...beaches]
    .sort(compareBeachSignificance)
    .slice(0, CANDIDATE_POOL_SIZE);

  // Score every candidate for every day of the stay. Where the normal bar leaves
  // a day empty, drop to the caution tier rather than returning a blank day.
  const rankedByDay: TripPick[][] = [];
  for (let dayIndex = 0; dayIndex < horizon; dayIndex++) {
    const day = forecast[dayIndex];
    const scored = getSuitableBeaches(
      pool,
      day,
      language,
      undefined,
      day.hourly,
      preferences,
      undefined,
      geospatialProfiles
    );
    const ranked = [...scored].sort((a, b) => b.score - a.score).map(toPick);
    rankedByDay.push(
      ranked.length > 0 ? ranked : cautionRanking(pool, day, preferences, geospatialProfiles)
    );
  }

  const plans = new Map<number, TripDayPlan>();
  const usedBeachIds = new Set<number>();
  const pendingDays = new Set<number>();

  for (let dayIndex = 0; dayIndex < horizon; dayIndex++) {
    const day = forecast[dayIndex];
    const confidence: TripDayConfidence = dayIndex < FIRM_FORECAST_DAYS ? 'firm' : 'provisional';

    const weatherReason = badWeatherReason(day);
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

  // THE ESSENTIALS (Structure A): the N most significant beaches usable on at
  // least one day that actually needs a beach — one prefix of one significance-
  // sorted list, so a 3-day and a 4-day trip agree on the first three (nesting).
  // The pool is already significance-sorted; keep that order.
  const eligibleEssentials = pool.filter(beach =>
    Array.from(pendingDays).some(dayIndex =>
      rankedByDay[dayIndex].some(entry => entry.beach.id === beach.id && isUsable(entry))
    )
  );
  const essentialIds = new Set(eligibleEssentials.slice(0, pendingDays.size).map(beach => beach.id));

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
    // the whole ranking for this day before giving up.
    if (!best || !isUsable(best)) {
      const anyUsable = rankedByDay[chosenDay].find(isUsable);
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
    plans.set(chosenDay, {
      dayIndex: chosenDay,
      date: day.date,
      status: 'beach',
      confidence,
      pick: best,
      alternative: alternativeList.find(entry => entry.beach.id !== best!.beach.id) ?? null,
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

/** Days beyond the forecast horizon that the visitor asked about but we cannot answer. */
export const unknownTripDays = (days: number, forecastLength: number): number =>
  Math.max(0, days - Math.min(days, forecastLength));
