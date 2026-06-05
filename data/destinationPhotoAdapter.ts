import {
  getDestinationPhoto,
  type CuratedPhoto,
  type DestinationId,
  type DestinationPhotoType,
} from './photoRegistry';

const islandIdToDestinationPhotoId: Partial<Record<string, DestinationId>> = {
  'crete-crete-chania': 'crete',
  'crete-crete-heraklion': 'crete',
  'crete-crete-lasithi': 'crete',
  'crete-crete-rethymno': 'crete',
  'ionian-islands-corfu': 'corfu',
  'ionian-islands-kefalonia': 'kefalonia',
  'ionian-islands-lefkada': 'lefkada',
  'ionian-islands-zakynthos': 'zakynthos',
  'south-aegean-milos': 'milos',
  'south-aegean-mykonos': 'mykonos',
  'south-aegean-naxos': 'naxos',
  'south-aegean-paros': 'paros',
  'south-aegean-rhodes': 'rhodes',
  'south-aegean-santorini': 'santorini',
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
