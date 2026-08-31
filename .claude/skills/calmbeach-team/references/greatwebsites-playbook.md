# The greatwebsites.gr Playbook — mapped onto CalmBeach

## What this file is

This is a working reference distilled from the free Greek e-book **"Σπουδαία Websites!"** by **Giorgos Katsiampas** (Head of Engineering Growth & SEO at Skroutz.gr), published at **https://greatwebsites.gr/**. Full credit to the author; the book is his work and is worth reading in the original.

Everything below is a **summary in our own words** of his advice, reorganised by which CalmBeach specialist it speaks to, and then checked against what CalmBeach actually does today. Short quoted phrases appear only where the exact wording carries the point, always attributed to a chapter.

**Rule for specialists using this file:** if you lean on advice from here, **say so** — name the chapter (e.g. "per the greatwebsites.gr chapter on UX"). Do not present this as settled fact.

**Rule on authority:** this book is **one experienced practitioner's view**. He is a credible one — SEO and engineering growth at the biggest Greek e-commerce site — so his opinions are informed and should be weighted seriously. But it is **not Google documentation**. Where it touches on Google policy (crawling, indexing, penalties, link schemes, ranking factors), `google-official-docs.md` wins. Some numbers in the book are dated (WordPress share is quoted as both 34% and 43% in different chapters; the CTR and market-share figures are from 2019–2021). Treat the numbers as order-of-magnitude, not current.

**Where anything below is our own connecting observation rather than the book's advice, it is marked `[our note]`.**

## ⚠️ Re-checked against the code on 30/08/2026 — read this before quoting a gap

The book half of this file (every "What the book tells this role") is unchanged and still
accurate. **The CalmBeach half went stale in one month and was wrong in eight places.** It was
written on 30/07/2026 partly from the project docs rather than from the repository, which is
exactly the failure `CLAUDE.md` warns about, and the month that followed closed most of what it
listed as missing.

What the 30/07 version said was missing and **is not**:

| The old claim | What is actually there (verified 30/08/2026) |
|---|---|
| "Search Console appears to be absent" — the file's own #1 | Verified (`index.html:13`), `sc-domain:calmbeach.gr`, service-account API pull in `scripts/seo-snapshot.mjs`, snapshots in `reports/snapshots/` through 21/08 |
| "No CTR-vs-position work" | It is an automated report: CTR curve by position, index per intent, striking distance, page-level CTR gaps — `reports/snapshots/2026-08-21.md` |
| "No feedback channel of any kind" | Three, all live to Telegram: landing form (`OurStorySection.tsx:141`), per-beach forecast verdict (`BeachDetailPage.tsx`), 1–10 rating prompt from day 5 (`AppRatingPrompt.tsx`) |
| "No conversion event exists at all" | `navigation_clicked` is the declared GA4 conversion, and a delegated capture listener (`App.tsx:5841-5861`) measures **every** outbound link — mirrored first-party so it survives consent decline |
| "No prominent contact route" | Footer contact column, two addresses (`LegalFooter.tsx:188`); phone and postal address in `/terms` |
| "No informational content layer" | 381 island-intent guides, a guides hub, `/faq/`, `/how-we-measure-wind-shelter/`, per-beach editorial for 110 regions |
| "No pillar pages, no deliberate internal-link clusters" | 8 topic verticals × island + hub + 13 national landings; `reports/seo/orphan-pages.json` → **0 orphans of 9.507** |
| "Titles and metas … unless deliberately varied they will be near-duplicates" | Generated under hard caps (58/60 title, 155 meta) with a numeric distinctness gate — `scripts/validateBeachMetaDescriptions.mjs`, no snippet body on more than 7% of pages |

Two more the file never mentioned because they did not exist yet: **error tracking** is live
(`services/errorReporter.ts` → `netlify/functions/client-error.mjs` → Telegram) and the
**Open-Meteo quota** has amber/red alarms (`netlify/functions/lib/capacityAlarm.mjs`).

The rule this file broke, and the one to keep: **grep before writing a gap into this file, and
put the file path next to it.** A gap with no path is 🟡, not a finding.

## Chapter index (all 14 URLs retrieved successfully, 2026-07-30)

| # | Chapter | URL |
|---|---|---|
| 1 | Εισαγωγή | https://greatwebsites.gr/abstract |
| 2 | Η προετοιμασία | https://greatwebsites.gr/before-start |
| 3 | Ξεκινώντας το ταξίδι | https://greatwebsites.gr/starting-the-journey |
| 4 | Το website | https://greatwebsites.gr/website |
| 5 | Search engines | https://greatwebsites.gr/search-engines |
| 6 | On page optimisation | https://greatwebsites.gr/optimize-onsite |
| 7 | User experience | https://greatwebsites.gr/optimize-ux |
| 8 | Ταχύτητα | https://greatwebsites.gr/optimize-speed |
| 9 | Backlinks | https://greatwebsites.gr/optimize-backlinks |
| 10 | Πρόθεση επισκεπτών | https://greatwebsites.gr/optimize-intention |
| 11 | Χρησιμοποίησε άλλες πλατφόρμες | https://greatwebsites.gr/optimize-use-other-platforms |
| 12 | Κόστος | https://greatwebsites.gr/cost |
| 13 | Επίλογος | https://greatwebsites.gr/closing |
| — | Σχετικά με το e-book | https://greatwebsites.gr/pages/about/ |

Bullets are tagged `(ch. N · /path)` so the source URL of every item is recoverable from the table above.

The book's whole framing, stated on the homepage and in the closing chapter, is the underdog case: a small site beats the giants not by fighting them head-on but by being local, specific and agile in ways a giant cannot be (ch. 1 · /abstract; ch. 13 · /closing). That framing is the reason this book is relevant to CalmBeach at all.

---

## 01 · Product

**What the book tells this role**
- Every site — and every individual page — must have a defined goal and a defined "next step" for the visitor: buy, book, sign up, watch, subscribe. A page with no next step is a page with no purpose (ch. 1 · /abstract; ch. 3 · /starting-the-journey).
- Pick **one** primary objective and hold it. His examples: Google focused on search, Amazon and Skroutz on e-commerce, YouTube on video. Secondary presences are fine, multiple competing primary goals are not, because a solo operator cannot resource them (ch. 3 · /starting-the-journey).
- Define the success metric **before** launch, and make it a business metric, not a ranking. Concrete targets like "100 bookings a month" or "cut third-party bookings by half" (ch. 2 · /before-start). Metric depends on site type: e-commerce → new customers; blog → subscribers; community site → awareness and participation; content site → ad and sponsorship revenue (ch. 1 · /abstract).
- **Traffic without conversion is wasted resources.** He treats ~1% conversion (1 in 100 visitors) as a working benchmark (ch. 2 · /before-start).
- Do not chase rank #1 as the goal. He calls it "increasingly utopian" given zero-click results, and notes rank #1 with the wrong intent produces no business at all — his own site ranked #1 for "Αράχωβα" and it did nothing for his accommodation business (ch. 1 · /abstract; ch. 2 · /before-start).
- Research your personas properly — motivations, needs, demographics, devices. He calls that knowledge potentially "worth gold" (ch. 3 · /starting-the-journey).
- **Retention is cheaper than acquisition** over the long run (ch. 3 · /starting-the-journey).
- State your differentiator explicitly on the site: why choose you over the alternatives, in plain text, bullets, testimonials or video (ch. 4 · /website).
- **Start simple, ship, then scale on evidence.** Don't delay launch hunting for the perfect solution; use the early phase to learn what content management, user behaviour and functionality actually demand (ch. 4 · /website; ch. 12 · /cost).
- The small operator's structural advantages over giants: hyper-local detail they can't gather, personal contact they can't offer, and speed of change they can't match (ch. 13 · /closing).

**Where CalmBeach already does this**
- The single primary objective is unambiguous: answer "which beach today?" That is exactly the focus discipline of ch. 3.
- The differentiator is real and specific — a ray-casting wind-exposure model that tells you how sheltered a beach is *right now*. That is precisely the "local, small-scale information the giants can't provide" argument of ch. 13, and it is defensible against beachesofgreece.com (~345 beaches vs CalmBeach's ~2.870).
- ~2.870 beaches with per-beach data is the hyper-local depth the book says is the underdog's weapon.
- Shipping before perfection: ~9.500 pages live, DE/FR/IT deliberately scoped to 17 tourist regions, photos on 1.367 of 2.872 beaches. That is ch. 12's "start simply" in practice rather than in theory.

**Where CalmBeach does not**
*Re-checked 30/08/2026 — three of the five bullets here were wrong.*
- **There is still no success metric expressed as a target.** But the raw material now exists and the 30/07 version of this bullet ("no conversion event") was false: `navigation_clicked` is the declared GA4 conversion, every outbound link is measured (`App.tsx:5841-5861`), and Search Console gives clicks, impressions and position. What is missing is the sentence "success this season means X" — a number someone commits to, not the instrumentation for it (ch. 2).
- ~~No defined "next step" per page~~ — **wrong.** The beach page's next step is directions, and it is measured from three surfaces (`BeachDetailPage.tsx:1152`, `BeachCard.tsx:1643`, `BeachMap.tsx:4053`). The landing's is the region tile, named as such in `LandingHero.tsx:154`.
- ~~The differentiator is not stated as a value proposition~~ — **closed 30/08/2026.** The hero subtitle now names today's wind and the direction each shore faces, in five languages (`landingCopy.ts`).
- No persona work. Assumptions about tourists are implicit; the demographic/device data GA already collects has not been turned into decisions (ch. 3). **Still open** — though Search Console now answers part of it for free: 88,7% of clicks are mobile, Greece is 85% of them.
- Retention: **partly closed.** A newsletter exists (`components/landing/NewsletterSection.tsx` → `netlify/functions/newsletter-subscribe.mjs`), so does a PWA install prompt (`components/InstallPrompt.tsx`) and an Android shell. What is missing is a *reason* to come back tomorrow — nothing tells a visitor still on the island that today's answer changed (ch. 3).

---

## 02 · UX/UI

**What the book tells this role**
- He states flatly that UX is **"the most important element for website success"** (ch. 7 · /optimize-ux).
- Steve Krug, adopted as the chapter's spine: **"Don't make me think."** Every click's consequence should be obvious without deliberation. And the writing rule — cut half the words, then cut half of what's left (ch. 7 · /optimize-ux).
- **Time budgets:** a visitor must grasp what the site is for in **2–3 seconds**; average visit is **15–20 seconds** (ch. 4 · /website); users spend about **8 seconds** deciding whether a page meets their need before abandoning (ch. 7 · /optimize-ux).
- **Navigation:** 5–7 links maximum in the primary nav (that's what people retain); most important links first or last (primacy/recency); no internal page more than **three clicks** from the homepage; horizontal header nav as the standard, not a sidebar; footer for secondary links (terms, contact); breadcrumbs for orientation; a visible indicator of the current page; consistent nav on every page (ch. 7 · /optimize-ux).
- Avoid dropdowns except for genuinely necessary subcategories — he reports users find mega-menus frustrating (ch. 7 · /optimize-ux).
- Label links **concretely**. Generic labels like "Services" or "Videos" fail. Keep CTA buttons visually distinct from navigation (ch. 7 · /optimize-ux).
- **Mobile:** minimum **16px** font, adequate spacing between tappable elements, hamburger for nav (ch. 7 · /optimize-ux). If your analytics say 80% mobile, building mobile-first is "self-evident" (ch. 3 · /starting-the-journey).
- Contrast: he cites **7:1** for link legibility (ch. 7 · /optimize-ux). `[our note: 7:1 is WCAG AAA for body text; AA is 4.5:1. He is recommending above the legal floor.]`
- **The paradox of choice is a conversion problem.** His jam-study numbers: 24 options → 3% purchase; 6 options → 30%. Fewer options convert better (ch. 7 · /optimize-ux).
- Put the persuading elements **above the fold** — they have to earn the scroll (ch. 7 · /optimize-ux). Lead with the value proposition and the important information; details after (ch. 13 · /closing).
- Attention devices that work: motion in peripheral vision, human faces looking at the viewer, bright colour, large imagery, novel graphics, before/after comparisons, video (audio and music carry emotion), and stories over bare facts (ch. 7 · /optimize-ux).
- Decide the information hierarchy **before** the design, on a sitemap or even a spreadsheet (ch. 7 · /optimize-ux; ch. 1 · /abstract).
- Never clickbait; never jargon from your own industry (ch. 7 · /optimize-ux).
- Make contact information prominent — in the footer *and* on a dedicated contact page with map/address, email, phone, a form, ideally live chat. He treats hard-to-find contact details as directly lost customers (ch. 4 · /website).
- Logo top-left linking home, with a tagline under it stating the mission (ch. 4 · /website).
- Every interaction needs clear feedback and instructions (ch. 4 · /website).
- His own positive examples are Google's homepage, arahova-pansion.gr (every page within two clicks) and Skroutz; his negative example is a site with inconsistent fonts, too many colours and opaque menu labels (ch. 7 · /optimize-ux).

**Where CalmBeach already does this**
- The core promise — top beaches for today, fast — is aligned with the 8-second and 2–3-second budgets by design; "under 10 seconds to a recommendation" is the product's own stated UX target.
- Top 3 recommendations rather than a wall of ~2.870 options is exactly ch. 7's paradox-of-choice advice, applied without knowing it. `[our note: this is the single strongest UX decision already in the product and it should not be diluted by adding more headline options.]`
- Pre-rendered pages mean content is visible immediately, which serves the above-the-fold requirement.
- Mobile is the assumed primary context for a tourist on a beach day.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- ~~The value proposition is not above the fold~~ — **closed 30/08/2026.** The hero subtitle names the mechanism in five languages. The title and the deliberate absence of a kicker were left alone.
- ~~Seven filters~~ — **miscounted.** The explore panel shows **five** and hides the other seven behind an "Άλλα" button (`PreferenceFilters.tsx:39`); five is inside the range the book itself calls good. The 20-filter sheet (`AmenityFilter.tsx:174`) opens only on request.
- **Three-click rule: untested, and now testable.** `reports/seo/orphan-pages.json` proves every page is reachable (0 orphans of 9.507), which is not the same question. Nobody has watched a tourist try (ch. 7).
- ~~No prominent contact route and no live feedback channel~~ — **wrong then, and further closed now.** Three feedback paths were already live to Telegram on 30/07. Since 30/08 there is also a "Κάτι δεν πάει καλά εδώ;" link in the footer of every page type including the ~9.500 prerendered ones, and one on the beach page carrying the beach id.
- **Breadcrumbs: were emitted and invisible.** `index.tsx:122` mounts with `createRoot`, so React wiped the prerendered `<nav aria-label="breadcrumb">` — it existed for Google and for nobody else. Rebuilt in React 30/08/2026. Contrast at 7:1 and tap spacing: **still unaudited.**
- **Type size: partly fixed.** The card and the beach page carried ~635 declarations below 16px against ~24 at or above, and `text-xs sm:text-sm` appeared zero times. Body prose on the beach page is now 16px and the wrapping card badges 12px (was 10px); the rest of the app is untouched (ch. 7).
- No user testing of navigation with real people, which he asks for explicitly (ch. 7). **Still open, and still the cheapest thing nobody has done.**

---

## 03 · Frontend

**What the book tells this role**
- Speed is a revenue variable, and he supports it with a wall of case numbers: Mobify **−100ms → +1.11%** conversion; AutoAnything halved load time → **+12–13%** sales; Walmart **−1s → +2%** conversions; Amazon (2006) **+100ms → −1%** sales; Google **+0.5s in results → −20%** traffic; Akamai (2017) **+100ms → −7%** conversions; eBay (2019) **−100ms → +0.5%** add-to-cart; BBC **lost 10% of users per extra second** (ch. 8 · /optimize-speed).
- His summary: **"every hundredth of a second matters"** (ch. 8 · /optimize-speed).
- **Core Web Vitals targets:** LCP ≤ **2.5s**, FID ≤ **100ms**, CLS ≤ **0.1**, measured at the **75th percentile**, mobile and desktop separately (ch. 8 · /optimize-speed).
- Page weight is the main lever he names: large JavaScript bundles, video, heavy CSS, high-resolution images (ch. 8 · /optimize-speed).
- Network quality and server distance are partly outside your control, but compression and a CDN are your countermeasures (ch. 8 · /optimize-speed).
- Tools he sends you to: PageSpeed Insights (pagespeed.web.dev), the CrUX dashboard (g.co/chromeuxdash), Core Web Vitals in Search Console, and the web.dev optimisation guides for each metric (ch. 8 · /optimize-speed).
- Google incorporates Core Web Vitals into ranking; loading speed, stability and response time also shape the visitor's opinion and their likelihood of recommending you (ch. 1 · /abstract).
- Correct heading hierarchy is a build responsibility, not just an SEO one: one h1, h2/h3 for sections, no skipped levels, verified with an outliner tool (ch. 6 · /optimize-onsite).
- Mobile floor: 16px type, spaced touch targets (ch. 7 · /optimize-ux).

**Where CalmBeach already does this**
- Pre-rendering ~9.500 pages plus Netlify's CDN is close to the best-case architecture for LCP on content pages — better than the WordPress-on-a-Greek-server setup the book actually recommends (ch. 4, ch. 8).
- Vite gives modern bundling and code-splitting by default, addressing his page-weight point.
- Cloudflare DNS + Netlify edge removes the server-distance problem he raises for German and other non-Greek visitors.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- ~~CWV are not measured~~ — **closed 30/08/2026.** `utils/webVitals.ts` reports LCP, INP and CLS from real visitors, dynamically imported after `load` (2,4 KB gzip, its own chunk). Read as p75 by device. Caveat written into the file: it reports through `trackEvent`, so it is a consenting-visitors sample, not the whole population.
- **Photos: the discipline existed on one side only.** The prerenderer varied the width and shipped a real `srcset`; the React app shipped `sizes` with **no** `srcSet`, which a browser ignores entirely — every card and every hero pulled the same `width=800` file. Fixed 30/08/2026 via the shared `utils/photoSizing.mjs`, plus 400px thumbnails and `preconnect` to both Wikimedia hosts. And the prerendered hero — which follows the h1 directly, so it *is* the LCP element — was `loading="lazy"`; it now carries `fetchpriority="high"`.
- **Page weight now has a gate.** `scripts/auditBundlePerformance.mjs` existed since 13/08 but nothing ran it; it is check `bundle-budget` in `quality:critical` since 30/08, green with headroom (415,7 KB gzip initial against a 600 KB cap).
- Map view is a heavy interactive component with layout-shift potential; **not audited** — though it is lazy (`React.lazy`, `App.tsx:156`) and every `<img>` in app code carries width/height (ch. 8).
- **Heading hierarchy: verified for region pages only.** `scripts/auditRegionPages.mjs` enforces exactly one h1 there; the 8.534 beach URLs have no equivalent gate, and no script anywhere checks for skipped levels (ch. 6).

---

## 05 · Data Engineer (beach dataset)

**What the book tells this role**
- Content must be **"well-written, current, and accurate"** — he lists accuracy alongside quality, not below it (ch. 4 · /website).
- **Original data and unique statistics are one of the four content types that earn links**, together with visuals/infographics, numbered lists, and in-depth guides. BuzzSumo's finding that he cites: list pages earned more backlinks than quizzes, videos or charts (ch. 9 · /optimize-backlinks).
- Organise information into **"logical units"** before anything else, so a first-time visitor can find things intuitively — and so crawlers can too (ch. 4 · /website; ch. 1 · /abstract).
- Depth of specialist local knowledge is what lets a small site outrank Booking and TripAdvisor in a local category — a giant cannot replicate it (ch. 2 · /before-start; ch. 13 · /closing).
- Structure URLs hierarchically by topic and avoid parameters like `?page=2`; never change a URL without a 301 (ch. 6 · /optimize-onsite). `[our note: this is a data/routing decision as much as an SEO one, because the slug comes out of the dataset.]`

**Where CalmBeach already does this**
- ~2.870 OpenStreetMap-derived beaches is exactly the "original dataset the giants don't have at this granularity" asset of ch. 9.
- The wind-exposure model produces genuinely original derived data per beach.
- The dataset drives a consistent page structure across ~9.500 pages, which is the "logical units" principle applied at scale.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- ~~No confidence score, no per-field provenance, no correction pipeline~~ — **wrong on all three.** Every one of the 2.926 records carries `metadata.confidence` (high 2.303 / medium 140 / low 483), `sourceNotes`, and `sourceUrls` on all but 24; `orientation`, `popularity`, `googleMapsNavigation` and `showerEvidence` each carry their own source and check date; 188 records are explicitly flagged `needsVerification` and 334 say `access: unknown` rather than guessing. The correction pipeline is ~40 `audit*.mjs` plus ~30 `apply*.mjs` scripts and ~200 dated region reports. **What is genuinely thin:** `amenities`, `access` and `terrain` — the OSM core — share one record-level confidence with no per-claim source, and the app files served to the browser strip almost all provenance.
- The original data is **still not published as data** — no downloadable dataset. `/how-we-measure-wind-shelter/` now covers the methodology half. The link-earning asset of ch. 9 remains unused.
- **1.505 beaches have no photo** (52,4%, `reports/photo-coverage/beach-photo-presence-summary.txt`, 17/08) — the correct number, higher than the 1.421 quoted in July.
- **URL stability: IDs are frozen forever** (`scripts/freezeBeachIds.mjs`, approved 12/06), so a renamed beach keeps its address prefix. The slug is still recomputed from the English name on every build, with an opt-in `legacySlugs` array producing the 301 — which works only if someone remembers to add the old slug. `scripts/auditIndexedUrlsResolve.mjs` is the net under that, and it exists because the gap bit on 21/08.

---

## 08 · DevOps & Infrastructure (incl. thin backend, keys, caching, costs)

**What the book tells this role**
- **Own your platform.** "The wisest choice for something more professional is to have no dependence on third parties" (ch. 1 · /abstract). Owned vs non-owned presence is a "fundamental" distinction: on someone else's platform your content can vanish with the platform (ch. 3 · /starting-the-journey).
- His cautionary cases: Google+ (2011–2019) and GeoCities (shut October 2009) — everyone's invested effort gone, with data export as a stopgap only (ch. 3 · /starting-the-journey; ch. 11 · /optimize-use-other-platforms).
- Terms-of-service changes can end your presence without notice; platform algorithms decide who sees your content (ch. 11 · /optimize-use-other-platforms).
- Serve from close to your users, or use a CDN; compress assets (ch. 8 · /optimize-speed).
- Host Greek small/medium sites on a Greek server for best performance (ch. 4 · /website).
- Owned sites cost server maintenance and developer time; third-party platforms are often free but monetise your content and traffic instead (ch. 3 · /starting-the-journey).
- Standard platforms cover most small/medium needs; genuinely complex or large-scale applications eventually require custom development (ch. 3 · /starting-the-journey).
- Domain and DNS verification for Search Console is a one-off setup task — file upload, HTML tag or DNS (ch. 5 · /search-engines).
- Practical cost bands: hosting **€10–20/month**, domain **€10–15/year** for .gr, annual maintenance **€150–200/year** (ch. 12 · /cost).

**Where CalmBeach already does this**
- calmbeach.gr is a fully owned property on an owned domain — no Facebook-page-as-website dependency, which is the book's central infrastructure warning (ch. 1, ch. 3, ch. 11).
- Netlify's CDN plus Cloudflare DNS satisfies his edge/latency advice better than his own Greek-server recommendation, at lower cost.
- Static pre-rendering means the site survives backend or API failure — stronger than the WordPress+MySQL stack the book assumes.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- **The book's own logic cuts against parts of the stack**: Netlify + Cloudflare + Google Analytics + weather APIs are all third parties whose terms can change (ch. 3, ch. 11). Low probability, but there is no documented exit path from Netlify. **Unchanged.**
- ~~No quota alerting for the weather API~~ — **wrong.** Amber at 18k and red at 25k calls a day, once each per day to Telegram, plus a separate 429 alarm, metered per weighted upstream call and unit-tested by a blocking gate (`netlify/functions/lib/capacityAlarm.mjs`). Caching is layered: 1 h for weather, 3 h for marine, 12 h for SST, a shared durable CDN cache, a 12 h last-known-good fallback and a 60-per-minute per-IP limit. **Function invocations still have no ceiling** — that half of the bullet stands.
- ~~`/api/traffic` has no rate-limit story~~ — **wrong.** The write side (`pageview.mjs`) is cookieless, same-origin, POST-only and per-IP burst limited, all three enforced by the `analytics-guards` gate; the read side is key-gated. Retention and backup: still unstated.
- **Not in the July version, and worth recording:** error and CSP reporting now exist end to end (`services/errorReporter.ts` → `netlify/functions/client-error.mjs` → Telegram, rate-limited), there is a deep health endpoint for an uptime monitor (`health.mjs`), and a scheduled weekly quality digest (`quality-digest.mjs`, Mondays 06:00).

---

## 09 · QA & Testing

**What the book tells this role**
- **Check links for broken URLs regularly** (ch. 7 · /optimize-ux). Broken links are also a competitor-side opportunity — he tells you to hunt other sites' dead links, which means yours are equally findable (ch. 9 · /optimize-backlinks).
- **Test the navigation from the user's point of view, and get feedback from actual users** (ch. 7 · /optimize-ux).
- Verify the document outline / heading structure with a tool — he names the Web Developer plugin and HTML5 Outliner (ch. 6 · /optimize-onsite).
- Test each page's speed individually with PageSpeed Insights, and track the domain in the CrUX dashboard and Search Console (ch. 8 · /optimize-speed).
- Check SERPs in **private/incognito** mode so personalisation doesn't fake your results (Ctrl+Shift+N / ⌘+Shift+N) (ch. 5 · /search-engines).
- Watch Search Console Coverage for Valid / Error / Valid-with-warnings / Excluded and act on it (ch. 5 · /search-engines).
- A memorability test for the domain: tell a few people, ask them again after **2–3 days** (ch. 4 · /website).
- Verify results differ by device and by location — the same query gives different top results in different places (ch. 5 · /search-engines).

**Where CalmBeach already does this**
- Pre-rendering means broken internal links surface at build time rather than in production — a structural QA advantage over the CMS setups the book assumes.
- Templated pages mean a fix applies uniformly to thousands of pages.

**Where CalmBeach does not**
*Re-checked 30/08/2026 — this section understated the project badly.*
- ~~One template regression = 9.474 broken pages, no smoke test~~ — **wrong.** 85 checks run in CI on every pull request (`scripts/runCriticalQualityChecks.mjs`), roughly 55 of them on weather/sea truth and copy consistency, plus a Playwright layout probe that measures 400 text nodes at four widths in five languages (`tile-fit`). A second workflow re-validates ~2.900 beach-hours against real wind twice a week.
- **Search Console IS worked as a queue.** `scripts/auditIndexedUrlsResolve.mjs` replays every URL Search Console recorded as served against `dist/` and `_redirects` — written after the 21/08 incident where 24 ranking URLs 404'd. Last run: 4.596 URLs, 0 failing. JSON-LD coverage is its own gate: 9.507 of 9.510, and the 3 without it are the legal pages, by design.
- No real-user testing of navigation, and no device/location matrix (ch. 5, ch. 7). **Still open.**
- **Heading verification exists for region pages only** (`auditRegionPages.mjs`), not for the 8.534 beach URLs, and nothing anywhere checks for skipped levels (ch. 6).
- ~~No per-page-type PageSpeed baseline~~ — **partly closed 30/08/2026**: real-visitor LCP/INP/CLS now report (`utils/webVitals.ts`) and bundle weight is a blocking gate. Synthetic per-page PageSpeed runs: still none.
- `[our note, unchanged and still right: the highest-value test here is not in the book. It is that the wind and wave figures are internally consistent and not stale — and that is precisely what the ~55 truth checks do.]`
- `[our note: for a safety-adjacent site, the highest-value missing test isn't in the book at all — it's a sanity check that the wind/wave figures shown are internally consistent and not stale. The book's "current and accurate" (ch. 4) is the nearest thing it offers.]`

---

## 10 · SEO (on-page)

**What the book tells this role**
- **Titles:** 60–70 characters max, unique per page, primary keyword included. He encourages numbers, "magic words" (how, why, what, where, free, amazing, download) and the brand name, aiming for descriptive plus a little emotional pull (ch. 6 · /optimize-onsite).
- **Meta descriptions:** 155–160 characters so they display in full, unique per page, keyword included, active voice with action verbs ("See", "Find", "Book"), and concrete details — price, availability, number of reviews (ch. 6 · /optimize-onsite).
- **URLs:** short, clear, consistent; hyphens between words; keyword in the slug; hierarchical by topic (`/products/item-1`); **no year in the URL** (it dates the content); avoid parameters like `?page=2`; **never change a URL without a 301** (ch. 6 · /optimize-onsite).
- **Headings:** exactly one h1, h2/h3 for sections, no skipped levels, descriptive and keyword-relevant, verified with an outliner (ch. 6 · /optimize-onsite).
- **Content:** comprehensive but concise; written for humans in simple language; synonyms and natural variations rather than repetition; short sentences and paragraphs; answer the visitor's question directly; supporting images and video; strategic internal links (ch. 6 · /optimize-onsite).
- **Internal linking:** build pillar pages that link out to topic clusters; use descriptive anchor text; place links inside the content; make the topical relationships explicit (ch. 6 · /optimize-onsite).
- **Images:** original where possible, high quality, prominent, and directly related to the surrounding text; treat image search as a channel. His supporting numbers: people remember **80%** of what they see vs **20%** of what they read, and image quality influences **67%** of purchase decisions; multimedia raises time on page (ch. 6 · /optimize-onsite).
- **Match the page to the dominant intent.** Read the SERP itself — the mix of results, knowledge panels, videos, related searches — to classify transactional / navigational / informational. If ~75% of the results serve transactional intent, an informational page will not rank there however good it is (ch. 10 · /optimize-intention).
- **Don't fight navigational queries** you can't own; Google shrinks organic space on branded searches. And you must rank for your *own* brand name (ch. 10 · /optimize-intention).
- **Exact-match domains are not leverage any more** — modern Google ignores domain-to-query matching; content quality and intent alignment decide (ch. 10 · /optimize-intention).
- **Narrow the page's target.** A broad term like "Αράχωβα" carries a thousand different intentions; a page should serve one motivation (accommodation, transport), not all of them (ch. 10 · /optimize-intention).
- You can win transactional long-tail queries against official providers purely on superior UX: cleaner layout, obvious CTA, tap-to-call (ch. 10 · /optimize-intention).
- Build informational content around your field — how-tos, step-by-steps, video — to establish authority without selling, and **never sell inside informational content**; the goal is being remembered as trustworthy when the buying decision comes (ch. 10 · /optimize-intention).
- Use infographics for anything complex, because images are processed faster and shared more (ch. 10 · /optimize-intention).
- His stated "Skroutz principles": serve humans not algorithms; no black hat; know your audience; **one quality page per important query**; and help search engines understand your site's structure (ch. 10 · /optimize-intention).
- Mine Google's own surfaces for structure and content gaps: autosuggest, "related searches", and `site:` on competitors (ch. 5 · /search-engines).
- **Submit a sitemap** with all your URLs in Search Console (ch. 5 · /search-engines).
- Cover topics comprehensively; the giants' weakness is generic coverage, so specialist local depth is where a small site wins the category (ch. 2 · /before-start).

**Where CalmBeach already does this**
- "One quality page per important query" (ch. 10) is arguably the site's whole architecture: ~~9.500 pages built around individual beaches and regions.
- JSON-LD on 9.507 of 9.510 built pages goes beyond what the book asks for — helping search engines understand structure is his principle, structured data is a stronger implementation of it than he describes.
- A sitemap-driven pre-render pipeline naturally satisfies ch. 5's sitemap submission requirement.
- Hierarchical, parameter-free URLs are the natural output of a pre-rendered static build (ch. 6).
- The site is a genuine informational asset that doesn't sell — ch. 10's "build trust first" position, currently by circumstance rather than strategy.

**Where CalmBeach does not**
*Re-checked 30/08/2026 — five of the six bullets here were wrong.*
- ~~Titles and metas will be near-duplicates~~ — **wrong.** Both are generated under hard length caps (58 chars for Greek titles, 60 elsewhere, 155 for metas) and guarded by `scripts/validateBeachMetaDescriptions.mjs`, which fails the build if any snippet body covers more than 7% of a language's pages or if the distinct-body count regresses. Its own header records the fix: 2.854 Greek pages once shared ~926 bodies, one sentence covering 241 of them. **One real gap survives:** titles have no distinctness test, and every Greek beach title drops the brand because `| CalmBeach` will not fit 58 chars.
- **Intent classification: done, and it is a report.** `reports/snapshots/2026-08-21.md` scores 14 intents against the CTR curve at their own position — `sheltered` earns 2,17× what its position allows, `weather` 0,38×. That is exactly ch. 10's question, answered with our own data instead of by reading a SERP.
- ~~No pillar pages, no deliberate internal-link clusters~~ — **wrong.** 8 topic verticals × island (381 guides), a hub, 13 national landings, and every beach page linking its region, up to 8 nearby beaches, up to 6 sheltered-nearby, its island guides and the hub. `reports/seo/orphan-pages.json`: **0 orphans of 9.507**. The region→guide asymmetry was found and fixed on 05/08.
- **Photo-less pages: 1.505 of 2.872 (52,4%).** The real number, from `reports/photo-coverage/beach-photo-presence-summary.txt` (17/08) — worse than the 1.421 quoted here, not better. This is now the largest remaining content gap (ch. 6).
- ~~No informational content layer~~ — **wrong.** 381 island-intent guides, `/faq/`, `/how-we-measure-wind-shelter/` and per-beach editorial for 110 regions. Some of it is the direct output of Search Console: the Euboea sub-areas and the Rhodes snorkelling picks were written on 26/08 because the 90-day export asked for them.
- **hreflang is five languages now, and it is clean.** DE/FR/IT are emitted only for the 17 `LOCALIZED_REGIONS`, so no page points at a locale it was not generated in. `reports/seo/hreflang-integrity.json`: 9.539 pages, 0 broken targets, 0 broken x-default, 0 non-mutual, 0 incomplete sets.

---

## 11 · Content, Photos & Localization

**What the book tells this role**
- **Write it yourself.** He is emphatic: owners should create their own primary content, because no hired professional will bring equal energy and conviction. Outsource images, infographics and video if needed — not the core writing (ch. 12 · /cost).
- Content must be well-written, current and accurate, with supporting images and video, and must give the visitor everything needed to take the next step (ch. 4 · /website).
- **Answer the visitor's question at the moment it arises** while they're browsing (ch. 4 · /website).
- Tone, format and messaging follow the audience and the goal. His contrast: health content needs a serious tone, credentials, testimonials, direct contact; travel content for a young audience can be informal, with user experiences, sharing and cost indications (ch. 1 · /abstract). Language, style, tone and image choice all come out of the persona work (ch. 3 · /starting-the-journey).
- **Cut ruthlessly** — half the words, then half again (ch. 7 · /optimize-ux).
- **Video:** 82% of internet traffic is video; attention spans are short and multimedia is consumed faster than text; use high-quality images and video for what you offer (ch. 4 · /website).
- **Reviews and ratings, prominently displayed:** 91% of users read reviews before buying; 84% trust online reviews as much as personal recommendations; 82% of review readers specifically look for the negative ones; visitors spend **5× longer** reading negative reviews — so answering them well matters (ch. 4 · /website).
- Images: original, high-quality, relevant to the adjacent text, and prominent (ch. 6 · /optimize-onsite).
- Lead with the value proposition and the important information; details afterwards; stay concise so the visitor doesn't get bored (ch. 13 · /closing).
- Find, extract and edit high-quality images and video yourself as part of delivering a pleasant experience (ch. 13 · /closing).
- Content strategy budget reality if you do outsource: €200+ for a few pages, €1,000+ for ongoing management (ch. 12 · /cost).

**Where CalmBeach already does this**
- Solo-founder-authored content is exactly the model ch. 12 recommends, and for free rather than his €200–1,000.
- 1.367 beaches carry photos (47,6%, `reports/photo-coverage/beach-photo-presence-summary.txt`, 17/08/2026) — real progress on his image requirement, and every one of them attributed: a photo whose licence we cannot cite is simply not published.
- Five languages — EN and EL nationally, DE/FR/IT for 17 tourist regions — go well beyond the single-language site the book imagines, and match a tourist audience.
- The per-beach explanation of *why* a beach is recommended is ch. 4's "answer the question at the moment it arises", implemented as a product feature.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- **1.505 beaches with no photo (52,4%).** The correct figure, and by the book's own numbers (67% of decisions influenced by image quality — ch. 6) the largest content gap left. It has a gradable path already built: `npm run quality:photo-coverage` ranks the missing ones by importance. Six regions sit at zero. Separately, 27 photos exist but do not render because no credit line was found in `public/IMAGE_CREDITS.txt` — the licence is not optional, so they are withheld; adding the credit publishes them.
- ~~German is partial~~ — **misread.** DE, FR and IT are deliberately scoped to 17 tourist regions (`LOCALIZED_REGIONS`), and hreflang is gated to match, so nobody is pointed at a page that does not exist. Not half-done: bounded. **The real problem is the opposite of the one this bullet feared** — those pages exist, rank, get impressions, and are barely clicked (see 12).
- **No reviews or user experiences shown.** Still true and still the biggest trust gap — though the collection side now exists (see 16); what is missing is showing anything back.
- No video, against his 82%-of-traffic argument (ch. 4). **Unchanged.**
- ~~No editorial writing at all~~ — **wrong.** 381 island-intent guides, `/faq/`, the methodology article, and hand-written editorial for 110 regions in `data/beachStories.data.json`. Written by the founder, which is exactly what ch. 12 asks for.

---

## 12 · Growth & Analytics

**What the book tells this role**
- **Set up Google Search Console first**: verify ownership once (file, HTML tag or DNS) and submit your sitemap (ch. 5 · /search-engines).
- The three GSC sections he tells you to live in: **Coverage/Index** (Valid, Error, Valid-with-warnings, Excluded), **Performance** (clicks, impressions, CTR, average position) and **Links** (ch. 5 · /search-engines).
- **The key analysis: compare position against CTR** to find where you rank but aren't being clicked — those are your optimisation opportunities. And filter by query to learn what visitors actually want and in what volume (ch. 5 · /search-engines).
- **Weekly is often enough.** For small/personal sites, GSC plus Google Search knowledge suffices; "avoid daily obsessive tracking". Buy paid tools as the business scales (ch. 5 · /search-engines).
- Tools, if and when you scale: Ahrefs (his professional recommendation — backlinks, rank tracking, content gap, broken links, and estimated clicks per keyword, which matters because 50%+ of searches produce no click); Semrush (rank tracking, intent classification, on-page audits); Ubersuggest (freemium keyword research and site audit); Moz (rank history, US-skewed and smaller) (ch. 5 · /search-engines).
- Use **Google Keyword Planner** to establish the realistic traffic ceiling for a keyword *before* investing effort (ch. 2 · /before-start).
- **Know the zero-click reality:** ~66% of Google searches end without a click; rank-1 CTR on mobile falls from ~50% to ~23% when "People Also Ask" appears, and to ~15% when a local pack appears (ch. 2 · /before-start).
- Position economics: #1 takes roughly a third of clicks and is ~10× more likely to be clicked than #10; each step from 1→7 is worth about 30% more clicks than the one below; 7–10 are much the same; page 2 is, in his phrase, where you hide a body (ch. 2 · /before-start; ch. 5 · /search-engines).
- **Monitor daily traffic trends to learn what questions visitors need answered**, and track conversion continuously to judge business progress (ch. 13 · /closing).
- Identify which distribution channel actually works for you and put your time there. Social media, forums, groups and communities can produce millions of visits with no Google ranking at all — though Google Search still sends more traffic to websites than anything else (ch. 1 · /abstract).
- Competitive analysis before you start: find who actually ranks (often not your offline competitors), and study their keywords, backlinks and content structure to find the gap (ch. 2 · /before-start). Once competitors are identified, acting against them gets much easier (ch. 1 · /abstract).
- Accept and act on user suggestions and comments; they reveal unmet needs (ch. 3 · /starting-the-journey).

**Where CalmBeach already does this**
- GA behind a consent gate plus a first-party `/api/traffic` counter means there is a measurement floor even for consent-refusing visitors — more robust than the single-GA setup the book assumes.
- Competitive position against beachesofgreece.com is known (~2.870 vs ~345 beaches).

**Where CalmBeach does not**
*Re-checked 30/08/2026 — this was the most wrong section in the file. It was written from the project docs, not the repository.*
- ~~Search Console is not named anywhere~~ — **wrong, and it was the file's own #1.** Verified via meta tag (`index.html:13`) on a `sc-domain:calmbeach.gr` property, pulled automatically by service account (`scripts/seo-snapshot.mjs`), with snapshots committed to `reports/snapshots/` and manual exports to `data/analytics/search-console/`.
- ~~No CTR-vs-position work~~ — **wrong.** It is the centrepiece of the automated snapshot: expected CTR per position, per-intent index, striking distance, page-level CTR gaps, top zero-click pages. Real numbers for 22/07–18/08: 5.551 clicks, 144.755 impressions, position 7,8, +393% on the previous 28 days.
- **Zero-click: measured, and it is not the feared shape.** The snapshot lists the top zero-click pages by name. What it exposes instead is a locale problem: /it earns 0,4% CTR on 2.925 impressions and /fr 0,8%, against 3,9% for en/el, and all three are served mostly inside Greece.
- No keyword ceiling estimate (ch. 2). **Moot now** — the site is indexed and the demand is being measured directly rather than estimated.
- **The channel question is answered: it is Google.** 8.656 clicks in 90 days, essentially all organic; no other channel exists to compare against. The book's advice to concentrate where it works is being followed by default rather than by decision (ch. 1).
- ~~No query-level insight loop into content~~ — **wrong.** 26/08/2026 is the worked example: the 90-day export said «βόρεια Εύβοια», «Ρόδος snorkeling» and «κάμερα», and all three became content the same session (`data/analytics/search-console/2026-08-26-notes-90d.md`).

---

## 13 · Monetization

**What the book tells this role**
- **Judge the site on a real ROI calculation**: genuine costs plus your own time, against actual business benefit. He calls this "the most reliable criterion" for whether a site is worth it (ch. 12 · /cost).
- His worked example: €162/year in running costs producing €1,638/year in profit, purely from commission avoided by shifting to ~60% direct bookings instead of paying ~15% to Booking.com (ch. 12 · /cost).
- **Platform commissions start around 15%** in Greek accommodation; drive sales to your own site and reinvest the saved commission into the site (ch. 11 · /optimize-use-other-platforms).
- Different site types monetise differently — a content site's success metric is **ad revenue and sponsorships** (ch. 1 · /abstract).
- Third-party platforms are "free" but monetise your content and traffic on their own terms (ch. 3 · /starting-the-journey).
- Paid results beat organic for high-commercial-intent queries — studies he cites show roughly **2× the clicks** to paid (ch. 10 · /optimize-intention). `[our note: read as a warning — a transactional beach-adjacent query is expensive territory to compete in organically.]`
- **Never sell inside informational content**; be the trusted source and win the decision later (ch. 10 · /optimize-intention).
- Every page needs its "next step"; a page with no conversion path converts nothing (ch. 1 · /abstract; ch. 4 · /website).
- The design mistake he calls out directly: judging a site by aesthetics instead of by conversion, which he says many designers do — and competitors' sites are often badly designed for conversion too, so don't copy them (ch. 1 · /abstract).

**Where CalmBeach already does this**
- Not selling is currently a strength by the book's own ch. 10 logic: a purely informational, trustworthy site builds the recall that later monetisation depends on.
- The planned affiliates (ferry, car rental, activities) are travel-transactional and adjacent to the visitor's actual next action — the right *category* of next step for ch. 4.
- Running costs are near-zero, so the ROI ratio of ch. 12 is structurally favourable when any revenue appears.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- ~~No conversion event exists at all~~ — **wrong.** `navigation_clicked` is the declared GA4 conversion, and a delegated capture-phase listener measures every outbound link with its destination host (`App.tsx:5841-5861`). Both are mirrored first-party (`pageviewBeacon.ts`), so they survive consent decline and ad blockers.
- ~~No page has a defined next step~~ — **wrong**, see 01. What is genuinely absent is a *commercial* next step, which is a different sentence and a deliberate one.
- The founder's own time — the largest real cost, and one the book insists on counting (ch. 12) — **is still not tracked.** This is the one bullet here that survived the re-check unchanged, and it is now the binding constraint on everything else in this file.
- `[our note from 30/07, and it was already done: "instrument outbound clicks now, with no affiliate deal in place — in 12 months that dataset is what makes an affiliate conversation possible." The instrumentation predates the note. The dataset is accumulating; nobody has looked at it yet, which is the actual next move.]`

---

## 16 · Community & Feedback

**What the book tells this role**
- **Reviews are a trust engine, with numbers:** 91% read reviews before buying; 84% trust them as much as personal recommendations; 82% of review readers seek out the negative ones; readers spend **5× longer** on negative reviews — so respond to negatives properly and publicly (ch. 4 · /website).
- Display user reviews and ratings **prominently** (ch. 4 · /website).
- **Accept user suggestions and comments** to improve the site and to discover needs you haven't met (ch. 3 · /starting-the-journey).
- **Gather feedback from real users** on your navigation, and test it from their point of view (ch. 7 · /optimize-ux).
- Retaining existing users is more cost-effective than acquiring new ones (ch. 3 · /starting-the-journey).
- Make contact channels obvious: footer details, a contact page with map, email, phone, form, ideally live chat (ch. 4 · /website).
- Community channels — forums, groups, digital communities — can generate enormous traffic with no search ranking at all (ch. 1 · /abstract).
- The platform warning: reviews on external platforms **can't be removed even when wrong**, and a single unfair one can cost dozens of customers; negative comments also spread faster than corrections (ch. 11 · /optimize-use-other-platforms).
- Personal, direct communication is a small operator's structural advantage over a giant (ch. 13 · /closing).

**Where CalmBeach already does this**

*Rewritten 30/08/2026. The 30/07 version of this section said "nothing substantive" and "no feedback channel of any kind". Both were false on the day they were written.*
- **Four inbound channels, all live to Telegram:** the landing form with three seed chips (`OurStorySection.tsx:141` → `netlify/functions/feedback-email.mjs`), the per-beach forecast verdict with a "when were you there?" second step (`BeachDetailPage.tsx`), a 1–10 rating prompt gated behind five days of use (`AppRatingPrompt.tsx`), and since 30/08 a "Κάτι δεν πάει καλά εδώ;" link in every footer and on every beach page.
- **The verdict reports feed calibration**, not just an inbox: `feedback-email.mjs` → Netlify Blobs → `feedback-export.mjs` → `scripts/calibrateFromFeedback.mjs`. That is more than the book asks for.
- Contact routes exist: two addresses in the footer, phone and postal address in `/terms`.
- A newsletter and a photo-contribution ask both exist (`NewsletterSection.tsx`, `CommunityPhotosSection.tsx`).

**Where CalmBeach does not**
- **Nothing collected is ever shown back.** Visitors report conditions and those reports reach Telegram and the calibration pass — no visitor ever sees another visitor's word. The trust apparatus the book devotes most of ch. 4's statistics to (91% read reviews, 84% trust them as a personal recommendation) is still entirely absent from the page, and beachesofgreece.com lacks it too, which is the opening.
- The trust strip (`HowWeDecideSection.tsx`) is institutional self-description: no counts, no press, no third-party proof of any kind (ch. 4).
- **The early jump-link to the form was removed on 29/08 and nothing replaced it** (commit `763db4a`) — the landing form now sits in band six and is reached only by scrolling. Deliberate, and worth watching: if the form goes quiet, that is why.
- No community presence off-site — no group, no forum, nowhere the audience already is (ch. 1, ch. 3).

---

## 17 · Cost & Quotas

**What the book tells this role**
- **Concrete cost bands:** .gr domain €10–15/year (.com slightly cheaper); hosting €10–20/month for a typical small/medium site; pre-built themes €10–200; custom design €1,000+; annual maintenance €150–200/year (ch. 12 · /cost).
- **Two starting budgets:** a minimal but functional dynamic site ≈ **€200–300**; a more realistic medium-term budget **€500–1,000**, which buys premium extensions and better functionality (ch. 12 · /cost).
- Content costs if outsourced: €200+ for a few pages, €1,000+ for ongoing management — and he advises against outsourcing the writing anyway (ch. 12 · /cost).
- **"Start simply"** with free or cheap tooling and upgrade only against an identified need. Don't spend heavily up front; use the early phase to learn what you actually need (ch. 12 · /cost; ch. 4 · /website).
- But: **don't churn** — "experimenting with random themes weekly causes harm" (ch. 12 · /cost).
- **Do the ROI arithmetic and let it decide.** Costs + your time vs benefit gained; his own €162 → €1,638 case (ch. 12 · /cost).
- Owned platforms cost money and developer time; free platforms cost you your traffic and content instead (ch. 3 · /starting-the-journey).
- Websites need sustained investment of time, thought, energy and money — and the owner has to understand the site's value, limits and business role (ch. 4 · /website; ch. 12 · /cost).

**Where CalmBeach already does this**
- Netlify + Cloudflare + a static build sits at or below his minimal band — cheaper than the €200–300 minimum and much cheaper than €10–20/month hosting, for ~9.500 pages.
- "Start simply and upgrade on evidence" describes the stack accurately: no CMS, no database, no premium plugins.
- No theme churn: one React + Vite codebase.

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- **The founder's hours are not counted as cost**, and the book is explicit that they must be (ch. 12). Weekend-only capacity is the binding constraint on everything in this file; without tracking it, prioritisation is guesswork. **Unchanged, and now the most consequential open item in the file.**
- ~~No quota/cost ceiling monitoring~~ — **two of the three are covered.** The weather API has a daily ledger with amber/red Telegram alarms and a 429 alarm (`netlify/functions/lib/capacityAlarm.mjs`), unit-tested by a blocking gate; build credits have a hard brake that cancels builds for doc-only commits (`scripts/netlifyShouldSkipBuild.mjs`). **Function invocations have nothing** — no counter, no alarm, only prose in `reports/capacity/activation-runbook.md`. That is the one that is still exactly as the book describes it.
- The ROI calculation still can't be run, but for a narrower reason than in July: the cost side is knowable and the benefit side is measured as *intent* (outbound clicks), not money (see 13).

---

## 18 · Google (Google's systems and policies)

**Read alongside `google-official-docs.md`, which overrides this section wherever they differ.**

**What the book tells this role**
- **The three phases:** crawling (bots follow links and process submitted URLs) → indexing (content, function and appearance analysed and stored) → serving (ranked by the visitor's location, language, device, history and query) (ch. 5 · /search-engines).
- Scale, as of his 2019 figure: ~5.6 billion searches a day — 3.8 million a minute, 63,000 a second (ch. 5 · /search-engines). Google held **89.95%** of search market share as of January 2019 (ch. 11 · /optimize-use-other-platforms).
- **Query types:** transactional, navigational, informational (ch. 5, ch. 10). He also cites Google's six human needs behind searches: doing, knowing, belonging, experiencing, self-improvement, self-discovery (ch. 5 · /search-engines).
- **Google is taking the clicks:** ~66% of searches end with no click, answered in the SERP itself; images, video, FAQs, knowledge panels and local packs all compete with your listing for attention (ch. 2 · /before-start).
- **Core Web Vitals are a ranking input** — Google favours fast sites and disadvantages slow ones (ch. 1 · /abstract; ch. 8 · /optimize-speed).
- **Link policy:** paid links breach guidelines unless properly tagged as advertising; also avoid guest posts with exact-match anchors for ranking manipulation, manipulative user-generated links, links from unrelated sites, and comment spam (ch. 9 · /optimize-backlinks).
- **Penalty inheritance:** don't buy aged or expired domains as a beginner — you can inherit penalties from the previous owner's practices. Research hard before any auction purchase (ch. 12 · /cost). Also don't use aged domains previously associated with different content (ch. 4 · /website).
- **Google ignores exact-match domain-to-query matching** now; it does not help you rank (ch. 10 · /optimize-intention).
- Google reduces organic space on branded/navigational queries (ch. 10 · /optimize-intention).
- Search Console is the official channel: verify once, submit sitemaps, monitor Coverage, Performance and Links (ch. 5 · /search-engines).
- Google My Business is essential for anything with a physical location — **46% of Google searches** are looking for local information (ch. 11 · /optimize-use-other-platforms).
- His stated philosophy: serve humans, not algorithms; no black hat; and actively help search engines understand your structure (ch. 10 · /optimize-intention).
- Google Search still drives more traffic to websites than any other source (ch. 1 · /abstract).

**Where CalmBeach already does this**
- Clean crawl surface: ~9.500 pre-rendered pages, so nothing depends on Google executing JavaScript to index content.
- JSON-LD on 9.507 of 9.510 built pages is a strong implementation of "help search engines understand your structure" (ch. 10).
- calmbeach.gr is a fresh domain, no inherited-penalty exposure (ch. 12).
- Zero black-hat exposure: no paid links, no link schemes, no manipulation (ch. 9).

**Where CalmBeach does not**
*Re-checked 30/08/2026.*
- ~~Search Console appears to be absent~~ — **wrong.** See 12. Coverage, index count and the pages without JSON-LD are all visible, and two of them are gates.
- **Zero-click: measured rather than feared.** The snapshot names the top zero-click pages and scores every intent against the CTR curve at its own position. The `weather` intent does index below the curve (0,38×), which is the book's prediction holding — but `sheltered` runs at 2,17× and `brand` at 2,22×, so the niche is not uniformly zero-click.
- **Safety-adjacent content raises a bar the book never discusses.** Unchanged and still the right warning: `google-official-docs.md` leads here, not this file. What has been built in the meantime is on the right side of it — a static safety disclaimer in the footer of every prerendered page, and a content gate that refuses guaranteed-calm wording.
- No Google Business Profile (still not obviously applicable — no physical location).
- **hreflang is now five languages and clean:** 9.539 pages, zero defects, DE/FR/IT emitted only where the page exists. The risk this bullet named is closed; the *content* risk is not — those locales get impressions and almost no clicks (see 12).

---

## Roles the book does not address

Listed so the gap is visible rather than papered over. The book is aimed at a small Greek business owner building a WordPress site — it was never written for a data-driven application, so these omissions are expected, not failings of the author.

- **06 · Weather & Marine Data.** Nothing. The book has no notion of consuming third-party APIs, data freshness SLAs, fallback when a provider is down, licensing of forecast data, or attribution requirements. Its nearest adjacent line is that content must be "current and accurate" (ch. 4 · /website) — true but not operational. This role gets no guidance here.
- **07 · Algorithm / Recommendation.** Nothing on scoring, weighting, validation or explainability. The two adjacent ideas are that local specialist depth is what beats the giants (ch. 2 · /before-start, ch. 13 · /closing) and "serve humans, not algorithms" (ch. 10 · /optimize-intention) — which is about not gaming Google, not about building a recommender. The wind model's correctness, calibration and failure modes are entirely outside the book's scope.
- **14 · Legal & Compliance.** Effectively nothing. GDPR, consent, cookies, disclaimers, liability for safety-relevant information, data licensing (OSM's ODbL, photo rights) and terms of use are all absent. The only adjacent item: put terms and contact details in the footer and on a contact page (ch. 4 · /website, ch. 7 · /optimize-ux) — presented as a trust/UX matter, not a legal one.
- **15 · Security.** Nothing. No HTTPS, secrets, key rotation, dependency, abuse or rate-limiting guidance. The platform-shutdown warnings (ch. 3, ch. 11) are business-continuity points, not security ones, and belong to 08.

---

## Πού διαφωνεί με τις αποφάσεις μας

Σημεία όπου το βιβλίο λέει κάτι διαφορετικό από αυτό που έχει ήδη επιλέξει το CalmBeach. Και οι δύο πλευρές, χωρίς ετυμηγορία.

**1. WordPress σε ελληνικό server, αντί για React + Vite σε Netlify.**
*Το βιβλίο:* για μικρά και μεσαία ελληνικά sites, WordPress.org με προσαρμογή έτοιμου θέματος, σε ελληνικό server για καλύτερη ταχύτητα (κεφ. 4 · /website, κεφ. 12 · /cost). Λίγες μέρες δουλειάς, μερικές εκατοντάδες ευρώ, τεράστιο οικοσύστημα.
*Το CalmBeach:* React + Vite, pre-rendered, Netlify CDN, Cloudflare DNS. Πιο γρήγορο, σχεδόν μηδενικό κόστος, χωρίς βάση δεδομένων και χωρίς συντήρηση plugins.
*Δίκαια:* το CalmBeach είναι εφαρμογή με 9.474 σελίδες από dataset, όχι site 20 σελίδων — και το βιβλίο το παραδέχεται ότι οι σύνθετες περιπτώσεις θέλουν custom development (κεφ. 3). Από την άλλη, ο συγγραφέας έχει δίκιο ότι το custom σημαίνει ότι όλη η συντήρηση πέφτει σε έναν άνθρωπο με λίγες ώρες τα Σαββατοκύριακα.

**2. «Μηδεμία εξάρτηση από τρίτους» — αλλά ο stack μας είναι όλος τρίτοι.**
*Το βιβλίο:* η σοφότερη επιλογή για κάτι επαγγελματικό είναι να μην εξαρτάσαι από τρίτους (κεφ. 1 · /abstract), με παραδείγματα Google+ και GeoCities (κεφ. 3, κεφ. 11).
*Το CalmBeach:* Netlify, Cloudflare, Google Analytics, weather APIs — όλα τρίτοι, όλοι με όρους χρήσης που μπορούν να αλλάξουν.
*Δίκαια:* ο συγγραφέας εννοεί κυρίως «μην χτίζεις το site σου μέσα στο Facebook», και εκεί το CalmBeach συμμορφώνεται πλήρως — domain και περιεχόμενο είναι δικά μας. Αλλά η λογική του ισχύει και για το free tier ενός hosting provider.

**3. «Γράψε ο ίδιος το περιεχόμενο» — εμείς το παράγουμε αυτόματα.**
*Το βιβλίο:* ο ιδιοκτήτης πρέπει να γράφει μόνος του το βασικό περιεχόμενο, γιατί κανένας επαγγελματίας δεν θα βάλει την ίδια ενέργεια και πεποίθηση (κεφ. 12 · /cost).
*Το CalmBeach:* οι σελίδες παραλίας παράγονται από dataset και templates. Αλλά ΟΧΙ όλο το περιεχόμενο, και αυτό είχε γραφτεί λάθος εδώ: υπάρχουν 381 οδηγοί ανά νησί/θέμα, ένα `/faq/`, το άρθρο μεθοδολογίας `/how-we-measure-wind-shelter/` και χειρόγραφο κείμενο για 110 περιοχές στο `data/beachStories.data.json` — γραμμένα από τον ιδιοκτήτη, ακριβώς όπως ζητά το βιβλίο (επαλήθευση 30/08/2026).
*Δίκαια:* με 2.872 παραλίες, το χειρόγραφο κείμενο για την καθεμία είναι φυσικά αδύνατο για έναν άνθρωπο. Ο πήχης ποιότητας του βιβλίου (κεφ. 4, κεφ. 6) χτυπάει πλέον σε ένα σημείο, όχι σε δύο: τις 1.505 σελίδες χωρίς φωτογραφία.

**4. Το rank #1 ως «ουτοπία» — αλλά εμείς στοιχηματίσαμε σε 9.474 σελίδες.**
*Το βιβλίο:* μην κυνηγάς το rank #1, το 66% των αναζητήσεων δεν δίνει κλικ, διάλεξε λίγες μάχες που μπορείς να κερδίσεις και να μετατρέψεις (κεφ. 2 · /before-start).
*Το CalmBeach:* η στρατηγική είναι μαζική κάλυψη — μία σελίδα για κάθε παραλία και περιοχή.
*Δίκαια:* η μαζική κάλυψη είναι στην πραγματικότητα εφαρμογή της αρχής του «μία ποιοτική σελίδα ανά σημαντικό query» (κεφ. 10), και τα νούμερα τη δικαιώνουν: 5.551 κλικ σε 28 μέρες, μέση θέση 7,8, +393% έναντι του προηγούμενου μήνα (`reports/snapshots/2026-08-21.md`). Το conversion που ρωτούσε ο συγγραφέας ΥΠΑΡΧΕΙ πλέον ως μέτρηση — `navigation_clicked` και κάθε outbound σύνδεσμος — αλλά είναι πρόθεση, όχι έσοδο. Η ερώτησή του μένει ανοιχτή στη σωστή της μορφή: τι κάνουμε με αυτή την πρόθεση.

**5. Λίγες επιλογές μετατρέπουν καλύτερα — εμείς δίνουμε explore mode με 7 φίλτρα.**
*Το βιβλίο:* το paradox of choice είναι πρόβλημα conversion — 24 επιλογές έδωσαν 3%, 6 επιλογές έδωσαν 30% (κεφ. 7 · /optimize-ux).
*Το CalmBeach:* Top 3 (σωστό κατά το βιβλίο), και το explore mode δείχνει **5** φίλτρα με κουμπί «Άλλα» για τα υπόλοιπα 7 — `PreferenceFilters.tsx:39`, επαλήθευση 30/08/2026. Το «7 φίλτρα» της προηγούμενης έκδοσης αυτού του αρχείου ήταν λάθος μέτρηση. Το βαρύ φύλλο των 20 φίλτρων (`AmenityFilter.tsx:174`) ανοίγει μόνο με ρητό πάτημα.
*Δίκαια:* πέντε ορατά φίλτρα είναι μέσα στο εύρος που το ίδιο το βιβλίο δίνει ως καλό (6 επιλογές → 30%). Η ένσταση δεν ισχύει πια όπως ήταν γραμμένη· αν κάτι μένει, είναι το φύλλο των 20.

**6. Google My Business / πλατφόρμες — εμείς είμαστε μόνο στο site.**
*Το βιβλίο:* μη διαλέγεις μεταξύ site και πλατφορμών, κράτα και τα δύο, και δώσε προτεραιότητα στους δυνατούς παίκτες του κλάδου σου (κεφ. 11 · /optimize-use-other-platforms).
*Το CalmBeach:* υπάρχει native shell για Android (`capacitor.config.ts`, `gr.calmbeach.app`) και PWA install prompt (`components/InstallPrompt.tsx`) — δηλαδή μία πλατφόρμα, όχι καμία, όπως έγραφε η προηγούμενη έκδοση. Κοινωνικά δίκτυα, φόρουμ και ομάδες: τίποτα.
*Δίκαια:* το CalmBeach δεν έχει φυσική τοποθεσία ούτε προϊόν να πουλήσει, οπότε τα παραδείγματά του (Skroutz, Booking, GMB) δεν εφαρμόζονται άμεσα. Αλλά η γενική αρχή — να είσαι εκεί που είναι ήδη το κοινό σου — μένει αναπάντητη· και το κοινό ενός τουριστικού site είναι σε ομάδες ταξιδιού, όχι σε ένα app store.

---

## Τα 5 πράγματα από το βιβλίο που θα άλλαζαν κάτι σήμερα

**Ξαναγράφτηκε 30/08/2026.** Η προηγούμενη λίστα (30/07) είχε πέντε σημεία και τα τέσσερα
είχαν ήδη γίνει — Search Console, κανάλια feedback, titles/metas, μέτρηση outbound. Παρακάτω
είναι ό,τι έμεινε, μετά από έλεγχο στον κώδικα. Για solo founder, με ώρες Σαββατοκύριακου.

**1. Οι φωτογραφίες: 1.505 παραλίες στις 2.872 δεν έχουν καμία (κεφ. 6 · /optimize-onsite).**
`reports/photo-coverage/beach-photo-presence-summary.txt` (17/08): 1.367 με φωτογραφία, 47,6%.
Έξι περιοχές στο μηδέν (Αρκοί, Ερείκουσα, Μαθράκι, Οθωνοί, Οινούσσες, Ψαρά). Είναι το
μεγαλύτερο κενό που έχει απομείνει και το μόνο με σαφή, βαθμωτή διαδρομή: το
`npm run quality:photo-coverage` βγάζει ήδη ταξινομημένη τη λίστα «ποιες λείπουν και είναι
σημαντικές». Επιπλέον 27 URL έχουν φωτογραφία αλλά δεν εμφανίζεται, επειδή λείπει η γραμμή
credit από το `public/IMAGE_CREDITS.txt` — αυτές είναι δουλειά λεπτών, όχι ταξιδιού.

**2. Τα ιταλικά και τα γαλλικά παίρνουν εμφανίσεις και δεν παίρνουν κλικ (κεφ. 5, κεφ. 10).**
`reports/snapshots/2026-08-21.md`: /it 2.925 εμφανίσεις με CTR 0,4%, /fr 904 με 0,8%, ενώ
en/el είναι στο 3,9%. Και τα τρία διαβάζονται `mostly_served_inside_greece`. Οι πέντε
χειρότερες σελίδες σε CTR-έναντι-θέσης είναι όλες /it — μόνο η
`/it/beaches/lefkada/1147-avali/` χάνει ~13 κλικ σε 28 μέρες από θέση 7,1. Αυτό είναι ακριβώς
η ανάλυση «θέση προς CTR» του κεφ. 5 να δείχνει ένα συγκεκριμένο πράγμα, και δεν έχει
απαντηθεί: είναι λάθος κοινό, λάθος τίτλος, ή Έλληνες που βλέπουν ιταλική σελίδα;

**3. Ο ρυθμός κλήσεων των Netlify functions δεν έχει ταβάνι (κεφ. 12 · /cost).**
Το Open-Meteo έχει συναγερμό (`netlify/functions/lib/capacityAlarm.mjs`, amber 18k / red 25k
την ημέρα) και τα build credits έχουν φρένο (`scripts/netlifyShouldSkipBuild.mjs`). Οι
invocations δεν έχουν τίποτα — μόνο πεζό κείμενο στο `reports/capacity/activation-runbook.md`
(«αν πλησιάσουν τις 125k/μήνα»). Κανείς δεν μετράει και τίποτα δεν χτυπάει. Ο Αύγουστος είναι
ακριβώς η στιγμή που ένα δωρεάν επίπεδο γίνεται είτε λογαριασμός είτε διακοπή.

**4. Κριτικές και συνθήκες από επισκέπτες, πουθενά ορατές (κεφ. 4 · /website).**
Το βιβλίο αφιερώνει τα περισσότερα στατιστικά του κεφ. 4 σε αυτό: 91% διαβάζουν κριτικές, 84%
τις εμπιστεύονται όσο μια προσωπική σύσταση. Εμείς **συλλέγουμε** ήδη αναφορές συνθηκών ανά
παραλία — και δεν τις δείχνουμε ποτέ πίσω σε κανέναν· πάνε στο Telegram και στη βαθμονόμηση.
Η λωρίδα εμπιστοσύνης (`HowWeDecideSection.tsx`) είναι θεσμικός αυτο-χαρακτηρισμός: μηδέν
απόδειξη από τρίτους. `[our note: το AggregateRating JSON-LD μένει εκτός συζήτησης — οι
αυτο-εξυπηρετούμενες κριτικές είναι ρητά εκτός πολιτικής Google· το ζήτημα είναι τι βλέπει ο
άνθρωπος στη σελίδα, όχι τι διαβάζει ο crawler.]`

**5. Ο ίδιος ο χρόνος του ιδιοκτήτη δεν μετριέται (κεφ. 12 · /cost).**
Το μόνο σημείο του βιβλίου που δεν έχει κουνηθεί καθόλου σε δύο εκδόσεις αυτού του αρχείου. Ο
υπολογισμός ROI που ο συγγραφέας αποκαλεί «το πιο αξιόπιστο κριτήριο» θέλει και τις δύο
πλευρές· εμείς δεν έχουμε ούτε την πλευρά του κόστους. Και επειδή οι ώρες Σαββατοκύριακου
είναι ο δεσμευτικός περιορισμός για ΟΛΑ τα παραπάνω, χωρίς αυτό η ιεράρχηση είναι εικασία.

---

## Τι έκλεισε στις 30/08/2026

Καταγραφή, ώστε να μην ξαναπροταθούν ως κενά:

- **Το breadcrumb έγινε ορατό σε άνθρωπο.** Το `index.tsx` κάνει `createRoot`, όχι
  `hydrateRoot`, οπότε η React έσβηνε το `<nav aria-label="breadcrumb">` που φτιάχνει ο
  prerenderer: υπήρχε για τη Google και για κανέναν άλλο — τρίτη φορά η ίδια παγίδα, μετά τον
  σύνδεσμο ODbL και τους οδηγούς. Τώρα το ξαναχτίζει η `pages/BeachDetailPage.tsx` (κεφ. 7).
- **Κανάλι «κάτι δεν πάει καλά εδώ»** στο footer (React και στατικό, άρα και στις ~9.500
  prerendered σελίδες) και στη σελίδα παραλίας με το id της παραλίας μέσα — η φθηνή διόρθωση
  για τα OSM πεδία που δεν έχουν επαληθευτεί (κεφ. 3, κεφ. 4).
- **Η κύρια φωτογραφία της prerendered σελίδας παραλίας έπαψε να είναι `loading="lazy"`.**
  Έρχεται αμέσως μετά τον h1, άρα είναι το LCP, και φόρτωνε τελευταία. Μαζί: πραγματικό
  `srcSet` στη React (το `sizes` χωρίς `srcSet` ήταν αδρανές και κάθε κάρτα κατέβαζε το
  αρχείο των 800px), μικρογραφίες στα 400 αντί 800, `preconnect` στα δύο Wikimedia hosts
  (κεφ. 8).
- **Μέτρηση Core Web Vitals** σε πραγματικούς επισκέπτες — `utils/webVitals.ts`, LCP/INP/CLS,
  δυναμικό import 2,4 KB μετά το `load`. Είναι δείγμα όσων δέχτηκαν cookies, όχι όλων· ο
  λόγος είναι γραμμένος στο ίδιο αρχείο (κεφ. 8).
- **Ταβάνι βάρους στο CI** — το `perf:audit` υπήρχε από 13/08 και δεν το έτρεχε τίποτα·
  μπήκε στις κρίσιμες πύλες ως `bundle-budget`, πράσινο με περιθώριο (415,7 KB gzip αρχικό,
  όριο 600) (κεφ. 8).
- **Πάτωμα 16px στο κείμενο σώματος** της σελίδας παραλίας και 12px στα badges της κάρτας που
  τυλίγονται (ήταν 10px). Το 88,7% των κλικ είναι κινητό (κεφ. 7).
- **Ο άνεμος μπήκε στον υπότιτλο του ήρωα**, σε πέντε γλώσσες. Ο τίτλος και η απόφαση να μην
  υπάρχει kicker δεν άλλαξαν — αλλά πλέον η σελίδα λέει στον άνθρωπο αυτό που το `<title>`
  έλεγε μόνο στη Google (κεφ. 4, κεφ. 7, κεφ. 13).
