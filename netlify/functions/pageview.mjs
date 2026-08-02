// ─────────────────────────────────────────────────────────────────────────────
// FIRST-PARTY, COOKIELESS VISITOR COUNTER — the "real traffic" meter.
//
// WHY THIS EXISTS: our GA4 is (correctly) consent-gated AND blocked by ad-blockers,
// so it under-counts real visitors by roughly half (see the SEO/GA memo). Any
// third-party analytics beacon (Cloudflare Insights, Plausible cloud, GA) sits on
// the same ad-block filter lists, so switching vendors would not fix it.
//
// The fix is to count on OUR OWN origin: the client pings `/api/hit` (a clean,
// same-origin path that is on no filter list), and this function tallies it. That
// beats BOTH failure modes at once:
//   • Ad-block   — a first-party request to our own domain is not blocked.
//   • Consent    — we store ZERO cookies and ZERO personal data, so this is lawful
//                  under legitimate interest with no banner (the Plausible model).
//
// PRIVACY (why it needs no consent): we never store an IP or a raw user-agent. A
// visitor is identified only by an irreversible daily hash:
//     visitor = sha256( dailySalt + "|" + ip + "|" + userAgent )
//     dailySalt = sha256( TRAFFIC_HASH_SECRET + "|" + utcDay )   // rotates every day
// The salt is derived from a secret env var and the UTC day, and is NEVER stored.
// So the hash cannot be reversed to an IP, and the SAME visitor gets a DIFFERENT
// hash tomorrow — there is no cross-day tracking and no personal data at rest.
//
// UNIQUE-COUNT ACCURACY: uniqueness is counted RACE-FREE. Each distinct visitor
// writes exactly one blob keyed by their daily hash (`d/<day>/<hash>`); a repeat
// visit just overwrites the same key. So the count of keys under a day is the exact
// number of unique visitors — concurrent hits can never double-count or lose one.
// (The separate all-hits pageview total is best-effort, like the capacity meter.)
//
// ── WHAT EACH KEY IS FOR ─────────────────────────────────────────────────────
//   d/<day>/<hash>                    one blob per unique visitor → exact uniques,
//                                     payload carries the visit's own session state
//   geo/<day>/<hash>~cc~lat~lon~city~device~kind
//                                     written once per unique visitor; ALL the map
//                                     data lives in the KEY, so the console renders
//                                     a day's world map from one list() and zero gets
//   live/<minute>/<hash>~cc~lat~lon~city~section
//                                     presence ping; "who is on the site right now"
//                                     is just the keys from the last few minutes
//   totals/<day>                      best-effort rollup (counts, breakdowns, dwell)
//
// Read the numbers at /api/traffic (see traffic-stats.mjs).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';
import { readGeo } from './lib/geoLookup.mjs';

const TRAFFIC_STORE = 'traffic';

/** UTC day key, e.g. "2026-07-22". */
const utcDayKey = (date) => date.toISOString().slice(0, 10);

// If the secret env var is unset the counter still works, but the hash is only as
// private as this fallback (which is public in the repo). Set TRAFFIC_HASH_SECRET
// in the Netlify env for genuine, unbreakable anonymity. See docs/TRAFFIC.md.
const hashSecret = () => process.env.TRAFFIC_HASH_SECRET || 'calmbeach-default-rotate-me';

const sha256 = (input) => createHash('sha256').update(input).digest('hex');

/** Irreversible per-day visitor id from ip + user-agent. Never stores either. */
const visitorHash = (ip, userAgent, dayKey) => {
  const dailySalt = sha256(`${hashSecret()}|${dayKey}`);
  return sha256(`${dailySalt}|${ip}|${userAgent}`).slice(0, 32);
};

// Obvious crawlers/bots are excluded so "real users" stays real. This is a coarse
// screen (real humans never match), not a security control.
const BOT_UA = /bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternal|embedly|quora|pinterest|semrush|ahrefs|mj12|dotbot|petalbot|headless|lighthouse|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch/i;

const clientIp = (headers) =>
  headers['x-nf-client-connection-ip'] ||
  (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  'unknown';

/** Coarse device class from the user-agent — enough for a mobile/desktop split. */
const deviceClass = (ua) => {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'mobile';
  return 'desktop';
};

/** Browser family — coarse, for "what do we have to support". */
const browserClass = (ua) => {
  if (/Edg\//i.test(ua)) return 'edge';
  if (/OPR\/|Opera/i.test(ua)) return 'opera';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox\//i.test(ua)) return 'firefox';
  // Every iOS browser is Safari underneath; Chrome-on-iOS reports CriOS.
  if (/CriOS/i.test(ua)) return 'chrome';
  if (/Chrome\//i.test(ua)) return 'chrome';
  if (/Safari\//i.test(ua)) return 'safari';
  return 'other';
};

/** OS family. */
const osClass = (ua) => {
  if (/iPhone|iPad|iPod|iOS/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return 'other';
};

/** Primary language tag, 2 letters — tells us which locales actually need work. */
const primaryLang = (headers) => {
  const raw = headers['accept-language'] || '';
  const first = raw.split(',')[0].trim().slice(0, 5).toLowerCase();
  const code = first.slice(0, 2);
  return /^[a-z]{2}$/.test(code) ? code : '';
};

/** Hour 0–23 in Athens time — "when do people actually check the beach". */
const athensHour = (date) => {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Athens',
        hour: '2-digit',
        hour12: false,
      }).format(date)
    );
  } catch {
    return (date.getUTCHours() + 3) % 24; // summer offset; only used if ICU is missing
  }
};

const bump = (obj, key, by = 1) => {
  if (!key) return;
  obj[key] = (obj[key] || 0) + by;
};

// ── Abuse guards ─────────────────────────────────────────────────────────────
// This endpoint had NEITHER of the two guards feedback-email.mjs already uses for
// the exact same reason (unauthenticated, same-origin-only by design, but reachable
// by anyone who reads the bundle). Found 02/08/2026 when the counter reported 6.937
// unique visitors / 1.008 new for a day GA4 measured at 82 total users — a scripted
// flood (or a JS-executing crawler hitting every page) can trivially rack up
// "unique" hashes since uniqueness is only ip+UA+day, and UA is attacker-controlled.
//
//   1. Origin/Referer must be ours (same allow-list as feedback-email.mjs). The real
//      client always sends one of these on its POST (sendBeacon/fetch), so this only
//      turns away direct scripted hits and third-party pages embedding the beacon.
//   2. A per-IP burst limit held in module scope, same mechanism as feedback-email.mjs
//      and forecast.mjs. Generous (this endpoint is legitimately hit far more per
//      visitor than feedback) so a busy shared IP (café wifi, mobile CGNAT) is not
//      mistaken for a flood.
// Neither is real auth — a distributed flood with forged headers still slips through;
// that needs a Cloudflare rule (see docs/team, anti-scraping posture).

const ALLOWED_HOSTS = new Set(['calmbeach.gr', 'www.calmbeach.gr', 'localhost', '127.0.0.1']);

const hostOf = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

// Deploy previews and branch deploys live on *.netlify.app and must keep working.
const isOwnHost = (host) => Boolean(host) && (ALLOWED_HOSTS.has(host) || host.endsWith('.netlify.app'));

const isTrustedOrigin = (headers) => {
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  if (origin) return isOwnHost(hostOf(origin));
  if (referer) return isOwnHost(hostOf(referer));
  return false;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120; // one real visitor needs ~1-10/min; leaves headroom for shared IPs
const recentByIp = new Map();

const isRateLimited = (headers) => {
  const ip = clientIp(headers);
  if (!ip || ip === 'unknown') return false;

  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);

  // Keep the map from growing without bound across a long-lived container.
  if (recentByIp.size > 500) {
    for (const [key, times] of recentByIp) {
      if (!times.some((at) => now - at < RATE_LIMIT_WINDOW_MS)) recentByIp.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
};

/**
 * Keep a counting dictionary bounded. Page paths are the only high-cardinality
 * dimension we keep, and a rollup blob that grows forever would eventually cost
 * more to read than the data is worth.
 */
const prune = (obj, max) => {
  const keys = Object.keys(obj || {});
  if (keys.length <= max) return obj;
  const kept = keys.sort((a, b) => obj[b] - obj[a]).slice(0, max);
  const out = {};
  for (const k of kept) out[k] = obj[k];
  return out;
};

/**
 * Host of the referrer only (never the full URL) — enough for a traffic-source view.
 * Our own host maps to 'direct': the beacon's Referer HEADER is always our own page
 * (same-origin request), and a same-origin document.referrer is an internal hop,
 * not a traffic source — neither says where the visitor came FROM.
 */
const referrerHost = (raw, ownHost) => {
  if (!raw) return 'direct';
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    if (!host || host === ownHost) return 'direct';
    return host.slice(0, 60);
  } catch {
    return 'other';
  }
};

/**
 * Search engine / social network / AI assistant behind a referrer host, so the
 * console can group "google.gr", "google.com" and "news.google.com" as one channel.
 */
const sourceChannel = (host) => {
  if (host === 'direct') return 'direct';
  if (/(^|\.)google\./.test(host)) return 'google';
  if (/(^|\.)(bing|duckduckgo|yahoo|ecosia|brave|startpage|yandex)\./.test(host)) return 'search-other';
  if (/(^|\.)(chatgpt|openai|perplexity|claude|anthropic|copilot|gemini)\./.test(host)) return 'ai';
  if (/(^|\.)(facebook|instagram|fb|l\.facebook|m\.facebook)\./.test(host)) return 'facebook';
  if (/(^|\.)(t\.co|twitter|x)\./.test(host) || host === 't.co' || host === 'x.com') return 'x';
  if (/(^|\.)(reddit|tiktok|youtube|pinterest|linkedin|threads)\./.test(host)) return 'social-other';
  if (/(^|\.)(mail|outlook|webmail)\./.test(host)) return 'email';
  return 'referral';
};

const safeToken = (v, max = 60) =>
  typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_./-]/g, '').slice(0, max) : '';

/** City name safe to embed in a blob key: latin word chars only, `_` for spaces. */
const keySafeCity = (city) =>
  String(city || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .slice(0, 28);

/** Viewport width bucket — how many visitors are on a small phone, really. */
const viewportBucket = (raw) => {
  const w = Number(raw);
  if (!Number.isFinite(w) || w <= 0) return '';
  if (w < 380) return '<380';
  if (w < 480) return '380-479';
  if (w < 768) return '480-767';
  if (w < 1024) return '768-1023';
  if (w < 1440) return '1024-1439';
  return '1440+';
};

/**
 * WHAT THE VISITOR IS ACTUALLY DOING, from the path alone. This is the difference
 * between "43 pageviews" and "12 people opened a beach, 4 read a guide" — the only
 * form of the number anyone can act on.
 *
 * Path shapes (see scripts/prerenderBeachPages.mjs): a locale prefix, then either
 * /beaches/<region>[/<beach>], one of the six *-beaches/<region> guide families,
 * the guides hub, a single-segment landing page, or legal/faq.
 */
const activityFromPath = (raw) => {
  if (!raw) return 'other';
  const p = raw.replace(/^\/(el|de|fr|it)(?=\/|$)/, '') || '/';
  if (p === '/' || p === '') return 'home';
  if (/^\/beaches\/[^/]+\/[^/]+/.test(p)) return 'beach';
  if (/^\/beaches\/[^/]+/.test(p)) return 'region';
  if (/^\/beach-guides/.test(p)) return 'hub';
  if (/^\/(sheltered|organized|snorkeling|sunset|family|secluded)-beaches\/[^/]+/.test(p)) return 'guide';
  if (/^\/faq/.test(p)) return 'faq';
  if (/^\/(terms|privacy|cookies|legal-archive)/.test(p)) return 'legal';
  // Everything else with a single segment is one of the marketing landings
  // (/beaches-near-me/, /best-beaches-greece-today/, …).
  if (/^\/[^/]+\/?$/.test(p)) return 'landing';
  return 'other';
};

// The visitor journey we care about, in order. Each visitor is counted at most ONCE
// per step (the first time they reach it), so the funnel reads as people, not clicks.
const FUNNEL_STEP = { region: 'r', beach: 'b', guide: 'g', hub: 'g', landing: 'l' };

// Visitor actions worth counting first-party. These are the closest thing this site
// has to a conversion — a person who pressed "navigate" is a person who went to the
// beach — and GA4 sees only the consenting, non-ad-blocked half of them.
const ACTIONS = new Set(['nav', 'share', 'fav', 'out', 'search', 'filter']);

// A session is "still the same visit" while pings keep arriving inside this gap.
// Longer gaps are treated as the visitor having left (dwell stops accruing).
const SESSION_GAP_SEC = 300;

export const handler = async (event) => {
  // A no-content response — the client never needs a body back.
  const noContent = {
    statusCode: 204,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
    body: '',
  };

  // GET was accepted historically but the client only ever POSTs (sendBeacon/fetch);
  // GET just left an unauthenticated pixel anyone could embed to inflate the count.
  if (event.httpMethod !== 'POST') return noContent;

  try {
    // Classic Lambda-signature functions must wire the Blobs environment from the
    // event before getStore() works; without this getStore() throws and every write
    // is silently swallowed below (zero data recorded).
    connectLambda(event);

    const headers = event.headers || {};
    const userAgent = headers['user-agent'] || '';

    // Silently drop anything that isn't our own page pinging us, or that is bursting
    // from one IP. "Silently" on purpose: a 403 would tell a script exactly which
    // header it's missing, a 204 (like every accepted hit) gives it nothing to probe.
    if (!isTrustedOrigin(headers)) return noContent;
    if (isRateLimited(headers)) return noContent;

    // Drop bots and empty-UA junk without touching storage. Every real browser also
    // sends Accept-Language; most scrapers/scripts that fake a browser UA do not —
    // requiring it screens out the "plain curl with a Chrome UA" class for free.
    if (!userAgent || BOT_UA.test(userAgent)) return noContent;
    if (!headers['accept-language']) return noContent;

    const params = event.queryStringParameters || {};
    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);
    const minute = Math.floor(now.getTime() / 60000);
    const dayKey = utcDayKey(now);
    const ip = clientIp(headers);
    const hash = visitorHash(ip, userAgent, dayKey);

    // Three shapes of ping: a page view, a presence heartbeat (no new pageview),
    // and an action (a click worth counting, also not a pageview).
    const action = ACTIONS.has(params.a) ? params.a : '';
    const isHeartbeat = params.hb === '1';
    const isPageview = !isHeartbeat && !action;

    const pageType = safeToken(params.t, 24) || 'page';
    // Prefer the client-passed document.referrer (the real visit origin); the Referer
    // header is only a fallback for old cached bundles and is our own page anyway.
    const ownHost = (headers.host || '').replace(/^www\./, '');
    const ref = referrerHost(params.r || headers.referer || headers.referrer, ownHost);
    const section = safeToken(params.s, 32) || 'home';
    const path = safeToken(params.pg, 64);
    const device = deviceClass(userAgent);
    const browser = browserClass(userAgent);
    const os = osClass(userAgent);
    const lang = primaryLang(headers);
    const viewport = viewportBucket(params.w);
    const geo = readGeo(headers);
    const kind = params.v === 'new' ? 'new' : params.v === 'ret' ? 'ret' : 'unknown';
    // Pageview index within this visitor's day, straight from the client's own
    // localStorage. The server cannot infer this reliably (Blobs reads are eventually
    // consistent for ~60s), so the client — which knows for certain — tells us.
    const pvIndex = Number(params.n) || 0;

    const store = getStore(TRAFFIC_STORE);
    const visitorKey = `d/${dayKey}/${hash}`;
    const city = keySafeCity(geo.city);

    // (1) RACE-FREE uniqueness: one blob per unique visitor per day. We read it first
    //     to learn whether this is the visitor's FIRST hit today and to carry the
    //     session clock, then (over)write it — presence is all the unique count needs.
    const already = await store.get(visitorKey, { type: 'json' });
    const firstSeen = (already && already.t0) || nowSec;
    const lastSeen = (already && already.t1) || nowSec;
    // Only count time between pings that are close enough to be the same visit; a
    // 4-hour gap is someone coming back, not someone reading for 4 hours.
    const gap = nowSec - lastSeen;
    const dwellDelta = gap > 0 && gap <= SESSION_GAP_SEC ? gap : 0;

    // Journey steps this visitor has already reached today. Each step counts once
    // per person — the flag lives here, the tally lives in the day rollup.
    const activity = isPageview ? activityFromPath(path) : '';
    const done = { ...((already && already.did) || {}) };
    const newSteps = [];
    const step = FUNNEL_STEP[activity];
    if (step && !done[step]) {
      done[step] = 1;
      newSteps.push(step);
    }
    if (action === 'nav' && !done.n) {
      done.n = 1;
      newSteps.push('n');
    }

    // Heartbeats and action pings carry no referrer/page-type, so they must not
    // overwrite what the visitor's FIRST pageview recorded — otherwise everyone who
    // stayed a minute ended up filed as "direct".
    await store.setJSON(visitorKey, {
      r: isPageview ? ref : (already && already.r) || ref,
      p: isPageview ? pageType : (already && already.p) || pageType,
      s: (already && already.s) || section,
      c: geo.country,
      t0: firstSeen,
      t1: nowSec,
      // Total engaged seconds for this visitor today — the console's "χρόνος στη
      // σελίδα" is the mean of these, not a guess from pageview counts.
      dw: ((already && already.dw) || 0) + dwellDelta,
      did: done,
    });

    // (2) PRESENCE. One key per visitor per minute, with the map data encoded in the
    //     key itself. "Who is online now" is then a prefix list with no blob reads,
    //     and stale minutes are swept by the console (see traffic-stats.mjs).
    try {
      await store.setJSON(
        `live/${minute}/${hash}~${geo.country}~${geo.lat ?? ''}~${geo.lon ?? ''}~${city}~${section}~${geo.approx ? 'a' : ''}`,
        1
      );
    } catch {
      // Presence is decoration; never fail a hit over it.
    }

    // (3) MAP. Written once per unique visitor per day, again with everything in the
    //     key, so a whole day's world map costs one list() call.
    if (!already) {
      try {
        await store.setJSON(
          `geo/${dayKey}/${hash}~${geo.country}~${geo.lat ?? ''}~${geo.lon ?? ''}~${city}~${device}~${kind}~${geo.approx ? 'a' : ''}`,
          1
        );
      } catch {
        // ditto
      }
    }

    // (4) Best-effort day rollup. `hits` counts every pageview; the qualitative
    //     breakdowns are counted once per UNIQUE visitor (only on their first hit of
    //     the day) so they read as "visitors", not "pageviews". Read-modify-write, so
    //     under heavy concurrency a count can be lost — an acceptable slight
    //     under-estimate (the daily UNIQUE total, listed separately, stays exact).
    try {
      const key = `totals/${dayKey}`;
      const prev = (await store.get(key, { type: 'json' })) || {};

      if (isPageview) {
        prev.hits = (prev.hits || 0) + 1;
        prev.types = prev.types || {};
        prev.views = prev.views || {};
        prev.pages = prev.pages || {};
        prev.hours = prev.hours || {};
        prev.activity = prev.activity || {};
        bump(prev.types, pageType);
        bump(prev.activity, activity); // what this pageview WAS: beach, guide, region…
        bump(prev.views, section); // every pageview — true section popularity
        if (path) bump(prev.pages, path);
        bump(prev.hours, String(athensHour(now)));
        // The visitor's SECOND pageview is what turns a bounce into a real visit.
        // Driven by the client's own counter, so it is exact rather than racy.
        if (pvIndex === 2) prev.multiPage = (prev.multiPage || 0) + 1;
        prev.pages = prune(prev.pages, 300);
        prev.views = prune(prev.views, 200);
      }

      // The journey: how many PEOPLE (not clicks) reached each step today.
      if (newSteps.length) {
        prev.funnel = prev.funnel || {};
        for (const s of newSteps) bump(prev.funnel, s);
      }

      if (action) {
        prev.actions = prev.actions || {};
        bump(prev.actions, action);
        // Unique-ish: only the visitor's first action of each kind would need per
        // visitor state, so this is a raw click count — labelled as such in the UI.
      }

      if (dwellDelta) {
        prev.dwellSec = (prev.dwellSec || 0) + dwellDelta;
        // A visitor becomes "engaged" the first time they accrue any dwell at all,
        // i.e. on their second ping. That is exactly the denominator we want for
        // average time on site.
        if (!already || !already.dw) prev.engaged = (prev.engaged || 0) + 1;
      }

      // Once per unique visitor: the blob check is the gate, but Blobs reads are
      // eventually consistent (~up to 60s), so a visitor's 2nd pageview inside that
      // window still reads `already` as empty and was re-counted here. The client
      // knows its own "first ping of the day" for certain (localStorage); f='0'
      // (definitely not first) suppresses that race. f='1'/'' keep the blob gate.
      if (!already && params.f !== '0') {
        prev.refs = prev.refs || {};
        prev.channels = prev.channels || {};
        prev.sections = prev.sections || {};
        prev.devices = prev.devices || {};
        prev.browsers = prev.browsers || {};
        prev.os = prev.os || {};
        prev.countries = prev.countries || {};
        prev.cities = prev.cities || {};
        prev.langs = prev.langs || {};
        prev.viewports = prev.viewports || {};
        prev.kinds = prev.kinds || {};
        bump(prev.refs, ref);
        bump(prev.channels, sourceChannel(ref));
        bump(prev.sections, section); // first section seen = the entry point
        bump(prev.devices, device);
        bump(prev.browsers, browser);
        bump(prev.os, os);
        bump(prev.countries, geo.country);
        if (city) bump(prev.cities, `${geo.country}/${city}`);
        if (lang) bump(prev.langs, lang);
        if (viewport) bump(prev.viewports, viewport);
        bump(prev.kinds, kind);
        prev.cities = prune(prev.cities, 200);
      }

      await store.setJSON(key, prev);
    } catch {
      // Totals are advisory; never fail the request over them.
    }
  } catch {
    // Counting must never surface an error to the visitor.
  }

  return noContent;
};
