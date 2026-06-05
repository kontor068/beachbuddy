import React from 'react';
import { Wind, Waves, Thermometer, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ExposureLevel } from '../utils/windExposure';
import { LanguageCode } from '../types';
import { calculateSeaConditionScore, getSeaExposureLevel } from '../utils/seaConditions';
import { getSelectedDayPrefix } from '../utils/dateLabels';
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

type ConditionCopy = {
  exposedToWind: string;
  openBeachCaution: (day: string) => string;
  betterSheltered: (day: string) => string;
  betterProtected: (day: string) => string;
  mayFeelBreezy: string;
  moreOpenToWind: string;
  roughSea: string;
  choppy: string;
  manageableSea: string;
  betterWindOption: string;
  great: (day: string) => string;
  veryGood: string;
  goodConditions: string;
  useCaution: string;
  notIdeal: (day: string) => string;
  seaConditionsCompact: string;
  seaConditionsTitle: (day: string) => string;
  windProtection: string;
  waveHeight: string;
  windSpeed: string;
  temperature: string;
};

const conditionCopy: Record<LanguageCode, ConditionCopy> = {
  en: {
    exposedToWind: 'Exposed to wind',
    openBeachCaution: (day) => `Open beach - use caution ${day}`,
    betterSheltered: (day) => `Better out of the wind ${day}`,
    betterProtected: (day) => `Better sheltered ${day}`,
    mayFeelBreezy: 'May feel breezy',
    moreOpenToWind: 'More open to wind',
    roughSea: 'Rough sea',
    choppy: 'Choppy',
    manageableSea: 'Manageable sea',
    betterWindOption: 'Better wind option',
    great: (day) => `Great ${day}`,
    veryGood: 'Very good',
    goodConditions: 'Good conditions',
    useCaution: 'Use caution',
    notIdeal: (day) => `Not ideal ${day}`,
    seaConditionsCompact: 'Sea Conditions',
    seaConditionsTitle: (day) => `Sea conditions ${day}`,
    windProtection: 'Wind Protection',
    waveHeight: 'Wave Height',
    windSpeed: 'Wind Speed',
    temperature: 'Temperature',
  },
  gr: {
    exposedToWind: 'Εκτεθειμένη στον άνεμο',
    openBeachCaution: (day) => `Ανοιχτή παραλία - ${day} θέλει προσοχή`,
    betterSheltered: (day) => `Πιο υπήνεμη ${day}`,
    betterProtected: (day) => `Πιο προστατευμένη ${day}`,
    mayFeelBreezy: 'Μπορεί να έχει αέρα',
    moreOpenToWind: 'Πιο ανοιχτή στον άνεμο',
    roughSea: 'Έντονος κυματισμός',
    choppy: 'Κυματισμός',
    manageableSea: 'Πιο ήπια θάλασσα',
    betterWindOption: 'Πιο υπήνεμη επιλογή',
    great: (day) => `Πολύ καλές ${day}`,
    veryGood: 'Πολύ καλές',
    goodConditions: 'Καλές συνθήκες',
    useCaution: 'Με προσοχή',
    notIdeal: (day) => `Όχι ιδανικές ${day}`,
    seaConditionsCompact: 'Θαλάσσιες Συνθήκες',
    seaConditionsTitle: (day) => `Θαλάσσιες συνθήκες ${day}`,
    windProtection: 'Προστασία Ανέμου',
    waveHeight: 'Ύψος Κύματος',
    windSpeed: 'Ταχύτητα Ανέμου',
    temperature: 'Θερμοκρασία',
  },
  fr: {
    exposedToWind: 'Exposée au vent',
    openBeachCaution: (day) => `Plage ouverte - prudence ${day}`,
    betterSheltered: (day) => `Plus à l'abri du vent ${day}`,
    betterProtected: (day) => `Plus abritée ${day}`,
    mayFeelBreezy: 'Peut être venteuse',
    moreOpenToWind: 'Plus ouverte au vent',
    roughSea: 'Mer agitée',
    choppy: 'Clapot',
    manageableSea: 'Mer praticable',
    betterWindOption: 'Option plus abritée',
    great: (day) => `Très bonnes ${day}`,
    veryGood: 'Très bonnes',
    goodConditions: 'Bonnes conditions',
    useCaution: 'Prudence',
    notIdeal: (day) => `Pas idéales ${day}`,
    seaConditionsCompact: 'Conditions de mer',
    seaConditionsTitle: (day) => `Conditions de mer ${day}`,
    windProtection: 'Protection du vent',
    waveHeight: 'Hauteur des vagues',
    windSpeed: 'Vitesse du vent',
    temperature: 'Température',
  },
  de: {
    exposedToWind: 'Windexponiert',
    openBeachCaution: (day) => `Offener Strand - Vorsicht ${day}`,
    betterSheltered: (day) => `Mehr aus dem Wind ${day}`,
    betterProtected: (day) => `Besser geschützt ${day}`,
    mayFeelBreezy: 'Kann windig wirken',
    moreOpenToWind: 'Offener zum Wind',
    roughSea: 'Raue See',
    choppy: 'Kabbelig',
    manageableSea: 'Gut machbare See',
    betterWindOption: 'Windgeschütztere Option',
    great: (day) => `Sehr gut ${day}`,
    veryGood: 'Sehr gut',
    goodConditions: 'Gute Bedingungen',
    useCaution: 'Vorsicht',
    notIdeal: (day) => `Nicht ideal ${day}`,
    seaConditionsCompact: 'Meeresbedingungen',
    seaConditionsTitle: (day) => `Meeresbedingungen ${day}`,
    windProtection: 'Windschutz',
    waveHeight: 'Wellenhöhe',
    windSpeed: 'Windgeschwindigkeit',
    temperature: 'Temperatur',
  },
  it: {
    exposedToWind: 'Esposta al vento',
    openBeachCaution: (day) => `Spiaggia aperta - prudenza ${day}`,
    betterSheltered: (day) => `Più riparata dal vento ${day}`,
    betterProtected: (day) => `Più protetta ${day}`,
    mayFeelBreezy: 'Può essere ventilata',
    moreOpenToWind: 'Più aperta al vento',
    roughSea: 'Mare mosso',
    choppy: 'Mare increspato',
    manageableSea: 'Mare gestibile',
    betterWindOption: 'Opzione più riparata',
    great: (day) => `Molto buone ${day}`,
    veryGood: 'Molto buone',
    goodConditions: 'Buone condizioni',
    useCaution: 'Prudenza',
    notIdeal: (day) => `Non ideali ${day}`,
    seaConditionsCompact: 'Condizioni mare',
    seaConditionsTitle: (day) => `Condizioni mare ${day}`,
    windProtection: 'Protezione dal vento',
    waveHeight: 'Altezza onde',
    windSpeed: 'Velocità vento',
    temperature: 'Temperatura',
  },
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
  const waveHeightLabel = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? `${waveHeightM.toFixed(1)} m`
    : null;
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const copy = getLocalizedCopy(language, conditionCopy);
  const exposureContextLabel = (() => {
    if (seaExposureLevel === 'exposed' && windBeaufort >= 5) {
      if (windBeaufort === 5) {
        return copy.exposedToWind;
      }
      return copy.openBeachCaution(day);
    }

    if (seaExposureLevel === 'protected') return copy.betterProtected(day);
    if (seaExposureLevel === 'partial') return windBeaufort >= 4 ? copy.betterSheltered(day) : copy.mayFeelBreezy;
    return windBeaufort >= 5 ? `${copy.exposedToWind} ${day}` : copy.moreOpenToWind;
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
    if (windBeaufort === 5 && seaExposureLevel !== 'exposed') return copy.betterWindOption;
    if (score >= 8) return compact ? copy.veryGood : copy.great(day);
    if (score >= 5) return windBeaufort < 4 ? copy.goodConditions : (windBeaufort === 5 ? copy.choppy : copy.useCaution);
    return copy.notIdeal(day);
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
      <div className={`flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border ${getScoreBorder(totalScore)}`}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${getScoreBg(totalScore)}`}>
          <Waves className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
            {copy.seaConditionsCompact}
          </span>
          <span className={`text-xs font-medium ${getScoreColor(totalScore)} leading-tight`}>
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
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
            {copy.seaConditionsTitle(getSelectedDayPrefix(selectedDate, new Date(), language))}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-heading font-bold ${getScoreColor(totalScore)}`}>
              {getScoreLabel(totalScore)}
            </span>
          </div>
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full text-white bg-gradient-to-br ${totalScore >= 8 ? 'from-emerald-400 to-emerald-600' : totalScore >= 5 ? 'from-amber-400 to-amber-600' : 'from-rose-400 to-rose-600'}`}>
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
