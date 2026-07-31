// ─────────────────────────────────────────────────────────────────────────────
// CLIENT ERROR + CSP REPORT SINK → Telegram.
//
// Until 30/07/2026 a crash on a visitor's phone was completely invisible: the
// RootErrorBoundary in index.tsx called console.error and that was the end of it.
// The audience is ~86% mobile tourists on island 4G — the single population least
// likely to report a blank screen and most likely to just close the tab.
//
// Deliberately NOT Sentry. Zero cost, no new account, no third-party processor to
// declare in the privacy policy, and no extra kilobytes in a bundle already at
// 3.6 MB. The trade is that we get "something broke, here it is" rather than
// dashboards and history — which is the whole distance between blind and not.
//
// The same endpoint receives Content-Security-Policy violation reports, because
// they arrive in the same shape (a thing the browser refused to do) and want the
// same treatment. That is what makes shipping CSP in Report-Only mode useful: the
// reports have somewhere to land.
//
// WHAT IS NEVER SENT: no IP, no visitor id, no cookies, nothing that identifies a
// person. Message, stack, page path, user-agent, build id. That is why this needs
// no consent gate and does not change the privacy policy.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';

const SEEN_STORE = 'client-errors';
const MAX_BODY_LENGTH = 16_000;
const MAX_FIELD = 500;
const MAX_STACK = 1_400;

/**
 * How many DISTINCT errors we will report per UTC day. A broken deploy produces one
 * error per visitor, not one error — the first version of this idea would have sent
 * a Telegram message per crash and made the channel unusable exactly when it mattered
 * most. Distinct signatures are cheap; repeats of a signature are free.
 */
const MAX_DISTINCT_PER_DAY = 25;

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

// Same shape as feedback-email.mjs. Origin is authoritative when present; browsers
// omit it on some same-origin POSTs, and CSP reports are sent by the browser itself
// with no Origin at all — hence the Referer fallback rather than a hard refusal.
const isTrustedOrigin = (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  if (origin) return isOwnHost(hostOf(origin));
  if (referer) return isOwnHost(hostOf(referer));
  return false;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
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

const clamp = (value, max = MAX_FIELD) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const escapeTelegram = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const getConfig = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_LENGTH) return null;
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    return null;
  }
};

/**
 * Normalise both shapes into one report.
 *
 * A CSP violation arrives as {"csp-report": {...}} (the classic report-uri form) or
 * as a `application/reports+json` array. Our own crashes arrive as a flat object we
 * control. Everything downstream — signature, dedup, formatting — sees one shape.
 */
const normalize = (body) => {
  const csp = body?.['csp-report'] || (Array.isArray(body) ? body[0]?.body : null);
  if (csp) {
    const directive = clamp(csp['effective-directive'] || csp['violated-directive'] || csp.effectiveDirective || '', 80);
    const blocked = clamp(csp['blocked-uri'] || csp.blockedURL || '', 200);
    return {
      kind: 'csp',
      message: `CSP blocked ${blocked || 'something'} (${directive || 'unknown directive'})`,
      source: clamp(csp['document-uri'] || csp.documentURL || '', 200),
      line: 0,
      stack: '',
      disposition: clamp(csp.disposition || 'enforce', 20),
      // One CSP problem is one ORIGIN being refused for one directive, not one URL.
      // The first version signed on the full blocked URL, so every map tile was a
      // brand-new "distinct error": 128 signatures in an afternoon, the 25/day
      // budget gone by the evening, and a real crash that day would have been
      // silently dropped. The message still shows the exact URL — only the identity
      // is coarser.
      groupKey: `${originOf(blocked)}|${directive}`,
    };
  }

  return {
    kind: 'error',
    message: clamp(body?.message, 300),
    source: clamp(body?.source, 200),
    line: Number.isFinite(Number(body?.line)) ? Number(body.line) : 0,
    stack: clamp(body?.stack, MAX_STACK),
    disposition: '',
  };
};

/** Scheme+host of a URL, for grouping. Falls back to the raw value for the
 *  keywords CSP uses instead of a URL ("inline", "eval", "data"). */
const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return clamp(value, 60) || 'unknown';
  }
};

/** What makes two reports "the same problem". Line included so two failures in one
 *  file stay distinct; the page URL deliberately is NOT, or the same bug on 300
 *  beach pages would read as 300 bugs. CSP reports carry their own coarser
 *  groupKey — see normalize(). */
const signatureOf = (report) => (
  report.groupKey
    ? `${report.kind}|${report.groupKey}`
    : `${report.kind}|${report.message}|${report.source}|${report.line}`
)
  .toLowerCase()
  .replace(/[^a-z0-9|.:_/-]+/g, '')
  .slice(0, 180);

const sendTelegram = async (text) => {
  const config = getConfig();
  if (!config.botToken || !config.chatId) return;
  await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
};

const formatMessage = (report, context, repeats) => {
  const header = report.kind === 'csp'
    ? `🛡️ <b>CSP ${report.disposition === 'report' ? 'report-only' : 'violation'}</b>`
    : '💥 <b>CalmBeach client error</b>';

  const rows = [
    `<b>${escapeTelegram(report.message) || 'Unknown error'}</b>`,
    report.source ? `at <code>${escapeTelegram(report.source)}${report.line ? `:${report.line}` : ''}</code>` : '',
    context.page ? `page: ${escapeTelegram(context.page)}` : '',
    context.userAgent ? `ua: ${escapeTelegram(context.userAgent)}` : '',
    context.buildId ? `build: ${escapeTelegram(context.buildId)}` : '',
    repeats > 1 ? `seen ${repeats}× today` : '',
    report.stack ? `\n<pre>${escapeTelegram(report.stack)}</pre>` : '',
  ].filter(Boolean);

  return [header, '', ...rows].join('\n').slice(0, 3_800);
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }
  if (!isTrustedOrigin(event)) {
    return { statusCode: 403, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }
  if (isRateLimited(event)) {
    // 204 rather than 429: this is fire-and-forget telemetry and there is nothing
    // useful for a crashing page to do with an error about its error.
    return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers: { 'Cache-Control': 'no-store' }, body: '' };

  const report = normalize(body);
  if (!report.message) return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };

  const context = {
    page: clamp(body?.page || event.headers?.referer || '', 200),
    userAgent: clamp(event.headers?.['user-agent'] || '', 180),
    buildId: clamp(body?.buildId, 60),
  };

  try {
    connectLambda(event);
    const store = getStore(SEEN_STORE);
    const dayKey = new Date().toISOString().slice(0, 10);
    const signature = signatureOf(report);
    const key = `seen/${dayKey}/${encodeURIComponent(signature)}`;

    const prev = await store.get(key, { type: 'json' });
    const repeats = (prev?.count || 0) + 1;
    await store.setJSON(key, { count: repeats, message: report.message, lastSeen: new Date().toISOString() });

    // A report-only CSP violation blocked NOTHING — by definition. It is a note
    // that the policy would have interfered if it were enforced, which is useful
    // when you go looking and worthless as a push notification at 9am. It is still
    // recorded above, so `netlify blobs:list client-errors` shows every origin and
    // how often, which is how the policy gets finished.
    //
    // Enforced violations DO reach Telegram: at that point something on the page
    // really was refused and a visitor really did lose it.
    if (report.kind === 'csp' && report.disposition !== 'enforce') {
      return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    }

    if (repeats === 1) {
      // A day-level counter of DISTINCT signatures, so a pathological page that
      // manufactures unique messages cannot turn the channel into a firehose.
      const budgetKey = `budget/${dayKey}`;
      const budget = (await store.get(budgetKey, { type: 'json' }))?.distinct || 0;
      if (budget < MAX_DISTINCT_PER_DAY) {
        await store.setJSON(budgetKey, { distinct: budget + 1 });
        await sendTelegram(formatMessage(report, context, repeats));
      } else if (budget === MAX_DISTINCT_PER_DAY) {
        await store.setJSON(budgetKey, { distinct: budget + 1 });
        await sendTelegram(`🔇 <b>CalmBeach: ${MAX_DISTINCT_PER_DAY} distinct client errors today</b>\nFurther new errors are being counted but not sent. Something is badly wrong — check a real page.`);
      }
    }
  } catch (error) {
    // Never let telemetry break the page that is already broken.
    console.error('client-error sink failed.', error && error.message);
  }

  return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
};
