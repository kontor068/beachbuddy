# Place-resolution audit — scoped run (south-aegean-karpathos)

Generated: 2026-08-16T11:30:51.364Z

**Totals:** PASS 19 · REVIEW 11 · FAIL 5 · (35 name-routed beaches audited)

Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).

_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._

## Per-region

| Region | Island | PASS | REVIEW | FAIL | Err | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| south-aegean-karpathos | Karpathos | 19 | 11 | 5 | 0 | 35 |

## Needs attention (16)

| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| FAIL | 2281 | Γιαλού Χωράφι | Karpathos | Παραλία Γιαλού Χωράφι, Karpathos | ✗ no hit | Gialou Chorafi · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 2288 | Μικρή Αμμοοπή | Karpathos | Παραλία Μικρή Αμμοοπή, Karpathos | ✗ no hit | Amopi · 238 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 2294 | Παπάς Μηνάς | Karpathos | Παραλία Παπάς Μηνάς, Karpathos | ✗ no hit | Papás Minás · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 2297 | Της Πέρδικας Ποταμός | Karpathos | Παραλία Της Πέρδικας Ποταμός, Karpathos | ✗ no hit | tis Perdikas Potamos · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 2300 | Όψη | Karpathos | Παραλία Όψη, Karpathos | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 2275 | Απέλλα | Karpathos | Απέλλα, Karpathos | Apella · 55 m · verified (via "Apella, Karpathos") | Apella · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2277 | Φοινίκι | Karpathos | Παραλία Φοινίκι, Karpathos | Φοινίκι · 83 m · verified (via "Φοινίκι, Karpathos") | Finiki Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2278 | Φωκιά | Karpathos | Φωκιά, Karpathos | Fokia · 47 m · verified (via "Fokia, Karpathos") | (unnamed) · 762 m | mark **needs-review** (no good name or pin) |
| REVIEW | 2279 | Φορόκλι | Karpathos | Φορόκλι, Karpathos | Forókli · 25 m · verified (via "Forokli, Karpathos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 2286 | Λακκί | Karpathos | Παραλία Λακκί, Karpathos | Λακκί · 451 m · needs_review (via "Λακκί, Karpathos") | Lakki Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2293 | Λιμάνι Παναγιάς | Karpathos | Παραλία Λιμάνι Παναγιάς, Karpathos | Panagias Limani · 31 m · verified (via "Λιμάνι Παναγιάς, Karpathos") | Panagias Limani · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2298 | Βανάντα | Karpathos | Βανάντα, Karpathos | Βανάντα-Βουργούντα-Στιόι-Αυλώνας-Τρίστομο (Ολύμπου-Καρπάθου) · 3290 m · needs_review | Vanánda · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2299 | Βοτσαλάκια | Karpathos | Βοτσαλάκια, Karpathos | Votsalakia beach · 18 m · verified (via "Votsalakia, Karpathos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 2304 | Βάθια | Karpathos | Παραλία Βάθια, Karpathos | Βάθια · 70 m · verified (via "Βάθια, Karpathos") | Χριστού Πηγάδι · 975 m | mark **needs-review** (no good name or pin) |
| REVIEW | 2308 | Κυρά Παναγιά | Karpathos | Παραλία Κυρά Παναγιά, Karpathos | Κυρά Παναγιά · 8 m · verified (via "Κυρά Παναγιά, Karpathos") | Κυρά Παναγιά · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2316 | Ψωράρης | Karpathos | Παραλία Ψωράρης, Karpathos | Ψωράρης · 21 m · verified (via "Ψωράρης, Karpathos") | Ψωράρης · 0 m | route by **coordinates** (pin OSM-corroborated) |
