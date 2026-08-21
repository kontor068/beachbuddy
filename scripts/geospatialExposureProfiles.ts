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

// Rings are stored as packed [lon0, lat0, lon1, lat1, ...] arrays: ~10x less
// memory than per-vertex objects and cache-friendly for point-in-polygon, which
// is what makes a multi-million-vertex OSM coastline mask tractable.
type FlatRing = Float64Array;

type IndexedPolygon = {
  outer: FlatRing;
  holes: FlatRing[];
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
  /**
   * Το ψημένο σημείο θαλάσσιας δειγματοληψίας ΔΕΝ παράγεται εδώ (το γράφει
   * scripts/bakeMarineSamplePoints). Δηλώνεται μόνο για να μπορεί να μεταφερθεί αυτούσιο από το
   * προηγούμενο αρχείο — δες `carriedMarineSamplePoints` στη main().
   */
  marineSamplePoint?: unknown;
};

/** Ανάλυση της λεπτής βεντάλιας: 24 τιμές ανά 15°. */
const ARRIVAL_FAN_STEP_DEG = 15;
const ARRIVAL_FAN_SLOTS = 360 / ARRIVAL_FAN_STEP_DEG;
/**
 * 50 μ. βήμα ακτίνας — δες το σχόλιο του `arrivalFanKm`. Είναι η ανάλυση στην οποία σταματάει να
 * αξίζει: κάτω από αυτήν μιλάμε για λεπτομέρεια μικρότερη από την ίδια την ακτογραμμή του OSM,
 * και ένα ακρωτήρι 50 μ. δεν σταματάει κύμα ούτως ή άλλως.
 */
const ARRIVAL_FAN_STEP_KM = 0.05;

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
// The water-origin search must also tighten: with a precise mask most beach
// pins fall on the sand (land), and a 0.5 km first jump can cross to the wrong
// side of a headland and flip the derived facing direction.
const highResStepKm = 0.2;
const highResNearshoreLandGraceKm = 0.1;
const highResNearshoreWaterSearchStepKm = 0.1;
// Candidate origins must connect to real open water; enclosed inland water
// (lagoons behind a beach, carved as holes in high-res land polygons) would
// otherwise capture the origin and report a fully-blocked profile.
const nearshoreMinOpenWaterKm = 0.5;

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

/**
 * ΤΟ ΑΝΟΙΓΜΑ ΚΑΘΕ 15°, ΟΧΙ ΚΑΘΕ 45°. 24 τιμές ανά παραλία, δείκτης = μοίρες / 15 (0 = Βορράς),
 * σε χιλιόμετρα ανοιχτού νερού πριν τη στεριά με ταβάνι `maxFetchKm`.
 *
 * ⛔ ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ ΩΣ ΚΑΝΟΝΑΣ (16/08/2026) — γι' αυτό γράφεται σε ΔΙΚΟ ΤΟΥ αρχείο,
 * εκτός `public/`, και δεν φτάνει σε κανέναν επισκέπτη. Η ιδέα ήταν: αν η γωνία απ' όπου δηλώνει
 * το πλέγμα ότι έρχεται το κύμα βρίσκει στεριά, το κύμα δεν μπορεί να είναι εδώ. Εθνική μέτρηση
 * (2.869 παραλίες × 14 ώρες, `scripts/sweepBlockedArrivalThresholds.mjs`): άναβε σε 20.311 από
 * 40.166 ώρες και γύριζε 2.217 χρώματα πινέζας προς το ηρεμότερο. Ο λόγος είναι δομικός — κάθε
 * παραλία έχει στεριά στη μισή πυξίδα (2.785/2.869 έχουν ≥12 από 24 γωνίες κλειστές), οπότε το
 * «έχει στεριά προς τα εκεί» δεν διακρίνει τίποτα. Κάθε αυστηρότερη ρύθμιση που έριχνε τον
 * αντίκτυπο σταματούσε να διορθώνει την ίδια τη Λυγαριά. Πλήρης καταγραφή: βίβλος §Μ6.
 *
 * ΤΙ ΜΕΝΕΙ ΧΡΗΣΙΜΟ, και γι' αυτό ο κώδικας δεν σβήστηκε: είναι η μόνη περιγραφή της γεωμετρίας
 * μας σε ανάλυση 15°/50 μ., και είναι αυτή που ΑΠΕΔΕΙΞΕ ότι οι 8 φέτες πηδάνε πάνω από ακρωτήρια
 * λεπτότερα από το βήμα τους (Λυγαριά 345°: λωρίδα στεριάς 100 μ. στα 0,22-0,32 χλμ, βήμα 200 μ.,
 * αποτέλεσμα «ανοιχτή θάλασσα 25 χλμ»). Οι φέτες παραμένουν αλιασμένες — δείχνουν τις παραλίες
 * πιο ΑΝΟΙΧΤΕΣ απ' ό,τι είναι — και δεν αλλάζουν χωρίς δική τους εθνική μέτρηση, γιατί τροφοδοτούν
 * το χρώμα ολόκληρης της χώρας.
 *
 *   node scripts/buildGeospatialExposureProfiles.mjs --land-geojson <mask> --no-download  *     --arrival-fan reports/geometry/arrival-fan
 */
const arrivalFanDirectory = parseArgValue('--arrival-fan');
const arrivalFans: Map<number, number[]> | undefined = arrivalFanDirectory ? new Map() : undefined;

/**
 * ΠΕΙΡΑΜΑΤΙΚΑ ΜΟΝΟ — για να μπορεί να μετρηθεί το κόστος του βήματος των ακτίνων χωρίς να αλλάξει
 * τίποτα στα δεδομένα που στέλνονται. Τρέξε σε ΞΕΧΩΡΙΣΤΟ `--output-dir` και σύγκρινε.
 * Το `--land-grace-km` υπάρχει επειδή η συγχώρεση στεριάς είναι ΑΔΡΑΝΗΣ όσο είναι μικρότερη από το
 * βήμα (δες τη σημείωση πάνω από το sampleFetchRay): αν κατεβάσεις μόνο το βήμα, η συγχώρεση
 * ξαφνικά ενεργοποιείται και το πείραμα μετράει δύο αλλαγές αντί για μία.
 */
const rayStepOverrideKm = Number(parseArgValue('--ray-step-km'));
const landGraceOverrideKm = Number(parseArgValue('--land-grace-km'));
/**
 * ΠΕΙΡΑΜΑΤΙΚΑ ΜΟΝΟ, ΤΟ ΙΔΙΟ — η ΑΦΕΤΗΡΙΑ των ακτίνων (βίβλος §Μ5/§Μ9), που είναι ΑΛΛΟ πρόβλημα από
 * το βήμα παραπάνω και έχει ΑΝΤΙΘΕΤΗ ετυμηγορία στον δεύτερο μάρτυρα (§Μ7: 99,1% θόρυβος για το
 * βήμα · §Μ9: 90,4% πραγματικοί βραχίονες για την αφετηρία).
 *
 * Τα δύο πηγαίνουν ΜΑΖΙ και γι' αυτό είναι δύο σημαίες, όχι μία: το `--water-search-step-km`
 * κατεβάζει το βήμα με το οποίο ψάχνουμε νερό γύρω από την πινέζα (0,1 χλμ. σήμερα — το νερό του
 * όρμου στο Μπάλι είναι στα 30-60 μ., δηλαδή ΜΕΣΑ στο πρώτο βήμα και δεν δοκιμάζεται ποτέ), ενώ το
 * `--min-open-water-km` χαλαρώνει τη ΔΕΥΤΕΡΗ πύλη, που απαιτεί ο υποψήφιος να κουβαλάει 0,5 χλμ.
 * συνεχόμενο ανοιχτό νερό — και που από μόνη της σπρώχνει την αφετηρία έξω από κάθε στενό όρμο,
 * όσο λεπτά κι αν ψάξεις.
 *
 * ⚠️ ΟΙ ΠΡΟΕΠΙΛΟΓΕΣ ΔΕΝ ΑΓΓΙΖΟΝΤΑΙ. Χωρίς σημαία, το build βγάζει ό,τι έβγαζε χθες.
 */
const waterSearchStepOverrideKm = Number(parseArgValue('--water-search-step-km'));
const minOpenWaterOverrideKm = Number(parseArgValue('--min-open-water-km'));

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

const ringFromGeoJson = (ring: GeoJsonRing): FlatRing => {
  const flat = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i += 1) {
    flat[i * 2] = ring[i][0];
    flat[i * 2 + 1] = ring[i][1];
  }
  return flat;
};

const getRingBbox = (ring: FlatRing): IndexedPolygon['bbox'] => {
  const bbox = {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLon: Number.POSITIVE_INFINITY,
    maxLon: Number.NEGATIVE_INFINITY,
  };
  for (let i = 0; i < ring.length; i += 2) {
    const lon = ring[i];
    const lat = ring[i + 1];
    if (lat < bbox.minLat) bbox.minLat = lat;
    if (lat > bbox.maxLat) bbox.maxLat = lat;
    if (lon < bbox.minLon) bbox.minLon = lon;
    if (lon > bbox.maxLon) bbox.maxLon = lon;
  }
  return bbox;
};

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

const pointInRing = (point: GeoPoint, ring: FlatRing): boolean => {
  let inside = false;
  const x = point.lon;
  const y = point.lat;
  const vertexCount = ring.length / 2;

  for (let i = 0, j = vertexCount - 1; i < vertexCount; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
};

const pointInPolygon = (point: GeoPoint, polygon: IndexedPolygon): boolean => {
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
};

// Sparse grid over the Greece bounds mapping cell -> polygons whose bbox
// touches it, so each isLand call tests a handful of candidate polygons
// instead of scanning the whole mask. With a split OSM coastline (thousands
// of small polygons) this is the difference between minutes and hours.
const GRID_CELL_DEG = 0.05;

type PolygonGridIndex = {
  cols: number;
  rows: number;
  cells: Map<number, number[]>;
};

const gridCol = (lon: number): number => Math.floor((lon - greeceBounds.minLon) / GRID_CELL_DEG);
const gridRow = (lat: number): number => Math.floor((lat - greeceBounds.minLat) / GRID_CELL_DEG);

const buildPolygonGridIndex = (polygons: IndexedPolygon[]): PolygonGridIndex => {
  const cols = Math.ceil((greeceBounds.maxLon - greeceBounds.minLon) / GRID_CELL_DEG);
  const rows = Math.ceil((greeceBounds.maxLat - greeceBounds.minLat) / GRID_CELL_DEG);
  const cells = new Map<number, number[]>();

  polygons.forEach((polygon, polygonIndex) => {
    const minCol = Math.max(0, gridCol(polygon.bbox.minLon));
    const maxCol = Math.min(cols - 1, gridCol(polygon.bbox.maxLon));
    const minRow = Math.max(0, gridRow(polygon.bbox.minLat));
    const maxRow = Math.min(rows - 1, gridRow(polygon.bbox.maxLat));

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const key = row * cols + col;
        const bucket = cells.get(key);
        if (bucket) bucket.push(polygonIndex);
        else cells.set(key, [polygonIndex]);
      }
    }
  });

  return { cols, rows, cells };
};

const createLandMask = (
  polygons: IndexedPolygon[],
  source: string,
  confidence: 'low' | 'medium' | 'high'
): LandMask => {
  const grid = buildPolygonGridIndex(polygons);

  return {
    source,
    confidence,
    isLand: point => {
      const col = gridCol(point.lon);
      const row = gridRow(point.lat);

      // Sample points outside the indexed Greece bounds keep the exact legacy
      // behaviour (full scan). In practice every ray stays well inside.
      if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) {
        return polygons.some(polygon => pointInPolygon(point, polygon));
      }

      const candidates = grid.cells.get(row * grid.cols + col);
      if (!candidates) return false;
      return candidates.some(index => pointInPolygon(point, polygons[index]));
    },
  };
};

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
  arrivalFanOut: Map<number, number[]> | undefined,
  landMask: LandMask,
  rayStepKm: number,
  landGraceKm: number,
  waterSearchStepKm: number,
  minOpenWaterKm: number
): BeachExposureProfile | undefined => {
  if (!beach.coordinates) return undefined;

  const sampleOrigin = resolveNearshoreWaterOrigin(
    beach.coordinates,
    landMask,
    nearshoreWaterSearchKm,
    waterSearchStepKm,
    minOpenWaterKm
  );

  const facingDeg = computeShorelineOrientation(sampleOrigin.point, landMask);

  // Μία ακτίνα ανά 15°, με το πυκνό βήμα — δες το σχόλιο του `arrivalFanKm`.
  // Παράγεται ΜΟΝΟ όταν ζητηθεί: κοστίζει 24 πυκνές ακτίνες ανά παραλία και δεν το διαβάζει
  // τίποτα στην παραγωγή (δες τη σημείωση «ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ» παρακάτω).
  const arrivalFanKm: number[] = !arrivalFanOut ? [] : Array.from({ length: ARRIVAL_FAN_SLOTS }, (_unused, slot) => {
    const single = assessGeospatialWindExposure({
      beach: beach.coordinates as Coordinates,
      windDirectionDeg: slot * ARRIVAL_FAN_STEP_DEG,
      landMask,
      maxFetchKm,
      stepKm: ARRIVAL_FAN_STEP_KM,
      nearshoreLandGraceKm: landGraceKm,
      nearshoreWaterSearchKm,
      nearshoreWaterSearchStepKm: waterSearchStepKm,
      sampleOrigin: sampleOrigin.point,
      sampleOriginAdjustedKm: sampleOrigin.adjustedKm,
      fanAnglesDeg: [0],
    });
    return Number(single.samples[0].openWaterKm.toFixed(2));
  });
  if (arrivalFanOut) arrivalFanOut.set(beach.id, arrivalFanKm);

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
  const rayStepKm = Number.isFinite(rayStepOverrideKm) && rayStepOverrideKm > 0
    ? rayStepOverrideKm
    : (isHighResMask ? highResStepKm : stepKm);
  const landGraceKm = Number.isFinite(landGraceOverrideKm) && landGraceOverrideKm >= 0
    ? landGraceOverrideKm
    : (isHighResMask ? highResNearshoreLandGraceKm : nearshoreLandGraceKm);
  const waterSearchStepKm = Number.isFinite(waterSearchStepOverrideKm) && waterSearchStepOverrideKm > 0
    ? waterSearchStepOverrideKm
    : (isHighResMask ? highResNearshoreWaterSearchStepKm : nearshoreWaterSearchStepKm);
  const minOpenWaterKm = Number.isFinite(minOpenWaterOverrideKm) && minOpenWaterOverrideKm >= 0
    ? minOpenWaterOverrideKm
    : nearshoreMinOpenWaterKm;

  const landMask = createLandMask(polygons, maskSource, maskConfidence);
  const regions = loadAppRegions().filter(region => (
    regionFilter.length === 0 || regionFilter.some(filter => region.regionId.toLowerCase().includes(filter))
  ));
  if (regions.length === 0) {
    throw new Error(`No app regions matched the --region filter: ${regionFilter.join(', ')}`);
  }
  type RegionSummaryEntry = {
    regionName: string;
    beachCount: number;
    generatedProfiles: number;
    missingCoordinates: number;
    sectors: ReturnType<typeof summarizeRegion>;
  };
  const summaryByRegion: Record<string, RegionSummaryEntry> = {};
  let totalBeachCount = 0;
  let totalProfiles = 0;
  let totalMissingCoordinates = 0;

  let carriedMarineSamplePoints = 0;
  let carriedWindShadows = 0;

  regions.forEach(region => {
    const profiles: BeachExposureProfile[] = [];
    totalBeachCount += region.beaches.length;

    /**
     * ⚠️ ΜΙΑ ΠΑΓΙΔΑ ΠΟΥ ΕΧΕΙ ΗΔΗ ΧΤΥΠΗΣΕΙ (Λήμνος, 16/08/2026 — καταγραφή στο
     * docs/team/HANDOVER-marine-cell-trust-2026-08-16.md §3α).
     *
     * Το `marineSamplePoint` το ψήνει ΑΛΛΟ script. Αυτό εδώ ξαναγράφει ολόκληρο το αρχείο, οπότε
     * μέχρι σήμερα ένα `--region X` έσβηνε σιωπηλά κάθε ψημένο σημείο της περιοχής. Καμία πύλη
     * δεν το πιάνει, γιατί «καμία τιμή → πέσε στο σημείο περιοχής» είναι νόμιμη διαδρομή: η
     * Λήμνος βρέθηκε στιγμιαία 3/41 έμπιστες, χειρότερη περιοχή της χώρας, χωρίς να σπάσει τίποτα.
     *
     * Εδώ διαβάζεται το προηγούμενο αρχείο και το σημείο μεταφέρεται ΑΥΤΟΥΣΙΟ. Δεν υπολογίζεται
     * ξανά και δεν επικυρώνεται — αυτό είναι δουλειά του script που το ψήνει· εδώ απλώς παύει να
     * καταστρέφεται.
     */
    arrivalFans?.clear();

    const previousProfiles: Record<string, { marineSamplePoint?: unknown; windShadow?: unknown }> = (() => {
      const previousPath = path.join(outputDirectory, `${region.regionId}.json`);
      if (!existsSync(previousPath)) return {};
      try {
        return JSON.parse(readFileSync(previousPath, 'utf8')).profiles || {};
      } catch {
        return {};
      }
    })();

    region.beaches.forEach(beach => {
      const profile = createBeachProfile(beach, arrivalFans, landMask, rayStepKm, landGraceKm, waterSearchStepKm, minOpenWaterKm);
      if (!profile) {
        totalMissingCoordinates += 1;
        return;
      }
      const carried = previousProfiles[String(profile.beachId)]?.marineSamplePoint;
      if (carried) {
        profile.marineSamplePoint = carried;
        carriedMarineSamplePoints += 1;
      }
      /**
       * ΙΔΙΑ ΠΑΓΙΔΑ, ΔΕΥΤΕΡΟ ΠΕΔΙΟ (21/08/2026). Το `windShadow` το ψήνει το
       * `scripts/buildWindShadow.mjs` από τη λεπτή βεντάλια, όπως το `marineSamplePoint` ψήνεται
       * αλλού. Χωρίς αυτή τη μεταφορά, ένα `--region X` θα έσβηνε τη γραμμή του απόγειου ανέμου
       * για ολόκληρη την περιοχή — και θα έσβηνε ΣΙΩΠΗΛΑ, γιατί «χωρίς πεδίο → σιωπή» είναι η
       * σωστή συμπεριφορά της ίδιας της μονάδας (utils/offshoreWindNote). Ακριβώς το ίδιο σχήμα
       * που έκανε τη Λήμνο 3/41 χωρίς να σπάσει καμία πύλη.
       */
      const carriedShadow = previousProfiles[String(profile.beachId)]?.windShadow;
      if (typeof carriedShadow === 'string' && carriedShadow.length === 24) {
        profile.windShadow = carriedShadow;
        carriedWindShadows += 1;
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
        nearshoreWaterSearchStepKm: waterSearchStepKm,
        nearshoreMinOpenWaterKm,
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
    // Content-aware write: an unchanged region keeps its existing file byte-for-byte
    // (generatedAt included), so no-change rebuilds stop churning 111 files and
    // busting client HTTP caches. Only genuinely different output gets a new stamp.
    const regionPath = path.join(outputDirectory, `${region.regionId}.json`);
    const freshStamp = regionPayload.generatedAt;
    let unchanged = false;
    if (existsSync(regionPath)) {
      const existingContent = readFileSync(regionPath, 'utf8');
      const existingStamp = existingContent.match(/"generatedAt": "([^"]+)"/)?.[1];
      if (existingStamp) {
        regionPayload.generatedAt = existingStamp;
        unchanged = existingContent === `${JSON.stringify(regionPayload, null, 2)}\n`;
        if (!unchanged) regionPayload.generatedAt = freshStamp;
      }
    }
    if (!unchanged) {
      writeFileSync(regionPath, `${JSON.stringify(regionPayload, null, 2)}\n`, 'utf8');
    }
    if (arrivalFanDirectory && arrivalFans) {
      mkdirSync(path.resolve(arrivalFanDirectory), { recursive: true });
      writeFileSync(
        path.join(path.resolve(arrivalFanDirectory), `${region.regionId}.json`),
        `${JSON.stringify({
          region: region.regionId,
          note: 'Δες scripts/geospatialExposureProfiles.ts (arrivalFanDirectory) — ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ ως κανόνας, βίβλος §Μ6.',
          settings: { stepDeg: ARRIVAL_FAN_STEP_DEG, rayStepKm: ARRIVAL_FAN_STEP_KM, maxFetchKm },
          fans: Object.fromEntries([...arrivalFans].map(([id, fan]) => [String(id), fan])),
        }, null, 2)}
`,
        'utf8'
      );
    }
    summaryByRegion[region.regionId] = {
      regionName: region.regionName,
      beachCount: region.beaches.length,
      generatedProfiles: profiles.length,
      missingCoordinates: region.beaches.length - profiles.length,
      sectors: summarizeRegion(profiles),
    };
  });

  // A filtered --region run must NOT clobber the national index: both validators
  // enumerate their region universe from it, so a subset index makes them go
  // blind-but-green for the other ~108 regions. Merge into the existing index —
  // and refuse a filtered run whose mask tier differs from the shipped dataset
  // (a --region run without --land-geojson would otherwise silently downgrade
  // those regions to the Natural Earth baseline).
  const indexPath = path.join(outputDirectory, 'index.json');
  let mergedRegionSummaries = summaryByRegion;
  if (regionFilter.length > 0 && existsSync(indexPath)) {
    const existingIndex = JSON.parse(readFileSync(indexPath, 'utf8')) as {
      settings?: { maskConfidence?: string };
      summary?: { regions?: Record<string, RegionSummaryEntry> };
    };
    const existingMaskConfidence = existingIndex.settings?.maskConfidence;
    if (existingMaskConfidence && existingMaskConfidence !== maskConfidence) {
      throw new Error(
        `Filtered --region run uses a '${maskConfidence}' land mask but the shipped dataset is '${existingMaskConfidence}'. ` +
        'Pass the matching --land-geojson (see scripts/fetchHighResLandMask.mjs) or run the full build.'
      );
    }
    mergedRegionSummaries = { ...(existingIndex.summary?.regions || {}), ...summaryByRegion };
  }
  const mergedEntries = Object.values(mergedRegionSummaries);
  const mergedBeachCount = mergedEntries.reduce((sum, entry) => sum + entry.beachCount, 0);
  const mergedProfiles = mergedEntries.reduce((sum, entry) => sum + entry.generatedProfiles, 0);
  const mergedMissing = mergedEntries.reduce((sum, entry) => sum + entry.missingCoordinates, 0);

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
      nearshoreWaterSearchStepKm: waterSearchStepKm,
      nearshoreMinOpenWaterKm,
      fanAnglesDeg,
      sectors: sectors.map(sector => sector.key),
      maskSource,
      maskConfidence,
    },
    summary: {
      regionCount: mergedEntries.length,
      beachCount: mergedBeachCount,
      generatedProfiles: mergedProfiles,
      missingCoordinates: mergedMissing,
      indexedLandPolygons: polygons.length,
      regions: mergedRegionSummaries,
    },
  };

  mkdirSync(outputDirectory, { recursive: true });
  // Content-aware, like the region files: identical output keeps the old stamp/file.
  let indexUnchanged = false;
  if (existsSync(indexPath)) {
    const existingContent = readFileSync(indexPath, 'utf8');
    const existingStamp = existingContent.match(/"generatedAt": "([^"]+)"/)?.[1];
    if (existingStamp) {
      const freshStamp = output.generatedAt;
      output.generatedAt = existingStamp;
      indexUnchanged = existingContent === `${JSON.stringify(output, null, 2)}\n`;
      if (!indexUnchanged) output.generatedAt = freshStamp;
    }
  }
  if (!indexUnchanged) {
    writeFileSync(indexPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({
    outputDirectory,
    indexPath: path.join(outputDirectory, 'index.json'),
    regionCount: regions.length,
    beachCount: totalBeachCount,
    generatedProfiles: totalProfiles,
    missingCoordinates: totalMissingCoordinates,
    indexedLandPolygons: polygons.length,
    carriedMarineSamplePoints,
    carriedWindShadows,
  }, null, 2));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
