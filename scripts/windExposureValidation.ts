import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Accessibility, Beach, BeachType, GeospatialExposureProfile, WaterDepth, WindDirection, WindProfile, WindSector } from '../types';
import { generateBeachCopy } from '../utils/beachCopy';
import { assessGeospatialWindExposure, type LandMask } from '../utils/geospatialExposureModel';
import { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel, shouldShowWindExposureColors } from '../utils/mapExposure';
import type { ExposureLevel } from '../utils/windExposure';
import { assessBeachWindExposure } from '../utils/windExposureEngine';

type ScenarioBeach = Pick<Beach, 'id' | 'location' | 'windProfile'> & {
  name: { en: string; gr: string };
  protectedFrom?: WindDirection[];
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertNoStrongWarningCopy = (text: string, context: string) => {
  const forbidden = /\b(strong wind|high wind|rough|avoid|danger|not ideal|windy or choppy)\b/i;
  assert(!forbidden.test(text), `${context}: must not show strong warning copy. Got: ${text}`);
};

const assertHasClearCautionCopy = (text: string, context: string) => {
  const required = /\b(wind\/watersports|wind sport|windy|choppy|more exposed|not ideal|caution)\b/i;
  assert(required.test(text), `${context}: must show clear caution copy. Got: ${text}`);
};

const assertNoProtectedCalmClaims = (text: string, context: string) => {
  const forbidden = /\b(protected|sheltered|well protected|calm waters|calm sea|flat water|verified shelter|protected water)\b/i;
  assert(!forbidden.test(text), `${context}: must not claim protected/calm. Got: ${text}`);
};

const syntheticLandMask = (
  source: string,
  isLand: LandMask['isLand']
): LandMask => ({
  source,
  confidence: 'medium',
  isLand,
});

const baseBeach = (input: ScenarioBeach): Beach => ({
  id: input.id,
  rating: 4.5,
  name: {
    en: input.name.en,
    gr: input.name.gr,
    fr: input.name.en,
    de: input.name.en,
    it: input.name.en,
  },
  description: {
    en: input.name.en,
    gr: input.name.gr,
    fr: input.name.en,
    de: input.name.en,
    it: input.name.en,
  },
  protectedFrom: input.protectedFrom || [],
  accessibility: Accessibility.EASY,
  amenities: {
    organized: false,
    naturalShade: false,
    taverna: false,
    beachBar: false,
    sunbeds: false,
    restaurant: false,
    parking: true,
  },
  characteristics: {
    shallowWaters: true,
    deepWaters: false,
  },
  beachType: 'sandy' as BeachType,
  waterDepth: 'shallow' as WaterDepth,
  activities: {
    snorkeling: false,
    surfing: false,
  },
  environment: {
    quiet: false,
    remote: false,
    familyFriendly: true,
  },
  popularityScore: 50,
  coordinates: { lat: 37, lon: 25 },
  location: input.location,
  windProfile: input.windProfile,
});

const northFiveBeaufort = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 32,
  beaufort: 5,
  waveHeightMeters: 0.7,
};

const northThreeBeaufort = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 19,
  beaufort: 3,
  waveHeightMeters: 0.3,
};

const northFourBeaufort = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 25,
  beaufort: 4,
  waveHeightMeters: 0.5,
};

const northThreeBeaufortParosChoppy = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 19,
  beaufort: 3,
  waveHeightMeters: 0.6,
};

const northThreeBeaufortAndrosChoppy = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 19,
  beaufort: 3,
  waveHeightMeters: 0.7,
};

const milosNorthFiveBeaufort = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 35.3,
  beaufort: 5,
  waveHeightMeters: 1.5,
};

const milosNorthSixBeaufort = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 44,
  beaufort: 6,
  waveHeightMeters: 1.8,
};

const milosNorthThreeBeaufort = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 16.9,
  beaufort: 3,
  waveHeightMeters: 0.3,
};

const milosNorthThreeBeaufortChoppy = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 16.9,
  beaufort: 3,
  waveHeightMeters: 0.7,
};

const milosSouthFiveBeaufort = {
  windDirectionDeg: 180,
  windDirection: WindDirection.S,
  windSpeedKmh: 34.2,
  beaufort: 5,
  waveHeightMeters: 1.4,
};

const milosSouthwestFourBeaufort = {
  windDirectionDeg: 225,
  windDirection: WindDirection.SW,
  windSpeedKmh: 19,
  beaufort: 4,
  waveHeightMeters: 0.9,
};

const visibleLabelDecision = (assessment: ReturnType<typeof assessBeachWindExposure>) => ({
  protectedLabel: assessment.exposureLevel === 'protected' && assessment.canClaimProtected,
  calmLabel: assessment.seaCalmClaimAllowed,
});

const visibleMapExposureDecision = (
  beach: Beach,
  assessment: ReturnType<typeof assessBeachWindExposure>,
  scenario: { beaufort: number; windDirectionDeg: number },
  geospatialExposure?: GeospatialExposureProfile
) => getVisibleMapExposureLevel({
  beach,
  exposureLevel: assessment.exposureLevel,
  orientation: assessment.windProfile.beachFacingDirection,
  windProfile: assessment.windProfile,
  windProfileSource: assessment.source,
  windSector: assessment.windSector,
  warnings: assessment.warnings,
  geospatialExposure,
}, scenario.beaufort, scenario.windDirectionDeg);

const loadAppRegionBeaches = (regionId: string): Beach[] => {
  const filePath = path.join(process.cwd(), 'public', 'data', 'beaches', 'app', `${regionId}.json`);
  const payload = JSON.parse(readFileSync(filePath, 'utf8'));
  return payload.island.beaches as Beach[];
};

const windSectorKeys: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const geospatialProfile = (
  beachId: number,
  overrides: Partial<Record<WindSector, ExposureLevel>>
): GeospatialExposureProfile => ({
  beachId,
  confidence: 'low',
  source: 'natural-earth-baseline',
  sectors: windSectorKeys.reduce<GeospatialExposureProfile['sectors']>((sectors, sector) => {
    const level = overrides[sector] || 'partial';
    sectors[sector] = {
      level,
      fetchKm: level === 'protected' ? 1 : level === 'exposed' ? 25 : 5,
      blockedRayRatio: level === 'protected' ? 1 : level === 'exposed' ? 0 : 0.5,
    };
    return sectors;
  }, {} as GeospatialExposureProfile['sectors']),
});

const loadGeneratedGeospatialProfiles = (regionId: string): Record<number, GeospatialExposureProfile> => {
  const filePath = path.join(process.cwd(), 'public', 'data', 'geospatial', 'exposure', `${regionId}.json`);
  const payload = JSON.parse(readFileSync(filePath, 'utf8')) as {
    profiles: Record<string, Omit<GeospatialExposureProfile, 'source'>>;
  };

  return Object.values(payload.profiles).reduce<Record<number, GeospatialExposureProfile>>((lookup, profile) => {
    lookup[profile.beachId] = {
      ...profile,
      source: 'natural-earth-baseline',
    };
    return lookup;
  }, {});
};

const scenarioScore = (beach: Beach, scenario = northFiveBeaufort): number => {
  const assessment = assessBeachWindExposure({ beach, ...scenario });
  const exposureBase = assessment.exposureLevel === 'protected' ? 18 : assessment.exposureLevel === 'partial' ? 6 : -16;
  const raw = 76 + exposureBase + assessment.swimmingScoreModifier + assessment.experienceScoreModifier;
  return Math.max(0, Math.min(100, assessment.finalScoreCap === undefined ? raw : Math.min(raw, assessment.finalScoreCap)));
};

const generatedCopyText = (
  beach: Beach,
  assessment: ReturnType<typeof assessBeachWindExposure>,
  scenario = northFiveBeaufort
): string => {
  const copy = generateBeachCopy({
    beach,
    language: 'en',
    isExposed: assessment.exposureLevel !== 'protected',
    exposureLevel: assessment.exposureLevel,
    waveHeightM: scenario.waveHeightMeters,
    warnings: assessment.warnings,
    windBeaufort: scenario.beaufort,
    canClaimWindProtection: assessment.canClaimProtected,
    seaCalmClaimAllowed: assessment.seaCalmClaimAllowed,
  });

  return [copy.cardSummary, ...copy.detailBullets, copy.tradeoffText || ''].join(' ');
};

const profile = (partial: Partial<WindProfile>): WindProfile => ({
  beachFacingDirection: null,
  shelterLevel: 'unknown',
  fetchExposure: 'unknown',
  exposedToWindDirections: [],
  protectedFromWindDirections: [],
  knownWindSportSpot: false,
  localWindAmplification: 'unknown',
  confidence: 'low',
  notes: 'Validation profile.',
  ...partial,
});

const chrysiAkti = baseBeach({
  id: 1853,
  name: { en: 'Golden Beach', gr: 'Χρυσή Ακτή' },
  location: { island: 'Paros', region: 'South Aegean' },
});

const parosShelteredAlternatives = [1, 2, 3, 4].map(index => baseBeach({
  id: 1900 + index,
  name: { en: `Sheltered Paros ${index}`, gr: `Sheltered Paros ${index}` },
  location: { island: 'Paros', region: 'South Aegean' },
  windProfile: profile({
    shelterLevel: 'sheltered',
    fetchExposure: 'low',
    protectedFromWindDirections: ['N'],
    confidence: 'medium',
  }),
}));

const syneti = baseBeach({
  id: 1541,
  name: { en: 'Syneti', gr: 'Συνετί' },
  location: { island: 'Andros', region: 'South Aegean' },
});

const pisoGialia = baseBeach({
  id: 1535,
  name: { en: 'Piso Gialia', gr: 'Πίσω Γυάλια' },
  location: { island: 'Andros', region: 'South Aegean' },
});

const apothikes = baseBeach({
  id: 1506,
  name: { en: 'Apothikes', gr: 'Αποθηκες' },
  location: { island: 'Andros', region: 'South Aegean' },
});

const genericOpen = baseBeach({
  id: 3001,
  name: { en: 'Open High Fetch', gr: 'Open High Fetch' },
  location: { island: 'Generic', region: 'Generic' },
  windProfile: profile({
    shelterLevel: 'open',
    fetchExposure: 'high',
    exposedToWindDirections: ['N'],
    confidence: 'medium',
  }),
});

const genericSheltered = baseBeach({
  id: 3002,
  name: { en: 'Sheltered Low Fetch', gr: 'Sheltered Low Fetch' },
  location: { island: 'Generic', region: 'Generic' },
  windProfile: profile({
    shelterLevel: 'sheltered',
    fetchExposure: 'low',
    protectedFromWindDirections: ['N'],
    confidence: 'medium',
  }),
});

const genericUnknown = baseBeach({
  id: 3003,
  name: { en: 'Unknown Profile', gr: 'Unknown Profile' },
  location: { island: 'Generic', region: 'Generic' },
});

const genericLegacyNorthProtected = baseBeach({
  id: 3005,
  name: { en: 'Legacy North Protected', gr: 'Legacy North Protected' },
  location: { island: 'Generic', region: 'Generic' },
  protectedFrom: [WindDirection.N],
});

const genericLowConfidenceShelter = baseBeach({
  id: 3004,
  name: { en: 'Low Confidence Shelter', gr: 'Low Confidence Shelter' },
  location: { island: 'Generic', region: 'Generic' },
  windProfile: profile({
    shelterLevel: 'sheltered',
    fetchExposure: 'low',
    protectedFromWindDirections: ['N'],
    confidence: 'low',
  }),
});

const parosP0Ids = [
  2020, 2025, 2030, 2036, 2038, 2039, 2040, 2043, 2044, 2045, 2051, 2053, 2054, 2055, 2056,
];
const androsP0Ids = [
  1686, 1688, 1689, 1691, 1692, 1693, 1695, 1699, 1702, 1705, 1713, 1718, 1724, 1726,
];
const parosPhase21Ids = [
  2021, 2022, 2023, 2024, 2026, 2027, 2028, 2029, 2031, 2032, 2033, 2034, 2035, 2037, 2041,
  2042, 2046, 2047, 2048, 2049, 2050, 2052,
];
const androsPhase21Ids = [
  1687, 1690, 1694, 1696, 1697, 1698, 1700, 1701, 1703, 1704, 1706, 1707, 1708, 1709, 1710,
  1711, 1712, 1714, 1715, 1716, 1717, 1719, 1720, 1721, 1722, 1723, 1725,
];
const milosP0Names = [
  'Agios Ioannis', 'Agios Sostis', 'Agia Kyriaki', 'Ammoudaraki', 'Achivadolimni',
  'Gerontas', 'Gerania', 'Thiafes', 'Kapros', 'Katergo', 'Kipi', 'Lagkada',
  'Navtikos Omilos Milou', 'Nerodafni', 'Palaiochori', 'Papafragkas', 'Papikinou',
  'Plathiena', 'Provatas', 'Rivari', 'Sarakiniko', 'Tourkothalassa', 'Triades',
  'Tsigkrado', 'Fatourena', 'Fyriplaka', 'Fyropotamos', 'Psathi', 'Psarovolada',
];
const milosPhase3CoverageNames = [
  'Agios Dimitrios', 'Kalamos', 'Kampanes', 'Paralia Angathia', 'Fyrlingkos',
  'Pollonia', 'Agkali', 'Voudia', 'Kastanas', 'Kolympisionas', 'Rema', 'Tria Pigadia',
];
const naxosPhase1CoverageNames = [
  'Agia Anna', 'Agiassos', 'Agii Theodori', 'Agios Georgios', 'Agios Prokopios',
  'Azalas', 'Alyko', 'Ammitis', 'Ampram', 'Apollonas', 'Vintzi', 'Glatza',
  'Glyfada', 'Grotta', 'Paralia Kalantos', 'Kampos', 'Kastraki', 'Kedros',
  'Klidos', 'Paralia Klido', 'Ligaridia', 'Paralia Limnari', 'Lionas', 'Melino',
  'Mikra', 'Mikri Vigla', 'Mikri Vigla - Notia plevra', 'Mikro Alyko', 'Moutsouna',
  'Orkos', 'Panormos', 'Plaka', 'Pyrgaki', 'Rina', 'Paralia Spedo', 'Chilia Vrysi',
  'Paralia Psili Ammos', 'Paralia Psofagrilia', 'Hawaii',
];
const milosNorthExposedNames = ['Papafragkas', 'Plathiena', 'Sarakiniko', 'Tourkothalassa', 'Fyropotamos'];
const milosNorthSensitiveLowConfidenceNames = ['Gerania', 'Kapros', 'Nerodafni'];
const milosSouthFacingNames = ['Agios Sostis', 'Agia Kyriaki', 'Kipi', 'Palaiochori', 'Provatas', 'Tsigkrado', 'Fyriplaka', 'Psarovolada'];
const milosBayCandidateNames = ['Lagkada', 'Navtikos Omilos Milou', 'Papikinou', 'Rivari', 'Fatourena'];
const naxosNorthExposedNames = [
  'Agii Theodori', 'Ammitis', 'Ampram', 'Glatza', 'Kampos', 'Melino', 'Mikra',
  'Chilia Vrysi',
];
const naxosEastExposedNames = [
  'Azalas', 'Ligaridia', 'Paralia Limnari', 'Lionas', 'Paralia Psofagrilia',
];

const parosBeaches = loadAppRegionBeaches('south-aegean-paros');
const androsBeaches = loadAppRegionBeaches('south-aegean-andros');
const milosBeaches = loadAppRegionBeaches('south-aegean-milos');
const milosGeospatialProfiles = loadGeneratedGeospatialProfiles('south-aegean-milos');
const naxosBeaches = loadAppRegionBeaches('south-aegean-naxos');
const kythnosBeaches = loadAppRegionBeaches('south-aegean-kythnos');
const kythnosGeospatialProfiles = loadGeneratedGeospatialProfiles('south-aegean-kythnos');

const byId = (beaches: Beach[], id: number): Beach => {
  const beach = beaches.find(item => item.id === id);
  assert(Boolean(beach), `Beach id ${id} must exist in app data.`);
  return beach as Beach;
};

const byEnglishName = (beaches: Beach[], name: string): Beach => {
  const beach = beaches.find(item => item.name.en === name || item.aliases?.includes(name));
  assert(Boolean(beach), `Beach ${name} must exist in app data.`);
  return beach as Beach;
};

const idsByEnglishName = (beaches: Beach[], names: string[]): number[] => (
  names.map(name => byEnglishName(beaches, name).id)
);

const milosP0Ids = idsByEnglishName(milosBeaches, milosP0Names);
const milosPhase3CoverageIds = idsByEnglishName(milosBeaches, milosPhase3CoverageNames);
const milosNorthExposedIds = idsByEnglishName(milosBeaches, milosNorthExposedNames);
const milosNorthSensitiveLowConfidenceIds = idsByEnglishName(milosBeaches, milosNorthSensitiveLowConfidenceNames);
const milosSouthFacingIds = idsByEnglishName(milosBeaches, milosSouthFacingNames);
const milosBayCandidateIds = idsByEnglishName(milosBeaches, milosBayCandidateNames);
const naxosPhase1CoverageIds = idsByEnglishName(naxosBeaches, naxosPhase1CoverageNames);
const naxosMediumEvidenceGateIds = [
  1991, 1992, 1999, 2000, 2002, 2004, 2015, 2016, 2017,
];
const naxosLowEvidenceGateIds = naxosPhase1CoverageIds
  .filter(id => !naxosMediumEvidenceGateIds.includes(id));
const naxosNorthExposedIds = idsByEnglishName(naxosBeaches, naxosNorthExposedNames);
const naxosEastExposedIds = idsByEnglishName(naxosBeaches, naxosEastExposedNames);
const mikriVigla = byEnglishName(naxosBeaches, 'Mikri Vigla');
const mikriViglaSouth = byEnglishName(naxosBeaches, 'Mikri Vigla - Notia plevra');
const plaka = byEnglishName(naxosBeaches, 'Plaka');
const achivadolimni = byEnglishName(milosBeaches, 'Achivadolimni');
const papikinou = byEnglishName(milosBeaches, 'Papikinou');
const sarakiniko = byEnglishName(milosBeaches, 'Sarakiniko');
const papafragas = byEnglishName(milosBeaches, 'Papafragkas');
const fyropotamos = byEnglishName(milosBeaches, 'Fyropotamos');
const plathiena = byEnglishName(milosBeaches, 'Plathiena');
const tsigrado = byEnglishName(milosBeaches, 'Tsigkrado');

const coverageReport = (beaches: Beach[], p0Ids: number[], phase21Ids: number[]) => {
  const p0Set = new Set(p0Ids);
  const phase21Set = new Set(phase21Ids);
  const assessments = beaches.map(beach => ({
    beach,
    assessment: assessBeachWindExposure({ beach, ...northFiveBeaufort }),
  }));
  return {
    total: beaches.length,
    p0Profiles: assessments.filter(({ beach, assessment }) => p0Set.has(beach.id) && assessment.source === 'override').length,
    phase21Profiles: assessments.filter(({ beach, assessment }) => phase21Set.has(beach.id) && assessment.source === 'override').length,
    overrideProfiles: assessments.filter(({ assessment }) => assessment.source === 'override').length,
    unknownSourceProfiles: assessments.filter(({ assessment }) => assessment.source === 'unknown').length,
    highConfidence: assessments.filter(({ assessment }) => assessment.windProfile.confidence === 'high').length,
    mediumConfidence: assessments.filter(({ assessment }) => assessment.windProfile.confidence === 'medium').length,
    lowConfidence: assessments.filter(({ assessment }) => assessment.windProfile.confidence === 'low').length,
    unknownShelterProfiles: assessments.filter(({ assessment }) => assessment.windProfile.shelterLevel === 'unknown').length,
    unknownFetchProfiles: assessments.filter(({ assessment }) => assessment.windProfile.fetchExposure === 'unknown').length,
    northProtectionClaims: assessments.filter(({ assessment }) => assessment.canClaimProtected).length,
  };
};

const highConfidenceIdsFor = (beaches: Beach[]): number[] => beaches
  .map(beach => ({
    beach,
    assessment: assessBeachWindExposure({ beach, ...northFiveBeaufort }),
  }))
  .filter(({ assessment }) => assessment.windProfile.confidence === 'high')
  .map(({ beach }) => beach.id)
  .sort((a, b) => a - b);

const assertExactIds = (actual: number[], expected: number[], message: string) => {
  const sortedActual = [...actual].sort((a, b) => a - b);
  const sortedExpected = [...expected].sort((a, b) => a - b);
  assert(
    sortedActual.length === sortedExpected.length &&
      sortedActual.every((id, index) => id === sortedExpected[index]),
    `${message}. Expected ${sortedExpected.join(',')}; got ${sortedActual.join(',')}.`
  );
};

const chrysiAssessment = assessBeachWindExposure({ beach: chrysiAkti, ...northFiveBeaufort });
const parosTop3 = [chrysiAkti, ...parosShelteredAlternatives]
  .sort((a, b) => scenarioScore(b) - scenarioScore(a))
  .slice(0, 3)
  .map(beach => beach.id);

const parosCoverage = coverageReport(parosBeaches, parosP0Ids, parosPhase21Ids);
const androsCoverage = coverageReport(androsBeaches, androsP0Ids, androsPhase21Ids);
const milosCoverage = coverageReport(milosBeaches, milosP0Ids, milosPhase3CoverageIds);
const naxosCoverage = coverageReport(naxosBeaches, [], naxosPhase1CoverageIds);
const parosHighConfidenceIds = highConfidenceIdsFor(parosBeaches);
const milosHighConfidenceIds = highConfidenceIdsFor(milosBeaches);
const parosRealTop3 = [...parosBeaches]
  .sort((a, b) => scenarioScore(b) - scenarioScore(a))
  .slice(0, 3)
  .map(beach => beach.id);
const milosNorthFiveTop3 = [...milosBeaches]
  .sort((a, b) => scenarioScore(b, milosNorthFiveBeaufort) - scenarioScore(a, milosNorthFiveBeaufort))
  .slice(0, 3)
  .map(beach => beach.id);
const milosSouthFiveTop3 = [...milosBeaches]
  .sort((a, b) => scenarioScore(b, milosSouthFiveBeaufort) - scenarioScore(a, milosSouthFiveBeaufort))
  .slice(0, 3)
  .map(beach => beach.id);
const milosSouthwestFourMapLevels = new Map(milosBeaches.map(beach => {
  const assessment = assessBeachWindExposure({ beach, ...milosSouthwestFourBeaufort });
  return [
    beach.id,
    visibleMapExposureDecision(beach, assessment, milosSouthwestFourBeaufort, milosGeospatialProfiles[beach.id]),
  ];
}));
const milosNorthFourItems = milosBeaches.map(beach => {
  const geospatialExposure = milosGeospatialProfiles[beach.id];
  const assessment = assessBeachWindExposure({
    beach,
    geospatialProfile: geospatialExposure,
    ...northFourBeaufort,
  });

  return {
    beach,
    exposureLevel: assessment.exposureLevel,
    orientation: assessment.facingDeg,
    windProfile: assessment.windProfile,
    windProfileSource: assessment.source,
    windSector: assessment.windSector,
    warnings: assessment.warnings,
    geospatialExposure,
  };
});
const milosNorthFourMapLevels = getConsistentVisibleMapExposureLevels(
  milosNorthFourItems,
  northFourBeaufort.beaufort,
  northFourBeaufort.windDirectionDeg
);
const kythnosNorthFourItems = kythnosBeaches.map(beach => {
  const geospatialExposure = kythnosGeospatialProfiles[beach.id];
  const assessment = assessBeachWindExposure({
    beach,
    geospatialProfile: geospatialExposure,
    ...northFourBeaufort,
  });

  return {
    beach,
    exposureLevel: assessment.exposureLevel,
    orientation: assessment.facingDeg,
    windProfile: assessment.windProfile,
    windProfileSource: assessment.source,
    windSector: assessment.windSector,
    warnings: assessment.warnings,
    geospatialExposure,
  };
});
const kythnosNorthFourMapLevels = getConsistentVisibleMapExposureLevels(
  kythnosNorthFourItems,
  northFourBeaufort.beaufort,
  northFourBeaufort.windDirectionDeg
);
const p0WindProfilesCovered = parosCoverage.p0Profiles + androsCoverage.p0Profiles;
const phase21WindProfilesAdded = parosCoverage.phase21Profiles + androsCoverage.phase21Profiles;
const allProfilesCovered = parosCoverage.overrideProfiles + androsCoverage.overrideProfiles;
const naxosWindProfilesCovered = naxosCoverage.overrideProfiles;

assert(parosBeaches.length === 37, 'Coverage: Paros app data must contain 37 beaches.');
assert(androsBeaches.length === 41, 'Coverage: Andros app data must contain 41 beaches.');
assert(milosBeaches.length === 41, 'Coverage: Milos app data must contain 41 beaches.');
assert(naxosBeaches.length === 39, 'Coverage: Naxos app data must contain 39 beaches.');
assert(parosCoverage.p0Profiles === parosP0Ids.length, 'Coverage: all Paros P0 beaches must have windProfile overrides.');
assert(androsCoverage.p0Profiles === androsP0Ids.length, 'Coverage: all Andros P0 beaches must have windProfile overrides.');
assert(milosCoverage.p0Profiles === milosP0Ids.length, 'Coverage: all Milos P0 beaches must have windProfile overrides.');
assert(parosCoverage.phase21Profiles === parosPhase21Ids.length, 'Coverage: all Paros Phase 2.1 beaches must have windProfile overrides.');
assert(androsCoverage.phase21Profiles === androsPhase21Ids.length, 'Coverage: all Andros Phase 2.1 beaches must have windProfile overrides.');
assert(milosCoverage.phase21Profiles === milosPhase3CoverageIds.length, 'Coverage: all Milos Phase 3 coverage beaches must have low-confidence windProfile overrides.');
assert(naxosCoverage.phase21Profiles === naxosPhase1CoverageIds.length, 'Coverage: all Naxos Phase 1 beaches must have audited windProfile overrides.');
assert(p0WindProfilesCovered === 29, 'Coverage: Phase 2 P0 should still cover 29 high-impact profiles.');
assert(phase21WindProfilesAdded === 49, 'Coverage: Phase 2.1 should add 49 remaining profiles.');
assert(parosCoverage.overrideProfiles === parosCoverage.total, 'Coverage: Paros must reach 37/37 windProfile coverage.');
assert(androsCoverage.overrideProfiles === androsCoverage.total, 'Coverage: Andros must reach 41/41 windProfile coverage.');
assert(allProfilesCovered === 78, 'Coverage: Paros and Andros must reach 78/78 combined windProfile coverage.');
assert(parosCoverage.unknownSourceProfiles === 0, 'Coverage: Paros should have no source-missing windProfiles after Phase 2.1.');
assert(androsCoverage.unknownSourceProfiles === 0, 'Coverage: Andros should have no source-missing windProfiles after Phase 2.1.');
assert(milosCoverage.overrideProfiles === milosCoverage.total, 'Coverage: Milos should reach 41/41 windProfile override coverage.');
assert(milosCoverage.unknownSourceProfiles === 0, 'Coverage: Milos should have no source-missing windProfiles after Phase 3 coverage.');
assertExactIds(milosHighConfidenceIds, [achivadolimni.id], 'Coverage: Milos high-confidence profiles must stay limited to evidence-approved wind-sport spots');
assert(milosCoverage.lowConfidence >= 12, 'Coverage: Milos P0 should remain conservative with many low-confidence profiles.');
assertExactIds(
  parosHighConfidenceIds,
  [
    byEnglishName(parosBeaches, 'Kolympithres').id,
    byEnglishName(parosBeaches, 'Monastiri').id,
    byEnglishName(parosBeaches, 'Paralia Alyki').id,
    byEnglishName(parosBeaches, 'Chrysi Akti').id,
    byEnglishName(parosBeaches, 'Tserdakia (Nea Chrysi Akti)').id,
    byEnglishName(parosBeaches, 'Tsoukalia').id,
    byEnglishName(parosBeaches, 'Farangas').id,
  ],
  'Coverage: Paros high-confidence profiles must stay limited to evidence-approved wind-sport or sheltered-bay spots'
);
[
  'Kolympithres',
  'Monastiri',
  'Paralia Alyki',
  'Farangas',
].forEach(name => {
  const assessment = assessBeachWindExposure({ beach: byEnglishName(parosBeaches, name), ...northFiveBeaufort });
  assert(assessment.windProfile.confidence === 'high', `Paros 5 Bft N: ${name} must remain high-confidence after sheltered-bay evidence review.`);
  assert(assessment.canClaimProtected, `Paros 5 Bft N: ${name} may claim protected only because beach-specific sheltered-bay evidence exists.`);
});
assert(naxosCoverage.overrideProfiles === naxosCoverage.total, 'Coverage: Naxos should reach 39/39 windProfile override coverage.');
assert(naxosWindProfilesCovered === 39, 'Coverage: Naxos Phase 1 should cover 39/39 windProfiles.');
assert(naxosCoverage.unknownSourceProfiles === 0, 'Coverage: Naxos should have no source-missing windProfiles after Phase 1 coverage.');
assert(naxosCoverage.highConfidence === 0, 'Coverage: Naxos Phase 1 must not create high-confidence profiles from map/geospatial evidence alone.');
assert(naxosCoverage.mediumConfidence === naxosMediumEvidenceGateIds.length, 'Coverage: Naxos medium-confidence upgrades must match the wind-profile evidence gate.');
assert(naxosCoverage.lowConfidence === naxosLowEvidenceGateIds.length, 'Coverage: Naxos low-confidence profiles must remain low until the evidence gate passes.');
assert(naxosCoverage.northProtectionClaims === 0, 'Coverage: Naxos Phase 1 must not create north-wind protection claims.');
assert(kythnosNorthFourMapLevels.get(1875) === 'protected', 'Kythnos N 4BFT: Kaki Maria bay should remain protected/blue.');
assert(kythnosNorthFourMapLevels.get(1876) === 'protected', 'Kythnos N 4BFT: Kalo Livadi bay should remain protected/blue.');
assert(kythnosNorthFourMapLevels.get(1881) === 'protected', 'Kythnos N 4BFT: Levkes bay should remain protected/blue.');
assert(kythnosNorthFourMapLevels.get(1863) === 'partial', 'Kythnos N 4BFT: Agia Irini must stay partial/yellow, not inherit protected/blue.');
assert(kythnosNorthFourMapLevels.get(1884) === 'partial', 'Kythnos N 4BFT: Maroula must stay partial/yellow, not inherit protected/blue.');
assert(kythnosNorthFourMapLevels.get(1882) === 'exposed', 'Kythnos N 4BFT: Livadaki should remain exposed/yellow.');
assert(kythnosNorthFourMapLevels.get(1886) === 'exposed', 'Kythnos N 4BFT: Mikro Livadaki should remain exposed/yellow.');
[
  1932, // Pollonia
  1916, // Papafragkas
  1908, // Kapros
].forEach(id => {
  assert(milosNorthFourMapLevels.get(id) === 'exposed', `Milos N 4BFT: ${id} must stay exposed/yellow on the north/east-facing coast.`);
  const uiItemWithoutProfileSource = milosNorthFourItems.find(item => item.beach.id === id);
  assert(Boolean(uiItemWithoutProfileSource), `Milos N 4BFT: ${id} test item must exist.`);
  assert(
    getVisibleMapExposureLevel(
      { ...uiItemWithoutProfileSource, windProfileSource: undefined },
      northFourBeaufort.beaufort,
      northFourBeaufort.windDirectionDeg
    ) === 'exposed',
    `Milos N 4BFT: ${id} must stay exposed/yellow even if a UI path omits windProfileSource.`
  );
});
[
  1936, // Kolympisionas
].forEach(id => {
  assert(milosNorthFourMapLevels.get(id) === 'partial', `Milos N 4BFT: ${id} must stay partial/yellow when geospatial exposure is partial.`);
});
[
  1934, // Voudia
  1935, // Kastanas
  1938, // Tria Pigadia
  1928, // Fyrlingkos
  1915, // Palaiochori
  1931, // Psarovolada
  1901, // Agia Kyriaki
  // 2026-06-10 high-res coastline rebuild: the OSM mask resolves Kimolos and
  // the Pollonia channel headlands, so these NE-coast beaches drop from 6-9 km
  // of phantom north fetch to 0-4 km and their N sector is now protected.
  1933, // Agkali
  1937, // Rema
  1906, // Thiafes
].forEach(id => {
  assert(milosNorthFourMapLevels.get(id) === 'protected', `Milos N 4BFT: ${id} should show protected/blue when geospatial north exposure is protected.`);
});

assert(!parosTop3.includes(chrysiAkti.id), 'Paros 5 Bft N: Χρυσή Ακτή must not be Top 3.');
assert(!chrysiAssessment.canClaimProtected, 'Paros 5 Bft N: Χρυσή Ακτή must not be described as protected.');
assert(chrysiAssessment.warnings.some(warning => warning.type === 'wind_sport_spot'), 'Paros 5 Bft N: Χρυσή Ακτή must show wind/watersports warning.');

const realChrysi = byId(parosBeaches, 2056);
const realTserdakia = byId(parosBeaches, 2053);
const realAgkali = byId(parosBeaches, 2043);
const goldenClusterBeaches = [realChrysi, realTserdakia, realAgkali];
const goldenClusterAssessments = goldenClusterBeaches.map(beach => assessBeachWindExposure({ beach, ...northFiveBeaufort }));
const parosProfileIds = [...parosP0Ids, ...parosPhase21Ids];
const androsProfileIds = [...androsP0Ids, ...androsPhase21Ids];
const phase21Beaches = [
  ...parosPhase21Ids.map(id => byId(parosBeaches, id)),
  ...androsPhase21Ids.map(id => byId(androsBeaches, id)),
];
const phase21Assessments = phase21Beaches.map(beach => assessBeachWindExposure({ beach, ...northFiveBeaufort }));
const allProfileBeaches = [
  ...parosProfileIds.map(id => byId(parosBeaches, id)),
  ...androsProfileIds.map(id => byId(androsBeaches, id)),
  ...naxosPhase1CoverageIds.map(id => byId(naxosBeaches, id)),
];
const allProfileAssessments = allProfileBeaches.map(beach => assessBeachWindExposure({ beach, ...northFiveBeaufort, waveHeightMeters: 0.3 }));
const parosExposureLevels = new Set(parosProfileIds.map(id => assessBeachWindExposure({ beach: byId(parosBeaches, id), ...northFiveBeaufort }).exposureLevel));
const parosScores = new Set(parosProfileIds.map(id => scenarioScore(byId(parosBeaches, id))));
const pountaAssessment = assessBeachWindExposure({ beach: byId(parosBeaches, 2049), ...northFiveBeaufort });
const pountaLabels = visibleLabelDecision(pountaAssessment);
const goldenClusterThreeAssessments = goldenClusterBeaches.map(beach => assessBeachWindExposure({ beach, ...northThreeBeaufort }));
const pountaThreeAssessment = assessBeachWindExposure({ beach: byId(parosBeaches, 2049), ...northThreeBeaufort });
const goldenClusterThreeChoppyAssessments = goldenClusterBeaches.map(beach => assessBeachWindExposure({ beach, ...northThreeBeaufortParosChoppy }));
const pountaThreeChoppyAssessment = assessBeachWindExposure({ beach: byId(parosBeaches, 2049), ...northThreeBeaufortParosChoppy });
const parosThreeScores = new Set(parosProfileIds.map(id => scenarioScore(byId(parosBeaches, id), northThreeBeaufort)));

assert(!parosRealTop3.includes(realChrysi.id), 'Paros real data 5 Bft N: Chrysi Akti must not be Top 3.');
goldenClusterAssessments.forEach(assessment => {
  const labels = visibleLabelDecision(assessment);
  assert(!assessment.canClaimProtected, 'Paros Golden Beach cluster must not claim wind protection in 5 Bft north wind.');
  assert(!labels.protectedLabel && !labels.calmLabel, 'Paros Golden Beach cluster must not show protected/calm labels.');
  assert(assessment.warnings.some(warning => warning.type === 'wind_sport_spot'), 'Paros Golden Beach cluster must show wind/watersports warning.');
});
assert(pountaAssessment.isKnownWindSportRisk, 'Paros 5 Bft N: Pounta must be treated as a windy/kite risk.');
assert(!pountaAssessment.canClaimProtected, 'Paros 5 Bft N: Pounta must not claim wind protection.');
assert(!pountaLabels.protectedLabel && !pountaLabels.calmLabel, 'Paros 5 Bft N: Pounta must not show protected/calm labels.');
assert(pountaAssessment.warnings.some(warning => warning.type === 'wind_sport_spot'), 'Paros 5 Bft N: Pounta must show wind/watersports warning.');
assert(parosExposureLevels.size > 1 && parosScores.size > 1, 'Paros beaches must not all receive the same exposure evaluation.');
goldenClusterBeaches.forEach((beach, index) => {
  const assessment = goldenClusterThreeAssessments[index];
  assert(scenarioScore(beach, northThreeBeaufort) > 45, 'Paros 3 Bft N: Golden Beach cluster must not collapse to score 0.');
  assert(!assessment.isKnownWindSportRisk, 'Paros 3 Bft N: Golden Beach cluster must not trigger hard wind-sport risk.');
  assert(!assessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Paros 3 Bft N: Golden Beach cluster must not show strong wind-sport warning.');
  assert(assessment.finalScoreCap === undefined || assessment.finalScoreCap >= 70, 'Paros 3 Bft N: Golden Beach cluster must not receive a harsh final-score cap.');
});
assert(scenarioScore(byId(parosBeaches, 2049), northThreeBeaufort) > 45, 'Paros 3 Bft N: Pounta must not collapse to score 0.');
assert(!pountaThreeAssessment.isKnownWindSportRisk, 'Paros 3 Bft N: Pounta must not trigger hard wind-sport risk.');
assert(!pountaThreeAssessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Paros 3 Bft N: Pounta must not show strong wind-sport warning.');
assert(parosThreeScores.size > 1, 'Paros 3 Bft N: normal beach quality/local exposure should still create varied scores.');
goldenClusterBeaches.forEach((beach, index) => {
  const assessment = goldenClusterThreeChoppyAssessments[index];
  assert(scenarioScore(beach, northThreeBeaufortParosChoppy) > 45, 'Paros choppy 3 Bft N: Golden Beach cluster must not collapse to score 0.');
  assert(!assessment.isKnownWindSportRisk, 'Paros choppy 3 Bft N: Golden Beach cluster must not trigger hard wind-sport risk.');
  assert(!assessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Paros choppy 3 Bft N: Golden Beach cluster must not show strong wind-sport warning.');
});
assert(scenarioScore(byId(parosBeaches, 2049), northThreeBeaufortParosChoppy) > 45, 'Paros choppy 3 Bft N: Pounta must not collapse to score 0.');
assert(!pountaThreeChoppyAssessment.isKnownWindSportRisk, 'Paros choppy 3 Bft N: Pounta must not trigger hard wind-sport risk.');
assert(!pountaThreeChoppyAssessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Paros choppy 3 Bft N: Pounta must not show strong wind-sport warning.');
assertNoStrongWarningCopy(
  generatedCopyText(byId(parosBeaches, 2049), pountaThreeAssessment, northThreeBeaufort),
  'Paros 3 Bft N: Pounta generated copy'
);
assertHasClearCautionCopy(
  generatedCopyText(byId(parosBeaches, 2049), pountaAssessment, northFiveBeaufort),
  'Paros 5 Bft N: Pounta generated copy'
);

const synetiAssessment = assessBeachWindExposure({ beach: syneti, ...northFiveBeaufort });
const pisoAssessment = assessBeachWindExposure({ beach: pisoGialia, ...northFiveBeaufort });
const apothikesAssessment = assessBeachWindExposure({ beach: apothikes, ...northFiveBeaufort });
const realSynetiAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1724), ...northFiveBeaufort });
const realPisoAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1718), ...northFiveBeaufort });
const realApothikesAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1689), ...northFiveBeaufort });
const realAteniAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1691), ...northFiveBeaufort });
const realSynetiThreeAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1724), ...northThreeBeaufort });
const realPisoThreeAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1718), ...northThreeBeaufort });
const realApothikesThreeAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1689), ...northThreeBeaufort });
const realSynetiThreeChoppyAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1724), ...northThreeBeaufortAndrosChoppy });
const realPisoThreeChoppyAssessment = assessBeachWindExposure({ beach: byId(androsBeaches, 1718), ...northThreeBeaufortAndrosChoppy });

assert(scenarioScore(syneti) < scenarioScore(pisoGialia), 'Andros 5 Bft N: Συνετί should score lower than Πίσω Γυάλια.');
assert(apothikesAssessment.exposureLevel !== synetiAssessment.exposureLevel, 'Andros 5 Bft N: Αποθήκες should not match north-exposed exposure.');
assert(apothikesAssessment.reasons.join('|') !== synetiAssessment.reasons.join('|'), 'Andros 5 Bft N: explanations/reasons should differ by local exposure.');

assert(scenarioScore(byId(androsBeaches, 1724)) < scenarioScore(byId(androsBeaches, 1718)), 'Andros real data 5 Bft N: Syneti should score lower than Piso Gialia.');
assert(realSynetiAssessment.exposureLevel === 'exposed', 'Andros real data 5 Bft N: Syneti should remain exposed.');
assert(realPisoAssessment.canClaimProtected, 'Andros real data 5 Bft N: Piso Gialia should remain a verified protected option.');
assert(realApothikesAssessment.exposureLevel !== realAteniAssessment.exposureLevel, 'Andros real data 5 Bft N: Apothikes should differ from north-exposed Ateni.');
assert(realApothikesAssessment.reasons.join('|') !== realAteniAssessment.reasons.join('|'), 'Andros real data 5 Bft N: Apothikes and north-exposed beaches need different reasons.');
assert(scenarioScore(byId(androsBeaches, 1724), northThreeBeaufort) >= 50, 'Andros 3 Bft N: Syneti should not be over-suppressed.');
assert(
  scenarioScore(byId(androsBeaches, 1718), northThreeBeaufort) - scenarioScore(byId(androsBeaches, 1724), northThreeBeaufort) <= 40,
  'Andros 3 Bft N: Piso Gialia may rank better than Syneti, but the gap should not be extreme.'
);
assert(realSynetiThreeAssessment.exposureLevel === 'exposed', 'Andros 3 Bft N: Syneti can remain exposed without being hard-penalized.');
assert(realPisoThreeAssessment.canClaimProtected, 'Andros 3 Bft N: Piso Gialia can still be identified as better sheltered.');
assert(realApothikesThreeAssessment.exposureLevel === 'partial', 'Andros 3 Bft N: Apothikes should remain a semi-sheltered alternative.');
assert(scenarioScore(byId(androsBeaches, 1724), northThreeBeaufortAndrosChoppy) >= 50, 'Andros choppy 3 Bft N: Syneti should not receive a harsh wind-driven penalty.');
assert(
  scenarioScore(byId(androsBeaches, 1718), northThreeBeaufortAndrosChoppy) > scenarioScore(byId(androsBeaches, 1724), northThreeBeaufortAndrosChoppy),
  'Andros choppy 3 Bft N: Piso Gialia should still rank better than exposed Syneti.'
);
assert(!realSynetiThreeChoppyAssessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Andros choppy 3 Bft N: Syneti must not show hard wind-sport warnings.');
assert(!realPisoThreeChoppyAssessment.warnings.some(warning => warning.severity === 'warning'), 'Andros choppy 3 Bft N: Piso Gialia must not show hard warning severity.');
assert(
  scenarioScore(byId(androsBeaches, 1689), northFiveBeaufort) >= 60 &&
  scenarioScore(byId(androsBeaches, 1689), northFiveBeaufort) < scenarioScore(byId(androsBeaches, 1718), northFiveBeaufort),
  'Andros 5 Bft N: Apothikes may remain an okay-with-caution alternative, but should not outrank Piso Gialia.'
);

const milosNorthExposedAssessments = milosNorthExposedIds.map(id => assessBeachWindExposure({
  beach: byId(milosBeaches, id),
  ...milosNorthFiveBeaufort,
}));
const milosNorthSensitiveLowConfidenceAssessments = milosNorthSensitiveLowConfidenceIds.map(id => assessBeachWindExposure({
  beach: byId(milosBeaches, id),
  ...milosNorthFiveBeaufort,
}));
const milosNorthFivePartialKnownAssessments = milosSouthFacingIds.map(id => assessBeachWindExposure({
  beach: byId(milosBeaches, id),
  ...milosNorthFiveBeaufort,
}));
const milosNorthSixPartialKnownAssessments = milosSouthFacingIds.map(id => assessBeachWindExposure({
  beach: byId(milosBeaches, id),
  ...milosNorthSixBeaufort,
}));
const milosSouthFacingSouthAssessments = milosSouthFacingIds.map(id => assessBeachWindExposure({
  beach: byId(milosBeaches, id),
  ...milosSouthFiveBeaufort,
}));
const milosLowConfidenceBeachIds = milosP0Ids.filter(id => (
  assessBeachWindExposure({ beach: byId(milosBeaches, id), ...milosNorthFiveBeaufort, waveHeightMeters: 0.3 }).windProfile.confidence === 'low'
));
const milosLowConfidenceAssessments = milosLowConfidenceBeachIds
  .map(id => assessBeachWindExposure({ beach: byId(milosBeaches, id), ...milosNorthFiveBeaufort, waveHeightMeters: 0.3 }));
const milosPhase3CoverageAssessments = milosPhase3CoverageIds.map(id => assessBeachWindExposure({
  beach: byId(milosBeaches, id),
  ...milosNorthFiveBeaufort,
  waveHeightMeters: 0.3,
}));
const achivadolimniNorthFiveAssessment = assessBeachWindExposure({
  beach: achivadolimni,
  ...milosNorthFiveBeaufort,
});
const achivadolimniNorthSixAssessment = assessBeachWindExposure({
  beach: achivadolimni,
  ...milosNorthSixBeaufort,
});
const achivadolimniNorthThreeAssessment = assessBeachWindExposure({
  beach: achivadolimni,
  ...milosNorthThreeBeaufort,
});
const papikinouNorthFiveAssessment = assessBeachWindExposure({
  beach: papikinou,
  ...milosNorthFiveBeaufort,
});
const papikinouNorthThreeAssessment = assessBeachWindExposure({
  beach: papikinou,
  ...milosNorthThreeBeaufort,
});
const sarakinikoNorthFiveAssessment = assessBeachWindExposure({
  beach: sarakiniko,
  ...milosNorthFiveBeaufort,
});
const sarakinikoNorthThreeAssessment = assessBeachWindExposure({
  beach: sarakiniko,
  ...milosNorthThreeBeaufort,
});
const papafragasNorthFiveAssessment = assessBeachWindExposure({
  beach: papafragas,
  ...milosNorthFiveBeaufort,
});
const fyropotamosNorthFiveAssessment = assessBeachWindExposure({
  beach: fyropotamos,
  ...milosNorthFiveBeaufort,
});
const plathienaNorthFiveAssessment = assessBeachWindExposure({
  beach: plathiena,
  ...milosNorthFiveBeaufort,
});
const tsigradoSouthFiveAssessment = assessBeachWindExposure({
  beach: tsigrado,
  ...milosSouthFiveBeaufort,
});
const naxosNorthExposedAssessments = naxosNorthExposedIds.map(id => assessBeachWindExposure({
  beach: byId(naxosBeaches, id),
  ...northFiveBeaufort,
}));
const naxosEastExposedAssessments = naxosEastExposedIds.map(id => assessBeachWindExposure({
  beach: byId(naxosBeaches, id),
  ...northFiveBeaufort,
}));
const naxosPhase1CoverageAssessments = naxosPhase1CoverageIds.map(id => assessBeachWindExposure({
  beach: byId(naxosBeaches, id),
  ...northFiveBeaufort,
  waveHeightMeters: 0.3,
}));
const mikriViglaNorthFiveAssessment = assessBeachWindExposure({
  beach: mikriVigla,
  ...northFiveBeaufort,
});
const mikriViglaNorthThreeAssessment = assessBeachWindExposure({
  beach: mikriVigla,
  ...northThreeBeaufort,
});
const mikriViglaSouthNorthFiveAssessment = assessBeachWindExposure({
  beach: mikriViglaSouth,
  ...northFiveBeaufort,
});
const plakaNorthFiveAssessment = assessBeachWindExposure({
  beach: plaka,
  ...northFiveBeaufort,
});

assert(milosNorthExposedIds.every(id => scenarioScore(byId(milosBeaches, id), milosNorthThreeBeaufort) > 45), 'Milos 3 Bft N: north-exposed beaches must not be over-penalized.');
assert(!sarakinikoNorthThreeAssessment.warnings.some(warning => warning.severity === 'warning'), 'Milos 3 Bft N: Sarakiniko must not show hard warnings in normal light wind.');
assert(!achivadolimniNorthThreeAssessment.isKnownWindSportRisk, 'Milos 3 Bft N: Achivadolimni must not trigger hard wind/watersports risk.');
assert(!achivadolimniNorthThreeAssessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Milos 3 Bft N: Achivadolimni must not show strong wind/watersports warning.');
assert(!papikinouNorthThreeAssessment.canClaimProtected, 'Milos 3 Bft N: Papikinou must not make guaranteed protected claims.');
assert(!visibleLabelDecision(papikinouNorthThreeAssessment).protectedLabel, 'Milos 3 Bft N: Papikinou must not show a protected label.');
assertNoStrongWarningCopy(
  generatedCopyText(sarakiniko, sarakinikoNorthThreeAssessment, milosNorthThreeBeaufort),
  'Milos 3 Bft N: Sarakiniko generated copy'
);
assertNoProtectedCalmClaims(
  generatedCopyText(papikinou, papikinouNorthThreeAssessment, milosNorthThreeBeaufort),
  'Milos 3 Bft N: Papikinou generated copy'
);
assert(
  scenarioScore(sarakiniko, milosNorthThreeBeaufortChoppy) > 45 &&
  !assessBeachWindExposure({
    beach: sarakiniko,
    ...milosNorthThreeBeaufortChoppy,
  }).warnings.some(warning => warning.severity === 'warning'),
  'Milos choppy 3 Bft N: Sarakiniko may show mild chop, not hard warning behavior.'
);

[
  sarakinikoNorthFiveAssessment,
  papafragasNorthFiveAssessment,
  fyropotamosNorthFiveAssessment,
  plathienaNorthFiveAssessment,
].forEach(assessment => {
  const labels = visibleLabelDecision(assessment);
  assert(!assessment.canClaimProtected, 'Milos 5 Bft N: high-impact north beaches must not claim protection.');
  assert(!labels.protectedLabel && !labels.calmLabel, 'Milos 5 Bft N: high-impact north beaches must not show protected/calm labels.');
});
milosNorthExposedAssessments.forEach((assessment, index) => {
  assert(assessment.exposureLevel !== 'protected', 'Milos 5 Bft N: north-exposed beaches must not evaluate as protected.');
  assert(scenarioScore(byId(milosBeaches, milosNorthExposedIds[index]), milosNorthFiveBeaufort) < 70, 'Milos 5 Bft N: north-exposed beaches must not score as strong calm/family picks.');
});
milosNorthSensitiveLowConfidenceAssessments.forEach(assessment => {
  const labels = visibleLabelDecision(assessment);
  assert(!assessment.canClaimProtected && !labels.protectedLabel && !labels.calmLabel, 'Milos 5 Bft N: low-confidence north-sensitive beaches must not claim protected/calm status.');
});
milosNorthFivePartialKnownAssessments.forEach((assessment, index) => {
  const beachId = milosSouthFacingIds[index];
  assert(assessment.exposureLevel === 'partial', 'Milos 5 Bft N: south-facing alternatives should remain partial, not falsely protected.');
  assert(scenarioScore(byId(milosBeaches, beachId), milosNorthFiveBeaufort) < 82, 'Milos 5 Bft N: partial beaches must not keep excellent-style 82 scores.');
});
milosNorthSixPartialKnownAssessments.forEach((assessment, index) => {
  const beachId = milosSouthFacingIds[index];
  assert(assessment.exposureLevel === 'partial', 'Milos 6 Bft N: south-facing alternatives should remain partial, not falsely protected.');
  assert(
    scenarioScore(byId(milosBeaches, beachId), milosNorthSixBeaufort) < scenarioScore(byId(milosBeaches, beachId), milosNorthFiveBeaufort),
    'Milos 6 Bft N: partial beaches must score worse than the same beach in 5 Bft.'
  );
});
milosLowConfidenceAssessments.forEach((assessment, index) => {
  const beachId = milosLowConfidenceBeachIds[index];
  assert(assessment.finalScoreCap !== undefined && assessment.finalScoreCap <= 65, 'Milos 5 Bft N: low-confidence profiles should receive a strong-wind score cap.');
  assert(scenarioScore(byId(milosBeaches, beachId), milosNorthFiveBeaufort) <= 65, 'Milos 5 Bft N: low-confidence profiles should not rank as strongly as known medium-confidence partial candidates.');
});
assert(achivadolimniNorthFiveAssessment.isKnownWindSportRisk, 'Milos 5 Bft N: Achivadolimni must be treated as a wind/watersports caution.');
assert(achivadolimniNorthFiveAssessment.warnings.some(warning => warning.type === 'wind_sport_spot'), 'Milos 5 Bft N: Achivadolimni must show wind/watersports warning.');
assert(!visibleLabelDecision(achivadolimniNorthFiveAssessment).protectedLabel, 'Milos 5 Bft N: Achivadolimni must not show protected label.');
assert(achivadolimniNorthFiveAssessment.simpleWindSuitability.suitabilityColor === 'red', 'Milos 5 Bft N: Achivadolimni simple suitability should remain red.');
assert(achivadolimniNorthFiveAssessment.simpleWindSuitability.exposureStatus === 'exposed', 'Milos 5 Bft N: Achivadolimni simple suitability should remain exposed.');
assert(achivadolimniNorthSixAssessment.simpleWindSuitability.suitabilityColor === 'red', 'Milos 6 Bft N: Achivadolimni simple suitability should remain red.');
assert(achivadolimniNorthSixAssessment.simpleWindSuitability.exposureStatus === 'exposed', 'Milos 6 Bft N: Achivadolimni simple suitability should remain exposed.');
assert(!papikinouNorthFiveAssessment.canClaimProtected, 'Milos 5 Bft N: Papikinou must not make guaranteed protected claims.');
assert(!visibleLabelDecision(papikinouNorthFiveAssessment).protectedLabel, 'Milos 5 Bft N: Papikinou must not show protected label.');
assertNoProtectedCalmClaims(
  generatedCopyText(papikinou, papikinouNorthFiveAssessment, milosNorthFiveBeaufort),
  'Milos 5 Bft N: Papikinou generated copy'
);
assertHasClearCautionCopy(
  generatedCopyText(achivadolimni, achivadolimniNorthFiveAssessment, milosNorthFiveBeaufort),
  'Milos 5 Bft N: Achivadolimni generated copy'
);
assert(!milosNorthFiveTop3.includes(sarakiniko.id), 'Milos 5 Bft N: Sarakiniko must not be Top 3 for calm/family swimming.');
assert(!milosNorthFiveTop3.includes(papafragas.id), 'Milos 5 Bft N: Papafragas must not be Top 3 for calm/family swimming.');
assert(!milosNorthFiveTop3.includes(fyropotamos.id), 'Milos 5 Bft N: Fyropotamos must not be Top 3 for calm/family swimming.');
assert(!milosNorthFiveTop3.includes(plathiena.id), 'Milos 5 Bft N: Plathiena must not be Top 3 for calm/family swimming.');
assert(!milosNorthFiveTop3.includes(achivadolimni.id), 'Milos 5 Bft N: Achivadolimni must not be Top 3 for calm/family swimming.');
assert(
  milosNorthFiveTop3.some(id => [...milosSouthFacingIds, ...milosBayCandidateIds].includes(id)),
  'Milos 5 Bft N: south/bay options should rise as better available alternatives.'
);

milosSouthFacingSouthAssessments.forEach((assessment, index) => {
  const beachId = milosSouthFacingIds[index];
  const labels = visibleLabelDecision(assessment);
  assert(assessment.exposureLevel !== 'protected', 'Milos 5 Bft S: south-facing beaches must not evaluate as protected.');
  assert(!labels.protectedLabel && !labels.calmLabel, 'Milos 5 Bft S: south-facing beaches must not show protected/calm labels.');
  assert(scenarioScore(byId(milosBeaches, beachId), milosSouthFiveBeaufort) < 70, 'Milos 5 Bft S: south-facing beaches must receive caution/penalty.');
});
assert(!tsigradoSouthFiveAssessment.canClaimProtected, 'Milos 5 Bft S: Tsigrado must not be treated as automatically protected/safe.');
assert(
  milosSouthFiveTop3.some(id => [...milosNorthExposedIds, ...milosBayCandidateIds].includes(id)),
  'Milos 5 Bft S: north/west or bay alternatives should rank better when south beaches are affected.'
);
milosLowConfidenceAssessments.forEach(assessment => {
  const labels = visibleLabelDecision(assessment);
  assert(!assessment.canClaimProtected && !labels.protectedLabel && !labels.calmLabel, 'Milos trust: low-confidence profiles must not create protected/calm labels.');
});
milosPhase3CoverageAssessments.forEach(assessment => {
  const labels = visibleLabelDecision(assessment);
  assert(
    assessment.source === 'override' &&
    assessment.windProfile.confidence === 'low' &&
    !assessment.canClaimProtected &&
    !labels.protectedLabel &&
    !labels.calmLabel,
    'Milos trust: Phase 3 low-confidence profiles must avoid protected/calm labels.'
  );
});
milosNorthExposedIds.forEach(id => {
  assert(
    milosSouthwestFourMapLevels.get(id) !== 'exposed',
    'Milos SW 4 Bft map: known north/northwest P0 beaches should not show as exposed like south-facing beaches.'
  );
});
milosSouthFacingIds.forEach(id => {
  assert(
    milosSouthwestFourMapLevels.get(id) !== 'protected',
    'Milos SW 4 Bft map: south-facing beaches must not render as protected in southwest wind.'
  );
});
naxosNorthExposedAssessments.forEach((assessment, index) => {
  const beachId = naxosNorthExposedIds[index];
  const labels = visibleLabelDecision(assessment);
  assert(assessment.exposureLevel !== 'protected', 'Naxos 5 Bft N: north-coast beaches must not evaluate as protected.');
  assert(!assessment.canClaimProtected && !labels.protectedLabel && !labels.calmLabel, 'Naxos 5 Bft N: north-coast beaches must not show protected/calm labels.');
  assert(scenarioScore(byId(naxosBeaches, beachId), northFiveBeaufort) < 70, 'Naxos 5 Bft N: north-coast beaches must not score as strong calm/family picks.');
});
naxosEastExposedAssessments.forEach((assessment, index) => {
  const beachId = naxosEastExposedIds[index];
  const labels = visibleLabelDecision(assessment);
  assert(assessment.exposureLevel !== 'protected', 'Naxos 5 Bft N: east-coast beaches must not evaluate as protected.');
  assert(!assessment.canClaimProtected && !labels.protectedLabel && !labels.calmLabel, 'Naxos 5 Bft N: east-coast beaches must not show protected/calm labels.');
  assert(scenarioScore(byId(naxosBeaches, beachId), northFiveBeaufort) < 70, 'Naxos 5 Bft N: east-coast beaches must not score as strong calm/family picks.');
});
naxosPhase1CoverageAssessments.forEach(assessment => {
  const labels = visibleLabelDecision(assessment);
  assert(
    assessment.source === 'override' &&
    !assessment.canClaimProtected &&
    !labels.protectedLabel &&
    !labels.calmLabel,
    'Naxos trust: audited Phase 1 profiles must avoid protected/calm labels unless shelter is locally verified.'
  );
});
naxosMediumEvidenceGateIds.forEach(id => {
  const assessment = assessBeachWindExposure({
    beach: byId(naxosBeaches, id),
    ...northFiveBeaufort,
  });
  assert(
    assessment.windProfile.confidence === 'medium',
    `Naxos trust: beach ${id} must be medium only because it passed the evidence gate.`
  );
});
naxosLowEvidenceGateIds.forEach(id => {
  const assessment = assessBeachWindExposure({
    beach: byId(naxosBeaches, id),
    ...northFiveBeaufort,
  });
  assert(
    assessment.windProfile.confidence === 'low',
    `Naxos trust: beach ${id} must stay low until OSM/geospatial/conflict evidence passes.`
  );
});
assert(mikriViglaNorthFiveAssessment.isKnownWindSportRisk, 'Naxos 5 Bft N: Mikri Vigla must be treated as a wind/watersports caution.');
assert(mikriViglaNorthFiveAssessment.warnings.some(warning => warning.type === 'wind_sport_spot'), 'Naxos 5 Bft N: Mikri Vigla must show wind/watersports warning.');
assert(!mikriViglaNorthFiveAssessment.canClaimProtected, 'Naxos 5 Bft N: Mikri Vigla must not claim wind protection.');
assert(!visibleLabelDecision(mikriViglaNorthFiveAssessment).protectedLabel, 'Naxos 5 Bft N: Mikri Vigla must not show protected label.');
assert(scenarioScore(mikriVigla, northFiveBeaufort) < 70, 'Naxos 5 Bft N: Mikri Vigla must not rank as a strong calm-swimming pick.');
assert(scenarioScore(mikriVigla, northThreeBeaufort) > 45, 'Naxos 3 Bft N: Mikri Vigla must not collapse to score 0.');
assert(!mikriViglaNorthThreeAssessment.warnings.some(warning => warning.type === 'wind_sport_spot' && warning.severity === 'warning'), 'Naxos 3 Bft N: Mikri Vigla must not show strong wind-sport warning.');
assert(mikriViglaSouthNorthFiveAssessment.exposureLevel !== mikriViglaNorthFiveAssessment.exposureLevel, 'Naxos 5 Bft N: Mikri Vigla south side should differ from the exposed north/wind side.');
assert(!plakaNorthFiveAssessment.canClaimProtected, 'Naxos 5 Bft N: Plaka must not make guaranteed protected claims.');
assert(!visibleLabelDecision(plakaNorthFiveAssessment).protectedLabel, 'Naxos 5 Bft N: Plaka must not show protected label.');
assertHasClearCautionCopy(
  generatedCopyText(mikriVigla, mikriViglaNorthFiveAssessment, northFiveBeaufort),
  'Naxos 5 Bft N: Mikri Vigla generated copy'
);
assertNoStrongWarningCopy(
  generatedCopyText(mikriVigla, mikriViglaNorthThreeAssessment, northThreeBeaufort),
  'Naxos 3 Bft N: Mikri Vigla generated copy'
);

const openScore = scenarioScore(genericOpen);
const shelteredScore = scenarioScore(genericSheltered);
const unknownAssessment = assessBeachWindExposure({ beach: genericUnknown, ...northFiveBeaufort });
const unknownThreeAssessment = assessBeachWindExposure({ beach: genericUnknown, ...northThreeBeaufort });
const legacyNorthProtectedNorthAssessment = assessBeachWindExposure({ beach: genericLegacyNorthProtected, ...northFiveBeaufort });
const legacyNorthProtectedSouthAssessment = assessBeachWindExposure({ beach: genericLegacyNorthProtected, ...milosSouthFiveBeaufort });
const shelteredNorthThreeAssessment = assessBeachWindExposure({ beach: genericSheltered, ...northThreeBeaufort });
const shelteredNorthFiveAssessment = assessBeachWindExposure({ beach: genericSheltered, ...northFiveBeaufort });
const openNorthThreeAssessment = assessBeachWindExposure({ beach: genericOpen, ...northThreeBeaufort });
const openNorthFiveAssessment = assessBeachWindExposure({ beach: genericOpen, ...northFiveBeaufort });
const legacyNorthProtectedNorthMapLevel = visibleMapExposureDecision(
  genericLegacyNorthProtected,
  legacyNorthProtectedNorthAssessment,
  northFiveBeaufort
);
const legacyNorthProtectedSouthMapLevel = visibleMapExposureDecision(
  genericLegacyNorthProtected,
  legacyNorthProtectedSouthAssessment,
  milosSouthFiveBeaufort
);
const chrysiLabels = visibleLabelDecision(chrysiAssessment);
const unknownLowWaveAssessment = assessBeachWindExposure({ beach: genericUnknown, ...northFiveBeaufort, waveHeightMeters: 0.3 });
const unknownLabels = visibleLabelDecision(unknownLowWaveAssessment);
const unknownThreeLabels = visibleLabelDecision(unknownThreeAssessment);
const legacyNorthProtectedLabels = visibleLabelDecision(legacyNorthProtectedNorthAssessment);
const lowConfidenceShelterAssessment = assessBeachWindExposure({
  beach: genericLowConfidenceShelter,
  ...northFiveBeaufort,
  waveHeightMeters: 0.3,
});
const lowConfidenceShelterLabels = visibleLabelDecision(lowConfidenceShelterAssessment);
const geospatialProtectedMapLevel = visibleMapExposureDecision(
  genericUnknown,
  unknownAssessment,
  northFiveBeaufort,
  geospatialProfile(genericUnknown.id, { N: 'protected' })
);
const geospatialExposedMapLevel = visibleMapExposureDecision(
  genericUnknown,
  unknownAssessment,
  northFiveBeaufort,
  geospatialProfile(genericUnknown.id, { N: 'exposed' })
);
const geospatialOpenFetchOverridesLowConfidenceShelterMapLevel = visibleMapExposureDecision(
  genericLowConfidenceShelter,
  lowConfidenceShelterAssessment,
  northFiveBeaufort,
  geospatialProfile(genericLowConfidenceShelter.id, { N: 'exposed' })
);
const geospatialPartialAllowsDirectionalProtectedMapLevel = visibleMapExposureDecision(
  genericLegacyNorthProtected,
  legacyNorthProtectedNorthAssessment,
  northFiveBeaufort,
  geospatialProfile(genericLegacyNorthProtected.id, { N: 'partial' })
);
const geospatialPartialAllowsDirectionalExposedMapLevel = visibleMapExposureDecision(
  genericLegacyNorthProtected,
  legacyNorthProtectedSouthAssessment,
  milosSouthFiveBeaufort,
  geospatialProfile(genericLegacyNorthProtected.id, { S: 'partial' })
);
const sarakinikoGeneratedGeospatialNorthMapLevel = visibleMapExposureDecision(
  sarakiniko,
  sarakinikoNorthFiveAssessment,
  milosNorthFiveBeaufort,
  milosGeospatialProfiles[sarakiniko.id]
);
const papikinouGeneratedGeospatialNorthMapLevel = visibleMapExposureDecision(
  papikinou,
  papikinouNorthFiveAssessment,
  milosNorthFiveBeaufort,
  milosGeospatialProfiles[papikinou.id]
);
const shelteredCalmAssessment = assessBeachWindExposure({ beach: genericSheltered, ...northFiveBeaufort, waveHeightMeters: 0.3 });
const shelteredLabels = visibleLabelDecision(shelteredCalmAssessment);
const phase21LowWaveAssessments = phase21Beaches.map(beach => assessBeachWindExposure({
  beach,
  ...northFiveBeaufort,
  waveHeightMeters: 0.3,
}));
const lowConfidenceProfileAssessments = allProfileAssessments.filter(assessment => assessment.windProfile.confidence === 'low');
const unknownFieldProfileAssessments = allProfileAssessments.filter(assessment => (
  assessment.windProfile.shelterLevel === 'unknown' || assessment.windProfile.fetchExposure === 'unknown'
));
const lowConfidenceProfileIds = allProfileBeaches
  .filter((_, index) => allProfileAssessments[index].windProfile.confidence === 'low')
  .map(beach => beach.id);
const unknownFieldProfileIds = allProfileBeaches
  .filter((_, index) => (
    allProfileAssessments[index].windProfile.shelterLevel === 'unknown' ||
    allProfileAssessments[index].windProfile.fetchExposure === 'unknown'
  ))
  .map(beach => beach.id);

assert(openScore < 60, 'Generic 5 Bft: open + high fetch should score low.');
assert(shelteredScore > openScore, 'Generic 5 Bft: sheltered + low fetch should score higher.');
assert(shelteredNorthThreeAssessment.simpleWindSuitability.suitabilityColor === 'green', 'Simple wind layer: protected 3 Bft should be green.');
assert(shelteredNorthThreeAssessment.simpleWindSuitability.explanationKey === 'protected_from_wind', 'Simple wind layer: protected 3 Bft should explain wind protection.');
assert(shelteredNorthFiveAssessment.simpleWindSuitability.suitabilityColor === 'yellow', 'Simple wind layer: protected 5 Bft should be yellow, not perfect.');
assert(openNorthThreeAssessment.simpleWindSuitability.suitabilityColor === 'yellow', 'Simple wind layer: open/exposed 3 Bft should be yellow.');
assert(openNorthFiveAssessment.simpleWindSuitability.suitabilityColor === 'red', 'Simple wind layer: open/exposed 5 Bft should be red.');
assert(legacyNorthProtectedNorthAssessment.simpleWindSuitability.exposureStatus === 'partial', 'Simple wind layer: legacy protectedFrom fallback should classify offshore north wind as partial, not verified protected.');
assert(legacyNorthProtectedNorthAssessment.simpleWindSuitability.confidence === 'medium', 'Simple wind layer: legacy protectedFrom fallback should be medium confidence, not verified high.');
assert(legacyNorthProtectedNorthAssessment.simpleWindSuitability.suitabilityColor === 'orange', 'Simple wind layer: legacy protectedFrom fallback at 5 Bft should be orange because it is only partial.');
assert(legacyNorthProtectedSouthAssessment.simpleWindSuitability.exposureStatus === 'exposed', 'Simple wind layer: legacy protectedFrom fallback should classify opposite south wind as exposed.');
assert(legacyNorthProtectedSouthAssessment.simpleWindSuitability.suitabilityColor === 'red', 'Simple wind layer: exposed south 5 Bft should be red.');
assert(unknownThreeAssessment.simpleWindSuitability.suitabilityColor === 'yellow', 'Simple wind layer: unknown orientation with 3 Bft should stay manageable/yellow.');
assert(!unknownAssessment.canClaimProtected, 'Generic 5 Bft: unknown windProfile must not invent protection.');
assert(unknownAssessment.confidenceReasons.includes('local wind exposure profile missing'), 'Generic 5 Bft: unknown windProfile must reduce confidence.');
assert(!unknownThreeAssessment.canClaimProtected, 'Generic 3 Bft: unknown windProfile must not invent protection.');
assert(!unknownThreeLabels.protectedLabel && !unknownThreeLabels.calmLabel, 'Generic 3 Bft: unknown windProfile must not create protected/calm labels.');
assert(unknownThreeAssessment.finalScoreCap === undefined, 'Generic 3 Bft: unknown windProfile must not receive a harsh score cap.');
assert(scenarioScore(genericUnknown, northThreeBeaufort) >= 70, 'Generic 3 Bft: unknown windProfile should not be punished too heavily.');
assert(legacyNorthProtectedNorthMapLevel === 'protected', 'Map fallback: legacy north-protected beach should show less exposed in north/offshore wind.');
assert(legacyNorthProtectedSouthMapLevel === 'exposed', 'Map fallback: legacy north-protected beach should show exposed in south/onshore wind.');
assert(!legacyNorthProtectedNorthAssessment.canClaimProtected, 'Map fallback: legacy protectedFrom must not create verified wind protection claims.');
assert(!legacyNorthProtectedLabels.protectedLabel && !legacyNorthProtectedLabels.calmLabel, 'Map fallback: legacy protectedFrom must not create protected/calm labels.');
assert(geospatialProtectedMapLevel === 'protected', 'Map geospatial fallback: low-confidence profile may show protected/blue when geometry is protected.');
assert(geospatialExposedMapLevel === 'exposed', 'Map geospatial fallback: open upwind fetch should remain exposed.');
assert(geospatialOpenFetchOverridesLowConfidenceShelterMapLevel === 'exposed', 'Map geospatial fallback: open fetch should prevent low-confidence shelter from showing less exposed.');
assert(geospatialPartialAllowsDirectionalProtectedMapLevel === 'partial', 'Map directional fallback: partial geospatial must block legacy protected fallback from becoming unsupported blue.');
assert(geospatialPartialAllowsDirectionalExposedMapLevel === 'partial', 'Map directional fallback: partial geospatial should remain partial when only legacy direction fallback disagrees.');
assert(sarakinikoGeneratedGeospatialNorthMapLevel === 'exposed', 'Milos generated geospatial: Sarakiniko should remain exposed in north wind on the map.');
assert(papikinouGeneratedGeospatialNorthMapLevel === 'protected', 'Milos generated geospatial: Papikinou may show protected/blue in north wind from geospatial bay geometry.');
assertNoProtectedCalmClaims(
  generatedCopyText(genericUnknown, unknownLowWaveAssessment, { ...northFiveBeaufort, waveHeightMeters: 0.3 }),
  'Generic unknown 5 Bft low-wave generated copy'
);
assert(!chrysiLabels.protectedLabel && !chrysiLabels.calmLabel, 'UI labels: Χρυσή Ακτή must not show protected/calm labels in 5 Bft north wind.');
assert(!unknownLabels.protectedLabel && !unknownLabels.calmLabel, 'UI labels: unknown windProfile must not create protected/calm labels, even with low waves.');
assert(!lowConfidenceShelterAssessment.canClaimProtected, 'Generic 5 Bft: low-confidence shelter must not claim protection.');
assert(lowConfidenceShelterAssessment.confidenceReasons.includes('wind exposure profile needs verification'), 'Generic 5 Bft: low-confidence shelter must reduce confidence.');
assert(!lowConfidenceShelterLabels.protectedLabel && !lowConfidenceShelterLabels.calmLabel, 'UI labels: low-confidence windProfile must not create protected/calm labels.');
assert(shelteredLabels.protectedLabel && shelteredLabels.calmLabel, 'UI labels: verified sheltered + low waves may still show protected/calm wording.');
assert(phase21Assessments.every(assessment => !assessment.canClaimProtected), 'Phase 2.1: newly added profiles must not create north-wind protection claims.');
assert(phase21LowWaveAssessments.every(assessment => {
  const labels = visibleLabelDecision(assessment);
  return !labels.protectedLabel && !labels.calmLabel;
}), 'Phase 2.1: newly added profiles must not create protected/calm labels, even with low waves.');
assert(lowConfidenceProfileAssessments.every(assessment => {
  const labels = visibleLabelDecision(assessment);
  return !assessment.canClaimProtected && !labels.protectedLabel && !labels.calmLabel;
}), 'Safety: low-confidence profiles must not create protected/calm labels.');
assert(unknownFieldProfileAssessments.every(assessment => (
  assessment.windProfile.confidence === 'low' &&
  assessment.windProfile.exposedToWindDirections.length === 0 &&
  assessment.windProfile.protectedFromWindDirections.length === 0 &&
  !assessment.canClaimProtected
)), 'Safety: unknown shelter/fetch profiles must stay low-confidence with no wind-direction claims.');

const syntheticBeachPoint = { lat: 37, lon: 25 };
const closeNorthLandMask = syntheticLandMask(
  'synthetic north land blocker',
  point => point.lat >= 37.01
);
const openNorthWaterMask = syntheticLandMask(
  'synthetic open north fetch',
  point => point.lat <= 36.99
);
const mediumNorthFetchMask = syntheticLandMask(
  'synthetic medium north fetch',
  point => point.lat >= 37.04
);
const geospatialNorthProtected = assessGeospatialWindExposure({
  beach: syntheticBeachPoint,
  windDirectionDeg: 0,
  landMask: closeNorthLandMask,
  maxFetchKm: 12,
});
const geospatialNorthExposed = assessGeospatialWindExposure({
  beach: syntheticBeachPoint,
  windDirectionDeg: 0,
  landMask: openNorthWaterMask,
  maxFetchKm: 12,
});
const geospatialNorthPartial = assessGeospatialWindExposure({
  beach: syntheticBeachPoint,
  windDirectionDeg: 0,
  landMask: mediumNorthFetchMask,
  maxFetchKm: 12,
});

assert(geospatialNorthProtected.exposureLevel === 'protected', 'Geospatial model: close upwind land should classify as protected.');
assert(geospatialNorthProtected.openWaterFetchKm <= 2, 'Geospatial model: close upwind land should produce short fetch.');
assert(geospatialNorthExposed.exposureLevel === 'exposed', 'Geospatial model: open upwind water should classify as exposed.');
assert(geospatialNorthExposed.openWaterFetchKm >= 8, 'Geospatial model: open upwind water should produce long fetch.');
assert(geospatialNorthPartial.exposureLevel === 'partial', 'Geospatial model: medium upwind fetch should classify as partial.');

console.log(JSON.stringify({
  coverage: {
    paros: parosCoverage,
    andros: androsCoverage,
    milos: milosCoverage,
    naxos: naxosCoverage,
    p0WindProfilesCovered,
    phase21WindProfilesAdded,
    allProfilesCovered,
    milosP0ProfilesCovered: milosCoverage.p0Profiles,
    naxosWindProfilesCovered,
    remainingSourceUnknownProfiles: (
      parosCoverage.unknownSourceProfiles +
      androsCoverage.unknownSourceProfiles +
      milosCoverage.unknownSourceProfiles +
      naxosCoverage.unknownSourceProfiles
    ),
    confidenceBreakdown: {
      high: parosCoverage.highConfidence + androsCoverage.highConfidence + milosCoverage.highConfidence + naxosCoverage.highConfidence,
      medium: parosCoverage.mediumConfidence + androsCoverage.mediumConfidence + milosCoverage.mediumConfidence + naxosCoverage.mediumConfidence,
      low: parosCoverage.lowConfidence + androsCoverage.lowConfidence + milosCoverage.lowConfidence + naxosCoverage.lowConfidence,
    },
    milosConfidenceBreakdown: {
      high: milosCoverage.highConfidence,
      medium: milosCoverage.mediumConfidence,
      low: milosCoverage.lowConfidence,
    },
    naxosConfidenceBreakdown: {
      high: naxosCoverage.highConfidence,
      medium: naxosCoverage.mediumConfidence,
      low: naxosCoverage.lowConfidence,
    },
    unknownShelterProfiles: (
      parosCoverage.unknownShelterProfiles +
      androsCoverage.unknownShelterProfiles +
      milosCoverage.unknownShelterProfiles +
      naxosCoverage.unknownShelterProfiles
    ),
    unknownFetchProfiles: (
      parosCoverage.unknownFetchProfiles +
      androsCoverage.unknownFetchProfiles +
      milosCoverage.unknownFetchProfiles +
      naxosCoverage.unknownFetchProfiles
    ),
    lowConfidenceProfileIds,
    unknownFieldProfileIds,
    milosP0Ids,
    milosPhase3CoverageIds,
    naxosPhase1CoverageIds,
    naxosMediumEvidenceGateIds,
    naxosLowEvidenceGateIds,
  },
  paros: {
    chrysiAktiScore: scenarioScore(chrysiAkti),
    chrysiAktiTop3: parosTop3.includes(chrysiAkti.id),
    realTop3Ids: parosRealTop3,
    chrysiAktiCanClaimProtected: chrysiAssessment.canClaimProtected,
    chrysiAktiWarnings: chrysiAssessment.warnings.map(warning => warning.type),
    goldenCluster: goldenClusterAssessments.map((assessment, index) => ({
      beachId: goldenClusterBeaches[index].id,
      exposureLevel: assessment.exposureLevel,
      canClaimProtected: assessment.canClaimProtected,
      labels: visibleLabelDecision(assessment),
      warnings: assessment.warnings.map(warning => warning.type),
    })),
    pounta: {
      score: scenarioScore(byId(parosBeaches, 2049)),
      exposureLevel: pountaAssessment.exposureLevel,
      canClaimProtected: pountaAssessment.canClaimProtected,
      labels: pountaLabels,
      warnings: pountaAssessment.warnings.map(warning => warning.type),
    },
    northThreeBeaufort: {
      goldenClusterScores: goldenClusterBeaches.map(beach => ({
        beachId: beach.id,
        score: scenarioScore(beach, northThreeBeaufort),
        warnings: assessBeachWindExposure({ beach, ...northThreeBeaufort }).warnings.map(warning => warning.type),
      })),
      pountaScore: scenarioScore(byId(parosBeaches, 2049), northThreeBeaufort),
      exposureScoreVariants: parosThreeScores.size,
    },
    northThreeBeaufortChoppy: {
      goldenClusterScores: goldenClusterBeaches.map(beach => ({
        beachId: beach.id,
        score: scenarioScore(beach, northThreeBeaufortParosChoppy),
        warnings: assessBeachWindExposure({ beach, ...northThreeBeaufortParosChoppy }).warnings.map(warning => warning.type),
      })),
      pountaScore: scenarioScore(byId(parosBeaches, 2049), northThreeBeaufortParosChoppy),
      pountaWarnings: pountaThreeChoppyAssessment.warnings.map(warning => warning.type),
    },
  },
  andros: {
    synetiScore: scenarioScore(syneti),
    pisoGialiaScore: scenarioScore(pisoGialia),
    realSynetiScore: scenarioScore(byId(androsBeaches, 1724)),
    realPisoGialiaScore: scenarioScore(byId(androsBeaches, 1718)),
    apothikesExposure: apothikesAssessment.exposureLevel,
    synetiExposure: synetiAssessment.exposureLevel,
    realApothikesExposure: realApothikesAssessment.exposureLevel,
    realAteniExposure: realAteniAssessment.exposureLevel,
    northThreeBeaufort: {
      synetiScore: scenarioScore(byId(androsBeaches, 1724), northThreeBeaufort),
      pisoGialiaScore: scenarioScore(byId(androsBeaches, 1718), northThreeBeaufort),
      apothikesScore: scenarioScore(byId(androsBeaches, 1689), northThreeBeaufort),
    },
    northThreeBeaufortChoppy: {
      synetiScore: scenarioScore(byId(androsBeaches, 1724), northThreeBeaufortAndrosChoppy),
      pisoGialiaScore: scenarioScore(byId(androsBeaches, 1718), northThreeBeaufortAndrosChoppy),
      synetiWarnings: realSynetiThreeChoppyAssessment.warnings.map(warning => warning.type),
      pisoGialiaWarnings: realPisoThreeChoppyAssessment.warnings.map(warning => warning.type),
    },
  },
  milos: {
    northFiveBeaufort: {
      top3Ids: milosNorthFiveTop3,
      sarakiniko: {
        score: scenarioScore(sarakiniko, milosNorthFiveBeaufort),
        exposureLevel: sarakinikoNorthFiveAssessment.exposureLevel,
        canClaimProtected: sarakinikoNorthFiveAssessment.canClaimProtected,
        labels: visibleLabelDecision(sarakinikoNorthFiveAssessment),
        warnings: sarakinikoNorthFiveAssessment.warnings.map(warning => warning.type),
      },
      papafragasScore: scenarioScore(papafragas, milosNorthFiveBeaufort),
      fyropotamosScore: scenarioScore(fyropotamos, milosNorthFiveBeaufort),
      plathienaScore: scenarioScore(plathiena, milosNorthFiveBeaufort),
      achivadolimni: {
        score: scenarioScore(achivadolimni, milosNorthFiveBeaufort),
        isKnownWindSportRisk: achivadolimniNorthFiveAssessment.isKnownWindSportRisk,
        warnings: achivadolimniNorthFiveAssessment.warnings.map(warning => warning.type),
        labels: visibleLabelDecision(achivadolimniNorthFiveAssessment),
      },
      papikinou: {
        score: scenarioScore(papikinou, milosNorthFiveBeaufort),
        exposureLevel: papikinouNorthFiveAssessment.exposureLevel,
        canClaimProtected: papikinouNorthFiveAssessment.canClaimProtected,
        labels: visibleLabelDecision(papikinouNorthFiveAssessment),
        confidence: papikinouNorthFiveAssessment.windProfile.confidence,
      },
    },
    northThreeBeaufort: {
      sarakinikoScore: scenarioScore(sarakiniko, milosNorthThreeBeaufort),
      sarakinikoWarnings: sarakinikoNorthThreeAssessment.warnings.map(warning => warning.type),
      achivadolimniScore: scenarioScore(achivadolimni, milosNorthThreeBeaufort),
      achivadolimniWarnings: achivadolimniNorthThreeAssessment.warnings.map(warning => warning.type),
      papikinouScore: scenarioScore(papikinou, milosNorthThreeBeaufort),
      papikinouCanClaimProtected: papikinouNorthThreeAssessment.canClaimProtected,
    },
    northThreeBeaufortChoppy: {
      sarakinikoScore: scenarioScore(sarakiniko, milosNorthThreeBeaufortChoppy),
      papikinouScore: scenarioScore(papikinou, milosNorthThreeBeaufortChoppy),
    },
    southFiveBeaufort: {
      top3Ids: milosSouthFiveTop3,
      southFacingScores: milosSouthFacingIds.map(id => ({
        beachId: id,
        score: scenarioScore(byId(milosBeaches, id), milosSouthFiveBeaufort),
        exposureLevel: assessBeachWindExposure({
          beach: byId(milosBeaches, id),
          ...milosSouthFiveBeaufort,
        }).exposureLevel,
      })),
      tsigrado: {
        score: scenarioScore(tsigrado, milosSouthFiveBeaufort),
        canClaimProtected: tsigradoSouthFiveAssessment.canClaimProtected,
        labels: visibleLabelDecision(tsigradoSouthFiveAssessment),
      },
    },
  },
  naxos: {
    northFiveBeaufort: {
      mikriVigla: {
        score: scenarioScore(mikriVigla, northFiveBeaufort),
        exposureLevel: mikriViglaNorthFiveAssessment.exposureLevel,
        isKnownWindSportRisk: mikriViglaNorthFiveAssessment.isKnownWindSportRisk,
        warnings: mikriViglaNorthFiveAssessment.warnings.map(warning => warning.type),
        labels: visibleLabelDecision(mikriViglaNorthFiveAssessment),
      },
      mikriViglaSouth: {
        score: scenarioScore(mikriViglaSouth, northFiveBeaufort),
        exposureLevel: mikriViglaSouthNorthFiveAssessment.exposureLevel,
        labels: visibleLabelDecision(mikriViglaSouthNorthFiveAssessment),
      },
      plaka: {
        score: scenarioScore(plaka, northFiveBeaufort),
        exposureLevel: plakaNorthFiveAssessment.exposureLevel,
        labels: visibleLabelDecision(plakaNorthFiveAssessment),
      },
      northExposedScores: naxosNorthExposedIds.map(id => ({
        beachId: id,
        score: scenarioScore(byId(naxosBeaches, id), northFiveBeaufort),
        exposureLevel: assessBeachWindExposure({
          beach: byId(naxosBeaches, id),
          ...northFiveBeaufort,
        }).exposureLevel,
      })),
      eastExposedScores: naxosEastExposedIds.map(id => ({
        beachId: id,
        score: scenarioScore(byId(naxosBeaches, id), northFiveBeaufort),
        exposureLevel: assessBeachWindExposure({
          beach: byId(naxosBeaches, id),
          ...northFiveBeaufort,
        }).exposureLevel,
      })),
    },
  },
  generic: {
    openHighFetchScore: openScore,
    shelteredLowFetchScore: shelteredScore,
    unknownCanClaimProtected: unknownAssessment.canClaimProtected,
    unknownConfidenceReasons: unknownAssessment.confidenceReasons,
    chrysiVisibleLabels: chrysiLabels,
    unknownVisibleLabels: unknownLabels,
    unknownThreeBeaufort: {
      score: scenarioScore(genericUnknown, northThreeBeaufort),
      labels: unknownThreeLabels,
      finalScoreCap: unknownThreeAssessment.finalScoreCap,
    },
    lowConfidenceShelterLabels,
    shelteredVisibleLabels: shelteredLabels,
  },
  geospatialExposureModel: {
    mapFallback: {
      syntheticProtectedMapLevel: geospatialProtectedMapLevel,
      syntheticExposedMapLevel: geospatialExposedMapLevel,
      lowConfidenceShelterWithOpenFetchMapLevel: geospatialOpenFetchOverridesLowConfidenceShelterMapLevel,
      partialAllowsDirectionalProtectedMapLevel: geospatialPartialAllowsDirectionalProtectedMapLevel,
      partialAllowsDirectionalExposedMapLevel: geospatialPartialAllowsDirectionalExposedMapLevel,
      milosSarakinikoNorthMapLevel: sarakinikoGeneratedGeospatialNorthMapLevel,
      milosPapikinouNorthMapLevel: papikinouGeneratedGeospatialNorthMapLevel,
    },
    protected: {
      exposureLevel: geospatialNorthProtected.exposureLevel,
      openWaterFetchKm: geospatialNorthProtected.openWaterFetchKm,
      blockedRayRatio: geospatialNorthProtected.blockedRayRatio,
    },
    exposed: {
      exposureLevel: geospatialNorthExposed.exposureLevel,
      openWaterFetchKm: geospatialNorthExposed.openWaterFetchKm,
      blockedRayRatio: geospatialNorthExposed.blockedRayRatio,
    },
    partial: {
      exposureLevel: geospatialNorthPartial.exposureLevel,
      openWaterFetchKm: geospatialNorthPartial.openWaterFetchKm,
      blockedRayRatio: geospatialNorthPartial.blockedRayRatio,
    },
  },
}, null, 2));
