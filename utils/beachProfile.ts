// The saved beach profile: "what I like in a beach", chosen once in the account.
//
// WHAT IT IS FOR. The filter chips answer a question about today on one island.
// This answers a standing one — someone who always wants shallow water for the
// kids should not have to re-tick that on every island, on every device, every
// morning. It is stored with the account and follows them.
//
// ────────────────────────────────────────────────────────────────────────────
// IT REORDERS. IT NEVER HIDES.  (Miltos, 10/08/2026)
// ────────────────────────────────────────────────────────────────────────────
// The chips hide: tick "beach bar" and a beach without one leaves the list. That
// is fine for a deliberate, visible, this-minute choice — the chip is lit on
// screen and explains the short list. A saved profile is the opposite: it is
// invisible, it is on for weeks, and it applies to islands the person has not
// looked at yet. Hiding on those terms produces the worst failure this app can
// have — an empty region, or a genuinely calm beach missing from a windy day's
// podium, because of a preference for a beach bar the person set in June.
//
// So a matching beach moves forward and a non-matching one moves back. Nothing
// leaves.
//
// ────────────────────────────────────────────────────────────────────────────
// AND IT NEVER OUTRANKS THE WIND.
// ────────────────────────────────────────────────────────────────────────────
// The whole product is one promise: the beach at the top is the one that is
// calm today. A comfort preference that could push a windier beach above a
// calmer one would break exactly that promise, quietly, for the people who
// trusted us enough to make an account.
//
// The guard is structural rather than a rule someone has to remember:
// `orderByBeachProfile` only ever reorders beaches INSIDE a group the caller
// declares equivalent (same Beaufort at the beach, same exposure standing). It
// physically cannot move a beach past a calmer one — it writes the reordered
// members back into the very positions their own group already occupied, so the
// wind sequence that came in is the wind sequence that goes out.

import type { Beach, BeachProfile, UserPreferences } from '../types';
import { beachMatchesUserPreferences } from '../services/recommendationService';
import { setStoredJson } from './safeStorage';

export const BEACH_PROFILE_STORAGE_KEY = 'beachProfile';

export const EMPTY_WISHES: UserPreferences = {
  blueFlag2026: false,
  disabledAccess: false,
  sandy: false,
  pebbles: false,
  quiet: false,
  beachBar: false,
  familyFriendly: false,
  snorkeling: false,
  deepWater: false,
  shallowWater: false,
  surfing: false,
  parking: false,
  easyAccess: false,
};

export const DEFAULT_BEACH_PROFILE: BeachProfile = {
  enabled: false,
  wishes: EMPTY_WISHES,
};

/** Tolerates anything: a half-written blob from an older version, or nonsense. */
export const normalizeBeachProfile = (value: unknown): BeachProfile => {
  if (!value || typeof value !== 'object') return DEFAULT_BEACH_PROFILE;
  const raw = value as Partial<BeachProfile>;
  const wishes = { ...EMPTY_WISHES };
  if (raw.wishes && typeof raw.wishes === 'object') {
    (Object.keys(EMPTY_WISHES) as Array<keyof UserPreferences>).forEach(key => {
      wishes[key] = (raw.wishes as UserPreferences)[key] === true;
    });
  }
  return { enabled: raw.enabled === true, wishes };
};

export const readStoredBeachProfile = (): BeachProfile => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_BEACH_PROFILE;
  }
  try {
    const raw = window.localStorage.getItem(BEACH_PROFILE_STORAGE_KEY);
    return raw ? normalizeBeachProfile(JSON.parse(raw)) : DEFAULT_BEACH_PROFILE;
  } catch {
    return DEFAULT_BEACH_PROFILE;
  }
};

export const storeBeachProfile = (profile: BeachProfile): void => {
  setStoredJson(BEACH_PROFILE_STORAGE_KEY, profile);
};

export const listProfileWishes = (profile: BeachProfile): Array<keyof UserPreferences> =>
  (Object.keys(EMPTY_WISHES) as Array<keyof UserPreferences>).filter(key => profile.wishes[key]);

/**
 * A switch that is on but empty must behave exactly like a switch that is off,
 * or the whole app quietly enters "profile mode" for no reason.
 */
export const isBeachProfileActive = (profile: BeachProfile | undefined | null): boolean =>
  Boolean(profile?.enabled) && listProfileWishes(profile as BeachProfile).length > 0;

/**
 * How many of the person's wishes this beach actually grants.
 *
 * Each wish is asked on its own rather than handed to the matcher as one set,
 * because the matcher answers all-or-nothing and we need a degree: with three
 * wishes ticked, a beach that grants two should still come before one that
 * grants none. Sandy and pebbles are the reason this matters — the matcher
 * treats them as one OR'd question about the surface, so a set containing both
 * would score identically for either kind.
 */
export const countProfileMatches = (beach: Beach, profile: BeachProfile): number =>
  listProfileWishes(profile).reduce(
    (total, key) => (beachMatchesUserPreferences(beach, { ...EMPTY_WISHES, [key]: true }) ? total + 1 : total),
    0,
  );

/**
 * Move the beaches this person asked for to the front — WITHIN equivalence
 * groups only, so the ranking that matters (wind, then shelter) survives intact.
 *
 * `groupOf` names the group. Callers pass the beach's own Beaufort plus its
 * exposure standing: two beaches that share both are, as far as today's weather
 * is concerned, the same answer, and which of the two leads is exactly the kind
 * of question a personal preference should settle.
 *
 * Members are written back into their group's original positions, so the
 * sequence of groups down the list is untouched. Sorting is stable, so beaches
 * granting the same number of wishes keep the order the weather gave them.
 */
export const orderByBeachProfile = <T,>(
  items: T[],
  profile: BeachProfile,
  beachOf: (item: T) => Beach,
  groupOf: (item: T) => string,
): T[] => {
  if (items.length < 2 || !isBeachProfileActive(profile)) return items;

  const positionsByGroup = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = groupOf(item);
    const positions = positionsByGroup.get(key);
    if (positions) positions.push(index);
    else positionsByGroup.set(key, [index]);
  });

  const result = [...items];
  let moved = false;

  positionsByGroup.forEach(positions => {
    if (positions.length < 2) return;
    const ranked = positions
      .map((position, order) => ({
        item: items[position],
        matches: countProfileMatches(beachOf(items[position]), profile),
        order,
      }))
      .sort((a, b) => b.matches - a.matches || a.order - b.order);

    ranked.forEach((entry, index) => {
      const target = positions[index];
      if (result[target] !== entry.item) moved = true;
      result[target] = entry.item;
    });
  });

  return moved ? result : items;
};
