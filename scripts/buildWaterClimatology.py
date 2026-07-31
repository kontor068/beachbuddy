"""
ΠΩΣ ΕΙΝΑΙ ΤΟ ΝΕΡΟ ΕΔΩ — ΘΕΡΜΟΚΡΑΣΙΑ ΚΑΙ ΔΙΑΥΓΕΙΑ, ΑΝΑ ΜΗΝΑ.

Δύο ερωτήματα που η εφαρμογή σήμερα απαντά μόνο για ΣΗΜΕΡΑ, ή καθόλου:

  ΘΕΡΜΟΚΡΑΣΙΑ — «κάνει για μπάνιο τον Μάιο;» Η κάρτα «Νερό» δείχνει τη σημερινή τιμή από
  πλέγμα 8 χλμ. Εδώ βγάζουμε το κλιματολογικό προφίλ ανά μήνα από πλέγμα ~5 χλμ. με 30+
  χρόνια πίσω, ώστε ο οδηγός να λέει «τον Ιούνιο συνήθως 22-24°C» χωρίς καμία κλήση API.

  ΔΙΑΥΓΕΙΑ — «πού έχει καθαρά νερά;» Δεν απαντιέται σήμερα ΚΑΘΟΛΟΥ, και κανένας
  ανταγωνιστής δεν την απαντά. Θολότητα (TUR), αιωρούμενα στερεά (SPM) και χλωροφύλλη
  (CHL) από δορυφορικό χρώμα ωκεανού υψηλής ανάλυσης (~300 μ. στην ακτή).

ΠΡΟΣΟΧΗ ΣΤΟ ΤΙ ΣΗΜΑΙΝΕΙ Η ΔΙΑΥΓΕΙΑ. Χαμηλή θολότητα ΔΕΝ σημαίνει «καθαρή θάλασσα» με την
έννοια της υγιεινής. Σημαίνει «λίγα αιωρούμενα σωματίδια», δηλαδή πόσο μακριά βλέπεις μέσα
στο νερό. Νερό μπορεί να είναι κρυστάλλινο και μολυσμένο, ή θολό και υγιέστατο (εκβολή
ποταμού). Το νούμερο επιτρέπεται να απαντά ΜΟΝΟ στο «θα βλέπω κάτω από τη μάσκα;» —
ποτέ στο «είναι καθαρό;». Αυτό δεν είναι υπερβολική προσοχή: το δεύτερο είναι ισχυρισμός
για δημόσια υγεία με νομικό βάρος, το πρώτο είναι παρατήρηση για snorkeling.

ΚΑΤΑΣΤΑΣΗ ΠΡΟΪΟΝΤΟΣ: η θερμοκρασία τροφοδοτεί κείμενο οδηγών. Η διαύγεια παράγεται εδώ και
ΜΕΝΕΙ ΣΤΟ ΡΑΦΙ — είναι feature, και τα features πάγωσαν στις 30/07/2026 υπέρ της
ανακάλυψης. Το script υπάρχει ώστε την ημέρα που ξεπαγώσει να μη χρειαστεί έρευνα, μόνο
ένα τρέξιμο.

ΧΡΗΣΗ
  set CMEMS_USER=... και CMEMS_PASS=...
  python scripts/buildWaterClimatology.py [--skip-clarity] [--from-year 1995] [--to-year 2024]

ΕΞΟΔΟΣ  data/waterClimatology.generated.json
"""

import argparse
import sys
from datetime import datetime, timezone

import numpy as np

from copernicusCommon import (  # noqa: E402
    GREECE_BBOX, SeaCellIndex, load_beaches, open_dataset, write_report,
)

SST_DATASET = "cmems_SST_MED_SST_L4_REP_OBSERVATIONS_010_021"
SST_VARIABLE = "analysed_sst"
CLARITY_DATASET = "cmems_obs-oc_med_bgc-tur-spm-chl_nrt_l4-hr-mosaic_P1M-m"
CLARITY_VARIABLES = ("TUR", "SPM", "CHL")
OUT_PATH = "data/waterClimatology.generated.json"

SEASON_MONTHS = (4, 5, 6, 7, 8, 9, 10, 11)

# Τα κατώφλια της κάρτας «Νερό» — pages/BeachDetailPage.tsx. Αντιγράφονται εδώ και τα
# επαληθεύει η πύλη scripts/validateWaterClimatology.mjs.
#
# ΠΡΟΣΟΧΗ ΣΤΟ ΑΝΟΙΧΤΟ ΑΚΡΟ: η εφαρμογή λέει «μέτριο» για `<= 24` και «ιδανικό» μόνο για
# `> 24`. Η πρώτη έκδοση εδώ έγραφε `>= 24` και στα 24,0 ακριβώς ο οδηγός θα έλεγε
# «ιδανικό» για μήνα που η σελίδα της παραλίας βάφει «μέτριο». Ένα κατώφλι δεν είναι
# «περίπου το ίδιο» — είναι το σημείο όπου αλλάζει η λέξη που διαβάζει ο χρήστης.
WATER_COLD_BELOW_C = 21.0
WATER_IDEAL_ABOVE_C = 24.0

MIN_SAMPLES_PER_MONTH = 40


def log(msg):
    print(msg, flush=True)


def month_of(values):
    return np.array([t.month for t in values.astype("datetime64[h]").astype(object)])


def sample_grid(dataset, variable, beaches, months, from_year, to_year, transform=None,
                max_distance_km=25.0):
    """
    -> ({cell_key: {month: [τιμές]}}, {beach_id: (cell_key, distance_km)})

    Δουλεύει ανά ΜΟΝΑΔΙΚΟ κελί, όχι ανά παραλία: στα 4-5 χλμ. δεκάδες παραλίες μοιράζονται
    κελί και το να κατέβει η ίδια χρονοσειρά για την καθεμία είναι καθαρή σπατάλη.
    """
    import xarray as xr

    index = SeaCellIndex(dataset, variable, bbox=GREECE_BBOX, max_distance_km=max_distance_km)
    log(f"  μάσκα θάλασσας: {int(index.sea.sum())} κελιά")

    cell_of_beach, missing = {}, 0
    for beach in beaches:
        cell = index.nearest(beach["lat"], beach["lon"])
        if cell is None:
            missing += 1
            continue
        cell_lat, cell_lon, distance = cell
        cell_of_beach[beach["id"]] = (f"{round(cell_lat, 5)},{round(cell_lon, 5)}",
                                      round(distance, 1))
    unique = sorted({key for key, _ in cell_of_beach.values()})
    log(f"  {len(cell_of_beach)} παραλίες -> {len(unique)} κελιά ({missing} χωρίς θάλασσα)")
    if not unique:
        return {}, {}

    lat_selector = xr.DataArray([float(k.split(",")[0]) for k in unique], dims="cell")
    lon_selector = xr.DataArray([float(k.split(",")[1]) for k in unique], dims="cell")

    collected = {key: {m: [] for m in months} for key in unique}
    for year in range(from_year, to_year + 1):
        try:
            window = dataset[variable].sel(time=slice(f"{year}-01-01", f"{year}-12-31"))
            if window["time"].size == 0:
                continue
            picked = window.sel(latitude=lat_selector, longitude=lon_selector,
                                method="nearest").load()
        except Exception as exc:  # noqa: BLE001
            log(f"   {year}: {exc.__class__.__name__} — παραλείπεται")
            continue
        values = np.asarray(picked.values, dtype="float64")
        if transform is not None:
            values = transform(values)
        stamp_months = month_of(picked["time"].values)
        for m in months:
            rows = np.nonzero(stamp_months == m)[0]
            if rows.size == 0:
                continue
            block = values[rows, :]
            for c, key in enumerate(unique):
                column = block[:, c]
                collected[key][m].extend(column[np.isfinite(column)].tolist())
        log(f"   {year}: {picked['time'].size} χρονικά βήματα")
    return collected, cell_of_beach


def summarise_temperature(samples):
    out = {}
    for month, values in samples.items():
        if len(values) < MIN_SAMPLES_PER_MONTH:
            continue
        arr = np.array(values)
        median = float(np.median(arr))
        out[str(month)] = {
            "n": len(values),
            "medianC": round(median, 1),
            "p10C": round(float(np.percentile(arr, 10)), 1),
            "p90C": round(float(np.percentile(arr, 90)), 1),
            "idealPct": round(100 * float((arr > WATER_IDEAL_ABOVE_C).mean())),
            "coldPct": round(100 * float((arr < WATER_COLD_BELOW_C).mean())),
            "tier": ("cold" if median < WATER_COLD_BELOW_C
                     else "ideal" if median > WATER_IDEAL_ABOVE_C else "moderate"),
        }
    return out


def summarise_clarity(per_variable):
    out = {}
    for month in SEASON_MONTHS:
        entry = {}
        for name, samples in per_variable.items():
            values = samples.get(month) or []
            if len(values) < 3:   # μηνιαία προϊόντα: λίγα δείγματα ανά χρόνο εξ ορισμού
                continue
            entry[name.lower() + "Median"] = round(float(np.median(np.array(values))), 3)
            entry[name.lower() + "N"] = len(values)
        if entry:
            out[str(month)] = entry
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from-year", type=int, default=1995)
    parser.add_argument("--to-year", type=int, default=2024)
    parser.add_argument("--clarity-from-year", type=int, default=2020)
    parser.add_argument("--skip-clarity", action="store_true")
    parser.add_argument("--limit-beaches", type=int, default=0)
    args = parser.parse_args()

    beaches = load_beaches()
    if args.limit_beaches:
        beaches = beaches[:args.limit_beaches]
    log(f"Παραλίες: {len(beaches)}\n")

    log(f"── Θερμοκρασία νερού ({SST_DATASET})")
    sst_dataset = open_dataset(SST_DATASET)
    # Το προϊόν δίνει Kelvin. Το να ξεχαστεί αυτό δεν σκάει πουθενά — απλώς βγάζει
    # «θερμοκρασία νερού 297°» και κανένα test δεν το πιάνει, γιατί κανένα test δεν ξέρει
    # τι είναι λογική θερμοκρασία θάλασσας. Ο έλεγχος λογικού εύρους παρακάτω το πιάνει.
    temp_samples, temp_cells = sample_grid(
        sst_dataset, SST_VARIABLE, beaches, SEASON_MONTHS,
        args.from_year, args.to_year, transform=lambda v: v - 273.15,
    )
    all_temps = [v for cell in temp_samples.values() for vals in cell.values() for v in vals]
    if all_temps:
        low, high = min(all_temps), max(all_temps)
        log(f"  εύρος τιμών: {low:.1f}°C – {high:.1f}°C")
        if not (5.0 < low < 35.0 and 5.0 < high < 40.0):
            log("  ✗ ΕΚΤΟΣ ΛΟΓΙΚΟΥ ΕΥΡΟΥΣ — πιθανή λάθος μονάδα· δεν γράφεται αρχείο.")
            return 1

    clarity_samples, clarity_cells = {}, {}
    if not args.skip_clarity:
        log(f"\n── Διαύγεια νερού ({CLARITY_DATASET})")
        try:
            clarity_dataset = open_dataset(CLARITY_DATASET)
            per_variable = {}
            for variable in CLARITY_VARIABLES:
                if variable not in clarity_dataset:
                    log(f"  (δεν υπάρχει {variable} στο σύνολο)")
                    continue
                log(f"  {variable}")
                samples, cells = sample_grid(
                    clarity_dataset, variable, beaches, SEASON_MONTHS,
                    args.clarity_from_year, args.to_year, max_distance_km=10.0,
                )
                per_variable[variable] = samples
                clarity_cells = clarity_cells or cells
            clarity_samples = per_variable
        except Exception as exc:  # noqa: BLE001
            log(f"  ✗ {exc.__class__.__name__}: {str(exc)[:160]}")

    per_beach = {}
    for beach in beaches:
        entry = {}
        cell = temp_cells.get(beach["id"])
        if cell:
            summary = summarise_temperature(temp_samples.get(cell[0], {}))
            if summary:
                entry["temperature"] = {"cellKm": cell[1], "months": summary}
        clarity_cell = clarity_cells.get(beach["id"])
        if clarity_cell and clarity_samples:
            per_variable = {name: samples.get(clarity_cell[0], {})
                            for name, samples in clarity_samples.items()}
            summary = summarise_clarity(per_variable)
            if summary:
                entry["clarity"] = {"cellKm": clarity_cell[1], "months": summary}
        if entry:
            per_beach[str(beach["id"])] = entry

    out = write_report(OUT_PATH, {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "temperature": {"dataset": SST_DATASET, "years": [args.from_year, args.to_year],
                            "resolutionKm": 5.0},
            "clarity": {"dataset": CLARITY_DATASET,
                        "years": [args.clarity_from_year, args.to_year],
                        "variables": list(CLARITY_VARIABLES), "status": "data-only, no UI"},
        },
        "thresholds": {"coldBelowC": WATER_COLD_BELOW_C, "idealAboveC": WATER_IDEAL_ABOVE_C},
        "limits": (
            "Clarity means how far you can see through the water (suspended particles). It is "
            "NOT a hygiene or bathing-water-quality statement and must never be presented as "
            "one. Temperature cells are ~5 km offshore averages; shallow bays run warmer."
        ),
        "beaches": per_beach,
    })

    temp_count = sum(1 for v in per_beach.values() if "temperature" in v)
    clarity_count = sum(1 for v in per_beach.values() if "clarity" in v)
    log(f"\n{temp_count} παραλίες με θερμοκρασία, {clarity_count} με διαύγεια")
    log(f"Αρχείο: {out.relative_to(out.parents[1])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
