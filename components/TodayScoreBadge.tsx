import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { LanguageCode, SwimmingComfort } from '../types';
import { getSelectedDayPrefix } from '../utils/dateLabels';
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
  const highRelativeRank = score >= 50;
  const isFiveBeaufort = windBeaufort === 5;
  const isExposedAtFive = isFiveBeaufort && exposureLevel === 'exposed';
  const highRankEnglishLabel = variant === 'hero'
    ? (isFiveBeaufort ? (isExposedAtFive ? 'Exposed to wind' : 'Better wind option') : `one of the more suitable options ${day}, with caution`)
    : (isFiveBeaufort ? (isExposedAtFive ? 'Exposed to wind' : 'Better wind option') : `more suitable option ${day}, with caution`);

  if (language === 'gr') {
    if (isFiveBeaufort) {
      return isExposedAtFive ? 'Εκτεθειμένη στον άνεμο' : 'Πιο υπήνεμη επιλογή';
    }
    if (!highRelativeRank) return `${day} θέλει προσοχή`;
    return variant === 'hero'
      ? `Από τις πιο κατάλληλες επιλογές ${day}, με προσοχή`
      : `Καταλληλότερη επιλογή ${day}, με προσοχή`;
  }

  if (false) {
    return highRelativeRank
      ? (variant === 'hero' ? `καλύτερη διαθέσιμη επιλογή ${day}` : `πιο διαχειρίσιμη επιλογή ${day}`)
      : `${day} θέλει προσοχή`;
  }

  if (language === 'de') return highRelativeRank ? (variant === 'hero' ? 'Beste verfugbare Option' : 'Besser handhabbare Option') : 'Vorsicht heute';
  if (language === 'it') return highRelativeRank ? (variant === 'hero' ? 'Migliore opzione disponibile' : 'Opzione piu gestibile') : 'Oggi serve cautela';
  if (language === 'fr') return highRelativeRank ? (variant === 'hero' ? 'Meilleure option disponible' : 'Option plus gerable') : 'Prudence aujourd hui';
  return highRelativeRank ? highRankEnglishLabel : (isFiveBeaufort ? (isExposedAtFive ? 'Exposed to wind' : 'Better wind option') : `use caution ${day}`);
};

const getTodayScoreLabel = (score: number, language: LanguageCode, selectedDate?: Date, capped = false, windBeaufort?: number, exposureLevel?: ExposureLevel) => {
  if (capped) return getCappedConditionLabel(score, language, 'card', selectedDate, windBeaufort, exposureLevel);

  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  if (windBeaufort === 4 && score < 64) {
    return language === 'gr'
      ? (score >= 50 ? `Μέτρια επιλογή ${day}` : 'Επηρεάζεται από τον άνεμο')
      : (score >= 50 ? `fair option ${day}` : 'Affected by wind');
  }

  if (language === 'gr') {
    if (score >= 88) return `Εξαιρετική ${day}`;
    if (score >= 76) return `Πολύ καλή ${day}`;
    if (score >= 64) return `Καλή επιλογή ${day}`;
    if (score >= 50) return `Μέτρια επιλογή ${day}`;
    return `όχι ιδανική ${day}`;
  }

  if (score >= 88) return `excellent ${day}`;
  if (score >= 76) return `very good ${day}`;
  if (score >= 64) return `good choice ${day}`;
  if (score >= 50) return `use caution ${day}`;
  return `not ideal ${day}`;
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
  if (windBeaufort === 4 && score < 64) {
    return language === 'gr'
      ? (score >= 50 ? `Μέτρια επιλογή ${day}` : 'Επηρεάζεται από τον άνεμο')
      : (score >= 50 ? `fair option ${day}` : 'Affected by wind');
  }

  if (language === 'gr') {
    if (score >= 88) return `Εξαιρετική επιλογή ${day}`;
    if (score >= 76) return `Πολύ καλή επιλογή ${day}`;
    if (score >= 64) return `Καλή επιλογή ${day}`;
    if (score >= 50) return `Μέτρια επιλογή ${day}`;
    return `Όχι ιδανική ${day}`;
  }

  if (score >= 88) return `excellent choice ${day}`;
  if (score >= 76) return `very good choice ${day}`;
  if (score >= 64) return `good choice ${day}`;
  if (score >= 50) return `use caution ${day}`;
  return `not ideal ${day}`;
};

const getTodayScoreTone = (score: number, capped = false) => {
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
  const tone = getTodayScoreTone(normalizedScore, conditionCapped);

  if (windBeaufort === 4) {
    return null;
  }

  if (variant === 'hero') {
    return (
      <div className={`inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm sm:w-fit ${tone.container}`}>
        <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${tone.icon}`} />
        <span className="min-w-0 text-xs font-bold leading-tight sm:text-sm">
          <span>{getHeroTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel)}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${tone.container}`}>
      <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 ${tone.icon}`} />
      <span className="min-w-0 truncate">{getTodayScoreLabel(normalizedScore, language, selectedDate, conditionCapped, windBeaufort, exposureLevel)}</span>
    </div>
  );
};
