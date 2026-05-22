# CalmBeach Validation Playbook

## 1. Purpose

Validation exists to protect the core CalmBeach product promise:
Recommend the right beach for today.
Correct beach prediction and recommendation comes first.

Validation should prevent:

- fake calm/protected claims
- over-warning on mild days
- under-warning on rough days
- confusing "best available" with "excellent day"
- static content conflicting with live weather
- local claims becoming false certainty
- unknown conditions becoming false certainty
- legacy `protectedFrom` being treated as verified live shelter
- broad changes without proof

Core rule:
Unknown is better than false certainty.
Legacy `protectedFrom` is only a weak fallback, never live proof.

## 2. Required validation commands

For recommendation, windProfile, weather, or content changes, normally run:

- `node scripts/validateWindExposureEngine.mjs`
- `npm run content:audit`
- `npm run lint`
- `npm run build`
- `git diff --check`

What each command protects:

- `node scripts/validateWindExposureEngine.mjs`: wind engine behavior, windProfile interpretation, and expected scenario outcomes.
- `npm run content:audit`: static content safety, especially avoiding static calm/protected/safe/ideal claims that conflict with live weather.
- `npm run lint`: code quality, typing/style issues surfaced by the project lint setup, and accidental mistakes in changed files.
- `npm run build`: build correctness and production readiness.
- `git diff --check`: whitespace and diff hygiene.

## 3. When visual QA is required

Visual screenshot QA is required when changes affect:

- `BeachCard`
- `TodayScoreBadge`
- `BeachConditionScore`
- `BeachDetailPage`
- `BeachMap` labels
- Day Planner wording
- condition chips
- recommendation explanation copy
- language/translations

Visual QA should check:

- top recommendation card
- conditions section
- day planner
- detail page
- map/list labels if affected
- Greek and English wording if applicable

## 4. Standard scenario types

Each island with windProfile work should ideally have:

### 1. normal 3 Bft

- should feel relaxed
- no strong warnings
- most beaches may be usable

### 2. 3 Bft choppy

- should show mild caution
- no rough/no-ideal language
- no wind-sport hard warning

### 3. 5 Bft north wind

- exposed north/open/high-fetch beaches should drop
- sheltered or more manageable options should rise
- wording should say best available / caution if conditions are hard

### 4. 5 Bft south wind when relevant

- south-facing beaches should receive caution
- north/west alternatives may rise if geography supports it

### 5. local exception scenario when relevant

- possible local exceptions may rank better
- must not create guaranteed calm/protected claims

## 5. Expected scenario report format

Use this format:

```text
Scenario:
Expected behavior:
Actual behavior:
Pass/fail:
Follow-up fix:
Remaining risk:
```

## 6. Current known scenario families

### Paros

- `Paros_N_3BFT`
- `Paros_N_3BFT_CHOPPY`
- `Paros_N_5BFT`

Expected:

- Χρυσή Ακτή, Πούντα, Τσερδάκια should not be calm/family top picks in 5 Bft north wind.
- At 3 Bft, wind-sport beaches should not be harshly penalized.

### Andros

- `Andros_N_3BFT`
- `Andros_N_3BFT_CHOPPY`
- `Andros_N_5BFT`

Expected:

- Συνετί should be worse than Πίσω Γυάλια in 5 Bft north wind.
- In 3 Bft, wording should not be scary.
- Choppy 3 Bft should say some chop, not perfect/rough.

### Milos

- `Milos_N_3BFT`
- `Milos_N_3BFT_CHOPPY`
- `Milos_N_5BFT`
- `Milos_S_5BFT`

Expected:

- Σαρακήνικο and Παπάφραγκας should not be calm top picks in 5 Bft north wind.
- Αχιβαδόλιμνη should show wind/watersports caution when relevant.
- Παπικινός may be more manageable as a local exception candidate, but not guaranteed calm.
- South-coast beaches should receive caution in 5 Bft south wind.

## 7. Red team checks

For every meaningful change, ask:

- Could this create a fake calm/protected claim?
- Could this over-warn users on mild days?
- Could this under-warn users on rough days?
- Could this confuse "best available option" with "excellent day"?
- Could static content contradict live weather?
- Did local knowledge become too confident?
- Did unknown become protected?
- Did one beach get promoted because of popularity instead of conditions?
- Did a UI label become misleading?

## 8. Validation by change type

### WindProfile changes

- run wind engine validation
- check 3 Bft and 5 Bft scenarios
- check confidence and false protected claims
- visual QA if recommendations visibly change

### Scoring changes

- must include before/after expected behavior
- validate mild/choppy/rough scenarios
- avoid weakening 5+ Bft safety behavior

### UI wording changes

- visual QA required
- ensure wording matches conditions
- check Greek/English consistency if applicable

### Static content changes

- run `content:audit`
- avoid "calm/protected/safe/ideal" as static live condition

### Weather/API changes

- validate fallback behavior
- ensure API failure does not break UI
- do not over-trust grid/offshore data as exact shoreline truth

### Dev fixture changes

- fixture values must match scenario meaning
- normal 3 Bft should not have choppy wave values unless fixture name says CHOPPY
- fixture mode must not affect production

## 9. Definition of validation done

Validation is done when:

- required commands pass
- scenario expectations are checked
- visual QA is done if UI changed
- remaining risks are written down
- no unrelated files were modified
- no false calm/protected/safe claims were introduced
