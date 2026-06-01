
export type AnalyticsEvent = 
  | 'app_loaded'
  | 'page_view'
  | 'language_changed'
  | 'region_changed'
  | 'weather_fallback_shown'
  | 'weather_retry_clicked'
  | 'search_used'
  | 'filter_applied'
  | 'filters_cleared'
  | 'empty_results_shown'
  | 'beach_detail_opened'
  | 'navigation_clicked'
  | 'favorite_clicked'
  | 'share_clicked'
  | 'recommendation_feedback_positive'
  | 'recommendation_feedback_negative'
  | 'forecast_expanded'
  | 'map_viewed'
  | 'map_marker_clicked'
  | 'beta_feedback_clicked'
  | 'beach_viewed'
  | 'beach_navigated'
  | 'beach_favorited'
  | 'search_performed'
  | 'region_selected'
  | 'beach_search'
  | 'recommendations_viewed'
  | 'beach_card_clicked'
  | 'beach_details_opened'
  | 'map_opened'
  | 'filter_used'
  | 'ai_advisor_question'
  | 'photo_suggestion_clicked'
  | 'recommendation_feedback';

export interface AnalyticsData {
  event: AnalyticsEvent;
  beachId?: number | string;
  timestamp: string;
  userLocation?: { lat: number; lon: number };
  metadata?: any;
}

export interface FeedbackData {
  beachId: number;
  feedback: 'accurate' | 'not_accurate';
  timestamp: string;
}

const STORAGE_KEY = 'beach_buddy_analytics';
const FEEDBACK_KEY = 'beach_buddy_feedback';
const CONSENT_KEY = 'beach_buddy_analytics_consent';
const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || '';
const GOOGLE_ANALYTICS_SCRIPT_ID = 'beach-buddy-google-analytics';
const GOOGLE_ANALYTICS_DENYLISTED_METADATA = new Set([
  'query',
  'question',
  'lat',
  'lon',
  'latitude',
  'longitude',
  'userLocation',
  'exactLocation',
  'email',
  'phone',
]);

type GoogleAnalyticsParams = Record<string, string | number | boolean>;
type GtagArguments = [string, ...unknown[]];
type GoogleConsentValue = 'granted' | 'denied';
type GoogleConsentModeSettings = {
  analytics_storage: GoogleConsentValue;
  ad_storage: GoogleConsentValue;
  ad_user_data: GoogleConsentValue;
  ad_personalization: GoogleConsentValue;
};

declare global {
  interface Window {
    dataLayer?: GtagArguments[];
    gtag?: (...args: GtagArguments) => void;
  }
}

export type AnalyticsConsent = 'accepted' | 'declined';

let googleAnalyticsInitialized = false;
let consentDefaultInitialized = false;

const DEFAULT_DENIED_CONSENT: GoogleConsentModeSettings = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

const getConsentModeSettings = (consent: AnalyticsConsent | null): GoogleConsentModeSettings => ({
  ...DEFAULT_DENIED_CONSENT,
  analytics_storage: consent === 'accepted' ? 'granted' : 'denied',
});

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageItem = (key: string, value: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Analytics storage should never block the app.
  }
};

const removeStorageItem = (key: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // Analytics storage should never block the app.
  }
};

export const isGoogleAnalyticsConfigured = () =>
  Boolean(GOOGLE_ANALYTICS_MEASUREMENT_ID) && import.meta.env.PROD;

const setGoogleAnalyticsDisabled = (disabled: boolean) => {
  if (!isGoogleAnalyticsConfigured() || typeof window === 'undefined') return;
  const windowFlags = window as unknown as Record<string, boolean>;
  windowFlags[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`] = disabled;
};

const initializeGoogleTag = () => {
  window.dataLayer = window.dataLayer || [];

  if (!window.gtag) {
    window.gtag = (...args: GtagArguments) => {
      window.dataLayer?.push(args);
    };
  }
};

const applyDefaultConsentMode = () => {
  if (consentDefaultInitialized) return;

  window.gtag?.('consent', 'default', DEFAULT_DENIED_CONSENT);
  consentDefaultInitialized = true;
};

const updateGoogleConsentMode = (consent: AnalyticsConsent | null) => {
  if (!isGoogleAnalyticsConfigured() || typeof window === 'undefined' || !window.gtag) return;
  window.gtag('consent', 'update', getConsentModeSettings(consent));
};

const appendGoogleAnalyticsScript = () => {
  if (document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}`;

  document.head.appendChild(script);
};

const ensureGoogleAnalyticsLoaded = () => {
  if (!isGoogleAnalyticsConfigured() || typeof window === 'undefined') return;
  const consent = getAnalyticsConsent();

  initializeGoogleTag();
  setGoogleAnalyticsDisabled(consent !== 'accepted');
  applyDefaultConsentMode();
  updateGoogleConsentMode(consent);

  if (consent !== 'accepted') return;

  if (!googleAnalyticsInitialized) {
    window.gtag?.('js', new Date());
    window.gtag?.('config', GOOGLE_ANALYTICS_MEASUREMENT_ID, {
      send_page_view: true,
    });
    googleAnalyticsInitialized = true;
  }

  appendGoogleAnalyticsScript();
};

const normalizeGoogleAnalyticsParamName = (key: string) => {
  const normalized = key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase();

  const withValidStart = /^[a-z]/.test(normalized) ? normalized : `m_${normalized}`;
  return withValidStart.slice(0, 40);
};

const toGoogleAnalyticsValue = (value: unknown): string | number | boolean | undefined => {
  if (typeof value === 'string') return value.slice(0, 100);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
};

const sanitizeAnalyticsMetadata = (metadata?: unknown): GoogleAnalyticsParams => {
  const params: GoogleAnalyticsParams = {};

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return params;
  }

  Object.entries(metadata).slice(0, 20).forEach(([key, value]) => {
    if (GOOGLE_ANALYTICS_DENYLISTED_METADATA.has(key)) return;

    const analyticsValue = toGoogleAnalyticsValue(value);
    if (analyticsValue === undefined) return;

    params[normalizeGoogleAnalyticsParamName(key)] = analyticsValue;
  });

  return params;
};

const buildGoogleAnalyticsParams = (
  beachId?: number | string,
  metadata?: unknown
): GoogleAnalyticsParams => {
  const params: GoogleAnalyticsParams = {};

  if (beachId !== undefined) {
    params.beach_id = String(beachId);
  }

  return {
    ...params,
    ...sanitizeAnalyticsMetadata(metadata),
  };
};

const trackGoogleAnalyticsEvent = (
  event: AnalyticsEvent,
  beachId?: number | string,
  metadata?: unknown
) => {
  ensureGoogleAnalyticsLoaded();
  if (typeof window === 'undefined' || !window.gtag || !isGoogleAnalyticsConfigured()) return;

  window.gtag('event', event, buildGoogleAnalyticsParams(beachId, metadata));
};

export const getAnalyticsConsent = (): AnalyticsConsent | null => {
  const value = getStorageItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
};

export const setAnalyticsConsent = (consent: AnalyticsConsent) => {
  setStorageItem(CONSENT_KEY, consent);

  if (consent === 'declined') {
    removeStorageItem(STORAGE_KEY);
  }

  if (isGoogleAnalyticsConfigured() && typeof window !== 'undefined') {
    initializeGoogleTag();
    applyDefaultConsentMode();
    setGoogleAnalyticsDisabled(consent !== 'accepted');
  }

  ensureGoogleAnalyticsLoaded();
  updateGoogleConsentMode(consent);
};

export const initializeAnalytics = () => {
  if (isGoogleAnalyticsConfigured() && typeof window !== 'undefined') {
    initializeGoogleTag();
    applyDefaultConsentMode();
    setGoogleAnalyticsDisabled(getAnalyticsConsent() !== 'accepted');
  }

  ensureGoogleAnalyticsLoaded();
  updateGoogleConsentMode(getAnalyticsConsent());
};

export const canTrackAnalytics = () => getAnalyticsConsent() === 'accepted';

export const trackEvent = (
  event: AnalyticsEvent, 
  beachId?: number | string, 
  metadata?: any,
  userLocation?: { lat: number; lon: number }
) => {
  if (!canTrackAnalytics()) return;

  const safeMetadata = sanitizeAnalyticsMetadata(metadata);
  trackGoogleAnalyticsEvent(event, beachId, safeMetadata);

  const data: AnalyticsData = {
    event,
    beachId,
    timestamp: new Date().toISOString(),
    metadata: safeMetadata
  };

  const existing = getEvents();
  existing.push(data);
  setStorageItem(STORAGE_KEY, JSON.stringify(existing));
  
  if (import.meta.env.DEV) {
    console.log(`[Analytics] Tracked: ${event}`, data);
  }
};

export const trackPageView = (
  path: string,
  metadata?: Record<string, string | number | boolean | undefined>
) => {
  trackEvent('page_view', undefined, {
    path,
    ...(metadata || {}),
  });
};

export const getEvents = (): AnalyticsData[] => {
  const stored = getStorageItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const storeFeedback = (beachId: number, feedback: 'accurate' | 'not_accurate') => {
  const data: FeedbackData = {
    beachId,
    feedback,
    timestamp: new Date().toISOString()
  };

  const existing = getFeedback();
  existing.push(data);
  setStorageItem(FEEDBACK_KEY, JSON.stringify(existing));
  
  trackEvent(
    feedback === 'accurate' ? 'recommendation_feedback_positive' : 'recommendation_feedback_negative',
    beachId,
    { feedback }
  );
};

export const getFeedback = (): FeedbackData[] => {
  const stored = getStorageItem(FEEDBACK_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const getNegativeFeedbackCount = (beachId: number): number => {
  const feedback = getFeedback();
  return feedback.filter(f => f.beachId === beachId && f.feedback === 'not_accurate').length;
};

export const getAnalyticsInsights = () => {
  const events = getEvents();
  
  const beachViews: Record<number | string, number> = {};
  const searchLocations: Record<string, number> = {};
  const beachFavorites: Record<number | string, number> = {};

  events.forEach(e => {
    if ((e.event === 'beach_viewed' || e.event === 'beach_detail_opened') && e.beachId) {
      beachViews[e.beachId] = (beachViews[e.beachId] || 0) + 1;
    }
    if ((e.event === 'search_performed' || e.event === 'beach_search' || e.event === 'search_used') && e.metadata?.search_length) {
      const key = `${e.metadata.search_length} chars`;
      searchLocations[key] = (searchLocations[key] || 0) + 1;
    }
    if ((e.event === 'beach_favorited' || e.event === 'favorite_clicked') && e.beachId) {
      beachFavorites[e.beachId] = (beachFavorites[e.beachId] || 0) + 1;
    }
  });

  return {
    beachViews,
    searchLocations,
    beachFavorites
  };
};
