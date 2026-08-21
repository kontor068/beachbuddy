import { uncertainDaysFromResponse, FORECAST_UNCERTAINTY_BRAKE_ENABLED, type UncertainByDay, type EnsembleSpreadResponse } from '../utils/forecastUncertainty';

/**
 * ΠΟΣΟ ΣΤΕΡΕΗ ΕΙΝΑΙ Η ΠΡΟΓΝΩΣΗ ΤΗΣ ΚΑΘΕ ΜΕΡΑΣ — ο πελάτης του `/api/ensemble-spread`.
 *
 * Το endpoint (netlify/functions/ensemble-spread.mjs) ρωτάει 51 σενάρια του ECMWF και επιστρέφει
 * **λιγότερα από 400 bytes**: ένα ναι/όχι ανά ημέρα. Αυτό το αρχείο δεν κρίνει τίποτα — μόνο
 * φέρνει, θυμάται και μεταφράζει σε κλειδιά ημερομηνίας (utils/forecastUncertainty).
 *
 * ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΕΙΝΑΙ ΣΚΟΠΙΜΑ ΕΤΣΙ:
 *
 * 1. **ΡΗΤΟ ΟΡΙΟ ΧΡΟΝΟΥ.** `AbortSignal.timeout` — ένα fetch χωρίς όριο δεν αποτυγχάνει, περιμένει,
 *    και ένας νεκρός κόμβος θα κρατούσε το φρένο «άγνωστο» για όση ώρα αντέξει ο browser.
 * 2. **ΑΠΟΤΥΧΙΑ = ΣΙΩΠΗ, ΟΧΙ ΑΒΕΒΑΙΟΤΗΤΑ.** Κάθε σφάλμα γυρίζει `null`, που σημαίνει «δεν ξέρω»
 *    και αφήνει κάθε χρώμα και κάθε λέξη ΑΚΡΙΒΩΣ όπως ήταν. Ποτέ δεν φρενάρει από άγνοια.
 * 3. **ΜΝΗΜΗ 6 ΩΡΕΣ**, όσο ακριβώς και η μνήμη του CDN και ο κύκλος του μοντέλου. Έτσι ο αριθμός
 *    των επισκεπτών δεν προσθέτει ούτε μία κλήση upstream, και μια πλοήγηση μπρος-πίσω ανάμεσα
 *    σε δύο περιοχές δεν ξαναρωτάει.
 */

const ENDPOINT = '/api/ensemble-spread';
const TIMEOUT_MS = 8000;
/** Ίδιο με το `CDN_MAX_AGE_S` της function: μετά από αυτό, η απάντηση δεν αξίζει να κρατηθεί. */
const TTL_MS = 6 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'ensemble_spread_';

interface CachedEntry {
  at: number;
  days: UncertainByDay;
}

const memory = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<UncertainByDay | null>>();

/** Τρία δεκαδικά — ίδια ακρίβεια με το κλειδί των θαλάσσιων σημείων· το κελί του ensemble είναι 25 χλμ. */
const pointKey = (lat: number, lon: number): string => `${lat.toFixed(3)}_${lon.toFixed(3)}`;

const readStore = (key: string): CachedEntry | null => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry;
    return typeof parsed?.at === 'number' && parsed.days ? parsed : null;
  } catch {
    return null;
  }
};

const writeStore = (key: string, entry: CachedEntry): void => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Γεμάτη αποθήκη δεν είναι λόγος να χαλάσει η σελίδα — η μνήμη στη RAM αρκεί για τη συνεδρία.
  }
};

const fresh = (entry: CachedEntry | null): entry is CachedEntry => (
  // athens-clock-exempt: ΗΛΙΚΙΑ σε πραγματικά χιλιοστά, όχι ώρα τοίχου. Ίδια αρχή με το
  // freshnessNow του hooks/useWeather — ένα cache που «λήγει» με ελληνική ώρα θα κρατούσε
  // παλιά δεδομένα για επισκέπτες σε άλλη ζώνη.
  Boolean(entry) && Date.now() - (entry as CachedEntry).at < TTL_MS
);

/**
 * Ποιες ΜΕΡΕΣ αυτής της περιοχής είναι αβέβαιες. `null` = δεν ξέρουμε (και τότε δεν αλλάζει τίποτα).
 *
 * Δέχεται το σημείο της ΠΕΡΙΟΧΗΣ, όχι της παραλίας: το πλέγμα του ensemble είναι 25 χλμ, οπότε
 * δύο παραλίες του ίδιου νησιού θα έπαιρναν ούτως ή άλλως την ίδια απάντηση — και μια κλήση ανά
 * παραλία θα πολλαπλασίαζε το κόστος επί 26 χωρίς να αλλάξει ούτε ένα ναι/όχι.
 */
export const fetchForecastUncertainty = async (
  lat: number,
  lon: number,
): Promise<UncertainByDay | null> => {
  if (!FORECAST_UNCERTAINTY_BRAKE_ENABLED) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const key = pointKey(lat, lon);
  const cached = memory.get(key) ?? readStore(key);
  if (fresh(cached)) {
    memory.set(key, cached);
    return cached.days;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async (): Promise<UncertainByDay | null> => {
    try {
      const response = await fetch(`${ENDPOINT}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const payload = await response.json() as EnsembleSpreadResponse;
      const days = uncertainDaysFromResponse(payload);
      if (!days) return null;
      // athens-clock-exempt: πραγματική στιγμή λήψης, για τον υπολογισμό ηλικίας παραπάνω.
      const entry: CachedEntry = { at: Date.now(), days };
      memory.set(key, entry);
      writeStore(key, entry);
      return days;
    } catch {
      // Δίκτυο, timeout, κακό JSON — όλα σημαίνουν «δεν ξέρω». Καμία προειδοποίηση στην κονσόλα
      // του επισκέπτη για κάτι που δεν του χαλάει τίποτα.
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
};
