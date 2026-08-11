import type { Beach, SuitableBeach } from '../types';
import { seaStateSeverityM } from './waveCharacter';

/**
 * Ο ΠΙΝΑΚΑΣ ΤΩΝ 100 — one weighted score per beach, and the Top 3 is its first three rows.
 *
 * Μίλτος, 10/08/2026: «το θέμα είναι να βγει ένα συνολικό σκορ από κάθε παράμετρο που κοιτάς,
 * οπότε φτιάξε έναν πίνακα με την αντίστοιχη βαρύτητα στα 100.»
 *
 * WHAT THIS REPLACES. The podium used to be a lexicographic ladder: exposure → colour → own-shore
 * wind → sea → comfort, stopping at the first rung that separated two beaches. It ranked correctly
 * but it could not be explained — a reader saw a beach scoring 76 placed second and there was no
 * number anywhere that agreed with the order. The ladder also made every rung below the deciding
 * one worthless, so a beach that was marginally better on shelter won regardless of being worse on
 * everything else combined.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ΤΙ ΚΟΙΤΑΜΕ                          ΒΑΡΥΤΗΤΑ      πηγή
 * ───────────────────────────────────────────────────────────────────────────
 *  Προστασία από τον άνεμο                 25        exposureLevel + geometry
 *  Νερό στην ακτή                          25        seaStateWaveM / shoreWaveHeightM
 *  Άνεμος στη δική της ακτή                20        per-beach cluster Beaufort
 *                                        ─────
 *                          ο καιρός        70
 *
 *  Απόσταση από τον χρήστη                 10        ΚΛΕΙΣΤΗ στο podium περιοχής (βλ. πιο κάτω)
 *  Παροχές                                  9        amenities
 *  Πρόσβαση                                 6        metadata.access.type
 *  Πολυσύχναστη                             5        Google review count
 *                                        ─────
 *                        τα ανθρώπινα      30
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 70/30 is Miltos's call, settled 11/08 after a day at 80/20. At this split a beach with umbrellas,
 * a canteen and asphalt fifteen minutes away can outrank a slightly calmer wild one — but only when
 * the weather gap is small: an exposed shore gives up 25 points that 30 points of everything else
 * can only repay if it is winning on all four of them at once. That is the intended behaviour and
 * the reason the blocks are not 50/50.
 *
 * ─── THE DISTANCE AXIS WAS OPENED ON 11/08 AND CLOSED THE SAME DAY ─────────
 *
 * On 10/08 ranking by score was rejected for one specific reason: the old BeachScore changes shape
 * when the visitor shares a location, so two people looking at the same weather saw different
 * podiums. Distance put that back — knowingly, at Miltos's instruction («σε σχέση με τον χρήστη
 * είναι σημαντική»), because «πού να πάω τώρα» genuinely depends on where you are standing.
 *
 * Then the wiring was read instead of assumed, and it said the axis had never actually run: the
 * pool the region podium is built from is fetched with no location at all, so `item.distance` was
 * undefined on every region page from the hour the axis shipped. The one path that did feed it —
 * an active preference filter, which swaps in the location-scored pool — bought nothing except the
 * defect of 10/08 in a new costume: the cards reordering under the visitor a second after the
 * location prompt was answered.
 *
 * Miltos's call, 11/08: ίδιος καιρός, ίδιο podium για όλους. The axis is therefore CLOSED at the
 * caller — services/topPickRanking passes `distanceKm: undefined` unconditionally and says why —
 * and «Απόσταση από εσένα» no longer appears in the on-screen weights box, because a criterion
 * that cannot move a card must not be advertised as one. Distance survives where it was always
 * honest: «Κοντά μου» sorts on it explicitly, after the colour, on a screen the visitor asked for.
 *
 * The weight stays defined at 10 rather than being deleted so that the day it is wired for «Κοντά
 * μου» there is one place to change and one gate already guarding it — and because deleting it
 * would drop the declared split to 70/20 and re-open the weighting Miltos settled the night
 * before. What it costs meanwhile is stated where it is spent (topPickRanking): every beach takes
 * the same middle value, so the axes that can separate beaches are 70 weather / 20 comfort.
 *
 * The rule below still holds for that future: never give the missing case the maximum: a region
 * where only some beaches carry a distance would then rank the unmeasured ones first.
 *
 * ─── WHY EVERY AXIS IS BUCKETED, NOT CONTINUOUS ────────────────────────────
 *
 * The single most dangerous thing about turning a ladder into a sum is that a sum reorders on any
 * difference at all, including differences our instruments cannot see. The wave model's worst
 * per-buoy RMSE is 0,25 m (reports/wave-model/buoy-comparison.json) and 21,8% of beaches share a
 * marine cell — so a podium that reorders on 0,04 m of modelled wave is publishing noise with a
 * confident face. Every axis here therefore scores in STEPS no finer than the evidence:
 *
 *   · sea in 0,25 m steps — exactly PODIUM_SEA_MEANINGFUL_DIFFERENCE_M, so two beaches inside the
 *     model's own error bar score identically and cannot swap places
 *   · wind in whole Beaufort — the forecast's own resolution
 *   · shelter, access, crowd in named tiers
 *
 * This is what keeps validatePodiumSeaOrder's «noise does not reorder» assertion true after the
 * rewrite. Do not make any of these smooth to «break more ties»: a tie here means we genuinely
 * cannot tell, and the tie-break that follows (variety, then id) is honest about that.
 *
 * ─── MISSING DATA IS NEUTRAL, NEVER ZERO ───────────────────────────────────
 *
 * A beach with no wave reading must not be ranked as though it had the worst wave. Each axis
 * returns its MIDDLE value when its input is absent, so a gap moves a beach towards the crowd
 * rather than to the bottom. 1.410 of 2.850 beaches read a shared marine cell and 916 have no
 * Google identity at all — punishing absence would systematically bury exactly the quiet, remote
 * coastline this site exists to surface.
 */

/** The weights, in one place, summing to 100. */
export const TOP_PICK_WEIGHTS = {
  shelter: 25,
  sea: 25,
  ownWind: 20,
  distance: 10,
  amenities: 9,
  access: 6,
  crowd: 5,
} as const;

export const TOP_PICK_SCORE_MAX = 100;

/**
 * Sea is scored in steps of exactly this, so a gap the model cannot resolve scores identically.
 * Mirrors PODIUM_SEA_MEANINGFUL_DIFFERENCE_M; kept as its own constant so this table can be read
 * on its own, and asserted equal to it by validateTopPickScoreTable.mjs.
 */
export const SEA_STEP_M = 0.25;

export type TopPickAxisKey = keyof typeof TOP_PICK_WEIGHTS;

export interface TopPickAxisResult {
  key: TopPickAxisKey;
  /** Points awarded on this axis. Never negative — every axis rewards, none punishes. */
  points: number;
  /** The most this axis could have given (0 for the penalty axis). */
  max: number;
  /** True when the input was missing and the neutral middle was used instead. */
  assumed: boolean;
}

export interface TopPickScoreBreakdown {
  total: number;
  axes: TopPickAxisResult[];
}

const axis = (key: TopPickAxisKey, points: number, max: number, assumed = false): TopPickAxisResult => ({
  key, points, max, assumed,
});

/**
 * ΠΡΟΣΤΑΣΙΑ ΑΠΟ ΤΟΝ ΑΝΕΜΟ — 30.
 *
 * `feelsWind` is passed in rather than recomputed: a beach whose own shore is calm while the pool
 * is windy is scored as if it had the pool's best shelter, because it is neither earning nor
 * needing geometry today. That rule predates this table (prioritizeProtectedRecommendations) and
 * dropping it here would silently re-punish every lee shore.
 */
const shelterPoints = (item: SuitableBeach, feelsWind: boolean): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.shelter;
  if (!feelsWind) return axis('shelter', max, max);
  const level = item.exposureLevel;
  if (level === 'protected') return axis('shelter', max, max);
  if (level === 'partial') return axis('shelter', max / 2, max);
  if (level === 'exposed') return axis('shelter', 0, max);
  // No exposure verdict at all: the middle, not the floor.
  return axis('shelter', max / 2, max, true);
};

/** ΑΝΕΜΟΣ ΣΤΗ ΔΙΚΗ ΤΗΣ ΑΚΤΗ — 20, in whole Beaufort, the forecast's own resolution. */
const OWN_WIND_POINTS: Record<number, number> = { 0: 20, 1: 20, 2: 20, 3: 16, 4: 11, 5: 5, 6: 0 };
const ownWindPoints = (beaufort: number | undefined): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.ownWind;
  if (typeof beaufort !== 'number' || !Number.isFinite(beaufort)) return axis('ownWind', 11, max, true);
  const clamped = Math.max(0, Math.min(6, Math.round(beaufort)));
  return axis('ownWind', OWN_WIND_POINTS[clamped] ?? 0, max);
};

/**
 * ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ — 25, in 0,25 m steps of swell-equivalent height.
 *
 * Reads the same number the podium's sea rung read: the decision-grade seaStateWaveM, replaced by
 * the modelled height AT THE SAND where utils/shoreWave produced one and it is lower. Never
 * waveHeightM — that is the display figure the cove guard rewrites and types.ts forbids it as a
 * decision key. Height goes through seaStateSeverityM so 0,5 m at 3 s is not filed beside 0,5 m
 * at 7 s.
 */
const seaPoints = (item: SuitableBeach): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.sea;
  const decisionM = item.seaStateWaveM;
  if (typeof decisionM !== 'number' || !Number.isFinite(decisionM)) return axis('sea', 14, max, true);
  const shoreM = item.shoreWaveHeightM;
  const rankM = typeof shoreM === 'number' && Number.isFinite(shoreM) && shoreM <= decisionM ? shoreM : decisionM;
  const severity = seaStateSeverityM(rankM, item.seaStatePeriodS) ?? rankM;
  const step = Math.floor(Math.max(0, severity) / SEA_STEP_M);
  // 0 → 25, one step → 20, ... five steps (≥1,25 m) → 0.
  return axis('sea', Math.max(0, max - step * 5), max);
};

/**
 * ΑΠΟΣΤΑΣΗ ΑΠΟ ΤΟΝ ΧΡΗΣΤΗ — 10, the heaviest of the human axes (Μίλτος, 11/08/2026: «βάλ' την πάνω
 * από τις παροχές»).
 *
 * Bands, not a curve: the first ten kilometres are worth far more than the next ten, and a visitor
 * cannot tell 23 km from 26 km. The bottom band is 0 rather than negative — a far beach is not
 * being punished, it is simply not earning the points a near one does.
 *
 * The missing case is the MIDDLE, never the maximum. When nobody has shared a location every beach
 * lands here and the axis cannot separate anyone, which is the whole reason the podium stays
 * identical for every visitor on the prerendered and planner paths.
 */
const DISTANCE_BANDS: [number, number][] = [[5, 10], [10, 8], [20, 6], [35, 4], [60, 2]];
const distancePoints = (distanceKm: number | undefined): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.distance;
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return axis('distance', max / 2, max, true);
  }
  for (const [limit, points] of DISTANCE_BANDS) {
    if (distanceKm <= limit) return axis('distance', points, max);
  }
  return axis('distance', 0, max);
};

/**
 * ΠΡΟΣΒΑΣΗ — 6, below both the distance and the facilities it used to outrank (Μίλτος, 11/08/2026:
 * «οι παροχές επίσης θα είναι πάνω από τον δρόμο»). Takes the podium's existing 0-5 access priority
 * so there is one definition of "easy" on the site.
 */
const ACCESS_POINTS = [6, 4.5, 3, 1.5, 0.5, 0];
const accessPoints = (priority: number): TopPickAxisResult =>
  axis('access', ACCESS_POINTS[Math.max(0, Math.min(5, priority))] ?? 0, TOP_PICK_WEIGHTS.access);

/**
 * ΠΑΡΟΧΕΣ — 9. The podium's amenities score runs 0-22, mapped proportionally so two points of
 * parking cannot move a beach the way they did on 10/08, when they decided a whole podium alone.
 */
const amenitiesPoints = (score: number): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.amenities;
  const fraction = Math.max(0, Math.min(1, score / 22));
  return axis('amenities', Math.round(fraction * max * 2) / 2, max);
};

/**
 * ΠΟΛΥΣΥΧΝΑΣΤΗ — 5, and positive (Μίλτος, 11/08/2026).
 *
 * This axis was a crowd PENALTY for one day. Miltos overturned it: «αφού πάει πολύς κόσμος λογικά
 * καλή θα είναι, μην το παίρνουμε αρνητικά». Measured over the 1.941 beaches carrying both a review
 * count and a star rating, he is right — and the reason is sharper than the averages:
 *
 *   Πολυσύχναστη  4,49 stars   5% rated below 4,3
 *   Δημοφιλής     4,47        15%
 *   Μέτρια        4,44        18%
 *   Ήσυχη         4,40        27%
 *   Απομονωμένη   4,35        33%
 *
 * The mean barely moves — 0,14 stars across the whole range — but the DOWNSIDE moves six-fold: one
 * in three secluded beaches disappoints, one in twenty crowded ones does. Popularity is not
 * evidence of excellence, it is evidence against a bad surprise, and five points out of a hundred
 * is what that is worth.
 *
 * WHY THE COUNT AND NOT THE STARS. Both were built and measured; Miltos chose the count on
 * 11/08 and the label says so — «Πολυσύχναστη», the same word the card already prints, so the box
 * beside the podium and the badge on the beach cannot say different things. The known cost is that
 * the same two dozen famous names gain five points everywhere, which is why this is the SMALLEST
 * axis on the table and why the 916 beaches Google has never heard of are scored in the middle
 * rather than at zero: not knowing must never read as "nobody goes there".
 */
const crowdPoints = (beach: Beach): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.crowd;
  const tier = beach.popularity?.tier ?? beach.metadata?.popularity?.tier;
  if (!tier) return axis('crowd', 2, max, true);
  if (tier === 'crowded') return axis('crowd', max, max);
  if (tier === 'popular') return axis('crowd', 3, max);
  if (tier === 'moderate') return axis('crowd', 1, max);
  return axis('crowd', 0, max);
};

export interface TopPickScoreInput {
  item: SuitableBeach;
  /** Kilometres from the visitor, when a location has been shared. Undefined otherwise. */
  distanceKm?: number;
  /** The wind on this beach's own shore, already resolved by the caller. */
  ownBeaufort: number | undefined;
  /** False when the pool is windy but this shore is not — see shelterPoints. */
  feelsWind: boolean;
  accessPriority: number;
  amenitiesScore: number;
}

/**
 * The whole table in one call. Returns the breakdown as well as the total, because the panel beside
 * the Top 3 prints the rows and MUST NOT recompute them — a second implementation is how the
 * explanation and the order drift apart.
 */
export const scoreTopPick = ({
  item, ownBeaufort, feelsWind, accessPriority, amenitiesScore, distanceKm,
}: TopPickScoreInput): TopPickScoreBreakdown => {
  const axes = [
    shelterPoints(item, feelsWind),
    seaPoints(item),
    ownWindPoints(ownBeaufort),
    distancePoints(distanceKm),
    amenitiesPoints(amenitiesScore),
    accessPoints(accessPriority),
    crowdPoints(item.beach),
  ];
  const raw = axes.reduce((sum, a) => sum + a.points, 0);
  return { total: Math.max(0, Math.min(TOP_PICK_SCORE_MAX, Math.round(raw * 10) / 10)), axes };
};
