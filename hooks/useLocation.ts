import { useMemo, useState } from 'react';
import { Island } from '../types';
import { getActiveWeatherFixtureTargetRegionId } from '../utils/weatherFixtures';

export const useLocation = (allIslands: Island[]) => {
  const [selectedIslandId, setSelectedIslandId] = useState<string | undefined>(() => (
    getActiveWeatherFixtureTargetRegionId() || localStorage.getItem('selectedIslandId') || undefined
  ));

  const selectedIsland = useMemo(() => {
    if (allIslands.length === 0) return undefined;
    return allIslands.find(i => i.id === selectedIslandId)
      || allIslands.find(i => i.id === 'milos')
      || allIslands.find(i => i.id.endsWith('-milos') || i.name.en === 'Milos')
      || allIslands[0];
  }, [allIslands, selectedIslandId]);

  const selectIsland = (island: Island) => {
    setSelectedIslandId(island.id);
    localStorage.setItem('selectedIslandId', island.id);
  };

  return {
    selectedIsland,
    selectIsland
  };
};
