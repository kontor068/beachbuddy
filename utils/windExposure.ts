import { WindDirection } from '../types';

export type ExposureLevel = 'protected' | 'partial' | 'exposed';

export interface ExposureResult {
  exposureLevel: ExposureLevel;
  exposureScore: number;
}

/**
 * Maps WindDirection enum to degrees (0-360).
 * 0 = North, 90 = East, 180 = South, 270 = West.
 */
export const windDirectionToDegrees = (dir: WindDirection): number => {
  switch (dir) {
    case WindDirection.N: return 0;
    case WindDirection.NE: return 45;
    case WindDirection.E: return 90;
    case WindDirection.SE: return 135;
    case WindDirection.S: return 180;
    case WindDirection.SW: return 225;
    case WindDirection.W: return 270;
    case WindDirection.NW: return 315;
    default: return 0;
  }
};

/**
 * Estimates the beach orientation (direction the beach faces) based on protected directions.
 * Logic: The beach faces the opposite direction of the land mass that protects it.
 * If protected from North, land is North, beach faces South.
 */
export const estimateBeachOrientation = (protectedFrom: WindDirection[]): number | null => {
  if (!protectedFrom || protectedFrom.length === 0) return null;

  // Calculate vector sum of protected directions (representing the land mass)
  let sumX = 0;
  let sumY = 0;

  protectedFrom.forEach(dir => {
    const deg = windDirectionToDegrees(dir);
    const rad = (deg - 90) * (Math.PI / 180); // Convert to standard math angle (0 = East)
    sumX += Math.cos(rad);
    sumY += Math.sin(rad);
  });

  if (sumX === 0 && sumY === 0) return null;

  // Calculate angle of the land mass
  let landAngleRad = Math.atan2(sumY, sumX);
  let landAngleDeg = (landAngleRad * 180 / Math.PI) + 90; // Convert back to compass (0 = North)
  
  // Normalize to 0-360
  if (landAngleDeg < 0) landAngleDeg += 360;

  // Beach faces OPPOSITE to the land mass
  let beachOrientation = (landAngleDeg + 180) % 360;

  return beachOrientation;
};

/**
 * Calculates wind exposure based on beach orientation and wind direction.
 * 
 * @param beachOrientation Direction the beach faces (0-360 degrees)
 * @param windDirection Direction the wind comes FROM (0-360 degrees)
 */
export const calculateWindExposure = (
  beachOrientation: number,
  windDirection: number
): ExposureResult => {
  // Calculate the angle between wind vector and beach facing vector.
  // Wind Direction is WHERE IT COMES FROM.
  // So the Wind Vector points towards (windDirection + 180).
  
  // However, the prompt logic says:
  // "Calculate the angular difference between: windDirection and beachOrientation"
  
  // Let's stick to the prompt's logic interpretation:
  // If wind comes FROM North (0) and Beach faces North (0).
  // Wind blows South. Beach faces North.
  // This is a direct hit (Onshore). Bad.
  // Difference = 0.
  
  // If wind comes FROM North (0) and Beach faces South (180).
  // Wind blows South. Beach faces South.
  // Wind blows from land to sea (Offshore). Good.
  // Difference = 180.
  
  // So:
  // Diff ~ 0 => Exposed (Bad)
  // Diff ~ 180 => Protected (Good)
  
  let diff = Math.abs(beachOrientation - windDirection);
  if (diff > 180) diff = 360 - diff; // Normalize to 0-180
  
  // Logic:
  // 0 - 60 degrees difference: Onshore / Exposed
  // 60 - 120 degrees difference: Cross-shore / Partial
  // 120 - 180 degrees difference: Offshore / Protected
  
  if (diff >= 135) {
    return {
      exposureLevel: 'protected',
      exposureScore: 20
    };
  } else if (diff >= 90) {
    return {
      exposureLevel: 'partial',
      exposureScore: 10
    };
  } else if (diff >= 45) {
    return {
      exposureLevel: 'partial',
      exposureScore: 5
    };
  } else {
    return {
      exposureLevel: 'exposed',
      exposureScore: -20
    };
  }
};
