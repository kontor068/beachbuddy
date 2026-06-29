import React from 'react';
import { Wind, Waves, Thermometer, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ExposureLevel } from '../utils/windExposure';
import { LanguageCode } from '../types';
import { calculateSeaConditionScore, getSeaExposureLevel } from '../utils/seaConditions';
import { getSelectedDayPrefix, isSelectedDateToday } from '../utils/dateLabels';
import { getLocalizedCopy } from '../utils/i18n';
import { getBeaufortLevel } from '../utils/weatherUtils';

interface BeachConditionScoreProps {
  isExposed: boolean;
  windSpeed: number; // km/h
  waveHeightM?: number;
  temperature?: number;
  compact?: boolean;
  exposureLevel?: ExposureLevel;
  language?: LanguageCode;
  selectedDate?: Date;
  canClaimWindProtection?: boolean;
}

type DayLabel = (day: string, isToday: boolean) => string;

type ConditionCopy = {
  exposedToWind: string;
  openBeachCaution: DayLabel;
  betterSheltered: DayLabel;
  betterProtected: DayLabel;
  mayFeelBreezy: string;
  moreOpenToWind: string;
  roughSea: string;
  choppy: string;
  manageableSea: string;
  betterWindOption: string;
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
};

// Today's live conditions read as a clean present-tense phrase (no "σήμερα/today" stamp —
// it feels disconnected on something that shifts through the day); only a future selection
// appends the day word.
const dayLabel = (today: string, withDay: (day: string) => string): DayLabel =>
  (day, isToday) => (isToday ? today : withDay(day));

const conditionCopy: Record<LanguageCode, ConditionCopy> = {
  en: {
    exposedToWind: 'Exposed to wind',
    openBeachCaution: dayLabel('Open beach - use caution', (day) => `Open beach - use caution ${day}`),
    betterSheltered: dayLabel('Better out of the wind', (day) => `Better out of the wind ${day}`),
    betterProtected: dayLabel('Better sheltered', (day) => `Better sheltered ${day}`),
    mayFeelBreezy: 'May feel breezy',
    moreOpenToWind: 'More open to wind',
    roughSea: 'Rough sea',
    choppy: 'Choppy',
    manageableSea: 'Manageable sea',
    betterWindOption: 'Better wind option',
    great: dayLabel('Great', (day) => `Great ${day}`),
    veryGood: 'Very good',
    goodConditions: 'Good conditions',
    useCaution: 'Use caution',
    notIdealLight: dayLabel('OK, a little chop', (day) => `OK, a little chop ${day}`),
    notIdealModerate: dayLabel('OK, noticeable chop', (day) => `OK, noticeable chop ${day}`),
    notIdeal: dayLabel('Use caution', (day) => `Use caution ${day}`),
    seaConditionsCompact: 'Sea Conditions',
    seaConditionsTitle: dayLabel('Sea conditions', (day) => `Sea conditions ${day}`),
    windProtection: 'Wind Protection',
    waveHeight: 'Wave Height',
    windSpeed: 'Wind Speed',
    temperature: 'Temperature',
  },
  gr: {
    exposedToWind: 'Εκτεθειμένη στον άνεμο',
    openBeachCaution: dayLabel('Ανοιχτή παραλία - θέλει προσοχή', (day) => `Ανοιχτή παραλία - ${day} θέλει προσοχή`),
    betterSheltered: dayLabel('Πιο υπήνεμη', (day) => `Πιο υπήνεμη ${day}`),
    betterProtected: dayLabel('Πιο προστατευμένη', (day) => `Πιο προστατευμένη ${day}`),
    mayFeelBreezy: 'Μπορεί να έχει αέρα',
    moreOpenToWind: 'Πιο ανοιχτή στον άνεμο',
    roughSea: 'Έντονος κυματισμός',
    choppy: 'Κυματισμός',
    manageableSea: 'Πιο ήπια θάλασσα',
    betterWindOption: 'Πιο υπήνεμη επιλογή',
    great: dayLabel('Πολύ καλές', (day) => `Πολύ καλές ${day}`),
    veryGood: 'Πολύ καλές',
    goodConditions: 'Καλές συνθήκες',
    useCaution: 'Με προσοχή',
    notIdealLight: dayLabel('Εντάξει, με λίγο κύμα', (day) => `Εντάξει ${day}, με λίγο κύμα`),
    notIdealModerate: dayLabel('Εντάξει, με αρκετό κύμα', (day) => `Εντάξει ${day}, με αρκετό κύμα`),
    notIdeal: dayLabel('Θέλει προσοχή', (day) => `Θέλει προσοχή ${day}`),
    seaConditionsCompact: 'Θαλάσσιες Συνθήκες',
    seaConditionsTitle: dayLabel('Θαλάσσιες συνθήκες', (day) => `Θαλάσσιες συνθήκες ${day}`),
    windProtection: 'Προστασία Ανέμου',
    waveHeight: 'Ύψος Κύματος',
    windSpeed: 'Ταχύτητα Ανέμου',
    temperature: 'Θερμοκρασία',
  },
  fr: {
    exposedToWind: 'Exposée au vent',
    openBeachCaution: dayLabel('Plage ouverte - prudence', (day) => `Plage ouverte - prudence ${day}`),
    betterSheltered: dayLabel("Plus à l'abri du vent", (day) => `Plus à l'abri du vent ${day}`),
    betterProtected: dayLabel('Plus abritée', (day) => `Plus abritée ${day}`),
    mayFeelBreezy: 'Peut être venteuse',
    moreOpenToWind: 'Plus ouverte au vent',
    roughSea: 'Mer agitée',
    choppy: 'Clapot',
    manageableSea: 'Mer praticable',
    betterWindOption: 'Option plus abritée',
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
  },
  de: {
    exposedToWind: 'Windexponiert',
    openBeachCaution: dayLabel('Offener Strand - Vorsicht', (day) => `Offener Strand - Vorsicht ${day}`),
    betterSheltered: dayLabel('Mehr aus dem Wind', (day) => `Mehr aus dem Wind ${day}`),
    betterProtected: dayLabel('Besser geschützt', (day) => `Besser geschützt ${day}`),
    mayFeelBreezy: 'Kann windig wirken',
    moreOpenToWind: 'Offener zum Wind',
    roughSea: 'Raue See',
    choppy: 'Kabbelig',
    manageableSea: 'Gut machbare See',
    betterWindOption: 'Windgeschütztere Option',
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
  },
  it: {
    exposedToWind: 'Esposta al vento',
    openBeachCaution: dayLabel('Spiaggia aperta - prudenza', (day) => `Spiaggia aperta - prudenza ${day}`),
    betterSheltered: dayLabel('Più riparata dal vento', (day) => `Più riparata dal vento ${day}`),
    betterProtected: dayLabel('Più protetta', (day) => `Più protetta ${day}`),
    mayFeelBreezy: 'Può essere ventilata',
    moreOpenToWind: 'Più aperta al vento',
    roughSea: 'Mare mosso',
    choppy: 'Mare increspato',
    manageableSea: 'Mare gestibile',
    betterWindOption: 'Opzione più riparata',
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
  },
};

// The map pin colour is decided by wind-exposure band (see BeachMap getExposureMarkerTone),
// not by this widget's sea-comfort score — which is why a beach could read red here while its
// pin was yellow. Mirror the exact map bands so the headline conditions colour matches the pin:
// calm→green, mild/moderate (the map's yellow/orange) → amber, rough (the map's red) → rose.
const getConditionToneClasses = (level: ExposureLevel, beaufort: number) => {
  const isExposedBand = level === 'exposed';
  let band: 'calm' | 'amber' | 'rough';
  if (beaufort >= 7) band = 'rough';
  else if (beaufort >= 5) band = isExposedBand ? 'rough' : 'amber';
  else if (beaufort >= 4) band = isExposedBand ? 'amber' : 'amber';
  else if (beaufort >= 3) band = isExposedBand ? 'amber' : 'calm';
  else band = 'calm';

  if (band === 'rough') {
    return { text: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-100 dark:border-rose-900/30', gradient: 'from-rose-400 to-rose-600' };
  }
  if (band === 'calm') {
    return { text: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-100 dark:border-emerald-900/30', gradient: 'from-emerald-400 to-emerald-600' };
  }
  return { text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-100 dark:border-amber-900/30', gradient: 'from-amber-400 to-amber-600' };
};

export const BeachConditionScore: React.FC<BeachConditionScoreProps> = ({
  isExposed,
  windSpeed,
  waveHeightM,
  temperature = 25, // Default if not provided
  compact = false,
  exposureLevel,
  language = 'en',
  selectedDate,
  canClaimWindProtection = false
}) => {
  const rawSeaExposureLevel: ExposureLevel = getSeaExposureLevel(isExposed, exposureLevel);
  const seaExposureLevel: ExposureLevel = rawSeaExposureLevel === 'protected' && !canClaimWindProtection
    ? 'partial'
    : rawSeaExposureLevel;

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

  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    let measuredWaveScore = 10;
    if (waveHeightM >= 1.5) measuredWaveScore = 1;
    else if (waveHeightM >= 1.2) measuredWaveScore = 3;
    else if (waveHeightM >= 0.8) measuredWaveScore = 5;
    else if (waveHeightM >= 0.5) measuredWaveScore = 7;
    else if (waveHeightM >= 0.3) measuredWaveScore = 9;

    if (seaExposureLevel === 'protected') {
      waveScore = Math.min(waveScore, Math.max(measuredWaveScore, 6));
    } else if (seaExposureLevel === 'partial') {
      waveScore = Math.min(waveScore, Math.max(measuredWaveScore, 4));
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
  const totalScore = calculateSeaConditionScore(seaExposureLevel !== 'protected', windSpeed, seaExposureLevel, waveHeightM);
  const windBeaufort = getBeaufortLevel(windSpeed);
  // Headline colour follows the map pin's exposure band (not the raw sea score) so they agree.
  const conditionTone = getConditionToneClasses(seaExposureLevel, windBeaufort);
  const waveHeightLabel = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? `${waveHeightM.toFixed(1)} m`
    : null;
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const copy = getLocalizedCopy(language, conditionCopy);
  const exposureContextLabel = (() => {
    if (seaExposureLevel === 'exposed' && windBeaufort >= 5) {
      if (windBeaufort === 5) {
        return copy.exposedToWind;
      }
      return copy.openBeachCaution(day, isToday);
    }

    if (seaExposureLevel === 'protected') return copy.betterProtected(day, isToday);
    if (seaExposureLevel === 'partial') return windBeaufort >= 4 ? copy.betterSheltered(day, isToday) : copy.mayFeelBreezy;
    return windBeaufort >= 5 ? (isToday ? copy.exposedToWind : `${copy.exposedToWind} ${day}`) : copy.moreOpenToWind;
  })();
  const seaStateLabel = (() => {
    if (windBeaufort === 5) {
      if (seaExposureLevel === 'exposed') return copy.choppy;
      return undefined;
    }

    if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
      if (waveHeightM >= 1.2) return copy.roughSea;
      if (waveHeightM >= 0.8) return copy.choppy;
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
    const day = getSelectedDayPrefix(selectedDate, new Date(), language);
    if (seaStateLabel && (score < 8 || windBeaufort >= 5)) return seaStateLabel;
    // Reserve the clean "sheltered pick" headline for genuinely protected beaches.
    // A partly-sheltered beach at 5 Bft still gets wind/chop, so calling it the
    // "better wind option" misleads (and contradicts the difficult-day verdict);
    // let it fall through to the honest sea state instead.
    if (windBeaufort === 5 && seaExposureLevel === 'protected') return copy.betterWindOption;
    if (score >= 8) return compact ? copy.veryGood : copy.great(day, isToday);
    // 4 Bft is a moderate breeze — "Με προσοχή" overstates it, so a decent score reads
    // plainly as good conditions (matching the today badge, which is positive at ≤4 Bft).
    // Reserve "Με προσοχή" for genuinely strong wind (6+); 5 Bft stays the honest "Κυματισμός".
    if (score >= 5) return windBeaufort <= 4 ? copy.goodConditions : (windBeaufort === 5 ? copy.choppy : copy.useCaution);
    // Low sea score: light relative note at 3 vs 4 Bft; genuine caution only at ≥5 Bft.
    if (windBeaufort >= 5) return copy.notIdeal(day, isToday);
    if (windBeaufort === 4) return copy.notIdealModerate(day, isToday);
    return copy.notIdealLight(day, isToday);
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
      <div className={`flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border ${conditionTone.border}`}>
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
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-600 mb-1">
            {copy.seaConditionsTitle(getSelectedDayPrefix(selectedDate, new Date(), language), isToday)}
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
