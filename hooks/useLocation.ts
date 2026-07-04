import { useCallback, useMemo, useState } from 'react';
import { Island } from '../types';
import { getActiveWeatherFixtureTargetRegionId } from '../utils/weatherFixtures';
import { parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from '../utils/beachUrls';

// One-time flag: once a visitor has seen the homepage value proposition, they are a
// returning user and never see it again — on any entry point.
const VALUE_PROP_SEEN_STORAGE_KEY = 'calmBeachValuePropSeen';

export const useLocation = (allIslands: Island[]) => {
  const [selectedIslandId, setSelectedIslandId] = useState<string | undefined>(() => {
    const route = parseBeachDetailPath() || parseBeachRegionPath();
    return route?.regionId || getActiveWeatherFixtureTargetRegionId() || localStorage.getItem('selectedIslandId') || undefined;
  });

  // Drives the value-proposition block. True only for a genuine first-time visitor,
  // regardless of where they land — the homepage OR a region page arrived at from a Google
  // result. It stays on until the visitor's first *meaningful interaction* (see
  // markValuePropSeen), so onboarding ends on engagement, not on render. Persisted, so
  // returning users never see it again.
  const [showValueProp, setShowValueProp] = useState<boolean>(() => {
    try {
      return !window.localStorage.getItem(VALUE_PROP_SEEN_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  // Call on the first meaningful interaction (selecting a region, searching, opening a
  // beach, using "Near me", clicking a recommendation). Hides the value prop for the rest
  // of this session and persists the flag so it never reappears. Idempotent — safe to call
  // from several handlers. Deliberately NOT wired into selectIsland/selectAdHocRegion,
  // which also fire programmatically during route restoration on load.
  const markValuePropSeen = useCallback(() => {
    setShowValueProp(false);
    try {
      window.localStorage.setItem(VALUE_PROP_SEEN_STORAGE_KEY, '1');
    } catch {
      // Storage disabled (private mode): the value prop simply shows again next visit.
    }
  }, []);

  // A synthetic, in-memory region that is NOT part of allIslands — currently used
  // for the cross-region "Κοντά μου" view, whose beaches are merged from several
  // real regions around the user. It takes priority while it is the active
  // selection, and is dropped as soon as a real region is selected.
  const [adHocIsland, setAdHocIsland] = useState<Island | undefined>(undefined);

  const selectedIsland = useMemo(() => {
    if (adHocIsland && adHocIsland.id === selectedIslandId) return adHocIsland;
    if (allIslands.length === 0) return undefined;
    return allIslands.find(i => i.id === selectedIslandId || regionMatchesRouteParam(i, selectedIslandId))
      || allIslands.find(i => i.id === 'milos')
      || allIslands.find(i => i.id.endsWith('-milos') || i.name.en === 'Milos')
      || allIslands[0];
  }, [adHocIsland, allIslands, selectedIslandId]);

  const selectIsland = useCallback((island: Island) => {
    setAdHocIsland(undefined);
    setSelectedIslandId(island.id);
    localStorage.setItem('selectedIslandId', island.id);
  }, []);

  // Selects a synthetic region held only in memory. Deliberately not persisted to
  // localStorage: on reload there are no merged beaches to restore, so we fall
  // back to a real region instead of a broken empty "Κοντά μου".
  const selectAdHocRegion = useCallback((island: Island) => {
    setAdHocIsland(island);
    setSelectedIslandId(island.id);
  }, []);

  return {
    selectedIsland,
    selectIsland,
    selectAdHocRegion,
    showValueProp,
    markValuePropSeen
  };
};
