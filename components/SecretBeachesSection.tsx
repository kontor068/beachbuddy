import React from 'react';
import { motion } from 'motion/react';
import { Navigation, Compass } from 'lucide-react';
import { SecretBeach, LanguageCode, Translation } from '../types';

interface SecretBeachesSectionProps {
  beaches: SecretBeach[];
  language: LanguageCode;
  t: Translation;
  onBeachClick: (beach: any) => void;
}

export const SecretBeachesSection: React.FC<SecretBeachesSectionProps> = ({
  beaches,
  language,
  t,
  onBeachClick,
}) => {
  if (beaches.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 dark:text-slate-400">
          {language === 'gr' ? 'Δεν βρέθηκαν πιο ήσυχες επιλογές για τις τρέχουσες συνθήκες.' : 'No hidden gems found for the current conditions. Try Explore Mode!'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {beaches.map((item, index) => (
        <motion.div
          key={item.beachId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onBeachClick(item.beach)}
          className="group relative bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer border border-slate-100 dark:border-slate-800"
        >
          {/* Label */}
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-emerald-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg">
              <Compass size={12} />
              {language === 'gr' ? 'Ήσυχη επιλογή' : 'Hidden Gem'}
            </div>
          </div>

          {/* Score Badge */}
          <div className="absolute top-4 right-4 z-10">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-white/20 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 tracking-tighter">{language === 'gr' ? 'Σκορ ησυχίας' : 'Secret Score'}</span>
              <span className="text-lg font-heading font-bold text-emerald-600 dark:text-emerald-400">{item.secretScore}%</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 pt-16 space-y-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-heading font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                {item.name}
              </h3>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                {item.distance !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Navigation size={14} className="text-emerald-500" />
                    <span>{item.distance.toFixed(1)} km</span>
                  </div>
                )}
              </div>
            </div>

            <p
              className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed"
              data-nosnippet="true"
            >
              {item.explanation}
            </p>

            <div className="pt-4 flex items-center justify-between border-t border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const canClaimWindProtection = (item as { canClaimWindProtection?: boolean }).canClaimWindProtection === true;
                    const label = item.isExposed
                      ? (language === 'gr' ? 'Πιο ανοιχτή στον άνεμο' : 'More open to wind')
                      : canClaimWindProtection
                        ? (language === 'gr' ? 'Πιο προστατευμένη' : 'Likely sheltered')
                        : (language === 'gr' ? 'Έλεγχος τοπικής έκθεσης' : 'Check local exposure');

                    return (
                      <>
                        <div className={`w-2 h-2 rounded-full ${canClaimWindProtection ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className="text-[10px] font-bold text-slate-400">
                          {label}
                        </span>
                      </>
                    );
                  })()}
                </div>
                
                {item.crowdLevel && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">
                      {t.crowdLevels[item.crowdLevel]}
                    </span>
                  </div>
                )}
              </div>
              <button
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform"
                data-nosnippet="true"
              >
                {language === 'gr' ? 'Λεπτομέρειες →' : 'View details →'}
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
