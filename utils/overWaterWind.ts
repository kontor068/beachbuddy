import type { DailyForecast, ForecastItem } from '../types';
import { getBeaufortLevel } from './weatherUtils';

/**
 * ΤΟ ΣΤΡΩΜΑ ΑΝΕΜΟΥ ΠΑΝΩ ΑΠΟ ΝΕΡΟ — Η ΔΙΕΥΘΥΝΣΗ, ΚΑΙ ΜΟΝΟ Η ΔΙΕΥΘΥΝΣΗ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Η πινέζα κάθεται στην ακτή, αλλά το κελί που της απαντάει είναι στεριανό
 * (`cell_selection=land`, η προεπιλογή του Open-Meteo) και συχνά κάθεται χιλιόμετρα μέσα στο
 * νησί. Στην Αχαράβη Κέρκυρας το κελί είναι 7,2 χλμ μέσα και έλεγε Δ 272°· το νερό μπροστά της
 * έλεγε ΒΔ 320°. Ο Δ πιάνει 10 χλμ θάλασσα (μερική έκθεση → μπλε), ο ΒΔ πιάνει 24 χλμ
 * κατευθείαν πάνω της (έκθεση → κίτρινη). Δηλαδή η επιλογή κελιού δεν μετακινεί ένα νούμερο,
 * ΓΥΡΙΖΕΙ ΤΟ ΧΡΩΜΑ.
 *
 * ΤΙ ΑΠΟΔΕΙΧΘΗΚΕ ΚΑΙ ΤΙ ΟΧΙ (PORISMA §Γ29 — METAR 25 ελληνικών αεροδρομίων, δύο ανεξάρτητα
 * παράθυρα, 17.104 ώρες):
 *
 *   • Η ΔΙΕΥΘΥΝΣΗ του θαλασσινού κελιού είναι πιο σωστή όταν το στεριανό κάθεται ≥3 χλμ μακριά
 *     (σωστός τομέας 45°: 60,1% → 63,2% τον Αύγουστο, 51,0% → 53,9% τον Ιούνιο), και όταν τα
 *     δύο κελιά ΔΙΑΦΩΝΟΥΝ έχει δίκιο 1,4-1,5 φορές πιο συχνά.
 *   • Η ΤΑΧΥΤΗΤΑ ΔΕΝ αποδείχθηκε — και κάτω από 3 χλμ η στεριά ήταν σταθερά ΚΑΛΥΤΕΡΗ. Το ένα
 *     παράθυρο έδειξε τη θάλασσα καλύτερη, το άλλο τη στεριά. Όποιος προτείνει ολική
 *     αντικατάσταση `land → sea`, να διαβάσει αυτή τη γραμμή πρώτα.
 *
 * Γι' αυτό αυτό το αρχείο αγγίζει ΜΟΝΟ το `deg`. Ταχύτητα, ριπή, `speedBeforeGustFloor` και
 * επομένως το Μποφόρ, ο δάπεδος ριπής και κάθε βαθμονόμηση πάνω τους μένουν ανέγγιχτα.
 *
 * ΔΥΟ ΠΥΛΕΣ, ΚΑΙ ΟΙ ΔΥΟ ΜΕΤΡΗΜΕΝΕΣ:
 *
 *   1. ΑΠΟΣΤΑΣΗ — δεν ζει εδώ. Ζει στο ψήσιμο (`scripts/bakeSeaWindCells.mjs`, πύλη 3 χλμ):
 *      παραλία κάτω από το όριο δεν έχει καν κελί θάλασσας στον χάρτη, άρα δεν μπορεί να
 *      διορθωθεί όσο κι αν το θέλει κώδικας παρακάτω. Αλλάζει με ένα rebuild — δρόμος επιστροφής.
 *   2. ΕΝΤΑΣΗ — ζει εδώ, `OVER_WATER_MIN_BEAUFORT`. Στα ≤2 Μποφόρ η εθνική μέτρηση (§Γ37,
 *      2.872 παραλίες × 7 ημέρες) βρήκε **μηδέν** αλλαγές χρώματος σε 54.142 ώρες: όλα είναι
 *      μπλε ούτως ή άλλως και η διεύθυνση δεν διαβάζεται από καμία επιφάνεια. Η πύλη γλιτώνει
 *      ~30% των κλήσεων χωρίς να χάνει τίποτα που φαίνεται.
 *
 * ΤΟ ΑΠΟΤΥΠΩΜΑ, ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΓΡΑΦΤΕΙ Η ΠΡΩΤΗ ΓΡΑΜΜΗ (§Γ37): ο τομέας αλλάζει στο 34,6% των
 * ωρών, η λέξη της κάρτας στο 17,3%, το χρώμα στο 3,9%, το μοντελοποιημένο κύμα στο 7,9%. Οι
 * αλλαγές πάνε 3.246 προς τα πιο σκούρα και 3.808 προς τα πιο ανοιχτά — **διόρθωση ακρίβειας,
 * όχι ασφαλείας**. Κανείς δεν πρέπει να το πουλήσει ως «κάνει το site πιο ασφαλές».
 */

/**
 * Κάτω από αυτό το στρώμα δεν ζητιέται και δεν εφαρμόζεται.
 *
 * ΜΗΝ ΤΟ ΚΑΤΕΒΑΣΕΙΣ ΣΤΟ 2 «για πληρότητα». Στα 2 Μποφόρ δεν αλλάζει κανένα χρώμα (0/54.142),
 * αλλάζει μόνο το μοντελοποιημένο κύμα σε 4,8% των ωρών — και εκεί μιλάμε για διαφορά της
 * τάξης του ενός δέκατου του μέτρου σε νερό που όλες οι επιφάνειες ήδη λένε ήρεμο. Το κόστος
 * είναι πραγματικό (κάθε ώρα που περνάει την πύλη είναι ένα επιπλέον αίτημα ανά κελί), το
 * κέρδος όχι.
 */
export const OVER_WATER_MIN_BEAUFORT = 3;

const MS_TO_KMH = 3.6;

/** `dt_txt` → διεύθυνση σε μοίρες, όπως τη δίνει το κελί νερού μπροστά στην παραλία. */
export type OverWaterDirectionByTime = Readonly<Record<string, number>>;

const beaufortOf = (wind: ForecastItem['wind'] | undefined): number => (
  wind && typeof wind.speed === 'number' && Number.isFinite(wind.speed)
    ? getBeaufortLevel(wind.speed * MS_TO_KMH)
    : 0
);

/**
 * Επιστρέφει το ίδιο αντικείμενο ανέμου όταν δεν αλλάζει τίποτα.
 *
 * Η ταυτότητα ΔΕΝ είναι μικροβελτιστοποίηση εδώ: το `applyBeachWindToDailyForecast` και το
 * `adjustDailyForecastToHour` κρίνουν με `===` (`ownWind !== item.wind`, `wind: hourItem.wind`),
 * και ολόκληρες οθόνες κάνουν memo πάνω σε αυτά. Ένα καινούριο αντικείμενο ανά ώρα θα ξαναέβαφε
 * τον χάρτη σε κάθε render χωρίς να έχει αλλάξει τίποτα.
 */
const withOverWaterDeg = (wind: ForecastItem['wind'], seaDeg: number): ForecastItem['wind'] => {
  if (!Number.isFinite(seaDeg)) return wind;
  const normalised = ((seaDeg % 360) + 360) % 360;
  if (normalised === wind.deg) return wind;
  return { ...wind, deg: normalised, degBeforeOverWater: wind.deg };
};

/**
 * Βάζει τη διεύθυνση του νερού μέσα σε μια ημερήσια πρόγνωση παραλίας.
 *
 * ΠΟΤΕ ΝΑ ΚΛΗΘΕΙ: αμέσως μετά το `applyBeachWindToDailyForecast` και **ΠΡΙΝ** από το
 * `adjustDailyForecastToHour`. Ο λόγος είναι μηχανικός, όχι αισθητικός: η ημερήσια τιμή `wind`
 * ΔΕΝ είναι δικό της αντικείμενο — είναι ο άνεμος ενός ωριαίου στοιχείου, είτε του μεσημεριού
 * (`processForecastData`, `wind: midday.wind`) είτε της επιλεγμένης ώρας
 * (`adjustDailyForecastToHour`, `wind: hourItem.wind`). Αν διορθώσουμε πρώτα τις ώρες, η
 * ημερήσια τιμή έρχεται ήδη διορθωμένη από μόνη της. Αν το κάνουμε ανάποδα, η κάρτα και ο
 * χάρτης διαβάζουν διαφορετική διεύθυνση για την ίδια στιγμή.
 *
 * Ο χάρτης ταυτότητας παρακάτω κλείνει την τρύπα για την περίπτωση που η ημερήσια τιμή δείχνει
 * σε ώρα που ΔΕΝ πέρασε την πύλη έντασης: τότε μένει κι αυτή αδιόρθωτη, όπως πρέπει.
 */
export const applyOverWaterWindDirection = (
  base: DailyForecast,
  directionByTime: OverWaterDirectionByTime | undefined,
): DailyForecast => {
  if (!directionByTime || !base?.hourly?.length) return base;

  // Κλειδί `unknown` επίτηδες: η ημερήσια τιμή `wind` έχει ΠΙΟ ΧΑΛΑΡΟ τύπο από τον ωριαίο
  // (το `gust` είναι προαιρετικό εκεί), αλλά είναι ΤΟ ΙΔΙΟ αντικείμενο με αναφορά. Ψάχνουμε
  // ταυτότητα, όχι σχήμα.
  const swapped = new Map<unknown, ForecastItem['wind']>();
  let changed = false;

  const hourly = base.hourly.map(item => {
    const wind = item?.wind;
    if (!wind) return item;
    const seaDeg = directionByTime[item.dt_txt];
    if (typeof seaDeg !== 'number' || !Number.isFinite(seaDeg)) return item;
    if (beaufortOf(wind) < OVER_WATER_MIN_BEAUFORT) return item;

    const next = withOverWaterDeg(wind, seaDeg);
    if (next === wind) return item;
    swapped.set(wind, next);
    changed = true;
    return { ...item, wind: next };
  });

  if (!changed) return base;

  // Η ημερήσια τιμή είναι ο άνεμος ΜΙΑΣ ώρας, κρατημένος με αναφορά. Αν εκείνη η ώρα
  // διορθώθηκε, ακολουθεί· αν όχι (π.χ. το μεσημέρι είχε 2 Μποφόρ), μένει όπως ήταν.
  const dayWind = (base.wind && swapped.get(base.wind)) || base.wind;
  return { ...base, wind: dayWind, hourly };
};

/**
 * Το ίδιο, για ολόκληρη τη σειρά ημερών μιας παραλίας. Επιστρέφει τον ΙΔΙΟ πίνακα όταν καμία
 * μέρα δεν άλλαξε, ώστε το `useMemo` παραπάνω να μη θεωρήσει ότι ήρθαν νέα δεδομένα.
 */
export const applyOverWaterWindDirectionToDays = (
  days: DailyForecast[],
  directionByTime: OverWaterDirectionByTime | undefined,
): DailyForecast[] => {
  if (!directionByTime || !days?.length) return days;
  let changed = false;
  const next = days.map(day => {
    const updated = applyOverWaterWindDirection(day, directionByTime);
    if (updated !== day) changed = true;
    return updated;
  });
  return changed ? next : days;
};

/**
 * ΑΞΙΖΕΙ ΝΑ ΠΛΗΡΩΣΟΥΜΕ ΤΙΣ ΚΛΗΣΕΙΣ ΓΙ' ΑΥΤΗ ΤΗΝ ΠΕΡΙΟΧΗ ΣΗΜΕΡΑ;
 *
 * Το στρώμα κοστίζει ένα πλήρες επιπλέον αίτημα ανά κελί νερού. Αν καμία ώρα του ορίζοντα δεν
 * φτάνει τα `OVER_WATER_MIN_BEAUFORT`, η απάντηση θα εφαρμοζόταν σε καμία ώρα — άρα το αίτημα
 * είναι σκέτη χρέωση. Μετρημένο εθνικά (§Γ37): στα ≤2 Μποφόρ ΚΑΝΕΝΑ χρώμα δεν αλλάζει σε 54.142
 * ώρες. Η πύλη γλιτώνει ~30% των ωρών.
 *
 * Διαβάζει τον άνεμο του ΣΤΕΡΙΑΝΟΥ κελιού, που είναι ο μόνος που έχουμε όταν αποφασίζουμε — και
 * ο μόνος που επιτρέπεται να κρίνει ένταση ούτως ή άλλως.
 */
export const anyHourReachesOverWaterMinimum = (items: Array<{ wind?: { speed?: number } }> | undefined): boolean => (
  !!items?.some(item => {
    const speed = item?.wind?.speed;
    return typeof speed === 'number' && Number.isFinite(speed)
      && getBeaufortLevel(speed * MS_TO_KMH) >= OVER_WATER_MIN_BEAUFORT;
  })
);

/**
 * Πόσες ώρες αυτής της πρόγνωσης διαβάζουν πια τη θάλασσα. Το χρησιμοποιεί η πύλη ποιότητας
 * (`scripts/validateOverWaterWindLayer.mjs`) και το διαγνωστικό — καμία επιφάνεια χρήστη.
 */
export const countOverWaterHours = (forecast: DailyForecast | undefined): number => (
  forecast?.hourly?.reduce(
    (n, item) => n + (typeof item?.wind?.degBeforeOverWater === 'number' ? 1 : 0),
    0,
  ) ?? 0
);
