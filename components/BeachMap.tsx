import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Clock, Wind, Waves } from 'lucide-react';
import { SuitableBeach, Beach, LanguageCode } from '../types';

interface BeachMapProps {
  beaches: SuitableBeach[];
  userLocation?: { lat: number; lon: number };
  onBeachClick?: (beach: Beach) => void;
  center?: [number, number];
  zoom?: number;
  windSpeed?: number;
  windDirection?: string;
  language?: LanguageCode;
  compact?: boolean;
}

// Component to update map center when user location changes
const RecenterMap = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Custom marker icons based on score
const createBeachIcon = (score: number) => {
  let colorClass = 'bg-rose-500';
  let ringClass = 'ring-rose-200';
  
  if (score >= 80) {
    colorClass = 'bg-emerald-500';
    ringClass = 'ring-emerald-200';
  } else if (score >= 60) {
    colorClass = 'bg-amber-500';
    ringClass = 'ring-amber-200';
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

// Custom marker icons based on exposure
const createExposureIcon = (exposureLevel?: string) => {
  let colorClass = 'bg-rose-500';
  let ringClass = 'ring-rose-200';
  
  if (exposureLevel === 'protected') {
    colorClass = 'bg-emerald-500';
    ringClass = 'ring-emerald-200';
  } else if (exposureLevel === 'partial') {
    colorClass = 'bg-amber-500';
    ringClass = 'ring-amber-200';
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

const UserLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div class="bg-blue-500 w-5 h-5 rounded-full border-2 border-white shadow-xl ring-4 ring-blue-200 animate-pulse"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

const BeachMap: React.FC<BeachMapProps> = ({ 
  beaches, 
  userLocation, 
  onBeachClick,
  center: propCenter,
  zoom: propZoom,
  windSpeed,
  windDirection,
  language = 'en',
  compact = false
}) => {
  const [mapMode, setMapMode] = useState<'recommendation' | 'wind'>('recommendation');
  const directionLabels: Record<string, string> = {
    North: 'Βόρειος',
    Northeast: 'Βορειοανατολικός',
    East: 'Ανατολικός',
    Southeast: 'Νοτιοανατολικός',
    South: 'Νότιος',
    Southwest: 'Νοτιοδυτικός',
    West: 'Δυτικός',
    Northwest: 'Βορειοδυτικός'
  };
  const localizedWindDirection = language === 'gr' && windDirection
    ? (directionLabels[windDirection] || windDirection)
    : windDirection;
  const exposureLabel = (exposureLevel?: string) => {
    const labels = {
      protected: { en: 'Protected', gr: 'Προστατευμένη', de: 'Geschutzt', it: 'Riparata', fr: 'Abritée' },
      partial: { en: 'Partial', gr: 'Μερική', de: 'Teilweise', it: 'Parziale', fr: 'Partielle' },
      exposed: { en: 'Exposed', gr: 'Εκτεθειμένη', de: 'Exponiert', it: 'Esposta', fr: 'Exposee' },
    };
    return labels[(exposureLevel || 'exposed') as keyof typeof labels][language];
  };
  const mapCopy = {
    recommendationMode: { en: 'Recommendation Mode', gr: 'Προτάσεις', de: 'Empfehlungen', it: 'Consigli', fr: 'Recommandations' },
    recommendationShort: { en: 'Best', gr: 'Προτάσεις', de: 'Top', it: 'Top', fr: 'Top' },
    windMode: { en: 'Wind Protection Mode', gr: 'Προστασία από άνεμο', de: 'Windschutz', it: 'Protezione dal vento', fr: 'Protection du vent' },
    windShort: { en: 'Wind', gr: 'Άνεμος', de: 'Wind', it: 'Vento', fr: 'Vent' },
    youAreHere: { en: 'You are here', gr: 'Είστε εδώ', de: 'Sie sind hier', it: 'Sei qui', fr: 'Vous etes ici' },
    bestTime: { en: 'Best Time', gr: 'Καλύτερη ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    view: { en: 'View', gr: 'Προβολή', de: 'Ansehen', it: 'Vedi', fr: 'Voir' },
    suitability: { en: 'Suitability Score', gr: 'Βαθμός καταλληλότητας', de: 'Eignungswert', it: 'Punteggio idoneita', fr: 'Score de pertinence' },
    excellent: { en: 'Excellent (80+)', gr: 'Εξαιρετική (80+)', de: 'Ausgezeichnet (80+)', it: 'Eccellente (80+)', fr: 'Excellent (80+)' },
    good: { en: 'Good (60-79)', gr: 'Καλή (60-79)', de: 'Gut (60-79)', it: 'Buona (60-79)', fr: 'Bon (60-79)' },
    notRecommended: { en: 'Not Recommended (<60)', gr: 'Δεν προτείνεται (<60)', de: 'Nicht empfohlen (<60)', it: 'Non consigliata (<60)', fr: 'Non recommandee (<60)' },
    exposure: { en: 'Wind Exposure', gr: 'Έκθεση στον άνεμο', de: 'Windexposition', it: 'Esposizione al vento', fr: 'Exposition au vent' },
    current: { en: 'Current', gr: 'Τώρα', de: 'Aktuell', it: 'Ora', fr: 'Actuel' },
    at: { en: 'at', gr: 'στα', de: 'bei', it: 'a', fr: 'a' },
  };

  // Calculate average center of all beaches if they exist
  let avgCenter: [number, number] | null = null;
  if (beaches.length > 0) {
    const sumLat = beaches.reduce((sum, b) => sum + b.beach.coordinates.lat, 0);
    const sumLon = beaches.reduce((sum, b) => sum + b.beach.coordinates.lon, 0);
    avgCenter = [sumLat / beaches.length, sumLon / beaches.length];
  }

  // Default center (Greece) if no user location
  const defaultCenter: [number, number] = [38.0, 24.0];
  
  const center: [number, number] = propCenter || (avgCenter || (userLocation 
    ? [userLocation.lat, userLocation.lon] 
    : defaultCenter));
  
  const zoom = propZoom || (avgCenter ? 10 : (userLocation ? 10 : 6));

  return (
    <div className={`relative w-full overflow-hidden border border-slate-200 dark:border-slate-800 z-0 ${
      compact
        ? 'h-full rounded-3xl shadow-none'
        : 'h-[360px] rounded-2xl shadow-lg sm:h-[500px]'
    }`}>
      
      {/* Map Mode Toggle */}
      {!compact && (
      <div className="absolute left-3 right-3 top-3 z-[1000] flex overflow-hidden rounded-full border border-white/60 bg-white/80 p-1 shadow-lg shadow-sky-900/10 backdrop-blur-xl sm:left-auto sm:right-4 sm:rounded-xl sm:border-slate-200 sm:p-0 dark:border-slate-700 dark:bg-slate-900/85">
        <button
          onClick={() => setMapMode('recommendation')}
          className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:flex-none sm:rounded-none sm:px-3 sm:py-2 sm:text-xs ${mapMode === 'recommendation' ? 'bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-600 hover:bg-white/60 sm:hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          <span className="sm:hidden">{mapCopy.recommendationShort[language]}</span>
          <span className="hidden sm:inline">{mapCopy.recommendationMode[language]}</span>
        </button>
        <button
          onClick={() => setMapMode('wind')}
          className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:flex-none sm:rounded-none sm:px-3 sm:py-2 sm:text-xs ${mapMode === 'wind' ? 'bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-600 hover:bg-white/60 sm:hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          <span className="sm:hidden">{mapCopy.windShort[language]}</span>
          <span className="hidden sm:inline">{mapCopy.windMode[language]}</span>
        </button>
      </div>
      )}

      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={false} 
        className="w-full h-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <RecenterMap center={center} zoom={zoom} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={UserLocationIcon}>
            <Popup>
              <div className="text-center">
                <p className="font-bold text-slate-900">{mapCopy.youAreHere[language]}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Beach Markers */}
        {beaches.map((item) => (
          <Marker 
            key={item.beachId} 
            position={[item.beach.coordinates.lat, item.beach.coordinates.lon]}
            icon={mapMode === 'recommendation' ? createBeachIcon(item.score) : createExposureIcon(item.exposureLevel)}
            eventHandlers={{
              click: () => {
                // Optional: Center map on click?
              },
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1 min-w-[200px]">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
                  {mapMode === 'recommendation' ? (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      item.score >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                      item.score >= 60 ? 'bg-amber-100 text-amber-700' : 
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {item.score}%
                    </span>
                  ) : (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      item.exposureLevel === 'protected' ? 'bg-emerald-100 text-emerald-700' : 
                      item.exposureLevel === 'partial' ? 'bg-amber-100 text-amber-700' : 
                      'bg-rose-100 text-rose-700'
                    }`}>
                      <Wind className="w-3 h-3" />
                      {exposureLabel(item.exposureLevel)}
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-slate-600 mb-3 line-clamp-3">
                  {item.explanation}
                </p>

                {item.bestBeachTime && (
                  <div className="mb-3 p-2 bg-cyan-50 rounded-lg border border-cyan-100">
                    <div className="flex items-center gap-1 text-cyan-700 text-[10px] font-bold mb-0.5">
                      <Clock className="w-3 h-3" />
                      {mapCopy.bestTime[language]}: {item.bestBeachTime.bestStart} - {item.bestBeachTime.bestEnd}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  {item.distance !== undefined && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {item.distance.toFixed(1)} km
                    </span>
                  )}
                  
                  {onBeachClick && (
                    <button 
                      onClick={() => onBeachClick(item.beach)}
                      className="text-xs bg-cyan-600 text-white px-2 py-1 rounded hover:bg-cyan-700 transition-colors flex items-center gap-1"
                    >
                      {mapCopy.view[language]}
                      <Navigation className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legend Overlay */}
      {!compact && (
      <div className="absolute bottom-3 left-3 z-[1000] max-w-[210px] rounded-2xl border border-white/60 bg-white/85 p-2 text-[10px] shadow-lg shadow-sky-900/10 backdrop-blur-xl sm:bottom-4 sm:left-4 sm:max-w-none sm:rounded-xl sm:border-slate-200 sm:p-3 sm:text-xs dark:border-slate-700 dark:bg-slate-900/90">
        {mapMode === 'recommendation' ? (
          <>
            <h4 className="mb-1.5 font-bold text-slate-900 sm:mb-2 dark:text-white">{mapCopy.suitability[language]}</h4>
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{mapCopy.excellent[language]}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{mapCopy.good[language]}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{mapCopy.notRecommended[language]}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h4 className="mb-1.5 flex items-center gap-1 font-bold text-slate-900 sm:mb-2 dark:text-white">
              <Wind className="w-3 h-3" />
              {mapCopy.exposure[language]}
            </h4>
            {windSpeed !== undefined && windDirection && (
              <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-slate-500 sm:mb-2 sm:pb-2 dark:border-slate-700 dark:text-slate-400">
                {mapCopy.current[language]}: {localizedWindDirection} {mapCopy.at[language]} {windSpeed.toFixed(1)} km/h
              </div>
            )}
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{exposureLabel('protected')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{exposureLabel('partial')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-rose-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{exposureLabel('exposed')}</span>
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
};

export default BeachMap;
