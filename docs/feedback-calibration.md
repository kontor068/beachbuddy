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
`{ beachId, feedback, timestamp, conditions }` — exactly what step 2 consumes — plus the optional
`beachName` / `regionId` / `pagePath` the automatic watch below needs to name and link the beach. This is
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

## Automatic watch (live, shipped 29/08/2026)
Every single verdict already lands in Telegram the moment it is tapped — but one report is not a
signal. One "too windy" can be offshore wind, a mis-remembered hour, or a bad day; the error is the
PATTERN (same beach, same wind sector, three and four times), and a stream of individual messages
weeks apart is exactly where a pattern is invisible. Until now it surfaced only if you remembered to
download the export and run the calibration by hand.

`netlify/functions/feedback-watch.mjs` is that pass, run automatically: a **daily** scheduled function
(`netlify.toml`, 05:00 UTC) that reads the last **90 days** of the `feedback-log` store, aggregates it
and pushes a Telegram message naming the beaches that crossed the thresholds.

- **One arithmetic, two readers.** The aggregation and the thresholds live in
  `netlify/functions/lib/feedbackSignals.mjs`, which is also what `scripts/calibrateFromFeedback.mjs`
  imports. Two copies would drift within a month, and a phone message naming a different beach than
  the report is worse than no message.
- **It stays quiet.** It remembers what it already said (Blobs key `watch/alerted` in the same store)
  and speaks again only for a NEW signal, a changed type, or one that grew by ≥3 samples. Most days
  send nothing. The memory is written only after Telegram accepted the message, so a failed send
  never silences a signal; a prune drops cells untouched for 180 days.
- **Names and links travel with the record.** `feedback-email.mjs` now also stores `beachName`,
  `regionId` and `pagePath` on each durable record, so the alert can say "Μπονάτσα (Κίμωλος)" and
  open the page instead of printing `#1853`. Older records fall back to the quality ledger, which
  only knows beaches that have some gap — hence the record is the primary source.
- **Preview before it goes out:** `/.netlify/functions/feedback-watch?preview=1` under `netlify dev`
  renders the message and the counts without sending (Netlify answers 403 to scheduled functions on
  the public internet, so this door is not reachable from outside).

Same env vars as the instant push (`FEEDBACK_TELEGRAM_BOT_TOKEN` / `FEEDBACK_TELEGRAM_CHAT_ID`);
without them the function logs and sends nothing.

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
human observations close the loop without an ML model or a live backend. Steps 1-2 now also run
by themselves every morning (see "Automatic watch" above); the conservative, evidence-gated step 3
stays human-reviewed.
