// Wikimedia Commons serves a resized file when the URL carries a `width` param, so a photo
// URL is really a family of URLs. This is the one place that knows how to walk that family.
//
// `.mjs` because both sides need it: the prerenderer (Node) writes the static <img>, and the
// React app writes the hydrated one. Before this existed only the prerenderer varied the
// width — the app asked for `width=800` for everything, a 640x360 card and a 960x600 hero
// alike, and shipped `sizes` with no `srcSet`, which the browser ignores entirely.
//
// Same pattern as utils/sitemapFingerprint.mjs and utils/localWindContext.mjs, both already
// imported from TypeScript.

const WIDTH_PARAM = /[?&]width=\d+/;

/** True when this URL can be resized at all. ~19 of our ~1.100 photo URLs cannot. */
export const isResizablePhotoUrl = url => typeof url === 'string' && WIDTH_PARAM.test(url);

/** The same URL asking for a different rendered width. Unchanged if it carries no width. */
export const sizedPhotoUrl = (url, width) => (
  isResizablePhotoUrl(url) ? url.replace(/([?&]width=)\d+/, `$1${width}`) : url
);

/**
 * A `srcset` string, or undefined when the URL is not resizable.
 *
 * Undefined rather than a single-entry set on purpose: emitting the identical URL under
 * several width descriptors is worse than emitting none, because the browser then believes
 * it has a choice and downloads full-size bytes for a thumbnail slot.
 */
export const photoSrcSet = (url, widths) => (
  isResizablePhotoUrl(url)
    ? widths.map(width => `${sizedPhotoUrl(url, width)} ${width}w`).join(', ')
    : undefined
);
