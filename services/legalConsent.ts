import { LEGAL_VERSION } from '../utils/legalContent';
import { getAnalyticsConsent, setAnalyticsConsent } from './analyticsService';

// Records the GDPR/ePrivacy cookie/analytics consent choices as an append-only
// consent log for evidence. All storage is best-effort and must never block the
// app. There is no account system, so this is device-local; a server endpoint
// can later mirror it for durable evidence.
// Terms of Use are browsewrap (linked in the footer, not a forced clickwrap) —
// there's no critical liability exposure requiring explicit recorded acceptance.

const CONSENT_LOG_KEY = 'calmbeach_consent_log';
const MAX_LOG_ENTRIES = 50;

/** Fired after any cookie consent change so open UI (e.g. the first-run banner) can react. */
export const COOKIE_CONSENT_CHANGED_EVENT = 'calmbeach:cookieConsentChanged';

export interface CookieConsentState {
  necessary: true;
  analytics: boolean;
}

export type ConsentChoice = 'accept_all' | 'reject_all' | 'custom';

export interface ConsentLogEntry {
  at: string;
  version: string;
  type: 'terms' | 'cookies';
  choice?: ConsentChoice | 'accepted';
  categories?: Record<string, boolean>;
  language?: string;
  source?: string;
}

const readItem = (key: string): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeItem = (key: string, value: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // Consent storage should never block the app.
  }
};

const nowIso = (): string => {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
};

// ---- Consent log ----------------------------------------------------------

export const getConsentLog = (): ConsentLogEntry[] => {
  const stored = readItem(CONSENT_LOG_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const appendConsentLog = (entry: ConsentLogEntry) => {
  const log = getConsentLog();
  log.push(entry);
  writeItem(CONSENT_LOG_KEY, JSON.stringify(log.slice(-MAX_LOG_ENTRIES)));
};

// ---- Cookie / analytics consent -------------------------------------------

/** Current cookie consent derived from the analytics gate; null = no choice yet. */
export const getCookieConsentState = (): CookieConsentState | null => {
  const analytics = getAnalyticsConsent();
  if (analytics === null) return null;
  return { necessary: true, analytics: analytics === 'accepted' };
};

/**
 * Apply a cookie choice: flips the Google Analytics gate (Consent Mode) and writes an
 * evidentiary log entry. `necessary` is always on and cannot be toggled off.
 */
export const applyCookieConsent = (
  state: CookieConsentState,
  opts: { choice: ConsentChoice; language?: string; source?: string } = { choice: 'custom' },
) => {
  setAnalyticsConsent(state.analytics ? 'accepted' : 'declined');
  appendConsentLog({
    at: nowIso(),
    version: LEGAL_VERSION,
    type: 'cookies',
    choice: opts.choice,
    categories: { necessary: true, analytics: state.analytics },
    language: opts.language,
    source: opts.source,
  });
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT));
  }
};
