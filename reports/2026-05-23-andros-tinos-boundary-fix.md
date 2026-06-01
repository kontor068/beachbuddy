# Αναφορά διόρθωσης: Άνδρος / Τήνος

Ημερομηνία: 2026-05-23

## Τι πρόβλημα βρέθηκε

Η παραλία `Κουμέλας` ήταν περασμένη μέσα στην Άνδρο, αλλά οι συντεταγμένες της είναι στην Τήνο.

Συντεταγμένες:
- lat: `37.67231`
- lon: `25.00157`

## Τι διορθώθηκε

- Η `Κουμέλας` αφαιρέθηκε από την Άνδρο.
- Η `Κουμέλας` προστέθηκε στην Τήνο.
- Ενημερώθηκε το σημείωμα πρόσβασης ώστε να μην γράφει πλέον Άνδρο.
- Προστέθηκαν όρια ελέγχου για Άνδρο και Τήνο, ώστε ο έλεγχος δεδομένων να πιάνει παρόμοια λάθη.
- Αναγεννήθηκαν τα app data files.

## Αποτέλεσμα

- Άνδρος: `40` παραλίες
- Τήνος: `40` παραλίες
- Δεν υπάρχουν πλέον παραλίες της Τήνου μέσα στην Άνδρο.

## Έλεγχοι που έτρεξαν

### Άνδρος

Command:

```bash
npm run audit:beaches -- --island=andros --mode=deep --email-dry-run
```

Αποτέλεσμα:
- Beaches checked: `40`
- Issues: `1 LOW`
- Το LOW είναι μόνο σημείωση ακρίβειας για `Ateni`.
- Δεν υπάρχει BLOCKER ή HIGH θέμα.

### Τήνος

Command:

```bash
npm run audit:beaches -- --island=tinos --mode=deep --email-dry-run
```

Αποτέλεσμα:
- Beaches checked: `40`
- Issues: `1 LOW`
- Το LOW είναι ότι υπάρχουν δύο παραλίες με όνομα `Vathy`, που πιθανότατα είναι φυσιολογικό shared name.
- Δεν υπάρχει BLOCKER ή HIGH θέμα.

## Quality checks

Πέρασαν:

```bash
npm run quality:beach-data
npm run content:audit
npm run lint
npm run build
```

Σημείωση: το build έβγαλε μόνο το γνωστό Vite warning για μεγάλο chunk.

## Πηγές επιβεβαίωσης

- https://tinosecret.gr/listing-item/koumelas/
- https://tinosecret.gr/en/listing-item/koumelas/
- https://www.wondergreece.gr/v1/en/Regions/Tinos/Nature/Beaches/13794-Koumelas

