import React from 'react';
import { motion } from 'motion/react';
import { Beach, LanguageCode, SuitableBeach } from '../types';
import { Translation } from '../types';
import { StarRating } from './BeachCard';
import { openNavigation } from '../utils/navigation';
import { Trophy, Share2, Shield, Clock, MapPin, BadgeCheck, Leaf, Droplets, Info, Compass, Route } from 'lucide-react';
import { displayBeachName, localizedOrganizationLabel, localizedWaterDepthLabel } from '../utils/localization';

interface BeachOfTheDayProps {
  topBeach: SuitableBeach;
  language: LanguageCode;
  t: Translation;
  onShowDetails: (beach: Beach) => void;
  islandName: string;
  windSpeed: number;
  temperature: number;
}

const BeachOfTheDay: React.FC<BeachOfTheDayProps> = ({ topBeach, language, t, onShowDetails, islandName }) => {
  const { beach, score, explanation, bestBeachTime, isExposed, distance } = topBeach;
  if (!beach) return null;

  const beachDisplayName = displayBeachName(beach.name, language);
  const isOrganized = beach.metadata?.organized ?? Boolean(beach.amenities?.organized);
  const waterDepthType = beach.metadata?.waterDepth?.type || (beach.characteristics?.shallowWaters ? 'shallow' : 'deep');
  const waterDepthLabel = localizedWaterDepthLabel(waterDepthType, beach.metadata?.waterDepth?.label, language);
  const accessLabel = beach.accessibility && t.accessibility?.[beach.accessibility]
    ? t.accessibility[beach.accessibility]
    : t.filterOptions.easyAccess;
  const bestTimeValue = bestBeachTime
    ? bestBeachTime.bestStart === bestBeachTime.bestEnd
      ? ({
          en: `Around ${bestBeachTime.bestStart}`,
          gr: `Γύρω στις ${bestBeachTime.bestStart}`,
          de: `Gegen ${bestBeachTime.bestStart}`,
          it: `Verso le ${bestBeachTime.bestStart}`,
          fr: `Vers ${bestBeachTime.bestStart}`,
        }[language])
      : `${bestBeachTime.bestStart} - ${bestBeachTime.bestEnd}`
    : '';

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: t.sharing.text(beachDisplayName),
          url: window.location.origin + window.location.pathname,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error('Error sharing:', error);
      }
    }
  };

  const scoreColor = score >= 85 ? 'text-emerald-500' : score >= 70 ? 'text-sky-500' : 'text-amber-500';
  const scoreBg = score >= 85 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/30' : score >= 70 ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/50 dark:border-sky-800/30' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30';
  const scoreLabel = score >= 85
    ? ({ en: 'Excellent conditions', gr: 'Εξαιρετικές συνθήκες', de: 'Ausgezeichnete Bedingungen', it: 'Condizioni eccellenti', fr: 'Conditions excellentes' }[language])
    : score >= 70
      ? ({ en: 'Very good conditions', gr: 'Πολύ καλές συνθήκες', de: 'Sehr gute Bedingungen', it: 'Condizioni molto buone', fr: 'Tres bonnes conditions' }[language])
      : ({ en: 'Good conditions', gr: 'Καλές συνθήκες', de: 'Gute Bedingungen', it: 'Buone condizioni', fr: 'Bonnes conditions' }[language]);
  const pillBaseClass = 'flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-2 text-center text-[11px] font-semibold leading-none sm:inline-flex sm:min-h-0 sm:w-auto sm:px-3 sm:py-1.5 sm:text-xs';
  const pillTextClass = 'min-w-0 truncate';

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-gradient-to-br from-white/90 via-sky-50/50 to-cyan-50/40 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-sky-950/50 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-slate-800/50 shadow-xl shadow-sky-100/30 dark:shadow-none"
    >
      {/* Decorative elements */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-sky-200/20 dark:bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-cyan-200/15 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-6 sm:p-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-md shadow-amber-200/40 dark:shadow-none">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-bold text-slate-800 dark:text-white">
                {t.beachOfTheDayTitle}
              </h2>
              <p className="text-[10px] font-medium text-sky-400 dark:text-sky-500 tracking-wider">
                {islandName}
              </p>
            </div>
          </div>

        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left: Beach info */}
          <div className="flex-grow space-y-4">
            <div>
              <h3 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 dark:text-white mb-2">
                {beachDisplayName}
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <StarRating rating={beach.rating} colorClassName="text-amber-400" emptyColorClassName="text-slate-200 dark:text-slate-700" />
                <span className="text-sm font-heading font-bold text-slate-600 dark:text-slate-300">{beach.rating.toFixed(1)}</span>
                {distance !== undefined && (
                  <span className="flex items-center gap-1 text-xs font-medium text-sky-400">
                    <MapPin className="w-3 h-3" />
                    {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
                  </span>
                )}
              </div>
            </div>

            {/* Why this beach */}
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
              {explanation}
            </p>

            {/* Condition pills */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <div className={`${pillBaseClass} ${!isExposed ? 'bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30' : 'bg-amber-50/80 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/30'}`}>
                <Shield className="h-3 w-3 shrink-0" />
                <span className={pillTextClass}>{!isExposed ? t.shelteredTooltip : t.exposedTooltip}</span>
              </div>
              <div className={`${pillBaseClass} ${isOrganized ? 'bg-cyan-50/80 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border-cyan-200/50 dark:border-cyan-800/30' : 'bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/30'}`}>
                {isOrganized ? <BadgeCheck className="h-3 w-3 shrink-0" /> : <Leaf className="h-3 w-3 shrink-0" />}
                <span className={pillTextClass}>{localizedOrganizationLabel(isOrganized, language)}</span>
              </div>
              <div className={`${pillBaseClass} bg-violet-50/80 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-200/50 dark:border-violet-800/30`}>
                <Route className="h-3 w-3 shrink-0" />
                <span className={pillTextClass}>{accessLabel}</span>
              </div>
              <div className={`${pillBaseClass} ${waterDepthType === 'shallow' ? 'bg-sky-50/80 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200/50 dark:border-sky-800/30' : 'bg-indigo-50/80 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/30'}`}>
                <Droplets className="h-3 w-3 shrink-0" />
                <span className={pillTextClass}>{waterDepthLabel}</span>
              </div>
            </div>

            {/* Best time banner */}
            {bestBeachTime && (
              <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-sky-100/50 bg-sky-50/70 px-2.5 py-1.5 dark:border-sky-800/30 dark:bg-sky-950/20">
                <Clock className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <p className="text-xs font-medium text-sky-700 dark:text-sky-300">
                  {{ en: 'Best time', gr: 'Καλύτερη ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' }[language]}: <span className="font-bold">{bestTimeValue}</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-start gap-4 pt-2">
              <button
                onClick={() => onShowDetails(beach)}
                className="group flex w-14 flex-col items-center gap-1.5 text-slate-700 transition-all hover:text-primary active:scale-95 dark:text-slate-200"
                aria-label={t.learnMore}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-white/55 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl transition-all group-hover:bg-white/75 dark:border-slate-700/40 dark:bg-slate-800/45">
                  <Info className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate text-[10px] font-bold leading-none">Info</span>
              </button>
              <button
                onClick={() => openNavigation(beach)}
                className="group flex w-14 flex-col items-center gap-1.5 text-slate-700 transition-all hover:text-primary active:scale-95 dark:text-slate-200"
                aria-label={t.navigate}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-white/55 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl transition-all group-hover:bg-white/75 dark:border-slate-700/40 dark:bg-slate-800/45">
                  <Compass className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate text-[10px] font-bold leading-none">{t.navigate}</span>
              </button>
              {navigator.share && (
                <button
                  onClick={handleShare}
                  className="group flex w-14 flex-col items-center gap-1.5 text-slate-700 transition-all hover:text-primary active:scale-95 dark:text-slate-200"
                  aria-label={t.sharing.buttonLabel}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-white/45 bg-white/55 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl transition-all group-hover:bg-white/75 dark:border-slate-700/40 dark:bg-slate-800/45">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span className="max-w-full truncate text-[10px] font-bold leading-none">Share</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Score visual */}
          <div className="hidden lg:flex flex-col items-center justify-center gap-3 w-44 flex-shrink-0">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#scoreGradient)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 264} 264`}
                  initial={{ strokeDasharray: "0 264" }}
                  animate={{ strokeDasharray: `${(score / 100) * 264} 264` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0EA5E9" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-heading font-bold ${scoreColor}`}>{score}</span>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">/ 100</span>
              </div>
            </div>
            <p className="text-xs font-heading font-semibold text-slate-500 dark:text-slate-400 text-center">{scoreLabel}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BeachOfTheDay;
