# Θεσσαλονίκη - Έλεγχος παραλιών

Ημερομηνία: 2026-05-24

## Απλό συμπέρασμα

Η περιοχή Θεσσαλονίκης είχε ένα καθαρό λάθος περιοχής: το `Sahara` ήταν μέσα στη Θεσσαλονίκη, αλλά οι πηγές το τοποθετούν στη Νέα Ηράκλεια Χαλκιδικής.

Το διόρθωσα:

- Η Θεσσαλονίκη έμεινε με 16 παραλίες.
- Η Χαλκιδική πήρε το `Παραλία Νέας Ηράκλειας - Sahara`.
- Τα λατινικά/venue-style ονόματα στη Θεσσαλονίκη έγιναν πιο καθαρά ελληνικά ονόματα, αλλά τα παλιά έμειναν ως aliases για αναζήτηση.
- Ο deep έλεγχος Θεσσαλονίκης δεν βγάζει πια MEDIUM/HIGH/BLOCKER προβλήματα.

## Τι άλλαξε

| Πριν | Μετά | Γιατί |
| --- | --- | --- |
| `Sahara` στη Θεσσαλονίκη | `Παραλία Νέας Ηράκλειας - Sahara` στη Χαλκιδική | Οι πηγές το βάζουν στη Νέα Ηράκλεια Χαλκιδικής. |
| `Aretsou` | `Πλαζ Αρετσούς` | Καλύτερο ελληνικό display name. |
| `Jazz` | `Παραλία Σταυρού` | Το Jazz κρατήθηκε ως alias/venue, όχι ως κύριο όνομα παραλίας. |
| `Milies` | `Μηλιές` | Καλύτερο ελληνικό display name. |
| `Peraia` | `Παραλία Περαίας` | Καλύτερο ελληνικό display name. |
| `Nea Michaniona` | `Παραλία Νέας Μηχανιώνας` | Καλύτερο ελληνικό display name. |
| `Nea Vrasna` | `Παραλία Νέων Βρασνών` | Καλύτερο ελληνικό display name. |
| `KAAΥ Asprovalta` | `ΚΑΑΥ Ασπροβάλτας` | Καλύτερο ελληνικό display name. |
| `Kyani Akti` | `Κυανή Ακτή` | Καλύτερο ελληνικό display name. |
| `Giatrou Tsairi` | `Γιατρού Τσαΐρι` | Καλύτερο ελληνικό display name. |
| `Kroustali` | `Κρουστάλη` | Καλύτερο ελληνικό display name. |
| `Patoma` | `Πάτωμα` | Καλύτερο ελληνικό display name. |
| `Trapezi` | `Τραπέζι` | Καλύτερο ελληνικό display name. |

## Τι δεν πρόσθεσα

Δεν πρόσθεσα 3 παραλίες/sections γυμνιστών ως κανονικές παραλίες:

- `Paralia Gymniston`
- `Paralia Gtmniston Ammolofoi`
- `Paralia Gymniston Agiou Nikolaou`

Λόγος: Το BeachBuddy δεν έχει ακόμα ξεκάθαρο πεδίο `nudism/FKK`. Αν τις βάλουμε τώρα σαν κανονικές παραλίες, μπορεί να βγουν λάθος σε οικογένειες/τουρίστες χωρίς προειδοποίηση.

## Τι θεωρήθηκε ήδη καλυμμένο

Δεν πρόσθεσα ξεχωριστά:

- `paralia Stavroy`
- `paralia Platania`

Λόγος: Είναι κοντινά τμήματα/section names στην ίδια ζώνη Σταυρού/Μηλιών. Για MVP δεν χρειάζεται ξεχωριστή κάρτα, γιατί θα δημιουργούσε διπλοεγγραφές.

## Αποτέλεσμα audit

Εντολή:

```bash
npm run audit:beaches -- --island=thessaloniki-area --mode=deep --email-dry-run --refresh-external
```

Αποτέλεσμα:

- Παραλίες ελεγμένες: 16
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 5

Τα 5 LOW είναι πληροφοριακά, όχι πράγματα που πρέπει να φτιαχτούν τώρα.

## Validation

Πέρασαν καθαρά:

- `npm run build:beach-data`
- `npm run audit:beaches -- --island=thessaloniki-area --mode=deep --email-dry-run --refresh-external`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run lint`
- `npm run build`

Σημείωση: το `npm run build` έβγαλε μόνο το γνωστό Vite warning για μεγάλο chunk, όχι error.

## Πηγές

- OpenStreetMap candidate `paralia Stavroy`: https://www.openstreetmap.org/way/211041436
- OpenStreetMap candidate `paralia Platania`: https://www.openstreetmap.org/way/1302450029
- OpenStreetMap nudist candidate: https://www.openstreetmap.org/node/12816056951
- OpenStreetMap nudist candidate: https://www.openstreetmap.org/way/1382668177
- OpenStreetMap nudist candidate: https://www.openstreetmap.org/way/1382668178
- Sahara location source: https://cateringhoutos.gr/en/sahara-resort/
- Sahara location source: https://omprela.gr/portfolio/sahara-beach-bar-resort-en/?lang=en

## Ανοιχτό θέμα

Αν αποφασίσουμε να υποστηρίξουμε `nudism/FKK`, τότε τα 3 nudist sections μπορούν να μπουν με ξεκάθαρη σήμανση και να μη βγαίνουν σε λάθος κοινό.
