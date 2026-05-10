import React from 'react';
import { motion } from 'motion/react';
import { Home, Map, Heart, MessageCircle, Calendar } from 'lucide-react';
import { LanguageCode } from '../types';

interface MobileBottomNavProps {
  language: LanguageCode;
  activeTab: 'home' | 'map' | 'favorites' | 'chat' | 'planner';
  onTabChange: (tab: 'home' | 'map' | 'favorites' | 'chat' | 'planner') => void;
  favoritesCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  language,
  activeTab,
  onTabChange,
  favoritesCount
}) => {
  const tabs = [
    {
      id: 'home' as const,
      icon: Home,
      label: language === 'gr' ? 'Αρχική' : 'Home',
    },
    {
      id: 'map' as const,
      icon: Map,
      label: language === 'gr' ? 'Χάρτης' : 'Map',
    },
    {
      id: 'favorites' as const,
      icon: Heart,
      label: language === 'gr' ? 'Αγαπημένα' : 'Favorites',
      badge: favoritesCount > 0 ? favoritesCount : undefined,
    },
    {
      id: 'chat' as const,
      icon: MessageCircle,
      label: 'Buddy',
    },
    {
      id: 'planner' as const,
      icon: Calendar,
      label: 'Planner',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Glass background */}
      <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-8px_28px_rgba(15,23,42,0.14)] px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center justify-center w-full h-full gap-0.5 cursor-pointer group"
                aria-label={tab.label}
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
                    fill={tab.id === 'favorites' && isActive ? 'currentColor' : 'none'}
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
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
