# Wind Profile And Recommendation Audit - 2026-06-07

## Scope

This audit was created to clarify the current CalmBeach / Beach Buddy wind-profile and recommendation state.

It answers:

- which wind profiles are trusted enough to support top recommendations
- which beaches are intentionally kept out of top picks because wind data is low confidence
- which known wind/watersports beaches are handled as caution cases
- whether the current validation suite catches the main false calm/protected risks
- what the next safest cleanup steps are

No recommendation logic, beach data, UI, or scoring thresholds were changed in this audit.

Important context: the repository had a large existing dirty worktree when this audit ran. Results describe the current local working tree, not a clean committed baseline.

## Source Of Truth Used

Primary docs:

- `docs/BEACH_BUDDY_AGENT_CONTEXT.md`
- `docs/AGENT_SOURCE_MAP.md`
- `docs/WIND_PROFILE_GUIDELINES.md`
- `docs/VALIDATION_PLAYBOOK.md`
- `.codex/WORKFLOW_ORCHESTRATION.md`

Primary code/data:

- `utils/windProfileOverrides.ts`
- `utils/windExposureEngine.ts`
- `services/recommendationService.ts`
- `scripts/windExposureValidation.ts`
- `scripts/validateRecommendationScenarios.mjs`
- `public/data/beaches/app/*.json`
- `public/data/geospatial/exposure/*.json`

## Current Recommendation Flow

The current flow is:

1. Static beach data loads from app beach JSON.
2. `resolveBeachWindProfile` chooses a wind profile in this order:
   - explicit override from `utils/windProfileOverrides.ts`
   - beach-level `windProfile`
   - metadata `windProfile`
   - unknown fallback
3. `assessBeachWindExposure` combines:
   - live wind direction
   - live wind speed / Beaufort
   - wind profile exposed/protected sectors
   - known wind sport flag
   - geospatial exposure profile when available
   - measured or modeled wave context
4. `calculateBeachScore` turns exposure/weather/sea/user context into:
   - swimming score
   - experience score
   - final suitability score
   - warnings
   - recommendation confidence
   - user-facing explanation inputs
5. `isTrustedTopRecommendationCandidate` gates top recommendations:
   - static metadata must be high confidence
   - access must be practical and known
   - terrain/beach type/water depth must be known
   - orientation confidence must not be low
   - recommendation confidence must not be low
   - wind profile confidence must not be low
   - from meaningful wind upward, unknown wind-profile source is not allowed
6. App-level logic then prioritizes more protected/less exposed choices in meaningful wind.

## Validation Commands Run

All of these passed:

```text
node scripts/validateWindExposureEngine.mjs
node scripts/validateRecommendationScenarios.mjs
npm run content:audit
node scripts/auditWindProfileEvidence.mjs
node scripts/validateCriticalBeachData.mjs
```

Results:

- Wind exposure validation passed.
- Recommendation scenario validation passed.
- Static content audit found 0 risky live-condition wording issues.
- Critical beach data validation scanned 2715 beaches and found 0 critical/high/medium/low issues.
- Naxos wind-profile evidence audit reported 39 total profiles: 19 medium, 20 low, 20 blocked from upgrade.

## Executive Summary

No confirmed scoring or validation regression was found.

The main issue is not "the engine is broken." The main issue is confidence management:

- Paros is mostly clean.
- Andros is usable but has some low/unknown profiles.
- Milos has the highest uncertainty: 28 of 41 profiles are low confidence.
- Naxos has full profile coverage but many popular beaches remain low confidence by design.

This is safer than overclaiming. Low confidence profiles are currently prevented from creating protected/calm labels and from becoming daily top recommendations.

The immediate product risk is not false confidence from the top-pick gate. The risk is user confusion/internal confusion because "has a windProfile" sounds like "verified", when many profiles are only conservative placeholders.

## Coverage Summary

| Island | Beaches | Override coverage | High | Medium | Low | Unknown shelter | Unknown fetch | Wind-sport spots | Static top-ready | Top-eligible after wind gate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Paros | 37 | 37/37 | 1 | 35 | 1 | 1 | 1 | 5 | 28 | 26 |
| Andros | 41 | 41/41 | 0 | 29 | 12 | 7 | 7 | 0 | 13 | 12 |
| Milos | 41 | 41/41 | 0 | 13 | 28 | 7 | 7 | 1 | 24 | 11 |
| Naxos | 39 | 39/39 | 0 | 19 | 20 | 0 | 0 | 1 | 27 | 10 |

Definitions:

- Static top-ready means beach metadata/access/terrain/water-depth basics are good enough for a top pick.
- Top-eligible after wind gate means it can be a top recommendation only if today's weather/sea also supports it.
- Top-eligible does not mean always recommended.
- Low windProfile means it should remain explore/map/data, not promoted as best beach today.

## What Looks Correct

The current validation suite protects the most important trust rules:

- Unknown/low confidence wind profiles do not create protected/calm labels.
- Legacy `protectedFrom` is only weak fallback and does not create verified wind protection claims.
- Known wind-sport beaches are not treated as calm/family swimming choices in 4-5+ Bft.
- 5 Bft plus rough sea produces no ideal swimming state instead of forcing top picks.
- 3 Bft scenarios avoid harsh warnings.
- Map/list exposure consistency checks report 0 mismatches in the covered scenarios.
- Static content does not contain risky calm/protected/safe/ideal live-condition wording.

## What Is Still Uncertain

These are not confirmed bugs. They are data-confidence risks.

1. A beach can have high static metadata but low windProfile.
   - The app correctly blocks it from top picks.
   - Internally this can look confusing because the beach seems "known", but wind behavior is still not verified.

2. Some popular beaches are blocked because wind behavior is intentionally conservative.
   - This is especially visible in Milos and Naxos.
   - The product should treat that as audit backlog, not as an automatic scoring problem.

3. Medium confidence is not verified certainty.
   - Medium profiles can guide ranking.
   - They still should use cautious wording unless measured weather/sea conditions support stronger copy.

4. Geospatial exposure helps map/exposure logic, but it should not upgrade local wind truth by itself.
   - This is already reflected in Naxos: 20 profiles remain blocked from upgrade.

## Island Notes

### Paros

Status: strongest current coverage.

Good:

- 37/37 beaches have override wind profiles.
- Only 1 low-confidence profile.
- Known wind-sport cluster is correctly marked.
- Validation confirms Chrysi Akti / Pounta / Tserdakia are not calm top picks in 5 Bft north wind.

Top-eligible if today's conditions support it:

- Agia Eirini
- Agios Dimitrios
- Ampelas
- Delfini
- Dryos
- Kolympithres
- Krios
- Livadia
- Logaras
- Lolantonis
- Martselo
- Mikri Santa Maria
- Monastiri
- Nautikos Omilos Parou
- Xyfara
- Paralia Alyki
- Paralia Glyfa
- Paralia Paroikias
- Parasporos
- Piperi
- Santa Maria
- Faraggas

Top-eligible but wind-sport caution:

- Paralia Agkali Chrysis Aktis
- Pounta
- Tserdakia / Nea Chrysi Akti
- Chrysi Akti

Explore-only / audit-needed:

- Limnes: static data is strong, but windProfile is low confidence with unknown shelter/fetch.

Recommendation:

- Review Limnes first.
- Keep wind-sport beaches eligible only for mild conditions, never calm-family picks in meaningful wind.

### Andros

Status: usable but narrower top-pick pool.

Good:

- 41/41 beaches have override wind profiles.
- 29 medium profiles.
- Scenario validation confirms Piso Gialia outranks Syneti in 5 Bft north wind.
- No known wind-sport spots in current profile data.

Top-eligible if today's conditions support it:

- Agios Kyprianos
- Agios Petros
- Vintzi
- Gialia
- Kolona
- Kypri
- Batsi
- Paralia Felou
- Paraporti
- Piso Gialia
- Syneti
- Chrysi Ammos

Explore-only / audit-needed despite static readiness:

- Neimporio: high static metadata but low windProfile with unknown shelter/fetch.

Unknown shelter/fetch profiles:

- Neimporio
- Lefka
- Limanaki
- Mikrogiali
- Platanistos
- Rozos
- Steno / Stavros

Recommendation:

- Review Neimporio first because it is mainstream/easy enough to matter.
- Then review the unknown shelter/fetch group.
- Keep hard-access beaches out of top picks unless no practical option exists.

### Milos

Status: highest audit debt.

Good:

- 41/41 beaches have override wind profiles.
- Milos validation protects the known hard cases:
  - Sarakiniko is not a calm top pick in 5 Bft north wind.
  - Papafragas is not a calm top pick in 5 Bft north wind.
  - Fyropotamos and Plathiena are not calm top picks in 5 Bft north wind.
  - Achivadolimni shows wind/watersports caution.
  - Papikinou remains a local-exception candidate, not a protected/calm claim.
  - South-coast beaches get caution in 5 Bft south wind.

Top-eligible if today's conditions support it:

- Agios Sostis
- Agia Kyriaki
- Palaiochori
- Plathiena
- Provatas
- Sarakiniko
- Tourkothalassa
- Fyriplaka
- Fyropotamos
- Psarovolada

Top-eligible but wind-sport caution:

- Achivadolimni

Explore-only / audit-needed despite static readiness:

- Gerania
- Kalamos
- Kapros
- Kipoi
- Kampanes
- Lagkada
- Nautikos Omilos Milou
- Papikinou
- Fyrlingos
- Psathi
- Pollonia
- Agkali
- Voudia

Unknown shelter/fetch profiles:

- Agios Ioannis
- Ammoudaraki
- Gerontas
- Theiafes
- Katergo
- Triades
- Psathi

High-priority local exceptions:

- Papikinou: currently low confidence, semi-sheltered/low fetch, protected sectors listed for north-sector winds, but no protected/calm label is allowed.
- Lagkada / Nautikos Omilos Milou: similar Adamas-bay style candidates, but still low confidence.
- Pollonia / Agkali: practical beaches with low-confidence northeast/east exposure behavior.

Recommendation:

- Do not loosen scoring to get more Milos top picks.
- First upgrade/downgrade specific Milos profiles with evidence.
- Start with practical, tourist-relevant beaches: Papikinou, Pollonia, Lagkada, Nautikos Omilos Milou, Kapros, Gerania, Voudia.
- Keep Achivadolimni as wind/watersports caution.

### Naxos

Status: full coverage, but still conservative.

Good:

- 39/39 beaches have profiles.
- 19 medium, 20 low.
- 0 high-confidence profiles, which is correct because Phase 1 uses geospatial/evidence gates and should not overclaim.
- 0 unknown shelter/fetch.
- Validation confirms no north-wind protection claims are created.
- Mikri Vigla is wind-sport caution and is not a calm/protected pick in 5 Bft north wind.

Top-eligible if today's conditions support it:

- Apollonas
- Vintzi
- Glyfada
- Paralia Kalandos
- Kastraki
- Kedros
- Lionas
- Pyrgaki
- Psili Ammos
- Hawaii

Explore-only / audit-needed despite static readiness:

- Agia Anna
- Agioi Theodoroi
- Agios Georgios
- Agios Prokopios
- Azalas
- Alyko
- Amitis
- Abram
- Grotta
- Ligaridia
- Mikra
- Mikri Vigla south side
- Mikro Alyko
- Moutsouna
- Orkos
- Panormos
- Plaka

Known wind-sport caution:

- Mikri Vigla

Recommendation:

- Do not upgrade Naxos low profiles only because they are popular.
- Prioritize Agia Anna, Agios Georgios, Agios Prokopios, Plaka, Mikri Vigla south side, Alyko/Mikro Alyko, and Orkos because these affect real tourist choices.
- Add validation scenarios for Naxos west-coast north wind, west/southwest wind, and Mikri Vigla split behavior.

## Scenario Behavior Summary

Passed scenario behavior:

| Scenario | Result |
| --- | --- |
| Paros N 3 Bft, wave 0.3m | 2 top recommendations, protected options rise, no hard warnings |
| Paros N 3 Bft choppy, wave 0.6m | 2 top recommendations, protected options remain good, no rough over-warning |
| Paros N 5 Bft, wave 1.4m | 0 top recommendations, no-ideal state, protected fallback visible only as avoid-swimming |
| Andros N 3 Bft, wave 0.35m | Piso Gialia top, no hard warning |
| Andros N 3 Bft choppy, wave 0.7m | Piso Gialia still good, no hard warning |
| Andros N 5 Bft, wave 1.8m | 0 top recommendations, no-ideal state |
| Naxos N 3 Bft, wave 0.35m | 2 top recommendations, partial/less-exposed options rise, no map/list mismatch |
| Milos N 3 Bft, wave 0.3m | 2 top recommendations, south/partial practical options rise |
| Milos N 3 Bft choppy, wave 0.7m | 2 top recommendations, caution not panic |
| Milos rain 3 Bft | 0 top recommendations, rain blocked |
| Milos N 4 Bft, wave 0.4m | 2 top recommendations, caution mode |
| Milos N 5 Bft, wave 1.5m | 0 top recommendations, no-ideal state |
| Milos S 5 Bft, wave 1.4m | 0 top recommendations, no-ideal state |

## Important Interpretation

"Only 1-2 top recommendations" is not automatically a bug.

The display limit is proportional to qualified candidates. If only a small number of beaches pass static trust, wind profile confidence, sea score, access, and warnings, the app may show fewer than 3. This is consistent with the current trust-first rules.

Forcing 3 cards by filling with exposed or low-confidence beaches would be worse than showing fewer trustworthy recommendations.

## Confirmed Non-Issues

These were checked and did not fail:

- Build/type safety via TypeScript lint: no TypeScript failure was observed in the prior check for this worktree.
- Static content safety: no risky live-condition wording found.
- Critical beach data: no critical/high/medium/low issues found by the critical validator.
- Existing wind scenario validations: passed.
- Recommendation scenario validations: passed.
- Low confidence profiles: blocked from protected/calm claims.
- Wind-sport profiles: warning behavior is active in meaningful wind.

## Actual Risks To Track

P0 trust risk:

- Milos and Naxos have many high-static / low-wind-profile beaches. This is safe in ranking, but it creates audit backlog and may make the app feel too conservative in some common tourist cases.

P1 recommendation coverage risk:

- In Andros and Naxos, some scenarios have a narrow top-pick pool. If the one or two top choices are unavailable, crowded, or not relevant to the user, the app may feel less helpful.

P1 explanation risk:

- Users should never see internal uncertainty wording like "low confidence" or "needs verification", but product/admin reports should keep that distinction explicit.

P2 scenario coverage risk:

- Current scenario coverage is strongest for Paros, Andros, Milos north/south, and Naxos north.
- More directional scenarios are needed for Naxos and Milos if those are the next launch focus.

P2 data-source risk:

- Geospatial inference should remain evidence, not verification. The current code mostly respects this.

## Recommended Next Steps

1. Freeze scoring until data audit decisions are made.
   - Do not change thresholds just to get more top picks.

2. Create a small "profile review queue" for Milos and Naxos.
   - Milos priority: Papikinou, Lagkada, Nautikos Omilos Milou, Pollonia, Agkali, Kapros, Gerania, Voudia.
   - Naxos priority: Agia Anna, Agios Georgios, Agios Prokopios, Plaka, Mikri Vigla south side, Alyko/Mikro Alyko, Orkos.

3. For each reviewed beach, decide one of four outcomes:
   - keep low confidence
   - upgrade to medium
   - downgrade exposure/shelter
   - mark known caution / local exception

4. Add validation scenarios before changing profiles.
   - Milos: N 4 Bft low wave, N 5 Bft rough, S 5 Bft, W/SW 4 Bft.
   - Naxos: N 3 Bft, N 5 Bft, W/SW 4 Bft, S 4-5 Bft, Mikri Vigla split.

5. After profile changes, run:
   - `node scripts/validateWindExposureEngine.mjs`
   - `node scripts/validateRecommendationScenarios.mjs`
   - `npm run content:audit`
   - `npm run lint`
   - `npm run build`
   - `git diff --check`

6. Only then adjust UI copy if users still see confusing recommendation wording.

## Bottom Line

The current system is conservative and mostly doing the right thing:

- It avoids false calm/protected claims.
- It refuses to promote low-confidence wind profiles as best-today picks.
- It handles wind-sport beaches cautiously.
- It shows no-ideal states in rough 5 Bft scenarios.

The cleanup should focus on targeted windProfile evidence, not broad scoring rewrites.

