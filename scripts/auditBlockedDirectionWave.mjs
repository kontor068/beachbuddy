/**
 * ΤΟ ΚΥΜΑ ΠΟΥ ΕΡΧΕΤΑΙ ΑΠΟ ΜΕΡΙΑ ΠΟΥ Η ΠΑΡΑΛΙΑ ΕΧΕΙ ΚΛΕΙΣΤΗ — μέτρηση, όχι πύλη.
 *
 * ΑΦΟΡΜΗ: Βούδια, Μήλος, 16/08/2026 — αναφορά χρήστη που στεκόταν εκεί. Βοριάς 4 Μποφόρ, ο
 * κόλπος λάδι, η σελίδα 0,8 μ. Το σημείο θάλασσας της παραλίας (10 χλμ, γωνία 115°) είναι
 * ΝΟΜΙΜΟ — ανοιχτό νερό, περνάει το `auditMarineCellTrust`. Αυτό που δεν ρωτάει κανείς είναι
 * ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ το κύμα μέσα σε εκείνο το κελί: 16°, δηλαδή από βοριά, και ο βόρειος τομέας
 * του Βουδιά έχει 0,04 χλμ ανοιχτό νερό με blockedRayRatio 1.
 *
 * ΔΙΑΦΟΡΕΤΙΚΟ ΕΡΩΤΗΜΑ ΑΠΟ ΤΑ ΥΠΑΡΧΟΝΤΑ, και γι' αυτό υπάρχει ξεχωριστό αρχείο:
 *   - `auditMarineCellTrust`      → «είναι το κελί πίσω από στεριά;»            (εδώ: όχι)
 *   - `validateBeachMarineResolution` → «ρωτάει η παραλία τη ΔΙΚΗ της ακτή;»    (εδώ: ναι)
 *   - ΑΥΤΟ                        → «έχει το κύμα δρόμο να ΦΤΑΣΕΙ εδώ;»         (εδώ: όχι)
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ ΚΑΙ ΟΧΙ ΔΙΟΡΘΩΣΗ. Ό,τι κατεβάζει ύψος κύματος κινείται προς την
 * ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση — σκανδάλη #1 της §9 της βίβλου: ψεύτικη ηρεμία είναι το μόνο λάθος
 * που δεν αντέχουμε. Ο κανόνας του έργου είναι μέτρηση ΠΡΙΝ και απόφαση Μίλτου, ποτέ σιωπηλή
 * χαλάρωση. Αυτό το script δεν αλλάζει ούτε ένα byte δεδομένων· βγάζει αριθμό.
 *
 * ΤΟ ΜΑΘΗΜΑ ΤΗΣ ΝΑΟΥΣΑΣ ΕΙΝΑΙ ΨΗΜΕΝΟ ΜΕΣΑ. Πρώτη γραφή του γεωμετρικού ταβανιού δεχόταν
 * «κλειστός ο τομέας προέλευσης» και πέρασε έξι παραλίες κόλπου που ανοίγει 2,5 χλμ στο Αιγαίο:
 * οι ακτίνες πάνε ευθεία, η θάλασσα όχι — το κύμα μπαίνει από το στόμιο και απλώνεται. Εδώ
 * απαιτούνται κλειστοί ΚΑΙ οι δύο γείτονες του τομέα προέλευσης, και το ταβάνι χτίζεται πάνω
 * στο ΜΕΓΑΛΥΤΕΡΟ άνοιγμα των τριών — όχι στο δικό του.
 *
 * ΓΕΝΝΑΙΟΔΩΡΟ ΠΡΟΣ ΤΗΝ ΑΣΦΑΛΕΙΑ, ΠΑΝΤΟΥ ΟΠΟΥ ΥΠΑΡΧΕΙ ΕΠΙΛΟΓΗ:
 *   - το ταβάνι χτίζεται με τη ΡΙΠΗ, όχι τη μέση ένταση·
 *   - πάνω στο μεγαλύτερο από τα τρία ανοίγματα·
 *   - συγκρίνεται με το ΕΜΦΑΝΙΖΟΜΕΝΟ ύψος (`resolveDisplayWaveHeightM`), δηλαδή αφού έχει ήδη
 *     περάσει το δάπεδο κυματισμού του ίδιου μας του μοντέλου — ώστε να μη χρεωθεί «λάθος» εκεί
 *     που το δικό μας μοντέλο θα έδινε ούτως ή άλλως παρόμοιο νούμερο·
 *   - μετράει μόνο όπου η διαφορά περνάει κατώφλι που αλλάζει τι διαβάζει ο χρήστης.
 *
 * ΤΙ ΡΩΤΑΕΙ ΤΟ ΔΙΚΤΥΟ: ακριβώς ό,τι ρωτάει η παραγωγή. Από τις 15/08 δεν υπάρχει πια μέσος όρος
 * συμπλέγματος — `utils/marineSamplePoints.resolveBeachMarinePoints` δίνει σε κάθε παραλία το
 * ΔΙΚΟ της σημείο με dedup μόνο σε ταυτόσημες συντεταγμένες. Άρα αυτή η μέτρηση κλείνει και το
 * ανοιχτό κενό §6.2 του `HANDOVER-marine-cell-trust-2026-08-16.md`: μετράει την παραγωγή.
 *
 * Run: node scripts/auditBlockedDirectionWave.mjs
 *      node scripts/auditBlockedDirectionWave.mjs --regions=south-aegean-milos
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
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

// Οι ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις που ships η εφαρμογή. Δεύτερο αντίγραφο εδώ θα έκανε τη μέτρηση
// να ελέγχει τον εαυτό της — το `validateEffectiveRanking.ts:16-18` καταγράφει πύλη που πέρασε
// πράσινη πάνω σε σαμποταρισμένο κώδικα ακριβώς γι' αυτόν τον λόγο.
const { resolveDisplayWaveHeightM, estimateFetchLimitedWaveHeightM, getWindChopWaveFloorM } =
  require(path.join(root, 'utils/waveModel.ts'));

// Η ΙΔΙΑ μάσκα ακτογραμμής που έχτισε τη γεωμετρία των παραλιών, ώστε το άνοιγμα του σημείου
// δειγματοληψίας και το άνοιγμα της παραλίας να είναι συγκρίσιμα νούμερα.
const { loadMask, makeIsLand, destination } = await import('./lib/coastlineMask.mjs');

const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const reportDir = path.join(root, 'reports/quality');

const PROXY = 'https://calmbeach.gr/api/forecast';
const BATCH = 32;
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Πόσο πρέπει να ξεπερνάει το ΜΕΤΡΗΜΕΝΟ ύψος το φυσικό ταβάνι για να μετρηθεί.
 *
 * 0,25 μ. δεν είναι στρογγυλό νούμερο για να δείχνει αυστηρό: είναι το σημείο όπου η ένδειξη
 * αλλάζει λέξη για τον χρήστη. Κάτω από αυτό μιλάμε για διαφορά που κανείς δεν διαβάζει.
 */
const MIN_GAP_M = 0.25;

/**
 * ⚠️ ΤΟ ΚΡΙΤΗΡΙΟ ΞΑΝΑΓΡΑΦΤΗΚΕ ΜΕΣΑ ΣΤΗΝ ΙΔΙΑ ΣΥΝΕΔΡΙΑ. Η πρώτη γραφή έβγαλε 15/39 στη Μήλο
 * και ΗΤΑΝ ΛΑΘΟΣ, με δύο ανεξάρτητους τρόπους — και οι δύο αξίζουν να μείνουν γραμμένοι:
 *
 * 1. ΧΡΕΩΝΕ ΤΟ ΔΙΚΟ ΜΑΣ ΔΑΠΕΔΟ ΑΣΦΑΛΕΙΑΣ. Συνέκρινε το ΕΜΦΑΝΙΖΟΜΕΝΟ ύψος με το ταβάνι. Στο
 *    Παλαιοχώρι (ριπή 41 χλμ/ώρα) το 0,66 μ. δεν ερχόταν από τη θάλασσα — ήταν το
 *    `getWindChopWaveFloorM`, δάπεδο που η βίβλος ΑΠΟΦΑΣΙΣΕ ρητά να μη χαλαρώσει. Μια μέτρηση
 *    που χρεώνει ως λάθος μια σκόπιμη απόφαση ασφαλείας μετράει τον εαυτό της.
 *    → Τώρα κρίνεται το `measured`, και μόνο όταν αυτό είναι που κυβερνάει το νούμερο.
 *
 * 2. ΞΑΝΑΕΚΑΝΕ ΤΟ ΑΝΑΚΛΗΜΕΝΟ ΛΑΘΟΣ. Σύγκρινε το κύμα με το ΤΟΠΙΚΟ άνοιγμα — που δεν λέει
 *    τίποτα για κύμα που έρχεται ΑΠ' ΕΞΩ. Ακριβώς η μέτρηση «55/65 δείχνουν λάθος κύμα» που
 *    ανακλήθηκε τον Αύγουστο. Μετρημένη απόδειξη ότι είναι λάθος: το ewam ΞΕΡΕΙ τη σκιά της
 *    Μήλου — 1,16 μ. βόρεια ανοιχτά, 0,70 στο κελί του Βουδιά, 0,48 νότια (16/08, 18:00).
 *    Ένα μοντέλο που μειώνει 60% γύρω από το νησί δεν «αγνοεί» τη γεωμετρία.
 *
 * ΤΟ ΔΙΑΚΡΙΤΙΚΟ ΠΟΥ ΟΝΤΩΣ ΞΕΧΩΡΙΖΕΙ ΤΟ ΒΟΥΔΙΑ ΑΠΟ ΤΟ ΠΑΛΑΙΟΧΩΡΙ δεν είναι η κατεύθυνση —
 * είναι ΠΟΥ ΣΤΕΚΕΤΑΙ ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΡΩΤΑΜΕ:
 *
 *   Παλαιοχώρι — σημείο 10 χλμ ΝΟΤΙΑ. Βόρεια του έχει ολόκληρη τη Μήλο, άρα κάθεται ΜΕΣΑ στην
 *                ίδια σκιά με την παραλία. Διαβάζει το ίδιο νερό. Σωστό.
 *   Βούδια     — σημείο 10 χλμ ΝΟΤΙΟΑΝΑΤΟΛΙΚΑ, ΕΞΩ από τον κόλπο, σε νερό που βλέπει ελεύθερα
 *                τον βοριά. Διαβάζει άλλο νερό από αυτό που έχει μπροστά της η παραλία.
 *
 * Άρα: το σημείο δειγματοληψίας είναι ΑΝΟΙΧΤΟ προς την κατεύθυνση του κύματος ενώ η παραλία
 * είναι ΚΛΕΙΣΤΗ. Αυτό μετριέται με ακτίνα πάνω στην ίδια μάσκα ακτογραμμής που έχτισε τη
 * γεωμετρία — όχι με υπόθεση.
 */
/**
 * Το σημείο κρίνεται με ΤΗΝ ΙΔΙΑ βεντάλια που έχτισε τη γεωμετρία της παραλίας
 * (`settings.fanAnglesDeg` = ±30°, πέντε ακτίνες), και όχι με μία ακτίνα.
 *
 * Γιατί: με μία ακτίνα το Παλαιοχώρι βγήκε «σημείο ανοιχτό 21,8 χλμ» — η ακτίνα είχε γλιστρήσει
 * δίπλα από το ανατολικό άκρο της Μήλου. Μία ευθεία γραμμή που βρίσκει χαραμάδα δεν είναι
 * ανοιχτή θάλασσα. Η βεντάλια το πιάνει· η μονή ακτίνα, ποτέ.
 *
 * Συμμετρικό μέτρο και στις δύο πλευρές: η παραλία περνάει με blockedRayRatio 1 (όλες οι
 * ακτίνες της κλειστές), το σημείο με ≤ 0,2 (σχεδόν όλες ανοιχτές). Ανάμεσά τους δεν χρεώνουμε.
 */
const FAN_ANGLES_DEG = [-30, -15, 0, 15, 30];
const SAMPLE_MAX_BLOCKED_RATIO = 0.2;
const RAY_STEP_KM = 0.25;
const RAY_MAX_KM = 25;

const toRad = d => (d * Math.PI) / 180;
const sectorIndexFor = deg => ((Math.round(deg / 45) % 8) + 8) % 8;
const beaufortFromKmh = kmh => {
  const t = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  for (let i = 0; i < t.length; i++) if (kmh < t[i]) return i;
  return 12;
};

const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 429) await new Promise(r => setTimeout(r, 5000 * (i + 1)));
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
};

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/** Μία batched κλήση ανά 32 σημεία· η απάντηση είναι πίνακας όταν τα σημεία είναι πολλά. */
const fetchSeries = async (points, provider, upstreamPath, hourly) => {
  const out = new Map();
  for (const group of chunk(points, BATCH)) {
    const lat = group.map(p => p.lat.toFixed(4)).join(',');
    const lon = group.map(p => p.lon.toFixed(4)).join(',');
    const url = `${PROXY}/${provider}${upstreamPath}?latitude=${lat}&longitude=${lon}`
      + `&hourly=${hourly}&timezone=Europe%2FAthens&forecast_days=1`;
    const json = await fetchJson(url);
    if (!json) continue;
    const list = Array.isArray(json) ? json : [json];
    list.forEach((cell, i) => { if (group[i]) out.set(group[i].key, cell); });
    // Ο proxy κόβει στα 60 αιτήματα/λεπτό ανά IP (netlify/functions/forecast.mjs:414). Μια
    // μερική σάρωση δεν είναι μικρή εκδοχή της απάντησης, είναι μεροληπτική — οι περιοχές που
    // πέφτουν είναι όποιες έτυχε να τρέχουν όταν άδειασε ο κουβάς. Άρα πιο αργά απ' ό,τι θα
    // μπορούσε.
    await new Promise(r => setTimeout(r, 1100));
  }
  return out;
};

/** Το ewam/meteofrance γυρνάει σουφιξαρισμένα ονόματα· κράτα την πρώτη σειρά που έχει τιμή. */
const pickSeries = (cell, base) => {
  if (!cell?.hourly) return undefined;
  for (const suffix of ['_ewam', '_meteofrance_wave', '']) {
    const s = cell.hourly[base + suffix];
    if (Array.isArray(s) && s.some(v => typeof v === 'number')) return s;
  }
  return undefined;
};

/** Ανοιχτό νερό από ένα σημείο προς μια γωνία, με την ίδια μάσκα που έχτισε τη γεωμετρία. */
let isLand = null;
const rayKm = (lat, lon, bearingDeg) => {
  for (let km = RAY_STEP_KM; km <= RAY_MAX_KM; km += RAY_STEP_KM) {
    const q = destination(lat, lon, bearingDeg, km);
    if (isLand(q.lon, q.lat)) return km - RAY_STEP_KM;
  }
  return RAY_MAX_KM;
};

/** Πόσο εκτεθειμένο είναι το σημείο προς μια μεριά: μερίδιο φραγμένων ακτίνων + μέσο άνοιγμα. */
const fanFrom = (lat, lon, bearingDeg) => {
  const kms = FAN_ANGLES_DEG.map(off => rayKm(lat, lon, bearingDeg + off));
  return {
    blockedRatio: kms.filter(k => k < RAY_MAX_KM).length / kms.length,
    meanKm: kms.reduce((a, b) => a + b, 0) / kms.length,
  };
};

const main = async () => {
  process.stdout.write('φόρτωση ακτογραμμής… ');
  isLand = makeIsLand(loadMask());
  console.log('έτοιμη');

  const files = readdirSync(exposureDir).filter(f => f.endsWith('.json'))
    .filter(f => !regionFilter || regionFilter.includes(f.replace('.json', '')));

  const hourIndex = new Date().getHours();
  const rows = [];
  let scanned = 0, noProfile = 0, noSea = 0;

  for (const file of files) {
    const region = file.replace('.json', '');
    const data = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
    const profiles = Object.values(data.profiles || {}).filter(p => p?.sectors && p?.coordinates);
    if (!profiles.length) continue;

    // Ίδιο dedup με την παραγωγή: ταυτόσημες συντεταγμένες στα 3 δεκαδικά = μία ερώτηση.
    const seaPoints = new Map();
    const windPoints = new Map();
    for (const p of profiles) {
      const s = p.marineSamplePoint;
      if (s && Number.isFinite(s.lat) && Number.isFinite(s.lon)) {
        const key = `${s.lat.toFixed(3)},${s.lon.toFixed(3)}`;
        if (!seaPoints.has(key)) seaPoints.set(key, { key, lat: s.lat, lon: s.lon });
      }
      const c = p.coordinates;
      const wkey = `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
      if (!windPoints.has(wkey)) windPoints.set(wkey, { key: wkey, lat: c.lat, lon: c.lon });
    }

    // Σειριακά, όχι Promise.all: δύο παράλληλες ροές διπλασιάζουν τον ρυθμό και ο κουβάς είναι
    // κοινός.
    const sea = await fetchSeries([...seaPoints.values()], 'open-meteo-marine', '/v1/marine', 'wave_height,wave_direction');
    const wind = await fetchSeries([...windPoints.values()], 'open-meteo', '/v1/forecast', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');

    for (const p of profiles) {
      scanned++;
      const s = p.marineSamplePoint;
      if (!s) { noProfile++; continue; }
      const seaCell = sea.get(`${s.lat.toFixed(3)},${s.lon.toFixed(3)}`);
      const windCell = wind.get(`${p.coordinates.lat.toFixed(2)},${p.coordinates.lon.toFixed(2)}`);
      if (!seaCell || !windCell) { noSea++; continue; }

      const measured = pickSeries(seaCell, 'wave_height')?.[hourIndex];
      const waveDir = pickSeries(seaCell, 'wave_direction')?.[hourIndex];
      const windKmh = windCell.hourly?.wind_speed_10m?.[hourIndex];
      const windDir = windCell.hourly?.wind_direction_10m?.[hourIndex];
      const gustKmh = windCell.hourly?.wind_gusts_10m?.[hourIndex];
      if (![measured, waveDir, windKmh, windDir].every(v => typeof v === 'number')) { noSea++; continue; }

      // Ο τομέας ΑΠΟ ΤΟΝ ΟΠΟΙΟ έρχεται το κύμα, μαζί με τους δύο γείτονές του — το μάθημα
      // της Νάουσας: το κύμα μπαίνει από το στόμιο και απλώνεται.
      const i = sectorIndexFor(waveDir);
      const trio = [SECTORS[(i + 7) % 8], SECTORS[i], SECTORS[(i + 1) % 8]].map(n => p.sectors[n]);
      if (trio.some(x => !x)) continue;

      const allClosed = trio.every(x => x.level === 'protected' && x.blockedRayRatio === 1 && x.fetchKm < 1);
      const onshore = Math.cos(toRad(waveDir - p.facingDeg));
      if (!allClosed || onshore >= 0) continue;

      const windSector = p.sectors[SECTORS[sectorIndexFor(windDir)]];
      const exposureLevel = windSector?.level === 'protected' ? 'protected'
        : windSector?.level === 'partial' ? 'partial' : 'exposed';
      const beaufort = beaufortFromKmh(windKmh);
      const modeled = estimateFetchLimitedWaveHeightM({ windSpeedKmh: windKmh, fetchKm: windSector?.fetchKm ?? 0 });
      const display = resolveDisplayWaveHeightM({
        exposureLevel, modeledWaveHeightM: modeled, beaufort,
        windSpeedKmh: windKmh, gustKmph: gustKmh, measuredWaveHeightM: measured,
      }).effectiveWaveHeightM;

      // ΤΟ ΔΑΠΕΔΟ ΑΣΦΑΛΕΙΑΣ ΔΕΝ ΕΙΝΑΙ ΛΑΘΟΣ. Αν το νούμερο στην οθόνη το κρατάει ούτως ή άλλως
      // το δικό μας δάπεδο κυματισμού, η μέτρηση της θάλασσας δεν είναι αυτή που ανεβάζει την
      // ένδειξη — και δεν έχουμε τίποτα να χρεώσουμε εδώ.
      const ownFloor = Math.max(
        modeled * (exposureLevel === 'protected' ? 0.5 : exposureLevel === 'partial' ? 0.75 : 1),
        getWindChopWaveFloorM(exposureLevel, beaufort, windKmh, gustKmh)
      );
      if (measured <= ownFloor) continue;

      // Το φυσικό ταβάνι: η ΡΙΠΗ πάνω στο ΜΕΓΑΛΥΤΕΡΟ από τα τρία ανοίγματα.
      const widestFetchKm = Math.max(...trio.map(x => x.fetchKm ?? 0));
      const ceiling = estimateFetchLimitedWaveHeightM({
        windSpeedKmh: Math.max(windKmh, gustKmh ?? 0), fetchKm: widestFetchKm,
      });
      if (measured - ceiling < MIN_GAP_M) continue;

      // ΤΟ ΔΙΑΚΡΙΤΙΚΟ: βλέπει το σημείο που ρωτάμε ελεύθερα προς τη μεριά του κύματος, ενώ η
      // παραλία είναι κλειστή; Αν όχι, το σημείο κάθεται στην ίδια σκιά και το διάβασμα στέκει.
      const fan = fanFrom(s.lat, s.lon, waveDir);
      if (fan.blockedRatio > SAMPLE_MAX_BLOCKED_RATIO) continue;

      rows.push({
        region, id: p.beachId, name: p.name?.gr || p.name?.en,
        measured: +measured.toFixed(2), display: +display.toFixed(2),
        ceiling: +ceiling.toFixed(2), gap: +(measured - ceiling).toFixed(2),
        waveDirDeg: waveDir, facingDeg: p.facingDeg, onshore: +onshore.toFixed(2),
        beachOpenKm: +widestFetchKm.toFixed(2),
        sampleBlockedRatio: fan.blockedRatio, sampleOpenKm: +fan.meanKm.toFixed(1),
        windKmh: +windKmh.toFixed(1), gustKmh: gustKmh ? +gustKmh.toFixed(1) : null,
        beaufort, sampleKm: s.distanceKm,
      });
    }
    process.stdout.write(`${region}: ${rows.length} συνολικά\r`);
  }

  rows.sort((a, b) => b.gap - a.gap);
  const covered = scanned - noProfile - noSea;
  const report = {
    generatedAt: new Date().toISOString(),
    hourIndexLocal: hourIndex,
    question: 'Δείχνουμε κύμα που δεν έχει δρόμο να φτάσει σε αυτή την παραλία;',
    scanned, covered, noProfile, noSea,
    minGapM: MIN_GAP_M,
    affected: rows.length,
    affectedShare: covered ? +(rows.length / covered * 100).toFixed(1) : 0,
    rows,
  };
  mkdirSync(reportDir, { recursive: true });
  const out = path.join(reportDir, 'blocked-direction-wave.json');
  writeFileSync(out, JSON.stringify(report, null, 2));

  console.log(`\n\nΣΑΡΩΘΗΚΑΝ ${scanned} | με ζωντανά δεδομένα ${covered} | χωρίς σημείο ${noProfile} | χωρίς απάντηση ${noSea}`);
  console.log(`ΔΕΙΧΝΟΥΝ ΚΥΜΑ ΧΩΡΙΣ ΔΡΟΜΟ: ${rows.length} (${report.affectedShare}% όσων μετρήθηκαν)`);
  console.log(`κατώφλι διαφοράς: ${MIN_GAP_M} μ.\n`);
  for (const r of rows.slice(0, 25)) {
    console.log(`  ${r.measured}μ vs ταβάνι ${r.ceiling}μ (+${r.gap}) — ${r.name} [${r.id}] ${r.region}`
      + ` | κύμα από ${r.waveDirDeg}° | παραλία ανοιχτή ${r.beachOpenKm}χλμ, σημείο ${r.sampleOpenKm}χλμ`);
  }
  console.log(`\nΑναφορά: ${out}`);
};

main().catch(e => { console.error(e); process.exit(1); });
