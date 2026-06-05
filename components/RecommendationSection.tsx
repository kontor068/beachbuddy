import React from 'react';
import { Beach, LanguageCode, Translation, WindDirection, SortOption, FilterKey, UserPreferences } from '../types';
import { BeachList } from './BeachList';
import { BeachFilters } from './BeachFilters';
import { getLocalizedCopy } from '../utils/i18n';
import { getBeachFilterDirectoryTitle } from '../utils/filterSummary';

interface RecommendationSectionProps {
  beaches: Beach[];
  language: LanguageCode;
  t: Translation;
  windSpeed: number;
  windDirection: WindDirection;
  waveHeightM?: number;
  temperature?: number;
  selectedDate?: Date;
  islandName: string;
  regionId?: string;
  onBeachClick: (beach: Beach) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  activeFilters: FilterKey[];
  onFilterChange?: (filter: FilterKey) => void;
  preferences: UserPreferences;
  onPreferenceFilterClear: (key: keyof UserPreferences) => void;
  onClearSearchAndFilters: () => void;
  hasActiveSearchOrFilters: boolean;
  favorites: number[];
  onToggleFavorite: (beachId: number) => void;
  hasShownAlternativeRecommendations: boolean;
  severeWeatherNoSwimming?: boolean;
  noSwimmingReason?: 'rain' | 'conditions';
  showControls?: boolean;
  searchSuggestions?: string[];
  protectedSortNoResults?: boolean;
  protectedSortLabel?: string;
  protectedSortEmptyCopy?: {
    title: string;
    body: string;
  };
  strongWindContext?: boolean;
  sortResultCounts?: Partial<Record<SortOption, number>>;
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  beaches,
  language,
  t,
  windSpeed,
  windDirection,
  waveHeightM,
  temperature,
  selectedDate,
  islandName,
  regionId,
  onBeachClick,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  activeFilters,
  onFilterChange,
  preferences,
  onPreferenceFilterClear,
  onClearSearchAndFilters,
  hasActiveSearchOrFilters,
  favorites,
  onToggleFavorite,
  hasShownAlternativeRecommendations,
  severeWeatherNoSwimming = false,
  noSwimmingReason = 'conditions',
  showControls = true,
  searchSuggestions = [],
  protectedSortNoResults = false,
  protectedSortLabel,
  protectedSortEmptyCopy,
  strongWindContext = false,
  sortResultCounts
}) => {
  const isDirectoryLayout = !showControls;
  const copy = getLocalizedCopy(language, {
    en: { directoryTitle: 'All other beaches', beachCount: (count: number) => `${count} ${count === 1 ? 'beach' : 'beaches'}` },
    gr: { directoryTitle: 'Όλες οι υπόλοιπες παραλίες', beachCount: (count: number) => `${count} ${count === 1 ? 'παραλία' : 'παραλίες'}` },
    fr: { directoryTitle: 'Toutes les autres plages', beachCount: (count: number) => `${count} ${count === 1 ? 'plage' : 'plages'}` },
    de: { directoryTitle: 'Alle weiteren Strände', beachCount: (count: number) => `${count} ${count === 1 ? 'Strand' : 'Strände'}` },
    it: { directoryTitle: 'Tutte le altre spiagge', beachCount: (count: number) => `${count} ${count === 1 ? 'spiaggia' : 'spiagge'}` },
  });
  const directoryTitle = getBeachFilterDirectoryTitle({
    activeFilters,
    fallbackTitle: copy.directoryTitle,
    language,
    preferences,
    t,
  });

  return (
    <section
      id="all-beaches-section"
      className={isDirectoryLayout
        ? 'relative left-1/2 !mt-0 w-screen -translate-x-1/2 bg-sky-50 px-4 pb-8 pt-6 sm:px-5 lg:px-6'
        : 'pb-4 pt-0 sm:py-8 lg:py-2 max-w-7xl lg:max-w-6xl mx-auto'}
    >
      {showControls && (
        <BeachFilters
          t={t}
          language={language}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
          protectedSortLabel={protectedSortLabel}
          sortResultCounts={sortResultCounts}
          preferences={preferences}
          activeFilters={activeFilters}
          onPreferenceFilterClear={onPreferenceFilterClear}
          onAdvancedFilterClear={onFilterChange}
          onClearAll={onClearSearchAndFilters}
          hasActiveSearchOrFilters={hasActiveSearchOrFilters}
          searchSuggestions={searchSuggestions}
        />
      )}
      <div
        className={isDirectoryLayout
          ? 'mx-auto max-w-[84rem] rounded-2xl border border-sky-200 bg-white p-4 shadow-sm shadow-sky-900/5 sm:p-5'
          : 'relative -mx-3 rounded-t-[1.35rem] bg-gradient-to-b from-sky-50/84 via-sky-50/96 to-sky-50 px-3 pb-2 pt-3 sm:mx-0 sm:bg-none sm:px-0 sm:pb-0 sm:pt-0'}
      >
        {isDirectoryLayout && (
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight text-slate-950">
                {directoryTitle}
              </h2>
            </div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-extrabold text-[#007a83]">
              {copy.beachCount(beaches.length)}
            </span>
          </div>
        )}
        <BeachList
          beaches={beaches}
          language={language}
          t={t}
          windSpeed={windSpeed}
          windDirection={windDirection}
          waveHeightM={waveHeightM}
          temperature={temperature}
          selectedDate={selectedDate}
          islandName={islandName}
          regionId={regionId}
          onBeachClick={onBeachClick}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          sortBy={sortBy}
          hasShownAlternativeRecommendations={hasShownAlternativeRecommendations}
          severeWeatherNoSwimming={severeWeatherNoSwimming}
          noSwimmingReason={noSwimmingReason}
          hasActiveSearchOrFilters={hasActiveSearchOrFilters}
          onClearSearchAndFilters={onClearSearchAndFilters}
          protectedSortNoResults={protectedSortNoResults}
          protectedSortEmptyCopy={protectedSortEmptyCopy}
          strongWindContext={strongWindContext}
        />
      </div>
    </section>
  );
};
