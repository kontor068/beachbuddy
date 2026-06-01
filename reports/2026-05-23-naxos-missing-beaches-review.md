# Report ελλείψεων παραλιών Νάξου

Ημερομηνία: 2026-05-23

Εντολή που έτρεξε:

```bash
npm run audit:beaches -- --island=naxos --mode=deep --email-dry-run
```

## Με λίγα λόγια

Το dataset της Νάξου έχει τώρα 15 παραλίες.

Το deep audit βρήκε 20 θέματα, όλα MEDIUM:

- 17 πιθανές παραλίες που λείπουν.
- 3 περιπτώσεις που μοιάζουν με κοντινό alias ή τμήμα παραλίας.
- Δεν βρέθηκαν BLOCKER ή HIGH προβλήματα.

Δεν άλλαξα καμία παραγωγική παραλία. Αυτό το αρχείο είναι μόνο report για να αποφασίσουμε τι περνάμε μετά.

## Παραλίες που υπάρχουν ήδη στη Νάξο

- Αγιασσός
- Απόλλωνας
- Δέτη
- Λιαρίδια
- Λίωνας
- Μελινό
- Πάνορμος
- Παραλία Καλαντός
- Παραλία Λιμνάρι
- Παραλία Σπεδό
- Παραλία Ψιλή Άμμος
- Παραλία Ψωφαγριλιά
- Πυργάκι
- Ρίνα
- Φύκιο

## Λείπουν και πρέπει να μπουν πρώτα

Αυτές είναι σημαντικές παραλίες για MVP / τουρίστες. Υπάρχουν σε επίσημες πηγές της Νάξου ή/και στο OSM, αλλά δεν υπάρχουν στο τωρινό dataset της Νάξου.

| Προτεραιότητα | Παραλία | Γιατί λείπει σημαντικά | Προτεινόμενη ενέργεια |
| --- | --- | --- | --- |
| A | Άγιος Γεώργιος / Agios Georgios | Top 10 επίσημης Νάξου, Blue Flag, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Άγιος Προκόπιος / Agios Prokopios | Top 10 επίσημης Νάξου, Blue Flag, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Αγία Άννα / Agia Anna | Top 10 επίσημης Νάξου, Blue Flag, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Πλάκα / Plaka | Top 10 επίσημης Νάξου, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Μικρή Βίγλα / Mikri Vigla | Top 10 επίσημης Νάξου, OSM candidate | Να προστεθεί αρχικά ως 1 παραλία |
| A | Αλυκό / Alyko / Aliko | Top 10 επίσημης Νάξου, OSM nearby candidate | Να προστεθεί ως 1 παραλία/complex, όχι 3 διπλές |
| A | Αμμίτης / Ammitis / Amitis | Top 10 επίσημης Νάξου, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Όρκος / Orkos | Επίσημη σελίδα/κατάλογος Νάξου, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Καστράκι / Kastraki | Επίσημη πηγή και OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Γλυφάδα / Glyfada | Επίσημη πηγή και OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Άμπραμ / Abram / Ampram | Επίσημη σελίδα Νάξου, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Βίντζι / Vintzi / Vintsi | Επίσημη σελίδα Νάξου, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Χίλια Βρύση / Chilia Vryssi / Hilia | Επίσημη σελίδα Νάξου, OSM candidate | Να προστεθεί ως ξεχωριστή παραλία |
| A | Κλειδός / Κλειδώ / Klidos / Kleido | OSM candidate και άλλες πηγές τη δείχνουν στη Νάξο | Να μεταφερθεί/διορθωθεί από Κουφονήσια σε Νάξο μετά από review |
| B | Μουτσούνα / Moutsouna | Επίσημη σελίδα Νάξου, δεν βγήκε στο OSM issue list | Να προστεθεί μετά τις A |

## Θέματα που δεν πρέπει να γίνουν βιαστικά

| Θέμα | Τι σημαίνει | Τι να κάνουμε |
| --- | --- | --- |
| Alyko / Aliko / Hawaii / Kedros | Το audit τα βλέπει κοντά στο Πυργάκι. Στην πράξη είναι περιοχή με μικρούς όρμους. | Να ξεκινήσουμε με 1 κύρια εγγραφή "Αλυκό" και aliases/sections. Όχι 3-4 διπλές εγγραφές από την αρχή. |
| Mikri Vigla / Notia plevra | Το OSM τη χωρίζει σε τμήματα. Για τους ανέμους μπορεί όντως να έχει σημασία. | Αρχικά 1 εγγραφή. Αργότερα ίσως split σε βόρεια/νότια πλευρά αν χρειάζεται για scoring. |
| Klidos / Kleido | Υπάρχει τώρα μέσα στο αρχείο Κουφονησίων, αλλά οι συντεταγμένες είναι στη ΝΑ Νάξο. | Να διορθωθεί ως λάθος νησί πριν προστεθούν νέες εγγραφές. |
| Abram / Ampram | Διαφορετική γραφή ονόματος. | Κύριο όνομα: Abram/Άμπραμ. Alias: Ampram. |
| Ammitis / Amitis | Διαφορετική γραφή ονόματος. | Κύριο όνομα: Ammitis/Αμμίτης. Alias: Amitis. |
| Vintzi / Vintsi | Διαφορετική γραφή ονόματος. | Κύριο όνομα: Vintzi/Βίντζι. Alias: Vintsi. |
| Chilia Vryssi / Hilia | Διαφορετική γραφή ονόματος. | Κύριο όνομα: Chilia Vryssi/Χίλια Βρύση. Alias: Hilia Beach. |

## Παραλίες που υπάρχουν σε επίσημο κατάλογο αλλά δεν είναι άμεση προτεραιότητα

Αυτές φαίνονται σε επίσημες σελίδες/κατηγορίες της Νάξου, αλλά δεν τις βάζω στο πρώτο batch γιατί δεν εμφανίστηκαν όλες καθαρά στο OSM audit ή είναι μικρότερης MVP αξίας.

- Άγιοι Θεόδωροι / Agii Theodori
- Μικρά / Mikra
- Άγιος Φυκάς / Agios Fykas
- Αζαλάς / Azalas
- Αϊ Γιώργης Βορίδης / Ai Giorgis Voridis
- Γρόττα / Grotta
- Κάμπος / Kampos

## OSM candidates από το audit

Αυτά είναι τα candidates που έβγαλε το εργαλείο από OpenStreetMap:

- Plaka Beach: https://www.openstreetmap.org/way/168674366
- Mikri Vigla: https://www.openstreetmap.org/way/183302898
- Orkos: https://www.openstreetmap.org/way/183302901
- Paralia Agias Annas: https://www.openstreetmap.org/way/237830217
- Glyfada Beach: https://www.openstreetmap.org/way/363516715
- Mikri Vigla (Notia plevra): https://www.openstreetmap.org/way/363516878
- Klidos Beach: https://www.openstreetmap.org/way/404481267
- Paralia Ampram: https://www.openstreetmap.org/way/499712060
- Paralia Amitis: https://www.openstreetmap.org/way/500669711
- Paralia Glatza: https://www.openstreetmap.org/way/500669911
- Paralia Kastraki: https://www.openstreetmap.org/way/521234172
- Paralia Kleido: https://www.openstreetmap.org/way/1157948744
- Kedros Beach: https://www.openstreetmap.org/way/1199277981
- Vintsi: https://www.openstreetmap.org/way/1204646781
- Hilia Beach: https://www.openstreetmap.org/way/1336837770
- Paralia Agiou Prokopiou: https://www.openstreetmap.org/relation/453120
- Paralia Agiou Georgiou: https://www.openstreetmap.org/relation/453124
- Paralia Alyko: https://www.openstreetmap.org/way/521229662
- Aliko (Alyko) Beach: https://www.openstreetmap.org/way/521230059
- Hawaii Beach: https://www.openstreetmap.org/way/972954399

## Πηγές που χρησιμοποίησα

- Επίσημη σελίδα Top 10 παραλιών Νάξου: https://www.naxos.gr/naxos-top-10-most-popular-beaches/?lang=en
- Επίσημος κατάλογος παραλιών Νάξου, σελίδα 1: https://www.naxos.gr/category/naxos/beaches/?lang=en
- Επίσημος κατάλογος παραλιών Νάξου, σελίδα 2: https://www.naxos.gr/category/naxos/beaches/page/2/?lang=en
- Επίσημη σελίδα Άγιου Προκόπιου: https://www.naxos.gr/agios-prokopios-beach/?lang=en
- Επίσημη σελίδα Αγίας Άννας: https://www.naxos.gr/agia-anna-beach/?lang=en
- Επίσημη σελίδα Πλάκας: https://www.naxos.gr/plaka-beach/?lang=en
- Επίσημη σελίδα Αλυκού/Kedros/Hawaii: https://www.naxos.gr/alyko-small-alyko-kedros-hawaii-beaches/?lang=en
- Επίσημη σελίδα Άμπραμ: https://www.naxos.gr/abram-beach/?lang=en
- Επίσημη σελίδα Αμμίτη: https://www.naxos.gr/ammitis-beach/?lang=en
- Επίσημη σελίδα Βίντζι: https://www.naxos.gr/vintzi-beach/?lang=en
- Επίσημη σελίδα Χίλια Βρύση: https://www.naxos.gr/chilia-vryssi-beach/?lang=en
- Naxos.net για Κλειδό/Kleidos: https://www.naxos.net/beaches/kleidos/

## Προτεινόμενο επόμενο βήμα

Να μην περάσουμε όλες τις ελλείψεις μαζί.

Πρώτο ασφαλές batch:

1. Άγιος Γεώργιος
2. Άγιος Προκόπιος
3. Αγία Άννα
4. Πλάκα
5. Μικρή Βίγλα
6. Αλυκό
7. Αμμίτης
8. Όρκος
9. Καστράκι
10. Γλυφάδα
11. Άμπραμ
12. Βίντζι
13. Χίλια Βρύση
14. Κλειδός/Κλειδώ
15. Μουτσούνα

Πριν το batch, θέλει ειδικό fix για να φύγουν οι Κλειδός/Κλειδώ από τα Κουφονήσια και να περάσουν σωστά στη Νάξο.
