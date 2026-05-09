import React from 'react';
import { Translation, SortOption } from '../types';

interface BeachFiltersProps {
  t: Translation;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  showRecommendedOption: boolean;
}

export const BeachFilters: React.FC<BeachFiltersProps> = ({
  t,
  sortBy,
  onSortChange,
  showRecommendedOption
}) => {
  const selectedSortBy = !showRecommendedOption && sortBy === 'recommended' ? 'all' : sortBy;

  return (
    <div className="relative z-30 pb-2 md:pb-0">
      <div className="flex items-center justify-center pb-2 md:mb-8 md:justify-end md:border-b md:border-slate-200 md:pb-4 dark:md:border-slate-800">
        <select
          value={selectedSortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="w-full max-w-xs rounded-full border border-white/45 bg-white/55 px-4 py-2.5 text-center text-xs font-bold text-slate-600 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/70 md:w-auto md:rounded-xl md:bg-white/65 md:px-4 md:py-2 md:text-left md:text-sm dark:border-slate-700/40 dark:bg-slate-800/45 dark:text-slate-200 dark:ring-white/10"
        >
          {showRecommendedOption && <option value="recommended">{t.sortByRecommended}</option>}
          <option value="all">{t.sortByAll}</option>
          <option value="rating">{t.sortByTopRated}</option>
          <option value="distance">{t.sortByDistance}</option>
        </select>
      </div>
    </div>
  );
};
