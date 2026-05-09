import { ExposureLevel } from './windExposure';

export const getSeaExposureLevel = (
  isExposed: boolean,
  exposureLevel?: ExposureLevel
): ExposureLevel => {
  return !isExposed ? 'protected' : (exposureLevel || 'exposed');
};

export const calculateSeaConditionScore = (
  isExposed: boolean,
  windSpeedKmph: number,
  exposureLevel?: ExposureLevel
): number => {
  const seaExposureLevel = getSeaExposureLevel(isExposed, exposureLevel);

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

  return Math.round((protectionScore * 1.4 + waveScore * 1.6 + windScore * 0.8) / 3.8);
};

export const hasPoorSeaConditions = (
  isExposed: boolean,
  windSpeedKmph: number,
  exposureLevel?: ExposureLevel
): boolean => {
  return calculateSeaConditionScore(isExposed, windSpeedKmph, exposureLevel) < 5;
};
