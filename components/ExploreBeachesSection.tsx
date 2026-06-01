import React, { useState, useMemo } from 'react';
import { MapPin, Star, Wind, Navigation, Clock } from 'lucide-react';
import { Beach, WeatherData, DailyForecast, LanguageCode, ForecastItem, UserPreferences } from '../types';
import { Translation } from '../types';
import { getSuitableBeaches } from '../services/recommendationService';
// @ts-ignore
import * as ReactWindow from 'react-window';
const { FixedSizeGrid: Grid } = ReactWindow as any;
import { AutoSizer } from 'react-virtualized-auto-sizer';

interface ExploreBeachesSectionProps {
  beaches: Beach[];
  weather: WeatherData | DailyForecast;
  userLocation?: { lat: number; lon: number };
  language: LanguageCode;
  t: Translation;
  onBeachClick: (beach: Beach) => void;
  hourlyForecast?: ForecastItem[];
  preferences?: UserPreferences;
}

type SortOption = 'score' | 'distance';

export const ExploreBeachesSection: React.FC<ExploreBeachesSectionProps> = ({
  beaches,
  weather,
  userLocation,
  language,
  t,
  onBeachClick,
  hourlyForecast,
  preferences
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('score');

  // Memoize the calculation of suitable beaches to avoid expensive recalculations
  const suitableBeaches = useMemo(() => {
    return getSuitableBeaches(beaches, weather, language, userLocation, hourlyForecast, preferences);
  }, [beaches, weather, language, userLocation, hourlyForecast, preferences]);

  // Memoize the sorting logic
  const sortedBeaches = useMemo(() => {
    const sorted = [...suitableBeaches];
    
    if (sortBy === 'distance' && userLocation) {
      sorted.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    } else {
      // Default to score (already sorted by getSuitableBeaches, but good to be explicit)
      sorted.sort((a, b) => b.score - a.score);
    }
    
    return sorted;
  }, [suitableBeaches, sortBy, userLocation]);

  if (sortedBeaches.length === 0) {
    return null;
  }

  const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
    const { beaches, columnCount, onBeachClick, weather } = data;
    const index = rowIndex * columnCount + columnIndex;
    if (index >= beaches.length) return null;
    const item = beaches[index];

    return (
      <div style={{ ...style, padding: 12 }}>
        <div 
          onClick={() => onBeachClick(item.beach)}
          className="h-full group cursor-pointer bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-cyan-200 dark:hover:border-cyan-900 transition-all duration-300 overflow-hidden flex flex-col"
        >
          <div className="p-5 flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors">
                {item.name}
              </h3>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                item.score >= 80 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                <Star className="w-3 h-3 fill-current" />
                {item.score}%
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 line-clamp-2 flex-grow">
              {item.explanation}
            </p>

            {item.bestBeachTime && (
              <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-100 dark:border-cyan-900/50">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 text-xs font-bold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  Best Time: {item.bestBeachTime.bestStart} - {item.bestBeachTime.bestEnd}
                </div>
                <p className="text-xs text-cyan-600 dark:text-cyan-500/80 line-clamp-1">
                  {item.bestBeachTime.reason}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
              <div className="flex items-center gap-3">
                {item.distance !== undefined && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {item.distance.toFixed(1)} km
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3" />
                  {weather.wind.speed.toFixed(1)} m/s
                </span>
              </div>
              <span className="text-cyan-600 font-medium group-hover:translate-x-1 transition-transform flex items-center gap-1">
                View
                <Navigation className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-cyan-600" />
            Explore Suitable Beaches
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {sortedBeaches.length} beaches with good conditions
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setSortBy('score')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortBy === 'score' 
                ? 'bg-white dark:bg-slate-700 text-cyan-600 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            Best Conditions
          </button>
          <button
            onClick={() => setSortBy('distance')}
            disabled={!userLocation}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortBy === 'distance' 
                ? 'bg-white dark:bg-slate-700 text-cyan-600 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            } ${!userLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!userLocation ? t.locationErrorUnavailable : ''}
          >
            Closest to Me
          </button>
        </div>
      </div>

      <div className="h-[600px] w-full">
        {/* @ts-ignore */}
        <AutoSizer>
          {({ height, width }) => {
            const columnCount = width < 640 ? 1 : width < 1024 ? 2 : 3;
            const rowCount = Math.ceil(sortedBeaches.length / columnCount);
            const columnWidth = width / columnCount;
            const rowHeight = 420;

            return (
              <Grid
                columnCount={columnCount}
                columnWidth={columnWidth}
                height={height}
                rowCount={rowCount}
                rowHeight={rowHeight}
                width={width}
                itemData={{ beaches: sortedBeaches, columnCount, onBeachClick, weather }}
              >
                {Cell}
              </Grid>
            );
          }}
        </AutoSizer>
      </div>
    </section>
  );
};
