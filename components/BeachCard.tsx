
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Star, Share2, Heart, Navigation, Info, ChevronDown, ChevronUp, Waves, Utensils, Trees, Umbrella, CircleDot, CircleDotDashed, Layers, Mountain, Droplets, ArrowDown, Sparkles, BadgeCheck, Leaf } from 'lucide-react';
import { Beach, Accessibility, LanguageCode, WaveCondition, BeachType, CrowdLevel } from '../types';
import { getWaveCondition } from '../utils/weatherUtils';
import { Translation } from '../types';

import { openNavigation } from '../utils/navigation';
import { BeachConditionScore } from './BeachConditionScore';
import { getBeachPhotos } from '../services/beachPhotos';
import { ExposureLevel } from '../utils/windExposure';
import {
  displayBeachName,
  localizedAccessLabel,
  localizedAccessPrefix,
  localizedAmenityText,
  localizedBeachDescription,
  localizedOrganizationLabel,
  localizedShadeLabel,
  localizedTerrainLabel,
  localizedWaterDepthLabel,
} from '../utils/localization';

interface BeachCardProps {
  beach: Beach & { distance?: number };
  isExposed?: boolean;
  language: LanguageCode;
  t: Translation;
  isCalm?: boolean;
  windSpeed: number;
  temperature?: number;
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  islandName: string;
  onClick?: () => void;
  scoreLabel?: string;
  bestSwimWindow?: string;
  crowdLevel?: CrowdLevel;
  exposureLevel?: ExposureLevel;
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

const AmenityTags: React.FC<{ amenities: Beach['amenities']; t: Translation }> = ({ amenities, t }) => {
  let presentAmenities = (Object.keys(amenities) as Array<keyof typeof amenities>).filter(key => amenities[key]);
  // Avoid duplicate icons: skip 'restaurant' when 'taverna' present (both Utensils), skip 'sunbeds' when 'organized' present.
  if (presentAmenities.includes('taverna') && presentAmenities.includes('restaurant')) {
    presentAmenities = presentAmenities.filter(a => a !== 'restaurant');
  }
  if (presentAmenities.includes('organized') && presentAmenities.includes('sunbeds')) {
    presentAmenities = presentAmenities.filter(a => a !== 'sunbeds');
  }
  if (presentAmenities.length === 0) return null;

  const iconMap: Record<keyof Beach['amenities'], React.ReactNode> = {
    organized: <BadgeCheck className="w-3.5 h-3.5" />,
    naturalShade: <Trees className="w-3.5 h-3.5" />,
    taverna: <Utensils className="w-3.5 h-3.5" />,
    beachBar: <Waves className="w-3.5 h-3.5" />,
    sunbeds: <Umbrella className="w-3.5 h-3.5" />,
    restaurant: <Utensils className="w-3.5 h-3.5" />,
    parking: <MapPin className="w-3.5 h-3.5" />,
  };

  return (
    <div className="flex flex-wrap gap-2">
      {presentAmenities.map(amenity => (
        <div key={amenity} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500" title={t.filterOptions[amenity]}>
          {iconMap[amenity]}
        </div>
      ))}
    </div>
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
  const tone = metadataAccessTone[metadata.access.type] || metadataAccessTone.asphalt_road;

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${tone.className}`} title={metadata.access.notes}>
      <MapPin className={`h-4 w-4 mr-2 ${tone.iconClassName}`} />
      <span>{localizedAccessLabel(metadata.access.type, metadata.access.label, language)}</span>
    </div>
  );
};

const MetadataTags: React.FC<{ metadata: NonNullable<Beach['metadata']>; language: LanguageCode }> = ({ metadata, language }) => {
  const terrainTypes = metadata.terrain.types.slice(0, 3);
  const waterDepth = metadata.waterDepth;
  const visibleAmenities = metadata.amenities
    .filter(item => !/καμία οργανωμένη παροχή|χωρίς σταθερές παροχές/i.test(item))
    .slice(0, 3);

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
      <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 ${
        metadata.organized
          ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300'
          : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}>
        {metadata.organized ? <BadgeCheck className="w-3.5 h-3.5" /> : <Leaf className="w-3.5 h-3.5" />}
        <span>{localizedOrganizationLabel(metadata.organized, language)}</span>
      </div>
      {metadata.shade && (
        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 rounded text-[10px] font-bold flex items-center gap-1.5">
          <Trees className="w-3.5 h-3.5" />
          <span>{localizedShadeLabel(language)}</span>
        </div>
      )}
      {visibleAmenities.map(item => (
        <div key={item} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400">
          {localizedAmenityText(item, language)}
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

export const BeachCard: React.FC<BeachCardProps> = ({
  beach,
  isExposed = false,
  language,
  t,
  isCalm = false,
  windSpeed,
  temperature,
  favorites,
  onToggleFavorite,
  islandName,
  onClick,
  scoreLabel,
  bestSwimWindow,
  crowdLevel,
  exposureLevel
}) => {
  const [animateHeart, setAnimateHeart] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const { name, rating, description, amenities, accessibility, distance, beachType, characteristics, coordinates, metadata } = beach;
  const beachDisplayName = displayBeachName(name, language);
  const waveCondition = getWaveCondition(isExposed, windSpeed * 3.6);
  const isFavorite = favorites.includes(beach.id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFavorite) setAnimateHeart(true);
    onToggleFavorite(beach.id);
  };

  const cardPhotos = getBeachPhotos(name.gr, name.en, beach.id, 3, islandName);
  const cardPhoto = photoIndex < cardPhotos.length ? cardPhotos[photoIndex] : null;

  useEffect(() => {
    setPhotoIndex(0);
  }, [beach.id, islandName, name.en, name.gr]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({
          text: t.sharing.text(beachDisplayName),
          url: shareUrl,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error('Error sharing:', error);
      }
    }
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative beach-card overflow-hidden flex flex-col h-full cursor-pointer"
    >
      {/* Beach photo or gradient fallback */}
      <div
        className={`relative h-40 ${!cardPhoto ? `bg-gradient-to-br ${isExposed ? (exposedGradients[beachType] || exposedGradients.sandy) : (shelteredGradients[beachType] || shelteredGradients.sandy)}` : ''} overflow-hidden`}
      >
        {cardPhoto && (
          <img
            src={cardPhoto}
            alt={beachDisplayName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setPhotoIndex((current) => current + 1)}
          />
        )}
        {!cardPhoto && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.65),transparent_28%),linear-gradient(135deg,rgba(14,165,233,0.35),rgba(45,212,191,0.22)_45%,rgba(255,255,255,0.45))]" />
            <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/35 text-sky-600 shadow-sm backdrop-blur-sm">
              <Waves className="h-8 w-8" />
            </div>
            <div className="absolute -bottom-8 left-0 h-20 w-full rounded-[50%] bg-white/45 blur-sm" />
          </div>
        )}
        {/* Dark overlay for readability when photo is present */}
        {cardPhoto && <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />}
        {/* Decorative wave pattern — aggressive for exposed, gentle for sheltered */}
        <svg className="absolute bottom-0 left-0 w-full text-white dark:text-slate-900 opacity-90" viewBox="0 0 400 40" preserveAspectRatio="none">
          {isExposed ? (
            <path d="M0 40 Q50 15 100 30 Q150 45 200 20 Q250 -5 300 25 Q350 45 400 15 L400 40 Z" fill="currentColor"/>
          ) : (
            <path d="M0 40 Q100 30 200 35 Q300 40 400 32 L400 40 Z" fill="currentColor"/>
          )}
        </svg>

        {/* Top badges overlay */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {scoreLabel && (
            <div className="px-3 py-1 bg-primary/90 backdrop-blur-sm text-white rounded-lg text-[10px] font-bold">
              {scoreLabel}
            </div>
          )}
          <div className={`px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm ${
            isCalm ? 'bg-emerald-500/90 text-white' :
            isExposed ? 'bg-amber-500/90 text-white' : 'bg-sky-500/90 text-white'
          }`}>
            {isCalm ? t.shelteredTooltip : (isExposed ? t.exposedTooltip : t.shelteredTooltip)}
          </div>
        </div>

        {/* Favorite button overlay */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
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
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{rating.toFixed(1)}</span>
          </div>

          {crowdLevel && (
            <span className={`text-[10px] font-bold ${
              crowdLevel === 'low' ? 'text-emerald-600' :
              crowdLevel === 'medium' ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {t.crowdLevels[crowdLevel]}
            </span>
          )}

          {metadata ? <MetadataAccessInfo metadata={metadata} language={language} /> : <AccessibilityInfo accessibility={accessibility} t={t} />}
        </div>

        {metadata?.access.notes && (
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
          <BeachConditionScore isExposed={isExposed} windSpeed={windSpeed * 3.6} temperature={temperature} compact={true} exposureLevel={exposureLevel} language={language} />
        </div>

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-4">
          {localizedBeachDescription(beach, language)}
        </p>

        {/* Tags */}
        <div className="mt-auto flex flex-wrap gap-1.5 mb-4">
          {metadata ? (
            <MetadataTags metadata={metadata} language={language} />
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
            <AmenityTags amenities={amenities} t={t} />
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
          onClick={(e) => { e.stopPropagation(); openNavigation(beach); }}
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
            aria-label="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
