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
// Read the numbers at /api/traffic (see traffic-stats.mjs).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';

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

/** Host of the referrer only (never the full URL) — enough for a traffic-source view. */
const referrerHost = (raw) => {
  if (!raw) return 'direct';
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    return host.slice(0, 60) || 'direct';
  } catch {
    return 'other';
  }
};

const safeToken = (v, max = 60) =>
  typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_./-]/g, '').slice(0, max) : '';

export const handler = async (event) => {
  // A 1x1 no-content response — the client never needs a body back.
  const noContent = {
    statusCode: 204,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
    body: '',
  };

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return noContent;

  try {
    // Classic Lambda-signature functions must wire the Blobs environment from the
    // event before getStore() works; without this getStore() throws and every write
    // is silently swallowed below (zero data recorded).
    connectLambda(event);

    const headers = event.headers || {};
    const userAgent = headers['user-agent'] || '';

    // Drop bots and empty-UA junk without touching storage.
    if (!userAgent || BOT_UA.test(userAgent)) return noContent;

    const params = event.queryStringParameters || {};
    const dayKey = utcDayKey(new Date());
    const ip = clientIp(headers);
    const hash = visitorHash(ip, userAgent, dayKey);

    const pageType = safeToken(params.t, 24) || 'page';
    const ref = referrerHost(headers.referer || headers.referrer || params.r);

    const store = getStore(TRAFFIC_STORE);

    // (1) RACE-FREE uniqueness: one blob per unique visitor per day. Overwriting on a
    //     repeat visit is intentional and harmless — presence is all that's counted.
    await store.setJSON(`d/${dayKey}/${hash}`, { r: ref, p: pageType });

    // (2) Best-effort day rollup: total hits + per-referrer / per-page-type tallies.
    //     Read-modify-write, so a concurrent hit can lose a count — an acceptable
    //     slight under-estimate for the coarse totals (uniqueness above is exact).
    try {
      const key = `totals/${dayKey}`;
      const prev = (await store.get(key, { type: 'json' })) || { hits: 0, refs: {}, types: {} };
      prev.hits = (prev.hits || 0) + 1;
      prev.refs[ref] = (prev.refs[ref] || 0) + 1;
      prev.types[pageType] = (prev.types[pageType] || 0) + 1;
      await store.setJSON(key, prev);
    } catch {
      // Totals are advisory; never fail the request over them.
    }
  } catch {
    // Counting must never surface an error to the visitor.
  }

  return noContent;
};
