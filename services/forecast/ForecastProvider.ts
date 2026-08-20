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
   * The wave TAIL and the spike witness, split off the marine call on 20/08/2026 (PORISMA §Γ43).
   *
   * `ewam` reports a wave height for exactly 94 hours — measured at 153 points, min = median =
   * max — so `meteofrance_wave` supplies hours 95-144 and nothing inside days 1-4. Its own route
   * buys it a 12 h cache instead of 3 h, matching the 12 h cadence at which the model actually
   * publishes. The split itself saves nothing: Open-Meteo prices models per coordinate, so two
   * one-model requests weigh the same as one two-model request. The cache lifetime is the saving.
   *
   * This leg is ALSO the witness of `uncorroboratedSpikeHours`, so it must keep covering the same
   * days as the wave call — the two series are merged hour-for-hour, by timestamp.
   */
  marineTailForecastUrl(lat: number, lon: number): string;
  marineTailForecastUrlBatch(points: ForecastPoint[]): string;
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
  /**
   * Wind DIRECTION over the water in front of the shore — the over-water wind layer
   * (utils/overWaterWind.ts, PORISMA §Γ29/§Γ37β). Added 20/08/2026.
   *
   * Its own route for the same reason water temperature got one: it must carry
   * `cell_selection=sea`, and the two existing forecast URLs must NOT. They also carry
   * `temperature_2m`, and a sea cell would print sea-cell air temperature on a Greek July
   * afternoon — which is exactly why `cell_selection=sea` was kept off them for a year.
   *
   * ONE hourly field. Open-Meteo floors a request at one call per coordinate whatever it
   * asks for, so this is as cheap as a request can be — but it is still a full extra call per
   * cell, which is the entire cost of the layer. Only the 666 sea cells that serve beaches
   * past the 3 km gate are ever requested (data/forecast-sea-cells.generated.json), and only
   * when the land wind reaches OVER_WATER_MIN_BEAUFORT.
   */
  overWaterWindUrlBatch(points: ForecastPoint[]): string;
}

export interface ForecastPoint {
  lat: number;
  lon: number;
}
