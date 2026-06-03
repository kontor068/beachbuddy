import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Accessibility, Beach, DailyForecast, ForecastItem, Island, LanguageCode, FilterKey, SortOption, Theme, UserPreferences, SuitableBeach, WindDirection } from './types';
import { calculateBeachScore, getSuitableBeaches, filterBeachesByUserPreferences, hasHourlyRainRisk, type BeachWeatherById } from './services/recommendationService';
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
import { MobileBottomNav } from './components/MobileBottomNav';
import { PrivacyConsentBanner } from './components/PrivacyConsentBanner';
import { MapLoadBoundary } from './components/MapLoadBoundary';
import { LegalFooter } from './components/LegalFooter';
import { BeachSearcherHome, type DirectoryCategory } from './components/BeachSearcherHome';

// Hooks & Utils
import { useBeaches } from './hooks/useBeaches';
import { useWeather } from './hooks/useWeather';
import { useLocation } from './hooks/useLocation';
import { translations } from './translations';
import { degToCompass, getBeaufortLevel, isWinterSeason } from './utils/weatherUtils';
import { trackEvent, trackPageView } from './services/analyticsService';
import { loadBeachDetailData, mergeBeachDetailData } from './services/beachDataLoader';
import { calculateSeaConditionScore, hasPoorSeaConditions } from './utils/seaConditions';
import { recordForecastSnapshots } from './services/forecastVerificationService';
import { getBeachPhotoLookup } from './services/beachPhotos';
import { scrollElementIntoView, scrollToPageTop } from './utils/scroll';
import { getInitialLanguage, languageToLocale, saveLanguagePreference, type SupportedLanguage } from './utils/i18n';
import { lazyWithChunkRecovery } from './utils/chunkLoadRecovery';
import { buildBetaFeedbackUrl } from './utils/betaFeedback';
import { QUICK_PREFERENCE_FILTERS } from './utils/preferenceFilterLabels';
import { openNavigation } from './utils/navigation';
import { displayBeachName } from './utils/localization';
import {
  getSelectedDayPrefix,
  getSelectedDaySentencePrefix,
} from './utils/dateLabels';
import { getTopPickTiming, getTopPickTimingLabel, topPickTimingPriority } from './utils/topPickTiming';
import { getActiveWeatherFixtureScenario } from './utils/weatherFixtures';

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

const badRoadAccessTypes = new Set(['4x4_only', 'hiking_path_difficult']);

const seoCopy: Record<SupportedLanguage, { title: string; description: string; locale: string }> = {
  en: {
    title: 'Calm Beach Greece',
    description: 'Calm Beach Greece - Find the best beach to visit today based on wind, waves and weather.',
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

const hasBadRoadAccess = (beach: Beach): boolean => {
  return beach.accessibility === Accessibility.DIFFICULT || badRoadAccessTypes.has(beach.metadata?.access?.type || '');
};

const hasMainstreamAccess = (beach: Beach): boolean => (
  beach.accessibility === Accessibility.EASY ||
  beach.metadata?.access?.type === 'asphalt_road' ||
  beach.metadata?.access?.type === 'passable_dirt_road'
);

const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant || beach.amenities?.parking)
);

const mainstreamRecommendationScore = (beach: Beach): number => {
  const popularity = typeof beach.popularityScore === 'number' ? beach.popularityScore : 0;
  const ratingSignal = Math.max(0, Math.min(20, (beach.rating - 4) * 20));
  const accessSignal = hasMainstreamAccess(beach) ? 18 : 0;
  const facilitiesSignal = hasMainstreamFacilities(beach) ? 14 : 0;
  const familySignal = beach.environment?.familyFriendly ? 6 : 0;
  const remotePenalty = beach.environment?.remote ? 18 : 0;
  const badAccessPenalty = hasBadRoadAccess(beach) ? 35 : 0;

  return popularity + ratingSignal + accessSignal + facilitiesSignal + familySignal - remotePenalty - badAccessPenalty;
};

const isWindProtectedRecommendation = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel' | 'canClaimWindProtection'>): boolean => {
  return item.exposureLevel === 'protected' && item.canClaimWindProtection === true;
};

const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = 4;
const PROTECTED_FIRST_BEAUFORT = 5;
const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;
const MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE = 5;

const exposurePriority = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel'>): number => {
  if (isWindProtectedRecommendation(item)) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

const bestShelteredRecommendationGroup = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  if (beaufort < PROTECTED_FIRST_BEAUFORT) return items;

  const protectedItems = items.filter(item => exposurePriority(item) === 0);
  if (protectedItems.length > 0) return protectedItems;

  const partiallyProtectedItems = items.filter(item => exposurePriority(item) === 1);
  if (partiallyProtectedItems.length > 0) return partiallyProtectedItems;

  return [];
};

const prioritizeProtectedRecommendations = (items: SuitableBeach[], beaufort: number): SuitableBeach[] => {
  const candidates = bestShelteredRecommendationGroup(items, beaufort);
  return [...candidates].sort((a, b) => {
    const exposureDiff = exposurePriority(a) - exposurePriority(b);
    const scoreDiff = b.score - a.score;
    const mainstreamDiff = mainstreamRecommendationScore(b.beach) - mainstreamRecommendationScore(a.beach);

    if (beaufort >= PROTECTED_FIRST_BEAUFORT) {
      if (exposureDiff !== 0) return exposureDiff;
      if (Math.abs(scoreDiff) > 14) return scoreDiff;
      return mainstreamDiff || scoreDiff;
    }
    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && exposureDiff !== 0 && Math.abs(scoreDiff) <= 12) {
      return exposureDiff;
    }
    if (beaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && Math.abs(scoreDiff) <= 12) {
      return mainstreamDiff || scoreDiff || exposureDiff;
    }
    return scoreDiff || exposureDiff;
  });
};

const prioritizeDynamicTopPickWindows = (
  items: SuitableBeach[],
  selectedDate: Date | undefined,
  now: Date
): SuitableBeach[] => (
  items
    .map((item, index) => ({
      item,
      index,
      timing: getTopPickTiming(item.bestBeachTime, selectedDate, now),
    }))
    .sort((a, b) => {
      const timingDiff = topPickTimingPriority(a.timing) - topPickTimingPriority(b.timing);
      if (timingDiff !== 0) return timingDiff;

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

  return !hasBadRoadAccess(item.beach) &&
    item.score >= 60 &&
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

  return !hasBadRoadAccess(item.beach) &&
    item.exposureLevel !== 'exposed' &&
    seaScore >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE &&
    !hasHardExclusion;
};

const getDefaultBeachListSort = (): SortOption => 'all';

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
  const greek: Record<WindDirection, string> = {
    [WindDirection.N]: 'οι νότιες και νοτιοανατολικές παραλίες',
    [WindDirection.NE]: 'οι νότιες και δυτικές παραλίες',
    [WindDirection.E]: 'οι δυτικές παραλίες',
    [WindDirection.SE]: 'οι βόρειες και δυτικές παραλίες',
    [WindDirection.S]: 'οι βόρειες παραλίες',
    [WindDirection.SW]: 'οι βόρειες και ανατολικές παραλίες',
    [WindDirection.W]: 'οι ανατολικές παραλίες',
    [WindDirection.NW]: 'οι νότιες και ανατολικές παραλίες',
  };
  const english: Record<WindDirection, string> = {
    [WindDirection.N]: 'south and southeast beaches',
    [WindDirection.NE]: 'south and west beaches',
    [WindDirection.E]: 'west-facing beaches',
    [WindDirection.SE]: 'north and west beaches',
    [WindDirection.S]: 'north-facing beaches',
    [WindDirection.SW]: 'north and east beaches',
    [WindDirection.W]: 'east-facing beaches',
    [WindDirection.NW]: 'south and east beaches',
  };

  return language === 'gr' ? greek[windDirection] : english[windDirection];
};

const getGeneralConditionsHelper = (
  mode: RecommendationDisplayMode,
  beaufort: number,
  windLabel: string,
  favoredCoasts: string,
  language: LanguageCode,
  waveHeightM?: number,
  selectedDate?: Date
): string => {
  const sentenceDay = getSelectedDaySentencePrefix(selectedDate, new Date(), language);
  const waveText = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 0.8
    ? (language === 'gr'
      ? ` Το κύμα στην πρόγνωση είναι περίπου ${waveHeightM.toFixed(1)} μ., οπότε η θάλασσα μπορεί να μην είναι τελείως ήπια.`
      : ` Forecast waves are around ${waveHeightM.toFixed(1)} m, so the sea may not feel fully easy.`)
    : '';

  if (language === 'gr') {
    if (mode === 'mild') {
      return `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`;
    }

    if (mode === 'caution') {
      return `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Ο άνεμος αρχίζει να παίζει ρόλο, οπότε ευνοούνται περισσότερο ${favoredCoasts}.`;
    }

    if (mode === 'no_ideal_swimming') {
      return beaufort <= 5
        ? `${sentenceDay} έχει 5 μποφόρ με ${windLabel} άνεμο. Ο άνεμος επηρεάζει αρκετά την επιλογή παραλίας, οπότε ευνοούνται περισσότερο ${favoredCoasts}.`
        : `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Δεν φαίνεται να υπάρχει καθαρή επιλογή για ήρεμο μπάνιο. Αν πας, ευνοούνται περισσότερο ${favoredCoasts} και πρέπει να αποφεύγονται οι ανοιχτές παραλίες στον άνεμο.${waveText}`;
    }

    return beaufort === 5
      ? `${sentenceDay} έχει 5 μποφόρ με ${windLabel} άνεμο. Σε αυτές τις συνθήκες ευνοούνται περισσότερο ${favoredCoasts}.`
      : `${sentenceDay} έχει ${beaufort} μποφόρ με ${windLabel} άνεμο. Σε αυτές τις συνθήκες ευνοούνται περισσότερο ${favoredCoasts}, ενώ οι ανοιχτές παραλίες στον άνεμο θέλουν περισσότερη προσοχή.${waveText}`;
  }

  if (mode === 'mild') {
    return `${sentenceDay} has ${beaufort} Beaufort ${windLabel.toLowerCase()} wind. The weather is mild, so most beaches look suitable for swimming.`;
  }

  if (mode === 'caution') {
    return `${sentenceDay} has ${beaufort} Beaufort ${windLabel.toLowerCase()} wind. Wind starts to matter, so ${favoredCoasts} are generally favored.`;
  }

  if (mode === 'no_ideal_swimming') {
    return beaufort <= 5
      ? `${sentenceDay} has 5 Beaufort ${windLabel.toLowerCase()} wind. Wind affects the beach choice, so ${favoredCoasts} are generally favored. Beaches open to the wind will have more difficult conditions.${waveText}`
      : `${sentenceDay} has ${beaufort} Beaufort ${windLabel.toLowerCase()} wind. There is no clearly good option for calm swimming. If you go, ${favoredCoasts} are generally favored and beaches open to the wind should be avoided.${waveText}`;
  }

  return beaufort === 5
    ? `${sentenceDay} has 5 Beaufort ${windLabel.toLowerCase()} wind. In these conditions, ${favoredCoasts} are generally favored, while beaches open to the wind are more exposed.${waveText}`
    : `${sentenceDay} has ${beaufort} Beaufort ${windLabel.toLowerCase()} wind. In these conditions, ${favoredCoasts} are generally favored, while beaches open to the wind need more caution.${waveText}`;
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

  if (language === 'gr') {
    return {
      title: summary.allBeachHoursRainy
        ? 'Δεν προτείνεται μπάνιο στις βασικές ώρες λόγω βροχής'
        : `Προσοχή στη βροχή ${day}`,
      body: summary.allBeachHoursRainy
        ? `Η πρόγνωση δείχνει βροχή στις βασικές ώρες παραλίας, οπότε ${sentenceDay.toLowerCase()} δεν θα εμφανίζονται παραλίες ως κατάλληλες για μπάνιο σε αυτό το διάστημα.`
        : hasSpecificTimes
          ? `Πρόσεξε όμως ότι η πρόγνωση δείχνει πιθανή βροχή γύρω στις ${summary.label}. Εκείνες τις ώρες καμία παραλία δεν είναι κατάλληλη.`
          : 'Πρόσεξε όμως ότι υπάρχει ένδειξη βροχής στην πρόγνωση. Οι παραλίες μπορεί να είναι οκ από άνεμο/κύμα, αλλά η σύσταση ισχύει μόνο για στεγνά διαστήματα.',
    };
  }

  return {
    title: summary.allBeachHoursRainy
      ? 'Swimming is not recommended during the main beach hours because of rain'
      : `Rain may affect the beach plan ${day}`,
    body: summary.allBeachHoursRainy
      ? 'The forecast shows rain during the main beach hours, so beaches are not shown as suitable for swimming in that window.'
      : hasSpecificTimes
        ? `Note that the forecast shows possible rain around ${summary.label}. Do not treat the beach as suitable for swimming during those hours.`
        : 'Note that the day has a rain signal in the forecast. Beaches may be fine for wind and waves, but the recommendation only applies to drier windows.',
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
  const [theme, setTheme] = useState<Theme>('light');
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
      en: 'Less exposed',
      gr: 'Λιγότερο εκτεθειμένες',
      de: 'Weniger exponiert',
      it: 'Meno esposte',
      fr: 'Moins exposees',
    },
    beaches: { en: 'beaches', gr: 'παραλίες', de: 'Strande', it: 'spiagge', fr: 'plages' },
    wind: { en: 'wind', gr: 'άνεμος', de: 'Wind', it: 'vento', fr: 'vent' },
    selectLocation: { en: 'Select location', gr: 'Επίλεξε τοποθεσία', de: 'Ort auswahlen', it: 'Scegli localita', fr: 'Choisir la destination' },
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
    viewOnMap: { en: 'View on map', gr: 'Δες στον χάρτη', de: 'Auf Karte anzeigen', it: 'Vedi sulla mappa', fr: 'Voir sur la carte' },
    mapTitle: { en: 'Interactive Map', gr: 'Διαδραστικός Χάρτης', de: 'Interaktive Karte', it: 'Mappa interattiva', fr: 'Carte interactive' },
    mapSubtitle: { en: 'Explore beaches on the map', gr: 'Εξερεύνησε τις παραλίες στον χάρτη', de: 'Strande auf der Karte entdecken', it: 'Esplora le spiagge sulla mappa', fr: 'Explorer les plages sur la carte' },
    allBeaches: { en: 'All beaches', gr: 'Όλες οι παραλίες', de: 'Alle Straende', it: 'Tutte le spiagge', fr: 'Toutes les plages' },
    exploreTools: { en: 'Explore all suitable beaches', gr: 'Όλες οι κατάλληλες παραλίες', de: 'Alle passenden Straende ansehen', it: 'Esplora tutte le spiagge adatte', fr: 'Explorer toutes les plages adaptees' },
    moreSuitableOptions: { en: 'More suitable options', gr: 'Περισσότερες κατάλληλες επιλογές', de: 'Weitere passende Optionen', it: 'Altre opzioni adatte', fr: 'Plus d options adaptees' },
    lessExposedOptions: { en: 'Less exposed options', gr: 'Λιγότερο εκτεθειμένες επιλογές', de: 'Weniger exponierte Optionen', it: 'Opzioni meno esposte', fr: 'Options moins exposees' },
    mapLoadPrompt: { en: 'Load map', gr: 'Φόρτωση χάρτη', de: 'Karte laden', it: 'Carica mappa', fr: 'Charger la carte' },
    mapError: { en: 'The map could not load right now. The beach list is still available.', gr: 'Ο χάρτης δεν φορτώθηκε τώρα. Η λίστα παραλιών παραμένει διαθέσιμη.', de: 'Die Karte konnte gerade nicht geladen werden.', it: 'La mappa non si e caricata.', fr: 'La carte n a pas pu se charger.' },
    weatherRetry: { en: 'Retry', gr: 'Ανανέωση', de: 'Erneut versuchen', it: 'Riprova', fr: 'Réessayer' },
    betaFeedbackTitle: { en: 'Send feedback', gr: 'Πες μας τη γνώμη σου', de: 'Feedback senden', it: 'Invia feedback', fr: 'Envoyer un avis' },
    betaFeedbackBody: { en: 'Help us improve the recommendations.', gr: 'Βοήθησέ μας να βελτιώσουμε τις προτάσεις.', de: 'Hilf uns, die Empfehlungen zu verbessern.', it: 'Aiutaci a migliorare i consigli.', fr: 'Aidez-nous a ameliorer les recommandations.' },
    betaFeedbackCta: { en: 'Open feedback form', gr: 'Άνοιγμα φόρμας', de: 'Formular offnen', it: 'Apri modulo', fr: 'Ouvrir le formulaire' },
    tripPlanner: { en: 'Trip planner', gr: 'Σχεδιασμός ταξιδιού', de: 'Reiseplaner', it: 'Pianificatore viaggio', fr: 'Planificateur de voyage' },
    aiAssistant: { en: 'AI Assistant', gr: 'AI Βοηθός', de: 'KI-Assistent', it: 'Assistente AI', fr: 'Assistant IA' },
  };
  const plannerProCopy = {
    title: {
      en: 'Holiday Planner is a Pro feature',
      gr: 'Το Planner είναι λειτουργία Pro',
      de: 'Der Urlaubsplaner ist eine Pro-Funktion',
      it: 'Il Planner vacanze e una funzione Pro',
      fr: 'Le planificateur de vacances est une fonction Pro',
    },
    description: {
      en: 'Pro creates a weather-aware holiday plan for each destination, matching beach days, calmer hours and backup ideas to the forecast.',
      gr: 'Στο Pro θα φτιάχνει πρόγραμμα διακοπών για κάθε μέρος, με βάση τον καιρό, τη θάλασσα, τις καλύτερες ώρες για παραλία και εναλλακτικές επιλογές.',
      de: 'Pro erstellt einen wetterbasierten Urlaubsplan je Reiseziel, mit Strandtagen, ruhigen Zeitfenstern und Alternativen passend zur Vorhersage.',
      it: 'Pro crea un programma vacanze per ogni destinazione in base a meteo, mare, orari migliori per la spiaggia e alternative.',
      fr: 'Pro cree un programme de vacances par destination selon la meteo, la mer, les meilleurs moments de plage et des alternatives.',
    },
    cta: {
      en: 'Available on Pro',
      gr: 'Διαθέσιμο στο Pro',
      de: 'In Pro verfugbar',
      it: 'Disponibile in Pro',
      fr: 'Disponible avec Pro',
    },
  };

  // --- Beach & Weather Data (Custom Hooks) ---
  const { allIslands, loading: beachesLoading, error: beachesError, getFilteredBeaches, ensureIslandBeachesLoaded } = useBeaches(language);
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
    selectIsland(island);
  };

  // --- Functional State ---
  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('all');
  const hasUserSelectedSortRef = useRef(false);
  const [topPickClock, setTopPickClock] = useState(() => Date.now());
  const [beachSearchQuery, setBeachSearchQuery] = useState('');
  const [detailBeach, setDetailBeach] = useState<Beach | null>(null);
  const [detailDataStatus, setDetailDataStatus] = useState<DetailDataStatus>('idle');
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [mobileTab, setMobileTab] = useState<'home' | 'map' | 'favorites' | 'chat' | 'planner'>('home');
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false
  ));
  const [desktopMapVisibleBeachIds, setDesktopMapVisibleBeachIds] = useState<number[] | null>(null);
  const [shouldLoadInsights, setShouldLoadInsights] = useState(false);

  // --- Modals State ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isIslandSelectorOpen, setIsIslandSelectorOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // --- Chat & AI State ---
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const chatSessionRef = useRef<Chat | null>(null);
  const detailRequestRef = useRef(0);
  const mapSectionRef = useRef<HTMLElement | null>(null);
  const insightsSectionRef = useRef<HTMLDivElement | null>(null);
  const trackedRecommendationsRef = useRef<string | null>(null);
  const trackedSearchRef = useRef<string | null>(null);
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTopPickClock(Date.now()), 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Helper function to find nearest island
  const findNearestIsland = (userLoc: { lat: number; lon: number }, islands: Island[]): Island | null => {
    let nearest: Island | null = null;
    let minDistance = Infinity;

    for (const island of islands) {
      const dist = calculateDistance(userLoc.lat, userLoc.lon, island.coordinates.lat, island.coordinates.lon);
      if (dist < minDistance && dist < 50) { // Within 50km radius
        minDistance = dist;
        nearest = island;
      }
    }

    return nearest || islands[0]; // Fallback to first island
  };

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

  // --- Nearest Island Handler ---
  const [isFindingNearest, setIsFindingNearest] = useState(false);
  const [findNearestError, setFindNearestError] = useState<string | null>(null);

  const handleSelectNearest = async () => {
    setIsFindingNearest(true);
    setFindNearestError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const userLoc = { lat: position.coords.latitude, lon: position.coords.longitude };
      setUserLocation(userLoc);
      const nearest = findNearestIsland(userLoc, allIslands);
      if (nearest) {
        handleRegionSelected(nearest, 'nearest_location');
        setIsIslandSelectorOpen(false);
      } else {
        setFindNearestError(language === 'gr' ? 'Δεν βρέθηκε κοντινό νησί.' : 'No nearby island found.');
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

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  useEffect(() => {
    saveLanguagePreference(language);
    document.documentElement.lang = languageToLocale(language);
    const meta = seoCopy[language];
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', meta.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', meta.description);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', meta.locale);
  }, [language]);

  useEffect(() => {
    const hO = () => setIsOffline(false);
    const hF = () => setIsOffline(true);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hF);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hF); };
  }, []);

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
    setBeachSearchQuery('');
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
    setSortBy('all');

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
    setSortBy(nextSortBy === 'recommended' ? 'all' : nextSortBy);
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

    setSortBy('all');
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

  const openBeachDetails = (beach: Beach, source: string) => {
    trackEvent('beach_card_clicked', beach.id, {
      ...analyticsBaseParams,
      source,
      beach_name: beach.name.en,
    });
    setDetailBeach(beach);
    setDetailDataStatus('loading');
    setView('detail');

    const regionId = selectedIsland?.id;
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

  const closeBeachDetails = () => {
    detailRequestRef.current += 1;
    setView('home');
    setDetailDataStatus('idle');
  };

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

  const handleMobileTab = (tab: 'home' | 'map' | 'favorites' | 'chat' | 'planner') => {
    if (tab === 'chat' && !ENABLE_BEACH_BUDDY_CHAT) return;
    if (tab === 'planner' && !ENABLE_PLANNER_PRO) return;

    setMobileTab(tab);
    if (tab === 'chat') { setIsChatOpen(true); return; }
    if (tab === 'planner') { setIsPlannerOpen(true); return; }
    if (tab === 'home') {
      setIsChatOpen(false);
      setIsPlannerOpen(false);
      setIsFilterModalOpen(false);
      setIsIslandSelectorOpen(false);
      if (view === 'detail') setView('home');
      requestAnimationFrame(() => {
        scrollToPageTop();
      });
      return;
    }
    // Map and favorites tabs scroll to their relevant sections.
    if (tab === 'map') {
      setShouldLoadMap(true);
      trackEvent('map_viewed', undefined, {
        ...analyticsBaseParams,
        source: 'bottom_nav',
      });
      if (view === 'detail') setView('home');
      requestAnimationFrame(() => {
        scrollElementIntoView(document.getElementById('map-section'));
      });
    }
    if (tab === 'favorites') {
      if (view === 'detail') setView('home');
      requestAnimationFrame(() => {
        scrollElementIntoView(document.getElementById('all-beaches-section'));
      });
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
      setChatMessages(prev => prev.map(m => m.id === loadingId ? { ...m, text: 'Παρουσιάστηκε σφάλμα στη σύνδεση.' } : m));
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

  const selectedForecast = forecast?.[selectedDayIndex];
  const topPickNow = useMemo(() => new Date(topPickClock), [topPickClock]);
  const defaultBeachListSort = useMemo(() => (
    getDefaultBeachListSort()
  ), []);

  useEffect(() => {
    if (hasUserSelectedSortRef.current || sortBy === defaultBeachListSort) return;
    setSortBy(defaultBeachListSort);
  }, [defaultBeachListSort, sortBy]);

  const filteredBeaches = useMemo(() => {
    if (!selectedIsland) return [];

    const hasBeachSearchQuery = beachSearchQuery.trim().length > 0;
    let beaches = filterBeachesByUserPreferences(selectedIsland.beaches, preferences);
    const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : WindDirection.N;
    const selectedBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
    const effectiveSortBy = (hasBeachSearchQuery && sortBy === 'recommended') || (selectedBeaufort < 4 && sortBy === 'recommended') ? 'all' : sortBy;

    if (!hasBeachSearchQuery && selectedForecast && effectiveSortBy === 'recommended') {
      const waveHeightM = selectedForecast.marine?.waveHeightM;
      const weatherSuitableBeaches = beaches.filter(beach => {
        const beachForecast = selectedBeachForecasts[beach.id] || selectedForecast;
        const beachWindSpeedKmph = beachForecast.wind.speed * 3.6;
        const beachWaveHeightM = beachForecast.marine?.waveHeightM ?? waveHeightM;
        const scoreResult = calculateBeachScore(beach, beachForecast, userLocation, preferences);
        const isExposed = scoreResult.exposureLevel ? scoreResult.exposureLevel !== 'protected' : true;
        return !hasPoorSeaConditions(isExposed, beachWindSpeedKmph, scoreResult.exposureLevel, beachWaveHeightM);
      });
      beaches = weatherSuitableBeaches.length > 0 ? weatherSuitableBeaches : beaches;
    }

    const result = getFilteredBeaches(beaches, selectedFilters, beachSearchQuery, effectiveSortBy, windDirection, selectedForecast, userLocation, preferences);
    return result;
  }, [selectedIsland, selectedForecast, selectedFilters, beachSearchQuery, sortBy, getFilteredBeaches, preferences, selectedBeachForecasts, userLocation]);

  const suitableBeaches = useMemo(() => {
    if (!selectedIsland || !forecast || !forecast[selectedDayIndex]) return [];
    return getSuitableBeaches(selectedIsland.beaches, forecast[selectedDayIndex], language, userLocation, forecast[selectedDayIndex].hourly, preferences, selectedBeachForecasts);
  }, [selectedIsland, forecast, selectedDayIndex, language, userLocation, preferences, selectedBeachForecasts]);

  const mapSuitableBeaches = useMemo<SuitableBeach[]>(() => {
    if (!selectedIsland) return [];

    return selectedIsland.beaches.map(beach => {
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
        };
      }

      const beachForecast = selectedBeachForecasts[beach.id] || selectedForecast;
      const scoreResult = calculateBeachScore(beach, beachForecast, userLocation, preferences);

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
        windSector: scoreResult.windSector,
        waveHeightM: scoreResult.waveHeightM,
        warnings: scoreResult.warnings,
        confidence: scoreResult.confidence,
        swimmingComfort: scoreResult.swimmingComfort,
        canClaimWindProtection: scoreResult.canClaimWindProtection,
        seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed,
      };
    });
  }, [language, preferences, selectedBeachForecasts, selectedForecast, selectedIsland, userLocation]);

  const dailySuitableBeaches = useMemo(() => {
    if (!selectedIsland || !forecast || !forecast[selectedDayIndex]) return [];
    return getSuitableBeaches(selectedIsland.beaches, forecast[selectedDayIndex], language, undefined, forecast[selectedDayIndex].hourly, undefined, selectedBeachForecasts);
  }, [selectedIsland, forecast, selectedDayIndex, language, selectedBeachForecasts]);

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
  const isProtectedSortOnly = useMemo(() => {
    return sortBy === 'protected' &&
      beachSearchQuery.trim().length === 0 &&
      selectedFilters.every(filter => filter === 'showAll') &&
      !hasActivePreferenceFilters;
  }, [beachSearchQuery, hasActivePreferenceFilters, selectedFilters, sortBy]);

  const recommendedSuitableBeaches = useMemo(() => {
    if (!forecast || !forecast[selectedDayIndex]) return [];
    const recommendationSource = hasActivePreferenceFilters ? suitableBeaches : dailySuitableBeaches;
    const windSpeedKmph = forecast[selectedDayIndex].wind.speed * 3.6;
    const beaufort = getBeaufortLevel(windSpeedKmph);
    const waveHeightM = forecast[selectedDayIndex].marine?.waveHeightM;
    const candidates = recommendationSource.filter(item => {
      const itemWaveHeightM = item.waveHeightM ?? waveHeightM;
      const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
      const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;

      return !hasBadRoadAccess(item.beach) &&
        seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
        hasGoodHourlySea &&
        !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
    });
    const protectedPriority = prioritizeProtectedRecommendations(candidates, beaufort);
    return prioritizeDynamicTopPickWindows(protectedPriority, forecast[selectedDayIndex].date, topPickNow);
  }, [forecast, selectedDayIndex, dailySuitableBeaches, hasActivePreferenceFilters, suitableBeaches, topPickNow]);
  const hasRecommendedBeaches = recommendedSuitableBeaches.length > 0;
  const currentBeaufort = forecast?.[selectedDayIndex] ? getBeaufortLevel(forecast[selectedDayIndex].wind.speed * 3.6) : 0;
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
  const isLightWindDay = Boolean(forecast?.[selectedDayIndex] && currentBeaufort < 4);
  const isWaitingForForecast = Boolean(selectedIsland && !selectedForecast && !weatherError && !isUnsafeWinter);

  useEffect(() => {
    if (trackedAppLoadedRef.current || !selectedIsland) return;
    trackedAppLoadedRef.current = true;
    trackEvent('app_loaded', undefined, analyticsBaseParams);
  }, [analyticsBaseParams, selectedIsland]);

  useEffect(() => {
    if (!selectedIsland) return;
    const pagePath = view === 'detail' ? '/beach-detail' : '/';
    const trackingKey = `${pagePath}:${selectedIsland.id}:${detailBeach?.id || 'home'}`;
    if (trackedPageViewRef.current === trackingKey) return;

    trackedPageViewRef.current = trackingKey;
    trackPageView(view === 'detail' ? '/beach-detail' : '/', {
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
    if (currentBeaufort >= 4 || hasSevereBlockingWeather) return null;

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
    const hasBroadlySuitableLightWindDay = currentBeaufort <= 3;
    const comfortableRatio = comfortableBeaches.length / totalBeachCount;
    const suitableBeachCount = hasBroadlySuitableLightWindDay ? totalBeachCount : dailySuitableBeaches.length;
    const suitableRatio = suitableBeachCount / totalBeachCount;

    return {
      totalBeachCount,
      suitableBeachCount,
      comfortableBeachCount: currentBeaufort <= 2 ? totalBeachCount : comfortableBeaches.length,
      isEveryBeachSuitable: hasBroadlySuitableLightWindDay || (hasGreatSwimmingWeather && suitableRatio >= 0.95),
      isMostBeachesSuitable: hasGreatSwimmingWeather && suitableRatio >= 0.65,
      isEveryBeachComfortable: currentBeaufort <= 2 || (hasGreatSwimmingWeather && comfortableRatio >= 0.95),
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
  const showDecisionRecommendations = Boolean(forecast?.[selectedDayIndex] && !isLightWindDay && !calmAllAroundSummary);

  useEffect(() => {
    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedIsland || !selectedForecast || recommendedSuitableBeaches.length === 0) return;
    recordForecastSnapshots(selectedIsland.id, selectedForecast.date, recommendedSuitableBeaches, selectedForecast);
  }, [forecast, selectedDayIndex, selectedIsland, recommendedSuitableBeaches]);

  useEffect(() => {
    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedIsland || !selectedForecast || isUnsafeWinter || !showDecisionRecommendations || recommendedSuitableBeaches.length === 0) return;

    const topBeachIds = recommendedSuitableBeaches.slice(0, 3).map(item => item.beach.id).join(',');
    const trackingKey = `${selectedIsland.id}:${selectedForecast.date}:${topBeachIds}`;
    if (trackedRecommendationsRef.current === trackingKey) return;

    trackedRecommendationsRef.current = trackingKey;
    trackEvent('recommendations_viewed', undefined, {
      ...analyticsBaseParams,
      day_index: selectedDayIndex,
      recommendation_count: recommendedSuitableBeaches.length,
      top_beach_id: String(recommendedSuitableBeaches[0].beach.id),
    });
  }, [analyticsBaseParams, forecast, isUnsafeWinter, recommendedSuitableBeaches, selectedDayIndex, selectedIsland, showDecisionRecommendations]);

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

  const hasShownAlternativeRecommendations = Boolean(forecast?.[selectedDayIndex] && !isUnsafeWinter && showDecisionRecommendations && recommendedSuitableBeaches.length > 1);
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
      if (!rankedById.has(item.beach.id) && isStrongWindSuitableCandidate(item, windSpeedKmph, waveHeightM)) {
        rankedById.set(item.beach.id, item);
      }
    });

    const candidates = Array.from(rankedById.values());
    return prioritizeProtectedRecommendations(candidates, currentBeaufort);
  }, [currentBeaufort, dailySuitableBeaches, isStrongRecommendationMode, mapSuitableBeaches, recommendedSuitableBeaches, selectedForecast]);
  const noIdealFallbackCandidates = useMemo(() => {
    if (!hasNoSwimmableBeachesToday || !isStrongRecommendationMode || !selectedForecast) return [];

    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    const rankedFallback = [...mapSuitableBeaches]
      .filter(item => isNoIdealFallbackCandidate(item, windSpeedKmph, waveHeightM))
      .sort((a, b) => {
        const exposureDiff = exposurePriority(a) - exposurePriority(b);
        return exposureDiff || b.score - a.score;
      });

    return prioritizeProtectedRecommendations(rankedFallback, currentBeaufort);
  }, [currentBeaufort, hasNoSwimmableBeachesToday, isStrongRecommendationMode, mapSuitableBeaches, selectedForecast]);
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
      if (!rankedById.has(item.beach.id) && !hasBadRoadAccess(item.beach)) {
        rankedById.set(item.beach.id, item);
      }
    });

    return prioritizeProtectedRecommendations(Array.from(rankedById.values()), currentBeaufort);
  }, [currentBeaufort, dailySuitableBeaches, isStrongRecommendationMode, mapSuitableBeaches, recommendedSuitableBeaches, selectedForecast, strongSuitableCandidates]);
  const strongManageableBeaches = useMemo(() => (
    windPreviewCandidates.slice(0, 3)
  ), [windPreviewCandidates]);
  const noIdealFallbackBeaches = useMemo(() => (
    noIdealFallbackCandidates.slice(0, 3)
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
    const highlightedLimit = showStrongManageableSection ? 0 : 4;
    return new Set(recommendedSuitableBeaches.slice(0, highlightedLimit).map(item => item.beach.id));
  }, [forecast, selectedDayIndex, isUnsafeWinter, recommendedSuitableBeaches, showDecisionRecommendations, showStrongManageableSection]);
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

  if (beachesLoading) return <SkeletonLoader t={t} />;
  if (beachesError) return <ErrorDisplay message={beachesError} onRetry={() => window.location.reload()} t={t} />;

  if (view === 'detail' && detailBeach && forecast?.[selectedDayIndex]) {
    const detailForecast = selectedBeachForecasts[detailBeach.id] || forecast[selectedDayIndex];

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
        />
      </Suspense>
    );
  }

  const selectedIslandKey = selectedIsland?.name.en?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const islandBackground = ISLAND_BACKGROUND_IMAGES[selectedIslandKey];
  const islandBackgroundCss = getBackgroundImageCss(islandBackground);
  const showHeaderForecast = Boolean(forecast?.[selectedDayIndex] && !isUnsafeWinter);
  const headerTopCandidate = !hasActiveSearchOrFilters && showDecisionRecommendations && recommendedSuitableBeaches.length > 0
    ? recommendedSuitableBeaches[0]
    : null;
  const recommendationDisplayMode = listRecommendationDisplayMode;
  const recommendationModeCopy = homeCopy.recommendationMode[recommendationDisplayMode];
  const protectedSortLabel = homeCopy.lessExposedSortLabel[language];
  const protectedSortDay = getSelectedDayPrefix(selectedForecast?.date, new Date(), language);
  const protectedSortEmptyCopy = isNoIdealFallbackSortOnly
    ? {
      title: language === 'gr'
        ? 'Δεν βρέθηκαν λιγότερο εκτεθειμένες επιλογές.'
        : 'No less exposed options were found.',
      body: language === 'gr'
        ? `Με τα διαθέσιμα δεδομένα δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο ${protectedSortDay}. Γύρισε στις Όλες για να δεις όλες τις παραλίες με τις προειδοποιήσεις τους.`
        : `With the available data, there is no clearly good option for calm swimming ${protectedSortDay}. Return to All to see every beach with its warnings.`,
    }
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
    : recommendedSuitableBeaches.slice(1, 4);
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
      selectedForecast.date
    )
    : recommendationModeCopy.helper[language];
  const selectedDayDate = selectedForecast?.date;
  const recommendationModeTitle = (() => {
    const day = getSelectedDayPrefix(selectedDayDate, new Date(), language);
    if (language === 'gr') {
      if (recommendationDisplayMode === 'caution') return `Ιδανικότερες παραλίες ${day}`;
      if (recommendationDisplayMode === 'strong') return `Καταλληλότερες επιλογές ${day}`;
      if (recommendationDisplayMode === 'no_ideal_swimming') {
        return currentBeaufort <= 5
          ? `Πιο υπήνεμες επιλογές ${day}`
          : `Δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο ${day}`;
      }
      return recommendationModeCopy.title[language];
    }

    if (recommendationDisplayMode === 'caution') return `More comfortable options ${day}`;
    if (recommendationDisplayMode === 'strong') return `Most suitable options ${day}`;
    if (recommendationDisplayMode === 'no_ideal_swimming') {
      return currentBeaufort <= 5
        ? `More sheltered options ${day}`
        : `No clear calm-swimming option ${day}`;
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
    ? language === 'gr'
      ? `Αργότερα ο άνεμος ανεβαίνει έως ${hourlyWindIncreaseSummary.maxBeaufort} μποφόρ γύρω στις ${hourlyWindIncreaseSummary.label}, οπότε κάποιες παραλίες θα είναι πιο άνετες από άλλες.`
      : `Later the wind rises to ${hourlyWindIncreaseSummary.maxBeaufort} Beaufort around ${hourlyWindIncreaseSummary.label}, so some beaches will feel more comfortable than others.`
    : '';
  const calmSummaryBaseDescription = calmAllAroundSummary
    ? calmAllAroundSummary.hasNormalLightWindBeachDay
      ? language === 'gr'
        ? `${calmAllAroundSummary.beaufort} μποφόρ ${selectedDayPrefix}. Όλες οι παραλίες είναι κατάλληλες για μπάνιο.`
        : `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. All beaches are suitable for swimming.`
      : language === 'gr'
        ? `${selectedDaySentencePrefix} ο καιρός είναι ήπιος, οπότε ${calmAllAroundSummary.isEveryBeachSuitable ? 'όλες οι παραλίες' : 'οι περισσότερες παραλίες'} φαίνονται κατάλληλες για μπάνιο.`
        : `${selectedDaySentencePrefix} the weather is mild, so ${calmAllAroundSummary.isEveryBeachSuitable ? 'all beaches' : 'most beaches'} look suitable for swimming.`
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
  const headerTopDescriptionBase = headerTopBeachName
    ? language === 'gr'
      ? headerTopIsAvoidDay
        ? `Δεν υπάρχει ιδανική επιλογή για ήρεμο μπάνιο ${selectedDayPrefix}. Η παραλία ${headerTopBeachName} είναι καλύτερη μόνο ως επιλογή επίσκεψης, αν οι συνθήκες φαίνονται αποδεκτές όταν φτάσεις.`
        : recommendationDisplayMode === 'strong'
        ? currentBeaufort === 5
          ? `Η παραλία ${headerTopBeachName} είναι καλύτερη επιλογή για τον άνεμο ${selectedDayPrefix}.`
          : `Η παραλία ${headerTopBeachName} είναι η καλύτερη διαθέσιμη επιλογή ${selectedDayPrefix}, αλλά οι συνθήκες θέλουν προσοχή.`
        : recommendationDisplayMode === 'caution'
        ? `${selectedDaySentencePrefix} ο άνεμος αρχίζει να παίζει ρόλο. Η παραλία ${headerTopBeachName} φαίνεται πιο άνετη από πιο εκτεθειμένες επιλογές.`
        : headerTopTimingLabel
        ? `Με βάση την ωριαία πρόγνωση, η παραλία ${headerTopBeachName} είναι η κορυφαία επιλογή για αυτό το χρονικό παράθυρο.`
        : `${selectedDaySentencePrefix} ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`
      : headerTopIsAvoidDay
        ? `No beach looks ideal for calm swimming ${selectedDayPrefix}. ${headerTopBeachName} is better as a visit option only if conditions look acceptable when you arrive.`
        : recommendationDisplayMode === 'strong'
        ? currentBeaufort === 5
          ? `${headerTopBeachName} is a better wind option ${selectedDayPrefix}.`
          : `${headerTopBeachName} is the best available option ${selectedDayPrefix}, but it is still a caution day for swimming.`
        : recommendationDisplayMode === 'caution'
        ? `Wind starts to matter ${selectedDayPrefix}. ${headerTopBeachName} looks more comfortable than more exposed options.`
        : headerTopTimingLabel
        ? `Based on the hourly forecast, ${headerTopBeachName} is the top pick for this time window.`
        : `${selectedDaySentencePrefix} the weather is mild, so most beaches look suitable for swimming.`
    : '';
  const headerTopDescription = withRainRiskContext(headerTopDescriptionBase, rainRiskSummary, rainRiskCopy);
  const directoryTopBeach = headerTopBeach
    || recommendedSuitableBeaches[0]
    || [...mapSuitableBeaches].sort((a, b) => b.score - a.score)[0]
    || null;
  const directorySuitableBeachCards = (() => {
    const source = recommendedSuitableBeaches.length > 0
      ? recommendedSuitableBeaches
      : [...mapSuitableBeaches].sort((a, b) => b.score - a.score);
    const topBeachId = directoryTopBeach?.beach.id;
    const withoutTop = source.filter(item => item.beach.id !== topBeachId);
    const cards = withoutTop.length >= 4 ? withoutTop : source;
    return cards.slice(0, 8);
  })();
  const directoryTopBeachName = directoryTopBeach
    ? displayBeachName(directoryTopBeach.beach.name, language)
    : '';
  const directoryTopTimingLabel = directoryTopBeach
    ? getTopPickTimingLabel(directoryTopBeach.bestBeachTime, selectedDayDate, language, topPickNow)
    : undefined;
  const directoryTopDescription = directoryTopBeach
    ? directoryTopBeach.beach.id === headerTopBeach?.beach.id && headerTopDescription
      ? headerTopDescription
      : language === 'gr'
        ? `Η παραλία ${directoryTopBeachName} έχει το καλύτερο σημερινό σκορ με βάση άνεμο, θάλασσα και χαρακτηριστικά παραλίας.`
        : `${directoryTopBeachName} has the best current score based on wind, sea conditions and beach features.`
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

  const handleDirectorySearchSubmit = () => {
    trackEvent('search_used', undefined, {
      ...analyticsBaseParams,
      source: 'directory_home',
      search_length: beachSearchQuery.trim().length,
    });
    requestAnimationFrame(() => {
      scrollElementIntoView(document.getElementById('all-beaches-section'));
    });
  };

  const handleDirectoryMapOpen = () => {
    setShouldLoadMap(true);
    trackEvent('map_viewed', undefined, {
      ...analyticsBaseParams,
      source: 'directory_home',
    });
    if (view === 'detail') setView('home');
    requestAnimationFrame(() => {
      scrollElementIntoView(document.getElementById(isDesktopViewport ? 'map-section-desktop' : 'map-section'));
    });
  };

  const directoryMapPreview = selectedIsland && !isUnsafeWinter ? (
    <MapLoadBoundary
      resetKey={`${selectedIsland.id}-${language}-directory`}
      fallback={
        <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white/82 px-4 text-center text-sm font-bold text-slate-600">
          <span>{homeCopy.mapError[language]}</span>
        </div>
      }
    >
      <Suspense fallback={<div className="h-full w-full animate-pulse bg-slate-100" />}>
        <BeachMap
          center={[selectedIsland.coordinates.lat, selectedIsland.coordinates.lon]}
          zoom={11}
          beaches={mapSuitableBeaches}
          userLocation={userLocation}
          onBeachClick={(b) => openBeachDetails(b, 'directory_home_map')}
          onVisibleBeachIdsChange={handleDesktopMapVisibleBeachIdsChange}
          windSpeed={forecast?.[selectedDayIndex]?.wind.speed}
          windDirection={forecast?.[selectedDayIndex] ? degToCompass(forecast[selectedDayIndex].wind.deg) : undefined}
          windDirectionDeg={forecast?.[selectedDayIndex]?.wind.deg}
          language={language}
          selectedDate={selectedDayDate}
          compact
          preview
        />
      </Suspense>
    </MapLoadBoundary>
  ) : null;

  return (
    <div className={`min-h-screen pb-28 md:pb-24 relative overflow-x-hidden transition-colors duration-500`}>
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
              preferences={preferences}
              activeFilters={selectedFilters}
              filterResultCounts={preferenceFilterResultCounts}
              advancedFilterResultCounts={desktopAdvancedFilterResultCounts}
              sortResultCounts={sortResultCounts}
              protectedSortLabel={protectedSortLabel}
              islandBackground={islandBackground}
              mapPreview={directoryMapPreview}
              suitableBeachCards={directorySuitableBeachCards}
              allBeachCards={beachListBeaches}
              beachWeatherContexts={mapSuitableBeaches}
              topBeachToday={directoryTopBeach}
              topBeachDescription={directoryTopDescription}
              topBeachTimingLabel={directoryTopTimingLabel}
              conditionSummaryText={recommendationGeneralHelper}
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
              onOpenFilters={() => setIsFilterModalOpen(true)}
              onOpenMap={handleDirectoryMapOpen}
              onOpenIslandSelector={() => setIsIslandSelectorOpen(true)}
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
                        aria-label={language === 'gr' ? `Πλοήγηση προς ${headerTopBeachName}` : `Navigate to ${headerTopBeachName}`}
                        title={t.navigate}
                      >
                        <Navigation className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
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
                        aria-label={language === 'gr' ? `Πλοήγηση προς ${headerTopBeachName}` : `Navigate to ${headerTopBeachName}`}
                        title={t.navigate}
                      >
                        <Navigation className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <h2 className="mx-auto max-w-3xl truncate font-heading text-[1.55rem] font-extrabold leading-[1.16] text-slate-950 sm:text-[1.75rem]">
                      {headerTopBeachName}
                    </h2>
                    <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-[0.95rem]">
                      {headerTopDescription}
                    </p>
                  </div>

                  <div className={`grid gap-2 text-xs font-semibold text-slate-600 ${headerTopTimingLabel ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                    {headerTopTimingLabel && (
                      <div className="flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/74 px-3 text-emerald-700 shadow-sm shadow-sky-900/5">
                        <Clock3 className="h-4 w-4 shrink-0" />
                        <span className="truncate whitespace-nowrap">{headerTopTimingLabel}</span>
                      </div>
                    )}
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
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {showWindContextSummaryPanel && (
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
                    beaches={mapSuitableBeaches}
                    userLocation={userLocation}
                    onBeachClick={(b) => openBeachDetails(b, 'map')}
                    onVisibleBeachIdsChange={handleDesktopMapVisibleBeachIdsChange}
                    windSpeed={forecast?.[selectedDayIndex]?.wind.speed}
                    windDirection={forecast?.[selectedDayIndex] ? degToCompass(forecast[selectedDayIndex].wind.deg) : undefined}
                    windDirectionDeg={forecast?.[selectedDayIndex]?.wind.deg}
                    language={language}
                    selectedDate={selectedDayDate}
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
                          onClick={() => openBeachDetails(r.beach, 'recommendation_card')}
                          todayScore={r.score}
                      variant="decision"
                      recommendationRank={showStrongManageableSection ? i + 1 : i + 2}
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
                        />
                      </motion.div>
                    ))}
                    </div>
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
                            beaches={mapSuitableBeaches}
                            userLocation={userLocation}
                            onBeachClick={(b) => openBeachDetails(b, 'map')}
                            windSpeed={forecast?.[selectedDayIndex]?.wind.speed}
                            windDirection={forecast?.[selectedDayIndex] ? degToCompass(forecast[selectedDayIndex].wind.deg) : undefined}
                            windDirectionDeg={forecast?.[selectedDayIndex]?.wind.deg}
                            language={language}
                            selectedDate={selectedDayDate}
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

              {ENABLE_USAGE_INSIGHTS && (
                <div ref={insightsSectionRef} className="min-h-1">
                  {shouldLoadInsights && (
                    <Suspense fallback={null}>
                      <UsageInsights allBeaches={selectedIsland?.beaches || []} language={language} t={t} />
                    </Suspense>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

        <LegalFooter language={language} />
      </main>

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
            onNewChat={() => setChatMessages([])} suggestions={['Ποιες παραλίες είναι απάνεμες σήμερα;', 'Πού να πάω για snorkeling;']}
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
          <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} t={t}>
            <CombinedFilter
              initialSelectedFilters={selectedFilters}
              initialSortBy={sortBy}
              onApplyFilters={(f, s) => {
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
                handleSortChange(s);
                setIsFilterModalOpen(false);
              }}
              onClose={() => setIsFilterModalOpen(false)}
              t={t}
              isGettingLocation={false}
              locationError={null}
            />
          </FilterModal>
        </Suspense>
      )}
    </div>
  );
};
