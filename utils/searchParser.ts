import { FilterKey } from '../types';

export interface ParsedSearch {
  locationType: 'island' | 'region' | 'nearMe' | 'any';
  locationValue?: string;
  preferences: FilterKey[];
  originalQuery: string;
}

// Keywords mapping to FilterKey
const PREFERENCE_KEYWORDS: Record<string, FilterKey> = {
  'family': 'shallowWaters', // Best proxy for family
  'kids': 'shallowWaters',
  'child': 'shallowWaters',
  'quiet': 'naturalShade', // Weak proxy, but implies less developed
  'sandy': 'sandy',
  'sand': 'sandy',
  'pebbly': 'pebbles',
  'pebble': 'pebbles',
  'rocky': 'rocky',
  'bar': 'beachBar',
  'beachbar': 'beachBar',
  'taverna': 'taverna',
  'food': 'taverna',
  'restaurant': 'taverna',
  'organized': 'organized',
  'umbrella': 'organized',
  'sunbed': 'organized',
  'shade': 'naturalShade',
  'tree': 'naturalShade',
  'shallow': 'shallowWaters',
  'deep': 'deepWaters',
  'easy': 'easyAccess',
  'accessible': 'easyAccess'
};

export const parseSearchQuery = (query: string, availableLocations: string[]): ParsedSearch => {
  const lowerQuery = query.toLowerCase();
  
  // 1. Detect "Near Me" intent
  if (lowerQuery.includes('near me') || lowerQuery.includes('nearby') || lowerQuery.includes('closest')) {
    return {
      locationType: 'nearMe',
      preferences: extractPreferences(lowerQuery),
      originalQuery: query
    };
  }

  // 2. Detect Location (Island or Region)
  // Sort locations by length descending to match longest names first (e.g. "Naxos" vs "Axos" if that existed)
  const sortedLocations = [...availableLocations].sort((a, b) => b.length - a.length);
  
  let detectedLocation: string | undefined;
  
  for (const loc of sortedLocations) {
    if (lowerQuery.includes(loc.toLowerCase())) {
      detectedLocation = loc;
      break;
    }
  }

  if (detectedLocation) {
    return {
      locationType: 'island', // We assume availableLocations are islands/regions
      locationValue: detectedLocation,
      preferences: extractPreferences(lowerQuery),
      originalQuery: query
    };
  }

  // 3. Default: Any location, just preferences
  return {
    locationType: 'any',
    preferences: extractPreferences(lowerQuery),
    originalQuery: query
  };
};

const extractPreferences = (query: string): FilterKey[] => {
  const preferences: Set<FilterKey> = new Set();
  const words = query.split(/[\s,]+/);

  words.forEach(word => {
    // Check exact matches in keywords
    for (const [keyword, filterKey] of Object.entries(PREFERENCE_KEYWORDS)) {
      if (word.includes(keyword)) {
        preferences.add(filterKey);
      }
    }
  });

  return Array.from(preferences);
};
