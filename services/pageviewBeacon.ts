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

// Coalesce identical consecutive pings (e.g. an effect firing twice) so one logical
// page view is one beacon. Uniqueness is server-side regardless, but this keeps the
// pageview total clean.
let lastPingKey = '';

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

  // Referrer host is added server-side from the Referer header; we pass only a coarse
  // page-type hint. Query params are the payload so navigator.sendBeacon can post with
  // no body (the most reliable transport, survives the unload of the page).
  const url = `${HIT_ENDPOINT}?t=${encodeURIComponent(type.slice(0, 24))}`;

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
