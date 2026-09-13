import { LanguageCode } from '../types';

/**
 * Ο ΟΥΡΑΝΟΣ ΔΙΠΛΑ ΣΤΟΝ ΑΝΕΜΟ ΚΑΙ ΤΟ ΚΥΜΑ, ΣΤΟ ΤΑΜΠΕΛΑΚΙ ΤΗΣ ΠΙΝΕΖΑΣ (12/09/2026, Μίλτος: «στο
 * κενό στο λευκό θα ήταν ωραίο να δείχνεις με ένα emoji αν έχει ήλιο, συννεφιά, βροχή»).
 *
 * ΔΕΝ είναι δεύτερος υπολογισμός: `icon`/`main` έρχονται από `selectedForecast.weather` στο
 * App.tsx, που είναι ΗΔΗ προσαρμοσμένο στην ίδια ώρα που δείχνουν ο άνεμος και το κύμα του
 * ταμπελακιού (βλ. `adjustDailyForecastToHour`) — όχι «τώρα», αλλά η ώρα που κοιτάει ο
 * επισκέπτης. Είναι σε επίπεδο ΠΕΡΙΟΧΗΣ (ένα σημείο ανά νησί), όχι ανά παραλία: ο ήλιος και η
 * βροχή δεν αλλάζουν παραλία-παραλία όπως ο άνεμος, οπότε ένα σημείο είναι ειλικρινές εδώ όπου
 * δεν θα ήταν για τα μποφόρ.
 *
 * Το ίδιο το εικονίδιο δεν ζει πια εδώ: από την ίδια μέρα το ταμπελάκι ζωγραφίζει το κινούμενο
 * `components/WeatherIcon` αντί για emoji (Μίλτος: «πιο μεγάλο, με animation»). Εδώ μένει μόνο
 * η λεζάντα του.
 */

const WEATHER_LABEL: Record<LanguageCode, Record<string, string>> = {
  en: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Thunderstorm: 'Thunderstorm', Fog: 'Fog' },
  gr: { Clear: 'Καθαρός ουρανός', Clouds: 'Συννεφιά', Rain: 'Βροχή', Thunderstorm: 'Καταιγίδα', Fog: 'Ομίχλη' },
  de: { Clear: 'Klarer Himmel', Clouds: 'Bewölkt', Rain: 'Regen', Thunderstorm: 'Gewitter', Fog: 'Nebel' },
  it: { Clear: 'Cielo sereno', Clouds: 'Nuvoloso', Rain: 'Pioggia', Thunderstorm: 'Temporale', Fog: 'Nebbia' },
  fr: { Clear: 'Ciel clair', Clouds: 'Nuageux', Rain: 'Pluie', Thunderstorm: 'Orage', Fog: 'Brouillard' },
};

/** Προσβάσιμη λεζάντα του emoji — screen reader/title, ΠΟΤΕ ορατό κείμενο δίπλα του. */
export const weatherEmojiLabel = (main: string | undefined, language: LanguageCode): string | undefined =>
  main ? (WEATHER_LABEL[language]?.[main] ?? WEATHER_LABEL.en[main]) : undefined;
