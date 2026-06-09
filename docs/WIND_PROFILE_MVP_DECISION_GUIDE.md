# CalmBeach Wind Profile MVP Decision Guide

This document captures the MVP decision for wind profiles, beach exposure, map colors, and scoring philosophy.

Core rule:
Use a simple rule first. Add smart corrections after. Do not turn CalmBeach into a geology, GIS, or oceanography platform before the core beach recommendation works well.

The app should answer one tourist question quickly:

> It is windy today. Which beach is likely to be more manageable?

## Product Position

CalmBeach is not trying to predict the sea like a port authority or oceanographic model.

For MVP, it should say:

> Based on today's wind, beach exposure, and available confidence, these are likely the better options.

This is useful, honest, and achievable.

Avoid wording that implies certainty:

- always calm
- guaranteed protected
- safe
- perfect
- ideal in strong wind

Prefer cautious wording:

- more manageable
- likely better than open beaches
- better available option today
- conditions appear relatively milder here

## Simple-But-Smart Model

The correct MVP balance is:

> Wind direction gives the first answer. Beach morphology corrects that answer.

Do not use a naive rule such as:

> South wind means all north-facing beaches are good.

Use this instead:

> South wind gives north-facing beaches an advantage, but final suitability is corrected by shelter, exposure, bay shape, known exceptions, wind strength, and waves.

## Base Logic

Start with:

- current wind direction
- current wind strength / Beaufort
- beach-facing direction

Then apply modifiers:

- shelter bonus
- exposure penalty
- strong-wind penalty
- wave penalty
- known local exception adjustment
- confidence cap or downgrade

Example scoring shape:

```ts
finalScore =
  windVsOrientationScore
  + shelterBonus
  - exposurePenalty
  - strongWindPenalty
  - wavePenalty;
```

Example MVP rules:

```ts
if (windHitsBeachDirectly) score -= 35;
if (windHitsBeachSideways) score -= 15;
if (beachIsProtectedBay) score += 20;
if (beachIsOpen) score -= 15;
if (windBft >= 5) score -= 20;
if (waveHeight > 0.7) score -= 20;
```

These numbers are illustrative. Production values must be validated with the wind exposure validation scenarios before being treated as final.

## Color Rules

Map and recommendation colors should follow Beaufort-aware exposure behavior.

### 0-2 Bft

Light-wind beach mode.

- Most beaches can be shown as suitable unless waves, rain, winter conditions, or missing critical data create a real issue.
- Ranking should not be wind-led.
- Prefer tourist-ready factors: sea comfort, access, confidence, popularity, amenities, family fit, and preferences.

### 3-4 Bft

Normal to mild caution mode.

- Protected or less-exposed beaches can remain blue.
- Exposed, open, or partial beaches should usually become yellow.
- Avoid harsh warnings unless waves or local exposure justify them.

### 5-6 Bft

Protected-first / best-available mode.

- Protected or less-exposed beaches should usually be yellow, not presented as perfect.
- Exposed and open beaches should usually become orange.
- Open/high-fetch beaches should drop strongly in recommendations.
- Use wording such as "best available" or "more manageable", not "calm" or "ideal".

### 7+ Bft

No casual swimming recommendation mode.

- Do not show daily top recommendations or suitable-swimming recommendations for casual tourists.
- Use a clear no-swimming / no-ideal state.
- Map markers should be red.

## Exposure Interpretation

Use orientation as the base signal:

- If the beach faces into the incoming wind, it is more exposed.
- If the beach faces away from the incoming wind, it may be less exposed.
- If the wind is cross-shore, expect medium uncertainty and possible chop or drift.

Then correct with morphology:

- A protected bay can improve an otherwise exposed orientation.
- A wide open beach can downgrade an otherwise favorable orientation.
- A cove may reduce exposure, but should not automatically become "calm".
- A known wind/watersports spot should not be promoted as a calm/family option in 4-5+ Bft unless a specific, validated sheltered scenario supports it.

Important:
Offshore wind can make near-shore water look calmer, but it can also create drift risk. Do not translate offshore exposure into a user-facing "safe" claim.

## Recommended MVP Fields

For authoring and data review, a simple shape is acceptable:

```ts
{
  orientation: "S",
  exposure: "semi_protected",
  shape: "bay",
  protectedFrom: ["N", "NW", "NE"],
  exposedTo: ["S", "SE", "SW"],
  confidence: "medium"
}
```

For implementation and long-term consistency, prefer the structured `windProfile` shape:

```ts
{
  beachFacingDirection: "S",
  shelterLevel: "semi_sheltered",
  fetchExposure: "medium",
  protectedFromWindDirections: ["N", "NW", "NE"],
  exposedToWindDirections: ["S", "SE", "SW"],
  knownWindSportSpot: false,
  localWindAmplification: "unknown",
  confidence: "medium",
  notes: "South-facing beach; likely more manageable in north wind, but not guaranteed calm."
}
```

Prefer the structured shape when writing production data because it is easier to debug, validate, and extend without turning simple rules into string-rule clutter.

## Known Exceptions

Known exceptions should not be modeled as broad strings like:

```ts
knownRules: ["good_with_north_wind"]
```

That can become hard to validate as islands, beaches, wave cases, and confidence levels grow.

Prefer structured fields plus notes:

- `protectedFromWindDirections`
- `exposedToWindDirections`
- `knownWindSportSpot`
- `localWindAmplification`
- `confidence`
- `notes`

If a local exception is uncertain, keep it as low or medium confidence and write a validation note. Do not turn local knowledge into high-confidence truth too early.

## What Not To Build Now

Do not add these for the MVP unless there is a specific validated product need:

- geological maps
- sediment grain size
- satellite shoreline extraction
- bathymetry
- beach-face slope
- shoreline erosion models
- full GIS system
- PostGIS
- Google Earth Engine
- Copernicus / EMODnet pipelines

These may be useful later, but they should not come before accurate, understandable recommendations using the simple model.

## Implementation Order

Use this order:

1. Wind direction + beach-facing direction + Beaufort = base color and base score.
2. Add `shelterLevel`, `fetchExposure`, and open/semi-sheltered/sheltered modifiers.
3. Add known local exceptions with confidence and notes.
4. Add stronger validation scenarios for islands and edge cases.
5. Consider heavier geospatial or marine data only after the app has traction and the simple model has clear failure cases.

## Review Checklist

Before changing wind scoring or adding windProfile data, ask:

- Does this improve recommendation accuracy, trust, or clarity?
- Could this create a fake calm/protected/safe claim?
- Is confidence explicit?
- Is this based on data, geography, local knowledge, or only assumption?
- Does wave height or swell contradict the simple wind/orientation result?
- Does the color match the current Beaufort mode?
- Are we calling a beach "best available" when conditions are hard, instead of "excellent"?
- Can the user understand the recommendation in under 10 seconds?

