# Ηράκλειο Κρήτης - Batch 1 προσθήκες

Ημερομηνία: 2026-05-23

## Τι έγινε

Προστέθηκαν 15 παραλίες στο Ηράκλειο Κρήτης, μόνο από το πρώτο ασφαλές batch που είχε αρκετή ένδειξη από OSM/Overpass και γεωγραφικό έλεγχο.

Δεν προστέθηκαν παραλίες από Ρέθυμνο ή Λασίθι. Μπήκε επίσης όριο ελέγχου για το Ηράκλειο, ώστε τα επόμενα audits να μη μαζεύουν εύκολα παραλίες από διπλανούς νομούς.

## Παραλίες που προστέθηκαν

- Αμμουδάρα
- Καρτερός
- Αγία Πελαγία
- Λυγαριά
- Μονοναύτης
- Ψαρομούρα
- Μάδε
- Παλαιόκαστρο
- Κοκκίνη Χάνι
- Γούβες
- Ανάληψη
- Λιμανάκια Χερσονήσου
- Σταλίδα
- Μάλια
- Ποταμός Μαλίας

## Τι διορθώθηκε προληπτικά

- Το dataset του Ηρακλείου πήγε από 13 σε 28 παραλίες.
- Οι νέες εγγραφές έχουν συντεταγμένες `lat/lon`.
- Οι νέες εγγραφές έχουν βασικά χαρακτηριστικά: πρόσβαση, τύπο ακτής, οργανωμένη/μη οργανωμένη, παροχές, βάθος νερών και aliases.
- Προστέθηκαν γεωγραφικά bounds για `crete-crete-heraklion` στα audit scripts.
- Έγινε regeneration των app-ready beach files.

## Αποτέλεσμα ελέγχου

Η εντολή:

```bash
npm run audit:beaches -- --island=heraklion --mode=deep --email-dry-run --refresh-external
```

έβγαλε:

- Παραλίες που ελέγχθηκαν: 28
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 26
- LOW: 2
- Gate status: περνάει για blocker/high προβλήματα

Άρα δεν υπάρχει άμεσο μπλοκάρισμα για το dataset, αλλά μένουν αρκετά σημεία για δεύτερο γύρο.

## Τι μένει για δεύτερο γύρο

Πιθανές παραλίες που θέλουν έλεγχο πριν μπουν:

- Paralia Krasa
- Katalyki
- Listis
- Keratokambos
- Koudoumas
- Aliori
- Star Beach
- Pera Galinoi
- Kokkines Plakes
- Macha
- Leprias
- Katarti
- Elygia
- Skoyros
- Stena
- Maridaki
- Glykos Kolympos
- Salamias
- Agios Nikitas

Σημεία που θέλουν ανθρώπινη επιβεβαίωση:

- Psili Ammos: το audit βρήκε πιθανό OSM σημείο με ίδιο/παρόμοιο όνομα περίπου 5.6km μακριά. Δεν το άλλαξα αυτόματα.
- Karavovrysi: πιθανό κοντινό section/alias `Makria Ammos`.
- Limanakia Chersonisou: πιθανό κοντινό section/alias `Saradari Nude Beach`.
- Palaiokastro: πιθανό κοντινό section/alias `Pantanassa`.

## Αρχεία που πειράχτηκαν

- `public/greek_beaches.json`
- `public/data/beaches/**` από regeneration
- `scripts/auditBeachDataset.mjs`
- `scripts/validateCriticalBeachData.mjs`

## Checks που πέρασαν

```bash
npm run build:beach-data
npm run audit:beaches -- --island=heraklion --mode=deep --email-dry-run --refresh-external
npm run quality:beach-data
npm run content:audit
npm run lint
npm run build
git diff --check
```

Σημείωση: το `npm run build` πέρασε, αλλά έβγαλε το γνωστό Vite warning για μεγάλο chunk. Δεν σχετίζεται με τις νέες παραλίες.

## Απόφαση

Το Batch 1 μπορεί να μείνει. Για το Batch 2 δεν πρέπει να περαστούν όλα μαζικά. Θέλει έλεγχο ανά ομάδα, ειδικά για νότια Ηράκλειο και για περιπτώσεις που μπορεί να είναι μικρά sections της ίδιας παραλίας.
