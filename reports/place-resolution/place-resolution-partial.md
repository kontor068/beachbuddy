# Place-resolution audit — scoped run (peloponnese-lakonia-mainland, central-greece-evia, north-aegean-lesvos, attica-kythira, attica-east-attica-mainland, south-aegean-kythnos)

Generated: 2026-08-14T11:55:17.924Z

**Totals:** PASS 114 · REVIEW 49 · FAIL 170 · (333 name-routed beaches audited)

Does the name the app sends to Google Maps resolve to the right beach on the right island? FAIL = it does not (Melino class).

_Two signals per beach: **name** = Nominatim free-text geocode of the app query (≈ what Google resolves); **pin** = nearest OSM `natural=beach` (is the coordinate a real beach?). FAIL + corroborated pin → route by coordinates. LOOKUP_ERROR = geocoder was rate-limited/unreachable for that beach — re-run, not a real failure._

## Per-region

| Region | Island | PASS | REVIEW | FAIL | Err | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| central-greece-evia | Evia | 0 | 1 | 110 | 0 | 111 |
| attica-east-attica-mainland | East Attica (mainland) | 25 | 6 | 21 | 0 | 52 |
| north-aegean-lesvos | Lesvos | 17 | 13 | 20 | 0 | 50 |
| peloponnese-lakonia-mainland | Lakonia (mainland) | 29 | 6 | 17 | 0 | 52 |
| attica-kythira | Kythira | 26 | 8 | 2 | 0 | 36 |
| south-aegean-kythnos | Kythnos | 17 | 15 | 0 | 0 | 32 |

## Needs attention (219)

| Verdict | id | Name | Island | Built query | Name geocode (Nominatim) | Pin (OSM beach) | Recommended fix |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| FAIL | 25 | Παραλία Αγριλέζας | East Attica (mainland) | Παραλία Αγριλέζας, East Attica | ✗ no hit | Παραλία Αγριλέζας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 34 | Παραλία Ζούμπερι | East Attica (mainland) | Παραλία Ζούμπερι, East Attica | ✗ no hit | LA COSTA · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 35 | Όρμος Ληδάκι | East Attica (mainland) | Παραλία Όρμος Ληδάκι, East Attica | ✗ no hit | ´Ορμος Ληδάκι · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 36 | Πλαζ Ραφήνας | East Attica (mainland) | Παραλία Πλαζ Ραφήνας, East Attica | ✗ no hit | Πλαζ Ραφήνας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 37 | Παραλία Αρτέμιδας | East Attica (mainland) | Παραλία Αρτέμιδας, East Attica | ✗ no hit | Άρτεμις · 163 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 39 | Παραλία Βραυρώνας | East Attica (mainland) | Παραλία Βραυρώνας, East Attica | ✗ no hit | Beach Vravrona · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 47 | Πανόραμα | East Attica (mainland) | Παραλία Πανόραμα, East Attica | ✗ no hit | Πανόραμα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 49 | Παραλία Κοκολόκο | East Attica (mainland) | Παραλία Κοκολόκο, East Attica | ✗ no hit | cocoloco · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 50 | Λομπάρδα / Mojito Bay | East Attica (mainland) | Παραλία Λομπάρδα / Mojito Bay, East Attica | ✗ no hit | Λομπάρντα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 54 | Γαλάζια Ακτή | East Attica (mainland) | Παραλία Γαλάζια Ακτή, East Attica | ✗ no hit | Γαλάζια Ακτή · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 56 | Πόρτο Εννέα | East Attica (mainland) | Παραλία Πόρτο Εννέα, East Attica | ✗ no hit | Πόρτο Εννέα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 57 | Πεύκο | East Attica (mainland) | Παραλία Πεύκο, East Attica | ✗ no hit | Πεύκο · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 58 | Lagonissi Grand Resort | East Attica (mainland) | Παραλία Lagonissi Grand Resort, East Attica | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 59 | Καλοπήγαδο | East Attica (mainland) | Παραλία Καλοπήγαδο, East Attica | ✗ no hit | Καλοπήγαδο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 61 | Τσονίμα | East Attica (mainland) | Παραλία Τσονίμα, East Attica | ✗ no hit | Τσονίμα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 65 | Μαύρο Λιθάρι / Eden Beach | East Attica (mainland) | Μαύρο Λιθάρι / Eden Beach, East Attica | ✗ no hit | Ν.Ο. Μαύρο Λιθάρι · 466 m | mark **needs-review** (no good name or pin) |
| FAIL | 70 | Θυμάρι | East Attica (mainland) | Παραλία Θυμάρι, East Attica | ✗ no hit | Θυμάρι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 74 | Ασημάκη | East Attica (mainland) | Παραλία Ασημάκη, East Attica | ✗ no hit | Ασημάκη · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 75 | Χάρακας | East Attica (mainland) | Παραλία Χάρακας, East Attica | ✗ no hit | Χάρακας · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 76 | Παραλία Λεγραινών | East Attica (mainland) | Παραλία Λεγραινών, East Attica | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 79 | Παραλία Σουνίου | East Attica (mainland) | Παραλία Σουνίου, East Attica | Nuevo Loca beach bar · 11584 m · rejected | Sounion Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 115 | Βλυχάδα Πλατιάς Άμμου | Kythira | Παραλία Βλυχάδα Πλατιάς Άμμου, Kythira | ✗ no hit | Πλατιά Άμμος · 997 m | mark **needs-review** (no good name or pin) |
| FAIL | 137 | Βλυχάδα Ανατολική | Kythira | Βλυχάδα Ανατολική, Kythira | ✗ no hit | Παραλία Βλυχάδα · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 193 | Αγία Ειρήνη Καρύστου | Evia | Αγία Ειρήνη Καρύστου, Evia | ✗ no hit | Αγία Ειρήνη · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 194 | Αγία Ειρήνη Μαρμαρίου | Evia | Αγία Ειρήνη Μαρμαρίου, Evia | ✗ no hit | Αγία Ειρήνη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 195 | Αγία Παρασκευή | Evia | Παραλία Αγία Παρασκευή, Evia | ✗ no hit | (unnamed) · 209 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 196 | Άγιος Αθανάσιος | Evia | Άγιος Αθανάσιος, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 197 | Άγιος Αντώνιος | Evia | Άγιος Αντώνιος, Evia | ✗ no hit | Μάρμαρα · 710 m | mark **needs-review** (no good name or pin) |
| FAIL | 198 | Άγιος Βασίλειος | Evia | Άγιος Βασίλειος, Evia | ✗ no hit | Άγιος Βασίλειος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 200 | Άγιος Μηνάς | Evia | Παραλία Άγιος Μηνάς, Evia | ✗ no hit | Άγιος Μηνάς · 194 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 201 | Άγιος Νικόλαος | Evia | Άγιος Νικόλαος, Evia | ✗ no hit | Άγιος Νικόλαος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 202 | Αγκάλη | Evia | Αγκάλη, Evia | ✗ no hit | Αγκάλη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 203 | Ακρωτήρι | Evia | Ακρωτήρι, Evia | ✗ no hit | Ακρωτήρι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 204 | Ακτή Βουβάλι | Evia | Ακτή Βουβάλι, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 205 | Αλυκές | Evia | Αλυκές, Evia | ✗ no hit | Αλυκές · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 206 | Ανεμάκι | Evia | Ανεμάκι, Evia | ✗ no hit | Ανεμάκι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 207 | Αράλιμος | Evia | Αράλιμος, Evia | ✗ no hit | Αράλιμος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 208 | Αρχάμπολη | Evia | Αρχάμπολη, Evia | ✗ no hit | Αρχάμπολη · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 209 | Ατάλαντος | Evia | Ατάλαντος, Evia | ✗ no hit | Ατάλαντος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 210 | Βαθυχάντακο | Evia | Βαθυχάντακο, Evia | ✗ no hit | Βαθυχάντακο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 211 | Βαλοπούλα | Evia | Βαλοπούλα, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 212 | Βαρελλαίων | Evia | Βαρελλαίων, Evia | ✗ no hit | Βαρελλαίων · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 213 | Βύθουρη | Evia | Βύθουρη, Evia | ✗ no hit | Βύθουρη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 215 | Γαλατάκι | Evia | Γαλατάκι, Evia | ✗ no hit | Γαλατάκι · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 216 | Γαλλίδα | Evia | Γαλλίδα, Evia | ✗ no hit | Γαλλίδα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 217 | Γιαννίτσι | Evia | Παραλία Γιαννίτσι, Evia | ✗ no hit | Γιαννίτσι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 218 | Γρεγολίμανο | Evia | Παραλία Γρεγολίμανο, Evia | ✗ no hit | Γρεγολίμανο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 219 | Δαφνοπόταμος | Evia | Δαφνοπόταμος, Evia | ✗ no hit | Δαφνοπόταμος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 220 | Ελιά | Evia | Ελιά, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 221 | Ζάστανα | Evia | Παραλία Ζάστανα, Evia | ✗ no hit | (unnamed) · 413 m | mark **needs-review** (no good name or pin) |
| FAIL | 222 | Ζέφυρος | Evia | Ζέφυρος, Evia | ✗ no hit | Ζέφυρος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 223 | Θαψά | Evia | Θαψά, Evia | ✗ no hit | Θαψά · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 224 | Κάβος | Evia | Κάβος, Evia | ✗ no hit | Κάβος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 225 | Κακιά | Evia | Κακιά, Evia | ✗ no hit | Κακιά · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 226 | Κακολίμανο | Evia | Παραλία Κακολίμανο, Evia | ✗ no hit | Κακολίμανο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 227 | Καλάμι | Evia | Καλάμι, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 228 | Καλαμίτσι | Evia | Καλαμίτσι, Evia | ✗ no hit | (unnamed) · 1161 m | mark **needs-review** (no good name or pin) |
| FAIL | 229 | Κάλαμος | Evia | Παραλία Κάλαμος, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 230 | Καναπίτσα | Evia | Καναπίτσα, Evia | ✗ no hit | Σουβάλα · 334 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 231 | Κατσούλι | Evia | Κατσούλι, Evia | ✗ no hit | Πέρα Κατσούλι · 393 m | mark **needs-review** (no good name or pin) |
| FAIL | 232 | Κεφάλα | Evia | Κεφάλα, Evia | ✗ no hit | Κεφάλα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 233 | Κλιμάκι | Evia | Παραλία Κλιμάκι, Evia | ✗ no hit | Κλιμάκι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 234 | Κοκκινιάς | Evia | Παραλία Κοκκινιάς, Evia | ✗ no hit | Λιβαδάκια · 630 m | mark **needs-review** (no good name or pin) |
| FAIL | 235 | Κορασίδα | Evia | Παραλία Κορασίδα, Evia | ✗ no hit | Κορασίδα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 236 | Κόσκινα | Evia | Παραλία Κόσκινα, Evia | ✗ no hit | Κόσκινα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 237 | Κουρέντι | Evia | Κουρέντι, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 238 | Κρεμάλα | Evia | Κρεμάλα, Evia | ✗ no hit | Κρεμάλα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 240 | Λευκή Ακτή | Evia | Λευκή Ακτή, Evia | ✗ no hit | Λευκή Ακτή · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 241 | Λημνιώνας Μαρμαρίου | Evia | Λημνιώνας Μαρμαρίου, Evia | ✗ no hit | Λημνιώνας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 242 | Λιανή Άμμος Χαλκίδας | Evia | Λιανή Άμμος Χαλκίδας, Evia | ✗ no hit | Λιανή Άμμος · 5 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 243 | Λιανή Άμμος Πετριών | Evia | Παραλία Λιανή Άμμος Πετριών, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 244 | Λιβαδάκι | Evia | Λιβαδάκι, Evia | ✗ no hit | Γαλλίδα · 1058 m | mark **needs-review** (no good name or pin) |
| FAIL | 245 | Λιβαδάκια | Evia | Παραλία Λιβαδάκια, Evia | ✗ no hit | Λιβαδάκια · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 246 | Λιβάδι | Evia | Λιβάδι, Evia | ✗ no hit | Λιβάδι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 247 | Λιμνιώνα | Evia | Λιμνιώνα, Evia | ✗ no hit | Λιμνιώνα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 248 | Λιμνιωνάκι | Evia | Λιμνιωνάκι, Evia | ✗ no hit | Λιμνιωνάκι · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 249 | Λιμνιώνας Ψαχνών | Evia | Λιμνιώνας Ψαχνών, Evia | ✗ no hit | Λιμνιώνας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 250 | Λινάρι | Evia | Λινάρι, Evia | ✗ no hit | Λινάρι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 251 | Λουτράκι Μπούρου | Evia | Λουτράκι Μπούρου, Evia | ✗ no hit | Λουτράκι Μπούρου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 252 | Μάγειρας | Evia | Παραλία Μάγειρας, Evia | ✗ no hit | Μάγειρας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 253 | Μακρύς Γιαλός | Evia | Μακρύς Γιαλός, Evia | ✗ no hit | Μακρύς Γιαλός · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 254 | Μάρμαρα | Evia | Παραλία Μάρμαρα, Evia | ✗ no hit | Μάρμαρα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 255 | Μαύρικας | Evia | Παραλία Μαύρικας, Evia | ✗ no hit | Μαύρικας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 256 | Μεγάλη Άμμος | Evia | Μεγάλη Άμμος, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 257 | Μικρή Κεφάλα | Evia | Μικρή Κεφάλα, Evia | ✗ no hit | Μικρή Κεφάλα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 258 | Μνήματα | Evia | Μνήματα, Evia | ✗ no hit | (unnamed) · 659 m | mark **needs-review** (no good name or pin) |
| FAIL | 259 | Μπουρνόντας | Evia | Παραλία Μπουρνόντας, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 260 | Ναυτικό | Evia | Ναυτικό, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 261 | Νησιώτισσα | Evia | Νησιώτισσα, Evia | ✗ no hit | Νησιώτισσα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 262 | Παπαθανασίου | Evia | Παπαθανασίου, Evia | ✗ no hit | Παπαθανασίου · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 263 | Παραλία Αγίου Νικολάου | Evia | Παραλία Αγίου Νικολάου, Evia | ✗ no hit | Παραλία Αγίου Νικολάου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 264 | Παραλία Ακταίου | Evia | Παραλία Ακταίου, Evia | ✗ no hit | Παραλία Ακταίου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 265 | Παραλία "Αστέρια" | Evia | Παραλία "Αστέρια", Evia | ✗ no hit | Plaz "Asteria" · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 266 | Παραλία Αχλαδίου (Φραγκάκη) | Evia | Παραλία Αχλαδίου (Φραγκάκη), Evia | ✗ no hit | Παραλία Αχλαδίου (Φραγκάκη) · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 267 | Παραλία Βλαχιάς | Evia | Παραλία Βλαχιάς, Evia | ✗ no hit | Παραλία Βλαχιάς · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 268 | Παραλία Γιάλτρων | Evia | Παραλία Γιάλτρων, Evia | ✗ no hit | Παραλία Γιάλτρων · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 269 | Παραλία Δάφνης | Evia | Παραλία Δάφνης, Evia | ✗ no hit | Παραλία Δάφνης · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 270 | Παραλία Εύα | Evia | Παραλία Εύα, Evia | ✗ no hit | Πρώην Εύα Κάμπινκ · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 271 | Παραλία Καλλιανού | Evia | Παραλία Καλλιανού, Evia | ✗ no hit | Παραλία Καλλιανού · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 272 | Παραλία Κοτσικιάς | Evia | Παραλία Κοτσικιάς, Evia | ✗ no hit | (unnamed) · 556 m | mark **needs-review** (no good name or pin) |
| FAIL | 273 | Παραλία Κρύας Βρύσης | Evia | Παραλία Κρύας Βρύσης, Evia | ✗ no hit | Παραλία Κρύας Βρύσης · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 274 | Παραλία Μετοχίου | Evia | Παραλία Μετοχίου, Evia | ✗ no hit | Παραλία Μετοχίου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 275 | Παραλία Μουρτιάς | Evia | Παραλία Μουρτιάς, Evia | ✗ no hit | Παραλία Μουρτιάς · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 276 | Παραλία Πευκί | Evia | Παραλία Πευκί, Evia | ✗ no hit | Παραλία Πευκί · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 277 | Παραλία Πολιτικών | Evia | Παραλία Πολιτικών, Evia | ✗ no hit | Παραλια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 278 | Παραλία Ροδάκι | Evia | Παραλία Ροδάκι, Evia | ✗ no hit | Παραλία Ροδάκι · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 279 | Παραλία Σκιάθου | Evia | Παραλία Σκιάθου, Evia | ✗ no hit | Παραλία Σκιάθου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 280 | Παραλία τσιρμοκόκκαλα | Evia | Παραλία τσιρμοκόκκαλα, Evia | ✗ no hit | Παραλία τσιρμοκόκκαλα · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 282 | Παραλία Φηγιά | Evia | Παραλία Φηγιά, Evia | ✗ no hit | παραλία Φηγιά · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 283 | Παραλία Ψαροπούλι/Βασιλικών | Evia | Παραλία Ψαροπούλι/Βασιλικών, Evia | ✗ no hit | Παραλία Ψαροπούλι/Βασιλικών · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 286 | Πετάλη | Evia | Πετάλη, Evia | ✗ no hit | Πετάλη · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 289 | Πλατύς Γιαλός | Evia | Πλατύς Γιαλός, Evia | ✗ no hit | Πλατύς Γιαλός · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 290 | Πόρτο Λάφια | Evia | Παραλία Πόρτο Λάφια, Evia | ✗ no hit | Porto Lafia · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 291 | Πόρτο Πεύκο | Evia | Πόρτο Πεύκο, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 292 | Ποτάμι Καρύστου | Evia | Παραλία Ποτάμι Καρύστου, Evia | ✗ no hit | Ποτάμι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 293 | Ποτάμι Βλαχιάς | Evia | Ποτάμι Βλαχιάς, Evia | ✗ no hit | Ποτάμι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 294 | Πρασίδι | Evia | Πρασίδι, Evia | ✗ no hit | Πρασίδι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 295 | Ροδιές | Evia | Παραλία Ροδιές, Evia | ✗ no hit | Ροδιές · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 296 | Σαρακήνικο Βλαχιάς | Evia | Σαρακήνικο Βλαχιάς, Evia | ✗ no hit | Σαρακήνικο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 297 | Σαρακήνικο Αγίας Άννας | Evia | Σαρακήνικο Αγίας Άννας, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 299 | Σουβάλα | Evia | Σουβάλα, Evia | ✗ no hit | Σουβάλα · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 301 | Σουτσίνι | Evia | Σουτσίνι, Evia | ✗ no hit | Σουτσίνι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 304 | Στόμιο | Evia | Παραλία Στόμιο, Evia | ✗ no hit | Στόμιο · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 306 | Σχοινοδαύλεια | Evia | Σχοινοδαύλεια, Evia | ✗ no hit | Σχοινοδαύλεια · 24 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 307 | Τριανταφυλλένια | Evia | Παραλία Τριανταφυλλένια, Evia | ✗ no hit | Τριανταφυλλένια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 308 | Τσίλαρος | Evia | Παραλία Τσίλαρος, Evia | ✗ no hit | Τσίλαρος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 309 | Τσοκαΐτι | Evia | Τσοκαΐτι, Evia | ✗ no hit | Τσοκαΐτι · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 310 | Χερόμυλος | Evia | Χερόμυλος, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 311 | Χιλιαδού | Evia | Χιλιαδού, Evia | ✗ no hit | Χιλιαδού · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 312 | Χιλιαδού παραλία Γυμνιστών | Evia | Χιλιαδού παραλία Γυμνιστών, Evia | ✗ no hit | Hiliadou Nudist Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 313 | Χρυσή ακτή | Evia | Χρυσή ακτή, Evia | ✗ no hit | Χρυσή ακτή · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 314 | Ψιλή Άμμος | Evia | Ψιλή Άμμος, Evia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 3062 | Αλμυρίχι | Evia | Αλμυρίχι, Evia | ✗ no hit | Αλμυρίχι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1320 | Παραλία Γυμνιστών Μολύβου | Lesvos | Παραλία Γυμνιστών Μολύβου, Lesvos | ✗ no hit | Naturist beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1321 | Άγιος Ερμογένης | Lesvos | Άγιος Ερμογένης, Lesvos | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1323 | Ακτή Τσαμάκια | Lesvos | Ακτή Τσαμάκια, Lesvos | ✗ no hit | (unnamed) · 39 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1324 | Αμμουδέλι | Lesvos | Αμμουδέλι, Lesvos | ✗ no hit | Αμμουδέλι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1336 | Κοχύλια | Lesvos | Κοχύλια, Lesvos | ✗ no hit | ΚΟΧΥΛΙΑ · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1341 | Λιγονάρι | Lesvos | Παραλία Λιγονάρι, Lesvos | ✗ no hit | Λιγονάρι · 2 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1345 | Μπάκερος | Lesvos | Μπάκερος, Lesvos | ✗ no hit | Μπάκερος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1350 | Ξέρες Ευρειακής | Lesvos | Παραλία Ξέρες Ευρειακής, Lesvos | ✗ no hit | Ξέρες Ευρειακής · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1351 | Πάτος | Lesvos | Πάτος, Lesvos | ✗ no hit | παραλία "Πάτος" · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1356 | Παραλία Δρότας | Lesvos | Παραλία Δρότας, Lesvos | ✗ no hit | Παραλία Δρότας · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1359 | Παραλία Τάρτι | Lesvos | Παραλία Τάρτι, Lesvos | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1362 | Πεταλίδι | Lesvos | Πεταλίδι, Lesvos | ✗ no hit | Πεταλίδι · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1363 | Πλαζ Κανόνι | Lesvos | Πλαζ Κανόνι, Lesvos | ✗ no hit | Πλαζ Κανόνι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1367 | Τσάφι | Lesvos | Παραλία Τσάφι, Lesvos | ✗ no hit | Τσάφι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1368 | Τσίλια | Lesvos | Παραλία Τσίλια, Lesvos | ✗ no hit | Τσίλια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1373 | Φαρά | Lesvos | Παραλία Φαρά, Lesvos | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1374 | Φυκιότρυπα | Lesvos | Φυκιότρυπα, Lesvos | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1375 | Χαλατσές | Lesvos | Παραλία Χαλατσές, Lesvos | ✗ no hit | Χαλατσές · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1376 | Χαραμίδα | Lesvos | Παραλία Χαραμίδα, Lesvos | ✗ no hit | Χαραμίδα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1377 | Χαραμίδα νησέλι | Lesvos | Χαραμίδα νησέλι, Lesvos | ✗ no hit | Χαραμίδα νησέλι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1542 | Αγία Βαρβάρα | Lakonia (mainland) | Παραλία Αγία Βαρβάρα, Lakonia | ✗ no hit | Agia Barbara beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1543 | Αγία Κυριακή | Lakonia (mainland) | Παραλία Αγία Κυριακή, Lakonia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1544 | Άγιος Κυπριανός | Lakonia (mainland) | Παραλία Άγιος Κυπριανός, Lakonia | ✗ no hit | Άγιος Κυπριανός · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1545 | Αλύπα | Lakonia (mainland) | Παραλία Αλύπα, Lakonia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1546 | Αμπελάκια | Lakonia (mainland) | Παραλία Αμπελάκια, Lakonia | ✗ no hit | Αμπελάκια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1551 | Βαθύ | Lakonia (mainland) | Παραλία Βαθύ, Lakonia | ✗ no hit | Βαθύ · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1554 | Βορδόνας | Lakonia (mainland) | Παραλία Βορδόνας, Lakonia | ✗ no hit | Vordonas beach · 1 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1559 | Καμάρες | Lakonia (mainland) | Παραλία Καμάρες, Lakonia | ✗ no hit | Καμάρες · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1560 | Καραβοστάσι Οιτύλου | Lakonia (mainland) | Παραλία Καραβοστάσι Οιτύλου, Lakonia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1561 | Καστέλλα | Lakonia (mainland) | Παραλία Καστέλλα, Lakonia | ✗ no hit | Καστέλλα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1566 | Μαρμάρι | Lakonia (mainland) | Παραλία Μαρμάρι, Lakonia | ✗ no hit | Μαρμάρι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1571 | Ξιφιάς | Lakonia (mainland) | Παραλία Ξιφιάς, Lakonia | ✗ no hit | Ξιφιάς · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1572 | Οίτυλο | Lakonia (mainland) | Παραλία Οίτυλο, Lakonia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1573 | Παραλία 100 Ρίζες | Lakonia (mainland) | Παραλία 100 Ρίζες, Lakonia | ✗ no hit | (unnamed) · 1216 m | mark **needs-review** (no good name or pin) |
| FAIL | 1576 | Παραλία Ελιάς | Lakonia (mainland) | Παραλία Ελιάς, Lakonia | ✗ no hit | ✗ none | mark **needs-review** (no good name or pin) |
| FAIL | 1589 | Πλύτρα - Παχιά Άμμος | Lakonia (mainland) | Πλύτρα - Παχιά Άμμος, Lakonia | ✗ no hit | Πλαζ Πλύτρας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| FAIL | 1601 | Χαλικιά Βάτα | Lakonia (mainland) | Παραλία Χαλικιά Βάτα, Lakonia | ✗ no hit | Χαλικιά Βάτα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 32 | Παραλία Σχινιά | East Attica (mainland) | Παραλία Σχινιά, East Attica | Παραλία Σχινιά · 619 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 46 | Αυλάκι | East Attica (mainland) | Παραλία Αυλάκι, East Attica | Πόρτο Ράφτη Παραλία Αυλάκι · 1853 m · needs_review | Αυλάκι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 66 | Παραλία Αναβύσσου | East Attica (mainland) | Παραλία Αναβύσσου, East Attica | Παραλία Αναβύσσου · 432 m · needs_review | Παραλία Αναβύσσου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 67 | Όρμος Αγίου Νικολάου | East Attica (mainland) | Όρμος Αγίου Νικολάου, East Attica | Όρμος Αγίου Νικολάου · 14568 m · needs_review | FKK Beach · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 3006 | Πόρτο Ράφτη Αυλάκι | East Attica (mainland) | Παραλία Πόρτο Ράφτη Αυλάκι, East Attica | Πόρτο Ράφτη Παραλία Αυλάκι · 153 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 3028 | Ωρωπός Σκάλα Ωρωπού | East Attica (mainland) | Παραλία Ωρωπός Σκάλα Ωρωπού, East Attica | Ταβέρνα Χρήστος & Μαρία ΟΕ Παραλία Μαρκοπούλου · 1144 m · needs_review | (unnamed) · 48 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 117 | Πλατιά Άμμος | Kythira | Παραλία Πλατιά Άμμος, Kythira | Πλατιά Άμμος · 24 m · verified (via "Πλατιά Άμμος, Kythira") | Πλατιά Άμμος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 121 | Παραλια Φυρή Άμμος | Kythira | Παραλια Φυρή Άμμος, Kythira | Παραλια Φυρή Άμμος · 562 m · needs_review | Παραλια Φυρή Άμμος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 131 | Διακόφτι | Kythira | Παραλία Διακόφτι, Kythira | Diakofti · 71 m · verified (via "Διακόφτι, Kythira") | Diakofti · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 133 | Λιμνιώνας | Kythira | Παραλία Λιμνιώνας, Kythira | Λιμνιώνας · 21 m · verified (via "Λιμνιώνας, Kythira") | Λιμνιώνας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 141 | Κακόπετρα | Kythira | Παραλία Κακόπετρα, Kythira | Κακόπετρα · 14 m · verified (via "Κακόπετρα, Kythira") | Κακόπετρα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 144 | Καψάλι | Kythira | Παραλία Καψάλι, Kythira | Καψάλι - Κάλαμος · 556 m · needs_review (via "Καψάλι, Kythira") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 146 | Καψάλι Πίσω Γιαλός | Kythira | Παραλία Καψάλι Πίσω Γιαλός, Kythira | Καψάλι Πίσω Γιαλός · 6 m · verified (via "Καψάλι Πίσω Γιαλός, Kythira") | Καψάλι Πίσω Γιαλός · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 150 | Βρουλέα | Kythira | Παραλία Βρουλέα, Kythira | Βρουλέα · 2 m · verified (via "Βρουλέα, Kythira") | Βρουλέα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 199 | Άγιος Δημήτριος | Evia | Άγιος Δημήτριος, Evia | Evia Hotel & Suites · 154634 m · needs_review (via "Agios Dimitrios, Evia") | Άγιος Δημήτριος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1322 | Άγιος Ισίδωρος | Lesvos | Παραλία Άγιος Ισίδωρος, Lesvos | Άγιος Ισίδωρος · 22852 m · needs_review (via "Άγιος Ισίδωρος, Lesvos") | (unnamed) · 710 m | mark **needs-review** (no good name or pin) |
| REVIEW | 1325 | Αμπέλια | Lesvos | Παραλία Αμπέλια, Lesvos | Αμπέλια · 82 m · verified (via "Αμπέλια, Lesvos") | Αμπέλια · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1328 | Αυλάκι | Lesvos | Αυλάκι, Lesvos | Αυλάκι Α · 46217 m · needs_review | Αυλάκι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1330 | Βατερά | Lesvos | Παραλία Βατερά, Lesvos | Βατερά · 1366 m · needs_review (via "Βατερά, Lesvos") | Βατερά · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1333 | Κάμπος | Lesvos | Παραλία Κάμπος, Lesvos | Κάμπος · 437 m · needs_review (via "Κάμπος, Lesvos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1334 | Καλό Λιμάνι | Lesvos | Παραλία Καλό Λιμάνι, Lesvos | Καλό Λιμάνι · 27 m · verified (via "Καλό Λιμάνι, Lesvos") | Καλό Λιμάνι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1337 | Λάψαρνα | Lesvos | Παραλία Λάψαρνα, Lesvos | Λάψαρνα · 35 m · verified (via "Λάψαρνα, Lesvos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1338 | Λίμενας | Lesvos | Παραλία Λίμενας, Lesvos | Λίμενας · 82 m · verified (via "Λίμενας, Lesvos") | Λίμενας · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1339 | Λαγκάδα | Lesvos | Παραλία Λαγκάδα, Lesvos | Λαγκάδα · 27 m · verified (via "Λαγκάδα, Lesvos") | Λαγκάδα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1342 | Λιμαντζίκι | Lesvos | Παραλία Λιμαντζίκι, Lesvos | Λιμαντζίκι · 12 m · verified (via "Λιμαντζίκι, Lesvos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1347 | Μόλυβος | Lesvos | Παραλία Μόλυβος, Lesvos | Μόλυβος · 36 m · verified (via "Μόλυβος, Lesvos") | Μόλυβος · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1364 | Ποδαράς | Lesvos | Παραλία Ποδαράς, Lesvos | Ποδαράς · 49 m · verified (via "Ποδαράς, Lesvos") | Ποδαράς · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1366 | Τηλέγραφος | Lesvos | Παραλία Τηλέγραφος, Lesvos | Τηλέγραφος · 4 m · verified (via "Τηλέγραφος, Lesvos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1564 | Κυανή Ακτή | Lakonia (mainland) | Κυανή Ακτή, Lakonia | Κυανή Ακτή · 1755 m · needs_review | Κυανή Ακτή · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1582 | Παραλία Μαυροβουνίου | Lakonia (mainland) | Παραλία Μαυροβουνίου, Lakonia | Παραλία Μαυροβουνίου · 417 m · needs_review | Παραλία Μαυροβουνίου · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1583 | Παραλία Νερατζιώνα | Lakonia (mainland) | Παραλία Νερατζιώνα, Lakonia | Παραλία Νερατζιώνα · 622 m · needs_review | Παραλία Νερατζιώνα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1588 | Παραλία Τρίνησα | Lakonia (mainland) | Παραλία Τρίνησα, Lakonia | Παραλία Τρίνησα · 2872 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1593 | Πούντα | Lakonia (mainland) | Παραλία Πούντα, Lakonia | Παραλία Νερατζιώνα · 1576 m · needs_review | Πούντα · 223 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 3108 | Καλόγερος (Ελαφόνησος) | Lakonia (mainland) | Καλόγερος (Ελαφόνησος), Lakonia | Παραλία Καλόγερος · 47 m · needs_review | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1858 | Άγιος Δημήτριος | Kythnos | Παραλία Άγιος Δημήτριος, Kythnos | Άγιος Δημήτριος · 128 m · verified (via "Άγιος Δημήτριος, kythnos") | Άγιος Δημήτριος · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1861 | Άγιος Στέφανος | Kythnos | Παραλία Άγιος Στέφανος, Kythnos | Άγιος Στέφανος · 83 m · verified (via "Άγιος Στέφανος, kythnos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1868 | Αόσα | Kythnos | Παραλία Αόσα, Kythnos | Αόσα · 18 m · verified (via "Αόσα, kythnos") | Αόσα · 1 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1871 | Γαϊδουρόμαντρα | Kythnos | Παραλία Γαϊδουρόμαντρα, Kythnos | Γαϊδουρόμαντρα · 25 m · verified (via "Γαϊδουρόμαντρα, kythnos") | Γαϊδουρόμαντρα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1872 | Επισκοπή | Kythnos | Παραλία Επισκοπή, Kythnos | Επισκοπή · 113 m · verified (via "Επισκοπή, kythnos") | Επισκοπή · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1876 | Καλό Λιβάδι | Kythnos | Παραλία Καλό Λιβάδι, Kythnos | Καλό Λιβάδι · 41 m · verified (via "Καλό Λιβάδι, kythnos") | Καλό Λιβάδι · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1878 | Κολοβελόνη | Kythnos | Παραλία Κολοβελόνη, Kythnos | Κολοβελόνη · 3 m · verified (via "Κολοβελόνη, kythnos") | Κολοβελόνη · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1881 | Λεύκες | Kythnos | Παραλία Λεύκες, Kythnos | Λεύκες · 12 m · verified (via "Λεύκες, kythnos") | Λεύκες · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1884 | Μαρούλα | Kythnos | Παραλία Μαρούλα, Kythnos | Μαρούλα · 5 m · verified (via "Μαρούλα, kythnos") | Σκινάρι · 364 m | mark **needs-review** (no good name or pin) |
| REVIEW | 1886 | Μικρό Λιβαδάκι | Kythnos | Παραλία Μικρό Λιβαδάκι, Kythnos | Μικρό Λιβαδάκι · 5 m · verified (via "Μικρό Λιβαδάκι, kythnos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1887 | Νίκα | Kythnos | Παραλία Νίκα, Kythnos | Νίκα · 8 m · verified (via "Νίκα, kythnos") | Νίκα · 0 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1889 | Πετρούσα | Kythnos | Παραλία Πετρούσα, Kythnos | Πετρούσα · 1 m · verified (via "Πετρούσα, kythnos") | (unnamed) · 197 m | route by **coordinates** (pin OSM-corroborated) |
| REVIEW | 1895 | Σκύλου | Kythnos | Παραλία Σκύλου, Kythnos | Σκύλου · 28 m · verified (via "Σκύλου, kythnos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1896 | Στύφος | Kythnos | Παραλία Στύφος, Kythnos | Στύφος · 13 m · verified (via "Στύφος, kythnos") | ✗ none | mark **needs-review** (no good name or pin) |
| REVIEW | 1897 | Φλαμπούρια | Kythnos | Παραλία Φλαμπούρια, Kythnos | Φλαμπούρια · 42 m · verified (via "Φλαμπούρια, kythnos") | Φλαμπούρια · 0 m | route by **coordinates** (pin OSM-corroborated) |
