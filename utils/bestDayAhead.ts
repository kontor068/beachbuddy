import type { Beach, BeachForecastContext, DailyForecast, LanguageCode, SuitableBeach } from '../types';
import { athensNow } from './athensTime';
import { getSelectedDayLabel, getSelectedDayPrefix, getSelectedDaySentencePrefix } from './dateLabels';
import { getLocalizedCopy } from './i18n';
import { calculateSeaConditionScore, hasPoorSeaConditions } from './seaConditions';
import { MIN_TOP_PICK_SEA_CONDITION_SCORE } from '../services/topPickRanking';
import { getSuitableBeaches, type BeachWeatherById, type GeospatialExposureLookup } from '../services/recommendationService';

/**
 * «ΣΗΜΕΡΑ ΟΧΙ — Η ΠΕΜΠΤΗ ΝΑΙ» (22/08/2026).
 *
 * On a 6 Bft day the page said «δεν υπάρχει καθαρή επιλογή» and stopped. Meanwhile the SIX-day
 * forecast — weather AND sea — was already fetched and sitting in memory
 * (`services/forecast/openMeteoProvider` asks `forecast_days=6` on every route), and the whole
 * scoring path is already parameterised by day (`selectedDayIndex`). The visitor staying four
 * more days got nothing, and the one thing we did say pushed him to go TODAY.
 *
 * So nothing new is fetched here and no new rule is invented: the same `getSuitableBeaches` runs
 * on a later day's forecast, and the same swimmable test that decides «nothing today» decides
 * whether that day is worth naming. If it is not, this returns null and the page stays silent —
 * «less awful» must never be dressed up as «good».
 *
 * ONE RULE, ONE PLACE: `isSwimmableDayCandidate` is the predicate App.tsx's
 * `hasNoSwimmableBeachesToday` filters on. Today and the day we offer are judged by the exact
 * same lines, so the offer cannot promise a day the real page then refuses.
 */

/** How far ahead we are willing to look. The forecast holds 6 days; day 0 is the one on screen. */
export const MAX_DAYS_AHEAD = 5;

const STORMY_WEATHER = /thunder|storm|snow|squall|heavy rain|rainstorm/;
const SEVERE_BEAUFORT = 5;
const SEVERE_WAVE_M = 1;

/**
 * The gate that opens the whole «nothing today» screen: is this day rough enough that we owe the
 * reader an answer other than a beach? Exported (rather than left inline in App.tsx) so the day
 * we OFFER can be held to the very same bar as the day we are refusing — and so a measurement
 * script asks the product instead of re-writing the rule and grading its own copy.
 */
export const isSevereConditionsDay = (day: DailyForecast, beaufort: number): boolean => {
  const weatherText = `${day.weather?.main ?? ''} ${day.weather?.description ?? ''}`.toLowerCase();
  return beaufort >= SEVERE_BEAUFORT ||
    STORMY_WEATHER.test(weatherText) ||
    (typeof day.marine?.waveHeightM === 'number' && day.marine.waveHeightM >= SEVERE_WAVE_M);
};

/**
 * Is this beach genuinely swimmable on the day it was scored for?
 *
 * Extracted verbatim from the filter inside `hasNoSwimmableBeachesToday` (App.tsx) so that the
 * "nothing today" verdict and the "but this day" offer can never drift apart.
 *
 * Per-item wind (10/08): a beach is judged on its OWN shore's wind when it has one — the region
 * centre's figure no longer speaks for every coast.
 */
export const isSwimmableDayCandidate = (
  item: SuitableBeach,
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): boolean => {
  const itemWindKmph = item.windSpeedKmph ?? windSpeedKmph;
  const itemWaveHeightM = item.seaStateWaveM ?? item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, itemWindKmph, item.exposureLevel, itemWaveHeightM, false, item.seaStatePeriodS);
  const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;
  const hasSeriousWarning = item.warnings?.some(warning =>
    warning.severity === 'critical' ||
    warning.type === 'rough_sea' ||
    warning.type === 'strong_wind'
  );

  return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
    hasGoodHourlySea &&
    !hasSeriousWarning &&
    !hasPoorSeaConditions(item.isExposed, itemWindKmph, item.exposureLevel, itemWaveHeightM, item.seaStatePeriodS);
};

export const countSwimmableBeaches = (
  items: SuitableBeach[],
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): number => items.reduce(
  (total, item) => (isSwimmableDayCandidate(item, windSpeedKmph, fallbackWaveHeightM) ? total + 1 : total),
  0
);

export interface BestDayAheadInput {
  beaches: Beach[];
  /** The region's daily forecasts, in the order the day strip shows them. */
  forecasts: DailyForecast[];
  /** Raw per-beach forecast contexts — each holds the SAME day array as `forecasts`. */
  beachForecasts: Record<number, BeachForecastContext>;
  language: LanguageCode;
  geospatialProfiles?: GeospatialExposureLookup;
  /** The day the visitor is looking at right now. We only ever look forward from it. */
  fromDayIndex: number;
  /** Beaches the caller never recommends (naturist suppression). */
  excludeBeach?: (beach: Beach) => boolean;
  maxDaysAhead?: number;
}

export interface BestDayAhead {
  /** Index into `forecasts` — hand it straight to `setSelectedDayIndex`. */
  dayIndex: number;
  date?: Date;
  /** How many beaches clear the swimmable bar that day. Never promised in copy — see below. */
  swimmableCount: number;
}

/**
 * The SOONEST day ahead on which at least one beach is genuinely swimmable, or null.
 *
 * Soonest, not best: someone who is on the island for three more days needs his next chance, not
 * the theoretical peak of the week. It stops at the first day that clears the bar, so the usual
 * cost is one extra scoring pass, not five.
 *
 * WHY THE BAR IS «HAS A SWIMMABLE BEACH» AND NOT «IS A CALM DAY» (measured 22/08/2026). The first
 * version demanded the offered day also fall below the severe-conditions bar. Measurement on Paros
 * killed it: at exactly 5 Bft with a 0,2 m sea, 17 beaches clear the swimmable test — a day this
 * page would happily fill with recommendations — and the strict version threw it away and stayed
 * silent. The bar that matters is the one the page itself uses: a day is worth naming when we have
 * beaches to put on it. That is also what the copy promises — see buildBestDayAheadCopy.
 *
 * `swimmableCount` is returned for measurement and for gating, NOT to be printed. A number in the
 * copy would be a promise made by this function and kept (or broken) by the live page after the
 * day switches — the exact «δες 6 → 0 αποτελέσματα» defect. The copy names the DAY; the page
 * itself answers with the list.
 */
export const findBestDayAhead = ({
  beaches,
  forecasts,
  beachForecasts,
  language,
  geospatialProfiles,
  fromDayIndex,
  excludeBeach,
  maxDaysAhead = MAX_DAYS_AHEAD,
}: BestDayAheadInput): BestDayAhead | null => {
  if (beaches.length === 0 || !forecasts || forecasts.length === 0) return null;

  const lastIndex = Math.min(forecasts.length - 1, fromDayIndex + maxDaysAhead);

  for (let dayIndex = fromDayIndex + 1; dayIndex <= lastIndex; dayIndex += 1) {
    const day = forecasts[dayIndex];
    if (!day) continue;

    // A thunderstorm day can still score beaches well on wind alone. We do not send anyone
    // there, whatever the sea says — this one is safety, not comfort.
    const weatherText = `${day.weather?.main ?? ''} ${day.weather?.description ?? ''}`.toLowerCase();
    if (STORMY_WEATHER.test(weatherText)) continue;

    const beachWeatherById: BeachWeatherById = {};
    Object.entries(beachForecasts).forEach(([beachId, context]) => {
      const beachDay = context?.forecast?.[dayIndex];
      // Identity with the region day means "no data of its own" — leave it out so
      // getSuitableBeaches takes its normal region fallback, exactly as the today path does.
      if (beachDay && beachDay !== day) beachWeatherById[Number(beachId)] = beachDay;
    });

    const scored = getSuitableBeaches(
      beaches,
      day,
      language,
      undefined,
      day.hourly,
      undefined,
      beachWeatherById,
      geospatialProfiles
    );
    const items = excludeBeach ? scored.filter(item => !excludeBeach(item.beach)) : scored;
    const swimmableCount = countSwimmableBeaches(items, (day.wind?.speed ?? 0) * 3.6, day.marine?.waveHeightM);

    if (swimmableCount > 0) return { dayIndex, date: day.date, swimmableCount };
  }

  return null;
};

export interface BestDayAheadCopy {
  /** The sentence that replaces our silence. */
  line: string;
  /** Label of the control that switches the page to that day. */
  action: string;
}

const capitalizeFirst = (value: string): string => (
  value ? value.charAt(0).toLocaleUpperCase() + value.slice(1) : value
);

/**
 * The words, in ONE place, so the empty list and the recommendation header say the same thing.
 *
 * IT PROMISES WHAT IT CAN KEEP. Not «the sea is calmer» — that is a claim about the weather that
 * a 5 Bft day with a flat, sheltered sea would quietly break. What the offer actually knows is
 * that on that day we HAVE beaches to put in front of the reader, so that is what it says, and
 * the page one tap later is exactly what proves it.
 *
 * No number, either: a count here would be produced by this pass and then re-derived by the live
 * page with slightly richer per-beach data — the «δες 6 → 0 αποτελέσματα» defect rebuilt.
 */
export const buildBestDayAheadCopy = (
  language: LanguageCode,
  date: Date | undefined,
  now: Date = athensNow()
): BestDayAheadCopy => {
  const sentenceDay = getSelectedDaySentencePrefix(date, now, language);
  const day = getSelectedDayLabel(date, now, language);
  const dayPrefix = getSelectedDayPrefix(date, now, language);

  return getLocalizedCopy(language, {
    en: { line: `${sentenceDay} we have beaches to recommend.`, action: `See ${day}` },
    gr: { line: `${sentenceDay} έχουμε παραλίες να προτείνουμε.`, action: `Δες ${dayPrefix}` },
    fr: { line: `${sentenceDay}, nous avons des plages à proposer.`, action: `Voir ${day}` },
    de: { line: `${sentenceDay} haben wir Strände zu empfehlen.`, action: `${capitalizeFirst(day)} ansehen` },
    it: { line: `${sentenceDay} abbiamo spiagge da consigliare.`, action: `Vedi ${day}` },
  });
};
