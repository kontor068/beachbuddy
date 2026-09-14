"""
ΟΤΑΝ ΤΑ ΔΥΟ ΜΟΝΤΕΛΑ ΔΙΑΦΩΝΟΥΝ, ΠΟΙΟΣ ΕΧΕΙ ΔΙΚΙΟ; — ΔΙΑΓΝΩΣΗ ΜΕΤΑ ΤΗ ΜΕΤΡΗΣΗ ΜΕΙΓΜΑΤΟΣ (14/09/2026, §Γ85).

⚠️ ΔΗΛΩΜΕΝΟ: αυτό ΔΕΝ είναι προδηλωμένο κριτήριο. Γράφτηκε ΑΦΟΥ το scripts/measureWaveModelBlendAgainstAltimetry.py
(κριτήρια δεσμευμένα στο 261a1d52) πρότεινε «max» — και υπάρχει για να ελέγξει τον κίνδυνο που αυτό κρύβει: το ewam
μπήκε 31/07 επειδή στις ΥΠΗΝΕΜΕΣ ακτές λέει πιο ήρεμα από το meteofrance, και το «max» διαλέγει το meteofrance ακριβώς
εκεί. Ο κανόνας του §ewam (memory ewam-confident-gap-rule): όταν το ewam δηλώνει διαφορά ≥0,6 μ. η φορά του ήταν σωστή
99,8% — έναντι Copernicus (ΜΟΝΤΕΛΟΥ). Εδώ κρίνεται απέναντι σε ΟΡΓΑΝΟ.

Ερώτημα: στις συγκρίσεις όπου τα δύο μοντέλα απέχουν ≥ G μ., ποιο είναι πιο κοντά στο αλτίμετρο; χωριστά για
«ewam πιο ήρεμο» και «ewam πιο φουρτουνιασμένο», χωριστά κοντά στην ακτή (5-15 χλμ.) και ανοιχτά (≥15).
Καμία κλήση δικτύου πέρα από τη μάσκα στεριάς — διαβάζει τη μνήμη (.tmp/altimetry) του προηγούμενου τρεξίματος.

Run: PYTHONIOENCODING=utf-8 python scripts/measureWaveModelDisagreementAgainstAltimetry.py --start 2026-06-16 --end 2026-09-14
"""
import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from copernicusCommon import ROOT, write_report  # noqa: E402
from auditWaveModelAgainstAltimetry import SATELLITES, log, model_at  # noqa: E402
from measureWaveModelBlendAgainstAltimetry import BIN_DEG, BIN_SECONDS, CACHE, band_of, dist_at, distance_map  # noqa: E402

GAPS = [0.2, 0.4, 0.6]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    args = ap.parse_args()
    lats, lons, dist = distance_map()
    series = {m: json.loads((CACHE / f"model3_{m}_{args.start}_{args.end}.json").read_text(encoding="utf-8"))
              for m in ("ewam", "meteofrance_wave")}
    bins = defaultdict(list)
    for sat in SATELLITES:
        f = CACHE / f"1km_{sat}_{args.start}_{args.end}.json"
        if not f.exists():
            continue
        for epoch, la, lo, h in json.loads(f.read_text(encoding="utf-8")):
            d = dist_at(lats, lons, dist, la, lo)
            if math.isnan(d):
                continue
            key = (sat, int(epoch // BIN_SECONDS), round(math.floor(la / BIN_DEG) * BIN_DEG + BIN_DEG / 2, 3),
                   round(math.floor(lo / BIN_DEG) * BIN_DEG + BIN_DEG / 2, 3))
            bins[key].append((epoch, h, d))

    out = {}
    for zone, test in (("κοντά 5-15 χλμ.", lambda d: 5 <= d < 15), ("ανοιχτά ≥15 χλμ.", lambda d: d >= 15)):
        for gap in GAPS:
            for side in ("ewam πιο ήρεμο", "ewam πιο ψηλό"):
                n = ewam_closer = mf_closer = 0
                obs_sum = ew_sum = mf_sum = 0.0
                for (sat, _, blat, blon), s in bins.items():
                    d = sum(x[2] for x in s) / len(s)
                    if not test(d):
                        continue
                    epoch = sum(x[0] for x in s) / len(s)
                    obs = sum(x[1] for x in s) / len(s)
                    key = f"{blat:.3f},{blon:.3f}"
                    ew = model_at(series["ewam"].get(key), epoch)
                    mf = model_at(series["meteofrance_wave"].get(key), epoch)
                    if ew is None or mf is None or ew <= 0:
                        continue
                    diff = mf - ew
                    if (side == "ewam πιο ήρεμο" and diff < gap) or (side == "ewam πιο ψηλό" and -diff < gap):
                        continue
                    n += 1
                    obs_sum += obs; ew_sum += ew; mf_sum += mf
                    if abs(ew - obs) < abs(mf - obs):
                        ewam_closer += 1
                    else:
                        mf_closer += 1
                row = {"n": n, "ewamCloser": ewam_closer, "mfCloser": mf_closer,
                       "ewamCloserPct": round(100 * ewam_closer / n, 1) if n else None,
                       "meanObserved_m": round(obs_sum / n, 3) if n else None,
                       "meanEwam_m": round(ew_sum / n, 3) if n else None, "meanMf_m": round(mf_sum / n, 3) if n else None}
                out[f"{zone} | διαφορά ≥{gap} | {side}"] = row
                log(f"  {zone:16} διαφορά ≥{gap:.1f} μ. · {side:15} n={n:5} · ewam πιο κοντά {row['ewamCloserPct']}% · "
                    f"μέσα: όργανο {row['meanObserved_m']} ewam {row['meanEwam_m']} meteofrance {row['meanMf_m']}")
    write_report("reports/wave-model/altimetry-disagreement.json",
                 {"window": {"start": args.start, "end": args.end}, "note": "διάγνωση ΜΕΤΑ τη μέτρηση μείγματος — όχι προδηλωμένο κριτήριο",
                  "rows": out})
    log("Αναφορά: reports/wave-model/altimetry-disagreement.json")


if __name__ == "__main__":
    main()
