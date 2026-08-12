// ─────────────────────────────────────────────────────────────────────────────
// THE APPROVED-PHOTO INDEX — one builder, two destinations.
//
// The same map of {beachId: [photo, …]} is needed in two places that used to be
// unable to share it:
//
//   • BAKED   scripts/syncApprovedPhotos.mjs writes data/beachPhotosUgc.generated.json
//             at build time. That copy is what the prerendered HTML carries, so it
//             is the one Google and a visitor with no JavaScript ever see.
//   • LIVE    this module uploads the same map to the PUBLIC bucket the moment a
//             moderator approves something, and the running app fetches it. That
//             copy is what makes an approved photo appear in minutes instead of
//             waiting for the next deploy.
//
// TWO COPIES, ONE BUILDER — and it has to stay that way. The rules below (which
// photo counts, whose name goes on it, how many per beach) are the difference
// between crediting the right person and the wrong one. A second implementation
// that drifts by one line is how the live site and the baked pages start telling
// a visitor two different things about the same beach.
//
// THE RULES, unchanged from the day the pipeline shipped:
//
// 1. ONLY `approved` + `public_path`. An approved row whose file never reached
//    the public bucket is skipped, not guessed at: the private object is not
//    publicly readable, so a URL built from `storage_path` would be a 400 on
//    every beach card that showed it.
//
// 2. A PHOTO WITH NO NAME ON IT IS STILL PUBLISHED, BUT NEVER MISATTRIBUTED.
//    The credit comes from profiles.display_name and is SHORTENED to «Γιώργος
//    Π.» — we promised the uploader their name on the card, not that we would
//    publish their full legal name on a page Google indexes forever. Two things
//    produce `credit: null`, and both mean the site says "from a visitor": no
//    profile name on record, and `show_credit = false`, which is the uploader
//    ticking the box off in the form (migration 0003).
//
// 3. CURATED ORDER FIRST, THEN NEWEST, CAPPED PER BEACH. `sort_order` is the
//    moderator's decision about which photo represents this beach (migration
//    0006); a photo with none is "not yet placed" and falls in behind the placed
//    ones, newest first — which is precisely how every beach behaved before
//    ordering existed. The cap is per beach too (`beach_photo_settings`),
//    defaulting to the six the detail gallery has always used. An unbounded list
//    would let one enthusiastic uploader own a beach page.
//
// WHY THE INDEX LIVES IN THE BUCKET AND NOT BEHIND A FUNCTION. It is read on
// ordinary page loads, so it has to be free and it has to be fast. A public
// storage object is a plain CDN GET: no function invocation, no cold start, no
// per-request cost, and it is already inside the site's connect-src (the same
// Supabase origin the sign-in uses). A function endpoint would have been billed
// per visitor for data that changes a few times a week.
//
// NOBODY BUT US CAN WRITE IT. supabase/migrations/0002 gives `beach-photos-public`
// no insert policy at all, so the only key that can put an object there is the
// service-role key, which exists only in the Netlify function environment. That
// matters more than it looks: whoever can write this file decides which photos
// every visitor sees on every beach.
// ─────────────────────────────────────────────────────────────────────────────

export const PUBLIC_BUCKET = 'beach-photos-public';

/** The object key of the live index inside the public bucket. */
export const INDEX_OBJECT = '_index/photos.json';

/** What a beach shows when nobody has said otherwise — today's behaviour, unchanged. */
export const DEFAULT_MAX_PER_BEACH = 6;

/** A bound on a mistake, not a product opinion. Mirrors the CHECK in migration 0006. */
export const HARD_MAX_PER_BEACH = 12;

/**
 * How long a browser (and the CDN in front of the bucket) may reuse the index.
 *
 * Short on purpose: this file is the whole reason an approval does not need a
 * deploy, and an hour of caching would hand most of that back. Sixty seconds is
 * still one request per visit for anyone browsing normally.
 */
const INDEX_CACHE_SECONDS = 60;

/** The permanent public URL of the live index. Empty when Supabase is unconfigured. */
export const liveIndexUrl = (supabaseUrl) => {
  const base = (supabaseUrl || '').replace(/\/+$/, '');
  return base ? `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${INDEX_OBJECT}` : '';
};

/**
 * «Γιώργος Παπαδόπουλος» → «Γιώργος Π.»
 *
 * A single-word name is left alone (there is no surname to reduce), and anything
 * that is not a plain name — an email address slipped into the Google profile,
 * an empty string — returns null rather than being printed on a public page.
 */
export const shortenName = (raw) => {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!name || name.includes('@') || name.length > 60) return null;
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0];
  const surname = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${surname.charAt(0).toUpperCase()}.`;
};

const authHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
});

const getJson = async (url, serviceKey, pathAndQuery) => {
  const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    headers: { ...authHeaders(serviceKey), Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${pathAndQuery} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
};

// ── Working before the migration has been run ────────────────────────────────
// Code and database migrate at different moments: this deploy can be live for
// minutes or days before someone runs supabase/migrations/0006 in the dashboard.
// In that window `sort_order` does not exist, and PostgREST answers a select that
// names it with a flat 42703 — which, without the fallback below, would take the
// ENTIRE live publication down. Photos would stop appearing, and the cause would
// be a feature that had not been switched on yet.
//
// So every read that wants ordering asks for it, and drops back to the pre-0006
// query if the column is not there yet. The site then behaves exactly as it did
// last week: newest first, six per beach. Nothing is lost, and running the
// migration is what turns ordering on, with no second deploy.

const isMissingOrderingSchema = (error) => {
  const text = String(error?.message || '');
  return /42703|42P01/.test(text)
    || (/does not exist/i.test(text) && /sort_order|beach_photo_settings/.test(text));
};

const PHOTO_FIELDS = 'id,beach_id,region_id,public_path,caption,width,height,user_id,approved_at,show_credit';

const limitKey = (regionId, beachId) => `${regionId ?? ''}::${beachId ?? ''}`;

/**
 * Per-beach display limits, as a lookup.
 *
 * Best-effort: a beach with no row uses the default, and so does every beach if
 * the table cannot be read at all. Losing this must never mean publishing an
 * empty site — the worst acceptable outcome is "one beach shows six photos
 * instead of the three you asked for", which is a cosmetic miss, not an outage.
 */
const readBeachLimits = async (base, serviceKey) => {
  try {
    const rows = await getJson(base, serviceKey, 'beach_photo_settings?select=region_id,beach_id,max_shown');
    return new Map((rows || []).map(row => [limitKey(row.region_id, row.beach_id), row.max_shown]));
  } catch (error) {
    console.warn(`[ugc-photos] could not read beach_photo_settings (${error.message}); using the default of ${DEFAULT_MAX_PER_BEACH}.`);
    return new Map();
  }
};

const limitFor = (limits, regionId, beachId) => {
  const stored = limits.get(limitKey(regionId, beachId));
  if (!Number.isFinite(stored)) return DEFAULT_MAX_PER_BEACH;
  // Clamped here as well as in the database. The CHECK constraint is the real
  // guard; this one keeps a hand-edited row from making a beach page heavy.
  return Math.min(Math.max(1, stored), HARD_MAX_PER_BEACH);
};

/**
 * Read every approved photo and return the map the site renders from.
 *
 * Returns `{}` for "everything was rejected / nothing approved yet" — a real
 * answer, not a failure. Writing that empty map is how a photo that was
 * un-approved actually disappears from the site.
 *
 * Throws on a genuine read failure, so the caller can decide what a missing
 * answer means. It means different things in the two callers: the build keeps
 * the committed file, the moderator gets told the live index was not refreshed.
 */
export const buildApprovedPhotoIndex = async ({ url, serviceKey }) => {
  const base = (url || '').replace(/\/+$/, '');
  const where = 'beach_photos?status=eq.approved&public_path=not.is.null';
  let photos;
  try {
    photos = await getJson(
      base,
      serviceKey,
      `${where}&select=${PHOTO_FIELDS},sort_order`
      // Placed photos first in the moderator's order; everything not yet placed
      // behind them, newest first. PostgREST puts NULLs last on an ascending sort
      // only when asked, and "asked" is the difference between a curated cover and
      // whatever was approved most recently.
      + '&order=sort_order.asc.nullslast,approved_at.desc',
    );
  } catch (error) {
    if (!isMissingOrderingSchema(error)) throw error;
    console.warn('[ugc-photos] migration 0006 has not been run yet — publishing newest-first, as before.');
    photos = await getJson(base, serviceKey, `${where}&select=${PHOTO_FIELDS}&order=approved_at.desc`);
  }

  if (!Array.isArray(photos)) throw new Error('unexpected answer from beach_photos');
  if (photos.length === 0) return { byBeach: {}, published: 0 };

  // How many each beach shows. A beach with no row keeps the default, so this is
  // empty until someone actually changes something — and a failure to read it is
  // not a reason to publish nothing.
  const limits = await readBeachLimits(base, serviceKey);

  // One request for every name, rather than one per photo.
  const userIds = [...new Set(photos.map(row => row.user_id).filter(Boolean))];
  let namesById = new Map();
  if (userIds.length) {
    try {
      const profiles = await getJson(base, serviceKey, `profiles?id=in.(${userIds.join(',')})&select=id,display_name`);
      namesById = new Map((profiles || []).map(p => [p.id, shortenName(p.display_name)]));
    } catch (error) {
      // Credits are worth a degraded mode, not a failed build: the photos still
      // publish, attributed to "a visitor" instead of by name.
      console.warn(`[ugc-photos] could not read profiles (${error.message}); publishing without names.`);
    }
  }

  const byBeach = {};
  let published = 0;
  for (const row of photos) {
    const beachId = String(row.beach_id ?? '');
    if (!beachId || !row.public_path) continue;
    const list = (byBeach[beachId] ||= []);
    if (list.length >= limitFor(limits, row.region_id, row.beach_id)) continue;

    list.push({
      // Public bucket ⇒ a permanent, unsigned URL. Signed URLs expire, and a
      // static page baked with one serves a dead image days later.
      url: `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${row.public_path.split('/').map(encodeURIComponent).join('/')}`,
      // `show_credit === false` is the uploader saying "publish it, but not my
      // name". Honoured here rather than in the UI, so the choice survives into
      // the baked static pages too — a byline nobody asked for cannot be
      // quietly corrected once Google has crawled it.
      credit: row.show_credit === false ? null : (namesById.get(row.user_id) || null),
      caption: (row.caption || '').trim() || null,
      width: Number(row.width) || null,
      height: Number(row.height) || null,
    });
    published += 1;
  }

  return { byBeach, published };
};

/**
 * Put the map in the public bucket, where the running site can read it.
 *
 * Upsert, so re-approving after a failed attempt overwrites rather than piling
 * up orphans — the same reason the photo copy itself upserts.
 */
export const publishApprovedPhotoIndex = async ({ url, serviceKey }, byBeach) => {
  const base = (url || '').replace(/\/+$/, '');
  const response = await fetch(`${base}/storage/v1/object/${PUBLIC_BUCKET}/${INDEX_OBJECT}`, {
    method: 'POST',
    headers: {
      ...authHeaders(serviceKey),
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${INDEX_CACHE_SECONDS}`,
      'x-upsert': 'true',
    },
    body: JSON.stringify(byBeach),
  });
  if (!response.ok) {
    throw new Error(`publishing the photo index failed (${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`);
  }
  return true;
};

// ── Curating one beach ───────────────────────────────────────────────────────
// Everything below is the moderator rearranging a beach that already has photos.
// It lives here, next to the builder that publishes the order, rather than in the
// console that draws the buttons: the rule "placed photos first, then newest,
// then cut at the beach's limit" has to be one rule, or the order you arrange in
// the console is not the order the site serves.
//
// Today only /api/traffic draws these controls. /api/ugc-admin remains the
// no-JavaScript backup door for approving and rejecting; if it ever grows an
// ordering screen it must call these functions rather than write its own.

const patchPhoto = async (base, serviceKey, photoId, patch) => {
  const response = await fetch(`${base}/rest/v1/beach_photos?id=eq.${encodeURIComponent(photoId)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(serviceKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`reordering failed (${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`);
  }
};

/**
 * One beach's approved photos, in the order they are published in, plus how many
 * of them are actually shown.
 *
 * Returns EVERY approved photo, including the ones past the cap. That is the
 * point of the screen this feeds: you cannot decide that the fourth photo
 * deserves to be first if the console only shows you the three that made it.
 */
export const listBeachPhotos = async ({ url, serviceKey }, regionId, beachId) => {
  const base = (url || '').replace(/\/+$/, '');
  const where = 'beach_photos?status=eq.approved&public_path=not.is.null'
    + `&region_id=eq.${encodeURIComponent(regionId)}&beach_id=eq.${encodeURIComponent(beachId)}`;

  const read = async () => {
    try {
      return await getJson(base, serviceKey,
        `${where}&select=id,public_path,caption,sort_order,approved_at&order=sort_order.asc.nullslast,approved_at.desc`);
    } catch (error) {
      if (!isMissingOrderingSchema(error)) throw error;
      // Same fallback as the builder: before migration 0006 the screen still
      // lists the beach's photos, it just cannot rearrange them yet.
      return getJson(base, serviceKey, `${where}&select=id,public_path,caption,approved_at&order=approved_at.desc`);
    }
  };

  const [rows, limits] = await Promise.all([read(), readBeachLimits(base, serviceKey)]);

  const maxShown = limitFor(limits, regionId, beachId);
  return {
    maxShown,
    photos: (rows || []).map((row, index) => ({
      id: row.id,
      url: `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${row.public_path.split('/').map(encodeURIComponent).join('/')}`,
      caption: (row.caption || '').trim() || null,
      position: index + 1,
      // The honest half of this screen: which of these a visitor actually sees.
      shown: index < maxShown,
    })),
  };
};

/**
 * Every beach that has at least one published photo, most photos first.
 *
 * This is how you reach a beach's order WITHOUT approving something first. Without
 * it the ordering screen would be reachable only in the seconds after a decision,
 * which would make "I want to rearrange Anaxos" impossible to act on.
 *
 * Grouped in JavaScript rather than by the database because PostgREST has no
 * DISTINCT: the query returns two small columns per approved photo. At a few
 * thousand photos that is tens of kilobytes on a page only the operator opens.
 */
export const listBeachesWithPhotos = async ({ url, serviceKey }) => {
  const base = (url || '').replace(/\/+$/, '');
  const rows = await getJson(
    base,
    serviceKey,
    'beach_photos?status=eq.approved&public_path=not.is.null&select=region_id,beach_id',
  );

  const counts = new Map();
  for (const row of rows || []) {
    if (!row.region_id || row.beach_id == null) continue;
    const key = limitKey(row.region_id, row.beach_id);
    const found = counts.get(key) || { regionId: row.region_id, beachId: row.beach_id, count: 0 };
    found.count += 1;
    counts.set(key, found);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.beachId - b.beachId);
};

/**
 * Move one photo within its beach. `direction` is 'up', 'down' or 'first'.
 *
 * REWRITES EVERY POSITION, not just the two that swap. Before this feature no
 * photo had a sort_order at all, so a swap that only touched two rows would
 * leave the rest NULL and they would keep sorting by date behind them — the
 * order would look right once and drift on the next approval. Numbering the
 * whole beach 1..n on every move costs at most twelve tiny writes and means the
 * order you see is the order that is stored.
 */
export const moveBeachPhoto = async (config, { regionId, beachId, photoId, direction }) => {
  const base = (config.url || '').replace(/\/+$/, '');
  const { photos } = await listBeachPhotos(config, regionId, beachId);

  const from = photos.findIndex(photo => String(photo.id) === String(photoId));
  if (from < 0) throw new Error('this photo is not on this beach');

  let to = from;
  if (direction === 'up') to = from - 1;
  else if (direction === 'down') to = from + 1;
  else if (direction === 'first') to = 0;
  else throw new Error(`unknown direction: ${direction}`);

  // Off either end is a no-op, not an error: the arrows stay pressable and the
  // top photo simply stays on top.
  if (to < 0 || to >= photos.length || to === from) return { moved: false, photos };

  const ordered = photos.slice();
  ordered.splice(to, 0, ordered.splice(from, 1)[0]);

  await Promise.all(ordered.map((photo, index) => patchPhoto(base, config.serviceKey, photo.id, { sort_order: index })));

  return { moved: true, photos: ordered.map((photo, index) => ({ ...photo, position: index + 1 })) };
};

/** How many of this beach's photos a visitor sees. Clamped to the same bounds as the CHECK. */
export const setBeachPhotoLimit = async ({ url, serviceKey }, { regionId, beachId, maxShown }) => {
  const base = (url || '').replace(/\/+$/, '');
  // A number, however silly, gets clamped; only a NON-number falls back to the
  // default. `Number(x) || DEFAULT` would quietly turn an explicit 0 into 6 —
  // the opposite of what asking for the fewest possible photos means.
  const asked = Number(maxShown);
  const value = Number.isFinite(asked)
    ? Math.min(Math.max(1, Math.round(asked)), HARD_MAX_PER_BEACH)
    : DEFAULT_MAX_PER_BEACH;

  const response = await fetch(`${base}/rest/v1/beach_photo_settings`, {
    method: 'POST',
    headers: {
      ...authHeaders(serviceKey),
      'Content-Type': 'application/json',
      // Upsert on the (region_id, beach_id) primary key — pressing the control
      // twice must not be an error, and there is no "have I set this before?".
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ region_id: regionId, beach_id: Number(beachId), max_shown: value, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) {
    throw new Error(`saving the photo limit failed (${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`);
  }
  return value;
};

/**
 * Build it and publish it — what a moderator's click and a build both need.
 *
 * NEVER THROWS. A failed refresh must not fail the approval that triggered it:
 * the photo is already approved and already in the public bucket, and the next
 * approval or the next build republishes the index anyway. The caller gets
 * `{ ok: false }` and can say so in plain words instead of showing an error page
 * for work that actually succeeded.
 */
export const refreshApprovedPhotoIndex = async (config) => {
  if (!config?.url || !config?.serviceKey) return { ok: false, reason: 'not configured' };
  try {
    const { byBeach, published } = await buildApprovedPhotoIndex(config);
    await publishApprovedPhotoIndex(config, byBeach);
    return { ok: true, published, beaches: Object.keys(byBeach).length };
  } catch (error) {
    console.error('Could not refresh the live photo index.', error && error.message);
    return { ok: false, reason: error && error.message };
  }
};
