# Cyclades Google Places Audit

Generated: 2026-06-08T09:50:58.195Z
Scope: cyclades:naxos
Dry run: yes
Google API key present: no

## Summary

- total: 39
- verified: 0
- needs_review: 0
- rejected: 0
- no_result: 0
- api_error: 0
- dry_run: 39

## Strict Matching Policy

- verified requires close distance, strong name match, island signal, and no wrong-island signal.
- needs_review is intentionally conservative and must not be written into beach JSON automatically.
- no_result is acceptable for remote beaches; do not invent a Place ID.

## Reports

- cyclades-google-places-report.json
- cyclades-google-places-report.csv
- per-island CSV files named by region id
