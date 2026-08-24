/**
 * ⚠️ 24/08/2026: η γωνία ΕΦΥΓΕ από την πόρτα των 5 (επιλογή D, utils/offshoreFlatWater) — το «χωρίς γωνία»
 * εδώ ΔΕΝ είναι πια υπόθεση, είναι η παραγωγή. Το εργαλείο μένει ως ιστορικό της μέτρησης.
 *
 * ΤΙ ΚΟΣΤΙΖΕΙ ΝΑ ΦΥΓΕΙ Η ΓΩΝΙΑ ΑΠΟ ΤΟ `offshoreFlatWater` — ΕΘΝΙΚΑ, ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ.
 *
 * Η βίβλος (§Μ6, §Γ «Η ΛΥΓΑΡΙΑ ΔΕΝ ΔΙΟΡΘΩΘΗΚΕ») λέει ότι το `offshoreFlatWater` κρίνει με τη
 * ΓΩΝΙΑ — `onshoreComponent(windFrom, facing) <= -0,8` — ενώ η μετρήσιμη αλήθεια είναι «ο άνεμος
 * ήρθε πάνω από στεριά». Στον μυχό ενός όρμου οι δύο ερωτήσεις αποκλίνουν, γιατί το `facingDeg`
 * είναι η κατεύθυνση του ΣΤΟΜΙΟΥ, όχι η μεριά απ' όπου ήρθε ο αέρας. Λυγαριά: άνεμος 314°,
 * στεριά 0,2 χλμ. προς τα εκεί, onshore +0,24 → η πύλη δεν ανάβει.
 *
 * ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ. Μετράει μόνο. Ο κανόνας της §7δ είναι ότι κάθε εξαίρεση
 * μετριέται ΕΘΝΙΚΑ πριν γραφτεί, είναι ΜΟΝΟΔΡΟΜΗ, και έχει δική της πύλη — και η σκανδάλη #1
 * της §9 λέει ότι ό,τι κάνει παραλία να φαίνεται πιο ήρεμη θέλει μέτρηση ΠΡΙΝ και απόφαση Μίλτου.
 *
 * ΤΙ ΕΙΝΑΙ «ΠΡΙΝ» ΚΑΙ ΤΙ «ΜΕΤΑ»
 *   • ΠΡΙΝ  = `holdsFlatWaterUnderOffshoreWind`, η ΠΡΑΓΜΑΤΙΚΗ εξαγόμενη συνάρτηση του προϊόντος.
 *   • ΜΕΤΑ  = οι ΙΔΙΕΣ σταθερές και οι ΙΔΙΟΙ βοηθοί, με τη μία γραμμή της γωνίας αφαιρεμένη.
 * Δηλαδή μόνο η υπόθεση είναι αντιγραμμένη εδώ· η βάση σύγκρισης τρέχει τον αληθινό κώδικα. Αν
 * κάποια μέρα αλλάξει η σύνθεση του `sectorHoldsNoWindWave`, το `selfCheck()` παρακάτω σκάει.
 *
 * ΜΟΝΟΔΡΟΜΗ ΕΞ ΟΡΙΣΜΟΥ: η αφαίρεση ενός φίλτρου μόνο ΠΡΟΣΘΕΤΕΙ περιπτώσεις. Καμία παραλία δεν
 * μπορεί να χάσει την ανακούφιση — γι' αυτό ο κίνδυνος είναι αποκλειστικά «ψεύτικη ηρεμία» και
 * το νούμερο που μετράμε είναι πόσες παραλίες γίνονται πιο ήρεμες, και με τι δικαιολογία.
 *
 * Τρέξιμο:  node scripts/measureOffshoreAngleGate.mjs --live [--regions=a,b] [--days=6]
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
// Στέλνει τα αιτήματα στο ΠΛΗΡΩΜΕΝΟ πλάνο όταν υπάρχει κλειδί στο περιβάλλον, αλλιώς δεν αλλάζει
// τίποτα. Χωρίς αυτό η εθνική μέτρηση ξοδεύει το δωρεάν όριο και σταματάει με 429 στη μέση.
import './lib/paidOpenMeteo.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Ίδιος φορτωτής TypeScript με το scripts/measureColourCauseSplit.mjs: τα αρχεία του προϊόντος
// διαβάζονται αυτούσια, ώστε η μέτρηση να τρέχει τον κώδικα που βλέπει ο επισκέπτης.
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

const { getBeaufortLevel, processForecastData, applyMarineToDailyForecast } =
  require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } =
  require(path.join(root, 'utils/marineSamplePoints.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const {
  holdsFlatWaterUnderOffshoreWind,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
  OFFSHORE_FLAT_MAX_INTENSITY,
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MAX_MODELLED_WAVE_M,
  OFFSHORE_FLAT_MAX_ONSHORE,
  OFFSHORE_FLAT_BEAUFORT,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));

/** Ίδια σταθερά με το utils/offshoreFlatWater: κορυφή της ζώνης 5 Μποφ. */
const BEAUFORT_5_REFERENCE_WIND_KMH = 38;

const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.error('Χρειάζεται --live: η μέτρηση τραβάει πραγματική πρόγνωση για κάθε περιοχή.');
  process.exit(1);
}
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length)?.split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 6);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');

/**
 * Ο ΠΥΡΗΝΑΣ ΧΩΡΙΣ ΤΗ ΓΡΑΜΜΗ ΤΗΣ ΓΩΝΙΑΣ.
 *
 * Αντιγράφει `sectorHoldsNoWindWave` (utils/offshoreFlatWater.ts:113-139) γραμμή προς γραμμή,
 * ΕΚΤΟΣ από το τελικό `onshoreComponent(...) <= OFFSHORE_FLAT_MAX_ONSHORE`. Επιστρέφει και το
 * `onshore` που ΘΑ έκοβε, ώστε η αναφορά να δείχνει πόσο μακριά από το κατώφλι ήταν η κάθε μία.
 */
const sectorHoldsNoWindWaveWithoutAngle = (profile, windDirectionDeg) => {
  if (!profile) return null;
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return null;

  const facingDeg = profile.facingDeg;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return null;
  if (profile.confidence !== 'high' && profile.confidence !== 'medium') return null;

  const sector = profile.sectors?.[windSectorFromDegrees(windDirectionDeg)];
  if (!sector || sector.level !== 'protected') return null;
  if (sector.blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return null;
  if (typeof sector.intensity !== 'number' || sector.intensity >= OFFSHORE_FLAT_MAX_INTENSITY) return null;
  if (sector.fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return null;

  const modelledM = estimateFetchLimitedWaveHeightM({
    windSpeedKmh: BEAUFORT_5_REFERENCE_WIND_KMH,
    fetchKm: sector.fetchKm,
  });
  if (typeof modelledM === 'number' && modelledM > OFFSHORE_FLAT_MAX_MODELLED_WAVE_M) return null;

  return {
    onshore: onshoreComponent(windDirectionDeg, facingDeg),
    fetchKm: sector.fetchKm,
    facingDeg,
    modelledM,
  };
};

/**
 * ΑΥΤΟΕΛΕΓΧΟΣ: αν η αντιγραφή παραπάνω αποκλίνει από τον αληθινό κώδικα, η μέτρηση είναι άχρηστη.
 * Οδηγεί και τις δύο εκδοχές με κατασκευασμένο προφίλ όπου η γωνία ΠΕΡΝΑΕΙ: εκεί οι δύο ΠΡΕΠΕΙ
 * να συμφωνούν. Αν δεν συμφωνούν, κάποιο άλλο φίλτρο έχει αλλάξει και το σκριπτ σταματάει.
 */
const selfCheck = () => {
  const windFrom = 180; // ακριβώς αντίθετα από το facing → onshore = −1, περνάει τη γωνία
  const profile = {
    facingDeg: 0,
    confidence: 'high',
    // Το κλειδί του τομέα το δίνει η ΙΔΙΑ συνάρτηση που χρησιμοποιεί το προϊόν — γραμμένο με το
    // χέρι, ο αυτοέλεγχος θα απέτυχε επειδή το τεστ ήταν λάθος, όχι ο κώδικας.
    sectors: { [windSectorFromDegrees(windFrom)]: { level: 'protected', blockedRayRatio: 1, intensity: 0, fetchKm: 0.1 } },
  };
  const real = holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg: windFrom, beaufort: OFFSHORE_FLAT_BEAUFORT, swellWaveHeightM: 0 }); // 24/08: βέτο αποθαλασσιάς, άγνωστη = βέτο
  const mirrored = sectorHoldsNoWindWaveWithoutAngle(profile, windFrom);
  if (!mirrored) {
    console.error('ΑΥΤΟΕΛΕΓΧΟΣ: ο αντιγραμμένος πυρήνας κόβει εκεί που ο αληθινός δεν κόβει.');
    process.exit(1);
  }
  if (real !== (mirrored.onshore <= OFFSHORE_FLAT_MAX_ONSHORE)) {
    console.error('ΑΥΤΟΕΛΕΓΧΟΣ: πραγματικός και αντιγραμμένος πυρήνας διαφωνούν — η αντιγραφή ξεπέρασε.');
    process.exit(1);
  }
};
selfCheck();

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return {
      regionId: file.replace(/\.json$/, ''),
      beaches: app.island.beaches,
      regionPoint: app.island.coordinates,
      profiles,
    };
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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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

const totals = {
  beachDays: 0,
  atFiveBeaufort: 0,
  litNow: 0,
  litAfter: 0,
  newlyLit: 0,
  regionsMeasured: 0,
  regionsSkipped: 0,
};
/**
 * Χωρίς αυτό, ένα «0 στα 5 Μποφ» διαβάζεται ως «δεν υπάρχει πρόβλημα» ενώ μπορεί να σημαίνει
 * «η μέτρηση διαβάζει λάθος πεδίο». Η κατανομή το ξεχωρίζει με μια ματιά.
 */
const beaufortHistogram = {};
const newlyLitRows = [];
const beachesNewlyLit = new Set();

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  await paceForPoints(resolution.points.length + 1);

  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);

  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { skipped: 'χωρίς άνεμο' };
  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const days = processForecastData(mergeMarineForecastData(wind.data, regionMarine)).slice(0, DAYS);
  if (!days.length) return { skipped: 'χωρίς ημέρα πρόγνωσης' };

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const regionDay = days[dayIndex];
    for (const beach of region.beaches) {
      const key = resolution.keyByBeachId.get(beach.id);
      const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;

      const profile = region.profiles[beach.id];
      const windDirectionDeg = dayForecast.wind?.deg;
      const beaufort = getBeaufortLevel((dayForecast.wind?.speed ?? 0) * 3.6);

      totals.beachDays += 1;
      beaufortHistogram[beaufort] = (beaufortHistogram[beaufort] ?? 0) + 1;
      if (beaufort !== OFFSHORE_FLAT_BEAUFORT) continue;
      totals.atFiveBeaufort += 1;

      const now = holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort, swellWaveHeightM: 0 }); // ΣΗΜ. 24/08: το εργαλείο δεν έχει θάλασσα ανά παραλία — μετράει μόνο τη γεωμετρία
      if (now) totals.litNow += 1;

      const after = sectorHoldsNoWindWaveWithoutAngle(profile, windDirectionDeg);
      if (!after) continue;
      totals.litAfter += 1;
      if (now) continue;

      totals.newlyLit += 1;
      beachesNewlyLit.add(`${region.regionId}#${beach.id}`);
      newlyLitRows.push({
        regionId: region.regionId,
        beachId: beach.id,
        name: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
        dayIndex,
        windFromDeg: Math.round(windDirectionDeg),
        facingDeg: Math.round(after.facingDeg),
        onshore: Number(after.onshore.toFixed(2)),
        fetchKm: after.fetchKm,
        modelledWaveM: after.modelledM == null ? null : Number(after.modelledM.toFixed(3)),
      });
    }
  }
  return { ok: true };
};

console.log(`── ΖΩΝΤΑΝΟ: ${regions.length} περιοχές × ${DAYS} μέρες ──`);
for (let i = 0; i < regions.length; i += 1) {
  const region = regions[i];
  process.stderr.write(`\r  ${i + 1}/${regions.length} ${region.regionId}                    `);
  try {
    const result = await measureRegion(region);
    if (result.skipped) totals.regionsSkipped += 1;
    else totals.regionsMeasured += 1;
  } catch (error) {
    totals.regionsSkipped += 1;
    process.stderr.write(`\n  ⚠️ ${region.regionId}: ${error?.message ?? error}\n`);
  }
}
process.stderr.write('\r                                                        \r');

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(2)}%`;

console.log('');
console.log('ΤΙ ΚΟΣΤΙΖΕΙ ΝΑ ΦΥΓΕΙ Η ΓΩΝΙΑ');
console.log(`  περιοχές μετρημένες      ${totals.regionsMeasured} (παραλείφθηκαν ${totals.regionsSkipped})`);
console.log(`  παραλιο-ημέρες           ${totals.beachDays}`);
console.log(`  στα 5 Μποφ (η ζώνη)      ${totals.atFiveBeaufort} · ${pct(totals.atFiveBeaufort, totals.beachDays)}`);
console.log(`  ανάβει ΣΗΜΕΡΑ            ${totals.litNow}`);
console.log(`  θα άναβε ΧΩΡΙΣ ΓΩΝΙΑ     ${totals.litAfter}`);
console.log(`  ΝΕΕΣ (πιο ήρεμες)        ${totals.newlyLit} · ${pct(totals.newlyLit, totals.beachDays)} των παραλιο-ημερών`);
console.log(`  ξεχωριστές παραλίες      ${beachesNewlyLit.size}`);
console.log(`  κατανομή Μποφ            ${Object.entries(beaufortHistogram).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' ')}`);

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'offshore-angle-gate.json');
writeFileSync(outPath, `${JSON.stringify({
  question: 'Πόσες παραλίες γίνονται πιο ήρεμες αν το offshoreFlatWater πάψει να κρίνει με τη γωνία και μείνει μόνο στα γεωμετρικά φίλτρα (κλειστός τομέας, μηδενικό άνοιγμα, μοντέλο κύματος);',
  oneDirectional: 'Ναι εξ ορισμού: αφαίρεση φίλτρου μόνο προσθέτει. Καμία παραλία δεν χάνει ανακούφιση.',
  days: DAYS,
  totals,
  beaufortHistogram,
  distinctBeaches: [...beachesNewlyLit].sort(),
  rows: newlyLitRows,
}, null, 2)}\n`, 'utf8');
console.log(`\nΑναφορά: ${path.relative(root, outPath)}`);
