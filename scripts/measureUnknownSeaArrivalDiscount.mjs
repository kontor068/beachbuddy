#!/usr/bin/env node
/**
 * ΤΙ ΚΟΣΤΙΖΕΙ ΤΟ «ΔΕΝ ΞΕΡΩ ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ Η ΘΑΛΑΣΣΑ» — ΕΘΝΙΚΑ (C10).
 *
 * ΑΦΟΡΜΗ. Μετρήθηκε 20/08/2026 ότι στις κρίσεις της πύλης «απόγειος-γυαλί των 4» ο τομέας
 * άφιξης κύματος είναι ΑΓΝΩΣΤΟΣ στο 92,3%, και το `utils/waveCharacter.ts:305-313` δίνει και
 * στο `undefined` την έκπτωση ×0,5 στο ύψος. Πριν αλλάξει οτιδήποτε πρέπει να απαντηθεί κάτι
 * που η πρώτη μέτρηση ΔΕΝ ρώτησε: ΓΙΑΤΙ είναι άγνωστος.
 *
 * Η `utils/seaArrival.resolveSeaArrivalExposureLevel` σωπαίνει για ΤΕΣΣΕΡΙΣ διαφορετικούς
 * λόγους, και δεν είναι ίδιοι:
 *   1. χωρίς γεωμετρικό προφίλ            → τυφλοί
 *   2. χωρίς κατεύθυνση κύματος (marine)  → τυφλοί
 *   3. χωρίς όψη ακτής (facingDeg)        → τυφλοί
 *   4. onshore ≤ 0,3 — η θάλασσα ΔΕΝ έρχεται προς την ακτή → ΣΚΟΠΙΜΗ σιωπή, η έκπτωση σωστή
 * Αν κυριαρχεί το 4, η έκπτωση είναι δικαιολογημένη και η C10 είναι μικρή. Αν κυριαρχούν τα
 * 1-3, η έκπτωση δίνεται στα τυφλά.
 *
 * ΜΕΤΡΑΕΙ ΕΠΙΣΗΣ ΤΗΝ ΑΚΤΙΝΑ ΕΚΡΗΞΗΣ: τι θα άλλαζε στην οθόνη αν το άγνωστο ΕΠΑΥΕ να δίνει
 * έκπτωση (δηλαδή αν διαβαζόταν σαν 'partial') — σε ΟΛΕΣ τις παραλιο-ημέρες, όχι μόνο στην
 * πύλη των 4, γιατί το `shoreSeaStateM` τρέχει παντού.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/unknown-sea-arrival-<ημερομηνία>.json.
 *
 *   node scripts/measureUnknownSeaArrivalDiscount.mjs --live [--days=3] [--regions=a,b]
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
const { seaStateSeverityM, shoreSeaStateM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { holdsGlassWaterAtFourBeaufort } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { SEA_ARRIVAL_ONSHORE_MIN } = require(path.join(root, 'utils/seaArrival.ts'));

const args = process.argv.slice(2);
if (!args.includes('--live')) { console.error('Χρειάζεται --live.'); process.exit(1); }
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length)?.split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 3);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/weather');

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

/** Γιατί σώπασε η resolveSeaArrivalExposureLevel — οι τέσσερις δρόμοι, ξεχωριστά. */
const silenceReason = (profile, waveDirectionDeg) => {
  if (!profile) return 'χωρίς προφίλ';
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return 'χωρίς κατεύθυνση κύματος';
  const facingDeg = profile.facingDeg;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return 'χωρίς όψη ακτής';
  const onshore = Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180);
  if (onshore <= SEA_ARRIVAL_ONSHORE_MIN) return 'η θάλασσα δεν έρχεται προς την ακτή';
  return 'χωρίς τομέα (κενή γεωμετρία)';
};

const t = {
  regionsMeasured: 0, regionsSkipped: 0, beachDays: 0,
  discountEligible: 0,            // exposureLevel === 'protected' — μόνο εκεί παίζει η έκπτωση
  arrivalKnownProtected: 0, arrivalKnownOther: 0, arrivalUnknown: 0,
  toneChanged: 0, toneStricter: 0, toneMilder: 0,
  gateLost: 0, gateKept: 0,
  seaCeilingBitesMore: 0,
  blindDiscountDays: 0,           // έκπτωση σε ώρες που ΔΕΝ ξέρουμε (λόγοι 1-3)
  earnedSilenceDays: 0,           // έκπτωση σε ώρες που η θάλασσα όντως δεν έρχεται (λόγος 4)
};
const reasons = new Map();
const toneMoves = new Map();
const byRegionTone = new Map();
const changedRows = [];
const changedBeaches = new Set();

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
      const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: profile,
      });
      t.beachDays += 1;

      // Η έκπτωση ×0,5 υπάρχει ΜΟΝΟ σε protected ακτή (utils/waveCharacter.ts:274).
      if (score.exposureLevel !== 'protected') continue;
      t.discountEligible += 1;

      const arrival = score.seaArrivalExposureLevel;
      const waveDirectionDeg = score.marine?.waveDirectionDeg;
      if (arrival === 'protected') t.arrivalKnownProtected += 1;
      else if (arrival) { t.arrivalKnownOther += 1; continue; }   // ήδη αρνείται την έκπτωση
      else {
        t.arrivalUnknown += 1;
        const why = silenceReason(profile, waveDirectionDeg);
        reasons.set(why, (reasons.get(why) ?? 0) + 1);
        if (why === 'η θάλασσα δεν έρχεται προς την ακτή') t.earnedSilenceDays += 1;
        else t.blindDiscountDays += 1;
      }

      // ── ΑΚΤΙΝΑ ΕΚΡΗΞΗΣ: τι αν το άγνωστο διαβαζόταν σαν 'partial' (καμία έκπτωση) ──
      const beaufort = score.simpleWindSuitability?.windBeaufort ?? 0;
      const severity = seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS);
      const gateArgs = {
        profile, windDirectionDeg: dayForecast.wind?.deg, beaufort,
        seaStateM: severity, exposureLevel: score.exposureLevel,
        swellWaveHeightM: score.marine?.swellWaveHeightM, curatedWindOnlyProtection: false,
      };
      const gateNow = holdsGlassWaterAtFourBeaufort({ ...gateArgs, seaArrivalExposureLevel: arrival });
      const gateStrict = holdsGlassWaterAtFourBeaufort({ ...gateArgs, seaArrivalExposureLevel: 'partial' });
      if (gateNow && !gateStrict) t.gateLost += 1;
      if (gateNow && gateStrict) t.gateKept += 1;

      const toneInput = {
        exposureLevel: score.exposureLevel, beaufort,
        isEnclosedCove: Boolean(score.enclosedCove), seaStateM: severity,
        offshoreFlatWater: Boolean(score.simpleWindSuitability?.offshoreFlatWater),
        downwindSeaSample: Boolean(score.simpleWindSuitability?.downwindSeaSample),
        swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
      };
      const toneNow = resolveConditionTone({ ...toneInput, seaArrivalExposureLevel: arrival, glassWaterAtFour: gateNow });
      const toneStrict = resolveConditionTone({ ...toneInput, seaArrivalExposureLevel: 'partial', glassWaterAtFour: gateStrict });
      const shoreNow = shoreSeaStateM(severity, score.exposureLevel, arrival, false);
      const shoreStrict = shoreSeaStateM(severity, score.exposureLevel, 'partial', false);
      if (typeof shoreNow === 'number' && typeof shoreStrict === 'number' && shoreStrict > shoreNow) t.seaCeilingBitesMore += 1;
      if (toneNow === toneStrict) continue;

      t.toneChanged += 1;
      changedBeaches.add(`${region.regionId}#${beach.id}`);
      const RANK = { blue: 0, green: 0, yellow: 1, orange: 2, red: 3 };
      if ((RANK[toneStrict] ?? 0) > (RANK[toneNow] ?? 0)) t.toneStricter += 1; else t.toneMilder += 1;
      toneMoves.set(`${toneNow}→${toneStrict}`, (toneMoves.get(`${toneNow}→${toneStrict}`) ?? 0) + 1);
      byRegionTone.set(region.regionId, (byRegionTone.get(region.regionId) ?? 0) + 1);
      if (changedRows.length < 80) changedRows.push({
        region: region.regionId, id: beach.id, name: beach.name?.gr ?? beach.name?.en, dayIndex,
        beaufort, reason: silenceReason(profile, waveDirectionDeg),
        facingDeg: profile?.facingDeg ?? null,
        waveDirectionDeg: waveDirectionDeg ?? null,
        openSeaSeverityM: severity == null ? null : Number(severity.toFixed(2)),
        atShoreNowM: shoreNow == null ? null : Number(shoreNow.toFixed(2)),
        atShoreStrictM: shoreStrict == null ? null : Number(shoreStrict.toFixed(2)),
        toneNow, toneStrict, gateNow, gateStrict,
      });
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

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
console.log('');
console.log(`ΠΑΡΑΛΙΟ-ΗΜΕΡΕΣ ${t.beachDays} · περιοχές ${t.regionsMeasured} (χάθηκαν ${t.regionsSkipped})`);
console.log('');
console.log('ΠΟΥ ΠΑΙΖΕΙ Η ΕΚΠΤΩΣΗ ×0,5');
console.log(`  protected ακτή (μόνο εκεί)       ${t.discountEligible} · ${pct(t.discountEligible, t.beachDays)}`);
console.log(`  τομέας άφιξης γνωστός-protected  ${t.arrivalKnownProtected}`);
console.log(`  τομέας άφιξης γνωστός-άλλο       ${t.arrivalKnownOther} (η έκπτωση ΗΔΗ αρνείται)`);
console.log(`  ΑΓΝΩΣΤΟΣ                         ${t.arrivalUnknown} · ${pct(t.arrivalUnknown, t.discountEligible)}`);
console.log('');
console.log('ΓΙΑΤΙ ΕΙΝΑΙ ΑΓΝΩΣΤΟΣ');
for (const [why, c] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(c).padStart(5)} · ${why}`);
}
console.log(`  → ΔΙΚΑΙΟΛΟΓΗΜΕΝΗ σιωπή ${t.earnedSilenceDays} · ΣΤΑ ΤΥΦΛΑ ${t.blindDiscountDays}`);
console.log('');
console.log('ΑΝ ΤΟ ΑΓΝΩΣΤΟ ΕΠΑΥΕ ΝΑ ΔΙΝΕΙ ΕΚΠΤΩΣΗ');
console.log(`  η θάλασσα μετράει ψηλότερα σε    ${t.seaCeilingBitesMore}`);
console.log(`  ΑΛΛΑΖΕΙ ΧΡΩΜΑ                    ${t.toneChanged} · ${changedBeaches.size} παραλίες · ${pct(t.toneChanged, t.beachDays)} των παραλιο-ημερών`);
console.log(`    αυστηρότερο ${t.toneStricter} · ηπιότερο ${t.toneMilder}`);
console.log(`  χάνει την πύλη των 4 Μποφ.       ${t.gateLost} (κρατάει ${t.gateKept})`);
if (toneMoves.size) {
  console.log('  μετακινήσεις:');
  for (const [m, c] of [...toneMoves.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${String(c).padStart(5)} · ${m}`);
}
if (byRegionTone.size) {
  console.log('  περιοχές:');
  for (const [rg, c] of [...byRegionTone.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${String(c).padStart(5)} · ${rg}`);
}

mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const out = path.join(reportDir, `unknown-sea-arrival-${stamp}.json`);
writeFileSync(out, JSON.stringify({
  measuredAt: new Date().toISOString(), days: DAYS, totals: t,
  reasons: Object.fromEntries(reasons), toneMoves: Object.fromEntries(toneMoves),
  byRegion: Object.fromEntries(byRegionTone), changedRows,
}, null, 2));
console.log(`\nγράφτηκε ${path.relative(root, out)}`);
