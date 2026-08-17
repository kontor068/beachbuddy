# Place-resolution audit — scoped run (central-macedonia-halkidiki-mainland)

Generated: 2026-08-17T11:38:58.139Z

**Totals:** PASS 48 · REVIEW 21 · FAIL 19 · (88 name-routed beaches audited)

Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).

_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._

## Per-region

| Region | Island | PASS | REVIEW | FAIL | Err | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| central-macedonia-halkidiki-mainland | Halkidiki (mainland) | 48 | 21 | 19 | 0 | 88 |

## Needs attention (40)

| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| FAIL | 382 | Αγριδιά | Halkidiki (mainland) | Παραλία Agridia, Halkidiki | ✗ no hit | (unnamed) · 2326 m | mark **needs-review** (no good name or pin) |
| FAIL | 387 | Brounou | Halkidiki (mainland) | Παραλία Brounou, Halkidiki | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 395 | Φάκα | Halkidiki (mainland) | Παραλία Faka, Halkidiki | ✗ no hit | Φάκα · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 402 | Παραλία Νέας Ποτίδαιας | Halkidiki (mainland) | Παραλία Νέας Ποτίδαιας, Halkidiki | ✗ no hit | (unnamed) · 64 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 405 | Καλλιθέα | Halkidiki (mainland) | Παραλία Kallithea, Halkidiki | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 413 | Kristina | Halkidiki (mainland) | Παραλία Kristina, Halkidiki | ✗ no hit | Kristina Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 417 | Lemos | Halkidiki (mainland) | Παραλία Παραλία Lemos, Halkidiki | ✗ no hit | Lemos Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 425 | Μεγάλη Άμμος | Halkidiki (mainland) | Παραλία Μεγάλη Άμμος, Halkidiki | ✗ no hit | Μεγάλη Άμμος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 428 | Παραλία Ιερισσού | Halkidiki (mainland) | Παραλία Ιερισσού, Halkidiki | ✗ no hit | Πλαζ Ιερισσός · 692 m | mark **needs-review** (no good name or pin) |
| FAIL | 436 | Πλατάνια | Halkidiki (mainland) | Παραλία Platania, Halkidiki | ✗ no hit | Platania Beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 440 | Porto Koufo | Halkidiki (mainland) | Παραλία Porto Koufo, Halkidiki | ✗ no hit | Πόρτο Κουφό · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 442 | Sani Hill | Halkidiki (mainland) | Παραλία Sani Hill, Halkidiki | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 443 | Σάρτη | Halkidiki (mainland) | Παραλία Sarti, Halkidiki | ✗ no hit | Sarti Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 452 | Varkes | Halkidiki (mainland) | Varkes, Halkidiki | ✗ no hit | Βάρκες · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 458 | Παραλία Νέας Ηράκλειας - Sahara | Halkidiki (mainland) | Παραλία Νέας Ηράκλειας - Sahara, Halkidiki | ✗ no hit | (unnamed) · 1686 m | mark **needs-review** (no good name or pin) |
| FAIL | 475 | Παραλία Άμπελος | Halkidiki (mainland) | Παραλία Άμπελος, Halkidiki | ✗ no hit | Παρ. ΄Αμπελος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 479 | Παραλία Αγίου Μάμα | Halkidiki (mainland) | Παραλία Αγίου Μάμα, Halkidiki | ✗ no hit | agjio mama · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 502 | Συκιά Ολυμπιάδας | Halkidiki (mainland) | Συκιά Ολυμπιάδας, Halkidiki | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 3009 | Νέα Ρόδα | Halkidiki (mainland) | Παραλία Νέα Ρόδα, Halkidiki | ✗ no hit | (unnamed) · 443 m | mark **needs-review** (no good name or pin) |
| REVIEW | 379 | Άγιος Γεώργιος | Halkidiki (mainland) | Agios Georgios, Halkidiki | Άγιος Γεώργιος · 25042 m · needs_review | Άγιος Γεώργιος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 383 | Akti Kalogrias | Halkidiki (mainland) | Ακτή Καλογριάς, Halkidiki | Ακτή Καλογριάς · 79 m · needs_review | Ακτή Καλογριάς · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 403 | Kakoudia | Halkidiki (mainland) | Κακούδια, Halkidiki | Κακούδια · 41 m · needs_review | Κακούδια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 404 | Καλαμίτσι | Halkidiki (mainland) | Παραλία Kalamitsi, Halkidiki | Παραλία Γυμνιστιών Καλαμίτσι · 443 m · needs_review | Kalamitsi · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 409 | Kavourotrypes | Halkidiki (mainland) | Kavourotrypes, Halkidiki | Καβουρότρυπες · 8 m · needs_review | Παραλία Γυμνιστών Πλατανίτσι · 617 m | mark **needs-review** (no good name or pin) |
| REVIEW | 415 | Lagomandra | Halkidiki (mainland) | Παραλία Lagomandra, Halkidiki | Παραλία Λαγομάνδρα · 461 m · needs_review | Παρ. Λαγομάδρα · 46 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 429 | Myti | Halkidiki (mainland) | Μύτη, Halkidiki | Μύτη · 0 m · needs_review | Μύτη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 430 | Oneiro | Halkidiki (mainland) | Παραλία ονείρου, Halkidiki | Παραλία ονείρου · 42 m · needs_review | Παραλία ονείρου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 431 | Ouranoupoli | Halkidiki (mainland) | Καμπούδι / Άκραθως, Halkidiki | Καμπούδι / Άκραθως · 31 m · needs_review | Καμπούδι / Άκραθως · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 432 | Paradisos | Halkidiki (mainland) | Παραλία Παράδεισος, Halkidiki | Παραλία Παράδεισος · 49 m · needs_review | Παραλία Παράδεισος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 434 | Pefkochori | Halkidiki (mainland) | Παραλία Πευκοχωρίου, Halkidiki | Παραλία Πευκοχωρίου · 69 m · needs_review | Παραλία Πευκοχωρίου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 435 | Παραλία Πλάγια-Φλογητά | Halkidiki (mainland) | Παραλία Plagia Flogita, Halkidiki | Παραλία Πλάγια-Φλογητά · 873 m · needs_review | Παραλία Πλάγια-Φλογητά · 27 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 439 | Porto Elea | Halkidiki (mainland) | Παραλία Ζωγράφου, Halkidiki | Παραλία Ζωγράφου · 116 m · needs_review | Παραλία Ζωγράφου · 74 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 441 | Psakoudia | Halkidiki (mainland) | Παραλία Psakoudia, Halkidiki | Παραλία Ψακούδια · 588 m · needs_review | Παραλία Ψακούδια · 175 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 445 | Sykia | Halkidiki (mainland) | Παραλία Συκιάς, Halkidiki | Παραλία Συκιάς · 123 m · needs_review | Παραλία Συκιάς · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 449 | Trani Ammouda | Halkidiki (mainland) | Τρανή Αμμούδα, Halkidiki | Τρανή Αμμούδα · 153 m · needs_review | Τρανή Αμμούδα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 455 | Vourvourou | Halkidiki (mainland) | Παραλία Vourvourou, Halkidiki | Παραλία Καρύδι · 807 m · needs_review | Παραλία Καρύδι · 849 m | mark **needs-review** (no good name or pin) |
| REVIEW | 467 | Παραλία Τορώνης | Halkidiki (mainland) | Παραλία Τορώνης, Halkidiki | Παραλία Τορώνης · 370 m · needs_review | Παραλία Τορώνης · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 481 | Παραλία Δεβελίκι | Halkidiki (mainland) | Παραλία Δεβελίκι, Halkidiki | Παραλία Δεβελίκι · 661 m · needs_review | Παραλία Δεβελίκι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 3008 | Γεωπονικά | Halkidiki (mainland) | Παραλία Γεωπονικά, Halkidiki | παραλία Ανθούπολης · 649 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 3018 | Νέα Φλόγητα | Halkidiki (mainland) | Παραλία Νέα Φλόγητα, Halkidiki | Παραλία Πλάγια-Φλογητά · 614 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
