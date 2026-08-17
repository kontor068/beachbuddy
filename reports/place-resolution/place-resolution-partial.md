# Place-resolution audit — scoped run (thessaly-skopelos)

Generated: 2026-08-17T09:08:09.823Z

**Totals:** PASS 11 · REVIEW 7 · FAIL 2 · (20 name-routed beaches audited)

Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).

_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._

## Per-region

| Region | Island | PASS | REVIEW | FAIL | Err | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| thessaly-skopelos | Skopelos | 11 | 7 | 2 | 0 | 20 |

## Needs attention (9)

| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| FAIL | 2652 | Βαθιάς | Skopelos | Βαθιάς, Skopelos | Βαθιασ · 8246 m · rejected | Τραχηλι · 1306 m | mark **needs-review** (no good name or pin) |
| FAIL | 2662 | Στάφυλος | Skopelos | Παραλία Στάφυλος, Skopelos | Σκόπελος · 8451 m · rejected (via "Στάφυλος, Skopelos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 2650 | Έλιος | Skopelos | Έλιος, Skopelos | Elios Holiday Hotel · 504 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 2651 | Αρμενόπετρα | Skopelos | Αρμενόπετρα, Skopelos | Ανεμόπετρα · 1301 m · needs_review | Έληος · 793 m | mark **needs-review** (no good name or pin) |
| REVIEW | 2653 | Βελανιό | Skopelos | Παραλία Βελανιό, Skopelos | Βελανιό · 31 m · verified (via "Βελανιό, Skopelos") | Βελανιό · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2658 | Νεράκι | Skopelos | Παραλία Νεράκι, Skopelos | Νερακι · 0 m · verified (via "Νεράκι, Skopelos") | Νερακι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2660 | Πλάκα | Skopelos | Πλάκα, Skopelos | Πλάκα · 6113 m · needs_review | Limnonari · 1616 m | mark **needs-review** (no good name or pin) |
| REVIEW | 2661 | Σπηλιά | Skopelos | Σπηλιά, Skopelos | Σπηλιά · 10524 m · needs_review | Limnonari · 266 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 2663 | Τραχήλι | Skopelos | Παραλία Τραχήλι, Skopelos | Τραχηλι · 0 m · verified (via "Τραχήλι, Skopelos") | Τραχηλι · 0 m | route by **coordinates** (pin OSM-corroborated) |
