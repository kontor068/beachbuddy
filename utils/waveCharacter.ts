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

/**
 * ΚΑΜΙΑ ΔΙΑΦΟΡΑ ΧΡΩΜΑΤΟΣ ΑΠΟ ΔΙΑΦΟΡΑ ΠΟΥ Η ΟΘΟΝΗ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΙΞΕΙ (Μίλτος, 24/08/2026).
 *
 * ΑΦΟΡΜΗ. Τσερδάκια #2053 και Χρυσή Ακτή #2056, 1,1 χλμ απόσταση, ίδιο κελί ανέμου, ίδια έκθεση,
 * ίδια ώρα: **3 Μποφόρ και «~0,1 μ.» και οι δύο** — η μία κίτρινη, η άλλη μπλε. Ολόκληρη η
 * διαφορά ήταν 0,80 έναντι 0,78 μ. ανοιχτής θάλασσας, δηλαδή **δύο εκατοστά** σε αριθμό που η
 * κάρτα δεν τυπώνει καν (τα δύο σημεία δειγματοληψίας απέχουν ~5 χλμ μεταξύ τους, 8,1 και 10 χλμ
 * ανοιχτά). Το `SEA_STATE_AMBER_M` είναι ακριβώς 0,80: το ένα πάτησε πάνω του, το άλλο όχι.
 *
 * Ο ΑΡΙΘΜΟΣ ΤΥΠΩΝΕΤΑΙ ΜΕ ΕΝΑ ΔΕΚΑΔΙΚΟ (`utils/beachConditionsReadout` → `toFixed(1)`), άρα το
 * μικρότερο πράγμα που ο επισκέπτης μπορεί να ΔΕΙ είναι 10 εκατοστά. Το να κρίνεται το χρώμα σε
 * δύο δεκαδικά ενώ φαίνεται ένα σημαίνει ότι δύο κάρτες με ολόιδια νούμερα φοράνε νόμιμα
 * διαφορετικό χρώμα — μετρημένο εθνικότερα την ίδια μέρα, 308 από 8.526 ζεύγη γειτόνων ≤8 χλμ
 * (3,6%). Εδώ η κρίση κατεβαίνει στην ακρίβεια που δείχνουμε.
 *
 * ⚠️ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΟΣ ΠΡΟΣ ΤΗΝ ΠΡΟΣΟΧΗ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΑΠΟΔΕΙΞΗ, ΟΧΙ ΕΛΠΙΔΑ. Και τα τρία
 * κατώφλια σοβαρότητας είναι ακέραια πολλαπλάσια του βήματος (0,40 · 0,80 · 1,20 = 4/8/12 × 0,1),
 * και κάθε σύγκριση είναι `>=`. Για κατώφλι t πολλαπλάσιο του 0,1 ισχύει `x >= t ⟹ round(x,1) >= t`
 * — η στρογγυλοποίηση δεν μπορεί ΠΟΤΕ να ρίξει κάτω από το κατώφλι κάτι που ήταν πάνω. Μπορεί
 * μόνο να ανεβάσει τη ζώνη [t−0,05, t) μέσα στο κατώφλι, δηλαδή να κάνει το χρώμα ΑΥΣΤΗΡΟΤΕΡΟ.
 * Μετρημένο ξεχωριστά πριν μπει: 27 στις 3.984 παραλιο-ώρες αλλάζουν (0,7%), **καμία προς το
 * ηρεμότερο**. Άρα δεν αγγίζει τη σκανδάλη #1 (ψευδής ηρεμία) — κινείται μόνο αντίθετά της.
 * Αν κάποιος προσθέσει ποτέ κατώφλι που ΔΕΝ είναι πολλαπλάσιο του 0,1, η ιδιότητα σπάει σιωπηλά:
 * γι' αυτό την καρφώνει η πύλη `scripts/validateDisplayedPrecisionGate.mjs`.
 *
 * ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ `seaStateSeverityM`, ΕΠΙΤΗΔΕΣ. Εκείνο είναι ΜΕΓΕΘΟΣ και το διαβάζουν και
 * καταστάσεις που δεν είναι κατώφλια — η κατάταξη του βάθρου (`utils/topPickScoreTable`) και το
 * ύψος που ζωγραφίζει το γράφημα (`components/WaveHeightGraphic`). Στρογγυλοποιημένο εκεί θα
 * ισοπέδωνε σειρά κατάταξης και θα έκανε το γράφημα σκαλωτό. Στρογγυλοποιεί η ΚΡΙΣΗ, όχι η
 * μέτρηση.
 */
export const DISPLAYED_WAVE_STEP_M = 0.1;

export const atDisplayedPrecisionM = (metres: number | undefined): number | undefined => (
  typeof metres === 'number' && Number.isFinite(metres)
    ? Number((Math.round(metres / DISPLAYED_WAVE_STEP_M) * DISPLAYED_WAVE_STEP_M).toFixed(1))
    : metres
);

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
  // Κρίνεται στην ακρίβεια που τυπώνεται — δες atDisplayedPrecisionM για το γιατί και για την
  // απόδειξη ότι μπορεί μόνο να αυστηροποιήσει. Ο ΙΔΙΟΣ κανόνας τρέχει στη λέξη της ετυμηγορίας
  // (utils/seaVerdict.getSeaStateSeverity) και στο δάπεδο ΙΔΑΝΙΚΗ: αν έμπαινε μόνο εδώ, το χρώμα
  // θα γινόταν αυστηρότερο από τη λέξη δίπλα του και θα ξαναγεννιόταν η αντίφαση που το
  // utils/seaVerdict υπάρχει για να κλείσει.
  const judged = atDisplayedPrecisionM(seaStateM) as number;
  if (judged >= SEA_STATE_ROUGH_M) return 'red';
  if (judged >= SEA_STATE_AMBER_M) return 'yellow';
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
 * ⚠️ THE SECOND HALF OF THIS PARAGRAPH WAS TRUE UNTIL 13/08/2026 AND IS NOW FALSE. It used to end
 * «never as the number to print … changing what we print is a separate decision that has not been
 * taken». That decision WAS taken (βίβλος §Γ5): `shoreDisplayWaveM` is this value, and
 * utils/beachConditionsReadout prints it on the card, the map and the beach page under the label
 * «στην ακτή». Anyone reading the old sentence would conclude that a discount here is invisible
 * to visitors. It is not — it is the number on screen.
 *
 * ⚠️ AND THE DISCOUNT IS NOT SMALL WHEN IT MATTERS. §Γ5 measured it nationally as «0,18 μ.
 * διάμεσα» — but on a calm day, when there is no sea to halve. Replayed on a meltemi day
 * (2022-09-06, βίβλος §Γ47) the same discount moves the printed figure by **1,40 m**, and pushes
 * beaches across the «ήρεμα» line while their pin stays orange. The 0,5 itself has never been
 * measured against anything: there is no external judge for a shoreline (§7δ).
 */
/**
 * «Η θάλασσα περνάει ξυστά ή φεύγει» — τρίτη τιμή στο ΙΔΙΟ πεδίο `seaArrivalExposureLevel`,
 * δίπλα στο `utils/seaArrival.SEA_ARRIVAL_UNKNOWN` και για τον ίδιο ακριβώς λόγο: ταξιδεύει
 * μόνη της σε κάθε επιφάνεια που διαβάζει την άφιξη της θάλασσας (η κάρτα, η πινέζα, ο τόνος,
 * το φίλτρο «Ήρεμο νερό»), οπότε καμία δεν μπορεί να απαντήσει διαφορετικά από τις άλλες. Ένα
 * πέμπτο όρισμα εδώ θα έπρεπε να περαστεί χειροκίνητα σε πέντε σημεία κλήσης — και το ένα που
 * θα ξεχνιόταν θα ήταν ακριβώς η επόμενη διαφωνία κάρτας-πινέζας.
 *
 * Ζει σε ΑΥΤΟ το αρχείο, όχι στο `utils/seaArrival`, επειδή αυτό εδώ δεν κάνει κανένα import:
 * το `seaArrival` σέρνει μαζί του το γεωμετρικό μοντέλο, και μια λέξη-σταθερά δεν επιτρέπεται
 * να κάνει βαρύ το φύλλο που τη διαβάζει.
 *
 * ΠΡΙΝ ΤΙΣ 22/08/2026 Η ΠΕΡΙΠΤΩΣΗ ΑΥΤΗ ΕΡΧΟΤΑΝ ΩΣ `undefined`. Κάθε έλεγχος
 * `=== undefined || === 'protected'` πρέπει να δέχεται ΚΑΙ αυτή την τιμή, αλλιώς η αλλαγή
 * γίνεται σιωπηλά αυστηρότερη κάπου που κανείς δεν κοίταξε. Υπάρχουν ακριβώς δύο τέτοιοι
 * έλεγχοι: η `shoreSeaStateM` από κάτω και η `utils/shoreBreak.shoreBreaksOnTheBeach`.
 */
export const SEA_ARRIVAL_GRAZING = 'grazing';

/**
 * «Η θάλασσα δεν έχει από πού να μπει» — τέταρτη τιμή στο ίδιο πεδίο, ίδιο σκεπτικό ταξιδιού
 * με το SEA_ARRIVAL_GRAZING από πάνω (μία τιμή στο score, πέντε αναγνώστες, καμία διαφωνία).
 *
 * ΤΙ ΣΗΜΑΙΝΕΙ, ΑΥΣΤΗΡΑ: η παραλία είναι ΤΣΕΠΗ (κανένας τομέας της δεν ανοίγει ≥10 χλμ νερού,
 * πουθενά) ΚΑΙ στη γωνία απ' όπου το πλέγμα λέει ότι έρχεται το κύμα υπάρχει λιγότερο από
 * 2 χλμ νερό — δηλαδή η θάλασσα του κελιού, μετρημένη χιλιόμετρα ανοιχτά, δεν έχει διάδρομο
 * να φτάσει σε αυτή την άμμο. Το ποιος τη βγάζει και με ποιες ακριβώς συνθήκες ζει στο
 * utils/seaArrival.resolveSeaArrivalExposureLevel — εδώ μόνο η λέξη, για τον λόγο του
 * σχολίου πιο πάνω (αυτό το αρχείο δεν κάνει imports).
 *
 * Η ΑΦΟΡΜΗ (29/08/2026, τέσσερις αναφορές webcam σε μία ώρα): Λίνδος #2443, μελτέμι, κελί
 * 1,1 μ. — μεγαλύτερο άνοιγμα του όρμου 5,3 χλμ, στη γωνία του κύματος 0,2 χλμ. Η κάμερα
 * έδειχνε λάδι με λουόμενους· η εφαρμογή τύπωνε «1,1 μ. · Αρκετό κύμα» και ετυμηγορία «μην
 * κολυμπήσεις», επειδή η έκπτωση σκιάς που η ίδια είχε υπολογίσει (K_d 0,1) ίσχυε ΜΟΝΟ όταν
 * ο τομέας του ανέμου έβγαινε 'protected' — και ο βοριάς στη Λίνδο βγάζει 'partial'. Εθνικά,
 * 171 τσέπες τύπωναν έτσι ολόκληρο το πέλαγος (scripts/measureShoreShadowGate.mjs).
 */
export const SEA_ARRIVAL_ENCLOSED = 'enclosed';

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
  curatedWindOnlyProtection?: boolean,
  /**
   * Η ΓΩΝΙΑΚΗ ΕΚΠΤΩΣΗ ΣΚΙΑΣ — K_d από την utils/seaArrival.resolveShoreShadowDamping
   * (24/08/2026, απόφαση Μίλτου· εκεί όλη η ιστορία, οι μετρήσεις και τα όρια). Αντικαθιστά
   * το επίπεδο 0,5 ΜΟΝΟ στο σκέλος της προστατευμένης· το grazing σκέλος του §Γ59 κρατά το
   * 0,5 του (μετρημένη μαρτυρία καμερών > μοντέλο). Παραλείπεται/undefined = το ιστορικό 0,5,
   * ώστε κανένας παλιός καλών να μην αλλάξει συμπεριφορά χωρίς να το δηλώσει. ΠΑΝΤΑ περνιέται,
   * ποτέ δεν υπολογίζεται εδώ — αυτό το αρχείο μένει χωρίς imports, και πινέζα/κάρτα/ετυμηγορία
   * πρέπει να παίρνουν το ΙΔΙΟ K_d από το score (η πύλη validateShoreShadowContract το φυλάει).
   */
  shadowDamping?: number
): number | undefined => {
  if (typeof openWaterSeaStateM !== 'number' || !Number.isFinite(openWaterSeaStateM)) return undefined;
  // Only 'protected' has ever carried a discount (see the block above), so the arrival test only
  // has to defend that one rung: an arrival sector we have judged and NOT called protected takes
  // the shore back to full height.
  //
  // `undefined` here means «I have an opinion and it is: the sea is not running onto this shore»
  // — 3.372 of 3.396 silences nationally, and the discount it grants is earned. Blindness (no
  // wave direction, no shore facing) says so with utils/seaArrival.SEA_ARRIVAL_UNKNOWN = 'unknown',
  // which deliberately matches NEITHER arm below, so it falls through to full height. Do not
  // "tidy" this into a truthiness check: that would hand the discount back to the blind case.
  const seaGrazesOrDeparts = seaArrivalExposureLevel === SEA_ARRIVAL_GRAZING;
  const shelteredFromTheSea = seaArrivalExposureLevel === undefined
    || seaArrivalExposureLevel === 'protected'
    // Ήταν `undefined` μέχρι τις 22/08/2026 και έπαιρνε την έκπτωση από εκεί. Γράφεται ρητά
    // ώστε η νέα τιμή να μη γίνει σιωπηλή αυστηροποίηση για τις 'protected'.
    || seaGrazesOrDeparts;
  // Wind-only shelter buys nothing here: the discount is against the WAVE (see the block above).
  const shelterEarnedAgainstTheWave = !curatedWindOnlyProtection;
  /**
   * §Γ59 — Η ΘΑΛΑΣΣΑ ΠΟΥ ΠΕΡΝΑΕΙ ΞΥΣΤΑ ΠΑΙΡΝΕΙ ΤΗΝ ΕΚΠΤΩΣΗ ΠΟΥ ΗΔΗ ΔΙΚΑΙΟΥΤΑΝ (22/08/2026).
   *
   * Η ΑΝΑΦΟΡΑ: Καραβοστάσι Ρεθύμνου #680 και Λυγαριά Ηρακλείου #636, από ζωντανή κάμερα, με το
   * νερό να έρχεται 90-95° από την κάθετο της ακτής — δηλαδή να περνάει παράλληλα. Η εφαρμογή
   * ΤΟ ΗΞΕΡΕ ήδη (`resolveSeaArrivalExposureLevel` απαντούσε «δεν έρχεται») και χρησιμοποιούσε
   * τη γνώση **μόνο για να αρνηθεί** την έκπτωση σε μια 'protected' ακτή — ποτέ για να τη δώσει.
   * Έτσι μια 'partial' ακτή τύπωνε ολόκληρο το νούμερο ενός κελιού 10 χλμ ανοιχτά, για κύμα που
   * δεν πέφτει πάνω της.
   *
   * ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΟ ΑΠΟ ΤΗ ΣΙΩΠΗ, ΕΠΙΤΗΔΕΣ. Η σιωπή (`undefined`) σημαίνει ως 72,5°
   * λοξά· εδώ ζητάμε ≥90° (`utils/seaArrival.SEA_GRAZING_ONSHORE_MAX`). Το «να αρνηθώ έκπτωση»
   * και το «να δώσω έκπτωση» δεν επιτρέπεται να έχουν το ίδιο κατώφλι.
   *
   * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΓΡΑΦΤΕΙ (`scripts/measureGrazingSeaImpact.mjs`, 40.180 βαθμολογήσεις
   * ζωντανά 22/08): αγγίζει 1.617 ώρες σε 375 παραλίες, διάμεση πτώση 0,17 μ., και **καμία**
   * σβησμένη προειδοποίηση «μην κολυμπήσεις». Το φαρδύ παράθυρο (72,5° λοξά + εκτεθειμένες)
   * ΑΠΟΡΡΙΦΘΗΚΕ: έσβηνε 526 τέτοιες προειδοποιήσεις.
   *
   * ΤΟ ΦΡΕΝΟ ΔΕΝ ΕΙΝΑΙ ΕΔΩ. Αυτή η συνάρτηση δίνει έναν αριθμό, δεν βγάζει ετυμηγορία· η
   * εγγύηση «ποτέ να μη σβήσει ένα μην-κολυμπήσεις» επιβάλλεται στο
   * `services/recommendationService` (αναζήτησε `grazingSeaReliefApplied`), όπου υπάρχει η
   * ετυμηγορία και για τους δύο αριθμούς. Η μέτρηση έδειξε 0 τέτοιες περιπτώσεις σε ήρεμη
   * μέρα — αλλά η ίδια έκπτωση σε μελτέμι κουνάει το τυπωμένο νούμερο ως και 1,40 μ. (§Γ47),
   * οπότε το φρένο είναι ασφάλεια, όχι διακοσμητικό.
   */
  const grazingSeaRelief = exposureLevel === 'partial' && seaGrazesOrDeparts && shelterEarnedAgainstTheWave;
  // Το K_d φοράει ζώνη [0,1]: πάνω από 1 θα έκανε την ακτή πιο άγρια από το πέλαγος έξω
  // (αδύνατο για περίθλαση), κάτω από 0 δεν σημαίνει τίποτα. Η πηγή εγγυάται [0,1..1]· η ζώνη
  // κάνει την ιδιότητα αναλλοίωτη της συνάρτησης, όχι συνέπεια της πηγής.
  const protectedDamping = typeof shadowDamping === 'number' && Number.isFinite(shadowDamping)
    ? Math.min(1, Math.max(0, shadowDamping))
    : SHORE_DAMPING_BY_EXPOSURE.protected;
  /**
   * Η ΤΣΕΠΗ ΠΑΙΡΝΕΙ ΤΗΝ ΕΚΠΤΩΣΗ ΠΟΥ Ο ΚΩΔΙΚΑΣ ΕΙΧΕ ΗΔΗ ΥΠΟΛΟΓΙΣΕΙ (29/08/2026 — Λίνδος #2443).
   *
   * Το 'enclosed' λέει «η θάλασσα δεν έχει από πού να μπει» — πλήρης γεωμετρία, όχι εικασία
   * γωνίας (ορισμός και αφορμή στη σταθερά SEA_ARRIVAL_ENCLOSED πιο πάνω). Γι' αυτό περνάει
   * ΜΠΡΟΣΤΑ και από τα δύο εμπόδια που κρατούσαν τη Λίνδο στο πέλαγος:
   *   • το `exposureLevel` — αυτό απαντά «είσαι απάνεμη από τον ΣΗΜΕΡΙΝΟ άνεμο;», ενώ την
   *     τσέπη τη σκεπάζει η στεριά της, με όποιον άνεμο·
   *   • το `curatedWindOnlyProtection` — εκείνο αρνείται έκπτωση που κερδήθηκε μόνο απέναντι
   *     στον άνεμο, ενώ εδώ η προστασία μετρήθηκε απέναντι στο ΚΥΜΑ (στη γωνία ΤΟΥ ζητήθηκε
   *     το νερό και δεν βρέθηκε).
   * Το K_d της τσέπης είναι το ήδη φραγμένο protectedDamping — για γνήσια τσέπη η πηγή δίνει
   * το δάπεδο 0,1 (κλειστός κύκλος στεριάς). Το grazing σκέλος του §Γ59 δεν αγγίζεται: αν μια
   * τιμή είναι 'enclosed' δεν είναι 'grazing', και αντίστροφα.
   */
  const seaEnclosed = seaArrivalExposureLevel === SEA_ARRIVAL_ENCLOSED;
  const damping = seaEnclosed
    ? protectedDamping
    : exposureLevel === 'protected' && shelteredFromTheSea && shelterEarnedAgainstTheWave
    ? protectedDamping
    : grazingSeaRelief
      ? SHORE_DAMPING_BY_EXPOSURE.protected
      : exposureLevel === 'partial'
        ? SHORE_DAMPING_BY_EXPOSURE.partial
        : SHORE_DAMPING_BY_EXPOSURE.exposed;
  return Number((openWaterSeaStateM * damping).toFixed(2));
};
