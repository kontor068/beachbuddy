import type { WindSuitabilityColor } from '../types';
import type { ExposureLevel } from './windExposure';
import { GLASS_AT_FOUR_MAX_SEA_STATE_M } from './offshoreFlatWater';
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
/**
 * ΤΟ ΠΑΡΑΘΥΡΟ ΤΩΝ 5 ΜΠΟΦΟΡ ΕΙΝΑΙ ΠΛΕΟΝ ΑΠΟΦΑΣΗ, ΟΧΙ ΚΛΗΡΟΝΟΜΙΑ (§ΑΞ2/Α2, 21/08/2026).
 *
 * ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΤΕΘΗΚΕ. Το κάτω όριο (`>= 5`) δεν είχε ποτέ δική του δικαιολογία: κληρονομήθηκε
 * από το καταργημένο πράσινο χρώμα του όρμου (02/08), που ζούσε ακριβώς στα 5 Μποφόρ. Η εξαίρεση
 * από το ταβάνι θάλασσας όμως στηρίζεται σε επιχείρημα που ΔΕΝ εξαρτάται από την ένταση του
 * ανέμου: «το κελί της πρόγνωσης κάθεται ~10 χλμ έξω και δεν βλέπει μέσα σε κόλπο 50 μ.». Άρα ή
 * το επιχείρημα είναι λάθος, ή το παράθυρο είναι πολύ στενό.
 *
 * ΤΙ ΜΕΤΡΗΘΗΚΕ (`scripts/measureToneOperatorCensus.mjs`, 110/110 περιοχές × 5 ημέρες =
 * 14.365 παραλιο-ημέρες, πραγματικός κινητήρας):
 *   • 740 παραλιο-ημέρες όρμων ζουν ΕΚΤΟΣ του παραθύρου· μόνο 14 παίρνουν σήμερα την εξαίρεση.
 *   • Αν το παράθυρο έφευγε, θα άλλαζαν **85** — και **οι 85 προς το ΗΡΕΜΟΤΕΡΟ**
 *     (20 στα 2 Μποφόρ, 48 στα 3, 17 στα 4).
 *   • **9** από αυτές κουβαλούν ταυτόχρονα «μην κολυμπήσεις».
 *
 * Η ΑΠΟΦΑΣΗ (Μίλτος, 21/08/2026): **ΜΕΝΕΙ ΣΤΑ 5.** Τρεις λόγοι, με αυτή τη σειρά:
 *   1. Και οι 85 αλλαγές πάνε προς την ΨΕΥΔΗ ΗΡΕΜΙΑ — τη σκανδάλη #1 της §9, τον έναν τρόπο με
 *      τον οποίο αυτό το προϊόν βλάπτει.
 *   2. Το κέρδος είναι 85 σε 14.365 (0,6%). Δεν πληρώνει το ρίσκο.
 *   3. Οι 9 με «μην κολυμπήσεις» δείχνουν ότι η ζώνη δεν είναι καθαρή: εκεί το ταβάνι
 *      ετυμηγορίας θα τις ξανάπιανε — θα φτιάχναμε αντίφαση για να τη λύσουμε αμέσως μετά.
 *
 * Αν ξανατεθεί, χρειάζεται ΝΕΑ μέτρηση σε ΜΕΛΤΕΜΙ (η παραπάνω έγινε σε ήρεμο πενθήμερο) και νέα
 * απόφαση — όχι επιχείρημα από το σχήμα του κανόνα.
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

/**
 * The 4 Bft twin of the rule above — see utils/offshoreFlatWater.holdsGlassWaterAtFourBeaufort
 * for the measurement, the doctrine amendment it carries, and the quiet-sea clause that pays
 * for it. Same `isProtected`-not-`!isExposed` requirement and the same exact-Beaufort test, for
 * the same two reasons: the flag is pure geometry while `exposureLevel` is the whole engine's
 * conclusion, and the caller's Beaufort may describe a different hour than the flag's.
 */
export const glassAtFourApplies = (
  exposureLevel: ExposureLevel | string | undefined,
  beaufort: number,
  glassWaterAtFour: boolean
): boolean => glassWaterAtFour && beaufort === 4 && exposureLevel === 'protected';

/**
 * ΤΟ 3 ΜΠΟΦΟΡ ΕΚΡΙΝΕ ΤΗΝ ΤΑΜΠΕΛΑ, ΟΧΙ ΤΟ ΚΥΜΑ (20/08/2026).
 *
 * Αφορμή: Μίλτος, τρεις παραλίες σε κάμερες — Καραβοστάσι Λασιθίου (743), Λυγαριά
 * Φολεγάνδρου (1751), Αγία Μαρίνα Χανίων (546). Και οι τρεις κίτρινες, και οι τρεις λάδι.
 * Κοινό τους: 3 Μποφόρ πάνω σε τομέα `exposed`. Ο κανόνας δεν ρωτούσε ΠΟΤΕ πόσο κύμα χτίζει
 * πράγματι αυτός ο άνεμος — μόνο αν ο τομέας έχει την ταμπέλα.
 *
 * ΤΟ ΝΟΥΜΕΡΟ ΕΙΝΑΙ ΠΑΡΑΓΩΓΟ, ΟΧΙ ΕΠΙΛΟΓΗ. Τρέξαμε το ΔΙΚΟ ΜΑΣ SMB
 * (`utils/waveModel.estimateFetchLimitedWaveHeightM`) πάνω σε **όλους τους 6.283 τομείς που
 * είναι μαρκαρισμένοι `exposed` σε 2.872 παραλίες**, σε όλο το εύρος των 3 Μποφόρ:
 *
 *   ταχύτητα   τομείς που φτάνουν 0,30 μ
 *   12-14      **0,0%**  ← κανένας, σε ΚΑΜΙΑ γεωμετρία της χώρας
 *   15         20,5%
 *   17         67,3%
 *   19         92,9%
 *
 * Το μεγαλύτερο fetch της χώρας είναι 25 χλμ (το ταβάνι των ακτίνων). Εκεί το κύμα πιάνει
 * 0,30 μ **πρώτη φορά στα 14,82 χλμ/ώ**. Άρα κάτω από 14,8 η πρόταση «καμία ελληνική ακτή δεν
 * μπορεί να έχει χτίσει 30 εκ. μ' αυτόν τον άνεμο» δεν είναι εκτίμηση — είναι εξαντλητικά
 * ελεγμένη πάνω στην ίδια τη βάση μας.
 *
 * ΤΟ 14,8 ΚΑΙ ΟΧΙ ΤΟ 14,9: η πρώτη γραφή έλεγε 14,9 και η ίδια της η πύλη την έριξε. Το
 * `estimateFetchLimitedWaveHeightM` στρογγυλοποιεί στα δύο δεκαδικά (`hs.toFixed(2)`), οπότε η
 * ΕΜΦΑΝΙΖΟΜΕΝΗ τιμή γίνεται 0,30 από τα 14,82 — πριν η ωμή τιμή φτάσει το 0,30. Η γραμμή πρέπει
 * να μπει στο νούμερο που ΒΛΕΠΕΙ ο επισκέπτης, όχι στο ωμό: 1.166 τομείς κάθονταν ανάμεσα.
 *
 * ΓΙΑΤΙ ΤΑΧΥΤΗΤΑ ΚΑΙ ΟΧΙ ΤΟ ΚΥΜΑ ΤΟΥ ΤΟΜΕΑ. Δοκιμάστηκε το προφανές — να περνιέται το fetch
 * του ζωντανού τομέα και να υπολογίζεται το κύμα εδώ. **Κόπηκε**: πάνω από 14,9 το αποτέλεσμα
 * εξαρτάται όντως από το fetch (ένα σκέτο όριο ταχύτητας συμφωνεί μόνο 83%), αλλά ΚΑΤΩ από
 * 14,9 το fetch είναι αδιάφορο — 0% περνάει, σε κάθε γεωμετρία. Άρα η μόνη ζώνη όπου η
 * απάντηση είναι βέβαιη είναι και η μόνη που δεν χρειάζεται γεωμετρία. Το να περάσουμε fetch
 * μέσα από έξι σημεία κλήσης θα πρόσθετε ρίσκο απόκλισης κάρτας-πινέζας (§Γ27) για μια ζώνη
 * όπου ούτως ή άλλως αφήνουμε το κίτρινο ανέπαφο.
 *
 * ΤΙ ΔΕΝ ΑΓΓΙΖΕΙ. Τίποτα από 4 Μποφόρ και πάνω. Τίποτα σε `protected`/`partial` (ήταν ήδη
 * μπλε). Και το ταβάνι της θάλασσας τρέχει ΚΑΝΟΝΙΚΑ μετά από αυτό — αν όντως τρέχει φουσκοθαλασσιά,
 * το `resolveConditionTone` μπορεί ακόμα να τραβήξει την πινέζα πίσω.
 *
 * ΧΩΡΙΣ ΤΑΧΥΤΗΤΑ ΔΕΝ ΕΦΑΡΜΟΖΕΤΑΙ. Ίδια αρχή με το `applyGustFloor`: μια διόρθωση που δεν ξέρει
 * πού πατάει δεν εφαρμόζεται. Ο παλιός κανόνας επιβιώνει αυτούσιος όταν λείπει το νούμερο.
 */
export const THREE_BEAUFORT_NO_BUILDABLE_CHOP_MAX_KMH = 14.8;

export const holdsNoBuildableChopAtThree = (
  beaufort: number,
  windSpeedKmh?: number
): boolean => beaufort === 3
  && typeof windSpeedKmh === 'number'
  && Number.isFinite(windSpeedKmh)
  && windSpeedKmh < THREE_BEAUFORT_NO_BUILDABLE_CHOP_MAX_KMH;

export const resolveWindTone = (
  exposureLevel: ExposureLevel | string | undefined,
  beaufort: number,
  isEnclosedCove = false,
  /**
   * The wind is blowing OFF the land over zero fetch — see utils/offshoreFlatWater for the gate
   * and the national measurement. Only consulted at 5 Bft, and only to lift orange → yellow.
   */
  offshoreFlatWater = false,
  /**
   * Same physics at 4 Bft, with a quiet sea proven rather than assumed
   * (utils/offshoreFlatWater.holdsGlassWaterAtFourBeaufort). Only consulted at 4 Bft, and only
   * to lift yellow → blue.
   */
  glassWaterAtFour = false,
  /**
   * The live hourly wind in km/h — the SAME number `beaufort` was derived from, after the gust
   * floor. Only consulted at 3 Bft, and only to lift yellow → blue (holdsNoBuildableChopAtThree).
   * Omitted → the 3 Bft rung behaves exactly as it did before this rule existed.
   */
  windSpeedKmh?: number
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
  //
  // THE ONE ESCAPE AT 4 BFT IS OFFSHORE WIND OVER ZERO FETCH *WITH A QUIET SEA* (18/08/2026,
  // Μελιδόνι Κυθήρων). Reaching blue is a stronger claim than the 5 Bft lift's reach to yellow —
  // there is no rung in between — so this door carries a clause the other one does not: the sea
  // must be measurably small, not merely below the ceiling's amber line. Everything the ladder
  // cannot see still runs after this: the sea-state ceiling can pull it straight back, and the
  // swim verdict caps it at «Μέτρια». Measured nationally before shipping; the numbers and the
  // doctrine amendment they justify live in utils/offshoreFlatWater.
  if (beaufort >= 4) {
    if (glassAtFourApplies(exposureLevel, beaufort, glassWaterAtFour)) return 'blue';
    return isExposed ? 'orange' : 'yellow';
  }
  // At 3 Bft only genuinely exposed coasts feel a real chop; protected and the uncertain
  // "partial" middle stay calm enough to read as blue — this keeps the "uncertain partial"
  // from looking worse than a sheltered neighbour.
  //
  // THE ONE ESCAPE AT 3 BFT IS "THE SEA CANNOT PHYSICALLY BE THERE YET" (20/08/2026 — see
  // holdsNoBuildableChopAtThree). Below that speed the rung was painting a warning colour for a
  // sea our own model puts at 27 cm or less, ANYWHERE in the country.
  if (beaufort >= 3) {
    return isExposed && !holdsNoBuildableChopAtThree(beaufort, windSpeedKmh) ? 'yellow' : 'blue';
  }
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
 * How many rungs the ceiling relaxes when the marine sample point is DOWNWIND of the beach —
 * the wind is blowing off the land over zero fetch, no swell is running, and the "open sea"
 * reading was therefore taken from water this wind is pushing AWAY from the shore (see
 * utils/offshoreFlatWater.hasDownwindSeaSample for the gates and the national measurement).
 *
 * TWO, and never more — this is the «δεύτερο σκαλοπάτι, ποτέ μπλε» decision (Miltos,
 * 10/08/2026). Two rungs takes a red open-water ceiling to yellow, which is where CEILING_ORDER
 * ends: the rung index is still clamped to MILDEST_RUNG, so the ceiling can soften to «Καλή»
 * but can never disappear. Blue over a running open sea stays structurally impossible — the
 * live national measurement found 426 hour-combinations where a full ceiling skip would have
 * produced exactly that (Κεδρόδασος-class, 0,8–1,4 μ. seas whose direction nobody verified),
 * and this constant is why none of them can happen.
 */
export const DOWNWIND_SAMPLE_CEILING_RELIEF = 2;

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
  exposureLevel?: ExposureLevel | string,
  /** The sample the sea reading came from is downwind of this shore — see DOWNWIND_SAMPLE_CEILING_RELIEF. */
  downwindSeaSample = false,
  /**
   * The exposure of the sector the SEA is arriving from (utils/seaArrival). Passed, not derived —
   * same contract as `offshoreFlatWater` and `downwindSeaSample`, and for the same reason: the pin
   * and the chip must not be able to answer it differently. `undefined` keeps the pre-13/08
   * behaviour exactly; see shoreSeaStateM for why it can only ever refuse the shelter discount.
   */
  seaArrivalExposureLevel?: string,
  /**
   * true when this shore's 'protected' level came from the curated cove inspection rather than
   * the strict geometric gate — the map pin says 'partial'. Threaded through so the sea-state
   * discount can refuse it (utils/waveCharacter.shoreSeaStateM). Omitted keeps pre-20/08
   * behaviour, and like every other geometry input here it is PASSED, not derived: the pin and
   * the card must not be able to answer it differently.
   */
  curatedWindOnlyProtection?: boolean,
  /** Η γωνιακή έκπτωση σκιάς K_d από το score — passed, not derived (utils/seaArrival). */
  shoreShadowDamping?: number
): CalmnessTone => {
  if (exempt) return windTone;
  const openWaterCeiling = seaStateToneCeiling(seaStateM);
  if (!openWaterCeiling) return windTone;

  const relief = downwindSeaSample ? DOWNWIND_SAMPLE_CEILING_RELIEF : MAX_SHELTER_CEILING_RELIEF;
  const shoreCeiling = seaStateToneCeiling(
    shoreSeaStateM(seaStateM, exposureLevel, seaArrivalExposureLevel, curatedWindOnlyProtection, shoreShadowDamping));
  const rung = Math.min(
    MILDEST_RUNG,
    ceilingRung(shoreCeiling),
    ceilingRung(openWaterCeiling) + relief
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
/**
 * The calmest colour a beach may wear while the app is telling people not to swim there.
 *
 * ΜΕΤΡΙΑ, never calmer — and never used to make anything calmer than it already was. See
 * `swimVerdictAvoid` below for the measurement that produced this rule.
 */
const SWIM_VERDICT_AVOID_TONE_CEILING: CalmnessTone = 'orange';
const capToneForSwimVerdict = (avoid: boolean | undefined, tone: CalmnessTone): CalmnessTone => {
  if (!avoid) return tone;
  // CALMNESS_ORDER runs red → blue, so a lower index is the rougher colour. Keep whatever the
  // sea and wind already decided when it is already at or below the ceiling.
  return CALMNESS_ORDER.indexOf(tone) <= CALMNESS_ORDER.indexOf(SWIM_VERDICT_AVOID_TONE_CEILING)
    ? tone
    : SWIM_VERDICT_AVOID_TONE_CEILING;
};

/**
 * «ΙΔΑΝΙΚΗ» ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΑΝΩ ΑΠΟ ΚΥΜΑ ΠΟΥ ΤΥΠΩΝΕΙ Η ΙΔΙΑ Η ΟΘΟΝΗ (21/08/2026).
 *
 * Αφορμή: Μίλτος — «Βράχος - Λούτσα, 0,6 μ. κύμα και 3 Μποφόρ, την δίνεις μπλε σαν ιδανική ενώ
 * έχει κύμα». Μετρημένο: κύμα 0,62 μ. στα 3,3 δευτ. → ισοδύναμο 0,72 μ., τομέας W `exposed`,
 * άνοιγμα 25 χλμ. Και τα δύο δίχτυα σώπασαν, το καθένα για δικό του λόγο:
 *
 *   • `capToneBySeaState` δεν έχει ΚΑΜΙΑ γνώμη κάτω από SEA_STATE_AMBER_M (0,80 μ.). Το 0,72
 *     περνάει άθικτο.
 *   • η σκάλα του ανέμου στα ≤3 Μποφόρ γυρίζει μπλε χωρίς να ρωτήσει τη θάλασσα — και ο κανόνας
 *     `holdsNoBuildableChopAtThree` (20/08) μιλάει μόνο για κύμα που ΧΤΙΖΕΙ ο σημερινός άνεμος,
 *     όχι για κύμα που ΥΠΑΡΧΕΙ ΗΔΗ.
 *
 * ΤΟ ΝΟΥΜΕΡΟ ΔΕΝ ΕΙΝΑΙ ΚΑΙΝΟΥΡΓΙΟ — ΕΙΝΑΙ ΤΟ ΔΙΚΟ ΜΑΣ, ΞΕΧΑΣΜΕΝΟ. Το `swimmingComfortForWave`
 * (services/recommendationService.ts) απαιτεί από την πρώτη μέρα κύμα **<0,40 μ.** για να πει
 * «excellent», ενώ το χρώμα δεχόταν μέχρι 0,79. Δύο αριθμοί για την ΙΔΙΑ έννοια, σε δύο οθόνες
 * που στέκονται δίπλα-δίπλα. Εδώ ευθυγραμμίζονται· δεν εφευρίσκεται κατώφλι.
 *
 * ΚΡΙΝΕΤΑΙ Η ΘΑΛΑΣΣΑ ΤΗΣ ΑΚΤΗΣ (`shoreSeaStateM`), ο ίδιος αριθμός που διαβάζουν και το ταβάνι
 * της §4 και η πόρτα των 4 Μποφόρ — όχι το ανοιχτό νερό 10 χλμ έξω. Άρα η γεωμετρία εξακολουθεί
 * να μετράει: μια πραγματικά προστατευμένη ακτή κρατάει την έκπτωση ×0,5 και μένει μπλε εκεί που
 * μια εκτεθειμένη με το ίδιο ανοιχτό κύμα πέφτει.
 *
 * ΕΝΑ ΣΚΑΛΙ, ΜΟΝΟΔΡΟΜΟΣ. Μπλε → κίτρινο και τίποτα άλλο· δεν μπορεί να κάνει τίποτα ηρεμότερο
 * και δεν αγγίζει καμία άλλη απόχρωση. Άγνωστη θάλασσα ΔΕΝ κατεβάζει χρώμα — ίδια αρχή με το
 * `getSeaStateSeverity`: η απουσία μέτρησης δεν είναι απόδειξη κύματος, και το να εφευρίσκουμε
 * ένα είναι ο τρόπος με τον οποίο φεύγουν ψεύτικες κίτρινες μέρες. (Η πόρτα των 4 Μποφόρ κάνει
 * το ΑΝΤΙΘΕΤΟ με την άγνωστη θάλασσα, και σωστά: εκείνη ΑΝΟΙΓΕΙ το ηρεμότερο χρώμα, αυτή εδώ το
 * κλείνει. Ο κανόνας είναι ο ίδιος — η έλλειψη απόδειξης δεν δικαιολογεί ποτέ την πιο τολμηρή
 * κίνηση.)
 *
 * ΚΛΕΙΣΤΟΣ ΟΡΜΟΣ ΕΞΑΙΡΕΙΤΑΙ, με την ίδια έκφραση που εξαιρείται από το ταβάνι της θάλασσας: η
 * μπόγια κάθεται ~10 χλμ έξω και δεν βλέπει μέσα σε κόλπο 50 μ. Δύο εξαιρέσεις με έναν κανόνα.
 *
 * ΕΘΝΙΚΗ ΜΕΤΡΗΣΗ ΠΡΙΝ ΜΠΕΙ: scripts/measureQuietSeaGateAtThree.mjs →
 * reports/quality/quiet-sea-gate-at-three.json.
 */
export const IDEAL_MAX_SHORE_SEA_STATE_M = 0.4;

export const capIdealByShoreSea = (
  tone: CalmnessTone,
  atShoreM: number | undefined,
  exempt: boolean
): CalmnessTone => {
  if (tone !== 'blue' || exempt) return tone;
  if (typeof atShoreM !== 'number' || !Number.isFinite(atShoreM)) return tone;
  return atShoreM >= IDEAL_MAX_SHORE_SEA_STATE_M ? 'yellow' : tone;
};

/**
 * ΤΟ ΦΡΕΝΟ ΤΗΣ ΑΒΕΒΑΙΟΤΗΤΑΣ ΤΗΣ ΠΡΟΓΝΩΣΗΣ (§ΑΞ2/Α5, 21/08/2026).
 *
 * Όταν τα 51 σενάρια του ECMWF διαφωνούν για ΑΥΤΗ τη μέρα σε αυτή την περιοχή (≥4 ώρες
 * κολύμβησης με p90−p10 ≥2 βαθμίδες Μποφόρ), η πινέζα δεν επιτρέπεται να λέει ΙΔΑΝΙΚΗ. Ένα
 * σκαλί, μπλε → κίτρινο, τίποτα άλλο· δεν μπορεί να κάνει τίποτα ηρεμότερο και δεν αγγίζει
 * καμία άλλη απόχρωση.
 *
 * ΠΕΡΑΣΜΕΝΟ, ΟΧΙ ΠΑΡΑΓΟΜΕΝΟ, όπως κάθε άλλο όρισμα εδώ: η σημαία ζει πάνω στην ίδια την ημέρα
 * της πρόγνωσης (utils/forecastUncertainty.applyForecastUncertaintyToDays) και ταξιδεύει μέσω
 * της βαθμολογίας ως την πινέζα, ώστε η κάρτα και ο χάρτης να μην μπορούν να απαντήσουν
 * διαφορετικά. Απουσία σημαίας = «δεν ξέρω» = καμία αλλαγή· ΠΟΤΕ δεν φρενάρει τη σημερινή μέρα
 * (το φιλτράρισμα γίνεται στην πηγή, βλ. UNCERTAINTY_MIN_LEAD_DAYS).
 *
 * ΜΙΛΑΕΙ ΜΟΝΟ ΓΙΑ ΤΟΝ ΑΝΕΜΟ: το ensemble δεν δίνει κύμα. Γι' αυτό τρέχει ΤΕΛΕΥΤΑΙΟ, πάνω από
 * ό,τι έχει ήδη αποφασίσει η θάλασσα — δεν αντικαθιστά καμία κρίση, μόνο κόβει την πιο τολμηρή.
 */
export const capBlueByForecastUncertainty = (
  tone: CalmnessTone,
  forecastUncertain: boolean | undefined,
): CalmnessTone => (forecastUncertain && tone === 'blue' ? 'yellow' : tone);

export const resolveConditionTone = ({
  exposureLevel,
  beaufort,
  isEnclosedCove = false,
  seaStateM,
  offshoreFlatWater = false,
  glassWaterAtFour = false,
  downwindSeaSample = false,
  swimVerdictAvoid = false,
  seaArrivalExposureLevel,
  curatedWindOnlyProtection = false,
  shoreShadowDamping,
  windSpeedKmh,
  forecastUncertain = false,
}: {
  exposureLevel: ExposureLevel | string | undefined;
  beaufort: number;
  isEnclosedCove?: boolean;
  seaStateM?: number;
  /**
   * The live hourly wind in km/h that produced `beaufort` (after utils/windGustFloor).
   *
   * Passed rather than re-derived from `beaufort`, because the band is 8 km/h wide and the whole
   * point of holdsNoBuildableChopAtThree is that its bottom half behaves differently from its
   * top. Every caller that can compute a Beaufort already holds this number, so leaving it out
   * is an omission, not a shortage — and an omission simply keeps the pre-20/08/2026 behaviour.
   */
  windSpeedKmh?: number;
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
  /**
   * The 4 Bft door (utils/offshoreFlatWater.holdsGlassWaterAtFourBeaufort) — offshore wind over
   * zero fetch AND a sea proven quiet. Lifts yellow → blue and nothing else. Passed rather than
   * derived, on the same contract as every other geometry input here: the pin and the chip must
   * not be able to answer it differently.
   *
   * It already contains a sea test of its own, which is NOT a duplicate of the ceiling below:
   * both read `shoreSeaStateM`, but the ceiling has no opinion under 0,8 m while this door may
   * only fire under 0,4 m.
   */
  glassWaterAtFour?: boolean;
  /**
   * The sea reading was taken downwind of this shore with no swell running
   * (utils/offshoreFlatWater.hasDownwindSeaSample) — the ceiling relaxes by one extra rung,
   * never further. Same passed-not-derived contract as offshoreFlatWater, same reason.
   */
  downwindSeaSample?: boolean;
  /**
   * «ΟΤΑΝ ΛΕΕΙ ΚΑΛΗ ΘΕΛΩ ΝΑ ΜΠΟΡΕΙΣ ΝΑ ΚΟΛΥΜΠΗΣΕΙΣ ΚΙΟΛΑΣ» (Μίλτος, 10/08/2026).
   *
   * The engine's own swim verdict for this beach and hour is `avoid_swimming`. Measured across
   * 136.992 beach × wind × sea combinations that night: **5.863 of 49.514 blue/yellow readings
   * (11,8%) carried it** — a pin the legend calls ΙΔΑΝΙΚΗ or ΚΑΛΗ over a beach the same app tells
   * you not to swim at. The two surfaces were computed from the same weather by two ladders that
   * never spoke: the colour asks "how does today's wind meet this shore", the verdict asks "can
   * you get in", and nothing required the answers to be compatible.
   *
   * It is a CEILING and it only ever darkens: at best ΜΕΤΡΙΑ, never below whatever the sea and
   * wind already decided, and red stays red. So it can never make a beach look calmer — the one
   * direction this project refuses to fail in — and «Καλή» now means what a reader assumes it
   * means. Passed rather than derived here, exactly like the sea state and the offshore flag: the
   * pin and the chip must not be able to answer this differently.
   */
  swimVerdictAvoid?: boolean;
  /**
   * The exposure of the sector the SEA is arriving from — utils/seaArrival.resolveSeaArrivalExposureLevel,
   * carried on the score as `seaArrivalExposureLevel`. Without it a shore sheltered from today's
   * WIND kept a ×0,5 discount on a sea rolling in through a wide-open sector (Καβαλικευτά,
   * 13/08/2026). Passed rather than derived, like every other geometry input here.
   */
  seaArrivalExposureLevel?: string;
  /**
   * true when this shore's 'protected' level came from the curated cove inspection rather than
   * the strict geometric gate — the map pin says 'partial'. Threaded through so the sea-state
   * discount can refuse it (utils/waveCharacter.shoreSeaStateM). Omitted keeps pre-20/08
   * behaviour, and like every other geometry input here it is PASSED, not derived: the pin and
   * the card must not be able to answer it differently.
   */
  curatedWindOnlyProtection?: boolean;
  /**
   * Η γωνιακή έκπτωση σκιάς K_d του score (utils/seaArrival.resolveShoreShadowDamping,
   * 24/08/2026). Passed, not derived — ίδιο συμβόλαιο με κάθε γεωμετρική είσοδο εδώ: πινέζα
   * και chip δεν επιτρέπεται να απαντούν με άλλο συντελεστή. Παράλειψη = ιστορικό 0,5.
   */
  shoreShadowDamping?: number;
  /**
   * Τα σενάρια της πρόγνωσης διαφωνούν για αυτή τη μέρα — δες `capBlueByForecastUncertainty`.
   * Παραλείπεται (ή `false`) → η συμπεριφορά είναι byte-identical με πριν τις 21/08/2026.
   */
  forecastUncertain?: boolean;
}): CalmnessTone => {
  /**
   * Η ΘΑΛΑΣΣΑ ΤΗΣ ΑΚΤΗΣ, ΥΠΟΛΟΓΙΣΜΕΝΗ ΜΙΑ ΦΟΡΑ, ΔΙΑΒΑΣΜΕΝΗ ΔΥΟ.
   *
   * Την ίδια έκφραση έτρεχε ήδη η ρήτρα της πόρτας των 4 Μποφόρ παρακάτω· τώρα τη μοιράζεται με
   * το δάπεδο του ΙΔΑΝΙΚΗ (`capIdealByShoreSea`). Δύο κανόνες που κρίνουν «πόσο κύμα φτάνει
   * εδώ» δεν επιτρέπεται να το υπολογίζουν χωριστά — έτσι ξεκινάει κάθε απόκλιση κάρτας-πινέζας.
   */
  const atShoreM = shoreSeaStateM(seaStateM, exposureLevel, seaArrivalExposureLevel, curatedWindOnlyProtection, shoreShadowDamping);
  /**
   * Ο κλειστός όρμος εξαιρείται ΚΑΙ από το ταβάνι της θάλασσας ΚΑΙ από το δάπεδο του ΙΔΑΝΙΚΗ,
   * για τον ίδιο λόγο: το κελί της πρόγνωσης κάθεται ~10 χλμ έξω και δεν βλέπει μέσα σε κόλπο
   * 50 μ. Μία έκφραση, δύο αναγνώστες — αν χαλαρώσει ποτέ, χαλαρώνει σε αμφότερα μαζί.
   */
  const coveExempt = coveHoldsCalmWater(isEnclosedCove, exposureLevel === 'protected', beaufort)
    && !offshoreLiftApplies(exposureLevel, beaufort, offshoreFlatWater);

  return capBlueByForecastUncertainty(
    capToneForSwimVerdict(swimVerdictAvoid, capIdealByShoreSea(capToneBySeaState(
  /**
   * THE QUIET-SEA CLAUSE IS ENFORCED TWICE, ON PURPOSE.
   *
   * `holdsGlassWaterAtFourBeaufort` already refuses to raise the flag over a sea at or above
   * GLASS_AT_FOUR_MAX_SEA_STATE_M. Re-testing it here is not a duplicate check but the
   * structural one: every other geometry input to this ladder is "passed, not derived", so a
   * caller that computed the flag from a different (or stale, or absent) sea number could
   * otherwise print ΙΔΑΝΙΚΗ over 0,6-0,8 m water — the 31 beach-days the national measurement
   * found and this rule exists to exclude. The sea-state ceiling below cannot catch them: it has
   * no opinion at all under 0,8 m. Unknown sea closes the door for the same reason it does in
   * the gate — the one rule in this file that can paint the calmest colour may not fire on
   * missing evidence.
   */
  resolveWindTone(
    exposureLevel,
    beaufort,
    isEnclosedCove,
    offshoreFlatWater,
    glassWaterAtFour
      && typeof atShoreM === 'number' && Number.isFinite(atShoreM)
      && atShoreM < GLASS_AT_FOUR_MAX_SEA_STATE_M,
    windSpeedKmh
  ),
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
  coveExempt,
  exposureLevel,
  downwindSeaSample,
  seaArrivalExposureLevel,
  // curatedWindOnlyProtection ΔΕΝ περνιόταν εδώ ούτε πριν τις 24/08 — προϋπάρχον κενό του
  // ταβανιού (το atShoreM του δαπέδου/πόρτας το παίρνει κανονικά). Καταγράφεται και μένει
  // ρητά ως έχει: δεν επιτρέπεται να αλλάξει συμπεριφορά σιωπηλά μέσα στην αλλαγή του K_d.
  undefined,
  shoreShadowDamping
), atShoreM, coveExempt)),
    forecastUncertain,
  );
};

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

/**
 * Best to worst, red excluded by construction — the list is an offer, and the app does not offer a
 * beach it has just called ΔΥΣΚΟΛΗ. Red is not reachable from here rather than filtered out later,
 * so no future edit can quietly let it in.
 */
const SUITABLE_LIST_TONE_RANK: readonly CalmnessTone[] = ['blue', 'yellow', 'orange'];
/** How many colour groups the list may span. Two: the best one, and the next one down. */
export const SUITABLE_LIST_TONE_GROUPS = 2;

/**
 * ΤΟ ΑΘΡΟΙΣΜΑ ΤΗΣ ΛΙΣΤΑΣ ΕΙΝΑΙ ΤΑ ΔΥΟ ΚΑΛΥΤΕΡΑ ΧΡΩΜΑΤΑ ΠΟΥ ΥΠΑΡΧΟΥΝ (Μίλτος, 10/08/2026).
 *
 * «Στις τοπ 3 και στις υπόλοιπες κατάλληλες το άθροισμά τους να είναι το άθροισμα των ιδανικών και
 * των καλών, δηλαδή μπλε και κίτρινων — και αντίστοιχα σε άλλες συνθήκες το άθροισμα κίτρινων και
 * πορτοκαλί. Μόνο τις δύσκολες θα αφήνεις απέξω.»
 *
 * The old rule was ΙΔΑΝΙΚΕΣ + ΚΑΛΕΣ, with ΜΕΤΡΙΕΣ joining only when that sum fell under three. On a
 * meltemi island with, say, four yellow and forty orange beaches, the reader was shown four and the
 * other forty — every one of them swimmable, and the only realistic choice on the island — sat
 * behind a colour filter nobody opens. The count was a rule about our thresholds, not about what
 * the island had to offer.
 *
 * Now the list spans the TWO best colours that actually have members: blue+yellow where a blue
 * exists, yellow+orange where none does, orange alone on a hard island. What never changes is the
 * bottom: ΔΥΣΚΟΛΗ never joins, structurally.
 *
 * Blocks are sorted internally and concatenated best-colour-first, never merged into one sort. The
 * calmer colour is evidence — it is the same reasoning that put tone above recognition in the
 * podium the same morning — so a ΜΕΤΡΙΑ beach cannot outrank a ΚΑΛΗ one on fame or facilities.
 */
/**
 * WHICH COLOURS THE OFFER SPANS TODAY — the one place that answers it.
 *
 * Split out of `selectSuitableByTone` on 15/08/2026 because the PODIUM needs the same answer and
 * was working without it: its candidate pool concatenates sources that are not colour-restricted
 * (`recommendedSuitableBeaches`, `directoryFallbackSource`, the sheltered fallback), so a ΜΕΤΡΙΑ
 * could take a medal above sixteen ΚΑΛΕΣ while the list beside it, built from this function,
 * showed only blue+yellow. Miltos, 15/08: «έχεις ιδανική μία και από κάτω τοπ 1 άλλη παραλία».
 *
 * The arithmetic he verified by hand on 10/08 — βάθρο + λίστα = τα δύο καλύτερα χρώματα — only
 * holds if BOTH surfaces read this. A second copy of the rule is not the rule: that is the §Κ1
 * lesson of the PORISMA, where a comment claiming «this condition IS the pin, rewritten» had
 * quietly lost half of it.
 */
export const selectSuitableToneGroups = <T,>(
  items: readonly T[],
  toneOf: (item: T) => CalmnessTone | undefined
): CalmnessTone[] => {
  const present = SUITABLE_LIST_TONE_RANK.filter(tone => items.some(item => toneOf(item) === tone));
  return present.slice(0, SUITABLE_LIST_TONE_GROUPS);
};

export const selectSuitableByTone = <T,>(
  items: readonly T[],
  toneOf: (item: T) => CalmnessTone | undefined,
  compare: (a: T, b: T) => number
): T[] => {
  const chosen = selectSuitableToneGroups(items, toneOf);

  return chosen.flatMap(tone => items.filter(item => toneOf(item) === tone).sort(compare));
};

/**
 * Identity: the card/list palette carries every tone the ladder can emit, so nothing is lost on
 * the way from the shared ladder to a chip. Kept as a named conversion (rather than the raw tone)
 * so the two types stay documented as the same set — if they ever diverge again, it breaks here
 * and nowhere else. It is what turned the removal of 'green' into a compiler error list.
 */
export const toWindSuitabilityColor = (tone: CalmnessTone): WindSuitabilityColor => tone;
