import { LanguageCode } from '../types';
import { isSelectedDateToday } from './dateLabels';

export type TopPickTimingState = 'active' | 'upcoming' | 'expired' | 'unknown';

export interface BestBeachTimeLike {
  bestStart?: string;
  bestEnd?: string;
}

export interface TopPickTiming {
  state: TopPickTimingState;
  startMinutes?: number;
  endMinutes?: number;
  startLabel?: string;
  endLabel?: string;
}

const BEACH_DAY_START_MINUTES = 10 * 60;
const ONE_HOUR_MINUTES = 60;

const parseTimeToMinutes = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return undefined;
  }

  return hours * 60 + minutes;
};

const formatMinutesAsTime = (minutes: number): string => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const getReferenceMinutes = (selectedDate: Date | undefined, now: Date): number => {
  if (isSelectedDateToday(selectedDate, now)) {
    return now.getHours() * 60 + now.getMinutes();
  }

  return BEACH_DAY_START_MINUTES;
};

export const getTopPickTiming = (
  bestBeachTime: BestBeachTimeLike | undefined,
  selectedDate: Date | undefined,
  now: Date = new Date()
): TopPickTiming => {
  const startMinutes = parseTimeToMinutes(bestBeachTime?.bestStart);
  if (startMinutes === undefined) return { state: 'unknown' };

  const rawEndMinutes = parseTimeToMinutes(bestBeachTime?.bestEnd);
  const endMinutes = rawEndMinutes !== undefined && rawEndMinutes > startMinutes
    ? rawEndMinutes
    : Math.min(startMinutes + ONE_HOUR_MINUTES, 23 * 60 + 59);
  const isToday = isSelectedDateToday(selectedDate, now);
  const timing = {
    startMinutes,
    endMinutes,
    startLabel: formatMinutesAsTime(startMinutes),
    endLabel: formatMinutesAsTime(endMinutes),
  };

  if (!isToday) {
    return {
      state: 'upcoming',
      ...timing,
    };
  }

  const referenceMinutes = getReferenceMinutes(selectedDate, now);

  if (referenceMinutes >= startMinutes && referenceMinutes <= endMinutes) {
    return {
      state: 'active',
      ...timing,
    };
  }

  if (referenceMinutes < startMinutes) {
    return {
      state: 'upcoming',
      ...timing,
    };
  }

  return {
    state: 'expired',
    ...timing,
  };
};

export const topPickTimingPriority = (timing: TopPickTiming): number => {
  switch (timing.state) {
    case 'active':
      return 0;
    case 'upcoming':
      return 1;
    case 'unknown':
      return 2;
    case 'expired':
      return 3;
    default:
      return 2;
  }
};

export const getTopPickTimingLabel = (
  bestBeachTime: BestBeachTimeLike | undefined,
  selectedDate: Date | undefined,
  language: LanguageCode,
  now: Date = new Date()
): string | undefined => {
  const timing = getTopPickTiming(bestBeachTime, selectedDate, now);
  if (!timing.startLabel || !timing.endLabel || timing.state === 'unknown') return undefined;

  if (language === 'gr') {
    if (timing.state === 'active') return `Top μέχρι ${timing.endLabel}`;
    if (timing.state === 'expired') return `Καλύτερο νωρίτερα έως ${timing.endLabel}`;
    return `Top ${timing.startLabel}-${timing.endLabel}`;
  }

  if (timing.state === 'active') return `Top until ${timing.endLabel}`;
  if (timing.state === 'expired') return `Best earlier until ${timing.endLabel}`;
  return `Top ${timing.startLabel}-${timing.endLabel}`;
};
