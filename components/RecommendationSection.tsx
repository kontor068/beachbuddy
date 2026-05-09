import React from 'react';
import { Beach, LanguageCode, Translation, WindDirection, SortOption, FilterKey } from '../types';
import { BeachList } from './BeachList';
import { BeachFilters } from './BeachFilters';

interface RecommendationSectionProps {
  beaches: Beach[];
  language: LanguageCode;
  t: Translation;
  windSpeed: number;
  windDirection: WindDirection;
  temperature?: number;
  islandName: string;
  onBeachClick: (beach: Beach) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  activeFilters: FilterKey[];
  onFilterChange?: (filter: FilterKey) => void;
  favorites: number[];
  onToggleFavorite: (beachId: number) => void;
  showRecommendedOption: boolean;
  hasShownAlternativeRecommendations: boolean;
}

export const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  beaches,
  language,
  t,
  windSpeed,
  windDirection,
  temperature,
  islandName,
  onBeachClick,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  activeFilters,
  favorites,
  onToggleFavorite,
  showRecommendedOption,
  hasShownAlternativeRecommendations
}) => {
  return (
    <section id="all-beaches-section" className="px-4 py-4 sm:px-6 sm:py-8 lg:px-8 max-w-7xl mx-auto">
      <BeachFilters 
        t={t} 
        searchQuery={searchQuery} 
        onSearchChange={onSearchChange} 
        sortBy={sortBy} 
        onSortChange={onSortChange} 
        showRecommendedOption={showRecommendedOption}
      />
      <BeachList 
        beaches={beaches} 
        language={language} 
        t={t} 
        windSpeed={windSpeed} 
        windDirection={windDirection} 
        temperature={temperature}
        islandName={islandName} 
        onBeachClick={onBeachClick} 
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        sortBy={sortBy}
        hasShownAlternativeRecommendations={hasShownAlternativeRecommendations}
      />
    </section>
  );
};
