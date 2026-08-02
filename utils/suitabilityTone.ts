import type { WindSuitabilityColor } from '../types';
import type { ExposureLevel } from './windExposure';
import { seaStateToneCeiling, shoreSeaStateM, type SeaToneCeiling } from './waveCharacter';

/** Shared visual tokens for the map marker and the compact card wave glyph. */
export const WIND_SUITABILITY_TONE_CLASSES: Record<WindSuitabilityColor, {
  marker: string;
  ring: string;
  badge: string;
  wave: string;
}> = {
  blue: {
    marker: 'bg-sky-500',
    ring: 'ring-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    wave: 'text-sky-500',
  },
  yellow: {
    marker: 'bg-yellow-400',
    ring: 'ring-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    wave: 'text-yellow-400',
  },
  orange: {
    marker: 'bg-orange-500',
    ring: 'ring-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    wave: 'text-orange-500',
  },
  red: {
    marker: 'bg-rose-600',
    ring: 'ring-rose-300',
    badge: 'bg-rose-100 text-rose-700',
    wave: 'text-rose-600',
  },
};

/**
 * ONE CONDITION-COLOUR LADDER FOR THE WHOLE APP.
 *
 * There used to be two, built at different times, and they disagreed on 38% of the
 * (exposure × Beaufort × cove × sea) grid — always with the CARD more optimistic than
 * the map pin (measured 2026-07-31, 192 combinations):
 *
 *   • the region map pin      components/BeachMap.tsx getExposureMarkerTone
 *                             — 5 tones, and it read the sea state as a ceiling
 *   • the card / list chip    utils/windExposureEngine.ts getSimpleWindColor
 *                             — 4 tones, and it NEVER read the sea at all
 *
 * Two classes dominated, both user-visible:
 *   • 0–3 Bft with a running sea ≥0.8 m (the day after a meltemi — the swell outlives the
 *     wind by 12–24 h): card GREEN + shield icon, pin YELLOW/ORANGE. Every exposure level.
 *   • every protected shore at 4 Bft, whatever the sea: card GREEN, pin YELLOW.
 *
 * `seaStateToneCeiling` was written in utils/waveCharacter precisely so that "sea state →
 * colour" lives in exactly one place, "because the pin, the chip and the verdict word have
 * drifted apart before". The chip never called it. This module closes the same hole one
 * level up: BOTH surfaces now derive their tone here, so the drift cannot come back by
 * someone editing one ladder.
 *
 * The map's 5-tone ladder is the survivor — it was the more considered one, and it is the one
 * that already read the sea. The card palette gained the missing 'blue' rather than the ladder
 * being squashed into four tones: collapsing blue into green would have made an uncertain
 * 'partial' shore at 3 Bft look exactly like a verified protected one, a distinction the
 * validation suite pins deliberately.
 */
export type CalmnessTone = 'red' | 'orange' | 'yellow' | 'blue';

/** Roughest → calmest. Index order is the comparison used by every ceiling below. */
export const CALMNESS_ORDER: readonly CalmnessTone[] = ['red', 'orange', 'yellow', 'blue'];

/**
 * The order the LEGEND lists the tones in: calmest first, «Ιδανική → Καλή → Μέτρια → Δύσκολη».
 * Miltos, 02/08/2026 — the legend was reading bottom-up, which puts the worst news first on a
 * page whose whole job is "where can I go today".
 *
 * A SEPARATE CONSTANT, not `[...CALMNESS_ORDER].reverse()` at the call site, because
 * CALMNESS_ORDER is a SEVERITY SCALE and two other places depend on its direction:
 * resolveConditionTone compares `indexOf()` against it so a small wave can never lift a pin past
 * the tone the wind earned, and the map's dominant-tone scan walks it roughest-first. Reversing
 * it in place would invert both without a single test noticing — the sea-state ceiling would
 * start making pins calmer.
 *
 * scripts/validateConditionToneAgreement.mjs asserts these two are exact reverses of each other,
 * so a tone added to one cannot go missing from the other.
 */
export const LEGEND_TONE_ORDER: readonly CalmnessTone[] = ['blue', 'yellow', 'orange', 'red'];

/**
 * An enclosed cove (όρμος) protected from the LIVE wind keeps its water flat as the wind
 * builds (operator-verified at Άγιος Ερμογένης).
 *
 * THE COVE NO LONGER HAS A COLOUR OF ITS OWN (02/08/2026). It used to hold a fifth tone,
 * 'green', at exactly 5 Bft, where a classic protected shore drops to orange. That colour is
 * gone: a cove now wears whatever its conditions are — orange at 5 Bft, blue or yellow below —
 * and carries a BADGE on the map marker instead (see showsCoveBadge). Miltos, 02/08: the shape
 * of a bay is a fact about the place, not a severity, and a fifth severity forced the reader to
 * hold a colour scale that wasn't one. What it still buys the beach is the sea-state exemption
 * below, which is the part that was always about measurement rather than about looks.
 *
 * The upper bound of 5 stays, and it is still the load-bearing part. `swimmingComfortFromScore`
 * returns `avoid_swimming` from an effective Beaufort of 6, and the −1 shelter discount in
 * `getEffectiveBeaufortForComfort` only applies at ≤5 Bft, so a cove at 6 Bft is ALWAYS
 * avoid_swimming. When the cove had a colour, that produced a green pin and a green chip sitting
 * directly above the app's own "better not to swim": measured 2026-07-31 over the shipped
 * geometry, 202 cove-shaped beaches and 1.010 beach × wind-direction combinations (4,4% of the
 * national 22.800). The badge inherits the same ceiling for the same reason — a "this bay is
 * calmer" mark over an avoid_swimming verdict is the identical contradiction wearing a new shape.
 */
export const COVE_CALM_MIN_BEAUFORT = 5;
export const COVE_CALM_MAX_BEAUFORT = 5;

/**
 * The wind above which the app's verdict is unconditionally avoid_swimming. The cove badge must
 * never appear above this line — see the paragraph above; this is the constant that keeps the
 * removed contradiction from reappearing as a badge.
 */
export const COVE_BADGE_MAX_BEAUFORT = 5;

/**
 * Does this beach show the enclosed-cove badge on the map right now?
 *
 * Deliberately WIDER than coveHoldsCalmWater (which is exactly 5 Bft): a badge that existed only
 * at one Beaufort would blink on and off as the hour slider moves and would be absent from almost
 * every map — a symbol nobody sees often enough to learn. Deliberately NARROWER than "is a cove":
 * it requires the shelter to be live, because on a wind blowing into the mouth the bay is not a
 * refuge and the badge would be a lie printed over the beach's own colour.
 */
export const showsCoveBadge = (
  isEnclosedCove: boolean,
  exposureLevel: ExposureLevel | string | undefined,
  beaufort: number
): boolean => (
  isEnclosedCove &&
  exposureLevel === 'protected' &&
  beaufort <= COVE_BADGE_MAX_BEAUFORT
);

export const coveHoldsCalmWater = (
  isEnclosedCove: boolean,
  isProtected: boolean,
  beaufort: number
): boolean => (
  isEnclosedCove &&
  isProtected &&
  beaufort >= COVE_CALM_MIN_BEAUFORT &&
  beaufort <= COVE_CALM_MAX_BEAUFORT
);

/**
 * Wind-and-exposure tone, before the sea has its say.
 *
 * Each exposure column climbs cleanly through the tones as wind builds, so the same colour
 * never repeats down a column. Blue means genuinely calm (0–2 Bft, plus protected/partial
 * shores at 3 Bft where only open coasts feel it) — from 4 Bft up even sheltered shores get
 * visible chop.
 */
/**
 * Does the offshore-flat-water rule actually lift THIS combination? The single answer both the
 * ladder and the sea-state ceiling ask, so the two cannot disagree about whether a lift happened.
 *
 * The Beaufort test is `=== 5`, not `>= 5`, and that is not belt-and-braces duplication of
 * utils/offshoreFlatWater's own gate. This function is handed a caller-supplied boolean and a
 * caller-supplied Beaufort, and nothing stops those two describing different moments — the map
 * hands the flag a beach's own wind and the tone the slider's scrubbed hour, so a beach that is
 * offshore-flat at 14:00 can be passed 6 Bft for 18:00. At 6 Bft the app's own verdict is
 * avoid_swimming, so the ladder has to refuse the lift itself rather than trust the flag.
 */
export const offshoreLiftApplies = (
  exposureLevel: ExposureLevel | string | undefined,
  beaufort: number,
  offshoreFlatWater: boolean
): boolean => offshoreFlatWater && beaufort === 5 && exposureLevel === 'protected';

export const resolveWindTone = (
  exposureLevel: ExposureLevel | string | undefined,
  beaufort: number,
  isEnclosedCove = false,
  /**
   * The wind is blowing OFF the land over zero fetch — see utils/offshoreFlatWater for the gate
   * and the national measurement. Only consulted at 5 Bft, and only to lift orange → yellow.
   */
  offshoreFlatWater = false
): CalmnessTone => {
  const isProtected = exposureLevel === 'protected';
  const isExposed = exposureLevel === 'exposed';

  if (beaufort >= 7) return 'red';
  // A cove used to escape to 'green' here. It no longer escapes at all: at 5 Bft it reads
  // orange like every other sheltered shore, and the bay's own contribution is carried by the
  // map badge (showsCoveBadge) and by the sea-state exemption in resolveConditionTone.
  //
  // THE ONE ESCAPE THAT EXISTS AT 5 BFT IS OFFSHORE WIND OVER ZERO FETCH (02/08/2026). Not a
  // softening of the ladder: it is the case where the ladder was reading the wrong thing. Speed
  // is a proxy for how much wave the wind has built, and with the land upwind and no fetch it has
  // built none. Never reaches 'blue' — the air is still moving hard enough to take an umbrella,
  // and the ceiling below can still pull it back to orange when the open sea is running.
  //
  // BOTH SIGNALS MUST AGREE — `isProtected`, not just `!isExposed`. The offshore flag is pure
  // sector geometry; `exposureLevel` is what the whole engine concluded, curated overrides and
  // suspect pins included. Without this clause a beach an author had explicitly marked exposed
  // to this sector, or one whose pin is suspect, could still be lifted by its own geometry —
  // the geometry outvoting the human knowledge that exists precisely because the geometry is
  // wrong there. It also keeps the pin from rising above the verdict word: utils/experienceTier
  // caps a 'partial' shore at «Μέτρια» from 5 Bft, so lifting a partial pin to yellow would put
  // a calmer colour under a more cautious word.
  if (beaufort >= 5) {
    if (isExposed) return 'red';
    return offshoreLiftApplies(exposureLevel, beaufort, offshoreFlatWater) ? 'yellow' : 'orange';
  }
  // At 4 Bft only genuinely exposed shores escalate to orange; protected and the uncertain
  // "partial" middle get a yellow "mild chop" heads-up.
  if (beaufort >= 4) return isExposed ? 'orange' : 'yellow';
  // At 3 Bft only genuinely exposed coasts feel a real chop; protected and the uncertain
  // "partial" middle stay calm enough to read as blue — this keeps the "uncertain partial"
  // from looking worse than a sheltered neighbour.
  if (beaufort >= 3) return isExposed ? 'yellow' : 'blue';
  return 'blue';
};

/**
 * A running sea sets a CEILING on how calm a surface may look. The wind ladder above cannot
 * see a sea built by wind over the water, earlier in the day, or further down the fetch —
 * which is why a light-wind day on an open shore was calm by construction.
 *
 * Ceiling only: it can never make something look calmer, and never pulls back an escalation
 * the wind already made. A cove that genuinely holds calm water is exempt — the grid cell
 * reporting the sea cannot resolve a 50 m pocket, and letting it overrule an operator-verified
 * morphology would be the marine model overruling the geometry.
 */
/**
 * Sea-state ceilings, roughest → mildest. Relief below is counted in THESE rungs, not in
 * CALMNESS_ORDER, so a small wave can never lift a pin past the tone the wind earned.
 *
 * The cove exemption still does real work here even though the cove lost its colour. A protected
 * cove at 5 Bft now resolves to orange; over a 1,2 m sea the ceiling is red, and red is rougher,
 * so without the exemption the ceiling would repaint the one genuinely calm pocket on the island
 * red — from a marine sample point a median of 10 km offshore that cannot resolve a 50 m bay.
 *
 * `null` — no ceiling at all — is deliberately NOT a rung. Once the open water is running, the
 * shelter correction may soften how bad we call it; it may not delete the fact. The first
 * version of this let a 0,85 m sea outside a sheltered shore land on 'yellow', damp to 0,42 m,
 * and come out with NO ceiling — a blue "calm" pin over a running sea, in 92 of 1.476 grid
 * combinations. scripts/validateConditionToneAgreement caught it. Damping is an estimate and
 * swell wraps into lee shores; 'yellow' ("there is sea about") is the floor that estimate earns.
 */
const CEILING_ORDER: readonly Exclude<SeaToneCeiling, null>[] = ['red', 'orange', 'yellow'];
const MILDEST_RUNG = CEILING_ORDER.length - 1;
const ceilingRung = (c: SeaToneCeiling): number => (c === null ? MILDEST_RUNG : CEILING_ORDER.indexOf(c));

/**
 * How many rungs shelter may lift the sea ceiling. ONE, deliberately.
 *
 * The shore-damping factors are the app's own (utils/waveModel), but they have never been
 * validated against a live grid reading — only against our fetch model. If they overstate how
 * much a headland actually removes, an uncapped lift would take a genuinely dangerous sea from
 * red all the way to no-ceiling-at-all, and the wind ladder alone would paint it calm. One rung
 * keeps the correction useful (red → orange is exactly the "sheltered side of the island on a
 * meltemi day" case) while making a two-step false-calm structurally impossible.
 */
export const MAX_SHELTER_CEILING_RELIEF = 1;

/**
 * A running sea sets a CEILING on how calm a surface may look. The wind ladder above cannot
 * see a sea built by wind over the water, earlier in the day, or further down the fetch —
 * which is why a light-wind day on an open shore was calm by construction.
 *
 * Ceiling only: it can never make something look calmer, and never pulls back an escalation
 * the wind already made. A cove that genuinely holds calm water is exempt — the grid cell
 * reporting the sea cannot resolve a 50 m pocket, and letting it overrule an operator-verified
 * morphology would be the marine model overruling the geometry.
 *
 * SHELTER NOW REACHES THE CEILING TOO (01/08/2026). `seaStateM` arrives from a marine sample
 * point a median of 10 km offshore, so applying the ceiling to it raw asked "how rough is the
 * open sea out there" and painted the answer onto the shore. Above SEA_STATE_ROUGH_M that made
 * exposure irrelevant: a deeply sheltered cove and an open coast took the same red from the same
 * offshore number, and the geometry stopped mattering on exactly the days it matters most.
 * The ceiling is now computed from BOTH the open-water reading and the shore-damped one
 * (utils/waveCharacter.shoreSeaStateM), and the milder of the two wins — capped at one rung.
 */
export const capToneBySeaState = (
  windTone: CalmnessTone,
  seaStateM: number | undefined,
  exempt = false,
  exposureLevel?: ExposureLevel | string
): CalmnessTone => {
  if (exempt) return windTone;
  const openWaterCeiling = seaStateToneCeiling(seaStateM);
  if (!openWaterCeiling) return windTone;

  const shoreCeiling = seaStateToneCeiling(shoreSeaStateM(seaStateM, exposureLevel));
  const rung = Math.min(
    MILDEST_RUNG,
    ceilingRung(shoreCeiling),
    ceilingRung(openWaterCeiling) + MAX_SHELTER_CEILING_RELIEF
  );
  const ceiling = CEILING_ORDER[rung];

  return CALMNESS_ORDER.indexOf(windTone) > CALMNESS_ORDER.indexOf(ceiling) ? ceiling : windTone;
};

/**
 * The single entry point. Everything that paints "how are conditions here right now"
 * — map pin, card chip, list dot, saved-beaches row — must come through this.
 *
 * @param seaStateM swell-equivalent sea state in metres (utils/waveCharacter.seaStateSeverityM),
 *                  NOT the raw height: a 0.45 m 2.5 s chop and a 0.45 m 8 s roll are different water.
 */
export const resolveConditionTone = ({
  exposureLevel,
  beaufort,
  isEnclosedCove = false,
  seaStateM,
  offshoreFlatWater = false,
}: {
  exposureLevel: ExposureLevel | string | undefined;
  beaufort: number;
  isEnclosedCove?: boolean;
  seaStateM?: number;
  /**
   * Wind off the land over zero fetch (utils/offshoreFlatWater.holdsFlatWaterUnderOffshoreWind).
   * Passed rather than derived here so this module keeps knowing nothing about geometry — and so
   * the map pin and the card chip cannot answer it differently: both compute it from the same
   * profile and the same live bearing before calling in.
   *
   * NOT exempt from the sea-state ceiling, unlike the cove. A cove is exempt because the grid
   * cell cannot resolve a 50 m pocket; an offshore wind changes nothing about whether a swell is
   * running outside, so the ceiling must still get its say.
   */
  offshoreFlatWater?: boolean;
}): CalmnessTone => capToneBySeaState(
  resolveWindTone(exposureLevel, beaufort, isEnclosedCove, offshoreFlatWater),
  seaStateM,
  // THE TWO CALM RULES DO NOT STACK. A cove is exempt from the sea ceiling because the grid cell
  // ten kilometres out cannot resolve a 50 m pocket. An offshore wind is a different claim — it
  // says the wind is not BUILDING a wave here, and says nothing about a swell already running
  // outside, which wraps into lee shores. Let both apply at once and a cove on an offshore 5 Bft
  // day reads yellow over a 1,25 m sea, which neither rule alone would allow: the lift makes it
  // yellow and the cove's exemption then hides the sea that should have pulled it back. So a
  // lifted beach gives up the exemption. Where the sea is quiet this costs nothing (there is no
  // ceiling to be exempt from); where it is running, the beach lands on the orange it had before
  // this rule existed. Caught by validateConditionToneAgreement's offshore-lift-still-obeys-the-sea.
  coveHoldsCalmWater(isEnclosedCove, exposureLevel === 'protected', beaufort)
    && !offshoreLiftApplies(exposureLevel, beaufort, offshoreFlatWater),
  exposureLevel
);

/**
 * «Καταλληλότερες» IS THE COLOUR ARITHMETIC (02/08/2026).
 *
 * The list used to be built from a different rule than the map: membership was "this beach's
 * exposure level is protected", while the pins were coloured by wind + sea + geometry through
 * resolveConditionTone. Two rules over the same evidence, so the page could offer a beach the
 * map beside it had painted orange, and the count above the cards answered a question nobody
 * had asked. Miltos, 02/08: the list is the sum of the ΙΔΑΝΙΚΕΣ and the ΚΑΛΕΣ.
 *
 * ΜΕΤΡΙΑ joins only when that sum is under three — an island where nothing is better than fair
 * still has to offer something on a windy day, and a list of one is not a choice. ΔΥΣΚΟΛΗ never
 * joins: the list is an offer, and the app does not offer a beach it has just called difficult.
 * That is enforced structurally — red is simply not reachable from here — rather than by a
 * filter someone can later loosen.
 */
export const SUITABLE_LIST_TONES: readonly CalmnessTone[] = ['blue', 'yellow'];
export const SUITABLE_LIST_TOPUP_TONE: CalmnessTone = 'orange';
export const MIN_SUITABLE_LIST_SIZE = 3;

export const selectSuitableByTone = <T,>(
  items: readonly T[],
  toneOf: (item: T) => CalmnessTone | undefined,
  compare: (a: T, b: T) => number
): T[] => {
  const core = items.filter(item => {
    const tone = toneOf(item);
    return tone !== undefined && SUITABLE_LIST_TONES.includes(tone);
  }).sort(compare);
  if (core.length >= MIN_SUITABLE_LIST_SIZE) return core;

  // Sorted WITHIN each block and then concatenated, never merged: a beach promoted because the
  // island had nothing better must not outrank a genuinely calm one on score alone.
  const topUp = items.filter(item => toneOf(item) === SUITABLE_LIST_TOPUP_TONE).sort(compare);
  return [...core, ...topUp];
};

/**
 * Identity: the card/list palette carries every tone the ladder can emit, so nothing is lost on
 * the way from the shared ladder to a chip. Kept as a named conversion (rather than the raw tone)
 * so the two types stay documented as the same set — if they ever diverge again, it breaks here
 * and nowhere else. It is what turned the removal of 'green' into a compiler error list.
 */
export const toWindSuitabilityColor = (tone: CalmnessTone): WindSuitabilityColor => tone;
