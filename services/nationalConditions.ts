import { getBeaufortLevel } from '../utils/weatherUtils';
import { applyGustFloor } from '../utils/windGustFloor';

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
// changes slowly, so this costs ~1 call per session. When the forecast proxy flag
// is enabled, this uses the same-origin edge proxy as the beach forecast service.
//
// The in-memory cache below is the ONLY cache in front of this. The service
// worker deliberately does NOT cache api.open-meteo.com or /api/forecast —
// public/service-worker.js fetches those hosts with `cache: 'no-store'` precisely
// so a stale forecast is never served as if fresh.
//
// On any failure we return null and every surface falls back to calm /
// "unavailable" — we never fabricate conditions.

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
// a map of the country.
//
// THESE MUST BE OPEN WATER. An earlier version used each region's centroid from
// public/data/beaches/index.json, which is catastrophically wrong and not
// obviously so: a region's centroid is the MEAN OF ITS BEACH PINS, and beaches
// ring an island, so their mean lands in the island's interior. Eleven of the
// thirteen points sat on land — Kefalonia's on Mt Ainos at 769 m, Chania's at
// 613 m in the White Mountains — and the page reported mountain-ridge wind as
// an open-sea estimate under a live badge. Every point below was verified
// against Open-Meteo's own `elevation` field, and readEssentials() drops any
// reading that is not at sea level, so a bad coordinate goes blank rather than
// quietly lying.
//
// COVERAGE over count: every sea basin is represented (Ionian, Thermaic,
// Pagasetic, S. Evoikos, N. Aegean, Cyclades, Dodecanese, Cretan). That is what
// makes the strip informative — sample only one basin and on a meltemi day every
// chip says the same word. Mixed in are the regions our own counter shows people
// actually search for (Lefkada, Lemnos, Halkidiki, Paros, Patmos).
//
// All of them ride in ONE request (Open-Meteo takes comma-joined coordinates), so
// thirteen points cost exactly what five did.
const POINTS: ReadonlyArray<{ regionId: string; lat: number; lon: number }> = [
  { regionId: 'ionian-islands-corfu', lat: 39.62, lon: 19.60 },
  { regionId: 'ionian-islands-lefkada', lat: 38.72, lon: 20.45 },
  { regionId: 'ionian-islands-kefalonia', lat: 38.20, lon: 20.30 },
  { regionId: 'central-macedonia-halkidiki-mainland', lat: 39.95, lon: 23.80 },
  { regionId: 'thessaly-magnesia-mainland---pelion', lat: 39.35, lon: 23.40 },
  { regionId: 'attica-east-attica-mainland', lat: 37.95, lon: 24.15 },
  { regionId: 'north-aegean-lemnos', lat: 39.85, lon: 25.00 },
  { regionId: 'north-aegean-lesvos', lat: 39.15, lon: 25.85 },
  { regionId: 'south-aegean-paros', lat: 37.05, lon: 25.05 },
  { regionId: 'south-aegean-naxos', lat: 36.95, lon: 25.65 },
  { regionId: 'south-aegean-patmos', lat: 37.33, lon: 26.42 },
  { regionId: 'south-aegean-rhodes', lat: 36.30, lon: 27.85 },
  { regionId: 'crete-crete-chania', lat: 35.60, lon: 23.95 },
];

/** Sea level, with a metre of slack for the model's own grid rounding. */
const MAX_SAMPLE_ELEVATION_M = 1;
/** Open-Meteo snaps to its grid, so the echoed coordinate is near, not equal. */
const COORD_MATCH_TOLERANCE_DEG = 0.25;

/** Display order for the landing strip — same list, one source of truth. */
export const NATIONAL_SAMPLE_REGION_IDS: ReadonlyArray<string> = POINTS.map(p => p.regionId);

const TTL_MS = 3 * 60 * 60 * 1000; // 3h
const FORECAST_HOST = 'https://api.open-meteo.com';
const PROXY_BASE = (import.meta.env?.VITE_FORECAST_PROXY_BASE as string | undefined)?.replace(/\/$/, '');
// Vite inlines this as a literal true/false per build command, and dead code behind it is
// stripped from production output — unlike PROXY_BASE, it can't be "accidentally unset".
const IS_DEV = import.meta.env?.DEV === true;
// Same fail-closed rule as services/forecast/openMeteoProvider.ts: outside `vite dev`, an
// unconfigured proxy must never fall back to calling Open-Meteo directly. The throw lands
// inside the try/catch below, which already turns any fetch failure into `return null` —
// the landing strip falls back to calm, exactly as it does for a network error.
const forecastOrigin = () => {
  if (PROXY_BASE) return `${PROXY_BASE}/open-meteo`;
  if (IS_DEV) return FORECAST_HOST;
  throw new Error('National conditions unavailable: VITE_FORECAST_PROXY_BASE is not configured outside Vite dev mode.');
};

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
      const url = `${forecastOrigin()}/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens`;
      // Without a deadline a hung request leaves thirteen skeleton bars pulsing
      // forever, because `status` never leaves 'loading'.
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`national conditions ${res.status}`);
      // HOW OLD THIS BODY REALLY IS — not how long ago we received it.
      //
      // A 200 does NOT mean fresh. Two paths hand us an old body with a
      // perfectly healthy status line:
      //   1. The edge proxy's rescue store. When Open-Meteo rate-limits or
      //      breaks, netlify/functions/forecast.mjs answers 200 with the last
      //      good body — up to TWELVE HOURS old — and says so only in
      //      X-Forecast-Age-Seconds. Its own comment calls that header "the
      //      whole reason this is safe".
      //   2. The CDN. The same function sets s-maxage=3600 with
      //      stale-while-revalidate=1800, so a cached body can be 90 minutes
      //      old before anything upstream is asked — already past the one-hour
      //      window the landing uses to decide it may say "today".
      // Stamping Date.now() on arrival makes both look zero seconds old, and
      // the landing would then print «σήμερα δεν φυσάει πολύ» over a body
      // captured at dawn. services/weatherService.ts has read this header since
      // the rescue path shipped; this reader simply never did.
      const originAgeS = Number(res.headers.get('x-forecast-age-seconds'));
      const cdnAgeS = Number(res.headers.get('age'));
      const ageMs = Math.max(
        Number.isFinite(originAgeS) && originAgeS > 0 ? originAgeS * 1000 : 0,
        Number.isFinite(cdnAgeS) && cdnAgeS > 0 ? cdnAgeS * 1000 : 0,
      );
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [json];

      const regions: RegionConditionReading[] = [];
      arr.forEach((entry, i) => {
        // Same gust floor as every other surface (utils/windGustFloor). Without it the landing
        // and the region page would print two confident, DIFFERENT Beaufort figures for the same
        // place — the exact failure reports/region-forecast-point-audit.md killed the per-region
        // wind tiles over.
        const rawKmh = entry?.current?.wind_speed_10m;
        if (typeof rawKmh !== 'number') return;
        // Third argument is the DEM at the POINT we asked about, not the cell's — same as
        // weatherService. utils/windGustFloor explains why the distinction was measured.
        const kmh = applyGustFloor(rawKmh, entry?.current?.wind_gusts_10m, entry?.elevation);

        // Match on the coordinates the API echoes back, NOT on array position.
        // Index matching looks fine until Open-Meteo drops or reorders one entry,
        // at which point every chip silently shows another region's wind — a
        // failure that never looks like a failure. Position is only the hint.
        const byIndex = POINTS[i];
        const near = (p: typeof POINTS[number]) =>
          typeof entry.latitude === 'number' && typeof entry.longitude === 'number' &&
          Math.abs(entry.latitude - p.lat) <= COORD_MATCH_TOLERANCE_DEG &&
          Math.abs(entry.longitude - p.lon) <= COORD_MATCH_TOLERANCE_DEG;
        const point = byIndex && near(byIndex) ? byIndex : POINTS.find(near);
        if (!point) return;

        // Refuse anything that is not open water. This is the guard that would
        // have caught the centroid bug on day one; a missing chip is honest,
        // mountain-ridge wind labelled "open sea" is not.
        if (typeof entry.elevation === 'number' && entry.elevation > MAX_SAMPLE_ELEVATION_M) {
          console.warn(`National conditions: dropped ${point.regionId} — sample sits at ${Math.round(entry.elevation)}m, not at sea.`);
          return;
        }

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
        // Back-dated by the real age of the body, so a rescued or CDN-cached
        // response fails the landing's freshness gate instead of sailing
        // through it as if it had just been measured.
        sampledAt: Date.now() - ageMs,
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
