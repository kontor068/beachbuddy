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
// meter, GA4 stays the (consent-gated) behavioural analytics. It must NOT import
// from analyticsService either — analyticsService imports `recordAction` from here,
// and a cycle between the two would be a module-init hazard across Vite chunks.
//
// Three kinds of ping, all the same endpoint:
//   (page view)  the default — counts a pageview
//   hb=1         presence heartbeat while the tab is VISIBLE — powers "who is on
//                the site right now" and the honest time-on-site number
//   a=<action>   a click worth counting (navigate/share/…) — the nearest thing this
//                site has to a conversion, and GA4 sees only half of them
// ─────────────────────────────────────────────────────────────────────────────

const HIT_ENDPOINT = '/api/hit';
// Non-identifying, first-party "have I been here before" flag. NOT a cookie and NOT
// an id — a single boolean in localStorage, used only to split new vs returning. If
// storage is blocked (private mode) we simply report 'unknown' and move on.
const SEEN_KEY = 'cb_seen';
// Per-device opt-out: when set, this device is never counted (so the operator's own
// visits don't pollute the numbers). Toggled from a button on the /api/traffic
// dashboard — same origin, so the flag it sets is visible here.
const OPTOUT_KEY = 'cb_optout';
// Last UTC day this device pinged. Lets the client assert "definitely NOT my first
// ping today" (f=0), which the server uses to suppress a Blobs eventual-consistency
// race that was re-counting one visitor's 2nd/3rd pageview in the per-visitor
// breakdowns (devices summed to 50 with 47 uniques). Not an id — just a date.
const DAY_KEY = 'cb_day';
// "<utc-day>:<n>" — how many pages this device has opened today. The server cannot
// work this out reliably (its reads are eventually consistent for up to a minute),
// so the client, which knows for certain, sends it. It is what makes the bounce
// rate exact instead of a guess.
const PV_KEY = 'cb_pv';

// Mirrors analyticsService's env gate without importing it (see the note above).
// Unset (local build) defaults to production so we never silently stop counting.
const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined)?.trim() || 'production';
const isProduction = (): boolean => APP_ENV === 'production';

const readStore = (key: string): string | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // storage blocked — the ping still goes out, just without the flag
  }
};

const isOptedOut = (): boolean => readStore(OPTOUT_KEY) === '1';

const utcDay = (): string => new Date().toISOString().slice(0, 10);

/** '1' first ping of this UTC day, '0' definitely not, '' if storage is blocked. */
const firstOfDay = (): '1' | '0' | '' => {
  if (typeof localStorage === 'undefined') return '';
  const today = utcDay();
  if (readStore(DAY_KEY) === today) return '0';
  writeStore(DAY_KEY, today);
  return readStore(DAY_KEY) === today ? '1' : '';
};

/** 1-based index of this pageview within the device's day; 0 if storage is blocked. */
const nextPageviewIndex = (): number => {
  const today = utcDay();
  const raw = readStore(PV_KEY) || '';
  const [day, n] = raw.split(':');
  const next = day === today ? (Number(n) || 0) + 1 : 1;
  writeStore(PV_KEY, `${today}:${next}`);
  return readStore(PV_KEY) === `${today}:${next}` ? next : 0;
};

// Coalesce identical consecutive pings (e.g. an effect firing twice) so one logical
// page view is one beacon. Uniqueness is server-side regardless, but this keeps the
// pageview total clean.
let lastPingKey = '';

/** 'new' on the first ever visit (sets the flag), else 'ret'; 'unknown' if storage blocked. */
const visitorKind = (): 'new' | 'ret' | 'unknown' => {
  if (typeof localStorage === 'undefined') return 'unknown';
  if (readStore(SEEN_KEY)) return 'ret';
  writeStore(SEEN_KEY, '1');
  return readStore(SEEN_KEY) ? 'new' : 'unknown';
};

/**
 * Coarse, low-cardinality section: the region for beach paths, else the top segment.
 *
 * The locale prefix is dropped first (same list as LOCALE_ROUTE_PREFIX_PATTERN in
 * utils/beachUrls.ts). Without that, `/el/beaches/naxos/` was recorded as "el" and not
 * as Naxos — 31% of all pageviews were filed under a LANGUAGE instead of the island the
 * visitor was actually reading, and the Greek pages of the busiest islands were exactly
 * the ones that vanished. The quality board reads these keys to decide which region to
 * re-check next, so the blind spot was steering real work.
 *
 * What lands here is the URL SLUG ("naxos"), never the region id ("south-aegean-naxos") —
 * the ledger carries a matching `slug` for that reason.
 */
const LOCALE_SEGMENTS = new Set(['el', 'de', 'fr', 'it']);

const sectionFromPath = (): string => {
  const segs = window.location.pathname.split('/').filter(Boolean);
  const rest = segs.length && LOCALE_SEGMENTS.has(segs[0]) ? segs.slice(1) : segs;
  if (rest.length === 0) return 'home';
  if (rest[0] === 'beaches' && rest[1]) return rest[1].slice(0, 32); // region URL slug
  return rest[0].slice(0, 32);
};

/** Fire and forget. sendBeacon first — it survives the page unloading. */
const send = (url: string): void => {
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

const canCount = (): boolean =>
  typeof window !== 'undefined' && isProduction() && !isOptedOut();

/**
 * Record one page view. `type` is a coarse page kind (region/detail/landing/…),
 * never anything identifying. No-op off production and outside the browser.
 */
export const recordPageview = (type: string = 'page'): void => {
  if (!canCount()) return;

  // Coalesce by PATH only: the initial `load` ping and the first in-app page-view
  // effect share a path, so this counts that load once. A real navigation changes
  // the path in this SPA (region ↔ detail paths differ), so it still counts.
  const path = window.location.pathname;
  if (path === lastPingKey) return;
  lastPingKey = path;

  // Referrer host + country + device are added server-side (from headers). We pass a
  // coarse page-type, the new/returning flag, the section, the page path and the
  // viewport width. Query params are the payload so navigator.sendBeacon can post
  // with no body (the most reliable transport, it survives the unload of the page).
  // None of this identifies the visitor.
  // The HTTP Referer header on a same-origin beacon is OUR OWN page URL, so the
  // server can't see where the visit came from — pass document.referrer (the real
  // origin of the visit: google.com, facebook, empty for direct) explicitly. It is
  // set at document load and survives SPA navigations, and only its hostname is
  // ever kept server-side.
  send(
    `${HIT_ENDPOINT}?t=${encodeURIComponent(type.slice(0, 24))}` +
      `&v=${visitorKind()}` +
      `&s=${encodeURIComponent(sectionFromPath())}` +
      `&f=${firstOfDay()}` +
      `&n=${nextPageviewIndex()}` +
      `&pg=${encodeURIComponent(path.slice(0, 64))}` +
      `&w=${window.innerWidth || 0}` +
      `&r=${encodeURIComponent((document.referrer || '').slice(0, 200))}`
  );

  startPresenceHeartbeat();
};

// ── presence ────────────────────────────────────────────────────────────────
// A pageview alone cannot say whether someone is still reading. A heartbeat can —
// and it is also what turns "time on site" from a fabricated number into a measured
// one. Rules that keep it honest and cheap:
//   • only while the tab is actually VISIBLE (a forgotten background tab is not a
//     reader, and counting it would inflate every average)
//   • every 60s, and immediately when the tab becomes visible again
//   • hard stop after an hour, so one abandoned open tab cannot ping all day

const HEARTBEAT_MS = 60_000;
const MAX_HEARTBEATS = 60;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatsSent = 0;

const sendHeartbeat = (): void => {
  if (!canCount()) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (heartbeatsSent >= MAX_HEARTBEATS) {
    stopPresenceHeartbeat();
    return;
  }
  heartbeatsSent += 1;
  send(`${HIT_ENDPOINT}?hb=1&s=${encodeURIComponent(sectionFromPath())}`);
};

const stopPresenceHeartbeat = (): void => {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

/** Idempotent — safe to call from every pageview. */
export const startPresenceHeartbeat = (): void => {
  if (heartbeatTimer !== null || !canCount()) return;
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    });
  }
};

// ── actions ─────────────────────────────────────────────────────────────────

/** The GA4 event names we mirror first-party, and the short token sent on the wire. */
const ACTION_BY_EVENT: Record<string, string> = {
  navigation_clicked: 'nav',
  share_clicked: 'share',
  favorite_clicked: 'fav',
  outbound_link_clicked: 'out',
  search_used: 'search',
  filter_applied: 'filter',
};

// One action of a kind per second is plenty; a double-fired handler must not
// double-count a conversion.
const lastActionAt: Record<string, number> = {};

/**
 * Count a visitor action first-party. Called from analyticsService.trackEvent BEFORE
 * its consent gate, on purpose: this stores nothing about the person, and it is the
 * only way we see conversions from the visitors GA4 never gets to observe.
 * Unknown events are ignored, so the wire stays a fixed, tiny vocabulary.
 */
export const recordAction = (event: string): void => {
  const action = ACTION_BY_EVENT[event];
  if (!action || !canCount()) return;

  const now = Date.now();
  if (now - (lastActionAt[action] || 0) < 1000) return;
  lastActionAt[action] = now;

  send(`${HIT_ENDPOINT}?a=${action}&s=${encodeURIComponent(sectionFromPath())}`);
};
