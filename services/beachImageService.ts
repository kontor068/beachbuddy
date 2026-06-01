import milosBeachImages from '../src/data/beachImages.milos.json';

export type BeachImageStatus = 'verified' | 'candidate' | 'fallback' | 'missing';

export interface BeachImageMetadata {
  beachId?: string;
  beachName: string;
  beachNameEl: string;
  island: string;
  imageStatus: BeachImageStatus;
  imageUrl: string;
  thumbnailUrl: string;
  source:
    | 'wikimedia_commons'
    | 'openverse_source'
    | 'manual_permission'
    | 'own_photo'
    | 'unsplash'
    | 'pexels'
    | 'pixabay'
    | 'local_placeholder';
  sourcePageUrl: string;
  license: string;
  licenseUrl: string;
  author: string;
  attributionText: string;
  requiresAttribution: boolean;
  confidence: number;
  matchReason: string;
  searchQueryUsed: string;
  needsHumanReview: boolean;
  fileTitle?: string;
  imageWidth?: number;
  imageHeight?: number;
}

const normalizeLookup = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]/g, '');

const isMilos = (island?: string) => {
  const normalized = normalizeLookup(island);
  return normalized === 'milos' || normalized === 'μηλος';
};

const milosImages = milosBeachImages as BeachImageMetadata[];

const passesDisplayGate = (
  result: BeachImageMetadata | undefined,
  options: { includeCandidates?: boolean } = {}
) => {
  if (!result) return undefined;

  // Licensing gate: candidate images are useful for review, but the app should
  // only render verified beach-specific images as real beach photos.
  if (result.imageStatus !== 'verified' && !options.includeCandidates) {
    return undefined;
  }

  return result;
};

export const getBeachImageMetadataById = (
  beachId: number | string,
  island?: string,
  options: { includeCandidates?: boolean } = {}
): BeachImageMetadata | undefined => {
  if (!isMilos(island)) return undefined;

  const result = milosImages.find(entry => String(entry.beachId) === String(beachId));
  return passesDisplayGate(result, options);
};

export const getBeachImageMetadata = (
  beachName: string,
  island?: string,
  options: { includeCandidates?: boolean } = {}
): BeachImageMetadata | undefined => {
  if (!isMilos(island)) return undefined;

  const normalizedBeachName = normalizeLookup(beachName);
  const result = milosImages.find(entry =>
    normalizeLookup(entry.beachName) === normalizedBeachName ||
    normalizeLookup(entry.beachNameEl) === normalizedBeachName
  );

  return passesDisplayGate(result, options);
};

export const getBeachImage = (beachName: string, island?: string): string | undefined =>
  getBeachImageMetadata(beachName, island)?.imageUrl;

export const getBeachImageAttribution = (beachName: string, island?: string): string | undefined =>
  getBeachImageMetadata(beachName, island)?.attributionText;
