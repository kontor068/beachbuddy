# Beach Buddy — Codex Project Instructions

Beach Buddy is a mobile travel app for Greece that helps tourists answer one question:

“Which beach should I go to today?”

The app recommends the Top 3 best beaches based on:
- wind direction
- wind speed
- beach orientation
- wave height
- weather conditions
- sea conditions
- user preferences
- distance from user
- beach amenities

## Product goal

The product must help tourists choose the best beach today in under 10 seconds.

The first version focuses only on Greece.

Primary users are tourists who:
- do not know the area
- want calm water
- want to avoid wind
- want a great beach experience
- need simple, trustworthy recommendations

## Core MVP features

The MVP should focus on:
1. Top 3 beach recommendations for today
2. Explore all suitable beaches
3. Beach search by Greek region or island
4. Basic filters:
   - sandy
   - pebbles
   - quiet
   - beach bar
   - family friendly
   - snorkeling
   - amenities
5. Beach detail page
6. Map view
7. AI-style explanation for why each beach is recommended

## Product principles

- MVP first.
- Keep the app extremely simple.
- Avoid feature creep.
- Prioritize clarity over completeness.
- Every recommendation must explain WHY the beach is suitable today.
- Never make the user interpret complex weather data.
- Translate technical conditions into simple tourist language.
- Do not build vanity features unless they improve the beach decision.

## UX principles

- Mobile-first.
- Minimal steps.
- Clear recommendation cards.
- Calm, premium travel feeling.
- Map should support the decision, not dominate the experience.
- Weather and sea conditions must be understandable at a glance.
- The home screen should immediately answer: “Where should I go today?”

## Recommendation logic principles

The beach scoring system should be transparent and debuggable.

Prefer simple MVP scoring before complex ML.

The scoring system should consider:
- wind direction
- wind speed
- beach orientation
- wave height
- swell direction if available
- temperature
- cloud cover
- rain probability
- beach protection
- user preferences
- distance from user
- amenities

Every score should produce:
- total suitability score
- category scores
- explanation bullets
- warning flags
- top reasons why recommended

## Engineering principles

- Make small, safe changes.
- Do not rewrite large parts of the app unless explicitly asked.
- Before coding, inspect the existing structure.
- Reuse existing components when possible.
- Keep code readable and easy to maintain.
- Avoid unnecessary dependencies.
- Do not add new dependencies without explaining why.
- Keep logic testable and debuggable.
- After changes, run relevant lint, typecheck, test, or build commands if available.

## Codex workflow rule

When asked to build a feature, first produce:
1. brief plan
2. files likely to change
3. risk assessment
4. implementation steps

Then make focused changes only.

## Definition of done

A task is done only when:
- the implementation is focused
- unrelated files are not changed
- the behavior is explained
- testing steps are provided
- remaining risks are listed
