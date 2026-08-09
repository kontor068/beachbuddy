import type { RegionConditionReading } from '../services/nationalConditions';

/**
 * The landing hero's one live claim: how the sea is doing around Greece RIGHT
 * NOW, as a single word-level mood — never a number, never a named region.
 *
 * WHY THIS SHAPE AND NOT A BEAUFORT READING. The region tiles used to carry a
 * per-region Beaufort and it had to be removed (see TodayRegionsSection's header
 * comment): the sample points sit in OPEN WATER — Corfu's is 23 km offshore —
 * while the region page one click later reads the coast, so the same place
 * showed two different numbers on the same day. That defect is a function of
 * SCOPE, not of the data: an open-water sample is a perfectly honest description
 * of open water, and a dishonest one of a beach.
 *
 * So this module is deliberately confined to the scope the measurement actually
 * covers:
 *   - NATIONAL, never per-region — no tile, pin or page states the same thing at
 *     a finer grain, so there is nothing for it to contradict.
 *   - OPEN SEA, and the copy says so out loud («στα ανοιχτά» / "out at sea").
 *   - A MOOD, not a figure. A number invites comparison with the number on the
 *     next page; "it is blowing hard out at sea" does not.
 *
 * The 5 Bft threshold is not chosen here — it is the app's existing line between
 * "some wind" and "wind you plan around" (components/BeachMap.tsx picks its
 * strong/mild pin wording at >= 5, and components/planner/tripPlannerCopy.ts
 * only allows caution wording from 5 Bft up because 3-4 Bft reads alarmist).
 */

export type NationalWindMood = 'calm' | 'windy';

/**
 * Below this many surviving readings we say nothing at all. The service drops
 * any sample that is not at sea level, so a bad deploy or a partial Open-Meteo
 * response can leave two or three points standing — and "it is calm across
 * Greece" inferred from three points in the same basin is exactly the kind of
 * confident-but-unfounded sentence the methodology forbids. Thirteen points ship
 * today (services/nationalConditions.ts POINTS), so this tolerates five losses.
 */
export const MIN_REGIONS_FOR_MOOD = 8;

/** At or above this, the app everywhere calls it wind you plan around. */
const WINDY_BFT = 5;
/** At or below this, no surface in the app describes the day as windy. */
const CALM_BFT = 3;

/** Half the country blowing is enough to lead with it. */
const WINDY_SHARE = 0.5;
/**
 * Deliberately stricter than the windy share. Saying "it is blowing" when it is
 * not costs a visitor a scroll; saying "it is calm" when it is not is the one
 * error the whole project is built to avoid, so calm has to be nearly unanimous.
 */
const CALM_SHARE = 0.7;

/**
 * `null` means "we are not going to say" — too few readings, and the caller
 * renders nothing rather than a placeholder. The caller is also responsible for
 * the freshness gate (see hooks/useNationalConditions `isFresh`): this function
 * judges the readings it is handed and knows nothing about their age.
 */
export const getNationalWindMood = (
  regions: ReadonlyArray<Pick<RegionConditionReading, 'beaufort'>> | undefined,
): NationalWindMood | null => {
  if (!Array.isArray(regions) || regions.length < MIN_REGIONS_FOR_MOOD) return null;

  const readings = regions.filter(region => Number.isFinite(region?.beaufort));
  if (readings.length < MIN_REGIONS_FOR_MOOD) return null;

  const windy = readings.filter(region => region.beaufort >= WINDY_BFT).length;
  const calm = readings.filter(region => region.beaufort <= CALM_BFT).length;

  // Windy is tested first on purpose: on a day that is half gale and half glass
  // the useful sentence is the one that sends people to look for shelter.
  if (windy / readings.length >= WINDY_SHARE) return 'windy';
  if (calm / readings.length >= CALM_SHARE) return 'calm';

  // THERE IS NO "MIXED" ANSWER. A line saying it blows in some regions and not
  // in others is true on most summer days and worth nothing to the reader — it
  // describes the weather without telling anyone anything they can act on, in
  // the one place on this page allowed to state a fact about today. Saying
  // nothing is better: it keeps the line meaning "something is going on".
  //
  // So the two remaining answers both have to earn their share, and anything in
  // between returns null. One exception: a day with real wind somewhere but not
  // enough of it to clear the windy share still gets the wind sentence, because
  // that is the safe direction to be wrong in.
  if (windy >= 1 && calm === 0) return 'windy';

  return null;
};
