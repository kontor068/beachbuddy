import type { DailyForecast } from '../types';
import { wallClockDayKey, athensNow } from './athensTime';

/**
 * ΤΟ ΦΡΕΝΟ ΤΗΣ ΑΒΕΒΑΙΟΤΗΤΑΣ — «ΜΗΝ ΤΟ ΛΕΣ ΓΙΑ ΤΗΝ ΠΑΡΑΣΚΕΥΗ ΟΠΩΣ ΤΟ ΛΕΣ ΓΙΑ ΣΗΜΕΡΑ»
 * (§ΑΞ2/Α5, απόφαση Μίλτου 21/08/2026).
 *
 * ΤΙ ΜΕΤΡΗΘΗΚΕ ΠΡΩΤΑ. Το ensemble του ECMWF (51 σενάρια) ρωτήθηκε εθνικά για 110/110 περιοχές ×
 * 7 ημέρες (`scripts/measureEnsembleSpread.mjs`, βίβλος §Γ53). Μια ΗΜΕΡΑ λέγεται αβέβαιη όταν σε
 * ≥4 ώρες κολύμβησης (10:00-18:00) τα σενάρια απέχουν ≥2 βαθμίδες Μποφόρ μεταξύ p10 και p90:
 *
 *   ημέρα      σήμερα   +1     +2     +3     +4     +5     +6
 *   αβέβαιες     0%     1,8%   0,9%   2,7%   6,4%   33,6%  34,5%
 *
 * Δηλαδή η αβεβαιότητα ΔΕΝ είναι ομοιόμορφη: δεκαπλασιάζεται από το +3 στο +5. Ένας κανόνας
 * «από την τάδε μέρα και μετά μη λες ΙΔΑΝΙΚΗ» θα τιμωρούσε 110 περιοχές για να πιάσει 7.
 *
 * ΤΙ ΚΟΣΤΙΖΕΙ, ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ (`scripts/measureEnsembleBrakeImpact.mjs`,
 * `reports/quality/ensemble-brake-impact.json`): πάνω σε 14.365 παραλιο-ημέρες (110 περιοχές ×
 * 5 μέρες, πραγματικός κινητήρας) το φρένο αγγίζει **283 (1,97%)**, ρίχνει **113 μπλε σε κίτρινο
 * (0,79%)** και **83 «ιδανικά» σε «καλά» (0,58%)**. Για σύγκριση, το δάπεδο του «ΙΔΑΝΙΚΗ» που
 * μπήκε την προηγούμενη μέρα κόστισε 652 μπλε.
 *
 * ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ, ΚΑΙ ΓΙΑΤΙ Ο ΚΑΘΕΝΑΣ:
 *
 *   1. **ΠΟΤΕ ΣΗΜΕΡΑ** (`UNCERTAINTY_MIN_LEAD_DAYS`). Η σημερινή ημέρα μετρήθηκε στο 0% αβέβαιη·
 *      φρένο εκεί θα ήταν θόρυβος πάνω στην πιο κρίσιμη οθόνη του site.
 *   2. **ΕΝΑ ΣΚΑΛΙ, ΜΟΝΟΔΡΟΜΟΣ.** 🔵→🟡 και «ιδανικά»→«καλά». Τίποτα άλλο, και ΠΟΤΕ προς το
 *      ηρεμότερο. Ίδια αρχή με κάθε άλλο ταβάνι αυτού του μοντέλου.
 *   3. **ΑΓΝΩΣΤΟ ≠ ΑΒΕΒΑΙΟ.** Αν το endpoint πέσει, αν λείπει η μέρα, αν το κλειδί δεν ταιριάζει
 *      — δεν φρενάρει τίποτα και η συμπεριφορά είναι byte-identical με πριν. Η απουσία μέτρησης
 *      ποτέ δεν δικαιολογεί την τολμηρή κίνηση ΟΥΤΕ την υπερβολικά συντηρητική.
 *   4. **ΜΙΛΑΕΙ ΜΟΝΟ ΓΙΑ ΤΟΝ ΑΝΕΜΟ.** Το ensemble δεν δίνει κύμα. Το φρένο δεν αγγίζει ΠΟΤΕ το
 *      τυπωμένο ύψος, το ταβάνι θάλασσας ή οποιαδήποτε κρίση για τη θάλασσα.
 *   5. **ΚΑΝΕΝΑ ΜΟΝΙΜΟ ΤΑΜΠΕΛΑΚΙ «ΜΕΤΡΙΑ ΕΜΠΙΣΤΟΣΥΝΗ».** Η βίβλος το έχει ήδη απορρίψει: μήνυμα
 *      αβεβαιότητας που εμφανίζεται συνέχεια διαβάζεται ως «δεν ξέρουμε τι λέμε». Το φρένο
 *      αλλάζει το ΧΡΩΜΑ και τη ΛΕΞΗ, δεν προσθέτει δεύτερο μήνυμα.
 *   6. **ΔΡΟΜΟΣ ΕΠΙΣΤΡΟΦΗΣ.** `FORECAST_UNCERTAINTY_BRAKE_ENABLED = false` το σβήνει ολόκληρο
 *      σε μία γραμμή, χωρίς να πειραχτεί καμία επιφάνεια.
 *
 * ΚΛΕΙΔΙ ΗΜΕΡΑΣ, ΟΧΙ ΔΕΙΚΤΗΣ. Η αντιστοίχιση γίνεται με ΗΜΕΡΟΜΗΝΙΑ (ώρα Ελλάδας), όχι με τη θέση
 * στον πίνακα: η πρόγνωση πετάει τις περασμένες μέρες καθώς προχωράει η μέρα
 * (`dropPastForecastDays`), οπότε ο δείκτης 0 δεν είναι σταθερός, ενώ η ημερομηνία είναι.
 */

/** Ο διακόπτης. Σβήνει ολόκληρο το φρένο χωρίς να αγγίξει καμία επιφάνεια. */
export const FORECAST_UNCERTAINTY_BRAKE_ENABLED = true;

/** Πόσες μέρες μπροστά πρέπει να είναι μια μέρα για να μπορεί να φρεναριστεί. Ποτέ σήμερα. */
export const UNCERTAINTY_MIN_LEAD_DAYS = 1;

/** `YYYY-MM-DD` (ώρα Ελλάδας) → η μέρα είναι αβέβαιη. Λείπει = δεν ξέρουμε = δεν φρενάρουμε. */
export type UncertainByDay = Readonly<Record<string, boolean>>;

/** Η απάντηση του `/api/ensemble-spread`, όπως τη γράφει το netlify/functions/ensemble-spread.mjs. */
export interface EnsembleSpreadResponse {
  available?: boolean;
  days?: Array<{ lead?: number; uncertain?: boolean; uncertainHours?: number; worstGapRungs?: number }> | null;
}

/**
 * Μετατρέπει την απάντηση του endpoint σε κλειδιά ημερομηνίας.
 *
 * Το `lead` είναι σχετικό με τη στιγμή που απάντησε το upstream· εδώ γίνεται απόλυτη ημερομηνία
 * ώστε μια απάντηση από τη μνήμη του CDN (έως 6 ώρες) να μη μετακινηθεί κατά μία μέρα αν στο
 * μεταξύ άλλαξε η ημερομηνία στην Ελλάδα.
 */
export const uncertainDaysFromResponse = (
  payload: EnsembleSpreadResponse | null | undefined,
  now: Date = athensNow(),
): UncertainByDay | null => {
  if (!payload?.available || !Array.isArray(payload.days)) return null;
  const out: Record<string, boolean> = {};
  for (const day of payload.days) {
    if (typeof day?.lead !== 'number' || !Number.isFinite(day.lead)) continue;
    if (day.lead < UNCERTAINTY_MIN_LEAD_DAYS) continue; // ποτέ σήμερα, ούτε καν στα δεδομένα
    if (day.uncertain !== true) continue;               // μόνο τα ΝΑΙ ταξιδεύουν
    const stamp = new Date(now.getTime());
    stamp.setDate(stamp.getDate() + day.lead);
    out[wallClockDayKey(stamp)] = true;
  }
  return out;
};

/**
 * Σημαδεύει τις αβέβαιες μέρες μιας πρόγνωσης.
 *
 * Επιστρέφει τον ΙΔΙΟ πίνακα όταν δεν αλλάζει τίποτα, ώστε το `useMemo` παραπάνω να μη νομίσει
 * ότι ήρθαν νέα δεδομένα — ίδια σύμβαση με το `applyOverWaterWindToDays`.
 */
export const applyForecastUncertaintyToDays = (
  days: DailyForecast[] | null | undefined,
  uncertainByDay: UncertainByDay | null | undefined,
): DailyForecast[] | null | undefined => {
  if (!FORECAST_UNCERTAINTY_BRAKE_ENABLED) return days;
  if (!days?.length || !uncertainByDay) return days;
  let changed = false;
  const next = days.map(day => {
    if (!day?.date) return day;
    const uncertain = uncertainByDay[wallClockDayKey(day.date)] === true;
    if (uncertain === Boolean(day.forecastUncertain)) return day;
    changed = true;
    return { ...day, forecastUncertain: uncertain };
  });
  return changed ? next : days;
};
