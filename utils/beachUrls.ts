import type { Beach, LanguageCode } from '../types';

export interface BeachDetailRoute {
  regionId: string;
  beachId: number;
  slug?: string;
  language?: LanguageCode;
}

export interface BeachRegionRoute {
  regionId: string;
  language?: LanguageCode;
}

export interface BeachRegionUrlRegion {
  id: string;
  name?: {
    en?: string;
    gr?: string;
    fr?: string;
    de?: string;
    it?: string;
  };
}

type BeachUrlBeach = Pick<Beach, 'id' | 'name'>;

const BEACH_REGION_ROUTE_PATTERN = /^\/beaches\/([^/]+)\/?$/;
const BEACH_DETAIL_ROUTE_PATTERN = /^\/beaches\/([^/]+)\/(\d+)(?:-([^/]+))?\/?$/;
const GREEK_ROUTE_PREFIX_PATTERN = /^\/el(?=\/|$)/;
const REGION_ID_PREFIXES = [
  'east-macedonia-and-thrace-',
  'central-macedonia-',
  'central-greece-',
  'ionian-islands-',
  'north-aegean-',
  'south-aegean-',
  'west-greece-',
  'peloponnese-',
  'thessaly-',
  'attica-',
  'epirus-',
  'crete-crete-',
  'crete-',
];

export const normalizeBeachSlug = (value?: string): string => {
  const normalized = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'beach';
};

export const getBeachUrlName = (beach: BeachUrlBeach): string => (
  beach.name.en || beach.name.gr || beach.name.fr || beach.name.de || beach.name.it || `beach-${beach.id}`
);

export const getBeachPathLanguage = (pathname?: string): LanguageCode | undefined => {
  const rawPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return GREEK_ROUTE_PREFIX_PATTERN.test(rawPathname) ? 'gr' : undefined;
};

const stripBeachLocalePrefix = (pathname: string): string => (
  pathname.replace(GREEK_ROUTE_PREFIX_PATTERN, '') || '/'
);

const getBeachLocalePrefix = (language?: LanguageCode): string => (
  language === 'gr' ? '/el' : ''
);

const normalizeRegionIdSlug = (regionId: string): string => {
  const withoutPrefix = REGION_ID_PREFIXES.reduce((value, prefix) => (
    value.startsWith(prefix) ? value.slice(prefix.length) : value
  ), regionId);

  return normalizeBeachSlug(withoutPrefix.replace(/-mainland$/i, ''));
};

export const getRegionUrlSlug = (region: BeachRegionUrlRegion | string): string => {
  if (typeof region === 'string') return normalizeRegionIdSlug(region);

  const readableName = region.name?.en || region.name?.gr || region.name?.fr || region.name?.de || region.name?.it;
  return readableName ? normalizeBeachSlug(readableName) : normalizeRegionIdSlug(region.id);
};

export const regionMatchesRouteParam = (
  region: BeachRegionUrlRegion,
  routeRegionParam?: string
): boolean => {
  if (!routeRegionParam) return false;
  const normalizedRouteParam = normalizeBeachSlug(routeRegionParam);
  return routeRegionParam === region.id || normalizedRouteParam === getRegionUrlSlug(region);
};

export const buildBeachRegionPath = (region: BeachRegionUrlRegion | string, language?: LanguageCode): string => (
  `${getBeachLocalePrefix(language)}/beaches/${encodeURIComponent(getRegionUrlSlug(region))}/`
);

export const buildBeachDetailPath = (region: BeachRegionUrlRegion | string, beach: BeachUrlBeach, language?: LanguageCode): string => (
  `${getBeachLocalePrefix(language)}/beaches/${encodeURIComponent(getRegionUrlSlug(region))}/${beach.id}-${normalizeBeachSlug(getBeachUrlName(beach))}/`
);

export const parseBeachRegionPath = (pathname?: string): BeachRegionRoute | null => {
  const rawPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const language = getBeachPathLanguage(rawPathname);
  const match = stripBeachLocalePrefix(rawPathname).match(BEACH_REGION_ROUTE_PATTERN);
  if (!match) return null;

  return {
    regionId: decodeURIComponent(match[1]),
    language,
  };
};

export const parseBeachDetailPath = (pathname?: string): BeachDetailRoute | null => {
  const rawPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const language = getBeachPathLanguage(rawPathname);
  const match = stripBeachLocalePrefix(rawPathname).match(BEACH_DETAIL_ROUTE_PATTERN);
  if (!match) return null;

  const beachId = Number(match[2]);
  if (!Number.isInteger(beachId)) return null;

  return {
    regionId: decodeURIComponent(match[1]),
    beachId,
    slug: match[3] ? decodeURIComponent(match[3]) : undefined,
    language,
  };
};

export const buildBeachShareUrl = (origin: string, regionId: string, beach: BeachUrlBeach): string => (
  `${origin}${buildBeachDetailPath(regionId, beach)}`
);
