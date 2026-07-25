# Hidden-beach discovery pipeline (non-OSM)

## Why this exists

Our beach dataset is **OSM-gated**. Beaches enter only via (a) the original curated core
(ids 0–2739), (b) the OSM harvest (`scripts/harvestBeachesOsm.mjs`: `natural=beach` +
`beach_resort`), and (c) the SEATRAC accessibility directory. Google/Wikidata/etc. only
*enrich* existing records — they never discover a new beach.

So the "coverage gap" report (`coverage:harvest` → `coverage:report`) can only surface a
beach **OSM already tags with a name**. It reported ~90% coverage — but that is 90% *of what
OSM knows*. Two whole classes are structurally invisible to it:

1. **Guide-only toponyms** — wild beaches locals/blogs name but OSM doesn't map at all.
2. **Unnamed OSM polygons** — `natural=beach` with no `name` tag are dropped by the harvest's
   name-key filter, so even though OSM has the geometry, the gap report never lists them.

Concrete example: **Καστρί / Γεραιστός** (SE Karystos, Evia) — a notable, historically
significant wild beach — was missing because it is exactly class (2): an *unnamed* OSM polygon
(`way/269212431`). The user asked why beaches like it (and «Κάρβουνα») weren't in the app;
this pipeline is the systematic answer.

## The model: flip the question

Instead of "what does OSM have that we lack", ask **"what beach exists on the ground that we
lack"**, using two independent free signals and cross-referencing them:

| Signal | Source | Tool |
|---|---|---|
| **Human toponyms** | Greek beach guides, blogs, Greek Wikipedia, topo.directory, Wikidata SPARQL (`scripts/harvestWikidata.mjs`) | web research (agent) → candidate name list |
| **OSM geometry** (named **and unnamed**) | Overpass `natural=beach` in a bbox, masked to the region | `scripts/discoverHiddenBeaches.mjs` |

The **sweet spot** is a guide NAME that lands on an OSM UNNAMED polygon we lack → real beach +
name + authoritative shoreline coordinate, all corroborated. (Καστρί = textbook case.)

## Steps (per region)

1. **Harvest candidate names** (free). Web-research the region's beaches from Greek guides +
   Wikipedia + topo.directory + Wikidata. Produce `scripts/data/<region>-candidates.json`
   rows: `{ nameGr, aliases?, locality, lat?/estLat?, sources[] }`. This is the one
   agent/manual step — guide sites are unstructured, so no scraper is committed.

2. **OSM harvest + gap report + candidate triage** (free, scripted):
   ```
   node scripts/discoverHiddenBeaches.mjs \
     --bbox=<S,W,N,E> --mask=<minLat,maxLat,minLon,maxLon> \
     --region="<Region>" --prefecture=<Pref> --municipality=<Muni> \
     [--candidates=scripts/data/<region>-candidates.json]
   ```
   - **`--bbox`** is the Overpass query box; **`--mask`** is the region-only clamp. The mask is
     essential: a bbox around a coastal region pulls in cross-region contamination (for SE Evia
     the bbox caught East-Attica mainland at lon<24.18 and NW Andros at lon>24.66). Use the
     region's `knownIslandCoordinateBounds` box from `scripts/validateCriticalBeachData.mjs`.
   - Reports OSM gaps (named / **unnamed**, distance-bucketed) and, per candidate, geocodes via
     Nominatim, dedups vs our dataset, and OSM-gap-tests via `fetchOverpassBeaches` (empty =
     truly OSM-invisible). Reuses `scripts/lib/placeResolution.mjs` (mirror failover, cache).
   - Interpreting unnamed gaps: **150–600 m from an existing pin = usually an OSM multipolygon
     split of a beach we already have** (NOT new); Petalioi-style offshore clusters = boat-only
     islands (defer). Only well-separated coves / guide-corroborated ones are real adds.

3. **Adversarially verify + pin** (free). For survivors, confirm each is a real, distinct,
   swimmable beach (not a headland/church/marina/alias) and pin the **shoreline** coordinate
   (OSM polygon > Wikimapia > topo.directory > guide map). Mark `ADD / DEFER / ALIAS / NOT_A_BEACH`.
   Conservative: no medium-confidence coordinate → DEFER.

4. **Promote** verified adds into a seed and insert:
   ```
   node scripts/insertDiscoveredBeaches.mjs plan  --seed=scripts/data/<region>-verified.json
   node scripts/insertDiscoveredBeaches.mjs apply --seed=scripts/data/<region>-verified.json
   ```
   Same dedup/slot guard as the OSM-gap inserter (≤150 m any-name / ≤600 m + Dice≥55 → alias),
   ids ≥3000, **every record `confidence:low` + `needsVerification:true`** + real source URLs +
   coordinate routing + honest `sourceNotes`. Access/terrain from guides are conservative and
   flagged unverified. **Do not** write shelter/calm words ("απάνεμη", "προστατευμένη") into any
   static field — the content safety gate (`content:audit`) rejects them; keep exposure claims
   out of prose and let the geometry engine compute them.

5. **Build + validate**:
   ```
   npm run build:beach-data
   npm run quality:beach-data && npm run contract:check && npm run content:audit
   node scripts/buildGeospatialExposureProfiles.mjs --land-geojson .tmp/geospatial/greece-land-osm-split.geojson   # bakes wind exposure; ~3 min, rewrites all generatedAt — restore timestamp-only files after
   ```
   Skip curated-wind islands (Paros/Andros/Milos/Naxos) unless you also author a windProfile
   override — their invariants in `windExposureValidation.ts` hard-fail otherwise.

## Cost & sources

Entirely **free**: OSM Overpass + Nominatim + Wikidata + guide sites. The Google Places key is
intentionally disabled (billing) — Google is optional confirmation only, gated behind an opt-in
flag, never required. Be polite: the shared Overpass/Nominatim client throttles + disk-caches.

## Pilot result — South Evia / Karystia (2026-07-23)

First run. Harvested ~24 candidates → **5 real wild beaches added** (ids 3114–3118), all the
guide∩OSM or topo-pinned class the OSM gap report could never surface:

| id | Beach | Coord | Why OSM-gated |
|----|-------|-------|---------------|
| 3117 | **Καστρί** (Γεραιστός) | 37.9757, 24.5387 | unnamed OSM polygon |
| 3114 | **Αμυγδαλιά** | 38.1260, 24.5823 | unnamed OSM polygon |
| 3115 | **Ευαγγελισμός** (Δράμεσι) | 38.0749, 24.5773 | not in OSM (topo.directory) |
| 3116 | **Ζαχαριάς** (Μύλος) | 38.1071, 24.5737 | not in OSM (topo.directory) |
| 3118 | **Σπηλίτσες** (Λιμιώνας) | 38.0456, 24.5816 | unnamed OSM polygon |

Findings that made the run honest:
- **All 44 *named* OSM beaches in south Evia were already in the app** — the blind spot is
  entirely unnamed geometry + guide-only names.
- **«Κάρβουνα» does NOT exist in Karystia.** The only Εύβοια Κάρβουνα is in the **north**
  (≈38.766, 23.598, N. Euboean Gulf) — and it is also missing from the app (parked, not yet added).
- Deferred/rejected with evidence: Παξιμάδα (headland), Άγιοι (church), Ρηγιά (section of an
  existing beach), Τσακαίοι (~270 m from existing Λιμνιώνα), Νησάκι/Τρυπιόβραχος/Κολυμπήθρα/
  Ματαλιά/Κάλαμος/Διπόταμος (real but unpinnable / boat / hike / overlap).

Seed: `scripts/data/hidden-evia-verified.json`. Report: `reports/coverage/hidden-discovery-central-greece.json`.

**Deferred follow-up for this batch:** geospatial exposure rebuild (step 5c) so the 5 pins get a
computed wind profile instead of the dashed "map-estimate" ring — batched, safe to run once the
working tree is clean.

## National rollout

Region-by-region (same model as the data-quality pilot). Per region: pick the bbox+mask from the
validation bounds, run steps 1–5, record yield (real adds) and false-positive rate. Prioritise
coasts rich in wild/guide-known beaches (Pelion, Mani, Karpathos, Ikaria, Kavo-Doro-style tips).
Also worth a national sweep: the **unnamed-OSM-polygon** class alone (step 2 without candidates)
across every region, filtered to well-separated coves — a large but noisy seam that needs the
split/island guardrails above before any insert.
