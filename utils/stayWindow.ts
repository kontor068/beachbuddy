import { CALMNESS_ORDER, resolveConditionTone, type CalmnessTone } from './suitabilityTone';

/**
 * «ΠΟΣΗ ΩΡΑ ΘΑ ΜΕΙΝΕΙΣ;» — the window, and which hour inside it speaks for it.
 *
 * WHY THIS EXISTS. Until now every surface described ONE moment: the map's hour slider swaps the
 * day's wind, sea, sky and temperature for a single hour (App.adjustDailyForecastToHour) and
 * everything downstream — score, pin colour, verdict word, tiles — follows from it. That is right
 * for "what is it like now" and wrong for "I am going for the afternoon", because a day is very
 * often not one answer.
 *
 * MEASURED BEFORE ANY OF THIS WAS BUILT (scripts/measureIntradayWindowSpread.mjs, 05/08/2026,
 * 2.922 beach-days over the 10 largest regions + 5 controls, live Open-Meteo, wind only):
 *
 *   46,4%  the beach day is NOT one answer — two or more tones between 10:00 and 18:00
 *   41,6%  a 2-hour slot exists whose worst hour is CALMER than the day's worst hour
 *   33,0%  the day's worst hour is rougher than 11:00 — days we currently describe by their
 *          calm start, and someone drives into the windy end of
 *    3,6%  arriving at the wrong hour costs TWO tone steps or more
 *
 * Those numbers are a FLOOR: the measurement left sea state out, and the sea ceiling can only ever
 * make a tone worse. The last one is why this file has no concept of an arrival time. Arrival
 * almost never costs two steps, so the window starts at "now" and the user is asked exactly one
 * thing. The trip planner is the standing warning here: ~20 commits, 1.344 lines, three users in
 * 28 days, because it ASKED («πόσες μέρες;») instead of giving (docs/team/01-product-manager.md).
 *
 * THE RULE: THE WINDOW'S ANSWER IS ITS WORST HOUR, NEVER ITS AVERAGE.
 *
 * An average hides the thing the user is here to avoid. Someone staying 11:00–19:00 on a day that
 * goes to 6 Bft at 17:00 has a bad afternoon that the mean of the day calls fine. Worst-hour is
 * also the only direction consistent with the lesson of 05/08/2026: every gate in this project
 * asks "are we saying it is calmer than it is?" and none asked the reverse, so 840 red words over
 * orange pins survived 24 gates unseen. A window that averages would reopen exactly that door.
 *
 * HOW IT STAYS CONSISTENT WITH EVERYTHING ELSE — and this is the whole design:
 *
 * This module does NOT introduce window-aware scoring. It picks ONE hour per beach — the harshest
 * hour of that beach's window — and hands that single dt back to App, which feeds it to the same
 * adjustDailyForecastToHour every surface already uses. So the card still describes one moment,
 * every number on it still comes from that one moment, and the twenty-odd gates that compare word
 * against pin against tile keep testing the same invariant they always did. The only thing that
 * changed is WHICH moment, and the label says so out loud.
 *
 * That mattered here specifically: on 31/07/2026 the beach page was caught printing «Ήρεμα ΤΩΡΑ»
 * above numbers belonging to a different hour, and the fix was a single verdictMomentLabel. A
 * window implemented as "worst tone here, current numbers there" would have rebuilt that defect
 * across every beach at once.
 */

/** Stay lengths offered, in hours. `null` is the untouched default: this moment only. */
export const STAY_LENGTH_HOURS = [2, 4, 8] as const;
export type StayLengthHours = (typeof STAY_LENGTH_HOURS)[number];

/**
 * How many hours inside a window are actually looked at.
 *
 * The window is scored per beach, so an 8-hour stay across a 200-beach region would be 1.600
 * exposure evaluations per slider tick on top of the pass App already pays for. Sampling every
 * other hour caps it at five. The cost of the gap is bounded and small: wind moves slowly enough
 * at this scale that a one-hour spike between two sampled hours is rare, and when it happens the
 * two hours around it are already the ones being reported.
 *
 * Both ends of the window are always sampled — the last hour is where a meltemi afternoon turns,
 * and dropping it would lose precisely the case this feature exists for.
 */
export const STAY_SAMPLE_STRIDE_HOURS = 2;

export interface StaySlot {
  /** Unix seconds, the same key App's hour slider and mapHourSlots use. */
  dt: number;
}

/**
 * The slots a stay of `stayHours` covers, starting from where the slider already starts.
 *
 * mapHourSlots is already exactly the right input: it is filtered to the beach day, interpolated
 * to one-hour steps, and — for today — sliced so that slot 0 is the hour covering "now". So a stay
 * is simply the first N of them, and no separate notion of "now" is needed or wanted here (a
 * second clock is how the device-time bug got in; see utils/athensTime.ts).
 *
 * A stay longer than the day has left is silently the rest of the day. That is the honest answer —
 * someone asking for eight hours at four in the afternoon gets what is left, not an error.
 */
export const getStayWindowSlots = <T extends StaySlot>(
  slots: readonly T[],
  stayHours: StayLengthHours | null
): readonly T[] => {
  if (stayHours == null || slots.length === 0) return slots.slice(0, 1);
  return slots.slice(0, Math.max(1, Math.min(stayHours, slots.length)));
};

/**
 * The hours actually evaluated inside a window: every STAY_SAMPLE_STRIDE_HOURS-th one, plus the
 * last, which is never dropped.
 */
export const getStaySampleSlots = <T extends StaySlot>(windowSlots: readonly T[]): readonly T[] => {
  if (windowSlots.length <= 1) return windowSlots;
  const sampled: T[] = [];
  for (let i = 0; i < windowSlots.length; i += STAY_SAMPLE_STRIDE_HOURS) sampled.push(windowSlots[i]);
  const last = windowSlots[windowSlots.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
};

/** CALMNESS_ORDER is ['red','orange','yellow','blue'] — lower index is the rougher tone. */
const calmnessRank = (tone: CalmnessTone): number => CALMNESS_ORDER.indexOf(tone);

export interface StayHourSample {
  dt: number;
  tone: CalmnessTone;
}

/**
 * The hour that speaks for the window: the roughest tone in it.
 *
 * Ties go to the EARLIEST such hour, deliberately. When the whole window reads the same — which is
 * the majority of beach-days — this returns the first slot, so a beach whose day does not change
 * behaves exactly as it does today and the feature costs it nothing. It also means the sentence
 * says "from four o'clock" rather than naming a later hour that is no worse.
 */
export const pickHarshestStayHour = (samples: readonly StayHourSample[]): number | null => {
  if (samples.length === 0) return null;
  return samples.reduce((harshest, sample) => (
    calmnessRank(sample.tone) < calmnessRank(harshest.tone) ? sample : harshest
  )).dt;
};

/** One hour of one beach's window, as gathered inputs — never as a colour. */
export interface StayHourReading {
  dt: number;
  /**
   * The beach's exposure for THIS hour's wind direction, read straight off the committed geometry
   * sector. Undefined where a beach has no geometry, which resolveConditionTone already handles.
   */
  exposureLevel?: string;
  beaufort: number;
  /**
   * The km/h `beaufort` was rounded from. Carried so the hour picker asks the ladder the same
   * question the pin does — utils/suitabilityTone.holdsNoBuildableChopAtThree splits the 3 Bft
   * band by speed, and an hour chosen on a coarser reading than the one painted is exactly the
   * two-ladders drift this module was extracted to prevent.
   */
  windSpeedKmh?: number;
  seaStateM?: number;
}

/**
 * The harshest hour of a window, resolved from raw readings.
 *
 * THIS FUNCTION EXISTS HERE, AND NOT IN App.tsx, BY GATE. `validateConditionToneAgreement`'s rule
 * `the-list-does-not-colour-its-own-beaches` forbids App.tsx from calling resolveConditionTone at
 * all — the list must read the tones the map reported and never form an opinion of its own,
 * because the moment two surfaces resolve tone independently they are two ladders again and
 * nothing can tell from outside. The first version of the stay window broke that rule inside App
 * while picking an hour rather than painting one, and the gate was right to refuse it: nobody
 * reviewing App.tsx later can see the difference, and the next person copies the pattern.
 *
 * So App gathers numbers — direction sector, Beaufort, sea — and the tone is formed here, once,
 * beside the rule that needs it.
 */
export const pickHarshestStayHourFromReadings = (
  readings: readonly StayHourReading[]
): number | null => pickHarshestStayHour(toStayHourSamples(readings));

/**
 * Readings → tones. The ONE place in this module where a reading becomes a colour, so every
 * consumer below asks the same question of the same ladder. Extracted on 08/08/2026, when the
 * day-turn sentence needed the identical mapping: a second copy would have been a second ladder,
 * and two ladders drifting apart unseen is the defect class this project keeps paying for.
 */
const toStayHourSamples = (readings: readonly StayHourReading[]): StayHourSample[] => readings.map(reading => ({
  dt: reading.dt,
  tone: resolveConditionTone({
    exposureLevel: reading.exposureLevel,
    beaufort: reading.beaufort,
    // Not known at hour-selection time and deliberately not guessed. A cove reads rougher here
    // than it will be painted, which can only cost us the exact hour chosen — never a calmer
    // claim than the truth.
    isEnclosedCove: false,
    seaStateM: reading.seaStateM,
    windSpeedKmh: reading.windSpeedKmh,
  }),
}));

/** The opening tone, the hour it is first beaten, and what beats it. */
export interface WorseningTurn {
  fromDt: number;
  openingTone: CalmnessTone;
  worseTone: CalmnessTone;
}

/**
 * «ΔΕΝ ΚΡΑΤΑΕΙ ΟΛΗ ΜΕΡΑ» — the first hour genuinely rougher than right now.
 *
 * WHY THIS IS NOT findStayTurningPoint. That one returns the first hour whose tone DIFFERS from
 * the opening, in either direction, because the stay-window card describes a window the visitor
 * chose and any change inside it is news to them. This one feeds the homepage, where nobody asked
 * anything, and there only one direction may be volunteered: that it gets WORSE. An unprompted
 * "it improves at five" is a calmer claim about a future we never measured that way, and the
 * lesson of 05/08/2026 is exactly that every gate here looked in one direction only — so a new
 * unprompted sentence gets the safe direction or it gets nothing.
 *
 * It also asks "rougher than NOW", not "different from the previous hour". A day that dips calm at
 * noon and turns at four would slip past a neighbour-comparison the moment the dip came first.
 * Comparing every hour against the opening is the definition stayWindowDegrades already uses, and
 * the one the 33,0% figure was measured with — so the sentence and the evidence for it agree.
 *
 * Returns null — and the caller then says nothing — when the day holds, when it only improves, or
 * when fewer than two hours are left to speak about. Silence is the correct default: a qualifier
 * printed every day reads as "we are not sure" (the standing rule against permanent uncertainty
 * labels), and 54% of beach-days genuinely are one answer.
 */
export const findWorseningTurnFromReadings = (
  readings: readonly StayHourReading[]
): WorseningTurn | null => {
  const samples = toStayHourSamples(readings);
  if (samples.length < 2) return null;
  const opening = samples[0];
  const openingRank = calmnessRank(opening.tone);
  for (let i = 1; i < samples.length; i += 1) {
    if (calmnessRank(samples[i].tone) < openingRank) {
      return { fromDt: samples[i].dt, openingTone: opening.tone, worseTone: samples[i].tone };
    }
  }
  return null;
};

/**
 * Does the window actually turn, and when?
 *
 * Used for the one sentence the card adds — «ήρεμα μέχρι τις 16:00, μετά σηκώνεται». Returns null
 * when the window holds one tone throughout, which is the case the card must stay silent about:
 * a permanent qualifier on every beach reads as "we are not sure" (see the standing rule against
 * permanent uncertainty labels), and 54% of beach-days genuinely are one answer.
 */
export const findStayTurningPoint = (
  samples: readonly StayHourSample[]
): { fromDt: number; beforeTone: CalmnessTone; afterTone: CalmnessTone } | null => {
  if (samples.length < 2) return null;
  const first = samples[0];
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].tone !== first.tone) {
      return { fromDt: samples[i].dt, beforeTone: first.tone, afterTone: samples[i].tone };
    }
  }
  return null;
};

/**
 * True when the window's answer is worse than its opening hour — i.e. the beach looks fine right
 * now and does not stay that way. Measured at 33,0% of beach-days against an 11:00 arrival, which
 * is the single strongest argument for this feature existing at all: that share of days, the app
 * currently describes by a moment the visitor will have left behind.
 */
export const stayWindowDegrades = (samples: readonly StayHourSample[]): boolean => {
  if (samples.length < 2) return false;
  const opening = calmnessRank(samples[0].tone);
  return samples.some(sample => calmnessRank(sample.tone) < opening);
};
