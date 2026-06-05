
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Wind, Thermometer, Clock, Droplets } from 'lucide-react';
import { WeatherData, WindDirection, LanguageCode, WindUnit, DailyForecast } from '../types';
import { getLocalizedCopy } from '../utils/i18n';

interface WindInfoProps {
  weather: WeatherData | DailyForecast;
  windDirection: WindDirection;
  t: any; // Translation object
  lastUpdated: Date | null;
  onRefresh: () => void;
  isLoading: boolean;
  language: LanguageCode;
  isUsingMockData: boolean;
  error: string | null;
  windUnit: WindUnit;
  onWindUnitChange: (unit: WindUnit) => void;
  isToday: boolean;
  isWinter: boolean;
}

const Compass: React.FC<{ deg: number; language: LanguageCode }> = ({ deg, language }) => {
  const labels = getLocalizedCopy(language, {
    en: { north: 'n', south: 's', east: 'e', west: 'w' },
    gr: { north: 'β', south: 'ν', east: 'α', west: 'δ' },
    fr: { north: 'n', south: 's', east: 'e', west: 'o' },
    de: { north: 'n', south: 's', east: 'o', west: 'w' },
    it: { north: 'n', south: 's', east: 'e', west: 'o' },
  });

  return (
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0" aria-label="Wind compass">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Soft outer ring */}
        <circle cx="50" cy="50" r="46" fill="none" stroke="url(#compassGrad)" strokeWidth="1.5" opacity="0.4" />
        <defs>
          <linearGradient id="compassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>

        {/* Minimal degree markers */}
        {[0, 90, 180, 270].map((angle) => (
          <line
            key={angle}
            x1="50" y1="8" x2="50" y2="14"
            transform={`rotate(${angle} 50 50)`}
            stroke="#0EA5E9"
            strokeWidth="1.5"
            opacity="0.3"
          />
        ))}

        {/* Cardinal directions */}
        <text x="50" y="24" textAnchor="middle" fontSize="9" className="fill-sky-400 dark:fill-sky-500" fontWeight="600" fontFamily="Outfit">{labels.north}</text>
        <text x="50" y="82" textAnchor="middle" fontSize="9" className="fill-sky-300 dark:fill-sky-600" fontWeight="600" fontFamily="Outfit">{labels.south}</text>
        <text x="78" y="54" textAnchor="middle" fontSize="9" className="fill-sky-300 dark:fill-sky-600" fontWeight="600" fontFamily="Outfit">{labels.east}</text>
        <text x="22" y="54" textAnchor="middle" fontSize="9" className="fill-sky-300 dark:fill-sky-600" fontWeight="600" fontFamily="Outfit">{labels.west}</text>
      </svg>

      {/* Rotating Needle */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: deg }}
        transition={{ type: "spring", stiffness: 50, damping: 15 }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d="M50 18 L47 50 L50 53 L53 50 Z" fill="#0EA5E9" opacity="0.9" />
          <path d="M50 82 L47 50 L50 47 L53 50 Z" fill="currentColor" className="text-slate-300 dark:text-slate-600" />
          <circle cx="50" cy="50" r="3" fill="white" stroke="#0EA5E9" strokeWidth="1" />
        </svg>
      </motion.div>
    </div>
  );
};

const getRelativeTime = (date: Date, t: any): string => {
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (!t.relativeTime) return '';

  if (seconds < 60) return t.relativeTime.now;
  if (minutes === 1) return t.relativeTime.minuteAgo;
  if (minutes < 60) return t.relativeTime.minutesAgo(minutes);
  if (hours === 1) return t.relativeTime.hourAgo;
  if (hours < 24) return t.relativeTime.hoursAgo(hours);
  if (days === 1) return t.relativeTime.yesterday;
  return t.relativeTime.daysAgo(days);
};

const useRelativeTime = (date: Date | null, t: any) => {
  const [relativeTime, setRelativeTime] = useState('');

  useEffect(() => {
    if (!date) {
      setRelativeTime('');
      return;
    }

    const update = () => {
      setRelativeTime(getRelativeTime(date, t));
    };

    update();
    const intervalId = setInterval(update, 60000); // Update every minute

    return () => clearInterval(intervalId);
  }, [date, t]);

  return relativeTime;
};


export const WindInfo: React.FC<WindInfoProps> = ({ weather, windDirection, t, lastUpdated, onRefresh, isLoading, language, windUnit, onWindUnitChange, isToday, isWinter }) => {
  const windSpeedKmph = (weather.wind.speed * 3.6).toFixed(1);
  const windSpeedMph = (weather.wind.speed * 2.23694).toFixed(1);
  const relativeTime = useRelativeTime(lastUpdated, t);
  const iconUrl = `https://openweathermap.org/img/wn/${weather.weather.icon}@2x.png`;
  const dayFormatter = new Intl.DateTimeFormat(t.locale, { weekday: 'long' });
  const selectedDate = 'date' in weather ? weather.date : new Date();

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-white/80 via-sky-50/40 to-cyan-50/30 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-sky-950/40 backdrop-blur-md rounded-3xl p-4 sm:p-5 md:p-6 border border-white/50 dark:border-slate-800/50">
      {/* Subtle decorative blob */}
      <div className="absolute -top-20 -right-20 w-44 h-44 bg-sky-200/20 dark:bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row gap-5 items-center relative z-10">
        {/* Left: Compass */}
        <div className="flex flex-row lg:flex-col items-center gap-3 lg:w-40 lg:shrink-0">
          <Compass deg={weather.wind.deg} language={language} />
          <div className="min-w-0 max-w-full text-center">
            <span className="text-[10px] font-semibold text-sky-400 dark:text-sky-500 tracking-normal">{t.direction}</span>
            <h3 className="max-w-full text-lg sm:text-xl font-heading font-bold leading-tight text-slate-800 dark:text-white break-words">
              {t.windDirections[windDirection]}
            </h3>
          </div>
        </div>

        {/* Right: Data */}
        <div className="min-w-0 flex-grow w-full space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-heading font-bold text-slate-800 dark:text-white leading-tight">
                {isToday ? t.currentWind : `${t.forecastFor} ${dayFormatter.format(selectedDate)}`}
              </h2>
              <div className="flex items-center gap-2 text-sky-400 dark:text-sky-500">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-medium tracking-normal">{t.lastUpdated} {relativeTime}</span>
              </div>
            </div>
            {isToday && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 text-sky-400 hover:text-primary hover:bg-sky-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                aria-label="Refresh weather"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Wind Speed */}
            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-2xl border border-sky-100/50 dark:border-slate-700/40 space-y-2">
              <div className="flex justify-between items-center">
                <Wind className="w-4 h-4 text-sky-400" />
                <div className="flex bg-sky-50/80 dark:bg-slate-700/60 rounded-lg p-0.5">
                  <button
                    onClick={() => onWindUnitChange('beaufort')}
                    className={`px-2.5 py-1 text-[9px] font-bold tracking-normal rounded-md transition-all cursor-pointer ${windUnit === 'beaufort' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Bft
                  </button>
                  <button
                    onClick={() => onWindUnitChange('mph')}
                    className={`px-2.5 py-1 text-[9px] font-bold tracking-normal rounded-md transition-all cursor-pointer ${windUnit === 'mph' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Mph
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-medium text-sky-400 dark:text-sky-500 tracking-normal">{t.speed}</span>
                <div className="text-xl font-heading font-bold text-slate-800 dark:text-white">
                  {windUnit === 'beaufort' ? t.beaufortScale(Number(windSpeedKmph)) : windSpeedMph}
                </div>
              </div>
            </div>

            {/* Temperature */}
            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-2xl border border-sky-100/50 dark:border-slate-700/40 space-y-2">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <div>
                <span className="text-[10px] font-medium text-sky-400 dark:text-sky-500 tracking-normal">{t.temperatureLabel || 'Temp'}</span>
                <div className="text-xl font-heading font-bold text-slate-800 dark:text-white">
                  {Math.round('main' in weather ? weather.main.temp : weather.temp_max)}°C
                </div>
              </div>
            </div>

            {/* Condition */}
            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-4 rounded-2xl border border-sky-100/50 dark:border-slate-700/40 space-y-2">
              <img src={iconUrl} alt={weather.weather.main} className="w-8 h-8 -ml-1" />
              <div>
                <span className="text-[10px] font-medium text-sky-400 dark:text-sky-500 tracking-normal">{t.conditionLabel || 'Condition'}</span>
                <div className="text-sm font-heading font-semibold text-slate-800 dark:text-white capitalize">
                  {(t.weatherConditions && t.weatherConditions[weather.weather.description]) || weather.weather.description}
                </div>
              </div>
            </div>
          </div>

          {isWinter && (
            <div className="flex items-center gap-3 p-3 bg-sky-50/60 dark:bg-sky-900/15 rounded-xl border border-sky-100/40 dark:border-sky-800/30">
              <Droplets className="w-4 h-4 text-sky-400" />
              <div>
                <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">{t.winterSwimming.seasonActive}</p>
                <p className="text-[10px] text-sky-500 dark:text-sky-400">{t.winterSwimming.waterTempNote}: ~16-18°C</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WindInfo;
