import {
  Beach,
  DataConfidence,
  FetchExposure,
  GeospatialExposureProfile,
  LocalWindAmplification,
  SimpleWindSuitability,
  ShelterLevel,
  WarningFlag,
  WindDirection,
  WindProfile,
  WindProfileSource,
  WindSector,
} from '../types';
import { calculateWindExposure, estimateBeachOrientation, ExposureLevel } from './windExposure';
import { resolveWindExposure } from './windExposureModel';
import { getWindProfileOverride } from './windProfileOverrides';

export interface BeachWindExposureInput {
  beach: Beach;
  geospatialProfile?: GeospatialExposureProfile;
  windDirectionDeg: number;
  windDirection: WindDirection;
  windSpeedKmh: number;
  beaufort: number;
  waveHeightMeters?: number;
  waveDirectionDegrees?: number;
  wavePeriodSeconds?: number;
  windWaveHeightMeters?: number;
  windWaveDirectionDegrees?: number;
  swellHeightMeters?: number;
  swellDirectionDegrees?: number;
  seaSurfaceTemperature?: number;
}

export interface WindExposureAssessment {
  windProfile: WindProfile;
  source: WindProfileSource;
  windSector: WindSector;
  exposureLevel: ExposureLevel;
  canClaimProtected: boolean;
  isKnownWindSportRisk: boolean;
  isExplicitlyExposed: boolean;
  isExplicitlyProtected: boolean;
  effectiveBeaufort: number;
  swimmingScoreModifier: number;
  experienceScoreModifier: number;
  finalScoreCap?: number;
  confidencePenalty: number;
  confidenceReasons: string[];
  reasons: string[];
  warnings: WarningFlag[];
  seaCalmClaimAllowed: boolean;
  simpleWindSuitability: SimpleWindSuitability;
  /** Geometry-derived shoreline facing direction (0-360) or null. */
  facingDeg: number | null;
  /** Onshore wind component, -1 (offshore) .. 1 (onshore). */
  onshore: number;
  /** Open-water fetch (km) in the live wind direction. */
  effectiveFetchKm: number;
  /** Fetch-limited modeled significant wave height (m). */
  modeledWaveHeightM: number;
  /** Directional exposure intensity 0-100 (0 calm .. 100 fully exposed). */
  exposureIntensity: number;
}

const WIND_DIRECTION_TO_SECTOR: Record<WindDirection, WindSector> = {
  [WindDirection.N]: 'N',
  [WindDirection.NE]: 'NE',
  [WindDirection.E]: 'E',
  [WindDirection.SE]: 'SE',
  [WindDirection.S]: 'S',
  [WindDirection.SW]: 'SW',
  [WindDirection.W]: 'W',
  [WindDirection.NW]: 'NW',
};

const SECTORS: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const GEOSPATIAL_WIND_PROFILE_BACKFILL_ISLANDS = new Set([
  'aegina',
  'agistri',
  'agathonisi',
  'agios efstratios',
  'aetolia-acarnania (mainland)',
  'alonissos',
  'andros',
  'arki',
  'astypalaia',
  'athens area (mainland)',
  'chios',
  'fournoi',
  'halki',
  'hydra',
  'ikaria',
  'ios',
  'antipaxos',
  'corfu',
  'crete (chania)',
  'crete (heraklion)',
  'crete (lasithi)',
  'crete (rethymno)',
  'erikoussa',
  'evia',
  'east attica (mainland)',
  'fokida (mainland)',
  'fthiotida (mainland)',
  'gavdos',
  'ithaca',
  'kalymnos',
  'karpathos',
  'kasos',
  'kastellorizo',
  'kea',
  'kefalonia',
  'kos',
  'kythira',
  'kythnos',
  'lefkada',
  'leros',
  'lemnos',
  'lesvos',
  'lipsi',
  'mathraki',
  'marathi',
  'meganisi',
  'methana',
  'milos',
  'mykonos',
  'naxos',
  'nisyros',
  'oinousses',
  'othonoi',
  'paros',
  'patmos',
  'paxos',
  'piraeus area',
  'poros',
  'psara',
  'pserimos',
  'rhodes',
  'samothraki',
  'samos',
  'salamina',
  'santorini',
  'serifos',
  'sifnos',
  'skiathos',
  'skopelos',
  'skyros',
  'spetses',
  'symi',
  'syros',
  'telendos',
  'thasos',
  'tilos',
  'tinos',
  'ileia (mainland)',
  'viotia (mainland)',
  'west attica (mainland)',
  'zakynthos',
]);

const WIND_SECTOR_LABELS: Record<WindSector, string> = {
  N: 'north',
  NE: 'northeast',
  E: 'east',
  SE: 'southeast',
  S: 'south',
  SW: 'southwest',
  W: 'west',
  NW: 'northwest',
};

const isSheltered = (shelterLevel: ShelterLevel): boolean => (
  shelterLevel === 'sheltered' || shelterLevel === 'very_sheltered'
);

const localAmplificationBoost = (value: LocalWindAmplification): number => {
  if (value === 'high') return 1;
  if (value === 'medium') return 0.5;
  return 0;
};

const scoreCap = (current: number | undefined, next: number): number => (
  current === undefined ? next : Math.min(current, next)
);

const normalizeIslandToken = (value: string | undefined): string => (
  (value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
);

const canUseGeospatialWindProfileBackfill = (
  beach: Beach,
  profile?: GeospatialExposureProfile
): profile is GeospatialExposureProfile => (
  Boolean(
    profile &&
    profile.confidence === 'medium' &&
    typeof profile.facingDeg === 'number' &&
    Number.isFinite(profile.facingDeg) &&
    GEOSPATIAL_WIND_PROFILE_BACKFILL_ISLANDS.has(normalizeIslandToken(beach.location?.island)) &&
    SECTORS.every(sector => profile.sectors?.[sector]?.level)
  )
);

const fetchExposureFromGeospatial = (profile: GeospatialExposureProfile): FetchExposure => {
  const maxFetchKm = Math.max(...SECTORS.map(sector => profile.sectors[sector]?.fetchKm || 0));
  if (maxFetchKm >= 8) return 'high';
  if (maxFetchKm >= 3) return 'medium';
  return 'low';
};

const buildGeospatialWindProfile = (profile: GeospatialExposureProfile): WindProfile => ({
  beachFacingDirection: profile.facingDeg ?? null,
  // Keep geospatial backfill conservative: it can identify exposed sectors and
  // remove "unknown profile" penalties, but it must not create protected/calm
  // claims without authored local evidence.
  shelterLevel: 'semi_sheltered',
  fetchExposure: fetchExposureFromGeospatial(profile),
  exposedToWindDirections: SECTORS.filter(sector => profile.sectors[sector]?.level === 'exposed'),
  protectedFromWindDirections: SECTORS.filter(sector => profile.sectors[sector]?.level === 'protected'),
  knownWindSportSpot: false,
  localWindAmplification: 'low',
  confidence: 'medium',
  notes: 'Medium-confidence geospatial backfill from validated island orientation, sector exposure, fetch, and shoreline-segment stability. This does not grant high confidence or guaranteed calm/protected claims.',
});

const getSimpleWindConfidence = (
  profile: WindProfile,
  source: WindProfileSource,
  beach: Beach,
  hasGeometry: boolean
): DataConfidence => {
  if (profile.confidence === 'high') return 'high';
  if (profile.confidence === 'medium') return 'medium';
  if (source === 'unknown' && (hasGeometry || (beach.protectedFrom?.length || 0) > 0)) return 'medium';
  return 'low';
};

const getSimpleWindColor = (
  exposureLevel: ExposureLevel,
  beaufort: number
): SimpleWindSuitability['suitabilityColor'] => {
  if (beaufort >= 7) return 'red';
  if (beaufort <= 2) return 'green';

  if (beaufort >= 5) {
    if (exposureLevel === 'protected') return 'yellow';
    if (exposureLevel === 'partial') return 'orange';
    return 'red';
  }

  if (exposureLevel === 'protected') return 'green';
  if (exposureLevel === 'partial') return 'yellow';
  return beaufort >= 4 ? 'orange' : 'yellow';
};

const getSimpleExposureStatus = (
  exposureLevel: ExposureLevel,
  source: WindProfileSource,
  beach: Beach,
  windDirection: WindDirection,
  windDirectionDeg: number
): ExposureLevel => {
  if (source !== 'unknown') return exposureLevel;
  if (beach.protectedFrom?.includes(windDirection)) return 'partial';

  const legacyOrientation = estimateBeachOrientation(beach.protectedFrom || []);
  if (legacyOrientation !== null) {
    const legacyExposure = calculateWindExposure(legacyOrientation, windDirectionDeg).exposureLevel;
    return legacyExposure === 'protected' ? 'partial' : legacyExposure;
  }

  return exposureLevel;
};

export const buildSimpleWindSuitability = ({
  exposureLevel,
  beaufort,
  windSector,
  windDirection,
  windDirectionDeg,
  profile,
  source,
  beach,
  hasGeometry,
}: {
  exposureLevel: ExposureLevel;
  beaufort: number;
  windSector: WindSector;
  windDirection: WindDirection;
  windDirectionDeg: number;
  profile: WindProfile;
  source: WindProfileSource;
  beach: Beach;
  hasGeometry: boolean;
}): SimpleWindSuitability => {
  const confidence = getSimpleWindConfidence(profile, source, beach, hasGeometry);
  const exposureStatus = getSimpleExposureStatus(exposureLevel, source, beach, windDirection, windDirectionDeg);
  const suitabilityColor = getSimpleWindColor(exposureStatus, beaufort);
  const windLabel = WIND_SECTOR_LABELS[windSector];

  if (beaufort <= 2) {
    return {
      suitabilityColor,
      exposureStatus,
      confidence,
      explanationKey: 'generally_calm',
      explanationText: 'Generally manageable choice today',
      windSector,
    };
  }

  if (beaufort >= 7) {
    return {
      suitabilityColor,
      exposureStatus,
      confidence,
      explanationKey: 'avoid_today',
      explanationText: `Strong ${windLabel} wind today - better to avoid for calm swimming`,
      windSector,
    };
  }

  if (exposureStatus === 'protected') {
    return {
      suitabilityColor,
      exposureStatus,
      confidence,
      explanationKey: 'protected_from_wind',
      explanationText: `Better protected from today's ${windLabel} wind`,
      windSector,
    };
  }

  if (exposureStatus === 'exposed') {
    return {
      suitabilityColor,
      exposureStatus,
      confidence,
      explanationKey: 'exposed_to_wind',
      explanationText: `More exposed to today's ${windLabel} wind`,
      windSector,
    };
  }

  return {
    suitabilityColor,
    exposureStatus,
    confidence,
    explanationKey: 'partly_exposed',
    explanationText: `Partly exposed to today's ${windLabel} wind`,
    windSector,
  };
};

export const windSectorFromDegrees = (degrees: number): WindSector => {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % SECTORS.length;
  return SECTORS[index];
};

export const windSectorFromDirection = (direction: WindDirection): WindSector => (
  WIND_DIRECTION_TO_SECTOR[direction]
);

const normalizeWindProfile = (
  beach: Beach,
  profile: WindProfile | undefined,
  source: WindProfileSource
): WindProfile => {
  const fallbackFacing = typeof beach.orientation?.degrees === 'number' && Number.isFinite(beach.orientation.degrees)
    ? beach.orientation.degrees
    : null;
  const fallbackFetch: FetchExposure = beach.fetchExposure || beach.metadata?.fetchExposure || 'unknown';

  return {
    beachFacingDirection: profile?.beachFacingDirection ?? fallbackFacing,
    shelterLevel: profile?.shelterLevel || 'unknown',
    fetchExposure: profile?.fetchExposure || fallbackFetch,
    exposedToWindDirections: profile?.exposedToWindDirections || [],
    protectedFromWindDirections: profile?.protectedFromWindDirections || [],
    knownWindSportSpot: profile?.knownWindSportSpot || false,
    localWindAmplification: profile?.localWindAmplification || 'unknown',
    confidence: profile?.confidence || (source === 'unknown' ? 'low' : 'medium'),
    notes: profile?.notes || 'Local wind exposure profile is not verified yet.',
  };
};

export const resolveBeachWindProfile = (beach: Beach): { profile: WindProfile; source: WindProfileSource } => {
  const override = getWindProfileOverride(beach);
  if (override) {
    return { profile: normalizeWindProfile(beach, override, 'override'), source: 'override' };
  }

  if (beach.windProfile) {
    return { profile: normalizeWindProfile(beach, beach.windProfile, 'beach'), source: 'beach' };
  }

  if (beach.metadata?.windProfile) {
    return { profile: normalizeWindProfile(beach, beach.metadata.windProfile, 'metadata'), source: 'metadata' };
  }

  return { profile: normalizeWindProfile(beach, undefined, 'unknown'), source: 'unknown' };
};

export const canClaimProtectedFromWind = (
  profile: WindProfile,
  windSector: WindSector
): boolean => (
  profile.confidence !== 'low' &&
  isSheltered(profile.shelterLevel) &&
  profile.protectedFromWindDirections.includes(windSector) &&
  !profile.knownWindSportSpot
);

const angularExposureFromProfile = (
  profile: WindProfile,
  windDirectionDeg: number,
  canClaimProtected: boolean
): ExposureLevel | undefined => {
  if (typeof profile.beachFacingDirection !== 'number' || !Number.isFinite(profile.beachFacingDirection)) {
    return undefined;
  }

  const angularExposure = calculateWindExposure(profile.beachFacingDirection, windDirectionDeg).exposureLevel;
  // Angular fallback can help with penalties, but it must not create a protected claim by itself.
  if (angularExposure === 'protected' && !canClaimProtected) return 'partial';
  return angularExposure;
};

const exposureFromProfile = (
  profile: WindProfile,
  source: WindProfileSource,
  windSector: WindSector,
  windDirection: WindDirection,
  windDirectionDeg: number,
  beach: Beach,
  canClaimProtected: boolean,
  isKnownWindSportRisk: boolean
): ExposureLevel => {
  if (isKnownWindSportRisk) return 'exposed';
  if (profile.exposedToWindDirections.includes(windSector)) return 'exposed';
  if (canClaimProtected) return 'protected';

  const angularExposure = angularExposureFromProfile(profile, windDirectionDeg, canClaimProtected);
  if (angularExposure) return angularExposure;

  if (profile.shelterLevel === 'open') return 'exposed';
  if (profile.shelterLevel === 'semi_sheltered') return 'partial';
  if (isSheltered(profile.shelterLevel)) return 'partial';

  // Legacy protectedFrom can only make an unknown beach partial, never protected.
  if (source === 'unknown' && beach.protectedFrom?.includes(windDirection)) return 'partial';
  if (profile.fetchExposure === 'high') return 'exposed';
  return 'partial';
};

export const assessBeachWindExposure = (input: BeachWindExposureInput): WindExposureAssessment => {
  let { profile, source } = resolveBeachWindProfile(input.beach);
  if (source === 'unknown' && canUseGeospatialWindProfileBackfill(input.beach, input.geospatialProfile)) {
    profile = buildGeospatialWindProfile(input.geospatialProfile);
    source = 'geospatial';
  }
  const windSector = input.windDirection ? windSectorFromDirection(input.windDirection) : windSectorFromDegrees(input.windDirectionDeg);
  const baseBeaufort = input.beaufort;
  const effectiveBeaufort = Math.min(12, input.beaufort + localAmplificationBoost(profile.localWindAmplification));
  const isKnownWindSportRisk = profile.knownWindSportSpot && baseBeaufort >= 4;
  const isKnownWindSportCaution = profile.knownWindSportSpot && baseBeaufort === 3 && effectiveBeaufort >= 4;
  const canClaimProtected = canClaimProtectedFromWind(profile, windSector) && !isKnownWindSportRisk;
  const isExplicitlyExposed = profile.exposedToWindDirections.includes(windSector);
  const isExplicitlyProtected = canClaimProtected;

  // Single source of truth: the unified resolver understands where the beach
  // faces (real shoreline normal) and how exposed it is (onshore/offshore wind
  // over the upwind fetch), interpolated to the live wind direction. It always
  // returns a concrete level, so we never need to hedge with "unknown".
  const authoredFacingDeg = source !== 'unknown' && typeof profile.beachFacingDirection === 'number'
    ? profile.beachFacingDirection
    : undefined;
  const unified = resolveWindExposure({
    geospatialProfile: input.geospatialProfile,
    authoredFacingDeg,
    orientationDeg: input.beach.orientation?.degrees ?? null,
    protectedFrom: input.beach.protectedFrom,
    windDirectionDeg: input.windDirectionDeg,
    windSpeedKmh: input.windSpeedKmh,
    measuredWaveHeightM: input.waveHeightMeters,
    explicitExposed: isKnownWindSportRisk || isExplicitlyExposed,
    explicitProtected: canClaimProtected,
  });
  // Curated authored profiles encode local knowledge and a deliberately
  // conservative shelter policy (e.g. semi_sheltered stays 'partial'), so they
  // win. Only where there is no authored profile do we let the geometry resolver
  // (geospatial fetch + onshore/offshore) decide the level.
  const exposureLevel: ExposureLevel = source === 'unknown' && input.geospatialProfile
    ? unified.level
    : exposureFromProfile(
      profile,
      source,
      windSector,
      input.windDirection,
      input.windDirectionDeg,
      input.beach,
      canClaimProtected,
      isKnownWindSportRisk
    );
  // Only a real geospatial profile counts as reliable geometry that can relax
  // the "missing profile" caps for uncurated beaches. An authored low-confidence
  // profile's facing must NOT relax its deliberately conservative caps.
  const hasGeometry = Boolean(input.geospatialProfile);

  const reasons: string[] = [];
  const confidenceReasons: string[] = [];
  const warnings: WarningFlag[] = [];
  let swimmingScoreModifier = 0;
  let experienceScoreModifier = 0;
  let finalScoreCap: number | undefined;
  let confidencePenalty = 0;

  if (source === 'unknown' && !hasGeometry) {
    confidencePenalty += baseBeaufort >= 4 ? 12 : 4;
    confidenceReasons.push('local wind exposure profile missing');
    if (baseBeaufort >= 6) finalScoreCap = scoreCap(finalScoreCap, 60);
    else if (baseBeaufort >= 5) finalScoreCap = scoreCap(finalScoreCap, 65);
    else if (baseBeaufort >= 4) finalScoreCap = scoreCap(finalScoreCap, 72);
  }

  if (profile.confidence === 'low') {
    confidencePenalty += baseBeaufort >= 4 ? 10 : 5;
    confidenceReasons.push('wind exposure profile needs verification');
    if (baseBeaufort >= 6) finalScoreCap = scoreCap(finalScoreCap, 60);
    else if (baseBeaufort >= 5) finalScoreCap = scoreCap(finalScoreCap, 65);
    else if (baseBeaufort >= 4) finalScoreCap = scoreCap(finalScoreCap, 72);
  }

  if (profile.shelterLevel === 'unknown' && !hasGeometry) {
    confidencePenalty += 6;
    confidenceReasons.push('shelter level unknown');
  }

  if (profile.fetchExposure === 'unknown' && !hasGeometry) {
    confidencePenalty += 6;
    confidenceReasons.push('fetch exposure unknown');
  }

  if (unified.facingDeg === null) {
    confidencePenalty += 3;
    confidenceReasons.push('beach facing direction not verified');
  }

  if (input.waveHeightMeters === undefined) {
    confidencePenalty += 6;
    confidenceReasons.push('marine wave data missing');
  }

  if (isKnownWindSportRisk) {
    const strongWindSportRisk = baseBeaufort >= 5 || effectiveBeaufort >= 6;
    swimmingScoreModifier -= strongWindSportRisk ? 34 : 14;
    experienceScoreModifier -= strongWindSportRisk ? 18 : 7;
    finalScoreCap = scoreCap(finalScoreCap, strongWindSportRisk ? 50 : 70);
    reasons.push('Known wind/watersports spot in meaningful wind');
    warnings.push({
      type: 'wind_sport_spot',
      severity: strongWindSportRisk ? 'warning' : 'info',
      message: 'This is a known wind/watersports spot and may be windy or choppy today.',
    });
  } else if (isKnownWindSportCaution) {
    swimmingScoreModifier -= 4;
    experienceScoreModifier -= 2;
    reasons.push('Known wind/watersports spot, but today wind is light');
  }

  if (baseBeaufort >= 4 && profile.shelterLevel === 'open' && profile.fetchExposure === 'high') {
    const severe = baseBeaufort >= 6;
    const strong = baseBeaufort >= 5;
    swimmingScoreModifier -= severe ? 36 : strong ? 28 : 16;
    experienceScoreModifier -= severe ? 18 : strong ? 12 : 7;
    finalScoreCap = scoreCap(finalScoreCap, severe ? 38 : strong ? 55 : 68);
    reasons.push('Open beach with high fetch in meaningful wind');
  }

  if (baseBeaufort >= 4 && exposureLevel === 'exposed') {
    swimmingScoreModifier -= baseBeaufort >= 5 ? 18 : 10;
    experienceScoreModifier -= baseBeaufort >= 5 ? 10 : 5;
    finalScoreCap = scoreCap(finalScoreCap, baseBeaufort >= 5 ? 58 : 70);
    reasons.push('Exposed to today wind sector');
  }

  if (baseBeaufort >= 5 && exposureLevel === 'partial') {
    const nearGale = baseBeaufort >= 6;
    swimmingScoreModifier -= nearGale ? 10 : 4;
    experienceScoreModifier -= nearGale ? 5 : 2;
    finalScoreCap = scoreCap(finalScoreCap, nearGale ? 64 : 72);
    reasons.push(nearGale
      ? 'Partly exposed beach in very strong wind'
      : 'Partly exposed beach in strong wind');
  }

  const waveAcceptableForShelterBonus = input.waveHeightMeters === undefined || input.waveHeightMeters <= 0.8;
  if (baseBeaufort >= 4 && canClaimProtected && waveAcceptableForShelterBonus) {
    swimmingScoreModifier += baseBeaufort >= 5 ? 14 : 9;
    experienceScoreModifier += 8;
    reasons.push('Better sheltered from today wind sector');
  }

  const seaCalmClaimAllowed = canClaimProtected &&
    typeof input.waveHeightMeters === 'number' &&
    input.waveHeightMeters <= 0.4 &&
    !isKnownWindSportRisk;
  const simpleWindSuitability = buildSimpleWindSuitability({
    exposureLevel,
    beaufort: baseBeaufort,
    windSector,
    windDirection: input.windDirection,
    windDirectionDeg: input.windDirectionDeg,
    profile,
    source,
    beach: input.beach,
    hasGeometry,
  });

  return {
    windProfile: profile,
    source,
    windSector,
    exposureLevel,
    canClaimProtected,
    isKnownWindSportRisk,
    isExplicitlyExposed,
    isExplicitlyProtected,
    effectiveBeaufort,
    swimmingScoreModifier,
    experienceScoreModifier,
    finalScoreCap,
    confidencePenalty,
    confidenceReasons,
    reasons,
    warnings,
    seaCalmClaimAllowed,
    simpleWindSuitability,
    facingDeg: unified.facingDeg,
    onshore: unified.onshore,
    effectiveFetchKm: unified.effectiveFetchKm,
    modeledWaveHeightM: unified.modeledWaveHeightM,
    exposureIntensity: unified.intensity,
  };
};
