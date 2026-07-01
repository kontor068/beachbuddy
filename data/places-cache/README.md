# Google Places response cache (committed on purpose)

These JSON files cache **billable** Google Places API responses so we never pay twice
for the same lookup. They live under `data/` (tracked in git) rather than `.tmp/`
(gitignored) **deliberately**: when the caches were under `.tmp/`, a `git clean`, a
fresh checkout, or a new machine wiped them, and the next audit re-billed every call
from scratch. That is what turned a one-off enrichment pass into a large surprise bill.

Keeping them here means a place we already paid to look up is reused forever, across
machines and checkouts. The stored payloads are only **public place data** (place ids,
display names, coordinates, types, rating counts) — no secrets — so committing them is safe.

## Files

| File | Written by | Google request | 
|------|------------|-----------------|
| `google-places-cache.json` | `backfillNavPlaceIds.mjs`, `resolveCollisionPlaceIds.mjs`, `auditGooglePlaceRouting.mjs` | Text Search (placeId routing) |
| `google-popularity-cache.json` | `fetchBeachPopularity.mjs`, `enrichOsmGapBeaches.mjs` | Place Details (rating / userRatingCount) |
| `google-coverage-cache.json` | `buildNationalGapReport.mjs` (`-- --google`) | Text Search (OSM gap confirmation) |

## Commit the cache after a run

After you run any of the scripts above, **commit the updated file(s) in this folder**.
That is what makes the next run free. If a run produced no new entries, there is nothing
to commit.

## Forcing a refresh

To re-fetch (and re-bill) a subset, delete the relevant entries from the JSON, or delete
the whole file to rebuild it from scratch. Only do this when the underlying Google data
has genuinely changed (e.g. refreshing review counts).

> Reminder: the Places API is billable. Before running any of these scripts, confirm the
> `GOOGLE_PLACES_API_KEY` is set and that you intend to spend. See the root `.env.local`.
