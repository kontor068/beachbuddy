/**
 * ΠΟΣΟ ΣΥΧΝΑ ΕΧΟΥΜΕ ΟΝΤΩΣ ΑΛΛΗ ΜΕΡΑ ΝΑ ΠΡΟΤΕΙΝΟΥΜΕ; ΜΕΤΡΗΣΗ, ΜΗΔΕΝ UI.
 *
 * ΤΟ ΕΡΩΤΗΜΑ (22/08/2026). Σε μέρα μελτεμιού η σελίδα έλεγε «δεν υπάρχει καθαρή επιλογή» και
 * σταματούσε, ενώ η πρόγνωση ΕΞΙ ημερών — καιρός ΚΑΙ θάλασσα — ήταν ήδη φορτωμένη στην ίδια
 * οθόνη. Το `utils/bestDayAhead.findBestDayAhead` δίνει την επόμενη μέρα που περνάει τον ΙΔΙΟ
 * πήχη. Πριν σταλεί, μετριέται: πόσο συχνά υπάρχει τέτοια μέρα, πόσο μακριά είναι, και —
 * κυρίως — αν η μέρα που προτείνουμε θα ήταν η ίδια αδιέξοδο αν την κοιτούσε κανείς κατάματα.
 *
 * ΤΙ ΔΕΝ ΚΡΙΝΕΙ ΤΟ ΑΡΧΕΙΟ ΜΟΝΟ ΤΟΥ. Και οι τρεις αποφάσεις έρχονται από το ΠΡΟΪΟΝ:
 * `getSuitableBeaches` (ποιες παραλίες), `countSwimmableBeaches` (ποιες κολυμπιούνται) και
 * `isSevereConditionsDay` (ποια μέρα είναι κακή). Καμία αναπαραγωγή κανόνα εδώ — αυτό ήταν
 * ακριβώς το λάθος που κατέγραψε η βίβλος στο §Κ1.
 *
 * ΟΡΙΑ, ΓΡΑΜΜΕΝΑ ΚΑΘΑΡΑ (ίδια με scripts/measureAvoidSwimInSuitableList.mjs):
 *  - Άνεμος ΠΕΡΙΟΧΗΣ, όχι ο τοπικός κάθε παραλίας. Η εφαρμογή δίνει και τοπικό άνεμο ανά
 *    παραλία· εδώ μπαίνει μόνο η θάλασσα ανά παραλία. Άρα το νούμερο των «κολυμπήσιμων» είναι
 *    ΠΡΟΣΕΓΓΙΣΗ — αλλά η ίδια προσέγγιση και στη μέρα που αρνούμαστε και σε αυτή που
 *    προτείνουμε, οπότε η ΣΥΓΚΡΙΣΗ στέκει.
 *  - Δεν περνάει από `isListableInDirectory` (γυμνιστών, μόνο-με-βάρκα) — δεν είναι exported.
 *    Το φίλτρο μόνο ΑΦΑΙΡΕΙ, άρα οι κολυμπήσιμες εδώ είναι ΑΝΩ ΦΡΑΓΜΑ.
 *  - Το replay του Open-Meteo δουλεύει κανονικά: `OPEN_METEO_REPLAY=2022-09-06 node …`
 *
 * Run: node scripts/measureBestDayAhead.mjs --live [--regions=a,b|all] [--days=6]
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

const { getBeaufortLevel, processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
const { countSwimmableBeaches, findBestDayAhead, isSevereConditionsDay } = require(path.join(root, 'utils/bestDayAhead.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.error('Χρειάζεται --live: η μέτρηση τραβάει πραγματική πρόγνωση για κάθε περιοχή.');
  process.exit(1);
}
const regionArg = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length);
const regionFilter = !regionArg || regionArg === 'all' ? null : regionArg.split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 6);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');

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
  if (days.length < 2) return { regionId: region.regionId, skipped: 'forecast too short' };

  // Per-beach day arrays, exactly the shape the app hands findBestDayAhead.
  const beachForecasts = {};
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    if (!beachMarine.length) continue;
    beachForecasts[beach.id] = { forecast: days.map(day => applyMarineToDailyForecast(day, beachMarine)) };
  }

  /** The product's own answer for one day, asked exactly as the page asks it. */
  const judgeDay = (dayIndex) => {
    const day = days[dayIndex];
    const beaufort = getBeaufortLevel((day.wind?.speed ?? 0) * 3.6);
    const beachWeatherById = {};
    for (const [beachId, context] of Object.entries(beachForecasts)) {
      const beachDay = context.forecast[dayIndex];
      if (beachDay && beachDay !== day) beachWeatherById[Number(beachId)] = beachDay;
    }
    const scored = getSuitableBeaches(region.beaches, day, 'gr', undefined, day.hourly, undefined, beachWeatherById, region.profiles);
    const swimmable = countSwimmableBeaches(scored, (day.wind?.speed ?? 0) * 3.6, day.marine?.waveHeightM);
    return {
      beaufort,
      severe: isSevereConditionsDay(day, beaufort),
      suitable: scored.length,
      swimmable,
      /** The exact condition that puts the dead-end card on screen. */
      deadEnd: isSevereConditionsDay(day, beaufort) && swimmable === 0,
    };
  };

  const judged = days.map((_, index) => judgeDay(index));
  const rows = [];

  for (let dayIndex = 0; dayIndex < days.length - 1; dayIndex += 1) {
    if (!judged[dayIndex].deadEnd) continue;

    const offer = findBestDayAhead({
      beaches: region.beaches,
      forecasts: days,
      beachForecasts,
      language: 'gr',
      geospatialProfiles: region.profiles,
      fromDayIndex: dayIndex,
    });

    rows.push({
      regionId: region.regionId,
      fromDayIndex: dayIndex,
      beaufort: judged[dayIndex].beaufort,
      offered: Boolean(offer),
      offerDayIndex: offer?.dayIndex ?? null,
      offsetDays: offer ? offer.dayIndex - dayIndex : null,
      offerSwimmable: offer?.swimmableCount ?? null,
      /**
       * ΤΟ ΚΡΙΣΙΜΟ: η μέρα που προτείνουμε, κοιταγμένη ΩΣ σημερινή, δεν επιτρέπεται να είναι το
       * ίδιο αδιέξοδο. Αν βγει έστω μία, η πρόταση αντιφάσκει με τη σελίδα που θα δει ο κόσμος.
       */
      offerIsDeadEnd: offer ? judged[offer.dayIndex].deadEnd : null,
    });
  }

  return { regionId: region.regionId, days: days.length, judged, rows };
};

const results = [];
for (let i = 0; i < regions.length; i += 1) {
  const region = regions[i];
  process.stderr.write(`\r[${i + 1}/${regions.length}] ${region.regionId}                    `);
  try {
    results.push(await measureRegion(region));
  } catch (error) {
    results.push({ regionId: region.regionId, skipped: String(error?.message ?? error) });
  }
}
process.stderr.write('\r                                                             \r');

const rows = results.flatMap(result => result.rows ?? []);
const deadEnds = rows.length;
const offered = rows.filter(row => row.offered).length;
const contradictions = rows.filter(row => row.offerIsDeadEnd === true);
const byOffset = {};
for (const row of rows) {
  if (row.offsetDays == null) continue;
  byOffset[row.offsetDays] = (byOffset[row.offsetDays] ?? 0) + 1;
}
const judgedDays = results.flatMap(result => result.judged ?? []);

const summary = {
  measuredAt: new Date().toISOString(),
  regions: results.filter(result => result.rows).length,
  skipped: results.filter(result => result.skipped).map(result => ({ regionId: result.regionId, why: result.skipped })),
  regionDaysJudged: judgedDays.length,
  severeDays: judgedDays.filter(day => day.severe).length,
  deadEndDays: deadEnds,
  offered,
  offeredShare: pct(offered, deadEnds),
  silentAfterMeasure: deadEnds - offered,
  offsetHistogramDays: byOffset,
  contradictions: contradictions.length,
  contradictionRows: contradictions.slice(0, 20),
  rows,
};

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'best-day-ahead.json');
writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log('');
console.log(`Περιοχές μετρημένες:        ${summary.regions}${summary.skipped.length ? ` (παραλείφθηκαν ${summary.skipped.length})` : ''}`);
console.log(`Ημέρες×περιοχή κριμένες:    ${summary.regionDaysJudged}  (κακές: ${summary.severeDays})`);
console.log(`Αδιέξοδες μέρες:            ${deadEnds}`);
console.log(`  → με πρόταση άλλης μέρας: ${offered}  (${summary.offeredShare})`);
console.log(`  → σιωπή, όπως πριν:       ${summary.silentAfterMeasure}`);
console.log(`Απόσταση της πρότασης:      ${Object.entries(byOffset).map(([k, v]) => `+${k}μ: ${v}`).join(' · ') || '—'}`);
console.log(`ΑΝΤΙΦΑΣΕΙΣ (πρέπει 0):      ${contradictions.length}`);
console.log(`Αναφορά: ${path.relative(root, outPath)}`);

if (contradictions.length > 0) process.exitCode = 1;
