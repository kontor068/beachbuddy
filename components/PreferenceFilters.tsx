
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { VolumeX, BadgeCheck, Search, Waves, Droplets, Mountain, SlidersHorizontal, Users, MapPin, Flag, Accessibility } from 'lucide-react';
import { UserPreferences } from '../types';
import { getPreferenceFilterLabel, QUICK_PREFERENCE_FILTERS } from '../utils/preferenceFilterLabels';
import { SandDotsIcon } from './BeachFeatureIcons';

interface PreferenceFiltersProps {
  preferences: UserPreferences;
  onToggle: (key: keyof UserPreferences) => void;
  filterResultCounts?: Partial<Record<keyof UserPreferences, number>>;
  t: any; // Translation object
  variant?: 'default' | 'panel';
}

export const PreferenceFilters: React.FC<PreferenceFiltersProps> = ({ preferences, onToggle, filterResultCounts, t, variant = 'default' }) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const isPanel = variant === 'panel';
  const language = t.locale === 'el-GR' ? 'gr' : 'en';
  const icons: Partial<Record<keyof UserPreferences, React.ReactNode>> = {
    blueFlag2026: <Flag size={16} />,
    disabledAccess: <Accessibility size={16} />,
    sandy: <SandDotsIcon size={16} />,
    pebbles: <Mountain size={16} />,
    quiet: <VolumeX size={16} />,
    beachBar: <BadgeCheck size={16} />,
    easyAccess: <MapPin size={16} />,
    snorkeling: <Search size={16} />,
    familyFriendly: <Users size={16} />,
    deepWater: <Waves size={16} />,
    shallowWater: <Droplets size={16} />,
  };
  const filterItems: { key: keyof UserPreferences; label: string; icon: React.ReactNode }[] =
    QUICK_PREFERENCE_FILTERS.map(key => ({
      key,
      label: getPreferenceFilterLabel(key, language, t),
      icon: icons[key],
    }));
  const primaryFilters = filterItems.slice(0, 5);
  const secondaryFilters = filterItems.slice(4);
  const visibleFilters = showMoreFilters ? filterItems : primaryFilters;
  const hiddenActiveCount = secondaryFilters.filter(item => preferences[item.key]).length;
  const moreLabel = t.locale === 'el-GR' ? 'Άλλα' : 'More';
  const lessLabel = t.locale === 'el-GR' ? 'Λιγότερα' : 'Less';

  return (
    <div className={isPanel ? 'relative py-0' : 'relative py-1.5 sm:py-4'}>
      <div className={isPanel ? 'grid grid-cols-2 gap-2 min-[390px]:grid-cols-3 sm:flex sm:flex-wrap sm:justify-center sm:px-0 sm:pb-0' : 'grid grid-cols-2 gap-2 min-[390px]:grid-cols-3 sm:flex sm:flex-wrap sm:justify-center'}>
      {visibleFilters.map((item) => {
        const isActive = preferences[item.key];
        const wouldReturnNoResults = !isActive && filterResultCounts?.[item.key] === 0;
        return (
          <motion.button
            key={item.key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggle(item.key)}
            aria-describedby={wouldReturnNoResults ? `${item.key}-no-results-hint` : undefined}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-full border px-3 py-2 text-xs font-semibold leading-tight backdrop-blur-md transition-all shadow-sm sm:min-h-10 sm:px-4 sm:text-sm ${
              isActive
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-200/70'
                : wouldReturnNoResults
                ? 'border-white/50 bg-white/48 text-slate-500 shadow-none hover:border-cyan-300 hover:bg-white/72 hover:text-cyan-600'
                : 'bg-white/62 text-slate-600 border-white/65 hover:border-cyan-300 hover:bg-white/80 hover:text-cyan-600'
            }`}
          >
            <span className="grid h-4 w-4 shrink-0 place-items-center sm:h-5 sm:w-5">{item.icon}</span>
            <span className={isPanel ? 'min-w-0 truncate text-center' : 'whitespace-nowrap text-center'}>{item.label}</span>
            {wouldReturnNoResults && (
              <span id={`${item.key}-no-results-hint`} className="sr-only">
                {t.locale === 'el-GR' ? 'Ίσως δεν υπάρχουν αποτελέσματα με τα τρέχοντα φίλτρα.' : 'This may return no results with the current filters.'}
              </span>
            )}
          </motion.button>
        );
      })}
      {!showMoreFilters && secondaryFilters.length > 0 && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMoreFilters(true)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-full border px-3 py-2 text-xs font-semibold leading-tight backdrop-blur-md transition-all shadow-sm sm:min-h-10 sm:px-4 sm:text-sm ${
            hiddenActiveCount > 0
              ? 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-200/70'
              : 'bg-white/58 text-slate-600 border-white/60 hover:border-cyan-300 hover:bg-white/78 hover:text-cyan-600'
          }`}
        >
          <span className="grid h-4 w-4 shrink-0 place-items-center sm:h-5 sm:w-5"><SlidersHorizontal size={16} /></span>
          <span className={isPanel ? 'min-w-0 truncate text-center' : 'whitespace-nowrap text-center'}>{hiddenActiveCount > 0 ? `${moreLabel} ${hiddenActiveCount}` : moreLabel}</span>
        </motion.button>
      )}
      {showMoreFilters && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowMoreFilters(false)}
          className="flex min-h-11 min-w-0 items-center justify-center gap-2 overflow-hidden rounded-full border border-white/55 bg-white/52 px-3 py-2 text-xs font-semibold leading-tight text-slate-600 shadow-sm backdrop-blur-md transition-all hover:border-cyan-300 hover:bg-white/72 hover:text-cyan-600 sm:min-h-10 sm:px-4 sm:text-sm"
        >
          <span className="grid h-4 w-4 shrink-0 place-items-center sm:h-5 sm:w-5"><SlidersHorizontal size={16} /></span>
          <span className={isPanel ? 'min-w-0 truncate text-center' : 'whitespace-nowrap text-center'}>{lessLabel}</span>
        </motion.button>
      )}
      </div>
    </div>
  );
};
