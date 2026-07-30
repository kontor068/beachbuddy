// Delivers structured "how was it really?" feedback to a Telegram chat as an instant
// push notification. Zero cost: Telegram Bot API is free and unmetered for this volume,
// and no email domain/DNS setup is required. The client still POSTs to this same endpoint
// (/.netlify/functions/feedback-email); only the delivery channel changed from email.
//
// Telegram is push-only and ephemeral (clearing the chat loses every report ever made,
// and the calibration script in scripts/calibrateFromFeedback.mjs has nothing to read).
// So every beach-attached verdict is ALSO written to Netlify Blobs (store 'feedback-log'),
// durable and exportable via /api/feedback-export — see docs/feedback-calibration.md.
import { connectLambda, getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

const FEEDBACK_STORE = 'feedback-log';
const MAX_BODY_LENGTH = 12_000;
const MAX_MESSAGE_LENGTH = 3_800; // Telegram hard limit is 4096; leave headroom.

const clamp = (value, max = 180) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

// Free-text from a human: keep line breaks (the structure IS the message), collapse
// only runs of spaces and any paragraph gap longer than one blank line.
const clampText = (value, max = 1_200) => String(value ?? '')
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, max);

// Telegram HTML parse_mode only needs & < > escaped (unlike full HTML — do NOT escape quotes).
const escapeTelegram = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const getConfig = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

// ── Abuse guards ─────────────────────────────────────────────────────────────
// This endpoint is unauthenticated by design (a visitor must be able to report a
// wrong verdict without an account) and it now has TWO costs per call: a Telegram
// push and a durable Blobs write. Neither is free at volume, so two cheap gates:
//
//   1. Origin/Referer must be ours. Stops the trivial `curl` loop and every
//      cross-site form. It is not real authentication — a determined attacker
//      forges the header — but it removes the entire drive-by class.
//   2. A per-IP burst limit held in module scope. Netlify keeps a warm Lambda
//      between invocations, so this catches a flood from one source without a
//      database. It is best-effort: a distributed flood or a cold start slips
//      through, and the real fix if that ever happens is a Cloudflare rule.

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

const isTrustedOrigin = (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  // Origin is authoritative when present; some browsers omit it on same-origin
  // POSTs, so fall back to Referer before refusing.
  if (origin) return isOwnHost(hostOf(origin));
  if (referer) return isOwnHost(hostOf(referer));
  return false;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8; // a human reporting several beaches in a minute stays under this
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

  // Keep the map from growing without bound across a long-lived container.
  if (recentByIp.size > 500) {
    for (const [key, times] of recentByIp) {
      if (!times.some(at => now - at < RATE_LIMIT_WINDOW_MS)) recentByIp.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
};

const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_LENGTH) {
    const error = new Error('Feedback payload is too large.');
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

const VERDICTS = {
  accurate: { label: 'Accurate', emoji: '👍' },
  not_accurate: { label: 'Not accurate', emoji: '👎' },
  had_waves: { label: 'Had waves', emoji: '🌊' },
  too_windy: { label: 'Too windy', emoji: '💨' },
  calmer: { label: 'Calmer than shown', emoji: '😎' },
  // Free-text message from the landing story section (no beach attached).
  story_message: { label: 'Landing message', emoji: '✉️' },
};

const formatVerdict = (value) => VERDICTS[value] || { label: clamp(value || 'Unknown feedback', 80), emoji: '📩' };

const normalizePayload = (body, event) => {
  const feedback = body && typeof body === 'object' ? body : {};
  const conditions = feedback.conditions && typeof feedback.conditions === 'object' ? feedback.conditions : {};
  const context = feedback.context && typeof feedback.context === 'object' ? feedback.context : {};
  const verdict = formatVerdict(feedback.feedback || feedback.verdict);

  return {
    source: clamp(feedback.source || context.source || 'unknown', 80),
    beachId: Number.isFinite(Number(feedback.beachId)) ? Number(feedback.beachId) : undefined,
    // Free-text path: without these three the landing message arrives empty.
    message: clampText(feedback.message, 1_200),
    replyTo: clamp(feedback.replyTo, 160),
    prompt: clamp(feedback.prompt, 60),
    feedback: clamp(feedback.feedback || feedback.verdict || 'unknown', 80),
    verdictLabel: verdict.label,
    verdictEmoji: verdict.emoji,
    timestamp: clamp(feedback.timestamp || new Date().toISOString(), 80),
    beachName: clamp(context.beachName || feedback.beachName, 120),
    islandName: clamp(context.islandName || feedback.islandName, 120),
    regionId: clamp(context.regionId || feedback.regionId, 80),
    language: clamp(context.language || feedback.language, 24),
    pagePath: clamp(context.pagePath || feedback.pagePath || event.headers?.referer || '', 240),
    conditions: {
      exposureLevel: clamp(conditions.exposureLevel, 80),
      beaufort: Number.isFinite(Number(conditions.beaufort)) ? Number(conditions.beaufort) : undefined,
      windDir: clamp(conditions.windDir, 40),
      date: clamp(conditions.date, 40),
    },
  };
};

const fieldLines = (payload) => [
  // A landing message has no beach attached — an "Unknown" row would be noise.
  ['Beach', payload.beachName || (payload.beachId ? `#${payload.beachId}` : '')],
  ['Reply to', payload.replyTo],
  ['Prompt', payload.prompt],
  ['Beach ID', payload.beachId ?? ''],
  ['Island/region', [payload.islandName, payload.regionId].filter(Boolean).join(' / ')],
  ['Date', payload.conditions.date],
  ['Beaufort', payload.conditions.beaufort ?? ''],
  ['Wind direction', payload.conditions.windDir],
  ['Exposure', payload.conditions.exposureLevel],
  ['Language', payload.language],
  ['Source', payload.source],
  ['Page', payload.pagePath],
  ['Timestamp', payload.timestamp],
].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

const formatMessage = (payload) => {
  const header = `${payload.verdictEmoji} <b>CalmBeach feedback: ${escapeTelegram(payload.verdictLabel)}</b>`;
  const rows = fieldLines(payload)
    .map(([label, value]) => `<b>${escapeTelegram(label)}:</b> ${escapeTelegram(value)}`)
    .join('\n');
  // The human's own words go above the metadata, as a block — inlining them into a
  // "<b>Message:</b> …" row buries the only part worth reading on a phone.
  const body = payload.message ? [escapeTelegram(payload.message), ''] : [];
  return [header, '', ...body, rows].join('\n').slice(0, MAX_MESSAGE_LENGTH);
};

// Durable, calibration-shaped copy of a beach-attached verdict. Skips free-text/no-beach
// submissions (landing story messages) — nothing for scripts/calibrateFromFeedback.mjs to
// aggregate there. Best-effort: a Blobs outage must never break the visitor-facing request.
const persistFeedback = async (event, payload) => {
  if (typeof payload.beachId !== 'number' || !Number.isFinite(payload.beachId)) return;
  if (!payload.feedback || payload.feedback === 'story_message' || payload.feedback === 'unknown') return;

  try {
    connectLambda(event);
    const store = getStore(FEEDBACK_STORE);
    const dayKey = (payload.timestamp || new Date().toISOString()).slice(0, 10);
    await store.setJSON(`f/${dayKey}/${randomUUID()}`, {
      beachId: payload.beachId,
      feedback: payload.feedback,
      timestamp: payload.timestamp,
      conditions: payload.conditions,
    });
  } catch (error) {
    console.error('Feedback persistence failed.', error && error.message);
  }
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!isTrustedOrigin(event)) {
    return json(403, { error: 'Forbidden.' });
  }

  // 429 rather than a silent 202: a real visitor who somehow trips this should be
  // told to try again, not left believing the report went through.
  if (isRateLimited(event)) {
    return json(429, { error: 'Too many reports. Try again in a minute.' });
  }

  let payload;
  try {
    const body = parseBody(event);

    // Honeypot. This endpoint is now reachable from a visible form, so it is a
    // spam target; answer 202 rather than an error so bots learn nothing.
    if (String(body?.company || '').trim()) {
      return json(202, { ok: true, id: null });
    }

    payload = normalizePayload(body, event);
  } catch (error) {
    return json(error.statusCode || 400, { error: error.message || 'Invalid feedback payload.' });
  }

  if (payload.feedback === 'story_message' && !payload.message) {
    return json(400, { error: 'Message is empty.' });
  }

  await persistFeedback(event, payload);

  const config = getConfig();
  if (!config.botToken || !config.chatId) {
    console.error('Feedback notification is not configured.', {
      hasBotToken: Boolean(config.botToken),
      hasChatId: Boolean(config.chatId),
    });
    return json(503, { error: 'Feedback notification is not configured.' });
  }

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: formatMessage(payload),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const responseBody = await response.json().catch(() => null);

  if (!response.ok || responseBody?.ok === false) {
    console.error('Feedback notification failed.', {
      status: response.status,
      error: responseBody?.description || responseBody?.error,
    });
    return json(502, { error: 'Feedback notification failed.' });
  }

  return json(202, { ok: true, id: responseBody?.result?.message_id ?? null });
};
