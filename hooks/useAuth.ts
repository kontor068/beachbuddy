// Who is signed in, for components that need to know.
//
// The important behaviour is what this hook does NOT do: with no stored session
// it never touches the Supabase library, so a first-time visitor pays nothing for
// the existence of accounts. Only a returning signed-in visitor loads the SDK,
// and even then it waits for the browser to be idle so it never competes with
// the first paint.

import { useCallback, useEffect, useState } from 'react';
import {
  type AuthUser,
  getCurrentUser,
  hasStoredSession,
  isAuthAvailable,
  onAuthChange,
  signInWithGoogle,
  signOut as signOutUser,
} from '../services/authService';

export type AuthStatus =
  /** Accounts are not configured in this build — behave as if the feature does not exist. */
  | 'unavailable'
  /** Nobody is signed in on this device. */
  | 'signed-out'
  /** A session exists and is being restored. */
  | 'loading'
  | 'signed-in';

const whenIdle = (fn: () => void): (() => void) => {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const handle = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(fn, 400);
  return () => window.clearTimeout(timer);
};

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!isAuthAvailable()) return 'unavailable';
    return hasStoredSession() ? 'loading' : 'signed-out';
  });

  useEffect(() => {
    if (status === 'unavailable') return undefined;
    // No session ⇒ nothing to restore and nothing to subscribe to. Signing in is a
    // full-page redirect, so there is no state change to miss here.
    if (!hasStoredSession()) return undefined;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const cancelIdle = whenIdle(() => {
      void getCurrentUser().then((restored) => {
        if (cancelled) return;
        setUser(restored);
        setStatus(restored ? 'signed-in' : 'signed-out');
      });

      unsubscribe = onAuthChange((next) => {
        if (cancelled) return;
        setUser(next);
        setStatus(next ? 'signed-in' : 'signed-out');
      });
    });

    return () => {
      cancelled = true;
      cancelIdle();
      unsubscribe?.();
    };
    // Runs once: `status` is only read for the unavailable short-circuit, which
    // cannot change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (returnTo?: string) => {
    const result = await signInWithGoogle(returnTo);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setStatus('signed-out');
  }, []);

  return {
    user,
    status,
    isAvailable: status !== 'unavailable',
    isSignedIn: status === 'signed-in' && Boolean(user),
    signIn,
    signOut,
  };
};

export default useAuth;
