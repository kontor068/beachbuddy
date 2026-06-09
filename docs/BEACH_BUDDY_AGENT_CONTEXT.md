# CalmBeach Agent Context

## 1. Product identity

The product is now called CalmBeach.

CalmBeach is a Greece-focused beach recommendation app.

Its core question is:

"Which beach should I go to today?"

The app is not just a generic beach directory.
The app is not just a weather app.
The core value is recommending the right beach for today based on real conditions.

## 2. Primary user

The main user is:

- tourist
- family
- casual swimmer
- person who does not know local winds
- person who wants calm water, simple advice, and low hassle

The user does not want complex meteorology.
The user wants a simple, trustworthy recommendation.

## 3. Main product rule

The most important rule:

First priority:
Correct beach prediction and recommendation.

Do not add complexity unless it improves:

- recommendation accuracy
- user trust
- clarity
- safety/caution handling

Avoid overengineering.

The app should feel simple to the user even if the logic behind it is sophisticated.

## 4. What the app must not do

The app must not falsely claim that a beach is:

- calm
- protected
- safe
- ideal
- perfect

unless the available data supports it.

The app must not use static beach descriptions as live weather truth.
The app must not use legacy protectedFrom as verified shelter.
The app must not turn local folklore into high-confidence truth.
The app must not confuse "best available option today" with "excellent beach day."

## 5. Recommendation logic

The app should combine:

- live weather
- Beaufort
- wind direction
- gusts
- wave height
- swell if available
- beach windProfile
- geospatial exposure
- local beach knowledge
- confidence level
- user preferences

The key logic is:

weather + beach exposure + local behavior + confidence = recommendation

## 6. Beaufort behavior

Use this as the simple operating model:

- 0-2 Bft = relaxed beach mode
  Most beaches can be usable, unless waves/local exposure say otherwise.

- 3 Bft = normal beach mode with a useful top pick
  Most beaches can still be usable, but beach exposure starts to matter enough to recommend the better option.

- 4 Bft = caution mode
  Open/high-fetch beaches start getting meaningful penalties.

- 5+ Bft = protected-first / best available option mode
  The app should prefer more sheltered or more manageable options.
  Exposed beaches should not be calm/family recommendations.

- 6+ Bft = avoid open beaches for casual/family swimming
  The app should be conservative.

## 7. Source-of-truth hierarchy

Agents should trust sources in this order:

1. Shared project docs and current project code
2. Live weather/marine data for current conditions
3. Verified windProfile metadata
4. Validation scripts and dev weather scenarios
5. Local knowledge with explicit confidence
6. Geospatial inference
7. Legacy protectedFrom only as weak fallback
8. Static beach descriptions never override live weather

Important:
Unknown is better than false certainty.

## 8. Confidence rules

Use confidence carefully.

- high = rare, verified, or very clear
- medium = defensible but not absolute
- low = plausible but uncertain
- unknown = no claim

High confidence should be rare.

If information is uncertain, agents must not create strong user-facing claims.

## 9. Local knowledge rules

Local knowledge is valuable but not automatically fact.

Local feedback should become:

local feedback
-> hypothesis
-> confidence
-> possible windProfile update
-> validation scenario

Example:
"Papikinou in Milos may be more manageable in north wind."

This should not become:
"Papikinou is always calm."

Safe internal handling:

- local hypothesis
- confidence: low or medium
- notes
- validation needed

Safe user wording:
"Με βάση τον σημερινό άνεμο, αυτή φαίνεται από τις πιο διαχειρίσιμες επιλογές."

## 10. Internal truth vs user wording

Internal language can include:

- confidence: low
- unknown
- local hypothesis
- needs review
- weak fallback

But user-facing wording must be human and not debug-like.

Do not show users:

- "χρειάζεται τοπική επιβεβαίωση"
- "low confidence"
- "unknown fetch"
- "needs verification"

Prefer user-facing uncertainty like:

- "Με βάση τον σημερινό άνεμο, αυτή φαίνεται από τις πιο διαχειρίσιμες επιλογές."
- "Οι συνθήκες φαίνονται σχετικά πιο ήπιες εδώ σε σχέση με πιο εκτεθειμένες παραλίες."
- "Πιθανόν καλύτερη επιλογή σήμερα, ειδικά αν θέλεις να αποφύγεις τον αέρα."
- "Καλή επιλογή σήμερα, αλλά η θάλασσα μπορεί να μην είναι τελείως ήρεμη."

## 11. Wording principles

Good/easy day:

- "Best swimming time today"
- "Good conditions"
- "Wind should not be a major issue"

Mild choppy day:

- "Good time to swim, but expect some chop."
- "Conditions should be manageable, though the sea may not be completely flat."

Hard/caution day:

- "Best available option today"
- "More manageable option today"
- "No ideal swimming window today"
- "Not ideal for calm swimming"

Avoid:

- "perfect" unless conditions are truly easy
- "safe" unless referring to official safety infrastructure
- "protected" unless windProfile supports it
- "calm" unless current conditions support it

## 12. Agent workflow

For non-trivial work, agents should follow this workflow:

1. Read this shared context.
2. Understand the task.
3. Choose only the agents needed.
4. Inspect the relevant project files.
5. Use confidence levels.
6. Produce a plan first.
7. Wait for approval if the task changes logic, data, API, or UI behavior.
8. Implement only the approved scope.
9. Run validation.
10. Report remaining risks.

## 13. Validation expectation

For wind/recommendation/content changes, normally run:

- `node scripts/validateWindExposureEngine.mjs`
- `npm run content:audit`
- `npm run lint`
- `npm run build`
- `git diff --check`

If UI wording or visual behavior changes, visual screenshot QA is also required.

## 14. Definition of done

A change is done only when:

- it improves recommendation accuracy, trust, or clarity
- it does not create fake calm/protected/safe claims
- uncertain data remains cautious
- validation passes
- no unrelated files are modified
- user-facing wording matches the actual conditions
