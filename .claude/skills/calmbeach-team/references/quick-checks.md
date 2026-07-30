# Quick checks — how to look instead of guess

Recipes for verifying claims about CalmBeach. You're inside the repository, so most answers
are a grep away — and the code tells you what happens on *every* page, which fetching one URL
never can.

Order of preference: **read the source → check the built output → fetch the live URL → ask
him.** Each step down is weaker evidence than the one above it.

## In the code

Adapt the patterns to how the project is actually laid out — look at the tree first rather
than assuming a structure.

| Question | Where to look |
|---|---|
| hreflang / canonical / meta | grep for `hreflang`, `canonical`, `<link`, and wherever `<head>` is assembled (a Helmet-style component, an HTML template, or the prerender script) |
| structured data | grep `application/ld+json`, `schema.org`, `@type` |
| how pre-rendering happens | the Vite config, the build script in `package.json`, any prerender/SSG plugin |
| which weather provider, and where the key lives | grep `api_key`, `apiKey`, `VITE_`, `fetch(`, `import.meta.env`, plus `.env.example` |
| caching | grep `cache`, `stale`, `revalidate`, `maxAge`, and any Netlify headers/redirects file |
| the score / ray-casting | the scoring module and the precompute scripts (geopandas/shapely) |
| dataset shape and coverage | the beach data file(s) — count records and count non-empty values per field with a throwaway script rather than eyeballing |
| analytics and consent | grep `gtag`, `dataLayer`, `consent`, `cookie` |
| which languages exist per page type | the routing/i18n config, and the list of generated routes |

For anything countable — how many beaches have a photo, how many have `family: true`, how
many `/de/` routes exist — **write the three-line script and run it.** A real number ends an
argument that opinions would drag out for a week.

**Five of these already exist as repeatable npm scripts — run them instead of guessing or
writing a new throwaway.** `npm run quality:numbers` runs all five in sequence (the last four
need a fresh `dist/`, so `npm run build` first if it's stale):

| Command | What it produces |
|---|---|
| `npm run quality:data-coverage` | per-field fill-rate % across the whole beach dataset — `reports/data-quality/field-coverage.json` |
| `npm run quality:photo-coverage` | national photo coverage % + the highest-importance beaches still missing one — `reports/photo-coverage/importance-gaps.json` |
| `npm run quality:hreflang-build` | hreflang integrity across every built page: broken targets, broken/missing x-default, non-mutual pairs, incomplete sets — `reports/seo/hreflang-integrity.json` |
| `npm run quality:jsonld-coverage` | JSON-LD presence + breakdown by `@type` across every built page — `reports/seo/jsonld-coverage.json` |
| `npm run quality:orphan-pages` | sitemap URLs with zero incoming internal links — `reports/seo/orphan-pages.json` |

These are narrower than `seo:audit` (which spot-checks ~7 sample pages) — these five walk
*every* built page. `quality:photo-coverage` chains `auditBeachPhotoPresence.mjs` (per-beach
has-photo, mirrors `services/beachPhotos.ts`'s real lookup order — **check the by-id branch
if this script and the docs ever disagree again**, it was silently missing until 30/07/2026
and undercounted coverage by ~1,000 beaches) into `auditPhotoImportanceGaps.mjs` (joins that
against `popularityScore` and the touristic-tier region list).

## On the live site

| What | URL |
|---|---|
| Homepage (EN) | `https://calmbeach.gr` |
| Beach page (EN) | `https://calmbeach.gr/beaches/kythira/148-steno-avlaki/` |
| Beach page (EL) | `https://calmbeach.gr/el/beaches/kythira/117-platia-ammos/` |
| Beach page (DE) | `https://calmbeach.gr/de/beaches/rethymno/691-paralia-gialopotama/` |
| Category page | `https://calmbeach.gr/el/family-beaches/pieria/` |
| robots / sitemap | `/robots.txt` · `/sitemap.xml` (served compressed, often unreadable) |
| Privacy / Terms | `/privacy` · `/terms` |

Fetching converts pages to markdown and can drop `<link>` and `<script>` tags — so hreflang,
canonical, analytics and JSON-LD may be present and invisible. **If a fetch shows no link
tags at all, that's your tool, not the site.** Say 🟡 and check the source instead. Declaring
something missing on that basis has already produced one wrong verdict.

Don't route around it with curl, proxies or third-party source viewers — they're blocked and
they waste minutes. The source tree is right there and it's better evidence anyway.

## Traps specific to this project

**Not every beach exists in every language.** `/de/` has beach pages in some regions but many
German URLs 404 — including the German homepage. This matters because a blanket hreflang set
across all pages will point at URLs that don't exist, and **Google discards an entire hreflang
set when one entry is broken** — so the correct EN–EL link dies with it. Whenever hreflang
comes up: verify a few alternates actually resolve, and check whether the code emits them per
page or globally.

**`og:image` is not a beach photo.** Beach pages carry a shared regional background image in
Open Graph metadata. Seeing an image reference does not mean the page shows a photo of that
beach — check what's rendered in the body.

**Live weather loads client-side.** It won't appear in a fetch of the static HTML. Never
report it as missing on that basis; look at the component that requests it, or ask him what
he sees.

**Beach counts drift.** ~2.500 is the figure in the docs; the dataset is the authority. Count
it rather than quoting the doc when a number matters.

## After checking

Say what you did, in a few words — *«κοίταξα το component που φτιάχνει το head»* — so he
knows the claim came from the code and not from a document. Then update the relevant doc in
`docs/team/` with the finding and the date, so the next specialist starts from truth.
