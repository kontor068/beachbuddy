// ─────────────────────────────────────────────────────────────────────────────
// THE TAP. Telegram calls this when one of the two buttons is pressed.
//
// Register once, by hand:
//   curl -F url=https://calmbeach.gr/api/telegram-hook \
//        -F secret_token=<TELEGRAM_WEBHOOK_SECRET> \
//        -F allowed_updates='["callback_query"]' \
//        https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
//
// TWO GATES, NOT ONE.
//   1. Telegram signs every delivery with the secret_token header we registered.
//   2. The presser must be OUR chat id.
// Either alone is thin: the secret can leak into a log, and a chat id is public
// knowledge. Together, a stranger needs both our secret and our Telegram
// account to publish anything on the site. Given the button publishes
// user-generated content to a crawled page, one gate was not enough.
//
// ANSWER FAST. Telegram spins the button until answerCallbackQuery arrives and
// gives up after ~10 seconds, so the acknowledgement is sent as soon as the
// outcome is known, and the message caption is stamped afterwards.
// ─────────────────────────────────────────────────────────────────────────────

import { isKnownKind, moderate } from './lib/ugcModeration.mjs';

const ok = () => ({ statusCode: 200, headers: { 'Cache-Control': 'no-store' }, body: 'ok' });
const deny = () => ({ statusCode: 403, headers: { 'Cache-Control': 'no-store' }, body: 'Forbidden' });

const telegram = () => ({
  token: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const call = async (method, payload) => {
  const { token } = telegram();
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) console.error(`Telegram ${method} returned ${response.status}`);
  } catch (error) {
    console.error(`Telegram ${method} threw.`, error && error.message);
  }
};

/** `p:<uuid>:a` → { kind: 'photo', id, action: 'approve' } */
const parseCallback = (data) => {
  const parts = String(data || '').split(':');
  if (parts.length !== 3) return null;
  const [kindInitial, id, actionInitial] = parts;
  const kind = kindInitial === 'p' ? 'photo' : kindInitial === 'r' ? 'review' : null;
  const action = actionInitial === 'a' ? 'approve' : actionInitial === 'r' ? 'reject' : null;
  if (!kind || !action || !isKnownKind(kind) || !id) return null;
  return { kind, id, action };
};

const athensStamp = () => new Intl.DateTimeFormat('el-GR', {
  timeZone: 'Europe/Athens',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return deny();

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const headers = event.headers || {};
  const given = headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token'] || '';
  if (!secret || given !== secret) return deny();

  let update;
  try {
    update = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    return ok(); // Never make Telegram retry a message we cannot read.
  }

  const query = update?.callback_query;
  if (!query) return ok();

  // Gate 2: the person pressing must be the account we send to.
  const { chatId } = telegram();
  if (chatId && String(query.from?.id || '') !== String(chatId)) {
    console.error('Callback from an unexpected Telegram account was refused.');
    await call('answerCallbackQuery', { callback_query_id: query.id, text: 'Not allowed.', show_alert: true });
    return ok();
  }

  const parsed = parseCallback(query.data);
  if (!parsed) {
    await call('answerCallbackQuery', { callback_query_id: query.id, text: 'Δεν κατάλαβα το κουμπί.' });
    return ok();
  }

  let notice;
  try {
    const result = await moderate({ ...parsed, action: parsed.action, event });
    // «Δημοσιεύεται» used to mean "queued for the next build". It now means the
    // photo is on the site, so the stamp says which — a one-tap approval from a
    // phone is exactly the moment you want to know whether it is actually up.
    notice = result.alreadyDone
      ? 'Είχε ήδη κριθεί.'
      : (result.status === 'approved'
        ? (result.live?.ok ? '✅ Μπήκε στο site' : '✅ Εγκρίθηκε (μπαίνει στο επόμενο χτίσιμο)')
        : '🚫 Απορρίφθηκε');
  } catch (error) {
    console.error('Moderation from Telegram failed.', error && error.message);
    notice = 'Κάτι πήγε στραβά. Δοκίμασε από τη σελίδα διαχείρισης.';
  }

  await call('answerCallbackQuery', { callback_query_id: query.id, text: notice });

  // Stamp the message so a second tap is obviously pointless, and so the chat
  // is a readable log of what was decided rather than a wall of live buttons.
  const message = query.message;
  if (message?.chat?.id && message?.message_id) {
    const stamp = `\n\n— ${notice} ${athensStamp()}`;
    const method = message.photo ? 'editMessageCaption' : 'editMessageText';
    const field = message.photo ? 'caption' : 'text';
    await call(method, {
      chat_id: message.chat.id,
      message_id: message.message_id,
      [field]: `${(message.caption || message.text || '').slice(0, 900)}${stamp}`,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] },
    });
  }

  return ok();
};
