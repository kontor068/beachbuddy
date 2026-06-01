import { ExposureLevel } from './windExposure';
import { getBeaufortLevel } from './weatherUtils';

const LIGHT_WIND_SUITABLE_BFT = 2;
const LIGHT_WIND_MAX_EASY_WAVE_M = 1;

export const getSeaExposureLevel = (
  isExposed: boolean,
  exposureLevel?: ExposureLevel
): ExposureLevel => {
  return !isExposed ? 'protected' : (exposureLevel || 'exposed');
};

export const calculateSeaConditionScore = (
  isExposed: boolean,
  windSpeedKmph: number,
  exposureLevel?: ExposureLevel,
  waveHeightM?: number
): number => {
  const seaExposureLevel = getSeaExposureLevel(isExposed, exposureLevel);
  const beaufort = getBeaufortLevel(windSpeedKmph);

  if (
    beaufort <= LIGHT_WIND_SUITABLE_BFT &&
    (waveHeightM === undefined || waveHeightM < LIGHT_WIND_MAX_EASY_WAVE_M)
  ) {
    return seaExposureLevel === 'exposed' ? 8 : 9;
  }

  let protectionScore = 10;
  if (seaExposureLevel === 'exposed') {
    protectionScore = 2;
  } else if (seaExposureLevel === 'partial') {
    protectionScore = 7;
  }

  let windScore = 10;
  if (seaExposureLevel === 'protected') {
    if (windSpeedKmph > 45) windScore = 5;
    else if (windSpeedKmph > 35) windScore = 6;
    else if (windSpeedKmph > 25) windScore = 8;
  } else if (seaExposureLevel === 'partial') {
    if (windSpeedKmph > 35) windScore = 4;
    else if (windSpeedKmph > 25) windScore = 6;
    else if (windSpeedKmph > 15) windScore = 8;
  } else {
    if (windSpeedKmph > 30) windScore = 2;
    else if (windSpeedKmph > 20) windScore = 4;
    else if (windSpeedKmph > 10) windScore = 6;
    else windScore = 9;
  }

  let waveScore = 10;
  if (seaExposureLevel === 'protected') {
    if (windSpeedKmph > 40) waveScore = 7;
    else if (windSpeedKmph > 30) waveScore = 8;
  } else if (seaExposureLevel === 'partial') {
    if (windSpeedKmph > 35) waveScore = 5;
    else if (windSpeedKmph > 25) waveScore = 6;
    else if (windSpeedKmph > 15) waveScore = 8;
    else waveScore = 9;
  } else {
    if (windSpeedKmph > 25) waveScore = 2;
    else if (windSpeedKmph > 15) waveScore = 4;
    else if (windSpeedKmph > 10) waveScore = 6;
    else waveScore = 9;
  }

  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    let measuredWaveScore = 10;
    if (waveHeightM >= 1.5) measuredWaveScore = 1;
    else if (waveHeightM >= 1.2) measuredWaveScore = 3;
    else if (waveHeightM >= 0.8) measuredWaveScore = 5;
    else if (waveHeightM >= 0.5) measuredWaveScore = 7;
    else if (waveHeightM >= 0.3) measuredWaveScore = 9;

    // Marine grids are offshore/area-level. Use them strongly for exposed beaches,
    // but keep sheltered coves from being over-penalized by a nearby open-sea cell.
    if (seaExposureLevel === 'protected') {
      waveScore = Math.min(waveScore, Math.max(measuredWaveScore, 6));
    } else if (seaExposureLevel === 'partial') {
      waveScore = Math.min(waveScore, Math.max(measuredWaveScore, 4));
    } else {
      waveScore = Math.min(waveScore, measuredWaveScore);
    }
  }

  return Math.round((protectionScore * 1.4 + waveScore * 1.6 + windScore * 0.8) / 3.8);
};

export const hasPoorSeaConditions = (
  isExposed: boolean,
  windSpeedKmph: number,
  exposureLevel?: ExposureLevel,
  waveHeightM?: number
): boolean => {
  return calculateSeaConditionScore(isExposed, windSpeedKmph, exposureLevel, waveHeightM) < 5;
};
