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
  /**
   * When the reading was actually MEASURED — already back-dated by the proxy's
   * rescue age and the CDN age in services/nationalConditions.ts. Exposed so
   * freshness can be re-derived later instead of trusting a boolean frozen at
   * mount. 0 while loading or unavailable.
   */
  sampledAt: number;
}

/** How recent a reading has to be before the UI may call it live. */
const FRESH_MS = 60 * 60 * 1000;
/**
 * How often we re-ask whether the reading is still recent enough to speak for
 * "today". Coarse on purpose: the answer changes at most once per session and a
 * tighter timer would drain a phone to learn nothing.
 */
const RECHECK_MS = 5 * 60 * 1000;

export const useNationalConditions = (): HeroConditions => {
  const [state, setState] = useState<HeroConditions>({
    roughness: FALLBACK_ROUGHNESS,
    beaufort: null,
    regions: [],
    status: 'loading',
    isFresh: false,
    sampledAt: 0,
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
        sampledAt: data.sampledAt,
      });
    });
    return () => { cancelled = true; };
  }, []);

  // FRESHNESS HAS TO KEEP BEING ASKED, not answered once.
  //
  // `isFresh` above is computed inside the fetch callback, which runs once. A
  // phone that opens this page at 09:00 and is picked up again at 15:00 — the
  // ordinary way a beach site is used — still has the 09:00 component mounted,
  // still holds `isFresh: true`, and would still be printing this morning's
  // «σήμερα δεν φυσάει πολύ» six hours later. The whole point of the one-hour
  // window is that it expires; a boolean frozen at mount never does.
  //
  // So: re-evaluate on a slow tick and whenever the tab comes back to the
  // front. The interval is deliberately coarse — this decides whether one
  // sentence is allowed to exist, and a tighter timer would burn battery for
  // nothing. `setState` returns the same object when nothing changed, so a tick
  // that finds the reading still fresh costs no re-render.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const reassess = () => {
      setState(prev => {
        if (prev.status !== 'live') return prev;
        // athens-clock-exempt: the AGE of a reading, not a time of day. Both
        // sides are absolute instants, so the viewer's offset cannot skew it.
        const fresh = Date.now() - prev.sampledAt < FRESH_MS;
        return fresh === prev.isFresh ? prev : { ...prev, isFresh: fresh };
      });
    };

    const timer = window.setInterval(reassess, RECHECK_MS);
    document.addEventListener('visibilitychange', reassess);
    window.addEventListener('focus', reassess);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reassess);
      window.removeEventListener('focus', reassess);
    };
  }, []);

  return state;
};
