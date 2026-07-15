# MODEL-SPEC — Τεχνικός απολογισμός του γεωμετρικού μοντέλου έκθεσης σε άνεμο (wind-shelter model)

> Καθαρά περιγραφικό έγγραφο (audit), όχι αξιολόγηση. Κάθε ισχυρισμός συνοδεύεται από αυτούσιο
> (verbatim) απόσπασμα κώδικα/δεδομένων με `file:line`. Όπου δεν υπήρχε επαρκής απόδειξη, ο
> ισχυρισμός σημειώνεται ρητά ως `ΑΒΕΒΑΙΟ: ...`.

## 0. Κατάσταση αποθετηρίου κατά τον έλεγχο

```
$ git branch
* forecast-caching-safety-tier-a
  main
  ... (13 ακόμη branches)

$ git status
On branch forecast-caching-safety-tier-a
Changes not staged for commit:
  modified:   scripts/prerenderBeachPages.mjs
Untracked files:
  reports/content-briefs/
  reports/snapshots/
  scripts/audit-false-protected.mjs
  scripts/audit-region-counts.mjs

$ git log -1
commit 716cd552bcdb20761e41f6e31b582770c81e2b0d
Author: Miltos <miltos@local.dev>
Date:   Mon Jul 13 09:08:48 2026 +0300
    LocalWindShelter: context-aware copy (μελτέμι/μαΐστρος/καλοκαιρινός αέρας)
```

Το working tree **δεν** είναι καθαρό (1 τροποποιημένο αρχείο εκτός του μοντέλου έκθεσης, 4
untracked στοιχεία εκτός μοντέλου). Το checked-out branch είναι `forecast-caching-safety-tier-a`,
όχι `main` — δεν πρέπει να θεωρηθεί «ό,τι τρέχει σε production» χωρίς επιβεβαίωση ξεχωριστά.

---

## 1. INVENTORY

### 1.1 Αρχεία που συνθέτουν το μοντέλο

**Πυρήνας γεωμετρίας/ray-casting (runtime + build, shared):**
- `utils/geospatialExposureModel.ts` — ray casting, fetch sampling, shoreline-orientation
  (`facingDeg`), onshore component, directional-intensity formula. Χρησιμοποιείται και από το
  build script και από το runtime resolver.

**Build-time (offline, παράγει τα static JSON profiles):**
- `scripts/geospatialExposureProfiles.ts` — entry point του precompute: φορτώνει την ακτογραμμή
  (GeoJSON), χτίζει το land mask + spatial grid index, τρέχει `assessGeospatialWindExposure` για
  κάθε παραλία × 8 τομείς, γράφει `public/data/geospatial/exposure/<region>.json` + `index.json`.
- `scripts/fetchHighResLandMask.mjs` — κατεβάζει/φιλτράρει το OSM land-polygons dataset σε
  `.tmp/geospatial/greece-land-osm-split.geojson`, που τροφοδοτεί το `--land-geojson` του παραπάνω.

**Runtime resolver (ζωντανή εκτίμηση ανά πρόγνωση/ώρα):**
- `utils/windExposureModel.ts` — `resolveWindExposure`: γραμμική παρεμβολή μεταξύ 2 γειτονικών
  τομέων στην ακριβή γωνία ανέμου, ενοποιημένη λογική facing/exposure.
- `utils/windExposureEngine.ts` — `assessBeachWindExposure`: ενσωματώνει το `resolveWindExposure`
  μέσα στην ιεραρχία πηγών (curated προφίλ, windsurf/kite spots, geometry escalation, suspectPin).
- `utils/windExposure.ts` — **παλαιότερη**, ανεξάρτητη υλοποίηση: `calculateWindExposure`
  (γωνιακά buckets ανά 45°) + `estimateBeachOrientation` (vector-sum από `protectedFrom[]`).
- `utils/waveModel.ts` — SMB fetch-limited μοντέλο ύψους κύματος (`estimateFetchLimitedWaveHeightM`).
- `utils/swellExposure.ts` — `assessSwellExposure`: γεωμετρικός έλεγχος direct-swell, με fallback
  στο legacy `calculateWindExposure` όταν λείπει `facingDeg`.
- `services/geospatialExposureService.ts` — φορτώνει/cache-άρει τα per-region JSON profiles στο
  browser και τα φιλτράρει (`isUsableGeneratedProfile`).

**Δεδομένα:**
- `public/data/geospatial/exposure/index.json` + 110 per-region JSON αρχεία (π.χ.
  `public/data/geospatial/exposure/south-aegean-milos.json`).
- `.tmp/geospatial/greece-land-osm-split.geojson` (gitignored, δεν είναι committed).

### 1.2 Call graph (πραγματικά import/call sites, όχι εικασία)

```
scripts/geospatialExposureProfiles.ts
  └─ imports assessGeospatialWindExposure, computeDirectionalExposure,
             computeShorelineOrientation, onshoreComponent,
             resolveNearshoreWaterOrigin  (utils/geospatialExposureModel.ts:1-11)
  └─ γράφει public/data/geospatial/exposure/*.json

services/geospatialExposureService.ts:76 loadGeospatialExposureProfiles(regionId)
  ← καλείται από App.tsx:2471, App.tsx:2495  (fetch ανά region στο UI)

utils/windExposureModel.ts
  └─ imports computeDirectionalExposure, onshoreComponent (geospatialExposureModel.ts:9-11)
  └─ imports calculateWindExposure, estimateBeachOrientation, windDirectionToDegrees
             (utils/windExposure.ts:17-21) ← legacy fallback path

utils/windExposureEngine.ts:570 resolveWindExposure(...)   [μοναδικό call site]
utils/windExposureEngine.ts:540 assessBeachWindExposure(...)
  ← καλείται από:
     App.tsx:806, App.tsx:3465
     pages/BeachDetailPage.tsx:1065,1101,1156
     components/BeachSearcherHome.tsx:1341
     services/recommendationService.ts:535,1325,1989
     services/beachPlannerService.ts:158
     scripts/windExposureValidation.ts (>40 κλήσεις — validation harness)
     scripts/auditCycladesMediumHighCandidates.mjs:167, auditCycladesMapExposureIntegrity.mjs:121,
     auditIslandGroupMapExposureIntegrity.mjs:128, dumpRegionExposureEngine.ts:65,
     colorDistributionAudit.ts:93, validateMeltemiMatrix.ts:104, windBannerConsistencyAudit.ts:71

utils/swellExposure.ts:44 assessSwellExposure(...)
  ← καλείται από services/recommendationService.ts:1570
  └─ imports calculateWindExposure (utils/windExposure.ts:2) ως fallback όταν profile.facingDeg==null

utils/waveModel.ts:20 imports GROUND_SWELL_MIN_PERIOD_S από utils/swellExposure.ts
components/BeachMap.tsx:756 getExposureMarkerTone(...) — χρωματισμός pin (Beaufort × level)
```

### 1.3 Παράλληλες/«νεκρές» υλοποιήσεις — ΥΠΑΡΧΟΥΝ, ενεργές

Δεν είναι νεκρός κώδικας· είναι **ενεργή παράλληλη υλοποίηση** που συνεχίζει να καλείται σε
πολλαπλά σημεία σήμερα:

`utils/windExposure.ts:33-60` (`estimateBeachOrientation`) και `utils/windExposure.ts:68-123`
(`calculateWindExposure`) — παλαιότερη γωνιακή προσέγγιση (buckets 45°, angular diff, όχι
ray-casting) που προϋπήρχε του γεωμετρικού μοντέλου. Ενεργές κλήσεις σήμερα:

```
utils/mapExposure.ts:97:    const angularExposure = calculateWindExposure(profile.beachFacingDirection, windDirectionDeg).exposureLevel;
utils/mapExposure.ts:135:    ? calculateWindExposure(orientation, windDirectionDeg).exposureLevel
utils/mapExposure.ts:143:  const legacyOrientation = estimateBeachOrientation(protectedFrom || []);
utils/swellExposure.ts:64:      exposed = calculateWindExposure(beachOrientationDeg, directionDeg!).exposureLevel === 'exposed';
utils/windExposureModel.ts:138:  return estimateBeachOrientation(input.protectedFrom || []);
utils/windExposureModel.ts:211:      ? calculateWindExposure(legacyOrientation, windDeg).exposureLevel
utils/windExposureEngine.ts:321:    const legacyExposure = calculateWindExposure(legacyOrientation, windDirectionDeg).exposureLevel;
utils/windExposureEngine.ts:507:  const angularExposure = calculateWindExposure(profile.beachFacingDirection, windDirectionDeg).exposureLevel;
```

Το `docs/exposure-model-v3-roadmap.md:62-64` καταγράφει ρητά ότι, τη στιγμή εκείνη
(2026-06-12), το direct-swell check χρησιμοποιούσε *«το legacy `calculateWindExposure`
(γωνιακά buckets 45°, όχι γεωμετρία)»*. Ελέγχθηκε το τρέχον `utils/swellExposure.ts:44-65`: το
πρωτεύον μονοπάτι είναι πλέον γεωμετρικό (`onshore = cos(swellDir-facingDeg)` +
`blockedRayRatio < 0.6`, γραμμές 57-62), με το legacy `calculateWindExposure` να παραμένει ως
**fallback μόνο όταν `profile?.facingDeg` είναι `null`** (γραμμή 63-64) — άρα το R1 της
οδηγίας `docs/exposure-model-v3-roadmap.md` φαίνεται να έχει υλοποιηθεί, αλλά η παλιά
συνάρτηση παραμένει στο codebase και συνεχίζει να τροφοδοτεί το fallback μονοπάτι.

`ΑΒΕΒΑΙΟ:` δεν επαληθεύτηκε αν όλα τα σημεία κλήσης του `calculateWindExposure`/
`estimateBeachOrientation` παραπάνω βρίσκονται σε ενεργά μονοπάτια production (μερικά, π.χ.
`utils/mapExposure.ts`, ενδέχεται να εξυπηρετούν παλαιότερα UI στοιχεία) — μόνο επιβεβαιώθηκε ότι
ο κώδικας υπάρχει και καλείται από άλλο ενεργό κώδικα (όχι dead-code-eliminated), δεν
ελέγχθηκε bundle-level αν κάθε caller φτάνει live σε render.

---

## 2. COASTLINE DATA

### 2.1 Dataset(s), path, format, μέγεθος

Το build script διαβάζει τη διαδρομή μέσω `--land-geojson` (`scripts/geospatialExposureProfiles.ts:140-146`):

```ts
const customLandGeoJson = parseArgValue('--land-geojson');
const landGeoJsonPath = path.resolve(customLandGeoJson || defaultLandGeoJsonPath);
const isHighResMask = Boolean(customLandGeoJson);
```

Το `public/data/geospatial/exposure/index.json` (τρέχον committed αρχείο δεδομένων) δηλώνει ρητά
ποιο dataset χρησιμοποιήθηκε στο τελευταίο πλήρες rebuild:

```json
"source": {
  "landMask": {
    "name": "High-resolution coastline (greece-land-osm-split.geojson)",
    "url": "C:\\Users\\Miltos\\Desktop\\beach\\.tmp\\geospatial\\greece-land-osm-split.geojson",
    "confidence": "high"
  }
},
"generatedAt": "2026-06-26T22:46:48.104Z"
```
(`public/data/geospatial/exposure/index.json`, γραμμές 6-12, 3)

**Το αρχείο υπάρχει σήμερα στο δίσκο** στο `.tmp/geospatial/greece-land-osm-split.geojson`,
μέγεθος **34.8 MB** (μετρήθηκε: `fs.statSync` → `34761165` bytes = 34.8 MB), mtime
`2026-07-04 23:21` (τοπικό αρχείο, πιο πρόσφατο από το `generatedAt` του index.json παραπάνω —
δηλαδή το προφίλ δεδομένων που είναι committed παράχθηκε στις 26/06, αλλά το τοπικό land-mask
αρχείο ξαναφτιάχτηκε στις 04/07· `ΑΒΕΒΑΙΟ:` αν έγινε πλήρες rebuild μετά τις 04/07 ή όχι — το
committed `index.json` γράφει ακόμη `generatedAt: 2026-06-26`).

Ο ίδιος φάκελος περιέχει επίσης το ωμό ZIP πηγής, **923 MB**
(`.tmp/geospatial/osm-land/land-polygons-split-4326.zip`, `ls -la` → 923404788 bytes) και τον
αποσυμπιεσμένο shapefile στο `.tmp/geospatial/osm-land/land-polygons-split-4326/`. Το σημείωμα
μνήμης ανέφερε ένα 920MB αρχείο που είχε αφαιρεθεί από `.tmp` — **σήμερα υπάρχει ξανά** (το ZIP,
923 MB) μαζί με το ήδη φιλτραρισμένο-για-Ελλάδα προϊόν (34.8 MB GeoJSON) που τροφοδοτεί το μοντέλο.
Κανένα από τα δύο δεν είναι committed στο git:

```
$ git check-ignore -v .tmp/geospatial/greece-land-osm-split.geojson
.gitignore:29:.tmp/	.tmp/geospatial/greece-land-osm-split.geojson
```

Άρα το build χρησιμοποιεί ένα **τοπικό, μη-committed** dataset· το μόνο committed προϊόν είναι τα
ήδη υπολογισμένα per-region JSON exposure profiles στο `public/data/geospatial/exposure/`.

Χωρίς `--land-geojson`, το script πέφτει σε baseline (`scripts/geospatialExposureProfiles.ts:90-91`):
```ts
const naturalEarthLandUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson';
const defaultLandGeoJsonPath = path.join(root, '.tmp', 'geospatial', 'ne_10m_land.geojson');
```
`ΑΒΕΒΑΙΟ:` αν αυτό το baseline αρχείο υπάρχει σήμερα στο δίσκο δεν ελέγχθηκε (δεν βρέθηκε στο
`.tmp/geospatial` listing που εξετάστηκε — μόνο `greece-land-osm-split.geojson`,
`national-pin-audit.json`, `osm-land/`).

### 2.2 Πηγή, license, πότε αντλήθηκε

`scripts/fetchHighResLandMask.mjs:5-16` (σχόλιο κεφαλίδας, verbatim):
```
 *   1. Downloads the OSM-derived land polygons, SPLIT variant, WGS84
 *      (https://osmdata.openstreetmap.de/data/land-polygons.html). The split
 *      variant keeps every polygon small, which is required for fast
 *      point-in-polygon tests — never feed the builder unsplit continental
 *      polygons (GSHHG full etc.).
```
`scripts/fetchHighResLandMask.mjs:36`: `const downloadUrl = 'https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip';`

Πότε αντλήθηκε: το script δεν γράφει timestamp μέσα στο ίδιο το GeoJSON· η μόνη απόδειξη είναι το
mtime του αρχείου στο δίσκο (`.tmp/geospatial/osm-land/land-polygons-split-4326.zip`,
`Jul 4 23:19`, και το εξαγόμενο `greece-land-osm-split.geojson`, `Jul 4 23:21`). Το git log δείχνει
πότε προστέθηκε το *script* (όχι τα δεδομένα, gitignored):
```
$ git log --oneline --all -- scripts/fetchHighResLandMask.mjs
9751cde5 Add high-res land mask pipeline for geospatial exposure builds
```
License: `index.json` δηλώνει `"license": "Public domain / open data"`
(`public/data/geospatial/exposure/index.json`, μέσα στο `source.landMask`).

### 2.3 Ανάλυση — πραγματικός υπολογισμός απόστασης μεταξύ διαδοχικών vertices

Γράφτηκε ένα throwaway script στο scratchpad
(`…/scratchpad/vertexDist.mjs`, **όχι στο repo**) που φόρτωσε ολόκληρο το committed-on-disk
`.tmp/geospatial/greece-land-osm-split.geojson` (34.8 MB, 15.946 features/πολύγωνα), υπολόγισε
haversine απόσταση για κάθε διαδοχικό ζεύγος vertex σε κάθε ring, σε **όλα** τα segments (καμία
δειγματοληψία — εξαντλητικός υπολογισμός):

```json
{
  "featureCount": 15946,
  "polygonCount": 15946,
  "ringCount": 15946,
  "vertexCount": 1406124,
  "segmentCount": 1390178,
  "meanM": "38.79",
  "medianM": "10.96",
  "minM": "0.0089",
  "maxM": "111306.1",
  "p90M": "47.20",
  "p99M": "136.81"
}
```
(πραγματική έξοδος τρεξίματος `node vertexDist.mjs`, 2026-07-13)

Δηλαδή: **median ≈ 11 m, μέσος όρος ≈ 38.8 m** μεταξύ διαδοχικών vertices, με 90ό εκατοστημόριο
στα ~47 m και 99ό στα ~137 m. Το μέγιστο segment (111.3 km) είναι στατιστικό ακραίο σημείο ενός
μεγάλου πολυγώνου (π.χ. ήπειρος/μεγάλο νησί με ένα ασυνήθιστα μακρύ segment)·
`ΑΒΕΒΑΙΟ:` δεν εντοπίστηκε ποιο ακριβώς πολύγωνο/ζεύγος coordinates παράγει το 111 km segment.
Επίσης: `ringCount === polygonCount === featureCount` (15946=15946=15946) — καμία από τις
γεωμετρίες δεν έχει δεύτερο ring (holes) στο ίδιο feature· το split variant αναπαριστά κάθε
μικρό κομμάτι ξηράς ως ξεχωριστό απλό polygon.

### 2.4 Simplification (Douglas-Peucker)

Δεν βρέθηκε καμία κλήση simplification/tolerance μέσα στο pipeline του land mask
(`scripts/geospatialExposureProfiles.ts`, `scripts/fetchHighResLandMask.mjs`,
`utils/geospatialExposureModel.ts`) — το mask χρησιμοποιείται όπως έρχεται από το OSM split
download, χωρίς προεπεξεργασία γεωμετρίας πέρα από spatial filtering στα όρια Ελλάδας
(`scripts/fetchHighResLandMask.mjs:102-127`, bbox intersection).

Douglas-Peucker **βρέθηκε**, αλλά σε **διαφορετικό** pipeline — τα ribbon slices του χάρτη (οπτική
απεικόνιση ακτογραμμής, όχι το μοντέλο έκθεσης):
```ts
// scripts/buildCoastlineRibbons.mjs:31-32
/** Douglas-Peucker simplification tolerance (metres) — keeps slices small. */
const SIMPLIFY_TOLERANCE_M = 18;
```
Αυτό το tolerance (18 m) εφαρμόζεται **μόνο** στο layer «χρωματισμένη ακτογραμμή στον χάρτη»
(`scripts/buildCoastlineRibbons.mjs:66-82`, συνάρτηση `simplify`), όχι στο land mask που
τροφοδοτεί το ray-casting.

### 2.5 Islets/βράχια, συνολικό πλήθος πολυγώνων

`public/data/geospatial/exposure/index.json` → `"indexedLandPolygons": 15946`
(αριθμός πολυγώνων μετά το φιλτράρισμα bbox στα όρια Ελλάδας
`scripts/geospatialExposureProfiles.ts:94-99, 174-179`). Ο ίδιος αριθμός επιβεβαιώθηκε ανεξάρτητα
από το throwaway script στο §2.3 (`polygonCount: 15946`) διαβάζοντας απευθείας το αρχείο. Το split
variant του OSM download περιλαμβάνει ρητά μικρά islets/βράχια ως ξεχωριστά πολύγωνα (αυτός είναι
ο σκοπός του "split" — `scripts/fetchHighResLandMask.mjs:9-11`, σχόλιο: *"keeps every polygon
small"*)· δεν εντοπίστηκε ρητό ελάχιστο μέγεθος φιλτραρίσματος πολυγώνου στο pipeline μας πέρα
από `outerRing.length < 4` (εκφυλισμένα rings, `scripts/geospatialExposureProfiles.ts:210`).

### 2.6 Spatial indexing

Sparse grid (όχι R-tree): `scripts/geospatialExposureProfiles.ts:278-315` —

```ts
// Sparse grid over the Greece bounds mapping cell -> polygons whose bbox
// touches it, so each isLand call tests a handful of candidate polygons
// instead of scanning the whole mask. With a split OSM coastline (thousands
// of small polygons) this is the difference between minutes and hours.
const GRID_CELL_DEG = 0.05;
```
κελί 0.05° (≈5.5 km στο γεωγραφικό πλάτος της Ελλάδας), κάθε πολύγωνο καταχωρείται σε όλα τα
κελιά που τέμνει το bbox του (γραμμές 298-312)· το `isLand` (γραμμές 327-340) περιορίζεται στους
υποψήφιους του κελιού και μόνο εκεί τρέχει ακριβές point-in-polygon (ray-casting
even-odd, `pointInRing`, γραμμές 244-262).

---

## 3. RAY-CASTING CORE

Ο πυρήνας βρίσκεται στο `utils/geospatialExposureModel.ts`. Πλήρεις συναρτήσεις, verbatim:

```ts
// utils/geospatialExposureModel.ts:55-78
export const destinationPoint = (
  point: GeoPoint,
  bearingDeg: number,
  distanceKm: number
): GeoPoint => {
  const bearing = normalizeDegrees(bearingDeg) * Math.PI / 180;
  const distance = distanceKm / EARTH_RADIUS_KM;
  const lat1 = point.lat * Math.PI / 180;
  const lon1 = point.lon * Math.PI / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance) +
    Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: lat2 * 180 / Math.PI,
    lon: normalizeLongitude(lon2 * 180 / Math.PI),
  };
};
```

```ts
// utils/geospatialExposureModel.ts:93-117 (η ίδια η ακτίνα)
const sampleFetchRay = (
  beach: GeoPoint,
  bearingDeg: number,
  landMask: LandMask,
  maxFetchKm: number,
  stepKm: number,
  nearshoreLandGraceKm: number
): FetchRaySample => {
  for (let distanceKm = stepKm; distanceKm <= maxFetchKm; distanceKm += stepKm) {
    const samplePoint = destinationPoint(beach, bearingDeg, distanceKm);
    if (landMask.isLand(samplePoint) && distanceKm > nearshoreLandGraceKm) {
      return {
        bearingDeg: normalizeDegrees(bearingDeg),
        openWaterKm: Number(Math.max(0, distanceKm - stepKm).toFixed(2)),
        blockedByLand: true,
      };
    }
  }

  return {
    bearingDeg: normalizeDegrees(bearingDeg),
    openWaterKm: maxFetchKm,
    blockedByLand: false,
  };
};
```

```ts
// utils/geospatialExposureModel.ts:313-359 (aggregate ανά sector)
export const assessGeospatialWindExposure = ({
  beach,
  windDirectionDeg,
  landMask,
  maxFetchKm = DEFAULT_MAX_FETCH_KM,
  stepKm = DEFAULT_STEP_KM,
  nearshoreLandGraceKm = 0,
  nearshoreWaterSearchKm = DEFAULT_NEARSHORE_WATER_SEARCH_KM,
  nearshoreWaterSearchStepKm = DEFAULT_NEARSHORE_WATER_SEARCH_STEP_KM,
  sampleOrigin: providedSampleOrigin,
  sampleOriginAdjustedKm,
  fanAnglesDeg = DEFAULT_FAN_ANGLES_DEG,
}: GeospatialExposureInput): GeospatialExposureResult => {
  const sampleOrigin = providedSampleOrigin
    ? { point: providedSampleOrigin, adjustedKm: sampleOriginAdjustedKm ?? 0 }
    : resolveNearshoreWaterOrigin(beach, landMask, nearshoreWaterSearchKm, nearshoreWaterSearchStepKm);
  const samples = fanAnglesDeg.map(offsetDeg => sampleFetchRay(
    sampleOrigin.point,
    windDirectionDeg + offsetDeg,
    landMask,
    maxFetchKm,
    stepKm,
    nearshoreLandGraceKm
  ));
  const averageFetchKm = samples.reduce((sum, sample) => sum + sample.openWaterKm, 0) / samples.length;
  const blockedRayRatio = samples.filter(sample => sample.blockedByLand).length / samples.length;
  const exposureLevel = classifyFetchExposure(averageFetchKm, blockedRayRatio);

  return {
    exposureLevel,
    openWaterFetchKm: Number(averageFetchKm.toFixed(2)),
    blockedRayRatio: Number(blockedRayRatio.toFixed(2)),
    samples,
    confidence: landMask.confidence,
    reason: `${landMask.source}: ${samples.length} upwind fetch rays, average open water ${averageFetchKm.toFixed(1)} km, ${(blockedRayRatio * 100).toFixed(0)}% blocked by land${sampleOrigin.adjustedKm > 0 ? `, sampled from nearest water ${sampleOrigin.adjustedKm.toFixed(1)} km from beach coordinate` : ''}.`,
    sampleOrigin: sampleOrigin.point,
    sampleOriginAdjustedKm: sampleOrigin.adjustedKm,
  };
};
```

### 3.1 Πλήθος ακτίνων ανά τομέα, γωνιακό βήμα

Ανά τομέα ανέμου (8 τομείς, βλ. §4) ρίχνεται μια «βεντάλια» **5 ακτίνων**:
```ts
// scripts/geospatialExposureProfiles.ts:117
const fanAnglesDeg = [-30, -15, 0, 15, 30];
```
Ίδια default τιμή ορίζεται και μέσα στο ίδιο το core module:
```ts
// utils/geospatialExposureModel.ts:50
const DEFAULT_FAN_ANGLES_DEG = [-30, -15, 0, 15, 30];
```
Δηλαδή 5 ακτίνες, γωνιακό βήμα 15°, εύρος βεντάλιας ±30° γύρω από την κεντρική κατεύθυνση του
τομέα (0°=σημείο τομέα).

Ξεχωριστά, το `computeShorelineOrientation` (facing) χρησιμοποιεί **36 ακτίνες ανά 10°** (πλήρης
κύκλος 360°) — άλλος σκοπός (προσδιορισμός προς τα πού «κοιτάζει» η ακτή, όχι fetch):
```ts
// utils/geospatialExposureModel.ts:190-192
const DEFAULT_ORIENTATION_MAX_KM = 3;
const DEFAULT_ORIENTATION_STEP_KM = 0.1;
const DEFAULT_ORIENTATION_BEARING_STEP_DEG = 10;
```

### 3.2 Μέγιστη απόσταση fetch· τι επιστρέφεται αν δεν βρεθεί ξηρά

`maxFetchKm = 25` στο build (`scripts/geospatialExposureProfiles.ts:112`). Αν καμία δειγματοληψία
μέχρι τα 25 km δεν βρει ξηρά, η `sampleFetchRay` (§3, γραμμές 112-116) επιστρέφει
`openWaterKm: maxFetchKm, blockedByLand: false` — δηλαδή **ρητά 25.0 km**, όχι `null`/`Infinity`.
Επιβεβαιώθηκε πραγματικά με ζωντανή εκτέλεση (§5): η Πλατανιάς Χανίων παίρνει `"fetchKm": 25,
"blockedRayRatio": 0` στον τομέα N.

Default τιμή στο ίδιο module (χρησιμοποιείται μόνο όταν caller δεν περνά ρητή τιμή, π.χ.
`scripts/windExposureValidation.ts`): `DEFAULT_MAX_FETCH_KM = 20`
(`utils/geospatialExposureModel.ts:46`).

### 3.3 Αλγόριθμος τομής ακτίνας/ακτογραμμής

Δεν γίνεται γεωμετρική τομή ευθείας-πολυγώνου· γίνεται **διακριτή δειγματοληψία σημείων** κατά
μήκος του μεγάλου κύκλου (`destinationPoint`, §3 πάνω, spherical bearing/distance formula) με
βήμα `stepKm`, και σε κάθε σημείο ελέγχεται point-in-polygon (`landMask.isLand`) μέχρι να βρεθεί
ξηρά ή να εξαντληθεί το `maxFetchKm`. Το point-in-polygon test είναι even-odd ray casting σε
lat/lon (όχι μετρικό επίπεδο):
```ts
// scripts/geospatialExposureProfiles.ts:244-262
const pointInRing = (point: GeoPoint, ring: FlatRing): boolean => {
  let inside = false;
  const x = point.lon;
  const y = point.lat;
  const vertexCount = ring.length / 2;

  for (let i = 0, j = vertexCount - 1; i < vertexCount; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
};
```

### 3.4 Σημείο εκκίνησης της ακτίνας (origin)

Όχι πάντα το ίδιο το pin. Το `resolveNearshoreWaterOrigin`
(`utils/geospatialExposureModel.ts:159-188`) μετακινεί το σημείο εκκίνησης αν το pin είναι πάνω σε
ξηρά ή σε πολύ μικρή/κλειστή υδάτινη τσέπη:

```ts
// utils/geospatialExposureModel.ts:159-188
export const resolveNearshoreWaterOrigin = (
  beach: GeoPoint,
  landMask: LandMask,
  maxSearchKm: number,
  searchStepKm: number,
  minOpenWaterKm = 0
): { point: GeoPoint; adjustedKm: number } => {
  const qualifies = (point: GeoPoint): boolean => (
    !landMask.isLand(point) &&
    (minOpenWaterKm <= 0 || hasOpenWaterPassage(point, landMask, minOpenWaterKm))
  );

  if (qualifies(beach)) {
    return { point: beach, adjustedKm: 0 };
  }

  for (let distanceKm = searchStepKm; distanceKm <= maxSearchKm; distanceKm += searchStepKm) {
    for (let bearingDeg = 0; bearingDeg < 360; bearingDeg += NEARSHORE_SEARCH_BEARING_STEP_DEG) {
      const candidate = destinationPoint(beach, bearingDeg, distanceKm);
      if (qualifies(candidate)) {
        return { point: candidate, adjustedKm: Number(distanceKm.toFixed(2)) };
      }
    }
  }

  return { point: beach, adjustedKm: 0 };
};
```
`NEARSHORE_SEARCH_BEARING_STEP_DEG = 15` (γραμμή 51). Στο build: `nearshoreWaterSearchKm=12`,
βήμα αναζήτησης `0.1 km` (high-res) ή `0.5 km` (Natural Earth baseline)
(`scripts/geospatialExposureProfiles.ts:113-127`). Επιβεβαιώθηκε πραγματικά (§5): η Πλατανιάς
μετατοπίστηκε 0.1 km από το αρχικό pin σε νέο origin πριν ρίξει ακτίνες.

### 3.5 Μοίρες ή ακτίνες; βήμα ανά κύκλο

Όλες οι γωνίες στο module είναι σε **μοίρες** (degrees) εξωτερικά· η μετατροπή σε ακτίνια γίνεται
τοπικά μέσα σε κάθε τριγωνομετρική συνάρτηση, π.χ.:
```ts
// utils/geospatialExposureModel.ts:60
const bearing = normalizeDegrees(bearingDeg) * Math.PI / 180;
```
και ξανά στο onshore component:
```ts
// utils/geospatialExposureModel.ts:256-258
export const onshoreComponent = (windFromDeg: number, facingDeg: number): number => (
  Math.cos((normalizeDegrees(windFromDeg) - normalizeDegrees(facingDeg)) * Math.PI / 180)
);
```

### 3.6 Ανοιχτός ορίζοντας, αντίκρυ ακτές, εσωτερικοί κόλποι

- **Ανοιχτός ορίζοντας**: αν καμία ακτίνα δεν βρει ξηρά μέχρι `maxFetchKm`, επιστρέφεται πλήρες
  fetch (§3.2) — δεν υπάρχει ειδικός κλάδος «open horizon», είναι απλά το φυσικό αποτέλεσμα του
  loop.
- **Εσωτερικοί κόλποι/λιμνοθάλασσες**: `hasOpenWaterPassage`
  (`utils/geospatialExposureModel.ts:142-157`) απορρίπτει ως origin σημεία με λιγότερο από
  `minOpenWaterKm` συνεχόμενο ανοιχτό νερό σε *οποιαδήποτε* από 12 γωνίες (βήμα 30°):
  ```ts
  // utils/geospatialExposureModel.ts:142-157
  const hasOpenWaterPassage = (
    point: GeoPoint,
    landMask: LandMask,
    minOpenWaterKm: number
  ): boolean => {
    const stepKm = Math.min(0.1, minOpenWaterKm / 2);
    for (let bearingDeg = 0; bearingDeg < 360; bearingDeg += 30) {
      let openKm = 0;
      for (let distanceKm = stepKm; distanceKm <= minOpenWaterKm; distanceKm += stepKm) {
        if (landMask.isLand(destinationPoint(point, bearingDeg, distanceKm))) break;
        openKm = distanceKm;
      }
      if (openKm >= minOpenWaterKm - stepKm / 2) return true;
    }
    return false;
  };
  ```
  Το ίδιο το docstring (γραμμές 135-141) ομολογεί ρητά τον περιορισμό:
  > `KNOWN LIMIT: this is a local open-span test, NOT sea connectivity — a lagoon wider than
  > minOpenWaterKm ... still qualifies, so a spit-beach pin closer to the lagoon than the sea
  > could get a lagoon-side origin with inverted facing.`
- **Αντίκρυ ακτές (facing coastlines)**: δεν εντοπίστηκε ειδικός κλάδος διαφορετικός από το απλό
  ray-vs-land test — μια αντίκρυ ακτή απλά εμφανίζεται ως land hit σε κάποια απόσταση < 25 km.

---

## 4. SCORING

### 4.1 Aggregation N ακτίνων → 1 τιμή ανά τομέα

Αριθμητικός **μέσος όρος** (mean), όχι worst-case ούτε σταθμισμένος:
```ts
// utils/geospatialExposureModel.ts:345-346
const averageFetchKm = samples.reduce((sum, sample) => sum + sample.openWaterKm, 0) / samples.length;
const blockedRayRatio = samples.filter(sample => sample.blockedByLand).length / samples.length;
```

### 4.2 Ταξινόμηση τομέα χωρίς facing (fallback)

```ts
// utils/geospatialExposureModel.ts:119-126
const classifyFetchExposure = (
  averageFetchKm: number,
  blockedRayRatio: number
): ExposureLevel => {
  if (averageFetchKm >= 8 && blockedRayRatio < 0.4) return 'exposed';
  if (averageFetchKm <= 2 && blockedRayRatio >= 0.6) return 'protected';
  return 'partial';
};
```

| Συνθήκη | Επίπεδο |
|---|---|
| mean fetch ≥ 8 km **και** blocked < 0.4 | exposed |
| mean fetch ≤ 2 km **και** blocked ≥ 0.6 | protected |
| οτιδήποτε άλλο | partial |

### 4.3 Ένταση όταν υπάρχει facing (`computeDirectionalExposure`)

```ts
// utils/geospatialExposureModel.ts:273-311
const FETCH_SATURATION_KM = 12;
const OPENNESS_RAMP_START_KM = 8;
const EXPOSED_INTENSITY = 60;
const PROTECTED_INTENSITY = 33;

export const computeDirectionalExposure = ({ fetchKm, blockedRayRatio, onshore }: DirectionalExposureInput): DirectionalExposure => {
  const onshoreFactor = (Math.max(-1, Math.min(1, onshore)) + 1) / 2;
  const fetchFactor = Math.max(0, Math.min(1, fetchKm / FETCH_SATURATION_KM));
  const saturation = Math.max(0, Math.min(1, (fetchKm - OPENNESS_RAMP_START_KM) / (FETCH_SATURATION_KM - OPENNESS_RAMP_START_KM)));
  const openness = saturation + (1 - saturation) * (1 - Math.max(0, Math.min(1, blockedRayRatio)));
  const intensity = Number((100 * onshoreFactor * (0.6 + 0.4 * fetchFactor * openness)).toFixed(1));

  const level: ExposureLevel = intensity >= EXPOSED_INTENSITY
    ? 'exposed'
    : intensity >= PROTECTED_INTENSITY
      ? 'partial'
      : 'protected';

  return { intensity, level };
};
```

Πίνακας σταθερών (πραγματικές τιμές από τον κώδικα):

| Σταθερά | Τιμή | Ρόλος |
|---|---|---|
| `FETCH_SATURATION_KM` | 12 km | fetch πάνω από αυτό δεν αυξάνει άλλο την ένταση |
| `OPENNESS_RAMP_START_KM` | 8 km | από εδώ αρχίζει να «σβήνει» η ποινή του blockedRayRatio |
| `EXPOSED_INTENSITY` | 60 | κατώφλι intensity → exposed |
| `PROTECTED_INTENSITY` | 33 | κατώφλι intensity → partial (κάτω από αυτό: protected) |
| `GEOMETRY_EXPOSURE_ESCALATION_FETCH_KM` | 8 km | (windExposureEngine.ts:474) κατώφλι climb authored-partial→exposed |

Ορισμός «protected» (πλήρης boolean συνθήκη, στο fallback-χωρίς-facing μονοπάτι):
`averageFetchKm <= 2 && blockedRayRatio >= 0.6` (§4.2)· στο μονοπάτι-με-facing:
`intensity < 33`, όπου `intensity = 100 · onshoreFactor · (0.6 + 0.4 · fetchFactor · openness)`.

### 4.4 Πώς προκύπτει το `facingDeg` και η σχέση του με τις ακτίνες

```ts
// utils/geospatialExposureModel.ts:220-247
export const computeShorelineOrientation = (
  origin: GeoPoint,
  landMask: LandMask,
  maxKm: number = DEFAULT_ORIENTATION_MAX_KM,
  bearingStepDeg: number = DEFAULT_ORIENTATION_BEARING_STEP_DEG,
  stepKm: number = DEFAULT_ORIENTATION_STEP_KM
): number | null => {
  let sumX = 0;
  let sumY = 0;
  let totalWeight = 0;

  for (let bearingDeg = 0; bearingDeg < 360; bearingDeg += bearingStepDeg) {
    const openKm = openWaterAlongBearing(origin, bearingDeg, landMask, maxKm, stepKm);
    const rad = normalizeDegrees(bearingDeg) * Math.PI / 180;
    sumX += openKm * Math.sin(rad);
    sumY += openKm * Math.cos(rad);
    totalWeight += openKm;
  }

  if (totalWeight === 0) return null;

  const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
  if (magnitude / totalWeight < 0.08) return null;

  const facing = (Math.atan2(sumX, sumY) * 180 / Math.PI + 360) % 360;
  return Number(facing.toFixed(1));
};
```
Είναι ένα ξεχωριστό, πυκνότερο sweep (36 ακτίνες/10°, έως 3 km — §3.1) γύρω από το ίδιο origin
που χρησιμοποιείται για το fetch. Είναι το open-water-weighted resultant vector: αν είναι
συμμετρικό (νησίδα, `magnitude/totalWeight < 0.08`) επιστρέφει `null` — και τότε ο τομέας πέφτει
στο fallback classification (§4.2) χωρίς ένταση/onshore (`scripts/geospatialExposureProfiles.ts:413-419`).

### 4.5 Πού μπαίνει η κατεύθυνση ανέμου

**Δύο σημεία**, build-time και runtime:
1. **Build-time** (offline, μία φορά ανά παραλία): 8 σταθερές τιμές `windDirectionDeg`
   (0/45/90/135/180/225/270/315 — `scripts/geospatialExposureProfiles.ts:101-110`) — μία ανά
   compass sector, αποθηκεύεται στατικά στο JSON.
2. **Runtime** (ζωντανά, ανά πρόγνωση): `utils/windExposureModel.ts:78-100` κάνει γραμμική
   παρεμβολή μεταξύ των 2 γειτονικών από τους 8 προ-υπολογισμένους τομείς στην ακριβή γωνία της
   ζωντανής πρόγνωσης:
   ```ts
   // utils/windExposureModel.ts:78-100
   const interpolateSector = (
     profile: GeospatialExposureProfile,
     windDirectionDeg: number
   ): InterpolatedSector => {
     const position = normalizeDegrees(windDirectionDeg) / 45;
     const lower = Math.floor(position) % SECTORS.length;
     const upper = (lower + 1) % SECTORS.length;
     const t = position - Math.floor(position);
     const a = profile.sectors[SECTORS[lower]];
     const b = profile.sectors[SECTORS[upper]];
     const intensity = typeof a.intensity === 'number' && typeof b.intensity === 'number'
       ? lerp(a.intensity, b.intensity, t)
       : undefined;
     return { fetchKm: lerp(a.fetchKm, b.fetchKm, t), blockedRayRatio: lerp(a.blockedRayRatio, b.blockedRayRatio, t), intensity, levels: [a.level, b.level] };
   };
   ```
   Δηλαδή η γεωμετρία (fetch/blocked/facing) είναι **baked στατικά** ανά 45°· η ζωντανή πρόγνωση
   ανέμου παρεμβάλλεται πάνω σε αυτά, δεν ξαναρίχνει ακτίνες.

### 4.6 Ιεραρχία πηγών πάνω από το γεωμετρικό μοντέλο (`assessBeachWindExposure`)

Verbatim, `utils/windExposureEngine.ts:582-609`:
```ts
  // Curated authored profiles encode local knowledge and a deliberately
  // conservative shelter policy (e.g. semi_sheltered stays 'partial'), so they
  // win. Only where there is no authored profile do we let the geometry resolver
  // (geospatial fetch + onshore/offshore) decide the level.
  let exposureLevel: ExposureLevel = source === 'unknown' && input.geospatialProfile
    ? unified.level
    : exposureFromProfile(
      profile, source, windSector, input.windDirection, input.windDirectionDeg,
      input.beach, canClaimProtected, isKnownWindSportRisk
    );
  // Solution B: an authored "partial" cannot stand against >=8 km of open
  // onshore fetch in a high-confidence mask — the map already shows these as
  // exposed (geometry wins there), so this aligns scoring with the map in the
  // conservative direction. Authored explicit claims and protected levels are
  // untouched.
  if (
    exposureLevel === 'partial' &&
    source !== 'unknown' &&
    geometryEscalatesToExposed(input.geospatialProfile, windSector)
  ) {
    exposureLevel = 'exposed';
  }
```
δηλαδή: το γεωμετρικό μοντέλο αποφασίζει το level **μόνο** όταν δεν υπάρχει επιμελημένο
(«curated»/authored) προφίλ (`source === 'unknown'`)· διαφορετικά το επιμελημένο προφίλ
υπερισχύει, με μία εξαίρεση κλιμάκωσης προς exposed (§4.6.1).

`canClaimProtectedFromWind` (`utils/windExposureEngine.ts:488-496`):
```ts
export const canClaimProtectedFromWind = (
  profile: WindProfile,
  windSector: WindSector
): boolean => (
  profile.confidence !== 'low' &&
  isSheltered(profile.shelterLevel) &&
  profile.protectedFromWindDirections.includes(windSector) &&
  !profile.knownWindSportSpot
);
```

#### 4.6.1 Κλιμάκωση ασφαλείας (Solution B)

```ts
// utils/windExposureEngine.ts:466-486
const GEOMETRY_EXPOSURE_ESCALATION_FETCH_KM = 8;

const geometryEscalatesToExposed = (
  profile: GeospatialExposureProfile | undefined,
  windSector: WindSector
): boolean => {
  const sector = profile?.sectors?.[windSector];
  return Boolean(
    profile?.confidence === 'high' &&
    sector?.level === 'exposed' &&
    (sector.fetchKm ?? 0) >= GEOMETRY_EXPOSURE_ESCALATION_FETCH_KM
  );
};
```
Ένα επιμελημένο «partial» κλιμακώνεται σε «exposed» μόνο όταν η γεωμετρία υψηλής εμπιστοσύνης
δείχνει τον τομέα ως `exposed` **και** το mean fetch του τομέα είναι ≥ 8 km — ποτέ αντίστροφα
(δεν υπάρχει συμμετρικός κλάδος «geometryDe-escalatesToProtected»).

---

## 5. TRACE — 3 πραγματικές παραλίες

### 5.1 Μέθοδος επιλογής

Τα stored profile JSON (`public/data/geospatial/exposure/<region>.json`) αποθηκεύουν μόνο
**συγκεντρωτικά** στοιχεία ανά τομέα (`fetchKm`, `blockedRayRatio`, `onshore`, `intensity`,
`level`) — **όχι** τα ακατέργαστα per-ray δείγματα (5 τιμές ανά τομέα). Γράφτηκε throwaway script
(`…/scratchpad/scanProfiles.mjs`, όχι στο repo) που διάβασε **και τα 111 αρχεία** (110 regions +
index), 2.799 παραλίες, και υπολόγισε για κάθε παραλία: μέσο fetch στους 8 τομείς, πλήθος
protected/exposed τομέων, και (όπου υπάρχει) την ένταση του τομέα N. Επιλέχθηκαν:

- **Protected**: παραλίες ταξινομημένες κατά (πλήθος protected τομέων ↓, μέσο fetch ↑) — 2η θέση
  (η 1η, id 859, αποκλείστηκε γιατί το fetch είναι 0 σε **όλους** τους τομείς, ύποπτο· βλ. §6.4/§7).
- **Exposed**: αναζητήθηκαν ρητά παραλίες με `sectors.N.level === 'exposed'`, ταξινομημένες κατά
  φθίνουσα ένταση N — επιλέχθηκε η πρώτη με `intensity: 100` (max saturation).
- **Borderline**: αναζητήθηκε η παραλία με `sectors.N.intensity` πλησιέστερα στα κατώφλια 33/60
  (§4.3) — επιλέχθηκε `intensity === 33` ακριβώς (πάνω στο ίδιο το boundary partial/protected).

### 5.2 Μέθοδος επαλήθευσης: **ζωντανή εκτέλεση**, όχι μόνο ανάγνωση

Για να δειχθούν τα πραγματικά per-ray δείγματα (που δεν αποθηκεύονται), γράφτηκε
`…/scratchpad/auditTrace.mjs` που:
1. Μεταγλωττίζει με `esbuild` το πραγματικό `utils/geospatialExposureModel.ts` σε ES module
   (καμία αλλαγή λογικής — απλή μεταγλώττιση TS→JS).
2. Φορτώνει ολόκληρο το πραγματικό, committed-on-disk land mask (34.8 MB, 15.946 πολύγωνα) και
   ξαναχτίζει το ίδιο sparse-grid index (ίδιος αλγόριθμος με
   `scripts/geospatialExposureProfiles.ts:278-315`, αντιγραμμένος σε αυτό το read-only script).
3. Καλεί **τις πραγματικές, εισαγόμενες** `resolveNearshoreWaterOrigin`,
   `computeShorelineOrientation`, `assessGeospatialWindExposure` με τα ίδια production defaults
   (`stepKm=0.2`, `nearshoreLandGraceKm=0.1`, `maxFetchKm=25`, `fanAnglesDeg=[-30,-15,0,15,30]`)
   για wind sector Β (0°), για τις 3 επιλεγμένες παραλίες.

Η ζωντανή έξοδος ταυτίστηκε ακριβώς με τα stored `fetchKm`/`blockedRayRatio` του committed JSON
(0.04 / 25 / 2.04 αντίστοιχα) — επιβεβαιώνει ότι το committed dataset παρήχθη πράγματι από αυτή
τη συνάρτηση πάνω σε αυτό το land mask.

### 5.3 Παραλία 1 — «Protected»: Paralia Kolona, Kythnos (id 1888)

Πηγή επιλογής: `public/data/geospatial/exposure/south-aegean-kythnos.json`, πεδίο
`profiles["1888"]` — 6/8 τομείς `"level":"protected"`, μέσο fetch 2.14 km.

Stored profile (verbatim, `south-aegean-kythnos.json`):
```json
"coordinates": { "lat": 37.41407, "lon": 24.37917 },
"facingDeg": null,
"sectors": {
  "N":  { "level": "protected", "fetchKm": 0.04, "blockedRayRatio": 1 },
  "NE": { "level": "protected", "fetchKm": 0.12, "blockedRayRatio": 1 },
  "E":  { "level": "protected", "fetchKm": 0.6,  "blockedRayRatio": 1 },
  "SE": { "level": "protected", "fetchKm": 0.88, "blockedRayRatio": 1 },
  "S":  { "level": "protected", "fetchKm": 0,    "blockedRayRatio": 1 },
  "SW": { "level": "protected", "fetchKm": 0.04, "blockedRayRatio": 1 },
  "W":  { "level": "partial",   "fetchKm": 10.16,"blockedRayRatio": 0.6 },
  "NW": { "level": "partial",   "fetchKm": 5.28, "blockedRayRatio": 0.8 }
}
```
`facingDeg: null` → ο τομέας N χρησιμοποιεί το **fallback** classification (§4.2), όχι ένταση.

**Ζωντανή εκτέλεση** (per-ray table, τομέας N = 0°, βεντάλια [-30,-15,0,15,30]°):

| bearing | openWaterKm | blockedByLand |
|---|---|---|
| 330° | 0.20 | true |
| 345° | 0.00 | true |
| 0°   | 0.00 | true |
| 15°  | 0.00 | true |
| 30°  | 0.00 | true |

mean fetch = 0.04 km, blocked = 5/5 = 1.00 → `classifyFetchExposure(0.04, 1.00)` → `protected`
(συνθήκη `fetch ≤ 2 && blocked ≥ 0.6`).

**Στη UI, άνεμος Β 5 Beaufort**: με `exposureLevel='protected'`,
`getExposureMarkerTone` (`components/BeachMap.tsx:790-807`) υπολογίζει `isExposed = false`,
`beaufort=5 ≥ 5` → `tones.orange` (πορτοκαλί pin· ο κώδικας δεν διαχωρίζει protected από partial
στο εύρος 5-6 Bft, μόνο exposed/not-exposed — βλ. §7).

### 5.4 Παραλία 2 — «Exposed»: Platanias, Crete-Chania (id 574)

Πηγή επιλογής: σάρωση όλων των profiles για `sectors.N.level === 'exposed'` (622 παραλίες εθνικά
πληρούν αυτό μόνο για τον τομέα N), ταξινομημένες κατά φθίνουσα `sectors.N.intensity` — πρώτη με
`intensity: 100`.

Stored profile (verbatim, `crete-crete-chania.json`):
```json
"coordinates": { "lat": 35.51979, "lon": 23.89893 },
"facingDeg": 2,
"sectors": {
  "N":  { "level": "exposed",   "fetchKm": 25,    "blockedRayRatio": 0,   "onshore": 0.999,  "intensity": 100 },
  "NE": { "level": "exposed",   "fetchKm": 19,    "blockedRayRatio": 0.4, "onshore": 0.731,  "intensity": 86.5 },
  "E":  { "level": "protected", "fetchKm": 4.32,  "blockedRayRatio": 1,   "onshore": 0.035,  "intensity": 31 },
  "SE": { "level": "protected", "fetchKm": 0.12,  "blockedRayRatio": 1,   "onshore": -0.682, "intensity": 9.5 },
  "S":  { "level": "protected", "fetchKm": 0,     "blockedRayRatio": 1,   "onshore": -0.999, "intensity": 0 },
  "SW": { "level": "protected", "fetchKm": 0.04,  "blockedRayRatio": 1,   "onshore": -0.731, "intensity": 8.1 },
  "W":  { "level": "protected", "fetchKm": 4.92,  "blockedRayRatio": 1,   "onshore": -0.035, "intensity": 28.9 },
  "NW": { "level": "exposed",   "fetchKm": 17.96, "blockedRayRatio": 0.6, "onshore": 0.682,  "intensity": 84.1 }
}
```

**Ζωντανή εκτέλεση** (τομέας N):

| bearing | openWaterKm | blockedByLand |
|---|---|---|
| 330° | 25 | false |
| 345° | 25 | false |
| 0°   | 25 | false |
| 15°  | 25 | false |
| 30°  | 25 | false |

Όλες οι 5 ακτίνες φτάνουν το cap 25 km χωρίς να βρουν ξηρά → mean=25, blocked=0. `facingDeg` (live)
= 2° (σχεδόν καθαρά βόρεια στραμμένη ακτή) → `onshore = cos(0−2°) = 0.999` → `computeDirectionalExposure`:
`onshoreFactor=(0.999+1)/2=0.9995`, `fetchFactor=min(25/12,1)=1`, `saturation=min(1,(25-8)/(12-8))=1`
(πλήρης saturation, το `blockedRayRatio=0` δεν παίζει ρόλο εδώ), `openness=1`,
`intensity=100·0.9995·(0.6+0.4·1·1)=99.95≈100` → `level='exposed'` (≥60).

**Στη UI, άνεμος Β 5 Beaufort**: `exposureLevel='exposed'` → `isExposed=true` →
`beaufort≥5` → `tones.red` (κόκκινο pin).

Σημείωση εντιμότητας: η Πλατανιάς είναι «exposed» ειδικά στους τομείς N/NE/NW· στους S/SW/SE/E
είναι «protected» (intensity 0-31) — δηλαδή είναι κατευθυντικά εξαρτημένη, όχι «πάντα εκτεθειμένη».
Επιλέχθηκε ακριβώς επειδή ο τομέας N (που ζητήθηκε για το trace) είναι το πιο ξεκάθαρο exposed
δείγμα στο dataset.

### 5.5 Παραλία 3 — «Borderline»: Makryammos, Thasos (id 845)

Πηγή επιλογής: σάρωση όλων των profiles, `|sectors.N.intensity − 33|` ή `|... − 60|` ελάχιστο —
`dist = 0.00` (ακριβώς πάνω στο κατώφλι partial/protected).

Stored profile (verbatim, `east-macedonia-and-thrace-thasos.json`):
```json
"coordinates": { "lat": 40.77026, "lon": 24.72621 },
"facingDeg": 84.3,
"sectors": {
  "N":  { "level": "partial",   "fetchKm": 2.04,  "blockedRayRatio": 1,   "onshore": 0.099,  "intensity": 33 },
  "NE": { "level": "exposed",   "fetchKm": 16.96, "blockedRayRatio": 0.6, "onshore": 0.774,  "intensity": 88.7 },
  "E":  { "level": "exposed",   "fetchKm": 25,    "blockedRayRatio": 0,   "onshore": 0.995,  "intensity": 99.8 },
  "SE": { "level": "exposed",   "fetchKm": 10.08, "blockedRayRatio": 0.6, "onshore": 0.633,  "intensity": 68.5 },
  "S":  { "level": "protected", "fetchKm": 0.04,  "blockedRayRatio": 1,   "onshore": -0.099, "intensity": 27 },
  "SW": { "level": "protected", "fetchKm": 0,     "blockedRayRatio": 1,   "onshore": -0.774, "intensity": 6.8 },
  "W":  { "level": "protected", "fetchKm": 0,     "blockedRayRatio": 1,   "onshore": -0.995, "intensity": 0.2 },
  "NW": { "level": "protected", "fetchKm": 0,     "blockedRayRatio": 1,   "onshore": -0.633, "intensity": 11 }
}
```

**Ζωντανή εκτέλεση** (τομέας N):

| bearing | openWaterKm | blockedByLand |
|---|---|---|
| 330° | 0    | true |
| 345° | 0    | true |
| 0°   | 0    | true |
| 15°  | 0    | true |
| 30°  | 10.20| true |

mean fetch = (0+0+0+0+10.2)/5 = 2.04 km, blocked = 5/5 = 1.00. Με `facingDeg=84.3°`,
`onshore = cos(0−84.3°) = 0.099` (σχεδόν along-shore, ελαφρώς onshore). `computeDirectionalExposure`:
`onshoreFactor=(0.099+1)/2=0.5495`, `fetchFactor=min(2.04/12,1)=0.17`, `saturation=max(0,(2.04-8)/4)=0`
(κάτω από `OPENNESS_RAMP_START_KM`), `openness=0+1·(1-1)=0` (blockedRayRatio=1 → πλήρης ποινή),
`intensity=100·0.5495·(0.6+0.4·0.17·0)=100·0.5495·0.6=32.97≈33.0` → ακριβώς στο κατώφλι
`PROTECTED_INTENSITY=33` → `level='partial'` (γιατί η συνθήκη είναι `intensity>=33`).

**Στη UI, άνεμος Β 5 Beaufort**: `exposureLevel='partial'` → `isExposed=false` (μόνο 'exposed'
θεωρείται exposed στο μάρκερ) → `beaufort≥5` → `tones.orange` (πορτοκαλί pin — ίδιο χρώμα με το
protected παράδειγμα §5.3, βλ. §7 για τη συνέπεια αυτή).

---

## 6. DISTRIBUTION

Υπολογίστηκε πραγματικά (`…/scratchpad/scanProfiles.mjs`) διαβάζοντας **και τα 110 region files**
(`public/data/geospatial/exposure/*.json`, εξαιρουμένου `index.json`), σύνολο **2.799 παραλίες**,
**22.392 sector-level εγγραφές** (2.799 × 8).

### 6.1 Ιστόγραμμα επιπέδων ανά τομέα (εθνικό, 8 τομείς × 2.799 παραλίες)

| Level | Πλήθος | % |
|---|---|---|
| protected | 11.624 | 51.9% |
| partial   | 4.653  | 20.8% |
| exposed   | 6.115  | 27.3% |

(σύνολο 22.392, ταιριάζει ακριβώς)

### 6.2 % «protected» sectors ανά περιοχή — Top 10

| Region | # παραλίες | % protected sectors |
|---|---|---|
| east-macedonia-and-thrace-xanthi-mainland | 3 | 66.7% |
| south-aegean-pserimos | 3 | 58.3% |
| central-greece-viotia-mainland | 8 | 56.3% |
| north-aegean-oinousses | 8 | 56.3% |
| south-aegean-halki | 2 | 56.3% |
| south-aegean-iraklia | 2 | 56.3% |
| attica-poros | 11 | 55.7% |
| central-greece-fthiotida-mainland | 18 | 55.6% |
| south-aegean-sikinos | 5 | 55.0% |
| south-aegean-kimolos | 17 | 54.4% |

### 6.3 % «protected» sectors ανά περιοχή — Bottom 10

| Region | # παραλίες | % protected sectors |
|---|---|---|
| south-aegean-schinoussa | 8 | 50.0% |
| west-greece-ileia-mainland | 16 | 50.0% |
| central-greece-skyros | 21 | 49.4% |
| north-aegean-ikaria | 19 | 49.3% |
| south-aegean-folegandros | 16 | 49.2% |
| epirus-preveza-mainland | 26 | 49.0% |
| thessaly-larissa-coast-agia---kissavos | 9 | 48.6% |
| crete-gavdos | 9 | 47.2% |
| south-aegean-santorini | 13 | 44.2% |
| ionian-islands-erikoussa | 2 | 43.8% |

`ΑΒΕΒΑΙΟ:` οι περιοχές με πολύ μικρό πλήθος παραλιών (π.χ. 2-3) έχουν στατιστικά ασταθές
ποσοστό· δεν εφαρμόστηκε κατώφλι ελάχιστου μεγέθους δείγματος σε αυτή την κατάταξη.

### 6.4 Παραλίες με ελλιπή/μηδενική/default γεωμετρία

Εθνικά (`index.json`, πεδίο `summary`): `"missingCoordinates": 0` από 2.799 — καμία παραλία δεν
λείπει συντεταγμένες στο τρέχον committed dataset.

**Όλες οι ακτίνες σε max fetch (25 km, ύποπτο "no real land hit")**: σαρώθηκαν όλες οι 2.799
παραλίες για `fetches.every(f => f >= 24.99)` σε όλους τους 8 τομείς ταυτόχρονα: **0 παραλίες**
πληρούν αυτό (καμία παραλία δεν είναι "ανοιχτή θάλασσα προς όλες τις κατευθύνσεις" — αναμενόμενο,
αφού κάθε παραλία βρίσκεται δίπλα σε ξηρά προς τουλάχιστον μία κατεύθυνση).

**Όλες οι ακτίνες σε fetch 0 (ύποπτο "εγκλωβισμένο σημείο")**: **1 παραλία** εθνικά:
```json
{
  "regionId": "east-macedonia-and-thrace-xanthi-mainland",
  "beachId": "859",
  "name": "Paralia Galanis Nestou",
  "fetches": [0,0,0,0,0,0,0,0]
}
```
Πλήρες stored profile: `facingDeg: null`, και οι 8 τομείς `"level":"protected","fetchKm":0,
"blockedRayRatio":1`. Αυτό ταιριάζει με το ήδη τεκμηριωμένο «Nestos delta residual» (μνήμη:
Map evidence ring rebuild) — πιθανό artifact γεωμετρίας δέλτα ποταμού/λιμνοθάλασσας.

**Σημαντικό εύρημα ασφαλείας (verified στο §services/geospatialExposureService.ts)**: αυτό
ακριβώς το προφίλ (859) **απορρίπτεται ως μη-χρησιμοποιήσιμο στο runtime**:
```ts
// services/geospatialExposureService.ts:39-50
const isUsableGeneratedProfile = (profile: RawGeospatialExposureProfile): boolean => {
  const levels = windSectors.map(sector => profile.sectors?.[sector]?.level);
  if (levels.some(level => !level)) return false;

  // All-protected used to signal a degenerate (land-locked) sample. With the
  // geometry model an enclosed bay is legitimately protected from every sector,
  // so only reject all-protected when we also failed to find a facing direction.
  const allProtected = levels.every(level => level === 'protected');
  if (allProtected && (profile.facingDeg === null || profile.facingDeg === undefined)) return false;

  return true;
};
```
Δηλαδή: `levels.every('protected') && facingDeg==null` → το προφίλ αυτής της παραλίας
**φιλτράρεται εντελώς** πριν φτάσει στο scoring/UI· η παραλία 859 στην πράξη σκοράρεται χωρίς
γεωμετρικό προφίλ (fallback σε άλλες πηγές, βλ. §4.6).

---

## 7. GAPS

Καταγράφονται μόνο ευρήματα με ρητό κώδικα-απόδειξη· δεν προτείνεται καμία διόρθωση.

### 7.1 Αδρανής/inert παράμετρος (τεκμηριωμένη ρητά στο ίδιο το σχόλιο)

```ts
// utils/geospatialExposureModel.ts:87-92
// NOTE: nearshoreLandGraceKm only has an effect when it is >= stepKm (a land hit is
// forgiven only at distances <= grace, and the first sample already sits at stepKm).
// Both shipped build configs set grace < step (0.3 vs 0.5 baseline, 0.1 vs 0.2
// high-res), so the mask-noise forgiveness it advertises is currently INERT —
// behaviour equals grace 0. Activating it means grace >= stepKm plus a full
// geometry rebuild (needs the OSM land mask via scripts/fetchHighResLandMask.mjs).
```
Επιβεβαιώθηκε αριθμητικά: build χρησιμοποιεί `highResNearshoreLandGraceKm=0.1` <
`highResStepKm=0.2` (`scripts/geospatialExposureProfiles.ts:125-126`) — η «συγχώρεση θορύβου
μάσκας» δεν ενεργοποιείται ποτέ στην πράξη.

### 7.2 Dead-code μεταβλητή στο χρωματισμό χάρτη

```ts
// components/BeachMap.tsx:791
const isProtected = exposureLevel === 'protected';
```
Η μεταβλητή `isProtected` υπολογίζεται αλλά **δεν χρησιμοποιείται πουθενά αλλού** μέσα στην
`getExposureMarkerTone` (επιβεβαιώθηκε: `grep -n "isProtected" components/BeachMap.tsx` επιστρέφει
μόνο αυτή τη γραμμή ορισμού). Η πραγματική λογική χρωματισμού διακρίνει μόνο `isExposed` έναντι
«όλα τα άλλα» — δηλαδή στην πράξη τα `protected` και `partial` παίρνουν **το ίδιο pin color** σε
κάθε επίπεδο Beaufort (§5.3 vs §5.5, και τα δύο πορτοκαλί στα 5 Bft), παρότι το backend datamodel
τα διακρίνει ρητά σε δύο επίπεδα.

### 7.3 Dead/unused default constant

`DEFAULT_MAX_FETCH_KM = 20` (`utils/geospatialExposureModel.ts:46`) δεν χρησιμοποιείται από
κανέναν εντοπισμένο caller: το production build περνά ρητά `maxFetchKm: 25`
(`scripts/geospatialExposureProfiles.ts:112,387`), και το validation script περνά ρητά
`maxFetchKm: 12` (`scripts/windExposureValidation.ts:1346,1350,1356`). `ΑΒΕΒΑΙΟ:` δεν αποκλείεται
πλήρως κάποιο άλλο, μη εντοπισμένο call site να βασίζεται στο default.

### 7.4 Παράλληλη υλοποίηση εξακολουθεί να τροφοδοτεί fallback μονοπάτια

Βλ. §1.3: `utils/windExposure.ts` (`calculateWindExposure`, `estimateBeachOrientation`) —
προγενέστερη γωνιακή προσέγγιση, ενεργή σε ≥8 σημεία κλήσης σήμερα, μερικά ως πρωτεύον μονοπάτι
(`utils/mapExposure.ts`) και μερικά ως ρητό fallback (`utils/swellExposure.ts:63-64`,
`utils/windExposureEngine.ts:507` όταν λείπει `authoredFacingDeg`/geospatial profile).

### 7.5 Παραδοχές χωρίς runtime επικύρωση (τεκμηριωμένες στα ίδια τα σχόλια)

- `hasOpenWaterPassage` (§3.6): «local open-span test, NOT sea connectivity» — μια πλατιά
  λιμνοθάλασσα μπορεί να περάσει σαν έγκυρο open-water origin.
  `utils/geospatialExposureModel.ts:135-140`: *«The eight classic Greek lagoon-spit beaches were
  spot-checked in the shipped data (2026-07-02) and all resolve sea-side; a real fix needs a
  flood-fill/connectivity test + full rebuild.»* — δηλαδή δειγματοληπτικός έλεγχος 8 παραλιών, όχι
  εξαντλητικός, για μια παραδοχή που ισχύει εθνικά.
- Ευθείες ακτίνες δεν μοντελοποιούν περίθλαση κύματος σε στενά στόμια κόλπων — ρητά τεκμηριωμένο
  στο `docs/methodology-wind-exposure-GR.md:230-231` και αναλυμένο εκτενώς στο
  `docs/exposure-model-v3-roadmap.md` (§1β, γραμμές 96-114) ως γνωστό, μη-διορθωμένο κενό
  (η προτεινόμενη διόρθωση R3 αναφέρεται ως *ΜΗ υλοποιημένη* — «ABORTED» στην κορυφή του
  εγγράφου, γραμμές 6-8).
- Το «Α1 aliasing» (στενά κανάλια <15-20° μπορούν να πέσουν ανάμεσα στις 5 ακτίνες της βεντάλιας
  και να δώσουν false-protected) περιγράφεται ρητά ως ανοιχτό, μη διορθωμένο πρόβλημα:
  `docs/exposure-model-v3-roadmap.md:82` (πίνακας Α1) — «Α1 aliasing … παραμένει καλυμμένο από
  curated overrides στα ελεγμένα νησιά· … το ρίσκο ζει στα ~70 ανέλεγκτα» (γραμμή 29-30).
- `nearshoreMinOpenWaterKm = 0.5` (`scripts/geospatialExposureProfiles.ts:131`) είναι ένα
  hardcoded κατώφλι χωρίς τεκμηριωμένη ευαισθησία (sensitivity analysis) στον ίδιο τον κώδικα.

### 7.6 Σημεία που διαβάστηκαν αλλά δεν επιβεβαιώθηκαν πλήρως

`ΑΒΕΒΑΙΟ:` το ακριβές generation timestamp του committed `index.json`
(`2026-06-26T22:46:48.104Z`) προηγείται του mtime του τοπικού land-mask αρχείου
(`2026-07-04 23:21`) — δεν επιβεβαιώθηκε αν το committed dataset αντιστοιχεί ακριβώς στο σημερινό
τοπικό land-mask ή σε παλαιότερη εκδοχή του (το ίδιο URL/όνομα αρχείου θα μπορούσε να έχει
ξαναφορτωθεί με ελαφρώς διαφορετικό περιεχόμενο OSM data μεταξύ 26/06 και 04/07).

`ΑΒΕΒΑΙΟ:` το ακριβές πολύγωνο/γεωγραφική θέση πίσω από το μέγιστο segment 111.3 km (§2.3) δεν
εντοπίστηκε — δεν αποκλείεται να πρόκειται για εγκυρότατο μεγάλο ηπειρωτικό segment (π.χ.
απόσταση μεταξύ δύο διαδοχικών vertices μιας μεγάλης ακτογραμμής) παρά για σφάλμα δεδομένων.

`ΑΒΕΒΑΙΟ:` δεν ελέγχθηκε αν όλα τα 110 committed region JSON αρχεία παράχθηκαν από το **ίδιο**
build run/mask tier — το script υποστηρίζει partial `--region` runs με merge στο εθνικό index
(`scripts/geospatialExposureProfiles.ts:570-591`) και ρητό guard κατά ανάμειξης mask tiers· δεν
επαληθεύτηκε ρητά ότι όλα τα 110 αρχεία έχουν `maskConfidence: "high"` (μόνο το εθνικό `index.json`
`settings.maskConfidence` ελέγχθηκε, όχι κάθε per-region αρχείο ξεχωριστά).
