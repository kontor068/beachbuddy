import React from 'react';
import { motion } from 'motion/react';
import { Beach, LanguageCode, SortOption, Translation, WindDirection } from '../types';
import { BeachCard } from './BeachCard';

interface BeachListProps {
  beaches: Beach[];
  language: LanguageCode;
  t: Translation;
  windSpeed: number;
  windDirection: WindDirection;
  temperature?: number;
  islandName: string;
  onBeachClick: (beach: Beach) => void;
  favorites: number[];
  onToggleFavorite: (beachId: number) => void;
  sortBy: SortOption;
  hasShownAlternativeRecommendations: boolean;
}

const noMoreAlternativesMessage: Record<LanguageCode, string> = {
  en: 'No more alternative beaches were found for today.',
  gr: 'Δεν βρέθηκαν περισσότερες εναλλακτικές παραλίες σήμερα.',
  fr: 'Aucune autre plage alternative n’a été trouvée aujourd’hui.',
  de: 'Heute wurden keine weiteren alternativen Strände gefunden.',
  it: 'Non sono state trovate altre spiagge alternative per oggi.',
};

export const BeachList: React.FC<BeachListProps> = ({
  beaches,
  language,
  t,
  windSpeed,
  windDirection,
  temperature,
  islandName,
  onBeachClick,
  favorites,
  onToggleFavorite,
  sortBy,
  hasShownAlternativeRecommendations
}) => {
  if (beaches.length === 0) {
    const emptyMessage = sortBy === 'recommended' && hasShownAlternativeRecommendations
      ? noMoreAlternativesMessage[language]
      : sortBy === 'recommended'
      ? t.noWeatherRecommendedBeaches
      : t.noShelteredBeaches;

    return (
      <div className="col-span-full text-center py-20 glass dark:glass-dark rounded-3xl">
        <p className="text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
      {beaches.map((b, index) => {
        const isProtected = b.protectedFrom && b.protectedFrom.includes(windDirection);
        
        return (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <BeachCard 
              beach={b} 
              language={language} 
              t={t} 
              windSpeed={windSpeed} 
              temperature={temperature}
              favorites={favorites} 
              onToggleFavorite={onToggleFavorite} 
              islandName={islandName} 
              isCalm={isProtected}
              isExposed={!isProtected}
              onClick={() => onBeachClick(b)}
              crowdLevel={b.crowdLevel}
            />
          </motion.div>
        );
      })}
    </div>
  );
};
