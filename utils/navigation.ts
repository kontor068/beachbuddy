import type { Beach } from '../types';

type Coordinate = {
  lat: number;
  lon: number;
};

type NavigationBeach = Pick<Partial<Beach>, 'id' | 'name' | 'coordinates' | 'mapCoordinates' | 'location' | 'aliases' | 'metadata'> & {
  latitude?: number;
  longitude?: number;
};

type NavigationDestination = {
  kind: 'coordinate' | 'place';
  value: string;
};

const isValidCoordinate = (coordinate?: Partial<Coordinate>): coordinate is Coordinate => (
  Number.isFinite(coordinate?.lat) &&
  Number.isFinite(coordinate?.lon)
);

const formatCoordinate = (coordinate: Coordinate) => `${coordinate.lat},${coordinate.lon}`;

const GOOGLE_NAVIGATION_UNAVAILABLE_BEACH_IDS = new Set<number>([
  1841, // Vroulidi, Kimolos: Google Maps place search can match Vroulidia, Sifnos.
  1845, // Therma, Kimolos: Google Maps place search can match a different beach/place.
]);

const GOOGLE_NAVIGATION_PLACE_QUERY_BY_BEACH_ID = new Map<number, string>([
  [1848, 'Lakos Beach, Kimolos, Greece'],
]);

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

const isGoogleNavigationUnavailable = (beach: NavigationBeach) => (
  beach.metadata?.googleMapsNavigation?.status === 'unresolved' ||
  (
    beach.metadata?.confidence === 'low' &&
    beach.metadata.googleMapsNavigation?.status !== 'verified'
  ) ||
  (typeof beach.id === 'number' && GOOGLE_NAVIGATION_UNAVAILABLE_BEACH_IDS.has(beach.id))
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
  if (typeof beach.id === 'number') {
    const explicitQuery = GOOGLE_NAVIGATION_PLACE_QUERY_BY_BEACH_ID.get(beach.id);
    if (explicitQuery) {
      return explicitQuery;
    }
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

export const getNavigationDestination = (beach: NavigationBeach): NavigationDestination | undefined => {
  if (isGoogleNavigationUnavailable(beach)) {
    return undefined;
  }

  const placeQuery = getPlaceQuery(beach);
  if (placeQuery) {
    return {
      kind: 'place',
      value: placeQuery,
    };
  }

  const fallbackCoordinate = getBestCoordinate(beach);
  if (!fallbackCoordinate) {
    return undefined;
  }

  return {
    kind: 'coordinate',
    value: formatCoordinate(fallbackCoordinate),
  };
};

export const canOpenNavigation = (beach: NavigationBeach) => (
  getNavigationDestination(beach) !== undefined
);

const isMobileDevice = () => (
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
);

export const getNavigationUrl = (beach: NavigationBeach, mobile = isMobileDevice()) => {
  const destination = getNavigationDestination(beach);
  if (!destination) {
    return undefined;
  }

  const encodedDestination = encodeURIComponent(destination.value);

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
