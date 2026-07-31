"""
ΟΤΑΝ ΛΕΜΕ «ΠΡΟΣΤΑΤΕΥΜΕΝΗ», ΕΙΝΑΙ ΟΝΤΩΣ ΠΙΟ ΑΠΑΝΕΜΗ ΕΚΕΙ;

Το πιο ακριβό λάθος που μπορεί να κάνει αυτή η εφαρμογή δεν είναι να πει «κύμα» εκεί που
έχει γαλήνη. Είναι το αντίστροφο: να στείλει οικογένεια σε παραλία που ονομάζουμε
προστατευμένη και να τη βρει ριπή 6 μποφόρ. Ο άνεμος που τροφοδοτεί κάθε χρώμα και κάθε
ετυμηγορία έρχεται από πλέγμα 7-25 χλμ. — σε τέτοια ανάλυση ένα βουνό 800 μέτρων είναι μια
ήπια εξόγκωση, και η καταβατική ριπή που κατεβαίνει την υπήνεμη πλαγιά του δεν υπάρχει.

Το ερώτημα δοκιμάστηκε ήδη μία φορά, με μοντέλο ορίζοντα από ψηφιακό μοντέλο εδάφους, και
ΑΠΟΡΡΙΦΘΗΚΕ επειδή η μέτρηση δεν το στήριξε (docs/team, DEM horizon model). Εκείνο ήταν
δικός μας υπολογισμός που προσπαθούσε να μαντέψει τη φυσική. Αυτό εδώ είναι ΜΕΤΡΗΣΗ:
ραντάρ Sentinel-1 από δορυφόρο, ανάλυση 0,01° (~1 χλμ.), δηλαδή 7-25 φορές πυκνότερο από
ό,τι βλέπει η εφαρμογή σήμερα.

ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ: το SAR μετράει την τραχύτητα της θάλασσας και τη μεταφράζει σε
άνεμο 10 μέτρων. Είναι μέτρηση, όχι μοντέλο — αλλά περνάει 1-2 φορές την ημέρα και μόνο
όπου έτυχε να περάσει ο δορυφόρος. ΔΕΝ γίνεται ποτέ πηγή πρόγνωσης. Είναι όργανο για ΕΝΑ
ερώτημα: υπάρχει συστηματικό κενό εκεί που λέμε «προστατευμένη»;

ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΔΕΝ ΑΛΛΑΖΕΙ ΚΩΔΙΚΑ ΜΟΝΟ ΤΟΥ. Αν βρεθεί κενό, το επόμενο βήμα είναι σχέδιο
με πύλες, όχι διόρθωση επί τόπου — ακριβώς όπως έγινε με το μοντέλο κύματος.

ΧΡΗΣΗ
  set CMEMS_USER=... και CMEMS_PASS=...
  python scripts/auditShelteredWindAgainstSar.py [--days 120] [--max-beaches 150]

ΕΞΟΔΟΣ  reports/wind-model/sheltered-vs-sar.json
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import numpy as np

from copernicusCommon import (  # noqa: E402
    GREECE_BBOX, beaufort, load_beaches, open_dataset, write_report,
)

# Τέσσερα σύνολα: δύο δορυφόροι × ανερχόμενη/κατερχόμενη τροχιά. Χρειάζονται και τα
# τέσσερα — το καθένα μόνο του αφήνει τεράστια κενά στον χάρτη και στο ημερολόγιο.
SAR_DATASETS = [
    "cmems_obs-wind_med_phy_nrt_l3-s1a-sar-asc-0.01deg_P1D-i",
    "cmems_obs-wind_med_phy_nrt_l3-s1a-sar-desc-0.01deg_P1D-i",
    "cmems_obs-wind_med_phy_nrt_l3-s1c-sar-asc-0.01deg_P1D-i",
    "cmems_obs-wind_med_phy_nrt_l3-s1c-sar-desc-0.01deg_P1D-i",
]
WIND_VARIABLE_CANDIDATES = ("wind_speed", "wind_speed_10m", "sar_wind_speed", "WIND_SPEED")

# Πόσο πάνω από το μοντέλο πρέπει να μετρήσει ο δορυφόρος για να θεωρηθεί «κενό». 1,5 m/s
# είναι περίπου ένα μποφόρ στη μέση κλίμακα — κάτω από αυτό είναι θόρυβος μοντέλου, πάνω
# από αυτό αλλάζει τη λέξη που διαβάζει ο χρήστης.
GAP_THRESHOLD_MS = 1.5

UA = {"User-Agent": "calmbeach-sar-audit/1.0 (+https://calmbeach.gr)"}


def log(msg):
    print(msg, flush=True)


def fetch_json(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))
    return None


def model_wind(lat, lon, start, end):
    """Ο άνεμος που ΒΛΕΠΕΙ Η ΕΦΑΡΜΟΓΗ — ίδιο endpoint, ίδιο προεπιλεγμένο μοντέλο."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "hourly": "wind_speed_10m,wind_direction_10m",
        "start_date": start, "end_date": end, "timezone": "UTC",
        "wind_speed_unit": "ms",
    })
    data = fetch_json(f"https://archive-api.open-meteo.com/v1/archive?{q}")
    hourly = data.get("hourly") or {}
    out = {}
    for t, s, d in zip(hourly.get("time", []), hourly.get("wind_speed_10m") or [],
                       hourly.get("wind_direction_10m") or []):
        if s is not None:
            out[t[:10]] = {"ms": s, "deg": d}
    return out


def find_variable(dataset):
    for name in WIND_VARIABLE_CANDIDATES:
        if name in dataset:
            return name
    candidates = [v for v in map(str, dataset.data_vars) if "wind" in v.lower()]
    return candidates[0] if candidates else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=120)
    parser.add_argument("--max-beaches", type=int, default=150)
    args = parser.parse_args()

    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=args.days)
    start_s, end_s = start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    # Ο πληθυσμός που μας νοιάζει: παραλίες που ΕΜΕΙΣ ονομάζουμε υπήνεμες. Αν το κενό
    # υπάρχει, εκεί κάνει ζημιά — σε εκτεθειμένη παραλία λέμε ήδη «φυσάει».
    beaches = [b for b in load_beaches() if b.get("facingDeg") is not None]
    sheltered = [b for b in beaches if 135 <= b["facingDeg"] <= 225][:args.max_beaches]
    log(f"Παραλίες που κοιτούν νότο (υπήνεμες στο μελτέμι): {len(sheltered)}")
    log(f"Παράθυρο: {start_s} → {end_s}\n")

    samples = []
    for dataset_id in SAR_DATASETS:
        log(f"── {dataset_id.split('_l3-')[1]}")
        try:
            dataset = open_dataset(dataset_id)
        except Exception as exc:  # noqa: BLE001
            log(f"   ✗ {exc.__class__.__name__}: {str(exc)[:120]}")
            continue
        variable = find_variable(dataset)
        if not variable:
            log(f"   ✗ καμία μεταβλητή ανέμου· υπάρχουν: {list(map(str, dataset.data_vars))[:6]}")
            continue
        try:
            window = dataset[variable].sel(
                time=slice(start_s, end_s),
                latitude=slice(GREECE_BBOX["lat_min"], GREECE_BBOX["lat_max"]),
                longitude=slice(GREECE_BBOX["lon_min"], GREECE_BBOX["lon_max"]),
            ).load()
        except Exception as exc:  # noqa: BLE001
            log(f"   ✗ {exc.__class__.__name__}: {str(exc)[:120]}")
            continue

        values = np.asarray(window.values, dtype="float64")
        finite = int(np.isfinite(values).sum())
        log(f"   {window['time'].size} ημέρες, {finite} έγκυρα σημεία στο ελληνικό παράθυρο")
        if finite == 0:
            continue

        lats = np.asarray(window["latitude"].values, dtype="float64")
        lons = np.asarray(window["longitude"].values, dtype="float64")
        days = [str(t)[:10] for t in window["time"].values]

        for beach in sheltered:
            i = int(np.abs(lats - beach["lat"]).argmin())
            j = int(np.abs(lons - beach["lon"]).argmin())
            # Παράθυρο 3×3 κελιών (~3 χλμ.): το ακριβές κελί της ακτής είναι συχνά κενό
            # γιατί το ραντάρ δεν διαβάζει πάνω στη στεριά.
            block = values[:, max(0, i - 1):i + 2, max(0, j - 1):j + 2]
            for d, day in enumerate(days):
                cell = block[d]
                good = cell[np.isfinite(cell)]
                if good.size == 0:
                    continue
                samples.append({"beach": beach["name"], "id": beach["id"],
                                "lat": beach["lat"], "lon": beach["lon"],
                                "island": beach.get("island"), "day": day,
                                "sar_ms": float(np.median(good))})
        log("")

    if not samples:
        log("Κανένα δορυφορικό πέρασμα πάνω από τις παραλίες αυτές στο παράθυρο.")
        log("Αυτό είναι αποτέλεσμα, όχι σφάλμα: το SAR δεν έχει την κάλυψη για τακτικό έλεγχο.")
        write_report("reports/wind-model/sheltered-vs-sar.json", {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "window": [start_s, end_s], "samples": 0,
            "conclusion": "no SAR coverage over the sampled beaches in this window",
        })
        return 0

    log(f"{len(samples)} δορυφορικές μετρήσεις πάνω από υπήνεμες παραλίες.\n")

    # Το μοντέλο, μόνο για τις παραλίες που όντως έχουν μέτρηση.
    by_beach = {}
    for sample in samples:
        by_beach.setdefault(sample["id"], []).append(sample)

    compared, gaps = [], []
    for beach_id, beach_samples in by_beach.items():
        first = beach_samples[0]
        try:
            model = model_wind(first["lat"], first["lon"], start_s, end_s)
        except Exception:  # noqa: BLE001
            continue
        for sample in beach_samples:
            reference = model.get(sample["day"])
            if not reference:
                continue
            delta = sample["sar_ms"] - reference["ms"]
            row = {"beach": sample["beach"], "island": sample["island"], "day": sample["day"],
                   "sar_ms": round(sample["sar_ms"], 1), "model_ms": round(reference["ms"], 1),
                   "delta_ms": round(delta, 1),
                   "model_bft": beaufort(reference["ms"] * 3.6),
                   "sar_bft": beaufort(sample["sar_ms"] * 3.6)}
            compared.append(row)
            if delta > GAP_THRESHOLD_MS:
                gaps.append(row)

    if not compared:
        log("Καμία ημέρα με ΚΑΙ δορυφορική μέτρηση ΚΑΙ τιμή μοντέλου.")
        return 0

    deltas = np.array([r["delta_ms"] for r in compared])
    bft_disagree = [r for r in compared if r["sar_bft"] is not None
                    and r["model_bft"] is not None and r["sar_bft"] > r["model_bft"]]

    out = write_report("reports/wind-model/sheltered-vs-sar.json", {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "window": [start_s, end_s],
        "gap_threshold_ms": GAP_THRESHOLD_MS,
        "samples": len(compared),
        "beaches": len(by_beach),
        "summary": {
            "mean_delta_ms": round(float(deltas.mean()), 2),
            "median_delta_ms": round(float(np.median(deltas)), 2),
            "p90_delta_ms": round(float(np.percentile(deltas, 90)), 2),
            "gap_incidents": len(gaps),
            "gap_ratio": round(len(gaps) / len(compared), 3),
            "beaufort_underread": len(bft_disagree),
        },
        "worst": sorted(gaps, key=lambda r: -r["delta_ms"])[:40],
        "limits": (
            "SAR passes 1-2x/day where the satellite happened to look, so this is a sample, "
            "never a forecast source. A positive mean delta means the model under-reads the "
            "wind at south-facing (leeward) beaches."
        ),
    })

    log("═" * 72)
    log(f"Δείγμα: {len(compared)} μετρήσεις σε {len(by_beach)} υπήνεμες παραλίες")
    log(f"Δορυφόρος − μοντέλο:  μέσο {deltas.mean():+.2f} m/s   "
        f"διάμεσος {np.median(deltas):+.2f}   90ό εκατοστημόριο {np.percentile(deltas, 90):+.2f}")
    log(f"Πάνω από το κατώφλι κενού ({GAP_THRESHOLD_MS} m/s): "
        f"{len(gaps)} / {len(compared)} ({100*len(gaps)/len(compared):.0f}%)")
    log(f"Ολόκληρο μποφόρ πιο δυνατά απ' ό,τι λέμε: {len(bft_disagree)} μετρήσεις")
    log("")
    if deltas.mean() > GAP_THRESHOLD_MS:
        log("ΕΥΡΗΜΑ: το μοντέλο ΥΠΟΕΚΤΙΜΑ συστηματικά τον άνεμο στις υπήνεμες παραλίες.")
        log("        Χρειάζεται σχέδιο με πύλες — όχι διόρθωση επί τόπου.")
    elif len(gaps) / len(compared) > 0.25:
        log("ΕΥΡΗΜΑ: όχι συστηματικό, αλλά υπάρχει ουρά περιπτώσεων που αξίζει να δει κανείς.")
    else:
        log("ΕΥΡΗΜΑ: κανένα συστηματικό κενό. Ο άνεμος στις υπήνεμες παραλίες στέκει.")
    log(f"\nΑναφορά: {out.relative_to(out.parents[2])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
