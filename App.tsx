import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Accessibility, Beach, Island, LanguageCode, FilterKey, SortOption, SavedItinerary, Theme, TravelStyle, UserPreferences } from './types';
import { sendMessage, initializeChat, generateItinerary } from './services/geminiService';
import { getSuitableBeaches, filterNearbyBeaches } from './services/recommendationService';
import { motion, AnimatePresence } from 'motion/react';
import { Chat } from '@google/genai';

// Components
import Header from './components/Header';
import SkeletonLoader from './components/SkeletonLoader';
import FilterButton from './components/FilterButton';
import FilterModal from './components/FilterModal';
import ItineraryPlanner from './components/ItineraryPlanner';
import SavedItinerariesModal from './components/SavedItinerariesModal';
import { CombinedFilter } from './components/AmenityFilter';
import { ChatbotModal } from './components/ChatbotModal';
import { IslandSelectorModal } from './components/IslandSelectorModal';
import { UnsafeConditionsMessage } from './components/UnsafeConditionsMessage';
import { PreferenceFilters } from './components/PreferenceFilters';
import { WeatherSummary } from './components/WeatherSummary';
import { RecommendationSection } from './components/RecommendationSection';
import { AiBeachAdvisor } from './components/AiBeachAdvisor';
import { UsageInsights } from './components/UsageInsights';
import { BeachCard } from './components/BeachCard';
import { BeachDetailPage } from './pages/BeachDetailPage';
import ErrorDisplay from './components/ErrorDisplay';
import BeachOfTheDay from './components/BeachOfTheDay';
import { MobileBottomNav } from './components/MobileBottomNav';

// Hooks & Utils
import { useBeaches } from './hooks/useBeaches';
import { useWeather } from './hooks/useWeather';
import { useLocation } from './hooks/useLocation';
import { useGeolocation, Location } from './hooks/useGeolocation';
import { translations } from './translations';
import { degToCompass, getBeaufortLevel, isWinterSeason } from './utils/weatherUtils';
import { trackEvent } from './services/analyticsService';
import { generateBeachDayPlan } from './services/beachPlannerService';
import { hasPoorSeaConditions } from './utils/seaConditions';

// Lazy load heavy components
const BeachMap = React.lazy(() => import('./components/BeachMap'));

const CYCLADES_BACKGROUND_IMAGES: Record<string, string> = {
  amorgos: '/cyclades-amorgos-bg.jpg',
  anafi: '/cyclades-anafi-bg.jpg',
  andros: '/cyclades-andros-bg.jpg',
  antiparos: '/cyclades-antiparos-bg.jpg',
  folegandros: '/cyclades-folegandros-bg.jpg',
  ios: '/cyclades-ios-bg.jpg',
  kea: '/cyclades-kea-bg.jpg',
  kimolos: '/cyclades-kimolos-bg.jpg',
  kythnos: '/cyclades-kythnos-bg.jpg',
  milos: '/milos-sarakiniko-bg.jpg',
  mykonos: '/cyclades-mykonos-bg.jpg',
  naxos: '/cyclades-naxos-bg.jpg',
  paros: '/cyclades-paros-bg.jpg',
  santorini: '/cyclades-santorini-bg.jpg',
  serifos: '/cyclades-serifos-bg.jpg',
  sifnos: '/cyclades-sifnos-bg.jpg',
  sikinos: '/cyclades-sikinos-bg.jpg',
  syros: '/cyclades-syros-bg.jpg',
  tinos: '/cyclades-tinos-bg.jpg',
  donousa: '/cyclades-donousa-bg.jpg',
  koufonisia: '/cyclades-koufonisia-bg.jpg',
  schinoussa: '/cyclades-schinoussa-bg.jpg',
  iraklia: '/cyclades-iraklia-bg.jpg',
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

const hasBadRoadAccess = (beach: Beach): boolean => {
  return beach.accessibility === Accessibility.DIFFICULT || badRoadAccessTypes.has(beach.metadata?.access?.type || '');
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

export const App: React.FC = () => {
  // --- UI & Language State ---
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguage] = useState<LanguageCode>('gr');
  const t = translations[language];
  const isWinter = useMemo(() => isWinterSeason(), []);
  const homeCopy = {
    alternativeTitle: { en: 'More strong choices today', gr: 'Εναλλακτικές επιλογές σήμερα', de: 'Weitere gute Optionen heute', it: 'Altre buone scelte oggi', fr: 'Autres bonnes options aujourd hui' },
    beaches: { en: 'beaches', gr: 'παραλίες', de: 'Strande', it: 'spiagge', fr: 'plages' },
    wind: { en: 'wind', gr: 'άνεμος', de: 'Wind', it: 'vento', fr: 'vent' },
    selectLocation: { en: 'Select location', gr: 'Επίλεξε τοποθεσία', de: 'Ort auswahlen', it: 'Scegli localita', fr: 'Choisir la destination' },
    mapTitle: { en: 'Interactive Map', gr: 'Διαδραστικός Χάρτης', de: 'Interaktive Karte', it: 'Mappa interattiva', fr: 'Carte interactive' },
    mapSubtitle: { en: 'Explore beaches on the map', gr: 'Εξερεύνησε τις παραλίες στον χάρτη', de: 'Strande auf der Karte entdecken', it: 'Esplora le spiagge sulla mappa', fr: 'Explorer les plages sur la carte' },
    tripPlanner: { en: 'Trip planner', gr: 'Σχεδιασμός ταξιδιού', de: 'Reiseplaner', it: 'Pianificatore viaggio', fr: 'Planificateur de voyage' },
    aiAssistant: { en: 'AI Assistant', gr: 'AI Βοηθός', de: 'KI-Assistent', it: 'Assistente AI', fr: 'Assistant IA' },
  };

  // --- Beach & Weather Data (Custom Hooks) ---
  const { allIslands, loading: beachesLoading, error: beachesError, getFilteredBeaches } = useBeaches(language);
  const { selectedIsland, selectIsland } = useLocation(allIslands);
  const { weather, forecast, loading: weatherLoading, error: weatherError, selectedDayIndex, setSelectedDayIndex, loadWeatherData, lastUpdated } = useWeather(selectedIsland, language);

  // --- Functional State ---
  const [selectedFilters, setSelectedFilters] = useState<FilterKey[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [beachSearchQuery, setBeachSearchQuery] = useState('');
  const [detailBeach, setDetailBeach] = useState<Beach | null>(null);
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [mobileTab, setMobileTab] = useState<'home' | 'map' | 'favorites' | 'chat' | 'planner'>('home');

  // --- Modals State ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isIslandSelectorOpen, setIsIslandSelectorOpen] = useState(false);
  const [isItinerariesOpen, setIsItinerariesOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // --- Chat & AI State ---
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const chatSessionRef = useRef<Chat | null>(null);

  // --- User Preferences & Favorites ---
  const defaultPreferences: UserPreferences = useMemo(
    () => ({
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
    }),
    []
  );

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('userPreferences');
    if (!saved) return defaultPreferences;
    try {
      const parsed = JSON.parse(saved);
      return { ...defaultPreferences, ...(parsed || {}), familyFriendly: false };
    } catch {
      return defaultPreferences;
    }
  });

  const [favorites, setFavorites] = useState<number[]>(() => readJsonArrayFromStorage<number>('favorites'));

  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | undefined>(undefined);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // --- Auto-location & Smart Matching ---
  const { location: autoLocation, loading: geolocLoading, error: geoError, detectLocation } = useGeolocation();
  const [autoLocationDone, setAutoLocationDone] = useState(false);

  // Trigger location detection on mount
  useEffect(() => {
    detectLocation();
  }, []);

  // When location is detected and islands are loaded, auto-select nearest island
  useEffect(() => {
    if (autoLocation && allIslands.length > 0 && !autoLocationDone) {
      setUserLocation({ lat: autoLocation.lat, lon: autoLocation.lon });
      const nearest = findNearestIsland(autoLocation, allIslands);
      if (nearest) {
        selectIsland(nearest);
        setAutoLocationDone(true);
        console.log(`Auto-selected nearest island: ${nearest.name[language]}`);
      }
    }
  }, [autoLocation, allIslands]);

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
        selectIsland(nearest);
        setIsIslandSelectorOpen(false);
      } else {
        setFindNearestError('No nearby island found');
      }
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      if (geoErr.code === 1) {
        setFindNearestError('Permission denied. Please allow location access.');
      } else if (geoErr.code === 2) {
        setFindNearestError('Location unavailable.');
      } else {
        setFindNearestError('Location request timed out.');
      }
    } finally {
      setIsFindingNearest(false);
    }
  };

  // --- Planner State ---
  const [itineraryDuration, setItineraryDuration] = useState(3);
  const [itineraryStyle, setItineraryStyle] = useState<TravelStyle>('couple');
  const [generatedItinerary, setGeneratedItinerary] = useState<string | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [isItinerarySaved, setIsItinerarySaved] = useState(false);
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>(() =>
    readJsonArrayFromStorage<SavedItinerary>('savedItineraries')
  );

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  useEffect(() => {
    const hO = () => setIsOffline(false);
    const hF = () => setIsOffline(true);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hF);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hF); };
  }, []);

  // --- Handlers ---
  const handleTogglePreference = (key: keyof UserPreferences) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('userPreferences', JSON.stringify(updated));
      return updated;
    });
  };

  const handleToggleFavorite = (beachId: number) => {
    setFavorites(prev => {
      const isFavoriting = !prev.includes(beachId);
      if (isFavoriting) trackEvent('beach_favorited', beachId);
      const newFavs = isFavoriting ? [...prev, beachId] : prev.filter(id => id !== beachId);
      localStorage.setItem('favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const handleMobileTab = (tab: 'home' | 'map' | 'favorites' | 'chat' | 'planner') => {
    setMobileTab(tab);
    if (tab === 'chat') { setIsChatOpen(true); return; }
    if (tab === 'planner') { setIsPlannerOpen(true); return; }
    if (tab === 'home' && view === 'detail') { setView('home'); }
    // map and favorites scroll to their sections
    if (tab === 'map') {
      document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
    }
    if (tab === 'favorites') {
      document.getElementById('all-beaches-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // --- CORE AI LOGIC (RTX 3090 / GEMINI) ---
  const handleChatSend = async (msg: string, model: string = 'google') => {
    if (!selectedIsland) return;
    
    const userMsg = { id: Date.now().toString(), text: msg, sender: 'user' };
    const loadingId = 'bot-loading-' + Date.now();
    setChatMessages(prev => [...prev, userMsg, { id: loadingId, text: '...', sender: 'bot' }]);

    try {
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
  const filteredBeaches = useMemo(() => {
    if (!selectedIsland || !forecast || !forecast[selectedDayIndex]) return [];
    // Apply preference hard-filters before standard filters
    const allBeaches = selectedIsland.beaches;
    let beaches = allBeaches;
    const p = preferences;
    const hasActivePreferences = Object.values(p || {}).some(Boolean);
    if (p) {
      const preferenceFilteredBeaches = beaches.filter(b => {
        const typeActive = p.sandy || p.pebbles;
        if (typeActive) {
          const matchS = p.sandy && (b.beachType === 'sandy' || b.beachType === 'sandy-pebbles');
          const matchP = p.pebbles && (b.beachType === 'pebbles' || b.beachType === 'sandy-pebbles');
          if (!matchS && !matchP) return false;
        }
        if (p.snorkeling && !b.characteristics?.deepWaters) return false;
        if (p.deepWater && !b.characteristics?.deepWaters) return false;
        if (p.shallowWater && !b.characteristics?.shallowWaters) return false;
        if (p.beachBar && !b.amenities?.organized && !b.amenities?.beachBar && !b.amenities?.taverna) return false;
        if (p.quiet && b.amenities?.organized) return false;
        return true;
      });
      beaches = preferenceFilteredBeaches.length > 0 ? preferenceFilteredBeaches : allBeaches;
    }
    const selectedForecast = forecast[selectedDayIndex];
    const windDirection = degToCompass(selectedForecast.wind.deg);

    if (sortBy === 'recommended') {
      const windSpeedKmph = selectedForecast.wind.speed * 3.6;
      beaches = beaches.filter(beach => {
        const isExposed = !beach.protectedFrom.includes(windDirection);
        return !hasPoorSeaConditions(isExposed, windSpeedKmph);
      });
    }

    const result = getFilteredBeaches(beaches, selectedFilters, beachSearchQuery, sortBy, windDirection);
    if (result.length === 0 && sortBy === 'all' && !beachSearchQuery.trim()) {
      return getFilteredBeaches(allBeaches, [], '', sortBy, windDirection);
    }
    return result;
  }, [selectedIsland, forecast, selectedDayIndex, selectedFilters, beachSearchQuery, sortBy, getFilteredBeaches, preferences]);

  const suitableBeaches = useMemo(() => {
    if (!selectedIsland || !forecast || !forecast[selectedDayIndex]) return [];
    return getSuitableBeaches(selectedIsland.beaches, forecast[selectedDayIndex], language, userLocation, forecast[selectedDayIndex].hourly, preferences);
  }, [selectedIsland, forecast, selectedDayIndex, language, userLocation, preferences]);

  const recommendedSuitableBeaches = useMemo(() => {
    if (!forecast || !forecast[selectedDayIndex]) return [];
    const windSpeedKmph = forecast[selectedDayIndex].wind.speed * 3.6;
    return suitableBeaches.filter(item =>
      !hasBadRoadAccess(item.beach) &&
      !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel)
    );
  }, [forecast, selectedDayIndex, suitableBeaches]);
  const hasRecommendedBeaches = recommendedSuitableBeaches.length > 0;

  useEffect(() => {
    if (!hasRecommendedBeaches && sortBy === 'recommended') {
      setSortBy('all');
    }
  }, [hasRecommendedBeaches, sortBy]);

  const currentBeaufort = forecast?.[selectedDayIndex] ? getBeaufortLevel(forecast[selectedDayIndex].wind.speed * 3.6) : 0;
  const isUnsafeWinter = isWinter && currentBeaufort > 4;
  const hasShownAlternativeRecommendations = Boolean(forecast?.[selectedDayIndex] && !isUnsafeWinter && recommendedSuitableBeaches.length > 1);
  const highlightedRecommendationIds = useMemo(() => {
    if (!forecast?.[selectedDayIndex] || isUnsafeWinter) return new Set<number>();
    return new Set(recommendedSuitableBeaches.slice(0, 4).map(item => item.beach.id));
  }, [forecast, selectedDayIndex, isUnsafeWinter, recommendedSuitableBeaches]);
  const filteredBeachesWithoutHighlights = useMemo(() => {
    if (highlightedRecommendationIds.size === 0) return filteredBeaches;
    return filteredBeaches.filter(beach => !highlightedRecommendationIds.has(beach.id));
  }, [filteredBeaches, highlightedRecommendationIds]);
  const headerWeatherMeta = useMemo(() => {
    if (!selectedIsland) return undefined;

    const selectedForecast = forecast?.[selectedDayIndex];
    if (!selectedForecast) {
      return `${suitableBeaches.length} ${homeCopy.beaches[language]}`;
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
      `${beaufortLevel}bf`,
      `${windSpeedMph}mph`,
      `${Math.round(selectedForecast.temp_max)}°C`,
      conditions,
    ].join(' · ');
  }, [selectedIsland, forecast, selectedDayIndex, suitableBeaches.length, homeCopy.beaches, language, t]);

  if ((beachesLoading || weatherLoading) && !weather) return <SkeletonLoader t={t} />;
  if (beachesError) return <ErrorDisplay message={beachesError} onRetry={() => window.location.reload()} t={t} />;

  if (view === 'detail' && detailBeach && forecast?.[selectedDayIndex]) {
    return (
      <BeachDetailPage 
        beach={detailBeach} allBeaches={selectedIsland?.beaches || []}
        dayForecast={forecast[selectedDayIndex]} hourlyForecast={forecast[selectedDayIndex].hourly} language={language} t={t}
        onBack={() => setView('home')} onBeachClick={(b) => setDetailBeach(b)}
        userLocation={userLocation} favorites={favorites} onToggleFavorite={handleToggleFavorite}
        preferences={preferences}
        islandName={selectedIsland?.name[language]}
      />
    );
  }

  const selectedIslandKey = selectedIsland?.name.en?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const cycladesBackground = CYCLADES_BACKGROUND_IMAGES[selectedIslandKey];

  return (
    <div className={`min-h-screen pb-28 md:pb-24 relative overflow-hidden transition-colors duration-500`}>
      <div
        className={`atmosphere ${cycladesBackground ? 'cyclades-atmosphere' : ''}`}
        style={cycladesBackground ? ({ '--cyclades-bg': `url(${cycladesBackground})` } as React.CSSProperties) : undefined}
      />

      <Header
        t={t} language={language} onLanguageChange={setLanguage}
        selectedIslandName={selectedIsland ? selectedIsland.name[language] : "..."}
        selectedIslandMeta={headerWeatherMeta}
        onOpenIslandSelector={() => setIsIslandSelectorOpen(true)} isWinter={isWinter}
      />

      {/* ===== COMPACT HERO ===== */}
      <section className="relative pt-24 sm:pt-24 pb-2 sm:pb-6 overflow-hidden">
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-sky-300/20 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* Location & beach count */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`max-w-3xl mx-auto ${selectedIsland ? 'mb-3 h-1 sm:h-2' : 'mb-5'}`}
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

      {/* ===== MAIN CONTENT ===== */}
      <main className="max-w-7xl mx-auto px-4 space-y-12 sm:space-y-16 relative z-10">
        <AnimatePresence mode="wait">
            <motion.div key={`${selectedIsland?.id}-${selectedDayIndex}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8 sm:space-y-16">

              {/* #1 Top Pick - Beach of the Day */}
              {forecast?.[selectedDayIndex] && !isUnsafeWinter && recommendedSuitableBeaches.length > 0 && (
                <>
                  <BeachOfTheDay
                    topBeach={recommendedSuitableBeaches[0]}
                    language={language}
                    t={t}
                    onShowDetails={(b) => { setDetailBeach(b); setView('detail'); }}
                    islandName={selectedIsland?.name[language] || ''}
                    windSpeed={forecast[selectedDayIndex].wind.speed}
                    temperature={forecast[selectedDayIndex].temp_max}
                  />
                  <div className="mt-3 md:hidden overflow-hidden rounded-3xl border border-white/55 bg-white/45 p-1 shadow-lg shadow-sky-900/10 backdrop-blur-xl">
                    <div className="h-44 w-full overflow-hidden rounded-[1.35rem]">
                      <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/50" />}>
                        <BeachMap
                          beaches={[recommendedSuitableBeaches[0]]}
                          center={[
                            recommendedSuitableBeaches[0].beach.coordinates.lat,
                            recommendedSuitableBeaches[0].beach.coordinates.lon
                          ]}
                          zoom={14}
                          userLocation={userLocation}
                          onBeachClick={(b) => { setDetailBeach(b); setView('detail'); }}
                          windSpeed={forecast[selectedDayIndex].wind.speed}
                          windDirection={degToCompass(forecast[selectedDayIndex].wind.deg)}
                          language={language}
                          compact
                        />
                      </Suspense>
                    </div>
                  </div>
                  {/* Quick preference filters */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="-mt-5 max-w-3xl mx-auto"
                  >
                    <PreferenceFilters preferences={preferences} onToggle={handleTogglePreference} t={t} />
                  </motion.div>
                </>
              )}

              {/* Top Recommendations */}
              {forecast?.[selectedDayIndex] && !isUnsafeWinter && recommendedSuitableBeaches.length > 1 && (
                <section className="!mt-5 space-y-4 sm:space-y-6">
                  <div className="flex min-h-11 w-full items-center justify-center rounded-full border border-white/45 bg-white/55 px-5 py-2.5 shadow-sm shadow-sky-900/5 ring-1 ring-white/35 backdrop-blur-xl sm:px-6">
                    <h2 className="w-full text-center font-heading text-sm font-bold leading-tight text-slate-600 sm:text-base">
                      {homeCopy.alternativeTitle[language]}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {recommendedSuitableBeaches.slice(1, 4).map((r, i) => (
                      <motion.div key={r.beach.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <BeachCard
                          beach={{...r.beach, distance: r.distance}} isExposed={r.isExposed} language={language} t={t}
                          isCalm={r.score > 80} windSpeed={forecast[selectedDayIndex].wind.speed} temperature={forecast[selectedDayIndex].temp_max}
                          favorites={favorites} onToggleFavorite={handleToggleFavorite} islandName={selectedIsland!.name[language]}
                          onClick={() => { setDetailBeach(r.beach); setView('detail'); }}
                          exposureLevel={r.exposureLevel}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* AI Advisor - placed after the first beach picks */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="max-w-3xl mx-auto"
              >
                <AiBeachAdvisor allIslands={allIslands} selectedIsland={selectedIsland} weather={forecast?.[selectedDayIndex] || weather} userLocation={userLocation} language={language} />
              </motion.div>

              {isUnsafeWinter && <UnsafeConditionsMessage t={t} />}

              <WeatherSummary forecast={forecast} selectedDayIndex={selectedDayIndex} onDaySelect={setSelectedDayIndex} t={t} />

              <RecommendationSection
                beaches={filteredBeachesWithoutHighlights} language={language} t={t}
                windSpeed={forecast?.[selectedDayIndex]?.wind.speed || 0}
                windDirection={degToCompass(forecast?.[selectedDayIndex]?.wind.deg || 0)}
                islandName={selectedIsland?.name[language] || ''}
                onBeachClick={(b) => { setDetailBeach(b); setView('detail'); }}
                searchQuery={beachSearchQuery} onSearchChange={setBeachSearchQuery}
                sortBy={sortBy} onSortChange={setSortBy}
                activeFilters={selectedFilters} favorites={favorites} onToggleFavorite={handleToggleFavorite}
                showRecommendedOption={hasRecommendedBeaches}
                hasShownAlternativeRecommendations={hasShownAlternativeRecommendations}
              />

              {/* Map View */}
              <section id="map-section" className="space-y-6">
                <div className="space-y-2">
                  <h2 className="section-title">{homeCopy.mapTitle[language]}</h2>
                  <p className="section-subtitle">{homeCopy.mapSubtitle[language]}</p>
                </div>
                <div className="rounded-3xl overflow-hidden border border-white/60 dark:border-slate-800 shadow-lg">
                  <Suspense fallback={<div className="h-[450px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse" />}>
                    <BeachMap center={selectedIsland ? [selectedIsland.coordinates.lat, selectedIsland.coordinates.lon] : undefined} beaches={suitableBeaches} userLocation={userLocation} onBeachClick={(b) => { setDetailBeach(b); setView('detail'); }} windSpeed={forecast?.[selectedDayIndex]?.wind.speed || 0} windDirection={degToCompass(forecast?.[selectedDayIndex]?.wind.deg || 0)} language={language} />
                  </Suspense>
                </div>
              </section>

              <UsageInsights allBeaches={selectedIsland?.beaches || []} language={language} t={t} />
            </motion.div>
          </AnimatePresence>
      </main>

      {/* ===== MOBILE BOTTOM NAVIGATION ===== */}
      <MobileBottomNav
        language={language}
        activeTab={mobileTab}
        onTabChange={handleMobileTab}
        favoritesCount={favorites.length}
      />

      {/* ===== FLOATING ACTION BUTTONS (desktop only) ===== */}
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsPlannerOpen(true)}
          className="group relative p-4 bg-white dark:bg-slate-800 text-primary rounded-2xl shadow-lg hover:shadow-xl border border-sky-100 dark:border-slate-700 transition-all cursor-pointer"
          aria-label={homeCopy.tripPlanner[language]}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-heading font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {language === 'gr' ? 'Planner' : 'Planner'}
          </span>
        </motion.button>

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
      </div>

      {/* ===== MODALS ===== */}
      <ChatbotModal
        isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={chatMessages}
        onSend={handleChatSend} t={t} isLoading={chatMessages.some(m => m.id.startsWith('bot-loading'))}
        onNewChat={() => setChatMessages([])} suggestions={['Ποιες παραλίες είναι απάνεμες σήμερα;', 'Πού να πάω για snorkeling;']}
      />

      <IslandSelectorModal isOpen={isIslandSelectorOpen} onClose={() => setIsIslandSelectorOpen(false)} islands={allIslands} onSelect={selectIsland} t={t} language={language} onSelectNearest={handleSelectNearest} isFindingNearest={isFindingNearest} findNearestError={findNearestError} />

      <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} t={t}>
        <CombinedFilter initialSelectedFilters={selectedFilters} initialSortBy={sortBy} onApplyFilters={(f, s) => { setSelectedFilters(f); setSortBy(s); setIsFilterModalOpen(false); }} onClose={() => setIsFilterModalOpen(false)} t={t} isGettingLocation={false} locationError={null} />
      </FilterModal>
    </div>
  );
};

