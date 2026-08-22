/**
 * KEEP MOVING THE QUESTION UNTIL THE MODEL ANSWERS ABOUT THE RIGHT WATER.
 *
 * THE PROBLEM THIS FINISHES. buildMarineSamplePoints places one point per beach, half the open
 * fetch out along a single bearing, and its own header is honest that this is "a good heuristic
 * that must be MEASURED, not a guarantee". Measured on 16/08/2026 against ewam
 * (scripts/auditMarineCellTrust.mjs): 314 of 2866 beaches are still served a cell describing water
 * they do not face — 215 that have a point of their own and 99 that have none and read the region
 * cell. The heuristic fires once and never looks at where the API actually landed.
 *
 * WHAT THIS DOES. For every beach whose CURRENT request point fails the trust test, it walks a
 * ladder of alternative points, asks the API which cell each one is served, and keeps the first
 * that passes. Nothing else about the beach changes, and a beach whose point already passes is
 * never touched.
 *
 * THE LADDER, and why it is ordered this way:
 *  - Sectors are tried in order of how close they are to the beach's own FACING direction, because
 *    that is the water the swimmer is looking at. Falling to a distant sector is a last resort, not
 *    a free choice: a cell that passes the fetch test from an odd bearing is defensible, but it is
 *    describing water round the corner.
 *  - Within a sector, the LONGEST push first. §Γ1's fourth dead rule and this file's own header say
 *    the same thing from two directions: nearshore cells are fetch-truncated and a nearer cell is
 *    not a better cell. We are not minimising distance, we are maximising "is this the same sea".
 *  - Never further than PUSH_FRACTION of that sector's fetch, which is the only land-free guarantee
 *    the ray fan gives — and it is a 5-ray MEAN, so even that is a bound and not a promise.
 *  - The pin itself is the last candidate. For a genuinely enclosed cove there is nothing to push
 *    towards, and the pin's own cell is the honest question even when the answer is a shrug.
 *
 * ⚠️ WHAT IT MAY NOT DO. It may not prefer a nearer cell, it may not lower a wave, and it may not
 * touch a beach that already passes. Its only lever is WHICH COORDINATE WE SEND — the number that
 * comes back is whatever the model says about the water the beach actually faces.
 *
 * ROUNDS, NOT BEACH-BY-BEACH. Every unfixed beach's k-th candidate is resolved in one batched pass,
 * so the API sees a few hundred deduplicated points per round instead of a serial crawl. Beaches
 * drop out as soon as they pass, so later rounds are small.
 *
 * Run: node scripts/optimiseMarineSamplePoints.mjs             # measure, write the report
 *      node scripts/optimiseMarineSamplePoints.mjs --apply     # write the winners into the data
 *      node scripts/optimiseMarineSamplePoints.mjs --rounds 4  # shorter ladder
 */
// Routes this script through the PAID Open-Meteo plan when OPEN_METEO_API_KEY is in the
// environment, and changes nothing when it is not. See scripts/lib/paidOpenMeteo.mjs.
import './lib/paidOpenMeteo.mjs';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECTORS, MODELS, judge, cacheKey, resolvePoints, destinationPoint,
  bearingGapDeg, isPointResolved,
} from './lib/marineCellTrust.mjs';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const APP_BEACH_DIR = path.join(root, 'public', 'data', 'beaches', 'app');
const REPORT_DIR = path.join(root, 'reports', 'quality');
const REPORT_PATH = path.join(REPORT_DIR, 'marine-sample-point-optimisation.json');
const CACHE_PATH = path.join(root, '.tmp', 'marine-cell-snap-cache-v2.json');

/** Mirrors hooks/useWeather.MARINE_POINT_OVERRIDES — the two regions whose centroid is inland. */
const MARINE_POINT_OVERRIDES = {
  'central-macedonia-thessaloniki-area': { lat: 40.45, lon: 22.90 },
  'west-greece-achaia-mainland': { lat: 38.28, lon: 21.70 },
};

const SECTOR_BEARING = Object.fromEntries(SECTORS.map((s, i) => [s, i * 45]));

/** The land-free bound from buildMarineSamplePoints. Never exceeded, only subdivided. */
const PUSH_FRACTION = 0.5;
const MAX_PUSH_KM = 10;
/** Below this a push is not a different question — the pin's own cell answers the same way. */
const MIN_PUSH_KM = 0.6;
/** A sector with less water than this cannot host any candidate worth asking about. */
const MIN_SECTOR_FETCH_KM = 1.2;
/** Fractions of a sector's fetch to try, longest first. */
const PUSH_STEPS = [0.5, 0.35, 0.22];

/**
 * Πόσο μακριά από το πρόσωπο της παραλίας επιτρέπεται να φτάσει η σκάλα.
 * ΤΟ ΙΔΙΟ ΝΟΥΜΕΡΟ με το buildMarineSamplePoints.MAX_FACING_DIVERSION_DEG — τα δύο αρχεία
 * αποφασίζουν για την ΙΔΙΑ ερώτηση («ποιο νερό ρωτάει αυτή η παραλία») και μια διαφορά τους
 * σημαίνει ότι το build και η βελτιστοποίηση παλεύουν μεταξύ τους σε κάθε εκτέλεση.
 */
const MAX_FACING_DIVERSION_DEG = 90;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const maxRounds = args.includes('--rounds') ? Number(args[args.indexOf('--rounds') + 1]) : 12;

// ── Load every profile with the coordinate the runtime would send today ──────
const files = readdirSync(EXPOSURE_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
const beaches = [];
for (const file of files) {
  const regionId = file.replace('.json', '');
  let regionPoint = MARINE_POINT_OVERRIDES[regionId] ?? null;
  if (!regionPoint) {
    const appPath = path.join(APP_BEACH_DIR, file);
    if (existsSync(appPath)) {
      const app = JSON.parse(readFileSync(appPath, 'utf8'));
      const coords = app?.island?.coordinates ?? app?.region?.coordinates ?? null;
      if (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lon)) regionPoint = coords;
    }
  }
  const payload = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
  for (const profile of Object.values(payload.profiles || {})) {
    if (!profile.coordinates || !profile.sectors) continue;
    beaches.push({
      file,
      regionId,
      profile,
      regionPoint,
      currentPoint: profile.marineSamplePoint ?? regionPoint,
      hadOwnPoint: Boolean(profile.marineSamplePoint),
    });
  }
}

/**
 * The ladder for one beach: every coordinate worth asking about, best first.
 */
const candidatesFor = ({ profile }) => {
  const facing = Number.isFinite(profile.facingDeg) ? profile.facingDeg : null;
  const open = SECTORS
    .map(sector => ({ sector, bearing: SECTOR_BEARING[sector], fetchKm: profile.sectors?.[sector]?.fetchKm }))
    .filter(s => Number.isFinite(s.fetchKm) && s.fetchKm >= MIN_SECTOR_FETCH_KM)
    /**
     * ΤΟ ΠΑΡΑΘΥΡΟ ΤΟΥ ΠΡΟΣΩΠΟΥ — ίδιο όριο με το buildMarineSamplePoints.MAX_FACING_DIVERSION_DEG.
     *
     * Η ταξινόμηση από κάτω βάζει ήδη τους κοντινούς στο facing τομείς πρώτους, αλλά ΣΕΙΡΑ ΔΕΝ
     * ΕΙΝΑΙ ΟΡΙΟ: όταν κανείς από τους κοντινούς δεν περνούσε το τεστ, η σκάλα κατέβαινε αθόρυβα
     * ως τον απέναντι τομέα και το σημείο έμενε εκεί με σφραγίδα `verified`, δηλαδή προστατευμένο
     * και από το ίδιο το build. Μετρήθηκε 22/08/2026: 14 παραλίες ρωτούσαν για νερό >90° μακριά
     * από αυτό που κοιτούν (#1702 Κολώνα, Άνδρος: κοιτάει 90°, ρωτούσε 270°).
     *
     * Καλύτερα η παραλία να μείνει «αδιόρθωτη» και να διαβάσει το σημείο της περιοχής, παρά να
     * περάσει το τεστ εμπιστοσύνης απαντώντας με ακρίβεια για άλλη θάλασσα. Η πινέζα παραμένει
     * τελευταία επιλογή παρακάτω και δεν την αγγίζει αυτό το φίλτρο.
     */
    .filter(s => facing === null || bearingGapDeg(s.bearing, facing) <= MAX_FACING_DIVERSION_DEG);

  // Closest to the beach's own facing first; among equals, the more open sector.
  open.sort((a, b) => {
    if (facing !== null) {
      const gap = bearingGapDeg(a.bearing, facing) - bearingGapDeg(b.bearing, facing);
      if (gap !== 0) return gap;
    }
    return b.fetchKm - a.fetchKm;
  });

  const out = [];
  const seen = new Set();
  const push = (lat, lon, meta) => {
    const key = `${lat},${lon}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ lat, lon, ...meta });
  };

  // The exact facing bearing, not just its sector bin — this is what the builder uses when it can.
  const bearings = [];
  if (facing !== null) {
    const facingSector = SECTORS[((Math.round(facing / 45) % 8) + 8) % 8];
    const atFacing = profile.sectors?.[facingSector]?.fetchKm;
    if (Number.isFinite(atFacing) && atFacing >= MIN_SECTOR_FETCH_KM) {
      bearings.push({ bearing: facing, fetchKm: atFacing, via: 'facing' });
    }
  }
  for (const s of open) bearings.push({ bearing: s.bearing, fetchKm: s.fetchKm, via: `sector-${s.sector}` });

  for (const step of PUSH_STEPS) {
    for (const b of bearings) {
      const km = Math.min(MAX_PUSH_KM, b.fetchKm * Math.min(step, PUSH_FRACTION));
      if (km < MIN_PUSH_KM) continue;
      const point = destinationPoint(profile.coordinates.lat, profile.coordinates.lon, b.bearing, km);
      push(point.lat, point.lon, {
        bearingDeg: Number(b.bearing.toFixed(1)),
        distanceKm: Number(km.toFixed(2)),
        via: b.via,
      });
    }
  }

  // Last resort: ask about the beach's own coordinate.
  push(
    Number(profile.coordinates.lat.toFixed(4)),
    Number(profile.coordinates.lon.toFixed(4)),
    { bearingDeg: null, distanceKm: 0, via: 'pin' }
  );

  return out;
};

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
const saveCache = () => {
  mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf8');
};
const state = {};

// ── Who needs work: judge the coordinate the runtime sends today ─────────────
const unresolved = beaches.filter(b => b.currentPoint && !isPointResolved(cache, b.currentPoint));
if (unresolved.length) {
  console.log(`Resolving ${unresolved.length} current points that are not cached yet…`);
  await resolvePoints(cache, unresolved.map(b => b.currentPoint), { state });
  saveCache();
}

/**
 * ΚΟΙΝΗ ΑΝΑΖΗΤΗΣΗ ΣΗΜΕΙΟΥ × ΜΟΝΤΕΛΟΥ (--per-model).
 *
 * Χωρίς τη σημαία, κάθε υποψήφιο σημείο κρίνεται με «όποιο μοντέλο απαντήσει πρώτο» — δηλαδή
 * απορρίπτονται σημεία που θα περνούσαν με το ΑΛΛΟ μοντέλο. Μετρήθηκε 17/08/2026 ότι αυτή η
 * τυφλότητα κόστιζε 68 παραλίες στο ΤΡΕΧΟΝ σημείο τους· εδώ ψάχνεται ο ίδιος συνδυασμός σε
 * ΟΛΗ τη σκάλα. Το ταβάνι είναι μετρημένο και μικρό (~43 από 206), γι' αυτό η σημαία είναι
 * opt-in: η προεπιλογή μένει ό,τι έτρεχε πάντα.
 */
const perModel = args.includes('--per-model');

/** Κρίνει ένα σημείο· με --per-model δέχεται όποιο μοντέλο περνάει και λέει ποιο. */
const judgePoint = (profile, point) => {
  if (!perModel) return judge(cache, profile, point);
  const first = judge(cache, profile, point);
  if (first.verdict === 'trusted') return first;
  for (const model of MODELS) {
    const verdict = judge(cache, profile, point, model.id);
    if (verdict.verdict === 'trusted') return { ...verdict, viaModel: model.id };
  }
  return first;
};

const needsWork = [];
let alreadyGood = 0;
let noPointAtAll = 0;
for (const beach of beaches) {
  if (!beach.currentPoint) { noPointAtAll += 1; continue; }
  const verdict = judgePoint(beach.profile, beach.currentPoint);
  if (verdict.verdict === 'trusted') { alreadyGood += 1; continue; }
  needsWork.push({ ...beach, before: verdict, ladder: candidatesFor(beach), attempts: 0 });
}

console.log(`Marine sample point optimisation`);
console.log(`  beaches            ${beaches.length}`);
console.log(`  already trusted    ${alreadyGood}`);
console.log(`  to work on         ${needsWork.length}  (${needsWork.filter(b => !b.hadOwnPoint).length} of them with no point of their own)`);
if (noPointAtAll) console.log(`  no request point at all: ${noPointAtAll}`);

// ── Round by round: every unfixed beach's next candidate, resolved together ──
const fixed = [];
let pending = needsWork;

for (let round = 0; round < maxRounds && pending.length && !state.quotaHit; round += 1) {
  const tries = [];
  for (const beach of pending) {
    const candidate = beach.ladder[round];
    if (candidate) tries.push({ beach, candidate });
  }
  if (tries.length === 0) break;

  const fresh = await resolvePoints(cache, tries.map(t => t.candidate), {
    state,
    onProgress: (done, total) => process.stdout.write(`\r  round ${round + 1}: fetched ${done}/${total}   `),
  });
  saveCache();

  const stillPending = [];
  let won = 0;
  for (const { beach, candidate } of tries) {
    beach.attempts += 1;
    const verdict = judgePoint(beach.profile, candidate);
    if (verdict.verdict === 'trusted') {
      fixed.push({ beach, candidate, after: verdict, round: round + 1 });
      won += 1;
    } else {
      stillPending.push(beach);
    }
  }
  // A beach whose ladder is exhausted stops here whether or not it was fixed.
  pending = stillPending.filter(b => b.ladder.length > round + 1);
  process.stdout.write(`\r  round ${round + 1}: ${tries.length} candidates, ${fresh} live lookups, ${won} fixed, ${pending.length} still open\n`);
}

if (state.quotaHit) {
  console.error('\n  STOPPED on an API quota reply. Everything resolved so far is cached; re-run to continue.');
}

// ── Report ───────────────────────────────────────────────────────────────────
const fixedIds = new Set(fixed.map(f => f.beach.profile.beachId));
const unfixed = needsWork.filter(b => !fixedIds.has(b.profile.beachId));

console.log(`\n  FIXED     ${fixed.length} of ${needsWork.length}`);
console.log(`  unfixed   ${unfixed.length} — no coordinate on their ladder is served a cell in water they face`);
const viaTally = {};
for (const f of fixed) viaTally[f.candidate.via] = (viaTally[f.candidate.via] || 0) + 1;
console.log(`  winners by bearing: ${Object.entries(viaTally).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
const gained = fixed.filter(f => !f.beach.hadOwnPoint).length;
console.log(`  of the fixed, ${gained} had no point of their own before and now do.`);

console.log('\n  A few of the fixes:');
for (const f of fixed.slice(0, 8)) {
  const p = f.beach.profile;
  console.log(`    ${f.beach.regionId} #${p.beachId} ${(p.name?.gr || '').slice(0, 22).padEnd(23)}`
    + ` ${f.beach.before.verdict} → trusted  (${f.candidate.via}, push ${f.candidate.distanceKm} km, round ${f.round})`);
}

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  method: 'For every beach whose current request point fails the shared trust test, walk a ladder of '
    + 'alternative coordinates (nearest-to-facing sector first, longest push first, pin last), ask '
    + 'the API which cell each is served, and keep the first that passes. Never touches a beach '
    + 'that already passes, and never prefers a nearer cell.',
  beaches: beaches.length,
  alreadyTrusted: alreadyGood,
  needingWork: needsWork.length,
  fixed: fixed.length,
  unfixed: unfixed.length,
  gainedAPointOfTheirOwn: gained,
  winnersByBearing: viaTally,
  applied: apply,
  fixes: fixed.map(f => ({
    beachId: f.beach.profile.beachId,
    region: f.beach.regionId,
    name: f.beach.profile.name?.gr || f.beach.profile.name?.en || '',
    hadOwnPoint: f.beach.hadOwnPoint,
    before: f.beach.before.verdict,
    beforeDistanceKm: typeof f.beach.before.distanceKm === 'number' ? Number(f.beach.before.distanceKm.toFixed(2)) : null,
    // The coordinate the runtime sent before this fix, so the on-screen impact of the swap can be
    // measured against the arm that was actually live rather than against a reconstruction.
    beforePoint: { lat: f.beach.currentPoint.lat, lon: f.beach.currentPoint.lon },
    via: f.candidate.via,
    pushKm: f.candidate.distanceKm,
    round: f.round,
    point: { lat: f.candidate.lat, lon: f.candidate.lon },
  })),
  stillUntrusted: unfixed.map(b => ({
    beachId: b.profile.beachId,
    region: b.regionId,
    name: b.profile.name?.gr || b.profile.name?.en || '',
    hadOwnPoint: b.hadOwnPoint,
    verdict: b.before.verdict,
    candidatesTried: b.attempts,
    ladderLength: b.ladder.length,
  })),
}, null, 2)}\n`, 'utf8');
console.log(`\n  report: ${path.relative(root, REPORT_PATH)}`);

// ── Apply ────────────────────────────────────────────────────────────────────
if (apply && fixed.length) {
  const byBeach = new Map(fixed.map(f => [f.beach.profile.beachId, f]));
  let changed = 0;
  let written = 0;
  for (const file of files) {
    const filePath = path.join(EXPOSURE_DIR, file);
    const payload = JSON.parse(readFileSync(filePath, 'utf8'));
    let dirty = false;
    for (const profile of Object.values(payload.profiles || {})) {
      const win = byBeach.get(profile.beachId);
      if (!win) continue;
      profile.marineSamplePoint = {
        lat: win.candidate.lat,
        lon: win.candidate.lon,
        bearingDeg: win.candidate.bearingDeg,
        distanceKm: win.candidate.distanceKm,
        via: win.candidate.via,
        verified: 'served-cell',
      };
      dirty = true;
      changed += 1;
    }
    if (dirty) { writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); written += 1; }
  }
  console.log(`  applied ${changed} sample points across ${written} region files.`);
  console.log(`  NOTE: buildMarineSamplePoints.mjs will overwrite these if it is re-run. Its own`);
  console.log(`  heuristic does not know about the served cell — run this optimiser after it.`);
}
