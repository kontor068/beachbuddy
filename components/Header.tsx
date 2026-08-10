import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CloudSun, Languages, User } from 'lucide-react';
import AccountPanel from './account/AccountPanel';
import type { BeachProfile } from '../types';
import { getLocalizedCopy, languageToDateLocale, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../utils/i18n';
import { getSelectedDayOffset, getSelectedDaySentencePrefix } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';

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
  onGoHome?: () => void;
  // Accounts. All optional: when Supabase is not configured the app passes
  // nothing and the header renders exactly as it did before accounts existed.
  authAvailable?: boolean;
  accountName?: string | null;
  accountAvatarUrl?: string | null;
  isSignedIn?: boolean;
  accountEmail?: string | null;
  accountUserId?: string | null;
  savedCount?: number;
  savedOtherIslandsCount?: number;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => Promise<{ ok: boolean; error?: string }>;
  onAddPhoto?: () => void;
  beachProfile?: BeachProfile;
  onBeachProfileChange?: (next: BeachProfile) => void;
}

const languageLabels: Record<SupportedLanguage, { short: string; label: string }> = {
  en: { short: 'EN', label: 'English' },
  gr: { short: 'GR', label: 'Ελληνικά' },
  fr: { short: 'FR', label: 'Français' },
  de: { short: 'DE', label: 'Deutsch' },
  it: { short: 'IT', label: 'Italiano' },
};

const headerCopy: Record<SupportedLanguage, { changeLanguage: string; home: string }> = {
  en: { changeLanguage: 'Change language', home: 'CalmBeach home' },
  gr: { changeLanguage: 'Αλλαγή γλώσσας', home: 'Αρχική CalmBeach' },
  fr: { changeLanguage: 'Changer de langue', home: 'Accueil CalmBeach' },
  de: { changeLanguage: 'Sprache ändern', home: 'CalmBeach Startseite' },
  it: { changeLanguage: 'Cambia lingua', home: 'Home CalmBeach' },
};

// Written per-component rather than added to translations.ts: that file is its own
// bundle chunk (app-i18n) that every visitor downloads, and six strings for a
// feature most people never touch do not belong in it.
const accountCopy: Record<SupportedLanguage, { signIn: string; signOut: string; account: string }> = {
  en: { signIn: 'Sign in', signOut: 'Sign out', account: 'Your account' },
  gr: { signIn: 'Σύνδεση', signOut: 'Αποσύνδεση', account: 'Ο λογαριασμός σου' },
  fr: { signIn: 'Connexion', signOut: 'Déconnexion', account: 'Votre compte' },
  de: { signIn: 'Anmelden', signOut: 'Abmelden', account: 'Dein Konto' },
  it: { signIn: 'Accedi', signOut: 'Esci', account: 'Il tuo account' },
};

const getNextLocalMidnightDelay = (date: Date = athensNow()): number => {
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
  onGoHome,
  authAvailable = false,
  accountName,
  accountAvatarUrl,
  isSignedIn = false,
  accountEmail,
  accountUserId,
  savedCount = 0,
  savedOtherIslandsCount = 0,
  onSignIn,
  onSignOut,
  onDeleteAccount,
  onAddPhoto,
  beachProfile,
  onBeachProfileChange,
  onOpenFavorites,
}) => {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountLabels = getLocalizedCopy(language, accountCopy);
  const [currentDate, setCurrentDate] = useState(() => athensNow());
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const languageLabel = languageLabels[language].label;
  const switchLanguageLabel = getLocalizedCopy(language, headerCopy).changeLanguage;
  const homeLabel = getLocalizedCopy(language, headerCopy).home;
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
      setCurrentDate(athensNow());
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

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (accountMenuRef.current?.contains(target)) return;
      // On a phone the panel is a sheet portalled to <body> (it has to escape
      // the header's backdrop-filter), so it is not inside accountMenuRef.
      // Without this it would close on its own first tap.
      if (target instanceof Element && target.closest('[data-account-panel]')) return;
      setIsAccountMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  // NOTE: no z-index on the outer <header>. It wraps the whole hero, map and
  // today's picks (~1600px tall), so a z-index turned it into a stacking
  // context that swallowed every FOLLOWING sibling section painted at a lower
  // z: the trip planner strip and the "more sheltered options" section both
  // rendered as blank bands — real layout, real text, hit-testable, zero
  // pixels. The sticky bar below keeps its own z-50, which is what actually
  // needs to float over the page while scrolling.
  return (
    <header className="relative">
      <div className="sticky top-0 z-50 border-b border-white/70 bg-white/82 text-slate-800 shadow-sm shadow-sky-900/5 backdrop-blur-xl">
        <div className="relative flex h-[60px] w-full items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:h-[58px] lg:px-8">
          <button
            type="button"
            onClick={onGoHome}
            disabled={!onGoHome}
            aria-label={homeLabel}
            className="flex min-w-0 shrink-0 items-center gap-3 rounded-xl text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 enabled:cursor-pointer enabled:hover:opacity-80 disabled:cursor-default"
          >
            <img
              src="/calmbeach-mark.svg"
              alt="CalmBeach"
              className="h-[39px] w-[39px] shrink-0"
              width={39}
              height={39}
            />
            <div className="min-w-0">
              <span className="block truncate text-[17.5px] font-extrabold leading-tight tracking-normal text-[#007a83] sm:text-[22px]">
                CalmBeach
              </span>
            </div>
          </button>

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
            {/* Accounts render nothing at all unless Supabase is configured — the
                header is byte-identical to before for a build without them. */}
            {authAvailable && !isSignedIn && onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 transition hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
              >
                <User className="h-4 w-4 text-[#007a83]" aria-hidden="true" />
                <span className="hidden sm:inline">{accountLabels.signIn}</span>
              </button>
            )}

            {authAvailable && isSignedIn && (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen(open => !open)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                  aria-label={accountLabels.account}
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                >
                  {accountAvatarUrl ? (
                    <img
                      src={accountAvatarUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-cyan-100"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-50 text-xs font-extrabold text-[#007a83] ring-1 ring-cyan-100">
                      {(accountName || '?').trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-700 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                {isAccountMenuOpen && onDeleteAccount && (
                  <AccountPanel
                    language={language}
                    name={accountName ?? null}
                    email={accountEmail ?? null}
                    userId={accountUserId ?? null}
                    avatarUrl={accountAvatarUrl ?? null}
                    savedCount={savedCount}
                    savedOtherIslandsCount={savedOtherIslandsCount}
                    onOpenSaved={() => onOpenFavorites?.()}
                    onAddPhoto={onAddPhoto}
                    beachProfile={beachProfile}
                    onBeachProfileChange={onBeachProfileChange}
                    onSignOut={() => {
                      setIsAccountMenuOpen(false);
                      onSignOut?.();
                    }}
                    onDeleteAccount={onDeleteAccount}
                    onClose={() => setIsAccountMenuOpen(false)}
                  />
                )}
              </div>
            )}

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
                <ChevronDown className={`h-3.5 w-3.5 text-slate-700 transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
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
