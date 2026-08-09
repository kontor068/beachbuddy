/**
 * ΠΟΤΕ ΦΑΙΝΕΤΑΙ Η ΓΡΑΜΜΗ «ΔΕΝ ΚΡΑΤΑΕΙ ΟΛΗ ΜΕΡΑ» — μέτρηση, όχι πύλη.
 *
 * Η γραμμή (App.tsx, dayTurnNote) σιωπά σκόπιμα όταν η μέρα κρατάει ή καλυτερεύει. Καλός
 * σχεδιασμός — και ταυτόχρονα ο λόγος που ο κατασκευαστής της άνοιξε το site στις 17:12 και
 * δεν είδε τίποτα. «Δεν τη βλέπω» και «δεν δουλεύει» είναι δύο πολύ διαφορετικά πράγματα, και
 * μόνο ένας αριθμός τα ξεχωρίζει.
 *
 * ΤΙ ΡΩΤΑΕΙ, για τη ΣΗΜΕΡΙΝΗ μέρα, με ζωντανό Open-Meteo: σε πόσες παραλίες θα τυπωνόταν η
 * γραμμή αν ο επισκέπτης άνοιγε το site σε κάθε ώρα από τις 08:00 ως τις 18:00. Η γραμμή
 * κοιτάει μόνο τις ώρες που ΑΠΟΜΕΝΟΥΝ, οπότε η απάντηση αλλάζει δραματικά μέσα στη μέρα: το
 * πρωί έχει όλη τη μέρα μπροστά της να χαλάσει, στις 18:00 δεν έχει τίποτα.
 *
 * Η ΑΠΑΝΤΗΣΗ ΠΟΥ ΠΕΡΙΜΕΝΟΥΜΕ ΝΑ ΕΙΝΑΙ ΔΥΣΑΡΕΣΤΗ: αν το απόγευμα είναι κοντά στο μηδέν, τότε
 * το feature είναι πρωινό και πρέπει να λέγεται πρωινό — όχι να θεωρείται σπασμένο.
 *
 * ΑΝΕΜΟΣ ΜΟΝΟ, όπως και το measureIntradayWindowSpread: το ταβάνι της θάλασσας μπορεί μόνο να
 * ΧΕΙΡΟΤΕΡΕΨΕΙ έναν τόνο, άρα κάθε νούμερο εδώ είναι κατώτατο όριο.
 *
 * Τρέξε: node scripts/measureDayTurnVisibility.mjs [--national]
 */
import { readFileSync, readdirSync } from 'node:fs';
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
const { findWorseningTurnFromReadings, getStaySampleSlots } = require(path.join(root, 'utils/stayWindow.ts'));

const beachDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// The same bounds App.tsx uses for the hour slider (App.tsx:326-327).
const SLIDER_START_HOUR = 8;
const SLIDER_END_HOUR = 21;
/** The hours a visitor might realistically open the site. */
const OPEN_HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = (deg) => SECTORS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
const BFT = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
const toBeaufort = (kmh) => {
  for (let i = BFT.length - 1; i >= 0; i -= 1) if (kmh >= BFT[i]) return i + 1;
  return 0;
};

const CONTROL = new Set(['south-aegean-naxos', 'ionian-islands-corfu', 'south-aegean-mykonos']);
const national = process.argv.includes('--national');

const regions = readdirSync(beachDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    const id = f.replace(/\.json$/, '');
    let raw;
    try { raw = readJson(path.join(beachDir, f)); } catch { return null; }
    const beaches = raw.island?.beaches ?? [];
    return beaches.length ? { id, beaches } : null;
  })
  .filter(Boolean);

const sample = national
  ? regions
  : [
    ...[...regions].sort((a, b) => b.beaches.length - a.beaches.length).slice(0, 10),
    ...regions.filter(r => CONTROL.has(r.id)),
  ].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);

const pointKey = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const points = new Map();
const requirePoint = (lat, lon) => {
  const key = pointKey(lat, lon);
  if (!points.has(key)) points.set(key, { key, lat, lon, hourly: null });
  return key;
};

const plans = [];
for (const region of sample) {
  let profiles = {};
  try { profiles = readJson(path.join(exposureDir, `${region.id}.json`)).profiles ?? {}; } catch { continue; }
  if (!Object.keys(profiles).length) continue;
  const clusters = buildBeachForecastClusters(region.beaches);
  if (!clusters.length) continue;
  plans.push({ region, profiles, clusters, clusterKeys: clusters.map(c => requirePoint(c.lat, c.lon)) });
}

// Μια μέτρηση που δεν διάβασε τίποτα ΔΕΝ τυπώνει πίνακα με μηδενικά: διαβάζεται σαν «το feature
// δεν εμφανίζεται πουθενά», ενώ η αλήθεια είναι «οι διαδρομές ήταν λάθος». Έγινε ακριβώς αυτό
// την πρώτη φορά που έτρεξε το αρχείο.
if (plans.length === 0) {
  console.error('ΑΠΕΤΥΧΕ: καμία περιοχή δεν διαβάστηκε.');
  console.error(`  παραλίες: ${beachDir}`);
  console.error(`  γεωμετρία: ${exposureDir}`);
  console.error('Δεν τυπώνω πίνακα από κενό — θα διαβαζόταν ως αποτέλεσμα.');
  process.exit(1);
}

console.log('Πότε φαίνεται η γραμμή «δεν κρατάει όλη μέρα» — ζωντανή μέτρηση');
console.log(`Περιοχές: ${plans.length}${national ? ' (εθνικά)' : ' (10 μεγαλύτερες + control)'} · άνεμος μόνο (κατώτατο όριο)\n`);

const POINTS_PER_REQUEST = 32;
const POINTS_PER_MINUTE = 450;
const sleep = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });
const allPoints = [...points.values()];
const paceMs = Math.round((POINTS_PER_REQUEST / POINTS_PER_MINUTE) * 60_000);
console.log(`Σημεία ανέμου: ${allPoints.length} → ${Math.ceil(allPoints.length / POINTS_PER_REQUEST)} αιτήματα\n`);

for (let i = 0; i < allPoints.length; i += POINTS_PER_REQUEST) {
  const chunk = allPoints.slice(i, i + POINTS_PER_REQUEST);
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${chunk.map(p => p.lat.toFixed(4)).join(',')}`
    + `&longitude=${chunk.map(p => p.lon.toFixed(4)).join(',')}`
    + '&hourly=wind_speed_10m,wind_direction_10m&timezone=Europe%2FAthens'
    + '&forecast_days=1&wind_speed_unit=kmh';
  let body;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = await response.json();
  } catch (error) {
    console.error(`ΑΠΕΤΥΧΕ: δεν διαβάστηκε ο πραγματικός άνεμος — ${error.message}`);
    process.exit(1);
  }
  const locations = Array.isArray(body) ? body : [body];
  if (locations.length !== chunk.length) {
    console.error(`ΑΠΕΤΥΧΕ: ζητήθηκαν ${chunk.length} σημεία, ήρθαν ${locations.length}.`);
    process.exit(1);
  }
  locations.forEach((loc, index) => { points.get(chunk[index].key).hourly = loc.hourly; });
  if (i + POINTS_PER_REQUEST < allPoints.length) await sleep(paceMs);
}

const seriesAt = (key, hour) => {
  const h = points.get(key).hourly;
  const index = h.time.findIndex(t => Number(t.slice(11, 13)) === hour);
  if (index < 0) return null;
  const kmh = h.wind_speed_10m[index];
  const deg = h.wind_direction_10m[index];
  if (typeof kmh !== 'number' || typeof deg !== 'number') return null;
  return { kmh, deg };
};

/** Per opening hour: how many beaches would print the line. */
const byHour = new Map(OPEN_HOURS.map(h => [h, { fired: 0, total: 0 }]));
let anyHourFired = 0;
let beachesMeasured = 0;

for (const plan of plans) {
  const clusterOfBeach = new Map();
  plan.clusters.forEach((c, index) => c.beachIds.forEach(id => clusterOfBeach.set(id, index)));

  for (const beach of plan.region.beaches) {
    const clusterIndex = clusterOfBeach.get(beach.id);
    if (clusterIndex === undefined) continue;
    const profile = plan.profiles[beach.id];
    if (!profile?.sectors) continue;
    const key = plan.clusterKeys[clusterIndex];
    beachesMeasured += 1;
    let firedSomewhere = false;

    for (const openHour of OPEN_HOURS) {
      const stat = byHour.get(openHour);
      // Exactly what App builds: the slots from "now" to the end of the slider day, then the
      // every-other-hour sampling, then the same finder.
      const slots = [];
      for (let hour = Math.max(openHour, SLIDER_START_HOUR); hour <= SLIDER_END_HOUR; hour += 1) {
        const wind = seriesAt(key, hour);
        if (!wind) continue;
        const exposureLevel = profile.sectors[sectorOf(wind.deg)]?.level;
        if (!exposureLevel) continue;
        slots.push({ dt: hour, exposureLevel, beaufort: toBeaufort(wind.kmh), seaStateM: undefined });
      }
      if (slots.length < 2) continue;
      stat.total += 1;
      if (findWorseningTurnFromReadings(getStaySampleSlots(slots))) { stat.fired += 1; firedSomewhere = true; }
    }
    if (firedSomewhere) anyHourFired += 1;
  }
}

console.log(`Παραλίες με γεωμετρία που μετρήθηκαν: ${beachesMeasured.toLocaleString('el-GR')}\n`);
console.log('  ώρα που ανοίγει ο επισκέπτης │ παραλίες που δείχνουν τη γραμμή');
console.log('  ─────────────────────────────┼────────────────────────────────');
for (const hour of OPEN_HOURS) {
  const { fired, total } = byHour.get(hour);
  const pct = total ? (fired / total) * 100 : 0;
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`  ${String(hour).padStart(2, '0')}:00                        │ ${String(fired).padStart(5)} / ${String(total).padStart(5)}  ${pct.toFixed(1).padStart(5)}%  ${bar}`);
}
const anyPct = beachesMeasured ? (anyHourFired / beachesMeasured) * 100 : 0;
console.log(`\n  Παραλίες όπου η γραμμή εμφανίζεται σε ΚΑΠΟΙΑ ώρα σήμερα: ${anyHourFired.toLocaleString('el-GR')} (${anyPct.toFixed(1)}%)`);
console.log('\n  Διάβασέ το έτσι: η γραμμή είναι εργαλείο ΠΡΩΙΝΟΥ. Όσο προχωράει η μέρα, λιγότερες');
console.log('  ώρες απομένουν να χαλάσουν, άρα λιγότερα να πει — μέχρι που δεν λέει τίποτα.');
