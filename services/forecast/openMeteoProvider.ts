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
const AIR_QUALITY_HOST = 'https://air-quality-api.open-meteo.com';

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
  // sea_surface_temperature MOVED OUT on 14/08/2026 — see SEA_TEMPERATURE_HOURLY below.
].join(',');

// ── Water temperature, on its own request now ────────────────────────────────
//
// It used to ride along in the wave call, which meant `meteofrance_currents` had to be in the
// wave model list. Open-Meteo's published rule (their "How Is One API Call Defined?" panel)
// counts MODELS as a multiplier of their own: three models is three full API calls per
// coordinate, not 2.1 as this project had assumed. So one number that moves about half a
// degree a day was costing a THIRD of the entire marine bill — measured at ~20,000 calls/day
// nationally, against a 33,000/day budget.
//
// Split out, it costs one call per point instead of one third of three, and — the real saving —
// it can be cached for 12 hours instead of 3, because the model behind it publishes twice a
// day. That is not a staleness trade: the response carries an HOURLY series six days long and
// the parser indexes it BY TIME, so a response fetched this morning still yields this
// afternoon's own value. Same number on screen, a quarter of the requests.
//
// Waves keep the 3 h cache and the two wave models untouched: they decide colours and
// verdicts, and nothing about them changes here.
const SEA_TEMPERATURE_HOURLY = 'sea_surface_temperature';

// The only model of the three that ever returned SST (measured: 0 of 24 hourly values from
// meteofrance_wave nationwide). Alone on its own route it no longer inflates the wave call.
const SEA_TEMPERATURE_MODEL = 'models=meteofrance_currents';

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
//   - meteofrance_currents  → REMOVED from this list on 14/08/2026. It carried only
//                             sea_surface_temperature, and a model costs a FULL extra call per
//                             coordinate under Open-Meteo's published weighting. It now has its
//                             own route and its own 12 h cache — see SEA_TEMPERATURE_MODEL above.
//                             The water temperature itself is unchanged: same model, same field,
//                             same number on the card.
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
const MARINE_MODEL = 'models=ewam';

// Η ΟΥΡΑ ΚΑΙ Ο ΜΑΡΤΥΡΑΣ, σε δικό τους αίτημα από 20/08/2026 (PORISMA §Γ43).
//
// ΤΟ ΣΠΑΣΙΜΟ ΔΕΝ ΓΛΙΤΩΝΕΙ ΤΙΠΟΤΑ ΑΠΟ ΜΟΝΟ ΤΟΥ. Ο πάροχος χρεώνει δουλειά, όχι αιτήματα HTTP:
// δύο αιτήματα ενός μοντέλου ζυγίζουν ακριβώς όσο ένα αίτημα δύο μοντέλων (1,0 + 1,0 = 2,0).
// Η οικονομία είναι ΟΛΗ στη μνήμη — 12 ώρες αντί 3, στο netlify/functions/forecast.mjs
// (CDN_MAX_AGE_S.marineTail). Αν κάποιος ξαναενώσει τα δύο pin εδώ «για απλότητα», το κόστος
// επιστρέφει ακέραιο και τίποτα δεν σπάει ορατά — γι' αυτό το φυλάει πύλη.
//
// ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΜΟΝΤΕΛΟ ΑΝΤΕΧΕΙ ΤΙΣ 12 ΩΡΕΣ. Μετρημένο σε 153 σημεία: το ewam δίνει ύψος για
// ΑΚΡΙΒΩΣ 94 ώρες παντού, άρα αυτό εδώ δίνει τις ώρες 95-144 — μέρες 4 ώς 6. Και τα δύο μοντέλα
// δημοσιεύουν κάθε 12 ώρες, οπότε το ερώτημα κάθε 3 ξαναγόραζε την ίδια σειρά ~4 φορές ανά
// τρέξιμο.
//
// ⚠️ ΕΧΕΙ ΚΑΙ ΔΕΥΤΕΡΗ ΔΟΥΛΕΙΑ: είναι ο ΜΑΡΤΥΡΑΣ του uncorroboratedSpikeHours
// (utils/marineForecastParsing). Ο μάρτυρας ΚΑΤΕΒΑΖΕΙ ύψος όταν δεν επιβεβαιώνει κορυφή, άρα
// παλιός μάρτυρας = υποεκτίμηση κύματος που ανεβαίνει. Δύο πράγματα το φράζουν: ο κανόνας του
// ίδιου του parser «κανένας μάρτυρας => καμία κατηγορία» (η απουσία είναι ήδη η ασφαλής
// περίπτωση), και η μέτρηση 0 πυροδοτήσεις σε 9.024 ώρες ηγέτη
// (scripts/measureSpikeWitnessStaleness.mjs). ΤΟ ΜΗΔΕΝ ΜΕΤΡΗΘΗΚΕ ΣΕ ΜΙΑ ΗΡΕΜΗ ΜΕΡΑ και δεν
// φράζει τίποτα για φουρτούνα — ξανατρέξε το σενάριο πριν μεγαλώσει άλλο αυτή η μνήμη.
const MARINE_TAIL_MODEL = 'models=meteofrance_wave';

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
// slip in beside a wave change. It exists now: `overWaterWindUrlBatch` below carries the sea
// cell for direction (20/08/2026) and speed (25/08/2026), for the beaches whose land cell is
// ≥3 km away — measured, gated in data, and merged per hour in utils/overWaterWind.
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
const marineTailOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo-marine-tail`;
  if (IS_DEV) return MARINE_HOST;
  throw new Error('Forecast unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};
const seaTemperatureOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo-marine-sst`;
  if (IS_DEV) return MARINE_HOST;
  throw new Error('Forecast unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};
const overWaterWindOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo-wind-sea`;
  if (IS_DEV) return FORECAST_HOST;
  throw new Error('Forecast unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};
const airQualityOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo-air-quality`;
  if (IS_DEV) return AIR_QUALITY_HOST;
  throw new Error('Forecast unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};

export const openMeteoProvider: ForecastProvider = {
  id: 'open-meteo',

  // NO `current=` URL any more (14/08/2026). Open-Meteo floors every request at one full
  // API call — six variables cost the same as sixty — and all six fields that block carried
  // are already in the hourly response for the same coordinate. weatherService derives "now"
  // from the hour we are inside instead, which also stops the headline and the verdict beside
  // it from sampling the model at two different instants. See fetchWeatherData there.

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

  // Η ουρά του κύματος (μέρες 4-6) και ο μάρτυρας κορυφών. Ίδιος host, ίδιο path, ίδιο
  // `cell_selection=sea` και ΙΔΙΕΣ μέρες με την κλήση κύματος — αλλιώς οι δύο σειρές δεν
  // καλύπτουν τις ίδιες ώρες και η ένωση θα άφηνε τρύπες. Διαφέρουν μόνο το μοντέλο και η μνήμη.
  marineTailForecastUrl(lat, lon) {
    return `${marineTailOrigin()}/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${MARINE_HOURLY}&timezone=auto&forecast_days=6&${SEA_CELL}&${MARINE_TAIL_MODEL}`;
  },

  marineTailForecastUrlBatch(points) {
    const lats = points.map(p => p.lat).join(',');
    const lons = points.map(p => p.lon).join(',');
    return `${marineTailOrigin()}/v1/marine?latitude=${lats}&longitude=${lons}&hourly=${MARINE_HOURLY}&timezone=Europe%2FAthens&forecast_days=6&${SEA_CELL}&${MARINE_TAIL_MODEL}`;
  },

  // Water temperature, single point and batched. Same host, same path, same
  // `cell_selection=sea` walk to real water as the wave call — only the model list and the
  // cache lifetime differ. `forecast_days=6` matches the wave route so the two series cover
  // the same days and merge hour-for-hour.
  seaTemperatureUrl(lat, lon) {
    return `${seaTemperatureOrigin()}/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${SEA_TEMPERATURE_HOURLY}&timezone=auto&forecast_days=6&${SEA_CELL}&${SEA_TEMPERATURE_MODEL}`;
  },

  seaTemperatureUrlBatch(points) {
    const lats = points.map(p => p.lat).join(',');
    const lons = points.map(p => p.lon).join(',');
    return `${seaTemperatureOrigin()}/v1/marine?latitude=${lats}&longitude=${lons}&hourly=${SEA_TEMPERATURE_HOURLY}&timezone=Europe%2FAthens&forecast_days=6&${SEA_CELL}&${SEA_TEMPERATURE_MODEL}`;
  },

  // THE ONLY PLACE IN THE APP WHERE A *FORECAST* URL CARRIES `cell_selection=sea`.
  //
  // It is safe here and nowhere else because this route asks for WIND ONLY. The two URLs above
  // also carry `temperature_2m`, so putting the sea cell on them would quietly print sea-cell
  // air temperature on a July afternoon. Only beaches with a baked `seaWindCell` (land cell
  // ≥3 km away, data/forecast-sea-cells.generated.json) ever ask this route.
  //
  //   wind_direction_10m — PORISMA §Γ29/§Γ37β (20/08/2026): the sea cell reads the right 45°
  //                        sector 1,4-1,5× more often than a land cell sitting ≥3 km away.
  //   wind_speed_10m     — §Γ51/§Γ52 + reports/weather/sea-cell-production-21d.json, decision
  //                        Miltos 25/08/2026: in that same population the sea cell's SPEED is
  //                        also the better number (3-5 km: error 4,73→4,66 km/h, exact Beaufort
  //                        43,5→44,9%, false calm 28,9→20,8%, both windows). Under 3 km the land
  //                        cell wins and those beaches never reach this route.
  //   wind_gusts_10m     — fetched ONLY to drive the sea door of utils/windGustFloor at parse
  //                        time (the leg that won §Γ52). It never replaces the land gust: the
  //                        five gust-spread thresholds were calibrated on the land feed.
  //   wind_speed_unit=ms — this response is merged into a pipeline that runs in m/s
  //                        (services/weatherService parses it with applyGustFloor(…, 'ms')).
  //                        Omit it and Open-Meteo answers km/h: a ×3,6 error on every hour.
  //
  // Cost: unchanged. Open-Meteo's billing weight floors at 10 variables (see
  // netlify/functions/forecast.mjs weightPerPoint), so three fields cost exactly what one did,
  // and the request count, batching and CDN lifetime are untouched.
  //
  // `forecast_days=6` matches the weather route so the two series cover the same days and the
  // wind can be merged into them hour-for-hour, by dt_txt and never by index.
  overWaterWindUrlBatch(points) {
    const lats = points.map(p => p.lat).join(',');
    const lons = points.map(p => p.lon).join(',');
    return `${overWaterWindOrigin()}/v1/forecast?latitude=${lats}&longitude=${lons}`
      + `&hourly=wind_direction_10m,wind_speed_10m,wind_gusts_10m&wind_speed_unit=ms&forecast_days=6&timezone=Europe%2FAthens&${SEA_CELL}`;
  },

  dustForecastUrl(lat, lon) {
    return `${airQualityOrigin()}/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=dust&timezone=Europe%2FAthens&forecast_days=2`;
  },
};
