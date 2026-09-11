#!/usr/bin/env node
/**
 * Η «ΤΡΥΠΑ ΤΗΣ ΤΣΕΠΗΣ» ΑΠΕΝΑΝΤΙ ΣΤΟΝ ΔΟΡΥΦΟΡΟ — ΠΟΙΕΣ ΠΑΡΑΛΙΕΣ ΕΧΟΥΝ ΔΙΚΙΟ ΚΑΙ ΠΟΙΕΣ ΟΧΙ (11/09/2026).
 * ΜΟΝΟ ΑΝΑΦΟΡΑ — δεν αλλάζει ούτε μία γραμμή παραγωγής.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Στον Μώλο Πάρου #2040 ο κανόνας της τσέπης (utils/seaArrival.resolveSeaArrivalExposureLevel
 * → 'enclosed': κανένας τομέας ≥10 χλμ, νερό <2 χλμ στη γωνία του κύματος, onshore >0,3) τύπωνε 0,1 του
 * ανοιχτού κύματος για 11-25°, ενώ ΚΑΙ από τις δύο μεριές τύπωνε ολόκληρο το ύψος — ασυνέχεια που η φύση
 * δεν έχει. Ο Sentinel-2 είδε αφρό θραύσης μέσα σε αυτή την τρύπα και μπήκε το τόξο μάρτυρα
 * (JUDGE_WITNESSED_ARRIVAL_ARCS, βίβλος §Γ77). Ένα παλιότερο σάρωμα βρήκε ~154 τέτοιες τρύπες (η Λίνδος
 * ανάμεσά τους, όπου η τρύπα είναι αληθινή — κάμερα 29/08). Καμία από τις άλλες δεν είχε κριθεί με τον δορυφόρο.
 *
 * ΠΩΣ.
 *  1. ΓΕΩΜΕΤΡΙΑ με τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις (require-hook όπως scripts/measureMolosArrivalArc.mjs): για
 *     κάθε προφίλ έκθεσης, 0..355° ανά 5°, το κλάσμα που τυπώνει η σελίδα ΑΚΡΙΒΩΣ όπως το `say` του
 *     scripts/exportGeometricShadowKd.mjs: shoreSeaStateM(1, τομέας(deg), resolveSeaArrivalExposureLevel(p,deg),
 *     false, resolveShoreShadowDamping({...p, beachId:-1}, deg)). Το beachId -1 παρακάμπτει τις λίστες
 *     μαρτύρων, άρα φαίνεται η ΩΜΗ γεωμετρία (και ο Μώλος ξαναβγαίνει τρύπα — έλεγχος ότι το όργανο πιάνει).
 *     ΤΡΥΠΑ = συνεχόμενες διευθύνσεις με say ≤ 0,2 ΚΑΙ άφιξη === SEA_ARRIVAL_ENCLOSED, με διεύθυνση say ≥ 0,9
 *     σε ≤15° ΚΑΙ από τις δύο μεριές. Μετριούνται και οι φυσικές παραλλαγές (βήμα, πλάτος, απόσταση πλευρών)
 *     για να φανεί ποιος ορισμός δίνει τις ~154.
 *  2. ΔΟΡΥΦΟΡΟΣ (scripts/auditPocketHoleSatellite.py, καλείται από εδώ): οι ΙΔΙΕΣ συναρτήσεις του κριτή
 *     (judgeShoreSurfSentinel2.measure_beach: αφρός στην εξωτερική λωρίδα 20-30 μ., θόρυβος ήρεμων ημερών,
 *     έλεγχος ίδιας εικόνας), τα ΙΔΙΑ κατώφλια/διωνυμικά του summarizeShoreSurfNational.py και το ΙΔΙΟ
 *     SWIR B11/B08 < 0,62 του verifyShoreFoamSwir.py. Μέρες «μέσα στην τρύπα» = ανοιχτό κύμα ≥0,5 μ. από
 *     διεύθυνση της τρύπας (Copernicus 09 UTC, στρογγύλεμα στις 5° όπως ο κριτής), όλο τον χρόνο (Μάι-Οκτ,
 *     η «κλειστή» σεζόν του κριτή, χωριστά)· μέρες «πλευράς» (τυπώνουμε όλο το ύψος) ως έλεγχος ότι το όργανο
 *     βλέπει εκεί. ΚΑΘΕ ετυμηγορία ξαναβγαίνει μόνο με μέρες που μένουν στην τρύπα και με ±10° — η σελίδα
 *     διαβάζει 5-15° άλλη διεύθυνση από το Copernicus (replay αρχείου προγνώσεων: Μώλος −8°, Καλό Λιμάνι +6-15°),
 *     άρα τρύπα ≤20° δεν μπορεί ούτε να επιβεβαιωθεί ούτε να διαψευστεί με διευθύνσεις Copernicus.
 *  3. ΚΑΤΑΤΑΞΗ ανά παραλία: (a) ο δορυφόρος επιβεβαιώνει ηρεμία μέσα στην τρύπα · (b) αφρός πάνω από τον
 *     θόρυβο (ύποπτη, σαν τον Μώλο) · (c) δεν φτάνουν οι μέρες / θορυβώδης / τυφλή λωρίδα / μικτό.
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - «Καθόλου αφρός» = όχι κύμα που σκάει ~0,5 μ.+, ΟΧΙ «μηδέν κύμα». Ο κριτής ξεχωρίζει «0,1-0,3» από «0,7+»,
 *    όχι «0,1» από «0,3». Άρα (a) λέει «εκεί δεν σκάει κύμα», όχι «το 0,1 είναι ακριβές».
 *  - Στιγμιότυπο ~12:15 τοπική ώρα· κύμα = Copernicus στο πλησιέστερο θαλάσσιο κελί 09 UTC, όχι στην ακτή.
 *    Η διεύθυνση του κελιού μπορεί να απέχει από αυτή που φτάνει στον όρμο.
 *  - Το (b) είναι στατιστική υποψία ώσπου να περάσει SWIR ΚΑΙ μάτι· δεν αλλάζει τίποτα στην παραγωγή.
 *    Νέο τόξο μάρτυρα θέλει παρατήρηση στην ακτή ΚΑΙ απόφαση Μίλτου (βλ. utils/seaArrival.ts).
 *  - Δεν κρίνει τι τυπώνει η κάρτα μετά από ταβάνια/δάπεδα/φρουρό όρμου — μόνο το σκέλος σκιάς.
 *  - Υπόθεση ανέμου: ο τομέας διαβάζεται στη διεύθυνση του ΚΥΜΑΤΟΣ (άνεμος από την ίδια μεριά). Η τρύπα
 *    δεν εξαρτάται από αυτό· οι «σιωπηλές» πλευρές (onshore ≤0,3) ναι — βλ. sampleAt.
 *
 * ΜΕΤΡΗΘΗΚΕ 11/09/2026 (reports/wave-model/pocket-hole-satellite.json):
 *  - Ορισμός όπως ζητήθηκε → 250 παραλίες / 370 τρύπες (απόσταση πλευράς 5-20° δεν αλλάζει τίποτα: στην τσέπη
 *    το say είναι σχεδόν δυαδικό, 0,1 ή 1). Οι ~154 του παλιού σαρώματος = τρύπες ως 30° πλάτος (ακριβώς 154,
 *    με Μώλο ΚΑΙ Λίνδο)· το βήμα 22,5° δίνει 152 αλλά χάνει τη Λίνδο. 335/370 τρύπες έχουν μία πλευρά που
 *    τυπώνει όλο το ύψος ΜΟΝΟ λόγω υπόθεσης ανέμου (σιωπηλή άφιξη)· 6 έχουν και τις δύο πλευρές ανεξάρτητες.
 *  - Δορυφόρος: 105/238 παραλίες με εικόνες έχουν 0 μέρες μέσα στην τρύπα, 51 έχουν 1-2. Κατάταξη:
 *    (a) 4 · (b) 3 · (c) 243. Κανένα (b) δεν αντέχει ±10° — ούτε ο ίδιος ο Μώλος (τρύπα 15°).
 *    Λίμνες Πάρου #2034: 16 μέρες αφρού με υπογραφή SWIR (χειμώνας, βοριάς 358-10°), αλλά οι 13 φεύγουν από
 *    την τρύπα με −10° και το καλοκαίρι δεν ξεχωρίζει από τον θόρυβο της λωρίδας. Λίνδος: (c), 0/13 μέρες αφρού
 *    χωρίς κανέναν έλεγχο ότι το όργανο βλέπει εκεί.
 *  - Σε όλες τις τσέπες η άμμος αφρίζει σπάνια ακόμα κι εκεί που τυπώνουμε όλο το ύψος (πλευρές 2,4-3,8%,
 *    τρύπα 3,7%, ήρεμες 1,6%): το όργανο σπάνια ξεχωρίζει τρύπα από πλευρά σε αυτές τις παραλίες.
 *
 *   node scripts/auditPocketHoleAgainstSatellite.mjs                  (όλο: γεωμετρία → δορυφόρος → αναφορά)
 *   node scripts/auditPocketHoleAgainstSatellite.mjs --geometry-only  (μόνο οι τρύπες → .tmp/pocket-hole/holes.json)
 *   node scripts/auditPocketHoleAgainstSatellite.mjs --reuse-imagery  (ξαναγράφει την αναφορά από .tmp/pocket-hole/satellite.json)
 *   → reports/wave-model/pocket-hole-satellite.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { resolveShoreShadowDamping, resolveSeaArrivalExposureLevel, SEA_ARRIVAL_ENCLOSED, JUDGE_WITNESSED_ARRIVAL_ARCS } =
  require(path.join(root, 'utils/seaArrival.ts'));
const { shoreSeaStateM } = require(path.join(root, 'utils/waveCharacter.ts'));

const GEOMETRY_ONLY = process.argv.includes('--geometry-only');
const REUSE_IMAGERY = process.argv.includes('--reuse-imagery');
const WORK = path.join(root, '.tmp/pocket-hole');
const HOLES_PATH = path.join(WORK, 'holes.json');
const SAT_PATH = path.join(WORK, 'satellite.json');
const REPORT_PATH = path.join(root, 'reports/wave-model/pocket-hole-satellite.json');

// Ίδια κατώφλια με τον κριτή (judgeShoreSurfSentinel2.CLOSED_KD / OPEN_KD): «λέμε ήρεμη» ≤ 1/5, «λέμε όλο» ≥ 0,9.
const LOW_SAY = 0.2;
const FULL_SAY = 0.9;
const FLANK_MAX_DEG = 15;
const STEP = 5;
const N = 360 / STEP;
// Η παραλλαγή που αναπαράγει το παλιό σάρωμα (βλ. έξοδο «παραλλαγές»): τρύπα ως 6 δείγματα των 5° (≤30°).
const NARROW_MAX_SAMPLES = 6;
// Μετατόπιση διεύθυνσης που πρέπει να αντέξει μια μαρτυρία (σελίδα vs Copernicus, βλ. coreDirs) και το
// πλάτος κάτω από το οποίο καμία μέρα δεν μένει μέσα και με +10° και με −10° (≤4 δείγματα = ≤20°).
const SHIFT_DEG = 10;
const UNDER20_MAX_SAMPLES = 4;

// Ο άνεμος διαβάζεται από τον τομέα της διεύθυνσης του κύματος — ΙΔΙΟ με exportGeometricShadowKd.mjs.
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorLevelAt = (profile, deg) => profile?.sectors?.[SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]]?.level;

// ── 1. προφίλ + ονόματα/πινέζες από τα αρχεία της εφαρμογής ─────────────────
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const profiles = [];
for (const f of readdirSync(exposureDir).filter((n) => n.endsWith('.json'))) {
  let d; try { d = JSON.parse(readFileSync(path.join(exposureDir, f), 'utf8')); } catch { continue; }
  const list = Array.isArray(d) ? d : Array.isArray(d?.profiles) ? d.profiles : (d?.profiles ? Object.values(d.profiles) : []);
  for (const p of list) if (typeof p?.beachId === 'number') profiles.push({ p, region: f.replace(/\.json$/, '') });
}
const appBeach = new Map();
const appDir = path.join(root, 'public/data/beaches/app');
for (const f of readdirSync(appDir).filter((n) => n.endsWith('.json'))) {
  let d; try { d = JSON.parse(readFileSync(path.join(appDir, f), 'utf8')); } catch { continue; }
  for (const b of d?.island?.beaches ?? []) {
    if (typeof b?.id === 'number') appBeach.set(b.id, { region: f.replace(/\.json$/, ''), name: b.name?.gr ?? b.name?.en ?? String(b.id), nameEn: b.name?.en ?? null, lat: b.coordinates?.lat, lon: b.coordinates?.lon, beachType: b.beachType ?? null });
  }
}

// ── 2. γεωμετρία ανά 5°, με τις πραγματικές συναρτήσεις ─────────────────────
/**
 * ΥΠΟΘΕΣΗ ΑΝΕΜΟΥ (δηλωμένη, 11/09): το `say` διαβάζει το επίπεδο του τομέα απ' όπου έρχεται το ΚΥΜΑ —
 * δηλαδή «ο άνεμος φυσάει από την ίδια μεριά με τη θάλασσα» (μελτέμι/θάλασσα ανέμου), όπως το
 * exportGeometricShadowKd.mjs και ο πανελλαδικός κριτής. Τι εξαρτάται από αυτό:
 *   • η ίδια η τρύπα ('enclosed') ΔΕΝ εξαρτάται: ο κανόνας της τσέπης αγνοεί το επίπεδο ανέμου·
 *   • πλευρά με άφιξη 'partial'/'exposed' ΔΕΝ εξαρτάται: η άφιξη αρνείται την έκπτωση με κάθε άνεμο·
 *   • πλευρά «σιωπηλή» (onshore ≤0,3 → undefined) ή 'grazing' ΕΞΑΡΤΑΤΑΙ: με άνεμο από τομέα 'protected'
 *     (π.χ. απόγειο) η σελίδα τυπώνει εκεί K_d — στην τσέπη 0,1 σε ΟΛΕΣ τις διευθύνσεις — και η τρύπα
 *     ενώνεται με την πλευρά της. Μετριέται με `levelOverride` ('protected' / 'exposed' παντού).
 */
const sampleAt = (p, deg, levelOverride) => {
  const kd = resolveShoreShadowDamping({ ...p, beachId: -1 }, deg);
  const arrival = resolveSeaArrivalExposureLevel(p, deg);
  const say = shoreSeaStateM(1, levelOverride ?? sectorLevelAt(p, deg), arrival, false, kd);
  return { kd: typeof kd === 'number' ? kd : null, arrival: arrival ?? null, say: typeof say === 'number' ? say : null };
};

/** Όλες οι τρύπες ενός προφίλ σε βήμα `step`, πλευρές σε ≤ `flankDeg`. `inRun` διαλέγει τα μέλη της τρύπας. */
function findHoles(p, { step = STEP, flankDeg = FLANK_MAX_DEG, inRun = 'enclosed', needEnclosed = false, levelOverride } = {}) {
  const n = Math.round(360 / step);
  const s = Array.from({ length: n }, (_, i) => sampleAt(p, i * step, levelOverride));
  const ix = (i) => ((i % n) + n) % n;
  const member = (i) => s[i].say !== null && s[i].say <= LOW_SAY && (inRun === 'enclosed' ? s[i].arrival === SEA_ARRIVAL_ENCLOSED : true);
  const out = [];
  if (s.every((_, i) => member(i))) return { samples: s, holes: out }; // κλειστός κύκλος: δεν έχει πλευρές
  const maxSteps = Math.max(1, Math.floor(flankDeg / step + 1e-9));
  for (let i = 0; i < n; i += 1) {
    if (!member(i) || member(ix(i - 1))) continue;
    const band = [];
    for (let k = i; member(ix(k)) && band.length < n; k += 1) band.push(ix(k));
    if (needEnclosed && !band.some((k) => s[k].arrival === SEA_ARRIVAL_ENCLOSED)) continue;
    const flankSide = (from, dirSign) => {
      const dirs = [];
      let first = null;
      for (let t = 1; t <= maxSteps; t += 1) {
        const k = ix(from + dirSign * t);
        if (s[k].say !== null && s[k].say >= FULL_SAY) { dirs.push(k); if (first === null) first = k; }
      }
      return { first, dirs };
    };
    const left = flankSide(band[0], -1);
    const right = flankSide(band[band.length - 1], +1);
    if (left.first === null || right.first === null) continue;
    const bandDeg = band.map((k) => k * step);
    // «Πυρήνας»: διευθύνσεις που μένουν μέσα στην ΙΔΙΑ τρύπα και με ±10° — η διεύθυνση που διαβάζει η σελίδα
    // απέχει 5-15° από του Copernicus (replay αρχείου προγνώσεων: Μώλος −8° διάμεσος, Καλό Λιμάνι +6-15°).
    const inBand = (d) => bandDeg.includes(((Math.round(d / step) * step) % 360 + 360) % 360);
    out.push({
      band: bandDeg,
      coreDirs: bandDeg.filter((d) => inBand(d - SHIFT_DEG) && inBand(d + SHIFT_DEG)),
      fromDeg: band[0] * step, toDeg: band[band.length - 1] * step, samples: band.length,
      leftFlankDeg: left.first * step, rightFlankDeg: right.first * step,
      leftFlankArrival: s[left.first].arrival, rightFlankArrival: s[right.first].arrival,
      flankDirs: [...left.dirs, ...right.dirs].map((k) => k * step),
    });
  }
  return { samples: s, holes: out };
}

const t0 = Date.now();
const geo = profiles.map(({ p, region }) => ({ p, region, ...findHoles(p) }));
const holeBeaches = geo.filter((g) => g.holes.length);
const isNarrow = (g) => g.holes.some((h) => h.samples <= NARROW_MAX_SAMPLES);

// Παραλλαγές: ποιος ορισμός δίνει τις ~154;
const variantDefs = [
  ['as specified: run(say≤0,2 & enclosed) at 5°, both flanks say≥0,9 within ≤15°', { }],
  ['flanks adjacent (5°)', { flankDeg: 5 }],
  ['flanks within ≤10°', { flankDeg: 10 }],
  ['flanks within ≤20°', { flankDeg: 20 }],
  ['run = any say≤0,2 containing an enclosed direction', { inRun: 'any', needEnclosed: true }],
  ['run = any say≤0,2 (no enclosed requirement)', { inRun: 'any' }],
  ['step 1°', { step: 1 }],
  ['step 10°', { step: 10 }],
  ['step 15°', { step: 15 }],
  ['step 22,5°', { step: 22.5 }],
  ['step 30° (12 directions)', { step: 30 }],
  ['wind from a \'protected\' sector at every direction (offshore breeze)', { levelOverride: 'protected' }],
  ['wind from an \'exposed\' sector at every direction', { levelOverride: 'exposed' }],
];
const variants = variantDefs.map(([name, opts]) => {
  const hit = profiles.map(({ p }) => ({ id: p.beachId, h: findHoles(p, opts).holes })).filter((x) => x.h.length);
  return { name, beaches: hit.length, holes: hit.reduce((a, x) => a + x.h.length, 0), molos: hit.some((x) => x.id === 2040), lindos: hit.some((x) => x.id === 2443) };
});
for (const maxS of [3, 4, 5, 6, 9, 12]) {
  const hit = holeBeaches.filter((g) => g.holes.some((h) => h.samples <= maxS));
  variants.push({ name: `as specified, only holes ≤${maxS * STEP}° wide (≤${maxS} samples of 5°)`, beaches: hit.length,
    holes: hit.reduce((a, g) => a + g.holes.filter((h) => h.samples <= maxS).length, 0),
    molos: hit.some((g) => g.p.beachId === 2040), lindos: hit.some((g) => g.p.beachId === 2443) });
}
const widthHistogram = {};
for (const g of holeBeaches) for (const h of g.holes) widthHistogram[h.samples * STEP] = (widthHistogram[h.samples * STEP] ?? 0) + 1;
const flankKinds = {};
for (const g of holeBeaches) for (const h of g.holes) {
  const k = `${h.leftFlankArrival ?? 'silent(onshore≤0,3)'} | ${h.rightFlankArrival ?? 'silent(onshore≤0,3)'}`;
  flankKinds[k] = (flankKinds[k] ?? 0) + 1;
}
// Πλευρά που κρατά «όλο το ύψος» με ΚΑΘΕ άνεμο = η άφιξη εκεί είναι 'partial'/'exposed' (αρνείται την έκπτωση).
const windIndependentFlank = (arrival) => arrival === 'partial' || arrival === 'exposed';
const holesTotal = holeBeaches.reduce((a, g) => a + g.holes.length, 0);
const holeWidthStats = {
  holes: holesTotal,
  under20: holeBeaches.reduce((a, g) => a + g.holes.filter((h) => h.samples <= UNDER20_MAX_SAMPLES).length, 0),
  beachesAllHolesUnder20: holeBeaches.filter((g) => g.holes.every((h) => h.samples <= UNDER20_MAX_SAMPLES)).length,
  beachesWithNoCoreDirection: holeBeaches.filter((g) => g.holes.every((h) => !h.coreDirs.length)).length,
  holesBothFlanksWindIndependent: holeBeaches.reduce((a, g) => a + g.holes.filter((h) => windIndependentFlank(h.leftFlankArrival) && windIndependentFlank(h.rightFlankArrival)).length, 0),
  holesOneFlankWindDependent: holeBeaches.reduce((a, g) => a + g.holes.filter((h) => windIndependentFlank(h.leftFlankArrival) !== windIndependentFlank(h.rightFlankArrival)).length, 0),
  holesBothFlanksWindDependent: holeBeaches.reduce((a, g) => a + g.holes.filter((h) => !windIndependentFlank(h.leftFlankArrival) && !windIndependentFlank(h.rightFlankArrival)).length, 0),
};

const holesOut = holeBeaches.map((g) => {
  const a = appBeach.get(g.p.beachId) ?? {};
  const holeDirs = [...new Set(g.holes.flatMap((h) => h.band))].sort((x, y) => x - y);
  const flankDirs = [...new Set(g.holes.flatMap((h) => h.flankDirs))].filter((d) => !holeDirs.includes(d)).sort((x, y) => x - y);
  return {
    id: g.p.beachId, region: g.region, appRegion: a.region ?? null, name: a.name ?? g.p.name?.gr ?? String(g.p.beachId), nameEn: a.nameEn ?? g.p.name?.en ?? null,
    lat: a.lat ?? g.p.coordinates?.lat ?? null, lon: a.lon ?? g.p.coordinates?.lon ?? null, beachType: a.beachType ?? null,
    facingDeg: g.p.facingDeg ?? null, confidence: g.p.confidence ?? null,
    say: g.samples.map((x) => x.say), kd: g.samples.map((x) => x.kd), arrival: g.samples.map((x) => x.arrival),
    holes: g.holes.map((h) => ({ ...h, widthDeg: h.samples * STEP, under20: h.samples <= UNDER20_MAX_SAMPLES,
      leftFlankWindIndependent: windIndependentFlank(h.leftFlankArrival), rightFlankWindIndependent: windIndependentFlank(h.rightFlankArrival) })),
    holeDirs, flankDirs, coreDirs: [...new Set(g.holes.flatMap((h) => h.coreDirs))].sort((x, y) => x - y),
    narrow: isNarrow(g), allHolesUnder20: g.holes.every((h) => h.samples <= UNDER20_MAX_SAMPLES),
    liveArc: JUDGE_WITNESSED_ARRIVAL_ARCS.has(g.p.beachId),
  };
});
mkdirSync(WORK, { recursive: true });
writeFileSync(HOLES_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), stepDeg: STEP, lowSay: LOW_SAY, fullSay: FULL_SAY, flankMaxDeg: FLANK_MAX_DEG, beaches: holesOut }));

console.log(`\nΓΕΩΜΕΤΡΙΑ (${profiles.length} προφίλ, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(`  με έστω μία διεύθυνση 'enclosed': ${geo.filter((g) => g.samples.some((x) => x.arrival === SEA_ARRIVAL_ENCLOSED)).length}`);
console.log(`  ΤΡΥΠΕΣ (ορισμός όπως ζητήθηκε): ${holeBeaches.length} παραλίες · ${holeBeaches.reduce((a, g) => a + g.holes.length, 0)} τρύπες · στενές ≤30°: ${holeBeaches.filter(isNarrow).length}`);
console.log('  παραλλαγές:');
for (const v of variants) console.log(`    ${v.name.padEnd(78)} ${String(v.beaches).padStart(4)} παραλίες · ${String(v.holes).padStart(4)} τρύπες · Μώλος ${v.molos ? 'ναι' : 'όχι'} · Λίνδος ${v.lindos ? 'ναι' : 'όχι'}`);
console.log(`  πλάτος τρύπας (μοίρες = δείγματα×5): ${JSON.stringify(widthHistogram)}`);
console.log(`  είδος πλευρών (αριστερή | δεξιά): ${JSON.stringify(flankKinds)}`);
console.log(`  πλάτος/άνεμος: ${JSON.stringify(holeWidthStats)}`);
if (GEOMETRY_ONLY) { console.log(`→ ${path.relative(root, HOLES_PATH)}`); process.exit(0); }

// ── 3. δορυφόρος (python: ίδιος κριτής, ίδια στατιστική, ίδιο SWIR) ────────────
if (!REUSE_IMAGERY || !existsSync(SAT_PATH)) {
  const py = process.env.PYTHON || 'python';
  const r = spawnSync(py, [path.join(root, 'scripts/auditPocketHoleSatellite.py')], { cwd: root, stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) { console.error('ο βοηθός δορυφόρου απέτυχε — δες το μήνυμα από πάνω'); process.exit(1); }
}
const sat = JSON.parse(readFileSync(SAT_PATH, 'utf8'));

// ── 4. ό,τι είδαμε ΜΕ ΤΟ ΜΑΤΙ (11/09/2026) — καταγραφή, όχι μέτρηση ─────────────
// Κάθε γραμμή: μέρα + εικόνα που κοιτάχτηκε (scripts/renderShoreSurfChip.py → .tmp/s2judge/png/) και τι φάνηκε.
const EYE_CHECKS = {
  2034: [
    { day: '2025-01-19', chip: '.tmp/s2judge/png/2034-2025-01-19.png', wave: '1,06 m from 359°, Tp 4,7 s', swir: 0.37,
      seen: 'B08: continuous bright band hugging the beach inside the 300 m circle; true colour: pale water with shore-parallel whitish lines. Consistent with breaking surf. Bay water elsewhere dark (a few cloud blobs over the bay, not on the strip).' },
    { day: '2022-10-22', chip: '.tmp/s2judge/png/2034-2022-10-22.png', wave: '1,19 m from 358°, Tp 5,2 s (in season)', swir: 0.46,
      seen: 'B08: only a thin grey band along the beach; true colour: light-turquoise shallows, no clear white lines. By eye NOT separable from the calm-day false band of 2026-05-06.' },
    { day: '2026-05-06', chip: '.tmp/s2judge/png/2034-2026-05-06.png', wave: 'CALM day, 0,14 m from 257°', swir: null,
      seen: 'Same grey band along the beach and a grey (not black) bay in B08 — the strip lights up without surf (5/26 calm days "foam" here).' },
    { day: '2024-09-28', chip: '.tmp/s2judge/png/2034-2024-09-28.png', wave: 'CALM day, 0,13 m from 355°', swir: null,
      seen: 'Strip black in B08 — the clean reference.' },
  ],
  1237: [
    { day: '2026-01-12', chip: '.tmp/s2judge/png/1237-2026-01-12.png', wave: '1,01 m from 308°, Tp 9,2 s (long-period swell)', swir: 0.47,
      seen: 'True colour: white surf along the whole NW-facing coast, including a white patch at the pin. Real surf — but the only SWIR-real day (2022-09-18 was 0,999 = land/cloud), so the ≥2-day rule is not met.' },
  ],
};

// ── 5. αναφορά ─────────────────────────────────────────────────────────────
const holeById = new Map(holesOut.map((h) => [h.id, h]));
const rows = sat.beaches.map((b) => ({ ...b, geometry: holeById.get(b.id) }));
const count = (list) => list.reduce((a, r) => { a[r.class] = (a[r.class] ?? 0) + 1; return a; }, {});
const reasons = (list) => list.filter((r) => r.class === 'c').reduce((a, r) => { a[r.reason] = (a[r.reason] ?? 0) + 1; return a; }, {});
const detail = (list) => ({
  n: list.length, ...count(list), cReasons: reasons(list),
  a_split: {
    survivesShift10: list.filter((r) => r.class === 'a' && r.survivesShift10).length,
    directionSensitive: list.filter((r) => r.class === 'a' && !r.survivesShift10).length,
    capabilityNotShown: list.filter((r) => r.class === 'a' && r.reason === 'sameImageShadowCapabilityNotShown').length,
  },
  b_split: {
    swirConfirmed: list.filter((r) => r.class === 'b' && r.flags.includes('swirConfirmed')).length,
    swirConfirmedAndSurvivesShift10: list.filter((r) => r.class === 'b' && r.flags.includes('swirConfirmed') && r.survivesShift10).length,
  },
  allHolesUnder20: list.filter((r) => r.geometry?.allHolesUnder20).length,
});
const classCounts = {
  allHoleBeaches: detail(rows),
  narrow154: detail(rows.filter((r) => r.geometry?.narrow)),
};
// Πόσες μέρες μέσα στην τρύπα έχει στ' αλήθεια κάθε παραλία — το όριο της απόδειξης σε έναν αριθμό.
const bucket = (n) => (n == null ? 'noImagery' : n === 0 ? '0' : n <= 2 ? '1-2' : n <= 9 ? '3-9' : '10+');
const usableHoleDays = { allYear: {}, season: {}, coreAllYear: {} };
for (const r of rows) {
  usableHoleDays.allYear[bucket(r.stats?.hole?.n)] = (usableHoleDays.allYear[bucket(r.stats?.hole?.n)] ?? 0) + 1;
  usableHoleDays.season[bucket(r.stats?.holeSeason?.n)] = (usableHoleDays.season[bucket(r.stats?.holeSeason?.n)] ?? 0) + 1;
  usableHoleDays.coreAllYear[bucket(r.stats?.hole?.shift10?.coreDays)] = (usableHoleDays.coreAllYear[bucket(r.stats?.hole?.shift10?.coreDays)] ?? 0) + 1;
}
const compact = (r) => ({
  id: r.id, name: r.geometry?.name, region: r.geometry?.region, beachType: r.geometry?.beachType, narrow: r.geometry?.narrow,
  allHolesUnder20: r.geometry?.allHolesUnder20,
  holes: r.geometry?.holes.map((h) => ({ fromDeg: h.fromDeg, toDeg: h.toDeg, widthDeg: h.widthDeg, under20: h.under20, coreDirs: h.coreDirs,
    leftFlankDeg: h.leftFlankDeg, rightFlankDeg: h.rightFlankDeg, leftFlankArrival: h.leftFlankArrival, rightFlankArrival: h.rightFlankArrival,
    leftFlankWindIndependent: h.leftFlankWindIndependent, rightFlankWindIndependent: h.rightFlankWindIndependent })),
  class: r.class, reason: r.reason, classSeason: r.classSeason, reasonSeason: r.reasonSeason,
  survivesShift10: r.survivesShift10 ?? null, stats: r.stats, flags: r.flags,
});
const byClass = (c) => rows.filter((r) => r.class === c);
const pick = (id) => rows.find((r) => r.id === id);
const report = {
  generatedAt: new Date().toISOString(),
  script: 'scripts/auditPocketHoleAgainstSatellite.mjs', helper: 'scripts/auditPocketHoleSatellite.py',
  question: 'At beaches where the pocket rule (arrival class \'enclosed\') prints ≤0,2 of the open sea for a band of wave directions while both sides of the band print ≥0,9, does Sentinel-2 see breaking foam inside the band?',
  definition: {
    say: 'shoreSeaStateM(1, sectorLevelAt(p,deg), resolveSeaArrivalExposureLevel(p,deg), false, resolveShoreShadowDamping({...p, beachId:-1}, deg)) — identical to scripts/exportGeometricShadowKd.mjs `say`; beachId -1 bypasses witness lists (raw geometry)',
    hole: `maximal circular run of 5° directions with say ≤ ${LOW_SAY} AND resolveSeaArrivalExposureLevel === '${SEA_ARRIVAL_ENCLOSED}', with a direction of say ≥ ${FULL_SAY} within ≤${FLANK_MAX_DEG}° on BOTH sides`,
    flankDirs: `directions with say ≥ ${FULL_SAY} within ≤${FLANK_MAX_DEG}° outside a hole edge`,
    narrow154: `beach has a hole of ≤${NARROW_MAX_SAMPLES} samples (≤${NARROW_MAX_SAMPLES * STEP}°) — the variant that reproduces the earlier ~154 count`,
    dayInHole: 'Copernicus MEDSEA 09 UTC direction rounded to the 5° grid exactly as the judge (int(round(dir/5))%72) falls in the hole',
    windAssumption: 'sectorLevelAt(p,deg) reads the exposure level of the sector the WAVE comes from, i.e. it assumes the wind blows from the same sector as the sea (wind-sea / meltemi case) — as exportGeometricShadowKd.mjs and the national judge. The enclosed band itself is wind-independent (the pocket rule ignores the wind level); a flank whose arrival is partial/exposed is wind-independent (arrival refuses the discount); a flank that is silent (onshore ≤0,3) or grazing depends on the wind: with wind from a protected sector the page prints K_d there too (0,1 everywhere at a pocket — K_d is the 0,1 floor at ALL directions of a pocket, not only in the band) and the hole merges with that flank. Counts under forced protected/exposed wind are in geometry.variants.',
    shiftDeg: `${SHIFT_DEG} — the site reads a different wave direction than Copernicus (archive replay: Μώλος −8° median, Καλό Λιμάνι +6-15°). coreDirs = hole directions that stay inside the same hole at ±${SHIFT_DEG}°; a hole ≤${UNDER20_MAX_SAMPLES * STEP}° wide has none, so it cannot be confirmed or refuted from Copernicus directions alone.`,
  },
  geometry: {
    profiles: profiles.length,
    beachesWithAnEnclosedDirection: geo.filter((g) => g.samples.some((x) => x.arrival === SEA_ARRIVAL_ENCLOSED)).length,
    holeBeaches: holeBeaches.length, holes: holeBeaches.reduce((a, g) => a + g.holes.length, 0),
    narrowHoleBeaches: holeBeaches.filter(isNarrow).length,
    variants, widthHistogramDeg: widthHistogram, flankKinds, holeWidthStats,
  },
  satellite: sat.method,
  instrument: sat.instrument,
  classCounts,
  usableHoleDays,
  classMeaning: {
    a: 'satellite confirms calm inside the hole, no significant foam, AND either (route 1, judgeShoreSurfSentinel2.summarize) ≥3 judged hole days with dark strip (beachFoam <0,05) while the same image shows SWIR-verified surf on the coast facing that wave, dark ≥ 2× real-foam days; or (route 2, summarizeShoreSurfArrival.py) arrival ratio R ≤0,25 against this beach\'s own full-print days (strip foams there by ≥0,05 over calm, ≥3 hole days ≥0,8 m)',
    b: 'foam inside the hole beyond this beach\'s own calm-day noise (binomial, summarizeShoreSurfNational rule: p<0,01 & ≥3 days = ΣΚΑΕΙ, p<0,05 & ≥2 = ΠΙΘΑΝΟ), then SWIR B11/B08 on each foam day (verifyShoreFoamSwir rule: ≥2 real-foam days & p<0,05 after dropping bright-not-foam days)',
    c: 'not enough usable days / noisy strip / strip blind on full-print days / mixed evidence',
  },
  classB: byClass('b').map((r) => ({ ...compact(r), evidence: r.evidence, eyeCheck: EYE_CHECKS[r.id] ?? null })),
  sanity: {
    lindos2443: pick(2443) ? { ...compact(pick(2443)), evidence: pick(2443).evidence } : null,
    molos2040: pick(2040) ? { ...compact(pick(2040)), evidence: pick(2040).evidence, eyeCheck: EYE_CHECKS[2040] ?? null } : null,
  },
  classA: byClass('a').map((r) => ({ ...compact(r), eyeCheck: EYE_CHECKS[r.id] ?? null })),
  beachesTable: '__TABLE__',
  limits: sat.limits,
  notVerified: [
    'Whether 0,1 of the open sea is the right NUMBER inside any hole — the foam test only separates "no surf" from "surf ≥~0,5 m".',
    'The site\'s own wave direction per day: holes were tested with Copernicus 09 UTC directions; the ±10° core test is a bound, not the site\'s real offset at each beach (measured only at Μώλος −8° and Καλό Λιμάνι +6-15°).',
    'Wind: the geometry assumes wind from the wave\'s own sector; days were NOT filtered by the actual wind, so silent/grazing flank days mix wind regimes.',
    'Hole days in (0,2; 0,9) directions were not collected, so a ±10° shift of a narrow band can meet unmeasured directions.',
    'Chips were inspected by eye only for the class-(b) beaches (Λίμνες 4 chips, Αμμούδι 1); class-(a) beaches were not inspected by eye.',
    'Μώλος was not re-inspected here (its chips and SWIR are in reports/wave-model/shore-surf-swir-check.json, §Γ77).',
    'What the card prints after caps/floors/cove guard (only the shadow branch of shoreSeaStateM is tested); no production code was run end-to-end.',
  ],
};
// Όλες οι παραλίες σε πίνακα, μία γραμμή η καθεμία — η αναφορά ζει σε δημόσιο repo και πρέπει να μένει μικρή
// (ίδια λογική με το judgedTable του shore-surf-national.json). Όλα τα πεδία: .tmp/pocket-hole/satellite.json.
const TABLE_COLUMNS = ['id', 'name', 'region', 'beachType', 'narrow154', 'allHolesUnder20', 'holes(from-to/width;flanks)', 'class', 'reason',
  'classSeason', 'survivesShift10', 'holeDays', 'holeSurf', 'swirReal', 'swirFake', 'p', 'shadowSwirOk', 'arrivalR', 'coreDays',
  'calmDays', 'calmSurf', 'flankDays', 'flankSurf', 'fullPrintDays', 'fullPrintSurf', 'stripSeesFoam', 'flags'];
const tableRow = (r) => {
  const g = r.geometry; const s = r.stats; const h = s?.hole;
  return [r.id, g?.name, g?.region, g?.beachType, g?.narrow, g?.allHolesUnder20,
    g?.holes.map((x) => `${x.fromDeg}-${x.toDeg}/${x.widthDeg}°;${x.leftFlankArrival ?? 'silent'}|${x.rightFlankArrival ?? 'silent'}`).join(' '),
    r.class, r.reason, r.classSeason ?? null, r.survivesShift10 ?? null, h?.n ?? null, h?.surf ?? null, h?.swir?.real ?? null, h?.swir?.fake ?? null,
    h?.p ?? null, h?.shadowSwirOk ?? null, h?.arrivalRatio?.R ?? null, h?.shift10?.coreDays ?? null,
    s?.calm?.n ?? null, s?.calm?.surf ?? null, s?.flank?.n ?? null, s?.flank?.surf ?? null, s?.fullPrint?.n ?? null, s?.fullPrint?.surf ?? null,
    s?.fullPrint?.sees ?? null, (r.flags ?? []).join(';')];
};
const tableJson = `{"columns": ${JSON.stringify(TABLE_COLUMNS)},\n  "rows": [\n  ${rows.map((r) => JSON.stringify(tableRow(r))).join(',\n  ')}\n ]}`;
mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 1).replace('"__TABLE__"', tableJson)}\n`);

console.log('\nΚΑΤΑΤΑΞΗ');
for (const [k, v] of Object.entries(classCounts)) console.log(`  ${k}: ${JSON.stringify(v)}`);
console.log(`  μέρες μέσα στην τρύπα ανά παραλία: ${JSON.stringify(usableHoleDays)}`);
console.log('\n(a) Ο ΔΟΡΥΦΟΡΟΣ ΕΠΙΒΕΒΑΙΩΝΕΙ ΗΡΕΜΙΑ:');
for (const r of byClass('a')) {
  const h = r.stats.hole;
  console.log(`  #${r.id} ${r.geometry?.name} (${r.geometry?.region}) τρύπα ${r.geometry?.holes.map((x) => `${x.fromDeg}-${x.toDeg}°`).join(', ')} · ${r.reason} · αφρός ${h.surf}/${h.n} · σκιά-με-έλεγχο ${h.shadowSwirOk} · R ${h.arrivalRatio.R} · ±10° αντέχει: ${r.survivesShift10}`);
}
console.log('\n(b) ΥΠΟΠΤΕΣ — αφρός μέσα στην τρύπα:');
for (const r of byClass('b')) {
  const s = r.stats;
  const sh = s.hole.shift10;
  console.log(`  #${r.id} ${r.geometry?.name} (${r.geometry?.region}) τρύπα ${r.geometry?.holes.map((h) => `${h.fromDeg}-${h.toDeg}°`).join(', ')} · αφρός ${s.hole.surf}/${s.hole.n} (SWIR αληθινός ${s.hole.swir.real}, φωτεινό-όχι-αφρός ${s.hole.swir.fake}) · ήρεμες ${s.calm.surf}/${s.calm.n} · p=${s.hole.p} → SWIR ${s.hole.swir.verdict} · ±10°: μένουν ${sh.stillInsideMinus10}/${sh.stillInsidePlus10}/${sh.stillInsideBoth} (−10/+10/και τα δύο) → ${r.survivesShift10 ? 'ΑΝΤΕΧΕΙ' : 'δεν αντέχει'}`);
}
const ag = sat.instrument?.surfRatesNonNoisy;
if (ag) {
  const pct = ([k, n]) => `${k}/${n} (${n ? ((100 * k) / n).toFixed(1) : '—'}%)`;
  console.log(`\nΑΦΡΟΣ ΣΤΗΝ ΑΜΜΟ (μη θορυβώδεις λωρίδες): τρύπα (όλο τον χρόνο) ${pct(ag.hole)} · πλευρά «όλο το ύψος με κάθε άνεμο» ${pct(ag.flankIndependent)} · πλευρά «μόνο με άνεμο από τη μεριά του κύματος» ${pct(ag.flankWindDependent)} · ήρεμες ${pct(ag.calm)}`);
}
for (const id of [2040, 2443]) {
  const r = pick(id);
  const h = r?.stats?.hole;
  console.log(`\nέλεγχος #${id} ${r?.geometry?.name ?? ''}: ${h ? `${r.class} (${r.reason}) · αφρός ${h.surf}/${h.n} (SWIR ${h.swir.real}/${h.swir.fake}) · σκοτεινή-με-έλεγχο ${h.shadowSwirOk} · R ${h.arrivalRatio.R} (${h.arrivalRatio.verdict}) · p=${h.p} · ±10° αντέχει: ${r.survivesShift10} · Μάι-Οκτ: ${r.classSeason} (${r.reasonSeason})` : (r ? `${r.class} (${r.reason})` : 'δεν είναι στις τρύπες')}`);
}
console.log(`\nΑναφορά: ${path.relative(root, REPORT_PATH)}`);
