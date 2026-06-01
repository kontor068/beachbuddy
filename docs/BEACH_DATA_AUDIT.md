# Beach Data Audit

Read-only audit for the runtime beach dataset.

The audit reports suspicious or invalid beach data without editing production JSON, scoring, weather logic, or UI.

## Commands

```bash
npm run audit:beaches
npm run audit:beaches -- --region=cyclades
npm run audit:beaches -- --island=milos
npm run audit:beaches -- --mode=fast
npm run audit:beaches -- --mode=deep
npm run audit:beaches -- --island=milos --mode=deep
npm run audit:beaches -- --island=milos --mode=deep --refresh-external
npm run audit:beaches -- --mode=deep --no-external
npm run audit:beaches -- --strict
npm run audit:beaches -- --island=milos --mode=deep --email
npm run audit:beaches -- --island=milos --mode=deep --email-dry-run
npm run audit:admin
```

## What It Reads

- `public/data/beaches/index.json`
- `public/data/beaches/app/summary/*.json`
- `public/data/beaches/app/detail/*.json`

It does not read external sources and does not verify beach facts against maps, official tourism pages, or OpenStreetMap.

Exception: `--mode=deep` can use external coverage candidates for small supported scopes. The first supported scope is:

```bash
npm run audit:beaches -- --island=milos --mode=deep
```

Deep Milos coverage reads named beach candidates from OpenStreetMap Overpass and caches them under:

```text
.tmp/beach-audit-cache/
```

Use `--refresh-external` to refresh that cache. Use `--no-external` to force local-only behavior even in deep mode.

## What It Checks

- region index shape and beach counts
- summary/detail id consistency
- missing beach ids or names
- missing, invalid, or non-Greece coordinates
- duplicate beach ids
- exact or near duplicate coordinates inside the same region
- repeated beach names, classified by coordinate distance
- possible coordinate mismatches against external same-name candidates in deep mode
- possible missing beach candidates from external coverage sources in deep mode
- invalid controlled values for beach type, access, water depth, wind directions, metadata access, terrain, and confidence
- new feature keys that are not part of the current controlled schema
- location region/island mismatches
- feature contradictions such as `quiet` with `beachBar`
- risky broad feature combinations that need human review
- free-text `metadata.amenities` values that may need normalization later

## How To Read Results

The most important line is the gate status:

```text
Gate status: pass for BLOCKER/HIGH issues
```

Use the severities like this:

- `BLOCKER`: production data is structurally broken.
- `HIGH`: serious data issue that should be fixed before trusting the dataset.
- `MEDIUM`: human review item. Do not auto-fix.
- `LOW`: informational cleanup or long-term normalization.

Repeated beach names are not automatically wrong. The audit uses coordinate distance to classify them:

- `likely_duplicate_name_near_coordinates`: same name and very close coordinates.
- `possible_duplicate_name_same_area`: same name within the same local area.
- `shared_name_same_island_far_apart`: same name, but far enough apart that it may be normal.

For `MEDIUM` and `LOW` findings, the right action is review, not automatic data edits.

Reviewed far-apart repeated names can be added to the exact `acceptedSharedNamePairs` map in `scripts/auditBeachDataset.mjs`. Keep those entries keyed by `region|lowerId|higherId` and use them only for non-blocking same-name pairs that are already far outside the duplicate-distance threshold. This records the review without merging, deleting, or promoting beach facts.

Deep coverage findings are also not proof by themselves:

- `external_coordinate_mismatch_candidate`: an external same-name beach is far from the BeachBuddy coordinate.
- `external_coordinate_precision_candidate`: an external same-name beach is somewhat offset from the BeachBuddy coordinate.
- `possible_alias_or_nearby_section`: an external named beach is close to an existing BeachBuddy beach but has a different name.
- `possible_nearby_missing_or_alias`: an external named beach is in the same broader area and needs source review.
- `likely_missing_beach_candidate`: an external named beach candidate has no nearby BeachBuddy record.
- `external_coverage_scope_not_supported`: deep external coverage was skipped because the requested scope is too broad or not configured.

These findings need evidence review before any dataset change.

Deep reports also include `External review buckets`:

- `coordinate_review`: compare coordinates manually before changing anything.
- `coordinate_precision_note`: low-priority coordinate precision note.
- `likely_existing_or_section`: probably an alias, section, or nearby small beach.
- `source_review`: ambiguous nearby candidate.
- `likely_missing_candidate`: stronger candidate for missing beach backlog.

## Reports

By default, reports are written to:

```text
.tmp/beach-audits/
```

The command creates:

- a simple human report
- a Markdown report
- a JSON issues report

Open the simple report first. It is written for decisions, not debugging.

The reports include:

- issue counts by severity
- issue counts by type
- regions with the most issues
- human-readable issue summaries
- recommended next action

Example:

```text
.tmp/beach-audits/2026-05-23-beaches-island-milos-simple-report.md
```

`.tmp/` is ignored by git.

## Email Reports

Email is optional. The audit always writes local report files first, then sends email only when you add `--email`.

```bash
npm run audit:beaches -- --island=milos --mode=deep --email
```

Use this to test the configuration without sending:

```bash
npm run audit:beaches -- --island=milos --mode=deep --email-dry-run
```

Dry run does not require a Resend API key. Real sending with `--email` does.

Required environment variables:

```text
RESEND_API_KEY=...
AUDIT_EMAIL_FROM=BeachBuddy Audit <audit@yourdomain.com>
AUDIT_EMAIL_TO=you@example.com
```

Optional:

```text
AUDIT_RESEND_API_KEY=...
AUDIT_EMAIL_CC=person@example.com
AUDIT_EMAIL_BCC=person@example.com
AUDIT_EMAIL_SUBJECT_PREFIX=BeachBuddy Audit Report
```

You can also override recipients per command:

```bash
npm run audit:beaches -- --island=milos --mode=deep --email --email-to=you@example.com
```

Email behavior:

- the simple report is included inside the email body
- the simple report, full Markdown report, and JSON report are attached
- missing email config skips email sending without changing the audit result
- email sending failure does not edit data and does not delete local reports

## Local Admin GUI

Run the separate local admin console:

```bash
npm run audit:admin
```

The server listens on `127.0.0.1` by default and prints a URL with an admin token.

Use the GUI to:

- run fast or deep audits by island, region/group, or all Greece
- send audit email or run email dry-run
- open generated report files
- tick individual report issues and use `Φτιάξε επιλεγμένα` to create a selected Greek fix workflow report
- create recurring schedules, such as a weekly Milos deep audit
- pause, run now, or delete schedules

Recommended local env:

```text
AUDIT_ADMIN_TOKEN=change-this-local-admin-token
AUDIT_ADMIN_HOST=127.0.0.1
AUDIT_ADMIN_PORT=4187
```

Schedule state is stored locally under:

```text
.tmp/beach-audit-admin/state.json
```

Important: schedules run only while `npm run audit:admin` is running. For cloud or always-on production scheduling, add a real cron/server deployment later.

The fix workflow is decision-based. You choose issues with checkboxes. `Φτιάξε επιλεγμένα` treats every selected issue as auto-fixable and does one of two things:

- supported coordinate mismatch/precision issues are applied immediately to the related beach JSON files, with backups under `.tmp/beach-audit-admin/backups/`
- all other selected issues are automatically prepared as structured draft fixes, not left as a plain report

The auto-fix drafts live here:

```text
.tmp/beach-audit-admin/auto-fix-drafts.json
```

Every selected run also writes:

```text
.tmp/beach-audits/YYYY-MM-DD-scope-runid-selected-fixes.md
.tmp/beach-audits/YYYY-MM-DD-scope-runid-selected-fixes.json
```

Missing beaches, amenities, features, names, and broad quality findings are still not silently inserted into production data. They become approved draft fixes first, because production beach records need required fields and evidence before they can safely affect recommendations.

## Important Limits

Fast mode is deterministic local validation only.

Deep mode keeps the same read-only behavior. It may collect external candidates for supported small scopes, starting with Milos, but it still does not edit data.

Suggested values are review guidance, not automatic patches.

Unknown is better than false certainty.
