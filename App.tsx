import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Accessibility, Beach, DailyForecast, ForecastItem, Island, LanguageCode, FilterKey, SortOption, UserPreferences, SuitableBeach, WindDirection } from './types';
import { beachMatchesUserPreferences, calculateBeachScore, calculateBestBeachTime, getSuitableBeaches, filterBeachesByUserPreferences, getTopRecommendationDisplayLimit, hasHourlyRainRisk, isTrustedTopRecommendationCandidate, type BeachWeatherById, type BestBeachTime } from './services/recommendationService';
import { motion, AnimatePresence } from 'motion/react';
import type { Chat } from '@google/genai';
import { AlertTriangle, CheckCircle2, Clock3, Navigation, RefreshCw, Waves, Wind } from 'lucide-react';

// Components
import Header from './components/Header';
import SkeletonLoader from './components/SkeletonLoader';
import { UnsafeConditionsMessage } from './components/UnsafeConditionsMessage';
import { PreferenceFilters } from './components/PreferenceFilters';
import { BeachFilters } from './components/BeachFilters';
import { WeatherSummary } from './components/WeatherSummary';
import { RecommendationSection } from './components/RecommendationSection';
import { BeachCard } from './components/BeachCard';
import ErrorDisplay from './components/ErrorDisplay';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { PrivacyConsentBanner } from './components/PrivacyConsentBanner';
import { MapLoadBoundary } from './components/MapLoadBoundary';
import { LegalFooter, openLegalModal } from './components/LegalFooter';
import { BeachSearcherHome, type DirectoryCategory } from './components/BeachSearcherHome';

// Hooks & Utils
import { useBeaches } from './hooks/useBeaches';
import { useWeather } from './hooks/useWeather';
import { useLocation } from './hooks/useLocation';
import { translations } from './translations';
import { degToCompass, getBeaufortLevel, isWinterSeason, maxWindDirectionSpread } from './utils/weatherUtils';
import { trackEvent, trackPageView } from './services/analyticsService';
import { loadAppReadyRegion, loadBeachDetailData, loadBeachRegionIndex, mergeBeachDetailData } from './services/beachDataLoader';
import { calculateSeaConditionScore, hasPoorSeaConditions } from './utils/seaConditions';
import { recordForecastSnapshots } from './services/forecastVerificationService';
import { getBeachPhotoLookup } from './services/beachPhotos';
import { scrollElementIntoView, scrollToPageTop } from './utils/scroll';
import { getInitialLanguage, getLocalizedCopy, languageToLocale, saveLanguagePreference, type SupportedLanguage } from './utils/i18n';
import { lazyWithChunkRecovery } from './utils/chunkLoadRecovery';
import { buildBetaFeedbackUrl } from './utils/betaFeedback';
import { QUICK_PREFERENCE_FILTERS } from './utils/preferenceFilterLabels';
import { canOpenNavigation, openNavigation } from './utils/navigation';
import { displayBeachName } from './utils/localization';
import { hasDifficultTopPickAccess, hasMainstreamTopPickAccess, isAdventureBeach } from './utils/access';
import { buildBeachDetailPath, buildBeachRegionPath, parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from './utils/beachUrls';
import { describeSimpleWindSuitability } from './utils/windExposureCopy';
import {
  getSelectedDayPrefix,
  getSelectedDaySentencePrefix,
  isSelectedDateToday,
} from './utils/dateLabels';
import { getTopPickTiming, getTopPickTimingLabel, topPickTimingPriority } from './utils/topPickTiming';
import { getActiveWeatherFixtureScenario } from './utils/weatherFixtures';
import { getBeachTouristRecognitionScore } from './utils/touristPriority';
import { getConsistentVisibleMapExposureLevels } from './utils/mapExposure';
import { loadGeospatialExposureProfiles, type GeospatialExposureProfileLookup } from './services/geospatialExposureService';
import { assessBeachWindExposure } from './utils/windExposureEngine';
import { fuzzySearchScore, getSearchVariants } from './utils/searchNormalize';

// Keep map code out of the first-load path; it renders only near the map section.
const BeachMap = lazyWithChunkRecovery(() => import('./components/BeachMap'), 'BeachMap');

// Keep detail page lazy; it is outside the first beach-decision screen.
const BeachDetailPage = lazyWithChunkRecovery(
  () => import('./pages/BeachDetailPage').then(module => ({ default: module.BeachDetailPage })),
  'BeachDetailPage'
);

const FilterModal = lazyWithChunkRecovery(() => import('./components/FilterModal'), 'FilterModal');
const CombinedFilter = lazyWithChunkRecovery(
  () => import('./components/AmenityFilter').then(module => ({ default: module.CombinedFilter })),
  'AmenityFilter'
);
const ChatbotModal = lazyWithChunkRecovery(
  () => import('./components/ChatbotModal').then(module => ({ default: module.ChatbotModal })),
  'ChatbotModal'
);
const IslandSelectorModal = lazyWithChunkRecovery(
  () => import('./components/IslandSelectorModal').then(module => ({ default: module.IslandSelectorModal })),
  'IslandSelectorModal'
);
const AiBeachAdvisor = lazyWithChunkRecovery(
  () => import('./components/AiBeachAdvisor').then(module => ({ default: module.AiBeachAdvisor })),
  'AiBeachAdvisor'
);
const UsageInsights = lazyWithChunkRecovery(
  () => import('./components/UsageInsights').then(module => ({ default: module.UsageInsights })),
  'UsageInsights'
);

const ENABLE_AI_ADVISOR = false;
const ENABLE_BEACH_BUDDY_CHAT = false;
const ENABLE_PLANNER_PRO = false;
const ENABLE_USAGE_INSIGHTS = import.meta.env.DEV;

type DetailDataStatus = 'idle' | 'loading' | 'ready' | 'partial';

const ISLAND_BACKGROUND_IMAGES: Record<string, string> = {
  amorgos: '/cyclades-amorgos-bg.webp',
  anafi: '/cyclades-anafi-bg.webp',
  andros: '/cyclades-andros-bg.webp',
  antiparos: '/cyclades-antiparos-bg.webp',
  folegandros: '/cyclades-folegandros-bg.webp',
  ios: '/cyclades-ios-bg.webp',
  kea: '/cyclades-kea-bg.webp',
  kimolos: '/cyclades-kimolos-bg.webp',
  kythnos: '/cyclades-kythnos-bg.webp',
  milos: '/milos-sarakiniko-bg.webp',
  mykonos: '/cyclades-mykonos-bg.webp',
  naxos: '/cyclades-naxos-bg.webp',
  paros: '/cyclades-paros-bg.webp',
  santorini: '/cyclades-santorini-bg.webp',
  serifos: '/cyclades-serifos-bg.webp',
  sifnos: '/cyclades-sifnos-bg.webp',
  sikinos: '/cyclades-sikinos-bg.webp',
  syros: '/cyclades-syros-bg.webp',
  tinos: '/cyclades-tinos-bg.webp',
  donousa: '/cyclades-donousa-bg.webp',
  koufonisia: '/cyclades-koufonisia-bg.webp',
  schinoussa: '/cyclades-schinoussa-bg.webp',
  iraklia: '/cyclades-iraklia-bg.webp',
  aegina: '/saronic-aegina-bg.webp',
  agistri: '/saronic-agistri-bg.webp',
  hydra: '/saronic-hydra-bg.webp',
  methana: '/saronic-methana-bg.webp',
  poros: '/saronic-poros-bg.webp',
  salamina: '/saronic-salamina-bg.webp',
  spetses: '/saronic-spetses-bg.webp',
  eastattica: '/attica-east-bg.webp',
  athenscoast: '/attica-athens-coast-bg.webp',
  westattica: '/attica-west-bg.webp',
  piraeuscoast: '/attica-piraeus-coast-bg.webp',
  saronicislands: '/saronic-agistri-bg.webp',
  kythiraantikythira: '/attica-kythira-bg.webp',
  nomosevvoias: '/euboea-evia-bg.webp',
  evia: '/euboea-evia-bg.webp',
  euboea: '/euboea-evia-bg.webp',
  corfu: '/ionian-corfu-bg.webp',
  kefalonia: '/ionian-kefalonia-bg.webp',
  lefkada: '/ionian-lefkada-bg.webp',
  zakynthos: '/ionian-zakynthos-bg.webp',
  ithaca: '/ionian-ithaca-bg.webp',
  paxos: '/ionian-paxos-bg.webp',
  paxi: '/ionian-paxos-bg.webp',
  antipaxos: '/ionian-antipaxos-bg.webp',
  antipaxi: '/ionian-antipaxos-bg.webp',
  othonoi: '/ionian-othonoi-bg.webp',
  othonoiislands: '/ionian-othonoi-bg.webp',
  erikoussa: '/ionian-erikoussa-bg.webp',
  mathraki: '/ionian-mathraki-bg.webp',
  meganisi: '/ionian-meganisi-bg.webp',
  agathonisi: '/dodecanese-agathonisi-bg.webp',
  arki: '/dodecanese-arki-bg.webp',
  arkoi: '/dodecanese-arki-bg.webp',
  astypalaia: '/dodecanese-astypalaia-bg.webp',
  astypalea: '/dodecanese-astypalaia-bg.webp',
  halki: '/dodecanese-halki-bg.webp',
  chalki: '/dodecanese-halki-bg.webp',
  kalymnos: '/dodecanese-kalymnos-bg.webp',
  karpathos: '/dodecanese-karpathos-bg.webp',
  kasos: '/dodecanese-kasos-bg.webp',
  kassos: '/dodecanese-kasos-bg.webp',
  kastellorizo: '/dodecanese-kastellorizo-bg.webp',
  megisti: '/dodecanese-kastellorizo-bg.webp',
  kos: '/dodecanese-kos-bg.webp',
  leros: '/dodecanese-leros-bg.webp',
  lipsi: '/dodecanese-lipsi-bg.webp',
  marathi: '/dodecanese-marathi-bg.webp',
  nisyros: '/dodecanese-nisyros-bg.webp',
  patmos: '/dodecanese-patmos-bg.webp',
  pserimos: '/dodecanese-pserimos-bg.webp',
  rhodes: '/dodecanese-rhodes-bg.webp',
  symi: '/dodecanese-symi-bg.webp',
  telendos: '/dodecanese-telendos-bg.webp',
  tilos: '/dodecanese-tilos-bg.webp',
  chania: '/crete-chania-bg.webp',
  heraklion: '/crete-heraklion-bg.webp',
  rethymno: '/crete-rethymno-bg.webp',
  lasithi: '/crete-lasithi-bg.webp',
  skiathos: '/sporades-skiathos-bg.webp',
  skopelos: '/sporades-skopelos-bg.webp',
  alonissos: '/sporades-alonissos-bg.webp',
  skyros: '/sporades-skyros-bg.webp',
};

const getBackgroundImageCss = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (!imagePath.endsWith('.jpg')) return `url(${imagePath})`;

  const webpPath = imagePath.replace(/\.jpg$/, '.webp');
  return `image-set(url(${webpPath}) type("image/webp"), url(${imagePath}) type("image/jpeg"))`;
};

const compactWindDirections: Record<LanguageCode, Record<string, string>> = {
  en: { North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SW', West: 'W', Northwest: 'NW' },
  gr: { North: 'Β', Northeast: 'ΒΑ', East: 'Α', Southeast: 'ΝΑ', South: 'Ν', Southwest: 'ΝΔ', West: 'Δ', Northwest: 'ΒΔ' },
  de: { North: 'N', Northeast: 'NO', East: 'O', Southeast: 'SO', South: 'S', Southwest: 'SW', West: 'W', Northwest: 'NW' },
  it: { North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SO', West: 'O', Northwest: 'NO' },
  fr: { North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SO', West: 'O', Northwest: 'NO' },
};

const compactWeatherLabels: Record<LanguageCode, Record<string, string>> = {
  en: { 'clear sky': 'Clear', 'few clouds': 'Few clouds', 'scattered clouds': 'Clouds', 'broken clouds': 'Clouds', 'overcast clouds': 'Cloudy', 'light rain': 'Light rain', 'moderate rain': 'Rain', 'heavy intensity rain': 'Heavy rain' },
  gr: { 'clear sky': 'Καθαρά', 'few clouds': 'Λίγα σύνν.', 'scattered clouds': 'Σύνν.', 'broken clouds': 'Σύνν.', 'overcast clouds': 'Συννεφιά', 'light rain': 'Ψιλόβρ.', 'moderate rain': 'Βροχή', 'heavy intensity rain': 'Δυνατή βροχή' },
  de: { 'clear sky': 'Klar', 'few clouds': 'Wolkig', 'scattered clouds': 'Wolkig', 'broken clouds': 'Wolkig', 'overcast clouds': 'Bedeckt', 'light rain': 'Leicht regen', 'moderate rain': 'Regen', 'heavy intensity rain': 'Starkregen' },
  it: { 'clear sky': 'Sereno', 'few clouds': 'Poche nubi', 'scattered clouds': 'Nuvole', 'broken clouds': 'Nuvole', 'overcast clouds': 'Coperto', 'light rain': 'Pioggia leg.', 'moderate rain': 'Pioggia', 'heavy intensity rain': 'Pioggia forte' },
  fr: { 'clear sky': 'Clair', 'few clouds': 'Nuages', 'scattered clouds': 'Nuages', 'broken clouds': 'Nuages', 'overcast clouds': 'Couvert', 'light rain': 'Pluie fine', 'moderate rain': 'Pluie', 'heavy intensity rain': 'Forte pluie' },
};

const seoCopy: Record<SupportedLanguage, { title: string; description: string; locale: string }> = {
  en: {
    title: 'CalmBeach Greece - Best Beach Today by Wind & Waves',
    description: 'Find a calmer beach in Greece today. CalmBeach compares live wind, waves, weather and beach exposure so you know where to swim with confidence.',
    locale: 'en_US',
  },
  gr: {
    title: 'Calm Beach Greece',
    description: 'Calm Beach Greece - Βρες την καλύτερη παραλία για σήμερα με βάση άνεμο, κύμα και καιρό.',
    locale: 'el_GR',
  },
  fr: {
    title: 'Calm Beach Greece',
    description: 'Calm Beach Greece - Trouvez la meilleure plage pour aujourd hui selon le vent, les vagues et la meteo.',
    locale: 'fr_FR',
  },
  de: {
    title: 'Calm Beach Greece',
    description: 'Calm Beach Greece - Finden Sie den besten Strand fuer heute basierend auf Wind, Wellen und Wetter.',
    locale: 'de_DE',
  },
  it: {
    title: 'Calm Beach Greece',
    description: 'Calm Beach Greece - Trova la spiaggia migliore per oggi in base a vento, onde e meteo.',
    locale: 'it_IT',
  },
};

const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant || beach.amenities?.parking)
);

const hasTopPickVisitorServices = (beach: Beach): boolean => {
  const metadataAmenities = beach.metadata?.amenities?.join(' ').toLowerCase() || '';

  return Boolean(
    beach.metadata?.organized === true ||
    beach.amenities?.organized ||
    beach.amenities?.beachBar ||
    beach.amenities?.sunbeds ||
    beach.amenities?.taverna ||
    beach.amenities?.restaurant ||
    /beach bar|sunbed|ξαπλώστρ|ομπρέλ|καφέ|cafe|ταβέρν|taverna|restaurant|εστιατόρ/.test(metadataAmenities)
  );
};

const hasTouristReadyTopPickProfile = (beach: Beach): boolean => {
  if (!hasMainstreamTopPickAccess(beach)) return false;

  return Boolean(
    hasTopPickVisitorServices(beach) ||
    beach.amenities?.parking ||
    beach.environment?.familyFriendly
  );
};

const isWindProtectedRecommendation = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel' | 'canClaimWindProtection'>): boolean => {
  return item.exposureLevel === 'protected' && item.canClaimWindProtection === true;
};

const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = 3;
const PROTECTED_FIRST_BEAUFORT = 5;
const MAX_TOP_RECOMMENDATION_BEAUFORT = 6;
const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;
const MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE = 5;
const BEACH_DAY_START_MINUTES = 10 * 60;
const BEACH_DAY_END_MINUTES = 18 * 60;
const MIN_REMAINING_TOP_PICK_SCORE = 62;
const DEFAULT_FORECAST_SLOT_MINUTES = 120;

const exposurePriority = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel'>): number => {
  if (isWindProtectedRecommendation(item)) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

const topPickProfilePriority = (item: SuitableBeach): number => {
  return exposurePriority(item);
};

const topPickPopularityScore = (beach: Beach): number => {
  return getBeachTouristRecognitionScore(beach);
};

const topPickAccessPriority = (beach: Beach): number => {
  const accessType = beach.metadata?.access?.type;
  if (hasDifficultTopPickAccess(beach)) return 5;
  if (accessType === 'asphalt_road') return 0;
  if (accessType === 'passable_dirt_road') return 1;
  if (accessType === 'hiking_path_easy') return 2;
  if (!accessType && beach.accessibility === Accessibility.EASY) return 0;
  if (!accessType && beach.accessibility === Accessibility.MODERATE) return 1;
  if (hasMainstreamTopPickAccess(beach)) return 3;
  return 4;
};

const topPickAmenitiesScore = (beach: Beach): number => {
  let score = 0;
  if (hasMainstreamFacilities(beach)) score += 8;
  if (hasTopPickVisitorServices(beach)) score += 6;
  if (beach.amenities?.parking) score += 4;
  if (beach.amenities?.naturalShade) score += 2;
  if (beach.environment?.familyFriendly) score += 2;
  return score;
};

const compareOptionalDistance = (a: SuitableBeach, b: SuitableBeach): number => {
  const aDistance = typeof a.distance === 'number' && Number.isFinite(a.distance) ? a.distance : undefined;
  const bDistance = typeof b.distance === 'number' && Number.isFinite(b.distance) ? b.distance : undefined;

  if (aDistance === undefined || bDistance === undefined) return 0;
  return aDistance - bDistance;
};

const compareTouristTopPickPriority = (a: SuitableBeach, b: SuitableBeach): number => {
  const popularityDiff = topPickPopularityScore(b.beach) - topPickPopularityScore(a.beach);
  if (Math.abs(popularityDiff) >= 1) return popularityDiff;

  const accessDiff = topPickAccessPriority(a.beach) - topPickAccessPriority(b.beach);
  if (accessDiff !== 0) return accessDiff;

  const distanceDiff = compareOptionalDistance(a, b);
  if (distanceDiff !== 0) return distanceDiff;

  const amenitiesDiff = topPickAmenitiesScore(b.beach) - topPickAmenitiesScore(a.beach);
  if (amenitiesDiff !== 0) return amenitiesDiff;

  return 0;
};

const hasHardTopPickAccessBlocker = (beach: Beach): boolean => (
  !hasMainstreamTopPickAccess(beach)
);

const isLessExposedTopPickCandidate = (item: SuitableBeach): boolean => {
  const lessExposed = item.exposureLevel === 'protected' || item.exposureLevel === 'partial';
  if (!lessExposed || hasHardTopPickAccessBlocker(item.beach)) return false;

  return Boolean(
    isWindProtectedRecommendation(item) ||
    hasTopPickVisitorServices(item.beach) ||
    hasTouristReadyTopPickProfile(item.beach) ||
    topPickPopularityScore(item.beach) >= 82
  );
};

const getWindPriorityTopPickPool = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  if (beaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  const lessExposed = items.filter(isLessExposedTopPickCandidate);
  return lessExposed.length > 0 ? lessExposed : items;
};

const bestShelteredRecommendationGroup = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  if (beaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  const bestPriority = Math.min(...items.map(topPickProfilePriority));
  return items.filter(item => topPickProfilePriority(item) === bestPriority);
};

const prioritizeProtectedRecommendations = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  const candidates = bestShelteredRecommendationGroup(items, beaufort);
  return [...candidates].sort((a, b) => {
    const profileDiff = topPickProfilePriority(a) - topPickProfilePriority(b);
    const exposureDiff = exposurePriority(a) - exposurePriority(b);
    const scoreDiff = b.score - a.score;
    const touristDiff = compareTouristTopPickPriority(a, b);

    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && profileDiff !== 0) return profileDiff;
    if (beaufort >= PROTECTED_FIRST_BEAUFORT) {
      if (exposureDiff !== 0) return exposureDiff;
      return touristDiff || scoreDiff;
    }
    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && exposureDiff !== 0 && Math.abs(scoreDiff) <= 12) {
      return exposureDiff;
    }
    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      return touristDiff || scoreDiff || exposureDiff;
    }
    return scoreDiff || exposureDiff;
  });
};

type TimeAwareSuitableBeach = SuitableBeach & {
  dynamicTopPickWindowScore?: number;
};

type GlobalBeachSearchEntry = {
  island: Island;
  beach: Beach;
  searchValues: string[];
  regionValues: string[];
};

type GlobalBeachSearchMatch = {
  island: Island;
  beach: Beach;
  score: number;
};

type DirectorySearchSuggestion = {
  id: string;
  type: 'region' | 'beach';
  label: string;
  subtitle: string;
  island: Island;
  beach?: Beach;
};

const clampTopPickScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const isSameCalendarDay = (a: Date, b: Date): boolean => (
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const lerpValue = (a: number, b: number, t: number): number => a + (b - a) * t;
// Shortest-path interpolation between two compass bearings (handles the 360→0 wrap).
const lerpAngleDeg = (a: number, b: number, t: number): number => {
  const diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) % 360 + 360) % 360;
};

// The weather API is 3-hourly, which makes the hour slider jump in big, abrupt
// steps. We linearly interpolate to 1-hour slots so the slider glides smoothly
// and the wind/colours transition between the real forecast anchors.
const interpolateHourlyForecast = (items: ForecastItem[], stepHours = 1): ForecastItem[] => {
  const sorted = [...items].sort((a, b) => a.dt - b.dt);
  if (sorted.length < 2) return sorted;

  const stepSec = stepHours * 3600;
  const result: ForecastItem[] = [];
  const lastDt = sorted[sorted.length - 1].dt;

  for (let dt = sorted[0].dt; dt <= lastDt; dt += stepSec) {
    const hiIndex = sorted.findIndex(item => item.dt >= dt);
    if (hiIndex === -1) break;
    const hi = sorted[hiIndex];
    if (hi.dt === dt || hiIndex === 0) {
      result.push({ ...hi, dt });
      continue;
    }
    const lo = sorted[hiIndex - 1];
    const t = (dt - lo.dt) / (hi.dt - lo.dt);
    result.push({
      ...lo,
      dt,
      main: { ...lo.main, temp: lerpValue(lo.main.temp, hi.main.temp, t) },
      wind: {
        ...lo.wind,
        speed: lerpValue(lo.wind.speed, hi.wind.speed, t),
        deg: lerpAngleDeg(lo.wind.deg, hi.wind.deg, t),
      },
      marine: lo.marine || hi.marine
        ? {
            ...(lo.marine ?? {}),
            ...(typeof lo.marine?.waveHeightM === 'number' && typeof hi.marine?.waveHeightM === 'number'
              ? { waveHeightM: lerpValue(lo.marine.waveHeightM, hi.marine.waveHeightM, t) }
              : {}),
          }
        : lo.marine,
    });
  }

  return result;
};

const getForecastMinutes = (item: ForecastItem): number => {
  const date = new Date(item.dt * 1000);
  return date.getHours() * 60 + date.getMinutes();
};

const getReferenceMinutes = (now: Date): number => now.getHours() * 60 + now.getMinutes();

const getForecastSlotEndMinutes = (items: ForecastItem[], index: number): number => {
  const currentMinutes = getForecastMinutes(items[index]);
  const next = items[index + 1];
  if (next) {
    const nextMinutes = getForecastMinutes(next);
    if (nextMinutes > currentMinutes && nextMinutes - currentMinutes <= 240) {
      return Math.min(BEACH_DAY_END_MINUTES, nextMinutes);
    }
  }

  return Math.min(BEACH_DAY_END_MINUTES, currentMinutes + DEFAULT_FORECAST_SLOT_MINUTES);
};

const getRemainingBeachHours = (
  hourlyForecast: ForecastItem[] | undefined,
  selectedDate: Date | undefined,
  now: Date
): Array<{ item: ForecastItem; startMinutes: number; endMinutes: number }> => {
  if (!hourlyForecast || hourlyForecast.length === 0 || !isSelectedDateToday(selectedDate, now)) return [];

  const referenceMinutes = getReferenceMinutes(now);
  const daytime = [...hourlyForecast]
    .filter(item => {
      const minutes = getForecastMinutes(item);
      return minutes >= BEACH_DAY_START_MINUTES && minutes <= BEACH_DAY_END_MINUTES;
    })
    .sort((a, b) => getForecastMinutes(a) - getForecastMinutes(b));

  return daytime
    .map((item, index) => ({
      item,
      startMinutes: getForecastMinutes(item),
      endMinutes: getForecastSlotEndMinutes(daytime, index),
    }))
    .filter(entry => entry.endMinutes > referenceMinutes);
};

const scoreRemainingTopPickHour = (beach: Beach, item: ForecastItem): number => {
  if (hasHourlyRainRisk(item)) return 0;

  const windSpeedKmph = item.wind.speed * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmph);
  const windDirection = degToCompass(item.wind.deg);
  const waveHeightM = item.marine?.waveHeightM;
  const exposure = assessBeachWindExposure({
    beach,
    windDirectionDeg: item.wind.deg,
    windDirection,
    windSpeedKmh: windSpeedKmph,
    beaufort,
    waveHeightMeters: waveHeightM,
    waveDirectionDegrees: item.marine?.waveDirectionDeg,
    wavePeriodSeconds: item.marine?.wavePeriodS,
    swellHeightMeters: item.marine?.swellWaveHeightM,
    swellDirectionDegrees: item.marine?.swellWaveDirectionDeg,
    seaSurfaceTemperature: item.marine?.seaSurfaceTemperatureC,
  });
  const isExposed = exposure.exposureLevel !== 'protected';
  const seaScore = calculateSeaConditionScore(isExposed, windSpeedKmph, exposure.exposureLevel, waveHeightM);
  const gustKmph = typeof item.wind.gustKnots === 'number'
    ? item.wind.gustKnots * 1.852
    : typeof item.wind.gust === 'number'
      ? item.wind.gust * 3.6
      : undefined;
  const gustSpread = typeof gustKmph === 'number' ? Math.max(0, gustKmph - windSpeedKmph) : 0;
  const hour = new Date(item.dt * 1000).getHours();
  const temp = item.main.temp;

  let score = seaScore * 10;
  if (exposure.canClaimProtected && beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) score += 6;
  if (exposure.exposureLevel === 'partial' && beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) score += 2;
  if (exposure.exposureLevel === 'exposed' && beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) score -= 10;
  if (exposure.isKnownWindSportRisk && beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) score -= 18;
  if (temp < 20) score -= (20 - temp) * 3;
  if (temp > 32) score -= (temp - 32) * 4;
  if (hour >= 12 && hour <= 16 && temp >= 32) score -= 8;
  if (gustSpread >= 25) score -= 12;
  else if (gustSpread >= 15) score -= 8;

  return clampTopPickScore(score);
};

const getRemainingTopPickWindow = (
  item: SuitableBeach,
  selectedDate: Date | undefined,
  now: Date,
  hourlyForecast?: ForecastItem[]
): { bestBeachTime: BestBeachTime; score: number } | undefined => {
  const entries = getRemainingBeachHours(hourlyForecast, selectedDate, now)
    .map(entry => ({
      ...entry,
      score: scoreRemainingTopPickHour(item.beach, entry.item),
    }));
  if (entries.length === 0) return undefined;

  const bestBeachTime = calculateBestBeachTime(entries.map(entry => entry.item), item.beach);
  if (!bestBeachTime) return undefined;

  const timing = getTopPickTiming(bestBeachTime, selectedDate, now);
  if (timing.state === 'unknown' || timing.state === 'expired') return undefined;

  const windowScores = entries
    .filter(entry => (
      timing.startMinutes !== undefined &&
      timing.endMinutes !== undefined &&
      entry.startMinutes >= timing.startMinutes &&
      entry.startMinutes < timing.endMinutes
    ))
    .map(entry => entry.score);
  const score = windowScores.length > 0
    ? windowScores.reduce((sum, value) => sum + value, 0) / windowScores.length
    : MIN_REMAINING_TOP_PICK_SCORE;

  return {
    score,
    bestBeachTime,
  };
};

const applyRemainingTopPickWindow = (
  item: SuitableBeach,
  selectedDate: Date | undefined,
  now: Date,
  hourlyForecast?: ForecastItem[]
): TimeAwareSuitableBeach => {
  const remainingWindow = getRemainingTopPickWindow(item, selectedDate, now, hourlyForecast);
  if (!remainingWindow) return item;

  return {
    ...item,
    bestBeachTime: remainingWindow.bestBeachTime,
    bestTimeWindow: remainingWindow.bestBeachTime.bestTimeWindow,
    timeReason: remainingWindow.bestBeachTime.timeReason,
    dynamicTopPickWindowScore: remainingWindow.score,
  };
};

const prioritizeDynamicTopPickWindows = (
  items: SuitableBeach[],
  selectedDate: Date | undefined,
  now: Date
): SuitableBeach[] => (
  !isSelectedDateToday(selectedDate, now)
    ? items
    :
  items
    .map((item, index) => ({
      item,
      index,
      timing: getTopPickTiming(item.bestBeachTime, selectedDate, now),
    }))
    .sort((a, b) => {
      const timingDiff = topPickTimingPriority(a.timing) - topPickTimingPriority(b.timing);
      if (timingDiff !== 0) return timingDiff;

      const scoreA = (a.item as TimeAwareSuitableBeach).dynamicTopPickWindowScore;
      const scoreB = (b.item as TimeAwareSuitableBeach).dynamicTopPickWindowScore;
      if (typeof scoreA === 'number' && typeof scoreB === 'number') {
        const scoreDiff = scoreB - scoreA;
        if (Math.abs(scoreDiff) >= 4) return scoreDiff;
      } else if (typeof scoreA === 'number') {
        return -1;
      } else if (typeof scoreB === 'number') {
        return 1;
      }

      if (a.timing.state === 'upcoming') {
        const startDiff = (a.timing.startMinutes ?? Number.MAX_SAFE_INTEGER) - (b.timing.startMinutes ?? Number.MAX_SAFE_INTEGER);
        if (startDiff !== 0) return startDiff;
      }

      return a.index - b.index;
    })
    .map(({ item }) => item)
);

const isStrongWindSuitableCandidate = (
  item: SuitableBeach,
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): boolean => {
  const itemWaveHeightM = item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
  const hasBlockingWarning = item.warnings?.some(warning =>
    warning.severity === 'critical' ||
    warning.type === 'rough_sea' ||
    warning.type === 'wind_sport_spot' ||
    (warning.type === 'exposed_to_wind' && item.exposureLevel === 'exposed')
  );

  return item.score >= 60 &&
    item.swimmingComfort !== 'avoid_swimming' &&
    seaScore >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE &&
    !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM) &&
    !hasBlockingWarning;
};

const isNoIdealFallbackCandidate = (
  item: SuitableBeach,
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): boolean => {
  const itemWaveHeightM = item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
  const hasHardExclusion = item.warnings?.some(warning =>
    warning.type === 'wind_sport_spot' ||
    (warning.type === 'exposed_to_wind' && item.exposureLevel === 'exposed')
  );

  return item.exposureLevel !== 'exposed' &&
    seaScore >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE &&
    !hasHardExclusion;
};

const getDefaultBeachListSort = (): SortOption => 'protected';

const beachMatchesMobileFilter = (
  beach: Beach,
  filter: FilterKey,
  defaultPreferences: UserPreferences
): boolean => {
  if (filter === 'showAll') return true;
  if (filter === 'easyAccess') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, easyAccess: true });
  }
  if (filter === 'sandy' || filter === 'pebbles') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, [filter]: true });
  }
  if (filter === 'deepWaters') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, deepWater: true });
  }
  if (filter === 'shallowWaters') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, shallowWater: true });
  }
  if (filter === 'beachBar') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, beachBar: true });
  }
  if (filter === 'parking') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, parking: true });
  }
  if (filter === 'snorkeling') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, snorkeling: true });
  }
  if (filter === 'adventure') {
    return isAdventureBeach(beach);
  }
  if (filter === 'familyFriendly') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, familyFriendly: true });
  }
  if (filter === 'quiet') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, quiet: true });
  }
  if (filter === 'surfing') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, surfing: true });
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

const readJsonArrayFromStorage = <T,>(key: string): T[] => {
  const saved = localStorage.getItem(key);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getWaveHeightBucket = (waveHeightM?: number): string => {
  if (typeof waveHeightM !== 'number' || !Number.isFinite(waveHeightM)) return 'unknown';
  if (waveHeightM < 0.3) return '0-0.3m';
  if (waveHeightM < 0.6) return '0.3-0.6m';
  if (waveHeightM < 1) return '0.6-1.0m';
  return '1.0m+';
};

const getWeatherMode = (hasWeatherError: boolean, hasActiveFixture: boolean): 'live' | 'fallback' | 'fixture' => {
  if (hasActiveFixture) return 'fixture';
  return hasWeatherError ? 'fallback' : 'live';
};

type RecommendationDisplayMode = 'mild' | 'caution' | 'strong' | 'no_ideal_swimming';

const getRecommendationDisplayMode = (
  beaufort: number,
  waveHeightM?: number,
  hasNoIdealSwimming = false
): RecommendationDisplayMode => {
  if (hasNoIdealSwimming) {
    return 'no_ideal_swimming';
  }

  if (beaufort >= 5 || (typeof waveHeightM === 'number' && waveHeightM >= 0.8)) {
    return 'strong';
  }

  if (beaufort >= 4 || (typeof waveHeightM === 'number' && waveHeightM >= 0.5)) {
    return 'caution';
  }

  return 'mild';
};

const getFavoredCoastPhrase = (windDirection: WindDirection, language: LanguageCode): string => {
  const phrases: Record<LanguageCode, Record<WindDirection, string>> = {
    en: {
      [WindDirection.N]: 'south and southeast beaches',
      [WindDirection.NE]: 'south and west beaches',
      [WindDirection.E]: 'west-facing beaches',
      [WindDirection.SE]: 'north and west beaches',
      [WindDirection.S]: 'north-facing beaches',
      [WindDirection.SW]: 'north and east beaches',
      [WindDirection.W]: 'east-facing beaches',
      [WindDirection.NW]: 'south and east beaches',
    },
    gr: {
      [WindDirection.N]: 'οι νότιες και νοτιοανατολικές παραλίες',
      [WindDirection.NE]: 'οι νότιες και δυτικές παραλίες',
      [WindDirection.E]: 'οι δυτικές παραλίες',
      [WindDirection.SE]: 'οι βόρειες και δυτικές παραλίες',
      [WindDirection.S]: 'οι βόρειες παραλίες',
      [WindDirection.SW]: 'οι βόρειες και ανατολικές παραλίες',
      [WindDirection.W]: 'οι ανατολικές παραλίες',
      [WindDirection.NW]: 'οι νότιες και ανατολικές παραλίες',
    },
    fr: {
      [WindDirection.N]: 'les plages au sud et sud-est',
      [WindDirection.NE]: 'les plages au sud et à l’ouest',
      [WindDirection.E]: 'les plages orientees ouest',
      [WindDirection.SE]: 'les plages au nord et à l’ouest',
      [WindDirection.S]: 'les plages orientees nord',
      [WindDirection.SW]: 'les plages au nord et à l’est',
      [WindDirection.W]: 'les plages orientees est',
      [WindDirection.NW]: 'les plages au sud et à l’est',
    },
    de: {
      [WindDirection.N]: 'sudliche und sudostliche Strande',
      [WindDirection.NE]: 'sudliche und westliche Strande',
      [WindDirection.E]: 'westlich ausgerichtete Strande',
      [WindDirection.SE]: 'nordliche und westliche Strande',
      [WindDirection.S]: 'nordlich ausgerichtete Strande',
      [WindDirection.SW]: 'nordliche und ostliche Strande',
      [WindDirection.W]: 'ostlich ausgerichtete Strande',
      [WindDirection.NW]: 'sudliche und ostliche Strande',
    },
    it: {
      [WindDirection.N]: 'le spiagge a sud e sud-est',
      [WindDirection.NE]: 'le spiagge a sud e ovest',
      [WindDirection.E]: 'le spiagge rivolte a ovest',
      [WindDirection.SE]: 'le spiagge a nord e ovest',
      [WindDirection.S]: 'le spiagge rivolte a nord',
      [WindDirection.SW]: 'le spiagge a nord e est',
      [WindDirection.W]: 'le spiagge rivolte a est',
      [WindDirection.NW]: 'le spiagge a sud e est',
    },
  };

  return getLocalizedCopy(language, phrases)[windDirection];
};

const getGeneralConditionsHelper = (
  mode: RecommendationDisplayMode,
  beaufort: number,
  windLabel: string,
  favoredCoasts: string,
  language: LanguageCode,
  waveHeightM?: number,
  selectedDate?: Date,
  // When per-beach local winds diverge too much (large/mountainous island, weak
  // wind) the single "favored coast" hint would contradict the map, so the
  // summary drops the leeward claim and points to per-beach colours instead —
  // staying consistent with the map's "locally variable wind" banner.
  isVariableWind = false
): string => {
  const sentenceDay = getSelectedDaySentencePrefix(selectedDate, new Date(), language);
  void waveHeightM;
  const wind = windLabel.toLocaleLowerCase();
  const copy = getLocalizedCopy(language, {
    en: {
      mild: () => `${sentenceDay} has ${beaufort} Beaufort ${wind} wind. Most beaches look suitable for swimming.`,
      caution: () => `${sentenceDay} has ${beaufort} Beaufort ${wind} wind. Wind starts to matter, so ${favoredCoasts} are generally favored.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay} has ${beaufort} Beaufort ${wind} wind. Most beaches look suitable for swimming.`;
        return beaufort <= 5
          ? `${sentenceDay} has ${beaufort} Beaufort ${wind} wind. Wind affects the beach choice, so ${favoredCoasts} are generally favored.`
          : `${sentenceDay} has ${beaufort} Beaufort ${wind} wind. There is no clearly calm swimming pick. If you go, ${favoredCoasts} are generally favored.`;
      },
      default: () => `${sentenceDay} has ${beaufort} Beaufort ${wind} wind. In these conditions, ${favoredCoasts} are generally favored.`,
      variableWind: () => `${sentenceDay} has ${beaufort} Beaufort wind that varies around the island. Check each beach's colour — sheltered spots differ by coast.`,
    },
    gr: {
      mild: () => `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`,
      caution: () => `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Ο άνεμος αρχίζει να παίζει ρόλο, οπότε γενικά προτιμώνται ${favoredCoasts}.`,
      noIdeal: () => {
        return `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`;
        return beaufort <= 5
        ? `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Ο άνεμος επηρεάζει την επιλογή, οπότε γενικά προτιμώνται ${favoredCoasts}.`
        : `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο. Αν πας, γενικά προτιμώνται ${favoredCoasts}.`;
      },
      default: () => `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Σε αυτές τις συνθήκες γενικά προτιμώνται ${favoredCoasts}.`,
      variableWind: () => `${sentenceDay} έχει ${beaufort} μποφόρ άνεμο που αλλάζει ανά περιοχή του νησιού. Δες το χρώμα κάθε παραλίας — τα απάγκια διαφέρουν ανά ακτή.`,
    },
    fr: {
      mild: () => `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. La plupart des plages semblent adaptees a la baignade.`,
      caution: () => `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Le vent compte davantage, donc ${favoredCoasts} sont favorisees.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. La plupart des plages semblent adaptees a la baignade.`;
        return beaufort <= 5
          ? `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Le vent influence le choix, donc ${favoredCoasts} sont favorisees.`
          : `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Aucun choix clairement calme. Si vous y allez, privilegiez ${favoredCoasts}.`;
      },
      default: () => `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Dans ces conditions, ${favoredCoasts} sont favorisees.`,
      variableWind: () => `${sentenceDay} : vent de ${beaufort} Beaufort variable autour de l'ile. Regardez la couleur de chaque plage — les abris varient selon la cote.`,
    },
    de: {
      mild: () => `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Die meisten Strande wirken zum Schwimmen geeignet.`,
      caution: () => `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Wind spielt starker mit, daher sind ${favoredCoasts} meist besser.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Die meisten Strande wirken zum Schwimmen geeignet.`;
        return beaufort <= 5
          ? `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Der Wind beeinflusst die Wahl, daher sind ${favoredCoasts} meist besser.`
          : `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Es gibt keine klar ruhige Badeoption. Wenn du gehst, sind ${favoredCoasts} meist besser.`;
      },
      default: () => `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Unter diesen Bedingungen sind ${favoredCoasts} meist besser.`,
      variableWind: () => `${sentenceDay}: ${beaufort} Bft Wind, der rund um die Insel wechselt. Achte auf die Farbe jedes Strands — geschützte Stellen variieren je nach Küste.`,
    },
    it: {
      mild: () => `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. La maggior parte delle spiagge sembra adatta al bagno.`,
      caution: () => `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. Il vento conta di piu, quindi ${favoredCoasts} sono favorite.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. La maggior parte delle spiagge sembra adatta al bagno.`;
        return beaufort <= 5
          ? `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. Il vento influenza la scelta, quindi ${favoredCoasts} sono favorite.`
          : `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. Non c'e una scelta chiaramente calma. Se vai, preferisci ${favoredCoasts}.`;
      },
      default: () => `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. In queste condizioni, ${favoredCoasts} sono favorite.`,
      variableWind: () => `${sentenceDay}: vento di ${beaufort} Beaufort variabile intorno all'isola. Guarda il colore di ogni spiaggia — i ripari cambiano a seconda della costa.`,
    },
  });

  // A variable wind only matters once the wind itself matters (>=3 Bft); below
  // that everything is calm and the "mild" copy already makes no coast claim.
  if (isVariableWind && beaufort >= 3 && mode !== 'mild') return copy.variableWind();
  if (mode === 'mild') return copy.mild();
  if (mode === 'caution') return copy.caution();
  if (mode === 'no_ideal_swimming') return copy.noIdeal();
  return copy.default();
};

const getBeachHourForecast = (forecast?: DailyForecast) => {
  if (!forecast?.hourly || forecast.hourly.length === 0) return [];

  const daytime = forecast.hourly.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 10 && hour <= 18;
  });

  return daytime.length >= 3 ? daytime : forecast.hourly.slice(0, 12);
};

const getUpcomingBeachHourForecast = (forecast?: DailyForecast, now: Date = new Date()) => (
  getBeachHourForecast(forecast).filter(item => item.dt * 1000 > now.getTime())
);

const getRainRiskSummary = (forecast?: DailyForecast, now: Date = new Date()): {
  hasRainRisk: boolean;
  allBeachHoursRainy: boolean;
  rainyTimes: string[];
  label: string;
} => {
  const allBeachHours = getBeachHourForecast(forecast);
  const beachHours = getUpcomingBeachHourForecast(forecast, now);
  const rainyHours = beachHours.filter(hasHourlyRainRisk);
  const weatherText = `${forecast?.weather?.main || ''} ${forecast?.weather?.description || ''}`.toLowerCase();
  const hasDailyRainIcon = allBeachHours.length === 0 && /rain|storm|thunder|drizzle|shower/.test(weatherText);
  const formatHour = (item: ForecastItem) => new Date(item.dt * 1000).toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const rainyTimes = rainyHours.map(formatHour);
  const hasRainRisk = rainyHours.length > 0 || hasDailyRainIcon;

  return {
    hasRainRisk,
    allBeachHoursRainy: beachHours.length > 0 && rainyHours.length === beachHours.length,
    rainyTimes,
    label: rainyTimes.length > 0 ? rainyTimes.slice(0, 4).join(', ') : '',
  };
};

const getHourlyWindIncreaseSummary = (forecast?: DailyForecast, now: Date = new Date()): {
  hasIncrease: boolean;
  maxBeaufort: number;
  label: string;
} => {
  const beachHours = getUpcomingBeachHourForecast(forecast, now);
  if (beachHours.length === 0) {
    return { hasIncrease: false, maxBeaufort: 0, label: '' };
  }

  const breezierHours = beachHours.filter(item => getBeaufortLevel(item.wind.speed * 3.6) >= 4);
  if (breezierHours.length === 0) {
    return { hasIncrease: false, maxBeaufort: 0, label: '' };
  }

  const formatHour = (item: ForecastItem) => new Date(item.dt * 1000).toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const maxBeaufort = Math.max(...breezierHours.map(item => getBeaufortLevel(item.wind.speed * 3.6)));

  return {
    hasIncrease: true,
    maxBeaufort,
    label: breezierHours.map(formatHour).slice(0, 3).join(', '),
  };
};

const getRainRiskCopy = (
  summary: ReturnType<typeof getRainRiskSummary>,
  language: LanguageCode,
  selectedDate?: Date
): { title: string; body: string } => {
  const hasSpecificTimes = summary.label.length > 0;
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const sentenceDay = getSelectedDaySentencePrefix(selectedDate, new Date(), language);
  const lowerSentenceDay = sentenceDay.toLocaleLowerCase();

  const copy = getLocalizedCopy(language, {
    en: {
      allTitle: 'Swimming is not recommended during the main beach hours because of rain',
      rainTitle: () => `Rain may affect the beach plan ${day}`,
      allBody: 'The forecast shows rain during the main beach hours, so beaches are not shown as suitable for swimming in that window.',
      timedBody: () => `Note that the forecast shows possible rain around ${summary.label}. Do not treat the beach as suitable for swimming during those hours.`,
      genericBody: 'Note that the day has a rain signal in the forecast. Beaches may be fine for wind and waves, but the recommendation only applies to drier windows.',
    },
    gr: {
      allTitle: 'Δεν προτείνεται μπάνιο στις βασικές ώρες λόγω βροχής',
      rainTitle: () => `Προσοχή στη βροχή ${day}`,
      allBody: `Η πρόγνωση δείχνει βροχή στις βασικές ώρες παραλίας, οπότε ${lowerSentenceDay} δεν θα εμφανίζονται παραλίες ως κατάλληλες για μπάνιο σε αυτό το διάστημα.`,
      timedBody: () => `Πρόσεξε όμως ότι η πρόγνωση δείχνει πιθανή βροχή γύρω στις ${summary.label}. Εκείνες τις ώρες καμία παραλία δεν είναι κατάλληλη.`,
      genericBody: 'Πρόσεξε όμως ότι υπάρχει ένδειξη βροχής στην πρόγνωση. Οι παραλίες μπορεί να είναι οκ από άνεμο/κύμα, αλλά η σύσταση ισχύει μόνο για στεγνά διαστήματα.',
    },
    fr: {
      allTitle: 'Baignade non recommandee aux heures principales a cause de la pluie',
      rainTitle: () => `La pluie peut affecter le plan plage ${day}`,
      allBody: 'La prévision indique de la pluie aux heures principales de plage, donc aucune plage n’est affichée comme adaptée à la baignade sur ce créneau.',
      timedBody: () => `La prevision indique une pluie possible vers ${summary.label}. Ne considerez pas la plage comme adaptee a ces heures.`,
      genericBody: 'La journee presente un risque de pluie. Les plages peuvent etre correctes cote vent et vagues, mais la recommandation vaut seulement sur les creneaux plus secs.',
    },
    de: {
      allTitle: 'Schwimmen ist zu den Haupt-Strandzeiten wegen Regen nicht empfohlen',
      rainTitle: () => `Regen kann den Strandplan ${day} beeinflussen`,
      allBody: 'Die Vorhersage zeigt Regen zu den Haupt-Strandzeiten, daher werden Strande in diesem Fenster nicht als geeignet angezeigt.',
      timedBody: () => `Die Vorhersage zeigt moglichen Regen um ${summary.label}. Behandle den Strand zu diesen Zeiten nicht als geeignet.`,
      genericBody: 'Die Vorhersage zeigt ein Regensignal. Fur Wind und Wellen kann es passen, aber die Empfehlung gilt nur fur trockenere Zeitfenster.',
    },
    it: {
      allTitle: 'Bagno non consigliato nelle ore principali per pioggia',
      rainTitle: () => `La pioggia puo influire sul piano spiaggia ${day}`,
      allBody: 'Le previsioni indicano pioggia nelle ore principali da spiaggia, quindi le spiagge non vengono mostrate come adatte al bagno in quella fascia.',
      timedBody: () => `Le previsioni indicano possibile pioggia verso ${summary.label}. Non considerare la spiaggia adatta in quelle ore.`,
      genericBody: 'La giornata ha un segnale di pioggia. Le spiagge possono andare bene per vento e onde, ma il consiglio vale solo nelle fasce piu asciutte.',
    },
  });

  return {
    title: summary.allBeachHoursRainy ? copy.allTitle : copy.rainTitle(),
    body: summary.allBeachHoursRainy
      ? copy.allBody
      : hasSpecificTimes
        ? copy.timedBody()
        : copy.genericBody,
  };
};

const withRainRiskContext = (
  description: string,
  summary: ReturnType<typeof getRainRiskSummary>,
  copy: ReturnType<typeof getRainRiskCopy>
) => {
  if (!summary.hasRainRisk) return description;
  return description ? `${description} ${copy.body}` : copy.body;
};

export const App: React.FC = () => {
  // --- UI & Language State ---
  const [language, setLanguage] = useState<SupportedLanguage>(() => getInitialLanguage());
  const t = translations[language];
  const isWinter = useMemo(() => isWinterSeason(), []);
  const activeWeatherFixtureScenario = useMemo(() => getActiveWeatherFixtureScenario(), []);
  const homeCopy = {
    recommendationMode: {
      mild: {
        title: {
          en: 'Most beaches look suitable',
      gr: 'Οι περισσότερες παραλίες φαίνονται κατάλληλες',
          de: 'Gute Startpunkte fuer heute',
          it: 'Buone opzioni da cui iniziare',
          fr: 'Bonnes options pour commencer',
        },
        helper: {
          en: 'Today the weather is mild, so most beaches look suitable for swimming.',
      gr: 'Σήμερα ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.',
          de: 'Heute ist das Wetter mild, daher passen die meisten Strande. Diese fallen eher durch Zugang, Strandtyp, Ausstattung und deine Vorlieben auf.',
          it: 'Oggi il meteo e mite, quindi la maggior parte delle spiagge va bene. Queste spiccano di piu per accesso, tipo di spiaggia, servizi e preferenze.',
          fr: 'La meteo est douce aujourd hui, donc la plupart des plages conviennent. Celles-ci ressortent surtout pour l acces, le type de plage, les services et tes preferences.',
        },
        cardLabel: {
          en: 'Suggested',
      gr: 'Πρόταση',
          de: 'Vorschlag',
          it: 'Suggerita',
          fr: 'Suggestion',
        },
      },
      caution: {
        title: {
          en: 'More comfortable options today',
      gr: 'Ιδανικότερες παραλίες σήμερα',
          de: 'Angenehmere Optionen heute',
          it: 'Opzioni piu comode oggi',
          fr: 'Options plus confortables aujourd hui',
        },
        helper: {
          en: 'Wind starts to matter today, so these options look more comfortable than exposed beaches.',
      gr: 'Σήμερα ο άνεμος αρχίζει να παίζει ρόλο, οπότε αυτές φαίνονται πιο άνετες από πιο εκτεθειμένες παραλίες.',
          de: 'Heute spielt der Wind eine groessere Rolle, daher wirken diese Optionen angenehmer als offenere Straende.',
          it: 'Oggi il vento inizia a contare, quindi queste opzioni sembrano piu comode delle spiagge esposte.',
          fr: 'Le vent commence a compter aujourd hui, donc ces options semblent plus confortables que les plages exposees.',
        },
        cardLabel: {
          en: 'More comfortable',
      gr: 'Πιο άνετη',
          de: 'Angenehmer',
          it: 'Piu comoda',
          fr: 'Plus confortable',
        },
      },
      strong: {
        title: {
          en: 'Most suitable options today',
      gr: 'Καταλληλότερες επιλογές σήμερα',
          de: 'Am besten handhabbare Optionen heute',
          it: 'Opzioni piu gestibili oggi',
          fr: 'Options les plus gerables aujourd hui',
        },
        helper: {
          en: 'Today the wind affects the beach choice. These look more suitable than more exposed beaches. This does not mean conditions are ideal.',
      gr: 'Σήμερα ο άνεμος επηρεάζει αρκετά τις επιλογές. Αυτές φαίνονται πιο κατάλληλες σε σχέση με πιο εκτεθειμένες παραλίες. Δεν σημαίνει ότι οι συνθήκες είναι ιδανικές.',
          de: 'Heute ist kein idealer Tag fuer ruhiges Schwimmen. Diese wirken besser handhabbar als exponierte Straende.',
          it: 'Oggi non e una giornata ideale per nuotare con mare calmo. Queste sembrano piu gestibili delle spiagge esposte.',
          fr: 'Ce n est pas une journee ideale pour une baignade calme. Ces options semblent plus gerables que les plages exposees.',
        },
      },
      no_ideal_swimming: {
        title: {
          en: 'No clear calm-swimming option today',
      gr: 'Δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο',
          de: 'Heute keine klare Option fuer ruhiges Schwimmen',
          it: 'Oggi nessuna opzione chiaramente tranquilla',
          fr: 'Aucune option clairement calme aujourd hui',
        },
        helper: {
          en: 'Wind and sea conditions make calm swimming unlikely today. These are only less exposed options if you still decide to go.',
      gr: 'Ο άνεμος και η θάλασσα κάνουν δύσκολο το ήρεμο μπάνιο σήμερα. Αυτές είναι μόνο λιγότερο εκτεθειμένες επιλογές αν αποφασίσεις να πας.',
          de: 'Wind und Meer machen ruhiges Schwimmen heute unwahrscheinlich. Das sind nur weniger exponierte Optionen, falls du trotzdem gehst.',
          it: 'Vento e mare rendono improbabile un bagno tranquillo oggi. Queste sono solo opzioni meno esposte se decidi comunque di andare.',
          fr: 'Le vent et la mer rendent une baignade calme peu probable aujourd hui. Ce sont seulement des options moins exposees si tu decides quand meme d y aller.',
        },
      },
    },
    manageableSortLabel: {
      en: 'More suitable',
      gr: 'Καταλληλότερες',
      de: 'Besser handhabbar',
      it: 'Piu gestibili',
      fr: 'Plus gerables',
    },
    lessExposedSortLabel: {
      en: 'Most suitable',
      gr: 'Καταλληλότερες',
      de: 'Am besten geeignet',
      it: 'Piu adatte',
      fr: 'Les plus adaptees',
    },
    beaches: { en: 'beaches', gr: 'παραλίες', fr: 'plages', de: 'Strände', it: 'spiagge' },
    wind: { en: 'wind', gr: 'άνεμος', fr: 'vent', de: 'Wind', it: 'vento' },
    selectLocation: { en: 'Select location', gr: 'Επίλεξε τοποθεσία', fr: 'Choisir une destination', de: 'Ort auswählen', it: 'Scegli località' },
    calmAllAroundTitle: {
      en: 'All beaches are suitable',
      gr: 'Όλες οι παραλίες είναι κατάλληλες',
      de: 'Heute sind alle Strande gut zum Baden',
      it: 'Oggi tutte le spiagge sono ottime per il bagno',
      fr: 'Aujourd hui toutes les plages sont parfaites pour se baigner',
    },
    calmMostBeachesTitle: {
      en: 'Most beaches look suitable',
      gr: 'Οι περισσότερες παραλίες φαίνονται κατάλληλες',
      de: 'Heute sind fast alle Strande gut zum Baden',
      it: 'Oggi quasi tutte le spiagge sono ottime per il bagno',
      fr: 'Aujourd hui presque toutes les plages sont parfaites pour se baigner',
    },
    lightWindDayTitle: {
      en: (beaufort: number) => `${beaufort} Beaufort. All beaches are suitable!`,
      gr: (beaufort: number) => `${beaufort} μποφόρ. Όλες οι παραλίες είναι κατάλληλες!`,
      de: (beaufort: number) => `${beaufort} Bft heute. Alle Strande sind geeignet.`,
      it: (beaufort: number) => `${beaufort} Bft oggi. Tutte le spiagge sono adatte.`,
      fr: (beaufort: number) => `${beaufort} Bft aujourd hui. Toutes les plages conviennent.`,
    },
    calmAllAroundDescription: {
      en: 'Today the weather is mild, so all beaches look suitable for swimming.',
      gr: 'Σήμερα ο καιρός είναι ήπιος, οπότε όλες οι παραλίες φαίνονται κατάλληλες για μπάνιο.',
      de: 'Der Wind ist leicht und das Meer wirkt ruhig. Es muss heute keine einzelne Top-Wahl geben. Entscheide nach Zugang, Sand/Kies, Schatten oder Stimmung.',
      it: 'Il vento e leggero e il mare sembra calmo, quindi non serve forzare una sola scelta top. Scegli per accesso, sabbia/ciottoli, ombra o atmosfera.',
      fr: 'Le vent est faible et la mer semble calme. Pas besoin de forcer un seul meilleur choix aujourd hui. Choisis selon l acces, le sable/galets, l ombre ou l ambiance.',
    },
    lightWindDayDescription: {
      en: 'Today the weather is mild, so most beaches look suitable for swimming.',
      gr: 'Σήμερα ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.',
      de: 'Wahle einfach nach Sand, Schatten, Zugang oder Stimmung.',
      it: 'Scegli quella che preferisci per sabbia, ombra, accesso o atmosfera.',
      fr: 'Choisis celle que tu preferes selon le sable, l ombre, l acces ou l ambiance.',
    },
    calmWindBadge: {
      en: (beaufort: number) => `${beaufort} Beaufort`,
      gr: (beaufort: number) => `${beaufort} μποφόρ`,
      de: (beaufort: number) => `${beaufort} Bft Wind`,
      it: (beaufort: number) => `${beaufort} Bft vento`,
      fr: (beaufort: number) => `${beaufort} Bft vent`,
    },
    calmSeaBadge: {
      en: (waveHeight?: number) => waveHeight === undefined ? 'Calm sea' : `${waveHeight.toFixed(1)} m waves`,
      gr: (waveHeight?: number) => waveHeight === undefined ? 'Ήρεμη θάλασσα' : `Κύμα ${waveHeight.toFixed(1)} μ`,
      de: (waveHeight?: number) => waveHeight === undefined ? 'Ruhiges Meer' : `${waveHeight.toFixed(1)}m Wellen`,
      it: (waveHeight?: number) => waveHeight === undefined ? 'Mare calmo' : `Onde ${waveHeight.toFixed(1)}m`,
      fr: (waveHeight?: number) => waveHeight === undefined ? 'Mer calme' : `Vagues ${waveHeight.toFixed(1)}m`,
    },
    calmBeachesBadge: {
      en: (count: number, total: number) => count >= total ? 'All beaches suitable' : `${count}/${total} beaches suitable`,
      gr: (count: number, total: number) => count >= total ? 'Όλες κατάλληλες για μπάνιο' : `${count}/${total} παραλίες κατάλληλες`,
      de: (count: number, total: number) => `${count}/${total} Strande angenehm`,
      it: (count: number, total: number) => `${count}/${total} spiagge comode`,
      fr: (count: number, total: number) => `${count}/${total} plages confortables`,
    },
    viewOnMap: { en: 'View on map', gr: 'Δες στον χάρτη', fr: 'Voir sur la carte', de: 'Auf Karte ansehen', it: 'Vedi sulla mappa' },
    mapTitle: { en: 'Interactive Map', gr: 'Διαδραστικός Χάρτης', fr: 'Carte interactive', de: 'Interaktive Karte', it: 'Mappa interattiva' },
    mapSubtitle: { en: 'Explore beaches on the map', gr: 'Εξερεύνησε τις παραλίες στον χάρτη', fr: 'Explore les plages sur la carte', de: 'Strände auf der Karte erkunden', it: 'Esplora le spiagge sulla mappa' },
    allBeaches: { en: 'All beaches', gr: 'Όλες οι παραλίες', fr: 'Toutes les plages', de: 'Alle Strände', it: 'Tutte le spiagge' },
    exploreTools: { en: 'All suitable beaches', gr: 'Όλες οι κατάλληλες παραλίες', fr: 'Toutes les plages adaptées', de: 'Alle geeigneten Strände', it: 'Tutte le spiagge adatte' },
    moreSuitableOptions: { en: 'More suitable options', gr: 'Περισσότερες κατάλληλες επιλογές', fr: 'Plus d’options adaptées', de: 'Weitere passende Optionen', it: 'Altre opzioni adatte' },
    lessExposedOptions: { en: 'Less exposed options', gr: 'Λιγότερο εκτεθειμένες επιλογές', fr: 'Options moins exposées', de: 'Weniger exponierte Optionen', it: 'Opzioni meno esposte' },
    mapLoadPrompt: { en: 'Loading map', gr: 'Φόρτωση χάρτη', fr: 'Chargement de la carte', de: 'Karte wird geladen', it: 'Caricamento mappa' },
    mapError: { en: 'The map did not load right now. The beach list is still available.', gr: 'Ο χάρτης δεν φορτώθηκε τώρα. Η λίστα παραλιών παραμένει διαθέσιμη.', fr: 'La carte ne s’est pas chargée pour le moment. La liste des plages reste disponible.', de: 'Die Karte wurde gerade nicht geladen. Die Strandliste bleibt verfügbar.', it: 'La mappa non si è caricata ora. La lista delle spiagge resta disponibile.' },
    weatherRetry: { en: 'Refresh', gr: 'Ανανέωση', fr: 'Actualiser', de: 'Aktualisieren', it: 'Aggiorna' },
    betaFeedbackTitle: { en: 'Tell us what you think', gr: 'Πες μας τη γνώμη σου', fr: 'Dis-nous ce que tu en penses', de: 'Sag uns deine Meinung', it: 'Dicci cosa ne pensi' },
    betaFeedbackBody: { en: 'Help us improve the recommendations.', gr: 'Βοήθησέ μας να βελτιώσουμε τις προτάσεις.', fr: 'Aide-nous à améliorer les recommandations.', de: 'Hilf uns, die Empfehlungen zu verbessern.', it: 'Aiutaci a migliorare i consigli.' },
    betaFeedbackCta: { en: 'Open form', gr: 'Άνοιγμα φόρμας', fr: 'Ouvrir le formulaire', de: 'Formular öffnen', it: 'Apri modulo' },
    tripPlanner: { en: 'Trip Planner', gr: 'Σχεδιασμός ταξιδιού', fr: 'Planificateur', de: 'Reiseplaner', it: 'Pianificatore' },
    aiAssistant: { en: 'AI Assistant', gr: 'AI Βοηθός', fr: 'Assistant IA', de: 'KI-Assistent', it: 'Assistente AI' },
  };
  const plannerProCopy = {
    title: {
      en: 'Holiday Planner is a Pro feature',
      title: { en: 'Planner is a Pro feature', gr: 'Το Planner είναι λειτουργία Pro', fr: 'Le Planner est une fonction Pro', de: 'Der Planner ist eine Pro-Funktion', it: 'Il Planner è una funzione Pro' },
      de: 'Der Urlaubsplaner ist eine Pro-Funktion',
      it: 'Il Planner vacanze e una funzione Pro',
      fr: 'Le planificateur de vacances est une fonction Pro',
    },
    description: {
      en: 'Pro creates a weather-aware holiday plan for each destination, matching beach days, calmer hours and backup ideas to the forecast.',
      description: { en: 'With Pro, it will build a holiday plan for each place, based on weather, sea, best beach hours, and backup options.', gr: 'Στο Pro θα φτιάχνει πρόγραμμα διακοπών για κάθε μέρος, με βάση τον καιρό, τη θάλασσα, τις καλύτερες ώρες για παραλία και εναλλακτικές επιλογές.', fr: 'Avec Pro, il construira un programme de vacances pour chaque lieu, selon la météo, la mer, les meilleures heures de plage et les options de secours.', de: 'Mit Pro erstellt es für jeden Ort einen Urlaubsplan, basierend auf Wetter, Meer, besten Strandzeiten und Ausweichoptionen.', it: 'Con Pro creerà un programma vacanze per ogni luogo, in base a meteo, mare, orari migliori per la spiaggia e alternative.' },
      de: 'Pro erstellt einen wetterbasierten Urlaubsplan je Reiseziel, mit Strandtagen, ruhigen Zeitfenstern und Alternativen passend zur Vorhersage.',
      it: 'Pro crea un programma vacanze per ogni destinazione in base a meteo, mare, orari migliori per la spiaggia e alternative.',
      fr: 'Pro cree un programme de vacances par destination selon la meteo, la mer, les meilleurs moments de plage et des alternatives.',
    },
    cta: {
      en: 'Available on Pro',
      cta: { en: 'Available in Pro', gr: 'Διαθέσιμο στο Pro', fr: 'Disponible en Pro', de: 'In Pro verfügbar', it: 'Disponibile in Pro' },
      de: 'In Pro verfugbar',
      it: 'Disponibile in Pro',
      fr: 'Disponible avec Pro',
    },
  };

  // --- Beach & Weather Data (Custom Hooks) ---
  const { allIslands, loading: beachesLoading, error: beachesError, getFilteredBeaches, ensureIslandBeachesLoaded, cacheLoadedIsland } = useBeaches(language);
  const { selectedIsland, selectIsland } = useLocation(allIslands);
  const { weather, forecast, beachForecasts, loading: weatherLoading, error: weatherError, selectedDayIndex, setSelectedDayIndex, loadWeatherData, lastUpdated } = useWeather(selectedIsland, language);
  const handleRegionSelected = (island: Island, source: 'selector' | 'nearest_location' = 'selector') => {
    trackEvent('region_changed', undefined, {
      locale: languageToLocale(language),
      region_id: island.id,
      region: island.name.en,
      region_group: island.group || 'other',
      source,
    });
    detailRequestRef.current += 1;
    setDetailDataStatus('idle');
    setDetailBeach(null);
    setView('home');
    selectIsland(island);

    if (typeof window !== 'undefined') {
      const nextPath = buildBeachRegionPath(island, language);
      const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.pushState({ view: 'home', regionId: island.id }, '', nextUrl);
      }
    }
  };

  // --- Functional State ---
  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('protected');
  const [mobileSuitableDistanceSort, setMobileSuitableDistanceSort] = useState(false);
  // The hour chosen on the map slider; drives both the map colours and the
  // suitable-beach recommendations so they all reflect the same moment.
  const [selectedHourDt, setSelectedHourDt] = useState<number | null>(null);
  const hasUserSelectedSortRef = useRef(false);
  const [topPickClock, setTopPickClock] = useState(() => Date.now());
  const [beachSearchQuery, setBeachSearchQuery] = useState('');
  const deferredBeachSearchQuery = React.useDeferredValue(beachSearchQuery);
  const [directorySearchSuggestions, setDirectorySearchSuggestions] = useState<DirectorySearchSuggestion[]>([]);
  const [isDirectorySearchSuggesting, setIsDirectorySearchSuggesting] = useState(false);
  const [regionBeachCounts, setRegionBeachCounts] = useState<Record<string, number>>({});
  const [detailBeach, setDetailBeach] = useState<Beach | null>(null);
  const [detailDataStatus, setDetailDataStatus] = useState<DetailDataStatus>('idle');
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  const [isMobileAllBeachesPanelOpen, setIsMobileAllBeachesPanelOpen] = useState(false);
  const [isMobileWeatherPanelOpen, setIsMobileWeatherPanelOpen] = useState(false);
  const [highlightedMapBeachId, setHighlightedMapBeachId] = useState<number | undefined>(undefined);
  const [isDirectoryMapFollowPaused, setIsDirectoryMapFollowPaused] = useState(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const [geospatialExposureProfiles, setGeospatialExposureProfiles] = useState<GeospatialExposureProfileLookup | undefined>(undefined);
  const [geospatialExposureRegionId, setGeospatialExposureRegionId] = useState<string | undefined>(undefined);
  const [isGeospatialExposureLoading, setIsGeospatialExposureLoading] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false
  ));
  const [desktopMapVisibleBeachIds, setDesktopMapVisibleBeachIds] = useState<number[] | null>(null);
  const [shouldLoadInsights, setShouldLoadInsights] = useState(false);

  // --- Modals State ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterModalResultCount, setFilterModalResultCount] = useState<number | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isIslandSelectorOpen, setIsIslandSelectorOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadBeachRegionIndex()
      .then(entries => {
        if (cancelled) return;
        setRegionBeachCounts(Object.fromEntries(entries.map(entry => [entry.id, entry.beachCount])));
      })
      .catch(error => {
        if (!cancelled) console.warn('Beach region counts unavailable for search suggestions.', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // --- Chat & AI State ---
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const chatSessionRef = useRef<Chat | null>(null);
  const detailRequestRef = useRef(0);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const insightsSectionRef = useRef<HTMLDivElement | null>(null);
  const trackedRecommendationsRef = useRef<string | null>(null);
  const trackedSearchRef = useRef<string | null>(null);
  const preserveSearchQueryOnRegionChangeRef = useRef(false);
  const globalBeachSearchIndexRef = useRef<Promise<GlobalBeachSearchEntry[]> | null>(null);
  const pendingDirectorySearchHighlightRef = useRef<number | undefined>(undefined);
  const trackedAppLoadedRef = useRef(false);
  const trackedPageViewRef = useRef<string | null>(null);
  const trackedWeatherFallbackRef = useRef<string | null>(null);
  const trackedEmptyResultsRef = useRef<string | null>(null);

  // --- User Preferences & Favorites ---
  const defaultPreferences: UserPreferences = useMemo(
    () => ({
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
    }),
    []
  );

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('userPreferences');
    if (!saved) return defaultPreferences;
    try {
      const parsed = JSON.parse(saved);
      return { ...defaultPreferences, ...(parsed || {}) };
    } catch {
      return defaultPreferences;
    }
  });

  const [favorites, setFavorites] = useState<number[]>(() => readJsonArrayFromStorage<number>('favorites'));

  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | undefined>(undefined);
  const [userLocationAccuracy, setUserLocationAccuracy] = useState<number | undefined>(undefined);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTopPickClock(Date.now()), 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getNearestBeachDistance = (userLoc: { lat: number; lon: number }, island: Island): number | undefined => {
    if (!island.beaches.length) return undefined;

    return island.beaches.reduce((nearestDistance, beach) => {
      const distance = calculateDistance(
        userLoc.lat,
        userLoc.lon,
        beach.coordinates.lat,
        beach.coordinates.lon
      );
      return Math.min(nearestDistance, distance);
    }, Number.POSITIVE_INFINITY);
  };

  const findNearestIsland = async (userLoc: { lat: number; lon: number }, islands: Island[]): Promise<Island | null> => {
    const centroidRanked = islands
      .map(island => ({
        island,
        centroidDistance: calculateDistance(userLoc.lat, userLoc.lon, island.coordinates.lat, island.coordinates.lon),
      }))
      .sort((a, b) => a.centroidDistance - b.centroidDistance);

    if (centroidRanked.length === 0) return null;

    const nearbyCandidates = centroidRanked.filter(candidate => candidate.centroidDistance <= 90);
    const candidates = (nearbyCandidates.length > 0 ? nearbyCandidates : centroidRanked).slice(0, 16);
    const regionIndex = await loadBeachRegionIndex().catch(() => []);
    const indexById = new Map(regionIndex.map(entry => [entry.id, entry] as const));

    const scoredCandidates = await Promise.all(candidates.map(async candidate => {
      let islandWithBeaches = candidate.island;

      if (islandWithBeaches.beaches.length === 0) {
        const entry = indexById.get(islandWithBeaches.id);
        try {
          islandWithBeaches = await loadAppReadyRegion(islandWithBeaches.id, {
            summaryDataPath: entry?.summaryDataPath,
            appDataPath: entry?.appDataPath,
          });
        } catch (error) {
          console.warn('Nearest-region beach lookup fell back to region center.', {
            regionId: islandWithBeaches.id,
            error,
          });
        }
      }

      const nearestBeachDistance = getNearestBeachDistance(userLoc, islandWithBeaches);
      return {
        island: islandWithBeaches,
        centroidDistance: candidate.centroidDistance,
        nearestBeachDistance,
        rankingDistance: nearestBeachDistance ?? candidate.centroidDistance,
      };
    }));

    scoredCandidates.sort((a, b) => {
      if (a.rankingDistance !== b.rankingDistance) return a.rankingDistance - b.rankingDistance;
      return a.centroidDistance - b.centroidDistance;
    });

    return scoredCandidates[0]?.island || centroidRanked[0].island;
  };

  // --- Nearest Island Handler ---
  const [isFindingNearest, setIsFindingNearest] = useState(false);
  const [findNearestError, setFindNearestError] = useState<string | null>(null);

  const handleSelectNearest = async () => {
    setIsFindingNearest(true);
    setFindNearestError(null);
    try {
      const position = await getAccuratePosition();
      const userLoc = { lat: position.coords.latitude, lon: position.coords.longitude };
      setUserLocation(userLoc);
      setUserLocationAccuracy(position.coords.accuracy);
      const nearest = await findNearestIsland(userLoc, allIslands);
      if (nearest) {
        handleRegionSelected(nearest, 'nearest_location');
        setIsIslandSelectorOpen(false);
      } else {
        setFindNearestError(getLocalizedCopy(language, {
          en: 'No nearby island found.',
    gr: 'Δεν βρέθηκε κοντινό νησί.',
          fr: 'Aucune ile proche trouvee.',
          de: 'Keine nahe Insel gefunden.',
          it: 'Nessuna isola vicina trovata.',
        }));
      }
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      if (geoErr.code === 1) {
        setFindNearestError(t.locationErrorPermission);
      } else if (geoErr.code === 2) {
        setFindNearestError(t.locationErrorUnavailable);
      } else {
        setFindNearestError(t.locationErrorTimeout);
      }
    } finally {
      setIsFindingNearest(false);
    }
  };

  // Resolves with the most accurate fix the device can give. Browsers often return
  // a stale, low-accuracy cached position from getCurrentPosition, so we force a
  // fresh high-accuracy read and keep refining via watchPosition until the reported
  // accuracy is tight enough (or a short window elapses).
  const getAccuratePosition = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject({ code: 2 } as GeolocationPositionError);
        return;
      }

      let best: GeolocationPosition | null = null;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        navigator.geolocation.clearWatch(watchId);
        window.clearTimeout(timeoutId);
        if (best) resolve(best);
        else reject({ code: 3 } as GeolocationPositionError);
      };

      const watchId = navigator.geolocation.watchPosition(
        position => {
          if (!best || position.coords.accuracy < best.coords.accuracy) {
            best = position;
          }
          // A fix within ~30m is plenty precise — stop early to save battery.
          if (position.coords.accuracy <= 30) finish();
        },
        error => {
          if (best) return; // keep the good fix we already have
          settled = true;
          window.clearTimeout(timeoutId);
          navigator.geolocation.clearWatch(watchId);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );

      const timeoutId = window.setTimeout(finish, 9000);
    });

  // Fetches the user's position to power the "sort by distance" view without
  // navigating away from the region they are currently browsing.
  const handleRequestUserLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFindNearestError(t.locationErrorUnavailable);
      return;
    }
    setIsFindingNearest(true);
    setFindNearestError(null);
    try {
      const position = await getAccuratePosition();
      setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
      setUserLocationAccuracy(position.coords.accuracy);
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      if (geoErr.code === 1) {
        setFindNearestError(t.locationErrorPermission);
      } else if (geoErr.code === 2) {
        setFindNearestError(t.locationErrorUnavailable);
      } else {
        setFindNearestError(t.locationErrorTimeout);
      }
    } finally {
      setIsFindingNearest(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  useEffect(() => {
    document.documentElement.lang = languageToLocale(language);
    const meta = seoCopy[language];
    const selectedIslandName = selectedIsland?.name[language] || selectedIsland?.name.en;
    const regionDescription = selectedIslandName
      ? getLocalizedCopy(language, {
        en: `${selectedIslandName} beaches in Greece. Compare live wind, waves, weather and beach exposure to find calmer swimming spots today.`,
    gr: `Παραλίες σε ${selectedIslandName}. Δες τον σημερινό άνεμο, το κύμα και τον καιρό πριν αποφασίσεις πού να κολυμπήσεις.`,
        fr: `Plages de ${selectedIslandName} en Grece. Verifiez le vent, les vagues et la meteo du jour avant de choisir ou nager.`,
        de: `Strande in ${selectedIslandName}, Griechenland. Pruefe Wind, Wellen und Wetter, bevor du den Strand waehlst.`,
        it: `Spiagge a ${selectedIslandName}, Grecia. Controlla vento, onde e meteo di oggi prima di scegliere dove nuotare.`,
      })
      : meta.description;
    const detailTitle = view === 'detail' && detailBeach
      ? `${displayBeachName(detailBeach.name, language)} Beach in ${selectedIslandName || 'Greece'} | CalmBeach Greece`
      : selectedIslandName
        ? `${selectedIslandName} Beaches Today | CalmBeach Greece`
        : meta.title;
    const detailDescription = view === 'detail' && detailBeach
      ? detailBeach.description?.[language] || detailBeach.description?.en || meta.description
      : regionDescription;
    const canonicalUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://calmbeach.gr/';

    document.title = detailTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', detailDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', detailTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', detailDescription);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', meta.locale);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', detailTitle);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', detailDescription);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
  }, [detailBeach, language, selectedIsland?.name, view]);

  useEffect(() => {
    const regionId = selectedIsland?.id;
    let cancelled = false;

    setGeospatialExposureProfiles(undefined);
    setGeospatialExposureRegionId(undefined);

    if (!regionId) {
      setIsGeospatialExposureLoading(false);
      return () => { cancelled = true; };
    }

    setIsGeospatialExposureLoading(true);
    loadGeospatialExposureProfiles(regionId).then(profiles => {
      if (!cancelled) {
        setGeospatialExposureProfiles(profiles);
        setGeospatialExposureRegionId(regionId);
        setIsGeospatialExposureLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setGeospatialExposureRegionId(regionId);
        setIsGeospatialExposureLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedIsland?.id]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 640px)');
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (selectedIsland && selectedIsland.beaches.length === 0) {
      void ensureIslandBeachesLoaded(selectedIsland.id);
    }
  }, [ensureIslandBeachesLoaded, selectedIsland?.id, selectedIsland?.beaches.length]);

  useEffect(() => {
    setShouldLoadMap(false);
    setDesktopMapVisibleBeachIds(null);
    setShouldLoadInsights(false);
    if (preserveSearchQueryOnRegionChangeRef.current) {
      preserveSearchQueryOnRegionChangeRef.current = false;
    } else {
      setBeachSearchQuery('');
    }
    setSelectedFilters([]);
  }, [selectedIsland?.id]);

  useEffect(() => {
    if (!isDesktopViewport) {
      setDesktopMapVisibleBeachIds(null);
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    if (shouldLoadMap) return;
    if (isDesktopViewport) return;
    const mapSection = mapSectionRef.current;
    if (!mapSection) return;

    if (!('IntersectionObserver' in window)) {
      setShouldLoadMap(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoadMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '260px 0px' }
    );

    observer.observe(mapSection);
    return () => observer.disconnect();
  }, [isDesktopViewport, selectedIsland?.id, shouldLoadMap]);

  useEffect(() => {
    if (!ENABLE_USAGE_INSIGHTS) return;
    if (shouldLoadInsights) return;
    const insightsSection = insightsSectionRef.current;
    if (!insightsSection) return;

    if (!('IntersectionObserver' in window)) {
      setShouldLoadInsights(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoadInsights(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(insightsSection);
    return () => observer.disconnect();
  }, [selectedIsland?.id, shouldLoadInsights]);

  // --- Handlers ---
  const handleLanguageChange = (nextLanguage: SupportedLanguage) => {
    if (nextLanguage === language) return;
    trackEvent('language_changed', undefined, {
      ...analyticsBaseParams,
      from_locale: languageToLocale(language),
      locale: languageToLocale(nextLanguage),
    });
    setLanguage(nextLanguage);
    saveLanguagePreference(nextLanguage);

    if (typeof window !== 'undefined' && selectedIsland) {
      const nextPath = view === 'detail' && detailBeach
        ? buildBeachDetailPath(selectedIsland, detailBeach, nextLanguage)
        : buildBeachRegionPath(selectedIsland, nextLanguage);
      const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.replaceState(
          {
            view,
            regionId: selectedIsland.id,
            beachId: view === 'detail' ? detailBeach?.id : undefined,
          },
          '',
          nextUrl
        );
      }
    }
  };

  const handleTogglePreference = (key: keyof UserPreferences) => {
    setPreferences(prev => {
      const isApplying = !prev[key];
      const updated = { ...prev, [key]: isApplying };
      localStorage.setItem('userPreferences', JSON.stringify(updated));
      if (isApplying) {
        trackEvent('filter_applied', undefined, {
          ...analyticsBaseParams,
          filter_name: String(key),
          source: 'preference_chip',
        });
      }
      return updated;
    });
  };

  const handleClearAdvancedFilter = (filter: FilterKey) => {
    trackEvent('filters_cleared', undefined, {
      ...analyticsBaseParams,
      source: 'remove_filter',
      filter_name: String(filter),
    });
    setSelectedFilters(prev => prev.filter(item => item !== filter));
  };

  const handleToggleAdvancedFilter = (filter: FilterKey) => {
    hasUserSelectedSortRef.current = true;
    setSortBy(defaultBeachListSort);
    setMobileSuitableDistanceSort(false);

    setSelectedFilters(prev => {
      const isActive = prev.includes(filter);
      if (!isActive) {
        trackEvent('filter_applied', undefined, {
          ...analyticsBaseParams,
          filter_name: String(filter),
          source: 'directory_home_advanced_filter',
        });
      }

      return isActive
        ? prev.filter(item => item !== filter)
        : [...prev.filter(item => item !== 'showAll'), filter];
    });
  };

  const handleClearSearchAndFilters = () => {
    trackEvent('filters_cleared', undefined, {
      ...analyticsBaseParams,
      source: 'clear_all',
      search_length: beachSearchQuery.trim().length,
      active_filter_count: selectedFilters.filter(filter => filter !== 'showAll').length,
      active_preference_count: Object.values(preferences).filter(Boolean).length,
    });
    setBeachSearchQuery('');
    hasUserSelectedSortRef.current = false;
    setSortBy(defaultBeachListSort);
    setMobileSuitableDistanceSort(false);
    setSelectedFilters([]);
    setPreferences(defaultPreferences);
    localStorage.setItem('userPreferences', JSON.stringify(defaultPreferences));
  };

  const handleDesktopMapVisibleBeachIdsChange = React.useCallback((visibleBeachIds: number[]) => {
    setDesktopMapVisibleBeachIds(previousIds => {
      if (
        previousIds &&
        previousIds.length === visibleBeachIds.length &&
        previousIds.every((id, index) => id === visibleBeachIds[index])
      ) {
        return previousIds;
      }

      return visibleBeachIds;
    });
  }, []);

  const handleSortChange = (nextSortBy: SortOption) => {
    hasUserSelectedSortRef.current = true;
    const normalizedSortBy = nextSortBy === 'recommended' ? defaultBeachListSort : nextSortBy;
    setSortBy(normalizedSortBy);
    if (normalizedSortBy !== 'protected') {
      setMobileSuitableDistanceSort(false);
    }
  };

  const handleDirectoryCategorySelect = (category: DirectoryCategory) => {
    trackEvent('filter_applied', undefined, {
      ...analyticsBaseParams,
      filter_name: category,
      source: 'directory_home_category',
    });

    hasUserSelectedSortRef.current = true;

    if (category === 'all') {
      handleClearSearchAndFilters();
      return;
    }

    setSortBy(defaultBeachListSort);
    setMobileSuitableDistanceSort(false);
    handleTogglePreference(category);
  };

  const handleToggleFavorite = (beachId: number) => {
    setFavorites(prev => {
      const isFavoriting = !prev.includes(beachId);
      trackEvent('favorite_clicked', beachId, {
        ...analyticsBaseParams,
        action: isFavoriting ? 'add' : 'remove',
      });
      const newFavs = isFavoriting ? [...prev, beachId] : prev.filter(id => id !== beachId);
      localStorage.setItem('favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const openBeachDetails = (beach: Beach, source: string, options: { updateUrl?: boolean } = {}) => {
    trackEvent('beach_card_clicked', beach.id, {
      ...analyticsBaseParams,
      source,
      beach_name: beach.name.en,
    });
    setDetailBeach(beach);
    setDetailDataStatus('loading');
    setView('detail');

    const regionId = selectedIsland?.id;
    if (options.updateUrl !== false && regionId && typeof window !== 'undefined') {
      const nextPath = buildBeachDetailPath(selectedIsland, beach, language);
      const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.pushState({ view: 'detail', regionId, beachId: beach.id }, '', nextUrl);
      }
    }

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    if (!regionId) {
      setDetailDataStatus('partial');
      return;
    }

    void loadBeachDetailData(regionId, beach.id)
      .then(detail => {
        if (detailRequestRef.current !== requestId) return;

        setDetailBeach(current => {
          if (!current || current.id !== beach.id) return current;
          return mergeBeachDetailData(current, detail);
        });
        setDetailDataStatus('ready');
      })
      .catch(error => {
        if (detailRequestRef.current !== requestId) return;
        console.warn('Beach detail data unavailable; showing summary beach data.', {
          regionId,
          beachId: beach.id,
          error,
        });
        setDetailDataStatus('partial');
      });
  };

  const closeBeachDetails = (options: { updateUrl?: boolean } = {}) => {
    detailRequestRef.current += 1;
    setView('home');
    setDetailDataStatus('idle');
    setDetailBeach(null);

    if (options.updateUrl !== false && typeof window !== 'undefined' && parseBeachDetailPath(window.location.pathname)) {
      const regionPath = selectedIsland ? buildBeachRegionPath(selectedIsland, language) : '/';
      window.history.replaceState(
        { view: 'home', regionId: selectedIsland?.id },
        '',
        `${regionPath}${window.location.search}${window.location.hash}`
      );
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const detailRoute = parseBeachDetailPath();
      const regionRoute = detailRoute || parseBeachRegionPath();
      const routeLanguage = detailRoute?.language ?? regionRoute?.language;
      if (routeLanguage && routeLanguage !== language) {
        setLanguage(routeLanguage);
      }
      if (regionRoute) {
        const routeIsland = allIslands.find(island => regionMatchesRouteParam(island, regionRoute.regionId));
        if (routeIsland) {
          selectIsland(routeIsland);
        }
      }

      detailRequestRef.current += 1;
      setDetailDataStatus('idle');
      setDetailBeach(null);
      setView('home');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [allIslands, language, selectIsland]);

  useEffect(() => {
    if (parseBeachDetailPath() || beachesLoading) return;

    const route = parseBeachRegionPath();
    if (!route) return;

    if (route.language && route.language !== language) {
      setLanguage(route.language);
    }

    const routeIsland = allIslands.find(island => regionMatchesRouteParam(island, route.regionId));
    if (!routeIsland) {
      console.warn('Beach region URL region was not found.', route);
      return;
    }

    if (!selectedIsland || !regionMatchesRouteParam(selectedIsland, route.regionId)) {
      selectIsland(routeIsland);
      void ensureIslandBeachesLoaded(routeIsland.id);
      return;
    }

    if (selectedIsland.beaches.length === 0) {
      void ensureIslandBeachesLoaded(routeIsland.id);
    }

    if (view === 'detail') {
      closeBeachDetails({ updateUrl: false });
    }
  }, [allIslands, beachesLoading, ensureIslandBeachesLoaded, language, selectedIsland, selectIsland, view]);

  useEffect(() => {
    const route = parseBeachDetailPath();
    if (!route || beachesLoading) return;

    if (route.language && route.language !== language) {
      setLanguage(route.language);
    }

    const routeIsland = allIslands.find(island => regionMatchesRouteParam(island, route.regionId));
    if (!routeIsland) {
      console.warn('Beach detail URL region was not found.', route);
      return;
    }

    if (!selectedIsland || !regionMatchesRouteParam(selectedIsland, route.regionId)) {
      selectIsland(routeIsland);
      void ensureIslandBeachesLoaded(routeIsland.id);
      return;
    }

    if (selectedIsland.beaches.length === 0) {
      void ensureIslandBeachesLoaded(routeIsland.id);
      return;
    }

    const routeBeach = selectedIsland.beaches.find(beach => beach.id === route.beachId);
    if (!routeBeach) {
      console.warn('Beach detail URL beach was not found.', route);
      return;
    }

    if (view === 'detail' && detailBeach?.id === route.beachId) return;

    openBeachDetails(routeBeach, 'url_deep_link', { updateUrl: false });
  }, [allIslands, beachesLoading, detailBeach?.id, ensureIslandBeachesLoaded, language, selectedIsland, view]);

  const handleWeatherRetry = () => {
    trackEvent('weather_retry_clicked', undefined, analyticsBaseParams);
    loadWeatherData();
  };

  const handleBetaFeedbackClick = () => {
    trackEvent('beta_feedback_clicked', undefined, {
      ...analyticsBaseParams,
      source: 'below_results',
    });
  };

  const scrollToBeachResultsSection = (preferredSection: 'suitable' | 'all' = 'all') => {
    const targetIds = preferredSection === 'suitable'
      ? ['suitable-beaches-section', 'all-beaches-section']
      : ['all-beaches-section', 'suitable-beaches-section'];

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = targetIds
          .map(id => document.getElementById(id))
          .find((element): element is HTMLElement => Boolean(element));
        scrollElementIntoView(target ?? null);
      });
    });
  };

  const scrollToMapSection = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(isDesktopViewport ? 'map-section-desktop' : 'map-section');
        scrollElementIntoView(target ?? null);
      });
    });
  };

  const closeMobileBottomPanels = () => {
    setIsMobileAllBeachesPanelOpen(false);
    setIsMobileWeatherPanelOpen(false);
  };

  useEffect(() => {
    setHighlightedMapBeachId(undefined);
  }, [beachSearchQuery, preferences, selectedFilters, selectedDayIndex, sortBy]);

  useEffect(() => {
    setHighlightedMapBeachId(undefined);
    setIsDirectoryMapFollowPaused(true);
  }, [selectedIsland?.id]);

  useEffect(() => {
    const pendingBeachId = pendingDirectorySearchHighlightRef.current;
    if (!pendingBeachId || !selectedIsland?.beaches.some(beach => beach.id === pendingBeachId)) return;

    pendingDirectorySearchHighlightRef.current = undefined;
    setHighlightedMapBeachId(pendingBeachId);
    setIsDirectoryMapFollowPaused(false);
    scrollToBeachResultsSection();
  }, [beachSearchQuery, selectedIsland]);

  const handleDirectoryMapUserInteraction = React.useCallback(() => {
    setIsDirectoryMapFollowPaused(true);
  }, []);

  const handleActiveDirectoryBeachChange = React.useCallback((beachId: number | undefined, options?: { resumeFollow?: boolean }) => {
    setHighlightedMapBeachId(beachId);
    if (options?.resumeFollow !== false) {
      setIsDirectoryMapFollowPaused(false);
    }
  }, []);

  const handleAllBeachesPanelOpenChange = (open: boolean) => {
    setIsMobileAllBeachesPanelOpen(false);
    setMobileTab('home');
    if (open) {
      scrollToBeachResultsSection();
    }
  };

  const handleWeatherPanelOpenChange = (open: boolean) => {
    setIsMobileWeatherPanelOpen(open);
    if (open) {
      setMobileTab('weather');
    } else {
      setMobileTab(current => current === 'weather' ? 'home' : current);
    }
  };

  const handleMobileTab = (tab: MobileTab) => {
    if (tab === 'chat' && !ENABLE_BEACH_BUDDY_CHAT) return;
    if (tab === 'planner' && !ENABLE_PLANNER_PRO) return;

    setMobileTab(tab);
    if (tab === 'chat') { closeMobileBottomPanels(); setIsChatOpen(true); return; }
    if (tab === 'planner') { closeMobileBottomPanels(); setIsPlannerOpen(true); return; }
    if (tab === 'home') {
      closeMobileBottomPanels();
      setIsChatOpen(false);
      setIsPlannerOpen(false);
      setIsFilterModalOpen(false);
      setIsIslandSelectorOpen(false);
      if (view === 'detail') closeBeachDetails();
      requestAnimationFrame(() => {
        scrollToPageTop();
      });
      return;
    }
    if (tab === 'weather') {
      if (!selectedIsland || !selectedForecast) {
        setMobileTab('home');
        return;
      }
      if (view === 'detail') closeBeachDetails();
      setIsMobileAllBeachesPanelOpen(false);
      setIsMobileWeatherPanelOpen(true);
      return;
    }
    if (tab === 'favorites') {
      closeMobileBottomPanels();
      if (view === 'detail') closeBeachDetails();
      scrollToBeachResultsSection();
    }
  };

  // --- CORE AI LOGIC (RTX 3090 / GEMINI) ---
  const handleChatSend = async (msg: string, model: string = 'google') => {
    if (!selectedIsland) return;
    
    const userMsg = { id: Date.now().toString(), text: msg, sender: 'user' };
    const loadingId = 'bot-loading-' + Date.now();
    setChatMessages(prev => [...prev, userMsg, { id: loadingId, text: '...', sender: 'bot' }]);

    try {
      const { initializeChat, sendMessage } = await import('./services/geminiService');
      if (!chatSessionRef.current && model === 'google') {
        chatSessionRef.current = initializeChat(selectedIsland.name[language], selectedIsland.beaches, language, t);
      }
      
      const aiResponse = await sendMessage(chatSessionRef.current, msg, model);

      setChatMessages(prev => prev.map(m => m.id === loadingId ? { ...m, text: aiResponse } : m));
    } catch (e) {
    return 'Παρουσιάστηκε σφάλμα στην απάντηση.';
    }
  };

  // --- Memos & Filtering Logic ---
  const selectedBeachForecasts = useMemo<BeachWeatherById>(() => {
    if (!forecast?.[selectedDayIndex]) return {};

    const forecastsByBeach: BeachWeatherById = {};
    Object.entries(beachForecasts).forEach(([beachId, context]) => {
      const beachForecast = context.forecast[selectedDayIndex];
      if (beachForecast) forecastsByBeach[Number(beachId)] = beachForecast;
    });
    return forecastsByBeach;
  }, [beachForecasts, forecast, selectedDayIndex]);

  // Per-beach cluster forecasts can disagree on wind direction across a large or
  // mountainous island (sea breezes, terrain channelling). When they spread
  // beyond a threshold, a single island-level compass arrow misrepresents the
  // map, so the wind banner switches to a "locally variable" state instead of
  // claiming one direction. Presentation only — the spread feeds the banner copy,
  // never the colours or scores. Measured per the selected hour's local winds.
  const mapWindDirectionSpreadDeg = useMemo(() => {
    const degs = Object.values(selectedBeachForecasts)
      .map(f => f?.wind?.deg)
      .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
    if (degs.length < 2) return 0;
    return maxWindDirectionSpread(degs);
  }, [selectedBeachForecasts]);

  // Per-beach local wind (direction + speed) for the map hover card, so a beach
  // coloured differently from the island headline is self-explanatory ("here it
  // blows N 7 km/h"). Falls back to the island wind when no cluster forecast.
  const mapBeachLocalWinds = useMemo<Record<number, { deg: number; speedKmh: number }>>(() => {
    const lookup: Record<number, { deg: number; speedKmh: number }> = {};
    Object.entries(selectedBeachForecasts).forEach(([beachId, forecast]) => {
      const deg = forecast?.wind?.deg;
      const speed = forecast?.wind?.speed;
      if (typeof deg === 'number' && Number.isFinite(deg) && typeof speed === 'number') {
        lookup[Number(beachId)] = { deg, speedKmh: speed * 3.6 };
      }
    });
    return lookup;
  }, [selectedBeachForecasts]);

  // --- Hour selection (map slider) ---
  const baseDailyForecast = forecast?.[selectedDayIndex];
  // Daytime hours available on the slider. For "today" we only expose the
  // current hour onward — you can't scrub back to the morning once it has passed.
  const mapHourSlots = useMemo(() => {
    const hourly = baseDailyForecast?.hourly;
    if (!hourly || hourly.length === 0) return [];
    const now = new Date();
    const day = baseDailyForecast?.date;
    const isToday = day ? isSameCalendarDay(day, now) : false;
    const daytime = hourly
      .filter(item => {
        const hour = new Date(item.dt * 1000).getHours();
        return hour >= 6 && hour <= 21;
      })
      .sort((a, b) => a.dt - b.dt);
    // Interpolate the 3-hourly forecast to 1-hour slots so the slider moves
    // smoothly instead of in big, abrupt jumps.
    let slots = interpolateHourlyForecast(daytime, 1);
    if (isToday) {
      const nowMs = now.getTime();
      const firstFutureIndex = slots.findIndex(slot => slot.dt * 1000 > nowMs);
      // Keep the slot that currently covers "now" (the last one at/just before now) and later.
      const currentIndex = firstFutureIndex === -1 ? slots.length - 1 : Math.max(0, firstFutureIndex - 1);
      slots = slots.slice(currentIndex);
    }
    return slots;
  }, [baseDailyForecast]);
  // Default: the current hour for today, otherwise the slot nearest midday.
  const defaultHourDt = useMemo(() => {
    if (mapHourSlots.length === 0) return null;
    const day = baseDailyForecast?.date;
    const isToday = day ? isSameCalendarDay(day, new Date()) : false;
    if (isToday) return mapHourSlots[0].dt;
    return mapHourSlots.reduce((prev, curr) => (
      Math.abs(new Date(curr.dt * 1000).getHours() - 13) < Math.abs(new Date(prev.dt * 1000).getHours() - 13)
        ? curr
        : prev
    )).dt;
  }, [mapHourSlots, baseDailyForecast]);
  useEffect(() => {
    setSelectedHourDt(defaultHourDt);
  }, [defaultHourDt]);
  // The forecast for the moment the user is looking at: the selected day, with
  // wind/marine/weather swapped to the chosen hour. Recommendations and the map
  // both derive from this, so they stay in sync as the slider moves.
  const selectedForecast = useMemo(() => {
    if (!baseDailyForecast) return undefined;
    if (selectedHourDt == null) return baseDailyForecast;
    // Prefer the interpolated slider slot (1-hour granularity); fall back to a
    // raw 3-hourly entry if needed.
    const hourItem = mapHourSlots.find(item => item.dt === selectedHourDt)
      ?? baseDailyForecast.hourly?.find(item => item.dt === selectedHourDt);
    if (!hourItem) return baseDailyForecast;
    return {
      ...baseDailyForecast,
      wind: hourItem.wind,
      marine: hourItem.marine ?? baseDailyForecast.marine,
      weather: hourItem.weather?.[0] ?? baseDailyForecast.weather,
    };
  }, [baseDailyForecast, mapHourSlots, selectedHourDt]);
  // Localized "time window" label for the selected slider hour (e.g. "στις 15:00–18:00"),
  // shown in the suitable-beach header so it reflects the moment, not just "today".
  const selectedHourPrefix = useMemo(() => {
    if (mapHourSlots.length === 0 || selectedHourDt == null) return undefined;
    const index = mapHourSlots.findIndex(slot => slot.dt === selectedHourDt);
    if (index === -1) return undefined;
    const locale = language === 'gr' ? 'el-GR' : languageToLocale(language);
    const formatHour = (dt: number) => new Date(dt * 1000).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const nextSlot = mapHourSlots[index + 1];
    const windowLabel = nextSlot
      ? `${formatHour(mapHourSlots[index].dt)}–${formatHour(nextSlot.dt)}`
      : formatHour(mapHourSlots[index].dt);
    return getLocalizedCopy(language, {
      en: `at ${windowLabel}`,
      gr: `στις ${windowLabel}`,
      fr: `à ${windowLabel}`,
      de: `um ${windowLabel}`,
      it: `alle ${windowLabel}`,
    });
  }, [mapHourSlots, selectedHourDt, language]);
  const mapForecastTimeLabel = useMemo(() => {
    if (mapHourSlots.length === 0 || selectedHourDt == null) return undefined;
    const index = mapHourSlots.findIndex(slot => slot.dt === selectedHourDt);
    if (index === -1) return undefined;
    const locale = language === 'gr' ? 'el-GR' : languageToLocale(language);
    const formatHour = (dt: number) => new Date(dt * 1000).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentSlot = mapHourSlots[index];
    const nextSlot = mapHourSlots[index + 1];
    const dayLabel = getSelectedDaySentencePrefix(new Date(currentSlot.dt * 1000), new Date(), language);
    const windowLabel = nextSlot
      ? `${formatHour(currentSlot.dt)}–${formatHour(nextSlot.dt)}`
      : formatHour(currentSlot.dt);
    return `${dayLabel} ${windowLabel}`;
  }, [mapHourSlots, selectedHourDt, language]);
  // Marker colours come from island-level wind + per-beach geometry (geospatial
  // profile), both available immediately. They do NOT need the per-beach cluster
  // forecasts (those only refine scores in the background), so we gate map
  // rendering only on the geometry load — otherwise markers stay blank for the
  // ~6s the background forecast task takes.
  const isMapExposureLoading = Boolean(
    selectedIsland &&
    (isGeospatialExposureLoading || geospatialExposureRegionId !== selectedIsland.id)
  );
  const topPickNow = useMemo(() => new Date(topPickClock), [topPickClock]);
  const defaultBeachListSort = useMemo(() => (
    getDefaultBeachListSort()
  ), []);

  useEffect(() => {
    if (hasUserSelectedSortRef.current || sortBy === defaultBeachListSort) return;
    setSortBy(defaultBeachListSort);
  }, [defaultBeachListSort, sortBy]);

  const getFilteredBeachResults = useMemo(() => (
    (filters: FilterKey[], nextSortBy: SortOption): Beach[] => {
    if (!selectedIsland) return [];

    const hasBeachSearchQuery = beachSearchQuery.trim().length > 0;
    let beaches = filterBeachesByUserPreferences(selectedIsland.beaches, preferences);
    const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : WindDirection.N;
    const selectedBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
      const effectiveSortBy = (hasBeachSearchQuery && nextSortBy === 'recommended') || (selectedBeaufort < 4 && nextSortBy === 'recommended') ? 'all' : nextSortBy;

    if (!hasBeachSearchQuery && selectedForecast && effectiveSortBy === 'recommended') {
      const waveHeightM = selectedForecast.marine?.waveHeightM;
      const weatherSuitableBeaches = beaches.filter(beach => {
        const beachSpecificForecast = selectedBeachForecasts[beach.id];
        const beachForecast = beachSpecificForecast || selectedForecast;
        const beachWindSpeedKmph = beachForecast.wind.speed * 3.6;
        const beachWaveHeightM = beachForecast.marine?.waveHeightM ?? waveHeightM;
        const scoreResult = calculateBeachScore(beach, beachForecast, userLocation, preferences, {
          weatherSource: beachSpecificForecast ? 'beach-cluster' : 'island-fallback',
          hourlyForecast: beachForecast.hourly || selectedForecast.hourly,
          geospatialProfile: geospatialExposureProfiles?.[beach.id],
        });
        const isExposed = scoreResult.exposureLevel ? scoreResult.exposureLevel !== 'protected' : true;
        return !hasPoorSeaConditions(isExposed, beachWindSpeedKmph, scoreResult.exposureLevel, beachWaveHeightM);
      });
      beaches = weatherSuitableBeaches.length > 0 ? weatherSuitableBeaches : beaches;
    }

      const result = getFilteredBeaches(beaches, filters, beachSearchQuery, effectiveSortBy, windDirection, selectedForecast, userLocation, preferences);
    return result;
    }
  ), [beachSearchQuery, geospatialExposureProfiles, getFilteredBeaches, preferences, selectedBeachForecasts, selectedForecast, selectedIsland, userLocation]);

  const filteredBeaches = useMemo(() => (
    getFilteredBeachResults(selectedFilters, sortBy)
  ), [getFilteredBeachResults, selectedFilters, sortBy]);

  useEffect(() => {
    if (!isFilterModalOpen) return;
    setFilterModalResultCount(getFilteredBeachResults(selectedFilters, sortBy).length);
  }, [getFilteredBeachResults, isFilterModalOpen, selectedFilters, sortBy]);

  const suitableBeaches = useMemo(() => {
    if (!selectedIsland || !selectedForecast) return [];
    return getSuitableBeaches(selectedIsland.beaches, selectedForecast, language, userLocation, selectedForecast.hourly, preferences, selectedBeachForecasts, geospatialExposureProfiles);
  }, [selectedIsland, selectedForecast, language, userLocation, preferences, selectedBeachForecasts, geospatialExposureProfiles]);

  const mapSuitableBeaches = useMemo<SuitableBeach[]>(() => {
    if (!selectedIsland) return [];

    return selectedIsland.beaches.map(beach => {
      const geospatialExposure = geospatialExposureProfiles?.[beach.id];
      // Attach the straight-line distance from the user so the directory can
      // sort beaches nearest-first when "Κοντά μου" is active.
      const distance = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon)
        : undefined;

      if (!selectedForecast) {
        return {
          beachId: beach.id,
          name: displayBeachName(beach.name, language),
          score: 75,
          explanation: '',
          beach,
          isExposed: true,
          canClaimWindProtection: false,
          seaCalmClaimAllowed: false,
          distance,
          geospatialExposure,
        };
      }

      const beachSpecificForecast = selectedBeachForecasts[beach.id];
      const beachForecast = beachSpecificForecast || selectedForecast;
      const scoreResult = calculateBeachScore(beach, beachForecast, userLocation, preferences, {
        weatherSource: beachSpecificForecast ? 'beach-cluster' : 'island-fallback',
        hourlyForecast: beachForecast.hourly || selectedForecast.hourly,
        geospatialProfile: geospatialExposure,
      });

      return {
        beachId: beach.id,
        name: displayBeachName(beach.name, language),
        score: scoreResult.score,
        explanation: '',
        beach,
        isExposed: scoreResult.exposureLevel ? scoreResult.exposureLevel !== 'protected' : true,
        exposureLevel: scoreResult.exposureLevel,
        orientation: scoreResult.orientation,
        windProfile: scoreResult.windProfile,
        windProfileSource: scoreResult.windProfileSource,
        windSector: scoreResult.windSector,
        waveHeightM: scoreResult.waveHeightM,
        warnings: scoreResult.warnings,
        confidence: scoreResult.confidence,
        swimmingComfort: scoreResult.swimmingComfort,
        canClaimWindProtection: scoreResult.canClaimWindProtection,
        seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed,
        simpleWindSuitability: scoreResult.simpleWindSuitability,
        windExposureReason: describeSimpleWindSuitability(scoreResult.simpleWindSuitability, language),
        distance,
        geospatialExposure,
      };
    });
  }, [geospatialExposureProfiles, language, preferences, selectedBeachForecasts, selectedForecast, selectedIsland, userLocation]);

  const dailySuitableBeaches = useMemo(() => {
    if (!selectedIsland || !selectedForecast) return [];
    return getSuitableBeaches(selectedIsland.beaches, selectedForecast, language, undefined, selectedForecast.hourly, undefined, selectedBeachForecasts, geospatialExposureProfiles);
  }, [selectedIsland, selectedForecast, language, selectedBeachForecasts, geospatialExposureProfiles]);

  const hasActivePreferenceFilters = useMemo(() => {
    return Object.values(preferences).some(Boolean);
  }, [preferences]);

  const hasActiveSearchOrFilters = useMemo(() => {
    return (
      beachSearchQuery.trim().length > 0 ||
      sortBy !== defaultBeachListSort ||
      selectedFilters.some(filter => filter !== 'showAll') ||
      hasActivePreferenceFilters
    );
  }, [beachSearchQuery, defaultBeachListSort, sortBy, selectedFilters, hasActivePreferenceFilters]);
  const filteredMapSuitableBeaches = useMemo(() => {
    if (!hasActiveSearchOrFilters) return mapSuitableBeaches;

    const filteredBeachIds = new Set(filteredBeaches.map(beach => beach.id));
    return mapSuitableBeaches.filter(item => filteredBeachIds.has(item.beach.id));
  }, [filteredBeaches, hasActiveSearchOrFilters, mapSuitableBeaches]);
  const isProtectedSortOnly = useMemo(() => {
    return sortBy === 'protected' &&
      beachSearchQuery.trim().length === 0 &&
      selectedFilters.every(filter => filter === 'showAll') &&
      !hasActivePreferenceFilters;
  }, [beachSearchQuery, hasActivePreferenceFilters, selectedFilters, sortBy]);

  const recommendedSuitableBeaches = useMemo(() => {
    if (!selectedForecast) return [];
    const recommendationSource = hasActivePreferenceFilters ? suitableBeaches : dailySuitableBeaches;
    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const beaufort = getBeaufortLevel(windSpeedKmph);
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    const candidates = recommendationSource.filter(item => {
      if (!isTrustedTopRecommendationCandidate(item, undefined, beaufort)) return false;

      const itemWaveHeightM = item.waveHeightM ?? waveHeightM;
      const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
      const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;

      return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
        hasGoodHourlySea &&
        !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
    }).map(item => applyRemainingTopPickWindow(
      item,
      selectedForecast.date,
      topPickNow,
      selectedBeachForecasts[item.beach.id]?.hourly || selectedForecast.hourly
    ));
    const topPickPool = getWindPriorityTopPickPool(candidates, beaufort);
    const protectedPriority = prioritizeProtectedRecommendations(topPickPool, beaufort);
    return prioritizeDynamicTopPickWindows(protectedPriority, selectedForecast.date, topPickNow);
  }, [selectedForecast, dailySuitableBeaches, hasActivePreferenceFilters, selectedBeachForecasts, suitableBeaches, topPickNow]);
  const topRecommendedSuitableBeaches = useMemo(() => (
    recommendedSuitableBeaches.slice(0, getTopRecommendationDisplayLimit(recommendedSuitableBeaches.length))
  ), [recommendedSuitableBeaches]);
  const currentBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
  const isSevereWindNoTopRecommendationDay = currentBeaufort > MAX_TOP_RECOMMENDATION_BEAUFORT;
  const desktopMapVisibleBeachIdSet = useMemo(() => (
    desktopMapVisibleBeachIds ? new Set(desktopMapVisibleBeachIds) : null
  ), [desktopMapVisibleBeachIds]);
  const isDesktopMapViewportFilterActive = Boolean(isDesktopViewport && desktopMapVisibleBeachIdSet);
  const mapViewportBeaches = useMemo(() => {
    if (!selectedIsland) return [];
    if (!isDesktopMapViewportFilterActive || !desktopMapVisibleBeachIdSet) {
      return selectedIsland.beaches;
    }

    return selectedIsland.beaches.filter(beach => desktopMapVisibleBeachIdSet.has(beach.id));
  }, [desktopMapVisibleBeachIdSet, isDesktopMapViewportFilterActive, selectedIsland]);
  const preferenceFilterResultCounts = useMemo(() => {
    if (!selectedIsland || selectedIsland.beaches.length === 0) {
      return {} as Partial<Record<keyof UserPreferences, number>>;
    }

    const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : WindDirection.N;
    const selectedBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
    const effectiveSortBy = selectedBeaufort < 4 && sortBy === 'recommended' ? 'all' : sortBy;

    return QUICK_PREFERENCE_FILTERS.reduce((counts, key) => {
      const nextPreferences = { ...preferences, [key]: true };
      const matchingPreferenceBeaches = filterBeachesByUserPreferences(mapViewportBeaches, nextPreferences);
      counts[key] = getFilteredBeaches(
        matchingPreferenceBeaches,
        selectedFilters,
        beachSearchQuery,
        effectiveSortBy,
        windDirection
      ).length;
      return counts;
    }, {} as Partial<Record<keyof UserPreferences, number>>);
  }, [beachSearchQuery, getFilteredBeaches, mapViewportBeaches, preferences, selectedFilters, selectedForecast, selectedIsland, sortBy]);
  const desktopAdvancedFilterResultCounts = useMemo(() => {
    if (!selectedIsland || selectedIsland.beaches.length === 0) {
      return {} as Partial<Record<FilterKey, number>>;
    }

    const desktopAdvancedFilterKeys: FilterKey[] = [
      'naturalShade',
      'taverna',
      'sunbeds',
      'parking',
      'sandy-pebbles',
      'rocky',
      'adventure',
    ];
    const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : WindDirection.N;
    const selectedBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
    const effectiveSortBy = selectedBeaufort < 4 && sortBy === 'recommended' ? 'all' : sortBy;
    const baseBeaches = filterBeachesByUserPreferences(mapViewportBeaches, preferences);

    return desktopAdvancedFilterKeys.reduce((counts, key) => {
      const nextFilters = selectedFilters.includes(key)
        ? selectedFilters
        : [...selectedFilters.filter(filter => filter !== 'showAll'), key];

      counts[key] = getFilteredBeaches(
        baseBeaches,
        nextFilters,
        beachSearchQuery,
        effectiveSortBy,
        windDirection,
        selectedForecast,
        userLocation,
        preferences
      ).length;
      return counts;
    }, {} as Partial<Record<FilterKey, number>>);
  }, [beachSearchQuery, getFilteredBeaches, mapViewportBeaches, preferences, selectedFilters, selectedForecast, selectedIsland, sortBy, userLocation]);
  const mobileFilterKeys = useMemo(() => (
    Object.keys(t.filterOptions)
      .filter(key => key !== 'showAll' && key !== 'restaurant' && key !== 'unknown') as FilterKey[]
  ), [t.filterOptions]);
  const availableMobileFilterKeys = useMemo(() => {
    if (!selectedIsland || selectedIsland.beaches.length === 0) {
      return mobileFilterKeys;
    }

    return mobileFilterKeys.filter(filter => (
      selectedFilters.includes(filter) ||
      selectedIsland.beaches.some(beach => beachMatchesMobileFilter(beach, filter, defaultPreferences))
    ));
  }, [defaultPreferences, mobileFilterKeys, selectedFilters, selectedIsland]);
  const currentWeatherMode = getWeatherMode(Boolean(weatherError), Boolean(activeWeatherFixtureScenario));
  const currentWaveHeightBucket = getWaveHeightBucket(selectedForecast?.marine?.waveHeightM);
  const rainRiskSummary = useMemo(() => getRainRiskSummary(selectedForecast, topPickNow), [selectedForecast, topPickNow]);
  const rainRiskCopy = useMemo(() => getRainRiskCopy(rainRiskSummary, language, selectedForecast?.date), [language, rainRiskSummary, selectedForecast?.date]);
  const hourlyWindIncreaseSummary = useMemo(() => getHourlyWindIncreaseSummary(selectedForecast, topPickNow), [selectedForecast, topPickNow]);
  const isRainBlockedBeachWindow = rainRiskSummary.allBeachHoursRainy;
  const analyticsBaseParams = useMemo(() => ({
    locale: languageToLocale(language),
    region_id: selectedIsland?.id || 'unknown',
    region: selectedIsland?.name.en || 'unknown',
    weather_mode: currentWeatherMode,
    wind_beaufort: currentBeaufort,
    wave_height_bucket: currentWaveHeightBucket,
  }), [currentBeaufort, currentWaveHeightBucket, currentWeatherMode, language, selectedIsland?.id, selectedIsland?.name.en]);
  const betaFeedbackUrl = useMemo(() => buildBetaFeedbackUrl({
    locale: languageToLocale(language),
    regionId: selectedIsland?.id,
    regionName: selectedIsland?.name.en,
  }), [language, selectedIsland?.id, selectedIsland?.name.en]);
  const isUnsafeWinter = isWinter && currentBeaufort > 4;
  const isWaitingForForecast = Boolean(selectedIsland && !selectedForecast && !weatherError && !isUnsafeWinter);

  useEffect(() => {
    if (trackedAppLoadedRef.current || !selectedIsland) return;
    trackedAppLoadedRef.current = true;
    trackEvent('app_loaded', undefined, analyticsBaseParams);
  }, [analyticsBaseParams, selectedIsland]);

  useEffect(() => {
    if (!selectedIsland) return;
    const pagePath = typeof window !== 'undefined'
      ? window.location.pathname
      : view === 'detail' && detailBeach
        ? buildBeachDetailPath(selectedIsland, detailBeach, language)
        : buildBeachRegionPath(selectedIsland, language);
    const trackingKey = `${pagePath}:${selectedIsland.id}:${detailBeach?.id || 'home'}`;
    if (trackedPageViewRef.current === trackingKey) return;

    trackedPageViewRef.current = trackingKey;
    trackPageView(pagePath, {
      ...analyticsBaseParams,
      view,
      beach_id: detailBeach?.id ? String(detailBeach.id) : undefined,
    });
  }, [analyticsBaseParams, detailBeach?.id, selectedIsland, view]);

  useEffect(() => {
    if (!weatherError || !selectedIsland) return;
    const trackingKey = `${selectedIsland.id}:${weatherError}`;
    if (trackedWeatherFallbackRef.current === trackingKey) return;
    trackedWeatherFallbackRef.current = trackingKey;
    trackEvent('weather_fallback_shown', undefined, {
      ...analyticsBaseParams,
      weather_mode: 'fallback',
    });
  }, [analyticsBaseParams, selectedIsland, weatherError]);

  const calmAllAroundSummary = useMemo(() => {
    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedIsland || !selectedForecast || selectedIsland.beaches.length === 0 || isUnsafeWinter) return null;

    const weatherText = `${selectedForecast.weather.main} ${selectedForecast.weather.description}`.toLowerCase();
    const hasSevereBlockingWeather = /thunder|storm|snow|squall|heavy rain|rainstorm/.test(weatherText) && rainRiskSummary.hasRainRisk;
    const hasRainOrStorm = /rain|storm|thunder|snow|drizzle/.test(weatherText);
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    const hasCalmSea = waveHeightM === undefined || waveHeightM <= 0.4;
    const warmEnoughForSwimming = selectedForecast.temp_max >= 20;
    if (currentBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT || hasSevereBlockingWeather) return null;

    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const comfortableBeaches = dailySuitableBeaches.filter(item => {
      const hasSeriousWarning = item.warnings?.some(warning =>
        warning.severity === 'critical' ||
        warning.type === 'rough_sea' ||
        warning.type === 'strong_wind'
      );
      return item.score >= 70 &&
        !hasSeriousWarning &&
        !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, item.waveHeightM ?? waveHeightM);
    });

    const totalBeachCount = selectedIsland.beaches.length;
    const hasGreatSwimmingWeather = !hasRainOrStorm && !rainRiskSummary.hasRainRisk && hasCalmSea && warmEnoughForSwimming;
    const hasBroadlySuitableLightWindDay = currentBeaufort <= 2;
    const comfortableRatio = comfortableBeaches.length / totalBeachCount;
    const suitableBeachCount = hasBroadlySuitableLightWindDay ? totalBeachCount : dailySuitableBeaches.length;
    const suitableRatio = suitableBeachCount / totalBeachCount;

    return {
      totalBeachCount,
      suitableBeachCount,
      comfortableBeachCount: currentBeaufort <= 2 ? totalBeachCount : comfortableBeaches.length,
      isEveryBeachSuitable: hasBroadlySuitableLightWindDay,
      isMostBeachesSuitable: hasGreatSwimmingWeather && suitableRatio >= 0.65,
      isEveryBeachComfortable: currentBeaufort <= 2,
      isMostBeachesComfortable: hasGreatSwimmingWeather && comfortableRatio >= 0.8,
      hasGreatSwimmingWeather,
      hasNormalLightWindBeachDay: hasBroadlySuitableLightWindDay,
      beaufort: currentBeaufort,
      waveHeightM,
    };
  }, [currentBeaufort, dailySuitableBeaches, forecast, isRainBlockedBeachWindow, isUnsafeWinter, rainRiskSummary.hasRainRisk, selectedDayIndex, selectedIsland]);
  const hasNoSwimmableBeachesToday = useMemo(() => {
    if (!selectedIsland || !selectedForecast || isUnsafeWinter) return false;
    if (isRainBlockedBeachWindow) return true;

    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    const weatherText = `${selectedForecast.weather.main} ${selectedForecast.weather.description}`.toLowerCase();
    const hasSevereWeather =
      currentBeaufort >= 5 ||
      /thunder|storm|snow|squall|heavy rain|rainstorm/.test(weatherText) ||
      (typeof waveHeightM === 'number' && waveHeightM >= 1);

    if (!hasSevereWeather) return false;
    if (dailySuitableBeaches.length === 0) return true;

    const swimmableBeaches = dailySuitableBeaches.filter(item => {
      const itemWaveHeightM = item.waveHeightM ?? waveHeightM;
      const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
      const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;
      const hasSeriousWarning = item.warnings?.some(warning =>
        warning.severity === 'critical' ||
        warning.type === 'rough_sea' ||
        warning.type === 'strong_wind'
      );

      return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
        hasGoodHourlySea &&
        !hasSeriousWarning &&
        !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
    });

    return swimmableBeaches.length === 0;
  }, [currentBeaufort, dailySuitableBeaches, isRainBlockedBeachWindow, isUnsafeWinter, selectedForecast, selectedIsland]);
  const showDecisionRecommendations = Boolean(
    forecast?.[selectedDayIndex] &&
    !isSevereWindNoTopRecommendationDay &&
    !isRainBlockedBeachWindow
  );

  useEffect(() => {
    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedIsland || !selectedForecast || recommendedSuitableBeaches.length === 0) return;
    recordForecastSnapshots(selectedIsland.id, selectedForecast.date, recommendedSuitableBeaches, selectedForecast);
  }, [forecast, selectedDayIndex, selectedIsland, recommendedSuitableBeaches]);

  useEffect(() => {
    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedIsland || !selectedForecast || isUnsafeWinter || !showDecisionRecommendations || topRecommendedSuitableBeaches.length === 0) return;

    const topBeachIds = topRecommendedSuitableBeaches.map(item => item.beach.id).join(',');
    const trackingKey = `${selectedIsland.id}:${selectedForecast.date}:${topBeachIds}`;
    if (trackedRecommendationsRef.current === trackingKey) return;

    trackedRecommendationsRef.current = trackingKey;
    trackEvent('recommendations_viewed', undefined, {
      ...analyticsBaseParams,
      day_index: selectedDayIndex,
      recommendation_count: topRecommendedSuitableBeaches.length,
      top_beach_id: String(topRecommendedSuitableBeaches[0].beach.id),
    });
  }, [analyticsBaseParams, forecast, isUnsafeWinter, selectedDayIndex, selectedIsland, showDecisionRecommendations, topRecommendedSuitableBeaches]);

  useEffect(() => {
    const query = beachSearchQuery.trim();
    if (query.length < 2) return;

    const trackingKey = `${selectedIsland?.id || 'unknown'}:${query}`;
    const timer = window.setTimeout(() => {
      if (trackedSearchRef.current === trackingKey) return;
      trackedSearchRef.current = trackingKey;
      trackEvent('search_used', undefined, {
        ...analyticsBaseParams,
        search_length: query.length,
        result_count: filteredBeaches.length,
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [analyticsBaseParams, beachSearchQuery, filteredBeaches.length, selectedIsland?.id]);

  useEffect(() => {
    if (
      !selectedIsland ||
      beachesLoading ||
      selectedIsland.beaches.length === 0 ||
      !hasActiveSearchOrFilters ||
      filteredBeaches.length > 0
    ) {
      return;
    }

    const queryLength = beachSearchQuery.trim().length;
    const activeFilterCount = selectedFilters.filter(filter => filter !== 'showAll').length;
    const activePreferenceCount = Object.values(preferences).filter(Boolean).length;
    const trackingKey = [
      selectedIsland.id,
      queryLength,
      selectedFilters.join(','),
      Object.entries(preferences).filter(([, enabled]) => enabled).map(([key]) => key).join(','),
    ].join(':');

    if (trackedEmptyResultsRef.current === trackingKey) return;
    trackedEmptyResultsRef.current = trackingKey;

    trackEvent('empty_results_shown', undefined, {
      ...analyticsBaseParams,
      search_length: queryLength,
      active_filter_count: activeFilterCount,
      active_preference_count: activePreferenceCount,
    });
  }, [analyticsBaseParams, beachesLoading, beachSearchQuery, filteredBeaches.length, hasActiveSearchOrFilters, preferences, selectedFilters, selectedIsland]);

  useEffect(() => {
    if (sortBy === 'recommended') {
      setSortBy(defaultBeachListSort);
    }
  }, [defaultBeachListSort, sortBy]);

  const hasShownAlternativeRecommendations = Boolean(forecast?.[selectedDayIndex] && !isUnsafeWinter && showDecisionRecommendations && topRecommendedSuitableBeaches.length > 1);
  const listRecommendationDisplayMode = getRecommendationDisplayMode(
    currentBeaufort,
    recommendedSuitableBeaches[0]?.waveHeightM ?? selectedForecast?.marine?.waveHeightM,
    recommendedSuitableBeaches[0]?.swimmingComfort === 'avoid_swimming' || hasNoSwimmableBeachesToday
  );
  const isStrongRecommendationMode = Boolean(
    listRecommendationDisplayMode === 'strong' ||
    currentBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ||
    ((selectedForecast?.marine?.waveHeightM ?? 0) >= 1.2)
  );
  const isProtectedFirstRecommendationMode = Boolean(
    listRecommendationDisplayMode === 'no_ideal_swimming' ||
    currentBeaufort >= PROTECTED_FIRST_BEAUFORT ||
    ((selectedForecast?.marine?.waveHeightM ?? 0) >= 1.2)
  );
  const strongSuitableCandidates = useMemo(() => {
    if (!isStrongRecommendationMode || !selectedForecast) return [];

    const rankedFallback = dailySuitableBeaches.length > 0
      ? dailySuitableBeaches
      : [...mapSuitableBeaches].sort((a, b) => b.score - a.score);
    const rankedById = new Map<number, SuitableBeach>();
    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const waveHeightM = selectedForecast.marine?.waveHeightM;

    [...recommendedSuitableBeaches, ...rankedFallback].forEach(item => {
      if (!isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort)) return;
      if (!rankedById.has(item.beach.id) && isStrongWindSuitableCandidate(item, windSpeedKmph, waveHeightM)) {
        rankedById.set(item.beach.id, item);
      }
    });

    const timeAwareItems = Array.from(rankedById.values()).map(item => applyRemainingTopPickWindow(
      item,
      selectedForecast.date,
      topPickNow,
      selectedBeachForecasts[item.beach.id]?.hourly || selectedForecast.hourly
    ));
    const candidates = getWindPriorityTopPickPool(timeAwareItems, currentBeaufort);
    const protectedPriority = prioritizeProtectedRecommendations(candidates, currentBeaufort);
    return prioritizeDynamicTopPickWindows(protectedPriority, selectedForecast.date, topPickNow);
  }, [currentBeaufort, dailySuitableBeaches, isStrongRecommendationMode, mapSuitableBeaches, recommendedSuitableBeaches, selectedBeachForecasts, selectedForecast, topPickNow]);
  const noIdealFallbackCandidates = useMemo(() => {
    if (!hasNoSwimmableBeachesToday || !isStrongRecommendationMode || !selectedForecast) return [];

    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    const rankedFallback = [...mapSuitableBeaches]
      .filter(item => (
        isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort) &&
        isNoIdealFallbackCandidate(item, windSpeedKmph, waveHeightM)
      ))
      .sort((a, b) => {
        const exposureDiff = exposurePriority(a) - exposurePriority(b);
        return exposureDiff || b.score - a.score;
      });

    const timeAwareItems = rankedFallback.map(item => applyRemainingTopPickWindow(
      item,
      selectedForecast.date,
      topPickNow,
      selectedBeachForecasts[item.beach.id]?.hourly || selectedForecast.hourly
    ));
    const protectedPriority = prioritizeProtectedRecommendations(timeAwareItems, currentBeaufort);
    return prioritizeDynamicTopPickWindows(protectedPriority, selectedForecast.date, topPickNow);
  }, [currentBeaufort, hasNoSwimmableBeachesToday, isStrongRecommendationMode, mapSuitableBeaches, selectedBeachForecasts, selectedForecast, topPickNow]);
  const windPreviewCandidates = useMemo(() => {
    if (!isStrongRecommendationMode || !selectedForecast) return [];
    if (strongSuitableCandidates.length > 0) return strongSuitableCandidates;

    const fallbackSource = recommendedSuitableBeaches.length > 0
      ? recommendedSuitableBeaches
      : dailySuitableBeaches.length > 0
      ? dailySuitableBeaches
      : [...mapSuitableBeaches].sort((a, b) => b.score - a.score);
    const rankedById = new Map<number, SuitableBeach>();

    fallbackSource.forEach(item => {
      if (!isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort)) return;
      if (!rankedById.has(item.beach.id)) {
        rankedById.set(item.beach.id, item);
      }
    });

    const timeAwareItems = Array.from(rankedById.values()).map(item => applyRemainingTopPickWindow(
      item,
      selectedForecast.date,
      topPickNow,
      selectedBeachForecasts[item.beach.id]?.hourly || selectedForecast.hourly
    ));
    const candidates = getWindPriorityTopPickPool(timeAwareItems, currentBeaufort);
    const protectedPriority = prioritizeProtectedRecommendations(candidates, currentBeaufort);
    return prioritizeDynamicTopPickWindows(protectedPriority, selectedForecast.date, topPickNow);
  }, [currentBeaufort, dailySuitableBeaches, isStrongRecommendationMode, mapSuitableBeaches, recommendedSuitableBeaches, selectedBeachForecasts, selectedForecast, strongSuitableCandidates, topPickNow]);
  const strongManageableBeaches = useMemo(() => (
    windPreviewCandidates.slice(0, getTopRecommendationDisplayLimit(windPreviewCandidates.length))
  ), [windPreviewCandidates]);
  const noIdealFallbackBeaches = useMemo(() => (
    noIdealFallbackCandidates.slice(0, getTopRecommendationDisplayLimit(noIdealFallbackCandidates.length))
  ), [noIdealFallbackCandidates]);
  const showStrongManageableSection = Boolean(
    showDecisionRecommendations &&
    !hasNoSwimmableBeachesToday &&
    isStrongRecommendationMode &&
    strongManageableBeaches.length > 0
  );
  const showNoIdealFallbackSection = Boolean(
    showDecisionRecommendations &&
    hasNoSwimmableBeachesToday &&
    !isRainBlockedBeachWindow &&
    isStrongRecommendationMode &&
    noIdealFallbackBeaches.length > 0
  );
  const lessExposedBeachIds = useMemo(() => (
    new Set((strongSuitableCandidates.length > 0 ? strongSuitableCandidates : windPreviewCandidates).map(item => item.beach.id))
  ), [strongSuitableCandidates, windPreviewCandidates]);
  const highlightedRecommendationIds = useMemo(() => {
    if (!forecast?.[selectedDayIndex] || isUnsafeWinter || !showDecisionRecommendations) return new Set<number>();
    const highlightedSource = showStrongManageableSection ? [] : topRecommendedSuitableBeaches;
    return new Set(highlightedSource.map(item => item.beach.id));
  }, [forecast, selectedDayIndex, isUnsafeWinter, showDecisionRecommendations, showStrongManageableSection, topRecommendedSuitableBeaches]);
  const filteredBeachesWithoutHighlights = useMemo(() => {
    if (hasActiveSearchOrFilters) return filteredBeaches;
    if (highlightedRecommendationIds.size === 0) return filteredBeaches;
    return filteredBeaches.filter(beach => !highlightedRecommendationIds.has(beach.id));
  }, [filteredBeaches, hasActiveSearchOrFilters, highlightedRecommendationIds]);
  const beachWeatherContextById = useMemo(() => (
    new Map(mapSuitableBeaches.map(item => [item.beach.id, item]))
  ), [mapSuitableBeaches]);
  const filteredBeachesWithWeatherContext = useMemo(() => (
    filteredBeachesWithoutHighlights.map(beach => {
      const context = beachWeatherContextById.get(beach.id);
      if (!context) return beach;
      const beachWithDistance = beach as Beach & { distance?: number };

      return {
        ...beach,
        distance: beachWithDistance.distance ?? context.distance,
        crowdLevel: context.beach.crowdLevel ?? beach.crowdLevel,
        exposureLevel: context.exposureLevel,
        canClaimWindProtection: context.canClaimWindProtection,
        seaCalmClaimAllowed: context.seaCalmClaimAllowed,
        waveHeightM: context.waveHeightM,
        warnings: context.warnings,
        confidence: context.confidence,
        swimmingComfort: context.swimmingComfort,
        lessExposedToday: isStrongRecommendationMode ? lessExposedBeachIds.has(beach.id) : undefined,
      };
    })
  ), [beachWeatherContextById, filteredBeachesWithoutHighlights, isStrongRecommendationMode, lessExposedBeachIds]);
  const directoryAllSourceBeaches = useMemo(() => {
    const hydratedBeaches = filteredBeaches.map(beach => {
      const context = beachWeatherContextById.get(beach.id);
      if (!context) return beach;
      const beachWithDistance = beach as Beach & { distance?: number };

      return {
        ...beach,
        distance: beachWithDistance.distance ?? context.distance,
        crowdLevel: context.beach.crowdLevel ?? beach.crowdLevel,
        exposureLevel: context.exposureLevel,
        canClaimWindProtection: context.canClaimWindProtection,
        seaCalmClaimAllowed: context.seaCalmClaimAllowed,
        waveHeightM: context.waveHeightM,
        warnings: context.warnings,
        confidence: context.confidence,
        swimmingComfort: context.swimmingComfort,
        lessExposedToday: isStrongRecommendationMode ? lessExposedBeachIds.has(beach.id) : undefined,
      };
    });

    if (!isDesktopMapViewportFilterActive || !desktopMapVisibleBeachIdSet) {
      return hydratedBeaches;
    }

    return hydratedBeaches.filter(beach => desktopMapVisibleBeachIdSet.has(beach.id));
  }, [beachWeatherContextById, desktopMapVisibleBeachIdSet, filteredBeaches, isDesktopMapViewportFilterActive, isStrongRecommendationMode, lessExposedBeachIds]);
  const isNoIdealFallbackSortOnly = hasNoSwimmableBeachesToday && isProtectedFirstRecommendationMode && isProtectedSortOnly;
  const isStrongSuitableSortOnly = !hasNoSwimmableBeachesToday && isProtectedFirstRecommendationMode && isProtectedSortOnly;
  const strongSuitableFilterBeaches = useMemo(() => {
    if (!isStrongSuitableSortOnly) return [];

    const previewIds = showStrongManageableSection
      ? new Set(strongManageableBeaches.map(item => item.beach.id))
      : new Set<number>();
    const filterSource = strongSuitableCandidates.length > 0
      ? strongSuitableCandidates
      : windPreviewCandidates;
    const filterCandidates = filterSource.filter(item => !previewIds.has(item.beach.id));

    return filterCandidates.map(item => ({
      ...item.beach,
      distance: item.distance,
      exposureLevel: item.exposureLevel,
      canClaimWindProtection: item.canClaimWindProtection,
      seaCalmClaimAllowed: item.seaCalmClaimAllowed,
      waveHeightM: item.waveHeightM,
      warnings: item.warnings,
      confidence: item.confidence,
      swimmingComfort: item.swimmingComfort,
      lessExposedToday: true,
    }));
  }, [isStrongSuitableSortOnly, showStrongManageableSection, strongManageableBeaches, strongSuitableCandidates, windPreviewCandidates]);
  const noIdealFallbackFilterBeaches = useMemo(() => {
    if (!isNoIdealFallbackSortOnly) return [];

    return noIdealFallbackCandidates.map(item => ({
      ...item.beach,
      distance: item.distance,
      exposureLevel: item.exposureLevel,
      canClaimWindProtection: item.canClaimWindProtection,
      seaCalmClaimAllowed: item.seaCalmClaimAllowed,
      waveHeightM: item.waveHeightM,
      warnings: item.warnings,
      confidence: item.confidence,
      swimmingComfort: item.swimmingComfort,
    }));
  }, [isNoIdealFallbackSortOnly, noIdealFallbackCandidates]);
  const shouldShowNoSwimmingMessage = !hasActiveSearchOrFilters && (
    isRainBlockedBeachWindow ||
    isSevereWindNoTopRecommendationDay ||
    (hasNoSwimmableBeachesToday && noIdealFallbackBeaches.length === 0)
  );
  const beachListBaseBeaches = shouldShowNoSwimmingMessage
    ? []
    : isNoIdealFallbackSortOnly
    ? noIdealFallbackFilterBeaches
    : isStrongSuitableSortOnly
    ? strongSuitableFilterBeaches
    : filteredBeachesWithWeatherContext;
  const beachListBeaches = useMemo(() => {
    if (!isDesktopMapViewportFilterActive || !desktopMapVisibleBeachIdSet) {
      return beachListBaseBeaches;
    }

    return beachListBaseBeaches.filter(beach => desktopMapVisibleBeachIdSet.has(beach.id));
  }, [beachListBaseBeaches, desktopMapVisibleBeachIdSet, isDesktopMapViewportFilterActive]);
  const distanceSortedDirectoryBeachCards = useMemo<SuitableBeach[]>(() => {
    if (sortBy !== 'distance') return [];

    return beachListBeaches.map(beach => {
      const context = beachWeatherContextById.get(beach.id);
      const beachWithDistance = beach as Beach & {
        distance?: number;
        todayScore?: number;
        exposureLevel?: SuitableBeach['exposureLevel'];
        waveHeightM?: number;
        warnings?: SuitableBeach['warnings'];
        confidence?: SuitableBeach['confidence'];
        swimmingComfort?: SuitableBeach['swimmingComfort'];
        canClaimWindProtection?: boolean;
        seaCalmClaimAllowed?: boolean;
      };
      const distance = beachWithDistance.distance ?? context?.distance;

      if (context) {
        return {
          ...context,
          beach,
          distance,
        };
      }

      return {
        beachId: beach.id,
        name: displayBeachName(beach.name, language),
        score: beachWithDistance.todayScore ?? Math.max(0, Math.min(100, Math.round(beach.rating * 20))),
        explanation: '',
        distance,
        beach,
        isExposed: beachWithDistance.exposureLevel ? beachWithDistance.exposureLevel !== 'protected' : true,
        exposureLevel: beachWithDistance.exposureLevel,
        waveHeightM: beachWithDistance.waveHeightM,
        warnings: beachWithDistance.warnings,
        confidence: beachWithDistance.confidence,
        swimmingComfort: beachWithDistance.swimmingComfort,
        canClaimWindProtection: beachWithDistance.canClaimWindProtection,
        seaCalmClaimAllowed: beachWithDistance.seaCalmClaimAllowed,
      };
    });
  }, [beachListBeaches, beachWeatherContextById, language, sortBy]);
  const sortResultCounts = useMemo(() => {
    if (!selectedIsland || !selectedForecast) {
      return {} as Partial<Record<SortOption, number>>;
    }

    if (shouldShowNoSwimmingMessage) {
      return { all: 0, protected: 0 } as Partial<Record<SortOption, number>>;
    }

    const windDirection = degToCompass(selectedForecast.wind.deg);
    const baseBeaches = filterBeachesByUserPreferences(mapViewportBeaches, preferences);
    const allCount = getFilteredBeaches(
      baseBeaches,
      selectedFilters,
      beachSearchQuery,
      'all',
      windDirection,
      selectedForecast,
      userLocation,
      preferences
    ).length;
    const hasOnlySortControls =
      beachSearchQuery.trim().length === 0 &&
      selectedFilters.every(filter => filter === 'showAll') &&
      !hasActivePreferenceFilters;
    const viewportContainsCandidate = (item: SuitableBeach) => (
      !isDesktopMapViewportFilterActive ||
      !desktopMapVisibleBeachIdSet ||
      desktopMapVisibleBeachIdSet.has(item.beach.id)
    );
    const previewIds = showStrongManageableSection
      ? new Set(strongManageableBeaches.map(item => item.beach.id))
      : new Set<number>();
    const strongProtectedCandidates = hasNoSwimmableBeachesToday && !isRainBlockedBeachWindow
      ? noIdealFallbackCandidates
      : (strongSuitableCandidates.length > 0 ? strongSuitableCandidates : windPreviewCandidates);
    const strongProtectedCount = strongProtectedCandidates.filter(item => (
      (hasNoSwimmableBeachesToday || !previewIds.has(item.beach.id)) &&
      viewportContainsCandidate(item)
    )).length;
    const protectedCount = hasOnlySortControls && isProtectedFirstRecommendationMode
      ? strongProtectedCount
      : getFilteredBeaches(
        baseBeaches,
        selectedFilters,
        beachSearchQuery,
        'protected',
        windDirection,
        selectedForecast,
        userLocation,
        preferences
      ).length;

    return { all: allCount, protected: protectedCount } as Partial<Record<SortOption, number>>;
  }, [
    beachSearchQuery,
    desktopMapVisibleBeachIdSet,
    getFilteredBeaches,
    hasActivePreferenceFilters,
    hasNoSwimmableBeachesToday,
    isDesktopMapViewportFilterActive,
    isRainBlockedBeachWindow,
    isProtectedFirstRecommendationMode,
    mapViewportBeaches,
    noIdealFallbackCandidates,
    preferences,
    selectedFilters,
    selectedForecast,
    selectedIsland,
    shouldShowNoSwimmingMessage,
    showStrongManageableSection,
    strongManageableBeaches,
    strongSuitableCandidates.length,
    strongSuitableCandidates,
    windPreviewCandidates.length,
    windPreviewCandidates,
    userLocation,
  ]);
  const protectedSortNoResults = (isStrongSuitableSortOnly && strongSuitableFilterBeaches.length === 0) ||
    (isNoIdealFallbackSortOnly && noIdealFallbackFilterBeaches.length === 0);
  const headerWeatherMeta = useMemo(() => {
    if (!selectedIsland) return undefined;

    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedForecast) {
      return `${selectedIsland.beaches.length} ${homeCopy.beaches[language]}`;
    }

    const windDirection = degToCompass(selectedForecast.wind.deg);
    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const beaufortLevel = getBeaufortLevel(windSpeedKmph);
    const windSpeedMph = Math.round(selectedForecast.wind.speed * 2.23694);
    const conditions = compactWeatherLabels[language]?.[selectedForecast.weather.description]
      || (t.weatherConditions && t.weatherConditions[selectedForecast.weather.description])
      || selectedForecast.weather.description;

    return [
      compactWindDirections[language]?.[windDirection] || t.windDirections[windDirection],
      language === 'gr' ? `${beaufortLevel} μποφ.` : `${beaufortLevel} Bft`,
      `${windSpeedMph}mph`,
      `${Math.round(selectedForecast.temp_max)}°C`,
      conditions,
    ].join(' · ');
  }, [selectedIsland, forecast, selectedDayIndex, homeCopy.beaches, language, t]);
  const mapAlignedVisibleProtectedDirectorySource = useMemo(() => {
    if (!selectedForecast || currentBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) return [];
    const visibleExposureLevels = getConsistentVisibleMapExposureLevels(
      filteredMapSuitableBeaches,
      currentBeaufort,
      selectedForecast.wind.deg
    );

    return filteredMapSuitableBeaches
      .filter(item => visibleExposureLevels.get(item.beach.id) === 'protected')
      .sort((a, b) => (
        compareTouristTopPickPriority(a, b) || b.score - a.score
      ));
  }, [currentBeaufort, filteredMapSuitableBeaches, selectedForecast]);
  const mapAlignedProtectedDirectorySource = useMemo(() => {
    const trustedCandidates = mapAlignedVisibleProtectedDirectorySource.filter(item => (
      isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort)
    ));

    if (trustedCandidates.length === 0) return [];

    return trustedCandidates;
  }, [currentBeaufort, mapAlignedVisibleProtectedDirectorySource]);
  const mapAlignedLessExposedDirectorySource = useMemo(() => {
    if (!selectedForecast || !isStrongRecommendationMode) return [];

    const lessExposedById = new Map(mapAlignedProtectedDirectorySource.map(item => [item.beach.id, item]));

    const preferredSource = showNoIdealFallbackSection
      ? noIdealFallbackCandidates
      : showStrongManageableSection
      ? (strongSuitableCandidates.length > 0 ? strongSuitableCandidates : windPreviewCandidates)
      : [];
    const ordered: SuitableBeach[] = [];

    preferredSource.forEach(item => {
      const mapItem = lessExposedById.get(item.beach.id);
      if (!mapItem) return;

      ordered.push(mapItem);
      lessExposedById.delete(item.beach.id);
    });

    const remaining = Array.from(lessExposedById.values()).sort((a, b) => (
      compareTouristTopPickPriority(a, b) || b.score - a.score
    ));

    return [...ordered, ...remaining];
  }, [
    isStrongRecommendationMode,
    mapAlignedProtectedDirectorySource,
    noIdealFallbackCandidates,
    selectedForecast,
    showNoIdealFallbackSection,
    showStrongManageableSection,
    strongSuitableCandidates,
    windPreviewCandidates,
  ]);

  useEffect(() => {
    if (beachesLoading || beachesError || view === 'detail') {
      return undefined;
    }

    const trimmedQuery = deferredBeachSearchQuery.trim();
    let cancelled = false;

    if (trimmedQuery.length < 2) {
      setDirectorySearchSuggestions([]);
      setIsDirectorySearchSuggesting(false);
      return undefined;
    }

    const regionSuggestions = getRegionSearchSuggestions(trimmedQuery);
    const currentRegionBeachSuggestions = selectedIsland
      ? getBeachSearchSuggestionsFromEntries(trimmedQuery, selectedIsland.beaches.map(beach => ({
          island: selectedIsland,
          beach,
          regionValues: getIslandSearchValues(selectedIsland),
          searchValues: getBeachSearchValues(beach, selectedIsland),
        })), 5)
      : [];

    setDirectorySearchSuggestions(mergeDirectorySearchSuggestions(regionSuggestions, currentRegionBeachSuggestions));

    if (trimmedQuery.length < 3) {
      setIsDirectorySearchSuggesting(false);
      return undefined;
    }

    setIsDirectorySearchSuggesting(true);
    const timeout = window.setTimeout(() => {
      void getGlobalBeachSearchIndex()
        .then(searchIndex => {
          if (cancelled) return;
          const globalBeachSuggestions = getBeachSearchSuggestionsFromEntries(trimmedQuery, searchIndex, 6);
          setDirectorySearchSuggestions(mergeDirectorySearchSuggestions(regionSuggestions, globalBeachSuggestions));
        })
        .catch(error => {
          if (!cancelled) console.warn('Global beach search suggestions failed.', error);
        })
        .finally(() => {
          if (!cancelled) setIsDirectorySearchSuggesting(false);
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [beachesError, beachesLoading, deferredBeachSearchQuery, allIslands, selectedIsland, language, regionBeachCounts, view]);

  if (beachesLoading) return <SkeletonLoader t={t} />;
  if (beachesError) return <ErrorDisplay message={beachesError} onRetry={() => window.location.reload()} t={t} />;

  if (view === 'detail' && detailBeach && forecast?.[selectedDayIndex]) {
    const detailBeachForecast = selectedBeachForecasts[detailBeach.id];
    const detailForecast = detailBeachForecast || forecast[selectedDayIndex];

    return (
      <Suspense fallback={<SkeletonLoader t={t} />}>
        <BeachDetailPage
          beach={detailBeach} allBeaches={selectedIsland?.beaches || []}
          dayForecast={detailForecast} hourlyForecast={detailForecast.hourly} language={language} t={t}
          onBack={closeBeachDetails} onBeachClick={(b) => openBeachDetails(b, 'nearby_detail')}
          userLocation={userLocation} favorites={favorites} onToggleFavorite={handleToggleFavorite}
          preferences={preferences}
          islandName={selectedIsland?.name[language]}
          detailDataStatus={detailDataStatus}
          beachWeatherById={selectedBeachForecasts}
          geospatialExposureProfiles={geospatialExposureProfiles}
          weatherSource={detailBeachForecast ? 'beach-cluster' : 'island-fallback'}
        />
      </Suspense>
    );
  }

  const selectedIslandKey = selectedIsland?.name.en?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const islandBackground = ISLAND_BACKGROUND_IMAGES[selectedIslandKey];
  const islandBackgroundCss = getBackgroundImageCss(islandBackground);
  const showHeaderForecast = Boolean(forecast?.[selectedDayIndex] && !isUnsafeWinter);
  const shouldRenderUsageInsights = ENABLE_USAGE_INSIGHTS && shouldLoadInsights;
  const shouldRenderMainShell = !showHeaderForecast
    || isDesktopViewport
    || isWaitingForForecast
    || Boolean(weatherError)
    || isUnsafeWinter
    || Boolean(betaFeedbackUrl)
    || shouldRenderUsageInsights;
  const headerTopCandidate = !hasActiveSearchOrFilters && showDecisionRecommendations && topRecommendedSuitableBeaches.length > 0
    ? topRecommendedSuitableBeaches[0]
    : null;
  const recommendationDisplayMode = listRecommendationDisplayMode;
  const recommendationModeCopy = homeCopy.recommendationMode[recommendationDisplayMode];
  const protectedSortLabel = homeCopy.lessExposedSortLabel[language];
  const protectedSortDay = getSelectedDayPrefix(selectedForecast?.date, new Date(), language);
  const protectedSortEmptyCopy = isNoIdealFallbackSortOnly
    ? getLocalizedCopy(language, {
      en: {
        title: 'No suitable options were found.',
        body: `With the available data, there is no clearly good option for calm swimming ${protectedSortDay}. Try another sort to see every beach with its warnings.`,
      },
      gr: {
        title: 'Δεν βρέθηκαν κατάλληλες επιλογές.',
        body: `Με τα διαθέσιμα δεδομένα δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο ${protectedSortDay}. Δοκίμασε άλλη ταξινόμηση για να δεις όλες τις παραλίες με τις προειδοποιήσεις τους.`,
      },
      fr: {
        title: 'Aucune option adaptee trouvee.',
        body: `Avec les données disponibles, il n’y a pas d’option clairement adaptée à une baignade calme ${protectedSortDay}. Essaie un autre tri pour voir toutes les plages avec leurs avertissements.`,
      },
      de: {
        title: 'Keine geeigneten Optionen gefunden.',
        body: `Mit den verfugbaren Daten gibt es keine klar ruhige Badeoption ${protectedSortDay}. Nutze eine andere Sortierung, um alle Strande mit Warnhinweisen zu sehen.`,
      },
      it: {
        title: 'Nessuna opzione adatta trovata.',
        body: `Con i dati disponibili, non c’è una scelta chiaramente adatta a un bagno tranquillo ${protectedSortDay}. Prova un altro ordinamento per vedere tutte le spiagge con i relativi avvisi.`,
      },
    })
    : undefined;
  const showRecommendationPreviewSection = showStrongManageableSection || showNoIdealFallbackSection;
  const showWindContextSummaryPanel = Boolean(
    showHeaderForecast &&
    forecast?.[selectedDayIndex] &&
    !isUnsafeWinter &&
    !showRecommendationPreviewSection &&
    showDecisionRecommendations &&
    !isRainBlockedBeachWindow &&
    currentBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
  );
  const recommendationSectionBeaches = showNoIdealFallbackSection
    ? noIdealFallbackBeaches
    : showStrongManageableSection
    ? strongManageableBeaches
    : headerTopCandidate
    ? topRecommendedSuitableBeaches.slice(1)
    : topRecommendedSuitableBeaches;
  const exploreSectionLabel = isStrongSuitableSortOnly
    ? homeCopy.moreSuitableOptions[language]
    : isNoIdealFallbackSortOnly
    ? homeCopy.lessExposedOptions[language]
    : sortBy === 'all'
    ? homeCopy.allBeaches[language]
    : homeCopy.exploreTools[language];
  const headerTopBeach = showStrongManageableSection ? null : headerTopCandidate;
  const headerTopBeachName = headerTopBeach
    ? displayBeachName(headerTopBeach.beach.name, language)
    : '';
  const headerTopCanNavigate = headerTopBeach ? canOpenNavigation(headerTopBeach.beach) : false;
  const headerTopWaveHeightM = headerTopBeach?.waveHeightM ?? selectedForecast?.marine?.waveHeightM;
  const recommendationWindDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : WindDirection.N;
  const recommendationWindLabel = t.windDirectionsAccusative?.[recommendationWindDirection]
    || t.windDirections[recommendationWindDirection]
    || recommendationWindDirection;
  const recommendationGeneralHelper = selectedForecast
    ? getGeneralConditionsHelper(
      recommendationDisplayMode,
      currentBeaufort,
      recommendationWindLabel,
      getFavoredCoastPhrase(recommendationWindDirection, language),
      language,
      selectedForecast.marine?.waveHeightM,
      selectedForecast.date,
      // Keep the summary consistent with the map's "locally variable wind" banner
      // (same 45° spread threshold) so it never claims a favored coast the map denies.
      mapWindDirectionSpreadDeg > 45
    )
    : recommendationModeCopy.helper[language];
  const selectedDayDate = selectedForecast?.date;
  const recommendationModeTitle = (() => {
    const day = getSelectedDayPrefix(selectedDayDate, new Date(), language);
    const copy = getLocalizedCopy(language, {
      en: {
        caution: `More comfortable options ${day}`,
        strong: `Most suitable options ${day}`,
        sheltered: `More sheltered options ${day}`,
        noIdeal: `No clear calm-swimming option ${day}`,
      },
      gr: {
      caution: `Ιδανικότερες παραλίες ${day}`,
      strong: `Καταλληλότερες επιλογές ${day}`,
      sheltered: `Πιο υπήνεμες επιλογές ${day}`,
      noIdeal: `Δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο ${day}`,
      },
      fr: {
        caution: `Options plus confortables ${day}`,
        strong: `Options les plus adaptees ${day}`,
        sheltered: `Options plus abritees ${day}`,
        noIdeal: `Aucun choix clairement calme ${day}`,
      },
      de: {
        caution: `Komfortablere Optionen ${day}`,
        strong: `Am besten geeignete Optionen ${day}`,
        sheltered: `Windgeschutztere Optionen ${day}`,
        noIdeal: `Keine klar ruhige Badeoption ${day}`,
      },
      it: {
        caution: `Opzioni piu comode ${day}`,
        strong: `Opzioni piu adatte ${day}`,
        sheltered: `Opzioni piu riparate ${day}`,
        noIdeal: `Nessuna scelta chiaramente calma ${day}`,
      },
    });

    if (recommendationDisplayMode === 'caution') return copy.caution;
    if (recommendationDisplayMode === 'strong') return copy.strong;
    if (recommendationDisplayMode === 'no_ideal_swimming') {
      return currentBeaufort <= 5
        ? copy.sheltered
        : copy.noIdeal;
    }
    return recommendationModeCopy.title[language];
  })();
  const headerTopTimingLabel = headerTopBeach
    ? getTopPickTimingLabel(headerTopBeach.bestBeachTime, selectedDayDate, language, topPickNow)
    : undefined;
  const headerTopIsAvoidDay = headerTopBeach?.swimmingComfort === 'avoid_swimming';
  const selectedDayPrefix = getSelectedDayPrefix(selectedDayDate, new Date(), language);
  const selectedDaySentencePrefix = getSelectedDaySentencePrefix(selectedDayDate, new Date(), language);
  const hourlyWindIncreaseCopy = currentBeaufort <= 3 && hourlyWindIncreaseSummary.hasIncrease
    ? getLocalizedCopy(language, {
      en: `Later the wind rises to ${hourlyWindIncreaseSummary.maxBeaufort} Beaufort around ${hourlyWindIncreaseSummary.label}, so some beaches will feel more comfortable than others.`,
      gr: `Αργότερα ο άνεμος ανεβαίνει έως ${hourlyWindIncreaseSummary.maxBeaufort} μποφόρ γύρω στις ${hourlyWindIncreaseSummary.label}, οπότε κάποιες παραλίες θα είναι πιο άνετες από άλλες.`,
      fr: `Plus tard, le vent monte jusqu’à ${hourlyWindIncreaseSummary.maxBeaufort} Bft vers ${hourlyWindIncreaseSummary.label}, donc certaines plages seront plus confortables que d’autres.`,
      de: `Spater steigt der Wind gegen ${hourlyWindIncreaseSummary.label} auf ${hourlyWindIncreaseSummary.maxBeaufort} Bft, daher fuhlen sich manche Strande komfortabler an als andere.`,
      it: `Piu tardi il vento sale fino a ${hourlyWindIncreaseSummary.maxBeaufort} Beaufort verso ${hourlyWindIncreaseSummary.label}, quindi alcune spiagge saranno piu comode di altre.`,
    })
    : '';
  const calmSummaryBaseDescription = calmAllAroundSummary
    ? calmAllAroundSummary.hasNormalLightWindBeachDay
      ? getLocalizedCopy(language, {
        en: `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. All beaches are suitable for swimming.`,
      gr: `${calmAllAroundSummary.beaufort} μποφόρ ${selectedDayPrefix}. Όλες οι παραλίες είναι κατάλληλες για μπάνιο.`,
        fr: `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. Toutes les plages sont adaptees a la baignade.`,
        de: `${calmAllAroundSummary.beaufort} Bft ${selectedDayPrefix}. Alle Strande sind zum Schwimmen geeignet.`,
        it: `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. Tutte le spiagge sono adatte al bagno.`,
      })
      : getLocalizedCopy(language, {
        en: `${selectedDaySentencePrefix} the weather is mild, so ${calmAllAroundSummary.isEveryBeachSuitable ? 'all beaches' : 'most beaches'} look suitable for swimming.`,
      gr: `${selectedDaySentencePrefix} ο καιρός είναι ήπιος, οπότε ${calmAllAroundSummary.isEveryBeachSuitable ? 'όλες οι παραλίες' : 'οι περισσότερες παραλίες'} φαίνονται κατάλληλες για μπάνιο.`,
        fr: `${selectedDaySentencePrefix}, la meteo est douce, donc ${calmAllAroundSummary.isEveryBeachSuitable ? 'toutes les plages' : 'la plupart des plages'} semblent adaptees a la baignade.`,
        de: `${selectedDaySentencePrefix} ist das Wetter mild, daher wirken ${calmAllAroundSummary.isEveryBeachSuitable ? 'alle Strande' : 'die meisten Strande'} zum Schwimmen geeignet.`,
        it: `${selectedDaySentencePrefix} il meteo e mite, quindi ${calmAllAroundSummary.isEveryBeachSuitable ? 'tutte le spiagge' : 'la maggior parte delle spiagge'} sembra adatta al bagno.`,
      })
    : '';
  const calmSummaryDescription = calmAllAroundSummary
    ? withRainRiskContext(
      hourlyWindIncreaseCopy ? `${calmSummaryBaseDescription} ${hourlyWindIncreaseCopy}` : calmSummaryBaseDescription,
      rainRiskSummary,
      rainRiskCopy
    )
    : '';
  const calmSummaryTitle = calmAllAroundSummary
    ? calmAllAroundSummary.isEveryBeachSuitable
      ? homeCopy.calmAllAroundTitle[language]
      : homeCopy.calmMostBeachesTitle[language]
    : '';
  const headerTopDescriptionBase = (() => {
    if (!headerTopBeachName) return '';

    const copy = getLocalizedCopy(language, {
      en: {
        avoid: `No beach looks ideal for calm swimming ${selectedDayPrefix}. ${headerTopBeachName} is better as a visit option only if conditions look acceptable when you arrive.`,
        strongFive: `${headerTopBeachName} is a better wind option ${selectedDayPrefix}.`,
        strongCaution: `${headerTopBeachName} is the best available option ${selectedDayPrefix}, but it is still a caution day for swimming.`,
        caution: `${headerTopBeachName} is the best pick ${selectedDayPrefix} because the wind looks more manageable there.`,
        timed: `Based on the hourly forecast, ${headerTopBeachName} is the top pick for this time window.`,
        mild: `${selectedDaySentencePrefix} the weather is mild, so most beaches look suitable for swimming.`,
      },
      gr: {
      avoid: `Δεν υπάρχει ιδανική επιλογή για ήρεμο μπάνιο ${selectedDayPrefix}. Η παραλία ${headerTopBeachName} είναι καλύτερη μόνο ως επιλογή επίσκεψης, αν οι συνθήκες φαίνονται αποδεκτές όταν φτάσεις.`,
      strongFive: `Η παραλία ${headerTopBeachName} είναι καλύτερη επιλογή για τον άνεμο ${selectedDayPrefix}.`,
      strongCaution: `Η παραλία ${headerTopBeachName} είναι η καλύτερη διαθέσιμη επιλογή ${selectedDayPrefix}, αλλά οι συνθήκες θέλουν προσοχή.`,
      caution: `Η παραλία ${headerTopBeachName} είναι η καλύτερη πρόταση για ${selectedDayPrefix}, γιατί ο άνεμος μπορεί να είναι λιγότερο ενοχλητικός εκεί.`,
      timed: `Με βάση την ωριαία πρόγνωση, η παραλία ${headerTopBeachName} είναι η κορυφαία επιλογή για αυτό το χρονικό παράθυρο.`,
      mild: `${selectedDaySentencePrefix} ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`,
      },
      fr: {
        avoid: `Aucune plage ne semble ideale pour une baignade calme ${selectedDayPrefix}. ${headerTopBeachName} est plutot une option de visite si les conditions semblent acceptables sur place.`,
        strongFive: `${headerTopBeachName} est une meilleure option face au vent ${selectedDayPrefix}.`,
        strongCaution: `${headerTopBeachName} est la meilleure option disponible ${selectedDayPrefix}, mais la baignade demande encore de la prudence.`,
        caution: `${headerTopBeachName} est le meilleur choix ${selectedDayPrefix}, car le vent semble plus facile a gerer la-bas.`,
      timed: `D’après la prévision horaire, ${headerTopBeachName} est le meilleur choix pour ce créneau.`,
        mild: `${selectedDaySentencePrefix}, la meteo est douce, donc la plupart des plages semblent adaptees a la baignade.`,
      },
      de: {
        avoid: `Kein Strand wirkt ${selectedDayPrefix} ideal fur ruhiges Schwimmen. ${headerTopBeachName} ist eher eine Besuchsoption, wenn die Bedingungen vor Ort akzeptabel wirken.`,
        strongFive: `${headerTopBeachName} ist ${selectedDayPrefix} eine bessere Windoption.`,
        strongCaution: `${headerTopBeachName} ist ${selectedDayPrefix} die beste verfugbare Option, aber Schwimmen bleibt vorsichtig zu bewerten.`,
        caution: `${headerTopBeachName} ist ${selectedDayPrefix} die beste Wahl, weil der Wind dort besser handhabbar wirkt.`,
        timed: `Laut stundlicher Vorhersage ist ${headerTopBeachName} die Top-Wahl fur dieses Zeitfenster.`,
        mild: `${selectedDaySentencePrefix} ist das Wetter mild, daher wirken die meisten Strande zum Schwimmen geeignet.`,
      },
      it: {
        avoid: `Nessuna spiaggia sembra ideale per un bagno calmo ${selectedDayPrefix}. ${headerTopBeachName} e piu una visita, se le condizioni sul posto sembrano accettabili.`,
        strongFive: `${headerTopBeachName} e una scelta migliore per il vento ${selectedDayPrefix}.`,
        strongCaution: `${headerTopBeachName} e la migliore opzione disponibile ${selectedDayPrefix}, ma per il bagno serve ancora prudenza.`,
        caution: `${headerTopBeachName} e la scelta migliore ${selectedDayPrefix}, perche li il vento sembra piu gestibile.`,
        timed: `In base alle previsioni orarie, ${headerTopBeachName} e la scelta migliore per questa fascia.`,
        mild: `${selectedDaySentencePrefix} il meteo e mite, quindi la maggior parte delle spiagge sembra adatta al bagno.`,
      },
    });

    if (headerTopIsAvoidDay) return copy.avoid;
    if (recommendationDisplayMode === 'strong') {
      return currentBeaufort === 5 ? copy.strongFive : copy.strongCaution;
    }
    if (recommendationDisplayMode === 'caution') return copy.caution;
    if (headerTopTimingLabel) return copy.timed;
    return copy.mild;
  })();
  const headerTopDescription = withRainRiskContext(headerTopDescriptionBase, rainRiskSummary, rainRiskCopy);
  const visitTimeLabel = getLocalizedCopy(language, {
    en: 'Best time',
      gr: 'Καλύτερη ώρα',
    fr: 'Meilleur moment',
    de: 'Beste Zeit',
    it: 'Ora migliore',
  });
  const windPriorityDirectorySource = showNoIdealFallbackSection
    ? (mapAlignedLessExposedDirectorySource.length > 0 ? mapAlignedLessExposedDirectorySource : noIdealFallbackCandidates)
    : showStrongManageableSection
    ? (mapAlignedLessExposedDirectorySource.length > 0 ? mapAlignedLessExposedDirectorySource : strongSuitableCandidates)
    : [];
  const directoryRecommendationSource = mapAlignedProtectedDirectorySource.length > 0
    ? mapAlignedProtectedDirectorySource
    : windPriorityDirectorySource.length > 0
    ? windPriorityDirectorySource
    : recommendedSuitableBeaches;
  const directoryFallbackSource = mapAlignedProtectedDirectorySource.length > 0
    ? mapAlignedProtectedDirectorySource
    : prioritizeProtectedRecommendations(
    getWindPriorityTopPickPool(
      mapSuitableBeaches.filter(item => isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort)),
      currentBeaufort
    ),
    currentBeaufort
  );
  const shouldSuppressDirectoryTopBeachFallback = Boolean(
    currentBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT &&
    mapAlignedVisibleProtectedDirectorySource.length > 0 &&
    mapAlignedProtectedDirectorySource.length === 0
  );
  const directoryTopBeach = sortBy === 'distance' || shouldSuppressDirectoryTopBeachFallback
    ? null
    : mapAlignedProtectedDirectorySource[0]
    || windPriorityDirectorySource[0]
    || headerTopBeach
    || directoryRecommendationSource[0]
    || directoryFallbackSource[0]
    || null;
  // At ≤2 Bft (calm day or scrubbed calm hour) the wind doesn't separate
  // beaches, so every beach is a suitable pick. We drop the curated "top picks"
  // highlight and present them all as suitable instead of a misleading few.
  const isCalmAllSuitable = calmAllAroundSummary?.isEveryBeachSuitable ?? false;
  const shouldDisplayDirectoryTopPick = Boolean(
    showDecisionRecommendations &&
    !hasActiveSearchOrFilters &&
    !isCalmAllSuitable
  );
  const displayedDirectoryTopBeach = shouldDisplayDirectoryTopPick ? directoryTopBeach : null;
  const directoryBaseBeachCardSource = (() => {
    if (sortBy === 'distance') {
      return distanceSortedDirectoryBeachCards;
    }

    if (isCalmAllSuitable) {
      return [...filteredMapSuitableBeaches].sort((a, b) => (
        compareTouristTopPickPriority(a, b) || b.score - a.score
      ));
    }

    return directoryRecommendationSource.length > 0
      ? directoryRecommendationSource
      : directoryFallbackSource;
  })();
  const directoryVisibleBeachCardSource = (() => {
    if (mapAlignedVisibleProtectedDirectorySource.length === 0) {
      return directoryBaseBeachCardSource;
    }

    if (sortBy !== 'distance') {
      return mapAlignedVisibleProtectedDirectorySource;
    }

    return [...mapAlignedVisibleProtectedDirectorySource].sort((a, b) => (
      compareOptionalDistance(a, b) || compareTouristTopPickPriority(a, b) || b.score - a.score
    ));
  })();
  const isDirectoryTopRecommendationCandidate = (item: SuitableBeach): boolean => {
    if (!isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort)) return false;
    if (item.swimmingComfort === 'avoid_swimming') return false;
    if (item.warnings?.some(warning => warning.type === 'official_warning' && warning.severity === 'critical')) return false;
    if (typeof item.swimmingScore === 'number' && item.swimmingScore < 50) return false;

    const windSpeedKmph = selectedForecast ? selectedForecast.wind.speed * 3.6 : 0;
    const itemWaveHeightM = item.waveHeightM ?? selectedForecast?.marine?.waveHeightM;
    const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
    const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;

    return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
      hasGoodHourlySea &&
      !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
  };
  const directoryTopRecommendationCandidatePool = [
    ...recommendedSuitableBeaches,
    ...directoryFallbackSource,
    ...directoryVisibleBeachCardSource,
  ].filter(isDirectoryTopRecommendationCandidate);
  const directoryTopRecommendationCandidateCount = showNoIdealFallbackSection
    ? noIdealFallbackCandidates.length
    : showStrongManageableSection
    ? windPreviewCandidates.length
    : directoryTopRecommendationCandidatePool.length;
  const directoryTopRecommendationLimit = getTopRecommendationDisplayLimit(directoryTopRecommendationCandidateCount);
  const shouldShowDirectoryTopRecommendations = Boolean(
    showDecisionRecommendations &&
    !hasActiveSearchOrFilters &&
    !isCalmAllSuitable &&
    directoryTopRecommendationLimit > 0
  );
  const directoryTopRecommendationCards = (() => {
    if (!shouldShowDirectoryTopRecommendations) return [];

    const seenIds = new Set<number>();
    const cards: SuitableBeach[] = [];
    const addSource = (source: SuitableBeach[]) => {
      source.forEach(item => {
        if (cards.length >= directoryTopRecommendationLimit || seenIds.has(item.beach.id)) return;
        if (!isDirectoryTopRecommendationCandidate(item)) return;
        seenIds.add(item.beach.id);
        cards.push(item);
      });
    };

    if (showNoIdealFallbackSection) {
      addSource(noIdealFallbackBeaches);
    }
    if (showStrongManageableSection) {
      addSource(strongManageableBeaches);
    }

    addSource(recommendedSuitableBeaches);
    addSource(directoryFallbackSource);
    addSource(directoryVisibleBeachCardSource);

    return cards;
  })();
  const directoryTopRecommendationIds = new Set(directoryTopRecommendationCards.map(item => item.beach.id));
  const shouldShowAllBeachesBelowTopRecommendations = Boolean(
    shouldShowDirectoryTopRecommendations &&
    currentBeaufort <= 2
  );
  const directorySuitableBeachCards = (() => {
    if (!shouldShowDirectoryTopRecommendations || shouldShowAllBeachesBelowTopRecommendations) {
      return directoryVisibleBeachCardSource;
    }

    return directoryVisibleBeachCardSource.filter(item => !directoryTopRecommendationIds.has(item.beach.id));
  })();
  // Guarantee a distance on every suitable card when the user's location is
  // known (some source pipelines, e.g. calm-wind days, don't carry it), so the
  // "Κοντά μου" distance sort always has a value to order by.
  const directoryHomeSuitableBeachCards = userLocation
    ? directorySuitableBeachCards.map(item => (
        typeof item.distance === 'number' && Number.isFinite(item.distance)
          ? item
          : {
              ...item,
              distance: calculateDistance(userLocation.lat, userLocation.lon, item.beach.coordinates.lat, item.beach.coordinates.lon),
            }
      ))
    : directorySuitableBeachCards;
  const directorySuitableBeachTotalCount = directoryHomeSuitableBeachCards.length;
  const shouldShowDirectorySuitableSection = shouldShowDirectoryTopRecommendations
    ? !shouldShowAllBeachesBelowTopRecommendations && directoryHomeSuitableBeachCards.length > 0
    : !(calmAllAroundSummary?.isEveryBeachSuitable ?? false);
  const highlightedDirectoryTopBeachId = shouldDisplayDirectoryTopPick && selectedDayIndex === 0
    ? directoryTopRecommendationCards[0]?.beach.id ?? displayedDirectoryTopBeach?.beach.id
    : undefined;
  const getMobileFilterModalResultCount = (filters: FilterKey[], nextSortBy: SortOption): number => {
    const normalizedFilters = filters.filter(filter => filter !== 'restaurant');

    if (
      nextSortBy !== 'protected' ||
      !selectedForecast ||
      (calmAllAroundSummary?.isEveryBeachSuitable ?? false)
    ) {
      return getFilteredBeachResults(normalizedFilters, nextSortBy).length;
    }

    const filteredBeachIds = new Set(
      getFilteredBeachResults(normalizedFilters, nextSortBy).map(beach => beach.id)
    );
    const matchingSuitableBeaches = mapSuitableBeaches.filter(item => filteredBeachIds.has(item.beach.id));
    if (matchingSuitableBeaches.length === 0) return 0;

    const visibleExposureLevels = getConsistentVisibleMapExposureLevels(
      matchingSuitableBeaches,
      currentBeaufort,
      selectedForecast.wind.deg
    );
    const protectedCandidates = matchingSuitableBeaches.filter(item => (
      visibleExposureLevels.get(item.beach.id) === 'protected'
    ));
    const source = protectedCandidates.length > 0
      ? protectedCandidates
      : matchingSuitableBeaches;
    const sorted = [...source].sort((a, b) => (
      compareTouristTopPickPriority(a, b) || b.score - a.score
    ));
    const topBeachId = sorted[0]?.beach.id;

    return sorted
      .filter(item => item.beach.id !== topBeachId)
      .slice(0, 16)
      .length;
  };
  const directoryTopBeachName = directoryTopBeach
    ? displayBeachName(directoryTopBeach.beach.name, language)
    : '';
  const directoryTopUsesWindPriority = Boolean(
    windPriorityDirectorySource[0] &&
    directoryTopBeach?.beach.id === windPriorityDirectorySource[0].beach.id
  );
  const directoryTopTimingLabel = directoryTopBeach
    ? getTopPickTimingLabel(directoryTopBeach.bestBeachTime, selectedDayDate, language, topPickNow)
    : undefined;
  const directoryTopDescription = directoryTopBeach
    ? directoryTopBeach.beach.id === headerTopBeach?.beach.id && headerTopDescription
      ? headerTopDescription
      : directoryTopUsesWindPriority
      ? getLocalizedCopy(language, {
        en: `${directoryTopBeachName} is the best pick ${selectedDayPrefix} because the wind may be less annoying there, with practical access.`,
      gr: `Η παραλία ${directoryTopBeachName} είναι η καλύτερη πρόταση για ${selectedDayPrefix}, γιατί ο άνεμος μπορεί να είναι λιγότερο ενοχλητικός εκεί και η πρόσβαση είναι πρακτική.`,
        fr: `${directoryTopBeachName} est le meilleur choix ${selectedDayPrefix}, car le vent peut y etre moins genant, avec un acces pratique.`,
        de: `${directoryTopBeachName} ist ${selectedDayPrefix} die beste Wahl, weil der Wind dort weniger storend sein kann und der Zugang praktisch ist.`,
        it: `${directoryTopBeachName} e la scelta migliore ${selectedDayPrefix}, perche li il vento puo essere meno fastidioso e l'accesso e pratico.`,
      })
      : getLocalizedCopy(language, {
        en: `${directoryTopBeachName} is the best pick ${selectedDayPrefix} because it fits the conditions well and combines comfortable sea with practical access.`,
      gr: `Η παραλία ${directoryTopBeachName} είναι η καλύτερη πρόταση για ${selectedDayPrefix}, γιατί ταιριάζει καλά στις συνθήκες και συνδυάζει άνετη θάλασσα με πρακτική πρόσβαση.`,
        fr: `${directoryTopBeachName} est le meilleur choix ${selectedDayPrefix}, car elle correspond bien aux conditions et combine mer agreable et acces pratique.`,
        de: `${directoryTopBeachName} ist ${selectedDayPrefix} die beste Wahl, weil sie gut zu den Bedingungen passt und angenehmes Meer mit praktischem Zugang verbindet.`,
        it: `${directoryTopBeachName} e la scelta migliore ${selectedDayPrefix}, perche si adatta bene alle condizioni e combina mare piacevole con accesso pratico.`,
      })
    : '';
  const getExactBeachPhoto = (item: SuitableBeach | null) => {
    if (!item || !selectedIsland) return null;
    const lookup = getBeachPhotoLookup(
      item.beach.name.gr,
      item.beach.name.en,
      item.beach.id,
      1,
      selectedIsland.name[language]
    );
    return lookup.source === 'exact'
      ? lookup.metadata?.imageUrl || lookup.detailPhotos?.[0] || lookup.photos[0] || null
      : null;
  };
  const headerTopBeachPhoto = (() => {
    return getExactBeachPhoto(headerTopBeach);
  })();
  const beachSearchSuggestions = selectedIsland
    ? Array.from(new Set(
        selectedIsland.beaches.flatMap(beach => {
          const displayName = displayBeachName(beach.name, language);
          if (language === 'gr') {
            return [displayName, ...(beach.aliases || []).filter(alias => /[\u0370-\u03ff]/.test(alias))];
          }

          return [
            displayName,
            beach.name[language],
            beach.name.gr,
            beach.name.en,
            ...(beach.aliases || []),
          ];
        }).filter((value): value is string => Boolean(value))
      ))
    : [];
  const directoryActiveCategory: DirectoryCategory = QUICK_PREFERENCE_FILTERS.find(key => preferences[key]) || 'all';

  const findSearchRegionMatch = (query: string): Island | null => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) return null;

    const queryVariants = getSearchVariants(trimmedQuery);
    const rankedMatches = allIslands
      .map(island => {
        const values = [
          island.name[language],
          island.name.en,
          island.name.gr,
          island.id.replace(/-/g, ' '),
        ].filter(Boolean);

        const score = values.reduce((bestScore, value) => {
          const valueVariants = getSearchVariants(value);
          const directScore = Math.max(
            0,
            ...queryVariants.flatMap(queryVariant => (
              valueVariants.map(valueVariant => {
                if (!queryVariant || !valueVariant) return 0;
                if (queryVariant === valueVariant) return 100;
                if (queryVariant.includes(valueVariant) && valueVariant.length >= 3) return 96;
                if (valueVariant.includes(queryVariant) && queryVariant.length >= 3) return 92;
                return 0;
              })
            ))
          );

          return Math.max(bestScore, directScore, fuzzySearchScore(trimmedQuery, value));
        }, 0);

        return { island, score };
      })
      .filter(item => item.score >= 90)
      .sort((a, b) => b.score - a.score || a.island.name[language].localeCompare(b.island.name[language]));

    return rankedMatches[0]?.island || null;
  };

  const getIslandSearchValues = (island: Island): string[] => ([
    island.name[language],
    island.name.en,
    island.name.gr,
    island.name.fr,
    island.name.de,
    island.name.it,
    island.id.replace(/-/g, ' '),
  ].filter((value): value is string => Boolean(value)));

  const scoreSearchValues = (query: string, values: string[]): number => {
    const queryVariants = getSearchVariants(query);

    return values.reduce((bestScore, value) => {
      const valueVariants = getSearchVariants(value);
      const directScore = Math.max(
        0,
        ...queryVariants.flatMap(queryVariant => (
          valueVariants.map(valueVariant => {
            if (!queryVariant || !valueVariant) return 0;
            if (queryVariant === valueVariant) return 100;
            if (queryVariant.includes(valueVariant) && valueVariant.length >= 4) return 96;
            if (valueVariant.includes(queryVariant) && queryVariant.length >= 3) return 92;
            if (valueVariant.split(' ').some(word => word.startsWith(queryVariant))) return 84;
            return 0;
          })
        ))
      );

      return Math.max(bestScore, directScore, fuzzySearchScore(query, value));
    }, 0);
  };

  const getIslandBeachCount = (island: Island): number => (
    island.beaches.length > 0 ? island.beaches.length : regionBeachCounts[island.id] ?? 0
  );

  const getBeachSearchValues = (beach: Beach, island: Island): string[] => {
    const regionValues = [
      ...getIslandSearchValues(island),
      beach.location?.island,
      beach.location?.region,
    ].filter((value): value is string => Boolean(value));
      const genericAliasValues = ['paralia', 'παραλία', 'beach', 'plage', 'strand', 'spiaggia', ...regionValues];
    const genericAliasVariants = new Set(genericAliasValues.flatMap(getSearchVariants));
    const isGenericAlias = (value: string): boolean => {
      const variants = getSearchVariants(value);
      return variants.length > 0 && variants.every(variant => genericAliasVariants.has(variant));
    };
    const legacySlugs = (beach as Beach & { legacySlugs?: string[] }).legacySlugs || [];
    const values = [
      beach.name[language],
      beach.name.en,
      beach.name.gr,
      beach.name.fr,
      beach.name.de,
      beach.name.it,
      displayBeachName(beach.name, language),
      displayBeachName(beach.name, 'gr'),
      ...(beach.aliases || []).filter(alias => !isGenericAlias(alias)),
      ...legacySlugs,
    ];

    return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
  };

  const getGlobalBeachSearchIndex = async (): Promise<GlobalBeachSearchEntry[]> => {
    if (!globalBeachSearchIndexRef.current) {
      globalBeachSearchIndexRef.current = (async () => {
        const regionIndex = await loadBeachRegionIndex();
        const loadedIslands = await Promise.all(regionIndex.map(async entry => {
          try {
            return await loadAppReadyRegion(entry.id, {
              summaryDataPath: entry.summaryDataPath,
              appDataPath: entry.appDataPath,
            });
          } catch (error) {
            console.warn('Global beach search skipped region.', {
              regionId: entry.id,
              error,
            });
            return null;
          }
        }));
        const loadedRegionIds = new Set(loadedIslands.filter(Boolean).map(island => island!.id));
        const inMemoryIslands = allIslands.filter(island => (
          island.beaches.length > 0 && !loadedRegionIds.has(island.id)
        ));

        return [...loadedIslands.filter((island): island is Island => Boolean(island)), ...inMemoryIslands]
          .flatMap(island => {
            const regionValues = getIslandSearchValues(island);
            return island.beaches.map(beach => ({
              island,
              beach,
              regionValues,
              searchValues: getBeachSearchValues(beach, island),
            }));
          });
      })();
    }

    try {
      return await globalBeachSearchIndexRef.current;
    } catch (error) {
      globalBeachSearchIndexRef.current = null;
      throw error;
    }
  };

  const findGlobalBeachMatch = async (query: string): Promise<GlobalBeachSearchMatch | null> => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) return null;

    const searchIndex = await getGlobalBeachSearchIndex();
    const rankedMatches = searchIndex
      .map(entry => {
        const beachScore = scoreSearchValues(trimmedQuery, entry.searchValues);
        const regionScore = scoreSearchValues(trimmedQuery, entry.regionValues);
        const currentRegionBonus = entry.island.id === selectedIsland?.id ? 2 : 0;
        const score = beachScore + (regionScore >= 90 ? 5 : 0) + currentRegionBonus;
        return { ...entry, beachScore, score };
      })
      .filter(entry => entry.beachScore >= 82)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.beach.rating !== a.beach.rating) return b.beach.rating - a.beach.rating;
        return displayBeachName(a.beach.name, language).localeCompare(displayBeachName(b.beach.name, language));
      });

    const match = rankedMatches[0];
    return match ? { island: match.island, beach: match.beach, score: match.score } : null;
  };

  const getRegionSearchSuggestions = (query: string): DirectorySearchSuggestion[] => (
    allIslands
      .map(island => ({
        island,
        score: scoreSearchValues(query, getIslandSearchValues(island)),
      }))
      .filter(item => item.score >= 80)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.island.name[language].localeCompare(b.island.name[language]);
      })
      .slice(0, 3)
      .map(({ island }) => ({
        id: `region-${island.id}`,
        type: 'region' as const,
        label: island.name[language] || island.name.en,
        subtitle: homeCopy.beaches[language] ? `${getIslandBeachCount(island)} ${homeCopy.beaches[language]}` : island.name.en,
        island,
      }))
  );

  const getBeachSearchSuggestionsFromEntries = (
    query: string,
    entries: GlobalBeachSearchEntry[],
    limit = 5
  ): DirectorySearchSuggestion[] => (
    entries
      .map(entry => {
        const beachScore = scoreSearchValues(query, entry.searchValues);
        const regionScore = scoreSearchValues(query, entry.regionValues);
        const currentRegionBonus = entry.island.id === selectedIsland?.id ? 3 : 0;
        return {
          ...entry,
          beachScore,
          score: beachScore + (regionScore >= 90 ? 4 : 0) + currentRegionBonus,
        };
      })
      .filter(entry => entry.beachScore >= 76)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.beach.rating !== a.beach.rating) return b.beach.rating - a.beach.rating;
        return displayBeachName(a.beach.name, language).localeCompare(displayBeachName(b.beach.name, language));
      })
      .slice(0, limit)
      .map(entry => ({
        id: `beach-${entry.island.id}-${entry.beach.id}`,
        type: 'beach' as const,
        label: displayBeachName(entry.beach.name, language),
        subtitle: entry.island.name[language] || entry.island.name.en,
        island: entry.island,
        beach: entry.beach,
      }))
  );

  const mergeDirectorySearchSuggestions = (
    regionSuggestions: DirectorySearchSuggestion[],
    beachSuggestions: DirectorySearchSuggestion[]
  ): DirectorySearchSuggestion[] => {
    const seen = new Set<string>();
    const merged: DirectorySearchSuggestion[] = [];

    for (const suggestion of [...regionSuggestions, ...beachSuggestions]) {
      if (seen.has(suggestion.id)) continue;
      seen.add(suggestion.id);
      merged.push(suggestion);
      if (merged.length >= 8) break;
    }

    return merged;
  };

  const handleDirectorySearchSubmit = async () => {
    const trimmedQuery = beachSearchQuery.trim();
    const regionMatch = findSearchRegionMatch(beachSearchQuery);
    let globalBeachMatch: GlobalBeachSearchMatch | null = null;

    if (!regionMatch && trimmedQuery.length >= 3) {
      try {
        globalBeachMatch = await findGlobalBeachMatch(trimmedQuery);
      } catch (error) {
        console.warn('Global beach search failed.', error);
      }
    }

    trackEvent('search_used', undefined, {
      ...analyticsBaseParams,
      source: 'directory_home',
      search_length: trimmedQuery.length,
      matched_region_id: regionMatch?.id,
      matched_beach_id: globalBeachMatch?.beach.id,
      matched_beach_region_id: globalBeachMatch?.island.id,
    });
    if (regionMatch && regionMatch.id !== selectedIsland?.id) {
      preserveSearchQueryOnRegionChangeRef.current = true;
      handleRegionSelected(regionMatch, 'selector');
      closeMobileBottomPanels();
      scrollToMapSection();
      return;
    }
    if (globalBeachMatch) {
      setIsDirectoryMapFollowPaused(false);
      setHighlightedMapBeachId(globalBeachMatch.beach.id);
      handleAllBeachesPanelOpenChange(true);
      if (globalBeachMatch.island.id !== selectedIsland?.id) {
        cacheLoadedIsland(globalBeachMatch.island);
        preserveSearchQueryOnRegionChangeRef.current = true;
        handleRegionSelected(globalBeachMatch.island, 'selector');
        return;
      }
      scrollToBeachResultsSection();
      return;
    }
    scrollToBeachResultsSection();
  };

  const handleDirectorySearchSuggestionSelect = (suggestion: DirectorySearchSuggestion) => {
    setDirectorySearchSuggestions([]);
    setIsDirectorySearchSuggesting(false);
    setBeachSearchQuery(suggestion.label);

    trackEvent('search_used', undefined, {
      ...analyticsBaseParams,
      source: 'directory_search_suggestion',
      suggestion_type: suggestion.type,
      region_id: suggestion.island.id,
      beach_id: suggestion.beach?.id,
      search_length: beachSearchQuery.trim().length,
    });

    if (suggestion.type === 'region') {
      preserveSearchQueryOnRegionChangeRef.current = true;
      closeMobileBottomPanels();
      if (suggestion.island.id !== selectedIsland?.id) {
        handleRegionSelected(suggestion.island, 'selector');
      }
      scrollToMapSection();
      return;
    }

    if (!suggestion.beach) return;

    pendingDirectorySearchHighlightRef.current = suggestion.beach.id;
    setIsDirectoryMapFollowPaused(false);

    if (suggestion.island.id !== selectedIsland?.id) {
      cacheLoadedIsland(suggestion.island);
      preserveSearchQueryOnRegionChangeRef.current = true;
      handleRegionSelected(suggestion.island, 'selector');
      return;
    }

    setHighlightedMapBeachId(suggestion.beach.id);
    handleAllBeachesPanelOpenChange(true);
    scrollToBeachResultsSection();
  };
  const stretchMobileDirectoryMap = !isDesktopViewport && Boolean(calmAllAroundSummary?.isEveryBeachSuitable);

  const directoryMapPreview = selectedIsland && !isUnsafeWinter ? (
    <MapLoadBoundary
      resetKey={`${selectedIsland.id}-${language}-directory`}
      fallback={
        <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white/82 px-4 text-center text-sm font-bold text-slate-600">
          <span>{homeCopy.mapError[language]}</span>
        </div>
      }
    >
      <Suspense fallback={<div className="h-[19rem] w-full animate-pulse rounded-[1.1rem] bg-slate-100 sm:h-[26rem] lg:h-[32rem]" />}>
        <BeachMap
          center={[selectedIsland.coordinates.lat, selectedIsland.coordinates.lon]}
          zoom={11}
          beaches={filteredMapSuitableBeaches}
          userLocation={userLocation}
          userLocationAccuracy={userLocationAccuracy}
          onBeachClick={(b) => openBeachDetails(b, 'directory_home_map')}
          onVisibleBeachIdsChange={handleDesktopMapVisibleBeachIdsChange}
          windSpeed={selectedForecast?.wind.speed}
          windDirection={selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined}
          windDirectionDeg={selectedForecast?.wind.deg}
          windDirectionSpreadDeg={mapWindDirectionSpreadDeg}
          beachLocalWinds={mapBeachLocalWinds}
          hourSlots={mapHourSlots}
          selectedHourDt={selectedHourDt}
          onHourChange={setSelectedHourDt}
          enableHourSlider
          language={language}
          islandName={selectedIsland.name[language]}
          selectedDate={selectedDayDate}
          topBeachId={highlightedDirectoryTopBeachId}
          highlightedBeachId={highlightedMapBeachId}
          followHighlightedBeach={!isDirectoryMapFollowPaused}
          fitBoundsToBeaches
          fitBoundsBeaches={mapSuitableBeaches}
          fitBoundsKey={selectedIsland.id}
          onUserInteraction={handleDirectoryMapUserInteraction}
          compactPreviewHeightClassName={stretchMobileDirectoryMap ? 'h-[calc(100dvh-24rem)] min-h-[24rem] max-h-[32rem]' : undefined}
          enableScrollWheelZoom={isDesktopViewport}
          isExposureLoading={isMapExposureLoading}
          compact
          preview
        />
      </Suspense>
    </MapLoadBoundary>
  ) : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden transition-colors duration-500">
      <div
        className={`atmosphere ${islandBackgroundCss ? 'cyclades-atmosphere' : ''}`}
        style={islandBackgroundCss ? ({ '--cyclades-bg': islandBackgroundCss } as React.CSSProperties) : undefined}
      />

      {activeWeatherFixtureScenario && (
        <div className="fixed left-1/2 top-2 z-[1000] w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-amber-950 shadow-lg">
          TEST SCENARIO - Fake forecast data: {activeWeatherFixtureScenario.label}
        </div>
      )}

      <Header
        language={language} onLanguageChange={handleLanguageChange}
        selectedIslandName={selectedIsland ? selectedIsland.name[language] : "..."}
        selectedIslandMeta={headerWeatherMeta}
        selectedDate={selectedDayDate}
        onOpenIslandSelector={() => setIsIslandSelectorOpen(true)} isWinter={isWinter}
        onOpenFavorites={() => handleMobileTab('favorites')}
        forecastSlot={showHeaderForecast ? (
          <>
            <BeachSearcherHome
              language={language}
              selectedIsland={selectedIsland}
              allIslands={allIslands}
              searchQuery={beachSearchQuery}
              activeCategory={directoryActiveCategory}
              sortBy={sortBy}
              isMobileViewport={!isDesktopViewport}
              isAllBeachesPanelOpen={isMobileAllBeachesPanelOpen}
              onAllBeachesPanelOpenChange={handleAllBeachesPanelOpenChange}
              isWeatherPanelOpen={isMobileWeatherPanelOpen}
              onWeatherPanelOpenChange={handleWeatherPanelOpenChange}
              suitableDistanceSortActive={!isDesktopViewport && sortBy === 'protected' && mobileSuitableDistanceSort}
              preferences={preferences}
              activeFilters={selectedFilters}
              filterResultCounts={preferenceFilterResultCounts}
              advancedFilterResultCounts={desktopAdvancedFilterResultCounts}
              sortResultCounts={sortResultCounts}
              filteredResultCount={filteredBeaches.length}
              searchSuggestions={directorySearchSuggestions}
              isSearchSuggesting={isDirectorySearchSuggesting}
              protectedSortLabel={protectedSortLabel}
              currentBeaufort={currentBeaufort}
              mapForecastTimeLabel={mapForecastTimeLabel}
              islandBackground={islandBackground}
              mapPreview={directoryMapPreview}
              topRecommendationCards={directoryTopRecommendationCards}
              suitableBeachCards={directoryHomeSuitableBeachCards}
              suitableBeachTotalCount={directorySuitableBeachTotalCount}
              suitableTimePrefix={selectedHourPrefix}
              onActiveSuitableBeachChange={handleActiveDirectoryBeachChange}
              showSuitableBeachSection={shouldShowDirectorySuitableSection}
              allBeachCards={directoryAllSourceBeaches}
              beachWeatherContexts={mapSuitableBeaches}
              topBeachToday={directoryTopRecommendationCards.length > 0 ? null : displayedDirectoryTopBeach}
              topBeachDescription={directoryTopRecommendationCards.length > 0 || !displayedDirectoryTopBeach ? '' : directoryTopDescription}
              topBeachTimingLabel={directoryTopRecommendationCards.length > 0 ? undefined : directoryTopTimingLabel}
              forecastDays={forecast || undefined}
              selectedDayIndex={selectedDayIndex}
              selectedForecast={selectedForecast}
              selectedDate={selectedDayDate}
              lastUpdated={lastUpdated}
              favorites={favorites}
              t={t}
              onToggleFavorite={handleToggleFavorite}
              onSearchChange={setBeachSearchQuery}
              onSearchSubmit={handleDirectorySearchSubmit}
              onSearchSuggestionSelect={handleDirectorySearchSuggestionSelect}
              onOpenFilters={() => setIsFilterModalOpen(true)}
              onOpenIslandSelector={() => setIsIslandSelectorOpen(true)}
              onUseCurrentLocation={() => {
                setBeachSearchQuery('');
                // "Κοντά μου" should surface the beaches closest to the user first.
                hasUserSelectedSortRef.current = true;
                setSortBy('protected');
                setMobileSuitableDistanceSort(true);
                void handleSelectNearest();
              }}
              onRequestUserLocation={() => {
                void handleRequestUserLocation();
              }}
              hasUserLocation={Boolean(userLocation)}
              isFindingCurrentLocation={isFindingNearest}
              currentLocationError={findNearestError}
              onCategorySelect={handleDirectoryCategorySelect}
              onSortChange={handleSortChange}
              onAdvancedFilterToggle={handleToggleAdvancedFilter}
              onForecastDaySelect={setSelectedDayIndex}
              onBeachClick={(beach) => openBeachDetails(beach, 'directory_home_card')}
              onSelectIsland={handleRegionSelected}
              strongWindContext={isStrongRecommendationMode}
            />

            <div className="hidden" aria-hidden="true">
              <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white/86 shadow-sm shadow-sky-900/5 ring-1 ring-white/45">
            <div id="forecast-section" className="scroll-mt-4">
              <WeatherSummary
                forecast={forecast!}
                selectedDayIndex={selectedDayIndex}
                onDaySelect={setSelectedDayIndex}
                t={t}
                islandName={selectedIsland?.name[language]}
                variant="header"
              />
            </div>

            {calmAllAroundSummary && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-white/55 px-2 py-3 sm:min-h-[12.5rem] sm:px-4 sm:py-4"
              >
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white/72 text-emerald-600 shadow-sm ring-1 ring-emerald-100/80 sm:h-10 sm:w-10">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="mx-auto max-w-3xl font-heading text-[1.22rem] font-bold leading-[1.16] text-slate-900 [text-wrap:balance] sm:text-[1.65rem] lg:text-[1.75rem]">
                      {calmSummaryTitle}
                    </h2>
                    <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-[0.95rem]">
                      {calmSummaryDescription}
                    </p>
                  </div>
                  <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
                    <div className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/58 px-3 text-sky-700 shadow-sm shadow-sky-900/5">
                      <Wind className="h-4 w-4" />
                      {homeCopy.calmWindBadge[language](calmAllAroundSummary.beaufort)}
                    </div>
                    <div className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/58 px-3 text-cyan-700 shadow-sm shadow-sky-900/5">
                      <Waves className="h-4 w-4" />
                      {homeCopy.calmSeaBadge[language](calmAllAroundSummary.waveHeightM)}
                    </div>
                    <div className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/58 px-3 text-emerald-700 shadow-sm shadow-sky-900/5">
                      <CheckCircle2 className="h-4 w-4" />
                      {homeCopy.calmBeachesBadge[language](calmAllAroundSummary.suitableBeachCount, calmAllAroundSummary.totalBeachCount)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {headerTopBeach && (
              <motion.button
                type="button"
                onClick={() => openBeachDetails(headerTopBeach.beach, 'top_recommendation_panel')}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                className="block w-full border-t border-white/55 px-2 py-3 text-left transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:px-4 sm:py-4"
              >
                <div className="space-y-3 text-center">
                  {headerTopBeachPhoto ? (
                    <div className="relative overflow-hidden rounded-2xl border border-white/65 bg-white/45 shadow-sm shadow-sky-900/5 ring-1 ring-white/45">
                      <img
                        src={headerTopBeachPhoto}
                        alt={headerTopBeachName}
                        width={960}
                        height={360}
                        loading="eager"
                        decoding="async"
                        className="h-40 w-full object-cover sm:h-52 lg:h-60"
                      />
                      {headerTopCanNavigate && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            trackEvent('navigation_clicked', headerTopBeach.beach.id, {
                              ...analyticsBaseParams,
                              beach_name: headerTopBeach.beach.name.en,
                              source: 'top_recommendation_panel',
                            });
                            openNavigation(headerTopBeach.beach);
                          }}
                          className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-2xl bg-white/90 text-cyan-700 shadow-md shadow-sky-900/12 ring-1 ring-white/70 backdrop-blur-xl transition hover:bg-white hover:text-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                          aria-label={getLocalizedCopy(language, {
                            en: `Navigate to ${headerTopBeachName}`,
      gr: `Πλοήγηση προς ${headerTopBeachName}`,
                            fr: `Naviguer vers ${headerTopBeachName}`,
                            de: `Zu ${headerTopBeachName} navigieren`,
                            it: `Naviga verso ${headerTopBeachName}`,
                          })}
                          title={t.navigate}
                        >
                          <Navigation className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ) : headerTopCanNavigate ? (
                    <div className="relative mx-auto flex h-11 w-24 items-center justify-center gap-2 rounded-xl bg-white/72 text-emerald-600 shadow-sm ring-1 ring-emerald-100/80">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          trackEvent('navigation_clicked', headerTopBeach.beach.id, {
                            ...analyticsBaseParams,
                            beach_name: headerTopBeach.beach.name.en,
                            source: 'top_recommendation_panel',
                          });
                          openNavigation(headerTopBeach.beach);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                        aria-label={getLocalizedCopy(language, {
                          en: `Navigate to ${headerTopBeachName}`,
      gr: `Πλοήγηση προς ${headerTopBeachName}`,
                          fr: `Naviguer vers ${headerTopBeachName}`,
                          de: `Zu ${headerTopBeachName} navigieren`,
                          it: `Naviga verso ${headerTopBeachName}`,
                        })}
                        title={t.navigate}
                      >
                        <Navigation className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                  <div className="space-y-1.5">
                    <h2 className="mx-auto max-w-3xl truncate font-heading text-[1.55rem] font-extrabold leading-[1.16] text-slate-950 sm:text-[1.75rem]">
                      {headerTopBeachName}
                    </h2>
                    <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-[0.95rem]">
                      {headerTopDescription}
                    </p>
                  </div>

                  {headerTopTimingLabel && (
                    <div
                      className="mx-auto flex min-h-12 w-full max-w-md min-w-0 items-center justify-center gap-2.5 rounded-2xl border border-cyan-200/80 bg-cyan-50/82 px-3 py-2 text-cyan-800 shadow-sm shadow-sky-900/5"
                      aria-label={`${visitTimeLabel}: ${headerTopTimingLabel}`}
                    >
                      <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 text-left">
                        <span className="block text-[0.68rem] font-bold leading-tight text-cyan-700/80">
                          {visitTimeLabel}
                        </span>
                        <span className="block truncate text-sm font-extrabold leading-tight text-slate-950">
                          {headerTopTimingLabel}
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2">
                    <div className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/58 px-3 text-sky-700 shadow-sm shadow-sky-900/5">
                      <Wind className="h-4 w-4" />
                      {homeCopy.calmWindBadge[language](currentBeaufort)}
                    </div>
                    <div className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/58 px-3 text-cyan-700 shadow-sm shadow-sky-900/5">
                      <Waves className="h-4 w-4" />
                      {homeCopy.calmSeaBadge[language](headerTopWaveHeightM)}
                    </div>
                  </div>
                </div>
              </motion.button>
            )}

              </div>
            </div>
          </>
        ) : undefined}
      />

      {showRecommendationPreviewSection && forecast?.[selectedDayIndex] && !isUnsafeWinter && !showHeaderForecast && recommendationSectionBeaches.length > 0 && (
        <section className="relative z-20 px-3 pb-3 pt-1 sm:px-4 sm:pb-5 sm:pt-0" aria-label={recommendationModeTitle}>
          <div className="mx-auto max-w-6xl">
            <div className="relative -mx-3 rounded-[1.35rem] border border-white/70 bg-white/72 px-3 pb-4 pt-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-xl sm:mx-0 sm:px-5 sm:pb-5 sm:pt-5">
              <div className="mb-3 space-y-1 px-1 text-center sm:mb-4">
                <h2 className="font-heading text-lg font-extrabold leading-tight text-slate-950 sm:text-2xl">
                  {recommendationModeTitle}
                </h2>
                <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
                  {recommendationGeneralHelper}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-6">
                {recommendationSectionBeaches.map((r, i) => (
                  <motion.div key={r.beach.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.18 }}>
                    <BeachCard
                      beach={{...r.beach, distance: r.distance}} isExposed={r.isExposed} language={language} t={t}
                      isCalm={r.seaCalmClaimAllowed === true} windSpeed={forecast[selectedDayIndex].wind.speed} temperature={forecast[selectedDayIndex].temp_max}
                      favorites={favorites} onToggleFavorite={handleToggleFavorite} islandName={selectedIsland!.name[language]}
                      regionId={selectedIsland?.id}
                      onClick={() => openBeachDetails(r.beach, 'recommendation_card')}
                      todayScore={r.score}
                      variant="decision"
                      recommendationRank={i + 1}
                      strongWindContext
                      bestBeachTime={r.bestBeachTime}
                      topPickTimeLabel={getTopPickTimingLabel(r.bestBeachTime, selectedDayDate, language, topPickNow)}
                      selectedDate={selectedDayDate}
                      exposureLevel={r.exposureLevel}
                      waveHeightM={r.waveHeightM}
                      warnings={r.warnings}
                      confidence={r.confidence}
                      swimmingComfort={r.swimmingComfort}
                      canClaimWindProtection={r.canClaimWindProtection}
                      seaCalmClaimAllowed={r.seaCalmClaimAllowed}
                      windSuitabilityText={describeSimpleWindSuitability(r.simpleWindSuitability, language)}
                      windSuitabilityColor={r.simpleWindSuitability?.suitabilityColor}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isDesktopViewport && showWindContextSummaryPanel && (
        <section className="relative z-20 px-3 pb-3 pt-1 sm:px-4 sm:pb-5 sm:pt-0" aria-label={recommendationModeTitle}>
          <div className="mx-auto max-w-3xl rounded-[1.35rem] border border-white/70 bg-white/72 px-4 py-4 text-center shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-xl sm:px-5 sm:py-5">
            <h2 className="font-heading text-lg font-extrabold leading-tight text-slate-950 sm:text-2xl">
              {recommendationModeTitle}
            </h2>
            <p className="mx-auto mt-1.5 max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
              {recommendationGeneralHelper}
            </p>
          </div>
        </section>
      )}

      {selectedIsland && !isUnsafeWinter && isDesktopViewport && !showHeaderForecast && (
        <section id="map-section-desktop" className="relative z-20 hidden px-3 pb-3 pt-1 sm:block sm:px-4 sm:pb-5 sm:pt-0">
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-2xl border border-white/60 shadow-lg dark:border-slate-800 sm:rounded-3xl">
              <MapLoadBoundary
                resetKey={`${selectedIsland.id}-${language}-desktop`}
                fallback={
                  <div role="alert" className="flex h-[420px] w-full flex-col items-center justify-center gap-2 bg-white/82 px-4 text-center text-sm font-bold text-slate-600">
                    <span>{homeCopy.mapError[language]}</span>
                  </div>
                }
              >
                <Suspense fallback={<div className="h-[420px] w-full animate-pulse bg-slate-100 dark:bg-slate-800" />}>
                  <BeachMap
                    center={[selectedIsland.coordinates.lat, selectedIsland.coordinates.lon]}
                    zoom={11}
                    beaches={filteredMapSuitableBeaches}
                    userLocation={userLocation}
                    onBeachClick={(b) => openBeachDetails(b, 'map')}
                    onVisibleBeachIdsChange={handleDesktopMapVisibleBeachIdsChange}
                    windSpeed={selectedForecast?.wind.speed}
                    windDirection={selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined}
                    windDirectionDeg={selectedForecast?.wind.deg}
                    windDirectionSpreadDeg={mapWindDirectionSpreadDeg}
                    beachLocalWinds={mapBeachLocalWinds}
                    hourSlots={mapHourSlots}
                    selectedHourDt={selectedHourDt}
                    onHourChange={setSelectedHourDt}
                    enableHourSlider
                    language={language}
                    islandName={selectedIsland.name[language]}
                    selectedDate={selectedDayDate}
                    topBeachId={highlightedDirectoryTopBeachId}
                    fitBoundsToBeaches
                    fitBoundsBeaches={mapSuitableBeaches}
                    fitBoundsKey={selectedIsland.id}
                    enableScrollWheelZoom={isDesktopViewport}
                    isExposureLoading={isMapExposureLoading}
                    preview
                  />
                </Suspense>
              </MapLoadBoundary>
            </div>
          </div>
        </section>
      )}

      {showHeaderForecast && !selectedIsland && (
        <section
          className="relative z-20 px-3 pb-3 pt-2 sm:px-4 sm:pb-5 sm:pt-1"
          aria-label={exploreSectionLabel}
        >
          <div className="mx-auto max-w-6xl">
            <div className="space-y-2.5">
              <PreferenceFilters
                preferences={preferences}
                onToggle={handleTogglePreference}
                filterResultCounts={preferenceFilterResultCounts}
                t={t}
                variant="panel"
              />
              <BeachFilters
                t={t}
                language={language}
                searchQuery={beachSearchQuery}
                onSearchChange={setBeachSearchQuery}
                sortBy={sortBy}
                onSortChange={handleSortChange}
                protectedSortLabel={protectedSortLabel}
                sortResultCounts={sortResultCounts}
                preferences={preferences}
                activeFilters={selectedFilters}
                onPreferenceFilterClear={handleTogglePreference}
                onAdvancedFilterClear={handleClearAdvancedFilter}
                onClearAll={handleClearSearchAndFilters}
                hasActiveSearchOrFilters={hasActiveSearchOrFilters}
                variant="panel"
                searchSuggestions={beachSearchSuggestions}
              />
            </div>
          </div>
        </section>
      )}

      {!showHeaderForecast && (
        <>
          {/* ===== COMPACT HERO ===== */}
          <section className="relative overflow-hidden pb-0 pt-1 sm:pb-1">
            <div className="absolute top-10 left-1/4 w-72 h-72 bg-sky-300/20 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto px-3 sm:px-4 relative z-10">
              {/* Location & beach count */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`max-w-3xl mx-auto ${selectedIsland ? 'h-0' : 'mb-5'}`}
              >
                <div className="text-center">
                  {!selectedIsland && (
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white">
                      {homeCopy.selectLocation[language]}
                    </h1>
                  )}
                </div>
              </motion.div>

            </div>
          </section>
        </>
      )}

      {/* ===== MAIN CONTENT ===== */}
      {shouldRenderMainShell && (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 space-y-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:space-y-16 md:pb-8 lg:space-y-8 relative z-10">
        <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={`${selectedIsland?.id}-${selectedDayIndex}`}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              className="space-y-6 sm:space-y-16 lg:space-y-8"
            >
              {isWaitingForForecast && (
                <section
                  aria-hidden="true"
                  className="min-h-[980px] space-y-4 rounded-[1.75rem] sm:min-h-[760px]"
                >
                  <div className="h-[250px] animate-pulse rounded-2xl border border-white/60 bg-white/70 shadow-sm ring-1 ring-white/30 sm:h-[300px]" />
                  <div className="mx-auto h-12 max-w-3xl animate-pulse rounded-full bg-white/58 ring-1 ring-white/40" />
                  <div className="h-[520px] animate-pulse rounded-2xl border border-white/60 bg-white/62 shadow-sm ring-1 ring-white/30 sm:h-[360px]" />
                </section>
              )}

              {weatherError && (
                <section
                  role="status"
                  className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/92 p-3 text-amber-900 shadow-sm shadow-amber-900/5 sm:items-center sm:p-4"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 sm:mt-0" />
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                    {weatherError}
                  </p>
                  <button
                    type="button"
                    onClick={handleWeatherRetry}
                    disabled={weatherLoading}
                    aria-label={homeCopy.weatherRetry[language]}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-amber-800 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${weatherLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden min-[390px]:inline">{homeCopy.weatherRetry[language]}</span>
                  </button>
                </section>
              )}

              {/* Top Recommendations */}
              {forecast?.[selectedDayIndex] && !isUnsafeWinter && !showHeaderForecast && !showRecommendationPreviewSection && !hasActiveSearchOrFilters && showDecisionRecommendations && recommendationSectionBeaches.length > 0 && (
                <section className="!mt-0 sm:!mt-5">
                  <div className="relative -mx-3 rounded-[1.35rem] border border-white/70 bg-white/72 px-3 pb-4 pt-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-xl sm:mx-0 sm:px-5 sm:pb-5 sm:pt-5">
                    <div className="mb-3 space-y-1 px-1 text-center sm:mb-4">
                      <h2 className="font-heading text-lg font-extrabold leading-tight text-slate-950 sm:text-2xl">
                        {recommendationModeTitle}
                      </h2>
                      <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-600">
                        {recommendationGeneralHelper}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-6">
                    {recommendationSectionBeaches.map((r, i) => (
                      <motion.div key={r.beach.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.18 }}>
                        <BeachCard
                          beach={{...r.beach, distance: r.distance}} isExposed={r.isExposed} language={language} t={t}
                          isCalm={r.seaCalmClaimAllowed === true} windSpeed={forecast[selectedDayIndex].wind.speed} temperature={forecast[selectedDayIndex].temp_max}
                          favorites={favorites} onToggleFavorite={handleToggleFavorite} islandName={selectedIsland!.name[language]}
                          regionId={selectedIsland?.id}
                          onClick={() => openBeachDetails(r.beach, 'recommendation_card')}
                          todayScore={r.score}
                      variant="decision"
                      recommendationRank={showStrongManageableSection || !headerTopCandidate ? i + 1 : i + 2}
                      recommendationLabel={
                        recommendationDisplayMode === 'mild'
                          ? homeCopy.recommendationMode.mild.cardLabel[language]
                        : showStrongManageableSection
                          ? undefined
                        : undefined
                      }
                          bestBeachTime={r.bestBeachTime}
                          topPickTimeLabel={getTopPickTimingLabel(r.bestBeachTime, selectedDayDate, language, topPickNow)}
                          selectedDate={selectedDayDate}
                          exposureLevel={r.exposureLevel}
                          waveHeightM={r.waveHeightM}
                          warnings={r.warnings}
                          confidence={r.confidence}
                          swimmingComfort={r.swimmingComfort}
                          canClaimWindProtection={r.canClaimWindProtection}
                          seaCalmClaimAllowed={r.seaCalmClaimAllowed}
                          strongWindContext={isStrongRecommendationMode}
                          windSuitabilityText={describeSimpleWindSuitability(r.simpleWindSuitability, language)}
                          windSuitabilityColor={r.simpleWindSuitability?.suitabilityColor}
                        />
                      </motion.div>
                    ))}
                    </div>
                    <p className="mx-auto mt-3 max-w-2xl px-1 text-center text-[11px] font-semibold leading-relaxed text-slate-500 sm:mt-4 sm:text-xs">
                      Recommendations are indicative and based on available weather and beach data. Conditions may vary locally. Always follow local warnings and use personal judgment.
                    </p>
                  </div>
                </section>
              )}

              {/* AI Advisor - temporarily hidden */}
              {ENABLE_AI_ADVISOR && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="max-w-3xl mx-auto"
                >
                  <Suspense fallback={null}>
                    <AiBeachAdvisor allIslands={allIslands} selectedIsland={selectedIsland} weather={forecast?.[selectedDayIndex] || weather} userLocation={userLocation} language={language} />
                  </Suspense>
                </motion.div>
              )}

              {isUnsafeWinter && <UnsafeConditionsMessage t={t} />}

              {!showHeaderForecast && (
              <RecommendationSection
                beaches={beachListBeaches} language={language} t={t}
                windSpeed={forecast?.[selectedDayIndex]?.wind.speed || 0}
                windDirection={degToCompass(forecast?.[selectedDayIndex]?.wind.deg || 0)}
                waveHeightM={forecast?.[selectedDayIndex]?.marine?.waveHeightM}
                selectedDate={selectedDayDate}
                islandName={selectedIsland?.name[language] || ''}
                regionId={selectedIsland?.id}
                onBeachClick={(b) => openBeachDetails(b, 'beach_list')}
                searchQuery={beachSearchQuery} onSearchChange={setBeachSearchQuery}
                sortBy={sortBy} onSortChange={handleSortChange}
                activeFilters={selectedFilters}
                onFilterChange={handleClearAdvancedFilter}
                preferences={preferences}
                onPreferenceFilterClear={handleTogglePreference}
                onClearSearchAndFilters={handleClearSearchAndFilters}
                hasActiveSearchOrFilters={hasActiveSearchOrFilters}
                severeWeatherNoSwimming={shouldShowNoSwimmingMessage}
                noSwimmingReason={isRainBlockedBeachWindow ? 'rain' : 'conditions'}
                favorites={favorites} onToggleFavorite={handleToggleFavorite}
                protectedSortLabel={protectedSortLabel}
                sortResultCounts={sortResultCounts}
                protectedSortEmptyCopy={protectedSortEmptyCopy}
                hasShownAlternativeRecommendations={hasShownAlternativeRecommendations}
                showControls={!showHeaderForecast}
                searchSuggestions={beachSearchSuggestions}
                protectedSortNoResults={protectedSortNoResults}
                strongWindContext={isStrongRecommendationMode}
              />
              )}

              {betaFeedbackUrl && (
                <section className="mx-auto max-w-3xl rounded-[1.5rem] border border-white/60 bg-white/62 p-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <h2 className="font-heading text-base font-bold text-slate-900">
                        {homeCopy.betaFeedbackTitle[language]}
                      </h2>
                      <p className="text-sm font-medium leading-snug text-slate-500">
                        {homeCopy.betaFeedbackBody[language]}
                      </p>
                    </div>
                    <a
                      href={betaFeedbackUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={handleBetaFeedbackClick}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                    >
                      {homeCopy.betaFeedbackCta[language]}
                    </a>
                  </div>
                </section>
              )}

              {selectedIsland && !isUnsafeWinter && !isDesktopViewport && !showHeaderForecast && (
                <section id="map-section" ref={mapSectionRef} className="!mt-4 space-y-2 sm:hidden sm:space-y-5">
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex min-h-10 w-full items-center justify-center rounded-full border border-white/50 bg-white/42 px-5 py-2 shadow-sm shadow-sky-900/5 ring-1 ring-white/30 backdrop-blur-xl sm:px-6">
                        <h2 className="w-full text-center font-heading text-sm font-semibold leading-tight text-slate-600 sm:text-base">
                        <span className="sm:hidden">{homeCopy.viewOnMap[language]}</span>
                        <span className="hidden sm:inline">{homeCopy.mapTitle[language]}</span>
                      </h2>
                    </div>
                    <p className="hidden text-center text-xs font-semibold leading-snug text-slate-500/80 sm:block sm:text-sm">
                      {homeCopy.mapSubtitle[language]}
                    </p>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-white/60 shadow-lg dark:border-slate-800 sm:rounded-3xl">
                    {shouldLoadMap ? (
                      <MapLoadBoundary
                        resetKey={`${selectedIsland.id}-${language}`}
                        fallback={
                          <div role="alert" className="flex h-[195px] w-full flex-col items-center justify-center gap-2 bg-white/82 px-4 text-center text-sm font-bold text-slate-600 sm:h-[420px]">
                            <span>{homeCopy.mapError[language]}</span>
                            <button
                              type="button"
                              onClick={() => setShouldLoadMap(false)}
                              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              {homeCopy.weatherRetry[language]}
                            </button>
                          </div>
                        }
                      >
                        <Suspense fallback={<div className="h-[195px] w-full animate-pulse bg-slate-100 dark:bg-slate-800 sm:h-[420px]" />}>
                          <BeachMap
                            center={[selectedIsland.coordinates.lat, selectedIsland.coordinates.lon]}
                            beaches={filteredMapSuitableBeaches}
                            userLocation={userLocation}
                            onBeachClick={(b) => openBeachDetails(b, 'map')}
                            windSpeed={selectedForecast?.wind.speed}
                            windDirection={selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined}
                            windDirectionDeg={selectedForecast?.wind.deg}
                            windDirectionSpreadDeg={mapWindDirectionSpreadDeg}
                            beachLocalWinds={mapBeachLocalWinds}
                            hourSlots={mapHourSlots}
                            selectedHourDt={selectedHourDt}
                            onHourChange={setSelectedHourDt}
                            enableHourSlider
                            language={language}
                            islandName={selectedIsland.name[language]}
                            selectedDate={selectedDayDate}
                            topBeachId={highlightedDirectoryTopBeachId}
                            fitBoundsToBeaches
                            fitBoundsBeaches={mapSuitableBeaches}
                            fitBoundsKey={selectedIsland.id}
                            enableScrollWheelZoom={isDesktopViewport}
                            isExposureLoading={isMapExposureLoading}
                            preview
                          />
                        </Suspense>
                      </MapLoadBoundary>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent('map_viewed', undefined, {
                            ...analyticsBaseParams,
                            source: 'load_prompt',
                          });
                          setShouldLoadMap(true);
                        }}
                        className="flex h-[165px] w-full flex-col items-center justify-center gap-2 bg-white/78 px-4 text-center text-sm font-bold text-slate-600 transition hover:bg-white/90 sm:h-[220px]"
                        aria-label={homeCopy.mapLoadPrompt[language]}
                      >
                        <span>{homeCopy.mapLoadPrompt[language]}</span>
                        <span className="text-xs font-semibold text-slate-400">{homeCopy.mapSubtitle[language]}</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {shouldRenderUsageInsights && (
                <div ref={insightsSectionRef} className="min-h-1">
                  <Suspense fallback={null}>
                    <UsageInsights allBeaches={selectedIsland?.beaches || []} language={language} t={t} />
                  </Suspense>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

      </main>
      )}

      <div className={`${isDesktopViewport ? 'relative z-[70] bg-transparent' : 'relative z-10 bg-transparent pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
        <LegalFooter language={language} />
      </div>

      {!isDesktopViewport && (
        <nav
          className="hidden"
          aria-label={getLocalizedCopy(language, {
            en: 'Legal links',
            gr: 'Νομικοί σύνδεσμοι',
            fr: 'Liens légaux',
            de: 'Rechtliche Links',
            it: 'Link legali',
          })}
        >
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => openLegalModal('terms')}
              className="min-h-9 rounded-full px-2 text-[11px] font-black text-slate-800 transition hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {getLocalizedCopy(language, {
                en: 'Terms',
                gr: 'Όροι',
                fr: 'Terms',
                de: 'Terms',
                it: 'Terms',
              })}
            </button>
            <button
              type="button"
              onClick={() => openLegalModal('privacy')}
              className="min-h-9 rounded-full px-2 text-[11px] font-black text-slate-700 transition hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {getLocalizedCopy(language, {
                en: 'Privacy',
                gr: 'Απόρρητο',
                fr: 'Privacy',
                de: 'Privacy',
                it: 'Privacy',
              })}
            </button>
            <button
              type="button"
              onClick={() => openLegalModal('cookies')}
              className="min-h-9 rounded-full px-2 text-[11px] font-black text-slate-700 transition hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Cookies
            </button>
          </div>
        </nav>
      )}

      {/* ===== MOBILE BOTTOM NAVIGATION ===== */}
      <MobileBottomNav
        language={language}
        activeTab={mobileTab}
        onTabChange={handleMobileTab}
        showBuddy={ENABLE_BEACH_BUDDY_CHAT}
        showPlanner={ENABLE_PLANNER_PRO}
      />

      <PrivacyConsentBanner language={language} />

      {/* ===== FLOATING ACTION BUTTONS (desktop only) ===== */}
      {(ENABLE_PLANNER_PRO || ENABLE_BEACH_BUDDY_CHAT) && (
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-3">
        {ENABLE_PLANNER_PRO && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsPlannerOpen(true)}
          className="group relative p-4 bg-white dark:bg-slate-800 text-primary rounded-2xl shadow-lg hover:shadow-xl border border-sky-100 dark:border-slate-700 transition-all cursor-pointer"
          aria-label={homeCopy.tripPlanner[language]}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
            Pro
          </span>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-heading font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {language === 'gr' ? 'Planner Pro' : 'Planner Pro'}
          </span>
        </motion.button>
        )}

        {ENABLE_BEACH_BUDDY_CHAT && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(true)}
          className="group relative p-4 bg-cta text-white rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
          aria-label={homeCopy.aiAssistant[language]}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-heading font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            AI Chat
          </span>
        </motion.button>
        )}
      </div>
      )}

      {/* ===== MODALS ===== */}
      {ENABLE_BEACH_BUDDY_CHAT && (
        <Suspense fallback={null}>
          <ChatbotModal
            isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={chatMessages}
            onSend={handleChatSend} t={t} isLoading={chatMessages.some(m => m.id.startsWith('bot-loading'))}
            onNewChat={() => setChatMessages([])} suggestions={['Ποια παραλία είναι καλύτερη σήμερα;', 'Πού να πάω για snorkeling;']}
          />
        </Suspense>
      )}

      {ENABLE_PLANNER_PRO && isPlannerOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setIsPlannerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="planner-pro-title"
          >
            <div className="mb-4 flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V8a4 4 0 00-8 0v3m-2 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z" />
                </svg>
              </div>
              <div>
                <div className="mb-1 inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-700">
                  Pro
                </div>
                <h2 id="planner-pro-title" className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {plannerProCopy.title[language]}
                </h2>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {plannerProCopy.description[language]}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                disabled
              >
                {plannerProCopy.cta[language]}
              </button>
              <button
                type="button"
                onClick={() => setIsPlannerOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {t.closeModalLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {isIslandSelectorOpen && (
        <Suspense fallback={null}>
          <IslandSelectorModal isOpen={isIslandSelectorOpen} onClose={() => setIsIslandSelectorOpen(false)} islands={allIslands} onSelect={handleRegionSelected} t={t} language={language} onSelectNearest={handleSelectNearest} isFindingNearest={isFindingNearest} findNearestError={findNearestError} />
        </Suspense>
      )}

      {isFilterModalOpen && (
        <Suspense fallback={null}>
          <FilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            t={t}
            resultCount={filterModalResultCount ?? filteredBeaches.length}
          >
            <CombinedFilter
              initialSelectedFilters={selectedFilters}
              initialSortBy={sortBy}
              initialDistanceWithinSuitable={sortBy === 'protected' && mobileSuitableDistanceSort}
              onApplyFilters={(f, s, options) => {
                const normalizedFilters = f.filter(filter => filter !== 'restaurant');
                const appliedFilters = normalizedFilters.filter(filter => filter !== 'showAll');
                if (appliedFilters.length > 0) {
                  trackEvent('filter_applied', undefined, {
                    ...analyticsBaseParams,
                    source: 'advanced_filter_modal',
                    filter_count: appliedFilters.length,
                  });
                }
                setSelectedFilters(normalizedFilters);
                setMobileSuitableDistanceSort(s === 'protected' && Boolean(options?.distanceWithinSuitable));
                handleSortChange(s);
                setIsFilterModalOpen(false);
                if (!isDesktopViewport) {
                  handleAllBeachesPanelOpenChange(true);
                } else {
                  scrollToBeachResultsSection(s === 'protected' ? 'suitable' : 'all');
                }
              }}
              onClose={() => setIsFilterModalOpen(false)}
              t={t}
              language={language}
              isGettingLocation={isFindingNearest}
              locationError={findNearestError}
              hasUserLocation={Boolean(userLocation)}
              onRequestLocation={() => {
                setBeachSearchQuery('');
                void handleSelectNearest();
              }}
              availableFilters={availableMobileFilterKeys}
              protectedSortLabel={protectedSortLabel}
              showProtectedSort={!(calmAllAroundSummary?.isEveryBeachSuitable ?? false)}
              hideDistanceSort={!isDesktopViewport}
              getResultCount={getMobileFilterModalResultCount}
              onResultCountChange={setFilterModalResultCount}
            />
          </FilterModal>
        </Suspense>
      )}
    </div>
  );
};
