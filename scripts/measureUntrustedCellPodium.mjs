/**
 * ΤΙ ΚΟΣΤΙΖΕΙ ΝΑ ΒΓΑΛΟΥΜΕ ΑΠΟ ΤΟ ΒΑΘΡΟ ΤΙΣ ΠΑΡΑΛΙΕΣ ΠΟΥ ΡΩΤΑΝΕ ΛΑΘΟΣ ΝΕΡΟ (22/08/2026).
 *
 * ΤΟ ΕΥΡΗΜΑ. Ο δικός μας έλεγχος (`reports/quality/marine-cell-trust.json`) βρίσκει **255
 * παραλίες** των οποίων το θαλάσσιο κελί περιγράφει άλλο νερό — άλλον κόλπο, ή πολύ μακριά. Η
 * σημαία `marineCellTrusted:false` είναι **ήδη ψημένη** μέσα στα προφίλ γεωμετρίας και έχει δική
 * της πύλη· το ίδιο το εργαλείο που την έγραψε σημειώνει ρητά ότι **καμία γραμμή παραγωγής δεν
 * τη διαβάζει**. Δηλαδή ξέρουμε ότι διαβάζουμε λάθος νερό και το παρουσιάζουμε σαν όλα τα άλλα.
 *
 * ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ: έξω από το βάθρο **μόνο όταν μετράει το κύμα**. Σε ήρεμη μέρα το λάθος κελί
 * δεν κοστίζει τίποτα — όλα τα κελιά λένε «λάδι». Το ερώτημα είναι **πού** μπαίνει το κατώφλι.
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Για πλέγμα ημερών (ήρεμη → άγρια) και για πέντε κατώφλια κύματος, πόσες θέσεις
 * βάθρου αλλάζουν, πόσα βάθρα **αδειάζουν**, και πόσες φορές μια αναξιόπιστη παραλία ήταν η #1
 * του νησιού της. Το κατώφλι 0,00 μ. είναι το «έξω πάντα» — η επιλογή που ο Μίλτος ΔΕΝ διάλεξε,
 * κρατημένη εδώ ως μέτρο σύγκρισης.
 *
 * ΤΟ ΚΡΙΝΕΙ ΤΟ ΠΡΟΪΟΝ: `getSuitableBeaches` + `isTrustedTopRecommendationCandidate`, η ίδια πύλη
 * που το `App.tsx` περνάει σε **τέσσερα** σημεία. Το βάθρο εδώ είναι προσέγγιση (οι τρεις
 * κορυφαίοι βαθμοί που περνούν την πύλη) — η πραγματική σειρά έχει κι άλλα στρώματα, αλλά η
 * ΣΥΓΚΡΙΣΗ πριν/μετά τρέχει με τα ίδια ακριβώς στρώματα και στις δύο πλευρές.
 *
 * Run: node scripts/measureUntrustedCellPodium.mjs [--regions=a,b|all]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { getSuitableBeaches, isTrustedTopRecommendationCandidate } = require(path.join(root, 'services/recommendationService.ts'));

const args = process.argv.slice(2);
const regionArg = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length);
const regionFilter = !regionArg || regionArg === 'all' ? null : regionArg.split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');

/** Ήρεμη → άγρια. Το κύμα εδώ είναι της ΠΕΡΙΟΧΗΣ· η παραλία παίρνει το δικό της μέσα στο μοντέλο. */
const DAYS = [
  { windMs: 3, waveM: 0.2 },
  { windMs: 5, waveM: 0.4 },
  { windMs: 7, waveM: 0.6 },
  { windMs: 9, waveM: 0.9 },
  { windMs: 11, waveM: 1.3 },
];

/** Πάνω από πόσο κύμα θεωρούμε ότι «μετράει το κύμα». 0,00 = έξω πάντα (για σύγκριση). */
const THRESHOLDS_M = [0, 0.3, 0.5, 0.8, 1.2];

const PODIUM_SEATS = 3;

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const raw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
    const profiles = {};
    const untrusted = new Set();
    for (const profile of Object.values(raw)) {
      if (profile?.beachId == null) continue;
      profiles[profile.beachId] = profile;
      if (profile.marineCellTrusted === false) untrusted.add(profile.beachId);
    }
    // Το «πριν» δεν προσομοιώνεται: είναι τα ΙΔΙΑ προφίλ με τη σημαία σβησμένη, οπότε και οι δύο
    // πλευρές περνούν από την πραγματική `isTrustedTopRecommendationCandidate`.
    const trustingProfiles = {};
    for (const [id, profile] of Object.entries(profiles)) {
      const { marineCellTrusted, ...rest } = profile;
      trustingProfiles[id] = rest;
    }
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, profiles, trustingProfiles, untrusted };
  } catch {
    return null;
  }
};

const regions = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .filter(name => !regionFilter || regionFilter.includes(name.replace(/\.json$/, '')))
  .map(loadRegion)
  .filter(Boolean);

const days = DAYS.map(spec => ({
  spec,
  forecast: createDailyForecast(0, {
    id: 'untrusted-cell', label: 'cell',
    windDirectionDeg: 20, windSpeedMs: spec.windMs, windGustMs: spec.windMs * 1.35,
    waveHeightM: spec.waveM, waveDirectionDeg: 20,
  }),
}));

/** Το κύμα στο οποίο στηρίζεται ΑΥΤΗ η παραλία σήμερα — το δικό της αν υπάρχει, αλλιώς της περιοχής. */
const seaReliedOnM = (item, regionWaveM) => item.seaStateWaveM ?? item.waveHeightM ?? regionWaveM;

const stats = {
  measuredAt: new Date().toISOString(),
  days: DAYS,
  thresholdsM: THRESHOLDS_M,
  regions: regions.length,
  untrustedBeaches: regions.reduce((sum, region) => sum + region.untrusted.size, 0),
  byThreshold: {},
};

for (const threshold of THRESHOLDS_M) {
  const bucket = {
    podiumSeatsChanged: 0,
    podiumsEmptied: 0,
    podiumsShrunk: 0,
    untrustedLeadersRemoved: 0,
    regionDaysWithAnyChange: 0,
    regionDays: 0,
    examples: [],
  };

  for (const region of regions) {
    if (region.untrusted.size === 0) continue;

    for (const { spec, forecast } of days) {
      bucket.regionDays += 1;
      const beaufort = getBeaufortLevel((forecast.wind?.speed ?? 0) * 3.6);

      // ΠΡΙΝ: η πραγματική πύλη πάνω σε προφίλ χωρίς τη σημαία — δηλαδή η συμπεριφορά μέχρι
      // σήμερα, όπου κανείς δεν τη διάβαζε.
      const scoredTrusting = getSuitableBeaches(region.beaches, forecast, 'gr', undefined, forecast.hourly, undefined, {}, region.trustingProfiles);
      const before = scoredTrusting
        .filter(item => isTrustedTopRecommendationCandidate(item, undefined, beaufort))
        .sort((a, b) => b.score - a.score)
        .slice(0, PODIUM_SEATS);

      // ΜΕΤΑ: τα πραγματικά προφίλ. Το κατώφλι του πλέγματος εφαρμόζεται από πάνω, ώστε το αρχείο
      // να μπορεί να δείξει και τις εναλλακτικές που ΔΕΝ διαλέχθηκαν.
      const scoredReal = getSuitableBeaches(region.beaches, forecast, 'gr', undefined, forecast.hourly, undefined, {}, region.profiles);
      const after = scoredReal
        .filter(item => isTrustedTopRecommendationCandidate(item, undefined, beaufort))
        .filter(item => !(
          region.untrusted.has(item.beach.id)
          && seaReliedOnM(item, spec.waveM) >= threshold
        ))
        .sort((a, b) => b.score - a.score)
        .slice(0, PODIUM_SEATS);

      const beforeIds = before.map(item => item.beach.id);
      const afterIds = after.map(item => item.beach.id);
      const changed = beforeIds.filter((id, index) => afterIds[index] !== id).length;
      if (changed > 0) bucket.regionDaysWithAnyChange += 1;
      bucket.podiumSeatsChanged += changed;

      if (before.length > 0 && after.length === 0) bucket.podiumsEmptied += 1;
      else if (after.length < before.length) bucket.podiumsShrunk += 1;

      if (before[0] && region.untrusted.has(before[0].beach.id) && afterIds[0] !== beforeIds[0]) {
        bucket.untrustedLeadersRemoved += 1;
        if (bucket.examples.length < 12) {
          bucket.examples.push({
            regionId: region.regionId,
            day: spec,
            removed: before[0].beach.name?.gr ?? before[0].beach.name?.en,
            beachId: before[0].beach.id,
            seaM: Number(seaReliedOnM(before[0], spec.waveM)?.toFixed?.(2) ?? null),
            replacedBy: after[0]?.beach?.name?.gr ?? after[0]?.beach?.name?.en ?? null,
          });
        }
      }
    }
  }

  stats.byThreshold[threshold] = bucket;
}

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'untrusted-cell-podium.json');
writeFileSync(outPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');

console.log('');
console.log(`Περιοχές: ${stats.regions} · παραλίες με λάθος νερό: ${stats.untrustedBeaches} · μέρες: ${DAYS.length}`);
console.log('');
console.log('κατώφλι | θέσεις βάθρου αλλάζουν | βάθρα αδειάζουν | βάθρα μικραίνουν | #1 που φεύγει | περιοχές×μέρες με αλλαγή');
for (const threshold of THRESHOLDS_M) {
  const b = stats.byThreshold[threshold];
  const label = threshold === 0 ? 'πάντα ' : `${threshold.toFixed(2)}μ`;
  console.log(`  ${label} |          ${String(b.podiumSeatsChanged).padStart(4)}          |       ${String(b.podiumsEmptied).padStart(3)}       |       ${String(b.podiumsShrunk).padStart(3)}        |     ${String(b.untrustedLeadersRemoved).padStart(3)}      |   ${b.regionDaysWithAnyChange}/${b.regionDays}`);
}
console.log('');
console.log(`Αναφορά: ${path.relative(root, outPath)}`);
