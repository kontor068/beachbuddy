"""
ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΟΙ ΠΛΩΤΗΡΕΣ ΔΕΝ ΜΠΟΡΟΥΣΑΝ ΝΑ ΑΠΑΝΤΗΣΟΥΝ.

Στις 31/07/2026 η εφαρμογή άλλαξε μοντέλο κύματος σε `ewam`, με 9.723 συγκρίσεις πλωτήρων.
Εκείνη η μέτρηση απέδειξε ότι το ewam είναι σωστά βαθμονομημένο στα ΑΝΟΙΧΤΑ — οι ελληνικοί
πλωτήρες είναι όλοι σε ανοιχτό νερό. Δεν απέδειξε τον αριθμό στην ΥΠΗΝΕΜΗ ΑΚΤΗ, που είναι
ακριβώς ο αριθμός για τον οποίο έγινε η αλλαγή, και το γραπτό όριο εκείνης της μέτρησης το
έλεγε καθαρά. Το ρίσκο έμεινε ανοιχτό σε παραγωγή.

Αυτό το script το κλείνει με ΤΡΙΤΗ, ΑΝΕΞΑΡΤΗΤΗ ΠΗΓΗ: το επιχειρησιακό κυματικό σύστημα της
Μεσογείου του Copernicus (`cmems_mod_med_wav_anfc_4.2km_PT1H-i`), στα **4,2 χλμ.** — πυκνότερο
και από το ewam (5 χλμ.) και πολύ πυκνότερο από το meteofrance_wave (8 χλμ.) που έτρεχε πριν.

ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ: το Copernicus είναι μοντέλο, όχι μέτρηση. Δεν είναι «η αλήθεια».
Είναι ένας ανεξάρτητος, καλύτερης ανάλυσης κριτής, φτιαγμένος και βαθμονομημένος ειδικά για
τη Μεσόγειο από τον επίσημο ευρωπαϊκό φορέα. Αν συμφωνεί με το ewam για την υπήνεμη ακτή, η
πιθανότητα να είναι και τα δύο λάθος με τον ΙΔΙΟ τρόπο είναι μικρή — φτιάχνονται από
διαφορετικούς φορείς, σε διαφορετικό πλέγμα, με διαφορετική ακτογραμμή. Αν διαφωνεί, έχουμε
πρόβλημα σε παραγωγή και πρέπει να το μάθουμε σήμερα.

ΤΑ ΣΗΜΕΙΑ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΕΣ ΠΑΡΑΛΙΕΣ, όχι συνθετικά ζεύγη συντεταγμένων: για κάθε νησί
παίρνουμε μια παραλία που κοιτάει βοριά (προσήνεμη στο μελτέμι) και μια που κοιτάει νότο
(υπήνεμη), από τον ίδιο κατάλογο που βλέπει ο χρήστης. Έτσι το αποτέλεσμα μιλάει για
σελίδες που υπάρχουν, όχι για σημεία στον χάρτη.

ΧΡΗΣΗ
  set CMEMS_USER=...  και  set CMEMS_PASS=...   (ή `copernicusmarine login` μία φορά)
  python scripts/auditLeeShoreWaveAgainstCopernicus.py [--start 2025-07-01] [--days 31]

ΕΞΟΔΟΣ  reports/wave-model/lee-shore-copernicus.json  + ετυμηγορία στην οθόνη.
"""

import argparse
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from copernicusCommon import (  # noqa: E402
    GREECE_BBOX, SeaCellIndex, beaufort, haversine_km, load_beaches, open_dataset, write_report,
)

DATASET_ID = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
OPEN_METEO_MODELS = ["ewam", "meteofrance_wave"]

# Προσήνεμη = κοιτάει βοριά· υπήνεμη = κοιτάει νότο. Τα παράθυρα είναι στενά επίτηδες: μια
# παραλία στις 270° (δυτική) δεν είναι ούτε προσήνεμη ούτε υπήνεμη στο μελτέμι και θα
# λέρωνε και τις δύο πλευρές της σύγκρισης.
WINDWARD_FACING = (315, 45)
LEEWARD_FACING = (135, 225)

# Μελτέμι: βοριάς ±40°, τουλάχιστον 4 Bft. Ίδιος ορισμός με τη μέτρηση της 31/07 ώστε τα δύο
# αποτελέσματα να συγκρίνονται μεταξύ τους.
MELTEMI_DIRECTION = (320, 40)
MELTEMI_MIN_BEAUFORT = 4

# Πόσο απέχουν οι δύο παραλίες του ζεύγους — δες pick_island_pairs για το γιατί έχει
# σημασία και το κάτω ΚΑΙ το πάνω όριο.
PAIR_MIN_KM = 9.0
PAIR_MAX_KM = 30.0

# ── ΟΙ ΠΥΛΕΣ — ΓΡΑΜΜΕΝΕΣ ΠΡΙΝ ΤΡΕΞΕΙ ΤΟ SCRIPT ──────────────────────────────────────────
#
# Δεν χαλαρώνουν αφού δει κανείς το αποτέλεσμα. Στην προηγούμενη μέτρηση μια πύλη άλλαξε
# μετά το αποτέλεσμα· καταγράφηκε ρητά ως τέτοια, και δεν επαναλαμβάνεται εδώ.
GATES = {
    # Α. Συμφωνεί ο ανεξάρτητος κριτής ότι ΥΠΑΡΧΕΙ διαφορά προσήνεμης/υπήνεμης; Το μοντέλο
    #    που έτρεχε πριν έδινε 0,05 μ. — δηλαδή έλεγε ότι οι δύο ακτές του ίδιου νησιού
    #    έχουν το ίδιο κύμα. Αν το Copernicus πει το ίδιο, η αλλαγή ήταν λάθος.
    "min_copernicus_contrast_m": 0.30,
    # Β. Και με σωστή φορά — η υπήνεμη πιο ήρεμη από την προσήνεμη.
    "min_correct_sign_ratio": 0.90,
    # Γ. Η ΕΠΙΚΙΝΔΥΝΗ ΚΑΤΕΥΘΥΝΣΗ. Στις υπήνεμες ακτές το ewam δεν επιτρέπεται να λέει
    #    «ήρεμα» εκεί που ο ανεξάρτητος κριτής βλέπει κύμα. Δύο όρια: το μέσο σφάλμα και
    #    η ουρά, γιατί ένας καλός μέσος όρος κρύβει άνετα λίγες επικίνδυνες ώρες.
    "max_lee_mean_underestimate_m": 0.25,
    "severe_underestimate_m": 0.50,
    "max_severe_underestimate_ratio": 0.05,
    # Δ. Και η συγκριτική: το ewam πρέπει να πέφτει πιο κοντά στον κριτή απ' ό,τι το
    #    μοντέλο που αντικατέστησε, ΣΤΙΣ ΥΠΗΝΕΜΕΣ ΑΚΤΕΣ — εκεί που έγινε η αλλαγή.
    "ewam_rmse_must_beat_previous_on_lee": True,
}

UA = {"User-Agent": "calmbeach-leeshore-audit/1.0 (+https://calmbeach.gr)"}


def log(msg):
    print(msg, flush=True)


# Το μελτέμι είναι αιγαιακό φαινόμενο. Το Ιόνιο έχει άλλο ανεμολογικό καθεστώς, οπότε ένα
# ζεύγος «βόρεια/νότια» εκεί δεν μετράει τίποτα σχετικό — δες pick_island_pairs.
AEGEAN_REGIONS = {
    "South Aegean", "North Aegean", "Crete", "Attica", "Central Greece",
    "Central Macedonia", "East Macedonia and Thrace", "Thessaly",
}


def is_aegean(beach):
    return (beach.get("region") or "") in AEGEAN_REGIONS


def in_arc(deg, arc):
    if deg is None:
        return False
    lo, hi = arc
    return (lo <= deg <= hi) if lo <= hi else (deg >= lo or deg <= hi)


def fetch_json(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            log(f"      ξαναδοκιμή ({exc.__class__.__name__}) …")
            time.sleep(3 * (attempt + 1))
    return None


def open_meteo_waves(lat, lon, start, end, model):
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "hourly": "wave_height",
        "start_date": start, "end_date": end,
        "timezone": "UTC", "cell_selection": "sea", "models": model,
    })
    data = fetch_json(f"https://marine-api.open-meteo.com/v1/marine?{q}")
    hourly = data.get("hourly") or {}
    values = hourly.get(f"wave_height_{model}") or hourly.get("wave_height") or []
    return {t: v for t, v in zip(hourly.get("time", []), values) if v is not None}


def open_meteo_wind(lat, lon, start, end):
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "hourly": "wind_speed_10m,wind_direction_10m",
        "start_date": start, "end_date": end, "timezone": "UTC",
    })
    data = fetch_json(f"https://archive-api.open-meteo.com/v1/archive?{q}")
    hourly = data.get("hourly") or {}
    speeds = hourly.get("wind_speed_10m") or []
    dirs = hourly.get("wind_direction_10m") or []
    out = {}
    for t, s, d in zip(hourly.get("time", []), speeds, dirs):
        if s is None or d is None:
            continue
        out[t] = {"kmh": s, "deg": d, "bft": beaufort(s)}
    return out


def pick_island_pairs(limit):
    """
    Ανά νησί: το ζεύγος (βόρεια-κοιτάζουσα, νότια-κοιτάζουσα) παραλία που απέχει όσο
    χρειάζεται και όχι παραπάνω.

    ΚΑΤΩ ΟΡΙΟ 9 χλμ.: στα 4,2 χλμ. δύο παραλίες που απέχουν 3 χλμ. πέφτουν στο ΙΔΙΟ κελί
    και η σύγκριση βγάζει μηδέν από κατασκευή — θα «αποδείκνυε» ότι κανένα μοντέλο δεν
    ξεχωρίζει τις ακτές.

    ΠΑΝΩ ΟΡΙΟ 30 χλμ., και είναι το πιο σημαντικό από τα δύο: η πρώτη έκδοση έπαιρνε το
    ΠΙΟ ΑΠΟΜΑΚΡΥΣΜΕΝΟ ζεύγος και έβγαλε για την Εύβοια δύο παραλίες σε απόσταση 168 χλμ. —
    δηλαδή τον Βόρειο Ευβοϊκό έναντι του ανοιχτού Αιγαίου. Αυτό δεν μετράει «η υπήνεμη
    πλευρά του ίδιου νησιού»· μετράει δύο διαφορετικές θάλασσες, και θα έδινε στο τεστ
    μεγάλη διαφορά για εντελώς λάθος λόγο. Με 9-30 χλμ. η ΜΟΝΗ εξήγηση που απομένει για
    διαφορά κύματος είναι η προστασία του ίδιου του νησιού — που είναι το ζητούμενο.

    ΤΟ ΤΡΙΤΟ ΚΡΙΤΗΡΙΟ ΠΡΟΣΤΕΘΗΚΕ ΜΕΤΑ ΤΗΝ ΠΡΩΤΗ ΕΚΤΕΛΕΣΗ, και χρειάζεται να είναι ρητό τι
    άλλαξε: ΤΟ ΔΕΙΓΜΑ, ΟΧΙ ΤΑ ΚΑΤΩΦΛΙΑ. Οι πύλες παρέμειναν αριθμό προς αριθμό ίδιες. Η
    πρώτη εκτέλεση (31/07/2026) βρήκε δύο συγκεκριμένα, ονομαστικά ελαττώματα δείγματος:

      · ΚΕΡΚΥΡΑ: διάλεξε «προσήνεμη» την Dafnila (ανατολική ακτή, μέσα στο κανάλι με την
        Αλβανία) και «υπήνεμη» τους Έρμονες (δυτική ακτή, ανοιχτό Ιόνιο). Στο Ιόνιο ΔΕΝ
        φυσάει μελτέμι· η υπόθεση «βόρεια = προσήνεμη» δεν ισχύει εκεί καθόλου.
      · ΧΑΝΙΑ: διάλεξε δύο παραλίες που κάθονται ΚΑΙ ΟΙ ΔΥΟ στη βόρεια ακτή της Κρήτης. Το
        facingDeg είναι ο προσανατολισμός της ΑΚΡΟΓΙΑΛΙΑΣ, όχι η πλευρά του νησιού — ένας
        κόλπος στη βόρεια ακτή μπορεί κάλλιστα να κοιτάει νότια. Ο κριτής είπε 0,002 μ.
        διαφορά, που ήταν η ΣΩΣΤΗ απάντηση: είναι το ίδιο νερό.

    Άρα τώρα απαιτούνται τρία πράγματα μαζί: αιγαιακή περιοχή (εκεί υπάρχει μελτέμι), η
    προσήνεμη στο ΒΟΡΕΙΟ μισό του νησιού, η υπήνεμη στο ΝΟΤΙΟ. Ο προσανατολισμός μόνος του
    δεν αρκεί για να πει κανείς σε ποια σκιά κάθεται μια παραλία.
    """
    islands = {}
    for beach in load_beaches(include_mainland=False):
        if not is_aegean(beach):
            continue
        key = beach.get("island") or beach["regionFile"]
        islands.setdefault(key, []).append(beach)

    pairs = []
    for island, beaches in islands.items():
        centre_lat = sum(b["lat"] for b in beaches) / len(beaches)
        # «Βόρειο/νότιο μισό» ως προς το κέντρο ΤΟΥ ΙΔΙΟΥ του νησιού, με ζώνη ανοχής ώστε
        # οι παραλίες γύρω από το κέντρο —που δεν είναι ούτε στη μία ούτε στην άλλη σκιά—
        # να μη μετρήσουν καθόλου.
        span = max(b["lat"] for b in beaches) - min(b["lat"] for b in beaches)
        margin = max(0.02, span * 0.15)
        windward = [b for b in beaches
                    if in_arc(b.get("facingDeg"), WINDWARD_FACING) and b["lat"] > centre_lat + margin]
        leeward = [b for b in beaches
                   if in_arc(b.get("facingDeg"), LEEWARD_FACING) and b["lat"] < centre_lat - margin]
        if not windward or not leeward:
            continue
        best = None
        for w in windward:
            for l in leeward:
                d = haversine_km(w["lat"], w["lon"], l["lat"], l["lon"])
                if not (PAIR_MIN_KM <= d <= PAIR_MAX_KM):
                    continue
                # Το ΠΙΟ ΚΟΝΤΙΝΟ αποδεκτό ζεύγος είναι το αυστηρότερο τεστ: όσο πιο κοντά
                # οι δύο παραλίες, τόσο λιγότερα πράγματα πέρα από τον προσανατολισμό
                # μπορούν να εξηγήσουν τη διαφορά.
                if best is None or d < best[0]:
                    best = (d, w, l)
        if best is None:
            continue
        distance, w, l = best
        centre_lon = sum(b["lon"] for b in beaches) / len(beaches)
        pairs.append({
            "island": island, "beaches": len(beaches),
            "separation_km": round(distance, 1),
            "centre": {"lat": centre_lat, "lon": centre_lon},
            "windward": w, "leeward": l,
        })

    pairs.sort(key=lambda p: p["beaches"], reverse=True)
    return pairs[:limit]


def copernicus_series(dataset, index, points, start_dt, end_dt):
    """
    {point_key: {iso_hour: metres}} από το πλέγμα 4,2 χλμ., ΟΛΑ ΤΑ ΣΗΜΕΙΑ ΜΕ ΜΙΑ ΦΟΡΤΩΣΗ.

    Το «με μια φόρτωση» είναι όλη η ουσία, όχι κομψότητα. Τα κομμάτια του συνόλου είναι
    200 ώρες × ΟΛΟΚΛΗΡΗ Η ΜΕΣΟΓΕΙΟΣ, οπότε ΚΑΘΕ ξεχωριστό .load() ενός σημείου κατεβάζει
    ξανά ολόκληρο τον χάρτη — μετρήθηκε 31/07/2026 στα 187 δευτερόλεπτα ανά τρεις ημέρες.
    Η πρώτη έκδοση ζητούσε ένα σημείο τη φορά μέσα σε βρόχο νησιών και θα χρειαζόταν ~7
    ώρες για 8 νησιά· η ίδια δουλειά με ένα διανυσματικό sel κατεβάζει τα ίδια κομμάτια
    μία φορά. Δεν είναι μικροβελτιστοποίηση, είναι η διαφορά ανάμεσα σε «τρέχει» και «δεν».
    """
    import numpy as np
    import xarray as xr

    cells, keys, lats, lons = {}, [], [], []
    for key, (lat, lon) in points.items():
        cell = index.nearest(lat, lon)
        if cell is None:
            log(f"      ✗ {key}: κανένα θαλάσσιο κελί σε 25 χλμ.")
            continue
        cell_lat, cell_lon, distance = cell
        cells[key] = {"lat": cell_lat, "lon": cell_lon, "distance_km": round(distance, 1)}
        keys.append(key)
        lats.append(cell_lat)
        lons.append(cell_lon)
    if not keys:
        return {}, cells

    # Το slice παίρνει ΣΥΜΒΟΛΟΣΕΙΡΕΣ, όχι datetime με ζώνη ώρας: ο άξονας χρόνου του
    # συνόλου είναι tz-naive και η σύγκριση με tz-aware αντικείμενο πετάει TypeError.
    picked = dataset["VHM0"].sel(
        time=slice(start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")),
    ).sel(
        latitude=xr.DataArray(lats, dims="point"),
        longitude=xr.DataArray(lons, dims="point"),
        method="nearest",
    ).load()

    stamps = [str(t)[:13] + ":00" for t in picked["time"].values]
    values = np.asarray(picked.values, dtype="float64")   # (time, point)
    out = {}
    for i, key in enumerate(keys):
        column = values[:, i]
        out[key] = {s: float(v) for s, v in zip(stamps, column) if np.isfinite(v)}
    return out, cells


def rmse(pairs):
    return math.sqrt(sum((a - b) ** 2 for a, b in pairs) / len(pairs)) if pairs else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2025-07-01", help="YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=31)
    parser.add_argument("--islands", type=int, default=12)
    args = parser.parse_args()

    start_dt = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=args.days)
    start_s, end_s = start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    pairs = pick_island_pairs(args.islands)
    if not pairs:
        log("Κανένα νησί δεν έχει ζεύγος βόρειας/νότιας παραλίας με επαρκή απόσταση.")
        return 1

    log(f"Παράθυρο: {start_s} → {end_s}")
    log(f"Νησιά: {len(pairs)} — {', '.join(p['island'] for p in pairs)}\n")

    log("Άνοιγμα του πλέγματος Copernicus 4,2 χλμ. …")
    dataset = open_dataset(DATASET_ID)
    index = SeaCellIndex(dataset, "VHM0", bbox=GREECE_BBOX)
    log(f"  μάσκα θάλασσας: {int(index.sea.sum())} κελιά στο ελληνικό παράθυρο")

    # ΟΛΑ τα σημεία όλων των νησιών σε ΜΙΑ φόρτωση — δες copernicus_series για το γιατί
    # αυτό δεν είναι στιλιστική επιλογή αλλά η διαφορά ανάμεσα σε λεπτά και ώρες.
    all_points = {}
    for pair in pairs:
        all_points[f"{pair['island']}|windward"] = (pair["windward"]["lat"], pair["windward"]["lon"])
        all_points[f"{pair['island']}|leeward"] = (pair["leeward"]["lat"], pair["leeward"]["lon"])
    log(f"  κατέβασμα {len(all_points)} σημείων × {args.days} ημέρες σε μία κίνηση …")
    judge, judge_cells = copernicus_series(dataset, index, all_points, start_dt, end_dt)
    log(f"  {sum(len(v) for v in judge.values())} ωριαίες τιμές κριτή\n")

    # Στατιστικά που συλλέγονται σε όλα τα νησιά.
    contrast = {"copernicus": [], "ewam": [], "meteofrance_wave": []}
    correct_sign = {"copernicus": [0, 0], "ewam": [0, 0], "meteofrance_wave": [0, 0]}
    lee_error = {"ewam": [], "meteofrance_wave": []}   # (μοντέλο − κριτής) στην υπήνεμη
    lee_rmse_pairs = {"ewam": [], "meteofrance_wave": []}
    per_island = []

    for pair in pairs:
        island = pair["island"]
        log(f"── {island}  ({pair['beaches']} παραλίες, ζεύγος {pair['separation_km']} χλμ.)")
        log(f"     προσήνεμη {pair['windward']['name']} {pair['windward']['facingDeg']:.0f}° · "
            f"υπήνεμη {pair['leeward']['name']} {pair['leeward']['facingDeg']:.0f}°")

        points = {
            "windward": (pair["windward"]["lat"], pair["windward"]["lon"]),
            "leeward": (pair["leeward"]["lat"], pair["leeward"]["lon"]),
        }
        cop = {side: judge.get(f"{island}|{side}") for side in ("windward", "leeward")}
        cells = {side: judge_cells.get(f"{island}|{side}") for side in ("windward", "leeward")}
        if not cop["windward"] or not cop["leeward"]:
            log("     ✗ λείπει κελί για μία από τις δύο ακτές\n")
            continue
        # Αν οι δύο παραλίες έπεσαν στο ΙΔΙΟ κελί, η σύγκριση είναι κενή από κατασκευή.
        if cells["windward"] == cells["leeward"]:
            log("     ✗ και οι δύο ακτές στο ίδιο κελί 4,2 χλμ. — παραλείπεται\n")
            continue

        winds = open_meteo_wind(pair["centre"]["lat"], pair["centre"]["lon"], start_s, end_s)
        meltemi = {
            h for h, w in winds.items()
            if w["bft"] >= MELTEMI_MIN_BEAUFORT and in_arc(w["deg"], MELTEMI_DIRECTION)
        }
        if len(meltemi) < 24:
            log(f"     ✗ μόνο {len(meltemi)} ώρες μελτεμιού στο παράθυρο — παραλείπεται\n")
            continue

        om = {}
        for side in ("windward", "leeward"):
            lat, lon = points[side]
            for model in OPEN_METEO_MODELS:
                try:
                    om[(side, model)] = open_meteo_waves(lat, lon, start_s, end_s, model)
                except Exception as exc:  # noqa: BLE001
                    log(f"     ! {side}/{model}: {exc.__class__.__name__}")
                    om[(side, model)] = {}

        entry = {"island": island, "separation_km": pair["separation_km"],
                 "meltemi_hours": len(meltemi), "cells": cells,
                 "windward_beach": pair["windward"]["name"],
                 "leeward_beach": pair["leeward"]["name"], "models": {}}

        sources = {
            "copernicus": {"windward": cop["windward"], "leeward": cop["leeward"]},
            "ewam": {"windward": om[("windward", "ewam")], "leeward": om[("leeward", "ewam")]},
            "meteofrance_wave": {"windward": om[("windward", "meteofrance_wave")],
                                 "leeward": om[("leeward", "meteofrance_wave")]},
        }

        for name, side_series in sources.items():
            deltas = []
            for hour in meltemi:
                w = side_series["windward"].get(hour)
                l = side_series["leeward"].get(hour)
                if w is None or l is None:
                    continue
                deltas.append(w - l)
                correct_sign[name][1] += 1
                if w > l:
                    correct_sign[name][0] += 1
            contrast[name].extend(deltas)
            entry["models"][name] = {
                "n": len(deltas),
                "mean_contrast_m": round(sum(deltas) / len(deltas), 3) if deltas else None,
            }
            mean = entry["models"][name]["mean_contrast_m"]
            log(f"     {name:17} n={len(deltas):4}  διαφορά ακτών {mean if mean is not None else '—'} μ")

        # Η ίδια η επικίνδυνη σύγκριση: υπήνεμη ακτή, μοντέλο έναντι κριτή.
        for model in OPEN_METEO_MODELS:
            errs, prs = [], []
            for hour in meltemi:
                # ΟΧΙ `judge` εδώ: αυτό το όνομα κρατά το λεξικό ΟΛΩΝ των σημείων που
                # κατέβηκε μία φορά παραπάνω. Η επανάχρησή του για μία τιμή το έσβηνε στην
                # πρώτη επανάληψη και το δεύτερο νησί έσκαγε με 'float' has no attribute
                # 'get' — αφού είχε ήδη κατέβει όλο το ακριβό κομμάτι.
                judged_m = cop["leeward"].get(hour)
                pred = sources[model]["leeward"].get(hour)
                if judged_m is None or pred is None:
                    continue
                errs.append(pred - judged_m)
                prs.append((pred, judged_m))
            lee_error[model].extend(errs)
            lee_rmse_pairs[model].extend(prs)
            if errs:
                mean_err = sum(errs) / len(errs)
                entry["models"][model]["lee_vs_copernicus_mean_m"] = round(mean_err, 3)
                log(f"     {model:17} υπήνεμη vs κριτής: {mean_err:+.2f} μ  RMSE {rmse(prs):.2f} μ")

        per_island.append(entry)
        log("")

    if not per_island:
        log("Κανένα νησί δεν παρήγαγε συγκρίσιμα δεδομένα.")
        return 1

    def mean(values):
        return sum(values) / len(values) if values else None

    cop_contrast = mean(contrast["copernicus"])
    sign_hits, sign_total = correct_sign["copernicus"]
    sign_ratio = sign_hits / sign_total if sign_total else 0.0
    lee_mean_ewam = mean(lee_error["ewam"])
    severe = [e for e in lee_error["ewam"] if e < -GATES["severe_underestimate_m"]]
    severe_ratio = len(severe) / len(lee_error["ewam"]) if lee_error["ewam"] else 1.0
    rmse_ewam = rmse(lee_rmse_pairs["ewam"])
    rmse_prev = rmse(lee_rmse_pairs["meteofrance_wave"])

    gate_a = cop_contrast is not None and cop_contrast >= GATES["min_copernicus_contrast_m"]
    gate_b = sign_ratio >= GATES["min_correct_sign_ratio"]
    gate_c = (lee_mean_ewam is not None
              and lee_mean_ewam > -GATES["max_lee_mean_underestimate_m"]
              and severe_ratio <= GATES["max_severe_underestimate_ratio"])
    gate_d = (rmse_ewam is not None and rmse_prev is not None and rmse_ewam < rmse_prev)

    verdict = {
        "passed": bool(gate_a and gate_b and gate_c and gate_d),
        "gates": {
            "copernicus_sees_a_real_lee_shore_difference": {
                "pass": gate_a, "mean_contrast_m": round(cop_contrast, 3) if cop_contrast else None,
                "threshold_m": GATES["min_copernicus_contrast_m"]},
            "difference_has_the_right_sign": {
                "pass": gate_b, "ratio": round(sign_ratio, 3),
                "threshold": GATES["min_correct_sign_ratio"], "n": sign_total},
            "ewam_does_not_under_read_the_lee_shore": {
                "pass": gate_c,
                "mean_error_m": round(lee_mean_ewam, 3) if lee_mean_ewam is not None else None,
                "severe_ratio": round(severe_ratio, 4),
                "severe_incidents": len(severe), "n": len(lee_error["ewam"])},
            "ewam_closer_to_the_judge_than_the_model_it_replaced": {
                "pass": gate_d,
                "ewam_rmse_m": round(rmse_ewam, 3) if rmse_ewam else None,
                "previous_rmse_m": round(rmse_prev, 3) if rmse_prev else None},
        },
    }

    out = write_report("reports/wave-model/lee-shore-copernicus.json", {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "window": {"start": start_s, "end": end_s},
        "judge_dataset": DATASET_ID,
        "gates": GATES,
        "per_island": per_island,
        "summary": {
            "mean_lee_shore_contrast_m": {
                k: round(mean(v), 3) for k, v in contrast.items() if v},
            "correct_sign_ratio": {
                k: round(v[0] / v[1], 3) for k, v in correct_sign.items() if v[1]},
            "lee_shore_error_vs_copernicus_m": {
                k: round(mean(v), 3) for k, v in lee_error.items() if v},
            "lee_shore_rmse_vs_copernicus_m": {
                "ewam": round(rmse_ewam, 3) if rmse_ewam else None,
                "meteofrance_wave": round(rmse_prev, 3) if rmse_prev else None},
        },
        "verdict": verdict,
    })

    log("═" * 76)
    log("ΔΙΑΦΟΡΑ ΠΡΟΣΗΝΕΜΗΣ ↔ ΥΠΗΝΕΜΗΣ ΑΚΤΗΣ, σε μελτέμι:")
    for name in ("copernicus", "ewam", "meteofrance_wave"):
        m = mean(contrast[name])
        if m is not None:
            hits, total = correct_sign[name]
            log(f"  {name:17} {m:+.2f} μ   σωστή φορά {100*hits/total:.0f}%  (n={total})")
    log("")
    log("ΥΠΗΝΕΜΗ ΑΚΤΗ — απόκλιση από τον ανεξάρτητο κριτή (4,2 χλμ.):")
    for model in OPEN_METEO_MODELS:
        m = mean(lee_error[model])
        if m is not None:
            log(f"  {model:17} {m:+.2f} μ   RMSE "
                f"{rmse(lee_rmse_pairs[model]):.2f} μ  (n={len(lee_error[model])})")
    log("")
    for key, gate in verdict["gates"].items():
        log(f"  {'✓' if gate['pass'] else '✗'} {key}")
    log("")
    log("ΕΤΥΜΗΓΟΡΙΑ: " + ("ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ — η αλλαγή σε ewam στέκει σε ανεξάρτητη πηγή."
                          if verdict["passed"] else
                          "ΔΕΝ ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ — δες ποια πύλη έπεσε πριν μείνει σε παραγωγή."))
    log(f"Αναφορά: {out.relative_to(out.parents[2])}")
    return 0 if verdict["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
