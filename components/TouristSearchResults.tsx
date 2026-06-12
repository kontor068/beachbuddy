import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { Beach } from '../types';
import { displayBeachName } from '../utils/localization';

interface TouristSearchResultsProps {
  results: Array<{ beach: Beach; score: number; explanation: string }>;
  onBeachClick: (beach: Beach) => void;
}

export const TouristSearchResults: React.FC<TouristSearchResultsProps> = ({ results, onBeachClick }) => {
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        No beaches found matching your search.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((item, idx) => (
        <motion.div
          key={item.beach.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          onClick={() => onBeachClick(item.beach)}
          className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-white font-bold text-sm shadow-sm">
                {item.score}
              </div>
              <div>
                <h4 className="font-heading font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                  {displayBeachName(item.beach.name, 'gr')}
                </h4>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
          </div>
          {item.explanation && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
              {item.explanation}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
};
