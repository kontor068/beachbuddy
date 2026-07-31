/**
 * ΤΟ ΕΡΩΤΗΜΑ: η δική μας γεωμετρία βοηθάει, βλάπτει, ή δεν κάνει τίποτα;
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η εφαρμογή ΔΕΝ δείχνει ποτέ σκέτη την τιμή του πλέγματος. Δείχνει
 *
 *     max( τιμή πλέγματος , SMB fetch × απόσβεση έκθεσης , πάτωμα ριπής )
 *
 * (`resolveDisplayWaveHeightM`, utils/waveModel.ts). Στις 31/07/2026 μετρήθηκε το
 * σκέτο πλέγμα έναντι του Copernicus και βγήκε 74-78% στην κατάταξη προσήνεμης /
 * υπήνεμης ακτής. ΑΛΛΑ Η ΕΦΑΡΜΟΓΗ ΔΕΝ ΤΡΕΧΕΙ ΣΚΕΤΟ ΠΛΕΓΜΑ. Αυτό που βλέπει ο
 * χρήστης δεν έχει κριθεί ποτέ έναντι ανεξάρτητης πηγής.
 *
 * ΤΙ ΚΑΛΕΙ: τις πραγματικές συναρτήσεις της παραγωγής — `assessBeachWindExposure`
 * και `resolveDisplayWaveHeightM` — όχι αντίγραφό τους. Η πύλη 18 αυτού του
 * project είχε περάσει κάποτε πράσινη πάνω σε σκόπιμα σαμποταρισμένο κώδικα
 * ακριβώς επειδή ξανάγραφε αυτό που έλεγχε.
 *
 * ΤΙ ΕΙΝΑΙ Ο ΚΡΙΤΗΣ: το Copernicus `cmems_mod_med_wav_anfc_4.2km_PT1H-i`, ήδη
 * κατεβασμένο και αποθηκευμένο από τον έλεγχο κύματος. ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ ΚΩΔΙΚΟΣ.
 *
 * ΤΟ ΔΕΙΓΜΑ ΔΕΝ ΞΑΝΑΔΙΑΛΕΓΕΤΑΙ. Τα ζεύγη νησιών και οι ώρες μελτεμιού έρχονται
 * αυτούσια από τα `reports/wave-model/lee-shore-hours-*.json`. Δύο εκτελέσεις
 * έχουν ήδη χαθεί επειδή η επιλογή δείγματος άλλαξε ανάμεσα σε δύο μετρήσεις·
 * εδώ το δείγμα είναι δεδομένο εισόδου, όχι απόφαση αυτού του script.
 *
 * Τρέξιμο:
 *   npm run validate:effective-ranking -- --dry-run     (δείγμα μόνο, χωρίς δίκτυο)
 *   npm run validate:effective-ranking                  (κατεβάζει άνεμο+κύμα στις παραλίες)
 *   npm run validate:effective-ranking -- --replay      (ξανακρίνει τις ΙΔΙΕΣ ώρες)
 */

import fs from 'node:fs';
import path from 'node:path';

import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { resolveDisplayWaveHeightM } from '../utils/waveModel';
import { resolveSeaArrival } from '../utils/seaArrival';
import { getBeaufortLevel, degToCompass } from '../utils/weatherUtils';
import type { Beach, GeospatialExposureProfile } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// ΟΙ ΠΥΛΕΣ — ΓΡΑΜΜΕΝΕΣ ΚΑΙ ΔΕΣΜΕΥΜΕΝΕΣ ΣΕ COMMIT ΠΡΙΝ ΚΑΤΕΒΕΙ BYTE
//
// Δεν χαλαρώνουν αφού δει κανείς το αποτέλεσμα. Έχει ξανασυμβεί μία φορά σε αυτό
// το project και είναι καταγεγραμμένο ρητά ως ολίσθημα· δεν επαναλαμβάνεται εδώ.
// ─────────────────────────────────────────────────────────────────────────────

const GATES = {
  // Α. Χωρίς πραγματική διαφορά ανάμεσα στις δύο ακτές δεν υπάρχει κατάταξη να
  //    κριθεί. Το κατώφλι είναι το ίδιο 0,30 μ. του κυματικού ελέγχου, και για το
  //    ίδιο δείγμα μετρήθηκε 0,42. Μπαίνει ΟΧΙ επειδή αμφιβάλλουμε, αλλά για να
  //    πέσει το τεστ αν κάποτε αλλάξει το δείγμα κάτω από τα πόδια μας.
  min_judge_contrast_m: 0.30,

  // Β. Η ΜΟΝΗ ΠΥΛΗ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΣΤΕΙΛΕΙ ΚΩΔΙΚΑ ΠΙΣΩ — «ΔΕΝ ΒΛΑΠΤΕΙ».
  //    Στις ώρες όπου το σκέτο πλέγμα κατατάσσει ΣΩΣΤΑ το ζεύγος, η δική μας
  //    max() δεν επιτρέπεται να γυρίσει τη σωστή απάντηση σε λάθος πάνω από 2%.
  //    Γιατί 2% και όχι 0: η max() ανεβάζει τιμές, και όταν οι δύο ακτές είναι
  //    οριακά ίδιες ένα πάτωμα ριπής μπορεί να τις ισοφαρίσει και να γυρίσει το
  //    πρόσημο χωρίς να λέει ψέμα για καμία από τις δύο. Πάνω από 2% όμως δεν
  //    είναι θόρυβος: σημαίνει ότι η γεωμετρία μας σβήνει συστηματικά διαφορά
  //    που το μοντέλο είχε βρει σωστά, και αυτό είναι κακό στην ουσία του.
  max_harm_ratio: 0.02,

  // Γ. «ΒΟΗΘΑΕΙ». Στις ώρες όπου το πλέγμα κατατάσσει ΛΑΘΟΣ, η γεωμετρία
  //    διορθώνει ≥10%. Το 10% είναι χαμηλό επίτηδες: το ερώτημα εδώ είναι «κάνει
  //    ΚΑΤΙ;», όχι «πόσο καλή είναι;». ΔΙΑΒΑΣΕ ΚΑΙ ΤΟ ΟΡΙΟ ΠΑΡΑΚΑΤΩ ΠΡΙΝ
  //    ΕΡΜΗΝΕΥΣΕΙΣ ΑΠΟΤΥΧΙΑ ΤΗΣ Γ.
  min_help_ratio: 0.10,

  // Δ. ΑΣΦΑΛΕΙΑ — αυτή είναι στην πραγματικότητα η δουλειά της γεωμετρίας.
  //    Στις ώρες που ο κριτής βλέπει ≥0,5 μ. σε μια παραλία ενώ το πλέγμα
  //    διαβάζει <0,3 μ. εκεί (ψεύτικη γαλήνη — ο ένας τύπος λάθους που στέλνει
  //    κόσμο σε νερό που δεν περίμενε), η δική μας τιμή σηκώνει ≥50% από αυτές
  //    πάνω από 0,3 μ. Η κατάταξη είναι άνεση· αυτό εδώ είναι ασφάλεια.
  min_false_calm_rescue_ratio: 0.50,

  // Ε. Κάλυψη. Κάτω από αυτά τα νούμερα η απάντηση είναι «δεν φτάνουν τα
  //    δεδομένα», ΟΧΙ «πέρασε». Μια πύλη που περνά με n=12 δεν είναι πύλη.
  min_hours_per_bucket: 300,
} as const;

// Ώρες όπου ο κριτής βλέπει σχεδόν ίδια θάλασσα και στις δύο ακτές δεν έχουν
// σωστή απάντηση να δώσουν — δεν μετράνε ούτε υπέρ ούτε κατά. Ξεχωριστό από την
// πύλη Α: εκείνη κρίνει το δείγμα συνολικά, αυτό φιλτράρει ώρα-ώρα.
const MIN_HOUR_CONTRAST_M = 0.15;

// Ψεύτικη γαλήνη: ο κριτής βλέπει τόσο, το πλέγμα διαβάζει τόσο.
const FALSE_CALM_JUDGE_M = 0.50;
const FALSE_CALM_GRID_M = 0.30;

// ─────────────────────────────────────────────────────────────────────────────
// ΤΟ ΟΡΙΟ ΑΥΤΟΥ ΤΟΥ ΤΕΣΤ — ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ, ΟΧΙ ΩΣ ΔΙΚΑΙΟΛΟΓΙΑ ΜΕΤΑ
//
// Ο κριτής είναι πλέγμα 4,2 χλμ. Οι όρμοι για τους οποίους υπάρχει η γεωμετρία
// μας είναι 200 μ. Ο κριτής ΔΕΝ ΜΠΟΡΕΙ να δει αυτό που η γεωμετρία ισχυρίζεται
// ότι βλέπει· τα δύο μιλάνε για διαφορετική κλίμακα.
//
// Άρα το τεστ είναι ΑΣΥΜΜΕΤΡΟ και πρέπει να διαβαστεί ασύμμετρα:
//
//   • Η πύλη Β («δεν βλάπτει») είναι ΙΣΧΥΡΗ. Αν η γεωμετρία μας γυρίζει σωστές
//     απαντήσεις σε λάθος σε κλίμακα που ο κριτής ΒΛΕΠΕΙ, αυτό είναι πραγματική
//     ζημιά και μετράει. Μόνο αυτή μπορεί να στείλει κώδικα πίσω.
//
//   • Η πύλη Γ («βοηθάει») είναι ΑΔΥΝΑΜΗ. Αποτυχία της Γ σημαίνει «ο κριτής δεν
//     το βλέπει», ΟΧΙ «βγάλ' το». Ένας όρμος 200 μ. που πράγματι σπάει το κύμα
//     είναι αόρατος σε κελί 4,2 χλμ., και το τεστ θα τον έγραφε ως «δεν βοηθάει».
//
// Με μια πρόταση: αυτό το τεστ μπορεί να αποδείξει «δεν βλάπτει». Δύσκολα θα
// αποδείξει «πόσο βοηθάει», και ΔΕΝ πρέπει να χρησιμοποιηθεί ως επιχείρημα για
// να αφαιρεθεί η γεωμετρία.
// ─────────────────────────────────────────────────────────────────────────────

// Not __dirname: the wrapper compiles this into .tmp/, so __dirname points at the
// build output. The wrapper always runs it with cwd = repo root.
const ROOT = process.cwd();
const WAVE_DIR = path.join(ROOT, 'reports', 'wave-model');
const OUT_DIR = path.join(ROOT, 'reports', 'wind-model');
const APP_DIR = path.join(ROOT, 'public', 'data', 'beaches', 'app');
const EXPOSURE_DIR = path.join(ROOT, 'public', 'data', 'geospatial', 'exposure');

// Το παράθυρο μπαίνει στο ΟΝΟΜΑ του αρχείου. Χωρίς αυτό, η εκτέλεση της μιας
// χρονιάς σβήνει τις ώρες της άλλης — έχει ξανασυμβεί (8d877ff9).
const hoursCachePath = (start: string) =>
  path.join(OUT_DIR, `effective-ranking-hours-${start}.json`);

// Θέσεις στη γραμμή. Οι γραμμές αποθηκεύονται και ξαναδιαβάζονται από το
// --replay, οπότε η σειρά είναι ΣΥΜΒΟΛΑΙΟ: μη μπει στήλη στη μέση, μόνο στο τέλος.
const COLUMNS = [
  'island_index', 'hour',
  'w_wind_kmh', 'w_wind_deg', 'w_gust_kmh', 'w_wave_m', 'w_wave_deg', 'w_wave_s', 'w_swell_m', 'w_swell_s',
  'l_wind_kmh', 'l_wind_deg', 'l_gust_kmh', 'l_wave_m', 'l_wave_deg', 'l_wave_s', 'l_swell_m', 'l_swell_s',
] as const;
const COL = Object.fromEntries(COLUMNS.map((c, i) => [c, i])) as Record<typeof COLUMNS[number], number>;

type Row = (number | string | null)[];

type IslandPair = {
  island: string;
  windwardBeach: string;
  leewardBeach: string;
  copWindwardByHour: Map<string, number>;
  copLeewardByHour: Map<string, number>;
};

const log = (msg: string) => process.stdout.write(`${msg}\n`);

// ─── 1. Το δείγμα, αυτούσιο από τον κυματικό έλεγχο ──────────────────────────

const loadLeeShoreWindow = (file: string) => {
  const data = JSON.parse(fs.readFileSync(path.join(WAVE_DIR, file), 'utf8'));
  const start: string = data.window.start;
  const cols: string[] = data.columns;
  const iIsland = cols.indexOf('island_index');
  const iHour = cols.indexOf('hour');
  const iCopW = cols.indexOf('cop_windward');
  const iCopL = cols.indexOf('cop_leeward');
  if ([iIsland, iHour, iCopW, iCopL].some((i) => i < 0)) {
    throw new Error(`${file}: unexpected column layout — the row contract changed`);
  }

  const pairs: IslandPair[] = data.islands.map((isl: any) => ({
    island: isl.island,
    windwardBeach: isl.windward_beach,
    leewardBeach: isl.leeward_beach,
    copWindwardByHour: new Map<string, number>(),
    copLeewardByHour: new Map<string, number>(),
  }));

  for (const row of data.rows as Row[]) {
    const pair = pairs[row[iIsland] as number];
    if (!pair) continue;
    const hour = row[iHour] as string;
    if (typeof row[iCopW] === 'number') pair.copWindwardByHour.set(hour, row[iCopW] as number);
    if (typeof row[iCopL] === 'number') pair.copLeewardByHour.set(hour, row[iCopL] as number);
  }

  const hours: { islandIndex: number; hour: string }[] = [];
  for (const row of data.rows as Row[]) {
    hours.push({ islandIndex: row[iIsland] as number, hour: row[iHour] as string });
  }

  return { start, end: data.window.end as string, pairs, hours, file };
};

// ─── 2. Οι παραλίες, με συντεταγμένες και γεωμετρία ─────────────────────────

type BeachRecord = { beach: Beach; regionId: string };

const loadBeaches = (): Map<string, BeachRecord[]> => {
  const byName = new Map<string, BeachRecord[]>();
  for (const file of fs.readdirSync(APP_DIR).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(APP_DIR, file), 'utf8'));
    const island = data.island;
    if (!island || !Array.isArray(island.beaches)) continue;
    const regionId = file.replace(/\.json$/, '');
    for (const b of island.beaches) {
      const rec: BeachRecord = { beach: b as Beach, regionId };
      for (const key of [b.name?.gr, b.name?.en].filter(Boolean) as string[]) {
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key)!.push(rec);
      }
    }
  }
  return byName;
};

const loadExposureProfiles = (regionIds: Set<string>): Map<number, GeospatialExposureProfile> => {
  const byBeachId = new Map<number, GeospatialExposureProfile>();
  for (const regionId of regionIds) {
    const p = path.join(EXPOSURE_DIR, `${regionId}.json`);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    // `profiles` is a Record keyed by beach id, not an array.
    const raw = Array.isArray(data) ? data : (data.profiles ?? data.beaches ?? {});
    const list: any[] = Array.isArray(raw) ? raw : Object.values(raw);
    for (const profile of list) {
      const id = profile.beachId ?? profile.id;
      if (typeof id === 'number') byBeachId.set(id, profile as GeospatialExposureProfile);
    }
  }
  return byBeachId;
};

// ─── 3. Ο άνεμος και το κύμα ΣΤΙΣ ΠΑΡΑΛΙΕΣ ──────────────────────────────────
//
// ΓΙΑΤΙ ΞΑΝΑΚΑΤΕΒΑΙΝΕΙ ΚΑΙ ΔΕΝ ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ Ο,ΤΙ ΥΠΑΡΧΕΙ: οι αποθηκευμένες
// στήλες `ewam_*` του κυματικού ελέγχου τραβήχτηκαν στο ΚΕΛΙ των 4,2 χλμ. (έως ~9
// χλμ. από την ακτή), γιατί εκεί ήταν ο κριτής. Η εφαρμογή ρωτάει ΣΤΗΝ ΠΑΡΑΛΙΑ.
// Σύγκριση με τις τιμές του κελιού θα έκρινε κάτι που κανείς χρήστης δεν βλέπει.
// Ο άνεμος επίσης δεν σώθηκε καθόλου — χρησιμοποιήθηκε μόνο για να διαλέξει ώρες.

const UA = { 'User-Agent': 'calmbeach-effective-ranking/1.0 (+https://calmbeach.gr)' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchJson = async (url: string, tries = 4): Promise<any> => {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < tries) await sleep(1500 * attempt);
    }
  }
  throw lastErr;
};

type HourSeries = Map<string, (number | null)[]>;

const fetchPointHours = async (
  lat: number,
  lon: number,
  start: string,
  end: string,
): Promise<HourSeries> => {
  const windUrl = 'https://archive-api.open-meteo.com/v1/archive'
    + `?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}`
    + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    + '&wind_speed_unit=kmh&timezone=UTC';
  // Ίδιο μοντέλο και ίδιο cell_selection με την παραγωγή
  // (services/forecast/openMeteoProvider.ts), αλλιώς κρίνουμε άλλο νερό.
  const marineUrl = 'https://marine-api.open-meteo.com/v1/marine'
    + `?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}`
    + '&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period'
    + '&models=ewam&cell_selection=sea&timezone=UTC';

  const [wind, marine] = await Promise.all([fetchJson(windUrl), fetchJson(marineUrl)]);

  const series: HourSeries = new Map();
  const times: string[] = wind.hourly.time;
  const marineTimes: string[] = marine.hourly?.time ?? [];
  const marineIndex = new Map(marineTimes.map((t: string, i: number) => [t, i]));

  const pick = (obj: any, key: string, i: number): number | null => {
    const arr = obj?.hourly?.[key] ?? obj?.hourly?.[`${key}_ewam`];
    const v = arr?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  times.forEach((t, i) => {
    const mi = marineIndex.get(t);
    series.set(t, [
      pick(wind, 'wind_speed_10m', i),
      pick(wind, 'wind_direction_10m', i),
      pick(wind, 'wind_gusts_10m', i),
      mi === undefined ? null : pick(marine, 'wave_height', mi),
      mi === undefined ? null : pick(marine, 'wave_direction', mi),
      mi === undefined ? null : pick(marine, 'wave_period', mi),
      mi === undefined ? null : pick(marine, 'swell_wave_height', mi),
      mi === undefined ? null : pick(marine, 'swell_wave_period', mi),
    ]);
  });
  return series;
};

// ─── 4. Η κρίση. ΜΙΑ διαδρομή, ίδια για live και για --replay ────────────────

type Resolved = {
  pairs: IslandPair[];
  beaches: { windward: BeachRecord; leeward: BeachRecord }[];
  profiles: Map<number, GeospatialExposureProfile>;
};

const evaluateBeach = (
  rec: BeachRecord,
  profile: GeospatialExposureProfile | undefined,
  windKmh: number,
  windDeg: number,
  gustKmh: number | null,
  waveM: number | null,
  waveDeg: number | null,
  wavePeriodS: number | null,
  swellM: number | null,
  swellPeriodS: number | null,
) => {
  const beaufort = getBeaufortLevel(windKmh);
  const assessment = assessBeachWindExposure({
    beach: rec.beach,
    geospatialProfile: profile,
    windDirectionDeg: windDeg,
    windDirection: degToCompass(windDeg),
    windSpeedKmh: windKmh,
    beaufort,
    waveHeightMeters: waveM ?? undefined,
    waveDirectionDegrees: waveDeg ?? undefined,
    wavePeriodSeconds: wavePeriodS ?? undefined,
    swellHeightMeters: swellM ?? undefined,
  });
  const { effectiveWaveHeightM, modeledWaveHeightM } = resolveDisplayWaveHeightM({
    exposureLevel: assessment.exposureLevel,
    modeledWaveHeightM: assessment.modeledWaveHeightM,
    beaufort,
    windSpeedKmh: windKmh,
    gustKmph: gustKmh ?? undefined,
    measuredWaveHeightM: waveM ?? undefined,
    swell: { heightM: swellM ?? undefined, periodS: swellPeriodS ?? undefined },
    // ΔΙΟΡΘΩΘΗΚΕ. Η πρώτη εκτέλεση περνούσε εδώ `undefined` με το σκεπτικό ότι το
    // sea arrival «επιδρά ίδια στις δύο ακτές, άρα δεν αλλάζει το πρόσημο». Αυτό
    // ήταν ΛΑΘΟΣ: το sea arrival βγαίνει από το facing και τη γεωμετρία της ΚΑΘΕ
    // παραλίας, που είναι διαφορετικά ανά ακτή — είναι ακριβώς η ποσότητα που
    // ξεχωρίζει τις δύο πλευρές. Χωρίς αυτό ο κριτής έτρεχε light-wind cap πιο
    // επιθετικό από την παραγωγή και χρέωνε στη γεωμετρία ζημιά που δεν κάνει.
    //
    // ΤΙ ΔΕΝ ΑΛΛΑΞΕ: κανένα κατώφλι. Οι πύλες μένουν αριθμό προς αριθμό όπως
    // δεσμεύτηκαν στο 2aaa5797. Άλλαξε ΤΟ ΥΠΟΚΕΙΜΕΝΟ της μέτρησης — μετράμε
    // επιτέλους την παραγωγή — όχι η αυστηρότητα.
    seaArrival: resolveSeaArrival(profile, assessment.facingDeg, waveDeg ?? undefined),
  });

  // Η ΠΑΡΑΛΛΑΓΗ ΤΟΥ App.tsx:729 — για να μετρηθεί η ασυμφωνία, όχι να εικαστεί.
  // Εκεί το μετρημένο ύψος πάει κατευθείαν στο max() χωρίς να περάσει από το
  // light-wind cap. Το cap μόνο ΚΑΤΕΒΑΖΕΙ, άρα η παραλλαγή χωρίς αυτό είναι
  // ακριβώς max(ωμό μετρημένο, μοντέλο). Όπου οι δύο τιμές διαφέρουν, η
  // βαθμολογία ώρας του top-3 και η σελίδα παραλίας περιγράφουν ΤΗΝ ΙΔΙΑ ΩΡΑ
  // με διαφορετικό νούμερο.
  const uncapped = typeof waveM === 'number' && Number.isFinite(waveM)
    ? Number(Math.max(waveM, modeledWaveHeightM).toFixed(2))
    : modeledWaveHeightM;

  return {
    effective: effectiveWaveHeightM,
    uncapped,
    grid: waveM,
    exposure: assessment.exposureLevel,
    beaufort,
  };
};

// --explain <νησί>: μαζεύει τις ώρες όπου η γεωμετρία μας χάλασε σωστή κατάταξη
// σε ΕΝΑ ζεύγος, με τα νούμερα δίπλα-δίπλα. Χωρίς αυτό, το «η Σκόπελος χαλάει 30%»
// είναι ποσοστό χωρίς αιτία, και δεν διορθώνεται ποσοστό.
const explainIsland = (() => {
  const i = process.argv.indexOf('--explain');
  return i >= 0 ? process.argv[i + 1] : undefined;
})();

type Explanation = {
  hour: string;
  judge: { windward: number; leeward: number };
  grid: { windward: number | null; leeward: number | null };
  ours: { windward: number; leeward: number };
  exposure: { windward: string; leeward: string };
  windKmh: { windward: number; leeward: number };
  beaufort: { windward: number; leeward: number };
};

const summarise = (resolved: Resolved, rows: Row[]) => {
  const explanations: Explanation[] = [];
  let hoursConsidered = 0;
  let hoursWithJudgeContrast = 0;
  let judgeContrastSum = 0;

  let gridCorrect = 0;
  let gridWrong = 0;
  let harm = 0;      // πλέγμα σωστό → δικό μας λάθος
  let help = 0;      // πλέγμα λάθος → δικό μας σωστό

  // ΔΙΑΓΝΩΣΤΙΚΟ, ΟΧΙ ΠΥΛΗ. Δεν αλλάζει ούτε τον ορισμό της ζημιάς ούτε το
  // κατώφλι — και τα δύο μένουν όπως δεσμεύτηκαν στο 2aaa5797, μετά το
  // αποτέλεσμα όπως και πριν. Απαντά μόνο στο ΤΙ ΕΙΔΟΥΣ αστοχία είναι:
  //   ισοπαλία → η δική μας τιμή βγήκε ΙΔΙΑ στις δύο ακτές, δηλαδή χάθηκε η
  //              πληροφορία (το πάτωμα ριπής ισοπέδωσε τη διαφορά)
  //   αντιστροφή → είπαμε ότι η ΑΛΛΗ ακτή είναι η ήρεμη· αυτό είναι λάθος
  //              απάντηση, όχι απουσία απάντησης
  // Οι δύο έχουν πολύ διαφορετικό κόστος για τον χρήστη και η πύλη τις μετράει
  // μαζί. Το ξεχώρισμα λέγεται εδώ, δεν κρύβεται στην ετυμηγορία.
  let harmTies = 0;
  let harmInversions = 0;

  // Πόσο μεγάλη είναι στην πράξη η ασυμφωνία του App.tsx:729 (χωρίς light-wind cap)
  // με τη σελίδα παραλίας. Διαγνωστικό — καμία πύλη δεν κρέμεται από αυτό.
  let beachesEvaluated = 0;
  let capChangesTheNumber = 0;
  let capChangesTheRanking = 0;
  let maxCapGapM = 0;
  let falseCalm = 0;
  let falseCalmRescued = 0;

  const perIsland = new Map<string, { n: number; harm: number; help: number }>();

  for (const row of rows) {
    const idx = row[COL.island_index] as number;
    const hour = row[COL.hour] as string;
    const pair = resolved.pairs[idx];
    const beaches = resolved.beaches[idx];
    if (!pair || !beaches) continue;

    const copW = pair.copWindwardByHour.get(hour);
    const copL = pair.copLeewardByHour.get(hour);
    if (typeof copW !== 'number' || typeof copL !== 'number') continue;

    const wWind = row[COL.w_wind_kmh] as number | null;
    const wDeg = row[COL.w_wind_deg] as number | null;
    const lWind = row[COL.l_wind_kmh] as number | null;
    const lDeg = row[COL.l_wind_deg] as number | null;
    const wGrid = row[COL.w_wave_m] as number | null;
    const lGrid = row[COL.l_wave_m] as number | null;
    if (wWind === null || wDeg === null || lWind === null || lDeg === null) continue;
    if (wGrid === null || lGrid === null) continue;

    hoursConsidered++;
    const judgeDiff = copW - copL;
    judgeContrastSum += Math.abs(judgeDiff);
    if (Math.abs(judgeDiff) < MIN_HOUR_CONTRAST_M) continue;
    hoursWithJudgeContrast++;

    const w = evaluateBeach(
      beaches.windward, resolved.profiles.get(beaches.windward.beach.id),
      wWind, wDeg, row[COL.w_gust_kmh] as number | null, wGrid,
      row[COL.w_wave_deg] as number | null, row[COL.w_wave_s] as number | null,
      row[COL.w_swell_m] as number | null, row[COL.w_swell_s] as number | null,
    );
    const l = evaluateBeach(
      beaches.leeward, resolved.profiles.get(beaches.leeward.beach.id),
      lWind, lDeg, row[COL.l_gust_kmh] as number | null, lGrid,
      row[COL.l_wave_deg] as number | null, row[COL.l_wave_s] as number | null,
      row[COL.l_swell_m] as number | null, row[COL.l_swell_s] as number | null,
    );

    beachesEvaluated += 2;
    for (const side of [w, l]) {
      if (side.effective !== side.uncapped) {
        capChangesTheNumber++;
        maxCapGapM = Math.max(maxCapGapM, Math.abs(side.uncapped - side.effective));
      }
    }
    if (Math.sign(w.effective - l.effective) !== Math.sign(w.uncapped - l.uncapped)) {
      capChangesTheRanking++;
    }

    const judgeSign = Math.sign(judgeDiff);
    const gridSign = Math.sign(wGrid - lGrid);
    const oursSign = Math.sign(w.effective - l.effective);

    const gridRight = gridSign === judgeSign;
    const oursRight = oursSign === judgeSign;

    const island = perIsland.get(pair.island) ?? { n: 0, harm: 0, help: 0 };
    island.n++;

    if (gridRight) {
      gridCorrect++;
      if (!oursRight) {
        harm++;
        island.harm++;
        if (oursSign === 0) harmTies++; else harmInversions++;
        if (explainIsland && pair.island === explainIsland && explanations.length < 400) {
          explanations.push({
            hour,
            judge: { windward: copW, leeward: copL },
            grid: { windward: wGrid, leeward: lGrid },
            ours: { windward: w.effective, leeward: l.effective },
            exposure: { windward: w.exposure, leeward: l.exposure },
            windKmh: { windward: wWind, leeward: lWind },
            beaufort: { windward: w.beaufort, leeward: l.beaufort },
          });
        }
      }
    } else {
      gridWrong++;
      if (oursRight) { help++; island.help++; }
    }
    perIsland.set(pair.island, island);

    // Ψεύτικη γαλήνη, ανά ακτή — ο τύπος λάθους που έχει συνέπεια στο νερό.
    for (const [cop, side] of [[copW, w], [copL, l]] as const) {
      if (cop >= FALSE_CALM_JUDGE_M && (side.grid ?? 0) < FALSE_CALM_GRID_M) {
        falseCalm++;
        if (side.effective >= FALSE_CALM_GRID_M) falseCalmRescued++;
      }
    }
  }

  const harmRatio = gridCorrect ? harm / gridCorrect : 0;
  const helpRatio = gridWrong ? help / gridWrong : 0;
  const rescueRatio = falseCalm ? falseCalmRescued / falseCalm : 0;
  const meanJudgeContrast = hoursConsidered ? judgeContrastSum / hoursConsidered : 0;

  const enoughData = gridCorrect >= GATES.min_hours_per_bucket
    && gridWrong >= GATES.min_hours_per_bucket;

  const gateA = meanJudgeContrast >= GATES.min_judge_contrast_m;
  const gateB = gridCorrect > 0 && harmRatio <= GATES.max_harm_ratio;
  const gateC = gridWrong > 0 && helpRatio >= GATES.min_help_ratio;
  const gateD = falseCalm > 0 && rescueRatio >= GATES.min_false_calm_rescue_ratio;
  const gateE = enoughData;

  return {
    gates: GATES,
    sample: {
      hours_considered: hoursConsidered,
      hours_with_judge_contrast: hoursWithJudgeContrast,
      mean_judge_contrast_m: Number(meanJudgeContrast.toFixed(3)),
      islands: resolved.pairs.length,
    },
    buckets: {
      grid_ranks_correctly: gridCorrect,
      grid_ranks_wrongly: gridWrong,
      false_calm_hours: falseCalm,
    },
    results: {
      our_geometry_breaks_a_correct_ranking: {
        pass: gateB, ratio: Number(harmRatio.toFixed(4)), n: gridCorrect,
        threshold: GATES.max_harm_ratio, direction: 'lower is better',
        // Διαγνωστικό, δεν συμμετέχει στο pass/fail (βλ. σχόλιο στη summarise).
        breakdown: {
          flattened_to_a_tie: harmTies,
          named_the_wrong_coast: harmInversions,
        },
      },
      our_geometry_fixes_a_wrong_ranking: {
        pass: gateC, ratio: Number(helpRatio.toFixed(4)), n: gridWrong,
        threshold: GATES.min_help_ratio, direction: 'higher is better',
      },
      our_geometry_rescues_a_false_calm: {
        pass: gateD, ratio: Number(rescueRatio.toFixed(4)), n: falseCalm,
        threshold: GATES.min_false_calm_rescue_ratio, direction: 'higher is better',
      },
      the_judge_sees_a_real_difference: {
        pass: gateA, mean_contrast_m: Number(meanJudgeContrast.toFixed(3)),
        threshold_m: GATES.min_judge_contrast_m,
      },
      enough_hours_to_answer: {
        pass: gateE, grid_correct: gridCorrect, grid_wrong: gridWrong,
        threshold: GATES.min_hours_per_bucket,
      },
    },
    // Πόσο κοστίζει στην πράξη το ότι το App.tsx:729 δεν εφαρμόζει light-wind cap.
    // Διαγνωστικό, εκτός πυλών — απαντά στο «αξίζει να ενοποιηθεί;».
    app_tsx_divergence: {
      beach_hours: beachesEvaluated,
      cap_changes_the_number: capChangesTheNumber,
      cap_changes_the_number_ratio: beachesEvaluated
        ? Number((capChangesTheNumber / beachesEvaluated).toFixed(4)) : 0,
      cap_changes_which_coast_is_calmer: capChangesTheRanking,
      largest_gap_m: Number(maxCapGapM.toFixed(2)),
    },
    // Η ΜΟΝΗ ΠΟΥ ΣΤΕΛΝΕΙ ΚΩΔΙΚΑ ΠΙΣΩ ΕΙΝΑΙ Η Β. Βλ. το ΟΡΙΟ στην κορυφή:
    // ο κριτής των 4,2 χλμ. δεν μπορεί να δει όρμο 200 μ., άρα αποτυχία της Γ
    // σημαίνει «δεν φαίνεται», όχι «δεν υπάρχει».
    verdict: {
      geometry_does_no_harm: gateA && gateB && gateE,
      geometry_measurably_helps: gateA && gateC && gateE,
      geometry_earns_its_place_on_safety: gateA && gateD,
    },
    per_island: [...perIsland.entries()]
      .map(([island, v]) => ({ island, ...v }))
      .sort((a, b) => b.harm - a.harm),
    ...(explainIsland ? { explain: { island: explainIsland, harm_hours: explanations } } : {}),
  };
};

// ─── 5. Εκτέλεση ────────────────────────────────────────────────────────────

const resolvePairs = (pairs: IslandPair[], byName: Map<string, BeachRecord[]>): Resolved => {
  const beaches: Resolved['beaches'] = [];
  const regionIds = new Set<string>();
  const missing: string[] = [];

  for (const pair of pairs) {
    const w = byName.get(pair.windwardBeach)?.[0];
    const l = byName.get(pair.leewardBeach)?.[0];
    if (!w || !l) {
      missing.push(`${pair.island}: ${!w ? pair.windwardBeach : pair.leewardBeach}`);
      beaches.push(undefined as any);
      continue;
    }
    regionIds.add(w.regionId);
    regionIds.add(l.regionId);
    beaches.push({ windward: w, leeward: l });
  }

  if (missing.length) {
    log('');
    log(`! ${missing.length} ζεύγη δεν ταιριάζουν με παραλία στα δεδομένα — αγνοούνται:`);
    missing.slice(0, 8).forEach((m) => log(`    ${m}`));
    log('  (τα ονόματα άλλαξαν από τότε που τρέξε ο κυματικός έλεγχος)');
  }

  return { pairs, beaches, profiles: loadExposureProfiles(regionIds) };
};

const main = async () => {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const replayIdx = argv.indexOf('--replay');
  const replay = replayIdx >= 0;
  // Το επόμενο όρισμα είναι παράθυρο ΜΟΝΟ αν δεν είναι άλλη σημαία. Χωρίς αυτό,
  // `--replay --explain Skopelos` διάβαζε το «--explain» ως ημερομηνία, δεν
  // ταίριαζε κανένα παράθυρο, και το τεστ τερμάτιζε με μηδέν δεδομένα.
  const nextArg = replay ? argv[replayIdx + 1] : undefined;
  const replayWindow = nextArg && !nextArg.startsWith('--') ? nextArg : undefined;

  const windowFiles = fs.readdirSync(WAVE_DIR)
    .filter((f) => /^lee-shore-hours-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!windowFiles.length) {
    throw new Error('Δεν υπάρχουν αποθηκευμένες ώρες στο reports/wave-model/ — τρέξε πρώτα npm run audit:lee-shore');
  }

  const byName = loadBeaches();
  const reports: any[] = [];

  for (const file of windowFiles) {
    const w = loadLeeShoreWindow(file);
    if (replayWindow && !w.start.startsWith(replayWindow)) continue;

    log('');
    log(`━━ ΠΑΡΑΘΥΡΟ ${w.start} → ${w.end}  (${w.pairs.length} νησιά, ${w.hours.length} ώρες μελτεμιού)`);

    const resolved = resolvePairs(w.pairs, byName);
    const usable = resolved.beaches.filter(Boolean).length;
    log(`   ζεύγη παραλιών που ταίριαξαν: ${usable}/${w.pairs.length}`);

    if (dryRun) {
      resolved.pairs.forEach((p, i) => {
        if (!resolved.beaches[i]) return;
        log(`     ${p.island.padEnd(14)} ${p.windwardBeach}  ↔  ${p.leewardBeach}`);
      });
      continue;
    }

    const cachePath = hoursCachePath(w.start);
    let rows: Row[];

    if (replay || fs.existsSync(cachePath)) {
      if (!fs.existsSync(cachePath)) {
        log(`   ! δεν υπάρχει cache για ${w.start} — παραλείπεται στο --replay`);
        continue;
      }
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (JSON.stringify(cached.columns) !== JSON.stringify(COLUMNS)) {
        throw new Error(`${path.basename(cachePath)}: η σειρά στηλών άλλαξε — το συμβόλαιο έσπασε, ξανακατέβασέ τες`);
      }
      rows = cached.rows;
      log(`   ↻ replay από ${path.basename(cachePath)} (${rows.length} γραμμές, χωρίς δίκτυο)`);
    } else {
      log('   ↓ κατέβασμα ανέμου + κύματος ΣΤΙΣ ΠΑΡΑΛΙΕΣ...');
      const seriesByIndex: (Record<'w' | 'l', HourSeries> | null)[] = [];
      for (let i = 0; i < resolved.pairs.length; i++) {
        const bp = resolved.beaches[i];
        if (!bp) { seriesByIndex.push(null); continue; }
        const [ws, ls] = await Promise.all([
          fetchPointHours(bp.windward.beach.coordinates.lat, bp.windward.beach.coordinates.lon, w.start, w.end),
          fetchPointHours(bp.leeward.beach.coordinates.lat, bp.leeward.beach.coordinates.lon, w.start, w.end),
        ]);
        seriesByIndex.push({ w: ws, l: ls });
        log(`     ${String(i + 1).padStart(2)}/${resolved.pairs.length}  ${resolved.pairs[i].island}`);
        await sleep(400);
      }

      rows = [];
      for (const { islandIndex, hour } of w.hours) {
        const s = seriesByIndex[islandIndex];
        if (!s) continue;
        const ws = s.w.get(hour);
        const ls = s.l.get(hour);
        if (!ws || !ls) continue;
        rows.push([islandIndex, hour, ...ws, ...ls]);
      }

      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(cachePath, `${JSON.stringify({
        window: { start: w.start, end: w.end },
        source: 'open-meteo archive (wind) + marine ewam cell_selection=sea, AT THE BEACH',
        judge: 'cmems_mod_med_wav_anfc_4.2km_PT1H-i, from reports/wave-model/',
        columns: COLUMNS,
        islands: w.pairs.map((p) => ({ island: p.island, windward_beach: p.windwardBeach, leeward_beach: p.leewardBeach })),
        rows,
      })}\n`);
      log(`   ✓ ${rows.length} γραμμές → ${path.relative(ROOT, cachePath)}`);
    }

    const report = summarise(resolved, rows);
    reports.push({ window: { start: w.start, end: w.end }, ...report });

    log('');
    log(`   ΔΕΙΓΜΑ: ${report.sample.hours_with_judge_contrast} ώρες με πραγματική διαφορά ακτών (μέση ${report.sample.mean_judge_contrast_m} μ.)`);
    for (const [key, gate] of Object.entries(report.results)) {
      log(`   ${(gate as any).pass ? '✓' : '✗'} ${key}  ${(gate as any).ratio ?? (gate as any).mean_contrast_m ?? ''}`);
    }
  }

  if (dryRun) {
    log('');
    log('--dry-run: το δείγμα τυπώθηκε, τίποτα δεν κατέβηκε και τίποτα δεν κρίθηκε.');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'effective-ranking.json');
  fs.writeFileSync(outPath, `${JSON.stringify({
    question: 'Does max(grid, our geometry) rank two coasts better or worse than the bare grid?',
    judge: 'cmems_mod_med_wav_anfc_4.2km_PT1H-i',
    limitation: 'The judge is a 4.2 km grid; our geometry describes 200 m coves. This test can '
      + 'prove "does no harm" strongly. It cannot prove "how much it helps", and a failure of '
      + 'the help gate means the judge cannot see it - not that it is not there.',
    windows: reports,
  }, null, 2)}\n`);

  log('');
  log(`→ ${path.relative(ROOT, outPath)}`);

  // Μηδέν παράθυρα δεν είναι επιτυχία. Το `reports.some()` σε άδειο πίνακα
  // επιστρέφει false, οπότε μια κακογραμμένη σημαία τύπωνε «δεν βλάπτει» χωρίς
  // να έχει κρίνει ούτε μία ώρα. Ένα τεστ που δεν έτρεξε πρέπει να ουρλιάζει.
  if (!reports.length) {
    log('');
    log('ΣΦΑΛΜΑ: δεν κρίθηκε κανένα παράθυρο. Αυτό ΔΕΝ είναι «πέρασε» — έλεγξε τα ορίσματα.');
    process.exitCode = 1;
    return;
  }

  const anyHarm = reports.some((r) => !r.verdict.geometry_does_no_harm);
  log('');
  log(anyHarm
    ? 'ΕΤΥΜΗΓΟΡΙΑ: η πύλη «δεν βλάπτει» ΔΕΝ πέρασε σε κάθε παράθυρο. Αυτή είναι η μόνη που στέλνει κώδικα πίσω.'
    : 'ΕΤΥΜΗΓΟΡΙΑ: η γεωμετρία ΔΕΝ βλάπτει την κατάταξη σε καμία μετρημένη χρονιά.');
  process.exitCode = anyHarm ? 1 : 0;
};

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? err}\n`);
  process.exit(1);
});
