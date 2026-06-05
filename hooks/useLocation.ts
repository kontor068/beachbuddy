import { useCallback, useMemo, useState } from 'react';
import { Island } from '../types';
import { getActiveWeatherFixtureTargetRegionId } from '../utils/weatherFixtures';
import { parseBeachDetailPath, parseBeachRegionPath, regionMatchesRouteParam } from '../utils/beachUrls';

export const useLocation = (allIslands: Island[]) => {
  const [selectedIslandId, setSelectedIslandId] = useState<string | undefined>(() => {
    const route = parseBeachDetailPath() || parseBeachRegionPath();
    return route?.regionId || getActiveWeatherFixtureTargetRegionId() || localStorage.getItem('selectedIslandId') || undefined;
  });

  const selectedIsland = useMemo(() => {
    if (allIslands.length === 0) return undefined;
    return allIslands.find(i => i.id === selectedIslandId || regionMatchesRouteParam(i, selectedIslandId))
      || allIslands.find(i => i.id === 'milos')
      || allIslands.find(i => i.id.endsWith('-milos') || i.name.en === 'Milos')
      || allIslands[0];
  }, [allIslands, selectedIslandId]);

  const selectIsland = useCallback((island: Island) => {
    setSelectedIslandId(island.id);
    localStorage.setItem('selectedIslandId', island.id);
  }, []);

  return {
    selectedIsland,
    selectIsland
  };
};
