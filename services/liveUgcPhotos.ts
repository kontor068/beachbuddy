// ─────────────────────────────────────────────────────────────────────────────
// THE LIVE PHOTO INDEX, READ FROM THE SITE.
//
// A visitor's photo used to need a full site deploy to become visible: the list
// of approved photos was baked into the bundle at build time, so approving one
// changed nothing anyone could see until the next code push. For a contributor
// who was promised «θα τη δεις στην κάρτα της παραλίας» that is the difference
// between a feature and a form that swallows things.
//
// The moderation function now writes the same list to a public storage object
// the moment it approves (netlify/functions/lib/ugcPhotoIndex.mjs). This reads
// it, after the page has painted, and hands it to utils/ugcPhotos.ts.
//
// FOUR RULES:
//
// 1. NEVER BEFORE THE PAGE IS USABLE. This is a nicety, not content the page is
//    waiting for — the baked list already rendered. It runs on idle, and never
//    on the critical path.
//
// 2. A FAILURE IS SILENT AND CHANGES NOTHING. No index published yet (404), no
//    network, a truncated body — all leave the baked list exactly where it is.
//    The worst outcome must be "you see what the last deploy shipped", which is
//    precisely how the site behaved before this file existed.
//
// 3. NOT CONFIGURED ⇒ THE FEATURE DOES NOT EXIST. With no VITE_SUPABASE_URL
//    there is no request and no error, the same contract services/supabaseClient
//    already holds for accounts.
//
// 4. NOTHING HERE IS TRUSTED BLINDLY. The payload is public and small, but it
//    decides which images render on beach pages, so it is shape-checked before
//    it is installed and every URL must actually be in our own public bucket.
//    A malformed or hijacked index must be discarded, not displayed.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabaseUrl } from './supabaseClient';
import { setLiveUgcPhotos, type UgcPhoto, type UgcPhotoTable } from '../utils/ugcPhotos';

const PUBLIC_BUCKET = 'beach-photos-public';
const INDEX_OBJECT = '_index/photos.json';

/**
 * How stale the index may be, at worst.
 *
 * The object is uploaded with `max-age=60`, but a CDN's idea of sixty seconds is
 * not something to bet the feature on. Rounding the cache-buster to a five-minute
 * bucket puts a hard ceiling on staleness that does not depend on anyone else's
 * cache behaviour, while still letting every visitor inside the same five minutes
 * share one cached response.
 */
const FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

/** Enough for a few thousand photos; anything larger is a sign something is wrong. */
const MAX_BYTES = 2 * 1024 * 1024;

let inFlight: Promise<boolean> | null = null;
let lastFetchedAt = 0;

const indexUrl = (): string => {
  const base = getSupabaseUrl();
  if (!base) return '';
  // athens-clock-exempt: a cache bucket, not a time of day. Athens time would be
  // actively wrong here — the URL has to change on the same schedule for every
  // visitor on earth, which is what a raw epoch division gives and a timezone
  // does not.
  const bucketOfTime = Math.floor(Date.now() / FRESHNESS_WINDOW_MS);
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${INDEX_OBJECT}?v=${bucketOfTime}`;
};

/**
 * Is this a photo record we are willing to render?
 *
 * The URL check is the one that matters: only our own public bucket, on the very
 * origin the app is already configured for. Everything else in the record is
 * cosmetic and gets a safe default, but a URL from somewhere else would let a
 * bad index point beach pages at an arbitrary image host.
 */
const isRenderablePhoto = (value: unknown, expectedPrefix: string): value is UgcPhoto => {
  if (!value || typeof value !== 'object') return false;
  const photo = value as Partial<UgcPhoto>;
  return typeof photo.url === 'string' && photo.url.startsWith(expectedPrefix);
};

const sanitize = (raw: unknown): UgcPhotoTable | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const base = getSupabaseUrl();
  if (!base) return null;
  const expectedPrefix = `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/`;

  const table: UgcPhotoTable = {};
  let offered = 0;
  let kept = 0;

  for (const [beachId, photos] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(photos)) continue;
    offered += photos.length;
    const clean = photos
      .filter((photo): photo is UgcPhoto => isRenderablePhoto(photo, expectedPrefix))
      .map((photo) => ({
        url: photo.url,
        credit: typeof photo.credit === 'string' ? photo.credit : null,
        caption: typeof photo.caption === 'string' ? photo.caption : null,
        width: typeof photo.width === 'number' ? photo.width : null,
        height: typeof photo.height === 'number' ? photo.height : null,
      }));
    kept += clean.length;
    if (clean.length) table[beachId] = clean;
  }

  // «ΤΙΠΟΤΑ ΕΓΚΕΚΡΙΜΕΝΟ» AND «ΤΑ ΑΠΕΡΡΙΨΑ ΟΛΑ» ARE NOT THE SAME ANSWER, and this
  // is the line that keeps them apart.
  //
  // An index that offers photos and has every single one rejected is not an index
  // saying the site should go empty — it is an index we failed to understand. The
  // realistic cause is drift between VITE_SUPABASE_URL in the bundle and
  // SUPABASE_URL in the function environment: every URL then fails the bucket
  // check at once, and installing that result would silently blank every visitor
  // photo on the site while both halves looked fine on their own.
  //
  // So it is discarded and the baked list stands. A genuinely empty payload — the
  // build script writes `{}` when nothing is approved — still installs, which is
  // what makes taking a photo down work without a deploy.
  if (offered > 0 && kept === 0) return null;

  return table;
};

/**
 * Fetch the live index and install it. Resolves to true when the visible photos
 * actually changed, which is only on the rare load that finds something new.
 */
export const refreshLiveUgcPhotos = async (): Promise<boolean> => {
  const url = indexUrl();
  if (!url) return false;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch(url, {
        // The cache-buster above already bounds staleness; letting the browser
        // serve its cached copy inside that window is the point, not a problem.
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      // 404 is the ordinary state before the first approval ever happens.
      if (!response.ok) return false;

      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > MAX_BYTES) return false;

      const parsed = sanitize(await response.json());
      if (!parsed) return false;

      lastFetchedAt = Date.now(); // athens-clock-exempt: an instant, compared only against another instant.
      return setLiveUgcPhotos(parsed);
    } catch {
      // Rule 2: the baked list stays, and nobody hears about it.
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

const onIdle = (run: () => void): void => {
  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idle === 'function') idle(run, { timeout: 4000 });
  else window.setTimeout(run, 1200);
};

/**
 * Start watching for approved photos. Safe to call once per app boot.
 *
 * Two triggers, no polling loop: once when the page has settled, and again when
 * a backgrounded tab is brought back after the freshness window has passed. A
 * timer would keep firing requests at a phone in someone's pocket for a file
 * that changes a few times a week.
 */
export const startLiveUgcPhotos = (): (() => void) => {
  if (typeof window === 'undefined' || !getSupabaseUrl()) return () => {};

  onIdle(() => { void refreshLiveUgcPhotos(); });

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    // athens-clock-exempt: "how long has this tab been away", a duration.
    if (Date.now() - lastFetchedAt < FRESHNESS_WINDOW_MS) return;
    void refreshLiveUgcPhotos();
  };

  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
};
