import React from 'react';
import { BarChart3 } from 'lucide-react';
import { LanguageCode, SwimmingComfort } from '../types';
import { getSelectedDayPrefix, isSelectedDateToday } from '../utils/dateLabels';
import { getLocalizedCopy } from '../utils/i18n';
import { ExposureLevel } from '../utils/windExposure';

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
  exposedToWind: string;
  shelteredCard: string;
  shelteredHero: string;
  caution: DayLabel;
  moreSuitableHero: DayLabel;
  moreSuitableCard: DayLabel;
  fairOption: DayLabel;
  affectedByWind: string;
  excellentCard: DayLabel;
  veryGoodCard: DayLabel;
  goodCard: DayLabel;
  notIdeal: DayLabel;
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
    exposedToWind: 'Exposed to wind',
    shelteredCard: 'Better wind option',
    shelteredHero: 'Better wind option',
    caution: dayLabel('use caution', (day) => `use caution ${day}`),
    moreSuitableHero: dayLabel('one of the more suitable options, with caution', (day) => `one of the more suitable options ${day}, with caution`),
    moreSuitableCard: dayLabel('more suitable option, with caution', (day) => `more suitable option ${day}, with caution`),
    fairOption: dayLabel('fair option', (day) => `fair option ${day}`),
    affectedByWind: 'Affected by wind',
    excellentCard: dayLabel('very good conditions', (day) => `very good conditions ${day}`),
    veryGoodCard: dayLabel('good conditions', (day) => `good conditions ${day}`),
    goodCard: dayLabel('manageable conditions', (day) => `manageable conditions ${day}`),
    notIdeal: dayLabel('more demanding conditions', (day) => `more demanding conditions ${day}`),
    excellentHero: dayLabel('very good conditions', (day) => `very good conditions ${day}`),
    veryGoodHero: dayLabel('good conditions', (day) => `good conditions ${day}`),
    goodHero: dayLabel('manageable conditions', (day) => `manageable conditions ${day}`),
  },
  gr: {
    exposedToWind: 'Εκτεθειμένη στον άνεμο',
    shelteredCard: 'Υπήνεμη',
    shelteredHero: 'Πιο υπήνεμη επιλογή',
    caution: dayLabel('Θέλει προσοχή', (day) => `${day} θέλει προσοχή`),
    moreSuitableHero: dayLabel('Από τις πιο κατάλληλες επιλογές, με προσοχή', (day) => `Από τις πιο κατάλληλες επιλογές ${day}, με προσοχή`),
    moreSuitableCard: dayLabel('Καταλληλότερη επιλογή, με προσοχή', (day) => `Καταλληλότερη επιλογή ${day}, με προσοχή`),
    fairOption: dayLabel('Μέτρια επιλογή', (day) => `Μέτρια επιλογή ${day}`),
    affectedByWind: 'Επηρεάζεται από τον άνεμο',
    excellentCard: dayLabel('Πολύ καλές συνθήκες', (day) => `Πολύ καλές συνθήκες ${day}`),
    veryGoodCard: dayLabel('Καλές συνθήκες', (day) => `Καλές συνθήκες ${day}`),
    goodCard: dayLabel('Διαχειρίσιμες συνθήκες', (day) => `Διαχειρίσιμες συνθήκες ${day}`),
    notIdeal: dayLabel('Πιο απαιτητικές συνθήκες', (day) => `Πιο απαιτητικές συνθήκες ${day}`),
    excellentHero: dayLabel('Πολύ καλές συνθήκες', (day) => `Πολύ καλές συνθήκες ${day}`),
    veryGoodHero: dayLabel('Καλές συνθήκες', (day) => `Καλές συνθήκες ${day}`),
    goodHero: dayLabel('Διαχειρίσιμες συνθήκες', (day) => `Διαχειρίσιμες συνθήκες ${day}`),
  },
  fr: {
    exposedToWind: 'Exposée au vent',
    shelteredCard: 'Plus abritée',
    shelteredHero: 'Option plus abritée',
    caution: dayLabel('prudence', (day) => `prudence ${day}`),
    moreSuitableHero: dayLabel('parmi les meilleures options, avec prudence', (day) => `parmi les meilleures options ${day}, avec prudence`),
    moreSuitableCard: dayLabel('option plus adaptée, avec prudence', (day) => `option plus adaptée ${day}, avec prudence`),
    fairOption: dayLabel('option correcte', (day) => `option correcte ${day}`),
    affectedByWind: 'Affectée par le vent',
    excellentCard: dayLabel('très bonnes conditions', (day) => `très bonnes conditions ${day}`),
    veryGoodCard: dayLabel('bonnes conditions', (day) => `bonnes conditions ${day}`),
    goodCard: dayLabel('conditions correctes', (day) => `conditions correctes ${day}`),
    notIdeal: dayLabel('conditions plus exigeantes', (day) => `conditions plus exigeantes ${day}`),
    excellentHero: dayLabel('très bonnes conditions', (day) => `très bonnes conditions ${day}`),
    veryGoodHero: dayLabel('bonnes conditions', (day) => `bonnes conditions ${day}`),
    goodHero: dayLabel('conditions correctes', (day) => `conditions correctes ${day}`),
  },
  de: {
    exposedToWind: 'Windexponiert',
    shelteredCard: 'Windgeschützter',
    shelteredHero: 'Windgeschütztere Option',
    caution: dayLabel('Vorsicht', (day) => `Vorsicht ${day}`),
    moreSuitableHero: dayLabel('eine der besseren Optionen, mit Vorsicht', (day) => `eine der besseren Optionen ${day}, mit Vorsicht`),
    moreSuitableCard: dayLabel('bessere Option, mit Vorsicht', (day) => `bessere Option ${day}, mit Vorsicht`),
    fairOption: dayLabel('brauchbare Option', (day) => `brauchbare Option ${day}`),
    affectedByWind: 'Vom Wind betroffen',
    excellentCard: dayLabel('sehr gute Bedingungen', (day) => `sehr gute Bedingungen ${day}`),
    veryGoodCard: dayLabel('gute Bedingungen', (day) => `gute Bedingungen ${day}`),
    goodCard: dayLabel('machbare Bedingungen', (day) => `machbare Bedingungen ${day}`),
    notIdeal: dayLabel('anspruchsvollere Bedingungen', (day) => `anspruchsvollere Bedingungen ${day}`),
    excellentHero: dayLabel('sehr gute Bedingungen', (day) => `sehr gute Bedingungen ${day}`),
    veryGoodHero: dayLabel('gute Bedingungen', (day) => `gute Bedingungen ${day}`),
    goodHero: dayLabel('machbare Bedingungen', (day) => `machbare Bedingungen ${day}`),
  },
  it: {
    exposedToWind: 'Esposta al vento',
    shelteredCard: 'Più riparata',
    shelteredHero: 'Opzione più riparata',
    caution: dayLabel('prudenza', (day) => `prudenza ${day}`),
    moreSuitableHero: dayLabel('tra le opzioni più adatte, con prudenza', (day) => `tra le opzioni più adatte ${day}, con prudenza`),
    moreSuitableCard: dayLabel('opzione più adatta, con prudenza', (day) => `opzione più adatta ${day}, con prudenza`),
    fairOption: dayLabel('opzione discreta', (day) => `opzione discreta ${day}`),
    affectedByWind: 'Condizionata dal vento',
    excellentCard: dayLabel('condizioni molto buone', (day) => `condizioni molto buone ${day}`),
    veryGoodCard: dayLabel('condizioni buone', (day) => `condizioni buone ${day}`),
    goodCard: dayLabel('condizioni gestibili', (day) => `condizioni gestibili ${day}`),
    notIdeal: dayLabel('condizioni più impegnative', (day) => `condizioni più impegnative ${day}`),
    excellentHero: dayLabel('condizioni molto buone', (day) => `condizioni molto buone ${day}`),
    veryGoodHero: dayLabel('condizioni buone', (day) => `condizioni buone ${day}`),
    goodHero: dayLabel('condizioni gestibili', (day) => `condizioni gestibili ${day}`),
  },
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
  canClaimWindProtection?: boolean
) => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const copy = getLocalizedCopy(language, scoreCopy);
  const highRelativeRank = score >= 50;
  const isFiveBeaufort = windBeaufort === 5;
  const isExposedAtFive = isFiveBeaufort && exposureLevel === 'exposed';
  const isLightOrModerateWind = typeof windBeaufort === 'number' && windBeaufort <= 4;

  if (isLightOrModerateWind) {
    if (!highRelativeRank) return copy.notIdeal(day, isToday);
    return variant === 'hero'
      ? copy.goodHero(day, isToday)
      : copy.goodCard(day, isToday);
  }

  if (isFiveBeaufort) {
    if (isExposedAtFive) return copy.exposedToWind;
    // Only a genuinely protected beach earns the clean "sheltered pick" wording.
    // A merely partly-sheltered beach (side exposure) on a 5 Bft day is still a
    // tricky day, so it gets the "with caution" wording instead of an endorsement
    // — otherwise the badge ("better wind option") contradicts the "difficult
    // conditions" verdict shown for the very same beach.
    if (exposureLevel === 'protected' && canClaimWindProtection === true) {
      return variant === 'card' ? copy.shelteredCard : copy.shelteredHero;
    }
    if (!highRelativeRank) return copy.caution(day, isToday);
    return variant === 'hero'
      ? copy.moreSuitableHero(day, isToday)
      : copy.moreSuitableCard(day, isToday);
  }

  if (!highRelativeRank) return copy.caution(day, isToday);
  return variant === 'hero'
    ? copy.moreSuitableHero(day, isToday)
    : copy.moreSuitableCard(day, isToday);
};

const getTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel, canClaimWindProtection?: boolean) => {
  if (capped) return getCappedConditionLabel(score, language, 'card', selectedDate, windBeaufort, exposureLevel, canClaimWindProtection);

  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const copy = getLocalizedCopy(language, scoreCopy);
  if (typeof windBeaufort === 'number' && windBeaufort <= 4) {
    if (score >= 88) return copy.excellentCard(day, isToday);
    if (score >= 76) return copy.veryGoodCard(day, isToday);
    if (score >= 50) return copy.goodCard(day, isToday);
    return copy.notIdeal(day, isToday);
  }

  if (score >= 88) return copy.excellentCard(day, isToday);
  if (score >= 76) return copy.veryGoodCard(day, isToday);
  if (score >= 64) return copy.goodCard(day, isToday);
  if (score >= 50) return copy.caution(day, isToday);
  return copy.notIdeal(day, isToday);
};

export const getDisplayTodayScore = (score: number): number => {
  const normalized = clampScore(score);
  if (normalized >= 98) return 92;
  if (normalized >= 94) return 90;
  if (normalized >= 90) return 88;
  if (normalized >= 86) return 84;
  return normalized;
};

const getHeroTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel, canClaimWindProtection?: boolean) => {
  if (capped) return getCappedConditionLabel(score, language, 'hero', selectedDate, windBeaufort, exposureLevel, canClaimWindProtection);

  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const copy = getLocalizedCopy(language, scoreCopy);
  if (typeof windBeaufort === 'number' && windBeaufort <= 4) {
    if (score >= 88) return copy.excellentHero(day, isToday);
    if (score >= 76) return copy.veryGoodHero(day, isToday);
    if (score >= 50) return copy.goodHero(day, isToday);
    return copy.notIdeal(day, isToday);
  }

  if (score >= 88) return copy.excellentHero(day, isToday);
  if (score >= 76) return copy.veryGoodHero(day, isToday);
  if (score >= 64) return copy.goodHero(day, isToday);
  if (score >= 50) return copy.caution(day, isToday);
  return copy.notIdeal(day, isToday);
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
  forceShow = false,
}) => {
  const normalizedScore = clampScore(score);
  const conditionCapped = hasHardConditionCap(windBeaufort, waveHeightM, swimmingComfort, noIdealSwimmingWindow);
  const tone = getTodayScoreTone(normalizedScore, conditionCapped, windBeaufort);

  if (!forceShow && typeof windBeaufort === 'number' && windBeaufort >= 3 && windBeaufort <= 4) {
    return null;
  }

  if (variant === 'hero') {
    return (
      <div className={`inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm sm:w-fit ${tone.container}`}>
        <BarChart3 className={`h-4 w-4 flex-shrink-0 ${tone.icon}`} />
        <span className="min-w-0 text-xs font-bold leading-tight sm:text-sm">
          <span>{getHeroTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel, canClaimWindProtection)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${tone.container}`}>
      <BarChart3 className={`h-3.5 w-3.5 flex-shrink-0 ${tone.icon}`} />
      <span className="min-w-0 truncate">{getTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel, canClaimWindProtection)}</span>
    </div>
  );
};
