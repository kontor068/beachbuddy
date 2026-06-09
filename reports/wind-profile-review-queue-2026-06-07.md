# Wind Profile Review Queue - 2026-06-07

## Scope

This report turns the wind-profile audit into an actionable review queue.

It records the focused Milos/Naxos scenario coverage added after the audit and lists the profile decisions that should happen before any recommendation scoring changes.

No beach wind profiles, scoring thresholds, recommendation rules, UI copy, or production data were changed for this queue.

## New Scenario Coverage Added

The recommendation scenario validator now covers these additional directional cases:

| Scenario | Region | Wind | Expected behavior |
| --- | --- | --- | --- |
| `Naxos_N_5BFT` | Naxos | N, 5 Bft, rougher sea | No ideal swimming; no top recommendations; no Mikri Vigla wind-sport fallback |
| `Naxos_W_4BFT` | Naxos | W, 4 Bft | Keep manageable candidates; avoid exposed/wind-sport top picks |
| `Naxos_S_4BFT` | Naxos | S, 4 Bft | Keep manageable candidates; avoid exposed/wind-sport top picks |
| `Milos_SW_4BFT` | Milos | SW, 4 Bft | Keep manageable candidates; avoid exposed/wind-sport top picks |
| `Milos_S_4BFT` | Milos | S, 4 Bft | Keep manageable candidates; avoid exposed/wind-sport top picks |

The validator also now has two shared assertion groups:

- caution scenarios must keep some suitable/less-exposed choices, but must not promote exposed or wind-sport candidates
- no-ideal scenarios must not invent top recommendations or "Most suitable" candidates

## Current Findings From The Added Scenarios

These are validation findings, not automatic data-change instructions.

| Scenario | Top recommendations | Strong suitable | No ideal swimming | Interpretation |
| --- | ---: | ---: | --- | --- |
| `Naxos_N_5BFT` | 0 | 0 | yes | Correct conservative behavior for strong north wind and rough sea |
| `Naxos_W_4BFT` | 1 | 6 | no | Usable, but top-pick pool is narrow |
| `Naxos_S_4BFT` | 1 | 13 | no | Usable, with a wider manageable pool |
| `Milos_SW_4BFT` | 1 | 9 | no | Usable, but top-pick pool is narrow |
| `Milos_S_4BFT` | 0 | 6 | no | Important product gap: manageable options exist, but none are trusted enough for top recommendation |

The `Milos_S_4BFT` result should be reviewed carefully before changing anything. It may be correct if all candidates fail top-pick confidence gates. It may also mean one or two practical north/east/bay beaches need wind-profile verification.

## Milos Priority Queue

Milos has the highest wind-profile audit debt: many beaches have useful static metadata but low wind-profile confidence.

Review these first because they affect practical tourist recommendations:

| Priority | Beach | Current concern | Decision needed |
| ---: | --- | --- | --- |
| 1 | Papikinou | Local-exception style Adamas bay candidate; currently low confidence | Keep low, upgrade to medium, or narrow local-exception wording |
| 2 | Lagkada | Practical Adamas bay candidate; currently low confidence | Decide if semi-sheltered behavior is reliable enough for medium |
| 3 | Nautikos Omilos Milou | Practical Adamas bay candidate; currently low confidence | Decide if semi-sheltered behavior is reliable enough for medium |
| 4 | Pollonia | Practical tourist beach with low-confidence NE/E behavior | Verify exposed/protected sectors and fetch |
| 5 | Agkali | Practical beach with low confidence | Verify if it should stay explore-only |
| 6 | Kapros | Static-ready but wind-profile confidence blocks top pick use | Verify exposure and safe wording |
| 7 | Gerania | Static-ready but wind-profile confidence blocks top pick use | Verify exposure and safe wording |
| 8 | Voudia | Static-ready but wind-profile confidence blocks top pick use | Verify exposure and safe wording |

Keep Achivadolimni as wind/watersports caution. Do not use it as a calm-family top pick in meaningful wind.

## Naxos Priority Queue

Naxos has full profile coverage, but many popular beaches are intentionally low confidence. Do not upgrade them just because they are popular.

Review these first:

| Priority | Beach | Current concern | Decision needed |
| ---: | --- | --- | --- |
| 1 | Agia Anna | Popular tourist beach blocked by low wind-profile confidence | Verify if any sector can support medium confidence |
| 2 | Agios Georgios | Popular/easy beach blocked by low wind-profile confidence | Verify north/west/south behavior and shallow-water caution |
| 3 | Agios Prokopios | Popular beach blocked by low wind-profile confidence | Verify exposure sectors and avoid false calm claims |
| 4 | Plaka | Popular beach blocked by low wind-profile confidence | Verify west/north/south exposure and beach-length differences |
| 5 | Mikri Vigla south side | Split behavior can be confused with wind-sport Mikri Vigla | Verify split explicitly; keep main wind-sport spot blocked |
| 6 | Alyko / Mikro Alyko | Tourist-relevant southwest-coast candidates | Verify exposure/fetch before any upgrade |
| 7 | Orkos | Near wind-sport geography; currently low confidence | Decide if caution or explore-only is safest |

For `Naxos_N_5BFT`, the fallback is allowed to include non-wind-sport alternatives, but it must not include the main Mikri Vigla wind-sport area (`beach.id === 2006`).

## Decision Rules For Profile Changes

For each reviewed beach, make exactly one of these decisions:

1. keep low confidence
2. upgrade to medium confidence with clear sector reasoning
3. downgrade or narrow exposed/protected sectors
4. mark known caution / local exception

Do not use geospatial exposure alone as verification. It can support a decision, but local beach behavior still needs explicit reasoning.

Do not upgrade to high confidence unless the evidence standard in `docs/WIND_PROFILE_GUIDELINES.md` is met.

## Validation Before Any Profile Edit

Before editing a profile, define the expected behavior in scenario terms:

- what wind direction and strength should make the beach usable
- what wind direction and strength should make it exposed/caution
- whether it may appear as a top recommendation or only as an explore/fallback option
- whether it needs wind-sport, road-access, wave, or confidence warnings

After profile edits, run:

```text
node scripts/validateWindExposureEngine.mjs
node scripts/validateRecommendationScenarios.mjs
npm run content:audit
node scripts/validateCriticalBeachData.mjs
npm run lint
npm run build
git diff --check
```

## Current Recommendation

Freeze scoring.

Do not change thresholds to force more top recommendations.

First verify Milos and Naxos priority profiles, then decide whether the UI should better explain cases like `Milos_S_4BFT`, where manageable beaches exist but no beach is trusted enough for a top-card recommendation.
