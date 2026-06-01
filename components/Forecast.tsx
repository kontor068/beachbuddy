import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DailyForecast, WeatherData, ForecastItem } from '../types';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { ArrowRight, CloudSun, Wind, Clock, ChevronDown } from 'lucide-react';
import { trackEvent } from '../services/analyticsService';

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
  islandName?: string;
  variant?: 'default' | 'heroCompact' | 'header' | 'summaryStrip';
}

const EVENING_TODAY_CUTOFF_HOUR = 21;

const isTodayDisabledAfterEvening = (index: number, now: Date = new Date()): boolean =>
  index === 0 && now.getHours() >= EVENING_TODAY_CUTOFF_HOUR;

const getNextTodayDisabledStateDelay = (now: Date = new Date()): number => {
  const nextBoundary = new Date(now);

  if (now.getHours() < EVENING_TODAY_CUTOFF_HOUR) {
    nextBoundary.setHours(EVENING_TODAY_CUTOFF_HOUR, 0, 0, 0);
  } else {
    nextBoundary.setDate(nextBoundary.getDate() + 1);
    nextBoundary.setHours(0, 0, 0, 0);
  }

  return Math.max(1000, nextBoundary.getTime() - now.getTime() + 1000);
};

const HourlyForecastDetail: React.FC<{ hourlyData: ForecastItem[]; t: any }> = ({ hourlyData, t }) => {
  if (!hourlyData) return null;

  const filteredData = hourlyData.filter(item => {
    const itemDate = new Date(item.dt * 1000);
    const itemHour = itemDate.getHours();
    return itemHour <= 21 && itemHour >= 8;
  });

  if (filteredData.length === 0) return null;

  const timeFormatter = new Intl.DateTimeFormat(t.locale, { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="space-y-1.5">
      <div className="space-y-2">
      {filteredData.map((item, idx) => {
        const windDir = degToCompass(item.wind.deg);
        const beaufortLevel = getBeaufortLevel(item.wind.speed * 3.6);
        
        return (
          <motion.div
            key={item.dt}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.02 }}
            className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-sky-100/30 bg-white/50 px-3 py-1.5 transition-colors hover:bg-white/72 dark:border-slate-700/20 dark:bg-slate-800/45 dark:hover:bg-slate-800/60"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-12 shrink-0 text-xs font-heading font-bold text-sky-600 dark:text-sky-400">{timeFormatter.format(new Date(item.dt * 1000))}</span>
              <span className="text-sm font-heading font-bold text-slate-800 dark:text-white">{Math.round(item.main.temp)}°C</span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">{t.windDirectionsShort[windDir]}</span>
                <div
                  className="rounded-full bg-sky-50/80 p-1 text-sky-500 dark:bg-sky-900/20"
                  style={{ transform: `rotate(${item.wind.deg}deg)` }}
                  aria-hidden="true"
                >
                  <Wind className="h-3 w-3" />
                </div>
              </div>
              <span className="min-w-10 text-right text-xs font-heading font-bold text-slate-900 dark:text-white">{beaufortLevel} {t.units.beaufort}</span>
            </div>
          </motion.div>
        );
      })}
      </div>
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
  variant?: 'stacked' | 'pill' | 'mini';
  disabled?: boolean;
}> = ({ forecast, isSelected, onClick, isToday, t, index, variant = 'stacked', disabled = false }) => {
  const iconUrl = `https://openweathermap.org/img/wn/${forecast.weather.icon}@2x.png`;
  const dayFormatter = new Intl.DateTimeFormat(t.locale, { weekday: 'short' });
  const dateFormatter = new Intl.DateTimeFormat(t.locale, { month: 'short', day: 'numeric' });
  
  const windDirection = degToCompass(forecast.wind.deg);
  const windSpeedKmph = forecast.wind.speed * 3.6;
  const beaufortLevel = getBeaufortLevel(windSpeedKmph);
  const buttonLabel = `${t.forecastFor} ${dayFormatter.format(forecast.date)}, ${dateFormatter.format(forecast.date)}: ${Math.round(forecast.temp_max)}°C, ${beaufortLevel} ${t.units.beaufort}`;

  if (variant === 'mini') {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={isToday ? `${t.today}. ${buttonLabel}` : buttonLabel}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.035 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:h-[50px] sm:min-w-[104px] sm:shrink-0 sm:flex-row sm:gap-2 sm:px-3 ${
          disabled
            ? 'cursor-not-allowed border-slate-200/45 bg-white/42 text-slate-400 opacity-45 shadow-none grayscale'
            : isSelected
            ? 'border-sky-100 bg-sky-100/78 text-sky-800 shadow-sm shadow-sky-900/8 ring-1 ring-white/70'
            : 'border-slate-200/75 bg-white/86 text-slate-700 shadow-sm shadow-slate-900/8 hover:border-sky-200 hover:bg-sky-50/70'
        }`}
      >
        <span className={`max-w-full truncate text-[10px] font-extrabold leading-none sm:hidden ${isSelected ? 'text-sky-700' : 'text-slate-700'}`}>
          {isToday ? t.today : dayFormatter.format(forecast.date)}
        </span>
        <span className="flex min-w-0 items-center justify-center gap-0.5 sm:gap-2">
          <img
            src={iconUrl}
            alt={forecast.weather.description}
            width={24}
            height={24}
            loading={index === 0 ? 'eager' : 'lazy'}
            className="h-5 w-5 shrink-0 drop-shadow-sm sm:h-7 sm:w-7"
          />
          <span className="flex min-w-0 flex-col items-start leading-none">
            <span className={`hidden max-w-[3.8rem] truncate text-[11px] font-extrabold sm:block ${isSelected ? 'text-sky-700' : 'text-slate-700'}`}>
              {isToday ? t.today : dayFormatter.format(forecast.date)}
            </span>
            <span className="text-[10px] font-black text-slate-700 sm:mt-1">
              {Math.round(forecast.temp_max)}°C
            </span>
          </span>
        </span>
      </motion.button>
    );
  }

  if (variant === 'pill') {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={isToday ? `${t.today}. ${buttonLabel}` : buttonLabel}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.035 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={`flex min-h-[58px] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:h-[50px] sm:flex-row sm:gap-2 sm:px-2 sm:py-0 lg:px-3 ${
          disabled
            ? 'cursor-not-allowed border-slate-200/45 bg-white/42 text-slate-400 opacity-45 shadow-none grayscale'
            : isSelected
            ? 'border-sky-100 bg-sky-100/78 text-sky-800 shadow-sm shadow-sky-900/8 ring-1 ring-white/70'
            : 'border-slate-200/75 bg-white/86 text-slate-700 shadow-sm shadow-slate-900/8 hover:border-sky-200 hover:bg-sky-50/70'
        }`}
      >
        <img
          src={iconUrl}
          alt={forecast.weather.description}
          width={28}
          height={28}
          loading={index === 0 ? 'eager' : 'lazy'}
          className="h-5 w-5 shrink-0 drop-shadow-sm sm:h-7 sm:w-7"
        />
        <span className="flex min-w-0 max-w-full flex-col items-center leading-none sm:items-start">
          <span className={`max-w-full truncate text-[10px] font-extrabold sm:max-w-[3.8rem] sm:text-[11px] ${isSelected ? 'text-sky-700' : 'text-slate-700'}`}>
            {isToday ? t.today : dayFormatter.format(forecast.date)}
          </span>
          <span className="mt-0.5 text-[10px] font-black text-slate-700 sm:mt-1">
            {Math.round(forecast.temp_max)}°C
          </span>
        </span>
      </motion.button>
    );
  }

  return (
    <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={isToday ? `${t.today}. ${buttonLabel}` : buttonLabel}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={disabled ? undefined : { y: -2 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={`relative flex min-w-0 flex-col items-center border transition-all duration-300 group cursor-pointer ${
        'min-h-[86px] rounded-xl px-1 pb-1.5 pt-2 sm:min-h-[92px] sm:w-auto sm:min-w-0 sm:p-2 md:min-h-[96px]'
        } ${
        disabled
            ? 'cursor-not-allowed border-white/20 bg-white/10 opacity-40 grayscale backdrop-blur-sm'
            : isSelected
            ? 'z-10 border-sky-100 bg-white/66 shadow-sm shadow-sky-100/40 ring-1 ring-sky-100/50 backdrop-blur-md dark:border-sky-600 dark:bg-slate-800/88 dark:shadow-none'
            : 'border-white/30 bg-white/18 opacity-82 backdrop-blur-sm hover:border-sky-200 hover:bg-white/38 dark:border-slate-800/40 dark:bg-slate-900/28 dark:hover:border-sky-700'
        }`}
    >
        {isToday && (
          <div className="absolute left-1/2 max-w-[calc(100%-0.5rem)] -translate-x-1/2 rounded-md bg-primary px-1.5 py-0.5 text-[8px] font-bold leading-none text-white shadow-md sm:text-[9px]">
            {t.today}
          </div>
        )}

        <span className="mb-0.5 max-w-full truncate font-heading text-[10px] font-bold text-slate-900 min-[390px]:text-[11px] md:text-xs dark:text-white">
          {dayFormatter.format(forecast.date)}
        </span>
        <span className="mb-0.5 max-w-full truncate text-[9px] font-semibold text-slate-500 min-[390px]:text-[10px] sm:mb-1 md:text-[11px] dark:text-white">
          {dateFormatter.format(forecast.date)}
        </span>

        <div className="relative mb-0.5 sm:mb-1">
          <img src={iconUrl} alt={forecast.weather.description} width={40} height={40} loading={index === 0 ? 'eager' : 'lazy'} className="h-6 w-6 drop-shadow-sm min-[390px]:h-7 min-[390px]:w-7 sm:h-7 sm:w-7 md:h-8 md:w-8" />
        </div>

        <div className="mb-0.5 flex flex-col items-center gap-0 sm:mb-1">
          <span className="font-heading text-base font-bold leading-none text-slate-800 min-[390px]:text-[17px] sm:text-base md:text-lg dark:text-white">
            {Math.round(forecast.temp_max)}°
          </span>
          <span className="hidden">
            {Math.round(forecast.temp_min)}°
          </span>
        </div>

        <div className="mt-1 flex w-full flex-col items-center gap-0.5 border-t border-sky-100/30 pt-1 sm:gap-0.5 sm:pt-1 dark:border-slate-700/30">
          <div className="flex items-center gap-0.5 sm:gap-1.5">
            <div
              className="rounded-full bg-sky-50/55 p-0.5 text-sky-400 dark:bg-sky-900/20"
              style={{ transform: `rotate(${forecast.wind.deg}deg)` }}
              aria-hidden="true"
            >
              <Wind className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
            </div>
            <span className="max-w-8 truncate text-[11px] font-bold text-slate-500 sm:inline sm:max-w-none sm:text-xs">
              {t.windDirectionsShort[windDirection]}
            </span>
          </div>
          <span className="font-heading text-[10px] font-bold leading-none text-slate-900 min-[390px]:text-[11px] sm:text-xs dark:text-white">
            {beaufortLevel} {t.units.beaufort}
          </span>
        </div>
    </motion.button>
  );
};

const Forecast: React.FC<ForecastProps> = ({ displayForecasts, selectedDayIndex, onDaySelect, t, islandName, variant = 'default' }) => {
  const [isHourlyExpanded, setIsHourlyExpanded] = useState(false);
  const hourlyDetailsId = useId();
  const isHeroCompact = variant === 'heroCompact';
  const isHeader = variant === 'header';
  const isSummaryStrip = variant === 'summaryStrip';
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentTime(new Date());
    }, getNextTodayDisabledStateDelay(currentTime));

    return () => window.clearTimeout(timeoutId);
  }, [currentTime]);

  useEffect(() => {
    setIsHourlyExpanded(false);
  }, [selectedDayIndex]);

  if (!displayForecasts || displayForecasts.length === 0) return null;

  const selectedForecast = displayForecasts[selectedDayIndex];
  const hasHourlyData = selectedForecast?.hourly?.length > 0;
  const hourlyTitle = t.hourlyForecast?.title || (t.locale === 'el-GR' ? 'Ωριαία πρόγνωση ανέμου' : 'Hourly wind forecast');
  const showDetailsLabel = t.hourlyForecast?.showDetails || (t.locale === 'el-GR' ? 'Δες αναλυτικά' : 'Show details');
  const hideDetailsLabel = t.hourlyForecast?.hideDetails || (t.locale === 'el-GR' ? 'Απόκρυψη' : 'Hide details');
  const toggleLabel = isHourlyExpanded ? hideDetailsLabel : showDetailsLabel;
  const handleHourlyToggle = () => {
    setIsHourlyExpanded((value) => {
      const nextValue = !value;
      if (nextValue) {
        trackEvent('forecast_expanded', undefined, {
          locale: t.locale === 'el-GR' ? 'el' : 'en',
          day_index: selectedDayIndex,
        });
      }
      return nextValue;
    });
  };

  if (isSummaryStrip) {
    return (
      <div className="grid min-w-0 grid-cols-5 gap-1.5 sm:gap-2" aria-label={t.locale === 'el-GR' ? 'Ημερήσια πρόγνωση' : 'Daily forecast'}>
        {displayForecasts.slice(0, 5).map((forecast, index) => (
          <ForecastCard
            key={forecast.date.toISOString()}
            forecast={forecast}
            isSelected={selectedDayIndex === index}
            onClick={() => onDaySelect(index)}
            isToday={index === 0}
            t={t}
            index={index}
            variant="mini"
            disabled={isTodayDisabledAfterEvening(index, currentTime)}
          />
        ))}
      </div>
    );
  }

  if (isHeroCompact) {
    const dayFormatter = new Intl.DateTimeFormat(t.locale, { weekday: 'short' });
    const dateFormatter = new Intl.DateTimeFormat(t.locale, { month: 'short', day: 'numeric' });

    return (
      <div className="mx-auto w-full rounded-2xl border border-white/55 bg-white/28 p-1 shadow-sm shadow-sky-900/5 ring-1 ring-white/30 backdrop-blur-xl sm:p-1.5">
        <h2 className="mb-0.5 text-center font-heading text-[9px] font-bold leading-tight text-slate-600 sm:mb-1 sm:text-[11px]">
          {t.forecastTitle}
        </h2>
        <div className="grid min-w-0 grid-cols-5 gap-0.5 sm:gap-1">
          {displayForecasts.slice(0, 5).map((forecast, index) => {
            const windDirection = degToCompass(forecast.wind.deg);
            const beaufortLevel = getBeaufortLevel(forecast.wind.speed * 3.6);
            const isSelected = selectedDayIndex === index;
            const isDisabled = isTodayDisabledAfterEvening(index, currentTime);
            const iconUrl = `https://openweathermap.org/img/wn/${forecast.weather.icon}@2x.png`;
            const buttonLabel = `${t.forecastFor} ${dayFormatter.format(forecast.date)}, ${dateFormatter.format(forecast.date)}: ${Math.round(forecast.temp_max)}°C, ${beaufortLevel} ${t.units.beaufort}`;

            return (
              <button
                key={forecast.date.toISOString()}
                type="button"
                onClick={() => onDaySelect(index)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                aria-label={index === 0 ? `${t.today}. ${buttonLabel}` : buttonLabel}
                className={`relative flex min-h-[56px] min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-1 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:min-h-[62px] sm:px-1 ${
                  isDisabled
                    ? 'cursor-not-allowed border-white/20 bg-white/10 text-slate-400 opacity-40 grayscale'
                    : isSelected
                    ? 'border-sky-200 bg-white/78 shadow-sm ring-1 ring-sky-200/45'
                    : 'border-white/35 bg-white/22 hover:border-sky-200 hover:bg-white/45'
                }`}
              >
                {index === 0 && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-md bg-primary px-1 py-0.5 text-[7px] font-bold leading-none text-white sm:px-1.5 sm:text-[8px]">
                    {t.today}
                  </span>
                )}
                <span className="max-w-full truncate font-heading text-[8px] font-bold leading-tight text-slate-900 sm:text-[9px]">
                  {dayFormatter.format(forecast.date)}
                </span>
                <span className="max-w-full truncate text-[7px] font-semibold leading-tight text-slate-500 sm:text-[8px]">
                  {dateFormatter.format(forecast.date)}
                </span>
                <div className="mt-0.5 flex items-center justify-center gap-0.5">
                  <img src={iconUrl} alt={forecast.weather.description} width={24} height={24} loading={index === 0 ? 'eager' : 'lazy'} className="h-4 w-4 drop-shadow-sm" />
                  <span className="font-heading text-[11px] font-bold leading-none text-slate-900 sm:text-xs">
                    {Math.round(forecast.temp_max)}°
                  </span>
                </div>
                <div className="mt-0.5 flex max-w-full items-center justify-center gap-0.5 truncate text-[7px] font-bold leading-none text-slate-500 sm:text-[8px]">
                  <Wind className="h-2 w-2 shrink-0 text-sky-400" aria-hidden="true" style={{ transform: `rotate(${forecast.wind.deg}deg)` }} />
                  <span className="truncate">{t.windDirectionsShort[windDirection]}</span>
                  <span className="shrink-0">{beaufortLevel} {t.units.beaufort}</span>
                </div>
              </button>
            );
          })}
        </div>
        {hasHourlyData && (
          <div className="mt-1 rounded-xl border border-white/35 bg-white/24 px-2 py-1 shadow-sm shadow-sky-900/5">
            <div className="flex min-h-7 items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold leading-none text-slate-600">
                <Clock className="h-3 w-3 shrink-0 text-sky-500" aria-hidden="true" />
                <span className="truncate">{hourlyTitle}</span>
              </span>
              <button
                type="button"
                aria-expanded={isHourlyExpanded}
                aria-controls={hourlyDetailsId}
                aria-label={toggleLabel}
                onClick={handleHourlyToggle}
                className="flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-sky-100/70 bg-white/70 px-2 text-[10px] font-bold leading-none text-sky-600 shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {toggleLabel}
                <ChevronDown className={`h-3 w-3 transition-transform ${isHourlyExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {isHourlyExpanded && (
                <motion.div
                  id={hourlyDetailsId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <HourlyForecastDetail hourlyData={selectedForecast.hourly} t={t} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  if (isHeader) {
    return (
      <div className="border-t border-white/55 pt-1.5 sm:pt-2">
        <div className="space-y-1.5 px-0.5 pb-0.5 sm:grid sm:min-h-[56px] sm:grid-cols-[minmax(8.5rem,10rem)_minmax(0,1fr)_minmax(8.5rem,10rem)] sm:items-center sm:gap-2 sm:space-y-0 sm:px-0">
          <div className="hidden min-w-0 items-center gap-2 px-1 sm:flex sm:px-0" aria-label={t.locale === 'el-GR' ? 'Πρόγνωση' : 'Forecast'}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50/80 text-sky-500 shadow-inner shadow-white/70">
              <CloudSun className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-5 gap-1.5 sm:flex sm:items-center sm:justify-center sm:gap-2">
            {displayForecasts.slice(0, 5).map((forecast, index) => (
              <ForecastCard
                key={forecast.date.toISOString()}
                forecast={forecast}
                isSelected={selectedDayIndex === index}
                onClick={() => onDaySelect(index)}
                isToday={index === 0}
                t={t}
                index={index}
                variant="mini"
                disabled={isTodayDisabledAfterEvening(index, currentTime)}
              />
            ))}
          </div>

          {hasHourlyData && (
            <button
              type="button"
              aria-expanded={isHourlyExpanded}
              aria-controls={hourlyDetailsId}
              aria-label={toggleLabel}
              onClick={handleHourlyToggle}
              className="mx-auto inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-extrabold text-sky-700 transition hover:bg-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:hidden"
            >
              <span>{t.locale === 'el-GR' ? 'Αναλυτικά' : 'Details'}</span>
              <ArrowRight className={`h-3.5 w-3.5 transition-transform ${isHourlyExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
            </button>
          )}

          {hasHourlyData && (
            <button
              type="button"
              aria-expanded={isHourlyExpanded}
              aria-controls={hourlyDetailsId}
              aria-label={toggleLabel}
              onClick={handleHourlyToggle}
              className="hidden h-[50px] min-w-0 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-extrabold text-sky-700 transition hover:bg-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:ml-0 sm:flex sm:justify-self-end"
            >
              <span>{t.locale === 'el-GR' ? 'Αναλυτική πρόγνωση' : 'Detailed forecast'}</span>
              <ArrowRight className={`h-4 w-4 transition-transform ${isHourlyExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {hasHourlyData && isHourlyExpanded && (
            <motion.div
              id={hourlyDetailsId}
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm shadow-sky-900/5 ring-1 ring-white/40 backdrop-blur-xl">
                  <div className="mb-2 flex min-w-0 items-center gap-2">
                    <div className="rounded-lg bg-sky-50/80 p-1.5 text-sky-500">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <h3 className="min-w-0 truncate font-heading text-sm font-semibold text-slate-600">
                      {hourlyTitle}
                    </h3>
                    <span className="ml-auto hidden truncate text-xs font-semibold text-slate-500 sm:block">
                      {new Intl.DateTimeFormat(t.locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(selectedForecast.date)}
                    </span>
                  </div>
                  <HourlyForecastDetail hourlyData={selectedForecast.hourly} t={t} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[1.7rem] border border-white/70 bg-white/88 p-2 shadow-md shadow-sky-900/6 ring-1 ring-white/60 backdrop-blur-xl">
        <div className="space-y-2 px-1 py-1 sm:grid sm:min-h-[64px] sm:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:space-y-0">
          <div className="flex min-w-0 items-center gap-3 px-2">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-500 shadow-inner shadow-white/70">
              <CloudSun className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-heading text-sm font-extrabold leading-tight text-slate-600">
                {t.locale === 'el-GR' ? 'Πρόγνωση' : 'Forecast'}
                {islandName ? ` · ${islandName}` : ''}
              </h2>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-5 gap-1 sm:gap-2">
            {displayForecasts.slice(0, 5).map((forecast, index) => (
              <ForecastCard
                key={forecast.date.toISOString()}
                forecast={forecast}
                isSelected={selectedDayIndex === index}
                onClick={() => onDaySelect(index)}
                isToday={index === 0}
                t={t}
                index={index}
                variant="pill"
                disabled={isTodayDisabledAfterEvening(index, currentTime)}
              />
            ))}
          </div>

          {hasHourlyData && (
            <button
              type="button"
              aria-expanded={isHourlyExpanded}
              aria-controls={hourlyDetailsId}
              aria-label={toggleLabel}
              onClick={handleHourlyToggle}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 px-3 text-xs font-extrabold text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:ml-auto sm:h-[50px] sm:w-auto sm:min-w-[150px] sm:shrink-0 sm:border-0 sm:bg-transparent"
            >
              <span>{t.locale === 'el-GR' ? 'Αναλυτική πρόγνωση' : 'Detailed forecast'}</span>
              <ArrowRight className={`h-4 w-4 transition-transform ${isHourlyExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {hasHourlyData && isHourlyExpanded && (
          <motion.div
            id={hourlyDetailsId}
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/60 bg-white/76 p-3 shadow-sm shadow-sky-900/5 ring-1 ring-white/40 backdrop-blur-xl">
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <div className="rounded-lg bg-sky-50/80 p-1.5 text-sky-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <h3 className="min-w-0 truncate font-heading text-sm font-semibold text-slate-600">
                  {hourlyTitle}
                </h3>
                <span className="ml-auto hidden truncate text-xs font-semibold text-slate-500 sm:block">
                  {new Intl.DateTimeFormat(t.locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(selectedForecast.date)}
                </span>
              </div>
              <HourlyForecastDetail hourlyData={selectedForecast.hourly} t={t} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Forecast;
