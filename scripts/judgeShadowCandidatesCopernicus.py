"""
Ο ΔΕΥΤΕΡΟΣ ΚΡΙΤΗΣ ΓΙΑ ΤΙΣ 23 ΠΑΡΑΛΙΕΣ «ΒΑΘΙΑΣ ΣΚΙΑΣ» (βίβλος §Γ74-Ι).

Στις 16/08 το ewam είδε κύμα να φτάνει από «κλειστή» μεριά σε 44 παραλίες
(`reports/quality/blocked-direction-wave.json`). Σε 23 από αυτές ο σημερινός κώδικας δίνει
K_d < 0,5 (`reports/quality/shadow-vs-blocked-arrival.json`, deepShadow). Η μαρτυρία είναι
ΕΝΟΣ μοντέλου· ο γενικός κανόνας δεν αλλάζει χωρίς δεύτερο. Εδώ ρωτάμε το Copernicus MEDSEA
(WAM 4,2 χλμ.) την ΙΔΙΑ ώρα (16/08, 19:00 Ελλάδας = 16:00 UTC) στο πλησιέστερο θαλάσσιο κελί.

ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, δηλωμένο πριν το αποτέλεσμα (ίδιο με judgeBlockedDirectionWave.py):
- συμφωνία ≠ σωστό νούμερο στην ακτή· σημαίνει ότι δεν έχουμε λόγο να πιστέψουμε τη σκιά.
- όπου η στεριά πίσω είναι < ~8 χλμ., η σκιά μπορεί να είναι ΜΙΚΡΟΤΕΡΗ από το κελί του
  κριτή — εκεί η συμφωνία είναι ασθενέστερη μαρτυρία. Γι' αυτό τυπώνεται το landKm.

Run: python scripts/judgeShadowCandidatesCopernicus.py
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import open_dataset, SeaCellIndex, load_beaches, ROOT  # noqa: E402

DATASET = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
VARIABLE = "VHM0"
TARGET_UTC = "2026-08-16T16:00"
AGREE_M = 0.5  # ο κριτής «βλέπει κύμα» όταν δίνει ≥ τόσο — το ίδιο όριο με τη στήλη measured≥0,5


def main():
    import numpy as np

    shadow = json.loads((ROOT / "reports/quality/shadow-vs-blocked-arrival.json").read_text(encoding="utf-8"))
    candidates = [r for r in shadow["rows"] if r.get("deepShadow")]
    beaches = {(b["id"], b["regionFile"]): b for b in load_beaches()}
    by_id = {}
    for b in beaches.values():
        by_id.setdefault(b["id"], []).append(b)

    print(f"άνοιγμα {DATASET} …")
    ds = open_dataset(DATASET)
    times = ds["time"].values
    t_idx = int(np.argmin(np.abs(times - np.datetime64(TARGET_UTC, "ns"))))
    stamp = str(times[t_idx])[:16]
    print(f"χρονικό βήμα κριτή: {stamp} UTC (ζητήθηκε {TARGET_UTC})\n")
    if stamp != TARGET_UTC:
        sys.exit(f"Το σύνολο δεν έχει την ώρα {TARGET_UTC} — πλησιέστερη {stamp}. Σταματώ.")

    index = SeaCellIndex(ds, VARIABLE, time_index=t_idx)
    field = ds[VARIABLE].isel(time=t_idx).load()

    rows = []
    print(f"{'παραλία':<34} {'στεριά':>7} {'ewam':>6} {'κριτής':>7} {'ακτή μας':>9}  κελί")
    print("-" * 84)
    for r in candidates:
        b = beaches.get((r["id"], r["region"])) or (by_id.get(r["id"]) or [None])[0]
        if not b:
            print(f"{r['name']:<34} — δεν βρέθηκε στα αρχεία περιοχής")
            continue
        hit = index.nearest(b["lat"], b["lon"])
        if not hit:
            print(f"{r['name']:<34} — καμία θαλάσσια κυψέλη σε 25 χλμ")
            continue
        clat, clon, dist = hit
        value = float(field.sel(latitude=clat, longitude=clon, method="nearest").values)
        rows.append({
            "id": r["id"], "region": r["region"], "name": r["name"], "landKm": r["landKm"],
            "ewam_m": r["measuredM"], "copernicus_m": round(value, 2), "our_shore_m": r["shoreM"],
            "kd": r["kd"], "judgeSeesWave": value >= AGREE_M,
            "cell": {"lat": round(clat, 4), "lon": round(clon, 4), "distance_km": round(dist, 2)},
        })
        print(f"{r['name'][:34]:<34} {r['landKm']:>6.1f}χ {r['measuredM']:>6.2f} {value:>7.2f} {r['shoreM']:>9.2f}  {dist:.1f}χλμ")

    seen = [x for x in rows if x["judgeSeesWave"]]
    summary = {
        "candidates": len(candidates), "judged": len(rows),
        "judgeSeesWaveGe05": len(seen),
        "judgeSeesWaveGe05_landAtLeast8km": sum(1 for x in seen if x["landKm"] >= 8),
        "judgeSeesWaveGe05_ourShoreBelow03": sum(1 for x in seen if x["our_shore_m"] < 0.3),
    }
    print(f"\nο κριτής βλέπει ≥{AGREE_M} μ. σε {len(seen)}/{len(rows)} · "
          f"από αυτές τυπώνουμε <0,3 μ. σε {summary['judgeSeesWaveGe05_ourShoreBelow03']}")

    out = ROOT / "reports/wave-model/shadow-candidates-judge.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "judge_dataset": DATASET, "judge_timestep_utc": stamp,
        "question": "Βλέπει και δεύτερο ανεξάρτητο μοντέλο κύμα εκεί που ο κώδικας δίνει βαθιά σκιά (K_d<0,5);",
        "caveat": "Συμφωνία ≠ σωστό νούμερο στην ακτή. Με στεριά <8 χλμ. η σκιά μπορεί να είναι μικρότερη από το κελί των 4,2 χλμ.",
        "summary": summary, "rows": rows,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Αναφορά: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
