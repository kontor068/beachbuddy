
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, MapPin, Star, Share2, Heart, Navigation, Info, Waves, Utensils, Trees, CircleDot, CircleDotDashed, Mountain, Droplets, ArrowDown, BadgeCheck, Leaf, Shield, Users, Clock3, Flag, Footprints, Wind, Accessibility as AccessibilityIcon } from 'lucide-react';
import { Beach, Accessibility, LanguageCode, BeachType, CrowdLevel, WarningFlag, RecommendationConfidence, SwimmingComfort, WindSuitabilityColor } from '../types';
import { getBeaufortLevel } from '../utils/weatherUtils';
import { Translation } from '../types';

import { canOpenNavigation, getNavigationBadge, openNavigation } from '../utils/navigation';
import { BeachConditionScore } from './BeachConditionScore';
import { TodayScoreBadge } from './TodayScoreBadge';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { trackEvent } from '../services/analyticsService';
import { ExposureLevel } from '../utils/windExposure';
import { hasDirtRoadAccess } from '../utils/access';
import { getSelectedDayPrefix, getSelectedDaySentencePrefix } from '../utils/dateLabels';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';
import { buildBeachShareUrl } from '../utils/beachUrls';
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
import { SandDotsIcon, SandPebblesIcon, SunbedIcon } from './BeachFeatureIcons';

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
  regionId?: string;
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
  windSuitabilityText?: string;
  windSuitabilityColor?: WindSuitabilityColor;
  hideExposureBadge?: boolean;
  /**
   * Controls the wind-exposure chip on the card:
   * - 'none': never show it (e.g. "best beaches" — no explanation needed)
   * - 'simple': only show it when a beach is clearly more protected or more exposed
   * - undefined: legacy behaviour
   */
  windExposureMode?: 'none' | 'simple';
  showTodayScoreBadge?: boolean;
}

type CardCopy = {
  shelteredChip: (sentenceDay: string) => string;
  shelteredChipA11y: (sentenceDay: string) => string;
  blueFlag: string;
  accessible: string;
  dirtRoad: string;
  localExposureCheck: string;
  moreOpenToWind: string;
  exposedToWind: string;
  favorite: string;
  unfavorite: string;
  share: string;
  warnings: {
    seaEstimate: string;
    highWaves: string;
    someWaves: string;
    strongWind: string;
    windSportSpot: string;
    exposedToWind: (day: string) => string;
    breezy: string;
    difficultAccess: string;
    boatOnly: string;
    lowConfidence: string;
    roughSea: string;
    choppy: string;
  };
  compact: {
    calmWaters: string;
    goodSea: string;
    protected: (sentenceDay: string) => string;
    lightWind: string;
    mildlyBreezy: string;
    windyExposed: string;
    partlyShelteredToday: (day: string) => string;
    slightlyExposed: string;
    familyFriendly: string;
    shallowWaters: string;
    shallowWatersCaution: string;
    easyAccess: string;
    facilities: string;
    noFacilities: string;
    naturalShade: string;
    goodWithWind: string;
    calmButWindier: string;
    visitorRating: string;
  };
  access: {
    asphaltRoad: string;
    dirtRoad: string;
    difficultDirtRoad: string;
    difficultRoad: string;
    pathAccess: string;
    hardPath: string;
    boatOnly: string;
    moderateAccess: string;
  };
  amenities: Record<AmenityChip['key'], string>;
};

const cardCopy: Record<LanguageCode, CardCopy> = {
  en: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: better sheltered`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: better sheltered option`,
    blueFlag: 'Blue Flag',
    accessible: 'Accessible',
    dirtRoad: 'Dirt road',
    localExposureCheck: 'Check local exposure',
    moreOpenToWind: 'More open to wind',
    exposedToWind: 'Exposed to wind',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    share: 'Share',
    warnings: {
      seaEstimate: 'Sea estimate',
      highWaves: 'High waves',
      someWaves: 'Some waves',
      strongWind: 'Strong wind',
      windSportSpot: 'Wind/watersports spot',
      exposedToWind: (day) => `Exposed to wind ${day}`,
      breezy: 'May feel breezy',
      difficultAccess: 'More challenging access',
      boatOnly: 'Boat only',
      lowConfidence: 'Local exposure unverified',
      roughSea: 'Rough sea',
      choppy: 'Choppy',
    },
    compact: {
      calmWaters: 'Low waves',
      goodSea: 'Good sea',
      protected: (sentenceDay) => `${sentenceDay}: better sheltered`,
      lightWind: 'Light wind',
      mildlyBreezy: 'May feel breezy',
      windyExposed: 'Windy / exposed',
      partlyShelteredToday: (day) => `Better out of the wind ${day}`,
      slightlyExposed: 'May feel breezy',
      familyFriendly: 'Family',
      shallowWaters: 'Shallow water',
      shallowWatersCaution: 'Shallow water',
      easyAccess: 'Easy access',
      facilities: 'Facilities',
      noFacilities: 'No facilities',
      naturalShade: 'Natural shade',
      goodWithWind: 'Good option, with a little more wind',
      calmButWindier: 'Low waves, but a little windier',
      visitorRating: 'Visitor rating',
    },
    access: {
      asphaltRoad: 'Easy access',
      dirtRoad: 'Dirt road',
      difficultDirtRoad: 'Rough dirt road',
      difficultRoad: 'Difficult road',
      pathAccess: 'Path access',
      hardPath: 'Hard path',
      boatOnly: 'Boat only',
      moderateAccess: 'Moderate access',
    },
    amenities: {
      beachBar: 'Beach bar',
      sunbeds: 'Sunbeds',
      foodNearby: 'Taverna',
      cafeNearby: 'Cafe',
      parking: 'Parking',
      organizedFacilities: 'Facilities',
      noFacilities: 'No facilities',
      seasonalFacilities: 'Seasonal',
      unknownFacilities: 'Unknown',
    },
  },
  gr: {
    shelteredChip: () => 'Προστατευμένη',
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: προστατευμένη επιλογή`,
    blueFlag: 'Γαλάζια Σημαία',
    accessible: 'Προσβάσιμη ΑμεΑ',
    dirtRoad: 'Χωματόδρομος',
    localExposureCheck: 'Έλεγχος τοπικής έκθεσης',
    moreOpenToWind: 'Πιο ανοιχτή στον άνεμο',
    exposedToWind: 'Εκτεθειμένη στον άνεμο',
    favorite: 'Προσθήκη στα αγαπημένα',
    unfavorite: 'Αφαίρεση από τα αγαπημένα',
    share: 'Κοινοποίηση',
    warnings: {
      seaEstimate: 'Εκτίμηση θάλασσας',
      highWaves: 'Υψηλό κύμα',
      someWaves: 'Λίγο κύμα',
      strongWind: 'Δυνατός αέρας',
      windSportSpot: 'Παραλία για wind sports',
      exposedToWind: (day) => `Εκτεθειμένη στον άνεμο ${day}`,
      breezy: 'Μπορεί να έχει αέρα',
      difficultAccess: 'Πιο δύσκολη πρόσβαση',
      boatOnly: 'Μόνο με σκάφος',
      lowConfidence: 'Θέλει επιβεβαίωση τοπικά',
      roughSea: 'Έντονος κυματισμός',
      choppy: 'Κυματισμός',
    },
    compact: {
      calmWaters: 'Χαμηλό κύμα',
      goodSea: 'Καλή θάλασσα',
      protected: () => 'Προστατευμένη',
      lightWind: 'Ήπιος άνεμος',
      mildlyBreezy: 'Μπορεί να έχει αέρα',
      windyExposed: 'Εκτεθειμένη στον άνεμο',
      partlyShelteredToday: () => 'Υπήνεμη',
      slightlyExposed: 'Μπορεί να έχει αέρα',
      familyFriendly: 'Για παιδιά',
      shallowWaters: 'Ρηχά νερά',
      shallowWatersCaution: 'Ρηχά νερά',
      easyAccess: 'Εύκολη πρόσβαση',
      facilities: 'Παροχές',
      noFacilities: 'Χωρίς παροχές',
      naturalShade: 'Φυσική σκιά',
      goodWithWind: 'Καλή επιλογή, με λίγο περισσότερο αέρα',
      calmButWindier: 'Χαμηλό κύμα, αλλά περισσότερος αέρας',
      visitorRating: 'Βαθμολογία επισκεπτών',
    },
    access: {
      asphaltRoad: 'Εύκολη πρόσβαση',
      dirtRoad: 'Χωματόδρομος',
      difficultDirtRoad: 'Κακός χωματόδρομος',
      difficultRoad: 'Δύσκολη πρόσβαση',
      pathAccess: 'Μονοπάτι',
      hardPath: 'Δύσκολο μονοπάτι',
      boatOnly: 'Με σκάφος',
      moderateAccess: 'Μέτρια πρόσβαση',
    },
    amenities: {
      beachBar: 'Beach bar',
      sunbeds: 'Ξαπλώστρες',
      foodNearby: 'Ταβέρνα',
      cafeNearby: 'Καφέ',
      parking: 'Parking',
      organizedFacilities: 'Παροχές',
      noFacilities: 'Χωρίς παροχές',
      seasonalFacilities: 'Εποχικές παροχές',
      unknownFacilities: 'Άγνωστες παροχές',
    },
  },
  fr: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: plus abritée`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: option plus abritée`,
    blueFlag: 'Pavillon Bleu',
    accessible: 'Accessible PMR',
    dirtRoad: 'Piste',
    localExposureCheck: "Exposition locale à vérifier",
    moreOpenToWind: 'Plus ouverte au vent',
    exposedToWind: 'Exposée au vent',
    favorite: 'Ajouter aux favoris',
    unfavorite: 'Retirer des favoris',
    share: 'Partager',
    warnings: {
      seaEstimate: 'Estimation de mer',
      highWaves: 'Vagues hautes',
      someWaves: 'Un peu de clapot',
      strongWind: 'Vent fort',
      windSportSpot: 'Spot de sports nautiques',
      exposedToWind: (day) => `Exposée au vent ${day}`,
      breezy: 'Peut être venteuse',
      difficultAccess: 'Accès plus difficile',
      boatOnly: 'Bateau uniquement',
      lowConfidence: 'Exposition locale non vérifiée',
      roughSea: 'Mer agitée',
      choppy: 'Clapot',
    },
    compact: {
      calmWaters: 'Vagues basses',
      goodSea: 'Mer correcte',
      protected: (sentenceDay) => `${sentenceDay}: plus abritée`,
      lightWind: 'Vent léger',
      mildlyBreezy: 'Peut être venteuse',
      windyExposed: 'Venteuse / exposée',
      partlyShelteredToday: (day) => `Plus à l'abri du vent ${day}`,
      slightlyExposed: 'Peut être venteuse',
      familyFriendly: 'Famille',
      shallowWaters: 'Eau peu profonde',
      shallowWatersCaution: 'Eau peu profonde',
      easyAccess: 'Accès facile',
      facilities: 'Services',
      noFacilities: 'Sans services',
      naturalShade: 'Ombre naturelle',
      goodWithWind: 'Bonne option, un peu plus de vent',
      calmButWindier: 'Vagues basses, mais un peu plus de vent',
      visitorRating: 'Note visiteurs',
    },
    access: {
      asphaltRoad: 'Accès facile',
      dirtRoad: 'Piste',
      difficultDirtRoad: 'Piste difficile',
      difficultRoad: 'Route difficile',
      pathAccess: 'Sentier',
      hardPath: 'Sentier difficile',
      boatOnly: 'Bateau uniquement',
      moderateAccess: 'Accès moyen',
    },
    amenities: {
      beachBar: 'Bar de plage',
      sunbeds: 'Transats',
      foodNearby: 'Taverne',
      cafeNearby: 'Café',
      parking: 'Parking',
      organizedFacilities: 'Services',
      noFacilities: 'Sans services',
      seasonalFacilities: 'Saisonnier',
      unknownFacilities: 'Inconnu',
    },
  },
  de: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: geschützter`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: windgeschütztere Option`,
    blueFlag: 'Blaue Flagge',
    accessible: 'Barrierefrei',
    dirtRoad: 'Schotterweg',
    localExposureCheck: 'Lokale Exposition prüfen',
    moreOpenToWind: 'Offener zum Wind',
    exposedToWind: 'Windexponiert',
    favorite: 'Zu Favoriten hinzufügen',
    unfavorite: 'Aus Favoriten entfernen',
    share: 'Teilen',
    warnings: {
      seaEstimate: 'Meeres-Schätzung',
      highWaves: 'Hohe Wellen',
      someWaves: 'Etwas Welle',
      strongWind: 'Starker Wind',
      windSportSpot: 'Wind-/Wassersportspot',
      exposedToWind: (day) => `Windexponiert ${day}`,
      breezy: 'Kann windig wirken',
      difficultAccess: 'Schwieriger Zugang',
      boatOnly: 'Nur per Boot',
      lowConfidence: 'Lokale Exposition nicht verifiziert',
      roughSea: 'Raue See',
      choppy: 'Kabbelig',
    },
    compact: {
      calmWaters: 'Niedrige Wellen',
      goodSea: 'Gute See',
      protected: (sentenceDay) => `${sentenceDay}: geschützter`,
      lightWind: 'Leichter Wind',
      mildlyBreezy: 'Kann windig wirken',
      windyExposed: 'Windig / exponiert',
      partlyShelteredToday: (day) => `Mehr aus dem Wind ${day}`,
      slightlyExposed: 'Kann windig wirken',
      familyFriendly: 'Familie',
      shallowWaters: 'Flaches Wasser',
      shallowWatersCaution: 'Flaches Wasser',
      easyAccess: 'Einfach',
      facilities: 'Ausstattung',
      noFacilities: 'Keine Ausstattung',
      naturalShade: 'Naturschatten',
      goodWithWind: 'Gute Option, etwas windiger',
      calmButWindier: 'Niedrige Wellen, aber etwas windiger',
      visitorRating: 'Besucherwertung',
    },
    access: {
      asphaltRoad: 'Einfach',
      dirtRoad: 'Schotterweg',
      difficultDirtRoad: 'Schwieriger Schotterweg',
      difficultRoad: 'Schwierige Straße',
      pathAccess: 'Fußweg',
      hardPath: 'Schwieriger Fußweg',
      boatOnly: 'Nur Boot',
      moderateAccess: 'Mittlerer Zugang',
    },
    amenities: {
      beachBar: 'Beach Bar',
      sunbeds: 'Liegen',
      foodNearby: 'Taverne',
      cafeNearby: 'Café',
      parking: 'Parken',
      organizedFacilities: 'Ausstattung',
      noFacilities: 'Keine Ausstattung',
      seasonalFacilities: 'Saisonal',
      unknownFacilities: 'Unbekannt',
    },
  },
  it: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: più riparata`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: opzione più riparata`,
    blueFlag: 'Bandiera Blu',
    accessible: 'Accessibile',
    dirtRoad: 'Strada sterrata',
    localExposureCheck: 'Verifica esposizione locale',
    moreOpenToWind: 'Più aperta al vento',
    exposedToWind: 'Esposta al vento',
    favorite: 'Aggiungi ai preferiti',
    unfavorite: 'Rimuovi dai preferiti',
    share: 'Condividi',
    warnings: {
      seaEstimate: 'Stima mare',
      highWaves: 'Onde alte',
      someWaves: 'Un po’ di onda',
      strongWind: 'Vento forte',
      windSportSpot: 'Spot wind/watersport',
      exposedToWind: (day) => `Esposta al vento ${day}`,
      breezy: 'Può essere ventilata',
      difficultAccess: 'Accesso più difficile',
      boatOnly: 'Solo in barca',
      lowConfidence: 'Esposizione locale non verificata',
      roughSea: 'Mare mosso',
      choppy: 'Mare increspato',
    },
    compact: {
      calmWaters: 'Onde basse',
      goodSea: 'Mare buono',
      protected: (sentenceDay) => `${sentenceDay}: più riparata`,
      lightWind: 'Vento leggero',
      mildlyBreezy: 'Può essere ventilata',
      windyExposed: 'Ventosa / esposta',
      partlyShelteredToday: (day) => `Più riparata dal vento ${day}`,
      slightlyExposed: 'Può essere ventilata',
      familyFriendly: 'Famiglia',
      shallowWaters: 'Acqua bassa',
      shallowWatersCaution: 'Acqua bassa',
      easyAccess: 'Facile',
      facilities: 'Servizi',
      noFacilities: 'Senza servizi',
      naturalShade: 'Ombra naturale',
      goodWithWind: 'Buona opzione, un po’ più ventosa',
      calmButWindier: 'Onde basse, ma un po’ più ventosa',
      visitorRating: 'Voto visitatori',
    },
    access: {
      asphaltRoad: 'Facile',
      dirtRoad: 'Sterrato',
      difficultDirtRoad: 'Sterrato difficile',
      difficultRoad: 'Strada difficile',
      pathAccess: 'Sentiero',
      hardPath: 'Sentiero difficile',
      boatOnly: 'Solo barca',
      moderateAccess: 'Accesso medio',
    },
    amenities: {
      beachBar: 'Beach bar',
      sunbeds: 'Lettini',
      foodNearby: 'Taverna',
      cafeNearby: 'Caffè',
      parking: 'Parcheggio',
      organizedFacilities: 'Servizi',
      noFacilities: 'Senza servizi',
      seasonalFacilities: 'Stagionale',
      unknownFacilities: 'Sconosciuto',
    },
  },
};

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
          icon: <Footprints className="h-5 w-5 mr-2 text-green-500" aria-hidden="true" />,
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
      return <SunbedIcon className="h-3.5 w-3.5" />;
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
  const copy = getLocalizedCopy(language, cardCopy);
  const label = copy.shelteredChip(day);
  const accessibleLabel = copy.shelteredChipA11y(day);

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
  const label = getLocalizedCopy(language, cardCopy).blueFlag;

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

const AccessibilityBadge: React.FC<{ language: LanguageCode; compact?: boolean }> = ({ language, compact = false }) => {
  const label = getLocalizedCopy(language, cardCopy).accessible;

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-100 bg-white/88 font-bold leading-none text-sky-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <AccessibilityIcon className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

const BeachTypeTag: React.FC<{ beachType: BeachType; t: Translation }> = ({ beachType, t }) => {
  if (beachType === 'unknown') return null;

  const icons: Record<BeachType, React.ReactNode> = {
    sandy: <SandDotsIcon className="h-3.5 w-3.5" />,
    pebbles: <CircleDot className="w-3.5 h-3.5" />,
    'sandy-pebbles': <SandPebblesIcon className="h-3.5 w-3.5" />,
    rocky: <Mountain className="w-3.5 h-3.5" />,
    unknown: <Info className="w-3.5 h-3.5" />,
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
  fine_sand: <SandDotsIcon className="h-3.5 w-3.5" />,
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
  const copy = getLocalizedCopy(language, cardCopy);
  const label = isDirtRoad
    ? copy.dirtRoad
    : localizedAccessLabel(metadata.access.type, metadata.access.label, language);

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${tone.className}`} title={metadata.access.notes}>
      <Footprints className={`h-4 w-4 mr-2 ${tone.iconClassName}`} />
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

const warningLabel = (warning: WarningFlag, language: LanguageCode, selectedDate?: Date): string => {
  const copy = getLocalizedCopy(language, cardCopy).warnings;
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  switch (warning.type) {
    case 'missing_data':
      return copy.seaEstimate;
    case 'rough_sea':
      return warning.severity === 'critical'
        ? copy.highWaves
        : copy.someWaves;
    case 'strong_wind':
      return copy.strongWind;
    case 'wind_sport_spot':
      return copy.windSportSpot;
    case 'exposed_to_wind':
      return warning.severity === 'warning'
        ? copy.exposedToWind(day)
        : copy.breezy;
    case 'difficult_access':
      return copy.difficultAccess;
    case 'boat_only':
      return copy.boatOnly;
    case 'low_confidence':
      return copy.lowConfidence;
    default:
      return warning.message;
  }
};

const waveWarningLabel = (warning: WarningFlag, waveHeightM: number | undefined, language: LanguageCode, selectedDate?: Date): string => {
  const copy = getLocalizedCopy(language, cardCopy).warnings;
  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    if (waveHeightM >= 1.2) return copy.roughSea;
    if (waveHeightM >= 0.8) return copy.choppy;
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
  const copy = getLocalizedCopy(language, cardCopy).compact;

  return ({
  calmWaters: copy.calmWaters,
  goodSea: copy.goodSea,
  protected: copy.protected(sentenceDay),
  lightWind: copy.lightWind,
  mildlyBreezy: copy.mildlyBreezy,
  windyExposed: copy.windyExposed,
  partlyShelteredToday: copy.partlyShelteredToday(day),
  slightlyExposed: copy.slightlyExposed,
  familyFriendly: copy.familyFriendly,
  shallowWaters: copy.shallowWaters,
  shallowWatersCaution: copy.shallowWatersCaution,
  easyAccess: copy.easyAccess,
  facilities: copy.facilities,
  noFacilities: copy.noFacilities,
  naturalShade: copy.naturalShade,
  goodWithWind: copy.goodWithWind,
  calmButWindier: copy.calmButWindier,
  visitorRating: copy.visitorRating,
  });
};

const compactAccessLabel = (
  language: LanguageCode,
  accessibility: Accessibility,
  accessType: string | undefined,
  isDirtRoad: boolean,
  fallback: string
): string => {
  const copy = getLocalizedCopy(language, cardCopy).access;
  if (isDirtRoad) {
    return copy.dirtRoad;
  }

  const metadataLabels: Record<string, string> = {
    asphalt_road: copy.asphaltRoad,
    passable_dirt_road: copy.dirtRoad,
    difficult_dirt_road: copy.difficultDirtRoad,
    '4x4_only': copy.difficultRoad,
    hiking_path_easy: copy.pathAccess,
    hiking_path_difficult: copy.hardPath,
    boat_only: copy.boatOnly,
  };
  const accessibilityLabels: Record<Accessibility, string> = {
    [Accessibility.EASY]: copy.asphaltRoad,
    [Accessibility.MODERATE]: copy.moderateAccess,
    [Accessibility.DIFFICULT]: copy.difficultRoad,
    [Accessibility.BOAT_ONLY]: copy.boatOnly,
  };
  return (accessType && metadataLabels[accessType]) || accessibilityLabels[accessibility] || fallback;
};

const compactAmenityLabel = (chip: AmenityChip, language: LanguageCode): string => {
  const labels = getLocalizedCopy(language, cardCopy).amenities;
  return labels[chip.key] || chip.label;
};

type CompactFeatureChip = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

export const BeachCard: React.FC<BeachCardProps> = ({
  beach,
  isExposed = false,
  language,
  t,
  windSpeed,
  waveHeightM,
  temperature,
  favorites,
  onToggleFavorite,
  islandName,
  regionId,
  showIslandName = true,
  onClick,
  todayScore,
  variant = 'decision',
  density = 'regular',
  recommendationRank,
  recommendationLabel,
  bestSwimWindow,
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
  windSuitabilityText,
  windSuitabilityColor,
  hideExposureBadge = false,
  windExposureMode,
  showTodayScoreBadge = true,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const isCompact = density === 'compact';
  const { name, rating, amenities, accessibility, distance, beachType, characteristics, metadata } = beach;
  const beachDisplayName = displayBeachName(name, language);
  const hasBlueFlag2026 = beach.blueFlag2026?.awarded === true || metadata?.blueFlag2026?.awarded === true;
  // Badge only for currently-active ramps (same safe rule as the accessibility filter).
  const seatracAccess = beach.seatrac ?? metadata?.seatrac;
  const hasAccessibleRamp = seatracAccess?.hasSeatrac === true && seatracAccess.status === 'online';
  const isPartlyShelteredToday = exposureLevel === 'partial';
  const windBeaufort = getBeaufortLevel(windSpeed * 3.6);
  const isFavorite = favorites.includes(beach.id);
  const labels = compactLabels(language, selectedDate);
  const localizedCardCopy = getLocalizedCopy(language, cardCopy);
  const visitTimeLabel = getLocalizedCopy(language, {
    en: 'Best time',
    gr: 'Ώρα επίσκεψης',
    fr: 'Meilleur moment',
    de: 'Beste Zeit',
    it: 'Ora migliore',
  });
  const noIdealSwimmingWindow = swimmingComfort === 'avoid_swimming' || Boolean(
    warnings.some(warning => warning.type === 'rough_sea' && warning.severity === 'critical') ||
    (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 1.2)
  );
  const favoriteLabel = localizedCardCopy.favorite;
  const unfavoriteLabel = localizedCardCopy.unfavorite;
  const shareLabel = localizedCardCopy.share;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    const shareUrl = regionId
      ? buildBeachShareUrl(window.location.origin, regionId, beach)
      : window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        trackEvent('share_clicked', beach.id, {
          locale: languageToLocale(language),
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
    if (!canOpenNavigation(beach)) {
      return;
    }

    trackEvent('navigation_clicked', beach.id, {
      locale: languageToLocale(language),
      region: islandName,
      beach_name: name.en,
      source: 'beach_card',
    });
    openNavigation(beach);
  };
  const canNavigate = canOpenNavigation(beach);
  // Icon-only card buttons have no room for a visible pill; surface the badge reason via the
  // title/aria-label so the boat-only/unverified context still reaches the user (and screen
  // readers) without breaking the tight action grid on mobile.
  const navBadge = getNavigationBadge(beach);
  const navBadgeLabel = navBadge
    ? t.navigationBadge[navBadge === 'boat-access' ? 'boatAccess' : navBadge === 'nav-unavailable' ? 'unavailable' : 'unverified']
    : undefined;
  const navButtonTitle = navBadgeLabel ? `${t.navigate} — ${navBadgeLabel}` : t.navigate;

  const rawAccessLabel = metadata?.access
    ? localizedAccessLabel(metadata.access.type, metadata.access.label, language)
    : t.accessibility[accessibility];
  const accessLabel = compactAccessLabel(language, accessibility, metadata?.access?.type, hasDirtRoadAccess(beach), rawAccessLabel);
  const roughSeaWarning = warnings.find(warning => warning.type === 'rough_sea');
  const isProtectedToday = exposureLevel === 'protected' && canClaimWindProtection;
  const cautionWaterConditions = windBeaufort >= 5 || (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 0.8);
  const isLessExposedToday = lessExposedToday ?? (isProtectedToday || isPartlyShelteredToday);
  const strongOpenBeachLabel = localizedCardCopy.exposedToWind;
  const displayStrongOpenBeachLabel = strongOpenBeachLabel;
  const displayOpenBeachLabel = windBeaufort >= 4 || cautionWaterConditions
    ? displayStrongOpenBeachLabel
    : localizedCardCopy.moreOpenToWind;
  const baseProtectionLabel = isProtectedToday
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
  const protectionLabel = windSuitabilityText || baseProtectionLabel;
  const isLightWindConditionChip = windBeaufort < 4 && protectionLabel === labels.lightWind;
  const isExposedConditionChip = !isLightWindConditionChip && !isProtectedToday && (
    exposureLevel === 'exposed' ||
    protectionLabel === displayOpenBeachLabel ||
    protectionLabel === labels.windyExposed
  );
  const forceHideWindChip = windExposureMode === 'none';
  const simpleWindChipOnly = windExposureMode === 'simple';
  // For the simplified chip we only surface clearly protected or clearly exposed beaches.
  const windChipIsMeaningful = isProtectedToday || isExposedConditionChip;
  const showHeaderProtectedMarker = false;
  const windSuitabilityChipTone: Record<WindSuitabilityColor, string> = {
    green: 'border-emerald-200/80 bg-emerald-50/72 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
    yellow: 'border-yellow-200/90 bg-yellow-50/78 text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-300',
    orange: 'border-orange-200/90 bg-orange-50/78 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300',
    red: 'border-rose-200/90 bg-rose-50/78 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
  };
  const windSuitabilityIcon = windSuitabilityColor === 'orange' || windSuitabilityColor === 'red'
    ? 'caution'
    : windSuitabilityColor === 'green'
      ? 'shield'
      : 'wind';
  const protectionChipTone = windSuitabilityColor
    ? windSuitabilityChipTone[windSuitabilityColor]
    : isLightWindConditionChip
      ? 'border-cyan-200/80 bg-cyan-50/70 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300'
      : isExposedConditionChip
      ? 'border-rose-200/90 bg-rose-50/78 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
      : isProtectedToday || (strongWindContext && isLessExposedToday)
        ? 'border-emerald-200/80 bg-emerald-50/72 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
        : roughSeaWarning
        ? warningToneClass(roughSeaWarning)
        : 'border-cyan-200/80 bg-cyan-50/70 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300';
  const hasShallowWater = Boolean(metadata?.waterDepth?.type === 'shallow' || characteristics.shallowWaters);
  const beachTypeFeatureIcons: Record<BeachType, React.ReactNode> = {
    sandy: <SandDotsIcon className="h-3.5 w-3.5 shrink-0" />,
    pebbles: <CircleDot className="h-3.5 w-3.5 shrink-0" />,
    'sandy-pebbles': <SandPebblesIcon className="h-3.5 w-3.5 shrink-0" />,
    rocky: <Mountain className="h-3.5 w-3.5 shrink-0" />,
    unknown: <Info className="h-3.5 w-3.5 shrink-0" />,
  };
  const amenityChipLookup = new Map(
    getAmenityChips(beach, language)
    .filter(chip => chip.key !== 'unknownFacilities')
      .map(chip => [chip.key, chip] as const)
  );
  const amenityFeatureChip = (key: AmenityChip['key']): CompactFeatureChip | null => {
    const chip = amenityChipLookup.get(key);
    if (!chip) return null;

    return {
      key: `amenity-${chip.key}`,
      label: compactAmenityLabel(chip, language),
      icon: amenityChipIcon(chip),
    };
  };
  const stableFeatureSlots: Array<CompactFeatureChip | null> = [
    beachType !== 'unknown' ? { key: 'surface', label: t.filterOptions[beachType], icon: beachTypeFeatureIcons[beachType] } : null,
    hasShallowWater ? { key: 'shallow', label: cautionWaterConditions ? labels.shallowWatersCaution : labels.shallowWaters, icon: <Droplets className="h-3.5 w-3.5 shrink-0" /> } : null,
    amenityFeatureChip('sunbeds'),
    amenityFeatureChip('foodNearby') ?? amenityFeatureChip('cafeNearby'),
    amenityFeatureChip('parking'),
    amenityFeatureChip('beachBar'),
  ];
  const accessFeatureChip: CompactFeatureChip = {
    key: 'access',
    label: accessLabel,
    icon: <Footprints className="h-3.5 w-3.5 shrink-0" />,
  };
  const featureChips = [accessFeatureChip, ...(stableFeatureSlots.filter(Boolean) as CompactFeatureChip[])].slice(0, 6);
  const featureChipBase = `inline-flex ${isCompact ? 'min-h-8 lg:min-h-7' : 'min-h-8'} w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-sky-100/70 bg-white/68 px-2 py-1 text-xs font-semibold leading-tight text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300`;
  const showMobileProtectionChip = forceHideWindChip
    ? false
    : simpleWindChipOnly
      ? !isProtectedToday && windChipIsMeaningful
      : !isProtectedToday && Boolean(windSuitabilityText || isExposedConditionChip);
  const hasMobileDecisionBody = Boolean(topPickTimeLabel);
  const mobileWindLabel = `${windBeaufort} Bft`;
  const mobileWaveLabel = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    ? `${waveHeightM.toFixed(1)} m`
    : undefined;
  const mobileTemperatureLabel = typeof temperature === 'number' && Number.isFinite(temperature)
    ? `${Math.round(temperature)}°`
    : undefined;
  if (variant === 'decision' || variant === 'default') {
    return (
      <motion.div
        onClick={onClick}
        data-nosnippet="true"
        whileHover={{ y: -3 }}
        transition={{ duration: 0.25 }}
        className="group relative beach-card flex h-full w-full cursor-pointer flex-col overflow-hidden active:scale-[0.995]"
      >
        <div className="border-b border-sky-100/70 bg-white/90 px-3.5 py-3 sm:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-start gap-2.5">
            <div className="flex h-11 w-11 items-start justify-start" aria-hidden={recommendationRank === undefined}>
              {recommendationRank !== undefined && (
                <span className={recommendationRank === 1
                  ? 'grid h-8 min-w-8 place-items-center rounded-full bg-[#007a83] text-xs font-extrabold text-white ring-1 ring-[#007a83]/30'
                  : 'grid h-8 min-w-8 place-items-center rounded-full bg-sky-50 text-xs font-extrabold text-cyan-800 ring-1 ring-sky-100'}>
                  {recommendationLabel ?? recommendationRank}
                </span>
              )}
            </div>

            <div className="min-w-0 pt-0.5 text-center">
              <h3 className="line-clamp-2 text-center font-heading text-lg font-extrabold leading-[1.08] text-slate-950 dark:text-white">
                {beachDisplayName}
              </h3>
              {(showIslandName || distance !== undefined || showHeaderProtectedMarker) && (
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {(showIslandName || distance !== undefined) && <MapPin className="h-3.5 w-3.5 shrink-0" />}
                  {showIslandName && <span className="min-w-0 truncate">{islandName}</span>}
                  {distance !== undefined && <span className="shrink-0 text-primary">{distance.toFixed(1)} km</span>}
                  {showHeaderProtectedMarker && <ProtectedBeachMarker language={language} selectedDate={selectedDate} />}
                </div>
              )}
              {hasBlueFlag2026 && (
                <div className="mt-1 flex min-w-0 items-center justify-center gap-1.5 text-[11px] font-bold leading-tight text-cyan-800/90">
                  <Flag className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate">
                    {localizedCardCopy.blueFlag}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={handleFavoriteClick}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-white/92 hover:text-rose-500 cursor-pointer dark:bg-slate-800 dark:ring-slate-700"
              aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
            >
              <Heart className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {showMobileProtectionChip ? (
              <span className={`inline-flex min-h-9 w-full min-w-0 items-center justify-start gap-1.5 overflow-hidden rounded-xl border px-2.5 py-1.5 text-xs font-semibold leading-tight ${protectionChipTone}`}>
                {windSuitabilityIcon === 'wind' || (!windSuitabilityColor && isLightWindConditionChip) ? (
                  <Wind className="h-3.5 w-3.5 shrink-0" />
                ) : windSuitabilityIcon === 'caution' || (!windSuitabilityColor && isExposedConditionChip) ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 line-clamp-2 leading-tight">{protectionLabel}</span>
              </span>
            ) : null}

            {featureChips.length > 0 ? (
              <div className="grid h-[7.5rem] min-w-0 grid-cols-2 auto-rows-[2.25rem] content-start gap-1.5">
                {featureChips.map(chip => (
                  <span
                    key={chip.key}
                    className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-cyan-100 bg-cyan-50/70 px-2.5 py-1.5 text-xs font-semibold leading-tight text-cyan-800"
                  >
                    {chip.icon}
                    <span className="min-w-0 line-clamp-2 text-center leading-tight">{chip.label}</span>
                  </span>
                ))}
              </div>
            ) : !showMobileProtectionChip ? (
              <span className="inline-flex min-h-9 w-full min-w-0 items-center justify-start gap-1.5 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/70 px-2.5 py-1.5 text-xs font-semibold leading-tight text-slate-600">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 line-clamp-2 leading-tight">{localizedCardCopy.localExposureCheck}</span>
              </span>
            ) : null}

            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[11px] font-bold leading-none text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
                <Wind className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{mobileWindLabel}</span>
              </span>
              {mobileWaveLabel && (
                <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
                  <Waves className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{mobileWaveLabel}</span>
                </span>
              )}
              {mobileTemperatureLabel && (
                <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
                  <Droplets className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{mobileTemperatureLabel}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`relative aspect-[16/9] ${cardPhoto ? 'min-h-32 max-h-40 sm:min-h-36 sm:max-h-44' : 'min-h-28 max-h-32 sm:min-h-36 sm:max-h-44'} ${isCompact ? 'lg:min-h-28 lg:max-h-32' : ''} overflow-hidden bg-sky-50`}>
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
            <BeachLocationPlaceholder language={language} avoidTopLeft={recommendationRank !== undefined || hasBlueFlag2026 || hasAccessibleRamp} />
          )}
          {cardPhoto && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/0" />}

          <div className="absolute left-3 top-3 z-20 hidden max-w-[calc(100%-4.75rem)] flex-wrap items-center gap-2 sm:flex">
            {recommendationRank !== undefined && (
              <span className={recommendationRank === 1
                ? 'inline-flex min-h-8 items-center rounded-full bg-[#007a83] px-2.5 py-1 text-xs font-extrabold text-white shadow-sm ring-1 ring-white/30 backdrop-blur-md'
                : 'inline-flex min-h-8 items-center rounded-full bg-white/82 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur-md'}>
                {recommendationLabel ?? recommendationRank}
              </span>
            )}
            {hasBlueFlag2026 && <BlueFlagBadge language={language} />}
            {hasAccessibleRamp && <AccessibilityBadge language={language} />}
          </div>

          <button
            onClick={handleFavoriteClick}
            className="absolute right-3 top-3 hidden h-11 w-11 place-items-center rounded-xl bg-white/78 text-slate-500 shadow-sm backdrop-blur-md transition-colors hover:bg-white/92 hover:text-rose-500 cursor-pointer sm:grid"
            aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
          >
            <Heart className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        </div>

        <div className={`${hasMobileDecisionBody ? 'flex' : 'hidden sm:flex'} flex-1 flex-col ${isCompact ? 'gap-3 p-3 sm:p-[1.05rem] lg:gap-2 lg:p-3' : 'gap-3 p-3 sm:p-[1.05rem]'}`}>
          <div className={`${isCompact ? 'space-y-1 lg:space-y-0.5' : 'space-y-1'} hidden sm:block`}>
            <h3 className="line-clamp-1 font-heading text-lg font-extrabold leading-[1.12] text-slate-950 transition-colors group-hover:text-primary dark:text-white">
              {beachDisplayName}
            </h3>
            {(showIslandName || distance !== undefined || showHeaderProtectedMarker) && (
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {(showIslandName || distance !== undefined) && <MapPin className="h-3.5 w-3.5 shrink-0" />}
                {showIslandName && <span className="min-w-0 flex-1 truncate">{islandName}</span>}
                {distance !== undefined && <span className="shrink-0 text-primary">{distance.toFixed(1)} km</span>}
                {showHeaderProtectedMarker && <ProtectedBeachMarker language={language} selectedDate={selectedDate} />}
              </div>
            )}
          </div>

          {showTodayScoreBadge && (
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
          </div>
          )}

          {topPickTimeLabel && (
            <div
              className="flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-xl border border-cyan-200/80 bg-cyan-50/85 px-3 py-2 text-left shadow-sm shadow-sky-900/5 dark:border-cyan-900/45 dark:bg-cyan-950/25"
              aria-label={`${visitTimeLabel}: ${topPickTimeLabel}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/85 text-cyan-700 shadow-sm ring-1 ring-cyan-100/70 dark:bg-slate-900 dark:text-cyan-300 dark:ring-cyan-900/45">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.68rem] font-bold leading-tight text-cyan-700/80 dark:text-cyan-300/80">
                  {visitTimeLabel}
                </span>
                <span className="block truncate text-sm font-extrabold leading-tight text-slate-950 dark:text-white">
                  {topPickTimeLabel}
                </span>
              </span>
            </div>
          )}

          {featureChips.length > 0 && (
            <div className={`hidden ${isCompact ? 'h-[6.625rem] lg:h-[5.875rem]' : 'h-[6.625rem]'} grid-cols-2 auto-rows-min content-start gap-1.5 sm:grid`}>
              {featureChips.map(chip => (
                <span key={chip.key} className={featureChipBase}>
                  {chip.icon}
                  <span className="min-w-0 text-center leading-tight">{chip.label}</span>
                </span>
              ))}
            </div>
          )}

        </div>

        <div className={`mt-auto flex items-center gap-2 border-t border-sky-50 bg-white/74 pt-3 ${isCompact ? 'px-3.5 pb-3.5 lg:px-3 lg:pb-3' : 'px-3.5 pb-3.5 sm:px-4 sm:pb-4'} dark:border-slate-800 dark:bg-slate-900/60`}>
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            data-nosnippet="true"
            className={`inline-flex ${isCompact ? 'min-h-11 lg:min-h-10' : 'min-h-11'} flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-heading font-bold text-white shadow-sm shadow-cyan-600/20 transition-colors hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer`}
          >
            <Info className="h-4 w-4" />
            <span>{t.learnMore}</span>
          </button>
          {canNavigate && (
            <button
              onClick={handleNavigationClick}
              className={`grid ${isCompact ? 'h-11 w-11 lg:h-10 lg:w-10' : 'h-11 w-11'} place-items-center rounded-xl bg-sky-50 text-primary transition-colors hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-sky-900/20 dark:hover:bg-sky-900/40 cursor-pointer`}
              title={navButtonTitle}
              aria-label={t.navigateToLabel(beachDisplayName)}
            >
              <Navigation className="h-4 w-4" />
            </button>
          )}
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
      data-nosnippet="true"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative beach-card flex h-fit w-full cursor-pointer flex-col overflow-hidden"
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
          <BeachLocationPlaceholder language={language} avoidTopLeft={recommendationRank !== undefined || hasBlueFlag2026 || hasAccessibleRamp} />
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
          {!hideExposureBadge && (
            <div className={`px-3 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm ${
              isProtectedToday ? 'bg-emerald-500/90 text-white' :
              isExposed ? 'bg-amber-500/90 text-white' : 'bg-sky-500/90 text-white'
            }`}>
              {isProtectedToday
                ? t.shelteredTooltip
                : (isExposed ? t.exposedTooltip : localizedCardCopy.localExposureCheck)}
            </div>
          )}
          {hasBlueFlag2026 && <BlueFlagBadge language={language} compact />}
          {hasAccessibleRamp && <AccessibilityBadge language={language} compact />}
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
        <p
          className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-4"
          data-nosnippet="true"
        >
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
          data-nosnippet="true"
          className="flex-grow inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark active:scale-[0.98] text-white font-heading font-semibold rounded-xl transition-all duration-300 cursor-pointer min-h-[44px]"
        >
          <Info className="w-4 h-4" />
          <span className="text-xs">{t.learnMore}</span>
        </button>

        {canNavigate && (
          <button
            onClick={handleNavigationClick}
            className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-primary hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
            title={navButtonTitle}
            aria-label={t.navigateToLabel(beachDisplayName)}
          >
            <Navigation className="w-4 h-4" />
          </button>
        )}

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
