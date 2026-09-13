// A short-lived pass that says "this photo belongs to a comment we just received".
//
// feedback-photo.mjs forwards images straight into the owner's Telegram chat. Without a
// pass, anyone who reads our JavaScript could point a script at it and fill that chat with
// whatever pictures they like — the origin check stops browsers on other sites, not curl.
// So feedback-email.mjs signs the Telegram message id of every beach comment it delivers,
// and the photo endpoint accepts a picture only with a valid, recent signature. Each photo
// therefore rides on a real comment, and comments are already rate-limited per visitor.
//
// Stateless on purpose: no store, no lookup, nothing to clean up. The cost is that one pass
// could be replayed within its lifetime — the per-IP limit in feedback-photo.mjs covers that.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Long enough to walk to the waterline and take the picture; short enough to be useless later. */
export const PHOTO_TOKEN_TTL_MS = 3 * 60 * 60 * 1000;

const signingKey = () => {
  const secret = process.env.FEEDBACK_PHOTO_SECRET
    || process.env.FEEDBACK_TELEGRAM_BOT_TOKEN
    || process.env.TELEGRAM_BOT_TOKEN
    || '';
  // Derived, never the raw bot token: a leaked signature must not say anything about it.
  return secret ? `calmbeach-feedback-photo:${secret}` : '';
};

const sign = (key, messageId, beachId, issuedAt) => createHmac('sha256', key)
  .update(`${messageId}.${beachId}.${issuedAt}`)
  .digest('hex')
  .slice(0, 32);

/** Null when there is nothing to sign with — the photo button then simply never appears. */
export const createPhotoToken = (messageId, beachId, now = Date.now()) => {
  const key = signingKey();
  if (!key || !Number.isInteger(messageId) || !Number.isFinite(beachId)) return null;
  const issuedAt = now.toString(36);
  return `${messageId}.${issuedAt}.${sign(key, messageId, beachId, issuedAt)}`;
};

/** The Telegram message id the photo should reply to, or null when the pass is not ours or has expired. */
export const readPhotoToken = (token, beachId, now = Date.now()) => {
  const key = signingKey();
  if (!key || typeof token !== 'string' || token.length > 120) return null;

  const [rawMessageId, issuedAt, signature] = token.split('.');
  const messageId = Number(rawMessageId);
  const issuedAtMs = parseInt(issuedAt, 36);
  if (!Number.isInteger(messageId) || !Number.isFinite(issuedAtMs) || !signature) return null;
  if (now - issuedAtMs > PHOTO_TOKEN_TTL_MS || issuedAtMs - now > 60_000) return null;

  const expected = Buffer.from(sign(key, messageId, beachId, issuedAt));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return messageId;
};
