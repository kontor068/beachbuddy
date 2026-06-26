# Meltemi validation matrix — accuracy baseline (2026-06-27)

Snapshot from `npm run validate:meltemi-matrix` (`scripts/validateMeltemiMatrix.ts`). This is the
yardstick: re-run after each roadmap change and compare. The harness runs the REAL engine
(`assessBeachWindExposure`) — what recommendations consume — over a 7-scenario grid × island-group,
deterministically (committed data only, no live API). Full JSON: `.tmp/meltemi-matrix-baseline.json`.

Beaches evaluated: **2799** · GT label cases: **128** (0 skipped).

## Label accuracy (real engine vs ground truth)
| group | accuracy |
|---|---|
| cyclades | 37/40 (93%) |
| dodecanese | 17/17 (100%) |
| n-aegean | 9/9 (100%) |
| mainland | 41/41 (100%) |
| ionian | 13/14 (93%) |
| crete | 7/7 (100%) |
| **OVERALL** | **124/128 (97%)** |

The 4 misses are all `protected` exact-labels where the engine returns `partial` — it **under-calls
known shelters** (Naxos Agios Prokopios/Plaka, Milos Fyriplaka, Lefkada Porto Katsiki). Safe direction
(under-promising calm), but it means the model won't confidently surface these meltemi refuges.

## Property invariants
- **no-false-protected** (open onshore sector → engine `protected`, non-curated): **0** ✓ (the dangerous direction is clean)
- **monotonicity** severity(N6)≥(N5)≥(N3): **0** ✓ — *note: exposureLevel is speed-invariant, so this is weak; the Beaufort signal lives in the colour ramp below*
- **onshore ≥ offshore**: **5** — all known-suspect beaches (validates the harness has teeth):
  Kolona Andros (tombolo), and Paros Agia Irini / Langeri / Mikri Santa Maria / Tourkou Ammos
  (the legacy wrong-facing pins `windExposureModel.ts` already documents).

## Signals (measurement, not pass/fail)
- **Stored-geometry recall** on open onshore sectors (fetch≥15 km & onshore≥0.8): exposed **98%** /
  partial **2%** / protected 0% (n=2787). The **67 partial** sectors are concrete `blockedRayRatio`
  under-warn candidates (roadmap #3) — concentrated in **mainland (4%) and ionian (4%)**.
- **Colour ramp** (green/yellow/orange/red): `N3` ≈ all yellow → `N5`/`N6` ≈ 74% orange / 25% red.
  Two model facts surfaced: **N5 ≡ N6** (the colour grid buckets 5–6 Bft together) and
  **choppy3 ≡ N3** (a 0.6 m short-period wave at 3 Bft does not move the headline — confirms wave
  period is not yet scored, roadmap #2).

## How later roadmap items should move these numbers
- #2 swell/period → `choppy3` should diverge from `N3`; a swell scenario should raise red%.
- #3 blockedRayRatio fix → the 67 under-warn partials should drop toward exposed (mainland/ionian recall → ~100%).
- #4 afternoon/temporal → (needs a time dimension added to the matrix).
- Curating more sheltered labels → label accuracy denominator grows; watch the protected/calm recall.
