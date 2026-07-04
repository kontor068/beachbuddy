const DEFAULT_TO = 'marismiltos@gmail.com';
const DEFAULT_FROM = 'CalmBeach Feedback <feedback@calmbeach.gr>';
const DEFAULT_SUBJECT_PREFIX = 'CalmBeach feedback';
const MAX_BODY_LENGTH = 12_000;

const splitEmailList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const clamp = (value, max = 180) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

const getConfig = () => ({
  apiKey: process.env.FEEDBACK_RESEND_API_KEY || process.env.RESEND_API_KEY || process.env.AUDIT_RESEND_API_KEY || '',
  from: process.env.FEEDBACK_EMAIL_FROM || process.env.AUDIT_EMAIL_FROM || DEFAULT_FROM,
  to: splitEmailList(process.env.FEEDBACK_EMAIL_TO || DEFAULT_TO),
  cc: splitEmailList(process.env.FEEDBACK_EMAIL_CC),
  bcc: splitEmailList(process.env.FEEDBACK_EMAIL_BCC),
  subjectPrefix: process.env.FEEDBACK_EMAIL_SUBJECT_PREFIX || DEFAULT_SUBJECT_PREFIX,
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

const formatVerdict = (value) => {
  const verdicts = {
    accurate: 'Accurate',
    not_accurate: 'Not accurate',
    had_waves: 'Had waves',
    too_windy: 'Too windy',
    calmer: 'Calmer than shown',
  };
  return verdicts[value] || clamp(value || 'Unknown feedback', 80);
};

const normalizePayload = (body, event) => {
  const feedback = body && typeof body === 'object' ? body : {};
  const conditions = feedback.conditions && typeof feedback.conditions === 'object' ? feedback.conditions : {};
  const context = feedback.context && typeof feedback.context === 'object' ? feedback.context : {};

  return {
    source: clamp(feedback.source || context.source || 'unknown', 80),
    beachId: Number.isFinite(Number(feedback.beachId)) ? Number(feedback.beachId) : undefined,
    feedback: clamp(feedback.feedback || feedback.verdict || 'unknown', 80),
    verdictLabel: formatVerdict(feedback.feedback || feedback.verdict),
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
  ['Verdict', payload.verdictLabel],
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

const formatText = (payload) => [
  'New CalmBeach feedback',
  '',
  ...fieldLines(payload).map(([label, value]) => `${label}: ${value}`),
  '',
  'This message contains structured feedback only. No exact user location or contact details are included.',
].join('\n');

const formatHtml = (payload) => {
  const rows = fieldLines(payload)
    .map(([label, value]) => (
      `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${escapeHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a">${escapeHtml(value)}</td></tr>`
    ))
    .join('');

  return [
    '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#0f172a">',
    '<h1 style="font-size:20px;margin:0 0 12px">New CalmBeach feedback</h1>',
    '<table style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">',
    rows,
    '</table>',
    '<p style="margin-top:16px;color:#64748b;font-size:13px">Structured feedback only. No exact user location or contact details are included.</p>',
    '</div>',
  ].join('');
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
  if (!config.apiKey || !config.from || config.to.length === 0) {
    console.error('Feedback email is not configured.', {
      hasApiKey: Boolean(config.apiKey),
      hasFrom: Boolean(config.from),
      hasTo: config.to.length > 0,
    });
    return json(503, { error: 'Feedback email is not configured.' });
  }

  const subjectParts = [
    config.subjectPrefix,
    payload.verdictLabel,
    payload.beachName || (payload.beachId ? `Beach #${payload.beachId}` : ''),
  ].filter(Boolean);

  const emailPayload = {
    from: config.from,
    to: config.to,
    subject: subjectParts.join(' - '),
    text: formatText(payload),
    html: formatHtml(payload),
  };
  if (config.cc.length > 0) emailPayload.cc = config.cc;
  if (config.bcc.length > 0) emailPayload.bcc = config.bcc;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });
  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('Feedback email failed.', {
      status: response.status,
      error: responseBody?.message || responseBody?.error,
    });
    return json(502, { error: 'Feedback email failed.' });
  }

  return json(202, { ok: true, id: responseBody?.id || null });
};
