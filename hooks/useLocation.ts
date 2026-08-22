import { useCallback, useMemo, useState } from 'react';
import { Island } from '../types';
import { getActiveWeatherFixtureTargetRegionId } from '../utils/weatherFixtures';
import { parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from '../utils/beachUrls';
import { isInfoOnlyRegionId } from '../utils/infoOnlyRegions';
import { getStoredValue, setStoredValue } from '../utils/safeStorage';

/** Both initialisers below read this, and reading storage can throw outright in a
 *  locked-down browser — inside a state initialiser that is a blank page, not a
 *  lost preference. One name so the two can never disagree about the key either. */
const readSelectedIslandId = (): string | undefined => getStoredValue('selectedIslandId') || undefined;

export const useLocation = (allIslands: Island[]) => {
  const [selectedIslandId, setSelectedIslandId] = useState<string | undefined>(() => {
    const route = parseBeachDetailPath() || parseBeachRegionPath();
    return route?.regionId || getActiveWeatherFixtureTargetRegionId() || readSelectedIslandId();
  });

  // True once the visitor has committed to a region — via a deep link, a weather
  // fixture, a persisted previous choice on load, or by picking a region / "near
  // me" this session. While false we show the national landing instead of dropping
  // a first-time visitor straight into a default region. `selectedIsland` below
  // still resolves to a real region in the background, so every existing
  // region-scoped memo/effect keeps working unchanged (no null ripple in App.tsx).
  const [hasCommittedRegion, setHasCommittedRegion] = useState<boolean>(() => {
    const route = parseBeachDetailPath() || parseBeachRegionPath();
    return Boolean(route?.regionId || getActiveWeatherFixtureTargetRegionId() || readSelectedIslandId());
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
      || allIslands.find(i => !isInfoOnlyRegionId(i.id))
      || allIslands[0];
  }, [adHocIsland, allIslands, selectedIslandId]);

  const selectIsland = useCallback((island: Island) => {
    setAdHocIsland(undefined);
    setSelectedIslandId(island.id);
    setHasCommittedRegion(true);
    setStoredValue('selectedIslandId', island.id);
  }, []);

  // Selects a synthetic region held only in memory. Deliberately not persisted to
  // localStorage: on reload there are no merged beaches to restore, so we fall
  // back to a real region instead of a broken empty "Κοντά μου".
  const selectAdHocRegion = useCallback((island: Island) => {
    setAdHocIsland(island);
    setSelectedIslandId(island.id);
    setHasCommittedRegion(true);
  }, []);

  // Return to the national landing (e.g. tapping the logo). Clears the persisted
  // region so a reload stays on the landing rather than restoring the last region.
  const goToLanding = useCallback(() => {
    setAdHocIsland(undefined);
    setSelectedIslandId(undefined);
    setHasCommittedRegion(false);
    if (typeof localStorage !== 'undefined') localStorage.removeItem('selectedIslandId');
  }, []);

  // Show the landing only once island data exists (so the page has content) and
  // the visitor hasn't committed to a region yet.
  const showLanding = allIslands.length > 0 && !hasCommittedRegion;

  return {
    selectedIsland,
    selectIsland,
    selectAdHocRegion,
    showValueProp,
    markValuePropSeen,
    showLanding,
    goToLanding
  };
};
