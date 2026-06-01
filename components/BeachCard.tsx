
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Star, Share2, Heart, Navigation, Info, ChevronDown, ChevronUp, Waves, Utensils, Trees, Umbrella, CircleDot, CircleDotDashed, Layers, Mountain, Droplets, ArrowDown, Sparkles, BadgeCheck, Leaf, Shield, Users, Clock3, Flag } from 'lucide-react';
import { Beach, Accessibility, LanguageCode, WaveCondition, BeachType, CrowdLevel, WarningFlag, RecommendationConfidence, SwimmingComfort } from '../types';
import { getBeaufortLevel } from '../utils/weatherUtils';
import { Translation } from '../types';

import { openNavigation } from '../utils/navigation';
import { BeachConditionScore } from './BeachConditionScore';
import { TodayScoreBadge } from './TodayScoreBadge';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { trackEvent } from '../services/analyticsService';
import { ExposureLevel } from '../utils/windExposure';
import { hasDirtRoadAccess, hasTrulyEasyAccess } from '../utils/access';
import { getSelectedDayPrefix, getSelectedDaySentencePrefix } from '../utils/dateLabels';
import {
  displayBeachName,
  localizedAccessLabel,
  localizedAccessPrefix,
  localizedBeachDescription,
  localizedShadeLabel,
  localizedTerrainLabel,
  localizedWaterDepthLabel,
} from '../utils/localization';
import { AmenityChip, getAmenityChips } from '../utils/amenities';

interface BeachCardProps {
  beach: Beach & { distance?: number };
  isExposed?: boolean;
  language: LanguageCode;
  t: Translation;
  isCalm?: boolean;
  windSpeed: number;
  waveHeightM?: number;
  temperature?: number;
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  islandName: string;
  showIslandName?: boolean;
  onClick?: () => void;
  todayScore?: number;
  variant?: 'default' | 'decision';
  density?: 'regular' | 'compact';
  recommendationRank?: number;
  recommendationLabel?: string;
  bestSwimWindow?: string;
  bestBeachTime?: { bestStart?: string; bestEnd?: string };
  topPickTimeLabel?: string;
  selectedDate?: Date;
  crowdLevel?: CrowdLevel;
  exposureLevel?: ExposureLevel;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  swimmingComfort?: SwimmingComfort;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
  strongWindContext?: boolean;
  lessExposedToday?: boolean;
}

interface StarRatingProps {
  rating: number;
  colorClassName?: string;
  emptyColorClassName?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({ rating, colorClassName = 'text-amber-400', emptyColorClassName = 'text-slate-300' }) => {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const value = i + 1;
    const StarIconPath = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

    if (value <= rating) { // Full star
      return (
        <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${colorClassName}`} viewBox="0 0 20 20" fill="currentColor">
          <path d={StarIconPath} />
        </svg>
      );
    }
    if (value - 0.5 <= rating) { // Half star
      return (
        <div key={i} className="relative">
           <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${emptyColorClassName}`} viewBox="0 0 20 20" fill="currentColor">
            <path d={StarIconPath} />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${colorClassName} absolute top-0 left-0`} viewBox="0 0 20 20" fill="currentColor" style={{ clipPath: 'inset(0 50% 0 0)' }}>
            <path d={StarIconPath} />
          </svg>
        </div>
      );
    }
    // Empty star
    return (
      <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${emptyColorClassName}`} viewBox="0 0 20 20" fill="currentColor">
        <path d={StarIconPath} />
      </svg>
    );
  });

  return (
    <div className="flex items-center" aria-label={`Rating: ${rating} out of 5 stars`}>
      {stars}
    </div>
  );
};


export const BeachCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
    <div className="p-5 flex flex-col">
      <div className="flex justify-between items-start mb-1">
        <div className="h-6 bg-slate-200 rounded w-3/5"></div>
        <div className="h-5 bg-slate-200 rounded-full w-1/4"></div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 bg-slate-200 rounded w-24"></div>
        <div className="h-5 bg-slate-200 rounded w-8"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-slate-200 rounded w-full"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-2/5 mb-2"></div>
        <div className="h-8 bg-slate-200 rounded-full w-2/4"></div>
      </div>
       <div className="mb-4 space-y-3">
         <div className="h-4 bg-slate-200 rounded w-2/5 mb-2"></div>
         <div className="flex flex-wrap gap-2">
            <div className="h-6 bg-slate-200 rounded-md w-1/4"></div>
            <div className="h-6 bg-slate-200 rounded-md w-1/3"></div>
         </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex items-center mt-auto">
        <div className="h-10 bg-slate-200 rounded-lg w-full"></div>
      </div>
    </div>
  </div>
);

export const AccessibilityInfo: React.FC<{ accessibility: Accessibility; t: Translation; }> = ({ accessibility, t }) => {
  const getAccessibilityDetails = () => {
    switch (accessibility) {
      case Accessibility.EASY:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
          text: t.accessibility[Accessibility.EASY],
          className: 'text-green-700 bg-green-100/80',
        };
      case Accessibility.MODERATE:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-orange-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
          text: t.accessibility[Accessibility.MODERATE],
          className: 'text-orange-700 bg-orange-100/80',
        };
      case Accessibility.DIFFICULT:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
          text: t.accessibility[Accessibility.DIFFICULT],
          className: 'text-red-700 bg-red-100/80',
        };
      case Accessibility.BOAT_ONLY:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a1 1 0 011 1v1h1.5a.5.5 0 01.5.5v1.5a.5.5 0 01-.5.5H12v2.5a.5.5 0 01-.5.5H8.5a.5.5 0 01-.5-.5V7H6.5a.5.5 0 01-.5-.5V5a.5.5 0 01.5-.5H8V3a1 1 0 011-1h1z" /><path d="M3.5 15.228a1.5 1.5 0 001.295.962h10.41a1.5 1.5 0 001.295-.962l-1.89-6.434H5.39L3.5 15.228zM3 17a1 1 0 01-1-1v-1.586a1 1 0 01.293-.707l1.414-1.414A1 1 0 015.414 12H14.586a1 1 0 01.707.293l1.414 1.414a1 1 0 01.293.707V16a1 1 0 01-1 1H3z" /></svg>,
          text: t.accessibility[Accessibility.BOAT_ONLY],
          className: 'text-teal-700 bg-teal-100/80',
        };
    }
  };

  const details = getAccessibilityDetails();
  if (!details) return null;

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${details.className}`}>
      {details.icon}
      <span>{details.text}</span>
    </div>
  );
};

const AccessNotes: React.FC<{ notes?: Beach['accessNotes'], language: LanguageCode, t: Translation }> = ({ notes, language, t }) => {
  if (!notes || !notes[language]) return null;

  return (
    <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded-r-lg">
      <div className="flex items-start">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <div>
          <h5 className="font-bold text-sm">{t.accessNotesTitle}</h5>
          <p className="text-sm">{notes[language]}</p>
        </div>
      </div>
    </div>
  );
};

const WaveInfo: React.FC<{ condition: WaveCondition; t: Translation }> = ({ condition, t }) => {
  const details = {
    calm: {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12c2-1 4-1 6 0s4 1 6 0 4-1 6 0" /></svg>,
      text: t.waveConditions.calm,
      className: 'text-cyan-700 bg-cyan-100/80',
    },
    moderate: {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></svg>,
      text: t.waveConditions.moderate,
      className: 'text-amber-700 bg-amber-100/80',
    },
    rough: {
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>,
      text: t.waveConditions.rough,
      className: 'text-red-700 bg-red-100/80',
    },
  }[condition];

  if (!details) return null;

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${details.className}`}>
      {details.icon}
      <span>{details.text}</span>
    </div>
  );
};

const BeachLocationPlaceholder: React.FC<{
  language: LanguageCode;
  avoidTopLeft?: boolean;
}> = ({ language, avoidTopLeft = false }) => {
  const photoSoonLabels: Record<LanguageCode, string> = {
    en: 'Photos soon',
    gr: 'Φωτογραφίες σύντομα',
    fr: 'Photos bientôt',
    de: 'Fotos folgen',
    it: 'Foto in arrivo',
  };
  const photoSoonLabel = photoSoonLabels[language];

  return (
    <div className="absolute inset-0 overflow-hidden bg-sky-100" aria-label={photoSoonLabel}>
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-sky-50 to-emerald-50" />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: 'linear-gradient(rgba(14,116,144,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(14,116,144,0.12) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
        aria-hidden="true"
      />
      <svg className="absolute inset-0 h-full w-full text-cyan-600/18" viewBox="0 0 400 180" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 112 C55 98 89 123 142 110 C192 98 220 70 274 78 C322 85 347 116 400 102 L400 180 L0 180 Z" fill="currentColor" />
        <path d="M36 44 C86 64 125 53 170 70 C214 86 251 118 335 100" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 10" />
        <path d="M-20 18 C55 40 105 22 160 38 C215 54 260 36 420 58" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-white/50 via-white/12 to-white/10" aria-hidden="true" />
      <div className={`absolute ${avoidTopLeft ? 'left-3 top-12' : 'left-3 top-3 sm:left-4 sm:top-4'}`}>
        <span className="inline-flex min-h-8 items-center rounded-full border border-cyan-100/90 bg-white/72 px-3 text-[11px] font-extrabold leading-none text-cyan-800 shadow-sm shadow-sky-900/10 backdrop-blur-md">
          {photoSoonLabel}
        </span>
      </div>
    </div>
  );
};

const amenityChipIcon = (chip: Pick<AmenityChip, 'key'>): React.ReactNode => {
  switch (chip.key) {
    case 'sunbeds':
      return <Umbrella className="w-3.5 h-3.5" />;
    case 'foodNearby':
    case 'cafeNearby':
      return <Utensils className="w-3.5 h-3.5" />;
    case 'parking':
      return <MapPin className="w-3.5 h-3.5" />;
    case 'noFacilities':
      return <Leaf className="w-3.5 h-3.5" />;
    default:
      return <BadgeCheck className="w-3.5 h-3.5" />;
  }
};

const AmenityTags: React.FC<{ beach: Beach; language: LanguageCode }> = ({ beach, language }) => {
  const chips = getAmenityChips(beach, language).slice(0, 2);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(chip => (
        <div key={chip.key} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {amenityChipIcon(chip)}
          <span>{chip.label}</span>
        </div>
      ))}
    </div>
  );
};

const ProtectedBeachMarker: React.FC<{ language: LanguageCode; selectedDate?: Date }> = ({ language, selectedDate }) => {
  const day = getSelectedDaySentencePrefix(selectedDate, new Date(), language);
  const label = language === 'gr' ? `${day}: πιο υπήνεμη` : `${day}: better sheltered`;
  const accessibleLabel = language === 'gr' ? `${day}: πιο υπήνεμη επιλογή` : `${day}: better sheltered option`;

  return (
    <span
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/75 px-2 py-0.5 text-[10px] font-bold leading-none text-emerald-700"
    >
      <Shield className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

const BlueFlagBadge: React.FC<{ language: LanguageCode; compact?: boolean }> = ({ language, compact = false }) => {
  const label = language === 'gr' ? 'Γαλάζια Σημαία' : 'Blue Flag';

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-100 bg-white/88 font-bold leading-none text-sky-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <Flag className="h-3.5 w-3.5 shrink-0 fill-sky-100 text-sky-600" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

const BeachTypeTag: React.FC<{ beachType: BeachType; t: Translation }> = ({ beachType, t }) => {
  const icons: Record<BeachType, React.ReactNode> = {
    sandy: <Sparkles className="w-3.5 h-3.5" />,
    pebbles: <CircleDot className="w-3.5 h-3.5" />,
    'sandy-pebbles': <Layers className="w-3.5 h-3.5" />,
    rocky: <Mountain className="w-3.5 h-3.5" />,
  };
  
  return (
    <div className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
      {icons[beachType]}
      <span>{t.filterOptions[beachType]}</span>
    </div>
  );
};

const CharacteristicTags: React.FC<{ characteristics: Beach['characteristics']; t: Translation }> = ({ characteristics, t }) => {
  const presentCharacteristics = (Object.keys(characteristics) as Array<keyof typeof characteristics>).filter(key => characteristics[key]);
  if (presentCharacteristics.length === 0) return null;

  return (
    <>
      {presentCharacteristics.map(char => (
        <div key={char as string} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
          {t.filterOptions[char as keyof typeof t.filterOptions]}
        </div>
      ))}
    </>
  );
};


// Gradient backgrounds — sheltered vs exposed
const metadataAccessTone: Record<string, { className: string; iconClassName: string }> = {
  asphalt_road: { className: 'text-emerald-700 bg-emerald-100/80', iconClassName: 'text-emerald-500' },
  passable_dirt_road: { className: 'text-amber-700 bg-amber-100/80', iconClassName: 'text-amber-500' },
  '4x4_only': { className: 'text-red-700 bg-red-100/80', iconClassName: 'text-red-500' },
  hiking_path_easy: { className: 'text-sky-700 bg-sky-100/80', iconClassName: 'text-sky-500' },
  hiking_path_difficult: { className: 'text-orange-700 bg-orange-100/80', iconClassName: 'text-orange-500' },
  boat_only: { className: 'text-teal-700 bg-teal-100/80', iconClassName: 'text-teal-500' },
};

const terrainIcons: Record<string, React.ReactNode> = {
  fine_sand: <Sparkles className="w-3.5 h-3.5" />,
  coarse_sand: <CircleDotDashed className="w-3.5 h-3.5" />,
  pebbles: <CircleDot className="w-3.5 h-3.5" />,
  large_stones: <Mountain className="w-3.5 h-3.5" />,
  rocks: <Mountain className="w-3.5 h-3.5" />,
};

const waterDepthStyles: Record<string, string> = {
  shallow: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300',
  medium: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
  deep: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
};

const waterDepthIcons: Record<string, React.ReactNode> = {
  shallow: <Droplets className="w-3.5 h-3.5" />,
  medium: <Waves className="w-3.5 h-3.5" />,
  deep: <ArrowDown className="w-3.5 h-3.5" />,
};

const MetadataAccessInfo: React.FC<{ metadata: NonNullable<Beach['metadata']>; language: LanguageCode }> = ({ metadata, language }) => {
  if (!metadata.access) return null;

  const isDirtRoad = hasDirtRoadAccess({ metadata });
  const tone = isDirtRoad
    ? metadataAccessTone.passable_dirt_road
    : metadataAccessTone[metadata.access.type] || metadataAccessTone.asphalt_road;
  const label = isDirtRoad
    ? (language === 'gr' ? 'Χωματόδρομος' : 'Dirt road')
    : localizedAccessLabel(metadata.access.type, metadata.access.label, language);

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${tone.className}`} title={metadata.access.notes}>
      <MapPin className={`h-4 w-4 mr-2 ${tone.iconClassName}`} />
      <span>{label}</span>
    </div>
  );
};

const MetadataTags: React.FC<{ beach: Beach; language: LanguageCode }> = ({ beach, language }) => {
  const metadata = beach.metadata;
  if (!metadata) return null;
  const terrainTypes = metadata.terrain?.types?.slice(0, 3) || [];
  const waterDepth = metadata.waterDepth;
  const amenityChips = getAmenityChips(beach, language).slice(0, 2);

  return (
    <>
      {terrainTypes.map(type => (
        <div key={type} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          {terrainIcons[type] || <CircleDot className="w-3.5 h-3.5" />}
          <span>{localizedTerrainLabel(type, language)}</span>
        </div>
      ))}
      {waterDepth && (
        <div
          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 ${waterDepthStyles[waterDepth.type] || waterDepthStyles.shallow}`}
          title={waterDepth.notes}
        >
          {waterDepthIcons[waterDepth.type] || <Droplets className="w-3.5 h-3.5" />}
          <span>{localizedWaterDepthLabel(waterDepth.type, waterDepth.label, language)}</span>
        </div>
      )}
      {metadata.shade && (
        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 rounded text-[10px] font-bold flex items-center gap-1.5">
          <Trees className="w-3.5 h-3.5" />
          <span>{localizedShadeLabel(language)}</span>
        </div>
      )}
      {amenityChips.map(chip => (
        <div key={chip.key} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          {amenityChipIcon(chip)}
          <span>{chip.label}</span>
        </div>
      ))}
    </>
  );
};

const shelteredGradients: Record<BeachType, string> = {
  sandy: 'from-sky-200 via-cyan-100 to-emerald-100',
  pebbles: 'from-sky-300 via-cyan-200 to-teal-100',
  'sandy-pebbles': 'from-sky-200 via-cyan-100 to-teal-100',
  rocky: 'from-sky-300 via-slate-200 to-cyan-200',
};
const exposedGradients: Record<BeachType, string> = {
  sandy: 'from-amber-200 via-orange-100 to-rose-100',
  pebbles: 'from-slate-300 via-amber-100 to-orange-100',
  'sandy-pebbles': 'from-amber-200 via-orange-100 to-slate-200',
  rocky: 'from-stone-300 via-amber-100 to-orange-100',
};

const warningLabel = (warning: WarningFlag, language: LanguageCode, selectedDate?: Date): string => {
  const isGreek = language === 'gr';
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  switch (warning.type) {
    case 'missing_data':
      return isGreek ? 'Εκτίμηση θάλασσας' : 'Sea estimate';
    case 'rough_sea':
      return warning.severity === 'critical'
        ? (isGreek ? 'Υψηλό κύμα' : 'High waves')
        : (isGreek ? 'Λίγο κύμα' : 'Some waves');
    case 'strong_wind':
      return isGreek ? 'Δυνατός αέρας' : 'Strong wind';
    case 'wind_sport_spot':
      return isGreek ? 'Παραλία για wind sports' : 'Wind/watersports spot';
    case 'exposed_to_wind':
      return warning.severity === 'warning'
        ? (isGreek ? `Εκτεθειμένη στον άνεμο ${day}` : `Exposed to wind ${day}`)
        : (isGreek ? 'Μπορεί να έχει αέρα' : 'May feel breezy');
    case 'difficult_access':
      return isGreek ? 'Πιο δύσκολη πρόσβαση' : 'More challenging access';
    case 'boat_only':
      return isGreek ? 'Μόνο με σκάφος' : 'Boat only';
    case 'low_confidence':
      return isGreek ? 'Θέλει επιβεβαίωση τοπικά' : 'Local exposure unverified';
    default:
      return warning.message;
  }
};

const waveWarningLabel = (warning: WarningFlag, waveHeightM: number | undefined, language: LanguageCode, selectedDate?: Date): string => {
  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    if (waveHeightM >= 1.2) return language === 'gr' ? 'Έντονος κυματισμός' : 'Rough sea';
    if (waveHeightM >= 0.8) return language === 'gr' ? 'Κυματισμός' : 'Choppy';
  }

  return warningLabel(warning, language, selectedDate);
};

const warningToneClass = (warning: WarningFlag): string => {
  if (warning.severity === 'critical') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300';
  if (warning.severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';
  return 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300';
};

const compactLabels = (language: LanguageCode, selectedDate?: Date) => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const sentenceDay = getSelectedDaySentencePrefix(selectedDate, new Date(), language);

  return ({
  calmWaters: language === 'gr' ? 'Χαμηλό κύμα' : 'Low waves',
  goodSea: language === 'gr' ? 'Καλή θάλασσα' : 'Good sea',
  protected: language === 'gr' ? `${sentenceDay}: πιο υπήνεμη` : `${sentenceDay}: better sheltered`,
  lightWind: language === 'gr' ? 'Ήπιος άνεμος' : 'Light wind',
  mildlyBreezy: language === 'gr' ? 'Μπορεί να έχει αέρα' : 'May feel breezy',
  windyExposed: language === 'gr' ? 'Εκτεθειμένη στον άνεμο' : 'Windy / exposed',
  partlyShelteredToday: language === 'gr' ? `Πιο υπήνεμη ${day}` : `Better out of the wind ${day}`,
  slightlyExposed: language === 'gr' ? 'Μπορεί να έχει αέρα' : 'May feel breezy',
  familyFriendly: language === 'gr' ? 'Για παιδιά' : 'Family',
  shallowWaters: language === 'gr' ? 'Ρηχά νερά' : 'Shallow water',
  shallowWatersCaution: language === 'gr' ? 'Ρηχά νερά' : 'Shallow water',
  easyAccess: language === 'gr' ? 'Εύκολη πρόσβαση' : 'Easy access',
  facilities: language === 'gr' ? 'Παροχές' : 'Facilities',
  noFacilities: language === 'gr' ? 'Χωρίς παροχές' : 'No facilities',
  naturalShade: language === 'gr' ? 'Φυσική σκιά' : 'Natural shade',
  goodWithWind: language === 'gr' ? 'Καλή επιλογή, με λίγο περισσότερο αέρα' : 'Good option, with a little more wind',
  calmButWindier: language === 'gr' ? 'Χαμηλό κύμα, αλλά περισσότερος αέρας' : 'Low waves, but a little windier',
  visitorRating: language === 'gr' ? 'Βαθμολογία επισκεπτών' : 'Visitor rating',
  });
};

const compactAccessLabel = (
  language: LanguageCode,
  accessibility: Accessibility,
  accessType: string | undefined,
  isDirtRoad: boolean,
  fallback: string
): string => {
  if (isDirtRoad) {
    return language === 'gr' ? 'Χωματόδρομος' : 'Dirt road';
  }

  if (language === 'gr') {
    const metadataLabels: Record<string, string> = {
      asphalt_road: 'Εύκολη πρόσβαση',
      passable_dirt_road: 'Χωματόδρομος',
      '4x4_only': 'Δύσκολη πρόσβαση',
      hiking_path_easy: 'Μονοπάτι',
      hiking_path_difficult: 'Δύσκολο μονοπάτι',
      boat_only: 'Με σκάφος',
    };
    const accessibilityLabels: Record<Accessibility, string> = {
      [Accessibility.EASY]: 'Εύκολη πρόσβαση',
      [Accessibility.MODERATE]: 'Μέτρια πρόσβαση',
      [Accessibility.DIFFICULT]: 'Δύσκολη πρόσβαση',
      [Accessibility.BOAT_ONLY]: 'Με σκάφος',
    };
    return (accessType && metadataLabels[accessType]) || accessibilityLabels[accessibility] || fallback;
  }

  const metadataLabels: Record<string, string> = {
    asphalt_road: 'Easy access',
    passable_dirt_road: 'Dirt road',
    '4x4_only': 'Difficult road',
    hiking_path_easy: 'Path access',
    hiking_path_difficult: 'Hard path',
    boat_only: 'Boat only',
  };
  return (accessType && metadataLabels[accessType]) || fallback;
};

const compactAmenityLabel = (chip: AmenityChip, language: LanguageCode): string => {
  if (chip.key === 'foodNearby') return language === 'gr' ? 'Ταβέρνα' : 'Taverna';

  if (language === 'gr') {
    const labels: Record<AmenityChip['key'], string> = {
      beachBar: 'Beach bar',
      sunbeds: 'Ξαπλώστρες',
      foodNearby: 'Ταβέρνα',
      cafeNearby: 'Καφέ',
      parking: 'Parking',
      organizedFacilities: 'Παροχές',
      noFacilities: 'Χωρίς παροχές',
      seasonalFacilities: 'Εποχικές παροχές',
      unknownFacilities: 'Άγνωστες παροχές',
    };
    return labels[chip.key] || chip.label;
  }

  const labels: Record<AmenityChip['key'], string> = {
    beachBar: 'Beach bar',
    sunbeds: 'Sunbeds',
    foodNearby: 'Taverna',
    cafeNearby: 'Cafe',
    parking: 'Parking',
    organizedFacilities: 'Facilities',
    noFacilities: 'No facilities',
    seasonalFacilities: 'Seasonal',
    unknownFacilities: 'Unknown',
  };
  return labels[chip.key] || chip.label;
};

export const BeachCard: React.FC<BeachCardProps> = ({
  beach,
  isExposed = false,
  language,
  t,
  isCalm = false,
  windSpeed,
  waveHeightM,
  temperature,
  favorites,
  onToggleFavorite,
  islandName,
  showIslandName = true,
  onClick,
  todayScore,
  variant = 'decision',
  density = 'regular',
  recommendationRank,
  recommendationLabel,
  bestSwimWindow,
  bestBeachTime,
  topPickTimeLabel,
  selectedDate,
  crowdLevel,
  exposureLevel,
  warnings = [],
  swimmingComfort,
  canClaimWindProtection = false,
  seaCalmClaimAllowed = false,
  strongWindContext = false,
  lessExposedToday,
}) => {
  const [animateHeart, setAnimateHeart] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const isCompact = density === 'compact';
  const { name, rating, description, amenities, accessibility, distance, beachType, characteristics, coordinates, metadata } = beach;
  const beachDisplayName = displayBeachName(name, language);
  const hasBlueFlag2026 = beach.blueFlag2026?.awarded === true || metadata?.blueFlag2026?.awarded === true;
  const isTrulyExposedToday = exposureLevel ? exposureLevel === 'exposed' : isExposed;
  const isPartlyShelteredToday = exposureLevel === 'partial';
  const windBeaufort = getBeaufortLevel(windSpeed * 3.6);
  const isFavorite = favorites.includes(beach.id);
  const labels = compactLabels(language, selectedDate);
  const noIdealSwimmingWindow = swimmingComfort === 'avoid_swimming' || Boolean(
    warnings.some(warning => warning.type === 'rough_sea' && warning.severity === 'critical') ||
    (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 1.2)
  );
  const favoriteLabel = language === 'gr' ? 'Προσθήκη στα αγαπημένα' : 'Add to favorites';
  const unfavoriteLabel = language === 'gr' ? 'Αφαίρεση από τα αγαπημένα' : 'Remove from favorites';
  const shareLabel = language === 'gr' ? 'Κοινοποίηση' : 'Share';

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFavorite) setAnimateHeart(true);
    onToggleFavorite(beach.id);
  };

  const photoLookup = getBeachPhotoLookup(name.gr, name.en, beach.id, 3, islandName);
  const cardPhotos = photoLookup.source === 'exact' ? photoLookup.photos : [];
  const cardPhoto = photoIndex < cardPhotos.length ? cardPhotos[photoIndex] : null;

  useEffect(() => {
    setPhotoIndex(0);
  }, [beach.id]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        trackEvent('share_clicked', beach.id, {
          locale: language === 'gr' ? 'el' : 'en',
          region: islandName,
          beach_name: name.en,
          source: 'beach_card',
        });
        await navigator.share({
          text: t.sharing.text(beachDisplayName),
          url: shareUrl,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error('Error sharing:', error);
      }
    }
  };

  const handleNavigationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackEvent('navigation_clicked', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandName,
      beach_name: name.en,
      source: 'beach_card',
    });
    openNavigation(beach);
  };

  const rawAccessLabel = metadata?.access
    ? localizedAccessLabel(metadata.access.type, metadata.access.label, language)
    : t.accessibility[accessibility];
  const accessLabel = compactAccessLabel(language, accessibility, metadata?.access?.type, hasDirtRoadAccess(beach), rawAccessLabel);
  const roughSeaWarning = warnings.find(warning => warning.type === 'rough_sea');
  const isProtectedToday = exposureLevel === 'protected' && canClaimWindProtection;
  const cautionWaterConditions = windBeaufort >= 5 || (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 0.8);
  const seaLabel = roughSeaWarning ? waveWarningLabel(roughSeaWarning, waveHeightM, language, selectedDate) : (seaCalmClaimAllowed ? labels.calmWaters : labels.goodSea);
  const isFiveBeaufort = windBeaufort === 5;
  const isLessExposedToday = lessExposedToday ?? (isProtectedToday || isPartlyShelteredToday);
  const strongOpenBeachLabel = language === 'gr' ? 'Εκτεθειμένη στον άνεμο' : 'Exposed to wind';
  const displayStrongOpenBeachLabel = strongOpenBeachLabel;
  const displayOpenBeachLabel = windBeaufort >= 4 || cautionWaterConditions
    ? displayStrongOpenBeachLabel
    : language === 'gr'
      ? 'Πιο ανοιχτή στον άνεμο'
      : 'More open to wind';
  const protectionLabel = isProtectedToday
    ? labels.protected
    : strongWindContext && isLessExposedToday && isPartlyShelteredToday
      ? labels.partlyShelteredToday
    : strongWindContext
      ? displayOpenBeachLabel
    : windBeaufort < 4
      ? labels.lightWind
      : windBeaufort >= 5
        ? isLessExposedToday && isPartlyShelteredToday
          ? labels.partlyShelteredToday
          : labels.windyExposed
        : labels.mildlyBreezy;
  const hideDuplicateShelterChip = isFiveBeaufort && isLessExposedToday && isPartlyShelteredToday && todayScore !== undefined;
  const hideMildWindChip = todayScore !== undefined && !strongWindContext && !isProtectedToday && !roughSeaWarning && windBeaufort < 4;
  const hideConditionChip = hideDuplicateShelterChip || hideMildWindChip;
  const protectionChipTone = isProtectedToday || (strongWindContext && isLessExposedToday)
    ? 'border-emerald-200/80 bg-emerald-50/72 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
    : roughSeaWarning
      ? warningToneClass(roughSeaWarning)
      : 'border-cyan-200/80 bg-cyan-50/70 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300';
  const isEasyAccess = hasTrulyEasyAccess(beach);
  const hasNaturalShade = Boolean(metadata?.shade ?? amenities.naturalShade);
  const hasShallowWater = Boolean(metadata?.waterDepth?.type === 'shallow' || characteristics.shallowWaters);
  const beachTypeFeatureIcons: Record<BeachType, React.ReactNode> = {
    sandy: <Sparkles className="h-3.5 w-3.5 shrink-0" />,
    pebbles: <CircleDot className="h-3.5 w-3.5 shrink-0" />,
    'sandy-pebbles': <Layers className="h-3.5 w-3.5 shrink-0" />,
    rocky: <Mountain className="h-3.5 w-3.5 shrink-0" />,
  };
  const amenityFeatureChips = getAmenityChips(beach, language)
    .filter(chip => chip.key !== 'unknownFacilities')
    .slice(0, 3)
    .map(chip => ({
    key: `amenity-${chip.key}`,
    label: compactAmenityLabel(chip, language),
    icon: amenityChipIcon(chip),
  }));
  const featureChips = [
    { key: 'surface', label: t.filterOptions[beachType], icon: beachTypeFeatureIcons[beachType] },
    hasShallowWater ? { key: 'shallow', label: cautionWaterConditions ? labels.shallowWatersCaution : labels.shallowWaters, icon: <Droplets className="h-3.5 w-3.5 shrink-0" /> } : null,
    ...amenityFeatureChips,
    beach.environment?.familyFriendly ? { key: 'family', label: labels.familyFriendly, icon: <Users className="h-3.5 w-3.5 shrink-0" /> } : null,
    hasNaturalShade ? { key: 'shade', label: labels.naturalShade, icon: <Trees className="h-3.5 w-3.5 shrink-0" /> } : null,
  ].filter(Boolean).slice(0, 4) as Array<{ key: string; label: string; icon: React.ReactNode }>;
  const compactChipBase = `inline-flex ${isCompact ? 'min-h-8 lg:min-h-7' : 'min-h-8'} w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2 py-1 text-xs font-semibold leading-tight`;
  const featureChipBase = `inline-flex ${isCompact ? 'min-h-8 lg:min-h-7' : 'min-h-8'} w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-sky-100/70 bg-white/68 px-2 py-1 text-xs font-semibold leading-tight text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300`;

  if (variant === 'decision' || variant === 'default') {
    return (
      <motion.div
        onClick={onClick}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.25 }}
        className="group relative beach-card flex h-full cursor-pointer flex-col overflow-hidden active:scale-[0.995]"
      >
        <div className={`relative aspect-[16/9] ${isCompact ? 'min-h-36 max-h-44 lg:min-h-28 lg:max-h-32' : 'min-h-36 max-h-44'} overflow-hidden bg-sky-50`}>
          {cardPhoto ? (
            <img
              src={cardPhoto}
              alt={beachDisplayName}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              width={640}
              height={360}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setPhotoIndex((current) => current + 1)}
            />
          ) : (
            <BeachLocationPlaceholder language={language} avoidTopLeft={recommendationRank !== undefined || hasBlueFlag2026} />
          )}
          {cardPhoto && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/0" />}

          <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-4.75rem)] flex-wrap items-center gap-2">
            {recommendationRank !== undefined && (
              <span className="inline-flex min-h-8 items-center rounded-full bg-white/82 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md">
                {recommendationLabel ?? recommendationRank}
              </span>
            )}
            {hasBlueFlag2026 && <BlueFlagBadge language={language} />}
          </div>

          <button
            onClick={handleFavoriteClick}
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-xl bg-white/78 text-slate-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white/92 hover:text-rose-500 cursor-pointer"
            aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
          >
            <Heart className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        </div>

        <div className={`flex flex-1 flex-col ${isCompact ? 'gap-3 p-4 sm:p-[1.05rem] lg:gap-2 lg:p-3' : 'gap-3 p-4 sm:p-[1.05rem]'}`}>
          <div className={isCompact ? 'space-y-1 lg:space-y-0.5' : 'space-y-1'}>
            <h3 className="line-clamp-1 font-heading text-lg font-extrabold leading-[1.12] text-slate-950 transition-colors group-hover:text-primary dark:text-white">
              {beachDisplayName}
            </h3>
            {(showIslandName || distance !== undefined || isProtectedToday) && (
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {(showIslandName || distance !== undefined) && <MapPin className="h-3.5 w-3.5 shrink-0" />}
                {showIslandName && <span className="min-w-0 flex-1 truncate">{islandName}</span>}
                {distance !== undefined && <span className="shrink-0 text-primary">{distance.toFixed(1)} km</span>}
                {isProtectedToday && <ProtectedBeachMarker language={language} selectedDate={selectedDate} />}
              </div>
            )}
          </div>

          <div className={`grid grid-cols-1 ${isCompact ? 'gap-2 lg:gap-1.5' : 'gap-2'}`}>
            {todayScore !== undefined ? (
              <TodayScoreBadge
                score={todayScore}
                language={language}
                selectedDate={selectedDate}
                windBeaufort={windBeaufort}
                waveHeightM={waveHeightM}
                swimmingComfort={swimmingComfort}
                noIdealSwimmingWindow={noIdealSwimmingWindow}
                exposureLevel={exposureLevel}
              />
            ) : (
              <div className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" title={labels.visitorRating}>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{rating.toFixed(1)}</span>
              </div>
            )}
            {topPickTimeLabel && (
              <div className="inline-flex min-h-8 w-full min-w-0 items-center justify-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/78 px-3 py-1 text-xs font-bold leading-tight text-emerald-700 dark:border-emerald-900/45 dark:bg-emerald-950/25 dark:text-emerald-300">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate whitespace-nowrap">{topPickTimeLabel}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <span className={`${compactChipBase} ${hideConditionChip ? 'col-span-2' : ''} border-slate-200/70 bg-white/58 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200`}>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate whitespace-nowrap">{accessLabel}</span>
            </span>
            {!hideConditionChip && (
              <span className={`${compactChipBase} ${protectionChipTone}`}>
                {isProtectedToday ? <Waves className="h-3.5 w-3.5 shrink-0" /> : <Shield className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate whitespace-nowrap">{isProtectedToday ? seaLabel : protectionLabel}</span>
              </span>
            )}
          </div>

          {featureChips.length > 0 && (
            <div className={`grid ${isCompact ? 'min-h-[4.375rem] lg:min-h-[3.75rem]' : 'min-h-[4.375rem]'} grid-cols-2 content-start gap-1.5`}>
              {featureChips.map(chip => (
                <span
                  key={chip.key}
                  className={`${featureChipBase} ${featureChips.length % 2 === 1 && chip.key === featureChips[featureChips.length - 1].key ? 'col-span-2' : ''}`}
                >
                  {chip.icon}
                  <span className="min-w-0 text-center leading-tight">{chip.label}</span>
                </span>
              ))}
            </div>
          )}

        </div>

        <div className={`mt-auto flex items-center gap-2 ${isCompact ? 'px-4 pb-4 lg:px-3 lg:pb-3' : 'px-4 pb-4'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className={`inline-flex ${isCompact ? 'min-h-11 lg:min-h-10' : 'min-h-11'} flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-heading font-bold text-white shadow-sm shadow-cyan-600/20 transition-colors hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer`}
          >
            <Info className="h-4 w-4" />
            <span>{t.learnMore}</span>
          </button>
          <button
            onClick={handleNavigationClick}
            className={`grid ${isCompact ? 'h-11 w-11 lg:h-10 lg:w-10' : 'h-11 w-11'} place-items-center rounded-xl bg-sky-50 text-primary transition-colors hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-sky-900/20 dark:hover:bg-sky-900/40 cursor-pointer`}
            title={t.navigate}
            aria-label={t.navigateToLabel(beachDisplayName)}
          >
            <Navigation className="h-4 w-4" />
          </button>
          {navigator.share && (
            <button
              onClick={handleShare}
              className={`grid ${isCompact ? 'h-11 w-11 lg:h-10 lg:w-10' : 'h-11 w-11'} place-items-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-slate-800 cursor-pointer`}
              aria-label={shareLabel}
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative beach-card overflow-hidden flex flex-col h-full cursor-pointer"
    >
      <div className="relative aspect-[16/9] min-h-40 max-h-48 overflow-hidden bg-sky-50">
        {cardPhoto ? (
          <img
            src={cardPhoto}
            alt={beachDisplayName}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            width={640}
            height={360}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setPhotoIndex((current) => current + 1)}
          />
        ) : (
          <BeachLocationPlaceholder language={language} avoidTopLeft={recommendationRank !== undefined || hasBlueFlag2026} />
        )}
        {/* Dark overlay for readability when photo is present */}
        {cardPhoto && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/0" />}
        {/* Decorative wave pattern — aggressive for exposed, gentle for sheltered */}
        <svg className="absolute bottom-0 left-0 w-full text-white dark:text-slate-900 opacity-90" viewBox="0 0 400 40" preserveAspectRatio="none">
          {isExposed ? (
            <path d="M0 40 Q50 15 100 30 Q150 45 200 20 Q250 -5 300 25 Q350 45 400 15 L400 40 Z" fill="currentColor"/>
          ) : (
            <path d="M0 40 Q100 30 200 35 Q300 40 400 32 L400 40 Z" fill="currentColor"/>
          )}
        </svg>

        {/* Top badges overlay */}
        <div className="absolute top-3 left-3 flex max-w-[calc(100%-4.25rem)] flex-wrap gap-1.5">
          <div className={`px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm ${
            isProtectedToday ? 'bg-emerald-500/90 text-white' :
            isExposed ? 'bg-amber-500/90 text-white' : 'bg-sky-500/90 text-white'
          }`}>
            {isProtectedToday
              ? t.shelteredTooltip
              : (isExposed ? t.exposedTooltip : (language === 'gr' ? 'Έλεγχος τοπικής έκθεσης' : 'Check local exposure'))}
          </div>
          {hasBlueFlag2026 && <BlueFlagBadge language={language} compact />}
        </div>

        {/* Favorite button overlay */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
          aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
        >
          <Heart
            className={`w-4 h-4 transition-all duration-300 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400 hover:text-red-400'}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Name & Location */}
        <div className="mb-3">
          <h3 className="text-xl font-heading font-bold text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors duration-300">
            {beachDisplayName}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-slate-400">
            <MapPin className="w-3 h-3" />
            <span className="text-xs">{islandName}</span>
            {distance !== undefined && (
              <span className="text-xs text-primary font-medium">{distance.toFixed(1)} km</span>
            )}
          </div>
        </div>

        {/* Rating + Conditions row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {todayScore !== undefined ? (
            <>
              <TodayScoreBadge
                score={todayScore}
                language={language}
                selectedDate={selectedDate}
                windBeaufort={windBeaufort}
                waveHeightM={waveHeightM}
                swimmingComfort={swimmingComfort}
                noIdealSwimmingWindow={noIdealSwimmingWindow}
                exposureLevel={exposureLevel}
              />
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500" title="Visitor rating">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span>{rating.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{rating.toFixed(1)}</span>
            </div>
          )}

          {crowdLevel && (
            <span className={`text-[10px] font-bold ${
              crowdLevel === 'low' ? 'text-emerald-600' :
              crowdLevel === 'medium' ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {t.crowdLevels[crowdLevel]}
            </span>
          )}

          {metadata?.access ? <MetadataAccessInfo metadata={metadata} language={language} /> : <AccessibilityInfo accessibility={accessibility} t={t} />}
        </div>

        {metadata?.access?.notes && (
          <div className="mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">{localizedAccessPrefix(language)}: </span>
              {language === 'gr' ? metadata.access.notes : localizedAccessLabel(metadata.access.type, metadata.access.label, language)}
            </p>
          </div>
        )}

        {/* Best Swim Window */}
        {bestSwimWindow && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-sky-50/80 dark:bg-sky-900/10 rounded-xl">
            <Waves className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{bestSwimWindow}</span>
          </div>
        )}

        {/* Condition Score */}
        <div className="mb-3">
          <BeachConditionScore isExposed={isExposed} windSpeed={windSpeed * 3.6} waveHeightM={waveHeightM} temperature={temperature} compact={true} exposureLevel={exposureLevel} language={language} selectedDate={selectedDate} canClaimWindProtection={canClaimWindProtection} />
        </div>

        {warnings.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {warnings.slice(0, 2).map((warning, index) => (
              <span
                key={`${warning.type}-${index}`}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${warningToneClass(warning)}`}
              >
                {strongWindContext && warning.type === 'exposed_to_wind'
                  ? displayOpenBeachLabel
                  : warningLabel(warning, language, selectedDate)}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-4">
          {localizedBeachDescription(beach, language)}
        </p>

        {/* Tags */}
        <div className="mt-auto flex flex-wrap gap-1.5 mb-4">
          {metadata ? (
            <MetadataTags beach={beach} language={language} />
          ) : (
            <>
              <BeachTypeTag beachType={beachType} t={t} />
              <CharacteristicTags characteristics={characteristics} t={t} />
            </>
          )}
        </div>

        {/* Amenities */}
        {!metadata && (
          <div className="mb-4">
            <AmenityTags beach={beach} language={language} />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className="flex-grow inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark active:scale-[0.98] text-white font-heading font-semibold rounded-xl transition-all duration-300 cursor-pointer min-h-[44px]"
        >
          <Info className="w-4 h-4" />
          <span className="text-xs">{t.learnMore}</span>
        </button>

        <button
          onClick={handleNavigationClick}
          className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-primary hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
          title={t.navigate}
          aria-label={t.navigateToLabel(beachDisplayName)}
        >
          <Navigation className="w-4 h-4" />
        </button>

        {navigator.share && (
          <button
            onClick={handleShare}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors cursor-pointer"
            aria-label={shareLabel}
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
