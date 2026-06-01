type PhotoSuggestionTarget = {
  beachId: string | number;
  beachName: string;
  islandName?: string;
};

const getConfiguredPhotoSuggestionUrl = () => {
  const value = import.meta.env.VITE_PHOTO_SUGGESTION_URL;
  return typeof value === 'string' ? value.trim() : '';
};

export const buildPhotoSuggestionUrl = ({
  beachId,
  beachName,
  islandName,
}: PhotoSuggestionTarget): string | undefined => {
  const configuredUrl = getConfiguredPhotoSuggestionUrl();
  if (!configuredUrl) return undefined;

  try {
    const url = new URL(configuredUrl, window.location.origin);
    url.searchParams.set('beachId', String(beachId));
    url.searchParams.set('beachName', beachName);
    if (islandName) url.searchParams.set('island', islandName);
    return url.toString();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Invalid VITE_PHOTO_SUGGESTION_URL. Photo suggestion button is hidden.', error);
    }
    return undefined;
  }
};
