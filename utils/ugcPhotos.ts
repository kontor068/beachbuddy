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
//
// TWO COPIES, AND THE LIVE ONE WINS. The baked table above is what this page was
// deployed with; services/liveUgcPhotos.ts fetches the same map from the public
// bucket after the page has painted, and hands it to setLiveUgcPhotos() below.
// A photo approved after the last deploy therefore appears without a deploy —
// which is the entire point, because a contributor who is told their photo will
// be on the card should not have to wait for the next code push to see it.
//
// REPLACES, never merges. The live map is the complete truth about what is
// approved right now, exactly as the build script would have baked it. Merging
// the two would make un-publishing impossible: a photo we took down would keep
// being served from the baked copy until someone happened to deploy.
//
// The baked copy is still the one that matters most. It is in the prerendered
// HTML, so it is what Google, a social preview and a visitor with JavaScript off
// all see. The live map is a head start, not a replacement for building.

import UGC_PHOTOS from '../data/beachPhotosUgc.generated.json';

export interface UgcPhoto {
  url: string;
  /** Shortened uploader name («Γιώργος Π.»), or null when we have no name to show. */
  credit: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
}

export type UgcPhotoTable = Record<string, UgcPhoto[]>;

const bakedTable = UGC_PHOTOS as unknown as UgcPhotoTable;

/** Null until the live index has been fetched; after that it replaces the baked map. */
let liveTable: UgcPhotoTable | null = null;

const table = (): UgcPhotoTable => liveTable || bakedTable;

// ── Telling the screen that the photos changed ───────────────────────────────
// getUgcPhotos is called during render, deep inside services/beachPhotos.ts, so
// it cannot be async and cannot itself wait for the network. The live map lands
// later and has to push: an integer that changes is what React subscribes to.
//
// A COUNTER, NOT THE DATA. useSyncExternalStore compares snapshots by identity,
// and returning the table object would re-render every subscriber on every call
// that rebuilt it. The version only moves when the content actually differs.

let version = 0;
const listeners = new Set<() => void>();

export const getUgcPhotosVersion = (): number => version;

export const subscribeUgcPhotos = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/**
 * Install the freshly fetched live map.
 *
 * Ignores an unchanged payload. The index is re-fetched on a timer and is
 * identical almost every time; without this check each poll would re-render the
 * whole beach list for nothing.
 */
export const setLiveUgcPhotos = (next: UgcPhotoTable | null): boolean => {
  if (!next || typeof next !== 'object') return false;
  if (JSON.stringify(next) === JSON.stringify(table())) {
    liveTable = next;
    return false;
  }
  liveTable = next;
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      // One broken subscriber must not stop the others from hearing about it.
      console.error('A photo-table listener threw.', error);
    }
  });
  return true;
};

export const getUgcPhotos = (beachId: number | string | undefined | null): UgcPhoto[] => {
  if (beachId == null) return [];
  const found = table()[String(beachId)];
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
