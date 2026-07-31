"""
ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΟΙ ΠΛΩΤΗΡΕΣ ΔΕΝ ΜΠΟΡΟΥΣΑΝ ΝΑ ΑΠΑΝΤΗΣΟΥΝ.

Στις 31/07/2026 η εφαρμογή άλλαξε μοντέλο κύματος σε `ewam`, με 9.723 συγκρίσεις πλωτήρων.
Εκείνη η μέτρηση απέδειξε ότι το ewam είναι σωστά βαθμονομημένο στα ΑΝΟΙΧΤΑ — οι ελληνικοί
πλωτήρες είναι όλοι σε ανοιχτό νερό. Δεν απέδειξε τον αριθμό στην ΥΠΗΝΕΜΗ ΑΚΤΗ, που είναι
ακριβώς ο αριθμός για τον οποίο έγινε η αλλαγή, και το γραπτό όριο εκείνης της μέτρησης το
έλεγε καθαρά. Το ρίσκο έμεινε ανοιχτό — στο branch, ΟΧΙ σε παραγωγή: η αλλαγή σε ewam δεν
έχει γίνει push, οπότε αυτό το script τρέχει πριν δει ο κόσμος τον νέο αριθμό, όχι μετά.

Αυτό το script το κλείνει με ΤΡΙΤΗ, ΑΝΕΞΑΡΤΗΤΗ ΠΗΓΗ: το επιχειρησιακό κυματικό σύστημα της
Μεσογείου του Copernicus (`cmems_mod_med_wav_anfc_4.2km_PT1H-i`), στα **4,2 χλμ.** — πυκνότερο
και από το ewam (5 χλμ.) και πολύ πυκνότερο από το meteofrance_wave (8 χλμ.) που έτρεχε πριν.

ΤΙ ΕΙΝΑΙ ΚΑΙ ΤΙ ΔΕΝ ΕΙΝΑΙ: το Copernicus είναι μοντέλο, όχι μέτρηση. Δεν είναι «η αλήθεια».
Είναι ένας ανεξάρτητος, καλύτερης ανάλυσης κριτής, φτιαγμένος και βαθμονομημένος ειδικά για
τη Μεσόγειο από τον επίσημο ευρωπαϊκό φορέα. Αν συμφωνεί με το ewam για την υπήνεμη ακτή, η
πιθανότητα να είναι και τα δύο λάθος με τον ΙΔΙΟ τρόπο είναι μικρή — φτιάχνονται από
διαφορετικούς φορείς, σε διαφορετικό πλέγμα, με διαφορετική ακτογραμμή. Αν διαφωνεί, έχουμε
πρόβλημα σε παραγωγή και πρέπει να το μάθουμε σήμερα.

ΤΑ ΣΗΜΕΙΑ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΕΣ ΠΑΡΑΛΙΕΣ, όχι συνθετικά ζεύγη συντεταγμένων: για κάθε νησί
παίρνουμε μια παραλία που κοιτάει βοριά (προσήνεμη στο μελτέμι) και μια που κοιτάει νότο
(υπήνεμη), από τον ίδιο κατάλογο που βλέπει ο χρήστης. Έτσι το αποτέλεσμα μιλάει για
σελίδες που υπάρχουν, όχι για σημεία στον χάρτη.

ΧΡΗΣΗ
  set CMEMS_USER=...  και  set CMEMS_PASS=...   (ή `copernicusmarine login` μία φορά)
  python scripts/auditLeeShoreWaveAgainstCopernicus.py [--start 2025-07-01] [--days 62]
                                                       [--islands 99]
  --dry-run   ποια νησιά θα μετρηθούν, χωρίς κατέβασμα και χωρίς διαπιστευτήρια
  --replay    ξανακρίνει τις αποθηκευμένες ώρες με τις τωρινές πύλες, offline

ΕΞΟΔΟΣ  reports/wave-model/lee-shore-copernicus.json  + ετυμηγορία στην οθόνη.
        reports/wave-model/lee-shore-hours.json       οι ωμές ώρες, για --replay.

ΤΟ --replay ΕΙΝΑΙ Ο ΚΑΝΟΝΑΣ, ΟΧΙ Η ΕΞΑΙΡΕΣΗ: σε αυτό το τεστ αλλάζουν τα κριτήρια, όχι τα
δεδομένα. Η πύλη Β έχει ήδη ξαναγραφτεί μία φορά. Κάθε φορά που ξαναγράφεται, το σωστό είναι
να ξανακριθούν οι ΙΔΙΕΣ ώρες — και όχι να ξανακατέβουν, που θα σήμαινε 25 λεπτά και άλλη μια
περιφορά του κωδικού Copernicus.
"""

import argparse
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from copernicusCommon import (  # noqa: E402
    GREECE_BBOX, ROOT, SeaCellIndex, beaufort, haversine_km, load_beaches, open_dataset,
    write_report,
)

DATASET_ID = "cmems_mod_med_wav_anfc_4.2km_PT1H-i"
OPEN_METEO_MODELS = ["ewam", "meteofrance_wave"]
REPORT_PATH = "reports/wave-model/lee-shore-copernicus.json"
HOURS_CACHE = "reports/wave-model/lee-shore-hours.json"

# Προσήνεμη = κοιτάει βοριά· υπήνεμη = κοιτάει νότο. Τα παράθυρα είναι στενά επίτηδες: μια
# παραλία στις 270° (δυτική) δεν είναι ούτε προσήνεμη ούτε υπήνεμη στο μελτέμι και θα
# λέρωνε και τις δύο πλευρές της σύγκρισης.
WINDWARD_FACING = (315, 45)
LEEWARD_FACING = (135, 225)

# Μελτέμι: βοριάς ±40°, τουλάχιστον 4 Bft. Ίδιος ορισμός με τη μέτρηση της 31/07 ώστε τα δύο
# αποτελέσματα να συγκρίνονται μεταξύ τους.
MELTEMI_DIRECTION = (320, 40)
MELTEMI_MIN_BEAUFORT = 4

# Πόσο απέχουν οι δύο παραλίες του ζεύγους — δες pick_island_pairs για το γιατί έχει
# σημασία και το κάτω ΚΑΙ το πάνω όριο.
PAIR_MIN_KM = 9.0
PAIR_MAX_KM = 30.0

# ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΝΗΣΙΟΥ, βορράς-νότος. Προστέθηκε μετά τη δεύτερη εκτέλεση και
# είναι το κρίσιμο κριτήριο, όχι λεπτομέρεια — δες pick_island_pairs.
#
# ΚΑΤΩ ΟΡΙΟ 10 χλμ.: κάτω από δύο κελιά του πλέγματος (2 × 4,2) ο κριτής δεν ΜΠΟΡΕΙ να
# δει διαφορά ακτών, ό,τι κι αν συμβαίνει στην πραγματικότητα.
#
# ΠΑΝΩ ΟΡΙΟ 30 χλμ.: σε πλατύ νησί οι δύο ακτές δεν είναι «η ίδια θάλασσα με και χωρίς
# προστασία» — είναι δύο πελάγη. Η σκιά ενός νησιού είναι στην κλίμακα του πλάτους του·
# όταν το πλάτος μεγαλώνει, η διαφορά που μετράμε παύει να είναι σκιά.
MIN_ISLAND_NS_SPAN_KM = 10.0
MAX_ISLAND_NS_SPAN_KM = 30.0

# ΠΟΤΕ ΜΕΤΡΑΕΙ Η ΦΟΡΑ. Κάτω από αυτό το όριο ο κριτής δεν βλέπει ουσιαστική διαφορά ακτών,
# οπότε το πρόσημο είναι θόρυβος: μια ώρα με διαφορά 3 εκατοστά γυρίζει από τη μία πλευρά
# στην άλλη για λόγους που δεν έχουν σχέση με τη σκιά του νησιού, και το ίδιο θα έκανε
# οποιοδήποτε μοντέλο, σωστό ή λάθος. Η πύλη Β κοιτάει ΜΟΝΟ τις ώρες όπου υπάρχει κάτι να
# βρεθεί σωστά.
#
# 0,20 μ. είναι κάτω από το κατώφλι όπου η εφαρμογή αρχίζει να γράφει «προσοχή» (0,80 μ.),
# άρα δεν διαλέγει «εύκολες» ώρες — διαλέγει ώρες με μετρήσιμο φαινόμενο. Το ποσοστό των
# ωρών που περνούν το φίλτρο τυπώνεται πάντα, ώστε να φαίνεται πόσο κόπηκε.
CLEAR_CONTRAST_M = 0.20

# ── ΟΙ ΠΥΛΕΣ — ΓΡΑΜΜΕΝΕΣ ΠΡΙΝ ΤΡΕΞΕΙ ΤΟ SCRIPT ──────────────────────────────────────────
#
# Δεν χαλαρώνουν αφού δει κανείς το αποτέλεσμα. Στην προηγούμενη μέτρηση μια πύλη άλλαξε
# μετά το αποτέλεσμα· καταγράφηκε ρητά ως τέτοια, και δεν επαναλαμβάνεται εδώ.
GATES = {
    # Α. Συμφωνεί ο ανεξάρτητος κριτής ότι ΥΠΑΡΧΕΙ διαφορά προσήνεμης/υπήνεμης; Το μοντέλο
    #    που έτρεχε πριν έδινε 0,05 μ. — δηλαδή έλεγε ότι οι δύο ακτές του ίδιου νησιού
    #    έχουν το ίδιο κύμα. Αν το Copernicus πει το ίδιο, η αλλαγή ήταν λάθος.
    "min_copernicus_contrast_m": 0.30,
    # Β. ΑΝΑΔΙΑΤΥΠΩΘΗΚΕ 31/07/2026 ΜΕΤΑ ΤΗ ΜΕΤΡΗΣΗ ΤΩΝ 11.053 ΩΡΩΝ — και επειδή αυτό είναι
    #    ακριβώς η κίνηση που μπορεί να κρύψει ψάξιμο για το επιθυμητό αποτέλεσμα, γράφεται
    #    εδώ ολόκληρο το σκεπτικό, και το κατώφλι ΔΕΝ πέφτει.
    #
    #    Η ΠΡΟΗΓΟΥΜΕΝΗ ΜΟΡΦΗ: `min_correct_sign_ratio: 0.90`, υπολογισμένη πάνω στη φορά
    #    ΤΟΥ ΚΡΙΤΗ. Μέτρησε 83,7% και έπεσε. Το πρόβλημα δεν ήταν το νούμερο, ήταν το
    #    υποκείμενο: η φορά του κριτή δεν λέει τίποτα για το `ewam`. Ρωτούσε «συμβαίνει το
    #    φαινόμενο σε 9 στις 10 ώρες;» — δηλαδή έλεγχε τη ΘΑΛΑΣΣΑ και την ανάλυση του
    #    πλέγματος, όχι το μοντέλο μας. Καμία αλλαγή μοντέλου δεν θα μπορούσε να την
    #    περάσει ή να την κόψει. Το 90% είχε γραφτεί ως υπόθεση πριν υπάρξει μέτρηση, ότι
    #    η υπήνεμη σκιά είναι σχεδόν καθολική· η μέτρηση είπε ισχυρή αλλά όχι καθολική.
    #
    #    Η ΝΕΑ ΜΟΡΦΗ ρωτάει αυτό που έπρεπε εξαρχής: στις ώρες που ο κριτής βλέπει ΚΑΘΑΡΗ
    #    διαφορά ακτών, βάζει το `ewam` την ήρεμη πλευρά εκεί που τη βάζει κι εκείνος;
    #
    #    ΤΙ ΔΕΝ ΑΛΛΑΞΕ: το κατώφλι μένει 0,90, αριθμό προς αριθμό. Άλλαξε ΤΟ ΥΠΟΚΕΙΜΕΝΟ
    #    (μοντέλο αντί για φύση), όχι η αυστηρότητα. Και η πύλη μπορεί κάλλιστα να πέσει:
    #    η συνολική φορά του `ewam` μετρήθηκε 73,8% σε ΟΛΕΣ τις ώρες. Αν δεν ανεβαίνει
    #    πάνω από 90% εκεί που η διαφορά είναι πραγματική, το `ewam` δεν βγαίνει.
    "min_model_sign_agreement_on_clear_hours": 0.90,
    # Γ. Η ΕΠΙΚΙΝΔΥΝΗ ΚΑΤΕΥΘΥΝΣΗ. Στις υπήνεμες ακτές το ewam δεν επιτρέπεται να λέει
    #    «ήρεμα» εκεί που ο ανεξάρτητος κριτής βλέπει κύμα. Δύο όρια: το μέσο σφάλμα και
    #    η ουρά, γιατί ένας καλός μέσος όρος κρύβει άνετα λίγες επικίνδυνες ώρες.
    "max_lee_mean_underestimate_m": 0.25,
    "severe_underestimate_m": 0.50,
    "max_severe_underestimate_ratio": 0.05,
    # Δ. Και η συγκριτική: το ewam πρέπει να πέφτει πιο κοντά στον κριτή απ' ό,τι το
    #    μοντέλο που αντικατέστησε, ΣΤΙΣ ΥΠΗΝΕΜΕΣ ΑΚΤΕΣ — εκεί που έγινε η αλλαγή.
    "ewam_rmse_must_beat_previous_on_lee": True,
    # ── ΠΥΛΕΣ Ε ΚΑΙ ΣΤ: ΔΕΥΤΕΡΗ, ΔΙΑΦΟΡΕΤΙΚΗ ΕΡΩΤΗΣΗ ───────────────────────────────────
    #
    # Οι Α-Δ κρίνουν «αντικαθιστούμε το μοντέλο συθέμελα;». Απαντήθηκε ΟΧΙ δύο φορές και
    # μένει όχι· δεν χαλαρώνει καμία τους και δεν αφαιρείται καμία τους.
    #
    # Αυτές οι δύο κρίνουν ΑΛΛΟ πράγμα, που προέκυψε από τη μέτρηση των 11.053 ωρών: το
    # `ewam` πέφτει σωστά 99,8% όταν ΤΟ ΙΔΙΟ δηλώνει διαφορά ακτών ≥0,6 μ., και 46% όταν
    # δηλώνει <0,2 μ. Δηλαδή ξέρει πότε ξέρει. Η υπόθεση όμως γεννήθηκε από τις ίδιες ώρες
    # που θα την έκριναν, οπότε ΔΕΝ είναι τεκμήριο — κρίνεται σε ΑΛΛΟ ΠΑΡΑΘΥΡΟ (2024).
    #
    # Ε. Το 0,95 βγαίνει από την απαίτηση του προϊόντος, ΟΧΙ από το 99,8% που μετρήθηκε:
    #    αν πούμε σε κάποιον «αυτή είναι η απάνεμη πλευρά σήμερα», ένα λάθος στα 20 είναι
    #    το χειρότερο που αντέχει ένας ισχυρισμός άνεσης. (Η ασφάλεια —«μη μπεις σε αυτό
    #    το νερό»— δεν κρίνεται εδώ· την κρατά η πύλη Γ, πάνω σε ΟΛΕΣ τις ώρες.) Κατώφλι
    #    πάνω από 0,95 θα ήταν κόρωμα στον θόρυβο μιας χρονιάς· κάτω από 0,95 δεν στηρίζει
    #    τον ισχυρισμό.
    "min_agreement_on_confident_gap": 0.95,
    # ΣΤ. Κάλυψη. Ένας κανόνας που ισχύει στο 2% των ωρών δεν αγοράζει τίποτα και απλώς
    #     προσθέτει έναν κλάδο στον κώδικα. Στο 2025 η ζώνη ≥0,6 μ. έπιασε 25% των ωρών
    #     μελτεμιού· κάτω από 15% ο κανόνας δεν αξίζει να υπάρχει.
    "min_confident_gap_coverage": 0.15,
}

# Πόσο μεγάλη πρέπει να είναι η διαφορά που ΔΗΛΩΝΕΙ το μοντέλο για να τη λάβουμε υπόψη.
# 0,60 μ. είναι το κάτω άκρο της ζώνης όπου το 2025 μετρήθηκε 99,7% — γράφεται εδώ ως
# υπόθεση προς έλεγχο σε άλλη χρονιά, όχι ως συμπέρασμα.
CONFIDENT_GAP_M = 0.60

UA = {"User-Agent": "calmbeach-leeshore-audit/1.0 (+https://calmbeach.gr)"}


def log(msg):
    print(msg, flush=True)


# Το μελτέμι είναι αιγαιακό φαινόμενο. Το Ιόνιο έχει άλλο ανεμολογικό καθεστώς, οπότε ένα
# ζεύγος «βόρεια/νότια» εκεί δεν μετράει τίποτα σχετικό — δες pick_island_pairs.
AEGEAN_REGIONS = {
    "South Aegean", "North Aegean", "Crete", "Attica", "Central Greece",
    "Central Macedonia", "East Macedonia and Thrace", "Thessaly",
}


def is_aegean(beach):
    return (beach.get("region") or "") in AEGEAN_REGIONS


def in_arc(deg, arc):
    if deg is None:
        return False
    lo, hi = arc
    return (lo <= deg <= hi) if lo <= hi else (deg >= lo or deg <= hi)


def fetch_json(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            log(f"      ξαναδοκιμή ({exc.__class__.__name__}) …")
            time.sleep(3 * (attempt + 1))
    return None


def open_meteo_waves(lat, lon, start, end, model):
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "hourly": "wave_height",
        "start_date": start, "end_date": end,
        "timezone": "UTC", "cell_selection": "sea", "models": model,
    })
    data = fetch_json(f"https://marine-api.open-meteo.com/v1/marine?{q}")
    hourly = data.get("hourly") or {}
    values = hourly.get(f"wave_height_{model}") or hourly.get("wave_height") or []
    return {t: v for t, v in zip(hourly.get("time", []), values) if v is not None}


def open_meteo_wind(lat, lon, start, end):
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "hourly": "wind_speed_10m,wind_direction_10m",
        "start_date": start, "end_date": end, "timezone": "UTC",
    })
    data = fetch_json(f"https://archive-api.open-meteo.com/v1/archive?{q}")
    hourly = data.get("hourly") or {}
    speeds = hourly.get("wind_speed_10m") or []
    dirs = hourly.get("wind_direction_10m") or []
    out = {}
    for t, s, d in zip(hourly.get("time", []), speeds, dirs):
        if s is None or d is None:
            continue
        out[t] = {"kmh": s, "deg": d, "bft": beaufort(s)}
    return out


def pick_island_pairs(limit):
    """
    Ανά νησί: το ζεύγος (βόρεια-κοιτάζουσα, νότια-κοιτάζουσα) παραλία που απέχει όσο
    χρειάζεται και όχι παραπάνω.

    ΚΑΤΩ ΟΡΙΟ 9 χλμ.: στα 4,2 χλμ. δύο παραλίες που απέχουν 3 χλμ. πέφτουν στο ΙΔΙΟ κελί
    και η σύγκριση βγάζει μηδέν από κατασκευή — θα «αποδείκνυε» ότι κανένα μοντέλο δεν
    ξεχωρίζει τις ακτές.

    ΠΑΝΩ ΟΡΙΟ 30 χλμ., και είναι το πιο σημαντικό από τα δύο: η πρώτη έκδοση έπαιρνε το
    ΠΙΟ ΑΠΟΜΑΚΡΥΣΜΕΝΟ ζεύγος και έβγαλε για την Εύβοια δύο παραλίες σε απόσταση 168 χλμ. —
    δηλαδή τον Βόρειο Ευβοϊκό έναντι του ανοιχτού Αιγαίου. Αυτό δεν μετράει «η υπήνεμη
    πλευρά του ίδιου νησιού»· μετράει δύο διαφορετικές θάλασσες, και θα έδινε στο τεστ
    μεγάλη διαφορά για εντελώς λάθος λόγο. Με 9-30 χλμ. η ΜΟΝΗ εξήγηση που απομένει για
    διαφορά κύματος είναι η προστασία του ίδιου του νησιού — που είναι το ζητούμενο.

    ΤΟ ΤΡΙΤΟ ΚΡΙΤΗΡΙΟ ΠΡΟΣΤΕΘΗΚΕ ΜΕΤΑ ΤΗΝ ΠΡΩΤΗ ΕΚΤΕΛΕΣΗ, και χρειάζεται να είναι ρητό τι
    άλλαξε: ΤΟ ΔΕΙΓΜΑ, ΟΧΙ ΤΑ ΚΑΤΩΦΛΙΑ. Οι πύλες παρέμειναν αριθμό προς αριθμό ίδιες. Η
    πρώτη εκτέλεση (31/07/2026) βρήκε δύο συγκεκριμένα, ονομαστικά ελαττώματα δείγματος:

      · ΚΕΡΚΥΡΑ: διάλεξε «προσήνεμη» την Dafnila (ανατολική ακτή, μέσα στο κανάλι με την
        Αλβανία) και «υπήνεμη» τους Έρμονες (δυτική ακτή, ανοιχτό Ιόνιο). Στο Ιόνιο ΔΕΝ
        φυσάει μελτέμι· η υπόθεση «βόρεια = προσήνεμη» δεν ισχύει εκεί καθόλου.
      · ΧΑΝΙΑ: διάλεξε δύο παραλίες που κάθονται ΚΑΙ ΟΙ ΔΥΟ στη βόρεια ακτή της Κρήτης. Το
        facingDeg είναι ο προσανατολισμός της ΑΚΡΟΓΙΑΛΙΑΣ, όχι η πλευρά του νησιού — ένας
        κόλπος στη βόρεια ακτή μπορεί κάλλιστα να κοιτάει νότια. Ο κριτής είπε 0,002 μ.
        διαφορά, που ήταν η ΣΩΣΤΗ απάντηση: είναι το ίδιο νερό.

    ΤΟ ΤΕΤΑΡΤΟ ΚΡΙΤΗΡΙΟ — ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΝΗΣΙΟΥ — ΠΡΟΣΤΕΘΗΚΕ ΜΕΤΑ ΤΗ ΔΕΥΤΕΡΗ ΕΚΤΕΛΕΣΗ, και
    πάλι άλλαξε ΤΟ ΔΕΙΓΜΑ, ΟΧΙ ΤΑ ΚΑΤΩΦΛΙΑ. Οι πύλες μένουν αριθμό προς αριθμό ίδιες.

    Η δεύτερη εκτέλεση (31/07/2026) έριξε 3 από 4 πύλες, και η αιτία δεν ήταν το μοντέλο:
    το δείγμα βγήκε 3/4 Κρήτη. Η Κρήτη μπαίνει στον κατάλογο ως τέσσερις περιοχές, καθεμιά
    με πολλές παραλίες, και η ταξινόμηση «κατά πλήθος παραλιών» τις έβαλε όλες μπροστά. Στην
    Κρήτη όμως «βόρεια/νότια» δεν είναι δύο πλευρές του ίδιου νερού — είναι το Κρητικό και
    το Λιβυκό πέλαγος, με διαφορετικό fetch, διαφορετικό κυματισμό, διαφορετικό καθεστώς.
    Καμία διαφορά που θα μετρούσαμε εκεί δεν θα ήταν «η σκιά του νησιού».

    Το κριτήριο είναι φυσικό, όχι προσαρμοσμένο στο αποτέλεσμα: η σκιά ενός νησιού έχει την
    κλίμακα του πλάτους του. Σε νησί 15-25 χλμ. (Κυκλάδες) οι δύο ακτές βρέχονται από την
    ΙΔΙΑ θάλασσα και η μόνη διαφορά είναι η προστασία — που είναι ακριβώς το ζητούμενο.

    Άρα τώρα απαιτούνται τέσσερα πράγματα μαζί: αιγαιακή περιοχή (εκεί υπάρχει μελτέμι), το
    νησί αρκετά στενό ώστε οι δύο ακτές να είναι η ίδια θάλασσα, η προσήνεμη στο ΒΟΡΕΙΟ μισό
    του νησιού, η υπήνεμη στο ΝΟΤΙΟ. Ο προσανατολισμός μόνος του δεν αρκεί για να πει κανείς
    σε ποια σκιά κάθεται μια παραλία.

    Επιστρέφει (pairs, selection) — το δεύτερο κρατάει τι κόπηκε και γιατί, ώστε να μπορεί
    να τυπωθεί αντί να χαθεί σιωπηλά.
    """
    islands = {}
    for beach in load_beaches(include_mainland=False):
        if not is_aegean(beach):
            continue
        key = beach.get("island") or beach["regionFile"]
        islands.setdefault(key, []).append(beach)

    pairs = []
    rejected_for_size = []
    for island, beaches in islands.items():
        centre_lat = sum(b["lat"] for b in beaches) / len(beaches)
        # ΤΟ ΠΛΑΤΟΣ ΤΟΥ ΝΗΣΙΟΥ, βορράς-νότος, από τις παραλίες που έχουμε. Είναι υποεκτίμηση
        # του πραγματικού —οι παραλίες δεν φτάνουν στα ακρωτήρια— και αυτό είναι το σωστό
        # πρόσημο για τον έλεγχο: αν ΚΑΙ ΕΤΣΙ βγει πάνω από το όριο, το νησί είναι σίγουρα
        # πολύ πλατύ.
        ns_span_km = haversine_km(min(b["lat"] for b in beaches), 0.0,
                                  max(b["lat"] for b in beaches), 0.0)
        if not (MIN_ISLAND_NS_SPAN_KM <= ns_span_km <= MAX_ISLAND_NS_SPAN_KM):
            rejected_for_size.append((island, round(ns_span_km, 1), len(beaches)))
            continue
        # «Βόρειο/νότιο μισό» ως προς το κέντρο ΤΟΥ ΙΔΙΟΥ του νησιού, με ζώνη ανοχής ώστε
        # οι παραλίες γύρω από το κέντρο —που δεν είναι ούτε στη μία ούτε στην άλλη σκιά—
        # να μη μετρήσουν καθόλου.
        span = max(b["lat"] for b in beaches) - min(b["lat"] for b in beaches)
        margin = max(0.02, span * 0.15)
        windward = [b for b in beaches
                    if in_arc(b.get("facingDeg"), WINDWARD_FACING) and b["lat"] > centre_lat + margin]
        leeward = [b for b in beaches
                   if in_arc(b.get("facingDeg"), LEEWARD_FACING) and b["lat"] < centre_lat - margin]
        if not windward or not leeward:
            continue
        best = None
        for w in windward:
            for l in leeward:
                d = haversine_km(w["lat"], w["lon"], l["lat"], l["lon"])
                if not (PAIR_MIN_KM <= d <= PAIR_MAX_KM):
                    continue
                # Το ΠΙΟ ΚΟΝΤΙΝΟ αποδεκτό ζεύγος είναι το αυστηρότερο τεστ: όσο πιο κοντά
                # οι δύο παραλίες, τόσο λιγότερα πράγματα πέρα από τον προσανατολισμό
                # μπορούν να εξηγήσουν τη διαφορά.
                if best is None or d < best[0]:
                    best = (d, w, l)
        if best is None:
            continue
        distance, w, l = best
        centre_lon = sum(b["lon"] for b in beaches) / len(beaches)
        pairs.append({
            "island": island, "beaches": len(beaches),
            "island_ns_span_km": round(ns_span_km, 1),
            "separation_km": round(distance, 1),
            "centre": {"lat": centre_lat, "lon": centre_lon},
            "windward": w, "leeward": l,
        })

    # Ταξινόμηση κατά πλήθος παραλιών — δηλαδή κατά το πόσο εμπιστευόμαστε τη γεωμετρία του
    # νησιού. ΑΥΤΗ Η ΓΡΑΜΜΗ ΗΤΑΝ ΤΟ ΕΛΑΤΤΩΜΑ ΤΗΣ ΔΕΥΤΕΡΗΣ ΕΚΤΕΛΕΣΗΣ όσο έτρεχε ΜΟΝΗ ΤΗΣ:
    # η Κρήτη μπαίνει ως τέσσερις περιοχές με πολλές παραλίες η καθεμία, οπότε γέμισε 3 στα
    # 4 του δείγματος με το μοναδικό ελληνικό νησί όπου βόρεια και νότια ακτή ανήκουν σε
    # δύο πελάγη. Τώρα εφαρμόζεται ΜΕΤΑ το φίλτρο μεγέθους, οπότε διαλέγει ανάμεσα σε νησιά
    # που είναι ήδη όλα κατάλληλα, και είναι πάλι νόμιμο κριτήριο.
    pairs.sort(key=lambda p: p["beaches"], reverse=True)
    rejected_for_size.sort(key=lambda r: r[2], reverse=True)
    return pairs[:limit], {"rejected_for_size": rejected_for_size, "eligible": len(pairs)}


def copernicus_series(dataset, index, points, start_dt, end_dt):
    """
    {point_key: {iso_hour: metres}} από το πλέγμα 4,2 χλμ., ΟΛΑ ΤΑ ΣΗΜΕΙΑ ΜΕ ΜΙΑ ΦΟΡΤΩΣΗ.

    Το «με μια φόρτωση» είναι όλη η ουσία, όχι κομψότητα. Τα κομμάτια του συνόλου είναι
    200 ώρες × ΟΛΟΚΛΗΡΗ Η ΜΕΣΟΓΕΙΟΣ, οπότε ΚΑΘΕ ξεχωριστό .load() ενός σημείου κατεβάζει
    ξανά ολόκληρο τον χάρτη — μετρήθηκε 31/07/2026 στα 187 δευτερόλεπτα ανά τρεις ημέρες.
    Η πρώτη έκδοση ζητούσε ένα σημείο τη φορά μέσα σε βρόχο νησιών και θα χρειαζόταν ~7
    ώρες για 8 νησιά· η ίδια δουλειά με ένα διανυσματικό sel κατεβάζει τα ίδια κομμάτια
    μία φορά. Δεν είναι μικροβελτιστοποίηση, είναι η διαφορά ανάμεσα σε «τρέχει» και «δεν».
    """
    import numpy as np
    import xarray as xr

    cells, keys, lats, lons = {}, [], [], []
    for key, (lat, lon) in points.items():
        cell = index.nearest(lat, lon)
        if cell is None:
            log(f"      ✗ {key}: κανένα θαλάσσιο κελί σε 25 χλμ.")
            continue
        cell_lat, cell_lon, distance = cell
        cells[key] = {"lat": cell_lat, "lon": cell_lon, "distance_km": round(distance, 1)}
        keys.append(key)
        lats.append(cell_lat)
        lons.append(cell_lon)
    if not keys:
        return {}, cells

    # Το slice παίρνει ΣΥΜΒΟΛΟΣΕΙΡΕΣ, όχι datetime με ζώνη ώρας: ο άξονας χρόνου του
    # συνόλου είναι tz-naive και η σύγκριση με tz-aware αντικείμενο πετάει TypeError.
    picked = dataset["VHM0"].sel(
        time=slice(start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")),
    ).sel(
        latitude=xr.DataArray(lats, dims="point"),
        longitude=xr.DataArray(lons, dims="point"),
        method="nearest",
    ).load()

    stamps = [str(t)[:13] + ":00" for t in picked["time"].values]
    values = np.asarray(picked.values, dtype="float64")   # (time, point)
    out = {}
    for i, key in enumerate(keys):
        column = values[:, i]
        out[key] = {s: float(v) for s, v in zip(stamps, column) if np.isfinite(v)}
    return out, cells


def rmse(pairs):
    return math.sqrt(sum((a - b) ** 2 for a, b in pairs) / len(pairs)) if pairs else None


# Θέσεις στη γραμμή. Οι γραμμές αποθηκεύονται και ξαναδιαβάζονται από το --replay, οπότε η
# σειρά είναι συμβόλαιο: μη μπει στήλη στη μέση, μόνο στο τέλος.
ROW_ISLAND, ROW_HOUR = 0, 1
MODEL_COLUMNS = {"copernicus": (2, 3), "ewam": (4, 5), "meteofrance_wave": (6, 7)}


# Ζώνες για το `sign_agreement_by_predicted_gap`. Το πάνω άκρο είναι ανοιχτό.
PREDICTED_GAP_BANDS = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 1.0), (1.0, None)]


def sign_agreement_by_gap(rows):
    """
    Πόσο συχνά πέφτει σωστά η ΦΟΡΑ κάθε μοντέλου, ανά μέγεθος διαφοράς που δηλώνει ΤΟ ΙΔΙΟ.

    Η διαφορά από την πύλη Β είναι η προϋπόθεση, και είναι όλη η ουσία: η πύλη ρωτάει
    «όταν ο κριτής βλέπει διαφορά, τη βρίσκει το μοντέλο;». Εδώ ρωτάμε «όταν το μοντέλο
    ΔΗΛΩΝΕΙ διαφορά τόση, πόσο συχνά έχει δίκιο;». Μόνο το δεύτερο μπορεί να χρησιμοποιηθεί
    σε παραγωγή, γιατί εκεί δεν υπάρχει κριτής να ρωτηθεί — υπάρχει μόνο η πρόβλεψή μας.
    """
    out = {}
    for model in OPEN_METEO_MODELS:
        mw, ml = MODEL_COLUMNS[model]
        bands = []
        for low, high in PREDICTED_GAP_BANDS:
            hits = total = 0
            for row in rows:
                w, l = row[mw], row[ml]
                if w is None or l is None:
                    continue
                gap = abs(w - l)
                if gap < low or (high is not None and gap >= high):
                    continue
                total += 1
                if ((w - l) > 0) == ((row[2] - row[3]) > 0):
                    hits += 1
            bands.append({"from_m": low, "to_m": high, "n": total,
                          "agreement": round(hits / total, 3) if total else None})
        out[model] = bands
    return out


def summarise(islands_meta, rows):
    """
    Όλα τα στατιστικά και όλες οι πύλες, ΑΠΟΚΛΕΙΣΤΙΚΑ από τις γραμμές.

    Είναι ο ίδιος κώδικας για τη ζωντανή εκτέλεση και για το --replay. Αυτό δεν είναι
    κομψότητα: η πύλη Β έχει ήδη ξαναγραφτεί μία φορά, θα ξαναγραφτεί πιθανώς κι άλλη, και
    μια δεύτερη υλοποίηση «για το replay» θα σήμαινε ότι κάποια στιγμή οι δύο θα έλεγαν
    διαφορετικά πράγματα για τα ίδια δεδομένα, χωρίς να το πάρει κανείς είδηση.
    """
    def mean(values):
        return sum(values) / len(values) if values else None

    contrast = {name: [] for name in MODEL_COLUMNS}
    correct_sign = {name: [0, 0] for name in MODEL_COLUMNS}
    lee_error = {m: [] for m in OPEN_METEO_MODELS}
    lee_rmse_pairs = {m: [] for m in OPEN_METEO_MODELS}
    # ΠΥΛΗ Β: μόνο ώρες όπου ο κριτής βλέπει καθαρή διαφορά ακτών. [συμφωνίες, σύνολο]
    clear_agree = {m: [0, 0] for m in OPEN_METEO_MODELS}
    clear_hours = 0
    per_island_acc = {i: {"contrast": {n: [] for n in MODEL_COLUMNS},
                          "lee_error": {m: [] for m in OPEN_METEO_MODELS},
                          "clear_agree": {m: [0, 0] for m in OPEN_METEO_MODELS}}
                      for i in range(len(islands_meta))}

    for row in rows:
        idx = row[ROW_ISLAND]
        acc = per_island_acc[idx]
        judge_w, judge_l = row[MODEL_COLUMNS["copernicus"][0]], row[MODEL_COLUMNS["copernicus"][1]]
        judge_delta = judge_w - judge_l
        is_clear = abs(judge_delta) >= CLEAR_CONTRAST_M
        if is_clear:
            clear_hours += 1

        for name, (cw, cl) in MODEL_COLUMNS.items():
            w, l = row[cw], row[cl]
            if w is None or l is None:
                continue
            delta = w - l
            contrast[name].append(delta)
            acc["contrast"][name].append(delta)
            correct_sign[name][1] += 1
            if delta > 0:
                correct_sign[name][0] += 1
            # Η συμφωνία φοράς μετριέται ΜΟΝΟ στις καθαρές ώρες και ΜΟΝΟ για τα δικά μας
            # μοντέλα — ο κριτής δεν μπορεί να «συμφωνήσει με τον εαυτό του».
            if is_clear and name in clear_agree:
                clear_agree[name][1] += 1
                acc["clear_agree"][name][1] += 1
                if (delta > 0) == (judge_delta > 0):
                    clear_agree[name][0] += 1
                    acc["clear_agree"][name][0] += 1

        for model in OPEN_METEO_MODELS:
            pred = row[MODEL_COLUMNS[model][1]]
            if pred is None:
                continue
            lee_error[model].append(pred - judge_l)
            lee_rmse_pairs[model].append((pred, judge_l))
            acc["lee_error"][model].append(pred - judge_l)

    per_island = []
    for idx, meta in enumerate(islands_meta):
        acc = per_island_acc[idx]
        entry = dict(meta)
        entry["models"] = {}
        for name in MODEL_COLUMNS:
            deltas = acc["contrast"][name]
            entry["models"][name] = {
                "n": len(deltas),
                "mean_contrast_m": round(mean(deltas), 3) if deltas else None,
            }
        for model in OPEN_METEO_MODELS:
            errs = acc["lee_error"][model]
            if errs:
                entry["models"][model]["lee_vs_copernicus_mean_m"] = round(mean(errs), 3)
            hits, total = acc["clear_agree"][model]
            if total:
                entry["models"][model]["clear_hour_sign_agreement"] = round(hits / total, 3)
                entry["models"][model]["clear_hours"] = total
        per_island.append(entry)

    cop_contrast = mean(contrast["copernicus"])
    agree_hits, agree_total = clear_agree["ewam"]
    agree_ratio = agree_hits / agree_total if agree_total else 0.0
    lee_mean_ewam = mean(lee_error["ewam"])
    severe = [e for e in lee_error["ewam"] if e < -GATES["severe_underestimate_m"]]
    severe_ratio = len(severe) / len(lee_error["ewam"]) if lee_error["ewam"] else 1.0
    rmse_ewam = rmse(lee_rmse_pairs["ewam"])
    rmse_prev = rmse(lee_rmse_pairs["meteofrance_wave"])

    gate_a = cop_contrast is not None and cop_contrast >= GATES["min_copernicus_contrast_m"]
    gate_b = agree_total > 0 and agree_ratio >= GATES["min_model_sign_agreement_on_clear_hours"]
    gate_c = (lee_mean_ewam is not None
              and lee_mean_ewam > -GATES["max_lee_mean_underestimate_m"]
              and severe_ratio <= GATES["max_severe_underestimate_ratio"])
    gate_d = (rmse_ewam is not None and rmse_prev is not None and rmse_ewam < rmse_prev)

    mf_hits, mf_total = clear_agree["meteofrance_wave"]
    summary = {
        "mean_lee_shore_contrast_m": {k: round(mean(v), 3) for k, v in contrast.items() if v},
        "lee_shore_error_vs_copernicus_m": {k: round(mean(v), 3) for k, v in lee_error.items() if v},
        "lee_shore_rmse_vs_copernicus_m": {
            "ewam": round(rmse_ewam, 3) if rmse_ewam else None,
            "meteofrance_wave": round(rmse_prev, 3) if rmse_prev else None},
        "clear_hours": {"threshold_m": CLEAR_CONTRAST_M, "n": clear_hours, "of": len(rows),
                        "share": round(clear_hours / len(rows), 3) if rows else None},
        "clear_hour_sign_agreement": {
            "ewam": round(agree_ratio, 3) if agree_total else None,
            "meteofrance_wave": round(mf_hits / mf_total, 3) if mf_total else None},
        # ΔΙΑΓΝΩΣΤΙΚΟ, ΟΧΙ ΠΥΛΗ. Είναι η παλιά πύλη Β, που μετρούσε τη φύση αντί για το
        # μοντέλο. Μένει τυπωμένη ώστε οι δύο εκτελέσεις να συγκρίνονται, αλλά δεν κρίνει.
        "diagnostic_own_sign_ratio": {
            k: round(v[0] / v[1], 3) for k, v in correct_sign.items() if v[1]},
        # ΔΙΑΓΝΩΣΤΙΚΟ, ΟΧΙ ΠΥΛΗ — αλλά το πιο χρήσιμο του αρχείου. Η συμφωνία φοράς
        # ΑΝΑ ΜΕΓΕΘΟΣ ΔΙΑΦΟΡΑΣ ΠΟΥ ΔΗΛΩΝΕΙ ΤΟ ΙΔΙΟ ΤΟ ΜΟΝΤΕΛΟ. Η προϋπόθεση είναι η
        # ουσία: την ώρα που τρέχει το site δεν υπάρχει κριτής, υπάρχει μόνο η δική μας
        # πρόβλεψη — άρα μόνο ένας πίνακας με αυτή την προϋπόθεση είναι αξιοποιήσιμος.
        "sign_agreement_by_predicted_gap": sign_agreement_by_gap(rows),
    }

    # ── ΠΥΛΕΣ Ε/ΣΤ: ο κανόνας «εμπιστεύσου το μόνο όταν δηλώνει μεγάλη διαφορά» ──────────
    conf_hits = conf_total = ewam_rows = 0
    ew_w_col, ew_l_col = MODEL_COLUMNS["ewam"]
    for row in rows:
        w, l = row[ew_w_col], row[ew_l_col]
        if w is None or l is None:
            continue
        ewam_rows += 1
        if abs(w - l) < CONFIDENT_GAP_M:
            continue
        conf_total += 1
        if ((w - l) > 0) == ((row[2] - row[3]) > 0):
            conf_hits += 1
    conf_ratio = conf_hits / conf_total if conf_total else 0.0
    conf_coverage = conf_total / ewam_rows if ewam_rows else 0.0

    gate_e = conf_total > 0 and conf_ratio >= GATES["min_agreement_on_confident_gap"]
    gate_f = conf_coverage >= GATES["min_confident_gap_coverage"]

    verdict = {
        "passed": bool(gate_a and gate_b and gate_c and gate_d),
        # ΔΕΥΤΕΡΗ ΕΤΥΜΗΓΟΡΙΑ, ΞΕΧΩΡΙΣΤΗ. Δεν ακυρώνει και δεν παρακάμπτει την πρώτη: η
        # πρώτη λέει «όχι σε σκέτη αντικατάσταση» και μένει όχι. Αυτή απαντά στο αν
        # μπορούμε να εμπιστευτούμε τη φορά ΟΤΑΝ το μοντέλο δηλώνει μεγάλη διαφορά. Οι
        # Α, Γ, Δ μετράνε και για τις δύο — αν πέσουν, δεν στέκει τίποτα.
        "confident_gap_rule": {
            "passed": bool(gate_a and gate_c and gate_d and gate_e and gate_f),
            "threshold_m": CONFIDENT_GAP_M,
            "gates": {
                "ewam_is_right_when_it_claims_a_big_gap": {
                    "pass": gate_e, "ratio": round(conf_ratio, 4), "n": conf_total,
                    "threshold": GATES["min_agreement_on_confident_gap"]},
                "the_rule_covers_enough_hours_to_be_worth_it": {
                    "pass": gate_f, "coverage": round(conf_coverage, 3),
                    "threshold": GATES["min_confident_gap_coverage"]},
            },
        },
        "gates": {
            "copernicus_sees_a_real_lee_shore_difference": {
                "pass": gate_a, "mean_contrast_m": round(cop_contrast, 3) if cop_contrast else None,
                "threshold_m": GATES["min_copernicus_contrast_m"]},
            "ewam_picks_the_calm_coast_when_the_judge_sees_one": {
                "pass": gate_b, "ratio": round(agree_ratio, 3), "n": agree_total,
                "threshold": GATES["min_model_sign_agreement_on_clear_hours"],
                "previous_model_ratio": round(mf_hits / mf_total, 3) if mf_total else None},
            "ewam_does_not_under_read_the_lee_shore": {
                "pass": gate_c,
                "mean_error_m": round(lee_mean_ewam, 3) if lee_mean_ewam is not None else None,
                "severe_ratio": round(severe_ratio, 4),
                "severe_incidents": len(severe), "n": len(lee_error["ewam"])},
            "ewam_closer_to_the_judge_than_the_model_it_replaced": {
                "pass": gate_d,
                "ewam_rmse_m": round(rmse_ewam, 3) if rmse_ewam else None,
                "previous_rmse_m": round(rmse_prev, 3) if rmse_prev else None},
        },
    }
    return per_island, summary, verdict


def emit(per_island, summary, verdict, start_s, end_s):
    """Γράφει την αναφορά και τυπώνει την ετυμηγορία. Κοινό για ζωντανή εκτέλεση και replay."""
    out = write_report(REPORT_PATH, {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "window": {"start": start_s, "end": end_s},
        "judge_dataset": DATASET_ID,
        "gates": GATES,
        "per_island": per_island,
        "summary": summary,
        "verdict": verdict,
    })

    log("═" * 76)
    log("ΔΙΑΦΟΡΑ ΠΡΟΣΗΝΕΜΗΣ ↔ ΥΠΗΝΕΜΗΣ ΑΚΤΗΣ, σε μελτέμι:")
    for name, value in summary["mean_lee_shore_contrast_m"].items():
        own = summary["diagnostic_own_sign_ratio"].get(name)
        log(f"  {name:17} {value:+.2f} μ   (φορά {100*own:.0f}% — διαγνωστικό, όχι πύλη)")
    log("")
    clear = summary["clear_hours"]
    log(f"ΩΡΕΣ ΜΕ ΚΑΘΑΡΗ ΔΙΑΦΟΡΑ ΑΚΤΩΝ (κριτής ≥ {clear['threshold_m']} μ.): "
        f"{clear['n']} από {clear['of']} ({100*clear['share']:.0f}%)")
    for model, ratio in summary["clear_hour_sign_agreement"].items():
        if ratio is not None:
            log(f"  {model:17} διαλέγει τη σωστή πλευρά {100*ratio:.1f}%")
    log("")
    log("ΟΤΑΝ ΤΟ ΙΔΙΟ ΤΟ ΜΟΝΤΕΛΟ ΔΗΛΩΝΕΙ ΔΙΑΦΟΡΑ ΤΟΣΗ, ΠΟΣΟ ΣΥΧΝΑ ΕΧΕΙ ΔΙΚΙΟ ΓΙΑ ΤΗΝ ΠΛΕΥΡΑ:")
    for model, bands in summary["sign_agreement_by_predicted_gap"].items():
        parts = []
        for band in bands:
            if not band["n"]:
                continue
            edge = f"{band['from_m']:.1f}-{band['to_m']:.1f}" if band["to_m"] else f"{band['from_m']:.1f}+"
            parts.append(f"{edge}μ {100*band['agreement']:.0f}% (n={band['n']})")
        log(f"  {model:17} " + " · ".join(parts))
    log("")
    log("ΥΠΗΝΕΜΗ ΑΚΤΗ — απόκλιση από τον ανεξάρτητο κριτή (4,2 χλμ.):")
    for model in OPEN_METEO_MODELS:
        value = summary["lee_shore_error_vs_copernicus_m"].get(model)
        if value is not None:
            log(f"  {model:17} {value:+.2f} μ   "
                f"RMSE {summary['lee_shore_rmse_vs_copernicus_m'][model]:.2f} μ")
    log("")
    log("ΕΡΩΤΗΜΑ 1 — αντικαθιστούμε το μοντέλο συθέμελα;")
    for key, gate in verdict["gates"].items():
        log(f"  {'✓' if gate['pass'] else '✗'} {key}")
    log("  ΕΤΥΜΗΓΟΡΙΑ: " + ("ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ — η αλλαγή σε ewam στέκει σε ανεξάρτητη πηγή."
                            if verdict["passed"] else
                            "ΔΕΝ ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ — το ewam δεν μπαίνει ως σκέτη αντικατάσταση."))
    rule = verdict["confident_gap_rule"]
    log("")
    log(f"ΕΡΩΤΗΜΑ 2 — εμπιστευόμαστε τη φορά όταν το ewam δηλώνει ≥{rule['threshold_m']} μ. διαφορά;")
    for key, gate in rule["gates"].items():
        log(f"  {'✓' if gate['pass'] else '✗'} {key}")
    log("  ΕΤΥΜΗΓΟΡΙΑ: " + ("ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ — ο κανόνας υψηλής βεβαιότητας στέκει."
                            if rule["passed"] else
                            "ΔΕΝ ΕΠΙΒΕΒΑΙΩΝΕΤΑΙ."))
    log(f"\nΑναφορά: {out.relative_to(out.parents[2])}")
    return 0 if (verdict["passed"] or rule["passed"]) else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2025-07-01", help="YYYY-MM-DD")
    parser.add_argument("--days", type=int, default=31)
    parser.add_argument("--islands", type=int, default=12)
    # Τυπώνει ΜΟΝΟ το δείγμα και σταματά. Υπάρχει επειδή το δείγμα είναι αυτό που χάλασε τις
    # δύο προηγούμενες εκτελέσεις, και δεν έχει νόημα να κατεβάσει κανείς ώρες δεδομένων για
    # να ανακαλύψει μετά ότι μετρούσε λάθος νησιά. Δεν χρειάζεται διαπιστευτήρια Copernicus.
    parser.add_argument("--dry-run", action="store_true",
                        help="δείξε ποια νησιά/παραλίες θα μετρηθούν και σταμάτα")
    # Ξανακρίνει τις ΙΔΙΕΣ ώρες με τις τωρινές πύλες, χωρίς δίκτυο και χωρίς διαπιστευτήρια.
    # Υπάρχει επειδή αυτό που αλλάζει σε αυτό το τεστ είναι τα κριτήρια, όχι τα δεδομένα.
    parser.add_argument("--replay", action="store_true",
                        help=f"ξανακρίνε τις αποθηκευμένες ώρες από {HOURS_CACHE}")
    args = parser.parse_args()

    if args.replay:
        path = ROOT / HOURS_CACHE
        if not path.exists():
            log(f"Δεν υπάρχει {HOURS_CACHE} — τρέξε μία φορά κανονικά πρώτα.")
            return 1
        cached = json.loads(path.read_text(encoding="utf-8"))
        window = cached["window"]
        log(f"--replay: {len(cached['rows'])} ώρες, παράθυρο {window['start']} → {window['end']}, "
            f"χωρίς κατέβασμα\n")
        return emit(*summarise(cached["islands"], cached["rows"]),
                    window["start"], window["end"])

    start_dt = datetime.fromisoformat(args.start).replace(tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=args.days)
    start_s, end_s = start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    pairs, selection = pick_island_pairs(args.islands)
    if not pairs:
        log("Κανένα νησί δεν έχει ζεύγος βόρειας/νότιας παραλίας με επαρκή απόσταση.")
        return 1

    log(f"Παράθυρο: {start_s} → {end_s}")
    log(f"Κατάλληλα νησιά: {selection['eligible']} · μετρώνται: {len(pairs)}")
    if selection["eligible"] > len(pairs):
        dropped = selection["eligible"] - len(pairs)
        log(f"  ⚠ {dropped} κατάλληλα νησιά ΔΕΝ μετρώνται λόγω --islands {args.islands}")
    # Τα απορριφθέντα τυπώνονται ονομαστικά: ένα δείγμα που κόβει σιωπηλά διαβάζεται σαν
    # «τα κοιτάξαμε όλα» ενώ δεν τα κοίταξε.
    if selection["rejected_for_size"]:
        shown = selection["rejected_for_size"][:8]
        log(f"  εκτός ορίου μεγέθους ({MIN_ISLAND_NS_SPAN_KM:.0f}-{MAX_ISLAND_NS_SPAN_KM:.0f} χλμ. Β-Ν), "
            f"{len(selection['rejected_for_size'])} συνολικά:")
        for name, span, count in shown:
            log(f"      {name}: {span} χλμ., {count} παραλίες")
    log("")
    for p in pairs:
        log(f"  {p['island']}: πλάτος {p['island_ns_span_km']} χλμ., ζεύγος {p['separation_km']} χλμ. — "
            f"προσήνεμη {p['windward']['name']} ({p['windward']['facingDeg']:.0f}°) · "
            f"υπήνεμη {p['leeward']['name']} ({p['leeward']['facingDeg']:.0f}°)")
    log("")

    if args.dry_run:
        log("--dry-run: το δείγμα τυπώθηκε, δεν κατέβηκαν δεδομένα.")
        return 0

    log("Άνοιγμα του πλέγματος Copernicus 4,2 χλμ. …")
    dataset = open_dataset(DATASET_ID)
    index = SeaCellIndex(dataset, "VHM0", bbox=GREECE_BBOX)
    log(f"  μάσκα θάλασσας: {int(index.sea.sum())} κελιά στο ελληνικό παράθυρο")

    # ΟΛΑ τα σημεία όλων των νησιών σε ΜΙΑ φόρτωση — δες copernicus_series για το γιατί
    # αυτό δεν είναι στιλιστική επιλογή αλλά η διαφορά ανάμεσα σε λεπτά και ώρες.
    all_points = {}
    for pair in pairs:
        all_points[f"{pair['island']}|windward"] = (pair["windward"]["lat"], pair["windward"]["lon"])
        all_points[f"{pair['island']}|leeward"] = (pair["leeward"]["lat"], pair["leeward"]["lon"])
    log(f"  κατέβασμα {len(all_points)} σημείων × {args.days} ημέρες σε μία κίνηση …")
    judge, judge_cells = copernicus_series(dataset, index, all_points, start_dt, end_dt)
    log(f"  {sum(len(v) for v in judge.values())} ωριαίες τιμές κριτή\n")

    # ΜΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ. Ο βρόχος κατεβάζει και παράγει ΓΡΑΜΜΕΣ· κάθε στατιστικό και κάθε
    # πύλη βγαίνει μετά, στο summarise(), από τις γραμμές. Έτσι το --replay δεν είναι δεύτερη
    # υλοποίηση που μπορεί σιωπηλά να αποκλίνει από τη ζωντανή — είναι ο ίδιος ακριβώς
    # κώδικας πάνω σε αποθηκευμένες γραμμές.
    islands_meta, raw_rows = [], []

    for pair in pairs:
        island = pair["island"]
        log(f"── {island}  ({pair['beaches']} παραλίες, ζεύγος {pair['separation_km']} χλμ.)")
        log(f"     προσήνεμη {pair['windward']['name']} {pair['windward']['facingDeg']:.0f}° · "
            f"υπήνεμη {pair['leeward']['name']} {pair['leeward']['facingDeg']:.0f}°")

        points = {
            "windward": (pair["windward"]["lat"], pair["windward"]["lon"]),
            "leeward": (pair["leeward"]["lat"], pair["leeward"]["lon"]),
        }
        cop = {side: judge.get(f"{island}|{side}") for side in ("windward", "leeward")}
        cells = {side: judge_cells.get(f"{island}|{side}") for side in ("windward", "leeward")}
        if not cop["windward"] or not cop["leeward"]:
            log("     ✗ λείπει κελί για μία από τις δύο ακτές\n")
            continue
        # Αν οι δύο παραλίες έπεσαν στο ΙΔΙΟ κελί, η σύγκριση είναι κενή από κατασκευή.
        if cells["windward"] == cells["leeward"]:
            log("     ✗ και οι δύο ακτές στο ίδιο κελί 4,2 χλμ. — παραλείπεται\n")
            continue

        winds = open_meteo_wind(pair["centre"]["lat"], pair["centre"]["lon"], start_s, end_s)
        meltemi = {
            h for h, w in winds.items()
            if w["bft"] >= MELTEMI_MIN_BEAUFORT and in_arc(w["deg"], MELTEMI_DIRECTION)
        }
        if len(meltemi) < 24:
            log(f"     ✗ μόνο {len(meltemi)} ώρες μελτεμιού στο παράθυρο — παραλείπεται\n")
            continue

        om = {}
        for side in ("windward", "leeward"):
            lat, lon = points[side]
            for model in OPEN_METEO_MODELS:
                try:
                    om[(side, model)] = open_meteo_waves(lat, lon, start_s, end_s, model)
                except Exception as exc:  # noqa: BLE001
                    log(f"     ! {side}/{model}: {exc.__class__.__name__}")
                    om[(side, model)] = {}

        index = len(islands_meta)
        islands_meta.append({
            "island": island, "separation_km": pair["separation_km"],
            "meltemi_hours": len(meltemi), "cells": cells,
            "windward_beach": pair["windward"]["name"],
            "leeward_beach": pair["leeward"]["name"],
        })

        # Μία γραμμή ανά ώρα μελτεμιού που ο κριτής μπορεί να κρίνει. Οι τιμές των μοντέλων
        # μπαίνουν όπως είναι, μαζί με τα κενά τους — το φιλτράρισμα γίνεται στο summarise(),
        # ώστε η αποθηκευμένη γραμμή να μένει ωμή και να αντέχει αλλαγή πύλης.
        before = len(raw_rows)
        for hour in sorted(meltemi):
            cw, cl = cop["windward"].get(hour), cop["leeward"].get(hour)
            if cw is None or cl is None:
                continue
            raw_rows.append([
                index, hour, cw, cl,
                om[("windward", "ewam")].get(hour), om[("leeward", "ewam")].get(hour),
                om[("windward", "meteofrance_wave")].get(hour),
                om[("leeward", "meteofrance_wave")].get(hour),
            ])
        log(f"     {len(raw_rows) - before} ώρες κρίσιμες\n")

    if not raw_rows:
        log("Κανένα νησί δεν παρήγαγε συγκρίσιμα δεδομένα.")
        return 1

    # Οι ωμές γραμμές γράφονται ΠΡΙΝ κριθεί οτιδήποτε. Η πύλη Β έχει ήδη ξαναγραφτεί μία
    # φορά· χωρίς αυτό το αρχείο, κάθε επόμενη αλλαγή κριτηρίου ζητάει πάλι 25 λεπτά
    # κατέβασμα και τον κωδικό Copernicus, που είναι ακριβώς ο λόγος που ο κωδικός
    # κυκλοφόρησε σε καθαρό κείμενο δύο φορές.
    cache = write_report(HOURS_CACHE, {
        "window": {"start": start_s, "end": end_s},
        "judge_dataset": DATASET_ID,
        "columns": ["island_index", "hour", "cop_windward", "cop_leeward",
                    "ewam_windward", "ewam_leeward", "mf_windward", "mf_leeward"],
        "islands": islands_meta,
        "rows": raw_rows,
    }, compact=True)
    log(f"Ωμές ώρες: {len(raw_rows)} → {cache.name}  (ξανακρίνονται με --replay, χωρίς κωδικό)\n")

    return emit(*summarise(islands_meta, raw_rows), start_s, end_s)


if __name__ == "__main__":
    sys.exit(main())
