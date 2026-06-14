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
] as const satisfies readonly (keyof UserPreferences)[];

export type QuickPreferenceFilter = (typeof QUICK_PREFERENCE_FILTERS)[number];

const compactPreferenceLabels: Record<LanguageCode, Partial<Record<keyof UserPreferences, string>>> = {
  gr: {
    blueFlag2026: 'Γαλάζια Σημαία',
    disabledAccess: 'Προσβάσιμη ΑμεΑ',
    sandy: 'Άμμος',
    pebbles: 'Βότσαλο',
    quiet: 'Ήσυχη',
    beachBar: 'Beach bar',
    easyAccess: 'Εύκολη πρόσβαση',
    snorkeling: 'Snorkeling',
    familyFriendly: 'Οικογένεια',
    deepWater: 'Βαθιά',
    shallowWater: 'Ρηχά',
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
  },
};

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
