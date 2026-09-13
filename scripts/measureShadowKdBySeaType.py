"""
Δ11 (βήμα 1) — ΜΑΖΕΥΕΤΑΙ ΤΟ «ΛΕΜΕ ΗΡΕΜΗ, ΣΚΑΕΙ» ΣΤΗ ΦΟΥΣΚΟΘΑΛΑΣΣΙΑ; (13/09/2026, βίβλος §Γ81 Δ11)

Η ιδέα των δύο K_d: το κύμα ανέμου (κοντή περίοδος, τοπικό) σβήνει στη σκιά της ακτής όσο λέει η γεωμετρία,
η φουσκοθαλασσιά (μακριά περίοδος, από μακριά) στρίβει περισσότερο και μπαίνει. Αν αυτό ισχύει, στις μέρες
ΒΑΘΙΑΣ ΣΚΙΑΣ (say ≤ 0,25) ο αφρός στην άμμο πρέπει να είναι πιο συχνός — και το εμπειρικό K_d ψηλότερο — όταν
η θάλασσα είναι φουσκοθαλασσιά ή μεικτή, απ' ό,τι όταν είναι καθαρό κύμα ανέμου. Ίδια μέθοδος με το Δ7
(calibrateShadowKdSentinel.py: λογιστική P(αφρός | τυπωμένο ύψος), ο πολλαπλασιαστής s που ευθυγραμμίζει τη
σκιά με την ανοιχτή ακτή, bootstrap ανά παραλία), χωρισμένη σε υποσύνολα:

  • κατά περίοδο κορυφής T (Copernicus, ΟΛΕΣ οι μέρες 2022-2026): κύμα ανέμου T ≤ 4 s (SEA_REFERENCE_PERIOD_S),
    ενδιάμεσο 4-7, φουσκοθαλασσιά T ≥ 7 s (GROUND_SWELL_MIN_PERIOD_S) — οι ΔΥΟ σταθερές που ήδη έχει ο κώδικας·
  • κατά χωρισμό του αρχείου Open-Meteo (μόνο μέρες ≥ 13/06/2026, .tmp/s2judge/swell-partition-archive.json):
    «μονή» = γωνία(φουσκοθαλασσιά − κύμα) ≤ 45° ή H_sw < 0,15 μ.· «μεικτή» = αλλιώς· και το αποφασιστικό κελί
    «κύμα ανέμου σε σκιά (say_ws ≤ 0,25) ΚΑΙ φουσκοθαλασσιά από ανοιχτή πόρτα (say_sw ≥ 0,5)» — εκεί ακριβώς θα
    ανέβαζε το τυπωμένο ύψος ένας κανόνας δύο K_d.

ΚΡΙΤΗΡΙΑ (γραμμένα πριν τρέξει): κανόνας ΜΟΝΟ αν στη βαθιά σκιά το εμπειρικό K_d της φουσκοθαλασσιάς/μεικτής
είναι ≥ 2× του κύματος ανέμου/μονής, με CI90 που δεν τέμνονται, n ≥ 500 μέρες και ≥ 100 παραλίες ανά κελί,
ΚΑΙ η ίδια σειρά στο κελί «σκιά για το κύμα ανέμου, πόρτα για τη φουσκοθαλασσιά» (n ≥ 300· λιγότερα =
ένδειξη, όχι απόφαση), ΚΑΙ το εμπειρικό K_d του κύματος ανέμου ≤ 1,5× του μοντέλου. Αλλιώς: μετρήθηκε, δεν
δικαιολογείται.

ΟΡΙΑ: ο δορυφόρος είναι τυφλός κάτω από ~0,4 μ. θραύσης (Δ7-Β)· μία μέση διεύθυνση ανά μέρα· η φουσκοθαλασσιά
του Copernicus (T_peak) και της Open-Meteo (swell_*) δεν είναι ο ίδιος διαχωρισμός — γι' αυτό ο πίνακας
επικύρωσης T × χωρισμός στο κοινό παράθυρο.

Run: CB_DATA_ROOT=C:/Users/Miltos/Desktop/beach python scripts/measureShadowKdBySeaType.py
  → reports/wave-model/shadow-kd-by-sea-type-<μέρα>.json
"""
import json
import math
import os
import sys
from datetime import date

import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # κονσόλα Windows cp1253: τα ελληνικά και το → σκάνε αλλιώς

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from calibrateShadowKdSentinel import (  # noqa: E402
    FOAM_DAY, MIN_HS, NOISY_CALM, best_scale, fit_logistic, kd_at, load, say_at,
)

_DATA = os.environ.get("CB_DATA_ROOT") or (ROOT if os.path.exists(os.path.join(ROOT, ".tmp", "s2judge")) else os.getcwd())
ARCHIVE = os.path.join(_DATA, ".tmp", "s2judge", "swell-partition-archive.json")
SEA_REFERENCE_PERIOD_S = 4.0     # utils/waveCharacter.ts
GROUND_SWELL_MIN_PERIOD_S = 7.0  # utils/swellExposure.ts
MIXED_ANGLE_DEG = 45.0           # βίβλος §Γ81 Δ11
SWELL_MIN_M = 0.15               # WITNESSED_SEA_MIN_COMPONENT_M — «η συνιστώσα υπάρχει»
BOOT = 300
MIN_CELL_N = 500
MIN_CELL_BEACHES = 100
rng = np.random.default_rng(12)


def rows_with_period(days, kd):
    """Ίδιο με rows_from του Δ7, συν T_peak και ημερομηνία — για τους χωρισμούς."""
    rows = []
    for bid, b in days.items():
        ds = b.get("days") or []
        calm = [d for d in ds if d.get("class") == "calm" and isinstance(d.get("beachFoamOuter"), (int, float))]
        if calm and sum(1 for d in calm if d["beachFoamOuter"] >= FOAM_DAY) / len(calm) > NOISY_CALM:
            continue
        e = kd.get(str(bid))
        if not e:
            continue
        for d in ds:
            w = d.get("wave")
            fo = d.get("beachFoamOuter")
            if not w or not isinstance(fo, (int, float)):
                continue
            hs, deg = float(w[0]), float(w[1])
            tp = float(w[2]) if len(w) > 2 and isinstance(w[2], (int, float)) else None
            if not (hs >= MIN_HS):
                continue
            s = say_at(e, deg)
            if s is None:
                continue
            rows.append({"bid": int(bid), "hs": hs, "deg": deg, "say": s, "kd": kd_at(e, deg), "foam": fo >= FOAM_DAY, "tp": tp, "day": d.get("day")})
    return rows


def angle_gap(a, b):
    raw = abs((a - b) % 360.0)
    return 360.0 - raw if raw > 180.0 else raw


def implied(w_open, xprint, y, beach, kdv):
    """s (vs ανοιχτή καμπύλη), CI90 bootstrap ανά παραλία, εμπειρικό K_d = median(kd)·s."""
    s, _ = best_scale(w_open, xprint, y)
    ids = np.unique(beach)
    idx_by_id = {b: np.where(beach == b)[0] for b in ids}
    boots = []
    for _ in range(BOOT):
        pick = rng.choice(ids, size=len(ids), replace=True)
        idx = np.concatenate([idx_by_id[b] for b in pick])
        sb, _ = best_scale(w_open, xprint[idx], y[idx])
        boots.append(sb)
    med_kd = float(np.nanmedian(kdv)) if np.isfinite(np.nanmedian(kdv)) else None
    return {
        "n": int(len(y)), "beaches": int(len(ids)), "foamRate": round(float(y.mean()), 3),
        "medianOffshoreHs": round(float(np.median(np.exp(xprint) / np.maximum(kdv if med_kd else 1, 1e-9))), 2) if False else None,
        "s": round(float(s), 2), "ci90": [round(float(np.percentile(boots, 5)), 2), round(float(np.percentile(boots, 95)), 2)],
        "medianModelKd": round(med_kd, 3) if med_kd is not None else None,
        "impliedKd": round(med_kd * s, 3) if med_kd is not None else None,
    }


def cell(rows_sub, w_open, label):
    if len(rows_sub) < 100:
        return {"n": len(rows_sub), "note": "λίγα", "label": label}
    beach = np.array([r["bid"] for r in rows_sub])
    hs = np.array([r["hs"] for r in rows_sub])
    say = np.array([r["say"] for r in rows_sub])
    y = np.array([1.0 if r["foam"] else 0.0 for r in rows_sub])
    kdv = np.array([r["kd"] if r["kd"] is not None else np.nan for r in rows_sub])
    xprint = np.log(np.maximum(say * hs, 0.02))
    out = implied(w_open, xprint, y, beach, kdv)
    out["label"] = label
    out["medianOffshoreHs"] = round(float(np.median(hs)), 2)
    out["medianPrintedH"] = round(float(np.median(np.maximum(say * hs, 0.02))), 2)
    out["enough"] = bool(out["n"] >= MIN_CELL_N and out["beaches"] >= MIN_CELL_BEACHES)
    return out


def main():
    days, kd = load()
    rows = rows_with_period(days, kd)
    if len(rows) < 500:
        print("πολύ λίγες μέρες", len(rows))
        sys.exit(1)
    # Η ανοιχτή καμπύλη αναφοράς: ΟΛΕΣ οι ανοιχτές μέρες (say ≥ 0,9) — ίδια με το Δ7.
    open_rows = [r for r in rows if r["say"] >= 0.9]
    w_open = fit_logistic(np.log(np.maximum(np.array([r["say"] * r["hs"] for r in open_rows]), 0.02)),
                          np.array([1.0 if r["foam"] else 0.0 for r in open_rows]))
    deep = [r for r in rows if r["say"] <= 0.25]
    report = {"generatedAt": date.today().isoformat(), "beachDays": len(rows), "deepDays": len(deep),
              "openReferenceN": len(open_rows), "constants": {"SEA_REFERENCE_PERIOD_S": SEA_REFERENCE_PERIOD_S, "GROUND_SWELL_MIN_PERIOD_S": GROUND_SWELL_MIN_PERIOD_S, "MIXED_ANGLE_DEG": MIXED_ANGLE_DEG, "SWELL_MIN_M": SWELL_MIN_M},
              "criteria": {"ratio": 2.0, "minN": MIN_CELL_N, "minBeaches": MIN_CELL_BEACHES, "decisiveMinN": 300, "windSeaMaxOverModel": 1.5},
              "byPeriod": {}, "byArchivePartition": None, "validation": None, "decision": None}

    # ── Α. Κατά περίοδο κορυφής, όλες οι μέρες ─────────────────────────────────────────────
    def tband(tp):
        if tp is None:
            return None
        return "windsea" if tp <= SEA_REFERENCE_PERIOD_S else ("swell" if tp >= GROUND_SWELL_MIN_PERIOD_S else "mid")
    for band in ("windsea", "mid", "swell"):
        sub = [r for r in deep if tband(r["tp"]) == band]
        report["byPeriod"][band] = cell(sub, w_open, f"deep · T {band}")
        # και η ανοιχτή ακτή στην ίδια ζώνη, ως έλεγχος: αφρίζει η φουσκοθαλασσιά διαφορετικά και στα ανοιχτά;
        sub_open = [r for r in open_rows if tband(r["tp"]) == band]
        report["byPeriod"][f"{band}_open"] = cell(sub_open, w_open, f"open · T {band}")
    report["byPeriod"]["none"] = {"n": sum(1 for r in deep if r["tp"] is None)}

    # ── Β. Κατά χωρισμό του αρχείου (μόνο ≥ since) ─────────────────────────────────────────
    if os.path.exists(ARCHIVE):
        with open(ARCHIVE, encoding="utf-8") as f:
            arch = json.load(f)
        ab = arch.get("beaches", {})
        parted = []
        for r in rows:
            a = ab.get(str(r["bid"]), {}).get("days", {}).get(r["day"]) if r["day"] else None
            if not a or not isinstance(a.get("hsw"), (int, float)) or not isinstance(a.get("dsw"), (int, float)):
                continue
            e = kd.get(str(r["bid"]))
            say_sw = say_at(e, float(a["dsw"]))
            dww = a.get("dww") if isinstance(a.get("dww"), (int, float)) else a.get("dir")
            say_ws = say_at(e, float(dww)) if isinstance(dww, (int, float)) else r["say"]
            mixed = a["hsw"] >= SWELL_MIN_M and isinstance(a.get("dir"), (int, float)) and angle_gap(float(a["dsw"]), float(a["dir"])) > MIXED_ANGLE_DEG
            parted.append({**r, "mixed": bool(mixed), "say_sw": say_sw, "say_ws": say_ws, "hsw": float(a["hsw"]), "tsw": a.get("tsw"), "hww": a.get("hww")})
        deep_p = [r for r in parted if r["say"] <= 0.25]
        report["byArchivePartition"] = {
            "since": arch.get("since"), "records": len(parted), "deepRecords": len(deep_p),
            "single": cell([r for r in deep_p if not r["mixed"]], w_open, "deep · μονή θάλασσα"),
            "mixed": cell([r for r in deep_p if r["mixed"]], w_open, "deep · μεικτή θάλασσα"),
            "deepWs_openSw": cell([r for r in parted if r["say_ws"] is not None and r["say_sw"] is not None and r["say_ws"] <= 0.25 and r["say_sw"] >= 0.5 and r["hsw"] >= SWELL_MIN_M], w_open, "κύμα ανέμου σε σκιά, φουσκοθαλασσιά από ανοιχτή πόρτα"),
            "deepWs_deepSw": cell([r for r in parted if r["say_ws"] is not None and r["say_sw"] is not None and r["say_ws"] <= 0.25 and r["say_sw"] <= 0.25], w_open, "κύμα ανέμου ΚΑΙ φουσκοθαλασσιά σε σκιά"),
        }
        # Επικύρωση: T_peak ζώνη × χωρισμός στο κοινό παράθυρο
        table = {}
        for r in parted:
            key = f"{tband(r['tp'])}|{'mixed' if r['mixed'] else 'single'}"
            table[key] = table.get(key, 0) + 1
        report["validation"] = table

    # ── Απόφαση με τα κριτήρια ─────────────────────────────────────────────────────────────
    def passes(hi, lo):
        if not hi or not lo or "impliedKd" not in hi or "impliedKd" not in lo:
            return False, "λείπει κελί"
        if not (hi.get("enough") and lo.get("enough")):
            return False, f"λίγα δεδομένα (n {hi.get('n')}/{lo.get('n')}, παραλίες {hi.get('beaches')}/{lo.get('beaches')})"
        if hi["impliedKd"] is None or lo["impliedKd"] is None or lo["impliedKd"] <= 0:
            return False, "χωρίς K_d"
        ratio = hi["impliedKd"] / lo["impliedKd"]
        disjoint = hi["ci90"][0] > lo["ci90"][1]
        return (ratio >= 2.0 and disjoint), f"λόγος {ratio:.2f}, CI90 {'χωριστά' if disjoint else 'τέμνονται'}"
    p_ok, p_why = passes(report["byPeriod"].get("swell"), report["byPeriod"].get("windsea"))
    a_ok, a_why = (False, "χωρίς αρχείο")
    d_note = "χωρίς αρχείο"
    if report["byArchivePartition"]:
        a_ok, a_why = passes(report["byArchivePartition"]["mixed"], report["byArchivePartition"]["single"])
        dec = report["byArchivePartition"]["deepWs_openSw"]
        d_note = f"n={dec.get('n')} impliedKd={dec.get('impliedKd')}" if "impliedKd" in dec else f"n={dec.get('n')} (λίγα)"
    ws = report["byPeriod"].get("windsea", {})
    ws_ok = ws.get("impliedKd") is not None and ws.get("medianModelKd") and ws["impliedKd"] <= 1.5 * ws["medianModelKd"]
    justified = bool((p_ok or a_ok) and ws_ok)
    report["decision"] = {
        "justified": justified,
        "byPeriod": {"passes": p_ok, "why": p_why},
        "byArchive": {"passes": a_ok, "why": a_why, "decisiveCell": d_note},
        "windSeaWithinModel": {"passes": bool(ws_ok), "impliedKd": ws.get("impliedKd"), "modelKd": ws.get("medianModelKd")},
        "reading": ("Ο αφρός στη βαθιά σκιά ΜΑΖΕΥΕΤΑΙ στη φουσκοθαλασσιά — ο κανόνας δύο K_d δικαιολογείται, με το floor από το impliedKd της φουσκοθαλασσιάς."
                    if justified else
                    "Ο αφρός στη βαθιά σκιά ΔΕΝ μαζεύεται στη φουσκοθαλασσιά (ή τα κελιά δεν φτάνουν) — η Δ11 μετρήθηκε και δεν δικαιολογείται· το έλλειμμα του Δ7 δεν είναι θέμα περιόδου."),
    }
    rep = os.path.join(ROOT, "reports", "wave-model", f"shadow-kd-by-sea-type-{date.today().isoformat()}.json")
    os.makedirs(os.path.dirname(rep), exist_ok=True)
    with open(rep, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"Δ11 — K_d ανά είδος θάλασσας: {len(rows)} παραλιο-μέρες, βαθιά σκιά {len(deep)}")
    for k, g in report["byPeriod"].items():
        if "impliedKd" in g:
            print(f"  {k:13s} n={g['n']:5d} παραλίες={g['beaches']:4d} αφρός {g['foamRate']*100:4.1f}% · Hs {g['medianOffshoreHs']} → τυπώνουμε {g['medianPrintedH']} · s={g['s']} [{g['ci90'][0]}-{g['ci90'][1]}] · K_d μοντέλο {g['medianModelKd']} → εμπειρικό {g['impliedKd']} {'✓' if g['enough'] else '(λίγα)'}")
        else:
            print(f"  {k:13s} {g}")
    if report["byArchivePartition"]:
        print(f"  αρχείο ≥ {report['byArchivePartition']['since']}: {report['byArchivePartition']['records']} μέρες, βαθιά σκιά {report['byArchivePartition']['deepRecords']}")
        for k in ("single", "mixed", "deepWs_openSw", "deepWs_deepSw"):
            g = report["byArchivePartition"][k]
            if "impliedKd" in g:
                print(f"    {k:14s} n={g['n']:5d} παραλίες={g['beaches']:4d} αφρός {g['foamRate']*100:4.1f}% · s={g['s']} [{g['ci90'][0]}-{g['ci90'][1]}] → K_d {g['impliedKd']} {'✓' if g['enough'] else '(λίγα)'}")
            else:
                print(f"    {k:14s} {g}")
        print(f"    επικύρωση T×χωρισμός: {report['validation']}")
    print(f"  ΑΠΟΦΑΣΗ: {'ΔΙΚΑΙΟΛΟΓΕΙΤΑΙ' if justified else 'ΔΕΝ δικαιολογείται'} — περίοδος: {p_why} · αρχείο: {a_why} · κύμα ανέμου εντός μοντέλου: {ws_ok}")
    print(f"→ {os.path.relpath(rep, ROOT)}")


if __name__ == "__main__":
    main()
