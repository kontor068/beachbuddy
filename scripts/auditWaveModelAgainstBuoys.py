"""
ΠΟΙΟ ΜΟΝΤΕΛΟ ΚΥΜΑΤΟΣ ΛΕΕΙ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟ ΑΙΓΑΙΟ;

Συγκρίνει τα δύο υποψήφια μοντέλα με ΜΕΤΡΗΣΕΙΣ ΠΛΩΤΗΡΩΝ, όχι μεταξύ τους.

  meteofrance_wave  — τρέχει σήμερα στο calmbeach.gr, 0,08° (~8 χλμ.), 7 ημέρες
  ewam (DWD)        — 0,05° (~5 χλμ.), ~3,3 ημέρες, κενά σε Σαρωνικό/Ευβοϊκό

Γιατί υπάρχει αυτό το script (μετρήθηκε 31/07/2026):

  Σε 496 περιπτώσεις μελτεμιού, το μοντέλο που τρέχει σήμερα χωρίζει την προσήνεμη από την
  υπήνεμη ακτή του ίδιου νησιού κατά **0,05 μ.** — δηλαδή καθόλου, σε 290/496 περιπτώσεις.
  Το ewam τις χωρίζει κατά **1,11 μ.**, με σωστό πρόσημο 496/496. Με τα κατώφλια της
  εφαρμογής, στις υπήνεμες ακτές οι δύο διαφωνούν στην ετυμηγορία **92%** των ωρών, και στο
  **40%** λέμε σήμερα «ΑΠΟΦΥΓΗ» εκεί που το ewam λέει «εντάξει».

  Το ewam δίνει ΜΙΚΡΟΤΕΡΟΥΣ αριθμούς. Αυτή είναι η μία κατεύθυνση που μπορεί να βάλει
  άνθρωπο σε νερό που η εφαρμογή είπε επίπεδο — έχει ήδη συμβεί δύο φορές (545 και 694
  περιπτώσεις ψεύτικης νηνεμίας). Γι' αυτό δεν αλλάζει τίποτα χωρίς μέτρηση.

ΠΥΛΗ 1 ΕΧΕΙ ΗΔΗ ΠΕΡΑΣΕΙ, χωρίς πλωτήρα: σε 15 σημεία ανοιχτής θάλασσας >25 χλμ. από στεριά
(1.022 συγκρίσεις) τα δύο μοντέλα δίνουν 1,08 vs 1,07 μ. — απόκλιση **−0,5%**. Άρα το ewam
δεν είναι «χαμηλό μοντέλο»· η διαφορά στις ακτές είναι καθαρά θέμα ανάλυσης ακτογραμμής.
Αυτό το script κρίνει τις ΠΥΛΕΣ 2 και 3.

ΤΑ ΚΡΙΤΗΡΙΑ ΓΡΑΦΤΗΚΑΝ ΠΡΙΝ ΤΡΕΞΕΙ ΤΟ SCRIPT — δες GATES παρακάτω. Μην τα χαλαρώσεις αφού
δεις το αποτέλεσμα· αυτό είναι το μόνο πράγμα που κάνει αυτή τη μέτρηση να μετράει.

ΤΙΜΙΟ ΟΡΙΟ: οι πλωτήρες είναι σε ΑΝΟΙΧΤΟ νερό, όχι σε υπήνεμες ακτές. Άρα αποδεικνύουν ότι
το ewam είναι σωστά βαθμονομημένο — ΔΕΝ αποδεικνύουν άμεσα τον αριθμό της υπήνεμης ακτής.
Αυτόν τον στηρίζει η φυσική (fetch ~0 όταν ο αέρας φυσάει από τη στεριά) και η ανάλυση του
πλέγματος. Οι δύο μαζί αρκούν· καμία μόνη της δεν αρκεί.

ΧΡΗΣΗ
  1. Δωρεάν εγγραφή: https://data.marine.copernicus.eu/register
  2. set CMEMS_USER=...  και  set CMEMS_PASS=...      (ή τρέξε `copernicusmarine login` μία φορά)
  3. python scripts/auditWaveModelAgainstBuoys.py [--days 120]

ΕΞΟΔΟΣ  reports/wave-model/buoy-comparison.json  + ετυμηγορία στην οθόνη.
"""

import argparse
import json
import math
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "reports" / "wave-model"
DATASET_ID = "cmems_obs-ins_med_phybgcwav_mynrt_na_irr"

# Ελληνικοί πλωτήρες με ύψος κύματος (VHM0), από τον κατάλογο πλατφορμών του In Situ TAC
# (index_platform.txt, 83.518 εγγραφές, διαβάστηκε 31/07/2026). Σε ελληνικά νερά υπάρχουν
# 343 πλατφόρμες αλλά ΜΟΝΟ 14 μετράνε κύμα, και οι περισσότερες έχουν σταματήσει.
# Η ημερομηνία δίπλα είναι η τελευταία μέτρηση που δήλωνε ο κατάλογος.
BUOYS = [
    {"code": "HERAKLION",  "lat": 35.4342, "lon": 25.0792, "last": "2026-07-16", "sea": "Κρητικό"},
    {"code": "61277",      "lat": 35.7263, "lon": 25.1307, "last": "2024-11-26", "sea": "Κρητικό"},
    {"code": "Stronggili", "lat": 36.2456, "lon": 27.7731, "last": "2024-04-19", "sea": "Καρπάθιο"},
    {"code": "ATHOS",      "lat": 39.9750, "lon": 24.7294, "last": "2022-11-26", "sea": "Β. Αιγαίο"},
    {"code": "MYKON",      "lat": 37.5194, "lon": 25.4597, "last": "2022-02-09", "sea": "Κυκλάδες"},
]

MODELS = ["meteofrance_wave", "ewam"]

# ── ΟΙ ΠΥΛΕΣ ΑΠΟΦΑΣΗΣ — γραμμένες ΠΡΙΝ τη μέτρηση ────────────────────────────────────────
# 1 δεν κρίνεται εδώ (πέρασε ήδη με τη σύγκριση ανοιχτής θάλασσας, βλ. docs/team/06 §2β).
GATES = {
    # Αν το ewam υποεκτιμά συστηματικά τον πλωτήρα, είναι απλώς χαμηλό μοντέλο -> απόρριψη.
    "max_negative_bias_pct": -10.0,
    # Δεν αλλάζουμε σε μοντέλο που πέφτει πιο έξω από το σημερινό.
    "rmse_must_not_exceed_current": True,
    # Η επικίνδυνη ουρά: με δυνατό άνεμο, το ewam δεν επιτρέπεται να λέει «ήρεμα» ενώ ο
    # πλωτήρας μετράει φουρτούνα. Ένα και μόνο τέτοιο περιστατικό μετράει.
    "strong_wind_beaufort": 5,
    "max_underestimate_m_strong_wind": 0.40,
}

UA = {"User-Agent": "calmbeach-wave-audit/1.0 (+https://calmbeach.gr)"}


def log(msg):
    print(msg, flush=True)


def beaufort(kmh):
    if kmh is None:
        return None
    for limit, bft in ((1, 0), (5, 1), (11, 2), (19, 3), (28, 4), (38, 5),
                       (49, 6), (61, 7), (74, 8), (88, 9), (102, 10), (117, 11)):
        if kmh < limit or (bft and kmh <= limit):
            return bft
    return 12


def fetch_json(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            log(f"    ξαναδοκιμή ({exc.__class__.__name__}) …")
            time.sleep(3 * (attempt + 1))
    return None


def open_meteo_series(lat, lon, start, end, model):
    """Ωριαίο ύψος κύματος ενός μοντέλου -> {iso_hour: metres}."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "hourly": "wave_height",
        "start_date": start, "end_date": end,
        "timezone": "UTC", "cell_selection": "sea",
        "models": model,
    })
    data = fetch_json(f"https://marine-api.open-meteo.com/v1/marine?{q}")
    hourly = data.get("hourly") or {}
    values = hourly.get(f"wave_height_{model}") or hourly.get("wave_height") or []
    return {t: v for t, v in zip(hourly.get("time", []), values) if v is not None}


def open_meteo_wind(lat, lon, start, end):
    """Ωριαίος άνεμος (km/h) για την πύλη 3 -> {iso_hour: kmh}."""
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "hourly": "wind_speed_10m",
        "start_date": start, "end_date": end,
        "timezone": "UTC",
    })
    data = fetch_json(f"https://archive-api.open-meteo.com/v1/archive?{q}")
    hourly = data.get("hourly") or {}
    values = hourly.get("wind_speed_10m") or []
    return {t: v for t, v in zip(hourly.get("time", []), values) if v is not None}


# Το σύνολο έχει τρία μέρη. Το `latest` κρατά μόνο λίγες ημέρες (μετρήθηκε 31/07: 5 αρχεία για
# το Ηράκλειο), οπότε για ένα παράθυρο μηνών χρειάζονται και τα τρία. Σειρά από το πυκνότερο
# προς το αραιότερο· ό,τι βρεθεί ενώνεται και ξεδιπλώνεται στη read_buoy_waves.
DATASET_PARTS = ("history", "monthly", "latest")


def download_buoy(code, start, end, workdir):
    """Κατεβάζει τα NetCDF του πλωτήρα από όλα τα μέρη του συνόλου. Επιστρέφει διαδρομές."""
    import copernicusmarine as cm

    user, password = os.environ.get("CMEMS_USER"), os.environ.get("CMEMS_PASS")
    creds = {"username": user, "password": password} if (user and password) else {}
    errors = []

    for part in DATASET_PARTS:
        target = workdir / part
        target.mkdir(parents=True, exist_ok=True)
        try:
            cm.get(
                dataset_id=DATASET_ID,
                dataset_part=part,
                filter=f"*MO_TS_MO_{code}*",
                output_directory=str(target),
                no_directories=True,
                disable_progress_bar=True,
                overwrite=True,
                **creds,
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{part}: {exc.__class__.__name__}")

    found = sorted(workdir.rglob("*.nc"))
    if not found and errors:
        raise RuntimeError("; ".join(errors))
    return found


def read_buoy_waves(paths, start_dt, end_dt):
    """VHM0 από τα NetCDF -> {iso_hour: metres}, στρογγυλοποιημένο στην ώρα."""
    import numpy as np
    import xarray as xr

    out = {}
    for path in paths:
        try:
            ds = xr.open_dataset(path, engine="h5netcdf")
        except Exception as exc:  # noqa: BLE001
            log(f"    (παραλείπω {path.name}: {exc.__class__.__name__})")
            continue
        with ds:
            if "VHM0" not in ds:
                continue
            times = ds["TIME"].values
            values = np.asarray(ds["VHM0"].values, dtype="float64")
            qc = np.asarray(ds["VHM0_QC"].values, dtype="float64") if "VHM0_QC" in ds else None

            # VHM0 έρχεται σε σχήμα (TIME, DEPTH) με 4 επίπεδα, και το κύμα ΔΕΝ κάθεται στο
            # επίπεδο 0 — στο Ηράκλειο είναι στο 1 και τα υπόλοιπα είναι NaN. Παίρνοντας
            # `values[:, 0]` έβγαιναν 0 έγκυρες μετρήσεις από 20.502 (μετρήθηκε 31/07/2026).
            # Άρα: για κάθε ώρα, το πρώτο επίπεδο που έχει ΚΑΙ τιμή ΚΑΙ καλό QC.
            if values.ndim == 1:
                values = values[:, None]
                if qc is not None and qc.ndim == 1:
                    qc = qc[:, None]

            for i, raw_t in enumerate(times):
                value = None
                for level in range(values.shape[1]):
                    candidate = values[i, level]
                    if not np.isfinite(candidate) or candidate <= 0 or candidate > 20:
                        continue
                    # Κρατάμε μόνο ό,τι ο ίδιος ο πάροχος σημειώνει «καλό» (1) ή «πιθανώς
                    # καλό» (2). Στο Ηράκλειο οι σημάνσεις που εμφανίζονται είναι 1/3/4/9.
                    if qc is not None and qc[i, level] not in (1, 2):
                        continue
                    value = candidate
                    break
                if value is None:
                    continue
                stamp = np.datetime64(raw_t, "h").astype(datetime).replace(tzinfo=timezone.utc)
                if not (start_dt <= stamp <= end_dt):
                    continue
                out.setdefault(stamp.strftime("%Y-%m-%dT%H:00"), []).append(float(value))
    return {k: sum(v) / len(v) for k, v in out.items()}


def stats(pairs):
    """pairs = [(μετρημένο, μοντέλο)] -> bias, bias%, RMSE, MAE."""
    if not pairs:
        return None
    n = len(pairs)
    bias = sum(m - o for o, m in pairs) / n
    mean_obs = sum(o for o, _ in pairs) / n
    rmse = math.sqrt(sum((m - o) ** 2 for o, m in pairs) / n)
    mae = sum(abs(m - o) for o, m in pairs) / n
    return {
        "n": n,
        "mean_observed_m": round(mean_obs, 3),
        "mean_model_m": round(sum(m for _, m in pairs) / n, 3),
        "bias_m": round(bias, 3),
        "bias_pct": round(100 * bias / mean_obs, 1) if mean_obs else None,
        "rmse_m": round(rmse, 3),
        "mae_m": round(mae, 3),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=120,
                        help="πόσες μέρες πίσω (προεπιλογή 120)")
    parser.add_argument("--buoys", default="",
                        help="κόμμα-χωρισμένοι κωδικοί· κενό = όλοι")
    # Το «τελευταίες Ν ημέρες» δεν κάνει εδώ, και ο λόγος πρέπει να μείνει γραμμένος:
    # ο αισθητήρας κύματος του Ηρακλείου σταμάτησε μέσα στο 2024 (17.552 καλές μετρήσεις
    # 2016-2024, ΜΗΔΕΝ το 2025), ενώ το ιστορικό του ewam στο Open-Meteo αρχίζει μέσα στο
    # 2022 (μετρήθηκε 31/07/2026: 07/2022 -> 72 ώρες, 07/2023 -> 744, 07/2021 -> καμία).
    # Η μόνη ζώνη όπου υπάρχουν ΚΑΙ μέτρηση ΚΑΙ τα δύο μοντέλα είναι ~08/2022 - 12/2024.
    parser.add_argument("--start", default="", help="YYYY-MM-DD (υπερισχύει του --days)")
    parser.add_argument("--end", default="", help="YYYY-MM-DD")
    args = parser.parse_args()

    if args.start:
        start_dt = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
        end_dt = (datetime.fromisoformat(args.end) if args.end
                  else datetime.now(timezone.utc)).replace(tzinfo=timezone.utc)
    else:
        end_dt = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        start_dt = end_dt - timedelta(days=args.days)
    only = {c.strip() for c in args.buoys.split(",") if c.strip()}
    buoys = [b for b in BUOYS if not only or b["code"] in only]

    log(f"Παράθυρο: {start_dt:%Y-%m-%d} → {end_dt:%Y-%m-%d} ({args.days} ημέρες)")
    log(f"Πλωτήρες: {', '.join(b['code'] for b in buoys)}\n")

    per_buoy, all_pairs = [], {m: [] for m in MODELS}
    danger = []

    for buoy in buoys:
        log(f"── {buoy['code']} ({buoy['sea']}, τελευταία δηλωμένη μέτρηση {buoy['last']})")
        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            try:
                paths = download_buoy(buoy["code"], start_dt, end_dt, workdir)
            except Exception as exc:  # noqa: BLE001
                log(f"    ✗ κατέβασμα απέτυχε: {exc.__class__.__name__}: {str(exc)[:160]}")
                log("      (αν ζητά username/password: κάνε `copernicusmarine login` ή όρισε CMEMS_USER/CMEMS_PASS)\n")
                continue
            if not paths:
                log("    ✗ κανένα αρχείο για αυτό το παράθυρο\n")
                continue
            observed = read_buoy_waves(paths, start_dt, end_dt)

        if not observed:
            log("    ✗ κανένα έγκυρο VHM0 (QC 1/2) στο παράθυρο\n")
            continue
        hours = sorted(observed)
        log(f"    {len(observed)} ώρες μέτρησης, {hours[0]} → {hours[-1]}")

        span_start, span_end = hours[0][:10], hours[-1][:10]
        models = {}
        for model in MODELS:
            try:
                models[model] = open_meteo_series(buoy["lat"], buoy["lon"], span_start, span_end, model)
            except Exception as exc:  # noqa: BLE001
                log(f"    ! {model}: {exc.__class__.__name__} — παραλείπεται")
                models[model] = {}
        try:
            winds = open_meteo_wind(buoy["lat"], buoy["lon"], span_start, span_end)
        except Exception:  # noqa: BLE001
            winds = {}

        entry = {"buoy": buoy["code"], "sea": buoy["sea"],
                 "lat": buoy["lat"], "lon": buoy["lon"],
                 "observed_hours": len(observed),
                 "window": [hours[0], hours[-1]], "models": {}}

        for model in MODELS:
            pairs, strong = [], []
            for hour, obs in observed.items():
                pred = models[model].get(hour)
                if pred is None:
                    continue
                pairs.append((obs, pred))
                all_pairs[model].append((obs, pred))
                bft = beaufort(winds.get(hour))
                if bft is not None and bft >= GATES["strong_wind_beaufort"]:
                    strong.append((obs, pred))
                    shortfall = obs - pred
                    # Μετριέται για ΚΑΙ ΤΑ ΔΥΟ μοντέλα. Η πρώτη έκδοση ρωτούσε μόνο τον
                    # διεκδικητή, που είναι άκυρη σύγκριση: μια πύλη που ελέγχει μόνο το
                    # καινούριο προστατεύει το status quo, όχι τον λουόμενο. Στην πρώτη
                    # εκτέλεση (31/07/2026) το ewam έβγαλε 2 περιστατικά — και το ερώτημα
                    # «πόσα βγάζει αυτό που ήδη τρέχει;» δεν είχε καν διατυπωθεί.
                    if shortfall > GATES["max_underestimate_m_strong_wind"]:
                        danger.append({"model": model, "buoy": buoy["code"], "hour": hour,
                                       "observed_m": round(obs, 2), "model_m": round(pred, 2),
                                       "shortfall_m": round(shortfall, 2), "beaufort": bft})
            entry["models"][model] = {"overall": stats(pairs), "strong_wind": stats(strong)}
            s = stats(pairs)
            if s:
                log(f"    {model:18} n={s['n']:5}  bias {s['bias_m']:+.2f} μ ({s['bias_pct']:+.1f}%)  RMSE {s['rmse_m']:.2f} μ")
            else:
                log(f"    {model:18} καμία επικάλυψη ωρών")
        per_buoy.append(entry)
        log("")

    overall = {m: stats(all_pairs[m]) for m in MODELS}
    verdict = {"passed": None, "reasons": []}
    cur, new = overall["meteofrance_wave"], overall["ewam"]

    if not new or new["n"] < 200:
        verdict["passed"] = False
        verdict["reasons"].append(
            f"Ανεπαρκή δεδομένα: {new['n'] if new else 0} συγκρίσεις (χρειάζονται ≥200). "
            "Δοκίμασε μεγαλύτερο --days ή έλεγξε τους κωδικούς.")
    else:
        gate2_bias = new["bias_pct"] is not None and new["bias_pct"] > GATES["max_negative_bias_pct"]
        gate2_rmse = cur is not None and new["rmse_m"] <= cur["rmse_m"]
        danger_new = [d for d in danger if d["model"] == "ewam"]
        danger_cur = [d for d in danger if d["model"] == "meteofrance_wave"]
        # Η πύλη είναι ΣΥΓΚΡΙΤΙΚΗ, όχι απόλυτη. Κανένα μοντέλο κύματος δεν έχει μηδέν
        # επικίνδυνες υποεκτιμήσεις· το ερώτημα που προστατεύει τον λουόμενο είναι αν το
        # καινούριο έχει ΛΙΓΟΤΕΡΕΣ από αυτό που ήδη τρέχει.
        gate3 = len(danger_new) <= len(danger_cur)
        verdict["gates"] = {
            "bias_not_below_-10pct": {"pass": gate2_bias, "value_pct": new["bias_pct"]},
            "rmse_not_worse_than_current": {"pass": gate2_rmse,
                                            "ewam_rmse_m": new["rmse_m"],
                                            "current_rmse_m": cur["rmse_m"] if cur else None},
            "fewer_dangerous_underestimates_than_current": {
                "pass": gate3,
                "ewam_incidents": len(danger_new),
                "current_model_incidents": len(danger_cur)},
        }
        verdict["passed"] = bool(gate2_bias and gate2_rmse and gate3)
        if not gate2_bias:
            verdict["reasons"].append(f"Το ewam υποεκτιμά συστηματικά ({new['bias_pct']}%).")
        if not gate2_rmse:
            verdict["reasons"].append(
                f"Το ewam πέφτει πιο έξω από το σημερινό (RMSE {new['rmse_m']} vs {cur['rmse_m']} μ).")
        if not gate3:
            bft = GATES["strong_wind_beaufort"]
            metres = GATES["max_underestimate_m_strong_wind"]
            verdict["reasons"].append(
                f"Με ≥{bft} Bft, το ewam υποεκτιμά τον πλωτήρα κατά >{metres} μ. σε "
                f"{len(danger_new)} περιπτώσεις — περισσότερες από τις {len(danger_cur)} "
                "του μοντέλου που τρέχει σήμερα.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "window_days": args.days,
        "gates": GATES,
        "per_buoy": per_buoy,
        "overall": overall,
        "dangerous_underestimates": danger[:50],
        "verdict": verdict,
    }
    out_path = OUT_DIR / "buoy-comparison.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    log("═" * 72)
    for model in MODELS:
        s = overall[model]
        if s:
            log(f"{model:18} n={s['n']:6}  μέσο μετρημένο {s['mean_observed_m']:.2f} μ  "
                f"bias {s['bias_m']:+.2f} μ ({s['bias_pct']:+.1f}%)  RMSE {s['rmse_m']:.2f} μ")
    log("")
    if verdict["passed"] is True:
        log("ΕΤΥΜΗΓΟΡΙΑ: ΠΕΡΝΑΕΙ — προχώρα στη Φάση 2 (υβρίδιο με τις 4 δικλείδες).")
    else:
        log("ΕΤΥΜΗΓΟΡΙΑ: ΔΕΝ ΠΕΡΝΑΕΙ — το μοντέλο κύματος ΜΕΝΕΙ ως έχει.")
        for reason in verdict["reasons"]:
            log(f"  · {reason}")
    log(f"\nΑναφορά: {out_path.relative_to(ROOT)}")
    return 0 if verdict["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
