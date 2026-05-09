import React, { useMemo, useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, MapPin, Star, Wind, Waves, Thermometer, 
  Clock, Trees, Utensils, Users, Search, 
  Info, Navigation, Share2, Heart, ChevronRight, ThumbsUp, ThumbsDown, CheckCircle2, Sparkles
} from 'lucide-react';
import { 
  Beach, LanguageCode, Translation, WindDirection, 
  ForecastItem, WaveCondition, BeachType, WeatherData, DailyForecast, UserPreferences 
} from '../types';
import { 
  calculateBestBeachTime, 
  getTopRecommendedBeaches, 
  generateBeachExplanation, 
  calculateBeachScore 
} from '../services/recommendationService';
import { generateBeachDayPlan } from '../services/beachPlannerService';
import { BeachDayPlanner } from '../components/BeachDayPlanner';
import { degToCompass, getWaveCondition, calculateDistance } from '../utils/weatherUtils';
import { StarRating } from '../components/BeachCard';
import { trackEvent, storeFeedback } from '../services/analyticsService';

// Lazy load map to avoid blocking main thread
const BeachMap = React.lazy(() => import('../components/BeachMap'));

import { BeachConditionScore } from '../components/BeachConditionScore';
import { getBeachPhotos } from '../services/beachPhotos';

// Helper to convert ForecastItem to WeatherData for recommendation service
const forecastToWeather = (item: ForecastItem): WeatherData => ({
  wind: { speed: item.wind.speed, deg: item.wind.deg },
  weather: item.weather[0],
  main: { temp: item.main.temp }
});

import { openNavigation } from '../utils/navigation';
import { displayBeachName } from '../utils/localization';

interface BeachDetailPageProps {
  beach: Beach;
  allBeaches: Beach[];
  dayForecast: DailyForecast;
  hourlyForecast: ForecastItem[];
  language: LanguageCode;
  t: Translation;
  onBack: () => void;
  onBeachClick: (beach: Beach) => void;
  userLocation?: { lat: number; lon: number };
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  preferences?: UserPreferences;
  islandName?: string;
}

export const BeachDetailPage: React.FC<BeachDetailPageProps> = ({
  beach,
  allBeaches,
  dayForecast,
  hourlyForecast,
  language,
  t,
  onBack,
  onBeachClick,
  userLocation,
  favorites,
  onToggleFavorite,
  preferences,
  islandName
}) => {
  const isFavorite = favorites.includes(beach.id);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const beachDisplayName = displayBeachName(beach.name, language);
  const islandDisplayName = islandName || 'Greece';
  const copy = {
    whyToday: { en: 'Why this beach today?', gr: 'Γιατί αυτή η παραλία σήμερα;', de: 'Warum dieser Strand heute?', it: 'Perche questa spiaggia oggi?', fr: 'Pourquoi cette plage aujourd hui ?' },
    sea: { en: 'Sea', gr: 'Θάλασσα', de: 'Meer', it: 'Mare', fr: 'Mer' },
    airTemp: { en: 'Air temperature', gr: 'Θερμοκρασία αέρα', de: 'Lufttemperatur', it: 'Temperatura aria', fr: 'Temperature de l air' },
    bestTime: { en: 'Best Time', gr: 'Ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    toVisit: { en: 'To visit', gr: 'Για επίσκεψη', de: 'Zum Besuch', it: 'Per visitare', fr: 'Pour visiter' },
    bestSwim: { en: 'Best swimming time today', gr: 'Καλύτερη ώρα για μπάνιο σήμερα', de: 'Beste Badezeit heute', it: 'Ora migliore per nuotare oggi', fr: 'Meilleur moment pour se baigner aujourd hui' },
    feedbackTitle: { en: 'How were the conditions today?', gr: 'Πώς ήταν οι συνθήκες σήμερα;', de: 'Wie waren die Bedingungen heute?', it: 'Com erano le condizioni oggi?', fr: 'Comment etaient les conditions aujourd hui ?' },
    feedbackText: { en: 'Your feedback helps us improve our recommendations for everyone.', gr: 'Η γνώμη σου μας βοηθά να βελτιώνουμε τις προτάσεις για όλους.', de: 'Dein Feedback hilft uns, die Empfehlungen fur alle zu verbessern.', it: 'Il tuo feedback ci aiuta a migliorare i consigli per tutti.', fr: 'Votre avis nous aide a ameliorer les recommandations pour tous.' },
    planner: { en: 'Day Planner', gr: 'Πλάνο ημέρας', de: 'Tagesplan', it: 'Piano della giornata', fr: 'Programme de la journee' },
    nearby: { en: 'Nearby Recommendations', gr: 'Κοντινές προτάσεις', de: 'Empfehlungen in der Nahe', it: 'Consigli nelle vicinanze', fr: 'Recommandations proches' },
  };

  // Scroll to top on mount and track view
  useEffect(() => {
    window.scrollTo(0, 0);
    trackEvent('beach_viewed', beach.id, { name: beachDisplayName }, userLocation);
  }, [beach.id]);

  // Swipe-right to go back (mobile)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
      // Swipe right > 80px, mostly horizontal
      if (dx > 80 && dy < 60 && touchStartRef.current.x < 50) {
        onBack();
      }
      touchStartRef.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onBack]);

  const handleFeedback = (isAccurate: boolean) => {
    storeFeedback(beach.id, isAccurate ? 'accurate' : 'not_accurate');
    setFeedbackSubmitted(true);
  };

  const handleNavigation = () => {
    trackEvent('beach_navigated', beach.id, { name: beachDisplayName }, userLocation);
    openNavigation(beach);
  };

  // 1. Calculate Conditions & Scores
  const currentWeather = hourlyForecast[0];
  const weatherData = dayForecast || forecastToWeather(currentWeather);
  const displayTemp = 'temp_max' in weatherData ? weatherData.temp_max : weatherData.main.temp;
  const windSpeedKmh = weatherData.wind.speed * 3.6;
  const windDir = degToCompass(weatherData.wind.deg);
  const isExposed = !beach.protectedFrom.includes(windDir as WindDirection);
  const waveCondition = getWaveCondition(isExposed, windSpeedKmh);
  const windDirectionLabel = t.windDirections[windDir as WindDirection] || windDir;
  const waveConditionLabel = t.waveConditions[waveCondition];
  const conditionSubValue = {
    calm: { en: 'Calm waters', gr: 'Ήρεμα νερά', de: 'Ruhiges Wasser', it: 'Acque calme', fr: 'Eaux calmes' },
    moderate: { en: 'Moderate waves', gr: 'Μέτριος κυματισμός', de: 'Massige Wellen', it: 'Onde moderate', fr: 'Vagues moderees' },
    rough: { en: 'Rough waters', gr: 'Έντονος κυματισμός', de: 'Unruhiges Wasser', it: 'Mare mosso', fr: 'Mer agitee' },
  }[waveCondition][language];
  const { score, crowdLevel, exposureLevel } = calculateBeachScore(beach, weatherData, userLocation, preferences);
  const scoreTodayLabel = score > 85
    ? { en: 'Excellent Today', gr: 'Εξαιρετικά σήμερα', de: 'Heute ausgezeichnet', it: 'Eccellente oggi', fr: 'Excellent aujourd hui' }[language]
    : { en: 'Good Today', gr: 'Καλή επιλογή σήμερα', de: 'Heute gut', it: 'Buona scelta oggi', fr: 'Bon choix aujourd hui' }[language];
  const aiExplanation = generateBeachExplanation(beach, weatherData, score, userLocation, language);

  // Real beach photos (from Wikimedia Commons) or empty array for fallback
  const realPhotos = useMemo(() => getBeachPhotos(beach.name.gr, beach.name.en, beach.id, 5, islandName), [beach.id, beach.name.en, beach.name.gr, islandName]);
  
  // 2. Best Time & Planner
  const bestTime = useMemo(() => calculateBestBeachTime(hourlyForecast), [hourlyForecast]);
  const dayPlan = useMemo(() => generateBeachDayPlan(beach, hourlyForecast), [beach, hourlyForecast]);
  const bestTimeLabel = bestTime?.bestStart || { en: 'Morning', gr: 'Πρωί', de: 'Morgen', it: 'Mattina', fr: 'Matin' }[language];
  const bestTimeReason = bestTime
    ? (language === 'gr' ? 'Οι συνθήκες είναι καλές για μπάνιο αυτό το διάστημα.' : bestTime.reason)
    : '';

  // 3. Nearby Beaches
  const nearbyBeaches = useMemo(() => {
    const others = allBeaches.filter(b => b.id !== beach.id);
    const nearby = others.filter(b => {
      const dist = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
      return dist <= 20; // 20km radius
    });

    // Get top 3 from these nearby beaches
    const recommendations = getTopRecommendedBeaches(nearby, weatherData, userLocation, hourlyForecast, preferences);
    return recommendations.slice(0, 3).map(rec => {
      const b = nearby.find(nb => nb.id === rec.beachId);
      if (!b) return null;
      const dist = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
      return { ...rec, beach: b, distance: dist };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [allBeaches, beach, weatherData, userLocation, hourlyForecast]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: beachDisplayName,
          text: aiExplanation,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[180px] sm:max-w-[300px]">
          {beachDisplayName}
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onToggleFavorite(beach.id)}
            className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button 
            onClick={handleShare}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Share2 className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        
        {/* 1. Beach Header & AI Explanation */}
        <section className="space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full">
                  {scoreTodayLabel}
                </span>
                
                {/* Crowd Level Badge */}
                {crowdLevel && (
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
                    crowdLevel === 'high' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                    crowdLevel === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                    'bg-emerald-50 border-emerald-100 text-emerald-600'
                  }`}>
                    <span className="text-[10px] font-black">
                      {t.crowdLevels[crowdLevel]}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <StarRating rating={beach.rating} />
                <span className="text-sm font-bold text-slate-900 ml-1">{beach.rating}</span>
              </div>
            </div>
            <h2 className="text-4xl font-heading font-extrabold text-slate-900 leading-tight">
              {beachDisplayName}
            </h2>
            <p className="text-slate-500 font-medium flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {islandDisplayName}
            </p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-600 rounded-2xl text-white shadow-lg shadow-cyan-200">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">
                  {copy.whyToday[language]}
                </h3>
                <p className="text-slate-600 leading-relaxed italic">
                  "{aiExplanation}"
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <BeachConditionScore
              isExposed={isExposed}
              windSpeed={windSpeedKmh}
              temperature={displayTemp}
              exposureLevel={exposureLevel}
              language={language}
            />
          </div>
        </section>

        {/* 2. Photo Gallery */}
        {realPhotos.length > 0 && (
        <section className="space-y-4">
          <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden shadow-xl">
            <img
              src={realPhotos[0]}
              alt={beachDisplayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </div>
          {realPhotos.length > 1 && (
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {realPhotos.slice(1).map((url, i) => (
              <div key={i} className="flex-shrink-0 w-32 aspect-square rounded-2xl overflow-hidden shadow-md">
                <img
                  src={url}
                  alt={`${beachDisplayName} ${i + 2}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
          )}
        </section>
        )}

        {/* 3. Today's Conditions */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ConditionCard 
            icon={<Wind className="w-5 h-5 text-blue-500" />}
            label={t.currentWind}
            value={`${windSpeedKmh.toFixed(0)} km/h`}
            subValue={windDirectionLabel}
          />
          <ConditionCard 
            icon={<Waves className="w-5 h-5 text-cyan-500" />}
            label={copy.sea[language]}
            value={waveConditionLabel}
            subValue={conditionSubValue}
          />
          <ConditionCard 
            icon={<Thermometer className="w-5 h-5 text-orange-500" />}
            label={t.temperatureLabel}
            value={`${displayTemp.toFixed(0)}°C`}
            subValue={copy.airTemp[language]}
          />
          <ConditionCard 
            icon={<Clock className="w-5 h-5 text-emerald-500" />}
            label={copy.bestTime[language]}
            value={bestTimeLabel}
            subValue={copy.toVisit[language]}
          />
        </section>

        {/* 4. Best Time Today */}
        {bestTime && (
          <section className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-100">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900">{copy.bestSwim[language]}</h3>
              <p className="text-emerald-700 font-bold text-xl">
                {bestTime.bestStart} – {bestTime.bestEnd}
              </p>
              <p className="text-emerald-600 text-sm mt-1">{bestTimeReason}</p>
            </div>
          </section>
        )}

        {/* 5. Beach Features */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 px-2">{t.beachCharacteristicsTitle}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FeatureItem icon={<Sparkles size={18} />} label={t.filterOptions.sandy} active={beach.beachType === 'sandy'} />
            <FeatureItem icon={<Trees size={18} />} label={t.filterOptions.naturalShade} active={beach.amenities.naturalShade} />
            <FeatureItem icon={<Utensils size={18} />} label={t.filterOptions.taverna} active={beach.amenities.taverna} />
            <FeatureItem icon={<Users size={18} />} label={t.userPreferences.familyFriendly} active={beach.characteristics.shallowWaters} />
            <FeatureItem icon={<Search size={18} />} label="Snorkeling" active={beach.characteristics.deepWaters} />
            <FeatureItem icon={<Wind size={18} />} label={t.shelteredTooltip} active={!isExposed} />
          </div>
        </section>

        {/* 6. Map Location */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 px-2">{t.location}</h3>
          <div className="h-[300px] w-full rounded-[2.5rem] overflow-hidden shadow-inner border border-slate-100">
            <React.Suspense fallback={<div className="w-full h-full bg-slate-100 animate-pulse" />}>
              <BeachMap 
                beaches={[{ 
                  beachId: beach.id,
                  name: beachDisplayName,
                  score,
                  explanation: aiExplanation,
                  isExposed,
                  beach,
                  bestBeachTime: bestTime
                }]} 
                userLocation={userLocation}
                center={[beach.coordinates.lat, beach.coordinates.lon]}
                zoom={14}
                language={language}
              />
            </React.Suspense>
          </div>
          <button 
            onClick={handleNavigation}
            className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-cyan-600 transition-colors shadow-lg"
          >
            <Navigation className="w-5 h-5" />
            {t.navigate}
          </button>
        </section>

        {/* Feedback System */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-heading font-bold text-slate-900">{copy.feedbackTitle[language]}</h3>
            <p className="text-slate-500 text-sm">{copy.feedbackText[language]}</p>
          </div>

          {feedbackSubmitted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-4 space-y-3 text-emerald-600"
            >
              <CheckCircle2 className="w-12 h-12" />
              <p className="font-bold">{{ en: 'Thank you for your feedback!', gr: 'Ευχαριστούμε για το feedback!', de: 'Danke fur dein Feedback!', it: 'Grazie per il feedback!', fr: 'Merci pour votre avis !' }[language]}</p>
            </motion.div>
          ) : (
            <div className="flex gap-4">
              <button 
                onClick={() => handleFeedback(true)}
                className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-emerald-100 text-emerald-700 font-bold hover:bg-emerald-50 transition-all active:scale-95"
              >
                <ThumbsUp className="w-5 h-5" />
                {{ en: 'Accurate', gr: 'Σωστό', de: 'Stimmt', it: 'Corretto', fr: 'Exact' }[language]}
              </button>
              <button 
                onClick={() => handleFeedback(false)}
                className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-rose-100 text-rose-700 font-bold hover:bg-rose-50 transition-all active:scale-95"
              >
                <ThumbsDown className="w-5 h-5" />
                {{ en: 'Not accurate', gr: 'Όχι σωστό', de: 'Stimmt nicht', it: 'Non corretto', fr: 'Pas exact' }[language]}
              </button>
            </div>
          )}
        </section>

        {/* 7. Beach Day Planner */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 px-2">{copy.planner[language]}</h3>
          <BeachDayPlanner plan={dayPlan} beachName={beachDisplayName} language={language} />
        </section>

        {/* 8. Nearby Beaches */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 px-2">{copy.nearby[language]}</h3>
          <div className="space-y-4">
            {nearbyBeaches.length > 0 ? (
              <>
                <p className="text-slate-500 text-sm px-2 italic">
                  {language === 'gr' ? `Άλλες καλές επιλογές σε απόσταση 20km από ${beachDisplayName}:` : `Other great spots within 20km of ${beachDisplayName}:`}
                </p>
                <div className="flex flex-col gap-4">
                  {nearbyBeaches.map((item) => (
                    <div 
                      key={item.beachId} 
                      onClick={() => onBeachClick(item.beach)}
                      className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between hover:border-cyan-200 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-sky-200 to-cyan-100 flex-shrink-0">
                          {(() => {
                            const photos = getBeachPhotos(item.beach.name.gr, item.beach.name.en, item.beachId, 1, islandName);
                            return photos.length > 0 ? (
                              <img
                                src={photos[0]}
                                alt={displayBeachName(item.beach.name, language)}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Waves className="w-6 h-6 text-sky-400" />
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{displayBeachName(item.beach.name, language)}</h4>
                          <p className="text-xs text-slate-500">
                            {item.distance?.toFixed(1)} km {{ en: 'away', gr: 'μακριά', de: 'entfernt', it: 'di distanza', fr: 'de distance' }[language]} • {item.score >= 80 ? scoreTodayLabel : { en: 'Good Today', gr: 'Καλή σήμερα', de: 'Heute gut', it: 'Buona oggi', fr: 'Bonne aujourd hui' }[language]}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-cyan-600 transition-colors" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm px-2 italic">{{ en: 'No other beaches nearby.', gr: 'Δεν βρέθηκαν άλλες κοντινές παραλίες.', de: 'Keine weiteren Strande in der Nahe.', it: 'Nessun altra spiaggia vicina.', fr: 'Aucune autre plage a proximite.' }[language]}</p>
            )}
          </div>
        </section>

      </main>
    </div>
  );
};

interface ConditionCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
}

const ConditionCard: React.FC<ConditionCardProps> = ({ icon, label, value, subValue }) => (
  <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-1">
    <div className="p-2 bg-slate-50 rounded-xl mb-1">
      {icon}
    </div>
    <span className="text-[10px] font-black text-slate-400">{label}</span>
    <span className="text-lg font-bold text-slate-900">{value}</span>
    <span className="text-[10px] font-medium text-slate-500">{subValue}</span>
  </div>
);

interface FeatureItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, label, active }) => (
  <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
    active 
      ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
      : 'bg-slate-50 border-transparent text-slate-400 opacity-50'
  }`}>
    <div className={`${active ? 'text-cyan-600' : 'text-slate-300'}`}>
      {icon}
    </div>
    <span className="text-xs font-bold">{label}</span>
  </div>
);
