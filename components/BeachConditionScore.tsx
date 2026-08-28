import React from 'react';
import { Wind, Waves, Thermometer, ShieldCheck, ShieldAlert, Ship } from 'lucide-react';
import { ExposureLevel } from '../utils/windExposure';
import { LanguageCode } from '../types';
import { calculateSeaConditionScore, getSeaExposureLevel } from '../utils/seaConditions';
import { seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } from '../utils/waveCharacter';
import { getSelectedDayPrefix, getSelectedHourPrefix, isSelectedDateToday } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';
import { getLocalizedCopy } from '../utils/i18n';
import { getBeaufortLevel } from '../utils/weatherUtils';
import { getBoatRideMotionLevel, type BoatRideMotionLevel } from '../utils/boatRideMotion';

interface BeachConditionScoreProps {
  isExposed: boolean;
  windSpeed: number; // km/h
  /** Display height (m) — what the user is shown. */
  waveHeightM?: number;
  /**
   * Decision-grade sea state (m) and its period, from BeachScore.seaStateWaveM /
   * seaStatePeriodS. `waveHeightM` above is rewritten by the cove guard, so the score, the
   * headline tone and the sea-state word must be driven from these instead. Omitted → falls
   * back to `waveHeightM`, i.e. exactly today's behaviour.
   */
  seaStateWaveM?: number;
  seaStatePeriodS?: number;
  temperature?: number;
  compact?: boolean;
  exposureLevel?: ExposureLevel;
  language?: LanguageCode;
  selectedDate?: Date;
  selectedHour?: number;
  canClaimWindProtection?: boolean;
  boatAccess?: boolean;
  /** True when a geometric direct swell breaks on this beach (from the ranking's direct_swell
   *  warning); drops the protected/partial wave floor so the displayed sea score/icon matches
   *  how the ranking already scores it. */
  directSwell?: boolean;
  /** This is an enclosed bay (όρμος) AND today's wind is genuinely blocked — same gate as
   *  ProtectedBeachMarker's cove pill (enclosedCove && isProtectedToday). Prints the one-line
   *  "why calmer than the open-sea reading" fact right under the wave/wind summary, where it
   *  used to live as a standalone caption under the map's colour legend (moved 05/08/2026 —
   *  the map now only carries the pin's own badge, not a prose explanation of it). */
  enclosedCove?: boolean;
}

type DayLabel = (day: string, isToday: boolean) => string;

type ConditionCopy = {
  exposedToWind: DayLabel;
  openBeachCaution: DayLabel;
  betterSheltered: DayLabel;
  betterProtected: DayLabel;
  mayFeelBreezy: string;
  moreOpenToWind: string;
  roughSea: string;
  choppy: string;
  manageableSea: string;
  betterWindOption: DayLabel;
  great: DayLabel;
  veryGood: string;
  goodConditions: string;
  useCaution: string;
  // Low sea-comfort score: a relative note at light/moderate wind (3 Bft → "λίγο κύμα",
  // 4 Bft → "αρκετό κύμα"), but genuine caution at ≥5 Bft via `notIdeal`.
  notIdealLight: DayLabel;
  notIdealModerate: DayLabel;
  notIdeal: DayLabel;
  seaConditionsCompact: string;
  seaConditionsTitle: DayLabel;
  windProtection: string;
  waveHeight: string;
  windSpeed: string;
  temperature: string;
  enclosedCoveNote: string;
};

// Today's live conditions read as a clean present-tense phrase (no "σήμερα/today" stamp —
// it feels disconnected on something that shifts through the day); only a future selection
// appends the day word.
const dayLabel = (today: string, withDay: (day: string) => string): DayLabel =>
  (day, isToday) => (isToday ? today : withDay(day));

const conditionCopy: Record<LanguageCode, ConditionCopy> = {
  en: {
    exposedToWind: dayLabel('More exposed to wind', (day) => `More exposed to wind ${day}`),
    openBeachCaution: dayLabel('Exposed beach - use caution', (day) => `Exposed beach - use caution ${day}`),
    betterSheltered: dayLabel('Partial shelter', (day) => `Partial shelter ${day}`),
    betterProtected: dayLabel('Better sheltered', (day) => `Better sheltered ${day}`),
    mayFeelBreezy: 'May feel breezy',
    moreOpenToWind: 'A bit exposed',
    roughSea: 'Rough sea',
    choppy: 'Choppy',
    manageableSea: 'Manageable sea',
    betterWindOption: dayLabel('More sheltered option', (day) => `More sheltered option ${day}`),
    great: dayLabel('Great', (day) => `Great ${day}`),
    veryGood: 'Very good',
    goodConditions: 'Good conditions',
    useCaution: 'Use caution',
    notIdealLight: dayLabel('Manageable, a little chop', (day) => `Manageable ${day}, a little chop`),
    notIdealModerate: dayLabel('Manageable, noticeable chop', (day) => `Manageable ${day}, noticeable chop`),
    notIdeal: dayLabel('Use caution', (day) => `Use caution ${day}`),
    seaConditionsCompact: 'Sea Conditions',
    seaConditionsTitle: dayLabel('Sea conditions', (day) => `Sea conditions ${day}`),
    windProtection: 'Wind Protection',
    waveHeight: 'Wave Height',
    windSpeed: 'Wind Speed',
    temperature: 'Temperature',
    enclosedCoveNote: 'Enclosed bay — calmer than the open sea reading',
  },
  gr: {
    exposedToWind: dayLabel('Πιο εκτεθειμένη στον άνεμο', (day) => `Πιο εκτεθειμένη στον άνεμο ${day}`),
    openBeachCaution: dayLabel('Εκτεθειμένη παραλία - θέλει προσοχή', (day) => `Εκτεθειμένη παραλία - ${day} θέλει προσοχή`),
    betterSheltered: dayLabel('Μερική προστασία', (day) => `Μερική προστασία ${day}`),
    betterProtected: dayLabel('Πιο προστατευμένη', (day) => `Πιο προστατευμένη ${day}`),
    mayFeelBreezy: 'Μπορεί να έχει αέρα',
    moreOpenToWind: 'Λίγο εκτεθειμένη στον άνεμο',
    roughSea: 'Έντονος κυματισμός',
    choppy: 'Κυματισμός',
    manageableSea: 'Πιο ήπια θάλασσα',
    betterWindOption: dayLabel('Πιο προστατευμένη επιλογή', (day) => `Πιο προστατευμένη επιλογή ${day}`),
    great: dayLabel('Πολύ καλές', (day) => `Πολύ καλές ${day}`),
    veryGood: 'Πολύ καλές',
    goodConditions: 'Καλές συνθήκες',
    useCaution: 'Με προσοχή',
    notIdealLight: dayLabel('Διαχειρίσιμη, με λίγο κύμα', (day) => `Διαχειρίσιμη ${day}, με λίγο κύμα`),
    notIdealModerate: dayLabel('Διαχειρίσιμη, με αρκετό κύμα', (day) => `Διαχειρίσιμη ${day}, με αρκετό κύμα`),
    notIdeal: dayLabel('Θέλει προσοχή', (day) => `Θέλει προσοχή ${day}`),
    seaConditionsCompact: 'Θαλάσσιες Συνθήκες',
    seaConditionsTitle: dayLabel('Θαλάσσιες συνθήκες', (day) => `Θαλάσσιες συνθήκες ${day}`),
    windProtection: 'Προστασία Ανέμου',
    waveHeight: 'Ύψος Κύματος',
    windSpeed: 'Ταχύτητα Ανέμου',
    temperature: 'Θερμοκρασία',
    enclosedCoveNote: 'Κλειστός όρμος — πιο ήρεμο νερό απ’ ό,τι δείχνει η ανοιχτή θάλασσα',
  },
  fr: {
    exposedToWind: dayLabel('Plus exposée au vent', (day) => `Plus exposée au vent ${day}`),
    openBeachCaution: dayLabel('Plage ouverte - prudence', (day) => `Plage ouverte - prudence ${day}`),
    betterSheltered: dayLabel("Plus à l'abri du vent", (day) => `Plus à l'abri du vent ${day}`),
    betterProtected: dayLabel('Plus abritée', (day) => `Plus abritée ${day}`),
    mayFeelBreezy: 'Peut être venteuse',
    moreOpenToWind: 'Plus ouverte au vent',
    roughSea: 'Mer agitée',
    choppy: 'Clapot',
    manageableSea: 'Mer praticable',
    betterWindOption: dayLabel('Option plus abritée', (day) => `Option plus abritée ${day}`),
    great: dayLabel('Très bonnes', (day) => `Très bonnes ${day}`),
    veryGood: 'Très bonnes',
    goodConditions: 'Bonnes conditions',
    useCaution: 'Prudence',
    notIdealLight: dayLabel('Correct, un peu de clapot', (day) => `Correct ${day}, un peu de clapot`),
    notIdealModerate: dayLabel('Correct, clapot marqué', (day) => `Correct ${day}, clapot marqué`),
    notIdeal: dayLabel('Prudence', (day) => `Prudence ${day}`),
    seaConditionsCompact: 'Conditions de mer',
    seaConditionsTitle: dayLabel('Conditions de mer', (day) => `Conditions de mer ${day}`),
    windProtection: 'Protection du vent',
    waveHeight: 'Hauteur des vagues',
    windSpeed: 'Vitesse du vent',
    temperature: 'Température',
    enclosedCoveNote: 'Baie fermée — plus calme que la mesure du large',
  },
  de: {
    exposedToWind: dayLabel('Windexponiert', (day) => `Windexponiert ${day}`),
    openBeachCaution: dayLabel('Offener Strand - Vorsicht', (day) => `Offener Strand - Vorsicht ${day}`),
    betterSheltered: dayLabel('Mehr aus dem Wind', (day) => `Mehr aus dem Wind ${day}`),
    betterProtected: dayLabel('Besser geschützt', (day) => `Besser geschützt ${day}`),
    mayFeelBreezy: 'Kann windig wirken',
    moreOpenToWind: 'Offener zum Wind',
    roughSea: 'Raue See',
    choppy: 'Kabbelig',
    manageableSea: 'Gut machbare See',
    betterWindOption: dayLabel('Windgeschütztere Option', (day) => `Windgeschütztere Option ${day}`),
    great: dayLabel('Sehr gut', (day) => `Sehr gut ${day}`),
    veryGood: 'Sehr gut',
    goodConditions: 'Gute Bedingungen',
    useCaution: 'Vorsicht',
    notIdealLight: dayLabel('OK, etwas Welle', (day) => `OK ${day}, etwas Welle`),
    notIdealModerate: dayLabel('OK, spürbare Welle', (day) => `OK ${day}, spürbare Welle`),
    notIdeal: dayLabel('Vorsicht', (day) => `Vorsicht ${day}`),
    seaConditionsCompact: 'Meeresbedingungen',
    seaConditionsTitle: dayLabel('Meeresbedingungen', (day) => `Meeresbedingungen ${day}`),
    windProtection: 'Windschutz',
    waveHeight: 'Wellenhöhe',
    windSpeed: 'Windgeschwindigkeit',
    temperature: 'Temperatur',
    enclosedCoveNote: 'Geschlossene Bucht — ruhiger als die Messung auf offener See',
  },
  it: {
    exposedToWind: dayLabel('Più esposta al vento', (day) => `Più esposta al vento ${day}`),
    openBeachCaution: dayLabel('Spiaggia aperta - prudenza', (day) => `Spiaggia aperta - prudenza ${day}`),
    betterSheltered: dayLabel('Più riparata dal vento', (day) => `Più riparata dal vento ${day}`),
    betterProtected: dayLabel('Più protetta', (day) => `Più protetta ${day}`),
    mayFeelBreezy: 'Può essere ventilata',
    moreOpenToWind: 'Più aperta al vento',
    roughSea: 'Mare mosso',
    choppy: 'Mare increspato',
    manageableSea: 'Mare gestibile',
    betterWindOption: dayLabel('Opzione più riparata', (day) => `Opzione più riparata ${day}`),
    great: dayLabel('Molto buone', (day) => `Molto buone ${day}`),
    veryGood: 'Molto buone',
    goodConditions: 'Buone condizioni',
    useCaution: 'Prudenza',
    notIdealLight: dayLabel("Ok, un po' di onda", (day) => `Ok ${day}, un po' di onda`),
    notIdealModerate: dayLabel('Ok, onda moderata', (day) => `Ok ${day}, onda moderata`),
    notIdeal: dayLabel('Prudenza', (day) => `Prudenza ${day}`),
    seaConditionsCompact: 'Condizioni mare',
    seaConditionsTitle: dayLabel('Condizioni mare', (day) => `Condizioni mare ${day}`),
    windProtection: 'Protezione dal vento',
    waveHeight: 'Altezza onde',
    windSpeed: 'Velocità vento',
    temperature: 'Temperatura',
    enclosedCoveNote: 'Baia chiusa — più calma di quanto indichi il mare aperto',
  },
};

// The map pin colour is decided by wind-exposure band (see BeachMap getExposureMarkerTone),
// not by this widget's sea-comfort score — which is why a beach could read red here while its
// pin was yellow. Mirror the exact map bands so the headline conditions colour matches the pin:
// calm→green, mild/moderate (the map's yellow/orange) → amber, rough (the map's red) → rose.
const getConditionToneClasses = (level: ExposureLevel, beaufort: number, seaStateM?: number) => {
  const isExposedBand = level === 'exposed';
  let band: 'calm' | 'amber' | 'rough';
  if (beaufort >= 7) band = 'rough';
  else if (beaufort >= 5) band = isExposedBand ? 'rough' : 'amber';
  else if (beaufort >= 4) band = isExposedBand ? 'amber' : 'amber';
  else if (beaufort >= 3) band = isExposedBand ? 'amber' : 'calm';
  else band = 'calm';

  // A real measured wave (including low-wind swell) escalates the headline colour, so the pill can't
  // stay green while the panel text + wave glyph read choppy/rough. Mirrors the seaState/waveScale steps.
  if (typeof seaStateM === 'number' && Number.isFinite(seaStateM)) {
    if (seaStateM >= SEA_STATE_ROUGH_M) band = 'rough';
    else if (seaStateM >= SEA_STATE_AMBER_M && band === 'calm') band = 'amber';
  }

  if (band === 'rough') {
    return { text: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-100 dark:border-rose-900/30', gradient: 'from-rose-400 to-rose-600' };
  }
  if (band === 'calm') {
    return { text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-100 dark:border-emerald-900/30', gradient: 'from-emerald-400 to-emerald-600' };
  }
  return { text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-100 dark:border-amber-900/30', gradient: 'from-amber-400 to-amber-600' };
};

const getBoatConditionToneClasses = (level: BoatRideMotionLevel) => {
  switch (level) {
    case 'rough':
      return { text: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-100 dark:border-rose-900/30', gradient: 'from-rose-400 to-rose-600' };
    case 'bumpy':
      return { text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-100 dark:border-amber-900/30', gradient: 'from-amber-400 to-amber-600' };
    case 'light':
      return { text: 'text-cyan-500', bg: 'bg-cyan-500', border: 'border-cyan-100 dark:border-cyan-900/30', gradient: 'from-cyan-400 to-cyan-600' };
    case 'smooth':
    default:
      return { text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-100 dark:border-emerald-900/30', gradient: 'from-emerald-400 to-emerald-600' };
  }
};

const getBoatConditionCopy = (level: BoatRideMotionLevel, language: LanguageCode) => {
  const copy = {
    en: {
      title: 'Ride',
      label: { smooth: 'Ideal conditions', light: 'A little motion', bumpy: 'Bumpy ride', rough: 'Very bumpy' },
    },
    gr: {
      title: 'Διαδρομή',
      label: { smooth: 'Ιδανικές συνθήκες', light: 'Λίγο κούνημα', bumpy: 'Κουνάει αρκετά', rough: 'Πολύ κούνημα' },
    },
    fr: {
      title: 'Trajet',
      label: { smooth: 'Conditions idéales', light: 'Un peu de mouvement', bumpy: 'Trajet agité', rough: 'Très agité' },
    },
    de: {
      title: 'Fahrt',
      label: { smooth: 'Ideale Bedingungen', light: 'Etwas Bewegung', bumpy: 'Unruhige Fahrt', rough: 'Sehr unruhig' },
    },
    it: {
      title: 'Tragitto',
      label: { smooth: 'Condizioni ideali', light: 'Un po’ di movimento', bumpy: 'Tragitto mosso', rough: 'Molto mosso' },
    },
  }[language];

  return { title: copy.title, label: copy.label[level] };
};

export const BeachConditionScore: React.FC<BeachConditionScoreProps> = ({
  isExposed,
  windSpeed,
  waveHeightM,
  seaStateWaveM,
  seaStatePeriodS,
  temperature = 25, // Default if not provided
  compact = false,
  exposureLevel,
  language = 'en',
  selectedDate,
  selectedHour,
  canClaimWindProtection = false,
  boatAccess = false,
  directSwell = false,
  enclosedCove = false
}) => {
  const rawSeaExposureLevel: ExposureLevel = getSeaExposureLevel(isExposed, exposureLevel);
  const seaExposureLevel: ExposureLevel = rawSeaExposureLevel === 'protected' && !canClaimWindProtection
    ? 'partial'
    : rawSeaExposureLevel;

  // One sea-state number for every judgement below, so the wave row's icon, the headline tone
  // and the sea-state word cannot disagree with each other or with the shared scorer.
  const decisionWaveM = seaStateWaveM ?? waveHeightM;
  const severityM = seaStateSeverityM(decisionWaveM, seaStatePeriodS) ?? decisionWaveM;

  // Calculate individual scores (0-10). The main sea score should reflect swimming water comfort,
  // so protected beaches are not heavily penalized for general wind or cool air temperature.
  let protectionScore = 10;
  if (seaExposureLevel === 'exposed') {
    protectionScore = 2;
  } else if (seaExposureLevel === 'partial') {
    protectionScore = 7;
  }
  
  let windScore = 10;
  if (seaExposureLevel === 'protected') {
    if (windSpeed > 45) windScore = 5;
    else if (windSpeed > 35) windScore = 6;
    else if (windSpeed > 25) windScore = 8;
  } else if (seaExposureLevel === 'partial') {
    if (windSpeed > 35) windScore = 4;
    else if (windSpeed > 25) windScore = 6;
    else if (windSpeed > 15) windScore = 8;
  } else {
    if (windSpeed > 30) windScore = 2;
    else if (windSpeed > 20) windScore = 4;
    else if (windSpeed > 10) windScore = 6;
    else windScore = 9;
  }

  let waveScore = 10;
  if (seaExposureLevel === 'protected') {
    if (windSpeed > 40) waveScore = 7;
    else if (windSpeed > 30) waveScore = 8;
  } else if (seaExposureLevel === 'partial') {
    if (windSpeed > 35) waveScore = 5;
    else if (windSpeed > 25) waveScore = 6;
    else if (windSpeed > 15) waveScore = 8;
    else waveScore = 9;
  } else {
    if (windSpeed > 25) waveScore = 2;
    else if (windSpeed > 15) waveScore = 4;
    else if (windSpeed > 10) waveScore = 6;
    else waveScore = 9;
  }

  if (typeof severityM === 'number' && Number.isFinite(severityM)) {
    let measuredWaveScore = 10;
    if (severityM >= 1.5) measuredWaveScore = 1;
    else if (severityM >= 1.2) measuredWaveScore = 3;
    else if (severityM >= 0.8) measuredWaveScore = 5;
    else if (severityM >= 0.5) measuredWaveScore = 7;
    else if (severityM >= 0.3) measuredWaveScore = 9;

    if (seaExposureLevel === 'protected') {
      waveScore = Math.min(waveScore, directSwell ? measuredWaveScore : Math.max(measuredWaveScore, 6));
    } else if (seaExposureLevel === 'partial') {
      waveScore = Math.min(waveScore, directSwell ? measuredWaveScore : Math.max(measuredWaveScore, 4));
    } else {
      waveScore = Math.min(waveScore, measuredWaveScore);
    }
  }

  let tempScore = 10;
  if (temperature < 18) tempScore = 4;
  else if (temperature < 22) tempScore = 6;
  else if (temperature > 35) tempScore = 6;
  else if (temperature >= 24 && temperature <= 30) tempScore = 10;
  else tempScore = 8;

  // Sea score: protection and waves dominate; air temperature remains visible below as context.
  const totalScore = calculateSeaConditionScore(seaExposureLevel !== 'protected', windSpeed, seaExposureLevel, decisionWaveM, directSwell, seaStatePeriodS);
  const windBeaufort = getBeaufortLevel(windSpeed);
  // Headline colour follows the map pin's exposure band (not the raw sea score) so they agree.
  const conditionTone = getConditionToneClasses(seaExposureLevel, windBeaufort, severityM);
  const waveHeightLabel = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? `${waveHeightM.toFixed(1)} m`
    : null;
  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, athensNow(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const useCurrentPhrase = isToday && !hour;
  const copy = getLocalizedCopy(language, conditionCopy);

  if (boatAccess) {
    const boatLevel = getBoatRideMotionLevel(waveHeightM, windBeaufort);
    const boatTone = getBoatConditionToneClasses(boatLevel);
    const boatCopy = getBoatConditionCopy(boatLevel, language);
    const waveHeightLabel = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
      ? `${waveHeightM.toFixed(1)} m`
      : null;

    if (compact) {
      return (
        <div className={`flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-control border ${boatTone.border}`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${boatTone.bg}`}>
            <Ship className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
              {boatCopy.title}
            </span>
            <span className={`text-xs font-medium ${boatTone.text} leading-tight`}>
              {[boatCopy.label, waveHeightLabel].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-slate-800 rounded-control p-4 shadow-surface border border-line dark:border-slate-700">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-line dark:border-slate-700">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-600 mb-1">{boatCopy.title}</h3>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-heading font-bold ${boatTone.text}`}>{boatCopy.label}</span>
            </div>
          </div>
          <div className={`flex items-center justify-center w-12 h-12 rounded-full text-white bg-gradient-to-br ${boatTone.gradient}`}>
            <Ship className="w-6 h-6" />
          </div>
        </div>
      </div>
    );
  }

  const exposureContextLabel = (() => {
    if (seaExposureLevel === 'exposed' && windBeaufort >= 5) {
      if (windBeaufort === 5) {
        return copy.exposedToWind(day, useCurrentPhrase);
      }
      return copy.openBeachCaution(day, useCurrentPhrase);
    }

    if (seaExposureLevel === 'protected') return copy.betterProtected(day, useCurrentPhrase);
    if (seaExposureLevel === 'partial') return windBeaufort >= 4 ? copy.betterSheltered(day, useCurrentPhrase) : copy.mayFeelBreezy;
    return windBeaufort >= 5 ? copy.exposedToWind(day, useCurrentPhrase) : copy.moreOpenToWind;
  })();
  const seaStateLabel = (() => {
    // Strong wind (≥5 Bft — meltemi territory): the sea state is never "calmer", even on a
    // genuinely sheltered beach — it still gets real chop. Keep it honest (the shelter credit
    // lives in the suitability badge, not in the sea-state label).
    if (windBeaufort >= 5) {
      if (typeof severityM === 'number' && Number.isFinite(severityM) && severityM >= SEA_STATE_ROUGH_M) return copy.roughSea;
      return copy.choppy;
    }

    if (typeof severityM === 'number' && Number.isFinite(severityM)) {
      if (severityM >= SEA_STATE_ROUGH_M) return copy.roughSea;
      if (severityM >= SEA_STATE_AMBER_M) return copy.choppy;
      return copy.manageableSea;
    }
    return undefined;
  })();
  
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-500';
    if (score >= 5) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-emerald-500';
    if (score >= 5) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getScoreBorder = (score: number) => {
    if (score >= 8) return 'border-emerald-100 dark:border-emerald-900/30';
    if (score >= 5) return 'border-amber-100 dark:border-amber-900/30';
    return 'border-rose-100 dark:border-rose-900/30';
  };

  const getScoreLabel = (score: number) => {
    if (seaStateLabel && (score < 8 || windBeaufort >= 5)) return seaStateLabel;
    // Reserve the clean "sheltered pick" headline for genuinely protected beaches.
    // A partly-sheltered beach at 5 Bft still gets wind/chop, so calling it the
    // "better wind option" misleads (and contradicts the difficult-day verdict);
    // let it fall through to the honest sea state instead.
    if (windBeaufort === 5 && seaExposureLevel === 'protected') return copy.betterWindOption(day, useCurrentPhrase);
    if (score >= 8) return compact ? copy.veryGood : copy.great(day, useCurrentPhrase);
    // 4 Bft is a moderate breeze — "Με προσοχή" overstates it, so a decent score reads
    // plainly as good conditions (matching the today badge, which is positive at ≤4 Bft).
    // Reserve "Με προσοχή" for genuinely strong wind (6+); 5 Bft stays the honest "Κυματισμός".
    if (score >= 5) return windBeaufort <= 4 ? copy.goodConditions : (windBeaufort === 5 ? copy.choppy : copy.useCaution);
    // Low sea score: light relative note at 3 vs 4 Bft; genuine caution only at ≥5 Bft.
    if (windBeaufort >= 5) return copy.notIdeal(day, useCurrentPhrase);
    if (windBeaufort === 4) return copy.notIdealModerate(day, useCurrentPhrase);
    return copy.notIdealLight(day, useCurrentPhrase);
  };

  const getIndicatorIcon = (score: number) => {
    if (score >= 8) return '🟢';
    if (score >= 5) return '🟡';
    return '🔴';
  };

  const compactConditionParts = [
    getScoreLabel(totalScore),
    exposureContextLabel,
    waveHeightLabel,
  ].filter(Boolean);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-control border ${conditionTone.border}`}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${conditionTone.bg}`}>
          <Waves className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
            {copy.seaConditionsCompact}
          </span>
          <span className={`text-xs font-medium ${conditionTone.text} leading-tight`}>
            {compactConditionParts.join(' · ')}
          </span>
          {/* The fact about the bay's shape, not a verdict about today — sits right under the
              same wind/wave line it explains, instead of as a separate caption under the map's
              colour legend (moved here 05/08/2026). */}
          {enclosedCove && (
            <span className="text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
              {copy.enclosedCoveNote}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-control p-4 shadow-surface border border-line dark:border-slate-700">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-line dark:border-slate-700">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-600 mb-1">
            {copy.seaConditionsTitle(day, useCurrentPhrase)}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-heading font-bold ${conditionTone.text}`}>
              {getScoreLabel(totalScore)}
            </span>
          </div>
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full text-white bg-gradient-to-br ${conditionTone.gradient}`}>
          <Waves className="w-6 h-6" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            {seaExposureLevel === 'exposed' ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            <span className="text-sm font-medium">{copy.windProtection}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(protectionScore)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Waves className="w-4 h-4" />
            <span className="text-sm font-medium">{copy.waveHeight}</span>
          </div>
          <span className="text-sm">{waveHeightLabel ? `${waveHeightLabel} ${getIndicatorIcon(waveScore)}` : getIndicatorIcon(waveScore)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Wind className="w-4 h-4" />
            <span className="text-sm font-medium">{copy.windSpeed}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(windScore)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Thermometer className="w-4 h-4" />
            <span className="text-sm font-medium">{copy.temperature}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(tempScore)}</span>
        </div>
      </div>
    </div>
  );
};
