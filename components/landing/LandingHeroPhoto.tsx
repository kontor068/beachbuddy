import React from 'react';
import { HERO_SOURCES, HERO_DESKTOP_MEDIA, type HeroSlot, type HeroVariant } from './heroSources';

// Renders the landing hero's real photo as a fully responsive, art-directed
// <picture>: a tall mobile crop below the `sm:` breakpoint, a wide desktop
// crop above it (matching Tailwind's own breakpoint via HERO_DESKTOP_MEDIA),
// each offered in AVIF then WebP. This replaces a single fixed-resolution jpg
// stretched with object-cover — which is what was pixelating at wide desktop
// widths — with variants generated up to 2560px (see
// scripts/buildLandingHeroAssets.mjs).
//
// It is the hero's LCP image, so it loads eager + fetchPriority="high" and
// carries no lazy-loading.

interface LandingHeroPhotoProps {
  slot: HeroSlot;
  className?: string;
  onError?: () => void;
}

const srcSet = (variants: HeroVariant[], format: 'avif' | 'webp'): string =>
  variants.map(v => `${v[format]} ${v.width}w`).join(', ');

// Rough band width per breakpoint tier — used only for the `sizes` hint so the
// browser picks an appropriately sized file; the CSS layout itself is
// full-bleed (`w-full`) regardless.
const MOBILE_SIZES = '100vw';
const DESKTOP_SIZES = '100vw';

export const LandingHeroPhoto: React.FC<LandingHeroPhotoProps> = ({ slot, className, onError }) => {
  const sources = HERO_SOURCES[slot];
  // Mid-size webp as the plain <img> fallback for browsers that support
  // neither <picture> source selection nor AVIF (webp support is universal
  // across current browsers).
  const fallback = sources.desktop[Math.floor(sources.desktop.length / 2)];

  return (
    <picture>
      <source media={HERO_DESKTOP_MEDIA} type="image/avif" srcSet={srcSet(sources.desktop, 'avif')} sizes={DESKTOP_SIZES} />
      <source media={HERO_DESKTOP_MEDIA} type="image/webp" srcSet={srcSet(sources.desktop, 'webp')} sizes={DESKTOP_SIZES} />
      <source type="image/avif" srcSet={srcSet(sources.mobile, 'avif')} sizes={MOBILE_SIZES} />
      <source type="image/webp" srcSet={srcSet(sources.mobile, 'webp')} sizes={MOBILE_SIZES} />
      <img
        src={fallback.webp}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        onError={onError}
        className={className}
      />
    </picture>
  );
};

export default LandingHeroPhoto;
