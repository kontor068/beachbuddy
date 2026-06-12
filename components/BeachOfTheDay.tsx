import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Beach, LanguageCode, SuitableBeach } from '../types';
import { Translation } from '../types';
import { canOpenNavigation, openNavigation } from '../utils/navigation';
import { NavigationBadge } from './NavigationBadge';
import { Share2, Clock, MapPin, Info, Navigation, CheckCircle2 } from 'lucide-react';
import { displayBeachName } from '../utils/localization';
import { TodayScoreBadge } from './TodayScoreBadge';
import { generateBeachExplanation } from '../utils/beachExplanation';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { getWaveCondition } from '../utils/weatherUtils';
import { getBeachPhotoLookup } from '../services/beachPhotos';

interface BeachOfTheDayProps {
  topBeach: SuitableBeach;
  language: LanguageCode;
  t: Translation;
  onShowDetails: (beach: Beach) => void;
  islandName: string;
  windSpeed: number;
  windDirectionLabel?: string;
  windBeaufort?: number;
  selectedDate?: Date;
  temperature: number;
}

const parseTimeToMinutes = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return undefined;
  }

  return hours * 60 + minutes;
};

const getBestTimeDisplay = (
  bestBeachTime: SuitableBeach['bestBeachTime'],
  language: LanguageCode
): string | undefined => {
  const copy = {
    en: {
      exactLabel: 'Best time',
      around: (time: string) => `Good time to visit: around ${time}`,
    },
    gr: {
      exactLabel: 'Καλύτερη ώρα',
      around: (time: string) => `Καλή ώρα για επίσκεψη: γύρω στις ${time}`,
    },
    de: {
      exactLabel: 'Beste Zeit',
      around: (time: string) => `Gute Besuchszeit: gegen ${time}`,
    },
    it: {
      exactLabel: 'Ora migliore',
      around: (time: string) => `Buon orario: verso le ${time}`,
    },
    fr: {
      exactLabel: 'Meilleur moment',
      around: (time: string) => `Bon moment pour venir : vers ${time}`,
    },
  }[language];

  if (!bestBeachTime?.bestStart) return undefined;
  if (!bestBeachTime.bestEnd || bestBeachTime.bestStart === bestBeachTime.bestEnd) {
    return copy.around(bestBeachTime.bestStart);
  }

  const startMinutes = parseTimeToMinutes(bestBeachTime.bestStart);
  const endMinutes = parseTimeToMinutes(bestBeachTime.bestEnd);
  if (startMinutes === undefined || endMinutes === undefined) {
    return `${copy.exactLabel}: ${bestBeachTime.bestStart} - ${bestBeachTime.bestEnd}`;
  }

  return `${copy.exactLabel}: ${bestBeachTime.bestStart} - ${bestBeachTime.bestEnd}`;
};

const BeachOfTheDay: React.FC<BeachOfTheDayProps> = ({ topBeach, language, t, onShowDetails, islandName, windSpeed, windDirectionLabel, windBeaufort, selectedDate }) => {
  const { beach, score, bestBeachTime, isExposed, distance, exposureLevel, waveHeightM, swimmingComfort, warnings } = topBeach;
  const [photoIndex, setPhotoIndex] = useState(0);

  const beachDisplayName = displayBeachName(beach.name, language);
  const photoLookup = useMemo(() => {
    return getBeachPhotoLookup(beach.name.gr, beach.name.en, beach.id, 4, islandName);
  }, [beach.id, beach.name.en, beach.name.gr, islandName]);
  const heroPhotos = useMemo(() => {
    return photoLookup.source === 'exact' ? Array.from(new Set(photoLookup.photos)) : [];
  }, [photoLookup.photos, photoLookup.source]);
  const heroPhoto = photoIndex < heroPhotos.length ? heroPhotos[photoIndex] : null;
  const waveCondition = getWaveCondition(isExposed, windSpeed * 3.6);
  const beachExplanation = generateBeachExplanation({
    beach,
    language,
    isExposed,
    exposureLevel,
    waveCondition,
    waveHeightM,
    bestBeachTime,
    windDirectionLabel,
    windBeaufort,
    selectedDate,
  });
  const navigateLabel = {
    en: 'Navigate',
    gr: 'Πήγαινέ με εκεί',
    de: 'Route starten',
    it: 'Portami lì',
    fr: 'Y aller',
  }[language];
  const infoLabel = { en: 'Info', gr: 'Πληροφορίες', de: 'Info', it: 'Info', fr: 'Info' }[language];
  const shareLabel = { en: 'Share', gr: 'Κοινοποίηση', de: 'Teilen', it: 'Condividi', fr: 'Partager' }[language];
  const bestTimeDisplay = getBestTimeDisplay(bestBeachTime, language);
  const canNavigate = canOpenNavigation(beach);
  const noIdealSwimmingWindow = swimmingComfort === 'avoid_swimming' || Boolean(
    warnings?.some(warning => warning.type === 'rough_sea' && warning.severity === 'critical') ||
    (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 1.2)
  );
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const decisionRule = {
    en: `We rank ${day} by wind protection first, then sea comfort and practical visitor fit.`,
    gr: `Η επιλογή για ${day} βγαίνει πρώτα από προστασία στον άνεμο, μετά θάλασσα και πρακτικότητα.`,
    de: 'Wir werten zuerst Windschutz, dann Meerkomfort und praktische Eignung.',
    it: 'Prima valutiamo riparo dal vento, poi mare e praticità.',
    fr: 'Nous classons d’abord l’abri au vent, puis la mer et le côté pratique.',
  }[language];

  useEffect(() => {
    setPhotoIndex(0);
  }, [beach.id]);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/84 shadow-lg shadow-cyan-900/5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88"
    >
      {heroPhoto && (
      <div className="relative h-40 overflow-hidden sm:h-56 md:h-64">
          <img
            src={heroPhoto}
            alt={beachDisplayName}
            className="absolute inset-0 h-full w-full object-cover"
            width={960}
            height={360}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            sizes="(min-width: 768px) 768px, 100vw"
            onError={() => setPhotoIndex((current) => current + 1)}
          />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-slate-950/5 to-white/10" />
      </div>
      )}
      <div className="relative z-10 p-3 sm:p-6 md:p-7">
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <TodayScoreBadge
                score={score}
                language={language}
                variant="hero"
                selectedDate={selectedDate}
                windBeaufort={windBeaufort}
                waveHeightM={waveHeightM}
                swimmingComfort={swimmingComfort}
                noIdealSwimmingWindow={noIdealSwimmingWindow}
                exposureLevel={exposureLevel}
              />
              <span className="hidden items-center gap-1 text-xs font-bold text-slate-500 sm:inline-flex dark:text-slate-400">
                <MapPin className="h-3.5 w-3.5" />
                {islandName}
                {distance !== undefined && (
                  <span className="text-slate-400 dark:text-slate-500">
                    · {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                  </span>
                )}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="font-heading text-[1.65rem] font-extrabold leading-[1.12] text-slate-950 min-[390px]:text-3xl sm:text-4xl dark:text-white">
                {beachDisplayName}
              </h2>
              {bestTimeDisplay && (
                <div className="inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800 shadow-sm sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-2 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-bold leading-tight">
                    {bestTimeDisplay}
                  </span>
                </div>
              )}
            </div>

          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            {canNavigate && (
              <button
                onClick={() => openNavigation(beach)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-base font-bold text-white shadow-lg shadow-cyan-600/25 transition-colors hover:bg-cyan-700 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                aria-label={navigateLabel}
              >
                <Navigation className="h-5 w-5" />
                {navigateLabel}
              </button>
            )}
            {canNavigate && <NavigationBadge beach={beach} language={language} className="justify-self-start" />}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                onClick={() => onShowDetails(beach)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/65 bg-white/64 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white/82 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:h-12 sm:w-12 sm:px-0 dark:border-slate-800 dark:bg-slate-900/66 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label={infoLabel}
              >
                <Info className="h-4 w-4" />
                <span className="sm:hidden">{infoLabel}</span>
              </button>
              {navigator.share && (
                <button
                  onClick={handleShare}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/65 bg-white/64 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white/82 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:h-12 sm:w-12 sm:px-0 dark:border-slate-800 dark:bg-slate-900/66 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label={shareLabel}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="sm:hidden">{shareLabel}</span>
                </button>
              )}
            </div>
          </div>

          <div
            className="rounded-2xl border border-white/60 bg-white/62 p-3 shadow-sm shadow-sky-900/5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/55"
            data-nosnippet="true"
          >
              <h3 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              {beachExplanation.heroTitle}
            </h3>
            <ul className="grid gap-1.5 sm:grid-cols-3 sm:gap-x-8">
              {beachExplanation.heroBullets.map((reason) => (
                <li key={reason} className="grid min-w-0 grid-cols-[14px_minmax(0,1fr)] items-start gap-2 text-xs font-semibold leading-snug text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-cyan-600" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-slate-200/60 pt-2 text-[11px] font-semibold leading-snug text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {decisionRule}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BeachOfTheDay;
