import React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { FilterKey, LanguageCode, SortOption, Translation, UserPreferences } from '../types';
import { getActivePreferenceFilters } from '../utils/preferenceFilterLabels';

interface BeachFiltersProps {
  t: Translation;
  language: LanguageCode;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  preferences: UserPreferences;
  activeFilters: FilterKey[];
  onPreferenceFilterClear: (key: keyof UserPreferences) => void;
  onAdvancedFilterClear?: (filter: FilterKey) => void;
  onClearAll: () => void;
  hasActiveSearchOrFilters: boolean;
  variant?: 'default' | 'panel';
  searchSuggestions?: string[];
  protectedSortLabel?: string;
  sortResultCounts?: Partial<Record<SortOption, number>>;
}

export const BeachFilters: React.FC<BeachFiltersProps> = ({
  t,
  language,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  preferences,
  activeFilters,
  onPreferenceFilterClear,
  onAdvancedFilterClear,
  onClearAll,
  hasActiveSearchOrFilters,
  variant = 'default',
  searchSuggestions = [],
  protectedSortLabel
}) => {
  const selectedSortBy = sortBy === 'recommended' || sortBy === 'all' ? 'protected' : sortBy;
  const isPanel = variant === 'panel';
  const [isSortOpen, setIsSortOpen] = React.useState(false);
  const searchListId = React.useId();
  const sortMenuRef = React.useRef<HTMLDivElement>(null);
  const searchCopy = t.beachSearchFilters ?? {
    searchLabel: language === 'gr' ? 'Αναζήτηση παραλιών' : 'Search beaches',
    searchPlaceholder: language === 'gr' ? 'Αναζήτηση παραλιών...' : 'Search beaches...',
    clearSearch: language === 'gr' ? 'Καθαρισμός αναζήτησης' : 'Clear search',
    removeFilter: (label: string) => language === 'gr' ? `Αφαίρεση φίλτρου ${label}` : `Remove ${label} filter`,
    clearAll: language === 'gr' ? 'Καθαρισμός όλων' : 'Clear all',
  };
  const activePreferenceFilters = getActivePreferenceFilters(preferences, language, t);
  const activeAdvancedFilters = activeFilters
    .filter(filter => filter !== 'showAll' && filter !== 'restaurant')
    .map(filter => ({
      key: filter,
      label: t.filterOptions[filter as keyof typeof t.filterOptions] || String(filter),
    }));
  const hasActiveChips = activePreferenceFilters.length > 0 || activeAdvancedFilters.length > 0;
  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'protected', label: protectedSortLabel ?? t.sortByProtected },
    { value: 'rating', label: t.sortByTopRated },
    { value: 'distance', label: t.sortByDistance },
  ];
  const selectedSortLabel = sortOptions.find(option => option.value === selectedSortBy)?.label || (protectedSortLabel ?? t.sortByProtected);

  React.useEffect(() => {
    if (!isSortOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortOpen]);

  return (
    <div className={isPanel ? 'relative z-30' : 'relative z-30 mb-2 md:mx-auto md:mb-3 md:max-w-5xl lg:max-w-6xl'}>
      <div className={isPanel ? 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,13rem)] sm:items-center' : 'mx-auto grid max-w-xl gap-2 md:max-w-none md:grid-cols-[minmax(0,1fr)_minmax(12rem,15rem)] md:items-center md:gap-2.5'}>
        <div className={isPanel ? 'relative min-w-0 flex-1' : 'relative hidden min-w-0 flex-1 md:block'}>
          <label htmlFor="beach-search" className="sr-only">
            {searchCopy.searchLabel}
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="beach-search"
            type="search"
            list={searchSuggestions.length > 0 ? searchListId : undefined}
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchCopy.searchPlaceholder}
            className={isPanel ? 'min-h-11 w-full rounded-full border border-white/65 bg-white/86 py-2.5 pl-11 pr-11 text-center text-sm font-semibold text-slate-700 shadow-sm outline-none ring-1 ring-white/35 backdrop-blur-xl placeholder:text-center placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-400/70 md:text-left md:placeholder:text-left' : 'min-h-11 w-full rounded-full border border-white/65 bg-white/84 py-2.5 pl-11 pr-11 text-center text-sm font-semibold text-slate-700 shadow-sm outline-none ring-1 ring-white/35 backdrop-blur-xl placeholder:text-center placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-400/70 md:min-h-10 md:py-2 md:text-left md:placeholder:text-left'}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
              aria-label={searchCopy.clearSearch}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {searchSuggestions.length > 0 && (
            <datalist id={searchListId}>
              {searchSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          )}
        </div>
        <div ref={sortMenuRef} className="relative md:w-full">
          <span id="beach-sort-label" className="sr-only">
            {t.sortByTitle}
          </span>
          <button
            id="beach-sort"
            type="button"
            aria-labelledby="beach-sort-label beach-sort-value"
            aria-haspopup="listbox"
            aria-expanded={isSortOpen}
            onClick={() => setIsSortOpen(open => !open)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setIsSortOpen(true);
              }
            }}
            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-white/70 bg-white/88 px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm outline-none ring-1 ring-white/35 backdrop-blur-xl transition hover:border-cyan-200 hover:bg-white/95 focus:ring-2 focus:ring-cyan-400/70 md:min-h-10 md:py-2 dark:border-slate-700/40 dark:bg-slate-800/55 dark:text-slate-200 dark:ring-white/10"
          >
            <span id="beach-sort-value" className="min-w-0 flex-1 text-center">
              {selectedSortLabel}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {isSortOpen && (
            <div
              role="listbox"
              aria-labelledby="beach-sort-label"
              className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[1.15rem] border border-white/75 bg-white/96 p-1.5 shadow-xl shadow-sky-900/14 ring-1 ring-cyan-100/70 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/96 dark:ring-white/10"
            >
              {sortOptions.map(option => {
                const isSelected = option.value === selectedSortBy;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSortChange(option.value);
                      setIsSortOpen(false);
                    }}
                    className={`flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 text-left text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${
                      isSelected
                        ? 'bg-cyan-50 text-cyan-800'
                        : 'text-slate-600 hover:bg-cyan-50/70 hover:text-cyan-800 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-cyan-700" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {hasActiveChips && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 md:mt-2.5">
          {activePreferenceFilters.map(filter => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onPreferenceFilterClear(filter.key)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/76 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
              aria-label={searchCopy.removeFilter(filter.label)}
            >
              <span>{filter.label}</span>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}

          {activeAdvancedFilters.map(filter => (
            <button
              key={filter.key}
              type="button"
              onClick={() => onAdvancedFilterClear?.(filter.key)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/76 px-3 py-1.5 text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:cursor-default"
              aria-label={searchCopy.removeFilter(filter.label)}
              disabled={!onAdvancedFilterClear}
            >
              <span>{filter.label}</span>
              {onAdvancedFilterClear && <X className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ))}

          {hasActiveSearchOrFilters && (
            <button
              type="button"
              onClick={onClearAll}
              aria-label={searchCopy.clearAll}
              className="ml-auto inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-cyan-700 transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              {searchCopy.clearAll}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
