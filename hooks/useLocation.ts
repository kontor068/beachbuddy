import { useCallback, useEffect, useMemo, useState } from 'react';
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
  // result. Captured once at init, BEFORE the "seen" flag is written below, so the current
  // session keeps showing it while any later visit (any entry point) hides it. Returning
  // users never see it again.
  const [showValueProp] = useState<boolean>(() => {
    try {
      return !window.localStorage.getItem(VALUE_PROP_SEEN_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!showValueProp) return;
    try {
      window.localStorage.setItem(VALUE_PROP_SEEN_STORAGE_KEY, '1');
    } catch {
      // Storage disabled (private mode): the value prop simply shows each visit.
    }
  }, [showValueProp]);

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
    showValueProp
  };
};
