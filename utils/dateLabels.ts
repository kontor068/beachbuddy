import { LanguageCode } from '../types';

const normalizeLocalDate = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getSelectedDayOffset = (selectedDate?: Date, currentDate: Date = new Date()): number => {
  if (!selectedDate) return 0;
  const selected = normalizeLocalDate(selectedDate);
  const current = normalizeLocalDate(currentDate);
  return Math.round((selected.getTime() - current.getTime()) / 86_400_000);
};

export const isSelectedDateToday = (selectedDate?: Date, currentDate: Date = new Date()): boolean =>
  getSelectedDayOffset(selectedDate, currentDate) === 0;

const greekWeekdayAccusative = ['την Κυριακή', 'τη Δευτέρα', 'την Τρίτη', 'την Τετάρτη', 'την Πέμπτη', 'την Παρασκευή', 'το Σάββατο'];
const greekWeekdayGenitive = ['της Κυριακής', 'της Δευτέρας', 'της Τρίτης', 'της Τετάρτης', 'της Πέμπτης', 'της Παρασκευής', 'του Σαββάτου'];

type NonGreekLanguage = Exclude<LanguageCode, 'gr'>;

const dayTextByLanguage: Record<NonGreekLanguage, {
  today: string;
  tomorrow: string;
  dayAfterTomorrow: string;
  weekdays: string[];
  prefixWeekdays: string[];
  adjectiveToday: string;
  adjectiveTomorrow: string;
  adjectiveDayAfterTomorrow: string;
  adjectiveWeekdays: string[];
}> = {
  en: {
    today: 'today',
    tomorrow: 'tomorrow',
    dayAfterTomorrow: 'the day after tomorrow',
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    prefixWeekdays: ['on Sunday', 'on Monday', 'on Tuesday', 'on Wednesday', 'on Thursday', 'on Friday', 'on Saturday'],
    adjectiveToday: "today's",
    adjectiveTomorrow: "tomorrow's",
    adjectiveDayAfterTomorrow: "the day after tomorrow's",
    adjectiveWeekdays: ["Sunday's", "Monday's", "Tuesday's", "Wednesday's", "Thursday's", "Friday's", "Saturday's"],
  },
  fr: {
    today: "aujourd'hui",
    tomorrow: 'demain',
    dayAfterTomorrow: 'après-demain',
    weekdays: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    prefixWeekdays: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    adjectiveToday: "d'aujourd'hui",
    adjectiveTomorrow: 'de demain',
    adjectiveDayAfterTomorrow: "d'après-demain",
    adjectiveWeekdays: ['de dimanche', 'de lundi', 'de mardi', 'de mercredi', 'de jeudi', 'de vendredi', 'de samedi'],
  },
  de: {
    today: 'heute',
    tomorrow: 'morgen',
    dayAfterTomorrow: 'übermorgen',
    weekdays: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    prefixWeekdays: ['am Sonntag', 'am Montag', 'am Dienstag', 'am Mittwoch', 'am Donnerstag', 'am Freitag', 'am Samstag'],
    adjectiveToday: 'heutige',
    adjectiveTomorrow: 'morgige',
    adjectiveDayAfterTomorrow: 'übermorgige',
    adjectiveWeekdays: ['vom Sonntag', 'vom Montag', 'vom Dienstag', 'vom Mittwoch', 'vom Donnerstag', 'vom Freitag', 'vom Samstag'],
  },
  it: {
    today: 'oggi',
    tomorrow: 'domani',
    dayAfterTomorrow: 'dopodomani',
    weekdays: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
    prefixWeekdays: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
    adjectiveToday: 'di oggi',
    adjectiveTomorrow: 'di domani',
    adjectiveDayAfterTomorrow: 'di dopodomani',
    adjectiveWeekdays: ['di domenica', 'di lunedì', 'di martedì', 'di mercoledì', 'di giovedì', 'di venerdì', 'di sabato'],
  },
};

const getNonGreekDayText = (language: LanguageCode) =>
  dayTextByLanguage[language === 'gr' ? 'en' : language];

const capitalizeFirst = (value: string): string =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

export const getSelectedDayLabel = (
  selectedDate?: Date,
  currentDate: Date = new Date(),
  language: LanguageCode = 'en'
): string => {
  const offset = getSelectedDayOffset(selectedDate, currentDate);
  if (language === 'gr') {
    if (offset === 0) return 'σήμερα';
    if (offset === 1) return 'αύριο';
    if (offset === 2) return 'μεθαύριο';
    return selectedDate ? greekWeekdayAccusative[selectedDate.getDay()].replace(/^(τη|την|το)\s+/, '') : 'σήμερα';
  }

  const labels = getNonGreekDayText(language);
  if (offset === 0) return labels.today;
  if (offset === 1) return labels.tomorrow;
  if (offset === 2) return labels.dayAfterTomorrow;
  return selectedDate ? labels.weekdays[selectedDate.getDay()] : labels.today;
};

export const getSelectedDayPrefix = (
  selectedDate?: Date,
  currentDate: Date = new Date(),
  language: LanguageCode = 'en'
): string => {
  const offset = getSelectedDayOffset(selectedDate, currentDate);
  if (language === 'gr') {
    if (offset === 0) return 'σήμερα';
    if (offset === 1) return 'αύριο';
    if (offset === 2) return 'μεθαύριο';
    return selectedDate ? greekWeekdayAccusative[selectedDate.getDay()] : 'σήμερα';
  }

  const labels = getNonGreekDayText(language);
  if (offset === 0) return labels.today;
  if (offset === 1) return labels.tomorrow;
  if (offset === 2) return labels.dayAfterTomorrow;
  return selectedDate ? labels.prefixWeekdays[selectedDate.getDay()] : labels.today;
};

export const getSelectedDaySentencePrefix = (
  selectedDate?: Date,
  currentDate: Date = new Date(),
  language: LanguageCode = 'en'
): string => capitalizeFirst(getSelectedDayPrefix(selectedDate, currentDate, language));

export const getSelectedDayAdjective = (
  selectedDate?: Date,
  currentDate: Date = new Date(),
  language: LanguageCode = 'en'
): string => {
  const offset = getSelectedDayOffset(selectedDate, currentDate);
  if (language === 'gr') {
    if (offset === 0) return 'σημερινός';
    if (offset === 1) return 'αυριανός';
    if (offset === 2) return 'μεθαυριανός';
    return selectedDate ? greekWeekdayGenitive[selectedDate.getDay()] : 'σημερινός';
  }

  const labels = getNonGreekDayText(language);
  if (offset === 0) return labels.adjectiveToday;
  if (offset === 1) return labels.adjectiveTomorrow;
  if (offset === 2) return labels.adjectiveDayAfterTomorrow;
  return selectedDate ? labels.adjectiveWeekdays[selectedDate.getDay()] : labels.adjectiveToday;
};

const forecastLeadCopy: Record<NonGreekLanguage, {
  manyToday: (beaufort: number) => string;
  manyOther: (beaufort: number, prefix: string) => string;
  mostBeaches: string;
  allBeaches: string;
  suitableToday: (beaufort: number, beachesText: string) => string;
  suitableOther: (beaufort: number, prefix: string, beachesText: string) => string;
}> = {
  en: {
    manyToday: (beaufort) => `${beaufort} Beaufort today. Many beaches are usable, with some better comfort picks.`,
    manyOther: (beaufort, prefix) => `${beaufort} Beaufort ${prefix}. Many beaches look usable, with some better comfort picks.`,
    mostBeaches: 'Most beaches',
    allBeaches: 'All beaches',
    suitableToday: (beaufort, beachesText) => `${beaufort} Beaufort today. ${beachesText} are suitable.`,
    suitableOther: (beaufort, prefix, beachesText) => `${beaufort} Beaufort ${prefix}. ${beachesText} look suitable.`,
  },
  fr: {
    manyToday: (beaufort) => `${beaufort} Beaufort aujourd'hui. Plusieurs plages restent praticables, avec quelques options plus confortables.`,
    manyOther: (beaufort, prefix) => `${beaufort} Beaufort ${prefix}. Plusieurs plages semblent praticables, avec quelques options plus confortables.`,
    mostBeaches: 'La plupart des plages',
    allBeaches: 'Toutes les plages',
    suitableToday: (beaufort, beachesText) => `${beaufort} Beaufort aujourd'hui. ${beachesText} sont adaptées.`,
    suitableOther: (beaufort, prefix, beachesText) => `${beaufort} Beaufort ${prefix}. ${beachesText} semblent adaptées.`,
  },
  de: {
    manyToday: (beaufort) => `${beaufort} Bft heute. Viele Strände sind nutzbar, einige bieten aber mehr Komfort.`,
    manyOther: (beaufort, prefix) => `${beaufort} Bft ${prefix}. Viele Strände wirken nutzbar, einige bieten aber mehr Komfort.`,
    mostBeaches: 'Die meisten Strände',
    allBeaches: 'Alle Strände',
    suitableToday: (beaufort, beachesText) => `${beaufort} Bft heute. ${beachesText} sind geeignet.`,
    suitableOther: (beaufort, prefix, beachesText) => `${beaufort} Bft ${prefix}. ${beachesText} wirken geeignet.`,
  },
  it: {
    manyToday: (beaufort) => `${beaufort} Beaufort oggi. Molte spiagge sono utilizzabili, con alcune opzioni più comode.`,
    manyOther: (beaufort, prefix) => `${beaufort} Beaufort ${prefix}. Molte spiagge sembrano utilizzabili, con alcune opzioni più comode.`,
    mostBeaches: 'La maggior parte delle spiagge',
    allBeaches: 'Tutte le spiagge',
    suitableToday: (beaufort, beachesText) => `${beaufort} Beaufort oggi. ${beachesText} sono adatte.`,
    suitableOther: (beaufort, prefix, beachesText) => `${beaufort} Beaufort ${prefix}. ${beachesText} sembrano adatte.`,
  },
};

export const formatDateAwareForecastLead = (
  beaufort: number,
  selectedDate: Date | undefined,
  language: LanguageCode,
  options: {
    allBeaches?: boolean;
    mostBeaches?: boolean;
    manyBeaches?: boolean;
    suitableBeachCount?: number;
    totalBeachCount?: number;
  } = {}
): string => {
  const prefix = getSelectedDayPrefix(selectedDate, new Date(), language);
  const sentencePrefix = getSelectedDaySentencePrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);

  if (language === 'gr') {
    if (beaufort <= 3) {
      const suitableRatio =
        typeof options.suitableBeachCount === 'number' &&
        typeof options.totalBeachCount === 'number' &&
        options.totalBeachCount > 0
          ? options.suitableBeachCount / options.totalBeachCount
          : undefined;
      const allBeachesSuitable = typeof suitableRatio === 'number'
        ? suitableRatio === 1
        : options.allBeaches;
      const mostBeachesSuitable = typeof suitableRatio === 'number'
        ? suitableRatio >= 0.8
        : options.mostBeaches;

      if (allBeachesSuitable) {
        return `${sentencePrefix} ο άνεμος θα είναι ήπιος, οπότε όλες οι παραλίες φαίνονται κατάλληλες για μπάνιο.`;
      }
      if (mostBeachesSuitable) {
        return `${sentencePrefix} ο άνεμος θα είναι ήπιος, οπότε σχεδόν όλες οι παραλίες φαίνονται καλή επιλογή.`;
      }
      return `${sentencePrefix} ο άνεμος θα είναι ήπιος και αρκετές παραλίες φαίνονται κατάλληλες για μπάνιο.`;
    }

    if (isToday) {
      const beachesText = options.allBeaches
        ? 'Όλες οι παραλίες είναι κατάλληλες!'
        : options.mostBeaches
          ? 'Οι περισσότερες παραλίες είναι κατάλληλες!'
          : 'Αρκετές παραλίες είναι κατάλληλες για μπάνιο.';
      return `${beaufort} μποφόρ σήμερα. ${beachesText}`;
    }
    const beachesText = options.allBeaches
      ? 'Όλες οι παραλίες φαίνονται κατάλληλες!'
      : options.mostBeaches
        ? 'Οι περισσότερες παραλίες φαίνονται κατάλληλες!'
        : 'Αρκετές παραλίες φαίνονται κατάλληλες για μπάνιο.';
    return `${sentencePrefix} προβλέπονται ${beaufort} μποφόρ. ${beachesText}`;
  }

  const copy = forecastLeadCopy[language];
  if (!options.allBeaches && !options.mostBeaches) {
    return isToday
      ? copy.manyToday(beaufort)
      : copy.manyOther(beaufort, prefix);
  }

  const beachesText = options.mostBeaches ? copy.mostBeaches : copy.allBeaches;
  return isToday
    ? copy.suitableToday(beaufort, beachesText)
    : copy.suitableOther(beaufort, prefix, beachesText);
};
