import { Beach, WeatherData, DailyForecast, WindDirection, FilterKey, SortOption, LanguageCode, ForecastItem, UserPreferences, SuitableBeach } from '../types';
import { degToCompass, calculateDistance } from '../utils/weatherUtils';
import { estimateBeachOrientation, calculateWindExposure } from '../utils/windExposure';
import { calculateCrowdLevel, CrowdLevel } from './crowdService';
import { ExposureLevel } from '../utils/windExposure';
import { getNegativeFeedbackCount } from './analyticsService';
import { displayBeachName } from '../utils/localization';
import { isSearchMatch } from '../utils/searchNormalize';

export interface BeachScore {
  beachId: number;
  score: number;
  reasons: string[];
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
}

export interface BestBeachTime {
  bestStart: string;
  bestEnd: string;
  reason: string;
}

export interface BeachRecommendation {
  beachId: number;
  score: number;
  explanation: string;
  bestBeachTime?: BestBeachTime;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
}

const greekWindDirectionsAccusative: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειους',
  [WindDirection.NE]: 'βορειοανατολικούς',
  [WindDirection.E]: 'ανατολικούς',
  [WindDirection.SE]: 'νοτιοανατολικούς',
  [WindDirection.S]: 'νότιους',
  [WindDirection.SW]: 'νοτιοδυτικούς',
  [WindDirection.W]: 'δυτικούς',
  [WindDirection.NW]: 'βορειοδυτικούς',
};

const greekWindDirectionsSingular: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειο',
  [WindDirection.NE]: 'βορειοανατολικό',
  [WindDirection.E]: 'ανατολικό',
  [WindDirection.SE]: 'νοτιοανατολικό',
  [WindDirection.S]: 'νότιο',
  [WindDirection.SW]: 'νοτιοδυτικό',
  [WindDirection.W]: 'δυτικό',
  [WindDirection.NW]: 'βορειοδυτικό',
};

/**
 * Calculates the best time of day to visit the beach based on hourly forecast.
 */
export const calculateBestBeachTime = (hourlyForecast: ForecastItem[]): BestBeachTime | undefined => {
  if (!hourlyForecast || hourlyForecast.length === 0) return undefined;

  // Filter for the next 12 hours (approx)
  // Assuming hourlyForecast is already sorted by time and starts from "now" or close to it.
  // We'll take the first 12 entries or less.
  const relevantForecast = hourlyForecast.slice(0, 12);

  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let currentWindowStart: string | null = null;
  let maxWindowDuration = 0;
  let currentWindowDuration = 0;

  // Helper to check conditions
  const isGoodCondition = (item: ForecastItem) => {
    const windSpeedKmph = item.wind.speed * 3.6;
    const temp = item.main.temp;
    // Wave height is not directly available, inferring from wind speed < 18 km/h (~5 m/s)
    // Temp between 22 and 32
    return windSpeedKmph < 18 && temp >= 22 && temp <= 32;
  };

  for (let i = 0; i < relevantForecast.length; i++) {
    const item = relevantForecast[i];
    const parts = item.dt_txt && item.dt_txt.includes(' ') ? item.dt_txt.split(' ') : [];
    const time = parts.length > 1 && parts[1] ? parts[1].substring(0, 5) : '00:00'; // Extract HH:MM

    if (isGoodCondition(item)) {
      if (currentWindowStart === null) {
        currentWindowStart = time;
      }
      currentWindowDuration++;
    } else {
      if (currentWindowStart !== null) {
        // Window ended
        if (currentWindowDuration > maxWindowDuration) {
          maxWindowDuration = currentWindowDuration;
          bestStart = currentWindowStart;
          // The end time is the time of the *previous* item (the last good one)
          // Or we can say it ends at the current item's time.
          // Let's say it ends at the current item's time to indicate the range.
          bestEnd = time;
        }
        currentWindowStart = null;
        currentWindowDuration = 0;
      }
    }
  }

  // Check if the window extends to the end of the forecast
  if (currentWindowStart !== null) {
    if (currentWindowDuration > maxWindowDuration) {
      maxWindowDuration = currentWindowDuration;
      bestStart = currentWindowStart;
      // End time is the last item's time + 3 hours (since forecast is usually 3-hourly)
      // Or just use the last item's time. 
      // Let's use the last item's time for simplicity.
      const lastItem = relevantForecast[relevantForecast.length - 1];
      const lastParts = lastItem.dt_txt && lastItem.dt_txt.includes(' ') ? lastItem.dt_txt.split(' ') : [];
      bestEnd = lastParts.length > 1 && lastParts[1] ? lastParts[1].substring(0, 5) : '00:00';
    }
  }

  if (bestStart && bestEnd) {
    // Determine reason/warning
    let reason = "Optimal conditions for swimming.";
    
    // Check if conditions worsen after the window
    const endIndex = relevantForecast.findIndex(item => item.dt_txt.includes(bestEnd!));
    if (endIndex !== -1 && endIndex < relevantForecast.length - 1) {
      const nextItem = relevantForecast[endIndex + 1]; // The item after the end time (which broke the condition)
      const windSpeedKmph = nextItem.wind.speed * 3.6;
      if (windSpeedKmph >= 18) {
        reason += ` Wind will increase after ${bestEnd}.`;
      } else if (nextItem.main.temp < 22) {
        reason += ` Temperature will drop after ${bestEnd}.`;
      } else if (nextItem.main.temp > 32) {
        reason += ` It will get very hot after ${bestEnd}.`;
      }
    }

    return {
      bestStart,
      bestEnd,
      reason
    };
  }

  return undefined;
};

/**
 * Filters beaches based on search query and active filters.
 */
export const filterBeaches = (
  beaches: Beach[],
  filters: FilterKey[],
  searchQuery: string,
  language: LanguageCode
): Beach[] => {
  let result = beaches;

  // 1. Search Query
  if (searchQuery.trim()) {
    result = result.filter(b => isSearchMatch(searchQuery, [
      b.name[language],
      b.name.en,
      b.name.gr,
    ]));
  }

  // 2. Filters
  if (filters.length > 0 && !filters.includes('showAll')) {
    result = result.filter(b => {
      return filters.every(f => {
        if (f === 'easyAccess') return b.accessibility === 'EASY';
        if (['sandy', 'pebbles', 'sandy-pebbles', 'rocky'].includes(f)) return b.beachType === f;
        // Check amenities
        if (b.amenities && f in b.amenities) return b.amenities[f as keyof typeof b.amenities];
        // Check characteristics
        if (b.characteristics && f in b.characteristics) return b.characteristics[f as keyof typeof b.characteristics];
        return true;
      });
    });
  }

  return result;
};

/**
 * Sorts beaches based on the selected option.
 */
export const sortBeaches = (
  beaches: Beach[],
  sortBy: SortOption,
  windDirection: WindDirection,
  userLocation?: { lat: number; lon: number }
): Beach[] => {
  const sorted = [...beaches];

  switch (sortBy) {
    case 'all':
      break;

    case 'recommended':
      // Sort by protection from current wind, then by rating
      sorted.sort((a, b) => {
        const aProtected = a.protectedFrom.includes(windDirection);
        const bProtected = b.protectedFrom.includes(windDirection);
        
        if (aProtected && !bProtected) return -1;
        if (!aProtected && bProtected) return 1;
        
        return b.rating - a.rating;
      });
      break;
      
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
      
    case 'distance':
      if (userLocation) {
        sorted.sort((a, b) => {
          const distA = calculateDistance(userLocation.lat, userLocation.lon, a.coordinates.lat, a.coordinates.lon);
          const distB = calculateDistance(userLocation.lat, userLocation.lon, b.coordinates.lat, b.coordinates.lon);
          return distA - distB;
        });
      }
      break;
  }

  return sorted;
};

/**
 * Calculates a suitability score (0-100) for a beach based on current weather and user location.
 */
export const calculateBeachScore = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  preferences?: UserPreferences
): BeachScore => {
  let score = 100;
  const reasons: string[] = [];

  // Safety check for missing weather data
  if (!weather || !weather.wind) {
    return {
      beachId: beach.id,
      score: 0,
      reasons: ["Weather data unavailable"]
    };
  }

  // 1. Weather Data Conversion
  const windSpeedKmph = weather.wind.speed * 3.6;
  const windDir = degToCompass(weather.wind.deg);
  
  let temp: number;
  if ('main' in weather && weather.main) {
      temp = weather.main.temp;
  } else if ('temp_max' in weather) {
      temp = weather.temp_max;
  } else {
      temp = 25;
  }

  // 2. Wind Protection & Direction Analysis
  const isProtected = beach.protectedFrom.includes(windDir);
  
  // New: Advanced Wind Exposure Calculation
  const beachOrientation = estimateBeachOrientation(beach.protectedFrom);
  let finalExposureLevel: ExposureLevel = isProtected ? 'protected' : 'exposed';
  
  if (beachOrientation !== null) {
    const exposure = calculateWindExposure(beachOrientation, weather.wind.deg);
    finalExposureLevel = exposure.exposureLevel;
    
    score += exposure.exposureScore;
    
    if (exposure.exposureLevel === 'protected') {
      reasons.push(`Well protected from wind`);
    } else if (exposure.exposureLevel === 'exposed' && windSpeedKmph > 15) {
      reasons.push(`Exposed to wind`);
    }
  } else {
    // Fallback to simple protection check if orientation cannot be estimated
    if (isProtected) {
      // Bonus for being protected, especially if it's windy elsewhere
      if (windSpeedKmph > 15) {
        score += 10; 
        reasons.push(`Protected from ${windDir} wind`);
      } else {
        reasons.push(`Sheltered from wind`);
      }
    } else {
      // Penalties for exposure based on wind speed
      if (windSpeedKmph < 10) {
        // Excellent conditions even if exposed
        reasons.push("Gentle breeze");
      } else if (windSpeedKmph <= 20) {
        score -= 15;
        reasons.push("Moderate breeze");
      } else if (windSpeedKmph <= 30) {
        score -= 40;
        reasons.push("Windy conditions");
      } else {
        score -= 70;
        reasons.push("Strong winds");
      }
    }
  }

  // 3. Wave Conditions (Inferred from protection and wind)
  if (isProtected) {
    score += 5;
    reasons.push("Calm waters");
  } else if (windSpeedKmph > 20) {
    score -= 10;
    reasons.push("Likely choppy waters");
  }

  // 4. Temperature Analysis
  if (temp >= 22 && temp <= 32) {
    reasons.push("Perfect temperature");
  } else if (temp < 22) {
    const diff = 22 - temp;
    score -= diff * 2; // -2 points per degree below 22
    if (diff > 5) reasons.push("Cooler temperature");
  } else if (temp > 32) {
    const diff = temp - 32;
    score -= diff * 2; // -2 points per degree above 32
    if (diff > 3) reasons.push("Hot weather");
  }

  // 5. Distance Bonus (if location available)
  if (userLocation) {
    const dist = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      beach.coordinates.lat,
      beach.coordinates.lon
    );

    if (dist < 5) {
      score += 10;
      reasons.push("Very close to you");
    } else if (dist < 15) {
      score += 5;
      reasons.push("Short drive");
    } else if (dist > 50) {
      score -= 5;
    }
  }

  // Weather score is now calculated. Let's ensure it's at least 70% of the weight.
  // We'll normalize the weather score to 0-70.
  const weatherScore = Math.max(0, Math.min(100, score));
  
  // 6. User Preferences (Max 30 points)
  let preferenceScore = 0;
  if (preferences) {
    if (preferences.sandy) {
      if (beach.beachType === 'sandy') preferenceScore += 10;
      else if (beach.beachType === 'sandy-pebbles') preferenceScore += 5;
    }
    if (preferences.pebbles) {
      if (beach.beachType === 'pebbles') preferenceScore += 10;
      else if (beach.beachType === 'sandy-pebbles') preferenceScore += 5;
    }
    if (preferences.quiet && !beach.amenities.organized) preferenceScore += 8;
    if (preferences.beachBar && (beach.amenities.organized || beach.amenities.taverna)) preferenceScore += 6;
    if (preferences.snorkeling && beach.characteristics.deepWaters) preferenceScore += 8;
    if (preferences.deepWater && beach.characteristics.deepWaters) preferenceScore += 6;
    if (preferences.shallowWater && beach.characteristics.shallowWaters) preferenceScore += 6;
    
    // Normalize preference score to max 30
    preferenceScore = Math.min(30, preferenceScore);
    
    if (preferenceScore > 0) {
      reasons.push(`Matches your preferences`);
    }
  }

  // Final Score = (WeatherScore * 0.7) + PreferenceScore
  let finalScore = (weatherScore * 0.7) + preferenceScore;

  // 7. Crowd Prediction Integration
  const crowdInfo = calculateCrowdLevel(beach, weather, new Date());
  
  // If user preference is "quiet beach" and crowdLevel is high -> reduce score
  if (preferences?.quiet && crowdInfo.crowdLevel === 'high') {
    finalScore -= 15;
    reasons.push("Likely busy today (Quiet preference active)");
  } else if (preferences?.quiet && crowdInfo.crowdLevel === 'low') {
    finalScore += 5;
    reasons.push("Likely quiet today");
  }

  // 8. Feedback Penalty
  const negativeFeedback = getNegativeFeedbackCount(beach.id);
  if (negativeFeedback > 0) {
    const penalty = Math.min(15, negativeFeedback * 3);
    finalScore -= penalty;
    if (penalty >= 9) {
      reasons.push("Recent users reported inaccurate conditions");
    }
  }

  return {
    beachId: beach.id,
    score: Math.max(0, Math.min(100, Math.round(finalScore))),
    reasons,
    crowdLevel: crowdInfo.crowdLevel,
    crowdScore: crowdInfo.crowdScore,
    exposureLevel: finalExposureLevel,
    orientation: beachOrientation
  };
};

/**
 * Generates a simple, tourist-friendly explanation for the beach recommendation.
 */
export const generateBeachExplanation = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  score: number,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en'
): string => {
  return generateLocalizedBeachExplanation(beach, weather, score, userLocation, language);

  // Safety check for missing weather data
  if (!weather || !weather.wind) {
    return language === 'gr' ? "Τα δεδομένα καιρού δεν είναι διαθέσιμα." : "Weather data unavailable.";
  }

  const windSpeedKmph = weather.wind.speed * 3.6;
  const windDir = degToCompass(weather.wind.deg);

  let temp: number;
  if ('main' in weather && (weather as WeatherData).main) {
      temp = Math.round((weather as WeatherData).main.temp);
  } else if ('temp_max' in weather) {
      temp = Math.round((weather as DailyForecast).temp_max);
  } else {
      temp = 25;
  }
  const isProtected = beach.protectedFrom.includes(windDir);
  const beachName = displayBeachName(beach.name, language);

  let explanation = "";

  if (language === 'gr') {
    // Greek explanations
    if (isProtected) {
      if (windSpeedKmph > 20) {
        explanation = `Η ${beachName} είναι εξαιρετική επιλογή γιατί προστατεύεται από τους δυνατούς ${windDir} ανέμους σήμερα.`;
      } else {
        explanation = `Η ${beachName} έχει ήρεμα νερά σήμερα, προστατευμένη από τον ${windDir} άνεμο.`;
      }
    } else {
      if (windSpeedKmph < 12) {
        explanation = `Η ${beachName} έχει ελαφρύ αεράκι σήμερα, ιδανική για επίσκεψη.`;
      } else {
        explanation = `Η ${beachName} μπορεί να έχει λίγο αέρα λόγω ${windDir} ανέμων, αλλά παραμένει απολαυστική.`;
      }
    }

    if (temp >= 25 && temp <= 32) {
      explanation += ` Η θερμοκρασία είναι ${temp}°C, ιδανική για κολύμπι.`;
    } else if (temp > 32) {
      explanation += ` Ζεστή μέρα στους ${temp}°C, μην ξεχάσετε το αντηλιακό!`;
    } else {
      explanation += ` Με θερμοκρασία ${temp}°C, είναι μια υπέροχη μέρα δίπλα στη θάλασσα.`;
    }

    if (userLocation && score > 80) {
      const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
      if (dist < 10) {
        explanation += " Επίσης, είναι πολύ κοντά σας.";
      }
    }
  } else {
    // English explanations
    if (isProtected) {
      if (windSpeedKmph > 20) {
        explanation = `${beachName} is a great choice because it is sheltered from the strong ${windDir} winds today.`;
      } else {
        explanation = `${beachName} has calm waters today, protected from the ${windDir} breeze.`;
      }
    } else {
      if (windSpeedKmph < 12) {
        explanation = `${beachName} has a gentle breeze today, making it pleasant for a visit.`;
      } else {
        explanation = `${beachName} might be a bit breezy today due to ${windDir} winds, but still enjoyable.`;
      }
    }

    if (temp >= 25 && temp <= 32) {
      explanation += ` The temperature is ${temp}°C, perfect for swimming.`;
    } else if (temp > 32) {
      explanation += ` It's a hot day at ${temp}°C, so don't forget your sunscreen!`;
    } else {
      explanation += ` With a temperature of ${temp}°C, it's a lovely day to be by the sea.`;
    }

    if (userLocation && score > 80) {
      const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
      if (dist < 10) {
        explanation += " Plus, it's just a short drive from you.";
      }
    }
  }

  return explanation;
};

const generateLocalizedBeachExplanation = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  score: number,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en'
): string => {
  if (!weather || !weather.wind) {
    return language === 'gr' ? 'Τα δεδομένα καιρού δεν είναι διαθέσιμα.' : 'Weather data unavailable.';
  }

  const windSpeedKmph = weather.wind.speed * 3.6;
  const windDir = degToCompass(weather.wind.deg);
  const temp = 'main' in weather && weather.main
    ? Math.round(weather.main.temp)
    : 'temp_max' in weather
      ? Math.round(weather.temp_max)
      : 25;

  const isProtected = beach.protectedFrom.includes(windDir);
  const beachName = displayBeachName(beach.name, language);
  let explanation = '';

  if (language === 'gr') {
    if (isProtected) {
      explanation = windSpeedKmph > 20
        ? `Η ${beachName} είναι εξαιρετική επιλογή γιατί προστατεύεται από τους δυνατούς ${greekWindDirectionsAccusative[windDir]} ανέμους σήμερα.`
        : `Η ${beachName} έχει ήρεμα νερά σήμερα, προστατευμένη από τον ${greekWindDirectionsSingular[windDir]} άνεμο.`;
    } else {
      explanation = windSpeedKmph < 12
        ? `Η ${beachName} έχει ελαφρύ αεράκι σήμερα και παραμένει ιδανική για επίσκεψη.`
        : `Η ${beachName} μπορεί να έχει λίγο αέρα λόγω ${greekWindDirectionsAccusative[windDir]} ανέμων, αλλά παραμένει απολαυστική.`;
    }

    if (temp >= 25 && temp <= 32) {
      explanation += ` Η θερμοκρασία είναι ${temp}°C, ιδανική για κολύμπι.`;
    } else if (temp > 32) {
      explanation += ` Ζεστή μέρα στους ${temp}°C, μην ξεχάσετε αντηλιακό.`;
    } else {
      explanation += ` Με θερμοκρασία ${temp}°C, είναι μια όμορφη μέρα δίπλα στη θάλασσα.`;
    }

    if (userLocation && score > 80) {
      const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
      if (dist < 10) explanation += ' Επίσης, είναι πολύ κοντά σας.';
    }

    return explanation;
  }

  if (language === 'de') {
    explanation = isProtected
      ? `${beachName} ist heute eine gute Wahl, weil der Strand vor dem Wind geschutzt ist.`
      : windSpeedKmph < 12
        ? `${beachName} hat heute nur eine leichte Brise und bleibt angenehm fur einen Strandbesuch.`
        : `${beachName} kann heute etwas windig sein, bleibt aber eine brauchbare Option.`;
    explanation += temp >= 25 && temp <= 32
      ? ` Die Temperatur liegt bei ${temp}°C, ideal zum Schwimmen.`
      : temp > 32
        ? ` Es ist heiss bei ${temp}°C, Sonnenschutz nicht vergessen.`
        : ` Mit ${temp}°C ist es eher frisch, aber die Meereslage kann trotzdem gut sein.`;
    return explanation;
  }

  if (language === 'it') {
    explanation = isProtected
      ? `${beachName} e una buona scelta oggi perche e riparata dal vento.`
      : windSpeedKmph < 12
        ? `${beachName} ha una brezza leggera oggi ed e piacevole per una visita.`
        : `${beachName} puo essere un po ventosa oggi, ma resta una buona opzione.`;
    explanation += temp >= 25 && temp <= 32
      ? ` La temperatura e ${temp}°C, ideale per nuotare.`
      : temp > 32
        ? ` Giornata calda a ${temp}°C, porta la protezione solare.`
        : ` Con ${temp}°C fa fresco, ma il mare puo comunque essere piacevole.`;
    return explanation;
  }

  if (language === 'fr') {
    explanation = isProtected
      ? `${beachName} est un bon choix aujourd hui car la plage est abritee du vent.`
      : windSpeedKmph < 12
        ? `${beachName} a seulement une legere brise aujourd hui et reste agreable.`
        : `${beachName} peut etre un peu ventee aujourd hui, mais reste une option correcte.`;
    explanation += temp >= 25 && temp <= 32
      ? ` La temperature est de ${temp}°C, ideale pour se baigner.`
      : temp > 32
        ? ` Il fait chaud avec ${temp}°C, prevoyez de la protection solaire.`
        : ` Avec ${temp}°C, l air est frais, mais les conditions de mer peuvent rester bonnes.`;
    return explanation;
  }

  if (isProtected) {
    explanation = windSpeedKmph > 20
      ? `${beachName} is a great choice because it is sheltered from the strong ${windDir} winds today.`
      : `${beachName} has calm waters today, protected from the ${windDir} breeze.`;
  } else {
    explanation = windSpeedKmph < 12
      ? `${beachName} has a gentle breeze today, making it pleasant for a visit.`
      : `${beachName} might be a bit breezy today due to ${windDir} winds, but still enjoyable.`;
  }

  if (temp >= 25 && temp <= 32) {
    explanation += ` The temperature is ${temp}°C, perfect for swimming.`;
  } else if (temp > 32) {
    explanation += ` It's a hot day at ${temp}°C, so don't forget your sunscreen!`;
  } else {
    explanation += ` With a temperature of ${temp}°C, it's a lovely day to be by the sea.`;
  }

  if (userLocation && score > 80) {
    const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
    if (dist < 10) explanation += " Plus, it's just a short drive from you.";
  }

  return explanation;
};

/**
 * Returns the top 3 recommended beaches sorted by suitability score with explanations.
 */
export const getTopRecommendedBeaches = (
  beaches: Beach[],
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  hourlyForecast?: ForecastItem[],
  preferences?: UserPreferences,
  language: LanguageCode = 'en'
): BeachRecommendation[] => {
  const recommendations = beaches.map(beach => {
    const { score, crowdLevel, crowdScore, exposureLevel, orientation } = calculateBeachScore(beach, weather, userLocation, preferences);
    const explanation = generateLocalizedBeachExplanation(beach, weather, score, userLocation, language);
    const bestBeachTime = hourlyForecast ? calculateBestBeachTime(hourlyForecast) : undefined;
    
    return {
      beachId: beach.id,
      score,
      explanation,
      bestBeachTime,
      crowdLevel,
      crowdScore,
      exposureLevel,
      orientation
    };
  });

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Return top 3
  return recommendations.slice(0, 3);
};

/**
 * Filters beaches within a certain distance from the user.
 */
export const filterNearbyBeaches = (
  beaches: Beach[],
  userLocation: { lat: number; lon: number } | undefined,
  maxDistance: number = 150
): Beach[] => {
  if (!userLocation) return beaches;
  
  return beaches.filter(beach => {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      beach.coordinates.lat,
      beach.coordinates.lon
    );
    return distance <= maxDistance;
  });
};

/**
 * Returns all suitable beaches (score >= 60) for Explore Mode.
 */
export const getSuitableBeaches = (
  beaches: Beach[],
  weather: WeatherData | DailyForecast,
  language: LanguageCode,
  userLocation?: { lat: number; lon: number },
  hourlyForecast?: ForecastItem[],
  preferences?: UserPreferences
): SuitableBeach[] => {
  const suitableBeaches: SuitableBeach[] = [];

  // Pre-filter beaches based on active hard-filter preferences
  const preferenceFiltered = preferences ? beaches.filter(beach => {
    // Beach type filters: if sandy or pebbles is active, only show matching types
    const typeFiltersActive = preferences.sandy || preferences.pebbles;
    if (typeFiltersActive) {
      const matchesSandy = preferences.sandy && (beach.beachType === 'sandy' || beach.beachType === 'sandy-pebbles');
      const matchesPebbles = preferences.pebbles && (beach.beachType === 'pebbles' || beach.beachType === 'sandy-pebbles');
      if (!matchesSandy && !matchesPebbles) return false;
    }
    // Feature filters: hard-filter on characteristics/amenities
    if (preferences.snorkeling && !beach.characteristics?.deepWaters) return false;
    if (preferences.deepWater && !beach.characteristics?.deepWaters) return false;
    if (preferences.shallowWater && !beach.characteristics?.shallowWaters) return false;
    if (preferences.beachBar && !beach.amenities?.organized && !beach.amenities?.beachBar && !beach.amenities?.taverna) return false;
    if (preferences.quiet && beach.amenities?.organized) return false;
    return true;
  }) : beaches;
  const preFiltered = preferenceFiltered.length > 0 ? preferenceFiltered : beaches;

  preFiltered.forEach(beach => {
    const { score, crowdLevel, crowdScore, exposureLevel, orientation } = calculateBeachScore(beach, weather, userLocation, preferences);

    if (score >= 60) {
      const explanation = generateLocalizedBeachExplanation(beach, weather, score, userLocation, language);
      const bestBeachTime = hourlyForecast ? calculateBestBeachTime(hourlyForecast) : undefined;
      
      let distance: number | undefined;
      if (userLocation) {
        distance = calculateDistance(
          userLocation.lat, 
          userLocation.lon, 
          beach.coordinates.lat, 
          beach.coordinates.lon
        );
      }

      const windDir = degToCompass(weather.wind.deg);
      const isExposed = !beach.protectedFrom.includes(windDir);

      suitableBeaches.push({
        beachId: beach.id,
        name: displayBeachName(beach.name, language),
        score,
        explanation,
        distance,
        beach: { ...beach, crowdLevel, crowdScore },
        bestBeachTime,
        isExposed,
        crowdLevel,
        crowdScore,
        exposureLevel,
        orientation
      });
    }
  });

  // Default sort by score (highest first)
  suitableBeaches.sort((a, b) => b.score - a.score);

  return suitableBeaches;
};
