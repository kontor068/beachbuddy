/**
 * ΕΝΑΣ ΑΡΙΘΜΟΣ ΠΑΝΤΟΥ, ΚΑΙ ΝΑ ΕΙΝΑΙ ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΙ ΖΗΤΗΘΗΚΕ (Μίλτος, 13/08/2026, με στιγμιότυπο δύο καρτών δίπλα-δίπλα): «θέλω να μετράνε το
 * ίδιο, όχι να λένε διαφορετικά πράγματα· θέλω να βλέπω στην ακτή τι γίνεται εκεί». Σήμερα η μία
 * κάρτα γράφει «1,4 μ. ανοιχτά» (θάλασσα 10 χλμ έξω) και η διπλανή «~0,2 μ.» (νερό στην άμμο), και
 * τίποτα πάνω στην οθόνη δεν λέει ότι είναι δύο διαφορετικά μεγέθη.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΕΡΩΤΗΣΗ ΑΠΑΝΤΗΣΙΜΗ: ο αριθμός της ακτής ΥΠΑΡΧΕΙ ΗΔΗ για κάθε παραλία,
 * μέσα στο scoring ([recommendationService.ts:2340-2345](services/recommendationService.ts)), και
 * η ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ ΤΟΝ ΔΙΑΒΑΖΕΙ ΑΠΟ ΤΙΣ 10/08 (§7η). Το χρώμα τον διαβάζει κι αυτό, ως
 * ταβάνι ([suitabilityTone.ts:317](utils/suitabilityTone.ts)). Δηλαδή σήμερα η οθόνη ΤΥΠΩΝΕΙ ένα
 * νούμερο και ΚΡΙΝΕΙ με άλλο — και αυτό που δεν τυπώνεται είναι το πιο σχετικό από τα δύο.
 *
 * ΤΙ ΕΙΝΑΙ Ο ΑΡΙΘΜΟΣ ΤΗΣ ΑΚΤΗΣ, ΣΕ ΤΡΕΙΣ ΓΡΑΜΜΕΣ:
 *   • εκτεθειμένη ή μερικώς προστατευμένη ακτή → ΙΔΙΟΣ με το ανοιχτό νερό (συντελεστής 1,0)·
 *   • προστατευμένη, ΚΑΙ από τη μεριά που έρχεται η θάλασσα (§Γ2) → ο μισός·
 *   • κλειστός όρμος με απόγειο άνεμο → η δική μας εκτίμηση SMB, ακόμα χαμηλότερα (§7δ).
 *
 * ΑΡΑ Η ΜΟΝΗ ΠΡΑΓΜΑΤΙΚΗ ΕΡΩΤΗΣΗ ΕΙΝΑΙ ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΠΕΦΤΟΥΝ ΣΤΟ ΜΙΣΟ, ΚΑΙ ΤΙ ΔΙΑΒΑΖΕΙ ΤΟΤΕ Ο
 * ΕΠΙΣΚΕΠΤΗΣ. Αυτό μετράει το αρχείο, εθνικά και ζωντανά. Δεν αλλάζει καμία γραμμή παραγωγής: το
 * `shoreSeaStateM` καλείται με ΑΚΡΙΒΩΣ τα ορίσματα που του δίνει το scoring (τα τρία εκτίθενται στο
 * BeachScore: `seaStateWaveM` = `effectiveWaveHeightM`, `exposureLevel`, `seaArrivalExposureLevel`),
 * οπότε ο δεύτερος αριθμός δεν είναι ανακατασκευή — είναι ο ίδιος.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν λέει αν ο μισός αριθμός είναι ΣΩΣΤΟΣ. Για ακτογραμμή δεν υπάρχει κριτής (§7δ) — ο
 *    συντελεστής 0,5 είναι παραδοχή του σπιτιού από 01/08, όχι μέτρηση.
 *  - Η ετυμηγορία κολύμβησης δεν μπορεί να αλλάξει από αυτή τη δουλειά, γιατί ήδη διαβάζει αυτόν
 *    τον αριθμό. Το επαληθεύει, δεν το υποθέτει: σκοράρει και συγκρίνει.
 *  - Επίπεδο ΗΜΕΡΑΣ (day 0), ένας κύκλος πρόγνωσης, άνεμος της περιοχής — ίδια όρια με το
 *    scripts/measureShoreWaveRamp.mjs.
 *
 * Run: node scripts/measureShoreNumberEverywhere.mjs --live [--regions=a,b]
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

const { shoreSeaStateM, seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } =
  require(path.join(root, 'utils/waveCharacter.ts'));
// Το χρώμα της πινέζας, από την ΙΔΙΑ συνάρτηση που καλεί ο χάρτης (BeachMap.tsx:2047) και με τα
// ίδια ορίσματα. Χωρίς αυτό, η μέτρηση απαντά «πόσες παραλίες δείχνουν μικρότερο νούμερο» αλλά όχι
// «σε πόσες ο αριθμός θα διαφωνεί με το χρώμα δίπλα του» — που είναι το λάθος που έκλεισε 10-11/08.
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const cachePath = path.join(root, '.tmp/shore-number-everywhere-cache.json');
const DAY_INDEX = 0;

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};
const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

/** Η ζώνη που διαβάζει ο επισκέπτης πίσω από τον αριθμό — ίδια κατώφλια με τον χάρτη. */
const bandOf = (waveM, periodS) => {
  const severity = seaStateSeverityM(waveM, periodS);
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'φουρτούνα';
  if (severity >= SEA_STATE_AMBER_M) return 'κύμα';
  return 'ήρεμα';
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
  const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  const rows = [];
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;

    const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
      weatherSource: 'island-fallback',
      hourlyForecast: dayForecast.hourly,
      geospatialProfile: region.profiles[beach.id],
    });

    const displayM = typeof score.waveHeightM === 'number' && Number.isFinite(score.waveHeightM)
      ? score.waveHeightM
      : null;
    const decisionM = typeof score.seaStateWaveM === 'number' && Number.isFinite(score.seaStateWaveM)
      ? score.seaStateWaveM
      : null;
    if (displayM === null && decisionM === null) continue;

    const modelShoreM = typeof score.shoreWaveHeightM === 'number' && Number.isFinite(score.shoreWaveHeightM)
      ? score.shoreWaveHeightM
      : null;

    // ΤΑ ΙΔΙΑ ΟΡΙΣΜΑΤΑ ΜΕ ΤΗ ΓΡΑΜΜΗ 2340 ΤΟΥ SCORING — όχι ανακατασκευή, η ίδια συνάρτηση.
    const dampedM = shoreSeaStateM(decisionM ?? undefined, score.exposureLevel, score.seaArrivalExposureLevel);
    const shoreM = modelShoreM !== null
      ? Math.min(modelShoreM, typeof dampedM === 'number' ? dampedM : modelShoreM)
      : (typeof dampedM === 'number' ? dampedM : null);

    // Ό,τι τυπώνει σήμερα η κάρτα: το μοντέλο ακτής όταν μιλάει, αλλιώς το νούμερο εμφάνισης.
    const todayM = modelShoreM !== null
      ? (displayM !== null ? Math.min(modelShoreM, displayM) : modelShoreM)
      : displayM;
    // Ό,τι θα τύπωνε: πάντα ο αριθμός της ακτής, με το ίδιο καπάκι «ποτέ πάνω από το νερό έξω».
    const nextM = shoreM === null
      ? todayM
      : (displayM !== null ? Math.min(shoreM, displayM) : shoreM);

    // Τα δύο flags δεν κάθονται στο BeachScore — ο χάρτης τα υπολογίζει μόνος του από το προφίλ και
    // τη ζωντανή διεύθυνση. Ίδιες συναρτήσεις, ίδια ορίσματα με το scoring (γραμμή 2495: `weather.wind.deg`).
    const profile = region.profiles[beach.id];
    const windDirectionDeg = dayForecast.wind?.deg;
    const beaufort = getBeaufortLevel(score.windSpeedKmph ?? (dayForecast.wind?.speed ?? 0) * 3.6);
    const tone = resolveConditionTone({
      exposureLevel: score.exposureLevel,
      beaufort,
      isEnclosedCove: Boolean(score.enclosedCove),
      seaStateM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
      offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort }),
      downwindSeaSample: hasDownwindSeaSample({
        profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
      }),
      seaArrivalExposureLevel: score.seaArrivalExposureLevel,
      swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
    });

    rows.push({
      beachId: beach.id,
      name: beach.name?.gr ?? null,
      tone,
      exposureLevel: score.exposureLevel ?? null,
      seaArrivalExposureLevel: score.seaArrivalExposureLevel ?? null,
      periodS: typeof score.seaStatePeriodS === 'number' ? score.seaStatePeriodS : null,
      modelSpoke: modelShoreM !== null,
      todayM: todayM === null ? null : Number(todayM.toFixed(2)),
      nextM: nextM === null ? null : Number(nextM.toFixed(2)),
      comfort: score.swimmingComfort ?? null,
    });
  }

  return { regionId: region.regionId, windKmh: Number(((regionDay.wind?.speed ?? 0) * 3.6).toFixed(1)), rows };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

const codeStamp = [
  'services/recommendationService.ts',
  'utils/waveCharacter.ts',
  'scripts/measureShoreNumberEverywhere.mjs',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + '@' + new Date().toISOString().slice(0, 10);

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
} catch { /* first run */ }

const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));
console.log(`── ΖΩΝΤΑΝΟ: ${regions.length - toFetch.length} από μνήμη, ${toFetch.length} νέες ──`);
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

const totals = {
  beaches: 0,
  unchanged: 0,
  changed: 0,
  drops: [],
  byExposure: {},
  bandMoves: {},
  intoCalm: 0,
  calmTone: {},
  calmNumberRoughPin: 0,
  changedTone: {},
  changedWithRoughPin: 0,
  modelSpoke: 0,
  examples: [],
};

for (const result of results) {
  for (const row of result.rows) {
    if (row.todayM === null || row.nextM === null) continue;
    totals.beaches += 1;
    if (row.modelSpoke) totals.modelSpoke += 1;

    const level = row.exposureLevel ?? 'άγνωστο';
    totals.byExposure[level] ??= { beaches: 0, changed: 0, drops: [] };
    totals.byExposure[level].beaches += 1;

    const drop = Number((row.todayM - row.nextM).toFixed(2));
    if (Math.abs(drop) < 0.005) { totals.unchanged += 1; continue; }
    totals.changed += 1;
    totals.drops.push(drop);
    // Η ζώνη κινείται μόνο όταν ο καιρός τυχαίνει να είναι πάνω στα κατώφλια. Η σχέση αριθμού και
    // πινέζας ισχύει ΚΑΘΕ μέρα, γι' αυτό μετριέται σε ΟΛΕΣ όσες αλλάζουν, όχι μόνο σε όσες αλλάζουν ζώνη.
    const pinCalmNow = row.tone === 'ideal' || row.tone === 'good';
    totals.changedTone[row.tone ?? 'άγνωστο'] = (totals.changedTone[row.tone ?? 'άγνωστο'] ?? 0) + 1;
    if (!pinCalmNow) totals.changedWithRoughPin += 1;
    totals.byExposure[level].changed += 1;
    totals.byExposure[level].drops.push(drop);

    const before = bandOf(row.todayM, row.periodS);
    const after = bandOf(row.nextM, row.periodS);
    if (before !== after) {
      const move = `${before} → ${after}`;
      totals.bandMoves[move] = (totals.bandMoves[move] ?? 0) + 1;
      if (after === 'ήρεμα' && before !== 'ήρεμα') {
        totals.intoCalm += 1;
        // ΤΟ ΚΡΙΣΙΜΟ: αν η πινέζα δεν είναι ήδη ήρεμη, ο αριθμός θα λέει άλλο από το χρώμα δίπλα του.
        const pinCalm = row.tone === 'ideal' || row.tone === 'good';
        totals.calmTone[row.tone ?? 'άγνωστο'] = (totals.calmTone[row.tone ?? 'άγνωστο'] ?? 0) + 1;
        if (!pinCalm) totals.calmNumberRoughPin += 1;
        if (totals.examples.length < 15) {
          totals.examples.push({
            region: result.regionId, name: row.name, exposure: row.exposureLevel,
            todayM: row.todayM, nextM: row.nextM, comfort: row.comfort, tone: row.tone, move,
          });
        }
      }
    }
  }
}

console.log(`\nΠεριοχές: ${results.length}/${regions.length} · παραλίες με νούμερο: ${totals.beaches}.`);
console.log('\n── ΤΙ ΑΛΛΑΖΕΙ ΣΤΟΝ ΑΡΙΘΜΟ ΠΟΥ ΤΥΠΩΝΕΤΑΙ ─────────────────────────────');
console.log(`  ΙΔΙΟΣ ΑΡΙΘΜΟΣ: ${totals.unchanged} (${pct(totals.unchanged, totals.beaches)})`);
console.log(`  ΑΛΛΑΖΕΙ: ${totals.changed} (${pct(totals.changed, totals.beaches)}) · διάμεση πτώση `
  + `${percentile(totals.drops, 0.5).toFixed(2)} μ. · p90 ${percentile(totals.drops, 0.9).toFixed(2)} μ. · `
  + `max ${(totals.drops.length ? Math.max(...totals.drops) : 0).toFixed(2)} μ.`);
console.log(`  (η εκτίμηση κλειστού όρμου μιλάει ήδη σε ${totals.modelSpoke} — αυτές τυπώνουν ήδη το νερό της ακτής)`);

console.log('\n── ΑΝΑ ΕΙΔΟΣ ΑΚΤΗΣ ───────────────────────────────────────────────────');
for (const [level, data] of Object.entries(totals.byExposure).sort((a, b) => b[1].beaches - a[1].beaches)) {
  console.log(`  ${level}: ${data.beaches} παραλίες · αλλάζουν ${data.changed} (${pct(data.changed, data.beaches)})`
    + (data.drops.length ? ` · διάμεση πτώση ${percentile(data.drops, 0.5).toFixed(2)} μ.` : ''));
}

console.log('\n── ΤΙ ΔΙΑΒΑΖΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ (ζώνη του αριθμού) ───────────────────────');
const moves = Object.entries(totals.bandMoves).sort((a, b) => b[1] - a[1]);
if (!moves.length) console.log('  καμία παραλία δεν αλλάζει ζώνη.');
for (const [move, count] of moves) console.log(`  ${move}: ${count}`);
console.log(`  ➜ ΠΕΡΝΑΝΕ ΣΕ «ήρεμα» ΕΝΩ ΔΕΝ ΗΤΑΝ: ${totals.intoCalm} (${pct(totals.intoCalm, totals.beaches)}) — αυτό είναι το ρίσκο.`);
console.log('\n── ΤΟ ΧΡΩΜΑ ΤΗΣ ΠΙΝΕΖΑΣ ΣΕ ΑΥΤΕΣ ─────────────────────────────────────');
console.log(`  ${Object.entries(totals.calmTone).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log(`  ➜ ΑΡΙΘΜΟΣ «ήρεμα» ΜΕ ΠΙΝΕΖΑ ΠΟΥ ΔΕΝ ΕΙΝΑΙ: ${totals.calmNumberRoughPin} (${pct(totals.calmNumberRoughPin, totals.intoCalm)} αυτών, ${pct(totals.calmNumberRoughPin, totals.beaches)} του συνόλου)`);

if (totals.examples.length) {
  console.log('\n  Παραδείγματα:');
  for (const example of totals.examples.slice(0, 8)) {
    console.log(`    ${example.name} (${example.region}, ${example.exposure}): ${example.todayM} → ${example.nextM} μ. · ${example.move} · ετυμηγορία ${example.comfort}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'shore-number-everywhere.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  dayIndex: DAY_INDEX,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  beaches: totals.beaches,
  unchanged: totals.unchanged,
  changed: totals.changed,
  medianDropM: Number(percentile(totals.drops, 0.5).toFixed(2)),
  p90DropM: Number(percentile(totals.drops, 0.9).toFixed(2)),
  maxDropM: totals.drops.length ? Number(Math.max(...totals.drops).toFixed(2)) : null,
  modelAlreadySpeaks: totals.modelSpoke,
  byExposure: Object.fromEntries(Object.entries(totals.byExposure).map(([k, v]) => [k, {
    beaches: v.beaches, changed: v.changed, medianDropM: Number(percentile(v.drops, 0.5).toFixed(2)),
  }])),
  bandMoves: totals.bandMoves,
  intoCalm: totals.intoCalm,
  calmTone: totals.calmTone,
  calmNumberRoughPin: totals.calmNumberRoughPin,
  changedTone: totals.changedTone,
  changedWithRoughPin: totals.changedWithRoughPin,
  examples: totals.examples,
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
