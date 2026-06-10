# Region Validation Playbook (v1)

How to verify a region's wind-exposure data end-to-end, derived from the Milos
golden-island audit (2026-06-10). Target: half a day for a mid-size island,
less for small ones. Prioritise the most touristic islands first.

## Prerequisites (once per data refresh)

- High-res OSM land mask: `node scripts/fetchHighResLandMask.mjs`
  → `.tmp/geospatial/greece-land-osm-split.geojson`
- Fresh exposure build: `node scripts/buildGeospatialExposureProfiles.mjs --land-geojson .tmp/geospatial/greece-land-osm-split.geojson`
  (always a FULL run — `--region` clobbers index.json)
- Both gates green: `node scripts/validateWindExposureEngine.mjs`,
  `node scripts/validateWindExposureGroundTruth.mjs`

## The decision rule (applies to every disputed rating)

A wrong **protected** is dangerous (it sends swimmers to an exposed beach);
a wrong **exposed** is merely conservative. Therefore:

- Adopting the LESS conservative version (e.g. accepting geometry-protected
  over curated-exposed) requires **at least TWO independent agreeing pieces of
  evidence**.
- The MORE conservative version requires only one.
- Insufficient or conflicting evidence ⇒ keep the most conservative version,
  add the beach to the region's `needs-field-verification` list, and move on —
  never block the flow on it.

Evidence sources, in order of availability:
1. **Detailed geometry**: OSM-mask probes around the pin (openings per 30°,
   inlet mouths, island shadows). `scripts/auditRegionPins.mjs` provides them.
2. **Web research** per beach name + island: travel guides, blogs, reviews
   mentioning "sheltered from meltemi", "calm water", "waves in north wind";
   windsurf/kitesurf references mean exposed. Verify claims at the SOURCE page —
   search-engine snippets misattribute (the Voudia "protected from northern
   winds" snippet could not be confirmed on any actual page).
3. **Neighbour consistency**: adjacent pins on the same shore with incompatible
   facings are a red flag — judge which one sits on a coastal corner
   (Nerodafni/Kampanes case), or which pin is misplaced (Andros Kolona case).
4. Curated record internals: `protectedFrom`, access type, sourceNotes
   (e.g. BOAT_ONLY + "west edge" exposed the Milos Agios Dimitrios pin error).

## Steps

1. **Pin audit** (~2 min): `node scripts/auditRegionPins.mjs --region <regionId>`
   - Fail flags: `FAR_FROM_COAST` (>150 m), `ORIGIN_JUMP` (≥0.3 km),
     `WEAK_NORMAL` (magnitude <0.15 — legitimate only for tombolos).
   - `NARROW_POCKET` (<100 m) is not a failure by itself: apply the
     **Vai pattern** (in an enclosed bay the facing must point at the mouth,
     ±30°) and the **Kolona anti-pattern** (facing disagreeing >90° with the
     curated orientation/protectedFrom ⇒ suspect pin on the wrong side).
2. **Engine dump** (~1 min): `node scripts/dumpRegionExposureEngine.mjs --region <regionId>`
   - Classify curated-vs-geometry disagreements: *policy hedge*
     (curated=partial because low confidence forbids protected claims — ignore)
     vs *factual conflict* (exposed↔protected — goes to the evidence queue).
   - `dFacing > 60°` between authored and geometry facing ⇒ evidence queue.
   - Check `map-vs-scoring` lines: explicit curated exposed sectors must not be
     overridden by geometry shelter on the map (guarded in code since
     2026-06-10, but new patterns may appear).
3. **Label scan** (seconds): `node scripts/scanRegionLabels.mjs --region <regionId>`
   - No raw enums may reach the UI; `access.type=unknown` renders as a clean
     "Access not verified" label but is still a data gap worth closing.
4. **Scenario sanity**: from the engine dump, read the four scenario tiers
   (meltemi N7 / S6 / NW5 / calm). Someone who knows the island judges the
   tiers; without local knowledge, check the tiers against guide statements
   gathered in the evidence step.
5. **Evidence-based resolution** of the queue, using the decision rule above.
   This step replaces human ground truth for islands where nobody on the team
   knows the coastline — budget ~10 min per disputed beach for web research.
6. **Apply fixes** (after approval if the session requires it):
   - Curated overrides: name-based entries, respect the island's confidence
     regime (e.g. Naxos must stay all-low; confidence upgrades need the
     two-source rule). Conservative exposure ADDITIONS need only geometry.
   - Pins are a separate, deliberate data task — never move coordinates
     casually; flag them instead.
7. **Rebuild + gates**: full exposure rebuild (only needed when pins changed —
   overrides do not affect the generated geometry), then BOTH gates, then
   `npm run lint`. Update pinned invariants in
   `scripts/windExposureValidation.ts` only with explicit geographic
   justification in a dated comment.
8. **Lock in ground truth**: add 2-3 HIGH-certainty verdicts from the region to
   `scripts/validateWindExposureGroundTruth.mjs` so the next mask/data refresh
   cannot silently regress them.

## Islands without curated coverage (most of them)

Geometry is the only runtime source there (via the medium/high-confidence
backfill — verify the island is listed in
`GEOSPATIAL_WIND_PROFILE_BACKFILL_ISLANDS`, `utils/windExposureEngine.ts`).
Consequences:
- Steps 1 and the dFacing screen carry double weight: a bad pin reaches the
  user with no curated layer to catch it.
- Prioritise the meltemi sectors (N/NE) — that is what a summer tourist sees.
- The evidence queue comes from geometry self-checks instead of
  curated-vs-geometry: NARROW_POCKET pins, WEAK_NORMAL non-tombolos,
  protected sectors with suspiciously short fetch next to big open water.
- Resolved verdicts that matter should be captured as new curated overrides
  (that is how coverage grows island by island).

## Pass/fail criteria per region

- 0 unresolved FAR_FROM_COAST / ORIGIN_JUMP flags.
- 0 factual exposed↔protected conflicts without a verdict.
- 0 raw enums in user-facing labels.
- Scenario tiers reviewed (locally or via evidence).
- Both gates green; any invariant change carries a dated geographic
  justification.
- `needs-field-verification` list recorded (memory/notes), not blocking.

## Time estimate

| Phase | Time |
|---|---|
| Scripts (steps 1-4) | ~15 min |
| Triage + classification | 30-45 min |
| Evidence resolution (5-10 beaches) | 1-2 h |
| Fixes + rebuild + gates | 30-60 min |
| **Total per mid-size island** | **~half a day** |
