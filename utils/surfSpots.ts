import type { Beach } from '../types';
import { athensNow } from './athensTime';

/**
 * Is this beach a surf spot RIGHT NOW?
 *
 * One helper, used by both the recommendation filter and the map marker, because
 * these two already drifted apart once: BeachSearcherHome read
 * `beach.activities.surfing` directly and so offered November-only Ionian breaks
 * in August, while the filter next to it did not.
 *
 * Two conditions, both required:
 *
 *  1. `activities.surfing` — set ONLY from data/surfSpots.json, and only for
 *     spots at least two independent surf guides name. It used to be a hash of
 *     the beach id (543 random beaches, 1 of 9 real spots caught).
 *  2. In season. Greek surf splits hard: the Ionian and Peloponnese breaks run
 *     November–April, the Aegean ones are meltemi-driven and run May–September.
 *     A break that is flat today is not a surf beach today.
 */
export const isSurfSpotInSeason = (beach: Pick<Beach, 'activities' | 'surfMonths'>): boolean => {
  if (!beach.activities?.surfing) return false;
  // No months recorded means "we did not pin the season down" — trust the flag
  // rather than silently hiding a spot we deliberately curated.
  if (!beach.surfMonths?.length) return true;
  return beach.surfMonths.includes(athensNow().getMonth() + 1);
};
