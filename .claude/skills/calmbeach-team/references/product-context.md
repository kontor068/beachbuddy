# CalmBeach — background snapshot

Background so a specialist doesn't have to ask basics. The project docs
(`docs/team/00-STATUS-BOARD.md` and the role docs) are authoritative and more current —
when they disagree with this file, believe them. **The code beats both.**

*Snapshot date: 28 July 2026 — every number below was counted in the repository on that day.*

## The product

Free B2C site, live at **calmbeach.gr**. It answers one question: *which Greek beach should
I go to today?* Live wind and wave conditions are combined with each beach's orientation to
say how sheltered it will be right now.

- **2.850 beaches shipped** (2.903 in the canonical file) across **110 regions/islands**
- **5 languages**: English and Greek nationally; **German, French and Italian for 17
  tourist regions only** (`LOCALIZED_REGIONS`) — this is deliberate, not half-done
- **9.474 pre-rendered pages**: beach pages, region pages, **963 island-intent guides**,
  landing pages, a guides hub, legal pages
- URL shapes: `/beaches/{region}/{id}-{slug}/`, `/el/family-beaches/{region}/`,
  `/el/organized-beaches/{region}/`, `/el/beaches/{island}/`
- Photos on **1.429 beaches (50%)**, curated bilingual editorial text on **788**
- No accounts, no login, no revenue yet

**The differentiator** is the wind-exposure model: a geometric ray-casting algorithm that
computes how exposed each beach is from each direction. It is validated **nationally** —
128 hand-authored ground-truth cases across 102 regions, 127 passing — not just on one
island. Exposure profiles are precomputed in TypeScript (`utils/geospatialExposureModel.ts`);
**there is no Python anywhere in the pipeline.** Competitors list beaches; CalmBeach tells
you whether today is the right day for that beach.

## The stack

React 19 + Vite 6 + TypeScript + Tailwind v4, Leaflet for maps, pre-rendered by a custom
build script (`scripts/prerenderBeachPages.mjs`), hosted on Netlify, DNS on Cloudflare.
No state-management library — `App.tsx` holds it. No database and no server: four Netlify
functions (forecast proxy, visitor counter, traffic stats, feedback→Telegram).

Weather comes from **Open-Meteo, with no API key**, and since 27/07/2026 every call goes
through our own edge proxy, so the browser never talks to the provider directly. Forecasts
are cached 60 minutes and **hard-blocked after 3 hours** — the site shows "conditions
unavailable" rather than stale numbers.

Pages are pre-rendered, so Google sees real text. Live weather numbers load client-side
behind a skeleton, so the static page shows beach facts and the live conditions arrive after.

Quality is enforced by **12 automated checks** (`npm run quality:critical`) running in CI on
every pull request.

## The person

Solo founder, day job, mostly on mobile, limited hours, hands-on with code. Also runs a
small rental business on Milos that cross-promotes the site. Operating entity: MARIS AND CO
Ο.Ε.

## History worth knowing

- Milos is **"info-only"** since 11/07/2026: its 42 beaches are browsable and crawlable, but
  the interactive map and today's recommendations are withheld (`utils/infoOnlyRegions.ts`).
  Do not describe Milos as removed — it is present and deliberately limited.
- Google compliance is treated as non-negotiable — the site does not chase grey-hat SEO.
- Expansion beyond Greece is deliberately parked until Greece proves out.

> Commercial history, partnership positioning and the legal background are **not in this
> repository** — it is public. They live in `docs/team/13-monetization-business.md` and
> `docs/team/14-legal-privacy-compliance.md`, which are gitignored for that reason. Read them
> from disk before advising on anything commercial or legal; do not reconstruct them here.

## Claims that were wrong before, and are still worth guarding against

The first version of the team docs was written **without reading the repository**, and six of
its headline findings were false. If you find yourself about to repeat one of these, look
first:

| Sounds true | Actually |
|---|---|
| "There are no beach photos" | 1.429 beaches have one (`data/beachPhotosById.generated.json`) |
| "There is no testing process" | 12 checks, in CI, on every PR |
| "There is no structured data" | JSON-LD on 9.465 of 9.474 pages |
| "hreflang points at German 404s" | hreflang is correctly gated per region by design |
| "The Milos section was removed" | Restored as info-only on 11/07/2026 |
| "The source PDF's licence is unknown" | There is no PDF — the data is OSM-derived, so the real question is **ODbL** |
| "There is no way to report a problem" | Three live feedback paths, delivering to Telegram |

## Real gaps as of 28 July 2026

Photos do not appear in the pre-rendered HTML of beach pages (only after React loads), and
photo credits are missing from the React UI although the licences are stored — that one is a
licence obligation, not a nicety. The safety disclaimer and every legal link are absent from
all 8.208 beach pages, because the footer never mounts there. Attribution for the
OSM-derived dataset needs stating. There is no error tracking and no uptime monitoring, so
user-facing crashes are invisible.

The full picture — including the infrastructure and quota items, which are not for a public
repo — is in `docs/team/00-STATUS-BOARD.md` on disk. **Read it before advising.** It is
gitignored, so it is not visible from the repository alone.
