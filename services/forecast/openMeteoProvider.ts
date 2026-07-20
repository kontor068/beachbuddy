import type { ForecastProvider } from './ForecastProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Open-Meteo provider — the default (and, today, only) forecast source.
//
// The URLs produced here are BYTE-IDENTICAL to the strings previously inlined in
// weatherService.ts, so wiring this in changes zero behaviour.
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
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'sea_surface_temperature',
].join(',');

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
    return `${marineOrigin()}/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${MARINE_HOURLY}&timezone=auto&forecast_days=6&cell_selection=sea`;
  },
};
