"""
ΜΕ ΤΟ ΜΑΤΙ ΠΡΙΝ ΠΙΣΤΕΨΕΙΣ ΝΟΥΜΕΡΟ — εικόνα μιας παραλίας μιας μέρας από τον Sentinel-2 (βίβλος §Γ75).

Δύο πλαίσια δίπλα-δίπλα, 2,4 × 2,4 χλμ. γύρω από την πινέζα: αριστερά το κοντινό υπέρυθρο (B08,
αυτό που μετράει ο κριτής — ο αφρός φωτεινός, το νερό μαύρο), δεξιά τα φυσικά χρώματα. Ο κύκλος
είναι η «παραλία» του κριτή (300 μ.). Πάνω αριστερά: μέρα και ανοιχτό κύμα της στιγμής.

Run: python scripts/renderShoreSurfChip.py <beachId> <YYYY-MM-DD> [<YYYY-MM-DD> …]  → .tmp/s2judge/png/
     (από κώδικα: render(beachId, day, rgb_only=True) → εικόνα PIL, για τις σελίδες-αποδείξεις)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import judgeShoreSurfSentinel2 as j  # noqa: E402
from copernicusCommon import load_beaches  # noqa: E402

OUT = j.CACHE / "png"
_BEACHES = {}
_WAVES = {}


def scene_for(lat, lon, day):
    best = None
    for it in j.catalog_month(day[:7]):
        if it["dt"][:10] != day:
            continue
        for poly in it["polys"]:
            inside = bool(j._in_ring(np.array([lon]), np.array([lat]), poly[0])[0])
            if inside and (best is None or (it["cc"], it["id"]) < (best["cc"], best["id"])):
                best = it
    return best


def render(bid, day, rgb_only=False, scale=3):
    if not _BEACHES:
        _BEACHES.update({x["id"]: x for x in load_beaches()})
        _WAVES.update(json.loads((j.CACHE / "waves-cells.json").read_text(encoding="utf-8")))
    b = _BEACHES[bid]
    sc = scene_for(b["lat"], b["lon"], day)
    if not sc:
        return None
    import rasterio
    from rasterio.warp import transform
    from rasterio.windows import from_bounds
    with rasterio.Env(**j.GDAL_ENV):
        with rasterio.open(sc["nir"]) as src:
            xs, ys = transform("EPSG:4326", src.crs, [b["lon"]], [b["lat"]])
            raw = None if rgb_only else j._read_win(src, xs[0], ys[0], j.HALF_M).astype("float32")
        rgb = None
        if sc.get("visual"):
            with rasterio.open(sc["visual"]) as src:
                win = from_bounds(xs[0] - j.HALF_M, ys[0] - j.HALF_M, xs[0] + j.HALF_M, ys[0] + j.HALF_M, src.transform)
                rgb = np.moveaxis(src.read([1, 2, 3], window=win, boundless=True, fill_value=0), 0, -1)
    panels = []
    if raw is not None:
        nir = (raw - (0 if sc.get("offsetApplied") else 1000)) / 10000.0
        gray = (np.clip(nir / 0.12, 0, 1) * 255).astype("uint8")  # 0,12 = λευκό: ο αφρός καίγεται, το νερό μένει μαύρο
        panels.append(Image.fromarray(gray).convert("RGB"))
    if rgb is not None:
        panels.append(Image.fromarray(rgb.astype("uint8")))
    if not panels:
        return None
    panels = [p.resize((p.width * scale, p.height * scale), Image.LANCZOS) for p in panels]
    canvas = Image.new("RGB", (sum(p.width for p in panels) + 10 * (len(panels) - 1), panels[0].height), "white")
    x0 = 0
    for p in panels:
        canvas.paste(p, (x0, 0))
        d = ImageDraw.Draw(canvas)
        c, r = x0 + p.width / 2, j.SHORE_RADIUS_M / 10 * scale
        d.ellipse([c - r, p.height / 2 - r, c + r, p.height / 2 + r], outline=(255, 60, 60), width=2)
        x0 += p.width + 10
    if not rgb_only:
        cell = _WAVES["beachCell"].get(str(bid))
        w = _WAVES["cells"].get(j._cell_key(cell), {}).get(day) if cell else None
        ImageDraw.Draw(canvas).text((6, 6), f"#{bid} {b['nameEn'] or ''} {day} {sc['id']} wave {w}", fill=(255, 255, 0))
    return canvas


def main():
    bid, days = int(sys.argv[1]), sys.argv[2:]
    OUT.mkdir(parents=True, exist_ok=True)
    for day in days:
        img = render(bid, day)
        if img is None:
            print(f"{day}: καμία εικόνα")
            continue
        path = OUT / f"{bid}-{day}.png"
        img.save(path)
        print(path)


if __name__ == "__main__":
    main()
