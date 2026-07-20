# Forecast proxy — activation runbook

Turn the edge-cached forecast proxy on **safely**: prove it on a deploy preview,
then flip production. Rollback is one line. Context: `capacity-model.md`.

## What's already prepared (in this branch)

- ✅ Proxy function + strict allow-list — `netlify/functions/forecast.mjs`
- ✅ Capacity alarm (amber 5k / red 7k / 429) via Telegram — same function
- ✅ Redirect `/api/forecast/*` → function — `netlify.toml`
- ✅ Service worker treats `/api/forecast/*` as network-only (no stale forecasts)
- ✅ **Proxy auto-enabled on deploy previews & branch deploys** (via
  `[context.deploy-preview.environment]` in `netlify.toml`) — production untouched
- ✅ Smoke test — `scripts/smokeTestForecastProxy.mjs`

So: **any PR / branch deploy already builds with the proxy ON.** Production stays on
the direct Open-Meteo path until Step 3.

## Step 1 — Get a preview

Push this branch and open a PR (or trigger a branch deploy). Netlify builds a
preview at `https://deploy-preview-<n>--<site>.netlify.app`. Because of the context
env, that preview routes forecasts through `/api/forecast/*`.

## Step 2 — Smoke test the preview

```bash
node scripts/smokeTestForecastProxy.mjs https://deploy-preview-<n>--<site>.netlify.app
```
Expect: forecast + marine 200 with real JSON, a CDN cache signal on repeat, and all
four malicious requests rejected (400). Also open the preview in a browser and
confirm beach conditions render normally (colours, verdicts, wave card).

Optional — verify the alarm end to end: in the preview's env set `CAPACITY_AMBER=1`
and make sure `FEEDBACK_TELEGRAM_BOT_TOKEN` / `FEEDBACK_TELEGRAM_CHAT_ID` are set;
hit two slightly different coordinates → one 🟠 Telegram should arrive. Remove the
override afterwards.

## Step 3 — Go live in production

Only after Step 2 is green. Add the proxy to the production context in `netlify.toml`:

```toml
[context.production.environment]
  VITE_FORECAST_PROXY_BASE = "/api/forecast"
```

Commit + deploy to `main`. Watch: forecasts render on the live site, Netlify
function logs show `forecast` invocations, and the Open-Meteo call rate (GA4
`open_meteo_fetch`) should FLATTEN as the CDN starts absorbing repeats.

## Rollback (instant, no code change)

Remove the `VITE_FORECAST_PROXY_BASE` line and redeploy. The client's
`ForecastProvider` falls straight back to calling Open-Meteo directly — the proxy
becomes dormant, nothing else changes.

## After go-live — what to watch

- **Function invocations** (Netlify dashboard): should be far below client call
  volume (CDN absorbs repeats). If they trend toward the free 125k/month, move the
  proxy to a Cloudflare Worker (100k/day free) — same seam, repoint the env var.
- **Telegram alarms**: 🟠 at 5k/day is informational; 🔴/🚨 means act (lengthen the
  client freshness TTL or move to a keyed Open-Meteo plan).
- **GA4 `open_meteo_fetch`**: the per-user metric stays; the *upstream* rate (function
  logs) is now the real quota meter.
