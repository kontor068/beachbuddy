import {
  Beach,
  FetchExposure,
  LocalWindAmplification,
  ShelterLevel,
  WarningFlag,
  WindDirection,
  WindProfile,
  WindProfileSource,
  WindSector,
} from '../types';
import { calculateWindExposure, ExposureLevel } from './windExposure';
import { getWindProfileOverride } from './windProfileOverrides';

export interface BeachWindExposureInput {
  beach: Beach;
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
  const { profile, source } = resolveBeachWindProfile(input.beach);
  const windSector = input.windDirection ? windSectorFromDirection(input.windDirection) : windSectorFromDegrees(input.windDirectionDeg);
  const baseBeaufort = input.beaufort;
  const effectiveBeaufort = Math.min(12, input.beaufort + localAmplificationBoost(profile.localWindAmplification));
  const isKnownWindSportRisk = profile.knownWindSportSpot && baseBeaufort >= 4;
  const isKnownWindSportCaution = profile.knownWindSportSpot && baseBeaufort === 3 && effectiveBeaufort >= 4;
  const canClaimProtected = canClaimProtectedFromWind(profile, windSector) && !isKnownWindSportRisk;
  const isExplicitlyExposed = profile.exposedToWindDirections.includes(windSector);
  const isExplicitlyProtected = canClaimProtected;
  const exposureLevel = exposureFromProfile(
    profile,
    source,
    windSector,
    input.windDirection,
    input.windDirectionDeg,
    input.beach,
    canClaimProtected,
    isKnownWindSportRisk
  );

  const reasons: string[] = [];
  const confidenceReasons: string[] = [];
  const warnings: WarningFlag[] = [];
  let swimmingScoreModifier = 0;
  let experienceScoreModifier = 0;
  let finalScoreCap: number | undefined;
  let confidencePenalty = 0;

  if (source === 'unknown') {
    confidencePenalty += baseBeaufort >= 4 ? 12 : 4;
    confidenceReasons.push('local wind exposure profile missing');
    if (baseBeaufort >= 5) finalScoreCap = scoreCap(finalScoreCap, 65);
    else if (baseBeaufort >= 4) finalScoreCap = scoreCap(finalScoreCap, 72);
  }

  if (profile.confidence === 'low') {
    confidencePenalty += baseBeaufort >= 4 ? 10 : 5;
    confidenceReasons.push('wind exposure profile needs verification');
    if (baseBeaufort >= 5) finalScoreCap = scoreCap(finalScoreCap, 65);
    else if (baseBeaufort >= 4) finalScoreCap = scoreCap(finalScoreCap, 72);
  }

  if (profile.shelterLevel === 'unknown') {
    confidencePenalty += 6;
    confidenceReasons.push('shelter level unknown');
  }

  if (profile.fetchExposure === 'unknown') {
    confidencePenalty += 6;
    confidenceReasons.push('fetch exposure unknown');
  }

  if (profile.beachFacingDirection === null) {
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
  };
};
