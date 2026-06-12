import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CloudSun, Languages, Waves } from 'lucide-react';
import { getLocalizedCopy, languageToDateLocale, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../utils/i18n';
import { getSelectedDayOffset, getSelectedDaySentencePrefix } from '../utils/dateLabels';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isScrolled?: boolean;
  isTransitioning?: boolean;
  selectedIslandName: string;
  selectedIslandMeta?: string;
  selectedDate?: Date;
  onOpenIslandSelector: () => void;
  onToggleNotifications?: () => void;
  notificationStatus?: NotificationPermission;
  isSubscribed?: boolean;
  isWinter: boolean;
  forecastSlot?: React.ReactNode;
  onOpenFavorites?: () => void;
}

const languageLabels: Record<SupportedLanguage, { short: string; label: string }> = {
  en: { short: 'EN', label: 'English' },
  gr: { short: 'GR', label: 'Ελληνικά' },
  fr: { short: 'FR', label: 'Français' },
  de: { short: 'DE', label: 'Deutsch' },
  it: { short: 'IT', label: 'Italiano' },
};

const headerCopy: Record<SupportedLanguage, { changeLanguage: string }> = {
  en: { changeLanguage: 'Change language' },
  gr: { changeLanguage: 'Αλλαγή γλώσσας' },
  fr: { changeLanguage: 'Changer de langue' },
  de: { changeLanguage: 'Sprache ändern' },
  it: { changeLanguage: 'Cambia lingua' },
};

const headerTaglineCopy: Record<SupportedLanguage, string> = {
  en: 'Find a calmer beach today',
  gr: 'Βρες πιο ήρεμη παραλία σήμερα',
  fr: 'Trouvez une plage plus calme',
  de: 'Finde heute einen ruhigeren Strand',
  it: 'Trova oggi una spiaggia piu calma',
};

const getNextLocalMidnightDelay = (date: Date = new Date()): number => {
  const nextMidnight = new Date(date);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);

  return Math.max(1000, nextMidnight.getTime() - date.getTime() + 1000);
};

const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  selectedIslandMeta,
  selectedDate,
  forecastSlot,
}) => {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageLabel = languageLabels[language].label;
  const switchLanguageLabel = getLocalizedCopy(language, headerCopy).changeLanguage;
  const tagline = headerTaglineCopy[language] || headerTaglineCopy.en;
  const headerDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat(languageToDateLocale(language), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(currentDate);
  }, [language, currentDate]);

  const selectedIslandMetaLabel = useMemo(() => {
    if (!selectedIslandMeta) return undefined;
    if (!selectedDate) return selectedIslandMeta;

    const dayOffset = getSelectedDayOffset(selectedDate, currentDate);
    if (dayOffset === 0) {
      return selectedIslandMeta;
    }

    return `${getSelectedDaySentencePrefix(selectedDate, currentDate, language)}: ${selectedIslandMeta}`;
  }, [currentDate, language, selectedDate, selectedIslandMeta]);
  const showHeaderConditions = Boolean(headerDateLabel || selectedIslandMetaLabel);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentDate(new Date());
    }, getNextLocalMidnightDelay(currentDate));

    return () => window.clearTimeout(timeoutId);
  }, [currentDate]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLanguageMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLanguageMenuOpen]);

  return (
    <header className="relative z-50">
      <div className="sticky top-0 z-50 border-b border-white/70 bg-white/82 text-slate-800 shadow-sm shadow-sky-900/5 backdrop-blur-xl">
        <div className="relative flex h-[60px] w-full items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-[58px] lg:px-8">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0098b0] text-white shadow-sm shadow-cyan-900/10 ring-1 ring-cyan-700/10">
              <Waves className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-base font-extrabold leading-tight tracking-normal text-[#007a83] sm:text-xl">
                Calm Beach Greece
              </span>
              <span
                className="ml-1.5 mt-0.5 block truncate text-[11px] font-semibold italic leading-[1.05] text-[#00879a]/78 sm:ml-2 sm:text-[12px]"
                style={{
                  fontFamily: '"Segoe Print", "Bradley Hand ITC", "Comic Sans MS", cursive',
                  letterSpacing: 0,
                }}
              >
                {tagline}
              </span>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden min-w-0 -translate-x-1/2 -translate-y-1/2 justify-center lg:flex">
            {showHeaderConditions && (
              <div className="pointer-events-auto flex max-w-[min(54rem,calc(100vw-34rem))] min-w-0 items-center gap-3 rounded-full border border-sky-100 bg-sky-50/70 px-3.5 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm shadow-sky-900/5 ring-1 ring-white/60">
                {headerDateLabel && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-900">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#007a83]" aria-hidden="true" />
                    <span className="truncate">{headerDateLabel}</span>
                  </span>
                )}
                {headerDateLabel && selectedIslandMetaLabel && (
                  <span className="h-4 w-px shrink-0 bg-sky-200" aria-hidden="true" />
                )}
                {selectedIslandMetaLabel && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-600">
                    <CloudSun className="h-3.5 w-3.5 shrink-0 text-[#007a83]" aria-hidden="true" />
                    <span className="truncate">{selectedIslandMetaLabel}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-700 sm:gap-3">
            <div ref={languageMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsLanguageMenuOpen(open => !open)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 transition hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                aria-label={switchLanguageLabel}
                aria-haspopup="listbox"
                aria-expanded={isLanguageMenuOpen}
              >
                <Languages className="h-4 w-4 text-[#007a83]" aria-hidden="true" />
                <span className="hidden sm:inline">{languageLabel}</span>
                <span className="sm:hidden">{languageLabels[language].short}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {isLanguageMenuOpen && (
                <div
                  role="listbox"
                  aria-label={switchLanguageLabel}
                  className="absolute right-0 top-full z-[60] mt-2 w-44 overflow-hidden rounded-2xl border border-cyan-100 bg-white/96 p-1.5 text-sm font-bold text-slate-700 shadow-xl shadow-sky-900/14 ring-1 ring-white/70 backdrop-blur-xl"
                >
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const selected = lang === language;
                    return (
                      <button
                        key={lang}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onLanguageChange(lang);
                          setIsLanguageMenuOpen(false);
                        }}
                        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                          selected ? 'bg-cyan-50 text-[#007a83]' : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
                        }`}
                      >
                        <span className="min-w-0 truncate">{languageLabels[lang].label}</span>
                        <span className="inline-flex items-center gap-2 text-xs font-extrabold">
                          {languageLabels[lang].short}
                          {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {forecastSlot}
    </header>
  );
};

export default Header;
