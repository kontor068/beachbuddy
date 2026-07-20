# Dev / staging environment

A place to test changes **without touching production**. Production is, and stays,
the Netlify deploy of the `main` branch at **https://calmbeach.gr** — nothing here
changes that.

There are two isolated test surfaces:

## 1. Local dev (fastest loop)

```bash
npm run dev        # Vite dev server, hot reload, http://localhost:5173
```

Fully isolated by construction:
- Google Analytics is **off** (`import.meta.env.PROD` is false in dev).
- Nothing is deployed or indexed.
- Uses `.env.local` for keys.

Use this for almost all day-to-day work.

## 2. Deployed dev / staging (shareable URL, real Netlify build)

For when you need a real deploy — service worker, prerendered pages, the forecast
edge proxy, sharing a link, mobile testing.

**How:** push any branch that is **not** `main`. Netlify builds it as a *branch
deploy* and serves it at:

```
https://<branch-name>--<site>.netlify.app
```

We recommend one long-lived branch named **`dev`** as the stable staging URL:

```bash
git checkout dev            # the dev branch (created for this)
git merge main              # or cherry-pick the change you want to test
git push origin dev         # → https://dev--<site>.netlify.app
```

### What makes a branch deploy safe next to production

Every non-production build (branch deploy **and** deploy preview) is automatically
guarded — production is detected purely by Netlify's `CONTEXT === "production"`:

| Concern | Production (`main`) | Dev / staging (any other branch) |
|---|---|---|
| Google Analytics (GA4) | **on** | **off** — `VITE_APP_ENV` gate in `services/analyticsService.ts` |
| Search-engine indexing | indexable | **noindex** — `robots.txt` Disallow + `<meta noindex>` on every page |
| Visual marker | none | red **`STAGING · not production`** ribbon top-left |
| Forecast edge proxy | direct Open-Meteo | proxy enabled (smoke-test surface) |

The GA gate lives in [`services/analyticsService.ts`](../services/analyticsService.ts)
(`isProductionEnvironment()`), and the noindex/robots/ribbon stamping in
[`scripts/applyDeployContextGuards.mjs`](../scripts/applyDeployContextGuards.mjs),
which runs at the end of `npm run build`. The environment is wired per Netlify
context in [`netlify.toml`](../netlify.toml) via `VITE_APP_ENV`
(`production` / `staging` / `preview`).

### One-time Netlify setup

Branch deploys must be enabled once in the Netlify UI:

> **Site configuration → Build & deploy → Continuous deployment → Branches and
> deploy contexts** → set *Branch deploys* to **"All"** (or add `dev` to the
> allow-list).

Production deploys stay pinned to `main` — this only adds extra preview URLs, it
does not change what publishes to calmbeach.gr.

## Safety rules

- **Never `git push origin main`** to test something. `main` is production CD.
  (See the "verify push scope" memory — always `git log origin/main..HEAD` first.)
- Merge/PR into `main` only when a change is verified on dev and you intend to ship.
- A local `npm run build` is also treated as non-production (noindex), so a local
  `dist/` is safe even if accidentally served.
