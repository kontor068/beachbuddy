#!/usr/bin/env node
/**
 * ΠΟΙΟΣ ΚΕΡΔΙΖΕΙ ΤΟ max() ΤΟΥ ΚΥΜΑΤΟΣ — ΚΑΙ ΤΙ ΘΑ ΑΛΛΑΖΕ ΑΝ ΤΟ ΔΑΠΕΔΟ ΜΑΘΑΙΝΕ ΤΟ ΑΝΟΙΧΤΟ ΝΕΡΟ (12/09/2026, βίβλος §Γ81 Δ6)
 * — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΗ ΓΕΝΝΑΕΙ. Το ενεργό ύψος είναι max(μέτρηση ewam, δικό μας SMB, δάπεδο ψιλοκύματος)
 * (utils/waveModel.resolveDisplayWaveHeightM). Το δάπεδο (getWindChopWaveFloorM) δίνει 0,80 μ. σε ΚΑΘΕ
 * εκτεθειμένη ακτή στα 5 Μποφόρ — ακριβώς το SEA_STATE_AMBER_M — χωρίς να ρωτάει πόσο ανοιχτό νερό έχει
 * μπροστά της. Σε 5 χλμ fetch το SMB δίνει 0,40· τυπώνουμε 0,80 και η πινέζα γίνεται κίτρινη εξ ορισμού.
 * Κανείς δεν είχε μετρήσει πόσο συχνά νικάει το δάπεδο, ούτε το άθροισμα των μονόδρομων τελεστών (§ΑΞ1/Α7).
 *
 * ΤΙ ΚΑΝΕΙ. Τρέχει την ΠΡΑΓΜΑΤΙΚΗ βαθμολογία (calculateBeachScore) για κάθε παραλία της χώρας, σήμερα, και
 * κρυφακούει τις κλήσεις του resolveDisplayWaveHeightM — ίδιο μοτίβο με το measureShoreChopFloorGap.mjs:
 * η αυθεντική συνάρτηση τρέχει, εμείς μόνο καταγράφουμε είσοδο/έξοδο. Για κάθε κλήση: ποιος ισούται με το
 * ενεργό ύψος (μέτρηση / δάπεδο / SMB / ταβάνι), έκθεση, Μποφόρ, fetch του τομέα του ανέμου.
 *
 * Η ΥΠΟΨΗΦΙΑ (δεν μπαίνει — μετριέται): δάπεδο' = min(δάπεδο, SMB στη ΡΙΠΗ πάνω στο fetch του ίδιου τομέα).
 * Δηλαδή το δάπεδο δεν μπορεί να ισχυριστεί κύμα που ούτε η ριπή δεν προλαβαίνει να χτίσει σε αυτό το νερό.
 * Μονόδρομη προς το ΗΠΙΟΤΕΡΟ — άρα ΠΟΤΕ χωρίς απόφαση Μίλτου. Εδώ: πόσες κλήσεις, πόσο πέφτει το ύψος, πόσες
 * περνούν κάτω από τα ταβάνια 0,8/1,2 (κίτρινο/κόκκινο), ανά έκθεση και ζώνη fetch.
 *
 * ΟΡΙΑ. Μία μέρα (σήμερα, ή --day=1 για αύριο), ο καιρός που έτυχε — ξανατρέξε σε μέρα μελτεμιού. Μόνο το
 * ενεργό ύψος· η κάρτα βλέπει και το K_d, το ταβάνι, τη λέξη. Δεν κρίνει ποιος έχει ΔΙΚΙΟ (αυτό θέλει
 * σημαδούρες/δορυφόρο) — μόνο ποιος ΑΠΟΦΑΣΙΖΕΙ.
 *
 *   node scripts/measureWaveFloorWinner.mjs [--day=0] [--regions=a,b]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

const openMeteoKey = await resolveOpenMeteoKey();
const PAID_HOST = {
  'https://api.open-meteo.com': 'https://customer-api.open-meteo.com',
  'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com',
};
if (openMeteoKey) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url === 'string') {
      for (const [free, paid] of Object.entries(PAID_HOST)) {
        if (url.startsWith(free)) {
          let target = `${paid}${url.slice(free.length)}&apikey=${encodeURIComponent(openMeteoKey)}`;
          if (globalThis.__CB_ARCHIVE_PAST_DAYS) {
            // Αρχείο αντί για πρόγνωση: το παράθυρο γίνεται «N μέρες πίσω + σήμερα».
            const u = new URL(target);
            for (const k of ['forecast_days', 'past_days', 'start_date', 'end_date']) u.searchParams.delete(k);
            u.searchParams.set('past_days', String(globalThis.__CB_ARCHIVE_PAST_DAYS));
            u.searchParams.set('forecast_days', '1');
            target = u.toString();
          }
          return originalFetch(target, init);
        }
      }
    }
    return originalFetch(input, init);
  };
  console.log('  Πληρωμένη πόρτα Open-Meteo: ΕΝΕΡΓΗ');
} else {
  console.log('  ⚠️ Χωρίς κλειδί — δωρεάν πόρτα, αργά και με 429.');
}
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename);
    return;
  }
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const waveModelModule = require(path.join(root, 'utils/waveModel.ts'));
const { getWindChopWaveFloorM, estimateFetchLimitedWaveHeightM } = waveModelModule;
const originalResolveDisplay = waveModelModule.resolveDisplayWaveHeightM;
const { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } = require(path.join(root, 'utils/waveCharacter.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
/**
 * `--archive=YYYY-MM-DD` (Δ6-Β, 13/09/2026): η ίδια μέτρηση σε ΠΕΡΑΣΜΕΝΗ μέρα — π.χ. μέρα μελτεμιού — από το αρχείο
 * των πληρωμένων hosts (`past_days` ≤ 92, άνεμος ΚΑΙ κύμα με το ίδιο μοντέλο που σερβίρει η σελίδα). Ο fetch της
 * σελίδας ζητά `forecast_days=6`· εδώ γίνεται `past_days=N&forecast_days=1`, και μετά τις λήψεις κάθε περιοχής το
 * ρολόι της εφαρμογής πάει στη μέρα-στόχο (`syncClockFromTrustedInstant`) ώστε το `processForecastData` να τη δώσει ως
 * days[0] — κάθε απάντηση fetch ξανασυγχρονίζει το ρολόι στο τώρα, γι' αυτό ο συγχρονισμός γίνεται ΜΕΤΑ τις λήψεις
 * (ίδιο μοτίβο με measureHorizonHitRate.mjs). Είναι το «τι λέει το μοντέλο ότι έγινε», όχι όργανο.
 */
const ARCHIVE_DATE = args.find(a => a.startsWith('--archive='))?.slice('--archive='.length) ?? null;
if (ARCHIVE_DATE && !/^\d{4}-\d{2}-\d{2}$/.test(ARCHIVE_DATE)) { console.error('--archive θέλει YYYY-MM-DD'); process.exit(1); }
const ARCHIVE_PAST_DAYS = ARCHIVE_DATE ? Math.ceil((Date.now() - Date.parse(`${ARCHIVE_DATE}T00:00:00+03:00`)) / 86400000) + 1 : 0;
if (ARCHIVE_DATE && (ARCHIVE_PAST_DAYS < 1 || ARCHIVE_PAST_DAYS > 92)) { console.error(`--archive: ${ARCHIVE_DATE} είναι ${ARCHIVE_PAST_DAYS - 1} μέρες πίσω — το αρχείο φτάνει 92`); process.exit(1); }
const DAY_INDEX = ARCHIVE_DATE ? 0 : Number(args.find(a => a.startsWith('--day='))?.slice(6) ?? 0);
if (ARCHIVE_DATE) globalThis.__CB_ARCHIVE_PAST_DAYS = ARCHIVE_PAST_DAYS; // ο interceptor του fetch το διαβάζει
const { syncClockFromTrustedInstant } = require(path.join(root, 'utils/athensTime.ts'));
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const EPS = 0.006;

// ── η ακρόαση ─────────────────────────────────────────────────────────────────────────────────
let current = null; // { beachId, regionId, fetchKm, sectorLevel }
const calls = [];
waveModelModule.resolveDisplayWaveHeightM = (input) => {
  const out = originalResolveDisplay(input);
  if (current && out) {
    const floor = getWindChopWaveFloorM(input.exposureLevel, input.beaufort, input.windSpeedKmh, input.gustKmph, input.meanSpeedBeforeGustFloorKmh);
    const measured = out.realisticMeasuredWaveHeightM;
    const eff = out.effectiveWaveHeightM;
    const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < EPS;
    let winner = 'smb';
    if (out.geometricCeilingApplied) winner = 'ceiling';
    else if (near(eff, measured)) winner = 'measured';
    else if (floor > 0 && near(eff, floor)) winner = 'floor';
    // η υποψήφια: το δάπεδο δεν ξεπερνά το SMB στη ριπή πάνω στο fetch του τομέα
    let capped = null, effAfter = eff;
    if (winner === 'floor' && typeof current.fetchKm === 'number') {
      const gustKmh = typeof input.gustKmph === 'number' && input.gustKmph > input.windSpeedKmh ? input.gustKmph : input.windSpeedKmh;
      const smbAtGust = estimateFetchLimitedWaveHeightM({ windSpeedKmh: gustKmh, fetchKm: current.fetchKm });
      capped = Number(Math.min(floor, smbAtGust).toFixed(2));
      // ό,τι θα κέρδιζε το max() χωρίς το πλήρες δάπεδο: μέτρηση, ή SMB αποσβεσμένο (eff − floor λέει ποιο)
      const others = [measured, capped].filter(v => typeof v === 'number');
      effAfter = others.length ? Math.max(...others) : eff;
      if (effAfter > eff) effAfter = eff;
    }
    calls.push({
      beachId: current.beachId, regionId: current.regionId, exposure: input.exposureLevel, beaufort: input.beaufort,
      windKmh: Number(input.windSpeedKmh.toFixed(1)), gustKmh: typeof input.gustKmph === 'number' ? Number(input.gustKmph.toFixed(1)) : null,
      fetchKm: current.fetchKm, sectorLevel: current.sectorLevel, measured: typeof measured === 'number' ? Number(measured.toFixed(2)) : null,
      smb: Number(input.modeledWaveHeightM.toFixed(2)), floor: Number(floor.toFixed(2)), effective: Number(eff.toFixed(2)), winner,
      capped, effectiveIfCapped: Number(effAfter.toFixed(2)),
      // 14/09: το fetch που είδε ο κόφτης στο runtime (παρεμβολή, effectiveFetchKm) δίπλα στον τομέα του χάρτη
      runtimeFetchKm: typeof input.windSectorFetchKm === 'number' ? Number(input.windSectorFetchKm.toFixed(2)) : null,
    });
  }
  return out;
};

// ── περιοχές ──────────────────────────────────────────────────────────────────────────────────
const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) if (profile?.beachId != null) profiles[profile.beachId] = profile;
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch { return null; }
};
const regions = readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json').map(loadRegion).filter(Boolean)
  .filter(r => r.regionPoint && Number.isFinite(r.regionPoint.lat)).filter(r => !regionFilter || regionFilter.includes(r.regionId));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const POINTS_PER_MINUTE = openMeteoKey ? 600 : 120;
const pointWindow = [];
const pace = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60_000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((s, e) => s + e.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    await sleep(Math.max(1000, pointWindow[0].at + 60_000 - performance.now()));
  }
  pointWindow.push({ at: performance.now(), count });
};

let skipped = 0, regionsDone = 0;
for (const region of regions) {
  try {
    const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    await pace(resolution.points.length + 1);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch([region.regionPoint]), fetchMarineForecastDataBatch(resolution.points)]);
    const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
    if (!wind) { skipped += 1; continue; }
    const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
    // Αρχείο: το ρολόι πάει στη μέρα-στόχο ΜΕΤΑ τις λήψεις (κάθε απάντηση το ξαναγυρίζει στο τώρα).
    if (ARCHIVE_DATE) syncClockFromTrustedInstant(Date.parse(`${ARCHIVE_DATE}T06:00:00+03:00`));
    const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
    if (ARCHIVE_DATE && regionDay && (regionDay.date instanceof Date ? regionDay.date.toLocaleDateString('en-CA') : String(regionDay.date ?? '')) !== ARCHIVE_DATE) {
      // Αν η πρώτη μέρα δεν είναι η μέρα-στόχος, κάτι δεν ήρθε από το αρχείο — μη μετρήσεις λάθος μέρα σιωπηλά.
      process.stderr.write(`\n  ${region.regionId}: η πρώτη μέρα είναι ${regionDay.date} αντί για ${ARCHIVE_DATE} — παραλείπεται\n`);
      skipped += 1; continue;
    }
    if (!regionDay) { skipped += 1; continue; }
    const windDeg = regionDay.wind?.deg;
    const sectorKey = typeof windDeg === 'number' ? windSectorFromDegrees(windDeg) : null;
    for (const beach of region.beaches) {
      const key = resolution.keyByBeachId.get(beach.id);
      const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
      const sector = sectorKey ? region.profiles[beach.id]?.sectors?.[sectorKey] : null;
      current = { beachId: beach.id, regionId: region.regionId, fetchKm: typeof sector?.fetchKm === 'number' ? sector.fetchKm : null, sectorLevel: sector?.level ?? null };
      calculateBeachScore(beach, dayForecast, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: region.profiles[beach.id] });
      current = null;
    }
    regionsDone += 1;
    process.stderr.write(`\r  ${regionsDone}/${regions.length} περιοχές · ${calls.length} κλήσεις`);
    await sleep(200);
  } catch (e) {
    skipped += 1;
    process.stderr.write(`\n  ${region.regionId}: ${e.message}\n`);
  }
}
process.stderr.write('\n');

// ── άθροισμα ─────────────────────────────────────────────────────────────────────────────────
const pct = (n, d) => (d ? Number((100 * n / d).toFixed(1)) : null);
const fetchBand = (km) => (typeof km !== 'number' ? 'άγνωστο' : km < 3 ? '<3' : km < 8 ? '3-8' : km < 15 ? '8-15' : '≥15');
const tally = (rows) => {
  const w = {}; for (const r of rows) w[r.winner] = (w[r.winner] || 0) + 1;
  return { n: rows.length, winners: w, floorPct: pct(w.floor || 0, rows.length), floorAboveMeasured: rows.filter(r => r.winner === 'floor' && typeof r.measured === 'number').length };
};
const groups = (keyFn) => { const m = {}; for (const r of calls) (m[keyFn(r)] ||= []).push(r); return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, tally(v)])); };
const floorWins = calls.filter(r => r.winner === 'floor');
const changed = floorWins.filter(r => r.capped !== null && r.effectiveIfCapped < r.effective - EPS);
const crossAmber = changed.filter(r => r.effective >= SEA_STATE_AMBER_M && r.effectiveIfCapped < SEA_STATE_AMBER_M);
const crossRough = changed.filter(r => r.effective >= SEA_STATE_ROUGH_M && r.effectiveIfCapped < SEA_STATE_ROUGH_M);
const medianDrop = (rows) => { const d = rows.map(r => r.effective - r.effectiveIfCapped).sort((a, b) => a - b); return d.length ? Number(d[Math.floor(d.length / 2)].toFixed(2)) : null; };
const beachesOf = (rows) => new Set(rows.map(r => r.beachId)).size;

const report = {
  generatedAt: new Date().toISOString(), dayIndex: DAY_INDEX, regions: regionsDone, regionsSkipped: skipped, calls: calls.length, beaches: beachesOf(calls),
  question: 'ποιος ισούται με το ενεργό ύψος: μέτρηση ewam / δάπεδο ψιλοκύματος / SMB / ταβάνι γεωμετρίας',
  overall: tally(calls), byExposure: groups(r => r.exposure), byBeaufort: groups(r => String(r.beaufort)), byFetchBand: groups(r => fetchBand(r.fetchKm)),
  byExposureAndBeaufort: groups(r => `${r.exposure}|${r.beaufort}`),
  candidate: {
    rule: 'δάπεδο = min(δάπεδο, SMB(ριπή, fetch του τομέα του ανέμου)) — μονόδρομη προς το ηπιότερο, ΔΕΝ μπαίνει χωρίς απόφαση',
    floorWins: floorWins.length, floorWinsBeaches: beachesOf(floorWins), changed: changed.length, changedBeaches: beachesOf(changed),
    medianDropM: medianDrop(changed), crossBelowAmber: crossAmber.length, crossBelowRough: crossRough.length,
    changedByFetchBand: Object.fromEntries(Object.entries((() => { const m = {}; for (const r of changed) (m[fetchBand(r.fetchKm)] ||= []).push(r); return m; })()).map(([k, v]) => [k, { n: v.length, medianDropM: medianDrop(v), crossBelowAmber: v.filter(r => r.effective >= SEA_STATE_AMBER_M && r.effectiveIfCapped < SEA_STATE_AMBER_M).length }])),
    changedByExposure: Object.fromEntries(Object.entries((() => { const m = {}; for (const r of changed) (m[r.exposure] ||= []).push(r); return m; })()).map(([k, v]) => [k, v.length])),
  },
  // 14/09 — η διαφορά τομέα/παρεμβολής: κλήσεις όπου ο τομέας του ανέμου έχει <3 χλμ αλλά ο κόφτης είδε ≥3 (ή ανάποδα).
  fetchMismatch: (() => {
    const withBoth = calls.filter(r => typeof r.fetchKm === 'number' && typeof r.runtimeFetchKm === 'number');
    const sectorCoveRuntimeOpen = withBoth.filter(r => r.fetchKm < 3 && r.runtimeFetchKm >= 3);
    const sectorOpenRuntimeCove = withBoth.filter(r => r.fetchKm >= 3 && r.runtimeFetchKm < 3);
    const amberLeft = sectorCoveRuntimeOpen.filter(r => r.winner === 'floor' && r.effective >= SEA_STATE_AMBER_M && r.exposure !== 'protected');
    const gap = sectorCoveRuntimeOpen.map(r => r.runtimeFetchKm - r.fetchKm).sort((a, b) => a - b);
    return {
      calls: withBoth.length, sectorCoveRuntimeOpen: sectorCoveRuntimeOpen.length, beaches: beachesOf(sectorCoveRuntimeOpen),
      sectorOpenRuntimeCove: sectorOpenRuntimeCove.length, amberStillFromFloor: amberLeft.length, amberBeaches: beachesOf(amberLeft),
      medianGapKm: gap.length ? Number(gap[Math.floor(gap.length / 2)].toFixed(2)) : null,
      samples: amberLeft.slice(0, 20).map(r => ({ beachId: r.beachId, regionId: r.regionId, exposure: r.exposure, beaufort: r.beaufort, sectorFetchKm: r.fetchKm, runtimeFetchKm: r.runtimeFetchKm, floor: r.floor, effective: r.effective, measured: r.measured })),
    };
  })(),
  samples: changed.sort((a, b) => (b.effective - b.effectiveIfCapped) - (a.effective - a.effectiveIfCapped)).slice(0, 25),
  note: 'Δ6 (§Γ81): μέτρηση μίας μέρας με το πραγματικό προϊόν. Δεν λέει ποιος έχει δίκιο — μόνο ποιος αποφασίζει. Έλεγχος με σημαδούρες: επόμενο.',
};
if (ARCHIVE_DATE) syncClockFromTrustedInstant(Date.now());
report.archiveDate = ARCHIVE_DATE;
const outPath = path.join(root, 'reports/wave-model', `wave-floor-winner-${new Date().toISOString().slice(0, 10)}${ARCHIVE_DATE ? `-a${ARCHIVE_DATE}` : DAY_INDEX ? `-d${DAY_INDEX}` : ''}.json`);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nΠΟΙΟΣ ΚΕΡΔΙΖΕΙ ΤΟ max() — ${calls.length} κλήσεις, ${report.beaches} παραλίες, ${regionsDone} περιοχές, μέρα +${DAY_INDEX}`);
console.log(`  σύνολο: ${JSON.stringify(report.overall.winners)} · δάπεδο ${report.overall.floorPct}%`);
for (const [k, v] of Object.entries(report.byExposure)) console.log(`  ${k.padEnd(10)} n=${String(v.n).padStart(5)} δάπεδο ${v.floorPct}% ${JSON.stringify(v.winners)}`);
for (const [k, v] of Object.entries(report.byFetchBand)) console.log(`  fetch ${k.padEnd(7)} n=${String(v.n).padStart(5)} δάπεδο ${v.floorPct}%`);
for (const [k, v] of Object.entries(report.byBeaufort).sort()) console.log(`  ${k} Μπφ n=${String(v.n).padStart(5)} δάπεδο ${v.floorPct}%`);
console.log(`\nΥΠΟΨΗΦΙΑ (δάπεδο ≤ SMB στη ριπή): αλλάζει ${changed.length}/${floorWins.length} νίκες του δαπέδου (${beachesOf(changed)} παραλίες) · διάμεση πτώση ${report.candidate.medianDropM} μ. · κάτω από 0,8: ${crossAmber.length} · κάτω από 1,2: ${crossRough.length}`);
for (const [k, v] of Object.entries(report.candidate.changedByFetchBand)) console.log(`  fetch ${k}: ${v.n} · πτώση ${v.medianDropM} μ. · κάτω από 0,8: ${v.crossBelowAmber}`);
console.log(`
ΤΟΜΕΑΣ vs ΠΑΡΕΜΒΟΛΗ (14/09): ${JSON.stringify({ ...report.fetchMismatch, samples: undefined })}`);
console.log(`→ ${path.relative(root, outPath)}`);
