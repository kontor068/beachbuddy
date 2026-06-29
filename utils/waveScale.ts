import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from './i18n';

// Translate a wave height (significant wave height, metres) into something a casual swimmer
// reads at a glance: a human body reference (the surf-report convention — "knee-high",
// "waist-high" WAVES, i.e. wave size next to the body, NOT water depth), a calm→rough colour
// band, and a localized label. Bucket boundaries mirror the measured-wave thresholds in
// utils/seaConditions.ts (>=1.5 / 1.2 / 0.8 / 0.5 / 0.3) so this visual never contradicts the
// sea-comfort score shown elsewhere.

export type WaveBodyRef = 'flat' | 'ankle' | 'knee' | 'waist' | 'chest' | 'overhead';
export type WaveBand = 'calm' | 'amber' | 'rough';

export interface WaveScaleResult {
  bodyRef: WaveBodyRef;
  band: WaveBand;
  /** 0..1 fraction of the figure's height the wave reaches — visual only. */
  bodyFraction: number;
  /** Localized plain-language headline, e.g. "Ως τη μέση". */
  label: string;
  /** Localized supporting detail, e.g. "~0,9 μ" or the estimate phrase. */
  detail: string;
  /** Full sentence for screen readers. */
  ariaLabel: string;
  /** True when there is no measured value — show a neutral, honest "estimate" treatment. */
  isEstimate: boolean;
}

interface WaveBandClasses {
  /** currentColor fill for SVG wave shapes. */
  fill: string;
  /** Solid bar colour for the hourly strip. */
  bar: string;
  /** Soft tinted chrome background. */
  soft: string;
  /** Heading text colour. */
  label: string;
}

// Mirrors BeachConditionScore.getConditionToneClasses: calm→emerald, mixed→amber, rough→rose.
export const WAVE_BAND_CLASSES: Record<WaveBand, WaveBandClasses> = {
  calm: {
    fill: 'text-emerald-500',
    bar: 'bg-emerald-400 dark:bg-emerald-500',
    soft: 'bg-emerald-50/70 dark:bg-emerald-900/20',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    fill: 'text-amber-500',
    bar: 'bg-amber-400 dark:bg-amber-500',
    soft: 'bg-amber-50/70 dark:bg-amber-900/20',
    label: 'text-amber-700 dark:text-amber-300',
  },
  rough: {
    fill: 'text-rose-500',
    bar: 'bg-rose-400 dark:bg-rose-500',
    soft: 'bg-rose-50/70 dark:bg-rose-900/20',
    label: 'text-rose-700 dark:text-rose-300',
  },
};

// Neutral palette for the "estimate from wind" case — we don't know the real height, so we
// avoid the reassuring green (which would assert calm we can't confirm).
export const WAVE_ESTIMATE_CLASSES: WaveBandClasses = {
  fill: 'text-slate-400 dark:text-slate-500',
  bar: 'bg-slate-300 dark:bg-slate-600',
  soft: 'bg-slate-50/70 dark:bg-slate-800/40',
  label: 'text-slate-600 dark:text-slate-300',
};

interface Bucket {
  bodyRef: WaveBodyRef;
  band: WaveBand;
  bodyFraction: number;
}

const bucketFor = (m: number): Bucket => {
  if (m >= 1.5) return { bodyRef: 'overhead', band: 'rough', bodyFraction: 0.95 };
  if (m >= 1.2) return { bodyRef: 'chest', band: 'rough', bodyFraction: 0.72 };
  if (m >= 0.8) return { bodyRef: 'waist', band: 'amber', bodyFraction: 0.5 };
  if (m >= 0.5) return { bodyRef: 'knee', band: 'calm', bodyFraction: 0.3 };
  if (m >= 0.3) return { bodyRef: 'ankle', band: 'calm', bodyFraction: 0.14 };
  return { bodyRef: 'flat', band: 'calm', bodyFraction: 0.05 };
};

const BODY_LABELS: Record<WaveBodyRef, LocalizedCopy<string>> = {
  flat: { en: 'Almost flat', gr: 'Σχεδόν επίπεδη', fr: 'Presque plate', de: 'Fast flach', it: 'Quasi piatta' },
  ankle: { en: 'Ankle-high', gr: 'Ως τον αστράγαλο', fr: 'Hauteur cheville', de: 'Knöchelhoch', it: 'Alla caviglia' },
  knee: { en: 'Knee-high', gr: 'Ως το γόνατο', fr: 'Hauteur genou', de: 'Kniehoch', it: 'Al ginocchio' },
  waist: { en: 'Waist-high', gr: 'Ως τη μέση', fr: 'Hauteur taille', de: 'Hüfthoch', it: 'Alla vita' },
  chest: { en: 'Chest-high', gr: 'Ως το στήθος', fr: 'Hauteur poitrine', de: 'Brusthoch', it: 'Al petto' },
  overhead: { en: 'Overhead', gr: 'Πάνω από το κεφάλι', fr: 'Au-dessus de la tête', de: 'Über Kopf', it: 'Sopra la testa' },
};

const ESTIMATE_LABEL: LocalizedCopy<string> = {
  en: 'Estimate', gr: 'Εκτίμηση', fr: 'Estimation', de: 'Schätzung', it: 'Stima',
};
const ESTIMATE_DETAIL: LocalizedCopy<string> = {
  en: 'from the wind', gr: 'από τον άνεμο', fr: 'd’après le vent', de: 'aus dem Wind', it: 'dal vento',
};
const ARIA_PREFIX: LocalizedCopy<string> = {
  en: 'Waves', gr: 'Κύμα', fr: 'Vagues', de: 'Wellen', it: 'Onde',
};

const formatHeight = (m: number, language: LanguageCode): string => {
  const num = m.toFixed(1);
  return language === 'gr' ? `~${num.replace('.', ',')} μ` : `~${num} m`;
};

export const getWaveScale = (
  waveHeightM: number | undefined,
  language: LanguageCode,
  opts: { isEstimate?: boolean } = {}
): WaveScaleResult => {
  const hasMeasured = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM);
  const isEstimate = opts.isEstimate === true || !hasMeasured;

  if (isEstimate) {
    const label = getLocalizedCopy(language, ESTIMATE_LABEL);
    const detail = getLocalizedCopy(language, ESTIMATE_DETAIL);
    return {
      bodyRef: 'ankle',
      band: 'calm',
      bodyFraction: 0.14,
      label,
      detail,
      ariaLabel: `${getLocalizedCopy(language, ARIA_PREFIX)}: ${label.toLowerCase()} ${detail}`,
      isEstimate: true,
    };
  }

  const bucket = bucketFor(waveHeightM as number);
  const label = getLocalizedCopy(language, BODY_LABELS[bucket.bodyRef]);
  const detail = formatHeight(waveHeightM as number, language);
  return {
    bodyRef: bucket.bodyRef,
    band: bucket.band,
    bodyFraction: bucket.bodyFraction,
    label,
    detail,
    ariaLabel: `${getLocalizedCopy(language, ARIA_PREFIX)}: ${label}, ${detail}`,
    isEstimate: false,
  };
};

/** Band classes for a raw height — used by the hourly strip to colour each bar. */
export const getWaveBandClasses = (waveHeightM: number): WaveBandClasses =>
  WAVE_BAND_CLASSES[bucketFor(waveHeightM).band];

/** 0..1 height for the hourly strip bars (clamped so even flat days show a sliver). */
export const waveBarFraction = (waveHeightM: number): number => {
  const f = bucketFor(waveHeightM).bodyFraction;
  return Math.max(0.08, Math.min(1, f));
};
