import { useState, useCallback, useEffect } from 'react';
import { WeatherData, DailyForecast, Island, LanguageCode } from '../types';
import { fetchWeatherData, getMockWeatherData, fetchForecastData, getMockForecastData } from '../services/weatherService';
import { processForecastData } from '../utils/weatherUtils'; // Assuming I move this helper or recreate it
import { translations } from '../translations';

export const useWeather = (selectedIsland: Island | undefined, language: LanguageCode) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const t = translations[language];

  const loadWeatherData = useCallback(async () => {
    if (!selectedIsland) return;
    setLoading(true);
    try {
      const [w, f] = await Promise.all([
        fetchWeatherData(selectedIsland.coordinates.lat, selectedIsland.coordinates.lon),
        fetchForecastData(selectedIsland.coordinates.lat, selectedIsland.coordinates.lon)
      ]);
      setWeather(w);
      setForecast(processForecastData(f));
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setWeather(getMockWeatherData());
      setForecast(processForecastData(getMockForecastData()));
      setLastUpdated(new Date());
      setError(t.mockDataMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedIsland, t]);

  useEffect(() => {
    if (selectedIsland) {
      loadWeatherData();
    } else {
      setLoading(false);
    }
  }, [selectedIsland, loadWeatherData]);

  return {
    weather,
    forecast,
    loading,
    error,
    selectedDayIndex,
    setSelectedDayIndex,
    loadWeatherData,
    lastUpdated
  };
};
