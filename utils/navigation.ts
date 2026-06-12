import { Accessibility, type Beach } from '../types';

type Coordinate = {
  lat: number;
  lon: number;
};

type NavigationBeach = Pick<Partial<Beach>, 'id' | 'name' | 'coordinates' | 'mapCoordinates' | 'location' | 'aliases' | 'metadata' | 'accessibility'> & {
  latitude?: number;
  longitude?: number;
};

type NavigationDestination = {
  kind: 'coordinate' | 'place';
  value: string;
};

/**
 * Hybrid navigation outcome (status-driven). The UI gets one of:
 *  - 'directions': full turn-by-turn (mobile dir / desktop search) to a trusted destination
 *  - 'locate':     "show on map" — always the search API with COORDINATES, i.e. a position
 *                  WITHOUT a routing promise; carries a `badge` explaining why. Used when a road
 *                  route would be wrong or unverified (boat-only access, blocked/unverified nav).
 *  - 'none':       nothing actionable (only when there is no coordinate at all — 0 today).
 * `badge` is consumed by the UI in Phase B (i18n); Phase A wires the logic + URLs only.
 */
export type NavigationBadge = 'boat-access' | 'nav-unavailable' | 'nav-unverified';

export type NavigationAction = {
  kind: 'directions' | 'locate' | 'none';
  destination?: NavigationDestination;
  badge?: NavigationBadge;
};

const isValidCoordinate = (coordinate?: Partial<Coordinate>): coordinate is Coordinate => (
  Number.isFinite(coordinate?.lat) &&
  Number.isFinite(coordinate?.lon)
);

const formatCoordinate = (coordinate: Coordinate) => `${coordinate.lat},${coordinate.lon}`;

const getExplicitMapCoordinate = (beach: NavigationBeach): Coordinate | undefined => {
  if (!isValidCoordinate(beach.mapCoordinates)) {
    return undefined;
  }

  return {
    lat: beach.mapCoordinates.lat,
    lon: beach.mapCoordinates.lon,
  };
};

const getFallbackCoordinate = (beach: NavigationBeach): Coordinate | undefined => {
  const coordinate = isValidCoordinate(beach.coordinates)
    ? beach.coordinates
    : {
      lat: beach.latitude,
      lon: beach.longitude,
    };

  if (!isValidCoordinate(coordinate)) {
    return undefined;
  }

  return {
    lat: coordinate.lat,
    lon: coordinate.lon,
  };
};

const getBestCoordinate = (beach: NavigationBeach): Coordinate | undefined => (
  getExplicitMapCoordinate(beach) || getFallbackCoordinate(beach)
);

const cleanTextPart = (value?: string) => {
  const text = value?.trim();
  return text && text.length > 0 ? text : undefined;
};

const hasGreekLetters = (value: string) => /[\u0370-\u03ff]/.test(value);

const getPrimaryBeachName = (beach: NavigationBeach): string | undefined => {
  const greekName = cleanTextPart(beach.name?.gr);
  if (greekName && hasGreekLetters(greekName)) {
    return greekName;
  }

  return cleanTextPart(beach.name?.en) ||
    Object.values(beach.name || {}).map(cleanTextPart).find(Boolean) ||
    beach.aliases?.map(cleanTextPart).find(Boolean);
};

const uniqueTextParts = (parts: Array<string | undefined>) => {
  const seen = new Set<string>();

  return parts.filter((part): part is string => {
    const text = cleanTextPart(part);
    if (!text) {
      return false;
    }

    const key = text.toLocaleLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const startsWithBeachWord = (value: string) => (
  /^(παραλία|paralia|beach)(\s|,|$)/i.test(value.trim())
);

const getGoogleMapsBeachQueryName = (beach: NavigationBeach): string | undefined => {
  const primaryName = getPrimaryBeachName(beach);
  if (!primaryName) {
    return undefined;
  }

  if (startsWithBeachWord(primaryName)) {
    return primaryName;
  }

  return hasGreekLetters(primaryName)
    ? `Παραλία ${primaryName}`
    : `Paralia ${primaryName}`;
};

const getPlaceQuery = (beach: NavigationBeach): string | undefined => {
  // Data-driven explicit query (replaces the old hardcoded by-id Map): an island-qualified
  // string the nav audit verified routes correctly (e.g. Lakos #1848).
  const explicitQuery = cleanTextPart(beach.metadata?.googleMapsNavigation?.query);
  if (explicitQuery) {
    return explicitQuery;
  }

  const queryName = getGoogleMapsBeachQueryName(beach);
  if (!queryName) {
    return undefined;
  }

  const locationParts = uniqueTextParts([
    queryName,
    beach.location?.island || beach.location?.region,
    'Greece',
  ]);

  return locationParts.length > 0 ? locationParts.join(', ') : undefined;
};

/**
 * Place-first destination for a beach that should get full directions: the explicit/built
 * place query when available, else the coordinate. Used for 'directions' actions whose mode
 * is not coordinate-pinned.
 */
const getDirectionsDestination = (beach: NavigationBeach): NavigationDestination | undefined => {
  const placeQuery = getPlaceQuery(beach);
  if (placeQuery) {
    return { kind: 'place', value: placeQuery };
  }
  const coordinate = getBestCoordinate(beach);
  return coordinate ? { kind: 'coordinate', value: formatCoordinate(coordinate) } : undefined;
};

const getCoordinateDestination = (beach: NavigationBeach): NavigationDestination | undefined => {
  const coordinate = getBestCoordinate(beach);
  return coordinate ? { kind: 'coordinate', value: formatCoordinate(coordinate) } : undefined;
};

// Access types that have NO drivable road to the beach itself. `boat_or_difficult_path` exists
// in the data but is not in the BeachAccessType union, so we compare as a plain string set rather
// than against the (incomplete) literal type. `boat_or_road` is intentionally EXCLUDED — it has a
// road, so directions are valid there.
const BOAT_ONLY_ACCESS_TYPES = new Set<string>(['boat_only', 'boat_or_difficult_path']);

const isBoatOnlyAccess = (beach: NavigationBeach): boolean => (
  BOAT_ONLY_ACCESS_TYPES.has(String(beach.metadata?.access?.type)) ||
  beach.accessibility === Accessibility.BOAT_ONLY
);

/**
 * Status-driven hybrid navigation decision (see docs/hybrid-navigation-plan.md).
 * Order matters: the boat-only safety rule runs first and overrides every status (incl.
 * 'verified') — there is no legal road route to the sand, so we never emit a `dir` URL there.
 */
export const getNavigationAction = (beach: NavigationBeach): NavigationAction => {
  const coordinateDestination = getCoordinateDestination(beach);
  // With no coordinate and no name we cannot do anything (0 beaches today; defensive).
  if (!coordinateDestination && !getPlaceQuery(beach)) {
    return { kind: 'none' };
  }

  const locate = (badge: NavigationBadge): NavigationAction => (
    coordinateDestination
      ? { kind: 'locate', destination: coordinateDestination, badge }
      : { kind: 'none' }
  );

  // Safety rule: boat-only / boat-or-difficult-path never gets directions, even when verified.
  if (isBoatOnlyAccess(beach)) {
    return locate('boat-access');
  }

  const nav = beach.metadata?.googleMapsNavigation;
  const status = nav?.status
    ?? (beach.metadata?.confidence === 'low' ? 'low-conf-unaudited' : 'default');

  switch (status) {
    case 'blocked':
    case 'unresolved':
      return locate('nav-unavailable');

    case 'needs-review':
      // coordinate-mode hint = the audit trusts the pin for routing; place-mode hint here means
      // the audit did NOT trust a place lookup, so we only locate (no blind directions).
      if (nav?.mode === 'coordinates' && coordinateDestination) {
        return { kind: 'directions', destination: coordinateDestination };
      }
      return locate('nav-unverified');

    case 'verified': {
      // Explicit query wins; coordinate-mode routes by pin (collision-immune); else place.
      if (nav?.query) {
        return { kind: 'directions', destination: { kind: 'place', value: nav.query } };
      }
      if (nav?.mode === 'coordinates' && coordinateDestination) {
        return { kind: 'directions', destination: coordinateDestination };
      }
      const destination = getDirectionsDestination(beach);
      return destination ? { kind: 'directions', destination } : locate('nav-unverified');
    }

    case 'low-conf-unaudited':
      // Previously hidden entirely; now a visible "locate" with a badge instead of a black hole.
      return locate('nav-unverified');

    case 'default':
    default: {
      // The ~1.9k beaches with no status keep today's place-first directions flow UNCHANGED.
      const destination = getDirectionsDestination(beach);
      return destination ? { kind: 'directions', destination } : { kind: 'none' };
    }
  }
};

/**
 * Backward-compatible helper: the trusted destination for a beach, or undefined when there is
 * nothing actionable. Both 'directions' and 'locate' carry a destination.
 */
export const getNavigationDestination = (beach: NavigationBeach): NavigationDestination | undefined => (
  getNavigationAction(beach).destination
);

export const canOpenNavigation = (beach: NavigationBeach) => (
  getNavigationAction(beach).kind !== 'none'
);

/**
 * Presentation helper: the badge for a beach's navigation action, or undefined when there is
 * nothing to flag (full directions or no action). Reads the SAME getNavigationAction — never
 * recomputes the decision. The UI maps the badge key to a localized label.
 */
export const getNavigationBadge = (beach: NavigationBeach): NavigationBadge | undefined => (
  getNavigationAction(beach).badge
);

const isMobileDevice = () => (
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
);

export const getNavigationUrl = (beach: NavigationBeach, mobile = isMobileDevice()) => {
  const action = getNavigationAction(beach);
  if (action.kind === 'none' || !action.destination) {
    return undefined;
  }

  const encodedDestination = encodeURIComponent(action.destination.value);

  // 'locate' is a position only — always the search API (even on mobile), no routing promise.
  if (action.kind === 'locate') {
    return `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`;
  }

  return mobile
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`;
};

export const openNavigation = (beach: NavigationBeach) => {
  const url = getNavigationUrl(beach);
  if (!url) {
    console.error('Coordinates or place name not found for navigation');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};
