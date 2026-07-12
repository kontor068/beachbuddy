// Delivers structured "how was it really?" feedback to a Telegram chat as an instant
// push notification. Zero cost: Telegram Bot API is free and unmetered for this volume,
// and no email domain/DNS setup is required. The client still POSTs to this same endpoint
// (/.netlify/functions/feedback-email); only the delivery channel changed from email.
const MAX_BODY_LENGTH = 12_000;
const MAX_MESSAGE_LENGTH = 3_800; // Telegram hard limit is 4096; leave headroom.

const clamp = (value, max = 180) => String(value ?? '')
  .replace(/\s+/g, ' ')
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
  ['Beach', payload.beachName || (payload.beachId ? `#${payload.beachId}` : 'Unknown')],
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
  return [header, '', rows].join('\n').slice(0, MAX_MESSAGE_LENGTH);
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let payload;
  try {
    payload = normalizePayload(parseBody(event), event);
  } catch (error) {
    return json(error.statusCode || 400, { error: error.message || 'Invalid feedback payload.' });
  }

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
