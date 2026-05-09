import { useState, useEffect } from 'react';
import { Island } from '../types';

export const useLocation = (allIslands: Island[]) => {
  const [selectedIsland, setSelectedIsland] = useState<Island | undefined>(undefined);

  useEffect(() => {
    if (allIslands.length > 0 && !selectedIsland) {
        const savedId = localStorage.getItem('selectedIslandId');
        const initialSelection = allIslands.find(i => i.id === savedId) || allIslands.find(i => i.id === 'milos') || allIslands[0];
        if (initialSelection) {
            setSelectedIsland(initialSelection);
        }
    }
  }, [allIslands]);

  const selectIsland = (island: Island) => {
    setSelectedIsland(island);
    localStorage.setItem('selectedIslandId', island.id);
  };

  return {
    selectedIsland,
    selectIsland
  };
};
