import { getBeaufortLevel } from '../utils/weatherUtils';

// A single, cached read of "the general weather of Greece" — it drives the
// landing hero and the "seas today" panel (live conditions per sea area). ONE
// Open-Meteo request covers every sample point (comma-joined coords, exactly the
// pattern scripts/windSpreadNational.mjs already uses), cached for 3h because the
// national picture changes slowly — so this costs ~1 call per session, honouring
// the forecast-caching-safety work. The service worker also caches
// api.open-meteo.com. On any failure we return null and everything falls back to
// calm / "unavailable" — we never fabricate conditions.

export type SeaAreaKey = 'ionian' | 'saronic' | 'cretan' | 'aegean' | 'neAegean';

export interface SeaAreaReading {
  key: SeaAreaKey;
  beaufort: number;
  roughness: number;
  dirDeg: number;
}

export interface NationalConditions {
  beaufort: number;   // representative (rounded average) Beaufort across Greece
  roughness: number;  // 0..1, for the hero sea state
  areas: SeaAreaReading[];
  sampledAt: number;
}

// Representative offshore points, in west→east display order.
const POINTS: ReadonlyArray<{ key: SeaAreaKey; lat: number; lon: number }> = [
  { key: 'ionian', lat: 38.3, lon: 20.5 },
  { key: 'saronic', lat: 37.6, lon: 23.5 },
  { key: 'cretan', lat: 35.3, lon: 24.8 },
  { key: 'aegean', lat: 37.0, lon: 25.3 },   // Cyclades — meltemi core
  { key: 'neAegean', lat: 39.1, lon: 26.2 },
];

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

      const areas: SeaAreaReading[] = [];
      arr.forEach((entry, i) => {
        const point = POINTS[i];
        const kmh = entry?.current?.wind_speed_10m;
        if (!point || typeof kmh !== 'number') return;
        const bft = getBeaufortLevel(kmh);
        areas.push({
          key: point.key,
          beaufort: bft,
          roughness: roughnessFromBeaufort(bft),
          dirDeg: typeof entry?.current?.wind_direction_10m === 'number' ? entry.current.wind_direction_10m : 0,
        });
      });
      if (areas.length === 0) throw new Error('national conditions: no readings');

      const avg = areas.reduce((sum, a) => sum + a.beaufort, 0) / areas.length;
      const data: NationalConditions = {
        beaufort: Math.round(avg),
        roughness: roughnessFromBeaufort(avg),
        areas,
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
