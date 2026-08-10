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
 *  Προστασία από τον άνεμο                 30        exposureLevel + geometry
 *  Άνεμος στη δική της ακτή                25        per-beach cluster Beaufort
 *  Νερό στην ακτή                          25        seaStateWaveM / shoreWaveHeightM
 *                                        ─────
 *                          ο καιρός        80
 *
 *  Παροχές                                  8        amenities
 *  Πρόσβαση                                 7        metadata.access.type
 *  Πόσο αρέσει                              5        Google star rating
 *                                        ─────
 *                        τα ανθρώπινα      20
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 80/20 is Miltos's call, made 10/08 with the trade-off stated: at this split a beach with
 * umbrellas, a canteen and asphalt can outrank a slightly calmer wild one, but only when the
 * weather gap is small — an exposed beach gives up 30 points that 20 points of comfort can never
 * repay. That is the intended behaviour and the reason the two blocks are not 50/50.
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
  shelter: 30,
  ownWind: 25,
  sea: 25,
  amenities: 8,
  access: 7,
  liked: 5,
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

/** ΑΝΕΜΟΣ ΣΤΗ ΔΙΚΗ ΤΗΣ ΑΚΤΗ — 25, in whole Beaufort, the forecast's own resolution. */
const OWN_WIND_POINTS: Record<number, number> = { 0: 25, 1: 25, 2: 25, 3: 20, 4: 14, 5: 7, 6: 0 };
const ownWindPoints = (beaufort: number | undefined): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.ownWind;
  if (typeof beaufort !== 'number' || !Number.isFinite(beaufort)) return axis('ownWind', 14, max, true);
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
 * ΠΡΟΣΒΑΣΗ — 7, one point below the facilities it used to outrank (Μίλτος, 11/08/2026: «οι παροχές
 * επίσης θα είναι πάνω από τον δρόμο σαν ποσοστό»). Takes the podium's existing 0-5 access
 * priority so there is one definition of "easy" on the site.
 */
const ACCESS_POINTS = [7, 5, 3, 2, 1, 0];
const accessPoints = (priority: number): TopPickAxisResult =>
  axis('access', ACCESS_POINTS[Math.max(0, Math.min(5, priority))] ?? 0, TOP_PICK_WEIGHTS.access);

/**
 * ΠΑΡΟΧΕΣ — 8, the heaviest of the three human axes. The podium's amenities score runs 0-22, mapped
 * proportionally so two points of parking cannot move a beach the way they did on 10/08, when they
 * decided a whole podium on their own.
 */
const amenitiesPoints = (score: number): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.amenities;
  const fraction = Math.max(0, Math.min(1, score / 22));
  return axis('amenities', Math.round(fraction * max * 2) / 2, max);
};

/**
 * ΠΟΣΟ ΑΡΕΣΕΙ — 5, and positive (Μίλτος, 11/08/2026).
 *
 * This axis was a crowd PENALTY for one day. Miltos overturned it: «αφού πάει πολύς κόσμος λογικά
 * καλή θα είναι, μην το παίρνουμε αρνητικά». Measured over the 1.941 beaches carrying both a
 * review count and a star rating, he is right — and the reason is sharper than the averages:
 *
 *   Πολυσύχναστη  4,49 stars   5% rated below 4,3
 *   Δημοφιλής     4,47        15%
 *   Μέτρια        4,44        18%
 *   Ήσυχη         4,40        27%
 *   Απομονωμένη   4,35        33%
 *
 * The mean barely moves (0,14 stars across the whole range) but the DOWNSIDE moves six-fold: one
 * in three secluded beaches disappoints, one in twenty crowded ones does. Popularity is not
 * evidence of excellence, it is evidence against a bad surprise.
 *
 * WHICH NUMBER, THEN. The star rating, not the review count — they answer different questions and
 * only one of them is «did people like it». Scoring the count would have pushed every list towards
 * the same two dozen names, which is the one thing this site cannot afford to be: a slower Google.
 * The rating is nearly independent of the count (top-100 by volume average 4,49 stars, bottom-100
 * average 4,38), so this rewards beaches people loved, not beaches buses reach.
 *
 * Bands are wide because the ratings are compressed: p25 is 4,3 and p75 is 4,6 nationally, so
 * finer steps would be sorting on a tenth of a star that means nothing. No rating on record scores
 * the middle band, never zero — 916 beaches have no Google identity at all and this must not
 * become a tax on being unknown.
 */
const likedPoints = (beach: Beach): TopPickAxisResult => {
  const max = TOP_PICK_WEIGHTS.liked;
  const rating = beach.popularity?.rating ?? beach.metadata?.popularity?.rating;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return axis('liked', 2, max, true);
  if (rating >= 4.6) return axis('liked', max, max);
  if (rating >= 4.4) return axis('liked', 3, max);
  if (rating >= 4.2) return axis('liked', 1, max);
  return axis('liked', 0, max);
};

export interface TopPickScoreInput {
  item: SuitableBeach;
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
  item, ownBeaufort, feelsWind, accessPriority, amenitiesScore,
}: TopPickScoreInput): TopPickScoreBreakdown => {
  const axes = [
    shelterPoints(item, feelsWind),
    ownWindPoints(ownBeaufort),
    seaPoints(item),
    accessPoints(accessPriority),
    amenitiesPoints(amenitiesScore),
    likedPoints(item.beach),
  ];
  const raw = axes.reduce((sum, a) => sum + a.points, 0);
  return { total: Math.max(0, Math.min(TOP_PICK_SCORE_MAX, Math.round(raw * 10) / 10)), axes };
};
