// A photo of the sea, sent by the visitor who just told us "more waves / more wind / calmer".
//
// It exists so the owner can SEE what the visitor saw, next to the comment itself: the
// picture goes to the same Telegram chat as a reply to that comment's message, so the two
// arrive as one thread on the phone. Nothing is published and nothing is stored here —
// Telegram is the only copy, exactly like the comment text.
//
// Guards, in the order they run:
//   1. Origin must be ours (same drive-by filter as every other function).
//   2. Per-IP burst limit — a photo is ~0.5 MB of Telegram upload, not a 1 KB text.
//   3. A signed pass from feedback-email.mjs (lib/feedbackPhotoToken.mjs): no fresh comment,
//      no photo. This is what stops the endpoint being a free image relay into the chat.
//   4. The bytes must be a real, small JPEG. The browser has already re-encoded it through a
//      canvas (services/beachPhotoUpload.ts → prepareBeachPhoto), which drops EXIF/GPS; the
//      metadata segments are dropped again here because a direct POST never went through
//      that canvas.
import { readPhotoToken } from './lib/feedbackPhotoToken.mjs';

/** Same ceiling the photo pipeline uses (beach_photos.bytes <= 600000). */
const MAX_PHOTO_BYTES = 600_000;
/** Base64 of the above plus the small JSON around it. */
const MAX_BODY_LENGTH = 900_000;
const TELEGRAM_TIMEOUT_MS = 15_000;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const clamp = (value, max = 120) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const getConfig = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

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

// A visitor sends one photo, maybe a second when the first came out dark. Four in ten
// minutes is generous for a human and a hard stop for a loop.
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_MAX = 4;
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

/**
 * Walk the JPEG segments and keep only what draws the picture.
 *
 * Drops APP1–APP15 (EXIF with the GPS tag, XMP, maker notes, ICC) and COM; keeps APP0
 * (JFIF) and every coding segment. Returns null for anything that is not a well-formed
 * JPEG — which is also the check that this really is an image and not some other file.
 */
export const stripJpegMetadata = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  const kept = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    // Fill bytes between segments are legal; skip them.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Start of scan: the compressed picture runs to the end of the file.
    if (marker === 0xda) {
      kept.push(buffer.subarray(offset));
      return Buffer.concat(kept);
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) kept.push(buffer.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return null;
};

const TIMING_LABELS = {
  now: 'είναι εκεί τώρα',
  morning: 'ήταν εκεί το πρωί',
  midday: 'ήταν εκεί το μεσημέρι',
  evening: 'ήταν εκεί απόγευμα / βράδυ',
  unsure: 'δεν θυμάται πότε ήταν εκεί',
};

const buildCaption = (body) => {
  const beach = clamp(body.beachName, 80);
  const lines = [`📷 Φωτογραφία επισκέπτη${beach ? ` — ${beach}` : ''}`];
  const timing = TIMING_LABELS[body.observedTiming];
  if (timing) lines.push(`Δήλωσε ότι ${timing}.`);
  // The camera was opened straight from our button, so the picture is minutes old. A photo
  // picked from the gallery can be from any day — say so, or it gets read as "right now".
  lines.push(body.fromCamera === true
    ? 'Τραβήχτηκε με την κάμερα από το κουμπί μας — είναι της στιγμής.'
    : 'Διαλέχτηκε από τη συλλογή του — μπορεί να είναι από νωρίτερα.');
  return lines.join('\n').slice(0, 1_000);
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!isTrustedOrigin(event)) return json(403, { error: 'Forbidden.' });
  if (isRateLimited(event)) return json(429, { error: 'Too many photos. Try again later.' });

  const raw = event.body || '';
  if (raw.length > MAX_BODY_LENGTH) return json(413, { error: 'Photo is too large.' });

  let body;
  try {
    body = JSON.parse(event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw);
  } catch {
    return json(400, { error: 'Invalid JSON payload.' });
  }

  const beachId = Number(body?.beachId);
  const replyTo = Number.isFinite(beachId) ? readPhotoToken(body?.photoToken, beachId) : null;
  // 401, not 403: the usual cause is an honest one — the page sat open past the pass lifetime.
  if (!replyTo) return json(401, { error: 'This comment can no longer take a photo.' });

  const image = typeof body?.image === 'string' ? Buffer.from(body.image, 'base64') : null;
  if (!image || !image.length) return json(400, { error: 'No photo.' });
  if (image.length > MAX_PHOTO_BYTES) return json(413, { error: 'Photo is too large.' });
  const cleaned = stripJpegMetadata(image);
  if (!cleaned) return json(400, { error: 'Not a JPEG photo.' });

  const config = getConfig();
  if (!config.botToken || !config.chatId) {
    console.error('Feedback photo delivery is not configured.');
    return json(503, { error: 'Photo delivery is not configured.' });
  }

  const form = new FormData();
  form.append('chat_id', config.chatId);
  form.append('photo', new Blob([cleaned], { type: 'image/jpeg' }), 'calmbeach-conditions.jpg');
  form.append('caption', buildCaption(body));
  // Reply to the comment, but still deliver if that message was deleted from the chat.
  form.append('reply_parameters', JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));

  let response;
  let responseBody = null;
  try {
    response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    responseBody = await response.json().catch(() => null);
  } catch (error) {
    console.error('Feedback photo delivery failed.', error && error.message);
    return json(502, { error: 'Photo delivery failed.' });
  }

  if (!response.ok || responseBody?.ok === false) {
    console.error('Feedback photo delivery failed.', {
      status: response.status,
      error: responseBody?.description,
    });
    return json(502, { error: 'Photo delivery failed.' });
  }

  return json(202, { ok: true });
};
