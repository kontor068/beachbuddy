
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { VolumeX, Beer, Search, Waves, Droplets, Mountain, SlidersHorizontal } from 'lucide-react';
import { UserPreferences } from '../types';

interface PreferenceFiltersProps {
  preferences: UserPreferences;
  onToggle: (key: keyof UserPreferences) => void;
  t: any; // Translation object
}

const SandIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 16c3-3 6-3 9 0s6 3 9 0" />
    <path d="M5 20c2-1.5 4-1.5 6 0s4 1.5 6 0" />
    <path d="M7 11h.01" />
    <path d="M12 8h.01" />
    <path d="M17 11h.01" />
  </svg>
);

export const PreferenceFilters: React.FC<PreferenceFiltersProps> = ({ preferences, onToggle, t }) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const filterItems: { key: keyof UserPreferences; label: string; icon: React.ReactNode }[] = [
    { key: 'sandy', label: t.userPreferences.sandy, icon: <SandIcon size={16} /> },
    { key: 'pebbles', label: t.userPreferences.pebbles, icon: <Mountain size={16} /> },
    { key: 'quiet', label: t.userPreferences.quiet, icon: <VolumeX size={16} /> },
    { key: 'beachBar', label: t.userPreferences.beachBar, icon: <Beer size={16} /> },
    { key: 'snorkeling', label: t.userPreferences.snorkeling, icon: <Search size={16} /> },
    { key: 'deepWater', label: t.userPreferences.deepWater, icon: <Waves size={16} /> },
    { key: 'shallowWater', label: t.userPreferences.shallowWater, icon: <Droplets size={16} /> },
  ];
  const primaryFilters = filterItems.slice(0, 4);
  const secondaryFilters = filterItems.slice(4);
  const visibleFilters = showMoreFilters ? filterItems : primaryFilters;
  const hiddenActiveCount = secondaryFilters.filter(item => preferences[item.key]).length;
  const moreLabel = t.locale === 'el-GR' ? 'Περισσότερα' : 'More';
  const lessLabel = t.locale === 'el-GR' ? 'Λιγότερα' : 'Less';

  return (
    <div className="py-2 sm:py-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
      {visibleFilters.map((item) => {
        const isActive = preferences[item.key];
        return (
          <motion.button
            key={item.key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggle(item.key)}
            className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full border px-2.5 py-2 text-xs font-bold leading-tight transition-all shadow-sm sm:px-4 sm:text-sm ${
              isActive
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-200'
                : 'bg-white/90 text-slate-700 border-white/80 hover:border-cyan-300 hover:text-cyan-600'
            }`}
          >
            <span className="grid h-4 w-4 place-items-center sm:h-5 sm:w-5">{item.icon}</span>
            <span className="min-w-0 text-center">{item.label}</span>
          </motion.button>
        );
      })}
      {!showMoreFilters && secondaryFilters.length > 0 && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMoreFilters(true)}
          className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full border px-2.5 py-2 text-xs font-bold leading-tight transition-all shadow-sm sm:px-4 sm:text-sm ${
            hiddenActiveCount > 0
              ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-200'
              : 'bg-white/75 text-slate-700 border-white/70 hover:border-cyan-300 hover:text-cyan-600'
          }`}
        >
          <span className="grid h-4 w-4 place-items-center sm:h-5 sm:w-5"><SlidersHorizontal size={16} /></span>
          <span className="min-w-0 text-center">{hiddenActiveCount > 0 ? `${moreLabel} (${hiddenActiveCount})` : moreLabel}</span>
        </motion.button>
      )}
      {showMoreFilters && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMoreFilters(false)}
          className="flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-full border border-white/70 bg-white/55 px-2.5 py-2 text-xs font-bold leading-tight text-slate-600 shadow-sm transition-all hover:border-cyan-300 hover:text-cyan-600 sm:px-4 sm:text-sm"
        >
          <span className="grid h-4 w-4 place-items-center sm:h-5 sm:w-5"><SlidersHorizontal size={16} /></span>
          <span className="min-w-0 text-center">{lessLabel}</span>
        </motion.button>
      )}
      </div>
    </div>
  );
};
