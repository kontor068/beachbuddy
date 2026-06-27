import React from 'react';
import { Calendar, CloudSun, Heart, Home, MessageCircle } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';

export type MobileTab = 'home' | 'weather' | 'favorites' | 'chat' | 'planner';

interface MobileBottomNavProps {
  language: LanguageCode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  /** When false the bar slides off-screen (used to keep it hidden over the home map until
   *  the user reaches the beach list). Defaults to visible. */
  visible?: boolean;
  showBuddy?: boolean;
  showPlanner?: boolean;
  /** Number of saved beaches — shown as a count badge on the Saved tab. */
  favoritesCount?: number;
}

const navCopy: Record<LanguageCode, {
  home: string;
  weather: string;
  saved: string;
  buddy: string;
  planner: string;
}> = {
  en: { home: 'Home', weather: 'Weather', saved: 'Saved', buddy: 'Buddy', planner: 'Planner' },
  gr: { home: 'Αρχική', weather: 'Καιρός', saved: 'Αποθηκευμένα', buddy: 'Buddy', planner: 'Planner' },
  fr: { home: 'Accueil', weather: 'Meteo', saved: 'Favoris', buddy: 'Buddy', planner: 'Planner' },
  de: { home: 'Start', weather: 'Wetter', saved: 'Gespeichert', buddy: 'Buddy', planner: 'Planner' },
  it: { home: 'Home', weather: 'Meteo', saved: 'Salvate', buddy: 'Buddy', planner: 'Planner' },
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  language,
  activeTab,
  onTabChange,
  visible = true,
  showBuddy = true,
  showPlanner = true,
  favoritesCount = 0,
}) => {
  const copy = getLocalizedCopy(language, navCopy);
  const tabs = [
    {
      id: 'home' as const,
      icon: Home,
      label: copy.home,
    },
    {
      id: 'weather' as const,
      icon: CloudSun,
      label: copy.weather,
    },
    {
      id: 'favorites' as const,
      icon: Heart,
      label: copy.saved,
    },
    ...(showBuddy ? [{
      id: 'chat' as const,
      icon: MessageCircle,
      label: copy.buddy,
    }] : []),
    ...(showPlanner ? [{
      id: 'planner' as const,
      icon: Calendar,
      label: copy.planner,
    }] : []),
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
      aria-hidden={visible ? undefined : true}
    >
      <div className="border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const tabLabel = tab.label;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="group relative flex h-full max-w-[7rem] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5"
                aria-label={tabLabel}
              >
                {isActive && (
                  <div className="absolute -top-0.5 h-1 w-8 rounded-full bg-primary transition-all duration-200" />
                )}
                <div className="relative">
                  <Icon
                    className={`h-5 w-5 transition-colors duration-200 ${
                      isActive
                        ? 'text-primary-dark'
                        : 'text-slate-600 group-active:text-primary-dark'
                    }`}
                    fill="none"
                  />
                  {tab.id === 'planner' && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[8px] font-black text-white">
                      Pro
                    </span>
                  )}
                  {tab.id === 'favorites' && favoritesCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white">
                      {favoritesCount > 9 ? '9+' : favoritesCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold transition-colors duration-200 ${
                    isActive
                      ? 'text-primary-dark'
                      : 'text-slate-600'
                  }`}
                >
                  {tabLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
