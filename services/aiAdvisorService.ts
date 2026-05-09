import { Beach, WeatherData, DailyForecast, Island, LanguageCode, Accessibility } from '../types';
import { calculateBeachScore } from './recommendationService';

export interface AiAdviceResponse {
  answer: string;
  beaches: {
    name: string;
    score: number;
    explanation: string;
  }[];
}

export const getBeachAdvice = (
  userQuestion: string,
  allIslands: Island[],
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en'
): AiAdviceResponse => {
  const q = userQuestion.toLowerCase();

  // Flatten all beaches from all islands
  let allBeaches: (Beach & { islandName: string })[] = [];
  allIslands.forEach(island => {
    island.beaches.forEach(beach => {
      allBeaches.push({ ...beach, islandName: island.name[language] || island.name.en });
    });
  });

  // 1. Parse location
  let targetLocation = '';
  if (q.includes('near me') || q.includes('closest') || q.includes('nearby')) {
    targetLocation = 'near me';
  } else {
    // Extract island/region if mentioned
    const uniqueRegions = Array.from(new Set(allBeaches.map(b => b.islandName.toLowerCase())));
    for (const region of uniqueRegions) {
      if (q.includes(region)) {
        targetLocation = region;
        break;
      }
    }
  }

  // 2. Parse preference keywords
  const preferences = {
    quiet: q.includes('quiet') || q.includes('peaceful') || q.includes('relaxing') || q.includes('secluded'),
    sandy: q.includes('sand') || q.includes('sandy'),
    pebbles: q.includes('pebble') || q.includes('pebbles'),
    family: q.includes('family') || q.includes('kids') || q.includes('children'),
    snorkeling: q.includes('snorkel') || q.includes('diving') || q.includes('fish'),
    beachBar: q.includes('bar') || q.includes('party') || q.includes('music') || q.includes('drinks'),
    calm: q.includes('calm') || q.includes('no wind') || q.includes('flat') || q.includes('waves'),
    hidden: q.includes('hidden') || q.includes('secret') || q.includes('remote'),
  };

  // 3. Filter beaches
  let filteredBeaches = allBeaches;

  if (targetLocation && targetLocation !== 'near me') {
    filteredBeaches = filteredBeaches.filter(b => b.islandName.toLowerCase() === targetLocation);
  }

  if (preferences.quiet || preferences.hidden) {
    filteredBeaches = filteredBeaches.filter(b => !b.amenities.organized && !b.amenities.taverna);
  }
  if (preferences.sandy) {
    filteredBeaches = filteredBeaches.filter(b => b.beachType === 'sandy');
  }
  if (preferences.pebbles) {
    filteredBeaches = filteredBeaches.filter(b => b.beachType === 'pebbles');
  }
  if (preferences.family) {
    filteredBeaches = filteredBeaches.filter(b => b.characteristics.shallowWaters && b.accessibility === Accessibility.EASY);
  }
  if (preferences.snorkeling) {
    filteredBeaches = filteredBeaches.filter(b => b.characteristics.deepWaters || b.beachType === 'rocky' || b.beachType === 'pebbles');
  }
  if (preferences.beachBar) {
    filteredBeaches = filteredBeaches.filter(b => b.amenities.organized || b.amenities.taverna);
  }

  // 4. Calculate scores and sort
  const scoredBeaches = filteredBeaches.map(beach => {
    // Pass a mock preferences object to calculateBeachScore if needed, or just use base score
    const scoreResult = calculateBeachScore(beach, weather, userLocation);
    let score = scoreResult.score;
    let explanation = scoreResult.reasons[0] || 'Great conditions today.';

    // Adjust score based on specific intents
    if (preferences.calm) {
      const isSheltered = scoreResult.reasons.some(r => r.toLowerCase().includes('sheltered') || r.toLowerCase().includes('calm'));
      if (isSheltered) score += 15;
      if (scoreResult.reasons.some(r => r.toLowerCase().includes('exposed'))) score -= 20;
    }

    return {
      beach,
      score,
      explanation,
      reasons: scoreResult.reasons
    };
  });

  scoredBeaches.sort((a, b) => b.score - a.score);

  const topBeaches = scoredBeaches.slice(0, 3);

  // 5. Generate answer
  let answer = "Here are the best beaches based on your request.";
  if (topBeaches.length === 0) {
    answer = "I couldn't find any beaches matching all your criteria. Try adjusting your preferences.";
  } else if (preferences.calm) {
    answer = `These beaches have the calmest sea conditions today${targetLocation && targetLocation !== 'near me' ? ` in ${targetLocation}` : ''}.`;
  } else if (preferences.family) {
    answer = `Here are the best family-friendly beaches${targetLocation && targetLocation !== 'near me' ? ` in ${targetLocation}` : ''} with shallow waters and easy access.`;
  } else if (preferences.quiet) {
    answer = `If you're looking for peace and quiet${targetLocation && targetLocation !== 'near me' ? ` in ${targetLocation}` : ''}, these are great options today.`;
  } else if (targetLocation === 'near me') {
    answer = "Here are the top recommended beaches near your current location.";
  }

  return {
    answer,
    beaches: topBeaches.map(b => ({
      name: b.beach.name[language] || b.beach.name.en,
      score: Math.round(b.score),
      explanation: b.explanation
    }))
  };
};
