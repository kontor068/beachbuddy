#!/usr/bin/env node
/**
 * ΤΙ ΚΟΣΤΙΖΕΙ ΝΑ ΜΗΝ ΣΒΗΝΕΙ Ο ΦΡΑΧΤΗΣ ΤΗΣ ΓΡΑΜΜΗΣ ΗΡΕΜΙΑΣ ΤΗ ΜΕΤΡΗΜΕΝΗ ΑΠΟΔΕΙΞΗ — ΕΘΝΙΚΑ.
 *
 * ΑΦΟΡΜΗ. Ελαφονήσι (595), 22/08/2026: το νούμερο ΑΠΟΦΑΣΗΣ διορθώθηκε (0,88 → 0,41 μ., §Γ55)
 * και η οθόνη εξακολουθεί να δείχνει **0,8 μ.** Ο φράχτης `fallsIntoCalm`
 * (utils/beachConditionsReadout, commit c8385652 της 21/08) καρφώνει κάθε αριθμό ακτής που πέφτει
 * κάτω από τη γραμμή `SEA_STATE_AMBER_M` ενώ η ανοιχτή θάλασσα δεν έχει πέσει.
 *
 * ΤΙ ΕΙΝΑΙ ΤΟ ΕΠΙΧΕΙΡΗΜΑ ΤΟΥ ΦΡΑΧΤΗ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΚΑΛΥΠΤΕΙ ΑΥΤΗ ΤΗΝ ΠΕΡΙΠΤΩΣΗ. Μετρήθηκε σε δύο
 * μέρες μελτεμιού ότι η έκπτωση **×0,5 της προστατευμένης ακτής** σπρώχνει 105 (3,7%) και 178
 * (6,2%) παραλίες στη ζώνη «ήρεμα», και ότι **το 100% αυτών** κάθεται κάτω από πινέζα που ΔΕΝ
 * είναι ήρεμη. Δηλαδή ο φράχτης είναι απάντηση σε μια συγκεκριμένη ΕΙΚΑΣΙΑ. Το
 * `isSeaDepartingShore` δεν είναι εικασία: είναι η δηλωμένη κατεύθυνση κάθε συστατικού της
 * θάλασσας. Ο φράχτης δεν είχε τρόπο να τα ξεχωρίσει.
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΙ. Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ `calculateBeachScore` και τον ΠΡΑΓΜΑΤΙΚΟ
 * `buildBeachConditionsReadout` δύο φορές πάνω στα ΙΔΙΑ δεδομένα:
 *   ΠΡΙΝ — `shoreWaveIsMeasuredDeparting` σβηστό (η συμπεριφορά της 21/08)
 *   ΜΕΤΑ — το αληθινό πεδίο `scoreResult.shoreWaveFromDepartingSea`
 * Καμία λογική δεν αντιγράφεται εδώ.
 *
 * ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΚΡΙΝΕΙ. Ο φράχτης δικαιώθηκε επειδή στο 100% των περιπτώσεών του το χρώμα
 * διαφωνούσε με το νούμερο. Άρα η εξαίρεση επιτρέπεται ΜΟΝΟ αν εδώ συμβαίνει το αντίθετο. Το
 * script μετράει ρητά, για κάθε ώρα που η εξαίρεση ανάβει:
 *   • το χρώμα της πινέζας (`utils/suitabilityTone.resolveConditionTone` — ΤΟ ΙΔΙΟ που τρέχει
 *     ο χάρτης) και την ετυμηγορία κολύμβησης
 *   • πόσες από αυτές θα τύπωναν «ήρεμο» νούμερο κάτω από ΜΗ ήρεμη πινέζα → αυτές είναι το κόστος
 *   • τη λέξη της κάρτας πριν/μετά, γιατί «θάλασσα λάδι» είναι βαρύτερο από τα εκατοστά
 *
 * ΚΑΙ ΜΙΑ ΔΕΥΤΕΡΗ ΕΡΩΤΗΣΗ, ΠΟΥ ΠΡΟΕΚΥΨΕ ΓΡΑΦΟΝΤΑΣ ΤΟ: ο φράχτης ζει ΜΟΝΟ στο
 * `buildBeachConditionsReadout` — δηλαδή στην κάρτα και στην πινέζα. Η σελίδα της παραλίας
 * (pages/BeachDetailPage.tsx:2349) διαβάζει το ασυγκράτητο `shoreWaveHeightM`. Άρα οι δύο
 * επιφάνειες μπορεί ΗΔΗ να τυπώνουν διαφορετικό νούμερο για το ίδιο νερό. Μετριέται κι αυτό.
 *
 * REPORT-ONLY. Γράφει reports/weather/departing-sea-calm-fence-*.json.
 *
 *   node scripts/measureDepartingSeaCalmFence.mjs [--days=2025-08-14,2024-06-29]
 */
import './lib/paidOpenMeteo.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { buildBeachConditionsReadout, beachDecisionSeaStateM } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const DAYS = arg('days', '').split(',').map(s => s.trim()).filter(Boolean);
const REGION_FILTER = arg('regions', '').split(',').map(s => s.trim()).filter(Boolean);
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const regions = fs.readdirSync(summaryDir).filter(f => f.endsWith('.json'))
  .filter(f => !REGION_FILTER.length || REGION_FILTER.some(r => f.startsWith(r)));
console.log(`περιοχές: ${regions.length}${DAYS.length ? ` · μέρες: ${DAYS.join(', ')}` : ' · ζωντανά'}`);

/** Οι ίδιες τιμές που περνάει ο χάρτης στο resolveConditionTone (components/BeachMap). */
const pinTone = (s) => resolveConditionTone({
  exposureLevel: s.exposureLevel,
  beaufort: Math.round(s.windSpeedKmph ? (s.windSpeedKmph <= 5 ? 1 : Math.cbrt((s.windSpeedKmph / 3.6) ** 2)) : 0),
  seaStateM: beachDecisionSeaStateM(s.seaStateWaveM, s.waveHeightM, s.seaStatePeriodS),
  isEnclosedCove: s.enclosedCove,
  swimVerdictAvoid: s.swimmingComfort === 'avoid_swimming',
  seaArrivalExposureLevel: s.seaArrivalExposureLevel,
  windSpeedKmh: s.windSpeedKmph,
  forecastUncertain: s.forecastUncertain,
});
const CALM_TONES = new Set(['blue', 'calm', 'good', 'excellent']);

const rows = [];
let scored = 0;
let departingHours = 0;

for (const file of regions) {
  const island = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island;
  const list = island?.beaches;
  if (!Array.isArray(list) || !list.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }

  for (const cluster of buildBeachForecastClusters(list)) {
    const ids = cluster.beachIds.filter(id => profiles[String(id)]?.marineSamplePoint);
    if (!ids.length) continue;

    const windByPoint = await fetchForecastDataBatch([{ lat: cluster.lat, lon: cluster.lon }]);
    const windData = windByPoint.get(forecastPointKey(cluster.lat, cluster.lon))?.data;
    if (!windData) continue;

    for (const id of ids) {
      const profile = profiles[String(id)];
      const beach = list.find(b => b.id === id);
      if (!beach) continue;
      const mp = profile.marineSamplePoint;
      const marineByPoint = await fetchMarineForecastDataBatch([{ lat: mp.lat, lon: mp.lon }]);
      const marine = marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? [];
      const day = processForecastData(mergeMarineForecastData(windData, marine))[0];
      if (!day?.hourly) continue;

      for (const hour of HOURS) {
        const h = day.hourly[hour];
        if (!h) continue;
        const s = calculateBeachScore(beach, { ...day, ...h, hourly: day.hourly }, undefined, undefined, {
          weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile,
        });
        scored += 1;
        if (!s.shoreWaveFromDepartingSea) continue;
        departingHours += 1;

        const common = {
          beachWindSpeedKmph: s.windSpeedKmph,
          waveHeightM: s.waveHeightM,
          seaStateWaveM: s.seaStateWaveM,
          seaStatePeriodS: s.seaStatePeriodS,
          shoreWaveHeightM: s.shoreWaveHeightM,
          shoreDisplayWaveM: s.shoreDisplayWaveM,
          language: 'gr',
        };
        const before = buildBeachConditionsReadout(common);
        const after = buildBeachConditionsReadout({ ...common, shoreWaveIsMeasuredDeparting: true });
        if (before.waveText === after.waveText && before.waveWord === after.waveWord) continue;

        let tone;
        try { tone = pinTone(s); } catch { tone = undefined; }
        const toneName = typeof tone === 'string' ? tone : (tone?.tone ?? tone?.name ?? JSON.stringify(tone));
        rows.push({
          id, region: file.replace('.json', ''),
          name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
          day: DAYS[0] || 'ζωντανά', hour,
          openM: s.waveHeightM,
          printedBefore: before.waveText, printedAfter: after.waveText,
          wordBefore: before.waveWord, wordAfter: after.waveWord,
          shoreDisplayWaveM: s.shoreDisplayWaveM,
          detailPagePrints: s.shoreWaveHeightM,
          verdict: s.swimmingComfort,
          pin: toneName,
          pinIsCalm: CALM_TONES.has(String(toneName)),
        });
      }
    }
  }
  process.stdout.write(`\r  ${file.replace('.json', '').slice(0, 34).padEnd(34)} · βαθμολογήθηκαν ${scored} · υποψήφιες ${rows.length}   `);
}
console.log('\n');

console.log(`===== Ο ΦΡΑΧΤΗΣ ΚΑΙ Η ΜΕΤΡΗΜΕΝΗ ΑΠΟΔΕΙΞΗ =====`);
console.log(`ώρες×παραλία που βαθμολογήθηκαν:                 ${scored}`);
console.log(`ώρες όπου ο αριθμός ήρθε από «το νερό φεύγει»:   ${departingHours}`);
console.log(`ώρες όπου ο ΦΡΑΧΤΗΣ τις σβήνει (η εξαίρεση):     ${rows.length}  σε ${new Set(rows.map(r => r.id)).size} παραλίες`);

const underCalmPin = rows.filter(r => r.pinIsCalm);
const underBusyPin = rows.filter(r => !r.pinIsCalm);
console.log(`\nΤΟ ΚΡΙΣΙΜΟ ΝΟΥΜΕΡΟ — συμφωνεί το χρώμα με το νούμερο;`);
console.log(`  κάτω από ΗΡΕΜΗ πινέζα (συμφωνούν):        ${underCalmPin.length}`);
console.log(`  κάτω από ΜΗ ήρεμη πινέζα (διαφωνούν):     ${underBusyPin.length}   ← το κόστος`);
const avoid = rows.filter(r => r.verdict === 'avoid_swimming');
console.log(`  από αυτές, με «μην κολυμπήσεις»:          ${avoid.length}`);

const surfaceSplit = rows.filter(r => typeof r.detailPagePrints === 'number'
  && Math.abs(r.detailPagePrints - (r.shoreDisplayWaveM ?? r.detailPagePrints)) < 0.005);
console.log(`\nΚΑΡΤΑ vs ΣΕΛΙΔΑ ΠΑΡΑΛΙΑΣ (ήδη σήμερα, χωρίς καμία αλλαγή):`);
console.log(`  ώρες όπου η σελίδα τυπώνει ΤΟ ΧΑΜΗΛΟ και η κάρτα το φραγμένο: ${surfaceSplit.length}`);

console.log(`\n──── ΔΕΙΓΜΑ ────`);
for (const r of rows.slice(0, 25)) {
  console.log(`  ${String(r.name).slice(0, 22).padEnd(22)} ${r.region.slice(0, 20).padEnd(20)} ${String(r.hour).padStart(2)}h`
    + ` ανοιχτά ${String(r.openM).padStart(5)} | κάρτα ${String(r.printedBefore).padStart(8)} → ${String(r.printedAfter).padStart(8)}`
    + ` | σελίδα ${String(r.detailPagePrints).padStart(5)} | «${r.wordBefore}» → «${r.wordAfter}»`
    + ` | πινέζα ${r.pin} | ${r.verdict}`);
}

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `departing-sea-calm-fence-${DAYS[0] || 'live'}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  generatedFor: DAYS.length ? DAYS : ['live'],
  scoredBeachHours: scored, departingSeaHours: departingHours,
  fenceOverridesMeasuredEvidence: rows.length,
  beaches: new Set(rows.map(r => r.id)).size,
  underCalmPin: underCalmPin.length, underBusyPin: underBusyPin.length,
  avoidSwimming: avoid.length,
  rows,
}, null, 2), 'utf8');
console.log(`\nΓΡΑΦΤΗΚΕ: ${path.relative(root, outFile)}`);
