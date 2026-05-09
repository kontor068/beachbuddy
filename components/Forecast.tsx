import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyForecast, WeatherData, ForecastItem } from '../types';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { Wind, Clock, ChevronDown } from 'lucide-react';

type DisplayForecast = (DailyForecast) | (WeatherData & { 
  date: Date, 
  temp_max: number, 
  temp_min: number,
  hourly: ForecastItem[] 
});

interface ForecastProps {
  displayForecasts: DisplayForecast[];
  selectedDayIndex: number;
  onDaySelect: (index: number) => void;
  t: any;
}

const HourlyForecastDetail: React.FC<{ hourlyData: ForecastItem[]; t: any }> = ({ hourlyData, t }) => {
  const [showMoreHours, setShowMoreHours] = useState(false);

  if (!hourlyData) return null;

  const filteredData = hourlyData.filter(item => {
    const itemDate = new Date(item.dt * 1000);
    const itemHour = itemDate.getHours();
    return itemHour <= 21 && itemHour >= 8;
  });

  if (filteredData.length === 0) return null;

  const timeFormatter = new Intl.DateTimeFormat(t.locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const visibleData = showMoreHours ? filteredData : filteredData.slice(0, 5);
  const hiddenHoursCount = Math.max(filteredData.length - 5, 0);
  const showMoreLabel = t.locale === 'el-GR' ? `Δείξε ${hiddenHoursCount} ακόμα ώρες` : `Show ${hiddenHoursCount} more hours`;
  const showLessLabel = t.locale === 'el-GR' ? 'Δείξε λιγότερες ώρες' : 'Show fewer hours';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
      {visibleData.map((item, idx) => {
        const windDir = degToCompass(item.wind.deg);
        const beaufortLevel = getBeaufortLevel(item.wind.speed * 3.6);
        
        return (
          <motion.div
            key={item.dt}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.02 }}
            className="flex min-h-[74px] flex-col justify-between rounded-2xl border border-sky-100/30 bg-white/35 p-3 transition-colors hover:bg-white/55 md:min-h-0 md:flex-row md:items-center md:rounded-xl md:px-4 md:py-3 dark:border-slate-700/20 dark:bg-slate-800/30 dark:hover:bg-slate-800/40"
          >
            <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start md:gap-4">
              <span className="text-xs font-heading font-semibold text-sky-500 md:w-16 md:text-base dark:text-sky-400">{timeFormatter.format(new Date(item.dt * 1000))}</span>
              <div className="hidden h-3 w-px bg-sky-200/40 md:block dark:bg-slate-700/40" />
              <span className="text-sm font-heading font-bold text-slate-800 md:text-base dark:text-white">{Math.round(item.main.temp)}°C</span>
            </div>

            <div className="mt-2 flex w-full items-center justify-between gap-2 border-t border-sky-100/40 pt-2 md:mt-0 md:w-auto md:border-t-0 md:pt-0 md:gap-4">
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[9px] font-semibold uppercase text-slate-500 md:text-sm">{t.windDirectionsShort[windDir]}</span>
                <div
                  className="rounded-full bg-sky-50/60 p-1 text-sky-400 md:p-1.5 dark:bg-sky-900/20"
                  style={{ transform: `rotate(${item.wind.deg}deg)` }}
                >
                  <Wind className="h-2.5 w-2.5 md:h-4 md:w-4" />
                </div>
              </div>
              <span className="text-[10px] font-heading font-bold text-slate-900 md:text-sm dark:text-white">{beaufortLevel} {t.units.beaufort}</span>
            </div>
          </motion.div>
        );
      })}
      </div>
      {hiddenHoursCount > 0 && (
        <button
          type="button"
          onClick={() => setShowMoreHours((value) => !value)}
          className="mx-auto flex items-center gap-2 rounded-full border border-sky-100/60 bg-white/50 px-4 py-2 text-xs font-heading font-bold text-sky-500 shadow-sm transition hover:bg-white/80 dark:border-slate-700/40 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
        >
          {showMoreHours ? showLessLabel : showMoreLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${showMoreHours ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};

const ForecastCard: React.FC<{
  forecast: DisplayForecast;
  isSelected: boolean;
  onClick: () => void;
  isToday: boolean;
  t: any;
  index: number;
}> = ({ forecast, isSelected, onClick, isToday, t, index }) => {
  const iconUrl = `https://openweathermap.org/img/wn/${forecast.weather.icon}@2x.png`;
  const dayFormatter = new Intl.DateTimeFormat(t.locale, { weekday: 'short' });
  const dateFormatter = new Intl.DateTimeFormat(t.locale, { month: 'short', day: 'numeric' });
  
  const windDirection = degToCompass(forecast.wind.deg);
  const windSpeedKmph = forecast.wind.speed * 3.6;
  const beaufortLevel = getBeaufortLevel(windSpeedKmph);

  return (
    <motion.button
        onClick={onClick}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        className={`relative flex min-w-0 flex-col items-center rounded-xl border p-1.5 transition-all duration-300 group cursor-pointer sm:rounded-2xl sm:p-3 md:p-5 ${
        isSelected
            ? 'z-10 border-sky-300 bg-white/90 shadow-md shadow-sky-100/60 ring-1 ring-sky-300/60 backdrop-blur-md dark:border-sky-600 dark:bg-slate-800/90 dark:shadow-none'
            : 'border-white/40 bg-white/32 opacity-90 backdrop-blur-sm hover:border-sky-200 hover:bg-white/55 dark:border-slate-800/40 dark:bg-slate-900/30 dark:hover:border-sky-700'
        }`}
    >
        {isToday && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 text-[7px] font-bold text-white shadow-md sm:px-2.5 sm:text-[8px] md:text-[10px]">
            {t.today}
          </div>
        )}

        <span className="mb-0.5 max-w-full truncate text-[9px] font-heading font-bold text-slate-900 sm:text-[10px] md:text-sm dark:text-white">
          {dayFormatter.format(forecast.date)}
        </span>
        <span className="mb-1 max-w-full truncate text-[8px] font-semibold text-slate-900 sm:mb-2 sm:text-[9px] md:text-xs dark:text-white">
          {dateFormatter.format(forecast.date)}
        </span>

        <div className="relative mb-1 sm:mb-2 md:mb-3">
          <img src={iconUrl} alt={forecast.weather.description} className="h-7 w-7 drop-shadow-sm sm:h-10 sm:w-10 md:h-14 md:w-14" />
        </div>

        <div className="mb-1 flex flex-col items-center gap-0 sm:mb-2">
          <span className="font-heading text-sm font-bold text-slate-800 sm:text-lg md:text-2xl dark:text-white">
            {Math.round(forecast.temp_max)}°
          </span>
          <span className="hidden text-[8px] font-medium text-slate-400 sm:block sm:text-[10px] md:text-sm">
            {Math.round(forecast.temp_min)}°
          </span>
        </div>

        <div className="flex w-full flex-col items-center gap-1 border-t border-sky-100/40 pt-1.5 sm:gap-1.5 sm:pt-3 md:gap-2 md:pt-4 dark:border-slate-700/30">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div
              className="rounded-full bg-sky-50/60 p-0.5 text-sky-400 sm:p-1 md:p-1.5 dark:bg-sky-900/20"
              style={{ transform: `rotate(${forecast.wind.deg}deg)` }}
            >
              <Wind className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-4 md:w-4" />
            </div>
            <span className="hidden max-w-5 truncate text-[8px] font-semibold text-slate-500 sm:inline sm:max-w-none sm:text-[10px] md:text-sm">
              {t.windDirectionsShort[windDirection]}
            </span>
          </div>
          <span className="text-[8px] font-heading font-bold text-slate-900 sm:text-[10px] md:text-sm dark:text-white">
            {beaufortLevel} {t.units.beaufort}
          </span>
        </div>
    </motion.button>
  );
};

const Forecast: React.FC<ForecastProps> = ({ displayForecasts, selectedDayIndex, onDaySelect, t }) => {
  if (!displayForecasts || displayForecasts.length === 0) return null;

  const selectedForecast = displayForecasts[selectedDayIndex];
  const hasHourlyData = selectedForecast?.hourly?.length > 0;
  const compactHourlyTitle = t.locale === 'el-GR' ? 'Άνεμος σήμερα' : 'Today wind';
  
  return (
    <div className="space-y-4">
      <div className="flex min-h-11 w-full items-center justify-center rounded-full border border-white/45 bg-white/55 px-5 py-2.5 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl sm:px-6">
        <h2 className="w-full text-center font-heading text-sm font-bold leading-tight text-slate-600 sm:text-base">
          {t.forecastTitle}
        </h2>
      </div>

      <div className="pb-1">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3 md:gap-4">
          {displayForecasts.slice(0, 5).map((forecast, index) => (
            <ForecastCard
              key={forecast.date.toISOString()}
              forecast={forecast}
              isSelected={selectedDayIndex === index}
              onClick={() => onDaySelect(index)}
              isToday={index === 0}
              t={t}
              index={index}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {hasHourlyData && (
          <motion.div
            key={selectedDayIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="rounded-2xl border border-white/45 bg-white/45 p-4 shadow-sm shadow-sky-900/5 backdrop-blur-xl sm:p-5 md:p-6 dark:border-slate-800/40 dark:bg-slate-900/40"
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-sky-50/80 dark:bg-sky-950/30 text-sky-400">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-heading text-base font-semibold text-slate-800 sm:text-lg dark:text-white">
                  <span className="sm:hidden">{compactHourlyTitle}</span>
                  <span className="hidden sm:inline">{t.hourlyForecast.title}</span>
                </h3>
              </div>
              <span className="self-start text-[10px] font-semibold text-sky-500 sm:self-auto dark:text-sky-400">
                {new Intl.DateTimeFormat(t.locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(selectedForecast.date)}
              </span>
            </div>
            <HourlyForecastDetail hourlyData={selectedForecast.hourly} t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Forecast;
