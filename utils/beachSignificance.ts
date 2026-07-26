import type { Beach } from '../types';
import { getBeachTouristRecognitionScore } from './touristPriority';
import { isCalmBeachCertified } from './certifiedBeaches';
import { hasMainstreamTopPickAccess } from './access';

/**
 * SIGNIFICANCE — "which beaches would you regret missing", the trip planner's
 * selection axis (product decision 2026-07-26): significance chooses WHICH
 * beaches go on a trip; the weather only arranges them INTO days.
 *
 * This is deliberately NOT the star rating. Stars measure quality, not
 * importance: a quiet beach at 4.8 with 30 reviews must not outrank a national
 * icon at 4.3 with 9,000. The review COUNT is the broad fame signal (68.6%
 * national coverage, median 208), and the curated recognition list is the
 * authoritative top layer (68 entries nationally).
 *
 * LEXICOGRAPHIC composition, not a weighted sum — weights are opaque and
 * invite endless tuning; ordered tiers state the editorial policy plainly:
 *   1. curated recognition (utils/touristPriority.ts) — absolute priority;
 *   2. fame: review-count BUCKET (the 200 → 2,000 difference matters,
 *      9,000 → 10,000 does not);
 *   3. quality: real stars, only to separate beaches INSIDE a fame bucket;
 *   4. house curation: CalmBeach Certified (first-party, on-the-ground);
 *   5. practicality: mainstream access as the final nudge;
 *   6. beach id — a deterministic tail so no ordering ever depends on the
 *      order beaches happen to sit in a JSON file.
 *
 * `beach.rating` / `popularityScore` are synthetic id-hashes
 * (utils/touristPriority.ts:13-14) and are BANNED from this ranking.
 *
 * Follow-up (deliberately absent): an editorial-story signal. Stories load
 * async per region (data/beachStories.ts, split for bundle weight) — wiring
 * them in needs a generated id-only list, not an import of the story text.
 */

/** Real Google review count when present; 0 otherwise (never synthetic). */
const getReviewCount = (beach: Beach): number => {
  const count = beach.metadata?.popularity?.ratingCount ?? beach.popularity?.ratingCount;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 0;
};

/** Real Google star rating when present; 0 otherwise (never synthetic). */
const getRealRating = (beach: Beach): number => {
  const rating = beach.metadata?.popularity?.rating ?? beach.popularity?.rating;
  return typeof rating === 'number' && Number.isFinite(rating) ? rating : 0;
};

/**
 * Fame buckets over the review count. Thresholds picked from the national
 * distribution (median 208, max ~17k): ≥5000 destination-famous, ≥1500 very
 * well known, ≥400 well known, ≥100 known, below that (or unrated) unknown.
 */
const getFameBucket = (reviewCount: number): number => {
  if (reviewCount >= 5000) return 4;
  if (reviewCount >= 1500) return 3;
  if (reviewCount >= 400) return 2;
  if (reviewCount >= 100) return 1;
  return 0;
};

export interface BeachSignificance {
  /** Curated national recognition (0 when not on the list). */
  recognition: number;
  /** Fame bucket 0–4 from the real review count. */
  fameBucket: number;
  /** Real star rating (0 when unrated) — tiebreak inside a bucket only. */
  rating: number;
  /** 1 when CalmBeach Certified. */
  certified: number;
  /** 1 when access is mainstream (no dirt road / boat / hard hike). */
  mainstreamAccess: number;
}

export const getBeachSignificance = (beach: Beach): BeachSignificance => {
  const reviewCount = getReviewCount(beach);
  return {
    recognition: getBeachTouristRecognitionScore(beach),
    fameBucket: getFameBucket(reviewCount),
    rating: getRealRating(beach),
    certified: isCalmBeachCertified(beach.id) ? 1 : 0,
    mainstreamAccess: hasMainstreamTopPickAccess(beach) ? 1 : 0,
  };
};

/**
 * Sort comparator: most significant first. Fully deterministic — ends on
 * beach id so two calls over differently-ordered arrays produce the same
 * ranking (the planner's order-invariance guarantee starts here).
 */
export const compareBeachSignificance = (a: Beach, b: Beach): number => {
  const sa = getBeachSignificance(a);
  const sb = getBeachSignificance(b);
  return (
    sb.recognition - sa.recognition ||
    sb.fameBucket - sa.fameBucket ||
    sb.rating - sa.rating ||
    sb.certified - sa.certified ||
    sb.mainstreamAccess - sa.mainstreamAccess ||
    a.id - b.id
  );
};

/** True when the beach carries any real significance signal at all —
 *  curated recognition or an actual review base. Beaches with neither are
 *  not "must-see"; they stay available only as weather refuges. */
export const hasSignificanceSignal = (beach: Beach): boolean => {
  const significance = getBeachSignificance(beach);
  return significance.recognition > 0 || significance.fameBucket > 0;
};
