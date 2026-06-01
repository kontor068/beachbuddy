import { DailyForecast, SuitableBeach } from '../types';

const FORECAST_SNAPSHOT_KEY = 'beach_buddy_forecast_snapshots';
const MAX_SNAPSHOTS = 250;

interface ForecastSnapshot {
  id: string;
  islandId: string;
  beachId: number;
  forecastDate: string;
  capturedAt: string;
  score: number;
  confidenceLevel?: string;
  confidenceScore?: number;
  weatherSource?: string;
  windSpeedKmh: number;
  windDirectionDeg: number;
  waveHeightM?: number;
  hourlySeaScore?: number;
}

const readSnapshots = (): ForecastSnapshot[] => {
  if (typeof localStorage === 'undefined') return [];

  const stored = localStorage.getItem(FORECAST_SNAPSHOT_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSnapshots = (snapshots: ForecastSnapshot[]) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FORECAST_SNAPSHOT_KEY, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
};

export const recordForecastSnapshots = (
  islandId: string,
  forecastDate: Date,
  recommendations: SuitableBeach[],
  fallbackForecast: DailyForecast
) => {
  if (!recommendations.length) return;

  const dateKey = forecastDate.toISOString().slice(0, 10);
  const capturedAt = new Date().toISOString();
  const existing = readSnapshots();
  const nextById = new Map(existing.map(snapshot => [snapshot.id, snapshot]));

  recommendations.slice(0, 5).forEach(recommendation => {
    const id = `${islandId}_${dateKey}_${recommendation.beachId}`;
    nextById.set(id, {
      id,
      islandId,
      beachId: recommendation.beachId,
      forecastDate: dateKey,
      capturedAt,
      score: recommendation.score,
      confidenceLevel: recommendation.confidence?.level,
      confidenceScore: recommendation.confidence?.score,
      weatherSource: recommendation.weatherSource,
      windSpeedKmh: fallbackForecast.wind.speed * 3.6,
      windDirectionDeg: fallbackForecast.wind.deg,
      waveHeightM: recommendation.waveHeightM ?? fallbackForecast.marine?.waveHeightM,
      hourlySeaScore: recommendation.hourlySeaScore,
    });
  });

  writeSnapshots(Array.from(nextById.values()));
};

export const getForecastSnapshots = (): ForecastSnapshot[] => readSnapshots();
