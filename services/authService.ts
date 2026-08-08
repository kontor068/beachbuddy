// ─────────────────────────────────────────────────────────────────────────────
// THE AUTH SEAM.
//
// Components and hooks talk to this file and nothing else. It is deliberately
// small and provider-shaped rather than Supabase-shaped: signIn, signOut, who is
// signed in, tell me when that changes. If Supabase is ever replaced, this is the
// file that changes.
//
// Google is the only provider. Not a limitation to work around later — email or
// magic-link login needs an SMTP provider and a deliverability problem we do not
// have today, and Apple costs $99/year. Google is free and everyone travelling
// with a phone already has one.
// ─────────────────────────────────────────────────────────────────────────────

import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { createImplicitClient, getAuthStorageKey, getSupabase, isAuthConfigured } from './supabaseClient';
import { makeRoomForCriticalWrite, purgeAllButEssential, storageAcceptsWrites } from '../utils/safeStorage';

/** Where /auth/callback should send the visitor back to once the code is exchanged. */
const RETURN_TO_KEY = 'calmbeach:auth:returnTo';
/**
 * The address the sign-in STARTED from. The PKCE verifier lives in that origin's
 * storage, so if the provider returns to a different one — localhost vs
 * 127.0.0.1, a stale port, a preview domain — the verifier is simply not there
 * and the exchange fails with a message that names storage but not the cause.
 * Recording it turns "code verifier not found" into "you left from X and came
 * back to Y", which is the actual problem and is fixable.
 */
const ORIGIN_KEY = 'calmbeach:auth:origin';
/**
 * Our own copy of the one-time PKCE key.
 *
 * supabase-js writes the verifier into its own storage slot, and then deletes it
 * again in more places than is useful to us: any client built without a session
 * runs a cleanup that clears every pending verifier, and the callback page is by
 * definition a page with no session yet. The result was a sign-in that failed
 * with "PKCE code verifier not found in storage" — true, and entirely
 * self-inflicted.
 *
 * So the verifier is copied here the moment it is created, under a key the
 * library does not know about, and put back just before the exchange. It is not
 * a secret worth protecting differently: it is single-use, useless without the
 * matching one-time code from Google, and it already lives in this same storage.
 */
const VERIFIER_KEY = 'calmbeach:auth:verifier';
export const AUTH_CALLBACK_PATH = '/auth/callback';

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export const isAuthAvailable = isAuthConfigured;

/**
 * Is anyone signed in on this device? Answered WITHOUT loading the Supabase
 * library, by looking for the entry supabase-js writes itself.
 *
 * This one function is what keeps accounts free for everybody else: a visitor who
 * has never signed in never downloads the SDK, so the initial bundle is untouched
 * for ~99% of traffic. Getting this wrong (restoring the session eagerly on every
 * page load) would quietly undo the whole performance design.
 */
export const hasStoredSession = (): boolean => {
  if (!isAuthConfigured() || typeof window === 'undefined') return false;
  try {
    const key = getAuthStorageKey();
    return Boolean(key && window.localStorage.getItem(key));
  } catch {
    return false;
  }
};

const toAuthUser = (user: User | null | undefined): AuthUser | null => {
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  };
  return {
    id: user.id,
    email: user.email ?? null,
    name: pick('full_name', 'name', 'preferred_username'),
    avatarUrl: pick('avatar_url', 'picture'),
  };
};

const withClient = async <T,>(fn: (client: SupabaseClient) => Promise<T>, fallback: T): Promise<T> => {
  const client = await getSupabase();
  if (!client) return fallback;
  try {
    return await fn(client);
  } catch (error) {
    console.error('Auth call failed.', error);
    return fallback;
  }
};

/**
 * Start the Google sign-in redirect.
 *
 * The current path is stashed first: OAuth always returns to a fixed callback
 * URL, and dumping the visitor on the homepage after they signed in from a beach
 * page is a small betrayal that adds up.
 */
export const signInWithGoogle = async (returnTo?: string): Promise<{ ok: boolean; error?: string }> => {
  if (!isAuthConfigured()) return { ok: false, error: 'not-configured' };

  try {
    const target = returnTo || `${window.location.pathname}${window.location.search}`;
    // Same-origin paths only — an attacker-supplied absolute URL here would turn
    // our callback into an open redirect.
    if (target.startsWith('/') && !target.startsWith('//')) {
      window.sessionStorage.setItem(RETURN_TO_KEY, target);
    }
    window.localStorage.setItem(ORIGIN_KEY, window.location.origin);
  } catch {
    /* a private-mode browser without sessionStorage just lands on the homepage */
  }

  const client = await getSupabase();
  if (!client) return { ok: false, error: 'unavailable' };

  // Clear the forecast caches FIRST. They are the biggest thing this app stores
  // and they routinely fill the browser's quota after a couple of regions; the
  // sign-in library then fails to store its one-time key and says nothing about
  // it. A few refetched forecasts cost a second — a sign-in that cannot start
  // costs the account.
  makeRoomForCriticalWrite();

  // skipBrowserRedirect so there is a moment between "the verifier exists" and
  // "we leave the page" — that moment is when we take our own copy of it.
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}`,
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error('Google sign-in could not start.', error);
    return { ok: false, error: error.message };
  }
  if (!data?.url) {
    return { ok: false, error: 'no sign-in URL was returned' };
  }

  // Keep the copy in BOTH storages. sessionStorage has its own quota, survives a
  // full-page OAuth round trip in the same tab, and is emptied when the tab
  // closes — which is exactly the lifetime a single-use sign-in key wants. It is
  // the one that keeps working when localStorage is out of room.
  let verifierSecured = false;
  try {
    const verifier = window.localStorage.getItem(`${getAuthStorageKey()}-code-verifier`);
    if (verifier) {
      try { window.sessionStorage.setItem(VERIFIER_KEY, verifier); } catch { /* ignore */ }
      try { window.localStorage.setItem(VERIFIER_KEY, verifier); } catch { /* ignore */ }
      // Trust the read-back, not the write: a storage that accepts a write and
      // drops it silently is exactly the case that made this fail for days.
      verifierSecured = Boolean(
        (() => { try { return window.sessionStorage.getItem(VERIFIER_KEY); } catch { return null; } })()
        || (() => { try { return window.localStorage.getItem(VERIFIER_KEY); } catch { return null; } })(),
      );
    }
  } catch {
    /* handled by the fallback below */
  }

  if (verifierSecured) {
    window.location.assign(data.url);
    return { ok: true };
  }

  // ── Storage will not hold the key: take the road that does not need it ──────
  // Rather than send the visitor to Google for a handshake that cannot possibly
  // complete, start again on the implicit flow, which carries the session home in
  // the URL fragment. Slightly older mechanism, no storage dependency, and the
  // visitor gets a working sign-in instead of an explanation.
  console.warn('PKCE key could not be stored — falling back to the implicit sign-in flow.');
  const fallback = await createImplicitClient();
  if (!fallback) return { ok: false, error: 'unavailable' };

  const implicitResult = await fallback.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}`,
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });
  if (implicitResult.error || !implicitResult.data?.url) {
    return { ok: false, error: implicitResult.error?.message || 'no sign-in URL was returned' };
  }

  window.location.assign(implicitResult.data.url);
  return { ok: true };
};

/** Where to go after a successful callback. Consumed once, then forgotten. */
export const takeReturnTo = (): string => {
  try {
    const value = window.sessionStorage.getItem(RETURN_TO_KEY);
    window.sessionStorage.removeItem(RETURN_TO_KEY);
    if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  } catch {
    /* ignore */
  }
  return '/';
};

/**
 * Finish the redirect. supabase-js exchanges the ?code= itself while the client
 * is being created (detectSessionInUrl), so this is mostly "wait for that, then
 * tell me who it turned out to be".
 *
 * It reports WHY it failed rather than just failing. A sign-in that dead-ends on
 * "that didn't work" is unfixable by the person it happened to and undiagnosable
 * by us — and every real cause here (a redirect URL not on the allow-list, an app
 * still in testing, a stale code) has a specific, actionable message attached.
 */
export type OAuthResult = { user: AuthUser | null; reason?: string };

export const completeOAuthRedirect = async (): Promise<OAuthResult> => {
  if (!isAuthConfigured()) return { user: null, reason: 'accounts are not configured in this build' };

  // Providers report refusals in the query string, Supabase sometimes in the hash.
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const providerError = query.get('error_description') || query.get('error')
    || hash.get('error_description') || hash.get('error');
  if (providerError) return { user: null, reason: providerError };

  // Make room BEFORE anything is written, whichever route we came back on. The
  // session itself has to be persisted at the end of this function, and a session
  // that cannot be stored means the visitor is signed in for exactly one page and
  // then silently signed out again — which looks like nothing happened at all.
  makeRoomForCriticalWrite();

  // ── Implicit flow: the session is already here, in the URL fragment ─────────
  // Nothing to exchange and nothing to look up in storage — which is precisely
  // why this path exists as the fallback for browsers that will not keep the
  // PKCE key. Handled before the code path because the two are mutually
  // exclusive and this one needs no round trip.
  const accessToken = hash.get('access_token');
  if (accessToken) {
    const client = await getSupabase();
    if (!client) return { user: null, reason: 'the sign-in library could not be loaded' };
    try {
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: hash.get('refresh_token') || '',
      });
      if (error) return { user: null, reason: error.message };
      if (data.session?.user) {
        const persisted = await ensureSessionPersisted(client);
        if (!persisted) return { user: null, reason: storageRefusedSessionReason() };
        return { user: toAuthUser(data.session.user) };
      }
      return { user: null, reason: 'the sign-in token was rejected' };
    } catch (error) {
      return { user: null, reason: (error as Error)?.message || 'unknown error' };
    }
  }

  const code = query.get('code');
  if (!code) return { user: null, reason: 'Google returned no sign-in code at all' };

  // ── The one-time key has to be rescued before the client is built ──────────
  // supabase-js stores the PKCE verifier under `<storageKey>-code-verifier`. On
  // this page there is no session yet, so client construction runs its "no
  // session" cleanup (_removeSession → removeAllPKCEVerifiers), which deletes
  // EVERY pending verifier — including the one this very redirect needs. The
  // exchange then fails with "PKCE code verifier not found in storage", which
  // reads like the browser lost it. It did not: we deleted it ourselves, three
  // lines earlier.
  //
  // So take a copy first and put it back if it vanished. Cheap, local, and it
  // keeps the explicit exchange (and its real error messages) rather than going
  // back to the library's silent automatic path.
  const verifierKey = `${getAuthStorageKey()}-code-verifier`;
  let ourVerifier: string | null = null;
  try {
    ourVerifier = window.sessionStorage.getItem(VERIFIER_KEY)
      || window.localStorage.getItem(VERIFIER_KEY)
      || window.localStorage.getItem(verifierKey);
  } catch {
    /* storage unavailable — the exchange will report it properly below */
  }
  // Room for the library's own bookkeeping, for the same reason as at sign-in.
  makeRoomForCriticalWrite();

  const client = await getSupabase();
  if (!client) return { user: null, reason: 'the sign-in library could not be loaded' };

  // Put it back AFTER the client is built: construction is what wipes it.
  try {
    if (ourVerifier) window.localStorage.setItem(verifierKey, ourVerifier);
  } catch {
    /* ignore */
  }

  try {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) return { user: null, reason: describeExchangeFailure(error.message, Boolean(ourVerifier)) };
    if (data.session?.user) {
      const persisted = await ensureSessionPersisted(client);
      if (!persisted) return { user: null, reason: storageRefusedSessionReason() };
      return { user: toAuthUser(data.session.user) };
    }
    return { user: null, reason: 'the code was accepted but no session came back' };
  } catch (error) {
    return { user: null, reason: describeExchangeFailure((error as Error)?.message || 'unknown error', Boolean(ourVerifier)) };
  } finally {
    // Single use, whatever happened.
    try { window.localStorage.removeItem(VERIFIER_KEY); } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(VERIFIER_KEY); } catch { /* ignore */ }
  }
};

/**
 * Two different problems, two different fixes — and the browser reports both with
 * the same useless error, which is why this is worked out rather than guessed.
 */
const storageRefusedSessionReason = (): string => (
  storageAcceptsWrites()
    ? 'You were signed in, but this browser did not keep the session. Storage accepts writes, so something is removing them — check for a privacy extension, or a "clear site data on close" setting for this site.'
    : 'You were signed in, but this browser refuses to store anything for this site, so the session could not be kept. That is a browser setting, not a full disk: allow cookies and site data for this address (in Chrome: the icon left of the address bar → Site settings → Cookies and site data), then try again.'
);

/**
 * A signed-in session that is not written down is a sign-in that lasts one page.
 *
 * The whole app decides who you are by reading the session out of storage on the
 * next page load. If that write was refused — full quota, blocked site data — the
 * visitor sails back to the homepage as an anonymous visitor and nothing explains
 * why. So: check the write actually landed, and if it did not, make room and let
 * the library try once more before admitting defeat.
 */
const ensureSessionPersisted = async (client: SupabaseClient): Promise<boolean> => {
  const key = getAuthStorageKey();
  if (!key) return true;

  const stored = () => {
    try {
      return Boolean(window.localStorage.getItem(key));
    } catch {
      return false;
    }
  };

  if (stored()) return true;

  // Two escalating attempts: drop the caches, then drop everything that is not
  // essential. Signing in wins over every other thing this app keeps locally.
  for (const purge of [makeRoomForCriticalWrite, purgeAllButEssential]) {
    purge();
    try {
      const { data } = await client.auth.getSession();
      if (data.session) {
        await client.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    } catch {
      /* try the next, harder purge */
    }
    if (stored()) return true;
  }
  return false;
};

/**
 * Turn the library's storage-level complaint into the thing that actually went
 * wrong. "Verifier not found" is almost never a storage fault — it is the sign-in
 * having started somewhere else.
 */
const describeExchangeFailure = (message: string, hadVerifier: boolean): string => {
  if (!/verifier/i.test(message)) return message;

  // The single most useful fact: did the sign-in ever manage to WRITE the key?
  // "Not found" means something different depending on the answer, and guessing
  // wrong sent this investigation down the wrong path twice.
  if (!hadVerifier) {
    return 'The one-time sign-in key was never saved in this browser. That usually means browser storage is full or blocked (private mode, or a "block cookies/site data" setting for localhost). Clear this site\'s data and try again.';
  }

  let startedAt = '';
  try {
    startedAt = window.localStorage.getItem(ORIGIN_KEY) || '';
  } catch {
    /* ignore */
  }
  const returnedTo = window.location.origin;

  if (startedAt && startedAt !== returnedTo) {
    return `Sign-in started at ${startedAt} but Google returned to ${returnedTo}. Those are separate browser storages, so the one-time key was left behind. Add ${startedAt}/auth/callback to the Supabase redirect URLs, or start from ${returnedTo}.`;
  }
  if (!startedAt) {
    return `${message} — and no record of this sign-in starting in this browser, so it began in another tab, another browser, or the page was reloaded instead of signing in again.`;
  }
  return `${message} (started and returned at ${returnedTo}, so the key was cleared in between — usually a second sign-in attempt, or the callback page reloaded.)`;
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  // Cheap exit: no stored session means no network call and no SDK download.
  if (!hasStoredSession()) return null;
  return withClient(async (client) => {
    const { data } = await client.auth.getSession();
    return toAuthUser(data.session?.user);
  }, null);
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!hasStoredSession()) return null;
  return withClient(async (client) => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  }, null);
};

export const signOut = async (): Promise<void> => {
  await withClient(async (client) => {
    await client.auth.signOut();
    return null;
  }, null);
};

/**
 * Subscribe to sign-in/sign-out. Returns an unsubscribe function immediately, so
 * a component can clean up even if the SDK is still loading.
 */
export const onAuthChange = (handler: (user: AuthUser | null) => void): (() => void) => {
  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  void getSupabase().then((client) => {
    if (!client || cancelled) return;
    const { data } = client.auth.onAuthStateChange((_event: string, session: Session | null) => {
      handler(toAuthUser(session?.user));
    });
    unsubscribe = () => data.subscription.unsubscribe();
  });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
};

/**
 * Delete the account and everything attached to it (GDPR right to erasure).
 * Deleting the auth user cascades every table in the schema; that deletion needs
 * the service role, so it goes through our own function rather than the browser.
 */
export const deleteAccount = async (): Promise<{ ok: boolean; error?: string }> => {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: 'not-signed-in' };

  try {
    const response = await fetch('/api/account-delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    await signOut();
    return { ok: true };
  } catch (error) {
    console.error('Account deletion failed.', error);
    return { ok: false, error: 'network' };
  }
};
