"""
ΚΡΙΤΗΣ ΤΟΥ ΑΝΟΙΧΤΟΥ ΚΥΜΑΤΟΣ ΑΠΟ ΤΟ ΔΙΑΣΤΗΜΑ — δορυφορικά αλτίμετρα (14/09/2026, βίβλος §Γ85).

ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο μόνος εξωτερικός κριτής του ύψους κύματος στην ανοιχτή θάλασσα ήταν οι πλωτήρες του
ΕΛΚΕΘΕ (scripts/auditWaveModelAgainstBuoys.py). Στις 14/09 ο έλεγχος 120 ημερών έβγαλε 0 συγκρίσεις: η
σύνδεση Copernicus δούλευε, οι σημαδούρες όχι — Ηράκλειο τελευταία μέτρηση 16/07/2026, οι άλλες
τέσσερις από το 2022-24. Το ταμπλό ειλικρίνειας (scripts/buildHonestyScorecard.mjs, αριθμός 6) μένει
κόκκινο όσο περιμένουμε έναν πλωτήρα που δεν ξέρουμε αν θα ξαναμιλήσει.

ΤΟ ΟΡΓΑΝΟ. Τα αλτίμετρα στέλνουν ραντάρ κατακόρυφα στη θάλασσα και από το σχήμα της ηχούς βγάζουν το
σημαντικό ύψος κύματος — το ίδιο μέγεθος που τυπώνει η σελίδα. Δέκα δορυφόροι (Sentinel-3A/B,
Sentinel-6, Jason-3, CryoSat-2, SARAL, HY-2B/C, CFOSAT, SWOT), μία μέτρηση το δευτερόλεπτο (~7 χλμ.)
κατά μήκος της τροχιάς, πολλά περάσματα την ημέρα πάνω από Αιγαίο/Ιόνιο/Κρητικό. Copernicus
WAVE_GLO_PHY_SWH_L3_NRT_014_001, μόνο οι τιμές που το ίδιο το προϊόν σημαίνει καλές (value_qc 0).

ΤΙ ΚΡΙΝΕΙ — ΚΑΙ ΤΙ ΟΧΙ, δηλωμένο πριν το αποτέλεσμα:
  - το μοντέλο στην ΑΝΟΙΧΤΗ θάλασσα, ≥15 χλμ. από στεριά (κοντύτερα η ηχώ πιάνει ακτή). Είναι ο
    άξονας «κύμα ανοιχτά» του πορίσματος — ΟΧΙ το νούμερο της ακτής, ΟΧΙ η σκιά (K_d).
  - ό,τι διαβάζει η σελίδα: ewam όπου δίνει ύψος, αλλιώς meteofrance_wave (utils/marineForecastParsing).
    Κρίνονται και τα δύο χωριστά, για να φαίνεται αν το ένα σώζει το άλλο.
  - ο άνεμος των πυλών είναι του ΙΔΙΟΥ του αλτίμετρου (WIND_SPEED), όχι μοντέλου.
  - στιγμιότυπο δορυφόρου ενάντια σε ωριαίο μοντέλο: γραμμική παρεμβολή ανάμεσα στις δύο ώρες.

ΟΙ ΠΥΛΕΣ ΓΡΑΦΤΗΚΑΝ ΚΑΙ ΔΕΣΜΕΥΤΗΚΑΝ ΣΕ COMMIT ΠΡΙΝ ΤΡΕΞΕΙ ΤΟ SCRIPT (δες GATES). Κανένα όριο δεν
εφευρίσκεται: η μεροληψία −10% είναι του ελέγχου των σημαδούρων, το 5% σοβαρών υποεκτιμήσεων με άνεμο
≥5 Μποφόρ είναι η πύλη ασφαλείας με την οποία μπήκε το ewam στις 31/07 (1,72% τότε), και η σύγκριση
RMSE είναι «όχι χειρότερο από το εναλλακτικό μοντέλο», όπως στις σημαδούρες. Μην τα χαλαρώσεις αφού
δεις το αποτέλεσμα.

ΧΡΗΣΗ
  OPEN_METEO_API_KEY=… PYTHONIOENCODING=utf-8 python scripts/auditWaveModelAgainstAltimetry.py [--days 90]
  (χωρίς κλειδί πάει στον δωρεάν host — για 90 μέρες × χιλιάδες σημεία ξεπερνά το ημερήσιο όριο)

ΕΞΟΔΟΣ  reports/wave-model/altimetry-comparison.json — ΜΟΝΟ αν υπάρχουν ≥ min_pairs συγκρίσεις. Ένα άδειο
αποτέλεσμα ΔΕΝ γράφεται: θα έδινε στο ταμπλό σημερινή ημερομηνία χωρίς καμία μέτρηση (το λάθος που έκανε
το άδειο τρέξιμο των σημαδούρων στις 14/09 πριν επαναφερθεί).
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from copernicusCommon import ROOT, credentials, open_dataset, write_report  # noqa: E402

SATELLITES = ["s3a", "s3b", "s6a", "j3", "c2", "al", "h2b", "h2c", "cfo", "swon"]
DATASET = "cmems_obs-wave_glo_phy-swh_nrt_{}-l3_PT1S"
LAND_MASK_DATASET = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
BBOX = {"minimum_latitude": 34.0, "maximum_latitude": 41.2, "minimum_longitude": 19.0, "maximum_longitude": 29.8}
COAST_KM = 15.0
BIN_DEG = 0.1
BIN_SECONDS = 600
MODELS = ["ewam", "meteofrance_wave"]
CACHE = ROOT / ".tmp" / "altimetry"

# ── ΟΙ ΠΥΛΕΣ — γραμμένες και δεσμευμένες ΠΡΙΝ τη μέτρηση ─────────────────────────────────────
GATES = {
    # Λιγότερες συγκρίσεις = ανέκδοτο, όχι κριτής (ίδιο κατώφλι με τις σημαδούρες).
    "min_pairs": 200,
    # Το μοντέλο της σελίδας δεν επιτρέπεται να υποεκτιμά συστηματικά (σημαδούρες 31/07).
    "max_negative_bias_pct": -10.0,
    # Δεν πέφτει πιο έξω από το εναλλακτικό μοντέλο (σημαδούρες 31/07).
    "rmse_not_worse_than_alternative": True,
    # Η επικίνδυνη ουρά: με άνεμο ≥5 Μποφόρ (≥8,0 m/s στο ίδιο το αλτίμετρο) και κύμα ≥1 μ., το μοντέλο
    # δεν επιτρέπεται να λέει 0,40 μ. κάτω από τη μέτρηση σε πάνω από 5% των περιπτώσεων (πύλη
    # ασφαλείας της υιοθέτησης του ewam, 31/07: 1,72% με όριο 5%).
    "strong_wind_ms": 8.0,
    "danger_min_observed_m": 1.0,
    "serious_underestimate_m": 0.40,
    "max_serious_underestimate_pct": 5.0,
}

UA = {"User-Agent": "calmbeach-wave-audit/1.0 (+https://calmbeach.gr)"}


def log(msg):
    print(msg, flush=True)


def fetch_json(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            log(f"    ξαναδοκιμή ({exc.__class__.__name__}) …")
            time.sleep(5 * (attempt + 1))
    return None


# ── 1. οι μετρήσεις των δορυφόρων ────────────────────────────────────────────────────────────
def read_satellite(sat, start, end):
    """→ λίστα (epoch, lat, lon, VAVH, WIND_SPEED|None) με value_qc 0· cache στο .tmp/altimetry."""
    import copernicusmarine as cm
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / f"{sat}_{start}_{end}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    try:
        df = cm.read_dataframe(dataset_id=DATASET.format(sat), start_datetime=f"{start}T00:00:00",
                               end_datetime=f"{end}T23:59:59", **BBOX, **credentials())
    except Exception as exc:  # noqa: BLE001
        log(f"  {sat:5}: ✗ {exc.__class__.__name__}: {str(exc)[:120]}")
        return []
    if df is None or len(df) == 0:
        cache.write_text("[]", encoding="utf-8")
        return []
    df = df[df["value_qc"] == 0]
    rows = {}
    for rec in df[["variable", "time", "latitude", "longitude", "value"]].itertuples(index=False):
        key = (rec.time, round(float(rec.latitude), 5), round(float(rec.longitude), 5))
        rows.setdefault(key, {})[rec.variable] = rec.value
    out = []
    for (t, lat, lon), vals in rows.items():
        h = vals.get("VAVH")
        if h is None or not math.isfinite(h) or h <= 0 or h > 15:
            continue
        w = vals.get("WIND_SPEED")
        epoch = datetime.strptime(t, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
        out.append([epoch, lat, lon, float(h), float(w) if w is not None and math.isfinite(w) else None])
    cache.write_text(json.dumps(out), encoding="utf-8")
    return out


# ── 2. ποια σημεία είναι ≥15 χλμ. από στεριά — από τη μάσκα του μοντέλου 4,2 χλμ. ──────────────
def coastal_safe_mask():
    ds = open_dataset(LAND_MASK_DATASET, variables=["VHM0"], **BBOX,
                      start_datetime="2026-09-01T00:00:00", end_datetime="2026-09-01T00:00:00")
    sea = np.isfinite(ds["VHM0"].isel(time=0).values)
    lats, lons = ds["latitude"].values, ds["longitude"].values
    dlat_km = abs(float(lats[1] - lats[0])) * 111.2
    k = int(math.ceil(COAST_KM / dlat_km))
    safe = sea.copy()
    for di in range(-k, k + 1):
        for dj in range(-k, k + 1):
            if di * di + dj * dj > k * k:
                continue
            shifted = np.zeros_like(sea)
            src = sea[max(0, di):sea.shape[0] + min(0, di), max(0, dj):sea.shape[1] + min(0, dj)]
            shifted[max(0, -di):sea.shape[0] + min(0, -di), max(0, -dj):sea.shape[1] + min(0, -dj)] = src
            safe &= shifted
    return lats, lons, safe, k


def is_safe(lats, lons, safe, lat, lon):
    i = int(np.abs(lats - lat).argmin())
    j = int(np.abs(lons - lon).argmin())
    return bool(safe[i, j])


# ── 3. το μοντέλο στο ίδιο κελί και την ίδια στιγμή ───────────────────────────────────────────
def model_series(cells, model, start, end, api_key):
    """cells [(lat, lon)] → {(lat, lon): (t0_epoch, np.array ωριαίων υψών)} — cache ανά μοντέλο."""
    cache = CACHE / f"model_{model}_{start}_{end}.json"
    have = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    todo = [c for c in cells if f"{c[0]:.2f},{c[1]:.2f}" not in have]
    host = "https://customer-marine-api.open-meteo.com" if api_key else "https://marine-api.open-meteo.com"
    for b in range(0, len(todo), 50):
        chunk = todo[b:b + 50]
        q = {"latitude": ",".join(f"{c[0]:.2f}" for c in chunk), "longitude": ",".join(f"{c[1]:.2f}" for c in chunk),
             "hourly": "wave_height", "models": model, "start_date": start, "end_date": end,
             "timezone": "UTC", "cell_selection": "sea"}
        if api_key:
            q["apikey"] = api_key
        data = fetch_json(f"{host}/v1/marine?{urllib.parse.urlencode(q)}")
        items = data if isinstance(data, list) else [data]
        for c, item in zip(chunk, items):
            hourly = (item or {}).get("hourly") or {}
            times = hourly.get("time") or []
            vals = hourly.get(f"wave_height_{model}") or hourly.get("wave_height") or []
            if not times:
                have[f"{c[0]:.2f},{c[1]:.2f}"] = None
                continue
            t0 = datetime.strptime(times[0], "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp()
            have[f"{c[0]:.2f},{c[1]:.2f}"] = [t0, [v if v is not None else None for v in vals]]
        log(f"    {model}: {min(b + 50, len(todo))}/{len(todo)} κελιά")
        cache.write_text(json.dumps(have), encoding="utf-8")
        time.sleep(0.4)
    return have


def model_at(series, epoch):
    if not series:
        return None
    t0, vals = series
    x = (epoch - t0) / 3600.0
    i = int(math.floor(x))
    if i < 0 or i + 1 >= len(vals):
        return None
    a, b = vals[i], vals[i + 1]
    if a is None or b is None:
        return None
    return a + (b - a) * (x - i)


# ── 4. στατιστικά ────────────────────────────────────────────────────────────────────────────
def stats(pairs):
    n = len(pairs)
    if not n:
        return {"n": 0}
    obs = np.array([p[0] for p in pairs]); mod = np.array([p[1] for p in pairs])
    bias = float((mod - obs).mean())
    return {"n": n, "mean_observed_m": round(float(obs.mean()), 3), "mean_model_m": round(float(mod.mean()), 3),
            "bias_m": round(bias, 3), "bias_pct": round(100 * bias / float(obs.mean()), 1) if obs.mean() else None,
            "rmse_m": round(float(np.sqrt(((mod - obs) ** 2).mean())), 3), "mae_m": round(float(np.abs(mod - obs).mean()), 3),
            "corr": round(float(np.corrcoef(obs, mod)[0, 1]), 3) if n > 2 else None}


def sea_of(lat, lon):
    if lat < 35.9:
        return "Κρητικό/Λιβυκό"
    if lon < 22.6:
        return "Ιόνιο"
    return "Αιγαίο"


BANDS = [(0, 0.5, "<0,5"), (0.5, 1.0, "0,5-1"), (1.0, 2.0, "1-2"), (2.0, 99, "≥2")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--end", default="")
    ap.add_argument("--sats", default=",".join(SATELLITES))
    args = ap.parse_args()
    end_d = datetime.strptime(args.end, "%Y-%m-%d").date() if args.end else datetime.now(timezone.utc).date()
    start_d = end_d - timedelta(days=args.days)
    start, end = start_d.isoformat(), end_d.isoformat()
    api_key = (os.environ.get("OPEN_METEO_API_KEY") or "").strip() or None
    log(f"Παράθυρο: {start} → {end} ({args.days} μέρες) · Open-Meteo: {'ΠΛΗΡΩΜΕΝΟ' if api_key else 'δωρεάν'} · ακτή ≥{COAST_KM:g} χλμ.")

    lats, lons, safe, k = coastal_safe_mask()
    log(f"Μάσκα ακτής: {int(safe.sum())} ασφαλή κελιά 4,2 χλμ. (ακτίνα {k} κελιά)")

    per_sat, raw_n, kept_n = {}, 0, 0
    bins = defaultdict(list)
    for sat in args.sats.split(","):
        rows = read_satellite(sat, start, end)
        raw_n += len(rows)
        ok = [r for r in rows if is_safe(lats, lons, safe, r[1], r[2])]
        kept_n += len(ok)
        per_sat[sat] = {"measurements": len(rows), "openWater": len(ok)}
        log(f"  {sat:5}: {len(rows):6} μετρήσεις · {len(ok):6} ≥{COAST_KM:g} χλμ. από στεριά")
        for epoch, lat, lon, h, w in ok:
            key = (sat, int(epoch // BIN_SECONDS), round(math.floor(lat / BIN_DEG) * BIN_DEG + BIN_DEG / 2, 2),
                   round(math.floor(lon / BIN_DEG) * BIN_DEG + BIN_DEG / 2, 2))
            bins[key].append((epoch, h, w))
    log(f"Σύνολο: {raw_n} μετρήσεις → {kept_n} σε ανοιχτό νερό → {len(bins)} κουτάκια {BIN_DEG}° ανά πέρασμα")

    cells = sorted({(k[2], k[3]) for k in bins})
    series = {m: model_series(cells, m, start, end, api_key) for m in MODELS}

    pairs = {m: [] for m in MODELS + ["page"]}
    by_band = {m: defaultdict(list) for m in MODELS + ["page"]}
    by_sea = {m: defaultdict(list) for m in MODELS + ["page"]}
    danger = {m: {"eligible": 0, "serious": 0, "examples": []} for m in MODELS + ["page"]}
    for (sat, _, blat, blon), samples in bins.items():
        epoch = sum(s[0] for s in samples) / len(samples)
        obs = sum(s[1] for s in samples) / len(samples)
        winds = [s[2] for s in samples if s[2] is not None]
        wind = sum(winds) / len(winds) if winds else None
        vals = {m: model_at(series[m].get(f"{blat:.2f},{blon:.2f}"), epoch) for m in MODELS}
        ew = vals["ewam"]
        vals["page"] = ew if (ew is not None and ew > 0) else vals["meteofrance_wave"]
        band = next(lbl for lo, hi, lbl in BANDS if lo <= obs < hi)
        for m, v in vals.items():
            if v is None:
                continue
            pairs[m].append((obs, v))
            by_band[m][band].append((obs, v))
            by_sea[m][sea_of(blat, blon)].append((obs, v))
            if wind is not None and wind >= GATES["strong_wind_ms"] and obs >= GATES["danger_min_observed_m"]:
                danger[m]["eligible"] += 1
                if v < obs - GATES["serious_underestimate_m"]:
                    danger[m]["serious"] += 1
                    if len(danger[m]["examples"]) < 25:
                        danger[m]["examples"].append({
                            "sat": sat, "time": datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
                            "lat": blat, "lon": blon, "observed_m": round(obs, 2), "model_m": round(v, 2),
                            "wind_ms": round(wind, 1)})

    overall = {m: stats(pairs[m]) for m in pairs}
    for m in danger:
        e = danger[m]["eligible"]
        danger[m]["pct"] = round(100 * danger[m]["serious"] / e, 2) if e else None
    page, alt = overall["page"], overall["meteofrance_wave"]
    log("\nΑΠΟΤΕΛΕΣΜΑ (ανοιχτή θάλασσα):")
    for m in pairs:
        s = overall[m]
        if s["n"]:
            log(f"  {m:18} n={s['n']:6}  bias {s['bias_m']:+.2f} μ ({s['bias_pct']:+.1f}%)  RMSE {s['rmse_m']:.2f} μ  r={s['corr']}"
                f"  · σοβαρές υποεκτιμήσεις με ≥5 Μπφ: {danger[m]['serious']}/{danger[m]['eligible']}")

    if page.get("n", 0) < GATES["min_pairs"]:
        log(f"\nΑΝΕΠΑΡΚΗ ΔΕΔΟΜΕΝΑ: {page.get('n', 0)} συγκρίσεις (χρειάζονται ≥{GATES['min_pairs']}). "
            "Η αναφορά ΔΕΝ γράφεται — ένα άδειο αποτέλεσμα θα έδινε ψεύτικα φρέσκο κριτή.")
        return 2

    g1 = page["bias_pct"] is not None and page["bias_pct"] >= GATES["max_negative_bias_pct"]
    g2 = alt.get("n", 0) == 0 or page["rmse_m"] <= alt["rmse_m"]
    g3 = danger["page"]["pct"] is None or danger["page"]["pct"] <= GATES["max_serious_underestimate_pct"]
    verdict = {
        "passed": bool(g1 and g2 and g3),
        "gates": {
            "bias_not_below_-10pct": {"pass": g1, "value_pct": page["bias_pct"]},
            "rmse_not_worse_than_alternative": {"pass": g2, "page_rmse_m": page["rmse_m"], "alternative_rmse_m": alt.get("rmse_m")},
            "serious_underestimates_with_strong_wind_max_5pct": {"pass": g3, "value_pct": danger["page"]["pct"],
                                                                  "serious": danger["page"]["serious"], "eligible": danger["page"]["eligible"]},
        },
    }
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "instrument": "δορυφορικά αλτίμετρα, Copernicus WAVE_GLO_PHY_SWH_L3_NRT_014_001 (VAVH, value_qc 0)",
        "window": {"start": start, "end": end, "days": args.days},
        "method": {"coast_km": COAST_KM, "land_mask": LAND_MASK_DATASET, "bin_deg": BIN_DEG, "bin_seconds": BIN_SECONDS,
                   "model_time": "γραμμική παρεμβολή ανάμεσα σε ωριαίες τιμές", "page_model": "ewam όπου >0, αλλιώς meteofrance_wave",
                   "wind": "WIND_SPEED του ίδιου αλτίμετρου"},
        "satellites": per_sat,
        "counts": {"measurements": raw_n, "openWater": kept_n, "bins": len(bins), "cells": len(cells)},
        "gates": GATES,
        "overall": overall,
        "byObservedHeight": {m: {b: stats(v) for b, v in by_band[m].items()} for m in by_band},
        "bySea": {m: {s: stats(v) for s, v in by_sea[m].items()} for m in by_sea},
        "seriousUnderestimates": danger,
        "verdict": verdict,
    }
    out = write_report("reports/wave-model/altimetry-comparison.json", payload)
    log(f"\nΕΤΥΜΗΓΟΡΙΑ: {'ΠΕΡΝΑΕΙ' if verdict['passed'] else 'ΔΕΝ ΠΕΡΝΑΕΙ'} · "
        + " · ".join(f"{k} {'✓' if v['pass'] else '✗'}" for k, v in verdict["gates"].items()))
    log(f"Αναφορά: {out.relative_to(ROOT)}")
    return 0 if verdict["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
