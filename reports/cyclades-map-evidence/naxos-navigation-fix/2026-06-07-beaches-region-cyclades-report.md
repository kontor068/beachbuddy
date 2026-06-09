# Beach Dataset Audit

Generated at: 2026-06-07T16:54:47.339Z
Mode: fast
Scope: region-cyclades

## Summary

- Regions checked: 24
- Beaches checked: 546
- Issues: 1
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 1
- Accepted shared-name pairs: 0
- Must fix now: 0
- Human review: 0
- Informational: 1
- Gate status: pass for BLOCKER/HIGH issues
- Next action: No blocking or review-level issues found.

## Issue Types

- metadata_amenities_free_text_schema: 1

## External Review Buckets

- none

## Regions With Most Issues

- none

## Accepted Shared-Name Pairs

- none

## Coverage

- Beaches with metadata: 546
- Beaches with orientation: 3
- Beaches with windProfile: 0
- External coverage source: not used
- External coverage candidates: 0
- Metadata confidence values: {"high":495,"medium":35,"low":16}

## Notes

- This audit is deterministic and read-only.
- It does not verify facts against external sources.
- Deep mode currently means stricter local reporting only; external research is intentionally not automated yet.
- Suggested fixes are review guidance, not automatic data changes.

## Issues

- LOW metadata_amenities_free_text_schema
  - Meaning: metadata.amenities currently contains free-text labels. This is acceptable for source notes but risky as a feature schema.
  - Review category: informational
  - Beach: n/a
  - Region: n/a
  - File: n/a
  - Evidence: metadata.amenities currently contains free-text labels. This is acceptable for source notes but risky as a feature schema.
