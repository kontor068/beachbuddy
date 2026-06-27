# Condition-feedback loop (roadmap #7)

The app has no backend, so the loop is split into a **live capture** half (in the app) and an
**offline calibration** half (run by hand over exported data).

## Capture (live, shipped)
The beach detail page asks "How accurate was our forecast?" with four structured verdicts:
`accurate` · `had_waves` · `too_windy` · `calmer`. Each tap calls
`storeConditionFeedback(beachId, verdict, conditions)` (`services/analyticsService.ts`), which:
- appends a local record to `FEEDBACK_KEY`. The detail page reads this back
  (`feedbackAlreadyGiven`) and shows the "thank you" state instead of the buttons when this
  beach already has feedback **for the selected day** — so we don't re-ask for the same
  conditions, but we DO ask again on a different day (more calibration data), and
- emits a GA4 `condition_feedback` event carrying the verdict **paired with the modeled
  conditions at that moment**: `{ verdict, exposureLevel, beaufort, windDir, date }`.

That pairing is the whole point: it lets us compare what the model SAID against what a visitor
OBSERVED, per beach and per wind sector.

**Partial LIVE loop (per-device):** the "worse than shown" verdicts (`had_waves`, `too_windy`,
plus the legacy `not_accurate`) feed `getNegativeFeedbackCount`, which `recommendationService`
already consumes as a small live down-rank for that beach on this device. So the loop is not
purely offline — a visitor's own negative reports immediately temper that beach for them.
`calmer` is the opposite signal and deliberately does NOT up-rank live (softening stays
evidence-gated, below). The cross-device, model-level calibration is the offline pass.

## Calibration (offline, run periodically)
1. Export the `condition_feedback` events from GA4 (BigQuery export or the GA UI), or collect
   the local `FEEDBACK_KEY` records during testing.
2. Aggregate per `(beachId, windDir sector)`: count verdicts, weight by sample size.
3. Read the signal conservatively (wrong-"calm" is the dangerous error):
   - many `had_waves` / `too_windy` where the model said calm/partial → the beach is
     UNDER-warned for that sector → add/raise a curated `exposedToWindDirections` entry or a
     `localWindAmplification` for that sector in `utils/windProfileOverrides.ts`, and lock it in
     as a `rough` anchor in `scripts/validateWindExposureGroundTruth.mjs`.
   - many `calmer` where the model said exposed → only soften with ≥2 independent signals
     (per the project's evidence rule); otherwise leave conservative.
4. Re-run `npm run validate:meltemi-matrix` + the engine/ground-truth gates and review the diff.

So the verdicts become new ground-truth labels feeding the same validation matrix from roadmap #1 —
human observations close the loop without an ML model or a live backend. A future backend could
automate steps 1-3, but the conservative, evidence-gated step 3 should stay human-reviewed.
