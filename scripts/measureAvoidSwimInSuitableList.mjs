/**
 * ΜΠΑΙΝΕΙ ΠΑΡΑΛΙΑ ΠΟΥ ΛΕΜΕ «ΜΗΝ ΚΟΛΥΜΠΗΣΕΙΣ» ΜΕΣΑ ΣΤΙΣ «ΚΑΤΑΛΛΗΛΕΣ»; ΜΕΤΡΗΣΗ, ΜΗΔΕΝ UI.
 *
 * ΤΟ ΕΡΩΤΗΜΑ (20/08/2026). Το `App.tsx:7239-7251` γράφει ρητά γιατί ΔΕΝ υπάρχει φίλτρο
 * `avoid_swimming` στη λίστα των κατάλληλων:
 *
 *   «the swim verdict became a CEILING ON THE COLOUR itself — a refused swim can no longer wear
 *    blue or yellow anywhere. With that in place a filter here would be dead code **that hides
 *    the day it stops being dead**.»
 *
 * Το σχόλιο γράφτηκε στις 02/08/2026, όταν η λίστα ήταν ΜΠΛΕ+ΚΙΤΡΙΝΟ και μόνο. Στις 10/08 ο
 * κανόνας έγινε **τα δύο καλύτερα χρώματα ΠΟΥ ΥΠΑΡΧΟΥΝ** (`selectSuitableToneGroups`), δηλαδή
 * κίτρινο+πορτοκαλί σε νησί χωρίς μπλε, και σκέτο πορτοκαλί σε δύσκολο νησί. Το ταβάνι του
 * `avoid_swimming` είναι **πορτοκαλί** (`SWIM_VERDICT_AVOID_TONE_CEILING`). Άρα δομικά η μέρα
 * που το σχόλιο προέβλεψε ΕΧΕΙ ΕΡΘΕΙ. Αυτό το αρχείο μετράει **πόσο συχνά**, πριν αλλάξει
 * γραμμή κώδικα — §Γ8 της βίβλου: πρώτα η μέτρηση.
 *
 * ΤΙ ΔΕΝ ΚΡΙΝΕΙ ΤΟ ΑΡΧΕΙΟ ΜΟΝΟ ΤΟΥ. Το χρώμα, η ετυμηγορία κολύμβησης και η επιλογή των δύο
 * χρωμάτων έρχονται από το ΠΡΟΪΟΝ (`calculateBeachScore`, `resolveConditionTone`,
 * `selectSuitableToneGroups`). Αν το αρχείο έκρινε με δικούς του κανόνες θα έλεγε «όλα καλά»
 * για κώδικα που κάνει άλλα — το ίδιο λάθος που κατέγραψε η βίβλος στο §Κ1.
 *
 * ΟΡΙΑ, ΓΡΑΜΜΕΝΑ ΚΑΘΑΡΑ (ίδια με scripts/measureColourCauseSplit.mjs, από το οποίο κρατάει
 * ολόκληρο το μοτίβο, το pacing και τη μνήμη):
 *  - Άνεμος ΠΕΡΙΟΧΗΣ, όχι ο τοπικός κάθε παραλίας που δίνει ο χάρτης στην πινέζα.
 *  - Δείγμα σε ΜΕΡΕΣ (0..N-1 του κύκλου), όχι ώρες: το `adjustDailyForecastToHour` (App.tsx)
 *    δεν είναι exported και η αντιγραφή του θα ήταν δεύτερο αντίγραφο κανόνα.
 *  - **Η λίστα του App περνάει πρώτα από `isListableInDirectory`** (γυμνιστών, και μόνο-με-βάρκα
 *    στα ≥5 Μποφόρ). Δεν είναι exported, ΔΕΝ αντιγράφεται εδώ: το φίλτρο μόνο ΑΦΑΙΡΕΙ παραλίες,
 *    άρα το νούμερο που βγάζει αυτό το αρχείο είναι **ΑΝΩ ΦΡΑΓΜΑ**. Αν το άνω φράγμα είναι
 *    μηδέν, το ερώτημα κλείνει· αν όχι, η ακριβής τιμή θέλει το φίλτρο.
 *  - Δεν κρίνει αν η ετυμηγορία «μην κολυμπήσεις» είναι ΣΩΣΤΗ. Ρωτάει μόνο πού καταλήγει.
 *
 * Run: node scripts/measureAvoidSwimInSuitableList.mjs --live [--regions=a,b] [--days=5]
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

const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
// ΟΙ ΤΡΕΙΣ ΑΠΟΦΑΣΕΙΣ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟ ΠΡΟΪΟΝ: το χρώμα, το ταβάνι της ετυμηγορίας, και ΠΟΙΑ
// χρώματα μπαίνουν στη λίστα. Καμία αναπαραγωγή εδώ.
const {
  resolveConditionTone, selectSuitableToneGroups,
  SUITABLE_LIST_TONE_GROUPS, LEGEND_TONE_ORDER,
} = require(path.join(root, 'utils/suitabilityTone.ts'));

/**
 * ΤΟ ΤΑΒΑΝΙ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ. Η σταθερά `SWIM_VERDICT_AVOID_TONE_CEILING` δεν είναι
 * exported — και καλά κάνει. Αντί να την αντιγράψω (§Κ1), τη ΡΩΤΑΩ: η πιο ήρεμη δυνατή παραλία
 * με ετυμηγορία «μην κολυμπήσεις» φοράει ακριβώς το ταβάνι. Αν αύριο αλλάξει η σταθερά, αλλάζει
 * και η μέτρηση μόνη της· αν την είχα γράψει, θα έλεγε ήρεμα ψέματα.
 */
const AVOID_TONE_CEILING = resolveConditionTone({
  exposureLevel: 'protected', beaufort: 1, swimVerdictAvoid: true,
});
const CALM_TONE_WITHOUT_AVOID = resolveConditionTone({
  exposureLevel: 'protected', beaufort: 1, swimVerdictAvoid: false,
});
const { holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample, holdsGlassWaterAtFourBeaufort } =
  require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.error('Χρειάζεται --live: η μέτρηση τραβάει πραγματική πρόγνωση για κάθε περιοχή.');
  process.exit(1);
}
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 5);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const cachePath = path.join(root, '.tmp/avoid-swim-in-suitable-cache.json');

/** Αλλάζει ΜΟΝΟ όταν αλλάζουν τα πεδία της κάθε γραμμής. */
const ROW_VERSION = 1;

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] ?? 0) + by; };

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch {
    return null;
  }
};

const regions = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .map(loadRegion)
  .filter(Boolean)
  .filter(region => region.regionPoint && Number.isFinite(region.regionPoint.lat))
  .filter(region => !regionFilter || regionFilter.includes(region.regionId));

const POINTS_PER_MINUTE = 450;
const pointWindow = [];
const paceForPoints = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60_000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    const waitMs = Math.max(1000, pointWindow[0].at + 60_000 - performance.now());
    process.stderr.write(`\r  rate limit: ${spent} points, αναμονή ${Math.ceil(waitMs / 1000)}s…        `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  await paceForPoints(resolution.points.length + 1);

  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);

  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { regionId: region.regionId, skipped: 'no wind' };
  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const days = processForecastData(mergeMarineForecastData(wind.data, regionMarine)).slice(0, DAYS);
  if (!days.length) return { regionId: region.regionId, skipped: 'no forecast day' };

  const rows = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const regionDay = days[dayIndex];
    for (const beach of region.beaches) {
      const key = resolution.keyByBeachId.get(beach.id);
      const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;

      const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      });

      const profile = region.profiles[beach.id];
      const windDirectionDeg = dayForecast.wind?.deg;
      const beaufort = getBeaufortLevel(score.windSpeedKmph ?? (dayForecast.wind?.speed ?? 0) * 3.6);
      const seaStateM = seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS);
      const avoid = score.swimmingComfort === 'avoid_swimming';

      // Ακριβώς τα ορίσματα που δίνει ο χάρτης στην πινέζα (BeachMap.beachToneInput).
      const toneInput = {
        exposureLevel: score.exposureLevel,
        beaufort,
        isEnclosedCove: Boolean(score.enclosedCove),
        seaStateM,
        offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort }),
        glassWaterAtFour: holdsGlassWaterAtFourBeaufort({
          profile, windDirectionDeg, beaufort, seaStateM,
          swellWaveHeightM: score.marine?.swellWaveHeightM,
          exposureLevel: score.exposureLevel,
          seaArrivalExposureLevel: score.seaArrivalExposureLevel,
        }),
        downwindSeaSample: hasDownwindSeaSample({
          profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
        }),
        swimVerdictAvoid: avoid,
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
        windSpeedKmh: score.windSpeedKmph,
      };

      rows.push({
        dayIndex,
        beachId: beach.id,
        name: beach.name?.gr ?? beach.name?.en ?? null,
        tone: resolveConditionTone(toneInput),
        avoid,
        beaufort,
        waveM: Number.isFinite(score.waveHeightM) ? Number(score.waveHeightM.toFixed(2)) : null,
        shoreM: Number.isFinite(score.shoreWaveHeightM) ? Number(score.shoreWaveHeightM.toFixed(2)) : null,
      });
    }
  }

  return { regionId: region.regionId, days: days.length, rows };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

const codeStamp = [
  'utils/suitabilityTone.ts',
  'services/recommendationService.ts',
  'utils/waveCharacter.ts',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + `@${new Date().toISOString().slice(0, 10)}@d${DAYS}@r${ROW_VERSION}`;

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
} catch { /* first run */ }

const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));
console.log(`── ΖΩΝΤΑΝΟ: ${regions.length - toFetch.length} από μνήμη, ${toFetch.length} νέες · ${DAYS} μέρες ──`);
for (const region of toFetch) {
  let result = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      result = await measureRegion(region);
    } catch (error) {
      result = { regionId: region.regionId, skipped: error.message };
    }
    if (regionComplete(result)) break;
    await sleep([20000, 45000, 90000][attempt] ?? 0);
  }
  if (result?.regionId) cache[result.regionId] = result;
  process.stderr.write(`\r  ${Object.keys(cache).length}/${regions.length} περιοχές            `);
  await sleep(250);
}
process.stderr.write('\n');
mkdirSync(path.dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify({ codeStamp, regions: cache }));

const results = regions.map(region => cache[region.regionId]).filter(regionComplete);

// ── Η ΟΘΟΝΗ = ΠΕΡΙΟΧΗ × ΜΕΡΑ. Αυτό βλέπει ένας επισκέπτης με μια ματιά. ─────────────────────
const totals = {
  screens: 0,
  screensWithList: 0,
  screensWithAvoidInList: 0,
  screensWhereFilterEmptiesList: 0,
  listedBeaches: 0,
  listedAvoid: 0,
  avoidBeachesTotal: 0,
  avoidByTone: {},
  windowShape: {},
  windowShapeWithAvoid: {},
};
const examples = [];
const worstRegions = {};

for (const result of results) {
  const byDay = new Map();
  for (const row of result.rows) {
    if (!byDay.has(row.dayIndex)) byDay.set(row.dayIndex, []);
    byDay.get(row.dayIndex).push(row);
  }

  for (const [dayIndex, rows] of byDay) {
    totals.screens += 1;

    for (const row of rows) {
      if (row.avoid) {
        totals.avoidBeachesTotal += 1;
        bump(totals.avoidByTone, row.tone);
      }
    }

    // Η ΠΡΑΓΜΑΤΙΚΗ ΣΥΝΑΡΤΗΣΗ ΤΟΥ ΠΡΟΪΟΝΤΟΣ αποφασίζει ποια χρώματα μπαίνουν στη λίστα.
    const chosen = selectSuitableToneGroups(rows, row => row.tone);
    if (!chosen.length) continue;
    totals.screensWithList += 1;
    bump(totals.windowShape, chosen.join('+'));

    const listed = rows.filter(row => chosen.includes(row.tone));
    const listedAvoid = listed.filter(row => row.avoid);
    totals.listedBeaches += listed.length;
    totals.listedAvoid += listedAvoid.length;

    if (listedAvoid.length) {
      totals.screensWithAvoidInList += 1;
      bump(totals.windowShapeWithAvoid, chosen.join('+'));
      bump(worstRegions, result.regionId, listedAvoid.length);
      // Αν τις κόβαμε, θα έμενε λίστα; Αυτό είναι το τίμημα της αυστηρής λύσης.
      if (listedAvoid.length === listed.length) totals.screensWhereFilterEmptiesList += 1;
      for (const row of listedAvoid) {
        if (examples.length < 25) {
          examples.push({
            region: result.regionId,
            day: dayIndex,
            name: row.name,
            beachId: row.beachId,
            tone: row.tone,
            beaufort: row.beaufort,
            waveM: row.waveM,
            shoreM: row.shoreM,
            window: chosen.join('+'),
          });
        }
      }
    }
  }
}

console.log(`\n── ΤΟ ΕΡΩΤΗΜΑ ────────────────────────────────────────────────────────`);
console.log(`  Ταβάνι χρώματος για «μην κολυμπήσεις»: ${AVOID_TONE_CEILING}`
  + ` (ίδια παραλία χωρίς την ετυμηγορία: ${CALM_TONE_WITHOUT_AVOID})`);
console.log(`  Η λίστα παίρνει τα ${SUITABLE_LIST_TONE_GROUPS} καλύτερα χρώματα ΠΟΥ ΥΠΑΡΧΟΥΝ.`);
console.log(`  Άρα: όποτε το παράθυρο των χρωμάτων περιέχει ${AVOID_TONE_CEILING}, μπορεί να μπει.`);

console.log(`\n── ΠΟΣΟ ΣΥΧΝΑ (άνω φράγμα — χωρίς το φίλτρο γυμνιστών/βάρκας) ─────────`);
console.log(`  Οθόνες (περιοχή × μέρα): ${totals.screens} · με λίστα: ${totals.screensWithList}`);
console.log(`  Οθόνες με ΕΣΤΩ ΜΙΑ «μην κολυμπήσεις» μέσα στις κατάλληλες: `
  + `${totals.screensWithAvoidInList} (${pct(totals.screensWithAvoidInList, totals.screensWithList)})`);
console.log(`  Παραλίες στη λίστα: ${totals.listedBeaches} · από αυτές «μην κολυμπήσεις»: `
  + `${totals.listedAvoid} (${pct(totals.listedAvoid, totals.listedBeaches)})`);
console.log(`  «Μην κολυμπήσεις» συνολικά στο δείγμα: ${totals.avoidBeachesTotal}`
  + ` · ανά χρώμα: ${LEGEND_TONE_ORDER.map(t => `${t} ${totals.avoidByTone[t] ?? 0}`).join(' · ')}`);

console.log(`\n── ΤΟ ΠΑΡΑΘΥΡΟ ΤΩΝ ΔΥΟ ΧΡΩΜΑΤΩΝ ─────────────────────────────────────`);
for (const [shape, count] of Object.entries(totals.windowShape).sort((a, b) => b[1] - a[1])) {
  const withAvoid = totals.windowShapeWithAvoid[shape] ?? 0;
  console.log(`  ${shape.padEnd(16)} ${String(count).padStart(4)} οθόνες · με «μην κολυμπήσεις» μέσα: ${withAvoid} (${pct(withAvoid, count)})`);
}

console.log(`\n── ΤΟ ΤΙΜΗΜΑ ΤΗΣ ΑΥΣΤΗΡΗΣ ΛΥΣΗΣ ─────────────────────────────────────`);
console.log(`  Οθόνες που θα ΑΔΕΙΑΖΑΝ αν κόβαμε τις «μην κολυμπήσεις»: `
  + `${totals.screensWhereFilterEmptiesList} (${pct(totals.screensWhereFilterEmptiesList, totals.screensWithList)})`);
console.log(`  ⚠️ Άδεια λίστα ΔΕΝ είναι κατ' ανάγκη λάθος: σε μελτέμι η τίμια απάντηση μπορεί να είναι «καμία».`);

const worst = Object.entries(worstRegions).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (worst.length) {
  console.log(`\n── ΠΟΥ ΧΤΥΠΑΕΙ ΠΕΡΙΣΣΟΤΕΡΟ ──────────────────────────────────────────`);
  for (const [regionId, count] of worst) console.log(`  ${regionId}: ${count} παραλιο-ημέρες`);
}

if (examples.length) {
  console.log(`\n── ΠΑΡΑΔΕΙΓΜΑΤΑ ─────────────────────────────────────────────────────`);
  for (const example of examples.slice(0, 12)) {
    console.log(`  ${example.name} (${example.region}, μέρα ${example.day}): ${example.tone}`
      + ` · ${example.beaufort} Μπφ · ${example.waveM ?? '—'} μ. ανοιχτά · ακτή ${example.shoreM ?? '—'} μ. · παράθυρο ${example.window}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'avoid-swim-in-suitable-list.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  days: DAYS,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  avoidToneCeiling: AVOID_TONE_CEILING,
  listToneGroups: SUITABLE_LIST_TONE_GROUPS,
  note: 'ΑΝΩ ΦΡΑΓΜΑ: το isListableInDirectory (γυμνιστών, μόνο-με-βάρκα στα ≥5 Μπφ) δεν είναι '
    + 'exported και δεν αντιγράφηκε εδώ. Μόνο αφαιρεί παραλίες, άρα το πραγματικό νούμερο είναι ≤.',
  ...totals,
  examples,
  worstRegions: Object.fromEntries(worst),
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
