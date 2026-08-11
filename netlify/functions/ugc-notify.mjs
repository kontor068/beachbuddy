// ─────────────────────────────────────────────────────────────────────────────
// "Someone just sent a photo" → Telegram.
//
// WHY THIS EXISTS. Moderation was a page you had to remember to visit. Nothing
// told you a photo had arrived, so the realistic outcome of asking 2.850 beaches
// worth of visitors for photos was a queue nobody opened for a week — and a
// contributor who was promised «θα τη δεις στην κάρτα» watching nothing happen.
//
// WHY IT CANNOT BE FORGED. The obvious version of this endpoint — "POST me a
// beach name and I'll message you" — is a free megaphone into your private chat
// for anyone who reads our JavaScript. So nothing in the request body is
// trusted. The caller sends only a photo id and their own Supabase access
// token; this function asks Supabase who that token belongs to, reads the row
// with the service key, and refuses unless the row exists AND belongs to that
// user AND is still pending. Every message it sends therefore corresponds to a
// real upload that a real signed-in person really made.
//
// WHY IT NEVER FAILS THE UPLOAD. The photo is already safely in the queue by the
// time this is called. A missing bot token, a Telegram outage, a rate limit —
// none of it may reach the visitor, who did nothing wrong and would only be
// confused by "your photo was sent but the notification failed". Every path
// answers 204.
//
// The approve/reject buttons are deliberately NOT here: the queue page is one
// tap away in the message, and a webhook that mutates data from a chat message
// is a much larger security surface than a link.
// ─────────────────────────────────────────────────────────────────────────────

import { beachLabel, getSupabaseConfig, isConfigured, signPendingPhoto } from './lib/ugcModeration.mjs';

const noContent = { statusCode: 204, body: '' };

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

// Origin beats Referer: a browser always sends Origin on a cross-origin POST,
// and Referer can be suppressed by a referrer policy. Same rule as pageview.mjs.
const isTrustedOrigin = (headers = {}) => {
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  if (origin) return isOwnHost(hostOf(origin));
  if (referer) return isOwnHost(hostOf(referer));
  return false;
};

const telegram = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** Who does this access token belong to? Supabase is the only authority on that. */
const userIdFromToken = async (token) => {
  const { url, serviceKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return '';
  const body = await response.json().catch(() => null);
  return body?.id || '';
};

const readPendingPhoto = async (photoId) => {
  const { url, serviceKey } = getSupabaseConfig();
  const query = `beach_photos?id=eq.${encodeURIComponent(photoId)}`
    + '&select=id,user_id,beach_id,region_id,caption,status,storage_path,show_credit';
  const response = await fetch(`${url}/rest/v1/${query}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return noContent;
  if (!isTrustedOrigin(event.headers || {})) return noContent;
  if (!isConfigured()) return noContent;

  const { botToken, chatId } = telegram();
  if (!botToken || !chatId) return noContent;

  try {
    const payload = JSON.parse(event.body || '{}');
    const photoId = String(payload.photoId || '').trim();
    // A UUID and nothing else — the id goes into a URL, so it is validated by
    // shape rather than escaped and hoped for.
    if (!/^[0-9a-f-]{36}$/i.test(photoId)) return noContent;

    const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return noContent;

    const userId = await userIdFromToken(token);
    if (!userId) return noContent;

    const photo = await readPendingPhoto(photoId);
    // The three checks that make a forged notification impossible.
    if (!photo || photo.user_id !== userId || photo.status !== 'pending') return noContent;

    // The admin console is one page now (the traffic dashboard, photos tab), so
    // that is where the link goes. The old standalone queue stays as the fallback
    // for as long as it has a key and the console does not — nobody should get a
    // notification whose link leads to a 403.
    const trafficKey = process.env.TRAFFIC_STATS_KEY || '';
    const adminKey = process.env.UGC_ADMIN_KEY || '';
    const queueUrl = trafficKey
      ? `https://calmbeach.gr/api/traffic?key=${encodeURIComponent(trafficKey)}&tab=photos`
      : (adminKey
        ? `https://calmbeach.gr/api/ugc-admin?key=${encodeURIComponent(adminKey)}`
        : 'https://calmbeach.gr/api/ugc-admin');

    // The name, not just the id: "1352" is not something you can judge a photo
    // against. Best-effort — beachLabel falls back to the id if the lookup fails.
    const beachName = await beachLabel(photo.region_id, photo.beach_id).catch(() => `Παραλία #${photo.beach_id}`);

    const lines = [
      '📸 <b>Νέα φωτογραφία παραλίας</b>',
      `${escapeHtml(beachName)} — ${escapeHtml(photo.region_id)}`,
    ];
    if (photo.caption) lines.push(`Λεζάντα: ${escapeHtml(photo.caption)}`);
    if (photo.show_credit === false) lines.push('<i>Ο χρήστης ΔΕΝ θέλει να φαίνεται το όνομά του.</i>');
    lines.push(`\n<a href="${escapeHtml(queueUrl)}">Άνοιγμα κονσόλας διαχείρισης</a>`);

    // A one-hour signed URL so the photo itself is visible in the chat without
    // the bucket ever being public. If signing fails, still send the text — the
    // point of the message is "go and look", not the thumbnail.
    let preview = '';
    try {
      preview = await signPendingPhoto(photo.storage_path, 3600);
    } catch {
      /* text-only message is still worth sending */
    }

    // TWO BUTTONS, so the decision happens where the notification lands.
    // Without them the message is only a reminder to open a page later, and
    // "later" is exactly how a moderation queue becomes a week old — which is
    // the failure this function was written to prevent in the first place.
    //
    // The tap goes to netlify/functions/telegram-webhook.mjs, which checks
    // Telegram's secret_token AND that the presser is our own chat id before
    // touching anything, then calls the same lib/ugcModeration.mjs the admin
    // page uses. callback_data is capped at 64 bytes, hence the terse shape:
    // kind initial, uuid, action initial — `p:<uuid>:a` = approve this photo.
    const replyMarkup = {
      inline_keyboard: [[
        { text: '✅ Δημοσίευση', callback_data: `p:${photo.id}:a` },
        { text: '🚫 Απόρριψη', callback_data: `p:${photo.id}:r` },
      ]],
    };

    const endpoint = preview ? 'sendPhoto' : 'sendMessage';
    const body = preview
      ? { chat_id: chatId, photo: preview, caption: lines.join('\n'), parse_mode: 'HTML', reply_markup: replyMarkup }
      : { chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: replyMarkup };

    await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Logged for us, invisible to the visitor: their photo is already queued.
    console.error('UGC notification failed.', error);
  }

  return noContent;
};

export default handler;
