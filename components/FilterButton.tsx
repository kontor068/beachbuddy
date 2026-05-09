import React from 'react';

interface FilterButtonProps {
  onClick: () => void;
  activeFilterCount: number;
  t: any;
}

const FilterButton: React.FC<FilterButtonProps> = ({ onClick, activeFilterCount, t }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)] to-transparent pointer-events-none z-30">
        <button
        onClick={onClick}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center px-6 py-3 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold rounded-full shadow-2xl hover:bg-slate-900 dark:hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-100 pointer-events-auto"
        aria-label={t.openFiltersLabel || 'Open filters'}
        >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
        </svg>
        <span>{t.filtersButtonLabel || 'Filters'}</span>
        {activeFilterCount > 0 && (
            <span className="ml-2 bg-cyan-400 text-slate-900 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
            {activeFilterCount}
            </span>
        )}
        </button>
    </div>
  );
};

export default FilterButton;