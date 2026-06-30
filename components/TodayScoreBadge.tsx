import React from 'react';
import { BarChart3, Ship } from 'lucide-react';
import { LanguageCode, SwimmingComfort } from '../types';
import { getSelectedDayPrefix, getSelectedHourPrefix, isSelectedDateToday } from '../utils/dateLabels';
import { getLocalizedCopy } from '../utils/i18n';
import { ExposureLevel } from '../utils/windExposure';
import { getBoatRideMotionLevel, type BoatRideMotionLevel } from '../utils/boatRideMotion';

type TodayScoreVariant = 'hero' | 'card';

interface TodayScoreBadgeProps {
  score: number;
  language: LanguageCode;
  variant?: TodayScoreVariant;
  selectedDate?: Date;
  windBeaufort?: number;
  waveHeightM?: number;
  swimmingComfort?: SwimmingComfort;
  noIdealSwimmingWindow?: boolean;
  exposureLevel?: ExposureLevel;
  selectedHour?: number;
  boatAccess?: boolean;
  /**
   * True only when the beach has authored/verified shelter, so the badge may say
   * "sheltered". A geometry-only 'protected' (canClaim=false) must stay a conservative
   * "more suitable" — otherwise the badge over-claims verified calm (roadmap #5).
   */
  canClaimWindProtection?: boolean;
  /**
   * Render the verdict even in the light-moderate (3–4 Bft) band that is normally
   * suppressed. Used when a beach is shown on its own (e.g. a name-search result),
   * where the user explicitly wants this beach's today status at a glance rather
   * than a clutter-free list of obviously-fine options.
   */
  forceShow?: boolean;
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

type DayLabel = (day: string, isToday: boolean) => string;

type ScoreCopy = {
  exposedToWind: DayLabel;
  shelteredCard: DayLabel;
  shelteredHero: DayLabel;
  caution: DayLabel;
  moreSuitableHero: DayLabel;
  moreSuitableCard: DayLabel;
  fairOption: DayLabel;
  affectedByWind: string;
  excellentCard: DayLabel;
  veryGoodCard: DayLabel;
  goodCard: DayLabel;
  // The bottom tier at light/moderate wind is a relative-quality note, not a warning, so it
  // differentiates by strength: 3 Bft (and below) gets the lighter "λίγο αέρα", 4 Bft the
  // more honest "αρκετό αέρα". Genuine caution (≥5 Bft) goes through `caution`, not here.
  notIdealLight: DayLabel;
  notIdealModerate: DayLabel;
  excellentHero: DayLabel;
  veryGoodHero: DayLabel;
  goodHero: DayLabel;
};

// The verdict pill describes the live, continuously-updating conditions. For *today* (the
// default) that should read as a clean present-tense phrase — a "σήμερα/today" stamp there
// feels disconnected, since conditions shift through the day. Only when the user picks a
// future date do we append the day word (which is then genuinely informative).
const dayLabel = (today: string, withDay: (day: string) => string): DayLabel =>
  (day, isToday) => (isToday ? today : withDay(day));

const scoreCopy: Record<LanguageCode, ScoreCopy> = {
  en: {
    exposedToWind: dayLabel('More exposed to wind', (day) => `More exposed to wind ${day}`),
    shelteredCard: dayLabel('Better wind option', (day) => `Better wind option ${day}`),
    shelteredHero: dayLabel('Better wind option', (day) => `Better wind option ${day}`),
    caution: dayLabel('use caution', (day) => `use caution ${day}`),
    moreSuitableHero: dayLabel('one of the more suitable options, with caution', (day) => `one of the more suitable options ${day}, with caution`),
    moreSuitableCard: dayLabel('more suitable option, with caution', (day) => `more suitable option ${day}, with caution`),
    fairOption: dayLabel('fair option', (day) => `fair option ${day}`),
    affectedByWind: 'Affected by wind',
    excellentCard: dayLabel('very good conditions', (day) => `very good conditions ${day}`),
    veryGoodCard: dayLabel('good conditions', (day) => `good conditions ${day}`),
    goodCard: dayLabel('manageable conditions', (day) => `manageable conditions ${day}`),
    notIdealLight: dayLabel('manageable, a bit breezy', (day) => `manageable ${day}, a bit breezy`),
    notIdealModerate: dayLabel('manageable, fairly breezy', (day) => `manageable ${day}, fairly breezy`),
    excellentHero: dayLabel('very good conditions', (day) => `very good conditions ${day}`),
    veryGoodHero: dayLabel('good conditions', (day) => `good conditions ${day}`),
    goodHero: dayLabel('manageable conditions', (day) => `manageable conditions ${day}`),
  },
  gr: {
    exposedToWind: dayLabel('Πιο εκτεθειμένη στον άνεμο', (day) => `Πιο εκτεθειμένη στον άνεμο ${day}`),
    shelteredCard: dayLabel('Υπήνεμη', (day) => `Υπήνεμη ${day}`),
    shelteredHero: dayLabel('Πιο υπήνεμη επιλογή', (day) => `Πιο υπήνεμη επιλογή ${day}`),
    caution: dayLabel('Θέλει προσοχή', (day) => `${day} θέλει προσοχή`),
    moreSuitableHero: dayLabel('Από τις πιο κατάλληλες επιλογές, με προσοχή', (day) => `Από τις πιο κατάλληλες επιλογές ${day}, με προσοχή`),
    moreSuitableCard: dayLabel('Καταλληλότερη επιλογή, με προσοχή', (day) => `Καταλληλότερη επιλογή ${day}, με προσοχή`),
    fairOption: dayLabel('Μέτρια επιλογή', (day) => `Μέτρια επιλογή ${day}`),
    affectedByWind: 'Επηρεάζεται από τον άνεμο',
    excellentCard: dayLabel('Πολύ καλές συνθήκες', (day) => `Πολύ καλές συνθήκες ${day}`),
    veryGoodCard: dayLabel('Καλές συνθήκες', (day) => `Καλές συνθήκες ${day}`),
    goodCard: dayLabel('Διαχειρίσιμες συνθήκες', (day) => `Διαχειρίσιμες συνθήκες ${day}`),
    notIdealLight: dayLabel('Διαχειρίσιμη, με λίγο αέρα', (day) => `Διαχειρίσιμη ${day}, με λίγο αέρα`),
    notIdealModerate: dayLabel('Διαχειρίσιμη, με αρκετό αέρα', (day) => `Διαχειρίσιμη ${day}, με αρκετό αέρα`),
    excellentHero: dayLabel('Πολύ καλές συνθήκες', (day) => `Πολύ καλές συνθήκες ${day}`),
    veryGoodHero: dayLabel('Καλές συνθήκες', (day) => `Καλές συνθήκες ${day}`),
    goodHero: dayLabel('Διαχειρίσιμες συνθήκες', (day) => `Διαχειρίσιμες συνθήκες ${day}`),
  },
  fr: {
    exposedToWind: dayLabel('Plus exposée au vent', (day) => `Plus exposée au vent ${day}`),
    shelteredCard: dayLabel('Plus abritée', (day) => `Plus abritée ${day}`),
    shelteredHero: dayLabel('Option plus abritée', (day) => `Option plus abritée ${day}`),
    caution: dayLabel('prudence', (day) => `prudence ${day}`),
    moreSuitableHero: dayLabel('parmi les meilleures options, avec prudence', (day) => `parmi les meilleures options ${day}, avec prudence`),
    moreSuitableCard: dayLabel('option plus adaptée, avec prudence', (day) => `option plus adaptée ${day}, avec prudence`),
    fairOption: dayLabel('option correcte', (day) => `option correcte ${day}`),
    affectedByWind: 'Affectée par le vent',
    excellentCard: dayLabel('très bonnes conditions', (day) => `très bonnes conditions ${day}`),
    veryGoodCard: dayLabel('bonnes conditions', (day) => `bonnes conditions ${day}`),
    goodCard: dayLabel('conditions correctes', (day) => `conditions correctes ${day}`),
    notIdealLight: dayLabel('choix correct, un peu de vent', (day) => `choix correct ${day}, un peu de vent`),
    notIdealModerate: dayLabel('choix correct, assez de vent', (day) => `choix correct ${day}, assez de vent`),
    excellentHero: dayLabel('très bonnes conditions', (day) => `très bonnes conditions ${day}`),
    veryGoodHero: dayLabel('bonnes conditions', (day) => `bonnes conditions ${day}`),
    goodHero: dayLabel('conditions correctes', (day) => `conditions correctes ${day}`),
  },
  de: {
    exposedToWind: dayLabel('Windexponiert', (day) => `Windexponiert ${day}`),
    shelteredCard: dayLabel('Windgeschützter', (day) => `Windgeschützter ${day}`),
    shelteredHero: dayLabel('Windgeschütztere Option', (day) => `Windgeschütztere Option ${day}`),
    caution: dayLabel('Vorsicht', (day) => `Vorsicht ${day}`),
    moreSuitableHero: dayLabel('eine der besseren Optionen, mit Vorsicht', (day) => `eine der besseren Optionen ${day}, mit Vorsicht`),
    moreSuitableCard: dayLabel('bessere Option, mit Vorsicht', (day) => `bessere Option ${day}, mit Vorsicht`),
    fairOption: dayLabel('brauchbare Option', (day) => `brauchbare Option ${day}`),
    affectedByWind: 'Vom Wind betroffen',
    excellentCard: dayLabel('sehr gute Bedingungen', (day) => `sehr gute Bedingungen ${day}`),
    veryGoodCard: dayLabel('gute Bedingungen', (day) => `gute Bedingungen ${day}`),
    goodCard: dayLabel('machbare Bedingungen', (day) => `machbare Bedingungen ${day}`),
    notIdealLight: dayLabel('brauchbar, etwas Wind', (day) => `brauchbar ${day}, etwas Wind`),
    notIdealModerate: dayLabel('brauchbar, recht windig', (day) => `brauchbar ${day}, recht windig`),
    excellentHero: dayLabel('sehr gute Bedingungen', (day) => `sehr gute Bedingungen ${day}`),
    veryGoodHero: dayLabel('gute Bedingungen', (day) => `gute Bedingungen ${day}`),
    goodHero: dayLabel('machbare Bedingungen', (day) => `machbare Bedingungen ${day}`),
  },
  it: {
    exposedToWind: dayLabel('Più esposta al vento', (day) => `Più esposta al vento ${day}`),
    shelteredCard: dayLabel('Più riparata', (day) => `Più riparata ${day}`),
    shelteredHero: dayLabel('Opzione più riparata', (day) => `Opzione più riparata ${day}`),
    caution: dayLabel('prudenza', (day) => `prudenza ${day}`),
    moreSuitableHero: dayLabel('tra le opzioni più adatte, con prudenza', (day) => `tra le opzioni più adatte ${day}, con prudenza`),
    moreSuitableCard: dayLabel('opzione più adatta, con prudenza', (day) => `opzione più adatta ${day}, con prudenza`),
    fairOption: dayLabel('opzione discreta', (day) => `opzione discreta ${day}`),
    affectedByWind: 'Condizionata dal vento',
    excellentCard: dayLabel('condizioni molto buone', (day) => `condizioni molto buone ${day}`),
    veryGoodCard: dayLabel('condizioni buone', (day) => `condizioni buone ${day}`),
    goodCard: dayLabel('condizioni gestibili', (day) => `condizioni gestibili ${day}`),
    notIdealLight: dayLabel("gestibile, un po' di vento", (day) => `gestibile ${day}, un po' di vento`),
    notIdealModerate: dayLabel('gestibile, abbastanza vento', (day) => `gestibile ${day}, abbastanza vento`),
    excellentHero: dayLabel('condizioni molto buone', (day) => `condizioni molto buone ${day}`),
    veryGoodHero: dayLabel('condizioni buone', (day) => `condizioni buone ${day}`),
    goodHero: dayLabel('condizioni gestibili', (day) => `condizioni gestibili ${day}`),
  },
};

type BoatBadgeCopy = Record<BoatRideMotionLevel, string>;

const boatBadgeCopy: Record<LanguageCode, BoatBadgeCopy> = {
  en: {
    smooth: 'Smooth ride',
    light: 'A little motion',
    bumpy: 'Bumpy ride',
    rough: 'Very bumpy',
  },
  gr: {
    smooth: 'Ήρεμη διαδρομή',
    light: 'Λίγο κούνημα',
    bumpy: 'Κουνάει αρκετά',
    rough: 'Πολύ κούνημα',
  },
  fr: {
    smooth: 'Trajet calme',
    light: 'Un peu de mouvement',
    bumpy: 'Trajet agite',
    rough: 'Tres agite',
  },
  de: {
    smooth: 'Ruhige Fahrt',
    light: 'Etwas Bewegung',
    bumpy: 'Unruhige Fahrt',
    rough: 'Sehr unruhig',
  },
  it: {
    smooth: 'Tragitto tranquillo',
    light: 'Un po di movimento',
    bumpy: 'Tragitto mosso',
    rough: 'Molto mosso',
  },
};

const getBoatRideBadgeLabel = (
  level: BoatRideMotionLevel,
  language: LanguageCode
): string => {
  const copy = getLocalizedCopy(language, boatBadgeCopy);
  return copy[level];
};

const hasHardConditionCap = (
  windBeaufort?: number,
  waveHeightM?: number,
  swimmingComfort?: SwimmingComfort,
  noIdealSwimmingWindow?: boolean
) => {
  const hasHardWind = typeof windBeaufort === 'number' && windBeaufort >= 5;
  const hasHardSea = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 0.8;

  return Boolean(
    hasHardWind ||
    hasHardSea ||
    ((noIdealSwimmingWindow || swimmingComfort === 'avoid_swimming') && (hasHardWind || hasHardSea))
  );
};

const getCappedConditionLabel = (
  score: number,
  language: LanguageCode,
  variant: TodayScoreVariant,
  selectedDate?: Date,
  windBeaufort?: number,
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean,
  selectedHour?: number
) => {
  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const useCurrentPhrase = isToday && !hour;
  const copy = getLocalizedCopy(language, scoreCopy);
  const highRelativeRank = score >= 50;
  const isFiveBeaufort = windBeaufort === 5;
  const isExposedAtFive = isFiveBeaufort && exposureLevel === 'exposed';
  const isLightOrModerateWind = typeof windBeaufort === 'number' && windBeaufort <= 4;

  if (isLightOrModerateWind) {
    if (!highRelativeRank) return (typeof windBeaufort === 'number' && windBeaufort >= 4 ? copy.notIdealModerate : copy.notIdealLight)(day, useCurrentPhrase);
    return variant === 'hero'
      ? copy.goodHero(day, useCurrentPhrase)
      : copy.goodCard(day, useCurrentPhrase);
  }

  if (isFiveBeaufort) {
    if (isExposedAtFive) return copy.exposedToWind(day, useCurrentPhrase);
    // Only a genuinely protected beach earns the clean "sheltered pick" wording.
    // A merely partly-sheltered beach (side exposure) on a 5 Bft day is still a
    // tricky day, so it gets the "with caution" wording instead of an endorsement
    // — otherwise the badge ("better wind option") contradicts the "difficult
    // conditions" verdict shown for the very same beach.
    if (exposureLevel === 'protected' && canClaimWindProtection === true) {
      return variant === 'card' ? copy.shelteredCard(day, useCurrentPhrase) : copy.shelteredHero(day, useCurrentPhrase);
    }
    if (!highRelativeRank) return copy.caution(day, useCurrentPhrase);
    return variant === 'hero'
      ? copy.moreSuitableHero(day, useCurrentPhrase)
      : copy.moreSuitableCard(day, useCurrentPhrase);
  }

  if (!highRelativeRank) return copy.caution(day, useCurrentPhrase);
  return variant === 'hero'
    ? copy.moreSuitableHero(day, useCurrentPhrase)
    : copy.moreSuitableCard(day, useCurrentPhrase);
};

const getTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel, canClaimWindProtection?: boolean, selectedHour?: number) => {
  if (capped) return getCappedConditionLabel(score, language, 'card', selectedDate, windBeaufort, exposureLevel, canClaimWindProtection, selectedHour);

  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const useCurrentPhrase = isToday && !hour;
  const copy = getLocalizedCopy(language, scoreCopy);
  if (typeof windBeaufort === 'number' && windBeaufort <= 4) {
    if (score >= 88) return copy.excellentCard(day, useCurrentPhrase);
    if (score >= 76) return copy.veryGoodCard(day, useCurrentPhrase);
    if (score >= 50) return copy.goodCard(day, useCurrentPhrase);
    return (typeof windBeaufort === 'number' && windBeaufort >= 4 ? copy.notIdealModerate : copy.notIdealLight)(day, useCurrentPhrase);
  }

  if (score >= 88) return copy.excellentCard(day, useCurrentPhrase);
  if (score >= 76) return copy.veryGoodCard(day, useCurrentPhrase);
  if (score >= 64) return copy.goodCard(day, useCurrentPhrase);
  if (score >= 50) return copy.caution(day, useCurrentPhrase);
  return (typeof windBeaufort === 'number' && windBeaufort >= 4 ? copy.notIdealModerate : copy.notIdealLight)(day, useCurrentPhrase);
};

export const getDisplayTodayScore = (score: number): number => {
  const normalized = clampScore(score);
  if (normalized >= 98) return 92;
  if (normalized >= 94) return 90;
  if (normalized >= 90) return 88;
  if (normalized >= 86) return 84;
  return normalized;
};

const getHeroTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel, canClaimWindProtection?: boolean, selectedHour?: number) => {
  if (capped) return getCappedConditionLabel(score, language, 'hero', selectedDate, windBeaufort, exposureLevel, canClaimWindProtection, selectedHour);

  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const useCurrentPhrase = isToday && !hour;
  const copy = getLocalizedCopy(language, scoreCopy);
  if (typeof windBeaufort === 'number' && windBeaufort <= 4) {
    if (score >= 88) return copy.excellentHero(day, useCurrentPhrase);
    if (score >= 76) return copy.veryGoodHero(day, useCurrentPhrase);
    if (score >= 50) return copy.goodHero(day, useCurrentPhrase);
    return (typeof windBeaufort === 'number' && windBeaufort >= 4 ? copy.notIdealModerate : copy.notIdealLight)(day, useCurrentPhrase);
  }

  if (score >= 88) return copy.excellentHero(day, useCurrentPhrase);
  if (score >= 76) return copy.veryGoodHero(day, useCurrentPhrase);
  if (score >= 64) return copy.goodHero(day, useCurrentPhrase);
  if (score >= 50) return copy.caution(day, useCurrentPhrase);
  return (typeof windBeaufort === 'number' && windBeaufort >= 4 ? copy.notIdealModerate : copy.notIdealLight)(day, useCurrentPhrase);
};

const getTodayScoreTone = (score: number, capped = false, windBeaufort?: number) => {
  const isLightOrModerateWind = typeof windBeaufort === 'number' && windBeaufort <= 4;

  if (isLightOrModerateWind && score >= 50) {
    return {
      container: 'border-cyan-200/90 bg-cyan-50/78 text-cyan-800 backdrop-blur-md dark:border-cyan-900/50 dark:bg-cyan-950/35 dark:text-cyan-200',
      icon: 'text-cyan-600 dark:text-cyan-300',
      strong: 'text-cyan-700 dark:text-cyan-200',
    };
  }

  // Light/moderate wind (≤4 Bft) is never an alarm. A weaker pick here is a mild heads-up
  // ("manageable, with wind"), so the pill stays amber, not the rose used for strong wind.
  if (isLightOrModerateWind) {
    return {
      container: 'border-amber-200/90 bg-amber-50/78 text-amber-800 backdrop-blur-md dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200',
      icon: 'text-amber-600 dark:text-amber-300',
      strong: 'text-amber-700 dark:text-amber-200',
    };
  }

  if (capped) {
    return {
      container: 'border-amber-200/90 bg-amber-50/78 text-amber-800 backdrop-blur-md dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200',
      icon: 'text-amber-600 dark:text-amber-300',
      strong: 'text-amber-700 dark:text-amber-200',
    };
  }

  if (score >= 85) {
    return {
      container: 'border-emerald-200/90 bg-emerald-50/78 text-emerald-800 backdrop-blur-md dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200',
      icon: 'text-emerald-600 dark:text-emerald-300',
      strong: 'text-emerald-700 dark:text-emerald-200',
    };
  }
  if (score >= 70) {
    return {
      container: 'border-cyan-200/90 bg-cyan-50/78 text-cyan-800 backdrop-blur-md dark:border-cyan-900/50 dark:bg-cyan-950/35 dark:text-cyan-200',
      icon: 'text-cyan-600 dark:text-cyan-300',
      strong: 'text-cyan-700 dark:text-cyan-200',
    };
  }
  if (score >= 50) {
    return {
      container: 'border-orange-200/90 bg-orange-50/78 text-orange-800 backdrop-blur-md dark:border-orange-900/50 dark:bg-orange-950/35 dark:text-orange-200',
      icon: 'text-orange-600 dark:text-orange-300',
      strong: 'text-orange-700 dark:text-orange-200',
    };
  }
  return {
    container: 'border-rose-200/90 bg-rose-50/78 text-rose-800 backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300',
    strong: 'text-rose-700 dark:text-rose-200',
  };
};

const getBoatRideTone = (level: BoatRideMotionLevel, isEstimate = false) => {
  if (isEstimate) {
    return {
      container: 'border-slate-200/90 bg-slate-50/78 text-slate-700 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/35 dark:text-slate-200',
      icon: 'text-slate-500 dark:text-slate-300',
      strong: 'text-slate-700 dark:text-slate-200',
    };
  }

  if (level === 'smooth') {
    return {
      container: 'border-emerald-200/90 bg-emerald-50/78 text-emerald-800 backdrop-blur-md dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200',
      icon: 'text-emerald-600 dark:text-emerald-300',
      strong: 'text-emerald-700 dark:text-emerald-200',
    };
  }

  if (level === 'light') {
    return {
      container: 'border-cyan-200/90 bg-cyan-50/78 text-cyan-800 backdrop-blur-md dark:border-cyan-900/50 dark:bg-cyan-950/35 dark:text-cyan-200',
      icon: 'text-cyan-600 dark:text-cyan-300',
      strong: 'text-cyan-700 dark:text-cyan-200',
    };
  }

  if (level === 'bumpy') {
    return {
      container: 'border-amber-200/90 bg-amber-50/78 text-amber-800 backdrop-blur-md dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200',
      icon: 'text-amber-600 dark:text-amber-300',
      strong: 'text-amber-700 dark:text-amber-200',
    };
  }

  return {
    container: 'border-rose-200/90 bg-rose-50/78 text-rose-800 backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300',
    strong: 'text-rose-700 dark:text-rose-200',
  };
};

export const TodayScoreBadge: React.FC<TodayScoreBadgeProps> = ({
  score,
  language,
  variant = 'card',
  selectedDate,
  windBeaufort,
  waveHeightM,
  swimmingComfort,
  noIdealSwimmingWindow,
  exposureLevel,
  canClaimWindProtection,
  selectedHour,
  boatAccess = false,
  forceShow = false,
}) => {
  const normalizedScore = clampScore(score);
  const conditionCapped = hasHardConditionCap(windBeaufort, waveHeightM, swimmingComfort, noIdealSwimmingWindow);
  const boatLevel = boatAccess ? getBoatRideMotionLevel(waveHeightM, windBeaufort) : null;
  const tone = boatLevel
    ? getBoatRideTone(boatLevel, !(typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)))
    : getTodayScoreTone(normalizedScore, conditionCapped, windBeaufort);
  const boatLabel = boatLevel ? getBoatRideBadgeLabel(boatLevel, language) : null;
  const BadgeIcon = boatAccess ? Ship : BarChart3;

  if (!boatAccess && !forceShow && typeof windBeaufort === 'number' && windBeaufort >= 3 && windBeaufort <= 4) {
    return null;
  }

  if (variant === 'hero') {
    return (
      <div className={`inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm sm:w-fit ${tone.container}`}>
        <BadgeIcon className={`h-4 w-4 flex-shrink-0 ${tone.icon}`} />
        <span className="min-w-0 text-xs font-bold leading-tight sm:text-sm">
          <span>{boatLabel ?? getHeroTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel, canClaimWindProtection, selectedHour)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${tone.container}`}>
      <BadgeIcon className={`h-3.5 w-3.5 flex-shrink-0 ${tone.icon}`} />
      <span className="min-w-0 truncate">{boatLabel ?? getTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel, canClaimWindProtection, selectedHour)}</span>
    </div>
  );
};
