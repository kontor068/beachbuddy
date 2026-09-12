"""
ΤΟ K_d ΒΑΘΜΟΝΟΜΕΙΤΑΙ ΜΕ ΤΟΝ ΔΟΡΥΦΟΡΟ ΠΟΥ ΗΔΗ ΕΤΡΕΞΕ (12/09/2026, βίβλος §Γ81 Δ7) — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.

ΤΙ ΡΩΤΑΕΙ. Η σκιά της ακτής K_d(θ) (utils/seaArrival.ts: 1 στον διάδρομο, 0,5 στην άκρη, 0,5·e^(−θ/45°) ως 0,1)
έχει τη ΜΟΡΦΗ της από εγχειρίδιο και τις ΤΙΜΕΣ της από κανέναν («εξωτερικός κριτής: κανένας», εγχειρίδιο). Ο
πανελλαδικός κριτής Sentinel-2 (§Γ75/§Γ76) απάντησε ναι/όχι: «η βαθιά σκιά στέκει». Εδώ ρωτάμε ΠΟΣΟ: αν το
K_d είναι σωστό, τότε το ύψος που τυπώνουμε (say·Hs) πρέπει να προβλέπει τον αφρό στην άμμο ΤΟ ΙΔΙΟ καλά είτε
η μέρα ήταν «ανοιχτή» (say≈1) είτε «σκιά» (say≤0,5). Δηλαδή P(αφρός | say·Hs) πρέπει να είναι ΜΙΑ καμπύλη.
Αν η καμπύλη της σκιάς είναι μετατοπισμένη αριστερά (αφρίζει με μικρότερο «τυπωμένο» ύψος), η σκιά είναι
ρηχότερη απ' όσο λέμε — και ο συντελεστής που τις ευθυγραμμίζει είναι το εμπειρικό K_d.

ΔΕΔΟΜΕΝΑ (όλα στον δίσκο, 0 €):
  .tmp/s2judge/national-days.json    ανά παραλία (κλειδί = id) × μέρα: wave=[Hs, dir, T] (Copernicus 09 UTC),
                                     beachFoam / beachFoamOuter (λωρίδα 10-20 / 20-30 μ.), exposedFoam, class
  .tmp/shadow-kd-geometric.json      ανά παραλία: kd[72] και say[72] (0..355°, βήμα 5°) — «say» = το κλάσμα του
                                     ανοιχτού ύψους που τυπώνει η σελίδα (σκέλος σκιάς), null = δεν κρίνεται

ΜΕΘΟΔΟΣ.
  • γεγονός = beachFoamOuter ≥ 0,2 (ίδιο κατώφλι με τον κριτή, εξωτερική λωρίδα — η βρεγμένη άμμος και οι
    βάρκες φωτίζουν μόνο την πρώτη). Παραλίες «θορυβώδεις» (αφρός >25% των ήρεμων ημερών) εκτός, όπως στον κριτή.
  • x = log(H_print) με H_print = say(dir)·Hs. Ομάδες κατά say: ανοιχτή (≥0,9), άκρη (0,4-0,6), βαθιά σκιά (≤0,25).
  • λογιστική P(αφρός)=σ(a+b·x) ανά ομάδα (Newton, numpy), + καμπύλη αναφοράς από την ανοιχτή ομάδα.
  • για κάθε ομάδα σκιάς: ο πολλαπλασιαστής s που ελαχιστοποιεί τη λογιστική απόκλιση όταν εφαρμόσουμε την
    ΑΝΟΙΧΤΗ καμπύλη σε log(s·H_print) — αν s≈1 το K_d στέκει· s>1 = η σκιά είναι ρηχότερη κατά s.
  • bootstrap 300 επαναλήψεων ανά παραλία (όχι ανά μέρα — οι μέρες της ίδιας παραλίας δεν είναι ανεξάρτητες)
    για διάστημα εμπιστοσύνης του s.

ΟΡΙΑ (κληρονομούνται από τον κριτή): αφρός = κύμα που σκάει (~0,4-0,5 μ.+), τυφλό 0,1-0,3· στιγμιότυπο ~12:15·
μία μέση διεύθυνση από τον Copernicus· βότσαλο αφρίζει λιγότερο. Γι' αυτό το s λέει «κατά πόσο», όχι εκατοστά.

Run: python scripts/calibrateShadowKdSentinel.py  → reports/wave-model/shadow-kd-calibration-<μέρα>.json
"""
import json
import math
import os
import sys
from datetime import date

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Τα .tmp/ δεδομένα ζουν στο δέντρο που έτρεξε τον κριτή (κύριο μηχάνημα)· ένα worktree δεν τα έχει.
_DATA = os.environ.get("CB_DATA_ROOT") or (ROOT if os.path.exists(os.path.join(ROOT, ".tmp", "s2judge")) else os.getcwd())
DAYS = os.path.join(_DATA, ".tmp", "s2judge", "national-days.json")
KD = os.path.join(_DATA, ".tmp", "shadow-kd-geometric.json")
FOAM_DAY = 0.2
NOISY_CALM = 0.25
MIN_HS = 0.3            # κάτω από εδώ ο κριτής είναι τυφλός (ούτε ανοιχτή ακτή αφρίζει)
GROUPS = [("open", 0.9, 1.01), ("edge", 0.4, 0.6), ("deep", 0.0, 0.25)]
BOOT = 300
rng = np.random.default_rng(12)


def load():
    with open(DAYS, encoding="utf-8") as f:
        days = json.load(f)["beaches"]
    with open(KD, encoding="utf-8") as f:
        kd = json.load(f)["beaches"]
    return days, kd


def say_at(entry, deg):
    arr = entry.get("say") or []
    if not arr:
        return None
    i = int(round((deg % 360) / 5)) % len(arr)
    v = arr[i]
    return None if v is None else float(v)


def kd_at(entry, deg):
    arr = entry.get("kd") or []
    if not arr:
        return None
    i = int(round((deg % 360) / 5)) % len(arr)
    return float(arr[i])


def rows_from(days, kd):
    rows = []
    for bid, b in days.items():
        ds = b.get("days") or []
        calm = [d for d in ds if d.get("class") == "calm" and isinstance(d.get("beachFoamOuter"), (int, float))]
        if calm and sum(1 for d in calm if d["beachFoamOuter"] >= FOAM_DAY) / len(calm) > NOISY_CALM:
            continue  # θορυβώδης λωρίδα — έξω, όπως στον κριτή
        e = kd.get(str(bid))
        if not e:
            continue
        for d in ds:
            w = d.get("wave")
            fo = d.get("beachFoamOuter")
            if not w or not isinstance(fo, (int, float)):
                continue
            hs, deg = float(w[0]), float(w[1])
            if not (hs >= MIN_HS):
                continue
            s = say_at(e, deg)
            if s is None:
                continue
            rows.append((int(bid), hs, deg, s, kd_at(e, deg), fo >= FOAM_DAY, d.get("class")))
    return rows


def fit_logistic(x, y, iters=60):
    """P(y)=σ(a+b·x), Newton με μικρή L2 για σταθερότητα."""
    X = np.column_stack([np.ones_like(x), x])
    w = np.zeros(2)
    lam = 1e-3
    for _ in range(iters):
        z = X @ w
        p = 1 / (1 + np.exp(-z))
        g = X.T @ (p - y) + lam * w
        H = (X * (p * (1 - p))[:, None]).T @ X + lam * np.eye(2)
        step = np.linalg.solve(H, g)
        w = w - step
        if np.max(np.abs(step)) < 1e-8:
            break
    return w


def deviance(w, x, y):
    z = w[0] + w[1] * x
    p = np.clip(1 / (1 + np.exp(-z)), 1e-9, 1 - 1e-9)
    return float(-2 * np.sum(y * np.log(p) + (1 - y) * np.log(1 - p)))


def best_scale(w_open, x_print, y):
    """Ο πολλαπλασιαστής s στο H_print που κάνει την ΑΝΟΙΧΤΗ καμπύλη να ταιριάζει στα δεδομένα της σκιάς."""
    grid = np.exp(np.linspace(np.log(0.25), np.log(8.0), 121))
    devs = [deviance(w_open, x_print + math.log(s), y) for s in grid]
    i = int(np.argmin(devs))
    return float(grid[i]), float(devs[i])


def main():
    days, kd = load()
    rows = rows_from(days, kd)
    if len(rows) < 500:
        print("πολύ λίγες μέρες — δεν βγάζω συμπέρασμα", len(rows))
        sys.exit(1)
    beach = np.array([r[0] for r in rows])
    hs = np.array([r[1] for r in rows])
    say = np.array([r[3] for r in rows])
    y = np.array([1.0 if r[5] else 0.0 for r in rows])
    hprint = np.maximum(say * hs, 0.02)
    xprint = np.log(hprint)

    out = {"generatedAt": date.today().isoformat(), "beachDays": int(len(rows)), "beaches": int(len(set(beach.tolist()))),
           "event": f"beachFoamOuter >= {FOAM_DAY}", "minOffshoreHs": MIN_HS, "groups": {}}
    masks = {name: (say >= lo) & (say < hi) for name, lo, hi in GROUPS}
    w_open = fit_logistic(xprint[masks["open"]], y[masks["open"]])
    # ύψος στο οποίο η ανοιχτή ακτή αφρίζει στις μισές μέρες — η «κλίμακα» του κριτή
    h50_open = math.exp(-w_open[0] / w_open[1]) if w_open[1] > 0 else None
    for name, lo, hi in GROUPS:
        m = masks[name]
        n = int(m.sum())
        if n < 100:
            out["groups"][name] = {"n": n, "note": "λίγα"}
            continue
        w = fit_logistic(xprint[m], y[m])
        h50 = math.exp(-w[0] / w[1]) if w[1] > 0 else None
        s, dev = best_scale(w_open, xprint[m], y[m])
        # bootstrap ανά παραλία
        ids = np.unique(beach[m])
        idx_by_id = {b: np.where(m & (beach == b))[0] for b in ids}
        boots = []
        for _ in range(BOOT):
            pick = rng.choice(ids, size=len(ids), replace=True)
            idx = np.concatenate([idx_by_id[b] for b in pick])
            sb, _ = best_scale(w_open, xprint[idx], y[idx])
            boots.append(sb)
        lo_ci, hi_ci = float(np.percentile(boots, 5)), float(np.percentile(boots, 95))
        foam_rate = float(y[m].mean())
        out["groups"][name] = {
            "sayRange": [lo, hi], "n": n, "beaches": int(len(ids)), "foamRate": round(foam_rate, 3),
            "medianOffshoreHs": round(float(np.median(hs[m])), 2), "medianPrintedH": round(float(np.median(hprint[m])), 2),
            "logistic": {"a": round(float(w[0]), 3), "b": round(float(w[1]), 3), "h50m": round(h50, 2) if h50 else None},
            "scaleToMatchOpen": {"s": round(s, 2), "ci90": [round(lo_ci, 2), round(hi_ci, 2)],
                                  "meaning": "η ανοιχτή καμπύλη ταιριάζει στη σκιά όταν το τυπωμένο ύψος πολλαπλασιαστεί επί s — s>1 = η σκιά είναι ρηχότερη απ' όσο λέμε"},
        }
    out["openReference"] = {"a": round(float(w_open[0]), 3), "b": round(float(w_open[1]), 3), "h50m": round(h50_open, 2) if h50_open else None}
    # ανά ζώνη K_d γεωμετρίας (όχι say): τι λέει η γεωμετρία vs τι κάνει η άμμος
    kdv = np.array([r[4] if r[4] is not None else np.nan for r in rows])
    bands = [("kd≈0.1", 0.0, 0.15), ("kd 0.15-0.35", 0.15, 0.35), ("kd≈0.5", 0.35, 0.65), ("kd 0.65-0.95", 0.65, 0.95), ("kd≈1", 0.95, 1.01)]
    out["byGeometricKd"] = {}
    for name, lo, hi in bands:
        m = (kdv >= lo) & (kdv < hi) & ~np.isnan(kdv)
        if m.sum() < 100:
            continue
        # εδώ το «τυπωμένο» παίρνει το ΓΕΩΜΕΤΡΙΚΟ kd (σαν να μην υπήρχε η πύλη «say»), για να κριθεί η ίδια η γεωμετρία
        xg = np.log(np.maximum(kdv[m] * hs[m], 0.02))
        s, _ = best_scale(w_open, xg, y[m])
        out["byGeometricKd"][name] = {"n": int(m.sum()), "foamRate": round(float(y[m].mean()), 3),
                                      "medianOffshoreHs": round(float(np.median(hs[m])), 2), "scaleToMatchOpen": round(s, 2),
                                      "impliedKd": round(float(np.median(kdv[m]) * s), 2)}
    rep = os.path.join(ROOT, "reports", "wave-model", f"shadow-kd-calibration-{date.today().isoformat()}.json")
    os.makedirs(os.path.dirname(rep), exist_ok=True)
    with open(rep, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"K_d vs Sentinel-2: {len(rows)} παραλιο-μέρες, {out['beaches']} παραλίες, Hs ανοιχτά ≥ {MIN_HS} μ.")
    print(f"  ανοιχτή ακτή: αφρίζει στις μισές μέρες όταν τυπώνουμε ~{out['openReference']['h50m']} μ.")
    for name, g in out["groups"].items():
        if "logistic" not in g:
            print(f"  {name}: {g}")
            continue
        print(f"  {name:5s} n={g['n']:5d} παραλίες={g['beaches']:4d} αφρός {g['foamRate']*100:4.1f}% · Hs διάμεση {g['medianOffshoreHs']} → τυπώνουμε {g['medianPrintedH']} · h50 {g['logistic']['h50m']} · s={g['scaleToMatchOpen']['s']} [{g['scaleToMatchOpen']['ci90'][0]}-{g['scaleToMatchOpen']['ci90'][1]}]")
    for name, g in out["byGeometricKd"].items():
        print(f"  γεωμετρία {name:13s} n={g['n']:5d} αφρός {g['foamRate']*100:4.1f}% · s={g['scaleToMatchOpen']} → εμπειρικό K_d ≈ {g['impliedKd']}")
    print(f"→ {os.path.relpath(rep, ROOT)}")


if __name__ == "__main__":
    main()
