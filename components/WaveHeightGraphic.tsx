import React from 'react';
import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from '../utils/i18n';
import { isSelectedDateToday } from '../utils/dateLabels';
import {
  getWaveScale,
  getWaveBandClasses,
  waveBarFraction,
  WAVE_BAND_CLASSES,
  WAVE_ESTIMATE_CLASSES,
  type WaveScaleResult,
} from '../utils/waveScale';

export interface HourlyWavePoint {
  hour: number; // 0-23 local
  waveHeightM: number;
}

interface WaveHeightGraphicProps {
  /** Measured per-day wave height (the page/card already-derived value). */
  waveHeightM?: number;
  /** True when there is no measured value — render an honest "estimate" treatment. */
  isEstimate?: boolean;
  /** Swim-hours (08–21) series for the selected day; the intraday strip is hidden if absent. */
  hourly?: HourlyWavePoint[];
  variant: 'full' | 'compact';
  language: LanguageCode;
  /** Used to decide the strip marker (today only, when no explicit selectedHour is given). */
  selectedDate?: Date;
  /** The hour the slider/forecast is showing — marks that bar on the strip (overrides wall-clock). */
  selectedHour?: number;
  /** Wind-modeled wave height (m); sizes the figure when there is no measured value. */
  estimateHeightM?: number;
  className?: string;
}

type StripCopy = {
  title: string;
  throughDay: string;
  calmerMorning: string;
  calmerLater: string;
  steady: string;
};

const COPY: LocalizedCopy<StripCopy> = {
  en: { title: 'Wave to expect', throughDay: 'Through the day', calmerMorning: 'calmer in the morning', calmerLater: 'calmer later', steady: 'steady through the day' },
  gr: { title: 'Τι κύμα να περιμένεις', throughDay: 'Μέσα στη μέρα', calmerMorning: 'πιο ήρεμα το πρωί', calmerLater: 'πιο ήρεμα αργότερα', steady: 'σταθερό μέσα στη μέρα' },
  fr: { title: 'Vagues attendues', throughDay: 'Au fil de la journée', calmerMorning: 'plus calme le matin', calmerLater: 'plus calme plus tard', steady: 'stable dans la journée' },
  de: { title: 'Zu erwartende Wellen', throughDay: 'Im Tagesverlauf', calmerMorning: 'morgens ruhiger', calmerLater: 'später ruhiger', steady: 'gleichbleibend' },
  it: { title: 'Onde previste', throughDay: 'Durante il giorno', calmerMorning: 'più calmo al mattino', calmerLater: 'più calmo dopo', steady: 'stabile in giornata' },
};

// ---------------------------------------------------------------------------------------
// Body-scale figure: a neutral standing person on the shore with a wave beside it whose
// crest reaches the body reference (waist, chest, ...). A dashed guide ties the crest height
// to the figure so the reading is "the wave comes up to about <here>" — wave SIZE, not depth.
const FigureScene: React.FC<{ scale: WaveScaleResult }> = ({ scale }) => {
  const band = scale.isEstimate ? WAVE_ESTIMATE_CLASSES : WAVE_BAND_CLASSES[scale.band];
  const baselineY = 100;
  const headTopY = 18;
  const bodySpan = baselineY - headTopY; // 82
  const crestY = baselineY - scale.bodyFraction * bodySpan;

  return (
    <svg viewBox="0 0 160 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-auto w-full">
      {/* sand line */}
      <line x1="6" y1={baselineY} x2="156" y2={baselineY} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="2" strokeLinecap="round" />

      {/* neutral figure on the shore */}
      <g className="text-slate-400 dark:text-slate-500" fill="currentColor">
        <circle cx="30" cy="26" r="8" />
        <rect x="23" y="35" width="14" height="35" rx="6" />
        <rect x="25" y="68" width="4.5" height="32" rx="2.25" />
        <rect x="30.5" y="68" width="4.5" height="32" rx="2.25" />
      </g>

      {/* wave beside the figure, crest at the body reference */}
      <path
        d={`M48 ${baselineY} L48 ${crestY} C 66 ${crestY - 7} 80 ${crestY + 6} 100 ${crestY} C 120 ${crestY - 6} 138 ${crestY + 5} 156 ${crestY} L156 ${baselineY} Z`}
        className={`fill-current ${band.fill}`}
        fillOpacity={scale.isEstimate ? 0.45 : 0.85}
        {...(scale.isEstimate ? { strokeDasharray: '4 3', stroke: 'currentColor', strokeWidth: 1 } : {})}
      />
      {/* foam crest */}
      <path
        d={`M48 ${crestY} C 66 ${crestY - 7} 80 ${crestY + 6} 100 ${crestY} C 120 ${crestY - 6} 138 ${crestY + 5} 156 ${crestY}`}
        fill="none"
        className="stroke-white/70 dark:stroke-white/40"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* dashed guide from the figure to the crest height */}
      <line
        x1="18"
        y1={crestY}
        x2="156"
        y2={crestY}
        className={`stroke-current ${band.fill}`}
        strokeWidth="1.25"
        strokeDasharray="3 3"
        opacity={0.45}
      />
    </svg>
  );
};

// Tiny card glyph: a single band-coloured wavelet whose height encodes the band.
const CompactGlyph: React.FC<{ scale: WaveScaleResult; className?: string }> = ({ scale, className }) => {
  const band = scale.isEstimate ? WAVE_ESTIMATE_CLASSES : WAVE_BAND_CLASSES[scale.band];
  const h = Math.max(4, Math.min(14, scale.bodyFraction * 14));
  const top = 18 - h;
  return (
    <svg viewBox="0 0 28 20" className={className ?? 'h-3.5 w-4 shrink-0'} aria-hidden="true">
      <path
        d={`M2 18 L2 ${top} C 8 ${top - 2} 11 ${top + 2} 14 ${top} C 18 ${top - 2} 22 ${top + 1} 26 ${top} L26 18 Z`}
        className={`fill-current ${band.fill}`}
        fillOpacity={scale.isEstimate ? 0.5 : 0.9}
      />
    </svg>
  );
};

const HourlyStrip: React.FC<{ hourly: HourlyWavePoint[]; nowHour?: number }> = ({ hourly, nowHour }) => {
  // Ticks come from the actual series (data is often 3-hourly), so the labels line up with the bars.
  const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const firstHour = hourly[0].hour;
  const lastHour = hourly[hourly.length - 1].hour;
  const midHour = hourly[Math.floor((hourly.length - 1) / 2)].hour;
  return (
    <>
      <div className="flex h-9 items-end gap-[2px]">
        {hourly.map((p) => {
          const isNow = typeof nowHour === 'number' && p.hour === nowHour;
          return (
            <div
              key={p.hour}
              className={`flex-1 rounded-sm ${getWaveBandClasses(p.waveHeightM).bar} ${isNow ? 'ring-2 ring-slate-900/55 dark:ring-white/70' : ''}`}
              style={{ height: `${waveBarFraction(p.waveHeightM) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500">
        <span>{fmtHour(firstHour)}</span>
        <span>{fmtHour(midHour)}</span>
        <span>{fmtHour(lastHour)}</span>
      </div>
    </>
  );
};

const computeTrend = (hourly: HourlyWavePoint[]): keyof StripCopy | null => {
  const morning = hourly.filter((p) => p.hour >= 8 && p.hour <= 12);
  const afternoon = hourly.filter((p) => p.hour >= 15 && p.hour <= 20);
  if (morning.length < 2 || afternoon.length < 2) return null;
  const avg = (arr: HourlyWavePoint[]) => arr.reduce((s, p) => s + p.waveHeightM, 0) / arr.length;
  const m = avg(morning);
  const a = avg(afternoon);
  if (m < a - 0.15) return 'calmerMorning';
  if (a < m - 0.15) return 'calmerLater';
  return 'steady';
};

export const WaveHeightGraphic: React.FC<WaveHeightGraphicProps> = ({
  waveHeightM,
  isEstimate,
  hourly,
  variant,
  language,
  selectedDate,
  selectedHour,
  estimateHeightM,
  className,
}) => {
  const scale = getWaveScale(waveHeightM, language, { isEstimate, estimateHeightM });

  if (variant === 'compact') {
    return <CompactGlyph scale={scale} className={className} />;
  }

  const copy = getLocalizedCopy(language, COPY);
  const labelClass = scale.isEstimate ? WAVE_ESTIMATE_CLASSES.label : WAVE_BAND_CLASSES[scale.band].label;
  const points = (hourly ?? []).filter((p) => Number.isFinite(p.waveHeightM)).sort((a, b) => a.hour - b.hour);
  const showStrip = points.length >= 2;
  const isToday = isSelectedDateToday(selectedDate);
  // Mark the hour the forecast is actually showing (the slider hour), falling back to the
  // real wall-clock hour only when no explicit hour is supplied and the day is today.
  const markerHour = typeof selectedHour === 'number' ? selectedHour : (isToday ? new Date().getHours() : undefined);
  const trendKey = showStrip ? computeTrend(points) : null;

  return (
    <div
      role="img"
      aria-label={scale.ariaLabel}
      className={`rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className ?? ''}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-24 shrink-0">
          <FigureScene scale={scale} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{copy.title}</div>
          <div className={`font-heading text-xl font-bold leading-tight ${labelClass}`}>{scale.label}</div>
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{scale.detail}</div>
        </div>
      </div>

      {showStrip && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{copy.throughDay}</span>
            {trendKey && <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{copy[trendKey]}</span>}
          </div>
          <HourlyStrip hourly={points} nowHour={markerHour} />
        </div>
      )}
    </div>
  );
};
