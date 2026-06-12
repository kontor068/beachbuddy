# Exposure Model v3 — Audit & Roadmap (Φάσεις 2+3 του exposure σχεδίου)

Συντάχθηκε 2026-06-12 πάνω στη βάση: OSM high-res mask (15.946 polygons), 2.696 profiles,
128 GT cases (127 passing), Λύσεις Α (geometry facing preference) + Β (fetch escalation ≥8 km)
στον engine. **Παραδοτέο σχεδιασμού — καμία αλλαγή κώδικα σε αυτό το session.**

Ground rule (δόγμα): κάθε βελτίωση σέβεται τη **συντηρητική ασυμμετρία** — false-exposed
είναι φθηνό (χαμένη πρόταση), false-protected είναι ακριβό (στέλνεις κολυμβητή σε κύμα).
Κάθε αλλαγή που μπορεί να μετακινήσει αποτέλεσμα προς το protected χρειάζεται ρητή
τεκμηρίωση· floor-only μηχανισμοί προτιμώνται.

Τρέχον μοντέλο (επαληθευμένο στα αρχεία, 2026-06-12):

- Build (scripts/geospatialExposureProfiles.ts): ανά παραλία × 8 τομείς (N…NW ανά 45°),
  βεντάλια **5 ακτίνων [−30,−15,0,+15,+30]°**, maxFetch **25 km**, βήμα **0.2 km** (high-res
  mask· 0.5 km NE), nearshore grace 0.1 km. Αποθηκεύεται ανά τομέα: `fetchKm` = **αριθμητικός
  μέσος** των 5 ακτίνων, `blockedRayRatio`, `onshore`, `intensity`. Per-ray δείγματα ΔΕΝ
  αποθηκεύονται.
- facingDeg (utils/geospatialExposureModel.ts:206): 36 ακτίνες ανά 10° έως 3 km,
  open-water-weighted resultant· null αν magnitude/total < 0.08.
- Intensity (:269): `100 · (cos(windFrom−facing)+1)/2 · (0.6 + 0.4·min(fetch/12,1)·(1−blocked))`·
  levels ≥60 exposed / ≥33 partial.
- Fallback χωρίς facing (:113): fetch ≥8 km & blocked <40% → exposed· ≤2 km & ≥60% → protected·
  αλλιώς partial.
- Κύμα (utils/waveModel.ts:39): SMB deep-water fetch-limited
  `Hs = 0.283·(U²/g)·tanh(0.0125·(gF/U²)^0.42)`.
- Runtime resolver (utils/windExposureModel.ts): γραμμική παρεμβολή fetch/blocked/intensity
  μεταξύ των δύο γειτονικών τομέων.
- Swell σήμερα: το marine API ήδη φέρνει `swell_wave_height`, `swell_wave_direction`
  (weatherService.ts:285-286)· στο scoring υπάρχει `directSwell` penalty −12 + warning
  (recommendationService.ts:1247-1260, :1385) **αλλά** με το legacy
  `calculateWindExposure(beachOrientation, swellDir)` (γωνιακά buckets 45°, όχι γεωμετρία)
  και μόνο για swell ≥0.5 m.

---

## ΜΕΡΟΣ 1 — Audit

### 1α. Πού το U×√F + onshore + SMB είναι σωστό proxy, πού καταρρέει

Για μικρό αδιάστατο fetch το SMB συμπίπτει με το κλασικό Hs ∝ U^1.16·F^0.42 ≈ U·√F — δηλαδή
το μοντέλο ΕΙΝΑΙ η καθιερωμένη fetch-limited προσέγγιση. **Σωστό proxy** στο κυρίαρχο
καθεστώς του use case: τοπικά γεννημένος άνεμος-θάλασσα (μελτέμι) σε fetch 1–25 km, ανοιχτές
ακτές με καθαρή upwind γεωμετρία, σταθερός άνεμος ≥2–3 h (στα fetch μας το duration-limit
δένει μόνο <1–2 h — αμελητέο για μελτέμι).

Συστηματικές αποτυχίες, ανά κλάση γεωμετρίας:

| # | Γεωμετρία | Μηχανισμός λάθους | Κατεύθυνση | Σοβαρότητα |
|---|---|---|---|---|
| Α1 | **Στενά κανάλια/διαύλοι** πλάτους <15°–20° γωνιακά (Μήλος–Κίμωλος, Άνδρος–Τήνος, στενά Εύβοιας) | Η βεντάλια 5×15° **κάνει aliasing**: κανάλι 8–12° μπορεί να πέσει ΑΝΑΜΕΣΑ σε ακτίνες → fetch≈0 → false-protected· ή να πιαστεί από 1/5 → ο μέσος όρος το αραιώνει ασταθώς ανάλογα με τη φάση του fan | **προς protected** (ακριβό) | Υψηλή — ακριβώς η κλάση που έβγαλε τα curated N-exposure της Κιμώλου |
| Α2 | **Pocket bays με στόμιο εκτός άξονα ανέμου** (Πάνορμος #2011) | Straight rays δεν βλέπουν περίθλαση/διάθλαση στο στόμιο | προς protected (ακριβό) | Υψηλή ανά παραλία, μικρός πληθυσμός (§1β) |
| Α3 | **Παραλίες πίσω από νησίδες/υφάλους** | Binary land test → πλήρες μπλοκάρισμα ακτίνας· πραγματικά Kd 0.3–0.6 στη σκιά κοντινής νησίδας | προς protected (ακριβό) | Μέτρια — μερικώς καλυμμένη από curated |
| Α4 | **Cross-shore άνεμος σε ανοιχτή ακτή** (onshore≈0 → intensity 30–50, πάντα partial) | Slant-fetch + directional spreading ±30–40° στέλνει ενέργεια προς την ακτή και σε πλάγιο άνεμο με μεγάλο along-shore fetch | προς protected, ΑΛΛΑ πιάνει partial όχι protected → μερικώς συντηρητικό | Μέτρια-χαμηλή |
| Α5 | **Ανοιχτό πέλαγος >25 km fetch** (Ν. Κρήτη σε νοτιάδες, Ιόνιο σε SW) | Cap 25 km: classification σωστό (saturation στα 12 km) αλλά modeledWave υποεκτιμημένο ×2 σε μεγάλα συμβάντα | μόνο στο κύμα, ΟΧΙ στο level· το display παίρνει max(measured, modeled) | Χαμηλή — το measured marine το καλύπτει |
| Α6 | **Πολύ ρηχές λεκάνες** (Αχιβαδολίμνη) | SMB deep-water: αγνοεί ρηχή απόσβεση/θραύση | προς exposed (φθηνό ✓) | Αμελητέα |

Σύγκριση με καθιερωμένα: το SPM/Saville **effective fetch** δεν είναι «μεγαλύτερο fetch για
κανάλια» — η cos-στάθμιση κωδικοποιεί το width-limited growth (στενή ζώνη γένεσης → μικρότερο
κύμα). Η πραγματική αξία του έναντι του τρέχοντος μέσου-των-5 είναι (i) **πυκνότητα
δειγματοληψίας 6° αντί 15°** → εξαφανίζει το aliasing Α1, (ii) φυσικά θεμελιωμένη στάθμιση
αντί για αυθαίρετο μέσο όρο, (iii) ομαλότερη συμπεριφορά στα όρια τομέων (η runtime παρεμβολή
παρεμβάλλει μεταξύ συνεπέστερων τιμών).

### 1β. Περίθλαση στα στόμια — πότε μετράει για κολυμβητή

Τυπικό θερινό αιγαιοπελαγίτικο wind sea: T ≈ 4–6 s → L₀ ≈ 25–55 m. Με πλάτος στομίου W:

- **W > ~5–6·L (≳300 m)**: το στόμιο περνά το κεντρικό directional cone σχεδόν ανεξασθένητο·
  το straight-ray fan το βλέπει εφόσον υπάρχει ευθυγράμμιση — δεν χρειάζεται διόρθωση.
- **W ≈ 1–5·L (≈50–300 m)**: καθεστώς «σχισμής»: έντονη γωνιακή διασπορά μετά το στόμιο·
  Kd ≈ 0.3–0.6 στη γεωμετρική σκιά έως ±40–50° από τον άξονα (διαγράμματα Goda/Wiegel).
  Έξω Hs 1.2 m → μέσα 0.4–0.7 m στη ζώνη κολύμβησης: **αισθητό και απρόβλεπτο για τον
  χρήστη που του είπαμε «προστατευμένη»**. Εδώ το μοντέλο κάνει το ακριβό λάθος.
- **W < ~2·L (<50 m)**: point-source: η συνολική ενέργεια που περνά είναι μικρή· εσωτερικό
  πρακτικά ήρεμο εκτός αν η λεκάνη είναι μικροσκοπική. Straight-ray «protected» σωστό.

Πρακτικό κριτήριο ενεργοποίησης (για το 2β): στόμιο 50–300 m, λόγος βάθους-εσοχής/πλάτους
≥1, άξονας στομίου εντός ±50–60° της διεύθυνσης κύματος, και έξω συνθήκες ≥4–5 Bft πάνω σε
πραγματικό fetch ≥8 km. Πληθυσμός: από τα island passes, ~3–5% του dataset (≈80–130 παραλίες
εθνικά), αλλά **δυσανάλογα σημαντικές: είναι οι υποψήφιες «refuge» των ημερών μελτεμιού** —
ακριβώς όταν ο χρήστης μας εμπιστεύεται. Στα ελεγμένα νησιά καλύπτονται από curated overrides·
το ρίσκο ζει στα ~70 ανέλεγκτα.

### 1γ. Τι ΔΕΝ μοντελοποιείται — ιεράρχηση (παραλίες × συχνότητα × σοβαρότητα)

1. **Background swell ανεξάρτητο τοπικού ανέμου** — ΜΕΡΙΚΩΣ μοντελοποιημένο και το data
   υπάρχει ήδη (swell ύψος+διεύθυνση ανά cluster, runtime). Κενά: (i) ο έλεγχος direct-swell
   χρησιμοποιεί legacy orientation buckets αντί facingDeg/γεωμετρία· (ii) δεν αποσβένεται από
   την enclosure γεωμετρία (κλειστός όρμος «τρώει» direct swell penalty που δεν του αναλογεί
   — false-exposed, φθηνό αλλά θόρυβος)· (iii) τα protected measured-wave floors του seaScore
   μπορούν να ΚΡΥΨΟΥΝ πραγματικό swell σε δυτικομέτωπη παραλία με άπνοια (false-protected,
   ακριβό — το κλασικό «ήρεμη πρόβλεψη, σκάει νοτιοδυτική ρεστία»). Επηρεάζει: όλο το
   δυτικομέτωπο Ιόνιο + Ν. Κρήτη ≈ **350–450 παραλίες**, δεκάδες μέρες/σεζόν (κυρίως
   εκτός αιχμής μελτεμιού), σοβαρότητα μέτρια-υψηλή (shore break με παιδιά). **Rank #1 —
   μέγιστο όφελος/κόπο: runtime-only, μηδέν νέα δεδομένα.**
2. **Περίθλαση στομίων (Α2)** — βλ. 1β. Μικρός πληθυσμός, μέγιστη σοβαρότητα ανά περίπτωση,
   στρατηγικές παραλίες. **Rank #2.**
3. **Τοπογραφική σκίαση/επιτάχυνση (venturi) από ανάγλυφο** — Η σκίαση από πρανή πίσω από
   την παραλία αφορά offshore άνεμο που ΗΔΗ βγαίνει protected (onshore gating) — μικρό κενό.
   Το επικίνδυνο είναι το αντίστροφο (venturi ενίσχυση σε κοιλάδες: Kalafatis-class), που
   καλύπτεται από τα 12 curated knownWindSportSpot. Θα απαιτούσε DEM pipeline (νέα εξωτερική
   πηγή, νέο preprocess). **Rank #3 — defer**· επανεξέταση στο τέλος του εθνικού data-quality
   rollout με τη λίστα flagged περιοχών.
4. **Θαλάσσια αύρα/ημερήσιος κύκλος** — Εν μέρει μέσα στο hourly forecast (mesoscale)· το
   «αντιπροσωπευτικός άνεμος = 13:00» χάνει το peak 14:00–16:00 κατά ~1 Bft σε θερμές ημέρες.
   Διορθώνεται φθηνά ΟΧΙ με μοντελοποίηση αλλά με το γνωστό hourly-path bug fix (το
   `getHourlyExposureLevel` δεν περνά geospatialProfile — ασυνέπεια #4 του pipeline audit).
   Σοβαρότητα χαμηλή (comfort). **Rank #4 — συνοδευτικό του R1.**

---

## ΜΕΡΟΣ 2 — Σχεδιασμός βελτιώσεων (πρόταση, όχι υλοποίηση)

### 2α. Effective fetch (SPM/Saville) στην υπάρχουσα pipeline

Νέο ray layout ανά τομέα: **15 ακτίνες ανά 6° στο ±42°** (SPM-συμβατό· σήμερα 5 ανά 15° στο
±30°). Κόστος build ×3 σε λούκ-απς (σημερινό full run ~3′ → ~9′, αποδεκτό precompute).

Ανά τομέα αποθηκεύονται (schema v2): `effectiveFetchKm` (νέο), `meanFetchKm` (το σημερινό
`fetchKm`, για συμβατότητα/σύγκριση), `blockedRayRatio` (15 ακτίνες πλέον),
`maxOpenRunDeg` (νέο — μέγιστο συνεχόμενο ανοιχτό γωνιακό διάστημα, βλ. 2β/Β-escalation).

Τύπος (cos²-weighted effective fetch, στο πνεύμα SPM/Saville· **ΔΙΟΡΘΩΣΗ Τροπ.1 2026-06-12**:
ο παρονομαστής είναι Σcos²θ, ΟΧΙ Σcosθ):

```
F_eff = Σ_i ( x_i · cos²θ_i ) / Σ_i cos²θ_i
```

όπου x_i το ανοιχτό νερό κατά μήκος της ακτίνας i και θ_i η γωνία της από τη διεύθυνση του
ανέμου (κέντρο τομέα στο build· η runtime παρεμβολή μένει ως έχει). Είναι σταθμισμένος μέσος
των x_i με βάρη cos²θ_i (directional spreading): ομοιόμορφα ανοιχτή θάλασσα (όλα τα x_i = x)
δίνει F_eff = x · Σcos²/Σcos² = **x ακριβώς** — η δηλωμένη πρόθεση, καμία ολίσθηση.

ΓΙΑΤΙ ΟΧΙ Σcosθ (το αρχικό λάθος): με παρονομαστή Σcosθ, uniform sea δίνει
F_eff = x · Σcos²/Σcos ≈ **0.91·x** για το FAN ±42° (Σcos²≈12.28, Σcos≈13.50) — δηλαδή
συστηματική ~9% μείωση fetch σε ΚΑΘΕ ανοιχτή ακτή = καθολική ολίσθηση προς protected,
αντίθετη στο δόγμα της συντηρητικής ασυμμετρίας. Ο σωστός παρονομαστής Σcos² το εξαλείφει.

Ψευδοκώδικας (συμβατός με `assessGeospatialWindExposure`):

```
FAN_V2 = [-42,-36,-30,-24,-18,-12,-6,0,6,12,18,24,30,36,42]   # μοίρες
samples = [ sampleFetchRay(origin, windDeg+θ, mask, 25km, step, grace) for θ in FAN_V2 ]
num = Σ samples[i].openWaterKm * cos(θ_i)²
den = Σ cos(θ_i)²                                 # σταθερά ≈ 12.28 για το FAN_V2
effectiveFetchKm = num / den                      # uniform sea -> = openWaterKm (no shift)
meanFetchKm      = mean(openWaterKm)              # legacy πεδίο, αμετάβλητη σημασία
blockedRayRatio  = count(blockedByLand) / 15
maxOpenRunDeg    = 6 × (μέγιστο πλήθος ΣΥΝΕΧΟΜΕΝΩΝ μη-blocked ακτίνων)
intensity        = 100 · (onshore+1)/2 · (0.6 + 0.4·min(effectiveFetchKm/12,1)·(1−blockedRayRatio))
```

**UNIT TEST (υποχρεωτικό στα gates του R2)**: συνθετική ομοιόμορφη μάσκα (isLand πάντα false)
→ όλες οι 15 ακτίνες ανοιχτές στα 25 km → `effectiveFetchKm == 25.0 ± 1e-6`. Αν αποτύχει,
ο παρονομαστής είναι λάθος. Γράφεται ΠΡΙΝ το R2 build, τρέχει με τα υπόλοιπα gates.

Αναμενόμενη συμπεριφορά (αναλύθηκε αριθμητικά): σε ομοιόμορφα ανοιχτή θάλασσα F_eff ≈ mean
(καμία παλινδρόμηση)· σε στενό κανάλι ΚΕΝΤΡΑΡΙΣΜΕΝΟ στον άνεμο F_eff ≈ mean αλλά **πάντα
ανιχνεύεται** (6° πυκνότητα — τέλος το aliasing του Α1)· σε κανάλι εκτός κέντρου η cos²
στάθμιση το αποσβένει φυσικά αντί να εξαρτάται από το αν «πέτυχε» ακτίνα. Η ασυμμετρία
τηρείται: η κύρια μετατόπιση είναι protected→partial/exposed σε στενά που σήμερα χάνονται.

Το Β-escalation (`geometryEscalatesToExposed`, κατώφλι fetch ≥8 km) επαναβαθμονομείται σε
`effectiveFetchKm ≥8 ∧ maxOpenRunDeg ≥18°` — το δεύτερο σκέλος αποκλείει να σπρώξει
escalation μια χαραμάδα 6° (συντηρητικό προς τη σωστή κατεύθυνση: το escalation ΑΝΕΒΑΖΕΙ
exposure, άρα ευρύτερο κριτήριο = πιο επιθετικό· το όριο 18° το συγκρατεί τεκμηριωμένα).

### 2β. Όρμοι/στόμια — ποσοτικοποίηση «πόσο κλειστός» + diffraction floor

Νέο **per-beach** (όχι per-sector) precompute, από ΞΕΧΩΡΙΣΤΟ σweep: 72 ακτίνες ανά 5° έως
10 km (το facing sweep των 3 km μένει ανέγγιχτο — άλλος σκοπός):

```
seaWindow      = { bearings b : openWater(b) ≥ 5 km }        # «ορατή ανοιχτή θάλασσα»
windowWidthDeg = συνολικό γωνιακό εύρος του μεγαλύτερου συνεχόμενου διαστήματος του seaWindow
mouthBearing   = κυκλικός μέσος του διαστήματος αυτού
outerFetchKm   = max openWater(b) για b στο διάστημα (≤25 km cap)
```

(Οι ακτίνες από το εσωτερικό σημείο που περνούν ΜΕΣΑ από το στόμιο μετρούν ήδη
εσοχή+έξω νερό — δεν χρειάζεται δεύτερη αφετηρία στο στόμιο.)

**Diffraction floor** (runtime ή baked στο profile — προτείνεται baked, βλ. ΜΕΡΟΣ 3): για
τομέα με αποτέλεσμα protected:

```
ΕΦΑΡΜΟΖΕΤΑΙ ΜΟΝΟ ΑΝ: windowWidthDeg ≤ 60        # στενό στόμιο — ρητό όριο εφαρμογής
              ΚΑΙ angDiff(sectorBearing, mouthBearing) ≤ 60
              ΚΑΙ outerFetchKm ≥ 8
              ΚΑΙ blockedRayRatio(sector) ≥ 0.6   # δεν αγγίζει ήδη-ανοιχτούς τομείς
ΤΟΤΕ: level := max(level, 'partial')              # FLOOR-ONLY — ποτέ δεν κατεβάζει
      diffractedWaveHintM := 0.4 × SMB(U, outerFetchKm)   # Kd≈0.4, μέση τιμή σχισμής
      flag := 'diffraction-floor' (για copy/Γιατί-σήμερα και για audits)
```

Ανοιχτές παραλίες (windowWidthDeg > 60°) μένουν **εξ ορισμού ανέγγιχτες** — αυτό είναι το
ρητό όριο μη-εφαρμογής που ζητήθηκε. Η Vai-class (στόμιο ευθυγραμμισμένο με τον τομέα) δεν
χρειάζεται floor γιατί οι ακτίνες ήδη περνούν (fetch>0 → δεν είναι protected). Ο floor είναι
μονοτονικά συντηρητικός: μόνο protected→partial, ποτέ το αντίστροφο.

### 2γ. Swell — ελάχιστη πρόσθεση, μέγιστο όφελος (runtime-only)

Τα δεδομένα ΗΔΗ φτάνουν (swellWaveHeightM, swellWaveDirectionDeg ανά beach-cluster). Τρεις
στοχευμένες αλλαγές, καμία νέα κλήση API (προαιρετικά: προσθήκη `swell_wave_period` στο
hourly string — 1 λέξη):

1. **Γεωμετρικός direct-swell έλεγχος**: αντικατάσταση του legacy
   `calculateWindExposure(orientation, swellDir)` με: `swellOnshore = cos(swellDir −
   facingDeg)` ΚΑΙ openness του τομέα στη διεύθυνση swell από το ΥΠΑΡΧΟΝ profile
   (`blockedRayRatio < 0.6` στον πλησιέστερο τομέα). Κλειστός όρμος → δεν χρεώνεται
   direct swell (διορθώνει το false-exposed θόρυβο)· ανοιχτή δυτικομέτωπη → χρεώνεται
   με γεωμετρική βεβαιότητα.
2. **Άρση των protected floors όταν direct swell**: στο `calculateSeaConditionScore`, τα
   measured-wave floors (protected ≥6 / partial ≥4) ΔΕΝ εφαρμόζονται όταν ο γεωμετρικός
   direct-swell είναι αληθής με swellHeight ≥0.5 m — το floor υπάρχει για να μην «θάβει» το
   offshore grid τους κόλπους, όχι για να κρύβει μετωπική ρεστία. (Αφαίρεση αισιόδοξου
   μηχανισμού = συντηρητική φορά ✓.)
3. Κλιμάκωση του penalty: −12 (≥0.5 m) / −20 (≥0.9 m) και το warning copy παίρνει το ύψος.

### 2δ. Validation plan — κριτήρια αποδοχής ΠΡΙΝ τα αποτελέσματα

Pre-registered gates (γράφονται στο GT/σκριπτ ΠΡΙΝ τρέξει το νέο μοντέλο):

1. **GT 128: ≥127 pass ΚΑΙ μηδέν προς-protected μετατόπιση** σε οποιοδήποτε case σε σχέση
   με το τρέχον output (μηχανικός έλεγχος: snapshot τρεχόντων levels → diff).
2. **Asymmetry audit στο full rebuild**: από τα sector-levels που αλλάζουν κατηγορία,
   **≥75% προς exposed**· κάθε προς-protected αλλαγή μπαίνει σε ονομαστική λίστα και
   δικαιολογείται μία-μία (αναμενόμενες: διορθώσεις false-exposed από το cos² σε ανοιχτές
   ακτές — πρέπει να είναι λίγες).
3. **Hard set με δηλωμένο αναμενόμενο αποτέλεσμα** (πριν το run):
   - Πάνορμος Νάξου #2011, S6: από protected/partial-fetch-0 → **≥partial ΜΕ
     diffraction flag ή effective fetch >0** (το GT case επιτρέπεται να γίνει
     «exposed Ή partial+flag» — αλλαγή προδιαγραφής, όχι post-hoc χαλάρωση: δηλώνεται εδώ).
   - Vai-class ευθυγραμμισμένα φιόρδ (Rina, Spedo, Klidos, Λιώνας ΝΕ): παραμένουν ως έχουν
     (ο floor ΔΕΝ ενεργοποιείται — έλεγχος ότι windowWidth/ευθυγράμμιση τα εξαιρεί).
   - Κανάλι Μήλου–Κιμώλου (Voudia #1934, Kastanas #1935, Tria Pigadia #1938): στόχος η
     γεωμετρία v3 να αναπαράγει ≥2/3 curated N-exposures χωρίς το override (success metric
     της Α1 διόρθωσης).
   - Στενό Άνδρου–Τήνου: Zorkos #1699 E escalation ΠΑΡΑΜΕΝΕΙ· Kolympithres Πάρου SE
     ΔΕΝ escalate-άρει (negative control του νέου κατωφλιού maxOpenRunDeg).
   - Αχιβαδολίμνη/εσωτερικό κόλπου Μήλου: ΔΕΝ γίνεται exposed (negative control του
     effective fetch σε κλειστή λεκάνη — εσωτερικό fetch ~8 km, blocked υψηλό).
   - Fatourena #1754 N: δεν πέφτει κάτω από το σημερινό.
4. **Swell validation**: 3 ιστορικές ημέρες Ιονίου με γνωστή SW ρεστία και ασθενή άνεμο
   (Open-Meteo marine, past_days) → Μύρτος/Πόρτο Κατσίκι/Εγκρεμνοί πρέπει να φλεγκάρουν
   direct swell· 3 ανατολικομέτωπα αιγαιοπελαγίτικα controls δεν φλεγκάρουν.
   **(Τροπ.2 2026-06-12) CLOSED-BAY NEGATIVE CONTROLS** — το 2γ.1 είναι η μόνη προς-protected
   κίνηση του R1 (αφαιρεί direct-swell penalty από κλειστούς όρμους), άρα ελέγχεται ονομαστικά:
   2 κλειστοί όρμοι που με το LEGACY orientation-bucket κριτήριο χρεώνονταν direct swell και
   με το ΓΕΩΜΕΤΡΙΚΟ παύουν, ΜΕ γεωγραφική αιτιολόγηση γιατί η αποφόρτιση είναι σωστή (στόμιο
   μακριά από τη διεύθυνση swell, ή blocked τομέας στη διεύθυνση swell). Υποψήφιοι (το script
   επιλέγει 2 με πραγματικό historical SW swell event): **Όρμος Βαθιού/Vathi Σίφνου** (στενό
   νότιο στόμιο, facing ~135°· δυτική ρεστία 250-280° μπαίνει μόνο μέσω της στενής εισόδου —
   geometric swellOnshore<0.3) και **Παλαιόχωρι/Pollonia Μήλου τύπου ΒΑ-κλειστός** (facing N/NE,
   δυτικό-νότιο swell offshore-του-facing). Αν οποιοσδήποτε ΣΥΝΕΧΙΣΕΙ να φλεγκάρει με το νέο
   κριτήριο ή αν ανοιχτή δυτικομέτωπη ΠΑΥΣΕΙ να φλεγκάρει → ΣΤΑΣΗ, η γεωμετρία είναι λάθος.
5. **Κύμα**: σε 20 ανοιχτές παραλίες × 3 windy μέρες, |SMB − marine measured| διάμεσος ≤40%
   (χαλαρό — proxy είναι, αλλά πιάνει παλινδρομήσεις τάξης μεγέθους).

---

## ΜΕΡΟΣ 3 — Prioritized roadmap + οδηγίες υλοποίησης

| # | Τι | Κόπος | Κέρδος | Precompute/Runtime |
|---|---|---|---|---|
| R1 | Swell-geometric (2γ) + hourly-path profile fix | S (~1 μέρα) | Υψηλό: 350-450 παραλίες, η κλάση «ήρεμη πρόβλεψη-σκάει ρεστία» | Runtime μόνο — ΚΑΝΕΝΑ rebuild |
| R2 | Effective fetch 15×6° + schema v2 (2α) | M (~2-3 μέρες με validation) | Υψηλό: εξαφανίζει το Α1 aliasing (στενά/κανάλια), θεμέλιο για R3 | Precompute (full rebuild) + μικρό runtime (νέο πεδίο) |
| R3 | Enclosure window + diffraction floor (2β) | M (~2 μέρες) | Στοχευμένο: σκοτώνει τη χειρότερη false-protected κλάση στα ανέλεγκτα νησιά | Precompute window + baked floor |
| R4 | DEM topo/venturi, duration-limit, shallow-water | L | Χαμηλό υπόλοιπο | — **DEFER με αιτιολόγηση στο 1γ/1α** |

Σειρά: **R1 → R2 → R3** (το R1 ανεξάρτητο και άμεσα χρήσιμο· το R3 προϋποθέτει το R2 μόνο
οργανωτικά — μπορεί και ανάποδα αλλά δύο rebuilds αντί ένα είναι σπατάλη: **R2+R3 σε ένα
κοινό schema-v2 rebuild**).

### Implementation instructions (για υλοποίηση από λιγότερο ικανό μοντέλο — αυτοτελείς)

**Γενικοί κανόνες (ισχύουν σε όλα):**
1. Gates μετά από ΚΑΘΕ βήμα, αλυσιδωμένα με `&&` (ποτέ `;`): `npm run lint && node
   scripts/validateWindExposureEngine.mjs && node scripts/validateWindExposureGroundTruth.mjs`.
   Αν οποιοδήποτε κόκκινο: ΣΤΑΜΑΤΑ, μην κάνεις commit, ανέφερε το πλήρες σφάλμα.
2. ΜΗΝ αλλάξεις τα κατώφλια 60/33 (intensity), 8/2 (classify), 12 (saturation) — μόνο ό,τι
   λένε ρητά οι οδηγίες. ΜΗΝ αγγίξεις utils/windProfileOverrides.ts, utils/navigation.ts,
   τα curated δεδομένα, ή τα eligibility predicates του recommendationService.
3. Κάθε αλλαγή που μετακινεί αποτέλεσμα προς protected απαγορεύεται εκτός αν η οδηγία τη
   ζητά ρητά. Floor/penalty μηχανισμοί μόνο.
4. `node scripts/buildGeospatialExposureProfiles.mjs --region X` ΞΑΝΑΓΡΑΦΕΙ το index.json
   μόνο με το X — μετά από pilot region, ΠΑΝΤΑ full run πριν το commit.
5. Commits: data ξεχωριστά από code· μήνυμα αναφέρει gates· unpushed μέχρι απόφαση Miltos.

**R1 — Swell (runtime μόνο):**
1. `services/weatherService.ts:282-287`: πρόσθεσε `'swell_wave_period'` στο hourly array και
   `swellWavePeriodS: optionalNumber(marineHourly.swell_wave_period?.[index])` στο mapping
   (:303-308). Πρόσθεσε το πεδίο στον αντίστοιχο τύπο (ψάξε `swellWaveDirectionDeg` στους
   τύπους και αντέγραψε το pattern).
2. `services/recommendationService.ts:1247-1260`: αντικατάστησε τον υπολογισμό `directSwell`:
   νέο κριτήριο = `marine.swellWaveHeightM >= 0.5` ΚΑΙ (αν υπάρχει `geospatialProfile` με
   `facingDeg != null`: `Math.cos((swellDir−facingDeg)·π/180) > 0.3` ΚΑΙ ο πλησιέστερος
   στο swellDir τομέας του profile έχει `blockedRayRatio < 0.6`· αλλιώς fallback στο
   υπάρχον legacy κριτήριο ΑΜΕΤΑΒΛΗΤΟ). Ο «πλησιέστερος τομέας»: στρογγυλοποίησε
   swellDir/45 mod 8 στη σειρά N,NE,E,SE,S,SW,W,NW.
3. Penalty κλιμάκωση στο :1385: `swimmingScore -= marine.swellWaveHeightM >= 0.9 ? 20 : 12;`
4. `utils/seaConditions.ts`: βρες τα measured-wave floors για protected/partial (σχόλιο
   αναφέρει offshore grid). Πρόσθεσε παράμετρο `directSwell: boolean` (default false) και
   παρέκαμψε τα floors όταν true. Πέρασέ τη από το call site στο recommendationService.
5. Hourly-path fix: βρες `getHourlyExposureLevel` (recommendationService ~:422) — πέρασε το
   `geospatialProfile` που έχει ήδη ο caller στο `assessBeachWindExposure` (πρόσθεσε το
   property στο object literal — ο τύπος το δέχεται ήδη).
6. Gates + engine suite: αν σπάσουν pinned invariants σε swell scenarios, ΣΤΑΜΑΤΑ και
   ανέφερε — ΜΗΝ τα «διορθώσεις» μόνος.
7. Validation 2δ-4 (ιστορικές μέρες): script `.tmp/swellValidation.mjs` που καλεί το marine
   API με `&past_days=…` για Μύρτο #1113, Πόρτο Κατσίκι #1171, Εγκρεμνούς #1159 + 3 ανατολικά
   controls και τυπώνει το directSwell αποτέλεσμα. Παρέδωσε τον πίνακα στο report.

**R2 — Effective fetch (build + schema v2):**
1. `scripts/geospatialExposureProfiles.ts:117`: νέο
   `const fanAnglesDegV2 = [-42,-36,-30,-24,-18,-12,-6,0,6,12,18,24,30,36,42];` και χρήση
   του στα τρία call sites (:394, :525, :579).
2. `utils/geospatialExposureModel.ts`: στο `assessGeospatialWindExposure` υπολόγισε επιπλέον
   `effectiveFetchKm` (τύπος του 2α — cos² στον αριθμητή, Σcos παρονομαστής, γωνίες από το
   κέντρο της βεντάλιας) και `maxOpenRunDeg` (μέγιστο τρέξιμο συνεχόμενων μη-blocked × 6).
   Επέκτεινε το `GeospatialExposureResult` με τα δύο πεδία.
3. Profile writer (geospatialExposureProfiles.ts, εκεί που γράφει sectors): γράψε
   `effectiveFetchKm`, `maxOpenRunDeg`, μετονόμασε ΛΟΓΙΚΑ το `fetchKm` σε «mean» ΚΡΑΤΩΝΤΑΣ
   το JSON όνομα `fetchKm` αμετάβλητο (συμβατότητα каталогων)· bump `schemaVersion` στο
   index summary· `types.ts` GeospatialExposureSector: πρόσθεσε τα προαιρετικά πεδία.
4. Runtime: `utils/windExposureModel.ts` παρεμβολή — όπου διαβάζει `fetchKm` για το
   intensity, προτίμησε `effectiveFetchKm ?? fetchKm` (fallback σε παλιά profiles).
   `services/geospatialExposureService.ts` `isUsableGeneratedProfile`: ΜΗΝ απαιτήσεις τα
   νέα πεδία (παλιά cached profiles πρέπει να περνούν).
5. Β-escalation: στο `windExposureEngine.ts` βρες `geometryEscalatesToExposed` — νέο κριτήριο
   `(effectiveFetchKm ?? fetchKm) >= 8 && (maxOpenRunDeg == null || maxOpenRunDeg >= 18)`.
6. Pilot: `--region south-aegean-milos`, σύγκρινε Voudia/Kastanas/TriaPigadia N πριν/μετά
   (στόχος 2δ-3). Μετά FULL rebuild (κανόνας 4) + asymmetry audit: script που μετρά
   αλλαγμένα sector-levels και τυπώνει % προς exposed (gate ≥75%) + ονομαστική λίστα των
   προς-protected.
7. GT snapshot diff (2δ-1): πριν το rebuild αποθήκευσε τα τρέχοντα GT levels, μετά diff —
   μηδέν προς-protected.

**R3 — Enclosure + diffraction floor (μαζί με το R2 rebuild):**
1. Build: νέο sweep ανά παραλία (72×5° έως 10 km, βήμα ίδιο με rays) → `windowWidthDeg`,
   `mouthBearingDeg`, `outerFetchKm` στο profile root (δίπλα στο facingDeg).
2. Στο τέλος του per-beach build: εφάρμοσε τον floor του 2β ΣΤΑ SECTORS (baked):
   protected τομέας που περνά τα 4 κριτήρια → level 'partial', πρόσθεσε
   `diffractionFloor: true` στο sector JSON. ΜΗΝ αλλάξεις intensity αριθμό (μόνο level) —
   το intensity μένει ως διαγνωστικό του raw.
3. Runtime copy: όπου χτίζεται το «γιατί» (utils/windExposureCopy.ts), αν ο τομέας έχει
   `diffractionFloor`, χρησιμοποίησε φράση «στενό στόμιο — πιθανό κύμα από ανοιχτά» (gr/en/
   fr/de/it — ακολούθησε το υπάρχον i18n pattern του αρχείου).
4. GT: πρόσθεσε ~10 νέα cases ΠΡΙΝ τρέξεις (2δ-3 λίστα + δικά σου από τα flagged του
   εθνικού pin audit με την ίδια γεωμετρία)· δήλωσε expected στον πίνακα του PR.
5. Negative controls του 2δ-3 (Vai-class, Αχιβαδολίμνη, Kolympithres) — αν οποιοδήποτε
   αλλάξει, ΣΤΑΜΑΤΑ και ανέφερε.

**Παραδοτέο κάθε R-βήματος**: report με (i) gates output, (ii) asymmetry audit, (iii) hard-set
πίνακα πριν/μετά, (iv) λίστα ονομαστικών προς-protected αλλαγών. Κανένα push χωρίς έγκριση.
