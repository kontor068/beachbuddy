#!/usr/bin/env node
/**
 * ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΚΑΘΕΤΑΙ ΤΟ ΚΑΤΩΦΛΙ «ΟΛΟ ΤΟ ΝΕΡΟ ΦΕΥΓΕΙ» — ΣΑΡΩΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΑΦΟΡΜΗ, ΜΕ ΝΟΥΜΕΡΑ. Ελαφονήσι (595), 22/08/2026 13:00-16:00. Χρήστης στην παραλία: «λάδι».
 * Η κάρτα: 0,9 μ. · 4 Μπφ · «Αρκετό κύμα» · «μην κολυμπήσεις» (swimScore 33, warning
 * `rough_sea`). Μετρημένο με scripts/explainBeachWaveNumber.mjs: ο άνεμος 25 χλμ/ώ από 312°
 * (onshore −0,889 — απόγειος), το κύμα 0,86-0,88 μ. από 293-294° (onshore −0,70), το δικό μας
 * SMB 0,41 μ. Το κελί μέτρησης είναι 7 χλμ ανοιχτά.
 *
 * Ο κανόνας που γράφτηκε ΓΙ' ΑΥΤΗΝ ΑΚΡΙΒΩΣ ΤΗΝ ΠΑΡΑΛΙΑ (utils/shoreWave.isSeaDepartingShore,
 * 16/08/2026) δεν άναψε: απαιτεί ΚΑΘΕ συστατικό ≤ −0,8 και το κύμα σήμερα είναι −0,70.
 * Αστοχία 0,097 — 135° εκτός μετωπικής αντί για τις απαιτούμενες 143°.
 *
 * ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΑΠΛΑ «ΧΑΛΑΡΩΣΕ ΤΟ ΚΑΤΩΦΛΙ». Η μέτρηση της 16/08 σύγκρινε ΔΥΟ τιμές, −0,5 και
 * −0,8, σε ΜΙΑ μέρα, και απέρριψε το −0,5 γιατί μπαίνουν περιπτώσεις «λοξά» με άλματα από 1,6 μ.
 * στο δάπεδο. Κανείς δεν μέτρησε ΑΝΑΜΕΣΑ, και κανείς δεν το ξαναμέτρησε σε δεύτερο παράθυρο —
 * που είναι το ίδιο ελάττωμα που η βίβλος καταγράφει ως αιτία του 72% βαθμονόμησης.
 *
 * ΤΙ ΣΑΡΩΝΕΙ. Κατώφλια −0,80 → −0,50 ανά 0,05, σε ΔΥΟ παραλλαγές:
 *   V1 «και τα δύο»   — άνεμος ≤ t ΚΑΙ κάθε συστατικό ≤ t   (ό,τι κάνει σήμερα ο κανόνας)
 *   V2 «μόνο το νερό» — άνεμος ≤ −0,80 (ΑΜΕΤΑΒΛΗΤΟ) ΚΑΙ κάθε συστατικό ≤ t
 * Η V2 υπάρχει γιατί το Ελαφονήσι ΠΕΡΝΑΕΙ ήδη την πύλη του ανέμου· χαλαρώνει μόνο η γωνία της
 * ΘΑΛΑΣΣΑΣ, που είναι το στενότερο δυνατό άνοιγμα.
 *
 * ΤΡΕΧΕΙ ΤΟΝ ΚΩΔΙΚΑ ΠΟΥ ΦΕΥΓΕΙ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ. Το κατώφλι μπαίνει με προσωρινή αντικατάσταση
 * του `OFFSHORE_FLAT_MAX_ONSHORE` πάνω στο ίδιο module — η ίδια τεχνική που χρησιμοποιεί ήδη το
 * scripts/validateDepartingSeaEvidence.mjs. Το `SHORE_RAMP_FULL_ONSHORE` παγώνει στο −0,8 κατά
 * τη φόρτωση, οπότε η ΡΑΜΠΑ δεν κουνιέται: μετριέται μόνο η πύλη, όχι η κλίμακα.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΓΙΑ ΚΑΘΕ ΚΑΤΩΦΛΙ
 *   • ώρες×παραλία και ΔΙΑΚΡΙΤΕΣ παραλίες που αλλάζουν αριθμό
 *   • πτώση: διάμεσος / p90 / μέγιστη
 *   • ΨΕΥΤΙΚΗ ΗΡΕΜΙΑ (σκανδάλη #1 της §9): πόσες πέφτουν κάτω από 0,50 μ., και πόσες από
 *     ≥1,00 μ. κατευθείαν στο δάπεδο
 *   • σε τι ΕΠΙΠΕΔΟ τομέα συμβαίνει: μια αλλαγή σε τομέα 'exposed' είναι κόκκινη σημαία
 *   • οι παραλίες-μάρτυρες ονομαστικά: σε ποιο κατώφλι ανάβουν και τι νούμερο παίρνουν
 *
 * ⚠️ ΔΙΑΒΑΖΕΙ `models=ewam`, ΟΧΙ ΤΟ ΠΡΟΕΠΙΛΕΓΜΕΝΟ ΜΟΝΤΕΛΟ — ΚΑΙ ΤΟ ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ.
 * Η πρώτη εκτέλεση αυτού του αρχείου ζήτησε θάλασσα χωρίς `models`, όπως κάνει και το
 * scripts/measureDepartingSeaNationally.mjs. Στο Ελαφονήσι 15:00 αυτό έδωσε αποθαλασσιά από
 * 282-287° → onshore −0,54, ενώ το ewam — που είναι ΑΥΤΟ που διαβάζει η εφαρμογή
 * (services/forecast/openMeteoProvider.ts:125, `models=ewam` για τις πρώτες 94 ώρες) — δίνει
 * 290-293° → onshore −0,68. Διαφορά 0,14 σε έναν άξονα όπου το κατώφλι κρίνεται στο 0,05:
 * η μέτρηση με λάθος μοντέλο θα διάλεγε λάθος κατώφλι.
 *
 * ΤΙ ΔΕΝ ΜΟΝΤΕΛΟΠΟΙΕΙΤΑΙ ΕΔΩ, ΡΗΤΑ: τα 56 σημεία όπου η προτίμηση γυρίζει σε `meteofrance_wave`
 * (scripts/bakeMarineModelPreference.mjs), ο μάρτυρας κορυφής (`uncorroboratedSpikeHours`) και η
 * ουρά των ωρών 95-144. Καμία από τις τρεις δεν αγγίζει τις 14 ώρες κολύμβησης της ίδιας μέρας
 * για τη συντριπτική πλειονότητα των σημείων — αλλά είναι λόγος να μη διαβαστεί ο πίνακας ως
 * ακριβής στο ±1 παραλία.
 *
 * ΠΟΛΛΑΠΛΑ ΠΑΡΑΘΥΡΑ. Χωρίς `--days` τρέχει ζωντανά. Με ημερομηνίες τρέχει το αρχείο προγνώσεων:
 *
 *   node scripts/measureDepartingSeaThreshold.mjs
 *   node scripts/measureDepartingSeaThreshold.mjs --days=2025-08-14,2024-06-29,2022-09-06
 *
 * REPORT-ONLY. Δεν γράφει δεδομένα παραγωγής. Γράφει reports/weather/departing-sea-threshold-*.json.
 * Το κλειδί έρχεται από το περιβάλλον ή το .env και ΔΕΝ τυπώνεται ποτέ.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

// ΠΡΟΣΟΧΗ ΣΤΗ ΣΕΙΡΑ: το shoreWave πρέπει να φορτωθεί ΠΡΙΝ αγγίξουμε τη σταθερά, ώστε το
// SHORE_RAMP_FULL_ONSHORE του να παγώσει στο πραγματικό −0,8 και η ράμπα να μείνει ακίνητη.
const shoreWave = require(path.join(root, 'utils/shoreWave.ts'));
const offshoreModule = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const windExposure = require(path.join(root, 'utils/windExposure.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const SHIPPED_THRESHOLD = offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE;
if (shoreWave.SHORE_RAMP_FULL_ONSHORE !== SHIPPED_THRESHOLD) {
  console.error('Η ράμπα δεν κοιτάει την ίδια σταθερά — η σάρωση θα μετρούσε δύο πράγματα μαζί.');
  process.exit(1);
}

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const DAYS = arg('days', '').split(',').map(s => s.trim()).filter(Boolean);
const THRESHOLDS = [-0.80, -0.75, -0.70, -0.65, -0.60, -0.55, -0.50];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const WATCH = new Map([[595, 'Ελαφονήσι'], [636, 'Λυγαριά'], [645, 'Σταλίδα'], [1116, 'Σχινιάς']]);

const API_KEY = process.env.OPEN_METEO_API_KEY
  || (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*OPEN_METEO_API_KEY\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const PAID = Boolean(API_KEY);
console.log(`κλειδί: ${PAID ? 'OK (δεν τυπώνεται)' : 'ΟΧΙ — δωρεάν hosts'}`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = async url => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(PAID ? `${url}&apikey=${encodeURIComponent(API_KEY)}` : url);
      const payload = await res.json();
      if (!payload?.error) return payload;
      await sleep(15000);
    } catch { await sleep(5000); }
  }
  return null;
};

// ── παραλίες, συστάδες, γεωμετρία ────────────────────────────────────────────────────────────
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const pkey = (lat, lon) => `${lat.toFixed(4)}_${lon.toFixed(4)}`;
const beaches = [];
const windPoints = new Map();
const seaPoints = new Map();

for (const file of fs.readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const region = file.replace('.json', '');
  const list = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island?.beaches;
  if (!Array.isArray(list) || !list.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  for (const cluster of buildBeachForecastClusters(list)) {
    windPoints.set(pkey(cluster.lat, cluster.lon), { lat: cluster.lat, lon: cluster.lon });
    for (const id of cluster.beachIds) {
      const profile = profiles[String(id)];
      // Ίδιο φίλτρο με τη μέτρηση της 16/08: η εκτίμηση ακτής ΔΕΝ μιλάει σε χαμηλή εμπιστοσύνη,
      // οπότε παραλίες χωρίς 'high' δεν μπορούν να αλλάξουν και μόνο θα αραίωναν τα ποσοστά.
      if (!profile || profile.confidence !== 'high') continue;
      const mp = profile.marineSamplePoint;
      if (!mp || typeof profile.facingDeg !== 'number') continue;
      seaPoints.set(pkey(mp.lat, mp.lon), { lat: mp.lat, lon: mp.lon });
      const beach = list.find(b => b.id === id);
      beaches.push({
        id, region, profile,
        name: typeof beach?.name === 'string' ? beach.name : (beach?.name?.gr || ''),
        windKey: pkey(cluster.lat, cluster.lon),
        seaKey: pkey(mp.lat, mp.lon),
      });
    }
  }
}
console.log(`παραλίες high: ${beaches.length} · σημεία ανέμου: ${windPoints.size} · σημεία θάλασσας: ${seaPoints.size}`);

const fetchAll = async (points, host, query, label, day) => {
  const out = new Map();
  const list = [...points.values()];
  // Το αρχείο προγνώσεων δέχεται start_date/end_date· η ζωντανή μέρα δέχεται forecast_days.
  const window = day ? `start_date=${day}&end_date=${day}` : 'forecast_days=1';
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const payload = await getJson(`${host}?latitude=${chunk.map(p => p.lat).join(',')}`
      + `&longitude=${chunk.map(p => p.lon).join(',')}&${query}&timezone=Europe%2FAthens&${window}`);
    if (!Array.isArray(payload)) { console.error(`\n${label}: αποτυχία στο ${i}`); process.exit(1); }
    chunk.forEach((p, k) => out.set(pkey(p.lat, p.lon), payload[k]));
    process.stdout.write(`\r  ${label} ${out.size}/${list.length}`);
  }
  console.log('');
  return out;
};

// Το αρχείο ΠΡΟΓΝΩΣΕΩΝ ζει σε άλλο host· η θάλασσα σερβίρει το δικό της αρχείο στον ίδιο.
const windHost = day => (day
  ? (PAID ? 'https://customer-historical-forecast-api.open-meteo.com/v1/forecast' : 'https://historical-forecast-api.open-meteo.com/v1/forecast')
  : (PAID ? 'https://customer-api.open-meteo.com/v1/forecast' : 'https://api.open-meteo.com/v1/forecast'));
const SEA_HOST = PAID ? 'https://customer-marine-api.open-meteo.com/v1/marine' : 'https://marine-api.open-meteo.com/v1/marine';

const onshoreOf = (fromDeg, facingDeg) => Math.cos((fromDeg - facingDeg) * Math.PI / 180);

/**
 * Ο ΠΡΑΓΜΑΤΙΚΟΣ κανόνας, με το κατώφλι προσωρινά μετακινημένο. Δεν αντιγράφεται λογική:
 * μπαίνει η τιμή, καλείται η εξαγόμενη συνάρτηση, επιστρέφεται η τιμή — πάντα, ακόμη κι αν σκάσει.
 */
const departingAt = (threshold, input) => {
  const original = offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE;
  try {
    offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE = threshold;
    return shoreWave.isSeaDepartingShore(input);
  } finally {
    offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE = original;
  }
};

// ΑΥΤΟΕΛΕΓΧΟΣ: στο κατώφλι που ΗΔΗ φεύγει, η σάρωση οφείλει να συμφωνεί με τον αναλλοίωτο κανόνα.
{
  const probes = [
    { facingDeg: 159.3, windDirectionDeg: 312, components: [{ heightM: 0.86, directionDeg: 294 }] },
    { facingDeg: 159.3, windDirectionDeg: 356, components: [{ heightM: 1.22, directionDeg: 356 }] },
    { facingDeg: 24.2, windDirectionDeg: 180, components: [{ heightM: 0.30, directionDeg: 322 }] },
  ];
  for (const probe of probes) {
    if (departingAt(SHIPPED_THRESHOLD, probe) !== shoreWave.isSeaDepartingShore(probe)) {
      console.error('Ο αυτοέλεγχος απέτυχε: η αντικατάσταση δεν αναπαράγει τον ζωντανό κανόνα.');
      process.exit(1);
    }
  }
  if (offshoreModule.OFFSHORE_FLAT_MAX_ONSHORE !== SHIPPED_THRESHOLD) {
    console.error('Η σταθερά δεν επανήλθε μετά τη δοκιμή.');
    process.exit(1);
  }
  // Και ότι το κατώφλι ΟΝΤΩΣ κουνάει την απάντηση — αλλιώς η σάρωση θα έβγαζε παντού μηδέν.
  if (departingAt(-0.60, probes[0]) === departingAt(-0.80, probes[0])) {
    console.error('Η αντικατάσταση δεν επηρεάζει τον κανόνα — η σάρωση δεν θα μετρούσε τίποτα.');
    process.exit(1);
  }
}

const q = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);

const measureDay = (wind, sea, label) => {
  const buckets = new Map();   // `${variant}|${threshold}` → στατιστικά
  const watchRows = [];
  let considered = 0;

  for (const HOUR of HOURS) {
    for (const b of beaches) {
      const w = wind.get(b.windKey)?.hourly;
      const s = sea.get(b.seaKey)?.hourly;
      if (!w || !s) continue;
      const openM = s.wave_height?.[HOUR];
      const speedMs = w.wind_speed_10m?.[HOUR];
      const windDir = w.wind_direction_10m?.[HOUR];
      if (typeof openM !== 'number' || openM <= 0) continue;
      if (typeof speedMs !== 'number' || typeof windDir !== 'number') continue;

      const facing = b.profile.facingDeg;
      const sector = b.profile.sectors?.[windExposure.windSectorFromDegrees(windDir)];
      if (!sector || typeof sector.fetchKm !== 'number') continue;
      const speedKmh = speedMs * 3.6;
      considered += 1;

      // ΤΑ ΙΔΙΑ ΔΥΟ ΣΥΣΤΑΤΙΚΑ που περνάει το services/recommendationService.ts:1880 — συνολικό
      // κύμα + αποθαλασσιά. Το ξεχωριστό «κύμα ανέμου» μετρήθηκε 16/08 και δίνει ΙΔΙΟ σύνολο
      // με +30% κόστος σε κάθε κλήση θάλασσας· δεν ξαναμπαίνει.
      const components = [
        { heightM: s.wave_height[HOUR], directionDeg: s.wave_direction?.[HOUR] },
        { heightM: s.swell_wave_height?.[HOUR], directionDeg: s.swell_wave_direction?.[HOUR] },
      ];
      const windOnshore = onshoreOf(windDir, facing);

      // Η βάση: τι τυπώνει ΣΗΜΕΡΑ η εκτίμηση ακτής, με τον αναλλοίωτο κανόνα.
      const shoreInput = {
        openWaterWaveHeightM: openM, windSpeedKmh: speedKmh, sector,
        confidence: 'high', arrivingSwellPresent: false,
      };
      const baseM = shoreWave.estimateShoreWaveHeightM({
        ...shoreInput,
        departingSea: departingAt(SHIPPED_THRESHOLD, { facingDeg: facing, windDirectionDeg: windDir, components }),
      });
      const baseShown = typeof baseM === 'number' ? baseM : openM;

      const measurable = components.filter(c => typeof c.heightM === 'number'
        && c.heightM >= shoreWave.DEPARTING_SEA_MIN_COMPONENT_M
        && typeof c.directionDeg === 'number');
      const seaOnshore = measurable.length
        ? Math.max(...measurable.map(c => onshoreOf(c.directionDeg, facing))) : null;

      for (const t of THRESHOLDS) {
        const departs = departingAt(t, { facingDeg: facing, windDirectionDeg: windDir, components });
        for (const variant of ['V1', 'V2']) {
          // V2 κρατάει την πύλη του ΑΝΕΜΟΥ στο −0,80 και χαλαρώνει μόνο τη γωνία της θάλασσας.
          // Επειδή το `departs` απαιτεί ήδη άνεμο ≤ t (χαλαρότερο), το ΚΑΙ με τον αυστηρό έλεγχο
          // δίνει ακριβώς τη V2 χωρίς να ξαναγραφτεί η λογική των συστατικών.
          const on = variant === 'V2' ? (departs && windOnshore <= SHIPPED_THRESHOLD) : departs;
          const m = shoreWave.estimateShoreWaveHeightM({ ...shoreInput, departingSea: on });
          const shown = typeof m === 'number' ? m : openM;
          if (!(shown < baseShown - 0.005)) continue;

          const key = `${variant}|${t.toFixed(2)}`;
          if (!buckets.has(key)) buckets.set(key, { hours: 0, ids: new Set(), drops: [], rows: [] });
          const bucket = buckets.get(key);
          bucket.hours += 1;
          bucket.ids.add(b.id);
          bucket.drops.push(baseShown - shown);
          bucket.rows.push({
            id: b.id, name: b.name, region: b.region, day: label, hour: HOUR,
            openM, baseShown, shown, level: sector.level,
            windOnshore: Number(windOnshore.toFixed(3)),
            seaOnshore: seaOnshore === null ? null : Number(seaOnshore.toFixed(3)),
          });
        }
      }

      if (WATCH.has(b.id)) {
        const byThreshold = {};
        for (const t of THRESHOLDS) {
          const departs = departingAt(t, { facingDeg: facing, windDirectionDeg: windDir, components });
          const v2 = departs && windOnshore <= SHIPPED_THRESHOLD;
          const m = shoreWave.estimateShoreWaveHeightM({ ...shoreInput, departingSea: v2 });
          byThreshold[t.toFixed(2)] = typeof m === 'number' ? m : null;
        }
        watchRows.push({
          day: label, id: b.id, name: WATCH.get(b.id), hour: HOUR, openM, baseShown,
          windOnshore: Number(windOnshore.toFixed(3)),
          seaDir: s.wave_direction?.[HOUR] ?? null,
          seaOnshore: seaOnshore === null ? null : Number(seaOnshore.toFixed(3)),
          byThreshold,
        });
      }
    }
  }
  return { buckets, watchRows, considered };
};

// ── τρέξιμο ──────────────────────────────────────────────────────────────────────────────────
const days = DAYS.length ? DAYS : [null];
const totals = new Map();
const allWatch = [];
let consideredAll = 0;

for (const day of days) {
  const label = day || 'ζωντανά';
  console.log(`\n──── ${label} ────`);
  const wind = await fetchAll(windPoints, windHost(day),
    'hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms', 'άνεμος', day);
  const sea = await fetchAll(seaPoints, SEA_HOST,
    'hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_direction'
    + '&models=ewam&cell_selection=sea', 'θάλασσα', day);
  const { buckets, watchRows, considered } = measureDay(wind, sea, label);
  consideredAll += considered;
  allWatch.push(...watchRows);
  for (const [key, v] of buckets) {
    if (!totals.has(key)) totals.set(key, { hours: 0, ids: new Set(), drops: [], rows: [] });
    const t = totals.get(key);
    t.hours += v.hours;
    v.ids.forEach(id => t.ids.add(id));
    t.drops.push(...v.drops);
    t.rows.push(...v.rows);
  }
}

// ── αναφορά ──────────────────────────────────────────────────────────────────────────────────
const table = (variant) => {
  console.log(`\n════ ${variant === 'V1'
    ? 'V1 — άνεμος ΚΑΙ νερό στο ίδιο κατώφλι'
    : 'V2 — άνεμος σταθερά ≤ −0,80, χαλαρώνει ΜΟΝΟ το νερό'} ════`);
  console.log('κατώφλι  ώρες×παρ  παραλίες  διάμ.   p90   μέγ.  <0,50μ  ≥1,00→δάπεδο  exposed');
  for (const t of THRESHOLDS) {
    const v = totals.get(`${variant}|${t.toFixed(2)}`);
    if (!v || !v.drops.length) { console.log(`${t.toFixed(2).padStart(7)} ${'0'.padStart(9)}`); continue; }
    const d = v.drops.slice().sort((a, b) => a - b);
    const under50 = v.rows.filter(r => r.baseShown >= 0.5 && r.shown < 0.5).length;
    const toFloor = v.rows.filter(r => r.baseShown >= 1 && r.shown <= 0.11).length;
    const exposed = v.rows.filter(r => r.level === 'exposed').length;
    console.log(
      `${t.toFixed(2).padStart(7)} ${String(v.hours).padStart(9)} ${String(v.ids.size).padStart(9)}`
      + ` ${q(d, 0.5).toFixed(2).padStart(6)} ${q(d, 0.9).toFixed(2).padStart(5)} ${d[d.length - 1].toFixed(2).padStart(5)}`
      + ` ${String(under50).padStart(7)} ${String(toFloor).padStart(13)} ${String(exposed).padStart(8)}`
    );
  }
};
console.log(`\n\n===== ΣΑΡΩΣΗ ΚΑΤΩΦΛΙΟΥ (${days.length} μέρα/ες · ${consideredAll} ώρες×παραλία εξετάστηκαν) =====`);
table('V1');
table('V2');

console.log('\n──── ΟΙ ΠΑΡΑΛΙΕΣ-ΜΑΡΤΥΡΕΣ (V2) ────');
for (const [id, name] of WATCH) {
  const rows = allWatch.filter(r => r.id === id);
  if (!rows.length) { console.log(`  ${name} (${id}): δεν μετρήθηκε (χωρίς προφίλ high ή χωρίς δεδομένα)`); continue; }
  const worst = rows.slice().sort((a, b) => b.openM - a.openM)[0];
  const turnsOn = THRESHOLDS.find(t => worst.byThreshold[t.toFixed(2)] !== null);
  console.log(`  ${name} (${id}) ${worst.day} ${worst.hour}:00 — ανοιχτά ${worst.openM} μ. · τυπώνει σήμερα ${worst.baseShown} μ.`
    + ` · άνεμος onshore ${worst.windOnshore} · κύμα από ${worst.seaDir}° onshore ${worst.seaOnshore}`);
  console.log(`      ανάβει στο ${turnsOn === undefined ? 'ΚΑΝΕΝΑ κατώφλι' : turnsOn.toFixed(2)}  →  `
    + THRESHOLDS.map(t => `${t.toFixed(2)}:${worst.byThreshold[t.toFixed(2)] ?? '—'}`).join('  '));
}

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const stamp = (days[0] || 'live') + (days.length > 1 ? `_x${days.length}` : '');
const outFile = path.join(outDir, `departing-sea-threshold-${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  generatedFor: days, shippedThreshold: SHIPPED_THRESHOLD, thresholds: THRESHOLDS,
  beachesMeasured: beaches.length, consideredBeachHours: consideredAll,
  summary: Object.fromEntries([...totals].map(([k, v]) => {
    const d = v.drops.slice().sort((a, b) => a - b);
    return [k, {
      beachHours: v.hours, beaches: v.ids.size,
      dropMedian: Number(q(d, 0.5).toFixed(2)), dropP90: Number(q(d, 0.9).toFixed(2)),
      dropMax: Number((d[d.length - 1] ?? 0).toFixed(2)),
      crossUnder050: v.rows.filter(r => r.baseShown >= 0.5 && r.shown < 0.5).length,
      fromOneMetreToFloor: v.rows.filter(r => r.baseShown >= 1 && r.shown <= 0.11).length,
      onExposedSector: v.rows.filter(r => r.level === 'exposed').length,
      sample: v.rows.slice(0, 40),
    }];
  })),
  watch: allWatch,
}, null, 2), 'utf8');
console.log(`\nΓΡΑΦΤΗΚΕ: ${path.relative(root, outFile)}`);
