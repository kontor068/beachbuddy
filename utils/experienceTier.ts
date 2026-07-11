import { LanguageCode, SwimmingComfort } from '../types';
import { ExposureLevel } from './windExposure';
import { getLocalizedCopy } from './i18n';
import { getSelectedDayPrefix, getSelectedHourPrefix, isSelectedDateToday } from './dateLabels';

// CalmBeach communicates a FINAL EXPERIENCE, not raw weather. Every beach resolves to one
// of four plain-language tiers derived from the composite suitability score (which already
// blends swimming + experience + preferences), gated by the honest hard caps below. This is
// the single source of truth for the verdict — badges, the map legend and the detail "why"
// section all read from here, so the four colours mean the same thing everywhere.
export type ExperienceTier = 'excellent' | 'good' | 'fair' | 'skip';

export interface ExperienceTierInput {
  /** finalSuitabilityScore / today score, 0–100. */
  score: number;
  windBeaufort?: number;
  waveHeightM?: number;
  swimmingComfort?: SwimmingComfort;
  noIdealSwimmingWindow?: boolean;
  /** Only used to split "fair" vs "skip" on a strong-wind (≥5 Bft) day. */
  exposureLevel?: ExposureLevel;
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

// The tier is a BEACH-EXPERIENCE verdict, not a swimming-safety verdict. The model:
//
//   1. "Not recommended" (red) is reserved for genuinely poor days and kept rare — only a
//      near-gale, a real rough sea, an unsafe-swim call *paired with* real waves, or a very
//      weak pick. Strong wind that merely makes swimming choppy is an "OK, but breezy" day
//      (amber), not a "don't go" — otherwise a whole island turns red on any 6 Bft afternoon.
//   2. A condition "ceiling" caps how good a beach may look given the day (green never shows
//      on a windy or choppy day); the composite score then sets the tier up to that ceiling.
export const getExperienceTier = (input: ExperienceTierInput): ExperienceTier => {
  const { windBeaufort, waveHeightM, swimmingComfort } = input;
  const score = clampScore(input.score);
  const bft = typeof windBeaufort === 'number' ? windBeaufort : 0;
  const wave = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) ? waveHeightM : undefined;

  // Red is reserved for a genuinely poor day: near-gale wind, a real rough sea, or a beach
  // that is simply wrong today. A strong breeze that only makes swimming choppy is NOT red on
  // its own — it caps the tier at "OK" below, so a 6 Bft afternoon reads amber, not a wall of red.
  const roughSea = wave !== undefined && wave >= 1.5;
  if (bft >= 7 || roughSea || score < 25) return 'skip';

  // Condition ceiling: 3 excellent · 2 good · 1 OK. Strong wind or real chop pulls it down,
  // and a hard swim advisory holds it at "OK" even when the wind reads a notch lower.
  let ceiling: 1 | 2 | 3 = 3;
  if (bft >= 6 || (wave !== undefined && wave >= 1.2)) ceiling = 1;
  else if (bft >= 5 || (wave !== undefined && wave >= 0.8)) ceiling = 2;
  if (swimmingComfort === 'avoid_swimming') ceiling = 1;

  const scoreTier: 1 | 2 | 3 = score >= 80 ? 3 : score >= 60 ? 2 : 1;
  const rank = Math.min(ceiling, scoreTier);
  return rank === 3 ? 'excellent' : rank === 2 ? 'good' : 'fair';
};

// The verdict describes the live, continuously-updating conditions. For *today* (the default)
// that reads as a clean present-tense phrase; only a future selected date (or a scrubbed hour)
// appends the temporal word, which is then genuinely informative.
type TierLabel = (day: string, isToday: boolean) => string;

const dayLabel = (today: string, withDay: (day: string) => string): TierLabel =>
  (day, isToday) => (isToday ? today : withDay(day));

type TierCopy = Record<ExperienceTier, TierLabel>;

const tierCopy: Record<LanguageCode, TierCopy> = {
  en: {
    excellent: dayLabel('Excellent today', (day) => `Excellent ${day}`),
    good: dayLabel('Good today', (day) => `Good ${day}`),
    fair: dayLabel('OK today', (day) => `OK ${day}`),
    skip: dayLabel('Not recommended today', (day) => `Not recommended ${day}`),
  },
  gr: {
    excellent: dayLabel('Ιδανική σήμερα', (day) => `Ιδανική ${day}`),
    good: dayLabel('Καλή επιλογή σήμερα', (day) => `Καλή επιλογή ${day}`),
    fair: dayLabel('Μέτρια σήμερα', (day) => `Μέτρια ${day}`),
    skip: dayLabel('Καλύτερα άλλη μέρα', (day) => `Δεν συνιστάται ${day}`),
  },
  fr: {
    excellent: dayLabel("Idéale aujourd'hui", (day) => `Idéale ${day}`),
    good: dayLabel("Bon choix aujourd'hui", (day) => `Bon choix ${day}`),
    fair: dayLabel("Correcte aujourd'hui", (day) => `Correcte ${day}`),
    skip: dayLabel("Déconseillée aujourd'hui", (day) => `Déconseillée ${day}`),
  },
  de: {
    excellent: dayLabel('Ideal heute', (day) => `Ideal ${day}`),
    good: dayLabel('Gute Wahl heute', (day) => `Gute Wahl ${day}`),
    fair: dayLabel('Mäßig heute', (day) => `Mäßig ${day}`),
    skip: dayLabel('Heute nicht empfohlen', (day) => `Nicht empfohlen ${day}`),
  },
  it: {
    excellent: dayLabel('Ideale oggi', (day) => `Ideale ${day}`),
    good: dayLabel('Buona scelta oggi', (day) => `Buona scelta ${day}`),
    fair: dayLabel('Discreta oggi', (day) => `Discreta ${day}`),
    skip: dayLabel('Sconsigliata oggi', (day) => `Sconsigliata ${day}`),
  },
};

export interface ExperienceTierLabelOptions {
  selectedDate?: Date;
  selectedHour?: number;
}

export const getExperienceTierLabel = (
  tier: ExperienceTier,
  language: LanguageCode,
  options: ExperienceTierLabelOptions = {}
): string => {
  const hour = getSelectedHourPrefix(options.selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(options.selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(options.selectedDate);
  const useCurrentPhrase = isToday && !hour;
  const copy = getLocalizedCopy(language, tierCopy);
  return copy[tier](day, useCurrentPhrase);
};

export interface ExperienceTierTone {
  container: string;
  icon: string;
  strong: string;
}

// One palette, four meanings, used by every surface: emerald → cyan → amber → rose,
// i.e. 🟢 excellent · 🟡 good · 🟠 fair · 🔴 not recommended.
export const experienceTierTone: Record<ExperienceTier, ExperienceTierTone> = {
  excellent: {
    container:
      'border-emerald-200/90 bg-emerald-50/78 text-emerald-800 backdrop-blur-md dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-300',
    strong: 'text-emerald-700 dark:text-emerald-200',
  },
  good: {
    container:
      'border-cyan-200/90 bg-cyan-50/78 text-cyan-800 backdrop-blur-md dark:border-cyan-900/50 dark:bg-cyan-950/35 dark:text-cyan-200',
    icon: 'text-cyan-600 dark:text-cyan-300',
    strong: 'text-cyan-700 dark:text-cyan-200',
  },
  fair: {
    container:
      'border-amber-200/90 bg-amber-50/78 text-amber-800 backdrop-blur-md dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-300',
    strong: 'text-amber-700 dark:text-amber-200',
  },
  skip: {
    container:
      'border-rose-200/90 bg-rose-50/78 text-rose-800 backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300',
    strong: 'text-rose-700 dark:text-rose-200',
  },
};
