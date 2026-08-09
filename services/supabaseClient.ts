// ─────────────────────────────────────────────────────────────────────────────
// The one place that knows Supabase exists.
//
// Nothing else in the app imports '@supabase/supabase-js'. Everything goes
// through services/authService.ts, which goes through here — so swapping the
// provider later is one file, not a search-and-replace across the codebase.
//
// THREE RULES THIS FILE ENFORCES:
//
// 1. NOT CONFIGURED ⇒ THE FEATURE DOES NOT EXIST. With no VITE_SUPABASE_URL the
//    app behaves exactly as it did before accounts were added: no login button,
//    no network calls, no errors in the console. That is what lets this ship
//    before the Supabase project is created.
//
// 2. THE LIBRARY IS NEVER IN THE FIRST DOWNLOAD. It arrives through a dynamic
//    import, in its own chunk (see vite.config.ts), and only when someone
//    actually signs in or already has a session. ~99% of visitors never fetch a
//    byte of it — see hasStoredSession() in authService.
//
// 3. THE ANON KEY IS PUBLIC AND THAT IS FINE. It identifies the project, it does
//    not grant anything: Row Level Security in supabase/migrations/ is the actual
//    boundary. The service_role key is the opposite — it bypasses RLS, lives only
//    in the Netlify function environment, and scripts/validateBundleSecrets.mjs
//    fails the build if it is ever found in dist/.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');

// Supabase renamed this key. New projects issue a "publishable key"
// (`sb_publishable_…`); older ones issue an "anon key" (a JWT with role=anon).
// They are the same thing for our purposes — the public identifier of the
// project — and supabase-js accepts either. Both names are read so that neither
// a new project nor an old one needs a code change, and so that a rename in the
// Netlify environment cannot silently switch accounts off.
const anonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || ''
).trim();

/** Accounts are switched on by configuration alone — no separate feature flag. */
export const isAuthConfigured = (): boolean => Boolean(url && anonKey);

export const getSupabaseUrl = (): string => url;
export const getSupabaseAnonKey = (): string => anonKey;

/**
 * The project ref — the first label of the Supabase hostname. supabase-js names
 * its localStorage entry `sb-<ref>-auth-token`, which is how we can tell whether
 * anyone is signed in without downloading the library first.
 */
export const getProjectRef = (): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
};

export const getAuthStorageKey = (): string => {
  const ref = getProjectRef();
  return ref ? `sb-${ref}-auth-token` : '';
};

/**
 * A throwaway client that signs in WITHOUT the PKCE handshake.
 *
 * PKCE needs to park a one-time key in browser storage between the click and the
 * return trip. When storage is full, blocked, or wiped by the browser, that key
 * never survives and the sign-in dies with a message about storage that the
 * visitor can do nothing about. The implicit flow carries the session back in the
 * URL fragment instead, so it needs no storage at all to complete — which makes
 * it the right fallback, and only a fallback: PKCE stays the default because it
 * never puts a token in a URL.
 */
export const createImplicitClient = async (): Promise<SupabaseClient | null> => {
  if (!isAuthConfigured()) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, anonKey, {
      auth: {
        flowType: 'implicit',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: { headers: { 'x-application-name': 'calmbeach' } },
    });
  } catch (error) {
    console.error('Supabase fallback client could not be loaded.', error);
    return null;
  }
};

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * The Supabase client, created at most once. Returns null when unconfigured, so
 * every caller can stay a plain `if (!client) return;` instead of a try/catch.
 */
export const getSupabase = (): Promise<SupabaseClient | null> => {
  if (!isAuthConfigured()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;

  clientPromise = import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(url, anonKey, {
      auth: {
        // PKCE keeps the token exchange off the URL fragment: the redirect comes
        // back as ?code=… and that code is swapped for a session on /auth/callback.
        flowType: 'pkce',
        // That swap is done EXPLICITLY in services/authService.ts rather than by
        // the library's automatic URL detection. The automatic path does the work
        // inside client initialization and reports a failure by simply leaving the
        // session null — which is how a broken sign-in became "it didn't work",
        // with no error anywhere to explain why. An explicit call returns the real
        // error, and the visitor gets told what to do about it.
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: { 'x-application-name': 'calmbeach' },
      },
    }))
    .catch((error) => {
      // A failed chunk download must not take the page with it — the rest of the
      // site works fine without accounts, which is the whole point of the seam.
      console.error('Supabase client could not be loaded.', error);
      clientPromise = null;
      return null;
    });

  return clientPromise;
};
