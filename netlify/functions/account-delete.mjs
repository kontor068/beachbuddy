// ─────────────────────────────────────────────────────────────────────────────
// DELETE MY ACCOUNT — the right to erasure, actually implemented.
//
// The app has offered a "delete account" button since the account panel existed.
// It posted here. This did not exist. A GDPR obligation that 404s is worse than
// one you never advertised, so it is built alongside the button, not after it.
//
// WHY A FUNCTION AND NOT THE BROWSER: deleting an auth user requires the service
// role, which bypasses Row Level Security and therefore must never reach a
// browser. The browser can only prove who it is; the deleting is done here.
//
// WHAT GETS DELETED
//   1. Their uploaded files, from BOTH buckets (private originals and any
//      approved public copies). Files first: they are the only thing whose
//      deletion cannot be redone from a database cascade, so if anything fails
//      it fails while the account still exists and the request can be retried.
//   2. The auth user. Every table in supabase/migrations/0001 references
//      auth.users with ON DELETE CASCADE, so profiles, favorites, preferences,
//      reviews and photo rows go with it.
//
// The caller proves identity with their own access token; we never take a user
// id from the request body. Otherwise this endpoint would delete anyone's
// account on request, which is the worst possible bug to ship in a feature whose
// entire purpose is honouring a privacy right.
// ─────────────────────────────────────────────────────────────────────────────

const PRIVATE_BUCKET = 'beach-photos';
const PUBLIC_BUCKET = 'beach-photos-public';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const config = () => ({
  url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
});

const ALLOWED_HOSTS = new Set(['calmbeach.gr', 'www.calmbeach.gr', 'localhost', '127.0.0.1']);

const hostOf = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isTrustedOrigin = (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  const host = hostOf(origin) || hostOf(referer);
  return Boolean(host) && (ALLOWED_HOSTS.has(host) || host.endsWith('.netlify.app'));
};

/** Who is asking — established from their token, never from what they send. */
const identify = async (accessToken) => {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && user.id ? user : null;
};

const authHeaders = () => {
  const { serviceKey } = config();
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
};

/** Every object under `{uid}/` in one bucket. */
const listUserObjects = async (bucket, userId) => {
  const { url } = config();
  const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `${userId}/`, limit: 1000, offset: 0 }),
  });
  if (!response.ok) return [];
  const items = await response.json().catch(() => []);
  return Array.isArray(items) ? items.map(item => `${userId}/${item.name}`) : [];
};

const deleteObjects = async (bucket, paths) => {
  if (paths.length === 0) return true;
  const { url } = config();
  const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
  return response.ok;
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!isTrustedOrigin(event)) return json(403, { error: 'Forbidden.' });

  const { url, serviceKey } = config();
  if (!url || !serviceKey) {
    console.error('Account deletion is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    return json(503, { error: 'Account deletion is not configured.' });
  }

  const headers = event.headers || {};
  const authorization = headers.authorization || headers.Authorization || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return json(401, { error: 'Not signed in.' });

  const user = await identify(accessToken);
  if (!user) return json(401, { error: 'That sign-in is no longer valid.' });

  try {
    // Files first — see the header note on ordering.
    for (const bucket of [PRIVATE_BUCKET, PUBLIC_BUCKET]) {
      const paths = await listUserObjects(bucket, user.id);
      const ok = await deleteObjects(bucket, paths);
      if (!ok) {
        console.error(`Could not delete ${paths.length} object(s) from ${bucket} for ${user.id}.`);
        return json(502, { error: 'Some of your files could not be deleted. Nothing was removed — please try again.' });
      }
    }

    const response = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`Account deletion failed for ${user.id}: ${response.status} ${detail.slice(0, 200)}`);
      return json(502, { error: 'Your account could not be deleted. Please try again.' });
    }

    // Deliberately no identifying detail in the log: this is the one action whose
    // whole point is that the person stops existing in our records.
    console.log('An account was deleted at the owner\'s request.');
    return json(200, { ok: true });
  } catch (error) {
    console.error('Account deletion threw.', error && error.message);
    return json(500, { error: 'Something went wrong deleting your account.' });
  }
};
