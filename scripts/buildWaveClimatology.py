"""
ΠΟΣΟ ΣΥΧΝΑ ΕΙΝΑΙ ΗΡΕΜΗ ΑΥΤΗ Η ΠΑΡΑΛΙΑ ΤΟΝ ΙΟΥΛΙΟ;

Η εφαρμογή απαντά άριστα στο «πώς είναι σήμερα» και καθόλου στο «τι να περιμένω». Ο δεύτερος
είναι ο ερώτημα που κάνει κάποιος όταν κλείνει εισιτήρια τον Μάρτιο — και είναι το ερώτημα
των οδηγών πρόθεσης, που φέρνουν 14 φορές περισσότερα κλικ από μια σελίδα παραλίας.

Πηγή: `cmems_mod_med_wav_my_4.2km_PT1H-i` — η μεσογειακή κυματική επανανάλυση του Copernicus,
ωριαία, 4,2 χλμ., **1985 → σήμερα**. Δεν είναι πρόγνωση και δεν τρέχει ποτέ στον browser:
τρέχει εδώ, μία φορά, και αφήνει πίσω ένα στατικό JSON. Μηδέν κόστος χρόνου εκτέλεσης, μηδέν
ποσόστωση, καμία εξάρτηση της εφαρμογής από λογαριασμό Copernicus.

ΤΑ ΚΑΤΩΦΛΙΑ ΕΙΝΑΙ ΤΑ ΚΑΤΩΦΛΙΑ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, όχι δικά μας. Το «ήρεμα» εδώ σημαίνει ακριβώς
ό,τι σημαίνει το χρώμα στη σελίδα — ίδιο SEA_STATE_AMBER_M, ίδιο SEA_STATE_ROUGH_M, ίδιος
τύπος swell-equivalent ύψους με αναφορά 4 δευτερολέπτων. Αν αποκλίνουν, ο οδηγός θα λέει
«συνήθως ήρεμα» για παραλία που η σελίδα της βάφει πορτοκαλί, και ο χρήστης θα δει την
αντίφαση πριν από εμάς. Γι' αυτό υπάρχει πύλη που τα συγκρίνει (validateWaveClimatology.mjs).

ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΝΟΥΜΕΡΟ — και πρέπει να λέγεται και στο κείμενο του χρήστη:
στα 4,2 χλμ. το κελί είναι το ΑΝΟΙΧΤΟ ΝΕΡΟ μπροστά από την παραλία, όχι η ίδια η ακρογιαλιά.
Δεν βλέπει τον όρμο, τον κάβο ή τον βράχο που κόβει το κύμα. Άρα για προστατευμένες παραλίες
υποεκτιμά την ηρεμία — λέει «χειρότερα απ' ό,τι είναι». Αυτή είναι η ασφαλής κατεύθυνση για
λάθος, και είναι ο λόγος που το νούμερο διατυπώνεται ως «η θάλασσα εδώ», όχι «η παραλία».

ΔΥΟ ΔΕΙΓΜΑΤΑ ΤΗΝ ΗΜΕΡΑ, 09:00 και 15:00 UTC (12:00 και 18:00 ώρα Ελλάδας). Όχι ένα: το
μελτέμι χτίζει το απόγευμα, και ένα μεσημεριανό δείγμα θα έδειχνε συστηματικά πιο ήρεμο
καλοκαίρι από την πραγματικότητα — το ίδιο λάθος που έχει ήδη διορθωθεί μία φορά στην
ημερήσια βαθμολογία (afternoonBuild).

ΔΥΟ ΜΟΝΟΠΑΤΙΑ, ΚΑΙ Ο ΛΟΓΟΣ ΕΧΕΙ ΣΗΜΑΣΙΑ
──────────────────────────────────────────
Το ωριαίο σύνολο των 41 ετών είναι αποθηκευμένο σε κομμάτια που το καθένα καλύπτει
ΟΛΟΚΛΗΡΗ ΤΗ ΜΕΣΟΓΕΙΟ επί 200 ώρες (μετρήθηκε 31/07/2026: chunks 200×380×1307). Δηλαδή όσο
μικρή περιοχή κι αν ζητήσεις, κατεβάζεις πάντα ολόκληρο τον χάρτη: 187 δευτερόλεπτα για 3
μέρες, άρα ~11 ώρες για δέκα καλοκαίρια. Αυτό δεν είναι κάτι που ρυθμίζεται από τη μεριά μας.

  ΓΡΗΓΟΡΟ (προεπιλογή)  Το έτοιμο μηνιαίο κλιματολογικό προϊόν — 12 χρονικά βήματα, όλη η
                        Ελλάδα σε ~2,5 λεπτά. Δίνει ΤΥΠΙΚΟ ύψος και περίοδο ανά μήνα.
  --hourly              Η ωριαία επανανάλυση. Δίνει ΠΟΣΟΣΤΑ ημερών («ήρεμα τις 82% των
                        ημερών»), που είναι πολύ ισχυρότερο για τον αναγνώστη, με κόστος
                        ώρες εκτέλεσης. Τρέξ' το στο παρασκήνιο όταν το θέλεις.

ΠΟΤΕ ΔΕΝ ΜΕΤΑΤΡΕΠΟΥΜΕ ΜΕΣΟ ΟΡΟ ΣΕ ΠΟΣΟΣΤΟ. Θα ήταν εύκολο να υποθέσουμε μια κατανομή γύρω
από το μέσο ύψος και να «βγάλουμε» ποσοστό ημερών — και θα ήταν εφευρεμένος αριθμός με
πειστικό ντύσιμο. Το γρήγορο μονοπάτι λέει τυπικές τιμές, το ακριβό λέει ποσοστά, και το
κείμενο του οδηγού προσαρμόζεται σε ό,τι υπάρχει.

ΧΡΗΣΗ
  set CMEMS_USER=...  και  set CMEMS_PASS=...
  python scripts/buildWaveClimatology.py                      # γρήγορο, ~3 λεπτά
  python scripts/buildWaveClimatology.py --hourly --from-year 2022 --to-year 2024

ΕΞΟΔΟΣ  data/waveClimatology.generated.json
"""

import argparse
import math
import sys
from datetime import datetime, timezone

import numpy as np

from copernicusCommon import (  # noqa: E402
    GREECE_BBOX, SeaCellIndex, load_beaches, open_dataset, write_report,
)

HOURLY_DATASET_ID = "cmems_mod_med_wav_my_4.2km_PT1H-i"
MONTHLY_DATASET_ID = "cmems_mod_med_wav_my_4.2km-climatology_P1M-m"
OUT_PATH = "data/waveClimatology.generated.json"

# Ώρες δείγματος (UTC) και μήνες σεζόν. Ο Οκτώβριος μπαίνει επειδή οι οδηγοί απαντούν και σε
# «πότε τελειώνει η σεζόν», που είναι πραγματικό ερώτημα επισκεπτών.
SAMPLE_HOURS_UTC = (9, 15)
SEASON_MONTHS = (5, 6, 7, 8, 9, 10)

# ── ΑΝΤΙΓΡΑΦΟ ΤΩΝ ΚΑΤΩΦΛΙΩΝ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ──────────────────────────────────────────────
# Πηγή: utils/waveCharacter.ts. Δεν «περίπου» — ίδιοι αριθμοί, ίδιος τύπος. Τα επαληθεύει
# η πύλη scripts/validateWaveClimatology.mjs, που τα ξαναδιαβάζει από το TypeScript και
# σκάει αν αποκλίνουν. Χωρίς αυτή την πύλη, μια αλλαγή κατωφλιού στη σελίδα θα άφηνε αυτό
# το αρχείο σιωπηλά πίσω και οι οδηγοί θα διαφωνούσαν με τις σελίδες τους.
SEA_REFERENCE_PERIOD_S = 4.0
CHOP_EXPONENT = 0.75  # ⚠️ ΑΛΛΑΖΕΙ ΜΑΖΙ ΜΕ ΤΟ utils/waveCharacter.ts ΚΑΙ ΜΕ ΑΝΑΚΑΤΑΣΚΕΥΗ ΤΩΝ
# ΔΕΔΟΜΕΝΩΝ. Δοκιμάστηκε 1.0 στις 16/08/2026 και ΑΝΑΚΛΗΘΗΚΕ: το ζωντανό κόστος ήταν 4 στις 930
# παραλίες, αλλά η ανακατασκευή εδώ μετακίνησε 13.940 από 16.692 μηνιαίες τιμές (όλες προς τα
# πάνω) και άλλαξε βαθμίδα σε 1.008 από 2.782 παραλίες — 36% της χώρας διαβάζει πιο άγρια
# περιγραφή στους οδηγούς για +6 εκ. διάμεσο. Ο εκθέτης ΔΕΝ είναι απομονωμένο κουμπί.
MAX_CHOP_FACTOR = 1.75
SEA_STATE_AMBER_M = 0.8
SEA_STATE_ROUGH_M = 1.2

# Κάτω από πόσα δείγματα ένας μήνας δεν δημοσιεύεται. Ένα ποσοστό πάνω σε 20 δείγματα δεν
# είναι κλιματολογία, είναι θόρυβος με υποδιαστολή.
MIN_SAMPLES_PER_MONTH = 200


def log(msg):
    print(msg, flush=True)


def sea_state_severity(height, period):
    """
    Ακριβές αντίγραφο του seaStateSeverityM (utils/waveCharacter.ts), διανυσματοποιημένο.

    Κύμα 0,8 μ. με περίοδο 3 δευτ. «χτυπάει» πιο πολύ από κύμα 0,8 μ. με περίοδο 8 δευτ. —
    το ίδιο ύψος, εντελώς άλλη θάλασσα. Η εφαρμογή συγκρίνει πάντα το swell-equivalent ύψος
    και όχι το ωμό, οπότε το ίδιο κάνει και η κλιματολογία.
    """
    factor = np.ones_like(height)
    usable = np.isfinite(period) & (period > 0) & (period < SEA_REFERENCE_PERIOD_S)
    with np.errstate(divide="ignore", invalid="ignore"):
        raw = np.power(SEA_REFERENCE_PERIOD_S / np.where(usable, period, 1.0), CHOP_EXPONENT)
    factor = np.where(usable, np.clip(raw, 1.0, MAX_CHOP_FACTOR), 1.0)
    return height * factor


def percentile_from_histogram(edges, counts, q):
    """Ποσοστημόριο από σωρευτικό ιστόγραμμα — κρατάει τη μνήμη σταθερή ανά κελί."""
    total = counts.sum()
    if total == 0:
        return None
    target = q * total
    cumulative = np.cumsum(counts)
    idx = int(np.searchsorted(cumulative, target))
    idx = min(idx, len(edges) - 2)
    return float((edges[idx] + edges[idx + 1]) / 2)


def map_beaches_to_cells(index, beaches):
    """
    -> ({beach_id: (lat, lon, km)}, [μοναδικά κελιά], [παραλίες χωρίς νερό])

    Πολλές παραλίες μοιράζονται κελί — στα 4,2 χλμ. ένας κόλπος με 6 παραλίες είναι ένα
    κελί. Δουλεύουμε ανά ΜΟΝΑΔΙΚΟ κελί και μοιράζουμε στο τέλος: αλλιώς κατεβάζουμε και
    υπολογίζουμε την ίδια χρονοσειρά έξι φορές.
    """
    cell_of_beach, unresolved = {}, []
    for beach in beaches:
        cell = index.nearest(beach["lat"], beach["lon"])
        if cell is None:
            unresolved.append(beach)
            continue
        cell_lat, cell_lon, distance = cell
        cell_of_beach[beach["id"]] = (round(cell_lat, 5), round(cell_lon, 5), round(distance, 1))
    unique_cells = sorted({(lat, lon) for lat, lon, _ in cell_of_beach.values()})
    log(f"  {len(cell_of_beach)} παραλίες -> {len(unique_cells)} μοναδικά κελιά"
        f"  ({len(unresolved)} χωρίς θάλασσα σε 25 χλμ.)")
    return cell_of_beach, unique_cells, unresolved


def build_monthly(beaches):
    """
    ΤΟ ΓΡΗΓΟΡΟ ΜΟΝΟΠΑΤΙ — τυπικό ύψος και περίοδο ανά μήνα, από το έτοιμο προϊόν.

    Δώδεκα χρονικά βήματα συνολικά, οπότε φορτώνεται ΟΛΟΚΛΗΡΟ το ελληνικό παράθυρο μία φορά
    και μετά όλα γίνονται τοπικά. Καμία χρονοσειρά, κανένα ποσοστό — ό,τι υπάρχει είναι η
    τυπική θάλασσα κάθε μήνα, και έτσι ακριβώς διατυπώνεται.
    """
    log(f"Άνοιγμα του μηνιαίου κλιματολογικού προϊόντος ({MONTHLY_DATASET_ID}) …")
    dataset = open_dataset(MONTHLY_DATASET_ID)
    index = SeaCellIndex(dataset, "VHM0", bbox=GREECE_BBOX)
    log(f"  μάσκα θάλασσας: {int(index.sea.sum())} κελιά")
    cell_of_beach, unique_cells, unresolved = map_beaches_to_cells(index, beaches)
    if not unique_cells:
        return None, unresolved

    heights = dataset["VHM0"].sel(
        latitude=slice(GREECE_BBOX["lat_min"], GREECE_BBOX["lat_max"]),
        longitude=slice(GREECE_BBOX["lon_min"], GREECE_BBOX["lon_max"]),
    ).load()
    periods = dataset["VTM02"].sel(
        latitude=slice(GREECE_BBOX["lat_min"], GREECE_BBOX["lat_max"]),
        longitude=slice(GREECE_BBOX["lon_min"], GREECE_BBOX["lon_max"]),
    ).load()
    log(f"  φορτώθηκαν {heights.shape[0]} μήνες")

    lats = np.asarray(heights["latitude"].values, dtype="float64")
    lons = np.asarray(heights["longitude"].values, dtype="float64")
    height_values = np.asarray(heights.values, dtype="float64")
    period_values = np.asarray(periods.values, dtype="float64")
    severity = sea_state_severity(height_values, period_values)

    # Ο άξονας χρόνου του προϊόντος είναι δώδεκα πλασματικές ημερομηνίες του 1993, μία ανά
    # μήνα. Διαβάζουμε τον μήνα από την ίδια την ημερομηνία αντί να υποθέσουμε ότι ο δείκτης
    # 0 είναι ο Ιανουάριος — αν ποτέ αναδιαταχθεί, θα το πάρουμε είδηση αντί να γυρίσουμε
    # σιωπηλά τους μήνες κατά έναν.
    month_of_index = [int(str(t)[5:7]) for t in heights["time"].values]

    per_cell = {}
    for cell_lat, cell_lon in unique_cells:
        i = int(np.abs(lats - cell_lat).argmin())
        j = int(np.abs(lons - cell_lon).argmin())
        months = {}
        for t, month in enumerate(month_of_index):
            if month not in SEASON_MONTHS:
                continue
            value = severity[t, i, j]
            if not np.isfinite(value):
                continue
            months[str(month)] = {
                "typicalM": round(float(value), 2),
                "tier": ("rough" if value >= SEA_STATE_ROUGH_M
                         else "moderate" if value >= SEA_STATE_AMBER_M else "calm"),
            }
        if months:
            per_cell[f"{cell_lat},{cell_lon}"] = months

    per_beach = {}
    for beach_id, (cell_lat, cell_lon, distance) in cell_of_beach.items():
        months = per_cell.get(f"{cell_lat},{cell_lon}")
        if months:
            per_beach[str(beach_id)] = {"cellKm": distance, "months": months}
    return per_beach, unresolved


def build_hourly(beaches, from_year, to_year):
    """ΤΟ ΑΚΡΙΒΟ ΜΟΝΟΠΑΤΙ — ποσοστά ημερών· ώρες εκτέλεσης, δες την επικεφαλίδα."""
    log("Άνοιγμα της ωριαίας επανανάλυσης 4,2 χλμ. …")
    dataset = open_dataset(HOURLY_DATASET_ID)
    index = SeaCellIndex(dataset, "VHM0", bbox=GREECE_BBOX)
    log(f"  μάσκα θάλασσας: {int(index.sea.sum())} κελιά")
    cell_of_beach, unique_cells, unresolved = map_beaches_to_cells(index, beaches)
    if not unique_cells:
        return None, unresolved

    lat_values = np.array([c[0] for c in unique_cells])
    lon_values = np.array([c[1] for c in unique_cells])
    import xarray as xr
    lat_selector = xr.DataArray(lat_values, dims="cell")
    lon_selector = xr.DataArray(lon_values, dims="cell")

    # Συσσωρευτές ανά (κελί, μήνας). Κρατάμε ιστόγραμμα αντί για ωμές τιμές ώστε η μνήμη να
    # μην εξαρτάται από το πόσα χρόνια ζητήθηκαν.
    bins = np.arange(0.0, 8.05, 0.05)
    n_cells, n_months = len(unique_cells), len(SEASON_MONTHS)
    hist = np.zeros((n_cells, n_months, len(bins) - 1), dtype="int32")
    calm = np.zeros((n_cells, n_months), dtype="int32")
    rough = np.zeros((n_cells, n_months), dtype="int32")
    total = np.zeros((n_cells, n_months), dtype="int32")

    for year in range(from_year, to_year + 1):
        log(f"── {year}")
        window = dataset[["VHM0", "VTM02"]].sel(
            time=slice(f"{year}-{SEASON_MONTHS[0]:02d}-01", f"{year}-{SEASON_MONTHS[-1]:02d}-31"),
        )
        stamps = window["time"].values
        hours = stamps.astype("datetime64[h]").astype(object)
        keep = np.array([h.hour in SAMPLE_HOURS_UTC for h in hours])
        if not keep.any():
            log("   (καμία ώρα δείγματος)")
            continue
        window = window.isel(time=np.nonzero(keep)[0])
        picked = window.sel(latitude=lat_selector, longitude=lon_selector, method="nearest").load()

        heights = np.asarray(picked["VHM0"].values, dtype="float64")
        periods = np.asarray(picked["VTM02"].values, dtype="float64")
        severity = sea_state_severity(heights, periods)          # (time, cell)
        months = np.array([h.month for h in
                           picked["time"].values.astype("datetime64[h]").astype(object)])

        for m_idx, month in enumerate(SEASON_MONTHS):
            rows = np.nonzero(months == month)[0]
            if rows.size == 0:
                continue
            block = severity[rows, :]
            valid = np.isfinite(block)
            total[:, m_idx] += valid.sum(axis=0).astype("int32")
            calm[:, m_idx] += (valid & (block < SEA_STATE_AMBER_M)).sum(axis=0).astype("int32")
            rough[:, m_idx] += (valid & (block >= SEA_STATE_ROUGH_M)).sum(axis=0).astype("int32")
            for c in range(n_cells):
                column = block[:, c]
                column = column[np.isfinite(column)]
                if column.size:
                    hist[c, m_idx] += np.histogram(column, bins=bins)[0].astype("int32")
        log(f"   {int(keep.sum())} χρονικά δείγματα, σύνολο ως τώρα {int(total.max())}/κελί")

    cell_stats = {}
    for c, (lat, lon) in enumerate(unique_cells):
        months = {}
        for m_idx, month in enumerate(SEASON_MONTHS):
            n = int(total[c, m_idx])
            if n < MIN_SAMPLES_PER_MONTH:
                continue
            months[str(month)] = {
                "n": n,
                "medianM": round(percentile_from_histogram(bins, hist[c, m_idx], 0.5) or 0, 2),
                "p90M": round(percentile_from_histogram(bins, hist[c, m_idx], 0.9) or 0, 2),
                "calmPct": round(100 * int(calm[c, m_idx]) / n),
                "roughPct": round(100 * int(rough[c, m_idx]) / n),
            }
        if months:
            cell_stats[f"{lat},{lon}"] = months

    per_beach = {}
    for beach_id, (lat, lon, distance) in cell_of_beach.items():
        stats = cell_stats.get(f"{lat},{lon}")
        if not stats:
            continue
        per_beach[str(beach_id)] = {"cellKm": distance, "months": stats}
    return per_beach, unresolved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hourly", action="store_true",
                        help="ποσοστά ημερών αντί για τυπικές τιμές· ώρες εκτέλεσης")
    parser.add_argument("--from-year", type=int, default=2022)
    parser.add_argument("--to-year", type=int, default=2024)
    parser.add_argument("--limit-beaches", type=int, default=0, help="0 = όλες (δοκιμή)")
    args = parser.parse_args()

    beaches = load_beaches()
    if args.limit_beaches:
        beaches = beaches[:args.limit_beaches]
    log(f"Παραλίες: {len(beaches)}")

    if args.hourly:
        per_beach, unresolved = build_hourly(beaches, args.from_year, args.to_year)
        source = {"dataset": HOURLY_DATASET_ID, "kind": "hourly-percentiles",
                  "years": [args.from_year, args.to_year],
                  "sampleHoursUtc": list(SAMPLE_HOURS_UTC)}
    else:
        per_beach, unresolved = build_monthly(beaches)
        source = {"dataset": MONTHLY_DATASET_ID, "kind": "monthly-typical",
                  "years": None, "sampleHoursUtc": None}
    if per_beach is None:
        log("Καμία παραλία δεν αντιστοιχήθηκε σε θαλάσσιο κελί.")
        return 1

    out = write_report(OUT_PATH, {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            **source,
            "provider": "Copernicus Marine Service",
            "resolutionKm": 4.2,
        },
        "thresholds": {
            "calmBelowM": SEA_STATE_AMBER_M,
            "roughAtOrAboveM": SEA_STATE_ROUGH_M,
            "referencePeriodS": SEA_REFERENCE_PERIOD_S,
            "note": "swell-equivalent height, identical to utils/waveCharacter.ts",
        },
        "limits": (
            "A 4.2 km cell is the open water in front of the beach, not the shoreline. It "
            "does not see coves, capes or reefs, so sheltered beaches read rougher here than "
            "they are. Never phrase this as a property of the beach itself."
        ),
        "beaches": per_beach,
    })

    log("")
    log(f"{len(per_beach)} παραλίες με κλιματολογία ({source['kind']})")
    if unresolved:
        log(f"{len(unresolved)} χωρίς θαλάσσιο κελί — π.χ. "
            f"{', '.join(b['name'] or '?' for b in unresolved[:5])}")
    log(f"Αρχείο: {out.relative_to(out.parents[1])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
