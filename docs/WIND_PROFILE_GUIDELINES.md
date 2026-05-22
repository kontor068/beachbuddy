# CalmBeach Wind Profile Guidelines

## 1. Purpose

`windProfile` is the structured local exposure profile of a beach.

It helps CalmBeach understand:

- which winds affect the beach
- whether the beach is open or sheltered
- whether waves/chop may build up
- whether a beach is a known wind/watersports spot
- whether a beach is a local exception
- how confident we are

Core rule:
`windProfile` exists to improve recommendation accuracy, not to create false precision.
Correct beach prediction and recommendation comes first.

## 2. Required fields

### beachFacingDirection

What it means:
The main direction the beach faces toward the sea. This helps compare incoming wind and wave exposure with the beach orientation.

How it should be inferred:
Use coastline shape, map/satellite inspection, known beach orientation, and existing verified project data.

Sources that can support it:
Verified map geometry, official maps, nautical/local references, repeated local feedback, and current project data.

Mistakes to avoid:
Do not infer high confidence from coordinates alone. Do not assume a whole island side behaves the same way.

### shelterLevel

What it means:
How much natural protection the beach appears to have from relevant wind and wave exposure.

How it should be inferred:
Use bay/cove shape, surrounding land, headlands, open-water exposure, local behavior, and validation scenarios.

Sources that can support it:
Geospatial inspection, repeated local feedback, trusted local/nautical sources, and scenario validation.

Mistakes to avoid:
Do not label a beach protected because it is generally popular or visually enclosed. Do not use legacy `protectedFrom` as verified shelter.

### fetchExposure

What it means:
How much open water is available for wind-driven chop/waves to build toward the beach.

How it should be inferred:
Compare the beach-facing direction and likely wind directions with open sea distance, bay geometry, and nearby land protection.

Sources that can support it:
Map/satellite inspection, coastline geometry, marine context, local boating/watersports knowledge, and validation scenarios.

Mistakes to avoid:
Do not treat fetch as one universal value. Fetch is directional.

### exposedToWindDirections

What it means:
Wind directions that are likely to make the beach more uncomfortable, choppy, windy, or wave-exposed.

How it should be inferred:
Compare wind-from direction with beach orientation, open sea exposure, bay shape, and local behavior.

Sources that can support it:
Geospatial exposure, local feedback, wind/watersports references, marine data, and validation scenarios.

Mistakes to avoid:
Do not oversimplify to "north bad, south good" or the reverse. Do not overstate exposure without confidence.

### protectedFromWindDirections

What it means:
Wind directions where the beach may be more sheltered or more manageable because land or bay shape reduces exposure.

How it should be inferred:
Use landmass position, headlands, enclosed bays, local observations, and scenario behavior.

Sources that can support it:
Verified windProfile metadata, map inspection, repeated local feedback, official/local technical references, and validation.

Mistakes to avoid:
Do not turn "less exposed" into "calm." Do not use static beach descriptions as live weather truth.

### knownWindSportSpot

What it means:
Whether the beach is known for wind-dependent activities such as windsurfing or kitesurfing.

How it should be inferred:
Use repeated local knowledge, surf/kite school references, official/local tourism references, and visible beach use patterns.

Sources that can support it:
Surf/kite schools, local boating/watersports sources, official tourism pages, and repeated local feedback.

Mistakes to avoid:
Do not recommend known wind spots as calm/family swimming options in 4-5+ Bft unless a very specific sheltered scenario supports it.

### localWindAmplification

What it means:
Whether local terrain, bay funneling, capes, or island geometry can make wind feel stronger than the regional forecast suggests.

How it should be inferred:
Use local reports, known windy spots, terrain/channel effects, and repeated scenario behavior.

Sources that can support it:
Repeated local feedback, watersports/boater sources, official/local technical context, and validation scenarios.

Mistakes to avoid:
Do not invent amplification from a map alone. Mark uncertain cases as low confidence or unknown.

### confidence

What it means:
How reliable the windProfile claim is.

How it should be inferred:
Base confidence on evidence quality: verified data, clear geography, repeated local confirmation, and validation results.

Sources that can support it:
Current project code/data, validation scripts, repeated local feedback, official/local technical references, and geospatial inference.

Mistakes to avoid:
Do not make high confidence common. Do not let a plausible local story become verified truth.

### notes

What it means:
Short internal explanation of why the profile says what it says, including uncertainty and validation needs.

How it should be inferred:
Summarize evidence, local hypotheses, known exceptions, and unresolved risks.

Sources that can support it:
All evidence used for the profile, especially local feedback, map reasoning, and validation outcomes.

Mistakes to avoid:
Do not write user-facing marketing copy here. Do not hide uncertainty.

## 3. shelterLevel rules

### open

- exposed to open sea or dominant wind/fetch
- should receive penalties in 4-5+ Bft when exposed
- must not be described as protected

### semi_sheltered

- some natural shape/land protection
- may be better than open beaches
- does not automatically mean calm
- user wording should be cautious

### sheltered

- clear geographic protection from relevant wind direction
- can be relatively favored in 4-5 Bft
- still must consider wave height and swell

### very_sheltered

- rare
- strong natural protection / enclosed bay behavior
- high confidence only with strong evidence

### unknown

- use when exposure is unclear
- must not create protected/calm claims

## 4. fetchExposure rules

### low

- limited open water for waves to build
- often bay/cove/harbor-like, but still check local context

### medium

- some open water exposure
- can become choppy under stronger winds

### high

- open sea exposure
- strong penalty with onshore 4-5+ Bft

### unknown

- use when unsure

Important:
Fetch is directional. A beach can have low fetch for one wind direction and high exposure for another.

## 5. wind direction rules

- Wind direction means where wind comes from.
- Compare wind direction with beach exposure.
- Onshore winds usually create more chop/waves.
- Offshore winds can look calmer near shore but may create drift risk.
- Cross-shore winds can create uncomfortable chop/drift.
- Do not oversimplify north/south logic.

## 6. Beaufort interaction

- 0-3 Bft = normal mode
- 4 Bft = caution mode
- 5+ Bft = protected-first / best available option mode
- 6+ Bft = avoid open beaches for casual/family swimming

Rules:

- At 0-3 Bft, avoid over-penalizing exposed beaches.
- At 4 Bft, start meaningful penalties for open/high-fetch beaches.
- At 5+ Bft, open/high-fetch beaches should drop strongly.
- At 5+ Bft, more sheltered beaches may become "best available", not necessarily "excellent".

## 7. Confidence rules

### high

- rare
- verified by strong evidence
- clear geography plus repeated/local confirmation
- should be used sparingly

### medium

- defensible from geography and available evidence
- useful but not absolute
- safe user wording should still avoid certainty

### low

- plausible but uncertain
- local hypothesis or limited evidence
- must not create protected/calm claims

### unknown

- no reliable basis
- no claim

Core rule:
Unknown is better than false certainty.

## 8. Known wind/watersports spots

If `knownWindSportSpot` is true:

- do not recommend as calm/family swimming in 4-5+ Bft
- add wind/watersports caution when relevant
- do not label as protected/calm unless a very specific scenario supports it
- keep warnings proportional in 0-3 Bft

Examples:

- Χρυσή Ακτή Πάρου
- Πούντα Πάρου
- Αχιβαδόλιμνη Μήλου

## 9. Local exceptions

Local exceptions are beaches that behave differently from generic geography.

Examples:

- Παπικινός Μήλου may be more manageable in north wind because of Adamas bay influence.
- This must remain a hypothesis unless verified.
- Do not make it high confidence too early.
- Do not say guaranteed calm.

Required handling:

- confidence low or medium
- notes explaining the hypothesis
- validation scenario if possible
- cautious user wording

## 10. Dangerous overclaims

Never create user-facing claims like:

- always calm
- always protected
- safe
- guaranteed sheltered
- ideal in strong wind
- perfect conditions

Prefer:

- more manageable
- likely better than open beaches
- can be a better available option
- conditions appear relatively milder here

## 11. Examples

### Χρυσή Ακτή Πάρου

- known wind spot
- open/high exposure
- not calm recommendation at 4-5 Bft

### Πίσω Γυάλια Άνδρου

- can be better available option in north wind
- still use caution if sea is rough

### Συνετί Άνδρου

- open/exposed behavior with north wind
- should not be treated like Πίσω Γυάλια

### Παπικινός Μήλου

- possible local exception in north wind
- low/medium confidence only
- no guaranteed calm claim

### Σαρακήνικο Μήλου

- famous north-coast spot
- not default calm-swimming pick in meltemi

### Αχιβαδόλιμνη Μήλου

- wind/kite caution
- avoid calm/family recommendation in strong north wind

## 12. Review checklist before adding a windProfile

Before adding or updating a windProfile, answer:

- What wind directions affect this beach?
- What wind directions may be better?
- Is this based on geography, local knowledge, or both?
- What is the confidence?
- Could this create a false protected/calm claim?
- Does it need validation scenario?
- Is there a known local exception?
- Is there a known wind/watersports behavior?
- What should the user-facing wording be?

## 13. Validation expectation

Any meaningful windProfile update should normally run:

- `node scripts/validateWindExposureEngine.mjs`
- `npm run content:audit`
- `npm run lint`
- `npm run build`
- `git diff --check`

If it affects visible recommendations, visual QA should follow.
