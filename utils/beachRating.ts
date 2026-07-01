import { Beach } from '../types';

/**
 * Neutral baseline for a beach with no real Google rating on record. Chosen so that
 * genuinely well-reviewed beaches (real 4.5–5.0) surface above unrated ones, while
 * poorly-reviewed beaches (real < 4.0) correctly sink below them.
 */
export const UNRATED_BEACH_RATING = 4.0;

/**
 * A beach's REAL average Google rating (stars, from Places) when we have it, else a
 * neutral baseline.
 *
 * This replaces the legacy `beach.rating` field for every ordering, scoring and crowd
 * decision. That field was `4.0 + hash(beach.id)` — a fabricated, deterministic
 * pseudo-random number with no relation to how good or popular a beach actually is —
 * so it was quietly biasing list order and crowd estimates. Reading the real
 * `popularity.rating` (present on ~1,900 beaches) makes those decisions honest, and
 * unrated beaches fall back to a neutral value instead of a random one.
 */
export const getBeachPopularityRating = (beach: Beach): number => {
  const rating = beach.metadata?.popularity?.rating ?? beach.popularity?.rating;
  return typeof rating === 'number' && Number.isFinite(rating) ? rating : UNRATED_BEACH_RATING;
};
