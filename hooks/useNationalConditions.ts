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
}

export const useNationalConditions = (): HeroConditions => {
  const [state, setState] = useState<HeroConditions>({
    roughness: FALLBACK_ROUGHNESS,
    beaufort: null,
    regions: [],
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
      setState({ roughness: data.roughness, beaufort: data.beaufort, regions: data.regions, status: 'live' });
    });
    return () => { cancelled = true; };
  }, []);

  return state;
};
