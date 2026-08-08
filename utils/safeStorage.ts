// Writing to localStorage must never take the app down.
//
// WHY THIS EXISTS. On 08/08/2026 a full localStorage produced a white error page
// on every interaction: `localStorage.setItem('favorites', …)` threw
// QuotaExceededError, React unwound, and the root error boundary took over. The
// visitor saw "The app encountered an error" for the crime of tapping a heart.
//
// It also broke something that looked completely unrelated. Signing in with
// Google failed with "PKCE code verifier not found in storage" — because the
// one-time key the sign-in writes could not be stored either. A full disk does
// not announce itself; it makes unrelated features fail in unrelated ways.
//
// The weather cache already knew this (services/weatherService.ts purges its own
// entries on quota and retries). Everything else did not. This is that same
// behaviour, in one place, for everyone else.

/** Cache prefixes that are safe to drop: all of them refetch on demand. */
const DISPOSABLE_PREFIXES = ['forecast_', 'marine_', 'weather_'];

/**
 * Drop the disposable caches on purpose, before doing something that MUST be able
 * to write. Signing in is the case that matters: one region view can persist
 * several megabytes of forecasts, which is most of a browser's ~5 MB budget, and
 * the sign-in library swallows the resulting quota error — so the one-time key it
 * needs is silently never stored and the sign-in fails minutes later, somewhere
 * else, with a message about storage that reads like the browser's fault.
 *
 * Returns how many entries were dropped. They all refetch on demand.
 */
export const makeRoomForCriticalWrite = (): number => purgeDisposable();

/**
 * Keys worth more than a sign-in. Everything else in localStorage is either a
 * cache, a convenience, or something the account itself will restore.
 */
const ESSENTIAL_KEYS = new Set([
  'calmbeach_consent_log',   // legal evidence of what the visitor agreed to
  'calmbeach:auth:verifier', // the sign-in in progress
  'calmBeachLanguage',
  'calmBeachLanguagePreferenceSet',
  'favorites',               // restored from the account, but not before it exists
  'cb_optout',               // an opt-out must never be silently forgotten
]);

/**
 * Last resort before telling someone their browser will not let them sign in:
 * drop everything that is not essential, keeping only the short list above and
 * anything supabase-js owns.
 *
 * Used only when a critical write has already failed after the gentle purge. The
 * trade is deliberate — a lost weather cache and a forgotten map style are
 * nothing next to "you cannot have an account on this device".
 */
export const purgeAllButEssential = (): number => {
  let removed = 0;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (ESSENTIAL_KEYS.has(key)) continue;
      if (key.startsWith('sb-')) continue; // the session and its bookkeeping
      window.localStorage.removeItem(key);
      removed += 1;
    }
  } catch {
    /* nothing else to try */
  }
  return removed;
};

/**
 * Distinguishes "no room" from "not allowed". They read identically in every
 * browser error message and need opposite advice from the visitor.
 */
export const storageAcceptsWrites = (): boolean => {
  try {
    const probe = '__calmbeach_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

const purgeDisposable = (): number => {
  let removed = 0;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (DISPOSABLE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
        removed += 1;
      }
    }
  } catch {
    /* nothing else to try */
  }
  return removed;
};

const isQuotaError = (error: unknown): boolean =>
  error instanceof DOMException && (
    error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    // Safari's private mode reports the old numeric code with no useful name.
    || error.code === 22
  );

/**
 * Write to localStorage, and if the browser is out of room, make room by dropping
 * the weather caches (which cost one refetch) and try once more.
 *
 * Returns whether the value was stored. It never throws: a saved beach that does
 * not survive a reload is a small loss, and a blank page is a total one.
 */
export const setStoredValue = (key: string, value: string): boolean => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) {
      console.warn(`Could not store "${key}".`, error);
      return false;
    }

    const removed = purgeDisposable();
    try {
      window.localStorage.setItem(key, value);
      if (removed > 0) {
        console.warn(`Browser storage was full; dropped ${removed} cached forecast entries to save "${key}".`);
      }
      return true;
    } catch {
      console.warn(`Browser storage is full and "${key}" could not be saved even after clearing the forecast cache.`);
      return false;
    }
  }
};

/** JSON convenience wrapper — the shape almost every caller actually wants. */
export const setStoredJson = (key: string, value: unknown): boolean => {
  try {
    return setStoredValue(key, JSON.stringify(value));
  } catch {
    return false;
  }
};
