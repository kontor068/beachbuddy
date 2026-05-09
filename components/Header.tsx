
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, ChevronDown, Waves, MapPin } from 'lucide-react';
import { LanguageCode } from '../types';
import { Translation } from '../types';

interface HeaderProps {
  t: Translation;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  isScrolled?: boolean;
  isTransitioning?: boolean;
  selectedIslandName: string;
  selectedIslandMeta?: string;
  onOpenIslandSelector: () => void;
  onToggleNotifications?: () => void;
  notificationStatus?: NotificationPermission;
  isSubscribed?: boolean;
  isWinter: boolean;
}

const languages: { code: LanguageCode; name: string; flag: string }[] = [
  { code: 'en', name: 'EN', flag: '🇬🇧' },
  { code: 'gr', name: 'GR', flag: '🇬🇷' },
  { code: 'fr', name: 'FR', flag: '🇫🇷' },
  { code: 'de', name: 'DE', flag: '🇩🇪' },
  { code: 'it', name: 'IT', flag: '🇮🇹' },
];



const Header: React.FC<HeaderProps> = ({ t, language, onLanguageChange, selectedIslandName, selectedIslandMeta, onOpenIslandSelector, isWinter }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLanguage = languages.find(l => l.code === language) || languages[0];

  return (
    <header className="absolute top-0 left-0 right-0 z-50 transition-all duration-500 py-2 sm:py-4">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="glass dark:glass-dark rounded-2xl border border-white/40 dark:border-slate-800/50 shadow-lg transition-all duration-500 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] items-center gap-2 sm:gap-3">
            {/* Logo */}
            <div className="flex min-w-0 items-center justify-self-start gap-2 sm:gap-3 select-none group">
              <div className="relative shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-sky-400 to-cyan-600 rounded-xl flex items-center justify-center shadow-md">
                  <Waves className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </div>
              <h1 className="hidden min-[430px]:block truncate whitespace-nowrap font-heading font-bold text-sm sm:text-xl text-slate-900 dark:text-white tracking-tight">
                <span className="sm:hidden">Beach Now Greece</span>
                <span className="hidden sm:inline">Beach Now Greece</span>
              </h1>
            </div>

            <button
              onClick={onOpenIslandSelector}
              className="flex w-full min-w-0 max-w-xl items-center justify-center justify-self-center gap-1.5 rounded-xl px-1.5 py-1.5 text-slate-700 transition-all hover:bg-white/60 hover:text-primary sm:gap-2 sm:px-3"
              aria-label={language === 'gr' ? 'Αλλαγή τοποθεσίας' : 'Change location'}
            >
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="min-w-0 text-center">
                <span className="block truncate font-heading text-sm font-extrabold leading-tight text-slate-900 min-[360px]:text-base sm:text-lg">
                  {selectedIslandName || (language === 'gr' ? 'Τοποθεσία' : 'Location')}
                </span>
                {selectedIslandMeta && (
                  <span className="mt-0.5 block max-w-[11.5rem] whitespace-normal break-words text-center text-[9px] font-semibold leading-snug text-slate-500 min-[390px]:max-w-[13rem] min-[390px]:text-[10px] sm:max-w-none sm:truncate sm:whitespace-nowrap sm:text-[11px]">
                    {selectedIslandMeta}
                  </span>
                )}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 max-[340px]:hidden" />
            </button>

            {/* Actions */}
            <div className="flex min-w-0 shrink-0 items-center justify-self-end gap-1">
              {/* Language */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 px-2 py-2 sm:px-3 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                  aria-label="Change language"
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline uppercase tracking-wider">{currentLanguage.name}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl ring-1 ring-black/5 z-[100] border border-slate-100 dark:border-slate-800 p-1.5 overflow-hidden"
                    >
                      {languages.map(lang => (
                        <button
                          key={lang.code}
                          onClick={() => { onLanguageChange(lang.code); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${language === lang.code ? 'bg-sky-50 dark:bg-sky-900/20 text-primary' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                          <span className="text-base">{lang.flag}</span>
                          <span className="uppercase tracking-wider">{lang.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
