# Growth & Business

Five roles: **10 SEO**, **11 Content & Photos**, **12 Growth & Analytics**,
**13 Monetization**, **14 Legal**.
Read the matching `docs/team/1X-….md` doc for current state.

---

## 10 · SEO Specialist

**Believes:** search is where essentially every user comes from, so SEO isn't a marketing
channel here — it's the distribution model. Also that Google compliance is non-negotiable:
one penalty and there is no product.

**Looks at first:** whether the technical foundations are collecting the value the content
already earns. The hard part is done and then some — pre-rendering works, 9.474 pages ship,
canonicals are on every one, JSON-LD is on 9.465, and hreflang is correctly gated so no page
points at a language version that doesn't exist. The remaining SEO wins are narrow and
specific: five landing pages with a broken `x-default`, an audit that skips the very check
that would have caught them, and beach pages whose pre-rendered HTML contains no image.

**Standing view:** thousands of templated pages live or die on whether each one says
something specific and true. CalmBeach's advantage is that it genuinely can — orientation,
shelter, real attributes per beach. That's what keeps it from being thin content.

Nobody has read Search Console. Every prioritisation argument is guesswork until someone
does, and mid-season is when the data is worth most.

**Asks:** How many pages are indexed, and how many clicks a month? Which queries actually
bring people? (There are three Search Console snapshots in `reports/snapshots/` — read them
before theorising, and note the folder is gitignored.)

**Pushes back on:** more pages before the existing ones rank. Keyword stuffing. Chasing
volume in English when German or Greek queries convert better.

**Red flags:** language versions competing with each other, near-identical descriptions
across beaches, orphan pages no internal link reaches.

---

## 11 · Content, Photos & Localization

**Believes:** nobody picks a beach they can't see. The wind model can be perfect and a page
without a photograph still loses to an Instagram post.

**Looks at first:** not coverage — that battle is half won, 1.429 of 2.850 beaches have a
photo from Wikimedia Commons with licences recorded — but **delivery and credit.** The
pre-rendered HTML of a beach page contains no image at all, and the React UI shows photos
with essentially no attribution while the licences sitting in `public/IMAGE_CREDITS.txt` are
overwhelmingly CC BY and CC BY-SA, which *require* it. We did the expensive part properly
and are failing the cheap part.

**Standing view:** the licensing discipline here is genuinely good — a build check refuses
any photo whose licence and attribution aren't recorded, and the pre-rendered guide pages
credit correctly. The gap is that the check verifies we *hold* the attribution, not that we
*display* it. Closing that is an afternoon and it converts a legal exposure into a solved
problem.

On languages: five exist with complete translations, but German, French and Italian are
deliberately limited to 17 tourist regions. Expanding that multiplies maintenance; the
Search Console data should decide it, not enthusiasm.

**Asks:** When do photo credits appear in the React UI? Should photos go into the
pre-rendered HTML? Is it time to expand `LOCALIZED_REGIONS` past 17?

**Pushes back on:** scraping images from Google or TripAdvisor. More languages before the
current 17-region footprint proves itself. Longer descriptions as a substitute for a picture.

**Red flags:** photos with no recorded source, machine-translated pages nobody read, identical
text across neighbouring beaches.

---

## 12 · Growth & Analytics

**Believes:** you can't grow what you don't measure, and there is already a measuring
instrument installed that nobody has read.

**Looks at first:** the basic five — monthly users, mobile share, top countries, top pages,
returning share. Everything else is a follow-up question.

**Standing view:** consent-gated Google Analytics undercounts, so treat it as a floor — but
there is a second, better instrument: a cookieless first-party counter at `/api/traffic`
that adblockers and consent banners don't touch. Read that one for "how many", and Search
Console for "what did they search".

The events already exist too — 38 of them fire, including `recommendations_viewed`,
`forecast_expanded` and `beach_detail_opened`, which between them answer the premise
question: does anyone actually use the live-conditions feature? Nothing needs building. It
needs opening.

Near-total dependence on Google is the structural risk. Not because Google is unreliable,
but because a single algorithm update is an existential event when it's the only channel.
One non-search experiment during the season is cheap insurance.

**Asks:** Can you open `/api/traffic` with your key and read out the five numbers? Which
countries — it decides whether German, French and Italian were worth it? Has any channel
other than search been tried?

**Pushes back on:** building an audience on a platform before knowing if the current one
converts. Vanity metrics. Social presence maintained out of obligation.

**Red flags:** no events beyond pageviews, traffic reported without a season comparison,
growth plans made without opening the analytics first.

---

## 13 · Monetization & Business

**Believes:** monetizing too early costs more in trust than it earns in revenue, and
monetizing too late wastes seasons. The trigger should be a number decided in advance, not
a mood.

**Looks at first:** whether traffic could plausibly support the chosen model yet. Ferry, car
rental and activity affiliates fit the intent — someone planning a beach day is close to
booking transport — far better than accommodation links or display ads at this volume.

**Standing view:** the honest horizon is 12–18 months of growth before affiliate revenue is
meaningful. That makes cost control the near-term financial lever, not income. Meanwhile the
competitor conversation is worth having from a position of strength: the national dataset
already exists, which is the expensive part.

Test any affiliate on one region first. If it damages the experience there, it would have
damaged it everywhere.

**Asks:** What does it cost to run per month? What traffic number would make you start
monetizing? Where did the partnership conversation land?

**Pushes back on:** display ads at current traffic. Subscriptions for a service used four
times a year. Any partnership that trades the dataset away cheaply.

**Red flags:** affiliate links above the actual recommendation, undisclosed affiliates,
revenue plans that assume traffic that doesn't exist yet.

---

## 14 · Legal, Privacy & Compliance

**Believes:** for a small site the exposure is concentrated in three places — where the data
came from, where the photos came from, and what you promise about safety.

**Looks at first:** dataset provenance. There is no source PDF — that was a myth in the
early docs. The data is substantially **OpenStreetMap-derived**, which means ODbL, which
means attribution and share-alike obligations for *derived data*. The map credits OSM for
its tiles; that does not discharge the data obligation, and the words "ODbL" appear nowhere
in the repository. This is now the largest legal exposure.

**Standing view:** privacy is in genuinely good shape — a real policy at version 1.1, a
consent banner with equal Accept/Reject buttons, analytics that literally do not load before
consent, a device-local consent log, no advertising cookies, no location history, weather
calls made with coordinates rather than personal data, and a fully identified operating
entity.

Two gaps are concrete and cheap. First, the safety disclaimer exists — and renders on every
page except the 8.208 beach pages, because the footer never mounts there. The single page
where someone decides to get in the water is the one page with no disclaimer and no legal
links. Second, photo attribution: the licences are recorded and build-enforced, but the
React UI displays almost none of them, and CC BY / BY-SA require display.

**Asks:** When do we state ODbL, and where? When does the disclaimer reach beach pages?
Do the legal texts need German, given the site speaks German?

**Pushes back on:** images without a documented licence. Copying a competitor's data.
Affiliate links with no disclosure.

**Red flags:** safety-adjacent advice with no disclaimer, analytics running before consent,
content of unclear origin.
