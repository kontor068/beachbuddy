/**
 * Wave CHARACTER — the missing axis.
 *
 * Every wave threshold in this app was a bare height in metres. That works for ocean swell,
 * which is what those numbers were calibrated against. It does not work for the Greek gulfs,
 * where almost all the energy is short-period wind chop, because two seas of the SAME
 * significant height are completely different water:
 *
 *              Hs 0.45 m @ 2.5 s          Hs 0.45 m @ 8 s
 *   wavelength        9.8 m                    99.9 m
 *   steepness         0.046                    0.0045
 *   waves per hour    1440                     450
 *
 * The first is steep, continuously breaking, and hits you three times as often. The second is
 * a gentle roll. Reported from Σχινιάς on 2026-07-27: a 0.45 m 2.5 s southerly sea at 2 Bft
 * that the app scored 9/10 and coloured blue.
 *
 * Rather than fork every threshold into a chop pair and a swell pair — which is exactly how
 * the map pin and the verdict word drift apart — this module converts (height, period) into
 * ONE swell-equivalent height. Every existing boundary (0.3 / 0.5 / 0.8 / 1.2 / 1.5 m) keeps
 * its meaning and its number; it just reads the equivalent instead of the raw height.
 *
 * The conversion:
 *
 *   equivalent = Hs · clamp((T_ref / T)^EXP, 1, MAX)
 *
 * T_ref is 4 s, and that choice is the whole design. It is NOT the ground-swell boundary (7 s):
 * referencing against ocean swell would multiply every ordinary Aegean sea by ~1.5 and silently
 * re-tune the entire app, when the existing height thresholds were validated against exactly
 * those ordinary 4–5 s seas over 128 ground-truth cases. 4 s is that norm. At or above it the
 * factor is exactly 1 and nothing in the app moves. Below it the sea is a young, steep, locally
 * forced chop the calibration never saw — and that, precisely, is the regime that was failing.
 *
 * What a swimmer feels sits between the encounter rate (∝ T⁻¹) and the steepness (∝ T⁻²). Note
 * the constants are calibrated against the period Open-Meteo REPORTS (a mean period, not a peak
 * period); they absorb that definition and should not be re-derived from a textbook.
 *
 * ⚠️ THE EXPONENT IS 0.75 — BELOW BOTH OF THOSE, NOT BETWEEN THEM (recorded 15/08/2026).
 *
 * This paragraph used to end «so the exponent is taken between them», which describes a value in
 * 1..2. The constant has read 0.75 since the day it was written (f515386a, 28/07/2026) and has
 * never been changed. One of the two was wrong, and leaving the sentence in place meant the next
 * reader would "fix" the number to match it — a national colour change made on the strength of a
 * comment. So the sentence is gone and what is actually known is written instead:
 *
 *   • 0.75 was never measured against anything. No calibration run, no ground-truth set, no
 *     decision-log entry — it arrived with the module.
 *   • Raising it is SAFE IN DIRECTION but not free. Measured live over 930 beaches in 14 regions
 *     (scripts/measureChopExponent.mjs, 15/08/2026): at 1.5 exactly 48 beaches darken and 8 wake
 *     from total silence, with ZERO going calmer — the factor only ever grows, so a false calm is
 *     structurally impossible here. The risk of this dial is over-warning, never under-warning.
 *     (Corrected 15/08 later the same day: the first write-up of this comment and of PORISMA §Γ13
 *     said 23/42 for 1.5/2.0 — that was half the real reports/quality/chop-exponent.json number.)
 *   • ⛔ 1.0 WAS APPLIED AND REVERTED THE SAME EVENING (16/08/2026). Everything in the bullet
 *     below still holds as the argument FOR 1.0 — what killed it is that the exponent is not an
 *     isolated dial. scripts/buildWaveClimatology.py holds the same constant and bakes it into the
 *     guide climatology; rebuilding at 1.0 changed the published sea tier for 1,008 of 2,782
 *     beaches in at least one month (13,940 of 16,692 monthly values moved, all upward, median
 *     +6 cm). Miltos's condition was "make sure it does not affect a large share" — 36% is a large
 *     share, so it went back. Raising this constant is a CONTENT decision about the guides as much
 *     as a model decision, and it has to be taken as one.
 *   • THE ARGUMENT FOR 1.0, PRESERVED, AND DELIBERATELY NOT 1.5. 1.0 is the encounter
 *     rate on its own — the weakest of the two mechanisms above, and the only one the mean-vs-peak
 *     objection does not touch, because "how often does a wave hit me" is linear in T whichever
 *     period definition the provider means. 1.5 and 2.0 lean on steepness, which is exactly the
 *     textbook re-derivation the paragraph above forbids while we are fed a MEAN period.
 *     Measured cost of the step: 4 of 930 beaches darken (15/08 run, 14 regions, 96% of them
 *     carrying a period). What it buys is that the constant is no longer below every mechanism
 *     anyone can name — the state that made 0.75 impossible to defend to the next reader.
 *   • ✅ THE NATIONAL RE-MEASUREMENT IS DONE (17/08/2026, paid plan, 110/110 regions, 2,824 of
 *     2,872 beaches carrying a period — the degraded 16/08 run that reported "6 of 2866" off 200
 *     periods is superseded and must not be quoted). Live effect on the colour, cap held at 1.75:
 *
 *       exponent   darker   wakes a silent beach   LIGHTER
 *       1.00           17                     12         0
 *       1.25           44                     35         0
 *       1.50           67                     56         0
 *       2.00           87                     64         0
 *
 *     THE COLUMN THAT MATTERS IS THE LAST ONE: **zero at every value**. Raising this constant can
 *     only ever make a shore look rougher — it is structurally one-directional, so trigger #1
 *     ("false calm") cannot be reached from here. 1.5 costs 67 of 2,872 beaches (2.3%) on the day
 *     measured, and wakes 56 that today print nothing at all.
 *   • ⚠️ WHAT STILL BLOCKS IT IS THE GUIDES, NOT THE MODEL. 1.0 was applied and reverted on
 *     16/08 because scripts/buildWaveClimatology.py holds the same constant and moved the
 *     published monthly sea tier for 1,008 of 2,782 beaches. 1.5 would move MORE than 1.0 did,
 *     and that number has NOT been measured. Measure the climatology rebuild before proposing
 *     1.5 again — the live cost is now known and small; the content cost is the open one.
 *   • Still true, and the reason 1.5 stays on the table rather than in the code: there is no judge
 *     for "how unpleasant was the water". PORISMA §Γ4 settled that a measured-but-unvalidated dial
 *     is Miltos's call. The honest way to earn 1.5 is to ask visitors on short-period days, not to
 *     turn the dial again.
 *
 * MAX_CHOP_FACTOR is, meanwhile, close to dead: it binds in 1 of 439 short-period cases, and
 * moving it to 2.25 or 3 changes NOTHING nationally, because at 0.75 the formula only asks for
 * more than 1.75 below about 1.9 s. It is a guard against an exponent we are not using.
 *
 * The half of this module that WAS missing got fixed instead — see `isShortPeriodSea` below.
 */

const GRAVITY = 9.81;
const TWO_PI = Math.PI * 2;

/** The ordinary Aegean wind-sea period the app's height thresholds were calibrated against. */
export const SEA_REFERENCE_PERIOD_S = 4;
/**
 * ⚠️ 0.75 — BELOW both the encounter rate (T^-1) and the steepness (T^-2), not between them.
 * Never measured against anything; see the module header before touching it.
 *
 * 1.0 WAS APPLIED AND REVERTED ON 16/08/2026. Not because it is wrong — it is the better-defended
 * number — but because the step is not what it looks like. The live cost is 4 of 930 beaches. The
 * cost nobody had measured is in scripts/buildWaveClimatology.py, which carries this same constant
 * and bakes it into data/waveClimatology.generated.json: rebuilding at 1.0 moved 13,940 of 16,692
 * monthly values, ALL upward, and changed the published sea tier for 1,008 of 2,782 beaches in at
 * least one month. A third of the country's guide pages would read one step rougher for a median
 * +6 cm. That is a content change, not a dial, and it needs its own decision.
 */
const CHOP_EXPONENT = 0.75;
/** Bounded so wave character adjusts the height, never overwhelms it. */
const MAX_CHOP_FACTOR = 1.75;

/**
 * Sea-state boundaries, in swell-equivalent metres. These are the ONLY pair — the map pin, the
 * card chip, the verdict word and the wave graphic all read them, so they cannot drift apart.
 * The values are unchanged from the height thresholds they replace.
 */
export const SEA_STATE_AMBER_M = 0.8;
export const SEA_STATE_ROUGH_M = 1.2;

/** Deep-water wavelength (m) for a period: L0 = g·T²/(2π). Exported for the UI's "why". */
export const deepWaterWavelengthM = (periodS: number): number => {
  if (!Number.isFinite(periodS) || periodS <= 0) return 0;
  return (GRAVITY * periodS * periodS) / TWO_PI;
};

/** Wave steepness Hs/L0. Exported so copy can describe the sea, not just measure it. */
export const waveSteepness = (heightM: number, periodS: number): number => {
  const l0 = deepWaterWavelengthM(periodS);
  if (l0 <= 0 || !Number.isFinite(heightM) || heightM <= 0) return 0;
  return heightM / l0;
};

/**
 * How much harsher this sea is than a long-period sea of the same height. 1 = no difference.
 *
 * A missing or non-finite period returns 1, so a beach with no period data behaves exactly as
 * it did before. That is deliberate: without the period we cannot tell chop from swell, and
 * inventing an escalation from a number we do not have is how false amber days get shipped.
 */
export const choppinessFactor = (periodS: number | undefined): number => {
  if (typeof periodS !== 'number' || !Number.isFinite(periodS) || periodS <= 0) return 1;
  if (periodS >= SEA_REFERENCE_PERIOD_S) return 1;
  const factor = Math.pow(SEA_REFERENCE_PERIOD_S / periodS, CHOP_EXPONENT);
  return Math.min(MAX_CHOP_FACTOR, Math.max(1, factor));
};

/**
 * The swell-equivalent height (m) every threshold in the app should compare against — i.e.
 * "a long-period sea this tall would feel the same". With no period it is the raw height.
 */
export const seaStateSeverityM = (
  waveHeightM: number | undefined,
  periodS: number | undefined
): number | undefined => {
  if (typeof waveHeightM !== 'number' || !Number.isFinite(waveHeightM)) return undefined;
  return Number((waveHeightM * choppinessFactor(periodS)).toFixed(2));
};

/**
 * True when the sea is short-period enough that its character, not just its height, is what
 * the user needs told. Used only to choose wording — never to escalate a score on its own.
 *
 * ⚠️ THIS HAD ZERO CALLERS FOR 18 DAYS (28/07 → 15/08/2026). The comment above says «used only to
 * choose wording» and no wording anywhere consumed it, so the character axis shipped as half a
 * feature: the NUMBER accounted for steepness, the LANGUAGE never mentioned it. A visitor found
 * the gap before any gate did — «Είχε κύμα», Σκάλα Κεφαλονιάς, 0,68 m at 3,3 s, severity 0,79
 * against a 0,80 threshold. The colour missed by a centimetre and there was no sentence to catch
 * the fall.
 *
 * The wording now exists in utils/choppySeaCopy, which does NOT call this predicate: a bare
 * «period < 4 s» fires on 43,6% of beaches, and a line on 43,6% of pages is a permanent label.
 * It gates on measured steepness plus a height floor plus the tone already on screen (6,9%).
 * This predicate stays as the definition of the regime; `quality:choppy-sea` is what now
 * guarantees SOMETHING consumes the idea.
 */
export const isShortPeriodSea = (periodS: number | undefined): boolean =>
  typeof periodS === 'number' && Number.isFinite(periodS) && periodS > 0 && periodS < 4;

export type SeaToneCeiling = 'yellow' | 'orange' | 'red' | null;

/**
 * The calmest tone a running sea permits, or null when the sea has nothing to say.
 *
 * This lives here, beside the thresholds it reads, rather than inside the map component — the map
 * pin, the card chip and the verdict word have drifted apart before, and they only stay together
 * if there is exactly one place that turns a sea state into a colour. It is a CEILING: callers
 * apply it only when their own wind-derived tone is calmer, so it can never make a pin look better
 * than the wind already said, and never pull back an escalation the wind already made.
 *
 * ROUGH SEA IS RED, SINCE 01/08/2026. It used to stop at 'orange', which meant the sea could
 * NEVER make a beach red — not at 2 m, not at 5 m. Red was, in practice, a wind-only colour.
 * That produced the contradiction the user finally pinned down: Βραυρώνα 1,9 m ORANGE beside
 * Πλαζ Ραφήνας 1,3 m RED, i.e. the bigger sea reading as the better beach.
 *
 * The threshold is not a new number. `swimmingComfortFromScore`
 * (services/recommendationService.ts) has always returned `avoid_swimming` above
 * SEA_STATE_ROUGH_M regardless of wind — so the app was simultaneously telling people "better
 * not to swim" and painting the beach amber, which reads as "fine, go". Miltos settled what the
 * colour is FOR on 01/08: it answers «πού να πάω για μπάνιο σήμερα». A beach we refuse to let
 * people swim at cannot be anything but red.
 *
 * Measured before the change, over the national geometry with the live 01/08 seas at 5 Bft:
 * 421 of 2.553 beaches (16,5%) move to red, across 37 of 110 regions — on a meltemi day, which
 * is close to the worst case. The other 83,5% are unaffected.
 */
export const seaStateToneCeiling = (seaStateM: number | undefined): SeaToneCeiling => {
  if (typeof seaStateM !== 'number' || !Number.isFinite(seaStateM)) return null;
  if (seaStateM >= SEA_STATE_ROUGH_M) return 'red';
  if (seaStateM >= SEA_STATE_AMBER_M) return 'yellow';
  return null;
};

/**
 * THE SEA THAT REACHES THE SHORE, not the sea ten kilometres out.
 *
 * Measured 01/08/2026 over the committed geometry: the marine sample point each beach asks about
 * sits a MEDIAN OF 10 km offshore (2.427 of 2.555 beaches beyond 5 km, max 10 km — the pushed-out
 * point exists so an inland cell never answers for a coast). So `measuredWaveHeightM` is, by
 * construction, an open-water height. utils/waveModel damps our OWN fetch model toward the shore
 * by exposure (protected ×0.5, partial ×0.75) for exactly this reason — but that damping is
 * applied before a `max()` against the undamped grid reading, so on any day with a real sea the
 * grid wins and the damping never reaches the screen.
 *
 * The consequence was the whole point of this app quietly switching off: above SEA_STATE_ROUGH_M
 * the colour ceiling is absolute, so a deeply sheltered cove and an open west-facing coast got the
 * same red pin from the same offshore number. The geometry — the one thing no competitor has —
 * stopped mattering on precisely the days it matters most. And we had already admitted the number
 * was not theirs: 501 beaches (19,6%) carry the «Κύμα ανοιχτά» label saying so, while that same
 * number coloured their pin.
 *
 * The 0.5 factor is NOT new physics invented here. It is the identical damping utils/waveModel
 * already applies to the fetch model, now also applied to the grid reading so both legs describe
 * the same water.
 *
 * ⚠️ ONLY 'protected' GETS THE DISCOUNT. 'partial' DOES NOT — and that asymmetry is the whole
 * design, not an oversight to be tidied up later.
 *
 * The first version of this shipped `partial: 0.75`, mirroring waveModel. That quietly introduced
 * a THREE-way distinction into a ladder that had only ever been two-way: resolveWindTone
 * (utils/suitabilityTone) tests `isExposed` and nothing else, so 'protected' and 'partial' have
 * always produced identical colours at every Beaufort. The 0.75 made them differ — and it did so
 * on exactly the distinction we cannot support:
 *
 *   • scripts/validateWindExposureGroundTruth.mjs holds 128 hand-authored cases. 120 of them are
 *     BINARY claims ("not protected" / "not exposed"). ZERO of the 128 assert 'partial'.
 *   • Recall over open onshore sectors (n=2.787): exposed 100%, partial 0%, protected 0%.
 *   • All 4 exact 'protected' labels that fail do so because the engine answers 'partial' — among
 *     them Πλάκα and Άγιος Προκόπιος on Naxos, i.e. it under-calls known shelters.
 *   • 'partial' is the code's terminal fallback (utils/mapExposure.ts) and the structural ceiling
 *     for the ~91-95% of beaches with no authored profile (utils/windExposureEngine.ts).
 *   • It has no physical boundary: of 4.725 partial sectors, 1.818 have under 2 km of fetch
 *     (physically ≈ protected) and 95 have 15 km or more (physically ≈ exposed).
 *   • `confidence` reads 'high' on 2.850/2.850 profiles, so it distinguishes nothing.
 *
 * "Partial" is, in practice, "we do not know". Discounting a wave on the strength of not knowing
 * is exactly the false calm the house rule forbids. So the discount is reserved for shores that
 * earned it: 'protected' here has already passed the map's strict isStableProtectedSector gate,
 * which demotes 459 sectors (3,9%) to partial before this function ever sees them.
 *
 * ⚠️ THAT SENTENCE STOPPED BEING TRUE ON 17/08/2026 AND WAS REPAIRED ON 20/08. The curated-cove
 * bypass (windExposureEngine.geometryEnclosedProtectionSource) hands 29 sectors in 24 beaches a
 * 'protected' level WITHOUT the strict gate — their intensity is 33,0-59,6, so the map paints
 * them 'partial' (28) or 'exposed' (1). For fifteen days those sectors collected a 50% discount
 * on a test they never sat. Measured: 145/145 combinations across 3-7 Bft diverged, the colour
 * differed in 45/126 cells by up to two rungs, and the gap opened at ≥1,2 m of open sea (card
 * orange / pin red). Nationally at 5 Bft those 29 were 60,4% of every "card milder than pin".
 * `curatedWindOnlyProtection` is how the caller says "this shelter was earned against the WIND
 * only"; when true the discount is refused. One-directional: it can only ever REFUSE.
 *
 * ⚠️ Callers must treat this as an input to a DECISION (colour, swim advice), never as the number
 * to print. The displayed height stays the honest open-water reading with its own label; changing
 * what we print is a separate decision that has not been taken.
 */
export const SHORE_DAMPING_BY_EXPOSURE = { protected: 0.5, partial: 1, exposed: 1 } as const;

/**
 * ⚠️ THE DISCOUNT IS EARNED AGAINST THE WAVE, NOT AGAINST THE WIND (13/08/2026).
 *
 * `exposureLevel` answers "is this shore sheltered from the wind blowing right now". For most of
 * the year that is a fair stand-in for "is it sheltered from the sea", because the sea IS the
 * wind's. It stops being one the moment the two point different ways — and the commonest way for
 * that to happen is the most ordinary summer morning there is, an offshore land breeze over a
 * shore with a swell still running onto it.
 *
 * Καβαλικευτά, Λευκάδα, 13/08/2026, reported by a user standing on the beach: NE wind straight off
 * the land, so every wind test called the beach protected and this function halved its sea — while
 * the water was arriving from 306–320° into a shore facing 284,8°, through W/NW sectors carrying
 * 25 km of fetch and zero blocked rays. The discount was paid for shelter the beach did not have
 * against the wave it actually had.
 *
 * So the ×0,5 now needs BOTH: sheltered from today's wind AND sheltered from where the sea is
 * coming in. `seaArrivalExposureLevel` (utils/seaArrival.resolveSeaArrivalExposureLevel) answers
 * the second, and `undefined` — no geometry, no wave direction, or a sea not running onshore —
 * means "no opinion", which leaves this function exactly as it behaved before. It can only ever
 * REFUSE a discount, never grant one, so no beach can come out of this change looking calmer.
 */
export const shoreSeaStateM = (
  openWaterSeaStateM: number | undefined,
  exposureLevel: string | undefined,
  seaArrivalExposureLevel?: string | undefined,
  /**
   * true when the 'protected' level came from the curated cove bypass rather than the strict
   * geometric gate — the shelter is documented against the WIND, nobody inspected the WAVE, and
   * the pin on the map does not agree. Omitted (undefined) keeps the pre-20/08 behaviour, so no
   * caller can be made calmer by forgetting it.
   */
  curatedWindOnlyProtection?: boolean
): number | undefined => {
  if (typeof openWaterSeaStateM !== 'number' || !Number.isFinite(openWaterSeaStateM)) return undefined;
  // Only 'protected' has ever carried a discount (see the block above), so the arrival test only
  // has to defend that one rung: an arrival sector we have judged and NOT called protected takes
  // the shore back to full height.
  const shelteredFromTheSea = seaArrivalExposureLevel === undefined || seaArrivalExposureLevel === 'protected';
  // Wind-only shelter buys nothing here: the discount is against the WAVE (see the block above).
  const shelterEarnedAgainstTheWave = !curatedWindOnlyProtection;
  const damping = exposureLevel === 'protected' && shelteredFromTheSea && shelterEarnedAgainstTheWave
    ? SHORE_DAMPING_BY_EXPOSURE.protected
    : exposureLevel === 'partial'
      ? SHORE_DAMPING_BY_EXPOSURE.partial
      : SHORE_DAMPING_BY_EXPOSURE.exposed;
  return Number((openWaterSeaStateM * damping).toFixed(2));
};
