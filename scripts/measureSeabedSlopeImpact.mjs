/**
 * ΑΞΙΖΕΙ ΝΑ ΞΥΠΝΗΣΕΙ Ο ΒΥΘΟΣ; ΜΕΤΡΗΣΗ ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ ΠΑΡΑΓΩΓΗΣ (22/08/2026).
 *
 * ΤΟ ΕΥΡΗΜΑ. Το `services/recommendationService.ts:2511` δίνει +6 σε «ρηχό ομαλό» βυθό και −12 σε
 * «απότομο», σε οικογενειακή λειτουργία και μόνο όταν κουνάει στην ακτή. Τα πεδία `seabedSlope`
 * και `waterEntry` **δεν υπάρχουν σε καμία από τις 2.873 παραλίες**, άρα το μπλοκ δεν έχει
 * εκτελεστεί ποτέ. Παράλληλα, από 18/08 κάθονται στον δίσκο 110 αρχεία με **μετρημένα βάθη**
 * (EMODnet, 100/300/500 μ. × 8 τομείς) που κανείς δεν διαβάζει.
 *
 * ΤΙ ΡΩΤΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. (α) Πόσες παραλίες θα σημειώνονταν «απότομες» σε κάθε κατώφλι.
 * (β) Πόσο συμφωνεί η μέτρηση με τον ανεξάρτητο μάρτυρα `waterDepth` της βάσης. (γ) **Πόσες
 * ετυμηγορίες και θέσεις αλλάζουν πραγματικά** — γιατί μόνο αυτό δικαιολογεί αποστολή.
 *
 * ΓΙΑΤΙ ΜΟΝΟ «ΑΠΟΤΟΜΟΣ», ΠΟΤΕ «ΡΗΧΟΣ». Το EMODnet εξομαλύνει στα ρηχά — γι' αυτό παρκαρίστηκε
 * το ταβάνι θραύσης (§Γ, 18/08). Ένα «15 μ. στα 100 μ. από την ακτή» δεν μπορεί να είναι
 * κατασκευασμένο· ένα «1,1 μ.» μπορεί. Άρα η χρήση είναι **μονόδρομη προς τα κάτω**: καμία
 * παραλία δεν ανεβαίνει με μισή απόδειξη.
 *
 * ΤΟ ΝΕΡΟ ΜΠΡΟΣΤΑ, ΟΧΙ ΤΟ ΓΥΡΩ. Διαβάζεται ο τομέας που αντιστοιχεί στο `facingDeg` της
 * παραλίας — εκεί που μπαίνει ο κόσμος — όχι το ελάχιστο ή το μέγιστο των οκτώ.
 *
 * ΤΟ ΚΡΙΝΕΙ ΤΟ ΠΡΟΪΟΝ: `getSuitableBeaches` με πραγματικές παραλίες και πραγματικά προφίλ, μια
 * φορά χωρίς το πεδίο και μια φορά με αυτό. Καμία αναπαραγωγή της βαθμολογίας εδώ.
 *
 * Run: node scripts/measureSeabedSlopeImpact.mjs [--regions=a,b|all]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile(
      'exports.getNegativeFeedbackCount = function () { return 0; };\n'
      + 'exports.recordOpenMeteoCall = function () {};\n',
      filename
    );
    return;
  }
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
const { getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));

const args = process.argv.slice(2);
const regionArg = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length);
const regionFilter = !regionArg || regionArg === 'all' ? null : regionArg.split(',');

const bathyDir = path.join(root, 'public/data/geospatial/bathymetry');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOfBearing = (deg) => SECTORS[Math.floor((((deg % 360) + 360) % 360 + 22.5) / 45) % 8];

/** Κατώφλια υποψήφια για «απότομος», σε μέτρα βάθους στα 100 μ. από την ακτή. */
const THRESHOLDS = [8, 10, 12, 15, 20];

/**
 * ΟΙ ΜΕΡΕΣ ΠΟΥ ΞΥΠΝΑΝΕ ΤΟ ΜΠΛΟΚ (κουνάει στην ακτή: seaAtShoreM > 0,5 ή >= 4 Μποφόρ).
 *
 * ΠΛΕΓΜΑ, ΟΧΙ ΜΙΑ ΜΕΡΑ. Η ετυμηγορία κολύμβησης έχει κατώφλια πάνω στο `swimmingScore` (π.χ.
 * < 45), οπότε ένα −12 αλλάζει λέξη ΜΟΝΟ αν η παραλία τύχει να στέκεται κοντά σε κατώφλι
 * εκείνη τη μέρα. Ένα δείγμα μιας ημέρας θα έλεγε «καμία επίπτωση» για λάθος λόγο — ακριβώς το
 * λάθος που κατέγραψε η βίβλος στο §Γ43 («ο μάρτυρας μετρήθηκε σε ΜΙΑ ήρεμη μέρα»).
 */
const WAVY_DAYS = [
  { windMs: 7, waveM: 0.5 },
  { windMs: 8, waveM: 0.7 },
  { windMs: 9, waveM: 0.9 },
  { windMs: 10, waveM: 1.1 },
  { windMs: 12, waveM: 1.4 },
];

const regionFiles = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .filter(name => !regionFilter || regionFilter.includes(name.replace(/\.json$/, '')));

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const exposureRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
    const profiles = {};
    const facingById = new Map();
    for (const profile of Object.values(exposureRaw)) {
      if (profile?.beachId == null) continue;
      profiles[profile.beachId] = profile;
      if (typeof profile.facingDeg === 'number') facingById.set(profile.beachId, profile.facingDeg);
    }
    let bathymetry = {};
    try {
      bathymetry = JSON.parse(readFileSync(path.join(bathyDir, file), 'utf8')).profiles ?? {};
    } catch { bathymetry = {}; }
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, profiles, facingById, bathymetry };
  } catch {
    return null;
  }
};

/** Το βάθος στα 100 μ. στον τομέα που ΚΟΙΤΑΕΙ η παραλία, ή null. */
const frontDepthM = (region, beachId) => {
  const facing = region.facingById.get(beachId);
  if (typeof facing !== 'number') return null;
  const profile = region.bathymetry[String(beachId)] ?? region.bathymetry[beachId];
  return profile?.sectors?.[sectorOfBearing(facing)]?.depths?.['100m'] ?? null;
};

const buildDay = (spec) => createDailyForecast(0, {
  id: 'seabed-impact', label: 'seabed',
  windDirectionDeg: 20, windSpeedMs: spec.windMs, windGustMs: spec.windMs * 1.35,
  waveHeightM: spec.waveM, waveDirectionDeg: 20,
});
const days = WAVY_DAYS.map(buildDay);

const FAMILY = { familyFriendly: true };
const score = (beaches, profiles, day) => {
  const byId = new Map();
  for (const item of getSuitableBeaches(beaches, day, 'gr', undefined, day.hourly, FAMILY, {}, profiles)) {
    byId.set(item.beach.id, item);
  }
  return byId;
};

const stats = {
  measuredAt: new Date().toISOString(),
  note: 'frontDepthM = βάθος στα 100 μ. στον τομέα που κοιτάει η παραλία (EMODnet, ήδη στον δίσκο).',
  wavyDays: WAVY_DAYS,
  beachesTotal: 0,
  withFrontDepth: 0,
  waterDepthBaseline: {},
  thresholds: {},
};

const regions = regionFiles.map(loadRegion).filter(Boolean);
const waterDepthOf = (beach) => beach?.metadata?.waterDepth?.type
  ?? (typeof beach?.waterDepth === 'string' ? beach.waterDepth : beach?.waterDepth?.type)
  ?? 'unknown';

for (const region of regions) {
  for (const beach of region.beaches) {
    stats.beachesTotal += 1;
    const key = waterDepthOf(beach);
    stats.waterDepthBaseline[key] = (stats.waterDepthBaseline[key] ?? 0) + 1;
    if (frontDepthM(region, beach.id) != null) stats.withFrontDepth += 1;
  }
}

for (const threshold of THRESHOLDS) {
  const bucket = {
    flagged: 0,
    waterDepthOfFlagged: {},
    beachDaysJudged: 0,
    verdictChanged: 0,
    toneChanged: 0,
    droppedOutOfTopThree: 0,
    scoreDropTotal: 0,
    examples: [],
  };

  for (const region of regions) {
    const flaggedIds = new Set();
    for (const beach of region.beaches) {
      const depth = frontDepthM(region, beach.id);
      if (depth != null && depth >= threshold) flaggedIds.add(beach.id);
    }
    if (flaggedIds.size === 0) continue;

    bucket.flagged += flaggedIds.size;
    for (const id of flaggedIds) {
      const beach = region.beaches.find(candidate => candidate.id === id);
      const key = waterDepthOf(beach);
      bucket.waterDepthOfFlagged[key] = (bucket.waterDepthOfFlagged[key] ?? 0) + 1;
    }

    const flaggedBeaches = region.beaches.map(beach => (flaggedIds.has(beach.id) ? { ...beach, seabedSlope: 'steep' } : beach));

    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex];
      const before = score(region.beaches, region.profiles, day);
      const after = score(flaggedBeaches, region.profiles, day);

      const topBefore = new Set([...before.values()].sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.beach.id));
      const topAfter = new Set([...after.values()].sort((a, b) => b.score - a.score).slice(0, 3).map(item => item.beach.id));

      for (const id of flaggedIds) {
        const a = before.get(id);
        const b = after.get(id);
        if (!a || !b) continue;
        bucket.beachDaysJudged += 1;
        bucket.scoreDropTotal += (a.score - b.score);
        if (a.swimmingComfort !== b.swimmingComfort) {
          bucket.verdictChanged += 1;
          if (bucket.examples.length < 12) {
            bucket.examples.push({ regionId: region.regionId, beachId: id, name: a.beach.name?.gr ?? a.beach.name?.en, day: WAVY_DAYS[dayIndex], from: a.swimmingComfort, to: b.swimmingComfort, depthM: frontDepthM(region, id) });
          }
        }
        if (a.conditionTone !== b.conditionTone) bucket.toneChanged += 1;
        if (topBefore.has(id) && !topAfter.has(id)) bucket.droppedOutOfTopThree += 1;
      }
    }
  }

  stats.thresholds[threshold] = bucket;
}

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'seabed-slope-impact.json');
writeFileSync(outPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

const share = (part, whole) => `${((part / Math.max(1, whole)) * 100).toFixed(1)}%`;
console.log('');
console.log(`Παραλίες: ${stats.beachesTotal} · με μετρημένο βάθος μπροστά: ${stats.withFrontDepth} (${share(stats.withFrontDepth, stats.beachesTotal)})`);
console.log(`Μέρες που δοκιμάστηκαν: ${WAVY_DAYS.length} (${WAVY_DAYS.map(d => `${d.windMs}m/s·${d.waveM}m`).join(' · ')})`);
console.log(`Βάση waterDepth: ${JSON.stringify(stats.waterDepthBaseline)}`);
console.log('');
console.log('κατώφλι | «απότομες» | αλλάζει ετυμηγορία | αλλάζει χρώμα | πέφτει από top-3 | μέση πτώση πόντων');
for (const threshold of THRESHOLDS) {
  const bucket = stats.thresholds[threshold];
  const meanDrop = bucket.flagged ? (bucket.scoreDropTotal / bucket.flagged).toFixed(1) : '0.0';
  console.log(`  ${String(threshold).padStart(2)}μ  |   ${String(bucket.flagged).padStart(4)}     |        ${String(bucket.verdictChanged).padStart(4)}        |     ${String(bucket.toneChanged).padStart(4)}      |       ${String(bucket.droppedOutOfTopThree).padStart(3)}        |      ${meanDrop}`);
}
console.log('');
console.log(`Αναφορά: ${path.relative(root, outPath)}`);
