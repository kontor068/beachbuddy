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
// public Open-Meteo hosts, letting us cache, add a key, and control cost
// server-side without touching the app.
//
// UNSET, the behaviour depends on the build:
//   - `vite dev` (import.meta.env.DEV === true): falls back to calling Open-Meteo's
//     free hosts directly from the browser. Fine for local development — there is
//     no paid key anywhere near this path, and it's the same free tier anyone can
//     call from a browser tab.
//   - every real build (production, deploy-preview, mobile/Capacitor): DEV is
//     always false, so an unset proxy base throws instead of quietly calling the
//     vendor. A commercial deployment must never fall back to an unauthenticated,
//     non-commercial-licensed endpoint just because a config value went missing —
//     that failure has to be loud (caught upstream, surfaced as "unavailable"),
//     not a silent switch to a different provider tier.
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

// Pinned explicitly rather than left on Open-Meteo's default `best_match`: best_match
// silently combines/swaps underlying marine models with no signal in the response (verified
// against Open-Meteo's own source — a stale-run fallback exists with no field marking it), so
// a beach's wave numbers could change for reasons entirely outside this app's control. Pinning
// makes the model deterministic: if it goes stale/unavailable, fields come back null (the
// existing optional-field handling in weatherService.ts / the wind-based fallback already
// cover that) rather than the response silently switching to a different, unannounced model.
//
// TWO models, because no single one carries everything we display:
//   - meteofrance_wave     → the six wave/swell fields. Returns NO sea_surface_temperature
//                            at all (measured: 0 of 24 hourly values, on Milos/Chania/Corfu/
//                            Mykonos alike — it is a wave model, not an ocean model).
//   - meteofrance_currents → sea_surface_temperature, and nothing else we ask for.
// Pinning meteofrance_wave alone therefore silently deleted the «Νερό» water-temperature card
// from every beach-detail page. meteofrance_currents is where best_match was already sourcing
// SST from: its values matched best_match's to 0.0°C across a full day, so requesting it
// explicitly restores exactly the number production already showed — no new provider, no
// change to any displayed value, and waves stay deterministic.
// THREE models, and `ewam` is the one that decides the wave (2026-07-31):
//   - ewam (DWD)            → 0.05° (~5 km). PREFERRED for wave/swell wherever it returns a value.
//   - meteofrance_wave      → 0.08° (~8 km), global, 7 days. Fallback: days 4-6, and the basins
//                             ewam's grid cannot resolve (measured: Σαρωνικός, Ευβοϊκός).
//   - meteofrance_currents  → sea_surface_temperature only. Unchanged.
//
// Measured against REAL Greek buoys (Copernicus In Situ, 9,723 QC-good hourly observations at
// Ηράκλειο + 61277 + Άθως, 2022-09 → 2024-12 — scripts/auditWaveModelAgainstBuoys.py):
//
//                        bias vs buoy      RMSE      dangerous underestimates (>0.4 m at >=5 Bft)
//   meteofrance_wave     -0.07 m (-8.2%)   0.203 m   204
//   ewam                 +0.01 m (+1.7%)   0.184 m    62
//
// The model this app shipped for a year UNDER-reads the sea at every buoy, and by up to -23.9%
// in strong wind at Ηράκλειο. That inverts the assumption the previous design rested on:
// meteofrance_wave was treated as the conservative choice, and it is in fact the optimistic one.
//
// The defect that started this: at 0.08° a Greek island is 1-2 grid cells, so the model cannot
// tell the windward shore from the lee. Measured over 496 meltemi cases (10 islands x 5 days,
// N +/-40 deg, >=4 Bft), the N-vs-S coast difference was 0.05 m for meteofrance_wave (identical
// in 290 of them) against 1.11 m for ewam, with the correct sign 496/496. In the app's own
// thresholds that flipped the verdict on 92% of lee-shore hours.
//
// Not a calibration difference: over 15 open-water points >25 km from any land (1,022 hours) the
// two agree to -0.5%. The coastal gap is purely resolution.
//
// SAFETY NET, unchanged and load-bearing: resolveEffectiveWaveHeightM still takes the LARGER of
// the measurement and this app's own fetch-limited SMB + wind-chop floor, so no model — however
// well it scores against a buoy — can print flat water over a shore our own physics says is
// choppy. That floor is computed without reference to any of these three models.
const MARINE_MODEL = 'models=ewam,meteofrance_wave,meteofrance_currents';

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
// Vite inlines this as a literal true/false per build command, and dead code behind it is
// stripped from production output — unlike PROXY_BASE, it can't be "accidentally unset".
const IS_DEV = import.meta.env?.DEV === true;

/**
 * Resolve the origin for a host: the proxy prefix when configured, else — ONLY in
 * `vite dev` — the real Open-Meteo host. Any other build with no proxy configured
 * throws rather than falling back to a direct vendor call; the caller's existing
 * cache/stale-fallback handling turns that into the app's normal "unavailable" state.
 */
const forecastOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo`;
  if (IS_DEV) return FORECAST_HOST;
  throw new Error('Forecast unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};
const marineOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo-marine`;
  if (IS_DEV) return MARINE_HOST;
  throw new Error('Forecast unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};

export const openMeteoProvider: ForecastProvider = {
  id: 'open-meteo',

  currentWeatherUrl(lat, lon) {
    return `${forecastOrigin()}/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto`;
  },

  hourlyForecastUrl(lat, lon) {
    return `${forecastOrigin()}/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,precipitation_probability&wind_speed_unit=ms&timezone=auto`;
  },

  marineForecastUrl(lat, lon) {
    return `${marineOrigin()}/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${MARINE_HOURLY}&timezone=auto&forecast_days=6&${SEA_CELL}&${MARINE_MODEL}`;
  },

  // Multi-point variants. Open-Meteo takes comma-joined coordinate lists and answers
  // with an ARRAY of the same objects, in request order — but we never trust that
  // order (see weatherService.matchPointIndex). The edge proxy accepts up to 32 pairs
  // per call: netlify/functions/forecast.mjs MAX_COORDINATE_LIST_ITEMS.
  //
  // `timezone=auto` is deliberately NOT used here. With a list, "auto" resolves per
  // point, so two clusters 40 km apart could come back on different time bases and
  // the hourly arrays would no longer line up with each other. Every Greek coast is
  // Europe/Athens; pinning it keeps one clock across the whole batch.
  hourlyForecastUrlBatch(points) {
    const lats = points.map(p => p.lat).join(',');
    const lons = points.map(p => p.lon).join(',');
    return `${forecastOrigin()}/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,precipitation_probability&wind_speed_unit=ms&timezone=Europe%2FAthens`;
  },

  marineForecastUrlBatch(points) {
    const lats = points.map(p => p.lat).join(',');
    const lons = points.map(p => p.lon).join(',');
    return `${marineOrigin()}/v1/marine?latitude=${lats}&longitude=${lons}&hourly=${MARINE_HOURLY}&timezone=Europe%2FAthens&forecast_days=6&${SEA_CELL}&${MARINE_MODEL}`;
  },
};
