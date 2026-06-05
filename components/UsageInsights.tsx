import React, { useMemo } from 'react';
import { getAnalyticsInsights } from '../services/analyticsService';
import { Beach, LanguageCode } from '../types';
import { motion } from 'motion/react';
import { displayBeachName } from '../utils/localization';

interface UsageInsightsProps {
  allBeaches: Beach[];
  language: LanguageCode;
  t: any;
}

export const UsageInsights: React.FC<UsageInsightsProps> = ({ allBeaches, language }) => {
  const insights = useMemo(() => getAnalyticsInsights(), []);

  const getBeachName = (id: number | string) => {
    const beach = allBeaches.find(b => b.id === Number(id));
    return beach ? displayBeachName(beach.name, language) : `Beach ${id}`;
  };

  const topBeaches = Object.entries(insights.beachViews)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topSearches = Object.entries(insights.searchLocations)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topFavorites = Object.entries(insights.beachFavorites)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (topBeaches.length === 0 && topSearches.length === 0 && topFavorites.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Usage Insights</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Top Viewed Beaches */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="text-lg">👁️</span> Most Viewed
          </h3>
          <div className="space-y-2">
            {topBeaches.map(([id, count], idx) => (
              <motion.div 
                key={id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {getBeachName(id)}
                </span>
                <span className="text-xs font-bold bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded-md">
                  {count} views
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Top Searched Locations */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="text-lg">🔍</span> Top Searches
          </h3>
          <div className="space-y-2">
            {topSearches.map(([query, count], idx) => (
              <motion.div 
                key={query}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {query}
                </span>
                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md">
                  {count} times
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Top Favorited Beaches */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="text-lg">❤️</span> Most Favorited
          </h3>
          <div className="space-y-2">
            {topFavorites.map(([id, count], idx) => (
              <motion.div 
                key={id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {getBeachName(id)}
                </span>
                <span className="text-xs font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md">
                  {count} favs
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
