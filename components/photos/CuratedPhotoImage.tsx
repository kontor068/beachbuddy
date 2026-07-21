import type { CuratedPhoto } from '../../data/photoRegistry';

interface CuratedPhotoImageProps {
  photo: CuratedPhoto;
  className?: string;
  imgClassName?: string;
  showAttribution?: boolean;
  attributionClassName?: string;
}

const defaultAttributionClassName =
  'text-xs leading-tight text-slate-700';

const getAttributionText = (photo: CuratedPhoto): string => {
  const details = [photo.author, photo.license].filter(Boolean).join(' / ');

  return details ? `Photo: ${details}` : 'Photo source';
};

export const CuratedPhotoImage = ({
  photo,
  className,
  imgClassName,
  showAttribution = false,
  attributionClassName,
}: CuratedPhotoImageProps) => {
  const shouldShowAttribution = showAttribution && photo.attributionRequired;
  const attributionText = getAttributionText(photo);
  const resolvedAttributionClassName =
    attributionClassName ?? defaultAttributionClassName;

  // Curated photos ship an AVIF sibling next to the WebP (scripts/generateCuratedPhotoAvif.mjs,
  // which fails the build if any is missing). Offer AVIF first via <picture>; browsers without
  // AVIF support fall back to the WebP <img>. The <img> keeps every layout/loading attribute so
  // sizing, lazy-loading and LCP priority are unchanged.
  const avifSrc = /\.webp$/i.test(photo.src) ? photo.src.replace(/\.webp$/i, '.avif') : null;

  return (
    <figure className={className}>
      <picture>
        {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
        <img
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={photo.loading}
          decoding="async"
          fetchPriority={photo.fetchPriority}
          className={imgClassName}
        />
      </picture>
      {shouldShowAttribution && (
        <figcaption className={resolvedAttributionClassName}>
          {photo.sourceUrl ? (
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {attributionText}
            </a>
          ) : (
            attributionText
          )}
        </figcaption>
      )}
    </figure>
  );
};
