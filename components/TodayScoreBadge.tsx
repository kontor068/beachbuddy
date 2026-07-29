import React from 'react';
import { BarChart3, Ship } from 'lucide-react';
import { LanguageCode, SwimmingComfort } from '../types';
import { getLocalizedCopy } from '../utils/i18n';
import { ExposureLevel } from '../utils/windExposure';
import { getBoatRideMotionLevel, type BoatRideMotionLevel } from '../utils/boatRideMotion';
import { getExperienceTier, getExperienceTierLabel, experienceTierTone } from '../utils/experienceTier';
import { getSeaSeverity } from '../utils/seaVerdict';

type TodayScoreVariant = 'hero' | 'card';

interface TodayScoreBadgeProps {
  score: number;
  language: LanguageCode;
  variant?: TodayScoreVariant;
  selectedDate?: Date;
  windBeaufort?: number;
  waveHeightM?: number;
  /** Total-sea period (s) for the same reading — keeps the badge on the shared wave scale. */
  wavePeriodS?: number;
  swimmingComfort?: SwimmingComfort;
  /** 0–10 from calculateSeaConditionScore — the same figure the "weather now" chip reads, so the
   *  badge can never sit a tier above the chip printed a few lines below it. */
  seaConditionScore?: number;
  noIdealSwimmingWindow?: boolean;
  exposureLevel?: ExposureLevel;
  selectedHour?: number;
  boatAccess?: boolean;
  /**
   * Accepted for call-site compatibility. The verdict now communicates the overall
   * experience tier, so shelter-specific wording (and its "may we claim calm" guard)
   * no longer applies here.
   */
  canClaimWindProtection?: boolean;
  /**
   * Accepted for call-site compatibility. The experience-tier verdict is always shown
   * now, so this no longer gates rendering.
   */
  forceShow?: boolean;
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

type BoatBadgeCopy = Record<BoatRideMotionLevel, string>;

const boatBadgeCopy: Record<LanguageCode, BoatBadgeCopy> = {
  en: {
    smooth: 'Ideal conditions',
    light: 'A little motion',
    bumpy: 'Bumpy ride',
    rough: 'Very bumpy',
  },
  gr: {
    smooth: 'Ιδανικές συνθήκες',
    light: 'Λίγο κούνημα',
    bumpy: 'Κουνάει αρκετά',
    rough: 'Πολύ κούνημα',
  },
  fr: {
    smooth: 'Conditions idéales',
    light: 'Un peu de mouvement',
    bumpy: 'Trajet agité',
    rough: 'Très agité',
  },
  de: {
    smooth: 'Ideale Bedingungen',
    light: 'Etwas Bewegung',
    bumpy: 'Unruhige Fahrt',
    rough: 'Sehr unruhig',
  },
  it: {
    smooth: 'Condizioni ideali',
    light: 'Un po’ di movimento',
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

export const getDisplayTodayScore = (score: number): number => {
  const normalized = clampScore(score);
  if (normalized >= 98) return 92;
  if (normalized >= 94) return 90;
  if (normalized >= 90) return 88;
  if (normalized >= 86) return 84;
  return normalized;
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
  wavePeriodS,
  swimmingComfort,
  seaConditionScore,
  noIdealSwimmingWindow,
  exposureLevel,
  selectedHour,
  boatAccess = false,
  forceShow = false,
}) => {
  // Light/moderate wind (3–4 Bft) is unremarkable, so on a list the verdict is suppressed to
  // avoid clutter unless a caller forces it (e.g. a single searched beach). Making the tier
  // always-visible on cards is a card-level change handled separately, not here.
  if (!boatAccess && !forceShow && typeof windBeaufort === 'number' && windBeaufort >= 3 && windBeaufort <= 4) {
    return null;
  }

  const boatLevel = boatAccess ? getBoatRideMotionLevel(waveHeightM, windBeaufort) : null;

  let tone: { container: string; icon: string; strong: string };
  let label: string;
  if (boatLevel) {
    tone = getBoatRideTone(boatLevel, !(typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)));
    label = getBoatRideBadgeLabel(boatLevel, language);
  } else {
    const tier = getExperienceTier({
      score: clampScore(score),
      windBeaufort,
      waveHeightM,
      wavePeriodS,
      swimmingComfort,
      seaConditionScore,
      noIdealSwimmingWindow,
      exposureLevel,
    });
    tone = experienceTierTone[tier];
    // The label must know the SHARED sea verdict, or 'fair' prints "OK today" above a swim chip
    // that says the water is difficult — the pair reported from Ios on 29/07/2026.
    const seaIsRough = getSeaSeverity({ waveHeightM, wavePeriodS, windBeaufort, exposureLevel }) === 'rough';
    label = getExperienceTierLabel(tier, language, { selectedDate, selectedHour, windBeaufort, seaIsRough });
  }

  const BadgeIcon = boatAccess ? Ship : BarChart3;

  if (variant === 'hero') {
    return (
      <div className={`inline-flex w-full max-w-full min-w-0 items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm sm:w-fit ${tone.container}`}>
        <BadgeIcon className={`h-4 w-4 flex-shrink-0 ${tone.icon}`} />
        <span className="min-w-0 text-xs font-bold leading-tight sm:text-sm">
          <span>{label}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${tone.container}`}>
      <BadgeIcon className={`h-3.5 w-3.5 flex-shrink-0 ${tone.icon}`} />
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
};
