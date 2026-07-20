# Architecture — the plan, the criteria, and where we are

> The goal is a **portable, evolvable** system at **zero running cost**. We get
> there not by adding tiers, but by adding **clean seams** to the static-first
> system we already have. This file is both the map and the lesson.

## 1. What kind of system this is (and why that's a strength)

CalmBeach is a **static-first PWA**. The heavy work (wind model, scoring,
ranking, geometry) runs **at build-time** in Node scripts; the browser gets
pre-baked JSON and serves it from a CDN. There is no live application server.

We chose this by scoring the **quality attributes** that actually matter here:

| Attribute | Weight | Why |
|---|---|---|
| Read performance | ★★★★★ | tourist on island 4G wants an answer *now* |
| Cost efficiency | ★★★★★ | solo operator, seasonal traffic, zero-ops |
| **Data reliability** | ★★★★★ | our core promise — a false "has a beach bar" breaks trust |
| SEO / crawlability | ★★★★★ | growth is organic search |
| Write scalability | ★☆☆☆☆ | data changes at build-time, not from users |

The profile screams *static-first / edge*, **not** microservices. A microservice
split would add network latency, distributed complexity and multiple databases
for **zero** benefit against this profile. The 1% move is to fit the
architecture to the forces — and here they point one clear way.

## 2. The rule that keeps it portable: **seams**

We don't try to build the perfect system today. We make the system **cheap to
change tomorrow** by isolating the boundaries the future is likely to hit. Four
seams matter:

| # | Seam | Status | Where |
|---|---|---|---|
| 1 | **Data-access** (read beaches behind an interface) | ✅ mature | `services/beachDataLoader.ts` |
| 2 | **Forecast provider** (wrap Open-Meteo behind an adapter) | ✅ **done** | `services/forecast/` |
| 3 | **Canonical schema** (one source of truth for "a beach") | ✅ **done** | `core/beachContract.mjs` |
| 4 | **Auth/user** (user data behind an interface, not Firebase-everywhere) | ⬜ later | — |

If those four are clean, we can swap hosting, database, or framework without a
rewrite. **"Cheap to change" beats "right the first time."**

## 3. Seam #3 — the canonical contract (shipped)

**The problem it fixes:** the shape of a beach was defined in *three* places
that could silently drift — `types.ts`, the loader's runtime guards, and the
build gate's hardcoded allow-lists. Three definitions = three chances to
disagree, and when they disagree bad data slips through. For a data-reliability
app that is the worst failure mode.

**The fix:** one dependency-free module, `core/beachContract.mjs`, that both the
browser bundle and the Node build scripts import. It owns:

- the canonical vocabularies (`BEACH_TYPES`, `ACCESSIBILITY`, `WIND_DIRECTIONS`,
  `WATER_DEPTH`, Greece coordinate bounds);
- `validateBeachRecord()` — full records (summary/raw): identity + location required;
- `validateBeachPatch()` — detail *patches* that merge onto a summary: only `id`
  required, but any present enum must still be canonical.

**The build gate** `scripts/checkBeachContract.mjs` runs it over every baked
record. Today: **2799 summary + 2799 detail records, 0 violations.**

```bash
npm run contract:check        # summary (full records)
npm run contract:check:full   # + detail (patches)
```

Wire `contract:check` into `build`/CI to block a deploy that would ship bad data.

### The lesson in one line
> Push the definition of truth into **one** place that every consumer imports.
> A schema that lives in three files isn't a schema — it's three opinions.

## 4. Evolution path (only when a real force appears)

We stay static-first until a **new force** justifies a new tier:

- **Filters/search get heavy** → bake data into **SQLite / DuckDB-WASM** (still a
  single portable file on the CDN; no server). Seam #1 already hides the source.
- **User-generated content appears** (reviews, accounts) → add a **thin
  serverless function + Postgres/PostGIS** (Supabase/Neon). Seam #4 keeps the app
  from caring which provider.
- **Multiple teams / independent scaling** → *then* split services. The seams
  make that a refactor, not a rewrite.

Never add a tier because it "sounds right." Add it when a force demands it.

## 5. Seam #2 — the forecast adapter (shipped)

**The problem it fixes:** Open-Meteo's hostnames were hardcoded in three places
inside safety-critical fetch code, coupling one vendor into `weatherService.ts`
and blocking a server-side proxy.

**The fix:** `services/forecast/` — a `ForecastProvider` interface + an
`openMeteoProvider` that owns the endpoint URLs, selected in one place
(`activeForecastProvider`). weatherService keeps all caching/freshness/parsing
(vendor-agnostic). The generated URLs are **byte-identical** to before, so the
change is pure indirection — verified, and `tsc` is clean.

**Edge-proxy switch (ready, zero code change):** set `VITE_FORECAST_PROXY_BASE`
and calls route through `${base}/open-meteo/…` — a future free edge function
maps that back to Open-Meteo, letting us cache and protect the origin
server-side. The seam is in place; the function is the opt-in next step.

### The lesson in one line
> Put the vendor behind an interface. The day you want to swap it, cache it, or
> proxy it, you change **one file** — not the code that everything depends on.

## 6. Capacity — how much traffic we hold (measured)

Full model: `reports/capacity/capacity-model.md`. In short:

- The CDN-served static site does **not** limit us. The ceiling is the
  **Open-Meteo free quota** (~10k/day, ~600/min), because forecasts are fetched
  client-side and cached per-device — N users viewing a beach = N calls.
- Peak today ≈ **1,311 measured calls/day** (~2,600 real, consent-adjusted) ≈
  **25% of the daily cap**. Soft headroom ≈ **4× average traffic**; a viral
  morning trips the per-minute cap first.
- **Fix, built (flag-off):** `netlify/functions/forecast.mjs` — a strict
  allow-list proxy that sets `Netlify-CDN-Cache-Control`, so the edge serves one
  cached forecast to all users per TTL. Upstream load then scales with
  **distinct beaches**, not users. Activate with
  `VITE_FORECAST_PROXY_BASE="/api/forecast"` after a deploy-preview smoke test.

## 7. Data engine — SQLite baked (built)

The canonical JSON now also bakes into a single portable **SQLite** file:

```bash
npm run build:sqlite        # public/data/beaches.sqlite (~1.7 MB, git-ignored artifact)
npm run db:query "SELECT region_id, COUNT(*) n FROM beaches GROUP BY 1 ORDER BY n DESC"
```

- `scripts/buildBeachSqlite.mjs` uses **Node 22's built-in `node:sqlite`** — no
  native build, no npm dependency, zero cost. Every row is validated against the
  canonical contract first (one more consumer of the single source of truth).
- 2,799 beaches with indexes on region/rating/geo and an **accent-insensitive
  FTS5** search (tonos-stripped, so "βαγιας" finds "Παραλία Βαγίας").
- Gives the same data a real query engine — filters, joins, geo range scans,
  full-text — while staying **one portable file** on the CDN/disk. It's the
  migration foundation: when filters/search outgrow looping JSON in JS, the
  data-access seam (`beachDataLoader`) can read this instead — no data re-model.

**SQLite vs DuckDB is not a fork** — one file, two engines. SQLite for point
lookups; **DuckDB** for analytics + native spatial, reading the very same file
(`scripts/duckdb-queries.sql`: `ATTACH 'beaches.sqlite'` + `ST_Distance_Sphere`).

**Postgres/PostGIS — deliberately NOT built now.** It needs a running server
(real cost + ops) and buys nothing while data changes at build-time and there's
no user-generated content. It becomes the right call the day accounts/reviews
land — and the data-access seam means adopting it is a swap, not a rewrite.

## Gates wired

`npm run contract:check` now runs as the **first step of `build`** — a dataset
that violates the canonical contract fails the build instead of shipping.

## Next brick

- **Activate the proxy** after a deploy-preview smoke test (flip the env var),
  and add an alarm when daily calls cross ~5k.
- Seam #4 (auth) only if/when login lands.
