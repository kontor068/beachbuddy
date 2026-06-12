# Hybrid Navigation Plan — σχεδίαση της λογικής που διαβάζει το googleMapsNavigation

Συντάχθηκε 2026-06-12. **Παραδοτέο σχεδιασμού — καμία αλλαγή κώδικα.** Πηγή αλήθειας: το
`metadata.googleMapsNavigation` πεδίο της Φάσης 2 (`status: verified|needs-review|blocked|
unresolved`, `mode: place|coordinates`, `query?`, `checkedAt`, `method`, `reason?`).

Εθνικά δεδομένα (μετρημένα 2026-06-12): 2.696 παραλίες· status: **ABSENT 2.146 (80%)** /
verified 416 / needs-review 129 / blocked 5· **boat_only ή boat_or_difficult_path 115**·
low-confidence 278, εκ των οποίων **262 ΧΩΡΙΣ status = σιωπηλά nav-disabled σήμερα**
(η κλάση που η Φάση 2 διόρθωσε για 11 Κυκλαδίτικες υπάρχει ×24 εθνικά)· 0 χωρίς coords·
`mapCoordinates` override σε μόλις 2.

---

## ΜΕΡΟΣ 1 — Audit της τρέχουσας ροής (utils/navigation.ts)

### 1α. Πώς παράγεται το URL σήμερα

```
getNavigationDestination (navigation.ts:154):
  1. isGoogleNavigationUnavailable? (:67) → undefined → κουμπί ΚΡΥΒΕΤΑΙ
       gate = status==='unresolved'  ∨  (confidence==='low' ∧ status!=='verified')
              ∨ id ∈ {1841, 1845}  (hardcoded blocklist)
  2. getPlaceQuery (:132): explicit Map(1848→'Lakos Beach, Kimolos, Greece') →
       αλλιώς «Παραλία <gr name>, <island|region>, Greece» (ελληνικό όνομα προτιμάται)
  3. coordinate fallback (:167) ΜΟΝΟ αν δεν φτιάχνεται όνομα — πρακτικά ΠΟΤΕ
       (όλες οι 2.696 έχουν όνομα) → σήμερα ~100% name-search

getNavigationUrl (:187):
  mobile  → maps/dir/?api=1&destination=<X>     (turn-by-turn routing)
  desktop → maps/search/?api=1&query=<X>        (αναζήτηση/προβολή)
```

Call sites (6): BeachCard:1034, BeachDetailModal:444, BeachMap:1333, BeachOfTheDay:117,
BeachSearcherHome:2056, BeachDetailPage:518 — όλα `canOpenNavigation` (boolean → δείξε/κρύψε
κουμπί) + `openNavigation`. **Κανένα fallback UI**: όταν unavailable ο χρήστης δεν βλέπει
τίποτα — ούτε θέση, ούτε εξήγηση.

### Πού ακριβώς σπάει

1. **Cross-island collisions**: το island hint στο query ΔΕΝ αρκεί — η Φάση 2 τεκμηρίωσε ότι
   το Google fuzzy-matches near-names αγνοώντας το («Vroulidi, Kimolos» → Vroulidia Σίφνου).
   Εθνικά: 179 exact συνωνυμίες + 61 near-matches. Με τη σημερινή place-first ροή, ΚΑΘΕ
   συνώνυμη παραλία ρισκάρει routing σε άλλο νησί.
2. **Stale hardcoded blocklist**: τα ids 1841/1845 ΔΕΝ υπάρχουν πια στο dataset (αφαιρέθηκαν
   σε παλιό data pass) — νεκρός κώδικας που δεν προστατεύει τίποτα. Per-id μηχανισμός που δεν
   κλιμακώνει στα 240 collision cases.
3. **Low-conf σιωπηλό disable**: 262 παραλίες εθνικά (εκτός των ελεγμένων Κυκλάδων) με
   κρυμμένο κουμπί και μηδενική πληροφόρηση χρήστη. Δεν είναι λάθος συντηρητισμός — είναι
   λάθος UX (αόρατη υποβάθμιση).
4. **Τα Phase-2 mode hints δεν διαβάζονται**: 180 verified beaches έχουν `mode:'coordinates'`
   (collision-immune ακρίβεια) και η ροή τα στέλνει name-search.
5. Το `unresolved` status είναι πλέον κενό σύνολο (0 στο dataset) — legacy τιμή.

### 1β. Place vs Coordinates — τα κριτήρια (όχι γενικότητες)

**Mobile `dir` API συμπεριφορά**: με place destination, το Google δρομολογεί στο **road access
point του POI** (curated από το Google: parking/είσοδος)· με coordinates, δρομολογεί στο
**πλησιέστερο routable σημείο προς το γεωμετρικό pin**.

| Κριτήριο | Νικά PLACE | Νικά COORDS |
|---|---|---|
| Το POI υπάρχει στο Google, σωστή θέση, δεμένο access | ✓ (routing στο parking, όχι «στην άμμο») | |
| Pin στην άμμο, πρόσβαση από αλλού (πίσω λόφος/σκάλα) | ✓ (το POI ξέρει την πρόσβαση) | |
| Συνωνυμία cross-island (exact ή near) | | ✓ (collision-immune — το place ρισκάρει άλλο νησί) |
| POI ανύπαρκτο/λάθος θέση στο Google (ανώνυμες, απομακρυσμένες) | | ✓ (το δικό μας navigation-grade pin είναι η μόνη αλήθεια) |
| Pin navigation-grade (Φάση 2: πάνω στο OSM feature) | | ✓ αξιόπιστο nearest-road routing |

Παγίδα του coords: ο «πλησιέστερος δρόμος» μπορεί να είναι λάθος πλευρά στενού/κόλπου
(across-water nearest road). Σπάνιο σε ηπειρωτικές, υπαρκτό σε στενά — γι' αυτό το place
παραμένει default όπου ΔΕΝ υπάρχει collision risk, και το audit έδωσε mode hint ανά παραλία
αντί για καθολικό κανόνα. **Το decision tree απλώς εκτελεί τα hints.**

---

## ΜΕΡΟΣ 2 — Σχεδίαση υβριδικής λογικής

### 2α. Decision tree (status × mode × access)

Νέα έννοια: **NavigationAction** με 3 kinds αντί για boolean:
- `directions` — πλήρης πλοήγηση (mobile dir / desktop search)
- `locate` — «Προβολή στον χάρτη»: ΠΑΝΤΑ search API (και στο mobile), δείχνει θέση ΧΩΡΙΣ
  υπόσχεση διαδρομής· συνοδεύεται από badge/υπότιτλο (i18n) με την αιτία
- `none` — τίποτα (μόνο αν δεν υπάρχουν coords — 0 σήμερα, defensive)

```
getNavigationAction(beach):
  nav    = metadata.googleMapsNavigation
  access = metadata.access?.type / accessibility
  coords = getBestCoordinate(beach)           // mapCoordinates override → coordinates → lat/lon
  if (!coords && !name) return none

  // ΚΑΝΟΝΑΣ ΑΣΦΑΛΕΙΑΣ (υπερισχύει ΟΛΩΝ, και του verified):
  if access ∈ {boat_only, boat_or_difficult_path} ∨ accessibility==='BOAT_ONLY':
      return locate(coords, badge='boat-access')      // βλ. 2δ

  status = nav?.status
           ?? (metadata.confidence==='low' ? 'low-conf-unaudited' : 'default')

  switch status:
    'blocked' | 'unresolved':
        return locate(coords, badge='nav-unavailable')   // η παραλία μένει χρήσιμη
    'needs-review':
        if nav.mode==='coordinates': return directions(coords)
        else:                        return locate(coords, badge='nav-unverified')
        // needs-review+place hint = το audit ΔΕΝ εμπιστεύτηκε το place → locate, όχι τυφλό dir
    'verified':
        if nav.query:                 return directions(place(nav.query))   // explicit override
        if nav.mode==='coordinates':  return directions(coords)
        else:                         return directions(place(buildQuery()))
    'low-conf-unaudited':            // οι 262 εθνικές — σήμερα ΑΟΡΑΤΕΣ
        return locate(coords, badge='nav-unverified')
    'default':                       // οι 2.146 ABSENT — η σημερινή ροή ΑΜΕΤΑΒΛΗΤΗ
        return directions(place(buildQuery()) ?? coords)
```

URL ανά kind: `directions` → mobile `maps/dir/?api=1&destination=X`, desktop
`maps/search/?api=1&query=X`. `locate` → **πάντα** `maps/search/?api=1&query=<lat,lon>`
(και στο mobile — search με coords δείχνει pin στον χάρτη, ο χρήστης μπορεί να ζητήσει
directions ο ίδιος μέσα στο Google Maps αν επιμένει· εμείς δεν το προτείναμε).

### 2β. Δομική αντικατάσταση του blocklist

- **`GOOGLE_NAVIGATION_UNAVAILABLE_BEACH_IDS` ΔΙΑΓΡΑΦΕΤΑΙ** (1841/1845 νεκρά ids· η
  λειτουργία τους = status:'blocked' στο data, που πλέον υπάρχει ως μηχανισμός).
- **`GOOGLE_NAVIGATION_PLACE_QUERY_BY_BEACH_ID` ΔΙΑΓΡΑΦΕΤΑΙ** μετά από data μικρο-βήμα:
  γράψε `googleMapsNavigation.query = 'Lakos Beach, Kimolos, Greece'` στο #1848 (το schema
  έχει ήδη το πεδίο `query`). Σειρά: ΠΡΩΤΑ το data, ΜΕΤΑ η διαγραφή του Map.
- **Το collision class εξαλείφεται γενικά**: τα 180 verified-with-collision έχουν ήδη
  mode:'coordinates' από το audit → το tree τα στέλνει coords (collision-immune). Νέες
  περιοχές: το region-agnostic nav audit (scripts/applyNavigationAudit.mjs pipeline) γράφει
  status+mode μαζικά — κανένα hardcoded id ποτέ ξανά. Μελλοντικό εθνικό rollout = data runs,
  όχι αλλαγές κώδικα.

### 2γ. Edge cases

1. **boat_only (115 εθνικά)**: βλ. 2δ — πάντα locate, ποτέ dir.
2. **Pin σε access point vs άμμο**: μετά τη Φάση 2 τα Cyclades pins είναι πάνω στο OSM beach
   feature (άμμος). Στο coords-dir το Google δρομολογεί στον πλησιέστερο δρόμο — αποδεκτό·
   στο place-dir το POI ξέρει την πρόσβαση — καλύτερο. Το `mapCoordinates` (2 beaches)
   παραμένει ως υπάρχον override μέσω `getBestCoordinate` (αμετάβλητο).
3. **Mobile vs desktop**: desktop πάντα search API (και στα δύο kinds — ίδιο σημερινό
   pattern)· mobile: dir για directions, search για locate.
4. **Χωρίς coords**: 0 σήμερα· ο guard μένει defensive (`none`).
5. **Οι 262 low-conf χωρίς status**: από αόρατο κουμπί → **locate + badge**. Συντηρητικό
   (καμία routing υπόσχεση σε αναξιόπιστο pin) αλλά όχι πια UX μαύρη τρύπα. Όταν τρέξει το
   εθνικό nav audit, παίρνουν κανονικό status και ακολουθούν το tree.
6. **Νέες παραλίες (3000+)**: γράφονται με status εξαρχής (το iconic batch το έκανε) — το
   default path δεν τις αφορά.

### 2δ. Ρητός κανόνας ασφάλειας (Εγκρεμνοί-class)

> **ΓΕΝΙΚΕΥΣΗ (μάθημα υλοποίησης 2026-06-12, batch-approved)**: ο safety rule εφαρμόζεται με
> βάση το **access.type ΑΝΕΞΑΡΤΗΤΑ από το nav status** (ABSENT ή όχι, verified ή όχι). Η
> ασφάλεια ΔΕΝ εξαρτάται από το αν έχει τρέξει nav audit σε μια παραλία. Συνέπεια που
> ανακαλύφθηκε στην υλοποίηση: **86 boat-only ABSENT** παραλίες (που σήμερα δίνουν place-dir
> «πλοήγηση μέχρι την άμμο») αλλάζουν σε coord-locate — εσκεμμένη βελτίωση ασφάλειας, ΟΧΙ
> regression. Το ABSENT byte-identical gate επαναπροσδιορίστηκε ρητά ως **«NON-boat ABSENT
> byte-identical»** (1.798 παραλίες ✓· οι 86 boat εξαιρούνται με τεκμηρίωση). Αυτή είναι η
> σωστή, αυτο-συντηρούμενη συμπεριφορά: μελλοντικές info-safety αλλαγές access (Εγκρεμνοί/Red
> Beach → boat_only) ενεργοποιούν τον rule χωρίς να χρειάζονται nav audit πρώτα.


**Για boat_only / boat_or_difficult_path / BOAT_ONLY: ΠΟΤΕ `dir` API.** Δεν υπάρχει νόμιμη
οδική διαδρομή «μέχρι την άμμο»· ένα dir URL θα έδινε είτε άκυρη διαδρομή είτε —χειρότερα—
διαδρομή σε λάθος σημείο (γκρεμός πάνω από την παραλία) με ψευδή σιγουριά. Αντί αυτού:
locate (search με coords) + badge «Πρόσβαση μόνο με σκάφος» (i18n ×5).

- Ο κανόνας διαβάζει το **access.type**, άρα οι προσωρινές info-safety αλλαγές (Εγκρεμνοί,
  Red Beach → boat_only) τον ενεργοποιούν ΑΥΤΟΜΑΤΑ — και τον απενεργοποιούν όταν γίνει το
  revert (μηδέν nav-code συντήρηση).
- Υπερισχύει του verified status (ασφάλεια > convenience): π.χ. Red Beach #2062 είναι
  verified αλλά boat_only → locate.
- hiking_path_* / dirt roads ΔΕΝ μπλοκάρουν directions: υπάρχει νόμιμη πρόσβαση μέχρι
  parking/trailhead και το routing ως εκεί είναι ακριβώς το ζητούμενο.

---

## ΜΕΡΟΣ 3 — Implementation instructions (για Opus, αυτοτελείς)

**Γενικοί κανόνες:**
1. Gates μετά από κάθε βήμα, `&&` ποτέ `;`: `npm run lint && npm run build` (το build τρέχει
   prerender — πιάνει render errors). Συν τον validation πίνακα (κάτω) ως manual check.
2. ΜΗΝ αλλάξεις: τιμές του status field στο data, curated δεδομένα, eligibility predicates,
   οτιδήποτε στο scoring/exposure. ΜΗΝ ξαναγράψεις τα 2.146 ABSENT beaches' συμπεριφορά
   πέρα από το low-conf→locate που ορίζεται ρητά.
3. Commits unpushed μέχρι απόφαση Miltos. Data commit (βήμα 0) ΧΩΡΙΣΤΑ από code commit.

**Βήμα 0 (data, πριν τον κώδικα):** στο public/greek_beaches.json, beach id 1848 (Λάκος
Κιμώλου — βρες το με τον frozen-id walk του scripts/applyNavigationAudit.mjs), πρόσθεσε στο
`metadata.googleMapsNavigation` το πεδίο `query: 'Lakos Beach, Kimolos, Greece'` (κρατώντας
τα υπάρχοντα πεδία). Dated sourceNote. `npm run build:beach-data`, gates, commit.

**Βήμα 1 (utils/navigation.ts):**
1. Νέο type `NavigationAction = { kind: 'directions'|'locate'|'none'; destination?:
   NavigationDestination; badge?: 'boat-access'|'nav-unavailable'|'nav-unverified' }`.
2. Νέο export `getNavigationAction(beach)` με το decision tree του 2α ΑΚΡΙΒΩΣ (σειρά:
   coords check → boat-safety rule → status switch). Βοηθητικά που ήδη υπάρχουν:
   getBestCoordinate, getPlaceQuery (κράτα τα)· isGoogleNavigationUnavailable ΚΑΤΑΡΓΕΙΤΑΙ
   (η λογική απορροφάται στο tree).
3. Διάγραψε `GOOGLE_NAVIGATION_UNAVAILABLE_BEACH_IDS` και
   `GOOGLE_NAVIGATION_PLACE_QUERY_BY_BEACH_ID` (το βήμα 0 προηγήθηκε)· στο getPlaceQuery
   πρόσθεσε πρώτα `nav.query` αν υπάρχει.
4. Boat rule: access.type από `beach.metadata?.access?.type`, plus
   `(beach as any).accessibility === 'BOAT_ONLY'` όπως το διαβάζει το BOAT_ONLY στο app
   (έλεγξε το Accessibility enum import pattern στο recommendationService).
5. Συμβατότητα: `canOpenNavigation` επιστρέφει `kind !== 'none'`· `getNavigationUrl`
   χτίζει URL κατά kind (locate → πάντα search API)· `openNavigation` αμετάβλητο interface.
   Έτσι τα 6 call sites ΔΟΥΛΕΥΟΥΝ ΧΩΡΙΣ ΑΛΛΑΓΗ (phase A). Τα badges είναι phase B
   (προαιρετική, ξεχωριστή έγκριση): έκθεση του badge στα components + i18n ×5.

**Βήμα 2 — Validation πίνακας (expected δηλωμένα ΠΡΙΝ την υλοποίηση)·
script .tmp/navValidation.mjs που καλεί getNavigationAction σε αυτά τα beaches από τα
app data και τυπώνει kind/URL, σύγκριση με τη στήλη expected:**

| Beach | status/mode/access | Expected |
|---|---|---|
| #2012 Plaka Naxos | verified/coordinates | directions, mobile dir `37.050743,25.369322` |
| #1922 Sarakiniko | verified/coordinates (collision Γαύδος) | directions, coords |
| #1707 Lefkivari | verified/place (πρώην low-conf) | directions, place «Παραλία …, Andros, Greece» |
| #1848 Lakos | verified + nav.query | directions, place = το explicit query |
| #2062 Red Beach | verified ΑΛΛΑ boat_only | **locate** (boat rule > verified) |
| #1159 Εγκρεμνοί | ABSENT, boat_only | **locate** |
| #2011 Πάνορμος | blocked | locate, badge nav-unavailable |
| #1839 Άγιος Μηνάς | needs-review χωρίς coords-hint... (mode=place) | locate, badge nav-unverified |
| #1113 Μύρτος | ABSENT, normal access | directions, place (σημερινή συμπεριφορά — ΑΜΕΤΑΒΛΗΤΗ) |
| ένα από τα 262 low-conf ABSENT | low-conf-unaudited | locate (ήταν: τίποτα) |
| #3000 Κλέφτικο | verified/coordinates + boat_only | **locate** (boat rule) |

Συν: μηδενική αλλαγή στο URL για 20 τυχαία ABSENT beaches (regression sample —
πριν/μετά ίδιο string).

**Βήμα 3:** gates + commit (unpushed) + report με τον πίνακα πριν/μετά. ΣΤΑΣΗ για έγκριση
Miltos πριν push και πριν το phase B (badges UI).
