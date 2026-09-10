"""
ΕΝΑ ΣΥΓΚΕΚΡΙΜΕΝΟ ΠΑΡΑΠΟΝΟ ΥΠΗΝΕΜΗΣ ΑΚΤΗΣ, ΑΠΕΝΑΝΤΙ ΣΤΟ ΡΑΝΤΑΡ (10/09/2026).

Η ΑΦΟΡΜΗ (docs/team 16-community-feedback, Λήμνος 4/10): στη δυτική ακτή της Λήμνου (Πλατύ, Θάνος,
Άγ. Ιωάννης, Κάσπακας — υπήνεμη με λόφους πίσω) το αεροδρόμιο μέτρησε ριπές 44-52 χλμ/ώ στις 07/09
και 09/09 ενώ λέγαμε «καλή». Ίδια κλάση με την Καλλιθέα #3128 (υπήνεμη ακτή, κατάβαση). Κανένα όργανο
δεν στέκεται εκεί: το meteo.gr έχει έναν σταθμό στη Λήμνο (LGI5, δίπλα στο αεροδρόμιο).

Ο ΚΡΙΤΗΣ. Sentinel-1 SAR, άνεμος 10 μ. πάνω από το ΝΕΡΟ σε 0,01° (~1 χλμ) — ο ίδιος με το
`auditShelteredWindAgainstSar.py` — στο πλέγμα 3×3 μπροστά σε κάθε παραλία. Απέναντί του: ο άνεμος που
ΘΑ ΔΕΙΧΝΑΜΕ τη ΙΔΙΑ ΩΡΑ του περάσματος (best_match στο σημείο της παραλίας + η διόρθωση της εφαρμογής,
`utils/windGustFloor.ts`: +2,392 χλμ/ώ σε σημείο με υψόμετρο >0). ΟΧΙ η τελευταία ώρα της μέρας.

ΟΡΙΑ: μέσος άνεμος, όχι ριπή· 1-2 περάσματα τη μέρα (~04 και ~16 UTC)· τα πρώτα κελιά δίπλα στη στεριά
τα μολύνει η ακτή — γι' αυτό μετράει και ένα σημείο ΑΝΟΙΧΤΑ (ομάδα ελέγχου) την ίδια ώρα.

Run: python scripts/auditLeeCoastSarCase.py [--from 2026-09-03 --to 2026-09-10]
     → reports/wind-model/lee-coast-sar-lemnos-2026-09.json
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from copernicusCommon import open_dataset, beaufort, write_report  # noqa: E402

SAR_DATASETS = [
    "cmems_obs-wind_med_phy_nrt_l3-s1a-sar-asc-0.01deg_P1D-i",
    "cmems_obs-wind_med_phy_nrt_l3-s1a-sar-desc-0.01deg_P1D-i",
    "cmems_obs-wind_med_phy_nrt_l3-s1c-sar-asc-0.01deg_P1D-i",
    "cmems_obs-wind_med_phy_nrt_l3-s1c-sar-desc-0.01deg_P1D-i",
]
POINTS = [  # (id, όνομα, lat, lon) — από public/data/beaches/app/north-aegean-lemnos.json
    (1461, "Πλατύ", 39.85668, 25.06105), (1458, "Θάνος", 39.84042, 25.07872),
    (1446, "Άγιος Ιωάννης", 39.9285, 25.06371), (1435, "Κάσπακας", 39.92191, 25.07025),
    ("open", "ανοιχτά δυτικά (έλεγχος)", 39.88, 24.90),
]
DECOMP_A_KMH, DECOMP_B = 2.392, 1.0005  # utils/windGustFloor.ts WIND_DECOMP_* (σημείο με υψόμετρο >0)


def shown_wind(lat, lon, start, end, key):
    """Ο άνεμος της εφαρμογής ανά ώρα (χλμ/ώ): best_match στο σημείο + η διόρθωση της applyGustFloor."""
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "hourly": "wind_speed_10m,wind_gusts_10m",
                                "wind_speed_unit": "kmh", "timezone": "UTC", "models": "best_match",
                                "start_date": start, "end_date": end, "apikey": key})
    with urllib.request.urlopen(f"https://customer-api.open-meteo.com/v1/forecast?{q}", timeout=120) as r:
        d = json.loads(r.read().decode("utf-8"))
    elev = d.get("elevation") or 0
    out = {}
    for t, s, g in zip(d["hourly"]["time"], d["hourly"]["wind_speed_10m"], d["hourly"]["wind_gusts_10m"]):
        if s is None:
            continue
        if elev > 0:
            s = max(s, DECOMP_A_KMH + DECOMP_B * s)
        elif g is not None and s > 0 and g / s >= 3.5:
            s = max(s, g * 0.5)
        out[t[:13]] = {"kmh": s, "gustKmh": g}
    return out, elev


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default="2026-09-03")
    ap.add_argument("--to", dest="end", default="2026-09-10")
    a = ap.parse_args()
    key = os.environ.get("OPEN_METEO_API_KEY")
    if not key:
        print("χωρίς OPEN_METEO_API_KEY στο περιβάλλον")
        return 1
    models = {p[0]: shown_wind(p[2], p[3], a.start, a.end, key) for p in POINTS}
    rows = []
    for ds_id in SAR_DATASETS:
        try:
            ds = open_dataset(ds_id, minimum_latitude=39.80, maximum_latitude=39.97, minimum_longitude=24.85,
                              maximum_longitude=25.12, start_datetime=f"{a.start}T00:00:00", end_datetime=f"{a.end}T23:59:59")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {ds_id}: {str(e)[:100]}")
            continue
        var = next((v for v in ("wind_speed", "wind_speed_10m", "sar_wind_speed") if v in ds), None)
        tvar = next((v for v in ("measurement_time", "time_of_measurement", "measurement_date") if v in ds), None)
        if not var:
            continue
        w = ds[var].load()
        mt = ds[tvar].load() if tvar else None
        lats, lons = w["latitude"].values, w["longitude"].values
        for k, t in enumerate(w["time"].values):
            for pid, name, lat, lon in POINTS:
                i, j = int(np.abs(lats - lat).argmin()), int(np.abs(lons - lon).argmin())
                # ΜΠΡΟΣΤΑ στην παραλία: 3 κελιά προς τη θάλασσα (δυτικά), όχι το κελί της ακτής
                block = w.values[k, max(0, i - 1):i + 2, max(0, j - 4):max(0, j - 1)] if pid != "open" else w.values[k, i - 1:i + 2, j - 1:j + 2]
                good = block[np.isfinite(block)]
                if good.size < 2:
                    continue
                when = None
                if mt is not None:
                    mb = np.asarray(mt.values[k, max(0, i - 1):i + 2, max(0, j - 4):max(0, j - 1)] if pid != "open" else mt.values[k, i - 1:i + 2, j - 1:j + 2]).ravel()
                    mb = [x for x in mb if str(x) != "NaT"]
                    when = str(mb[0])[:13] if mb else None
                if when is None:
                    when = str(t)[:10] + ("T16" if "asc" in ds_id else "T04")
                model, elev = models[pid]
                hour = when.replace(" ", "T")[:13]
                shown = model.get(hour)
                sar_kmh = float(np.median(good)) * 3.6
                rows.append({"point": name, "id": pid, "pass": ds_id.split("_l3-")[1], "hourUtc": hour,
                             "sarKmh": round(sar_kmh, 1), "sarBft": beaufort(sar_kmh),
                             "shownKmh": round(shown["kmh"], 1) if shown else None,
                             "shownBft": beaufort(shown["kmh"]) if shown else None,
                             "modelGustKmh": shown["gustKmh"] if shown else None})
    rows.sort(key=lambda r: (r["hourUtc"], str(r["id"])))
    for r in rows:
        print(f"  {r['hourUtc']}Z {r['point'][:24]:<24} ραντάρ {r['sarKmh']:5.1f} χλμ/ώ ({r['sarBft']} Μπφ) · "
              f"δείχναμε {r['shownKmh'] if r['shownKmh'] is not None else '—':>5} ({r['shownBft']} Μπφ)")
    lee = [r for r in rows if r["id"] != "open" and r["shownKmh"] is not None]
    under = [r for r in lee if r["sarBft"] - r["shownBft"] >= 1]
    over = [r for r in lee if r["shownBft"] - r["sarBft"] >= 1]
    print(f"\nδυτική ακτή: {len(lee)} μετρήσεις · το ραντάρ ≥1 Μπφ ΠΑΝΩ από όσο δείχναμε σε {len(under)} · ΚΑΤΩ σε {len(over)}")
    write_report("reports/wind-model/lee-coast-sar-lemnos-2026-09.json", {
        "window": [a.start, a.end], "points": [p[1] for p in POINTS], "rows": rows,
        "underReadHours": len(under), "overReadHours": len(over), "leeHours": len(lee)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
