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

const GRAVITY = 9.81;
const KMH_TO_MS = 1 / 3.6;
const KM_TO_M = 1000;

/** Wind speeds below this (m/s) cannot build meaningful waves over any fetch. */
const MIN_WIND_MS = 0.5;

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
