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
  /** Wind-modeled wave height (m); sizes the meter when there is no measured value. */
  estimateHeightM?: number;
  /** Boat-only beach: show a boat-on-the-sea meter scene plus a transfer caution. */
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

// Boat-only beaches: describe the SEA for the boat and warn that small boats rock more.
// The visual uses the same metre scale, not a body-height metaphor.
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

type SwimFeelCopy = {
  label: string;
  calm: string;
  amber: string;
  rough: string;
  estimate: string;
};

const SWIM_FEEL_COPY: LocalizedCopy<SwimFeelCopy> = {
  en: {
    label: 'Swimming feel',
    calm: 'Low waves',
    amber: 'Some chop',
    rough: 'Rougher sea',
    estimate: 'Wind-based estimate',
  },
  gr: {
    label: 'Αίσθηση στο μπάνιο',
    calm: 'Χαμηλό κύμα',
    amber: 'Λίγος κυματισμός',
    rough: 'Πιο έντονο κύμα',
    estimate: 'Εκτίμηση από άνεμο',
  },
  fr: {
    label: 'Pour la baignade',
    calm: 'Vagues faibles',
    amber: 'Un peu de clapot',
    rough: 'Mer plus agitée',
    estimate: 'Estimation par le vent',
  },
  de: {
    label: 'Badegefühl',
    calm: 'Niedrige Wellen',
    amber: 'Etwas Kabbelwasser',
    rough: 'Unruhigere See',
    estimate: 'Windbasierte Schätzung',
  },
  it: {
    label: 'Sensazione in acqua',
    calm: 'Onde basse',
    amber: 'Un po’ mosso',
    rough: 'Mare più mosso',
    estimate: 'Stima dal vento',
  },
};

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
  return language === 'gr' ? `~${value.replace('.', ',')} μ.` : `~${value} m`;
};

const getBlueWaterFillClass = (scale: WaveScaleResult): string => {
  if (scale.isEstimate) return 'text-sky-300 dark:text-sky-500';
  if (scale.band === 'rough') return 'text-sky-600 dark:text-sky-400';
  if (scale.band === 'amber') return 'text-cyan-500 dark:text-cyan-400';
  return 'text-teal-500 dark:text-teal-400';
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const waveAmplitudeFor = (scale: WaveScaleResult): number => {
  switch (scale.bodyRef) {
    case 'overhead':
      return 12;
    case 'chest':
      return 10;
    case 'waist':
      return 8;
    case 'knee':
      return 5.5;
    case 'ankle':
      return 3.5;
    case 'flat':
    default:
      return 2;
  }
};

const METER_BASE_MAX_M = 1.6; // axis top for typical seas — keeps the tuned, well-spaced look
const METER_HARD_MAX_M = 3.0; // never plot beyond this, however wild the value
const METER_TICK_STEP = 0.5;

// Axis top for a given wave height: the tuned 1.6 m for typical seas, stepping up in 0.5 m
// increments for rough days so a 2.5 m sea never silently pegs at the same level as 1.6 m.
const axisMaxForHeight = (m: number): number =>
  m <= METER_BASE_MAX_M
    ? METER_BASE_MAX_M
    : Math.min(METER_HARD_MAX_M, Math.ceil(m / METER_TICK_STEP) * METER_TICK_STEP);

const axisTicks = (axisMaxM: number): number[] => {
  const ticks: number[] = [];
  for (let m = Math.floor(axisMaxM / METER_TICK_STEP) * METER_TICK_STEP; m > 0.0001; m -= METER_TICK_STEP) {
    ticks.push(Number(m.toFixed(1)));
  }
  ticks.push(0);
  return ticks;
};

const getVisualWaveHeightM = (
  scale: WaveScaleResult,
  waveHeightM?: number,
  estimateHeightM?: number
): number => {
  const source = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? waveHeightM
    : estimateHeightM;

  if (typeof source === 'number' && Number.isFinite(source)) {
    return clamp(source, 0, METER_HARD_MAX_M);
  }

  return clamp(scale.bodyFraction * METER_BASE_MAX_M, 0, METER_BASE_MAX_M);
};

// ---------------------------------------------------------------------------------------
const getWaveSceneStyle = (scale: WaveScaleResult): React.CSSProperties => {
  const palette = scale.isEstimate
    ? {
        crest: '#bae6fd',
        mid: '#7dd3fc',
        deep: '#0284c7',
        sky: '#f0f9ff',
        sand: '#e2e8f0',
        swimmer: '#475569',
        foam: 'rgba(255,255,255,0.72)',
        guide: 'rgba(71,85,105,0.32)',
      }
    : scale.band === 'rough'
      ? {
          crest: '#38bdf8',
          mid: '#0ea5e9',
          deep: '#0369a1',
          sky: '#e0f2fe',
          sand: '#fde68a',
          swimmer: '#475569',
          foam: 'rgba(255,255,255,0.84)',
          guide: 'rgba(71,85,105,0.28)',
        }
      : scale.band === 'amber'
        ? {
            crest: '#67e8f9',
            mid: '#22d3ee',
            deep: '#0284c7',
            sky: '#ecfeff',
            sand: '#fde68a',
            swimmer: '#475569',
            foam: 'rgba(255,255,255,0.8)',
            guide: 'rgba(71,85,105,0.26)',
          }
        : {
            crest: '#2dd4bf',
            mid: '#14b8a6',
            deep: '#0891b2',
            sky: '#ecfeff',
            sand: '#fde68a',
            swimmer: '#475569',
            foam: 'rgba(255,255,255,0.78)',
            guide: 'rgba(71,85,105,0.24)',
          };

  return {
    '--cb-wave-crest': palette.crest,
    '--cb-wave-mid': palette.mid,
    '--cb-wave-deep': palette.deep,
    '--cb-wave-sky': palette.sky,
    '--cb-wave-sand': palette.sand,
    '--cb-wave-swimmer-color': palette.swimmer,
    '--cb-wave-foam-color': palette.foam,
    '--cb-wave-guide-color': palette.guide,
  } as React.CSSProperties;
};

// Scientific-first wave meter: the scale is metres, while the swimmer is only a small context cue.
const WaveMeterScene: React.FC<{ scale: WaveScaleResult; visualHeightM: number }> = ({ scale, visualHeightM }) => {
  const plotTopY = 18;
  const plotBottomY = 98;
  const plotLeftX = 42;
  const plotRightX = 166;
  const plotHeight = plotBottomY - plotTopY;
  const axisMaxM = axisMaxForHeight(visualHeightM);
  const waterlineY = plotBottomY - (clamp(visualHeightM, 0, axisMaxM) / axisMaxM) * plotHeight;
  const amplitude = waveAmplitudeFor(scale) * 0.58;
  const sceneId = React.useId().replace(/:/g, '');
  const skyGradientId = `wave-sky-${sceneId}`;
  const depthGradientId = `wave-depth-${sceneId}`;
  const sceneStyle = {
    ...getWaveSceneStyle(scale),
    ...getSwimmerMotionStyle(scale),
  } as React.CSSProperties;
  const tickValues = axisTicks(axisMaxM);
  const tickY = (m: number) => plotBottomY - (m / axisMaxM) * plotHeight;
  const swimmerY = clamp(waterlineY, 30, 90);
  const waterPath = `M${plotLeftX} ${plotBottomY + 10} L${plotLeftX} ${waterlineY + 8} C 61 ${waterlineY - amplitude} 78 ${waterlineY + amplitude * 0.55} 96 ${waterlineY - amplitude * 0.18} C 119 ${waterlineY - amplitude * 0.88} 139 ${waterlineY + amplitude * 0.65} ${plotRightX} ${waterlineY - amplitude * 0.12} L${plotRightX} ${plotBottomY + 10} Z`;
  const crestPath = `M${plotLeftX} ${waterlineY + 8} C 61 ${waterlineY - amplitude} 78 ${waterlineY + amplitude * 0.55} 96 ${waterlineY - amplitude * 0.18} C 119 ${waterlineY - amplitude * 0.88} 139 ${waterlineY + amplitude * 0.65} ${plotRightX} ${waterlineY - amplitude * 0.12}`;
  const backwashPath = `M${plotLeftX - 2} ${clamp(waterlineY + 20, 35, 108)} C 66 ${waterlineY + 10} 83 ${waterlineY + 22} 106 ${waterlineY + 14} C 128 ${waterlineY + 7} 143 ${waterlineY + 20} ${plotRightX + 2} ${waterlineY + 12} L${plotRightX + 2} ${plotBottomY + 13} L${plotLeftX - 2} ${plotBottomY + 13} Z`;

  return (
    <svg viewBox="0 0 176 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-auto w-full drop-shadow-sm" style={sceneStyle}>
      <defs>
        <linearGradient id={skyGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cb-wave-sky)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={depthGradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--cb-wave-crest)" stopOpacity="0.78" />
          <stop offset="54%" stopColor="var(--cb-wave-mid)" stopOpacity="0.96" />
          <stop offset="100%" stopColor="var(--cb-wave-deep)" stopOpacity="0.96" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="172" height="112" rx="20" fill={`url(#${skyGradientId})`} />
      <path
        d="M8 100 C 34 95 55 96 78 101 C 105 107 132 106 168 99 L168 116 L8 116 Z"
        fill="var(--cb-wave-sand)"
        opacity="0.28"
      />

      <g aria-hidden="true">
        {tickValues.map((tick) => (
          <g key={tick}>
            <path
              d={`M${plotLeftX - 4} ${tickY(tick)} H${plotRightX}`}
              stroke="var(--cb-wave-guide-color)"
              strokeWidth={Math.abs(tick - visualHeightM) < 0.08 ? 1.6 : 1}
              strokeDasharray={tick === 0 ? undefined : '3 4'}
              opacity={tick === 0 ? 0.72 : 0.48}
            />
            <text
              x={plotLeftX - 8}
              y={tickY(tick) + 3}
              textAnchor="end"
              fontSize="8"
              fontWeight="700"
              fill="var(--cb-wave-guide-color)"
            >
              {tick === 0 ? '0m' : tick.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={`M${plotLeftX} ${plotTopY} V${plotBottomY}`} stroke="var(--cb-wave-guide-color)" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx={plotLeftX} cy={waterlineY} r="3" fill="var(--cb-wave-deep)" stroke="white" strokeWidth="1.4" />
      </g>

      <path
        className="cb-wave-backwash"
        d={backwashPath}
        fill="var(--cb-wave-mid)"
        opacity={scale.isEstimate ? 0.16 : 0.2}
      />

      <path
        d={waterPath}
        className="cb-wave-surface"
        fill={`url(#${depthGradientId})`}
        fillOpacity={scale.isEstimate ? 0.52 : 0.92}
        {...(scale.isEstimate ? { strokeDasharray: '4 3', stroke: 'var(--cb-wave-deep)', strokeWidth: 1 } : {})}
      />

      <path
        className="cb-wave-highlight"
        d={`M29 ${waterlineY + 19} C 52 ${waterlineY + 11} 74 ${waterlineY + 20} 98 ${waterlineY + 12} C 119 ${waterlineY + 6} 141 ${waterlineY + 13} 160 ${waterlineY + 8}`}
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="4.6"
        strokeLinecap="round"
      />

      <path
        d={crestPath}
        fill="none"
        className="cb-wave-foam"
        stroke="var(--cb-wave-foam-color)"
        strokeWidth={scale.band === 'rough' ? 3.6 : 3}
        strokeLinecap="round"
      />

      <g className="cb-wave-spray" fill="var(--cb-wave-foam-color)" opacity="0.82">
        <circle cx="71" cy={waterlineY + 1} r={scale.band === 'rough' ? 1.7 : 1.1} />
        <circle cx="82" cy={waterlineY + 5} r="1" />
        <circle cx="126" cy={waterlineY} r={scale.band === 'rough' ? 1.5 : 1} />
      </g>

      {/* Small human cue that rides the surface, so its waterline tracks the metre reading. */}
      <g transform={`translate(112 ${swimmerY}) scale(0.46)`} opacity="0.7">
        <g className="cb-wave-swimmer" fill="none" stroke="var(--cb-wave-swimmer-color)" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="0" cy="-8" r="5.4" fill="var(--cb-wave-swimmer-color)" stroke="none" />
          <path d="M5 -5 C 18 -11 31 -6 45 0" strokeWidth="5.6" />
          <path d="M10 -5 C 19 -18 33 -17 41 -9" strokeWidth="3.5" />
        </g>
      </g>
    </svg>
  );
};

// Boat-only beaches: a small boat on blue sea (the swell amplitude and the boat's
// tilt grow with roughness), instead of a person wading in from the shore.
const BoatScene: React.FC<{ scale: WaveScaleResult }> = ({ scale }) => {
  const amp = scale.band === 'rough' ? 14 : scale.band === 'amber' ? 8 : 4;
  const tilt = scale.band === 'rough' ? -6 : scale.band === 'amber' ? -3 : 0;
  const wy = scale.band === 'rough' ? 66 : scale.band === 'amber' ? 71 : 77;
  const crest = `M0 ${wy} Q 16 ${wy - amp} 32 ${wy} T 64 ${wy} T 96 ${wy} T 128 ${wy} T 160 ${wy}`;
  const sceneId = React.useId().replace(/:/g, '');
  const waterGradientId = `boat-wave-${sceneId}`;
  const skyGradientId = `boat-sky-${sceneId}`;
  const sceneStyle = {
    ...getWaveSceneStyle(scale),
    ...getSwimmerMotionStyle(scale),
  } as React.CSSProperties;

  return (
    <svg viewBox="0 0 160 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-auto w-full drop-shadow-sm" style={sceneStyle}>
      <defs>
        <linearGradient id={skyGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cb-wave-sky)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={waterGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cb-wave-crest)" />
          <stop offset="58%" stopColor="var(--cb-wave-mid)" />
          <stop offset="100%" stopColor="var(--cb-wave-deep)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="156" height="112" rx="20" fill={`url(#${skyGradientId})`} />
      <path d="M8 60 C 38 56 76 57 110 61 C 132 63 146 63 152 61" fill="none" stroke="rgba(14,165,233,0.16)" strokeWidth="1.2" strokeLinecap="round" />
      <path
        className="cb-wave-backwash"
        d={`M0 ${wy + 14} Q 16 ${wy + 5} 32 ${wy + 14} T 64 ${wy + 14} T 96 ${wy + 14} T 128 ${wy + 14} T 160 ${wy + 14} L160 116 L0 116 Z`}
        fill="var(--cb-wave-mid)"
        opacity={scale.isEstimate ? 0.16 : 0.22}
      />
      <path
        d={`${crest} L160 116 L0 116 Z`}
        className={`cb-wave-surface fill-current ${getBlueWaterFillClass(scale)}`}
        fill={`url(#${waterGradientId})`}
        fillOpacity={scale.isEstimate ? 0.5 : 0.88}
        {...(scale.isEstimate ? { strokeDasharray: '4 3', stroke: 'var(--cb-wave-deep)', strokeWidth: 1 } : {})}
      />
      <path d={crest} fill="none" className="cb-wave-foam" stroke="var(--cb-wave-foam-color)" strokeWidth={scale.band === 'rough' ? 3.2 : 2.4} strokeLinecap="round" />
      <path
        d={`M15 ${wy + 18} C 42 ${wy + 9} 68 ${wy + 18} 95 ${wy + 10} C 116 ${wy + 5} 134 ${wy + 11} 151 ${wy + 7}`}
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="4.2"
        strokeLinecap="round"
        className="cb-wave-highlight"
      />
      <g className="text-slate-500 dark:text-slate-400" fill="currentColor" transform={`rotate(${tilt} 80 ${wy})`}>
        <g className="cb-wave-boat">
          <path d={`M56 ${wy - 5} L105 ${wy - 5} L98 ${wy + 10} Q80 ${wy + 16} 62 ${wy + 10} Z`} />
          <rect x="70" y={wy - 19} width="20" height="13" rx="2.5" />
          <rect x="79" y={wy - 31} width="2.6" height="12" rx="1" />
          <path d={`M88 ${wy - 28} L100 ${wy - 21} L88 ${wy - 21} Z`} fill="rgba(255,255,255,0.76)" />
        </g>
      </g>
    </svg>
  );
};

// Tiny card glyph: a blue wavelet whose height encodes the band.
const CompactGlyph: React.FC<{ scale: WaveScaleResult; className?: string }> = ({ scale, className }) => {
  const h = Math.max(4, Math.min(14, scale.bodyFraction * 14));
  const top = 18 - h;
  return (
    <svg viewBox="0 0 28 20" className={className ?? 'h-3.5 w-4 shrink-0'} aria-hidden="true">
      <path
        d={`M2 18 L2 ${top} C 8 ${top - 2} 11 ${top + 2} 14 ${top} C 18 ${top - 2} 22 ${top + 1} 26 ${top} L26 18 Z`}
        className={`fill-current ${getBlueWaterFillClass(scale)}`}
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
  return (
    <div className="flex items-end gap-[2px]" aria-hidden="true">
      {hourly.map((p) => {
        const isNow = typeof nowHour === 'number' && p.hour === nowHour;
        return (
          <div key={p.hour} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-8 w-full items-end sm:h-9">
              <div
                title={copy.hourTooltip(formatHour(p.hour), formatWaveHeight(p.waveHeightM, language))}
                className={`w-full rounded-sm ${getWaveBandClasses(p.waveHeightM).bar} ${isNow ? 'ring-2 ring-slate-900/60 ring-offset-1 ring-offset-white dark:ring-white/75 dark:ring-offset-slate-800' : ''}`}
                style={{ height: `${waveBarFraction(p.waveHeightM) * 100}%` }}
              />
            </div>
            {/* Every hour gets its own tiny label so they all fit; the shown/now hour is emphasised. */}
            <span className={`mt-0.5 text-[8px] leading-none font-semibold tabular-nums ${isNow ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
              {String(p.hour).padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
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
  const swimFeelCopy = getLocalizedCopy(language, SWIM_FEEL_COPY);
  const labelClass = scale.isEstimate ? WAVE_ESTIMATE_CLASSES.label : WAVE_BAND_CLASSES[scale.band].label;
  const panelClass = scale.isEstimate ? WAVE_ESTIMATE_CLASSES.soft : WAVE_BAND_CLASSES[scale.band].soft;
  const visualWaveHeightM = getVisualWaveHeightM(scale, waveHeightM, estimateHeightM);
  const isToday = isSelectedDateToday(selectedDate);
  // Mark the hour the forecast is actually showing (the slider hour), falling back to the
  // real wall-clock hour only when no explicit hour is supplied and the day is today.
  const markerHour = typeof selectedHour === 'number' ? selectedHour : (isToday ? new Date().getHours() : undefined);
  // Each bar already carries its hour's own effective wave height (same rule as the headline),
  // so the selected hour needs no special-casing — it is just highlighted via markerHour.
  const points = (hourly ?? [])
    .filter((p) => Number.isFinite(p.waveHeightM))
    .reduce<HourlyWavePoint[]>((acc, point) => {
      if (!acc.some(existing => existing.hour === point.hour)) acc.push(point);
      return acc;
    }, [])
    .sort((a, b) => a.hour - b.hour);
  const showStrip = points.length >= 2;
  const trendKey = showStrip ? computeTrend(points) : null;
  const hourlyRange = showStrip
    ? copy.rangeSummary(
      formatWaveHeight(Math.min(...points.map((p) => p.waveHeightM)), language),
      formatWaveHeight(Math.max(...points.map((p) => p.waveHeightM)), language)
    )
    : null;
  const ariaLabel = [
    scale.ariaLabel,
    hourlyRange,
    trendKey ? copy[trendKey] : null,
  ]
    .filter(Boolean)
    .map((part) => String(part).replace(/\.+$/, ''))
    .join('. ');

  const boatCopy = boatAccess ? getLocalizedCopy(language, BOAT_COPY) : null;
  const bandKey: keyof BoatCopy = scale.band === 'rough' ? 'rough' : scale.band === 'amber' ? 'choppy' : 'calm';
  // Boat-only beach: describe the sea for the boat, not swimming comfort.
  const headlineLabel = boatCopy ? boatCopy[bandKey] : scale.label;
  const supportingDetail = boatCopy ? scale.label : scale.detail;
  const subHeightNote = boatCopy ? boatCopy.heightNote : null;
  const swimmingFeel = scale.isEstimate ? swimFeelCopy.estimate : swimFeelCopy[scale.band];
  // Small boats rock more — flag the transfer above 3 Bft (or a genuinely rough sea).
  const showBoatNote = Boolean(boatCopy) && ((typeof windBeaufort === 'number' && windBeaufort >= 4) || scale.band === 'rough');

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-2xl border border-cyan-100/70 bg-white/92 p-3.5 shadow-sm shadow-sky-900/5 ring-1 ring-white/60 dark:border-slate-700 dark:bg-slate-800 sm:p-4 ${className ?? ''}`}
    >
      <div className="flex items-center gap-3.5 sm:gap-4">
        <div className={`w-[108px] shrink-0 rounded-2xl p-1 ring-1 ring-white/70 sm:w-32 ${panelClass}`}>
          {boatAccess ? <BoatScene scale={scale} /> : <WaveMeterScene scale={scale} visualHeightM={visualWaveHeightM} />}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="text-[11px] font-bold leading-tight text-slate-500 dark:text-slate-400">{copy.title}</div>
          <div className={`mt-1 font-heading text-[1.35rem] font-bold leading-none sm:text-2xl ${labelClass}`}>{headlineLabel}</div>
          <div className="mt-1 text-sm font-semibold leading-snug text-slate-600 dark:text-slate-300">{supportingDetail}</div>
          {!boatCopy && (
            <div className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border border-slate-100 bg-white/70 px-2.5 py-1 text-[11px] font-bold leading-tight text-slate-500 shadow-sm shadow-sky-900/5 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
              <span>{swimFeelCopy.label}</span>
              <span className={labelClass}>{swimmingFeel}</span>
            </div>
          )}
          {subHeightNote && (
            <div className="mt-1 text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">{subHeightNote}</div>
          )}
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
          {trendKey && (
            <div className="mb-1 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {copy[trendKey]}
            </div>
          )}
          <HourlyStrip hourly={points} nowHour={markerHour} language={language} copy={copy} />
        </div>
      )}
    </div>
  );
};
