export type DestinationPhotoType = 'hero' | 'card' | 'fallback';

export type PhotoSource =
  | 'own'
  | 'wikimedia'
  | 'pexels'
  | 'pixabay'
  | 'unsplash'
  | 'partner'
  | 'unknown';

export interface CuratedPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  source: PhotoSource;
  author?: string;
  license?: string;
  sourceUrl?: string;
  attributionRequired: boolean;
  verifiedLocation: boolean;
  usageLabel: string;
  loading: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}

export interface DestinationPhotoSet {
  hero?: CuratedPhoto;
  card?: CuratedPhoto;
  fallback?: CuratedPhoto;
}

export const supportedDestinationIds = [
  'milos',
  'crete',
  'rhodes',
  'corfu',
  'zakynthos',
  'kefalonia',
  'lefkada',
  'naxos',
  'paros',
  'mykonos',
  'santorini',
  'samos',
  'skiathos',
  'skopelos',
  'thasos',
  'chalkidiki',
  'attica',
  'peloponnese',
  'syros',
  'andros',
] as const;

export type DestinationId = (typeof supportedDestinationIds)[number];

export const supportedFallbackPhotoIds = [
  'greekBeach',
  'cyclades',
  'ionian',
  'aegean',
] as const;

export type FallbackPhotoId = (typeof supportedFallbackPhotoIds)[number];

export const destinationPhotoRegistry: Record<DestinationId, DestinationPhotoSet> = {
  milos: {
    hero: {
      src: '/images/destinations/milos/hero.webp',
      alt: 'Sarakiniko beach landscape in Milos, Greece',
      width: 1600,
      height: 900,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Sarakiniko_Beach_on_Milos_Island,_Greece_with_a_view_of_the_Aegean_Sea.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Μήλος',
      loading: 'eager',
      fetchPriority: 'high',
    },
    card: {
      src: '/images/destinations/milos/card.webp',
      alt: 'Kleftiko cliffs and turquoise water in Milos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Cliffs_and_rock_formations_at_Kleftiko_on_Milos_Island,_Greece.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Μήλος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
    fallback: {
      src: '/images/destinations/milos/fallback.webp',
      alt: 'Sea caves and coastline in Milos, Greece',
      width: 1200,
      height: 800,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Sea_caves_at_Kleftiko_on_Milos_Island,_Greece.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Εικόνα από τη Μήλο',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  crete: {},
  rhodes: {},
  corfu: {},
  zakynthos: {},
  kefalonia: {},
  lefkada: {},
  naxos: {},
  paros: {},
  mykonos: {},
  santorini: {},
  samos: {},
  skiathos: {},
  skopelos: {},
  thasos: {},
  chalkidiki: {},
  attica: {},
  peloponnese: {},
  syros: {},
  andros: {},
};

export const fallbackPhotoRegistry: Partial<Record<FallbackPhotoId, CuratedPhoto>> = {};

const supportedDestinationIdSet = new Set<string>(supportedDestinationIds);
const supportedFallbackPhotoIdSet = new Set<string>(supportedFallbackPhotoIds);

export const isDestinationId = (destinationId: string): destinationId is DestinationId =>
  supportedDestinationIdSet.has(destinationId);

export const isFallbackPhotoId = (fallbackPhotoId: string): fallbackPhotoId is FallbackPhotoId =>
  supportedFallbackPhotoIdSet.has(fallbackPhotoId);

export const getDestinationPhotoSet = (
  destinationId: string,
): DestinationPhotoSet | undefined => {
  if (!isDestinationId(destinationId)) {
    return undefined;
  }

  return destinationPhotoRegistry[destinationId];
};

export const getDestinationPhoto = (
  destinationId: string,
  type: DestinationPhotoType,
): CuratedPhoto | undefined => getDestinationPhotoSet(destinationId)?.[type];

export const hasDestinationPhoto = (
  destinationId: string,
  type: DestinationPhotoType,
): boolean => Boolean(getDestinationPhoto(destinationId, type));

export const getFallbackPhoto = (
  fallbackPhotoId: string,
): CuratedPhoto | undefined => {
  if (!isFallbackPhotoId(fallbackPhotoId)) {
    return undefined;
  }

  return fallbackPhotoRegistry[fallbackPhotoId];
};

export const hasFallbackPhoto = (fallbackPhotoId: string): boolean =>
  Boolean(getFallbackPhoto(fallbackPhotoId));
