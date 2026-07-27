import { ExposureLevel } from './windExposure';
import { getBeaufortLevel } from './weatherUtils';
import { seaStateSeverityM } from './waveCharacter';

const LIGHT_WIND_SUITABLE_BFT = 2;
/**
 * Swell-equivalent height (m) below which a light-wind day is simply a calm day. 0.5 m is where
 * the measured ladder below first discounts, so the short-circuit and the ladder agree on where
 * "nothing to report" ends. It was 1.0 m, which meant no sea short of waist-high could ever
 * escalate a ≤2 Bft day — the Σχινιάς failure.
 */
const LIGHT_WIND_MAX_EASY_SEA_M = 0.5;

/**
 * Light-wind sea ladder.
 *
 * At ≤2 Bft the general formula below is dominated by wind terms that describe a wind which is not
 * blowing, so a shore can be wind-sheltered and score 9/10 while a sea built somewhere else breaks
 * on it. That is exactly the Σχινιάς failure: offshore breeze, 173.5°-facing shore, 18.7 km of
 * southern fetch, sea running up it — 9/10 and a blue pin.
 *
 * This ladder answers from the sea instead. Two measured corrections shape it:
 *
 *   • It is applied as a CEILING alongside the general formula, never instead of it. Alone, it was
 *     the MORE generous instrument for a big long-period sea — an exposed shore under 1.2 m of
 *     groundswell in dead calm scored 4/10 by the formula (dropped from recommendations) and 5/10
 *     here (back on the list). The app's worst error class, from the code written to remove it.
 *   • It carries the same measured-wave floors as the formula. Without them it was far harsher
 *     than the formula for a sheltered shore, opening a cliff at the 2/3 Bft boundary where a
 *     protected beach under a steep 0.9 m sea went 3/10 at 11 km/h and 8/10 at 12 km/h. Those
 *     floors exist because an offshore grid cell must not bury a sheltered cove, and that reason
 *     does not stop applying just because the wind dropped.
 */
const LIGHT_WIND_CALM_SEA_M = 0.35;
const LIGHT_WIND_ROUGH_SEA_M = 1.5;

const lightWindSeaScore = (
  severityM: number,
  seaExposureLevel: ExposureLevel,
  directSwell: boolean
): number => {
  const span = LIGHT_WIND_ROUGH_SEA_M - LIGHT_WIND_CALM_SEA_M;
  // Continuous, not bucketed: a bucketed ladder scores a 0.55 m roll and a 0.78 m breaking chop
  // identically, which is the distinction this whole path exists to make.
  const raw = severityM <= LIGHT_WIND_CALM_SEA_M
    ? 9
    : severityM >= LIGHT_WIND_ROUGH_SEA_M
      ? 3
      : Math.round(9 - ((severityM - LIGHT_WIND_CALM_SEA_M) / span) * 6);

  if (directSwell) return raw;
  if (seaExposureLevel === 'protected') return Math.max(raw, 6);
  if (seaExposureLevel === 'partial') return Math.max(raw, 4);
  return raw;
};

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
  waveHeightM?: number,
  // R1 (v3 roadmap 2c.2): when a geometric direct swell is detected, the protected/partial
  // measured-wave floors are dropped — those floors exist so an offshore grid cell does not
  // bury a sheltered cove, NOT to hide a real frontal swell breaking on a west-facing beach.
  directSwell: boolean = false,
  // Total-sea period (s). Converts the height into a swell-equivalent one, so a 0.45 m 2.5 s
  // chop and a 0.45 m 8 s roll stop scoring identically. Omitted → the height is used as-is and
  // this function behaves exactly as it did before wave character existed.
  wavePeriodS?: number
): number => {
  const seaExposureLevel = getSeaExposureLevel(isExposed, exposureLevel);
  const beaufort = getBeaufortLevel(windSpeedKmph);
  const severityM = seaStateSeverityM(waveHeightM, wavePeriodS);
  const isLightWind = beaufort <= LIGHT_WIND_SUITABLE_BFT;

  if (isLightWind && (severityM === undefined || severityM < LIGHT_WIND_MAX_EASY_SEA_M)) {
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

  if (severityM !== undefined) {
    let measuredWaveScore = 10;
    if (severityM >= 1.5) measuredWaveScore = 1;
    else if (severityM >= 1.2) measuredWaveScore = 3;
    else if (severityM >= 0.8) measuredWaveScore = 5;
    else if (severityM >= 0.5) measuredWaveScore = 7;
    else if (severityM >= 0.3) measuredWaveScore = 9;

    // Marine grids are offshore/area-level. Use them strongly for exposed beaches,
    // but keep sheltered coves from being over-penalized by a nearby open-sea cell.
    if (seaExposureLevel === 'protected') {
      waveScore = Math.min(waveScore, directSwell ? measuredWaveScore : Math.max(measuredWaveScore, 6));
    } else if (seaExposureLevel === 'partial') {
      waveScore = Math.min(waveScore, directSwell ? measuredWaveScore : Math.max(measuredWaveScore, 4));
    } else {
      waveScore = Math.min(waveScore, measuredWaveScore);
    }
  }

  const generalScore = Math.round((protectionScore * 1.4 + waveScore * 1.6 + windScore * 0.8) / 3.8);
  if (!isLightWind) return generalScore;

  // Whichever instrument reads worse. The ladder catches a shore that is sheltered from the wind
  // but open to the sea; the formula stops a big sea being waved through because the air is still.
  const calmScore = seaExposureLevel === 'exposed' ? 8 : 9;
  return Math.min(calmScore, lightWindSeaScore(severityM as number, seaExposureLevel, directSwell), generalScore);
};

export const hasPoorSeaConditions = (
  isExposed: boolean,
  windSpeedKmph: number,
  exposureLevel?: ExposureLevel,
  waveHeightM?: number,
  wavePeriodS?: number
): boolean => {
  return calculateSeaConditionScore(isExposed, windSpeedKmph, exposureLevel, waveHeightM, false, wavePeriodS) < 5;
};
