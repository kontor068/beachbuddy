
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
export type BeachType = 'sandy' | 'pebbles' | 'sandy-pebbles' | 'rocky' | 'unknown';
export type WaterDepth = 'shallow' | 'medium' | 'deep';
export type BeachAccessType = 'asphalt_road' | 'passable_dirt_road' | 'difficult_dirt_road' | '4x4_only' | 'hiking_path_easy' | 'hiking_path_difficult' | 'boat_only' | 'unknown';
export type BeachTerrainType = 'fine_sand' | 'coarse_sand' | 'pebbles' | 'large_stones' | 'rocks';
export type TravelStyle = 'family' | 'couple' | 'friends' | 'solo';
export type SortOption = 'recommended' | 'all' | 'protected' | 'rating' | 'distance';
export type FilterKey =
  | keyof Beach['amenities']
  | keyof Beach['characteristics']
  | keyof Beach['activities']
  | keyof Beach['environment']
  | 'easyAccess'
  | 'adventure'
  | BeachType
  | 'showAll';
export type Theme = 'light' | 'dark' | 'system';
export type DataConfidence = 'high' | 'medium' | 'low';
export type WeatherSource = 'beach-cluster' | 'island-fallback';
export type ForecastConfidence = DataConfidence;
export type WindSector = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type ShelterLevel = 'open' | 'semi_sheltered' | 'sheltered' | 'very_sheltered' | 'unknown';
export type FetchExposure = 'low' | 'medium' | 'high' | 'unknown';
export type LocalWindAmplification = 'low' | 'medium' | 'high' | 'unknown';
export type SeabedSlope = 'shallow_gradual' | 'moderate' | 'steep' | 'unknown';
export type WaterEntry = 'easy' | 'moderate' | 'difficult' | 'rocks_only' | 'unknown';
export type WaterQualityRiskAfterRain = 'low' | 'medium' | 'high';
export type SwimmingComfort = 'excellent' | 'good' | 'caution' | 'avoid_swimming';
export type WindSuitabilityColor = 'green' | 'yellow' | 'orange' | 'red';
export type WindSuitabilityExplanationKey =
  | 'generally_calm'
  | 'protected_from_wind'
  | 'partly_exposed'
  | 'exposed_to_wind'
  | 'avoid_today';

export interface SimpleWindSuitability {
  suitabilityColor: WindSuitabilityColor;
  exposureStatus: 'protected' | 'partial' | 'exposed';
  confidence: DataConfidence;
  explanationKey: WindSuitabilityExplanationKey;
  explanationText: string;
  windSector?: WindSector;
}

export interface BeachMapCoordinates {
  lat: number;
  lon: number;
  source?: string;
  sourceUrl?: string;
  confidence?: DataConfidence;
  notes?: string;
}

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

export interface WindProfile {
  beachFacingDirection: number | null;
  shelterLevel: ShelterLevel;
  fetchExposure: FetchExposure;
  exposedToWindDirections: WindSector[];
  protectedFromWindDirections: WindSector[];
  knownWindSportSpot: boolean;
  localWindAmplification: LocalWindAmplification;
  confidence: DataConfidence;
  notes: string;
  /**
   * The beach pin is known/suspected to sit at the wrong spot (wrong cove,
   * name collision, harbour pocket — needs-field-verification list), so
   * geometry derived from it must not override authored knowledge (e.g. the
   * geometry-facing preference rule).
   */
  suspectPin?: boolean;
}

export type WindProfileSource = 'override' | 'beach' | 'metadata' | 'geospatial' | 'unknown';

export interface WeatherConditions {
  timestamp: string;
  windDirection: WindDirection;
  windSpeedKmh: number;
  windGustKmh?: number;
  windGustKnots?: number;
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

export interface MarineForecast {
  waveHeightM?: number;
  waveDirectionDeg?: number;
  wavePeriodS?: number;
  swellWaveHeightM?: number;
  swellWaveDirectionDeg?: number;
  swellWavePeriodS?: number;
  seaSurfaceTemperatureC?: number;
  source?: 'open-meteo-marine';
}

export interface RecommendationConfidence {
  level: DataConfidence;
  score: number;
  source: WeatherSource;
  reasons: string[];
}

export interface RecommendationExplanation {
  summary: string;
  topReasons: string[];
  tradeoffs: string[];
  touristAdvice: string;
}

export type WarningFlagType =
  | 'strong_wind'
  | 'gusty_wind'
  | 'rough_sea'
  | 'exposed_to_wind'
  | 'offshore_wind'
  | 'onshore_chop'
  | 'direct_swell'
  | 'difficult_access'
  | 'boat_only'
  | 'crowded'
  | 'missing_data'
  | 'rain_risk'
  | 'water_quality_risk'
  | 'official_warning'
  | 'heat_uv'
  | 'low_confidence'
  | 'wind_sport_spot';

export interface WarningFlag {
  type: WarningFlagType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface BeachScore {
  beachId: number;
  total: number;
  swimmingScore?: number;
  experienceScore?: number;
  preferenceScore?: number;
  finalSuitabilityScore?: number;
  swimmingComfort?: SwimmingComfort;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
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
  blueFlag2026: boolean;
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
  easyAccess: boolean;
}

export interface Beach {
  id: number;
  rating: number;
  name: { [key in LanguageCode]: string };
  description: { [key in LanguageCode]: string };
  detailedDescription?: { [key in LanguageCode]?: string };
  accessNotes?: { [key in LanguageCode]?: string };
  protectedFrom: WindDirection[];
  orientation?: BeachOrientation;
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
  mapCoordinates?: BeachMapCoordinates;
  location?: Partial<BeachLocation>;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  fetchExposure?: FetchExposure;
  seabedSlope?: SeabedSlope;
  waterEntry?: WaterEntry;
  waterQualityRiskAfterRain?: WaterQualityRiskAfterRain;
  nearStreamOrDrain?: boolean;
  nearPort?: boolean;
  urbanRunoffRisk?: boolean;
  officialWarningOverride?: boolean;
  officialWarningReason?: string;
  windProfile?: WindProfile;
  blueFlag2026?: BeachMetadata['blueFlag2026'];
  aliases?: string[];
  staticLabels?: {
    beachType?: string;
    accessType?: string;
    accessLabel?: string;
    terrain?: string;
    waterDepth?: string;
  };
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
  fetchExposure?: FetchExposure;
  seabedSlope?: SeabedSlope;
  waterEntry?: WaterEntry;
  waterQualityRiskAfterRain?: WaterQualityRiskAfterRain;
  nearStreamOrDrain?: boolean;
  nearPort?: boolean;
  urbanRunoffRisk?: boolean;
  officialWarningOverride?: boolean;
  officialWarningReason?: string;
  organized: boolean;
  shade: boolean;
  amenities: string[];
  environment?: {
    quiet?: boolean;
    remote?: boolean;
    familyFriendly?: boolean;
    notes?: string;
  };
  blueFlag2026?: {
    awarded: true;
    year: 2026;
    awardCount: number;
    source: string;
    sourceUrl: string;
    importedAt: string;
    officialEntries: Array<{
      officialNameGr: string;
      officialNameEn: string;
      regionalUnitGr: string;
      regionalUnitEn: string;
      municipalityGr: string;
      municipalityEn: string;
      officialLat?: number;
      officialLon?: number;
      matchMethod: string;
      matchScore: number;
      matchDistanceKm?: number;
    }>;
  };
  sourceUrls?: string[];
  sourceNotes?: string | string[];
  googleMapsNavigation?: {
    status: 'verified' | 'unresolved' | 'needs-review' | 'blocked';
    /** Preferred navigation destination: name search vs raw coordinates (set when a cross-island name collision makes place search risky). */
    mode?: 'place' | 'coordinates';
    checkedAt?: string;
    /** Audit pipeline that produced the status, e.g. 'osm-nav-audit-v1'. */
    method?: string;
    query?: string;
    placeId?: string;
    reason?: string;
  };
  mapCoordinates?: BeachMapCoordinates;
  orientation?: Partial<BeachOrientation>;
  windProfile?: WindProfile;
  confidence?: 'high' | 'medium' | 'low';
  language?: string;
  batch?: string;
}

import { ExposureLevel } from './utils/windExposure';

export interface GeospatialExposureSector {
  level: ExposureLevel;
  fetchKm: number;
  blockedRayRatio: number;
  /** Onshore wind component for this sector, -1 (offshore) .. 1 (onshore). */
  onshore?: number;
  /** Continuous exposure intensity 0-100 (0 = calm, 100 = fully exposed). */
  intensity?: number;
}

export type GeospatialExposureSource = 'natural-earth-baseline' | 'high-res-coastline';

export interface GeospatialExposureProfile {
  beachId: number;
  /** Direction the beach faces (seaward shoreline normal), 0-360, or null. */
  facingDeg?: number | null;
  sectors: Record<WindSector, GeospatialExposureSector>;
  confidence: DataConfidence;
  source: GeospatialExposureSource;
}

/**
 * Unified, always-definite wind-exposure outcome for one beach under one live
 * wind. The resolver guarantees a concrete `level` and `reason`; `confidence`
 * is internal (sorting/tiebreaks) and is never surfaced to the user as doubt.
 */
export interface WindExposureResult {
  level: ExposureLevel;
  intensity: number;
  facingDeg: number | null;
  effectiveFetchKm: number;
  onshore: number;
  modeledWaveHeightM: number;
  reason: string;
  confidence: DataConfidence;
}

export interface SuitableBeach {
  beachId: number;
  name: string;
  score: number;
  swimmingScore?: number;
  experienceScore?: number;
  preferenceScore?: number;
  finalSuitabilityScore?: number;
  swimmingComfort?: SwimmingComfort;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  explanation: string;
  distance?: number;
  beach: Beach;
  bestBeachTime?: any;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  isExposed: boolean;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
  marine?: MarineForecast;
  waveHeightM?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  weatherSource?: WeatherSource;
  hourlySeaScore?: number;
  windProfile?: WindProfile;
  windProfileSource?: WindProfileSource;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
  simpleWindSuitability?: SimpleWindSuitability;
  geospatialExposure?: GeospatialExposureProfile;
  /** How this beach behaves in a typical Meltemi (N/NE summer wind). */
  meltemiExposure?: ExposureLevel;
  /** Localised, directional one-line explanation of today's wind exposure. */
  windExposureReason?: string;
}

export interface BeachForecastContext {
  forecast: DailyForecast[];
  source: WeatherSource;
  clusterKey: string;
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
  wind: { speed: number; deg: number; gust?: number; gustKnots?: number; windGustKnots?: number; };
  weather: { main: string; description: string; icon: string; };
  main: { temp: number; };
  marine?: MarineForecast;
}

export interface ForecastItem {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number; pressure: number; sea_level: number; grnd_level: number; humidity: number; temp_kf: number; };
  weather: { id: number; main: string; description: string; icon: string; }[];
  clouds: { all: number; };
  wind: { speed: number; deg: number; gust: number; gustKnots?: number; };
  rain?: { '3h'?: number };
  visibility: number;
  pop: number;
  sys: { pod: 'd' | 'n'; };
  dt_txt: string;
  marine?: MarineForecast;
}

export interface DailyForecast {
  date: Date;
  wind: { speed: number; deg: number; gust?: number; gustKnots?: number; windGustKnots?: number; };
  weather: { main: string; description: string; icon: string; };
  temp_min: number;
  temp_max: number;
  hourly: ForecastItem[];
  marine?: MarineForecast;
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
  sortByProtected: string;
  sortByTopRated: string;
  sortByDistance: string;
  sortedByDistance: string;
  beachSearchFilters: {
    searchLabel: string;
    searchPlaceholder: string;
    resultCount: (count: number) => string;
    activeFiltersLabel: string;
    clearAll: string;
    clearSearch: string;
    removeFilter: (label: string) => string;
    emptyTitle: string;
    emptyDescription: string;
  };
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
    quiet: string;
    snorkeling: string;
    adventure: string;
    familyFriendly: string;
    'sandy-pebbles': string;
    rocky: string;
    unknown: string;
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
    showDetails: string;
    hideDetails: string;
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
    blueFlag2026?: string;
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
    easyAccess: string;
  };
  crowdLevels: {
    low: string;
    medium: string;
    high: string;
  };
};
