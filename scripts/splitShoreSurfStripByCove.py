"""
ΠΟΙΟΣ ΟΡΜΟΣ ΕΙΝΑΙ ΗΣΥΧΟΣ; — Η ΛΩΡΙΔΑ ΤΟΥ ΚΡΙΤΗ ΣΤΗΝ ΑΜΜΟ, ΚΟΜΜΕΝΗ ΣΤΑ ΔΥΟ (11/09/2026, C1).

ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο κριτής Sentinel-2 (scripts/judgeShoreSurfSentinel2.py) μετράει αφρό σε ΟΛΑ τα pixel ακτής
μέσα σε 300 μ. από την πινέζα. Στο Καλό Λιμάνι Λέσβου #1334 η πινέζα κάθεται στον ισθμό μιας χερσονήσου,
οπότε ο κύκλος πιάνει ΔΥΟ όρμους: τον δυτικό (εκεί κοιτάει το προφίλ μας, facing 280°, και εκεί είναι το
πολύγωνο «Καλό Λιμάνι» του OSM) και τον ανατολικό (άλλη παραλία, κοιτάει ΒΑ/Α). Το «ήσυχη» του κριτή
μπορούσε να είναι ο λάθος όρμος. Εδώ η ΙΔΙΑ λωρίδα (ίδια μάσκα νερού P5, ίδια απόσταση 10-30 μ. από τη
στεριά, ίδιο κατώφλι ανά μέρα) χωρίζεται σε κομμάτια και κάθε κομμάτι μετριέται χωριστά.
Στο Καλάμι Χανίων #601 χωρίζεται γύρω από τον μόλο (~50 μ. δυτικά της πινέζας) και σε δυτικό/ανατολικό
μισό — για να φανεί αν η φωτεινότητα των ΗΡΕΜΩΝ ημερών έρχεται από ένα σημείο.

ΠΩΣ. Φορτώνει ΟΛΑ τα παράθυρα της παραλίας που υπάρχουν στον δίσκο (.tmp/s2judge/chips2-1200), τρέχει
την ίδια την measure_beach του κριτή (ο αριθμός «all» ΠΡΕΠΕΙ να βγει ίσος με το beachFoam της — έλεγχος
ότι οι μάσκες είναι οι ίδιες) και ξαναχτίζει τις μάσκες με τις βοηθητικές του κριτή (distance_to_land,
dilate), όπως κάνει και το verifyShoreFoamSwir.masks. Κύμα: Copernicus MEDSEA 09:00 UTC, το κελί του κριτή.

ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ:
 - Ο αφρός δεν είναι ύψος κύματος. «Όχι λωρίδα αφρού» σημαίνει «δεν έσκαγε κύμα που φαίνεται στα 10 μ.»,
   όχι «λάδι». Μικρό κύμα (<~0,3-0,4 μ.) συχνά δεν αφήνει αφρό ορατό από τον δορυφόρο.
 - Μία λήψη τη μέρα, ~12:15 καλοκαίρι / ~11:15 χειμώνα. Το απόγευμα δεν κρίνεται.
 - Ο διαχωρισμός είναι γεωμετρικός (ανατολικά/δυτικά της πινέζας), όχι χάρτης άμμου.
 - Η στήλη exposedFoam είναι του κριτή ΧΩΡΙΣ τον έλεγχο SWIR· ο έλεγχος SWIR ζει στο
   reports/wave-model/shore-surf-swir-check.json και η αναφορά σημειώνει ποιες μέρες τον πέρασαν.

ΜΕΤΡΗΘΗΚΕ 11/09/2026 (all == κριτής σε όλες τις μέρες και για τις δύο παραλίες):
 - #1334 δυτικός όρμος (239 pixel): 29 μέρες ΒΒΔ με SWIR-επαληθευμένο αφρό δίπλα → 0 μέρες ≥0,2, διάμεσος 0,063,
   μέγιστο 0,172· ήρεμες μέρες διάμεσος 0,019· η ΜΙΑ μέρα από τον ανοιχτό διάδρομο (09/01/2026, 298°) → 0,311.
 - #601: ήρεμες μέρες διάμεσος 0,167 (ως 0,269), μέρες κύματος με αφρό δίπλα διάμεσος 0,161 → η λωρίδα δεν
   ξεχωρίζει κύμα από ηρεμία· ούτε ο μόλος εξηγεί τη φωτεινότητα (κοντά 0,128 / μακριά 0,192 σε ήρεμες).

Run: python scripts/splitShoreSurfStripByCove.py   → reports/wave-model/calm-witness-strip-split.json
"""
import glob
import json
import os
import statistics
import sys

import numpy as np

sys.argv = [sys.argv[0], "--national"]  # ο κριτής διαβάζει τη λειτουργία του από το argv κατά το import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import judgeShoreSurfSentinel2 as j  # noqa: E402

WAVES = json.loads((j.CACHE / "waves-cells.json").read_text(encoding="utf-8"))
SWIR = json.loads((j.ROOT / "reports/wave-model/shore-surf-swir-check.json").read_text(encoding="utf-8"))
SWIR_DAYS = {(e["id"], x["day"]): x for e in SWIR.get("wavy", []) for x in e.get("evidence", [])}

# Κομμάτια της λωρίδας, σε μέτρα από την πινέζα (ex = ανατολικά, ny = βόρεια).
PIER_601 = (-50.0, 17.0)  # ο μόλος στο B08 (λευκή ακίδα), .tmp/s2judge/png/601-*.png
PARTS = {
    1334: {"west": lambda ex, ny: ex < 0, "east": lambda ex, ny: ex > 100},
    601: {"nearPier": lambda ex, ny: np.hypot(ex - PIER_601[0], ny - PIER_601[1]) <= 90,
          "awayPier": lambda ex, ny: np.hypot(ex - PIER_601[0], ny - PIER_601[1]) > 90,
          "westHalf": lambda ex, ny: ex < 0, "eastHalf": lambda ex, ny: ex >= 0},
}


def wave(bid, day):
    cell = WAVES["beachCell"].get(str(bid))
    return WAVES["cells"].get(j._cell_key(cell), {}).get(day) if cell else None


def measure(bid):
    chips = []
    for p in sorted(glob.glob(str(j.CHIPS / f"{bid}-*.npz"))):
        day = os.path.basename(p)[len(str(bid)) + 1:-4]
        w = wave(bid, day)
        if w:
            nir, scl = j.load_chip(p)
            chips.append((day, None, w, nir, scl))
    rows, _ = j.measure_beach({"id": bid}, chips)
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
    ex, ny = (xx + 0.5 - n / 2) * 10.0, -(yy + 0.5 - n / 2) * 10.0
    beach = water & (dist >= 1) & (dist <= 3) & ~near_unknown & (np.hypot(ex, ny) <= j.SHORE_RADIUS_M)
    masks = {"all": beach, **{k: beach & f(ex, ny) for k, f in PARTS[bid].items()}}
    out = []
    mismatches = 0
    for (day, _, w, _, _), x, r in zip(chips, stack, rows):
        rec = {"day": day, "wave": w, "swirVerifiedControl": (bid, day) in SWIR_DAYS}
        if "beachFoam" not in r:
            rec["skipped"] = r.get("skipped")
            out.append(rec)
            continue
        for k, m in masks.items():
            v = m & np.isfinite(x)
            rec[k] = round(float((x[v] > r["thr"]).mean()), 3) if v.sum() >= 5 else None
        if rec["all"] != r["beachFoam"]:
            mismatches += 1
        rec.update({"judgeBeachFoam": r["beachFoam"], "exposedFoam": r.get("exposedFoam"), "thr": r["thr"]})
        out.append(rec)
    return out, {k: int(m.sum()) for k, m in masks.items()}, mismatches


def stats(rows, key):
    v = [r[key] for r in rows if r.get(key) is not None]
    return {"n": len(v), "median": round(statistics.median(v), 3) if v else None,
            "foamDays_ge_0.2": sum(x >= 0.2 for x in v), "darkDays_lt_0.05": sum(x < 0.05 for x in v),
            "max": max(v) if v else None}


def angdist(a, b):
    return abs(((a - b) % 360 + 540) % 360 - 180)


def main():
    report = {"generatedBy": "scripts/splitShoreSurfStripByCove.py", "beaches": {}}
    for bid in (1334, 601):
        rows, px, mismatches = measure(bid)
        judged = [r for r in rows if "all" in r]
        strict = [r for r in judged if (r.get("exposedFoam") or 0) >= 0.3 and r["wave"][0] >= 0.8]
        calm = [r for r in judged if r["wave"][0] < 0.25]
        groups = {"calm_Hs_lt_0.25": calm, "rough_strictControl_all": strict}
        if bid == 1334:
            groups["rough_strictControl_NNW_333_349"] = [r for r in strict if 333 <= r["wave"][1] <= 349]
            groups["rough_strictControl_openCorridor_270_315"] = [r for r in strict if 270 <= r["wave"][1] <= 315]
            groups["rough_swirVerified_NNW"] = [r for r in judged if r["swirVerifiedControl"] and angdist(r["wave"][1], 341) <= 8]
        keys = ["all"] + list(PARTS[bid].keys())
        report["beaches"][str(bid)] = {
            "stripPixels": px, "controlAllEqualsJudge": mismatches == 0, "allVsJudgeMismatches": mismatches,
            "summary": {g: {k: stats(rs, k) for k in keys} for g, rs in groups.items()},
            "rows": rows,
        }
        print(f"#{bid}: {len(judged)} κρίσιμες μέρες · all==κριτής: {mismatches == 0} · pixel {px}")
        for g, rs in groups.items():
            print(f"   {g:<42} " + " · ".join(f"{k} {stats(rs, k)}" for k in keys[:3]))
    out = j.ROOT / "reports/wave-model/calm-witness-strip-split.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Αναφορά: {out.relative_to(j.ROOT)}")


if __name__ == "__main__":
    main()
