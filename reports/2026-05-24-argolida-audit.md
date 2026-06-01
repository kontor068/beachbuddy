# Αργολίδα - έλεγχος παραλιών

Ημερομηνία: 2026-05-24

## Τι έγινε

- Ελέγχθηκε η Αργολίδα ως ξεχωριστό mainland scope.
- Το αρχικό automated audit είχε φέρει άσχετες παραλίες από Σαρωνικό, Μέθανα, Πόρο, Αίγινα, Αγκίστρι και Αρκαδία, επειδή τα όρια του ελέγχου ήταν πολύ φαρδιά.
- Μπήκαν πιο αυστηρά όρια ελέγχου για `peloponnese-argolida-mainland`.
- Επιβεβαιώθηκε ότι το `Παραλία Νισάκι` δεν ανήκει στην Αργολίδα και βρίσκεται στο scope των Μεθάνων.
- Η Αργολίδα ανέβηκε από 25 σε 34 παραλίες.

## Διορθώσεις που πέρασαν

- `Ψιλή Άμμος` μετονομάστηκε σε `Παραλία Τολού - Ψιλή Άμμος`.
- Προστέθηκαν aliases: `Ψιλή Άμμος`, `Παραλία Τολού`, `Τολό`, `Tolo Beach`, `Psili Ammos beach`.
- Η θέση της έγινε πιο κεντρική για την παραλία Τολού, με πηγή τον Δήμο Ναυπλιέων.

## Παραλίες που προστέθηκαν

- `Βιβάρι`
- `Ίρια`
- `Γιαλάσι`
- `Νέα Επίδαυρος - Αλιότου`
- `Κουβέρτα`
- `Κουνουπί`
- `Χινίτσα`
- `Παραλία Δάρδεζα`
- `Κόστα`

## Τι δεν πέρασα ακόμα

- `Νησί / Σπηλιά` στην Παλαιά Επίδαυρο: υπάρχουν πηγές που τα αναφέρουν, αλλά δεν είχα αρκετά καθαρές συντεταγμένες.
- `Μαδέρι` και `Μπίστι` στην Ερμιόνη: υπάρχουν πηγές που τα αναφέρουν, αλλά θέλουν δεύτερο local map pass για να μη μπει λάθος pin.

Δεν τα πρόσθεσα με μαντεμένες συντεταγμένες.

## Αποτέλεσμα audit

Εντολή:

```bash
npm run audit:beaches -- --island=argolida --mode=deep --email-dry-run --refresh-external
```

Αποτέλεσμα:

- Παραλίες που ελέγχθηκαν: 34
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 2
- LOW: 1
- Gate status: περνάει για BLOCKER/HIGH

## Θέματα που έμειναν

### MEDIUM - GBeach κοντά στην ανεπίσημη γυμνιστική παραλία

Το OSM έχει `GBeach` περίπου 332m από την υπάρχουσα `Ανεπίσημη Γυμνιστική Παραλία`.

Δεν το πέρασα ως νέα παραλία, γιατί πιθανότατα είναι κοντινό section ή alias.

### MEDIUM - Παραλία Κονδύλι

Το OSM έχει `Παραλία Κονδύλι` περίπου 368m από την υπάρχουσα `Παραλία Αγίου Νικολάου - Κονδύλι`.

Δεν το πέρασα ως νέα παραλία, γιατί είναι η ίδια γνωστή παραλία/ζώνη με άλλο όνομα.

### LOW - Τολό / Ψιλή Άμμος

Το OSM `Psili Ammos beach` απέχει περίπου 303m από τη νέα κεντρική θέση της `Παραλία Τολού - Ψιλή Άμμος`.

Το κράτησα έτσι, γιατί η νέα θέση είναι πιο κεντρική για την παραλία Τολού και το παλιό όνομα έμεινε ως alias.

## Πηγές

- Δήμος Ναυπλιέων - Παραλίες: https://nafplio.gr/en/aksiotheata/beaches/
- Δήμος Ναυπλιέων - Παραλία Τολού: https://nafplio.gr/paralies/paralia-toloy/
- Δήμος Ναυπλιέων - Βιβάρι: https://nafplio.gr/paralies/vivari/
- Δήμος Ναυπλιέων - Ίρια: https://nafplio.gr/paralies/iria/
- Visit Greece - Beaches of Epidaurus: https://www.visitgreece.gr/experiences/beaches/beloved-beaches/beaches-of-epidaurus/
- Epidavros Land - beaches: https://epidavros-land.gr/beaches/
- Bathing Water Profiles - Νέα Επίδαυρος / Αλιότου: https://bathingwaterprofiles.gr/el/bathingprofiles/elbw039234033101
- Visit Peloponnese - Beaches in the area of Ermioni: https://www.visitpeloponnese.com/en/prdct/beaches-area-ermioni
- Terrabook - Παραλία Χινίτσας: https://greece.terrabook.com/el/argolis/page/paralia-chinitsas/
- Terrabook - Κόστα: https://greece.terrabook.com/el/argolis/page/kosta/
- GTP - Κόστα: https://www.gtp.gr/PortPage.asp?id=9217
- Πελοπόννησος Search - Δάρδεζα: https://peloponnisossearch.com/el/beach/dardeza-beach

## Validation

- `npm run build:beach-data`: pass, 2731 beaches, 110 region files
- `npm run audit:beaches -- --island=argolida --mode=deep --email-dry-run --refresh-external`: pass for BLOCKER/HIGH
- `npm run quality:beach-data`: pass
- `npm run content:audit`: pass
- `npm run lint`: pass
- `npm run build`: pass, with the existing Vite large chunk warning
