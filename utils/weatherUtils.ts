import { WindDirection, WaveCondition, ForecastItem, DailyForecast, MarineForecast } from '../types';
import { athensNow } from './athensTime';

const maxNumber = (values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return valid.length > 0 ? Math.max(...valid) : undefined;
};

const averageNumber = (values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return undefined;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

export const summarizeDailyMarine = (items: ForecastItem[]): MarineForecast | undefined => {
  const marineItems = items
    .map(item => item.marine)
    .filter((marine): marine is MarineForecast => Boolean(marine));

  if (marineItems.length === 0) return undefined;

  const maxWaveHeight = maxNumber(marineItems.map(item => item.waveHeightM));
  const maxSwellHeight = maxNumber(marineItems.map(item => item.swellWaveHeightM));
  const maxWavePeriod = maxNumber(marineItems.map(item => item.wavePeriodS));
  const highestWaveItem = marineItems.find(item => item.waveHeightM === maxWaveHeight) || marineItems[0];

  return {
    waveHeightM: maxWaveHeight,
    waveDirectionDeg: highestWaveItem.waveDirectionDeg,
    wavePeriodS: maxWavePeriod,
    swellWaveHeightM: maxSwellHeight,
    swellWaveDirectionDeg: highestWaveItem.swellWaveDirectionDeg,
    // Day max, like the heights: conservative for ground-swell detection (a day
    // with any long-period hours counts as a swell day).
    swellWavePeriodS: maxNumber(marineItems.map(item => item.swellWavePeriodS)),
    seaSurfaceTemperatureC: averageNumber(marineItems.map(item => item.seaSurfaceTemperatureC)),
    source: 'open-meteo-marine',
  };
};

/**
 * Give one day's forecast a different SEA, and nothing else.
 *
 * A beach's wave comes from its own shore (utils/marineSamplePoints); this function leaves the
 * wind, temperature and weather exactly as they were, BY REFERENCE, on purpose.
 * scripts/validateBeachMarineResolution.mjs asserts identity, not deep equality, because a copy
 * that happens to match today is a copy that can drift tomorrow.
 *
 * The wind does move per beach too, since 02/08/2026 — but through its own deliberate function
 * below (applyBeachWindToDailyForecast), fed by the cluster forecasts and guarded by its own
 * gate. The two stay separate exactly as RULE 4 of that validator demands: a wind that arrives
 * by riding along inside a change about the SEA is a wind nobody chose.
 *
 * Why the hourly array has to be rebuilt and not just the daily summary: App's
 * getSelectedHourMarine deliberately refuses to fall back to the daily figure for wave fields
 * (the daily value is the day's MAX, which would make a calm afternoon look choppy), and the
 * hour slider is never idle. A day-level swap alone would be discarded on every render.
 *
 * An hour the beach series does not cover keeps the region's WATER TEMPERATURE and loses its
 * wave — the same split getSelectedHourMarine makes. Keeping the region's wave there would be
 * the original defect in miniature; dropping it lets the beach's own fetch-limited SMB estimate
 * stand, which is the documented, honest fallback.
 *
 * Returns the base object unchanged when there is nothing to swap, so a beach with no sea data
 * of its own is byte-identical to today.
 */
export const applyMarineToDailyForecast = (
  base: DailyForecast,
  beachMarineItems: ReadonlyArray<{ dt_txt: string; marine?: MarineForecast }>
): DailyForecast => {
  if (!beachMarineItems.length || !base.hourly?.length) return base;

  const marineByTime = new Map(beachMarineItems.map(item => [item.dt_txt, item.marine]));
  let swappedAny = false;

  const hourly = base.hourly.map(item => {
    const beachMarine = marineByTime.get(item.dt_txt);
    if (beachMarine) {
      swappedAny = true;
      return { ...item, marine: beachMarine };
    }
    if (!item.marine) return item;
    // Uncovered hour: keep the water temperature (a regional quantity), drop the region's wave.
    swappedAny = true;
    return {
      ...item,
      marine: {
        seaSurfaceTemperatureC: item.marine.seaSurfaceTemperatureC,
        source: item.marine.source,
      } as MarineForecast,
    };
  });

  if (!swappedAny) return base;

  return { ...base, hourly, marine: summarizeDailyMarine(hourly) };
};

/**
 * Give one day's forecast a different WIND, and nothing else.
 *
 * The twin of the function above, and deliberately NOT part of it. Until 02/08/2026 every beach
 * on a region's page printed one Beaufort figure, measured at the region's geometric centre:
 * 1.532 of 2.850 beaches (53,8%) sit in a different cell of the weather model than that point,
 * and measured nationally over 8.550 beach-hours it is at least one Beaufort away from the
 * beach's own shore 35,9% of the time. The map had already moved to each beach's own reading;
 * the card beside it had not, so «2 Μπφ» could belong to a shore 40 km away.
 *
 * `windSource` is that beach's cluster forecast, already adjusted to the same hour as `base`.
 * Both levels are swapped — the day headline and every hour the beach series covers — because a
 * forecast object holding the beach's wind on top and the region's underneath is the exact
 * "same object, two winds" trap that produced a card and a map disagreeing about one beach.
 *
 * Everything else, including the whole marine block, is returned by reference. An hour the beach
 * series does not cover keeps the region's wind: a missing reading must never read as calm.
 * Returns the base object unchanged when there is nothing to swap, so a beach with no cluster of
 * its own — no geometry, a failed fetch, the first paint — is byte-identical to before.
 */
export const applyBeachWindToDailyForecast = (
  base: DailyForecast,
  windSource: Pick<DailyForecast, 'wind' | 'hourly'> | undefined
): DailyForecast => {
  const beachWind = windSource?.wind;
  if (!beachWind || typeof beachWind.speed !== 'number' || !Number.isFinite(beachWind.speed)) return base;
  if (beachWind === base.wind) return base;

  const windByTime = new Map<string, ForecastItem['wind']>();
  (windSource?.hourly ?? []).forEach(item => {
    const wind = item?.wind;
    if (wind && typeof wind.speed === 'number' && Number.isFinite(wind.speed)) {
      windByTime.set(item.dt_txt, wind);
    }
  });

  const hourly = base.hourly?.map(item => {
    const ownWind = windByTime.get(item.dt_txt);
    return ownWind && ownWind !== item.wind ? { ...item, wind: ownWind } : item;
  });

  return { ...base, wind: beachWind, hourly: hourly ?? base.hourly };
};

const parseLocalDay = (dayString: string): Date => {
  const [year, month, day] = dayString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const processForecastData = (forecastItems: ForecastItem[]): DailyForecast[] => {
  if (!forecastItems || forecastItems.length === 0) return [];
  // Never surface days that have already passed (e.g. cached hourly items that
  // still carry yesterday's hours when the app is re-opened just after midnight).
  const todayString = athensNow().toLocaleDateString('en-CA');
  const dailyData: { [key: string]: { items: ForecastItem[], temps: number[] } } = {};
  forecastItems.forEach(item => {
    const dayString = new Date(item.dt * 1000).toLocaleDateString('en-CA');
    if (dayString < todayString) return;
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
      // Local midnight, NOT `new Date('YYYY-MM-DD')` (which is UTC midnight). The rest of
      // the app reads this date with local getters, so a UTC-parsed day lands on the
      // previous calendar day for any viewer west of Greenwich and shifts every day label.
      date: parseLocalDay(dayString),
      wind: midday.wind, 
      weather: midday.weather[0], 
      temp_max: info.temps.length > 0 ? Math.max(...info.temps) : 25, 
      temp_min: info.temps.length > 0 ? Math.min(...info.temps) : 15, 
      hourly: info.items,
      marine: summarizeDailyMarine(info.items)
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

/**
 * Maximum pairwise angular distance (deg, 0..180) among a set of wind bearings.
 * Used to detect when per-beach local winds diverge enough that a single
 * island-level compass arrow would misrepresent the map (presentation only).
 */
export const maxWindDirectionSpread = (degrees: number[]): number => {
  const valid = degrees.filter(d => typeof d === 'number' && Number.isFinite(d));
  let max = 0;
  for (let i = 0; i < valid.length; i += 1) {
    for (let j = i + 1; j < valid.length; j += 1) {
      let d = Math.abs(valid[i] - valid[j]) % 360;
      if (d > 180) d = 360 - d;
      if (d > max) max = d;
    }
  }
  return max;
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
    const now = athensNow();
    const month = now.getMonth();
    return (month === 9 && now.getDate() >= 15) || month > 9 || month < 2 || (month === 2 && now.getDate() <= 15);
};
