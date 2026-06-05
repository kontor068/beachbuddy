import { Beach, ForecastItem } from '../types';
import { hasHourlyRainRisk, type BestBeachTime } from './recommendationService';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import type { ExposureLevel } from '../utils/windExposure';
import { assessBeachWindExposure } from '../utils/windExposureEngine';

export interface BeachDayPlan {
  beachId: number;
  arrivalTime: string;
  bestSwimWindow: string;
  conditionsChangeAt: string | null;
  departureTime: string;
  summary: string;
  isGoodDay: boolean;
}

export interface BeachDayPlanContext {
  windSpeedKmh?: number;
  temperatureC?: number;
  weatherMain?: string;
  weatherDescription?: string;
  isExposed?: boolean;
  exposureLevel?: ExposureLevel;
  waveHeightM?: number;
  seaConditionScore?: number;
}

const MIN_SWIMMING_TEMP_C = 20;
const MAX_SWIMMING_TEMP_C = 35;
const LIGHT_WIND_GOOD_DAY_BFT = 2;
const MIN_GOOD_SEA_CONDITION_SCORE = 7;
const LOW_WAVE_MAX_M = 0.5;
const CHOPPY_WAVE_MIN_M = 0.8;
const ROUGH_WAVE_MIN_M = 1.2;
const MAX_PERFECT_CONDITIONS_BFT = 3;

type PlannerSeaTone = 'unknown' | 'easy' | 'some_chop' | 'choppy' | 'rough';

const hasUsefulBestBeachTime = (bestBeachTime?: BestBeachTime): bestBeachTime is BestBeachTime & { bestStart: string; bestEnd: string } => (
  Boolean(bestBeachTime?.bestStart && bestBeachTime?.bestEnd && bestBeachTime.bestStart !== bestBeachTime.bestEnd)
);

const hasBadWeather = (context?: BeachDayPlanContext): boolean => {
  const weatherText = `${context?.weatherMain || ''} ${context?.weatherDescription || ''}`.toLowerCase();
  return /rain|storm|thunder|snow|drizzle/.test(weatherText);
};

const getFiniteNumber = (value?: number): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const getPlannerSeaTone = (waveHeightM?: number): PlannerSeaTone => {
  const waveHeight = getFiniteNumber(waveHeightM);
  if (waveHeight === undefined) return 'unknown';
  if (waveHeight >= ROUGH_WAVE_MIN_M) return 'rough';
  if (waveHeight >= CHOPPY_WAVE_MIN_M) return 'choppy';
  if (waveHeight >= LOW_WAVE_MAX_M) return 'some_chop';
  return 'easy';
};

const getContextBeaufort = (context?: BeachDayPlanContext): number | undefined => {
  const windSpeedKmh = getFiniteNumber(context?.windSpeedKmh);
  return windSpeedKmh === undefined ? undefined : getBeaufortLevel(windSpeedKmh);
};

const hasRoughPlannerConditions = (context?: BeachDayPlanContext): boolean => {
  const seaTone = getPlannerSeaTone(context?.waveHeightM);
  const beaufort = getContextBeaufort(context);
  return seaTone === 'rough' || (beaufort !== undefined && beaufort >= 5);
};

const getMaxForecastWaveHeight = (items: ForecastItem[]): number | undefined => {
  const waveHeights = items
    .map(item => getFiniteNumber(item.marine?.waveHeightM))
    .filter((value): value is number => value !== undefined);

  return waveHeights.length > 0 ? Math.max(...waveHeights) : undefined;
};

const getMaxForecastWindSpeedKmh = (items: ForecastItem[]): number | undefined => {
  const windSpeeds = items
    .map(item => getFiniteNumber(item.wind?.speed))
    .filter((value): value is number => value !== undefined)
    .map(speedMps => speedMps * 3.6);

  return windSpeeds.length > 0 ? Math.max(...windSpeeds) : undefined;
};

const getPlannerSummaryContext = (
  context: BeachDayPlanContext | undefined,
  relevantHours: ForecastItem[]
): BeachDayPlanContext => {
  const summaryContext: BeachDayPlanContext = { ...(context || {}) };
  const maxWaveHeightM = getMaxForecastWaveHeight(relevantHours);
  const maxWindSpeedKmh = getMaxForecastWindSpeedKmh(relevantHours);

  if (maxWaveHeightM !== undefined) {
    summaryContext.waveHeightM = maxWaveHeightM;
  }

  if (maxWindSpeedKmh !== undefined) {
    summaryContext.windSpeedKmh = maxWindSpeedKmh;
  }

  return summaryContext;
};

const getGoodDaySummary = (
  bestBeachTime: BestBeachTime | undefined,
  context: BeachDayPlanContext | undefined,
  isFullDayWindow: boolean
): string => {
  const seaTone = getPlannerSeaTone(context?.waveHeightM);
  const beaufort = getContextBeaufort(context);
  const canCallPerfect = isFullDayWindow &&
    seaTone === 'easy' &&
    (beaufort === undefined || beaufort <= MAX_PERFECT_CONDITIONS_BFT) &&
    !hasBadWeather(context);

  if (seaTone === 'rough' || (beaufort !== undefined && beaufort >= 5)) {
    return 'Conditions may remain windy or choppy through the day.';
  }

  if (seaTone === 'choppy') {
    return 'Prefer the calmer part of the day and use caution if the sea feels choppy.';
  }

  if (seaTone === 'some_chop') {
    return 'Good beach window today, but expect some chop.';
  }

  if (canCallPerfect) {
    return 'Perfect conditions all day! Arrive anytime and stay as long as you like.';
  }

  if (hasUsefulBestBeachTime(bestBeachTime)) {
    return `Good conditions today. The best swim window is ${bestBeachTime.bestStart} - ${bestBeachTime.bestEnd}.`;
  }

  return 'Good conditions today. Arrive anytime during the main beach hours.';
};

const isComfortableLightWindDay = (context?: BeachDayPlanContext): boolean => {
  if (
    typeof context?.windSpeedKmh !== 'number' ||
    typeof context.temperatureC !== 'number' ||
    hasBadWeather(context)
  ) {
    return false;
  }

  return getBeaufortLevel(context.windSpeedKmh) <= LIGHT_WIND_GOOD_DAY_BFT &&
    context.temperatureC >= MIN_SWIMMING_TEMP_C &&
    context.temperatureC <= MAX_SWIMMING_TEMP_C;
};

const hasGoodContextSeaConditions = (context?: BeachDayPlanContext): boolean => (
  !hasBadWeather(context) &&
  typeof context?.temperatureC === 'number' &&
  context.temperatureC >= MIN_SWIMMING_TEMP_C &&
  context.temperatureC <= MAX_SWIMMING_TEMP_C &&
  typeof context.seaConditionScore === 'number' &&
  context.seaConditionScore >= MIN_GOOD_SEA_CONDITION_SCORE
);

const getPlannerExposureLevel = (
  beach: Beach,
  item: ForecastItem,
  fallbackExposureLevel?: ExposureLevel
): ExposureLevel => {
  const windSpeedKmh = item.wind.speed * 3.6;
  const assessment = assessBeachWindExposure({
    beach,
    windDirectionDeg: item.wind.deg,
    windDirection: degToCompass(item.wind.deg),
    windSpeedKmh,
    beaufort: getBeaufortLevel(windSpeedKmh),
    waveHeightMeters: item.marine?.waveHeightM,
    waveDirectionDegrees: item.marine?.waveDirectionDeg,
    wavePeriodSeconds: item.marine?.wavePeriodS,
    swellHeightMeters: item.marine?.swellWaveHeightM,
    swellDirectionDegrees: item.marine?.swellWaveDirectionDeg,
    seaSurfaceTemperature: item.marine?.seaSurfaceTemperatureC,
  });

  return assessment.exposureLevel || fallbackExposureLevel || 'exposed';
};

const hasBadHourlyWeather = (item: ForecastItem): boolean => {
  const weatherText = (item.weather || [])
    .map(entry => `${entry.main || ''} ${entry.description || ''}`)
    .join(' ')
    .toLowerCase();
  return /rain|storm|thunder|snow|drizzle/.test(weatherText) || hasHourlyRainRisk(item);
};

const getRainBlockedPlan = (beachId: number, rainyTimes: string[]): BeachDayPlan => ({
  beachId,
  arrivalTime: 'N/A',
  bestSwimWindow: 'No recommended beach window due to possible rain',
  conditionsChangeAt: null,
  departureTime: 'N/A',
  summary: rainyTimes.length > 0
    ? `Because rain is possible around ${rainyTimes.slice(0, 4).join(', ')}, no beach is recommended for swimming in that window.`
    : 'Because rain is possible during the main beach hours, no beach is recommended for swimming in that window.',
  isGoodDay: false,
});

const createGoodDayPlan = (
  beachId: number,
  bestBeachTime?: BestBeachTime,
  context?: BeachDayPlanContext
): BeachDayPlan => {
  const usefulBestBeachTime = hasUsefulBestBeachTime(bestBeachTime);
  const arrivalTime = usefulBestBeachTime ? bestBeachTime.bestStart : '10:00';
  const departureTime = usefulBestBeachTime ? bestBeachTime.bestEnd : '18:00';

  return {
    beachId,
    arrivalTime,
    bestSwimWindow: `${arrivalTime} - ${departureTime}`,
    conditionsChangeAt: null,
    departureTime,
    summary: getGoodDaySummary(bestBeachTime, context, false),
    isGoodDay: true
  };
};

export const generateBeachDayPlan = (
  beach: Beach,
  hourlyForecast: ForecastItem[],
  bestBeachTime?: BestBeachTime,
  context?: BeachDayPlanContext
): BeachDayPlan => {
  if (!hourlyForecast || hourlyForecast.length === 0) {
    if (isComfortableLightWindDay(context) || hasGoodContextSeaConditions(context)) {
      return createGoodDayPlan(beach.id, bestBeachTime, context);
    }

    return {
      beachId: beach.id,
      arrivalTime: "N/A",
      bestSwimWindow: "N/A",
      conditionsChangeAt: null,
      departureTime: "N/A",
      summary: "Insufficient forecast data to generate a plan.",
      isGoodDay: false
    };
  }

  // Filter for next 12-15 hours or just use what's provided (usually 24h for the day)
  // We assume hourlyForecast is for the relevant day.
  // Let's focus on "daylight" hours roughly 08:00 to 20:00 if possible, 
  // or just process the list provided which is likely the day's forecast.
  
  const relevantHours = hourlyForecast.filter(item => {
    if (!item.dt_txt || !item.dt_txt.includes(' ')) return false;
    const timeParts = item.dt_txt.split(' ');
    const hour = timeParts.length > 1 ? parseInt(timeParts[1].substring(0, 2), 10) : -1;
    return hour >= 8 && hour <= 20; // Focus on beach hours
  });

  if (relevantHours.length === 0) {
    if (isComfortableLightWindDay(context) || hasGoodContextSeaConditions(context)) {
      return createGoodDayPlan(beach.id, bestBeachTime, context);
    }

     return {
      beachId: beach.id,
      arrivalTime: "N/A",
      bestSwimWindow: "N/A",
      conditionsChangeAt: null,
      departureTime: "N/A",
      summary: "No daylight forecast data available.",
      isGoodDay: false
    };
  }

  const rainyRelevantHours = relevantHours.filter(hasHourlyRainRisk);
  if (rainyRelevantHours.length === relevantHours.length) {
    const rainyTimes = rainyRelevantHours.map(item => (
      item.dt_txt && item.dt_txt.includes(' ') && item.dt_txt.split(' ').length > 1
        ? item.dt_txt.split(' ')[1].substring(0, 5)
        : new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    ));
    return getRainBlockedPlan(beach.id, rainyTimes);
  }

  // Keep this aligned with the home-screen light-wind rule: at 0-2 Bft,
  // do not mark a normal warm beach day as "not ideal".
  const isGoodCondition = (item: ForecastItem) => {
    const windSpeedKmh = item.wind.speed * 3.6;
    const temp = item.main.temp;
    const comfortableTemperature = temp >= MIN_SWIMMING_TEMP_C && temp <= MAX_SWIMMING_TEMP_C;
    if (!comfortableTemperature || hasBadHourlyWeather(item)) return false;

    const beaufort = getBeaufortLevel(windSpeedKmh);
    if (beaufort <= LIGHT_WIND_GOOD_DAY_BFT) return true;

    const exposureLevel = getPlannerExposureLevel(beach, item, context?.exposureLevel);
    const isExposed = exposureLevel !== 'protected';
    const waveHeightM = item.marine?.waveHeightM ?? context?.waveHeightM;
    const seaScore = calculateSeaConditionScore(isExposed, windSpeedKmh, exposureLevel, waveHeightM);
    return seaScore >= MIN_GOOD_SEA_CONDITION_SCORE;
  };

  let bestWindowStart: number | null = null;
  let bestWindowEnd: number | null = null;
  let currentWindowStart: number | null = null;
  let maxWindowLength = 0;

  // Find longest window of good conditions
  for (let i = 0; i < relevantHours.length; i++) {
    const item = relevantHours[i];
    if (isGoodCondition(item)) {
      if (currentWindowStart === null) {
        currentWindowStart = i;
      }
    } else {
      if (currentWindowStart !== null) {
        const length = i - currentWindowStart;
        if (length > maxWindowLength) {
          maxWindowLength = length;
          bestWindowStart = currentWindowStart;
          bestWindowEnd = i - 1;
        }
        currentWindowStart = null;
      }
    }
  }
  // Check if window extends to the end
  if (currentWindowStart !== null) {
    const length = relevantHours.length - currentWindowStart;
    if (length > maxWindowLength) {
      maxWindowLength = length;
      bestWindowStart = currentWindowStart;
      bestWindowEnd = relevantHours.length - 1;
    }
  }

  const summaryContext = getPlannerSummaryContext(context, relevantHours);

  if (bestWindowStart === null) {
    if (
      !hasRoughPlannerConditions(summaryContext) &&
      (
        hasUsefulBestBeachTime(bestBeachTime) ||
        isComfortableLightWindDay(summaryContext) ||
        hasGoodContextSeaConditions(summaryContext)
      )
    ) {
      return createGoodDayPlan(beach.id, bestBeachTime, summaryContext);
    }

    // No good window found
    return {
      beachId: beach.id,
      arrivalTime: "N/A",
      bestSwimWindow: "Conditions not ideal today",
      conditionsChangeAt: null,
      departureTime: "N/A",
      summary: "Wind and sea conditions are not ideal for swimming today.",
      isGoodDay: false
    };
  }

  const startItem = relevantHours[bestWindowStart];
  const endItem = relevantHours[bestWindowEnd!];
  
  const startTimeStr = (startItem.dt_txt && startItem.dt_txt.includes(' ') && startItem.dt_txt.split(' ').length > 1) 
    ? startItem.dt_txt.split(' ')[1].substring(0, 5) 
    : new Date(startItem.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
  // Add 3 hours to end time because forecast items are usually 3-hour steps? 
  // Wait, types says "hourly", but OpenWeatherMap free is 3-hourly. 
  // Let's assume the list is hourly if it says "hourlyForecast", but if it's 3-hourly steps, we need to adjust.
  // Looking at the data structure in previous turns (not visible here but standard OWM), it's often 3h.
  // However, the prompt says "hourlyForecast". Let's assume the caller passes granular data or we treat the step as the duration.
  // If `dt_txt` are 3 hours apart (09:00, 12:00), then a "good" item at 12:00 means 12:00-15:00 is good?
  // Let's check the gap.
  let step = 1; // default 1 hour
  if (relevantHours.length > 1) {
      const t1 = new Date(relevantHours[0].dt * 1000).getTime();
      const t2 = new Date(relevantHours[1].dt * 1000).getTime();
      step = (t2 - t1) / (1000 * 60 * 60);
  }

  // Format times
  // Arrival: 30 mins before start if possible, or just start time
  const arrivalTime = startTimeStr;
  
  // Departure: End of the window
  // If step is 3 hours, and endItem is 12:00, it means good until 15:00.
  const endDate = new Date(endItem.dt * 1000);
  endDate.setHours(endDate.getHours() + step);
  const departureTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

  const usefulBestBeachTime = hasUsefulBestBeachTime(bestBeachTime);
  const bestSwimWindow = usefulBestBeachTime
    ? `${bestBeachTime.bestStart} - ${bestBeachTime.bestEnd}`
    : `${startTimeStr} - ${departureTime}`;
  const planArrivalTime = usefulBestBeachTime ? bestBeachTime.bestStart : arrivalTime;
  const planDepartureTime = usefulBestBeachTime ? bestBeachTime.bestEnd : departureTime;

  // Check for conditions worsening
  let conditionsChangeAt: string | null = null;
  let worseReason = "";
  
  if (bestWindowEnd! < relevantHours.length - 1) {
      const nextItem = relevantHours[bestWindowEnd! + 1];
      conditionsChangeAt = (nextItem.dt_txt && nextItem.dt_txt.includes(' ') && nextItem.dt_txt.split(' ').length > 1) 
        ? nextItem.dt_txt.split(' ')[1].substring(0, 5) 
        : new Date(nextItem.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      if (nextItem.wind.speed * 3.6 >= 18) worseReason = "wind picks up";
      else if (hasHourlyRainRisk(nextItem)) worseReason = "possible rain starts";
      else if (nextItem.main.temp < 22) worseReason = "gets too cool";
      else if (nextItem.main.temp > 35) worseReason = "gets too hot";
      else worseReason = "conditions change";
  }

  let summary = "";
  if (maxWindowLength >= relevantHours.length) {
      summary = getGoodDaySummary(bestBeachTime, summaryContext, true);
  } else if (bestWindowStart === 0) {
      summary = `Arrive early (${planArrivalTime}) for the best conditions. ${worseReason ? `It ${worseReason} around ${conditionsChangeAt}.` : "Conditions change later."}`;
  } else {
      summary = `The best time to swim is from ${planArrivalTime}. ${worseReason ? `Conditions worsen after ${planDepartureTime}.` : ""}`;
  }

  return {
    beachId: beach.id,
    arrivalTime: planArrivalTime,
    bestSwimWindow,
    conditionsChangeAt,
    departureTime: planDepartureTime,
    summary,
    isGoodDay: true
  };
};
