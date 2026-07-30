# data/analytics/ — manual exports from Search Console & GA

Drop raw exports here by hand when you pull them from the Search Console or GA4 web UI. This
is separate from `reports/snapshots/`, which is the **automated** Search Console snapshot
written by `npm run seo:snapshot` (service-account API pull, JSON + markdown, no manual step).
Use this folder for anything you export by hand that the automated snapshot doesn't cover —
GA4 exports, ad-hoc Search Console filters, CSV downloads.

Roles **10 SEO, 12 Growth, 18 Google** check this folder (and `reports/snapshots/`) for
existing data before asking you to go pull a number that's already sitting here.

## Naming convention

`<subfolder>/<YYYY-MM-DD>-<short-description>.<ext>`

- `search-console/2026-07-30-performance-28d.csv` — a Performance report export (Search
  Console → Performance → Export), date = the day you exported it, not the reporting period.
  Note the reporting period inside the file/commit if it's not the default 28 days.
- `ga4/2026-07-30-events-28d.csv` — a GA4 Explore/report export, same rule.

Keep the original filename's date range info in the description if it matters
(`2026-07-30-performance-90d.csv` vs the default 28-day export) — the date prefix alone is
when you pulled it, not necessarily the period it covers.

## Why this exists

Search Console and GA4 data used to live on one laptop with no copy anywhere (see
`docs/team/12-growth-analytics.md`, risk: "Τα δεδομένα Search Console υπάρχουν σε έναν
υπολογιστή"). This folder is tracked in git specifically so that stops being true — commit
what you drop here.
