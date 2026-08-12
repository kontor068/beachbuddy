// ─────────────────────────────────────────────────────────────────────────────
// UGC MODERATION — the single implementation of "publish this" / "throw it away".
//
// Both entry points call ONLY this module:
//   • ugc-admin.mjs        a key-gated HTML page (works today, no setup)
//   • telegram-webhook.mjs one tap on the phone (added later, same code path)
//
// Two entry points and one implementation is the point: an approval that behaves
// differently depending on which button was pressed is how unapproved content ends
// up on a crawled page.
//
// WHAT APPROVAL ACTUALLY DOES, and why it is shaped this way:
//   1. Copies the file from the PRIVATE bucket into the PUBLIC one. Static HTML
//      cannot carry a signed URL — signed URLs expire, and a page baked with one
//      would serve a dead image days later. A public bucket path is permanent.
//   2. Stamps the row approved + public_path.
//   3. Republishes the live photo index into the same public bucket, so the photo
//      appears on the running site within a minute. See ugcPhotoIndex.mjs.
//   4. Raises a flag in Netlify Blobs. It does NOT trigger a rebuild. Builds cost
//      Netlify build minutes (a limited free allowance), so publication is batched
//      by a scheduled check — see scripts/ and the publish-check function.
//
// STEPS 3 AND 4 ARE NOT ALTERNATIVES, and the difference is the whole reason both
// exist. Step 3 reaches the app a visitor is running: it fetches the index and
// renders the photo, no deploy involved. Step 4 reaches the STATIC HTML — the
// prerendered pages, the social preview image, everything Google reads — and that
// genuinely needs a build. So an approval is visible to people immediately and to
// crawlers at the next build, and the flag is what says a build is still owed.
//
// REJECTION DELETES THE FILE. There is no reason to pay storage for a photo we
// have decided never to show, and a rejected upload is often exactly the kind of
// content we should not be holding onto.
//
// The service-role key bypasses RLS by design. It exists ONLY in the Netlify
// function environment: it must never be VITE_-prefixed and never reach a bundle
// (scripts/validateBundleSecrets.mjs fails the build if it ever does).
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';

import { refreshApprovedPhotoIndex } from './ugcPhotoIndex.mjs';

export const UGC_STORE = 'ugc';
/** Set when there is approved content the live site has not baked yet. */
export const PENDING_PUBLISH_KEY = 'pending-publish';

const PRIVATE_BUCKET = 'beach-photos';
const PUBLIC_BUCKET = 'beach-photos-public';

/** Photos and reviews are the same workflow with a different table. */
const KINDS = {
  photo: { table: 'beach_photos', hasFile: true },
  review: { table: 'reviews', hasFile: false },
};

export const isKnownKind = (kind) => Object.prototype.hasOwnProperty.call(KINDS, kind);

export const getSupabaseConfig = () => ({
  url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
});

export const isConfigured = () => {
  const { url, serviceKey } = getSupabaseConfig();
  return Boolean(url && serviceKey);
};

const authHeaders = () => {
  const { serviceKey } = getSupabaseConfig();
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
};

/** Throw with the response body attached — a 400 from PostgREST says exactly what broke. */
const failed = async (label, response) => {
  const detail = await response.text().catch(() => '');
  const error = new Error(`${label} failed (${response.status}): ${detail.slice(0, 300)}`);
  error.statusCode = response.status;
  return error;
};

// ── Netlify Blobs: the "something is waiting to be published" flag ────────────
// Best-effort on purpose. If Blobs is unavailable the approval itself must still
// succeed — the worst case is that publication waits for the next code push,
// which is the normal path anyway.

export const markPendingPublish = async (event, info = {}) => {
  try {
    connectLambda(event);
    const store = getStore(UGC_STORE);
    const current = (await store.get(PENDING_PUBLISH_KEY, { type: 'json' })) || {};
    await store.setJSON(PENDING_PUBLISH_KEY, {
      count: Number(current.count || 0) + 1,
      firstAt: current.firstAt || new Date().toISOString(),
      lastAt: new Date().toISOString(),
      ...info,
    });
  } catch (error) {
    console.error('Could not raise the UGC publish flag.', error && error.message);
  }
};

export const readPendingPublish = async (event) => {
  try {
    connectLambda(event);
    return (await getStore(UGC_STORE).get(PENDING_PUBLISH_KEY, { type: 'json' })) || null;
  } catch (error) {
    console.error('Could not read the UGC publish flag.', error && error.message);
    return null;
  }
};

export const clearPendingPublish = async (event) => {
  try {
    connectLambda(event);
    await getStore(UGC_STORE).delete(PENDING_PUBLISH_KEY);
    return true;
  } catch (error) {
    console.error('Could not clear the UGC publish flag.', error && error.message);
    return false;
  }
};

// ── Reading the queue ────────────────────────────────────────────────────────

/** Pending items, oldest first — the order a human should work through them. */
export const listPending = async (kind, limit = 40) => {
  const config = KINDS[kind];
  if (!config) throw new Error(`Unknown UGC kind: ${kind}`);
  const { url } = getSupabaseConfig();

  const query = new URLSearchParams({
    status: 'eq.pending',
    select: '*',
    order: 'created_at.asc',
    limit: String(Math.min(Math.max(1, limit), 100)),
  });
  const response = await fetch(`${url}/rest/v1/${config.table}?${query}`, { headers: authHeaders() });
  if (!response.ok) throw await failed(`Listing pending ${kind}s`, response);
  return response.json();
};

export const getItem = async (kind, id) => {
  const config = KINDS[kind];
  if (!config) throw new Error(`Unknown UGC kind: ${kind}`);
  const { url } = getSupabaseConfig();

  const query = new URLSearchParams({ id: `eq.${id}`, select: '*', limit: '1' });
  const response = await fetch(`${url}/rest/v1/${config.table}?${query}`, { headers: authHeaders() });
  if (!response.ok) throw await failed(`Reading ${kind} ${id}`, response);
  const rows = await response.json();
  return rows[0] || null;
};

const patchItem = async (kind, id, patch) => {
  const config = KINDS[kind];
  const { url } = getSupabaseConfig();
  const query = new URLSearchParams({ id: `eq.${id}` });
  const response = await fetch(`${url}/rest/v1/${config.table}?${query}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await failed(`Updating ${kind} ${id}`, response);
  const rows = await response.json();
  return rows[0] || null;
};

// ── Which beach is this, in words ────────────────────────────────────────────
// The tables store (region_id, beach_id) because that pair is the only stable
// identifier — ids are unique per region, not nationally. But "Παραλία #1352" is
// not something a human can approve: judging whether a photo belongs to a beach
// needs the beach's name. The names live in the site's own published data, which
// is on the same deploy as this function, so one fetch per region resolves them.
//
// Best-effort by design: a failed lookup falls back to the id and nothing breaks.
// A moderation queue that refuses to render because a label is missing would be a
// far worse outcome than a queue that shows a number.
const beachNameCache = new Map();

const siteOrigin = () => (process.env.URL || process.env.DEPLOY_URL || 'https://calmbeach.gr').replace(/\/$/, '');

// The PROMISE is cached, not the result. Ten pending photos from one region are
// labelled concurrently, so caching only on completion would fire ten identical
// fetches before the first one returned.
const regionBeachNames = (regionId) => {
  if (!regionId) return Promise.resolve(null);
  if (beachNameCache.has(regionId)) return beachNameCache.get(regionId);

  const pending = (async () => {
    try {
      const response = await fetch(`${siteOrigin()}/data/beaches/${encodeURIComponent(regionId)}.json`);
      if (!response.ok) return null;
      const list = await response.json();
      return new Map((Array.isArray(list) ? list : []).map((b) => [String(b.id), b.name]));
    } catch {
      /* offline, renamed region, bad deploy — the id is still a usable label */
      return null;
    }
  })();

  // Cached even when it resolves to null, so a region with no file is not
  // re-fetched on every card of every render.
  beachNameCache.set(regionId, pending);
  return pending;
};

/** "Παραλία Βαγίας" when we can resolve it, "Παραλία #80" when we cannot. */
export const beachLabel = async (regionId, beachId) => {
  const names = await regionBeachNames(regionId);
  return names?.get(String(beachId)) || `Παραλία #${beachId}`;
};

/** One pass over a queue, resolving every label with at most one fetch per region. */
export const withBeachLabels = async (items = []) => Promise.all(
  items.map(async (item) => ({ ...item, beach_name: await beachLabel(item.region_id, item.beach_id) }))
);

// ── Storage ──────────────────────────────────────────────────────────────────

/**
 * A short-lived URL for a PENDING photo, so a moderator (or Telegram) can see what
 * they are judging without the bucket ever being public. Telegram fetches the image
 * once and keeps its own copy, so an hour is plenty.
 */
export const signPendingPhoto = async (storagePath, expiresIn = 3600) => {
  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/sign/${PRIVATE_BUCKET}/${encodeURI(storagePath)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw await failed('Signing a pending photo', response);
  const body = await response.json();
  // PostgREST returns a path like "/object/sign/bucket/key?token=…"
  return `${url}/storage/v1${body.signedURL || body.signedUrl || ''}`;
};

/** The permanent, cacheable URL of an APPROVED photo. */
export const publicPhotoUrl = (publicPath) => {
  const { url } = getSupabaseConfig();
  if (!url || !publicPath) return '';
  return `${url}/storage/v1/object/public/${PUBLIC_BUCKET}/${encodeURI(publicPath)}`;
};

const copyToPublicBucket = async (storagePath, contentType = 'image/webp') => {
  const { url } = getSupabaseConfig();

  const source = await fetch(`${url}/storage/v1/object/${PRIVATE_BUCKET}/${encodeURI(storagePath)}`, {
    headers: authHeaders(),
  });
  if (!source.ok) throw await failed('Downloading the pending photo', source);
  const bytes = Buffer.from(await source.arrayBuffer());

  // Same key in both buckets: one path to reason about, and re-approving after a
  // failed attempt overwrites rather than piling up orphans (hence upsert).
  const upload = await fetch(`${url}/storage/v1/object/${PUBLIC_BUCKET}/${encodeURI(storagePath)}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': source.headers.get('content-type') || contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!upload.ok) throw await failed('Publishing the photo', upload);

  return storagePath;
};

const deleteFromBucket = async (bucket, storagePath) => {
  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/${bucket}/${encodeURI(storagePath)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  // A missing object is a fine outcome for a delete — do not fail the moderation.
  if (!response.ok && response.status !== 404) {
    console.error(`Could not delete ${bucket}/${storagePath}: ${response.status}`);
    return false;
  }
  return true;
};

// ── The decision ─────────────────────────────────────────────────────────────

/**
 * Approve or reject one item. Idempotent: acting twice on the same id is safe and
 * reports `alreadyDone`, because a Telegram button can be tapped twice and a page
 * can be refreshed.
 *
 * @param {object} args
 * @param {'photo'|'review'} args.kind
 * @param {string} args.id
 * @param {'approve'|'reject'} args.action
 * @param {object} args.event  the Lambda event (needed to reach Netlify Blobs)
 */
export const moderate = async ({ kind, id, action, event }) => {
  if (!isKnownKind(kind)) throw new Error(`Unknown UGC kind: ${kind}`);
  if (action !== 'approve' && action !== 'reject') throw new Error(`Unknown action: ${action}`);
  if (!isConfigured()) {
    const error = new Error('Supabase is not configured for moderation.');
    error.statusCode = 503;
    throw error;
  }

  const item = await getItem(kind, id);
  if (!item) {
    const error = new Error(`No ${kind} with id ${id}.`);
    error.statusCode = 404;
    throw error;
  }

  const target = action === 'approve' ? 'approved' : 'rejected';
  if (item.status === target) {
    return { ok: true, alreadyDone: true, kind, id, status: item.status, item };
  }

  if (action === 'reject') {
    // Delete the bytes first: if the PATCH then fails the row stays pending and a
    // retry is harmless, whereas the reverse order could leave a "rejected" row
    // whose file we still pay for and still hold.
    const rejection = { status: 'rejected', approved_at: null };
    if (KINDS[kind].hasFile) {
      if (item.storage_path) await deleteFromBucket(PRIVATE_BUCKET, item.storage_path);
      if (item.public_path) await deleteFromBucket(PUBLIC_BUCKET, item.public_path);
      // `public_path` only exists on beach_photos — sending it for a review is a 400.
      rejection.public_path = null;
    }
    const updated = await patchItem(kind, id, rejection);
    // Un-publishing something that WAS live has to reach the static pages too.
    let live = null;
    if (item.status === 'approved') {
      await markPendingPublish(event, { lastKind: kind, lastId: id, removal: true });
      // …and it has to leave the running site FIRST. Taking a photo down is the
      // urgent direction of this pipeline: a photo we have decided not to show is
      // usually one we should stop showing now, not at the next build.
      if (kind === 'photo') live = await refreshApprovedPhotoIndex(getSupabaseConfig());
    }
    return { ok: true, kind, id, status: 'rejected', item: updated || item, live };
  }

  const patch = { status: 'approved', approved_at: new Date().toISOString() };
  if (KINDS[kind].hasFile) {
    if (!item.storage_path) {
      const error = new Error(`Photo ${id} has no stored file.`);
      error.statusCode = 409;
      throw error;
    }
    patch.public_path = await copyToPublicBucket(item.storage_path);
  }

  const updated = await patchItem(kind, id, patch);
  await markPendingPublish(event, { lastKind: kind, lastId: id });

  // Live publication, after the row is committed and never before it: the index
  // is built by re-reading the approved rows, so publishing it earlier would
  // upload a map that does not yet contain the photo we just approved.
  const live = kind === 'photo' ? await refreshApprovedPhotoIndex(getSupabaseConfig()) : null;

  return { ok: true, kind, id, status: 'approved', item: updated || { ...item, ...patch }, live };
};
