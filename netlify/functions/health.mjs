// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK — the endpoint an uptime monitor should watch.
//
// WHY NOT JUST WATCH THE HOMEPAGE: the site is ~9.500 pre-rendered static pages
// on a CDN. It stays up, and keeps returning a cheerful 200, long after the
// parts that make it a product have stopped working. A monitor on `/` proves
// Netlify is serving files. It proves nothing about whether the functions run.
//
// So this endpoint reports on the things that can fail silently:
//
//   functions — implicit. If this responds at all, the function runtime is alive.
//   blobs     — the store behind the visitor counter and the feedback log. When
//               it breaks, /api/hit and /api/traffic keep returning 200 while
//               quietly recording nothing.
//   upstream  — Open-Meteo, the single source of every forecast on the site.
//
// WHAT FAILS THE CHECK, AND WHAT DOES NOT. A 503 means something we own is
// broken and we can fix it: the runtime, or the store. Open-Meteo being down is
// reported but never fails the check — it is somebody else's outage, we cannot
// act on it at 3am, and a monitor that pages for things you cannot fix is a
// monitor you learn to ignore. It shows up in the body, where a human reading
// the response after a real alert will see it.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';

const TRAFFIC_STORE = 'traffic';
const UPSTREAM_PROBE = 'https://api.open-meteo.com/v1/forecast'
  + '?latitude=37.98&longitude=23.73&current=wind_speed_10m&timezone=UTC';
const UPSTREAM_TIMEOUT_MS = 4000;

const checkBlobs = async (event) => {
  try {
    // Netlify's lambda compatibility layer needs the raw event before getStore()
    // works — same reason pageview.mjs calls this first.
    connectLambda(event);
    const store = getStore(TRAFFIC_STORE);
    // A read of a key that does not exist is the cheapest proof the store answers:
    // it returns null rather than throwing, and it writes nothing.
    await store.get('__health__');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err).slice(0, 200) };
  }
};

const checkUpstream = async () => {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(UPSTREAM_PROBE, { signal: controller.signal });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, error: String(err?.name ?? err).slice(0, 100), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
};

export const handler = async (event) => {
  const [blobs, upstream] = await Promise.all([checkBlobs(event), checkUpstream()]);

  const healthy = blobs.ok;
  const body = {
    status: healthy ? (upstream.ok ? 'ok' : 'degraded') : 'fail',
    checks: { functions: { ok: true }, blobs, upstream },
    // No version, commit, region or env: a health endpoint is public by
    // definition — a monitor has to reach it unauthenticated — so it says
    // whether things work and nothing at all about how they are built.
  };

  return {
    statusCode: healthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Never cached, at any layer. An edge-cached health check reports the
      // weather from half an hour ago and is worse than having none: it would
      // keep answering 200 through an outage.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Netlify-CDN-Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
};
