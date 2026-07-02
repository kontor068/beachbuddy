# SEO Title & Meta Description Spec (οριστικό)

Στόχος: να ανέβει το CTR στις θέσεις 8–12 (σελίδες με εμφανίσεις και μηδέν κλικ)
πουλώντας το πραγματικό differentiator — live άνεμος & κύμα ανά παραλία — χωρίς
κανέναν ισχυρισμό που δεν αντιστοιχεί σε αυτό που πραγματικά κάνει η σελίδα.

Ημερομηνία: 2026-07-03. Ισχύει για το prerender (`scripts/prerenderBeachPages.mjs`),
το client-side title sync (`App.tsx` detail SEO effect) και το audit
(`scripts/auditSeoPrerender.mjs`).

---

## 0. Σχέση με την υπάρχουσα (uncommitted) δουλειά του codex

Το working tree περιέχει ήδη μια πλήρη «honesty pass» (codex):

- Αφαίρεσε **«σήμερα/today»**, **«ήρεμη/calm»**, **«καλύτερη σήμερα/best today»** και
  **αχαρακτήριστο «απάνεμη/sheltered»** από ΟΛΟ το στατικό copy (home, landings,
  island-intent σελίδες, 5 γλώσσες).
- Πρόσθεσε guard στο prerender (`hasUnsupportedStaticConditionCopy`) που μπλοκάρει
  τέτοιο wording σε overrides/stories/descriptions.
- Πρόσθεσε audit check (`checkRiskyConditionClaims`) που σκανάρει title, meta, h1
  και ορατό κείμενο ΚΑΘΕ prerendered σελίδας και προειδοποιεί για «σήμερα»-wording
  χωρίς ορατά live δεδομένα, «safe», «guarantee», αχαρακτήριστο «απάνεμος».

**Το παρόν spec χτίζει ΠΑΝΩ σε αυτό, δεν το αναιρεί.** Η λογική συμφιλίωσης:

| Ισχυρισμός | Επιτρέπεται σε στατικό title/meta; | Γιατί |
|---|---|---|
| «σήμερα», «τώρα», «today» | ΟΧΙ πουθενά | Το HTML ψήνεται στο deploy και σερβίρεται εβδομάδες (no-daily-rebuild). Το snippet ΕΙΝΑΙ στατικό — «σήμερα» εκεί είναι ψέμα. Το audit το πιάνει. |
| «live» / «ζωντανά» | ΝΑΙ, **μόνο σε σελίδες παραλίας** | Λειτουργικός ισχυρισμός: η σελίδα, μόλις ανοίξει, υδατώνεται σε SPA και δείχνει live άνεμο/κύμα/καιρό. Ο επισκέπτης που κλικάρει παίρνει ακριβώς αυτό. Κανένας guard δεν το φλεγκάρει (σωστά). |
| «live» σε category/εθνικές σελίδες | ΟΧΙ ως υπόσχεση της σελίδας | Οι island-intent και national landings είναι **καθαρά στατικά άρθρα — το SPA δεν έχει route γι' αυτές** (`utils/beachGuides.ts`). Επιτρέπεται μόνο ως παραπομπή: «δες live άνεμο για κάθε παραλία στο CalmBeach» (τα λινκ οδηγούν σε σελίδες που όντως το δείχνουν). |
| «Καλύτερες/Best {category}» | ΝΑΙ σε λίστες | Editorial επιλογή με κριτήρια ορατά στη σελίδα (λίστα + αιτιολόγηση), όχι conditions claim. Το audit φλεγκάρει μόνο «best + today». |
| «Πιο απάνεμες / More sheltered» | ΝΑΙ, μόνο με qualifier και μόνο όπου βασίζεται στο `protectedFrom` | Συγκριτικός, data-backed ισχυρισμός (ίδιο πεδίο με το UI endorsement «Πιο υπήνεμη επιλογή»). Ποτέ σκέτο «Απάνεμες». |
| «ήρεμη/calm», «ασφαλής/safe», «εγγυημένα» | ΟΧΙ πουθενά | Κατάσταση θάλασσας/ασφάλεια δεν υπόσχονται ποτέ στατικά. |

Μία μόνο απαιτούμενη προσαρμογή στους guards (βλ. §7): το ελληνικό qualifier set
δεν περιλαμβάνει το συγκριτικό «πιο», οπότε το «Πιο Απάνεμες» θα φλεγκαριζόταν
άδικα από το audit.

---

## 1. Γενικοί κανόνες (όλοι οι τύποι)

1. **Μήκη**: title ≤60 χαρακτήρες (στα ελληνικά στόχευε ≤58 — φαρδύτερα glyphs,
   το όριο της Google είναι ~580px, όχι χαρακτήρες)· meta ≤155.
2. **Front-load**: entity (όνομα + νησί) πρώτα, hook μετά. Η Google κόβει από το
   τέλος και ξαναγράφει titles που δεν ταιριάζουν στο query — το πρώτο μισό
   πρέπει να στέκεται μόνο του.
3. **Brand**: `| CalmBeach` στο τέλος, ΜΟΝΟ αν χωράει (tier 1). Από το 2022 η
   Google δείχνει το site name ξεχωριστά στο mobile SERP (το τραβάει από το
   WebSite JSON-LD που ήδη έχουμε στο index.html), άρα το brand στο title είναι
   εν μέρει πλεονασμός — θυσιάζεται πρώτο.
4. **Διαχωριστικά**: `—` μέσα στο title, `|` μόνο πριν το brand.
5. **Χωρίς κλίση τοπωνυμίων**: ποτέ «στη Μήλο/στην Κεφαλονιά» προγραμματιστικά
   (θέλει γραμματική κλίση/άρθρο ανά γένος). Πάντα σχήμα `{island}: …` ή `… — {island}`.
6. **Meta = λόγος για κλικ, όχι περίληψη**: 1 πρόταση μοναδικά traits της
   σελίδας + 1 πρόταση value prop/CTA. Η Google ξαναγράφει το description στα
   ~70% των queries — γράφουμε για το 30% όπου το query κάνει match στο κείμενό μας.
7. **Παραλλαγή title ≠ H1**: το H1 μένει καθαρό entity («Παραλία Χ, Νησί») — ήδη
   έτσι· ο hook ζει μόνο στο `<title>`. Καλό και για rewrites (η Google συχνά
   προτιμά το H1· αν το κάνει, πέφτουμε σε ασφαλές entity title).
8. **og:title / twitter:title** καθρεφτίζουν το `<title>`, όπως τώρα.

Intent patterns από GSC που πρέπει να καλύπτονται lexically:

- `"{beach} beach"` → EN title ξεκινά `{beach} Beach, {island}`.
- `"παραλία {beach}"` → GR title ξεκινά `Παραλία {beach}` (μέσω του υπάρχοντος
  `localizedBeachLabel`, που ήδη αποφεύγει το διπλό «Παραλία Παραλία»).
- `"καιρός παραλία {beach}"` → η λέξη **«καιρός/καιρό»** μπαίνει στο meta της
  σελίδας παραλίας (στο title δεν χωράει μαζί με «Άνεμος & Κύμα» — ο άνεμος
  είναι το differentiator, κερδίζει τη θέση).
- `"{νησί} παραλίες για παιδιά"` → family title περιέχει «για Οικογένειες & Παιδιά».
- `"snorkeling {νησί}"` → snorkeling title περιέχει «Snorkeling» λατινικά και στα GR
  (έτσι ψάχνει ο Έλληνας χρήστης — ήδη σωστό στο codebase).

---

## 2. Τύπος 1 — Σελίδα παραλίας (`/beaches/{island}/{id}-{slug}/`)

Η ΜΟΝΗ σελίδα όπου επιτρέπεται το live hook (υδατώνεται σε SPA με live δεδομένα).

### 2.1 Title — εναλλακτικές

| # | GR φόρμουλα | Παράδειγμα (Σαρακήνικο) | Υπέρ / Κατά |
|---|---|---|---|
| A (τωρινό) | `{beachLabel}, {island} \| Άνεμος, χάρτης & χρήσιμες πληροφορίες` | «Παραλία Σαρακήνικο, Μήλος \| Άνεμος, χάρτης & χρήσιμες πληροφορίες» (68) | Ξεπερνά το όριο ήδη· «χρήσιμες πληροφορίες» = ό,τι λέει κάθε ανταγωνιστής· κανένα differentiator. |
| B | `{beachLabel}, {island} — Άνεμος & Κύμα Live \| CalmBeach` | «Παραλία Σαρακήνικο, Μήλος — Άνεμος & Κύμα Live \| CalmBeach» (58) | Entity πρώτα, differentiator καθαρός, truthful. Χάνει τη λέξη «καιρός». |
| C | `{beachLabel}, {island}: Καιρός, Άνεμος & Κύμα \| CalmBeach` | «Παραλία Σαρακήνικο, Μήλος: Καιρός, Άνεμος & Κύμα \| CalmBeach» (61) | Καλύπτει «καιρός παραλία Χ» queries, αλλά χωρίς «live» διαβάζεται σαν γενικό weather site — δεν διαφοροποιεί από poseidon/meteo. |

**Τελική επιλογή: B.** Το «live» είναι το μόνο πράγμα που κανείς στο SERP δεν
μπορεί να πει· το «καιρός» καλύπτεται στο meta (κανόνας §1.6) και το intent
«καιρός παραλία Χ» κάνει match και εκεί. Το C κρατιέται ως fallback αν στο GSC
δεν κουνηθεί το CTR των «καιρός…» queries σε 4–6 εβδομάδες.

**EN (ίδια λογική):**

```
{beach} Beach, {island}: Live Wind & Waves | CalmBeach
π.χ. "Sarakiniko Beach, Milos: Live Wind & Waves | CalmBeach"  (54)
```

(Το `localizedBeachLabel` βάζει ήδη το «Beach» μετά το όνομα στα EN και το
παραλείπει αν υπάρχει ήδη στο όνομα.)

### 2.2 Title — overflow tiers (ντετερμινιστικά, με τη σειρά)

1. **T1**: `{beachLabel}, {island} — Άνεμος & Κύμα Live | CalmBeach` — αν ≤60 (GR ≤58).
2. **T2**: πέτα το ` | CalmBeach` (το site name εμφανίζεται έτσι κι αλλιώς στο mobile SERP).
3. **T3**: πέτα το `, {island}` (μένει στο meta, στο H1 και στο breadcrumb — δεν χάνεται από το snippet).
4. **T4**: σκέτο `{beachLabel}` (οριακή περίπτωση· η Google κόβει με ellipsis ό,τι περισσεύει).

Ο hook «Άνεμος & Κύμα Live» ΔΕΝ θυσιάζεται πριν από brand/νησί — είναι ο λόγος
ύπαρξης της αλλαγής.

### 2.3 Meta description — cascade (κρατάμε την υπάρχουσα, αλλάζει μόνο η ουρά)

Προτεραιότητα (ανά en/gr):

1. **`SEO_META_DESCRIPTION_OVERRIDES`** — χειροποίητα, μένουν ως έχουν (ήδη
   ακολουθούν το pattern «traits + live CTA»).
2. **Story opener + live CTA**: πρώτη «safe» παράγραφος του editorial story,
   κομμένη στους ~115 χαρακτήρες, + ` Δες live άνεμο & κύμα πριν πας.` /
   ` Check live wind & waves before you go.` (αν το σύνολο ≤155· αλλιώς μόνο ο
   opener όπως τώρα). Έτσι οι ~83 story σελίδες κρατούν τη μοναδικότητά τους ΚΑΙ
   αποκτούν τον λόγο-για-κλικ που έλειπε.
3. **Νέο programmatic template** (αντικαθιστά και το authored-description path
   στο meta — το authored κείμενο μένει κανονικά στο σώμα της σελίδας):

```
GR: {beachLabel}, {island}: {traitSentence} Δες live άνεμο, κύμα και καιρό πριν πας — χάρτης, πρόσβαση και κοντινές παραλίες.
EN: {beach} Beach, {island}: {traitSentence} Check live wind, waves and weather before you go — map, access and nearby beaches.
```

`{traitSentence}` συντίθεται από τα δεδομένα, με σειρά προτεραιότητας μέχρι να
γεμίσει ο χώρος (σύνολο ≤155):

- τύπος: «Αμμώδης παραλία.» / «Παραλία με βότσαλο.» (από `beachTypeLabels`)
- 1–2 amenities: «οργανωμένη με ξαπλώστρες», «με πάρκινγκ», «με ταβέρνες κοντά»
- προστασία ΜΟΝΟ αν υπάρχει `protectedFrom` βόρειο: «συχνά πιο απάνεμη σε
  βόρειους ανέμους» (το «συχνά» είναι υποχρεωτικό — περνάει τους guards)
- flags: «οικογενειακή», «καλή για snorkeling»

Αν δεν υπάρχει κανένα trait: παραλείπεται το `{traitSentence}` και το live CTA
μπαίνει πρώτο («{beachLabel}, {island}: δες live άνεμο, κύμα και καιρό πριν
πας…»). Παράδειγμα πλήρους:

> «Παραλία Καλόγερος, Πάρος: Παραλία με άμμο και βότσαλο, καλή για snorkeling,
> συχνά πιο απάνεμη σε βόρειους ανέμους. Δες live άνεμο & κύμα πριν πας.» (~150)

### 2.4 Client-side sync (υποχρεωτικό)

Το `App.tsx` detail-SEO effect (γύρω στο ~2290) γράφει σήμερα το ΠΑΛΙΟ σχήμα
(«Windschutz, Karte & Tipps» κ.λπ.). Πρέπει να πάρει τις ίδιες φόρμουλες
(title B + meta template), αλλιώς το title αλλάζει μπροστά στον χρήστη μετά το
hydration και σπάει το parity που κλείδωσε το SEO Phase 1. Το client, επειδή
έχει όντως live δεδομένα φορτωμένα, ΘΑ μπορούσε να βάλει και «σήμερα» — μην το
κάνει: κρατάμε 1:1 το στατικό title για συνέπεια crawl/behavior.

DE/FR/IT (Milos pilot): ίδια φόρμουλα, μεταφρασμένος hook — `Wind & Wellen live`,
`Vent & vagues en direct`, `Vento e onde live`.

---

## 3. Τύπος 2 — Category σελίδα ανά νησί (`/{category}-beaches/{island}/`)

Στατικά άρθρα, καθόλου live δεδομένα ⇒ **κανένα «live/σήμερα» στο title**. Το
«live» επιτρέπεται στο meta μόνο ως παραπομπή στις σελίδες παραλίας.

### 3.1 Σχήμα title — εναλλακτικές

| # | Σχήμα | Παράδειγμα | Υπέρ / Κατά |
|---|---|---|---|
| A (codex, τωρινό working tree) | `{island}: παραλίες που συχνά βολεύουν με μελτέμι` | — | Άψογα honest, αλλά δεν κάνει match σε κανένα query που ψάχνει ο κόσμος («απάνεμες παραλίες μήλος», «best snorkeling kefalonia»)· μηδενική έλξη. |
| B | `{Category keyword} {island} \| CalmBeach` (σκέτο keyword) | «Snorkeling Κεφαλονιά» | Match στο query αλλά καμία υπόσχεση περιεχομένου· αδύναμο σε θέση 8–12 όπου όλα τα αποτελέσματα έχουν το keyword. |
| C | `{island}: {editorial claim + category keyword} \| CalmBeach` | «Κεφαλονιά: Οι Καλύτερες Παραλίες για Snorkeling» | Query match + λόγος για κλικ (curated λίστα)· ο ισχυρισμός «καλύτερες» καλύπτεται από ορατή, αιτιολογημένη λίστα. |

**Τελική επιλογή: C**, με τον περιορισμό ότι conditions-λέξεις (απάνεμες)
μπαίνουν μόνο qualified. Τελικές φόρμουλες ανά topic:

| Topic | GR title | EN title |
|---|---|---|
| snorkeling | `{island}: Οι Καλύτερες Παραλίες για Snorkeling \| CalmBeach` (59 για «Κεφαλονιά») | `Best Snorkeling Beaches in {island} \| CalmBeach` |
| family | `{island}: Παραλίες για Οικογένειες & Παιδιά \| CalmBeach` | `Family Beaches in {island} with Shallow Water \| CalmBeach` |
| sunset | `{island}: Παραλίες για Ηλιοβασίλεμα (Δυτικές) \| CalmBeach` | `Sunset Beaches in {island} Facing West \| CalmBeach` |
| sheltered | `{island}: Πιο Απάνεμες Παραλίες στο Μελτέμι \| CalmBeach` | `More Sheltered Beaches in {island} for the Meltemi` |
| organized | `{island}: Οργανωμένες Παραλίες με Ξαπλώστρες \| CalmBeach` | `Organized Beaches in {island} with Sunbeds \| CalmBeach` |
| secluded | `{island}: Απομονωμένες Παραλίες χωρίς Κόσμο \| CalmBeach` | `Secluded Beaches in {island} Away from Crowds \| CalmBeach` |

Σημειώσεις:

- **sheltered**: «Πιο Απάνεμες» = συγκριτικό + data-backed (η λίστα φιλτράρει σε
  `protectedFrom`, το ίδιο πεδίο που κερδίζει το UI endorsement «Πιο υπήνεμη
  επιλογή»). Το EN «More» υπάρχει ήδη στο qualifier set του audit· το GR «πιο»
  πρέπει να προστεθεί (§7). Αν προτιμηθεί μηδενικό ρίσκο, εναλλακτική:
  «Συχνά Απάνεμες» (το «συχν» περνάει ήδη) — χειρότερα ελληνικά, ίδιο νόημα.
- **Επαναφορά «Καλύτερες/Best» ΜΟΝΟ σε snorkeling** (και προαιρετικά sunset):
  εκεί το query pattern είναι κυριολεκτικά «best …». Στο family/organized το
  «best» δεν προσθέτει (το intent είναι χαρακτηριστικό, όχι κατάταξη). Αυτό
  αναιρεί σημειακά το γενικό ξήλωμα του «Best» από το codex — συνειδητά.
- Overflow tiers: T2 πέτα brand → T3 πέτα την παρένθεση/ουρά («με Ξαπλώστρες»,
  «(Δυτικές)») → T4 `{island}: {category keyword}`.

### 3.2 Meta φόρμουλα

```
GR: {count} {category phrase} — {island}: {κριτήριο επιλογής σε 5-8 λέξεις}. Δες live άνεμο & κύμα για κάθε παραλία στο CalmBeach πριν πας.
EN: {count} {category phrase} in {island}: {selection basis}. Check live wind & waves for each beach on CalmBeach before you go.
```

Παραδείγματα (≤155):

- «12 παραλίες για snorkeling — Κεφαλονιά: καθαρά νερά και βραχώδης βυθός. Δες
  live άνεμο & κύμα για κάθε παραλία στο CalmBeach πριν πας.»
- «9 sheltered picks in Milos, oriented away from northerly Meltemi winds. Check
  live wind & waves for each beach on CalmBeach before you go.»

Το `{count}` υπάρχει ήδη στο `islandIntents.copy(islandName, count)` — μπαίνει
και στο meta (νούμερο στο snippet = μετρήσιμο, ξεχωρίζει). Ενημερώνεται σε κάθε
rebuild, άρα δεν μπαίνει ποτέ σε ρίσκο staleness τύπου «σήμερα».
Το «κριτήριο επιλογής» είναι το honest disclosure: λέει ΓΙΑΤΙ μπήκαν στη λίστα
(orientation data, flags), όχι υπόσχεση κατάστασης.

---

## 4. Τύπος 3 — Εθνικές landing (`/accessible-beaches-greece/` κ.λπ.)

Ίδιοι κανόνες με τις category (στατικά άρθρα). Φόρμουλα:

```
Title GR: {Category} Παραλίες στην Ελλάδα ({μοναδικό στοιχείο}) | CalmBeach
Title EN: {Category} Beaches in Greece ({unique hook}) | CalmBeach
Meta:     {τι είναι η λίστα + έκταση/count}. {disclosure ή CTA με «live» ως παραπομπή}.
```

Τελικά ανά σελίδα:

| Σελίδα | GR | EN |
|---|---|---|
| accessible | `Προσβάσιμες Παραλίες ΑμεΑ στην Ελλάδα (Seatrac) \| CalmBeach` (59) | `Accessible Beaches in Greece with Seatrac \| CalmBeach` (53) |
| best-beaches-greece-today* | `Σύγκριση Παραλιών στην Ελλάδα: Άνεμος & Κύμα \| CalmBeach` | `Compare Greek Beaches by Wind, Waves & Shelter \| CalmBeach` |
| sheltered-meltemi | `Πιο Απάνεμες Παραλίες στο Μελτέμι — Ελλάδα \| CalmBeach` | `More Sheltered Greek Beaches for the Meltemi \| CalmBeach` |
| family | `Παραλίες για Οικογένειες & Παιδιά στην Ελλάδα \| CalmBeach` | `Family Beaches in Greece with Shallow Water \| CalmBeach` |
| camping | `Παραλίες με Κάμπινγκ Κοντά — Ελλάδα \| CalmBeach` | `Beaches with Campsites Nearby in Greece \| CalmBeach` |

\* Το URL slug `/best-beaches-greece-today/` μένει ως έχει (ήδη indexed, τα
redirects κοστίζουν περισσότερο απ' όσο αποδίδει το slug) — slug ≠ ισχυρισμός.

Meta accessible (δείγμα, ≤155):

> «134 παραλίες με υποδομές ΑμεΑ σε όλη την Ελλάδα — Seatrac, ράμπες, προσβάσιμο
> πάρκινγκ. Δες live άνεμο & κύμα ανά παραλία και επιβεβαίωσε τοπικά πριν πας.»

(Το «επιβεβαίωσε τοπικά» κρατά το υπάρχον trust-note commitment της σελίδας.)

---

## 5. Edge cases

1. **Μακριά ονόματα**: tiers §2.2 / §3.1. Ντετερμινιστικά, ποτέ mid-word cut —
   ο κόφτης δουλεύει σε επίπεδο ολόκληρου block (brand → νησί → ουρά hook), όχι
   χαρακτήρων.
2. **Ονόματα που περιέχουν ήδη «Παραλία/Beach»**: καλύπτεται από το υπάρχον
   `localizedBeachLabel` (μην ξαναϋλοποιηθεί).
3. **Ίδιο όνομα σε πολλά νησιά** (Άγιος Ιωάννης κ.λπ.): το `, {island}` στο title
   κάνει το disambiguation· στο T3 (όπου πέφτει το νησί) μένουν meta + breadcrumb.
4. **Χωρίς traits** (κενό amenities/type): meta πέφτει στο conditions-first
   variant (§2.3.3) — ποτέ κενή πρόταση ή «undefined».
5. **Νησί με μακρύ όνομα σε category title** (π.χ. «Χαλκιδική — Σιθωνία»): ίδια
   tiers· αν και το T4 ξεφεύγει, μένει `{category keyword} — {island}` και η
   Google κόβει.
6. **count < 5**: η σελίδα δεν παράγεται (υπάρχον gate `ISLAND_INTENT_MIN`) —
   καμία φόρμουλα δεν χρειάζεται placeholder-fallback για count=0.
7. **Μη-λατινικά ονόματα σε EN locale / greeklish σε GR**: περνούν από το υπάρχον
   `displayName` — καμία νέα λογική.
8. **DE/FR/IT**: μόνο Milos cluster· μεταφράζεται ο hook, οι φόρμουλες ίδιες.

---

## 6. Structured data

Τι υπάρχει: beach → `TouristAttraction` + `BreadcrumbList` (+ `FAQPage` όταν ≥2
ορατά Q&A)· category/national → `CollectionPage` + `ItemList`· site →
`WebSite` (index.html)· region → `WebPage`/`ItemList`.

Συστάσεις:

1. **Beach page: `@type: ['Beach', 'TouristAttraction']`** (πολλαπλός τύπος,
   έγκυρο JSON-LD). Το `schema.org/Beach` είναι ο ακριβής τύπος· κρατάμε και το
   TouristAttraction για ό,τι consumers το καταναλώνουν ήδη. Πεδία ως έχουν
   (name, description, geo, address, image, disambiguatingDescription).
   **Ρεαλισμός SERP: ΚΑΝΕΝΑ rich result** δεν υπάρχει για Beach/TouristAttraction —
   η αξία είναι entity disambiguation (Knowledge Graph, AI Overviews, Maps
   συσχέτιση), όχι εμφάνιση.
2. **BreadcrumbList: κρατιέται παντού** και προστίθεται στις category/national
   σελίδες αν λείπει (Home → «{island} beaches» → category). Αυτό ΕΧΕΙ ορατό
   αποτέλεσμα: αντικαθιστά το γκρι URL με breadcrumb trail στο SERP.
3. **FAQPage: μηδενική προσδοκία rich result.** Από τον Αύγουστο 2023 η Google
   περιόρισε τα FAQ rich results σε authoritative government/health sites — το
   calmbeach.gr δεν θα τα πάρει. Το markup ΔΕΝ παραβιάζει κάτι (οι απαντήσεις
   είναι ορατές στη σελίδα, guideline-compliant), οπότε: **κρατιέται όπου το FAQ
   ήδη υπάρχει ορατό** (κοστίζει μηδέν, βοηθά AI-answer surfaces), αλλά ΔΕΝ
   επεκτείνεται σε νέες σελίδες για SEO λόγους.
4. **WebSite (index.html): κρατιέται και είναι προϋπόθεση** για το site-name
   display στο mobile SERP — πάνω του πατάει η απόφαση να θυσιάζεται πρώτο το
   `| CalmBeach` (§1.3).
5. **ΟΧΙ**: `AggregateRating`/`Review` (δεν έχουμε ορατά reviews — θα ήταν
   structured-data spam), `Event`, `Product`, ή markup live τιμών ανέμου
   (volatile δεδομένα δεν μπαίνουν σε στατικό JSON-LD· θα ξεμείνουν stale και
   θα αντιφάσκουν με τη σελίδα — ίδια λογική με το «όχι σήμερα»).

Τι θα φανεί ρεαλιστικά στο SERP: title (ή rewrite του) + meta (ή rewrite) +
breadcrumb trail + site name + favicon + πιθανό image thumbnail στο mobile (από
τη σελίδα, όχι από το schema). Τίποτα άλλο — γι' αυτό όλο το βάρος CTR πέφτει
στο title/meta copy, όχι στο markup.

---

## 7. Αλλαγές σε guards/audit (μία, μικρή)

Για να περάσει το «Πιο Απάνεμες» (§3.1) χωρίς να χαλαρώσει τίποτα άλλο:

- `scripts/auditSeoPrerender.mjs` → `shelterQualifierPattern`: πρόσθεσε `πιο\s+απάνεμ`
  (ή σκέτο `\bπιο\b`) στο ελληνικό σκέλος. Το EN «More» υπάρχει ήδη.
- `scripts/prerenderBeachPages.mjs` → `hasUnsupportedStaticConditionCopy`: ίδια
  προσθήκη στο αντίστοιχο qualifier alternation (χρησιμοποιείται και για το
  «συχνά πιο απάνεμη» trait στο meta template §2.3).

Προαιρετικό (συνιστάται): νέο audit check για title length (>60 chars ⇒ warn),
ώστε τα tiers να μην παραβιαστούν σιωπηλά από μελλοντικά ονόματα.

---

## 8. Checklist υλοποίησης

1. `scripts/prerenderBeachPages.mjs`
   - `beachConditionsSuffix` → νέος hook ανά γλώσσα («Άνεμος & Κύμα Live» /
     «Live Wind & Waves» / «Wind & Wellen live» / «Vent & vagues en direct» /
     «Vento e onde live»).
   - `beachTitleFor` → tier logic §2.2 (νέα helper `fitTitle(parts, max)`).
   - `beachMetaDescription` → cascade §2.3 (story+CTA append, νέο trait template,
     authored description φεύγει από το meta path — μένει στο body).
   - `islandIntents` → titles/metas §3 (μόνο en/gr/de/fr/it strings).
   - `seoLandingPages` → titles/metas §4.
   - Beach JSON-LD `@type` → `['Beach','TouristAttraction']`· BreadcrumbList στα
     island-intent + national αν λείπει.
2. `App.tsx` detail-SEO effect → ίδιες title/meta φόρμουλες (parity, §2.4).
3. `scripts/auditSeoPrerender.mjs` → qualifier προσθήκη + title-length check (§7).
4. `npm run build` πλήρες ΠΡΙΝ το audit (γνωστό gotcha: το audit διαβάζει dist).
5. Audit πράσινο (κανένα risky-claim warning), spot-check 3 σελίδες ανά τύπο
   σε GR/EN για μήκη και rendering.
6. GSC: σημείωσε ημερομηνία αλλαγής· αξιολόγηση CTR ανά page-type σε 4–6
   εβδομάδες· αν τα «καιρός …» queries δεν βελτιωθούν, δοκίμασε παραλλαγή C
   (§2.1) σε υποσύνολο νησιών.

## 9. Compliance σημειώσεις (τι ΔΕΝ κάναμε και γιατί)

- Δεν βάλαμε «σήμερα/τώρα» σε κανένα στατικό snippet (θα ήταν αναληθές για
  cached HTML — και ό,τι πιάνει το νέο audit του codex, μένει ενεργό).
- Δεν βάλαμε FAQPage παντού «για τα rich results» — δεν αποδίδουν πια εκτός
  gov/health και η μαζική προσθήκη μυρίζει markup-για-το-markup.
- Δεν βάλαμε ratings/reviews markup — δεν υπάρχουν ορατά reviews.
- Τα templates ανά τύπο σελίδας είναι scaled αλλά ΟΧΙ scaled content abuse: κάθε
  σελίδα έχει μοναδικά δεδομένα (traits, counts, stories) και ο σκελετός
  περιγράφει πραγματική, διαφορετική λειτουργία κάθε σελίδας. Η πολιτική χτυπά
  μαζικό ΠΕΡΙΕΧΟΜΕΝΟ χωρίς αξία, όχι templated metadata.
- Κάθε στοιχείο JSON-LD αντιστοιχεί σε ορατό περιεχόμενο (FAQ ορατά, breadcrumb
  ορατό ως πλοήγηση, geo/address στο dl της σελίδας).
