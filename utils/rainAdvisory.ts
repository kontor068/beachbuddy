import { ForecastItem, LanguageCode } from '../types';
import { hasHourlyRainRisk } from '../services/recommendationService';
import { getSelectedDayOffset, getSelectedDayPrefix } from './dateLabels';
import { athensNow } from './athensTime';

const HOUR_MS = 60 * 60 * 1000;

// Main beach hours, matching the rain-risk window used on the home screen so a
// beach page and the area summary never disagree about when it rains. Rain
// detection itself (including the precipitation-probability gate) lives in the
// shared hasHourlyRainRisk so every surface agrees on what counts as rain.
const isBeachHour = (item: ForecastItem): boolean => {
  const hour = new Date(item.dt * 1000).getHours();
  return hour >= 10 && hour <= 18;
};

// "It is raining right now" is checked on a wider window than the main beach
// hours: someone reading the page at 09:00 or 19:30 can still be in the water,
// and a live warning matters more than a forecast one. Outside this window we
// stay silent — nobody needs a swim warning at 04:00.
const NOW_WINDOW_START_HOUR = 8;
const NOW_WINDOW_END_HOUR = 21;

/** True when `now` falls inside the hour this forecast item covers. */
const coversNow = (item: ForecastItem, now: Date): boolean => {
  const start = item.dt * 1000;
  return start <= now.getTime() && now.getTime() < start + HOUR_MS;
};

const timeLocaleByLanguage: Record<LanguageCode, string> = {
  gr: 'el-GR',
  en: 'en-GB',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
};

const formatHour = (date: Date, language: LanguageCode): string =>
  date.toLocaleTimeString(timeLocaleByLanguage[language] || 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

interface HourRange {
  start: Date;
  end: Date;
}

// Collapse runs of consecutive rainy hours (e.g. 13:00, 14:00, 15:00) into a
// single "13:00–15:00" range so the advisory reads naturally.
const groupConsecutiveHours = (dates: Date[]): HourRange[] => {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const ranges: HourRange[] = [];

  sorted.forEach(date => {
    const last = ranges[ranges.length - 1];
    // Allow a small slack so off-by-a-minute timestamps still count as adjacent.
    if (last && date.getTime() - last.end.getTime() <= HOUR_MS + 60_000) {
      last.end = date;
    } else {
      ranges.push({ start: date, end: date });
    }
  });

  return ranges;
};

const formatRange = (range: HourRange, language: LanguageCode): string =>
  range.start.getTime() === range.end.getTime()
    ? formatHour(range.start, language)
    : `${formatHour(range.start, language)}–${formatHour(range.end, language)}`;

export interface RainSwimAdvisory {
  /** Joined, human-readable times/ranges, e.g. "13:00–15:00, 18:00". */
  timesLabel: string;
  title: string;
  body: string;
  /** True when rain is falling in the hour we are currently in (today only). */
  isRainingNow: boolean;
}

// Copy for the live case: it is raining at this very moment. `untilLabel` is set
// when the rain runs past the current hour, `laterLabel` when more rain returns
// after a dry gap.
const buildNowCopy = (
  language: LanguageCode,
  untilLabel: string | null,
  laterLabel: string | null,
): { title: string; body: string } => {
  switch (language) {
    case 'gr':
      return {
        title: 'Βρέχει τώρα',
        body: `Βρέχει αυτή την ώρα, οπότε καλό είναι να μη μένεις στη θάλασσα.${
          untilLabel ? ` Η βροχή δείχνει να συνεχίζεται ως τις ${untilLabel}.` : ''
        }${laterLabel ? ` Νέα βροχή προβλέπεται γύρω στις ${laterLabel}.` : ''}`,
      };
    case 'fr':
      return {
        title: 'Il pleut en ce moment',
        body: `Il pleut en ce moment, mieux vaut donc ne pas rester dans la mer.${
          untilLabel ? ` La pluie devrait durer jusqu'à ${untilLabel}.` : ''
        }${laterLabel ? ` De la pluie est de nouveau prévue vers ${laterLabel}.` : ''}`,
      };
    case 'de':
      return {
        title: 'Es regnet gerade',
        body: `Es regnet gerade, bleibe daher besser nicht im Wasser.${
          untilLabel ? ` Der Regen dürfte bis ${untilLabel} anhalten.` : ''
        }${laterLabel ? ` Weiterer Regen ist gegen ${laterLabel} vorhergesagt.` : ''}`,
      };
    case 'it':
      return {
        title: 'Sta piovendo ora',
        body: `Sta piovendo in questo momento, quindi è meglio non restare in mare.${
          untilLabel ? ` La pioggia dovrebbe continuare fino alle ${untilLabel}.` : ''
        }${laterLabel ? ` Altra pioggia è prevista verso le ${laterLabel}.` : ''}`,
      };
    case 'en':
    default:
      return {
        title: 'It is raining right now',
        body: `It is raining right now, so it is best not to stay in the sea.${
          untilLabel ? ` The rain looks set to continue until ${untilLabel}.` : ''
        }${laterLabel ? ` More rain is expected around ${laterLabel}.` : ''}`,
      };
  }
};

const buildCopy = (
  language: LanguageCode,
  timesLabel: string,
  dayPrefix: string,
  singleHour: boolean,
): { title: string; body: string } => {
  switch (language) {
    case 'gr':
      return {
        title: `Προσοχή στη βροχή ${dayPrefix}`,
        body: `Γύρω στις ${timesLabel} προβλέπεται βροχή, οπότε καλό είναι να αποφεύγεις την παραμονή στη θάλασσα ${singleHour ? 'εκείνη την ώρα' : 'εκείνες τις ώρες'}.`,
      };
    case 'fr':
      return {
        title: `Pluie prévue ${dayPrefix}`,
        body: `De la pluie est prévue vers ${timesLabel}, il vaut donc mieux éviter de rester dans la mer ${singleHour ? 'à ce moment-là' : 'à ces heures-là'}.`,
      };
    case 'de':
      return {
        title: `Regen ${dayPrefix}`,
        body: `Gegen ${timesLabel} ist Regen vorhergesagt, bleibe ${singleHour ? 'zu dieser Zeit' : 'in diesen Stunden'} daher besser nicht im Wasser.`,
      };
    case 'it':
      return {
        title: `Pioggia ${dayPrefix}`,
        body: `È prevista pioggia intorno alle ${timesLabel}, quindi è meglio evitare di restare in mare ${singleHour ? 'in quel momento' : 'in quelle ore'}.`,
      };
    case 'en':
    default:
      return {
        title: `Rain expected ${dayPrefix}`,
        body: `Rain is expected around ${timesLabel}, so it is best to avoid staying in the sea ${singleHour ? 'at that time' : 'during those hours'}.`,
      };
  }
};

/**
 * Detects when rain is forecast during the main beach hours of the selected day
 * and returns a localized advisory naming the time(s) and warning against
 * staying in the sea then. Returns null when no rain is expected.
 *
 * For today, hours that have already passed are ignored so we never warn about
 * rain the visitor can no longer be caught in — with one deliberate exception:
 * the hour we are currently inside. That hour starts in the past but is still
 * happening, so if it is rainy we say "it is raining right now" instead of
 * going silent exactly when the warning matters most.
 */
export const getRainSwimAdvisory = (
  hourlyForecast: ForecastItem[] | undefined,
  selectedDate: Date | undefined,
  language: LanguageCode,
  now: Date = athensNow(),
): RainSwimAdvisory | null => {
  if (!hourlyForecast || hourlyForecast.length === 0) return null;

  const isToday = getSelectedDayOffset(selectedDate, now) === 0;

  const currentHourItem = isToday
    ? hourlyForecast.find(item => coversNow(item, now))
    : undefined;
  const currentHour = currentHourItem ? new Date(currentHourItem.dt * 1000).getHours() : -1;
  const isRainingNow = Boolean(
    currentHourItem &&
    currentHour >= NOW_WINDOW_START_HOUR &&
    currentHour <= NOW_WINDOW_END_HOUR &&
    hasHourlyRainRisk(currentHourItem)
  );

  const rainyHours = hourlyForecast
    .filter(item =>
      (isRainingNow && item === currentHourItem) ||
      (isBeachHour(item) && (!isToday || item.dt * 1000 > now.getTime()))
    )
    .filter(hasHourlyRainRisk)
    .map(item => new Date(item.dt * 1000));

  if (rainyHours.length === 0) return null;

  const allRanges = groupConsecutiveHours(rainyHours);
  const ranges = allRanges.slice(0, 3);
  const timesLabel = ranges.map(range => formatRange(range, language)).join(', ');
  const singleHour =
    ranges.length === 1 && ranges[0].start.getTime() === ranges[0].end.getTime();
  const dayPrefix = getSelectedDayPrefix(selectedDate, now, language);

  if (isRainingNow) {
    // The run that is happening now always sorts first. Its last rainy hour
    // covers one more hour of rain, hence the +1h for the "until" label.
    const currentRun = allRanges[0];
    const untilLabel =
      currentRun.end.getTime() > currentRun.start.getTime()
        ? formatHour(new Date(currentRun.end.getTime() + HOUR_MS), language)
        : null;
    const laterLabel =
      allRanges.length > 1
        ? allRanges.slice(1, 3).map(range => formatRange(range, language)).join(', ')
        : null;

    return {
      timesLabel,
      isRainingNow,
      ...buildNowCopy(language, untilLabel, laterLabel),
    };
  }

  return { timesLabel, isRainingNow, ...buildCopy(language, timesLabel, dayPrefix, singleHour) };
};
