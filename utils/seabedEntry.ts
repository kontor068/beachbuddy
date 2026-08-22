import type { LanguageCode } from '../types';
import { getLocalizedCopy } from './i18n';

/**
 * «ΒΑΘΑΙΝΕΙ ΑΠΟΤΟΜΑ» — Η ΜΕΤΡΗΣΗ ΤΟΥ ΒΥΘΟΥ ΓΙΝΕΤΑΙ ΠΛΗΡΟΦΟΡΙΑ, ΟΧΙ ΠΟΝΤΟΙ (22/08/2026).
 *
 * ΤΟ ΕΥΡΗΜΑ. Από 18/08 κάθονται στον δίσκο 110 αρχεία με μετρημένα βάθη (EMODnet, 100/300/500 μ.
 * × 8 τομείς) που καμία γραμμή παραγωγής δεν διάβαζε. Το προφανές θα ήταν να γεμίσουν το κενό
 * πεδίο `seabedSlope`, που η βαθμολογία ήδη διαβάζει (+6 / −12 σε οικογενειακή λειτουργία).
 *
 * Η ΜΕΤΡΗΣΗ ΤΟ ΑΚΥΡΩΣΕ. `scripts/measureSeabedSlopeImpact.mjs`, 2.873 παραλίες × 5 κυματώδεις
 * μέρες, σε πέντε κατώφλια: **0 ετυμηγορίες και 0 χρώματα αλλάζουν**, σε κάθε κατώφλι. Το −12
 * κάθεται σε έναν άξονα που είναι μικρό κομμάτι του πίνακα των 100, οπότε το τελικό αποτέλεσμα
 * είναι ~2-3 πόντοι και μόνο η σειρά κουνιέται. Ένα πεδίο που δεν αλλάζει τίποτα από όσα
 * διαβάζει ο επισκέπτης δεν αξίζει build step.
 *
 * ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ: **να το λέμε, όχι να το βαθμολογούμε.** Ο αριθμός δεν μπορεί να μιλήσει· η
 * πληροφορία μπορεί, και είναι ακριβώς αυτό που ρωτάει κάποιος που κατεβαίνει με παιδί.
 *
 * ΓΙΑΤΙ ΜΟΝΟ ΤΟ ΒΑΘΥ, ΠΟΤΕ ΤΟ ΡΗΧΟ. Το EMODnet εξομαλύνει στα ρηχά — γι' αυτό παρκαρίστηκε το
 * ταβάνι θραύσης. «15 μ. στα 100 μ. από την ακτή» δεν μπορεί να είναι κατασκευασμένο· «1,1 μ.»
 * μπορεί. Άρα δηλώνουμε ΜΟΝΟ την απότομη πλευρά και ποτέ «ρηχά νερά».
 */

/**
 * Πόσο βαθιά πρέπει να είναι στα 100 μ. από την παραλία για να το πούμε.
 *
 * ΒΓΗΚΕ ΑΠΟ ΤΗ ΜΕΤΡΗΣΗ, ΔΕΝ ΕΠΙΛΕΧΘΗΚΕ ΣΤΑ ΤΥΦΛΑ. Εθνικά, το βάθος στα 100 μ. μπροστά από την
 * παραλία έχει διάμεσο **3,2 μ.** (p75 5,9 · p90 9,4). Τα 12 μ. είναι σχεδόν **4×** η διάμεσος —
 * δεν είναι οριακή κρίση. Και ο ανεξάρτητος μάρτυρας συμφωνεί: στις παραλίες που περνούν το
 * κατώφλι, η καταγεγραμμένη ένδειξη «βαθιά» εμφανίζεται σε **46%** έναντι **24%** στη βάση.
 */
export const STEEP_DEPTH_AT_100M_M = 12;

/** Οι οκτώ τομείς, στη σειρά που τους γράφει το αρχείο βυθομετρίας. */
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type SeabedSector = typeof SECTORS[number];

/** Ο τομέας που αντιστοιχεί σε μια γωνία — δηλαδή το νερό ΜΠΡΟΣΤΑ, όχι το γύρω. */
export const seabedSectorForBearing = (deg: number): SeabedSector =>
  SECTORS[Math.floor(((((deg % 360) + 360) % 360) + 22.5) / 45) % 8];

export interface SeabedDepthProfile {
  sectors?: Record<string, { depths?: Record<string, number | null> } | undefined>;
}

export interface SteepSeabedInput {
  profile: SeabedDepthProfile | undefined;
  /** Η γωνία που κοιτάει η παραλία (`facingDeg` του προφίλ έκθεσης). */
  facingDeg: number | undefined;
  /** Ό,τι λέει η δική μας καταγραφή για το βάθος — μάρτυρας, όχι απόδειξη. */
  recordedWaterDepthType?: string;
}

/**
 * Το βάθος που δηλώνουμε, ή `undefined` για σιωπή. Η απουσία σημαίνει «δεν ισχυριζόμαστε
 * τίποτα» — ποτέ «ρηχά».
 *
 * ΟΤΑΝ ΟΙ ΔΥΟ ΜΑΡΤΥΡΕΣ ΔΙΑΦΩΝΟΥΝ, ΣΩΠΑΙΝΟΥΜΕ. 35 από τις 109 παραλίες που περνούν το κατώφλι
 * είναι καταγεγραμμένες ως «ρηχές». Δεν ξέρουμε ποιος έχει δίκιο — η καταγραφή βγήκε από
 * περιγραφή και δεν έχει ελεγχθεί ποτέ, το EMODnet έχει κελί ~115 μ. — και μια δημόσια δήλωση
 * δεν είναι το σημείο για να το μαντέψουμε. Μένουν οι παραλίες όπου κανείς δεν διαφωνεί.
 */
export const resolveSteepSeabedDepthM = ({
  profile,
  facingDeg,
  recordedWaterDepthType,
}: SteepSeabedInput): number | undefined => {
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return undefined;
  if (recordedWaterDepthType === 'shallow') return undefined;

  const depth = profile?.sectors?.[seabedSectorForBearing(facingDeg)]?.depths?.['100m'];
  if (typeof depth !== 'number' || !Number.isFinite(depth)) return undefined;
  if (depth < STEEP_DEPTH_AT_100M_M) return undefined;

  return Math.round(depth);
};

/**
 * Η φράση, σε ένα σημείο, με τον αριθμό μέσα της.
 *
 * Ο ΑΡΙΘΜΟΣ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ. «Βαθαίνει απότομα» χωρίς μέτρο είναι γνώμη· «15 μ. βάθος 100 μ. από
 * την παραλία» είναι μέτρηση που ο αναγνώστης μπορεί να κρίνει μόνος του. Και δεν λέει τι να
 * κάνει: δεν είναι προειδοποίηση, είναι γεγονός.
 */
export const buildSteepSeabedNote = (language: LanguageCode, depthM: number): string => {
  const depth = Math.round(depthM);
  return getLocalizedCopy(language, {
    en: `Deepens quickly — about ${depth} m of water 100 m out from the beach.`,
    gr: `Βαθαίνει γρήγορα — περίπου ${depth} μ. νερό στα 100 μ. από την παραλία.`,
    fr: `Devient vite profond — environ ${depth} m d’eau à 100 m de la plage.`,
    de: `Wird schnell tief — rund ${depth} m Wasser 100 m vor dem Strand.`,
    it: `Diventa profondo in fretta — circa ${depth} m d’acqua a 100 m dalla spiaggia.`,
  });
};

/** Πού το μετρήσαμε, για όποιον θέλει να ξέρει. Ίδια φιλοσοφία με τη γραμμή Copernicus. */
export const buildSteepSeabedSource = (language: LanguageCode): string => getLocalizedCopy(language, {
  en: 'Measured from EMODnet bathymetry, not from descriptions.',
  gr: 'Μετρημένο από τη βυθομετρία EMODnet, όχι από περιγραφές.',
  fr: 'Mesuré sur la bathymétrie EMODnet, pas d’après des descriptions.',
  de: 'Aus der EMODnet-Bathymetrie gemessen, nicht aus Beschreibungen.',
  it: 'Misurato dalla batimetria EMODnet, non da descrizioni.',
});
