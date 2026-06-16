# Place-resolution audit — touristic tier

Generated: 2026-06-15T22:45:31.066Z

**Totals:** PASS 527 · REVIEW 69 · FAIL 0 · (596 name-routed beaches audited)

Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).

_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._

## Per-region

| Region | Island | PASS | REVIEW | FAIL | Err | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| central-macedonia-halkidiki-mainland | Halkidiki (mainland) | 48 | 34 | 0 | 0 | 82 |
| ionian-islands-kefalonia | Kefalonia | 54 | 8 | 0 | 0 | 62 |
| crete-crete-chania | Crete (Chania) | 65 | 7 | 0 | 0 | 72 |
| ionian-islands-zakynthos | Zakynthos | 22 | 5 | 0 | 0 | 27 |
| south-aegean-naxos | Naxos | 20 | 3 | 0 | 0 | 23 |
| ionian-islands-lefkada | Lefkada | 19 | 3 | 0 | 0 | 22 |
| south-aegean-paros | Paros | 27 | 2 | 0 | 0 | 29 |
| south-aegean-mykonos | Mykonos | 26 | 2 | 0 | 0 | 28 |
| crete-crete-rethymno | Crete (Rethymno) | 40 | 2 | 0 | 0 | 42 |
| crete-crete-lasithi | Crete (Lasithi) | 50 | 2 | 0 | 0 | 52 |
| ionian-islands-corfu | Corfu | 67 | 1 | 0 | 0 | 68 |
| south-aegean-santorini | Santorini | 6 | 0 | 0 | 0 | 6 |
| south-aegean-milos | Milos | 40 | 0 | 0 | 0 | 40 |
| crete-crete-heraklion | Crete (Heraklion) | 43 | 0 | 0 | 0 | 43 |

## Needs attention (69)

| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| REVIEW | 1988 | Αμμίτης | Naxos | Παραλία Αμίτης, Naxos | Παραλία Αμίτης · 51 m · needs_review | Παραλία Αμίτης · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1991 | Βίντζι | Naxos | Βίντσι, Naxos | Βίντσι · 4 m · needs_review | Βίντσι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2001 | Λιγαρίδια | Naxos | Liaridia Beach, Naxos | Liaridia Beach · 0 m · needs_review | Liaridia Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2031 | Κριός | Paros | unorganized beach, Paros | unorganized beach · 9 m · needs_review | unorganized beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2036 | Λωλαντώνης | Paros | Παραλια Λωλαντώη, Paros | Παραλια Λωλαντώη · 22 m · needs_review | Παραλια Λωλαντώη · 22 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1948 | Βαθιά Λαγκάδα | Mykonos | Vathia Lagada Beach, Mykonos | Vathia Lagada Beach · 2 m · needs_review | Vathia Lagada Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1949 | Γυμνιστική Παραλία Ελιάς | Mykonos | Elia Nude Beach, Mykonos | Elia Nude Beach · 2 m · needs_review | Αγράρι · 313 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 530 | Γιαλισκάρι | Crete (Chania) | Gianiskali Sandy Beach, Chania | Gianiskali Sandy Beach · 9 m · needs_review | Gianiskali Sandy Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 543 | Μένιες (Δίκτυννα) | Crete (Chania) | Diktina Beach, Chania | Diktina Beach · 8 m · needs_review | Diktina Beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 548 | Παραλία Αγίων Αποστόλων | Crete (Chania) | Eastern Gulf, Chania | Παραλία Αγίων Αποστόλων · 485 m · needs_review (via "Παραλία Αγίων Αποστόλων, Crete (Chania)") | Eastern Gulf · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 578 | Σούγια (γυμνιστών) | Crete (Chania) | Sougia Nude Beach, Chania | Sougia Nude Beach · 11 m · needs_review | Sougia Nude Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 587 | Agios Onoufrios | Crete (Chania) | Άγιος Ονούφριος, Chania | Άγιος Ονούφριος · 14 m · needs_review | Άγιος Ονούφριος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 594 | Chrysi Akti | Crete (Chania) | Χρυσή Ακτή, Chania | Χρυσή Ακτή · 117 m · needs_review | Χρυσή Ακτή · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 598 | Georgioupoli | Crete (Chania) | Γεωργιούπολη, Chania | Γεωργιούπολη · 191 m · needs_review | Γεωργιούπολη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 676 | Βλυχί Νερό | Crete (Rethymno) | Vlihi Nero beach, Rethymno | Vlihi Nero beach · 17 m · needs_review | Vlihi Nero beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 3011 | Ροδάκινο | Crete (Rethymno) | Κόρακας, Rethymno | Rodakino Βay · 272 m · needs_review (via "Ροδάκινο, Crete (Rethymno)") | Κόρακας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 722 | Άμμος Ξερόκαμπου | Crete (Lasithi) | Amatos beach, Lasithi | Amatos beach · 11 m · needs_review | Amatos beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 731 | Βλυχάδα Ξερόκαμπου | Crete (Lasithi) | Vlyhada beach, Lasithi | Vlyhada beach · 74 m · needs_review | Vlyhada beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 983 | Παραλία Αγίου Σπυρίδωνα | Corfu | Agios Spyridon Beach, Corfu | Agios Spyridon Beach · 11 m · needs_review | Agios Spyridon Beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1182 | Άγιος Νικόλαος Βολιμών | Zakynthos | Agios Nikolaos-Volimes beach, Zakynthos | Agios Nikolaos-Volimes beach · 13 m · needs_review | Agios Nikolaos-Volimes beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1191 | Μικρή Ξύγκια | Zakynthos | Little Xigia, Zakynthos | Little Xigia · 5 m · needs_review | Little Xigia · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1195 | Άγιος Νικόλαος Βασιλικού | Zakynthos | St. Nicholas Beach, Zakynthos | St. Nicholas Beach · 56 m · needs_review | St. Nicholas Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1197 | Βαθύ Λαγκάδι | Zakynthos | Vathi Lagadi beach, Zakynthos | Vathi Lagadi beach · 2 m · needs_review | Vathi Lagadi beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1198 | Ξύγκια | Zakynthos | Xigia, Zakynthos | Ταβέρνα Ξύγκια · 286 m · needs_review (via "Ξύγκια, Zakynthos") | Xigia · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1063 | Νότια Άβυθος Γυμνιστών | Kefalonia | Avithos South (nudist), Kefalonia | Avithos South (nudist) · 12 m · needs_review | Avithos South (nudist) · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1067 | Έμπλυση | Kefalonia | Emblisi Beach, Kefalonia | Emblisi Beach · 9 m · needs_review | Emblisi Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1072 | Μούντα (γυμνιστών) | Kefalonia | Mouda nudist beach, Kefalonia | Mouda nudist beach · 53 m · needs_review | Mouda nudist beach · 45 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1076 | Τραπεζάκι (γυμνιστών) | Kefalonia | Trapezaki naturist beach, Kefalonia | Trapezaki naturist beach · 58 m · needs_review | Trapezaki naturist beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1077 | Λιμανάκι Τραπεζακίου | Kefalonia | Trapezaki port bridge, Kefalonia | Trapezaki port bridge · 27 m · needs_review | Trapezaki port bridge · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1111 | Μέγας Λάκκος | Kefalonia | Μεγας Λακος, Kefalonia | Μεγας Λακος · 23 m · needs_review | Μεγας Λακος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1112 | Μούντα | Kefalonia | Παραλία Καμίνια, Kefalonia | Παραλία Καμίνια · 65 m · needs_review | Παραλία Καμίνια · 38 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1138 | Πλατύ Λιμάνι | Kefalonia | Plati Beach Port, Kefalonia | Plati Beach Port · 8 m · needs_review | Plati Beach Port · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1142 | Παραλία Νικιάνας | Lefkada | Breath of Zorbas beach, Lefkada | Breath of Zorbas beach · 124 m · needs_review | Lydia's Hotel beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1143 | Νότια Παραλία Νικιάνας | Lefkada | Nikiana South Beach, Lefkada | Nikiana South Beach · 11 m · needs_review | Nikiana South Beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1144 | Πασάς | Lefkada | Passa Beach, Lefkada | Passa Beach · 1 m · needs_review | Passa Beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 379 | Agios Georgios | Halkidiki (mainland) | Άγιος Γεώργιος, Halkidiki | Άγιος Γεώργιος · 46 m · needs_review | Άγιος Γεώργιος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 380 | Agios Nikolaos | Halkidiki (mainland) | Αγιος Νικόλαος, Halkidiki | Αγιος Νικόλαος · 0 m · needs_review | Αγιος Νικόλαος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 383 | Akti Kalogrias | Halkidiki (mainland) | Ακτή Καλογριάς, Halkidiki | Ακτή Καλογριάς · 79 m · needs_review | Ακτή Καλογριάς · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 389 | Chrysi Ammoudia | Halkidiki (mainland) | Χρυσή αμμουδιά, Halkidiki | Χρυσή αμμουδιά · 21 m · needs_review | Χρυσή αμμουδιά · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 391 | Dimotiki Plaz 1 | Halkidiki (mainland) | Δημοτική Πλαζ 1, Halkidiki | Δημοτική Πλαζ 1 · 53 m · needs_review | Δημοτική Πλαζ 1 · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 392 | Dimotiki Plaz 2 | Halkidiki (mainland) | Δημοτική Πλαζ 2, Halkidiki | Δημοτική Πλαζ 2 · 2 m · needs_review | Δημοτική Πλαζ 2 · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 393 | Dimotiki Plaz 3 | Halkidiki (mainland) | Δημοτική Πλαζ 3, Halkidiki | Δημοτική Πλαζ 3 · 17 m · needs_review | Δημοτική Πλαζ 3 · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 395 | Faka | Halkidiki (mainland) | Φάκα, Halkidiki | Φάκα · 43 m · needs_review | Φάκα · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 399 | Hanioti | Halkidiki (mainland) | παραλία Χανιώτη, Halkidiki | παραλία Χανιώτη · 7 m · needs_review | παραλία Χανιώτη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 401 | Iliovasilema | Halkidiki (mainland) | Ηλιοβασίλεμα, Halkidiki | Ηλιοβασίλεμα · 7 m · needs_review | Ηλιοβασίλεμα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 403 | Kakoudia | Halkidiki (mainland) | Κακούδια, Halkidiki | Κακούδια · 41 m · needs_review | Κακούδια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 405 | Kallithea | Halkidiki (mainland) | Καλλιθέα, Halkidiki | Καλλιθέα · 7 m · needs_review | Καλλιθέα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 406 | Kalopigado | Halkidiki (mainland) | Καλοπήγαδο, Halkidiki | Καλοπήγαδο · 45 m · needs_review | Καλοπήγαδο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 407 | Karagatsia | Halkidiki (mainland) | Καραγάτσια, Halkidiki | Καραγάτσια · 46 m · needs_review | Καραγάτσια · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 408 | Kavouri | Halkidiki (mainland) | Καβούρι, Halkidiki | Καβούρι · 12 m · needs_review | Καβούρι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 410 | Kefalas | Halkidiki (mainland) | Κεφάλας, Halkidiki | Κεφάλας · 13 m · needs_review | Κεφάλας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 414 | Kryfos Paradeisos | Halkidiki (mainland) | Κρυφός Παράδεισος Παραλία Γυμνιστών, Halkidiki | Κρυφός Παράδεισος Παραλία Γυμνιστών · 23 m · needs_review | Κρυφός Παράδεισος Παραλία Γυμνιστών · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 419 | Limanaki | Halkidiki (mainland) | Λιμανάκι, Halkidiki | Λιμανάκι · 18 m · needs_review | Λιμανάκι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 422 | Liosi | Halkidiki (mainland) | Λιόση, Halkidiki | Λιόση · 28 m · needs_review | Λιόση · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 425 | Megali Ammos | Halkidiki (mainland) | Μεγάλη Άμμος, Halkidiki | Μεγάλη Άμμος · 29 m · needs_review | Μεγάλη Άμμος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 429 | Myti | Halkidiki (mainland) | Μύτη, Halkidiki | Μύτη · 0 m · needs_review | Μύτη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 430 | Oneiro | Halkidiki (mainland) | Παραλία ονείρου, Halkidiki | Παραλία ονείρου · 42 m · needs_review | Παραλία ονείρου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 431 | Ouranoupoli | Halkidiki (mainland) | Καμπούδι / Άκραθως, Halkidiki | Καμπούδι / Άκραθως · 31 m · needs_review | Καμπούδι / Άκραθως · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 432 | Paradisos | Halkidiki (mainland) | Παραλία Παράδεισος, Halkidiki | Παραλία Παράδεισος · 49 m · needs_review | Παραλία Παράδεισος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 434 | Pefkochori | Halkidiki (mainland) | Παραλία Πευκοχωρίου, Halkidiki | Παραλία Πευκοχωρίου · 69 m · needs_review | Παραλία Πευκοχωρίου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 437 | Platanitsi | Halkidiki (mainland) | Παραλία Πλατανίτσι, Halkidiki | Παραλία Πλατανίτσι · 62 m · needs_review | Παραλία Πλατανίτσι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 439 | Porto Elea | Halkidiki (mainland) | Παραλία Ζωγράφου, Halkidiki | Παραλία Ζωγράφου · 116 m · needs_review | Παραλία Ζωγράφου · 74 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 440 | Porto Koufo | Halkidiki (mainland) | Πόρτο Κουφό, Halkidiki | Πόρτο Κουφό · 107 m · needs_review | Πόρτο Κουφό · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 445 | Sykia | Halkidiki (mainland) | Παραλία Συκιάς, Halkidiki | Παραλία Συκιάς · 123 m · needs_review | Παραλία Συκιάς · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 446 | Tigania | Halkidiki (mainland) | Τηγανιά, Halkidiki | Τηγανιά · 11 m · needs_review | Τηγανιά · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 449 | Trani Ammouda | Halkidiki (mainland) | Τρανή Αμμούδα, Halkidiki | Τρανή Αμμούδα · 153 m · needs_review | Τρανή Αμμούδα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 450 | Tsaska | Halkidiki (mainland) | Τσάσκα, Halkidiki | Τσάσκα · 2 m · needs_review | Τσάσκα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 452 | Varkes | Halkidiki (mainland) | Βάρκες, Halkidiki | Βάρκες · 0 m · needs_review | Βάρκες · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 454 | Voulitsa | Halkidiki (mainland) | Βουλίτσα, Halkidiki | Βουλίτσα · 22 m · needs_review | Βουλίτσα · 0 m | route by **coordinates** (pin OSM-corroborated) |
