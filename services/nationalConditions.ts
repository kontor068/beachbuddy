import { getBeaufortLevel } from '../utils/weatherUtils';

// One cached read of "how the sea is doing around Greece right now". It drives
// the landing hero and the "today" strip.
//
// WHY THESE POINTS: they used to sit at sea-area centroids (Aegean, Ionian…),
// which read as abstract — nobody says "let's go to the Cretan Sea". They now sit
// on the REGIONS our own traffic shows people actually look for, so each reading
// carries a place name a visitor recognises AND a page we can link to. Same one
// request, same cache, strictly more useful.
//
// ONE Open-Meteo call covers every point (comma-joined coords — the pattern
// scripts/windSpreadNational.mjs already uses), cached for 3h because the picture
// changes slowly, so this costs ~1 call per session. The service worker also
// caches api.open-meteo.com. On any failure we return null and every surface
// falls back to calm / "unavailable" — we never fabricate conditions.

export interface RegionConditionReading {
  /** Region id — maps straight onto an Island, so the UI can name and link it. */
  regionId: string;
  beaufort: number;
  roughness: number;
  dirDeg: number;
}

export interface NationalConditions {
  beaufort: number;   // representative (rounded average) Beaufort across Greece
  roughness: number;  // 0..1, for the hero sea state
  regions: RegionConditionReading[];
  sampledAt: number;
}

// Ordered as displayed, roughly west → east then south, so the strip reads like
// a map of the country. Coordinates are the regions' own centroids from
// public/data/beaches/index.json — not hand-picked sea points.
//
// COVERAGE over count: every sea basin is represented (Ionian, Thermaic/Halkidiki,
// Pagasetic, Saronic/Attica, N. Aegean, Cyclades, Dodecanese, Cretan). That is
// what makes the strip informative — sample only one basin and on a meltemi day
// every chip says the same word. Mixed in are the regions our own counter shows
// people actually search for (Lefkada, Lemnos, Halkidiki, Paros, Patmos).
//
// All of them ride in ONE request (Open-Meteo takes comma-joined coordinates), so
// going from 5 points to 13 costs nothing extra.
const POINTS: ReadonlyArray<{ regionId: string; lat: number; lon: number }> = [
  { regionId: 'ionian-islands-corfu', lat: 39.635, lon: 19.870 },
  { regionId: 'ionian-islands-lefkada', lat: 38.737, lon: 20.659 },
  { regionId: 'ionian-islands-kefalonia', lat: 38.206, lon: 20.569 },
  { regionId: 'central-macedonia-halkidiki-mainland', lat: 40.203, lon: 23.726 },
  { regionId: 'thessaly-magnesia-mainland---pelion', lat: 39.283, lon: 23.150 },
  { regionId: 'attica-east-attica-mainland', lat: 37.908, lon: 23.956 },
  { regionId: 'north-aegean-lemnos', lat: 39.900, lon: 25.215 },
  { regionId: 'north-aegean-lesvos', lat: 39.147, lon: 26.246 },
  { regionId: 'south-aegean-paros', lat: 37.071, lon: 25.213 },
  { regionId: 'south-aegean-naxos', lat: 37.060, lon: 25.462 },
  { regionId: 'south-aegean-patmos', lat: 37.334, lon: 26.561 },
  { regionId: 'south-aegean-rhodes', lat: 36.184, lon: 28.046 },
  { regionId: 'crete-crete-chania', lat: 35.383, lon: 23.912 },
];

/** Display order for the landing strip — same list, one source of truth. */
export const NATIONAL_SAMPLE_REGION_IDS: ReadonlyArray<string> = POINTS.map(p => p.regionId);

const TTL_MS = 3 * 60 * 60 * 1000; // 3h

export const roughnessFromBeaufort = (bft: number): number =>
  Math.max(0, Math.min(1, (bft - 1) / 6));

let cache: { at: number; data: NationalConditions } | null = null;
let inflight: Promise<NationalConditions | null> | null = null;

export const getNationalConditions = async (): Promise<NationalConditions | null> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const lats = POINTS.map(p => p.lat).join(',');
      const lons = POINTS.map(p => p.lon).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`national conditions ${res.status}`);
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [json];

      const regions: RegionConditionReading[] = [];
      arr.forEach((entry, i) => {
        const point = POINTS[i];
        const kmh = entry?.current?.wind_speed_10m;
        if (!point || typeof kmh !== 'number') return;
        const bft = getBeaufortLevel(kmh);
        regions.push({
          regionId: point.regionId,
          beaufort: bft,
          roughness: roughnessFromBeaufort(bft),
          dirDeg: typeof entry?.current?.wind_direction_10m === 'number' ? entry.current.wind_direction_10m : 0,
        });
      });
      if (regions.length === 0) throw new Error('national conditions: no readings');

      const avg = regions.reduce((sum, r) => sum + r.beaufort, 0) / regions.length;
      const data: NationalConditions = {
        beaufort: Math.round(avg),
        roughness: roughnessFromBeaufort(avg),
        regions,
        sampledAt: Date.now(),
      };
      cache = { at: Date.now(), data };
      return data;
    } catch (err) {
      console.warn('National conditions fetch failed; landing falls back to calm.', err);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};
