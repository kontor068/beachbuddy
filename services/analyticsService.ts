
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
  | 'forecast_day_selected'
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
  | 'recommendation_feedback'
  | 'condition_feedback'
  | 'install_prompt_shown'
  | 'install_prompt_accepted'
  | 'install_prompt_dismissed'
  | 'app_installed'
  // One real Open-Meteo origin fetch (cache MISS only). The GA4 aggregate of these
  // ≈ our real calls/day and is the trigger signal for moving to a shared server cache.
  | 'open_meteo_fetch';

/** Which Open-Meteo endpoint a counted origin call hit. */
export type OpenMeteoEndpoint = 'current' | 'hourly' | 'marine';

export interface AnalyticsData {
  event: AnalyticsEvent;
  beachId?: number | string;
  timestamp: string;
  userLocation?: { lat: number; lon: number };
  metadata?: any;
}

export type ConditionFeedbackVerdict = 'accurate' | 'had_waves' | 'too_windy' | 'calmer';

export interface FeedbackData {
  beachId: number;
  feedback: 'accurate' | 'not_accurate' | ConditionFeedbackVerdict;
  timestamp: string;
  // Modeled conditions at feedback time, so an offline pass can later calibrate the
  // per-beach/sector model against what the visitor actually observed (roadmap #7).
  conditions?: { exposureLevel?: string; beaufort?: number; windDir?: string; date?: string };
}

export interface FeedbackNotificationContext {
  source?: string;
  beachName?: string;
  islandName?: string;
  regionId?: string;
  language?: string;
  pagePath?: string;
}

const STORAGE_KEY = 'beach_buddy_analytics';
const FEEDBACK_KEY = 'beach_buddy_feedback';
const CONSENT_KEY = 'beach_buddy_analytics_consent';
const OPEN_METEO_CALLS_KEY = 'beach_buddy_open_meteo_calls';
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
    // gtag.js only treats a dataLayer entry as a command when it is the native
    // `arguments` object. Pushing a (spread) array makes the library silently
    // ignore `config`/`event`/`consent`, so no GA4 destination is ever registered
    // and zero hits are sent — which looks like "GA is dead" while Search Console
    // (server-side) still reports traffic. Mirror Google's canonical snippet.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments as unknown as GtagArguments);
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
      // We emit page_view manually from the app router (state-based navigation),
      // so GA4's automatic first-load page_view is disabled to avoid double-counting.
      send_page_view: false,
      // Cap the _ga / _ga_<id> cookie lifetime at ~13 months so it matches the
      // duration stated in the Cookie Policy (GA4 otherwise defaults to 2 years).
      cookie_expires: 60 * 60 * 24 * 30 * 13,
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

const sendFeedbackEmail = (payload: {
  source: string;
  beachId: number;
  feedback: FeedbackData['feedback'];
  timestamp: string;
  conditions?: FeedbackData['conditions'];
  context?: FeedbackNotificationContext;
}) => {
  if (typeof fetch === 'undefined') return;

  fetch('/.netlify/functions/feedback-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then(response => {
    if (!response.ok && import.meta.env.DEV) {
      console.warn(`[Feedback] Email delivery failed with HTTP ${response.status}`);
    }
  }).catch(error => {
    if (import.meta.env.DEV) {
      console.warn('[Feedback] Email delivery failed.', error);
    }
  });
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
  metadata?: any
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
  const loc = typeof window !== 'undefined' ? window.location : undefined;
  trackEvent('page_view', undefined, {
    // GA4-recommended page params (send_page_view is off, so these are the
    // canonical source of truth for the page_view event).
    page_path: path,
    page_location: loc ? `${loc.origin}${path}${loc.search}${loc.hash}` : path,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    // Retained for the local event log / existing consumers.
    path,
    ...(metadata || {}),
  });
};

/**
 * Static wind-exposure descriptors for a beach, normalized for GA4. Every field
 * falls back to 'unknown' (never undefined). Notes on the data model:
 *  - shelterLevel lives on Beach.windProfile, not top-level.
 *  - fetchExposure is a top-level Beach field.
 *  - exposureStatus is NOT a static Beach field; it is a live/computed value
 *    (SimpleWindSuitability) and is only known when passed in explicitly.
 */
export const buildBeachExposureParams = (
  beach?: {
    windProfile?: { shelterLevel?: string | null } | null;
    fetchExposure?: string | null;
  } | null,
  exposureStatus?: string | null,
): { shelter_level: string; exposure_status: string; fetch_exposure: string } => ({
  shelter_level: beach?.windProfile?.shelterLevel ?? 'unknown',
  exposure_status: exposureStatus ?? 'unknown',
  fetch_exposure: beach?.fetchExposure ?? 'unknown',
});

export const getEvents = (): AnalyticsData[] => {
  const stored = getStorageItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const storeFeedback = (
  beachId: number,
  feedback: 'accurate' | 'not_accurate',
  context?: FeedbackNotificationContext
) => {
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
  sendFeedbackEmail({
    source: context?.source || 'recommendation_feedback',
    beachId,
    feedback,
    timestamp: data.timestamp,
    context,
  });
};

/**
 * Structured "how was it really?" feedback (roadmap #7 — the capture half of the loop).
 * Pairs the visitor's observed verdict with the modeled conditions and ships it as a GA4
 * 'condition_feedback' event + a local record. The CALIBRATION half (aggregate verdicts
 * per beach/sector and nudge the model / ground truth) is an offline pass over exported
 * GA data — there is no app backend to close the loop live.
 */
export const storeConditionFeedback = (
  beachId: number,
  verdict: ConditionFeedbackVerdict,
  conditions?: FeedbackData['conditions'],
  context?: FeedbackNotificationContext
) => {
  const data: FeedbackData = { beachId, feedback: verdict, timestamp: new Date().toISOString(), conditions };
  const existing = getFeedback();
  existing.push(data);
  setStorageItem(FEEDBACK_KEY, JSON.stringify(existing));
  trackEvent('condition_feedback', beachId, { verdict, ...(conditions || {}) });
  sendFeedbackEmail({
    source: context?.source || 'condition_feedback',
    beachId,
    feedback: verdict,
    timestamp: data.timestamp,
    conditions,
    context,
  });
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

// "Worse than shown" verdicts that should downrank a beach in live scoring (recommendation
// Service consumes this count). Includes the structured negatives so the live per-device
// penalty keeps working after the binary not_accurate button was replaced (roadmap #7).
// 'calmer' is the opposite signal (model over-warned) and 'accurate' is neutral, so neither
// penalises here — softening stays evidence-gated in the offline calibration pass.
const NEGATIVE_FEEDBACK = new Set<FeedbackData['feedback']>(['not_accurate', 'had_waves', 'too_windy']);
export const getNegativeFeedbackCount = (beachId: number): number => {
  const feedback = getFeedback();
  return feedback.filter(f => f.beachId === beachId && NEGATIVE_FEEDBACK.has(f.feedback)).length;
};

// --- Open-Meteo call counter -------------------------------------------------
// A per-UTC-day count of REAL origin fetches (cache misses), so we can see how close
// we are to Open-Meteo's 10,000/day limit without any backend. Two sinks:
//   • localStorage (always, no PII) — a local operational counter for quick inspection.
//   • GA4 event (consent-gated)     — the cross-user aggregate = real calls/day. Because
//     it is consent-gated it UNDER-counts (declined users), so treat it as a lower bound /
//     trend alarm, not an exact meter.
// Rough Tier-B (shared server cache) trigger: amber at a sustained ~4,000–5,000/day, red
// beyond ~7,000/day or on repeated HTTP 429s.
const utcDayKey = (date: Date): string => date.toISOString().slice(0, 10);

interface OpenMeteoDayCount {
  day: string;
  count: number;
}

const readOpenMeteoDayCount = (): OpenMeteoDayCount | null => {
  const stored = getStorageItem(OPEN_METEO_CALLS_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as OpenMeteoDayCount;
    return typeof parsed?.day === 'string' && typeof parsed?.count === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

export const recordOpenMeteoCall = (endpoint: OpenMeteoEndpoint) => {
  // Local counter — always on (operational, no personal data).
  const today = utcDayKey(new Date());
  const existing = readOpenMeteoDayCount();
  const next: OpenMeteoDayCount = existing && existing.day === today
    ? { day: today, count: existing.count + 1 }
    : { day: today, count: 1 };
  setStorageItem(OPEN_METEO_CALLS_KEY, JSON.stringify(next));

  // Cross-user aggregate — consent-gated. Sent directly (NOT via trackEvent) so the
  // high-frequency counter never bloats the local analytics event log.
  if (canTrackAnalytics()) {
    trackGoogleAnalyticsEvent('open_meteo_fetch', undefined, { endpoint });
  }

  if (import.meta.env.DEV) {
    console.log(`[weather] Open-Meteo origin call #${next.count} today (${endpoint})`);
  }
};

/** Real Open-Meteo origin calls counted on THIS device today (UTC). 0 if none / new day. */
export const getOpenMeteoCallCountToday = (): number => {
  const today = utcDayKey(new Date());
  const stored = readOpenMeteoDayCount();
  return stored && stored.day === today ? stored.count : 0;
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
