// ─────────────────────────────────────────────────────────────────────────────
// EDGE-CACHED FORECAST PROXY — the capacity fix (see reports/capacity/capacity-model.md)
//
// WHY: forecasts are fetched client-side and cached per-device, so N users viewing
// the same beach make N calls to Open-Meteo. That makes upstream load scale with
// AUDIENCE SIZE and puts the app's ceiling at Open-Meteo's free quota (~10k/day,
// ~600/min). This proxy sits in front of Open-Meteo and sets CDN cache headers, so
// Netlify's edge serves ONE cached forecast to every user for the TTL. Upstream
// (and function-invocation) load then scales with DISTINCT BEACHES, not users —
// decoupling capacity from how many people show up.
//
// It is dormant until VITE_FORECAST_PROXY_BASE="/api/forecast" is set: the client's
// ForecastProvider then targets `/api/forecast/open-meteo/...`, which netlify.toml
// rewrites to this function. Unset → the client calls Open-Meteo directly (today's
// behaviour), so shipping this changes nothing until the flag is flipped.
//
// SECURITY: this is a STRICT allow-list proxy, never an open relay. Only the two
// Open-Meteo hosts, only /v1/forecast and /v1/marine, and only a fixed set of query
// params with sanitised values are ever forwarded. Anything else → 400.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';
import {
  recordCalls, recordRateLimited, formatCapacityAlert, utcDayKey, DEFAULT_THRESHOLDS,
} from './lib/capacityAlarm.mjs';

const UPSTREAMS = {
  'open-meteo': { host: 'https://api.open-meteo.com', paths: new Set(['/v1/forecast']) },
  'open-meteo-marine': { host: 'https://marine-api.open-meteo.com', paths: new Set(['/v1/marine']) },
};

// Marine model pin (see services/forecast/openMeteoProvider.ts for the full reasoning and
// the measurements behind it). `models` is deliberately NOT in ALLOWED_PARAMS below, so
// buildSafeQuery() can never carry a client-supplied value through — this constant is the
// only way `models` ever reaches the marine upstream. Injected unconditionally on the marine
// route only, after the safe query is built, so it can't be overridden and never touches the
// weather route.
//
// All three are required:
//   ewam (DWD, 0.05°)     — the preferred wave source from 2026-07-31. Measured against 9,723
//                           QC-good hourly observations from three Greek buoys it beats
//                           meteofrance_wave on bias (+1.7% vs -8.2%) and RMSE (0.184 vs 0.203),
//                           with a third of its dangerous underestimates (62 vs 204).
//   meteofrance_wave      — fallback: ewam runs ~82 h ahead, so days 4-6 need this, as do the
//                           inner-gulf cells ewam's grid does not resolve.
//   meteofrance_currents  — sea_surface_temperature only. Pinning the wave model alone once
//                           silently removed the water-temperature reading from every
//                           beach-detail page; this model is the only one that carries it.
//
// THIS CONSTANT IS THE ONE THAT SHIPS. The client has its own copy in
// services/forecast/openMeteoProvider.ts, but production traffic goes through this proxy and
// this value overwrites whatever the client asked for — so changing only the client changes
// nothing for users. scripts/validateMarineModelParsing.mjs fails the build when the two
// disagree, which is exactly how this line was caught on 2026-07-31.
//
// NOTE for anyone changing this: asking Open-Meteo for more than one model renames every
// field in the response to `<field>_<model>` (e.g. wave_height_meteofrance_wave). The parser
// in services/weatherService.ts reads those suffixed names, falling back to the bare ones.
// Going back to a single model here is therefore safe, but adding/renaming a model without
// updating that parser is not.
const MARINE_MODEL = 'ewam,meteofrance_wave,meteofrance_currents';

// --- CORS for the mobile app only (see services/forecast/openMeteoProvider.ts) -------
// The web app calls this same-origin (relative /api/forecast/...), which needs no CORS
// headers at all. The Capacitor app calls it cross-origin, from its own webview origin —
// https://localhost on Android, capacitor://localhost on iOS (capacitor.config.ts sets
// no server.androidScheme/iosScheme override, so these are Capacitor's own defaults).
// Exactly those two origins, nothing else — this is the same allow-list discipline as
// ALLOWED_PARAMS below, applied to Origin instead of query params.
const ALLOWED_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

/**
 * CORS headers for one response. Only an approved Origin gets Access-Control-Allow-Origin
 * (anyone else's browser/webview then refuses to expose the response to their JS, same as
 * today). Vary: Origin is set on every response regardless, so the shared CDN cache never
 * serves one Origin's cached response to another — Netlify's docs confirm the standard
 * Vary header (Origin isn't on their restricted-header list) is factored into the CDN
 * cache key, so this is safe with the existing Netlify-CDN-Cache-Control on the 200 path.
 */
const corsHeadersFor = (origin) => (
  origin && ALLOWED_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' }
);

// --- Capacity metering (see reports/capacity/capacity-model.md) --------------
// This function is the choke point for REAL upstream calls (CDN-cached hits never
// reach it), so it is the exact meter of our Open-Meteo usage. Everything here is
// best-effort and fully guarded — metering/alarms must NEVER break or slow a forecast.
const CAPACITY_STORE = 'capacity';
const CAPACITY_KEY = 'open-meteo-day';

const capacityThresholds = () => ({
  amber: Number(process.env.CAPACITY_AMBER) || DEFAULT_THRESHOLDS.amber,
  red: Number(process.env.CAPACITY_RED) || DEFAULT_THRESHOLDS.red,
});

const sendTelegram = async (text) => {
  const botToken = process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch { /* alarm delivery is best-effort */ }
};

/**
 * Meter one real upstream call (rateLimited=true records a 429 instead). Never throws.
 *
 * `points` is how many coordinates that single request carried, and charging it is
 * the whole point. We used to add 1 per request no matter what, while the landing
 * page's national strip sends 13 coordinates in one call and a batched region view
 * sends up to 32. The counter was therefore optimistic by up to 32×, which is
 * exactly the wrong direction for a number whose only job is to warn us early.
 * The provider's limits are what this is compared against, and it prices work, not
 * HTTP requests.
 */
const meterUpstream = async ({ rateLimited, points = 1 }) => {
  try {
    const store = getStore(CAPACITY_STORE);
    const prev = await store.get(CAPACITY_KEY, { type: 'json' });
    const dayKey = utcDayKey(new Date());
    const th = capacityThresholds();

    let alert = null;
    let state;
    if (rateLimited) {
      const r = recordRateLimited(prev, dayKey, points);
      state = r.next;
      if (r.fire) alert = formatCapacityAlert('rate_limited', state.count, th);
    } else {
      const r = recordCalls(prev, dayKey, points, th);
      state = r.next;
      if (r.crossed) alert = formatCapacityAlert(r.crossed, state.count, th);
    }

    await store.setJSON(CAPACITY_KEY, state);
    if (alert) await sendTelegram(alert);
  } catch {
    // Metering/alarm failures must never affect the forecast response.
  }
};

// ── Per-IP burst net ─────────────────────────────────────────────────────────
//
// LAST line of defence, not the first. The first is that the app now batches its
// coordinates: a region view fell from ~71 requests to a handful, which is what
// actually keeps us under Open-Meteo's ~600/minute ceiling.
//
// The order matters, and getting it backwards would have been the bug. Before
// batching, a perfectly legitimate Evia visitor fired ~71 requests in one burst —
// any limit tight enough to stop abuse would have blocked that real visitor and
// blanked their map. With batching in place a heavy view costs a handful of
// requests, so a limit can sit far above normal use and still catch a script.
//
// Held in module scope, so it lives as long as the warm container and is per
// container, not global. Best-effort by design: a distributed flood walks past it,
// and the answer to that is a Cloudflare rule, not more code here.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60; // ~10 heavy region views a minute from one IP
const recentByIp = new Map();

const clientIp = (event) => (
  event.headers?.['x-nf-client-connection-ip'] ||
  event.headers?.['x-forwarded-for'] ||
  ''
).split(',')[0].trim();

const isRateLimited = (event) => {
  const ip = clientIp(event);
  if (!ip) return false;

  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter(at => now - at < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);

  if (recentByIp.size > 1000) {
    for (const [key, times] of recentByIp) {
      if (!times.some(at => now - at < RATE_LIMIT_WINDOW_MS)) recentByIp.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX_REQUESTS;
};

// Only these params are forwarded. Values are re-validated below, never passed raw.
const ALLOWED_PARAMS = new Set([
  'latitude', 'longitude', 'hourly', 'current',
  'wind_speed_unit', 'timezone', 'forecast_days', 'cell_selection',
]);

// hourly/current are comma-lists of field names; keep them to a safe charset.
const SAFE_LIST = /^[a-z0-9_,]+$/;
const SAFE_TOKEN = /^[a-z0-9_/+-]+$/i;
const SAFE_COORDINATE = /^-?\d+(\.\d+)?$/;
const MAX_COORDINATE_LIST_ITEMS = 32;

const UPSTREAM_TIMEOUT_MS = 8000;
const PREFIX = '/api/forecast/';

/**
 * How long the shared CDN may serve one upstream answer. Split by route on 2026-07-31,
 * because the two carry data with completely different shelf lives:
 *
 *   wind/weather — 60 min, raised from 30 on 2026-08-02 under live traffic pressure. It
 *                  matches the upstream refresh cadence: Open-Meteo republishes the hourly
 *                  forecast once an hour, so asking twice an hour fetched the SAME numbers
 *                  half the time and was charged in full. This still has to stay bounded,
 *                  because hooks/useWeather derives forecast freshness from the HOURLY
 *                  forecast's fetch time (useWeather.ts, setForecastFetchedAt) and blanks
 *                  colours/verdicts past 3 h (SOFT_STALE_LIMIT_MS) — see below for why the
 *                  worst-case age did NOT move.
 *
 *   marine       — 3 h. Both pinned wave models publish a new run every 12 HOURS
 *                  (Open-Meteo's own model table, verified 2026-07-31 for ewam and
 *                  meteofrance_wave alike). Re-asking every 30 min fetched the identical
 *                  numbers ~24 times per run: it bought nothing and was charged in full.
 *
 * Safe because marine freshness drives nothing: the cluster path says so in as many words
 * ("Wind drives the safety-critical colours, so the cluster's freshness follows its
 * hourly-forecast fetch time (marine is supplementary)"), and the region path sets
 * forecastFetchedAt from the hourly result, never the marine one. Verified before shipping.
 *
 * This is what pays for the third wave model. Per point per day, marine weight:
 *   2 models @ 30 min  →  48 refreshes x 1.4  =  67
 *   3 models @ 30 min  →  48 refreshes x 2.1  = 101
 *   3 models @ 3 h     →   8 refreshes x 2.1  =  17     ← 4x cheaper than before the change
 *
 * stale-while-revalidate DROPPED from 1 h to 30 min on 2026-08-02, and that halving is what
 * makes the weather change free of any user-visible cost. The two numbers add up: worst-case
 * age of what a visitor sees is s-maxage + swr.
 *
 *   weather before  1800 + 3600 = 90 min worst case,  48 upstream refreshes/point/day
 *   weather after   3600 + 1800 = 90 min worst case,  24 upstream refreshes/point/day
 *
 * Same ceiling, half the upstream load. Nobody sees older data than they did yesterday, and
 * the 90-min worst case still sits inside the 3 h hard cutoff with an hour to spare. A user
 * still never waits on a refresh — 30 min of stale-serving is far longer than a refresh takes;
 * the window only has to outlast the fetch, not the cache period.
 *
 * Marine is untouched at 3 h and unaffected by the shorter swr (3 h 30 worst case, and marine
 * freshness drives nothing, per the paragraph above).
 */
const CDN_MAX_AGE_S = { weather: 3600, marine: 10800 };
const CDN_STALE_WHILE_REVALIDATE_S = 1800;

const cdnCacheControl = (providerKey) => {
  const maxAge = providerKey === 'open-meteo-marine' ? CDN_MAX_AGE_S.marine : CDN_MAX_AGE_S.weather;
  return `public, s-maxage=${maxAge}, stale-while-revalidate=${CDN_STALE_WHILE_REVALIDATE_S}`;
};

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  body: JSON.stringify(body),
});

/** Validate + rebuild the query string from scratch — nothing raw reaches upstream. */
function parseCoordinateList(value, min, max) {
  if (typeof value !== 'string') return null;
  const parts = value.split(',');
  if (parts.length === 0 || parts.length > MAX_COORDINATE_LIST_ITEMS) return null;

  const values = [];
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!SAFE_COORDINATE.test(part)) return null;
    const numeric = Number(part);
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
    values.push(String(numeric));
  }

  return { value: values.join(','), count: values.length };
}

function buildSafeQuery(params) {
  const out = new URLSearchParams();

  const lat = parseCoordinateList(params.latitude, -90, 90);
  const lon = parseCoordinateList(params.longitude, -180, 180);
  if (!lat || !lon || lat.count !== lon.count) return null;
  out.set('latitude', lat.value);
  out.set('longitude', lon.value);

  for (const [key, value] of Object.entries(params)) {
    if (key === 'latitude' || key === 'longitude') continue;
    if (!ALLOWED_PARAMS.has(key)) continue;
    if (typeof value !== 'string') continue;

    if (key === 'hourly' || key === 'current') {
      if (!SAFE_LIST.test(value) || value.length > 300) return null;
    } else if (key === 'forecast_days') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 16) return null;
    } else if (!SAFE_TOKEN.test(value) || value.length > 40) {
      return null;
    }
    out.set(key, value);
  }
  return out;
}

export const handler = async (event) => {
  // MUST run before any getStore() below. This is a classic Lambda-signature
  // function, so the Blobs environment has to be wired from the event; without it
  // getStore() throws, meterUpstream()'s bare catch swallows the throw, and the
  // capacity counter silently records NOTHING — which is exactly what happened:
  // on 2026-07-27 the `capacity` store was found completely empty in production
  // despite a verified upstream miss minutes earlier, so the 5k/7k Telegram alarm
  // had never been armed and the first warning of trouble would have been a live
  // 429 from Open-Meteo. netlify/functions/pageview.mjs already carries this call
  // and the comment explaining it; forecast.mjs was simply missing it.
  //
  // Guarded because metering must never break or slow a forecast (same rule as
  // meterUpstream itself): if wiring fails we lose the counter, not the response.
  try { connectLambda(event); } catch { /* metering is best-effort */ }

  // Netlify normalises event.headers keys to lowercase, but this is cheap insurance.
  const origin = event.headers?.origin || event.headers?.Origin || null;
  const cors = corsHeadersFor(origin);

  if (event.httpMethod === 'OPTIONS') {
    // Not actually required for the app's plain GET (a "simple" CORS request, no
    // preflight triggered), but this handler already existed — making it CORS-correct
    // is the minimal completion, and Max-Age just avoids repeat preflights if a
    // future header/webview quirk ever does trigger one.
    return {
      statusCode: 204,
      headers: { Allow: 'GET, OPTIONS', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '600', ...cors },
      body: '',
    };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' }, cors);
  }

  // Refuse before touching upstream: the point is to protect the shared quota, so a
  // blocked request must not cost an Open-Meteo call. Retry-After is honest about
  // the window rather than leaving a client to hammer.
  if (isRateLimited(event)) {
    return json(429, { error: 'Too many forecast requests. Try again shortly.' }, {
      ...cors,
      'Retry-After': '60',
    });
  }

  // event.path is the original request path, e.g. /api/forecast/open-meteo/v1/forecast
  const path = event.path || '';
  const idx = path.indexOf(PREFIX);
  if (idx === -1) return json(400, { error: 'Bad proxy path.' }, cors);

  const rest = path.slice(idx + PREFIX.length); // e.g. "open-meteo/v1/forecast"
  const slash = rest.indexOf('/');
  if (slash === -1) return json(400, { error: 'Missing upstream segment.' }, cors);

  const providerKey = rest.slice(0, slash);
  const upstreamPath = rest.slice(slash); // includes leading "/", e.g. "/v1/forecast"

  const upstream = UPSTREAMS[providerKey];
  if (!upstream) return json(400, { error: 'Unknown forecast provider.' }, cors);
  if (!upstream.paths.has(upstreamPath)) return json(400, { error: 'Disallowed upstream path.' }, cors);

  const query = buildSafeQuery(event.queryStringParameters || {});
  if (!query) return json(400, { error: 'Invalid or disallowed query parameters.' }, cors);

  // How many coordinates this one request carries. buildSafeQuery has already
  // validated the list and guaranteed latitude/longitude have equal length.
  const pointCount = (query.get('latitude') || '').split(',').length;

  // Enforce the marine model pin server-side, unconditionally. `models` was already
  // dropped by buildSafeQuery() if the client sent one (not in ALLOWED_PARAMS), so this
  // is a plain set, never an override of anything a caller could have supplied.
  if (providerKey === 'open-meteo-marine') query.set('models', MARINE_MODEL);

  const target = `${upstream.host}${upstreamPath}?${query.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstreamResponse = await fetch(target, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!upstreamResponse.ok) {
      // 429 = upstream refused us → the definitive capacity alarm.
      if (upstreamResponse.status === 429) await meterUpstream({ rateLimited: true, points: pointCount });
      // Do NOT cache upstream failures — let clients retry / fall back to their cache.
      return json(502, { error: `Upstream ${upstreamResponse.status}` }, cors);
    }

    // A real upstream success (this ran only because the CDN cache missed) → meter it.
    await meterUpstream({ rateLimited: false, points: pointCount });

    const payload = await upstreamResponse.text(); // pass through verbatim (already JSON)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Browser revalidates cheaply; the shared win is at the CDN layer below.
        'Cache-Control': 'public, max-age=0, must-revalidate',
        // Netlify CDN serves this cached response to EVERY user, then serves stale while it
        // refreshes once in the background. This is what collapses N user-calls into ~1
        // upstream call per point. Vary: Origin (in `cors`) keeps that shared cache correctly
        // partitioned per Origin — confirmed against Netlify's own docs: standard Vary IS
        // factored into their CDN cache key, Origin isn't on their restricted-header list, so
        // an approved mobile origin's ACAO-bearing response is never served back to a
        // different caller, and vice versa.
        'Netlify-CDN-Cache-Control': cdnCacheControl(providerKey),
        ...cors,
      },
      body: payload,
    };
  } catch (error) {
    return json(504, { error: 'Upstream timeout or network error.' }, cors);
  } finally {
    clearTimeout(timeout);
  }
};
