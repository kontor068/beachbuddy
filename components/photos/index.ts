export { CuratedPhotoImage } from './CuratedPhotoImage';
// PhotoLightbox is deliberately NOT re-exported here. This barrel is welded into the
// preloaded `beach-ui` chunk (vite.config.ts), and the lightbox is only ever opened on the
// beach page, which is lazy-loaded. Exporting it here would put its code on every first
// paint. Import it from './photos/PhotoLightbox' directly.
