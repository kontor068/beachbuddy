import React from 'react';
import { Wind, Waves, Thermometer, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ExposureLevel } from '../utils/windExposure';
import { LanguageCode } from '../types';
import { calculateSeaConditionScore, getSeaExposureLevel } from '../utils/seaConditions';

interface BeachConditionScoreProps {
  isExposed: boolean;
  windSpeed: number; // km/h
  temperature?: number;
  compact?: boolean;
  exposureLevel?: ExposureLevel;
  language?: LanguageCode;
}

export const BeachConditionScore: React.FC<BeachConditionScoreProps> = ({
  isExposed,
  windSpeed,
  temperature = 25, // Default if not provided
  compact = false,
  exposureLevel,
  language = 'en'
}) => {
  const seaExposureLevel: ExposureLevel = getSeaExposureLevel(isExposed, exposureLevel);

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

  let tempScore = 10;
  if (temperature < 18) tempScore = 4;
  else if (temperature < 22) tempScore = 6;
  else if (temperature > 35) tempScore = 6;
  else if (temperature >= 24 && temperature <= 30) tempScore = 10;
  else tempScore = 8;

  // Sea score: protection and waves dominate; air temperature remains visible below as context.
  const totalScore = calculateSeaConditionScore(isExposed, windSpeed, exposureLevel);
  
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
    if (language === 'gr') {
      if (score >= 8) return 'Εξαιρετικές';
      if (score >= 5) return 'Μέτριες';
      return 'Κακές';
    }
    if (score >= 8) return 'Excellent';
    if (score >= 5) return 'Moderate';
    return 'Poor';
  };

  const getIndicatorIcon = (score: number) => {
    if (score >= 8) return '🟢';
    if (score >= 5) return '🟡';
    return '🔴';
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border ${getScoreBorder(totalScore)}`}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white ${getScoreBg(totalScore)}`}>
          <Waves className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">
            {language === 'gr' ? 'Θαλάσσιες Συνθήκες' : 'Sea Conditions'}
          </span>
          <span className={`text-xs font-medium ${getScoreColor(totalScore)} leading-tight`}>
            {getScoreLabel(totalScore)}
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
            {language === 'gr' ? 'Θαλάσσιες Συνθήκες Σήμερα' : 'Sea Conditions Today'}
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
            {isExposed ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            <span className="text-sm font-medium">{language === 'gr' ? 'Προστασία Ανέμου' : 'Wind Protection'}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(protectionScore)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Waves className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'gr' ? 'Ύψος Κύματος' : 'Wave Height'}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(waveScore)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Wind className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'gr' ? 'Ταχύτητα Ανέμου' : 'Wind Speed'}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(windScore)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Thermometer className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'gr' ? 'Θερμοκρασία' : 'Temperature'}</span>
          </div>
          <span className="text-sm">{getIndicatorIcon(tempScore)}</span>
        </div>
      </div>
    </div>
  );
};
