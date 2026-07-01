import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from './i18n';

// Translate a wave height (significant wave height, metres) into a calm→rough colour band,
// a visual scale, and a localized headline. Bucket boundaries mirror the measured-wave
// thresholds in utils/seaConditions.ts (>=1.5 / 1.2 / 0.8 / 0.5 / 0.3) so this visual never
// contradicts the sea-comfort score shown elsewhere.

export type WaveBodyRef = 'flat' | 'ankle' | 'knee' | 'waist' | 'chest' | 'overhead';
export type WaveBand = 'calm' | 'amber' | 'rough';

export interface WaveScaleResult {
  bodyRef: WaveBodyRef;
  band: WaveBand;
  /** 0..1 visual height fraction — used only to size the illustrated wave. */
  bodyFraction: number;
  /** Localized headline, e.g. "~0.8 m" or "Estimate". */
  label: string;
  /** Localized supporting detail, e.g. "Wave height" or the estimate phrase. */
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
  // 0.5–0.79 m is a discount in the sea score (measuredWaveScore 7 -> amber dot), so the figure
  // is amber here too — not a reassuring green that would clash with the panel beside it.
  if (m >= 0.5) return { bodyRef: 'knee', band: 'amber', bodyFraction: 0.3 };
  if (m >= 0.3) return { bodyRef: 'ankle', band: 'calm', bodyFraction: 0.14 };
  return { bodyRef: 'flat', band: 'calm', bodyFraction: 0.05 };
};

const ESTIMATE_LABEL: LocalizedCopy<string> = {
  en: 'Estimate', gr: 'Εκτίμηση', fr: 'Estimation', de: 'Schätzung', it: 'Stima',
};
const ESTIMATE_DETAIL: LocalizedCopy<string> = {
  en: 'from the wind', gr: 'από τον άνεμο', fr: 'd’après le vent', de: 'aus dem Wind', it: 'dal vento',
};
const HEIGHT_DETAIL: LocalizedCopy<string> = {
  en: 'Wave height', gr: 'Ύψος κύματος', fr: 'Hauteur de vague', de: 'Wellenhöhe', it: 'Altezza onda',
};
const ARIA_PREFIX: LocalizedCopy<string> = {
  en: 'Waves', gr: 'Κύμα', fr: 'Vagues', de: 'Wellen', it: 'Onde',
};

const formatHeight = (m: number, language: LanguageCode): string => {
  const num = m.toFixed(1);
  return language === 'gr' ? `~${num.replace('.', ',')} μ.` : `~${num} m`;
};

export const getWaveScale = (
  waveHeightM: number | undefined,
  language: LanguageCode,
  opts: { isEstimate?: boolean; estimateHeightM?: number } = {}
): WaveScaleResult => {
  const hasMeasured = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM);
  const isEstimate = opts.isEstimate === true || !hasMeasured;

  if (isEstimate) {
    const label = typeof opts.estimateHeightM === 'number' && Number.isFinite(opts.estimateHeightM)
      ? formatHeight(opts.estimateHeightM, language)
      : getLocalizedCopy(language, ESTIMATE_LABEL);
    const detail = getLocalizedCopy(language, ESTIMATE_DETAIL);
    // Size the estimate figure from the wind-modeled wave so it can't show flat calm during a
    // gale; the component keeps the neutral grey "estimate" styling, so only the HEIGHT scales.
    const est = typeof opts.estimateHeightM === 'number' && Number.isFinite(opts.estimateHeightM)
      ? bucketFor(opts.estimateHeightM)
      : null;
    return {
      bodyRef: est?.bodyRef ?? 'ankle',
      band: est?.band ?? 'calm',
      bodyFraction: est?.bodyFraction ?? 0.14,
      label,
      detail,
      ariaLabel: `${getLocalizedCopy(language, ARIA_PREFIX)}: ${label}, ${detail}`,
      isEstimate: true,
    };
  }

  const bucket = bucketFor(waveHeightM as number);
  const label = formatHeight(waveHeightM as number, language);
  const detail = getLocalizedCopy(language, HEIGHT_DETAIL);
  return {
    bodyRef: bucket.bodyRef,
    band: bucket.band,
    bodyFraction: bucket.bodyFraction,
    label,
    detail,
    ariaLabel: `${getLocalizedCopy(language, ARIA_PREFIX)}: ${detail.toLowerCase()} ${label}`,
    isEstimate: false,
  };
};

/** Band classes for a raw height — used by the hourly strip to colour each bar. */
export const getWaveBandClasses = (waveHeightM: number): WaveBandClasses =>
  WAVE_BAND_CLASSES[bucketFor(waveHeightM).band];

export interface WaveRangeM {
  lowM: number;
  highM: number;
}

/**
 * Honest spread around a significant-wave-height reading. Hs is the mean of the highest third of
 * waves, so a real sea runs from calmer lulls to bigger sets, and fetch/model uncertainty adds to
 * that. We show a MODEST band (not the full 0.6–2× wave spectrum, which would read as alarmist) so
 * the figure reads as "what to expect", not a false single point — the range is information, not a
 * confidence hedge.
 */
export const getWaveRangeM = (waveHeightM: number): WaveRangeM => {
  if (!Number.isFinite(waveHeightM) || waveHeightM <= 0) return { lowM: 0, highM: 0 };
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const low = round1(Math.max(0, waveHeightM * 0.8));
  const high = round1(waveHeightM * 1.25);
  return { lowM: low, highM: Math.max(high, round1(low + 0.1)) };
};

/**
 * True once the sea is big enough that occasional bigger sets (Hmax ≈ 1.5–2× Hs) become a genuine
 * safety factor — this is where the research's "sets are bigger than the stated height" note earns
 * its place. Mirrors the 0.7 m "uncomfortable for ordinary swimmers" swim-safety threshold.
 */
export const hasNotableSets = (waveHeightM: number): boolean =>
  Number.isFinite(waveHeightM) && waveHeightM >= 0.7;

/** Axis top (m) the strip bars are sized against — mirrors the wave meter's base scale. */
const WAVE_BAR_MAX_M = 1.6;

/**
 * 0..1 height for the hourly strip bars. Continuous (linear in metres) rather than bucketed, so
 * neighbouring hours like 0.55 m and 0.79 m read as visibly different bars; clamped so even a flat
 * hour shows a sliver and a big sea fills the bar.
 */
export const waveBarFraction = (waveHeightM: number): number => {
  const m = Number.isFinite(waveHeightM) ? waveHeightM : 0;
  return Math.max(0.08, Math.min(1, m / WAVE_BAR_MAX_M));
};
