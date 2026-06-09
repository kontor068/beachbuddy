import type { FilterKey, LanguageCode, Translation, UserPreferences } from '../types';
import { getPreferenceFilterLabel, QUICK_PREFERENCE_FILTERS } from './preferenceFilterLabels';

type FilterTitleCopy = {
  prefix: string;
  fallback: string;
  more: (count: number) => string;
  conjunction: string;
};

type GreekFilterTitleToken = {
  kind: 'adjective' | 'purpose' | 'with';
  label: string;
};

const filterTitleCopy: Record<LanguageCode, FilterTitleCopy> = {
  en: {
    prefix: 'Beaches with',
    fallback: 'Beaches with selected filters',
    more: (count) => `${count} more`,
    conjunction: 'and',
  },
  gr: {
    prefix: 'Παραλίες με',
    fallback: 'Παραλίες με τα επιλεγμένα φίλτρα',
    more: (count) => `${count} ακόμα`,
    conjunction: 'και',
  },
  fr: {
    prefix: 'Plages avec',
    fallback: 'Plages avec les filtres sélectionnés',
    more: (count) => `${count} de plus`,
    conjunction: 'et',
  },
  de: {
    prefix: 'Strände mit',
    fallback: 'Strände mit ausgewählten Filtern',
    more: (count) => `${count} weitere`,
    conjunction: 'und',
  },
  it: {
    prefix: 'Spiagge con',
    fallback: 'Spiagge con i filtri selezionati',
    more: (count) => `${count} in più`,
    conjunction: 'e',
  },
};

const preferenceTitleLabels: Record<LanguageCode, Partial<Record<keyof UserPreferences, string>>> = {
  en: {
    blueFlag2026: 'Blue Flag',
    sandy: 'sand',
    pebbles: 'pebbles',
    quiet: 'quiet spots',
    beachBar: 'beach bars',
    familyFriendly: 'family-friendly options',
    snorkeling: 'snorkeling',
    deepWater: 'deep water',
    shallowWater: 'shallow water',
    surfing: 'surfing',
    parking: 'parking',
    easyAccess: 'easy access',
  },
  gr: {
    blueFlag2026: 'Γαλάζια Σημαία',
    sandy: 'άμμο',
    pebbles: 'βότσαλο',
    quiet: 'ήσυχες',
    beachBar: 'beach bar',
    familyFriendly: 'για οικογένειες',
    snorkeling: 'snorkeling',
    deepWater: 'βαθιά νερά',
    shallowWater: 'ρηχά νερά',
    surfing: 'surfing',
    parking: 'πάρκινγκ',
    easyAccess: 'εύκολη πρόσβαση',
  },
  fr: {
    blueFlag2026: 'Pavillon Bleu',
    sandy: 'du sable',
    pebbles: 'des galets',
    quiet: 'des coins calmes',
    beachBar: 'bar de plage',
    familyFriendly: 'famille',
    snorkeling: 'snorkeling',
    deepWater: 'eau profonde',
    shallowWater: 'eau peu profonde',
    surfing: 'surf',
    parking: 'parking',
    easyAccess: 'accès facile',
  },
  de: {
    blueFlag2026: 'Blauer Flagge',
    sandy: 'Sand',
    pebbles: 'Kiesel',
    quiet: 'ruhigen Orten',
    beachBar: 'Beach Bar',
    familyFriendly: 'Familienoptionen',
    snorkeling: 'Schnorcheln',
    deepWater: 'tiefem Wasser',
    shallowWater: 'flachem Wasser',
    surfing: 'Surfen',
    parking: 'Parkplatz',
    easyAccess: 'einfachem Zugang',
  },
  it: {
    blueFlag2026: 'Bandiera Blu',
    sandy: 'sabbia',
    pebbles: 'ciottoli',
    quiet: 'zone tranquille',
    beachBar: 'beach bar',
    familyFriendly: 'opzioni per famiglie',
    snorkeling: 'snorkeling',
    deepWater: 'acqua profonda',
    shallowWater: 'acqua bassa',
    surfing: 'surf',
    parking: 'parcheggio',
    easyAccess: 'accesso facile',
  },
};

const advancedFilterTitleLabels: Record<LanguageCode, Partial<Record<FilterKey, string>>> = {
  en: {
    organized: 'organized beaches',
    naturalShade: 'natural shade',
    taverna: 'taverns',
    beachBar: 'beach bars',
    sunbeds: 'sunbeds',
    restaurant: 'restaurants',
    parking: 'parking',
    sandy: 'sand',
    pebbles: 'pebbles',
    'sandy-pebbles': 'sand and pebbles',
    rocky: 'rocky spots',
    deepWaters: 'deep water',
    shallowWaters: 'shallow water',
    easyAccess: 'easy access',
    adventure: 'adventure beaches',
  },
  gr: {
    organized: 'οργάνωση',
    naturalShade: 'φυσική σκιά',
    taverna: 'ταβέρνες',
    beachBar: 'beach bar',
    sunbeds: 'ξαπλώστρες',
    restaurant: 'εστιατόρια',
    parking: 'πάρκινγκ',
    sandy: 'άμμο',
    pebbles: 'βότσαλο',
    'sandy-pebbles': 'άμμο και βότσαλο',
    rocky: 'βραχώδη σημεία',
    deepWaters: 'βαθιά νερά',
    shallowWaters: 'ρηχά νερά',
    easyAccess: 'εύκολη πρόσβαση',
    adventure: 'περιπέτεια',
  },
  fr: {
    organized: 'plages organisées',
    naturalShade: 'ombre naturelle',
    taverna: 'tavernes',
    beachBar: 'bars de plage',
    sunbeds: 'transats',
    restaurant: 'restaurants',
    parking: 'parking',
    sandy: 'du sable',
    pebbles: 'des galets',
    'sandy-pebbles': 'sable et galets',
    rocky: 'zones rocheuses',
    deepWaters: 'eau profonde',
    shallowWaters: 'eau peu profonde',
    easyAccess: 'accès facile',
    adventure: 'plages aventure',
  },
  de: {
    organized: 'organisierten Stränden',
    naturalShade: 'natürlichem Schatten',
    taverna: 'Tavernen',
    beachBar: 'Beach Bars',
    sunbeds: 'Liegestühlen',
    restaurant: 'Restaurants',
    parking: 'Parkplatz',
    sandy: 'Sand',
    pebbles: 'Kiesel',
    'sandy-pebbles': 'Sand und Kieseln',
    rocky: 'felsigen Stellen',
    deepWaters: 'tiefem Wasser',
    shallowWaters: 'flachem Wasser',
    easyAccess: 'einfachem Zugang',
    adventure: 'Abenteuerstränden',
  },
  it: {
    organized: 'spiagge organizzate',
    naturalShade: 'ombra naturale',
    taverna: 'taverne',
    beachBar: 'beach bar',
    sunbeds: 'lettini',
    restaurant: 'ristoranti',
    parking: 'parcheggio',
    sandy: 'sabbia',
    pebbles: 'ciottoli',
    'sandy-pebbles': 'sabbia e ciottoli',
    rocky: 'zone rocciose',
    deepWaters: 'acqua profonda',
    shallowWaters: 'acqua bassa',
    easyAccess: 'accesso facile',
    adventure: 'spiagge avventura',
  },
};

const greekPreferenceTitleTokens: Partial<Record<keyof UserPreferences, GreekFilterTitleToken>> = {
  blueFlag2026: { kind: 'with', label: 'Γαλάζια Σημαία' },
  sandy: { kind: 'adjective', label: 'Αμμώδεις' },
  pebbles: { kind: 'with', label: 'βότσαλο' },
  quiet: { kind: 'adjective', label: 'Ήσυχες' },
  beachBar: { kind: 'with', label: 'beach bar' },
  familyFriendly: { kind: 'adjective', label: 'Οικογενειακές' },
  snorkeling: { kind: 'purpose', label: 'snorkeling' },
  deepWater: { kind: 'with', label: 'βαθιά νερά' },
  shallowWater: { kind: 'with', label: 'ρηχά νερά' },
  surfing: { kind: 'purpose', label: 'surfing' },
  parking: { kind: 'with', label: 'πάρκινγκ' },
  easyAccess: { kind: 'adjective', label: 'Εύκολα προσβάσιμες' },
};

const greekAdvancedFilterTitleTokens: Partial<Record<FilterKey, GreekFilterTitleToken>> = {
  organized: { kind: 'with', label: 'οργάνωση' },
  naturalShade: { kind: 'with', label: 'φυσική σκιά' },
  taverna: { kind: 'with', label: 'ταβέρνες' },
  beachBar: { kind: 'with', label: 'beach bar' },
  sunbeds: { kind: 'with', label: 'ξαπλώστρες' },
  restaurant: { kind: 'with', label: 'εστιατόρια' },
  parking: { kind: 'with', label: 'πάρκινγκ' },
  sandy: { kind: 'adjective', label: 'Αμμώδεις' },
  pebbles: { kind: 'with', label: 'βότσαλο' },
  'sandy-pebbles': { kind: 'with', label: 'άμμο και βότσαλο' },
  rocky: { kind: 'adjective', label: 'Βραχώδεις' },
  deepWaters: { kind: 'with', label: 'βαθιά νερά' },
  shallowWaters: { kind: 'with', label: 'ρηχά νερά' },
  easyAccess: { kind: 'adjective', label: 'Εύκολα προσβάσιμες' },
  adventure: { kind: 'purpose', label: 'περιπέτεια' },
};

const formatFilterList = (labels: string[], language: LanguageCode): string => {
  const { conjunction } = filterTitleCopy[language];

  if (labels.length <= 1) {
    return labels[0] || '';
  }

  if (labels.length === 2) {
    return `${labels[0]} ${conjunction} ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels[labels.length - 1]}`;
};

const normalizeKey = (label: string): string => label.trim().toLocaleLowerCase();

const formatGreekFilterDirectoryTitle = (
  tokens: GreekFilterTitleToken[],
  maxLabels: number
): string | undefined => {
  if (tokens.length === 0) return undefined;

  const visibleTokens = tokens.slice(0, maxLabels);
  const hiddenCount = tokens.length - visibleTokens.length;
  const adjectives = visibleTokens
    .filter(token => token.kind === 'adjective')
    .map(token => token.label);
  const purposes = visibleTokens
    .filter(token => token.kind === 'purpose')
    .map(token => token.label);
  const withLabels = visibleTokens
    .filter(token => token.kind === 'with')
    .map(token => token.label);

  const titleParts: string[] = [];
  titleParts.push(adjectives.length > 0 ? `${adjectives.join(' ')} παραλίες` : 'Παραλίες');

  if (purposes.length > 0) {
    titleParts.push(`για ${formatFilterList(purposes, 'gr')}`);
  }

  if (withLabels.length > 0) {
    titleParts.push(`με ${formatFilterList(withLabels, 'gr')}`);
  }

  if (hiddenCount > 0) {
    titleParts.push(`και ${filterTitleCopy.gr.more(hiddenCount)}`);
  }

  return titleParts.join(' ');
};

export const getBeachFilterDirectoryTitle = ({
  activeFilters,
  fallbackTitle,
  language,
  preferences,
  t,
  maxLabels = 3,
}: {
  activeFilters: FilterKey[];
  fallbackTitle: string;
  language: LanguageCode;
  preferences: UserPreferences;
  t: Translation;
  maxLabels?: number;
}): string => {
  const labels: string[] = [];
  const seen = new Set<string>();
  const greekTokens: GreekFilterTitleToken[] = [];
  const seenGreekTokens = new Set<string>();
  const addLabel = (label: string | undefined) => {
    const cleanLabel = label?.trim();
    if (!cleanLabel) return;

    const key = normalizeKey(cleanLabel);
    if (seen.has(key)) return;

    seen.add(key);
    labels.push(cleanLabel);
  };
  const addGreekToken = (token: GreekFilterTitleToken | undefined) => {
    if (!token) return;

    const key = `${token.kind}:${normalizeKey(token.label)}`;
    if (seenGreekTokens.has(key)) return;

    seenGreekTokens.add(key);
    greekTokens.push(token);
  };

  const orderedPreferenceKeys = [
    ...QUICK_PREFERENCE_FILTERS,
    ...(Object.keys(preferences) as Array<keyof UserPreferences>).filter(key => !QUICK_PREFERENCE_FILTERS.includes(key as typeof QUICK_PREFERENCE_FILTERS[number])),
  ];

  orderedPreferenceKeys.forEach(key => {
    if (preferences[key]) {
      addGreekToken(greekPreferenceTitleTokens[key]);
      addLabel(preferenceTitleLabels[language][key] || getPreferenceFilterLabel(key, language, t));
    }
  });

  const hasTavernaFilter = activeFilters.includes('taverna');
  const filterOptionLabels = t.filterOptions as Partial<Record<string, string>>;

  activeFilters
    .filter(filter => filter !== 'showAll' && !(filter === 'restaurant' && hasTavernaFilter))
    .forEach(filter => {
      addGreekToken(greekAdvancedFilterTitleTokens[filter]);
      addLabel(advancedFilterTitleLabels[language][filter] || filterOptionLabels[String(filter)] || String(filter));
    });

  if (labels.length === 0) {
    return fallbackTitle;
  }

  const copy = filterTitleCopy[language];
  if (language === 'gr') {
    const greekTitle = formatGreekFilterDirectoryTitle(greekTokens, maxLabels);
    if (greekTitle) return greekTitle;
  }

  if (labels.length > maxLabels) {
    const visibleLabels = labels.slice(0, maxLabels);
    visibleLabels.push(copy.more(labels.length - maxLabels));
    return `${copy.prefix} ${formatFilterList(visibleLabels, language)}`;
  }

  const summary = formatFilterList(labels, language);
  return summary ? `${copy.prefix} ${summary}` : copy.fallback;
};
