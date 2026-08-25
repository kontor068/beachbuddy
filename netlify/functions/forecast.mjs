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

import { createHash } from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';
import {
  recordCalls, recordRateLimited, formatCapacityAlert, utcDayKey, DEFAULT_THRESHOLDS,
} from './lib/capacityAlarm.mjs';

// Each provider has two hosts: the free one, and Open-Meteo's reserved "customer-"
// host for paying accounts. Which one is used is decided per request by whether a key
// is configured (see apiKey() below) — never by the caller.
const UPSTREAMS = {
  'open-meteo': {
    host: 'https://api.open-meteo.com',
    customerHost: 'https://customer-api.open-meteo.com',
    paths: new Set(['/v1/forecast']),
  },
  'open-meteo-marine': {
    host: 'https://marine-api.open-meteo.com',
    customerHost: 'https://customer-marine-api.open-meteo.com',
    paths: new Set(['/v1/marine']),
  },
  // Water temperature, split off the wave route on 14/08/2026. Same upstream host and path —
  // it is a separate ROUTE here only so it can carry its own model pin and its own cache
  // lifetime (12 h against the wave route's 3 h). See SEA_TEMPERATURE_MODEL below.
  'open-meteo-marine-sst': {
    host: 'https://marine-api.open-meteo.com',
    customerHost: 'https://customer-marine-api.open-meteo.com',
    paths: new Set(['/v1/marine']),
  },
  // The wave TAIL (days 4-6) and the spike witness, split off the wave route on 20/08/2026 —
  // PORISMA §Γ43. Same upstream host and path as `open-meteo-marine`; a separate ROUTE only so
  // it can carry its own model pin and its own cache lifetime (12 h against the wave route's
  // 3 h). See MARINE_TAIL_MODEL below for why this model tolerates that and `ewam` does not.
  'open-meteo-marine-tail': {
    host: 'https://marine-api.open-meteo.com',
    customerHost: 'https://customer-marine-api.open-meteo.com',
    paths: new Set(['/v1/marine']),
  },
  // Wind over the water — DIRECTION (added 20/08/2026 — PORISMA §Γ29/§Γ37β) and SPEED (added
  // 25/08/2026 — §Γ51/§Γ52, beaches whose land cell sits ≥3 km away). Same upstream host and
  // path as `open-meteo`; it is a separate ROUTE here so that `cell_selection=sea` reaches ONLY
  // this one. The weather route must never carry it: those URLs also carry temperature_2m.
  // Cache lifetime deliberately NOT overridden — it falls through to CDN_MAX_AGE_S.weather
  // (60 min), the same upstream refresh cadence the wind follows. Billing weight is unchanged by
  // the extra fields (weightPerPoint floors at 10 variables).
  'open-meteo-wind-sea': {
    host: 'https://api.open-meteo.com',
    customerHost: 'https://customer-api.open-meteo.com',
    paths: new Set(['/v1/forecast']),
  },
  // Saharan-dust route (added 09/08/2026, the day the paid plan made it affordable).
  // Same strict allow-list discipline: only /v1/air-quality, only the shared
  // ALLOWED_PARAMS — the client asks for `hourly=dust` and nothing else.
  'open-meteo-air-quality': {
    host: 'https://air-quality-api.open-meteo.com',
    customerHost: 'https://customer-air-quality-api.open-meteo.com',
    paths: new Set(['/v1/air-quality']),
  },
};

// ── Paid Open-Meteo key (server-side only) ───────────────────────────────────
//
// Set as a Netlify environment variable scoped to FUNCTIONS and marked secret. It must
// never become a VITE_* variable and must never be written into netlify.toml: the first
// is inlined into the public bundle, the second is committed to a public repository.
// This function is the only place it exists, which is the whole reason the edge proxy
// was built — the browser talks to /api/forecast on our own domain and never sees a key.
//
// ABSENT KEY IS A SUPPORTED STATE, and deliberately so: an expired, revoked or
// mistyped-away key drops us back to the free hosts and the site keeps working on the
// free quota instead of going dark. Read per request, not at module load, so a warm
// container picks up a rotated value on its next invocation.
//
// `apikey` is NOT in ALLOWED_PARAMS, so buildSafeQuery() has already dropped anything a
// caller tried to send under that name — same discipline as the `models` pin. The key is
// appended after the safe query is built, so it can neither be overridden nor echoed.
//
// ── Development deploys spend the FREE tier, not the package — 14/08/2026 ─────
//
// The free tier's ~10,000 calls/day sat completely unused while every preview and branch
// deploy — which is testing, not the product — billed the paid plan. `vite dev` and the
// analysis scripts already talked to the free hosts; previews were the one development
// surface that did not, because netlify.toml points them at this proxy exactly like
// production (deliberately: a preview must exercise the real path).
//
// OPEN_METEO_USE_FREE_TIER is set per deploy context in netlify.toml — on deploy-preview and
// branch-deploy, never on production. A flag we set ourselves rather than Netlify's own
// CONTEXT variable, because this one is guaranteed present at function runtime and says what
// it means at the point someone reads it.
//
// WHERE THE LINE IS, and it is not arbitrary: the free tier is licensed for non-commercial
// use. A preview of a branch is development. calmbeach.gr is the commercial product, and
// routing ITS traffic here — including our own browsing of it — would be the violation the
// subscription was bought to end. Production must never set this flag.
//
// It also makes the cheaper habit the easy one: testing on a preview costs neither the
// package nor a production deploy's Netlify credits.
//
// NOTE: previews and branch deploys are currently switched OFF at the Netlify dashboard and
// cancelled by the `ignore` command in netlify.toml, so this is armed rather than active.
// Turning them back on is now the cheap option instead of the expensive one.
const usingFreeTier = () => process.env.OPEN_METEO_USE_FREE_TIER === '1';

const apiKey = () => (usingFreeTier() ? '' : process.env.OPEN_METEO_API_KEY || '');

// A rejected key looks exactly like any other upstream failure from the outside: we'd
// quietly serve the 12 h fallback and then blanks, with nothing in the alarms, because the
// capacity meter only fires on 429. Alerted once per container so a broken key surfaces in
// minutes without turning into a Telegram flood.
let authAlertSent = false;

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
//   meteofrance_wave      — fallback for the TAIL, and measured 20/08/2026 (PORISMA §Γ43) to be
//                           nothing else. Live sample of 153 points (96 national + all 57 that
//                           explicitly prefer this model): ewam returns a wave height for
//                           exactly 94 hours at EVERY point — min = median = max, no gaps — and
//                           is blind at 0 of the 153. So this model supplies precisely hours
//                           95-144, i.e. 34% of the 6 days we ask for, and nothing inside days
//                           1-4. The two claims this line used to carry are corrected: the
//                           horizon is 94 h, not ~82 h, and "inner-gulf cells ewam's grid does
//                           not resolve" did not reproduce anywhere. The 57 preferred points are
//                           NOT an availability problem — ewam answers there too; its cell just
//                           describes water the beach cannot see (utils/marineModelPreference).
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
const MARINE_MODEL = 'ewam';

// The TAIL pin, split off the wave route on 20/08/2026 (PORISMA §Γ43). Same upstream, same six
// fields, its own route — for one reason only: **its own cache lifetime**.
//
// WHY THE SPLIT SAVES NOTHING BY ITSELF. The provider prices work, not HTTP requests:
// two requests of one model each weigh exactly the same as one request of two models (1,0 + 1,0
// = 2,0). Splitting is cost-NEUTRAL. The saving is entirely in `CDN_MAX_AGE_S.marineTail` below.
//
// WHY THIS MODEL TOLERATES A LONGER LIFETIME AND `ewam` DOES NOT. Measured 20/08/2026 over 153
// points: `ewam` reports a wave height for exactly 94 hours everywhere, so this model supplies
// hours 95-144 — days 4 to 6. Nobody plans an afternoon swim off day 5, and both models publish
// only every 12 h anyway, so re-asking every 3 h re-bought an identical series ~4× per run.
//
// ⚠️ THIS MODEL HAS A SECOND JOB AND IT IS THE REASON IT WAS NOT SIMPLY DELETED.
// utils/marineForecastParsing uses it as the WITNESS of `uncorroboratedSpikeHours`: when ewam
// reports a jump >1 m/h reaching ≥1 m and this model does not see half of it, that hour falls to
// the witness's lower value. So the witness SUPPRESSES wave height, which means a stale witness
// suppresses a rising sea — the one direction this project never accepts. Two things bound that:
// the guard fired 0 times in 9.024 lead-hours when measured (scripts/measureSpikeWitnessStaleness.mjs,
// report reports/quality/spike-witness-staleness.json), and the parser's own rule is «no witness
// => no accusation», so absence is already the safe case.
//
// ✅ THE "ONE CALM DAY" CAVEAT IS RETIRED (21/08/2026). This comment used to end «the zero was
// measured on ONE calm day and bounds nothing about a storm», which was true and unfixable until
// the Professional plan opened the forecast archive. The same script now replays past days via
// scripts/lib/replayOpenMeteo.mjs: four days, one per year 2022-2025, two of them peaking at 7 Bft
// nationally (2022-09-06, 2024-06-29), 48 beaches each. 18.048 lead-hours + 9.600 tail-hours,
// **0 firings everywhere**. Reports in reports/replay/spike-witness-<date>.json.
// Pick replacement days with `npm run replay:wind-windows` rather than by eye.
const MARINE_TAIL_MODEL = 'meteofrance_wave';

// The water-temperature pin, on its own route since 14/08/2026 (see UPSTREAMS above and
// services/forecast/openMeteoProvider.ts for the full reasoning).
//
// WHY IT LEFT THE WAVE CALL: Open-Meteo counts MODELS as their own multiplier — three models
// is three full API calls per coordinate. `meteofrance_currents` was in the wave list to carry
// exactly one field, so a number that moves half a degree a day was buying a third of the
// national marine bill (~20,000 calls/day against a 33,000/day budget).
//
// Same discipline as MARINE_MODEL: `models` is not in ALLOWED_PARAMS, so this constant is the
// only way a model reaches this route, and it is set after the safe query is built.
const SEA_TEMPERATURE_MODEL = 'meteofrance_currents';

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
 *
 * `weight` closes the second known undercount (docs/team/17 §7): Open-Meteo's own
 * rule prices a request at more than one call once it carries >10 variables, and
 * the marine route asks for 7 fields × 3 models = 21 → ~2.1 calls per point. The
 * meter used to charge marine points 1.0, so the number the alarm compared against
 * the provider's quota was systematically low exactly where the bill is highest.
 * Weather routes stay at 1.0 (8 hourly fields — under the threshold).
 */
// ── Weight per location — the provider's OWN rule, verbatim — 14/08/2026 ───────
//
// From Open-Meteo's "How Is One API Call Defined?" panel (their dashboard, read 14/08/2026):
//
//     "Requests for data covering more than 10 weather variables or extending over a period
//      of more than 2 weeks for a single location are considered multiple API calls."
//     Weighting factors: Weather variables · Time range · Models · Number of locations.
//     Their calculator: 10 variables, 14 days, 1 model, 1 location -> 1.0 API calls.
//
//     weight = max(1, vars/10) x max(1, days/14) x models x locations
//
// TWO THINGS THIS SPELLS OUT that guesswork had wrong, both in the expensive direction:
//
//   1. THE FACTORS ARE FLOORED. "MORE than 10 variables", "MORE than 2 weeks" — under those
//      lines you pay a full standard call and get no discount. So our 6-7 day, 7-8 variable
//      requests cost 1.0, not the 0.40/0.90 an earlier reading of their blog suggested. There
//      is also a corollary worth remembering: variables 9 and 10 are FREE. Adding a field to
//      a request that asks for 8 costs nothing at all.
//
//   2. MODELS ARE THEIR OWN MULTIPLIER, not extra variables. This is the one that matters.
//      Marine asks 7 fields from 3 models: not 21 variables (2.1), but 7 variables x 3 models
//      = 3.0 per point. Every additional model is a FULL extra call per point no matter how
//      little you ask of it — and `meteofrance_currents` is in that list to carry exactly one
//      field, sea_surface_temperature. A third of the marine bill buys one number that moves
//      half a degree a day. See docs/team/17 §12 for the ranked fix.
//
// Computed from the OUTGOING QUERY, never from hand-written constants — those had already
// drifted from the request they described twice (docs/team/17 §7, §12), which is how a 43%
// undercount on the single most expensive route survived this long.
//
// NEVER OPTIMISTIC, the original design rule: a missing forecast_days is charged at
// Open-Meteo's 7-day default rather than assumed small.
const OPEN_METEO_DEFAULT_FORECAST_DAYS = 7;
const WEIGHT_DAYS_UNIT = 14;
const WEIGHT_VARIABLES_UNIT = 10;

const countList = (value) => (value ? value.split(',').filter(Boolean).length : 0);

/** Billed weight of ONE location for this exact query, per the rule quoted above. */
const weightPerPoint = (query) => {
  // `hourly` and `current` are both "weather variables"; the model list multiplies whatever
  // that count comes to. One model (or none named) is the plain case.
  const variables = countList(query.get('hourly')) + countList(query.get('current'));
  if (!variables) return 0;
  const models = Math.max(1, countList(query.get('models')));
  const days = Number(query.get('forecast_days')) || OPEN_METEO_DEFAULT_FORECAST_DAYS;
  return Math.max(1, variables / WEIGHT_VARIABLES_UNIT)
    * Math.max(1, days / WEIGHT_DAYS_UNIT)
    * models;
};

// Read-modify-write on ONE blob is a lost-update race, and it was not theoretical: on
// 14/08/2026 the provider's dashboard reported ~94k calls/day while this counter, which sees
// every one of them, recorded ~37.7k. Simultaneous cache-misses each read the same `count`
// and each wrote back their own +1, so all but the last increment vanished — and the busier
// the day, the more it lost, which is precisely backwards for a capacity alarm.
//
// Compare-and-swap closes it: re-read, recompute, and only store if the blob has not moved
// since (`onlyIfMatch` / `onlyIfNew`, @netlify/blobs ≥ 10.7). A loser retries against the
// winner's value instead of overwriting it.
//
// Bounded at four attempts on purpose. This runs on the response path, so a livelock under a
// burst would cost every visitor latency to protect a number — the wrong trade. Four attempts
// removes the ordinary collision; the pathological case degrades to what we had before (a
// dropped increment) rather than to a slow forecast.
const METER_CAS_ATTEMPTS = 4;

const meterUpstream = async ({ rateLimited, points = 1 }) => {
  // A free-tier call does not touch the package, so counting it would inflate the one number
  // the monthly alarm is compared against. Blobs are shared across deploy contexts (that is how
  // preview traffic once polluted this counter), so the skip has to be here rather than assumed.
  if (usingFreeTier()) return;
  try {
    const store = getStore(CAPACITY_STORE);
    const th = capacityThresholds();
    let alert = null;

    for (let attempt = 0; attempt < METER_CAS_ATTEMPTS; attempt++) {
      // Re-read inside the loop: the whole point is to build on whatever landed meanwhile.
      const held = await store.getWithMetadata(CAPACITY_KEY, { type: 'json' });
      const prev = held?.data ?? null;
      const dayKey = utcDayKey(new Date());

      // Recomputed per attempt — the alert flags live in the state we just re-read, so a
      // retry must not carry the previous attempt's verdict. Without this reset a losing
      // attempt could fire a Telegram alert for a threshold the winner had already crossed.
      alert = null;
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

      const written = await store.setJSON(
        CAPACITY_KEY,
        state,
        held?.etag ? { onlyIfMatch: held.etag } : { onlyIfNew: true },
      );
      // `modified: false` means someone else wrote first — drop this attempt's alert and
      // fold our points into their state on the next pass.
      if (written?.modified !== false) break;
      alert = null;
    }

    if (alert) await sendTelegram(alert);
  } catch {
    // Metering/alarm failures must never affect the forecast response.
  }
};

// ── Last-good forecast, kept on the SERVER ───────────────────────────────────
//
// WHY THIS EXISTS: the client already survives a provider outage — weatherService
// keeps every answer in the device's own cache and re-serves it, tagged with its real
// age, if a refresh fails. But that cache is PER DEVICE, so it protects yesterday's
// visitor and leaves the new one with an empty page: exactly the tourist who just
// arrived from Google, i.e. the one who matters. Nothing on the server remembered
// anything, so an exhausted daily quota meant "conditions unavailable" for everybody
// who had not been here before.
//
// So: every successful upstream answer is kept here, and when the provider refuses
// us (429) or breaks, we serve the last good one instead of an error. The point is
// stronger than "something rather than nothing" — an Open-Meteo answer is an HOURLY
// FORECAST, not a measurement. The response fetched at 09:00 already contains the
// model's prediction for 17:00 and for tomorrow. Re-serving it is not showing this
// morning's wind; it is showing what this morning's model run said about right now,
// which is still good guidance.
//
// TWO RULES MAKE IT SAFE, and both are load-bearing:
//
//   1. It travels with its real age (X-Forecast-Age-Seconds). The client sets
//      fetchedAt from that header, so the existing freshness gate keeps working:
//      the visitor sees the "βάσει πρόγνωσης HH:MM" stamp and the hard cutoff still
//      applies. Without this the client would time the age from when IT received the
//      bytes and present 8-hour-old data as live — worse than the blank page.
//   2. It is barely CDN-cached (5 min, not the usual 30/180). A rescued response
//      must not be pinned at the edge for an hour after the provider recovers. Five
//      minutes is still enough to stop a stampede from re-hitting a provider that is
//      already refusing us.
//
// The 12 h ceiling is a product decision (Miltos, 2026-08-02), not a technical one:
// beyond half a day a forecast run is too far from what the sea is doing to be worth
// showing at all, even labelled.
const FALLBACK_STORE = 'forecast-fallback';
const FALLBACK_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FALLBACK_CDN_MAX_AGE_S = 300;

/** Stable, filesystem-safe blob key for one exact upstream URL. */
const fallbackKeyFor = (target) => createHash('sha256').update(target).digest('hex').slice(0, 32);

/** Remember one good answer. Never throws — a storage failure must not cost a forecast. */
const rememberLastGood = async (key, body) => {
  try {
    await getStore(FALLBACK_STORE).setJSON(key, { at: Date.now(), body });
  } catch { /* best-effort */ }
};

/**
 * The freshest usable answer we still hold for this URL, or null.
 * Returns { body, ageSeconds }. Never throws.
 */
const readLastGood = async (key) => {
  try {
    const saved = await getStore(FALLBACK_STORE).get(key, { type: 'json' });
    if (!saved?.body || typeof saved.at !== 'number') return null;
    const ageMs = Date.now() - saved.at;
    if (ageMs < 0 || ageMs > FALLBACK_MAX_AGE_MS) return null;
    return { body: saved.body, ageSeconds: Math.round(ageMs / 1000) };
  } catch {
    return null;
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
 *                  colours/verdicts past 12 h (SOFT_STALE_LIMIT_MS) — see below for why the
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
 * the 90-min worst case sits far inside the 12 h hard cutoff. A user
 * still never waits on a refresh — 30 min of stale-serving is far longer than a refresh takes;
 * the window only has to outlast the fetch, not the cache period.
 *
 * Marine is untouched at 3 h and unaffected by the shorter swr (3 h 30 worst case, and marine
 * freshness drives nothing, per the paragraph above).
 */
// Air quality rides the marine TTL for the same reason marine got it: the CAMS model
// behind the dust field publishes a new run every 12 hours, so asking more often than
// every 3 h re-fetches identical numbers at full charge. Dust events build over many
// hours — 3 h staleness cannot misdirect anyone.
//
// `sst` — 12 h, and it is the longest TTL here by a wide margin (14/08/2026). Two reasons, and
// the second is the one that makes it safe rather than merely cheap:
//   1. meteofrance_currents publishes twice a day, so asking more often re-fetches identical
//      numbers at full charge — the same argument that took marine from 30 min to 3 h.
//   2. The response is an HOURLY series six days long, and utils/marineForecastParsing indexes
//      it BY TIME (dt_txt), not by position. A response fetched at 07:00 therefore still yields
//      19:00's own value at 19:00. Longer caching here does not age the number on the card; it
//      only stops us re-buying a series we already hold.
const CDN_MAX_AGE_S = { weather: 3600, marine: 10800, air: 10800, sst: 43200, marineTail: 43200 };
const CDN_STALE_WHILE_REVALIDATE_S = 1800;

/** The route's own s-maxage, in seconds. One definition, used by the header and by the store. */
const routeMaxAgeS = (providerKey) => (
  providerKey === 'open-meteo-marine' ? CDN_MAX_AGE_S.marine
    : providerKey === 'open-meteo-marine-sst' ? CDN_MAX_AGE_S.sst
      : providerKey === 'open-meteo-marine-tail' ? CDN_MAX_AGE_S.marineTail
      : providerKey === 'open-meteo-air-quality' ? CDN_MAX_AGE_S.air
        : CDN_MAX_AGE_S.weather
);

// `durable` — the single most expensive omission this file has had (found 14/08/2026).
//
// Without it, "the CDN caches it" was only ever true PER EDGE NODE. Netlify's default cache
// is local to the node that served the request: a visitor routed to Frankfurt and a visitor
// routed to Athens miss independently, invoke this function independently, and buy the SAME
// forecast from Open-Meteo twice. Googlebot's renderer (US nodes) makes it a third. So the
// real upstream load was `distinct points × refreshes × NODES`, not `distinct points ×
// refreshes` — the capacity model in reports/capacity/capacity-model.md and docs/team/17 §11.1
// silently assumed one shared cache and therefore under-counted by that node multiplier.
//
// The `durable` directive puts the response in Netlify's SHARED cache, which every edge node
// consults before invoking this function (docs.netlify.com → Caching → durable directive;
// supported for Netlify Functions, which this is — not for Edge Functions). The node
// multiplier collapses to 1.
//
// Measured evidence it was off: a live response carried
//   Cache-Status: "Netlify Durable"; fwd=bypass
//   Cache-Status: "Netlify Edge";    hit; ttl=3600
// i.e. the durable layer existed and was being skipped on every request.
//
// NOTHING ABOUT WHAT A VISITOR SEES CHANGES. Same s-maxage, same stale-while-revalidate, same
// worst-case age (90 min weather / 3 h 30 marine), same freshness stamp and same 12 h cutoff.
// This only stops us paying N times for one identical answer.
//
// Deliberately NOT applied to the rescue path below: a last-good answer served during an
// upstream failure must stay local and short-lived, never promoted into the shared cache.
const cdnCacheControl = (providerKey, remainingS) => {
  const maxAge = Math.max(0, Math.round(remainingS ?? routeMaxAgeS(providerKey)));
  return `public, durable, s-maxage=${maxAge}, stale-while-revalidate=${CDN_STALE_WHILE_REVALIDATE_S}`;
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

  // Enforce the marine model pin server-side, unconditionally. `models` was already
  // dropped by buildSafeQuery() if the client sent one (not in ALLOWED_PARAMS), so this
  // is a plain set, never an override of anything a caller could have supplied.
  //
  // MUST stay above the metering below: `models` multiplies the variable count, so
  // weighing the query before this line would under-charge every marine request.
  if (providerKey === 'open-meteo-marine') query.set('models', MARINE_MODEL);
  if (providerKey === 'open-meteo-marine-sst') query.set('models', SEA_TEMPERATURE_MODEL);
  if (providerKey === 'open-meteo-marine-tail') query.set('models', MARINE_TAIL_MODEL);

  // How many coordinates this one request carries. buildSafeQuery has already
  // validated the list and guaranteed latitude/longitude have equal length. Locations
  // are a plain multiplier in the provider's formula (see weightPerPoint), which is why
  // a 32-point batch must never be metered as one.
  const pointCount = (query.get('latitude') || '').split(',').length;
  // A served request is never recorded as zero work, however light: rounding a real
  // upstream call down to nothing is the one error a capacity meter must not make.
  const meteredPoints = Math.max(1, Math.round(pointCount * weightPerPoint(query)));

  // `target` is the KEY-FREE identity of this request: the free host, no apikey. It is
  // what the last-good store is keyed on, so the saved answers survive both switching the
  // paid key on and rotating it later — and so a secret is never hashed into a blob name.
  // `requestUrl` is what actually goes on the wire.
  const target = `${upstream.host}${upstreamPath}?${query.toString()}`;

  const subscriptionKey = apiKey();
  const requestUrl = subscriptionKey
    ? `${upstream.customerHost}${upstreamPath}?${query.toString()}&apikey=${encodeURIComponent(subscriptionKey)}`
    : target;

  const fallbackKey = fallbackKeyFor(target);

  // ── OUR OWN CACHE, ahead of the provider — 14/08/2026 ────────────────────────
  //
  // Reaching this line means the CDN missed. Until today that meant "buy it again", and the
  // CDN missing is not the same event as the data being old. It misses when a deploy wipes
  // the edge, when a different edge node serves the request, when the durable layer decides
  // an object is stale for its own reasons — none of which has anything to do with whether
  // the Aegean has changed.
  //
  // This store already held the answer: `rememberLastGood` has been writing every successful
  // response for weeks, and `rescueOr` below re-serves them when the provider refuses us. It
  // was only ever consulted on FAILURE. Consulting it on a plain miss too is the whole fix,
  // and it is the one that depends on nothing outside this function — not a Netlify cache
  // directive, not a dashboard setting, not which continent the visitor was routed to.
  //
  // The invariant becomes purely arithmetic: for one URL, AT MOST ONE upstream call per
  // s-maxage window. Not per window per node, not per window per deploy. Per window.
  //
  // THREE RULES KEEP IT HONEST, and all three are load-bearing:
  //
  //   1. Only served while YOUNGER than the same s-maxage the CDN would have honoured. Older
  //      than that and we go upstream exactly as before. This adds no staleness the previous
  //      behaviour did not already permit.
  //   2. It travels with its real age (X-Forecast-Age-Seconds). weatherService back-dates
  //      `fetchedAt` from that header, so the freshness stamp and the 12 h hard cutoff keep
  //      working on the true age rather than on when the bytes arrived.
  //   3. The CDN is told the REMAINING life, not a fresh full window. A 40-minute-old weather
  //      answer is cached for 20 more minutes, not another 60 — so the worst-case age a
  //      visitor can see is unchanged from yesterday (s-maxage + swr), never compounded.
  //
  // NOT METERED, because no call is bought. That is the point of the change, and it is also
  // what will make it visible: the counter should fall without the site changing at all.
  const reusable = await readLastGood(fallbackKey);
  if (reusable && reusable.ageSeconds < routeMaxAgeS(providerKey)) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': cdnCacheControl(
          providerKey,
          routeMaxAgeS(providerKey) - reusable.ageSeconds,
        ),
        'Netlify-Cache-ID': `forecast-${providerKey}`,
        'X-Forecast-Age-Seconds': String(reusable.ageSeconds),
        ...cors,
      },
      body: reusable.body,
    };
  }

  /**
   * Last resort before an error page: re-serve the freshest answer we still hold for
   * this exact URL, honestly aged. See the FALLBACK_STORE block above for why the age
   * header and the short CDN TTL are both mandatory.
   */
  const rescueOr = async (errorResponse) => {
    // `reusable` was already read above. It is null or too old to serve normally, but the
    // rescue window is 12 h rather than one s-maxage, so a too-old-to-reuse answer is still a
    // perfectly good rescue — and re-reading the same blob to learn that would be waste on the
    // one path where we are already having a bad time.
    const rescued = reusable || await readLastGood(fallbackKey);
    if (!rescued) return errorResponse;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        // Deliberately NOT the normal 30/180 min: the provider may recover in a minute
        // and we must not have pinned stale data at the edge for an hour.
        'Netlify-CDN-Cache-Control': `public, s-maxage=${FALLBACK_CDN_MAX_AGE_S}`,
        // The whole reason this is safe. weatherService reads it and back-dates
        // fetchedAt, so the freshness stamp and the hard cutoff still apply.
        'X-Forecast-Age-Seconds': String(rescued.ageSeconds),
        ...cors,
      },
      body: rescued.body,
    };
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstreamResponse = await fetch(requestUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!upstreamResponse.ok) {
      // 429 = upstream refused us → the definitive capacity alarm.
      if (upstreamResponse.status === 429) await meterUpstream({ rateLimited: true, points: meteredPoints });
      // 401/403 on the customer host = the paid key is rejected (expired, revoked, typo).
      // Nothing else in this function would ever tell us; see authAlertSent above.
      if (subscriptionKey && (upstreamResponse.status === 401 || upstreamResponse.status === 403) && !authAlertSent) {
        authAlertSent = true;
        await sendTelegram(
          `🔴 Open-Meteo rejected the paid API key (HTTP ${upstreamResponse.status}). ` +
          'Forecasts are running on the last-good fallback. Check OPEN_METEO_API_KEY in Netlify.'
        );
      }
      // Do NOT cache upstream failures — but do try to answer from what we last knew.
      return await rescueOr(json(502, { error: `Upstream ${upstreamResponse.status}` }, cors));
    }

    // A real upstream success (this ran only because the CDN cache missed) → meter it.
    await meterUpstream({ rateLimited: false, points: meteredPoints });

    const payload = await upstreamResponse.text(); // pass through verbatim (already JSON)
    await rememberLastGood(fallbackKey, payload);
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
        // ── Survive our own deploys — 14/08/2026 ────────────────────────────────
        //
        // Netlify invalidates the whole cache on every deploy, to keep deploys atomic. For
        // HTML and JS that is exactly right. For a weather forecast it is nonsense: the
        // Aegean does not change because we edited a Greek sentence. Every deploy therefore
        // threw away every cached forecast in the country and re-bought all ~4,500 points
        // from scratch — and the measured record confirms it, the day with 32 pushes (10/08)
        // is also the most expensive day the account has ever had (115k calls).
        //
        // `Netlify-Cache-ID` opts a response out of that automatic invalidation (Netlify
        // Caching docs). Deploys stop costing money; freshness is unaffected because it was
        // never the deploy that governed it — s-maxage still expires these on the provider's
        // own publishing cadence. Safe to opt out precisely because there is nothing private
        // here: a public weather forecast for a public coordinate.
        //
        // Keyed per ROUTE, and that is load-bearing in two ways. Netlify registers the value
        // as a purgeable cache tag, so each route can be flushed on demand. And it is the
        // escape hatch for the one real consequence of opting out: MARINE_MODEL is injected
        // server-side, so it is NOT part of the URL — change it and the old answers would
        // otherwise keep being served for up to s-maxage (3 h 30 for marine). If you change
        // MARINE_MODEL, MARINE_HOURLY or the parsing that reads them, purge the tag rather
        // than assuming the deploy did it for you.
        'Netlify-Cache-ID': `forecast-${providerKey}`,
        ...cors,
      },
      body: payload,
    };
  } catch (error) {
    return await rescueOr(json(504, { error: 'Upstream timeout or network error.' }, cors));
  } finally {
    clearTimeout(timeout);
  }
};
