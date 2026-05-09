import { Beach, Island, FilterKey, LanguageCode } from '../types';
import { ParsedSearch } from '../utils/searchParser';
import { calculateDistance } from '../utils/weatherUtils';

export interface SearchResult {
  beach: Beach;
  islandName: string;
  score: number;
  explanation: string;
  distance?: number;
}

export const searchBeaches = (
  allIslands: Island[],
  parsedSearch: ParsedSearch,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en'
): SearchResult[] => {
  const results: SearchResult[] = [];

  // 1. Filter Islands/Regions
  let targetIslands = allIslands;
  if (parsedSearch.locationType === 'island' && parsedSearch.locationValue) {
    targetIslands = allIslands.filter(island => 
      island.name[language].toLowerCase().includes(parsedSearch.locationValue!.toLowerCase()) ||
      island.name['en'].toLowerCase().includes(parsedSearch.locationValue!.toLowerCase())
    );
  }

  // 2. Iterate Beaches
  targetIslands.forEach(island => {
    island.beaches.forEach(beach => {
      let matches = true;
      let score = beach.rating * 20; // Base score from rating (0-100 scale)
      let explanation = beach.description[language] || beach.description['en'];
      let distance: number | undefined;

      // Calculate distance if user location is available
      if (userLocation) {
        distance = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          beach.coordinates.lat,
          beach.coordinates.lon
        );
      }

      // 3. Apply Preferences
      if (parsedSearch.preferences.length > 0) {
        const hasAllPrefs = parsedSearch.preferences.every(pref => {
          // Check amenities
          if (pref in beach.amenities) return beach.amenities[pref as keyof typeof beach.amenities];
          // Check characteristics
          if (pref in beach.characteristics) return beach.characteristics[pref as keyof typeof beach.characteristics];
          // Check type
          if (['sandy', 'pebbles', 'rocky'].includes(pref)) return beach.beachType === pref;
          // Check access
          if (pref === 'easyAccess') return beach.accessibility === 'EASY';
          return false;
        });

        if (!hasAllPrefs) {
          matches = false;
        } else {
          score += 10; // Bonus for matching preferences
          explanation = `Matches your preferences for ${parsedSearch.preferences.join(', ')}.`;
        }
      }

      // 4. Near Me Logic
      if (parsedSearch.locationType === 'nearMe') {
        if (!userLocation) {
           matches = false; // Cannot search near me without location
        } else if (distance !== undefined) {
           if (distance > 50) { // e.g. 50km radius
             matches = false;
           } else {
             // Closer is better: 50km = 0 pts, 0km = 50 pts
             score += Math.max(0, 50 - distance); 
             explanation = `Located ${distance.toFixed(1)}km away.`;
           }
        }
      }

      if (matches) {
        results.push({
          beach,
          islandName: island.name[language],
          score: Math.min(100, Math.round(score)),
          explanation,
          distance
        });
      }
    });
  });

  // 5. Sort Results
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
};
