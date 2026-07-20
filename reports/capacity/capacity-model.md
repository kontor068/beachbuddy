# Capacity model — how much traffic CalmBeach can hold, and the fix

_Snapshot 2026-07-20. Source: GA4 property 518301405, last 28 days._

## TL;DR

- The static site (HTML/JS/photos on CDN) scales **effectively without limit** —
  it is not the bottleneck.
- The real ceiling is the **Open-Meteo free quota** (~**10,000 calls/day**, plus
  ~5,000/hour and ~600/minute), because forecasts are fetched **client-side** and
  cached **per-device** — so N users viewing the same beach make N calls.
- Today's peak is **~1,311 measured calls/day** (GA is consent-gated, so the real
  number is roughly **2×** → ~2,600/day). That's **~25% of the daily cap**.
- **Headroom ≈ 4× current traffic on an average day**, but a viral summer morning
  (calls cluster ~9–11am) can hit the **per-minute** cap first.
- **The fix (built, flag-off): an edge-cached forecast proxy.** It makes upstream
  calls scale with *distinct beaches viewed*, not with *users* — decoupling
  capacity from audience size. After it, 10× the users barely moves upstream load.

## The numbers

| Metric (28-day) | Value |
|---|---|
| Peak day (2026-07-17) | 21 users, 38 sessions, **1,311** Open-Meteo calls |
| Total Open-Meteo calls (28d) | 5,827 → avg ~208/day |
| Calls per session at peak | ~34 (each beach view = current + hourly + marine = 3 calls) |
| Busiest by events | 07-17 (2,786), 07-18 (2,184), 06-29 (2,025) |

**Why 34 calls/session:** viewing ~10 beaches × 3 endpoints. Capacity is driven by
**beaches-viewed-per-session × users**, not users alone.

## The ceiling (Open-Meteo free, non-commercial)

| Window | Limit | Peak today (measured) | Consent-adjusted (~2×) | % of limit |
|---|---|---|---|---|
| per day | 10,000 | 1,311 | ~2,600 | ~26% |
| per hour | 5,000 | ~650* | ~1,300 | ~26% |
| per minute | 600 | spiky | spiky | **the real spike risk** |

\*if half the day's calls fall in a ~2h morning window (realistic — beach-checking
is diurnal). The daily and hourly caps are comfortable; a **viral morning** is what
would trip the per-minute cap first.

## When we hit the wall (linear model, no proxy)

Calls/day ≈ `users × beaches_per_session × 3`. Growth is ~linear in users:

| Traffic vs today | Est. calls/day (adjusted) | Status |
|---|---|---|
| 1× (now) | ~2,600 | ✅ comfortable |
| 2× | ~5,200 | ✅ fine (amber watch) |
| 4× | ~10,400 | ⚠️ at/over the daily cap |
| 10× (summer viral) | ~26,000 | ❌ breaks — forecasts fail for everyone |

So **~4× average traffic** is the soft ceiling; a concentrated spike can bite sooner.

## The fix — edge-cached forecast proxy (zero cost)

Built at `netlify/functions/forecast.mjs`, wired through the forecast seam
(`services/forecast/`, seam #2). **Currently OFF** behind `VITE_FORECAST_PROXY_BASE`.

How it changes the math:
- Client still caches per-device first (unchanged). On a cache miss it calls
  **our** same-origin proxy instead of Open-Meteo directly.
- The proxy sets `Netlify-CDN-Cache-Control: public, s-maxage=1800,
  stale-while-revalidate=3600`. Netlify's CDN then serves the **same forecast to
  every user** for the TTL — so both the function invocation **and** the upstream
  Open-Meteo call happen **once per beach per ~30 min**, no matter how many users
  ask.
- Upstream load flips from `O(users × beaches)` to `O(distinct_beaches ×
  refreshes/day)` — **independent of audience size**. At 10× users, distinct
  beaches viewed barely grows, so upstream stays roughly flat.

Secondary benefits: hides the origin, lets us add an API key server-side, and
gives one place to add rate-limiting — the structural answer to the €340 lesson.

### Activation (one line, after a smoke test on a deploy preview)
Set in `netlify.toml` build env:
```
VITE_FORECAST_PROXY_BASE = "/api/forecast"
```
Then verify a deploy preview: forecasts still render, and
`/api/forecast/open-meteo/v1/forecast?...` returns 200 with an `age`/CDN-cache
header on the second hit. Roll back by removing the env var (client falls straight
back to calling Open-Meteo directly — no code change).

## Monitoring & alarms (built)

Automated, zero-cost, and living in the **one place that sees every real upstream
call** — the proxy function (`netlify/functions/forecast.mjs` +
`netlify/functions/lib/capacityAlarm.mjs`). CDN-cached hits never reach the
function, so its counter is the *exact* upstream-usage meter (no GA consent
undercount). It pushes to the **existing Telegram bot** (same creds as feedback):

- 🟠 **Amber** — first time daily calls cross **5,000** (`CAPACITY_AMBER`).
- 🔴 **Red** — first time daily calls cross **7,000** (`CAPACITY_RED`).
- 🚨 **Rate-limited** — Open-Meteo returns **HTTP 429** (the definitive wall-hit).

Each alarm fires **once per UTC day per level** (dedup flags in a Netlify Blobs
day-record). All metering is best-effort and fully guarded — it can never break or
slow a forecast. The pure threshold/dedup logic has unit tests (13, all passing).

**Important:** the alarm lives in the proxy, so it goes live **when the proxy is
activated** (`VITE_FORECAST_PROXY_BASE`). Until then, capacity is checked manually
from GA4 (property 518301405, event `open_meteo_fetch`).

### Verify the alarm on a deploy preview (no waiting for real traffic)
1. On a preview, set `VITE_FORECAST_PROXY_BASE="/api/forecast"` and `CAPACITY_AMBER=1`.
2. Ensure `FEEDBACK_TELEGRAM_BOT_TOKEN` / `FEEDBACK_TELEGRAM_CHAT_ID` are set.
3. Hit `/api/forecast/open-meteo/v1/forecast?latitude=36.9&longitude=25.1&current=wind_speed_10m&timezone=auto`
   twice (append a tiny lat change to force a fresh upstream call) → an 🟠 amber
   Telegram should arrive once.
4. Remove `CAPACITY_AMBER` override before promoting to production.

### Escalation
- **Red / repeated 429** → the proxy is already collapsing calls; if it persists,
  lengthen the client freshness TTL (fewer refreshes) or move to a keyed/commercial
  Open-Meteo plan.
- If the proxy's **function invocations** approach Netlify's free 125k/month, move
  the proxy to a Cloudflare Worker (100k/**day** free) — same seam, just repoint
  `VITE_FORECAST_PROXY_BASE`.
