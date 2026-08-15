import { CALMNESS_ORDER, resolveConditionTone, type CalmnessTone } from './suitabilityTone';
import { shoreSeaStateM } from './waveCharacter';

/**
 * WHAT PAINTED THIS BEACH — the wind, the sea, or our own refusal to let people swim.
 *
 * «Το πορτοκαλί ή το κόκκινο μπορεί να σημαίνει ότι η θάλασσα είναι λάδι αλλά έχει αέρα. Τον
 * χρήστη όμως τον νοιάζει ΚΥΡΙΩΣ αν η παραλία είναι κολυμπήσιμη και ΔΕΥΤΕΡΕΥΟΝΤΩΣ ο αέρας. Όταν
 * βλέπει πορτοκαλί θεωρεί ότι θα έχει πολύ κύμα.» (Μίλτος, 15/08/2026, με το Βάι μπροστά του:
 * 6 Μποφόρ απόγειος, κύμα ~0,1 μ., πινέζα πορτοκαλί.)
 *
 * The colour is a WIND ladder with three brakes that can only ever make it worse
 * (utils/suitabilityTone): `resolveWindTone` → `capToneBySeaState` → `capToneForSwimVerdict`.
 * Nothing on screen says which of the three spoke, and the legend word says «Αισθητός αέρας **ή**
 * κύμα» — the «ή» leaves the reader to guess, and they guess wave. This module answers the
 * question the colour cannot: WHICH brake put the beach where it is.
 *
 * IT IS NOT A SECOND LADDER, AND IT MUST NEVER BECOME ONE. It returns a cause, never a
 * `CalmnessTone`, never a colour class, and nothing ranks, filters or sorts by it. The colour
 * keeps its one job; this is a second, non-scoring channel that only ever explains it.
 *
 * HOW IT KNOWS, WITHOUT A SINGLE RULE OF ITS OWN: it calls `resolveConditionTone` three times —
 * the same function the pin, the chip and the legend call — and simply withholds one brake at a
 * time. Feeding it no sea state gives the wind's own verdict (a missing sea state means no
 * ceiling: utils/waveCharacter.seaStateToneCeiling returns null); feeding it no swim verdict
 * gives wind + sea. The differences between the three answers are the causes. So there is no
 * copy of the cove exemption, of the shelter relief, or of the ceiling arithmetic living here to
 * drift out of sync — the §Κ1 failure of the PORISMA, where a comment claiming «this condition IS
 * the pin, rewritten» had quietly lost half of it.
 *
 * ❌ DO NOT rebuild this on `windFeelLevel` / `waveFeelLevel`. Those are a THIRD scale that has
 * never painted a pin, and it charges the wrong axis: a 'partial' shore at 4 Bft under a 0,9 m sea
 * is painted by the WIND here, and that scale would call it wave.
 */
export type ConditionCause =
  /** The wind-and-exposure ladder alone put it here. */
  | 'wind'
  /** A running sea pulled it down from where the wind had left it. */
  | 'sea'
  /**
   * Neither: wind and sea both left it calmer, and the app's own `avoid_swimming` verdict capped
   * it at ΜΕΤΡΙΑ. Measured nationally 15/08/2026 — **33,9% of every orange reading**, over
   * 14.310 beach × day samples in 110 regions. The plan for this feature assumed two causes; a
   * third of the orange map is neither of them, and a line that named the wind or the sea there
   * would be naming something that did not happen.
   */
  | 'verdict';

/**
 * The exact argument object `resolveConditionTone` takes — derived from it rather than restated,
 * so a field added to the ladder cannot be silently ignored here.
 */
export type ConditionCauseInput = Parameters<typeof resolveConditionTone>[0];

/** CALMNESS_ORDER runs red → blue, so a LOWER index is the rougher colour. */
const isRougher = (a: CalmnessTone, b: CalmnessTone): boolean =>
  CALMNESS_ORDER.indexOf(a) < CALMNESS_ORDER.indexOf(b);

/**
 * Which of the three brakes decided the colour this beach is wearing right now.
 *
 * Order of the tests matters and mirrors the order the brakes are applied in: the swim verdict is
 * the last to speak, so it is the first thing asked about. Each brake can only darken, so at most
 * one of the three comparisons can differ in the calmer direction — there is no tie to break.
 */
export const resolveConditionCause = (input: ConditionCauseInput): ConditionCause => {
  const windOnly = resolveConditionTone({ ...input, seaStateM: undefined, swimVerdictAvoid: false });
  const windAndSea = resolveConditionTone({ ...input, swimVerdictAvoid: false });
  const actual = resolveConditionTone(input);

  if (isRougher(actual, windAndSea)) return 'verdict';
  if (isRougher(windAndSea, windOnly)) return 'sea';
  return 'wind';
};

/**
 * One beach, described the way the cause line needs it: the colour it wears, what put it there,
 * and what the wind alone had made of it. Everything comes out of the ONE ladder — nothing here
 * is a second opinion about a beach.
 */
export interface ConditionCauseReading {
  tone: CalmnessTone;
  cause: ConditionCause;
  /** What the wind and the shore alone made of it, before sea and swim verdict had their say. */
  windOnlyTone: CalmnessTone;
  /** The sea that reaches THIS shore — see FLAT_WATER_SEA_STATE_M. */
  shoreSeaStateM?: number;
  beaufort: number;
  swimVerdictAvoid: boolean;
  offshoreFlatWater: boolean;
}

export const describeConditionCause = (input: ConditionCauseInput): ConditionCauseReading => ({
  tone: resolveConditionTone(input),
  cause: resolveConditionCause(input),
  windOnlyTone: resolveConditionTone({ ...input, seaStateM: undefined, swimVerdictAvoid: false }),
  shoreSeaStateM: shoreSeaStateM(input.seaStateM, input.exposureLevel, input.seaArrivalExposureLevel),
  beaufort: input.beaufort,
  swimVerdictAvoid: input.swimVerdictAvoid ?? false,
  offshoreFlatWater: input.offshoreFlatWater ?? false,
});

/**
 * FLAT WATER — AND WHICH WATER, WHICH IS THE WHOLE QUESTION.
 *
 * Measured at the SHORE (utils/waveCharacter.shoreSeaStateM), not on the open sea, and that is not
 * a softening. Measured nationally 15/08/2026: with the open-water figure, orange beaches over flat
 * water fall from 32,1% to **0,4%** and the line prints on 1 screen in 550 — because the wind that
 * makes a beach orange has almost always built a sea SOMEWHERE, ten kilometres out. Βάι is exactly
 * that beach: 6 Bft, a sea running offshore, and 0,1 μ. on the sand. Asking the open-water number
 * silences the feature precisely in the case that created it.
 *
 * It is also the number the colour ladder itself judges the shore by — `capToneBySeaState` builds
 * its ceiling from `shoreSeaStateM` (suitabilityTone:317) — so the line and the colour are reading
 * the same water. The strictness lives where it belongs instead: in the three safety gates of
 * `resolveCauseLineForm`, which drop the reassuring wording entirely rather than trim its number.
 *
 * Deliberately NOT the number the card prints. That one also takes the enclosed-cove SMB estimate
 * (`shoreWaveHeightM`) into account and is lower still; this is the higher, plainer of the two.
 *
 * 0,4 μ. is the plan's own figure and sits well below the ladder's first sea rung
 * (SEA_STATE_AMBER_M = 0,8) — it is not a rung of the ladder and must never be read as one.
 */
export const FLAT_WATER_SEA_STATE_M = 0.4;

/**
 * Exported since 15/08/2026 for utils/calmWaterFilter, which turns this same question into a chip
 * the reader can tap. One definition of "flat", not two: a filter that promised calm water at a
 * threshold the cause line disagreed with would put «Ήρεμο νερό» on beaches whose own chip says
 * the sea is what painted them.
 */
export const isFlatWater = (shoreM: number | undefined): boolean =>
  typeof shoreM === 'number' && Number.isFinite(shoreM) && shoreM < FLAT_WATER_SEA_STATE_M;

/**
 * The four things a colour group can say about itself, or nothing at all.
 *
 * `null` is the common case by design and by measurement — 15/08/2026, nationally, the group is
 * silent on the great majority of chips. A line that appears every day is wallpaper; this one is
 * only allowed to exist on the days it disagrees with what the colour implies.
 */
export type CauseLineForm =
  /** «Φταίει ο αέρας, όχι το κύμα» — the reassuring form, and the only one with a safety gate. */
  | 'wind-not-wave'
  /** «Ο αέρας σε τραβάει ανοιχτά» — same cause, but nothing about the water is reassuring. */
  | 'wind-pulls-out'
  /** «Φταίει το κύμα, όχι ο αέρας» — closes the opposite misreading («red = windy, I'll go to the lee»). */
  | 'wave-not-wind'
  /** «{n} από αέρα · {n} από κύμα» — a genuinely split group tells the truth instead of picking. */
  | 'split';

/**
 * THE BEAUFORT THAT ENDS THE REASSURANCE — copied in spirit from the card's own brake
 * (utils/conditionsFeelPhrase.RELIEF_MAX_BEAUFORT = 5), and tied to Beaufort rather than to the
 * colour on purpose. Orange contains 5 AND 6 Bft; gating on the colour would silently hand the
 * reassuring wording a whole Beaufort at exactly the step where the app's own verdict turns to
 * «better not to swim».
 */
export const CAUSE_LINE_RELIEF_MAX_BEAUFORT = 5;

/**
 * How much of a group must share one cause before the line may speak with a single voice, and how
 * much of it must have something worth saying at all.
 *
 * Both are display thresholds, not thresholds about the weather — no colour, verdict or ranking
 * reads them. Chosen against the national measurement of 15/08/2026 (14.310 beach × day samples,
 * reports/quality/colour-cause-split.json): at 0,8 the split wording was needed on 0,1% of groups,
 * so the line almost always has one honest thing to say rather than a count.
 */
export const CAUSE_LINE_DOMINANCE = 0.8;
export const CAUSE_LINE_MIN_SHARE = 0.5;

/**
 * What the chip for ONE colour says, given every beach on the map wearing that colour.
 *
 * Reads the GROUP, never a single beach — «Φταίει ο αέρας» is a claim about the nineteen beaches
 * behind the word «Μέτριες», so it is computed from all nineteen. Two counts drive it: beaches the
 * WIND painted over flat water, and beaches the SEA pulled down while the wind was mild. A beach
 * that is neither (most of them, most days — including every beach whose colour came from the swim
 * verdict) pushes the group towards silence, which is the safe direction.
 *
 * THE THREE SAFETY GATES OF THE REASSURING FORM, and they are one-directional:
 *   • one single beach in the group at `avoid_swimming` is enough to drop it (never "all of them");
 *   • 6 Bft anywhere in the group drops it, because orange spans 5 and 6;
 *   • an offshore-flat-water flag anywhere drops it, at ANY Beaufort — that is the exact case
 *     where the water is glass and the air is pushing swimmers away from the beach.
 * Each of them turns the reassurance into the warning form; none of them produces silence, because
 * the reader still deserves to know the wave is not what they are looking at.
 */
export const resolveCauseLineForm = (group: readonly ConditionCauseReading[]): CauseLineForm | null => {
  if (!group.length) return null;

  const windOverFlatWater = group.filter(item => item.cause === 'wind' && isFlatWater(item.shoreSeaStateM));
  const seaOverMildWind = group.filter(item => item.cause === 'sea'
    && (item.windOnlyTone === 'blue' || item.windOnlyTone === 'yellow'));

  const speaking = windOverFlatWater.length + seaOverMildWind.length;
  if (!speaking || speaking / group.length < CAUSE_LINE_MIN_SHARE) return null;

  if (windOverFlatWater.length / speaking >= CAUSE_LINE_DOMINANCE) {
    const unsafe = group.some(item => item.swimVerdictAvoid
      || item.beaufort > CAUSE_LINE_RELIEF_MAX_BEAUFORT
      || item.offshoreFlatWater);
    return unsafe ? 'wind-pulls-out' : 'wind-not-wave';
  }
  if (seaOverMildWind.length / speaking >= CAUSE_LINE_DOMINANCE) return 'wave-not-wind';
  return 'split';
};

/** The two counts the split wording prints. Only meaningful for `'split'`. */
export const countCauseLineSplit = (group: readonly ConditionCauseReading[]): { wind: number; sea: number } => ({
  wind: group.filter(item => item.cause === 'wind' && isFlatWater(item.shoreSeaStateM)).length,
  sea: group.filter(item => item.cause === 'sea'
    && (item.windOnlyTone === 'blue' || item.windOnlyTone === 'yellow')).length,
});

/**
 * MAY THIS COLOUR CARRY A CAUSE LINE AT ALL? (Μίλτος, 15/08/2026 — επιλογή Α· revised same day.)
 *
 * Measured before it was decided, over 550 region × day screens: letting every chip speak put a
 * line on **96,2%** of screens, and 312 of the 535 lines sat on ΙΔΑΝΙΚΕΣ — a colour nobody has
 * ever misread as "big waves". Restricted to the colours that actually frighten, the same rules
 * print on **16,5%** of screens. The line exists to correct a misreading, so it may only appear
 * where the misreading exists:
 *   • ΜΠΛΕ never — «Ιδανικές» carries no wave implication to correct.
 *   • ΚΙΤΡΙΝΟ never, as of this revision — the 5 Bft / glass water / wind-off-the-land warning
 *     ('wind-pulls-out') moved OFF this group-level legend chip. Μίλτος's call, same day: the
 *     individual beach's own card already carries this (WarningFlag `exposed_to_wind` /
 *     `strong_wind` in components/BeachCard.tsx), so the aggregate line here was a second,
 *     less specific copy of a warning the reader already gets per-beach. `wind-pulls-out` and its
 *     safety gates in `resolveCauseLineForm` are untouched — only this legend surface stopped
 *     printing it.
 *   • ΠΟΡΤΟΚΑΛΙ and ΚΟΚΚΙΝΟ — every form. These are the colours the reader translates into wave.
 */
export const causeLineMaySpeak = (tone: CalmnessTone, form: CauseLineForm | null): boolean => {
  if (!form) return false;
  if (tone === 'blue' || tone === 'yellow') return false;
  return true;
};
