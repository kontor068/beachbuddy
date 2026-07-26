import { useEffect, useState } from 'react';
import { getNationalConditions, type RegionConditionReading } from '../services/nationalConditions';

// Drives the landing hero and the "today" strip from today's real conditions.
// Starts (and stays, on failure) at a gentle calm — we never fabricate a rough
// sea or fake readings. One cached national read backs both surfaces.

const FALLBACK_ROUGHNESS = 0.16;

export type ConditionsStatus = 'loading' | 'live' | 'unavailable';

export interface HeroConditions {
  roughness: number;
  beaufort: number | null;
  regions: RegionConditionReading[];
  status: ConditionsStatus;
  /**
   * True only while the reading is genuinely recent. The service caches for 3h
   * (and the service worker can hold it longer), so "live" must be earned by the
   * timestamp — a three-hour-old number under a pulsing green dot is the kind of
   * over-claim the forecast-staleness doctrine exists to prevent.
   */
  isFresh: boolean;
}

/** How recent a reading has to be before the UI may call it live. */
const FRESH_MS = 60 * 60 * 1000;

export const useNationalConditions = (): HeroConditions => {
  const [state, setState] = useState<HeroConditions>({
    roughness: FALLBACK_ROUGHNESS,
    beaufort: null,
    regions: [],
    status: 'loading',
    isFresh: false,
  });

  useEffect(() => {
    let cancelled = false;
    getNationalConditions().then(data => {
      if (cancelled) return;
      if (!data) {
        setState(prev => ({ ...prev, status: 'unavailable' }));
        return;
      }
      setState({
        roughness: data.roughness,
        beaufort: data.beaufort,
        regions: data.regions,
        status: 'live',
        // athens-clock-exempt: this is the AGE of a reading, not a time of day —
        // both sides are absolute instants, so the device's timezone cannot skew
        // the subtraction. athensNow() here would compare a wall-clock-shifted
        // "now" against a real epoch timestamp and make freshness wrong by the
        // visitor's UTC offset.
        isFresh: Date.now() - data.sampledAt < FRESH_MS,
      });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
};
