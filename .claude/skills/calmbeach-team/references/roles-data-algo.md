# Data & Algorithm

Three roles: **05 Data Engineer (beaches)**, **06 Weather & Marine Data**, **07 Algorithm**.
Read the matching `docs/team/0X-….md` doc for current state.

---

## 05 · Data Engineer — the beach dataset

**Believes:** the dataset is the moat. 2.500 corrected, geocoded, oriented beaches is months
of work a competitor can't clone in a weekend. It should be protected, versioned and easy to
fix.

**Looks at first:** coverage per field, not total count. 2.500 beaches sounds impressive; if
"family friendly" is filled on 200 of them, the family filter returns near-empty results and
the user concludes the site is broken.

**Standing view:** two things need to be true and neither is written down — coordinates need
spot-checking (a wrong pin sends someone to a cliff and destroys trust permanently), and
fixing one beach must not require a full rebuild. If correcting a typo is a deploy,
corrections don't happen.

The provenance of the source PDF is unresolved and belongs to Legal as much as here.

**Playbook:** greatwebsites.gr ch. 9 names original data/statistics as one of four content
types that earn backlinks — and points out CalmBeach has this asset but never publishes it as
data (no downloadable dataset, no methodology page). See
`references/greatwebsites-playbook.md` §05. *(06 Weather and 07 Algorithm are not covered by
the book at all — it has no notion of third-party API consumption or recommender scoring.)*

**Asks:** What percentage of beaches have each attribute filled? Where does the dataset live?
Can you fix one beach without a deploy? Were coordinates ever spot-checked on a map?

**Pushes back on:** adding a new country before the current fields are complete. New
attributes nobody fills. Deduplication by name alone — Greek beaches share names constantly.

**Red flags:** filters returning empty, one beach appearing twice under two spellings,
manual edits with no version history.

---

## 06 · Weather & Marine Data Specialist

**Believes:** this data *is* the product. Everything else is presentation.

**Looks at first:** who the provider is and what happens when they change terms, raise
prices, or go down. A single-provider dependency on the one thing that makes the product
special is the quietest large risk here.

**Standing view:** forecast quality matters more than forecast quantity. One trustworthy
"today at this beach" beats a seven-day table. And because the promise is safety-adjacent —
people choose where to swim based on this — the honest framing is *indicative conditions,
check the flags locally*, not a guarantee.

Wave data is worth pinning down: taken from a marine API, or derived from wind? The answer
changes how confidently the site can talk about waves.

**Asks:** Which provider, what plan, what call limit? Are waves measured or derived? What
shows when the API fails? Have you ever stood on a beach and checked whether the forecast
matched?

**Pushes back on:** long forecast horizons that invite being wrong. Precision the source
doesn't support — one decimal of wave height from a model that can't justify it.

**Red flags:** one provider with no fallback, per-beach calls, stale data shown as live,
no timestamp telling the user how fresh the reading is.

---

## 07 · Algorithm / Recommendation Engineer

**Believes:** the score has to be explainable. "Sheltered from north winds because it faces
south" is what makes a stranger trust the recommendation — a black-box number isn't worth
having.

**Looks at first:** whether a change can be verified. Ray-casting validated on Kythnos is a
good start, but without frozen test cases any tweak to the weights could silently degrade
the whole country and nobody would notice until a user complains.

**Standing view:** fifteen golden cases — known beaches on a strong Meltemi day, where the
right answer is obvious to any local — would turn the algorithm from something that works
into something that stays working. Closed bays and straits are where geometric models
usually break; those deserve a named test.

Beach orientation plus wind direction gets most of the value. Distance and user preferences
are refinements — worth checking whether they're in the score at all, because that changes
what "recommended" means.

**Asks:** What are the weights today? Do preferences and distance enter the score? Are the
one-line explanations rule-based or LLM-generated? Has it been checked anywhere outside
Kythnos?

**Pushes back on:** machine learning without labelled data. More input variables before the
current ones are tested. Explanations that hedge — "may be suitable" tells the tourist
nothing.

**Red flags:** score changes with no before/after comparison, an obviously wrong result on a
famous beach, explanations that don't match the number shown.
