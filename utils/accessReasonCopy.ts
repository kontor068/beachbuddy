import { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from './i18n';
import type { HardAccessKind } from './access';

/**
 * Η ΛΕΖΑΝΤΑ ΠΡΟΣΒΑΣΗΣ, ΣΕ ΔΙΚΟ ΤΗΣ ΑΡΧΕΙΟ — Μίλτος, 14/08/2026.
 *
 * Ζούσε μέσα στο `BeachSearcherHome`, και γι' αυτό ήταν αδύνατο να ελεγχθεί από πύλη: κανένα
 * script δεν μπορεί να φορτώσει ένα component 5.000 γραμμών για να διαβάσει πέντε προτάσεις.
 * Έτσι έμεινε επί μήνες μία πρόταση — «Θέλει σκάφος ή δύσκολο μονοπάτι» — πάνω σε **1.000 από τις
 * 1.380** παραλίες που την έπαιρναν και δεν ήθελαν τίποτα από τα δύο (μετρημένο 14/08 από την ίδια
 * την πύλη: 575 χωματόδρομος, 213 περπάτημα, 212 άγνωστος δρόμος).
 *
 * Εδώ είναι ελέγξιμη: `scripts/validateAccessReasonCopy.mjs` τρέχει ΑΥΤΕΣ τις προτάσεις μαζί με
 * το ΠΡΑΓΜΑΤΙΚΟ `getHardAccessKind` πάνω σε κάθε παραλία της χώρας, σε κάθε γλώσσα.
 *
 * ΔΥΟ ΚΑΝΟΝΕΣ, και οι δύο τηρούνται από την πύλη:
 *
 * 1. **Κάθε πρόταση ονομάζει ιδιότητα ΤΗΣ ΠΑΡΑΛΙΑΣ, ποτέ τη δική μας λίστα.** Η παλιά έκλεινε με
 *    «γι' αυτό μπαίνει μετά τις εύκολες» — δήλωση για την κατάταξή μας, και λανθασμένη: η λίστα
 *    ταξινομείται **χρώμα πρώτα** (`utils/suitabilityTone.selectSuitableByTone`, απόφαση 10/08)
 *    και η πρόσβαση κρίνει μόνο ΜΕΣΑ στο ίδιο χρώμα. Περιέγραφε τον κανόνα του ΒΑΘΡΟΥ ενώ
 *    τυπωνόταν στη ΛΙΣΤΑ.
 * 2. **Η λέξη «σκάφος» μόνο όπου χρειάζεται σκάφος.** Σε καμία από τις πέντε γλώσσες δεν
 *    επιτρέπεται να φτάσει σε παραλία με χωματόδρομο, μονοπάτι ή άγνωστο δρόμο.
 */
export const ACCESS_REASON_COPY: Record<Exclude<HardAccessKind, 'unknown'>, LocalizedCopy<string>> = {
  boat_or_hard_path: {
    en: 'It needs a boat or a hard path.',
    gr: 'Θέλει σκάφος ή δύσκολο μονοπάτι.',
    de: 'Nur per Boot oder über einen schwierigen Weg erreichbar.',
    fr: 'Accès en bateau ou par sentier difficile.',
    it: 'Serve una barca o un sentiero difficile.',
  },
  dirt_road: {
    en: 'The road in is unpaved.',
    gr: 'Ο δρόμος της είναι χωματόδρομος.',
    de: 'Die Zufahrt ist eine Schotterpiste.',
    fr: "L'accès se fait par une piste en terre.",
    it: 'La strada di accesso è sterrata.',
  },
  walk: {
    en: 'It needs a short walk.',
    gr: 'Θέλει λίγο περπάτημα.',
    de: 'Ein kurzes Stück zu Fuß.',
    fr: 'Il faut marcher un peu.',
    it: 'Serve una breve camminata.',
  },
};

/**
 * ΣΙΩΠΗ ΓΙΑ ΤΟΝ ΑΓΝΩΣΤΟ ΔΡΟΜΟ — ίδιο σκεπτικό με το `unverified`, που σώπασε 10/08/2026.
 *
 * Αυτή η περίπτωση μιλάει για ΕΜΑΣ («δεν έχουμε ελέγξει τον δρόμο της»), όχι για την παραλία, και
 * ο αναγνώστης δεν μπορεί να κάνει τίποτα με αυτό. Αφορά 212 παραλίες — ανάμεσά τους αστικές σαν
 * το Άλιμος Λουτρά, όπου η παλιά λεζάντα ήταν και ψευδής και γελοία. Το να μην πούμε τίποτα είναι
 * καλύτερο από μια δικαιολογία στη θέση της.
 */
export const getAccessReasonCopy = (kind: HardAccessKind, language: LanguageCode): string => {
  if (kind === 'unknown') return '';
  return getLocalizedCopy(language, ACCESS_REASON_COPY[kind]);
};
