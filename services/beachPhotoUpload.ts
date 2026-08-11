// ─────────────────────────────────────────────────────────────────────────────
// A photo on someone's phone → a row in the moderation queue.
//
// The back half of this pipeline already existed before any of it could be
// reached: supabase/migrations/0001 creates `beach_photos` and the PRIVATE
// `beach-photos` bucket, 0002 adds the public bucket and the storage policies,
// and netlify/functions/ugc-admin.mjs is where a human approves and publishes.
// This file is the missing front half — and it is the ONLY place that knows how
// a raw camera file becomes something we are willing to store.
//
// FOUR THINGS IT ENFORCES, none of which the UI should have to think about:
//
// 1. NOTHING RAW IS EVER UPLOADED. A modern phone photo is 4-12 MB; the table
//    rejects anything over 600 KB (`bytes` check) precisely so nobody can turn
//    our storage bill into their backup drive. Every file is decoded, scaled to
//    a long edge of 1600px and re-encoded as JPEG until it fits.
//
// 2. EXIF DIES HERE, AND THAT IS THE POINT. Re-encoding through a canvas drops
//    every metadata block — including the GPS tag that, on a photo taken at
//    home rather than at the beach, is the uploader's home address. We publish
//    approved photos on crawlable pages, so stripping location is not a nicety.
//
// 3. NO ORPHANS IN EITHER DIRECTION. The object is uploaded first, then the
//    row. If the row fails (quota trigger, RLS, network) the object is deleted
//    again — otherwise a rejected upload would sit in the bucket forever with
//    nothing pointing at it and no moderator ever seeing it.
//
// 4. FAILURES COME BACK AS SENTENCES. Postgres says 'photo upload quota
//    reached' and PostgREST says '42501'; a visitor needs "you have reached the
//    limit" and "sign in again". The mapping lives here so every caller,
//    present and future, reports the same thing.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from './supabaseClient';
import { signInAsGuest } from './authService';

/** The DB check is `bytes <= 600000`. Aim under it — never AT it. */
const MAX_UPLOAD_BYTES = 550_000;
/** Long edge. Card thumbnails are ~600px wide; this survives a retina hero too. */
const MAX_EDGE_PX = 1600;
/** Below this the picture is not worth publishing, whatever the file size says. */
const MIN_EDGE_PX = 480;
/** Refuse to even decode something this large — it is not a photo, it is a mistake. */
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

const PHOTO_BUCKET = 'beach-photos';

export type PreparedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  /** Object URL for the preview. The caller MUST revoke it (see releasePreparedPhoto). */
  previewUrl: string;
};

export type PhotoUploadFailure =
  /** The file is not an image, or is an image nothing here can decode (HEIC on Android). */
  | 'unreadable'
  /** Decoded fine but is too small to be worth publishing. */
  | 'too-small'
  /** Signed out, or the session expired between opening the form and sending. */
  | 'not-signed-in'
  /**
   * Guest uploads are switched off in the Supabase project, so there is no way
   * through except a real account. Distinct from 'not-signed-in' because the
   * visitor never claimed to be signed in — the answer is an invitation, not
   * "your session expired".
   */
  | 'sign-in-required'
  /** The per-user cap in the quota trigger. */
  | 'quota'
  /** Network, storage, or anything else we did not anticipate. */
  | 'failed';

// STRING discriminants, not an `ok: boolean`. This project compiles without
// `strictNullChecks`, and under that setting TypeScript will not narrow a union
// on a true/false discriminant — `if (!result.ok)` type-checks as if nothing
// happened and every field access below it is an error. A string tag narrows
// under any configuration.
export type PhotoPrepareResult =
  | { status: 'ready'; photo: PreparedPhoto }
  | { status: 'error'; reason: PhotoUploadFailure };

export type PhotoUploadResult =
  | { status: 'ok'; photoId: string }
  | { status: 'error'; reason: PhotoUploadFailure };

export const releasePreparedPhoto = (prepared: PreparedPhoto | null): void => {
  if (!prepared) return;
  try {
    URL.revokeObjectURL(prepared.previewUrl);
  } catch {
    /* already revoked, or a browser that never minted one */
  }
};

/**
 * Decode whatever the file picker handed us.
 *
 * createImageBitmap is the fast path and the only one that decodes off the main
 * thread — on a mid-range Android, decoding a 12MP JPEG inline freezes the tap
 * that started it. The <img> fallback exists for Safari versions whose
 * createImageBitmap chokes on the very HEIC-converted JPEGs iOS produces.
 */
const decodeImage = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path */
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image could not be decoded'));
    };
    img.src = url;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality));

/**
 * Scale + re-encode until the result fits, or give up honestly.
 *
 * Quality is stepped down first because it is nearly free visually between 0.82
 * and 0.62; only when even 0.62 will not fit does the long edge shrink. A photo
 * that cannot be squeezed under the cap at 800px does not exist in practice —
 * the loop is bounded anyway so a pathological input cannot spin forever.
 */
export const prepareBeachPhoto = async (
  file: File,
): Promise<PhotoPrepareResult> => {
  if (!file.type.startsWith('image/') || file.size > MAX_INPUT_BYTES) {
    return { status: 'error', reason: 'unreadable' };
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decodeImage(file);
  } catch {
    return { status: 'error', reason: 'unreadable' };
  }

  const naturalWidth = 'width' in source ? source.width : 0;
  const naturalHeight = 'height' in source ? source.height : 0;
  if (!naturalWidth || !naturalHeight) return { status: 'error', reason: 'unreadable' };
  if (Math.max(naturalWidth, naturalHeight) < MIN_EDGE_PX) {
    if ('close' in source) source.close();
    return { status: 'error', reason: 'too-small' };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    if ('close' in source) source.close();
    return { status: 'error', reason: 'unreadable' };
  }

  let maxEdge = MAX_EDGE_PX;
  let encoded: Blob | null = null;
  let width = 0;
  let height = 0;

  // Two shrink attempts on top of the quality ramp: 1600 → 1200 → 900.
  for (let attempt = 0; attempt < 3 && !encoded; attempt += 1) {
    const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
    width = Math.max(1, Math.round(naturalWidth * scale));
    height = Math.max(1, Math.round(naturalHeight * scale));

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(source as CanvasImageSource, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62]) {
      // eslint-disable-next-line no-await-in-loop -- each attempt depends on the last one's size
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        encoded = blob;
        break;
      }
    }

    maxEdge = Math.round(maxEdge * 0.75);
  }

  if ('close' in source) source.close();
  if (!encoded) return { status: 'error', reason: 'unreadable' };

  return {
    status: 'ready',
    photo: { blob: encoded, width, height, previewUrl: URL.createObjectURL(encoded) },
  };
};

/**
 * A collision-proof name inside the user's own folder.
 *
 * The folder prefix is not decoration: the storage policy in 0002 is
 * `(storage.foldername(name))[1] = auth.uid()::text`, so a path that does not
 * start with the uid is rejected by the database, not by us.
 */
const buildStoragePath = (userId: string, beachId: number): string => {
  const random = Math.random().toString(36).slice(2, 10);
  // athens-clock-exempt: a filename component, never read back as a date and
  // never compared to Greek local time.
  const stamp = Date.now().toString(36);
  return `${userId}/${beachId}-${stamp}-${random}.jpg`;
};

/**
 * "That column does not exist" — PostgREST's schema-cache error (PGRST204), plus
 * the raw Postgres wording, because which one comes back depends on whether the
 * cache or the database noticed first.
 */
const isMissingCreditColumn = (error: { message?: string; code?: string }): boolean => {
  const text = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return text.includes('show_credit')
    && (text.includes('pgrst204') || text.includes('column') || text.includes('schema cache'));
};

const classifyError = (message: string, code?: string): PhotoUploadFailure => {
  const text = `${message} ${code || ''}`.toLowerCase();
  if (text.includes('quota')) return 'quota';
  // 42501 = insufficient_privilege, i.e. RLS refused us — in practice a session
  // that expired while the form was open.
  if (text.includes('42501') || text.includes('row-level security') || text.includes('jwt')) {
    return 'not-signed-in';
  }
  return 'failed';
};

/**
 * Who is about to write this row — an account, or a guest minted on the spot.
 *
 * The order matters. An existing session always wins: someone who IS signed in
 * must keep their own uid (and therefore their name under the photo), and a
 * session that expired while the form was open must still come back as
 * 'not-signed-in' rather than being quietly replaced by a nameless guest.
 */
type UploadIdentity =
  | { status: 'ok'; userId: string; isGuest: boolean }
  | { status: 'error'; reason: PhotoUploadFailure };

const resolveUploadIdentity = async (
  client: Awaited<ReturnType<typeof getSupabase>>,
  claimedUserId: string | null | undefined,
): Promise<UploadIdentity> => {
  if (!client) return { status: 'error', reason: 'failed' };

  // The uid the DB will check is the one in the live session, NOT whatever the
  // UI was rendered with. They differ exactly when a session expired mid-form,
  // and that is the case worth getting right.
  const { data: sessionData } = await client.auth.getUser();
  const liveUser = sessionData?.user;

  if (liveUser?.id) {
    const isGuest = Boolean((liveUser as { is_anonymous?: boolean }).is_anonymous);
    // A signed-in visitor whose session changed under them: refuse rather than
    // file their photo under someone else's uid.
    if (claimedUserId && !isGuest && liveUser.id !== claimedUserId) {
      return { status: 'error', reason: 'not-signed-in' };
    }
    return { status: 'ok', userId: liveUser.id, isGuest };
  }

  // The UI thought it had an account but the session is gone — say so, instead
  // of turning a named contributor into an anonymous one behind their back.
  if (claimedUserId) return { status: 'error', reason: 'not-signed-in' };

  const guest = await signInAsGuest();
  if (guest.status === 'ok') return { status: 'ok', userId: guest.userId, isGuest: true };
  return { status: 'error', reason: guest.status === 'disabled' ? 'sign-in-required' : 'failed' };
};

export const uploadBeachPhoto = async (params: {
  /** Null for a visitor with no account — a guest identity is minted here. */
  userId: string | null;
  regionId: string;
  beachId: number;
  caption?: string;
  /** Did the uploader agree to have their name shown under the photo? */
  showCredit?: boolean;
  photo: PreparedPhoto;
}): Promise<PhotoUploadResult> => {
  const { userId, regionId, beachId, caption, showCredit, photo } = params;
  if (!regionId || !Number.isFinite(beachId)) {
    return { status: 'error', reason: 'failed' };
  }

  const client = await getSupabase();
  if (!client) return { status: 'error', reason: 'not-signed-in' };

  const identity = await resolveUploadIdentity(client, userId);
  if (identity.status === 'error') return { status: 'error', reason: identity.reason };
  const { userId: liveUserId, isGuest } = identity;

  const storagePath = buildStoragePath(liveUserId, beachId);

  const { error: uploadError } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, photo.blob, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    // Name the setup mistakes rather than logging a bare object. Both of these
    // fail every upload identically from the visitor's side, and telling them
    // apart from the generic message cost an hour the first time.
    const text = (uploadError.message || '').toLowerCase();
    if (text.includes('bucket') && text.includes('not found')) {
      console.error(
        `Beach photo upload failed: the '${PHOTO_BUCKET}' storage bucket does not exist in this `
        + 'Supabase project. Run supabase/migrations/0002_ugc_publication.sql.',
        uploadError,
      );
    } else if (text.includes('row-level security') || text.includes('policy')) {
      console.error(
        'Beach photo upload failed: the storage policies are missing, so the bucket refused a write '
        + 'into the user\'s own folder. Run supabase/migrations/0002_ugc_publication.sql.',
        uploadError,
      );
    } else {
      console.error('Beach photo upload failed.', uploadError);
    }
    return { status: 'error', reason: classifyError(uploadError.message) };
  }

  const trimmedCaption = (caption || '').trim().slice(0, 280);
  const row: Record<string, unknown> = {
    user_id: liveUserId,
    region_id: regionId,
    beach_id: beachId,
    storage_path: storagePath,
    width: photo.width,
    height: photo.height,
    bytes: photo.blob.size,
    caption: trimmedCaption || null,
    // Explicit, never inferred: an absent value would mean "we guessed", and
    // what we would be guessing about is publishing someone's real name.
    //
    // A guest has no name to publish — there is no profile row with a display
    // name behind this uid — so the answer is false whatever the form said. The
    // publication step (scripts/syncApprovedPhotos.mjs) already renders a null
    // credit as «από επισκέπτη» in each language, so nothing downstream changes.
    show_credit: isGuest ? false : showCredit !== false,
    // `status` is deliberately NOT sent: the column defaults to 'pending' and
    // the insert policy demands that value. Sending it explicitly would be one
    // more place that has to stay in step with the migration.
  };

  let { data, error: insertError } = await client
    .from('beach_photos')
    .insert(row)
    .select('id')
    .single();

  // A database that has not had migration 0003 applied yet has no `show_credit`
  // column, and PostgREST rejects the whole insert for it — which is a working
  // upload form refusing every photo because of a column nobody has run.
  //
  // So retry without the field, but ONLY when the answer was "yes, show my
  // name": with no column the database default is exactly that, so nothing is
  // misrepresented. When the uploader opted OUT there is nowhere to record it,
  // and publishing their name anyway is the one outcome worth failing for.
  if (insertError && isMissingCreditColumn(insertError)) {
    // A guest is the one case where losing the column costs nothing: with no
    // profile name behind the uid, the database default ("show the name")
    // resolves to no name at all. Only a real account can be misrepresented.
    if (showCredit === false && !isGuest) {
      await client.storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => undefined);
      console.error(
        'Beach photo record failed: this Supabase project has no `show_credit` column, so '
        + '"do not show my name" cannot be honoured. Run supabase/migrations/0003_photo_credit_choice.sql.',
        insertError,
      );
      return { status: 'error', reason: 'failed' };
    }

    console.warn(
      'Beach photo saved WITHOUT `show_credit` — run supabase/migrations/0003_photo_credit_choice.sql. '
      + 'Attribution falls back to the database default (name shown), which matches what this uploader chose.',
    );
    delete row.show_credit;
    ({ data, error: insertError } = await client
      .from('beach_photos')
      .insert(row)
      .select('id')
      .single());
  }

  if (insertError) {
    // Take the object back out. A file with no row is invisible to moderation
    // and would never be reviewed, deleted, or counted against anything.
    await client.storage.from(PHOTO_BUCKET).remove([storagePath]).catch(() => undefined);
    console.error('Beach photo record failed.', insertError);
    return {
      status: 'error',
      reason: classifyError(insertError.message, (insertError as { code?: string }).code),
    };
  }

  const photoId = String(data?.id || '');
  // Tell the moderator a photo is waiting. Deliberately NOT awaited into the
  // result: the photo is already safely queued, so a failed notification must
  // never turn a successful upload into an error message for the visitor. Worst
  // case the queue is checked by hand, exactly as it was before.
  void notifyModerator(photoId);

  return { status: 'ok', photoId };
};

/**
 * Ping /api/ugc-notify so the upload shows up in Telegram within seconds.
 *
 * Sends the caller's access token, because the function refuses to message
 * anyone unless Supabase confirms the token owns the row — which is what stops
 * this endpoint from being a megaphone for whoever reads our JavaScript.
 */
const notifyModerator = async (photoId: string): Promise<void> => {
  if (!photoId) return;
  try {
    const client = await getSupabase();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;

    await fetch('/api/ugc-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photoId }),
      keepalive: true,
    });
  } catch {
    /* the queue page is still the source of truth; silence is correct here */
  }
};
