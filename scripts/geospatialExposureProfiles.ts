import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  assessGeospatialWindExposure,
  computeDirectionalExposure,
  computeShorelineOrientation,
  onshoreComponent,
  resolveNearshoreWaterOrigin,
  type GeoPoint,
  type LandMask,
} from '../utils/geospatialExposureModel';

type Coordinates = { lat: number; lon: number };

type BeachRecord = {
  id: number;
  name?: { en?: string; gr?: string };
  coordinates?: Coordinates;
};

type AppRegionPayload = {
  region?: {
    id?: string;
    name?: { en?: string; gr?: string };
  };
  island?: {
    id?: string;
    name?: { en?: string; gr?: string };
    beaches?: BeachRecord[];
  };
};

type GeoJsonPosition = [number, number];
type GeoJsonRing = GeoJsonPosition[];
type GeoJsonPolygon = GeoJsonRing[];
type GeoJsonMultiPolygon = GeoJsonPolygon[];

type GeoJsonFeature = {
  type: 'Feature';
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: GeoJsonPolygon | GeoJsonMultiPolygon;
  };
};

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

type Ring = GeoPoint[];

type IndexedPolygon = {
  outer: Ring;
  holes: Ring[];
  bbox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
};

type Sector = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

type SectorExposure = {
  level: 'protected' | 'partial' | 'exposed';
  fetchKm: number;
  blockedRayRatio: number;
  onshore?: number;
  intensity?: number;
};

type BeachExposureProfile = {
  beachId: number;
  name: {
    en: string;
    gr: string;
  };
  coordinates: Coordinates;
  facingDeg: number | null;
  sectors: Record<Sector, SectorExposure>;
  confidence: 'low' | 'medium' | 'high';
};

const root = process.cwd();
const naturalEarthLandUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson';
const defaultLandGeoJsonPath = path.join(root, '.tmp', 'geospatial', 'ne_10m_land.geojson');
const defaultOutputDirectory = path.join(root, 'public', 'data', 'geospatial', 'exposure');

const greeceBounds = {
  minLat: 33,
  maxLat: 43,
  minLon: 18,
  maxLon: 31,
};

const sectors: Array<{ key: Sector; degrees: number }> = [
  { key: 'N', degrees: 0 },
  { key: 'NE', degrees: 45 },
  { key: 'E', degrees: 90 },
  { key: 'SE', degrees: 135 },
  { key: 'S', degrees: 180 },
  { key: 'SW', degrees: 225 },
  { key: 'W', degrees: 270 },
  { key: 'NW', degrees: 315 },
];

const maxFetchKm = 25;
const stepKm = 0.5;
const nearshoreLandGraceKm = 0.3;
const nearshoreWaterSearchKm = 12;
const nearshoreWaterSearchStepKm = 0.5;
const fanAnglesDeg = [-30, -15, 0, 15, 30];

// When a higher-resolution coastline is supplied via --land-geojson the fetch
// rays can be sampled finer and trust nearby land, because the geometry no
// longer suffers from the ~hundreds-of-metres generalisation of Natural Earth.
const highResStepKm = 0.2;
const highResNearshoreLandGraceKm = 0.1;

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const shouldDownload = !process.argv.includes('--no-download');
const customLandGeoJson = parseArgValue('--land-geojson');
const landGeoJsonPath = path.resolve(customLandGeoJson || defaultLandGeoJsonPath);
const outputDirectory = path.resolve(parseArgValue('--output-dir') || defaultOutputDirectory);
// A custom --land-geojson is treated as the high-resolution coastline upgrade
// (OSM land polygons / GSHHG full, clipped to Greece). Without it we fall back
// to the bundled Natural Earth baseline so automated runs never break.
const isHighResMask = Boolean(customLandGeoJson);
// Optional region filter for pilot runs, e.g. --region cyclades or
// --region south-aegean,central-greece (matched against the region id).
const regionFilter = (parseArgValue('--region') || '')
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean);

const ensureParentDirectory = (filePath: string) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
};

const downloadFile = async (url: string, targetPath: string) => {
  ensureParentDirectory(targetPath);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CalmBeachGeospatialExposureBuilder/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  writeFileSync(targetPath, body, 'utf8');
};

const intersectsGreeceBounds = (bbox: IndexedPolygon['bbox']): boolean => (
  bbox.maxLat >= greeceBounds.minLat &&
  bbox.minLat <= greeceBounds.maxLat &&
  bbox.maxLon >= greeceBounds.minLon &&
  bbox.minLon <= greeceBounds.maxLon
);

const ringFromGeoJson = (ring: GeoJsonRing): Ring => ring.map(([lon, lat]) => ({ lat, lon }));

const getRingBbox = (ring: Ring): IndexedPolygon['bbox'] => ring.reduce((bbox, point) => ({
  minLat: Math.min(bbox.minLat, point.lat),
  maxLat: Math.max(bbox.maxLat, point.lat),
  minLon: Math.min(bbox.minLon, point.lon),
  maxLon: Math.max(bbox.maxLon, point.lon),
}), {
  minLat: Number.POSITIVE_INFINITY,
  maxLat: Number.NEGATIVE_INFINITY,
  minLon: Number.POSITIVE_INFINITY,
  maxLon: Number.NEGATIVE_INFINITY,
});

const indexPolygon = (polygon: GeoJsonPolygon): IndexedPolygon | undefined => {
  const [outerRing, ...holeRings] = polygon;
  if (!outerRing || outerRing.length < 4) return undefined;

  const outer = ringFromGeoJson(outerRing);
  const indexed = {
    outer,
    holes: holeRings.map(ringFromGeoJson),
    bbox: getRingBbox(outer),
  };

  return intersectsGreeceBounds(indexed.bbox) ? indexed : undefined;
};

const loadLandPolygons = (geoJsonPath: string): IndexedPolygon[] => {
  const payload = JSON.parse(readFileSync(geoJsonPath, 'utf8')) as GeoJsonFeatureCollection;
  const polygons: IndexedPolygon[] = [];

  payload.features.forEach(feature => {
    if (!feature.geometry) return;

    if (feature.geometry.type === 'Polygon') {
      const indexed = indexPolygon(feature.geometry.coordinates as GeoJsonPolygon);
      if (indexed) polygons.push(indexed);
      return;
    }

    (feature.geometry.coordinates as GeoJsonMultiPolygon).forEach(polygon => {
      const indexed = indexPolygon(polygon);
      if (indexed) polygons.push(indexed);
    });
  });

  return polygons;
};

const pointInRing = (point: GeoPoint, ring: Ring): boolean => {
  let inside = false;
  const x = point.lon;
  const y = point.lat;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lon;
    const yi = ring[i].lat;
    const xj = ring[j].lon;
    const yj = ring[j].lat;
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
};

const createLandMask = (
  polygons: IndexedPolygon[],
  source: string,
  confidence: 'low' | 'medium' | 'high'
): LandMask => ({
  source,
  confidence,
  isLand: point => polygons.some(polygon => {
    if (
      point.lat < polygon.bbox.minLat ||
      point.lat > polygon.bbox.maxLat ||
      point.lon < polygon.bbox.minLon ||
      point.lon > polygon.bbox.maxLon
    ) {
      return false;
    }

    if (!pointInRing(point, polygon.outer)) return false;
    return !polygon.holes.some(hole => pointInRing(point, hole));
  }),
});

const loadAppRegions = (): Array<{ regionId: string; regionName: string; beaches: BeachRecord[] }> => {
  const appDataDirectory = path.join(root, 'public', 'data', 'beaches', 'app');
  const files = readdirJson(appDataDirectory);

  return files.flatMap(fileName => {
    const payload = JSON.parse(readFileSync(path.join(appDataDirectory, fileName), 'utf8')) as AppRegionPayload;
    const regionId = payload.region?.id || payload.island?.id || fileName.replace(/\.json$/, '');
    const regionName = payload.region?.name?.en || payload.island?.name?.en || regionId;
    const beaches = payload.island?.beaches || [];
    return beaches.length > 0 ? [{ regionId, regionName, beaches }] : [];
  });
};

const readdirJson = (directory: string): string[] => {
  return readdirSync(directory)
    .filter(fileName => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));
};

const createBeachProfile = (
  beach: BeachRecord,
  landMask: LandMask,
  rayStepKm: number,
  landGraceKm: number
): BeachExposureProfile | undefined => {
  if (!beach.coordinates) return undefined;

  const sampleOrigin = resolveNearshoreWaterOrigin(
    beach.coordinates,
    landMask,
    nearshoreWaterSearchKm,
    nearshoreWaterSearchStepKm
  );

  const facingDeg = computeShorelineOrientation(sampleOrigin.point, landMask);

  const sectorProfiles = sectors.reduce((accumulator, sector) => {
    const result = assessGeospatialWindExposure({
      beach: beach.coordinates as Coordinates,
      windDirectionDeg: sector.degrees,
      landMask,
      maxFetchKm,
      stepKm: rayStepKm,
      nearshoreLandGraceKm: landGraceKm,
      nearshoreWaterSearchKm,
      nearshoreWaterSearchStepKm,
      sampleOrigin: sampleOrigin.point,
      sampleOriginAdjustedKm: sampleOrigin.adjustedKm,
      fanAnglesDeg,
    });

    // With a known shoreline normal the onshore/offshore component gates the
    // exposure; without it we fall back to the raw fetch-based classification.
    if (facingDeg !== null) {
      const onshore = onshoreComponent(sector.degrees, facingDeg);
      const directional = computeDirectionalExposure({
        fetchKm: result.openWaterFetchKm,
        blockedRayRatio: result.blockedRayRatio,
        onshore,
      });
      accumulator[sector.key] = {
        level: directional.level,
        fetchKm: result.openWaterFetchKm,
        blockedRayRatio: result.blockedRayRatio,
        onshore: Number(onshore.toFixed(3)),
        intensity: directional.intensity,
      };
    } else {
      accumulator[sector.key] = {
        level: result.exposureLevel,
        fetchKm: result.openWaterFetchKm,
        blockedRayRatio: result.blockedRayRatio,
      };
    }

    return accumulator;
  }, {} as Record<Sector, SectorExposure>);

  return {
    beachId: beach.id,
    name: {
      en: beach.name?.en || String(beach.id),
      gr: beach.name?.gr || beach.name?.en || String(beach.id),
    },
    coordinates: beach.coordinates,
    facingDeg,
    sectors: sectorProfiles,
    confidence: landMask.confidence,
  };
};

const summarizeRegion = (profiles: BeachExposureProfile[]) => {
  const sectorSummary = sectors.reduce((accumulator, sector) => {
    accumulator[sector.key] = { protected: 0, partial: 0, exposed: 0 };
    return accumulator;
  }, {} as Record<Sector, Record<'protected' | 'partial' | 'exposed', number>>);

  profiles.forEach(profile => {
    sectors.forEach(sector => {
      sectorSummary[sector.key][profile.sectors[sector.key].level] += 1;
    });
  });

  return sectorSummary;
};

const main = async () => {
  if (!existsSync(landGeoJsonPath)) {
    if (!shouldDownload) {
      throw new Error(`Land GeoJSON not found: ${landGeoJsonPath}`);
    }
    await downloadFile(naturalEarthLandUrl, landGeoJsonPath);
  }

  const polygons = loadLandPolygons(landGeoJsonPath);
  if (polygons.length === 0) {
    throw new Error('No Greece-area land polygons were indexed from the land mask.');
  }

  const maskSource = isHighResMask
    ? `High-resolution coastline (${path.basename(landGeoJsonPath)})`
    : 'Natural Earth 1:10m land polygons';
  // The geometry-derived shoreline normal + onshore/offshore reasoning make the
  // baseline far more reliable than raw fetch buckets, so Natural Earth is now
  // 'medium' rather than 'low'; a supplied high-res coastline earns 'high'.
  const maskConfidence: 'low' | 'medium' | 'high' = isHighResMask ? 'high' : 'medium';
  const rayStepKm = isHighResMask ? highResStepKm : stepKm;
  const landGraceKm = isHighResMask ? highResNearshoreLandGraceKm : nearshoreLandGraceKm;

  const landMask = createLandMask(polygons, maskSource, maskConfidence);
  const regions = loadAppRegions().filter(region => (
    regionFilter.length === 0 || regionFilter.some(filter => region.regionId.toLowerCase().includes(filter))
  ));
  if (regions.length === 0) {
    throw new Error(`No app regions matched the --region filter: ${regionFilter.join(', ')}`);
  }
  const summaryByRegion: Record<string, {
    regionName: string;
    beachCount: number;
    generatedProfiles: number;
    missingCoordinates: number;
    sectors: ReturnType<typeof summarizeRegion>;
  }> = {};
  let totalBeachCount = 0;
  let totalProfiles = 0;
  let totalMissingCoordinates = 0;

  regions.forEach(region => {
    const profiles: BeachExposureProfile[] = [];
    totalBeachCount += region.beaches.length;

    region.beaches.forEach(beach => {
      const profile = createBeachProfile(beach, landMask, rayStepKm, landGraceKm);
      if (!profile) {
        totalMissingCoordinates += 1;
        return;
      }
      profiles.push(profile);
    });

    totalProfiles += profiles.length;
    const regionPayload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      region: {
        id: region.regionId,
        name: region.regionName,
      },
      source: {
        indexPath: '/data/geospatial/exposure/index.json',
      },
      settings: {
        maxFetchKm,
        stepKm: rayStepKm,
        nearshoreLandGraceKm: landGraceKm,
        nearshoreWaterSearchKm,
        nearshoreWaterSearchStepKm,
        fanAnglesDeg,
        sectors: sectors.map(sector => sector.key),
        maskSource,
        maskConfidence,
      },
      summary: {
        beachCount: region.beaches.length,
        generatedProfiles: profiles.length,
        missingCoordinates: region.beaches.length - profiles.length,
        sectors: summarizeRegion(profiles),
      },
      profiles: Object.fromEntries(
        profiles.map(profile => [String(profile.beachId), profile])
      ),
    };

    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(
      path.join(outputDirectory, `${region.regionId}.json`),
      `${JSON.stringify(regionPayload, null, 2)}\n`,
      'utf8'
    );
    summaryByRegion[region.regionId] = {
      regionName: region.regionName,
      beachCount: region.beaches.length,
      generatedProfiles: profiles.length,
      missingCoordinates: region.beaches.length - profiles.length,
      sectors: summarizeRegion(profiles),
    };
  });

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'Offline directional geospatial exposure baseline for CalmBeach. Not user-facing proof of calm/protected conditions.',
    source: {
      landMask: {
        name: maskSource,
        url: isHighResMask ? landGeoJsonPath : naturalEarthLandUrl,
        license: 'Public domain / open data',
        confidence: maskConfidence,
        notes: isHighResMask
          ? 'High-resolution coastline upgrade supplied via --land-geojson. Resolves headlands, islets and coves at beach scale.'
          : 'Baseline all-Greece land mask, refined by geometry-derived shoreline orientation and onshore/offshore reasoning. Supply --land-geojson for high-detail island/cove decisions.',
      },
      appBeachData: '/public/data/beaches/app/*.json',
    },
    settings: {
      maxFetchKm,
      stepKm: rayStepKm,
      nearshoreLandGraceKm: landGraceKm,
      nearshoreWaterSearchKm,
      nearshoreWaterSearchStepKm,
      fanAnglesDeg,
      sectors: sectors.map(sector => sector.key),
      maskSource,
      maskConfidence,
    },
    summary: {
      regionCount: regions.length,
      beachCount: totalBeachCount,
      generatedProfiles: totalProfiles,
      missingCoordinates: totalMissingCoordinates,
      indexedLandPolygons: polygons.length,
      regions: summaryByRegion,
    },
  };

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, 'index.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    outputDirectory,
    indexPath: path.join(outputDirectory, 'index.json'),
    regionCount: regions.length,
    beachCount: totalBeachCount,
    generatedProfiles: totalProfiles,
    missingCoordinates: totalMissingCoordinates,
    indexedLandPolygons: polygons.length,
  }, null, 2));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
