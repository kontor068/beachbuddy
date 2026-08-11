import { Beach, SwimmingComfort } from '../types';
import { ExposureLevel } from './windExposure';
import { hasMainstreamTopPickAccess } from './access';
import { stableVariantIndex } from './beachCopy';

/**
 * Day-to-day variety for the home "top-3 today" picks.
 *
 * Problem: the top-3 ranking is fully deterministic, so for the same weather the
 * same three beaches show every day. On a calm day dozens of beaches are genuinely
 * equally-good — which one lands at #2/#3 is arbitrary (input order), not signal.
 *
 * This layer rotates ONLY among beaches that are indistinguishable-today from each
 * other, keeping #1 fixed, seeded by (island + calendar date) so it is stable within
 * a day and changes across days. It never promotes a worse/less-safe/harder-to-reach
 * beach — it only reorders genuine equals inside the already-qualified pool. It is a
 * pure function (no Date.now/Math.random/localStorage) so it is SSR/prerender-safe.
 *
 * Scope is deliberately narrow ("Ήπια"): calm days only, #2/#3 only, #1 stays put.
 */

/**
 * ⚠️ ΔΕΝ ΕΙΝΑΙ ΣΥΝΔΕΔΕΜΕΝΟ ΑΠΟ ΤΙΣ 11/08/2026 — και ποτέ δεν το είδε χρήστης.
 *
 * The ceiling below is 2 Bft, and until 11/08 the podium was hidden at 2 Bft and under, so this
 * rotation could only ever have fired on the days nothing was displayed. When the podium was
 * opened on calm days it lasted about an hour: the same morning Miltos decided that beaches which
 * tie on everything are ordered by Google review count, descending, and a shuffle sitting above
 * that order simply undoes it.
 *
 * Kept, not deleted, because the problem it solves is real — a region showing the same three every
 * morning for a fortnight of calm — and because the correct version is a variation of this code:
 * rotate only INSIDE the popularity order (e.g. among beaches whose review counts are the same
 * order of magnitude), never above it. See App.tsx `topRecommendedSuitableBeaches`.
 */

/** Only rotate on genuinely calm days (Beaufort <= this). At 3+ Bft the picks are the
 *  best-available leeward refuges and must not be shuffled (meltemi invariant). */
export const ROTATION_MAX_BEAUFORT = 2;

/** Only rotate when today's best beach is genuinely good ("very good" verdict, aligned
 *  with TodayScoreBadge >= 76). Below this we do not claim a basket of "equally good". */
export const ROTATION_LEADER_SCORE_FLOOR = 76;

/** Two beaches are treated as indistinguishable-today when their scores are within this
 *  many points of each other. 4 sits comfortably inside the ranking's own "tied" notion
 *  (the service comparator treats a <=5 score gap as a tie). */
export const ROTATION_TIE_EPSILON = 4;

type RotatableTopPick = {
  score: number;
  isExposed?: boolean;
  exposureLevel?: ExposureLevel;
  canClaimWindProtection?: boolean;
  swimmingComfort?: SwimmingComfort;
  beach: Beach;
  /** Intraday timing bucket, present on home top-pick items (added by applyRemainingTopPickWindow). */
  timing?: { state?: string };
};

export interface RotateEquivalentTopPicksOptions {
  /** Beaufort for the shown day. */
  beaufort: number;
  /** Absolute calendar day key (e.g. '2026-07-02'). Must be absolute, not a relative
   *  "days from today" offset, so the seed advances across calendar days. */
  dateKey: string;
  /** Stable per-region key (e.g. island id) so each island rotates independently. */
  regionKey: string;
}

/** Same exposure bucket the home ranking uses: protected+claimable=0, partial=1, else 2. */
const exposureTier = (item: RotatableTopPick): number => {
  if (item.exposureLevel === 'protected' && item.canClaimWindProtection === true) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

/**
 * Returns a copy of `items` with the genuine-equals of the leader cyclically rotated by
 * a (region + date) seed, or the original `items` unchanged when rotation does not apply.
 * Membership and length are always preserved — only the order among equals can change,
 * and only for positions after the leader.
 */
export const rotateEquivalentTopPicks = <T extends RotatableTopPick>(
  items: T[],
  { beaufort, dateKey, regionKey }: RotateEquivalentTopPicksOptions
): T[] => {
  // Only calm days, and only when there is a real #2/#3 to vary.
  if (beaufort > ROTATION_MAX_BEAUFORT || items.length < 3) return items;

  const leader = items[0];
  if (!leader || typeof leader.score !== 'number' || leader.score < ROTATION_LEADER_SCORE_FLOOR) {
    return items;
  }

  const leaderTier = exposureTier(leader);
  const leaderState = leader.timing?.state;

  // Collect the positions (after the leader) of beaches that are interchangeable with it
  // today: score within epsilon on BOTH sides, same exposure tier, same swimming comfort,
  // same intraday timing state (so we never reorder across a meaningful timing boundary),
  // and easy access (never rotate a hard-to-reach beach up — the pool already excludes
  // them, this locks the guarantee in). The list is not assumed to be score-sorted
  // (prioritizeDynamicTopPickWindows reorders by timing on "today"), so we scan all of it.
  const rotatablePositions: number[] = [];
  for (let i = 1; i < items.length; i += 1) {
    const item = items[i];
    if (typeof item.score !== 'number') continue;
    if (Math.abs(item.score - leader.score) > ROTATION_TIE_EPSILON) continue;
    if (exposureTier(item) !== leaderTier) continue;
    if (item.swimmingComfort !== leader.swimmingComfort) continue;
    if (leaderState && item.timing?.state !== leaderState) continue;
    if (!hasMainstreamTopPickAccess(item.beach)) continue;
    rotatablePositions.push(i);
  }

  if (rotatablePositions.length <= 1) return items;

  const occupants = rotatablePositions.map(position => items[position]);
  const offset = stableVariantIndex(`${regionKey}#${dateKey}`, occupants.length);
  if (offset === 0) return items;

  const rotated = items.slice();
  rotatablePositions.forEach((position, index) => {
    rotated[position] = occupants[(index + offset) % occupants.length];
  });
  return rotated;
};
