import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAFE_AMENITY_TERMS,
  RESTAURANT_AMENITY_TERMS,
  PARKING_AMENITY_TERMS,
  SNACK_CANTEEN_AMENITY_TERMS,
  SUNBED_AMENITY_TERMS,
  TAVERNA_AMENITY_TERMS,
  amenityTextIncludesAny,
  hasExplicitBeachBarAmenityInList,
} from '../utils/amenityMatching.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const outputDir = path.join(rootDir, 'public', 'data', 'beaches');
const appOutputDir = path.join(outputDir, 'app');
const appSummaryOutputDir = path.join(appOutputDir, 'summary');
const appDetailOutputDir = path.join(appOutputDir, 'detail');
const regionDisplayNamesPath = path.join(rootDir, 'utils', 'regionDisplayNames.json');

const APP_DATA_SCHEMA_VERSION = 1;

const WindDirection = {
  N: 'North',
  NE: 'Northeast',
  E: 'East',
  SE: 'Southeast',
  S: 'South',
  SW: 'Southwest',
  W: 'West',
  NW: 'Northwest',
};

const REGION_LABELS = JSON.parse(await fs.readFile(regionDisplayNamesPath, 'utf8'));

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const makeLocalizedName = (value, id) => {
  const label = REGION_LABELS[id] || REGION_LABELS[value] || { en: value || 'Unknown', gr: value || 'Unknown' };
  return { en: label.en, gr: label.gr, fr: label.en, de: label.en, it: label.en };
};

const mapRegionToGroup = (region, subRegion) => {
  const r = normalizeText(region);
  const s = normalizeText(subRegion);

  const cyclades = ['milos', 'santorini', 'mykonos', 'paros', 'naxos', 'syros', 'tinos', 'andros', 'sifnos', 'serifos', 'kythnos', 'kea', 'amorgos', 'ios', 'folegandros', 'koufonisia', 'donousa', 'schinoussa', 'iraklia', 'kimolos', 'polyaigos', 'sikinos', 'anafi', 'antiparos'];
  const dodecanese = ['rhodes', 'kos', 'karpathos', 'astypalaia', 'patmos', 'kalymnos', 'leros', 'symi', 'lipsi', 'nisyros', 'tilos', 'kassos', 'kasos', 'halki', 'agathonisi', 'kastellorizo', 'megisti', 'pserimos', 'telendos', 'arki', 'arkoi', 'marathi'];
  const ionian = ['corfu', 'zakynthos', 'kefalonia', 'lefkada', 'ithaca', 'ithaki', 'paxi', 'paxos', 'antipaxos', 'antipaxi', 'meganisi', 'othonoi', 'erikoussa', 'mathraki', 'kythira', 'antikythira'];
  const sporades = ['skiathos', 'skopelos', 'alonissos', 'skyros'];
  const northAegean = ['lesvos', 'chios', 'samos', 'ikaria', 'lemnos', 'thassos', 'samothraki', 'fournoi', 'oinousses', 'psara', 'agios efstratios'];
  const argosaronic = ['hydra', 'spetses', 'poros', 'aegina', 'salamina', 'agistri', 'methana', 'saronic islands'];

  if (cyclades.includes(s) || s.includes('kykladon')) return 'cyclades';
  if (dodecanese.includes(s) || s.includes('dodecanese')) return 'dodecanese';
  if (ionian.some(name => s.includes(name))) return 'ionian';
  if (sporades.includes(s)) return 'sporades';
  if (northAegean.includes(s) || s.includes('lesvou') || s.includes('chiou') || s.includes('samou')) return 'north_aegean';
  if (argosaronic.includes(s) || s.includes('saronic')) return 'argosaronic';

  if (s.includes('chania') || s.includes('rethymno') || s.includes('heraklion') || s.includes('lasithi')) return 'crete';
  if (s.includes('attica') || s.includes('athens') || s.includes('piraeus')) return 'attica';
  if (s.includes('evia') || s.includes('euboea')) return 'euboea';
  if (s.includes('halkidiki') || s.includes('thessaloniki') || s.includes('pieria') || s.includes('kilkis') || s.includes('kavala') || s.includes('drama')) return 'mainland_macedonia';
  if (s.includes('evros') || s.includes('rodopi') || s.includes('xanthi')) return 'mainland_thrace';
  if (s.includes('thesprotia') || s.includes('preveza') || s.includes('arta')) return 'mainland_epirus';
  if (s.includes('magnesia') || s.includes('larissa')) return 'mainland_thessaly';
  if (s.includes('argolida') || s.includes('arkadia') || s.includes('korinthia') || s.includes('lakonia') || s.includes('messinia') || s.includes('ilia') || s.includes('achaia')) return 'mainland_peloponnese';
  if (s.includes('fokida') || s.includes('fthiotida') || s.includes('viotia') || s.includes('aitoloakarnania')) return 'mainland_central';

  if (r.includes('cyclades')) return 'cyclades';
  if (r.includes('dodecanese')) return 'dodecanese';
  if (r.includes('ionian')) return 'ionian';
  if (r.includes('sporades')) return 'sporades';
  if (r.includes('north aegean') || r.includes('aegean')) return 'north_aegean';
  if (r.includes('crete')) return 'crete';
  if (r.includes('argosaronic')) return 'argosaronic';
  if (r.includes('attica')) return 'attica';
  if (r.includes('evia') || r.includes('evvoia')) return 'euboea';
  if (r.includes('peloponnese')) return 'mainland_peloponnese';
  if (r.includes('thessaly')) return 'mainland_thessaly';
  if (r.includes('epirus')) return 'mainland_epirus';
  if (r.includes('thrace')) return 'mainland_thrace';
  if (r.includes('macedonia')) return 'mainland_macedonia';
  if (r.includes('central greece') || r.includes('sterea') || r.includes('west greece')) return 'mainland_central';

  return 'mainland_central';
};

const getBeachRegionId = (region, prefecture, fallbackId = 'unknown') => {
  const base = `${region || 'Unknown'}-${prefecture || region || 'Unknown'}`;
  const normalized = base
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return normalized || `unknown-${fallbackId}`;
};

const getDeterministicValue = (id, seed) => {
  const str = `${id}-${seed}`;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash % 1000) / 1000;
};

const getAutoProt = (lat, lon, centerLat, centerLon) => {
  const latDiff = lat - centerLat;
  const lonDiff = lon - centerLon;
  const protection = [];
  const threshold = 0.002;

  if (latDiff > threshold) protection.push(WindDirection.S, WindDirection.SE, WindDirection.SW);
  if (latDiff < -threshold) protection.push(WindDirection.N, WindDirection.NE, WindDirection.NW);
  if (lonDiff > threshold) protection.push(WindDirection.W, WindDirection.NW, WindDirection.SW);
  if (lonDiff < -threshold) protection.push(WindDirection.E, WindDirection.NE, WindDirection.SE);

  return protection.length > 0 ? Array.from(new Set(protection)) : [WindDirection.N, WindDirection.NE, WindDirection.NW];
};

const isWindDirection = value => Object.values(WindDirection).includes(value);

const getVerifiedOrientation = metadata => {
  const orientation = metadata?.orientation;
  if (!orientation) return undefined;

  const protectedFrom = (orientation.protectedFrom || []).filter(isWindDirection);
  const faces = (orientation.faces || []).filter(isWindDirection);
  const degrees = typeof orientation.degrees === 'number' && Number.isFinite(orientation.degrees)
    ? orientation.degrees
    : null;

  if (degrees === null && protectedFrom.length === 0 && faces.length === 0) return undefined;

  return {
    degrees,
    faces,
    protectedFrom,
    confidence: orientation.confidence || metadata?.confidence || 'medium',
    notes: orientation.notes,
  };
};

const metadataAccessToAccessibility = type => {
  switch (type) {
    case 'asphalt_road':
      return 'EASY';
    case 'unknown':
      return 'MODERATE';
    case 'passable_dirt_road':
    case 'hiking_path_easy':
      return 'MODERATE';
    case 'difficult_dirt_road':
    case '4x4_only':
    case 'hiking_path_difficult':
      return 'DIFFICULT';
    case 'boat_only':
      return 'BOAT_ONLY';
    default:
      return 'EASY';
  }
};

const metadataTerrainToBeachType = types => {
  if (!types || types.length === 0) return 'sandy';
  const hasFineSand = types.includes('fine_sand');
  const hasCoarseSand = types.includes('coarse_sand');
  const hasPebbles = types.includes('pebbles');
  const hasStones = types.includes('large_stones');
  const hasRocks = types.includes('rocks');

  if (hasRocks && !hasFineSand && !hasCoarseSand && !hasPebbles) return 'rocky';
  if ((hasFineSand || hasCoarseSand) && (hasPebbles || hasStones || hasRocks)) return 'sandy-pebbles';
  if (hasPebbles || hasStones) return 'pebbles';
  return 'sandy';
};

const metadataTerrainToDepth = types => {
  if (!types || types.length === 0) return { deepWaters: false, shallowWaters: true, waterDepth: 'shallow' };
  if (types.includes('large_stones') || types.includes('rocks')) {
    return { deepWaters: true, shallowWaters: false, waterDepth: 'deep' };
  }
  if (types.includes('pebbles') && !types.includes('fine_sand')) {
    return { deepWaters: false, shallowWaters: false, waterDepth: 'medium' };
  }
  return { deepWaters: false, shallowWaters: true, waterDepth: 'shallow' };
};

const metadataWaterDepthToCharacteristics = waterDepth => {
  switch (waterDepth) {
    case 'deep':
      return { deepWaters: true, shallowWaters: false, waterDepth: 'deep' };
    case 'medium':
      return { deepWaters: false, shallowWaters: false, waterDepth: 'medium' };
    case 'shallow':
    default:
      return { deepWaters: false, shallowWaters: true, waterDepth: 'shallow' };
  }
};

const hardQuietAccessTypes = new Set(['4x4_only', 'difficult_dirt_road', 'hiking_path_difficult', 'boat_only']);

const terrainSupportsSnorkeling = types =>
  (types || []).some(type => type === 'rocks' || type === 'large_stones');

const inferQuietFromMetadata = ({
  metadata,
  accessType,
  hasBar,
  organized,
  hasSunbeds,
  hasTaverna,
  hasRestaurant,
}) => {
  const amenities = metadata?.amenities || [];
  const hasCafe = amenityTextIncludesAny(amenities, CAFE_AMENITY_TERMS);
  const hasSnackOrCanteen = amenityTextIncludesAny(amenities, SNACK_CANTEEN_AMENITY_TERMS);
  const hasVisitorServices = hasBar || organized || hasSunbeds || hasTaverna || hasRestaurant || hasCafe || hasSnackOrCanteen;

  if (hasVisitorServices) return false;
  return amenities.length === 0 || hardQuietAccessTypes.has(accessType);
};

const greeklishPairs = [
  ['αι', 'ai'], ['ει', 'ei'], ['οι', 'oi'], ['ου', 'ou'], ['αυ', 'av'], ['ευ', 'ev'],
  ['Αι', 'Ai'], ['Ει', 'Ei'], ['Οι', 'Oi'], ['Ου', 'Ou'], ['Αυ', 'Av'], ['Ευ', 'Ev'],
  ['ά', 'a'], ['έ', 'e'], ['ή', 'i'], ['ί', 'i'], ['ό', 'o'], ['ύ', 'y'], ['ώ', 'o'],
  ['ϊ', 'i'], ['ΐ', 'i'], ['ϋ', 'y'], ['ΰ', 'y'],
  ['Ά', 'A'], ['Έ', 'E'], ['Ή', 'I'], ['Ί', 'I'], ['Ό', 'O'], ['Ύ', 'Y'], ['Ώ', 'O'],
  ['Α', 'A'], ['Β', 'V'], ['Γ', 'G'], ['Δ', 'D'], ['Ε', 'E'], ['Ζ', 'Z'], ['Η', 'I'],
  ['Θ', 'Th'], ['Ι', 'I'], ['Κ', 'K'], ['Λ', 'L'], ['Μ', 'M'], ['Ν', 'N'], ['Ξ', 'X'],
  ['Ο', 'O'], ['Π', 'P'], ['Ρ', 'R'], ['Σ', 'S'], ['Τ', 'T'], ['Υ', 'Y'], ['Φ', 'F'],
  ['Χ', 'Ch'], ['Ψ', 'Ps'], ['Ω', 'O'],
  ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'i'],
  ['θ', 'th'], ['ι', 'i'], ['κ', 'k'], ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'],
  ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'], ['υ', 'y'],
  ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
];

const toGreeklish = value => {
  if (!value) return '';
  return greeklishPairs.reduce((text, [from, to]) => text.split(from).join(to), value)
    .replace(/\s+/g, ' ')
    .trim();
};

const hasGreekText = value => /[\u0370-\u03ff]/.test(value || '');
const normalizeGreekFinalSigma = value => value.replace(/σ\b/g, 'ς');
const getGreekDisplayBeachName = value => hasGreekText(value) ? normalizeGreekFinalSigma(value.trim()) : value.trim();

const makeBeachNarrative = (name, areaName, accessNotes, regionId) => {
  const latinName = toGreeklish(name) || name;
  const greekName = getGreekDisplayBeachName(name);
  const area = makeLocalizedName(areaName, regionId);
  const greekArea = area.gr || areaName || 'Ελλάδα';

  return {
    description: {
      en: `${latinName} beach in ${area.en}. Check today's wind and sea conditions before you go.`,
      gr: `${greekName}, ${greekArea}. Δες τον σημερινό άνεμο και τη θάλασσα πριν πας.`,
      fr: `${latinName} beach in ${area.en}. Check today's wind and sea conditions before you go.`,
      de: `${latinName} beach in ${area.en}. Check today's wind and sea conditions before you go.`,
      it: `${latinName} beach in ${area.en}. Check today's wind and sea conditions before you go.`,
    },
    detailedDescription: {
      en: `${latinName} is a beach in ${area.en}. Check access, shade, and today's sea conditions before you go.`,
      gr: `${greekName}: Περιοχή: ${greekArea}. Δες πρόσβαση, σκιά και σημερινές συνθήκες θάλασσας πριν πας.`,
      fr: `${latinName} is a beach in ${area.en}. Check access, shade, and today's sea conditions before you go.`,
      de: `${latinName} is a beach in ${area.en}. Check access, shade, and today's sea conditions before you go.`,
      it: `${latinName} is a beach in ${area.en}. Check access, shade, and today's sea conditions before you go.`,
    },
    accessNotes: accessNotes ? {
      en: toGreeklish(accessNotes) || accessNotes,
      gr: accessNotes,
      fr: toGreeklish(accessNotes) || accessNotes,
      de: toGreeklish(accessNotes) || accessNotes,
      it: toGreeklish(accessNotes) || accessNotes,
    } : undefined,
  };
};

const makeSearchAliases = (name, areaName, extraAliases = []) => Array.from(new Set([
  name,
  toGreeklish(name),
  getGreekDisplayBeachName(name),
  ...extraAliases,
  ...extraAliases.map(alias => toGreeklish(alias)),
  areaName,
  toGreeklish(areaName),
  'Paralia',
].filter(Boolean)));

const buildBeach = (rawBeach, island) => {
  const metadata = rawBeach.metadata;
  const verifiedOrientation = getVerifiedOrientation(metadata);
  const autoProtection = getAutoProt(rawBeach.lat, rawBeach.lon, island.coordinates.lat, island.coordinates.lon);
  const protection = verifiedOrientation?.protectedFrom.length ? verifiedOrientation.protectedFrom : autoProtection;
  const access = metadata ? metadataAccessToAccessibility(metadata.access.type) : 'EASY';
  const narrative = makeBeachNarrative(rawBeach.name, rawBeach.prefecture, metadata?.access?.notes, island.id);
  const hasBar = metadata
    ? hasExplicitBeachBarAmenityInList(metadata.amenities)
    : /beach\s*bar|beachbar|beach club|bar|resort/i.test(rawBeach.name);
  const organized = metadata ? metadata.organized : hasBar || getDeterministicValue(rawBeach.id, 'organized') > 0.6;
  const hasShade = metadata ? metadata.shade : getDeterministicValue(rawBeach.id, 'shade') > 0.5;
  const hasTaverna = metadata ? amenityTextIncludesAny(metadata.amenities, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS]) : getDeterministicValue(rawBeach.id, 'taverna') > 0.5;
  const hasParking = metadata ? amenityTextIncludesAny(metadata.amenities, PARKING_AMENITY_TERMS) : getDeterministicValue(rawBeach.id, 'parking') > 0.4;
  const hasSunbeds = metadata ? metadata.organized && amenityTextIncludesAny(metadata.amenities, SUNBED_AMENITY_TERMS) : organized || getDeterministicValue(rawBeach.id, 'sunbeds') > 0.5;
  const hasRestaurant = metadata ? hasTaverna || amenityTextIncludesAny(metadata.amenities, RESTAURANT_AMENITY_TERMS) : hasTaverna || getDeterministicValue(rawBeach.id, 'restaurant') > 0.7;
  const quiet = metadata
    ? inferQuietFromMetadata({ metadata, accessType: metadata.access.type, hasBar, organized, hasSunbeds, hasTaverna, hasRestaurant })
    : !hasBar && getDeterministicValue(rawBeach.id, 'quiet') > 0.6;
  const typeVal = getDeterministicValue(rawBeach.id, 'type');
  const isDeepWater = getDeterministicValue(rawBeach.id, 'depth') > 0.5;
  const beachType = metadata ? metadataTerrainToBeachType(metadata.terrain.types) : (typeVal > 0.85 ? 'rocky' : (typeVal > 0.65 ? 'pebbles' : (typeVal > 0.45 ? 'sandy-pebbles' : 'sandy')));
  const depth = metadata?.waterDepth?.type
    ? metadataWaterDepthToCharacteristics(metadata.waterDepth.type)
    : metadata ? metadataTerrainToDepth(metadata.terrain.types) : {
      deepWaters: isDeepWater,
      shallowWaters: !isDeepWater,
      waterDepth: isDeepWater ? 'deep' : (getDeterministicValue(rawBeach.id, 'depth2') > 0.5 ? 'medium' : 'shallow'),
    };

  return {
    id: rawBeach.id,
    rating: 4.0 + (getDeterministicValue(rawBeach.id, 'rating') * 1.0),
    name: {
      en: toGreeklish(rawBeach.name) || rawBeach.name,
      gr: getGreekDisplayBeachName(rawBeach.name),
      fr: rawBeach.name,
      de: rawBeach.name,
      it: rawBeach.name,
    },
    description: narrative.description,
    detailedDescription: narrative.detailedDescription,
    accessNotes: narrative.accessNotes,
    protectedFrom: protection,
    orientation: verifiedOrientation,
    accessibility: access,
    amenities: {
      organized,
      naturalShade: hasShade,
      taverna: hasTaverna,
      beachBar: hasBar,
      sunbeds: hasSunbeds,
      restaurant: hasRestaurant,
      parking: hasParking,
    },
    beachType,
    characteristics: {
      deepWaters: depth.deepWaters,
      shallowWaters: depth.shallowWaters,
    },
    waterDepth: depth.waterDepth,
    activities: {
      snorkeling: metadata ? terrainSupportsSnorkeling(metadata.terrain.types) : getDeterministicValue(rawBeach.id, 'snorkeling') > 0.4,
      surfing: getDeterministicValue(rawBeach.id, 'surfing') > 0.8,
    },
    environment: {
      quiet,
      remote: access === 'DIFFICULT' || access === 'BOAT_ONLY',
      familyFriendly: depth.shallowWaters && organized && !hardQuietAccessTypes.has(metadata?.access?.type),
    },
    popularityScore: Math.floor(getDeterministicValue(rawBeach.id, 'pop') * 100),
    coordinates: { lat: rawBeach.lat, lon: rawBeach.lon },
    location: {
      region: rawBeach.region,
      island: rawBeach.prefecture,
    },
    aliases: makeSearchAliases(rawBeach.name, rawBeach.prefecture, metadata?.aliases || []),
    staticLabels: {
      beachType,
      accessType: metadata?.access?.type || 'unknown',
      terrain: metadata?.terrain?.label,
      waterDepth: metadata?.waterDepth?.label,
    },
    metadata,
  };
};

const buildSummaryBeach = beach => {
  const accessType = beach.metadata?.access?.type || beach.staticLabels?.accessType || 'unknown';
  return {
    id: beach.id,
    rating: beach.rating,
    name: beach.name,
    description: beach.description,
    protectedFrom: beach.protectedFrom,
    orientation: beach.orientation,
    accessibility: beach.accessibility,
    amenities: beach.amenities,
    beachType: beach.beachType,
    characteristics: beach.characteristics,
    waterDepth: beach.waterDepth,
    activities: beach.activities,
    environment: beach.environment,
    popularityScore: beach.popularityScore,
    coordinates: beach.coordinates,
    location: beach.location,
    aliases: beach.aliases,
    ...(beach.metadata?.blueFlag2026 ? { blueFlag2026: beach.metadata.blueFlag2026 } : {}),
    staticLabels: {
      beachType: beach.staticLabels?.beachType || beach.beachType,
      accessType,
    },
  };
};

const buildDetailBeach = beach => ({
  id: beach.id,
  description: beach.description,
  detailedDescription: beach.detailedDescription,
  accessNotes: beach.accessNotes,
  amenities: beach.amenities,
  characteristics: beach.characteristics,
  waterDepth: beach.waterDepth,
  activities: beach.activities,
  environment: beach.environment,
  location: beach.location,
  aliases: beach.aliases,
  staticLabels: beach.staticLabels,
  metadata: beach.metadata,
});

const isBeachMetadata = value => {
  if (!value || typeof value !== 'object') return false;
  return Boolean(
    value.access &&
    typeof value.access === 'object' &&
    typeof value.access.type === 'string' &&
    typeof value.access.label === 'string' &&
    typeof value.access.notes === 'string' &&
    value.terrain &&
    typeof value.terrain === 'object' &&
    Array.isArray(value.terrain.types) &&
    typeof value.terrain.label === 'string' &&
    typeof value.organized === 'boolean' &&
    typeof value.shade === 'boolean' &&
    Array.isArray(value.amenities)
  );
};

const parseBeachPayload = beachData => {
  const allBeaches = [];
  let idCounter = 0;

  const walk = (node, region, pathParts) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const lat = typeof item?.lat === 'number' ? item.lat : Number(item?.lat);
        const lon = typeof item?.lon === 'number' ? item.lon : Number(item?.lon);
        const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : 'Unknown';

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        allBeaches.push({
          id: idCounter++,
          region,
          prefecture: pathParts[pathParts.length - 1] || pathParts[0] || 'Unknown',
          name,
          lat,
          lon,
          ...(isBeachMetadata(item?.metadata) ? { metadata: item.metadata } : {}),
        });
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    for (const [key, value] of Object.entries(node)) {
      walk(value, region, [...pathParts, key]);
    }
  };

  if (!beachData || typeof beachData !== 'object') return allBeaches;

  for (const [region, regionNode] of Object.entries(beachData)) {
    walk(regionNode, region, []);
  }

  return allBeaches;
};

const shouldExcludeFromApp = beach => beach.metadata?.excludeFromApp === true;

const dedupeExactBeaches = beaches => {
  const unique = [];
  const seenKeys = new Set();

  for (const beach of beaches) {
    const key = `${beach.region}|${beach.prefecture}|${beach.name}|${beach.lat.toFixed(6)}|${beach.lon.toFixed(6)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    unique.push(beach);
  }

  return unique;
};

const sourceJson = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const beaches = dedupeExactBeaches(parseBeachPayload(sourceJson).filter(beach => !shouldExcludeFromApp(beach)));
const regions = new Map();

for (const beach of beaches) {
  const id = getBeachRegionId(beach.region, beach.prefecture, beach.id);
  if (!regions.has(id)) {
    regions.set(id, {
      id,
      region: beach.region || 'Unknown',
      prefecture: beach.prefecture || beach.region || 'Unknown',
      beaches: [],
    });
  }

  regions.get(id).beaches.push(beach);
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(appOutputDir, { recursive: true });
await fs.mkdir(appSummaryOutputDir, { recursive: true });
await fs.mkdir(appDetailOutputDir, { recursive: true });

const generatedAt = new Date().toISOString();
const index = {
  generatedAt,
  source: '/greek_beaches.json',
  appSchemaVersion: APP_DATA_SCHEMA_VERSION,
  totalBeachCount: beaches.length,
  regions: [],
};

for (const region of regions.values()) {
  const center = region.beaches.reduce(
    (acc, beach) => ({
      lat: acc.lat + beach.lat,
      lon: acc.lon + beach.lon,
    }),
    { lat: 0, lon: 0 }
  );

  const coordinates = {
    lat: center.lat / region.beaches.length,
    lon: center.lon / region.beaches.length,
  };

  const dataPath = `/data/beaches/${region.id}.json`;
  const appDataPath = `/data/beaches/app/${region.id}.json`;
  const summaryDataPath = `/data/beaches/app/summary/${region.id}.json`;
  const detailDataPath = `/data/beaches/app/detail/${region.id}.json`;
  const island = {
    id: region.id,
    name: makeLocalizedName(region.prefecture, region.id),
    group: mapRegionToGroup(region.region, region.prefecture),
    coordinates,
    beaches: [],
  };

  island.beaches = region.beaches.map(beach => buildBeach(beach, island));
  const summaryIsland = {
    ...island,
    beaches: island.beaches.map(buildSummaryBeach),
  };
  const detailBeaches = island.beaches.map(buildDetailBeach);

  const indexEntry = {
    id: region.id,
    region: region.region,
    prefecture: region.prefecture,
    beachCount: region.beaches.length,
    coordinates,
    dataPath,
    appDataPath,
    name: island.name,
    group: island.group,
  };

  index.regions.push(indexEntry);

  await fs.writeFile(
    path.join(outputDir, `${region.id}.json`),
    `${JSON.stringify(region.beaches)}\n`,
    'utf8'
  );

  await fs.writeFile(
    path.join(appOutputDir, `${region.id}.json`),
    `${JSON.stringify({
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      generatedAt,
      source: dataPath,
      region: indexEntry,
      island,
    })}\n`,
    'utf8'
  );

  await fs.writeFile(
    path.join(appSummaryOutputDir, `${region.id}.json`),
    `${JSON.stringify({
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      generatedAt,
      source: dataPath,
      detailDataPath,
      region: indexEntry,
      island: summaryIsland,
    })}\n`,
    'utf8'
  );

  await fs.writeFile(
    path.join(appDetailOutputDir, `${region.id}.json`),
    `${JSON.stringify({
      schemaVersion: APP_DATA_SCHEMA_VERSION,
      generatedAt,
      source: dataPath,
      summaryDataPath,
      region: indexEntry,
      beaches: detailBeaches,
    })}\n`,
    'utf8'
  );
}

await fs.writeFile(
  path.join(outputDir, 'index.json'),
  `${JSON.stringify(index, null, 2)}\n`,
  'utf8'
);

console.log(`Split ${beaches.length} beaches into ${regions.size} region files.`);
console.log(`Wrote raw files to ${path.relative(rootDir, outputDir)}`);
console.log(`Wrote app-ready files to ${path.relative(rootDir, appOutputDir)}`);
console.log(`Wrote summary files to ${path.relative(rootDir, appSummaryOutputDir)}`);
console.log(`Wrote detail files to ${path.relative(rootDir, appDetailOutputDir)}`);
