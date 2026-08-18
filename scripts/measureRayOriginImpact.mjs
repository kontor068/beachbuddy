/**
 * ΤΙ ΚΑΝΕΙ ΕΘΝΙΚΑ ΤΟ ΝΑ ΡΙΞΟΥΜΕ ΤΙΣ ΑΚΤΙΝΕΣ ΑΠΟ ΤΟ ΝΕΡΟ ΠΟΥ ΑΚΟΥΜΠΑΕΙ Η ΠΑΡΑΛΙΑ.
 *
 * ΑΦΟΡΜΗ, ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΕΧΕΙ ΜΕΤΡΗΘΕΙ ΑΚΟΜΑ. Καραβοστάσι Μπαλίου (680), 18/08/2026: γυάλινο
 * νερό στην κάμερα, «κύμα 0,4 μ.» στην κάρτα. Είναι η ίδια παραλία που γέννησε το §Μ5 στις 16/08
 * με 1,3 μ. Το §Μ5 μέτρησε την αφετηρία ΜΟΝΟ ως προς την ερώτηση του §Γ1 («και οι 40 ακτίνες
 * μπλοκαρισμένες;») και κατέληξε σε 140 υποψήφιες → 9 δεκτές → 0 ζωντανές. Το §Μ7 μέτρησε το
 * ΒΗΜΑ των ακτίνων και το σκότωσε (99,1% ψεύτικο σήμα). **Κανένα από τα δύο δεν μέτρησε τι κάνει
 * η αφετηρία στην πύλη που πραγματικά τυπώνει τον αριθμό.**
 *
 * ΓΙΑΤΙ Η ΠΥΛΗ ΤΟΥ §Γ1 ΔΕΝ ΕΙΝΑΙ Η ΠΥΛΗ ΠΟΥ ΜΕΤΡΑΕΙ. Ο αριθμός στην κάρτα δεν βγαίνει από το
 * `max(πλέγμα, δικό μας μοντέλο)` — αυτός ο δρόμος δεν μπορεί ΠΟΤΕ να πέσει κάτω από το πλέγμα
 * (μετρήθηκε για το 680: 0,38 → 0,38 και με τις δύο γεωμετρίες). Βγαίνει από τον ΔΕΥΤΕΡΟ δρόμο,
 * το `utils/shoreWave.estimateShoreWaveHeightM`, που ΕΠΙΤΡΕΠΕΤΑΙ να τυπώσει κάτω από το πλέγμα —
 * και ο οποίος ανοίγει με δύο όρους πάνω στον τομέα ΑΠ' ΟΠΟΥ ΦΥΣΑΕΙ:
 *
 *     blockedRayRatio >= 1   (utils/offshoreFlatWater.OFFSHORE_FLAT_MIN_BLOCKED_RATIO)
 *     fetchKm         <= 0,5 (utils/offshoreFlatWater.OFFSHORE_FLAT_MAX_FETCH_KM)
 *
 * Καραβοστάσι, τομέας ΒΔ: σήμερα 10 χλμ / 0,6 → **σιωπή**, τυπώνεται το πέλαγος 0,38. Από το νερό
 * του όρμου: 0 χλμ / 1 → η πύλη ανοίγει, η βεντάλια του §Γ22 δίνει το δάπεδο και τυπώνεται
 * **0,10 μ.** Επαληθευμένο καλώντας τον ίδιο τον κώδικα που τρέχει, όχι αντίγραφό του.
 *
 * ΑΡΑ Η ΑΦΕΤΗΡΙΑ ΑΓΓΙΖΕΙ ΤΟΝ ΑΡΙΘΜΟ — ΚΑΙ ΓΙ' ΑΥΤΟ ΑΚΡΙΒΩΣ ΕΙΝΑΙ ΕΠΙΚΙΝΔΥΝΗ. Η κατεύθυνση του
 * σφάλματος είναι προς το ηρεμότερο, δηλαδή **σκανδάλη #1 της §9** (ψεύτικη ηρεμία) — το μόνο
 * λάθος που η βίβλος δηλώνει ότι δεν αντέχουμε. Το §Μ7 σκότωσε ΑΚΡΙΒΩΣ αυτή την οικογένεια με
 * δεύτερο μάρτυρα: το 99,1% της στεριάς που βρίσκει η λεπτή ακτίνα είναι **λεπτότερη από 150 μ.**,
 * δηλαδή από το ίδιο το κελί της μάσκας — «ο βράχος δίπλα στην ίδια την παραλία», όχι ακρωτήρι.
 * Μετακινώντας την αφετηρία ΠΡΟΣ την ακτή, ο κίνδυνος αυτός μεγαλώνει, δεν μικραίνει.
 *
 * ΓΙ' ΑΥΤΟ ΤΟ ΕΡΓΑΛΕΙΟ ΜΕΤΡΑΕΙ ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΚΑΙ ΔΕΝ ΑΛΛΑΖΕΙ ΚΑΝΕΝΑ:
 *
 *   1. ΠΥΛΗ ΑΝΑΠΑΡΑΓΩΓΗΣ. Ρίχνει τη βεντάλια από την αφετηρία ΤΟΥ BUILD και τη συγκρίνει με το
 *      committed προφίλ. Χωρίς αυτήν η σύγκριση δεν μετράει την αφετηρία, μετράει τα λάθη μας.
 *      Ίδια εγγύηση με το §Μ7 (πέτυχε 97,8%).
 *
 *   2. ΤΟ ΔΕΛΤΑ ΣΤΗΝ ΠΥΛΗ ΠΟΥ ΤΥΠΩΝΕΙ. Πόσοι τομείς περνούν ΝΕΟΙ το `blocked=1 ΚΑΙ fetch<=0,5`.
 *      Ανά τομέα — όχι «και οι 8», γιατί ο ζωντανός τομέας αλλάζει με τη γωνία του ανέμου κάθε ώρα.
 *
 *   3. Ο ΔΕΥΤΕΡΟΣ ΜΑΡΤΥΡΑΣ ΤΟΥ §Μ7, ΕΦΑΡΜΟΣΜΕΝΟΣ ΣΤΗΝ ΑΦΕΤΗΡΙΑ. Για κάθε τομέα που ανοίγει
 *      νέος: πόσο ΧΟΝΤΡΗ είναι η στεριά που τον φράζει, μετρημένη κατά μήκος της κεντρικής
 *      ακτίνας με βήμα 10 μ. Κάτω από 150 μ. (κελί μάσκας) = ο βράχος δίπλα στην παραλία, ψεύτικο
 *      σήμα. Πάνω = πραγματικός βραχίονας. **Αν το ποσοστό μοιάζει με το 99,1% του §Μ7, η αλλαγή
 *      απορρίπτεται με τον ίδιο ακριβώς λόγο.**
 *
 * ΤΡΕΙΣ ΠΑΡΑΛΛΑΓΕΣ, ΓΙΑΤΙ Η «ΑΛΛΑΓΗ ΑΦΕΤΗΡΙΑΣ» ΔΕΝ ΕΙΝΑΙ ΕΝΑ ΠΡΑΓΜΑ:
 *   `builder`  — η σημερινή αφετηρία (~100 μ. έξω), βήμα 200 μ.  → η αναπαραγωγή
 *   `own`      — αφετηρία στο νερό της παραλίας, βήμα 200 μ.      → **η ΜΟΝΗ επιτρεπτή αλλαγή**
 *   `own-fine` — αφετηρία στο νερό, βήμα 20 μ. στα πρώτα 3,2 χλμ. → ό,τι μέτρησε το §Μ5·
 *                **το §Μ7 ΑΠΑΓΟΡΕΥΕΙ το λεπτό βήμα**, μπαίνει μόνο για να φανεί πόσο από το
 *                εύρημα του §Μ5 οφειλόταν στο βήμα και όχι στην αφετηρία.
 *
 * ΔΕΝ ΓΡΑΦΕΙ ΤΙΠΟΤΑ ΣΤΟ `public/`, δεν αλλάζει προφίλ, δεν προτείνει λίστα για αντιγραφή.
 * Είναι μέτρηση για απόφαση Μίλτου κατά §9, όχι διόρθωση.
 *
 * Offline. Διαβάζει ~35 MB ακτογραμμής και ρίχνει δεκάδες εκατομμύρια δοκιμές στεριάς.
 *
 * Τρέξιμο: node --max-old-space-size=4096 scripts/measureRayOriginImpact.mjs [--limit N] [--only 680,767]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMask, makeIsLand, destination, KM_PER_DEG_LAT } from './lib/coastlineMask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SECTOR_CENTRE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

// ── Οι δύο όροι της πύλης που ΤΥΠΩΝΕΙ, αντιγραμμένοι από utils/offshoreFlatWater ─────────────
// (mirrored, not re-tuned — αν αλλάξουν εκεί, αυτή η μέτρηση παύει να μετράει την ίδια πύλη)
const SHORE_MIN_BLOCKED_RATIO = 1;
const SHORE_MAX_FETCH_KM = 0.5;

// ── Οι ρυθμίσεις του shipped build (public/data/geospatial/exposure settings) ─────────────────
const MAX_RAY_KM = 25;
const SHIPPED_STEP_KM = 0.2;
const FAN_ANGLES = [-30, -15, 0, 15, 30];
/** Το βήμα του §Μ5/§Μ7 στο κοντινό πεδίο. ΜΟΝΟ για τη διαγνωστική παραλλαγή `own-fine`. */
const FINE_STEP_KM = 0.02;
const FINE_FIELD_KM = 3.2;

/** Το κελί της μάσκας ακτογραμμής. Στεριά λεπτότερη από αυτό δεν είναι ακρωτήρι — §Μ7. */
const MASK_CELL_M = 150;
/** Βήμα και μήκος για τη μέτρηση πάχους στεριάς του δεύτερου μάρτυρα. */
const THICKNESS_STEP_KM = 0.01;
const THICKNESS_MAX_KM = 1.5;

/** Πόσο μακριά ψάχνουμε το νερό που ακουμπάει η παραλία, και πόσο λεπτά — §Μ5. */
const OWN_WATER_SEARCH_KM = 0.15;
const OWN_WATER_STEP_KM = 0.01;
const OWN_WATER_BEARING_STEP_DEG = 10;

/** Ανοχή της πύλης αναπαραγωγής, σε χλμ. fetch — ίδια με το §Μ7. */
const REPRO_TOLERANCE_KM = 0.25;
const REPRO_MIN_RATIO = 0.95;

// ── Ακτίνες ───────────────────────────────────────────────────────────────────────────────────

/** Μία ακτίνα. `fine` = λεπτό κοντινό πεδίο (διαγνωστικό, §Μ7 το απαγορεύει στην παραγωγή). */
const castRay = (isLand, lat, lon, bearingDeg, fine) => {
  if (fine) {
    for (let d = FINE_STEP_KM; d <= FINE_FIELD_KM; d += FINE_STEP_KM) {
      const p = destination(lat, lon, bearingDeg, d);
      if (isLand(p.lon, p.lat)) return { openKm: Math.max(0, d - FINE_STEP_KM), blocked: true, hitKm: d };
    }
    for (let d = FINE_FIELD_KM; d <= MAX_RAY_KM; d += SHIPPED_STEP_KM) {
      const p = destination(lat, lon, bearingDeg, d);
      if (isLand(p.lon, p.lat)) return { openKm: Math.max(0, d - SHIPPED_STEP_KM), blocked: true, hitKm: d };
    }
    return { openKm: MAX_RAY_KM, blocked: false, hitKm: null };
  }
  for (let d = SHIPPED_STEP_KM; d <= MAX_RAY_KM; d += SHIPPED_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, d);
    if (isLand(p.lon, p.lat)) return { openKm: Math.max(0, d - SHIPPED_STEP_KM), blocked: true, hitKm: d };
  }
  return { openKm: MAX_RAY_KM, blocked: false, hitKm: null };
};

/** Η βεντάλια των 8 τομέων, από αυθαίρετη αφετηρία. */
const castFan = (isLand, lat, lon, fine) => {
  const sectors = {};
  for (const name of SECTORS) {
    const rays = FAN_ANGLES.map(off => castRay(isLand, lat, lon, (SECTOR_CENTRE[name] + off + 360) % 360, fine));
    sectors[name] = {
      fetchKm: Number((rays.reduce((s, r) => s + r.openKm, 0) / rays.length).toFixed(2)),
      blockedRayRatio: Number((rays.filter(r => r.blocked).length / rays.length).toFixed(2)),
    };
  }
  return sectors;
};

/**
 * Ο ΔΕΥΤΕΡΟΣ ΜΑΡΤΥΡΑΣ. Πόσο χοντρή είναι η στεριά που φράζει την κεντρική ακτίνα του τομέα;
 * Περπατάει με βήμα 10 μ. από την αφετηρία, βρίσκει το πρώτο χτύπημα, και μετράει πόσο συνεχόμενα
 * μένει στεριά. `null` όταν η ακτίνα δεν φράζεται καθόλου.
 */
const landThicknessM = (isLand, lat, lon, bearingDeg) => {
  let hitKm = null;
  for (let d = THICKNESS_STEP_KM; d <= THICKNESS_MAX_KM; d += THICKNESS_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, d);
    if (isLand(p.lon, p.lat)) { hitKm = d; break; }
  }
  if (hitKm === null) return null;
  let end = hitKm;
  for (let d = hitKm; d <= THICKNESS_MAX_KM; d += THICKNESS_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, d);
    if (!isLand(p.lon, p.lat)) break;
    end = d;
  }
  return { hitM: Math.round(hitKm * 1000), thicknessM: Math.round((end - hitKm + THICKNESS_STEP_KM) * 1000) };
};

// ── Αφετηρίες ─────────────────────────────────────────────────────────────────────────────────

/** Το νερό που ΑΚΟΥΜΠΑΕΙ η παραλία (§Μ5). */
const findOwnWater = (isLand, lat, lon) => {
  if (!isLand(lon, lat)) return { lat, lon, offsetM: 0 };
  for (let d = OWN_WATER_STEP_KM; d <= OWN_WATER_SEARCH_KM + 1e-9; d += OWN_WATER_STEP_KM) {
    for (let b = 0; b < 360; b += OWN_WATER_BEARING_STEP_DEG) {
      const p = destination(lat, lon, b, d);
      if (!isLand(p.lon, p.lat)) return { lat: p.lat, lon: p.lon, offsetM: Math.round(d * 1000) };
    }
  }
  return null;
};

/** Αναπαραγωγή του `resolveNearshoreWaterOrigin`: βήμα 100 μ., γωνίες 15°, βόρεια πρώτα,
 *  και ο υποψήφιος πρέπει να κουβαλάει 0,5 χλμ. συνεχόμενο ανοιχτό νερό. */
const findBuilderOrigin = (isLand, lat, lon) => {
  const hasPassage = (la, lo) => {
    for (let b = 0; b < 360; b += 30) {
      let open = 0;
      for (let d = 0.1; d <= 0.5 + 1e-9; d += 0.1) {
        const p = destination(la, lo, b, d);
        if (isLand(p.lon, p.lat)) break;
        open = d;
      }
      if (open >= 0.45) return true;
    }
    return false;
  };
  if (!isLand(lon, lat) && hasPassage(lat, lon)) return { lat, lon, offsetM: 0 };
  for (let d = 0.1; d <= 12 + 1e-9; d += 0.1) {
    for (let b = 0; b < 360; b += 15) {
      const p = destination(lat, lon, b, d);
      if (!isLand(p.lon, p.lat) && hasPassage(p.lat, p.lon)) {
        return { lat: p.lat, lon: p.lon, offsetM: Math.round(d * 1000) };
      }
    }
  }
  return null;
};

const metresBetween = (a, b) => {
  const dLat = (a.lat - b.lat) * KM_PER_DEG_LAT;
  const dLon = (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.round(Math.hypot(dLat, dLon) * 1000);
};

const passesShoreGate = s =>
  s.blockedRayRatio >= SHORE_MIN_BLOCKED_RATIO && s.fetchKm <= SHORE_MAX_FETCH_KM;

// ── Φόρτωμα των committed προφίλ ──────────────────────────────────────────────────────────────
const arg = name => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};
const limit = Number(arg('--limit') ?? Infinity);
const onlyIds = arg('--only') ? new Set(arg('--only').split(',').map(Number)) : null;

const dir = path.join(root, 'public/data/geospatial/exposure');
const beaches = [];
for (const file of readdirSync(dir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  const doc = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  const profiles = Array.isArray(doc.profiles) ? doc.profiles : Object.values(doc.profiles ?? {});
  for (const p of profiles) {
    const shipped = {};
    let ok = true;
    for (const s of SECTORS) {
      const raw = p.sectors?.[s];
      if (!raw || typeof raw.fetchKm !== 'number' || typeof raw.blockedRayRatio !== 'number') { ok = false; break; }
      shipped[s] = { fetchKm: raw.fetchKm, blockedRayRatio: raw.blockedRayRatio };
    }
    if (!ok) continue;
    if (onlyIds && !onlyIds.has(p.beachId)) continue;
    beaches.push({
      id: p.beachId,
      name: p.name?.gr ?? p.name?.en,
      region: file.replace('.json', ''),
      lat: p.coordinates.lat,
      lon: p.coordinates.lon,
      confidence: p.confidence,
      shipped,
    });
  }
}
beaches.sort((a, b) => a.id - b.id);
const work = beaches.slice(0, Number.isFinite(limit) ? limit : beaches.length);

console.log(`Φορτώνω ακτογραμμή…`);
const isLand = makeIsLand(loadMask());
console.log(`Μετράω ${work.length} παραλίες × 8 τομείς × 5 ακτίνες × 3 παραλλαγές…\n`);

// ── Η μέτρηση ─────────────────────────────────────────────────────────────────────────────────
const findings = [];
const totals = {
  scanned: 0,
  noOwnWater: 0,
  noBuilderOrigin: 0,
  reproSectors: 0,
  reproMatched: 0,
  originJumpedOver50m: 0,
  sectorsTotal: 0,
  gateOpenShipped: 0,
  gateOpenOwn: 0,
  gateOpenOwnFine: 0,
  newlyOpenOwn: 0,
  newlyOpenOwnFine: 0,
  newlyClosedOwn: 0,
  witnessThin: 0,
  witnessThick: 0,
  witnessUnknown: 0,
  beachesTouchedOwn: 0,
};

let done = 0;
for (const b of work) {
  totals.scanned += 1;
  if (++done % 100 === 0) console.log(`  … ${done}/${work.length}`);

  const own = findOwnWater(isLand, b.lat, b.lon);
  if (!own) { totals.noOwnWater += 1; continue; }
  const builder = findBuilderOrigin(isLand, b.lat, b.lon);
  if (!builder) { totals.noBuilderOrigin += 1; continue; }

  const originGapM = metresBetween(own, builder);
  if (originGapM >= 50) totals.originJumpedOver50m += 1;

  const fanBuilder = castFan(isLand, builder.lat, builder.lon, false);
  const fanOwn = castFan(isLand, own.lat, own.lon, false);
  const fanOwnFine = castFan(isLand, own.lat, own.lon, true);

  // ΠΥΛΗ ΑΝΑΠΑΡΑΓΩΓΗΣ — μετράει αν η δική μας αναπαραγωγή περιγράφει το committed προφίλ.
  const changedSectors = [];
  for (const s of SECTORS) {
    totals.sectorsTotal += 1;
    totals.reproSectors += 1;
    if (Math.abs(fanBuilder[s].fetchKm - b.shipped[s].fetchKm) <= REPRO_TOLERANCE_KM) totals.reproMatched += 1;

    const shippedOpen = passesShoreGate(b.shipped[s]);
    const ownOpen = passesShoreGate(fanOwn[s]);
    const fineOpen = passesShoreGate(fanOwnFine[s]);
    if (shippedOpen) totals.gateOpenShipped += 1;
    if (ownOpen) totals.gateOpenOwn += 1;
    if (fineOpen) totals.gateOpenOwnFine += 1;
    if (!shippedOpen && fineOpen) totals.newlyOpenOwnFine += 1;
    if (shippedOpen && !ownOpen) totals.newlyClosedOwn += 1;

    if (!shippedOpen && ownOpen) {
      totals.newlyOpenOwn += 1;
      // Ο ΔΕΥΤΕΡΟΣ ΜΑΡΤΥΡΑΣ, μόνο εκεί που η πύλη ανοίγει νέα.
      const w = landThicknessM(isLand, own.lat, own.lon, SECTOR_CENTRE[s]);
      if (!w) totals.witnessUnknown += 1;
      else if (w.thicknessM < MASK_CELL_M) totals.witnessThin += 1;
      else totals.witnessThick += 1;
      changedSectors.push({
        sector: s,
        shipped: b.shipped[s],
        own: fanOwn[s],
        ownFine: fanOwnFine[s],
        witness: w,
        witnessVerdict: !w ? 'unknown' : w.thicknessM < MASK_CELL_M ? 'thin-rock' : 'real-arm',
      });
    }
  }

  if (changedSectors.length) {
    totals.beachesTouchedOwn += 1;
    findings.push({
      id: b.id,
      name: b.name,
      region: b.region,
      lat: b.lat,
      lon: b.lon,
      confidence: b.confidence,
      ownWater: own,
      builderOrigin: builder,
      originGapM,
      changedSectors,
    });
  }
}

// ── Αναφορά ───────────────────────────────────────────────────────────────────────────────────
const reproRatio = totals.reproSectors ? totals.reproMatched / totals.reproSectors : 0;
const witnessTotal = totals.witnessThin + totals.witnessThick + totals.witnessUnknown;
const thinPct = witnessTotal ? (100 * totals.witnessThin) / witnessTotal : 0;

const out = {
  generatedAt: new Date().toISOString(),
  settings: {
    SHORE_MIN_BLOCKED_RATIO, SHORE_MAX_FETCH_KM, SHIPPED_STEP_KM, FINE_STEP_KM, FINE_FIELD_KM,
    MASK_CELL_M, OWN_WATER_SEARCH_KM, REPRO_TOLERANCE_KM,
  },
  totals,
  reproRatio: Number(reproRatio.toFixed(4)),
  witnessThinPct: Number(thinPct.toFixed(1)),
  findings: findings.sort((a, b) => b.changedSectors.length - a.changedSectors.length),
};

const dest = path.join(root, 'reports/geometry');
mkdirSync(dest, { recursive: true });
const file = path.join(dest, 'ray-origin-impact.json');
writeFileSync(file, JSON.stringify(out, null, 1));

console.log(`\n──────────────────────────────────────────────────────────────`);
console.log(`ΠΥΛΗ ΑΝΑΠΑΡΑΓΩΓΗΣ: ${(reproRatio * 100).toFixed(1)}% (${totals.reproMatched}/${totals.reproSectors} τομείς)`);
if (reproRatio < REPRO_MIN_RATIO) {
  console.log(`⛔ ΚΑΤΩ ΑΠΟ ${(REPRO_MIN_RATIO * 100).toFixed(0)}% — Η ΣΥΓΚΡΙΣΗ ΔΕΝ ΜΕΤΡΑΕΙ ΤΗΝ ΑΦΕΤΗΡΙΑ. Μην τη διαβάσεις.`);
}
console.log(`──────────────────────────────────────────────────────────────`);
console.log(`παραλίες που σαρώθηκαν            ${totals.scanned}`);
console.log(`  χωρίς νερό στα 150 μ.           ${totals.noOwnWater}`);
console.log(`  η αφετηρία πήδηξε >=50 μ.       ${totals.originJumpedOver50m}`);
console.log(`τομείς συνολικά                   ${totals.sectorsTotal}`);
console.log(`\nΠΥΛΗ ΠΟΥ ΤΥΠΩΝΕΙ (blocked=1 ΚΑΙ fetch<=0,5):`);
console.log(`  ανοιχτοί σήμερα                 ${totals.gateOpenShipped}`);
console.log(`  ανοιχτοί με αφετηρία στον όρμο  ${totals.gateOpenOwn}`);
console.log(`  ΝΕΟΙ (→ ηρεμότερο)              ${totals.newlyOpenOwn}  σε ${totals.beachesTouchedOwn} παραλίες`);
console.log(`  έκλεισαν (→ αυστηρότερο)        ${totals.newlyClosedOwn}`);
console.log(`  [διαγνωστικό] ΝΕΟΙ με λεπτό βήμα ${totals.newlyOpenOwnFine}  ← §Μ7 ΤΟ ΑΠΑΓΟΡΕΥΕΙ`);
console.log(`\nΔΕΥΤΕΡΟΣ ΜΑΡΤΥΡΑΣ (πάχος στεριάς στους νέους τομείς):`);
console.log(`  <150 μ. — ο βράχος δίπλα        ${totals.witnessThin}  (${thinPct.toFixed(1)}%)`);
console.log(`  >=150 μ. — πραγματικός βραχίονας ${totals.witnessThick}`);
console.log(`  δεν βρέθηκε στεριά              ${totals.witnessUnknown}`);
console.log(`\n→ ${path.relative(root, file)}`);
console.log(`\nΤο §Μ7 απέρριψε το λεπτό βήμα στο 99,1% «λεπτό». Αν το ποσοστό εδώ είναι κοντά,`);
console.log(`η αλλαγή αφετηρίας απορρίπτεται με τον ΙΔΙΟ λόγο. Απόφαση Μίλτου κατά §9.`);
