# The greatwebsites.gr Playbook — mapped onto CalmBeach

## What this file is

This is a working reference distilled from the free Greek e-book **"Σπουδαία Websites!"** by **Giorgos Katsiampas** (Head of Engineering Growth & SEO at Skroutz.gr), published at **https://greatwebsites.gr/**. Full credit to the author; the book is his work and is worth reading in the original.

Everything below is a **summary in our own words** of his advice, reorganised by which CalmBeach specialist it speaks to, and then checked against what CalmBeach actually does today. Short quoted phrases appear only where the exact wording carries the point, always attributed to a chapter.

**Rule for specialists using this file:** if you lean on advice from here, **say so** — name the chapter (e.g. "per the greatwebsites.gr chapter on UX"). Do not present this as settled fact.

**Rule on authority:** this book is **one experienced practitioner's view**. He is a credible one — SEO and engineering growth at the biggest Greek e-commerce site — so his opinions are informed and should be weighted seriously. But it is **not Google documentation**. Where it touches on Google policy (crawling, indexing, penalties, link schemes, ranking factors), `google-official-docs.md` wins. Some numbers in the book are dated (WordPress share is quoted as both 34% and 43% in different chapters; the CTR and market-share figures are from 2019–2021). Treat the numbers as order-of-magnitude, not current.

**Where anything below is our own connecting observation rather than the book's advice, it is marked `[our note]`.**

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
- The differentiator is real and specific — a ray-casting wind-exposure model that tells you how sheltered a beach is *right now*. That is precisely the "local, small-scale information the giants can't provide" argument of ch. 13, and it is defensible against beachesofgreece.com (~345 beaches vs CalmBeach's ~2,850).
- ~2,850 beaches with per-beach data is the hyper-local depth the book says is the underdog's weapon.
- Shipping before perfection: 9,474 pages live, German only partial, photos on ~1,429 of 2,850 beaches. That is ch. 12's "start simply" in practice rather than in theory.

**Where CalmBeach does not**
- **There is no defined success metric.** No revenue, no conversion event, no target. Analytics measure visits, and visits are the metric the book explicitly calls insufficient ("traffic without conversions wastes resources", ch. 2). This is the biggest single gap in this file — every other decision (what to build, what to cut) is unprioritisable without it. For a free site the metric doesn't have to be money; it could be "beach page → map/directions click" or "returning visitors in-season". But it has to exist.
- **No defined "next step" per page.** A beach page currently ends. There is no action the visitor is being moved toward — which by ch. 1's standard means the page has no goal. `[our note: this also blocks the affiliate plan; you cannot bolt a ferry affiliate onto pages that have never had a measured downstream action.]`
- The differentiator is in the product but is not stated as a value proposition anywhere a first-time visitor reads it (ch. 4).
- No persona work. Assumptions about tourists are implicit; the demographic/device data GA already collects has not been turned into decisions (ch. 3).
- Retention is untouched — no reason or mechanism for a visitor to come back tomorrow, on a trip where they'll swim eight more times (ch. 3). Moderate-to-large: in-season repeat use is the cheapest growth available.

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
- Top 3 recommendations rather than a wall of 2,850 options is exactly ch. 7's paradox-of-choice advice, applied without knowing it. `[our note: this is the single strongest UX decision already in the product and it should not be diluted by adding more headline options.]`
- Pre-rendered pages mean content is visible immediately, which serves the above-the-fold requirement.
- Mobile is the assumed primary context for a tourist on a beach day.

**Where CalmBeach does not**
- **The value proposition is not above the fold.** A first-time visitor is not told, in one line, that this site scores shelter from today's wind — the thing nobody else does. Cheap to fix, high leverage (ch. 4, ch. 7, ch. 13).
- **Explore mode + filters is where the choice paradox bites.** Seven filters over hundreds of results is the 24-jam scenario; the book would push toward fewer, defaulted, decision-shaped choices (ch. 7).
- **Three-click rule is almost certainly violated** across 9,474 pages. Not fixable literally at that scale, but the practical question — can a tourist reach a *relevant* beach page in three interactions? — has not been tested (ch. 7).
- No prominent contact route and no live feedback channel, which the book ties directly to lost trust (ch. 4). For a **safety-adjacent** site this is worse than his generic case: a visitor who spots dangerous wrong data has nowhere to report it.
- No breadcrumbs verified, no current-page indicator audited, and the 16px / tap-spacing / 7:1 contrast checks have not been run (ch. 7).
- No user testing of navigation with real people, which he asks for explicitly (ch. 7).

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
- Pre-rendering 9,474 pages plus Netlify's CDN is close to the best-case architecture for LCP on content pages — better than the WordPress-on-a-Greek-server setup the book actually recommends (ch. 4, ch. 8).
- Vite gives modern bundling and code-splitting by default, addressing his page-weight point.
- Cloudflare DNS + Netlify edge removes the server-distance problem he raises for German and other non-Greek visitors.

**Where CalmBeach does not**
- **CWV are not measured at p75 on real users, split mobile/desktop.** Pre-rendering fixes first paint; it does nothing for React hydration cost, which is where FID/INP dies on a mid-range Android on 4G at a beach. Unmeasured, so unknown — and by ch. 8's own numbers this is where a hidden double-digit loss would live.
- **Photos are the obvious weight risk.** ~1,429 beaches with photos and no stated responsive-image/format/lazy-load discipline in the project facts. This is the exact "high-resolution images" failure he names (ch. 8).
- Map view is a heavy interactive component with layout-shift and CLS potential; not audited (ch. 8).
- Heading hierarchy across ~9,474 templated pages has not been outline-verified — one template bug is 9,474 bad pages (ch. 6).

---

## 05 · Data Engineer (beach dataset)

**What the book tells this role**
- Content must be **"well-written, current, and accurate"** — he lists accuracy alongside quality, not below it (ch. 4 · /website).
- **Original data and unique statistics are one of the four content types that earn links**, together with visuals/infographics, numbered lists, and in-depth guides. BuzzSumo's finding that he cites: list pages earned more backlinks than quizzes, videos or charts (ch. 9 · /optimize-backlinks).
- Organise information into **"logical units"** before anything else, so a first-time visitor can find things intuitively — and so crawlers can too (ch. 4 · /website; ch. 1 · /abstract).
- Depth of specialist local knowledge is what lets a small site outrank Booking and TripAdvisor in a local category — a giant cannot replicate it (ch. 2 · /before-start; ch. 13 · /closing).
- Structure URLs hierarchically by topic and avoid parameters like `?page=2`; never change a URL without a 301 (ch. 6 · /optimize-onsite). `[our note: this is a data/routing decision as much as an SEO one, because the slug comes out of the dataset.]`

**Where CalmBeach already does this**
- ~2,850 OpenStreetMap-derived beaches is exactly the "original dataset the giants don't have at this granularity" asset of ch. 9 — 8× the competitor's coverage.
- The wind-exposure model produces genuinely original derived data per beach.
- The dataset drives a consistent page structure across 9,474 pages, which is the "logical units" principle applied at scale.

**Where CalmBeach does not**
- **Accuracy of the OSM-derived data is unverified** at the individual-beach level (surface type, amenities, access). The book asks for "current and accurate"; on a **safety-adjacent** site, a wrong sand/rocks or wrong-access record is not a cosmetic error. No confidence score, no per-field provenance, no correction pipeline.
- The original data is **not published as data** — no downloadable dataset, no methodology page, no stats/roundup content. That is the single link-earning asset the book names and it is sitting unused (ch. 9).
- **~1,421 beaches have no photos.** Half the dataset renders thin pages, and the book's content-quality bar (ch. 4, ch. 6) is not met on them.
- URL stability under future dataset regeneration is a risk: if a slug is derived from an OSM name and OSM changes, the URL changes, and ch. 6 says never do that without a 301.

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
- **The book's own logic cuts against parts of the stack**: Netlify + Cloudflare + Google Analytics + weather APIs are all third parties whose terms can change (ch. 3, ch. 11). Low probability, but there is no documented exit path from Netlify, and free-tier terms are exactly what he warns move under you.
- No cost ceiling or quota alerting documented for the Netlify functions and the weather API — an August traffic spike is a bill or a hard stop, not a graceful degradation.
- `/api/traffic` is a home-built counter with no stated retention, backup or rate-limit story.

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
- **The flip side of templating is untested**: one template regression = 9,474 broken pages. No stated per-locale or per-template smoke test.
- Search Console Coverage is not being worked as a QA queue — with 9,474 pages and JSON-LD on 9,465, the 9 missing pages are the kind of drift ch. 5 says to catch.
- No real-user testing of navigation, and no device/location matrix for either SERP checks or rendering (ch. 5, ch. 7).
- No outline/heading verification pass (ch. 6), and no per-page-type PageSpeed baseline (ch. 8).
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
- "One quality page per important query" (ch. 10) is arguably the site's whole architecture: ~9,474 pages built around individual beaches and regions, versus a competitor with ~345 beaches.
- JSON-LD on 9,465 pages goes beyond what the book asks for — helping search engines understand structure is his principle, structured data is a stronger implementation of it than he describes.
- A sitemap-driven pre-render pipeline naturally satisfies ch. 5's sitemap submission requirement.
- Hierarchical, parameter-free URLs are the natural output of a pre-rendered static build (ch. 6).
- The site is a genuine informational asset that doesn't sell — ch. 10's "build trust first" position, currently by circumstance rather than strategy.

**Where CalmBeach does not**
- **Titles and metas at 9,474-page scale are template output.** Unless deliberately varied they will be near-duplicates across regions, which is precisely the "unique per page" requirement of ch. 6. Highest-yield audit available right now: sample 30 pages, check title length ≤ ~70 chars, metas ≤ ~160, and genuine uniqueness.
- **Intent classification per page type has not been done.** "παραλίες Ρόδου" and "Myrtos beach" and "beaches near me with no wind" are three different intents; the book (ch. 10) says the SERP tells you which, and CalmBeach hasn't asked.
- **No pillar pages, no deliberate internal-link clusters.** 9,474 pages linked mainly by template navigation is not the pillar/cluster structure of ch. 6; it also leaves crawl depth uncontrolled.
- **~1,421 photo-less beach pages** fail his image and content-depth guidance (ch. 6) — and thin templated pages are a crawl-budget and quality liability at this scale.
- No informational content layer (how to read wind for swimming, when the meltemi blows, snorkelling guides) — the authority-building play of ch. 10, and the natural fit for a site that can't sell anything yet.
- hreflang across EN/EL/DE with partial German coverage is a real risk area the book never covers; it offers no help here beyond "don't change URLs".

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
- ~1,429 beaches carry photos — real progress on his image requirement.
- Three languages (EN/EL/DE) go well beyond the single-language site the book imagines, and match a tourist audience.
- The per-beach explanation of *why* a beach is recommended is ch. 4's "answer the question at the moment it arises", implemented as a product feature.

**Where CalmBeach does not**
- **~1,421 beaches with no photo.** By the book's own numbers (67% of decisions influenced by image quality, 80% remembered visually — ch. 6) these pages under-perform on both conversion and retention. Largest content gap, and the one with a clear, gradable path: photograph or license the top-traffic photo-less beaches first.
- **German is partial.** A half-localized language is worse than his either/or scenario, because a German visitor gets a broken experience rather than a foreign-language one.
- **No reviews, ratings or user experiences** anywhere — the trust mechanism he devotes most of ch. 4's statistics to. `[our note: on a safety-adjacent site, user reports of actual conditions are also the cheapest correction channel for bad data.]`
- No video, against his 82%-of-traffic argument (ch. 4).
- No editorial/informational writing at all beyond generated beach data — no guides, no local knowledge in prose, which is the specific asset ch. 2 and ch. 13 say beats the giants.

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
- Competitive position against beachesofgreece.com is known (~2,850 vs ~345 beaches).

**Where CalmBeach does not**
- **Search Console is not named anywhere in the project facts** — and it is the first thing the book asks for (ch. 5). Without it there is no impressions data, no CTR-vs-position analysis, no Coverage queue, no Links view. On a 9,474-page site that is flying blind. `[our note: if only one item from this whole file gets done, it's this one.]`
- **No CTR-vs-position work**, which is the specific high-yield analysis of ch. 5 and exactly what a title/meta rewrite should be driven by.
- **Zero-click risk is unassessed and unusually high here**: "beach weather" style queries are precisely what Google answers in-SERP. His PAA and local-pack CTR collapse figures (50% → 23% / 15%) apply directly (ch. 2).
- No keyword ceiling estimate — the site was built without knowing whether the demand exists at the volume assumed (ch. 2).
- No named traffic channel strategy; the book insists you identify which channel actually works and concentrate there (ch. 1).
- Analytics measure visits, not the "questions visitors need answered" (ch. 13) — no query-level or search-behaviour insight loop into content decisions.

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
- **No conversion event exists at all**, so the ch. 12 ROI calculation cannot be performed, and the 12–18-month affiliate plan has no baseline to be forecast from.
- **No page has a defined next step** (ch. 1, ch. 4) — which is a monetisation blocker, not just a product one: affiliate links added later to pages with no measured outbound behaviour will be guesswork.
- The founder's own time — the largest real cost, and one the book insists on counting (ch. 12) — is not tracked.
- `[our note: the book's cheapest applicable idea here is measurable intent-to-leave: instrument outbound clicks (directions, ferry search, accommodation) now, with no affiliate deal in place. In 12 months that dataset is what makes an affiliate conversation possible.]`

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
- Nothing substantive. The site is one-directional today.

**Where CalmBeach does not**
- **No feedback channel of any kind.** For a **safety-adjacent** site built on third-party OSM data, this is the highest-severity gap in this entire file after Search Console: the people standing on the beach are the only cheap source of ground truth about whether the data is right, and they have no way to tell you.
- No reviews or user-reported conditions — the whole trust apparatus of ch. 4 is absent, and it happens to be the thing beachesofgreece.com also lacks (an opening).
- No contact route (ch. 4), no retention mechanism, no community presence anywhere (ch. 1, ch. 3).
- `[our note: the minimum viable version is one "report a problem with this beach" link per page going to an inbox. Hours of work, and it converts a passive dataset into a correcting one.]`

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
- Netlify + Cloudflare + a static build sits at or below his minimal band — cheaper than the €200–300 minimum and much cheaper than €10–20/month hosting, for 9,474 pages.
- "Start simply and upgrade on evidence" describes the stack accurately: no CMS, no database, no premium plugins.
- No theme churn: one React + Vite codebase.

**Where CalmBeach does not**
- **The founder's hours are not counted as cost**, and the book is explicit that they must be (ch. 12). Weekend-only capacity is the binding constraint on everything in this file; without tracking it, prioritisation is guesswork.
- **No quota/cost ceiling monitoring** for the weather API, Netlify build minutes, or function invocations. Peak-August traffic is the moment a free tier becomes either a bill or an outage.
- The ROI calculation can't be run at all, because the benefit side is undefined (see 13).

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
- Clean crawl surface: 9,474 pre-rendered pages, so nothing depends on Google executing JavaScript to index content.
- JSON-LD on 9,465 pages is a strong implementation of "help search engines understand your structure" (ch. 10).
- calmbeach.gr is a fresh domain, no inherited-penalty exposure (ch. 12).
- Zero black-hat exposure: no paid links, no link schemes, no manipulation (ch. 9).

**Where CalmBeach does not**
- **Search Console appears to be absent** — the one Google-side tool the book treats as mandatory (ch. 5). Without it, Coverage errors and the 9 pages lacking JSON-LD are invisible, and so is the actual index count against the 9,474 expected.
- **Zero-click exposure is structurally high** and unmeasured. Weather-type queries are exactly what Google answers itself, and local packs and PAA are common on beach queries — his mobile figures (rank-1 CTR 50% → 23% with PAA, → 15% with local pack, ch. 2) apply straight to this niche.
- **Safety-adjacent content raises a bar the book never discusses.** Google's quality guidance treats content that affects people's health and safety differently, and the book gives no help there — this is exactly where `google-official-docs.md` must lead.
- No Google Business Profile (not obviously applicable — no physical location — but the 46%-local-intent figure of ch. 11 says local surfaces matter to this audience).
- hreflang handling for EN/EL/DE and partial German is a real Google-side risk the book does not address at all.

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
*Το CalmBeach:* το περιεχόμενο 9.474 σελίδων παράγεται από dataset και templates. Δεν είναι γραμμένο ούτε από τον ιδιοκτήτη ούτε από επαγγελματία.
*Δίκαια:* με 2.850 παραλίες, το χειρόγραφο περιεχόμενο είναι φυσικά αδύνατο για έναν άνθρωπο. Αλλά το βιβλίο θα έλεγε ότι οι ~1.421 σελίδες χωρίς φωτογραφία και χωρίς πρωτότυπο κείμενο δεν περνούν τον πήχη ποιότητας (κεφ. 4, κεφ. 6) — και εκεί δεν έχει άδικο.

**4. Το rank #1 ως «ουτοπία» — αλλά εμείς στοιχηματίσαμε σε 9.474 σελίδες.**
*Το βιβλίο:* μην κυνηγάς το rank #1, το 66% των αναζητήσεων δεν δίνει κλικ, διάλεξε λίγες μάχες που μπορείς να κερδίσεις και να μετατρέψεις (κεφ. 2 · /before-start).
*Το CalmBeach:* η στρατηγική είναι μαζική κάλυψη — μία σελίδα για κάθε παραλία και περιοχή.
*Δίκαια:* η μαζική κάλυψη είναι στην πραγματικότητα εφαρμογή της αρχής του «μία ποιοτική σελίδα ανά σημαντικό query» (κεφ. 10), και σε long-tail queries με μικρό ανταγωνισμό είναι λογική. Όμως ο συγγραφέας θα ρωτούσε: ποιο είναι το conversion; Χωρίς απάντηση, οι 9.474 σελίδες είναι κίνηση χωρίς αποτέλεσμα με τα δικά του κριτήρια.

**5. Λίγες επιλογές μετατρέπουν καλύτερα — εμείς δίνουμε explore mode με 7 φίλτρα.**
*Το βιβλίο:* το paradox of choice είναι πρόβλημα conversion — 24 επιλογές έδωσαν 3%, 6 επιλογές έδωσαν 30% (κεφ. 7 · /optimize-ux).
*Το CalmBeach:* Top 3 (σωστό κατά το βιβλίο) αλλά και explore mode με όλες τις κατάλληλες παραλίες και 7 φίλτρα.
*Δίκαια:* διαφορετικοί χρήστες θέλουν διαφορετικά πράγματα, και τα φίλτρα εξυπηρετούν αυτόν που ξέρει τι ζητά. Αλλά ο συγγραφέας θα έλεγε ότι για τον τουρίστα που δεν ξέρει την περιοχή — τον βασικό χρήστη — κάθε επιπλέον επιλογή είναι καθυστέρηση.

**6. Google My Business / πλατφόρμες — εμείς είμαστε μόνο στο site.**
*Το βιβλίο:* μη διαλέγεις μεταξύ site και πλατφορμών, κράτα και τα δύο, και δώσε προτεραιότητα στους δυνατούς παίκτες του κλάδου σου (κεφ. 11 · /optimize-use-other-platforms).
*Το CalmBeach:* καμία παρουσία εκτός του site.
*Δίκαια:* το CalmBeach δεν έχει φυσική τοποθεσία ούτε προϊόν να πουλήσει, οπότε τα παραδείγματά του (Skroutz, Booking, GMB) δεν εφαρμόζονται άμεσα. Αλλά η γενική αρχή — να είσαι εκεί που είναι ήδη το κοινό σου — μένει αναπάντητη.

---

## Τα 5 πράγματα από το βιβλίο που θα άλλαζαν κάτι σήμερα

Για solo founder, μέσα στη σεζόν, με ώρες Σαββατοκύριακου. Από το πιο πολύτιμο προς το λιγότερο.

**1. Στήσε Google Search Console τώρα (κεφ. 5 · /search-engines).**
Μία ώρα δουλειάς: επαλήθευση με DNS, υποβολή sitemap. Είναι το πρώτο πράγμα που ζητά το βιβλίο και το μόνο που μας λείπει εντελώς. Χωρίς αυτό δεν ξέρουμε πόσες από τις 9.474 σελίδες είναι πραγματικά indexed, ούτε ποια queries φέρνουν impressions, ούτε πού είμαστε ορατοί αλλά δεν μας κλικάρουν. Κάθε άλλη απόφαση SEO είναι εικασία μέχρι να μπει αυτό — και είμαστε μέσα στη σεζόν, δηλαδή τώρα υπάρχουν τα δεδομένα.

**2. Βάλε ένα «report a problem» link σε κάθε σελίδα παραλίας (κεφ. 3 · /starting-the-journey, κεφ. 4 · /website).**
Λίγες ώρες. Το βιβλίο λέει να δέχεσαι σχόλια και προτάσεις για να βρίσκεις ανάγκες που δεν καλύπτεις. Στη δική μας περίπτωση είναι πιο σοβαρό: το περιεχόμενο αφορά ασφάλεια, τα δεδομένα είναι από OpenStreetMap και δεν έχουν επαληθευτεί, και ο μόνος φθηνός έλεγχος είναι ο άνθρωπος που στέκεται στην παραλία. Σήμερα δεν έχει πού να το πει.

**3. Μία γραμμή value proposition πάνω από το fold (κεφ. 4 · /website, κεφ. 7 · /optimize-ux, κεφ. 13 · /closing).**
Μισή ώρα. Ο επισκέπτης έχει 2-3 δευτερόλεπτα για να καταλάβει τι είναι το site και 8 για να αποφασίσει αν μένει. Το μοντέλο έκθεσης στον άνεμο — αυτό που δεν έχει κανένας άλλος — δεν αναφέρεται πουθενά που να το διαβάσει κάποιος που μπαίνει πρώτη φορά. Το διαφορετικό μας υπάρχει στο προϊόν αλλά δεν λέγεται.

**4. Έλεγξε 30 τυχαίες σελίδες για titles και meta descriptions (κεφ. 6 · /optimize-onsite).**
Δύο-τρεις ώρες. 60-70 χαρακτήρες για title, 155-160 για meta, και — το κρίσιμο — μοναδικά ανά σελίδα. Σε 9.474 templated σελίδες, ένα λάθος στο template είναι 9.474 σχεδόν ίδιοι τίτλοι. Είναι η πιο φθηνή διόρθωση με το μεγαλύτερο εύρος στο site, και αν το #1 μπει πρώτο, θα σου δείξει το Search Console ποιες σελίδες αξίζει να διορθώσεις πρώτες.

**5. Μέτρα τα outbound clicks και τα Core Web Vitals σε p75 mobile (κεφ. 1 · /abstract, κεφ. 8 · /optimize-speed, κεφ. 12 · /cost).**
Μισή μέρα. Δύο πράγματα, ίδια λογική: σταμάτα να είσαι στα τυφλά σε ό,τι έχει χρήματα από πίσω. (α) Κάθε σελίδα πρέπει να έχει «επόμενο βήμα» — κατέγραψε από τώρα τι πατάει ο κόσμος για να φύγει (χάρτης, οδηγίες, διαμονή), γιατί σε 12-18 μήνες αυτό είναι το μόνο δεδομένο που κάνει εφικτή μια συζήτηση για affiliates. (β) Το pre-rendering λύνει το πρώτο paint αλλά όχι το κόστος hydration του React σε μέτριο Android με 4G στην παραλία — και το βιβλίο δίνει νούμερα (BBC: -10% χρήστες ανά επιπλέον δευτερόλεπτο) που δείχνουν πόσο ακριβό είναι αν χαλάει.
