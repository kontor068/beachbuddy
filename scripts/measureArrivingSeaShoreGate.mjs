#!/usr/bin/env node
/**
 * ΤΙ ΚΟΣΤΙΖΕΙ ΝΑ ΣΩΠΑΙΝΕΙ Η ΕΚΤΙΜΗΣΗ ΑΚΤΗΣ ΟΤΑΝ ΤΟ ΚΥΜΑ ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΕΡΧΕΤΑΙ — ΕΘΝΙΚΑ.
 *
 * ΑΦΟΡΜΗ. Σταλίδα Ηρακλείου (645), 21/08/2026: νότιος απόγειος πάνω από τομέα με μηδενικό
 * άνοιγμα → η `utils/shoreWave.estimateShoreWaveHeightM` τύπωνε το δάπεδο 0,10 μ. («θάλασσα
 * λάδι») ενώ το ewam έδινε 0,28-0,30 μ. από 322° σε ακτή που κοιτάει 24,2° (onshore +0,48,
 * άνοιγμα 10-25 χλμ). Οι δύο γεωμετρικές πύλες ρωτάνε ΤΟΝ ΑΝΕΜΟ· κανείς δεν ρωτούσε από πού
 * έρχεται το ΝΕΡΟ.
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΙ. Τρέχει την ΙΔΙΑ `calculateBeachScore` δύο φορές ανά παραλιο-ημέρα:
 *   ΠΡΙΝ  — `isSeaArrivingShore` καρφωμένη σε false (η συμπεριφορά μέχρι 20/08)
 *   ΤΩΡΑ  — η αληθινή δικλείδα
 * και μετράει: πόσο αλλάζει ο ΤΥΠΩΜΕΝΟΣ αριθμός (`shoreDisplayWaveM`), πόσες φορές αλλάζει η
 * ΛΕΞΗ της κάρτας (utils/conditionsFeelPhrase.waveFeelLevel — εκεί ζει το «θάλασσα λάδι»),
 * το χρώμα του χάρτη και η ετυμηγορία κολύμβησης.
 *
 * ΕΛΕΓΧΟΣ ΠΑΛΙΝΔΡΟΜΗΣΗΣ: αναφέρει ΞΕΧΩΡΙΣΤΑ τις παραλίες για τις οποίες γράφτηκε το shoreWave
 * (Σχινιάς, Βάι, Ελαφονήσι, Λιμανάκια) — αν χάσουν την εκτίμηση ακτής, η αλλαγή είναι ανάκληση
 * λειτουργίας και ΔΕΝ πρέπει να φύγει.
 *
 * ΔΕΝ αλλάζει δεδομένα. Γράφει reports/weather/arriving-sea-shore-gate-<ημερομηνία>.json.
 *
 *   node scripts/measureArrivingSeaShoreGate.mjs --live [--days=1] [--regions=a,b]
 *
 * Τρέχει στα ΔΩΡΕΑΝ hosts του Open-Meteo — δεν ζητάει και δεν χρειάζεται πληρωμένο κλειδί.
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';

/** Ποσες μερες ζηταμε πραγματικα - δες την επεξηγηση στο μπαλωμα του fetch. */
const FETCH_DAYS = Math.min(6, Math.max(2, Number(process.argv.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 1) + 1));
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ΤΟ ΔΩΡΕΑΝ ΟΡΙΟ ΤΟΥ OPEN-METEO ΕΙΝΑΙ ΖΥΓΙΣΜΕΝΟ, ΟΧΙ ΜΕΤΡΗΜΕΝΟ ΣΕ ΑΙΤΗΜΑΤΑ.
 *
 * Η πρώτη εθνική εκτέλεση (21/08) έφαγε 78 απαντήσεις 429 στο ΚΥΜΑ, επειδή ο provider ζητάει
 * `forecast_days=6` για κάθε σημείο ενώ η μέτρηση κοιτάει 1-2 μέρες: πληρώναμε τριπλάσιο βάρος
 * για δεδομένα που πετούσαμε. Ό,τι χάθηκε σε 429 γύριζε «χωρίς κύμα», δηλαδή ΥΠΟΤΙΜΟΥΣΕ τη
 * δικλείδα — το χειρότερο είδος σφάλματος για μια μέτρηση που πρέπει να δείξει το πάνω όριο.
 *
 * Δύο διορθώσεις, και οι δύο ΜΟΝΟ μέσα σε αυτή τη διεργασία (ο κώδικας που στέλνει δεν αγγίζεται,
 * ίδιο δόγμα με το scripts/lib/paidOpenMeteo.mjs):
 *   • κόβει τις μέρες στις όσες όντως διαβάζονται·
 *   • ξαναδοκιμάζει τα 429 με αυξανόμενη αναμονή, και κρατάει ΚΑΘΕ επιτυχία στον δίσκο ώστε μια
 *     δεύτερη εκτέλεση να κοστίζει μηδέν.
 */
const CACHE_DIR = path.join(root, '.tmp/arriving-sea-gate-cache');
mkdirSync(CACHE_DIR, { recursive: true });
const cacheFileFor = (url) => {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) h = (Math.imul(31, h) + url.charCodeAt(i)) | 0;
  return path.join(CACHE_DIR, `${(h >>> 0).toString(36)}-${url.length}.json`);
};
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input?.url ?? String(input);
  if (!/open-meteo\.com/.test(raw)) return nativeFetch(input, init);
  const url = raw.replace(/forecast_days=\d+/, `forecast_days=${FETCH_DAYS}`);
  const cacheFile = cacheFileFor(url);
  try {
    const hit = readFileSync(cacheFile, 'utf8');
    return new Response(hit, { status: 200, headers: { 'content-type': 'application/json' } });
  } catch { /* κενή μνήμη — κανονικό */ }
  for (let attempt = 0; ; attempt += 1) {
    const response = await nativeFetch(url, init);
    if (response.status !== 429 || attempt >= 5) {
      if (response.ok) {
        const body = await response.text();
        try { writeFileSync(cacheFile, body); } catch { /* ο δίσκος δεν κρίνει τη μέτρηση */ }
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return response;
    }
    const waitMs = 5000 * (attempt + 1);
    process.stderr.write(`  429 - αναμονη ${waitMs / 1000}s (${attempt + 1}/5)...              `);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
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
const { waveFeelLevel } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
const shoreWave = require(path.join(root, 'utils/shoreWave.ts'));

/** Η αληθινή δικλείδα, κρατημένη πριν την πειράξουμε. */
const REAL_ARRIVING = shoreWave.isSeaArrivingShore;
const setGate = (on) => { shoreWave.isSeaArrivingShore = on ? REAL_ARRIVING : () => false; };

const args = process.argv.slice(2);
if (!args.includes('--live')) { console.error('Χρειάζεται --live.'); process.exit(1); }
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length)?.split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 1);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/weather');

/** Οι παραλίες για τις οποίες ΓΡΑΦΤΗΚΕ το shoreWave — αν χαθούν, είναι ανάκληση. */
const GUARD_NAME = /σχινι|βάι|ελαφον|λιμανάκ/i;

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

const POINTS_PER_MINUTE = 300;
const pointWindow = [];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const paceForPoints = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    const waitMs = Math.max(1000, pointWindow[0].at + 60000 - performance.now());
    process.stderr.write(`\r  οριο ρυθμου: ${spent} σημεια, αναμονη ${Math.ceil(waitMs / 1000)}s...        `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

const RANK = { blue: 0, green: 0, yellow: 1, orange: 2, red: 3 };
/** Η σκάλα του types.SwimmingComfort, με τη ΣΩΣΤΗ σειρά: πιο ψηλό = αυστηρότερο. */
const VERDICT_RANK = { excellent: 0, good: 1, caution: 2, avoid_swimming: 3 };

const t = {
  regionsMeasured: 0, regionsSkipped: 0, beachDays: 0,
  shoreSpokeBefore: 0,
  gateFires: 0,
  numberChanged: 0, numberUp: 0, numberDown: 0,
  wordChanged: 0, outOfGlassy: 0,
  toneChanged: 0, toneStricter: 0, toneMilder: 0,
  verdictChanged: 0, verdictStricter: 0, verdictMilder: 0,
  guardedLost: 0, guardedKept: 0,
};
let maxRise = 0;
const rises = [];
const changedBeaches = new Set();
const byRegion = new Map();
const toneMoves = new Map();
const changedRows = [];
const guardedRows = [];

const toneOf = (score) => resolveConditionTone({
  exposureLevel: score.exposureLevel,
  beaufort: score.simpleWindSuitability?.windBeaufort ?? 0,
  isEnclosedCove: Boolean(score.enclosedCove),
  seaStateM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
  offshoreFlatWater: Boolean(score.simpleWindSuitability?.offshoreFlatWater),
  downwindSeaSample: Boolean(score.simpleWindSuitability?.downwindSeaSample),
  swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
  seaArrivalExposureLevel: score.seaArrivalExposureLevel,
});

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  await paceForPoints(resolution.points.length + 1);
  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);
  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { skipped: 'χωρις ανεμο' };
  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const days = processForecastData(mergeMarineForecastData(wind.data, regionMarine)).slice(0, DAYS);
  if (!days.length) return { skipped: 'χωρις ημερα προγνωσης' };

  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const regionDay = days[dayIndex];
    for (const beach of region.beaches) {
      const key = resolution.keyByBeachId.get(beach.id);
      const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
      const profile = region.profiles[beach.id];
      const opts = {
        weatherSource: 'island-fallback', hourlyForecast: dayForecast.hourly, geospatialProfile: profile,
      };
      setGate(false);
      const before = calculateBeachScore(beach, dayForecast, undefined, undefined, opts);
      setGate(true);
      const after = calculateBeachScore(beach, dayForecast, undefined, undefined, opts);
      t.beachDays += 1;

      const nBefore = before.shoreDisplayWaveM;
      const nAfter = after.shoreDisplayWaveM;
      const openM = before.waveHeightM;
      const spoke = typeof nBefore === 'number' && typeof openM === 'number' && nBefore < openM - 0.005;
      if (spoke) t.shoreSpokeBefore += 1;

      const name = beach.name?.gr ?? beach.name?.en ?? String(beach.id);
      const guarded = GUARD_NAME.test(name);

      const changed = typeof nBefore === 'number' && typeof nAfter === 'number'
        ? Math.abs(nAfter - nBefore) > 0.005
        : nBefore !== nAfter;
      if (!changed) {
        if (guarded && spoke) {
          t.guardedKept += 1;
          if (guardedRows.length < 40) guardedRows.push({
            region: region.regionId, id: beach.id, name, dayIndex, kept: true,
            shoreM: nBefore ?? null, openM: openM ?? null,
          });
        }
        continue;
      }

      t.gateFires += 1;
      changedBeaches.add(`${region.regionId}#${beach.id}`);
      byRegion.set(region.regionId, (byRegion.get(region.regionId) ?? 0) + 1);
      t.numberChanged += 1;
      const rise = (nAfter ?? 0) - (nBefore ?? 0);
      if (rise > 0) { t.numberUp += 1; rises.push(rise); if (rise > maxRise) maxRise = rise; } else t.numberDown += 1;

      const wBefore = typeof nBefore === 'number' ? waveFeelLevel(nBefore) : null;
      const wAfter = typeof nAfter === 'number' ? waveFeelLevel(nAfter) : null;
      if (wBefore !== wAfter) {
        t.wordChanged += 1;
        if (wBefore === 0 && wAfter !== 0) t.outOfGlassy += 1;
      }

      const toneBefore = toneOf(before);
      const toneAfter = toneOf(after);
      if (toneBefore !== toneAfter) {
        t.toneChanged += 1;
        if ((RANK[toneAfter] ?? 0) > (RANK[toneBefore] ?? 0)) t.toneStricter += 1; else t.toneMilder += 1;
        toneMoves.set(`${toneBefore}->${toneAfter}`, (toneMoves.get(`${toneBefore}->${toneAfter}`) ?? 0) + 1);
      }
      if (before.swimmingComfort !== after.swimmingComfort) {
        t.verdictChanged += 1;
        if ((VERDICT_RANK[after.swimmingComfort] ?? 0) > (VERDICT_RANK[before.swimmingComfort] ?? 0)) t.verdictStricter += 1;
        else t.verdictMilder += 1;
      }
      if (guarded) {
        t.guardedLost += 1;
        if (guardedRows.length < 40) guardedRows.push({
          region: region.regionId, id: beach.id, name, dayIndex, kept: false,
          shoreBeforeM: nBefore ?? null, shoreAfterM: nAfter ?? null, openM: openM ?? null,
          facingDeg: profile?.facingDeg ?? null, waveDirectionDeg: before.marine?.waveDirectionDeg ?? null,
        });
      }
      if (changedRows.length < 400) changedRows.push({
        region: region.regionId, id: beach.id, name, dayIndex,
        beaufort: before.simpleWindSuitability?.windBeaufort ?? null,
        facingDeg: profile?.facingDeg ?? null,
        windDirectionDeg: dayForecast.wind?.deg ?? null,
        waveDirectionDeg: before.marine?.waveDirectionDeg ?? null,
        waveHeightM: before.marine?.waveHeightM ?? null,
        shoreBeforeM: nBefore ?? null, shoreAfterM: nAfter ?? null, openM: openM ?? null,
        wordBefore: wBefore, wordAfter: wAfter, toneBefore, toneAfter,
        verdictBefore: before.swimmingComfort, verdictAfter: after.swimmingComfort,
      });
    }
  }
  return { ok: true };
};

console.log(`-- ${regions.length} περιοχες x ${DAYS} μερες - ΔΩΡΕΑΝ Open-Meteo --`);
for (let i = 0; i < regions.length; i += 1) {
  const region = regions[i];
  process.stderr.write(`\r  ${i + 1}/${regions.length} ${region.regionId}                         `);
  try {
    const result = await measureRegion(region);
    if (result.skipped) t.regionsSkipped += 1; else t.regionsMeasured += 1;
  } catch (error) {
    t.regionsSkipped += 1;
    process.stderr.write(`\n  ! ${region.regionId}: ${error?.message ?? error}\n`);
  }
}
process.stderr.write('\r                                                              \r');

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(2)}%`;
rises.sort((a, b) => a - b);
const median = rises.length ? rises[Math.floor(rises.length / 2)] : 0;

console.log('');
console.log(`ΠΑΡΑΛΙΟ-ΗΜΕΡΕΣ ${t.beachDays} · περιοχες ${t.regionsMeasured} (χαθηκαν ${t.regionsSkipped})`);
console.log(`η εκτιμηση ακτης μιλουσε σε      ${t.shoreSpokeBefore} · ${pct(t.shoreSpokeBefore, t.beachDays)}`);
console.log('');
console.log('Η ΔΙΚΛΕΙΔΑ «ΤΟ ΚΥΜΑ ΕΡΧΕΤΑΙ»');
console.log(`  αναβει σε                      ${t.gateFires} · ${pct(t.gateFires, t.beachDays)} · ${changedBeaches.size} παραλιες`);
console.log(`  ανεβαζει τον αριθμο            ${t.numberUp} (κατεβαζει ${t.numberDown} - πρεπει να ειναι 0)`);
console.log(`  διαμεση ανοδος                 ${median.toFixed(2)} μ. · μεγιστη ${maxRise.toFixed(2)} μ.`);
console.log(`  ΑΛΛΑΖΕΙ Η ΛΕΞΗ ΤΗΣ ΚΑΡΤΑΣ      ${t.wordChanged} (απο «θαλασσα λαδι» σε κυμα: ${t.outOfGlassy})`);
console.log(`  αλλαζει χρωμα χαρτη            ${t.toneChanged} (αυστηροτερο ${t.toneStricter} · ηπιοτερο ${t.toneMilder})`);
console.log(`  αλλαζει ετυμηγορια             ${t.verdictChanged} (αυστηροτερη ${t.verdictStricter} · ηπιοτερη ${t.verdictMilder})`);
console.log('');
console.log(`ΕΛΕΓΧΟΣ ΠΑΛΙΝΔΡΟΜΗΣΗΣ (Σχινιας/Βαι/Ελαφονησι/Λιμαναακια): κρατησαν ${t.guardedKept} · εχασαν ${t.guardedLost}`);
for (const g of guardedRows.slice(0, 12)) {
  console.log(`  ${g.kept ? 'OK  κραταει' : '!!! ΕΧΑΣΕ '} #${g.id} ${g.name} · ακτη ${g.shoreM ?? g.shoreBeforeM}->${g.kept ? '-' : g.shoreAfterM} · ανοιχτα ${g.openM}`);
}
if (toneMoves.size) {
  console.log('\nΜΕΤΑΚΙΝΗΣΕΙΣ ΧΡΩΜΑΤΟΣ');
  for (const [m, c] of [...toneMoves.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(c).padStart(5)} · ${m}`);
}
if (byRegion.size) {
  console.log('\nΠΕΡΙΟΧΕΣ ΜΕ ΤΙΣ ΠΕΡΙΣΣΟΤΕΡΕΣ ΑΛΛΑΓΕΣ');
  for (const [rg, c] of [...byRegion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(c).padStart(5)} · ${rg}`);
}

mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const out = path.join(reportDir, `arriving-sea-shore-gate-${stamp}.json`);
writeFileSync(out, JSON.stringify({
  measuredAt: new Date().toISOString(), days: DAYS, totals: t,
  medianRiseM: Number(median.toFixed(3)), maxRiseM: Number(maxRise.toFixed(3)),
  beachesAffected: changedBeaches.size,
  toneMoves: Object.fromEntries(toneMoves), byRegion: Object.fromEntries(byRegion),
  guardedRows, changedRows,
}, null, 2));
console.log(`\nγραφτηκε ${path.relative(root, out)}`);
