import type { Beach, Island } from '../types';
import type { RawBeach } from './beachService';
import regionDisplayNames from '../utils/regionDisplayNames.json';
import { getGreekBeachNameDisplay } from '../utils/greekBeachNames';
import { getActiveWeatherFixtureTargetRegionId } from '../utils/weatherFixtures';
import { parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from '../utils/beachUrls';

export interface BeachRegionIndexEntry {
  id: string;
  region: string;
  prefecture: string;
  beachCount: number;
  coordinates: { lat: number; lon: number };
  dataPath: string;
  appDataPath?: string;
  summaryDataPath?: string;
  detailDataPath?: string;
  name?: Island['name'];
  group?: Island['group'];
}

interface BeachRegionIndexPayload {
  regions?: BeachRegionIndexEntry[];
}

interface AppBeachRegionPayload {
  schemaVersion?: number;
  island?: Island;
}

type BeachDetailData = Partial<Beach> & { id: number };

interface AppBeachDetailPayload {
  beaches?: BeachDetailData[];
}

const BEACH_REGION_INDEX_PATH = '/data/beaches/index.json';
let beachRegionIndexPromise: Promise<BeachRegionIndexEntry[]> | null = null;

type RegionDisplayName = Partial<Island['name']> & { en?: string; gr?: string };

const REGION_DISPLAY_NAMES = regionDisplayNames as Record<string, RegionDisplayName>;
const hasGreekText = (value?: string): boolean => /[\u0370-\u03ff]/.test(value || '');

const makeFallbackName = (value: string): Island['name'] => ({
  en: value,
  gr: value,
  fr: value,
  de: value,
  it: value,
});

const getRegionDisplayName = (
  entry: Pick<BeachRegionIndexEntry, 'id' | 'prefecture'> & { name?: Island['name'] }
): Island['name'] => {
  const fallback = entry.name || makeFallbackName(entry.prefecture);
  const displayName = REGION_DISPLAY_NAMES[entry.id];

  if (!displayName) {
    return fallback;
  }

  const englishName = displayName.en || fallback.en || entry.prefecture;
  const greekName = hasGreekText(fallback.gr) && fallback.gr !== fallback.en
    ? fallback.gr
    : displayName.gr || fallback.gr || englishName;

  return {
    en: englishName,
    gr: greekName,
    fr: displayName.fr || fallback.fr || englishName,
    de: displayName.de || fallback.de || englishName,
    it: displayName.it || fallback.it || englishName,
  };
};

const applyRegionDisplayName = (island: Island, regionId: string): Island => ({
  ...island,
  name: getRegionDisplayName({
    id: regionId,
    prefecture: island.name?.en || regionId,
    name: island.name,
  }),
});

const normalizeGreekBeachDisplayNames = (island: Island): Island => ({
  ...island,
  beaches: island.beaches.map(beach => ({
    ...beach,
    name: {
      ...beach.name,
      gr: getGreekBeachNameDisplay(beach.name.gr, beach.name.en),
    },
  })),
});

const mapRegionToGroup = (region: string | null, subRegion: string | null): Island['group'] => {
  const r = (region || '').toLowerCase().trim();
  const s = (subRegion || '').toLowerCase().trim();

  const cyclades = ['milos', 'santorini', 'mykonos', 'paros', 'naxos', 'syros', 'tinos', 'andros', 'sifnos', 'serifos', 'kythnos', 'kea', 'amorgos', 'ios', 'folegandros', 'koufonisia', 'donousa', 'schinoussa', 'iraklia', 'kimolos', 'polyaigos', 'sikinos', 'anafi', 'antiparos'];
  if (cyclades.includes(s) || s.includes('kykladon') || r.includes('cyclades')) return 'cyclades';
  if (r.includes('dodecanese') || s.includes('dodecanese')) return 'dodecanese';
  if (r.includes('ionian')) return 'ionian';
  if (r.includes('sporades')) return 'sporades';
  if (r.includes('crete')) return 'crete';
  if (r.includes('attica') || s.includes('attica') || s.includes('athens') || s.includes('piraeus')) return 'attica';
  if (r.includes('evia') || s.includes('evia') || s.includes('euboea')) return 'euboea';
  if (r.includes('peloponnese')) return 'mainland_peloponnese';
  if (r.includes('thessaly')) return 'mainland_thessaly';
  if (r.includes('epirus')) return 'mainland_epirus';
  if (r.includes('thrace')) return 'mainland_thrace';
  if (r.includes('macedonia')) return 'mainland_macedonia';
  if (r.includes('central greece') || r.includes('west greece')) return 'mainland_central';
  return 'mainland_central';
};

const isValidIndexEntry = (entry: BeachRegionIndexEntry): boolean => Boolean(
  entry &&
  typeof entry.id === 'string' &&
  typeof entry.region === 'string' &&
  typeof entry.prefecture === 'string' &&
  typeof entry.beachCount === 'number' &&
  entry.coordinates &&
  Number.isFinite(entry.coordinates.lat) &&
  Number.isFinite(entry.coordinates.lon) &&
  typeof entry.dataPath === 'string'
);

const isUsableIsland = (value: unknown): value is Island => {
  const island = value as Partial<Island>;
  return Boolean(
    island &&
    typeof island.id === 'string' &&
    island.name &&
    typeof island.name.en === 'string' &&
    typeof island.name.gr === 'string' &&
    island.coordinates &&
    Number.isFinite(island.coordinates.lat) &&
    Number.isFinite(island.coordinates.lon) &&
    Array.isArray(island.beaches)
  );
};

export const buildIslandShellFromIndexEntry = (entry: BeachRegionIndexEntry): Island => ({
  id: entry.id,
  name: getRegionDisplayName(entry),
  group: entry.group || mapRegionToGroup(entry.region, entry.prefecture),
  coordinates: entry.coordinates,
  beaches: [],
});

export const getPreferredInitialRegionId = (islands: Island[]): string | undefined => {
  const route = parseBeachDetailPath() || parseBeachRegionPath();
  if (route) {
    const routeIsland = islands.find(island => regionMatchesRouteParam(island, route.regionId));
    if (routeIsland) return routeIsland.id;
  }

  const fixtureRegionId = getActiveWeatherFixtureTargetRegionId();
  if (fixtureRegionId && islands.some(island => island.id === fixtureRegionId)) {
    return fixtureRegionId;
  }

  const savedRegionId = localStorage.getItem('selectedIslandId') || undefined;
  if (savedRegionId && islands.some(island => island.id === savedRegionId)) {
    return savedRegionId;
  }

  return islands.find(island => island.id === 'milos' || island.id.endsWith('-milos') || island.name.en === 'Milos')?.id
    || islands[0]?.id;
};

export const loadBeachRegionIndex = (): Promise<BeachRegionIndexEntry[]> => {
  if (!beachRegionIndexPromise) {
    beachRegionIndexPromise = (async () => {
      const response = await fetch(BEACH_REGION_INDEX_PATH);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${BEACH_REGION_INDEX_PATH}: ${response.status}`);
      }

      const payload = await response.json() as BeachRegionIndexPayload;
      if (!Array.isArray(payload.regions)) {
        throw new Error(`${BEACH_REGION_INDEX_PATH} is missing regions[]`);
      }

      return payload.regions.filter(isValidIndexEntry);
    })().catch(error => {
      beachRegionIndexPromise = null;
      throw error;
    });
  }

  return beachRegionIndexPromise;
};

const fetchAppReadyRegion = async (dataPath: string, regionId: string): Promise<Island> => {
  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${dataPath}: ${response.status}`);
  }

  const payload = await response.json() as AppBeachRegionPayload;
  if (!isUsableIsland(payload.island)) {
    throw new Error(`${dataPath} is missing a usable island payload`);
  }

  return normalizeGreekBeachDisplayNames(applyRegionDisplayName(payload.island, regionId));
};

export const loadAppReadyRegion = async (
  regionId: string,
  paths?: Pick<BeachRegionIndexEntry, 'summaryDataPath' | 'appDataPath'>
): Promise<Island> => {
  const summaryPath = paths?.summaryDataPath || `/data/beaches/app/summary/${encodeURIComponent(regionId)}.json`;

  try {
    return await fetchAppReadyRegion(summaryPath, regionId);
  } catch (summaryError) {
    const legacyPath = paths?.appDataPath || `/data/beaches/app/${encodeURIComponent(regionId)}.json`;
    console.warn('Summary beach region unavailable; falling back to combined app-ready data.', {
      regionId,
      summaryError,
    });
    return fetchAppReadyRegion(legacyPath, regionId);
  }
};

export const loadBeachDetailData = async (
  regionId: string,
  beachId: number,
  detailDataPath?: string
): Promise<BeachDetailData> => {
  const dataPath = detailDataPath || `/data/beaches/app/detail/${encodeURIComponent(regionId)}.json`;
  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${dataPath}: ${response.status}`);
  }

  const payload = await response.json() as AppBeachDetailPayload;
  if (!Array.isArray(payload.beaches)) {
    throw new Error(`${dataPath} is missing beaches[]`);
  }

  const detail = payload.beaches.find(beach => beach.id === beachId);
  if (!detail) {
    throw new Error(`${dataPath} is missing detail for beach ${beachId}`);
  }

  return detail;
};

export const mergeBeachDetailData = (summary: Beach, detail: BeachDetailData): Beach => {
  const mergedName = { ...summary.name, ...(detail.name || {}) };

  return {
    ...summary,
    ...detail,
    name: {
      ...mergedName,
      gr: getGreekBeachNameDisplay(mergedName.gr, mergedName.en),
    },
    description: { ...summary.description, ...(detail.description || {}) },
    detailedDescription: detail.detailedDescription || summary.detailedDescription,
    accessNotes: detail.accessNotes || summary.accessNotes,
    protectedFrom: detail.protectedFrom || summary.protectedFrom,
    orientation: detail.orientation || summary.orientation,
    amenities: { ...summary.amenities, ...(detail.amenities || {}) },
    characteristics: { ...summary.characteristics, ...(detail.characteristics || {}) },
    activities: { ...summary.activities, ...(detail.activities || {}) },
    environment: { ...summary.environment, ...(detail.environment || {}) },
    coordinates: detail.coordinates || summary.coordinates,
    mapCoordinates: detail.mapCoordinates || summary.mapCoordinates,
    metadata: detail.metadata || summary.metadata,
  };
};

export const loadRawRegionBeaches = async (regionId: string): Promise<RawBeach[]> => {
  const dataPath = `/data/beaches/${encodeURIComponent(regionId)}.json`;
  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${dataPath}: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`${dataPath} is not a beach array`);
  }

  return payload as RawBeach[];
};
