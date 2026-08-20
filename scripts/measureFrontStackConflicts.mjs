#!/usr/bin/env node
/**
 * ΟΙ ΑΝΕΞΕΤΑΣΤΕΣ ΣΥΓΚΡΟΥΣΕΙΣ ΤΟΥ ΧΑΡΤΗ (C7, C8, C10, C12) — ΜΕΤΡΗΣΗ, ΟΧΙ ΓΝΩΜΗ.
 *
 * Ο χάρτης συγκρούσεων της 18/08/2026 (run wf_b1a81985-bc7) άφησε 6 υποψήφιες αδοκίμαστες.
 * Οι τέσσερις ζουν στην ίδια αλυσίδα και μετριούνται με ΕΝΑ πέρασμα, γιατί όλες ρωτούν το ίδιο:
 * τι αλλάζει στην οθόνη όταν δύο μέτωπα γράφουν το ίδιο νούμερο.
 *
 *   C7  τριπλή χρέωση στο «ενεργό Μποφόρ»: ο δάπεδος ριπής ανεβάζει τη βάση ΚΑΙ ξεκλειδώνει
 *       το +1 του spread· το δάπεδο 0,6 προσθέτει το +1 του «όχι protected» και αρνείται το −1.
 *   C8  ένα κύμα, τρεις συγγραφείς: ταχύτητα (Α), ετικέτα έκθεσης (Γ), ανάπτυγμα (Δ).
 *   C10 ο διαιρέτης της πύλης «ήσυχη θάλασσα» ανήκει στον τομέα ΑΦΙΞΗΣ, που τον γράφουν Γ και Δ.
 *   C12 ο δάπεδος βάφει κίτρινο στα 4 Μποφ. και το glass-at-four το ξαναβάφει μπλε.
 *
 * ΜΕΘΟΔΟΣ: για κάθε παραλιο-ημέρα τρέχει η ΠΡΑΓΜΑΤΙΚΗ calculateBeachScore δύο φορές — μία με
 * την πρόγνωση όπως έρχεται (δάπεδος ενεργός) και μία με τον ωμό μέσο ξαναγυρισμένο στη θέση
 * του (`speedBeforeGustFloor`). Καμία επανυλοποίηση κανόνα.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/front-stack-conflicts-<ημερομηνία>.json.
 *
 *   node scripts/measureFrontStackConflicts.mjs --live [--days=3] [--regions=a,b]
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { enablePaidOpenMeteo } from './lib/paidOpenMeteo.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ensurePaidPlan = async () => {
  if (process.env.OPEN_METEO_API_KEY) return enablePaidOpenMeteo({ quiet: true });
  try {
    const token = (readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    const siteId = JSON.parse(readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    if (!token || !siteId) return false;
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    const key = ((await res.json()).values || []).map(v => v.value).find(Boolean);
    if (!key) return false;
    process.env.OPEN_METEO_API_KEY = key;
    return enablePaidOpenMeteo({ quiet: true });
  } catch { return false; }
};

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\n', filename);
    return;
  }
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
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

const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { holdsGlassWaterAtFourBeaufort } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getWindChopWaveFloorM } = require(path.join(root, 'utils/waveModel.ts'));

const args = process.argv.slice(2);
if (!args.includes('--live')) { console.error('Χρειάζεται --live.'); process.exit(1); }
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length)?.split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 3);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/weather');

/** Η σειρά που χρησιμοποιεί το προϊόν: από το χειρότερο στο καλύτερο. */
const COMFORT = ['avoid_swimming', 'caution', 'good', 'excellent'];

/** Ξαναβάζει τον ωμό μέσο στη θέση του: το «πριν τον δάπεδο» χωρίς να πειραχτεί ο κώδικας. */
const stripFloor = (day) => {
  const undo = (wind) => {
    if (!wind) return wind;
    const next = { ...wind };
    if (typeof wind.speedBeforeGustFloor === 'number' && Number.isFinite(wind.speedBeforeGustFloor)) {
      next.speed = wind.speedBeforeGustFloor;
    }
    delete next.speedBeforeGustFloor;
    return next;
  };
  const next = { ...day, wind: undo(day.wind) };
  if (Array.isArray(day.hourly)) next.hourly = day.hourly.map(item => (item?.wind ? { ...item, wind: undo(item.wind) } : item));
  return next;
};

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch { return null; }
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
    const cutoff = performance.now() - 60000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    const waitMs = Math.max(1000, pointWindow[0].at + 60000 - performance.now());
    process.stderr.write(`\r  rate limit: ${spent} σημεία, αναμονή ${Math.ceil(waitMs / 1000)}s…        `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

const t = {
  regionsMeasured: 0, regionsSkipped: 0, beachDays: 0,
  floorTouched: 0, bftRaised: 0, comfortMoved: 0, comfortMoved2Plus: 0, comfortMovedMilder: 0,
  spreadBumpUnlocked: 0, doubleCharge: 0, tripleCharge: 0, reliefDeniedByLabel: 0,
  waveMoved: 0, waveCrossed05: 0, waveCrossed08: 0, waveSumDelta: 0, waveMaxDelta: 0,
  labelWorthGe010: 0, labelWorthGe015: 0, labelSumM: 0,
  gateEvaluated: 0, gateActualPass: 0, gateFlipsWithArrival: 0, gateOnlyIfProtectedArrival: 0,
  gateBlockedByArrival: 0, arrivalUnknown: 0, arrivalProtected: 0, arrivalNotProtected: 0,
  glassPass: 0, glassChangesTone: 0, cancellation: 0, cancellationBeaches: 0,
};
const cancellationRows = [];
const milderRows = [];
const tripleRows = [];
const gateFlipRows = [];
const cancelBeachSet = new Set();
const byRegionCancel = new Map();

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
      const opts = { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: profile };

      const withFloor = calculateBeachScore(beach, dayForecast, undefined, undefined, opts);
      const bare = stripFloor(dayForecast);
      const noFloor = calculateBeachScore(beach, bare, undefined, undefined, { ...opts, hourlyForecast: bare.hourly });

      t.beachDays += 1;
      const bftW = withFloor.simpleWindSuitability?.windBeaufort ?? 0;
      const bftN = noFloor.simpleWindSuitability?.windBeaufort ?? 0;
      const rawMeanKmh = typeof dayForecast.wind?.speedBeforeGustFloor === 'number'
        ? dayForecast.wind.speedBeforeGustFloor * 3.6 : (dayForecast.wind?.speed ?? 0) * 3.6;
      const gustKmh = typeof dayForecast.wind?.gust === 'number' ? dayForecast.wind.gust * 3.6 : undefined;
      if (typeof dayForecast.wind?.speedBeforeGustFloor === 'number') t.floorTouched += 1;

      // ── C7: πόσα σκαλιά κουνάει ΜΟΝΟ ο δάπεδος, και πού συσσωρεύεται ─────────
      if (bftW > bftN) t.bftRaised += 1;
      const cW = COMFORT.indexOf(withFloor.swimmingComfort);
      const cN = COMFORT.indexOf(noFloor.swimmingComfort);
      if (cW >= 0 && cN >= 0 && cW !== cN) {
        t.comfortMoved += 1;
        // Ο δάπεδος είναι Math.max — ΔΕΝ επιτρέπεται να βγάλει ηπιότερη ετυμηγορία. Κάθε τέτοια
        // γραμμή είναι παραβίαση του μονόδρομου, όχι στατιστικό.
        if (cW > cN) {
          t.comfortMovedMilder += 1;
          if (milderRows.length < 60) milderRows.push({
            region: region.regionId, id: beach.id, name: beach.name?.gr ?? beach.name?.en, dayIndex,
            rawMeanKmh: Number(rawMeanKmh.toFixed(1)), flooredKmh: Number((withFloor.windSpeedKmph ?? 0).toFixed(1)),
            gustKmh: gustKmh == null ? null : Number(gustKmh.toFixed(1)),
            bftNoFloor: bftN, bftWithFloor: bftW, exposure: withFloor.exposureLevel,
            comfortNoFloor: noFloor.swimmingComfort, comfortWithFloor: withFloor.swimmingComfort,
            waveNoFloor: noFloor.waveHeightM, waveWithFloor: withFloor.waveHeightM,
            seaStateNoFloor: noFloor.seaStateWaveM, seaStateWithFloor: withFloor.seaStateWaveM,
            periodNoFloor: noFloor.seaStatePeriodS, periodWithFloor: withFloor.seaStatePeriodS,
          });
        }
        if (Math.abs(cW - cN) >= 2) t.comfortMoved2Plus += 1;
      }
      const spreadKmh = typeof gustKmh === 'number' ? gustKmh - rawMeanKmh : 0;
      const spreadUnlocked = bftW >= 3 && bftN < 3 && spreadKmh >= 22;
      if (spreadUnlocked) t.spreadBumpUnlocked += 1;
      const notProtected = withFloor.exposureLevel !== 'protected';
      const doubleCharge = spreadUnlocked && bftW > bftN;
      if (doubleCharge) t.doubleCharge += 1;
      const tripleCharge = doubleCharge && bftW >= 4 && bftN < 4 && notProtected;
      if (tripleCharge) {
        t.tripleCharge += 1;
        if (tripleRows.length < 40) tripleRows.push({
          region: region.regionId, id: beach.id, name: beach.name, dayIndex,
          rawMeanKmh: Number(rawMeanKmh.toFixed(1)), gustKmh: gustKmh == null ? null : Number(gustKmh.toFixed(1)),
          bftNoFloor: bftN, bftWithFloor: bftW, exposure: withFloor.exposureLevel,
          comfortNoFloor: noFloor.swimmingComfort, comfortWithFloor: withFloor.swimmingComfort,
        });
      }
      // Το −1 της ανακούφισης το αρνείται η ΕΤΙΚΕΤΑ, όχι ο άνεμος: protected θα το έπαιρνε.
      if (notProtected && bftW <= 5 && (withFloor.waveHeightM ?? 0) < 0.5) t.reliefDeniedByLabel += 1;

      // ── C8: πόσο κουνάει το τυπωμένο κύμα ο δάπεδος, και πόσο αξίζει η ΕΤΙΚΕΤΑ ─
      const wW = withFloor.waveHeightM, wN = noFloor.waveHeightM;
      if (typeof wW === 'number' && typeof wN === 'number') {
        const d = Math.abs(wW - wN);
        if (d >= 0.01) {
          t.waveMoved += 1; t.waveSumDelta += d; t.waveMaxDelta = Math.max(t.waveMaxDelta, d);
          if ((wN < 0.5) !== (wW < 0.5)) t.waveCrossed05 += 1;
          if ((wN < 0.8) !== (wW < 0.8)) t.waveCrossed08 += 1;
        }
      }
      // Η αξία της ετικέτας σε μέτρα: ίδιος άνεμος, ίδια ριπή, μόνο protected→partial.
      const floorProt = getWindChopWaveFloorM('protected', bftW, withFloor.windSpeedKmph, gustKmh, rawMeanKmh) ?? 0;
      const floorPart = getWindChopWaveFloorM('partial', bftW, withFloor.windSpeedKmph, gustKmh, rawMeanKmh) ?? 0;
      const labelWorth = Math.abs(floorPart - floorProt);
      t.labelSumM += labelWorth;
      if (labelWorth >= 0.10) t.labelWorthGe010 += 1;
      if (labelWorth >= 0.15) t.labelWorthGe015 += 1;

      // ── C10 + C12: η πύλη των 4 Μποφ. ────────────────────────────────────────
      if (bftW !== 4 || withFloor.exposureLevel !== 'protected') continue;
      t.gateEvaluated += 1;
      const gateArgs = {
        profile,
        windDirectionDeg: dayForecast.wind?.deg,
        beaufort: bftW,
        seaStateM: seaStateSeverityM(withFloor.seaStateWaveM, withFloor.seaStatePeriodS),
        exposureLevel: withFloor.exposureLevel,
        swellWaveHeightM: withFloor.marine?.swellWaveHeightM,
        curatedWindOnlyProtection: false,
      };
      const arrival = withFloor.seaArrivalExposureLevel;
      if (arrival === undefined || arrival === null) t.arrivalUnknown += 1;
      else if (arrival === 'protected') t.arrivalProtected += 1;
      else t.arrivalNotProtected += 1;
      const gateActual = holdsGlassWaterAtFourBeaufort({ ...gateArgs, seaArrivalExposureLevel: arrival });
      const gateProt = holdsGlassWaterAtFourBeaufort({ ...gateArgs, seaArrivalExposureLevel: 'protected' });
      const gatePart = holdsGlassWaterAtFourBeaufort({ ...gateArgs, seaArrivalExposureLevel: 'partial' });
      if (gateActual) t.gateActualPass += 1;
      if (gateProt !== gatePart) {
        t.gateFlipsWithArrival += 1;
        if (gateProt && !gatePart) {
          if (gateActual) t.gateOnlyIfProtectedArrival += 1;
          else t.gateBlockedByArrival += 1;
        }
        if (gateFlipRows.length < 40) gateFlipRows.push({
          region: region.regionId, id: beach.id, name: beach.name, dayIndex, arrival: arrival ?? null,
          seaSeverityM: Number((gateArgs.seaStateM ?? 0).toFixed(2)),
          passesIfProtectedArrival: gateProt, passesIfPartialArrival: gatePart, actual: gateActual,
        });
      }

      if (!gateActual) continue;
      t.glassPass += 1;
      const toneInput = {
        exposureLevel: withFloor.exposureLevel,
        beaufort: bftW,
        isEnclosedCove: Boolean(withFloor.enclosedCove),
        seaStateM: gateArgs.seaStateM,
        offshoreFlatWater: Boolean(withFloor.simpleWindSuitability?.offshoreFlatWater),
        downwindSeaSample: Boolean(withFloor.simpleWindSuitability?.downwindSeaSample),
        swimVerdictAvoid: withFloor.swimmingComfort === 'avoid_swimming',
        seaArrivalExposureLevel: arrival,
      };
      const toneWithGate = resolveConditionTone({ ...toneInput, glassWaterAtFour: true });
      const toneWithoutGate = resolveConditionTone({ ...toneInput, glassWaterAtFour: false });
      if (toneWithGate === toneWithoutGate) continue;
      t.glassChangesTone += 1;
      // C12: η ίδια ώρα ήταν ≤3 Μποφ. πριν τον δάπεδο — ο δάπεδος την ανέβασε, η πύλη τη γύρισε.
      if (bftN < 4) {
        t.cancellation += 1;
        cancelBeachSet.add(`${region.regionId}#${beach.id}`);
        byRegionCancel.set(region.regionId, (byRegionCancel.get(region.regionId) ?? 0) + 1);
        if (cancellationRows.length < 60) cancellationRows.push({
          region: region.regionId, id: beach.id, name: beach.name, dayIndex,
          rawMeanKmh: Number(rawMeanKmh.toFixed(1)), flooredKmh: Number((withFloor.windSpeedKmph ?? 0).toFixed(1)),
          gustKmh: gustKmh == null ? null : Number(gustKmh.toFixed(1)),
          gustRatio: gustKmh && rawMeanKmh > 0 ? Number((gustKmh / rawMeanKmh).toFixed(2)) : null,
          bftNoFloor: bftN, bftWithFloor: bftW,
          toneWithoutGate, toneWithGate,
          seaSeverityM: Number((gateArgs.seaStateM ?? 0).toFixed(2)),
          swimWithFloor: withFloor.swimmingComfort, swimNoFloor: noFloor.swimmingComfort,
        });
      }
    }
  }
  return { ok: true };
};

const paid = await ensurePaidPlan();
console.log(`  Open-Meteo: ${paid ? 'ΠΛΗΡΩΜΕΝΟ πλάνο' : '⚠️ ΔΩΡΕΑΝ όριο'}`);
console.log(`── ${regions.length} περιοχές × ${DAYS} μέρες ──`);
for (let i = 0; i < regions.length; i += 1) {
  const region = regions[i];
  process.stderr.write(`\r  ${i + 1}/${regions.length} ${region.regionId}                    `);
  try {
    const result = await measureRegion(region);
    if (result.skipped) t.regionsSkipped += 1; else t.regionsMeasured += 1;
  } catch (error) {
    t.regionsSkipped += 1;
    process.stderr.write(`\n  ⚠️ ${region.regionId}: ${error?.message ?? error}\n`);
  }
}
process.stderr.write('\r                                                            \r');
t.cancellationBeaches = cancelBeachSet.size;

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(2)}%`;
console.log('');
console.log(`ΠΑΡΑΛΙΟ-ΗΜΕΡΕΣ ${t.beachDays} · περιοχές ${t.regionsMeasured} (χάθηκαν ${t.regionsSkipped})`);
console.log('');
console.log('C7 — ΤΡΙΠΛΗ ΧΡΕΩΣΗ ΣΤΟ ΕΝΕΡΓΟ ΜΠΟΦΟΡ');
console.log(`  ο δάπεδος αγγίζει την ώρα        ${t.floorTouched} · ${pct(t.floorTouched, t.beachDays)}`);
console.log(`  ανεβάζει το Μποφόρ               ${t.bftRaised}`);
console.log(`  αλλάζει την ετυμηγορία           ${t.comfortMoved} (προς ηπιότερο ${t.comfortMovedMilder})`);
console.log(`  ≥2 σκαλιά ετυμηγορίας            ${t.comfortMoved2Plus}`);
console.log(`  ΞΕΚΛΕΙΔΩΝΕΙ το +1 του spread     ${t.spreadBumpUnlocked}`);
console.log(`  ΔΙΠΛΗ χρέωση (βάση + spread)     ${t.doubleCharge}`);
console.log(`  ΤΡΙΠΛΗ (+ «όχι protected»)       ${t.tripleCharge}`);
console.log('');
console.log('C8 — ΕΝΑ ΚΥΜΑ, ΤΡΕΙΣ ΣΥΓΓΡΑΦΕΙΣ');
console.log(`  κουνιέται το τυπωμένο κύμα       ${t.waveMoved} · μέση μεταβολή ${(t.waveSumDelta / Math.max(1, t.waveMoved)).toFixed(3)}μ · μέγιστη ${t.waveMaxDelta.toFixed(2)}μ`);
console.log(`  περνάει το 0,5μ                  ${t.waveCrossed05}`);
console.log(`  περνάει το 0,8μ                  ${t.waveCrossed08}`);
console.log(`  η ΕΤΙΚΕΤΑ αξίζει ≥0,10μ          ${t.labelWorthGe010} · ≥0,15μ ${t.labelWorthGe015} · μέσος όρος ${(t.labelSumM / Math.max(1, t.beachDays)).toFixed(3)}μ`);
console.log('');
console.log('C10 — Ο ΔΙΑΙΡΕΤΗΣ ΤΗΣ ΠΥΛΗΣ ΑΝΗΚΕΙ ΣΤΟΝ ΤΟΜΕΑ ΑΦΙΞΗΣ');
console.log(`  πύλη κρίνεται (4 Μποφ.+protected) ${t.gateEvaluated}`);
console.log(`  τομέας άφιξης: άγνωστος ${t.arrivalUnknown} · protected ${t.arrivalProtected} · άλλο ${t.arrivalNotProtected}`);
console.log(`  ΑΛΛΑΖΕΙ ΑΠΑΝΤΗΣΗ με τον τομέα     ${t.gateFlipsWithArrival}`);
console.log(`    περνάει ΜΟΝΟ χάρη σε protected  ${t.gateOnlyIfProtectedArrival}`);
console.log(`    ΚΟΒΕΤΑΙ επειδή δεν είναι        ${t.gateBlockedByArrival}`);
console.log('');
console.log('C12 — Ο ΔΑΠΕΔΟΣ ΒΑΦΕΙ, Η ΠΥΛΗ ΞΕΒΑΦΕΙ');
console.log(`  η πύλη περνάει                   ${t.glassPass}`);
console.log(`  και αλλάζει χρώμα                ${t.glassChangesTone}`);
console.log(`  ΑΚΥΡΩΣΗ (ήταν ≤3 χωρίς δάπεδο)   ${t.cancellation} · ${t.cancellationBeaches} παραλίες`);
if (byRegionCancel.size) {
  console.log('  περιοχές:');
  for (const [rg, c] of [...byRegionCancel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${String(c).padStart(4)} · ${rg}`);
}

mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const out = path.join(reportDir, `front-stack-conflicts-${stamp}.json`);
writeFileSync(out, JSON.stringify({
  measuredAt: new Date().toISOString(), days: DAYS, totals: t,
  cancellationRows, tripleRows, gateFlipRows, milderRows,
  cancellationByRegion: Object.fromEntries(byRegionCancel),
}, null, 2));
console.log(`\nγράφτηκε ${path.relative(root, out)}`);
