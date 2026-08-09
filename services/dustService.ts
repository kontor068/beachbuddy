// ─────────────────────────────────────────────────────────────────────────────
// SAHARAN DUST — display-only advisory, one reading per region.
//
// Added 09/08/2026, the day the paid Open-Meteo plan (1M calls/month) made the
// Air Quality API affordable. Dust is the one Greek summer condition the app was
// silent about: a strong southerly can carry enough Saharan dust to turn the sky
// yellow, cut visibility and make a beach day genuinely unpleasant — and no
// beach site shows it per destination.
//
// THREE RULES, all load-bearing:
//
//   1. DISPLAY-ONLY. Dust never touches scoring, map colours, verdicts or the
//      top-3 — those are calibrated against wind/wave ground truth and a second
//      opinion channel would corrupt them (same rule as the cove wave guard).
//      This service can only ADD a line of text, never change a decision.
//   2. ONE POINT PER REGION. The CAMS field behind `dust` has ~11 km cells and
//      real events span hundreds of km. Per-beach or per-cluster sampling would
//      multiply cost for byte-identical numbers.
//   3. SILENT ON FAILURE. A dust outage must never degrade the forecast UI —
//      every error path returns null and the page simply shows no dust line
//      (the honest default: most days there IS no dust worth mentioning).
//
// Thresholds (surface dust, μg/m³): 50 = noticeable haze for sensitive people,
// 200 = heavy episode (yellow sky, sirocco-style). Conservative on purpose —
// a false "dust" warning on a clear day costs trust, the same way a false
// "beach bar" does (amenity reliability mandate).
// ─────────────────────────────────────────────────────────────────────────────

import { openMeteoProvider } from './forecast/openMeteoProvider';
import { athensNow, athensDayKey } from '../utils/athensTime';

export type DustLevel = 'elevated' | 'heavy';

export interface RegionDustReading {
  /** null level is never emitted — a quiet day yields a null reading instead. */
  level: DustLevel;
  /** Worst hour of today's remaining daylight, μg/m³, rounded. */
  peakUgM3: number;
}

const ELEVATED_UG_M3 = 50;
const HEAVY_UG_M3 = 200;

/** Beach-relevant hours: dust at 04:00 doesn't change anyone's day. */
const FIRST_RELEVANT_HOUR = 8;
const LAST_RELEVANT_HOUR = 20;

// CAMS publishes a new run every 12 h and the proxy caches this route for 3 h;
// re-asking sooner only re-reads the same CDN entry.
const TTL_MS = 3 * 60 * 60 * 1000;

interface CacheEntry { at: number; reading: RegionDustReading | null }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<RegionDustReading | null>>();

/**
 * Today's dust picture for one region, or null when there is nothing worth
 * saying (quiet day, network failure, provider outage — deliberately identical).
 */
export const getRegionDust = async (
  regionKey: string,
  lat: number,
  lon: number,
): Promise<RegionDustReading | null> => {
  const hit = cache.get(regionKey);
  // athens-clock-exempt: cache age (elapsed ms), not a time of day.
  if (hit && Date.now() - hit.at < TTL_MS) return hit.reading;

  const running = inflight.get(regionKey);
  if (running) return running;

  const task = (async (): Promise<RegionDustReading | null> => {
    try {
      const url = openMeteoProvider.dustForecastUrl(lat, lon);
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`dust ${res.status}`);
      const json = await res.json();

      const times: string[] = json?.hourly?.time || [];
      const dust: Array<number | null> = json?.hourly?.dust || [];

      // The API answers in Europe/Athens wall time (pinned in the URL), so
      // "today" is compared in the same clock — never the device's (see
      // utils/athensTime.ts for why that rule exists).
      const todayKey = athensDayKey();
      const hourNow = athensNow().getHours();
      const firstHour = Math.max(FIRST_RELEVANT_HOUR, hourNow);

      let peak = 0;
      for (let i = 0; i < times.length; i++) {
        const value = dust[i];
        if (typeof value !== 'number') continue;
        const [day, clock] = times[i].split('T');
        if (day !== todayKey) continue;
        const hour = Number(clock?.slice(0, 2));
        if (!Number.isFinite(hour) || hour < firstHour || hour > LAST_RELEVANT_HOUR) continue;
        if (value > peak) peak = value;
      }

      const reading: RegionDustReading | null =
        peak >= HEAVY_UG_M3 ? { level: 'heavy', peakUgM3: Math.round(peak) }
        : peak >= ELEVATED_UG_M3 ? { level: 'elevated', peakUgM3: Math.round(peak) }
        : null;

      // athens-clock-exempt: cache stamp compared only against elapsed time above.
      cache.set(regionKey, { at: Date.now(), reading });
      return reading;
    } catch {
      // Negative result cached too: a broken provider must not be re-hammered
      // on every render, and "no line shown" is the correct face for it.
      // athens-clock-exempt: cache stamp compared only against elapsed time above.
      cache.set(regionKey, { at: Date.now(), reading: null });
      return null;
    } finally {
      inflight.delete(regionKey);
    }
  })();

  inflight.set(regionKey, task);
  return task;
};
