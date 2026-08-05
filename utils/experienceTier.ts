import { LanguageCode, SwimmingComfort } from '../types';
import { ExposureLevel } from './windExposure';
import { getLocalizedCopy } from './i18n';
import { getSelectedDayPrefix, getSelectedHourPrefix, isSelectedDateToday } from './dateLabels';
import { athensNow } from './athensTime';
import { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, seaStateSeverityM } from './waveCharacter';
import { resolveWindTone, type CalmnessTone } from './suitabilityTone';

// CalmBeach communicates a FINAL EXPERIENCE, not raw weather. Every beach resolves to one
// of four plain-language tiers derived from the composite suitability score (which already
// blends swimming + experience + preferences), gated by the honest hard caps below. This is
// the single source of truth for the verdict — badges, the map legend and the detail "why"
// section all read from here, so the four colours mean the same thing everywhere.
export type ExperienceTier = 'excellent' | 'good' | 'fair' | 'skip';

export interface ExperienceTierInput {
  /** finalSuitabilityScore / today score, 0–100. */
  score: number;
  windBeaufort?: number;
  /** The day/region Beaufort shown in the header. Falls back to windBeaufort. Used so the
   *  "sheltered reads yellow" floor tracks the day the user sees (4 Bft), not a slightly
   *  higher per-beach micro-reading that would keep a lee-side beach orange. */
  dayBeaufort?: number;
  waveHeightM?: number;
  /** Total-sea period (s). Puts the wave ceiling on the same swell-equivalent scale as the
   *  map pin and the wave graphic, so a short-period chop is not waved through on height alone. */
  wavePeriodS?: number;
  swimmingComfort?: SwimmingComfort;
  /** Only used to split "fair" vs "skip" on a strong-wind (≥5 Bft) day. */
  exposureLevel?: ExposureLevel;
  /**
   * THE COLOUR THIS BEACH'S OWN DOT IS WEARING — `simpleWindSuitability.suitabilityColor`, i.e.
   * post-sea-state (`applySeaStateToWindSuitability`), so it already carries the cove exemption
   * and the offshore-flat-water lift.
   *
   * Supplied rather than derived here for the same reason `offshoreFlatWater` is supplied to
   * resolveConditionTone: the word must be capped by the colour the reader is ACTUALLY looking
   * at on that surface, not by a second computation that could be handed different inputs. Where
   * it is absent the wind-only ladder stands in — see the ceiling block below.
   */
  conditionTone?: CalmnessTone;
  /**
   * 0–10 from calculateSeaConditionScore — the same number the "weather now" chip is built from.
   *
   * The detail page already lifted the badge score when this was high (getDetailBadgeScore), but
   * nothing carried it the other way, so the blue "Excellent today" badge could sit directly above
   * an orange "A little chop right now" chip built from the same forecast. It happens where the
   * composite score is strong but the sea score is not: a steep short-period chop on an open shore
   * in dead air, which the light-wind ladder in seaConditions is specifically built to catch.
   */
  seaConditionScore?: number;
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

/**
 * How good a beach may READ, given the colour it is already PAINTED. The one place the two
 * vocabularies meet.
 *
 * Written out exhaustively rather than as `CALMNESS_ORDER.indexOf(tone)`, which would give the
 * same four numbers today. utils/suitabilityTone documents at length that the DIRECTION of
 * CALMNESS_ORDER is load-bearing for two other consumers and that reversing it would silently
 * invert both; making the verdict word a third silent dependent is exactly the coupling this
 * change exists to remove. An exhaustive Record is also what turned the removal of the cove's
 * 'green' into a list of compiler errors instead of five dead entries — a tone added to the
 * ladder cannot go missing here.
 */
export const TONE_TIER_CEILING: Record<CalmnessTone, 0 | 1 | 2 | 3> = {
  red: 0,
  orange: 1,
  yellow: 2,
  blue: 3,
};

// The tier is a BEACH-EXPERIENCE verdict, not a swimming-safety verdict. The model:
//
//   1. "Not recommended" (red) is reserved for genuinely poor days and kept rare — only a
//      near-gale, a real rough sea, an unsafe-swim call *paired with* real waves, or a very
//      weak pick. Strong wind that merely makes swimming choppy is an "OK, but breezy" day
//      (amber), not a "don't go" — otherwise a whole island turns red on any 6 Bft afternoon.
//   2. A condition "ceiling" caps how good a beach may look given the day (green never shows
//      on a windy or choppy day); the composite score then sets the tier up to that ceiling.
export const getExperienceTier = (input: ExperienceTierInput): ExperienceTier => {
  const { windBeaufort, waveHeightM, swimmingComfort } = input;
  const score = clampScore(input.score);
  const bft = typeof windBeaufort === 'number' ? windBeaufort : 0;
  // Swell-equivalent metres, so this ceiling reads the same sea the wave graphic draws and the
  // map pin is coloured from. Without a period it is the raw height, exactly as before.
  const wave = seaStateSeverityM(waveHeightM, input.wavePeriodS);

  // Red is reserved for a genuinely poor day: near-gale wind, a real rough sea, or a beach
  // that is simply wrong today. A strong breeze that only makes swimming choppy is NOT red on
  // its own — it caps the tier at "OK" below, so a 6 Bft afternoon reads amber, not a wall of red.
  //
  // THE SEA USES THE SHARED BOUNDARY, NOT A PRIVATE ONE. This read 1.5 m while every other
  // surface on the page calls a sea rough at SEA_STATE_ROUGH_M (1.2). The 0.3 m gap was a
  // silent contradiction band: the swim chip in WaveHeightGraphic prints "Difficult for
  // swimming" from 1.2 m (via utils/seaVerdict), so between 1.2 and 1.5 the badge said "OK
  // today" directly above it. Measured over the 4.800-combination condition grid before this
  // change: 1.854 combinations (38,6%) printed Excellent/Good/OK above a sea the shared ladder
  // called rough — reported from Ίος, 29/07/2026 ("OK at 11:00" over "Difficult for swimming").
  //
  // The wind half of that shared verdict is now covered by the `bft >= 5 && pinRedInStrongWind`
  // clause below, which is the pin's own rule rather than a second reading of the same idea —
  // so the getSeaSeverity call that used to stand here was removed on 01/08/2026 rather than
  // left computing a value nothing reads.
  //
  // Red ("skip") tracks the map's wind-colour guide: it only appears from 5 Bft up, and —
  // like the pin — only for beaches the map paints RED there. At 5–6 Bft the pin is red
  // solely for EXPOSED beaches (getSimpleWindColor: partial → orange, protected → yellow),
  // so a partial/protected beach must never read a red "Δεν συνιστάται" under an orange or
  // yellow pin — it caps at "OK" via the ceiling below instead. A near-gale (7 Bft+) is
  // always skip, whatever the shelter.
  //
  // A ROUGH SEA IS ITS OWN REASON, INDEPENDENT OF THE PIN. The pin is a WIND colour; a shore
  // can be in the lee of the wind and still have a sea running into it. Keeping the verdict
  // above the pin is the rule (a beach must never read better than its own pin) — reading
  // WORSE than a wind pin because the water is rough is the safe direction, and it is the only
  // way the badge can stop endorsing a day the same page refuses to swim in.
  //
  // "ROUGH SEA IS ISLAND-WIDE" WAS TRUE UNTIL 01/08/2026, AND IS NOT ANY MORE.
  //
  // The 29/07 version deliberately let only the WIND redden a beach: a rough sea came from one
  // ~9 km marine cell shared by every beach on the island, so treating it as per-beach branded a
  // genuinely sheltered shore «Δεν συνιστάται» beside the one taking the meltemi head-on.
  //
  // Two things changed. Every beach now asks about its OWN sea (per-beach marineSamplePoint,
  // gate `beach-marine-resolution`), so a rough reading is no longer a fact about the island.
  // And Miltos settled what the colour is FOR on 01/08: it answers «πού να πάω για μπάνιο
  // σήμερα». That makes the old compromise untenable — it produced Βραυρώνα 1,9 m amber beside
  // Πλαζ Ραφήνας 1,3 m red, i.e. the rougher sea reading as the better beach.
  //
  // THIS CONDITION IS NOW THE PIN, RESTATED. `seaStateToneCeiling` reddens at SEA_STATE_ROUGH_M,
  // so the verdict must too, or the word sits a whole tier above its own dot — measured before
  // this change: 26 of 60 sampled (exposure × Bft × wave) combinations printed «Μέτρια σήμερα»
  // under a RED pin, and no existing gate could see it. Keep these two in lockstep; if the pin
  // ladder in utils/suitabilityTone moves, this moves with it.
  // ⚠️ 05/08/2026 — THE SEA CLAUSE NOW ONLY FIRES WHERE THERE IS NO DOT TO ASK.
  //
  // The comment above says this condition IS the pin, restated. It was not: `wave` here is the
  // DISPLAY height — the open-water reading from a sample point a median 10 km offshore — while
  // the pin reddens on the SHORE-damped one (`shoreSeaStateM` inside capToneBySeaState). Same
  // 1,2 m boundary, two different numbers, and the harsher one won because this line returns
  // BEFORE the tone ceiling below can speak. Measured across the 5.040-combination grid:
  // 840 (16,7%) printed «Καλύτερα άλλη μέρα» under a NON-red dot, and ALL 840 were protected
  // shores — a lee coast on a meltemi day, i.e. exactly the beach a person should be sent to.
  // Reported from Σχινιάς, 05/08/2026: intensity 0,2/100 with the wind straight off the land,
  // a webcam showing glass, and the page saying "not today".
  //
  // No gate could see it: scripts/validateVerdictConsistency asserts only that the word is never
  // BETTER than the dot. Every net we own asks "are we calling it calmer than it is"; none asks
  // the reverse. That blind spot is the finding, not this line.
  //
  // Deleting the escalation loses nothing, because the conservative answer is already written
  // and already deliberate: a raw display wave ≥ SEA_STATE_ROUGH_M caps the ceiling at 1 («Μέτρια»)
  // at the `wave >= SEA_STATE_ROUGH_M` line below, and a genuinely red dot returns 'skip' at the
  // `toneCeiling === 0` line. So a rough sea still cannot read better than "OK today"; it simply
  // stops jumping past the colour beside it. Where a caller supplies NO tone there is no dot to
  // defer to, so the raw rule stands — that path is unchanged.
  const pinRedInStrongWind = input.exposureLevel !== 'protected' && input.exposureLevel !== 'partial';
  const seaRedensPinWithNoDotToAsk = input.conditionTone === undefined
    && wave !== undefined && wave >= SEA_STATE_ROUGH_M;
  if (bft >= 7 || seaRedensPinWithNoDotToAsk || (bft >= 5 && pinRedInStrongWind)) return 'skip';

  // Condition ceiling: 3 excellent · 2 good · 1 OK.
  //
  // THE DOT IS THE CEILING (02/08/2026). The block below used to be a hand-written wind ladder
  // whose comment claimed to "mirror" the colour engine. It did not, and it could not: a copy of
  // a rule is not the rule. It drifted twice — the comment it replaced still described a ladder
  // with a green tier and a protected shore reading yellow at 5–6 Bft, neither of which had
  // existed since the enclosed cove lost its own colour that morning. Measured against the card's
  // real inputs before this change: 169 of 2.376 combinations (7,1%) printed a word ABOVE the dot
  // beside it — «Καλή» over an orange dot on every protected shore at 5–6 Bft, which is every
  // card on the home page on a windy day.
  //
  // So the colour now sets the ceiling and the ladder below it only ever narrows further:
  //   blue → 3 («Ιδανική») · yellow → 2 («Καλή») · orange → 1 («Μέτρια») · red → 'skip'
  //
  // A MINIMUM, NOT A REPLACEMENT — this is the load-bearing detail. Deriving the ceiling PURELY
  // from the tone was measured too and rejected: it made 54 combinations MORE optimistic, because
  // resolveWindTone reads only `exposureLevel === 'exposed'`, so an unknown-exposure shore is
  // treated as sheltered (yellow at 4 Bft) where this function treats it as exposed. Unknown
  // exposure reading calmer than known-exposed is precisely the wrong direction, so the old
  // ladder stays as an additional floor of caution. What it can no longer do is EXCEED the dot;
  // if it drifts again it can only drift conservative, which is harmless.
  //
  // Where no tone is supplied (a caller that has no colour to give) the wind-only ladder from the
  // same module stands in, so even the fallback path is the shared rule rather than a third copy.
  const isProtected = input.exposureLevel === 'protected';
  const tone = input.conditionTone ?? resolveWindTone(input.exposureLevel, bft);
  const toneCeiling = TONE_TIER_CEILING[tone];
  if (toneCeiling === 0) return 'skip';

  let ceiling: 1 | 2 | 3;
  if (bft <= 2) ceiling = 3;
  else if (isProtected) ceiling = bft >= 5 ? 2 : 3;
  else if (input.exposureLevel === 'partial') ceiling = bft >= 5 ? 1 : bft >= 3 ? 2 : 3;
  else ceiling = bft >= 4 ? 1 : bft >= 3 ? 2 : 3;
  ceiling = Math.min(ceiling, toneCeiling) as 1 | 2 | 3;
  // THE SEA IS NOW COUNTED TWICE, ON TWO DIFFERENT NUMBERS, AND THAT IS DELIBERATE. The tone
  // above already carries a sea ceiling — but computed on `seaStateWaveM`, shore-damped by
  // exposure and exempt for a cove. The one below reads the DISPLAY wave, raw and unexempted.
  // Both are conservative, so the minimum of the two is sound; the pair exists because neither
  // number answers the other's question. Do not "simplify" by deleting this one.
  if (wave !== undefined && wave >= SEA_STATE_ROUGH_M) ceiling = 1;
  else if (wave !== undefined && wave >= SEA_STATE_AMBER_M && ceiling > 2) ceiling = 2;
  if (swimmingComfort === 'avoid_swimming') ceiling = 1;
  // The sea verdict the chip prints is a ceiling here too. The boundaries are the chip's own:
  // it can only say "calm" from 7 up, and says "choppy" at 4 and below (utils/weatherNowCopy).
  const seaScore = input.seaConditionScore;
  if (typeof seaScore === 'number' && Number.isFinite(seaScore)) {
    if (seaScore <= 4) ceiling = 1;
    else if (seaScore < 7 && ceiling > 2) ceiling = 2;
  }

  const scoreTier: 1 | 2 | 3 = score >= 80 ? 3 : score >= 60 ? 2 : 1;
  const rank = Math.min(ceiling, scoreTier);

  // Sheltered floor: a GENUINELY wind-protected beach, with a sea that isn't choppy
  // (ceiling ≥ 2), reads at least "good" (yellow) — if it's out of the wind it's a good
  // beach day there, so it shouldn't fall to "OK" for a middling composite score.
  //
  // ⚠️ THE 5–6 BFT HALF OF THIS WAS REVERSED ON 02/08/2026, BY DECISION, NOT BY REFACTOR.
  // Until then the cutoff read «a VERIFIED-protected beach paints YELLOW through 5–6 Bft, so the
  // verdict must too», and named Άγιος Ερμογένης — still calm at 6 Bft in the lee. That premise
  // died the day before, when the enclosed cove lost its own colour: a protected shore now paints
  // ORANGE at 5–6 Bft. The floor kept lifting the word to «Καλή» over that orange dot on 150 of
  // the measured combinations. Miltos: the word follows the dot.
  //
  // The floor is NOT gated on Beaufort any more than it was; what stops it now is that `ceiling`
  // has already been minimum'd against the tone above, and `rank ≤ ceiling`, so `Math.max(rank, 2)`
  // can never exceed the colour. NO SECOND CLAMP IS NEEDED HERE — adding one would be dead code
  // that reads as load-bearing. The `shelteredFloorMaxBft` of 6 therefore now only does work where
  // the dot itself allows tier 2: a protected shore at 5 Bft with the wind blowing OFF the land
  // (utils/offshoreFlatWater), whose dot is yellow. That is the case the floor was always for.
  //
  // PARTIAL shelter keeps the ≤4 cutoff, matching its pin (partial-at-5-Bft is orange/"Μέτρια").
  // `exposureLevel` is already gated to real protection (canClaimWindProtection) by the caller.
  const lessExposed = isProtected || input.exposureLevel === 'partial';
  const dayBft = typeof input.dayBeaufort === 'number' ? input.dayBeaufort : bft;
  const shelteredFloorMaxBft = isProtected ? 6 : 4;
  const shelteredFloor = dayBft <= shelteredFloorMaxBft && lessExposed && ceiling >= 2;
  const finalRank = shelteredFloor ? Math.max(rank, 2) : rank;
  return finalRank === 3 ? 'excellent' : finalRank === 2 ? 'good' : 'fair';
};

// The verdict describes the live, continuously-updating conditions. For *today* (the default)
// that reads as a clean present-tense phrase; only a future selected date (or a scrubbed hour)
// appends the temporal word, which is then genuinely informative.
type TierLabel = (day: string, isToday: boolean) => string;

const dayLabel = (today: string, withDay: (day: string) => string): TierLabel =>
  (day, isToday) => (isToday ? today : withDay(day));

type TierCopy = Record<ExperienceTier, TierLabel>;

const tierCopy: Record<LanguageCode, TierCopy> = {
  en: {
    excellent: dayLabel('Excellent today', (day) => `Excellent ${day}`),
    good: dayLabel('Good today', (day) => `Good ${day}`),
    fair: dayLabel('OK today', (day) => `OK ${day}`),
    skip: dayLabel('Not recommended today', (day) => `Not recommended ${day}`),
  },
  gr: {
    excellent: dayLabel('Ιδανική σήμερα', (day) => `Ιδανική ${day}`),
    good: dayLabel('Καλή επιλογή σήμερα', (day) => `Καλή επιλογή ${day}`),
    fair: dayLabel('Μέτρια σήμερα', (day) => `Μέτρια ${day}`),
    skip: dayLabel('Καλύτερα άλλη μέρα', (day) => `Δεν συνιστάται ${day}`),
  },
  fr: {
    excellent: dayLabel("Idéale aujourd'hui", (day) => `Idéale ${day}`),
    good: dayLabel("Bon choix aujourd'hui", (day) => `Bon choix ${day}`),
    fair: dayLabel("Correcte aujourd'hui", (day) => `Correcte ${day}`),
    skip: dayLabel("Déconseillée aujourd'hui", (day) => `Déconseillée ${day}`),
  },
  de: {
    excellent: dayLabel('Ideal heute', (day) => `Ideal ${day}`),
    good: dayLabel('Gute Wahl heute', (day) => `Gute Wahl ${day}`),
    fair: dayLabel('Mäßig heute', (day) => `Mäßig ${day}`),
    skip: dayLabel('Heute nicht empfohlen', (day) => `Nicht empfohlen ${day}`),
  },
  it: {
    excellent: dayLabel('Ideale oggi', (day) => `Ideale ${day}`),
    good: dayLabel('Buona scelta oggi', (day) => `Buona scelta ${day}`),
    fair: dayLabel('Discreta oggi', (day) => `Discreta ${day}`),
    skip: dayLabel('Sconsigliata oggi', (day) => `Sconsigliata ${day}`),
  },
};

// From 7 Bft up the day is a hard "avoid", so the skip verdict is stated more firmly
// ("Ακατάλληλη σήμερα" / "unsuitable today") than the softer "better another day" the same
// tier uses for a merely poor day (rough sea / weak pick at 5–6 Bft). This mirrors the map's
// wind colour guide, where 7-10 Bft reads "Ακατάλληλη!" and 5-6 Bft exposed reads "Δύσκολη".
const severeSkipCopy: Record<LanguageCode, TierLabel> = {
  en: dayLabel('Not suitable today', (day) => `Not suitable ${day}`),
  gr: dayLabel('Ακατάλληλη σήμερα', (day) => `Ακατάλληλη ${day}`),
  fr: dayLabel("Impraticable aujourd'hui", (day) => `Impraticable ${day}`),
  de: dayLabel('Heute ungeeignet', (day) => `Ungeeignet ${day}`),
  it: dayLabel('Non adatta oggi', (day) => `Non adatta ${day}`),
};

/**
 * "OK today" is an endorsement of the day. It must never be the word above a swim chip that says
 * the water is difficult — that pair is the contradiction reported from Ίος on 29/07/2026.
 *
 * But the beaches that land here are the ones the map paints yellow or orange in a running sea:
 * genuinely out of the wind, with a sea that is rough anyway because it belongs to the whole
 * island. For them the honest verdict is neither "OK" nor "not recommended" — it is that the
 * shore is the sheltered one and the water is not for swimming. That is what a local says, and it
 * agrees with the swim chip rather than arguing with it.
 */
// It states the WATER, and claims nothing about the shore. "Sheltered" was the first draft and it
// overclaims: a PARTIAL beach reaches this branch too, including one the wind blows straight onto,
// and the shelter line printed directly below already says which of the two this is.
const seaRoughFairCopy: Record<LanguageCode, TierLabel> = {
  en: dayLabel('Rough water today', (day) => `Rough water ${day}`),
  gr: dayLabel('Έχει κύμα σήμερα', (day) => `Έχει κύμα ${day}`),
  fr: dayLabel("Mer agitée aujourd'hui", (day) => `Mer agitée ${day}`),
  de: dayLabel('Heute raue See', (day) => `Raue See ${day}`),
  it: dayLabel('Mare mosso oggi', (day) => `Mare mosso ${day}`),
};

export interface ExperienceTierLabelOptions {
  selectedDate?: Date;
  selectedHour?: number;
  /** Lets the skip verdict harden to "Ακατάλληλη σήμερα" from 7 Bft up (near-gale). */
  windBeaufort?: number;
  /**
   * True when the shared sea verdict (utils/seaVerdict) reads 'rough'. Swaps the 'fair' word away
   * from "OK today", which would otherwise sit above "Difficult for swimming".
   */
  seaIsRough?: boolean;
}

export const getExperienceTierLabel = (
  tier: ExperienceTier,
  language: LanguageCode,
  options: ExperienceTierLabelOptions = {}
): string => {
  const hour = getSelectedHourPrefix(options.selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(options.selectedDate, athensNow(), language);
  const isToday = isSelectedDateToday(options.selectedDate);
  const useCurrentPhrase = isToday && !hour;
  if (tier === 'skip' && typeof options.windBeaufort === 'number' && options.windBeaufort >= 7) {
    return getLocalizedCopy(language, severeSkipCopy)(day, useCurrentPhrase);
  }
  if (tier === 'fair' && options.seaIsRough === true) {
    return getLocalizedCopy(language, seaRoughFairCopy)(day, useCurrentPhrase);
  }
  const copy = getLocalizedCopy(language, tierCopy);
  return copy[tier](day, useCurrentPhrase);
};

export interface ExperienceTierTone {
  container: string;
  icon: string;
  strong: string;
}

// One palette, four meanings, used by every surface: blue → yellow → orange → rose,
// i.e. 🔵 excellent · 🟡 good · 🟠 fair · 🔴 not recommended.
export const experienceTierTone: Record<ExperienceTier, ExperienceTierTone> = {
  excellent: {
    container:
      'border-blue-200/90 bg-blue-50/78 text-blue-800 backdrop-blur-md dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200',
    icon: 'text-blue-600 dark:text-blue-300',
    strong: 'text-blue-700 dark:text-blue-200',
  },
  good: {
    container:
      'border-yellow-200/90 bg-yellow-50/78 text-yellow-800 backdrop-blur-md dark:border-yellow-900/50 dark:bg-yellow-950/35 dark:text-yellow-200',
    icon: 'text-yellow-600 dark:text-yellow-300',
    strong: 'text-yellow-700 dark:text-yellow-200',
  },
  fair: {
    container:
      'border-orange-200/90 bg-orange-50/78 text-orange-800 backdrop-blur-md dark:border-orange-900/50 dark:bg-orange-950/35 dark:text-orange-200',
    icon: 'text-orange-600 dark:text-orange-300',
    strong: 'text-orange-700 dark:text-orange-200',
  },
  skip: {
    container:
      'border-rose-200/90 bg-rose-50/78 text-rose-800 backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300',
    strong: 'text-rose-700 dark:text-rose-200',
  },
};
