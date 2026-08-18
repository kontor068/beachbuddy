/**
 * ΣΤΑΔΙΟ 2, ΒΗΜΑ 2 — ΠΙΝΑΚΕΣ ΜΕΤΑΦΟΡΑΣ ΚΥΜΑΤΟΣ (HANDOVER-2026-08-17 §4/§8γ).
 *
 * ΤΙ ΚΑΝΕΙ. Για κάθε παραλία του πιλότου (Νάξος/Πάρος), ανάδρομη ιχνηλάτηση ακτίνων
 * (CDIP-style backward ray tracing) πάνω στο ενιαίο GeoTIFF της ζώνης
 * (.tmp/bathymetry-zones/naxos-paros.tif, από downloadBathymetryZone.mjs):
 *
 *   1. Σημείο εκκίνησης: από την πινέζα, βάδισμα κατά facingDeg μέχρι το πρώτο αξιόπιστο
 *      νερό ≥6 μ (παρεμβολή ΜΟΝΟ σε pixel νερού — το μάθημα της v2, ποτέ στεριά στο μείγμα).
 *   2. Βεντάλια 180 ανάδρομων ακτίνων (κάθε 2°) × 7 περιόδους (3-10 s). Κάθε ακτίνα
 *      λυγίζει προς τα ρηχά (εξίσωση ακτίνας, ταχύτητα φάσης από γραμμική διασπορά — Hunt 1979)
 *      και προχωράει ΜΕΧΡΙ το όριο του κουτιού (ανοιχτή → καταγράφεται η βαθιά διεύθυνση
 *      προέλευσης) ή στεριά (φραγμένη → μηδενική ενέργεια από εκεί). Σε βαθύ νερό (d > L/2)
 *      δεν λυγίζει — αλλά ΣΥΝΕΧΙΖΕΙ, γιατί τα νησιά μπλοκάρουν και σε βαθύ νερό.
 *   3. Ψήσιμο: K²(θ̄,T) = Σ ακτίνων D(θd−θ̄)·(k_n·cg_d)/(k_d·cg_n)·Δψ με διασπορά cos²
 *      (αναλλοίωτο Liouville: E(f,θ)·cg/k σταθερό κατά μήκος ακτίνας· σε ευθεία ακτή δίνει
 *      ακριβώς τον συντελεστή ρήχωσης — ελέγχθηκε αναλυτικά). 16 διευθύνσεις × 7 περίοδοι.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ. Καμία γραμμή παραγωγής δεν διαβάζει το αποτέλεσμα — offline προϊόν έρευνας.
 * Η θραύση ΔΕΝ υπολογίζεται εδώ (θα βγει από το μοντέλο, στο ρηχωμένο ύψος του — όχι από τη
 * σάπια ρηχή ζώνη του raster). Η σύνθεση με SMB μέσα στον κόλπο (§4) είναι δουλειά του runtime,
 * αργότερα, μετά από μέτρηση και πύλη §7δ.
 *
 * Ο ΟΡΙΖΟΝΤΑΣ ΤΩΝ 15 ΧΛΜ (μετρήθηκε πριν οριστεί): χωρίς όριο, η ακτίνα 210° του Άγ. Προκόπιου
 * ταξίδευε 63 χλμ και «φραζόταν» στη Φολέγανδρο — αλλά το νούμερο-σύνορο (marine cell Open-Meteo)
 * ζει 7,7-13,8 χλμ ανοιχτά και κουβαλάει ήδη τις μακρινές σκιές/ανανέωση/περίθλαση. Άρα: φράξιμο
 * μετράει ΜΟΝΟ μέσα στα πρώτα 15 χλμ (ακρωτήρια, το απέναντι νησί)· στα 15 χλμ η ακτίνα
 * τερματίζει ΑΝΟΙΧΤΗ με ό,τι διεύθυνση/βάθος έχει εκεί. Χωρίς αυτό: 32 ψευδο-φραξίματα,
 * K=0,21 στην ανοιχτή διεύθυνση του Άγ. Προκόπιου αντί ~0,9 — «ψεύτικη ηρεμία», σκανδάλη #1.
 *
 * ΓΝΩΣΤΑ ΟΡΙΑ (γραμμένα και στην αναφορά): χωρίς περίθλαση (σκιές νησιών κοφτές — η διασπορά
 * cos² τις απαλύνει μερικώς)· ακτίνα που ξύνει τη σάπια ρηχή ζώνη ΑΛΛΗΣ ακτής μπορεί να
 * φράξει ψευδώς μέσα στον ορίζοντα.
 *
 * Run: node scripts/buildWaveTransferTables.mjs
 * Έξοδος: public/data/geospatial/wave-transfer/naxos-paros.json
 *         reports/quality/wave-transfer-naxos-paros.json (διαγνωστικά + διασταύρωση με fetch)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromArrayBuffer } from 'geotiff';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ZONE_ID = 'naxos-paros';
const REGION_IDS = ['south-aegean-naxos', 'south-aegean-paros'];
const PERIODS_S = [3, 4, 5, 6, 7, 8, 10];
const RAY_STEP_DEG = 2;
const DIR_BINS = 16; // πίνακας: κάθε 22,5° (N, NNE, …)
const START_TARGET_DEPTH_M = 6;
const START_MAX_OFFSET_M = 1500;
const HORIZON_KM = 15; // φράξιμο μετράει μόνο ως εδώ — πιο πέρα μιλάει το marine cell
const G = 9.81;

// ── Γραμμική θεωρία ─────────────────────────────────────────────────────────
// Hunt (1979): kh από x=ω²h/g, ακρίβεια ~0,1% — χωρίς επανάληψη Newton.
const HUNT = [0.6660790292, 0.3593282583, 0.1608465392, 0.0632098765, 0.0217540484, 0.0065407983];
const waveNumber = (omega, depth) => {
  const x = (omega * omega * depth) / G;
  let poly = 1, xn = 1;
  for (const d of HUNT) { xn *= x; poly += d * xn; }
  const kh2 = x * x + x / poly;
  return Math.sqrt(kh2) / depth;
};
const groupSpeed = (omega, depth) => {
  const k = waveNumber(omega, depth);
  const kd = k * depth;
  const n = kd > 20 ? 0.5 : 0.5 + kd / Math.sinh(2 * kd);
  return (omega / k) * n;
};
const phaseSpeed = (omega, depth) => omega / waveNumber(omega, depth);

// ── Raster ζώνης ────────────────────────────────────────────────────────────
const loadZone = async () => {
  const p = path.join(root, '.tmp/bathymetry-zones', `${ZONE_ID}.tif`);
  if (!existsSync(p)) throw new Error(`Λείπει το ${p} — τρέξε πρώτα downloadBathymetryZone.mjs`);
  const buf = readFileSync(p);
  const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const image = await tiff.getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const width = image.getWidth(), height = image.getHeight();
  const nodata = image.getGDALNoData();
  const band = (await image.readRasters())[0];
  const pxDeg = (east - west) / width, pyDeg = (north - south) / height;
  const raw = (x, y) => {
    const v = band[y * width + x];
    return (v === nodata || !Number.isFinite(v)) ? NaN : v;
  };
  // Ωμή διγραμμική (στεριά + νερό μαζί): για την πορεία της ακτίνας και τον έλεγχο «στεριά;».
  // Θετικό αποτέλεσμα = στεριά. ΔΕΝ χρησιμοποιείται ως «βάθος στην παραλία» πουθενά.
  const rawAt = (lat, lon) => {
    const fx = (lon - west) / pxDeg, fy = (north - lat) / pyDeg;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return NaN;
    const tx = fx - x0, ty = fy - y0;
    const v00 = raw(x0, y0), v10 = raw(x0 + 1, y0), v01 = raw(x0, y0 + 1), v11 = raw(x0 + 1, y0 + 1);
    if (Number.isNaN(v00) || Number.isNaN(v10) || Number.isNaN(v01) || Number.isNaN(v11)) return NaN;
    return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
  };
  // Παρεμβολή ΜΟΝΟ σε νερό (μάθημα v2) — για την επιλογή σημείου εκκίνησης.
  const waterDepthAt = (lat, lon) => {
    const fx = (lon - west) / pxDeg, fy = (north - lat) / pyDeg;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return null;
    const tx = fx - x0, ty = fy - y0;
    const cells = [
      [raw(x0, y0), (1 - tx) * (1 - ty)], [raw(x0 + 1, y0), tx * (1 - ty)],
      [raw(x0, y0 + 1), (1 - tx) * ty], [raw(x0 + 1, y0 + 1), tx * ty],
    ];
    let sum = 0, wsum = 0;
    for (const [v, w] of cells) if (Number.isFinite(v) && v < 0) { sum += -v * w; wsum += w; }
    return wsum > 0 ? sum / wsum : null;
  };
  const inBox = (lat, lon) =>
    lat > south + pyDeg && lat < north - pyDeg && lon > west + pxDeg && lon < east - pxDeg;
  return { rawAt, waterDepthAt, inBox };
};

// ── Γεωμετρία βημάτων (επίπεδο βήμα με cos(lat) — ίδια λογική με destinationPoint) ──
const M_PER_DEG_LAT = 111320;
const step = (lat, lon, bearingDeg, distM) => {
  const b = bearingDeg * Math.PI / 180;
  return [
    lat + (distM * Math.cos(b)) / M_PER_DEG_LAT,
    lon + (distM * Math.sin(b)) / (M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180)),
  ];
};

// ── Η ακτίνα ────────────────────────────────────────────────────────────────
// Ανάδρομη = ίδια καμπύλη, ανάποδη φορά· η εξίσωση καμπυλότητας είναι συμμετρική στην
// αντιστροφή χρόνου με αυτή την παραμετροποίηση, οπότε απλά εκτοξεύουμε ακτίνα με φορά
// προς τα ανοιχτά. bearing ψ: 0=N, 90=E. Λύγισμα προς τα ρηχά.
const traceRay = (zone, lat0, lon0, psi0, omega, halfDeepL) => {
  let lat = lat0, lon = lon0, psi = psi0, travelled = 0;
  const gradH = 90; // μ — ~1 pixel, κεντρική διαφορά για ∂c
  while (travelled < HORIZON_KM * 1000) {
    // Έλεγχος στεριάς με παρεμβολή ΜΟΝΟ σε νερό (μάθημα v2): στα 92 μ/pixel η ωμή διγραμμική
    // βάφει «στεριά» τα μικτά pixel της ακτής και κλείνει ψευδώς στόμια κολπίσκων (μετρήθηκε:
    // Πίσω Λιβάδι/Παροικιά με K≈0 παντού). Στεριά = κανένα pixel νερού στη γειτονιά 2×2.
    const d = zone.waterDepthAt(lat, lon);
    if (d == null) {
      if (!zone.inBox(lat, lon)) return { exit: 'edge', psi, lat, lon };
      return { exit: 'blocked' };
    }
    if (d < 1) return { exit: 'blocked' };

    const deep = d > halfDeepL;
    const ds = deep ? 220 : d > 25 ? 90 : 40;

    if (deep) {
      // Βαθύ νερό: καμία διάθλαση, ευθεία — αλλά ο έλεγχος στεριάς συνεχίζει σε κάθε βήμα.
      const [nlat, nlon] = step(lat, lon, psi, ds);
      lat = nlat; lon = nlon;
    } else {
      // RK2 (μέσο σημείο) στην καμπυλότητα: dψ/ds = −(1/c)(sinα ∂c/∂x − cosα ∂c/∂y), α=90°−ψ.
      const curvature = (la, lo, ps) => {
        // Και η κλίση του c από νερό-μόνο βάθη: το clamp της στεριάς σε «1 μ νερό» έφτιαχνε
        // ψεύτικο ρηχό-μαγνήτη που τραβούσε τις παράκτιες ακτίνες μέσα στη στεριά.
        const cAt = (a, b) => {
          const w = zone.waterDepthAt(a, b);
          return phaseSpeed(omega, Math.max(1, w ?? 1)); // στεριά → c ελάχιστου βάθους (φρένο)
        };
        const [latN] = step(la, lo, 0, gradH); const [latS] = step(la, lo, 180, gradH);
        const [, lonE] = step(la, lo, 90, gradH); const [, lonW] = step(la, lo, 270, gradH);
        const cE = cAt(la, lonE), cW = cAt(la, lonW), cN = cAt(latN, lo), cS = cAt(latS, lo);
        const c0 = cAt(la, lo);
        const dcdx = (cE - cW) / (2 * gradH), dcdy = (cN - cS) / (2 * gradH);
        const alpha = (90 - ps) * Math.PI / 180;
        return -(Math.sin(alpha) * dcdx - Math.cos(alpha) * dcdy) / c0; // rad/μ
      };
      const k1 = curvature(lat, lon, psi);
      const psiMid = psi + (k1 * ds / 2) * 180 / Math.PI;
      const [mlat, mlon] = step(lat, lon, psi, ds / 2);
      const k2 = curvature(mlat, mlon, psiMid);
      psi = (psi + (k2 * ds) * 180 / Math.PI + 360) % 360;
      const [nlat, nlon] = step(lat, lon, (psi + psiMid) / 2, ds);
      lat = nlat; lon = nlon;
    }
    travelled += ds;
  }
  return { exit: 'horizon', psi, lat, lon }; // ανοιχτή: από εδώ και πέρα μιλάει το marine cell
};

// ── Η πύλη της πινέζας (ξεσκόνισμα 18/08, v2 του πίνακα) ────────────────────
// Το K περιγράφει ενέργεια που φτάνει στο σημείο ΕΚΚΙΝΗΣΗΣ (100-650 μ ανοιχτά κατά facingDeg).
// Μετρήθηκε (adjudicateTransferDangers): σε 4 περιπτώσεις η εκκίνηση «βλέπει» πάνω από βραχίονα
// που κρύβει την πινέζα σε ≤100 μ (Δελφίνι 225°, Κέδρος 135° κ.ά.) και ο πίνακας υπερ-ισχυρίζεται.
// Πύλη ΔΥΟ μαρτύρων (μετρήθηκε και το γιατί): μόνο «στεριά <150 μ στο raster» έκοβε ΚΑΙ 44
// διευθύνσεις που η έκθεση ξέρει ανοιχτές με 8+ χλμ (στα 92 μ/pixel το πρώτο βήμα από πινέζα
// στην άμμο πατάει pixel «στεριάς» της ίδιας της παραλίας) και χάλαγε τις Κολυμπήθρες. Άρα το
// K(θ) μηδενίζεται ΜΟΝΟ όταν συμφωνούν: (α) η ευθεία από την ΠΙΝΕΖΑ βρίσκει στεριά <150 μ στο
// raster ΚΑΙ (β) ο ώριμος ray-caster της έκθεσης λέει fetch≈0 στους τομείς γύρω από τη θ.
// Τόσο κοντινός, διπλά βεβαιωμένος βραχίονας είναι πραγματική προστασία — κύμα 6s δεν
// περιθλάται γύρω του με ενέργεια που να μετράει. Αλλιώς ΔΕΝ κόβουμε: η ευθεία-από-πινέζα
// έχει το δικό της ψέμα (η θάλασσα κάνει τον γύρο, η γραμμή όχι — μάθημα v2 §8β).
// Το ωμό μέτρο μπαίνει στο JSON (pinFirstLandM ανά διεύθυνση) για διαφάνεια/μελλοντική κρίση.
const PIN_GATE_MAX_M = 150;
const pinFirstLandM = (zone, lat, lon, bearingDeg, maxM = 1000) => {
  for (let off = 50; off <= maxM; off += 50) {
    const [la, lo] = step(lat, lon, bearingDeg, off);
    if (zone.waterDepthAt(la, lo) == null) return off;
  }
  return maxM + 1;
};

// ── Σημείο εκκίνησης ────────────────────────────────────────────────────────
const findStart = (zone, lat, lon, facingDeg) => {
  let best = null;
  for (let off = 100; off <= START_MAX_OFFSET_M; off += 50) {
    const [la, lo] = step(lat, lon, facingDeg, off);
    const d = zone.waterDepthAt(la, lo);
    if (d == null) continue;
    if (d >= START_TARGET_DEPTH_M) return { lat: la, lon: lo, depthM: d, offsetM: off };
    if (d >= 2 && (!best || d > best.depthM)) best = { lat: la, lon: lo, depthM: d, offsetM: off };
  }
  return best; // ρηχό πλατό: πάρε το βαθύτερο ≥2 μ που βρέθηκε· αλλιώς null = άλυτη
};

// ── Ψήσιμο πίνακα ───────────────────────────────────────────────────────────
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const main = async () => {
  const zone = await loadZone();
  const outDir = path.join(root, 'public/data/geospatial/wave-transfer');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(path.join(root, 'reports/quality'), { recursive: true });

  const beaches = [];
  for (const regionId of REGION_IDS) {
    const app = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${regionId}.json`), 'utf8'));
    const exposure = JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/exposure', `${regionId}.json`), 'utf8'));
    const profiles = {};
    for (const p of Object.values(exposure.profiles ?? {})) if (p?.beachId != null) profiles[p.beachId] = p;
    for (const b of app.island?.beaches ?? []) {
      if (!b.coordinates) continue;
      const prof = profiles[b.id];
      if (!prof || !Number.isFinite(prof.facingDeg)) continue;
      beaches.push({ regionId, id: b.id, name: b.name?.gr ?? b.name?.en ?? String(b.id),
        lat: b.coordinates.lat, lon: b.coordinates.lon, facingDeg: prof.facingDeg, sectors: prof.sectors });
    }
  }
  console.log(`${beaches.length} παραλίες πιλότου (${REGION_IDS.join(', ')})`);

  const binDirs = Array.from({ length: DIR_BINS }, (_, i) => i * (360 / DIR_BINS));
  const rayDirs = Array.from({ length: 360 / RAY_STEP_DEG }, (_, i) => i * RAY_STEP_DEG);
  const dPsiRad = RAY_STEP_DEG * Math.PI / 180;

  const result = { version: 2, zone: ZONE_ID, generatedAt: new Date().toISOString(),
    physics: 'linear refraction+shoaling, backward rays, cos2 spreading, Liouville E*cg/k invariant',
    periodsS: PERIODS_S, directionsDeg: binDirs,
    note: 'K πολλαπλασιάζει το βαθύ ύψος συνιστώσας στο σημείο εκκίνησης· null = άλυτη παραλία',
    beaches: {} };
  const diag = { unresolved: [], shallowStart: [], fetchCrossCheck: { contradictions: [], suspiciousBlocks: [] }, rayStats: {} };

  const t0 = Date.now();
  let rayCount = 0;
  for (const b of beaches) {
    const start = findStart(zone, b.lat, b.lon, b.facingDeg);
    if (!start) {
      diag.unresolved.push({ id: b.id, name: b.name, regionId: b.regionId });
      result.beaches[b.id] = null;
      continue;
    }
    if (start.depthM < START_TARGET_DEPTH_M) diag.shallowStart.push({ id: b.id, name: b.name, depthM: +start.depthM.toFixed(1) });

    const pinLand = binDirs.map(dir => pinFirstLandM(zone, b.lat, b.lon, dir));
    // Ο δεύτερος μάρτυρας: fetch της έκθεσης στη διεύθυνση του bin — για ενδιάμεσα bins (22,5°
    // κ.λπ.) το ΜΕΓΙΣΤΟ των δύο γειτονικών τομέων, ώστε η πύλη να πυροδοτεί μόνο όταν ΚΑΙ οι
    // δύο γείτονες είναι κλειστοί (προς το αγριότερο = ασφαλές).
    const SECTOR_DIRS = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    const fetchNear = (dir) => {
      let best = 0;
      for (const [nm, sdeg] of Object.entries(SECTOR_DIRS)) {
        if (angDiff(sdeg, dir) <= 22.5 + 1e-9) best = Math.max(best, b.sectors?.[nm]?.fetchKm ?? 0);
      }
      return best;
    };
    const pinGate = binDirs.map((dir, di) => pinLand[di] < PIN_GATE_MAX_M && fetchNear(dir) < 0.5);
    const K = []; // [περίοδος][διεύθυνση]
    const openShare = [];
    for (const T of PERIODS_S) {
      const omega = 2 * Math.PI / T;
      const halfDeepL = (G * T * T / (2 * Math.PI)) / 2;
      const kN = waveNumber(omega, start.depthM);
      const cgN = groupSpeed(omega, start.depthM);
      const rays = [];
      for (const psi0 of rayDirs) {
        rayCount++;
        const r = traceRay(zone, start.lat, start.lon, psi0, omega, halfDeepL);
        if (r.exit === 'blocked') continue;
        const exitDepth = zone.waterDepthAt(r.lat, r.lon) ?? 1000;
        const kD = waveNumber(omega, exitDepth);
        const cgD = groupSpeed(omega, exitDepth);
        rays.push({ thetaFrom: r.psi, X: (kN * cgD) / (kD * cgN) });
      }
      openShare.push(+(rays.length / rayDirs.length).toFixed(3));
      const row = binDirs.map((dir, di) => {
        if (pinGate[di]) return 0; // πύλη δύο μαρτύρων: βραχίονας κολλητά, διπλά βεβαιωμένος
        let sum = 0;
        for (const r of rays) {
          const d = angDiff(r.thetaFrom, dir);
          if (d < 90) sum += (2 / Math.PI) * Math.cos(d * Math.PI / 180) ** 2 * r.X * dPsiRad;
        }
        return +Math.sqrt(sum).toFixed(3);
      });
      K.push(row);
    }
    result.beaches[b.id] = {
      name: b.name, regionId: b.regionId,
      start: { lat: +start.lat.toFixed(5), lon: +start.lon.toFixed(5), depthM: +start.depthM.toFixed(1), offsetM: start.offsetM, bearingDeg: b.facingDeg },
      pinFirstLandM: pinLand,
      openShare, K,
    };

    // Διασταύρωση με τον ανεξάρτητο μάρτυρα (fetch ακτίνων της έκθεσης), T=6s.
    const t6 = PERIODS_S.indexOf(6);
    for (const [dirName, sec] of Object.entries(b.sectors ?? {})) {
      const dirDeg = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[dirName];
      if (dirDeg == null) continue;
      const k6 = K[t6][binDirs.indexOf(dirDeg)];
      if (k6 == null) continue;
      if (sec.fetchKm === 0 && k6 > 0.35)
        diag.fetchCrossCheck.contradictions.push({ id: b.id, name: b.name, dir: dirName, fetchKm: 0, K6: k6 });
      if (sec.fetchKm >= 8 && k6 < 0.05)
        diag.fetchCrossCheck.suspiciousBlocks.push({ id: b.id, name: b.name, dir: dirName, fetchKm: sec.fetchKm, K6: k6 });
    }
  }
  diag.rayStats = { totalRays: rayCount, seconds: +((Date.now() - t0) / 1000).toFixed(1) };

  writeFileSync(path.join(outDir, `${ZONE_ID}.json`), JSON.stringify(result));
  writeFileSync(path.join(root, 'reports/quality', `wave-transfer-${ZONE_ID}.json`), JSON.stringify(diag, null, 2));

  const resolved = Object.values(result.beaches).filter(Boolean).length;
  console.log(`Ψήθηκαν ${resolved}/${beaches.length} · άλυτες ${diag.unresolved.length} · ρηχή εκκίνηση ${diag.shallowStart.length}`);
  console.log(`Ακτίνες: ${rayCount} σε ${diag.rayStats.seconds}s`);
  console.log(`Αντιφάσεις (fetch 0 αλλά K6>0,35): ${diag.fetchCrossCheck.contradictions.length}`);
  console.log(`Ύποπτα φραξίματα (fetch ≥8 χλμ αλλά K6<0,05): ${diag.fetchCrossCheck.suspiciousBlocks.length}`);

  // Ονομαστικός έλεγχος: Άγ. Προκόπιος (1985, βλέπει ΝΔ 212°) — ψηλό K στα W/SW, ~0 στα N-E.
  const ap = result.beaches[1985];
  if (ap) {
    const t6 = PERIODS_S.indexOf(6);
    console.log(`Άγ. Προκόπιος T=6s, εκκίνηση ${ap.start.depthM} μ @${ap.start.offsetM} μ:`);
    console.log('  ' + binDirs.map((d, i) => `${d}:${ap.K[t6][i]}`).join(' '));
  }
};

await main();
