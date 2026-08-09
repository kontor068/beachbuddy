// Saved beaches, on every device.
//
// ────────────────────────────────────────────────────────────────────────────
// THE ONE RULE: SIGNED OUT ⇒ THIS HOOK DOES NOTHING.
//
// Not "does very little" — nothing. No fetch, no Supabase library, no extra
// render, no change to localStorage. Saved beaches have worked out of
// localStorage since long before accounts existed and they keep working exactly
// the same way for the ~99% of visitors who never sign in. Every early return
// below exists to protect that, and scripts/auditLoggedOutParity-style checks
// are what keep it honest.
// ────────────────────────────────────────────────────────────────────────────
//
// MERGE, DO NOT REPLACE. The first time an account signs in on a device, the
// beaches already saved in this browser and the beaches already saved on the
// account are UNIONED. Replacing in either direction throws away something a
// real person chose to keep — and "my saved beaches disappeared" is the kind of
// bug nobody forgives.
//
// The merge runs once per account per device (a flag in localStorage records
// it). That matters: without it, un-saving a beach on the phone would be undone
// on the next load by the stale local list, forever.
//
// WHY A FETCHED MAP. The server stores (region_id, beach_id) — the pair URLs and
// the prerender are built on — while localStorage has only bare ids. The lookup
// table comes from public/data/beaches/favorite-region-map.json (built by
// scripts/buildFavoriteRegionMap.mjs) and is fetched ONLY when signed in.

import { useEffect, useRef } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { setStoredJson } from '../utils/safeStorage';

type FavoriteRegionMap = Record<string, string>;

let regionMapPromise: Promise<FavoriteRegionMap | null> | null = null;

const loadRegionMap = (): Promise<FavoriteRegionMap | null> => {
  if (regionMapPromise) return regionMapPromise;
  regionMapPromise = fetch('/data/beaches/favorite-region-map.json')
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);
  return regionMapPromise;
};

const mergedFlagKey = (userId: string) => `calmbeach:favoritesMerged:${userId}`;

const readLocalFavorites = (): number[] => {
  try {
    const raw = window.localStorage.getItem('favorites');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isFinite(id)) : [];
  } catch {
    return [];
  }
};

const writeLocalFavorites = (ids: number[]): void => {
  // Goes through the safe writer: a full localStorage must not throw here either,
  // and if it is full the forecast caches are the right thing to sacrifice.
  setStoredJson('favorites', ids);
};

type Options = {
  /** The signed-in user's id, or null when signed out. */
  userId: string | null;
  /** Called with the reconciled list so the app's own state follows the account. */
  onFavorites: (ids: number[]) => void;
};

export const useFavoritesSync = ({ userId, onFavorites }: Options) => {
  // Keep the callback in a ref so a new inline function on every render of App
  // cannot re-trigger the merge.
  const onFavoritesRef = useRef(onFavorites);
  onFavoritesRef.current = onFavorites;

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    const reconcile = async () => {
      const client = await getSupabase();
      if (!client || cancelled) return;

      const { data, error } = await client
        .from('favorites')
        .select('region_id, beach_id')
        .eq('user_id', userId);

      if (error) {
        // A read failure must leave the visitor with their local list untouched.
        console.error('Could not read saved beaches.', error);
        return;
      }
      if (cancelled) return;

      const serverIds: number[] = (data || [])
        .map((row: { beach_id: number }) => Number(row.beach_id))
        .filter(Number.isFinite);

      const alreadyMerged = (() => {
        try {
          return Boolean(window.localStorage.getItem(mergedFlagKey(userId)));
        } catch {
          return false;
        }
      })();

      if (alreadyMerged) {
        // The account is the truth from here on: an un-save made on another
        // device has to survive a reload on this one.
        writeLocalFavorites(serverIds);
        onFavoritesRef.current(serverIds);
        return;
      }

      const localIds = readLocalFavorites();
      const union = Array.from(new Set([...serverIds, ...localIds]));
      const onlyLocal = localIds.filter(id => !serverIds.includes(id));

      if (onlyLocal.length > 0) {
        const regionMap = await loadRegionMap();
        if (cancelled) return;

        const rows = onlyLocal
          .map(id => ({ id, regionId: regionMap?.[String(id)] }))
          // A beach we cannot place is skipped rather than guessed: an id filed
          // under the wrong region is a saved beach that opens the wrong page.
          .filter((entry): entry is { id: number; regionId: string } => Boolean(entry.regionId))
          .map(entry => ({ user_id: userId, region_id: entry.regionId, beach_id: entry.id }));

        if (rows.length > 0) {
          const { error: insertError } = await client
            .from('favorites')
            .upsert(rows, { onConflict: 'user_id,region_id,beach_id', ignoreDuplicates: true });
          if (insertError) {
            // Do not set the merged flag: the next load tries again, and nothing
            // was lost in the meantime because the local list is still intact.
            console.error('Could not upload saved beaches.', insertError);
            onFavoritesRef.current(union);
            return;
          }
        }
      }

      if (cancelled) return;
      writeLocalFavorites(union);
      onFavoritesRef.current(union);
      try {
        // athens-clock-exempt: a bookkeeping instant ("this device merged this
        // account"), never a calendar day or a time-of-day decision. Nothing is
        // displayed from it and nothing compares it to Greek local time.
        window.localStorage.setItem(mergedFlagKey(userId), new Date().toISOString());
      } catch {
        /* worst case the merge runs again next time, which is harmless */
      }
    };

    void reconcile();
    return () => { cancelled = true; };
  }, [userId]);
};

/**
 * Mirror one save/un-save to the account. Best-effort and fire-and-forget by
 * design: localStorage is written first by the caller, so the UI is instant and
 * a dropped request costs at most one beach out of sync until the next reload.
 * Does nothing at all when signed out.
 */
export const syncFavoriteToggle = async (
  userId: string | null,
  beachId: number,
  isSaved: boolean,
): Promise<void> => {
  if (!userId || !Number.isFinite(beachId)) return;

  try {
    const client = await getSupabase();
    if (!client) return;

    if (!isSaved) {
      await client.from('favorites').delete().eq('user_id', userId).eq('beach_id', beachId);
      return;
    }

    const regionMap = await loadRegionMap();
    const regionId = regionMap?.[String(beachId)];
    if (!regionId) return;

    await client
      .from('favorites')
      .upsert(
        { user_id: userId, region_id: regionId, beach_id: beachId },
        { onConflict: 'user_id,region_id,beach_id', ignoreDuplicates: true },
      );
  } catch (error) {
    console.error('Could not sync a saved beach.', error);
  }
};

export default useFavoritesSync;
