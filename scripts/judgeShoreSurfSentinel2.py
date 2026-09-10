"""
ΚΡΙΤΗΣ ΣΤΗΝ ΑΜΜΟ: ΣΚΑΕΙ ΚΥΜΑ ΣΤΗΝ ΠΑΡΑΛΙΑ; — Sentinel-2, 10 μ. (βίβλος §Γ74, 10/09/2026)

ΤΟ ΠΡΟΒΛΗΜΑ. Για τις παραλίες όπου η γεωμετρία μας λέει «βαθιά σκιά» (K_d < 0,5) οι μόνοι
«κριτές» που είχαμε ήταν μοντέλα κύματος με κελί 4-5 χλμ. (ewam, Copernicus). Το decision log
της 23/08 το γράφει ρητά: το Copernicus είναι δομικά λάθος κριτής για την ακτή — μετρά την
ανοιχτή θάλασσα 2-4 χλμ. έξω, όχι την άμμο.

Η ΙΔΕΑ. Όταν σκάει κύμα ~0,5 μ. και πάνω σε παραλία, αφήνει λωρίδα ΑΦΡΟΥ δεκάδων μέτρων που
φαίνεται στο κοντινό υπέρυθρο (B08, 10 μ.): το νερό εκεί είναι μαύρο (<0,03), ο αφρός φωτεινός.
Ο Sentinel-2 περνά πάνω από την Ελλάδα ~09:10-09:30 UTC κάθε 2-5 μέρες, από το 2017, δωρεάν
(AWS Earth Search, χωρίς κλειδί). Κάθε παραλία γίνεται ΣΥΓΚΡΙΣΗ ΜΕ ΤΟΝ ΕΑΥΤΟ ΤΗΣ:
  - ΚΛΕΙΣΤΗ: το ανοιχτό κύμα ≥0,8 μ. έρχεται από διεύθυνση όπου το K_d γεωμετρίας ≤ 0,2
  - ΑΝΟΙΧΤΗ: ≥0,8 μ. από διεύθυνση με K_d ≥ 0,9 (θετικός έλεγχος: εδώ ΠΡΕΠΕΙ να δούμε αφρό)
  - ΗΡΕΜΗ: ανοιχτό κύμα < 0,25 μ. (αρνητικός έλεγχος)
Αν η «κλειστή» μοιάζει με την «ήρεμη» → η σκιά είναι αληθινή. Αν μοιάζει με την «ανοιχτή» →
το κύμα φτάνει και η γεωμετρία σφάλλει. Αν ούτε η «ανοιχτή» δείχνει αφρό → το όργανο είναι
τυφλό σε αυτή την παραλία (βότσαλο/γκρεμός/μικτά pixel) — ΑΔΙΕΥΚΡΙΝΙΣΤΟ, όχι «ήρεμη».

ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, δηλωμένο πριν το αποτέλεσμα:
  - «καθόλου αφρός» σημαίνει «όχι κύμα που σκάει ~0,5 μ.+», ΟΧΙ «μηδέν κύμα». Ένα 0,2-0,3 μ.
    δεν αφήνει αφρό 10 μέτρων. Άρα ο κριτής ξεχωρίζει «0,1-0,3» από «0,7+», όχι «0,1» από «0,3».
  - στιγμιότυπο ~12:15 τοπική· το απόγευμα μπορεί να είναι αλλιώς.
  - ο καιρός της ώρας είναι Copernicus στο πλησιέστερο θαλάσσιο κελί, 09:00 UTC.

Run: python scripts/judgeShoreSurfSentinel2.py            (cache στο .tmp/s2judge/)
     node scripts/exportGeometricShadowKd.mjs <ids>  πρέπει να έχει τρέξει πρώτα.
"""
import json
import math
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

import numpy as np
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import open_dataset, SeaCellIndex, load_beaches, ROOT  # noqa: E402

STAC = "https://earth-search.aws.element84.com/v1/search"
WAVE_DATASET = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
SUMMERS = [2022, 2023, 2024, 2025, 2026]
MONTHS = (6, 7, 8, 9)
HALF_M = 1200           # μισό πλάτος παραθύρου γύρω από την πινέζα (240×240 pixel των 10 μ.)
SHORE_RADIUS_M = 300    # η «παραλία»: pixel ακτής μέσα σε τόση απόσταση από την πινέζα
BIG_M, CALM_M = 0.8, 0.25
CLOSED_KD, OPEN_KD = 0.2, 0.9
CAPS = {"closed": 30, "open": 6, "calm": 8}
CACHE = ROOT / ".tmp" / "s2judge"
WITNESSES = {2009, 1428, 2189, 1696}

GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", AWS_NO_SIGN_REQUEST="YES",
                GDAL_HTTP_MULTIRANGE="YES", GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
                CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", VSI_CACHE="TRUE", GDAL_HTTP_MAX_RETRY="3",
                GDAL_HTTP_RETRY_DELAY="2")


# ── 1. παραλίες + K_d γεωμετρίας ─────────────────────────────────────────────
CONTROLS = "--controls" in sys.argv  # θετικοί μάρτυρες: scripts/findExposedControlBeaches.mjs
# --capability: ΟΙ ΙΔΙΟΙ οι στόχοι, ΟΛΟ τον χρόνο, μόνο μέρες «ανοιχτής» διεύθυνσης (νοτιάδες του χειμώνα
# για παραλίες που κοιτάνε νότια). Απαντά «μπορεί το όργανο να δει αφρό σε ΑΥΤΗ τη λωρίδα άμμου;» —
# χωρίς αυτό, «καθόλου αφρός τις μέρες του βοριά» σε μια παραλία με βότσαλο/γκρεμό δεν σημαίνει τίποτα.
CAPABILITY = "--capability" in sys.argv
if CONTROLS:
    CAPS = {"closed": 0, "open": 25, "calm": 8}
if CAPABILITY:
    CAPS = {"closed": 0, "open": 12, "calm": 6}
    MONTHS = tuple(range(1, 13))
SUFFIX = "-all" if CAPABILITY else ""


def load_targets():
    if CONTROLS:
        rows = json.loads((CACHE / "controls.json").read_text(encoding="utf-8"))
    else:
        rows = json.loads((ROOT / "reports/quality/shadow-vs-blocked-arrival.json").read_text(encoding="utf-8"))["rows"]
    kd = json.loads((ROOT / ".tmp/shadow-kd-geometric.json").read_text(encoding="utf-8"))["beaches"]
    beaches = {(b["id"], b["regionFile"]): b for b in load_beaches()}  # regionFile = id περιοχής (όνομα αρχείου)
    out = []
    for r in rows:
        b = beaches.get((r["id"], r["region"]))
        if not b or str(r["id"]) not in kd:
            print(f"  παραλείπω #{r['id']} {r['name']} (χωρίς συντεταγμένες ή K_d)")
            continue
        out.append({"id": r["id"], "region": r["region"], "name": r["name"], "lat": b["lat"], "lon": b["lon"],
                    "deepShadow16Aug": bool(r.get("deepShadow")), "landKm": r.get("landKm"),
                    "kd": kd[str(r["id"])]["kd"], "facingDeg": kd[str(r["id"])]["facingDeg"]})
    return out


def kd_at(beach, deg):
    if deg is None or not math.isfinite(deg):
        return None
    return beach["kd"][int(round((deg % 360) / 5)) % 72]


# ── 2. ανοιχτό κύμα 09:00 UTC ανά μέρα (Copernicus, πλησιέστερο θαλάσσιο κελί) ─
def wave_series(targets):
    path = CACHE / f"waves{SUFFIX}.json"
    cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    todo = [t for t in targets if str(t["id"]) not in cache]
    if todo:
        ds = open_dataset(WAVE_DATASET)
        times = ds["time"].values
        t_idx = int(np.argmin(np.abs(times - np.datetime64("2026-08-16T09:00", "ns"))))
        index = SeaCellIndex(ds, "VHM0", time_index=t_idx)
        for t in todo:
            hit = index.nearest(t["lat"], t["lon"])
            if not hit:
                cache[str(t["id"])] = None
                continue
            clat, clon, dist = hit
            days = {}
            # Μικρό κουτί + μεγάλο χρονικό εύρος → το toolbox διαλέγει το αποθετήριο «χρονοσειράς»·
            # με το ανοιχτό σύνολο (χωρικά κομμάτια) η ίδια χρονοσειρά θα ήθελε χιλιάδες αναγνώσεις.
            ts = open_dataset(WAVE_DATASET, variables=["VHM0", "VMDR", "VTPK"],
                              minimum_longitude=clon - 0.02, maximum_longitude=clon + 0.02,
                              minimum_latitude=clat - 0.02, maximum_latitude=clat + 0.02,
                              start_datetime=f"{SUMMERS[0]}-{'01' if CAPABILITY else '06'}-01T00:00:00",
                              end_datetime=f"{SUMMERS[-1]}-09-30T23:00:00")
            sub = ts.sel(latitude=clat, longitude=clon, method="nearest")
            sub = sub.sel(time=(sub["time"].dt.hour == 9) & sub["time"].dt.month.isin(list(MONTHS))).load()
            for tt, h, d, p in zip(sub["time"].values, sub["VHM0"].values, sub["VMDR"].values, sub["VTPK"].values):
                if np.isfinite(h):
                    days[str(tt)[:10]] = [round(float(h), 2), round(float(d), 0), round(float(p), 1)]
            cache[str(t["id"])] = {"cell": [round(clat, 4), round(clon, 4), round(dist, 2)], "days": days}
            print(f"  κύμα #{t['id']} {t['name']}: {len(days)} μέρες, κελί {dist:.1f} χλμ")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(cache), encoding="utf-8")
    return cache


# ── 3. εικόνες Sentinel-2 (STAC) ──────────────────────────────────────────────
def scenes_for(t):
    path = CACHE / f"stac{SUFFIX}-{t['id']}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    found = {}
    for year in SUMMERS:
        span = f"{year}-01-01T00:00:00Z/{year}-12-31T23:59:59Z" if CAPABILITY else f"{year}-06-01T00:00:00Z/{year}-09-30T23:59:59Z"
        body = {"collections": ["sentinel-2-l2a"], "intersects": {"type": "Point", "coordinates": [t["lon"], t["lat"]]},
                "datetime": span, "limit": 200,
                "query": {"eo:cloud_cover": {"lt": 40}}}
        url, payload = STAC, body
        while url:
            r = requests.post(url, json=payload, timeout=60)
            r.raise_for_status()
            j = r.json()
            for f in j.get("features", []):
                day = f["properties"]["datetime"][:10]
                cc = f["properties"].get("eo:cloud_cover", 100)
                a = f["assets"]
                if "nir" not in a or "scl" not in a:
                    continue
                prev = found.get(day)
                if prev is None or cc < prev["cc"]:
                    found[day] = {"cc": cc, "id": f["id"], "dt": f["properties"]["datetime"],
                                  "nir": a["nir"]["href"], "scl": a["scl"]["href"], "visual": a.get("visual", {}).get("href"),
                                  "offsetApplied": f["properties"].get("earthsearch:boa_offset_applied"),
                                  "baseline": f["properties"].get("s2:processing_baseline")}
            nxt = next((l for l in j.get("links", []) if l.get("rel") == "next"), None)
            if nxt and nxt.get("body"):
                url, payload = nxt.get("href", STAC), nxt["body"]
            else:
                url = None
    path.write_text(json.dumps(found), encoding="utf-8")
    return found


def classify(beach, wave):
    h, d, _ = wave
    if h < CALM_M:
        return "calm"
    if h >= BIG_M:
        k = kd_at(beach, d)
        if k is not None and k <= CLOSED_KD:
            return "closed"
        if k is not None and k >= OPEN_KD:
            return "open"
    return None


# ── 4. ανάγνωση παραθύρου ─────────────────────────────────────────────────────
_env_lock = threading.Lock()


def read_window(href, lat, lon, half):
    import rasterio
    from rasterio.windows import from_bounds
    from rasterio.warp import transform
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(href) as src:
            xs, ys = transform("EPSG:4326", src.crs, [lon], [lat])
            win = from_bounds(xs[0] - half, ys[0] - half, xs[0] + half, ys[0] + half, src.transform)
            return src.read(1, window=win, boundless=True, fill_value=0)


def fetch_chip(t, day, sc):
    path = CACHE / f"chips-{HALF_M}" / f"{t['id']}-{day}.npz"
    if path.exists():
        z = np.load(path)
        return z["nir"], z["scl"]
    nir = read_window(sc["nir"], t["lat"], t["lon"], HALF_M).astype("float32")
    scl = read_window(sc["scl"], t["lat"], t["lon"], HALF_M).astype("uint8")
    # L2A από baseline 04.00 (2022+) κουβαλά BOA offset −1000· αν το Earth Search δεν το έχει αφαιρέσει, το αφαιρούμε εμείς
    offset = 0 if sc.get("offsetApplied") else 1000
    nir = (nir - offset) / 10000.0
    nir[nir < -0.05] = np.nan  # nodata / έξω από το πλακίδιο
    scl = np.repeat(np.repeat(scl, 2, axis=0), 2, axis=1)[: nir.shape[0], : nir.shape[1]]
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, nir=nir, scl=scl)
    return nir, scl


# ── 5. μέτρηση αφρού ───────────────────────────────────────────────────────────
def dilate(mask):
    m = mask.copy()
    m[1:, :] |= mask[:-1, :]; m[:-1, :] |= mask[1:, :]
    m[:, 1:] |= mask[:, :-1]; m[:, :-1] |= mask[:, 1:]
    m[1:, 1:] |= mask[:-1, :-1]; m[:-1, :-1] |= mask[1:, 1:]
    m[1:, :-1] |= mask[:-1, 1:]; m[:-1, 1:] |= mask[1:, :-1]
    return m


def distance_to_land(land, max_steps=40):
    """Απόσταση (σε pixel, Chebyshev) κάθε pixel νερού από την πλησιέστερη στεριά."""
    dist = np.full(land.shape, max_steps + 1, dtype="int16")
    front = land.copy()
    dist[land] = 0
    for step in range(1, max_steps + 1):
        grown = dilate(front)
        new = grown & ~front
        dist[new] = step
        front = grown
    return dist


def box_blur(a, passes=2):
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = sum(p[1 + dy:1 + dy + a.shape[0], 1 + dx:1 + dx + a.shape[1]]
                for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
    return a


def angdiff(a, b):
    return np.abs(((a - b) % 360 + 540) % 360 - 180)


FOAM_DAY = 0.2       # μερίδιο pixel με αφρό που λέμε «σκάει κύμα» στην παραλία
EXPOSED_FOAM = 0.1   # μερίδιο στην εκτεθειμένη ακτή που λέμε «εκεί έξω σκάει» (μακριά λωρίδα, πολλά pixel)
EXPOSED_MAX_DEG = 60  # ακτή «εκτεθειμένη» όταν η κάθετός της απέχει ≤60° από τη διεύθυνση του κύματος
GLINT_MAX = 0.04     # P90 του ανοιχτού νερού στο B08 από εκεί και πάνω = γυάλισμα, η μέρα δεν κρίνεται


def measure_beach(t, chips):
    """
    chips: [(day, cls, wave, nir, scl)] → μετρήσεις ανά μέρα.

    ΔΥΟ ΛΩΡΙΔΕΣ ΣΤΗΝ ΙΔΙΑ ΕΙΚΟΝΑ:
      - «παραλία»: pixel ακτής ≤300 μ. από την πινέζα
      - «εκτεθειμένη ακτή»: pixel ακτής >300 μ. από την πινέζα που ΚΟΙΤΑΝΕ το κύμα της ημέρας
        (κάθετος προς το νερό ≤60° από τη διεύθυνση άφιξης). Είναι ο θετικός έλεγχος ΤΗΣ ΙΔΙΑΣ
        ΣΤΙΓΜΗΣ: αν εκεί σκάει κύμα και στην παραλία όχι, η σκιά είναι αληθινή· αν δεν σκάει ούτε
        εκεί, η μέρα δεν κρίνει τίποτα (ή η θάλασσα δεν ήταν τόσο άγρια στην ακτή, ή το όργανο δεν βλέπει).
    """
    stack = []
    for _, _, _, nir, scl in chips:
        bad = np.isin(scl, [3, 8, 9, 10]) | ~np.isfinite(nir)
        x = nir.copy(); x[bad] = np.nan
        stack.append(x)
    stack = np.array(stack)
    # ΝΕΡΟ = pixel που έστω και στις πιο σκοτεινές του μέρες είναι μαύρο στο υπέρυθρο. ΟΧΙ P20:
    # οι μέρες του δείγματος είναι κυρίως μέρες βοριά, οπότε η ζώνη θραύσης μιας ΕΚΤΕΘΕΙΜΕΝΗΣ
    # παραλίας αφρίζει στις περισσότερες — με P20 γινόταν «στεριά» και ο θετικός έλεγχος δεν
    # μπορούσε ποτέ να δει αφρό (βρέθηκε 10/09 στη Μουτσούνα: η βόρεια παραλία με ορατό αφρό
    # στις 16/08 μετρούσε 0). Στεριά δεν πέφτει ποτέ κάτω από ~0,05 στο B08, ούτε βρεγμένη άμμος.
    with np.errstate(all="ignore"):
        p5 = np.nanpercentile(stack, 5, axis=0)
    known = np.isfinite(p5)
    water = known & (p5 < 0.025)
    land = known & ~water
    dist = distance_to_land(land)
    near_unknown = dilate(dilate(dilate(~known)))
    n = water.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    rpx = np.hypot(xx + 0.5 - n / 2, yy + 0.5 - n / 2) * 10.0
    coast = water & (dist >= 1) & (dist <= 3) & ~near_unknown
    beach = coast & (rpx <= SHORE_RADIUS_M)
    # κάθετος ακτής προς το νερό = κλίση της απόστασης από τη στεριά (γραμμή 0 = βορράς)
    g_row, g_col = np.gradient(box_blur(np.minimum(dist, 12).astype("float32")))
    normal_az = (np.degrees(np.arctan2(g_col, -g_row)) + 360) % 360
    far_coast = coast & (rpx > SHORE_RADIUS_M + 100)
    off = water & (dist >= 15)
    if off.sum() < 30:
        off = water & (dist >= 8)
    rows = []
    for (day, cls, wave, nir, scl), x in zip(chips, stack):
        cloudy_near = np.isin(scl, [3, 8, 9, 10]) & (rpx <= SHORE_RADIUS_M + 200)
        vb, vo = beach & np.isfinite(x), off & np.isfinite(x)
        if vb.sum() < 8 or vo.sum() < 20 or cloudy_near.mean() > 0.02:
            rows.append({"day": day, "class": cls, "wave": wave, "skipped": "σύννεφο/λίγα pixel"})
            continue
        o = x[vo]
        o90 = float(np.percentile(o, 90))
        if o90 >= GLINT_MAX:
            # Γυάλισμα ήλιου: όλη η επιφάνεια φωτίζεται και η λωρίδα της ακτής ξεπερνά το κατώφλι
            # χωρίς αφρό (04/07/2022 Μουτσούνα: «αφρός» 0,49 σε θάλασσα που απλώς γυάλιζε).
            rows.append({"day": day, "class": cls, "wave": wave, "skipped": f"γυάλισμα (P90 ανοιχτού {o90:.3f})"})
            continue
        thr = max(0.04, o90 + 0.02)
        exposed = far_coast & np.isfinite(x) & (angdiff(normal_az, wave[1]) <= EXPOSED_MAX_DEG)
        rows.append({"day": day, "class": cls, "wave": wave,
                     "beachFoam": round(float((x[vb] > thr).mean()), 3),
                     "exposedFoam": round(float((x[exposed] > thr).mean()), 3) if exposed.sum() >= 15 else None,
                     "exposedPx": int(exposed.sum()), "beachPx": int(vb.sum()), "thr": round(thr, 4)})
    return rows, int(beach.sum())


def summarize(rows):
    """
    Μέρα «κλειστής» διεύθυνσης κρίνεται μόνο χωρίς γυάλισμα, και η «σκιά» μόνο αν η εκτεθειμένη
    ακτή της ίδιας εικόνας ΕΧΕΙ αφρό:
      σκιά  = εκτεθειμένη ≥0,1 και παραλία < 0,05
      φτάνει = παραλία ≥0,2
    Όταν δεν αφρίζει ούτε η εκτεθειμένη ακτή, η μέρα δεν μετράει.
    """
    closed = [r for r in rows if r.get("class") == "closed" and "beachFoam" in r]
    calm = [r for r in rows if r.get("class") == "calm" and "beachFoam" in r]
    arrives = [r["day"] for r in closed if r["beachFoam"] >= FOAM_DAY]
    shadow = [r["day"] for r in closed if r["beachFoam"] < 0.05 and (r["exposedFoam"] or 0) >= EXPOSED_FOAM]
    blind = [r["day"] for r in closed if r["day"] not in arrives and r["day"] not in shadow]
    calm_false = [r["day"] for r in calm if r["beachFoam"] >= FOAM_DAY]
    judged = len(arrives) + len(shadow)
    if judged < 3:
        verdict = "αδιευκρίνιστο"
    elif len(arrives) >= 2 * len(shadow):
        verdict = "κύμα φτάνει"
    elif len(shadow) >= 2 * len(arrives):
        verdict = "σκιά αληθινή"
    else:
        verdict = "μικτό"
    if calm and len(calm_false) / len(calm) > 0.25:
        verdict += " (⚠ αφρός και σε ήρεμες μέρες — όργανο θορυβώδες εδώ)"
    return {"closedDays": len(closed), "arrivesDays": arrives, "shadowDays": shadow, "unjudgedDays": len(blind),
            "calmDays": len(calm), "calmFoamDays": calm_false, "verdict": verdict}


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    targets = load_targets()
    print(f"{len(targets)} παραλίες")
    waves = wave_series(targets)

    jobs = []
    for t in targets:
        w = waves.get(str(t["id"]))
        if not w:
            continue
        scenes = scenes_for(t)
        picked = {"closed": [], "open": [], "calm": []}
        for day, sc in scenes.items():
            if int(day[5:7]) not in MONTHS or day not in w["days"]:
                continue
            cls = classify(t, w["days"][day])
            if cls:
                picked[cls].append((day, sc, w["days"][day]))
        chosen = []
        for cls, lst in picked.items():
            key = (lambda x: (-x[2][0], x[1]["cc"])) if cls != "calm" else (lambda x: (x[1]["cc"], x[2][0]))
            for day, sc, wv in sorted(lst, key=key)[: CAPS[cls]]:
                chosen.append((t, day, cls, wv, sc))
        print(f"  #{t['id']} {t['name']}: εικόνες {len(scenes)} · κλειστή {len(picked['closed'])} ανοιχτή {len(picked['open'])} ήρεμη {len(picked['calm'])}")
        jobs.extend(chosen)

    print(f"\nδιαβάζω {len(jobs)} παράθυρα …")
    results = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(fetch_chip, t, day, sc): (t, day, cls, wv) for t, day, cls, wv, sc in jobs}
        done = 0
        for fut in as_completed(futs):
            t, day, cls, wv = futs[fut]
            done += 1
            try:
                nir, scl = fut.result()
                results.setdefault(t["id"], []).append((day, cls, wv, nir, scl))
            except Exception as e:  # noqa: BLE001 — ένα χαλασμένο παράθυρο δεν ρίχνει τη μέτρηση
                print(f"  ✗ #{t['id']} {day}: {str(e)[:120]}")
            if done % 100 == 0:
                print(f"  … {done}/{len(jobs)}")

    judged_path = ROOT / "reports/wave-model/shadow-candidates-judge.json"
    candidates = {r["id"]: r for r in json.loads(judged_path.read_text(encoding="utf-8"))["rows"]} if judged_path.exists() else {}
    report = []
    print(f"\n{'παραλία':<26} {'ομάδα':>9} {'κλειστές':>8} {'φτάνει':>6} {'σκιά':>5} {'άκριτες':>7} {'ήρεμες(αφρ)':>11}  ετυμηγορία")
    print("-" * 104)
    for t in targets:
        chips = sorted(results.get(t["id"], []), key=lambda c: c[0])
        if len(chips) < 5:
            print(f"{t['name'][:26]:<26} — λίγες εικόνες ({len(chips)})")
            continue
        rows, shore_px = measure_beach(t, chips)
        if CONTROLS or CAPABILITY:
            op = [r for r in rows if r.get("class") == "open" and "beachFoam" in r]
            hits = [r for r in op if r["beachFoam"] >= FOAM_DAY]
            calm = [r for r in rows if r.get("class") == "calm" and "beachFoam" in r]
            s = {"openDays": len(op), "openFoamDays": len(hits), "calmDays": len(calm),
                 "calmFoamDays": sum(1 for r in calm if r["beachFoam"] >= FOAM_DAY),
                 "glintSkipped": sum(1 for r in rows if str(r.get("skipped", "")).startswith("γυάλισμα"))}
            print(f"{t['name'][:26]:<26} ανοιχτές {s['openDays']:>3} με αφρό {s['openFoamDays']:>3} · ήρεμες {s['calmDays']} με αφρό {s['calmFoamDays']} · γυάλισμα {s['glintSkipped']}")
            report.append({"id": t["id"], "region": t["region"], "name": t["name"], "summary": s, "days": rows})
            continue
        s = summarize(rows)
        c = candidates.get(t["id"])
        group = "μάρτυρας" if t["id"] in WITNESSES else ("+16" if c and c.get("judgeSeesWave") and c.get("ewam_m", 0) >= 0.5 else ("23-άλλη" if c else "44"))
        print(f"{t['name'][:26]:<26} {group:>9} {s['closedDays']:>8} {len(s['arrivesDays']):>6} {len(s['shadowDays']):>5} {s['unjudgedDays']:>7} "
              f"{s['calmDays']:>6}({len(s['calmFoamDays'])})  {s['verdict']}")
        report.append({"id": t["id"], "region": t["region"], "name": t["name"], "lat": t["lat"], "lon": t["lon"],
                       "group": group, "witness": t["id"] in WITNESSES,
                       "shorePixels": shore_px, "summary": s, "days": rows})

    if CONTROLS or CAPABILITY:
        op = sum(b["summary"]["openDays"] for b in report)
        hit = sum(b["summary"]["openFoamDays"] for b in report)
        cd = sum(b["summary"]["calmDays"] for b in report)
        cf = sum(b["summary"]["calmFoamDays"] for b in report)
        print(f"\nΕΥΑΙΣΘΗΣΙΑ ΟΡΓΑΝΟΥ: αφρός σε {hit}/{op} ανοιχτές μέρες ({(hit / op * 100 if op else 0):.0f}%) · "
              f"ψεύτικος αφρός σε {cf}/{cd} ήρεμες ({(cf / cd * 100 if cd else 0):.0f}%)")
    out = ROOT / ("reports/wave-model/shore-surf-sentinel2-controls.json" if CONTROLS else
                  "reports/wave-model/shore-surf-sentinel2-capability.json" if CAPABILITY else
                  "reports/wave-model/shore-surf-sentinel2.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "question": "Σκάει κύμα στην παραλία τις μέρες που το ανοιχτό κύμα έρχεται από «κλειστή» μεριά;",
        "method": "Sentinel-2 L2A B08 10 μ., αφρός = pixel λωρίδας ακτής (10-30 μ. από τη σταθερή στεριά) με NIR > max(0,04, P90 ανοιχτού νερού + 0,02). Παραλία = λωρίδα ≤300 μ. από την πινέζα· θετικός έλεγχος ίδιας εικόνας = λωρίδα >400 μ. που κοιτάει το κύμα της ημέρας (≤60°). Κύμα: Copernicus MEDSEA 09:00 UTC. K_d: γεωμετρία χωρίς εξαίρεση μαρτύρων.",
        "classes": {"closed": f"ανοιχτό ≥{BIG_M} μ. από K_d ≤{CLOSED_KD}", "open": f"ανοιχτό ≥{BIG_M} μ. από K_d ≥{OPEN_KD}", "calm": f"ανοιχτό <{CALM_M} μ."},
        "caveat": "Καθόλου αφρός = όχι κύμα που σκάει ~0,5 μ.+, όχι μηδέν κύμα. Στιγμιότυπο ~12:15 τοπική.",
        "beaches": report,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nΑναφορά: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
