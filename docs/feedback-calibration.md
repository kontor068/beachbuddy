# Condition-feedback loop (roadmap #7)

The app has a lightweight feedback email endpoint, but the model-calibration loop is still split
into a **live capture** half (in the app) and an **offline calibration** half (run by hand over
exported data).

## Capture (live, shipped)
The beach detail page asks "How accurate was our forecast?" with four structured verdicts:
`accurate` · `had_waves` · `too_windy` · `calmer`. Each tap calls
`storeConditionFeedback(beachId, verdict, conditions, context)` (`services/analyticsService.ts`), which:
- appends a local record to `FEEDBACK_KEY`. The detail page reads this back
  (`feedbackAlreadyGiven`) and shows the "thank you" state instead of the buttons when this
  beach already has feedback **for the selected day** — so we don't re-ask for the same
  conditions, but we DO ask again on a different day (more calibration data), and
- emits a GA4 `condition_feedback` event carrying the verdict **paired with the modeled
  conditions at that moment**: `{ verdict, exposureLevel, beaufort, windDir, date }`, and
- posts the same structured feedback to the Netlify `feedback-email` function
  (`netlify/functions/feedback-email.mjs`). That function pushes it to a Telegram chat as an
  instant notification (`FEEDBACK_TELEGRAM_BOT_TOKEN` / `FEEDBACK_TELEGRAM_CHAT_ID` — despite
  the filename, there is no email delivery in this function).

## Durable storage (live, shipped 30/07/2026)
Telegram alone is push-only and ephemeral — clearing the chat loses every report ever made,
and step 1 below had nothing to read. So every **beach-attached** verdict (skips the
landing-page free-text message, which has no beach to calibrate) is also written to
**Netlify Blobs**, store `feedback-log`, key `f/<day>/<uuid>`, shape
`{ beachId, feedback, timestamp, conditions }` — exactly what step 2 consumes. This is
best-effort and never blocks the Telegram push or the visitor-facing response.

Read it back with the export endpoint (`netlify/functions/feedback-export.mjs`, gated by
`FEEDBACK_EXPORT_KEY` — set it in the Netlify env, unset ⇒ 403):

```
curl "https://calmbeach.gr/api/feedback-export?key=YOUR_KEY" -o .tmp/feedback-export.json
```

Optional `&since=YYYY-MM-DD` limits to records from that UTC day onward.

That pairing is the whole point: it lets us compare what the model SAID against what a visitor
OBSERVED, per beach and per wind sector.

**Partial LIVE loop (per-device):** the "worse than shown" verdicts (`had_waves`, `too_windy`,
plus the legacy `not_accurate`) feed `getNegativeFeedbackCount`, which `recommendationService`
already consumes as a small live down-rank for that beach on this device. So the loop is not
purely offline — a visitor's own negative reports immediately temper that beach for them.
`calmer` is the opposite signal and deliberately does NOT up-rank live (softening stays
evidence-gated, below). The cross-device, model-level calibration is the offline pass.

## Calibration (offline, run periodically)
Steps 1-3 are now executable via **`scripts/calibrateFromFeedback.mjs`** (it does the aggregation +
emits conservative, human-reviewable proposals; step 3's edits and step 4 stay manual):

1. Pull the durable export above (`curl .../api/feedback-export?key=...`), or collect the local
   `FEEDBACK_KEY` records during testing. (GA4/BigQuery export still works as a cross-check but
   is no longer the primary source now that Blobs holds every record.)
2. `node scripts/calibrateFromFeedback.mjs --input <export.json>` — aggregates per `(beachId, windDir
   sector)` and prints/writes proposals. Try `--demo` to see the output shape on synthetic data.
   It applies the conservative thresholds (≥3 samples, ≥50% negative → UNDER-warn; softening needs
   ≥6 samples / ≥66% and is never auto-applied).
3. Act on the proposals BY HAND (the dangerous direction is wrong-"calm", so this stays human-reviewed):
   - `UNDER_WARN` → add/raise a curated `exposedToWindDirections` entry or a `localWindAmplification`
     for that sector in `utils/windProfileOverrides.ts`, and lock it in as a `rough` anchor in
     `scripts/validateWindExposureGroundTruth.mjs`.
   - `OVER_WARN` (`calmer`) → only soften with a 2nd independent signal per the evidence rule.
4. Re-run `npm run validate:meltemi-matrix` + the engine/ground-truth gates and review the diff.

So the verdicts become new ground-truth labels feeding the same validation matrix from roadmap #1 —
human observations close the loop without an ML model or a live backend. A future backend could
automate steps 1-2, but the conservative, evidence-gated step 3 must stay human-reviewed.
