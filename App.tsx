import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Accessibility, Beach, DailyForecast, ForecastItem, Island, LanguageCode, FilterKey, SortOption, UserPreferences, SuitableBeach, Translation, WindDirection, type BeachForecastContext, type GeospatialExposureProfile, type MarineForecast } from './types';
import { beachMatchesUserPreferences, calculateBeachScore, calculateBestBeachTime, getSuitableBeaches, filterBeachesByUserPreferences, getTopRecommendationDisplayLimit, hasHourlyRainRisk, isTrustedTopRecommendationCandidate, type BeachScore, type BeachWeatherById, type BestBeachTime } from './services/recommendationService';
import type { Chat } from '@google/genai';
import { AlertTriangle, CheckCircle2, Clock3, Navigation, RefreshCw, Waves, Wind } from 'lucide-react';

// Components
import Header from './components/Header';
import SkeletonLoader from './components/SkeletonLoader';
import { InstallPrompt } from './components/InstallPrompt';
import { UnsafeConditionsMessage } from './components/UnsafeConditionsMessage';
import { PreferenceFilters } from './components/PreferenceFilters';
import { BeachFilters } from './components/BeachFilters';
import { WeatherSummary } from './components/WeatherSummary';
import { RecommendationSection } from './components/RecommendationSection';
import { BeachCard } from './components/BeachCard';
import ErrorDisplay from './components/ErrorDisplay';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { SavedBeachesScreen } from './components/SavedBeachesScreen';
import { PrivacyConsentBanner } from './components/PrivacyConsentBanner';
import { MapLoadBoundary } from './components/MapLoadBoundary';
import { LegalFooter } from './components/LegalFooter';
import { BeachSearcherHome, type DirectoryCategory } from './components/BeachSearcherHome';
import { LandingView } from './components/landing/LandingView';
import { TripPlanner } from './components/planner/TripPlanner';

// Hooks & Utils
import { useBeaches } from './hooks/useBeaches';
import { useWeather } from './hooks/useWeather';
import { useLocation } from './hooks/useLocation';
import { translations } from './translations';
import { degToCompass, getBeaufortLevel, isWinterSeason, processForecastData } from './utils/weatherUtils';
import { getRegionWindContext, LOCAL_WIND_LABEL } from './utils/localWindContext.mjs';
import { trackEvent, trackPageView, buildBeachExposureParams } from './services/analyticsService';
import { recordPageview } from './services/pageviewBeacon';
import { loadAppReadyRegion, loadBeachDetailData, loadBeachRegionIndex, loadBeachSearchIndex, mergeBeachDetailData } from './services/beachDataLoader';
import { fetchForecastData, fetchMarineForecastData, mergeMarineForecastData } from './services/weatherService';
import { calculateSeaConditionScore, hasPoorSeaConditions } from './utils/seaConditions';
import { recordForecastSnapshots } from './services/forecastVerificationService';
import { getBeachPhotoLookup } from './services/beachPhotos';
import { scrollElementIntoView, scrollToPageTop } from './utils/scroll';
import { getInitialLanguage, getLocalizedCopy, languageToLocale, saveLanguagePreference, type SupportedLanguage } from './utils/i18n';
import { lazyWithChunkRecovery } from './utils/chunkLoadRecovery';
import { buildBetaFeedbackUrl } from './utils/betaFeedback';
import { islandHasContextStrip } from './utils/islandContextStrip';
import { QUICK_PREFERENCE_FILTERS } from './utils/preferenceFilterLabels';
import { canOpenNavigation, openNavigation } from './utils/navigation';
import { displayBeachName, localizedBeachLabel } from './utils/localization';
import { beachSentenceName } from './utils/beachCopy';
import { isInfoOnlyRegionId } from './utils/infoOnlyRegions';
import { hasBoatOnlyAccess, hasDifficultTopPickAccess, hasMainstreamTopPickAccess, isAdventureBeach } from './utils/access';
import { isNaturistBeach } from './utils/naturistBeaches';
import { isSunsetFacingBeach } from './utils/beachOrientation';
import { detectSearchIntentFilters } from './utils/searchIntent';
import { getBeachPopularityRating } from './utils/beachRating';
import { buildBeachDetailPath, buildBeachRegionPath, parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from './utils/beachUrls';
import { describeSimpleWindSuitability } from './utils/windExposureCopy';
import {
  getSelectedDayOffset,
  getSelectedDayPrefix,
  getSelectedDaySentencePrefix,
  isSelectedDateToday,
} from './utils/dateLabels';
import { athensNow, toAthensWallClock, wallClockDayKey } from './utils/athensTime';
import { getTopPickTiming, getTopPickTimingLabel, topPickTimingPriority } from './utils/topPickTiming';
import { rotateEquivalentTopPicks } from './utils/topPickVariety';
import { getActiveWeatherFixtureScenario } from './utils/weatherFixtures';
import { getBeachTouristRecognitionScore } from './utils/touristPriority';
import { getConsistentVisibleMapExposureLevels } from './utils/mapExposure';
import type { ExposureLevel } from './utils/windExposure';
import { getRegionWindVariationNote, type RegionBeachWindSample } from './utils/regionWindVariation';
import { loadGeospatialExposureProfiles, type GeospatialExposureProfileLookup } from './services/geospatialExposureService';
import { assessBeachWindExposure } from './utils/windExposureEngine';
import { getWindChopWaveFloorM, resolveEffectiveWaveHeightM } from './utils/waveModel';
import { fuzzySearchScore, getSearchVariants } from './utils/searchNormalize';
import { getLandmassId } from './utils/landmass';

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
const MOBILE_MAP_DAY_LIMIT = 5;

type DetailDataStatus = 'idle' | 'loading' | 'ready' | 'partial';

const capitalizeMapDayLabel = (value: string, locale: string): string => {
  if (!value) return value;
  return `${value.charAt(0).toLocaleUpperCase(locale)}${value.slice(1)}`;
};

const getMobileMapDayLabel = (
  date: Date,
  language: LanguageCode,
  t: Translation,
  now: Date = athensNow()
): string => {
  const locale = t.locale || languageToLocale(language);
  const offset = getSelectedDayOffset(date, now);

  if (offset === 0) return capitalizeMapDayLabel(t.today, locale);
  if (offset === 1) return capitalizeMapDayLabel(t.tomorrow, locale);

  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
};

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

  // Island backgrounds ship as AVIF + WebP + JPG siblings (scripts/optimizeBackgroundImages.mjs,
  // which fails the build if any AVIF is missing). Serve them via image-set() so AVIF-capable
  // browsers get the smallest file (~25% under WebP) and everyone else falls back to WebP, then JPG.
  const base = imagePath.replace(/\.(jpe?g|webp|avif)$/i, '');
  if (base === imagePath) return `url(${imagePath})`; // unknown extension — serve as-is

  const jpgFallback = /\.jpe?g$/i.test(imagePath) ? `, url(${base}.jpg) type("image/jpeg")` : '';
  return `image-set(url(${base}.avif) type("image/avif"), url(${base}.webp) type("image/webp")${jpgFallback})`;
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
    title: 'Find Your Ideal Beach in Greece Today | CalmBeach',
    description: "Tailored to today's conditions and your beach preferences — live wind, waves and shelter for thousands of Greek beaches.",
    locale: 'en_US',
  },
  gr: {
    title: 'Βρες την ιδανική σου παραλία στην Ελλάδα σήμερα | CalmBeach',
    description: 'Προσαρμοσμένη στις σημερινές συνθήκες και στις προτιμήσεις σου — ζωντανός άνεμος, κύμα και προστασία για χιλιάδες ελληνικές παραλίες.',
    locale: 'el_GR',
  },
  fr: {
    title: 'Trouvez votre plage idéale en Grèce aujourd’hui | CalmBeach',
    description: 'Adaptée aux conditions du jour et à vos préférences — vent, vagues et abri en direct pour des milliers de plages grecques.',
    locale: 'fr_FR',
  },
  de: {
    title: 'Dein idealer Strand in Griechenland heute | CalmBeach',
    description: 'Abgestimmt auf die heutigen Bedingungen und deine Strandvorlieben — Wind, Wellen und Schutz live für tausende Strände in Griechenland.',
    locale: 'de_DE',
  },
  it: {
    title: 'Trova la tua spiaggia ideale in Grecia oggi | CalmBeach',
    description: 'Su misura per le condizioni di oggi e le tue preferenze — vento, onde e riparo in tempo reale per migliaia di spiagge greche.',
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
const MAP_HOUR_SLIDER_START_HOUR = 8;
const MAP_HOUR_SLIDER_END_HOUR = 21;
const MIN_REMAINING_TOP_PICK_SCORE = 62;
const DEFAULT_FORECAST_SLOT_MINUTES = 120;
const INITIAL_BEACH_DATA_LOADER_DELAY_MS = 300;
const DISTANCE_SORT_LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 4500,
  maximumAge: 10 * 60 * 1000,
};
const DISTANCE_SORT_REFINEMENT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 7000,
  maximumAge: 0,
};

// Synthetic region id for the cross-region "Κοντά μου" view. Its beaches are
// merged from the real regions nearest to the user, so the result reflects the
// user's actual location rather than whichever region happens to be on screen.
const NEAR_ME_REGION_ID = 'near-me';
// Consider regions whose centre lies within this radius of the user, capped to a
// sensible number so we never load the whole country.
const NEAR_ME_CANDIDATE_RADIUS_KM = 80;
const NEAR_ME_MAX_CANDIDATE_REGIONS = 14;
// From the merged beaches, keep those within this radius, then cap the list. The
// landmass guard in buildNearbyRegion is what stops sea crossings (you never see
// another island's beaches); this radius then keeps the *same-landmass* result
// local. Kept deliberately tight: 40 km still covers a normal beach-day drive on
// the mainland without reaching halfway across a prefecture.
const NEAR_ME_BEACH_RADIUS_KM = 40;
const NEAR_ME_MAX_BEACHES = 60;
// If almost nothing falls inside the radius (sparse coastline), still surface at
// least this many nearest beaches so the view is never empty.
const NEAR_ME_MIN_BEACHES = 15;

const isGenericAppEntryPath = (pathname?: string): boolean => {
  const currentPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  return currentPathname === '/' || currentPathname === '/el' || currentPathname === '/el/';
};

const startupLocationPromptCopy = {
  en: {
    title: 'Show beaches near you?',
    body: 'CalmBeach can use your current location once to open the closest Greek beach area.',
    privacy: 'We do not store your exact GPS location. You can choose a region manually instead.',
    useLocation: 'Use my location',
    finding: 'Finding nearby beaches...',
    chooseManually: 'Choose region',
  },
  gr: {
    title: 'Να δείξουμε παραλίες κοντά σου;',
    body: 'Το CalmBeach μπορεί να χρησιμοποιήσει μία φορά την τρέχουσα τοποθεσία σου για να ανοίξει την κοντινότερη περιοχή παραλιών.',
    privacy: 'Δεν αποθηκεύουμε την ακριβή GPS τοποθεσία σου. Μπορείς να επιλέξεις περιοχή χειροκίνητα.',
    useLocation: 'Χρήση τοποθεσίας',
    finding: 'Βρίσκουμε κοντινές παραλίες...',
    chooseManually: 'Επιλογή περιοχής',
  },
  fr: {
    title: 'Afficher les plages près de toi ?',
    body: 'CalmBeach peut utiliser ta position actuelle une fois pour ouvrir la zone de plage grecque la plus proche.',
    privacy: 'Nous ne stockons pas ta position GPS exacte. Tu peux choisir une région manuellement.',
    useLocation: 'Utiliser ma position',
    finding: 'Recherche des plages proches...',
    chooseManually: 'Choisir une région',
  },
  de: {
    title: 'Strände in deiner Nähe zeigen?',
    body: 'CalmBeach kann deinen aktuellen Standort einmal nutzen, um die nächste griechische Strandregion zu öffnen.',
    privacy: 'Wir speichern deinen genauen GPS-Standort nicht. Du kannst stattdessen eine Region manuell wählen.',
    useLocation: 'Standort nutzen',
    finding: 'Suche Strände in der Nähe...',
    chooseManually: 'Region wählen',
  },
  it: {
    title: 'Mostrare le spiagge vicino a te?',
    body: 'CalmBeach può usare una volta la tua posizione attuale per aprire la zona spiagge greca più vicina.',
    privacy: 'Non salviamo la tua posizione GPS esatta. Puoi scegliere una zona manualmente.',
    useLocation: 'Usa la mia posizione',
    finding: 'Cerco spiagge vicine...',
    chooseManually: 'Scegli zona',
  },
};

const StartupLocationPrompt: React.FC<{
  language: SupportedLanguage;
  isFindingLocation: boolean;
  onUseLocation: () => void;
  onChooseManually: () => void;
}> = ({ language, isFindingLocation, onUseLocation, onChooseManually }) => {
  const copy = getLocalizedCopy(language, startupLocationPromptCopy);

  return (
    <section className="relative z-30 bg-sky-50 px-4 pt-3 text-slate-950 sm:px-5" aria-label={copy.title} data-nosnippet="true">
      <div className="mx-auto flex max-w-[110rem] flex-col gap-3 rounded-2xl border border-sky-100 bg-white/90 p-3 shadow-sm shadow-sky-900/8 ring-1 ring-white/60 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
            <Navigation className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-black leading-tight text-slate-950 sm:text-base">
              {copy.title}
            </h1>
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600 sm:text-sm">
              {copy.body}
            </p>
            <p className="mt-1 text-[11px] font-bold leading-4 text-slate-700 sm:text-xs">
              {copy.privacy}
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={onUseLocation}
            disabled={isFindingLocation}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3 text-xs font-black text-white shadow-sm shadow-cyan-900/20 transition hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 sm:min-w-36 sm:text-sm"
          >
            <Navigation className="h-4 w-4" aria-hidden="true" />
            <span>{isFindingLocation ? copy.finding : copy.useLocation}</span>
          </button>

          <button
            type="button"
            onClick={onChooseManually}
            disabled={isFindingLocation}
            className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 sm:min-w-32 sm:text-sm"
          >
            {copy.chooseManually}
          </button>
        </div>
      </div>
    </section>
  );
};

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
  /** Intraday timing bucket (topPickVariety's rotation guard keys on state). */
  timing?: { state?: string };
};

type GlobalBeachSearchEntry = {
  island: Island;
  beachId: number;
  beachName: Beach['name'];
  beachRating: number;
  aliases?: string[];
  legacySlugs?: string[];
  searchValues: string[];
  regionValues: string[];
};

type GlobalBeachSearchMatch = {
  island: Island;
  beachId: number;
  beach?: Beach;
  score: number;
};

type DirectorySearchSuggestion = {
  id: string;
  type: 'region' | 'beach';
  label: string;
  subtitle: string;
  island: Island;
  beachId?: number;
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

const lerpOptionalValue = (a: number | undefined, b: number | undefined, t: number): number | undefined => (
  typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b)
    ? lerpValue(a, b, t)
    : undefined
);

const lerpOptionalAngleDeg = (a: number | undefined, b: number | undefined, t: number): number | undefined => (
  typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b)
    ? lerpAngleDeg(a, b, t)
    : undefined
);

const interpolateMarineForecast = (
  loMarine: MarineForecast | undefined,
  hiMarine: MarineForecast | undefined,
  t: number
): MarineForecast | undefined => {
  if (!loMarine && !hiMarine) return undefined;

  return {
    waveHeightM: lerpOptionalValue(loMarine?.waveHeightM, hiMarine?.waveHeightM, t),
    waveDirectionDeg: lerpOptionalAngleDeg(loMarine?.waveDirectionDeg, hiMarine?.waveDirectionDeg, t),
    wavePeriodS: lerpOptionalValue(loMarine?.wavePeriodS, hiMarine?.wavePeriodS, t),
    swellWaveHeightM: lerpOptionalValue(loMarine?.swellWaveHeightM, hiMarine?.swellWaveHeightM, t),
    swellWaveDirectionDeg: lerpOptionalAngleDeg(loMarine?.swellWaveDirectionDeg, hiMarine?.swellWaveDirectionDeg, t),
    swellWavePeriodS: lerpOptionalValue(loMarine?.swellWavePeriodS, hiMarine?.swellWavePeriodS, t),
    seaSurfaceTemperatureC: lerpOptionalValue(loMarine?.seaSurfaceTemperatureC, hiMarine?.seaSurfaceTemperatureC, t),
    source: loMarine?.source ?? hiMarine?.source,
  };
};

const getSelectedHourMarine = (
  hourMarine: MarineForecast | undefined,
  dailyMarine: MarineForecast | undefined
): MarineForecast | undefined => {
  if (hourMarine) {
    return {
      ...hourMarine,
      seaSurfaceTemperatureC: hourMarine.seaSurfaceTemperatureC ?? dailyMarine?.seaSurfaceTemperatureC,
      source: hourMarine.source ?? dailyMarine?.source,
    };
  }

  // Do not fall back to the daily marine summary for selected-hour wave fields:
  // daily `waveHeightM` is the day's max, which makes calm selected hours look choppy.
  if (typeof dailyMarine?.seaSurfaceTemperatureC === 'number' && Number.isFinite(dailyMarine.seaSurfaceTemperatureC)) {
    return {
      seaSurfaceTemperatureC: dailyMarine.seaSurfaceTemperatureC,
      source: dailyMarine.source,
    };
  }

  return undefined;
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
    result.push(interpolateForecastItem(lo, hi, dt));
  }

  return result;
};

const interpolateForecastItem = (lo: ForecastItem, hi: ForecastItem, dt: number): ForecastItem => {
  if (hi.dt === lo.dt) return { ...lo, dt };

  const t = (dt - lo.dt) / (hi.dt - lo.dt);
  return {
    ...lo,
    dt,
    main: { ...lo.main, temp: lerpValue(lo.main.temp, hi.main.temp, t) },
    wind: {
      ...lo.wind,
      speed: lerpValue(lo.wind.speed, hi.wind.speed, t),
      deg: lerpAngleDeg(lo.wind.deg, hi.wind.deg, t),
    },
    marine: interpolateMarineForecast(lo.marine, hi.marine, t),
  };
};

const getNearestForecastItem = (items: ForecastItem[], targetDt: number): ForecastItem | undefined => (
  items.reduce<ForecastItem | undefined>((nearest, item) => {
    if (!nearest) return item;
    return Math.abs(item.dt - targetDt) < Math.abs(nearest.dt - targetDt) ? item : nearest;
  }, undefined)
);

const getForecastItemAtDt = (
  items: ForecastItem[] | undefined,
  targetDt: number,
  exactSlots?: ForecastItem[]
): ForecastItem | undefined => {
  if (!items || items.length === 0) return undefined;

  const direct = items.find(item => item.dt === targetDt);
  if (direct) return direct;

  const exactSlot = exactSlots?.find(item => item.dt === targetDt);
  if (exactSlot) return exactSlot;

  const sorted = [...items].sort((a, b) => a.dt - b.dt);
  const hiIndex = sorted.findIndex(item => item.dt >= targetDt);
  if (hiIndex > 0) {
    return interpolateForecastItem(sorted[hiIndex - 1], sorted[hiIndex], targetDt);
  }

  return getNearestForecastItem(sorted, targetDt);
};

const adjustDailyForecastToHour = (
  dailyForecast: DailyForecast,
  selectedDt: number | null,
  exactSlots?: ForecastItem[]
): DailyForecast => {
  if (selectedDt == null) return dailyForecast;

  const hourItem = getForecastItemAtDt(dailyForecast.hourly, selectedDt, exactSlots);
  if (!hourItem) return dailyForecast;

  return {
    ...dailyForecast,
    wind: hourItem.wind,
    marine: getSelectedHourMarine(hourItem.marine, dailyForecast.marine),
    weather: hourItem.weather?.[0] ?? dailyForecast.weather,
  };
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

const scoreRemainingTopPickHour = (beach: Beach, item: ForecastItem, geospatialProfile?: GeospatialExposureProfile): number => {
  if (hasHourlyRainRisk(item)) return 0;

  const windSpeedKmph = item.wind.speed * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmph);
  const windDirection = degToCompass(item.wind.deg);
  const waveHeightM = item.marine?.waveHeightM;
  // Same geometry input as the headline verdict — without it, geometry-only
  // beaches rank their "best remaining hours" with a different exposure level
  // than the card shows.
  const exposure = assessBeachWindExposure({
    beach,
    geospatialProfile,
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
  const gustKmph = typeof item.wind.gustKnots === 'number'
    ? item.wind.gustKnots * 1.852
    : typeof item.wind.gust === 'number'
      ? item.wind.gust * 3.6
      : undefined;
  const modeledWaveDamping = exposure.exposureLevel === 'protected' ? 0.5 : exposure.exposureLevel === 'partial' ? 0.75 : 1;
  const modeledWaveHeightM = Number(Math.max(
    exposure.modeledWaveHeightM * modeledWaveDamping,
    getWindChopWaveFloorM(exposure.exposureLevel, beaufort, windSpeedKmph, gustKmph)
  ).toFixed(2));
  const effectiveWaveHeightM = resolveEffectiveWaveHeightM(waveHeightM, modeledWaveHeightM);
  const seaScore = calculateSeaConditionScore(isExposed, windSpeedKmph, exposure.exposureLevel, effectiveWaveHeightM);
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
): { bestBeachTime: BestBeachTime; score: number; timingState: string } | undefined => {
  const entries = getRemainingBeachHours(hourlyForecast, selectedDate, now)
    .map(entry => ({
      ...entry,
      score: scoreRemainingTopPickHour(item.beach, entry.item, item.geospatialExposure),
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
    timingState: timing.state,
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
    // topPickVariety's calm-day rotation must never swap picks across intraday
    // timing buckets — it guards on this field.
    timing: { state: remainingWindow.timingState },
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
  if (filter === 'disabledAccess') {
    return beachMatchesUserPreferences(beach, { ...defaultPreferences, disabledAccess: true });
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
  if (filter === 'sunset') {
    return isSunsetFacingBeach(beach);
  }
  if (filter === 'naturist') {
    return isNaturistBeach(beach);
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
      [WindDirection.E]: 'les plages orientées ouest',
      [WindDirection.SE]: 'les plages au nord et à l’ouest',
      [WindDirection.S]: 'les plages orientées nord',
      [WindDirection.SW]: 'les plages au nord et à l’est',
      [WindDirection.W]: 'les plages orientées est',
      [WindDirection.NW]: 'les plages au sud et à l’est',
    },
    de: {
      [WindDirection.N]: 'südliche und südöstliche Strände',
      [WindDirection.NE]: 'südliche und westliche Strände',
      [WindDirection.E]: 'westlich ausgerichtete Strände',
      [WindDirection.SE]: 'nördliche und westliche Strände',
      [WindDirection.S]: 'nördlich ausgerichtete Strände',
      [WindDirection.SW]: 'nördliche und östliche Strände',
      [WindDirection.W]: 'östlich ausgerichtete Strände',
      [WindDirection.NW]: 'südliche und östliche Strände',
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
  selectedDate?: Date
): string => {
  const sentenceDay = getSelectedDaySentencePrefix(selectedDate, athensNow(), language);
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
    },
    fr: {
      mild: () => `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. La plupart des plages semblent adaptées à la baignade.`,
      caution: () => `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Le vent compte davantage, donc ${favoredCoasts} sont favorisées.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. La plupart des plages semblent adaptées à la baignade.`;
        return beaufort <= 5
          ? `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Le vent influence le choix, donc ${favoredCoasts} sont favorisées.`
          : `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Aucun choix clairement calme. Si vous y allez, privilégiez ${favoredCoasts}.`;
      },
      default: () => `${sentenceDay} : ${beaufort} Beaufort avec vent ${wind}. Dans ces conditions, ${favoredCoasts} sont favorisées.`,
    },
    de: {
      mild: () => `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Die meisten Strände wirken zum Schwimmen geeignet.`,
      caution: () => `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Wind spielt stärker mit, daher sind ${favoredCoasts} meist besser.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Die meisten Strände wirken zum Schwimmen geeignet.`;
        return beaufort <= 5
          ? `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Der Wind beeinflusst die Wahl, daher sind ${favoredCoasts} meist besser.`
          : `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Es gibt keine klar ruhige Badeoption. Wenn du gehst, sind ${favoredCoasts} meist besser.`;
      },
      default: () => `${sentenceDay}: ${beaufort} Bft mit ${wind} Wind. Unter diesen Bedingungen sind ${favoredCoasts} meist besser.`,
    },
    it: {
      mild: () => `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. La maggior parte delle spiagge sembra adatta al bagno.`,
      caution: () => `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. Il vento conta di più, quindi ${favoredCoasts} sono favorite.`,
      noIdeal: () => {
        if (beaufort <= 3) return `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. La maggior parte delle spiagge sembra adatta al bagno.`;
        return beaufort <= 5
          ? `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. Il vento influenza la scelta, quindi ${favoredCoasts} sono favorite.`
          : `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. Non c'è una scelta chiaramente calma. Se vai, preferisci ${favoredCoasts}.`;
      },
      default: () => `${sentenceDay}: ${beaufort} Beaufort con vento ${wind}. In queste condizioni, ${favoredCoasts} sono favorite.`,
    },
  });

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

const getUpcomingBeachHourForecast = (forecast?: DailyForecast, now: Date = athensNow()) => (
  getBeachHourForecast(forecast).filter(item => item.dt * 1000 > now.getTime())
);

// Rain is judged on the hours you can still be caught in, which includes the hour
// we are currently inside — it started in the past but is still happening, so
// "it is raining right now" must not be filtered away as a passed hour.
const getRainRelevantHourForecast = (forecast?: DailyForecast, now: Date = athensNow()) => (
  getBeachHourForecast(forecast).filter(item => item.dt * 1000 + 3_600_000 > now.getTime())
);

const getRainRiskSummary = (forecast?: DailyForecast, now: Date = athensNow()): {
  hasRainRisk: boolean;
  allBeachHoursRainy: boolean;
  isRainingNow: boolean;
  rainyTimes: string[];
  label: string;
} => {
  const allBeachHours = getBeachHourForecast(forecast);
  const beachHours = getRainRelevantHourForecast(forecast, now);
  const rainyHours = beachHours.filter(hasHourlyRainRisk);
  // "It is raining now" is read from the full hourly series, not just the 10–18
  // window, and on the same 8–21 window as the per-beach advisory: someone
  // reading this at 09:00 or 19:30 can still be in the water.
  const currentHourItem = (forecast?.hourly || []).find(item =>
    item.dt * 1000 <= now.getTime() && now.getTime() < item.dt * 1000 + 3_600_000
  );
  const currentHour = currentHourItem ? new Date(currentHourItem.dt * 1000).getHours() : -1;
  const isRainingNow = Boolean(
    currentHourItem &&
    currentHour >= 8 &&
    currentHour <= 21 &&
    hasHourlyRainRisk(currentHourItem)
  );
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
    isRainingNow,
    rainyTimes,
    label: rainyTimes.length > 0 ? rainyTimes.slice(0, 4).join(', ') : '',
  };
};

const getHourlyWindIncreaseSummary = (forecast?: DailyForecast, now: Date = athensNow()): {
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
  const day = getSelectedDayPrefix(selectedDate, athensNow(), language);
  const sentenceDay = getSelectedDaySentencePrefix(selectedDate, athensNow(), language);
  const lowerSentenceDay = sentenceDay.toLocaleLowerCase();

  // More than one rainy hour left means the rain is not a passing minute — worth
  // naming the hours even in the "raining now" copy.
  const hasMoreRainAhead = summary.rainyTimes.length > 1;

  const copy = getLocalizedCopy(language, {
    en: {
      nowTitle: 'It is raining right now',
      nowBody: `It is raining right now, so it is best not to stay in the sea until it passes.${hasMoreRainAhead ? ` The forecast shows more rain in the hours ahead (${summary.label}).` : ''}`,
      allTitle: 'Swimming is not recommended during the main beach hours because of rain',
      rainTitle: () => `Rain may affect the beach plan ${day}`,
      allBody: 'The forecast shows rain during the main beach hours, so it is best to avoid staying in the sea during that window.',
      timedBody: () => `The forecast shows possible rain around ${summary.label}, so it is best to avoid staying in the sea during those hours.`,
      genericBody: 'Note that the day has a rain signal in the forecast. Beaches may be fine for wind and waves, but the recommendation only applies to drier windows.',
    },
    gr: {
      nowTitle: 'Βρέχει τώρα',
      nowBody: `Βρέχει αυτή την ώρα, οπότε καλό είναι να μη μένεις στη θάλασσα μέχρι να περάσει.${hasMoreRainAhead ? ` Η πρόγνωση δείχνει βροχή και στη συνέχεια (${summary.label}).` : ''}`,
      allTitle: 'Δεν προτείνεται μπάνιο στις βασικές ώρες λόγω βροχής',
      rainTitle: () => `Προσοχή στη βροχή ${day}`,
      allBody: `Η πρόγνωση δείχνει βροχή στις βασικές ώρες παραλίας, οπότε ${lowerSentenceDay} καλό είναι να αποφεύγεις την παραμονή στη θάλασσα σε αυτό το διάστημα.`,
      timedBody: () => `Η πρόγνωση δείχνει πιθανή βροχή γύρω στις ${summary.label}, οπότε εκείνες τις ώρες καλό είναι να αποφεύγεις την παραμονή στη θάλασσα.`,
      genericBody: 'Πρόσεξε όμως ότι υπάρχει ένδειξη βροχής στην πρόγνωση. Οι παραλίες μπορεί να είναι οκ από άνεμο/κύμα, αλλά η σύσταση ισχύει μόνο για στεγνά διαστήματα.',
    },
    fr: {
      nowTitle: 'Il pleut en ce moment',
      nowBody: `Il pleut en ce moment, mieux vaut donc ne pas rester dans la mer le temps que ça passe.${hasMoreRainAhead ? ` La prévision indique encore de la pluie dans les heures qui viennent (${summary.label}).` : ''}`,
      allTitle: 'Baignade non recommandée aux heures principales à cause de la pluie',
      rainTitle: () => `La pluie peut affecter le plan plage ${day}`,
      allBody: 'La prévision indique de la pluie aux heures principales de plage, il vaut donc mieux éviter de rester dans la mer sur ce créneau.',
      timedBody: () => `La prévision indique une pluie possible vers ${summary.label}, il vaut donc mieux éviter de rester dans la mer à ces heures-là.`,
      genericBody: 'La journée présente un risque de pluie. Les plages peuvent être correctes côté vent et vagues, mais la recommandation vaut seulement sur les créneaux plus secs.',
    },
    de: {
      nowTitle: 'Es regnet gerade',
      nowBody: `Es regnet gerade, bleibe daher besser nicht im Wasser, bis es vorbei ist.${hasMoreRainAhead ? ` Die Vorhersage zeigt auch in den nächsten Stunden Regen (${summary.label}).` : ''}`,
      allTitle: 'Schwimmen ist zu den Haupt-Strandzeiten wegen Regen nicht empfohlen',
      rainTitle: () => `Regen kann den Strandplan ${day} beeinflussen`,
      allBody: 'Die Vorhersage zeigt Regen zu den Haupt-Strandzeiten, bleibe in diesem Zeitfenster daher besser nicht im Wasser.',
      timedBody: () => `Die Vorhersage zeigt möglichen Regen um ${summary.label}, bleibe zu diesen Zeiten daher besser nicht im Wasser.`,
      genericBody: 'Die Vorhersage zeigt ein Regensignal. Für Wind und Wellen kann es passen, aber die Empfehlung gilt nur für trockenere Zeitfenster.',
    },
    it: {
      nowTitle: 'Sta piovendo ora',
      nowBody: `Sta piovendo in questo momento, quindi è meglio non restare in mare finché non passa.${hasMoreRainAhead ? ` Le previsioni indicano pioggia anche nelle prossime ore (${summary.label}).` : ''}`,
      allTitle: 'Bagno non consigliato nelle ore principali per pioggia',
      rainTitle: () => `La pioggia può influire sul piano spiaggia ${day}`,
      allBody: 'Le previsioni indicano pioggia nelle ore principali da spiaggia, quindi è meglio evitare di restare in mare in quella fascia.',
      timedBody: () => `Le previsioni indicano possibile pioggia verso ${summary.label}, quindi è meglio evitare di restare in mare in quelle ore.`,
      genericBody: 'La giornata ha un segnale di pioggia. Le spiagge possono andare bene per vento e onde, ma il consiglio vale solo nelle fasce più asciutte.',
    },
  });

  // Live rain wins over the forecast wording: if it is raining at this moment,
  // "rain around 14:00, 15:00" reads as something you can still plan around.
  if (summary.isRainingNow) {
    return { title: copy.nowTitle, body: copy.nowBody };
  }

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
  // We no longer greet visitors with a location prompt on open — it read as "too much"
  // right at launch and asked for GPS before the user had shown any intent. Location is
  // now opt-in only, via the explicit "Κοντά μου" button (handleShowNearbyBeaches), which
  // triggers the GPS permission flow on demand. First-time visitors (no saved region) land
  // on the browse-by-destination home instead. Kept as a ref (not deleted) so the startup
  // flow can be re-enabled by flipping this back to the entry-path check.
  const shouldPromptStartupLocationRef = useRef(false);
  const [isStartupLocationPromptOpen, setIsStartupLocationPromptOpen] = useState(
    () => shouldPromptStartupLocationRef.current
  );
  const [isSelectingStartupRegion, setIsSelectingStartupRegion] = useState(false);
  const homeCopy = {
    recommendationMode: {
      mild: {
        title: {
          en: 'Most beaches look suitable',
      gr: 'Οι περισσότερες παραλίες φαίνονται κατάλληλες',
          de: 'Gute Startpunkte für heute',
          it: 'Buone opzioni da cui iniziare',
          fr: 'Bonnes options pour commencer',
        },
        helper: {
          en: 'Today the weather is mild, so most beaches look suitable for swimming.',
      gr: 'Σήμερα ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.',
          de: 'Heute ist das Wetter mild, daher passen die meisten Strände. Diese fallen eher durch Zugang, Strandtyp, Ausstattung und deine Vorlieben auf.',
          it: 'Oggi il meteo è mite, quindi la maggior parte delle spiagge va bene. Queste spiccano di più per accesso, tipo di spiaggia, servizi e preferenze.',
          fr: 'La météo est douce aujourd’hui, donc la plupart des plages conviennent. Celles-ci ressortent surtout pour l’accès, le type de plage, les services et tes préférences.',
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
          it: 'Opzioni più comode oggi',
          fr: 'Options plus confortables aujourd’hui',
        },
        helper: {
          en: 'Wind starts to matter today, so these options look more comfortable than exposed beaches.',
      gr: 'Σήμερα ο άνεμος αρχίζει να παίζει ρόλο, οπότε αυτές φαίνονται πιο άνετες από πιο εκτεθειμένες παραλίες.',
          de: 'Heute spielt der Wind eine größere Rolle, daher wirken diese Optionen angenehmer als offenere Strände.',
          it: 'Oggi il vento inizia a contare, quindi queste opzioni sembrano più comode delle spiagge esposte.',
          fr: 'Le vent commence à compter aujourd’hui, donc ces options semblent plus confortables que les plages exposées.',
        },
        cardLabel: {
          en: 'More comfortable',
      gr: 'Πιο άνετη',
          de: 'Angenehmer',
          it: 'Più comoda',
          fr: 'Plus confortable',
        },
      },
      strong: {
        title: {
          en: 'Most suitable options today',
      gr: 'Καταλληλότερες επιλογές σήμερα',
          de: 'Am besten handhabbare Optionen heute',
          it: 'Opzioni più gestibili oggi',
          fr: 'Options les plus gérables aujourd’hui',
        },
        helper: {
          en: 'Today the wind affects the beach choice. These look more suitable than more exposed beaches. This does not mean conditions are ideal.',
      gr: 'Σήμερα ο άνεμος επηρεάζει αρκετά τις επιλογές. Αυτές φαίνονται πιο κατάλληλες σε σχέση με πιο εκτεθειμένες παραλίες. Δεν σημαίνει ότι οι συνθήκες είναι ιδανικές.',
          de: 'Heute ist kein idealer Tag für ruhiges Schwimmen. Diese wirken besser handhabbar als exponierte Strände.',
          it: 'Oggi non è una giornata ideale per nuotare con mare calmo. Queste sembrano più gestibili delle spiagge esposte.',
          fr: 'Ce n’est pas une journée idéale pour une baignade calme. Ces options semblent plus gérables que les plages exposées.',
        },
      },
      no_ideal_swimming: {
        title: {
          en: 'No clear calm-swimming option today',
      gr: 'Δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο',
          de: 'Heute keine klare Option für ruhiges Schwimmen',
          it: 'Oggi nessuna opzione chiaramente tranquilla',
          fr: 'Aucune option clairement calme aujourd’hui',
        },
        helper: {
          en: 'Wind and sea conditions make calm swimming unlikely today. These are only the more sheltered options if you still decide to go.',
      gr: 'Ο άνεμος και η θάλασσα κάνουν δύσκολο το ήρεμο μπάνιο σήμερα. Αυτές είναι μόνο οι πιο προστατευμένες επιλογές αν αποφασίσεις να πας.',
          de: 'Wind und Meer machen ruhiges Schwimmen heute unwahrscheinlich. Das sind nur weniger exponierte Optionen, falls du trotzdem gehst.',
          it: 'Vento e mare rendono improbabile un bagno tranquillo oggi. Queste sono solo opzioni meno esposte se decidi comunque di andare.',
          fr: 'Le vent et la mer rendent une baignade calme peu probable aujourd’hui. Ce sont seulement des options moins exposées si tu décides quand même d’y aller.',
        },
      },
    },
    manageableSortLabel: {
      en: 'More suitable',
      gr: 'Καταλληλότερες',
      de: 'Besser handhabbar',
      it: 'Più gestibili',
      fr: 'Plus gérables',
    },
    lessExposedSortLabel: {
      en: 'Most suitable',
      gr: 'Καταλληλότερες',
      de: 'Am besten geeignet',
      it: 'Più adatte',
      fr: 'Les plus adaptées',
    },
    beaches: { en: 'beaches', gr: 'παραλίες', fr: 'plages', de: 'Strände', it: 'spiagge' },
    wind: { en: 'wind', gr: 'άνεμος', fr: 'vent', de: 'Wind', it: 'vento' },
    selectLocation: { en: 'Select location', gr: 'Επίλεξε τοποθεσία', fr: 'Choisir une destination', de: 'Ort auswählen', it: 'Scegli località' },
    calmAllAroundTitle: {
      en: 'All beaches are suitable',
      gr: 'Όλες οι παραλίες είναι κατάλληλες',
      de: 'Heute sind alle Strände gut zum Baden',
      it: 'Oggi tutte le spiagge sono ottime per il bagno',
      fr: 'Aujourd’hui toutes les plages sont parfaites pour se baigner',
    },
    calmMostBeachesTitle: {
      en: 'Most beaches look suitable',
      gr: 'Οι περισσότερες παραλίες φαίνονται κατάλληλες',
      de: 'Heute sind fast alle Strände gut zum Baden',
      it: 'Oggi quasi tutte le spiagge sono ottime per il bagno',
      fr: 'Aujourd’hui presque toutes les plages sont parfaites pour se baigner',
    },
    lightWindDayTitle: {
      en: (beaufort: number) => `${beaufort} Beaufort. All beaches are suitable!`,
      gr: (beaufort: number) => `${beaufort} μποφόρ. Όλες οι παραλίες είναι κατάλληλες!`,
      de: (beaufort: number) => `${beaufort} Bft heute. Alle Strände sind geeignet.`,
      it: (beaufort: number) => `${beaufort} Bft oggi. Tutte le spiagge sono adatte.`,
      fr: (beaufort: number) => `${beaufort} Bft aujourd’hui. Toutes les plages conviennent.`,
    },
    calmAllAroundDescription: {
      en: 'Today the weather is mild, so all beaches look suitable for swimming.',
      gr: 'Σήμερα ο καιρός είναι ήπιος, οπότε όλες οι παραλίες φαίνονται κατάλληλες για μπάνιο.',
      de: 'Der Wind ist leicht und das Meer wirkt ruhig. Es muss heute keine einzelne Top-Wahl geben. Entscheide nach Zugang, Sand/Kies, Schatten oder Stimmung.',
      it: 'Il vento è leggero e il mare sembra calmo, quindi non serve forzare una sola scelta top. Scegli per accesso, sabbia/ciottoli, ombra o atmosfera.',
      fr: 'Le vent est faible et la mer semble calme. Pas besoin de forcer un seul meilleur choix aujourd’hui. Choisis selon l’accès, le sable/galets, l’ombre ou l’ambiance.',
    },
    lightWindDayDescription: {
      en: 'Today the weather is mild, so most beaches look suitable for swimming.',
      gr: 'Σήμερα ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.',
      de: 'Wähle einfach nach Sand, Schatten, Zugang oder Stimmung.',
      it: 'Scegli quella che preferisci per sabbia, ombra, accesso o atmosfera.',
      fr: 'Choisis celle que tu préfères selon le sable, l’ombre, l’accès ou l’ambiance.',
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
      de: (count: number, total: number) => `${count}/${total} Strände angenehm`,
      it: (count: number, total: number) => `${count}/${total} spiagge comode`,
      fr: (count: number, total: number) => `${count}/${total} plages confortables`,
    },
    viewOnMap: { en: 'View on map', gr: 'Δες στον χάρτη', fr: 'Voir sur la carte', de: 'Auf Karte ansehen', it: 'Vedi sulla mappa' },
    mapTitle: { en: 'Interactive Map', gr: 'Διαδραστικός Χάρτης', fr: 'Carte interactive', de: 'Interaktive Karte', it: 'Mappa interattiva' },
    mapSubtitle: { en: 'Explore beaches on the map', gr: 'Εξερεύνησε τις παραλίες στον χάρτη', fr: 'Explore les plages sur la carte', de: 'Strände auf der Karte erkunden', it: 'Esplora le spiagge sulla mappa' },
    allBeaches: { en: 'All beaches', gr: 'Όλες οι παραλίες', fr: 'Toutes les plages', de: 'Alle Strände', it: 'Tutte le spiagge' },
    exploreTools: { en: 'All suitable beaches', gr: 'Όλες οι κατάλληλες παραλίες', fr: 'Toutes les plages adaptées', de: 'Alle geeigneten Strände', it: 'Tutte le spiagge adatte' },
    moreSuitableOptions: { en: 'More suitable options', gr: 'Περισσότερες κατάλληλες επιλογές', fr: 'Plus d’options adaptées', de: 'Weitere passende Optionen', it: 'Altre opzioni adatte' },
    lessExposedOptions: { en: 'More sheltered options', gr: 'Πιο προστατευμένες επιλογές', fr: 'Options plus abritées', de: 'Geschütztere Optionen', it: 'Opzioni più riparate' },
    mapLoadPrompt: { en: 'Loading map', gr: 'Φόρτωση χάρτη', fr: 'Chargement de la carte', de: 'Karte wird geladen', it: 'Caricamento mappa' },
    mapError: { en: 'The map did not load right now. The beach list is still available.', gr: 'Ο χάρτης δεν φορτώθηκε τώρα. Η λίστα παραλιών παραμένει διαθέσιμη.', fr: 'La carte ne s’est pas chargée pour le moment. La liste des plages reste disponible.', de: 'Die Karte wurde gerade nicht geladen. Die Strandliste bleibt verfügbar.', it: 'La mappa non si è caricata ora. La lista delle spiagge resta disponibile.' },
    weatherRetry: { en: 'Refresh', gr: 'Ανανέωση', fr: 'Actualiser', de: 'Aktualisieren', it: 'Aggiorna' },
    // Hard-cutoff safety state: the forecast is older than 3 h and could not be refreshed,
    // so we deliberately show NO conditions/colours rather than risk a stale "calm" reading.
    conditionsUnavailableTitle: {
      en: 'Conditions are not available right now',
      gr: 'Οι συνθήκες δεν είναι διαθέσιμες τώρα',
      fr: 'Les conditions ne sont pas disponibles pour le moment',
      de: 'Die Bedingungen sind derzeit nicht verfügbar',
      it: 'Le condizioni non sono disponibili al momento',
    },
    conditionsUnavailableBody: {
      en: 'We could not refresh the forecast, so we are not showing wind or sea conditions to avoid an out-of-date reading.',
      gr: 'Δεν μπορέσαμε να ανανεώσουμε την πρόγνωση, γι’ αυτό δεν δείχνουμε συνθήκες ανέμου/θάλασσας ώστε να μη δώσουμε παρωχημένη εικόνα.',
      fr: 'Nous n’avons pas pu actualiser la prévision ; nous n’affichons donc pas les conditions pour éviter une donnée périmée.',
      de: 'Wir konnten die Vorhersage nicht aktualisieren und zeigen daher keine Bedingungen, um veraltete Angaben zu vermeiden.',
      it: 'Non siamo riusciti ad aggiornare la previsione, quindi non mostriamo le condizioni per evitare dati non aggiornati.',
    },
    lastForecastAt: {
      en: (time: string) => `Last forecast: ${time}`,
      gr: (time: string) => `Τελευταία πρόγνωση: ${time}`,
      fr: (time: string) => `Dernière prévision : ${time}`,
      de: (time: string) => `Letzte Vorhersage: ${time}`,
      it: (time: string) => `Ultima previsione: ${time}`,
    },
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
      it: 'Il Planner vacanze è una funzione Pro',
      fr: 'Le planificateur de vacances est une fonction Pro',
    },
    description: {
      en: 'Pro creates a weather-aware holiday plan for each destination, matching beach days, calmer hours and backup ideas to the forecast.',
      description: { en: 'With Pro, it will build a holiday plan for each place, based on weather, sea, best beach hours, and backup options.', gr: 'Στο Pro θα φτιάχνει πρόγραμμα διακοπών για κάθε μέρος, με βάση τον καιρό, τη θάλασσα, τις καλύτερες ώρες για παραλία και εναλλακτικές επιλογές.', fr: 'Avec Pro, il construira un programme de vacances pour chaque lieu, selon la météo, la mer, les meilleures heures de plage et les options de secours.', de: 'Mit Pro erstellt es für jeden Ort einen Urlaubsplan, basierend auf Wetter, Meer, besten Strandzeiten und Ausweichoptionen.', it: 'Con Pro creerà un programma vacanze per ogni luogo, in base a meteo, mare, orari migliori per la spiaggia e alternative.' },
      de: 'Pro erstellt einen wetterbasierten Urlaubsplan je Reiseziel, mit Strandtagen, ruhigen Zeitfenstern und Alternativen passend zur Vorhersage.',
      it: 'Pro crea un programma vacanze per ogni destinazione in base a meteo, mare, orari migliori per la spiaggia e alternative.',
      fr: 'Pro crée un programme de vacances par destination selon la météo, la mer, les meilleurs moments de plage et des alternatives.',
    },
    cta: {
      en: 'Available on Pro',
      cta: { en: 'Available in Pro', gr: 'Διαθέσιμο στο Pro', fr: 'Disponible en Pro', de: 'In Pro verfügbar', it: 'Disponibile in Pro' },
      de: 'In Pro verfügbar',
      it: 'Disponibile in Pro',
      fr: 'Disponible avec Pro',
    },
  };

  // --- Beach & Weather Data (Custom Hooks) ---
  const { allIslands, loading: beachesLoading, error: beachesError, getFilteredBeaches, ensureIslandBeachesLoaded, cacheLoadedIsland } = useBeaches(language);
  const { selectedIsland, selectIsland, selectAdHocRegion, showValueProp, markValuePropSeen, showLanding, goToLanding } = useLocation(allIslands);
  // Islands offered in the browsable selector + name search. Info-only regions
  // (e.g. Milos) are SEO-only: their pages exist and resolve on a direct URL, but
  // they are never surfaced as a pickable/searchable option in the app. Resolution
  // still uses the full `allIslands`, so direct links keep working.
  const selectableIslands = useMemo(
    () => allIslands.filter(island => !isInfoOnlyRegionId(island.id)),
    [allIslands],
  );
  const isNearMeRegionActive = selectedIsland?.id === NEAR_ME_REGION_ID;
  const { weather, forecast: rawForecast, forecastIslandId, beachForecasts, loading: weatherLoading, error: weatherError, selectedDayIndex, setSelectedDayIndex, loadWeatherData, lastUpdated, forecastFreshness, isStaleBlocked } = useWeather(selectedIsland, language);
  // On a region switch `selectedIsland` updates synchronously, but the new region's
  // forecast only lands in an effect after paint. Until the loaded forecast actually
  // belongs to the selected region, treat it as absent everywhere downstream — so the
  // beach cards and map pin colours never render the previous region's (stale) wind
  // for a frame (old red "not ideal today" cards / wrong pin colours). The UI shows
  // its loading state instead and fills in once the right forecast arrives. Gating at
  // the source keeps every consumer (and their dependency arrays) consistent.
  const forecastMatchesRegion = Boolean(selectedIsland && forecastIslandId === selectedIsland.id);
  // SAFETY hard cutoff: a forecast older than 3 h that we could not refresh must never
  // colour the map / score beaches / claim "calm". Treat it as absent everywhere downstream
  // (same mechanism as the region-mismatch gate) and surface the "unavailable" banner instead.
  // Better to show nothing than a stale "ήρεμα" on a meltemi day.
  const forecast = forecastMatchesRegion && !isStaleBlocked ? rawForecast : null;
  const handleRegionSelected = (island: Island, source: 'selector' | 'nearest_location' | 'landing' = 'selector') => {
    markValuePropSeen();
    trackEvent('region_changed', undefined, {
      locale: languageToLocale(language),
      region_id: island.id,
      region: island.name.en,
      region_group: island.group || 'other',
      source,
    });

    // Entering a region FROM THE LANDING means "show me this place", so it must
    // land on the whole region. The region-change effect already clears
    // selectedFilters, but `preferences` are persisted in localStorage and were
    // not — so a pebbles/quiet toggle set once silently filtered every region a
    // visitor opened afterwards, with no visible cause on the landing.
    if (source === 'landing') {
      setBeachSearchQuery('');
      setSelectedFilters([]);
      setPreferences(defaultPreferences);
      hasUserSelectedSortRef.current = false;
      setSortBy(defaultBeachListSort);
      setMobileSuitableDistanceSort(false);
      localStorage.setItem('userPreferences', JSON.stringify(defaultPreferences));
    }

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

  // Return to the national landing (logo / home action). Clears the committed
  // region AND resets the URL to the localized home path, otherwise the
  // region-sync effect (which re-reads parseBeachRegionPath) would immediately
  // re-select the region the URL still pointed at and bounce us off the landing.
  const handleGoHome = () => {
    goToLanding();
    detailRequestRef.current += 1;
    setDetailDataStatus('idle');
    setDetailBeach(null);
    setView('home');
    if (typeof window !== 'undefined') {
      const homePath = language === 'gr' ? '/el/' : '/';
      if (window.location.pathname !== homePath) {
        window.history.pushState({ view: 'home' }, '', homePath);
      }
    }
  };

  // --- Functional State ---
  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('protected');
  const [mobileSuitableDistanceSort, setMobileSuitableDistanceSort] = useState(false);
  const [locationSortResetKey, setLocationSortResetKey] = useState(0);
  const [mobileResultListResetKey, setMobileResultListResetKey] = useState(0);
  // The hour chosen on the map slider; drives both the map colours and the
  // suitable-beach recommendations so they all reflect the same moment.
  const [selectedHourDt, setSelectedHourDt] = useState<number | null>(null);
  // A deferred copy of the slider hour. The map colours / compass / hour label
  // read the urgent `selectedHourDt` so they track the thumb in real time, but
  // the heavy per-beach scoring + the recommendation list read this deferred
  // value. That keeps the slider drag smooth on mobile: React can interrupt the
  // expensive beach re-render instead of blocking each frame of the scrub.
  const deferredSelectedHourDt = React.useDeferredValue(selectedHourDt);
  const hasUserSelectedSortRef = useRef(false);
  const [topPickClock, setTopPickClock] = useState(() => athensNow().getTime());
  const [beachSearchQuery, setBeachSearchQuery] = useState('');
  const deferredBeachSearchQuery = React.useDeferredValue(beachSearchQuery);
  const [directorySearchSuggestions, setDirectorySearchSuggestions] = useState<DirectorySearchSuggestion[]>([]);
  const [isDirectorySearchSuggesting, setIsDirectorySearchSuggesting] = useState(false);
  const [regionBeachCounts, setRegionBeachCounts] = useState<Record<string, number>>({});
  const [detailBeach, setDetailBeach] = useState<Beach | null>(null);
  const [detailExactForecastContext, setDetailExactForecastContext] = useState<BeachForecastContext | null>(null);
  const [detailDataStatus, setDetailDataStatus] = useState<DetailDataStatus>('idle');
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  // On the home tab the bottom nav stays hidden while the map fills the screen, and slides
  // in once the user reaches the beach list below it (via the "Δες τις παραλίες" pill or by
  // scrolling). Always visible on the other tabs. See the scroll effect below.
  const [showBottomNav, setShowBottomNav] = useState(false);
  const [isMobileAllBeachesPanelOpen, setIsMobileAllBeachesPanelOpen] = useState(false);
  const [isMobileWeatherPanelOpen, setIsMobileWeatherPanelOpen] = useState(false);
  const [highlightedMapBeachId, setHighlightedMapBeachId] = useState<number | undefined>(undefined);
  // A discrete "centre this beach's card" signal, fired ONLY when the user picks a beach
  // from search (not while swiping the carousel). The nonce lets the same beach be
  // re-focused on a repeat search; BeachSearcherHome centres the matching card below the map.
  const [directorySearchCardFocus, setDirectorySearchCardFocus] = useState<{ beachId: number; nonce: number } | undefined>(undefined);
  const directorySearchCardFocusNonceRef = useRef(0);
  const focusDirectorySearchCard = (beachId: number) => {
    directorySearchCardFocusNonceRef.current += 1;
    setDirectorySearchCardFocus({ beachId, nonce: directorySearchCardFocusNonceRef.current });
  };
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
  const [showInitialBeachLoader, setShowInitialBeachLoader] = useState(false);

  // Reveal the mobile bottom nav only once the user has moved past the map into the beach
  // list. On any non-home tab (or a home view without a map) it stays visible. The nav is
  // CSS-hidden on desktop (md:hidden), so this runs harmlessly there too.
  useEffect(() => {
    if (mobileTab !== 'home') {
      setShowBottomNav(true);
      return;
    }
    const update = () => {
      const mapEl = document.getElementById('map-section');
      if (!mapEl) {
        // No map element yet: if a region is selected the map is just still loading, so keep
        // the nav hidden (a later run re-measures it). With no region there's no map to hide
        // behind, so show it.
        setShowBottomNav(!selectedIsland);
        return;
      }
      const rect = mapEl.getBoundingClientRect();
      // Once the map's bottom passes the lower third of the viewport, the beach list below
      // it is in view — that's when the nav slides in.
      setShowBottomNav(rect.bottom < window.innerHeight * 0.66);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [mobileTab, selectedIsland, shouldLoadMap]);

  // --- Modals State ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterModalResultCount, setFilterModalResultCount] = useState<number | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isIslandSelectorOpen, setIsIslandSelectorOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  useEffect(() => {
    if (!beachesLoading) {
      setShowInitialBeachLoader(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowInitialBeachLoader(true);
    }, INITIAL_BEACH_DATA_LOADER_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [beachesLoading]);

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
  // Set when a SEARCH picks a region (not a beach): the new region loads async, so we can't
  // scroll to its map immediately (map-section isn't mounted yet). Deferred to the effect
  // that fires once selectedIsland switches.
  const pendingRegionMapScrollRef = useRef(false);
  // Set when a SEARCH combines a region with an intent word ("Νάξος ... ηλιοβασίλεμα"):
  // the new region loads async AND the region-change effect force-clears selectedFilters,
  // so we stash the intent filter(s) here and let that same effect re-apply them once the
  // region has switched — the only way a cross-region search can land with a filter active.
  const pendingRegionIntentFiltersRef = useRef<FilterKey[]>([]);
  // Set when a SEARCH picks a beach: setBeachSearchQuery(name) starts a name-search whose
  // beach filtering runs on the DEFERRED query, so the page re-renders shorter a beat later.
  // Scrolling to the map at select-time would clamp to the (now shorter) page bottom — the
  // legal footer. Deferred to the effect that fires once deferredBeachSearchQuery settles.
  const pendingBeachMapScrollRef = useRef(false);
  const trackedAppLoadedRef = useRef(false);
  const trackedPageViewRef = useRef<string | null>(null);
  const trackedWeatherFallbackRef = useRef<string | null>(null);
  const trackedEmptyResultsRef = useRef<string | null>(null);

  useEffect(() => {
    globalBeachSearchIndexRef.current = null;
  }, [allIslands, language]);

  // --- User Preferences & Favorites ---
  const defaultPreferences: UserPreferences = useMemo(
    () => ({
      blueFlag2026: false,
      disabledAccess: false,
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
  const locationRefinementRequestRef = useRef(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTopPickClock(athensNow().getTime()), 5 * 60 * 1000);
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

  // Builds the synthetic "Κοντά μου" region: merges beaches from the regions
  // nearest to the user into a single distance-sorted list, so results reflect
  // the user's real position instead of whichever region is currently on screen.
  // Beach ids are only unique within a region, so each merged beach gets a fresh
  // globally-unique id (keeping its real id + region for detail lookups).
  const buildNearbyRegion = async (
    userLoc: { lat: number; lon: number },
    islands: Island[]
  ): Promise<Island | null> => {
    const centroidRanked = islands
      .map(island => ({
        island,
        centroidDistance: calculateDistance(userLoc.lat, userLoc.lon, island.coordinates.lat, island.coordinates.lon),
      }))
      .sort((a, b) => a.centroidDistance - b.centroidDistance);

    if (centroidRanked.length === 0) return null;

    // Cast a wide net by region centroid to decide which region files to load.
    const withinRadius = centroidRanked.filter(candidate => candidate.centroidDistance <= NEAR_ME_CANDIDATE_RADIUS_KM);
    const candidates = (withinRadius.length > 0 ? withinRadius : centroidRanked).slice(0, NEAR_ME_MAX_CANDIDATE_REGIONS);

    const regionIndex = await loadBeachRegionIndex().catch(() => []);
    const indexById = new Map(regionIndex.map(entry => [entry.id, entry] as const));

    const loadedRegions = await Promise.all(candidates.map(async candidate => {
      let region = candidate.island;
      if (region.beaches.length === 0) {
        const entry = indexById.get(region.id);
        try {
          region = await loadAppReadyRegion(region.id, {
            summaryDataPath: entry?.summaryDataPath,
            appDataPath: entry?.appDataPath,
          });
        } catch (error) {
          console.warn('Nearby-region beach load failed; skipping region.', { regionId: region.id, error });
          return [];
        }
      }
      return region.beaches.map(beach => ({
        beach,
        regionId: region.id,
        distance: calculateDistance(userLoc.lat, userLoc.lon, beach.coordinates.lat, beach.coordinates.lon),
      }));
    }));

    const ranked = loadedRegions.flat().sort((a, b) => a.distance - b.distance);
    if (ranked.length === 0) return null;

    // "Near me" must only reach beaches that are drivable from where the user is
    // standing: straight-line distance happily crosses the sea, so without this
    // guard standing on Naxos surfaces Koufonisia beaches (a ferry away). The
    // user's landmass is the one owning the single nearest beach — robust even on
    // the far tip of a big island, where the nearest region *centroid* can belong
    // to a neighbouring islet. Keep only beaches on that landmass: for an island
    // that is just the island itself; on the mainland it still spans adjacent
    // prefectures, and on Crete the neighbouring prefectures. See utils/landmass.
    const homeLandmass = getLandmassId(ranked[0].regionId);
    const sameLandmass = ranked.filter(item => getLandmassId(item.regionId) === homeLandmass);

    const withinBeachRadius = sameLandmass.filter(item => item.distance <= NEAR_ME_BEACH_RADIUS_KM);
    const selected = (withinBeachRadius.length >= NEAR_ME_MIN_BEACHES ? withinBeachRadius : sameLandmass)
      .slice(0, NEAR_ME_MAX_BEACHES);

    let nextSyntheticId = 1;
    const beaches: Beach[] = selected.map(({ beach, regionId }) => ({
      ...beach,
      // Globally-unique within the merged region; the real id lives in sourceBeachId.
      id: nextSyntheticId++,
      sourceBeachId: beach.sourceBeachId ?? beach.id,
      regionId: beach.regionId ?? regionId,
    }));

    return {
      id: NEAR_ME_REGION_ID,
      name: {
        gr: 'Κοντά μου',
        en: 'Near me',
        fr: 'Près de moi',
        de: 'In meiner Nähe',
        it: 'Vicino a me',
      },
      group: 'other',
      coordinates: userLoc,
      beaches,
    };
  };

  const getPositionOnce = (options: PositionOptions): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject({ code: 2, message: 'Geolocation unavailable' } as GeolocationPositionError);
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const applyUserPosition = (position: GeolocationPosition) => {
    const userLoc = { lat: position.coords.latitude, lon: position.coords.longitude };
    setUserLocation(userLoc);
    setUserLocationAccuracy(Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined);
    return userLoc;
  };

  const refineUserLocationInBackground = (currentAccuracy?: number) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const requestId = locationRefinementRequestRef.current + 1;
    locationRefinementRequestRef.current = requestId;

    void getPositionOnce(DISTANCE_SORT_REFINEMENT_OPTIONS)
      .then(position => {
        if (locationRefinementRequestRef.current !== requestId) return;

        const nextAccuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined;
        if (
          typeof currentAccuracy === 'number' &&
          typeof nextAccuracy === 'number' &&
          nextAccuracy > currentAccuracy
        ) {
          return;
        }

        applyUserPosition(position);
      })
      .catch(() => undefined);
  };

  // --- Nearest Island Handler ---
  const [isFindingNearest, setIsFindingNearest] = useState(false);
  const [findNearestError, setFindNearestError] = useState<string | null>(null);

  const handleSelectNearest = async () => {
    setIsFindingNearest(true);
    setFindNearestError(null);
    try {
      const position = await getAccuratePosition();
      const userLoc = applyUserPosition(position);
      const nearest = await findNearestIsland(userLoc, allIslands);
      if (nearest) {
        handleRegionSelected(nearest, 'nearest_location');
        setIsIslandSelectorOpen(false);
      } else {
        setFindNearestError(getLocalizedCopy(language, {
          en: 'No nearby island found.',
    gr: 'Δεν βρέθηκε κοντινό νησί.',
          fr: 'Aucune île proche trouvée.',
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
  // navigating away from the region they are currently browsing. For this UI a
  // fast coarse fix is better than blocking the result list on precise GPS.
  const handleRequestUserLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFindNearestError(t.locationErrorUnavailable);
      return;
    }

    if (userLocation) {
      setFindNearestError(null);
      refineUserLocationInBackground(userLocationAccuracy);
      return;
    }

    setIsFindingNearest(true);
    setFindNearestError(null);
    try {
      const position = await getPositionOnce(DISTANCE_SORT_LOCATION_OPTIONS);
      const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined;
      applyUserPosition(position);
      refineUserLocationInBackground(accuracy);
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

  // Powers the "Κοντά μου" button: instead of sorting whichever region is on
  // screen, it builds a one-off region from the beaches physically nearest to the
  // user (across region boundaries) and shows them distance-first.
  const handleShowNearbyBeaches = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFindNearestError(t.locationErrorUnavailable);
      return;
    }

    markValuePropSeen();
    setBeachSearchQuery('');
    setIsFindingNearest(true);
    setFindNearestError(null);
    try {
      const position = await getAccuratePosition();
      const userLoc = applyUserPosition(position);
      const nearbyRegion = await buildNearbyRegion(userLoc, allIslands);
      if (!nearbyRegion || nearbyRegion.beaches.length === 0) {
        setFindNearestError(getLocalizedCopy(language, {
          en: 'No beaches found near you.',
          gr: 'Δεν βρέθηκαν παραλίες κοντά σου.',
          fr: 'Aucune plage trouvée près de vous.',
          de: 'Keine Strände in deiner Nähe gefunden.',
          it: 'Nessuna spiaggia trovata vicino a te.',
        }));
        return;
      }

      detailRequestRef.current += 1;
      setDetailDataStatus('idle');
      setDetailBeach(null);
      setView('home');
      selectAdHocRegion(nearbyRegion);
      setIsIslandSelectorOpen(false);
      // Surface the nearest beaches first, mirroring the distance-sort affordance.
      hasUserSelectedSortRef.current = true;
      setSortBy('protected');
      setMobileSuitableDistanceSort(true);
      setLocationSortResetKey(key => key + 1);
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

  // Falling back to the manual region picker (e.g. the startup "use my location"
  // prompt was declined or geolocation failed) should open it on a clean slate.
  // A failed *automatic* location attempt must not greet the visitor with a red
  // "Location access denied" alert inside the picker — the picker itself already
  // invites them to choose a region. The error is only meaningful when the user
  // explicitly asks for their location from inside the modal (handleSelectNearest).
  const handleChooseStartupRegionManually = () => {
    setFindNearestError(null);
    setIsStartupLocationPromptOpen(false);
    setIsSelectingStartupRegion(false);
    setIsIslandSelectorOpen(true);
  };

  // Opening the island picker to browse manually should never carry over a stale
  // geolocation error, otherwise the red alert reappears every time the modal is
  // opened even when the user never asked for their location this time.
  const handleOpenIslandSelector = () => {
    setFindNearestError(null);
    setIsIslandSelectorOpen(true);
  };

  const handleCloseIslandSelector = () => {
    setFindNearestError(null);
    setIsIslandSelectorOpen(false);
  };

  const handleUseStartupLocation = async () => {
    if (isSelectingStartupRegion) return;

    if (
      !shouldPromptStartupLocationRef.current ||
      !isGenericAppEntryPath() ||
      parseBeachDetailPath() ||
      parseBeachRegionPath()
    ) {
      setIsStartupLocationPromptOpen(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setFindNearestError(t.locationErrorUnavailable);
      handleChooseStartupRegionManually();
      return;
    }

    setIsSelectingStartupRegion(true);
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
        setIsStartupLocationPromptOpen(false);
        setIsIslandSelectorOpen(false);
      } else {
        setFindNearestError(getLocalizedCopy(language, {
          en: 'No nearby island found.',
          gr: 'Δεν βρέθηκε κοντινή περιοχή.',
          fr: 'Aucune région proche trouvée.',
          de: 'Keine nahe Region gefunden.',
          it: 'Nessuna zona vicina trovata.',
        }));
        handleChooseStartupRegionManually();
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
      handleChooseStartupRegionManually();
    } finally {
      setIsFindingNearest(false);
      setIsSelectingStartupRegion(false);
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
    const currentPathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const detailRoute = parseBeachDetailPath(currentPathname);
    const regionRoute = parseBeachRegionPath(currentPathname);
    const beachRoute = detailRoute || regionRoute;
    const routeMatchesSelectedIsland = Boolean(
      beachRoute &&
      selectedIsland &&
      regionMatchesRouteParam(selectedIsland, beachRoute.regionId)
    );
    const selectedIslandName = routeMatchesSelectedIsland
      ? selectedIsland?.name[language] || selectedIsland?.name.en
      : undefined;
    const selectedIslandBeachCount = routeMatchesSelectedIsland
      ? selectedIsland?.beaches.length
      : undefined;
    const beachCountText = typeof selectedIslandBeachCount === 'number'
      ? `${selectedIslandBeachCount} `
      : '';
    const regionDescription = selectedIslandName
      ? getLocalizedCopy(language, {
        en: `${selectedIslandName} beaches in Greece. Compare ${beachCountText}beaches by wind, waves, weather, exposure, access and beach type before you choose where to swim.`,
        gr: `${selectedIslandName}: σύγκρινε ${beachCountText}παραλίες με βάση άνεμο, κύμα, καιρό, έκθεση, πρόσβαση και τύπο παραλίας πριν διαλέξεις πού θα κολυμπήσεις.`,
        fr: `Plages de ${selectedIslandName} en Grèce. Comparez le vent, les vagues, la météo, l’exposition, l’accès et le type de plage avant de choisir où nager.`,
        de: `Strände in ${selectedIslandName}, Griechenland. Vergleiche Wind, Wellen, Wetter, Exposition, Zugang und Strandtyp, bevor du den Strand wählst.`,
        it: `Spiagge a ${selectedIslandName}, Grecia. Confronta vento, onde, meteo, esposizione, accesso e tipo di spiaggia prima di scegliere dove nuotare.`,
      })
      : meta.description;
    const canUseDetailSeo = Boolean(
      detailRoute &&
      detailBeach &&
      detailBeach.id === detailRoute.beachId &&
      selectedIslandName
    );
    // Match the prerendered <title>/<meta> exactly so hydration never overwrites
    // the correct static head. Keep in sync with beachTitleFor /
    // beachMetaDescription in scripts/prerenderBeachPages.mjs. The "live" hook is
    // truthful on beach pages: this SPA shows live wind/waves once hydrated.
    const detailBeachLabel = detailBeach
      ? localizedBeachLabel(displayBeachName(detailBeach.name, language), language)
      : '';
    const beachTitleHook: Record<string, string> = {
      en: 'Live Wind & Waves',
      gr: 'Άνεμος & Κύμα Live',
      de: 'Wind & Wellen live',
      fr: 'Vent & vagues en direct',
      it: 'Vento e onde live',
    };
    const buildDetailTitle = (): string => {
      const hook = beachTitleHook[language] || beachTitleHook.en;
      const sep = language === 'en' ? ': ' : ' — ';
      const max = language === 'gr' ? 58 : 60;
      const tiers = [
        `${detailBeachLabel}, ${selectedIslandName}${sep}${hook} | CalmBeach`,
        `${detailBeachLabel}, ${selectedIslandName}${sep}${hook}`,
        `${detailBeachLabel}${sep}${hook}`,
      ];
      return tiers.find(tier => tier.length <= max) || detailBeachLabel;
    };
    const buildDetailMeta = (): string => {
      if (!detailBeach) return regionDescription;
      if (language !== 'en' && language !== 'gr') {
        return getLocalizedCopy(language, {
          en: `See practical info for ${detailBeachLabel} in ${selectedIslandName}, including location, beach type, wind exposure, map and tips to help you decide when to visit.`,
          gr: `Δες πρακτικές πληροφορίες για ${detailBeachLabel} σε ${selectedIslandName}, όπως τοποθεσία, τύπο παραλίας, έκθεση στον άνεμο, χάρτη και χρήσιμες συμβουλές.`,
          fr: `Plage ${detailBeachLabel}, ${selectedIslandName} (Grèce). Vérifiez le vent, les vagues, la météo et l’exposition de la plage avant d’y aller.`,
          de: `Strand ${detailBeachLabel}, ${selectedIslandName} (Griechenland). Prüfe vor dem Besuch Wind, Wellen, Wetter und die Lage des Strandes.`,
          it: `Spiaggia ${detailBeachLabel}, ${selectedIslandName} (Grecia). Controlla vento, onde, meteo ed esposizione della spiaggia prima di andare.`,
        });
      }
      const isEn = language === 'en';
      const typeTrait: Record<string, { en: string; gr: string }> = {
        sandy: { en: 'Sandy beach', gr: 'Αμμώδης παραλία' },
        pebbles: { en: 'Pebble beach', gr: 'Παραλία με βότσαλο' },
        'sandy-pebbles': { en: 'Sand & pebble beach', gr: 'Παραλία με άμμο & βότσαλο' },
        rocky: { en: 'Rocky beach', gr: 'Βραχώδης παραλία' },
      };
      const features: string[] = [];
      const organized = detailBeach.amenities?.organized;
      const sunbeds = detailBeach.amenities?.sunbeds;
      if (organized && sunbeds) features.push(isEn ? 'organised with sunbeds' : 'οργανωμένη με ξαπλώστρες');
      else if (organized) features.push(isEn ? 'organised' : 'οργανωμένη');
      else if (sunbeds) features.push(isEn ? 'with sunbeds' : 'με ξαπλώστρες');
      if (detailBeach.amenities?.parking) features.push(isEn ? 'with parking' : 'με πάρκινγκ');
      if (detailBeach.amenities?.restaurant || detailBeach.amenities?.taverna) features.push(isEn ? 'with food nearby' : 'με φαγητό κοντά');
      if (detailBeach.environment?.familyFriendly) features.push(isEn ? 'family-friendly' : 'οικογενειακή');
      if (detailBeach.activities?.snorkeling) features.push(isEn ? 'good for snorkeling' : 'καλή για snorkeling');
      if (detailBeach.shelteredFromLocalWind === true) {
        const w = LOCAL_WIND_LABEL[getRegionWindContext(selectedIsland?.id ?? '')];
        features.push(isEn ? `often sheltered from ${w.en}` : `συχνά υπήνεμη ${w.elIn}`);
      }
      const parts = [typeTrait[detailBeach.beachType]?.[isEn ? 'en' : 'gr'], ...features.slice(0, 3)].filter(Boolean);
      const traits = parts.length ? `${parts.join(', ')}.` : '';
      const head = `${detailBeachLabel}, ${selectedIslandName}: `;
      const ctaLong = isEn
        ? 'Check live wind, waves and weather before you go — map, access and nearby beaches.'
        : 'Δες live άνεμο, κύμα και καιρό πριν πας — χάρτης, πρόσβαση και κοντινές παραλίες.';
      const ctaShort = isEn
        ? 'Check live wind, waves and weather before you go.'
        : 'Δες live άνεμο, κύμα και καιρό πριν πας.';
      const ctaTiny = isEn ? 'Check live wind & waves.' : 'Δες live άνεμο & κύμα.';
      const candidates = [
        traits ? `${head}${traits} ${ctaLong}` : `${head}${ctaLong}`,
        traits ? `${head}${traits} ${ctaShort}` : `${head}${ctaShort}`,
        traits ? `${head}${traits} ${ctaTiny}` : `${head}${ctaTiny}`,
        traits ? `${head}${traits}` : `${head}${ctaTiny}`,
      ];
      return candidates.find(candidate => candidate.length <= 155) || candidates[candidates.length - 1].slice(0, 155);
    };
    const detailTitle = canUseDetailSeo && detailBeach
      ? buildDetailTitle()
      : selectedIslandName
        ? getLocalizedCopy(language, {
          en: `${selectedIslandName} Beaches | CalmBeach Greece`,
          gr: `Παραλίες: ${selectedIslandName} | Calm Beach Greece`,
          fr: `Plages de ${selectedIslandName} | Calm Beach Greece`,
          de: `Strände in ${selectedIslandName} | Calm Beach Greece`,
          it: `Spiagge a ${selectedIslandName} | Calm Beach Greece`,
        })
        : meta.title;
    const detailDescription = canUseDetailSeo && detailBeach
      ? buildDetailMeta()
      : regionDescription;
    // Normalize to a trailing slash so a client-side navigation (or an external
    // no-slash link) never publishes a non-slash self-canonical: every internal
    // URL builder and the sitemap use the slash form, and the prerendered
    // canonical is always the slash form. pathname already excludes query/hash.
    const canonicalPath = typeof window !== 'undefined'
      ? (window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`)
      : '/';
    const canonicalUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${canonicalPath}`
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
  }, [detailBeach, language, selectedIsland?.id, selectedIsland?.name, view]);

  // Re-run the geospatial-profile load when the region changes OR when the cross-region
  // "Κοντά μου" beach set changes (its region id is constant, so key on the source beaches).
  const geoEffectKey = selectedIsland?.id === NEAR_ME_REGION_ID
    ? `nearme:${(selectedIsland?.beaches ?? []).map(b => b.sourceBeachId ?? b.id).join(',')}`
    : (selectedIsland?.id ?? '');
  useEffect(() => {
    const regionId = selectedIsland?.id;
    let cancelled = false;

    setGeospatialExposureProfiles(undefined);
    setGeospatialExposureRegionId(undefined);

    if (!regionId) {
      setGeospatialExposureRegionId(regionId);
      setIsGeospatialExposureLoading(false);
      return () => { cancelled = true; };
    }

    // The synthetic "Κοντά μου" region has no profile file of its own, but its beaches come from
    // real islands. Load each constituent island's profiles and merge them keyed by the SYNTHETIC
    // beach id, so every downstream geospatialExposureProfiles?.[beach.id] lookup resolves to the
    // real per-cove geometry instead of falling back to island-level wind (the known backlog gap).
    if (regionId === NEAR_ME_REGION_ID) {
      const nearbyBeaches = selectedIsland?.beaches ?? [];
      const sourceRegionIds = Array.from(
        new Set(nearbyBeaches.map(b => b.regionId).filter((r): r is string => Boolean(r)))
      );
      if (sourceRegionIds.length === 0) {
        setGeospatialExposureRegionId(regionId);
        setIsGeospatialExposureLoading(false);
        return () => { cancelled = true; };
      }
      setIsGeospatialExposureLoading(true);
      Promise.all(
        sourceRegionIds.map(rid =>
          loadGeospatialExposureProfiles(rid).catch(() => ({} as GeospatialExposureProfileLookup))
        )
      ).then(perRegion => {
        if (cancelled) return;
        const byRegion = new Map<string, GeospatialExposureProfileLookup>();
        sourceRegionIds.forEach((rid, i) => byRegion.set(rid, perRegion[i] ?? {}));
        const merged: GeospatialExposureProfileLookup = {};
        for (const b of nearbyBeaches) {
          const src = b.regionId ? byRegion.get(b.regionId) : undefined;
          const profile = src?.[b.sourceBeachId ?? b.id];
          if (profile) merged[b.id] = profile;
        }
        setGeospatialExposureProfiles(merged);
        setGeospatialExposureRegionId(regionId);
        setIsGeospatialExposureLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setGeospatialExposureRegionId(regionId);
        setIsGeospatialExposureLoading(false);
      });
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
  }, [geoEffectKey]);

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
    // A cross-region "region + intent" search stashes its filter(s) here so they survive
    // the region switch; every other region change starts with a clean filter slate.
    if (pendingRegionIntentFiltersRef.current.length > 0) {
      setSelectedFilters(pendingRegionIntentFiltersRef.current);
      pendingRegionIntentFiltersRef.current = [];
    } else {
      setSelectedFilters([]);
    }
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

  const resetMobileResultListPosition = () => {
    if (!isDesktopViewport) {
      setMobileResultListResetKey(key => key + 1);
    }
  };

  const handleMapHourChange = (dt: number) => {
    if (dt === selectedHourDt) return;
    resetMobileResultListPosition();
    setSelectedHourDt(dt);
  };


  const handleTogglePreference = (key: keyof UserPreferences) => {
    resetMobileResultListPosition();
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
    resetMobileResultListPosition();
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
    resetMobileResultListPosition();

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
    resetMobileResultListPosition();
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
      const favoriteBeach = selectedIsland?.beaches.find(b => b.id === beachId);
      trackEvent('favorite_clicked', beachId, {
        ...analyticsBaseParams,
        action: isFavoriting ? 'add' : 'remove',
        ...buildBeachExposureParams(favoriteBeach),
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
      ...buildBeachExposureParams(beach),
    });
    trackEvent('beach_detail_opened', beach.id, {
      ...analyticsBaseParams,
      source,
      beach_name: beach.name.en,
      ...buildBeachExposureParams(beach),
    });
    setDetailBeach(beach);
    setDetailDataStatus('loading');
    setView('detail');

    // In the "Κοντά μου" view a beach carries its own (real) region + id; the
    // selected region is the synthetic merged one and must not drive detail
    // loading or the URL.
    const isNearMe = selectedIsland?.id === NEAR_ME_REGION_ID;
    const regionId = beach.regionId ?? selectedIsland?.id;
    const detailBeachId = beach.sourceBeachId ?? beach.id;

    if (options.updateUrl !== false && !isNearMe && regionId && typeof window !== 'undefined') {
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

    void loadBeachDetailData(regionId, detailBeachId)
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
          beachId: detailBeachId,
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
    // The "Κοντά μου" view is a synthetic region with no URL of its own; the URL
    // still points at the previously-browsed region. Don't let that stale URL
    // yank the user out of the nearby-beaches list.
    if (selectedIsland?.id === NEAR_ME_REGION_ID) return;
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
    if (selectedIsland?.id === NEAR_ME_REGION_ID) return;
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
    // Land on the FIRST results section in DOM order (top recommendations → suitable/all) so
    // apply scrolls just to the top of the results — never *past* a higher section, which made
    // the page jump near the bottom. preferredSection only breaks the suitable/all tie.
    const targetIds = preferredSection === 'suitable'
      ? ['top-recommendations-section', 'suitable-beaches-section', 'all-beaches-section']
      : ['top-recommendations-section', 'all-beaches-section', 'suitable-beaches-section'];

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
    if (typeof window === 'undefined') return;
    const id = isDesktopViewport ? 'map-section-desktop' : 'map-section';
    // A cross-region search loads the new region's view asynchronously: the island strip and
    // hero images finish laying out AFTER we scroll — sometimes seconds later on a slow phone —
    // and the space ABOVE the sticky map shrinks while the card carousel BELOW grows, so the
    // body height barely changes (a ResizeObserver on <body> misses it) yet the map slides up
    // and the page ends scrolled PAST it, near the legal footer.
    //
    // So poll the MAP's own position each frame and re-anchor it to the top (instant scrollBy,
    // not a smooth scroll that we'd re-trigger every frame) until it holds still. We re-anchor
    // unconditionally: browser scroll anchoring shifts window.scrollY when content above changes,
    // so we can't reliably distinguish "user scrolled" from "layout shifted" — and this only runs
    // for the brief settle window right after a search-select, when the user is waiting to land on
    // the map, not scrolling. Verified with a throttled (slow-image) mobile Playwright repro.
    const STICKY_TOP = 8;      // the map-section's `sticky top-2` resting offset (0.5rem)
    const TOLERANCE = 6;
    const MAX_MS = 5000;       // give a slow region up to 5s to mount + settle
    const STABLE_MS = 500;     // stop once the map has held the top this long
    const start = performance.now();
    let stableSince: number | null = null;
    const tick = () => {
      const nowMs = performance.now();
      const target = document.getElementById(id);
      if (target) {
        const delta = target.getBoundingClientRect().top - STICKY_TOP;
        if (Math.abs(delta) > TOLERANCE) {
          window.scrollBy(0, delta);
          stableSince = null;
        } else if (stableSince === null) {
          stableSince = nowMs;
        }
      }
      const settled = stableSince !== null && nowMs - stableSince >= STABLE_MS;
      if (!settled && nowMs - start < MAX_MS) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
    // == null, not falsy: beach id 0 is a real beach (ids are 0-indexed source order).
    if (pendingBeachId == null || !selectedIsland?.beaches.some(beach => beach.id === pendingBeachId)) return;

    pendingDirectorySearchHighlightRef.current = undefined;
    setHighlightedMapBeachId(pendingBeachId);
    setIsDirectoryMapFollowPaused(false);
    // Land on the map (pin highlighted) with the beach's card centred below it — NOT the
    // results list, which on a short name-search page scrolled past to the legal footer.
    focusDirectorySearchCard(pendingBeachId);
    // Defer the scroll until the name-search layout settles (effect below).
    pendingBeachMapScrollRef.current = true;
  }, [beachSearchQuery, selectedIsland]);

  // A region search switches islands async; once the new region is committed (and its
  // map-section mounted), land on the map — same outcome a beach search gets.
  useEffect(() => {
    if (!pendingRegionMapScrollRef.current || !selectedIsland) return;
    pendingRegionMapScrollRef.current = false;
    scrollToMapSection();
  }, [selectedIsland?.id]);

  // Beach search lands on the map, but only AFTER the name-search filtering (which runs on
  // the deferred query) has re-rendered the page to its final, shorter height — otherwise
  // the scroll clamps to the bottom (the legal footer). deferredBeachSearchQuery updating is
  // exactly that "layout settled" signal; selectedIsland?.id covers the cross-region case.
  useEffect(() => {
    if (!pendingBeachMapScrollRef.current || !selectedIsland) return;
    pendingBeachMapScrollRef.current = false;
    scrollToMapSection();
  }, [deferredBeachSearchQuery, selectedIsland?.id]);

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
      // Weather only makes sense with a selected region, so bounce back to Home only
      // when there's no island at all. If the island is set but its forecast hasn't
      // loaded yet, still open the full-screen weather panel (it renders a graceful
      // "no forecast" state). Bouncing to Home in that case used to dump the user on
      // the scrollable home page, surfacing the © 2026 legal footer instead.
      if (!selectedIsland) {
        setMobileTab('home');
        return;
      }
      if (view === 'detail') closeBeachDetails();
      setIsMobileAllBeachesPanelOpen(false);
      setIsMobileWeatherPanelOpen(true);
      return;
    }
    if (tab === 'favorites') {
      // The Saved screen renders via an early return on mobileTab === 'favorites';
      // just clear any open overlays/detail so it shows cleanly.
      closeMobileBottomPanels();
      if (view === 'detail') closeBeachDetails();
      return;
    }
  };

  // --- CORE AI LOGIC (RTX 3090 / GEMINI) ---
  const handleChatSend = async (msg: string, model: string = 'google') => {
    if (!selectedIsland) return;
    
    const userMsg = { id: Date.now().toString(), text: msg, sender: 'user' }; // athens-clock-exempt: unique id, not a time-of-day
    const loadingId = 'bot-loading-' + Date.now(); // athens-clock-exempt: unique id, not a time-of-day
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

  useEffect(() => {
    if (view !== 'detail' || !detailBeach) {
      setDetailExactForecastContext(null);
      return undefined;
    }

    let cancelled = false;
    const beachId = detailBeach.id;
    const { lat, lon } = detailBeach.coordinates;
    setDetailExactForecastContext(null);

    const loadExactDetailForecast = async () => {
      try {
        const [forecastResult, marineItems] = await Promise.all([
          fetchForecastData(lat, lon),
          fetchMarineForecastData(lat, lon)
            .then(result => result.data)
            .catch(error => {
              console.warn('Detail marine forecast unavailable; using exact wind forecast with wind-based sea estimates.', {
                beachId,
                error,
              });
              return [];
            }),
        ]);
        if (cancelled) return;

        const detailForecast = processForecastData(mergeMarineForecastData(forecastResult.data, marineItems));
        setDetailExactForecastContext({
          forecast: detailForecast,
          source: 'beach-cluster',
          clusterKey: `exact:${beachId}:${lat.toFixed(4)}_${lon.toFixed(4)}`,
          fetchedAt: forecastResult.fetchedAt,
        });
      } catch (error) {
        if (cancelled) return;
        console.warn('Exact detail forecast unavailable; falling back to region/cluster forecast.', {
          beachId,
          error,
        });
        setDetailExactForecastContext(null);
      }
    };

    void loadExactDetailForecast();

    return () => {
      cancelled = true;
    };
  }, [detailBeach, view]);

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

  // Per-beach cluster forecasts, swapped to the slider hour the same way the
  // island-level selectedForecast is. Without this the recommendations freeze
  // once the background cluster forecasts load: scoring would read each beach's
  // day-level wind/marine instead of the hour the slider points at, so "best
  // beaches at HH:MM" stopped changing as you scrubbed. We keep each beach's
  // `hourly` array untouched so the day-wide hourly scores (sea/gust/rain) are
  // unaffected — only the headline wind/marine/weather follow the slider.
  const hourAdjustedBeachForecasts = useMemo<BeachWeatherById>(() => {
    if (deferredSelectedHourDt == null) return selectedBeachForecasts;
    const adjusted: BeachWeatherById = {};
    Object.entries(selectedBeachForecasts).forEach(([beachId, beachForecast]) => {
      if (!beachForecast) return;
      const hourly = beachForecast.hourly;
      if (!hourly || hourly.length === 0) {
        adjusted[Number(beachId)] = beachForecast;
        return;
      }
      adjusted[Number(beachId)] = adjustDailyForecastToHour(beachForecast, deferredSelectedHourDt);
    });
    return adjusted;
  }, [selectedBeachForecasts, deferredSelectedHourDt]);

  const detailBeachWeatherById = useMemo<BeachWeatherById>(() => {
    const beachId = detailBeach?.id;
    if (beachId == null) return hourAdjustedBeachForecasts;

    const exactBeachForecast = detailExactForecastContext?.forecast[selectedDayIndex];
    const beachForecast = exactBeachForecast ?? selectedBeachForecasts[beachId];
    if (!beachForecast) return hourAdjustedBeachForecasts;

    return {
      ...hourAdjustedBeachForecasts,
      [beachId]: selectedHourDt == null ? beachForecast : adjustDailyForecastToHour(beachForecast, selectedHourDt),
    };
  }, [detailBeach?.id, detailExactForecastContext, selectedDayIndex, selectedBeachForecasts, selectedHourDt, hourAdjustedBeachForecasts]);

  // Per-beach local wind (direction + speed) for the map hover card, so a beach
  // coloured differently from the island headline is self-explanatory ("here it
  // blows N 7 km/h"). Falls back to the island wind when no cluster forecast.
  const mapBeachLocalWinds = useMemo<Record<number, { deg: number; speedKmh: number }>>(() => {
    const lookup: Record<number, { deg: number; speedKmh: number }> = {};
    Object.entries(hourAdjustedBeachForecasts).forEach(([beachId, forecast]) => {
      const deg = forecast?.wind?.deg;
      const speed = forecast?.wind?.speed;
      if (typeof deg === 'number' && Number.isFinite(deg) && typeof speed === 'number') {
        lookup[Number(beachId)] = { deg, speedKmh: speed * 3.6 };
      }
    });
    return lookup;
  }, [hourAdjustedBeachForecasts]);

  // --- Hour selection (map slider) ---
  // `forecast` is already gated to the selected region at the source (see useWeather
  // destructure above), so this reads the right region's day or nothing.
  const baseDailyForecast = forecast?.[selectedDayIndex];
  // Daytime hours available on the slider. For "today" we only expose the
  // current hour onward — you can't scrub back to the morning once it has passed.
  const mapHourSlots = useMemo(() => {
    const hourly = baseDailyForecast?.hourly;
    if (!hourly || hourly.length === 0) return [];
    // Greek wall clock: forecast hours are Greek local, so "now" must be too —
    // otherwise a viewer abroad starts the slider on the wrong hour.
    const now = athensNow();
    const day = baseDailyForecast?.date;
    const isToday = day ? isSameCalendarDay(day, now) : false;
    const daytime = hourly
      .filter(item => {
        const hour = new Date(item.dt * 1000).getHours();
        return hour >= MAP_HOUR_SLIDER_START_HOUR && hour <= MAP_HOUR_SLIDER_END_HOUR;
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
  // Default: the current hour for today, otherwise the first beach-hour slot.
  const defaultHourDt = useMemo(() => {
    if (mapHourSlots.length === 0) return null;
    const day = baseDailyForecast?.date;
    const isToday = day ? isSameCalendarDay(day, athensNow()) : false;
    if (isToday) return mapHourSlots[0].dt;
    return mapHourSlots[0].dt;
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
    return adjustDailyForecastToHour(baseDailyForecast, selectedHourDt, mapHourSlots);
  }, [baseDailyForecast, mapHourSlots, selectedHourDt]);
  // Deferred twin of selectedForecast for the heavy list/scoring path. The map
  // and label use the urgent selectedForecast; the beach ranking uses this so a
  // fast scrub doesn't block on re-scoring every beach each frame.
  //
  // On a region switch the urgent selectedForecast is already region-safe (gated to
  // null above), but useDeferredValue keeps returning the PREVIOUS region's forecast
  // for a few renders while selectedIsland is already the new region. That lag would
  // score the new region's beaches with the old region's wind — the exact stale
  // "not ideal today" cards. So we defer a {forecast, regionId} signature and drop
  // the deferred forecast whenever its region no longer matches the selected one;
  // the list then shows its loading state until the right forecast catches up.
  const forecastSignature = useMemo(
    () => (selectedForecast ? { forecast: selectedForecast, regionId: selectedIsland?.id } : null),
    [selectedForecast, selectedIsland?.id]
  );
  const deferredForecastSignature = React.useDeferredValue(forecastSignature);
  const deferredSelectedForecast = deferredForecastSignature && deferredForecastSignature.regionId === selectedIsland?.id
    ? deferredForecastSignature.forecast
    : undefined;
  // "Where is calmer today" — when the per-beach cluster winds show one side of the
  // region clearly calmer than the area average, surface a single plain line in the
  // strip. Quietly null until the background cluster forecasts land (and when the
  // region is uniform), so it never adds noise.
  const regionWindVariationNote = useMemo(() => {
    if (!selectedIsland || !selectedForecast) return null;
    const samples: RegionBeachWindSample[] = [];
    selectedIsland.beaches.forEach(beach => {
      const beachWind = hourAdjustedBeachForecasts[beach.id]?.wind;
      if (beachWind && Number.isFinite(beachWind.speed)) {
        samples.push({ lat: beach.coordinates.lat, lon: beach.coordinates.lon, windSpeedMs: beachWind.speed });
      }
    });
    return getRegionWindVariationNote(selectedForecast.wind.speed, samples, selectedIsland.coordinates, language);
  }, [selectedIsland, selectedForecast, hourAdjustedBeachForecasts, language]);
  // --- "Κοντά μου" home-region forecasts ------------------------------------------------
  // The synthetic near-me region is anchored on the user's GPS (coordinates: userLoc), so the
  // single area forecast useWeather fetches for it is taken AT THE USER — wrong for a beach
  // 40 km up the coast, and it makes the SAME beach read a different wind/colour than when it
  // is browsed on its home island (there it is scored from the island-centre forecast). To keep
  // a beach identical across both views, near-me scores each beach from ITS OWN home-region area
  // forecast — the same anchor the home-island view uses. Fetched once per contributing region
  // (≤14, Open-Meteo-cached). Every consumer falls back to the existing area forecast, so a
  // normal island — where beach.regionId === selectedIsland.id — is a byte-for-byte no-op.
  const [nearMeRegionForecasts, setNearMeRegionForecasts] = useState<Record<string, DailyForecast[]>>({});

  useEffect(() => {
    if (!isNearMeRegionActive || !selectedIsland) {
      setNearMeRegionForecasts(current => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    const regionIds = Array.from(
      new Set(selectedIsland.beaches.map(beach => beach.regionId).filter((id): id is string => Boolean(id)))
    );
    if (regionIds.length === 0) return;

    let cancelled = false;
    const loadRegionForecasts = async () => {
      const entries = await Promise.all(regionIds.map(async regionId => {
        const center = allIslands.find(island => island.id === regionId)?.coordinates;
        if (!center) return null;
        try {
          const [forecastResult, marineItems] = await Promise.all([
            fetchForecastData(center.lat, center.lon),
            fetchMarineForecastData(center.lat, center.lon).then(result => result.data).catch(() => []),
          ]);
          return [regionId, processForecastData(mergeMarineForecastData(forecastResult.data, marineItems))] as const;
        } catch (error) {
          console.warn('Near-me home-region forecast unavailable; that region\'s beaches fall back to the near-me area forecast.', { regionId, error });
          return null;
        }
      }));
      if (cancelled) return;
      const next: Record<string, DailyForecast[]> = {};
      for (const entry of entries) if (entry) next[entry[0]] = entry[1];
      setNearMeRegionForecasts(next);
    };

    void loadRegionForecasts();
    return () => { cancelled = true; };
  }, [isNearMeRegionActive, selectedIsland, allIslands]);

  // Each near-me beach's home-region area forecast, day-selected + hour-adjusted exactly like
  // selectedForecast, so the near-me card/map reads the same wind/wave/verdict/colour the beach
  // shows on its home island. Empty outside near-me → the area-forecast fallback applies below.
  const nearMeBeachForecastById = useMemo<Record<number, DailyForecast>>(() => {
    if (!isNearMeRegionActive || !selectedIsland) return {};
    const out: Record<number, DailyForecast> = {};
    selectedIsland.beaches.forEach(beach => {
      const days = beach.regionId ? nearMeRegionForecasts[beach.regionId] : undefined;
      const day = days?.[selectedDayIndex];
      if (!day) return;
      out[beach.id] = selectedHourDt == null ? day : adjustDailyForecastToHour(day, selectedHourDt, mapHourSlots);
    });
    return out;
  }, [isNearMeRegionActive, selectedIsland, nearMeRegionForecasts, selectedDayIndex, selectedHourDt, mapHourSlots]);

  // Score every beach ONCE per render with the location-aware inputs, then share
  // the result. Previously getFilteredBeachResults, suitableBeaches and
  // mapSuitableBeaches each re-ran calculateBeachScore (the ~500-line hot path)
  // over the same beaches with the same inputs, so a single slider tick paid for
  // ~3 full scoring passes. This collapses them to one. The inputs mirror exactly
  // what getSuitableBeaches computes internally (weatherForBeach, userLocation,
  // preferences, hourlyForBeach, geospatialProfile) so reuse is behaviour-neutral.
  const beachScoreById = useMemo<Map<number, BeachScore>>(() => {
    const scores = new Map<number, BeachScore>();
    if (!selectedIsland || !deferredSelectedForecast) return scores;
    selectedIsland.beaches.forEach(beach => {
      // Score every beach from the AREA forecast so its displayed Beaufort, wave and verdict
      // are ONE consistent, immediately-available figure — the same on the card and the detail
      // page. For a normal island that AREA forecast is the island's; in "Κοντά μου" it is the
      // beach's OWN home-region forecast (nearMeBeachForecastById), so a beach reads identically
      // whether browsed on its island or in the near-me list, and never off the user's GPS point.
      const beachAreaForecast = nearMeBeachForecastById[beach.id] ?? deferredSelectedForecast;
      scores.set(beach.id, calculateBeachScore(beach, beachAreaForecast, userLocation, preferences, {
        weatherSource: 'island-fallback',
        hourlyForecast: beachAreaForecast.hourly,
        geospatialProfile: geospatialExposureProfiles?.[beach.id],
      }));
    });
    return scores;
  }, [selectedIsland, deferredSelectedForecast, nearMeBeachForecastById, userLocation, preferences, geospatialExposureProfiles]);
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
    const dayLabel = getSelectedDaySentencePrefix(new Date(currentSlot.dt * 1000), athensNow(), language);
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

    const hasBeachSearchQuery = deferredBeachSearchQuery.trim().length > 0;
    let beaches = filterBeachesByUserPreferences(selectedIsland.beaches, preferences);
    const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : WindDirection.N;
    const selectedBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
      const effectiveSortBy = (hasBeachSearchQuery && nextSortBy === 'recommended') || (selectedBeaufort < 4 && nextSortBy === 'recommended') ? 'all' : nextSortBy;

    if (!hasBeachSearchQuery && selectedForecast && effectiveSortBy === 'recommended') {
      const waveHeightM = selectedForecast.marine?.waveHeightM;
      const beachWindSpeedKmph = selectedForecast.wind.speed * 3.6;
      const weatherSuitableBeaches = beaches.filter(beach => {
        const scoreResult = beachScoreById.get(beach.id) ?? calculateBeachScore(beach, selectedForecast, userLocation, preferences, {
          weatherSource: 'island-fallback',
          hourlyForecast: selectedForecast.hourly,
          geospatialProfile: geospatialExposureProfiles?.[beach.id],
        });
        const isExposed = scoreResult.exposureLevel ? scoreResult.exposureLevel !== 'protected' : true;
        const beachWaveHeightM = scoreResult.waveHeightM ?? selectedForecast.marine?.waveHeightM ?? waveHeightM;
        return !hasPoorSeaConditions(isExposed, beachWindSpeedKmph, scoreResult.exposureLevel, beachWaveHeightM);
      });
      beaches = weatherSuitableBeaches.length > 0 ? weatherSuitableBeaches : beaches;
    }

      const result = getFilteredBeaches(beaches, filters, deferredBeachSearchQuery, effectiveSortBy, windDirection, selectedForecast, userLocation, preferences);
    return result;
    }
  ), [beachScoreById, deferredBeachSearchQuery, geospatialExposureProfiles, getFilteredBeaches, preferences, selectedForecast, selectedIsland, userLocation]);

  const filteredBeaches = useMemo(() => (
    getFilteredBeachResults(selectedFilters, sortBy)
  ), [getFilteredBeachResults, selectedFilters, sortBy]);

  useEffect(() => {
    if (!isFilterModalOpen) return;
    setFilterModalResultCount(getFilteredBeachResults(selectedFilters, sortBy).length);
  }, [getFilteredBeachResults, isFilterModalOpen, selectedFilters, sortBy]);

  // Naturist (nudist) beaches are a sensitive category (Miltos 2026-07-21): never surface
  // them in the recommendation / directory / "Κοντά μου" lists. They stay on the map and
  // are findable by an explicit name search or the dedicated "Γυμνιστών" filter (opt-in).
  // This gate is true whenever we are in that default, non-opted-in browsing mode; every
  // recommendation-facing source below strips naturist beaches while it holds.
  const suppressNaturistFromRecommendations = !selectedFilters.includes('naturist') && beachSearchQuery.trim().length === 0;

  const suitableBeaches = useMemo(() => {
    if (!selectedIsland || !deferredSelectedForecast) return [];
    // Pass no per-beach cluster map: the beach's displayed wind/wave/verdict all read from
    // the AREA forecast (reusing beachScoreById, which is now island-scored) so a beach shows
    // the same figure on its card and detail. Cluster stays for the notes/map-hover only.
    const scored = getSuitableBeaches(selectedIsland.beaches, deferredSelectedForecast, language, userLocation, deferredSelectedForecast.hourly, preferences, undefined, geospatialExposureProfiles, beachScoreById);
    return suppressNaturistFromRecommendations ? scored.filter(item => !isNaturistBeach(item.beach)) : scored;
  }, [selectedIsland, deferredSelectedForecast, language, userLocation, preferences, geospatialExposureProfiles, beachScoreById, suppressNaturistFromRecommendations]);

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

      // Score from the AREA forecast — the same one the map arrow/colour and the card headline
      // use — so a beach reads ONE consistent wind/wave/verdict everywhere, available immediately
      // with no flip to a per-beach cluster value on load. Use the urgent selectedForecast (not
      // the deferred beachScoreById) so the score never lags behind a region/hour change. In
      // "Κοντά μου" the AREA forecast is the beach's OWN home-region one so it matches the beach's
      // home-island view (see nearMeBeachForecastById); a normal island falls back to selectedForecast.
      const beachAreaForecast = nearMeBeachForecastById[beach.id] ?? selectedForecast;

      const scoreResult = calculateBeachScore(beach, beachAreaForecast, userLocation, preferences, {
        weatherSource: 'island-fallback',
        hourlyForecast: beachAreaForecast.hourly,
        geospatialProfile: geospatialExposure,
      });

      // Map MARKER COLOUR uses the single area-level wind (the one the compass
      // shows), not the per-beach cluster wind — so on a "SW" day every beach is
      // coloured for that SW wind and the map agrees with the arrow, instead of
      // each coast using its own slightly different local wind direction.
      const islandWindAssessment = assessBeachWindExposure({
        beach,
        geospatialProfile: geospatialExposure,
        windDirectionDeg: beachAreaForecast.wind.deg,
        windDirection: degToCompass(beachAreaForecast.wind.deg),
        windSpeedKmh: beachAreaForecast.wind.speed * 3.6,
        beaufort: getBeaufortLevel(beachAreaForecast.wind.speed * 3.6),
        waveHeightMeters: beachAreaForecast.marine?.waveHeightM,
      });
      const mapExposureLevel = islandWindAssessment.exposureLevel;

      return {
        beachId: beach.id,
        name: displayBeachName(beach.name, language),
        score: scoreResult.score,
        explanation: '',
        beach,
        isExposed: mapExposureLevel ? mapExposureLevel !== 'protected' : true,
        exposureLevel: mapExposureLevel,
        // Marker-colour inputs all come from the island-level assessment so the
        // map re-derivation (getVisibleMapExposureLevel reads windSector) also
        // uses the single island wind, not the per-beach cluster sector.
        orientation: islandWindAssessment.windProfile.beachFacingDirection ?? null,
        windProfile: islandWindAssessment.windProfile,
        windProfileSource: islandWindAssessment.source,
        windSector: islandWindAssessment.windSector,
        // Carry the beach's own scored wind (cluster when loaded, else island) so the
        // directory/list cards derive their Beaufort from the SAME wind as their wave —
        // and match the detail page. Marker colour still uses the island wind above.
        windSpeedKmph: scoreResult.windSpeedKmph,
        waveHeightM: scoreResult.waveHeightM,
        warnings: scoreResult.warnings,
        confidence: scoreResult.confidence,
        swimmingComfort: scoreResult.swimmingComfort,
        canClaimWindProtection: scoreResult.canClaimWindProtection,
        enclosedCove: scoreResult.enclosedCove,
        seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed,
        simpleWindSuitability: scoreResult.simpleWindSuitability,
        windExposureReason: describeSimpleWindSuitability(scoreResult.simpleWindSuitability, language),
        distance,
        geospatialExposure,
      };
    });
  }, [geospatialExposureProfiles, language, nearMeBeachForecastById, preferences, selectedForecast, selectedIsland, userLocation]);

  // mapSuitableBeaches drives BOTH the map (keep every beach, incl. naturist) and, when
  // reused as a recommendation fallback source, the directory/top-pick lists. This variant
  // is the recommendation-safe view: it drops naturist beaches while in default browsing so
  // no fallback path can surface one. The map itself keeps using mapSuitableBeaches.
  const recommendableMapSuitableBeaches = useMemo(
    () => suppressNaturistFromRecommendations ? mapSuitableBeaches.filter(item => !isNaturistBeach(item.beach)) : mapSuitableBeaches,
    [mapSuitableBeaches, suppressNaturistFromRecommendations]
  );

  // Saved beaches (favorites) in the active island, each carrying the SAME scored verdict
  // the home cards show — reuse mapSuitableBeaches, which scores EVERY island beach, so a
  // saved rough beach still appears with its real (low) verdict. Favorites on other,
  // not-currently-loaded islands can't be scored here and are surfaced as an honest count.
  const savedSuitableBeaches = useMemo(
    () => mapSuitableBeaches.filter(item => favorites.includes(item.beach.id)),
    [mapSuitableBeaches, favorites]
  );
  const savedOtherIslandsCount = useMemo(() => {
    const currentIslandBeachIds = new Set((selectedIsland?.beaches ?? []).map(b => b.id));
    return favorites.filter(id => !currentIslandBeachIds.has(id)).length;
  }, [favorites, selectedIsland]);

  const dailySuitableBeaches = useMemo(() => {
    if (!selectedIsland || !deferredSelectedForecast) return [];
    const scored = getSuitableBeaches(selectedIsland.beaches, deferredSelectedForecast, language, undefined, deferredSelectedForecast.hourly, undefined, undefined, geospatialExposureProfiles);
    return suppressNaturistFromRecommendations ? scored.filter(item => !isNaturistBeach(item.beach)) : scored;
  }, [selectedIsland, deferredSelectedForecast, language, geospatialExposureProfiles, suppressNaturistFromRecommendations]);

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
  // The map pins reflect explicit CONTENT filters (search / amenities / preferences) but must
  // NOT be emptied by the sort mode. "Κοντά μου" sets sortBy='protected', which would otherwise
  // flip the map into filtered mode and — for the synthetic near-me region under the suitable
  // sort — drop every pin. Sorting is order, not inclusion, so it is excluded here.
  const hasActiveMapFilters = useMemo(() => (
    beachSearchQuery.trim().length > 0 ||
    selectedFilters.some(filter => filter !== 'showAll') ||
    hasActivePreferenceFilters
  ), [beachSearchQuery, selectedFilters, hasActivePreferenceFilters]);
  const filteredMapSuitableBeaches = useMemo(() => {
    if (!hasActiveMapFilters) return mapSuitableBeaches;

    // Filter by amenity/search matches only (sort 'all' = no suitability exclusion), so the
    // pins never vanish just because the active sort would have hidden "unsuitable" beaches.
    const filteredBeachIds = new Set(getFilteredBeachResults(selectedFilters, 'all').map(beach => beach.id));
    return mapSuitableBeaches.filter(item => filteredBeachIds.has(item.beach.id));
  }, [getFilteredBeachResults, selectedFilters, hasActiveMapFilters, mapSuitableBeaches]);

  // Recommendation-safe view of filteredMapSuitableBeaches: the directory/top-pick sources
  // that read from the filtered map list use THIS one so naturist beaches never appear in a
  // recommendation, while the actual map pins keep using filteredMapSuitableBeaches. When the
  // "Γυμνιστών" filter is active (or a name search is on) the gate is off and both are equal.
  const recommendableFilteredMapSuitableBeaches = useMemo(
    () => suppressNaturistFromRecommendations ? filteredMapSuitableBeaches.filter(item => !isNaturistBeach(item.beach)) : filteredMapSuitableBeaches,
    [filteredMapSuitableBeaches, suppressNaturistFromRecommendations]
  );

  // When the user name-searches a specific beach we want the map to actually
  // re-center on the match. Amenity/preference filters keep the whole-island fit so
  // toggling a filter doesn't yank the viewport away from where the user is looking.
  const isBeachNameSearchActive = deferredBeachSearchQuery.trim().length > 0;
  const mapFitBoundsBeaches = isBeachNameSearchActive ? filteredMapSuitableBeaches : mapSuitableBeaches;
  // A name search narrows filteredMapSuitableBeaches down to the matched beach(es), which is
  // right for *centering* the directory map (mapFitBoundsBeaches above). But it must NOT strip
  // the other pins: the result cards still list other beaches, and when the user scrolls them
  // the HighlightedBeachFollower can only pan to a beach that exists in the map's `beaches`
  // set — with the set reduced to the match it stayed stuck on the searched beach instead of
  // following the card scrolled into view. So keep every island pin on the directory map
  // during a name search (the map still opens centred on the match via mapFitBoundsBeaches).
  // Amenity/preference filters still narrow the pins as before.
  const directoryMapPinBeaches = isBeachNameSearchActive ? mapSuitableBeaches : filteredMapSuitableBeaches;
  const mapFitBoundsKey = useMemo(() => {
    if (!selectedIsland) return undefined;
    if (!isBeachNameSearchActive) return String(selectedIsland.id);
    // Re-fit whenever the matched set changes (incl. a different single match), so
    // searching a beach pans/centres onto it instead of staying on the island view.
    const matchSignature = filteredMapSuitableBeaches
      .map(item => item.beachId)
      .sort((a, b) => a - b)
      .join('-');
    return `${selectedIsland.id}:q:${matchSignature}`;
  }, [selectedIsland, isBeachNameSearchActive, filteredMapSuitableBeaches]);
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
  const topRecommendedSuitableBeaches = useMemo(() => {
    // Day-to-day variety: on calm days, rotate #2/#3 among beaches that are genuinely
    // equally-good today (keeps #1 fixed, never surfaces a harder-to-reach or worse
    // beach). Seeded by island + calendar date so it is stable within a day and changes
    // across days. Runs AFTER prioritizeDynamicTopPickWindows so the shown #1 is honoured.
    const beaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
    const varied = rotateEquivalentTopPicks(recommendedSuitableBeaches, {
      beaufort,
      dateKey: selectedForecast ? wallClockDayKey(selectedForecast.date) : '',
      regionKey: String(selectedIsland?.id ?? ''),
    });
    return varied.slice(0, getTopRecommendationDisplayLimit(varied.length));
  }, [recommendedSuitableBeaches, selectedForecast, selectedIsland]);
  const currentBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : 0;
  const isSevereWindNoTopRecommendationDay = currentBeaufort > MAX_TOP_RECOMMENDATION_BEAUFORT;
  // The canonical map-marker exposure level per beach, exactly as the region map
  // colours it (single island wind + neighbour consistency pass). Threaded into the
  // detail map so a beach's pin is the same colour there instead of being re-derived
  // from the per-beach cluster wind, which can land on a different colour.
  const canonicalMapExposureLevels = useMemo<Map<number, ExposureLevel>>(() => {
    if (!selectedForecast) return new Map();
    return getConsistentVisibleMapExposureLevels(mapSuitableBeaches, currentBeaufort, selectedForecast.wind.deg);
  }, [mapSuitableBeaches, currentBeaufort, selectedForecast]);
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

    // Faceted, dynamic counts: each chip shows how many island beaches match the CURRENT
    // selection (active preferences + advanced filters) WITH this attribute added. Computed
    // over the WHOLE island (not the wind-filtered/today set), so the numbers narrow as you
    // pick filters — without the old misleading drop to "1" from an unrelated subset. With no
    // filters active this reduces to the plain per-attribute island total.
    const activeAdvancedFilters = selectedFilters.filter(filter => filter !== 'showAll' && filter !== 'restaurant');
    return QUICK_PREFERENCE_FILTERS.reduce((counts, key) => {
      const candidatePreferences = { ...preferences, [key]: true };
      const preferenceMatched = filterBeachesByUserPreferences(selectedIsland.beaches, candidatePreferences);
      counts[key] = getFilteredBeaches(preferenceMatched, activeAdvancedFilters, '', 'all', WindDirection.N).length;
      return counts;
    }, {} as Partial<Record<keyof UserPreferences, number>>);
  }, [getFilteredBeaches, preferences, selectedFilters, selectedIsland]);
  const desktopAdvancedFilterResultCounts = useMemo(() => {
    if (!selectedIsland || selectedIsland.beaches.length === 0) {
      return {} as Partial<Record<FilterKey, number>>;
    }

    const desktopAdvancedFilterKeys: FilterKey[] = [
      'naturalShade',
      'taverna',
      'sunbeds',
      'parking',
      'shower',
      'sandy-pebbles',
      'rocky',
      'adventure',
    ];

    // Faceted, dynamic counts (see preferenceFilterResultCounts): each chip = island beaches
    // matching the active preferences + active advanced filters + this filter. Narrows as the
    // selection grows; computed over the whole island, and reduces to the per-attribute total
    // when nothing else is selected.
    const preferenceMatched = filterBeachesByUserPreferences(selectedIsland.beaches, preferences);
    const activeAdvancedFilters = selectedFilters.filter(filter => filter !== 'showAll' && filter !== 'restaurant');
    return desktopAdvancedFilterKeys.reduce((counts, key) => {
      // Adding an already-active key again is a no-op for filtering (idempotent), so we don't
      // need to dedupe — keeps the type simple (FilterKey[]).
      const combinedFilters: FilterKey[] = [...activeAdvancedFilters, key];
      counts[key] = getFilteredBeaches(preferenceMatched, combinedFilters, '', 'all', WindDirection.N).length;
      return counts;
    }, {} as Partial<Record<FilterKey, number>>);
  }, [getFilteredBeaches, preferences, selectedFilters, selectedIsland]);
  const mobileFilterKeys = useMemo(() => (
    Object.keys(t.filterOptions)
      .filter(key => key !== 'showAll' && key !== 'restaurant' && key !== 'unknown' && key !== 'organized') as FilterKey[]
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
  // Info-only regions (e.g. Milos): pages exist and beaches are browsable, but the
  // region page hides the interactive map and the today-recommendation ranking.
  const isInfoOnlyRegion = isInfoOnlyRegionId(selectedIsland?.id);
  // Don't show the loading skeleton for the stale-block state — that never resolves. The
  // dedicated "conditions unavailable" banner (below) handles it instead.
  const isWaitingForForecast = Boolean(selectedIsland && !selectedForecast && !weatherError && !isUnsafeWinter && !isStaleBlocked);
  const handleMobileMapDaySelect = React.useCallback((index: number) => {
    if (index === selectedDayIndex) return;

    setSelectedDayIndex(index);
    trackEvent('forecast_day_selected', undefined, {
      ...analyticsBaseParams,
      source: 'mobile_map_day_strip',
      day_index: index,
    });
  }, [analyticsBaseParams, selectedDayIndex, setSelectedDayIndex]);
  const mobileMapDayStrip = useMemo(() => {
    if (!forecast || forecast.length <= 1) return null;

    const locale = t.locale || languageToLocale(language);
    const dateFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    const stripLabel = getLocalizedCopy(language, {
      en: 'Map forecast days',
      gr: 'Ημέρες πρόγνωσης χάρτη',
      fr: 'Jours de prévision de la carte',
      de: 'Kartenvorhersage-Tage',
      it: 'Giorni previsione mappa',
    });

    return (
      <div
        className="relative z-10 sm:hidden rounded-[1.1rem] border border-sky-100 bg-white/90 p-1.5 shadow-sm shadow-sky-900/5 backdrop-blur-xl"
        data-testid="mobile-map-day-strip"
      >
        <div
          className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label={stripLabel}
        >
          {forecast.slice(0, MOBILE_MAP_DAY_LIMIT).map((day, index) => {
            const dayLabel = getMobileMapDayLabel(day.date, language, t, topPickNow);
            const beaufort = getBeaufortLevel(day.wind.speed * 3.6);
            const isSelected = selectedDayIndex === index;
            const weatherIconUrl = `https://openweathermap.org/img/wn/${day.weather.icon}@2x.png`;
            const buttonLabel = `${t.forecastFor} ${dayLabel}, ${dateFormatter.format(day.date)}: ${Math.round(day.temp_max)}°C, ${beaufort} ${t.units.beaufort}, ${day.weather.description}`;

            return (
              <button
                key={day.date.toISOString()}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={buttonLabel}
                onClick={() => handleMobileMapDaySelect(index)}
                data-testid="mobile-map-day-tab"
                className={`relative z-10 flex min-h-12 min-w-[4.25rem] flex-1 cursor-pointer touch-manipulation select-none flex-col items-center justify-center rounded-2xl border px-1.5 py-1 text-center transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'border-[#007a83] bg-cyan-50 text-[#006b73] shadow-sm shadow-cyan-900/10 ring-1 ring-cyan-100'
                    : 'border-sky-100 bg-white/88 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/70'
                }`}
              >
                <span className={`max-w-full truncate text-[10px] font-extrabold leading-tight ${isSelected ? 'text-[#006b73]' : 'text-slate-700'}`}>
                  {dayLabel}
                </span>
                <span className="mt-0.5 flex max-w-full items-center justify-center gap-0.5 leading-none">
                  <img
                    src={weatherIconUrl}
                    alt=""
                    width={24}
                    height={24}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="h-5 w-5 shrink-0 drop-shadow-sm"
                  />
                  <span className="truncate text-[10px] font-black tabular-nums text-slate-900">
                    {beaufort} {t.units.beaufort}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }, [forecast, handleMobileMapDaySelect, language, selectedDayIndex, t, topPickNow]);

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
    // Consent-free first-party count for this in-app navigation (GA above is
    // consent-gated). `view` is a coarse page kind, never identifying.
    // The national landing and a region home are BOTH view==='home', which made
    // them indistinguishable in the traffic dashboard — tag the landing so its
    // reach (and drop-off to a region) is actually measurable.
    recordPageview(showLanding ? 'landing' : (view || 'page'));
  }, [analyticsBaseParams, detailBeach?.id, selectedIsland, showLanding, view]);

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
      top_shelter_level: topRecommendedSuitableBeaches[0].beach?.windProfile?.shelterLevel ?? 'unknown',
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
      : [...recommendableMapSuitableBeaches].sort((a, b) => b.score - a.score);
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
  }, [currentBeaufort, dailySuitableBeaches, isStrongRecommendationMode, recommendableMapSuitableBeaches, recommendedSuitableBeaches, selectedBeachForecasts, selectedForecast, topPickNow]);
  const noIdealFallbackCandidates = useMemo(() => {
    if (!hasNoSwimmableBeachesToday || !isStrongRecommendationMode || !selectedForecast) return [];

    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    const rankedFallback = [...recommendableMapSuitableBeaches]
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
  }, [currentBeaufort, hasNoSwimmableBeachesToday, isStrongRecommendationMode, recommendableMapSuitableBeaches, selectedBeachForecasts, selectedForecast, topPickNow]);
  const windPreviewCandidates = useMemo(() => {
    if (!isStrongRecommendationMode || !selectedForecast) return [];
    if (strongSuitableCandidates.length > 0) return strongSuitableCandidates;

    const fallbackSource = recommendedSuitableBeaches.length > 0
      ? recommendedSuitableBeaches
      : dailySuitableBeaches.length > 0
      ? dailySuitableBeaches
      : [...recommendableMapSuitableBeaches].sort((a, b) => b.score - a.score);
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
  }, [currentBeaufort, dailySuitableBeaches, isStrongRecommendationMode, recommendableMapSuitableBeaches, recommendedSuitableBeaches, selectedBeachForecasts, selectedForecast, strongSuitableCandidates, topPickNow]);
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
        enclosedCove: context.enclosedCove,
        seaCalmClaimAllowed: context.seaCalmClaimAllowed,
        windSpeedKmph: context.windSpeedKmph,
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
        enclosedCove: context.enclosedCove,
        seaCalmClaimAllowed: context.seaCalmClaimAllowed,
        windSpeedKmph: context.windSpeedKmph,
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
      enclosedCove: item.enclosedCove,
      seaCalmClaimAllowed: item.seaCalmClaimAllowed,
      windSpeedKmph: item.windSpeedKmph,
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
      enclosedCove: item.enclosedCove,
      seaCalmClaimAllowed: item.seaCalmClaimAllowed,
      windSpeedKmph: item.windSpeedKmph,
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
    const viewportScoped = (!isDesktopMapViewportFilterActive || !desktopMapVisibleBeachIdSet)
      ? beachListBaseBeaches
      : beachListBaseBeaches.filter(beach => desktopMapVisibleBeachIdSet.has(beach.id));
    // Directory/explore list: strip naturist beaches in default browsing (kept on the map and
    // reachable via the "Γυμνιστών" filter or a name search — see suppressNaturistFromRecommendations).
    return suppressNaturistFromRecommendations
      ? viewportScoped.filter(beach => !isNaturistBeach(beach))
      : viewportScoped;
  }, [beachListBaseBeaches, desktopMapVisibleBeachIdSet, isDesktopMapViewportFilterActive, suppressNaturistFromRecommendations]);
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
        score: beachWithDistance.todayScore ?? Math.max(0, Math.min(100, Math.round(getBeachPopularityRating(beach) * 20))),
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
    // Count only — omit weather so getFilteredBeaches skips per-beach scoring.
    // How many beaches pass the filters/search is weather-independent (scoring
    // only reorders/annotates), so these counts are identical but far cheaper.
    const allCount = getFilteredBeaches(
      baseBeaches,
      selectedFilters,
      deferredBeachSearchQuery,
      'all',
      windDirection
    ).length;
    const hasOnlySortControls =
      deferredBeachSearchQuery.trim().length === 0 &&
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
        deferredBeachSearchQuery,
        'protected',
        windDirection
      ).length;

    return { all: allCount, protected: protectedCount } as Partial<Record<SortOption, number>>;
  }, [
    deferredBeachSearchQuery,
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
      recommendableFilteredMapSuitableBeaches,
      currentBeaufort,
      selectedForecast.wind.deg
    );

    return recommendableFilteredMapSuitableBeaches
      .filter(item => visibleExposureLevels.get(item.beach.id) === 'protected')
      .sort((a, b) => (
        compareTouristTopPickPriority(a, b) || b.score - a.score
      ));
  }, [currentBeaufort, recommendableFilteredMapSuitableBeaches, selectedForecast]);
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
          beachId: beach.id,
          beachName: beach.name,
          beachRating: getBeachPopularityRating(beach),
          aliases: beach.aliases,
          legacySlugs: (beach as Beach & { legacySlugs?: string[] }).legacySlugs,
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

  if (beachesLoading) return showInitialBeachLoader ? <SkeletonLoader t={t} /> : null;
  if (beachesError) return <ErrorDisplay message={beachesError} onRetry={() => window.location.reload()} t={t} />;

  // When the forecast is stale-blocked, `forecast` is null but the stale day is still held in
  // `rawForecast` — render the detail page from it purely for STRUCTURE, and pass
  // conditionsUnavailable so every wind/sea/score block is blanked (never shows stale colours).
  // This keeps the user ON the beach page (static content + banner) instead of bouncing home.
  const staleDetailForecastDay = isStaleBlocked && forecastMatchesRegion ? rawForecast?.[selectedDayIndex] : undefined;
  const detailForecastDay = forecast?.[selectedDayIndex] ?? staleDetailForecastDay;
  if (view === 'detail' && detailBeach && detailForecastDay) {
    // Pass the area-wide selected-day forecast as the detail fallback. The detail
    // page upgrades to the beach-specific cluster forecast when available, matching
    // the search/result card score while preserving this forecast for map fallback.
    // IMPORTANT: use the HOUR-ADJUSTED selectedForecast (what the slider/region map show), not
    // the raw day forecast — otherwise the detail mini-map tones the canonical exposure level
    // with the day's Beaufort while the region map used the slider hour's, so the same beach
    // reads e.g. orange in the detail map but yellow on the region map.
    // In "Κοντά μου" the card/map score this beach from its OWN home-region forecast
    // (nearMeBeachForecastById); the detail must use the SAME one or the card and the detail
    // would disagree — so prefer it here too, falling back to the near-me area forecast.
    const detailForecast = (isNearMeRegionActive ? nearMeBeachForecastById[detailBeach.id] : undefined) ?? selectedForecast ?? detailForecastDay;

    return (
      <div>
        <Suspense fallback={<SkeletonLoader t={t} />}>
          <BeachDetailPage
            beach={detailBeach} allBeaches={selectedIsland?.beaches || []}
            dayForecast={detailForecast} hourlyForecast={detailForecast.hourly} language={language} t={t}
            onBack={closeBeachDetails} onBeachClick={(b) => openBeachDetails(b, 'nearby_detail')}
            userLocation={userLocation} favorites={favorites} onToggleFavorite={handleToggleFavorite}
            preferences={preferences}
            islandName={selectedIsland?.name[language]}
            regionId={isNearMeRegionActive ? undefined : selectedIsland?.id}
            detailDataStatus={detailDataStatus}
            beachWeatherById={detailBeachWeatherById}
            selectedHour={selectedHourDt != null ? new Date(selectedHourDt * 1000).getHours() : undefined}
            geospatialExposureProfiles={geospatialExposureProfiles}
            weatherSource="island-fallback"
            mapExposureLevelOverride={canonicalMapExposureLevels.get(detailBeach.id)}
            conditionsUnavailable={isStaleBlocked}
            lastForecastAt={lastUpdated}
          />
        </Suspense>
      </div>
    );
  }

  if (mobileTab === 'favorites') {
    return (
      <SavedBeachesScreen
        language={language}
        t={t}
        items={savedSuitableBeaches}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onOpenBeach={(b) => openBeachDetails(b, 'saved_screen')}
        onClose={() => handleMobileTab('home')}
        selectedDate={selectedForecast?.date}
        selectedHour={selectedHourDt != null ? new Date(selectedHourDt * 1000).getHours() : undefined}
        windSpeed={selectedForecast?.wind.speed ?? forecast?.[selectedDayIndex]?.wind.speed}
        temperature={forecast?.[selectedDayIndex]?.temp_max}
        islandName={selectedIsland?.name[language] ?? ''}
        regionId={isNearMeRegionActive ? undefined : selectedIsland?.id}
        otherIslandsCount={savedOtherIslandsCount}
      />
    );
  }

  const selectedIslandKey = selectedIsland?.name.en?.toLowerCase().replace(/[^a-z]/g, '') || '';
  // Islands that show the homepage context strip suppress the full-bleed island
  // background so the same island photo is not rendered twice (strip + backdrop).
  const islandBackground = islandHasContextStrip(selectedIsland?.id)
    ? undefined
    : ISLAND_BACKGROUND_IMAGES[selectedIslandKey];
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
  const protectedSortDay = getSelectedDayPrefix(selectedForecast?.date, athensNow(), language);
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
        title: 'Aucune option adaptée trouvée.',
        body: `Avec les données disponibles, il n’y a pas d’option clairement adaptée à une baignade calme ${protectedSortDay}. Essaie un autre tri pour voir toutes les plages avec leurs avertissements.`,
      },
      de: {
        title: 'Keine geeigneten Optionen gefunden.',
        body: `Mit den verfügbaren Daten gibt es keine klar ruhige Badeoption ${protectedSortDay}. Nutze eine andere Sortierung, um alle Strände mit Warnhinweisen zu sehen.`,
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
      selectedForecast.date
    )
    : recommendationModeCopy.helper[language];
  const selectedDayDate = selectedForecast?.date;
  const recommendationModeTitle = (() => {
    const day = getSelectedDayPrefix(selectedDayDate, athensNow(), language);
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
      sheltered: `Πιο προστατευμένες επιλογές ${day}`,
      noIdeal: `Δεν υπάρχει καθαρή επιλογή για ήρεμο μπάνιο ${day}`,
      },
      fr: {
        caution: `Options plus confortables ${day}`,
        strong: `Options les plus adaptées ${day}`,
        sheltered: `Options plus abritées ${day}`,
        noIdeal: `Aucun choix clairement calme ${day}`,
      },
      de: {
        caution: `Komfortablere Optionen ${day}`,
        strong: `Am besten geeignete Optionen ${day}`,
        sheltered: `Windgeschütztere Optionen ${day}`,
        noIdeal: `Keine klar ruhige Badeoption ${day}`,
      },
      it: {
        caution: `Opzioni più comode ${day}`,
        strong: `Opzioni più adatte ${day}`,
        sheltered: `Opzioni più riparate ${day}`,
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
  const selectedDayPrefix = getSelectedDayPrefix(selectedDayDate, athensNow(), language);
  const selectedDaySentencePrefix = getSelectedDaySentencePrefix(selectedDayDate, athensNow(), language);
  const hourlyWindIncreaseCopy = currentBeaufort <= 3 && hourlyWindIncreaseSummary.hasIncrease
    ? getLocalizedCopy(language, {
      en: `Later the wind rises to ${hourlyWindIncreaseSummary.maxBeaufort} Beaufort around ${hourlyWindIncreaseSummary.label}, so some beaches will feel more comfortable than others.`,
      gr: `Αργότερα ο άνεμος ανεβαίνει έως ${hourlyWindIncreaseSummary.maxBeaufort} μποφόρ γύρω στις ${hourlyWindIncreaseSummary.label}, οπότε κάποιες παραλίες θα είναι πιο άνετες από άλλες.`,
      fr: `Plus tard, le vent monte jusqu’à ${hourlyWindIncreaseSummary.maxBeaufort} Bft vers ${hourlyWindIncreaseSummary.label}, donc certaines plages seront plus confortables que d’autres.`,
      de: `Später steigt der Wind gegen ${hourlyWindIncreaseSummary.label} auf ${hourlyWindIncreaseSummary.maxBeaufort} Bft, daher fühlen sich manche Strände komfortabler an als andere.`,
      it: `Più tardi il vento sale fino a ${hourlyWindIncreaseSummary.maxBeaufort} Beaufort verso ${hourlyWindIncreaseSummary.label}, quindi alcune spiagge saranno più comode di altre.`,
    })
    : '';
  const calmSummaryBaseDescription = calmAllAroundSummary
    ? calmAllAroundSummary.hasNormalLightWindBeachDay
      ? getLocalizedCopy(language, {
        en: `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. All beaches are suitable for swimming.`,
      gr: `${calmAllAroundSummary.beaufort} μποφόρ ${selectedDayPrefix}. Όλες οι παραλίες είναι κατάλληλες για μπάνιο.`,
        fr: `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. Toutes les plages sont adaptées à la baignade.`,
        de: `${calmAllAroundSummary.beaufort} Bft ${selectedDayPrefix}. Alle Strände sind zum Schwimmen geeignet.`,
        it: `${calmAllAroundSummary.beaufort} Beaufort ${selectedDayPrefix}. Tutte le spiagge sono adatte al bagno.`,
      })
      : getLocalizedCopy(language, {
        en: `${selectedDaySentencePrefix} the weather is mild, so ${calmAllAroundSummary.isEveryBeachSuitable ? 'all beaches' : 'most beaches'} look suitable for swimming.`,
      gr: `${selectedDaySentencePrefix} ο καιρός είναι ήπιος, οπότε ${calmAllAroundSummary.isEveryBeachSuitable ? 'όλες οι παραλίες' : 'οι περισσότερες παραλίες'} φαίνονται κατάλληλες για μπάνιο.`,
        fr: `${selectedDaySentencePrefix}, la météo est douce, donc ${calmAllAroundSummary.isEveryBeachSuitable ? 'toutes les plages' : 'la plupart des plages'} semblent adaptées à la baignade.`,
        de: `${selectedDaySentencePrefix} ist das Wetter mild, daher wirken ${calmAllAroundSummary.isEveryBeachSuitable ? 'alle Strände' : 'die meisten Strände'} zum Schwimmen geeignet.`,
        it: `${selectedDaySentencePrefix} il meteo è mite, quindi ${calmAllAroundSummary.isEveryBeachSuitable ? 'tutte le spiagge' : 'la maggior parte delle spiagge'} sembra adatta al bagno.`,
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
      avoid: `Δεν υπάρχει ιδανική επιλογή για ήρεμο μπάνιο ${selectedDayPrefix}. Η παραλία ${beachSentenceName(headerTopBeachName, 'gr')} είναι καλύτερη μόνο ως επιλογή επίσκεψης, αν οι συνθήκες φαίνονται αποδεκτές όταν φτάσεις.`,
      strongFive: `Η παραλία ${beachSentenceName(headerTopBeachName, 'gr')} είναι καλύτερη επιλογή για τον άνεμο ${selectedDayPrefix}.`,
      strongCaution: `Η παραλία ${beachSentenceName(headerTopBeachName, 'gr')} είναι η καλύτερη διαθέσιμη επιλογή ${selectedDayPrefix}, αλλά οι συνθήκες θέλουν προσοχή.`,
      caution: `Η παραλία ${beachSentenceName(headerTopBeachName, 'gr')} είναι η καλύτερη πρόταση για ${selectedDayPrefix}, γιατί ο άνεμος μπορεί να είναι λιγότερο ενοχλητικός εκεί.`,
      timed: `Με βάση την ωριαία πρόγνωση, η παραλία ${beachSentenceName(headerTopBeachName, 'gr')} είναι η κορυφαία επιλογή για αυτό το χρονικό παράθυρο.`,
      mild: `${selectedDaySentencePrefix} ο καιρός είναι ήπιος, οπότε οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`,
      },
      fr: {
        avoid: `Aucune plage ne semble idéale pour une baignade calme ${selectedDayPrefix}. ${headerTopBeachName} est plutôt une option de visite si les conditions semblent acceptables sur place.`,
        strongFive: `${headerTopBeachName} est une meilleure option face au vent ${selectedDayPrefix}.`,
        strongCaution: `${headerTopBeachName} est la meilleure option disponible ${selectedDayPrefix}, mais la baignade demande encore de la prudence.`,
        caution: `${headerTopBeachName} est le meilleur choix ${selectedDayPrefix}, car le vent semble plus facile à gérer là-bas.`,
      timed: `D’après la prévision horaire, ${headerTopBeachName} est le meilleur choix pour ce créneau.`,
        mild: `${selectedDaySentencePrefix}, la météo est douce, donc la plupart des plages semblent adaptées à la baignade.`,
      },
      de: {
        avoid: `Kein Strand wirkt ${selectedDayPrefix} ideal für ruhiges Schwimmen. ${headerTopBeachName} ist eher eine Besuchsoption, wenn die Bedingungen vor Ort akzeptabel wirken.`,
        strongFive: `${headerTopBeachName} ist ${selectedDayPrefix} eine bessere Windoption.`,
        strongCaution: `${headerTopBeachName} ist ${selectedDayPrefix} die beste verfügbare Option, aber Schwimmen bleibt vorsichtig zu bewerten.`,
        caution: `${headerTopBeachName} ist ${selectedDayPrefix} die beste Wahl, weil der Wind dort besser handhabbar wirkt.`,
        timed: `Laut stündlicher Vorhersage ist ${headerTopBeachName} die Top-Wahl für dieses Zeitfenster.`,
        mild: `${selectedDaySentencePrefix} ist das Wetter mild, daher wirken die meisten Strände zum Schwimmen geeignet.`,
      },
      it: {
        avoid: `Nessuna spiaggia sembra ideale per un bagno calmo ${selectedDayPrefix}. ${headerTopBeachName} è più una visita, se le condizioni sul posto sembrano accettabili.`,
        strongFive: `${headerTopBeachName} è una scelta migliore per il vento ${selectedDayPrefix}.`,
        strongCaution: `${headerTopBeachName} è la migliore opzione disponibile ${selectedDayPrefix}, ma per il bagno serve ancora prudenza.`,
        caution: `${headerTopBeachName} è la scelta migliore ${selectedDayPrefix}, perché lì il vento sembra più gestibile.`,
        timed: `In base alle previsioni orarie, ${headerTopBeachName} è la scelta migliore per questa fascia.`,
        mild: `${selectedDaySentencePrefix} il meteo è mite, quindi la maggior parte delle spiagge sembra adatta al bagno.`,
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
  // The rain caveat used to be appended here; it now has its own alert at the top
  // of the home, so the top-pick description stays about the beach itself and the
  // same sentence is not printed twice on one screen.
  const headerTopDescription = headerTopDescriptionBase;
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
      recommendableMapSuitableBeaches.filter(item => isTrustedTopRecommendationCandidate(item, undefined, currentBeaufort)),
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
  // The standalone "★ Top choice" hero is a highest-priority/best-conditions pick, not a
  // nearest one, so it must not headline "Κοντά μου": proximity leads there, and the
  // distance-sorted podium + suitable list already surface the nearest beaches. (It only
  // ever showed here when no beach qualified for the podium, i.e. a farther beach would
  // have taken the #1 hero slot over the one right next to the user.)
  const displayedDirectoryTopBeach = shouldDisplayDirectoryTopPick && !isNearMeRegionActive ? directoryTopBeach : null;
  const directoryBaseBeachCardSource = (() => {
    if (sortBy === 'distance') {
      return distanceSortedDirectoryBeachCards;
    }

    if (isCalmAllSuitable) {
      return [...recommendableFilteredMapSuitableBeaches].sort((a, b) => (
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
    // In "Κοντά μου" the podium must be the NEAREST qualifying beaches. The display
    // limit therefore can't be applied while collecting in score order: that lets the
    // highest-scoring beaches across the whole radius fill the podium and pushes a
    // closer, still-qualifying beach off it entirely (it only reappears far down the
    // distance-sorted list). A plain final reorder of an already score-limited set
    // can't put back a beach the limit removed — so for near-me collect EVERY
    // qualifying candidate, then distance-sort and slice.
    const collectLimit = isNearMeRegionActive ? Infinity : directoryTopRecommendationLimit;
    const addSource = (source: SuitableBeach[]) => {
      source.forEach(item => {
        if (cards.length >= collectLimit || seenIds.has(item.beach.id)) return;
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

    // In "Κοντά μου" the podium leads with the nearest beaches, not the highest-scoring
    // ones across the merged radius (a 35 km high-scorer should never sit above a closer
    // pick). Distance-sort the full qualifying set, then apply the display limit so the
    // podium is genuinely the nearest qualifying beaches.
    if (isNearMeRegionActive) {
      return [...cards]
        .sort((a, b) => (
          (typeof a.distance === 'number' ? a.distance : Infinity) -
          (typeof b.distance === 'number' ? b.distance : Infinity)
        ))
        .slice(0, directoryTopRecommendationLimit);
    }

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
  // Miltos 2026-06-19: at strong wind (≥5 Bft) a boat-only beach (e.g. Κλεφτικό)
  // isn't a real option for the day — the boats don't run and you can't drive there —
  // so it must not appear in the recommended/explore or "Κοντά μου" lists with such
  // weather. We drop boat-access beaches here only; they stay on the map and remain
  // findable by an explicit name search (kept whenever the user is actually searching).
  const shouldHideBoatAccessBeaches = currentBeaufort >= PROTECTED_FIRST_BEAUFORT && beachSearchQuery.trim().length === 0;
  const recommendableDirectorySuitableBeachCards = shouldHideBoatAccessBeaches
    ? directorySuitableBeachCards.filter(item => !hasBoatOnlyAccess(item.beach))
    : directorySuitableBeachCards;
  // Guarantee a distance on every suitable card when the user's location is
  // known (some source pipelines, e.g. calm-wind days, don't carry it), so the
  // "Κοντά μου" distance sort always has a value to order by.
  const directoryHomeSuitableBeachCards = (() => {
    if (!userLocation) return recommendableDirectorySuitableBeachCards;
    const withDistance = recommendableDirectorySuitableBeachCards.map(item => (
      typeof item.distance === 'number' && Number.isFinite(item.distance)
        ? item
        : {
            ...item,
            distance: calculateDistance(userLocation.lat, userLocation.lon, item.beach.coordinates.lat, item.beach.coordinates.lon),
          }
    ));
    // "Κοντά μου": proximity is the whole point, so order strictly by distance — the
    // nearest beaches must always lead, regardless of the score-based source order or
    // whether the mobile distance-sort toggle happens to be on at render. (In a normal
    // region the score order is kept; the in-component distance sort still applies when
    // the user picks "sort by distance".)
    if (!isNearMeRegionActive) return withDistance;
    return [...withDistance].sort((a, b) => (
      (typeof a.distance === 'number' ? a.distance : Infinity) -
      (typeof b.distance === 'number' ? b.distance : Infinity)
    ));
  })();
  const directorySuitableBeachTotalCount = directoryHomeSuitableBeachCards.length;
  const shouldShowDirectorySuitableSection = shouldShowDirectoryTopRecommendations
    ? !shouldShowAllBeachesBelowTopRecommendations && directoryHomeSuitableBeachCards.length > 0
    : !(calmAllAroundSummary?.isEveryBeachSuitable ?? false);
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

    // A separate "top pick" hero is only shown when there are no active filters/search
    // (see shouldDisplayDirectoryTopPick). When it's shown, the suitable list excludes that
    // beach — but with filters active there is no hero, so every suitable beach is listed.
    // Only drop the top beach in the no-filters case, otherwise the modal promised one fewer
    // than the list actually shows.
    const hasActiveContext = normalizedFilters.some(filter => filter !== 'showAll')
      || beachSearchQuery.trim().length > 0;
    const ranked = hasActiveContext
      ? sorted
      : sorted.filter(item => item.beach.id !== topBeachId);

    return ranked.slice(0, 16).length;
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
      gr: `Η παραλία ${beachSentenceName(directoryTopBeachName, 'gr')} είναι η καλύτερη πρόταση για ${selectedDayPrefix}, γιατί ο άνεμος μπορεί να είναι λιγότερο ενοχλητικός εκεί και η πρόσβαση είναι πρακτική.`,
        fr: `${directoryTopBeachName} est le meilleur choix ${selectedDayPrefix}, car le vent peut y être moins gênant, avec un accès pratique.`,
        de: `${directoryTopBeachName} ist ${selectedDayPrefix} die beste Wahl, weil der Wind dort weniger störend sein kann und der Zugang praktisch ist.`,
        it: `${directoryTopBeachName} è la scelta migliore ${selectedDayPrefix}, perché lì il vento può essere meno fastidioso e l’accesso è pratico.`,
      })
      : getLocalizedCopy(language, {
        en: `${directoryTopBeachName} is the best pick ${selectedDayPrefix} because it fits the conditions well and combines comfortable sea with practical access.`,
      gr: `Η παραλία ${beachSentenceName(directoryTopBeachName, 'gr')} είναι η καλύτερη πρόταση για ${selectedDayPrefix}, γιατί ταιριάζει καλά στις συνθήκες και συνδυάζει άνετη θάλασσα με πρακτική πρόσβαση.`,
        fr: `${directoryTopBeachName} est le meilleur choix ${selectedDayPrefix}, car elle correspond bien aux conditions et combine mer agréable et accès pratique.`,
        de: `${directoryTopBeachName} ist ${selectedDayPrefix} die beste Wahl, weil sie gut zu den Bedingungen passt und angenehmes Meer mit praktischem Zugang verbindet.`,
        it: `${directoryTopBeachName} è la scelta migliore ${selectedDayPrefix}, perché si adatta bene alle condizioni e combina mare piacevole con accesso pratico.`,
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
    const rankedMatches = selectableIslands
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

  const getBeachSearchValuesFromParts = (
    name: Beach['name'],
    aliases: string[] | undefined,
    legacySlugs: string[] | undefined,
    island: Island,
    extraRegionValues: Array<string | undefined> = []
  ): string[] => {
    const regionValues = [
      ...getIslandSearchValues(island),
      ...extraRegionValues,
    ].filter((value): value is string => Boolean(value));
      const genericAliasValues = ['paralia', 'παραλία', 'beach', 'plage', 'strand', 'spiaggia', ...regionValues];
    const genericAliasVariants = new Set(genericAliasValues.flatMap(getSearchVariants));
    const isGenericAlias = (value: string): boolean => {
      const variants = getSearchVariants(value);
      return variants.length > 0 && variants.every(variant => genericAliasVariants.has(variant));
    };
    const values = [
      name[language],
      name.en,
      name.gr,
      name.fr,
      name.de,
      name.it,
      displayBeachName(name, language),
      displayBeachName(name, 'gr'),
      ...(aliases || []).filter(alias => !isGenericAlias(alias)),
      ...(legacySlugs || []),
    ];

    return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
  };

  const getBeachSearchValues = (beach: Beach, island: Island): string[] => (
    getBeachSearchValuesFromParts(
      beach.name,
      beach.aliases,
      (beach as Beach & { legacySlugs?: string[] }).legacySlugs,
      island,
      [beach.location?.island, beach.location?.region]
    )
  );

  const getGlobalBeachSearchIndex = async (): Promise<GlobalBeachSearchEntry[]> => {
    if (!globalBeachSearchIndexRef.current) {
      globalBeachSearchIndexRef.current = (async () => {
        const searchIndex = await loadBeachSearchIndex();
        const islandById = new Map(allIslands.map(island => [island.id, island] as const));

        return searchIndex
          .map((entry): GlobalBeachSearchEntry | null => {
            const island = islandById.get(entry.regionId);
            if (!island || isInfoOnlyRegionId(entry.regionId)) return null;
            const regionValues = getIslandSearchValues(island);

            return {
              island,
              beachId: entry.beachId,
              beachName: entry.name,
              beachRating: entry.rating || 0,
              aliases: entry.aliases,
              legacySlugs: entry.legacySlugs,
              regionValues,
              searchValues: getBeachSearchValuesFromParts(
                entry.name,
                entry.aliases,
                entry.legacySlugs,
                island
              ),
            };
          })
          .filter((entry): entry is GlobalBeachSearchEntry => Boolean(entry));
      })();
    }

    try {
      return await globalBeachSearchIndexRef.current;
    } catch (error) {
      globalBeachSearchIndexRef.current = null;
      throw error;
    }
  };

  const findLoadedBeachForSearchEntry = (entry: Pick<GlobalBeachSearchEntry, 'island' | 'beachId'>): Beach | undefined => {
    const sourceIsland = selectedIsland?.id === entry.island.id ? selectedIsland : entry.island;
    return sourceIsland.beaches.find(beach => beach.id === entry.beachId);
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
        if (b.beachRating !== a.beachRating) return b.beachRating - a.beachRating;
        return displayBeachName(a.beachName, language).localeCompare(displayBeachName(b.beachName, language));
      });

    const match = rankedMatches[0];
    return match ? {
      island: match.island,
      beachId: match.beachId,
      beach: findLoadedBeachForSearchEntry(match),
      score: match.score,
    } : null;
  };

  const getRegionSearchSuggestions = (query: string): DirectorySearchSuggestion[] => (
    selectableIslands
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
        if (b.beachRating !== a.beachRating) return b.beachRating - a.beachRating;
        return displayBeachName(a.beachName, language).localeCompare(displayBeachName(b.beachName, language));
      })
      .slice(0, limit)
      .map(entry => {
        const loadedBeach = findLoadedBeachForSearchEntry(entry);
        return {
          id: `beach-${entry.island.id}-${entry.beachId}`,
          type: 'beach' as const,
          label: displayBeachName(loadedBeach?.name || entry.beachName, language),
          subtitle: entry.island.name[language] || entry.island.name.en,
          island: entry.island,
          beachId: entry.beachId,
          beach: loadedBeach,
        };
      })
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

  const loadIslandForSearchTarget = async (island: Island): Promise<Island> => {
    if (selectedIsland?.id === island.id && selectedIsland.beaches.length > 0) return selectedIsland;
    if (island.beaches.length > 0) return island;

    return loadAppReadyRegion(island.id);
  };

  const handleDirectorySearchSubmit = async () => {
    const trimmedQuery = beachSearchQuery.trim();
    if (trimmedQuery) markValuePropSeen();
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
      matched_beach_id: globalBeachMatch?.beachId,
      matched_beach_region_id: globalBeachMatch?.island.id,
    });
    if (regionMatch) {
      // A region search is navigation, not a beach-name filter. Leaving "Naxos"
      // in the query makes the next region render as an active name search and
      // forces stale-looking today verdict badges until a refresh clears it.
      setBeachSearchQuery('');
      // A combined "region + intent" query ("Νάξος ... ηλιοβασίλεμα") should land on the
      // region WITH the matching filter(s) already applied. Strip the region's own name so
      // it can't itself trip a filter (e.g. "Σκιάθος" → σκιά, "Βαθύ" → βαθιά).
      const intentFilters = detectSearchIntentFilters(trimmedQuery, [
        regionMatch.name[language],
        regionMatch.name.en,
        regionMatch.name.gr,
        regionMatch.id.replace(/-/g, ' '),
      ]);
      if (regionMatch.id !== selectedIsland?.id) {
        // New region loads async — defer the map scroll until it's mounted (effect above).
        pendingRegionMapScrollRef.current = true;
        // Carry the intent across the region switch; the reset effect re-applies it
        // after it force-clears the previous region's filters.
        pendingRegionIntentFiltersRef.current = intentFilters;
        handleRegionSelected(regionMatch, 'selector');
        closeMobileBottomPanels();
      } else {
        // Already on this region — the reset effect won't fire, so apply directly.
        if (intentFilters.length > 0) {
          setSelectedFilters(prev => {
            const next: FilterKey[] = prev.filter(item => item !== 'showAll');
            for (const filter of intentFilters) {
              if (!next.includes(filter)) next.push(filter);
            }
            return next;
          });
        }
        scrollToMapSection();
      }
      return;
    }
    if (globalBeachMatch) {
      let targetIsland = globalBeachMatch.island;
      try {
        targetIsland = await loadIslandForSearchTarget(globalBeachMatch.island);
      } catch (error) {
        console.warn('Global beach search target region failed to load.', {
          regionId: globalBeachMatch.island.id,
          beachId: globalBeachMatch.beachId,
          error,
        });
      }
      const targetBeach = globalBeachMatch.beach || targetIsland.beaches.find(beach => beach.id === globalBeachMatch.beachId);
      if (!targetBeach) {
        if (targetIsland.id !== selectedIsland?.id) {
          cacheLoadedIsland(targetIsland);
          preserveSearchQueryOnRegionChangeRef.current = true;
          handleRegionSelected(targetIsland, 'selector');
        }
        return;
      }

      setIsDirectoryMapFollowPaused(false);
      pendingDirectorySearchHighlightRef.current = targetBeach.id;
      if (targetIsland.id !== selectedIsland?.id) {
        cacheLoadedIsland(targetIsland);
        preserveSearchQueryOnRegionChangeRef.current = true;
        handleRegionSelected(targetIsland, 'selector');
        return;
      }
      setHighlightedMapBeachId(targetBeach.id);
      // Show the map with the beach's pin + its card centred below it, instead of scrolling
      // down the results list (which dumped mobile users on the legal footer).
      focusDirectorySearchCard(targetBeach.id);
      pendingBeachMapScrollRef.current = true;
      return;
    }
    // Free-text intent ("ηλιοβασίλεμα", "παιδιά") that matched neither a region nor a
    // beach name snaps onto the matching filter(s) for the current region, instead of
    // running as a name search that would match nothing. Clearing the query stops the name
    // filter from zeroing out the very beaches we just selected. The current region's name
    // is stripped defensively so a stray place token can't trip a filter.
    const intentFilters = trimmedQuery
      ? detectSearchIntentFilters(
          trimmedQuery,
          selectedIsland ? [selectedIsland.name[language], selectedIsland.name.en, selectedIsland.name.gr] : [],
        )
      : [];
    if (intentFilters.length > 0 && selectedIsland) {
      setBeachSearchQuery('');
      setSelectedFilters(prev => {
        const next: FilterKey[] = prev.filter(item => item !== 'showAll');
        for (const filter of intentFilters) {
          if (!next.includes(filter)) next.push(filter);
        }
        return next;
      });
      trackEvent('filter_applied', undefined, {
        ...analyticsBaseParams,
        source: 'search_intent',
        intent_filters: intentFilters.join(','),
      });
      scrollToBeachResultsSection();
      return;
    }
    scrollToBeachResultsSection();
  };

  const handleDirectorySearchSuggestionSelect = async (suggestion: DirectorySearchSuggestion) => {
    markValuePropSeen();
    setDirectorySearchSuggestions([]);
    setIsDirectorySearchSuggesting(false);

    trackEvent('search_used', undefined, {
      ...analyticsBaseParams,
      source: 'directory_search_suggestion',
      suggestion_type: suggestion.type,
      region_id: suggestion.island.id,
      beach_id: suggestion.beachId ?? suggestion.beach?.id,
      search_length: beachSearchQuery.trim().length,
    });

    if (suggestion.type === 'region') {
      setBeachSearchQuery('');
      closeMobileBottomPanels();
      if (suggestion.island.id !== selectedIsland?.id) {
        // New region loads async — defer the map scroll until it's mounted (effect above).
        pendingRegionMapScrollRef.current = true;
        handleRegionSelected(suggestion.island, 'selector');
      } else {
        scrollToMapSection();
      }
      return;
    }

    setBeachSearchQuery(suggestion.label);
    const suggestionBeachId = suggestion.beachId ?? suggestion.beach?.id;
    // == null, not falsy: beach id 0 is a real beach (ids are 0-indexed source order).
    if (suggestionBeachId == null) return;

    let targetIsland = suggestion.island;
    try {
      targetIsland = await loadIslandForSearchTarget(suggestion.island);
    } catch (error) {
      console.warn('Search suggestion region failed to load.', {
        regionId: suggestion.island.id,
        beachId: suggestionBeachId,
        error,
      });
    }
    const targetBeach = suggestion.beach || targetIsland.beaches.find(beach => beach.id === suggestionBeachId);
    if (!targetBeach) return;

    pendingDirectorySearchHighlightRef.current = targetBeach.id;
    setIsDirectoryMapFollowPaused(false);

    if (targetIsland.id !== selectedIsland?.id) {
      cacheLoadedIsland(targetIsland);
      preserveSearchQueryOnRegionChangeRef.current = true;
      handleRegionSelected(targetIsland, 'selector');
      return;
    }

    setHighlightedMapBeachId(targetBeach.id);
    // Show the map with the beach's pin + its card centred right below it, instead of
    // scrolling down the results list (which dumped mobile users on the legal footer).
    focusDirectorySearchCard(targetBeach.id);
    // Defer the scroll until the name-search layout settles (effect on deferredBeachSearchQuery).
    pendingBeachMapScrollRef.current = true;
  };
  // The mobile directory map keeps a single fixed height at every Beaufort.
  // Keep it compact enough that the hour slider and condition summary stay visible
  // on the first mobile viewport.
  // Keep the height stable as the hour slider changes.

  const directoryMapPreview = selectedIsland && !isUnsafeWinter && !isInfoOnlyRegion ? (
    <MapLoadBoundary
      resetKey={`${selectedIsland.id}-${language}-directory`}
      fallback={
        <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white/82 px-4 text-center text-sm font-bold text-slate-600">
          <span>{homeCopy.mapError[language]}</span>
        </div>
      }
    >
      <Suspense fallback={<div className="h-[13.5rem] w-full animate-pulse rounded-[1.1rem] bg-slate-100 sm:h-[26rem] lg:h-[32rem]" />}>
        <BeachMap
          center={[selectedIsland.coordinates.lat, selectedIsland.coordinates.lon]}
          zoom={11}
          regionId={selectedIsland.id}
          beaches={directoryMapPinBeaches}
          userLocation={userLocation}
          userLocationAccuracy={userLocationAccuracy}
          onBeachClick={(b) => openBeachDetails(b, 'directory_home_map')}
          onVisibleBeachIdsChange={handleDesktopMapVisibleBeachIdsChange}
          windSpeed={selectedForecast?.wind.speed}
          windDirection={selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined}
          windDirectionDeg={selectedForecast?.wind.deg}
          // Pin colours come from the canonical full-island exposure pass, so a pin keeps the
          // SAME colour the beach card shows — and doesn't shift when filters narrow the
          // visible set (the consistency pass is set-dependent, which made them diverge).
          exposureLevelOverrides={canonicalMapExposureLevels}
          beachLocalWinds={mapBeachLocalWinds}
          hourSlots={mapHourSlots}
          selectedHourDt={selectedHourDt}
          onHourChange={handleMapHourChange}
          enableHourSlider
          language={language}
          islandName={selectedIsland.name[language]}
          selectedDate={selectedDayDate}
          highlightedBeachId={highlightedMapBeachId}
          followHighlightedBeach={!isDirectoryMapFollowPaused}
          fitBoundsToBeaches
          fitBoundsBeaches={mapFitBoundsBeaches}
          fitBoundsKey={mapFitBoundsKey}
          guardrailBeaches={mapSuitableBeaches}
          onUserInteraction={handleDirectoryMapUserInteraction}
          enableScrollWheelZoom={isDesktopViewport}
          isExposureLoading={isMapExposureLoading}
          compactPreviewHeightClassName="h-[13.5rem] sm:h-[26rem] lg:h-[32rem]"
          compact
          preview
        />
      </Suspense>
    </MapLoadBoundary>
  ) : null;

  return (
    <div className="relative min-h-screen transition-colors duration-500">
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
        selectedIslandMeta={showLanding ? undefined : headerWeatherMeta}
        selectedDate={selectedDayDate}
        onOpenIslandSelector={handleOpenIslandSelector} isWinter={isWinter}
        onGoHome={handleGoHome}
        onOpenFavorites={() => handleMobileTab('favorites')}
        forecastSlot={showHeaderForecast && !showLanding ? (
          <>
            {isStartupLocationPromptOpen && (
              <StartupLocationPrompt
                language={language}
                isFindingLocation={isSelectingStartupRegion}
                onUseLocation={handleUseStartupLocation}
                onChooseManually={handleChooseStartupRegionManually}
              />
            )}
            <BeachSearcherHome
              language={language}
              selectedIsland={selectedIsland}
              showLandingValueProp={showValueProp}
              allIslands={allIslands}
              regionWindNote={regionWindVariationNote?.text}
              rainWarning={
                selectedIsland && rainRiskSummary.hasRainRisk && !isUnsafeWinter && !isStaleBlocked && !isInfoOnlyRegion
                  ? { title: rainRiskCopy.title, body: rainRiskCopy.body, isNow: rainRiskSummary.isRainingNow }
                  : undefined
              }
              searchQuery={beachSearchQuery}
              activeCategory={directoryActiveCategory}
              sortBy={sortBy}
              isMobileViewport={!isDesktopViewport}
              isAllBeachesPanelOpen={isMobileAllBeachesPanelOpen}
              onAllBeachesPanelOpenChange={handleAllBeachesPanelOpenChange}
              isWeatherPanelOpen={isMobileWeatherPanelOpen}
              onWeatherPanelOpenChange={handleWeatherPanelOpenChange}
              suitableDistanceSortActive={sortBy === 'protected' && mobileSuitableDistanceSort}
              locationSortResetKey={locationSortResetKey}
              resultListResetKey={mobileResultListResetKey}
              preferences={preferences}
              activeFilters={selectedFilters}
              filterResultCounts={preferenceFilterResultCounts}
              advancedFilterResultCounts={desktopAdvancedFilterResultCounts}
              sortResultCounts={sortResultCounts}
              filteredResultCount={filteredBeaches.length}
              activeFilterCount={selectedFilters.filter(filter => filter !== 'showAll').length + Object.values(preferences).filter(Boolean).length}
              searchSuggestions={directorySearchSuggestions}
              isSearchSuggesting={isDirectorySearchSuggesting}
              protectedSortLabel={protectedSortLabel}
              currentBeaufort={currentBeaufort}
              mapForecastTimeLabel={mapForecastTimeLabel}
              islandBackground={islandBackground}
              mapDayStrip={mobileMapDayStrip}
              mapPreview={directoryMapPreview}
              topRecommendationCards={directoryTopRecommendationCards}
              suitableBeachCards={directoryHomeSuitableBeachCards}
              suitableBeachTotalCount={directorySuitableBeachTotalCount}
              suitableTimePrefix={selectedHourPrefix}
              onActiveSuitableBeachChange={handleActiveDirectoryBeachChange}
              directorySearchCardFocus={directorySearchCardFocus}
              showSuitableBeachSection={shouldShowDirectorySuitableSection}
              allBeachCards={directoryAllSourceBeaches}
              beachWeatherContexts={mapSuitableBeaches}
              topBeachToday={directoryTopRecommendationCards.length > 0 ? null : displayedDirectoryTopBeach}
              topBeachDescription={directoryTopRecommendationCards.length > 0 || !displayedDirectoryTopBeach ? '' : directoryTopDescription}
              topBeachTimingLabel={directoryTopRecommendationCards.length > 0 ? undefined : directoryTopTimingLabel}
              forecastDays={forecast || undefined}
              selectedDayIndex={selectedDayIndex}
              selectedForecast={selectedForecast}
              mapSelectedHour={selectedHourDt != null ? new Date(selectedHourDt * 1000).getHours() : undefined}
              isExposureLoading={isMapExposureLoading}
              selectedDate={selectedDayDate}
              lastUpdated={lastUpdated}
              forecastFreshness={forecastFreshness}
              favorites={favorites}
              t={t}
              onToggleFavorite={handleToggleFavorite}
              onSearchChange={setBeachSearchQuery}
              onSearchSubmit={handleDirectorySearchSubmit}
              onSearchSuggestionSelect={handleDirectorySearchSuggestionSelect}
              onOpenFilters={() => setIsFilterModalOpen(true)}
              onOpenIslandSelector={handleOpenIslandSelector}
              onUseCurrentLocation={() => {
                // Desktop "sort by distance" dropdown: order the current region by
                // distance without leaving it.
                setBeachSearchQuery('');
                hasUserSelectedSortRef.current = true;
                setSortBy('protected');
                setMobileSuitableDistanceSort(true);
                setLocationSortResetKey(key => key + 1);
                void handleRequestUserLocation();
              }}
              onShowNearbyBeaches={() => {
                // Mobile "Κοντά μου": surface the beaches physically nearest to the
                // user, merged across regions — not whichever region is on screen.
                void handleShowNearbyBeaches();
              }}
              onRequestUserLocation={() => {
                void handleRequestUserLocation();
              }}
              onDistanceSortActiveChange={setMobileSuitableDistanceSort}
              hasUserLocation={Boolean(userLocation)}
              isFindingCurrentLocation={isFindingNearest}
              currentLocationError={findNearestError}
              onCategorySelect={handleDirectoryCategorySelect}
              onClearAllFilters={handleClearSearchAndFilters}
              onSortChange={handleSortChange}
              onAdvancedFilterToggle={handleToggleAdvancedFilter}
              onForecastDaySelect={setSelectedDayIndex}
              onBeachClick={(beach) => { markValuePropSeen(); openBeachDetails(beach, 'directory_home_card'); }}
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
              <div
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
              </div>
            )}

            {headerTopBeach && (
              <button
                type="button"
                onClick={() => openBeachDetails(headerTopBeach.beach, 'top_recommendation_panel')}
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
                              ...buildBeachExposureParams(headerTopBeach.beach, headerTopBeach.simpleWindSuitability?.exposureStatus),
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
                            ...buildBeachExposureParams(headerTopBeach.beach, headerTopBeach.simpleWindSuitability?.exposureStatus),
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
              </button>
            )}

              </div>
            </div>
          </>
        ) : undefined}
      />

      {showLanding ? (
        <LandingView
          language={language}
          allIslands={allIslands}
          searchQuery={beachSearchQuery}
          searchSuggestions={directorySearchSuggestions}
          isSearchSuggesting={isDirectorySearchSuggesting}
          onSearchChange={setBeachSearchQuery}
          onSearchSubmit={handleDirectorySearchSubmit}
          onSearchSuggestionSelect={handleDirectorySearchSuggestionSelect}
          onShowNearbyBeaches={() => { void handleShowNearbyBeaches(); }}
          isFindingLocation={isFindingNearest}
          locationError={findNearestError}
          onSelectIsland={island => handleRegionSelected(island, 'landing')}
          onOpenIslandSelector={handleOpenIslandSelector}
        />
      ) : (
      <>

      {/* Multi-day planner — sits right under today's picks, where someone who
          has just seen "today" naturally wonders about the rest of their stay.
          Info-only regions have no ranking at all, so it stays out of those. */}
      {selectedIsland && forecast && forecast.length > 0 && !isUnsafeWinter && !isInfoOnlyRegion && selectedIsland.beaches.length > 0 && (
        <div className="relative z-20 pb-3 pt-1 sm:pb-4">
          <TripPlanner
            beaches={selectedIsland.beaches}
            forecast={forecast}
            language={language}
            regionId={String(selectedIsland.id)}
            preferences={preferences}
            geospatialProfiles={geospatialExposureProfiles}
            onBeachClick={(beach) => openBeachDetails(beach, 'trip_planner')}
          />
        </div>
      )}

      {showRecommendationPreviewSection && forecast?.[selectedDayIndex] && !isUnsafeWinter && !showHeaderForecast && recommendationSectionBeaches.length > 0 && !isInfoOnlyRegion && (
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
                  <div key={r.beach.id}>
                    <BeachCard
                      beach={{...r.beach, distance: r.distance}} isExposed={r.isExposed} language={language} t={t}
                      isCalm={r.seaCalmClaimAllowed === true} windSpeed={selectedForecast?.wind.speed ?? forecast[selectedDayIndex].wind.speed} temperature={forecast[selectedDayIndex].temp_max}
                      favorites={favorites} onToggleFavorite={handleToggleFavorite} islandName={selectedIsland!.name[language]}
                      regionId={selectedIsland?.id}
                      onClick={() => openBeachDetails(r.beach, 'recommendation_card')}
                      todayScore={r.score}
                      variant="decision"
                      recommendationRank={i + 1}
                      topPickPodium
                      strongWindContext
                      bestBeachTime={r.bestBeachTime}
                      topPickTimeLabel={getTopPickTimingLabel(r.bestBeachTime, selectedDayDate, language, topPickNow)}
                      selectedDate={selectedDayDate}
                      selectedHour={selectedHourDt != null ? new Date(selectedHourDt * 1000).getHours() : undefined}
                      exposureLevel={r.exposureLevel}
                      waveHeightM={r.waveHeightM}
                      beachWindSpeedKmph={r.windSpeedKmph}
                      warnings={r.warnings}
                      confidence={r.confidence}
                      swimmingComfort={r.swimmingComfort}
                      canClaimWindProtection={r.canClaimWindProtection}
                      enclosedCove={r.enclosedCove}
                      seaCalmClaimAllowed={r.seaCalmClaimAllowed}
                      windSuitabilityText={describeSimpleWindSuitability(r.simpleWindSuitability, language)}
                      windSuitabilityColor={r.simpleWindSuitability?.suitabilityColor}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isDesktopViewport && showWindContextSummaryPanel && !isInfoOnlyRegion && (
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

      {selectedIsland && !isUnsafeWinter && isDesktopViewport && !showHeaderForecast && !isInfoOnlyRegion && (
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
                    regionId={selectedIsland.id}
                    beaches={filteredMapSuitableBeaches}
                    userLocation={userLocation}
                    onBeachClick={(b) => openBeachDetails(b, 'map')}
                    onVisibleBeachIdsChange={handleDesktopMapVisibleBeachIdsChange}
                    windSpeed={selectedForecast?.wind.speed}
                    windDirection={selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined}
                    windDirectionDeg={selectedForecast?.wind.deg}
                    exposureLevelOverrides={canonicalMapExposureLevels}
                              beachLocalWinds={mapBeachLocalWinds}
                    hourSlots={mapHourSlots}
                    selectedHourDt={selectedHourDt}
                    onHourChange={handleMapHourChange}
                    enableHourSlider
                    language={language}
                    islandName={selectedIsland.name[language]}
                    selectedDate={selectedDayDate}
                    fitBoundsToBeaches
                    fitBoundsBeaches={mapFitBoundsBeaches}
                    fitBoundsKey={mapFitBoundsKey}
                    guardrailBeaches={mapSuitableBeaches}
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
              <div
                className={`max-w-3xl mx-auto ${selectedIsland ? 'h-0' : 'mb-5'}`}
              >
                <div className="text-center">
                  {!selectedIsland && (
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-slate-900 dark:text-white">
                      {homeCopy.selectLocation[language]}
                    </h1>
                  )}
                </div>
              </div>

            </div>
          </section>
        </>
      )}

      {/* ===== MAIN CONTENT ===== */}
      {shouldRenderMainShell && (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 space-y-8 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:space-y-16 md:pb-8 lg:space-y-8 relative z-10">
            <div
              key={`${selectedIsland?.id}-${selectedDayIndex}`}
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

              {isStaleBlocked && (
                <section
                  role="status"
                  data-nosnippet="true"
                  className="mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border border-slate-300 bg-white/95 p-3 text-slate-800 shadow-sm shadow-slate-900/5 sm:p-4"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 sm:mt-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black leading-snug text-slate-950">
                      {homeCopy.conditionsUnavailableTitle[language]}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-600">
                      {homeCopy.conditionsUnavailableBody[language]}
                    </p>
                    {lastUpdated && (
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {homeCopy.lastForecastAt[language](toAthensWallClock(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleWeatherRetry}
                    disabled={weatherLoading}
                    aria-label={homeCopy.weatherRetry[language]}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${weatherLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden min-[390px]:inline">{homeCopy.weatherRetry[language]}</span>
                  </button>
                </section>
              )}

              {weatherError && !isStaleBlocked && (
                <section
                  role="status"
                  data-nosnippet="true"
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
              {forecast?.[selectedDayIndex] && !isUnsafeWinter && !showHeaderForecast && !showRecommendationPreviewSection && !hasActiveSearchOrFilters && showDecisionRecommendations && recommendationSectionBeaches.length > 0 && !isInfoOnlyRegion && (
                <section className="!mt-0 sm:!mt-5" data-nosnippet="true">
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
                      <div key={r.beach.id}>
                        <BeachCard
                          beach={{...r.beach, distance: r.distance}} isExposed={r.isExposed} language={language} t={t}
                          isCalm={r.seaCalmClaimAllowed === true} windSpeed={selectedForecast?.wind.speed ?? forecast[selectedDayIndex].wind.speed} temperature={forecast[selectedDayIndex].temp_max}
                          favorites={favorites} onToggleFavorite={handleToggleFavorite} islandName={selectedIsland!.name[language]}
                          regionId={selectedIsland?.id}
                          onClick={() => openBeachDetails(r.beach, 'recommendation_card')}
                          todayScore={r.score}
                      variant="decision"
                      recommendationRank={showStrongManageableSection || !headerTopCandidate ? i + 1 : i + 2}
                      topPickPodium={recommendationDisplayMode !== 'mild'}
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
                          selectedHour={selectedHourDt != null ? new Date(selectedHourDt * 1000).getHours() : undefined}
                          exposureLevel={r.exposureLevel}
                          waveHeightM={r.waveHeightM}
                          beachWindSpeedKmph={r.windSpeedKmph}
                          warnings={r.warnings}
                          confidence={r.confidence}
                          swimmingComfort={r.swimmingComfort}
                          canClaimWindProtection={r.canClaimWindProtection}
                          enclosedCove={r.enclosedCove}
                          seaCalmClaimAllowed={r.seaCalmClaimAllowed}
                          strongWindContext={isStrongRecommendationMode}
                          windSuitabilityText={describeSimpleWindSuitability(r.simpleWindSuitability, language)}
                          windSuitabilityColor={r.simpleWindSuitability?.suitabilityColor}
                        />
                      </div>
                    ))}
                    </div>
                    <p className="mx-auto mt-3 max-w-2xl px-1 text-center text-[11px] font-semibold leading-relaxed text-slate-700 sm:mt-4 sm:text-xs">
                      Recommendations are indicative and based on available weather and beach data. Conditions may vary locally. Always follow local warnings and use personal judgment.
                    </p>
                  </div>
                </section>
              )}

              {/* AI Advisor - temporarily hidden */}
              {ENABLE_AI_ADVISOR && (
                <div
                  className="max-w-3xl mx-auto"
                >
                  <Suspense fallback={null}>
                    <AiBeachAdvisor allIslands={allIslands} selectedIsland={selectedIsland} weather={forecast?.[selectedDayIndex] || weather} userLocation={userLocation} language={language} />
                  </Suspense>
                </div>
              )}

              {isUnsafeWinter && <UnsafeConditionsMessage t={t} />}

              {!showHeaderForecast && (
              <div data-nosnippet="true">
                <RecommendationSection
                  beaches={beachListBeaches} language={language} t={t}
                  windSpeed={(selectedForecast?.wind.speed ?? forecast?.[selectedDayIndex]?.wind.speed) || 0}
                  windDirection={degToCompass((selectedForecast?.wind.deg ?? forecast?.[selectedDayIndex]?.wind.deg) || 0)}
                  waveHeightM={selectedForecast?.marine?.waveHeightM ?? forecast?.[selectedDayIndex]?.marine?.waveHeightM}
                  selectedDate={selectedDayDate}
                  selectedHour={selectedHourDt != null ? new Date(selectedHourDt * 1000).getHours() : undefined}
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
              </div>
              )}

              {betaFeedbackUrl && (
                <section className="mx-auto max-w-3xl rounded-[1.5rem] border border-white/60 bg-white/62 p-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl" data-nosnippet="true">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <h2 className="font-heading text-base font-bold text-slate-900">
                        {homeCopy.betaFeedbackTitle[language]}
                      </h2>
                      <p className="text-sm font-medium leading-snug text-slate-700">
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

              {selectedIsland && !isUnsafeWinter && !isDesktopViewport && !showHeaderForecast && !isInfoOnlyRegion && (
                <section id="map-section" ref={mapSectionRef} className="!mt-4 space-y-2 sm:hidden sm:space-y-5" data-nosnippet="true">
                  <div className="space-y-1 sm:space-y-2">
                    <div className="flex min-h-10 w-full items-center justify-center rounded-full border border-white/50 bg-white/42 px-5 py-2 shadow-sm shadow-sky-900/5 ring-1 ring-white/30 backdrop-blur-xl sm:px-6">
                        <h2 className="w-full text-center font-heading text-sm font-semibold leading-tight text-slate-600 sm:text-base">
                        <span className="sm:hidden">{homeCopy.viewOnMap[language]}</span>
                        <span className="hidden sm:inline">{homeCopy.mapTitle[language]}</span>
                      </h2>
                    </div>
                    <p className="hidden text-center text-xs font-semibold leading-snug text-slate-700/80 sm:block sm:text-sm">
                      {homeCopy.mapSubtitle[language]}
                    </p>
                  </div>
                  {mobileMapDayStrip}
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
                            regionId={selectedIsland.id}
                            beaches={filteredMapSuitableBeaches}
                            userLocation={userLocation}
                            onBeachClick={(b) => openBeachDetails(b, 'map')}
                            windSpeed={selectedForecast?.wind.speed}
                            windDirection={selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined}
                            windDirectionDeg={selectedForecast?.wind.deg}
                            exposureLevelOverrides={canonicalMapExposureLevels}
                                              beachLocalWinds={mapBeachLocalWinds}
                            hourSlots={mapHourSlots}
                            selectedHourDt={selectedHourDt}
                            onHourChange={handleMapHourChange}
                            enableHourSlider
                            language={language}
                            islandName={selectedIsland.name[language]}
                            selectedDate={selectedDayDate}
                            fitBoundsToBeaches
                            fitBoundsBeaches={mapFitBoundsBeaches}
                            fitBoundsKey={mapFitBoundsKey}
                            guardrailBeaches={mapSuitableBeaches}
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
                        <span className="text-xs font-semibold text-slate-600">{homeCopy.mapSubtitle[language]}</span>
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
            </div>

      </main>
      )}

      </>
      )}

      <div className={`${isDesktopViewport ? 'relative z-[70] bg-transparent' : 'relative z-50 bg-transparent pb-[calc(5rem+env(safe-area-inset-bottom))]'}`}>
        <LegalFooter language={language} />
      </div>

      {/* ===== MOBILE BOTTOM NAVIGATION ===== */}
      <MobileBottomNav
        language={language}
        activeTab={mobileTab}
        onTabChange={handleMobileTab}
        // Never over the landing. showBottomNav is driven by `!selectedIsland`,
        // which is exactly the landing state — so a 64px bar was covering the
        // bottom of every screen of the first impression, and two of its three
        // tabs are dead there: «Καιρός» bounces straight back to home (no region
        // to show weather for) and «Αποθηκευμένα» is empty for a new visitor.
        visible={showBottomNav && !showLanding}
        showBuddy={ENABLE_BEACH_BUDDY_CHAT}
        showPlanner={ENABLE_PLANNER_PRO}
        favoritesCount={favorites.length}
      />

      <PrivacyConsentBanner language={language} />

      {/* ===== FLOATING ACTION BUTTONS (desktop only) ===== */}
      {(ENABLE_PLANNER_PRO || ENABLE_BEACH_BUDDY_CHAT) && (
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-3">
        {ENABLE_PLANNER_PRO && (
        <button
          onClick={() => setIsPlannerOpen(true)}
          className="group relative p-4 bg-white dark:bg-slate-800 text-primary rounded-2xl shadow-lg hover:shadow-xl border border-sky-100 dark:border-slate-700 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          aria-label={homeCopy.tripPlanner[language]}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
            Pro
          </span>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-heading font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {language === 'gr' ? 'Planner Pro' : 'Planner Pro'}
          </span>
        </button>
        )}

        {ENABLE_BEACH_BUDDY_CHAT && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="group relative p-4 bg-cta text-white rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
          aria-label={homeCopy.aiAssistant[language]}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-heading font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            AI Chat
          </span>
        </button>
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
          <IslandSelectorModal isOpen={isIslandSelectorOpen} onClose={handleCloseIslandSelector} islands={selectableIslands} onSelect={handleRegionSelected} t={t} language={language} onSelectNearest={handleSelectNearest} isFindingNearest={isFindingNearest} findNearestError={findNearestError} />
        </Suspense>
      )}

      <InstallPrompt language={language} />

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
                  resetMobileResultListPosition();
                  handleAllBeachesPanelOpenChange(true);
                } else {
                  scrollToBeachResultsSection(s === 'protected' ? 'suitable' : 'all');
                }
              }}
              onClose={() => setIsFilterModalOpen(false)}
              onResetAll={handleClearSearchAndFilters}
              t={t}
              language={language}
              isGettingLocation={isFindingNearest}
              locationError={findNearestError}
              hasUserLocation={Boolean(userLocation)}
              onRequestLocation={() => {
                setBeachSearchQuery('');
                void handleRequestUserLocation();
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
