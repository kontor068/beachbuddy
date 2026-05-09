import { Beach, Island, LanguageCode } from '../types';
import { fuzzySearchScore } from './searchNormalize';

export interface FuzzyResult {
  beach: Beach;
  island: Island;
  matchScore: number; // 0-100, higher = better match
  matchedName: string; // the name that matched
}

/**
 * Fuzzy search beaches by name across all islands.
 * Handles typos, Greek/Latin, partial matches.
 */
export const fuzzySearchBeaches = (
  query: string,
  allIslands: Island[],
  language: LanguageCode,
  maxResults: number = 8
): FuzzyResult[] => {
  if (!query || query.trim().length < 2) return [];

  const results: FuzzyResult[] = [];

  for (const island of allIslands) {
    for (const beach of island.beaches) {
      let bestScore = 0;
      let bestName = beach.name[language] || beach.name.en;

      // Check all language variants of the name
      const names = [
        { name: beach.name.en, lang: 'en' },
        { name: beach.name.gr, lang: 'gr' },
      ];

      for (const { name } of names) {
        if (!name) continue;

        const score = fuzzySearchScore(query, name);
        if (score > bestScore) {
          bestScore = score;
          bestName = name;
        }
      }

      if (bestScore > 0) {
        results.push({
          beach,
          island,
          matchScore: bestScore,
          matchedName: bestName,
        });
      }
    }
  }

  // Sort by score descending, then by rating
  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return b.beach.rating - a.beach.rating;
  });

  return results.slice(0, maxResults);
};
