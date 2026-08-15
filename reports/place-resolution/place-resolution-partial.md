# Place-resolution audit — scoped run (south-aegean-ios)

Generated: 2026-08-15T08:43:42.698Z

**Totals:** PASS 10 · REVIEW 15 · FAIL 0 · (25 name-routed beaches audited)

Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).

_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._

## Per-region

| Region | Island | PASS | REVIEW | FAIL | Err | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| south-aegean-ios | Ios | 10 | 15 | 0 | 0 | 25 |

## Needs attention (15)

| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| REVIEW | 1759 | Αγία Θεοδότη | Ios | Παραλία Αγία Θεοδότη, Ios | Oasis Ios · 376 m · needs_review (via "Αγία Θεοδότη, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1760 | Αγία Κυριακή | Ios | Παραλία Αγία Κυριακή, Ios | Αγία Κυριακή · 9 m · verified (via "Αγία Κυριακή, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1762 | Αλμυρός | Ios | Παραλία Αλμυρός, Ios | Αλμυρός · 3 m · verified (via "Αλμυρός, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1772 | Κλήμα | Ios | Παραλία Κλήμα, Ios | Κλήμα · 1 m · verified (via "Κλήμα, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1774 | Κουμπάρα | Ios | Παραλία Κουμπάρα, Ios | Κουμπάρα · 24 m · verified (via "Κουμπάρα, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1778 | Μαγγανάρι | Ios | Παραλία Μαγγανάρι, Ios | Μαγγανάρι · 220 m · verified (via "Μαγγανάρι, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1780 | Μυλοπότας | Ios | Παραλία Μυλοπότας, Ios | ΜΥΛΟΠΟΤΑΣ (ΝΟΤΙΑ ΠΑΡΑΛΙΑ) · 278 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1785 | Παπάς | Ios | Παραλία Παπάς, Ios | Παπάς · 20 m · verified (via "Παπάς, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1791 | Ρούσσου | Ios | Παραλία Ρούσσου, Ios | Ρούσσου · 7 m · verified (via "Ρούσσου, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1792 | Σαντορινέικο | Ios | Παραλία Σαντορινέικο, Ios | Σαντορινέικο · 93 m · verified (via "Σαντορινέικο, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1795 | Τζαμαρία | Ios | Παραλία Τζαμαρία, Ios | Τζαμαρία · 4 m · verified (via "Τζαμαρία, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1798 | Τρεις Κλεισιές βόρειος | Ios | Παραλία Τρεις Κλεισιές βόρειος, Ios | Τρεις Κλεισιές βόρειος · 28 m · verified (via "Τρεις Κλεισιές βόρειος, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1799 | Τρεις Κλεισιές μεγάλη | Ios | Παραλία Τρεις Κλεισιές μεγάλη, Ios | Τρεις Κλεισιές μεγάλη · 10 m · verified (via "Τρεις Κλεισιές μεγάλη, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1800 | Τρεις Κλεισιές μικρή | Ios | Παραλία Τρεις Κλεισιές μικρή, Ios | Τρεις Κλεισιές μικρή · 1 m · verified (via "Τρεις Κλεισιές μικρή, ios") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1803 | Ψάθη | Ios | Παραλία Ψάθη, Ios | Ψάθη · 393 m · needs_review (via "Ψάθη, ios") | ✗ none | mark **needs-review** (no good name or pin) |
