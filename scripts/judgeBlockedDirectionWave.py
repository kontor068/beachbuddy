"""
Ο ΚΡΙΤΗΣ ΓΙΑ ΤΙΣ ΠΑΡΑΛΙΕΣ ΠΟΥ «ΔΕΙΧΝΟΥΝ ΚΥΜΑ ΧΩΡΙΣ ΔΡΟΜΟ».

Ρωτάει έναν ΔΕΥΤΕΡΟ, ανεξάρτητο κριτή — Copernicus MEDSEA (WAM, 4,2 χλμ., με αφομοίωση
δορυφορικών μετρήσεων, από το ΕΛΚΕΘΕ) — για τις ίδιες συντεταγμένες που ρωτάμε το ewam,
την ίδια ώρα.

ΓΙΑΤΙ ΕΧΕΙ ΝΟΗΜΑ ΕΔΩ, ενώ η βίβλος γράφει «δεν υπάρχει κριτής για ακτογραμμή»:
εκείνη η γραμμή αφορά **κλειστή ακτή με το βουνό από πάνω** — γεωμετρία μικρότερη από κάθε
κελί μοντέλου. Οι τρεις παραλίες εδώ έχουν **8-10 χλμ. στεριάς** πίσω τους, δηλαδή σκιά
ΜΕΓΑΛΥΤΕΡΗ από την κυψέλη του κριτή (4,2 χλμ.). Αυτό ένα μοντέλο μπορεί να το δει. Η ερώτηση
δεν είναι «πόσο κύμα έχει στην ακτή» — είναι «**συμφωνούν δύο ανεξάρτητα μοντέλα ότι εκεί
υπάρχει 1,5 μ.;**». Αν ο κριτής δώσει πολύ λιγότερο, το ewam σφάλλει σε αυτή τη γεωμετρία.

ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, δηλωμένο πριν το αποτέλεσμα: συμφωνία των δύο μοντέλων ΔΕΝ αποδεικνύει
ότι το νούμερο είναι σωστό στην ακτή — δύο μοντέλα με παρόμοια ανάλυση μπορούν να κάνουν το
ίδιο λάθος. Αποδεικνύει μόνο ότι δεν έχουμε λόγο να πειράξουμε το νούμερο. Διαφωνία, αντίθετα,
είναι πραγματικό σήμα.

ΟΙ ΜΑΡΤΥΡΕΣ ΕΛΕΓΧΟΥ δεν είναι διακόσμηση — χωρίς αυτούς δεν ξεχωρίζεις «ο κριτής βλέπει τη
σκιά» από «ο κριτής δίνει παντού χαμηλά νούμερα»:
  - Βούδια (η αφορμή, οριακή περίπτωση που ΔΕΝ πέρασε το κατώφλι)
  - δύο από τις 41 «λεπτή στεριά», όπου περιμένουμε ΣΥΜΦΩΝΙΑ
  - ένα ανοιχτό σημείο, όπου περιμένουμε και τα δύο μοντέλα ψηλά

Run: python scripts/judgeBlockedDirectionWave.py
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import open_dataset, SeaCellIndex, haversine_km  # noqa: E402

DATASET = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
VARIABLE = "VHM0"  # significant wave height

# (ετικέτα, lat, lon, τι δείχνει το ewam, τι περιμένουμε)
TARGETS = [
    ("Μουτσούνα (Νάξος) — ΥΠΟΠΤΗ, 10,3χλμ στεριά", 37.0779637, 25.5869804, 1.58, "διαφωνία"),
    ("Φράγκου (Αγ. Ευστράτιος) — ΥΠΟΠΤΗ, 8,5χλμ", 39.48289, 24.97708, 0.72, "διαφωνία"),
    ("Άγ. Ιωάννης Ρίχτης (Αστυπάλαια) — ΥΠΟΠΤΗ, 8,3χλμ", 36.51427, 26.33823, 0.94, "διαφωνία"),
    ("Βούδια (Μήλος) — η αφορμή, οριακή", 36.74841, 24.53447, 0.68, "?"),
    ("Κέδρος (Δονούσα) — μάρτυρας, 1,8χλμ στεριά", 37.09766, 25.80371, 1.88, "συμφωνία"),
    ("Βίντζι (Άνδρος) — μάρτυρας, 5χλμ στεριά", 37.77874, 24.95557, 1.80, "συμφωνία"),
    ("ανοιχτό Αιγαίο ΒΑ Μήλου — μάρτυρας", 36.9000, 24.7000, None, "και τα δύο ψηλά"),
]


def main():
    print(f"άνοιγμα {DATASET} …")
    ds = open_dataset(DATASET)

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    times = ds["time"].values
    # Πλησιέστερο διαθέσιμο ωριαίο βήμα στο τώρα.
    import numpy as np
    target = np.datetime64(now.replace(tzinfo=None), "ns")
    t_idx = int(np.argmin(np.abs(times - target)))
    stamp = str(times[t_idx])[:16]
    print(f"χρονικό βήμα κριτή: {stamp} UTC (ζητήθηκε {now:%Y-%m-%d %H:%M} UTC)\n")

    index = SeaCellIndex(ds, VARIABLE, time_index=t_idx)
    field = ds[VARIABLE].isel(time=t_idx).load()

    rows = []
    print(f"{'παραλία':<48} {'ewam':>6} {'κριτής':>8} {'διαφορά':>9}  κελί")
    print("-" * 100)
    for label, lat, lon, ewam, expect in TARGETS:
        hit = index.nearest(lat, lon)
        if not hit:
            print(f"{label:<48} — καμία θαλάσσια κυψέλη σε 25 χλμ")
            continue
        clat, clon, dist = hit
        value = float(field.sel(latitude=clat, longitude=clon, method="nearest").values)
        delta = None if ewam is None else round(value - ewam, 2)
        rows.append({
            "label": label, "lat": lat, "lon": lon, "ewam_m": ewam,
            "copernicus_m": round(value, 2), "delta_m": delta,
            "cell": {"lat": round(clat, 4), "lon": round(clon, 4), "distance_km": round(dist, 2)},
            "expectation": expect,
        })
        e = "—" if ewam is None else f"{ewam:.2f}"
        d = "—" if delta is None else f"{delta:+.2f}"
        print(f"{label:<48} {e:>6} {value:>8.2f} {d:>9}  {dist:.1f}χλμ")

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "judge_dataset": DATASET,
        "judge_timestep_utc": stamp,
        "question": "Συμφωνεί ένας δεύτερος, ανεξάρτητος κριτής ότι υπάρχει αυτό το κύμα;",
        "caveat": "Συμφωνία δεν αποδεικνύει ορθότητα στην ακτή· διαφωνία είναι το σήμα.",
        "rows": rows,
    }
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                        "reports", "wave-model", "blocked-direction-judge.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
    print(f"\nΑναφορά: {os.path.normpath(path)}")


if __name__ == "__main__":
    main()
