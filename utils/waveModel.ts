/**
 * Fetch-limited significant wave height model.
 *
 * Uses the simplified Sverdrup-Munk-Bretschneider (SMB) deep-water,
 * fetch-limited relationship. Given a 10 m wind speed and the open-water
 * fetch in the upwind direction, it estimates the significant wave height
 * (Hs, the mean height of the highest third of waves) the wind can build
 * over that fetch.
 *
 * This is a physical, zero-cost estimate: it lets us reason about
 * swimmability even when live marine (wave) data is missing, and it ties
 * the directional exposure model to an actual expected wave height rather
 * than a bare protected/partial/exposed bucket.
 *
 * Reference form:
 *   Hs = 0.283 * (U^2 / g) * tanh( 0.0125 * (g * F / U^2)^0.42 )
 * with U in m/s, F in metres, g = 9.81 m/s^2, Hs in metres.
 */

import { GROUND_SWELL_MIN_PERIOD_S } from './swellExposure';

const GRAVITY = 9.81;
const KMH_TO_MS = 1 / 3.6;
const KM_TO_M = 1000;
const WIND_CHOP_GUST_MIN_BASE_BEAUFORT = 3;
const WIND_CHOP_GUST_NOTE_ABS_KMH = 40;
const WIND_CHOP_GUST_NOTE_SPREAD_KMH = 18;

/** Wind speeds below this (m/s) cannot build meaningful waves over any fetch. */
const MIN_WIND_MS = 0.5;

export type WaveExposureLevel = 'protected' | 'partial' | 'exposed';

export interface FetchWaveInput {
  /** Sustained 10 m wind speed in km/h. */
  windSpeedKmh: number;
  /** Open-water fetch in the upwind direction, in kilometres. */
  fetchKm: number;
}

/**
 * Estimates fetch-limited significant wave height (metres) for a given wind
 * speed (km/h) and upwind open-water fetch (km). Always returns a finite,
 * non-negative value.
 */
export const estimateFetchLimitedWaveHeightM = ({ windSpeedKmh, fetchKm }: FetchWaveInput): number => {
  const windMs = Math.max(0, windSpeedKmh) * KMH_TO_MS;
  const fetchM = Math.max(0, fetchKm) * KM_TO_M;

  if (windMs < MIN_WIND_MS || fetchM <= 0) return 0;

  const dimensionlessFetch = (GRAVITY * fetchM) / (windMs * windMs);
  const hs = 0.283 * ((windMs * windMs) / GRAVITY) * Math.tanh(0.0125 * Math.pow(dimensionlessFetch, 0.42));

  return Number.isFinite(hs) && hs > 0 ? Number(hs.toFixed(2)) : 0;
};

/**
 * Blends a modeled wave height with a measured (live marine) wave height.
 *
 * - When measured data exists we trust it but never let the displayed value
 *   fall below what the local wind+fetch can physically build at this beach
 *   (open-sea buoys/grid points can under-represent a wind-exposed pocket),
 *   so we take the larger of the two.
 * - When measured data is missing the modeled value fills the gap, so the
 *   user never sees an empty/uncertain wave figure.
 */
export const resolveEffectiveWaveHeightM = (
  measuredWaveHeightM: number | undefined,
  modeledWaveHeightM: number
): number => {
  if (typeof measuredWaveHeightM === 'number' && Number.isFinite(measuredWaveHeightM)) {
    return Number(Math.max(measuredWaveHeightM, modeledWaveHeightM).toFixed(2));
  }
  return modeledWaveHeightM;
};

/**
 * Conservative lower bound for wind chop that can be felt near shore even when
 * the area marine grid reports a low wave height. It is intentionally coarse:
 * enough to avoid false "flat sea" claims on windy days, while still letting
 * genuinely protected beaches remain more manageable than exposed ones.
 */
export const getWindChopWaveFloorM = (
  exposureLevel: WaveExposureLevel,
  beaufort: number,
  windSpeedKmh: number,
  gustKmph?: number
): number => {
  const gustSpreadKmph = typeof gustKmph === 'number' ? Math.max(0, gustKmph - windSpeedKmh) : 0;
  const gusty = beaufort >= WIND_CHOP_GUST_MIN_BASE_BEAUFORT && (
    (typeof gustKmph === 'number' && gustKmph >= WIND_CHOP_GUST_NOTE_ABS_KMH) ||
    gustSpreadKmph >= WIND_CHOP_GUST_NOTE_SPREAD_KMH
  );

  let floor = 0;
  if (beaufort >= 7) {
    floor = exposureLevel === 'protected' ? 0.6 : exposureLevel === 'partial' ? 0.95 : 1.2;
  } else if (beaufort >= 6) {
    floor = exposureLevel === 'protected' ? 0.5 : exposureLevel === 'partial' ? 0.75 : 1;
  } else if (beaufort >= 5) {
    floor = exposureLevel === 'protected' ? 0.4 : exposureLevel === 'partial' ? 0.6 : 0.8;
  } else if (beaufort >= 4) {
    floor = exposureLevel === 'protected' ? 0.3 : exposureLevel === 'partial' ? 0.45 : 0.6;
  } else if (gusty) {
    floor = exposureLevel === 'protected' ? 0.3 : exposureLevel === 'partial' ? 0.4 : 0.5;
  }

  if (floor === 0) return 0;

  const gustBump = gusty ? (exposureLevel === 'protected' ? 0.05 : 0.1) : 0;
  // Cap = the >=7 Bft floor + gust bump, so the tier escalation above stays
  // reachable (tighter caps silently flattened 6-8 Bft to the 5 Bft value).
  const cap = exposureLevel === 'protected' ? 0.65 : exposureLevel === 'partial' ? 1.05 : 1.3;
  return Number(Math.min(cap, floor + gustBump).toFixed(2));
};

/**
 * Light-wind realism cap for the measured (grid) wave height.
 *
 * Open-Meteo's `wave_height` is the TOTAL significant height (wind sea + swell). In an enclosed sea
 * like the Aegean it over-states a calm day: at 1–2 Bft "λάδι" conditions the global model still
 * reports ~0.3–0.6 m of residual/model swell that does not actually reach the shore. Because the
 * displayed value is max(measured, wind-modeled) and the wind term is ~0 in light air, that surfaces
 * as a misleading "0.5 m wave at 1 Bft". This caps the measured value when the wind is light — unless
 * there is a genuine long-period groundswell, which is physically present even in calm wind.
 */
export const capLightWindMeasuredWaveM = (
  measuredWaveHeightM: number,
  beaufort: number,
  swell?: { heightM?: number; periodS?: number }
): number => {
  if (!Number.isFinite(measuredWaveHeightM) || measuredWaveHeightM <= 0) return measuredWaveHeightM;
  // A gentle breeze (≥3 Bft) can already build a real small sea — leave it to the rest of the model.
  if (beaufort >= 3) return measuredWaveHeightM;

  // Genuine long-period groundswell reaches the coast even with calm wind — never cap it away.
  // Same ground-swell threshold as the swell modules (7 s): a 7-9 s swell the app itself
  // calls "genuine" must not be hidden behind the light-wind cap.
  const hasGenuineSwell =
    typeof swell?.periodS === 'number' && swell.periodS >= GROUND_SWELL_MIN_PERIOD_S &&
    typeof swell?.heightM === 'number' && swell.heightM >= 0.4;
  if (hasGenuineSwell) return measuredWaveHeightM;

  // 0–1 Bft: essentially flat; 2 Bft: a light ripple.
  const cap = beaufort <= 1 ? 0.3 : 0.4;
  return Math.min(measuredWaveHeightM, cap);
};
