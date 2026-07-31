"""
ΚΟΙΝΑ ΕΡΓΑΛΕΙΑ ΓΙΑ ΤΑ COPERNICUS SCRIPTS.

Τέσσερα scripts διαβάζουν πλέγματα Copernicus (κύμα, θερμοκρασία, διαύγεια, δορυφορικός
άνεμος) και όλα λύνουν τα ίδια δύο προβλήματα: πώς μπαίνεις στο σύνολο, και πώς βρίσκεις
θαλάσσιο κελί για μια παραλία. Λύνονται εδώ μία φορά.

ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΡΟΦΑΝΕΣ: το πλησιέστερο κελί σε μια παραλία είναι συνήθως
ΣΤΕΡΙΑ, άρα NaN. Στα 4,2 χλμ. μια παραλία κάθεται σχεδόν πάντα μέσα σε χερσαίο κελί. Ένα
αφελές `.sel(method='nearest')` επιστρέφει σιωπηλά NaN για το μεγαλύτερο μέρος του
καταλόγου — και επειδή τα NaN απλώς εξαφανίζονται από τα στατιστικά, το script δείχνει να
δουλεύει. Γι' αυτό η αναζήτηση θαλάσσιου κελιού είναι εδώ, με ρητό όριο απόστασης και
ρητή καταγραφή όσων δεν βρήκαν νερό.

ΔΙΑΠΙΣΤΕΥΤΗΡΙΑ: μόνο από περιβάλλον (CMEMS_USER / CMEMS_PASS) ή από `copernicusmarine
login`. Ποτέ σε αρχείο — αυτό το repo είναι δημόσιο.
"""

import json
import math
import os
import sys
from pathlib import Path

# Η κονσόλα των Windows ανοίγει σε cp1253 και σκάει με UnicodeEncodeError στο πρώτο «→» ή
# «✓» — δηλαδή αφού έχει ήδη τρέξει το ακριβό κατέβασμα. Επειδή ΟΛΑ τα scripts εδώ τυπώνουν
# ελληνικά, το ρυθμίζουμε μία φορά στο import αντί να θυμόμαστε PYTHONIOENCODING κάθε φορά.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # ανακατευθυνόμενη έξοδος χωρίς reconfigure
        pass

ROOT = Path(__file__).resolve().parent.parent
APP_BEACH_DIR = ROOT / "public" / "data" / "beaches" / "app"

# Το ελληνικό παράθυρο. Κρατιέται σφιχτό επίτηδες: το μεσογειακό πλέγμα φτάνει ως τον
# Ατλαντικό (lon -18) και το να ανοίξει η μάσκα σε όλο το πλέγμα δεκαπλασιάζει τη μνήμη
# χωρίς να προσθέτει ούτε μία ελληνική παραλία.
GREECE_BBOX = {"lat_min": 34.5, "lat_max": 41.9, "lon_min": 19.0, "lon_max": 29.8}


def credentials():
    """Ζεύγος για τα copernicusmarine calls· κενό dict αν έχει γίνει `login` μία φορά."""
    user, password = os.environ.get("CMEMS_USER"), os.environ.get("CMEMS_PASS")
    return {"username": user, "password": password} if (user and password) else {}


def open_dataset(dataset_id, **kwargs):
    import copernicusmarine as cm
    return cm.open_dataset(dataset_id=dataset_id, **credentials(), **kwargs)


def load_beaches(include_mainland=True):
    """Κάθε παραλία από τα ΧΤΙΣΜΕΝΑ αρχεία περιοχής — ό,τι βλέπει η εφαρμογή."""
    beaches = []
    for path in sorted(APP_BEACH_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        island = data.get("island") or {}
        if not include_mainland and "mainland" in path.stem:
            continue
        for beach in island.get("beaches") or []:
            coords = beach.get("coordinates") or {}
            lat, lon = coords.get("lat"), coords.get("lon")
            if lat is None or lon is None:
                continue
            beaches.append({
                "id": beach.get("id"),
                "name": (beach.get("name") or {}).get("gr") or (beach.get("name") or {}).get("en"),
                "nameEn": (beach.get("name") or {}).get("en"),
                "regionFile": path.stem,
                "island": (beach.get("location") or {}).get("island"),
                "region": (beach.get("location") or {}).get("region"),
                "lat": float(lat),
                "lon": float(lon),
                "facingDeg": (beach.get("orientation") or {}).get("degrees"),
            })
    return beaches


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class SeaCellIndex:
    """
    Χάρτης «παραλία -> πλησιέστερο κελί ΜΕ ΝΕΡΟ», φτιαγμένος μία φορά ανά σύνολο.

    Φορτώνει ΕΝΑ χρονικό βήμα στο ελληνικό παράθυρο, το μετατρέπει σε μάσκα θάλασσας και
    μετά απαντά χωρίς άλλη δικτυακή κίνηση. Το μόνο κόστος είναι αυτή η μία φόρτωση.
    """

    def __init__(self, dataset, variable, bbox=None, time_index=0, max_distance_km=25.0):
        import numpy as np

        bbox = bbox or GREECE_BBOX
        window = dataset[variable].isel(time=time_index).sel(
            latitude=slice(bbox["lat_min"], bbox["lat_max"]),
            longitude=slice(bbox["lon_min"], bbox["lon_max"]),
        ).load()

        self.lats = np.asarray(window["latitude"].values, dtype="float64")
        self.lons = np.asarray(window["longitude"].values, dtype="float64")
        values = np.asarray(window.values, dtype="float64")
        if values.ndim == 3:  # κάποια σύνολα κουβαλούν βαθμίδα βάθους μεγέθους 1
            values = values[0]
        self.sea = np.isfinite(values)
        self.max_distance_km = max_distance_km

        sea_rows, sea_cols = np.nonzero(self.sea)
        self._sea_rows, self._sea_cols = sea_rows, sea_cols
        self._sea_lat = self.lats[sea_rows]
        self._sea_lon = self.lons[sea_cols]
        self._np = np
        if sea_rows.size == 0:
            raise RuntimeError(f"Καμία θαλάσσια τιμή στο {variable} μέσα στο ελληνικό παράθυρο")

    def nearest(self, lat, lon):
        """-> (cell_lat, cell_lon, distance_km) ή None αν δεν υπάρχει νερό στην ακτίνα."""
        np = self._np
        # Ισοαπόσταση σε επίπεδη προσέγγιση: αρκεί απόλυτα για επιλογή ανάμεσα σε κελιά
        # 4 χλμ. σε εύρος λίγων δεκάδων χλμ., και είναι δύο τάξεις μεγέθους φθηνότερη από
        # haversine πάνω σε ~40.000 θαλάσσια κελιά επί 2.850 παραλίες.
        dlat = (self._sea_lat - lat) * 111.32
        dlon = (self._sea_lon - lon) * 111.32 * math.cos(math.radians(lat))
        idx = int(np.argmin(dlat * dlat + dlon * dlon))
        cell_lat = float(self._sea_lat[idx])
        cell_lon = float(self._sea_lon[idx])
        distance = haversine_km(lat, lon, cell_lat, cell_lon)
        if distance > self.max_distance_km:
            return None
        return cell_lat, cell_lon, distance


def beaufort(kmh):
    if kmh is None:
        return None
    for limit, bft in ((1, 0), (5, 1), (11, 2), (19, 3), (28, 4), (38, 5),
                       (49, 6), (61, 7), (74, 8), (88, 9), (102, 10), (117, 11)):
        if kmh < limit or (bft and kmh <= limit):
            return bft
    return 12


def write_report(relative_path, payload, compact=None):
    """
    Γράφει JSON. Τα αρχεία του `data/` βγαίνουν συμπαγή, οι αναφορές με εσοχές.

    Η διάκριση δεν είναι αισθητική: το `data/waveClimatology.generated.json` έχει 2.766
    παραλίες και μπαίνει στο git. Με εσοχές είναι 2 MB και ξαναγράφεται ολόκληρο σε κάθε
    παραγωγή· χωρίς, το ένα τρίτο. Κανείς δεν το διαβάζει με τα μάτια — το διαβάζει το
    build. Οι αναφορές στο `reports/` είναι το αντίστροφο: τις διαβάζει άνθρωπος για να
    πάρει απόφαση, οπότε κρατούν τις εσοχές.
    """
    out = ROOT / relative_path
    out.parent.mkdir(parents=True, exist_ok=True)
    if compact is None:
        compact = str(relative_path).replace("\\", "/").startswith("data/")
    text = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) if compact
            else json.dumps(payload, ensure_ascii=False, indent=2))
    out.write_text(text, encoding="utf-8")
    return out
