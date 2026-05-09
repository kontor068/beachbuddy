
import { CrowdLevel } from './services/crowdService';
export type { CrowdLevel };

export enum WindDirection {
  N = 'North',
  NE = 'Northeast',
  E = 'East',
  SE = 'Southeast',
  S = 'South',
  SW = 'Southwest',
  W = 'West',
  NW = 'Northwest',
}

export enum Accessibility {
  EASY = 'EASY',
  MODERATE = 'MODERATE',
  DIFFICULT = 'DIFFICULT',
  BOAT_ONLY = 'BOAT_ONLY',
}

export type LanguageCode = 'en' | 'gr' | 'fr' | 'de' | 'it';
export type WindUnit = 'beaufort' | 'mph';
export type WaveCondition = 'calm' | 'moderate' | 'rough';
export type BeachType = 'sandy' | 'pebbles' | 'sandy-pebbles' | 'rocky';
export type WaterDepth = 'shallow' | 'medium' | 'deep';
export type BeachAccessType = 'asphalt_road' | 'passable_dirt_road' | '4x4_only' | 'hiking_path_easy' | 'hiking_path_difficult' | 'boat_only';
export type BeachTerrainType = 'fine_sand' | 'coarse_sand' | 'pebbles' | 'large_stones' | 'rocks';
export type TravelStyle = 'family' | 'couple' | 'friends' | 'solo';
export type SortOption = 'recommended' | 'all' | 'rating' | 'distance';
export type FilterKey = keyof Beach['amenities'] | keyof Beach['characteristics'] | 'easyAccess' | BeachType | 'showAll';
export type Theme = 'light' | 'dark' | 'system';
export type DataConfidence = 'high' | 'medium' | 'low';

export interface BeachLocation {
  lat: number;
  lon: number;
  country: 'Greece';
  region: string;
  island?: string;
  municipality?: string;
}

export interface BeachOrientation {
  degrees: number | null;
  faces: WindDirection[];
  protectedFrom: WindDirection[];
  confidence: DataConfidence;
  notes?: string;
}

export interface WeatherConditions {
  timestamp: string;
  windDirection: WindDirection;
  windSpeedKmh: number;
  windGustKmh?: number;
  temperatureC: number;
  cloudCoverPercent?: number;
  rainProbabilityPercent?: number;
  uvIndex?: number;
}

export interface MarineConditions {
  waveHeightM?: number;
  waveCondition: WaveCondition;
  swellDirection?: WindDirection;
  seaTemperatureC?: number;
  isComfortableForSwimming: boolean;
  notes?: string;
}

export interface RecommendationExplanation {
  summary: string;
  topReasons: string[];
  tradeoffs: string[];
  touristAdvice: string;
}

export type WarningFlagType =
  | 'strong_wind'
  | 'rough_sea'
  | 'exposed_to_wind'
  | 'difficult_access'
  | 'boat_only'
  | 'crowded'
  | 'missing_data'
  | 'rain_risk'
  | 'low_confidence';

export interface WarningFlag {
  type: WarningFlagType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface BeachScore {
  beachId: number;
  total: number;
  windProtection: number;
  seaComfort: number;
  weatherComfort: number;
  preferenceMatch: number;
  distance: number;
  amenities: number;
  explanation: RecommendationExplanation;
  warnings: WarningFlag[];
}

export interface UserPreferences {
  sandy: boolean;
  pebbles: boolean;
  quiet: boolean;
  beachBar: boolean;
  familyFriendly: boolean;
  snorkeling: boolean;
  deepWater: boolean;
  shallowWater: boolean;
  surfing: boolean;
  parking: boolean;
}

export interface Beach {
  id: number;
  rating: number;
  name: { [key in LanguageCode]: string };
  description: { [key in LanguageCode]: string };
  detailedDescription?: { [key in LanguageCode]?: string };
  accessNotes?: { [key in LanguageCode]?: string };
  protectedFrom: WindDirection[];
  accessibility: Accessibility;
  amenities: { 
    organized: boolean; 
    naturalShade: boolean; 
    taverna: boolean; 
    beachBar: boolean;
    sunbeds: boolean;
    restaurant: boolean;
    parking: boolean;
  };
  characteristics: {
    shallowWaters: boolean;
    deepWaters: boolean;
  };
  beachType: BeachType;
  waterDepth: WaterDepth;
  activities: {
    snorkeling: boolean;
    surfing: boolean;
  };
  environment: {
    quiet: boolean;
    remote: boolean;
    familyFriendly: boolean;
  };
  popularityScore: number;
  coordinates: { lat: number; lon: number; };
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  metadata?: BeachMetadata;
}

export type BeachAmenities = Beach['amenities'];

export interface BeachMetadata {
  access: {
    type: BeachAccessType;
    label: string;
    notes: string;
  };
  terrain: {
    types: BeachTerrainType[];
    label: string;
  };
  waterDepth?: {
    type: WaterDepth;
    label: string;
    notes?: string;
  };
  organized: boolean;
  shade: boolean;
  amenities: string[];
  confidence?: 'high' | 'medium' | 'low';
  language?: string;
  batch?: string;
}

import { ExposureLevel } from './utils/windExposure';

export interface SuitableBeach {
  beachId: number;
  name: string;
  score: number;
  explanation: string;
  distance?: number;
  beach: Beach;
  bestBeachTime?: any;
  isExposed: boolean;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
}

export interface SecretBeach {
  beachId: number;
  name: string;
  explanation: string;
  secretScore: number;
  distance?: number;
  isExposed: boolean;
  crowdLevel?: CrowdLevel;
  beach: Beach;
}

export interface Island {
  id: string;
  name: { [key in LanguageCode]: string };
  group: 'cyclades' | 'dodecanese' | 'sporades' | 'north_aegean' | 'crete' | 'ionian' | 'attica' | 'argosaronic' | 'euboea' | 'mainland_peloponnese' | 'mainland_central' | 'mainland_thessaly' | 'mainland_epirus' | 'mainland_macedonia' | 'mainland_thrace' | 'mainland_west_greece' | 'other';
  coordinates: { lat: number; lon: number; };
  beaches: Beach[];
}

export interface WeatherData {
  wind: { speed: number; deg: number; };
  weather: { main: string; description: string; icon: string; };
  main: { temp: number; };
}

export interface ForecastItem {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number; pressure: number; sea_level: number; grnd_level: number; humidity: number; temp_kf: number; };
  weather: { id: number; main: string; description: string; icon: string; }[];
  clouds: { all: number; };
  wind: { speed: number; deg: number; gust: number; };
  visibility: number;
  pop: number;
  sys: { pod: 'd' | 'n'; };
  dt_txt: string;
}

export interface DailyForecast {
  date: Date;
  wind: { speed: number; deg: number; };
  weather: { main: string; description: string; icon: string; };
  temp_min: number;
  temp_max: number;
  hourly: ForecastItem[];
}

export interface SavedItinerary {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export type Translation = {
  headerTitlePart1: string;
  headerTitlePart2: string;
  headerStudioName: string;
  headerSubtitle: string;
  currentWind: string;
  location: string;
  direction: string;
  speed: string;
  windStrength: string;
  shelteredTitle: string;
  shelteredDescription: (windDirection: WindDirection, dayContext: string, isToday: boolean) => string;
  noShelteredBeaches: string;
  noWeatherRecommendedBeaches: string;
  exposedTitle: string;
  exposedDescription: (windDirection: WindDirection, dayContext: string, isToday: boolean) => string;
  allBeachesSheltered: string;
  calmWindTitle: (dayContext: string) => string;
  calmWindTitleWithShift: (dayContext: string) => string;
  calmWindDescription: (windStrength: string, dayContext: string, isToday: boolean) => string;
  calmWindDescriptionWithShift: (windStrength: string, shiftTime: string, beaches: string) => string;
  nightSwimTitle: string;
  nightSwimDescription: string;
  dayOverMessageTitle: string;
  dayOverMessageDescription: string;
  earlyMorningMessageTitle: string;
  earlyMorningMessageDescription: string;
  footer: string;
  loading: string;
  errorTitle: string;
  defaultErrorMessage: string;
  tryAgain: string;
  access: string;
  accessNotesTitle: string;
  navigate: string;
  shelteredTooltip: string;
  exposedTooltip: string;
  refresh: string;
  refreshing: string;
  lastUpdated: string;
  mockDataTitle: string;
  mockDataMessage: string;
  amenitiesTitle: string;
  organizedTooltip: string;
  filterTitle: string;
  filterExplanation: string;
  filterAll: string;
  clearFiltersLabel: string;
  toggleFilterForLabel: string;
  beachCharacteristicsTitle: string;
  waveConditionsTitle: string;
  forecastTitle: string;
  today: string;
  tomorrow: string;
  onDay: (dayName: string) => string;
  forecastFor: string;
  locale: string;
  itineraryPlannerTitle: string;
  itineraryPlannerDescription: string;
  durationLabel: string;
  days: (count: number) => string;
  generateButton: string;
  generatingMessage: string;
  itineraryError: string;
  sortByTitle: string;
  sortByRecommended: string;
  sortByAll: string;
  sortByTopRated: string;
  sortByDistance: string;
  sortedByDistance: string;
  gettingLocation: string;
  locationErrorPermission: string;
  locationErrorUnavailable: string;
  locationErrorTimeout: string;
  locationErrorGeneric: string;
  distanceAway: (dist: string) => string;
  favoritesTitle: string;
  noFavoriteBeaches: string;
  favoriteBeachesDescription: string;
  closeModalLabel: string;
  openFiltersLabel: string;
  filtersButtonLabel: string;
  travelStyleTitle: string;
  beachOfTheDayTitle: string;
  beachOfTheDayDescription: (beachName: string) => string;
  learnMore: string;
  chatTitle: string;
  chatInitial: string;
  chatPlaceholder: string;
  chatWarning: string;
  newChat: string;
  showMore: string;
  showLess: string;
  gettingLocationForChat: string;
  locationShared: string;
  locationErrorForChat: string;
  retryLocation: string;
  resetFilters: string;
  applyFilters: string;
  ratingSourceGoogle: string;
  viewGoogleReviews: string;
  accuracyLabel: string;
  relativeTime: {
    now: string;
    minuteAgo: string;
    minutesAgo: (minutes: number) => string;
    hourAgo: string;
    hoursAgo: (hours: number) => string;
    yesterday: string;
    daysAgo: (days: number) => string;
  };
  temperatureLabel: string;
  conditionLabel: string;
  weatherConditions: Record<string, string>;
  navigateToLabel: (beachName: string) => string;
  windUnitSelectionLabel: string;
  units: {
    beaufort: string;
    mph: string;
    beaufortFull: string;
    mphFull: string;
  };
  windDirections: { [key in WindDirection]: string };
  windDirectionsAccusative: { [key in WindDirection]: string };
  windDirectionsShort: { [key in WindDirection]: string };
  accessibility: { [key in Accessibility]: string };
  filterOptions: {
    organized: string;
    naturalShade: string;
    taverna: string;
    beachBar: string;
    sunbeds: string;
    restaurant: string;
    parking: string;
    sandy: string;
    pebbles: string;
    'sandy-pebbles': string;
    rocky: string;
    deepWaters: string;
    shallowWaters: string;
    easyAccess: string;
    showAll: string;
  };
  waveConditions: {
    calm: string;
    moderate: string;
    rough: string;
  };
  beaufortScale: (speedKmph: number) => string;
  travelStyles: {
    family: string;
    couple: string;
    friends: string;
    solo: string;
  },
  filterByCharacteristics: string;
  clearCharacteristicFiltersLabel: string;
  characteristics: {
    deepWaters: string;
    shallowWaters: string;
  };
  beachDetailModal: {
    whyToday: string;
    localsTip: string;
    whatToPack: string;
  };
  audioGuide: {
    title: (beachName: string) => string;
    playButton: string;
    stopButton: string;
    dismiss: string;
    loading: string;
  };
  hourlyForecast: {
    title: string;
    time: string;
    direction: string;
    strength: string;
  };
  sharing: {
    buttonLabel: string;
    title: string;
    text: (beachName: string) => string;
  };
  savedItineraries: {
    title: string;
    saveButton: string;
    planSaved: string;
    noSavedPlans: string;
    noSavedPlansDesc: string;
    savedOn: (date: string) => string;
    deleteButton: string;
    shareButton: string;
    viewPlan: string;
    sharingText: (planName: string) => string;
    editButton: string;
    saveChangesButton: string;
    cancelButton: string;
    editNameLabel: string;
    editContentLabel: string;
  };
  weatherAlert: {
    title: string;
    message: (beaufortLevel: number, windDirection: string) => string;
  };
  winterSwimming: {
    seasonActive: string;
    waterTempNote: string;
    safeConditionsTitle: string;
    safeConditionsDescription: (windStrength: string) => string;
    unsafeConditionsTitle: string;
    unsafeConditionsDescription: string;
    tipsTitle: string;
    tip1: string;
    tip2: string;
    tip3: string;
    tip4: string;
    tip5: string;
  };
  confirmation: {
    deleteItineraryTitle: string;
    deleteItineraryMessage: string;
    resetFiltersTitle: string;
    resetFiltersMessage: string;
    confirmButton: string;
    cancelButton: string;
  };
  islandSelector: {
    title: string;
    searchPlaceholder: string;
    showingFor: string;
    changeIsland: string;
    useCurrentLocation: string;
    groups: {
      cyclades: string;
      dodecanese: string;
      sporades: string;
      north_aegean: string;
      crete: string;
      ionian: string;
      attica: string;
      argosaronic: string;
      euboea: string;
      mainland_peloponnese: string;
      mainland_central: string;
      mainland_thessaly: string;
      mainland_epirus: string;
      mainland_macedonia: string;
      mainland_thrace: string;
    }
  };
  notifications: {
    permissionRequestMessage: string;
    subscribedMessage: string;
    blockedMessage: string;
    alreadySubscribed: string;
    unsubscribed: string;
    subscriptionError: string;
  };
  themeToggle: {
    light: string;
    dark: string;
  };
  suggestionChips: {
    beachOfTheDay: (beachName: string) => string;
    calmDayBeach: string;
    windyDayActivity: string;
    food: string;
    boatTrip: string;
    hiddenGem: string;
    altBeach: (beachName: string) => string;
    planMorning: string;
    sunset: string;
    dinner: string;
    eveningWalk: string;
    tomorrowWeather: string;
    planTomorrow: string;
  };
  userPreferences: {
    title: string;
    subtitle: string;
    sandy: string;
    pebbles: string;
    quiet: string;
    beachBar: string;
    familyFriendly: string;
    snorkeling: string;
    deepWater: string;
    shallowWater: string;
    surfing: string;
    parking: string;
  };
  crowdLevels: {
    low: string;
    medium: string;
    high: string;
  };
};
