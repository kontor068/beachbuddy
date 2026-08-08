// ─────────────────────────────────────────────────────────────────────────────
// "SOMEONE SENT A PHOTO" → Telegram, with two buttons.
//
// Fired by a Supabase Database Webhook on INSERT into beach_photos / reviews
// (Dashboard → Database → Webhooks → HTTP Request to https://calmbeach.gr/api/ugc-hook,
// with the header x-calmbeach-ugc-secret set to UGC_WEBHOOK_SECRET).
//
// WHY PUSH AND NOT A DASHBOARD. Moderation only works if it happens the same
// day. A queue you have to remember to open is a queue that fills up, and a
// visitor whose photo sat unreviewed for a week does not send a second one.
// This turns the whole job into one tap in a chat that is already on the phone.
//
// THE IMAGE IS SENT WITH A ONE-HOUR SIGNED URL. Telegram fetches it immediately
// and keeps its own copy, so the private bucket never opens and the link is dead
// long before the message is scrolled past.
// ─────────────────────────────────────────────────────────────────────────────

import { getItem, isConfigured, signPendingPhoto } from './lib/ugcModeration.mjs';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const telegram = () => ({
  token: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const send = async (method, payload) => {
  const { token } = telegram();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) {
    console.error(`Telegram ${method} failed.`, body?.description || response.status);
    return false;
  }
  return true;
};

/**
 * callback_data is capped at 64 bytes by Telegram, so the shape is deliberately
 * terse: kind initial, uuid, action initial. `p:<uuid>:a` = approve this photo.
 */
const buttons = (kind, id) => ({
  inline_keyboard: [[
    { text: '✅ Δημοσίευση', callback_data: `${kind[0]}:${id}:a` },
    { text: '🚫 Απόρριψη', callback_data: `${kind[0]}:${id}:r` },
  ]],
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const secret = process.env.UGC_WEBHOOK_SECRET || '';
  const headers = event.headers || {};
  const given = headers['x-calmbeach-ugc-secret'] || headers['X-Calmbeach-Ugc-Secret'] || '';
  // Unset secret ⇒ closed, never open. An unauthenticated endpoint here would let
  // anyone make our phone buzz, and worse, name any row id they liked.
  if (!secret || given !== secret) return json(403, { error: 'Forbidden.' });

  if (!isConfigured()) return json(503, { error: 'Supabase is not configured.' });
  const { token, chatId } = telegram();
  if (!token || !chatId) return json(503, { error: 'Telegram is not configured.' });

  let payload;
  try {
    payload = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    return json(400, { error: 'Invalid JSON.' });
  }

  const table = payload?.table || '';
  const row = payload?.record || payload?.new || null;
  if (!row?.id) return json(400, { error: 'No row in the webhook payload.' });

  const kind = table === 'beach_photos' ? 'photo' : table === 'reviews' ? 'review' : null;
  if (!kind) return json(200, { ok: true, ignored: table });

  // Re-read through the service role rather than trusting the webhook body: the
  // body is whatever was POSTed to us, and everything below is about to be shown
  // and acted on.
  const item = await getItem(kind, row.id).catch(() => null);
  if (!item) return json(404, { error: 'Row not found.' });
  if (item.status !== 'pending') return json(200, { ok: true, skipped: item.status });

  const where = `${escapeHtml(item.region_id)} #${escapeHtml(item.beach_id)}`;

  if (kind === 'photo') {
    let photoUrl = '';
    try {
      photoUrl = await signPendingPhoto(item.storage_path, 3600);
    } catch (error) {
      console.error('Could not sign the pending photo.', error && error.message);
    }

    const caption = [
      '📸 <b>Νέα φωτογραφία επισκέπτη</b>',
      `<b>Παραλία:</b> ${where}`,
      item.bytes ? `<b>Μέγεθος:</b> ${Math.round(item.bytes / 1024)} KB` : '',
      item.width && item.height ? `<b>Διαστάσεις:</b> ${item.width}×${item.height}` : '',
      item.show_credit === false ? '<b>Όνομα:</b> ΟΧΙ (ζήτησε ανώνυμη)' : '<b>Όνομα:</b> ναι',
      item.caption ? `\n${escapeHtml(item.caption)}` : '',
    ].filter(Boolean).join('\n');

    const sent = photoUrl
      ? await send('sendPhoto', { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', reply_markup: buttons(kind, item.id) })
      : false;

    // A photo we cannot show is still a photo that needs a decision — fall back
    // to text rather than dropping it silently.
    if (!sent) {
      await send('sendMessage', {
        chat_id: chatId,
        text: `${caption}\n\n(η προεπισκόπηση δεν φορτώθηκε — κρίνε την από τη σελίδα διαχείρισης)`,
        parse_mode: 'HTML',
        reply_markup: buttons(kind, item.id),
      });
    }
    return json(202, { ok: true });
  }

  const stars = '★'.repeat(Math.max(0, Math.min(5, Number(item.rating) || 0)));
  await send('sendMessage', {
    chat_id: chatId,
    text: [
      '💬 <b>Νέα κριτική επισκέπτη</b>',
      `<b>Παραλία:</b> ${where}`,
      `<b>Βαθμολογία:</b> ${stars}`,
      item.body ? `\n${escapeHtml(item.body)}` : '',
    ].filter(Boolean).join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: buttons(kind, item.id),
  });

  return json(202, { ok: true });
};
