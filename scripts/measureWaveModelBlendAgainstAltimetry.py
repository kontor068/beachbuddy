"""
ΠΟΙΟ ΜΕΙΓΜΑ ΜΟΝΤΕΛΩΝ ΚΥΜΑΤΟΣ ΛΕΕΙ ΑΛΗΘΕΙΑ — ΚΑΙ ΚΟΝΤΑ ΣΤΗΝ ΑΚΤΗ (14/09/2026, βίβλος §Γ85, απόφαση Μίλτου Α).

ΑΦΟΡΜΗ. Ο κριτής αλτιμέτρων (scripts/auditWaveModelAgainstAltimetry.py, 18.044 συγκρίσεις ≥15 χλμ. από στεριά)
βρήκε το ewam της σελίδας −6,9% / RMSE 0,21 έναντι meteofrance_wave −1,1% / 0,15. Όμως το ewam μπήκε (31/07) για
τις ΥΠΗΝΕΜΕΣ ακτές, και τα σημεία θάλασσας της σελίδας κάθονται διάμεσα ~10 χλμ. έξω — εκεί που ο πρώτος κριτής
δεν κοίταζε. Αλλαγή μοντέλου στα τυφλά μπορεί να χαλάσει ακριβώς ό,τι το ewam διόρθωσε.

ΤΟ ΟΡΓΑΝΟ ΕΔΩ. Το ΠΑΡΑΚΤΙΟ προϊόν των ίδιων δορυφόρων: `cmems_obs-wave_glo_phy-swh_nrt_<sat>-l3-1km_PT0.2S-i`
(5 μετρήσεις/δευτ., ~1,4 χλμ., επεξεργασία για την ακτή, value_qc 0). Δεν δίνει άνεμο — γι' αυτό η «σοβαρή
υποεκτίμηση» εδώ κρίνεται χωρίς όρο ανέμου (αυστηρότερο, όχι χαλαρότερο από τον κριτή).

ΑΠΟΣΤΑΣΗ ΑΠΟ ΣΤΕΡΙΑ. Από τη μάσκα του μοντέλου MED 4,2 χλμ.: ευκλείδεια απόσταση κάθε θαλάσσιου κελιού από το
κοντινότερο κελί στεριάς. Ζώνες: 0-5 (αναφέρεται, ΔΕΝ κρίνει — εκεί ακόμα και το παράκτιο αλτίμετρο πιάνει στεριά)
· 5-10 · 10-15 · 15-30 · ≥30 χλμ. Η ίδια μάσκα δίνει και πού κάθονται τα ~2.900 σημεία θάλασσας της σελίδας
(profiles[].marineSamplePoint + σημεία περιοχών) — ώστε το «ποιο κερδίζει» να ζυγίζεται εκεί που κοιτάζει ο κόσμος.

ΥΠΟΨΗΦΙΟΙ (όλοι προδηλωμένοι):
  current      ewam όπου >0, αλλιώς meteofrance_wave — ό,τι κάνει σήμερα η σελίδα
  mf           meteofrance_wave παντού
  mean         μέσος όρος ewam/meteofrance
  max          το μεγαλύτερο των δύο (το «ασφαλές»)
  switch_10/15/20   ewam όταν το σημείο απέχει < D χλμ. από στεριά, αλλιώς meteofrance
  ewam_cal     ewam × συντελεστής — ΜΕ ΔΙΑΣΤΑΥΡΩΣΗ: ο συντελεστής βγαίνει από τις μονές μέρες και κρίνεται στις ζυγές,
               και ανάποδα· ποτέ δεν κρίνεται στα δεδομένα από τα οποία βγήκε

ΚΡΙΤΗΡΙΑ — ΓΡΑΜΜΕΝΑ ΚΑΙ ΔΕΣΜΕΥΜΕΝΑ ΣΕ COMMIT ΠΡΙΝ ΤΡΕΞΕΙ (δες CRITERIA). Κύριο μέτρο: RMSE ΖΥΓΙΣΜΕΝΟ με το
μερίδιο των σημείων της σελίδας σε κάθε κρινόμενη ζώνη. Ένας υποψήφιος προτείνεται μόνο αν περάσει ΟΛΑ· από όσους
περάσουν, ο χαμηλότερος ζυγισμένος RMSE. Αν κανένας → μένει το current. ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΖΕΙ ΣΤΗ ΣΕΛΙΔΑ ΑΠΟ ΑΥΤΟ ΤΟ
SCRIPT — γράφει αναφορά για απόφαση.

ΧΡΗΣΗ
  OPEN_METEO_API_KEY=… PYTHONIOENCODING=utf-8 python scripts/measureWaveModelBlendAgainstAltimetry.py [--days 90]
ΕΞΟΔΟΣ  reports/wave-model/altimetry-blend.json
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.parse
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from copernicusCommon import ROOT, credentials, open_dataset, write_report  # noqa: E402
from auditWaveModelAgainstAltimetry import BBOX, LAND_MASK_DATASET, SATELLITES, fetch_json, log, model_at, stats  # noqa: E402

DATASET_1KM = "cmems_obs-wave_glo_phy-swh_nrt_{}-l3-1km_PT0.2S-i"
CACHE = ROOT / ".tmp" / "altimetry"
BIN_DEG = 0.05
BIN_SECONDS = 600
BANDS = [(0, 5, "0-5"), (5, 10, "5-10"), (10, 15, "10-15"), (15, 30, "15-30"), (30, 1e9, "≥30")]
JUDGED = ["5-10", "10-15", "15-30", "≥30"]
CANDIDATES = ["current", "mf", "mean", "max", "switch_10", "switch_15", "switch_20", "ewam_cal"]

# ── ΚΡΙΤΗΡΙΑ — δεσμευμένα ΠΡΙΝ τη μέτρηση ─────────────────────────────────────────────────────
CRITERIA = {
    # Ελάχιστο δείγμα ανά ζώνη για να ΚΡΙΝΕΙ (κάτω από αυτό η ζώνη δηλώνεται «αδίκαστη»).
    "min_pairs_per_band": 200,
    # Κ1: ο ζυγισμένος RMSE πέφτει τουλάχιστον 0,01 μ. κάτω από το current (αλλιώς δεν αξίζει αλλαγή).
    "min_weighted_rmse_gain_m": 0.01,
    # Κ2: σε ΚΑΜΙΑ κρινόμενη ζώνη δεν χειροτερεύει πάνω από 0,01 μ. — το φρένο που προστατεύει την ακτή.
    "max_band_rmse_loss_m": 0.01,
    # Κ3: συνολική μεροληψία στο [−5%, +10%]: όχι συστηματικά χαμηλά· λίγο ψηλά γίνεται δεκτό (η ασφαλής πλευρά).
    "bias_pct_min": -5.0,
    "bias_pct_max": 10.0,
    # Κ4: σοβαρές υποεκτιμήσεις (μέτρηση ≥1 μ. και μοντέλο ≥0,40 μ. κάτω) όχι περισσότερες από του current.
    "danger_min_observed_m": 1.0,
    "serious_underestimate_m": 0.40,
}


def read_coastal(sat, start, end):
    import copernicusmarine as cm
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / f"1km_{sat}_{start}_{end}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    try:
        df = cm.read_dataframe(dataset_id=DATASET_1KM.format(sat), start_datetime=f"{start}T00:00:00",
                               end_datetime=f"{end}T23:59:59", **BBOX, **credentials())
    except Exception as exc:  # noqa: BLE001
        log(f"  {sat:5}: ✗ {exc.__class__.__name__}: {str(exc)[:110]}")
        return []
    df = df[(df["variable"] == "VAVH") & (df["value_qc"] == 0)]
    out = []
    for rec in df[["time", "latitude", "longitude", "value"]].itertuples(index=False):
        h = float(rec.value)
        if not math.isfinite(h) or h <= 0 or h > 15:
            continue
        epoch = datetime.strptime(rec.time, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
        out.append([epoch, round(float(rec.latitude), 5), round(float(rec.longitude), 5), h])
    cache.write_text(json.dumps(out), encoding="utf-8")
    return out


def distance_map():
    """→ lats, lons, dist_km (NaN στη στεριά) — ευκλείδεια απόσταση κάθε θαλάσσιου κελιού από στεριά, ως ~55 χλμ."""
    ds = open_dataset(LAND_MASK_DATASET, variables=["VHM0"], **BBOX,
                      start_datetime="2026-09-01T00:00:00", end_datetime="2026-09-01T00:00:00")
    sea = np.isfinite(ds["VHM0"].isel(time=0).values)
    lats, lons = ds["latitude"].values, ds["longitude"].values
    dlat = abs(float(lats[1] - lats[0])) * 111.2
    dlon = abs(float(lons[1] - lons[0])) * 111.2 * math.cos(math.radians(37.5))
    land = ~sea
    dist = np.full(sea.shape, 60.0)
    R = int(math.ceil(55 / min(dlat, dlon)))
    H, W = sea.shape
    for di in range(-R, R + 1):
        for dj in range(-R, R + 1):
            d = math.hypot(di * dlat, dj * dlon)
            if d > 55:
                continue
            shifted = np.zeros_like(land)
            shifted[max(0, -di):H + min(0, -di), max(0, -dj):W + min(0, -dj)] = \
                land[max(0, di):H + min(0, di), max(0, dj):W + min(0, dj)]
            dist = np.where(shifted & (dist > d), d, dist)
    dist = np.where(sea, dist, np.nan)
    return lats, lons, dist


def dist_at(lats, lons, dist, lat, lon):
    i = int(np.abs(lats - lat).argmin())
    j = int(np.abs(lons - lon).argmin())
    return float(dist[i, j])


def band_of(d):
    return next(lbl for lo, hi, lbl in BANDS if lo <= d < hi)


def page_marine_points():
    pts = set()
    for f in (ROOT / "public/data/geospatial/exposure").glob("*.json"):
        if f.name == "index.json":
            continue
        for p in (json.loads(f.read_text(encoding="utf-8")).get("profiles") or {}).values():
            mp = (p or {}).get("marineSamplePoint")
            if mp and mp.get("lat") is not None:
                pts.add((round(mp["lat"], 4), round(mp["lon"], 4)))
    for f in (ROOT / "public/data/beaches/app").glob("*.json"):
        c = (json.loads(f.read_text(encoding="utf-8")).get("island") or {}).get("coordinates") or {}
        if c.get("lat") is not None:
            pts.add((round(c["lat"], 4), round(c["lon"], 4)))
    return sorted(pts)


def model_series3(cells, model, start, end, api_key):
    """Σαν το model_series του κριτή, με κλειδιά 3 δεκαδικών (κουτάκια 0,05°) και δική του μνήμη."""
    cache = CACHE / f"model3_{model}_{start}_{end}.json"
    have = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    todo = [c for c in cells if f"{c[0]:.3f},{c[1]:.3f}" not in have]
    host = "https://customer-marine-api.open-meteo.com" if api_key else "https://marine-api.open-meteo.com"
    for b in range(0, len(todo), 50):
        chunk = todo[b:b + 50]
        q = {"latitude": ",".join(f"{c[0]:.3f}" for c in chunk), "longitude": ",".join(f"{c[1]:.3f}" for c in chunk),
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
            key = f"{c[0]:.3f},{c[1]:.3f}"
            if not times:
                have[key] = None
                continue
            t0 = datetime.strptime(times[0], "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp()
            have[key] = [t0, vals]
        if (b // 50) % 10 == 0 or b + 50 >= len(todo):
            log(f"    {model}: {min(b + 50, len(todo))}/{len(todo)} κελιά")
            cache.write_text(json.dumps(have), encoding="utf-8")
        time.sleep(0.3)
    cache.write_text(json.dumps(have), encoding="utf-8")
    return have


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--end", default="")
    ap.add_argument("--sats", default=",".join(SATELLITES))
    args = ap.parse_args()
    end_d = datetime.strptime(args.end, "%Y-%m-%d").date() if args.end else datetime.now(timezone.utc).date()
    start, end = (end_d - timedelta(days=args.days)).isoformat(), end_d.isoformat()
    api_key = (os.environ.get("OPEN_METEO_API_KEY") or "").strip() or None
    log(f"Παράθυρο {start} → {end} · παράκτιο αλτίμετρο 1 χλμ. · Open-Meteo {'ΠΛΗΡΩΜΕΝΟ' if api_key else 'δωρεάν'}")

    lats, lons, dist = distance_map()
    page_pts = page_marine_points()
    page_bands = defaultdict(int)
    for la, lo in page_pts:
        d = dist_at(lats, lons, dist, la, lo)
        page_bands["στεριά (κελί 4,2 χλμ.)" if math.isnan(d) else band_of(d)] += 1
    log(f"Σημεία θάλασσας της σελίδας: {len(page_pts)} · ανά ζώνη: {dict(page_bands)}")

    bins = defaultdict(list)
    per_sat = {}
    for sat in args.sats.split(","):
        rows = read_coastal(sat, start, end)
        kept = 0
        for epoch, la, lo, h in rows:
            d = dist_at(lats, lons, dist, la, lo)
            if math.isnan(d):
                continue
            kept += 1
            key = (sat, int(epoch // BIN_SECONDS), round(math.floor(la / BIN_DEG) * BIN_DEG + BIN_DEG / 2, 3),
                   round(math.floor(lo / BIN_DEG) * BIN_DEG + BIN_DEG / 2, 3))
            bins[key].append((epoch, h, d))
        per_sat[sat] = {"measurements": len(rows), "overSea": kept}
        log(f"  {sat:5}: {len(rows):7} μετρήσεις · {kept:7} πάνω από θάλασσα")
    cells = sorted({(k[2], k[3]) for k in bins})
    log(f"Κουτάκια {BIN_DEG}° ανά πέρασμα: {len(bins)} · κελιά μοντέλου: {len(cells)}")
    series = {m: model_series3(cells, m, start, end, api_key) for m in ("ewam", "meteofrance_wave")}

    recs = []  # (band, day_parity, obs, ewam, mf, dist)
    for (sat, _, blat, blon), s in bins.items():
        epoch = sum(x[0] for x in s) / len(s)
        obs = sum(x[1] for x in s) / len(s)
        d = sum(x[2] for x in s) / len(s)
        key = f"{blat:.3f},{blon:.3f}"
        ew = model_at(series["ewam"].get(key), epoch)
        mf = model_at(series["meteofrance_wave"].get(key), epoch)
        if ew is None and mf is None:
            continue
        recs.append((band_of(d), int(epoch // 86400) % 2, obs, ew, mf, d))
    log(f"Συγκρίσεις: {len(recs)}")

    # ewam_cal: συντελεστής από τη ΜΙΑ μισή, κρίνεται στην ΑΛΛΗ
    def fit(parity):
        o = [r[2] for r in recs if r[1] == parity and r[3] and r[3] > 0 and r[5] >= 5]
        e = [r[3] for r in recs if r[1] == parity and r[3] and r[3] > 0 and r[5] >= 5]
        return (sum(o) / sum(e)) if e else 1.0
    cal = {0: fit(1), 1: fit(0)}  # ζυγές μέρες κρίνονται με συντελεστή από τις μονές, και ανάποδα

    def predict(c, r):
        band, parity, obs, ew, mf, d = r
        cur = ew if (ew is not None and ew > 0) else mf
        if c == "current":
            return cur
        if c == "mf":
            return mf if mf is not None else cur
        if c == "mean":
            return (ew + mf) / 2 if (ew is not None and ew > 0 and mf is not None) else cur
        if c == "max":
            return max(v for v in (ew, mf) if v is not None)
        if c.startswith("switch_"):
            D = float(c.split("_")[1])
            return (ew if (ew is not None and ew > 0) else mf) if d < D else (mf if mf is not None else cur)
        if c == "ewam_cal":
            return ew * cal[parity] if (ew is not None and ew > 0) else mf
        raise ValueError(c)

    table = {}
    for c in CANDIDATES:
        by_band = defaultdict(list)
        danger = {"eligible": 0, "serious": 0}
        for r in recs:
            p = predict(c, r)
            if p is None:
                continue
            by_band[r[0]].append((r[2], p))
            if r[0] in JUDGED and r[2] >= CRITERIA["danger_min_observed_m"]:
                danger["eligible"] += 1
                danger["serious"] += int(p < r[2] - CRITERIA["serious_underestimate_m"])
        judged_pairs = [x for b in JUDGED for x in by_band[b]]
        bands = {b: stats(v) for b, v in by_band.items()}
        w_total = sum(page_bands[b] for b in JUDGED if bands.get(b, {}).get("n", 0) >= CRITERIA["min_pairs_per_band"])
        w_rmse = sum(bands[b]["rmse_m"] * page_bands[b] for b in JUDGED
                     if bands.get(b, {}).get("n", 0) >= CRITERIA["min_pairs_per_band"]) / w_total if w_total else None
        danger["pct"] = round(100 * danger["serious"] / danger["eligible"], 2) if danger["eligible"] else None
        table[c] = {"bands": bands, "judgedOverall": stats(judged_pairs),
                    "weightedRmse_m": round(w_rmse, 4) if w_rmse is not None else None, "seriousUnderestimates": danger}

    cur = table["current"]
    verdicts = {}
    for c in CANDIDATES:
        if c == "current":
            continue
        t = table[c]
        k1 = t["weightedRmse_m"] is not None and cur["weightedRmse_m"] - t["weightedRmse_m"] >= CRITERIA["min_weighted_rmse_gain_m"]
        k2 = all(t["bands"][b]["rmse_m"] - cur["bands"][b]["rmse_m"] <= CRITERIA["max_band_rmse_loss_m"]
                 for b in JUDGED if cur["bands"].get(b, {}).get("n", 0) >= CRITERIA["min_pairs_per_band"])
        bp = t["judgedOverall"].get("bias_pct")
        k3 = bp is not None and CRITERIA["bias_pct_min"] <= bp <= CRITERIA["bias_pct_max"]
        k4 = (t["seriousUnderestimates"]["pct"] or 0) <= (cur["seriousUnderestimates"]["pct"] or 0)
        verdicts[c] = {"K1_weighted_rmse_gain": k1, "K2_no_band_worse": k2, "K3_bias_in_range": k3,
                       "K4_not_more_dangerous": k4, "passes": bool(k1 and k2 and k3 and k4)}
    passing = [c for c, v in verdicts.items() if v["passes"]]
    best = min(passing, key=lambda c: table[c]["weightedRmse_m"]) if passing else None

    log("\nυποψήφιος     ζυγ.RMSE  μεροληψία  " + "  ".join(f"{b:>7}" for b in JUDGED) + "   σοβ.υποεκτ.  περνάει")
    for c in CANDIDATES:
        t = table[c]
        bands_txt = "  ".join(f"{t['bands'].get(b, {}).get('rmse_m', float('nan')):7.3f}" for b in JUDGED)
        v = verdicts.get(c, {})
        log(f"  {c:11} {t['weightedRmse_m'] or float('nan'):8.3f}  {t['judgedOverall'].get('bias_pct', float('nan')):+8.1f}%  {bands_txt}"
            f"   {t['seriousUnderestimates']['pct']!s:>7}%   {'—' if c == 'current' else ('✓' if v.get('passes') else '✗ ' + ','.join(k[:2] for k, ok in v.items() if k != 'passes' and not ok))}")
    log("  n ανά ζώνη: " + " · ".join(f"{b} {cur['bands'].get(b, {}).get('n', 0)}" for b, *_ in [(lbl,) for *_, lbl in BANDS]))
    log(f"  συντελεστής ewam_cal (διασταύρωση): ζυγές {cal[0]:.3f} · μονές {cal[1]:.3f}")
    log(f"\nΠΡΟΤΑΣΗ: {best or 'ΚΑΝΕΝΑΣ — μένει το current'}")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "instrument": "παράκτια αλτίμετρα 1 χλμ., Copernicus WAVE_GLO_PHY_SWH_L3_NRT_014_001 (VAVH, value_qc 0)",
        "window": {"start": start, "end": end, "days": args.days},
        "method": {"bin_deg": BIN_DEG, "bin_seconds": BIN_SECONDS, "distance": f"ευκλείδεια από στεριά στη μάσκα {LAND_MASK_DATASET}",
                   "bands": [b[2] for b in BANDS], "judgedBands": JUDGED,
                   "weighting": "RMSE ανά κρινόμενη ζώνη × μερίδιο σημείων θάλασσας της σελίδας στη ζώνη"},
        "criteria": CRITERIA, "candidates": CANDIDATES,
        "pagePoints": {"n": len(page_pts), "byBand": dict(page_bands)},
        "satellites": per_sat, "comparisons": len(recs),
        "ewamCalFactors": {"evenDaysFromOdd": round(cal[0], 4), "oddDaysFromEven": round(cal[1], 4)},
        "table": table, "verdicts": verdicts, "recommendation": best,
    }
    out = write_report("reports/wave-model/altimetry-blend.json", payload)
    log(f"Αναφορά: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
