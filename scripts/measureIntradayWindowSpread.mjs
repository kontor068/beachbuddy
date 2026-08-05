/**
 * ΑΞΙΖΕΙ ΤΟ «ΠΟΣΗ ΩΡΑ ΘΑ ΜΕΙΝΕΙΣ;» — a measurement, not a gate.
 *
 * The proposal (01-product-manager.md, 05/08/2026): let someone say how long they are staying, and
 * answer for THOSE hours instead of for the whole day. The machinery already exists — the map's
 * hour slider re-scores everything for one hour (App.tsx:656 adjustDailyForecastToHour) — so the
 * build is small. The question is whether it changes any answer.
 *
 * It only pays if the sea and wind move enough INSIDE a single day. Nobody has ever measured that
 * here. This file does, before a line of feature code is written, because the project has been
 * wrong about exactly this before: the offshore-flat-water lift looked like 19,6% of the country
 * on geometry alone and turned out to be 2,6% on live numbers.
 *
 * WHAT IT ASKS, per beach and per forecast day, over the beach day (10:00–18:00 — the same window
 * App.tsx:315 and recommendationService.ts:215 use):
 *
 *   1  UPSIDE      Is there a 2-hour slot whose worst hour is CALMER than the worst hour of the
 *                  whole day? That is a beach we could offer to a short visit and cannot offer now.
 *   2  WARNING     Is the worst hour of the day rougher than 11:00, the usual arrival? That is a
 *                  day we currently describe by its calm start and someone drives into its windy end.
 *   3  ARRIVAL     For a 2-hour stay, does the answer depend on WHEN you arrive? If not, the
 *                  feature can default to "now" and never ask a second question.
 *
 * WIND ONLY, AND THAT IS DELIBERATE. Sea state is left out (seaStateM: undefined) for the same
 * reason the truth gate leaves it out: the ceiling can only ever make a tone WORSE, so every number
 * below is a FLOOR. The real intraday movement is this much or more — never less. Marine would also
 * double the request count for an answer that cannot change the decision's direction.
 *
 * The tone comes from the shipped resolveConditionTone, never re-typed here. A measurement that
 * re-implements its subject measures itself — scripts/validateEffectiveRanking.ts records a gate
 * that passed green against sabotaged code for exactly that reason.
 *
 * Report only: it prints and writes JSON, it never fails a build.
 *
 * Run: node scripts/measureIntradayWindowSpread.mjs [--national]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { resolveConditionTone, CALMNESS_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));

const beachDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const reportDir = path.join(root, 'reports/wind-model');

/**
 * The beach day. 10:00–18:00 is not a choice made here — it is the window the app already scores
 * over, written identically in App.tsx:315-316, services/recommendationService.ts:215-216 and
 * utils/topPickTiming.ts:20. (That it lives in three places rather than one is a real smell and is
 * reported at the end; this file follows the shipped value rather than inventing a fourth.)
 */
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 18;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
/** The hour a card describes when nobody has touched the slider — the "usual arrival" reference. */
const ARRIVAL_REFERENCE_HOUR = 11;
/** Stay lengths the UI would offer, in hours. 8 is the whole beach day. */
const STAY_LENGTHS = [2, 4, 8];

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const BEAUFORT_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const toBeaufort = (kmh) => {
  let b = 0;
  for (let i = 0; i < BEAUFORT_KMH.length; i += 1) if (kmh >= BEAUFORT_KMH[i]) b = i + 1;
  return b;
};
const sectorOf = (deg) => SECTORS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** CALMNESS_ORDER is ['red','orange','yellow','blue'] — index 0 is the worst tone. */
const calmness = (tone) => CALMNESS_ORDER.indexOf(tone);
const worstTone = (tones) => tones.reduce((worst, tone) => (calmness(tone) < calmness(worst) ? tone : worst));
const calmestTone = (tones) => tones.reduce((best, tone) => (calmness(tone) > calmness(best) ? tone : best));

const CONTROL = new Set([
  'south-aegean-naxos', 'ionian-islands-corfu', 'south-aegean-mykonos',
  'south-aegean-sifnos', 'south-aegean-folegandros',
]);

const national = process.argv.includes('--national');

const regions = readdirSync(beachDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const id = f.replace(/\.json$/, '');
    let raw;
    try { raw = readJson(path.join(beachDir, f)); } catch { return null; }
    const beaches = raw.island?.beaches ?? [];
    if (!beaches.length) return null;
    return { id, beaches };
  })
  .filter(Boolean);

const sample = national
  ? regions
  : [
    ...[...regions].sort((a, b) => b.beaches.length - a.beaches.length).slice(0, 10),
    ...regions.filter(r => CONTROL.has(r.id)),
  ].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);

console.log('Πόσο αλλάζει η απάντηση μέσα στην ίδια μέρα — μέτρηση, όχι πύλη');
console.log(`Περιοχές: ${sample.length}${national ? ' (εθνικά)' : ' (10 μεγαλύτερες + control)'} · ώρες ${DAY_START_HOUR}:00–${DAY_END_HOUR}:00 · άνεμος μόνο (κατώτατο όριο)\n`);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — plan every point before a single request goes out.
// ─────────────────────────────────────────────────────────────────────────────
const pointKey = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const points = new Map();
const requirePoint = (lat, lon) => {
  const key = pointKey(lat, lon);
  if (!points.has(key)) points.set(key, { key, lat, lon, hourly: null });
  return key;
};

const plans = [];
const unmeasured = [];

for (const region of sample) {
  let profiles = {};
  try { profiles = readJson(path.join(exposureDir, `${region.id}.json`)).profiles ?? {}; } catch { /* no geometry */ }

  const clusters = buildBeachForecastClusters(region.beaches);
  if (!clusters.length) {
    unmeasured.push({ id: region.id, why: 'χωρίς clusters πρόγνωσης (παραλίες χωρίς συντεταγμένες)' });
    continue;
  }
  if (!Object.keys(profiles).length) {
    unmeasured.push({ id: region.id, why: 'χωρίς γεωμετρία έκθεσης' });
    continue;
  }

  plans.push({
    region,
    profiles,
    clusters,
    clusterKeys: clusters.map(c => requirePoint(c.lat, c.lon)),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — one batched, paced sweep. A request that will not answer is fatal:
// a measurement that silently drops points reports a country it never read.
// ─────────────────────────────────────────────────────────────────────────────
const POINTS_PER_REQUEST = 32;
const POINTS_PER_MINUTE = 450;
const FETCH_ATTEMPTS = 6;
const MAX_BACKOFF_MS = 60_000;
const FORECAST_DAYS = 3;
const sleep = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });

const fetchJsonWithBackoff = async (url) => {
  let wait = 10_000;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    let response = null;
    let transportError = null;
    try { response = await fetch(url); } catch (error) { transportError = error; }
    if (response?.ok) return response.json();

    const reason = transportError ? transportError.message : `Open-Meteo HTTP ${response.status}`;
    const retryable = transportError !== null || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === FETCH_ATTEMPTS) {
      throw new Error(`${reason} (μετά από ${attempt} προσπάθειες)`);
    }
    console.log(`   … ${reason} — ξαναδοκιμή σε ${wait / 1000}s`);
    await sleep(wait);
    wait = Math.min(wait * 2, MAX_BACKOFF_MS);
  }
  throw new Error('unreachable');
};

const allPoints = [...points.values()];
const requestCount = Math.ceil(allPoints.length / POINTS_PER_REQUEST);
const paceMs = Math.round((POINTS_PER_REQUEST / POINTS_PER_MINUTE) * 60_000);
console.log(`Σημεία ανέμου: ${allPoints.length} μοναδικά → ${requestCount} αιτήματα, `
  + `~${Math.ceil((requestCount - 1) * paceMs / 1000)}s\n`);

for (let i = 0; i < allPoints.length; i += POINTS_PER_REQUEST) {
  const chunk = allPoints.slice(i, i + POINTS_PER_REQUEST);
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${chunk.map(p => p.lat.toFixed(4)).join(',')}`
    + `&longitude=${chunk.map(p => p.lon.toFixed(4)).join(',')}`
    + '&hourly=wind_speed_10m,wind_direction_10m&timezone=Europe%2FAthens'
    + `&forecast_days=${FORECAST_DAYS}&wind_speed_unit=kmh`;

  let body;
  try {
    body = await fetchJsonWithBackoff(url);
  } catch (error) {
    console.error(`\nΑΠΕΤΥΧΕ: δεν διαβάστηκε ο πραγματικός άνεμος — ${error.message}`);
    console.error('Η μέτρηση δεν παραλείπει σημεία: μια μισοδιαβασμένη χώρα δεν είναι απάντηση.');
    process.exit(1);
  }

  const locations = Array.isArray(body) ? body : [body];
  if (locations.length !== chunk.length) {
    console.error(`\nΑΠΕΤΥΧΕ: ζητήθηκαν ${chunk.length} σημεία και ήρθαν ${locations.length}.`);
    console.error('Τα αποτελέσματα ταιριάζουν με τη σειρά, άρα θα αποδίδαμε τον άνεμο άλλης ακτής.');
    process.exit(1);
  }
  locations.forEach((location, k) => { chunk[k].hourly = location.hourly; });

  const done = Math.min(i + POINTS_PER_REQUEST, allPoints.length);
  if (process.stdout.isTTY) process.stdout.write(`\r   ${done}/${allPoints.length} σημεία`);
  if (done < allPoints.length) await sleep(paceMs);
}
if (process.stdout.isTTY) process.stdout.write('\n');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — the tone at every hour of every beach day.
// ─────────────────────────────────────────────────────────────────────────────
/** All forecast dates present in the series, so the loop below never assumes how many came back. */
const datesOf = (key) => [...new Set(points.get(key).hourly.time.map(t => t.slice(0, 10)))];

const seriesAt = (key, date, hour) => {
  const h = points.get(key).hourly;
  const stamp = `${date}T${String(hour).padStart(2, '0')}:00`;
  const index = h.time.indexOf(stamp);
  if (index < 0) return null;
  const kmh = h.wind_speed_10m[index];
  const deg = h.wind_direction_10m[index];
  if (typeof kmh !== 'number' || typeof deg !== 'number') return null;
  return { kmh, deg };
};

const totals = {
  beachDays: 0,
  /** The day is not one answer: at least two different tones between 10:00 and 18:00. */
  notUniform: 0,
  /** A 2h slot exists whose worst hour is calmer than the day's worst hour — beaches we could offer. */
  shortStayUpside: 0,
  /** The day's worst hour is rougher than 11:00 — days we currently describe by their calm start. */
  allDayWarning: 0,
  /**
   * For a 2h stay, arriving at the wrong hour costs TWO tone steps or more (blue→orange, say).
   *
   * The first version of this counted "the answer depends on when you arrive", which turned out to
   * be the same set as shortStayUpside — every hour belongs to some 2h window, so the day's worst
   * tone IS the worst window tone, and "a better window exists" and "the windows differ" are one
   * statement. Two identical numbers printed as two findings is how a measurement flatters itself.
   * This asks something the other line cannot answer: whether arrival time is a detail or a
   * different day.
   */
  arrivalCostsTwoSteps: 0,
};
/** Per stay length: how far the offered tone can improve over the all-day tone. */
const byStayLength = Object.fromEntries(STAY_LENGTHS.map(h => [h, { better: 0, same: 0 }]));
/** Which colour flips actually happen, so the upside is not just a percentage. */
const transitions = new Map();
const perRegion = [];

for (const plan of plans) {
  const { region, profiles, clusters } = plan;

  const clusterOfBeach = new Map();
  clusters.forEach((c, index) => c.beachIds.forEach(id => clusterOfBeach.set(id, index)));

  const regionStat = { id: region.id, beachDays: 0, notUniform: 0, shortStayUpside: 0, allDayWarning: 0 };

  for (const beach of region.beaches) {
    const clusterIndex = clusterOfBeach.get(beach.id);
    if (clusterIndex === undefined) continue;
    const profile = profiles[beach.id];
    if (!profile?.sectors) continue;
    const key = plan.clusterKeys[clusterIndex];

    for (const date of datesOf(key)) {
      const tones = [];
      for (const hour of HOURS) {
        const wind = seriesAt(key, date, hour);
        if (!wind) { tones.length = 0; break; }
        const exposureLevel = profile.sectors[sectorOf(wind.deg)]?.level;
        if (!exposureLevel) { tones.length = 0; break; }
        tones.push(resolveConditionTone({
          exposureLevel,
          beaufort: toBeaufort(wind.kmh),
          isEnclosedCove: false,
          // Deliberately omitted — see the header. Every number here is a floor.
          seaStateM: undefined,
        }));
      }
      if (tones.length !== HOURS.length) continue;

      totals.beachDays += 1;
      regionStat.beachDays += 1;

      const allDay = worstTone(tones);
      const distinct = new Set(tones);
      if (distinct.size > 1) { totals.notUniform += 1; regionStat.notUniform += 1; }

      // Every window of each offered length, scored the way the feature would score it:
      // the WORST hour inside the window, never the average.
      for (const length of STAY_LENGTHS) {
        const windowWorsts = [];
        for (let start = 0; start + length <= tones.length; start += 1) {
          windowWorsts.push(worstTone(tones.slice(start, start + length)));
        }
        if (windowWorsts.length === 0) continue;
        const best = calmestTone(windowWorsts);
        if (calmness(best) > calmness(allDay)) byStayLength[length].better += 1;
        else byStayLength[length].same += 1;

        if (length === 2) {
          if (calmness(best) > calmness(allDay)) {
            totals.shortStayUpside += 1;
            regionStat.shortStayUpside += 1;
            const label = `${allDay} → ${best}`;
            transitions.set(label, (transitions.get(label) ?? 0) + 1);
          }
          const spread = calmness(best) - calmness(worstTone(windowWorsts));
          if (spread >= 2) totals.arrivalCostsTwoSteps += 1;
        }
      }

      const arrival = tones[ARRIVAL_REFERENCE_HOUR - DAY_START_HOUR];
      if (calmness(allDay) < calmness(arrival)) {
        totals.allDayWarning += 1;
        regionStat.allDayWarning += 1;
      }
    }
  }

  if (regionStat.beachDays > 0) perRegion.push(regionStat);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — the answer.
// ─────────────────────────────────────────────────────────────────────────────
const pct = (n) => (totals.beachDays ? (n / totals.beachDays * 100) : 0);
const fmt = (n) => `${pct(n).toFixed(1)}%`;

console.log(`Παραλιο-ημέρες μετρημένες: ${totals.beachDays.toLocaleString('el-GR')}\n`);
console.log(`  Η μέρα ΔΕΝ είναι μία απάντηση (≥2 χρώματα 10:00–18:00) ....... ${fmt(totals.notUniform)}  (${totals.notUniform.toLocaleString('el-GR')})`);
console.log(`  Υπάρχει δίωρο καλύτερο από τη μέρα (τι ΚΕΡΔΙΖΟΥΜΕ) .......... ${fmt(totals.shortStayUpside)}  (${totals.shortStayUpside.toLocaleString('el-GR')})`);
console.log(`  Όλη μέρα χειρότερη από τις 11:00 (τι ΚΡΥΒΟΥΜΕ σήμερα) ....... ${fmt(totals.allDayWarning)}  (${totals.allDayWarning.toLocaleString('el-GR')})`);
console.log(`  Λάθος ώρα άφιξης = 2+ σκαλιά χειρότερα (δίωρο) ............... ${fmt(totals.arrivalCostsTwoSteps)}  (${totals.arrivalCostsTwoSteps.toLocaleString('el-GR')})\n`);

console.log('  Ανά διάρκεια παραμονής — πόσο συχνά προσφέρει καλύτερο χρώμα από την «όλη μέρα»:');
for (const length of STAY_LENGTHS) {
  const { better } = byStayLength[length];
  console.log(`    ${String(length).padStart(2)}ω: ${fmt(better).padStart(6)}  (${better.toLocaleString('el-GR')})`);
}

if (transitions.size) {
  console.log('\n  Ποια χρώματα ξεκλειδώνει το δίωρο:');
  [...transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([label, count]) => console.log(`    ${label.padEnd(18)} ${count.toLocaleString('el-GR')}`));
}

const topRegions = [...perRegion]
  .filter(r => r.beachDays >= 50)
  .sort((a, b) => (b.notUniform / b.beachDays) - (a.notUniform / a.beachDays))
  .slice(0, 8);
if (topRegions.length) {
  console.log('\n  Περιοχές όπου η μέρα αλλάζει περισσότερο:');
  topRegions.forEach(r => console.log(
    `    ${r.id.padEnd(38)} ${(r.notUniform / r.beachDays * 100).toFixed(1).padStart(5)}%  (${r.beachDays} παραλιο-ημέρες)`
  ));
}

if (unmeasured.length) {
  console.log(`\n  Δεν μετρήθηκαν ${unmeasured.length} περιοχές:`);
  unmeasured.slice(0, 10).forEach(u => console.log(`    ${u.id} — ${u.why}`));
}

/**
 * The decision line. The threshold was written into 01-product-manager.md BEFORE this ran, so it
 * cannot be moved to fit the result: under ~10% the feature is decoration, over ~30% it is a
 * differentiator. Between the two it is a judgement call, and the file says so rather than
 * pretending the number decided.
 */
const headline = pct(totals.shortStayUpside);
console.log('\n' + '─'.repeat(72));
if (headline < 10) {
  console.log(`ΕΤΥΜΗΓΟΡΙΑ: ${headline.toFixed(1)}% — ΚΑΤΩ από το 10%. Το feature είναι διακόσμηση. Μην το χτίσεις.`);
} else if (headline < 30) {
  console.log(`ΕΤΥΜΗΓΟΡΙΑ: ${headline.toFixed(1)}% — στη γκρίζα ζώνη (10-30%). Αξίζει μόνο αν δεν ρωτάει τον χρήστη.`);
} else {
  console.log(`ΕΤΥΜΗΓΟΡΙΑ: ${headline.toFixed(1)}% — ΠΑΝΩ από 30%. Αλλάζει την απάντηση αρκετά συχνά· χτίσ' το.`);
}
console.log('Θυμίζω: άνεμος μόνο, χωρίς κύμα — ο πραγματικός αριθμός είναι αυτός ή μεγαλύτερος.');
console.log('─'.repeat(72));

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'intraday-window-spread.json');
writeFileSync(outPath, JSON.stringify({
  measuredAt: new Date().toISOString(),
  scope: national ? 'national' : '10-largest-plus-controls',
  windOnly: true,
  dayWindow: { startHour: DAY_START_HOUR, endHour: DAY_END_HOUR },
  arrivalReferenceHour: ARRIVAL_REFERENCE_HOUR,
  totals,
  percentages: {
    notUniform: pct(totals.notUniform),
    shortStayUpside: pct(totals.shortStayUpside),
    allDayWarning: pct(totals.allDayWarning),
    arrivalCostsTwoSteps: pct(totals.arrivalCostsTwoSteps),
  },
  byStayLength,
  transitions: Object.fromEntries(transitions),
  perRegion,
  unmeasured,
}, null, 2) + '\n');
console.log(`\nΓράφτηκε: ${path.relative(root, outPath)}`);
