import type { ForecastItem } from '../types';
import { getBeaufortLevel } from './weatherUtils';

/**
 * THE CALMER PART OF A DAY, judged against that day's own range.
 *
 * WHY THIS IS NOT calculateBestBeachTime (services/recommendationService).
 * That helper answers "when does the wind cross 4 Beaufort?" — an ABSOLUTE
 * threshold. It is right for the beach page, where "no window" is a fine
 * answer, and it must not change: the podium and the detail page both read it.
 *
 * But measured against the live forecast on 2026-07-29 it produced a window on
 * 0 of 20 real region-days, for two opposite reasons:
 *   - Aegean July is already 5-6 Bft at 10:00 (Naxos, Paros, Chania), so there
 *     is no crossing to find — the helper returns nothing;
 *   - Corfu ran 1 Bft at 10:00 to 3 Bft at 15:00 and never reached 4, so again
 *     nothing — even though that is precisely a "go in the morning" day.
 *
 * So the planner asks a different question: is one part of THIS day clearly
 * calmer than the rest of it? That works on a 1→3 day and stays quiet on a
 * flat 5→5 one, which is the behaviour a visitor actually needs.
 */

/** The beach day. Matches the window the rest of the app reasons about. */
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 18;

/**
 * The day must vary by at least this much before we point at an hour. One
 * Beaufort is inside forecast error and inside what anyone can feel — claiming
 * a "best time" from it would be inventing precision we do not have.
 */
const MIN_SPREAD_BEAUFORT = 2;

/** A window shorter than this is not a plan, it is noise with a clock on it. */
const MIN_WINDOW_HOURS = 2;

export type DayWindTrend = 'builds' | 'eases';

export interface DayWindWindow {
  /** "10:00" — inclusive start of the calmer stretch. */
  start: string;
  /** "14:00" — where the calmer stretch ends. */
  end: string;
  /** `builds` = calm first then windier; `eases` = windy first then calmer. */
  trend: DayWindTrend;
  /** Beaufort inside the window, and over the rest of the day. */
  calmBeaufort: number;
  otherBeaufort: number;
}

const clock = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/**
 * @param hourly the day's hourly forecast (any span; only 10:00-18:00 is used).
 * Returns undefined whenever there is nothing honest to say: too few hours, a
 * flat day, or a calm stretch too short or too broken to name.
 */
export const resolveDayWindWindow = (hourly: ForecastItem[] | undefined): DayWindWindow | undefined => {
  if (!hourly || hourly.length === 0) return undefined;

  const hours = hourly
    .map(item => {
      const date = new Date(item.dt * 1000);
      return { hour: date.getHours(), beaufort: getBeaufortLevel((item.wind?.speed ?? 0) * 3.6) };
    })
    .filter(entry => entry.hour >= DAY_START_HOUR && entry.hour <= DAY_END_HOUR)
    .sort((a, b) => a.hour - b.hour);

  // Need enough of the day to say anything about its shape.
  if (hours.length < 3) return undefined;

  const beauforts = hours.map(entry => entry.beaufort);
  const min = Math.min(...beauforts);
  const max = Math.max(...beauforts);
  if (max - min < MIN_SPREAD_BEAUFORT) return undefined;

  // "Calm" for this day = within 1 Bft of its own quietest hour. The threshold
  // is relative on purpose: on a meltemi island the calm end may still be
  // 4 Bft, and that is still the hour worth naming.
  const calmCeiling = min + 1;
  const isCalm = hours.map(entry => entry.beaufort <= calmCeiling);

  // Longest contiguous calm run.
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let index = 0; index <= isCalm.length; index++) {
    if (index < isCalm.length && isCalm[index]) {
      if (runStart === -1) runStart = index;
    } else if (runStart !== -1) {
      const length = index - runStart;
      if (length > bestLength) { bestLength = length; bestStart = runStart; }
      runStart = -1;
    }
  }
  if (bestStart === -1) return undefined;

  const runFirst = hours[bestStart];
  const runLast = hours[bestStart + bestLength - 1];
  // Span in real hours, not sample count — hourly data can be 2-hourly.
  const spanHours = runLast.hour - runFirst.hour;
  if (spanHours < MIN_WINDOW_HOURS) return undefined;

  // The run has to leave room for the other half of the story. A "calm window"
  // covering the whole day is just the day.
  const coversWholeDay = runFirst.hour === hours[0].hour && runLast.hour === hours[hours.length - 1].hour;
  if (coversWholeDay) return undefined;

  const startsTheDay = runFirst.hour === hours[0].hour;
  const trend: DayWindTrend = startsTheDay ? 'builds' : 'eases';

  const outside = hours.filter((_, index) => index < bestStart || index >= bestStart + bestLength);
  const otherBeaufort = outside.length > 0 ? Math.max(...outside.map(entry => entry.beaufort)) : max;
  const calmBeaufort = Math.max(...beauforts.slice(bestStart, bestStart + bestLength));

  // When the day BUILDS, the window ends where the wind actually picks up —
  // the first non-calm sample — not at the last calm one, or we would tell
  // someone to leave an hour before anything changes. When it EASES, the calm
  // run already reaches the end of our data, so that hour is the end.
  const nextAfterRun = hours[bestStart + bestLength];
  const endHour = trend === 'builds' && nextAfterRun ? nextAfterRun.hour : runLast.hour;

  return {
    start: clock(runFirst.hour),
    end: clock(endHour),
    trend,
    calmBeaufort,
    otherBeaufort,
  };
};
