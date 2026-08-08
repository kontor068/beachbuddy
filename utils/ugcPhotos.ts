// Photos our own visitors sent us, after a human approved them.
//
// The file behind this is written at build time by scripts/syncApprovedPhotos.mjs
// from the `beach_photos` table — it holds URLs and credits, never image data, so
// it stays a few kilobytes even at a thousand photos.
//
// ONE PLACE, TWO READERS. services/beachPhotos.ts asks "which photos does this
// beach have", utils/photoCredit.ts asks "whose photo is this". Both need the
// same table, and a second copy of the lookup is how the card ends up crediting
// the wrong person.
//
// EMPTY IS THE NORMAL STATE of this file in a fresh checkout, and everything
// downstream must treat it as "no photos yet" rather than as an error.

import UGC_PHOTOS from '../data/beachPhotosUgc.generated.json';

export interface UgcPhoto {
  url: string;
  /** Shortened uploader name («Γιώργος Π.»), or null when we have no name to show. */
  credit: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
}

const table = UGC_PHOTOS as unknown as Record<string, UgcPhoto[]>;

export const getUgcPhotos = (beachId: number | string | undefined | null): UgcPhoto[] => {
  if (beachId == null) return [];
  const found = table[String(beachId)];
  return Array.isArray(found) ? found : [];
};

export const getUgcPhotoUrls = (beachId: number | string | undefined | null): string[] =>
  getUgcPhotos(beachId).map(photo => photo.url).filter(Boolean);

/**
 * The record behind a rendered URL.
 *
 * Matches on the URL rather than on an index: the photo list a component holds
 * has been padded and sliced by the time it reaches a credit line, so position
 * is not a reliable key — and a credit under the wrong photo names the wrong
 * person, which is worse than showing none.
 */
export const findUgcPhotoByUrl = (
  beachId: number | string | undefined | null,
  photoUrl: string,
): UgcPhoto | null => {
  if (!photoUrl) return null;
  return getUgcPhotos(beachId).find(photo => photo.url === photoUrl) || null;
};

/** True for any URL that came out of our own moderation queue. */
export const isUgcPhotoUrl = (photoUrl: string): boolean =>
  /\/storage\/v1\/object\/public\/beach-photos-public\//.test(photoUrl || '');
