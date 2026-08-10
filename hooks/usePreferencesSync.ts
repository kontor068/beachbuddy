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

// ────────────────────────────────────────────────────────────────────────────
// THE SAVED PROFILE RIDES ALONG — same row, same write.
// It could have had its own hook, and that would have been two writers racing
// for one row: an upsert carrying only `preferences` and another carrying only
// `beach_profile`, each stamping `updated_at`, interleaving unpredictably. One
// hook that owns the row end to end has no such race.
// The column arrived later than the table (migration 0004), so every read and
// write here survives it being absent — code reaches Netlify before anyone runs
// SQL, and a missing column must not take the filters down with it.
// ────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { BeachProfile, UserPreferences } from '../types';
import { getSupabase } from '../services/supabaseClient';
import { normalizeBeachProfile, storeBeachProfile } from '../utils/beachProfile';
import { setStoredJson } from '../utils/safeStorage';

/** Debounce: toggling five filters in a row is one intent, not five round trips. */
const WRITE_DELAY_MS = 1200;

/** Postgres `undefined_column` — migration 0004 has not been run on this project. */
const UNDEFINED_COLUMN = '42703';

const isMissingProfileColumn = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error && (error.code === UNDEFINED_COLUMN || /beach_profile/i.test(error.message || '')));

type Options = {
  userId: string | null;
  /** The live local preferences — the source of truth while signed out. */
  preferences: UserPreferences;
  /** Called when the ACCOUNT holds something newer than this device. */
  onRemotePreferences: (next: UserPreferences) => void;
  /** The saved "what I like in a beach" profile, same row as the filters. */
  profile: BeachProfile;
  onRemoteProfile: (next: BeachProfile) => void;
};

export const usePreferencesSync = ({
  userId,
  preferences,
  onRemotePreferences,
  profile,
  onRemoteProfile,
}: Options) => {
  const onRemoteRef = useRef(onRemotePreferences);
  onRemoteRef.current = onRemotePreferences;
  const onRemoteProfileRef = useRef(onRemoteProfile);
  onRemoteProfileRef.current = onRemoteProfile;

  // Latched by the first read that comes back complaining about the column, and
  // it stays latched for the session: without it every debounce would rediscover
  // the same missing column with the same failed round trip.
  const [hasProfileColumn, setHasProfileColumn] = useState(true);

  // Skip the very first write after a load: that value came FROM the account (or
  // from localStorage), so echoing it straight back is a pointless round trip
  // that also overwrites a newer choice made on another device seconds earlier.
  const hydratedRef = useRef(false);
  const lastWrittenRef = useRef<string>('');

  // Read by the pull, which must not re-run whenever a filter is toggled — so
  // the live values reach it through refs rather than through its dependencies.
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // ── Pull on sign-in ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    const pull = async () => {
      const client = await getSupabase();
      if (!client || cancelled) return;

      const read = (columns: string) => client
        .from('user_preferences')
        .select(columns)
        .eq('user_id', userId)
        .maybeSingle();

      let { data, error } = await read('preferences, beach_profile, updated_at');
      let profileColumnPresent = true;
      if (error && isMissingProfileColumn(error)) {
        // Migration 0004 has not been run yet. The filters still work; the
        // profile simply stays on this device until the column exists.
        profileColumnPresent = false;
        ({ data, error } = await read('preferences, updated_at'));
      }

      if (cancelled) return;
      if (!profileColumnPresent) setHasProfileColumn(false);
      if (error) {
        console.error('Could not read your saved settings.', error);
        hydratedRef.current = true;
        return;
      }

      const row = (data || {}) as { preferences?: unknown; beach_profile?: unknown };
      const remote = row.preferences as UserPreferences | undefined;
      if (remote && typeof remote === 'object') {
        setStoredJson('userPreferences', remote);
        onRemoteRef.current(remote);
      }

      // An empty object is what the column defaults to for everyone who had a
      // row before this feature existed — it is "nothing saved", not a profile
      // with the switch off, so it must not overwrite what is on this device.
      const remoteProfile = row.beach_profile;
      const hasRemoteProfile = Boolean(
        remoteProfile && typeof remoteProfile === 'object' && Object.keys(remoteProfile).length > 0,
      );
      const nextProfile = hasRemoteProfile ? normalizeBeachProfile(remoteProfile) : profileRef.current;
      if (hasRemoteProfile) {
        storeBeachProfile(nextProfile);
        onRemoteProfileRef.current(nextProfile);
      }

      lastWrittenRef.current = JSON.stringify({
        preferences: remote && typeof remote === 'object' ? remote : preferencesRef.current,
        profile: nextProfile,
      });
      hydratedRef.current = true;
    };

    void pull();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Push on change ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !hydratedRef.current) return undefined;

    const serialized = JSON.stringify({ preferences, profile });
    if (serialized === lastWrittenRef.current) return undefined;

    const timer = window.setTimeout(() => {
      void (async () => {
        const client = await getSupabase();
        if (!client) return;
        const { error } = await client
          .from('user_preferences')
          .upsert(
            {
              user_id: userId,
              preferences,
              ...(hasProfileColumn ? { beach_profile: profile } : {}),
              // athens-clock-exempt: a row's last-write instant, not a time of day.
              // It is compared against other absolute timestamps (and only ever by
              // the database), so shifting it to Athens wall-clock would make a row
              // written from abroad look newer or older than it is.
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );
        if (error) {
          if (isMissingProfileColumn(error)) setHasProfileColumn(false);
          // Best-effort: the local copy is already correct, so the visitor loses
          // nothing now and the next change tries again.
          console.error('Could not save your settings to your account.', error);
          return;
        }
        lastWrittenRef.current = serialized;
      })();
    }, WRITE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [preferences, profile, userId, hasProfileColumn]);
};

export default usePreferencesSync;
