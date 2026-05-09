# Beach Buddy Codex Workflows

Reusable copy-paste prompts for building Beach Buddy with the project custom agents.

Each prompt follows the same rule:
- plan first
- implementation second
- summary last
- do not rewrite unrelated files

## 1. Planning The MVP

```text
Use the product_lead, ux_director, cto_architect, and qa_lead agents.

Goal:
Plan the Beach Buddy MVP. The app must help tourists answer:
"Which beach should I go to today?"
in under 10 seconds.

Focus on:
- Top 3 beach recommendations
- beach search by Greek region or island
- simple filters
- beach detail page
- map view
- clear explanation for each recommendation

Rules:
- Do not rewrite unrelated files.
- Do not implement anything until the plan is clear.
- Do not add unnecessary features.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 2. Creating The Data Models

```text
Use the cto_architect, geospatial_engineer, beach_scoring_scientist, and beach_content_director agents.

Goal:
Design the Beach Buddy data models for beaches, regions, weather conditions, user preferences, amenities, scoring, and recommendation explanations.

Include fields for:
- beach name
- island or region
- coordinates
- beach orientation
- wind protection
- terrain
- water depth
- amenities
- accessibility
- distance from user
- weather and sea condition inputs
- scoring outputs

Rules:
- Do not rewrite unrelated files.
- Do not add dependencies.
- Keep the MVP data model simple and extensible.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 3. Creating Mock Beach Data

```text
Use the beach_content_director, geospatial_engineer, and qa_lead agents.

Goal:
Create or improve mock beach data for Beach Buddy so the MVP can recommend beaches realistically.

The data should include:
- Greek beach names
- region or island
- coordinates
- beach terrain
- amenities
- accessibility
- natural shade
- organized or not organized
- wind protection directions
- water depth
- concise tourist-friendly descriptions

Rules:
- Do not rewrite unrelated files.
- Only modify the relevant data files.
- Keep data structured, consistent, and easy to review.
- Flag uncertain data instead of pretending it is verified.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 4. Building The Beach Scoring Engine

```text
Use the beach_scoring_scientist, weather_marine_expert, geospatial_engineer, cto_architect, and qa_lead agents.

Goal:
Build or improve the Beach Buddy scoring engine that ranks the Top 3 beaches for today.

The scoring should consider:
- wind direction
- wind speed
- beach orientation
- wave height if available
- sea conditions
- weather
- user preferences
- distance from user
- beach amenities

Every recommendation should produce:
- total suitability score
- category scores if practical
- simple explanation bullets
- warning flags
- top reasons why recommended

Rules:
- Do not rewrite unrelated files.
- Keep the MVP scoring transparent and debuggable.
- Avoid black-box ML.
- Do not add dependencies unless clearly justified.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 5. Building The Home Screen With Top 3 Beaches

```text
Use the ux_director, product_lead, mobile_engineer, beach_scoring_scientist, and qa_lead agents.

Goal:
Build or improve the Beach Buddy home screen so it immediately answers:
"Where should I go today?"

The home screen should show:
- selected location
- today's weather and wind context
- Top 3 beach recommendations
- clear explanation for each beach
- compact filters or preference entry point
- path to map and beach details

Rules:
- Do not rewrite unrelated files.
- Reuse existing components when possible.
- Keep the screen mobile-first and fast to understand.
- Do not add clutter or vanity sections.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 6. Building The Beach Detail Page

```text
Use the ux_director, mobile_engineer, beach_content_director, weather_marine_expert, and qa_lead agents.

Goal:
Build or improve the beach detail page for Beach Buddy.

The page should explain:
- why this beach is recommended today
- wind and sea conditions
- terrain
- water depth
- amenities
- access notes
- map location
- navigation action
- practical tourist tips

Rules:
- Do not rewrite unrelated files.
- Reuse existing UI components where possible.
- Keep the page clear and mobile-first.
- Avoid technical weather wording unless translated into tourist-friendly language.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 7. Building Filters

```text
Use the product_lead, ux_director, mobile_engineer, beach_scoring_scientist, and qa_lead agents.

Goal:
Build or improve Beach Buddy filters.

Filters should support:
- sandy
- pebbles
- quiet
- beach bar
- family friendly
- snorkeling
- deep water
- shallow water
- amenities
- accessibility if useful

Rules:
- Do not rewrite unrelated files.
- Keep filters compact on mobile.
- Do not make users configure too much before seeing recommendations.
- Filters should affect recommendation ranking or visible results clearly.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 8. Building Map View

```text
Use the geospatial_engineer, ux_director, mobile_engineer, beach_scoring_scientist, and qa_lead agents.

Goal:
Build or improve the Beach Buddy map view.

The map should:
- show recommended beaches
- show suitability score or status
- support beach selection
- show user location if available
- make distance understandable
- support the recommendation decision without dominating the app

Rules:
- Do not rewrite unrelated files.
- Keep map interactions simple on mobile.
- Avoid heavy map features that slow the MVP.
- Do not add dependencies unless clearly justified.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 9. Adding Weather API Integration Later

```text
Use the cto_architect, weather_marine_expert, beach_scoring_scientist, mobile_engineer, and qa_lead agents.

Goal:
Plan and then add weather API integration for Beach Buddy.

Weather data should support:
- wind direction
- wind speed
- gusts if available
- temperature
- cloud cover
- rain probability
- wave height if available
- swell direction if available
- sea condition interpretation

Rules:
- Do not rewrite unrelated files.
- Plan the API integration before coding.
- Keep API costs low for MVP.
- Handle missing or unreliable weather data gracefully.
- Do not expose secrets in source code.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```

## 10. QA Review Before Release

```text
Use the qa_lead, product_lead, ux_director, beach_scoring_scientist, weather_marine_expert, geospatial_engineer, and mobile_engineer agents.

Goal:
Perform a strict pre-release QA review of Beach Buddy.

Test the core promise:
"Can a tourist quickly choose the best beach today?"

Review:
- wrong or misleading recommendations
- wind and sea condition edge cases
- broken filters
- map accuracy
- location permission behavior
- mobile layout problems
- unclear Greek or English copy
- missing beach metadata
- slow loading
- confusing recommendation explanations

Rules:
- Do not rewrite unrelated files.
- Do not implement fixes until issues are clearly prioritized.
- Separate critical launch blockers from nice-to-have improvements.

Output:
1. Plan first
2. Implementation steps second
3. Summary last
```
