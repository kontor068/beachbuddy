# Pin-placement audit

Beaches: 2914 · suspects (>1000m from a named OSM beach): 139
Verified against ALL OSM beaches within 1200m → **not corroborated by OSM: 40**, cleared: 97, unresolved: 2

> ⚠️ NOT a fix list. "Not corroborated" also describes a real beach OSM never mapped — stage 3
> (`node scripts/auditPinCoastlineDistance.mjs`, offline land mask) found only **2 of these 40**
> actually wrong: #2734 Αγία Παρασκευή (Αγιά) 9,8 km inland and #2669 Ελιά (Πήλιο) 5,0 km inland.
> The other 38 sit on the shore = unmapped-beach leads. Never move a pin on this table alone.

| dist | id | beach | region | coords | confidence |
|---:|---:|---|---|---|---|
| >1200m | 2734 | Αγία Παρασκευή (Αγιά) | Thessaly / Larissa Coast (Agia - Kissavos) | 39.7235,22.752 | low |
| >1200m | 1503 | Παραλία Δάρδεζα | Peloponnese / Argolida (mainland) | 37.403075,23.281234 | high |
| >1200m | 3163 | Κάτω Καρυώτες | East Macedonia and Thrace / Samothraki | 40.50932,25.57057 | low |
| >1200m | 3166 | Παλαιόπολη | East Macedonia and Thrace / Samothraki | 40.50478,25.52599 | low |
| >1200m | 3049 | ΠΔΕ Λακκόπετρα | West Greece / Achaia (mainland) | 38.18845,21.46945 | low |
| >1200m | 3162 | Κατσαμπάς | East Macedonia and Thrace / Samothraki | 40.50092,25.5139 | low |
| >1200m | 886 | Παραλία Βράχος - Λούτσα | Epirus / Preveza (mainland) | 39.15952,20.55741 | high |
| >1200m | 1500 | Κουβέρτα | Peloponnese / Argolida (mainland) | 37.353675,23.248008 | high |
| >1200m | 884 | Λιμνιώνας | Epirus / Preveza (mainland) | 39.15489,20.55978 | high |
| >1200m | 3159 | Τζάστενη | Thessaly / Magnesia (mainland - Pelion) | 39.12803,23.16291 | low |
| >1200m | 2669 | Ελιά | Thessaly / Magnesia (mainland - Pelion) | 39.185,23.281 | low |
| >1200m | 2105 | Πουλάτη | South Aegean / Sifnos | 36.984882,24.737622 | high |
| >1200m | 882 | Παραλία Καστροσυκιάς | Epirus / Preveza (mainland) | 39.09492,20.64875 | high |
| >1200m | 885 | Παραλία Λυγιάς | Epirus / Preveza (mainland) | 39.14769,20.5718 | high |
| >1200m | 3158 | Πράσινη Άμμος | Thessaly / Magnesia (mainland - Pelion) | 39.16499,23.06908 | low |
| >1200m | 3149 | Κάλα Νερά | Thessaly / Magnesia (mainland - Pelion) | 39.305,23.1203 | low |
| >1200m | 880 | Παραλία Καλαμίτσι | Epirus / Preveza (mainland) | 38.973406,20.712291 | high |
| >1200m | 2722 | Φαπρικεζαίνα (Πτελεός) | Thessaly / Magnesia (mainland - Pelion) | 39.112,23.215 | high |
| >1200m | 3027 | Ωρωπός Άγιοι Απόστολοι Καλάμου | Attica / East Attica (mainland) | 38.297459,23.901642 | low |
| >1200m | 2109 | Τόσο Νερό | South Aegean / Sifnos | 36.973279,24.667311 | high |
| >1200m | 883 | Παραλία Ριζών | Epirus / Preveza (mainland) | 39.13144,20.58662 | high |
| >1200m | 3038 | Χίος Δασκαλόπετρα | North Aegean / Chios | 38.41729,26.13354 | low |
| >1200m | 3115 | Ευαγγελισμός | Central Greece / Evia | 38.0749,24.5773 | low |
| >1200m | 3031 | Τανάγρα Δήλεσι | Central Greece / Viotia (mainland) | 38.346828,23.669065 | low |
| >1200m | 1178 | Άγιος Ιωάννης | Ionian Islands / Meganisi | 38.6451266,20.7372088 | high |
| >1200m | 3024 | Αίγινα Αγ. Βασίλειος | Attica / Aegina | 37.726389,23.440861 | low |
| >1200m | 3116 | Ζαχαριάς | Central Greece / Evia | 38.1071,24.5737 | low |
| >1200m | 3042 | Λουτράκι Σχίνος | Peloponnese / Korinthia (mainland) | 38.054486,23.044999 | low |
| >1200m | 2660 | Πλάκα | Thessaly / Skopelos | 39.0855,23.68 | medium |
| >1200m | 2652 | Βαθιάς | Thessaly / Skopelos | 39.0815,23.6705 | medium |
| 1182m | 1175 | Αμπελάκια | Ionian Islands / Meganisi | 38.6646856,20.7913786 | high |
| 1167m | 3050 | ΠΔΕ Μακύνεια | West Greece / Aetolia-Acarnania (mainland) | 38.346195,21.716688 | low |
| 1156m | 3039 | Λουτράκι Αγ. Θεόδωροι | Peloponnese / Korinthia (mainland) | 37.922432,23.139724 | low |
| 1126m | 2686 | Καρνάγιο (Αγριά) | Thessaly / Magnesia (mainland - Pelion) | 39.348,22.986 | low |
| 1124m | 1499 | Νέα Επίδαυρος - Αλιότου | Peloponnese / Argolida (mainland) | 37.6667,23.1625 | high |
| 1110m | 1496 | Βιβάρι | Peloponnese / Argolida (mainland) | 37.536694,22.919794 | high |
| 1090m | 3046 | ΠΔΕ Αραχωβίτικα | West Greece / Aetolia-Acarnania (mainland) | 38.331073,21.842379 | low |
| 1051m | 2598 | Μηλιά | Thessaly / Alonissos | 39.1715,23.859 | high |
| 1046m | 2656 | Καστάνη | Thessaly / Skopelos | 39.0865,23.6865 | high |
| 1032m | 3004 | Γκιόλα | East Macedonia and Thrace / Thasos | 40.58634,24.67861 | high |
