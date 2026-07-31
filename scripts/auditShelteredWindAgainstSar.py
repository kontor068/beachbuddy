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

    # ── Η ΟΜΑΔΑ ΕΛΕΓΧΟΥ, ΚΑΙ ΧΩΡΙΣ ΑΥΤΗΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΔΕΝ ΣΗΜΑΙΝΕΙ ΤΙΠΟΤΑ ──────────
    #
    # Το SAR δεν μετράει άνεμο· μετράει την τραχύτητα της θάλασσας και τη ΜΕΤΑΦΡΑΖΕΙ σε
    # άνεμο 10 μέτρων. Κοντά στην ακτή αυτή η μετάφραση έχει δύο γνωστά προβλήματα: η
    # στεριά μολύνει το σήμα στα πρώτα κελιά, και σε πολύ ασθενή άνεμο ο αλγόριθμος έχει
    # κατώφλι και τείνει να υπερεκτιμά. Δηλαδή ένα «+2,6 m/s πάνω από το μοντέλο» σε
    # υπήνεμη παραλία μπορεί να είναι ΚΕΝΟ ΤΟΥ ΜΟΝΤΕΛΟΥ ή ΣΦΑΛΜΑ ΤΟΥ ΔΟΡΥΦΟΡΟΥ, και τα
    # δύο μοιάζουν ολόιδια στα νούμερα.
    #
    # Ο τρόπος να ξεχωρίσουν: μέτρα την ΙΔΙΑ διαφορά σε ανοιχτή θάλασσα, όπου καμία από
    # τις δύο παθογένειες δεν ισχύει. Αν το SAR διαβάζει +2,6 και εκεί, η μεροληψία είναι
    # του οργάνου και το «εύρημα» καταρρέει. Αν εκεί συμφωνεί με το μοντέλο, τότε το κενό
    # είναι πραγματικό και ακτογραμμικό.
    open_sea = [
        {"id": f"open-{i}", "name": f"ανοιχτά #{i}", "island": None, "lat": lat, "lon": lon}
        for i, (lat, lon) in enumerate([
            (36.20, 25.90), (37.10, 25.90), (38.20, 25.30), (35.20, 25.60), (39.30, 24.30),
            (36.80, 27.30), (37.90, 26.60), (35.60, 23.30), (38.60, 23.90), (36.40, 24.30),
        ], 1)
    ]
    log(f"Σημεία ανοιχτής θάλασσας (ομάδα ελέγχου): {len(open_sea)}")
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

        for group, points in (("sheltered", sheltered), ("open_sea", open_sea)):
            for beach in points:
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
                                    "group": group,
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
                   "group": sample["group"],
                   "sar_ms": round(sample["sar_ms"], 1), "model_ms": round(reference["ms"], 1),
                   "delta_ms": round(delta, 1),
                   "model_bft": beaufort(reference["ms"] * 3.6),
                   "sar_bft": beaufort(sample["sar_ms"] * 3.6)}
            compared.append(row)
            if delta > GAP_THRESHOLD_MS and sample["group"] == "sheltered":
                gaps.append(row)

    if not compared:
        log("Καμία ημέρα με ΚΑΙ δορυφορική μέτρηση ΚΑΙ τιμή μοντέλου.")
        return 0

    lee_rows = [r for r in compared if r["group"] == "sheltered"]
    sea_rows = [r for r in compared if r["group"] == "open_sea"]
    if not lee_rows:
        log("Καμία μέτρηση πάνω από υπήνεμη παραλία.")
        return 0
    deltas = np.array([r["delta_ms"] for r in lee_rows])
    sea_deltas = np.array([r["delta_ms"] for r in sea_rows]) if sea_rows else np.array([])
    bft_disagree = [r for r in lee_rows if r["sar_bft"] is not None
                    and r["model_bft"] is not None and r["sar_bft"] > r["model_bft"]]

    # ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΚΡΙΝΕΙ: η υπήνεμη διαφορά ΜΕΙΟΝ η διαφορά ανοιχτής θάλασσας. Ό,τι
    # εμφανίζεται και στα ανοιχτά είναι μεροληψία του οργάνου, όχι κενό του μοντέλου.
    #
    # ΚΑΙ ΜΕ ΤΟΝ ΙΔΙΟ ΑΝΕΜΟ, ΑΛΛΙΩΣ Η ΣΥΓΚΡΙΣΗ ΕΙΝΑΙ ΑΚΥΡΗ. Η πρώτη έκδοση σύγκρινε
    # «υπήνεμη ακτή» (μοντέλο 0,5-2,7 m/s) με «ανοιχτή θάλασσα» (μοντέλο πολύ ψηλότερα)
    # και έβγαλε +2,57 m/s «κενό». Αλλάζουν όμως ΔΥΟ πράγματα ταυτόχρονα — θέση ΚΑΙ ένταση
    # — και το SAR έχει γνωστό κατώφλι ανίχνευσης σε ασθενή άνεμο: κάτω από ~3 m/s η
    # θάλασσα δεν είναι αρκετά τραχιά για να μετρηθεί και ο αλγόριθμος βγάζει πάτωμα.
    # Άρα το ίδιο νούμερο ξαναβγαίνει στρωματοποιημένο: ίδια ζώνη έντασης, δύο θέσεις.
    def mean_delta(rows, lo, hi):
        vals = [r["delta_ms"] for r in rows if lo <= r["model_ms"] < hi]
        return (round(sum(vals) / len(vals), 2), len(vals)) if vals else (None, 0)

    BANDS = ((0.0, 3.0, "ασθενής <3"), (3.0, 6.0, "μέτριος 3-6"), (6.0, 99.0, "δυνατός >6"))
    stratified = {}
    for lo, hi, label in BANDS:
        lee_mean, lee_n = mean_delta(lee_rows, lo, hi)
        sea_mean, sea_n = mean_delta(sea_rows, lo, hi)
        stratified[label] = {
            "lee_mean_delta_ms": lee_mean, "lee_n": lee_n,
            "open_sea_mean_delta_ms": sea_mean, "open_sea_n": sea_n,
            "excess_ms": (round(lee_mean - sea_mean, 2)
                          if lee_mean is not None and sea_mean is not None else None),
        }

    instrument_bias = float(sea_deltas.mean()) if sea_deltas.size else None
    excess = float(deltas.mean() - instrument_bias) if instrument_bias is not None else None

    out = write_report("reports/wind-model/sheltered-vs-sar.json", {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "window": [start_s, end_s],
        "gap_threshold_ms": GAP_THRESHOLD_MS,
        "samples": len(lee_rows),
        "control_samples": len(sea_rows),
        "beaches": len(by_beach),
        "summary": {
            "mean_delta_ms": round(float(deltas.mean()), 2),
            "median_delta_ms": round(float(np.median(deltas)), 2),
            "p90_delta_ms": round(float(np.percentile(deltas, 90)), 2),
            "open_sea_mean_delta_ms": round(instrument_bias, 2) if instrument_bias is not None else None,
            "excess_over_instrument_bias_ms": round(excess, 2) if excess is not None else None,
            "stratified_by_model_wind": stratified,
            "gap_incidents": len(gaps),
            "gap_ratio": round(len(gaps) / len(lee_rows), 3),
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
    log(f"ΥΠΗΝΕΜΕΣ ΠΑΡΑΛΙΕΣ: {len(lee_rows)} μετρήσεις")
    log(f"  δορυφόρος − μοντέλο:  μέσο {deltas.mean():+.2f} m/s   "
        f"διάμεσος {np.median(deltas):+.2f}   90ό εκατ. {np.percentile(deltas, 90):+.2f}")
    log(f"  ολόκληρο μποφόρ πιο δυνατά απ' ό,τι λέμε: {len(bft_disagree)}/{len(lee_rows)}")
    if sea_rows:
        log(f"ΑΝΟΙΧΤΗ ΘΑΛΑΣΣΑ (ομάδα ελέγχου): {len(sea_rows)} μετρήσεις")
        log(f"  δορυφόρος − μοντέλο:  μέσο {sea_deltas.mean():+.2f} m/s")
    log("")
    log("ΙΔΙΑ ΖΩΝΗ ΕΝΤΑΣΗΣ, ΔΥΟ ΘΕΣΕΙΣ (η μόνη δίκαιη σύγκριση):")
    for _, _, label in BANDS:
        st = stratified[label]
        if st["lee_n"] and st["open_sea_n"]:
            log(f"  {label:14} υπήνεμη {st['lee_mean_delta_ms']:+.2f} (n={st['lee_n']})  "
                f"ανοιχτά {st['open_sea_mean_delta_ms']:+.2f} (n={st['open_sea_n']})  "
                f"→ διαφορά {st['excess_ms']:+.2f} m/s")
        else:
            log(f"  {label:14} υπήνεμη n={st['lee_n']}, ανοιχτά n={st['open_sea_n']} "
                "— καμία σύγκριση")
    log("")
    # Η ΕΤΥΜΗΓΟΡΙΑ ΒΓΑΙΝΕΙ ΑΠΟ ΤΗ ΣΤΡΩΜΑΤΟΠΟΙΗΜΕΝΗ ΣΥΓΚΡΙΣΗ, ΟΧΙ ΤΗ ΧΟΝΔΡΙΚΗ.
    #
    # Η πρώτη έκδοση έκρινε από το `excess` (υπήνεμη μείον ανοιχτά, χωρίς εξίσωση έντασης)
    # και τύπωσε «ΕΥΡΗΜΑ: +2,57 m/s» — ενώ η ίδια της η δίκαιη σύγκριση έδειχνε +0,83 m/s
    # στη ζώνη που κρατά το 70% των δεδομένων. Ένα εργαλείο που τυπώνει συμπέρασμα το
    # οποίο τα δικά του νούμερα δεν στηρίζουν είναι χειρότερο από κανένα εργαλείο: κάποιος
    # θα διαβάσει τη γραμμή και όχι τον πίνακα.
    #
    # Κρίνει η ζώνη με ΤΑ ΠΕΡΙΣΣΟΤΕΡΑ δεδομένα και στις δύο πλευρές, με ελάχιστο 15 ανά
    # πλευρά. Ζώνη με 4 δείγματα δεν κρίνει τίποτα, όσο μεγάλο κι αν είναι το νούμερό της.
    MIN_PER_SIDE = 15
    usable = [(label, st) for label, st in stratified.items()
              if st["lee_n"] >= MIN_PER_SIDE and st["open_sea_n"] >= MIN_PER_SIDE
              and st["excess_ms"] is not None]
    usable.sort(key=lambda kv: -(kv[1]["lee_n"] + kv[1]["open_sea_n"]))

    if instrument_bias is None:
        log("ΑΚΡΙΤΟ: καμία μέτρηση ανοιχτής θάλασσας, άρα δεν ξεχωρίζει σφάλμα οργάνου")
        log("        από κενό μοντέλου. Το νούμερο των υπήνεμων ΜΟΝΟ ΤΟΥ δεν αποδεικνύει.")
    elif not usable:
        log(f"ΑΚΡΙΤΟ: καμία ζώνη έντασης δεν έχει ≥{MIN_PER_SIDE} μετρήσεις και στις δύο")
        log("        πλευρές. Η χονδρική διαφορά δεν αποδεικνύει τίποτα από μόνη της.")
    else:
        label, best = usable[0]
        verdict_excess = best["excess_ms"]
        log(f"Κρίνει η ζώνη «{label}» — {best['lee_n']} υπήνεμες vs {best['open_sea_n']} ανοιχτά.")
        if verdict_excess > GAP_THRESHOLD_MS:
            log(f"ΕΥΡΗΜΑ: με ίδια ένταση ανέμου, το μοντέλο υποεκτιμά στις υπήνεμες παραλίες")
            log(f"        κατά {verdict_excess:+.2f} m/s. Χρειάζεται σχέδιο με πύλες.")
        else:
            log(f"ΔΕΝ ΕΙΝΑΙ ΕΥΡΗΜΑ: με ίδια ένταση ανέμου η διαφορά είναι {verdict_excess:+.2f} m/s,")
            log(f"        κάτω από το κατώφλι των {GAP_THRESHOLD_MS} m/s. Η χονδρική διαφορά")
            log(f"        ({excess:+.2f}) ήταν σε μεγάλο βαθμό το κατώφλι ανίχνευσης του ίδιου")
            log("        του ραντάρ σε ασθενή άνεμο, όχι κενό του μοντέλου.")
    log(f"\nΑναφορά: {out.relative_to(out.parents[2])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
