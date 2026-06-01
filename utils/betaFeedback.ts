type BetaFeedbackTarget = {
  locale: string;
  regionId?: string;
  regionName?: string;
};

const getConfiguredBetaFeedbackUrl = () => {
  const value = import.meta.env.VITE_BETA_FEEDBACK_URL;
  return typeof value === 'string' ? value.trim() : '';
};

export const buildBetaFeedbackUrl = ({
  locale,
  regionId,
  regionName,
}: BetaFeedbackTarget): string | undefined => {
  const configuredUrl = getConfiguredBetaFeedbackUrl();
  if (!configuredUrl) return undefined;

  try {
    const url = new URL(configuredUrl, window.location.origin);
    url.searchParams.set('locale', locale);
    if (regionId) url.searchParams.set('regionId', regionId);
    if (regionName) url.searchParams.set('region', regionName);
    return url.toString();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Invalid VITE_BETA_FEEDBACK_URL. Beta feedback CTA is hidden.', error);
    }
    return undefined;
  }
};
