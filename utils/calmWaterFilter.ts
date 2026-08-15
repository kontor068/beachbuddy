import type { ConditionCauseReading } from './conditionCause';
import { isFlatWater, FLAT_WATER_SEA_STATE_M } from './conditionCause';
import type { LocalizedCopy } from './i18n';

/**
 * «ΗΡΕΜΟ ΝΕΡΟ» — ΤΟ ΕΝΑ ΦΙΛΤΡΟ ΣΥΝΘΗΚΩΝ, ΚΑΙ ΓΙΑΤΙ ΕΝΑ (Μίλτος, 15/08/2026).
 *
 * Η ερώτηση ήταν «να διαλέγει ο χρήστης πολύ αέρα + λίγο κύμα, ή το ανάποδο». Το λεξιλόγιο της
 * κάρτας (utils/conditionsFeelPhrase) παράγει 25 ζεύγη, άρα 25 υποψήφια φίλτρα. Μετρήθηκαν όλα
 * πάνω στο εθνικό δείγμα της ίδιας μέρας (110 περιοχές × 5 μέρες = 550 σκηνές, 14.310 ζεύγη,
 * reports/quality/colour-cause-split.json + το cache του) και **ένα** άξιζε:
 *
 *   • ΧΩΡΙΖΕΙ ΟΝΤΩΣ: σε δύσκολη μέρα (≥5 Μπφ) η περιοχή έχει ΚΑΙ ήρεμες ΚΑΙ κυματώδεις στο
 *     89,5% των σκηνών· άδειο μόνο 4,2%. Στα 4 Μπφ 92%.
 *   • ΣΤΑ 0–2 ΜΠΦ ΔΕΝ ΧΩΡΙΖΕΙ ΠΟΤΕ: 0 στις 259 σκηνές — όλες οι παραλίες είναι λάδι. Εκεί το
 *     chip δεν έχει τίποτα να κόψει, γι' αυτό υπάρχει το CALM_WATER_MIN_BEAUFORT.
 *   • ΤΟ ΑΝΑΠΟΔΟ («λίγος αέρας αλλά κύμα») ΔΕΝ ΕΜΦΑΝΙΣΤΗΚΕ ΚΑΜΙΑ ΦΟΡΑ στο δείγμα. Δεν φτιάχτηκε:
 *     ένα φίλτρο που δεν έχει αποτελέσματα είναι υπόσχεση που δεν τηρείται.
 *
 * ΠΟΥ ΑΝΗΚΕΙ, ΚΑΙ ΠΟΥ ΟΧΙ. Πάνω από τις ομάδες χρώματος, ποτέ μέσα σε μία. Μετρημένο: από τις
 * 602 ΚΟΚΚΙΝΕΣ του δείγματος μόνο **6** έχουν ήρεμο νερό (1%) — το κύμα τους είναι 0,9 ή 1,1 μ.
 * Ένα «ήρεμο νερό» μέσα στις «Δύσκολες 22» θα έβγαζε άδειο σχεδόν πάντα. Το κενό είναι αλλού:
 * μπλε 96% λάδι · κίτρινες 97% · **πορτοκαλί 32% (931 παραλίες)** · κόκκινες 1%. Δηλαδή ο
 * επισκέπτης που διαβάζει «Μέτριες 15» δεν έχει κανέναν τρόπο να δει ότι ~5 από αυτές έχουν
 * λάδι νερό. Αυτό ακριβώς κλείνει το chip.
 *
 * ⚠️ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΗ ΣΚΑΛΑ ΑΞΙΟΛΟΓΗΣΗΣ. Δεν λέει «καλή» ή «κακή», δεν έχει χρώμα, δεν μπαίνει
 * σε καμία κατάταξη. Λέει ένα μετρημένο γεγονός για το νερό που φτάνει σε ΑΥΤΗ την ακτή, με το
 * ίδιο κατώφλι και τον ίδιο αριθμό που διαβάζει η γραμμή αιτίας από πάνω του. Δύο σκάλες
 * αξιολόγησης είναι η κατηγορία σφάλματος που το project πληρώνει από τον Ιούλιο.
 */

/**
 * ΟΙ ΔΥΟ ΠΥΛΕΣ ΑΣΦΑΛΕΙΑΣ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΕΣ ΑΠΟ ΤΗΣ ΓΡΑΜΜΗΣ ΑΙΤΙΑΣ.
 *
 * Η γραμμή αιτίας είναι κείμενο: όταν οι πύλες της πέσουν, αλλάζει λέξεις («ο αέρας σε τραβάει
 * ανοιχτά» αντί για «φταίει ο αέρας, όχι το κύμα») και ο αναγνώστης κρίνει μόνος του. Το φίλτρο
 * είναι ΠΡΟΟΡΙΣΜΟΣ: ο χρήστης πατάει και του δίνουμε λίστα παραλιών για να πάει. Άρα εδώ οι
 * ίδιες συνθήκες δεν αλλάζουν διατύπωση — βγάζουν την παραλία ΕΞΩ.
 *
 *   • `swimVerdictAvoid` — η ίδια η εφαρμογή λέει «καλύτερα να μην μπεις». Δεν γίνεται να την
 *     προτείνουμε επειδή το ύψος του κύματος είναι μικρό.
 *   • `offshoreFlatWater` — το νερό είναι γυαλί ΑΚΡΙΒΩΣ επειδή ο αέρας φυσάει από τη στεριά προς
 *     τα έξω. Είναι η μία περίπτωση όπου «λάδι νερό» σημαίνει κίνδυνος, όχι ανακούφιση.
 *
 * ΤΟ ΚΟΣΤΟΣ ΤΟΥΣ ΜΕΤΡΗΘΗΚΕ πριν μπουν: το chip πέφτει από 40,4% → 35,6% των σκηνών και ο
 * διάμεσος αριθμός παραλιών από 11 → 9. Κόβουν 781 προτάσεις (388 «μην κολυμπάς» + 393
 * απόγειος-γυαλί) από τις 11.345 ήρεμες. Μονόδρομες, όπως όλες οι πύλες της βίβλου: μπορούν να
 * αφαιρέσουν παραλία από την προσφορά, ποτέ να προσθέσουν.
 *
 * ΔΕΝ υπάρχει πύλη μποφόρ ανά παραλία, και είναι σκόπιμο: το Βάι στα 6 Μποφόρ με 0,1 μ. στην
 * άμμο είναι ΑΚΡΙΒΩΣ η παραλία για την οποία φτιάχτηκε το φίλτρο. Όσες από αυτές είναι όντως
 * επικίνδυνες τις πιάνει ήδη η πρώτη πύλη — στο δείγμα και οι 602 κόκκινες έφεραν
 * `swimVerdictAvoid`.
 */
export const isCalmWaterPick = (reading: ConditionCauseReading): boolean => (
  isFlatWater(reading.shoreSeaStateM)
  && !reading.swimVerdictAvoid
  && !reading.offshoreFlatWater
);

/**
 * Κάτω από αυτόν τον άνεμο το chip δεν εμφανίζεται καθόλου.
 *
 * ΔΕΝ είναι κατώφλι για τον καιρό — καμία πινέζα, καμία ετυμηγορία, καμία κατάταξη δεν το
 * διαβάζει. Είναι κατώφλι ΕΜΦΑΝΙΣΗΣ, και βγήκε από μέτρηση: στις 259 σκηνές του δείγματος με
 * 0–2 Μποφόρ, σε **καμία** δεν υπήρχε παραλία με κύμα — όλες ήταν λάδι. Ένα chip «Ήρεμο νερό»
 * εκεί θα κρατούσε το 100% της λίστας, δηλαδή θα ήταν κουμπί που δεν κάνει τίποτα. Στα 3 Μπφ
 * χωρίζει στο 50% των σκηνών, στα 4 στο 92%.
 */
export const CALM_WATER_MIN_BEAUFORT = 3;

/**
 * ΜΙΑ ΙΔΑΝΙΚΗ ΣΤΟΝ ΧΑΡΤΗ ΣΩΠΑΙΝΕΙ ΤΟ CHIP (Μίλτος, 15/08/2026).
 *
 * «Όταν έχει ιδανικές παραλίες δεν θα βγάζεις το φίλτρο για ήρεμα νερά, παρά μόνο όταν έχεις
 * από καλές και πάνω.» Δηλαδή το chip ζει μόνο τις μέρες που το καλύτερο που έχει να δώσει η
 * περιοχή είναι ΚΑΛΗ ή χειρότερο.
 *
 * Ο λόγος είναι ο ίδιος που κρατάει σιωπηλή τη γραμμή αιτίας πάνω στις μπλε: όταν υπάρχει έστω
 * μία ΙΔΑΝΙΚΗ, ο επισκέπτης έχει ήδη καθαρή απάντηση — η πινέζα και το βάθρο του τη δίνουν — και
 * ένα δεύτερο κουμπί που υπόσχεται «ήρεμο νερό» δίπλα της τον βάζει να διαλέξει ανάμεσα σε δύο
 * καλά, δηλαδή προσθέτει δουλειά αντί για πληροφορία. Το «παρά τον αέρα» είναι εργαλείο για τις
 * δύσκολες μέρες· σε μέρα με ιδανικές δεν έχει τίποτα να προσθέσει.
 *
 * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΜΠΕΙ, στις ίδιες 550 σκηνές: εμφάνιση **35,6% → 26,0%** (σιωπούν 53 σκηνές που
 * έχουν ήδη ιδανικές), και ο διάμεσος αριθμός παραλιών **ανεβαίνει 9 → 10** — οι μέρες χωρίς
 * ιδανική είναι ακριβώς αυτές όπου το φίλτρο έχει περισσότερα να ξεχωρίσει. Μένει άνετα πάνω από
 * το όριο «όχι νεκρός κώδικας» της πύλης (20%).
 */
export const CALM_WATER_NEEDS_NO_IDEAL = true;

export interface CalmWaterOffer {
  /** Πόσες παραλίες θα μείνουν αν ο χρήστης πατήσει — το νούμερο που τυπώνεται στο chip. */
  count: number;
  /** Ποιες ακριβώς. Η λίστα και ο αριθμός βγαίνουν από το ΙΔΙΟ πέρασμα, ποτέ από δύο. */
  beachIds: ReadonlySet<number>;
}

/**
 * ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΠΡΟΣΦΟΡΑ — ΚΑΙ ΓΙΑΤΙ ΤΟ ΧΡΕΙΑΖΟΜΑΣΤΕ ΓΡΑΜΜΕΝΟ.
 *
 * Ένα σκέτο `null` θα αρκούσε για να μην εμφανιστεί το chip. Δεν αρκεί όμως για τη ΜΙΑ στιγμή
 * που ο σκεπτικιστής ξεχώρισε ως το πραγματικό ρίσκο αυτού του feature: ο χρήστης το ανάβει
 * στις 14:00 και σύρει τη μπάρα στις 19:00. Το φίλτρο πρέπει να πέσει — αλλά «αφαιρέθηκε το
 * φίλτρο» χωρίς λόγο διαβάζεται σαν βλάβη. «Καμία δεν έχει ήρεμο νερό αυτή την ώρα» και «τώρα
 * το έχουν όλες» είναι δύο εντελώς διαφορετικές ειδήσεις για τον επισκέπτη: η πρώτη λέει
 * «άλλαξε ώρα ή μέρα», η δεύτερη λέει «διάλεξε ελεύθερα».
 */
export type CalmWaterAbsence =
  /** Λίγος αέρας: δεν υπάρχει «παρά τον αέρα» για να ειπωθεί. Σιωπή, χωρίς μήνυμα. */
  | 'light-wind'
  /** Υπάρχει έστω μία ΙΔΑΝΙΚΗ — βλ. CALM_WATER_NEEDS_NO_IDEAL. */
  | 'has-ideal'
  /** Καμία παραλία δεν περνά τις πύλες αυτή την ώρα. */
  | 'none'
  /** Το έχουν όλες — το κουμπί δεν θα αφαιρούσε καμία. */
  | 'all';

export type CalmWaterState =
  | ({ status: 'offered' } & CalmWaterOffer)
  | { status: 'absent'; reason: CalmWaterAbsence };

/**
 * ΤΟ CHIP ΥΠΑΡΧΕΙ ΜΟΝΟ ΟΤΑΝ ΚΟΒΕΙ ΚΑΤΙ — και το νούμερό του είναι ό,τι θα δείξει το κλικ.
 *
 * Τρεις όροι, όλοι υποχρεωτικοί:
 *   1. ο άνεμος κάπου στην περιοχή φτάνει CALM_WATER_MIN_BEAUFORT (αλλιώς δεν υπάρχει «παρά τον
 *      αέρα» να μιλήσουμε γι' αυτό, και μετρημένα δεν χωρίζει ποτέ)·
 *   2. υπάρχει τουλάχιστον μία παραλία που το πιάνει — στο 0 το chip ΔΕΝ εμφανίζεται, ο κανόνας
 *      που κόστισε τα bundles φίλτρων της 11/08/2026 («άδειο σε 51/110 περιοχές»)·
 *   3. δεν το πιάνουν ΟΛΕΣ — αλλιώς το κουμπί υπόσχεται επιλογή και δεν αφαιρεί καμία παραλία,
 *      που είναι ο ίδιος τύπος ψέματος με το άδειο αποτέλεσμα.
 *
 * Ο δεύτερος και ο τρίτος όρος είναι και ο λόγος που το ίδιο πράγμα ΠΕΦΤΕΙ μόνο του όταν ο
 * χρήστης σύρει τη μπάρα της ώρας: το φίλτρο κρίνεται ξανά σε κάθε ώρα, και μόλις πάψει να
 * ισχύει, σβήνει με μήνυμα αντί να αδειάσει τη λίστα (App.tsx, calmWaterDropNote).
 */
export const resolveCalmWaterState = (
  entries: readonly { beachId: number; reading: ConditionCauseReading }[]
): CalmWaterState => {
  if (!entries.length) return { status: 'absent', reason: 'light-wind' };

  let maxBeaufort = 0;
  let hasIdeal = false;
  const beachIds = new Set<number>();
  entries.forEach(entry => {
    if (entry.reading.beaufort > maxBeaufort) maxBeaufort = entry.reading.beaufort;
    if (entry.reading.tone === 'blue') hasIdeal = true;
    if (isCalmWaterPick(entry.reading)) beachIds.add(entry.beachId);
  });

  // Ο άνεμος πρώτος: στα 2 Μποφόρ «το έχουν όλες» είναι αληθές αλλά άσχετο, και το μήνυμα
  // «τώρα το έχουν όλες» θα εμφανιζόταν κάθε φορά που κάποιος σύρει τη μπάρα σε ήρεμη ώρα.
  if (maxBeaufort < CALM_WATER_MIN_BEAUFORT) return { status: 'absent', reason: 'light-wind' };
  // Μία ΙΔΑΝΙΚΗ αρκεί, όχι «οι περισσότερες»: η εντολή είναι «από καλές και πάνω», και ένα
  // κατώφλι ποσοστού εδώ θα ήταν δικός μας κανόνας πάνω σε δική του απόφαση.
  if (CALM_WATER_NEEDS_NO_IDEAL && hasIdeal) return { status: 'absent', reason: 'has-ideal' };
  if (beachIds.size === 0) return { status: 'absent', reason: 'none' };
  if (beachIds.size === entries.length) return { status: 'absent', reason: 'all' };

  return { status: 'offered', count: beachIds.size, beachIds };
};

/**
 * Η λέξη. «Ήρεμο νερό» και ΟΧΙ «Θάλασσα λάδι», αν και το δεύτερο ακούγεται καλύτερα: «θάλασσα
 * λάδι» είναι ήδη πιασμένη λέξη στην κάρτα και σημαίνει κάτι πιο αυστηρό (κάτω από 0,2 μ.,
 * utils/conditionsFeelPhrase.WAVE_GLASSY_M), ενώ το κατώφλι εδώ είναι 0,4 μ. Δανεικό όνομα από
 * διπλανή βαθμίδα σε διπλανή οθόνη = δύο πράγματα με το ίδιο όνομα.
 *
 * Ο υπότιτλος λέει ΤΙ μετρήθηκε, όχι πόσο καλό είναι — κανένα «ιδανική», «κατάλληλη»,
 * «καλύτερη» δεν επιτρέπεται εδώ, ίδιος κανόνας με το λεξιλόγιο της κάρτας.
 */
export interface CalmWaterCopy {
  label: string;
  hint: string;
  show: string;
  clear: string;
  droppedEmpty: string;
  droppedAll: string;
  droppedIdeal: string;
}

export const calmWaterFilterCopy: LocalizedCopy<CalmWaterCopy> = {
  en: {
    label: 'Calm water',
    hint: 'Wind is up, but the sea at these beaches is not',
    show: 'Show only these',
    clear: 'Show all beaches',
    droppedEmpty: 'Removed the “Calm water” filter — no beach has calm water at this hour.',
    droppedAll: 'Removed the “Calm water” filter — every beach has calm water at this hour.',
    droppedIdeal: 'Removed the “Calm water” filter — there are excellent beaches at this hour.',
  },
  gr: {
    label: 'Ήρεμο νερό',
    hint: 'Φυσάει, αλλά η θάλασσα σε αυτές δεν το δείχνει',
    show: 'Δείξε μόνο αυτές',
    clear: 'Δείξε όλες τις παραλίες',
    droppedEmpty: 'Αφαιρέθηκε το φίλτρο «Ήρεμο νερό» — αυτή την ώρα καμία παραλία δεν το έχει.',
    droppedAll: 'Αφαιρέθηκε το φίλτρο «Ήρεμο νερό» — αυτή την ώρα το έχουν όλες.',
    droppedIdeal: 'Αφαιρέθηκε το φίλτρο «Ήρεμο νερό» — αυτή την ώρα υπάρχουν ιδανικές παραλίες.',
  },
  de: {
    label: 'Ruhiges Wasser',
    hint: 'Es weht, aber das Meer an diesen Stränden bleibt ruhig',
    show: 'Nur diese anzeigen',
    clear: 'Alle Strände anzeigen',
    droppedEmpty: 'Filter „Ruhiges Wasser“ entfernt – zu dieser Stunde hat ihn kein Strand.',
    droppedAll: 'Filter „Ruhiges Wasser“ entfernt – zu dieser Stunde haben ihn alle.',
    droppedIdeal: 'Filter „Ruhiges Wasser“ entfernt – zu dieser Stunde gibt es ideale Strände.',
  },
  fr: {
    label: 'Eau calme',
    hint: 'Le vent souffle, mais pas la mer sur ces plages',
    show: 'Afficher uniquement celles-ci',
    clear: 'Afficher toutes les plages',
    droppedEmpty: 'Filtre « Eau calme » retiré — à cette heure, aucune plage ne l’a.',
    droppedAll: 'Filtre « Eau calme » retiré — à cette heure, toutes l’ont.',
    droppedIdeal: 'Filtre « Eau calme » retiré — à cette heure, il y a des plages idéales.',
  },
  it: {
    label: 'Acqua calma',
    hint: 'Il vento c’è, il mare su queste spiagge no',
    show: 'Mostra solo queste',
    clear: 'Mostra tutte le spiagge',
    droppedEmpty: 'Filtro «Acqua calma» rimosso — a quest’ora nessuna spiaggia ce l’ha.',
    droppedAll: 'Filtro «Acqua calma» rimosso — a quest’ora ce l’hanno tutte.',
    droppedIdeal: 'Filtro «Acqua calma» rimosso — a quest’ora ci sono spiagge ideali.',
  },
};

/** Το κατώφλι, εκτεθειμένο για τις πύλες ποιότητας ώστε να μην το ξαναγράψει κανείς. */
export const CALM_WATER_MAX_SHORE_M = FLAT_WATER_SEA_STATE_M;
