import type { Beach } from '../types';
import { WindDirection } from '../types';

/**
 * Beaches whose seaward shoreline faces the western horizon (W / NW / SW) get the
 * evening sun over the water — the orientation signal behind the "sunset" guide
 * pages. This is the single source of truth shared by the guide links
 * ([utils/beachGuides.ts]), the Experience "Sunset" filter, and the search-intent
 * hook, so the three never diverge (see the map-colour-vs-detail class of bugs).
 *
 * It records shoreline-facing direction only — NOT sunset visibility (a headland or
 * island offshore can still block the horizon). That caveat already lives in the
 * per-beach orientation.notes and on the guide pages.
 */
const SUNSET_FACING: WindDirection[] = [WindDirection.W, WindDirection.NW, WindDirection.SW];

export const isSunsetFacingBeach = (beach: Beach): boolean =>
  Array.isArray(beach.orientation?.faces) &&
  SUNSET_FACING.some(direction => beach.orientation!.faces.includes(direction));
