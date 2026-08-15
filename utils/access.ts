import { Accessibility, Beach } from '../types';

const normalizeAccessText = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type AccessSource = {
  metadata?: Beach['metadata'];
  accessNotes?: Beach['accessNotes'];
};

const DIRT_ROAD_WORDS = /χωματοδρομ|dirt road|gravel road|unpaved|sterrato|piste/;

/**
 * Μια πρόταση που λέει «ΔΕΝ το ξέρουμε», όχι «δεν περνάει».
 *
 * Επίτηδες στενή: σκέτο «δεν» θα έκοβε και το «ο χωματόδρομος **δεν** είναι βατός με χαμηλό
 * αυτοκίνητο», που είναι **βεβαίωση** δρόμου και πρέπει να φτάσει στον επισκέπτη.
 */
const DENIES_KNOWLEDGE = /δεν υπαρχει|δεν υπαρχουν|δεν εχει καταγραφει|χωρις ενδειξη|χωρις πηγη|no source|not supported|no evidence/;

/**
 * ΓΙΑΤΙ ΔΙΑΒΑΖΕΤΑΙ ΠΡΟΤΑΣΗ-ΠΡΟΤΑΣΗ ΚΑΙ ΟΧΙ ΟΛΟ ΤΟ ΚΕΙΜΕΝΟ ΜΑΖΙ — 15/08/2026.
 *
 * Η συνάρτηση έψαχνε τη λέξη «χωματόδρομ» σε **όλο** το ελεύθερο κείμενο ενωμένο σε ένα string.
 * Το δικό μας τυποποιημένο σημείωμα «**Δεν** υπάρχει ακόμη source-backed ένδειξη για
 * **χωματόδρομο**, μονοπάτι ή εύκολη οδική πρόσβαση» περιέχει τη λέξη μέσα σε άρνηση — οπότε η
 * κάρτα τύπωνε «Χωματόδρομος» ακριβώς εκεί που λέγαμε ότι **δεν ξέρουμε αν υπάρχει δρόμος**.
 * Το `isDirtRoad` υπερισχύει του `access.type` στο `BeachCard`, άρα έσβηνε και τη σωστή ταμπέλα.
 *
 * Μετρημένο εθνικά πριν την αλλαγή (2.914 παραλίες): **311** έδειχναν «Χωματόδρομος» χωρίς να το
 * δηλώνουν — 267 `unknown`, 18 `hiking_path_easy`, 15 `hiking_path_difficult`, 5 `asphalt_road`,
 * 4 `4x4_only`, 1 `difficult_road` και **1 `boat_only`** (παραλία που πάει μόνο με βάρκα).
 * Μετά: **259 σταματούν**, **0 νέες αρχίζουν**, και **καμία** από τις 259 δεν είχε κείμενο πέρα
 * από το αντιγραμμένο σημείωμα άρνησης — δηλαδή δεν χάθηκε ούτε μία γνήσια προειδοποίηση.
 * Οι ~48 που όντως περιγράφουν χωματόδρομο ενώ ο τύπος τους λέει μονοπάτι/άσφαλτο **κρατούν**
 * την ταμπέλα: εκεί το κείμενο βεβαιώνει, δεν αρνείται.
 */
export const hasDirtRoadAccess = (beach: AccessSource): boolean => {
  const access = beach.metadata?.access;

  if (access?.type === 'passable_dirt_road' || access?.type === 'difficult_dirt_road') return true;

  // Ο τύπος κρίθηκε ήδη παραπάνω· εδώ μένει μόνο το κείμενο που γράφτηκε από άνθρωπο.
  return [access?.label, access?.notes, beach.accessNotes?.gr, beach.accessNotes?.en].some(field => (
    normalizeAccessText(field)
      .split(/[.!;·\n]+/)
      .some(sentence => DIRT_ROAD_WORDS.test(sentence) && !DENIES_KNOWLEDGE.test(sentence))
  ));
};

export const hasBoatOnlyAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => (
  beach.accessibility === Accessibility.BOAT_ONLY || beach.metadata?.access?.type === 'boat_only'
);

export const hasChallengingAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => (
  beach.accessibility === Accessibility.DIFFICULT ||
  beach.metadata?.access?.type === 'difficult_dirt_road' ||
  beach.metadata?.access?.type === '4x4_only' ||
  beach.metadata?.access?.type === 'hiking_path_difficult'
);

export const hasDifficultTopPickAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => (
  hasBoatOnlyAccess(beach) || hasChallengingAccess(beach)
);

export const isAdventureBeach = (
  beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes' | 'environment'>
): boolean => {
  const isRemote = Boolean(beach.environment?.remote || beach.metadata?.environment?.remote);

  return Boolean(
    isRemote ||
    hasBoatOnlyAccess(beach) ||
    hasChallengingAccess(beach) ||
    (hasDirtRoadAccess(beach) && isRemote)
  );
};

export const hasPracticalTopPickAccess = (beach: Pick<Beach, 'accessibility' | 'metadata'>): boolean => {
  if (hasDifficultTopPickAccess(beach)) return false;

  const accessType = beach.metadata?.access?.type;
  return (
    accessType === 'asphalt_road' ||
    accessType === 'passable_dirt_road' ||
    accessType === 'hiking_path_easy' ||
    (!accessType && (beach.accessibility === Accessibility.EASY || beach.accessibility === Accessibility.MODERATE))
  );
};

export const hasMainstreamTopPickAccess = (
  beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes' | 'environment'>
): boolean => (
  !Boolean(beach.environment?.remote || beach.metadata?.environment?.remote) &&
  hasTrulyEasyAccess(beach)
);

/**
 * ΤΙ ΑΚΡΙΒΩΣ ΚΡΑΤΑΕΙ ΑΥΤΗ ΤΗΝ ΠΑΡΑΛΙΑ ΕΞΩ ΑΠΟ ΤΟ «ΕΥΚΟΛΑ» — Μίλτος, 14/08/2026.
 *
 * Μέχρι σήμερα υπήρχε **ένας** λόγος («access») και **μία** πρόταση: «Θέλει σκάφος ή δύσκολο
 * μονοπάτι». Το `hasMainstreamTopPickAccess` όμως κόβει πολύ περισσότερα από σκάφη και μονοπάτια:
 * κάθε χωματόδρομο, κάθε εύκολο περπάτημα, κάθε άγνωστο τύπο δρόμου, κάθε «απομακρυσμένη».
 * Μετρημένο εθνικά στις 14/08 από την ίδια την πύλη, πάνω στα canonical region files (2.860
 * παραλίες): **1.380** έπαιρναν τη λεζάντα και **1.000** από αυτές δεν ήθελαν ούτε σκάφος ούτε
 * δύσκολο μονοπάτι — 575 χωματόδρομος, 213 περπάτημα, 212 άγνωστος δρόμος (ανάμεσά τους αστικές
 * σαν το Άλιμος Λουτρά). Σωστά τη φορούσαν μόνο 380.
 *
 * Ο διαχωρισμός ζει ΕΔΩ και όχι στο κείμενο, ώστε η λεζάντα να μην μπορεί ποτέ ξανά να περιγράψει
 * άλλο πράγμα από αυτό που έκρινε το φίλτρο: ίδιο αρχείο, ίδια predicates, μία απόφαση.
 *
 * `unknown` σημαίνει «δεν το έχουμε ελέγξει», ΟΧΙ «είναι κακό» — γι' αυτό είναι δικός του κάδος
 * και το κείμενό του μιλάει για τα δικά ΜΑΣ κενά, όπως ήδη κάνει το `unverified`.
 */
export type HardAccessKind = 'boat_or_hard_path' | 'dirt_road' | 'walk' | 'unknown';

export const getHardAccessKind = (
  beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes' | 'environment'>
): HardAccessKind | null => {
  if (hasMainstreamTopPickAccess(beach)) return null;
  if (hasDifficultTopPickAccess(beach)) return 'boat_or_hard_path';

  /**
   * Διαβάζεται ως σκέτο string ΕΠΙΤΗΔΕΣ: το `BeachAccessType` (types.ts:28) έχει 8 τιμές, αλλά τα
   * δεδομένα κουβαλούν και `boat_or_road`, `boat_or_difficult_path`, `difficult_road`,
   * `walking_path_easy` — τιμές εκτός συμβολαίου σε ~16 παραλίες, που ο TypeScript δηλώνει
   * αδύνατες και άρα δεν θα τις σύγκρινε ποτέ. Μια λεζάντα που εμπιστεύεται τον τύπο αντί για τα
   * δεδομένα θα τις έστελνε σιωπηλά στον λάθος κάδο.
   */
  const accessType: string = beach.metadata?.access?.type ?? '';
  // Δύο τύποι που ΓΡΑΦΟΥΝ «σκάφος» μέσα στο όνομά τους: μένουν στην αυστηρή φράση.
  if (accessType === 'boat_or_road' || accessType === 'boat_or_difficult_path') return 'boat_or_hard_path';
  if (hasDirtRoadAccess(beach) || accessType === 'difficult_road') return 'dirt_road';
  if (/path/.test(accessType)) return 'walk';
  // Άσφαλτος ή δηλωμένα εύκολη, που έμεινε έξω μόνο επειδή είναι απομακρυσμένη: το περπάτημα
  // είναι η πιο κοντινή αλήθεια που μπορούμε να πούμε χωρίς να επινοήσουμε δρόμο.
  if (accessType === 'asphalt_road' || (!accessType && beach.accessibility === Accessibility.EASY)) return 'walk';

  return 'unknown';
};

export const hasTrulyEasyAccess = (beach: Pick<Beach, 'accessibility' | 'metadata' | 'accessNotes'>): boolean => {
  if (hasDirtRoadAccess(beach)) return false;
  if (hasBoatOnlyAccess(beach) || hasChallengingAccess(beach)) return false;
  if (beach.metadata?.access?.type === 'hiking_path_easy') return false;
  return beach.metadata?.access?.type === 'asphalt_road' || (
    beach.accessibility === Accessibility.EASY && !beach.metadata?.access?.type
  );
};
