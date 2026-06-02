import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Droplets,
  Footprints,
  Info,
  Layers,
  MapPin,
  Mountain,
  Navigation,
  ParkingCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Thermometer,
  Trees,
  Umbrella,
  Utensils,
  Users,
  VolumeX,
  Waves,
  Wind,
} from 'lucide-react';
import type { Beach, DailyForecast, FilterKey, Island, LanguageCode, SortOption, SuitableBeach, Translation, UserPreferences, WindDirection } from '../types';
import { getLocalizedCopy, languageToDateLocale, languageToLocale, type SupportedLanguage } from '../utils/i18n';
import { displayBeachName } from '../utils/localization';
import { getAmenityChips } from '../utils/amenities';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { trackEvent } from '../services/analyticsService';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import {
  getPreferenceFilterLabel,
  QUICK_PREFERENCE_FILTERS,
  type QuickPreferenceFilter,
} from '../utils/preferenceFilterLabels';
import { getBeachFilterDirectoryTitle } from '../utils/filterSummary';
import { openNavigation } from '../utils/navigation';
import { WeatherSummary } from './WeatherSummary';
import { BeachCard } from './BeachCard';
import { CuratedPhotoImage } from '../src/components/photos';
import { getIslandDestinationPhoto } from '../src/data/destinationPhotoAdapter';

export type DirectoryCategory = 'all' | QuickPreferenceFilter;

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
};

interface BeachSearcherHomeProps {
  language: SupportedLanguage;
  selectedIsland: Island | null;
  allIslands: Island[];
  searchQuery: string;
  activeCategory: DirectoryCategory;
  sortBy: SortOption;
  preferences: UserPreferences;
  activeFilters?: FilterKey[];
  filterResultCounts?: Partial<Record<keyof UserPreferences, number>>;
  advancedFilterResultCounts?: Partial<Record<FilterKey, number>>;
  sortResultCounts?: Partial<Record<SortOption, number>>;
  filteredResultCount?: number;
  protectedSortLabel?: string;
  islandBackground?: string;
  mapPreview?: React.ReactNode;
  suitableBeachCards?: SuitableBeach[];
  allBeachCards?: BeachCardContext[];
  beachWeatherContexts?: SuitableBeach[];
  topBeachToday?: SuitableBeach | null;
  topBeachDescription?: string;
  topBeachTimingLabel?: string;
  conditionSummaryText?: string;
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
  onOpenFilters: () => void;
  onOpenIslandSelector: () => void;
  onCategorySelect: (category: DirectoryCategory) => void;
  onSortChange: (sort: SortOption) => void;
  onAdvancedFilterToggle?: (filter: FilterKey) => void;
  onForecastDaySelect?: (index: number) => void;
  onBeachClick: (beach: Beach) => void;
  onSelectIsland: (island: Island) => void;
  strongWindContext?: boolean;
}

const SandIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 16c3-3 6-3 9 0s6 3 9 0" />
    <path d="M5 20c2-1.5 4-1.5 6 0s4 1.5 6 0" />
    <path d="M7 11h.01" />
    <path d="M12 8h.01" />
    <path d="M17 11h.01" />
  </svg>
);

const filterIcons: Partial<Record<QuickPreferenceFilter, React.ReactNode>> = {
  sandy: <SandIcon />,
  pebbles: <Mountain className="h-5 w-5" />,
  quiet: <VolumeX className="h-5 w-5" />,
  beachBar: <BadgeCheck className="h-5 w-5" />,
  easyAccess: <MapPin className="h-5 w-5" />,
  snorkeling: <Search className="h-5 w-5" />,
  familyFriendly: <Users className="h-5 w-5" />,
  deepWater: <Waves className="h-5 w-5" />,
  shallowWater: <Droplets className="h-5 w-5" />,
};

const desktopAdvancedFilters: Array<{ key: FilterKey; icon: React.ReactNode }> = [
  { key: 'naturalShade', icon: <Trees className="h-5 w-5" /> },
  { key: 'taverna', icon: <Utensils className="h-5 w-5" /> },
  { key: 'sunbeds', icon: <Umbrella className="h-5 w-5" /> },
  { key: 'parking', icon: <ParkingCircle className="h-5 w-5" /> },
  { key: 'sandy-pebbles', icon: <Layers className="h-5 w-5" /> },
  { key: 'rocky', icon: <Mountain className="h-5 w-5" /> },
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
const desktopAdvancedFilterKeySet = new Set<FilterKey>(desktopAdvancedFilters.map(filter => filter.key));

type HomeCopy = {
  greece: string;
  searchPlaceholder: string;
  fallbackFeatureCopy: string;
  more: string;
  changeIsland: string;
  search: string;
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
    goodScore: string;
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
    searchPlaceholder: 'Location or beach name',
    fallbackFeatureCopy: 'Beaches, map and quick filters',
    more: 'More',
    changeIsland: 'Change island or area',
    search: 'Search',
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
    allOtherBeaches: 'All other beaches',
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
      goodScore: 'Good overall score',
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
    searchPlaceholder: 'Τοποθεσία ή όνομα παραλίας',
    fallbackFeatureCopy: 'Παραλίες, χάρτης και γρήγορα φίλτρα',
    more: 'Περισσότερα',
    changeIsland: 'Άλλο νησί ή περιοχή',
    search: 'Αναζήτηση',
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
    allOtherBeaches: 'Όλες οι υπόλοιπες παραλίες',
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
      easyAccess: 'Εύκολα',
      goodScore: 'Καλό συνολικό σκορ',
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
    searchPlaceholder: 'Lieu ou nom de plage',
    fallbackFeatureCopy: 'Plages, carte et filtres rapides',
    more: 'Plus',
    changeIsland: "Changer d'île ou de région",
    search: 'Rechercher',
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
    allOtherBeaches: 'Toutes les autres plages',
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
      goodScore: 'Bon score global',
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
    searchPlaceholder: 'Ort oder Strandname',
    fallbackFeatureCopy: 'Strände, Karte und Schnellfilter',
    more: 'Mehr',
    changeIsland: 'Insel oder Region wechseln',
    search: 'Suchen',
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
    allOtherBeaches: 'Alle weiteren Strände',
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
      goodScore: 'Guter Gesamtscore',
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
    searchPlaceholder: 'Località o nome spiaggia',
    fallbackFeatureCopy: 'Spiagge, mappa e filtri rapidi',
    more: 'Altro',
    changeIsland: 'Cambia isola o regione',
    search: 'Cerca',
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
    allOtherBeaches: 'Tutte le altre spiagge',
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
      goodScore: 'Buon punteggio generale',
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

const getBeachFeatureLabels = (beach: Beach, language: LanguageCode): string[] => {
  const copy = getLocalizedCopy(language, homeCopy).beachFeatures;
  const labels: string[] = [];

  if (beach.beachType === 'sandy') labels.push(copy.sandy);
  if (beach.beachType === 'pebbles') labels.push(copy.pebbles);
  if (beach.beachType === 'sandy-pebbles') labels.push(copy.sandPebbles);
  if (beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.organized) labels.push(copy.amenities);
  if (beach.amenities?.naturalShade) labels.push(copy.naturalShade);
  if (beach.environment?.quiet) labels.push(copy.quiet);
  if (beach.activities?.snorkeling) labels.push(copy.snorkeling);

  return labels.slice(0, 3);
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

const formatDirectoryDate = (date: Date, language: LanguageCode) =>
  new Intl.DateTimeFormat(languageToDateLocale(language), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);

const formatUpdatedAgo = (lastUpdated: Date | null | undefined, language: LanguageCode) => {
  if (!lastUpdated) return undefined;

  const copy = getLocalizedCopy(language, homeCopy);
  const minutes = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
  if (minutes < 1) return copy.updatedJustNow;
  if (minutes < 60) return copy.updatedMinutes(minutes);
  const hours = Math.round(minutes / 60);
  return copy.updatedHours(hours);
};

const getSeaConditionCopy = (waveHeightM: number | undefined, language: LanguageCode) => {
  const copy = getLocalizedCopy(language, homeCopy).sea;
  if (typeof waveHeightM !== 'number' || !Number.isFinite(waveHeightM)) {
    return {
      label: copy.label,
      value: copy.mild,
      detail: copy.missingDetail,
    };
  }

  if (waveHeightM < 0.4) {
    return {
      label: copy.label,
      value: copy.calm,
      detail: `${waveHeightM.toFixed(1)} m`,
    };
  }

  if (waveHeightM < 0.8) {
    return {
      label: copy.label,
      value: copy.moderate,
      detail: `${waveHeightM.toFixed(1)} m`,
    };
  }

  if (waveHeightM < 1.2) {
    return {
      label: copy.label,
      value: copy.choppy,
      detail: `${waveHeightM.toFixed(1)} m`,
    };
  }

  return {
    label: copy.label,
    value: copy.rough,
    detail: `${waveHeightM.toFixed(1)} m`,
  };
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

  if (signals.length === 0) {
    signals.push({
      label: copy.goodScore,
      icon: <Star className="h-5 w-5" />,
    });
  }

  return signals.slice(0, 3);
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

export const BeachSearcherHome: React.FC<BeachSearcherHomeProps> = ({
  language,
  selectedIsland,
  allIslands,
  searchQuery,
  activeCategory,
  sortBy,
  preferences,
  activeFilters = [],
  filterResultCounts,
  advancedFilterResultCounts,
  sortResultCounts,
  filteredResultCount,
  protectedSortLabel,
  islandBackground,
  mapPreview,
  suitableBeachCards,
  allBeachCards,
  beachWeatherContexts,
  topBeachToday,
  topBeachDescription,
  topBeachTimingLabel,
  conditionSummaryText,
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
  onOpenFilters,
  onOpenIslandSelector,
  onCategorySelect,
  onSortChange,
  onAdvancedFilterToggle,
  onForecastDaySelect,
  onBeachClick,
  onSelectIsland,
  strongWindContext = false,
}) => {
  const copy = getLocalizedCopy(language, homeCopy);
  const [isDirectorySortOpen, setIsDirectorySortOpen] = useState(false);
  const directorySortRef = useRef<HTMLDivElement>(null);
  const [isDesktopMoreFiltersOpen, setIsDesktopMoreFiltersOpen] = useState(false);
  const desktopMoreFiltersRef = useRef<HTMLDivElement>(null);
  const activePlaceName = selectedIsland?.name[language] || copy.greece;
  const placeFeatureLabels = selectedIsland ? getIslandFeatureLabels(selectedIsland, language) : [];
  const hasActivePreference = QUICK_PREFERENCE_FILTERS.some(key => preferences[key]);
  const hasActiveAdvancedFilter = activeFilters.some(filter => filter !== 'showAll');
  const heroBackground = getImageSet(islandBackground);
  const desktopMoreActiveCount = desktopSecondaryPreferenceFilters.filter(filter => preferences[filter]).length +
    activeFilters.filter(filter => filter !== 'showAll' && desktopAdvancedFilterKeySet.has(filter)).length;

  const sortedIslandCards = useMemo(() => (
    [...allIslands]
      .filter(island => island.beaches.length > 0)
      .sort((a, b) => b.beaches.length - a.beaches.length)
      .slice(0, 8)
  ), [allIslands]);

  const popularBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    return [...selectedIsland.beaches]
      .sort((a, b) => {
        const aPhoto = getBeachPhotoLookup(a.name.gr, a.name.en, a.id, 1, selectedIsland.name[language]).source === 'exact';
        const bPhoto = getBeachPhotoLookup(b.name.gr, b.name.en, b.id, 1, selectedIsland.name[language]).source === 'exact';
        if (aPhoto !== bPhoto) return bPhoto ? 1 : -1;

        const left = (b.popularityScore || 0) + (b.rating || 0) * 12;
        const right = (a.popularityScore || 0) + (a.rating || 0) * 12;
        return left - right;
      })
      .slice(0, 8);
  }, [language, selectedIsland]);
  const weatherBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    if (suitableBeachCards && suitableBeachCards.length > 0) {
      return suitableBeachCards.slice(0, 8).map(item => ({
        beach: item.beach,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        context: item,
      }));
    }

    return popularBeachCards.map(beach => ({ beach, score: undefined, context: undefined }));
  }, [popularBeachCards, selectedIsland, suitableBeachCards]);
  const directoryAllBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    return allBeachCards && allBeachCards.length > 0 ? allBeachCards : selectedIsland.beaches;
  }, [allBeachCards, selectedIsland]);
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

  const searchPlaceholder = copy.searchPlaceholder;
  const fallbackFeatureCopy = copy.fallbackFeatureCopy;
  const desktopFeatureCopy = placeFeatureLabels.length > 0
    ? placeFeatureLabels.join(' · ')
    : fallbackFeatureCopy;
  const mobileFeatureCopy = placeFeatureLabels.length > 0
    ? placeFeatureLabels.slice(0, 2).join(' · ')
    : fallbackFeatureCopy;
  const topBeachName = topBeachToday ? displayBeachName(topBeachToday.beach.name, language) : '';
  const topBeachSignals = topBeachToday ? getTopBeachSignals(topBeachToday, language) : [];
  const topBeachTimeText = topBeachToday
    ? topBeachTimingLabel || topBeachToday.bestTimeWindow
    : undefined;
  const topBeachAmenityChips = topBeachToday
    ? getAmenityChips(topBeachToday.beach, language)
      .filter(chip => chip.key !== 'unknownFacilities')
      .slice(0, 4)
    : [];
  const topBeachHighlights = topBeachToday
    ? [
      ...topBeachSignals.map((signal, index) => ({
        key: `signal-${index}-${signal.label}`,
        label: signal.label,
      })),
      ...(topBeachTimeText ? [{ key: 'best-time', label: topBeachTimeText }] : []),
      ...topBeachAmenityChips.map(chip => ({
        key: `amenity-${chip.key}`,
        label: chip.label,
      })),
    ]
    : [];
  const topBeachPhoto = topBeachToday
    ? getBeachPhotoLookup(topBeachToday.beach.name.gr, topBeachToday.beach.name.en, topBeachToday.beach.id, 1, selectedIsland?.name[language]).photos[0]
    : undefined;
  const handleTopBeachNavigation = () => {
    if (!topBeachToday) return;

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
  const updatedLabel = formatUpdatedAgo(lastUpdated, language);
  const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined;
  const localizedWindDirection = windDirection
    ? t.windDirections[windDirection as WindDirection] || windDirection
    : undefined;
  const windKmh = selectedForecast ? Math.round(selectedForecast.wind.speed * 3.6) : undefined;
  const windBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : undefined;
  const gustKmh = selectedForecast?.wind.gust ? Math.round(selectedForecast.wind.gust * 3.6) : undefined;
  const seaCondition = getSeaConditionCopy(selectedForecast?.marine?.waveHeightM, language);
  const conditionItems = selectedForecast ? [
    {
      key: 'wind',
      icon: <Wind className="h-6 w-6" />,
      label: copy.conditions.wind,
      value: `${localizedWindDirection || ''} ${windKmh ?? 0} km/h`.trim(),
      detail: windBeaufort ? `${windBeaufort} ${copy.conditions.beaufortUnit}` : undefined,
    },
    {
      key: 'sea',
      icon: <Waves className="h-6 w-6" />,
      label: seaCondition.label,
      value: seaCondition.value,
      detail: seaCondition.detail,
    },
    {
      key: 'air',
      icon: <Thermometer className="h-6 w-6" />,
      label: t.temperatureLabel || copy.conditions.air,
      value: `${Math.round(selectedForecast.temp_max)}°C`,
      detail: copy.conditions.high,
    },
    {
      key: 'gust',
      icon: <Droplets className="h-6 w-6" />,
      label: copy.conditions.gusts,
      value: gustKmh ? `${gustKmh} km/h` : copy.conditions.noStrongSignal,
      detail: gustKmh ? copy.conditions.maxGust : undefined,
    },
  ] : [];
  const withDirectoryCount = (label: string, count?: number) => (
    typeof count === 'number' ? `${label} (${count})` : label
  );
  const directorySortOptions: Array<{
    key: SortOption | 'easyAccess';
    label: string;
    isActive: boolean;
    onSelect: () => void;
  }> = [
    {
      key: 'all',
      label: withDirectoryCount(t.sortByAll, sortResultCounts?.all ?? directoryAllBeachCards.length),
      isActive: sortBy === 'all' && !preferences.easyAccess && !hasActiveAdvancedFilter,
      onSelect: () => onCategorySelect('all'),
    },
    {
      key: 'protected',
      label: withDirectoryCount(protectedSortLabel ?? t.sortByProtected, sortResultCounts?.protected),
      isActive: sortBy === 'protected',
      onSelect: () => onSortChange('protected'),
    },
    {
      key: 'rating',
      label: t.sortByTopRated,
      isActive: sortBy === 'rating',
      onSelect: () => onSortChange('rating'),
    },
    {
      key: 'distance',
      label: t.sortByDistance,
      isActive: sortBy === 'distance',
      onSelect: () => onSortChange('distance'),
    },
    {
      key: 'easyAccess',
      label: withDirectoryCount(getPreferenceFilterLabel('easyAccess', language, t), filterResultCounts?.easyAccess),
      isActive: preferences.easyAccess,
      onSelect: () => {
        if (!preferences.easyAccess) onCategorySelect('easyAccess');
      },
    },
  ];
  const activeDirectorySortOption = directorySortOptions.find(option => option.isActive) || directorySortOptions[0];
  const activeDirectorySortLabel = activeDirectorySortOption.key === 'all'
    ? copy.sort
    : activeDirectorySortOption.label;

  useEffect(() => {
    if (!isDirectorySortOpen && !isDesktopMoreFiltersOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (isDirectorySortOpen && !directorySortRef.current?.contains(target)) {
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
    } = {}
  ) => {
    const directContext = beach as BeachCardContext;
    const weatherContext = options.context || weatherContextByBeachId.get(beach.id);
    const distance = directContext.distance ?? weatherContext?.distance;
    const exposureLevel = options.context?.exposureLevel ?? directContext.exposureLevel ?? weatherContext?.exposureLevel;
    const isExposed = options.context?.isExposed ?? directContext.isExposed ?? (exposureLevel ? exposureLevel !== 'protected' : false);
    const score = getRoundedScore(options.score ?? directContext.score ?? weatherContext?.score);
    const canClaimWindProtection = options.context?.canClaimWindProtection ?? directContext.canClaimWindProtection ?? weatherContext?.canClaimWindProtection;
    const seaCalmClaimAllowed = options.context?.seaCalmClaimAllowed ?? directContext.seaCalmClaimAllowed ?? weatherContext?.seaCalmClaimAllowed;

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
        warnings={options.context?.warnings ?? directContext.warnings ?? weatherContext?.warnings}
        confidence={options.context?.confidence ?? directContext.confidence ?? weatherContext?.confidence}
        swimmingComfort={options.context?.swimmingComfort ?? directContext.swimmingComfort ?? weatherContext?.swimmingComfort}
        canClaimWindProtection={canClaimWindProtection}
        seaCalmClaimAllowed={seaCalmClaimAllowed}
        strongWindContext={strongWindContext}
        lessExposedToday={directContext.lessExposedToday}
      />
    );
  };

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

      <div className="relative mx-auto max-w-[84rem] px-4 pb-4 pt-6 sm:px-5 lg:px-6">
        <section className="mx-auto w-full max-w-[84rem] overflow-visible rounded-[1.5rem] border border-white/60 bg-white/76 p-3 shadow-xl shadow-slate-950/14 ring-1 ring-white/35 backdrop-blur-xl sm:p-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <nav className="order-2 hidden border-b border-slate-200/80 pb-3 lg:block" aria-label={copy.beachFiltersAria}>
            <div className="flex min-w-full flex-wrap items-center gap-2">
              {desktopPrimaryPreferenceFilters.map(filter => {
                const isActive = preferences[filter];
                const count = filterResultCounts?.[filter];
                const label = getPreferenceFilterLabel(filter, language, t);
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => onCategorySelect(filter)}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                      isActive
                        ? 'border-[#007a83] bg-cyan-50 text-[#007a83] shadow-sm shadow-cyan-900/5'
                        : 'border-white/70 bg-white/58 text-slate-600 hover:border-cyan-200 hover:bg-white/86 hover:text-slate-950'
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className={isActive ? 'text-[#007a83]' : 'text-slate-500'}>
                      {filterIcons[filter]}
                    </span>
                    <span className="whitespace-nowrap">{label}</span>
                    {typeof count === 'number' && (
                      <span className={`text-[11px] font-extrabold leading-none ${isActive ? 'text-[#007a83]' : 'text-slate-500'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              <div ref={desktopMoreFiltersRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsDesktopMoreFiltersOpen(open => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={isDesktopMoreFiltersOpen}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                    desktopMoreActiveCount > 0
                      ? 'border-[#007a83] bg-cyan-50 text-[#007a83] shadow-sm shadow-cyan-900/5'
                      : 'border-white/70 bg-white/58 text-slate-600 hover:border-cyan-200 hover:bg-white/86 hover:text-slate-950'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>{copy.more}</span>
                  {desktopMoreActiveCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#007a83] px-1.5 text-[11px] font-extrabold text-white">
                      {desktopMoreActiveCount}
                    </span>
                  )}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isDesktopMoreFiltersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                {isDesktopMoreFiltersOpen && (
                  <div
                    role="listbox"
                    className="absolute right-0 top-full z-50 mt-2 w-[min(36rem,calc(100vw-4rem))] rounded-2xl border border-cyan-100 bg-white/96 p-2 shadow-xl shadow-sky-900/16 ring-1 ring-white/70 backdrop-blur-xl"
                  >
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {desktopSecondaryPreferenceFilters.map(filter => {
                        const isActive = preferences[filter];
                        const count = filterResultCounts?.[filter];
                        const label = getPreferenceFilterLabel(filter, language, t);
                        return (
                          <button
                            key={filter}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => onCategorySelect(filter)}
                            className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                              isActive ? 'bg-cyan-50 text-[#007a83]' : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
                            }`}
                          >
                            <span className={isActive ? 'text-[#007a83]' : 'text-slate-500'}>{filterIcons[filter]}</span>
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {typeof count === 'number' && <span className="shrink-0 text-xs font-extrabold text-slate-500">{count}</span>}
                          </button>
                        );
                      })}

                      {desktopAdvancedFilters.map(filter => {
                        const isActive = activeFilters.includes(filter.key);
                        const count = advancedFilterResultCounts?.[filter.key];
                        const label = t.filterOptions[filter.key as keyof typeof t.filterOptions] || String(filter.key);
                        return (
                          <button
                            key={filter.key}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => onAdvancedFilterToggle?.(filter.key)}
                            className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                              isActive ? 'bg-cyan-50 text-[#007a83]' : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
                            }`}
                          >
                            <span className={isActive ? 'text-[#007a83]' : 'text-slate-500'}>{filter.icon}</span>
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {typeof count === 'number' && <span className="shrink-0 text-xs font-extrabold text-slate-500">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </nav>

          <div className="order-1 border-b border-slate-200/80 pb-2 sm:pb-3">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="min-w-0 space-y-2">
                <h1 className="text-2xl font-extrabold leading-tight tracking-normal text-slate-950 sm:text-3xl">
                  {activePlaceName}
                </h1>
                {conditionSummaryText && (
                  <p className="mx-auto max-w-4xl text-sm font-semibold leading-snug text-slate-700 [overflow-wrap:anywhere]">
                    {conditionSummaryText}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenIslandSelector}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
              >
                {copy.changeIsland}
              </button>
            </div>
          </div>

          <label className="sr-only" htmlFor="directory-search">
            {searchPlaceholder}
          </label>
          <div className="order-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="relative min-w-0 flex-1">
              <input
                id="directory-search"
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                onFocus={() => {
                  if (!selectedIsland) onOpenIslandSelector();
                }}
                placeholder={searchPlaceholder}
                className="min-h-11 w-full rounded-[1.2rem] border border-slate-300 bg-white/92 px-5 pr-12 text-base font-medium text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 sm:rounded-full"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-[#007a83] text-white transition hover:bg-[#00646d] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                aria-label={copy.search}
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenFilters}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#007a83] bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 text-[#007a83]" />
              <span>{copy.filter}</span>
              {typeof filteredResultCount === 'number' && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cyan-50 px-1.5 text-[11px] font-extrabold leading-none text-[#007a83] ring-1 ring-cyan-100">
                  {filteredResultCount}
                </span>
              )}
            </button>
          </div>

        </form>

        {topBeachToday && (
          <section
            className="mt-4 border-t border-slate-200/80 pt-4"
            aria-label={copy.topChoiceAria}
          >
            <div className="overflow-hidden rounded-[1.35rem] bg-white/54 text-left text-slate-950 ring-1 ring-white/50 lg:grid lg:grid-cols-2">
              <div className="p-4 sm:p-5">
                <div className="min-w-0 space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-white/86 px-2.5 py-1 text-[11px] font-extrabold leading-none tracking-normal text-slate-900 shadow-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {copy.topChoiceBadge}
                  </div>
                  <h2 className="text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">
                    {topBeachName}
                  </h2>
                  {topBeachDescription && (
                    <p className="max-w-2xl text-sm font-semibold leading-relaxed text-slate-700">
                      {topBeachDescription}
                    </p>
                  )}
                </div>

                {topBeachHighlights.length > 0 && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {topBeachHighlights.map(item => (
                      <div key={item.key} className="flex min-w-0 items-center gap-2 rounded-2xl border border-sky-100 bg-white/72 px-3 py-2 text-sm font-semibold text-slate-700">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-50 text-[#007a83] ring-1 ring-cyan-100">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 leading-tight">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTopBeachNavigation}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-[#007a83] shadow-sm transition hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                    title={t.navigate}
                    aria-label={t.navigateToLabel(topBeachName)}
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                  </button>
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

        {selectedIsland && mapPreview && (
          <section
            id="map-section"
            className="mt-4 border-t border-slate-200/80 pt-4"
            aria-label={copy.beachMapAria}
          >
            <div
              id="map-section-desktop"
              className="overflow-hidden rounded-[1.35rem] border border-sky-100 bg-white/68 p-3 text-left shadow-sm shadow-sky-900/8 ring-1 ring-white/45 backdrop-blur-md sm:p-4"
            >
              <div>
                {mapPreview}
              </div>
            </div>
          </section>
        )}
        </section>
      </div>

      <div className="relative">
        <div className="mx-auto max-w-[84rem] px-4 py-5 sm:px-5 lg:px-6">
          <div className="mb-3 flex items-center gap-3 px-1">
            <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
            <div className="max-w-full shrink-0 rounded-full border border-white/80 bg-white/86 px-3 py-1.5 text-center shadow-sm shadow-sky-900/10 ring-1 ring-white/50 backdrop-blur-md">
              <h2 className="truncate text-xs font-extrabold leading-none tracking-normal text-slate-700 sm:text-sm">
                {selectedIsland ? copy.bestBeachesToday : copy.popularDestinations}
              </h2>
            </div>
            <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto overscroll-x-contain px-4 pb-4 pr-10 [scrollbar-color:rgba(14,116,144,0.45)_transparent] [scrollbar-width:thin]">
            {selectedIsland ? (
              weatherBeachCards.map(({ beach, score, context }, index) => (
                <div key={beach.id} className="w-[19rem] shrink-0 snap-start sm:w-[20rem]">
                  {renderBeachDecisionCard(beach as BeachCardContext, {
                    score,
                    context,
                    recommendationRank: index + 1,
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

          {selectedIsland && (
            <div className="mt-7">
              <section className="flex flex-col rounded-2xl border border-sky-200 bg-white p-4 shadow-sm shadow-sky-900/5 sm:p-5" aria-label={copy.conditionsOverviewAria}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-950">
                      {copy.conditionsOverviewTitle}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                      {weatherDate && (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {weatherDate}
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {conditionItems.map(item => (
                      <div key={item.key} className="flex min-h-20 items-center gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#007a83] shadow-sm ring-1 ring-sky-100">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold tracking-normal text-slate-500">{item.label}</p>
                          <p className="truncate text-base font-extrabold text-slate-950">{item.value}</p>
                          {item.detail && <p className="text-xs font-semibold text-[#007a83]">{item.detail}</p>}
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
                  <div className="mt-4 border-t border-sky-100 pt-4">
                    <WeatherSummary
                      forecast={forecastDays}
                      selectedDayIndex={selectedDayIndex}
                      onDaySelect={onForecastDaySelect}
                      t={t}
                      islandName={selectedIsland?.name[language]}
                      variant="default"
                    />
                  </div>
                )}
              </section>

            </div>
          )}

          {selectedIsland && directoryAllBeachCards.length > 0 && (
            <section id="all-beaches-section" className="mt-7 rounded-2xl border border-sky-200 bg-white/88 p-4 shadow-sm shadow-sky-900/5 backdrop-blur-md sm:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight text-slate-950">
                    {directoryTitle}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-extrabold text-[#007a83]">
                    {copy.beachCount(directoryAllBeachCards.length)}
                  </span>
                  <div ref={directorySortRef} className="relative min-w-[12.5rem]">
                    <button
                      type="button"
                      onClick={() => setIsDirectorySortOpen(open => !open)}
                      aria-haspopup="listbox"
                      aria-expanded={isDirectorySortOpen}
                      className="inline-flex min-h-10 w-full items-center justify-between gap-3 rounded-full border border-cyan-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                    >
                      <span className="min-w-0 truncate">{activeDirectorySortLabel}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-[#007a83] transition-transform ${isDirectorySortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>

                    {isDirectorySortOpen && (
                      <div
                        role="listbox"
                        className="absolute right-0 top-full z-40 mt-2 w-full min-w-[14rem] overflow-hidden rounded-2xl border border-cyan-100 bg-white/96 p-1.5 shadow-xl shadow-sky-900/14 ring-1 ring-white/70 backdrop-blur-xl"
                      >
                        {directorySortOptions.map(option => (
                          <button
                            key={option.key}
                            type="button"
                            role="option"
                            aria-selected={option.isActive}
                            onClick={() => {
                              option.onSelect();
                              setIsDirectorySortOpen(false);
                            }}
                            className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                              option.isActive
                                ? 'bg-cyan-50 text-[#007a83]'
                                : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
                            }`}
                          >
                            <span className="min-w-0 truncate">{option.label}</span>
                            {option.isActive && <Check className="h-4 w-4 shrink-0 text-[#007a83]" aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {directoryAllBeachCards.map(beach => (
                  <div key={beach.id}>
                    {renderBeachDecisionCard(beach)}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
};
