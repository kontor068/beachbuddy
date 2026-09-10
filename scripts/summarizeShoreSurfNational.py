"""
ΠΑΝΕΛΛΑΔΙΚΟΣ ΚΡΙΤΗΣ ΣΤΗΝ ΑΜΜΟ — ΟΙ ΔΥΟ ΛΙΣΤΕΣ (βίβλος §Γ76, 10/09/2026)

Διαβάζει τις μετρήσεις ανά μέρα του `judgeShoreSurfSentinel2.py --national`
(.tmp/s2judge/national-days.json) και βγάζει:

  (1) «ΛΕΜΕ ΗΡΕΜΗ, ΣΚΑΕΙ ΚΥΜΑ»: μέρες που το ανοιχτό κύμα ≥0,8 μ. ερχόταν από μεριά όπου η σελίδα
      τυπώνει ≤ 1/5 του ανοιχτού (shoreSeaStateM με το K_d), κι όμως η λωρίδα της άμμου αφρίζει.
  (2) «ΛΕΜΕ ΚΥΜΑ, ΕΙΝΑΙ ΗΣΥΧΗ»: μέρες που το ανοιχτό κύμα ≥0,8 μ. ερχόταν από μεριά όπου η σελίδα
      τυπώνει ≥ 0,9 του ύψους, ΚΑΙ η ακτή δίπλα που κοιτάει το ίδιο κύμα αφρίζει την ίδια στιγμή
      (≥0,1) — κι όμως η λωρίδα της παραλίας δεν αφρίζει. Δύο είδη μέρας:
        «open»    — και η γεωμετρία τη λέει ανοιχτή (K_d ≥ 0,9): λάθος γεωμετρία ή λάθος προσανατολισμός
        «refused» — η γεωμετρία βλέπει σκιά, αλλά η πύλη αρνήθηκε την έκπτωση: εκεί η γεωμετρία είχε δίκιο

ΤΑ ΚΡΙΤΗΡΙΑ ΕΙΝΑΙ ΣΤΑΤΙΣΤΙΚΑ, ΟΧΙ ΚΑΤΩΦΛΙΑ ΣΤΟ ΜΑΤΙ. Η πρώτη εκδοχή (10/09) είχε «≥75% σκοτεινές
μέρες» κ.λπ. και έβγαζε 2 παραλίες στη (2) — αυθαίρετο όριο, όχι μέτρηση. Τώρα κάθε παραλία συγκρίνεται
με ΜΕΤΡΗΜΕΝΗ βάση, διωνυμικά:
  (1) αφρός τις «κλειστές» μέρες απέναντι στον ΔΙΚΟ ΤΗΣ αφρό των ήρεμων ημερών (κάτω όριο 4% = ο εθνικός
      ψεύτικος αφρός): P(≥k) < 0,01 και k ≥ 3. «Αφρός» εδώ = στην ΕΞΩΤΕΡΙΚΗ λωρίδα (20-30 μ.), και μόνο μέρες
      που τυπώνουμε ≤0,3 μ. — δύο διορθώσεις που έφερε ο έλεγχος με το μάτι της πρώτης λίστας (10/09):
      βρεγμένη άμμος/λιμανάκι φωτίζει μόνο το πρώτο pixel (Χάρακας #75, Βότση #2601), και «1/5 μιας
      τρικυμίας 3 μ.» είναι 0,6 μ. — όχι «ήρεμη» (Μαντροκλήσι #2172).
  (2) αφρός τις μέρες «κύματος» με αφρισμένη τη διπλανή ακτή, απέναντι στην ΕΘΝΙΚΗ ευαισθησία του οργάνου
      σε τέτοιες μέρες (μετριέται εδώ): P(≤k) < 0,01 και ≥2 μέρες εντελώς σκοτεινή άμμος (<0,05).
      ΔΥΟ ΑΥΣΤΗΡΟΤΗΤΕΣ ΕΛΕΓΧΟΥ: «ΗΣΥΧΗ» μόνο όταν η διπλανή ακτή ήταν ΑΣΠΡΗ (≥30% αφρός — εκεί το όργανο
      βρίσκει αφρό και στην παραλία στο ~84% των μερών)· με χαλαρό έλεγχο (≥10%) → «ΘΕΛΕΙ ΜΑΤΙ». Με το μάτι
      10/09: στο 10% η «αφρισμένη» διπλανή ακτή ήταν συχνά σχεδόν ήσυχη κι αυτή.
Η (2) έχει γνωστή παγίδα: βότσαλο με απότομο πάτο σκάει σε λωρίδα <10 μ. — λιγότερος αφρός ενώ το κύμα
ΣΚΑΕΙ και χτυπάει στην ακτή. Γι' αυτό σημειώνεται το υλικό της παραλίας.
Λωρίδα που «αφρίζει» σε >25% των ήρεμων ημερών = θορυβώδης (ρηχός λευκός βυθός, βράχια, λιμάνι) → έξω.
Ο λόγος άφιξης R της §Γ75 κρατιέται στην αναφορά ως πληροφορία.

Run: python scripts/summarizeShoreSurfNational.py  → reports/wave-model/shore-surf-national.json
"""
import json
import math
import os
import sys
from statistics import median

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import ROOT  # noqa: E402

FOAM_DAY = 0.2          # ίδια κατώφλια με τον κριτή
DARK = 0.05
EXPOSED_FOAM = 0.1      # χαλαρός έλεγχος ίδιας εικόνας (ίδιος με τον κριτή)
EXPOSED_STRICT = 0.3    # αυστηρός: η διπλανή ακτή ΑΣΠΡΗ
CALM_PRINT_MAX = 0.3    # «λέμε ήρεμη» = τυπώνουμε ως 0,3 μ.
MIN_OPEN_SIGNAL = 0.05  # ίδιο με summarizeShoreSurfArrival.py
NOISY_CALM = 0.25
CALM_FLOOR = 0.04       # εθνικός ψεύτικος αφρός ήρεμων ημερών (μετρημένος 10/09: 4,1%)
ALPHA = 0.01
WITNESSES_LIVE = {2189, 1696}  # utils/seaArrival.ts: εκεί η σελίδα ΔΕΝ τυπώνει τη βαθιά σκιά
SAY = {}  # beachId → κλάσμα που τυπώνει η σελίδα ανά 5° (scripts/exportGeometricShadowKd.mjs)


def judged(rows, cls):
    return [r for r in rows if r.get("class") == cls and "beachFoam" in r]


def binom_sf(k, n, p):
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k, n + 1))


def binom_cdf(k, n, p):
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(0, k + 1))


def printed_m(bid, wave):
    say = (SAY.get(str(bid)) or {}).get("say")
    if not say or wave[1] is None:
        return None
    s = say[int(round((wave[1] % 360) / 5)) % 72]
    return round(s * wave[0], 2) if s is not None else None


def controlled(rows, level=EXPOSED_FOAM):
    """Μέρες που τυπώνουμε σχεδόν όλο το κύμα ΚΑΙ η διπλανή ακτή αφρίζει την ίδια στιγμή."""
    return [r for r in judged(rows, "open") + judged(rows, "refused") if (r.get("exposedFoam") or 0) >= level]


def is_noisy(rows):
    calm = judged(rows, "calm")
    return len(calm) >= 3 and sum(r["beachFoam"] >= FOAM_DAY for r in calm) / len(calm) > NOISY_CALM


def surf(r):
    """Κύμα που σκάει: αφρός στην ΕΞΩΤΕΡΙΚΗ λωρίδα (20-30 μ.), όχι μόνο στο πρώτο pixel."""
    return (r.get("beachFoamOuter") or 0) >= FOAM_DAY


def national_rate(beaches, level):
    n = k = 0
    for b in beaches.values():
        if is_noisy(b["days"]):
            continue
        ctrl = controlled(b["days"], level)
        n += len(ctrl)
        k += sum(1 for r in ctrl if r["beachFoam"] >= FOAM_DAY)
    return k, n


def test2(rows, level, p_nat):
    ctrl = controlled(rows, level)
    hits = [r for r in ctrl if r["beachFoam"] >= FOAM_DAY]
    dark = [r for r in ctrl if r["beachFoam"] < DARK]
    p = binom_cdf(len(hits), len(ctrl), p_nat) if len(ctrl) >= 3 else None
    return ctrl, hits, dark, p


def assess(bid, b, p_nat, kinds):
    """p_nat = {επίπεδο ελέγχου: εθνική ευαισθησία} (EXPOSED_FOAM και EXPOSED_STRICT)."""
    rows = b.get("days") or []
    # «κλειστή» = τυπώνουμε ≤0,3 μ. (όχι «1/5 μιας τρικυμίας»)
    closed = [r for r in judged(rows, "closed") if (printed_m(bid, r["wave"]) or 0) <= CALM_PRINT_MAX]
    opened, calm = judged(rows, "open"), judged(rows, "calm")
    wavy = opened + judged(rows, "refused")
    fc = [r["beachFoam"] for r in closed]
    fo = [r["beachFoam"] for r in opened]
    fq = [r["beachFoam"] for r in calm]
    noisy = is_noisy(rows)
    signal = (median(fo) - median(fq)) if (fo and fq) else None
    sees_open = signal is not None and len(fo) >= 2 and signal >= MIN_OPEN_SIGNAL
    ratio = round((median(fc) - median(fq)) / signal, 2) if (sees_open and fc) else None
    strip_can_foam = any(r["beachFoam"] >= FOAM_DAY for r in rows if "beachFoam" in r)
    beach_type, deep = kinds.get(int(bid), (None, None))

    # (1) λέμε ήρεμη, σκάει — κύμα στην εξωτερική λωρίδα, απέναντι στον δικό της ψεύτικο αφρό. Ο «θόρυβος»
    # κρίνεται με το ΙΔΙΟ μέτρο (εξωτερική λωρίδα): αλλιώς μια παραλία με βάρκες στο πρώτο pixel κόβεται
    # ενώ η ζώνη θραύσης της είναι καθαρή (Πόρτο Βρώμη #1216: ήρεμες 0/8, «λέμε ήρεμη» 10/20).
    closed_foam = [r for r in closed if surf(r)]
    calm_false = sum(1 for r in calm if surf(r))
    noisy1 = len(calm) >= 3 and calm_false / len(calm) > NOISY_CALM
    q = max(CALM_FLOOR, (calm_false + 1) / (len(calm) + 2))
    p1 = binom_sf(len(closed_foam), len(closed), q) if len(closed) >= 3 else None
    v1 = None
    if not noisy1 and p1 is not None:
        if p1 < ALPHA and len(closed_foam) >= 3:
            v1 = "ΣΚΑΕΙ"
        elif p1 < 0.05 and len(closed_foam) >= 2:
            v1 = "ΠΙΘΑΝΟ"  # λίγες καθαρές μέρες — θέλει το μάτι
    # (οι «θορυβώδεις» του πρώτου pixel μένουν έξω μόνο από τη (2), που μετρά όλη τη λωρίδα)

    # (2) λέμε κύμα, ήσυχη — απέναντι στην εθνική ευαισθησία του οργάνου, με δύο αυστηρότητες ελέγχου
    ctrl, hits, dark, p2 = test2(rows, EXPOSED_FOAM, p_nat[EXPOSED_FOAM])
    ctrl_s, hits_s, dark_s, p2s = test2(rows, EXPOSED_STRICT, p_nat[EXPOSED_STRICT])
    v2 = None
    if not noisy and p2s is not None and p2s < ALPHA and len(dark_s) >= 2:
        v2 = "ΗΣΥΧΗ"
    elif not noisy and p2 is not None and p2 < ALPHA and len(dark) >= 2:
        v2 = "ΘΕΛΕΙ ΜΑΤΙ"

    def day_list(rs):
        # wave = [ανοιχτό ύψος, διεύθυνση, περίοδος] 09 UTC· printedM = ό,τι θα τύπωνε το σκέλος σκιάς της σελίδας
        return [{"day": r["day"], "class": r["class"], "wave": r["wave"], "printedM": printed_m(bid, r["wave"]),
                 "beach": r["beachFoam"], "beachOuter": r.get("beachFoamOuter"), "exposed": r.get("exposedFoam")} for r in rs]
    listed = bool(v1 or v2)

    return {
        "id": int(bid), "name": b["name"], "region": b["region"], "lat": b["lat"], "lon": b["lon"],
        "beachType": beach_type, "deepWaters": deep, "chips": b.get("chips"), "shorePixels": b.get("shorePixels"),
        "closed": {"n": len(closed), "median": median(fc) if fc else None, "foamDays": len(closed_foam),
                   "pValue": round(p1, 5) if p1 is not None else None},
        "open": {"n": len(opened), "median": median(fo) if fo else None},
        "wavy": {"n": len(wavy), "withControl": len(ctrl), "foamWithControl": len(hits), "darkWithControl": len(dark),
                 "darkWhereGateRefused": sum(1 for r in dark if r["class"] == "refused"),
                 "pValue": round(p2, 5) if p2 is not None else None,
                 "strict": {"withControl": len(ctrl_s), "foamWithControl": len(hits_s), "darkWithControl": len(dark_s),
                            "pValue": round(p2s, 5) if p2s is not None else None}},
        "calm": {"n": len(calm), "median": median(fq) if fq else None, "surfDays": calm_false},
        "openSignal": round(signal, 3) if signal is not None else None, "arrivalRatio": ratio,
        "stripCanFoam": strip_can_foam, "noisy": noisy, "noisySurf": noisy1,
        "saysCalmButSurf": v1, "saysSurfButCalm": v2, "liveWitness": int(bid) in WITNESSES_LIVE,
        # οι αποδείξεις κρατιούνται μόνο για όσες μπήκαν σε λίστα (η αναφορά είναι στο δημόσιο repo — μικρή)
        "evidence1": day_list(sorted(closed_foam, key=lambda r: -(r.get("beachFoamOuter") or 0))) if listed else [],
        "evidence2": day_list(sorted(dark_s if v2 == "ΗΣΥΧΗ" else dark, key=lambda r: -(r.get("exposedFoam") or 0))) if listed else [],
    }


def load_kinds():
    kinds = {}
    for path in sorted((ROOT / "public/data/beaches/app").glob("*.json")):
        for b in (json.loads(path.read_text(encoding="utf-8")).get("island") or {}).get("beaches") or []:
            kinds[b.get("id")] = (b.get("beachType"), (b.get("characteristics") or {}).get("deepWaters"))
    return kinds


def main():
    src = ROOT / ".tmp/s2judge/national-days.json"
    data = json.loads(src.read_text(encoding="utf-8"))
    SAY.update(json.loads((ROOT / ".tmp/shadow-kd-geometric.json").read_text(encoding="utf-8"))["beaches"])
    kinds = load_kinds()
    beaches = {bid: b for bid, b in data["beaches"].items() if b.get("days")}

    # Η εθνική ευαισθησία του οργάνου: σε μέρες που τυπώνουμε κύμα ΚΑΙ η διπλανή ακτή αφρίζει,
    # πόσο συχνά αφρίζει και η άμμος της παραλίας (μόνο μη θορυβώδεις λωρίδες) — ανά αυστηρότητα ελέγχου.
    rates = {lvl: national_rate(beaches, lvl) for lvl in (EXPOSED_FOAM, EXPOSED_STRICT)}
    p_nat = {lvl: k / n for lvl, (k, n) in rates.items()}

    out = [assess(bid, b, p_nat, kinds) for bid, b in beaches.items()]
    list1 = sorted([x for x in out if x["saysCalmButSurf"]], key=lambda x: (x["saysCalmButSurf"] != "ΣΚΑΕΙ", x["closed"]["pValue"]))
    list2 = sorted([x for x in out if x["saysSurfButCalm"]],
                   key=lambda x: (x["saysSurfButCalm"] != "ΗΣΥΧΗ", x["wavy"]["strict"]["pValue"] or 1, x["wavy"]["pValue"] or 1))
    clean = [x for x in out if not x["noisy"]]
    clean1 = [x for x in out if not x["noisySurf"]]
    judged1 = [x for x in clean1 if x["closed"]["n"] >= 3]
    judged2 = [x for x in clean if x["wavy"]["withControl"] >= 3]
    judged2s = [x for x in clean if x["wavy"]["strict"]["withControl"] >= 3]
    cd = sum(x["closed"]["n"] for x in clean1); cf = sum(x["closed"]["foamDays"] for x in clean1)
    qd = sum(x["calm"]["n"] for x in clean1); qf = sum(x["calm"]["surfDays"] for x in clean1)
    print(f"μετρήθηκαν {len(out)} παραλίες · θορυβώδεις (αφρός και σε ήρεμες) {len(out) - len(clean)}")
    print(f"όργανο: «λέμε ήρεμη» (≤{CALM_PRINT_MAX} μ.) κύμα στην άμμο {cf}/{cd} ({cf / cd:.1%}) · ήρεμες {qf}/{qd} ({qf / qd:.1%})")
    for lvl, (k, n) in rates.items():
        print(f"όργανο: «λέμε κύμα» & διπλανή ακτή ≥{lvl:.0%} αφρός → αφρίζει και η παραλία {k}/{n} ({k / n:.1%})")
    print(f"(1) κρίθηκαν {len(judged1)} (≥3 καθαρές μέρες που λέμε ήρεμη) → ΣΚΑΕΙ {sum(1 for x in list1 if x['saysCalmButSurf'] == 'ΣΚΑΕΙ')} · ΠΙΘΑΝΟ {sum(1 for x in list1 if x['saysCalmButSurf'] == 'ΠΙΘΑΝΟ')}")
    print(f"(2) κρίθηκαν {len(judged2s)} με αυστηρό έλεγχο / {len(judged2)} με χαλαρό → ΗΣΥΧΗ {sum(1 for x in list2 if x['saysSurfButCalm'] == 'ΗΣΥΧΗ')} · "
          f"ΘΕΛΕΙ ΜΑΤΙ {sum(1 for x in list2 if x['saysSurfButCalm'] != 'ΗΣΥΧΗ')}")
    print("\n(1) ΛΕΜΕ ΗΡΕΜΗ, ΣΚΑΕΙ ΚΥΜΑ")
    for x in list1:
        c = x["closed"]
        print(f"  #{x['id']:<5} {x['name'][:26]:<26} {x['region'][:20]:<20} κύμα {c['foamDays']:>2}/{c['n']:<2} μέρες που λέμε ήρεμη · "
              f"ήρεμες {x['calm']['surfDays']}/{x['calm']['n']} · p={c['pValue']:.4f} · {x['beachType']}  {x['saysCalmButSurf']}{' · live μάρτυρας' if x['liveWitness'] else ''}")
    print("\n(2) ΛΕΜΕ ΚΥΜΑ, ΕΙΝΑΙ ΗΣΥΧΗ")
    for x in list2:
        w, s = x["wavy"], x["wavy"]["strict"]
        print(f"  #{x['id']:<5} {x['name'][:26]:<26} {x['region'][:20]:<20} αυστηρός: αφρός {s['foamWithControl']}/{s['withControl']} · χαλαρός: {w['foamWithControl']}/{w['withControl']} "
              f"(σκοτεινή {w['darkWithControl']}, πύλη αρνήθηκε σκιά {w['darkWhereGateRefused']}) · {x['beachType']}  {x['saysSurfButCalm']}")
    # Η ΠΥΛΗ ΠΟΥ ΑΡΝΕΙΤΑΙ ΤΗ ΣΚΙΑ, ΚΡΙΜΕΝΗ: σε μέρες «refused» (η γεωμετρία βλέπει σκιά, τυπώνουμε όλο το
    # κύμα) πόσο συχνά αφρίζει η παραλία, απέναντι στις «open» — με αυστηρό έλεγχο ίδιας εικόνας.
    gate = {}
    for cls in ("open", "refused"):
        n = k = 0
        for b in beaches.values():
            if is_noisy(b["days"]):
                continue
            for r in b["days"]:
                if r.get("class") == cls and "beachFoam" in r and (r.get("exposedFoam") or 0) >= EXPOSED_STRICT:
                    n += 1
                    k += r["beachFoam"] >= FOAM_DAY
        gate[cls] = [k, n]
        print(f"πύλη: «{cls}» με αυστηρό έλεγχο → αφρίζει η παραλία {k}/{n} ({k / n:.1%})")
    # Πλήρης πίνακας στο .tmp (για σελίδες/αναλύσεις)· στο δημόσιο repo μόνο όσες κρίθηκαν ή μπήκαν σε λίστα.
    full = ROOT / ".tmp/s2judge/national-assessed.json"
    full.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    keep = [x for x in out if x["saysCalmButSurf"] or x["saysSurfButCalm"]
            or (not x["noisySurf"] and x["closed"]["n"] >= 3) or (not x["noisy"] and x["wavy"]["withControl"] >= 3)]
    report = ROOT / "reports/wave-model/shore-surf-national.json"
    report.write_text(json.dumps({
        "generatedFrom": data.get("generatedAt"),
        "method": "Sentinel-2 L2A B08 10 μ., αφρός λωρίδας άμμου ≤300 μ. από την πινέζα· «κλειστή» = ανοιχτό ≥0,8 μ. όπου η σελίδα τυπώνει ≤0,2 του ύψους (Μάι-Οκτ), «ανοιχτή» = ≥0,8 μ. όπου τυπώνει ≥0,9 και η γεωμετρία λέει ανοιχτό (K_d ≥0,9), «αρνημένη» = τυπώνει ≥0,9 ενώ η γεωμετρία βλέπει σκιά, «ήρεμη» = <0,25 μ. (όλο τον χρόνο). Κύμα: Copernicus MEDSEA 09:00 UTC, πλησιέστερο θαλάσσιο κελί. K_d: γεωμετρία χωρίς εξαίρεση μαρτύρων· «τυπώνει» = shoreSeaStateM (σκέλος σκιάς). Κρίση: διωνυμικό p<0,01 — (1) κύμα = αφρός στην εξωτερική λωρίδα 20-30 μ., μόνο μέρες που τυπώνουμε ≤0,3 μ., απέναντι στις ήρεμες μέρες της ίδιας παραλίας· (2) απέναντι στην εθνική ευαισθησία του οργάνου — «ΗΣΥΧΗ» με αυστηρό έλεγχο (διπλανή ακτή ≥30% αφρός), «ΘΕΛΕΙ ΜΑΤΙ» με χαλαρό (≥10%).",
        "caps": data.get("caps"),
        "instrument": {"saysCalmSurf": [cf, cd], "calmSurf": [qf, qd],
                       "saysWavyFoamLooseControl": list(rates[EXPOSED_FOAM]), "saysWavyFoamStrictControl": list(rates[EXPOSED_STRICT]),
                       "gateStrictControl": gate},
        "counts": {"measured": len(out), "noisy": len(out) - len(clean), "judged1": len(judged1), "list1": len(list1),
                   "judged2": len(judged2), "judged2Strict": len(judged2s), "list2": len(list2),
                   "list2Sure": sum(1 for x in list2 if x["saysSurfButCalm"] == "ΗΣΥΧΗ")},
        "saysCalmButSurf": [x["id"] for x in list1], "saysSurfButCalm": [x["id"] for x in list2],
        "listed": [x for x in out if x["saysCalmButSurf"] or x["saysSurfButCalm"]],
        "judgedTable": {
            "note": f"όσες κρίθηκαν σε μία από τις δύο ερωτήσεις ({len(keep)}/{len(out)})· όλες με όλα τα πεδία: .tmp/s2judge/national-assessed.json",
            "columns": ["id", "name", "region", "beachType", "calmSayDays", "calmSaySurf", "calmDays", "calmSurf",
                        "wavyControlled", "wavyFoam", "wavyStrict", "wavyStrictFoam", "saysCalmButSurf", "saysSurfButCalm"],
            "rows": [[x["id"], x["name"], x["region"], x["beachType"], x["closed"]["n"], x["closed"]["foamDays"],
                      x["calm"]["n"], x["calm"]["surfDays"], x["wavy"]["withControl"], x["wavy"]["foamWithControl"],
                      x["wavy"]["strict"]["withControl"], x["wavy"]["strict"]["foamWithControl"],
                      x["saysCalmButSurf"], x["saysSurfButCalm"]] for x in keep]},
    }, ensure_ascii=False, indent=1).replace("\n   ", " ").replace("\n  ]", "]"), encoding="utf-8")
    print(f"\nΑναφορά: {report.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
