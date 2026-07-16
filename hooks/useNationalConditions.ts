import { useEffect, useState } from 'react';
import { getNationalConditions, type SeaAreaReading } from '../services/nationalConditions';

// Drives the landing hero's living sea and the "seas today" panel from today's
// real national conditions. Starts (and stays, on failure) at a gentle calm — we
// never fabricate a rough sea or fake readings. One cached national read backs
// both surfaces.

const FALLBACK_ROUGHNESS = 0.16;

export type ConditionsStatus = 'loading' | 'live' | 'unavailable';

export interface HeroConditions {
  roughness: number;
  beaufort: number | null;
  areas: SeaAreaReading[];
  status: ConditionsStatus;
}

export const useNationalConditions = (): HeroConditions => {
  const [state, setState] = useState<HeroConditions>({
    roughness: FALLBACK_ROUGHNESS,
    beaufort: null,
    areas: [],
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    getNationalConditions().then(data => {
      if (cancelled) return;
      if (!data) {
        setState(prev => ({ ...prev, status: 'unavailable' }));
        return;
      }
      setState({ roughness: data.roughness, beaufort: data.beaufort, areas: data.areas, status: 'live' });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
};
