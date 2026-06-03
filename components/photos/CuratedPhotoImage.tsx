import type { CuratedPhoto } from '../../data/photoRegistry';

interface CuratedPhotoImageProps {
  photo: CuratedPhoto;
  className?: string;
  imgClassName?: string;
  showAttribution?: boolean;
  attributionClassName?: string;
}

const defaultAttributionClassName =
  'text-xs leading-tight text-slate-500';

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

  return (
    <figure className={className}>
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
