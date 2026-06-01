import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Languages, Waves } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../utils/i18n';

interface HeaderProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isScrolled?: boolean;
  isTransitioning?: boolean;
  selectedIslandName: string;
  selectedIslandMeta?: string;
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

const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  forecastSlot,
}) => {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageLabel = languageLabels[language].label;
  const switchLanguageLabel = language === 'gr' ? 'Αλλαγή γλώσσας' : 'Change language';

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
        <div className="mx-auto flex h-[56px] max-w-[120rem] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0098b0] text-white shadow-sm shadow-cyan-900/10 ring-1 ring-cyan-700/10">
              <Waves className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="truncate text-lg font-extrabold tracking-normal text-[#007a83] sm:text-xl">
              Calm Beach Greece
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-700 sm:gap-3">
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
