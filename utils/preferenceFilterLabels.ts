import { LanguageCode, Translation, UserPreferences } from '../types';

export const QUICK_PREFERENCE_FILTERS = [
  'blueFlag2026',
  'disabledAccess',
  'sandy',
  'pebbles',
  'quiet',
  'beachBar',
  'easyAccess',
  'snorkeling',
  'familyFriendly',
  'deepWater',
  'shallowWater',
  // Last in the row on purpose: only ~10 beaches nationally qualify, and the chip
  // is hidden outright where none is in season, so it must never push a
  // universally-useful filter off the visible strip.
  'surfing',
] as const satisfies readonly (keyof UserPreferences)[];

export type QuickPreferenceFilter = (typeof QUICK_PREFERENCE_FILTERS)[number];

const compactPreferenceLabels: Record<LanguageCode, Partial<Record<keyof UserPreferences, string>>> = {
  gr: {
    blueFlag2026: 'Γαλάζια Σημαία',
    disabledAccess: 'Προσβάσιμη ΑμεΑ',
    sandy: 'Άμμος',
    pebbles: 'Βότσαλα',
    quiet: 'Ήσυχη',
    beachBar: 'Beach bar',
    easyAccess: 'Εύκολη πρόσβαση',
    snorkeling: 'Snorkeling',
    familyFriendly: 'Οικογένεια',
    deepWater: 'Βαθιά',
    shallowWater: 'Ρηχά',
    surfing: 'Σερφ',
  },
  en: {
    blueFlag2026: 'Blue Flag',
    disabledAccess: 'Accessible',
    sandy: 'Sandy',
    pebbles: 'Pebbles',
    quiet: 'Quiet',
    beachBar: 'Beach bar',
    easyAccess: 'Easy access',
    snorkeling: 'Snorkeling',
    familyFriendly: 'Family-friendly',
    deepWater: 'Deep water',
    shallowWater: 'Shallow water',
    surfing: 'Surf',
  },
  fr: {
    blueFlag2026: 'Pavillon Bleu',
    disabledAccess: 'Accessible PMR',
    sandy: 'Sable',
    pebbles: 'Galets',
    quiet: 'Calme',
    beachBar: 'Bar de plage',
    easyAccess: 'Accès facile',
    snorkeling: 'Snorkeling',
    familyFriendly: 'Famille',
    deepWater: 'Eau profonde',
    shallowWater: 'Eau peu profonde',
    surfing: 'Surf',
  },
  de: {
    blueFlag2026: 'Blaue Flagge',
    disabledAccess: 'Barrierefrei',
    sandy: 'Sand',
    pebbles: 'Kiesel',
    quiet: 'Ruhig',
    beachBar: 'Beach Bar',
    easyAccess: 'Einfacher Zugang',
    snorkeling: 'Schnorcheln',
    familyFriendly: 'Familie',
    deepWater: 'Tiefes Wasser',
    shallowWater: 'Flaches Wasser',
    surfing: 'Surfen',
  },
  it: {
    blueFlag2026: 'Bandiera Blu',
    disabledAccess: 'Accessibile',
    sandy: 'Sabbia',
    pebbles: 'Ciottoli',
    quiet: 'Tranquilla',
    beachBar: 'Beach bar',
    easyAccess: 'Accesso facile',
    snorkeling: 'Snorkeling',
    familyFriendly: 'Famiglia',
    deepWater: 'Acqua profonda',
    shallowWater: 'Acqua bassa',
    surfing: 'Surf',
  },
};

/**
 * The same chip word, for callers that have a language but no translation
 * object — the account panel is one, since it is lazy-loaded and deliberately
 * never pulls the full translation bundle in behind it. Every quick filter has
 * a hand-written entry in all five languages above, so nothing falls through
 * to the key name; the guard is there for a key added to one language only.
 */
export const getPreferenceFilterWord = (
  key: QuickPreferenceFilter,
  language: LanguageCode
): string => compactPreferenceLabels[language][key] || compactPreferenceLabels.en[key] || String(key);

export const getPreferenceFilterLabel = (
  key: keyof UserPreferences,
  language: LanguageCode,
  t: Translation
): string => {
  return compactPreferenceLabels[language][key] || t.userPreferences[key] || String(key);
};

export const getActivePreferenceFilters = (
  preferences: UserPreferences,
  language: LanguageCode,
  t: Translation
): Array<{ key: QuickPreferenceFilter; label: string }> =>
  QUICK_PREFERENCE_FILTERS
    .filter(key => preferences[key])
    .map(key => ({ key, label: getPreferenceFilterLabel(key, language, t) }));
