import type { LanguageCode } from '../types';
import attributionData from '../data/photoAttribution.generated.json';
import { findUgcPhotoByUrl, isUgcPhotoUrl } from './ugcPhotos';

/**
 * Credit line for the per-beach photos.
 *
 * WHAT WAS WRONG.
 *
 * `data/beachPhotosById.generated.json` stores bare image URLs and nothing else, and
 * the only attribution path the detail page had (`services/beachImageService.ts`) is
 * hard-gated to Milos — `if (!isMilos(island)) return undefined`. So every beach photo
 * outside one island rendered with no credit whatsoever. Measured 29/07/2026 by
 * `scripts/harvestPhotoAttribution.mjs` against the Wikimedia Commons API: of 1.054
 * photos we display, **958 are under a licence that requires attribution** (CC BY /
 * BY-SA, mostly 4.0 and 3.0). The reported beach — 965, Κανάλι του Έρωτα — is CC BY
 * 3.0 by Sergey Rsavin, whose own watermark is visible in the image we were showing
 * uncredited.
 *
 * WHAT THIS DOES.
 *
 * Renders the creator and the licence the licence itself demands, from the harvested
 * table. 16 Flickr-hosted photos have no author on record (their API needs a key), so
 * they fall back to a source-only link — honest about what we know rather than naming
 * the platform as the creator.
 *
 * Returns `null` for any URL shape we cannot place: a wrong credit is worse than none.
 */

export interface PhotoCredit {
  /** Full line, e.g. "Photo: Sergey Rsavin / CC BY 3.0". */
  label: string;
  /** The file page, where the licence terms and full author record live. */
  href: string;
  /** The licence deed, when the harvest recorded one. */
  licenseUrl: string | null;
  /** True when the licence obliges us to name the creator (958 of 1.054). */
  required: boolean;
}

interface AttributionTable {
  /** [licence name, deed URL, attribution-required flag]. */
  licenses: [string, string, number][];
  /** beach id → one [author, licenceIndex] per photo, aligned with the photo array. */
  byBeach: Record<string, ([string, number] | null)[]>;
}

const table = attributionData as unknown as AttributionTable;

const SOURCE_WORD: Record<LanguageCode, string> = {
  en: 'Photo',
  gr: 'Φωτογραφία',
  de: 'Foto',
  fr: 'Photo',
  it: 'Foto',
};

/**
 * Byline for a photo a visitor sent us, when we have no name on record.
 *
 * Never «Φωτογραφία: CalmBeach» — we did not take it, and claiming an
 * uploader's work as the site's own is exactly the thing we ask them to trust
 * us not to do.
 */
const VISITOR_CREDIT: Record<LanguageCode, string> = {
  en: 'from a visitor',
  gr: 'από επισκέπτη',
  de: 'von einem Besucher',
  fr: 'd’un visiteur',
  it: 'da un visitatore',
};

const commonsFilePage = (fileName: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replace(/%20/g, '_')}`;

/** The source page for a stored photo URL — where the licence actually lives. */
const sourcePageFor = (photoUrl: string): { href: string; source: string } | null => {
  // Commons "Special:Redirect/file/<name>" — the dominant shape (1.037 of 1.054).
  const redirect = /Special:Redirect\/file\/([^&?]+)/.exec(photoUrl);
  if (redirect) return { href: commonsFilePage(decodeURIComponent(redirect[1])), source: 'Wikimedia Commons' };

  // Direct upload.wikimedia.org file, incl. /thumb/ variants where the last path
  // segment is a resized copy and the real file name is the one before it.
  if (/^https?:\/\/upload\.wikimedia\.org\//i.test(photoUrl)) {
    const segments = photoUrl.split('?')[0].split('/').filter(Boolean);
    const name = photoUrl.includes('/thumb/') ? segments[segments.length - 2] : segments[segments.length - 1];
    if (!name) return null;
    return { href: commonsFilePage(decodeURIComponent(name)), source: 'Wikimedia Commons' };
  }

  // Flickr static host: live.staticflickr.com/<server>/<photoId>_<secret>_<size>.jpg.
  // photo.gne resolves a bare id to its photo page, where author + licence are shown.
  const flickr = /^https?:\/\/live\.staticflickr\.com\/[^/]+\/(\d+)_/i.exec(photoUrl);
  if (flickr) return { href: `https://www.flickr.com/photo.gne?id=${flickr[1]}`, source: 'Flickr' };

  return null;
};

export const getPhotoCredit = (
  photoUrl: string,
  language: LanguageCode,
  beachId?: number | string,
  photoIndex = 0,
): PhotoCredit | null => {
  if (!photoUrl) return null;
  const word = SOURCE_WORD[language] || SOURCE_WORD.en;

  // OUR OWN CONTRIBUTORS COME FIRST, and they are the one case with no external
  // source page to link to — the licence is the permission the uploader gave us
  // in the form, not a Commons deed. `required: true` because naming them is the
  // entire deal we offered: "send it and see your name under it on the card".
  if (isUgcPhotoUrl(photoUrl)) {
    const ugc = findUgcPhotoByUrl(beachId, photoUrl);
    const name = ugc?.credit || VISITOR_CREDIT[language] || VISITOR_CREDIT.en;
    return { label: `${word}: ${name}`, href: '', licenseUrl: null, required: true };
  }

  const page = sourcePageFor(photoUrl);
  if (!page) return null;

  const harvested = beachId != null ? table.byBeach[String(beachId)]?.[photoIndex] : null;

  if (harvested) {
    const [author, licenseIdx] = harvested;
    const [licenseName, licenseUrl, requiredFlag] = table.licenses[licenseIdx] || ['', '', 1];
    return {
      label: licenseName ? `${word}: ${author} / ${licenseName}` : `${word}: ${author}`,
      href: page.href,
      licenseUrl: licenseUrl || null,
      required: requiredFlag === 1,
    };
  }

  // No author on record (the 16 Flickr photos): name the source, never a creator.
  return { label: `${word}: ${page.source}`, href: page.href, licenseUrl: null, required: false };
};
