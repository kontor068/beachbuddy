# Beach-data Reliability Scorecard

_Generated 2026-07-19 — read-only aggregation of existing audit outputs. 2852 beach records._

| Dimension | Checked | Corroborated | Flagged | Corrected (this work) | Pending | Note |
|---|---|---|---|---|---|---|
| **Amenities (organized/bar/sunbeds)** | 2852 | 975 organized | 318 omission-candidates + 22 fp-suspect | 129 corrected (this pass) | 318 medium review | false-positives clean (630 corroborated) |
| **Access (asphalt vs OSM road)** | 1500 | 546 corroborated | 954 suspect (over-flags) | 27 honest-downgraded | ~15 review (paved>350 confident-label) | UI shows unverified where OSM disagrees |
| **Terrain (sand/pebble vs OSM)** | ? | — | 0 mismatch | 0 (review only) | review | report on disk 2026-06-20 |
| **Pin location (vs OSM coastline)** | 2852 | 2303 clean | CRIT 3 / HIGH 8 / LOW 524 | 0 (needs coord verify) | 11 priority (CRIT+HIGH) | blind moves unsafe — per-beach fix |
| **Place resolution (Maps landing)** | 2626 | 1952 PASS | 420 wrong-place / 228 wrong-type | ledger-gated | nav ledger | placeId routing + ledger enforced |
| **Source-evidence coverage** | 2719 | 2719 with source URL | 0 | — | — | every beach carries a source URL |
| **Source-URL liveness** | 4180 | 3801 alive | 101 dead / 278 inconclusive | — | — | links re-checked (OSM excluded) |
| **Coverage (missing beaches)** | 3046 | 2793 covered | 40 genuine gaps | — | 40 insert candidates | ~90% OSM coverage |

## Reading this
- **Corrected (this work)** = applied in the 2026-07-19 reliability pass (amenities 129, access 27, waterDepth gate 13).
- **Flagged over-flags**: access & pins use OSM screens that over-report; only multi-signal / high-confidence subsets were auto-corrected. The rest are review lists, never silent changes.
- **Not a correctness proof** — it measures evidence coverage + what each audit surfaced, not ground truth.
