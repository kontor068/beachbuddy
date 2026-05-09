

import React from 'react';

interface BeachListTabsProps {
  activeTab: 'favorites' | 'sheltered' | 'exposed';
  onTabChange: (tab: 'favorites' | 'sheltered' | 'exposed') => void;
  counts: { favorites: number; sheltered: number; exposed: number };
  isCalm: boolean;
  t: any;
  isWinter: boolean;
}

const TabButton: React.FC<{
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  activeClasses: string;
  inactiveClasses: string;
}> = ({ label, count, isActive, onClick, activeClasses, inactiveClasses }) => (
  <button
    onClick={onClick}
    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 text-sm sm:text-base font-bold rounded-t-lg border-b-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
      isActive ? activeClasses : `${inactiveClasses} focus-visible:ring-cyan-500`
    }`}
    role="tab"
    aria-selected={isActive}
  >
    {label}
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${isActive ? 'bg-white/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200'}`}>
      {count}
    </span>
  </button>
);


const BeachListTabs: React.FC<BeachListTabsProps> = ({ activeTab, onTabChange, counts, isCalm, t, isWinter }) => {
  if (isCalm && !isWinter) {
    return null; // Don't show tabs on calm summer days
  }
  
  // In winter, we only show recommended (sheltered) beaches, so tabs are not needed.
  // The unsafe condition is handled by a different component in App.tsx.
  if (isWinter) {
      return null;
  }


  return (
    <div className="sticky top-[64px] md:top-[80px] z-30 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md px-4 md:px-6 -mb-px">
        <div className="flex border-b border-slate-200 dark:border-slate-700" role="tablist">
            {counts.favorites > 0 && (
                <TabButton
                    label={t.favoritesTitle}
                    count={counts.favorites}
                    isActive={activeTab === 'favorites'}
                    onClick={() => onTabChange('favorites')}
                    activeClasses="border-purple-500 text-purple-700 dark:text-purple-400"
                    inactiveClasses="border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-purple-500"
                />
            )}
            <TabButton
                label={t.shelteredTitle}
                count={counts.sheltered}
                isActive={activeTab === 'sheltered'}
                onClick={() => onTabChange('sheltered')}
                activeClasses="border-cyan-500 text-cyan-700 dark:text-cyan-400"
                inactiveClasses="border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600"
            />
            <TabButton
                label={t.exposedTitle}
                count={counts.exposed}
                isActive={activeTab === 'exposed'}
                onClick={() => onTabChange('exposed')}
                activeClasses="border-amber-500 text-amber-700 dark:text-amber-400"
                inactiveClasses="border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-amber-500"
            />
        </div>
    </div>
  );
};

export default BeachListTabs;