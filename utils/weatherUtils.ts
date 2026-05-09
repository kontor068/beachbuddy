import { WindDirection, WaveCondition, ForecastItem, DailyForecast } from '../types';

export const processForecastData = (forecastItems: ForecastItem[]): DailyForecast[] => {
  if (!forecastItems || forecastItems.length === 0) return [];
  const dailyData: { [key: string]: { items: ForecastItem[], temps: number[] } } = {};
  forecastItems.forEach(item => {
    const dayString = new Date(item.dt * 1000).toLocaleDateString('en-CA');
    if (!dailyData[dayString]) dailyData[dayString] = { items: [], temps: [] };
    dailyData[dayString].items.push(item);
    // Safety check for item.main
    const temp = item.main?.temp ?? 20; 
    dailyData[dayString].temps.push(temp);
  });
  return Object.keys(dailyData).sort().map(dayString => {
    const info = dailyData[dayString];
    const midday = info.items.reduce((prev, curr) => Math.abs(new Date(curr.dt * 1000).getHours() - 13) < Math.abs(new Date(prev.dt * 1000).getHours() - 13) ? curr : prev);
    return { 
      date: new Date(dayString), 
      wind: midday.wind, 
      weather: midday.weather[0], 
      temp_max: info.temps.length > 0 ? Math.max(...info.temps) : 25, 
      temp_min: info.temps.length > 0 ? Math.min(...info.temps) : 15, 
      hourly: info.items 
    };
  }).slice(0, 6);
};

export const degToCompass = (deg: number): WindDirection => {
  const val = Math.floor((deg / 45) + 0.5);
  const arr: WindDirection[] = [
    WindDirection.N, WindDirection.NE, WindDirection.E, WindDirection.SE,
    WindDirection.S, WindDirection.SW, WindDirection.W, WindDirection.NW
  ];
  return arr[(val % 8)];
};

export const getBeaufortLevel = (speedKmph: number): number => {
    if (speedKmph < 1) return 0;
    if (speedKmph <= 5) return 1;
    if (speedKmph <= 11) return 2;
    if (speedKmph <= 19) return 3;
    if (speedKmph <= 28) return 4;
    if (speedKmph <= 38) return 5;
    if (speedKmph <= 49) return 6;
    if (speedKmph <= 61) return 7;
    if (speedKmph <= 74) return 8;
    if (speedKmph <= 88) return 9;
    if (speedKmph <= 102) return 10;
    if (speedKmph <= 117) return 11;
    return 12;
};

export const getWaveCondition = (isExposed: boolean, windSpeedKmph: number): WaveCondition => {
  const beaufortLevel = getBeaufortLevel(windSpeedKmph);

  if (!isExposed) {
    // Sheltered beaches are generally very calm.
    // They might get slightly choppy only in very strong general winds (6 Bft+).
    if (beaufortLevel >= 6) return 'moderate';
    return 'calm';
  } else {
    // For exposed beaches, conditions are directly related to wind strength.
    // We are being cautious: 4 Bft (Moderate Breeze) is now considered 'rough'
    // as it can create choppy conditions unsuitable for many swimmers.
    if (beaufortLevel >= 4) return 'rough';
    // 3 Bft (Gentle Breeze) will have noticeable wavelets.
    if (beaufortLevel >= 3) return 'moderate';
    // 0-2 Bft is considered calm.
    return 'calm';
  }
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

export const isWinterSeason = () => {
    const now = new Date();
    const month = now.getMonth();
    return (month === 9 && now.getDate() >= 15) || month > 9 || month < 2 || (month === 2 && now.getDate() <= 15);
};
