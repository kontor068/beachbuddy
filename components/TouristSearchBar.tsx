import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Island, LanguageCode, Beach } from '../types';
import { fuzzySearchBeaches, FuzzyResult } from '../utils/fuzzySearch';
import { displayBeachName } from '../utils/localization';

interface TouristSearchBarProps {
  onSearch: (query: string) => void;
  onBeachSelect?: (beach: Beach) => void;
  placeholder?: string;
  initialValue?: string;
  allIslands?: Island[];
  language?: LanguageCode;
}

export const TouristSearchBar: React.FC<TouristSearchBarProps> = ({
  onSearch,
  onBeachSelect,
  placeholder = "Search beaches...",
  initialValue = "",
  allIslands = [],
  language = 'gr'
}) => {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Fuzzy search results as user types
  const suggestions = useMemo(() => {
    if (query.trim().length < 2 || allIslands.length === 0) return [];
    return fuzzySearchBeaches(query, allIslands, language, 6);
  }, [query, allIslands, language]);

  // Show dropdown when we have suggestions and input is focused
  useEffect(() => {
    setShowDropdown(isFocused && suggestions.length > 0 && query.trim().length >= 2);
    setSelectedIndex(-1);
  }, [suggestions, isFocused, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (result: FuzzyResult) => {
    const displayName = displayBeachName(result.beach.name, language);
    setQuery(displayName);
    setShowDropdown(false);
    if (onBeachSelect) {
      onBeachSelect(result.beach);
    } else {
      onSearch(displayName);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelect(suggestions[selectedIndex]);
    } else if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
    } else {
      onSearch(query);
    }
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative" ref={dropdownRef}>
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
          <Search className={`h-5 w-5 transition-colors duration-300 ${isFocused ? 'text-primary' : 'text-slate-400'}`} />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="block w-full pl-12 sm:pl-14 pr-12 py-3.5 sm:py-4 rounded-2xl border border-white/60 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-900 dark:text-white text-sm sm:text-base placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 shadow-lg"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        <div className="absolute right-3 top-0 bottom-0 flex items-center">
          <AnimatePresence>
            {query && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleClear}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-80 overflow-y-auto"
          >
            {suggestions.map((result, i) => {
              const displayName = displayBeachName(result.beach.name, language);
              const islandName = result.island.name[language] || result.island.name.en;
              const isSelected = i === selectedIndex;

              return (
                <button
                  key={`${result.beach.id}-${i}`}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer min-h-[48px] ${
                    isSelected
                      ? 'bg-sky-50 dark:bg-sky-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {islandName}
                      {result.matchScore >= 90 && (
                        <span className="ml-2 text-emerald-500">●</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-slate-300 dark:text-slate-600 flex-shrink-0">
                    ★ {result.beach.rating.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
