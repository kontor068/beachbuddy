# Beach-characteristic Uncertainty Inventory

_Generated 2026-07-20. 2799 user-facing beaches (2852 total incl. 53 excluded). Read-only._

Ranked by how actionable + how trust-damaging. "SCREEN" rows over-flag (screening heuristics), so the number is an upper bound, not confirmed errors.

| # | Characteristic | Uncertain | of base | How it's detected | Actionable |
|---|---|---|---|---|---|
| 1 | Record confidence = low | **385** (13.8%) | 2799 | self-declared low confidence | ✅ |
| 2 | Explicit needsVerification flag | **108** (3.9%) | 2799 | record already tagged by an earlier pass as needing a look | ✅ |
| 3 | Water depth (type↔label contradiction) | **103** (3.7%) | 2799 | waterDepth.type disagrees with its own label — badge already hidden by isWaterDepthUnverified gate | ✅ |
| 4 | Source URL dead (needs re-sourcing) | **101** (2.4%) | 4180 | a cited evidence link is dead — provenance broken, not the value itself | ✅ |
| 5 | Terrain type (our label vs OSM surface) | **98** (11.5%) | 849 | our sand/pebble label disagrees with OSM surface tag (where OSM has one: 849) | ✅ |
| 6 | Organized flag (unclear after 2 web rounds) | **61** (15.8%) | 387 | UNCLEAR verdict after coordinate-anchored web search — no reliable source either way | ✅ |
| 7 | Organized flag (web LEANS organized, held for 2nd signal) | **34** (8.8%) | 387 | web search says organized but at medium confidence with no independent corroboration — most likely genuine misses; safe to apply once a 2nd source confirms | ✅ |
| 8 | Pin location (priority mislocations) | **15** (0.5%) | 2799 | flagged pins on land / far from coastline / wrong island (e.g. #1942 on Rhenia) — blind moves unsafe | ✅ |
| 9 | Shade flag (false but text says natural shade) | **2** (0.1%) | 2799 | shade:false yet amenities mention trees/natural shade — text does not render as a chip | ✅ |
| 10 | Source URL inconclusive | **278** (6.7%) | 4180 | link check ambiguous (timeout/blocked) | — |
| 11 | Record confidence = medium | **123** (4.4%) | 2799 | self-declared medium confidence (note: "high" covers static facts only, not live) | — |
| 12 | Water depth (missing entirely) | **111** (4.0%) | 2799 | no waterDepth object — nothing shown | — |
| 13 | Access road surface (total honest-downgraded) | **40** (1.4%) | 2799 | roadSurfaceUnverified=true → UI shows "likely easy, unverified" (RESOLVED). 954 screening flags were a 120m-threshold artifact, NOT real errors | — |
| 14 | Access road surface — TRUE actionable | **13** (76.5%) | 17 | re-measured from the 954 screening flags → 13 web-verified as not paved-easy, honestly downgraded (roadSurfaceUnverified); 4 confirmed paved & kept | — |
| 15 | Orientation missing | **2** (0.1%) | 2799 | no coast orientation → sunset-facing + some wind context unavailable | — |
| 16 | Google Maps landing — TRUE actionable (opens wrong card) | **0** (0.0%) | 2626 | 674 beaches are flagged (name lookup ≠ our coord) but 0 carry an active placeId → all route by coordinate. Only PASS-verified beaches open a place card. RESOLVED by design | — |

## Notes
- **Amenities/organized** is the most-worked dimension — 341 beaches corrected with sources this month. What remains is the genuinely-unresolvable tail + the not-yet-web-checked weak-signal set.
- **Access "suspect" (954)** and **pin** rows are SCREENING over-flags; the true error count is far smaller (only multi-signal cases were auto-corrected).
- **Google Maps WRONG_PLACE (420)** is mitigated (coordinate routing) but the underlying name→place mismatch is real and worth fixing per-beach.
- **Water depth & shade** are largely terrain-derived guesses; the counts above are only the self-contradictions, which the UI already hides. The deeper question (are the non-contradictory ones right?) is unverifiable without on-site data.
