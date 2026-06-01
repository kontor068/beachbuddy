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

const englishWeekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === 2) return 'the day after tomorrow';
  return selectedDate ? englishWeekday[selectedDate.getDay()] : 'today';
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

  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === 2) return 'the day after tomorrow';
  return selectedDate ? `on ${englishWeekday[selectedDate.getDay()]}` : 'today';
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

  if (offset === 0) return "today's";
  if (offset === 1) return "tomorrow's";
  if (offset === 2) return "the day after tomorrow's";
  return selectedDate ? `${englishWeekday[selectedDate.getDay()]}'s` : "today's";
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

  if (!options.allBeaches && !options.mostBeaches) {
    return isToday
      ? `${beaufort} Beaufort today. Many beaches are usable, with some better comfort picks.`
      : `${beaufort} Beaufort ${prefix}. Many beaches look usable, with some better comfort picks.`;
  }

  const beachesText = options.mostBeaches ? 'Most beaches' : 'All beaches';
  return isToday
    ? `${beaufort} Beaufort today. ${beachesText} are suitable.`
    : `${beaufort} Beaufort ${prefix}. ${beachesText} look suitable.`;
};
