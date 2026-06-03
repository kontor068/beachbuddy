import {
  getDestinationPhoto,
  type CuratedPhoto,
  type DestinationId,
  type DestinationPhotoType,
} from './photoRegistry';

const islandIdToDestinationPhotoId: Partial<Record<string, DestinationId>> = {
  'south-aegean-milos': 'milos',
};

export const getIslandDestinationPhoto = (
  islandId: string,
  type: DestinationPhotoType,
): CuratedPhoto | undefined => {
  const destinationId = islandIdToDestinationPhotoId[islandId];
  if (!destinationId) {
    return undefined;
  }

  return getDestinationPhoto(destinationId, type);
};
