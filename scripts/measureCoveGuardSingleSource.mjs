/**
 * Ο ΦΡΟΥΡΟΣ ΟΡΜΟΥ ΑΠΟ ΜΙΑ ΠΗΓΗ — ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΣΕΛΙΔΑ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ (10/09/2026, βίβλος §Γ74).
 *
 * Ως 10/09 η σελίδα παραλίας (pages/BeachDetailPage.tsx) έτρεχε ΔΙΚΟ ΤΗΣ αντίγραφο του
 * utils/coveWaveGuard — με δικό της «καθρέφτη» του ελέγχου ρεστίας — για την ετικέτα «εκτίμηση»,
 * το ύψος της εκτίμησης και τη σημείωση όρμου (fetch/onshore). Διαβάζει πια το `scoreResult.coveWave`
 * της βαθμολογίας. Αυτό το σενάριο ξαναχτίζει τον ΠΑΛΙΟ υπολογισμό της σελίδας, ΑΥΤΟΥΣΙΟ, και τον
 * συγκρίνει με τον νέο σε κάθε παραλία × καιρό. Περνάει μόνο με 0 διαφορές — και μόνο αν ο όρμος
 * άναψε αρκετές φορές ώστε η σύγκριση να σημαίνει κάτι.
 *
 *   node scripts/measureCoveGuardSingleSource.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
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

const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { resolveCoveAwareWaveHeightM } = require(path.join(root, 'utils/coveWaveGuard.ts'));
const { SWELL_MIN_HEIGHT_M, hasSwellPresence } = require(path.join(root, 'utils/swellExposure.ts'));
// 11/09/2026 (§Γ77): όπου υπάρχει ΜΑΡΤΥΡΗΜΕΝΗ άφιξη (Μώλος 0-30°), η βαθμολογία σωπαίνει σκόπιμα τον
// φρουρό όρμου — εκεί η διαφορά από την «παλιά σελίδα» είναι η διόρθωση, όχι σφάλμα. Εξαιρείται ρητά.
const { isWitnessedArrivalSea } = require(path.join(root, 'utils/seaArrival.ts'));

// Ο ΠΑΛΙΟΣ καθρέφτης της σελίδας, αυτούσιος (git show f1acdbac:pages/BeachDetailPage.tsx, γρ. 1319).
const oldPageSwellPresent = (marine) => (marine?.swellWaveHeightM ?? 0) >= SWELL_MIN_HEIGHT_M
  && typeof marine?.swellWaveDirectionDeg === 'number';

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const appDir = path.join(root, 'public/data/beaches/app');
const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
const WINDS_MS = [3, 7, 11];
const SWELLS_M = [0.2, 0.5, 0.9]; // κάτω, ΑΚΡΙΒΩΣ πάνω και πάνω από το κατώφλι 0,5

let runs = 0, mismatches = 0, coveOn = 0, witnessed = 0;
const examples = [];
for (const file of readdirSync(exposureDir).filter((n) => n.endsWith('.json') && n !== 'index.json')) {
  let beaches, profiles;
  try {
    beaches = JSON.parse(readFileSync(path.join(appDir, file), 'utf8')).island?.beaches ?? [];
    profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
  } catch { continue; }
  for (const beach of beaches) {
    const profile = profiles[String(beach.id)];
    if (!profile) continue;
    for (const deg of DIRS) for (const ms of WINDS_MS) for (const swellM of SWELLS_M) {
      const day = createDailyForecast(0, { id: 'cove-single', label: 'cove', windDirectionDeg: deg, windSpeedMs: ms,
        windGustMs: ms * 1.35, waveHeightM: 0.8, waveDirectionDeg: deg });
      day.marine = { ...day.marine, swellWaveHeightM: swellM };
      const s = calculateBeachScore(beach, day, undefined, undefined, { geospatialProfile: profile, hourlyForecast: day.hourly });
      // Ο ΠΑΛΙΟΣ υπολογισμός της σελίδας, με τα ορίσματα που του έδινε η σελίδα.
      const old = resolveCoveAwareWaveHeightM({
        geospatialProfile: profile,
        facingDeg: s.facingDeg ?? null,
        windDirectionDeg: day.wind.deg,
        windSpeedKmh: day.wind.speed * 3.6,
        measuredWaveHeightM: day.marine?.waveHeightM,
        appModeledWaveHeightM: s.modeledWaveHeightM ?? 0,
        swellPresent: oldPageSwellPresent(day.marine),
      });
      const now = s.coveWave ?? { coveApplied: false, waveHeightM: 0 };
      if (isWitnessedArrivalSea(profile, [{ heightM: day.marine?.waveHeightM, directionDeg: day.marine?.waveDirectionDeg },
        { heightM: day.marine?.swellWaveHeightM, directionDeg: day.marine?.swellWaveDirectionDeg }])) { witnessed += 1; continue; }
      runs += 1;
      if (old.coveApplied) coveOn += 1;
      const same = old.coveApplied === now.coveApplied
        && (!old.coveApplied || old.waveHeightM === now.waveHeightM)
        && old.fetchKm === now.fetchKm && old.onshore === now.onshore;
      if (!same) {
        mismatches += 1;
        if (examples.length < 8) examples.push({ id: beach.id, deg, ms, swellM, old: { a: old.coveApplied, h: old.waveHeightM, f: old.fetchKm, o: old.onshore }, now });
      }
    }
  }
}

// Ο ωριαίος καθρέφτης: ίδιος έλεγχος ρεστίας με το hasSwell της βαθμολογίας σε κάθε κανονική τιμή.
let swellChecks = 0, swellDiff = 0;
for (const h of [undefined, 0, 0.2, 0.49, 0.5, 0.51, 1.2]) for (const d of [undefined, 0, 90, 359]) {
  swellChecks += 1;
  if (oldPageSwellPresent({ swellWaveHeightM: h, swellWaveDirectionDeg: d }) !== hasSwellPresence(h, d)) swellDiff += 1;
}

console.log(`φρουρός όρμου: ${runs} παραλίες×καιροί · ο όρμος άναψε ${coveOn} φορές · διαφορές παλιάς↔νέας σελίδας: ${mismatches} · εξαιρέθηκαν ${witnessed} με μαρτυρημένη άφιξη (§Γ77)`);
console.log(`έλεγχος ρεστίας ωριαίας μπάρας: ${swellChecks} τιμές · διαφορές: ${swellDiff}`);
for (const e of examples) console.log('  ', JSON.stringify(e));
if (mismatches || swellDiff || coveOn < 100) {
  console.error(coveOn < 100 ? 'Ο όρμος άναψε λιγότερο από 100 φορές — η σύγκριση δεν λέει τίποτα.' : 'ΔΙΑΦΟΡΑ — η σελίδα θα έδειχνε κάτι άλλο από πριν.');
  process.exit(1);
}
console.log('Ίδια απάντηση παντού — η σελίδα διαβάζει τη βαθμολογία χωρίς να αλλάξει τίποτα στην οθόνη.');
