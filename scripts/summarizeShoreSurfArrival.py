"""
ΠΟΣΟ ΑΠΟ ΤΟ ΚΥΜΑ ΦΤΑΝΕΙ ΣΤΗΝ ΑΜΜΟ — ΣΥΝΟΨΗ ΤΟΥ ΚΡΙΤΗ SENTINEL-2 (10/09/2026)

Διαβάζει τις δύο αναφορές του scripts/judgeShoreSurfSentinel2.py:
  - shore-surf-sentinel2.json            (καλοκαίρια: μέρες «κλειστής» διεύθυνσης + ήρεμες)
  - shore-surf-sentinel2-capability.json (όλο τον χρόνο: μέρες «ανοιχτής» διεύθυνσης + ήρεμες)
και ανά παραλία συγκρίνει τον αφρό της λωρίδας της ΙΔΙΑΣ άμμου σε τρεις καταστάσεις:

    λόγος άφιξης R = (κλειστή − ήρεμη) / (ανοιχτή − ήρεμη)     (διάμεσοι, μόνο εικόνες χωρίς γυάλισμα)

R ≈ 0 → με κύμα από την «κλειστή» μεριά η άμμος μοιάζει με ήρεμη μέρα: η σκιά είναι αληθινή.
R ≈ 1 → μοιάζει με μέρα ανοιχτής θάλασσας: το κύμα φτάνει, η γεωμετρία σφάλλει.
Κρίνεται ΜΟΝΟ όπου η ίδια λωρίδα έχει δείξει αφρό σε ανοιχτή μέρα (όργανο που βλέπει εδώ).

Ο αφρός δεν είναι γραμμικός με το ύψος — το R είναι ΔΕΙΚΤΗΣ, όχι K_d. Λέει «σκιά ή όχι», όχι «0,1 ή 0,3».

Run: python scripts/summarizeShoreSurfArrival.py
"""
import json
import os
import sys
from statistics import median

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import ROOT  # noqa: E402

MIN_OPEN_SIGNAL = 0.05  # η ανοιχτή μέρα πρέπει να αφρίζει τόσο πάνω από την ήρεμη, αλλιώς το όργανο δεν βλέπει εδώ


def foam(rows, cls):
    return [r["beachFoam"] for r in rows if r.get("class") == cls and "beachFoam" in r]


def main():
    base = ROOT / "reports/wave-model"
    summer = {b["id"]: b for b in json.loads((base / "shore-surf-sentinel2.json").read_text(encoding="utf-8"))["beaches"]}
    capab = {b["id"]: b for b in json.loads((base / "shore-surf-sentinel2-capability.json").read_text(encoding="utf-8"))["beaches"]}
    out = []
    print(f"{'παραλία':<24} {'ομάδα':>9} {'κλειστή':>13} {'ανοιχτή':>13} {'ήρεμη':>11} {'R':>6}  συμπέρασμα")
    print("-" * 100)
    for bid, s in summer.items():
        c = capab.get(bid, {"days": []})
        closed = foam(s["days"], "closed")
        opened = foam(c["days"], "open")
        calm = foam(s["days"], "calm") + foam(c["days"], "calm")
        if not closed or not opened or not calm:
            verdict, ratio = "δεν κρίνεται (λείπουν μέρες)", None
        else:
            cm, om, qm = median(closed), median(opened), median(calm)
            if om - qm < MIN_OPEN_SIGNAL:
                verdict, ratio = "δεν κρίνεται (το όργανο δεν βλέπει αφρό εδώ)", None
            else:
                ratio = round((cm - qm) / (om - qm), 2)
                if len(closed) < 3:
                    verdict = "λίγες κλειστές μέρες"
                elif ratio <= 0.25:
                    verdict = "ΣΚΙΑ ΑΛΗΘΙΝΗ"
                elif ratio >= 0.6:
                    verdict = "ΚΥΜΑ ΦΤΑΝΕΙ"
                else:
                    verdict = "ΜΙΣΗ ΣΚΙΑ"
        fmt = lambda v: f"{median(v):.3f} ({len(v)})" if v else "— (0)"
        print(f"{s['name'][:24]:<24} {s.get('group', ''):>9} {fmt(closed):>13} {fmt(opened):>13} {fmt(calm):>11} "
              f"{('—' if ratio is None else f'{ratio:.2f}'):>6}  {verdict}")
        out.append({"id": bid, "region": s["region"], "name": s["name"], "group": s.get("group"),
                    "closed": {"n": len(closed), "median": median(closed) if closed else None},
                    "open": {"n": len(opened), "median": median(opened) if opened else None},
                    "calm": {"n": len(calm), "median": median(calm) if calm else None},
                    "arrivalRatio": ratio, "verdict": verdict})
    judged = [x for x in out if x["arrivalRatio"] is not None and x["closed"]["n"] >= 3]
    by = {}
    for x in judged:
        by.setdefault(x["verdict"], []).append(x["name"])
    print("\nΚΡΙΘΗΚΑΝ:", len(judged), "·", " · ".join(f"{k}: {len(v)}" for k, v in by.items()))
    (base / "shore-surf-arrival-summary.json").write_text(json.dumps({
        "method": "R = (κλειστή − ήρεμη) / (ανοιχτή − ήρεμη), διάμεσοι αφρού λωρίδας άμμου, Sentinel-2 B08 χωρίς γυάλισμα",
        "beaches": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Αναφορά: reports/wave-model/shore-surf-arrival-summary.json")


if __name__ == "__main__":
    main()
