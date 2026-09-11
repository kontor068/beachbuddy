"""
Ο ΔΟΡΥΦΟΡΟΣ ΓΙΑ ΤΗΝ «ΤΡΥΠΑ ΤΗΣ ΤΣΕΠΗΣ» — βοηθός του scripts/auditPocketHoleAgainstSatellite.mjs (11/09/2026).

ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Η γεωμετρία (οι τρύπες) βγαίνει στο node με τις πραγματικές συναρτήσεις TS και γράφεται στο
.tmp/pocket-hole/holes.json. Εδώ ρωτάμε τον Sentinel-2 για ΚΑΘΕ τέτοια παραλία: τις μέρες που το ανοιχτό κύμα
ερχόταν από μέσα την τρύπα (εκεί που τυπώνουμε ≤0,2 του ύψους), σκάει κύμα στην άμμο; Ο Μώλος #2040 έδειξε
ότι σε μία τουλάχιστον σκάει.

ΤΙΠΟΤΑ ΚΑΙΝΟΥΡΓΙΟ ΣΤΟ ΟΡΓΑΝΟ. Όλα έρχονται από τα υπάρχοντα σκριπτ, με import, όχι αντιγραφή:
  - ανάγνωση/μάσκες/αφρός: judgeShoreSurfSentinel2 (measure_beach, fetch/download, κατάλογος εικόνων, κύμα
    Copernicus από την ΙΔΙΑ cache .tmp/s2judge/waves-cells.json — καμία κλήση στο Copernicus από εδώ)
  - «σκάει» = αφρός στην ΕΞΩΤΕΡΙΚΗ λωρίδα ≥0,2 (summarizeShoreSurfNational.surf), μόνο μέρες που τυπώνουμε
    ≤0,3 μ., διωνυμικό απέναντι στον ΔΙΚΟ της παραλίας ψεύτικο αφρό ήρεμων ημερών (κάτω όριο 4%)·
    ΣΚΑΕΙ = p<0,01 & ≥3 μέρες, ΠΙΘΑΝΟ = p<0,05 & ≥2 — ίδιοι κανόνες με το summarizeShoreSurfNational.assess
  - SWIR B11/B08 < 0,62 = αφρός (verifyShoreFoamSwir: swir_window, masks, κατώφλι, κανόνας check_calm)
  - «σκιά» μιας μέρας = λωρίδα σκοτεινή (<0,05) ενώ η ακτή της ΙΔΙΑΣ εικόνας που κοιτάει το κύμα αφρίζει
    (≥0,1) — judgeShoreSurfSentinel2.summarize· ο αφρός της διπλανής ελέγχεται κι αυτός με SWIR (check_wavy)
  - «σκιά αληθινή» = ≥3 κριμένες μέρες και σκιά ≥ 2× κύμα (judgeShoreSurfSentinel2.summarize), Ή λόγος άφιξης
    R ≤ 0,25 απέναντι στις μέρες που τυπώνουμε όλο το ύψος (summarizeShoreSurfArrival.py, §Γ75)
  - ±10°: κάθε ετυμηγορία ξαναβγαίνει μόνο με τις μέρες που μένουν στην ίδια τρύπα και με −10° και με +10°
    (η σελίδα διαβάζει 5-15° άλλη διεύθυνση από το Copernicus — replay αρχείου προγνώσεων, 11/09)
Νέο είναι μόνο ΠΟΙΕΣ μέρες διαλέγονται: όλες οι μέρες της τρύπας, όλο τον χρόνο (όχι το ταβάνι των 60 «κλειστών»
του πανελλαδικού, που γέμιζε με ΟΛΕΣ τις διευθύνσεις βαθιάς σκιάς)· Μάι-Οκτ ξεχωριστά· οι μέρες των πλευρών, ως 40
μέρες «όλο το ύψος» και ως 30 ήρεμες (όπως το verifyShoreFoamSwir.check_calm) για τη μάσκα νερού και τη βάση θορύβου.

ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ: βλ. την κεφαλίδα του .mjs — «καθόλου αφρός» ≠ «μηδέν κύμα», στιγμιότυπο ~12:15, κύμα
κελιού 4 χλμ. και όχι ακτής. Επιπλέον: οι μέρες «τρύπας» κρίνονται με τη διεύθυνση του ΚΕΛΙΟΥ· σε όρμο η
διεύθυνση που φτάνει μπορεί να είναι άλλη.

Run: node scripts/auditPocketHoleAgainstSatellite.mjs   (το καλεί μόνο του)
     python scripts/auditPocketHoleSatellite.py --plan-only   (μόνο πόσα παράθυρα χρειάζονται)
"""
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from statistics import median

_ARGV = sys.argv[1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import verifyShoreFoamSwir as v  # noqa: E402  (βάζει τον κριτή σε πανελλαδική λειτουργία κατά το import)
import summarizeShoreSurfNational as s  # noqa: E402

j = v.j
import numpy as np  # noqa: E402

WORK = j.ROOT / ".tmp" / "pocket-hole"
HOLES = WORK / "holes.json"
OUT = WORK / "satellite.json"
SWIR_CACHE = WORK / "swir"
SEASON = tuple(j.CLASS_MONTHS["closed"])     # Μάι-Οκτ: η σεζόν της «κλειστής» κλάσης του κριτή
CAP_FULL = 40                                # όσο open 24 + refused 16 του πανελλαδικού
CAP_CALM = 30                                # όσο το verifyShoreFoamSwir.check_calm
PIN_MOVED_M = 20                             # πινέζα που μετακινήθηκε από τον πανελλαδικό → τα παλιά παράθυρα δεν είναι γύρω της
# Η σελίδα δεν διαβάζει τη διεύθυνση του Copernicus: replay του αρχείου προγνώσεων (11/09) — Μώλος 5-13° αριστερόστροφα
# (διάμεσος −8°), Καλό Λιμάνι 6-15° δεξιόστροφα. Μαρτυρία «σκάει μέσα στην τρύπα» μετράει ως ίδια με του Μώλου ΜΟΝΟ αν
# μένει μέσα στην ίδια τρύπα και με −10° και με +10° («πυρήνας»). Τρύπα ≤20° δεν έχει πυρήνα.
SHIFT_DEG = 10


def k_of(deg):
    """Το ΙΔΙΟ στρογγύλεμα με τον κριτή (kd_at): πλησιέστερο δείγμα των 5°."""
    return int(round((deg % 360) / 5)) % 72


def printed(t, w):
    x = t["say"][k_of(w[1])]
    return None if x is None else x * w[0]


def in_same_hole(t, d, delta):
    """Η μέρα (διεύθυνση d) είναι σε τρύπα, και με d+delta μένει στην ΙΔΙΑ τρύπα;"""
    k0 = k_of(d) * 5
    for band in t["holes"]:
        if k0 in band:
            return (k_of(d + delta) * 5) in band
    return False


def in_core(t, d):
    return in_same_hole(t, d, -SHIFT_DEG) and in_same_hole(t, d, SHIFT_DEG)


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ── πλάνο: ποιες μέρες ────────────────────────────────────────────────────────
def pick_days(t, w, sc_days):
    hole, flank = set(t["holeDirs"]), set(t["flankDirs"])
    picked = {"hole": [], "holeOff": [], "flank": [], "full": [], "calm": []}
    for day, sc in sc_days.items():
        wv = w["days"].get(day)
        if not wv or wv[1] is None or not math.isfinite(wv[1]):
            continue
        h, d = wv[0], wv[1]
        deg = k_of(d) * 5
        say = t["say"][k_of(d)]
        if h < j.CALM_M:
            picked["calm"].append((day, sc, wv))
        elif h >= j.CLOSED_MIN_M and deg in hole:
            picked["hole" if int(day[5:7]) in SEASON else "holeOff"].append((day, sc, wv))
        elif h >= j.CLOSED_MIN_M and deg in flank:
            picked["flank"].append((day, sc, wv))
        elif h >= j.BIG_M and say is not None and say >= j.OPEN_KD:
            picked["full"].append((day, sc, wv))
    picked["calm"] = sorted(picked["calm"], key=lambda x: (x[1]["cc"], x[2][0]))[:CAP_CALM]
    picked["full"] = sorted(picked["full"], key=lambda x: (-x[2][0], x[1]["cc"]))[:CAP_FULL]
    return picked


def plan(targets):
    cache = json.loads((j.CACHE / "waves-cells.json").read_text(encoding="utf-8"))
    waves = {}
    for t in targets:
        cell = cache["beachCell"].get(str(t["id"]))
        waves[t["id"]] = {"cell": cell, "days": cache["cells"].get(j._cell_key(cell), {})} if cell else None
    have = [t for t in targets if waves[t["id"]] and waves[t["id"]]["days"]]
    scenes = j.scenes_by_beach(have)
    by_beach, by_scene, scene_of = {}, {}, {}
    for t, sc_days in zip(have, scenes):
        picked = pick_days(t, waves[t["id"]], sc_days)
        chosen = []
        for cls, lst in picked.items():
            for day, sc, wv in lst:
                chosen.append((day, cls, wv))
                by_scene.setdefault(sc["id"], (sc, []))[1].append((t, day))
                scene_of[(t["id"], day)] = sc
        by_beach[t["id"]] = chosen
    return waves, by_beach, by_scene, scene_of


# ── SWIR (verifyShoreFoamSwir.swir_window, με cache στον δίσκο) ─────────────────
def swir_cached(sc, t, day, n):
    path = SWIR_CACHE / f"{t['id']}-{day}.npy"
    if path.exists():
        return np.load(path)
    arr = v.swir_window(sc, t, n)
    SWIR_CACHE.mkdir(parents=True, exist_ok=True)
    np.save(path, arr)
    return arr


def assess(t, rows, calm_rows_only=None):
    """Η στατιστική μίας παραλίας — ΜΟΝΟ με τους κανόνες του summarizeShoreSurfNational / judge.summarize."""
    judged = [r for r in rows if "beachFoam" in r]
    calm = [r for r in judged if r["class"] == "calm"]
    calm_false = sum(1 for r in calm if s.surf(r))
    noisy1 = len(calm) >= 3 and calm_false / len(calm) > s.NOISY_CALM
    q = max(s.CALM_FLOOR, (calm_false + 1) / (len(calm) + 2))

    def hole_stats(classes):
        hole = [r for r in judged if r["class"] in classes and (printed(t, r["wave"]) or 0) <= s.CALM_PRINT_MAX]
        foam = [r for r in hole if s.surf(r)]
        p1 = s.binom_sf(len(foam), len(hole), q) if len(hole) >= 3 else None
        tier = None
        if not noisy1 and p1 is not None:
            if p1 < s.ALPHA and len(foam) >= 3:
                tier = "ΣΚΑΕΙ"
            elif p1 < 0.05 and len(foam) >= 2:
                tier = "ΠΙΘΑΝΟ"
        shadow = [r for r in hole if r["beachFoam"] < s.DARK and (r.get("exposedFoam") or 0) >= s.EXPOSED_FOAM]
        return hole, foam, p1, tier, shadow

    return judged, calm, calm_false, noisy1, q, hole_stats


def main():
    data = json.loads(HOLES.read_text(encoding="utf-8"))
    targets = []
    for b in data["beaches"]:
        if b["lat"] is None or b["lon"] is None:
            continue
        targets.append({"id": b["id"], "region": b["region"], "name": b["name"], "lat": float(b["lat"]), "lon": float(b["lon"]),
                        "say": b["say"], "kd": b["kd"], "arrival": b["arrival"], "facingDeg": b["facingDeg"],
                        "holeDirs": b["holeDirs"], "flankDirs": b["flankDirs"], "holes": [h["band"] for h in b["holes"]]})
    tmap = {t["id"]: t for t in targets}
    print(f"τρύπες: {len(targets)} παραλίες", flush=True)

    # Πινέζα που μετακινήθηκε από τον πανελλαδικό: τα παράθυρα στον δίσκο είναι γύρω από την ΠΑΛΙΑ θέση.
    nat = json.loads((j.CACHE / "national-days.json").read_text(encoding="utf-8"))["beaches"]
    moved = {}
    for t in targets:
        nb = nat.get(str(t["id"]))
        if nb and nb.get("lat") is not None:
            dm = haversine_m(t["lat"], t["lon"], nb["lat"], nb["lon"])
            if dm > PIN_MOVED_M:
                moved[t["id"]] = round(dm)
    if moved:
        print(f"  ⚠ πινέζα μετακινήθηκε μετά τον πανελλαδικό (τα παράθυρα στον δίσκο είναι της παλιάς θέσης): {moved}")

    waves, by_beach, by_scene, scene_of = plan(targets)
    cnt = {}
    for chosen in by_beach.values():
        for _, cls, _ in chosen:
            cnt[cls] = cnt.get(cls, 0) + 1
    total = sum(len(m) for _, m in by_scene.values())
    on_disk = sum(1 for _, m in by_scene.values() for t, day in m if j.chip_path(t, day).exists())
    print(f"  πλάνο: {total} παράθυρα ({cnt}) · στον δίσκο ήδη {on_disk} · χωρίς θαλάσσιο κελί {sum(1 for t in targets if not waves[t['id']])}", flush=True)
    if "--plan-only" in _ARGV:
        return
    j.download(by_scene)

    print(f"\nμετράω {len(by_beach)} παραλίες …", flush=True)
    measured = {}
    with ProcessPoolExecutor(max_workers=min(12, os.cpu_count() or 4)) as pool:
        futs = [pool.submit(j.measure_from_disk, tmap[bid], chosen) for bid, chosen in by_beach.items()]
        for fut in as_completed(futs):
            bid, rows, shore_px, n = fut.result()
            measured[bid] = (rows, shore_px, n)

    # ── SWIR: κάθε μέρα τρύπας με «αφρό» και κάθε μέρα «σκιάς» (ο έλεγχος της διπλανής) ─────────────────
    swir_jobs = []  # (bid, day, kind)
    for bid, (rows, _, _) in measured.items():
        if not rows:
            continue
        t = tmap[bid]
        for r in rows:
            if "beachFoam" not in r or r["class"] not in ("hole", "holeOff"):
                continue
            if (printed(t, r["wave"]) or 0) > s.CALM_PRINT_MAX:
                continue
            if s.surf(r):
                swir_jobs.append((bid, r["day"], "foam"))
            elif r["beachFoam"] < s.DARK and (r.get("exposedFoam") or 0) >= s.EXPOSED_FOAM:
                swir_jobs.append((bid, r["day"], "control"))
    print(f"SWIR: {len(swir_jobs)} παράθυρα ({sum(1 for x in swir_jobs if x[2] == 'foam')} αφρός τρύπας · {sum(1 for x in swir_jobs if x[2] == 'control')} έλεγχοι σκιάς) …", flush=True)
    need = sorted({(bid, day) for bid, day, _ in swir_jobs})
    swir = {}

    def fetch(key):
        bid, day = key
        return key, swir_cached(scene_of[key], tmap[bid], day, 2 * (j.HALF_M // 10))

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=12) as pool:
        futs = [pool.submit(fetch, k) for k in need]
        for i, fut in enumerate(as_completed(futs), 1):
            try:
                key, arr = fut.result()
                swir[key] = arr
            except Exception as e:  # noqa: BLE001 — μία χαμένη μέρα δεν ρίχνει το πέρασμα· καταγράφεται
                print(f"  ✗ SWIR: {str(e)[:120]}", flush=True)
            if i % 100 == 0 or i == len(futs):
                print(f"  … {i}/{len(futs)} ({time.time() - t0:.0f} δευτ.)", flush=True)

    ratios = {}  # (bid, day) → λόγος
    by_bid = {}
    for bid, day, kind in swir_jobs:
        by_bid.setdefault(bid, []).append((day, kind))
    for bid, items in by_bid.items():
        t = tmap[bid]
        chips = v.load(t, by_beach[bid])
        m = v.masks(chips)
        idx = {c[0]: k for k, c in enumerate(chips)}
        rows = {r["day"]: r for r in measured[bid][0] if "beachFoam" in r}
        for day, kind in items:
            arr = swir.get((bid, day))
            if arr is None or day not in idx:
                continue
            x = m["stack"][idx[day]]
            r = rows[day]
            if arr.shape != x.shape:
                arr = arr[: x.shape[0], : x.shape[1]]
            if kind == "foam":
                mask = m["outer"] & np.isfinite(x) & (x > r["thr"])
            else:
                mask = m["far"] & np.isfinite(x) & (j.angdiff(m["normal"], r["wave"][1]) <= j.EXPOSED_MAX_DEG) & (x > r["thr"])
            q = v.ratio(arr, x, mask)
            ratios[(bid, day)] = round(q, 3) if math.isfinite(q) else None

    # ── κατάταξη ανά παραλία ──────────────────────────────────────────────────
    agree = [0, 0]  # συμφωνία «σκάει» με τον πανελλαδικό, ίδια μέρα
    # Εθνικά σύνολα [μέρες με αφρό, μέρες] — μόνο μη θορυβώδεις λωρίδες: τρύπα (σεζόν) · πλευρές ανά είδος · ήρεμες
    agg = {"hole": [0, 0], "flankIndependent": [0, 0], "flankWindDependent": [0, 0], "calm": [0, 0]}
    out = []
    for t in targets:
        bid = t["id"]
        base = {"id": bid, "pinMovedM": moved.get(bid)}
        if not waves.get(bid):
            out.append({**base, "class": "c", "reason": "noSeaCell", "stats": None, "flags": [], "evidence": []})
            continue
        rows, shore_px, nchips = measured.get(bid, (None, 0, 0))
        if not rows:
            out.append({**base, "class": "c", "reason": "noImagery", "stats": {"chips": nchips}, "flags": [], "evidence": []})
            continue
        nb = {r["day"]: r for r in (nat.get(str(bid)) or {}).get("days") or [] if "beachFoam" in r}
        for r in rows:
            if "beachFoam" in r and r["day"] in nb:
                agree[1] += 1
                agree[0] += int(s.surf(r) == s.surf(nb[r["day"]]))
        judged, calm, calm_false, noisy1, q, hole_stats = assess(t, rows)
        full = [r for r in judged if r["class"] in ("flank", "full")]
        full_big = [r for r in full if r["wave"][0] >= j.BIG_M]
        flank = [r for r in judged if r["class"] == "flank"]
        fq = [r["beachFoam"] for r in calm]
        signal = (median([r["beachFoam"] for r in full_big]) - median(fq)) if (full_big and fq) else None
        sees = signal is not None and len(full_big) >= 2 and signal >= s.MIN_OPEN_SIGNAL
        capability = sees or any(s.surf(r) for r in full)

        def block(classes):
            hole, foam, p1, tier, shadow = hole_stats(classes)
            real = [r for r in foam if (ratios.get((bid, r["day"])) is not None and ratios[(bid, r["day"])] < v.FOAM_MAX_SWIR_RATIO)]
            fake = [r for r in foam if (ratios.get((bid, r["day"])) is not None and ratios[(bid, r["day"])] >= v.FOAM_MAX_SWIR_RATIO)]
            unknown = [r for r in foam if ratios.get((bid, r["day"])) is None]
            shadow_ok = [r for r in shadow if (ratios.get((bid, r["day"])) is not None and ratios[(bid, r["day"])] < v.FOAM_MAX_SWIR_RATIO)]
            p_sw = v.sf(len(real), len(hole) - len(fake), q)
            sw_verdict = "ΣΚΑΕΙ" if len(real) >= 2 and p_sw < 0.05 else "δεν αποδεικνύεται"
            judged_a = len(shadow_ok) + len(real)
            # ±10°: ο ίδιος κανόνας SWIR/σκιάς μόνο στις μέρες του «πυρήνα» (μένουν στην ίδια τρύπα και με −10° και με +10°)
            core = [r for r in hole if in_core(t, r["wave"][1])]
            core_ids = {r["day"] for r in core}
            c_real = [r for r in real if r["day"] in core_ids]
            c_fake = [r for r in fake if r["day"] in core_ids]
            c_shadow = [r for r in shadow_ok if r["day"] in core_ids]
            p_core = v.sf(len(c_real), len(core) - len(c_fake), q) if core else None
            shift = {"realFoamDays": len(real),
                     "stillInsideMinus10": sum(1 for r in real if in_same_hole(t, r["wave"][1], -SHIFT_DEG)),
                     "stillInsidePlus10": sum(1 for r in real if in_same_hole(t, r["wave"][1], SHIFT_DEG)),
                     "stillInsideBoth": len(c_real),
                     "coreDays": len(core), "coreFake": len(c_fake), "coreShadowSwirOk": len(c_shadow),
                     "coreP": round(p_core, 5) if p_core is not None else None,
                     "coreSwirVerdict": "ΣΚΑΕΙ" if (len(c_real) >= 2 and p_core is not None and p_core < 0.05) else "δεν αποδεικνύεται",
                     "coreShadowConfirmed": (len(c_shadow) + len(c_real)) >= 3 and len(c_shadow) >= 2 * len(c_real)}
            # Δεύτερος δρόμος προς το «σκιά αληθινή», ΥΠΑΡΧΩΝ (summarizeShoreSurfArrival.py, §Γ75): λόγος άφιξης
            # R = (τρύπα − ήρεμη) / (όλο-το-ύψος − ήρεμη), διάμεσοι του beachFoam, μέρες ≥0,8 μ. και στις δύο πλευρές
            # (όπως εκεί)· κρίνεται μόνο αν η λωρίδα αφρίζει στις μέρες «όλο το ύψος» (≥MIN_OPEN_SIGNAL, ≥2 μέρες).
            # Στις τσέπες δεν υπάρχει μέρα K_d ≥0,9 — ο θετικός έλεγχος είναι οι μέρες που ΤΥΠΩΝΟΥΜΕ ≥0,9.
            def arrival_ratio(rs):
                big = [r["beachFoam"] for r in rs if r["wave"][0] >= j.BIG_M]
                if not big or not sees:
                    return None, len(big), "δεν κρίνεται"
                ratio_ = round((median(big) - median(fq)) / signal, 2)
                if len(big) < 3:
                    return ratio_, len(big), "λίγες μέρες"
                return ratio_, len(big), "ΣΚΙΑ ΑΛΗΘΙΝΗ" if ratio_ <= 0.25 else ("ΚΥΜΑ ΦΤΑΝΕΙ" if ratio_ >= 0.6 else "ΜΙΣΗ ΣΚΙΑ")
            r_all, r_n, r_verdict = arrival_ratio(hole)
            r_core, r_core_n, r_core_verdict = arrival_ratio(core)
            shift["coreArrivalRatio"], shift["coreArrivalDays"], shift["coreArrivalVerdict"] = r_core, r_core_n, r_core_verdict
            return {"n": len(hole), "surf": len(foam), "p": round(p1, 5) if p1 is not None else None, "tier": tier,
                    "shadow": len(shadow), "shadowSwirOk": len(shadow_ok), "judgedForShadow": judged_a,
                    "swir": {"real": len(real), "fake": len(fake), "unknown": len(unknown), "p": round(p_sw, 5), "verdict": sw_verdict},
                    "arrivalRatio": {"R": r_all, "daysAtLeast08": r_n, "verdict": r_verdict},
                    "shift10": shift,
                    "bands": sorted({k_of(r["wave"][1]) * 5 for r in hole}),
                    "_hole": hole, "_foam": foam, "_real": real, "_shadow_ok": shadow_ok}

        # ΚΥΡΙΟ = όλος ο χρόνος (ο ορισμός της εργασίας: κάθε μέρα ≥0,5 μ. μέσα στην τρύπα)· Μάι-Οκτ = υποσύνολο
        # (η «κλειστή» σεζόν του πανελλαδικού). Ο χειμώνας φέρνει μεγαλύτερη περίοδο — περισσότερη περίθλαση μέσα
        # στον όρμο — γι' αυτό η περίοδος κάθε μέρας αφρού γράφεται στις αποδείξεις.
        season, allyear = block(("hole",)), block(("hole", "holeOff"))

        # «Αν ούτε η ανοιχτή δείχνει αφρό → το όργανο είναι τυφλό σε αυτή την παραλία — ΑΔΙΕΥΚΡΙΝΙΣΤΟ, όχι
        # ήρεμη» (judgeShoreSurfSentinel2, κεφαλίδα): ≥2 μέρες «όλο το ύψος» ≥0,8 μ. χωρίς σήμα → σκοτεινή λωρίδα
        # στην τρύπα δεν αποδεικνύει σκιά, όσο κι αν αφρίζει η διπλανή ακτή.
        blind = len(full_big) >= 2 and not sees

        def classify(b):
            if noisy1:
                return "c", "noisyStrip"
            if b["tier"]:
                return "b", f"statistical {b['tier']}"
            route1 = not blind and b["judgedForShadow"] >= 3 and b["shadowSwirOk"] >= 2 * len(b["_real"])
            route2 = b["arrivalRatio"]["verdict"] == "ΣΚΙΑ ΑΛΗΘΙΝΗ"
            if route1 or route2:
                if route1 and route2:
                    return "a", "sameImageShadow+arrivalRatio"
                if route2:
                    return "a", "arrivalRatio"
                return "a", "sameImageShadow" if capability else "sameImageShadowCapabilityNotShown"
            if b["arrivalRatio"]["verdict"] == "ΚΥΜΑ ΦΤΑΝΕΙ":
                return "c", "arrivalRatioHighButNotSignificant"
            if blind and b["n"] >= 3:
                return "c", "stripBlindOnFullPrintDays"
            if b["judgedForShadow"] >= 3 or b["arrivalRatio"]["verdict"] == "ΜΙΣΗ ΣΚΙΑ":
                return "c", "mixed"
            return "c", "fewDays"

        cls, reason = classify(allyear)
        cls_season, reason_season = classify(season)
        flags = []
        survives = None
        sh = allyear["shift10"]
        if cls == "b":
            flags.append("swirConfirmed" if allyear["swir"]["verdict"] == "ΣΚΑΕΙ" else "swirNotProven")
            survives = sh["coreSwirVerdict"] == "ΣΚΑΕΙ"
        elif cls == "a":
            survives = (sh["coreShadowConfirmed"] and not blind) or sh["coreArrivalVerdict"] == "ΣΚΙΑ ΑΛΗΘΙΝΗ"
        if not any(in_core(t, d) for d in t["holeDirs"]):
            flags.append("bandUnder20:noCoreDirection")
        if allyear["n"] and allyear["n"] < 3 and allyear["surf"] >= 1:
            flags.append("foamOnFewDays")
        if cls != cls_season:
            flags.append(f"seasonOnly→{cls_season}:{reason_season}")
        if bid in moved:
            flags.append("pinMovedSinceChips")

        def day_list(rs):
            return [{"day": r["day"], "class": r["class"], "hsM": r["wave"][0], "dirDeg": r["wave"][1], "tpS": r["wave"][2],
                     "printedM": round(printed(t, r["wave"]) or 0, 2), "beachFoam": r["beachFoam"], "outer": r.get("beachFoamOuter"),
                     "exposed": r.get("exposedFoam"), "thr": r.get("thr"), "swirRatio": ratios.get((bid, r["day"])),
                     "insideMinus10": in_same_hole(t, r["wave"][1], -SHIFT_DEG), "insidePlus10": in_same_hole(t, r["wave"][1], SHIFT_DEG),
                     "scene": scene_of[(bid, r["day"])]["id"] if (bid, r["day"]) in scene_of else None} for r in rs]

        strip = lambda b: {k: v_ for k, v_ in b.items() if not k.startswith("_")}  # noqa: E731
        evidence = day_list(sorted(allyear["_foam"], key=lambda r: r["day"])) if allyear["surf"] else []
        # Πλευρές χωρισμένες σε «όλο το ύψος με κάθε άνεμο» (άφιξη partial/exposed) και «μόνο με άνεμο από τη μεριά
        # του κύματος» (σιωπηλή/grazing): η δεύτερη είναι υπόθεση ανέμου, όχι γεωμετρία (βλ. .mjs, windAssumption).
        def wind_indep(r):
            return t["arrival"][k_of(r["wave"][1])] in ("partial", "exposed")
        for r in flank:
            key = "flankIndependent" if wind_indep(r) else "flankWindDependent"
            if not noisy1:
                agg[key][1] += 1
                agg[key][0] += int(s.surf(r))
        if not noisy1:
            for r in allyear["_hole"]:
                agg["hole"][1] += 1
                agg["hole"][0] += int(s.surf(r))
            for r in calm:
                agg["calm"][1] += 1
                agg["calm"][0] += int(s.surf(r))
        out.append({**base, "class": cls, "reason": reason, "classSeason": cls_season, "reasonSeason": reason_season, "flags": flags,
                    "survivesShift10": survives,
                    "stats": {"chips": nchips, "shorePixels": shore_px,
                              "hole": strip(allyear), "holeSeason": strip(season),
                              "calm": {"n": len(calm), "surf": calm_false, "q": round(q, 4), "noisy": noisy1},
                              "flank": {"n": len(flank), "surf": sum(1 for r in flank if s.surf(r)),
                                        "nBig": sum(1 for r in flank if r["wave"][0] >= j.BIG_M),
                                        "surfBig": sum(1 for r in flank if r["wave"][0] >= j.BIG_M and s.surf(r)),
                                        "windIndependent": [sum(1 for r in flank if wind_indep(r) and s.surf(r)), sum(1 for r in flank if wind_indep(r))],
                                        "windDependent": [sum(1 for r in flank if not wind_indep(r) and s.surf(r)), sum(1 for r in flank if not wind_indep(r))]},
                              "fullPrint": {"n": len(full), "surf": sum(1 for r in full if s.surf(r)), "nBig": len(full_big),
                                            "signal": round(signal, 3) if signal is not None else None, "sees": sees},
                              "capabilityShown": capability},
                    "evidence": evidence,
                    "shadowDays": day_list(sorted(allyear["_shadow_ok"], key=lambda r: r["day"]))[:12] if bid in (2443, 2040) else []})

    OUT.write_text(json.dumps({
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": {
            "imagery": "Sentinel-2 L2A B08 10 m via AWS Earth Search (judgeShoreSurfSentinel2.measure_beach — unchanged); SWIR B11 for verification (verifyShoreFoamSwir.swir_window/masks/ratio)",
            "wave": "Copernicus MEDSEA 4,2 km, nearest sea cell, 09 UTC — the judge's cache .tmp/s2judge/waves-cells.json (2022-01-01 → 2026-09-10)",
            "daysPicked": {"hole": f"Hs ≥{j.CLOSED_MIN_M} m, direction in the hole, all months (all such days, no cap) — PRIMARY; months {list(SEASON)} reported separately as the national 'closed' season",
                           "arrivalRatio": f"second route to 'shadow real' (summarizeShoreSurfArrival.py §Γ75): R = (median hole − median calm)/(median full-print − median calm) over beachFoam, days ≥{j.BIG_M} m on both sides, judged only if full-print − calm ≥{s.MIN_OPEN_SIGNAL} over ≥2 days; R ≤0,25 shadow real, ≥0,6 wave arrives, ≥3 hole days",
                           "shift10": f"core days = hole days whose direction stays in the same hole at ±{SHIFT_DEG}° (site reads 5-15° off Copernicus); every verdict is recomputed on core days (survivesShift10)",
                           "flank": f"Hs ≥{j.CLOSED_MIN_M} m, direction in a flank (say ≥{j.OPEN_KD} within ≤15° of a hole), all months, no cap",
                           "full": f"Hs ≥{j.BIG_M} m, other say ≥{j.OPEN_KD} directions, all months, ≤{CAP_FULL} by Hs",
                           "calm": f"Hs <{j.CALM_M} m, all months, ≤{CAP_CALM} least cloudy"},
            "surf": f"outer strip (20-30 m from stable land, ≤300 m from pin) foam fraction ≥{s.FOAM_DAY} (summarizeShoreSurfNational.surf); only days we print ≤{s.CALM_PRINT_MAX} m",
            "test": f"binom P(≥k of n | q), q = max({s.CALM_FLOOR}, (calm surf days+1)/(calm days+2)); ΣΚΑΕΙ p<{s.ALPHA} & k≥3, ΠΙΘΑΝΟ p<0,05 & k≥2; strip noisy if >{s.NOISY_CALM:.0%} of ≥3 calm days foam → excluded",
            "swir": f"median B11/B08 over the foam pixels; <{v.FOAM_MAX_SWIR_RATIO} = foam (else cloud/rock/land); verdict ΣΚΑΕΙ if ≥2 real-foam days and binom p<0,05 with bright-not-foam days removed (verifyShoreFoamSwir.check_calm)",
            "shadow": f"hole day with whole strip <{s.DARK} while the same image's coast facing that wave (>400 m, normal ≤{j.EXPOSED_MAX_DEG}°) has ≥{s.EXPOSED_FOAM} foam, that foam SWIR-verified; 'shadow confirmed' = ≥3 judged and shadow ≥ 2× real-foam days (judgeShoreSurfSentinel2.summarize)",
            "capability": f"strip seen to foam on a full-print day, or median(full-print ≥{j.BIG_M} m) − median(calm) ≥ {s.MIN_OPEN_SIGNAL} over ≥2 days",
        },
        "instrument": {"sameDayAgreementWithNationalPass": agree, "swirWindows": len(need), "pinMoved": moved,
                       "surfRatesNonNoisy": agg,
                       "planned": cnt, "chipsOnDiskBefore": on_disk, "chipsPlanned": total},
        "limits": [
            "'No foam' means no ~0,5 m+ breaking wave, not zero wave: the judge separates 0,1-0,3 from 0,7+, not 0,1 from 0,3.",
            "One snapshot per day at ~09:20 UTC (~12:20 local); the wave is the Copernicus 4,2 km cell at 09 UTC, not the shore — its direction may differ from what enters a cove.",
            "Hole days are selected by the cell's mean direction rounded to 5°; a hole 5-10° wide gets few such days and a 1-2° direction error moves a day in or out.",
            "Bright-in-B08 can be cloud, rock, wet sand, boats; SWIR separates water-foam from land/cloud but not whitewater from a white shallow bottom.",
            "The foam statistic tests 'does surf reach the strip', not 'is 0,1 of the open sea the right number'. A hole can be physically real and still print too little.",
            "Pockets have no K_d≥0,9 direction, so the national 'open' positive control never exists here; strip capability comes from full-print (flank/partial) days only.",
        ],
        "beaches": out,
    }, ensure_ascii=False), encoding="utf-8")
    print(f"συμφωνία «σκάει» με τον πανελλαδικό, ίδια μέρα: {agree[0]}/{agree[1]}")
    print(f"→ {OUT.relative_to(j.ROOT)}")


if __name__ == "__main__":
    main()
