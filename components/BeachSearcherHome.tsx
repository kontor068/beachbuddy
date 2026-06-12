import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CloudSun,
  Clock3,
  Droplets,
  Flag,
  Footprints,
  Info,
  MapPin,
  MoreHorizontal,
  Mountain,
  Navigation,
  ParkingCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Thermometer,
  Trees,
  Utensils,
  Users,
  VolumeX,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import type { Beach, DailyForecast, FilterKey, Island, LanguageCode, SortOption, SuitableBeach, Translation, UserPreferences, WindDirection } from '../types';
import { getLocalizedCopy, languageToDateLocale, languageToLocale, type SupportedLanguage } from '../utils/i18n';
import { displayBeachName, localizedAccessLabel } from '../utils/localization';
import { getAmenityChips, type AmenityChip } from '../utils/amenities';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import { trackEvent } from '../services/analyticsService';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import {
  getPreferenceFilterLabel,
  QUICK_PREFERENCE_FILTERS,
  type QuickPreferenceFilter,
} from '../utils/preferenceFilterLabels';
import { getBeachFilterDirectoryTitle } from '../utils/filterSummary';
import { canOpenNavigation, openNavigation } from '../utils/navigation';
import { getSelectedDayOffset, getSelectedDayPrefix, getSelectedDaySentencePrefix } from '../utils/dateLabels';
import { getConsistentVisibleMapExposureLevels } from '../utils/mapExposure';
import { isAdventureBeach } from '../utils/access';
import { WeatherSummary } from './WeatherSummary';
import { BeachCard } from './BeachCard';
import { SandDotsIcon, SandPebblesIcon, SunbedIcon } from './BeachFeatureIcons';
import { getIslandDestinationPhoto } from '../data/destinationPhotoAdapter';
import { CuratedPhotoImage } from './photos';
import { beachMatchesUserPreferences } from '../services/recommendationService';
import { describeSimpleWindSuitability } from '../utils/windExposureCopy';

export type DirectoryCategory = 'all' | QuickPreferenceFilter;

export type DirectorySearchSuggestion = {
  id: string;
  type: 'region' | 'beach';
  label: string;
  subtitle: string;
  island: Island;
  beach?: Beach;
};

type BeachCardContext = Beach & {
  distance?: number;
  score?: SuitableBeach['score'];
  isExposed?: SuitableBeach['isExposed'];
  bestBeachTime?: SuitableBeach['bestBeachTime'];
  bestTimeWindow?: SuitableBeach['bestTimeWindow'];
  exposureLevel?: SuitableBeach['exposureLevel'];
  waveHeightM?: SuitableBeach['waveHeightM'];
  warnings?: SuitableBeach['warnings'];
  confidence?: SuitableBeach['confidence'];
  swimmingComfort?: SuitableBeach['swimmingComfort'];
  canClaimWindProtection?: SuitableBeach['canClaimWindProtection'];
  seaCalmClaimAllowed?: SuitableBeach['seaCalmClaimAllowed'];
  lessExposedToday?: boolean;
  simpleWindSuitability?: SuitableBeach['simpleWindSuitability'];
  windExposureReason?: SuitableBeach['windExposureReason'];
};

interface BeachSearcherHomeProps {
  language: SupportedLanguage;
  selectedIsland: Island | null;
  allIslands: Island[];
  searchQuery: string;
  activeCategory: DirectoryCategory;
  sortBy: SortOption;
  isMobileViewport?: boolean;
  isAllBeachesPanelOpen?: boolean;
  onAllBeachesPanelOpenChange?: (open: boolean) => void;
  isWeatherPanelOpen?: boolean;
  onWeatherPanelOpenChange?: (open: boolean) => void;
  suitableDistanceSortActive?: boolean;
  preferences: UserPreferences;
  activeFilters?: FilterKey[];
  filterResultCounts?: Partial<Record<keyof UserPreferences, number>>;
  advancedFilterResultCounts?: Partial<Record<FilterKey, number>>;
  sortResultCounts?: Partial<Record<SortOption, number>>;
  filteredResultCount?: number;
  searchSuggestions?: DirectorySearchSuggestion[];
  isSearchSuggesting?: boolean;
  protectedSortLabel?: string;
  islandBackground?: string;
  mapPreview?: React.ReactNode;
  topRecommendationCards?: SuitableBeach[];
  suitableBeachCards?: SuitableBeach[];
  suitableBeachTotalCount?: number;
  onActiveSuitableBeachChange?: (beachId: number | undefined, options?: { resumeFollow?: boolean }) => void;
  showSuitableBeachSection?: boolean;
  allBeachCards?: BeachCardContext[];
  beachWeatherContexts?: SuitableBeach[];
  topBeachToday?: SuitableBeach | null;
  topBeachDescription?: string;
  topBeachTimingLabel?: string;
  forecastDays?: DailyForecast[];
  selectedDayIndex?: number;
  selectedForecast?: DailyForecast;
  selectedDate?: Date;
  lastUpdated?: Date | null;
  favorites: number[];
  t: Translation;
  onToggleFavorite: (id: number) => void;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onSearchSuggestionSelect?: (suggestion: DirectorySearchSuggestion) => void;
  onOpenFilters: () => void;
  onOpenIslandSelector: () => void;
  onUseCurrentLocation?: () => void;
  /** Fetches the user's location for distance sorting without changing region. */
  onRequestUserLocation?: () => void;
  hasUserLocation?: boolean;
  isFindingCurrentLocation?: boolean;
  currentLocationError?: string | null;
  onCategorySelect: (category: DirectoryCategory) => void;
  onSortChange: (sort: SortOption) => void;
  onAdvancedFilterToggle?: (filter: FilterKey) => void;
  onForecastDaySelect?: (index: number) => void;
  onBeachClick: (beach: Beach) => void;
  onSelectIsland: (island: Island) => void;
  strongWindContext?: boolean;
}

const DRAG_SCROLL_THRESHOLD_PX = 6;

const installMouseDragScroll = (element: HTMLElement): (() => void) => {
  let pointerId: number | null = null;
  let startX = 0;
  let startScrollLeft = 0;
  let lastX = 0;
  let lastMoveTime = 0;
  let scrollVelocity = 0;
  let momentumFrame = 0;
  let hasDragged = false;
  let suppressNextClick = false;
  let suppressClickTimeout = 0;

  const stopMomentum = () => {
    if (!momentumFrame) return;
    window.cancelAnimationFrame(momentumFrame);
    momentumFrame = 0;
  };

  const startMomentum = () => {
    stopMomentum();
    if (Math.abs(scrollVelocity) < 0.08) return;

    let previousTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - previousTime;
      previousTime = currentTime;

      element.scrollLeft += scrollVelocity * elapsed;
      scrollVelocity *= Math.pow(0.92, elapsed / 16);

      if (Math.abs(scrollVelocity) < 0.02) {
        momentumFrame = 0;
        return;
      }

      momentumFrame = window.requestAnimationFrame(step);
    };

    momentumFrame = window.requestAnimationFrame(step);
  };

  const clearSuppressedClick = () => {
    if (suppressClickTimeout) {
      window.clearTimeout(suppressClickTimeout);
      suppressClickTimeout = 0;
    }

    suppressClickTimeout = window.setTimeout(() => {
      suppressNextClick = false;
      suppressClickTimeout = 0;
    }, 160);
  };

  const finishDrag = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;

    pointerId = null;
    element.dataset.dragging = 'false';

    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (hasDragged) {
      suppressNextClick = true;
      clearSuppressedClick();
      startMomentum();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.defaultPrevented) return;

    stopMomentum();
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = element.scrollLeft;
    lastX = event.clientX;
    lastMoveTime = performance.now();
    scrollVelocity = 0;
    hasDragged = false;
    element.dataset.dragging = 'true';

    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; normal pointer events still work.
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;

    const deltaX = event.clientX - startX;
    if (!hasDragged && Math.abs(deltaX) < DRAG_SCROLL_THRESHOLD_PX) return;

    hasDragged = true;
    suppressNextClick = true;
    const now = performance.now();
    const elapsed = now - lastMoveTime;
    if (elapsed > 0) {
      scrollVelocity = -(event.clientX - lastX) / elapsed;
    }
    lastX = event.clientX;
    lastMoveTime = now;
    event.preventDefault();
    element.scrollLeft = startScrollLeft - deltaX;
  };

  const handleClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    suppressNextClick = false;
  };

  element.addEventListener('pointerdown', handlePointerDown);
  element.addEventListener('pointermove', handlePointerMove);
  element.addEventListener('pointerup', finishDrag);
  element.addEventListener('pointercancel', finishDrag);
  element.addEventListener('click', handleClickCapture, true);

  return () => {
    stopMomentum();
    if (suppressClickTimeout) window.clearTimeout(suppressClickTimeout);
    element.removeEventListener('pointerdown', handlePointerDown);
    element.removeEventListener('pointermove', handlePointerMove);
    element.removeEventListener('pointerup', finishDrag);
    element.removeEventListener('pointercancel', finishDrag);
    element.removeEventListener('click', handleClickCapture, true);
  };
};

const filterIcons: Partial<Record<QuickPreferenceFilter, React.ReactNode>> = {
  blueFlag2026: <Flag className="h-5 w-5" />,
  sandy: <SandDotsIcon className="h-5 w-5" />,
  pebbles: <Mountain className="h-5 w-5" />,
  quiet: <VolumeX className="h-5 w-5" />,
  beachBar: <BadgeCheck className="h-5 w-5" />,
  easyAccess: <Footprints className="h-5 w-5" />,
  snorkeling: <Search className="h-5 w-5" />,
  familyFriendly: <Users className="h-5 w-5" />,
  deepWater: <Waves className="h-5 w-5" />,
  shallowWater: <Droplets className="h-5 w-5" />,
};

const desktopAdvancedFilters: Array<{ key: FilterKey; icon: React.ReactNode }> = [
  { key: 'naturalShade', icon: <Trees className="h-5 w-5" /> },
  { key: 'taverna', icon: <Utensils className="h-5 w-5" /> },
  { key: 'sunbeds', icon: <SunbedIcon className="h-5 w-5" /> },
  { key: 'parking', icon: <ParkingCircle className="h-5 w-5" /> },
  { key: 'sandy-pebbles', icon: <SandPebblesIcon className="h-5 w-5" /> },
  { key: 'rocky', icon: <Mountain className="h-5 w-5" /> },
  { key: 'adventure', icon: <MapPin className="h-5 w-5" /> },
];
const desktopPrimaryPreferenceFilters = [
  'sandy',
  'pebbles',
  'quiet',
  'easyAccess',
  'snorkeling',
  'familyFriendly',
  'beachBar',
] as const satisfies readonly QuickPreferenceFilter[];
const desktopPrimaryPreferenceFilterSet = new Set<QuickPreferenceFilter>(desktopPrimaryPreferenceFilters);
const desktopSecondaryPreferenceFilters = QUICK_PREFERENCE_FILTERS.filter(filter => !desktopPrimaryPreferenceFilterSet.has(filter));

type DesktopFilterItem =
  | {
      itemKey: string;
      kind: 'preference';
      key: QuickPreferenceFilter;
      icon: React.ReactNode;
      label: string;
      count?: number;
      isActive: boolean;
    }
  | {
      itemKey: string;
      kind: 'advanced';
      key: FilterKey;
      icon: React.ReactNode;
      label: string;
      count?: number;
      isActive: boolean;
    };

const defaultFilterAvailabilityPreferences: UserPreferences = {
  blueFlag2026: false,
  sandy: false,
  pebbles: false,
  quiet: false,
  beachBar: false,
  familyFriendly: false,
  snorkeling: false,
  deepWater: false,
  shallowWater: false,
  surfing: false,
  parking: false,
  easyAccess: false,
};

const beachMatchesPreferenceFilter = (beach: Beach, filter: QuickPreferenceFilter): boolean => (
  beachMatchesUserPreferences(beach, {
    ...defaultFilterAvailabilityPreferences,
    [filter]: true,
  })
);

const beachMatchesAdvancedFilter = (beach: Beach, filter: FilterKey): boolean => {
  if (filter === 'showAll') return true;
  if (filter === 'easyAccess') {
    return beachMatchesPreferenceFilter(beach, 'easyAccess');
  }
  if (filter === 'sandy' || filter === 'pebbles') {
    return beachMatchesPreferenceFilter(beach, filter);
  }
  if (filter === 'snorkeling') {
    return beachMatchesPreferenceFilter(beach, 'snorkeling');
  }
  if (filter === 'adventure') {
    return isAdventureBeach(beach);
  }
  if (filter === 'familyFriendly') {
    return beachMatchesPreferenceFilter(beach, 'familyFriendly');
  }
  if (filter === 'quiet') {
    return beachMatchesPreferenceFilter(beach, 'quiet');
  }
  if (filter === 'surfing') {
    return Boolean(beach.activities?.surfing);
  }
  if (filter === 'sandy-pebbles' || filter === 'rocky') {
    return beach.beachType === filter;
  }
  if (beach.amenities && filter in beach.amenities) {
    return Boolean(beach.amenities[filter as keyof Beach['amenities']]);
  }
  if (beach.characteristics && filter in beach.characteristics) {
    return Boolean(beach.characteristics[filter as keyof Beach['characteristics']]);
  }

  return false;
};

type HomeCopy = {
  greece: string;
  searchPlaceholder: string;
  currentLocation: string;
  findingLocation: string;
  fallbackFeatureCopy: string;
  more: string;
  changeIsland: string;
  search: string;
  searchRegionLabel: string;
  searchBeachLabel: string;
  searchLoading: string;
  searchNoResults: string;
  filter: string;
  sort: string;
  topChoiceAria: string;
  topChoiceBadge: string;
  beachMapAria: string;
  bestBeachesToday: string;
  popularDestinations: string;
  photoSoon: string;
  islandTitle: (title: string) => string;
  beachCount: (count: number) => string;
  conditionsOverviewAria: string;
  conditionsOverviewTitle: string;
  noForecast: string;
  allOtherBeaches: string;
  beachSearchAria: string;
  beachFiltersAria: string;
  updatedJustNow: string;
  updatedMinutes: (minutes: number) => string;
  updatedHours: (hours: number) => string;
  beachFeatures: {
    sandy: string;
    pebbles: string;
    sandPebbles: string;
    amenities: string;
    naturalShade: string;
    quiet: string;
    snorkeling: string;
  };
  islandFeatures: {
    sandy: string;
    amenities: string;
    naturalShade: string;
    quiet: string;
    snorkeling: string;
  };
  sea: {
    label: string;
    mild: string;
    missingDetail: string;
    calm: string;
    moderate: string;
    choppy: string;
    rough: string;
  };
  topSignals: {
    protected: string;
    calmWaters: string;
    easyAccess: string;
  };
  conditions: {
    wind: string;
    beaufortUnit: string;
    air: string;
    high: string;
    gusts: string;
    noStrongSignal: string;
    maxGust: string;
  };
};

const homeCopy: Record<LanguageCode, HomeCopy> = {
  en: {
    greece: 'Greece',
    searchPlaceholder: 'Location or beach',
    currentLocation: 'Near me',
    findingLocation: 'Finding location',
    fallbackFeatureCopy: 'Beaches, map and quick filters',
    more: 'More',
    changeIsland: 'Change island or area',
    search: 'Search',
    searchRegionLabel: 'Area',
    searchBeachLabel: 'Beach',
    searchLoading: 'Searching beaches…',
    searchNoResults: 'No close match yet. Press Enter to search.',
    filter: 'Filter',
    sort: 'Sort',
    topChoiceAria: 'Best beach today',
    topChoiceBadge: 'Best beach today',
    beachMapAria: 'Beach map',
    bestBeachesToday: 'Best beaches today',
    popularDestinations: 'Popular destinations',
    photoSoon: 'Photo coming soon',
    islandTitle: (title) => title,
    beachCount: (count) => `${count} ${count === 1 ? 'beach' : 'beaches'}`,
    conditionsOverviewAria: 'Conditions overview',
    conditionsOverviewTitle: "Today's conditions overview",
    noForecast: 'No forecast is available for this area.',
    allOtherBeaches: 'All beaches',
    beachSearchAria: 'Beach search',
    beachFiltersAria: 'Beach filters',
    updatedJustNow: 'Updated just now',
    updatedMinutes: (minutes) => `Updated ${minutes} min ago`,
    updatedHours: (hours) => `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`,
    beachFeatures: {
      sandy: 'Sandy beach',
      pebbles: 'Pebbles',
      sandPebbles: 'Sand and pebbles',
      amenities: 'Amenities',
      naturalShade: 'Natural shade',
      quiet: 'Quieter',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Sandy options',
      amenities: 'Amenities',
      naturalShade: 'Natural shade',
      quiet: 'Quiet coves',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Sea',
      mild: 'Mild',
      missingDetail: 'wave data unavailable',
      calm: 'Calm',
      moderate: 'Moderate',
      choppy: 'Choppy',
      rough: 'Rough',
    },
    topSignals: {
      protected: 'More protected',
      calmWaters: 'Calm waters',
      easyAccess: 'Easy access',
    },
    conditions: {
      wind: 'Wind',
      beaufortUnit: 'Bft',
      air: 'Air',
      high: 'high',
      gusts: 'Gusts',
      noStrongSignal: 'No strong signal',
      maxGust: 'max gust',
    },
  },
  gr: {
    greece: 'Ελλάδα',
    searchPlaceholder: 'Περιοχή ή παραλία',
    currentLocation: 'Κοντά μου',
    findingLocation: 'Εύρεση τοποθεσίας',
    fallbackFeatureCopy: 'Παραλίες, χάρτης και γρήγορα φίλτρα',
    more: 'Περισσότερα',
    changeIsland: 'Άλλο νησί ή περιοχή',
    search: 'Αναζήτηση',
    searchRegionLabel: 'Περιοχή',
    searchBeachLabel: 'Παραλία',
    searchLoading: 'Ψάχνω παραλίες…',
    searchNoResults: 'Δεν βρέθηκε κοντινό αποτέλεσμα. Πάτα Enter για αναζήτηση.',
    filter: 'Φίλτρο',
    sort: 'Ταξινόμηση',
    topChoiceAria: 'Top επιλογή σήμερα',
    topChoiceBadge: 'Top Παραλία Σήμερα',
    beachMapAria: 'Χάρτης παραλιών',
    bestBeachesToday: 'Καταλληλότερες παραλίες σήμερα',
    popularDestinations: 'Δημοφιλείς προορισμοί',
    photoSoon: 'Φωτογραφία σύντομα',
    islandTitle: (title) => `Νησί ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'παραλία' : 'παραλίες'}`,
    conditionsOverviewAria: 'Σύνοψη συνθηκών',
    conditionsOverviewTitle: 'Σύνοψη σημερινών συνθηκών',
    noForecast: 'Δεν υπάρχει διαθέσιμη πρόγνωση για αυτή την περιοχή.',
    allOtherBeaches: 'Όλες οι παραλίες',
    beachSearchAria: 'Αναζήτηση παραλιών',
    beachFiltersAria: 'Φίλτρα παραλιών',
    updatedJustNow: 'Ενημερώθηκε μόλις τώρα',
    updatedMinutes: (minutes) => `Ενημερώθηκε πριν ${minutes} λεπτά`,
    updatedHours: (hours) => `Ενημερώθηκε πριν ${hours} ${hours === 1 ? 'ώρα' : 'ώρες'}`,
    beachFeatures: {
      sandy: 'Αμμώδης ακτή',
      pebbles: 'Βότσαλα',
      sandPebbles: 'Άμμος και βότσαλα',
      amenities: 'Με ανέσεις',
      naturalShade: 'Φυσική σκιά',
      quiet: 'Πιο ήσυχη',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Αμμώδεις επιλογές',
      amenities: 'Με ανέσεις',
      naturalShade: 'Φυσική σκιά',
      quiet: 'Ήσυχες ακτές',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Θάλασσα',
      mild: 'Ήπια',
      missingDetail: 'χωρίς διαθέσιμο κύμα',
      calm: 'Ήρεμη',
      moderate: 'Μέτρια',
      choppy: 'Κυματισμός',
      rough: 'Έντονη',
    },
    topSignals: {
      protected: 'Πιο προστατευμένη',
      calmWaters: 'Ήρεμα νερά',
      easyAccess: 'Εύκολη πρόσβαση',
    },
    conditions: {
      wind: 'Άνεμος',
      beaufortUnit: 'μποφόρ',
      air: 'Αέρας',
      high: 'μέγιστη',
      gusts: 'Ριπές',
      noStrongSignal: 'Χωρίς έντονη ένδειξη',
      maxGust: 'μέγιστη ριπή',
    },
  },
  fr: {
    greece: 'Grèce',
    searchPlaceholder: 'Lieu ou plage',
    currentLocation: 'Autour de moi',
    findingLocation: 'Recherche de position',
    fallbackFeatureCopy: 'Plages, carte et filtres rapides',
    more: 'Plus',
    changeIsland: "Changer d'île ou de région",
    search: 'Rechercher',
    searchRegionLabel: 'Région',
    searchBeachLabel: 'Plage',
    searchLoading: 'Recherche de plages…',
    searchNoResults: 'Aucune correspondance proche. Appuyez sur Entrée pour chercher.',
    filter: 'Filtre',
    sort: 'Trier',
    topChoiceAria: 'Meilleure plage aujourd’hui',
    topChoiceBadge: 'Meilleure plage aujourd’hui',
    beachMapAria: 'Carte des plages',
    bestBeachesToday: 'Meilleures plages aujourd’hui',
    popularDestinations: 'Destinations populaires',
    photoSoon: 'Photo bientôt',
    islandTitle: (title) => `Île ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'plage' : 'plages'}`,
    conditionsOverviewAria: 'Aperçu des conditions',
    conditionsOverviewTitle: "Conditions d'aujourd'hui",
    noForecast: 'Aucune prévision disponible pour cette zone.',
    allOtherBeaches: 'Toutes les plages',
    beachSearchAria: 'Recherche de plages',
    beachFiltersAria: 'Filtres de plages',
    updatedJustNow: 'Mis à jour à l’instant',
    updatedMinutes: (minutes) => `Mis à jour il y a ${minutes} min`,
    updatedHours: (hours) => `Mis à jour il y a ${hours} h`,
    beachFeatures: {
      sandy: 'Plage de sable',
      pebbles: 'Galets',
      sandPebbles: 'Sable et galets',
      amenities: 'Services',
      naturalShade: 'Ombre naturelle',
      quiet: 'Plus calme',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Options sableuses',
      amenities: 'Services',
      naturalShade: 'Ombre naturelle',
      quiet: 'Criques calmes',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Mer',
      mild: 'Douce',
      missingDetail: 'données de vagues indisponibles',
      calm: 'Calme',
      moderate: 'Modérée',
      choppy: 'Clapot',
      rough: 'Agitée',
    },
    topSignals: {
      protected: 'Plus protégée',
      calmWaters: 'Eaux calmes',
      easyAccess: 'Accès facile',
    },
    conditions: {
      wind: 'Vent',
      beaufortUnit: 'Bft',
      air: 'Air',
      high: 'max',
      gusts: 'Rafales',
      noStrongSignal: 'Pas de signal fort',
      maxGust: 'rafale max',
    },
  },
  de: {
    greece: 'Griechenland',
    searchPlaceholder: 'Ort oder Strand',
    currentLocation: 'In der Nähe',
    findingLocation: 'Standort wird gesucht',
    fallbackFeatureCopy: 'Strände, Karte und Schnellfilter',
    more: 'Mehr',
    changeIsland: 'Insel oder Region wechseln',
    search: 'Suchen',
    searchRegionLabel: 'Region',
    searchBeachLabel: 'Strand',
    searchLoading: 'Strände werden gesucht…',
    searchNoResults: 'Noch kein guter Treffer. Drücke Enter zum Suchen.',
    filter: 'Filter',
    sort: 'Sortieren',
    topChoiceAria: 'Bester Strand heute',
    topChoiceBadge: 'Bester Strand heute',
    beachMapAria: 'Strandkarte',
    bestBeachesToday: 'Beste Strände heute',
    popularDestinations: 'Beliebte Ziele',
    photoSoon: 'Foto folgt',
    islandTitle: (title) => `Insel ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'Strand' : 'Strände'}`,
    conditionsOverviewAria: 'Bedingungsübersicht',
    conditionsOverviewTitle: 'Heutige Bedingungen',
    noForecast: 'Für diese Region ist keine Vorhersage verfügbar.',
    allOtherBeaches: 'Alle Strände',
    beachSearchAria: 'Strandsuche',
    beachFiltersAria: 'Strandfilter',
    updatedJustNow: 'Gerade aktualisiert',
    updatedMinutes: (minutes) => `Vor ${minutes} Min. aktualisiert`,
    updatedHours: (hours) => `Vor ${hours} Std. aktualisiert`,
    beachFeatures: {
      sandy: 'Sandstrand',
      pebbles: 'Kiesel',
      sandPebbles: 'Sand und Kiesel',
      amenities: 'Ausstattung',
      naturalShade: 'Naturschatten',
      quiet: 'Ruhiger',
      snorkeling: 'Schnorcheln',
    },
    islandFeatures: {
      sandy: 'Sandoptionen',
      amenities: 'Ausstattung',
      naturalShade: 'Naturschatten',
      quiet: 'Ruhige Buchten',
      snorkeling: 'Schnorcheln',
    },
    sea: {
      label: 'Meer',
      mild: 'Mild',
      missingDetail: 'Wellendaten fehlen',
      calm: 'Ruhig',
      moderate: 'Mäßig',
      choppy: 'Wellig',
      rough: 'Rau',
    },
    topSignals: {
      protected: 'Mehr geschützt',
      calmWaters: 'Ruhiges Wasser',
      easyAccess: 'Einfacher Zugang',
    },
    conditions: {
      wind: 'Wind',
      beaufortUnit: 'Bft',
      air: 'Luft',
      high: 'max',
      gusts: 'Böen',
      noStrongSignal: 'Kein starkes Signal',
      maxGust: 'max. Böe',
    },
  },
  it: {
    greece: 'Grecia',
    searchPlaceholder: 'Località o spiaggia',
    currentLocation: 'Vicino a me',
    findingLocation: 'Ricerca posizione',
    fallbackFeatureCopy: 'Spiagge, mappa e filtri rapidi',
    more: 'Altro',
    changeIsland: 'Cambia isola o regione',
    search: 'Cerca',
    searchRegionLabel: 'Area',
    searchBeachLabel: 'Spiaggia',
    searchLoading: 'Ricerca spiagge…',
    searchNoResults: 'Nessuna corrispondenza vicina. Premi Invio per cercare.',
    filter: 'Filtro',
    sort: 'Ordina',
    topChoiceAria: 'Migliore spiaggia oggi',
    topChoiceBadge: 'Migliore spiaggia oggi',
    beachMapAria: 'Mappa spiagge',
    bestBeachesToday: 'Migliori spiagge oggi',
    popularDestinations: 'Destinazioni popolari',
    photoSoon: 'Foto in arrivo',
    islandTitle: (title) => `Isola ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'spiaggia' : 'spiagge'}`,
    conditionsOverviewAria: 'Panoramica condizioni',
    conditionsOverviewTitle: 'Condizioni di oggi',
    noForecast: 'Nessuna previsione disponibile per questa zona.',
    allOtherBeaches: 'Tutte le spiagge',
    beachSearchAria: 'Ricerca spiagge',
    beachFiltersAria: 'Filtri spiagge',
    updatedJustNow: 'Aggiornato ora',
    updatedMinutes: (minutes) => `Aggiornato ${minutes} min fa`,
    updatedHours: (hours) => `Aggiornato ${hours} h fa`,
    beachFeatures: {
      sandy: 'Spiaggia sabbiosa',
      pebbles: 'Ciottoli',
      sandPebbles: 'Sabbia e ciottoli',
      amenities: 'Servizi',
      naturalShade: 'Ombra naturale',
      quiet: 'Più tranquilla',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Opzioni sabbiose',
      amenities: 'Servizi',
      naturalShade: 'Ombra naturale',
      quiet: 'Calette tranquille',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Mare',
      mild: 'Mite',
      missingDetail: 'dati onde non disponibili',
      calm: 'Calmo',
      moderate: 'Moderato',
      choppy: 'Ondoso',
      rough: 'Mosso',
    },
    topSignals: {
      protected: 'Più protetta',
      calmWaters: 'Acque calme',
      easyAccess: 'Accesso facile',
    },
    conditions: {
      wind: 'Vento',
      beaufortUnit: 'Bft',
      air: 'Aria',
      high: 'max',
      gusts: 'Raffiche',
      noStrongSignal: 'Nessun segnale forte',
      maxGust: 'raffica max',
    },
  },
};

const getImageSet = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (!imagePath.endsWith('.jpg')) return `url(${imagePath})`;
  return `image-set(url(${imagePath.replace(/\.jpg$/, '.webp')}) type("image/webp"), url(${imagePath}) type("image/jpeg"))`;
};

const getIslandFeatureLabels = (island: Island, language: LanguageCode): string[] => {
  const copy = getLocalizedCopy(language, homeCopy).islandFeatures;
  const beaches = island.beaches || [];
  if (beaches.length === 0) return [];

  const count = (predicate: (beach: Beach) => boolean) => beaches.filter(predicate).length;
  const labels: string[] = [];
  const threshold = Math.max(2, Math.round(beaches.length * 0.25));

  if (count(beach => beach.beachType === 'sandy' || beach.beachType === 'sandy-pebbles') >= threshold) {
    labels.push(copy.sandy);
  }
  if (count(beach => beach.amenities?.beachBar || beach.amenities?.organized) >= threshold) {
    labels.push(copy.amenities);
  }
  if (count(beach => beach.amenities?.naturalShade) >= threshold) {
    labels.push(copy.naturalShade);
  }
  if (count(beach => beach.environment?.quiet) >= threshold) {
    labels.push(copy.quiet);
  }
  if (count(beach => beach.activities?.snorkeling) >= threshold) {
    labels.push(copy.snorkeling);
  }

  return labels.slice(0, 3);
};

const formatDirectoryDate = (date: Date, language: LanguageCode) => {
  const absoluteDateLabel = new Intl.DateTimeFormat(languageToDateLocale(language), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const dayOffset = getSelectedDayOffset(date);

  if (dayOffset >= 0 && dayOffset <= 2) {
    return `${getSelectedDaySentencePrefix(date, new Date(), language)}, ${absoluteDateLabel}`;
  }

  return absoluteDateLabel;
};

const getConditionsOverviewTitle = (language: LanguageCode, selectedDate?: Date): string => {
  const dayOffset = getSelectedDayOffset(selectedDate);

  if (language === 'gr') {
    if (dayOffset === 0) return 'Σύνοψη σημερινών συνθηκών';
    if (dayOffset === 1) return 'Σύνοψη αυριανών συνθηκών';
    if (dayOffset === 2) return 'Σύνοψη μεθαυριανών συνθηκών';
    return `Σύνοψη συνθηκών ${getSelectedDayPrefix(selectedDate, new Date(), language)}`;
  }

  if (language === 'en') {
    if (dayOffset === 0) return "Today's conditions overview";
    if (dayOffset === 1) return "Tomorrow's conditions overview";
    if (dayOffset === 2) return 'Day-after-tomorrow conditions overview';
    return `Conditions overview ${getSelectedDayPrefix(selectedDate, new Date(), language)}`;
  }

  if (language === 'fr') {
    if (dayOffset === 0) return "Conditions d'aujourd'hui";
    if (dayOffset === 1) return 'Conditions de demain';
    if (dayOffset === 2) return "Conditions d'après-demain";
    return `Conditions ${getSelectedDayPrefix(selectedDate, new Date(), language)}`;
  }

  if (language === 'de') {
    if (dayOffset === 0) return 'Heutige Bedingungen';
    if (dayOffset === 1) return 'Morgige Bedingungen';
    if (dayOffset === 2) return 'Übermorgige Bedingungen';
    return `Bedingungen ${getSelectedDayPrefix(selectedDate, new Date(), language)}`;
  }

  if (dayOffset === 0) return 'Condizioni di oggi';
  if (dayOffset === 1) return 'Condizioni di domani';
  if (dayOffset === 2) return 'Condizioni di dopodomani';
  return `Condizioni ${getSelectedDayPrefix(selectedDate, new Date(), language)}`;
};

const formatUpdatedAgo = (lastUpdated: Date | null | undefined, language: LanguageCode) => {
  if (!lastUpdated) return undefined;

  const copy = getLocalizedCopy(language, homeCopy);
  const minutes = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
  if (minutes < 1) return copy.updatedJustNow;
  if (minutes < 60) return copy.updatedMinutes(minutes);
  const hours = Math.round(minutes / 60);
  return copy.updatedHours(hours);
};

const getTopBeachSignals = (item: SuitableBeach, language: LanguageCode) => {
  const copy = getLocalizedCopy(language, homeCopy).topSignals;
  const waveHeightM = item.waveHeightM;
  const signals: Array<{ label: string; icon: React.ReactNode }> = [];

  if (item.canClaimWindProtection || item.exposureLevel === 'protected') {
    signals.push({
      label: copy.protected,
      icon: <ShieldCheck className="h-5 w-5" />,
    });
  }

  if (item.seaCalmClaimAllowed || (typeof waveHeightM === 'number' && waveHeightM < 0.5)) {
    signals.push({
      label: copy.calmWaters,
      icon: <Waves className="h-5 w-5" />,
    });
  }

  if (item.beach.accessibility === 'EASY') {
    signals.push({
      label: copy.easyAccess,
      icon: <Footprints className="h-5 w-5" />,
    });
  }

  return signals.slice(0, 3);
};

type TopBeachHighlightChip = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

const getTopBeachAmenityIcon = (key: AmenityChip['key']): React.ReactNode => {
  switch (key) {
    case 'beachBar':
      return <BadgeCheck className="h-5 w-5" />;
    case 'sunbeds':
      return <SunbedIcon className="h-5 w-5" />;
    case 'foodNearby':
    case 'cafeNearby':
      return <Utensils className="h-5 w-5" />;
    case 'parking':
      return <ParkingCircle className="h-5 w-5" />;
    case 'seasonalFacilities':
      return <CalendarDays className="h-5 w-5" />;
    case 'organizedFacilities':
      return <Check className="h-5 w-5" />;
    default:
      return <Info className="h-5 w-5" />;
  }
};

const getTopBeachFeatureChips = (
  item: SuitableBeach,
  language: LanguageCode,
  t: Translation,
  copy: HomeCopy
): TopBeachHighlightChip[] => {
  const beach = item.beach;
  const chips: TopBeachHighlightChip[] = [];
  const addChip = (chip: TopBeachHighlightChip) => {
    if (!chip.label || chips.some(existing => existing.key === chip.key || existing.label === chip.label)) return;
    chips.push(chip);
  };
  const beachTypeIcons: Record<Beach['beachType'], React.ReactNode> = {
    sandy: <SandDotsIcon className="h-5 w-5" />,
    pebbles: <Mountain className="h-5 w-5" />,
    'sandy-pebbles': <SandPebblesIcon className="h-5 w-5" />,
    rocky: <Mountain className="h-5 w-5" />,
    unknown: <Info className="h-5 w-5" />,
  };
  const accessType = beach.metadata?.access?.type ?? beach.staticLabels?.accessType;
  const customAccessLabel = beach.metadata?.access?.label ?? beach.staticLabels?.accessLabel;
  const accessLabel = language === 'gr' && customAccessLabel
    ? customAccessLabel
    : accessType
      ? localizedAccessLabel(accessType, customAccessLabel, language)
      : t.accessibility[beach.accessibility];
  const waterDepthType = beach.metadata?.waterDepth?.type ?? beach.waterDepth;

  addChip({
    key: 'access',
    label: accessLabel,
    icon: <Footprints className="h-5 w-5" />,
  });
  if (beach.beachType !== 'unknown') {
    addChip({
      key: `type-${beach.beachType}`,
      label: t.filterOptions[beach.beachType],
      icon: beachTypeIcons[beach.beachType],
    });
  }

  if (waterDepthType === 'shallow' || beach.characteristics?.shallowWaters) {
    addChip({
      key: 'shallow-water',
      label: getPreferenceFilterLabel('shallowWater', language, t),
      icon: <Droplets className="h-5 w-5" />,
    });
  } else if (waterDepthType === 'deep' || beach.characteristics?.deepWaters) {
    addChip({
      key: 'deep-water',
      label: getPreferenceFilterLabel('deepWater', language, t),
      icon: <Waves className="h-5 w-5" />,
    });
  }

  if (beach.amenities?.naturalShade || beach.metadata?.shade) {
    addChip({
      key: 'natural-shade',
      label: copy.beachFeatures.naturalShade,
      icon: <Trees className="h-5 w-5" />,
    });
  }
  if (beach.environment?.familyFriendly) {
    addChip({
      key: 'family-friendly',
      label: getPreferenceFilterLabel('familyFriendly', language, t),
      icon: <Users className="h-5 w-5" />,
    });
  }
  if (beach.environment?.quiet && !beach.amenities?.beachBar) {
    addChip({
      key: 'quiet',
      label: copy.beachFeatures.quiet,
      icon: <VolumeX className="h-5 w-5" />,
    });
  }
  if (beach.activities?.snorkeling) {
    addChip({
      key: 'snorkeling',
      label: copy.beachFeatures.snorkeling,
      icon: <Search className="h-5 w-5" />,
    });
  }

  return chips;
};

const uniqueTopBeachHighlights = (
  items: TopBeachHighlightChip[],
  language: LanguageCode,
  limit = 6
): TopBeachHighlightChip[] => {
  const locale = language === 'gr' ? 'el-GR' : undefined;
  const seenKeys = new Set<string>();
  const seenLabels = new Set<string>();
  const uniqueItems: TopBeachHighlightChip[] = [];

  for (const item of items) {
    const label = item.label.trim().toLocaleLowerCase(locale);
    if (seenKeys.has(item.key) || seenLabels.has(label)) continue;
    seenKeys.add(item.key);
    seenLabels.add(label);
    uniqueItems.push(item);
    if (uniqueItems.length >= limit) break;
  }

  return uniqueItems;
};

const BeachImageFallback: React.FC<{ label: string; background?: string }> = ({ label }) => (
  <div
    className="absolute inset-0 overflow-hidden bg-sky-100"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-sky-50 to-teal-50" />
    <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-cyan-200/40 blur-2xl" />
    <div className="absolute right-6 top-6 h-16 w-16 rounded-full border border-white/55 bg-white/34 shadow-inner shadow-white/40" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.72),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.38),transparent_45%)]" />
    <div className="absolute left-0 right-0 top-[48%] h-px bg-cyan-200/35" />
    <svg className="absolute inset-x-0 bottom-0 h-full w-full text-cyan-300/58" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 112 C70 106 120 107 190 112 C260 117 320 116 400 110 L400 160 L0 160 Z" fill="currentColor" />
    </svg>
    <svg className="absolute inset-x-0 bottom-0 h-full w-full text-sky-300/46" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 122 C60 118 120 119 190 123 C260 127 320 127 400 121 L400 160 L0 160 Z" fill="currentColor" />
    </svg>
    <svg className="absolute inset-x-0 bottom-0 h-full w-full text-white/88" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 135 C90 132 150 133 230 136 C300 139 350 138 400 134 L400 160 L0 160 Z" fill="currentColor" />
    </svg>
    <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100/90 bg-white/70 text-cyan-700 shadow-sm shadow-sky-900/10 backdrop-blur-md">
        <Waves className="h-5 w-5" aria-hidden="true" />
      </div>
    </div>
    <div className="absolute inset-x-3 bottom-3 flex justify-center">
      <span className="rounded-full border border-cyan-100/90 bg-white/76 px-3.5 py-2 text-[11px] font-bold leading-none text-cyan-800 shadow-sm shadow-sky-900/10 backdrop-blur-md">
        {label}
      </span>
    </div>
  </div>
);

const getTopChoiceLabel = (
  language: LanguageCode,
  selectedDate?: Date
): { aria: string; badge: string } => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);

  return getLocalizedCopy(language, {
    en: {
      aria: `Best beach ${day}`,
      badge: `Best beach ${day}`,
    },
    gr: {
      aria: `Top επιλογή ${day}`,
      badge: `Top παραλία ${day}`,
    },
    fr: {
      aria: `Meilleure plage ${day}`,
      badge: `Meilleure plage ${day}`,
    },
    de: {
      aria: `Bester Strand ${day}`,
      badge: `Bester Strand ${day}`,
    },
    it: {
      aria: `Migliore spiaggia ${day}`,
      badge: `Migliore spiaggia ${day}`,
    },
  });
};

const getBestBeachesLabel = (language: LanguageCode, selectedDate?: Date): string => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);

  return getLocalizedCopy(language, {
    en: `Best beaches ${day}`,
    gr: `Καταλληλότερες παραλίες ${day}`,
    fr: `Meilleures plages ${day}`,
    de: `Beste Strände ${day}`,
    it: `Migliori spiagge ${day}`,
  });
};

const getTopRecommendationsLabel = (language: LanguageCode, selectedDate: Date | undefined, count: number): string => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const displayCount = Math.max(1, Math.min(3, count));

  if (displayCount === 1) {
    return getLocalizedCopy(language, {
      en: `Top pick ${day}`,
      gr: `Top επιλογή ${day}`,
      fr: `Meilleur choix ${day}`,
      de: `Top-Empfehlung ${day}`,
      it: `Scelta top ${day}`,
    });
  }

  return getLocalizedCopy(language, {
    en: `Top ${displayCount} picks ${day}`,
    gr: `Top ${displayCount} επιλογές ${day}`,
    fr: `Top ${displayCount} choix ${day}`,
    de: `Top ${displayCount} Empfehlungen ${day}`,
    it: `Top ${displayCount} scelte ${day}`,
  });
};

const getRemainingSuitableLabel = (language: LanguageCode, selectedDate?: Date): string => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);

  return getLocalizedCopy(language, {
    en: `Other suitable beaches ${day}`,
    gr: `Υπόλοιπες κατάλληλες ${day}`,
    fr: `Autres plages adaptées ${day}`,
    de: `Weitere passende Strände ${day}`,
    it: `Altre spiagge adatte ${day}`,
  });
};

const getTopBeachShortReason = (item: SuitableBeach, language: LanguageCode, selectedDate?: Date): string => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const waveHeightM = item.waveHeightM;
  const copy = getLocalizedCopy(language, {
    en: {
      lead: `For ${day}`,
      separator: ', ',
      windProtected: 'less exposed to the wind',
      windPartial: 'partly sheltered from the wind',
      wave: (value: string) => `waves ${value} m`,
      calmSea: 'calmer sea signal',
      easyAccess: 'easy access',
      parking: 'parking nearby',
      organized: 'organized beach setup',
      food: 'food nearby',
      shade: 'natural shade',
      fallback: 'good balance of sea conditions and access',
    },
    gr: {
      lead: `Για ${day}`,
      separator: ', ',
      windProtected: 'λιγότερο εκτεθειμένη στον άνεμο',
      windPartial: 'μερικώς προστατευμένη από τον άνεμο',
      wave: (value: string) => `κύμα ${value} m`,
      calmSea: 'ένδειξη για πιο ήρεμη θάλασσα',
      easyAccess: 'εύκολη πρόσβαση',
      parking: 'parking κοντά',
      organized: 'οργανωμένη επιλογή',
      food: 'φαγητό κοντά',
      shade: 'φυσική σκιά',
      fallback: 'καλή ισορροπία θάλασσας και πρόσβασης',
    },
    fr: {
      lead: `Pour ${day}`,
      separator: ', ',
      windProtected: 'moins exposée au vent',
      windPartial: 'partiellement abritée du vent',
      wave: (value: string) => `vagues ${value} m`,
      calmSea: 'signal de mer plus calme',
      easyAccess: 'accès facile',
      parking: 'parking à proximité',
      organized: 'plage aménagée',
      food: 'restauration à proximité',
      shade: 'ombre naturelle',
      fallback: 'bon équilibre entre mer et accès',
    },
    de: {
      lead: `Für ${day}`,
      separator: ', ',
      windProtected: 'weniger dem Wind ausgesetzt',
      windPartial: 'teilweise windgeschützt',
      wave: (value: string) => `Wellen ${value} m`,
      calmSea: 'Signal für ruhigeres Meer',
      easyAccess: 'einfacher Zugang',
      parking: 'Parken in der Nähe',
      organized: 'organisierte Strandoption',
      food: 'Essen in der Nähe',
      shade: 'natürlicher Schatten',
      fallback: 'gute Balance aus Meer und Zugang',
    },
    it: {
      lead: `Per ${day}`,
      separator: ', ',
      windProtected: 'meno esposta al vento',
      windPartial: 'parzialmente riparata dal vento',
      wave: (value: string) => `onde ${value} m`,
      calmSea: 'segnale di mare più calmo',
      easyAccess: 'accesso facile',
      parking: 'parcheggio vicino',
      organized: 'spiaggia attrezzata',
      food: 'cibo vicino',
      shade: 'ombra naturale',
      fallback: 'buon equilibrio tra mare e accesso',
    },
  });
  const facts: string[] = [];
  const addFact = (fact?: string) => {
    if (fact && !facts.includes(fact)) facts.push(fact);
  };

  if (item.canClaimWindProtection === true) {
    addFact(copy.windProtected);
  } else if (item.exposureLevel === 'partial') {
    addFact(copy.windPartial);
  }

  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    addFact(copy.wave(waveHeightM.toFixed(1)));
  } else if (item.seaCalmClaimAllowed === true) {
    addFact(copy.calmSea);
  }

  if (item.beach.accessibility === 'EASY') {
    addFact(copy.easyAccess);
  }

  if (item.beach.amenities?.parking) {
    addFact(copy.parking);
  } else if (item.beach.amenities?.organized || item.beach.amenities?.beachBar || item.beach.amenities?.sunbeds) {
    addFact(copy.organized);
  } else if (item.beach.amenities?.taverna || item.beach.amenities?.restaurant) {
    addFact(copy.food);
  } else if (item.beach.amenities?.naturalShade) {
    addFact(copy.shade);
  }

  if (facts.length === 0) {
    addFact(copy.fallback);
  }

  return `${copy.lead}: ${facts.slice(0, 3).join(copy.separator)}.`;
};

const withCount = (label: string, count?: number): string => (
  typeof count === 'number' && count > 0 ? `${label} (${count})` : label
);

export const BeachSearcherHome: React.FC<BeachSearcherHomeProps> = ({
  language,
  selectedIsland,
  allIslands,
  searchQuery,
  sortBy,
  isMobileViewport = false,
  isAllBeachesPanelOpen: controlledAllBeachesPanelOpen,
  onAllBeachesPanelOpenChange,
  isWeatherPanelOpen: controlledWeatherPanelOpen,
  onWeatherPanelOpenChange,
  suitableDistanceSortActive = false,
  preferences,
  activeFilters = [],
  filterResultCounts,
  advancedFilterResultCounts,
  filteredResultCount,
  searchSuggestions = [],
  isSearchSuggesting = false,
  protectedSortLabel,
  islandBackground,
  mapPreview,
  topRecommendationCards,
  suitableBeachCards,
  suitableBeachTotalCount,
  onActiveSuitableBeachChange,
  showSuitableBeachSection = true,
  allBeachCards,
  beachWeatherContexts,
  topBeachToday,
  topBeachTimingLabel,
  forecastDays,
  selectedDayIndex,
  selectedForecast,
  selectedDate,
  lastUpdated,
  favorites,
  t,
  onToggleFavorite,
  onSearchChange,
  onSearchSubmit,
  onSearchSuggestionSelect,
  onOpenFilters,
  onOpenIslandSelector,
  onUseCurrentLocation,
  onRequestUserLocation,
  hasUserLocation = false,
  isFindingCurrentLocation = false,
  currentLocationError,
  onCategorySelect,
  onAdvancedFilterToggle,
  onForecastDaySelect,
  onBeachClick,
  onSelectIsland,
  strongWindContext = false,
}) => {
  const copy = getLocalizedCopy(language, homeCopy);
  const topChoiceCopy = getTopChoiceLabel(language, selectedDate);
  const bestBeachesLabel = getBestBeachesLabel(language, selectedDate);
  const [isDirectorySortOpen, setIsDirectorySortOpen] = useState(false);
  const [directoryViewCriteria, setDirectoryViewCriteria] = useState({
    suitable: true,
    distance: false,
  });
  const [localAllBeachesPanelOpen, setLocalAllBeachesPanelOpen] = useState(false);
  const [localWeatherPanelOpen, setLocalWeatherPanelOpen] = useState(false);
  const isAllBeachesPanelOpen = controlledAllBeachesPanelOpen ?? localAllBeachesPanelOpen;
  const setIsAllBeachesPanelOpen = onAllBeachesPanelOpenChange ?? setLocalAllBeachesPanelOpen;
  const isWeatherPanelOpen = controlledWeatherPanelOpen ?? localWeatherPanelOpen;
  const setIsWeatherPanelOpen = onWeatherPanelOpenChange ?? setLocalWeatherPanelOpen;
  const directorySortRef = useRef<HTMLDivElement>(null);
  const desktopDirectorySortRef = useRef<HTMLDivElement>(null);
  const [isDesktopMoreFiltersOpen, setIsDesktopMoreFiltersOpen] = useState(false);
  const desktopMoreFiltersRef = useRef<HTMLDivElement>(null);
  const desktopFilterRowRef = useRef<HTMLDivElement>(null);
  const desktopFilterMeasureRef = useRef<HTMLDivElement>(null);
  const topRecommendationsCarouselRef = useRef<HTMLDivElement>(null);
  const suitableCarouselRef = useRef<HTMLDivElement>(null);
  const directoryCarouselRef = useRef<HTMLDivElement>(null);
  const activeSuitableBeachIdRef = useRef<number | undefined>(undefined);
  const isCarouselScrollingRef = useRef(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState(-1);
  const activePlaceName = selectedIsland?.name[language] || copy.greece;
  const heroBackground = getImageSet(islandBackground);
  const regionBeaches = selectedIsland?.beaches || [];
  const hasRegionFilterAvailabilityData = regionBeaches.length > 0;
  const visibleDesktopPreferenceFilters = [
    ...desktopPrimaryPreferenceFilters,
    ...desktopSecondaryPreferenceFilters,
  ].filter(filter => (
    !hasRegionFilterAvailabilityData ||
    preferences[filter] ||
    regionBeaches.some(beach => beachMatchesPreferenceFilter(beach, filter))
  ));
  const visibleDesktopAdvancedFilters = desktopAdvancedFilters.filter(filter => (
    !hasRegionFilterAvailabilityData ||
    activeFilters.includes(filter.key) ||
    regionBeaches.some(beach => beachMatchesAdvancedFilter(beach, filter.key))
  ));
  const desktopFilterItems: DesktopFilterItem[] = [
    ...visibleDesktopPreferenceFilters.map(filter => ({
      itemKey: `preference-${filter}`,
      kind: 'preference' as const,
      key: filter,
      icon: filterIcons[filter],
      label: getPreferenceFilterLabel(filter, language, t),
      count: filterResultCounts?.[filter],
      isActive: preferences[filter],
    })),
    ...visibleDesktopAdvancedFilters.map(filter => ({
      itemKey: `advanced-${filter.key}`,
      kind: 'advanced' as const,
      key: filter.key,
      icon: filter.icon,
      label: t.filterOptions[filter.key as keyof typeof t.filterOptions] || String(filter.key),
      count: advancedFilterResultCounts?.[filter.key],
      isActive: activeFilters.includes(filter.key),
    })),
  ];
  const [desktopVisibleFilterCount, setDesktopVisibleFilterCount] = useState(desktopFilterItems.length);
  const desktopFilterMeasureKey = desktopFilterItems
    .map(item => `${item.itemKey}:${item.label}:${item.count ?? ''}:${item.isActive ? 1 : 0}`)
    .join('|');

  useLayoutEffect(() => {
    const row = desktopFilterRowRef.current;
    const measure = desktopFilterMeasureRef.current;
    if (!row || !measure) return;

    const GAP = 8; // matches gap-2 between chips
    const MORE_RESERVE = 224; // ~13.5rem "More" button + gap

    const compute = () => {
      const containerWidth = row.clientWidth;
      if (containerWidth <= 0) return;

      const chipWidths = Array.from(measure.children).map(
        child => (child as HTMLElement).getBoundingClientRect().width
      );
      const totalCount = chipWidths.length;
      if (totalCount === 0) {
        setDesktopVisibleFilterCount(0);
        return;
      }

      let fullTotal = 0;
      chipWidths.forEach((width, index) => {
        fullTotal += width + (index > 0 ? GAP : 0);
      });
      if (fullTotal <= containerWidth) {
        setDesktopVisibleFilterCount(totalCount);
        return;
      }

      const available = containerWidth - MORE_RESERVE;
      let used = 0;
      let count = 0;
      for (let index = 0; index < totalCount; index += 1) {
        const next = chipWidths[index] + (count > 0 ? GAP : 0);
        if (used + next > available) break;
        used += next;
        count += 1;
      }
      setDesktopVisibleFilterCount(Math.max(1, count));
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(row);
    return () => observer.disconnect();
  }, [desktopFilterMeasureKey]);

  const desktopVisibleFilterItems = desktopFilterItems.slice(0, desktopVisibleFilterCount);
  const desktopHiddenFilterItems = desktopFilterItems.slice(desktopVisibleFilterCount);
  const hasVisibleDesktopMoreFilters = desktopHiddenFilterItems.length > 0;
  const desktopMoreActiveCount = desktopHiddenFilterItems.filter(filter => filter.isActive).length;

  useEffect(() => {
    if (!isAllBeachesPanelOpen && !isWeatherPanelOpen) return undefined;
    if (typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAllBeachesPanelOpen, isWeatherPanelOpen]);

  useEffect(() => {
    if (isMobileViewport) return;
    setIsAllBeachesPanelOpen(false);
    setIsWeatherPanelOpen(false);
  }, [isMobileViewport]);

  useEffect(() => {
    setIsAllBeachesPanelOpen(false);
    setIsWeatherPanelOpen(false);
  }, [selectedIsland?.id]);

  const trimmedSearchQuery = searchQuery.trim();
  const canShowSearchSuggestions = trimmedSearchQuery.length >= 2 && Boolean(onSearchSuggestionSelect);
  const shouldRenderSearchSuggestions = isSearchSuggestionsOpen && canShowSearchSuggestions;
  const searchSuggestionListId = 'directory-search-suggestions';

  useEffect(() => {
    if (trimmedSearchQuery.length >= 2) return;
    setIsSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
  }, [trimmedSearchQuery]);

  useEffect(() => {
    if (!isSearchSuggestionsOpen) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!searchBoxRef.current || searchBoxRef.current.contains(event.target as Node)) return;
      setIsSearchSuggestionsOpen(false);
      setActiveSearchSuggestionIndex(-1);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSearchSuggestionsOpen]);

  const handleSearchSuggestionSelect = (suggestion: DirectorySearchSuggestion) => {
    setIsSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
    onSearchSuggestionSelect?.(suggestion);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && canShowSearchSuggestions) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(true);
      setActiveSearchSuggestionIndex(current => {
        if (searchSuggestions.length === 0) return -1;
        if (event.key === 'ArrowDown') return Math.min(current + 1, searchSuggestions.length - 1);
        return current <= 0 ? searchSuggestions.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === 'Enter' && isSearchSuggestionsOpen && activeSearchSuggestionIndex >= 0) {
      const selectedSuggestion = searchSuggestions[activeSearchSuggestionIndex];
      if (selectedSuggestion) {
        event.preventDefault();
        handleSearchSuggestionSelect(selectedSuggestion);
      }
      return;
    }

    if (event.key === 'Escape' && isSearchSuggestionsOpen) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(false);
      setActiveSearchSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    if (!isAllBeachesPanelOpen && !isWeatherPanelOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsAllBeachesPanelOpen(false);
      setIsWeatherPanelOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAllBeachesPanelOpen, isWeatherPanelOpen]);

  const sortedIslandCards = useMemo(() => (
    [...allIslands]
      .filter(island => island.beaches.length > 0)
      .sort((a, b) => b.beaches.length - a.beaches.length)
      .slice(0, 8)
  ), [allIslands]);

  const popularBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    // popularityScore/rating are synthetic (deterministic hash of the beach id) and must not
    // drive this ordering — rank by real signals: photo coverage, amenity richness, then name.
    const amenityRichness = (beach: Beach) => Object.values(beach.amenities || {}).filter(value => value === true).length;
    return [...selectedIsland.beaches]
      .sort((a, b) => {
        const aPhoto = getBeachPhotoLookup(a.name.gr, a.name.en, a.id, 1, selectedIsland.name[language]).source === 'exact';
        const bPhoto = getBeachPhotoLookup(b.name.gr, b.name.en, b.id, 1, selectedIsland.name[language]).source === 'exact';
        if (aPhoto !== bPhoto) return bPhoto ? 1 : -1;

        const byRecognition = getBeachTouristRecognitionScore(b) - getBeachTouristRecognitionScore(a);
        if (byRecognition !== 0) return byRecognition;
        const byAmenities = amenityRichness(b) - amenityRichness(a);
        if (byAmenities !== 0) return byAmenities;
        return (a.name.en || '').localeCompare(b.name.en || '');
      })
      .slice(0, 8);
  }, [language, selectedIsland]);
  const weatherBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    if (suitableBeachCards && suitableBeachCards.length > 0) {
      const locale = language === 'gr' ? 'el-GR' : undefined;
      const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase(locale);
      const activeAdvancedFilters = activeFilters.filter(filter => filter !== 'showAll');
      const matchesCurrentFilters = (beach: Beach) => {
        const matchesSearch = normalizedSearchQuery.length === 0 || [
          displayBeachName(beach.name, language),
          beach.name.gr,
          beach.name.en,
          ...(beach.aliases || []),
        ].some(value => value.toLocaleLowerCase(locale).includes(normalizedSearchQuery));

        if (!matchesSearch) return false;

        const matchesPreferences = QUICK_PREFERENCE_FILTERS.every(filter => (
          !preferences[filter] || beachMatchesPreferenceFilter(beach, filter)
        ));
        if (!matchesPreferences) return false;

        return activeAdvancedFilters.every(filter => beachMatchesAdvancedFilter(beach, filter));
      };

      const getDistance = (item: SuitableBeach): number | undefined => (
        typeof item.distance === 'number' && Number.isFinite(item.distance) ? item.distance : undefined
      );
      const filteredCards = suitableBeachCards.filter(item => matchesCurrentFilters(item.beach));
      const sortedCards = [...filteredCards].sort((a, b) => {
        if (directoryViewCriteria.distance || suitableDistanceSortActive) {
          const aDistance = getDistance(a);
          const bDistance = getDistance(b);
          if (aDistance !== undefined && bDistance !== undefined && aDistance !== bDistance) {
            return aDistance - bDistance;
          }
          if (aDistance !== undefined) return -1;
          if (bDistance !== undefined) return 1;
        }

        return 0;
      });

      return sortedCards.map(item => ({
        beach: item.beach,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        context: item,
      }));
    }

    return popularBeachCards.map(beach => ({ beach, score: undefined, context: undefined }));
  }, [
    activeFilters,
    directoryViewCriteria.distance,
    language,
    popularBeachCards,
    preferences,
    searchQuery,
    selectedIsland,
    suitableDistanceSortActive,
    suitableBeachCards,
  ]);
  const topRecommendationBeachCards = useMemo(() => (
    (topRecommendationCards || []).map(item => ({
      beach: item.beach,
      score: Math.max(0, Math.min(100, Math.round(item.score))),
      context: item,
    }))
  ), [topRecommendationCards]);
  const hasTopRecommendationView = selectedIsland !== null && topRecommendationBeachCards.length > 0;
  const topRecommendationsLabel = getTopRecommendationsLabel(language, selectedDate, topRecommendationBeachCards.length);
  const suitableSectionLabel = hasTopRecommendationView
    ? getRemainingSuitableLabel(language, selectedDate)
    : bestBeachesLabel;
  const weatherBeachCardRankStart = topBeachToday ? 2 : 1;
  const suitableBeachDisplayCount = typeof suitableBeachTotalCount === 'number'
    ? suitableBeachTotalCount
    : weatherBeachCards.length;
  const hasSuitableSortOption = Boolean(selectedIsland);
  const isDirectorySuitableView = hasSuitableSortOption && directoryViewCriteria.suitable;

  useEffect(() => {
    if (!onActiveSuitableBeachChange) return undefined;

    if (isAllBeachesPanelOpen) {
      return undefined;
    }

    if ((!hasTopRecommendationView && !isDirectorySuitableView) || !selectedIsland || (topRecommendationBeachCards.length === 0 && weatherBeachCards.length === 0)) {
      activeSuitableBeachIdRef.current = undefined;
      onActiveSuitableBeachChange(undefined, { resumeFollow: false });
      return undefined;
    }

    const carousel = topRecommendationsCarouselRef.current || suitableCarouselRef.current;
    if (!carousel) {
      return undefined;
    }

    let animationFrameId = 0;
    let settleTimeoutId: number | undefined;

    const updateActiveBeach = (resumeFollow = true) => {
      animationFrameId = 0;
      const carouselRect = carousel.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;
      const cards = Array.from(carousel.querySelectorAll<HTMLElement>('[data-suitable-beach-id]'));
      let nearestBeachId: number | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cards.forEach(card => {
        const beachId = Number(card.dataset.suitableBeachId);
        if (!Number.isFinite(beachId)) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - carouselCenter);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBeachId = beachId;
        }
      });

      if (activeSuitableBeachIdRef.current === nearestBeachId) return;
      activeSuitableBeachIdRef.current = nearestBeachId;
      onActiveSuitableBeachChange(nearestBeachId, { resumeFollow });
    };

    const scheduleUpdate = (resumeFollow = true) => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(() => updateActiveBeach(resumeFollow));
    };
    const handleCarouselScroll = () => {
      // Pause the map indication while the carousel is actively scrolling…
      isCarouselScrollingRef.current = true;
      if (activeSuitableBeachIdRef.current !== undefined) {
        activeSuitableBeachIdRef.current = undefined;
        onActiveSuitableBeachChange(undefined, { resumeFollow: false });
      }
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      // …and resume it once the scroll has stabilized.
      settleTimeoutId = window.setTimeout(() => {
        isCarouselScrollingRef.current = false;
        scheduleUpdate(true);
      }, 180);
    };
    const handleResize = () => scheduleUpdate(false);

    scheduleUpdate(false);
    settleTimeoutId = window.setTimeout(() => scheduleUpdate(false), 160);
    carousel.addEventListener('scroll', handleCarouselScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      isCarouselScrollingRef.current = false;
      carousel.removeEventListener('scroll', handleCarouselScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [hasTopRecommendationView, isAllBeachesPanelOpen, isDirectorySuitableView, isMobileViewport, onActiveSuitableBeachChange, selectedIsland, topRecommendationBeachCards.length, weatherBeachCards]);

  const directoryAllBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    return allBeachCards && allBeachCards.length > 0 ? allBeachCards : selectedIsland.beaches;
  }, [allBeachCards, selectedIsland]);
  const directorySuitableOnlyBeachCards = useMemo<BeachCardContext[]>(() => {
    if (!suitableBeachCards || suitableBeachCards.length === 0) {
      return directoryAllBeachCards;
    }

    return weatherBeachCards.map(({ beach, context }) => {
      if (!context) return beach;

      return {
        ...beach,
        distance: context.distance,
        score: context.score,
        isExposed: context.isExposed,
        bestBeachTime: context.bestBeachTime,
        bestTimeWindow: context.bestTimeWindow,
        exposureLevel: context.exposureLevel,
        waveHeightM: context.waveHeightM,
        warnings: context.warnings,
        confidence: context.confidence,
        swimmingComfort: context.swimmingComfort,
        canClaimWindProtection: context.canClaimWindProtection,
        seaCalmClaimAllowed: context.seaCalmClaimAllowed,
        lessExposedToday: true,
      };
    });
  }, [directoryAllBeachCards, suitableBeachCards, weatherBeachCards]);
  const directoryTitle = useMemo(() => getBeachFilterDirectoryTitle({
    activeFilters,
    fallbackTitle: copy.allOtherBeaches,
    language,
    preferences,
    t,
  }), [activeFilters, copy.allOtherBeaches, language, preferences, t]);
  const weatherContextByBeachId = useMemo(() => (
    new Map((beachWeatherContexts || []).map(item => [item.beach.id, item]))
  ), [beachWeatherContexts]);
  const visibleMapExposureLevels = useMemo(() => (
    getConsistentVisibleMapExposureLevels(
      beachWeatherContexts || [],
      selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : undefined,
      selectedForecast?.wind.deg
    )
  ), [beachWeatherContexts, selectedForecast]);
  const getDesktopFilterDisplayCount = (item: DesktopFilterItem): number | undefined => {
    if (!isDirectorySuitableView || !suitableBeachCards || suitableBeachCards.length === 0) {
      return item.count;
    }

    const locale = language === 'gr' ? 'el-GR' : undefined;
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase(locale);
    const preferenceFilters = QUICK_PREFERENCE_FILTERS.filter(filter => (
      preferences[filter] || (item.kind === 'preference' && item.key === filter)
    ));
    const advancedFilters = activeFilters.filter(filter => filter !== 'showAll');
    if (item.kind === 'advanced' && item.key !== 'showAll' && !advancedFilters.includes(item.key)) {
      advancedFilters.push(item.key);
    }

    return suitableBeachCards.filter(({ beach }) => {
      const matchesSearch = normalizedSearchQuery.length === 0 || [
        displayBeachName(beach.name, language),
        beach.name.gr,
        beach.name.en,
        ...(beach.aliases || []),
      ].some(value => value.toLocaleLowerCase(locale).includes(normalizedSearchQuery));

      return matchesSearch &&
        preferenceFilters.every(filter => beachMatchesPreferenceFilter(beach, filter)) &&
        advancedFilters.every(filter => beachMatchesAdvancedFilter(beach, filter));
    }).length;
  };
  const directoryDisplayBeachCards = useMemo(() => {
    const sourceBeachCards = isDirectorySuitableView
      ? directorySuitableOnlyBeachCards
      : directoryAllBeachCards;

    if (!directoryViewCriteria.distance) {
      return sourceBeachCards;
    }

    const getDistance = (beach: Beach): number | undefined => {
      const directDistance = (beach as Beach & { distance?: number }).distance;
      if (typeof directDistance === 'number' && Number.isFinite(directDistance)) return directDistance;

      const contextDistance = weatherContextByBeachId.get(beach.id)?.distance;
      return typeof contextDistance === 'number' && Number.isFinite(contextDistance)
        ? contextDistance
        : undefined;
    };

    return [...sourceBeachCards].sort((a, b) => {
      if (directoryViewCriteria.distance) {
        const aDistance = getDistance(a);
        const bDistance = getDistance(b);
        if (aDistance !== undefined && bDistance !== undefined && aDistance !== bDistance) {
          return aDistance - bDistance;
        }
        if (aDistance !== undefined) return -1;
        if (bDistance !== undefined) return 1;
      }

      return 0;
    });
  }, [directoryAllBeachCards, directorySuitableOnlyBeachCards, directoryViewCriteria.distance, isDirectorySuitableView, weatherContextByBeachId]);
  const shouldTrackDirectoryCarouselOnMap = Boolean(
    isMobileViewport &&
    directoryDisplayBeachCards.length > 0 &&
    (isAllBeachesPanelOpen || (selectedIsland && !isDirectorySuitableView))
  );

  useEffect(() => {
    const carousels = [topRecommendationsCarouselRef.current, suitableCarouselRef.current, directoryCarouselRef.current]
      .filter((carousel): carousel is HTMLDivElement => Boolean(carousel));

    if (carousels.length === 0) return undefined;

    const cleanups = carousels.map(installMouseDragScroll);
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [
    directoryDisplayBeachCards.length,
    isAllBeachesPanelOpen,
    isDirectorySuitableView,
    selectedIsland?.id,
    topRecommendationBeachCards.length,
    weatherBeachCards.length,
  ]);

  useEffect(() => {
    if (!onActiveSuitableBeachChange) return undefined;

    if (!shouldTrackDirectoryCarouselOnMap) {
      return undefined;
    }

    const carousel = directoryCarouselRef.current;
    if (!carousel) {
      return undefined;
    }

    let animationFrameId = 0;
    let settleTimeoutId: number | undefined;

    const updateActiveBeach = (resumeFollow = true) => {
      animationFrameId = 0;
      const carouselRect = carousel.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;
      const cards = Array.from(carousel.querySelectorAll<HTMLElement>('[data-directory-beach-id]'));
      let nearestBeachId: number | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cards.forEach(card => {
        const beachId = Number(card.dataset.directoryBeachId);
        if (!Number.isFinite(beachId)) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - carouselCenter);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBeachId = beachId;
        }
      });

      if (activeSuitableBeachIdRef.current === nearestBeachId) return;
      activeSuitableBeachIdRef.current = nearestBeachId;
      onActiveSuitableBeachChange(nearestBeachId, { resumeFollow });
    };

    const scheduleUpdate = (resumeFollow = true) => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(() => updateActiveBeach(resumeFollow));
    };
    const handleCarouselScroll = () => {
      // Pause the map indication while the carousel is actively scrolling…
      isCarouselScrollingRef.current = true;
      if (activeSuitableBeachIdRef.current !== undefined) {
        activeSuitableBeachIdRef.current = undefined;
        onActiveSuitableBeachChange(undefined, { resumeFollow: false });
      }
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      // …and resume it once the scroll has stabilized.
      settleTimeoutId = window.setTimeout(() => {
        isCarouselScrollingRef.current = false;
        scheduleUpdate(true);
      }, 180);
    };
    const handleResize = () => scheduleUpdate(false);

    scheduleUpdate(false);
    settleTimeoutId = window.setTimeout(() => scheduleUpdate(false), 160);
    carousel.addEventListener('scroll', handleCarouselScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      isCarouselScrollingRef.current = false;
      carousel.removeEventListener('scroll', handleCarouselScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [directoryDisplayBeachCards, onActiveSuitableBeachChange, shouldTrackDirectoryCarouselOnMap]);

  const searchPlaceholder = copy.searchPlaceholder;
  const topBeachName = topBeachToday ? displayBeachName(topBeachToday.beach.name, language) : '';
  const topBeachShortReason = topBeachToday ? getTopBeachShortReason(topBeachToday, language, selectedDate) : undefined;
  const topBeachSignals = topBeachToday ? getTopBeachSignals(topBeachToday, language) : [];
  const topBeachTimeText = topBeachToday
    ? topBeachTimingLabel || topBeachToday.bestTimeWindow
    : undefined;
  const visitTimeLabel = getLocalizedCopy(language, {
    en: 'Best time',
    gr: 'Ώρα επίσκεψης',
    fr: 'Meilleur moment',
    de: 'Beste Zeit',
    it: 'Ora migliore',
  });
  const topBeachAmenityChips = topBeachToday
    ? getAmenityChips(topBeachToday.beach, language)
      .filter(chip => chip.key !== 'unknownFacilities')
      .slice(0, 4)
    : [];
  const topBeachFeatureChips = topBeachToday
    ? getTopBeachFeatureChips(topBeachToday, language, t, copy)
    : [];
  const topBeachHighlights = topBeachToday
    ? uniqueTopBeachHighlights([
      ...topBeachSignals.map((signal, index) => ({
        key: `signal-${index}-${signal.label}`,
        label: signal.label,
        icon: signal.icon,
      })),
      ...topBeachFeatureChips,
      ...topBeachAmenityChips.map(chip => ({
        key: `amenity-${chip.key}`,
        label: chip.label,
        icon: getTopBeachAmenityIcon(chip.key),
      })),
    ], language, 6)
    : [];
  const topBeachPhoto = topBeachToday
    ? getBeachPhotoLookup(topBeachToday.beach.name.gr, topBeachToday.beach.name.en, topBeachToday.beach.id, 1, selectedIsland?.name[language]).photos[0]
    : undefined;
  const topBeachCanNavigate = topBeachToday ? canOpenNavigation(topBeachToday.beach) : false;
  const handleTopBeachNavigation = () => {
    if (!topBeachToday || !topBeachCanNavigate) return;

    trackEvent('navigation_clicked', topBeachToday.beach.id, {
      locale: languageToLocale(language),
      region: selectedIsland?.name.en || activePlaceName,
      beach_name: topBeachToday.beach.name.en,
      source: 'top_beach_today_card',
    });
    openNavigation(topBeachToday.beach);
  };
  const topPhotoSoonLabel = copy.photoSoon;
  const weatherDate = selectedForecast?.date ? formatDirectoryDate(selectedForecast.date, language) : undefined;
  const absoluteWeatherDate = selectedForecast?.date
    ? new Intl.DateTimeFormat(languageToDateLocale(language), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(selectedForecast.date)
    : undefined;
  const isWeatherPanelMode = isMobileViewport && isWeatherPanelOpen;
  const conditionsOverviewDate = isWeatherPanelMode ? absoluteWeatherDate : weatherDate;
  const conditionsOverviewTitle = getConditionsOverviewTitle(language, selectedForecast?.date);
  const showConditionsOverviewTitle = !isWeatherPanelMode;
  const mobileWeatherForecastTitle = selectedIsland
    ? `${getLocalizedCopy(language, {
      en: 'Forecast',
      gr: 'Πρόγνωση',
      fr: 'Prévision',
      de: 'Vorhersage',
      it: 'Previsioni',
    })} · ${selectedIsland.name[language]}`
    : undefined;
  const updatedLabel = formatUpdatedAgo(lastUpdated, language);
  const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined;
  const localizedWindDirection = windDirection
    ? t.windDirections[windDirection as WindDirection] || windDirection
    : undefined;
  const windKmh = selectedForecast ? Math.round(selectedForecast.wind.speed * 3.6) : undefined;
  const windBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : undefined;
  const conditionItems = selectedForecast ? [
    {
      key: 'wind',
      icon: <Wind className="h-6 w-6" />,
      label: copy.conditions.wind,
      value: localizedWindDirection || '',
      detail: `${windKmh ?? 0} km/h`,
      subdetail: windBeaufort ? `${windBeaufort} ${copy.conditions.beaufortUnit}` : undefined,
    },
    {
      key: 'air',
      icon: <Thermometer className="h-6 w-6" />,
      label: t.temperatureLabel || copy.conditions.air,
      value: `${Math.round(selectedForecast.temp_max)}°C`,
      detail: copy.conditions.high,
      subdetail: undefined,
    },
  ] : [];
  // In the desktop sidebar the panel is a narrow column, so the forecast's wide
  // 3-column header/toggle row would collide. There we keep the hourly forecast
  // permanently expanded (no toggle) and drop the redundant inner header, which
  // also fills the otherwise-empty space at the bottom of the card.
  const inlineForecastInSidebar = isWeatherPanelMode || !isMobileViewport;
  const conditionsOverviewContent = selectedIsland ? (
    <section className="flex flex-col rounded-2xl border border-sky-200 bg-white p-3 shadow-sm shadow-sky-900/5 sm:p-4 lg:absolute lg:inset-0 lg:overflow-hidden" aria-label={copy.conditionsOverviewAria}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 lg:shrink-0">
        <div>
          {showConditionsOverviewTitle && (
            <h2 className="text-base font-extrabold text-slate-950">
              {conditionsOverviewTitle}
            </h2>
          )}
          {isWeatherPanelMode && mobileWeatherForecastTitle && (
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-500 shadow-inner shadow-white/70">
                <CloudSun className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="min-w-0 truncate text-base font-extrabold leading-tight text-slate-950">
                {mobileWeatherForecastTitle}
              </h2>
            </div>
          )}
          <div className={`${showConditionsOverviewTitle ? 'mt-1.5' : ''} flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500`}>
            {conditionsOverviewDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {conditionsOverviewDate}
              </span>
            )}
            {updatedLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {updatedLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {conditionItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 lg:shrink-0">
          {conditionItems.map(item => (
            <div key={item.key} className="flex min-h-16 items-center gap-2.5 rounded-xl border border-sky-100 bg-sky-50/70 px-2.5 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#007a83] shadow-sm ring-1 ring-sky-100">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold tracking-normal text-slate-500">{item.label}</p>
                <p className={`${item.key === 'wind' ? 'whitespace-nowrap text-[0.82rem] min-[380px]:text-sm' : 'whitespace-normal break-words text-sm sm:text-base'} font-extrabold leading-tight text-slate-950`}>
                  {item.value}
                </p>
                {item.detail && <p className="text-xs font-semibold text-[#007a83]">{item.detail}</p>}
                {item.subdetail && <p className="text-xs font-semibold text-[#007a83]">{item.subdetail}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-6 text-sm font-semibold text-slate-600">
          {copy.noForecast}
        </div>
      )}

      {forecastDays && forecastDays.length > 0 && typeof selectedDayIndex === 'number' && onForecastDaySelect && (
        <div className="mt-4 border-t border-sky-100 pt-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <WeatherSummary
            forecast={forecastDays}
            selectedDayIndex={selectedDayIndex}
            onDaySelect={onForecastDaySelect}
            t={t}
            islandName={selectedIsland?.name[language]}
            variant="default"
            defaultHourlyExpanded={inlineForecastInSidebar}
            useWeekdayLabels={inlineForecastInSidebar}
            hideHourlyToggle={inlineForecastInSidebar}
            hideForecastHeader={inlineForecastInSidebar}
            stackedPills={inlineForecastInSidebar}
            fillHeight={inlineForecastInSidebar}
          />
        </div>
      )}
    </section>
  ) : null;
  const closeLabel = getLocalizedCopy(language, {
    en: 'Close',
    gr: 'Κλείσιμο',
    fr: 'Fermer',
    de: 'Schließen',
    it: 'Chiudi',
  });
  const weatherPanelTitle = selectedIsland
    ? selectedIsland.name[language]
    : getLocalizedCopy(language, {
      en: 'Weather',
      gr: 'Καιρός',
      fr: 'Meteo',
      de: 'Wetter',
      it: 'Meteo',
    });
  const hasBelowHeroContent = (
    !selectedIsland ||
    hasTopRecommendationView ||
    showSuitableBeachSection ||
    (selectedIsland && isDirectorySuitableView && weatherBeachCards.length > 0) ||
    (!isMobileViewport && Boolean(conditionsOverviewContent)) ||
    (!isMobileViewport && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0) ||
    (isMobileViewport && selectedIsland && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0)
  );
  const directorySortOptions: Array<{
    key: SortOption | 'suitable';
    label: string;
    isActive: boolean;
    onSelect: () => void;
    isDisabled?: boolean;
  }> = [
    {
      key: 'all',
      label: t.sortByAll,
      isActive: !directoryViewCriteria.suitable,
      onSelect: () => setDirectoryViewCriteria(current => ({ ...current, suitable: false })),
    },
    ...(hasSuitableSortOption ? [{
      key: 'suitable' as const,
      label: protectedSortLabel ?? t.sortByProtected,
      isActive: directoryViewCriteria.suitable,
      onSelect: () => setDirectoryViewCriteria(current => ({ ...current, suitable: true })),
    }] : []),
    {
      key: 'distance',
      label: isFindingCurrentLocation && !hasUserLocation ? copy.findingLocation : t.sortByDistance,
      isActive: directoryViewCriteria.distance,
      onSelect: () => {
        const shouldEnableDistance = !directoryViewCriteria.distance;
        if (shouldEnableDistance) {
          // Always grab a fresh, high-accuracy fix here so a stale location from a
          // previous "near me" action doesn't keep showing the wrong spot.
          const requestLocation = onRequestUserLocation ?? onUseCurrentLocation;
          requestLocation?.();
        }
        setDirectoryViewCriteria(current => ({ ...current, distance: !current.distance }));
      },
      isDisabled: isFindingCurrentLocation && !hasUserLocation,
    },
  ];
  const activeDirectorySortOptions = directorySortOptions.filter(option => option.isActive);
  const activeDirectorySortLabel = activeDirectorySortOptions.length === 0
    ? copy.sort
    : activeDirectorySortOptions.length === 1
    ? activeDirectorySortOptions[0].label
    : getLocalizedCopy(language, {
      en: `${activeDirectorySortOptions.length} criteria`,
      gr: `${activeDirectorySortOptions.length} επιλογές`,
      fr: `${activeDirectorySortOptions.length} critères`,
      de: `${activeDirectorySortOptions.length} Kriterien`,
      it: `${activeDirectorySortOptions.length} criteri`,
    });

  useEffect(() => {
    if (!isDirectorySortOpen && !isDesktopMoreFiltersOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const isInsideDirectorySort =
        directorySortRef.current?.contains(target) ||
        desktopDirectorySortRef.current?.contains(target);
      if (isDirectorySortOpen && !isInsideDirectorySort) {
        setIsDirectorySortOpen(false);
      }
      if (isDesktopMoreFiltersOpen && !desktopMoreFiltersRef.current?.contains(target)) {
        setIsDesktopMoreFiltersOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDirectorySortOpen(false);
        setIsDesktopMoreFiltersOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktopMoreFiltersOpen, isDirectorySortOpen]);
  const cardWindSpeed = selectedForecast?.wind.speed ?? 0;
  const cardTemperature = selectedForecast?.temp_max;
  const islandCardName = selectedIsland?.name[language] || activePlaceName;
  const getRoundedScore = (value: unknown) => (
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : undefined
  );
  const renderBeachDecisionCard = (
    beach: BeachCardContext,
    options: {
      score?: number;
      context?: SuitableBeach;
      recommendationRank?: number;
      recommendationLabel?: string;
      topPickTimeLabel?: string;
      density?: 'regular' | 'compact';
      showTodayScoreBadge?: boolean;
      alignExposureToMap?: boolean;
      windExposureMode?: 'none' | 'simple';
    } = {}
  ) => {
    const directContext = beach as BeachCardContext;
    const weatherContext = options.context || weatherContextByBeachId.get(beach.id);
    const distance = directContext.distance ?? weatherContext?.distance;
    const rawExposureLevel = options.context?.exposureLevel ?? directContext.exposureLevel ?? weatherContext?.exposureLevel;
    const visibleMapExposureLevel = visibleMapExposureLevels.get(beach.id);
    const alignsToMapProtected = Boolean(options.alignExposureToMap && visibleMapExposureLevel === 'protected');
    const alignsToMapLessExposed = Boolean(options.alignExposureToMap && (
      visibleMapExposureLevel === 'protected' || visibleMapExposureLevel === 'partial'
    ));
    const exposureLevel = options.alignExposureToMap && visibleMapExposureLevel
      ? visibleMapExposureLevel
      : rawExposureLevel === 'protected' && visibleMapExposureLevel && visibleMapExposureLevel !== 'protected'
      ? 'partial'
      : rawExposureLevel;
    const isExposed = exposureLevel
      ? exposureLevel !== 'protected'
      : options.context?.isExposed ?? directContext.isExposed ?? false;
    const score = getRoundedScore(options.score ?? directContext.score ?? weatherContext?.score);
    const rawCanClaimWindProtection = options.context?.canClaimWindProtection ?? directContext.canClaimWindProtection ?? weatherContext?.canClaimWindProtection;
    const canClaimWindProtection = exposureLevel === 'protected' && visibleMapExposureLevel !== 'exposed'
      ? alignsToMapProtected || rawCanClaimWindProtection === true
      : false;
    const seaCalmClaimAllowed = options.context?.seaCalmClaimAllowed ?? directContext.seaCalmClaimAllowed ?? weatherContext?.seaCalmClaimAllowed;
    const lessExposedToday = alignsToMapLessExposed
      ? true
      : options.alignExposureToMap && visibleMapExposureLevel === 'exposed'
      ? false
      : directContext.lessExposedToday;
    const rawWarnings = options.context?.warnings ?? directContext.warnings ?? weatherContext?.warnings;
    const cardWarnings = alignsToMapLessExposed
      ? rawWarnings?.filter(warning => warning.type !== 'exposed_to_wind')
      : rawWarnings;
    const simpleWindSuitability =
      options.context?.simpleWindSuitability ??
      directContext.simpleWindSuitability ??
      weatherContext?.simpleWindSuitability;
    const windSuitabilityText =
      options.context?.windExposureReason ??
      directContext.windExposureReason ??
      weatherContext?.windExposureReason ??
      describeSimpleWindSuitability(simpleWindSuitability, language);

    return (
      <BeachCard
        beach={{ ...beach, distance }}
        isExposed={isExposed}
        language={language}
        t={t}
        isCalm={seaCalmClaimAllowed === true}
        windSpeed={cardWindSpeed}
        temperature={cardTemperature}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        islandName={islandCardName}
        regionId={selectedIsland?.id}
        onClick={() => onBeachClick(beach)}
        todayScore={score}
        variant="decision"
        density={options.density}
        recommendationRank={options.recommendationRank}
        recommendationLabel={options.recommendationLabel}
        bestBeachTime={options.context?.bestBeachTime ?? directContext.bestBeachTime ?? weatherContext?.bestBeachTime}
        bestSwimWindow={options.context?.bestTimeWindow ?? directContext.bestTimeWindow ?? weatherContext?.bestTimeWindow}
        topPickTimeLabel={options.topPickTimeLabel}
        selectedDate={selectedDate}
        showIslandName={!selectedIsland}
        exposureLevel={exposureLevel}
        waveHeightM={options.context?.waveHeightM ?? directContext.waveHeightM ?? weatherContext?.waveHeightM}
        warnings={cardWarnings}
        confidence={options.context?.confidence ?? directContext.confidence ?? weatherContext?.confidence}
        swimmingComfort={options.context?.swimmingComfort ?? directContext.swimmingComfort ?? weatherContext?.swimmingComfort}
        canClaimWindProtection={canClaimWindProtection}
        seaCalmClaimAllowed={seaCalmClaimAllowed}
        strongWindContext={strongWindContext}
        lessExposedToday={lessExposedToday}
        windSuitabilityText={options.windExposureMode ? undefined : windSuitabilityText}
        windSuitabilityColor={simpleWindSuitability?.suitabilityColor}
        windExposureMode={options.windExposureMode}
        showTodayScoreBadge={options.showTodayScoreBadge}
      />
    );
  };
  const highlightBeachOnMap = (beachId: number) => {
    if (!onActiveSuitableBeachChange || isCarouselScrollingRef.current) return;
    activeSuitableBeachIdRef.current = beachId;
    onActiveSuitableBeachChange(beachId, { resumeFollow: false });
  };
  const clearBeachHighlightOnMap = () => {
    if (!onActiveSuitableBeachChange || isCarouselScrollingRef.current) return;
    activeSuitableBeachIdRef.current = undefined;
    onActiveSuitableBeachChange(undefined, { resumeFollow: false });
  };
  const beachCardHoverProps = (beachId: number) => ({
    onMouseEnter: () => highlightBeachOnMap(beachId),
    onMouseLeave: clearBeachHighlightOnMap,
  });
  const handleDesktopFilterSelect = (item: DesktopFilterItem) => {
    if (item.kind === 'preference') {
      onCategorySelect(item.key);
      return;
    }

    onAdvancedFilterToggle?.(item.key);
  };
  const renderDesktopInlineFilterButton = (item: DesktopFilterItem) => {
    const count = getDesktopFilterDisplayCount(item);

    return (
      <button
        key={item.itemKey}
        type="button"
        onClick={() => handleDesktopFilterSelect(item)}
        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
          item.isActive
            ? 'border-[#007a83] bg-cyan-50 text-[#007a83] shadow-sm shadow-cyan-900/5'
            : 'border-white/70 bg-white/58 text-slate-600 hover:border-cyan-200 hover:bg-white/86 hover:text-slate-950'
        }`}
        aria-pressed={item.isActive}
      >
        <span className={item.isActive ? 'text-[#007a83]' : 'text-slate-500'}>
          {item.icon}
        </span>
        <span className="whitespace-nowrap">{item.label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className={`text-[11px] font-medium leading-none ${item.isActive ? 'text-[#007a83]' : 'text-slate-500'}`}>
            {count}
          </span>
        )}
      </button>
    );
  };
  const renderDesktopMenuFilterButton = (item: DesktopFilterItem) => {
    const count = getDesktopFilterDisplayCount(item);

    return (
      <button
        key={item.itemKey}
        type="button"
        role="option"
        aria-selected={item.isActive}
        onClick={() => handleDesktopFilterSelect(item)}
        className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
          item.isActive ? 'bg-cyan-50 text-[#007a83]' : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
        }`}
      >
        <span className={item.isActive ? 'text-[#007a83]' : 'text-slate-500'}>{item.icon}</span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="shrink-0 text-xs font-extrabold text-slate-500">{count}</span>
        )}
      </button>
    );
  };
  const renderDirectorySortControl = (
    ref: React.RefObject<HTMLDivElement | null>,
    className = 'relative min-w-[12.5rem]'
  ) => (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={() => setIsDirectorySortOpen(open => !open)}
        aria-haspopup="menu"
        aria-expanded={isDirectorySortOpen}
        className="inline-flex min-h-10 w-full items-center gap-2.5 rounded-full border border-cyan-300 bg-gradient-to-r from-cyan-50 via-white to-cyan-50/80 px-3 text-sm font-extrabold text-cyan-900 shadow-sm shadow-cyan-900/10 ring-1 ring-white/70 transition hover:border-cyan-400 hover:from-cyan-100 hover:to-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#007a83] shadow-sm ring-1 ring-cyan-100" aria-hidden="true">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-center">{activeDirectorySortLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#007a83] transition-transform ${isDirectorySortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isDirectorySortOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-full min-w-[14rem] overflow-hidden rounded-2xl border border-cyan-100 bg-white/96 p-1.5 shadow-xl shadow-sky-900/14 ring-1 ring-white/70 backdrop-blur-xl"
        >
          {directorySortOptions.map(option => (
            <button
              key={option.key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={option.isActive}
              onClick={() => {
                if (option.isDisabled) return;
                option.onSelect();
              }}
              disabled={option.isDisabled}
              className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                option.isActive
                  ? 'bg-cyan-50 text-[#007a83]'
                  : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
              } ${option.isDisabled ? 'cursor-wait opacity-65' : ''
              }`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.isActive && <Check className="h-4 w-4 shrink-0 text-[#007a83]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="relative isolate overflow-hidden bg-sky-50 text-slate-950" aria-label={copy.beachSearchAria}>
      <div
        className="fixed inset-0 -z-10 bg-sky-100 bg-cover bg-center"
        style={heroBackground ? { backgroundImage: heroBackground } : undefined}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-white/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/24 via-transparent to-white/12" />
      </div>

      <div className="relative mx-auto max-w-[110rem] px-4 pb-4 pt-6 sm:px-5 lg:px-6">
        <section className="mx-auto w-full max-w-[110rem] overflow-visible rounded-[1.5rem] border border-white/60 bg-white/76 p-3 shadow-xl shadow-slate-950/14 ring-1 ring-white/35 backdrop-blur-xl sm:p-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setIsSearchSuggestionsOpen(false);
            setActiveSearchSuggestionIndex(-1);
            onSearchSubmit();
          }}
        >
          <nav className="order-2 hidden min-w-0 overflow-visible border-t border-slate-200/80 pt-3 lg:block" aria-label={copy.beachFiltersAria}>
            <div
              ref={desktopFilterMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible flex h-0 w-full flex-nowrap items-center gap-2 overflow-hidden"
            >
              {desktopFilterItems.map(renderDesktopInlineFilterButton)}
            </div>
            <div ref={desktopFilterRowRef} className="flex w-full min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-visible">
              <div className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pr-1">
                {desktopVisibleFilterItems.map(renderDesktopInlineFilterButton)}
              </div>
              {hasVisibleDesktopMoreFilters && (
                <div ref={desktopMoreFiltersRef} className="relative w-[13.5rem] max-w-[38%] shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsDesktopMoreFiltersOpen(open => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isDesktopMoreFiltersOpen}
                    className={`inline-flex min-h-9 w-full max-w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-dashed px-3 py-1.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                      desktopMoreActiveCount > 0
                        ? 'border-[#007a83] bg-cyan-50/80 text-[#007a83] shadow-sm shadow-cyan-900/5'
                        : 'border-slate-300/80 bg-white/42 text-slate-500 hover:border-cyan-200 hover:bg-white/78 hover:text-slate-800'
                    }`}
                  >
                    <MoreHorizontal className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{copy.more}</span>
                    {desktopMoreActiveCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#007a83] px-1.5 text-[11px] font-extrabold text-white">
                        {desktopMoreActiveCount}
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isDesktopMoreFiltersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {isDesktopMoreFiltersOpen && (
                    <div
                      role="listbox"
                      className="absolute right-0 top-full z-50 mt-2 w-[min(36rem,calc(100vw-4rem))] rounded-2xl border border-cyan-100 bg-white/96 p-2 shadow-xl shadow-sky-900/16 ring-1 ring-white/70 backdrop-blur-xl"
                    >
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {desktopHiddenFilterItems.map(renderDesktopMenuFilterButton)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>

          <label className="sr-only" htmlFor="directory-search">
            {searchPlaceholder}
          </label>
          <div className="order-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div ref={searchBoxRef} className="relative min-w-0 flex-1">
              <input
                id="directory-search"
                type="search"
                value={searchQuery}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={shouldRenderSearchSuggestions}
                aria-controls={searchSuggestionListId}
                aria-activedescendant={activeSearchSuggestionIndex >= 0 ? `${searchSuggestionListId}-${activeSearchSuggestionIndex}` : undefined}
                autoComplete="off"
                spellCheck={false}
                inputMode="search"
                onChange={(event) => {
                  onSearchChange(event.target.value);
                  setIsSearchSuggestionsOpen(true);
                  setActiveSearchSuggestionIndex(-1);
                }}
                onFocus={() => {
                  if (canShowSearchSuggestions) setIsSearchSuggestionsOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className="min-h-11 w-full rounded-[1.2rem] border border-slate-300 bg-white/92 px-5 pr-24 text-base font-medium text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 sm:rounded-full"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setIsSearchSuggestionsOpen(false);
                    setActiveSearchSuggestionIndex(-1);
                  }}
                  className="absolute right-11 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                  aria-label={language === 'gr' ? 'Καθαρισμός αναζήτησης' : 'Clear search'}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-[#007a83] text-white transition hover:bg-[#00646d] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                aria-label={copy.search}
              >
                <Search className="h-5 w-5" />
              </button>
              {shouldRenderSearchSuggestions && (
                <div
                  id={searchSuggestionListId}
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[80] overflow-hidden rounded-[1.1rem] border border-sky-100 bg-white/98 text-left shadow-xl shadow-sky-950/12 ring-1 ring-white/70 backdrop-blur-xl"
                >
                  {searchSuggestions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
                      {searchSuggestions.map((suggestion, index) => {
                        const isActive = index === activeSearchSuggestionIndex;
                        const suggestionKindLabel = suggestion.type === 'region' ? copy.searchRegionLabel : copy.searchBeachLabel;
                        return (
                          <button
                            key={suggestion.id}
                            id={`${searchSuggestionListId}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchSuggestionSelect(suggestion)}
                            className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[0.9rem] px-3 py-2 text-left transition ${
                              isActive ? 'bg-cyan-50 text-slate-950' : 'text-slate-800 hover:bg-sky-50'
                            }`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                              suggestion.type === 'region' ? 'bg-cyan-50 text-[#007a83]' : 'bg-sky-50 text-sky-700'
                            }`}>
                              {suggestion.type === 'region' ? (
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Waves className="h-4 w-4" aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-extrabold leading-tight text-slate-950">
                                {suggestion.label}
                              </span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight text-slate-500">
                                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-normal text-slate-500">
                                  {suggestionKindLabel}
                                </span>
                                <span className="min-w-0 truncate">{suggestion.subtitle}</span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm font-semibold text-slate-500">
                      {isSearchSuggesting ? copy.searchLoading : copy.searchNoResults}
                    </div>
                  )}
                  {isSearchSuggesting && searchSuggestions.length > 0 && (
                    <div className="border-t border-sky-50 px-4 py-2 text-xs font-bold text-[#007a83]">
                      {copy.searchLoading}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={`grid gap-2 sm:flex sm:items-center lg:flex-nowrap lg:justify-end ${onUseCurrentLocation ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {onUseCurrentLocation && (
                <button
                  type="button"
                  onClick={onUseCurrentLocation}
                  disabled={isFindingCurrentLocation}
                  className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 sm:px-4 lg:hidden ${
                    hasUserLocation
                      ? 'border-cyan-200 bg-cyan-50 text-[#007a83]'
                      : 'border-sky-200 bg-white/80 text-slate-900 hover:border-cyan-300 hover:bg-cyan-50'
                  } ${isFindingCurrentLocation ? 'cursor-wait opacity-70' : ''}`}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-[#007a83]" />
                  <span className="min-w-0 truncate">
                    {isFindingCurrentLocation && !hasUserLocation ? copy.findingLocation : copy.currentLocation}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenFilters}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#007a83] bg-white px-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 sm:px-4 lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4 text-[#007a83]" />
                <span>{copy.filter}</span>
                {typeof filteredResultCount === 'number' && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-50 px-1.5 text-[11px] font-extrabold leading-none text-[#007a83] ring-1 ring-cyan-100">
                    {filteredResultCount}
                  </span>
                )}
              </button>
              {selectedIsland && directorySortOptions.length > 0 && (
                renderDirectorySortControl(desktopDirectorySortRef, 'relative hidden w-[13.5rem] shrink-0 lg:block')
              )}
            </div>
            {currentLocationError && (
              <p className="text-xs font-semibold text-rose-600 sm:col-span-2" role="alert">
                {currentLocationError}
              </p>
            )}
          </div>

        </form>

        {selectedIsland && mapPreview && !isMobileViewport && (
          <section
            id="map-section"
            className="mt-4 border-t border-slate-200/80 pt-4"
            aria-label={copy.beachMapAria}
          >
            <div className="lg:grid lg:grid-cols-3 lg:items-stretch lg:gap-4">
              <div
                id="map-section-desktop"
                className="overflow-hidden rounded-[1.35rem] border border-sky-100 bg-white/68 p-3 text-left shadow-sm shadow-sky-900/8 ring-1 ring-white/45 backdrop-blur-md sm:p-4 lg:col-span-2"
              >
                <div>
                  {mapPreview}
                </div>
              </div>
              {conditionsOverviewContent && (
                <div className="mt-4 lg:col-span-1 lg:mt-0 lg:relative lg:min-h-0">
                  {conditionsOverviewContent}
                </div>
              )}
            </div>
          </section>
        )}

        {topBeachToday && !hasTopRecommendationView && (
          <section
            className="mt-4 border-t border-slate-200/80 pt-4"
            aria-label={topChoiceCopy.aria}
          >
            <div className="overflow-hidden rounded-[1.35rem] bg-white/54 text-left text-slate-950 ring-1 ring-white/50 lg:grid lg:grid-cols-2">
              <div className="flex h-full flex-col p-4 sm:p-5">
                <div className="min-w-0 space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-white/86 px-2.5 py-1 text-[11px] font-extrabold leading-none tracking-normal text-slate-900 shadow-sm">
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-white shadow-sm shadow-amber-900/15">
                      1
                    </span>
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {topChoiceCopy.badge}
                  </div>
                  <h2 className="text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">
                    {topBeachName}
                  </h2>
                  {topBeachShortReason && (
                    <p className="max-w-xl text-sm font-semibold leading-snug text-slate-600">
                      {topBeachShortReason}
                    </p>
                  )}
                </div>

                {topBeachTimeText && (
                  <div className="mt-4 flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2 text-sm font-semibold text-slate-800">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-[#007a83] ring-1 ring-cyan-100">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.68rem] font-bold leading-tight text-[#007a83]">
                        {visitTimeLabel}
                      </span>
                      <span className="block truncate text-sm font-extrabold leading-tight text-slate-950">
                        {topBeachTimeText}
                      </span>
                    </span>
                  </div>
                )}

                {topBeachHighlights.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:mt-5">
                    {topBeachHighlights.map(item => (
                      <div key={item.key} className="flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border border-sky-100 bg-white/72 px-3 py-2 text-sm font-semibold text-slate-700">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-50 text-[#007a83] ring-1 ring-cyan-100">
                          {item.icon}
                        </span>
                        <span className="min-w-0 leading-tight">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 lg:mt-auto lg:pt-4">
                  {topBeachCanNavigate && (
                  <button
                    type="button"
                    onClick={handleTopBeachNavigation}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-[#007a83] shadow-sm transition hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                    title={t.navigate}
                    aria-label={t.navigateToLabel(topBeachName)}
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onBeachClick(topBeachToday.beach)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white shadow-sm shadow-cyan-700/15 transition hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 sm:flex-none"
                  >
                    <Info className="h-4 w-4" />
                    {t.learnMore}
                  </button>
                </div>
              </div>

              <div className="relative min-h-[13.5rem] overflow-hidden border-t border-white/60 bg-sky-100 lg:min-h-[24rem] lg:border-l lg:border-t-0">
                {topBeachPhoto ? (
                  <img
                    src={topBeachPhoto}
                    alt={topBeachName}
                    className="absolute inset-0 h-full w-full object-cover"
                    width={640}
                    height={420}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-sky-50 to-emerald-50" />
                    <div
                      className="absolute inset-0 opacity-70"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(14,116,144,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(14,116,144,0.12) 1px, transparent 1px)',
                        backgroundSize: '34px 34px',
                      }}
                      aria-hidden="true"
                    />
                    <svg className="absolute inset-0 h-full w-full text-cyan-600/18" viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0 132 C55 118 89 143 142 130 C192 118 220 90 274 98 C322 105 347 136 400 122 L400 220 L0 220 Z" fill="currentColor" />
                      <path d="M36 54 C86 74 125 63 170 80 C214 96 251 128 335 110" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 10" />
                      <path d="M-20 24 C55 46 105 28 160 44 C215 60 260 42 420 64" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
                    </svg>
                    <div className="absolute inset-0 bg-gradient-to-t from-white/50 via-white/12 to-white/10" aria-hidden="true" />
                    <div className="absolute left-4 top-4">
                      <span className="inline-flex min-h-8 items-center rounded-full border border-cyan-100/90 bg-white/76 px-3 text-[11px] font-extrabold leading-none text-cyan-800 shadow-sm shadow-sky-900/10 backdrop-blur-md">
                        {topPhotoSoonLabel}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {selectedIsland && mapPreview && isMobileViewport && (
          <section
            id="map-section"
            className="mt-4 border-t border-slate-200/80 pt-4"
            aria-label={copy.beachMapAria}
          >
            <div className="overflow-hidden rounded-[1.35rem] border border-sky-100 bg-white/68 p-2 text-left shadow-sm shadow-sky-900/8 ring-1 ring-white/45 backdrop-blur-md">
              {mapPreview}
            </div>
          </section>
        )}
        </section>
      </div>

      {hasBelowHeroContent && (
      <div className="relative">
        <div className="mx-auto max-w-[110rem] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pb-5 lg:px-6">
          {selectedIsland && hasTopRecommendationView && (
            <section id="top-recommendations-section" className="mb-5">
              <div className="mb-3 flex items-center gap-3 px-1 lg:px-5">
                <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
                <div className="max-w-full shrink-0 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-center shadow-sm shadow-sky-900/10 ring-1 ring-white/50 backdrop-blur-md">
                  <h2 className="truncate text-xs font-extrabold leading-none tracking-normal text-slate-800 sm:text-sm">
                    {topRecommendationsLabel}
                  </h2>
                </div>
                <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
              </div>

              <div
                ref={topRecommendationsCarouselRef}
                className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain pb-5 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none lg:snap-none lg:px-5"
              >
                {topRecommendationBeachCards.map(({ beach, score, context }, index) => (
                  <div key={beach.id} data-suitable-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className="w-[19rem] shrink-0 snap-start sm:w-[20rem]">
                    {renderBeachDecisionCard(beach as BeachCardContext, {
                      score,
                      context,
                      recommendationRank: index + 1,
                      showTodayScoreBadge: false,
                      alignExposureToMap: true,
                      windExposureMode: 'none',
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(!selectedIsland || isDirectorySuitableView) && (
          <>
          <div id={selectedIsland ? 'suitable-beaches-section' : undefined} className="mb-3 flex items-center gap-3 px-1 lg:px-5">
            <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
            <div className="max-w-full shrink-0 rounded-full border border-white/80 bg-white/86 px-3 py-1.5 text-center shadow-sm shadow-sky-900/10 ring-1 ring-white/50 backdrop-blur-md">
              <h2 className="truncate text-xs font-extrabold leading-none tracking-normal text-slate-700 sm:text-sm">
                {selectedIsland ? withCount(suitableSectionLabel, suitableBeachDisplayCount) : copy.popularDestinations}
              </h2>
            </div>
            <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
          </div>

          <div
            ref={suitableCarouselRef}
            className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain pb-5 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none lg:snap-none lg:px-5"
          >
            {selectedIsland ? (
              weatherBeachCards.map(({ beach, score, context }, index) => (
                <div key={beach.id} data-suitable-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className="w-[19rem] shrink-0 snap-start sm:w-[20rem]">
                  {renderBeachDecisionCard(beach as BeachCardContext, {
                    score,
                    context,
                    recommendationRank: hasTopRecommendationView ? undefined : weatherBeachCardRankStart + index,
                    showTodayScoreBadge: false,
                    alignExposureToMap: true,
                    windExposureMode: 'none',
                  })}
                </div>
              ))
            ) : (
              sortedIslandCards.map(island => {
                const title = island.name[language];
                const features = getIslandFeatureLabels(island, language);
                const destinationCardPhoto = getIslandDestinationPhoto(island.id, 'card');

                if (!destinationCardPhoto) {
                  return (
                    <button
                      key={island.id}
                      type="button"
                      onClick={() => onSelectIsland(island)}
                      className="group w-[13rem] shrink-0 snap-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 sm:w-[14rem]"
                    >
                      <div className="relative h-[18.2rem] overflow-hidden rounded-lg bg-sky-100 shadow-md shadow-slate-900/12 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                        <BeachImageFallback label={copy.photoSoon} />
                      </div>
                      <div className="mt-3 space-y-1 rounded-2xl border border-white/65 bg-white/72 px-3 py-2.5 shadow-sm shadow-slate-900/8 backdrop-blur-md">
                        <h3 className="truncate text-lg font-bold leading-tight text-[#007a83]">
                          {copy.islandTitle(title)}
                        </h3>
                        <p className="text-sm font-semibold text-slate-900">
                          {copy.beachCount(island.beaches.length)}
                        </p>
                        {features.length > 0 && (
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-700">
                            {features.join(' · ')}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                }

                return (
                  <div
                    key={island.id}
                    className="group w-[13rem] shrink-0 snap-start text-left sm:w-[14rem]"
                  >
                    <div
                      className="relative h-[18.2rem] overflow-hidden rounded-lg bg-sky-100 shadow-md shadow-slate-900/12 transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
                    >
                      <CuratedPhotoImage
                        photo={destinationCardPhoto}
                        className="absolute inset-0"
                        imgClassName="h-full w-full object-cover"
                        showAttribution
                        attributionClassName="absolute bottom-2 right-2 z-20 max-w-[calc(100%-1rem)] rounded-full bg-slate-950/55 px-2 py-1 text-[10px] font-semibold leading-none text-white/92 shadow-sm backdrop-blur-sm [&_a]:text-white/92 [&_a]:underline-offset-2 hover:[&_a]:underline"
                      />
                      <button
                        type="button"
                        onClick={() => onSelectIsland(island)}
                        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        aria-label={copy.islandTitle(title)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectIsland(island)}
                      className="mt-3 w-full space-y-1 rounded-2xl border border-white/65 bg-white/72 px-3 py-2.5 text-left shadow-sm shadow-slate-900/8 backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
                    >
                      <h3 className="truncate text-lg font-bold leading-tight text-[#007a83]">
                        {copy.islandTitle(title)}
                      </h3>
                      <p className="text-sm font-semibold text-slate-900">
                        {copy.beachCount(island.beaches.length)}
                      </p>
                      {features.length > 0 && (
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-700">
                          {features.join(' · ')}
                        </p>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          </>
          )}


          {selectedIsland && !isMobileViewport && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0 && (
            <section id="all-beaches-section" className="mt-7 rounded-2xl border border-sky-200 bg-white/88 p-4 shadow-sm shadow-sky-900/5 backdrop-blur-md sm:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight text-slate-950">
                    {directoryTitle}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-extrabold text-[#007a83]">
                    {copy.beachCount(directoryDisplayBeachCards.length)}
                  </span>
                  {renderDirectorySortControl(directorySortRef, 'relative min-w-[12.5rem] lg:hidden')}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {directoryDisplayBeachCards.map(beach => (
                  <div key={beach.id} {...beachCardHoverProps(beach.id)}>
                    {renderBeachDecisionCard(beach, { alignExposureToMap: !isDirectorySuitableView, windExposureMode: 'simple' })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedIsland && isMobileViewport && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0 && (
            <section id="all-beaches-section" className="mt-3">
              <div className="mb-3 flex items-center gap-3 px-1">
                <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
                <div className="max-w-full shrink-0 rounded-full border border-white/80 bg-white/86 px-3 py-1.5 text-center shadow-sm shadow-sky-900/10 ring-1 ring-white/50 backdrop-blur-md">
                  <h2 className="truncate text-xs font-extrabold leading-none tracking-normal text-slate-700">
                    {withCount(directoryTitle, directoryDisplayBeachCards.length)}
                  </h2>
                </div>
                <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
              </div>

              <div
                ref={directoryCarouselRef}
                className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain pb-5 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none lg:snap-none"
              >
                {directoryDisplayBeachCards.map(beach => (
                  <div key={beach.id} data-directory-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className="w-[19rem] shrink-0 snap-start">
                    {renderBeachDecisionCard(beach, { alignExposureToMap: true, windExposureMode: 'simple' })}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      )}

      {selectedIsland && isMobileViewport && isWeatherPanelOpen && conditionsOverviewContent && (
        <div
          className="fixed inset-0 z-[1200] flex bg-sky-50 text-slate-950 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={weatherPanelTitle}
        >
          <div className="flex min-h-0 w-full flex-col">
            <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/96 px-4 py-3 shadow-sm shadow-sky-900/5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-extrabold leading-tight text-[#007a83]">
                    Calm Beach Greece
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeatherPanelOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4">
              {conditionsOverviewContent}
            </div>
          </div>
        </div>
      )}

      {selectedIsland && isMobileViewport && isAllBeachesPanelOpen && (
        <div
          className="fixed inset-0 z-[1200] flex bg-sky-50 text-slate-950 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={copy.allOtherBeaches}
        >
          <div className="flex min-h-0 w-full flex-col">
            <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/96 px-4 py-3 shadow-sm shadow-sky-900/5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-extrabold leading-tight text-slate-950">
                    {directoryTitle}
                  </h2>
                  <p className="mt-0.5 text-xs font-bold text-[#007a83]">
                    {copy.beachCount(directoryDisplayBeachCards.length)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllBeachesPanelOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAllBeachesPanelOpen(false);
                    onOpenFilters();
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 text-sm font-extrabold text-[#007a83] transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {copy.filter}
                  {typeof filteredResultCount === 'number' && (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-black leading-none text-[#007a83] ring-1 ring-cyan-100">
                      {filteredResultCount}
                    </span>
                  )}
                </button>
                {renderDirectorySortControl(directorySortRef, 'relative min-w-[9.75rem]')}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4">
              <div className="space-y-4">
                {mapPreview && (
                  <div className="overflow-hidden rounded-[1.35rem] border border-sky-100 bg-white/68 p-2 text-left shadow-sm shadow-sky-900/8 ring-1 ring-white/45 backdrop-blur-md">
                    {mapPreview}
                  </div>
                )}

                {directoryDisplayBeachCards.length > 0 ? (
                  <div
                    ref={directoryCarouselRef}
                    className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain pb-5 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none lg:snap-none"
                  >
                    {directoryDisplayBeachCards.map(beach => (
                      <div key={beach.id} data-directory-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className="w-[19rem] shrink-0 snap-start">
                        {renderBeachDecisionCard(beach, { alignExposureToMap: !isDirectorySuitableView, windExposureMode: 'simple' })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-sky-100 bg-white/88 px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm shadow-sky-900/5">
                    {getLocalizedCopy(language, {
                      en: 'No beaches match these filters.',
                      gr: 'Δεν βρέθηκαν παραλίες με αυτά τα φίλτρα.',
                      fr: 'Aucune plage ne correspond à ces filtres.',
                      de: 'Keine Strände passen zu diesen Filtern.',
                      it: 'Nessuna spiaggia corrisponde a questi filtri.',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
