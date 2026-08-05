import React from 'react';
import { Ship, Waves } from 'lucide-react';
import { LanguageCode, WindSuitabilityColor } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from '../utils/i18n';
import { isSelectedDateToday } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';
import { getBoatRideMotionLevel, getBoatRideMotionRank, type BoatRideMotionLevel } from '../utils/boatRideMotion';
import type { ExposureLevel } from '../utils/windExposure';
import { getSeaSeverity, getSeaStateSeverity, getWindSeverity, type SeaSeverity } from '../utils/seaVerdict';
import { seaStateSeverityM } from '../utils/waveCharacter';
import {
  getWaveScale,
  getWaveBandClasses,
  waveBarFraction,
  getWaveRangeM,
  hasNotableSets,
  ESTIMATE_LABEL,
  WAVE_BAND_CLASSES,
  WAVE_ESTIMATE_CLASSES,
  type WaveBand,
  type WaveScaleResult,
} from '../utils/waveScale';
import { WIND_SUITABILITY_TONE_CLASSES } from '../utils/suitabilityTone';

export interface HourlyWavePoint {
  hour: number; // 0-23 local
  waveHeightM: number;
}

interface WaveHeightGraphicProps {
  /** Measured per-day wave height (the page/card already-derived value). */
  waveHeightM?: number;
  /** Total-sea period (s). Lets a short-period chop escalate on the same swell-equivalent
   *  scale the badge and the map pin use, instead of this card judging raw metres alone. */
  wavePeriodS?: number;
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
  /** Live exposure for the selected wind/hour; keeps swimmer feel from being wave-height only. */
  exposureLevel?: ExposureLevel;
  /** True only when the current profile can honestly claim wind protection. */
  canClaimWindProtection?: boolean;
  /** Keeps the compact card glyph aligned with the same tone used by the map marker. */
  suitabilityColor?: WindSuitabilityColor;
  className?: string;
}

type StripCopy = {
  title: string;
  heightNote: string;
  throughDay: string;
  calmerMorning: string;
  calmerLater: string;
  /** Prefix for the significant-wave-height uncertainty band, e.g. "Likely range". */
  bandLabel: string;
  /** One-line "bigger sets" note keyed to the Hmax ≈ 1.5–2× Hs spread. */
  setsNote: string;
  selectedHour: (hour: string) => string;
  hourTooltip: (hour: string, height: string) => string;
  rangeSummary: (min: string, max: string) => string;
  referenceLabel: (percent: string) => string;
  depthNote: string;
};

const COPY: LocalizedCopy<StripCopy> = {
  en: {
    title: 'Wave to expect',
    heightNote: 'Wave height',
    throughDay: 'Through the day',
    calmerMorning: 'calmer in the morning',
    calmerLater: 'calmer later',
    bandLabel: 'Likely range',
    setsNote: 'Bigger sets at times — some waves run ~1.5× higher',
    selectedHour: (hour) => `shown hour ${hour}`,
    hourTooltip: (hour, height) => `${hour}: ${height} waves`,
    rangeSummary: (min, max) => `Wave range ${min} to ${max}`,
    referenceLabel: (percent) => `About ${percent}% of a 1.7 m adult reference height`,
    depthNote: 'forecast span, not water depth',
  },
  gr: {
    title: 'Τι κύμα να περιμένεις',
    heightNote: 'Ύψος κύματος',
    throughDay: 'Μέσα στη μέρα',
    calmerMorning: 'πιο ήρεμα το πρωί',
    calmerLater: 'πιο ήρεμα αργότερα',
    bandLabel: 'Πιθανό εύρος',
    setsNote: 'Κατά διαστήματα πιο ψηλά σετ — κάποια κύματα ~1,5× πιο ψηλά',
    selectedHour: (hour) => `ώρα που βλέπεις ${hour}`,
    hourTooltip: (hour, height) => `${hour}: κύμα ${height}`,
    rangeSummary: (min, max) => `Εύρος κύματος ${min} έως ${max}`,
    referenceLabel: (percent) => `Περίπου ${percent}% του ύψους ενήλικα 1,7 μ.`,
    depthNote: 'εύρος πρόγνωσης, όχι βάθος νερού',
  },
  fr: {
    title: 'Vagues attendues',
    heightNote: 'Hauteur de vague',
    throughDay: 'Au fil de la journée',
    calmerMorning: 'plus calme le matin',
    calmerLater: 'plus calme plus tard',
    bandLabel: 'Plage probable',
    setsNote: 'Séries plus grandes par moments — certaines vagues ~1,5× plus hautes',
    selectedHour: (hour) => `heure affichée ${hour}`,
    hourTooltip: (hour, height) => `${hour} : vagues ${height}`,
    rangeSummary: (min, max) => `Vagues de ${min} à ${max}`,
    referenceLabel: (percent) => `Environ ${percent}% d'une référence adulte de 1,7 m`,
    depthNote: 'plage prévue, pas profondeur d’eau',
  },
  de: {
    title: 'Zu erwartende Wellen',
    heightNote: 'Wellenhöhe',
    throughDay: 'Im Tagesverlauf',
    calmerMorning: 'morgens ruhiger',
    calmerLater: 'später ruhiger',
    bandLabel: 'Wahrscheinlicher Bereich',
    setsNote: 'Zeitweise größere Sätze — einzelne Wellen ~1,5× höher',
    selectedHour: (hour) => `angezeigte Stunde ${hour}`,
    hourTooltip: (hour, height) => `${hour}: ${height} Wellen`,
    rangeSummary: (min, max) => `Wellenbereich ${min} bis ${max}`,
    referenceLabel: (percent) => `Etwa ${percent}% einer 1,7-m-Erwachsenenreferenz`,
    depthNote: 'Prognosespanne, keine Wassertiefe',
  },
  it: {
    title: 'Onde previste',
    heightNote: 'Altezza onda',
    throughDay: 'Durante il giorno',
    calmerMorning: 'più calmo al mattino',
    calmerLater: 'più calmo dopo',
    bandLabel: 'Intervallo probabile',
    setsNote: 'A tratti serie più grandi — alcune onde ~1,5× più alte',
    selectedHour: (hour) => `ora mostrata ${hour}`,
    hourTooltip: (hour, height) => `${hour}: onde ${height}`,
    rangeSummary: (min, max) => `Onde da ${min} a ${max}`,
    referenceLabel: (percent) => `Circa ${percent}% dell'altezza adulta di riferimento (1,7 m)`,
    depthNote: 'intervallo previsto, non profondità dell’acqua',
  },
};

// Boat-only beaches: describe ride motion, not swimmer comfort.
// The visual uses the same metre scale, not a body-height metaphor.
type BoatCopy = {
  title: string;
  smooth: string;
  light: string;
  bumpy: string;
  rough: string;
  heightDetail: (height: string) => string;
  estimateDetail: string;
  selectedHour: (hour: string) => string;
  hourTooltip: (hour: string, level: BoatRideMotionLevel, height: string) => string;
  rangeSummary: (min: string, max: string) => string;
  calmerMorning: string;
  calmerLater: string;
  note: string;
};

const BOAT_COPY: LocalizedCopy<BoatCopy> = {
  en: {
    title: 'Boat conditions',
    smooth: 'Ideal conditions',
    light: 'A little motion',
    bumpy: 'Bumpy ride',
    rough: 'Very bumpy',
    heightDetail: (height) => `Wave signal ${height}`,
    estimateDetail: 'wind-based ride estimate',
    selectedHour: (hour) => `Shown hour ${hour}`,
    hourTooltip: (hour, level, height) => {
      const copy = { smooth: 'ideal conditions', light: 'a little motion', bumpy: 'bumpy ride', rough: 'very bumpy' }[level];
      return `${hour}: ${copy} (${height})`;
    },
    rangeSummary: (min, max) => `Boat motion ranges from ${min} to ${max}`,
    calmerMorning: 'less motion in the morning',
    calmerLater: 'less motion later',
    note: 'Small boats rock more — above 3 Bft, take care boarding and getting back on from the water.',
  },
  gr: {
    title: 'Συνθήκες πλεύσης',
    smooth: 'Ιδανικές συνθήκες',
    light: 'Λίγο κούνημα',
    bumpy: 'Κουνάει αρκετά',
    rough: 'Πολύ κούνημα',
    heightDetail: (height) => `ένδειξη κύματος ${height}`,
    estimateDetail: 'εκτίμηση από τον άνεμο',
    selectedHour: (hour) => `Ώρα πρόγνωσης: ${hour}`,
    hourTooltip: (hour, level, height) => {
      const copy = {
        smooth: 'ιδανικές συνθήκες',
        light: 'λίγο κούνημα',
        bumpy: 'θα κουνάει αρκετά',
        rough: 'θα κουνάει πολύ',
      }[level];
      return `${hour}: ${copy} (${height})`;
    },
    rangeSummary: (min, max) => `Συνθήκες πλεύσης από ${min} έως ${max}`,
    calmerMorning: 'πιο ήπια το πρωί',
    calmerLater: 'πιο ήπια αργότερα',
    note: 'Πάνω από 3 μποφόρ, η επιβίβαση και η επιστροφή στο σκάφος μέσα από το νερό μπορεί να είναι πιο άβολη.',
  },
  fr: {
    title: 'Mouvement du trajet',
    smooth: 'Conditions idéales',
    light: 'Un peu de mouvement',
    bumpy: 'Trajet agité',
    rough: 'Très agité',
    heightDetail: (height) => `signal de vague ${height}`,
    estimateDetail: 'estimation d apres le vent',
    selectedHour: (hour) => `Heure affichee ${hour}`,
    hourTooltip: (hour, level, height) => `${hour} : ${({ smooth: 'conditions idéales', light: 'un peu de mouvement', bumpy: 'trajet agité', rough: 'très agité' }[level])} (${height})`,
    rangeSummary: (min, max) => `Mouvement du trajet de ${min} a ${max}`,
    calmerMorning: 'moins de mouvement le matin',
    calmerLater: 'moins de mouvement plus tard',
    note: 'Les petits bateaux bougent plus — au-delà de 3 Bft, attention pour monter et remonter à bord depuis l’eau.',
  },
  de: {
    title: 'Bewegung der Bootsfahrt',
    smooth: 'Ideale Bedingungen',
    light: 'Etwas Bewegung',
    bumpy: 'Unruhige Fahrt',
    rough: 'Sehr unruhig',
    heightDetail: (height) => `Wellensignal ${height}`,
    estimateDetail: 'aus dem Wind geschaetzt',
    selectedHour: (hour) => `Angezeigte Stunde ${hour}`,
    hourTooltip: (hour, level, height) => `${hour}: ${({ smooth: 'ideale Bedingungen', light: 'etwas Bewegung', bumpy: 'unruhige Fahrt', rough: 'sehr unruhig' }[level])} (${height})`,
    rangeSummary: (min, max) => `Bewegung der Bootsfahrt von ${min} bis ${max}`,
    calmerMorning: 'morgens weniger Bewegung',
    calmerLater: 'spater weniger Bewegung',
    note: 'Kleine Boote schaukeln stärker — über 3 Bft beim Ein- und Wiedereinsteigen aus dem Wasser aufpassen.',
  },
  it: {
    title: 'Movimento del tragitto',
    smooth: 'Condizioni ideali',
    light: 'Un po’ di movimento',
    bumpy: 'Tragitto mosso',
    rough: 'Molto mosso',
    heightDetail: (height) => `segnale onde ${height}`,
    estimateDetail: 'stima dal vento',
    selectedHour: (hour) => `Ora mostrata ${hour}`,
    hourTooltip: (hour, level, height) => `${hour}: ${({ smooth: 'condizioni ideali', light: 'un po’ di movimento', bumpy: 'tragitto mosso', rough: 'molto mosso' }[level])} (${height})`,
    rangeSummary: (min, max) => `Movimento del tragitto da ${min} a ${max}`,
    calmerMorning: 'meno movimento al mattino',
    calmerLater: 'meno movimento dopo',
    note: 'Le barche piccole ballano di più — oltre 3 Bft attenzione a salire e risalire a bordo dall’acqua.',
  },
};

type WaveTrendKey = 'calmerMorning' | 'calmerLater';

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

type SwimFeelCopy = {
  label: string;
  calm: string;
  amber: string;
  rough: string;
  estimate: string;
  protectedChop: string;
  protectedWindChop: string;
  windChop: string;
  exposedSea: string;
  roughSwim: string;
};

const SWIM_FEEL_COPY: LocalizedCopy<SwimFeelCopy> = {
  en: {
    label: 'Swimming feel',
    calm: 'Low waves',
    amber: 'Some chop',
    rough: 'Rougher sea',
    estimate: 'Wind-based estimate',
    protectedChop: 'More sheltered, with chop',
    protectedWindChop: 'Milder, but wavy',
    windChop: 'Wind chop',
    exposedSea: 'Exposed, with waves',
    roughSwim: 'Difficult for swimming',
  },
  gr: {
    label: 'Αίσθηση στο μπάνιο',
    calm: 'Χαμηλό κύμα',
    amber: 'Λίγος κυματισμός',
    rough: 'Πιο έντονο κύμα',
    estimate: 'Εκτίμηση από άνεμο',
    protectedChop: 'Πιο προστατευμένη, με κυματισμό',
    protectedWindChop: 'Πιο ήπια, αλλά με κύμα',
    windChop: 'Κυματισμός με αέρα',
    exposedSea: 'Εκτεθειμένη, με κύμα',
    roughSwim: 'Δύσκολη για μπάνιο',
  },
  fr: {
    label: 'Pour la baignade',
    calm: 'Vagues faibles',
    amber: 'Un peu de clapot',
    rough: 'Mer plus agitée',
    estimate: 'Estimation par le vent',
    protectedChop: 'Mieux abrité, avec clapot',
    protectedWindChop: 'Plus doux, mais agité',
    windChop: 'Clapot avec vent',
    exposedSea: 'Exposé, avec vagues',
    roughSwim: 'Baignade difficile',
  },
  de: {
    label: 'Badegefühl',
    calm: 'Niedrige Wellen',
    amber: 'Etwas Kabbelwasser',
    rough: 'Unruhigere See',
    estimate: 'Windbasierte Schätzung',
    protectedChop: 'Geschützter, mit Wellen',
    protectedWindChop: 'Milder, aber wellig',
    windChop: 'Windiges Kabbelwasser',
    exposedSea: 'Exponiert, mit Wellen',
    roughSwim: 'Schwierig zum Baden',
  },
  it: {
    label: 'Sensazione in acqua',
    calm: 'Onde basse',
    amber: 'Un po’ mosso',
    rough: 'Mare più mosso',
    estimate: 'Stima dal vento',
    protectedChop: 'Più riparata, con onde',
    protectedWindChop: 'Più mite, ma mosso',
    windChop: 'Onde con vento',
    exposedSea: 'Esposta, con onde',
    roughSwim: 'Difficile per nuotare',
  },
};

const normalizeBeaufort = (windBeaufort?: number): number | undefined =>
  typeof windBeaufort === 'number' && Number.isFinite(windBeaufort) ? windBeaufort : undefined;

const isVerifiedProtectedExposure = (
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean
): boolean => exposureLevel === 'protected' && canClaimWindProtection === true;

const isLessExposedForSwimFeel = (exposureLevel?: ExposureLevel): boolean =>
  exposureLevel === 'protected' || exposureLevel === 'partial';

// The wording follows the ONE severity from utils/seaVerdict, so this chip can no longer say
// "Some chop" under a badge that says "Excellent". Exposure still chooses WHICH sentence is
// used at a given severity — that is the useful part (it names the cause) — but it can never
// pick a calmer severity than the sea and wind together earned.
const getSwimmingFeel = (
  copy: SwimFeelCopy,
  scale: WaveScaleResult,
  severity: SeaSeverity,
  windSeverity: SeaSeverity,
  seaStateSeverity: SeaSeverity,
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean
): string => {
  if (scale.isEstimate) return copy.estimate;

  const isProtected = isVerifiedProtectedExposure(exposureLevel, canClaimWindProtection)
    || exposureLevel === 'protected';
  const isLessExposed = isLessExposedForSwimFeel(exposureLevel);
  const isExposed = exposureLevel === 'exposed';
  const windIsTheCause = windSeverity !== 'calm';

  if (severity === 'rough') {
    // Shelter may soften the WORDING only when the roughness comes from the wind. A measured
    // rough sea is not made milder by standing in the lee, and this branch used to claim it was.
    return isProtected && seaStateSeverity !== 'rough' ? copy.protectedWindChop : copy.roughSwim;
  }

  if (severity === 'moderate') {
    if (!windIsTheCause) return copy.amber;
    if (isLessExposed) return copy.protectedChop;
    if (isExposed) return copy.exposedSea;
    return copy.windChop;
  }

  return copy.calm;
};

// One severity band per card — and now the same one the badge and the "weather now" chip use.
// Headline colour, panel tint, scene palette and the swim-feel label all read from this, so the
// number can never sit reassuring-green beside a red "difficult for swimming" chip.
const toWaveBand = (severity: SeaSeverity): WaveBand =>
  severity === 'rough' ? 'rough' : severity === 'moderate' ? 'amber' : 'calm';

const getSwimmingFeelLabelClass = (scale: WaveScaleResult, severity: SeaSeverity): string =>
  scale.isEstimate ? WAVE_ESTIMATE_CLASSES.label : WAVE_BAND_CLASSES[toWaveBand(severity)].label;

const getCompactWindSignalMinHeightM = (
  windBeaufort?: number,
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean
): number | undefined => {
  const beaufort = normalizeBeaufort(windBeaufort);
  if (typeof beaufort !== 'number') return undefined;

  const isProtected = isVerifiedProtectedExposure(exposureLevel, canClaimWindProtection) || exposureLevel === 'protected';
  const isExposedOrPartial = exposureLevel === 'exposed' || exposureLevel === 'partial';

  if (beaufort >= 6) return isProtected ? 0.65 : 1.2;
  if (beaufort >= 5) return 0.65;
  if (beaufort >= 4 && isExposedOrPartial) return 0.5;

  return undefined;
};

// Compact cards are a quick condition signal, so strong wind/exposure must prevent a
// reassuring flat-calm glyph even when the raw marine wave height is still low.
const getCompactWaveSignalScale = (
  scale: WaveScaleResult,
  language: LanguageCode,
  waveHeightM?: number,
  wavePeriodS?: number,
  estimateHeightM?: number,
  windBeaufort?: number,
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean
): WaveScaleResult => {
  const minSignalHeightM = getCompactWindSignalMinHeightM(windBeaufort, exposureLevel, canClaimWindProtection);
  if (typeof minSignalHeightM !== 'number') return scale;

  // The small glyph is a condition signal, not a literal ruler. Short-period chop should look
  // more active than a long, gentle roll with the same forecast height; the text beside it keeps
  // the raw forecast metres as evidence.
  const visibleHeightM = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? seaStateSeverityM(waveHeightM, wavePeriodS) ?? waveHeightM
    : typeof estimateHeightM === 'number' && Number.isFinite(estimateHeightM)
      ? estimateHeightM
      : undefined;

  if (typeof visibleHeightM === 'number' && visibleHeightM >= minSignalHeightM) return scale;

  if (scale.isEstimate) {
    return getWaveScale(undefined, language, {
      isEstimate: true,
      estimateHeightM: minSignalHeightM,
    });
  }

  return getWaveScale(minSignalHeightM, language);
};

// Scene motion follows the sea-state intensity — a wind-whipped surface drifts fast and far, a
// calm one barely moves. The person is static (feet planted on the seabed), so only the water
// animates; wind chop must MOVE like wind chop even when the waterline itself sits low.
const getSceneMotionStyle = (intensity: number): React.CSSProperties => {
  const t = Math.max(0, Math.min(4, intensity));
  return {
    '--cb-wave-duration': `${(4.0 - t * 0.55).toFixed(2)}s`,
    '--cb-wave-drift': `${(2 + t * 1.25).toFixed(2)}px`,
  } as React.CSSProperties;
};

// Dry-land comparison only. It helps a visitor read the scale without implying that forecast
// wave height is the depth of water around a standing swimmer.
const ADULT_REFERENCE_HEIGHT_M = 1.7;

const formatWaveHeight = (m: number, language: LanguageCode): string => {
  const value = m.toFixed(1);
  return language === 'gr' ? `~${value.replace('.', ',')} μ.` : `~${value} m`;
};

// A wave-height band, e.g. "~0,6–1,0 μ." — one unit, one tilde, so it reads as a single range.
const formatWaveRange = (lowM: number, highM: number, language: LanguageCode): string => {
  const fmt = (v: number) => (language === 'gr' ? v.toFixed(1).replace('.', ',') : v.toFixed(1));
  const unit = language === 'gr' ? ' μ.' : ' m';
  return `~${fmt(lowM)}–${fmt(highM)}${unit}`;
};

const getBlueWaterFillClass = (scale: WaveScaleResult): string => {
  if (scale.isEstimate) return 'text-sky-300 dark:text-sky-500';
  if (scale.band === 'rough') return 'text-sky-600 dark:text-sky-400';
  if (scale.band === 'amber') return 'text-cyan-500 dark:text-cyan-400';
  return 'text-teal-500 dark:text-teal-400';
};

const getCompactWaveFillClass = (scale: WaveScaleResult, suitabilityColor?: WindSuitabilityColor): string => (
  suitabilityColor
    ? WIND_SUITABILITY_TONE_CLASSES[suitabilityColor].wave
    : scale.isEstimate ? WAVE_ESTIMATE_CLASSES.fill : WAVE_BAND_CLASSES[scale.band].fill
);

const getBoatRideBandClasses = (level: BoatRideMotionLevel, isEstimate?: boolean) => {
  if (isEstimate) return WAVE_ESTIMATE_CLASSES;
  switch (level) {
    case 'rough':
      return WAVE_BAND_CLASSES.rough;
    case 'bumpy':
      return WAVE_BAND_CLASSES.amber;
    case 'light':
      return {
        fill: 'text-cyan-500 dark:text-cyan-400',
        bar: 'bg-cyan-400 dark:bg-cyan-500',
        soft: 'bg-cyan-50/70 dark:bg-cyan-900/20',
        label: 'text-cyan-700 dark:text-cyan-300',
      };
    case 'smooth':
    default:
      return WAVE_BAND_CLASSES.calm;
  }
};

const getBoatMotionStyle = (level: BoatRideMotionLevel): React.CSSProperties => {
  const motion = {
    smooth: { bobPx: 1.1, tiltDeg: 0.6, driftPx: 2, durationS: 4.8 },
    light: { bobPx: 2.4, tiltDeg: 1.8, driftPx: 3.2, durationS: 3.7 },
    bumpy: { bobPx: 5, tiltDeg: 5, driftPx: 5.5, durationS: 2.6 },
    rough: { bobPx: 9, tiltDeg: 9.5, driftPx: 8, durationS: 1.8 },
  }[level];

  return {
    '--cb-wave-duration': `${motion.durationS}s`,
    '--cb-swimmer-bob': `${motion.bobPx}px`,
    '--cb-swimmer-tilt': `${motion.tiltDeg}deg`,
    '--cb-wave-drift': `${motion.driftPx}px`,
  } as React.CSSProperties;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

type WaveVisualTier = 0 | 1 | 2 | 3 | 4;

const getWaveVisualTier = (
  windBeaufort?: number,
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean
): WaveVisualTier => {
  const beaufort = normalizeBeaufort(windBeaufort);
  if (typeof beaufort !== 'number' || beaufort <= 2) return 0;

  const isProtected = isVerifiedProtectedExposure(exposureLevel, canClaimWindProtection) || exposureLevel === 'protected';

  if (beaufort <= 3) return 1;
  if (beaufort === 4) return isProtected ? 1 : 2;
  if (beaufort === 5) return isProtected ? 2 : 3;
  if (beaufort === 6) return isProtected ? 3 : 4;
  return 4;
};

const METER_BASE_MAX_M = 2.5; // the shore scene's standing axis — one scale for almost every day
const METER_HARD_MAX_M = 3.0; // never treat a wave as taller than this, however wild the value
const METER_TICK_STEP = 0.5;

// Axis top for a given wave height. Held at 2.5 m for virtually every Greek beach day so two
// beaches can be compared by eye; only a genuinely huge sea pushes it to the 3 m ceiling.
const axisMaxForHeight = (m: number): number =>
  m <= METER_BASE_MAX_M ? METER_BASE_MAX_M : METER_HARD_MAX_M;

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
const getWaveSceneStyle = (scale: WaveScaleResult, bandOverride?: WaveBand): React.CSSProperties => {
  const band = bandOverride ?? scale.band;
  const palette = scale.isEstimate
    ? {
        crest: '#bae6fd',
        mid: '#7dd3fc',
        deep: '#0284c7',
        sky: '#f0f9ff',
        sand: '#e2e8f0',
        swimmer: '#475569',
        foam: 'rgba(255,255,255,0.72)',
        guide: 'rgba(71,85,105,0.62)',
      }
    : band === 'rough'
      ? {
          crest: '#38bdf8',
          mid: '#0ea5e9',
          deep: '#0369a1',
          sky: '#e0f2fe',
          sand: '#fde68a',
          swimmer: '#475569',
          foam: 'rgba(255,255,255,0.84)',
          guide: 'rgba(51,65,85,0.72)',
        }
      : band === 'amber'
        ? {
            crest: '#67e8f9',
            mid: '#22d3ee',
            deep: '#0284c7',
            sky: '#ecfeff',
            sand: '#fde68a',
            swimmer: '#475569',
            foam: 'rgba(255,255,255,0.8)',
            guide: 'rgba(51,65,85,0.72)',
          }
        : {
            crest: '#2dd4bf',
            mid: '#14b8a6',
            deep: '#0891b2',
            sky: '#ecfeff',
            sand: '#fde68a',
            swimmer: '#475569',
            foam: 'rgba(255,255,255,0.78)',
            guide: 'rgba(51,65,85,0.72)',
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

// A SHORE IN CROSS-SECTION — the wave breaking at the size it really is.
//
// Wave height is a property of the SURFACE, not a depth, so the drawing is a shoreline seen from the
// side: open sea on the left, a wave shoaling and breaking, dry sand on the right. A small adult
// outline sits on the dry sand as a scale reference only; it is never placed in the water.
//
// Five rules, each paid for by a failed attempt:
//  1. NO PERSON IN THE SEA. A to-scale figure standing in the sea filled the water to the wave height and drew
//     someone submerged to the neck at 1,3 m — a statement about depth the number never makes. It
//     read as a drowning (reported 29/07/2026).
//  2. NO SEABED. Drawing the bottom shelving up put a hard diagonal across the frame and, worse,
//     went back to depicting depth. Water simply fills everything below the still level; only the
//     DRY sand is drawn, diving under the surface at the shoreline.
//  3. AN ASYMMETRIC WAVE. A symmetric crest at this scale reads as a hill or a spike. A real
//     breaker has a long low shoaling back, a late steep rise, a rounded crest and a lip pitching
//     forward — that silhouette is what says "wave" at any height.
//  4. DRY-LAND REFERENCE ONLY. A neutral adult outline may help visitors read the scale, but it must
//     stay outside the water and carry no claim about standing depth.
//  5. A SPILLING MANE, NOT AN OUTLINE. White water sitting ON the crest and running down the face to
//     the beach is what reads as "breaking"; a thin white outline just reads as "tall". Greek beach
//     waves spill — no barrels, no spray everywhere. The target is an instrument, not a poster.
//
// One shape, one scale: the crest is derived from half the reported crest-to-trough span, so the
// same path grows continuously without turning the forecast into an apparent vertical wall.
// Wind and sea state never move the reading line — they only add chop, foam, spray and colour severity.
const ShoreProfileScene: React.FC<{
  scale: WaveScaleResult;
  visualHeightM: number;
  windTier: WaveVisualTier;
  severityBand: WaveBand;
  readingLabel: string;
  language: LanguageCode;
  bandLowM?: number;
  bandHighM?: number;
}> = ({ scale, visualHeightM, windTier, severityBand, readingLabel, language, bandLowM, bandHighM }) => {
  const plotTopY = 12;
  const swl = 94; // still-water level — the zero of the metre axis
  const floorY = 124;
  const axisX = 26;
  const xL = 4;
  const xR = 208;
  const plotHeight = swl - plotTopY;
  const axisMaxM = axisMaxForHeight(visualHeightM);
  const mToY = (m: number) => swl - (clamp(m, 0, axisMaxM) / axisMaxM) * plotHeight;
  const formatTick = (m: number) => (language === 'gr' ? m.toFixed(1).replace('.', ',') : m.toFixed(1));

  // Marine forecast wave height is a crest-to-trough span. Drawing all of it above the mean
  // surface makes a 1.4 m forecast look like a 1.4 m wall. The illustrated crest rises by half;
  // the bracket below preserves the full reported value.
  const crestRiseM = visualHeightM / 2;
  const crestY = mToY(crestRiseM);
  const hPx = swl - crestY;
  const troughY = Math.min(floorY - 2, swl + hPx);
  const crestX = 110;
  const shoreX = 152; // where the still waterline meets the sand

  const sandYAt = (x: number): number => swl - clamp((x - shoreX) * 0.26, 0, 13);

  const visualIntensity = Math.max(windTier, severityBand === 'rough' ? 4 : severityBand === 'amber' ? 2 : 0);
  // Offshore chop: texture only. It rides around the still-water level and never touches the reading.
  const chop = clamp(1 + visualIntensity * 0.8 + hPx * 0.06, 1.2, 6.5);

  const sceneId = React.useId().replace(/:/g, '');
  const skyGradientId = `shore-sky-${sceneId}`;
  const waterGradientId = `shore-water-${sceneId}`;
  const sandGradientId = `shore-sand-${sceneId}`;
  const sceneStyle = {
    ...getWaveSceneStyle(scale, severityBand),
    ...getSceneMotionStyle(visualIntensity),
  } as React.CSSProperties;
  const tickValues = axisTicks(axisMaxM);

  // The sea surface, left to right. The back stays LOW until late (0.05 → 0.14 → 0.30 of the height
  // over half the frame) and only then rears to a ROUNDED crest: that late rise, and the fact that
  // the top is a curve rather than a point, is the whole difference between a wave and a spike.
  const lipX = crestX + 19;
  const lipY = crestY + hPx * 0.46;
  const surfacePath = [
    `M${xL} ${(swl + 1.5).toFixed(1)}`,
    `C 12 ${(swl + 1.5 - chop).toFixed(1)}, 24 ${(swl + 1.5 + chop * 0.6).toFixed(1)}, 36 ${(swl + 0.4).toFixed(1)}`,
    `C 48 ${(swl - hPx * 0.03 - chop * 0.6).toFixed(1)}, 62 ${(swl - hPx * 0.09).toFixed(1)}, 76 ${(swl - hPx * 0.22).toFixed(1)}`,
    `C 88 ${(swl - hPx * 0.4).toFixed(1)}, 98 ${(swl - hPx * 0.72).toFixed(1)}, ${crestX - 8} ${(crestY + hPx * 0.06).toFixed(1)}`,
    `C ${crestX - 4} ${crestY.toFixed(1)}, ${crestX + 4} ${crestY.toFixed(1)}, ${crestX + 9} ${(crestY + hPx * 0.05).toFixed(1)}`,
    // The lip pitches forward, then the face falls back to the LEFT of it — that hollow is what a
    // breaking wave looks like and what a hill never does.
    `C ${crestX + 16} ${(crestY + hPx * 0.13).toFixed(1)}, ${lipX + 3} ${(crestY + hPx * 0.28).toFixed(1)}, ${lipX} ${lipY.toFixed(1)}`,
    `C ${crestX + 14} ${(swl - hPx * 0.3).toFixed(1)}, ${crestX + 20} ${(swl - hPx * 0.08).toFixed(1)}, ${crestX + 33} ${(swl - hPx * 0.03).toFixed(1)}`,
    `C ${crestX + 42} ${(troughY - hPx * 0.18).toFixed(1)}, ${shoreX - 8} ${(swl + hPx * 0.28).toFixed(1)}, ${shoreX + 2} ${(swl + 0.5).toFixed(1)}`,
  ].join(' ');
  // Water fills everything below the surface, right across the frame; the sand is painted over its
  // shoreward end. No vertical wall, no diagonal seabed, no depth claim.
  const waterPath = `${surfacePath} L${xR} ${swl + 1} L${xR} ${floorY + 8} L${xL} ${floorY + 8} Z`;

  // The break: a spilling mane of white water over the crest, running down the face and on to the
  // beach. It only appears once there is a face to break down, so a glassy morning stays glassy.
  const showBreak = hPx >= 10 || visualIntensity >= 2;
  const breakPath = [
    `M${crestX - 16} ${(crestY + hPx * 0.22).toFixed(1)}`,
    `C ${crestX - 7} ${(crestY - hPx * 0.05).toFixed(1)}, ${crestX + 6} ${(crestY - hPx * 0.05).toFixed(1)}, ${crestX + 16} ${(crestY + hPx * 0.16).toFixed(1)}`,
    `C ${lipX + 5} ${(crestY + hPx * 0.4).toFixed(1)}, ${crestX + 19} ${(swl - hPx * 0.3).toFixed(1)}, ${crestX + 29} ${(swl - hPx * 0.09).toFixed(1)}`,
    `C ${crestX + 39} ${(swl + 0.4).toFixed(1)}, ${shoreX - 10} ${(swl + 0.8).toFixed(1)}, ${shoreX + 2} ${(swl + 1.4).toFixed(1)}`,
    `C ${shoreX - 16} ${(swl + 3.8).toFixed(1)}, ${crestX + 32} ${(swl + 1.8).toFixed(1)}, ${crestX + 20} ${(swl - hPx * 0.22).toFixed(1)}`,
    `C ${crestX + 13} ${(lipY - hPx * 0.04).toFixed(1)}, ${crestX + 6} ${(crestY + hPx * 0.34).toFixed(1)}, ${crestX - 4} ${(crestY + hPx * 0.32).toFixed(1)}`,
    `C ${crestX - 10} ${(crestY + hPx * 0.33).toFixed(1)}, ${crestX - 15} ${(crestY + hPx * 0.28).toFixed(1)}, ${crestX - 16} ${(crestY + hPx * 0.22).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Swash: the thin sheet of water sliding up the sand. On a calm day this IS the whole event.
  const runUpX = shoreX + clamp(hPx * 0.8, 6, 28);
  const swashPath = [
    `M${shoreX - 12} ${(swl + 2.2).toFixed(1)}`,
    `C ${shoreX} ${(swl - 0.4).toFixed(1)}, ${(runUpX - 10).toFixed(1)} ${(sandYAt(runUpX - 10) - 0.8).toFixed(1)}, ${runUpX.toFixed(1)} ${(sandYAt(runUpX) - 0.4).toFixed(1)}`,
    `C ${(runUpX - 12).toFixed(1)} ${(sandYAt(runUpX - 12) + 2.4).toFixed(1)}, ${shoreX} ${(swl + 3.2).toFixed(1)}, ${shoreX - 12} ${(swl + 4).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Dry sand only. Keep the shore profile shallow and entirely on the landward side; drawing a
  // deep diagonal here makes the illustration look like a sudden drop-off or a seabed section.
  const sandPath = [
    `M${xR} ${sandYAt(xR).toFixed(1)}`,
    `C 190 ${sandYAt(190).toFixed(1)}, 168 ${sandYAt(168).toFixed(1)}, ${shoreX} ${(swl + 0.5).toFixed(1)}`,
    `L${xR} ${floorY + 8}`,
    'Z',
  ].join(' ');

  const hasBand = typeof bandLowM === 'number' && typeof bandHighM === 'number' && bandHighM > bandLowM && !scale.isEstimate;
  const bandTopY = hasBand ? mToY((bandHighM as number) / 2) : 0;
  const bandBotY = hasBand ? mToY((bandLowM as number) / 2) : 0;

  const readingRightX = crestX - 10;
  const bracketX = 139;
  const personX = 184;
  const personBaseY = sandYAt(personX);
  const personTopY = personBaseY - (ADULT_REFERENCE_HEIGHT_M / axisMaxM) * plotHeight;
  const personHipY = personBaseY - (0.9 / axisMaxM) * plotHeight;
  const personHeightPx = personBaseY - personTopY;
  const personHeadR = clamp(personHeightPx * 0.058, 2.6, 3.4);
  const personHeadCy = personTopY + personHeadR + 0.6;
  const personShoulderY = personTopY + personHeightPx * 0.2;
  const personChestY = personTopY + personHeightPx * 0.34;
  const personWaistY = personTopY + personHeightPx * 0.48;
  const personPelvisY = personTopY + personHeightPx * 0.58;
  const personKneeY = personTopY + personHeightPx * 0.79;
  const personFootY = personBaseY - 0.5;
  const personShoulderW = clamp(personHeightPx * 0.17, 7.4, 9.2);
  const personWaistW = clamp(personHeightPx * 0.11, 4.8, 6.2);
  const personHipW = clamp(personHeightPx * 0.13, 5.8, 7.2);
  const personTorsoPath = [
    `M${(personX - personShoulderW / 2).toFixed(1)} ${personShoulderY.toFixed(1)}`,
    `Q${personX.toFixed(1)} ${(personShoulderY - 2).toFixed(1)} ${(personX + personShoulderW / 2).toFixed(1)} ${personShoulderY.toFixed(1)}`,
    `C${(personX + personWaistW / 2).toFixed(1)} ${personChestY.toFixed(1)}, ${(personX + personWaistW / 2).toFixed(1)} ${personWaistY.toFixed(1)}, ${(personX + personHipW / 2).toFixed(1)} ${personPelvisY.toFixed(1)}`,
    `L${(personX - personHipW / 2).toFixed(1)} ${personPelvisY.toFixed(1)}`,
    `C${(personX - personWaistW / 2).toFixed(1)} ${personWaistY.toFixed(1)}, ${(personX - personWaistW / 2).toFixed(1)} ${personChestY.toFixed(1)}, ${(personX - personShoulderW / 2).toFixed(1)} ${personShoulderY.toFixed(1)}`,
    'Z',
  ].join(' ');
  const personArmsPath = [
    `M${(personX - personShoulderW / 2 + 0.5).toFixed(1)} ${(personShoulderY + 1.2).toFixed(1)}`,
    `C${(personX - personShoulderW * 0.72).toFixed(1)} ${(personChestY + 1).toFixed(1)}, ${(personX - personShoulderW * 0.66).toFixed(1)} ${(personWaistY + 1).toFixed(1)}, ${(personX - personHipW * 0.58).toFixed(1)} ${(personPelvisY - 1).toFixed(1)}`,
    `M${(personX + personShoulderW / 2 - 0.5).toFixed(1)} ${(personShoulderY + 1.2).toFixed(1)}`,
    `C${(personX + personShoulderW * 0.72).toFixed(1)} ${(personChestY + 1).toFixed(1)}, ${(personX + personShoulderW * 0.66).toFixed(1)} ${(personWaistY + 1).toFixed(1)}, ${(personX + personHipW * 0.58).toFixed(1)} ${(personPelvisY - 1).toFixed(1)}`,
  ].join(' ');
  const personLegsPath = [
    `M${(personX - personHipW * 0.25).toFixed(1)} ${(personPelvisY - 0.2).toFixed(1)}`,
    `C${(personX - personHipW * 0.48).toFixed(1)} ${personKneeY.toFixed(1)}, ${(personX - personHipW * 0.48).toFixed(1)} ${(personFootY - 4).toFixed(1)}, ${(personX - personHipW * 0.68).toFixed(1)} ${personFootY.toFixed(1)}`,
    `M${(personX + personHipW * 0.25).toFixed(1)} ${(personPelvisY - 0.2).toFixed(1)}`,
    `C${(personX + personHipW * 0.48).toFixed(1)} ${personKneeY.toFixed(1)}, ${(personX + personHipW * 0.48).toFixed(1)} ${(personFootY - 4).toFixed(1)}, ${(personX + personHipW * 0.68).toFixed(1)} ${personFootY.toFixed(1)}`,
  ].join(' ');
  const personFeetPath = [
    `M${(personX - personHipW * 0.86).toFixed(1)} ${personFootY.toFixed(1)} H${(personX - personHipW * 0.22).toFixed(1)}`,
    `M${(personX + personHipW * 0.22).toFixed(1)} ${personFootY.toFixed(1)} H${(personX + personHipW * 0.86).toFixed(1)}`,
  ].join(' ');
  const windStreaks = Array.from({ length: windTier }, (_, index) => ({
    x1: 34 + index * 12,
    x2: 60 + index * 13,
    y: 19 + index * 5.5,
    opacity: 0.15 + index * 0.07,
  })).filter((streak) => streak.y < crestY - 6);

  return (
    <svg viewBox="0 0 212 128" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="h-auto w-full drop-shadow-sm" style={sceneStyle}>
      <defs>
        <linearGradient id={skyGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cb-wave-sky)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={waterGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cb-wave-crest)" stopOpacity="0.85" />
          <stop offset="60%" stopColor="var(--cb-wave-mid)" stopOpacity="0.72" />
          <stop offset="100%" stopColor="var(--cb-wave-deep)" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id={sandGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cb-wave-sand)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--cb-wave-sand)" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="208" height="124" rx="20" fill={`url(#${skyGradientId})`} />

      {windStreaks.length > 0 && (
        <g className="cb-wave-highlight" stroke="var(--cb-wave-deep)" strokeLinecap="round">
          {windStreaks.map((streak, index) => (
            <path key={index} d={`M${streak.x1} ${streak.y} H${streak.x2}`} strokeWidth={1.3 + index * 0.3} opacity={streak.opacity} />
          ))}
        </g>
      )}

      {/* Honest uncertainty band: a soft zone only — no hard edge that could be misread as the height. */}
      {hasBand && (
        <rect x={axisX} y={bandTopY} width={readingRightX - axisX} height={Math.max(0, bandBotY - bandTopY)} fill="var(--cb-wave-deep)" opacity="0.1" />
      )}

      <path d={waterPath} fill={`url(#${waterGradientId})`} fillOpacity={scale.isEstimate ? 0.55 : 1} />

      <path
        d={surfacePath}
        fill="none"
        strokeLinecap="round"
        {...(scale.isEstimate
          ? { stroke: 'var(--cb-wave-deep)', strokeWidth: 1.2, strokeDasharray: '4 3', opacity: 0.65 }
          : { stroke: 'var(--cb-wave-foam-color)', strokeWidth: visualIntensity >= 4 ? 2.2 : visualIntensity >= 2 ? 1.8 : 1.4 })}
      />

      {showBreak && !scale.isEstimate && (
        <path d={breakPath} fill="var(--cb-wave-foam-color)" opacity={visualIntensity >= 4 ? 0.95 : 0.84} />
      )}

      {visualIntensity >= 4 && !scale.isEstimate && (
        <g className="cb-wave-spray" fill="var(--cb-wave-foam-color)" opacity="0.85">
          <circle cx={lipX + 6} cy={crestY + hPx * 0.08} r="1.4" />
          <circle cx={lipX + 11} cy={crestY + hPx * 0.24} r="1" />
          <circle cx={crestX + 2} cy={crestY - 5} r="1.2" />
        </g>
      )}

      <path d={sandPath} fill={`url(#${sandGradientId})`} />

      {/* The water's edge sliding up the sand — animated, because this is the part that actually moves. */}
      <path className="cb-wave-foam" d={swashPath} fill="var(--cb-wave-foam-color)" opacity={scale.isEstimate ? 0.45 : 0.82} />

      {/* Full crest-to-trough bracket. This is the reported wave span, not a water-depth ruler. */}
      {!scale.isEstimate && hPx >= 6 && (
        <g stroke="var(--cb-wave-guide-color)" fill="none" opacity="0.72">
          <path d={`M${bracketX} ${crestY.toFixed(1)} V${troughY.toFixed(1)}`} strokeWidth="1" strokeDasharray="2 2" />
          <path d={`M${bracketX - 2.5} ${crestY.toFixed(1)} H${bracketX + 2.5} M${bracketX - 2.5} ${troughY.toFixed(1)} H${bracketX + 2.5}`} strokeWidth="1.1" strokeLinecap="round" />
          <text x={bracketX + 4} y={((crestY + troughY) / 2 + 2).toFixed(1)} fill="var(--cb-wave-guide-color)" stroke="rgba(255,255,255,0.9)" strokeWidth="2" paintOrder="stroke" fontSize="5.7" fontWeight="800">
            {readingLabel}
          </text>
        </g>
      )}

      {/* Dry-land adult reference. Built from height ratios so the body stays proportional at every scale. */}
      <g stroke="var(--cb-wave-guide-color)" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
        <circle cx={personX} cy={personHeadCy.toFixed(1)} r={personHeadR.toFixed(1)} fill="var(--cb-wave-guide-color)" stroke="none" />
        <path d={personTorsoPath} fill="var(--cb-wave-guide-color)" stroke="none" />
        <path d={personArmsPath} fill="none" strokeWidth="2" />
        <path d={personLegsPath} fill="none" strokeWidth="2.25" />
        <path d={personFeetPath} fill="none" strokeWidth="1.6" />
        <path d={`M${personX - 7} ${personHipY.toFixed(1)} H${personX + 7}`} fill="none" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        <text x={personX + 9} y={personTopY + 5} fill="var(--cb-wave-guide-color)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" paintOrder="stroke" fontSize="4.8" fontWeight="800">1.7 m</text>
        <text x={personX + 9} y={personHipY + 1.5} fill="var(--cb-wave-guide-color)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4" paintOrder="stroke" fontSize="4.4" fontWeight="700">0.9 m</text>
      </g>

      {/* Metre axis — zero sits on the still waterline, because that is where a wave height starts.
          Labels carry a white halo so they stay legible over the water. */}
      <g>
        {tickValues.map((tick) => (
          <g key={tick}>
            <path d={`M${axisX - 3.5} ${mToY(tick)} H${axisX}`} stroke="var(--cb-wave-guide-color)" strokeWidth="1" opacity="0.65" />
            <text
              x={axisX - 5}
              y={mToY(tick) + 2.5}
              textAnchor="end"
              fontSize="7"
              fontWeight="700"
              fill="var(--cb-wave-guide-color)"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth="2.2"
              paintOrder="stroke"
            >
              {tick === 0 ? '0' : formatTick(tick)}
            </text>
          </g>
        ))}
        <path d={`M${axisX} ${plotTopY} V${swl}`} stroke="var(--cb-wave-guide-color)" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      </g>

      {/* The reading: one labelled line at the crest height — the instrument needle of the scene. */}
      <g>
        <path
          d={`M${axisX} ${crestY} H${readingRightX}`}
          stroke="var(--cb-wave-deep)"
          strokeWidth="1.3"
          opacity="0.85"
          {...(scale.isEstimate ? { strokeDasharray: '4 3' } : {})}
        />
        <circle cx={axisX} cy={crestY} r="3" fill="var(--cb-wave-deep)" stroke="white" strokeWidth="1.2" />
        <text
          x={axisX + 5.5}
          y={crestY - 3.5}
          textAnchor="start"
          fontSize="7.5"
          fontWeight="800"
          fill="var(--cb-wave-deep)"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="2.6"
          paintOrder="stroke"
        >
          {readingLabel}
        </text>
      </g>
    </svg>
  );
};

// Boat-only beaches: a small boat on open water. This is a ride-motion illustration, not
// the swimmer/body-height meter.
const BoatScene: React.FC<{
  scale: WaveScaleResult;
  level: BoatRideMotionLevel;
  windTier: WaveVisualTier;
}> = ({ scale, level, windTier }) => {
  const motion = {
    smooth: { amp: 4.5, tilt: 0, wy: 78, spray: 0 },
    light: { amp: 6.5, tilt: -2, wy: 75, spray: 0 },
    bumpy: { amp: 12, tilt: -6, wy: 68, spray: 2 },
    rough: { amp: 20, tilt: -10.5, wy: 61, spray: 3 },
  }[level];
  const { amp, tilt, wy } = motion;
  const crest = `M0 ${wy} Q 16 ${wy - amp} 32 ${wy} T 64 ${wy} T 96 ${wy} T 128 ${wy} T 160 ${wy}`;
  const midCrestY = clamp(wy + amp * 0.82, 72, 96);
  const midCrest = `M7 ${midCrestY} Q 23 ${midCrestY - amp * 0.54} 39 ${midCrestY} T 71 ${midCrestY} T 103 ${midCrestY} T 135 ${midCrestY} T 153 ${midCrestY}`;
  const foregroundY = clamp(wy + amp * 1.42, 86, 106);
  const foregroundCrest = `M16 ${foregroundY} Q 33 ${foregroundY - amp * 0.32} 50 ${foregroundY} T 84 ${foregroundY} T 118 ${foregroundY} T 150 ${foregroundY}`;
  const sceneId = React.useId().replace(/:/g, '');
  const waterGradientId = `boat-wave-${sceneId}`;
  const skyGradientId = `boat-sky-${sceneId}`;
  const sceneStyle = {
    ...getWaveSceneStyle(scale),
    ...getBoatMotionStyle(level),
  } as React.CSSProperties;
  const activeBars = getBoatRideMotionRank(level) + 1;
  const windStreaks = Array.from({ length: windTier }, (_, index) => ({
    x1: 24 + index * 13,
    x2: 54 + index * 14,
    y: 24 + index * 6,
    opacity: 0.16 + index * 0.08,
  }));

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
      {windStreaks.length > 0 && (
        <g aria-hidden="true" className="cb-wave-highlight" stroke="var(--cb-wave-deep)" strokeLinecap="round">
          {windStreaks.map((streak, index) => (
            <path
              key={index}
              d={`M${streak.x1} ${streak.y} H${streak.x2}`}
              strokeWidth={1.5 + index * 0.35}
              opacity={streak.opacity}
            />
          ))}
        </g>
      )}
      <g aria-hidden="true" transform="translate(118 18)">
        {[0, 1, 2, 3].map((bar) => (
          <rect
            key={bar}
            x={bar * 7}
            y={18 - bar * 4}
            width="4"
            height={8 + bar * 4}
            rx="2"
            fill={bar < activeBars ? 'var(--cb-wave-deep)' : 'rgba(148,163,184,0.32)'}
            opacity={bar < activeBars ? 0.82 : 0.5}
          />
        ))}
      </g>
      <path
        className="cb-wave-backwash"
        d={`M0 ${midCrestY + 7} Q 16 ${midCrestY - amp * 0.22} 32 ${midCrestY + 7} T 64 ${midCrestY + 7} T 96 ${midCrestY + 7} T 128 ${midCrestY + 7} T 160 ${midCrestY + 7} L160 116 L0 116 Z`}
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
      <path d={midCrest} fill="none" className="cb-wave-highlight" stroke="rgba(255,255,255,0.4)" strokeWidth={level === 'rough' ? 5.2 : level === 'bumpy' ? 4.6 : 3.8} strokeLinecap="round" />
      <path d={foregroundCrest} fill="none" className="cb-wave-highlight" stroke="rgba(255,255,255,0.26)" strokeWidth={level === 'rough' ? 4.4 : 3.4} strokeLinecap="round" />
      {motion.spray > 0 && (
        <g className="cb-wave-spray" fill="var(--cb-wave-foam-color)" opacity="0.76">
          <circle cx="40" cy={wy - amp * 0.35} r={motion.spray >= 2 ? 1.5 : 1} />
          <circle cx="112" cy={wy - amp * 0.42} r={motion.spray >= 3 ? 1.8 : 1.1} />
          {motion.spray >= 3 && <circle cx="124" cy={wy - amp * 0.05} r="1.1" />}
        </g>
      )}
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
const CompactGlyph: React.FC<{ scale: WaveScaleResult; suitabilityColor?: WindSuitabilityColor; className?: string }> = ({ scale, suitabilityColor, className }) => {
  const h = Math.max(4, Math.min(14, scale.bodyFraction * 14));
  const top = 18 - h;
  return (
    <svg viewBox="0 0 28 20" className={className ?? 'h-3.5 w-4 shrink-0'} aria-hidden="true">
      <path
        d={`M2 18 L2 ${top} C 8 ${top - 2} 11 ${top + 2} 14 ${top} C 18 ${top - 2} 22 ${top + 1} 26 ${top} L26 18 Z`}
        className={`fill-current ${getCompactWaveFillClass(scale, suitabilityColor)}`}
        fillOpacity={scale.isEstimate ? 0.5 : 0.9}
      />
    </svg>
  );
};

const CompactBoatGlyph: React.FC<{ level: BoatRideMotionLevel; className?: string }> = ({ level, className }) => {
  const amp = { smooth: 1.1, light: 2, bumpy: 4, rough: 6.2 }[level];
  const tilt = { smooth: 0, light: -2, bumpy: -6, rough: -10 }[level];
  const y = { smooth: 14, light: 13, bumpy: 12, rough: 11 }[level];
  const tone = getBoatRideBandClasses(level).fill;

  return (
    <svg viewBox="0 0 30 20" className={className ?? 'h-3.5 w-4 shrink-0'} aria-hidden="true">
      <path
        d={`M2 ${y + 2} C 7 ${y - amp} 12 ${y + amp} 17 ${y} S 25 ${y - amp * 0.6} 28 ${y}`}
        className={`fill-none stroke-current ${tone}`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g transform={`rotate(${tilt} 15 ${y - 1})`} className="fill-current text-slate-500 dark:text-slate-400">
        <path d={`M10 ${y - 3} H22 L20 ${y + 2} Q16 ${y + 4} 12 ${y + 2} Z`} />
        <rect x="14" y={y - 8} width="4.5" height="4" rx="1" />
      </g>
    </svg>
  );
};

const HourlyStrip: React.FC<{
  hourly: HourlyWavePoint[];
  nowHour?: number;
  language: LanguageCode;
  copy: StripCopy;
  boatCopy?: BoatCopy | null;
  /** The day's sea period — colours each bar on the same swell-equivalent scale as the headline
   *  above it, so a steep short-period day cannot show an amber figure over a row of green bars. */
  wavePeriodS?: number;
}> = ({ hourly, nowHour, language, copy, boatCopy, wavePeriodS }) => {
  return (
    <div className="flex items-end gap-[2px]" aria-hidden="true">
      {hourly.map((p) => {
        const isNow = typeof nowHour === 'number' && p.hour === nowHour;
        const boatLevel = boatCopy ? getBoatRideMotionLevel(p.waveHeightM) : null;
        const barClass = boatLevel
          ? getBoatRideBandClasses(boatLevel).bar
          : getWaveBandClasses(seaStateSeverityM(p.waveHeightM, wavePeriodS) ?? p.waveHeightM).bar;
        const title = boatCopy && boatLevel
          ? boatCopy.hourTooltip(formatHour(p.hour), boatLevel, formatWaveHeight(p.waveHeightM, language))
          : copy.hourTooltip(formatHour(p.hour), formatWaveHeight(p.waveHeightM, language));
        return (
          <div key={p.hour} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-8 w-full items-end sm:h-9">
              <div
                title={title}
                className={`w-full rounded-sm ${barClass} ${isNow ? 'ring-2 ring-slate-900/60 ring-offset-1 ring-offset-white dark:ring-white/75 dark:ring-offset-slate-800' : ''}`}
                style={{ height: `${waveBarFraction(p.waveHeightM) * 100}%` }}
              />
            </div>
            {/* Every hour gets its own tiny label so they all fit; the shown/now hour is emphasised.
                The quiet hours were slate-400 — 2,6:1 against white, at 9 px, which is where a
                contrast sweep on 05/08/2026 found them. slate-600 measures 7:1 and the emphasis
                still reads, because it was never carrying the emphasis alone: the now-hour has a
                pill behind it. Contrast is not the same lever as hierarchy. */}
            <span className={`mt-0.5 text-[9px] leading-none font-semibold tabular-nums ${isNow ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
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
  wavePeriodS,
  isEstimate,
  hourly,
  variant,
  language,
  selectedDate,
  selectedHour,
  estimateHeightM,
  boatAccess,
  windBeaufort,
  exposureLevel,
  canClaimWindProtection,
  suitabilityColor,
  className,
}) => {
  const scale = getWaveScale(waveHeightM, language, { isEstimate, estimateHeightM });
  const boatHeightM = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? waveHeightM
    : typeof estimateHeightM === 'number' && Number.isFinite(estimateHeightM)
      ? estimateHeightM
      : undefined;
  const boatLevel = boatAccess ? getBoatRideMotionLevel(boatHeightM, windBeaufort) : null;

  if (variant === 'compact') {
    const compactScale = getCompactWaveSignalScale(
      scale,
      language,
      waveHeightM,
      wavePeriodS,
      estimateHeightM,
      windBeaufort,
      exposureLevel,
      canClaimWindProtection
    );
    return boatLevel
      ? <CompactBoatGlyph level={boatLevel} className={className} />
      : <CompactGlyph scale={compactScale} suitabilityColor={suitabilityColor} className={className} />;
  }

  const copy = getLocalizedCopy(language, COPY);
  const swimFeelCopy = getLocalizedCopy(language, SWIM_FEEL_COPY);
  const windVisualTier = getWaveVisualTier(windBeaufort, exposureLevel, canClaimWindProtection);
  // The drawn waterline is ALWAYS the measured/estimated height — wind roughens texture and colour
  // severity (via severityBand + windTier inside the scene), it never fakes a taller sea.
  const visualWaveHeightM = getVisualWaveHeightM(scale, waveHeightM, estimateHeightM);
  // The number this card DRAWS is the number every verdict on the page is judged from — that
  // identity is what scripts/validateVerdictConsistency.mjs enforces.
  const verdictWaveM = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? waveHeightM
    : estimateHeightM;
  const seaOnlySeverity = getSeaStateSeverity(seaStateSeverityM(verdictWaveM, wavePeriodS));
  const windOnlySeverity = getWindSeverity(windBeaufort, exposureLevel, canClaimWindProtection);
  const seaSeverity = getSeaSeverity({
    waveHeightM: verdictWaveM,
    wavePeriodS,
    windBeaufort,
    exposureLevel,
    canClaimWindProtection,
  });
  const severityBand = toWaveBand(seaSeverity);
  const boatTone = boatLevel ? getBoatRideBandClasses(boatLevel, scale.isEstimate) : null;
  const labelClass = boatTone ? boatTone.label : scale.isEstimate ? WAVE_ESTIMATE_CLASSES.label : WAVE_BAND_CLASSES[severityBand].label;
  const panelClass = boatTone ? boatTone.soft : scale.isEstimate ? WAVE_ESTIMATE_CLASSES.soft : WAVE_BAND_CLASSES[severityBand].soft;
  const isToday = isSelectedDateToday(selectedDate);
  // Mark the hour the forecast is actually showing (the slider hour), falling back to the
  // real wall-clock hour only when no explicit hour is supplied and the day is today.
  const markerHour = typeof selectedHour === 'number' ? selectedHour : (isToday ? athensNow().getHours() : undefined);
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
  const boatCopy = boatAccess ? getLocalizedCopy(language, BOAT_COPY) : null;
  const boatMotionLabel = boatCopy && boatLevel ? boatCopy[boatLevel] : null;
  const supportingDetail = boatCopy
    ? typeof boatHeightM === 'number'
      ? boatCopy.heightDetail(formatWaveHeight(boatHeightM, language))
      : boatCopy.estimateDetail
    : scale.detail;
  const hourlyRange = showStrip
    ? boatCopy
      ? boatCopy.rangeSummary(
        boatCopy[getBoatRideMotionLevel(Math.min(...points.map((p) => p.waveHeightM)), windBeaufort)],
        boatCopy[getBoatRideMotionLevel(Math.max(...points.map((p) => p.waveHeightM)), windBeaufort)]
      )
      : copy.rangeSummary(
        formatWaveHeight(Math.min(...points.map((p) => p.waveHeightM)), language),
        formatWaveHeight(Math.max(...points.map((p) => p.waveHeightM)), language)
      )
    : null;
  // (No titleLabel: the card's own title was removed on 31/07/2026 — see the note further down
  // where the headline block used to be. COPY.title / BOAT_COPY.title are kept only because the
  // aria-label and the boat card's tooltips still read from the same objects.)
  const headlineLabel = boatMotionLabel ?? scale.label;
  const selectedBoatHourNote = boatCopy && boatLevel && typeof selectedHour === 'number'
    ? boatCopy.selectedHour(formatHour(selectedHour))
    : null;

  // Beaufort→Hs is a range, so we show one: a modest band under the headline number and a shaded
  // zone on the meter (information, not a confidence hedge). And once the sea is big enough, one line
  // that the biggest sets run higher than the stated Hs (Hmax ≈ 1.5–2× Hs) — the real safety fact.
  const headlineHeightM = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? waveHeightM
    : (typeof estimateHeightM === 'number' && Number.isFinite(estimateHeightM) ? estimateHeightM : undefined);
  const waveRange = typeof headlineHeightM === 'number' ? getWaveRangeM(headlineHeightM) : null;
  const waveRangeLabel = !boatCopy && waveRange && waveRange.highM - waveRange.lowM >= 0.2
    ? formatWaveRange(waveRange.lowM, waveRange.highM, language)
    : null;
  const referenceLabel = !boatCopy && !scale.isEstimate && typeof headlineHeightM === 'number'
    ? copy.referenceLabel(String(Math.round((headlineHeightM / ADULT_REFERENCE_HEIGHT_M) * 100)))
    : null;
  const showSetsNote = !boatCopy && !scale.isEstimate && typeof headlineHeightM === 'number' && hasNotableSets(headlineHeightM);
  const sceneRange = !boatLevel && !scale.isEstimate && visualWaveHeightM >= 0.4 ? getWaveRangeM(visualWaveHeightM) : null;
  // In-scene annotation for the reading line — a screenshot of the scene alone stays honest.
  const readingLabel = scale.isEstimate && typeof estimateHeightM === 'number' && Number.isFinite(estimateHeightM)
    ? `${getLocalizedCopy(language, ESTIMATE_LABEL)} ${scale.label}`
    : scale.label;

  const ariaRoot = boatCopy
    ? `${boatCopy.title}: ${headlineLabel}, ${supportingDetail}`
    : scale.ariaLabel;
  const ariaLabel = [
    ariaRoot,
    waveRangeLabel ? `${copy.bandLabel} ${waveRangeLabel}` : null,
    referenceLabel ? `${referenceLabel}. ${copy.depthNote}` : null,
    showSetsNote ? copy.setsNote : null,
    hourlyRange,
    trendKey ? (boatCopy ? boatCopy[trendKey] : copy[trendKey]) : null,
    selectedBoatHourNote,
  ]
    .filter(Boolean)
    .map((part) => String(part).replace(/\.+$/, ''))
    .join('. ');
  const swimmingFeel = getSwimmingFeel(swimFeelCopy, scale, seaSeverity, windOnlySeverity, seaOnlySeverity, exposureLevel, canClaimWindProtection);
  const swimmingFeelLabelClass = getSwimmingFeelLabelClass(scale, seaSeverity);
  // Small boats rock more — flag the transfer above 3 Bft (or a genuinely rough sea).
  const showBoatNote = Boolean(boatCopy) && ((typeof windBeaufort === 'number' && windBeaufort >= 4) || boatLevel === 'rough' || boatLevel === 'bumpy');

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-2xl border border-cyan-100/70 bg-white/92 p-3.5 shadow-sm shadow-sky-900/5 ring-1 ring-white/60 dark:border-slate-700 dark:bg-slate-800 sm:p-4 ${className ?? ''}`}
    >
      <div className="space-y-3">
        {/* The panel takes the scene's own aspect ratio (212×128) so the shore fills it at every
            width instead of floating in a band of empty tint on narrow screens. */}
        <div className={`flex w-full items-center justify-center overflow-hidden rounded-[2rem] p-1.5 ring-1 ring-white/70 ${boatAccess && boatLevel ? 'h-56 sm:h-64' : 'aspect-[53/32]'} ${panelClass} [&>svg]:h-full [&>svg]:w-full`}>
          {boatAccess && boatLevel
            ? <BoatScene scale={scale} level={boatLevel} windTier={windVisualTier} />
            : <ShoreProfileScene scale={scale} visualHeightM={visualWaveHeightM} windTier={windVisualTier} severityBand={severityBand} readingLabel={readingLabel} language={language} bandLowM={sceneRange?.lowM} bandHighM={sceneRange?.highM} />}
        </div>
        {/* REMOVED 31/07/2026: the title ("Τι κύμα να περιμένεις"), the repeated headline
            number, the band range and the "~21% ύψους ενήλικα / εύρος πρόγνωσης, όχι βάθος
            νερού" note. All four restated the same wave height the answer hero's ΚΥΜΑ tile
            already gives — this block just said it a second time in more words, right
            under a drawing whose whole job is to show it without words. What survives
            below is the swim-feel chip: it is the one thing this block adds that the tile
            does not (how the wave actually feels to swim in, not just its height). */}
        {!boatCopy && (
          <div className="min-w-0 px-0.5">
            <div className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full border border-slate-100 bg-white/70 px-2.5 py-1 text-[11px] font-bold leading-tight text-slate-500 shadow-sm shadow-sky-900/5 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
              <span>{swimFeelCopy.label}</span>
              <span className={swimmingFeelLabelClass}>{swimmingFeel}</span>
            </div>
            {showSetsNote && (
              <div className="mt-1.5 flex items-start gap-1 text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400">
                <Waves className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{copy.setsNote}</span>
              </div>
            )}
          </div>
        )}
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
              {boatCopy ? boatCopy[trendKey] : copy[trendKey]}
            </div>
          )}
          <HourlyStrip hourly={points} nowHour={markerHour} language={language} copy={copy} boatCopy={boatCopy} wavePeriodS={wavePeriodS} />
        </div>
      )}
    </div>
  );
};
