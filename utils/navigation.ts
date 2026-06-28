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
  // When present (place kind only), the Google Place ID is appended to the Maps URL as
  // query_place_id / destination_place_id so the link opens the EXACT place card. A bare name
  // query (no placeId) is unreliable in the Maps UI, so place destinations should carry one.
  placeId?: string;
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

const getGoogleMapsBeachQueryName = (beach: NavigationBeach): string | undefined => {
  const primaryName = getPrimaryBeachName(beach);
  if (!primaryName) {
    return undefined;
  }

  // Send the bare name (qualified by island in getPlaceQuery). We do NOT prepend a
  // "Παραλία "/"Paralia " word: a general geocoder (and Google Maps) reliably resolves
  // "<name>, <island>" but often returns NOTHING for "Παραλία <name>, <island>" — even
  // for well-known beaches (e.g. "Λαγκάδα, Milos" → the beach card, "Παραλία Λαγκάδα,
  // Milos" → 0 hits). The prefix was the root cause of the place-routing mis-resolution
  // the place-resolution audit flagged. Names that already start with the beach word are
  // kept verbatim.
  return primaryName;
};

// The region/island token in the data carries dataset-internal qualifiers that a geocoder
// (and Google Maps) cannot parse — notably "(mainland)", which makes the whole query return
// NOTHING (e.g. "Achlada, Halkidiki (mainland), Greece" → 0 hits, "Achlada, Halkidiki, Greece"
// → the beach). Normalize it:
//   "Halkidiki (mainland)"            -> "Halkidiki"
//   "Magnesia (mainland - Pelion)"    -> "Magnesia"
//   "Crete (Chania)"                  -> "Chania, Crete"   (keep the useful prefecture)
// Returns the parts to splice into the query in order (most specific first).
const cleanRegionToken = (value: string | undefined): string[] => {
  const text = (value || '').trim();
  if (!text) return [];
  const match = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!match) return [text];
  const base = match[1].trim();
  const inner = match[2].trim();
  // A "(mainland...)" qualifier is dataset noise — drop it, keep the base only.
  if (/^mainland\b/i.test(inner)) return base ? [base] : [];
  // Otherwise the parenthesis names a real sub-area (prefecture/region) — keep it, more
  // specific first, so "Crete (Chania)" routes as "Chania, Crete".
  return [inner, base].filter(Boolean);
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
    ...cleanRegionToken(beach.location?.island || beach.location?.region),
    'Greece',
  ]);

  return locationParts.length > 0 ? locationParts.join(', ') : undefined;
};

/**
 * Coordinate-first destination for a beach that should get full directions. Policy (2026-06-17,
 * nationwide Place-ID pass):
 *   1. A verified Google PLACE ID wins — the Maps link opens the EXACT place card via
 *      query_place_id, the only reliable way to land on the right beach.
 *   2. Otherwise route by the beach COORDINATE (collision-immune, always the exact pin).
 *   3. A bare name query is NO LONGER trusted: the Maps UI fails on many of those strings even
 *      when the Places API finds them (e.g. "Νεροδάφνη, Milos" -> "could not find"), and the
 *      Places API itself is non-deterministic. A name with no Place ID falls through to coordinate.
 *      (Last-resort name query only when there is no coordinate at all — defensive; ~0 beaches.)
 */
const getDirectionsDestination = (beach: NavigationBeach): NavigationDestination | undefined => {
  const nav = beach.metadata?.googleMapsNavigation;
  const placeId = cleanTextPart(nav?.placeId);
  const explicitQuery = cleanTextPart(nav?.query);
  if (placeId) {
    // Carry the human-readable query as the label, but the Place ID is what makes it land.
    return { kind: 'place', value: explicitQuery || getPlaceQuery(beach) || placeId, placeId };
  }
  const coordinate = getBestCoordinate(beach);
  if (coordinate) {
    return { kind: 'coordinate', value: formatCoordinate(coordinate) };
  }
  const placeQuery = getPlaceQuery(beach);
  return placeQuery ? { kind: 'place', value: placeQuery } : undefined;
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

  // A verified Google Place ID lets even a "locate" (show-on-map) link open the EXACT place card
  // instead of a bare coordinate pin. A coordinate query drops an unlabeled marker that Google
  // snaps to the nearest POI — on a boat-only / restricted-access beach that is often a point in
  // the sea or a *different* named beach, which is why "the pin doesn't land on the right place".
  // The place card carries no driving route (so boat-only stays route-free) but always titles the
  // correct beach. Falls back to the coordinate when no placeId exists.
  const nav = beach.metadata?.googleMapsNavigation;
  const verifiedPlaceId = cleanTextPart(nav?.placeId);
  const locateDestination: NavigationDestination | undefined = verifiedPlaceId
    ? { kind: 'place', value: cleanTextPart(nav?.query) || getPlaceQuery(beach) || verifiedPlaceId, placeId: verifiedPlaceId }
    : coordinateDestination;

  const locate = (badge: NavigationBadge): NavigationAction => (
    locateDestination
      ? { kind: 'locate', destination: locateDestination, badge }
      : { kind: 'none' }
  );

  // Safety rule: boat-only / boat-or-difficult-path never gets directions, even when verified.
  if (isBoatOnlyAccess(beach)) {
    return locate('boat-access');
  }

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
      // Verified Place ID -> exact Google card; coordinate-mode -> pin; a bare query (no placeId)
      // is no longer trusted and falls through getDirectionsDestination to the coordinate.
      if (nav?.placeId) {
        return {
          kind: 'directions',
          destination: { kind: 'place', value: cleanTextPart(nav.query) || String(nav.placeId), placeId: cleanTextPart(nav.placeId) },
        };
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
      // Unaudited beaches (no status) route by coordinate via getDirectionsDestination (collision-
      // immune). Superseded the prior place-first default on 2026-06-15 (nationwide nav fix).
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

  const placeId = action.destination.placeId;

  // A verified Place ID opens the EXACT Google place card via the /search/ endpoint's
  // query_place_id — honored reliably on BOTH desktop and mobile. We carry the Google-verified place
  // NAME as the human-readable query text so the card titles the right beach, while query_place_id
  // pins the exact place. This replaces the earlier coordinate-as-destination /dir/ link: a raw
  // coordinate drops a pin that Google labels with the NEAREST named POI, which on tightly-packed
  // shores is a *different* beach (e.g. Μαρτσέλο's pin is correct but sits 52 m from Google's
  // "Παραλία Κριός" marker, so the /dir/ link surfaced as Κριός). The place card costs one extra tap
  // to start directions on mobile, but always shows the correct beach. Note: destination_place_id on
  // a mobile /dir/ link is under-prioritized by the native app (it re-geocodes the text), which is
  // why we route the Place ID through /search/ rather than /dir/.
  if (placeId) {
    const label = encodeURIComponent(action.destination.value);
    return `https://www.google.com/maps/search/?api=1&query=${label}&query_place_id=${encodeURIComponent(placeId)}`;
  }

  // No Place ID: route by the destination value — a beach COORDINATE for the collision-immune
  // default, or a last-resort name query when there is no coordinate at all.
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
