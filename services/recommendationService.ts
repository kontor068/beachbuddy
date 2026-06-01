import {
  Accessibility,
  Beach,
  DailyForecast,
  FetchExposure,
  FilterKey,
  ForecastConfidence,
  ForecastItem,
  LanguageCode,
  MarineForecast,
  RecommendationConfidence,
  SeabedSlope,
  SortOption,
  SuitableBeach,
  SwimmingComfort,
  UserPreferences,
  WarningFlag,
  WaterEntry,
  WaterQualityRiskAfterRain,
  WeatherData,
  WeatherSource,
  WindProfile,
  WindSector,
  WindDirection,
} from '../types';
import { degToCompass, calculateDistance, getBeaufortLevel } from '../utils/weatherUtils';
import { calculateWindExposure } from '../utils/windExposure';
import { calculateCrowdLevel, CrowdLevel } from './crowdService';
import { ExposureLevel } from '../utils/windExposure';
import { getNegativeFeedbackCount } from './analyticsService';
import { displayBeachName } from '../utils/localization';
import { isSearchMatch } from '../utils/searchNormalize';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { hasTrulyEasyAccess } from '../utils/access';

export interface BeachScore {
  beachId: number;
  score: number;
  swimmingScore: number;
  experienceScore: number;
  preferenceScore: number;
  finalSuitabilityScore: number;
  swimmingComfort: SwimmingComfort;
  forecastConfidence: ForecastConfidence;
  confidenceReasons: string[];
  reasons: string[];
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
  marine?: MarineForecast;
  waveHeightM?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  weatherSource?: WeatherSource;
  hourlySeaScore?: number;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  windProfile?: WindProfile;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
}

export interface BestBeachTime {
  bestStart: string;
  bestEnd: string;
  reason: string;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
}

export interface BeachRecommendation {
  beachId: number;
  score: number;
  swimmingScore?: number;
  experienceScore?: number;
  preferenceScore?: number;
  finalSuitabilityScore?: number;
  swimmingComfort?: SwimmingComfort;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  explanation: string;
  bestBeachTime?: BestBeachTime;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
  marine?: MarineForecast;
  waveHeightM?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  weatherSource?: WeatherSource;
  hourlySeaScore?: number;
  windProfile?: WindProfile;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
}

export type BeachWeatherById = Record<number, DailyForecast | undefined>;

interface ScoreOptions {
  weatherSource?: WeatherSource;
  hourlyForecast?: ForecastItem[];
  recentRainMm?: number;
}

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const formatTime = (item: ForecastItem): string => {
  const parts = item.dt_txt && item.dt_txt.includes(' ') ? item.dt_txt.split(' ') : [];
  if (parts.length > 1 && parts[1]) return parts[1].substring(0, 5);
  return new Date(item.dt * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatTimeWindow = (start?: string, end?: string): string | undefined => {
  if (!start) return undefined;
  return end && end !== start ? `${start}-${end}` : start;
};

const getWeatherTemp = (weather: WeatherData | DailyForecast): number => {
  if ('main' in weather && weather.main) return weather.main.temp;
  if ('temp_max' in weather) return weather.temp_max;
  return 25;
};

const getWeatherGustKmph = (
  weather: WeatherData | DailyForecast,
  hourlyForecast?: ForecastItem[]
): number | undefined => {
  const dailyGustFromKnots = typeof weather.wind?.windGustKnots === 'number' && Number.isFinite(weather.wind.windGustKnots)
    ? weather.wind.windGustKnots * 1.852
    : typeof weather.wind?.gustKnots === 'number' && Number.isFinite(weather.wind.gustKnots)
      ? weather.wind.gustKnots * 1.852
      : undefined;
  const dailyGust = dailyGustFromKnots ?? (
    typeof weather.wind?.gust === 'number' && Number.isFinite(weather.wind.gust)
      ? weather.wind.gust * 3.6
      : undefined
  );
  const hourlyGusts = getKeyBeachHours(hourlyForecast || ('hourly' in weather ? weather.hourly : undefined))
    .map(item => {
      if (typeof item.wind?.gustKnots === 'number' && Number.isFinite(item.wind.gustKnots)) {
        return item.wind.gustKnots * 1.852;
      }
      return typeof item.wind?.gust === 'number' && Number.isFinite(item.wind.gust)
        ? item.wind.gust * 3.6
        : undefined;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (hourlyGusts.length === 0) return dailyGust;
  return Math.max(dailyGust || 0, ...hourlyGusts);
};

const getRecentRainMm = (hourlyForecast?: ForecastItem[], fallback?: number): number | undefined => {
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  if (!hourlyForecast || hourlyForecast.length === 0) return undefined;

  const now = Date.now();
  const recentRain = hourlyForecast
    .filter(item => {
      const timestamp = item.dt * 1000;
      return timestamp <= now && timestamp >= now - 48 * 60 * 60 * 1000;
    })
    .reduce((sum, item) => sum + (item.rain?.['3h'] || 0), 0);

  return recentRain > 0 ? recentRain : undefined;
};

const getBeachFetchExposure = (beach: Beach): FetchExposure | undefined => (
  beach.fetchExposure || beach.metadata?.fetchExposure
);

const getBeachSeabedSlope = (beach: Beach): SeabedSlope => (
  beach.seabedSlope || beach.metadata?.seabedSlope || 'unknown'
);

const getBeachWaterEntry = (beach: Beach): WaterEntry => (
  beach.waterEntry || beach.metadata?.waterEntry || 'unknown'
);

const getBeachWaterQualityRisk = (beach: Beach): WaterQualityRiskAfterRain | undefined => (
  beach.waterQualityRiskAfterRain || beach.metadata?.waterQualityRiskAfterRain
);

const hasBeachOfficialWarningStatus = (beach: Beach): boolean => (
  typeof beach.officialWarningOverride === 'boolean' ||
  typeof beach.metadata?.officialWarningOverride === 'boolean'
);

const hasOfficialWarningOverride = (beach: Beach): boolean => (
  beach.officialWarningOverride === true || beach.metadata?.officialWarningOverride === true
);

const getOfficialWarningReason = (beach: Beach): string => (
  beach.officialWarningReason || beach.metadata?.officialWarningReason || 'Official warning active for this beach.'
);

const getEffectiveBeaufortForComfort = (
  baseBeaufort: number,
  windSpeedKmph: number,
  gustKmph: number | undefined,
  exposureLevel: ExposureLevel,
  waveHeightM: number | undefined
): number => {
  let effective = baseBeaufort;
  const gustBeaufort = typeof gustKmph === 'number' ? getBeaufortLevel(gustKmph) : baseBeaufort;
  const gustSpreadKmph = typeof gustKmph === 'number' ? Math.max(0, gustKmph - windSpeedKmph) : 0;

  if (gustSpreadKmph >= 15 || gustBeaufort >= baseBeaufort + 2) effective += 1;
  if (baseBeaufort >= 4 && exposureLevel !== 'protected') effective += 1;
  if (typeof waveHeightM === 'number' && waveHeightM >= 0.9) effective += 1;
  if (exposureLevel === 'protected' && baseBeaufort <= 5 && (waveHeightM === undefined || waveHeightM < 0.5)) {
    effective -= 1;
  }

  return Math.max(0, Math.min(12, effective));
};

const swimmingComfortFromScore = (
  swimmingScore: number,
  effectiveBeaufort: number,
  waveHeightM?: number,
  officialOverride?: boolean
): SwimmingComfort => {
  if (officialOverride) return 'avoid_swimming';
  if (effectiveBeaufort >= 6 || (typeof waveHeightM === 'number' && waveHeightM > 1.2) || swimmingScore < 45) {
    return 'avoid_swimming';
  }
  if (effectiveBeaufort >= 5 || (typeof waveHeightM === 'number' && waveHeightM >= 0.9) || swimmingScore < 60) {
    return 'caution';
  }
  if (effectiveBeaufort <= 2 && (waveHeightM === undefined || waveHeightM < 0.4) && swimmingScore >= 85) {
    return 'excellent';
  }
  return 'good';
};

const hasActivePreferences = (preferences?: UserPreferences): boolean => (
  Boolean(preferences && Object.values(preferences).some(Boolean))
);

const isSurfaceFilter = (filter: FilterKey): boolean => (
  filter === 'sandy' || filter === 'pebbles' || filter === 'sandy-pebbles' || filter === 'rocky'
);

const matchesSurfaceFilter = (beach: Beach, filter: FilterKey): boolean => {
  if (filter === 'sandy') return beach.beachType === 'sandy' || beach.beachType === 'sandy-pebbles';
  if (filter === 'pebbles') return beach.beachType === 'pebbles' || beach.beachType === 'sandy-pebbles';
  return beach.beachType === filter;
};

const hasServiceAmenities = (beach: Beach): boolean => Boolean(
  beach.amenities?.organized ||
  beach.amenities?.beachBar ||
  beach.amenities?.sunbeds ||
  beach.amenities?.taverna ||
  beach.amenities?.restaurant
);

const isQuietBeach = (beach: Beach): boolean => {
  if (beach.amenities?.beachBar) return false;
  return Boolean(
    beach.environment?.quiet ||
    beach.environment?.remote ||
    !hasServiceAmenities(beach)
  );
};

const isFamilyFriendlyBeach = (beach: Beach): boolean => Boolean(
  beach.environment?.familyFriendly
);

const hasRockySnorkelingTerrain = (beach: Beach): boolean => {
  const terrainTypes = beach.metadata?.terrain?.types || [];
  return terrainTypes.includes('rocks') || terrainTypes.includes('large_stones');
};

const isSnorkelingBeach = (beach: Beach): boolean => Boolean(
  beach.activities?.snorkeling ||
  hasRockySnorkelingTerrain(beach) ||
  beach.beachType === 'rocky'
);

const hasBeachBarAmenity = (beach: Beach): boolean => Boolean(beach.amenities?.beachBar);
const hasBlueFlag2026Award = (beach: Beach): boolean => (
  beach.blueFlag2026?.awarded === true ||
  beach.metadata?.blueFlag2026?.awarded === true
);

export const beachMatchesUserPreferences = (beach: Beach, preferences?: UserPreferences): boolean => {
  if (!hasActivePreferences(preferences) || !preferences) return true;

  const typeFiltersActive = preferences.sandy || preferences.pebbles;
  if (typeFiltersActive) {
    const matchesSandy = preferences.sandy && matchesSurfaceFilter(beach, 'sandy');
    const matchesPebbles = preferences.pebbles && matchesSurfaceFilter(beach, 'pebbles');
    if (!matchesSandy && !matchesPebbles) return false;
  }

  if (preferences.blueFlag2026 && !hasBlueFlag2026Award(beach)) return false;
  if (preferences.quiet && !isQuietBeach(beach)) return false;
  if (preferences.beachBar && !hasBeachBarAmenity(beach)) return false;
  if (preferences.familyFriendly && !isFamilyFriendlyBeach(beach)) return false;
  if (preferences.snorkeling && !isSnorkelingBeach(beach)) return false;
  if (preferences.easyAccess && !hasTrulyEasyAccess(beach)) return false;
  if (preferences.deepWater && !beach.characteristics?.deepWaters) return false;
  if (preferences.shallowWater && !beach.characteristics?.shallowWaters) return false;
  if (preferences.surfing && !beach.activities?.surfing) return false;
  if (preferences.parking && !beach.amenities?.parking) return false;

  return true;
};

export const filterBeachesByUserPreferences = (
  beaches: Beach[],
  preferences?: UserPreferences
): Beach[] => beaches.filter(beach => beachMatchesUserPreferences(beach, preferences));

const getKeyBeachHours = (hourlyForecast?: ForecastItem[]): ForecastItem[] => {
  if (!hourlyForecast || hourlyForecast.length === 0) return [];

  const daytime = hourlyForecast.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 10 && hour <= 18;
  });

  if (daytime.length >= 3) return daytime;
  return hourlyForecast.slice(0, 12);
};

const RAIN_PROBABILITY_BLOCK_THRESHOLD = 0.35;

const hasRainWeatherText = (item: ForecastItem): boolean => {
  const weatherText = (item.weather || [])
    .map(entry => `${entry.main || ''} ${entry.description || ''}`)
    .join(' ')
    .toLowerCase();
  return /rain|storm|thunder|drizzle|shower/.test(weatherText);
};

export const hasHourlyRainRisk = (item: ForecastItem): boolean => (
  hasRainWeatherText(item) ||
  (typeof item.pop === 'number' && item.pop >= RAIN_PROBABILITY_BLOCK_THRESHOLD) ||
  (typeof item.rain?.['3h'] === 'number' && item.rain['3h'] > 0)
);

const calculateHourlyRainRisk = (
  hourlyForecast?: ForecastItem[]
): { rainyHours: number; checkedHours: number; allKeyHoursRainy: boolean; hasRainRisk: boolean; rainyWindows: string[] } => {
  const keyHours = getKeyBeachHours(hourlyForecast);
  if (keyHours.length === 0) {
    return { rainyHours: 0, checkedHours: 0, allKeyHoursRainy: false, hasRainRisk: false, rainyWindows: [] };
  }

  const rainyHours = keyHours.filter(hasHourlyRainRisk);
  return {
    rainyHours: rainyHours.length,
    checkedHours: keyHours.length,
    allKeyHoursRainy: rainyHours.length === keyHours.length,
    hasRainRisk: rainyHours.length > 0,
    rainyWindows: rainyHours.map(formatTime),
  };
};

const getHourlyExposureLevel = (
  beach: Beach,
  windDirectionDeg: number,
  windDirection: WindDirection,
  windSpeedKmh: number,
  waveHeightM?: number
): ExposureLevel => {
  return assessBeachWindExposure({
    beach,
    windDirectionDeg,
    windDirection,
    windSpeedKmh,
    beaufort: getBeaufortLevel(windSpeedKmh),
    waveHeightMeters: waveHeightM,
  }).exposureLevel;
};

const calculateHourlySeaScore = (
  beach: Beach,
  hourlyForecast?: ForecastItem[]
): { score?: number; poorHours: number; checkedHours: number } => {
  const keyHours = getKeyBeachHours(hourlyForecast);
  if (keyHours.length === 0) return { poorHours: 0, checkedHours: 0 };

  const scores = keyHours.map(item => {
    const windDirection = degToCompass(item.wind.deg);
    const windSpeedKmh = item.wind.speed * 3.6;
    const exposureLevel = getHourlyExposureLevel(beach, item.wind.deg, windDirection, windSpeedKmh, item.marine?.waveHeightM);
    const isExposed = exposureLevel !== 'protected';
    return calculateSeaConditionScore(
      isExposed,
      windSpeedKmh,
      exposureLevel,
      item.marine?.waveHeightM
    );
  });

  const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return {
    score,
    poorHours: scores.filter(value => value < 5).length,
    checkedHours: scores.length,
  };
};

const getMetadataConfidence = (beach: Beach): 'high' | 'medium' | 'low' => (
  beach.metadata?.confidence || beach.orientation?.confidence || 'medium'
);

const calculateRecommendationConfidence = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  warnings: WarningFlag[],
  options?: ScoreOptions,
  hourlySeaScore?: number,
  dataQualityReasons: string[] = []
): RecommendationConfidence => {
  let score = 55;
  const reasons: string[] = [];
  const weatherSource = options?.weatherSource || 'island-fallback';
  const keyHours = getKeyBeachHours(options?.hourlyForecast || ('hourly' in weather ? weather.hourly : undefined));

  if (weatherSource === 'beach-cluster') {
    score += 18;
    reasons.push('beach-area forecast');
  } else {
    score -= 8;
    reasons.push('island-level fallback');
  }

  if (weather.wind?.speed !== undefined && weather.wind?.deg !== undefined) {
    score += 10;
  } else {
    score -= 20;
    reasons.push('missing wind data');
  }

  if (
    typeof weather.wind?.gust === 'number' ||
    typeof weather.wind?.gustKnots === 'number' ||
    typeof weather.wind?.windGustKnots === 'number' ||
    keyHours.some(item => typeof item.wind?.gust === 'number' || typeof item.wind?.gustKnots === 'number')
  ) {
    score += 4;
  } else {
    score -= 5;
    reasons.push('gust data unavailable');
  }

  if (weather.marine?.waveHeightM !== undefined) {
    score += 14;
    reasons.push('marine wave data');
  } else {
    score -= 10;
    reasons.push('wind-based sea estimate');
  }

  if (keyHours.length >= 4) {
    score += 10;
    reasons.push('hourly beach window');
  } else {
    score -= 8;
  }

  const orientationConfidence = beach.orientation?.confidence || 'medium';
  if (orientationConfidence === 'high') score += 12;
  else if (orientationConfidence === 'medium') score += 5;
  else {
    score -= 12;
    reasons.push('orientation needs verification');
  }

  const metadataConfidence = getMetadataConfidence(beach);
  if (metadataConfidence === 'high') score += 6;
  else if (metadataConfidence === 'low') {
    score -= 10;
    reasons.push('beach metadata needs verification');
  }

  const negativeFeedback = getNegativeFeedbackCount(beach.id);
  if (negativeFeedback > 0) {
    score -= Math.min(15, negativeFeedback * 4);
    reasons.push('recent feedback flagged accuracy');
  }

  if (!hasBeachOfficialWarningStatus(beach)) {
    score -= 6;
    reasons.push('official warnings not checked');
  }

  if (dataQualityReasons.length > 0) {
    score -= Math.min(24, dataQualityReasons.length * 4);
    reasons.push(...dataQualityReasons);
  }

  if (warnings.some(warning => warning.severity === 'critical')) score -= 10;
  if (typeof hourlySeaScore === 'number' && hourlySeaScore < 5) score -= 10;

  const normalized = clampScore(score);
  const calculatedLevel: ForecastConfidence = normalized >= 75 ? 'high' : normalized >= 55 ? 'medium' : 'low';
  const level: ForecastConfidence = !hasBeachOfficialWarningStatus(beach) && calculatedLevel === 'high'
    ? 'medium'
    : calculatedLevel;

  return {
    level,
    score: normalized,
    source: weatherSource,
    reasons: Array.from(new Set(reasons)).slice(0, 5),
  };
};

const exposurePriority = (exposureLevel?: ExposureLevel): number => {
  if (exposureLevel === 'protected') return 0;
  if (exposureLevel === 'partial') return 1;
  return 2;
};

const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = 4;
const PROTECTED_FIRST_BEAUFORT = 5;
const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;

const isEasyMainstreamAccess = (beach: Beach): boolean => (
  beach.accessibility === Accessibility.EASY || beach.metadata?.access?.type === 'asphalt_road'
);

const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant)
);

const mainstreamScore = (beach: Beach): number => {
  const popularity = typeof beach.popularityScore === 'number' ? beach.popularityScore : 0;
  const ratingSignal = Math.max(0, Math.min(20, (beach.rating - 4) * 20));
  const accessSignal = isEasyMainstreamAccess(beach) ? 18 : beach.metadata?.access?.type === 'passable_dirt_road' ? 8 : 0;
  const facilitiesSignal = hasMainstreamFacilities(beach) ? 14 : beach.amenities?.parking ? 5 : 0;
  const familySignal = beach.environment?.familyFriendly ? 6 : 0;
  const remotePenalty = beach.environment?.remote ? 18 : 0;
  const difficultAccessPenalty = beach.accessibility === Accessibility.DIFFICULT || beach.metadata?.access?.type === '4x4_only' || beach.metadata?.access?.type === 'hiking_path_difficult' ? 35 : 0;

  return popularity + ratingSignal + accessSignal + facilitiesSignal + familySignal - remotePenalty - difficultAccessPenalty;
};

const compareRecommendationPriority = <T extends { score: number; exposureLevel?: ExposureLevel; beach?: Beach }>(
  a: T,
  b: T,
  beachById?: Map<number, Beach>,
  windBeaufort: number = PROTECTED_FIRST_BEAUFORT
): number => {
  const exposureDiff = exposurePriority(a.exposureLevel) - exposurePriority(b.exposureLevel);
  const scoreDiff = b.score - a.score;
  const beachA = a.beach ?? ('beachId' in a ? beachById?.get(Number(a.beachId)) : undefined);
  const beachB = b.beach ?? ('beachId' in b ? beachById?.get(Number(b.beachId)) : undefined);

  const compareMainstream = (): number => {
    if (!beachA || !beachB) return 0;
    const mainstreamDiff = mainstreamScore(beachB) - mainstreamScore(beachA);
    if (mainstreamDiff !== 0) return mainstreamDiff;
    const ratingDiff = beachB.rating - beachA.rating;
    if (ratingDiff !== 0) return ratingDiff;
    return beachA.id - beachB.id;
  };

  if (windBeaufort >= PROTECTED_FIRST_BEAUFORT) {
    if (exposureDiff !== 0) return exposureDiff;
    if (Math.abs(scoreDiff) > 14) return scoreDiff;
    const mainstreamDiff = compareMainstream();
    return mainstreamDiff || scoreDiff;
  }

  if (windBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    if (exposureDiff !== 0 && Math.abs(scoreDiff) <= 12) return exposureDiff;
    if (Math.abs(scoreDiff) > 12) return scoreDiff;
    const mainstreamDiff = compareMainstream();
    return mainstreamDiff || exposureDiff || scoreDiff;
  }

  if (Math.abs(scoreDiff) > 5) return scoreDiff;
  const mainstreamDiff = compareMainstream();
  return mainstreamDiff || scoreDiff || exposureDiff;
};

const bestShelteredRecommendationGroup = <T extends { score: number; exposureLevel?: ExposureLevel; beach?: Beach }>(
  items: T[],
  windBeaufort: number
): T[] => {
  if (windBeaufort < PROTECTED_FIRST_BEAUFORT) return items;

  const protectedItems = items.filter(item => item.exposureLevel === 'protected');
  if (protectedItems.length > 0) return protectedItems;

  const partiallyProtectedItems = items.filter(item => item.exposureLevel === 'partial');
  if (partiallyProtectedItems.length > 0) return partiallyProtectedItems;

  return [];
};

const prioritizeProtectedBeachRecommendations = <T extends { score: number; exposureLevel?: ExposureLevel; beach?: Beach }>(
  items: T[],
  beachById?: Map<number, Beach>,
  windBeaufort: number = 0
): T[] => {
  const candidates = bestShelteredRecommendationGroup(items, windBeaufort);
  return [...candidates].sort((a, b) => compareRecommendationPriority(a, b, beachById, windBeaufort));
};

const greekWindDirectionsAccusative: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειους',
  [WindDirection.NE]: 'βορειοανατολικούς',
  [WindDirection.E]: 'ανατολικούς',
  [WindDirection.SE]: 'νοτιοανατολικούς',
  [WindDirection.S]: 'νότιους',
  [WindDirection.SW]: 'νοτιοδυτικούς',
  [WindDirection.W]: 'δυτικούς',
  [WindDirection.NW]: 'βορειοδυτικούς',
};

const greekWindDirectionsSingular: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειο',
  [WindDirection.NE]: 'βορειοανατολικό',
  [WindDirection.E]: 'ανατολικό',
  [WindDirection.SE]: 'νοτιοανατολικό',
  [WindDirection.S]: 'νότιο',
  [WindDirection.SW]: 'νοτιοδυτικό',
  [WindDirection.W]: 'δυτικό',
  [WindDirection.NW]: 'βορειοδυτικό',
};

/**
 * Calculates the best time of day to visit the beach based on hourly forecast.
 */
export const calculateBestBeachTime = (hourlyForecast: ForecastItem[], beach?: Beach): BestBeachTime | undefined => {
  if (!hourlyForecast || hourlyForecast.length === 0) return undefined;

  const relevantForecast = getKeyBeachHours(hourlyForecast);
  if (relevantForecast.length === 0) return undefined;
  if (relevantForecast.every(hasHourlyRainRisk)) return undefined;

  const scored = relevantForecast.map(item => {
    const hasRainRisk = hasHourlyRainRisk(item);
    const windSpeedKmph = item.wind.speed * 3.6;
    const gustKmph = typeof item.wind.gustKnots === 'number'
      ? item.wind.gustKnots * 1.852
      : typeof item.wind.gust === 'number'
        ? item.wind.gust * 3.6
        : undefined;
    const temp = item.main.temp;
    const waveHeightM = item.marine?.waveHeightM;
    const windDirection = degToCompass(item.wind.deg);
    const exposureLevel = beach ? getHourlyExposureLevel(beach, item.wind.deg, windDirection, windSpeedKmph, waveHeightM) : 'partial';
    const isExposed = exposureLevel !== 'protected';
    const seaScore = beach
      ? calculateSeaConditionScore(isExposed, windSpeedKmph, exposureLevel, waveHeightM)
      : (windSpeedKmph < 18 && (waveHeightM === undefined || waveHeightM < 0.8) ? 8 : 5);
    const gustSpread = typeof gustKmph === 'number' ? Math.max(0, gustKmph - windSpeedKmph) : 0;
    const hour = new Date(item.dt * 1000).getHours();

    let comfort = seaScore * 10;
    if (temp < 20) comfort -= (20 - temp) * 3;
    if (temp > 32) comfort -= (temp - 32) * 4;
    if (hour >= 12 && hour <= 16 && temp >= 32) comfort -= 10;
    if (gustSpread >= 15) comfort -= 10;
    if (gustSpread >= 25) comfort -= 10;
    if (beach && beach.popularityScore >= 75 && hour >= 13 && hour <= 17) comfort -= 6;
    if (hasRainRisk) comfort = 0;

    return {
      item,
      time: formatTime(item),
      hour,
      windSpeedKmph,
      gustKmph,
      temp,
      comfort: clampScore(comfort),
      good: !hasRainRisk && comfort >= 65,
    };
  });

  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let bestAverage = -1;
  let currentStartIndex = -1;
  let currentScores: number[] = [];

  const closeWindow = (endIndex: number) => {
    if (currentStartIndex < 0 || currentScores.length === 0) return;
    const average = currentScores.reduce((sum, value) => sum + value, 0) / currentScores.length;
    if (average > bestAverage || (average === bestAverage && currentScores.length > 1)) {
      bestAverage = average;
      bestStart = scored[currentStartIndex].time;
      bestEnd = scored[Math.max(currentStartIndex, endIndex)].time;
    }
  };

  scored.forEach((entry, index) => {
    if (entry.good) {
      if (currentStartIndex < 0) currentStartIndex = index;
      currentScores.push(entry.comfort);
      return;
    }

    closeWindow(index);
    currentStartIndex = -1;
    currentScores = [];
  });
  closeWindow(scored.length - 1);

  if (!bestStart || !bestEnd) {
    const best = scored.reduce((current, candidate) => candidate.comfort > current.comfort ? candidate : current, scored[0]);
    bestStart = best.time;
    bestEnd = best.time;
    bestAverage = best.comfort;
  }

  const first = scored[0];
  const last = scored[scored.length - 1];
  const windIncrease = last.windSpeedKmph - first.windSpeedKmph;
  const maxTemp = Math.max(...scored.map(entry => entry.temp));
  const gustIncrease = (last.gustKmph || 0) - (first.gustKmph || 0);
  const crowdedLater = Boolean(beach && beach.popularityScore >= 75);
  const avoidMidday = maxTemp >= 33 || crowdedLater;

  let avoidTimeWindow: string | undefined;
  if (avoidMidday) {
    avoidTimeWindow = '12:00-16:00';
  } else if (windIncrease >= 8 || gustIncrease >= 10) {
    avoidTimeWindow = '14:00-18:00';
  }

  const reasonParts: string[] = [];
  if (windIncrease >= 8 || gustIncrease >= 10) {
    reasonParts.push('Wind or gusts increase later, so the earlier window is safer.');
  }
  if (maxTemp >= 33) {
    reasonParts.push('Midday heat is less comfortable, especially for families.');
  }
  if (crowdedLater) {
    reasonParts.push('This beach can get busier after lunch.');
  }
  if (reasonParts.length === 0) {
    reasonParts.push(bestAverage >= 75 ? 'Best balance of wind, sea, and temperature.' : 'Most usable window from the available hourly forecast.');
  }

  const bestTimeWindow = formatTimeWindow(bestStart, bestEnd);
  const timeReason = reasonParts.join(' ');

  return {
    bestStart,
    bestEnd,
    reason: timeReason,
    bestTimeWindow,
    avoidTimeWindow,
    timeReason,
  };
};

/**
 * Filters beaches based on search query and active filters.
 */
export const filterBeaches = (
  beaches: Beach[],
  filters: FilterKey[],
  searchQuery: string,
  language: LanguageCode
): Beach[] => {
  let result = beaches;

  // 1. Search Query
  if (searchQuery.trim()) {
    result = result.filter(b => isSearchMatch(searchQuery, [
      b.name[language],
      b.name.en,
      b.name.gr,
      ...(b.aliases || []),
      b.location?.island,
      b.location?.region,
    ]));
  }

  // 2. Filters
  if (filters.length > 0 && !filters.includes('showAll')) {
    result = result.filter(b => {
      return filters.every(f => {
        const filterName = f as string;
        if (f === 'easyAccess') return hasTrulyEasyAccess(b);
        if (filterName === 'quiet') return isQuietBeach(b);
        if (isSurfaceFilter(f)) return matchesSurfaceFilter(b, f);
        // Check amenities
        if (b.amenities && f in b.amenities) return b.amenities[f as keyof typeof b.amenities];
        // Check characteristics
        if (b.characteristics && f in b.characteristics) return b.characteristics[f as keyof typeof b.characteristics];
        // Check activities
        if (b.activities && f in b.activities) return b.activities[f as keyof typeof b.activities];
        // Check environment
        if (b.environment && f in b.environment) return b.environment[f as keyof typeof b.environment];
        return true;
      });
    });
  }

  return result;
};

/**
 * Sorts beaches based on the selected option.
 */
export const sortBeaches = (
  beaches: Beach[],
  sortBy: SortOption,
  windDirection: WindDirection,
  userLocation?: { lat: number; lon: number }
): Beach[] => {
  const sorted = [...beaches];

  switch (sortBy) {
    case 'all':
      break;

    case 'protected':
      sorted.sort((a, b) => b.rating - a.rating);
      break;

    case 'recommended':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
      
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
      
    case 'distance':
      if (userLocation) {
        sorted.sort((a, b) => {
          const distA = calculateDistance(userLocation.lat, userLocation.lon, a.coordinates.lat, a.coordinates.lon);
          const distB = calculateDistance(userLocation.lat, userLocation.lon, b.coordinates.lat, b.coordinates.lon);
          return distA - distB;
        });
      }
      break;
  }

  return sorted;
};

/**
 * Calculates a suitability score (0-100) for a beach based on current weather and user location.
 */
export const calculateBeachScore = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  preferences?: UserPreferences,
  options?: ScoreOptions
): BeachScore => {
  const reasons: string[] = [];
  const warnings: WarningFlag[] = [];
  const addWarning = (warning: WarningFlag) => {
    if (!warnings.some(existing => existing.type === warning.type && existing.message === warning.message)) {
      warnings.push(warning);
    }
  };
  const weatherSource = options?.weatherSource || 'island-fallback';

  // Safety check for missing weather data
  if (!weather || !weather.wind) {
    const confidence: RecommendationConfidence = {
      level: 'low',
      score: 0,
      source: weatherSource,
      reasons: ['weather data unavailable'],
    };
    return {
      beachId: beach.id,
      score: 0,
      swimmingScore: 0,
      experienceScore: 0,
      preferenceScore: 0,
      finalSuitabilityScore: 0,
      swimmingComfort: 'avoid_swimming',
      forecastConfidence: 'low',
      confidenceReasons: confidence.reasons,
      reasons: ["Weather data unavailable"],
      warnings: [{
        type: 'missing_data',
        severity: 'warning',
        message: 'Weather data unavailable.'
      }],
      confidence,
      weatherSource,
    };
  }

  // 1. Weather Data Conversion
  const hourlyForecast = options?.hourlyForecast || ('hourly' in weather ? weather.hourly : undefined);
  const windSpeedKmph = weather.wind.speed * 3.6;
  const windDir = degToCompass(weather.wind.deg);
  const baseBeaufort = getBeaufortLevel(windSpeedKmph);
  const gustKmph = getWeatherGustKmph(weather, hourlyForecast);
  const gustSpreadKmph = typeof gustKmph === 'number' ? Math.max(0, gustKmph - windSpeedKmph) : undefined;
  const gustSpreadRatio = typeof gustKmph === 'number' && windSpeedKmph > 0 ? gustKmph / windSpeedKmph : undefined;
  const temp = getWeatherTemp(weather);
  const marine = weather.marine;
  const waveHeightM = marine?.waveHeightM;
  const recentRainMm = getRecentRainMm(hourlyForecast, options?.recentRainMm);
  const windAssessment = assessBeachWindExposure({
    beach,
    windDirectionDeg: weather.wind.deg,
    windDirection: windDir,
    windSpeedKmh: windSpeedKmph,
    beaufort: baseBeaufort,
    waveHeightMeters: waveHeightM,
    waveDirectionDegrees: marine?.waveDirectionDeg,
    wavePeriodSeconds: marine?.wavePeriodS,
    swellHeightMeters: marine?.swellWaveHeightM,
    swellDirectionDegrees: marine?.swellWaveDirectionDeg,
    seaSurfaceTemperature: marine?.seaSurfaceTemperatureC,
  });
  const fetchExposure = windAssessment.windProfile.fetchExposure || getBeachFetchExposure(beach);
  const seabedSlope = getBeachSeabedSlope(beach);
  const waterEntry = getBeachWaterEntry(beach);
  const waterQualityRiskAfterRain = getBeachWaterQualityRisk(beach);
  const isFamilyMode = Boolean(preferences?.familyFriendly);
  const officialWarningOverride = hasOfficialWarningOverride(beach);
  const dataQualityReasons: string[] = [];

  if (waveHeightM === undefined) {
    warnings.push({
      type: 'missing_data',
      severity: 'info',
      message: 'Wave data unavailable; using wind-based sea estimate.'
    });
    dataQualityReasons.push('missing wave data');
  }
  if (typeof gustKmph !== 'number') {
    dataQualityReasons.push('missing gust data');
  }
  if (!fetchExposure || fetchExposure === 'unknown') {
    dataQualityReasons.push('fetch exposure unknown');
  }
  dataQualityReasons.push(...windAssessment.confidenceReasons);
  if (seabedSlope === 'unknown' && isFamilyMode) {
    dataQualityReasons.push('family entry slope unknown');
  }
  if (waterEntry === 'unknown' && isFamilyMode) {
    dataQualityReasons.push('family water entry unknown');
  }
  if (recentRainMm === undefined) {
    dataQualityReasons.push('recent rain data unavailable');
  }
  if (!hasBeachOfficialWarningStatus(beach)) {
    dataQualityReasons.push('official warning status unknown');
  }
  if (beach.metadata?.confidence === 'low') {
    warnings.push({
      type: 'low_confidence',
      severity: 'info',
      message: 'Beach metadata needs local verification.'
    });
  }
  if (windAssessment.windProfile.confidence === 'low' || windAssessment.source === 'unknown') {
    addWarning({
      type: 'low_confidence',
      severity: 'info',
      message: baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
        ? 'Local wind exposure needs confirmation before committing.'
        : 'Local wind shelter is not verified, but wind should not be a major issue today.',
    });
  }
  if (officialWarningOverride) {
    warnings.push({
      type: 'official_warning',
      severity: 'critical',
      message: getOfficialWarningReason(beach),
    });
  }
  if (beach.accessibility === Accessibility.DIFFICULT) {
    warnings.push({
      type: 'difficult_access',
      severity: 'warning',
      message: 'Access may be difficult.'
    });
  } else if (beach.accessibility === Accessibility.BOAT_ONLY) {
    warnings.push({
      type: 'boat_only',
      severity: 'warning',
      message: 'Boat access only.'
    });
  }

  // 2. Wind Protection & Direction Analysis
  const beachOrientation = windAssessment.windProfile.beachFacingDirection;
  let finalExposureLevel: ExposureLevel = windAssessment.exposureLevel;
  windAssessment.warnings.forEach(addWarning);
  windAssessment.reasons.forEach(reason => reasons.push(reason));

  if (windSpeedKmph >= 30) {
    warnings.push({
      type: 'strong_wind',
      severity: windSpeedKmph >= 40 ? 'critical' : 'warning',
      message: `Strong wind forecast (${Math.round(windSpeedKmph)} km/h).`
    });
  }
  if (typeof gustKmph === 'number' && (
    (typeof gustSpreadRatio === 'number' && gustSpreadRatio >= 1.3) ||
    (typeof gustSpreadKmph === 'number' && gustSpreadKmph >= 8)
  )) {
    warnings.push({
      type: 'gusty_wind',
      severity: gustKmph >= 50 || (gustSpreadKmph || 0) >= 25 ? 'warning' : 'info',
      message: `Gusts may reach ${Math.round(gustKmph)} km/h.`
    });
    reasons.push('Gusty wind affects beach comfort');
  }

  if (windAssessment.canClaimProtected && baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    reasons.push(windSpeedKmph > 15 ? `Better sheltered from ${windDir} wind` : 'Better wind shelter');
  } else if (baseBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    reasons.push('Wind should not be a major issue today');
  } else if (finalExposureLevel === 'exposed' && windSpeedKmph > 15) {
    reasons.push('More open to wind');
  } else if (windSpeedKmph < 10) {
    reasons.push('Gentle breeze');
  } else if (windSpeedKmph <= 20) {
    reasons.push('Moderate breeze');
  } else if (windSpeedKmph <= 30) {
    reasons.push('Windy conditions');
  } else {
    reasons.push('Strong winds');
  }
  if (baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && finalExposureLevel === 'exposed' && windSpeedKmph > 15) {
    warnings.push({
      type: 'exposed_to_wind',
      severity: windSpeedKmph > 25 ? 'warning' : 'info',
      message: 'This beach is more open to the selected day wind.'
    });
  }
  const comfortBeaufortInput = baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
    ? Math.max(baseBeaufort, windAssessment.effectiveBeaufort)
    : baseBeaufort;
  const effectiveBeaufort = getEffectiveBeaufortForComfort(
    comfortBeaufortInput,
    windSpeedKmph,
    gustKmph,
    finalExposureLevel,
    waveHeightM
  );
  const highFetchOnshore = fetchExposure === 'high' && finalExposureLevel === 'exposed';
  const mediumFetchOnshore = fetchExposure === 'medium' && finalExposureLevel === 'exposed';

  // 3. Wave, fetch, and water-quality conditions
  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    if (waveHeightM <= 0.4 && finalExposureLevel === 'protected') {
      reasons.push("Low measured wave height");
    } else if (waveHeightM >= 1.2) {
      reasons.push(`High wave forecast (${waveHeightM.toFixed(1)} m)`);
      warnings.push({
        type: 'rough_sea',
        severity: waveHeightM >= 1.5 ? 'critical' : 'warning',
        message: `Wave forecast is ${waveHeightM.toFixed(1)} m.`
      });
    } else if (waveHeightM >= 0.8) {
      reasons.push(finalExposureLevel === 'protected'
        ? `Protected from moderate wave forecast (${waveHeightM.toFixed(1)} m)`
        : `Some wave risk (${waveHeightM.toFixed(1)} m)`
      );
      if (finalExposureLevel !== 'protected') {
        warnings.push({
          type: 'rough_sea',
          severity: 'warning',
          message: `Some wave risk (${waveHeightM.toFixed(1)} m).`
        });
      }
    } else if (finalExposureLevel === 'protected') {
      reasons.push("Calmer marine forecast");
    }
  } else {
    // Fallback when marine data is unavailable: infer waves from wind and exposure.
    if (windAssessment.canClaimProtected) {
      reasons.push('Wind-sheltered, but wave data is not verified');
    } else if (windSpeedKmph > 20) {
      reasons.push("Likely choppy waters");
    }
  }

  if (highFetchOnshore && effectiveBeaufort >= 4) {
    warnings.push({
      type: 'onshore_chop',
      severity: effectiveBeaufort >= 5 ? 'warning' : 'info',
      message: 'High open-water fetch may build chop on this beach.'
    });
    reasons.push('High fetch can build waves here');
  }

  if (finalExposureLevel === 'protected' && effectiveBeaufort >= 4) {
    warnings.push({
      type: 'offshore_wind',
      severity: effectiveBeaufort >= 5 ? 'warning' : 'info',
      message: 'Offshore wind can push swimmers or inflatables away from shore.'
    });
  }

  const directSwell = Boolean(
    beachOrientation !== null &&
    typeof marine?.swellWaveDirectionDeg === 'number' &&
    typeof marine?.swellWaveHeightM === 'number' &&
    marine.swellWaveHeightM >= 0.5 &&
    calculateWindExposure(beachOrientation, marine.swellWaveDirectionDeg).exposureLevel === 'exposed'
  );
  if (directSwell) {
    warnings.push({
      type: 'direct_swell',
      severity: marine?.swellWaveHeightM && marine.swellWaveHeightM >= 0.9 ? 'warning' : 'info',
      message: 'Swell direction may send waves into this beach.'
    });
    reasons.push('Direct swell exposure');
  }

  const hourlySea = calculateHourlySeaScore(beach, hourlyForecast);
  if (typeof hourlySea.score === 'number' && hourlySea.checkedHours >= 3) {
    if (hourlySea.score >= 8) {
      reasons.push('Good key-hour conditions');
    } else if (hourlySea.score >= 6.5) {
      reasons.push('Usable key-hour conditions');
    } else if (hourlySea.score < 5) {
      reasons.push('Conditions may worsen during key hours');
      warnings.push({
        type: 'rough_sea',
        severity: hourlySea.poorHours >= 3 ? 'warning' : 'info',
        message: 'Some key beach hours may be less comfortable.',
      });
    } else {
      reasons.push('Mixed key-hour conditions');
    }
  }

  const hourlyRain = calculateHourlyRainRisk(hourlyForecast);
  if (hourlyRain.hasRainRisk) {
    const rainyWindowText = hourlyRain.rainyWindows.length > 0
      ? ` around ${hourlyRain.rainyWindows.slice(0, 4).join(', ')}`
      : '';
    warnings.push({
      type: 'rain_risk',
      severity: hourlyRain.allKeyHoursRainy ? 'critical' : 'warning',
      message: hourlyRain.allKeyHoursRainy
        ? 'Possible rain during the main beach hours, so beaches are not recommended for swimming.'
        : `Possible rain during some beach hours${rainyWindowText}; avoid those windows.`,
    });
    reasons.push(hourlyRain.allKeyHoursRainy
      ? 'Possible rain through the main beach hours'
      : 'Avoid rainy beach-hour windows');
  }

  const heavyRecentRain = typeof recentRainMm === 'number' && recentRainMm >= 8;
  const hasRunoffRisk = Boolean(
    beach.nearStreamOrDrain ||
    beach.nearPort ||
    beach.urbanRunoffRisk ||
    beach.metadata?.nearStreamOrDrain ||
    beach.metadata?.nearPort ||
    beach.metadata?.urbanRunoffRisk ||
    waterQualityRiskAfterRain === 'high'
  );
  if (heavyRecentRain && hasRunoffRisk) {
    warnings.push({
      type: 'water_quality_risk',
      severity: waterQualityRiskAfterRain === 'high' ? 'warning' : 'info',
      message: 'Recent rain may affect water clarity/quality near this area.'
    });
    reasons.push('Recent rain water-quality caution');
  } else if (heavyRecentRain && waterQualityRiskAfterRain === undefined) {
    warnings.push({
      type: 'rain_risk',
      severity: 'info',
      message: 'Recent rain data exists, but local runoff risk is not verified.'
    });
  }

  // 4. Temperature and practical comfort
  if (temp >= 22 && temp <= 32) {
    reasons.push("Perfect temperature");
  } else if (temp < 22) {
    if (22 - temp > 5) reasons.push("Cooler temperature");
  } else if (temp > 32) {
    if (temp - 32 > 3) reasons.push("Hot weather");
    warnings.push({
      type: 'heat_uv',
      severity: temp >= 36 ? 'warning' : 'info',
      message: 'Prefer morning or late afternoon in the heat.'
    });
  }

  // 5. Distance score (personalized/explore only)
  let distanceScore = 70;
  if (userLocation) {
    const dist = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      beach.coordinates.lat,
      beach.coordinates.lon
    );

    if (dist < 5) {
      distanceScore = 100;
      reasons.push("Very close to you");
    } else if (dist < 15) {
      distanceScore = 88;
      reasons.push("Short drive");
    } else if (dist < 50) {
      distanceScore = 65;
    } else if (dist > 50) {
      distanceScore = 35;
    }
  }

  // 6. Separated swimming, experience, and preference scores.
  let seaScore = calculateSeaConditionScore(
    finalExposureLevel !== 'protected',
    windSpeedKmph,
    finalExposureLevel,
    waveHeightM
  );
  if (
    baseBeaufort <= 3 &&
    (waveHeightM === undefined || waveHeightM <= 0.5)
  ) {
    const lightWindFloor = finalExposureLevel === 'protected' ? 9 : finalExposureLevel === 'partial' ? 8 : 7;
    seaScore = Math.max(seaScore, lightWindFloor);
  }
  let swimmingScore = seaScore * 10;
  if (finalExposureLevel === 'protected') swimmingScore += baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ? 6 : 2;
  if (finalExposureLevel === 'exposed' && baseBeaufort >= 4) swimmingScore -= 12;
  if (effectiveBeaufort >= 4) swimmingScore -= (effectiveBeaufort - 3) * 7;
  if (typeof gustSpreadKmph === 'number') {
    if (gustSpreadKmph >= 25) swimmingScore -= finalExposureLevel === 'protected' ? 8 : 18;
    else if (gustSpreadKmph >= 15) swimmingScore -= finalExposureLevel === 'protected' ? 4 : 10;
    else if (gustSpreadKmph >= 8) swimmingScore -= finalExposureLevel === 'protected' ? 2 : 5;
  }
  if (highFetchOnshore && effectiveBeaufort >= 4) swimmingScore -= 25;
  else if (mediumFetchOnshore && effectiveBeaufort >= 4) swimmingScore -= 10;
  if (directSwell) swimmingScore -= 12;
  if (typeof waveHeightM === 'number') {
    if (waveHeightM > 1.2) swimmingScore -= 25;
    else if (waveHeightM >= 0.9) swimmingScore -= 16;
    else if (waveHeightM >= 0.6) swimmingScore -= 8;
  }
  swimmingScore += windAssessment.swimmingScoreModifier;
  if (heavyRecentRain && hasRunoffRisk) {
    swimmingScore -= waterQualityRiskAfterRain === 'high' ? 16 : 8;
  }
  if (temp < 18) swimmingScore -= 15;
  else if (temp < 22) swimmingScore -= (22 - temp) * 2;

  if (isFamilyMode && (waveHeightM === undefined || waveHeightM > 0.5 || effectiveBeaufort >= 4)) {
    if (seabedSlope === 'shallow_gradual') swimmingScore += 6;
    if (waterEntry === 'easy') swimmingScore += 5;
    if (seabedSlope === 'steep') {
      swimmingScore -= 12;
      reasons.push('Steeper entry is less family-friendly today');
    }
    if (waterEntry === 'difficult' || waterEntry === 'rocks_only') {
      swimmingScore -= 12;
      reasons.push('Water entry may be harder for families');
    }
  }
  if (officialWarningOverride) swimmingScore = 0;
  swimmingScore = clampScore(swimmingScore);

  const crowdInfo = calculateCrowdLevel(beach, weather, new Date());
  let experienceScore = 65;
  if (finalExposureLevel === 'protected') experienceScore += baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ? 10 : 2;
  else if (finalExposureLevel === 'partial') experienceScore += baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ? 4 : 1;
  else if (baseBeaufort >= 4) experienceScore -= 12;
  if (typeof gustSpreadKmph === 'number' && gustSpreadKmph >= 15) experienceScore -= 8;
  if (temp >= 23 && temp <= 31) experienceScore += 10;
  else if (temp > 34) experienceScore -= 15;
  else if (temp > 32) experienceScore -= 8;
  else if (temp < 20) experienceScore -= 10;
  if (beach.amenities?.naturalShade || beach.metadata?.shade) experienceScore += 8;
  else if (temp >= 33) experienceScore -= 5;
  if (hasMainstreamFacilities(beach)) experienceScore += 10;
  if (beach.amenities?.parking) experienceScore += 5;
  if (beach.accessibility === Accessibility.EASY) experienceScore += 8;
  if (beach.accessibility === Accessibility.DIFFICULT) experienceScore -= 12;
  if (beach.accessibility === Accessibility.BOAT_ONLY) experienceScore -= 18;
  if (beach.environment?.familyFriendly) experienceScore += 5;
  experienceScore += windAssessment.experienceScoreModifier;
  if (crowdInfo.crowdLevel === 'high') experienceScore -= preferences?.quiet ? 15 : 7;
  else if (crowdInfo.crowdLevel === 'low') experienceScore += 5;
  if (swimmingScore < 50) experienceScore -= 10;
  experienceScore = clampScore(experienceScore);

  let preferenceBaseScore = 75;
  const hasPreferences = hasActivePreferences(preferences);
  if (hasPreferences && preferences) {
    let activeCount = 0;
    let matchCount = 0;
    const addMatch = (enabled: boolean, matches: boolean) => {
      if (!enabled) return;
      activeCount += 1;
      if (matches) matchCount += 1;
    };

    addMatch(Boolean(preferences.sandy), beach.beachType === 'sandy' || beach.beachType === 'sandy-pebbles');
    addMatch(Boolean(preferences.pebbles), beach.beachType === 'pebbles' || beach.beachType === 'sandy-pebbles');
    addMatch(Boolean(preferences.quiet), isQuietBeach(beach));
    addMatch(Boolean(preferences.beachBar), hasBeachBarAmenity(beach));
    addMatch(Boolean(preferences.familyFriendly), isFamilyFriendlyBeach(beach));
    addMatch(Boolean(preferences.snorkeling), isSnorkelingBeach(beach));
    addMatch(Boolean(preferences.easyAccess), hasTrulyEasyAccess(beach));
    addMatch(Boolean(preferences.deepWater), beach.characteristics.deepWaters);
    addMatch(Boolean(preferences.shallowWater), beach.characteristics.shallowWaters);
    addMatch(Boolean(preferences.surfing), beach.activities.surfing);
    addMatch(Boolean(preferences.parking), beach.amenities.parking);

    preferenceBaseScore = activeCount > 0 ? (matchCount / activeCount) * 100 : 75;

    if (preferences.sandy) {
      if (beach.beachType === 'sandy') reasons.push('Sandy beach match');
    }
    if (matchCount > 0) {
      reasons.push(`Matches your preferences`);
    }
  }
  const preferenceScore = clampScore(userLocation
    ? (preferenceBaseScore * 0.8) + (distanceScore * 0.2)
    : preferenceBaseScore);

  // If user preference is "quiet beach" and crowdLevel is high, make it explicit.
  if (preferences?.quiet && crowdInfo.crowdLevel === 'high') {
    reasons.push("Likely busy for the selected day (Quiet preference active)");
  } else if (preferences?.quiet && crowdInfo.crowdLevel === 'low') {
    reasons.push("Likely quiet for the selected day");
  }

  const bestBeachTime = calculateBestBeachTime(hourlyForecast || [], beach);

  const negativeFeedback = getNegativeFeedbackCount(beach.id);
  let feedbackPenalty = 0;
  if (negativeFeedback > 0) {
    feedbackPenalty = Math.min(15, negativeFeedback * 3);
    if (feedbackPenalty >= 9) {
      reasons.push("Recent users reported inaccurate conditions");
    }
  }

  const confidence = calculateRecommendationConfidence(
    beach,
    weather,
    warnings,
    { weatherSource, hourlyForecast },
    hourlySea.score,
    dataQualityReasons
  );

  let finalScore = hasPreferences || userLocation
    ? (swimmingScore * 0.55) + (experienceScore * 0.20) + (preferenceScore * 0.15) + (distanceScore * 0.10)
    : (swimmingScore * 0.65) + (experienceScore * 0.25) + (confidence.score * 0.10);

  if (confidence.level === 'low') {
    finalScore -= 6;
    warnings.push({
      type: 'low_confidence',
      severity: 'info',
      message: baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
        ? 'Recommendation confidence is low; check local conditions before going.'
        : 'Recommendation confidence is lower because some local data still needs verification.',
    });
  }
  finalScore -= feedbackPenalty;
  if (typeof windAssessment.finalScoreCap === 'number') {
    finalScore = Math.min(finalScore, windAssessment.finalScoreCap);
  }

  let swimmingComfort = swimmingComfortFromScore(swimmingScore, effectiveBeaufort, waveHeightM, officialWarningOverride);
  if (confidence.level === 'low' && swimmingComfort === 'excellent') {
    swimmingComfort = 'good';
  }
  if (swimmingComfort === 'avoid_swimming') {
    finalScore = officialWarningOverride ? 0 : Math.min(finalScore, 45);
  }
  if (hourlyRain.allKeyHoursRainy) {
    swimmingComfort = 'avoid_swimming';
    finalScore = 0;
  } else if (hourlyRain.hasRainRisk) {
    finalScore = Math.min(finalScore, 72);
    if (swimmingComfort === 'excellent') swimmingComfort = 'good';
  }

  const finalSuitabilityScore = clampScore(finalScore);

  return {
    beachId: beach.id,
    score: finalSuitabilityScore,
    swimmingScore,
    experienceScore,
    preferenceScore,
    finalSuitabilityScore,
    swimmingComfort,
    forecastConfidence: confidence.level,
    confidenceReasons: confidence.reasons,
    reasons: Array.from(new Set(reasons)).slice(0, 8),
    crowdLevel: crowdInfo.crowdLevel,
    crowdScore: crowdInfo.crowdScore,
    exposureLevel: finalExposureLevel,
    orientation: beachOrientation,
    marine,
    waveHeightM,
    warnings,
    confidence,
    weatherSource,
    hourlySeaScore: hourlySea.score,
    bestTimeWindow: bestBeachTime?.bestTimeWindow,
    avoidTimeWindow: bestBeachTime?.avoidTimeWindow,
    timeReason: bestBeachTime?.timeReason,
    windProfile: windAssessment.windProfile,
    windSector: windAssessment.windSector,
    canClaimWindProtection: windAssessment.canClaimProtected,
    seaCalmClaimAllowed: windAssessment.seaCalmClaimAllowed,
  };
};

/**
 * Generates a simple, tourist-friendly explanation for the beach recommendation.
 */
export const generateBeachExplanation = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  score: number,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en'
): string => {
  return generateLocalizedBeachExplanation(beach, weather, score, userLocation, language);
};

const generateLocalizedBeachExplanation = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  score: number,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en',
  recommendation?: Partial<BeachScore> & { bestBeachTime?: BestBeachTime }
): string => {
  if (!weather || !weather.wind) {
    return language === 'gr' ? 'Τα δεδομένα καιρού δεν είναι διαθέσιμα.' : 'Weather data unavailable.';
  }

  const windSpeedKmph = weather.wind.speed * 3.6;
  const windDir = degToCompass(weather.wind.deg);
  const temp = 'main' in weather && weather.main
    ? Math.round(weather.main.temp)
    : 'temp_max' in weather
      ? Math.round(weather.temp_max)
      : 25;

  const windBeaufort = getBeaufortLevel(windSpeedKmph);
  const windAssessment = assessBeachWindExposure({
    beach,
    windDirectionDeg: weather.wind.deg,
    windDirection: windDir,
    windSpeedKmh: windSpeedKmph,
    beaufort: windBeaufort,
    waveHeightMeters: weather.marine?.waveHeightM,
    waveDirectionDegrees: weather.marine?.waveDirectionDeg,
    wavePeriodSeconds: weather.marine?.wavePeriodS,
    swellHeightMeters: weather.marine?.swellWaveHeightM,
    swellDirectionDegrees: weather.marine?.swellWaveDirectionDeg,
    seaSurfaceTemperature: weather.marine?.seaSurfaceTemperatureC,
  });
  const exposureLevel = recommendation?.exposureLevel || windAssessment.exposureLevel;
  const canClaimWindProtection = Boolean(recommendation?.canClaimWindProtection ?? windAssessment.canClaimProtected);
  const isProtectedForCopy = exposureLevel === 'protected' && canClaimWindProtection;
  const waveHeightM = weather.marine?.waveHeightM;
  const seaScore = calculateSeaConditionScore(exposureLevel !== 'protected', windSpeedKmph, exposureLevel, waveHeightM);
  const beachName = displayBeachName(beach.name, language);
  const selectedDate = 'date' in weather ? weather.date : undefined;
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const recommendationWarningTypes = new Set((recommendation?.warnings || []).map(warning => warning.type));
  const isCautionSwimDay = Boolean(
    windBeaufort >= 5 ||
    recommendation?.swimmingComfort === 'caution' ||
    (typeof waveHeightM === 'number' && waveHeightM >= 0.8)
  );
  const rainWarning = recommendation?.warnings?.find(warning => warning.type === 'rain_risk');
  let explanation = '';

  if (rainWarning?.severity === 'critical') {
    return language === 'gr'
      ? 'Λόγω πιθανής βροχής στις βασικές ώρες παραλίας, δεν προτείνεται καμία παραλία για μπάνιο σε αυτό το διάστημα.'
      : 'Because rain is possible during the main beach hours, no beach is recommended for swimming in that window.';
  }

  if (language === 'en' && recommendation) {
    const recommendationExposure = recommendation.exposureLevel || exposureLevel;
    const isProtectedToday = recommendationExposure === 'protected' && canClaimWindProtection;
    const isPartialToday = recommendationExposure === 'partial';
    const bestWindow = recommendation.bestTimeWindow || recommendation.bestBeachTime?.bestTimeWindow;
    const avoidWindow = recommendation.avoidTimeWindow || recommendation.bestBeachTime?.avoidTimeWindow;
    const warningTypes = new Set((recommendation.warnings || []).map(warning => warning.type));
    const confidence = recommendation.forecastConfidence || recommendation.confidence?.level;
    const cautiousLead = confidence === 'low'
      ? 'Based on limited forecast data, '
      : confidence === 'medium'
        ? 'Based on the available forecast, '
        : '';

    if (recommendation.swimmingComfort === 'avoid_swimming' || warningTypes.has('official_warning')) {
      const reason = recommendation.warnings?.find(warning => warning.type === 'official_warning')?.message || 'conditions are not suitable for swimming';
      return `Official warning or safety concern: ${reason} We do not recommend this beach for swimming ${day}.`;
    }

    if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      explanation = recommendation.windProfile?.knownWindSportSpot || recommendationExposure === 'exposed'
        ? `${cautiousLead}${beachName} is usually more exposed, but the wind is light ${day}. Wind should not be a major issue ${day}.`
        : `${cautiousLead}${beachName} has good conditions ${day}. Wind should not be a major issue, so choose mainly by access, beach type, facilities and vibe.`;
    } else if (warningTypes.has('wind_sport_spot')) {
      explanation = `${cautiousLead}${beachName} is a known wind/watersports spot and may be windy or choppy with ${windBeaufort} Beaufort ${day}. It is not a strong calm-swimming pick ${day}.`;
    } else if (isProtectedToday && windBeaufort >= 5) {
      const waveCopy = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
        ? ` and waves around ${waveHeightM.toFixed(1)} m`
        : '';
      explanation = windBeaufort === 5
        ? `${cautiousLead}${beachName} is a better wind option.`
        : `${cautiousLead}${beachName} is a better available option than exposed beaches, but ${windBeaufort} Beaufort ${windDir} wind${waveCopy} make this a caution day for swimming.`;
    } else if (isProtectedToday && windBeaufort >= 4) {
      explanation = `${cautiousLead}${beachName} should be better sheltered from the ${windDir} wind than exposed alternatives, although conditions may still be breezy.`;
    } else if (isProtectedToday) {
      explanation = `${cautiousLead}${beachName} may feel more sheltered than open beaches ${day}.`;
    } else if (isPartialToday) {
      explanation = `${cautiousLead}${beachName} has partial shelter ${day}, so it may work if the wind stays manageable.`;
    } else {
      explanation = `${cautiousLead}${beachName} is more exposed to the ${windDir} wind ${day}, so choose it only if some chop is acceptable.`;
    }

    if (warningTypes.has('onshore_chop')) {
      explanation += windBeaufort === 5
        ? ' Main sea factor: open-water fetch can build chop here.'
        : ' Main caution: open-water fetch can build choppy water here.';
    } else if (warningTypes.has('gusty_wind')) {
      explanation += windBeaufort === 5
        ? ' Main wind factor: gusts may make the beach feel windier than the average wind suggests.'
        : ' Main caution: gusts may make the beach feel windier than the average wind suggests.';
    } else if (warningTypes.has('rain_risk')) {
      explanation += ' Avoid the rainy windows; the recommendation only applies to the drier parts of the day.';
    } else if (warningTypes.has('water_quality_risk')) {
      explanation += ' Recent rain may affect water clarity or quality near this area.';
    } else if (recommendation.swimmingScore !== undefined && recommendation.swimmingScore >= 75) {
      explanation += windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT
        ? ' Main comfort factor: mild wind and manageable sea.'
        : ' Main comfort factor: lower swim chop and better shelter.';
    }

    if (bestWindow) {
      if (isCautionSwimDay) {
        explanation += windBeaufort === 5
          ? ` Most suitable window ${bestWindow}.`
          : ` Most suitable window ${bestWindow}, with caution.`;
      } else {
        explanation += ` Best ${bestWindow}.`;
      }
    }
    if (avoidWindow) {
      explanation += ` Avoid ${avoidWindow} if possible.`;
    }
    if (confidence === 'low' && windBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      explanation += ' Check local sea conditions before committing.';
    } else if (confidence === 'low') {
      explanation += ' Local shelter data is still limited.';
    }

    return explanation;
  }

  if (language === 'gr') {
    if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      explanation = windAssessment.windProfile.knownWindSportSpot || exposureLevel === 'exposed'
        ? `Η ${beachName} είναι συνήθως πιο εκτεθειμένη, αλλά ${day} ο άνεμος είναι ήπιος. Ο άνεμος δεν φαίνεται να είναι βασικό θέμα ${day}.`
        : `Η ${beachName} έχει καλές συνθήκες ${day}. Ο άνεμος δεν φαίνεται να είναι βασικό θέμα ${day}.`;
    } else if (recommendationWarningTypes.has('wind_sport_spot')) {
      explanation = `${beachName}: γνωστό σημείο για wind/watersports με ${windBeaufort} μποφόρ ${day}. Μπορεί να έχει αέρα ή κυματισμό, οπότε δεν είναι δυνατή επιλογή για ήρεμο μπάνιο ${day}.`;
    } else if (isProtectedForCopy) {
      explanation = windSpeedKmph > 20 || isCautionSwimDay
        ? (windBeaufort === 5
          ? `Η ${beachName} είναι πιο υπήνεμη επιλογή.`
          : `Η ${beachName} φαίνεται πιο κατάλληλη από ανοιχτές παραλίες ${day}, αλλά οι συνθήκες θέλουν προσοχή.`)
        : `Η ${beachName} φαίνεται πιθανόν πιο προστατευμένη από ανοιχτές παραλίες ${day}.`;
    } else {
      if (seaScore < 5) {
        explanation = windBeaufort === 5
          ? 'Εκτεθειμένη στον άνεμο.'
          : `Η ${beachName} φαίνεται πιο ανοιχτή στους ${greekWindDirectionsAccusative[windDir]} ανέμους ${day}, οπότε προτίμησέ την μόνο αν έχεις δει πρώτα τις συνθήκες.`;
      } else if (seaScore < 8) {
        explanation = `Η ${beachName} έχει λίγη έκθεση στους ${greekWindDirectionsAccusative[windDir]} ανέμους. Μπορεί να είναι καλή επιλογή όσο ο άνεμος μένει ήπιος, ειδικά αν δεν ψάχνεις απόλυτα ήρεμα νερά.`;
      } else {
        explanation = `Η ${beachName} φαίνεται να έχει ελαφρύ αεράκι ${day} και οι συνθήκες παραμένουν άνετες για επίσκεψη.`;
      }
    }

    if (recommendationWarningTypes.has('rain_risk')) {
      explanation += ' Απόφυγε τις ώρες με πιθανή βροχή· η πρόταση ισχύει μόνο για τα πιο στεγνά διαστήματα της ημέρας.';
    }

    if (temp >= 25 && temp <= 32) {
      explanation += ` Η θερμοκρασία είναι ${temp}°C, ιδανική για κολύμπι.`;
    } else if (temp > 32) {
      explanation += ` Ζεστή μέρα στους ${temp}°C, μην ξεχάσετε αντηλιακό.`;
    } else {
      explanation += ` Με θερμοκρασία ${temp}°C, είναι μια όμορφη μέρα δίπλα στη θάλασσα.`;
    }

    if (userLocation && score > 80) {
      const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
      if (dist < 10) explanation += ' Επίσης, είναι πολύ κοντά σας.';
    }

    return explanation;
  }

  if (language === 'de') {
    explanation = isProtectedForCopy
      ? `${beachName} ist heute eine gute Wahl, weil der Strand vor dem Wind geschutzt ist.`
      : seaScore < 8
        ? `${beachName} ist heute wenig vor Wind geschutzt. Es kann okay sein, solange der Wind schwach bleibt, ist aber keine sichere Wahl fur ganz ruhiges Wasser.`
        : `${beachName} hat heute nur eine leichte Brise und bleibt angenehm fur einen Strandbesuch.`;
    explanation += temp >= 25 && temp <= 32
      ? ` Die Temperatur liegt bei ${temp}°C, ideal zum Schwimmen.`
      : temp > 32
        ? ` Es ist heiss bei ${temp}°C, Sonnenschutz nicht vergessen.`
        : ` Mit ${temp}°C ist es eher frisch, aber die Meereslage kann trotzdem gut sein.`;
    return explanation;
  }

  if (language === 'it') {
    explanation = isProtectedForCopy
      ? `${beachName} e una buona scelta oggi perche e riparata dal vento.`
      : seaScore < 8
        ? `${beachName} e poco riparata dal vento oggi. Puo andare bene se il vento resta leggero, ma non e la scelta piu sicura per acqua calma.`
        : `${beachName} ha una brezza leggera oggi ed e piacevole per una visita.`;
    explanation += temp >= 25 && temp <= 32
      ? ` La temperatura e ${temp}°C, ideale per nuotare.`
      : temp > 32
        ? ` Giornata calda a ${temp}°C, porta la protezione solare.`
        : ` Con ${temp}°C fa fresco, ma il mare puo comunque essere piacevole.`;
    return explanation;
  }

  if (language === 'fr') {
    explanation = isProtectedForCopy
      ? `${beachName} est un bon choix aujourd hui car la plage est abritee du vent.`
      : seaScore < 8
        ? `${beachName} est peu abritee du vent aujourd hui. Cela peut rester correct si le vent reste faible, mais ce n est pas le choix le plus sur pour une eau calme.`
        : `${beachName} a seulement une legere brise aujourd hui et reste agreable.`;
    explanation += temp >= 25 && temp <= 32
      ? ` La temperature est de ${temp}°C, ideale pour se baigner.`
      : temp > 32
        ? ` Il fait chaud avec ${temp}°C, prevoyez de la protection solaire.`
        : ` Avec ${temp}°C, l air est frais, mais les conditions de mer peuvent rester bonnes.`;
    return explanation;
  }

  if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    explanation = windAssessment.windProfile.knownWindSportSpot || exposureLevel === 'exposed'
      ? `${beachName} is usually more exposed, but the wind is light ${day}. Wind should not be a major issue ${day}.`
      : `${beachName} has good conditions ${day}. Wind should not be a major issue ${day}.`;
  } else if (recommendationWarningTypes.has('wind_sport_spot')) {
      explanation = `${beachName} is a known wind/watersports spot and may be windy or choppy with ${windBeaufort} Beaufort ${day}. It is not a strong calm-swimming pick ${day}.`;
  } else if (isProtectedForCopy) {
    explanation = windSpeedKmph > 20 || isCautionSwimDay
      ? (windBeaufort === 5
        ? `${beachName} is a better wind option.`
        : `${beachName} is a better available option than exposed beaches ${day}, but conditions still need caution.`)
      : `${beachName} may feel more sheltered than open beaches ${day}.`;
  } else {
    if (seaScore < 5) {
      explanation = windBeaufort === 5
        ? 'Exposed to wind.'
        : `${beachName} looks more open to the ${windDir} wind ${day}. If calm water matters, treat it as a caution option ${day}.`;
    } else if (seaScore < 8) {
      explanation = `${beachName} may feel breezy ${day}. It can still work if conditions stay manageable, but it is not the most reliable calm-water pick.`;
    } else {
      explanation = `${beachName} should have a gentle breeze ${day}, making it pleasant for a visit.`;
    }
  }

  if (temp >= 25 && temp <= 32) {
    explanation += ` The temperature is ${temp}°C, perfect for swimming.`;
  } else if (temp > 32) {
    explanation += ` It's a hot day at ${temp}°C, so don't forget your sunscreen!`;
  } else {
    explanation += ` With a temperature of ${temp}°C, it's a lovely day to be by the sea.`;
  }

  if (userLocation && score > 80) {
    const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
    if (dist < 10) explanation += " Plus, it's just a short drive from you.";
  }

  return explanation;
};

/**
 * Returns the top 3 recommended beaches sorted by suitability score with explanations.
 */
export const getTopRecommendedBeaches = (
  beaches: Beach[],
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  hourlyForecast?: ForecastItem[],
  preferences?: UserPreferences,
  language: LanguageCode = 'en',
  beachWeatherById?: BeachWeatherById
): BeachRecommendation[] => {
  const beachById = new Map(beaches.map(beach => [beach.id, beach]));
  const recommendations = beaches.map(beach => {
    const beachWeather = beachWeatherById?.[beach.id];
    const weatherForBeach = beachWeather || weather;
    const hourlyForBeach = beachWeather?.hourly || hourlyForecast || ('hourly' in weatherForBeach ? weatherForBeach.hourly : undefined);
    const scoreResult = calculateBeachScore(
      beach,
      weatherForBeach,
      userLocation,
      preferences,
      {
        weatherSource: beachWeather ? 'beach-cluster' : 'island-fallback',
        hourlyForecast: hourlyForBeach,
      }
    );
    const bestBeachTime = hourlyForBeach ? calculateBestBeachTime(hourlyForBeach, beach) : undefined;
    const explanation = generateLocalizedBeachExplanation(beach, weatherForBeach, scoreResult.score, userLocation, language, {
      ...scoreResult,
      bestBeachTime,
    });
    
    return {
      beachId: beach.id,
      score: scoreResult.score,
      swimmingScore: scoreResult.swimmingScore,
      experienceScore: scoreResult.experienceScore,
      preferenceScore: scoreResult.preferenceScore,
      finalSuitabilityScore: scoreResult.finalSuitabilityScore,
      swimmingComfort: scoreResult.swimmingComfort,
      forecastConfidence: scoreResult.forecastConfidence,
      confidenceReasons: scoreResult.confidenceReasons,
      explanation,
      bestBeachTime,
      bestTimeWindow: scoreResult.bestTimeWindow || bestBeachTime?.bestTimeWindow,
      avoidTimeWindow: scoreResult.avoidTimeWindow || bestBeachTime?.avoidTimeWindow,
      timeReason: scoreResult.timeReason || bestBeachTime?.timeReason,
      crowdLevel: scoreResult.crowdLevel,
      crowdScore: scoreResult.crowdScore,
      exposureLevel: scoreResult.exposureLevel,
      orientation: scoreResult.orientation,
      marine: scoreResult.marine,
      waveHeightM: scoreResult.waveHeightM,
      warnings: scoreResult.warnings,
      confidence: scoreResult.confidence,
      weatherSource: scoreResult.weatherSource,
      hourlySeaScore: scoreResult.hourlySeaScore,
      windProfile: scoreResult.windProfile,
      windSector: scoreResult.windSector,
      canClaimWindProtection: scoreResult.canClaimWindProtection,
      seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed
    };
  });

  const windSpeedKmh = weather.wind.speed * 3.6;
  const windBeaufort = getBeaufortLevel(windSpeedKmh);
  const topPickCandidates = recommendations.filter(item => {
    if (item.swimmingComfort === 'avoid_swimming') return false;
    if (item.warnings?.some(warning => warning.type === 'official_warning' && warning.severity === 'critical')) return false;
    if (typeof item.swimmingScore === 'number' && item.swimmingScore < 50) return false;
    const isExposed = item.exposureLevel ? item.exposureLevel !== 'protected' : true;
    let seaScore = calculateSeaConditionScore(isExposed, windSpeedKmh, item.exposureLevel, item.waveHeightM);
    if (windBeaufort <= 3 && (item.waveHeightM === undefined || item.waveHeightM <= 0.5)) {
      const lightWindFloor = item.exposureLevel === 'protected' ? 9 : item.exposureLevel === 'partial' ? 8 : 7;
      seaScore = Math.max(seaScore, lightWindFloor);
    }
    return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
      (typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE);
  });
  const prioritizedRecommendations = prioritizeProtectedBeachRecommendations(topPickCandidates, beachById, windBeaufort);

  // Return top 3
  return prioritizedRecommendations.slice(0, 3);
};

/**
 * Filters beaches within a certain distance from the user.
 */
export const filterNearbyBeaches = (
  beaches: Beach[],
  userLocation: { lat: number; lon: number } | undefined,
  maxDistance: number = 150
): Beach[] => {
  if (!userLocation) return beaches;
  
  return beaches.filter(beach => {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      beach.coordinates.lat,
      beach.coordinates.lon
    );
    return distance <= maxDistance;
  });
};

/**
 * Returns all suitable beaches (score >= 60) for Explore Mode.
 */
export const getSuitableBeaches = (
  beaches: Beach[],
  weather: WeatherData | DailyForecast,
  language: LanguageCode,
  userLocation?: { lat: number; lon: number },
  hourlyForecast?: ForecastItem[],
  preferences?: UserPreferences,
  beachWeatherById?: BeachWeatherById
): SuitableBeach[] => {
  const suitableBeaches: SuitableBeach[] = [];

  // Pre-filter beaches based on active hard-filter preferences.
  const preFiltered = filterBeachesByUserPreferences(beaches, preferences);

  preFiltered.forEach(beach => {
    const beachWeather = beachWeatherById?.[beach.id];
    const weatherForBeach = beachWeather || weather;
    const hourlyForBeach = beachWeather?.hourly || hourlyForecast || ('hourly' in weatherForBeach ? weatherForBeach.hourly : undefined);
    const scoreResult = calculateBeachScore(
      beach,
      weatherForBeach,
      userLocation,
      preferences,
      {
        weatherSource: beachWeather ? 'beach-cluster' : 'island-fallback',
        hourlyForecast: hourlyForBeach,
      }
    );

    if (scoreResult.score >= 60 && scoreResult.swimmingComfort !== 'avoid_swimming') {
      const bestBeachTime = hourlyForBeach ? calculateBestBeachTime(hourlyForBeach, beach) : undefined;
      const explanation = generateLocalizedBeachExplanation(beach, weatherForBeach, scoreResult.score, userLocation, language, {
        ...scoreResult,
        bestBeachTime,
      });
      
      let distance: number | undefined;
      if (userLocation) {
        distance = calculateDistance(
          userLocation.lat, 
          userLocation.lon, 
          beach.coordinates.lat, 
          beach.coordinates.lon
        );
      }

      const isExposed = scoreResult.exposureLevel ? scoreResult.exposureLevel !== 'protected' : true;

      suitableBeaches.push({
        beachId: beach.id,
        name: displayBeachName(beach.name, language),
        score: scoreResult.score,
        swimmingScore: scoreResult.swimmingScore,
        experienceScore: scoreResult.experienceScore,
        preferenceScore: scoreResult.preferenceScore,
        finalSuitabilityScore: scoreResult.finalSuitabilityScore,
        swimmingComfort: scoreResult.swimmingComfort,
        forecastConfidence: scoreResult.forecastConfidence,
        confidenceReasons: scoreResult.confidenceReasons,
        explanation,
        distance,
        beach: { ...beach, crowdLevel: scoreResult.crowdLevel, crowdScore: scoreResult.crowdScore },
        bestBeachTime,
        bestTimeWindow: scoreResult.bestTimeWindow || bestBeachTime?.bestTimeWindow,
        avoidTimeWindow: scoreResult.avoidTimeWindow || bestBeachTime?.avoidTimeWindow,
        timeReason: scoreResult.timeReason || bestBeachTime?.timeReason,
        isExposed,
        crowdLevel: scoreResult.crowdLevel,
        crowdScore: scoreResult.crowdScore,
        exposureLevel: scoreResult.exposureLevel,
        orientation: scoreResult.orientation,
        marine: scoreResult.marine,
        waveHeightM: scoreResult.waveHeightM,
        warnings: scoreResult.warnings,
        confidence: scoreResult.confidence,
        weatherSource: scoreResult.weatherSource,
        hourlySeaScore: scoreResult.hourlySeaScore,
        windProfile: scoreResult.windProfile,
        windSector: scoreResult.windSector,
        canClaimWindProtection: scoreResult.canClaimWindProtection,
        seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed
      });
    }
  });

  // Default sort follows wind bands: normal beach quality at 0-3 Bft,
  // shelter as a caution signal at 4 Bft, protected-first from 5+ Bft.
  const windBeaufort = getBeaufortLevel(weather.wind.speed * 3.6);
  suitableBeaches.sort((a, b) => compareRecommendationPriority(a, b, undefined, windBeaufort));

  return suitableBeaches;
};
