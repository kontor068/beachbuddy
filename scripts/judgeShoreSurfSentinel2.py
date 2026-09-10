"""
ΚΡΙΤΗΣ ΣΤΗΝ ΑΜΜΟ: ΣΚΑΕΙ ΚΥΜΑ ΣΤΗΝ ΠΑΡΑΛΙΑ; — Sentinel-2, 10 μ. (βίβλος §Γ75, 10/09/2026)

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

ΓΙΑΤΙ ΤΡΕΧΕΙ ΣΕ ΛΕΠΤΑ ΚΑΙ ΟΧΙ ΣΕ 16 ΩΡΕΣ (10/09 βράδυ, για τον πανελλαδικό). Η πρώτη εκδοχή
ρωτούσε τα πάντα ΑΝΑ ΠΑΡΑΛΙΑ· τα τρία ακριβά κομμάτια ομαδοποιούνται πια εκεί που ζουν τα δεδομένα:
  - κύμα: το αποθετήριο χρονοσειράς του Copernicus είναι κομμένο σε κουτιά 16×16 κελιών — ένα
    κελί κοστίζει όσο όλο το κουτί (~9 δευτ.). Φορτώνεται μία φορά ανά κουτί, όχι ανά παραλία.
  - κατάλογος εικόνων: μία αναζήτηση ανά μήνα για όλη την Ελλάδα και έλεγχος «πέφτει η πινέζα
    μέσα στο αποτύπωμα» εδώ, αντί για 5 αναζητήσεις ανά παραλία.
  - παράθυρα: κάθε εικόνα ανοίγει ΜΙΑ φορά (το άνοιγμα από τις ΗΠΑ κοστίζει ~1,5 δευτ.) και δίνει
    τα παράθυρα όλων των παραλιών της· τα γειτονικά μοιράζονται τα ίδια κομμάτια 10×10 χλμ.
    Μετρημένο: 11 παράθυρα 0,9 δευτ. αντί για 14, pixel-προς-pixel ίδια. Στις άκρες της εικόνας
    κρατιέται ο παλιός τρόπος ανάγνωσης (γεμίζει το έξω), ώστε το αποτέλεσμα να μην αλλάζει.
Η ΜΕΤΡΗΣΗ του αφρού (measure_beach / summarize) δεν άλλαξε — επαληθευμένο στις 44: 868/868 μέρες
(καλοκαίρι) και 438/438 (όλος ο χρόνος) ίδιες μέχρι το τελευταίο ψηφίο. Μία μόνο διόρθωση μπήκε μετά,
χωριστά μετρημένη: το «κενό» του δορυφόρου (SCL 0) δεν διαβάζεται πια ως μαύρη θάλασσα (βλ. measure_beach).

Run: python scripts/judgeShoreSurfSentinel2.py            (οι 44 της 16/08· cache στο .tmp/s2judge/)
     python scripts/judgeShoreSurfSentinel2.py --national  (κάθε παραλία → .tmp/s2judge/national-days.json,
                                                           μετά scripts/summarizeShoreSurfNational.py)
     node scripts/exportGeometricShadowKd.mjs <ids>|--all  πρέπει να έχει τρέξει πρώτα.
"""
import json
import math
import os
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from datetime import datetime, timezone, date

# Κοινή μνήμη κομματιών εικόνας για όλα τα νήματα — πρέπει να οριστεί πριν φορτωθεί το GDAL.
os.environ.setdefault("GDAL_CACHEMAX", "4096")

import numpy as np
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import open_dataset, SeaCellIndex, load_beaches, ROOT, GREECE_BBOX  # noqa: E402

STAC = "https://earth-search.aws.element84.com/v1/search"
WAVE_DATASET = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
SUMMERS = [2022, 2023, 2024, 2025, 2026]
MONTHS = (6, 7, 8, 9)
ALL_MONTHS = tuple(range(1, 13))
HALF_M = 1200           # μισό πλάτος παραθύρου γύρω από την πινέζα (240×240 pixel των 10 μ.)
SHORE_RADIUS_M = 300    # η «παραλία»: pixel ακτής μέσα σε τόση απόσταση από την πινέζα
BIG_M, CALM_M = 0.8, 0.25
# «Λέμε ήρεμη» στον πανελλαδικό: από 0,5 μ. ανοιχτό (όχι 0,8). Με 0,8 κρίθηκαν μόνο 436 παραλίες —
# οι μέρες με τέτοιο κύμα από «κλειστή» μεριά είναι σπάνιες. Στα 0,5-0,8 μ. τυπώνουμε ≤0,16 μ.· αν εκεί
# σκάει κύμα που αφήνει αφρό, η αντίφαση είναι καθαρή (11/09/2026, 2ο πέρασμα). Το «ανοιχτή» μένει 0,8:
# η ευαισθησία του οργάνου (84%) μετρήθηκε εκεί.
CLOSED_MIN_M = 0.5
CLOSED_KD, OPEN_KD = 0.2, 0.9
CAPS = {"closed": 30, "open": 6, "calm": 8}
CACHE = ROOT / ".tmp" / "s2judge"
CHIPS = CACHE / f"chips2-{HALF_M}"   # ωμά DN (uint16) + SCL 20 μ.· η μετατροπή γίνεται στο φόρτωμα
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
# --national: ΚΑΘΕ παραλία, όλες οι ομάδες σε ΕΝΑ πέρασμα. «Κλειστή» μόνο στη σεζόν μπάνιου (Μάι-Οκτ: εκεί
# μετράει τι λέμε)· «ανοιχτή» και «ήρεμη» όλο τον χρόνο (το χειμωνιάτικο νοτιά είναι ο μόνος θετικός
# έλεγχος για ακτές που το καλοκαίρι είναι πάντα σε σκιά). --dry: σταματά μετά το πλάνο.
NATIONAL = "--national" in sys.argv
DRY = "--dry" in sys.argv
CAPS["refused"] = 0      # μόνο στον πανελλαδικό: «τυπώνουμε όλο το κύμα ενώ η γεωμετρία βλέπει σκιά»
CLASS_MONTHS = {"closed": MONTHS, "open": MONTHS, "refused": MONTHS, "calm": MONTHS}
if CONTROLS:
    CAPS = {"closed": 0, "open": 25, "refused": 0, "calm": 8}
if CAPABILITY:
    CAPS = {"closed": 0, "open": 12, "refused": 0, "calm": 6}
    CLASS_MONTHS = {"closed": ALL_MONTHS, "open": ALL_MONTHS, "refused": ALL_MONTHS, "calm": ALL_MONTHS}
if NATIONAL:
    # Πλάνο 10/09 με 24/16/10/10: 63.286 παράθυρα σε 4.544 εικόνες — μισή ώρα, όχι νύχτα. Το περιθώριο
    # πάει σε περισσότερες μέρες ανά παραλία (μόνο ~40% κρίνονται: γυάλισμα/σύννεφο) και η «κλειστή»
    # απλώνεται σε ΟΛΗ τη σεζόν μπάνιου (Μάι-Οκτ): οι «κλειστές» ήταν κατά μέσο όρο 4,6 ανά παραλία.
    CAPS = {"closed": 60, "open": 24, "refused": 16, "calm": 12}
    CLASS_MONTHS = {"closed": (5, 6, 7, 8, 9, 10), "open": ALL_MONTHS, "refused": ALL_MONTHS, "calm": ALL_MONTHS}
SUFFIX = "-all" if CAPABILITY else ""


def load_targets():
    kd = json.loads((ROOT / ".tmp/shadow-kd-geometric.json").read_text(encoding="utf-8"))["beaches"]
    if NATIONAL:
        out = []
        for b in load_beaches():
            if str(b["id"]) not in kd:
                print(f"  παραλείπω #{b['id']} {b['name']} (χωρίς K_d)")
                continue
            out.append({"id": b["id"], "region": b["regionFile"], "name": b["name"], "lat": b["lat"], "lon": b["lon"],
                        "kd": kd[str(b["id"])]["kd"], "say": kd[str(b["id"])]["say"], "facingDeg": kd[str(b["id"])]["facingDeg"]})
        return out
    if CONTROLS:
        rows = json.loads((CACHE / "controls.json").read_text(encoding="utf-8"))
    else:
        rows = json.loads((ROOT / "reports/quality/shadow-vs-blocked-arrival.json").read_text(encoding="utf-8"))["rows"]
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


def kd_at(beach, deg, key="kd"):
    if deg is None or not math.isfinite(deg):
        return None
    return beach[key][int(round((deg % 360) / 5)) % 72]


# ── 2. ανοιχτό κύμα 09:00 UTC ανά μέρα (Copernicus, πλησιέστερο θαλάσσιο κελί) ─
def _cell_key(cell):
    return f"{cell[0]:.4f},{cell[1]:.4f}"


def wave_series(targets):
    """
    → {beachId: {"cell": [lat, lon, km], "days": {YYYY-MM-DD: [Hs, dir, Tp]}}}, όλοι οι μήνες 2022→σήμερα.

    Η χρονοσειρά ζει ανά ΚΕΛΙ, όχι ανά παραλία (δεκάδες παραλίες μοιράζονται κελί), και φορτώνεται ανά
    κουτί του αποθετηρίου: ένα κελί κοστίζει όσο και τα 256 του κουτιού του.
    """
    path = CACHE / "waves-cells.json"
    cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"beachCell": {}, "cells": {}}
    todo = [t for t in targets if str(t["id"]) not in cache["beachCell"]]
    if todo:
        ds = open_dataset(WAVE_DATASET)
        times = ds["time"].values
        t_idx = int(np.argmin(np.abs(times - np.datetime64("2026-08-16T09:00", "ns"))))
        index = SeaCellIndex(ds, "VHM0", time_index=t_idx)
        for t in todo:
            hit = index.nearest(t["lat"], t["lon"])
            cache["beachCell"][str(t["id"])] = [round(hit[0], 4), round(hit[1], 4), round(hit[2], 2)] if hit else None
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(cache), encoding="utf-8")

    wanted = {}
    for t in targets:
        cell = cache["beachCell"].get(str(t["id"]))
        if cell and _cell_key(cell) not in cache["cells"]:
            wanted[_cell_key(cell)] = cell
    if wanted:
        end = date.today().isoformat()
        # Ο κάνναβος και τα όρια των κουτιών του αποθετηρίου: άνοιγμα μίας ώρας, χωρίς φόρτωμα.
        grid = open_dataset(WAVE_DATASET, variables=["VHM0"], service="arco-time-series",
                            start_datetime=f"{end}T00:00:00", end_datetime=f"{end}T01:00:00")
        lats, lons = grid["latitude"].values, grid["longitude"].values
        pc = grid["VHM0"].encoding.get("preferred_chunks") or {}
        cl_lat, cl_lon = int(pc.get("latitude", 16)), int(pc.get("longitude", 16))
        step = float(abs(lats[1] - lats[0]))
        blocks = defaultdict(list)
        for key, (clat, clon, _) in wanted.items():
            i, j = int(np.argmin(np.abs(lats - clat))), int(np.argmin(np.abs(lons - clon)))
            blocks[(i // cl_lat, j // cl_lon)].append((key, i, j))
        print(f"  κύμα: {len(wanted)} κελιά σε {len(blocks)} κουτιά {cl_lat}×{cl_lon} …", flush=True)
        lock = threading.Lock()

        def load_block(bk):
            bi, bj = bk
            la = lats[bi * cl_lat:(bi + 1) * cl_lat]
            lo = lons[bj * cl_lon:(bj + 1) * cl_lon]
            # Άνοιγμα ΜΕ τα όρια του κουτιού. Χωρίς αυτά (όλη η Μεσόγειος) το dask κόβει κομμάτια πολλών
            # κουτιών μαζί και κάθε φόρτωμα κατέβαζε πολλαπλάσια — 10/09: >8′ χωρίς να τελειώσει ούτε ένα.
            sub = open_dataset(WAVE_DATASET, variables=["VHM0", "VMDR", "VTPK"], service="arco-time-series",
                               minimum_latitude=float(la.min()) - step / 4, maximum_latitude=float(la.max()) + step / 4,
                               minimum_longitude=float(lo.min()) - step / 4, maximum_longitude=float(lo.max()) + step / 4,
                               start_datetime=f"{SUMMERS[0]}-01-01T00:00:00", end_datetime=f"{end}T23:00:00")
            sub = sub.sel(time=sub["time"].dt.hour == 9).load()
            day_str = [str(v)[:10] for v in sub["time"].values]
            got = {}
            for key, i, j in blocks[bk]:
                s = sub.sel(latitude=lats[i], longitude=lons[j], method="nearest")
                h, d, p = s["VHM0"].values, s["VMDR"].values, s["VTPK"].values
                got[key] = {day_str[k]: [round(float(h[k]), 2), round(float(d[k]), 0), round(float(p[k]), 1)]
                            for k in range(len(day_str)) if np.isfinite(h[k])}
            return got

        done = 0
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = {pool.submit(load_block, bk): bk for bk in blocks}
            for fut in as_completed(futs):
                try:
                    got = fut.result()
                except Exception as e:  # noqa: BLE001 — ξαναδοκιμή μία φορά, σειριακά
                    print(f"  ✗ κουτί {futs[fut]}: {str(e)[:120]} — ξαναδοκιμή")
                    got = load_block(futs[fut])
                with lock:
                    cache["cells"].update(got)
                    done += 1
                    if done % 10 == 0 or done == len(blocks):
                        path.write_text(json.dumps(cache), encoding="utf-8")
                        print(f"  … κουτιά {done}/{len(blocks)}", flush=True)
    out = {}
    for t in targets:
        cell = cache["beachCell"].get(str(t["id"]))
        out[str(t["id"])] = {"cell": cell, "days": cache["cells"].get(_cell_key(cell), {})} if cell else None
    return out


# ── 3. εικόνες Sentinel-2: κατάλογος ανά μήνα για όλη την Ελλάδα ─────────────
def _stac_pages(body):
    url, payload = STAC, body
    while url:
        for attempt in range(6):
            try:
                r = requests.post(url, json=payload, timeout=120)
                if r.status_code in (429, 500, 502, 503, 504):
                    raise requests.HTTPError(f"{r.status_code}")
                r.raise_for_status()
                break
            except (requests.RequestException, ValueError) as e:
                if attempt == 5:
                    raise
                time.sleep(3 * (attempt + 1))
        j = r.json()
        yield j.get("features", [])
        nxt = next((l for l in j.get("links", []) if l.get("rel") == "next"), None)
        url, payload = (nxt.get("href", STAC), nxt["body"]) if nxt and nxt.get("body") else (None, None)


def catalog_month(ym):
    """Όλες οι εικόνες L2A με σύννεφο <40% ενός μήνα πάνω από την Ελλάδα, συμπαγείς (χωρίς τα 30 assets)."""
    path = CACHE / "catalog" / f"{ym}.json"
    fresh_enough = path.exists() and (ym != date.today().strftime("%Y-%m") or time.time() - path.stat().st_mtime < 12 * 3600)
    if fresh_enough:
        return json.loads(path.read_text(encoding="utf-8"))
    y, m = int(ym[:4]), int(ym[5:])
    last = (date(y + (m == 12), m % 12 + 1, 1) - date.resolution).day
    body = {"collections": ["sentinel-2-l2a"],
            "bbox": [GREECE_BBOX["lon_min"], GREECE_BBOX["lat_min"], GREECE_BBOX["lon_max"], GREECE_BBOX["lat_max"]],
            "datetime": f"{ym}-01T00:00:00Z/{ym}-{last:02d}T23:59:59Z", "limit": 200,
            "query": {"eo:cloud_cover": {"lt": 40}}}
    items = []
    for feats in _stac_pages(body):
        for f in feats:
            a, p = f["assets"], f["properties"]
            if "nir" not in a or "scl" not in a or not f.get("geometry"):
                continue
            g = f["geometry"]
            polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
            items.append({"id": f["id"], "dt": p["datetime"], "cc": p.get("eo:cloud_cover", 100),
                          "nir": a["nir"]["href"], "scl": a["scl"]["href"], "visual": a.get("visual", {}).get("href"),
                          "offsetApplied": p.get("earthsearch:boa_offset_applied"),
                          "baseline": p.get("s2:processing_baseline"),
                          "polys": [[[[round(x, 5), round(y_, 5)] for x, y_ in ring] for ring in poly] for poly in polys]})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items), encoding="utf-8")
    return items


def _in_ring(px, py, ring):
    """Άρτιος-περιττός κανόνας, διανυσματικά: σημεία (P,) μέσα σε έναν δακτύλιο (N κορυφές)."""
    r = np.asarray(ring, dtype="float64")
    x1, y1 = r[:, 0][:, None], r[:, 1][:, None]
    x2, y2 = np.roll(r[:, 0], -1)[:, None], np.roll(r[:, 1], -1)[:, None]
    with np.errstate(divide="ignore", invalid="ignore"):
        cross = ((y1 > py) != (y2 > py)) & (px < (x2 - x1) * (py - y1) / (y2 - y1) + x1)
    return np.logical_xor.reduce(cross, axis=0)


def scenes_by_beach(targets):
    """
    → [{day: σκηνή}] ανά στόχο: η εικόνα με το λιγότερο σύννεφο ανάμεσα σε όσες το αποτύπωμά τους
    περιέχει την πινέζα — ό,τι έδινε η αναζήτηση «intersects: Point» ανά παραλία.
    """
    months_needed = sorted(set().union(*(CLASS_MONTHS[c] for c, n in CAPS.items() if n)))
    today = date.today()
    yms = [f"{y}-{m:02d}" for y in SUMMERS for m in months_needed if date(y, m, 1) <= today]
    lon = np.array([t["lon"] for t in targets])
    lat = np.array([t["lat"] for t in targets])
    found = [dict() for _ in targets]
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(catalog_month, ym): ym for ym in yms}
        cats = {}
        for fut in as_completed(futs):
            cats[futs[fut]] = fut.result()
    n_items = 0
    for ym in yms:
        for it in cats[ym]:
            # 40/52.538 εικόνες (10/09) δείχνουν JP2 στο bucket «ο αιτών πληρώνει» — αδιάβαστες χωρίς κλειδί.
            # Αν κερδίσουν τη μέρα (λιγότερο σύννεφο), η παραλία χάνει τη μέρα· έξω, ώστε να πάρει την επόμενη.
            if not it["nir"].startswith("https://"):
                continue
            n_items += 1
            inside = np.zeros(len(targets), dtype=bool)
            for poly in it["polys"]:
                outer = np.asarray(poly[0])
                cand = np.nonzero((lon >= outer[:, 0].min()) & (lon <= outer[:, 0].max()) &
                                  (lat >= outer[:, 1].min()) & (lat <= outer[:, 1].max()))[0]
                if not cand.size:
                    continue
                hit = _in_ring(lon[cand], lat[cand], poly[0])
                for hole in poly[1:]:
                    hit &= ~_in_ring(lon[cand], lat[cand], hole)
                inside[cand[hit]] = True
            day = it["dt"][:10]
            for k in np.nonzero(inside)[0]:
                prev = found[k].get(day)
                # λιγότερο σύννεφο· ισοπαλία → το ίδιο κάθε φορά (όχι «όποιο ήρθε πρώτο από το API»)
                if prev is None or (it["cc"], it["id"]) < (prev["cc"], prev["id"]):
                    found[k][day] = it
    print(f"  κατάλογος: {n_items} εικόνες σε {len(yms)} μήνες")
    return found


def classify(beach, wave):
    h, d, _ = wave
    if h < CALM_M:
        return "calm"
    if h >= CLOSED_MIN_M and NATIONAL:
        # «ΤΙ ΛΕΜΕ», όχι σκέτη γεωμετρία: η σελίδα δίνει την έκπτωση K_d μόνο σε ακτή που την κερδίζει
        # (shoreSeaStateM). Μετρημένο 10/09: σε 8.202 συνδυασμούς παραλίας × διεύθυνσης το K_d λέει βαθιά
        # σκιά (≤0,2) κι όμως τυπώνουμε ΟΛΟ το κύμα — αυτές ΔΕΝ είναι μέρες που «λέμε ήρεμη».
        s, k = kd_at(beach, d, "say"), kd_at(beach, d)
        if s is not None and s <= CLOSED_KD:
            return "closed"                 # τυπώνουμε ≤ 1/5 του ανοιχτού
        if h < BIG_M:
            return None                     # 0,5-0,8 μ. μετράει μόνο για το «λέμε ήρεμη»
        if s is not None and s >= OPEN_KD:
            # τυπώνουμε σχεδόν όλο το ύψος· «open» = και η γεωμετρία το λέει ανοιχτό (καθαρός θετικός
            # έλεγχος), «refused» = η γεωμετρία βλέπει σκιά αλλά η πύλη αρνήθηκε την έκπτωση
            return "open" if (k is not None and k >= OPEN_KD) else "refused"
        return None
    if h >= BIG_M:
        k = kd_at(beach, d)
        if k is not None and k <= CLOSED_KD:
            return "closed"
        if k is not None and k >= OPEN_KD:
            return "open"
    return None


# ── 4. ανάγνωση παραθύρων: μία εικόνα ανοίγει μία φορά ─────────────────────────
def chip_path(t, day):
    return CHIPS / f"{t['id']}-{day}.npz"


def _read_win(src, x, y, half):
    from rasterio.windows import from_bounds, Window
    win = from_bounds(x - half, y - half, x + half, y + half, src.transform)
    r0, c0 = int(round(win.row_off)), int(round(win.col_off))
    h, w = int(round(win.height)), int(round(win.width))
    if r0 >= 0 and c0 >= 0 and r0 + h <= src.height and c0 + w <= src.width:
        # Μέσα στην εικόνα: απευθείας ανάγνωση από τα κομμάτια που έχει ήδη φέρει το ίδιο άνοιγμα.
        # Ίδια pixel με το boundless (το «πλησιέστερο» του VRT στρογγυλεύει την ίδια αρχή).
        return src.read(1, window=Window(c0, r0, w, h))
    # Στην άκρη: ο παλιός δρόμος, που γεμίζει με 0 ό,τι πέφτει έξω.
    return src.read(1, window=win, boundless=True, fill_value=0)


def fetch_scene(sc, members):
    """members: [(στόχος, μέρα)] που θέλουν ΑΥΤΗ την εικόνα → γράφει ένα .npz ανά παράθυρο."""
    todo = [(t, day) for t, day in members if not chip_path(t, day).exists()]
    if not todo:
        return 0, 0
    import rasterio
    from rasterio.warp import transform
    todo.sort(key=lambda m: (-m[0]["lat"], m[0]["lon"]))  # γειτονικά παράθυρα διαδοχικά → ίδια κομμάτια στη μνήμη
    last = None
    for attempt in range(3):
        try:
            written = 0
            with rasterio.Env(**GDAL_ENV):
                with rasterio.open(sc["nir"]) as nsrc, rasterio.open(sc["scl"]) as ssrc:
                    xs, ys = transform("EPSG:4326", nsrc.crs, [t["lon"] for t, _ in todo], [t["lat"] for t, _ in todo])
                    for (t, day), x, y in zip(todo, xs, ys):
                        path = chip_path(t, day)
                        if path.exists():
                            continue
                        nir = _read_win(nsrc, x, y, HALF_M).astype("uint16")
                        scl = _read_win(ssrc, x, y, HALF_M).astype("uint8")
                        tmp = path.with_suffix(".part")
                        with open(tmp, "wb") as fh:
                            np.savez_compressed(fh, nir=nir, scl=scl, off=np.int16(0 if sc.get("offsetApplied") else 1000))
                        os.replace(tmp, path)
                        written += 1
            return written, 0
        except Exception as e:  # noqa: BLE001 — ένα χαλασμένο πέρασμα δεν ρίχνει τη νύχτα
            last = e
            time.sleep(2 * (attempt + 1))
    print(f"  ✗ {sc['id']}: {str(last)[:120]}", flush=True)
    return 0, len(todo)


def load_chip(path):
    z = np.load(path)
    raw = z["nir"]
    # L2A από baseline 04.00 (2022+) κουβαλά BOA offset −1000· αν το Earth Search δεν το έχει αφαιρέσει, το αφαιρούμε εμείς
    nir = (raw.astype("float32") - int(z["off"])) / 10000.0
    nir[nir < -0.05] = np.nan  # nodata / έξω από το πλακίδιο
    scl = np.repeat(np.repeat(z["scl"], 2, axis=0), 2, axis=1)[: nir.shape[0], : nir.shape[1]]
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
        # SCL 0 = «καμία μέτρηση» (έξω από τη λωρίδα του δορυφόρου / το πλακίδιο). Ως τις 10/09 δεν ήταν
        # στη μάσκα: όταν το Earth Search έχει ήδη αφαιρέσει το offset (97% των εικόνων) το κενό διαβαζόταν
        # ανάκλαση 0,00 — «μαύρη ήρεμη θάλασσα» — ψεύτικο νερό στη μάσκα P5 και ψεύτικο «καθόλου αφρός».
        # ΟΧΙ «DN = 0»: μετρημένο στα 1.123 παράθυρα των 44, το 0,5% των μηδενικών είναι αληθινό σκοτεινό
        # νερό (SCL 6) που το Earth Search κόβει στο 0.
        bad = np.isin(scl, [0, 3, 8, 9, 10]) | ~np.isfinite(nir)
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
    # Η ΕΞΩΤΕΡΙΚΗ λωρίδα (20-30 μ. από τη σταθερή στεριά). Κύμα που σκάει αφήνει ζώνη αφρού δεκάδων
    # μέτρων· ό,τι φωτίζεται ΜΟΝΟ στο πρώτο pixel μπορεί να είναι βρεγμένη άμμος που ξεσκεπάστηκε με
    # απόγειο αέρα, βάρκα στο μουράγιο ή μικτό pixel. Βρέθηκε με το μάτι 10/09 (πανελλαδικός: Χάρακας #75).
    beach_outer = beach & (dist >= 2)
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
        vbo = beach_outer & np.isfinite(x)
        rows.append({"day": day, "class": cls, "wave": wave,
                     "beachFoam": round(float((x[vb] > thr).mean()), 3),
                     "beachFoamOuter": round(float((x[vbo] > thr).mean()), 3) if vbo.sum() >= 5 else None,
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


def measure_from_disk(t, chosen):
    """Για τη διεργασία-εργάτη: φορτώνει τα παράθυρα ΜΙΑΣ παραλίας από τον δίσκο και τα μετρά."""
    chips = []
    for day, cls, wv in chosen:
        p = chip_path(t, day)
        if p.exists():
            nir, scl = load_chip(p)
            chips.append((day, cls, wv, nir, scl))
    chips.sort(key=lambda c: c[0])
    if len(chips) < 5:
        return t["id"], None, 0, len(chips)
    rows, shore_px = measure_beach(t, chips)
    return t["id"], rows, shore_px, len(chips)


# ── 6. πλάνο → κατέβασμα ανά εικόνα → μέτρηση ανά παραλία ──────────────────────
def plan_jobs(targets, waves, scenes):
    """→ ({beachId: [(day, cls, wave)]}, {sceneId: (σκηνή, [(στόχος, μέρα)])})"""
    by_beach, by_scene = {}, {}
    counts = defaultdict(int)
    for t, sc_days in zip(targets, scenes):
        w = waves.get(str(t["id"]))
        if not w:
            continue
        picked = {"closed": [], "open": [], "refused": [], "calm": []}
        for day, sc in sc_days.items():
            if day not in w["days"]:
                continue
            cls = classify(t, w["days"][day])
            if cls and CAPS[cls] and int(day[5:7]) in CLASS_MONTHS[cls]:
                picked[cls].append((day, sc, w["days"][day]))
        chosen = []
        for cls, lst in picked.items():
            key = (lambda x: (-x[2][0], x[1]["cc"])) if cls != "calm" else (lambda x: (x[1]["cc"], x[2][0]))
            for day, sc, wv in sorted(lst, key=key)[: CAPS[cls]]:
                chosen.append((day, cls, wv))
                by_scene.setdefault(sc["id"], (sc, []))[1].append((t, day))
                counts[cls] += 1
        by_beach[t["id"]] = chosen
        if not NATIONAL:
            print(f"  #{t['id']} {t['name']}: εικόνες {len(sc_days)} · κλειστή {len(picked['closed'])} ανοιχτή {len(picked['open'])} ήρεμη {len(picked['calm'])}")
    return by_beach, by_scene, dict(counts)


def download(by_scene):
    jobs = sorted(by_scene.values(), key=lambda v: -len(v[1]))
    total = sum(len(m) for _, m in jobs)
    have = sum(1 for _, m in jobs for t, day in m if chip_path(t, day).exists())
    print(f"\nδιαβάζω {total} παράθυρα από {len(jobs)} εικόνες ({have} ήδη στον δίσκο) …", flush=True)
    CHIPS.mkdir(parents=True, exist_ok=True)
    t0, written, failed, done = time.time(), 0, 0, 0
    with ThreadPoolExecutor(max_workers=32 if NATIONAL else 16) as pool:
        futs = [pool.submit(fetch_scene, sc, members) for sc, members in jobs]
        for fut in as_completed(futs):
            w, f = fut.result()
            written += w; failed += f; done += 1
            if done % 250 == 0 or done == len(jobs):
                el = time.time() - t0
                rate = written / el if el else 0
                left = total - have - written - failed
                eta = f"{left / rate / 60:.0f}′" if rate else "—"
                print(f"  … εικόνες {done}/{len(jobs)} · νέα παράθυρα {written} ({rate:.1f}/δευτ.) · αποτυχίες {failed} · απομένουν ~{eta}", flush=True)
    return written, failed


def keep_awake():
    """Windows: να μην κοιμηθεί ο υπολογιστής όσο τρέχει η νύχτα (η οθόνη μπορεί να σβήσει)."""
    if os.name == "nt":
        try:
            import ctypes
            ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)
        except Exception:  # noqa: BLE001
            pass


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    if NATIONAL:
        keep_awake()
    t_start = time.time()
    targets = load_targets()
    print(f"{len(targets)} παραλίες", flush=True)
    waves = wave_series(targets)
    print(f"  κύμα: {sum(1 for v in waves.values() if v)} με θαλάσσιο κελί ({time.time() - t_start:.0f} δευτ.)", flush=True)
    scenes = scenes_by_beach(targets)
    by_beach, by_scene, counts = plan_jobs(targets, waves, scenes)
    print(f"  πλάνο: {sum(counts.values())} παράθυρα ({counts}) σε {len(by_scene)} εικόνες ({time.time() - t_start:.0f} δευτ.)", flush=True)
    if DRY:
        return
    download(by_scene)

    print(f"\nμετράω {len(by_beach)} παραλίες …", flush=True)
    measured = {}
    tmap = {t["id"]: t for t in targets}
    with ProcessPoolExecutor(max_workers=min(12, os.cpu_count() or 4)) as pool:
        futs = [pool.submit(measure_from_disk, tmap[bid], chosen) for bid, chosen in by_beach.items()]
        for k, fut in enumerate(as_completed(futs), 1):
            bid, rows, shore_px, n = fut.result()
            measured[bid] = (rows, shore_px, n)
            if NATIONAL and k % 250 == 0:
                print(f"  … {k}/{len(futs)}", flush=True)

    if NATIONAL:
        out = CACHE / "national-days.json"
        out.write_text(json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "caps": CAPS, "classMonths": CLASS_MONTHS, "halfM": HALF_M,
            "classes": {"closed": f"ανοιχτό ≥{BIG_M} μ. και τυπώνουμε ≤{CLOSED_KD} του ύψους (Μάι-Οκτ)",
                        "open": f"ανοιχτό ≥{BIG_M} μ., τυπώνουμε ≥{OPEN_KD} και η γεωμετρία το λέει ανοιχτό (K_d ≥{OPEN_KD}), όλο τον χρόνο",
                        "refused": f"ανοιχτό ≥{BIG_M} μ., τυπώνουμε ≥{OPEN_KD} ενώ η γεωμετρία βλέπει σκιά (K_d <{OPEN_KD}), όλο τον χρόνο",
                        "calm": f"ανοιχτό <{CALM_M} μ. (όλο τον χρόνο)"},
            "beaches": {str(bid): {"name": tmap[bid]["name"], "region": tmap[bid]["region"], "lat": tmap[bid]["lat"], "lon": tmap[bid]["lon"],
                                   "chips": n, "shorePixels": px, "days": rows}
                        for bid, (rows, px, n) in measured.items()},
        }, ensure_ascii=False), encoding="utf-8")
        print(f"\nμετρήθηκαν {sum(1 for r, _, _ in measured.values() if r)} / {len(measured)} · {out.relative_to(ROOT)} · "
              f"σύνολο {(time.time() - t_start) / 60:.0f}′")
        return

    judged_path = ROOT / "reports/wave-model/shadow-candidates-judge.json"
    candidates = {r["id"]: r for r in json.loads(judged_path.read_text(encoding="utf-8"))["rows"]} if judged_path.exists() else {}
    report = []
    print(f"\n{'παραλία':<26} {'ομάδα':>9} {'κλειστές':>8} {'φτάνει':>6} {'σκιά':>5} {'άκριτες':>7} {'ήρεμες(αφρ)':>11}  ετυμηγορία")
    print("-" * 104)
    for t in targets:
        rows, shore_px, n = measured.get(t["id"], (None, 0, 0))
        if rows is None:
            print(f"{t['name'][:26]:<26} — λίγες εικόνες ({n})")
            continue
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
