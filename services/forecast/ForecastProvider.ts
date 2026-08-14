// ─────────────────────────────────────────────────────────────────────────────
// FORECAST PROVIDER SEAM (#2 of the portability roadmap — see core/ARCHITECTURE.md)
//
// WHY: the Open-Meteo endpoints were hardcoded in three places inside
// weatherService.ts. That baked one vendor's hostnames into safety-critical
// fetch code and made two things hard:
//   • swapping/adding a forecast source (portability), and
//   • routing calls through our own edge proxy to protect the key + control cost
//     (the lesson of the €340 Places bill).
//
// The fix is a tiny port: a provider owns *where* a (lat,lon) forecast comes
// from (the URLs). weatherService keeps *everything else* — caching, freshness,
// dedup, and response parsing — because that logic is vendor-agnostic. Owning
// the URL is the meaningful 80%: it's the only part coupled to open-meteo.com.
//
// When a SECOND provider with a different response shape appears, step 2 of this
// seam is to move the response-mapping into the provider too (returning already-
// normalized WeatherData/ForecastItem[]/MarineForecastItem[]). Not needed yet.
// ─────────────────────────────────────────────────────────────────────────────

/** Builds the origin URLs for a forecast source. Pure functions of (lat, lon). */
export interface ForecastProvider {
  /** Stable identifier, e.g. 'open-meteo' — handy for logs/telemetry. */
  readonly id: string;
  // There is deliberately NO current-conditions URL. Open-Meteo charges a full API call for
  // any request, however small, so a six-variable `current=` block cost exactly as much as
  // the hourly forecast that already contains all six for the same coordinate. "Now" is read
  // out of the hourly series instead (weatherService.fetchWeatherData), which is also what
  // every colour and verdict in the app is computed from.
  /** Hourly forecast endpoint (temp, wind, gusts, pressure, uv, precip prob). */
  hourlyForecastUrl(lat: number, lon: number): string;
  /** Marine endpoint (wave/swell height, direction, period, SST). */
  marineForecastUrl(lat: number, lon: number): string;
  /**
   * Same two endpoints, for MANY points in one request.
   *
   * This exists because the per-minute rate limit — not the daily one — is what
   * actually bites: a single Evia region view fired ~71 separate requests, so nine
   * simultaneous visitors were enough to cross Open-Meteo's ~600/min ceiling while
   * the daily bucket sat at a quarter full. Same coordinates, same data, one
   * request. See hooks/useWeather.ts for why we do NOT solve this by sampling
   * fewer places instead.
   */
  hourlyForecastUrlBatch(points: ForecastPoint[]): string;
  marineForecastUrlBatch(points: ForecastPoint[]): string;
  /**
   * Water temperature, split off the marine call on 14/08/2026.
   *
   * Its own endpoint because models are a per-coordinate cost multiplier at Open-Meteo, and
   * the model that carries this one field was inflating every wave request by a third. On its
   * own route it also gets a 12 h cache instead of 3 h, which is honest rather than stale: the
   * response is an hourly series the parser indexes BY TIME, so an older fetch still yields
   * the current hour's own value.
   */
  seaTemperatureUrl(lat: number, lon: number): string;
  seaTemperatureUrlBatch(points: ForecastPoint[]): string;
  /**
   * Saharan-dust endpoint (surface dust concentration, μg/m³). Added 09/08/2026
   * with the paid plan. ONE point per region — dust is a synoptic-scale field
   * (the CAMS cells behind it are ~11 km and events span hundreds of km), so
   * per-cluster sampling would multiply cost for identical numbers.
   */
  dustForecastUrl(lat: number, lon: number): string;
}

export interface ForecastPoint {
  lat: number;
  lon: number;
}
