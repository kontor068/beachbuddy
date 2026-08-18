/**
 * ΤΟ ΒΗΜΑ ΤΩΝ ΑΚΤΙΝΩΝ ΕΙΝΑΙ 200 Μ. — ΤΙ ΧΑΝΕΤΑΙ ΑΝΑΜΕΣΑ ΣΕ ΔΥΟ ΔΕΙΓΜΑΤΑ;
 *
 * Η εθνική μέτρηση που η βίβλος §Μ6 δηλώνει ΑΝΟΙΧΤΗ: «Οι 8 φέτες δεν αλλάχθηκαν: τροφοδοτούν το
 * χρώμα ολόκληρης της χώρας και θέλουν δική τους εθνική μέτρηση.» Αυτό είναι εκείνη η μέτρηση.
 *
 * ΤΙ ΡΩΤΑΕΙ. Το shipped build (public/data/geospatial/exposure/*.json settings.stepKm = 0,2)
 * δειγματοληπτεί στεριά κάθε 200 μ. κατά μήκος κάθε ακτίνας. Μια λωρίδα στεριάς λεπτότερη από
 * 200 μ. — ένας βραχίονας, ένα ακρωτήρι, μια νησίδα — μπορεί να πέσει ολόκληρη ΑΝΑΜΕΣΑ σε δύο
 * δείγματα και να μην υπάρξει ποτέ. Παράδειγμα από τη βίβλο (§Μ6): Λυγαριά Ηρακλείου στις 345°,
 * λωρίδα στεριάς 100 μ. (0,22→0,32 χλμ), δείγματα στα 0,2 (νερό) και 0,4 (νερό) → «ανοιχτή
 * θάλασσα 25 χλμ». Στις 0° η ίδια παραλία μπλοκάρεται ΚΑΤΑ ΤΥΧΗ.
 *
 * ΠΩΣ ΑΠΟΜΟΝΩΝΕΤΑΙ ΤΟ ΒΗΜΑ ΚΑΙ ΜΟΝΟ ΤΟ ΒΗΜΑ. Το §Μ5 (η αφετηρία των ακτίνων προσγειώνεται έξω από
 * τον όρμο) είναι ΔΙΑΦΟΡΕΤΙΚΟ εύρημα της ίδιας οικογένειας, μετρήθηκε ήδη και έκλεισε στις 9
 * παραλίες. Για να μην μπερδευτούν τα δύο, εδώ και οι δύο διαβάσεις ξεκινούν από την ΙΔΙΑ
 * αφετηρία — αυτήν που αναπαράγει τη λογική του build (resolveNearshoreWaterOrigin: βήμα 0,1 χλμ,
 * γωνίες ανά 15°, nearshoreMinOpenWaterKm 0,5). Ό,τι διαφορά μείνει ανήκει στο βήμα.
 *
 * ΤΟ ΔΙΧΤΥ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΜΕΤΡΗΣΗΣ. Η χονδρή διάβαση ξανατρέχει εδώ με βήμα 200 μ. και συγκρίνεται
 * με το ΓΡΑΜΜΕΝΟ fetchKm του προφίλ. Αν η αναπαραγωγή δεν πέφτει πάνω στο committed, η σύγκριση
 * δεν μετράει τίποτα — γι' αυτό τυπώνεται πρώτη και ονομάζεται «πύλη αναπαραγωγής».
 *
 * REPORT-ONLY. Δεν γράφει σε public/, δεν αλλάζει κανένα νούμερο που βλέπει επισκέπτης.
 *
 * Usage:  node scripts/auditFetchRayStep.mjs [--limit N] [--region <id>] [--fine-step 0.05]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMask, makeIsLand, destination } from './lib/coastlineMask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const OUT_DIR = path.join(root, 'reports', 'geometry');

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SECTOR_BEARING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

// ── Shipped build settings, mirrored. Not re-tuned here. ──────────────────────────────────────
const FAN_ANGLES = [-30, -15, 0, 15, 30];
const MAX_FETCH_KM = 25;
const COARSE_STEP_KM = 0.2;
const NEARSHORE_GRACE_KM = 0.1;
const ORIGIN_SEARCH_KM = 12;
const ORIGIN_STEP_KM = 0.1;
const ORIGIN_MIN_OPEN_KM = 0.5;

// ── The fine read. 50 m is under half the 150 m mask cell, so a cell can no longer be skipped. ──
const DEFAULT_FINE_STEP_KM = 0.05;
/** Beyond this the arms stop mattering and the shipped resolution is enough — same cut as §Μ5. */
const FINE_FIELD_KM = 3.2;

// ── Thresholds that actually consume fetchKm downstream. Crossing one is what "matters". ───────
const THRESHOLDS = [
  { key: 'offshoreFlat_0.5', km: 0.5, what: 'utils/offshoreFlatWater OFFSHORE_FLAT_MAX_FETCH_KM' },
  { key: 'geomCeiling_3', km: 3, what: 'utils/geometricWaveCeiling §Γ1 max fetch' },
  { key: 'classifyProtected_2', km: 2, what: 'classifyFetchExposure protected' },
  { key: 'opennessRamp_8', km: 8, what: 'OPENNESS_RAMP_START_KM / classifyFetchExposure exposed' },
  { key: 'fetchSaturation_12', km: 12, what: 'FETCH_SATURATION_KM' },
];

const argv = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const LIMIT = Number(argValue('--limit', '0')) || 0;
const REGION = argValue('--region', null);
const FINE_STEP_KM = Number(argValue('--fine-step', String(DEFAULT_FINE_STEP_KM)));

/** One ray, uniform step. This is exactly utils/geospatialExposureModel.sampleFetchRay. */
const castCoarse = (isLand, lat, lon, bearingDeg) => {
  for (let d = COARSE_STEP_KM; d <= MAX_FETCH_KM + 1e-9; d += COARSE_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, d);
    if (isLand(p.lon, p.lat) && d > NEARSHORE_GRACE_KM) {
      return { openKm: Math.max(0, d - COARSE_STEP_KM), blocked: true };
    }
  }
  return { openKm: MAX_FETCH_KM, blocked: false };
};

/** Same ray, fine near field. The ONLY difference from castCoarse is the sampling density. */
const castFine = (isLand, lat, lon, bearingDeg) => {
  let d = FINE_STEP_KM;
  for (; d <= FINE_FIELD_KM + 1e-9; d += FINE_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, d);
    if (isLand(p.lon, p.lat) && d > NEARSHORE_GRACE_KM) {
      return { openKm: Math.max(0, d - FINE_STEP_KM), blocked: true };
    }
  }
  for (d = FINE_FIELD_KM; d <= MAX_FETCH_KM + 1e-9; d += COARSE_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, d);
    if (isLand(p.lon, p.lat)) return { openKm: Math.max(0, d - COARSE_STEP_KM), blocked: true };
  }
  return { openKm: MAX_FETCH_KM, blocked: false };
};

/** The build's origin walk (resolveNearshoreWaterOrigin + hasOpenWaterPassage), reproduced. */
const resolveOrigin = (isLand, lat, lon) => {
  const hasPassage = (la, lo) => {
    const step = Math.min(0.1, ORIGIN_MIN_OPEN_KM / 2);
    for (let b = 0; b < 360; b += 30) {
      let open = 0;
      for (let d = step; d <= ORIGIN_MIN_OPEN_KM + 1e-9; d += step) {
        const p = destination(la, lo, b, d);
        if (isLand(p.lon, p.lat)) break;
        open = d;
      }
      if (open >= ORIGIN_MIN_OPEN_KM - step / 2) return true;
    }
    return false;
  };
  const qualifies = (la, lo) => !isLand(lo, la) && hasPassage(la, lo);
  if (qualifies(lat, lon)) return { lat, lon, movedKm: 0 };
  for (let d = ORIGIN_STEP_KM; d <= ORIGIN_SEARCH_KM + 1e-9; d += ORIGIN_STEP_KM) {
    for (let b = 0; b < 360; b += 15) {
      const p = destination(lat, lon, b, d);
      if (qualifies(p.lat, p.lon)) return { lat: p.lat, lon: p.lon, movedKm: Number(d.toFixed(2)) };
    }
  }
  return null;
};

const sectorFan = (isLand, origin, bearingDeg, cast) => {
  let sum = 0;
  let blocked = 0;
  for (const off of FAN_ANGLES) {
    const r = cast(isLand, origin.lat, origin.lon, (bearingDeg + off + 360) % 360);
    sum += r.openKm;
    if (r.blocked) blocked += 1;
  }
  return {
    fetchKm: Number((sum / FAN_ANGLES.length).toFixed(2)),
    blockedRayRatio: Number((blocked / FAN_ANGLES.length).toFixed(2)),
  };
};

const main = () => {
  process.stdout.write('Loading coastline mask…\n');
  const isLand = makeIsLand(loadMask());

  const files = readdirSync(EXPOSURE_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => !REGION || f === `${REGION}.json`);

  const beaches = [];
  for (const f of files) {
    const j = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, f), 'utf8'));
    for (const [id, p] of Object.entries(j.profiles || j)) {
      if (!p || typeof p !== 'object' || !p.coordinates || !p.sectors) continue;
      beaches.push({ id, region: f.replace('.json', ''), profile: p });
    }
  }
  const work = LIMIT ? beaches.slice(0, LIMIT) : beaches;
  process.stdout.write(`Scanning ${work.length} beaches (fine step ${FINE_STEP_KM * 1000} m)…\n`);

  const stats = {
    scanned: 0,
    noOrigin: 0,
    reproMatched: 0,
    reproSectors: 0,
    reproSectorsMatched: 0,
    sectorsCompared: 0,
    sectorsShrunk: 0,
    sectorsShrunkOver1km: 0,
    beachesChanged: 0,
    crossings: Object.fromEntries(THRESHOLDS.map(t => [t.key, 0])),
    beachesCrossing: Object.fromEntries(THRESHOLDS.map(t => [t.key, new Set()])),
  };
  const rows = [];

  let done = 0;
  for (const b of work) {
    done += 1;
    if (done % 100 === 0) process.stdout.write(`  ${done}/${work.length}\n`);

    const origin = resolveOrigin(isLand, b.profile.coordinates.lat, b.profile.coordinates.lon);
    if (!origin) { stats.noOrigin += 1; continue; }
    stats.scanned += 1;

    let changedHere = false;
    const sectorRows = [];
    for (const s of SECTORS) {
      const committed = b.profile.sectors[s];
      if (!committed) continue;
      const coarse = sectorFan(isLand, origin, SECTOR_BEARING[s], castCoarse);
      const fine = sectorFan(isLand, origin, SECTOR_BEARING[s], castFine);

      // Reproduction gate: does our coarse re-run land on the committed figure?
      stats.reproSectors += 1;
      if (Math.abs(coarse.fetchKm - committed.fetchKm) <= 0.25) stats.reproSectorsMatched += 1;

      stats.sectorsCompared += 1;
      const drop = Number((coarse.fetchKm - fine.fetchKm).toFixed(2));
      if (drop > 0.01) {
        stats.sectorsShrunk += 1;
        if (drop >= 1) stats.sectorsShrunkOver1km += 1;
        changedHere = true;
        for (const t of THRESHOLDS) {
          if (coarse.fetchKm >= t.km && fine.fetchKm < t.km) {
            stats.crossings[t.key] += 1;
            stats.beachesCrossing[t.key].add(b.id);
          }
        }
        sectorRows.push({ sector: s, coarseKm: coarse.fetchKm, fineKm: fine.fetchKm, dropKm: drop });
      }
    }
    if (changedHere) {
      stats.beachesChanged += 1;
      rows.push({
        id: Number(b.id),
        name: b.profile.name?.gr || b.profile.name?.en || '',
        region: b.region,
        originMovedKm: origin.movedKm,
        sectors: sectorRows,
        worstDropKm: Math.max(...sectorRows.map(r => r.dropKm)),
      });
    }
  }

  rows.sort((a, b2) => b2.worstDropKm - a.worstDropKm);

  const reproPct = stats.reproSectors
    ? ((stats.reproSectorsMatched / stats.reproSectors) * 100).toFixed(1) : '—';

  process.stdout.write('\n════ ΠΥΛΗ ΑΝΑΠΑΡΑΓΩΓΗΣ ════\n');
  process.stdout.write(`Χονδρή ξαναδιάβαση vs committed fetchKm (±0,25 χλμ): ${reproPct}% `
    + `(${stats.reproSectorsMatched}/${stats.reproSectors} τομείς)\n`);
  process.stdout.write('Κάτω από ~90% η σύγκριση παρακάτω ΔΕΝ μετράει το βήμα, μετράει τη διαφορά αφετηρίας.\n');

  process.stdout.write('\n════ ΤΙ ΑΛΛΑΖΕΙ ΤΟ ΛΕΠΤΟ ΒΗΜΑ ════\n');
  process.stdout.write(`παραλίες που σαρώθηκαν: ${stats.scanned} (χωρίς αφετηρία: ${stats.noOrigin})\n`);
  process.stdout.write(`τομείς που συγκρίθηκαν: ${stats.sectorsCompared}\n`);
  process.stdout.write(`τομείς που ΜΙΚΡΑΙΝΟΥΝ: ${stats.sectorsShrunk}`
    + ` (${((stats.sectorsShrunk / Math.max(1, stats.sectorsCompared)) * 100).toFixed(1)}%)`
    + `, από αυτούς ≥1 χλμ: ${stats.sectorsShrunkOver1km}\n`);
  process.stdout.write(`παραλίες με έστω έναν τομέα να αλλάζει: ${stats.beachesChanged}\n`);

  process.stdout.write('\n════ ΠΟΙΑ ΚΑΤΩΦΛΙΑ ΠΕΡΝΙΟΥΝΤΑΙ (= τι επηρεάζεται στ\' αλήθεια) ════\n');
  for (const t of THRESHOLDS) {
    process.stdout.write(`${t.km} χλμ — ${t.what}\n`
      + `   τομείς: ${stats.crossings[t.key]} · παραλίες: ${stats.beachesCrossing[t.key].size}\n`);
  }

  process.stdout.write('\n════ ΟΙ 15 ΜΕΓΑΛΥΤΕΡΕΣ ΠΤΩΣΕΙΣ ════\n');
  for (const r of rows.slice(0, 15)) {
    const w = r.sectors.reduce((a, c) => (c.dropKm > a.dropKm ? c : a), r.sectors[0]);
    process.stdout.write(`#${r.id} ${r.name} [${r.region}] ${w.sector}: `
      + `${w.coarseKm} → ${w.fineKm} χλμ (−${w.dropKm})\n`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `fetch-ray-step-${FINE_STEP_KM * 1000}m.json`);
  writeFileSync(outPath, JSON.stringify({
    settings: {
      coarseStepKm: COARSE_STEP_KM,
      fineStepKm: FINE_STEP_KM,
      fineFieldKm: FINE_FIELD_KM,
      maxFetchKm: MAX_FETCH_KM,
      fanAnglesDeg: FAN_ANGLES,
    },
    reproductionGatePct: Number(reproPct),
    stats: {
      ...stats,
      beachesCrossing: Object.fromEntries(
        Object.entries(stats.beachesCrossing).map(([k, v]) => [k, [...v].map(Number)])
      ),
    },
    beaches: rows,
  }, null, 2));
  process.stdout.write(`\nΑναφορά: ${path.relative(root, outPath)}\n`);
};

main();
