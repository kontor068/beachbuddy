// The filters follow the account, the same way saved beaches do.
//
// WHY IT EXISTS. `user_preferences` has been in the schema since the first
// migration and nothing has ever written to it. So the account panel could
// honestly say "we keep the search settings you chose" (the table exists) while
// the person's actual experience was that ticking six filters on the laptop
// bought them nothing on the phone. That gap is the kind that makes an account
// feel pointless.
//
// ────────────────────────────────────────────────────────────────────────────
// SIGNED OUT ⇒ NOTHING HAPPENS. Same rule as useFavoritesSync: no fetch, no
// library, no write. Filters have worked out of localStorage since long before
// accounts and keep working identically for everyone who never signs in.
// ────────────────────────────────────────────────────────────────────────────
//
// LAST WRITE WINS, NOT A UNION — and this is the one place it differs from
// saved beaches. Two saved lists merge sensibly because each beach is an
// independent choice. Two filter sets do not: unioning "quiet" from the laptop
// with "beach bar" from the phone produces a combination the person never chose
// and cannot explain, and on this app a wrong filter silently hides beaches.
// So the most recent deliberate choice wins, and the other device follows it.

import { useEffect, useRef } from 'react';
import type { UserPreferences } from '../types';
import { getSupabase } from '../services/supabaseClient';
import { setStoredJson } from '../utils/safeStorage';

/** Debounce: toggling five filters in a row is one intent, not five round trips. */
const WRITE_DELAY_MS = 1200;

type Options = {
  userId: string | null;
  /** The live local preferences — the source of truth while signed out. */
  preferences: UserPreferences;
  /** Called when the ACCOUNT holds something newer than this device. */
  onRemotePreferences: (next: UserPreferences) => void;
};

export const usePreferencesSync = ({ userId, preferences, onRemotePreferences }: Options) => {
  const onRemoteRef = useRef(onRemotePreferences);
  onRemoteRef.current = onRemotePreferences;

  // Skip the very first write after a load: that value came FROM the account (or
  // from localStorage), so echoing it straight back is a pointless round trip
  // that also overwrites a newer choice made on another device seconds earlier.
  const hydratedRef = useRef(false);
  const lastWrittenRef = useRef<string>('');

  // ── Pull on sign-in ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const pull = async () => {
      const client = await getSupabase();
      if (!client || cancelled) return;

      const { data, error } = await client
        .from('user_preferences')
        .select('preferences, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('Could not read your saved settings.', error);
        hydratedRef.current = true;
        return;
      }

      const remote = data?.preferences as UserPreferences | undefined;
      if (remote && typeof remote === 'object') {
        lastWrittenRef.current = JSON.stringify(remote);
        setStoredJson('userPreferences', remote);
        onRemoteRef.current(remote);
      }
      hydratedRef.current = true;
    };

    void pull();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Push on change ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !hydratedRef.current) return undefined;

    const serialized = JSON.stringify(preferences);
    if (serialized === lastWrittenRef.current) return undefined;

    const timer = window.setTimeout(() => {
      void (async () => {
        const client = await getSupabase();
        if (!client) return;
        const { error } = await client
          .from('user_preferences')
          .upsert(
            // athens-clock-exempt: a row's last-write instant, not a time of day.
            // It is compared against other absolute timestamps (and only ever by
            // the database), so shifting it to Athens wall-clock would make a row
            // written from abroad look newer or older than it is.
            { user_id: userId, preferences, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
        if (error) {
          // Best-effort: the local copy is already correct, so the visitor loses
          // nothing now and the next change tries again.
          console.error('Could not save your settings to your account.', error);
          return;
        }
        lastWrittenRef.current = serialized;
      })();
    }, WRITE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [preferences, userId]);
};

export default usePreferencesSync;
