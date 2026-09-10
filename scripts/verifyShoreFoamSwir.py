"""
ΣΥΝΝΕΦΟ/ΒΡΑΧΟΣ Ή ΑΦΡΟΣ; — ΤΟ ΤΕΛΕΥΤΑΙΟ ΦΙΛΤΡΟ ΤΩΝ ΛΙΣΤΩΝ ΤΟΥ ΚΡΙΤΗ ΣΤΗΝ ΑΜΜΟ (11/09/2026, βίβλος §Γ76).

ΤΟ ΠΡΟΒΛΗΜΑ. Ο κριτής (`judgeShoreSurfSentinel2.py`) λέει «αφρός» σε κάθε pixel νερού που φωτίζει
στο κοντινό υπέρυθρο (B08). Το ίδιο κάνουν και τρία πράγματα που ΔΕΝ είναι κύμα: σύννεφο που η μάσκα
του δορυφόρου δεν έπιασε (Ρώσικος Ναύσταθμος #161, Βότση #2601), βράχος/γκρεμός που «γέρνει» μέσα στη
λωρίδα του νερού ανάλογα με τη γωνία λήψης, και μικτά pixel ακτής. Με το μάτι έπεσαν έτσι οι μισές
υποψήφιες της 10/09.

Ο ΔΙΑΧΩΡΙΣΜΟΣ. Στο SWIR (B11, 1,6 μ.) το νερό — άρα και ο αφρός — απορροφά σχεδόν τα πάντα· σύννεφο,
βράχος και στεριά ΟΧΙ. Λόγος B11/B08 στα pixel «αφρού»:
  σίγουρος αφρός (14 τυχαίες ανοιχτές αμμουδιές σε μέρες ανοιχτής θάλασσας): 0,25-0,61, διάμεσος 0,49
  σίγουρη στεριά (SCL βλάστηση/γυμνό έδαφος, ίδιες εικόνες):               0,64-1,21, διάμεσος 0,85
→ κατώφλι 0,62 (ανάμεσα). Αναπαράγεται με `--validate`.

ΤΙ ΚΑΝΕΙ, ΑΝΑ ΠΑΡΑΛΙΑ ΛΙΣΤΑΣ (με ΟΛΕΣ τις διαθέσιμες μέρες, όχι τα όρια του πανελλαδικού):
  (1) «λέμε ήρεμη, σκάει»: μέρες ανοιχτό ≥0,5 μ. που τυπώνουμε ≤0,3 μ. — αφρός στην εξωτερική λωρίδα
      20-30 μ. ΜΕ υπογραφή αφρού· διωνυμικό απέναντι στις ήρεμες μέρες της ίδιας παραλίας.
  (2) «λέμε κύμα, ήσυχη»: μέρες ανοιχτό ≥0,8 μ. που τυπώνουμε σχεδόν όλο το ύψος και η διπλανή ακτή είναι
      άσπρη (≥30%) — μετράνε ΜΟΝΟ όσες ο αφρός της διπλανής έχει υπογραφή αφρού· διωνυμικό απέναντι στην
      εθνική ευαισθησία (83,8%).

Run: python scripts/verifyShoreFoamSwir.py            (ids από reports/wave-model/shore-surf-national.json)
     python scripts/verifyShoreFoamSwir.py --calm 2040,1216 --wavy 1334,467
     python scripts/verifyShoreFoamSwir.py --validate
     → reports/wave-model/shore-surf-swir-check.json
"""
import json
import math
import os
import random
import sys

import numpy as np

_argv = sys.argv[1:]
sys.argv = [sys.argv[0], "--national"]  # ο κριτής διαβάζει τη λειτουργία του από το argv κατά το import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import judgeShoreSurfSentinel2 as j  # noqa: E402

FOAM_MAX_SWIR_RATIO = 0.62
P_NAT_STRICT = 0.838   # reports/wave-model/shore-surf-national.json → instrument.saysWavyFoamStrictControl
SAY = json.loads((j.ROOT / ".tmp/shadow-kd-geometric.json").read_text(encoding="utf-8"))["beaches"]


def arg(name):
    return _argv[_argv.index(name) + 1] if name in _argv else None


def printed(bid, w):
    s = SAY[str(bid)]["say"][int(round((w[1] % 360) / 5)) % 72]
    return (s or 0) * w[0]


def sf(k, n, p):
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k, n + 1)) if n else 1.0


def cdf(k, n, p):
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(0, k + 1)) if n else 1.0


def swir_window(sc, t, n):
    import rasterio
    from rasterio.warp import transform
    with rasterio.Env(**j.GDAL_ENV):
        with rasterio.open(sc["nir"].replace("/B08.tif", "/B11.tif")) as src:
            xs, ys = transform("EPSG:4326", src.crs, [t["lon"]], [t["lat"]])
            s = j._read_win(src, xs[0], ys[0], j.HALF_M).astype("float32")
    s = (s - (0 if sc.get("offsetApplied") else 1000)) / 10000.0
    return np.repeat(np.repeat(s, 2, 0), 2, 1)[:n, :n]


def ratio(swir, nir, mask):
    return float(np.median(swir[mask] / nir[mask])) if mask.sum() >= 5 else float("nan")


def masks(chips):
    """Οι ΙΔΙΕΣ μάσκες με το measure_beach — ανά παραλία, από τη στοίβα των εικόνων της."""
    stack = []
    for _, _, _, nir, scl in chips:
        x = nir.copy(); x[np.isin(scl, [0, 3, 8, 9, 10]) | ~np.isfinite(nir)] = np.nan
        stack.append(x)
    stack = np.array(stack)
    with np.errstate(all="ignore"):
        p5 = np.nanpercentile(stack, 5, axis=0)
    known = np.isfinite(p5)
    water = known & (p5 < 0.025)
    dist = j.distance_to_land(known & ~water)
    near_unknown = j.dilate(j.dilate(j.dilate(~known)))
    n = water.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    rpx = np.hypot(xx + 0.5 - n / 2, yy + 0.5 - n / 2) * 10.0
    coast = water & (dist >= 1) & (dist <= 3) & ~near_unknown
    g_row, g_col = np.gradient(j.box_blur(np.minimum(dist, 12).astype("float32")))
    return {"stack": stack, "n": n, "outer": coast & (dist >= 2) & (rpx <= j.SHORE_RADIUS_M),
            "far": coast & (rpx > j.SHORE_RADIUS_M + 100),
            "normal": (np.degrees(np.arctan2(g_col, -g_row)) + 360) % 360}


def plan(targets, caps, big):
    j.BIG_M, j.CAPS = big, caps
    waves = j.wave_series(targets)
    scenes = j.scenes_by_beach(targets)
    by_beach, by_scene, _ = j.plan_jobs(targets, waves, scenes)
    j.download(by_scene)
    scene_of = {(t["id"], day): sc for sc, members in by_scene.values() for t, day in members}
    return by_beach, scene_of


def load(t, chosen):
    chips = []
    for day, cls, wv in chosen:
        p = j.chip_path(t, day)
        if p.exists():
            nir, scl = j.load_chip(p)
            chips.append((day, cls, wv, nir, scl))
    return sorted(chips, key=lambda c: c[0])


def check_calm(targets):
    by_beach, scene_of = plan(targets, {"closed": 120, "open": 0, "refused": 0, "calm": 30}, 0.5)
    out = []
    for t in targets:
        chips = load(t, by_beach[t["id"]])
        if len(chips) < 5:
            continue
        rows, _ = j.measure_beach(t, chips)
        m = masks(chips)
        idx = {c[0]: k for k, c in enumerate(chips)}
        calm = [r for r in rows if r["class"] == "calm" and "beachFoam" in r]
        closed = [r for r in rows if r["class"] == "closed" and "beachFoam" in r and printed(t["id"], r["wave"]) <= 0.3]
        real, fake = [], []
        for r in closed:
            if (r.get("beachFoamOuter") or 0) < 0.2:
                continue
            x = m["stack"][idx[r["day"]]]
            q = ratio(swir_window(scene_of[(t["id"], r["day"])], t, m["n"]), x, m["outer"] & np.isfinite(x) & (x > r["thr"]))
            (real if q < FOAM_MAX_SWIR_RATIO else fake).append({"day": r["day"], "waveM": r["wave"][0], "dirDeg": r["wave"][1],
                                                                 "printedM": round(printed(t["id"], r["wave"]), 2), "swirRatio": round(q, 2)})
        q_calm = max(0.04, (sum((r.get("beachFoamOuter") or 0) >= 0.2 for r in calm) + 1) / (len(calm) + 2))
        p = sf(len(real), len(closed) - len(fake), q_calm)
        verdict = "ΣΚΑΕΙ" if len(real) >= 2 and p < 0.05 else "δεν αποδεικνύεται"
        out.append({"id": t["id"], "name": t["name"], "sayCalmDays": len(closed), "surfRealFoam": len(real),
                    "brightNotFoam": len(fake), "calmDays": len(calm), "pValue": round(p, 5), "verdict": verdict,
                    "evidence": real, "rejected": fake})
        print(f"(1) {t['name'][:24]:<24} λέμε ήρεμη {len(closed)} · αληθινός αφρός {len(real)} · φωτεινό-όχι-αφρός {len(fake)} · p={p:.4f} → {verdict}")
    return out


def check_wavy(targets):
    # Οι ήρεμες μέρες ΜΠΑΙΝΟΥΝ στη στοίβα: η μάσκα νερού (P5) θέλει σκοτεινές μέρες — χωρίς αυτές η λωρίδα
    # της παραλίας μετακινείται (μάθημα §Γ75· 11/09 έδωσε 0/13 σκοτεινές στο Καλό Λιμάνι αντί για 9/11).
    by_beach, scene_of = plan(targets, {"closed": 0, "open": 80, "refused": 60, "calm": 30}, 0.8)
    out = []
    for t in targets:
        chips = load(t, by_beach[t["id"]])
        if len(chips) < 5:
            continue
        rows, _ = j.measure_beach(t, chips)
        m = masks(chips)
        idx = {c[0]: k for k, c in enumerate(chips)}
        real_ctrl, fake_ctrl = [], []
        for r in rows:
            if r.get("class") not in ("open", "refused") or "beachFoam" not in r or (r.get("exposedFoam") or 0) < 0.3:
                continue
            x = m["stack"][idx[r["day"]]]
            mask = m["far"] & np.isfinite(x) & (j.angdiff(m["normal"], r["wave"][1]) <= j.EXPOSED_MAX_DEG) & (x > r["thr"])
            q = ratio(swir_window(scene_of[(t["id"], r["day"])], t, m["n"]), x, mask)
            item = {"day": r["day"], "waveM": r["wave"][0], "dirDeg": r["wave"][1], "beachFoam": r["beachFoam"],
                    "neighbourFoam": r["exposedFoam"], "swirRatio": round(q, 2)}
            (real_ctrl if q < FOAM_MAX_SWIR_RATIO else fake_ctrl).append(item)
        hits = sum(d["beachFoam"] >= 0.2 for d in real_ctrl)
        dark = sum(d["beachFoam"] < 0.05 for d in real_ctrl)
        p = cdf(hits, len(real_ctrl), P_NAT_STRICT)
        verdict = "ΗΣΥΧΗ" if len(real_ctrl) >= 3 and dark >= 2 and p < 0.01 else "δεν αποδεικνύεται"
        out.append({"id": t["id"], "name": t["name"], "realControlDays": len(real_ctrl), "beachFoam": hits, "beachDark": dark,
                    "fakeControlDays": len(fake_ctrl), "pValue": round(p, 6), "verdict": verdict, "evidence": real_ctrl})
        print(f"(2) {t['name'][:24]:<24} διπλανή με αληθινό αφρό {len(real_ctrl)} (βράχος {len(fake_ctrl)}) · εδώ αφρός {hits} / σκοτεινή {dark} · p={p:.5f} → {verdict}")
    return out


def validate():
    days = json.loads((j.ROOT / ".tmp/s2judge/national-days.json").read_text(encoding="utf-8"))["beaches"]
    kinds = {}
    for f in (j.ROOT / "public/data/beaches/app").glob("*.json"):
        for b in json.loads(f.read_text(encoding="utf-8"))["island"]["beaches"]:
            kinds[str(b["id"])] = b.get("beachType")
    cand = [(bid, r) for bid, b in days.items() if kinds.get(bid) == "sandy" for r in (b["days"] or [])
            if r.get("class") == "open" and (r.get("beachFoamOuter") or 0) >= 0.4 and (r.get("exposedFoam") or 0) >= 0.3]
    random.seed(7)
    tmap = {t["id"]: t for t in j.load_targets()}
    sample = random.sample(cand, 14)
    tl = [tmap[int(b)] for b, _ in sample]
    foam_r, land_r = [], []
    for (bid, r), t, sc_days in zip(sample, tl, j.scenes_by_beach(tl)):
        sc = sc_days.get(r["day"])
        if not sc:
            continue
        nir, scl = j.load_chip(j.chip_path(t, r["day"]))
        s = swir_window(sc, t, nir.shape[0])
        n = nir.shape[0]; yy, xx = np.mgrid[0:n, 0:n]
        near = np.hypot(xx + 0.5 - n / 2, yy + 0.5 - n / 2) * 10.0 <= 300
        fr = ratio(s, nir, near & np.isfinite(nir) & (nir > r["thr"]) & (nir < 0.25) & np.isin(scl, [2, 6, 7]))
        lr = ratio(s, nir, near & np.isfinite(nir) & np.isin(scl, [4, 5]))
        foam_r += [fr] if math.isfinite(fr) else []
        land_r += [lr] if math.isfinite(lr) else []
    print(f"αφρός: {min(foam_r):.2f}-{max(foam_r):.2f} (διάμεσος {np.median(foam_r):.2f}) · στεριά: {min(land_r):.2f}-{max(land_r):.2f} (διάμεσος {np.median(land_r):.2f}) · κατώφλι {FOAM_MAX_SWIR_RATIO}")


def main():
    if "--validate" in _argv:
        validate()
        return
    report = json.loads((j.ROOT / "reports/wave-model/shore-surf-national.json").read_text(encoding="utf-8"))
    listed = {b["id"]: b for b in report.get("listed", [])}
    calm_ids = [int(x) for x in arg("--calm").split(",") if x] if arg("--calm") is not None else report["saysCalmButSurf"]
    wavy_ids = [int(x) for x in arg("--wavy").split(",") if x] if arg("--wavy") is not None else \
        [i for i in report["saysSurfButCalm"] if listed.get(i, {}).get("saysSurfButCalm") == "ΗΣΥΧΗ"]
    targets = {t["id"]: t for t in j.load_targets()}
    calm = check_calm([targets[i] for i in calm_ids if i in targets])
    wavy = check_wavy([targets[i] for i in wavy_ids if i in targets])
    out = j.ROOT / "reports/wave-model/shore-surf-swir-check.json"
    out.write_text(json.dumps({"threshold": FOAM_MAX_SWIR_RATIO, "calm": calm, "wavy": wavy}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Αναφορά: {out.relative_to(j.ROOT)}")


if __name__ == "__main__":
    main()
