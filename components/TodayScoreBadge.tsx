import React from 'react';
import { BarChart3 } from 'lucide-react';
import { LanguageCode, SwimmingComfort } from '../types';
import { getSelectedDayPrefix } from '../utils/dateLabels';
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
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

type ScoreCopy = {
  exposedToWind: string;
  shelteredCard: string;
  shelteredHero: string;
  caution: (day: string) => string;
  moreSuitableHero: (day: string) => string;
  moreSuitableCard: (day: string) => string;
  fairOption: (day: string) => string;
  affectedByWind: string;
  excellentCard: (day: string) => string;
  veryGoodCard: (day: string) => string;
  goodCard: (day: string) => string;
  notIdeal: (day: string) => string;
  excellentHero: (day: string) => string;
  veryGoodHero: (day: string) => string;
  goodHero: (day: string) => string;
};

const scoreCopy: Record<LanguageCode, ScoreCopy> = {
  en: {
    exposedToWind: 'Exposed to wind',
    shelteredCard: 'Better wind option',
    shelteredHero: 'Better wind option',
    caution: (day) => `use caution ${day}`,
    moreSuitableHero: (day) => `one of the more suitable options ${day}, with caution`,
    moreSuitableCard: (day) => `more suitable option ${day}, with caution`,
    fairOption: (day) => `fair option ${day}`,
    affectedByWind: 'Affected by wind',
    excellentCard: (day) => `excellent ${day}`,
    veryGoodCard: (day) => `very good ${day}`,
    goodCard: (day) => `good choice ${day}`,
    notIdeal: (day) => `not ideal ${day}`,
    excellentHero: (day) => `excellent choice ${day}`,
    veryGoodHero: (day) => `very good choice ${day}`,
    goodHero: (day) => `good choice ${day}`,
  },
  gr: {
    exposedToWind: 'Εκτεθειμένη στον άνεμο',
    shelteredCard: 'Υπήνεμη',
    shelteredHero: 'Πιο υπήνεμη επιλογή',
    caution: (day) => `${day} θέλει προσοχή`,
    moreSuitableHero: (day) => `Από τις πιο κατάλληλες επιλογές ${day}, με προσοχή`,
    moreSuitableCard: (day) => `Καταλληλότερη επιλογή ${day}, με προσοχή`,
    fairOption: (day) => `Μέτρια επιλογή ${day}`,
    affectedByWind: 'Επηρεάζεται από τον άνεμο',
    excellentCard: (day) => `Εξαιρετική ${day}`,
    veryGoodCard: (day) => `Πολύ καλή ${day}`,
    goodCard: (day) => `Καλή επιλογή ${day}`,
    notIdeal: (day) => `Όχι ιδανική ${day}`,
    excellentHero: (day) => `Εξαιρετική επιλογή ${day}`,
    veryGoodHero: (day) => `Πολύ καλή επιλογή ${day}`,
    goodHero: (day) => `Καλή επιλογή ${day}`,
  },
  fr: {
    exposedToWind: 'Exposée au vent',
    shelteredCard: 'Plus abritée',
    shelteredHero: 'Option plus abritée',
    caution: (day) => `prudence ${day}`,
    moreSuitableHero: (day) => `parmi les meilleures options ${day}, avec prudence`,
    moreSuitableCard: (day) => `option plus adaptée ${day}, avec prudence`,
    fairOption: (day) => `option correcte ${day}`,
    affectedByWind: 'Affectée par le vent',
    excellentCard: (day) => `excellente ${day}`,
    veryGoodCard: (day) => `très bonne ${day}`,
    goodCard: (day) => `bon choix ${day}`,
    notIdeal: (day) => `pas idéale ${day}`,
    excellentHero: (day) => `excellent choix ${day}`,
    veryGoodHero: (day) => `très bon choix ${day}`,
    goodHero: (day) => `bon choix ${day}`,
  },
  de: {
    exposedToWind: 'Windexponiert',
    shelteredCard: 'Windgeschützter',
    shelteredHero: 'Windgeschütztere Option',
    caution: (day) => `Vorsicht ${day}`,
    moreSuitableHero: (day) => `eine der besseren Optionen ${day}, mit Vorsicht`,
    moreSuitableCard: (day) => `bessere Option ${day}, mit Vorsicht`,
    fairOption: (day) => `brauchbare Option ${day}`,
    affectedByWind: 'Vom Wind betroffen',
    excellentCard: (day) => `ausgezeichnet ${day}`,
    veryGoodCard: (day) => `sehr gut ${day}`,
    goodCard: (day) => `gute Wahl ${day}`,
    notIdeal: (day) => `nicht ideal ${day}`,
    excellentHero: (day) => `ausgezeichnete Wahl ${day}`,
    veryGoodHero: (day) => `sehr gute Wahl ${day}`,
    goodHero: (day) => `gute Wahl ${day}`,
  },
  it: {
    exposedToWind: 'Esposta al vento',
    shelteredCard: 'Più riparata',
    shelteredHero: 'Opzione più riparata',
    caution: (day) => `prudenza ${day}`,
    moreSuitableHero: (day) => `tra le opzioni più adatte ${day}, con prudenza`,
    moreSuitableCard: (day) => `opzione più adatta ${day}, con prudenza`,
    fairOption: (day) => `opzione discreta ${day}`,
    affectedByWind: 'Condizionata dal vento',
    excellentCard: (day) => `eccellente ${day}`,
    veryGoodCard: (day) => `molto buona ${day}`,
    goodCard: (day) => `buona scelta ${day}`,
    notIdeal: (day) => `non ideale ${day}`,
    excellentHero: (day) => `scelta eccellente ${day}`,
    veryGoodHero: (day) => `scelta molto buona ${day}`,
    goodHero: (day) => `buona scelta ${day}`,
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
  exposureLevel?: ExposureLevel
) => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const copy = getLocalizedCopy(language, scoreCopy);
  const highRelativeRank = score >= 50;
  const isFiveBeaufort = windBeaufort === 5;
  const isExposedAtFive = isFiveBeaufort && exposureLevel === 'exposed';
  const isLightOrModerateWind = typeof windBeaufort === 'number' && windBeaufort <= 4;

  if (isLightOrModerateWind) {
    if (!highRelativeRank) return copy.notIdeal(day);
    return variant === 'hero'
      ? copy.goodHero(day)
      : copy.goodCard(day);
  }

  if (isFiveBeaufort) {
    if (isExposedAtFive) return copy.exposedToWind;
    return variant === 'card' ? copy.shelteredCard : copy.shelteredHero;
  }

  if (!highRelativeRank) return copy.caution(day);
  return variant === 'hero'
    ? copy.moreSuitableHero(day)
    : copy.moreSuitableCard(day);
};

const getTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel) => {
  if (capped) return getCappedConditionLabel(score, language, 'card', selectedDate, windBeaufort, exposureLevel);

  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const copy = getLocalizedCopy(language, scoreCopy);
  if (typeof windBeaufort === 'number' && windBeaufort <= 4) {
    if (score >= 88) return copy.excellentCard(day);
    if (score >= 76) return copy.veryGoodCard(day);
    if (score >= 50) return copy.goodCard(day);
    return copy.notIdeal(day);
  }

  if (score >= 88) return copy.excellentCard(day);
  if (score >= 76) return copy.veryGoodCard(day);
  if (score >= 64) return copy.goodCard(day);
  if (score >= 50) return copy.caution(day);
  return copy.notIdeal(day);
};

export const getDisplayTodayScore = (score: number): number => {
  const normalized = clampScore(score);
  if (normalized >= 98) return 92;
  if (normalized >= 94) return 90;
  if (normalized >= 90) return 88;
  if (normalized >= 86) return 84;
  return normalized;
};

const getHeroTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel) => {
  if (capped) return getCappedConditionLabel(score, language, 'hero', selectedDate, windBeaufort, exposureLevel);

  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const copy = getLocalizedCopy(language, scoreCopy);
  if (typeof windBeaufort === 'number' && windBeaufort <= 4) {
    if (score >= 88) return copy.excellentHero(day);
    if (score >= 76) return copy.veryGoodHero(day);
    if (score >= 50) return copy.goodHero(day);
    return copy.notIdeal(day);
  }

  if (score >= 88) return copy.excellentHero(day);
  if (score >= 76) return copy.veryGoodHero(day);
  if (score >= 64) return copy.goodHero(day);
  if (score >= 50) return copy.caution(day);
  return copy.notIdeal(day);
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
}) => {
  const normalizedScore = clampScore(score);
  const conditionCapped = hasHardConditionCap(windBeaufort, waveHeightM, swimmingComfort, noIdealSwimmingWindow);
  const tone = getTodayScoreTone(normalizedScore, conditionCapped, windBeaufort);

  if (typeof windBeaufort === 'number' && windBeaufort >= 3 && windBeaufort <= 4) {
    return null;
  }

  if (variant === 'hero') {
    return (
      <div className={`inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm sm:w-fit ${tone.container}`}>
        <BarChart3 className={`h-4 w-4 flex-shrink-0 ${tone.icon}`} />
        <span className="min-w-0 text-xs font-bold leading-tight sm:text-sm">
          <span>{getHeroTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${tone.container}`}>
      <BarChart3 className={`h-3.5 w-3.5 flex-shrink-0 ${tone.icon}`} />
      <span className="min-w-0 truncate">{getTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel)}</span>
    </div>
  );
};
