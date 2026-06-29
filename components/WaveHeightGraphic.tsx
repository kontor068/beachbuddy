import React from 'react';
import { Ship } from 'lucide-react';
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
  /** Boat-only beach: you board from the boat, so the body-scale "knee/chest" metaphor is
   *  meaningless — show a boat-on-the-sea scene + a transfer caution instead. */
  boatAccess?: boolean;
  /** Wind Beaufort for the selected hour — drives the boat-transfer caution (above 3 Bft). */
  windBeaufort?: number;
  className?: string;
}

type StripCopy = {
  title: string;
  heightNote: string;
  throughDay: string;
  calmerMorning: string;
  calmerLater: string;
  selectedHour: (hour: string) => string;
  hourTooltip: (hour: string, height: string) => string;
  rangeSummary: (min: string, max: string) => string;
};

const COPY: LocalizedCopy<StripCopy> = {
  en: {
    title: 'Wave to expect',
    heightNote: 'Wave height',
    throughDay: 'Through the day',
    calmerMorning: 'calmer in the morning',
    calmerLater: 'calmer later',
    selectedHour: (hour) => `shown hour ${hour}`,
    hourTooltip: (hour, height) => `${hour}: ${height} waves`,
    rangeSummary: (min, max) => `Wave range ${min} to ${max}`,
  },
  gr: {
    title: 'Τι κύμα να περιμένεις',
    heightNote: 'Ύψος κύματος',
    throughDay: 'Μέσα στη μέρα',
    calmerMorning: 'πιο ήρεμα το πρωί',
    calmerLater: 'πιο ήρεμα αργότερα',
    selectedHour: (hour) => `ώρα που βλέπεις ${hour}`,
    hourTooltip: (hour, height) => `${hour}: κύμα ${height}`,
    rangeSummary: (min, max) => `Εύρος κύματος ${min} έως ${max}`,
  },
  fr: {
    title: 'Vagues attendues',
    heightNote: 'Hauteur de vague',
    throughDay: 'Au fil de la journée',
    calmerMorning: 'plus calme le matin',
    calmerLater: 'plus calme plus tard',
    selectedHour: (hour) => `heure affichée ${hour}`,
    hourTooltip: (hour, height) => `${hour} : vagues ${height}`,
    rangeSummary: (min, max) => `Vagues de ${min} à ${max}`,
  },
  de: {
    title: 'Zu erwartende Wellen',
    heightNote: 'Wellenhöhe',
    throughDay: 'Im Tagesverlauf',
    calmerMorning: 'morgens ruhiger',
    calmerLater: 'später ruhiger',
    selectedHour: (hour) => `angezeigte Stunde ${hour}`,
    hourTooltip: (hour, height) => `${hour}: ${height} Wellen`,
    rangeSummary: (min, max) => `Wellenbereich ${min} bis ${max}`,
  },
  it: {
    title: 'Onde previste',
    heightNote: 'Altezza onda',
    throughDay: 'Durante il giorno',
    calmerMorning: 'più calmo al mattino',
    calmerLater: 'più calmo dopo',
    selectedHour: (hour) => `ora mostrata ${hour}`,
    hourTooltip: (hour, height) => `${hour}: onde ${height}`,
    rangeSummary: (min, max) => `Onde da ${min} a ${max}`,
  },
};

// Boat-only beaches: you arrive by boat, so "wave up to your knee/chest" is meaningless. Describe
// the SEA for the boat instead, and warn that small boats rock more (rough from ~Force 4 up).
type BoatCopy = { calm: string; choppy: string; rough: string; heightNote: string; note: string };

const BOAT_COPY: LocalizedCopy<BoatCopy> = {
  en: { calm: 'Calm sea', choppy: 'A bit bumpy', rough: 'Bumpy ride', heightNote: 'Sea for the boat', note: 'Small boats rock more — above 3 Bft, take care boarding and getting back on from the water.' },
  gr: { calm: 'Ήρεμη θάλασσα', choppy: 'Λίγο κουνάει', rough: 'Κουνάει αρκετά', heightNote: 'Θάλασσα για το καραβάκι', note: 'Τα μικρά σκάφη κουνάνε πιο εύκολα — πάνω από 3 μποφόρ πρόσεξε την επιβίβαση και την επιστροφή στο σκάφος μέσα από το νερό.' },
  fr: { calm: 'Mer calme', choppy: 'Un peu agitée', rough: 'Ça secoue', heightNote: 'Mer pour le bateau', note: 'Les petits bateaux bougent plus — au-delà de 3 Bft, attention pour monter et remonter à bord depuis l’eau.' },
  de: { calm: 'Ruhige See', choppy: 'Etwas wackelig', rough: 'Schaukelt stark', heightNote: 'See für das Boot', note: 'Kleine Boote schaukeln stärker — über 3 Bft beim Ein- und Wiedereinsteigen aus dem Wasser aufpassen.' },
  it: { calm: 'Mare calmo', choppy: 'Un po\' mosso', rough: 'Balla parecchio', heightNote: 'Mare per la barca', note: 'Le barche piccole ballano di più — oltre 3 Bft attenzione a salire e risalire a bordo dall’acqua.' },
};

type WaveTrendKey = 'calmerMorning' | 'calmerLater';

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const getSwimmerMotionStyle = (scale: WaveScaleResult): React.CSSProperties => {
  const motion = (() => {
    switch (scale.bodyRef) {
      case 'overhead':
        return { bobPx: 10, tiltDeg: 9, driftPx: 7, durationS: 1.85 };
      case 'chest':
        return { bobPx: 8, tiltDeg: 7, driftPx: 6, durationS: 2.15 };
      case 'waist':
        return { bobPx: 6, tiltDeg: 5, driftPx: 5, durationS: 2.45 };
      case 'knee':
        return { bobPx: 4, tiltDeg: 3, driftPx: 4, durationS: 2.9 };
      case 'ankle':
        return { bobPx: 2.4, tiltDeg: 1.6, driftPx: 3, durationS: 3.4 };
      case 'flat':
      default:
        return { bobPx: 1.4, tiltDeg: 0.8, driftPx: 2, durationS: 4.0 };
    }
  })();

  return {
    '--cb-wave-duration': `${motion.durationS}s`,
    '--cb-swimmer-bob': `${motion.bobPx}px`,
    '--cb-swimmer-tilt': `${motion.tiltDeg}deg`,
    '--cb-wave-drift': `${motion.driftPx}px`,
  } as React.CSSProperties;
};

const formatWaveHeight = (m: number, language: LanguageCode): string => {
  const value = m.toFixed(1);
  return language === 'gr' ? `~${value.replace('.', ',')} μ` : `~${value} m`;
};

// ---------------------------------------------------------------------------------------
// Body-scale swimmer: the crest still reaches the body reference (waist, chest, ...).
// The dashed guide keeps the reading as wave size, not water depth.
const FigureScene: React.FC<{ scale: WaveScaleResult }> = ({ scale }) => {
  const band = scale.isEstimate ? WAVE_ESTIMATE_CLASSES : WAVE_BAND_CLASSES[scale.band];
  const baselineY = 100;
  const headTopY = 18;
  const bodySpan = baselineY - headTopY; // 82
  const crestY = baselineY - scale.bodyFraction * bodySpan;
  const swimmerY = Math.max(30, Math.min(92, crestY + 14));
  const motionStyle = getSwimmerMotionStyle(scale);

  return (
    <svg viewBox="0 0 160 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-auto w-full" style={motionStyle}>
      {/* sand line */}
      <line x1="6" y1={baselineY} x2="156" y2={baselineY} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="2" strokeLinecap="round" />

      {/* wave beside the figure, crest at the body reference */}
      <path
        d={`M48 ${baselineY} L48 ${crestY} C 66 ${crestY - 7} 80 ${crestY + 6} 100 ${crestY} C 120 ${crestY - 6} 138 ${crestY + 5} 156 ${crestY} L156 ${baselineY} Z`}
        className={`cb-wave-surface fill-current ${band.fill}`}
        fillOpacity={scale.isEstimate ? 0.45 : 0.85}
        {...(scale.isEstimate ? { strokeDasharray: '4 3', stroke: 'currentColor', strokeWidth: 1 } : {})}
      />
      {/* foam crest */}
      <path
        d={`M48 ${crestY} C 66 ${crestY - 7} 80 ${crestY + 6} 100 ${crestY} C 120 ${crestY - 6} 138 ${crestY + 5} 156 ${crestY}`}
        fill="none"
        className="cb-wave-foam stroke-white/70 dark:stroke-white/40"
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

      {/* swimmer affected by the wave surface */}
      <g transform={`translate(28 ${swimmerY})`}>
        <g className="cb-wave-swimmer text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="-8" r="5.2" fill="currentColor" stroke="none" />
          <path d="M5 -5 C 15 -8 24 -6 34 -1" strokeWidth="5.5" />
          <path className="cb-wave-swimmer-arm" d="M7 -5 C 15 -18 26 -17 32 -10" strokeWidth="3.5" />
          <path d="M28 0 C 36 2 43 5 50 9" strokeWidth="3.5" opacity="0.74" />
        </g>
      </g>
    </svg>
  );
};

// Boat-only beaches: a small boat on the colour-coded sea (the swell amplitude and the boat's
// tilt grow with roughness), instead of a person wading in from the shore.
const BoatScene: React.FC<{ scale: WaveScaleResult }> = ({ scale }) => {
  const band = scale.isEstimate ? WAVE_ESTIMATE_CLASSES : WAVE_BAND_CLASSES[scale.band];
  const amp = scale.band === 'rough' ? 14 : scale.band === 'amber' ? 8 : 4;
  const tilt = scale.band === 'rough' ? -6 : scale.band === 'amber' ? -3 : 0;
  const wy = 70;
  const crest = `M0 ${wy} Q 16 ${wy - amp} 32 ${wy} T 64 ${wy} T 96 ${wy} T 128 ${wy} T 160 ${wy}`;
  return (
    <svg viewBox="0 0 160 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-auto w-full">
      <path d={`${crest} L160 116 L0 116 Z`} className={`fill-current ${band.fill}`} fillOpacity={scale.isEstimate ? 0.4 : 0.8} />
      <path d={crest} fill="none" className="stroke-white/70 dark:stroke-white/40" strokeWidth="2" strokeLinecap="round" />
      <g className="text-slate-500 dark:text-slate-400" fill="currentColor" transform={`rotate(${tilt} 80 ${wy})`}>
        <path d={`M58 ${wy - 5} L102 ${wy - 5} L95 ${wy + 9} Q80 ${wy + 14} 65 ${wy + 9} Z`} />
        <rect x="71" y={wy - 17} width="18" height="12" rx="2" />
        <rect x="79" y={wy - 27} width="2.5" height="11" rx="1" />
      </g>
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

const HourlyStrip: React.FC<{
  hourly: HourlyWavePoint[];
  nowHour?: number;
  language: LanguageCode;
  copy: StripCopy;
}> = ({ hourly, nowHour, language, copy }) => {
  // Ticks come from the actual series (data is often 3-hourly), so the labels line up with the bars.
  const firstHour = hourly[0].hour;
  const lastHour = hourly[hourly.length - 1].hour;
  const midHour = hourly[Math.floor((hourly.length - 1) / 2)].hour;
  return (
    <>
      <div className="flex h-8 items-end gap-[2px] sm:h-9" aria-hidden="true">
        {hourly.map((p) => {
          const isNow = typeof nowHour === 'number' && p.hour === nowHour;
          return (
            <div
              key={p.hour}
              title={copy.hourTooltip(formatHour(p.hour), formatWaveHeight(p.waveHeightM, language))}
              className={`flex-1 rounded-sm ${getWaveBandClasses(p.waveHeightM).bar} ${isNow ? 'ring-2 ring-slate-900/60 ring-offset-1 ring-offset-white dark:ring-white/75 dark:ring-offset-slate-800' : ''}`}
              style={{ height: `${waveBarFraction(p.waveHeightM) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500">
        <span>{formatHour(firstHour)}</span>
        <span>{formatHour(midHour)}</span>
        <span>{formatHour(lastHour)}</span>
      </div>
    </>
  );
};

const computeTrend = (hourly: HourlyWavePoint[]): WaveTrendKey | null => {
  const morning = hourly.filter((p) => p.hour >= 8 && p.hour <= 12);
  const afternoon = hourly.filter((p) => p.hour >= 15 && p.hour <= 20);
  if (morning.length < 2 || afternoon.length < 2) return null;
  const avg = (arr: HourlyWavePoint[]) => arr.reduce((s, p) => s + p.waveHeightM, 0) / arr.length;
  const m = avg(morning);
  const a = avg(afternoon);
  if (m < a - 0.15) return 'calmerMorning';
  if (a < m - 0.15) return 'calmerLater';
  return null; // steady through the day → show no note (it adds nothing actionable)
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
  boatAccess,
  windBeaufort,
  className,
}) => {
  const scale = getWaveScale(waveHeightM, language, { isEstimate, estimateHeightM });

  if (variant === 'compact') {
    return <CompactGlyph scale={scale} className={className} />;
  }

  const copy = getLocalizedCopy(language, COPY);
  const labelClass = scale.isEstimate ? WAVE_ESTIMATE_CLASSES.label : WAVE_BAND_CLASSES[scale.band].label;
  const isToday = isSelectedDateToday(selectedDate);
  // Mark the hour the forecast is actually showing (the slider hour), falling back to the
  // real wall-clock hour only when no explicit hour is supplied and the day is today.
  const markerHour = typeof selectedHour === 'number' ? selectedHour : (isToday ? new Date().getHours() : undefined);
  const points = (hourly ?? [])
    .filter((p) => Number.isFinite(p.waveHeightM))
    .reduce<HourlyWavePoint[]>((acc, point) => {
      if (!acc.some(existing => existing.hour === point.hour)) acc.push(point);
      return acc;
    }, []);
  if (
    typeof selectedHour === 'number'
    && typeof waveHeightM === 'number'
    && Number.isFinite(waveHeightM)
  ) {
    const selectedPointIndex = points.findIndex(point => point.hour === selectedHour);
    if (selectedPointIndex >= 0) {
      points[selectedPointIndex] = { hour: selectedHour, waveHeightM };
    } else {
      points.push({ hour: selectedHour, waveHeightM });
    }
  }
  points.sort((a, b) => a.hour - b.hour);
  const showStrip = points.length >= 2;
  const trendKey = showStrip ? computeTrend(points) : null;
  const selectedHourLabel = typeof markerHour === 'number'
    ? copy.selectedHour(formatHour(markerHour))
    : null;
  const hourlyRange = showStrip
    ? copy.rangeSummary(
      formatWaveHeight(Math.min(...points.map((p) => p.waveHeightM)), language),
      formatWaveHeight(Math.max(...points.map((p) => p.waveHeightM)), language)
    )
    : null;
  const ariaLabel = [
    scale.ariaLabel,
    copy.heightNote,
    hourlyRange,
    trendKey ? copy[trendKey] : null,
    selectedHourLabel,
  ].filter(Boolean).join('. ');

  const boatCopy = boatAccess ? getLocalizedCopy(language, BOAT_COPY) : null;
  const bandKey: keyof BoatCopy = scale.band === 'rough' ? 'rough' : scale.band === 'amber' ? 'choppy' : 'calm';
  // Boat-only beach: describe the sea for the boat, not a body-scale wading height.
  const headlineLabel = boatCopy ? boatCopy[bandKey] : scale.label;
  const subHeightNote = boatCopy ? boatCopy.heightNote : copy.heightNote;
  // Small boats rock more — flag the transfer above 3 Bft (or a genuinely rough sea).
  const showBoatNote = Boolean(boatCopy) && ((typeof windBeaufort === 'number' && windBeaufort >= 4) || scale.band === 'rough');

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-4 ${className ?? ''}`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-20 shrink-0 sm:w-24">
          {boatAccess ? <BoatScene scale={scale} /> : <FigureScene scale={scale} />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{copy.title}</div>
          <div className={`font-heading text-xl font-bold leading-tight ${labelClass}`}>{headlineLabel}</div>
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{scale.detail}</div>
          <div className="mt-1 text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">{subHeightNote}</div>
        </div>
      </div>

      {showBoatNote && boatCopy && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-amber-800 dark:bg-amber-900/25 dark:text-amber-200">
          <Ship className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{boatCopy.note}</span>
        </div>
      )}

      {showStrip && (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{copy.throughDay}</span>
            {(trendKey || selectedHourLabel) && (
              <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {trendKey ? copy[trendKey] : selectedHourLabel}
              </span>
            )}
          </div>
          <HourlyStrip hourly={points} nowHour={markerHour} language={language} copy={copy} />
        </div>
      )}
    </div>
  );
};
