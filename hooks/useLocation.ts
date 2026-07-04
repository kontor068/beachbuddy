import { useCallback, useMemo, useState } from 'react';
import { Island } from '../types';
import { getActiveWeatherFixtureTargetRegionId } from '../utils/weatherFixtures';
import { parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from '../utils/beachUrls';

export const useLocation = (allIslands: Island[]) => {
  const [selectedIslandId, setSelectedIslandId] = useState<string | undefined>(() => {
    const route = parseBeachDetailPath() || parseBeachRegionPath();
    return route?.regionId || getActiveWeatherFixtureTargetRegionId() || localStorage.getItem('selectedIslandId') || undefined;
  });

  // Drives the value-proposition block (homepage hero headline + subheadline). Always shown:
  // the hero is a permanent part of the landing/region view, not a first-visit-only onboarding.
  const [showValueProp, setShowValueProp] = useState<boolean>(true);

  // Kept as a no-op so existing call sites stay valid: the hero is now permanent, so there is
  // nothing to dismiss on interaction. setShowValueProp is retained for future use.
  void setShowValueProp;
  const markValuePropSeen = useCallback(() => {}, []);

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
