import { mockBeaches, MockBeach, MockBeachType } from '../data/mockBeaches';
import {
  Accessibility,
  MarineConditions,
  UserPreferences,
  WarningFlag,
  WeatherConditions,
  WindDirection,
  WaveCondition,
} from '../types';
import { calculateDistance } from '../utils/weatherUtils';

export interface MockBeachCategoryScores {
  windProtection: number;
  seaComfort: number;
  weatherComfort: number;
  preferenceMatch: number;
  distance: number;
  amenities: number;
}

export interface MockBeachScoreResult {
  beachId: string;
  beachName: string;
  total: number;
  categoryScores: MockBeachCategoryScores;
  explanationBullets: string[];
  topReasons: string[];
  reducedBy: string[];
  warnings: WarningFlag[];
  distanceKm?: number;
}

export interface ScoreMockBeachInput {
  beach: MockBeach;
  weather: WeatherConditions;
  marine?: MarineConditions;
  preferences?: Partial<UserPreferences>;
  userLocation?: { lat: number; lon: number };
}

export const mockWeatherConditions: WeatherConditions = {
  timestamp: '2026-05-02T09:00:00+03:00',
  windDirection: WindDirection.N,
  windSpeedKmh: 28,
  windGustKmh: 38,
  temperatureC: 25,
  cloudCoverPercent: 20,
  rainProbabilityPercent: 5,
  uvIndex: 7,
};

export const mockMarineConditions: MarineConditions = {
  waveHeightM: 0.6,
  waveCondition: 'moderate',
  swellDirection: WindDirection.N,
  seaTemperatureC: 22,
  isComfortableForSwimming: true,
  notes: 'Mock MVP marine conditions; replace with verified marine data later.',
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const activePreferenceEntries = (preferences?: Partial<UserPreferences>) =>
  Object.entries(preferences || {}).filter(([, enabled]) => enabled === true);

const isWindProtected = (beach: MockBeach, windDirection: WindDirection) =>
  beach.orientation.protectedFrom.includes(windDirection);

const isWindFacing = (beach: MockBeach, windDirection: WindDirection) =>
  beach.orientation.faces.includes(windDirection);

const scoreWindProtection = (
  beach: MockBeach,
  weather: WeatherConditions,
  warnings: WarningFlag[],
  topReasons: string[],
  reducedBy: string[],
): number => {
  const protectedFromWind = isWindProtected(beach, weather.windDirection);
  const facingWind = isWindFacing(beach, weather.windDirection);

  let score = protectedFromWind ? 92 : facingWind ? 28 : 62;

  if (weather.windSpeedKmh >= 40) {
    score -= 18;
    warnings.push({
      type: 'strong_wind',
      severity: 'warning',
      message: `Strong wind expected at ${weather.windSpeedKmh} km/h.`,
    });
    reducedBy.push('Strong wind reduces comfort.');
  } else if (weather.windSpeedKmh >= 28) {
    score -= 8;
    warnings.push({
      type: 'strong_wind',
      severity: 'info',
      message: `Wind is noticeable at ${weather.windSpeedKmh} km/h.`,
    });
  }

  if (protectedFromWind) {
    topReasons.push('Local wind exposure needs confirmation before calling this sheltered.');
  } else if (facingWind) {
    warnings.push({
      type: 'exposed_to_wind',
      severity: weather.windSpeedKmh >= 28 ? 'warning' : 'info',
      message: `This beach faces the ${weather.windDirection} wind.`,
    });
    reducedBy.push(`More open to today's ${weather.windDirection} wind.`);
  }

  if (beach.orientation.confidence === 'low') {
    score -= 6;
    warnings.push({
      type: 'low_confidence',
      severity: 'info',
      message: 'Beach orientation is approximate and should be verified.',
    });
  }

  return clampScore(score);
};

const scoreSeaComfort = (
  beach: MockBeach,
  weather: WeatherConditions,
  marine: MarineConditions | undefined,
  warnings: WarningFlag[],
  topReasons: string[],
  reducedBy: string[],
): number => {
  const waveCondition: WaveCondition = marine?.waveCondition || (weather.windSpeedKmh < 18 ? 'calm' : weather.windSpeedKmh < 32 ? 'moderate' : 'rough');
  const waveHeightM = marine?.waveHeightM;

  let score = waveCondition === 'calm' ? 95 : waveCondition === 'moderate' ? 72 : 35;

  if (isWindProtected(beach, weather.windDirection)) score += 8;
  if (isWindFacing(beach, weather.windDirection)) score -= 18;

  if (waveHeightM !== undefined) {
    if (waveHeightM >= 1.2) {
      score -= 25;
      warnings.push({
        type: 'rough_sea',
        severity: 'warning',
        message: `Mock wave height is high at ${waveHeightM.toFixed(1)}m.`,
      });
      reducedBy.push('Higher waves reduce swim comfort.');
    } else if (waveHeightM <= 0.4) {
      score += 8;
      topReasons.push('Low mock wave height suggests calmer water.');
    }
  }

  if (marine?.isComfortableForSwimming === false) {
    score -= 30;
    warnings.push({
      type: 'rough_sea',
      severity: 'critical',
      message: 'Mock marine conditions are not comfortable for swimming.',
    });
  }

  if (score >= 80) topReasons.push('Sea conditions look comfortable for swimming.');
  if (score < 55) reducedBy.push('Sea comfort is not ideal today.');

  return clampScore(score);
};

const scoreWeatherComfort = (
  weather: WeatherConditions,
  warnings: WarningFlag[],
  topReasons: string[],
  reducedBy: string[],
): number => {
  let score = 80;

  if (weather.temperatureC >= 23 && weather.temperatureC <= 30) {
    score += 15;
    topReasons.push(`Comfortable beach temperature around ${weather.temperatureC}°C.`);
  } else if (weather.temperatureC < 18 || weather.temperatureC > 35) {
    score -= 30;
    reducedBy.push(`Temperature is less comfortable at ${weather.temperatureC}°C.`);
  } else {
    score -= 8;
  }

  const rainProbability = weather.rainProbabilityPercent ?? 0;
  if (rainProbability >= 50) {
    score -= 35;
    warnings.push({
      type: 'rain_risk',
      severity: 'warning',
      message: `Rain probability is ${rainProbability}%.`,
    });
    reducedBy.push('Rain risk reduces the recommendation.');
  } else if (rainProbability >= 25) {
    score -= 15;
    warnings.push({
      type: 'rain_risk',
      severity: 'info',
      message: `Some rain risk at ${rainProbability}%.`,
    });
  }

  const cloudCover = weather.cloudCoverPercent ?? 0;
  if (cloudCover >= 80) score -= 8;

  return clampScore(score);
};

const beachTypeMatchesPreference = (beachType: MockBeachType, preference: string) => {
  if (preference === 'sandy') return beachType === 'sand' || beachType === 'mixed';
  if (preference === 'pebbles') return beachType === 'pebbles' || beachType === 'mixed';
  return false;
};

const preferenceMatchesBeach = (beach: MockBeach, key: string) => {
  switch (key) {
    case 'sandy':
    case 'pebbles':
      return beachTypeMatchesPreference(beach.beachType, key);
    case 'quiet':
      return beach.quiet;
    case 'beachBar':
      return beach.beachBar;
    case 'familyFriendly':
      return beach.familyFriendly;
    case 'snorkeling':
      return beach.snorkeling;
    case 'parking':
      return beach.parking;
    case 'easyAccess':
      return beach.accessibility === Accessibility.EASY;
    default:
      return false;
  }
};

const scorePreferenceMatch = (
  beach: MockBeach,
  preferences: Partial<UserPreferences> | undefined,
  topReasons: string[],
  reducedBy: string[],
): number => {
  const active = activePreferenceEntries(preferences);
  if (active.length === 0) return 75;

  const matches = active.filter(([key]) => preferenceMatchesBeach(beach, key));
  const score = (matches.length / active.length) * 100;

  if (matches.length > 0) {
    topReasons.push(`Matches ${matches.length} of ${active.length} selected preference${active.length === 1 ? '' : 's'}.`);
  }
  if (matches.length < active.length) {
    reducedBy.push(`Misses ${active.length - matches.length} selected preference${active.length - matches.length === 1 ? '' : 's'}.`);
  }

  return clampScore(score);
};

const scoreDistance = (
  beach: MockBeach,
  userLocation: { lat: number; lon: number } | undefined,
  warnings: WarningFlag[],
  topReasons: string[],
  reducedBy: string[],
): { score: number; distanceKm?: number } => {
  if (!userLocation) {
    warnings.push({
      type: 'missing_data',
      severity: 'info',
      message: 'User location is missing, so distance is estimated neutrally.',
    });
    return { score: 70 };
  }

  const distanceKm = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
  let score = 100;

  if (distanceKm <= 5) {
    topReasons.push('Very close to your location.');
  } else if (distanceKm <= 20) {
    score = 85;
  } else if (distanceKm <= 50) {
    score = 65;
    reducedBy.push('Further away than nearby alternatives.');
  } else {
    score = 35;
    reducedBy.push('Long distance from your location.');
  }

  return { score: clampScore(score), distanceKm };
};

const scoreAmenities = (
  beach: MockBeach,
  warnings: WarningFlag[],
  topReasons: string[],
  reducedBy: string[],
): number => {
  let score = 45;

  if (beach.parking) score += 15;
  if (beach.beachBar) score += 15;
  if (beach.amenities.length >= 3) score += 15;
  if (beach.accessibility === Accessibility.EASY) score += 15;
  if (beach.accessibility === Accessibility.DIFFICULT) {
    score -= 22;
    warnings.push({
      type: 'difficult_access',
      severity: 'warning',
      message: 'Access is difficult and may not suit every visitor.',
    });
    reducedBy.push('More challenging access needs a little extra planning.');
  }
  if (beach.accessibility === Accessibility.BOAT_ONLY) {
    score -= 35;
    warnings.push({
      type: 'boat_only',
      severity: 'warning',
      message: 'Boat access only.',
    });
  }

  if (score >= 75) topReasons.push('Good practical amenities for a tourist visit.');

  return clampScore(score);
};

const weightedTotal = (scores: MockBeachCategoryScores) =>
  clampScore(
    scores.windProtection * 0.30 +
      scores.seaComfort * 0.20 +
      scores.weatherComfort * 0.15 +
      scores.preferenceMatch * 0.20 +
      scores.distance * 0.10 +
      scores.amenities * 0.05,
  );

export const scoreMockBeach = ({
  beach,
  weather,
  marine = mockMarineConditions,
  preferences,
  userLocation,
}: ScoreMockBeachInput): MockBeachScoreResult => {
  const warnings: WarningFlag[] = [];
  const topReasons: string[] = [];
  const reducedBy: string[] = [];

  const windProtection = scoreWindProtection(beach, weather, warnings, topReasons, reducedBy);
  const seaComfort = scoreSeaComfort(beach, weather, marine, warnings, topReasons, reducedBy);
  const weatherComfort = scoreWeatherComfort(weather, warnings, topReasons, reducedBy);
  const preferenceMatch = scorePreferenceMatch(beach, preferences, topReasons, reducedBy);
  const distanceResult = scoreDistance(beach, userLocation, warnings, topReasons, reducedBy);
  const amenities = scoreAmenities(beach, warnings, topReasons, reducedBy);

  const categoryScores: MockBeachCategoryScores = {
    windProtection,
    seaComfort,
    weatherComfort,
    preferenceMatch,
    distance: distanceResult.score,
    amenities,
  };
  const total = weightedTotal(categoryScores);

  const explanationBullets = [
    ...topReasons.slice(0, 3),
    ...reducedBy.slice(0, 2).map(reason => `Tradeoff: ${reason}`),
  ];

  return {
    beachId: beach.id,
    beachName: beach.name,
    total,
    categoryScores,
    explanationBullets,
    topReasons: topReasons.slice(0, 4),
    reducedBy,
    warnings,
    distanceKm: distanceResult.distanceKm,
  };
};

export const rankMockBeaches = (
  beaches: MockBeach[] = mockBeaches,
  weather: WeatherConditions = mockWeatherConditions,
  marine: MarineConditions = mockMarineConditions,
  preferences?: Partial<UserPreferences>,
  userLocation?: { lat: number; lon: number },
): MockBeachScoreResult[] =>
  beaches
    .map(beach => scoreMockBeach({ beach, weather, marine, preferences, userLocation }))
    .sort((a, b) => b.total - a.total);

export const getTopMockBeachRecommendations = (
  count = 3,
  beaches: MockBeach[] = mockBeaches,
  weather: WeatherConditions = mockWeatherConditions,
  marine: MarineConditions = mockMarineConditions,
  preferences?: Partial<UserPreferences>,
  userLocation?: { lat: number; lon: number },
): MockBeachScoreResult[] =>
  rankMockBeaches(beaches, weather, marine, preferences, userLocation).slice(0, count);
