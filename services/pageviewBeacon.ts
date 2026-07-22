// ─────────────────────────────────────────────────────────────────────────────
// FIRST-PARTY VISITOR BEACON — the client half of the "real traffic" counter.
//
// Fires a tiny, same-origin ping to /api/hit on every page load and SPA navigation.
// Unlike GA4 (services/analyticsService.ts) this runs UNCONDITIONALLY — no consent
// gate — because the server stores ZERO cookies and ZERO personal data (only an
// irreversible daily hash; see netlify/functions/pageview.mjs). That is exactly what
// lets it count the ~half of real visitors GA4 misses to consent + ad-blockers.
//
// It is deliberately independent of analyticsService: this is the honest traffic
// meter, GA4 stays the (consent-gated) behavioural analytics.
// ─────────────────────────────────────────────────────────────────────────────

import { isProductionEnvironment } from './analyticsService';

const HIT_ENDPOINT = '/api/hit';
// Non-identifying, first-party "have I been here before" flag. NOT a cookie and NOT
// an id — a single boolean in localStorage, used only to split new vs returning. If
// storage is blocked (private mode) we simply report 'unknown' and move on.
const SEEN_KEY = 'cb_seen';

// Coalesce identical consecutive pings (e.g. an effect firing twice) so one logical
// page view is one beacon. Uniqueness is server-side regardless, but this keeps the
// pageview total clean.
let lastPingKey = '';

/** 'new' on the first ever visit (sets the flag), else 'ret'; 'unknown' if storage blocked. */
const visitorKind = (): 'new' | 'ret' | 'unknown' => {
  try {
    if (typeof localStorage === 'undefined') return 'unknown';
    if (localStorage.getItem(SEEN_KEY)) return 'ret';
    localStorage.setItem(SEEN_KEY, '1');
    return 'new';
  } catch {
    return 'unknown';
  }
};

/** Coarse, low-cardinality section: the region/island for beach paths, else the top segment. */
const sectionFromPath = (): string => {
  const segs = window.location.pathname.split('/').filter(Boolean);
  if (segs.length === 0) return 'home';
  if (segs[0] === 'beaches' && segs[1]) return segs[1].slice(0, 32); // region/island id
  return segs[0].slice(0, 32);
};

/**
 * Record one page view. `type` is a coarse page kind (region/detail/landing/…),
 * never anything identifying. No-op off production and outside the browser.
 */
export const recordPageview = (type: string = 'page'): void => {
  if (typeof window === 'undefined' || !isProductionEnvironment()) return;

  // Coalesce by PATH only: the initial `load` ping and the first in-app page-view
  // effect share a path, so this counts that load once. A real navigation changes
  // the path in this SPA (region ↔ detail paths differ), so it still counts.
  const path = window.location.pathname;
  if (path === lastPingKey) return;
  lastPingKey = path;

  // Referrer host + country + device are added server-side (from headers). We pass a
  // coarse page-type, the new/returning flag, and the section. Query params are the
  // payload so navigator.sendBeacon can post with no body (the most reliable transport,
  // it survives the unload of the page). None of this identifies the visitor.
  const url =
    `${HIT_ENDPOINT}?t=${encodeURIComponent(type.slice(0, 24))}` +
    `&v=${visitorKind()}` +
    `&s=${encodeURIComponent(sectionFromPath())}`;

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url);
      return;
    }
  } catch {
    // fall through to fetch
  }

  try {
    void fetch(url, { method: 'POST', keepalive: true, cache: 'no-store' });
  } catch {
    // A missed count must never affect the app.
  }
};
