import { LanguageCode } from '../types';
import { getBeaufortLevel } from './weatherUtils';

export interface RegionBeachWindSample {
  lat: number;
  lon: number;
  /** This beach's own (cluster) wind speed, m/s. */
  windSpeedMs: number;
}

export interface RegionWindVariationNote {
  text: string;
}

type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const DIRECTION_WORDS: Record<Compass, Record<LanguageCode, string>> = {
  N: { gr: 'βόρεια', en: 'north', fr: 'nord', de: 'Norden', it: 'nord' },
  NE: { gr: 'βορειοανατολικά', en: 'northeast', fr: 'nord-est', de: 'Nordosten', it: 'nord-est' },
  E: { gr: 'ανατολικά', en: 'east', fr: 'est', de: 'Osten', it: 'est' },
  SE: { gr: 'νοτιοανατολικά', en: 'southeast', fr: 'sud-est', de: 'Südosten', it: 'sud-est' },
  S: { gr: 'νότια', en: 'south', fr: 'sud', de: 'Süden', it: 'sud' },
  SW: { gr: 'νοτιοδυτικά', en: 'southwest', fr: 'sud-ouest', de: 'Südwesten', it: 'sud-ovest' },
  W: { gr: 'δυτικά', en: 'west', fr: 'ouest', de: 'Westen', it: 'ovest' },
  NW: { gr: 'βορειοδυτικά', en: 'northwest', fr: 'nord-ouest', de: 'Nordwesten', it: 'nord-ovest' },
};

const noteCopy = (dir: Compass, language: LanguageCode): string => {
  const where = DIRECTION_WORDS[dir][language];
  switch (language) {
    case 'gr': return `Σήμερα πιο ήρεμα στα ${where} της περιοχής.`;
    case 'fr': return `Plus calme dans le ${where} de la zone aujourd’hui.`;
    case 'de': return `Heute ruhiger im ${where} der Region.`;
    case 'it': return `Oggi più tranquillo a ${where} della zona.`;
    default: return `Calmer in the ${where} of the area today.`;
  }
};

const COMPASS_ORDER: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }): number => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Need a real region with enough sampled spots before we claim a "side".
const MIN_SAMPLES = 6;
const MIN_CALMER_POCKET = 3;
// The calmer pocket's centre must sit at least this far off the region centre,
// otherwise "the calmer side" isn't a real direction worth naming.
const MIN_OFFSET_KM = 4;

/**
 * Looks across a region's per-beach (cluster) winds and, only when one side is
 * clearly calmer than the area average, returns a single plain line like
 * "Calmer in the south of the area today". Returns null when conditions are
 * uniform or the calmer spots are scattered — no vague noise.
 */
export const getRegionWindVariationNote = (
  areaWindSpeedMs: number,
  samples: RegionBeachWindSample[],
  regionCenter: { lat: number; lon: number },
  language: LanguageCode = 'gr'
): RegionWindVariationNote | null => {
  if (!Number.isFinite(areaWindSpeedMs) || samples.length < MIN_SAMPLES) return null;

  const areaBft = getBeaufortLevel(areaWindSpeedMs * 3.6);
  const calmer = samples.filter(s => getBeaufortLevel(s.windSpeedMs * 3.6) <= areaBft - 1);
  const windier = samples.filter(s => getBeaufortLevel(s.windSpeedMs * 3.6) >= areaBft + 1);

  // Want a genuine gradient: a calmer pocket AND somewhere clearly windier.
  if (calmer.length < MIN_CALMER_POCKET || windier.length < 1) return null;

  const calmerCentre = {
    lat: calmer.reduce((sum, s) => sum + s.lat, 0) / calmer.length,
    lon: calmer.reduce((sum, s) => sum + s.lon, 0) / calmer.length,
  };

  if (haversineKm(regionCenter, calmerCentre) < MIN_OFFSET_KM) return null;

  const dLat = calmerCentre.lat - regionCenter.lat;
  const dLon = (calmerCentre.lon - regionCenter.lon) * Math.cos(regionCenter.lat * Math.PI / 180);
  const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
  const dir = COMPASS_ORDER[Math.round(bearing / 45) % 8];

  return { text: noteCopy(dir, language) };
};
