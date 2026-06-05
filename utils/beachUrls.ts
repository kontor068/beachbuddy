import type { Beach } from '../types';

export interface BeachDetailRoute {
  regionId: string;
  beachId: number;
  slug?: string;
}

export interface BeachRegionRoute {
  regionId: string;
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

export const buildBeachRegionPath = (region: BeachRegionUrlRegion | string): string => (
  `/beaches/${encodeURIComponent(getRegionUrlSlug(region))}/`
);

export const buildBeachDetailPath = (region: BeachRegionUrlRegion | string, beach: BeachUrlBeach): string => (
  `/beaches/${encodeURIComponent(getRegionUrlSlug(region))}/${beach.id}-${normalizeBeachSlug(getBeachUrlName(beach))}/`
);

export const parseBeachRegionPath = (pathname?: string): BeachRegionRoute | null => {
  const rawPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const match = rawPathname.match(BEACH_REGION_ROUTE_PATTERN);
  if (!match) return null;

  return {
    regionId: decodeURIComponent(match[1]),
  };
};

export const parseBeachDetailPath = (pathname?: string): BeachDetailRoute | null => {
  const rawPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const match = rawPathname.match(BEACH_DETAIL_ROUTE_PATTERN);
  if (!match) return null;

  const beachId = Number(match[2]);
  if (!Number.isInteger(beachId)) return null;

  return {
    regionId: decodeURIComponent(match[1]),
    beachId,
    slug: match[3] ? decodeURIComponent(match[3]) : undefined,
  };
};

export const buildBeachShareUrl = (origin: string, regionId: string, beach: BeachUrlBeach): string => (
  `${origin}${buildBeachDetailPath(regionId, beach)}`
);
