import React from 'react';
import { motion } from 'motion/react';
import { Calendar, CloudSun, Home, MessageCircle } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';

export type MobileTab = 'home' | 'weather' | 'favorites' | 'chat' | 'planner';

interface MobileBottomNavProps {
  language: LanguageCode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  showBuddy?: boolean;
  showPlanner?: boolean;
}

const navCopy: Record<LanguageCode, {
  home: string;
  weather: string;
  buddy: string;
  planner: string;
}> = {
  en: { home: 'Home', weather: 'Weather', buddy: 'Buddy', planner: 'Planner' },
  gr: { home: 'Αρχική', weather: 'Καιρός', buddy: 'Buddy', planner: 'Planner' },
  fr: { home: 'Accueil', weather: 'Meteo', buddy: 'Buddy', planner: 'Planner' },
  de: { home: 'Start', weather: 'Wetter', buddy: 'Buddy', planner: 'Planner' },
  it: { home: 'Home', weather: 'Meteo', buddy: 'Buddy', planner: 'Planner' },
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  language,
  activeTab,
  onTabChange,
  showBuddy = true,
  showPlanner = true,
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
      <div className="border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-around">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const tabLabel = tab.label;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-0.5"
                aria-label={tabLabel}
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -top-0.5 h-1 w-8 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
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
