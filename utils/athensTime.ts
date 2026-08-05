/**
 * Greek wall-clock "now" — the single source of truth for every time-of-day decision.
 *
 * WHY THIS EXISTS
 * Every beach in this app is in Greece, and every forecast hour we hold is already in
 * Greek local time: Open-Meteo is called with `timezone=auto` (the timezone OF THE
 * COORDINATES, not of the viewer), and its naive "2026-07-25T14:00" strings are parsed
 * with `new Date(...)`, which reads them in the RUNTIME's zone. So a forecast item's
 * `.getHours()` is the Greek wall-clock hour on every device — but its `dt` epoch is
 * "Greek wall clock re-interpreted in the device's zone".
 *
 * That is fine as long as the "now" we compare against lives in the SAME space. Plain
 * `new Date()` does not: it is the viewer's own wall clock. For a viewer abroad the two
 * drift apart and the app points at the wrong hour — a tourist in Germany (UTC+2) asking
 * about a Greek beach at 13:00 Athens time was shown the 12:00 conditions, the "best
 * time" window flipped to "expired" an hour early, and the 21:00 "show tomorrow instead"
 * cutoff fired at the wrong moment. Same numbers as everyone else, wrong hour.
 *
 * `athensNow()` returns a Date whose LOCAL fields (getHours/getDate/...) read Greek wall
 * clock, i.e. exactly the space the forecast items already live in. On a device in Greece
 * it is identical to `new Date()`, so this changes nothing for Greek visitors.
 *
 * RULES
 *   • Time-of-day / calendar-day logic (which hour is "now", today vs tomorrow, is the
 *     best-time window open, day labels) → athensNow().
 *   • Durations and data ages (cache TTL, forecast freshness, "updated N min ago",
 *     analytics timestamps) → Date.now() / new Date(). Those are real instants and must
 *     NOT be shifted; mixing a shifted clock into an age would corrupt the safety-critical
 *     staleness gate.
 * A `setTimeout` delay computed as (shifted boundary − shifted now) is a real duration
 * and stays correct, because both sides carry the same offset.
 */

const ATHENS_TZ = 'Europe/Athens';

// ── Broken-device-clock correction ───────────────────────────────────────────
// Fixing the timezone is not enough: a device whose clock is simply WRONG (hours or
// days off — common on cheap Android and after a flat battery) still reads the wrong
// forecast hour, because we derive Greek time from the device's own instant.
//
// Every forecast response carries the origin server's `Date` header, i.e. a trustworthy
// UTC instant we get for free on requests we already make. We compare it with the device
// clock and, only when they disagree by a lot, carry the difference as a correction.
//
// The threshold is deliberately large: an API response can legitimately look "old" (the
// current-conditions block is rounded down, and a future CDN/edge cache could serve a
// response up to an hour old). 90 minutes is beyond any of that, while a genuinely
// broken clock is normally off by hours or days. Under the threshold we do nothing.
const MIN_CORRECTED_SKEW_MS = 90 * 60 * 1000;

/** device epoch − true epoch (positive = device runs ahead). 0 when the clock is sane. */
let deviceClockSkewMs = 0;
let skewReported = false;

/**
 * Feed a trusted UTC instant (an origin `Date` response header) to the clock check.
 * Safe to call on every response; cheap and idempotent.
 */
export const syncClockFromTrustedInstant = (trustedEpochMs: number): void => {
  if (!Number.isFinite(trustedEpochMs) || trustedEpochMs <= 0) return;

  const skew = Date.now() - trustedEpochMs;
  const corrected = Math.abs(skew) >= MIN_CORRECTED_SKEW_MS ? skew : 0;
  if (corrected === deviceClockSkewMs) return;

  deviceClockSkewMs = corrected;
  if (corrected !== 0 && !skewReported) {
    skewReported = true;
    console.warn('[clock] Device clock is off; correcting displayed times.', {
      skewMinutes: Math.round(corrected / 60000),
    });
  }
};

/** Exposed for the audit/debug surface: how far the device clock is off, in ms. */
export const getDeviceClockSkewMs = (): number => deviceClockSkewMs;

// `undefined` = not resolved yet, `null` = unavailable in this runtime (fall back to local).
let athensParts: Intl.DateTimeFormat | null | undefined;

const getAthensFormatter = (): Intl.DateTimeFormat | null => {
  if (athensParts !== undefined) return athensParts;

  try {
    athensParts = new Intl.DateTimeFormat('en-US', {
      timeZone: ATHENS_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    // No ICU / unknown zone: degrade to the device clock rather than break the app.
    athensParts = null;
  }

  return athensParts;
};

/**
 * Re-expresses an instant as a Date whose local getters read Greek wall clock.
 * Returns the input unchanged when the timezone cannot be resolved.
 */
export const toAthensWallClock = (instant: Date): Date => {
  const formatter = getAthensFormatter();
  if (!formatter) return instant;

  // Undo a known-broken device clock first, so both "now" and any timestamp we captured
  // with that clock (e.g. the "last forecast HH:MM" stamp) read true Greek time.
  const trueInstant = deviceClockSkewMs === 0 ? instant : new Date(instant.getTime() - deviceClockSkewMs);
  const parts = formatter.formatToParts(trueInstant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find(part => part.type === type)?.value;
    return value === undefined ? NaN : Number(value);
  };

  const year = read('year');
  const month = read('month');
  const day = read('day');
  const hour = read('hour');
  const minute = read('minute');
  const second = read('second');

  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return instant;

  // `hourCycle: 'h23'` should never emit 24, but older ICU builds did — normalise so
  // midnight cannot land on an out-of-range hour.
  return new Date(year, month - 1, day, hour % 24, minute, second, instant.getMilliseconds());
};

/** "Now" in Greek wall clock. Use for every time-of-day / calendar-day decision. */
export const athensNow = (): Date => toAthensWallClock(new Date());

/**
 * YYYY-MM-DD from a Date's LOCAL fields.
 *
 * Forecast-day Dates already live in wall-clock space, so `toISOString()` is wrong for
 * them: it re-reads them as UTC and can land on the neighbouring day (in Greece, a
 * wall-clock midnight is 21:00/22:00 UTC the day before). Use this for any key derived
 * from a forecast day — rotation seeds, feedback keys, verification snapshots — so the
 * key matches the day the visitor is actually looking at.
 */
export const wallClockDayKey = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Greek wall-clock day key (YYYY-MM-DD) — stable for all viewers on the same Greek day. */
export const athensDayKey = (instant: Date = new Date()): string =>
  wallClockDayKey(toAthensWallClock(instant));

/**
 * The Athens hour from which the app stops answering about TODAY and answers about tomorrow.
 *
 * ONE CONSTANT, TWO READERS — and it has to stay that way. It used to be declared separately in
 * hooks/useWeather.ts (which decides WHICH DAY is selected) and in components/Forecast.tsx (which
 * decides whether the «Σήμερα» pill is tappable). On 05/08/2026 the first was lowered from 21 to
 * 19 and the second was missed, which put the app in a state no user could make sense of between
 * 19:00 and 20:00: the page had moved to tomorrow while the «Σήμερα» pill still looked available,
 * and tapping it did nothing — clampSelectedDayIndex simply pushed the selection back. A control
 * that looks enabled and refuses to act is worse than one that is visibly disabled.
 *
 * WHY 19. It is a judgement, not a measurement. After seven in the evening someone opening this
 * site is deciding about tomorrow; before that, a swim is still an ordinary thing to do in a
 * Greek summer. It was 21 for a long time, which is the hour the beach-hour slider itself ends
 * (MAP_HOUR_SLIDER_END_HOUR) — so the handover only ever fired once there was no day left to
 * hand over, and the page spent the evening ranking beaches for an hour that had already passed.
 *
 * Nothing is hidden by this: the day chips stay on screen and the handover announces itself.
 */
export const BEACH_DAY_ENDS_HOUR = 19;
