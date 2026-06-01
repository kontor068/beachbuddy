# Beach Buddy Critical Quality Gate

This is the internal safety check for Beach Buddy.

Its job is to answer one question before a change ships:

Can this change break beach trust, recommendations, critical data, or production build health?

It is intentionally simple. It does not use AI to invent fixes. It runs deterministic checks, reports problems, and blocks critical/high-risk failures.

## Commands

```bash
npm run quality:explain
npm run quality:beach-data
npm run quality:critical
npm run quality:auto
```

## What Each Command Does

`npm run quality:explain`

Prints what the quality gate checks and why. It does not run the checks.

`npm run quality:beach-data`

Runs only the beach/photo data validator.

It checks:
- missing or invalid beach ids
- missing English/Greek beach names
- missing, invalid, or non-Greece coordinates
- duplicate beach ids
- invalid `beachType`, `accessibility`, or `protectedFrom` values
- beaches marked `quiet` while also having a beach bar
- verified photos missing URL, license, license URL, or attribution

`npm run quality:critical`

Runs the full gate once.

It includes:
- beach/photo data validation
- wind exposure engine validation
- recommendation scenario validation
- static content safety audit
- TypeScript typecheck
- production build

`npm run quality:auto`

Runs the full gate with bounded retries, up to 3 attempts.

This is useful after generated data changes or when a previous step may have produced new output. It stops as soon as everything passes.

Important: this command does not rewrite beach facts, coordinates, weather claims, windProfile claims, or image rights.

## What Blocks The Gate

The gate should fail on:
- broken beach JSON
- duplicate beach ids
- missing or invalid coordinates
- invalid core beach enums
- verified photos without license/attribution data
- high-risk static copy claims, such as guaranteed calm/protected/safe/ideal wording
- wind exposure scenario failures
- recommendation scenario failures
- TypeScript errors
- production build errors

## What Does Not Block By Itself

These can be advisory unless they become critical:
- missing non-critical beach photos
- medium/low content audit findings
- Vite large chunk warnings
- low-confidence beach metadata that is clearly shown as low confidence

## Report

Every full gate run writes:

```text
.tmp/critical-quality-report.json
```

The report includes:
- whether the gate passed
- how many attempts ran
- every check result
- the tail of stdout/stderr for each check

`.tmp/` is ignored by git.

## Automatic CI

The same gate runs in GitHub Actions through:

```text
.github/workflows/quality.yml
```

It runs on:
- every pull request
- pushes to `main`
- pushes to `master`

The CI job installs dependencies with `npm ci` and then runs:

```bash
npm run quality:critical
```

If any critical check fails, the PR/deploy path should stay blocked until the issue is fixed or explicitly downgraded with a clear reason.

## Safe Fix Policy

Safe automatic fixes may be added later for mechanical issues only, such as formatting or duplicate generated labels.

Do not auto-fix:
- beach coordinates
- beach names
- wind shelter claims
- calm/protected/safe claims
- weather or marine data
- image license or attribution

Unknown is better than false certainty.
