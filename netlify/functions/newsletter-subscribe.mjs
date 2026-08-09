// The newsletter list. POST to subscribe, GET (with a key) to export it.
//
// WHY ITS OWN FUNCTION AND ITS OWN BLOB STORE, rather than another `kind` on
// feedback-email.mjs whose guards this file copies wholesale:
//
//   - An email address is personal data with a consent story attached; beach
//     feedback is not. Mixing them means a deletion request has to be honoured
//     inside the store scripts/calibrateFromFeedback.mjs aggregates over.
//   - A subscriber list needs de-duplication. Feedback is append-only by design;
//     here the same address arriving twice must be one row, not two.
//   - The delivery priorities are opposite. For feedback the Telegram push IS
//     the delivery, so a Telegram failure is a failed request. Here the DURABLE
//     WRITE is the delivery and Telegram is only a notification — so a Telegram
//     outage must not tell a visitor their subscription failed when it did not.
//
// EXPORT: curl "https://calmbeach.gr/api/newsletter?key=YOUR_KEY"
// Set NEWSLETTER_EXPORT_KEY in the Netlify UI. Unset ⇒ 403, never public.
import { connectLambda, getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

const STORE = 'newsletter';
const MAX_BODY_LENGTH = 4_000;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum path length.

/**
 * The consent wording in force when a row was written, stored WITH the row.
 * Bump this string whenever the copy next to the field changes materially: an
 * old subscriber's record then still says what they were actually shown, which
 * is the whole point of keeping a consent record rather than a bare address.
 */
const CONSENT_VERSION = '2026-08-09.1';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

// ── Abuse guards, copied from feedback-email.mjs ─────────────────────────────
// Same reasoning: unauthenticated by design, so origin + per-IP burst. Kept as a
// copy rather than a shared import because these two functions are deployed
// independently and a shared helper that silently loosens one would loosen both.

const ALLOWED_HOSTS = new Set(['calmbeach.gr', 'www.calmbeach.gr', 'localhost', '127.0.0.1']);

const hostOf = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isOwnHost = (host) => Boolean(host) && (ALLOWED_HOSTS.has(host) || host.endsWith('.netlify.app'));

const isTrustedOrigin = (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  if (origin) return isOwnHost(hostOf(origin));
  if (referer) return isOwnHost(hostOf(referer));
  return false;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
// Lower than feedback's 8: nobody legitimately subscribes three times a minute.
const RATE_LIMIT_MAX = 3;
const recentByIp = new Map();

const isRateLimited = (event) => {
  const headers = event.headers || {};
  const ip = (headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (!ip) return false;

  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter(at => now - at < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);

  if (recentByIp.size > 500) {
    for (const [key, times] of recentByIp) {
      if (!times.some(at => now - at < RATE_LIMIT_WINDOW_MS)) recentByIp.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
};

// ── the address ─────────────────────────────────────────────────────────────
// Deliberately permissive. A regex that tries to fully implement RFC 5322 is
// famously wrong at the edges, and the cost of the two error directions is not
// symmetric: rejecting a real address loses a subscriber for good, while letting
// a malformed one through costs one dead row that the first send reveals.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);

/**
 * The blob key IS the de-duplication: same address, same key, one row. Hashed
 * rather than raw because the key appears in listings and logs, and an address
 * should not be readable from a key alone.
 */
const keyForEmail = (email) => `s/${createHash('sha256').update(email).digest('hex')}`;

const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_LENGTH) {
    const error = new Error('Payload too large.');
    error.statusCode = 413;
    throw error;
  }
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    const error = new Error('Invalid JSON payload.');
    error.statusCode = 400;
    throw error;
  }
};

const notifyTelegram = async (email, locale) => {
  const botToken = process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '';
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📬 <b>Νέα εγγραφή στο newsletter</b>\n${email.replace(/&/g, '&amp;').replace(/</g, '&lt;')}\nΓλώσσα: ${locale || '—'}`,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    // Never fatal — the row is already durable, which is what "subscribed" means.
    console.error('Newsletter notification failed.', error && error.message);
  }
};

// ── export ──────────────────────────────────────────────────────────────────
const exportList = async (event) => {
  const key = process.env.NEWSLETTER_EXPORT_KEY || '';
  const given = (event.queryStringParameters || {}).key || '';
  if (!key || given !== key) {
    return { statusCode: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Forbidden' };
  }

  connectLambda(event);
  const store = getStore(STORE);
  const { blobs } = await store.list({ prefix: 's/' });
  const rows = [];
  for (const blob of blobs) {
    const row = await store.get(blob.key, { type: 'json' });
    if (row && row.status === 'subscribed') rows.push(row);
  }
  rows.sort((a, b) => String(a.subscribedAt).localeCompare(String(b.subscribedAt)));
  return json(200, { count: rows.length, consentVersion: CONSENT_VERSION, subscribers: rows });
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'GET, POST, OPTIONS' }, body: '' };
  }

  if (event.httpMethod === 'GET') return exportList(event);

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!isTrustedOrigin(event)) return json(403, { error: 'Forbidden.' });
  if (isRateLimited(event)) return json(429, { error: 'Too many attempts. Try again in a minute.' });

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    return json(error.statusCode || 400, { error: error.message || 'Invalid payload.' });
  }

  // Honeypot: answer 202 so a bot learns nothing from being refused.
  if (String(body?.company || '').trim()) return json(202, { ok: true, alreadySubscribed: false });

  const email = normalizeEmail(body?.email);
  if (!EMAIL_RE.test(email)) return json(400, { error: 'Invalid email address.' });

  const locale = String(body?.locale ?? '').trim().slice(0, 8);
  const source = String(body?.source ?? 'landing').trim().slice(0, 40);

  try {
    connectLambda(event);
    const store = getStore(STORE);
    const key = keyForEmail(email);

    const existing = await store.get(key, { type: 'json' }).catch(() => null);
    if (existing && existing.status === 'subscribed') {
      // Not an error, and deliberately not a different message to the visitor:
      // "you are already on the list" to an address that is not yours is an
      // account-existence oracle, small but free to avoid.
      return json(202, { ok: true, alreadySubscribed: true });
    }

    await store.setJSON(key, {
      email,
      locale,
      source,
      status: 'subscribed',
      // A real instant, compared only against other instants — Athens wall-clock
      // would make a signup from abroad sort wrongly against one from Greece.
      subscribedAt: new Date().toISOString(),
      consentVersion: CONSENT_VERSION,
      // Re-subscribing after an unsubscribe keeps the history rather than
      // pretending the first one never happened.
      previousStatus: existing ? existing.status : undefined,
    });

    await notifyTelegram(email, locale);
    return json(202, { ok: true, alreadySubscribed: false });
  } catch (error) {
    console.error('Newsletter subscription failed.', error && error.message);
    return json(502, { error: 'Subscription failed.' });
  }
};
