import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Heart, Home, Map, MessageCircle } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';

type MobileTab = 'home' | 'map' | 'favorites' | 'chat' | 'planner';

interface MobileBottomNavProps {
  language: LanguageCode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  showBuddy?: boolean;
  showPlanner?: boolean;
}

const navCopy: Record<LanguageCode, {
  home: string;
  map: string;
  favorites: string;
  buddy: string;
  planner: string;
}> = {
  en: { home: 'Home', map: 'Map', favorites: 'Favorites', buddy: 'Buddy', planner: 'Planner' },
  gr: { home: 'Αρχική', map: 'Χάρτης', favorites: 'Αγαπημένα', buddy: 'Buddy', planner: 'Planner' },
  fr: { home: 'Accueil', map: 'Carte', favorites: 'Favoris', buddy: 'Buddy', planner: 'Planner' },
  de: { home: 'Start', map: 'Karte', favorites: 'Favoriten', buddy: 'Buddy', planner: 'Planner' },
  it: { home: 'Home', map: 'Mappa', favorites: 'Preferiti', buddy: 'Buddy', planner: 'Planner' },
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  language,
  activeTab,
  onTabChange,
  showBuddy = true,
  showPlanner = true
}) => {
  const copy = getLocalizedCopy(language, navCopy);
  const tabs = [
    {
      id: 'home' as const,
      icon: Home,
      label: copy.home,
    },
    {
      id: 'map' as const,
      icon: Map,
      label: copy.map,
    },
    {
      id: 'favorites' as const,
      icon: Heart,
      badge: undefined,
      label: copy.favorites,
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glass background */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-8px_28px_rgba(15,23,42,0.14)] px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const tabLabel = tab.label;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center justify-center w-full h-full gap-0.5 cursor-pointer group"
                aria-label={tabLabel}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-0.5 w-8 h-1 bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors duration-200 ${
                      isActive
                        ? 'text-primary-dark'
                        : 'text-slate-600 group-active:text-primary-dark'
                    }`}
                    fill="none"
                  />
                  {tab.badge && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-4 flex items-center justify-center rounded-full bg-cta text-white text-[9px] font-bold px-1">
                      {tab.badge}
                    </span>
                  )}
                  {tab.id === 'planner' && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[8px] font-black text-white">
                      Pro
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
