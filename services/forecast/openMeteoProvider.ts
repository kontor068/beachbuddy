import type { ForecastProvider } from './ForecastProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Open-Meteo provider — the default (and, today, only) forecast source.
//
// This module owns every Open-Meteo URL the app issues. Changing a variable list or a
// cell-selection rule here changes it everywhere at once, which is the point: the wind and
// the wave must always be sampled under the same policy, or the two channels describe
// different water.
//
// EDGE-PROXY SWITCH (zero-cost, no code change):
// Set VITE_FORECAST_PROXY_BASE (build-time env). When present, calls are routed
// to `${base}/open-meteo/...` and `${base}/open-meteo-marine/...` instead of the
// public Open-Meteo hosts. A future edge function (Netlify/Cloudflare Worker)
// maps those two path prefixes back to the real hosts — letting us cache, add a
// key, and control cost server-side without touching the app. Unset → direct.
// ─────────────────────────────────────────────────────────────────────────────

const FORECAST_HOST = 'https://api.open-meteo.com';
const MARINE_HOST = 'https://marine-api.open-meteo.com';

const MARINE_HOURLY = [
  'wave_height',
  'wave_direction',
  'wave_period',
  // NOT requested: wind_wave_height / _direction / _period. They would split the total height into
  // locally generated sea and arrived swell, which is the right decomposition — but nothing reads
  // them yet, and Open-Meteo bills a request by its variable count. Three unused variables is a
  // ~30% weight increase on every marine call, against a quota that is this app's hard ceiling.
  // Add them in the change that consumes them, not before.
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'sea_surface_temperature',
].join(',');

// `cell_selection=sea` is set on the MARINE request only, and deliberately not on the two forecast
// requests below.
//
// It is tempting there: a beach pin is on the coast, so its forecast cell is usually a LAND cell,
// and a 10 m wind carrying land roughness reads well below the wind over the water. Measured at
// Σχινιάς the sea cell gave +13% wind and swung the direction 157° → 177°.
//
// But those two URLs carry the wind that decides map colour, the verdict word, every exposure
// claim, the top-3 ranking and the planner — all of it calibrated against land-cell wind, including
// 128 ground-truth cases and the curated overrides. A global shift in that one variable crosses
// Beaufort boundaries where every colour and word rule switches, and no scenario in the suite can
// see it, because every scenario supplies its own wind. The same URLs also carry temperature_2m,
// so it would quietly show sea-cell air temperature on a Greek July afternoon.
//
// That is a separate, measurable piece of work — an over-water wind layer — not a parameter to
// slip in beside a wave change.
const SEA_CELL = 'cell_selection=sea';

// Optional proxy base (e.g. "https://calmbeach.gr/api"). Read once at module load.
const PROXY_BASE = (import.meta.env?.VITE_FORECAST_PROXY_BASE as string | undefined)?.replace(/\/$/, '');

/** Resolve the origin for a host: the proxy prefix when configured, else the real host. */
const forecastOrigin = () => (PROXY_BASE ? `${PROXY_BASE}/open-meteo` : FORECAST_HOST);
const marineOrigin = () => (PROXY_BASE ? `${PROXY_BASE}/open-meteo-marine` : MARINE_HOST);

export const openMeteoProvider: ForecastProvider = {
  id: 'open-meteo',

  currentWeatherUrl(lat, lon) {
    return `${forecastOrigin()}/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto`;
  },

  hourlyForecastUrl(lat, lon) {
    return `${forecastOrigin()}/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,precipitation_probability&wind_speed_unit=ms&timezone=auto`;
  },

  marineForecastUrl(lat, lon) {
    return `${marineOrigin()}/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${MARINE_HOURLY}&timezone=auto&forecast_days=6&${SEA_CELL}`;
  },
};
