import type { MarineForecast } from '../types';

/**
 * WHICH WAVE MODEL EACH HOUR COMES FROM.
 *
 * This is decision-grade logic — it chooses the number that drives every sea verdict, colour
 * and ranking in the app — so it lives in its own dependency-free module rather than inside the
 * network service. That is not tidiness: services/weatherService.ts pulls in the analytics and
 * provider modules, and a guard that wants to prove this behaviour has to load that whole graph
 * to reach one pure function. Here it is importable on its own.
 *
 * THE RULE: `ewam` (DWD, 0.05° ≈ 5 km) wins every hour it reports a wave height;
 * `meteofrance_wave` (0.08° ≈ 8 km, global, 7 days) covers the rest.
 *
 * Why ewam leads, measured 2026-07-31 against 9,723 QC-good hourly observations from three
 * Greek buoys (Ηράκλειο, 61277, Άθως — Copernicus In Situ, 2022-09 → 2024-12):
 *
 *                       bias vs buoy      RMSE       dangerous underestimates (>0.4 m, >=5 Bft)
 *   meteofrance_wave    -0.07 m (-8.2%)   0.203 m    204
 *   ewam                +0.01 m (+1.7%)   0.184 m     62
 *
 * The model this app shipped for a year UNDER-reads the sea at every buoy, by up to -23.9% in
 * strong wind. That inverted the assumption the previous design rested on — meteofrance_wave was
 * treated as the cautious choice and is in fact the optimistic one.
 *
 * The defect that started it: at 0.08° a Greek island spans 1-2 grid cells, so the model cannot
 * tell a windward shore from its lee. Over 496 meltemi cases the N-vs-S coast difference was
 * 0.05 m for meteofrance_wave (identical in 290 of them) against 1.11 m for ewam, correct sign
 * 496/496. Not a calibration gap: over 15 open-water points >25 km from land (1,022 hours) the
 * two agree to -0.5%. It is purely resolution.
 *
 * THE SAFETY NET IS NOT HERE. utils/waveModel.resolveEffectiveWaveHeightM still takes the LARGER
 * of the measurement and this app's own fetch-limited SMB + wind-chop floor, and that floor is
 * computed without reference to any of these models. No wave model, however well it scores
 * against a buoy, can print flat water over a shore our own physics calls choppy.
 */

export interface MarineHourlyRow {
  dt_txt: string;
  marine: MarineForecast;
}

const optionalNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

/**
 * ΤΟ ΦΡΕΝΟ ΤΟΥ ΗΓΕΤΗ — ένα νούμερο που παραβιάζει τη φυσική δεν τυπώνεται (17/08/2026).
 *
 * Η αφορμή, μετρημένη ζωντανά στο σημείο δειγματοληψίας του Λιμνιώνα Κυθήρων
 * (36,2772 / 22,886), 17/08/2026:
 *
 *   ώρα     ewam    meteofrance_wave
 *   14:00   0,22 μ.       0,18 μ.
 *   15:00   3,44 μ.       0,18 μ.     <-- +3,22 μ. σε ΜΙΑ ώρα, ο μάρτυρας επίπεδος
 *   16:00   2,66 μ.       0,20 μ.
 *   18:00   1,80 μ.       0,22 μ.
 *
 * Ο τοπικός άνεμος εκείνη την ώρα ήταν 4 Μποφόρ. Καμία φυσική δεν χτίζει τρία μέτρα σε
 * εξήντα λεπτά, και το ίδιο σφάλμα κάλυπτε όλη την περιοχή (30 χλμ ΝΔ: 2,40 έναντι 0,24 ·
 * 50 χλμ Ν: 1,00 έναντι 0,34). Ο κανόνας «το ewam κερδίζει κάθε ώρα που δίνει ύψος» δεν
 * είχε ΚΑΝΕΝΑΝ έλεγχο λογικής, οπότε το 3,44 θα πήγαινε αυτούσιο στην ετυμηγορία.
 *
 * ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΦΤΙΑΧΝΕΙ ΨΕΥΤΙΚΗ ΗΡΕΜΙΑ — η μόνη ένσταση που μετράει εδώ. Τρεις λόγοι,
 * και οι τρεις δομικοί:
 *   1. Το δίχτυ της `utils/waveModel.resolveEffectiveWaveHeightM` κρατάει το ΜΕΓΑΛΥΤΕΡΟ
 *      ανάμεσα στη μέτρηση και στο δικό μας fetch-limited SMB + δάπεδο κυματισμού. Ό,τι κι
 *      αν επιστρέψει το δεύτερο μοντέλο, δεν μπορεί να τυπώσει επίπεδο νερό πάνω από ακτή
 *      που η δική μας φυσική λέει ταραγμένη.
 *   2. Χωρίς μάρτυρα ΔΕΝ σβήνουμε τίποτα: αν το δεύτερο μοντέλο δεν έχει τιμή εκείνη την
 *      ώρα, η τιμή του ηγέτη περνάει αυτούσια. Η σιωπή δεν είναι τεκμήριο.
 *   3. Πραγματική θαλασσοταραχή ανεβάζει ΚΑΙ ΤΑ ΔΥΟ μοντέλα — σε 15 σημεία ανοιχτής
 *      θάλασσας >25 χλμ από στεριά τα δύο συμφωνούν στο −0,5% (services/forecast/
 *      openMeteoProvider.ts:118). Η διαφωνία τους είναι θέμα ανάλυσης κοντά στην ακτή,
 *      όχι θέμα έντασης — άρα «ο ένας βλέπει τρίμετρο, ο άλλος εικοσάρι» δεν είναι καιρός.
 */

/** Αύξηση ύψους σε μία ώρα πέρα από την οποία δεν υπάρχει άνεμος που να τη δικαιολογεί. */
export const MAX_CREDIBLE_WAVE_GROWTH_M_PER_H = 1;

/** Κάτω από αυτό το ύψος ένα άλμα δεν αλλάζει τίποτα σε ό,τι διαβάζει ο επισκέπτης. */
export const SPIKE_MIN_HEIGHT_M = 1;

/** Ο μάρτυρας επιβεβαιώνει αν διαβάζει τουλάχιστον αυτό το κλάσμα της τιμής του ηγέτη. */
export const SPIKE_CORROBORATION_RATIO = 0.5;

/**
 * Οι ώρες όπου ο ηγέτης έκανε φυσικά αδύνατο άλμα ΚΑΙ ο μάρτυρας δεν τον επιβεβαιώνει.
 *
 * Το επεισόδιο δεν κλείνει στην πρώτη ώρα: το σφάλμα του 15:00 έσβηνε αργά (3,44 → 2,66 →
 * 2,20 → 1,80), και καθεμία από τις επόμενες ώρες είναι ΠΤΩΣΗ, όχι άλμα. Πιάνοντας μόνο την
 * κορυφή θα αφήναμε πέντε λάθος ώρες όρθιες. Έτσι το επεισόδιο κρατάει όσο ο ηγέτης μένει
 * ψηλά ΚΑΙ ασυνόδευτος, και κλείνει μόλις ο μάρτυρας τον προλάβει ή πέσει κάτω από το όριο.
 */
const uncorroboratedSpikeHours = (
  leadSeries: unknown[] | undefined,
  witnessSeries: unknown[] | undefined,
): Set<number> => {
  const suspect = new Set<number>();
  if (!Array.isArray(leadSeries) || !Array.isArray(witnessSeries)) return suspect;

  let insideEpisode = false;
  for (let index = 0; index < leadSeries.length; index += 1) {
    const lead = optionalNumber(leadSeries[index]);
    if (lead === undefined) { insideEpisode = false; continue; }

    const witness = optionalNumber(witnessSeries[index]);
    // Κανένας μάρτυρας => καμία κατηγορία. Ο ηγέτης κρατάει την τιμή του.
    const corroborated = witness === undefined || witness >= lead * SPIKE_CORROBORATION_RATIO;
    if (corroborated || lead < SPIKE_MIN_HEIGHT_M) { insideEpisode = false; continue; }

    if (insideEpisode) { suspect.add(index); continue; }

    const previous = optionalNumber(leadSeries[index - 1]);
    if (previous !== undefined && lead - previous > MAX_CREDIBLE_WAVE_GROWTH_M_PER_H) {
      insideEpisode = true;
      suspect.add(index);
    }
  }
  return suspect;
};

/**
 * Shape one Open-Meteo Marine `hourly` block into rows, choosing a model per hour.
 *
 * `preferModelId` flips which model leads for THIS point only. Omit it and nothing changes.
 */
export const parseMarineHourly = (
  marineHourly: any,
  preferModelId?: 'ewam' | 'meteofrance_wave',
): MarineHourlyRow[] => {
  if (!marineHourly?.time || !Array.isArray(marineHourly.time)) {
    throw new Error('Marine fetch failed: missing hourly data');
  }

  // Open-Meteo renames every field to `<field>_<model>` as soon as MORE THAN ONE model is
  // requested, and leaves it bare when exactly one is. We ask for three, so the suffixed name is
  // the normal case and the bare name is the fallback.
  //
  // The fallback is load-bearing, not defensive decoration: the edge proxy caches marine
  // responses with s-maxage=10800 + stale-while-revalidate=1800 (netlify/functions/forecast.mjs,
  // CDN_MAX_AGE_S.marine and CDN_STALE_WHILE_REVALIDATE_S), so for up to ~3.5h after a deploy
  // that changes the model list the CDN keeps serving the PREVIOUS shape. Without the bare-name
  // fallback, every wave reading would read undefined for that whole window.
  // (Corrected 05/08/2026 — this said 1800/3600 and «~1.5h», neither of which had been true
  // since the per-route cache split on 31/07.)
  const series = (field: string, model: string): unknown[] | undefined =>
    marineHourly[`${field}_${model}`] ?? marineHourly[field];

  // Written out one literal series('<field>', '<model>') call at a time, deliberately: the build
  // gate (scripts/validateMarineModelParsing.mjs) reads these statically to prove every requested
  // variable is parsed from a PINNED model. A tidier `waveSeries(field)` helper hides the field
  // names from that check and the gate goes blind — it flagged exactly that on 2026-07-31.
  // Verbosity here buys a real guarantee.
  const waveHeightEwam = series('wave_height', 'ewam');
  const waveHeightMf = series('wave_height', 'meteofrance_wave');
  const waveDirectionEwam = series('wave_direction', 'ewam');
  const waveDirectionMf = series('wave_direction', 'meteofrance_wave');
  const wavePeriodEwam = series('wave_period', 'ewam');
  const wavePeriodMf = series('wave_period', 'meteofrance_wave');
  const swellHeightEwam = series('swell_wave_height', 'ewam');
  const swellHeightMf = series('swell_wave_height', 'meteofrance_wave');
  const swellDirectionEwam = series('swell_wave_direction', 'ewam');
  const swellDirectionMf = series('swell_wave_direction', 'meteofrance_wave');
  const swellPeriodEwam = series('swell_wave_period', 'ewam');
  const swellPeriodMf = series('swell_wave_period', 'meteofrance_wave');

  // Only meteofrance_currents carries SST; a wave model's own column is all-null, so the
  // bare-name fallback here resolves to that null column on pre-deploy cached responses — which
  // is correct, and simply hides the water-temperature card until the cache turns over.
  const seaTemperature = series('sea_surface_temperature', 'meteofrance_currents');

  // One model per hour, decided by whether ewam reported a HEIGHT for that hour. Every other
  // field follows that same decision, so height, direction and period always describe ONE sea —
  // utils/waveCharacter turns (height, period) into a single severity, so a mixed pair would
  // invent a sea neither model reported.
  // ΤΟ ΣΗΜΕΙΟ ΜΠΟΡΕΙ ΝΑ ΖΗΤΗΣΕΙ ΤΟ ΑΛΛΟ ΜΟΝΤΕΛΟ — ΚΑΙ ΜΟΝΟ ΓΙΑ ΕΝΑΝ ΛΟΓΟ.
  // Το ewam ηγείται παντού επειδή κέρδισε σε 9.723 ώρες σημαδούρας (βλ. κεφαλίδα). Σε 56
  // σημεία όμως το κελί του περιγράφει νερό που η παραλία ΔΕΝ βλέπει — πίσω από ακρωτήρι —
  // ενώ του meteofrance_wave όχι. Εκεί η καλύτερη βαθμολογία του ewam είναι άσχετη: μετράει
  // σωστά λάθος θάλασσα. Η λίστα φτιάχνεται από μέτρηση, όχι από κρίση, και αποκλείει ρητά
  // τις περιπτώσεις όπου το meteofrance θα έχανε τη διάκριση προσήνεμης/υπήνεμης ακτής —
  // scripts/bakeMarineModelPreference.mjs.
  const flipped = preferModelId === 'meteofrance_wave';
  const leading = flipped ? waveHeightMf : waveHeightEwam;
  // Ο μάρτυρας είναι πάντα ΤΟ ΑΛΛΟ μοντέλο, όποιο κι αν ηγείται σε αυτό το σημείο — ώστε τα 56
  // αναποδογυρισμένα σημεία να προστατεύονται με τον ίδιο ακριβώς κανόνα, όχι με εξαίρεση.
  const witness = flipped ? waveHeightEwam : waveHeightMf;
  const spikeHours = uncorroboratedSpikeHours(leading, witness);
  // Μια ώρα-σφάλμα πέφτει ΟΛΟΚΛΗΡΗ στον μάρτυρα: ύψος, περίοδος, κατεύθυνση και αποθαλασσιά
  // μαζί. Κρατώντας μόνο το ύψος θα φτιάχναμε θάλασσα που δεν ανέφερε κανένα από τα δύο μοντέλα
  // — ακριβώς ο λόγος που η επιλογή μοντέλου ήταν εξαρχής μία ανά ώρα.
  const preferLeadingAt = (index: number): boolean => (
    optionalNumber(leading?.[index]) !== undefined && !spikeHours.has(index)
  );
  const pick = (index: number, ewam?: unknown[], fallback?: unknown[]): unknown => {
    const [first, second] = flipped ? [fallback, ewam] : [ewam, fallback];
    return preferLeadingAt(index) ? first?.[index] : second?.[index];
  };
  const modelAt = (index: number): 'ewam' | 'meteofrance_wave' => {
    if (preferLeadingAt(index)) return flipped ? 'meteofrance_wave' : 'ewam';
    return flipped ? 'ewam' : 'meteofrance_wave';
  };

  return marineHourly.time
    .map((timeStr: string, index: number): MarineHourlyRow => ({
      dt_txt: timeStr.replace('T', ' '),
      marine: {
        waveHeightM: optionalNumber(pick(index, waveHeightEwam, waveHeightMf)),
        waveDirectionDeg: optionalNumber(pick(index, waveDirectionEwam, waveDirectionMf)),
        wavePeriodS: optionalNumber(pick(index, wavePeriodEwam, wavePeriodMf)),
        swellWaveHeightM: optionalNumber(pick(index, swellHeightEwam, swellHeightMf)),
        swellWaveDirectionDeg: optionalNumber(pick(index, swellDirectionEwam, swellDirectionMf)),
        swellWavePeriodS: optionalNumber(pick(index, swellPeriodEwam, swellPeriodMf)),
        seaSurfaceTemperatureC: optionalNumber(seaTemperature?.[index]),
        waveModel: modelAt(index),
        source: 'open-meteo-marine',
      },
    }))
    .filter((item: MarineHourlyRow) => (
      item.marine.waveHeightM !== undefined ||
      item.marine.waveDirectionDeg !== undefined ||
      item.marine.wavePeriodS !== undefined ||
      item.marine.swellWaveHeightM !== undefined ||
      item.marine.swellWaveDirectionDeg !== undefined ||
      item.marine.seaSurfaceTemperatureC !== undefined
    ));
};


/**
 * ΤΑ ΕΞΙ ΠΕΔΙΑ ΠΟΥ ΖΗΤΑΕΙ Η ΚΛΗΣΗ ΚΥΜΑΤΟΣ. Ίδια λίστα με το MARINE_HOURLY του provider — η πύλη
 * scripts/validateMarineModelParsing.mjs απαιτεί να συμφωνούν, ώστε ένα πεδίο που προστίθεται
 * εκεί να μη μένει σιωπηλά έξω από την ένωση.
 */
export const MARINE_MERGE_FIELDS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
] as const;

/**
 * ΕΝΩΝΕΙ ΤΑ ΔΥΟ ΣΚΕΛΗ ΤΗΣ ΘΑΛΑΣΣΑΣ ΣΕ ΕΝΑ hourly, ΩΡΑ-ΜΕ-ΩΡΑ (PORISMA §Γ43).
 *
 * Από 20/08/2026 το κύμα έρχεται σε ΔΥΟ αιτήματα: το κοντινό σκέλος (`models=ewam`, μνήμη 3 ώ.)
 * και η ουρά (`models=meteofrance_wave`, μνήμη 12 ώ.). Ο πάροχος επιστρέφει ΓΥΜΝΑ ονόματα πεδίων
 * όταν ζητηθεί ΕΝΑ μοντέλο και `<πεδίο>_<μοντέλο>` όταν ζητηθούν περισσότερα — επαληθευμένο
 * 20/08/2026 στην ίδια συντεταγμένη: 144 ώρες και στα δύο, 94 μη-κενές στο ewam, 144 στο άλλο.
 *
 * Αυτή η συνάρτηση ξαναφτιάχνει ΑΚΡΙΒΩΣ τη μορφή που περίμενε ο parser όσο τα μοντέλα έρχονταν
 * μαζί, ώστε **καμία απόφαση να μην αλλάξει**: ο κανόνας «το ewam κερδίζει κάθε ώρα που δίνει
 * ύψος» και — το κρίσιμο — ο ΜΑΡΤΥΡΑΣ του `uncorroboratedSpikeHours` δουλεύουν όπως πριν.
 *
 * ⚠️ Η ΕΝΩΣΗ ΓΙΝΕΤΑΙ ΜΕ ΤΗ ΣΦΡΑΓΙΔΑ ΩΡΑΣ, ΠΟΤΕ ΜΕ ΤΗ ΘΕΣΗ. Τα δύο σκέλη έχουν ΔΙΑΦΟΡΕΤΙΚΗ
 * μνήμη, άρα μπορούν να ληφθούν εκατέρωθεν μιας αλλαγής ημέρας και να ξεκινούν από άλλη ώρα.
 * Ένωση κατά θέση θα μετατόπιζε σιωπηλά όλα τα ύψη κύματος κατά ώρες — λάθος που καμία πύλη δεν
 * θα φαινόταν να πιάνει, γιατί τα νούμερα θα έμοιαζαν απολύτως εύλογα.
 *
 * ΑΝ ΛΕΙΠΕΙ ΕΝΑ ΣΚΕΛΟΣ, ΕΠΙΣΤΡΕΦΕΤΑΙ ΤΟ ΑΛΛΟ ΑΥΤΟΥΣΙΟ — και αυτό είναι ασφαλές και από τις δύο
 * πλευρές: τα γυμνά ονόματά του διαβάζονται από την εφεδρεία του `series()` ως ΚΑΙ τα δύο
 * μοντέλα, οπότε ηγέτης και μάρτυρας γίνονται η ίδια σειρά, η επιβεβαίωση περνάει πάντα και
 * καμία ώρα δεν κόβεται. Δηλαδή αποτυχία της ουράς κοστίζει τις μέρες 4-6, ΠΟΤΕ ένα χαμηλωμένο
 * κύμα σήμερα.
 */
export const mergeMarineLegs = (nearHourly: any, tailHourly: any): any => {
  const nearTimes: unknown = nearHourly?.time;
  const tailTimes: unknown = tailHourly?.time;
  if (!Array.isArray(nearTimes) || !nearTimes.length) return tailHourly ?? nearHourly;
  if (!Array.isArray(tailTimes) || !tailTimes.length) return nearHourly;

  const indexOfTime = (times: unknown[]): Map<string, number> => {
    const map = new Map<string, number>();
    times.forEach((t, i) => { if (typeof t === 'string' && !map.has(t)) map.set(t, i); });
    return map;
  };
  const nearAt = indexOfTime(nearTimes);
  const tailAt = indexOfTime(tailTimes);

  // Ο άξονας είναι η ΕΝΩΣΗ των δύο, ταξινομημένη. Οι σφραγίδες είναι ISO, άρα η αλφαβητική
  // σειρά ΕΙΝΑΙ η χρονολογική. Ένωση και όχι «το πιο μακρύ σκέλος», ώστε μια ώρα που έχει μόνο
  // το ένα σκέλος να μη χάνεται.
  const spine = [...new Set([...nearAt.keys(), ...tailAt.keys()])].sort();

  const column = (source: any, at: Map<string, number>, field: string, model: string): unknown[] => {
    const series = source?.[`${field}_${model}`] ?? source?.[field];
    if (!Array.isArray(series)) return spine.map(() => null);
    return spine.map(t => {
      const i = at.get(t);
      return i === undefined ? null : (series[i] ?? null);
    });
  };

  const merged: Record<string, unknown> = { time: spine };
  for (const field of MARINE_MERGE_FIELDS) {
    merged[`${field}_ewam`] = column(nearHourly, nearAt, field, 'ewam');
    merged[`${field}_meteofrance_wave`] = column(tailHourly, tailAt, field, 'meteofrance_wave');
  }
  return merged;
};
