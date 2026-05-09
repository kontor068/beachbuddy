import { Beach, ForecastItem } from '../types';

export type CrowdLevel = 'low' | 'medium' | 'high';

export interface CrowdInfo {
  crowdLevel: CrowdLevel;
  crowdScore: number;
}

/**
 * Estimates how crowded a beach will likely be today.
 * 
 * Factors:
 * 1. Beach popularity rating (rating >= 4.8 -> more likely crowded)
 * 2. Distance from major town (closer -> higher probability)
 * 3. Beach facilities (organized/beach bars attract more people)
 * 4. Day of week (Saturday/Sunday -> more crowded)
 * 5. Weather quality (High weather score -> more people)
 */
export function calculateCrowdLevel(
  beach: Beach,
  weather: ForecastItem | any,
  date: Date
): CrowdInfo {
  let score = 0;

  // 1. Popularity Rating (0-30 points)
  if (beach.rating >= 4.8) {
    score += 30;
  } else if (beach.rating >= 4.5) {
    score += 20;
  } else if (beach.rating >= 4.0) {
    score += 10;
  }

  // 2. Distance from major town (0-20 points)
  // Fallback: if it's organized, it's likely closer to infrastructure
  if (beach.amenities.organized) {
    score += 15;
  } else {
    score += 5;
  }

  // 3. Beach Facilities (0-25 points)
  if (beach.amenities.organized) score += 15;
  if (beach.amenities.taverna) score += 10;

  // 4. Day of week (0-15 points)
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) {
    score += 15;
  }

  // 5. Weather Quality (0-10 points)
  // We'll use temperature as a proxy for weather quality here
  let temp = 25;
  if (weather && 'main' in weather && typeof weather.main.temp === 'number') {
    temp = weather.main.temp;
  } else if (weather && 'temp' in weather && typeof weather.temp === 'number') {
    temp = weather.temp;
  }

  if (temp > 28) {
    score += 10; // Perfect beach weather
  } else if (temp > 24) {
    score += 5; // Good beach weather
  }

  // Normalize score to 0-100
  const crowdScore = Math.min(Math.max(score, 0), 100);

  let crowdLevel: CrowdLevel = 'low';
  if (crowdScore >= 70) {
    crowdLevel = 'high';
  } else if (crowdScore >= 40) {
    crowdLevel = 'medium';
  }

  return {
    crowdLevel,
    crowdScore
  };
}
