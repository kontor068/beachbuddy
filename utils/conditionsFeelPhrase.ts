import type { LanguageCode } from '../types';
import { getLocalizedCopy, type LocalizedCopy } from './i18n';
import { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, atDisplayedPrecisionM } from './waveCharacter';

/**
 * ΤΑ ΔΥΟ ΝΟΥΜΕΡΑ ΤΗΣ ΚΑΡΤΑΣ ΣΕ ΜΙΑ ΦΡΑΣΗ ΠΟΥ ΛΕΕΙ ΤΙ ΘΑ ΒΡΕΙΣ (Μίλτος, 14/08/2026).
 *
 * Η κάρτα τύπωνε «5 Μπφ | ~0,1 μ.» — δύο σωστά νούμερα που ο επισκέπτης πρέπει να μεταφράσει
 * μόνος του, και οι περισσότεροι δεν ξέρουν τι σημαίνει 5 Μπφ ούτε αν το 0,1 μ. είναι πολύ ή
 * λίγο. Το ΖΕΥΓΑΡΙ όμως λέει κάτι που κανένα από τα δύο νούμερα δεν λέει μόνο του: «φυσάει,
 * αλλά η θάλασσα μπροστά σου είναι λάδι». Αυτή ακριβώς η έκπληξη είναι ο λόγος ύπαρξης του
 * site — και μέχρι σήμερα ο αναγνώστης έπρεπε να τη συμπεράνει.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ: δεν είναι ετυμηγορία και δεν είναι χρώμα. Η κάρτα του βάθρου σιωπά
 * επίτηδες για το «καλή / κακή» (BeachCard.tsx:2048-2056 — «a NUMBER, never a verdict»· ο
 * χάρτης είναι η μόνη επιφάνεια που χρωματίζει, και δύο σκάλες αξιολόγησης είναι η κατηγορία
 * σφάλματος που το project πληρώνει ξανά και ξανά). Εδώ δεν κρίνεται τίποτα: περιγράφονται με
 * λέξεις τα ΙΔΙΑ δύο νούμερα που τυπώνονται από κάτω. Καμία λέξη «ιδανική», «απόφυγε»,
 * «κατάλληλη» δεν επιτρέπεται να μπει σε αυτό το λεξιλόγιο.
 *
 * ΠΟΙΟ ΚΥΜΑ ΠΕΡΙΓΡΑΦΕΙ: αυτό ΠΟΥ ΤΥΠΩΝΕΤΑΙ ΔΙΠΛΑ, δηλαδή το νερό στην ακτή. Όχι το
 * `seaStateSeverityM` (ύψος διορθωμένο για περίοδο), όσο κι αν είναι πιο «σωστό» ως αίσθηση
 * κολύμβησης: σε προστατευμένο όρμο η αυστηρότητα διαβάζει το ανοιχτό νερό και θα έγραφε
 * «μεγάλο κύμα» δίπλα στο «~0,1 μ.». Αυτή ακριβώς η αντίφαση —λέξη που δεν ταιριάζει με τον
 * αριθμό της— διορθώθηκε στις 13/08 και δεν ξαναμπαίνει από την πίσω πόρτα. Ο χαρακτηρισμός
 * της απότομης θάλασσας ζει στη σελίδα της παραλίας, όπου φαίνονται και τα δύο μεγέθη.
 *
 * ΤΑ ΚΑΤΩΦΛΙΑ ΤΟΥ ΚΥΜΑΤΟΣ ΔΕΝ ΕΙΝΑΙ ΔΙΚΑ ΤΟΥ: τα δύο πάνω έρχονται από το `waveCharacter`
 * (0,8 μ. = «κιτρινίζει», 1,2 μ. = «τραχιά»). Έτσι η λέξη δεν μπορεί να πει «λίγο κύμα» εκεί
 * όπου η μηχανή έχει ήδη κατεβάσει το ταβάνι της ημέρας.
 */

/** 0 = άπνοια … 4 = δυνατός άνεμος. Ίδια κλίμακα με το κύμα, ώστε να συγκρίνονται. */
export type WindFeelLevel = 0 | 1 | 2 | 3 | 4;
/** 0 = λάδι … 4 = μεγάλο κύμα. */
export type WaveFeelLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Πάνω από αυτή τη διαφορά επιπέδων τα δύο μισά της φράσης ΔΙΑΦΩΝΟΥΝ, οπότε μπαίνει «αλλά».
 * Δύο σκαλιά, όχι ένα: «Αρκετός αέρας, λίγο κύμα» είναι μια κανονική μέρα και δεν θέλει
 * έμφαση· «Πολύς αέρας αλλά θάλασσα λάδι» είναι η πληροφορία για την οποία μπήκε ο κόσμος.
 */
const CONTRAST_GAP = 2;

/**
 * ⚠️ ΤΟ «ΑΛΛΑ» ΕΙΝΑΙ ΑΝΑΚΟΥΦΙΣΗ, ΚΑΙ Η ΑΝΑΚΟΥΦΙΣΗ ΕΧΕΙ ΤΑΒΑΝΙ.
 *
 * «Πολύς αέρας αλλά θάλασσα λάδι» διαβάζεται ως καλά νέα, και στα 5 Μποφόρ είναι: ο αέρας
 * ενοχλεί, το νερό δεν έχει κύμα. Στα 6+ όμως ο χάρτης βάφει την παραλία κόκκινη, και μια
 * κάρτα που ακούγεται καθησυχαστική δίπλα σε κόκκινη πινέζα είναι η αντίφαση που το project
 * κυνηγάει από τον Ιούλιο. Το γεγονός δεν αλλάζει — η θάλασσα ΟΝΤΩΣ είναι λάδι — αλλάζει ο
 * σύνδεσμος: «Δυνατός αέρας, θάλασσα λάδι». Μονόδρομη πύλη, όπως όλες οι πύλες της βίβλου:
 * μπορεί να αφαιρέσει ανακούφιση, ποτέ να την προσθέσει.
 */
const RELIEF_MAX_BEAUFORT = 5;

/** Κάτω από 0,2 μ. δεν υπάρχει κύμα να περιγραφεί· 0,4 μ. είναι το «το νιώθεις μόλις». */
const WAVE_GLASSY_M = 0.2;
const WAVE_TINY_M = 0.4;

/**
 * Η ΛΕΞΗ ΚΡΙΝΕΤΑΙ ΣΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ, ΟΧΙ ΣΤΟ ΑΣΤΡΟΓΓΥΛΕΥΤΟ (02/09/2026, Αρίλλα
 * Θεσπρωτίας #890).
 *
 * ΤΙ ΕΓΙΝΕ. 15:00, ο Μίλτος στην άμμο: ελαφρύ κυματάκι που σκάει σε λευκή γραμμή, «λάδι δεν το
 * λες». Η κάρτα: «θάλασσα λάδι». Η σελίδα: «0,2 μ.». Και τα δύο έβγαιναν από τον ΙΔΙΟ αριθμό —
 * κάτι ανάμεσα σε 0,15 και 0,199: το κείμενο τον στρογγύλευε σε «0,2» (`toFixed(1)` στο
 * beachConditionsReadout / BeachAnswerHero), η βαθμίδα εδώ τον διάβαζε ωμό και έπεφτε κάτω από το
 * 0,2. Ο επισκέπτης έβλεπε «0,2 μ. · θάλασσα λάδι», ενώ το 0,2 είναι ακριβώς το σκαλί της
 * «σχεδόν χωρίς κύμα». Ο αριθμός δεν έσφαλε· η λέξη διέψευδε τον αριθμό δίπλα της — το ίδιο
 * είδος λάθους με τη Λυγιά (25/08, «0,0 μ.») και τη Συκιά (27/08).
 *
 * Ο ΚΑΝΟΝΑΣ. Η βαθμίδα κρίνεται στην ακρίβεια της οθόνης (`atDisplayedPrecisionM`, βήμα 0,1) —
 * όπως ήδη έκρινε η πύλη άφιξης από κάτω (27/08) και όπως κρίνουν χρώμα και ετυμηγορία. Με
 * κατώφλια που είναι πολλαπλάσια του 0,1, η στρογγυλοποίηση δεν κατεβάζει ποτέ βαθμίδα: μια
 * τιμή ≥ κατωφλίου μένει ≥ κατωφλίου. Ανεβάζει ΜΟΝΟ τις τιμές στα 0,05 μ. κάτω από κάθε
 * κατώφλι (0,15–0,199 · 0,35–0,399 · 0,75–0,799 · 1,15–1,199) κατά ένα σκαλί — μονόδρομη
 * προς την προσοχή, όπως κάθε πύλη της βίβλου. Ο τυπωμένος αριθμός, το χρώμα, η ετυμηγορία
 * και η κατάταξη δεν αλλάζουν.
 *
 * ΑΠΟΤΥΠΩΜΑ: scripts/measureWaveWordRounding.mjs (εθνικά, από τις ίδιες cache ημέρας με το
 * measureWaveWordArrivalGate). Η ΠΥΛΗ: scripts/validateConditionsFeelPhrase.ts — η λέξη δεν
 * επιτρέπεται να διαψεύδει το νούμερο που τυπώνεται από κάτω της, ούτε κατά ένα εκατοστό.
 */
export const waveFeelLevel = (metres: number): WaveFeelLevel => {
  const printed = atDisplayedPrecisionM(metres) ?? metres;
  if (printed < WAVE_GLASSY_M) return 0;
  if (printed < WAVE_TINY_M) return 1;
  if (printed < SEA_STATE_AMBER_M) return 2;
  if (printed < SEA_STATE_ROUGH_M) return 3;
  return 4;
};

/**
 * Η ΛΕΞΗ «ΣΧΕΔΟΝ ΧΩΡΙΣ ΚΥΜΑ» ΚΟΙΤΑΕΙ ΑΝ ΤΟ ΚΥΜΑ ΠΕΦΤΕΙ ΚΑΤΑΜΟΥΤΡΑ (27/08/2026, Συκιά Σιθωνίας #445).
 *
 * ΤΙ ΕΓΙΝΕ. 13:00, η σελίδα έγραφε «0,3 μ. · Λίγος αέρας, σχεδόν χωρίς κύμα» και ο επισκέπτης
 * έγραψε «είχε παραπάνω κύμα απ' όσο δείχνατε». Ο αριθμός ήταν σωστός — ewam 0,28 μ., ίδιο σε
 * κάθε μοντέλο. Η ΛΕΞΗ όχι: το κύμα ερχόταν από 77° σε ακτή που βλέπει 77,6°, δηλαδή ευθεία
 * πάνω της, μέσα από ανοιχτό τομέα 15 χλμ, με κοντή περίοδο, σε ρηχή άμμο. 0,3 μ. ανοιχτά που
 * πέφτει ευθεία σε ρηχό πυθμένα σκάει στην ακτή σαν 0,3–0,5 μ. — «κύμα» για όποιον στέκεται
 * στο νερό. Η βαθμίδα 0,2–0,4 δεν κοιτούσε ΠΟΥΘΕΝΑ αν το κύμα πέφτει πάνω στην παραλία ή την
 * προσπερνάει — ενώ η εφαρμογή το ξέρει (utils/seaArrival.resolveSeaArrivalExposureLevel) και
 * το χρησιμοποιεί ήδη για την έκπτωση της ακτής (§Γ59, K_d).
 *
 * Ο ΚΑΝΟΝΑΣ. Στη βαθμίδα «σχεδόν χωρίς κύμα», όταν ΚΑΙ ο τυπωμένος αριθμός είναι «0,3»+ (στην
 * ακρίβεια της οθόνης — atDisplayedPrecisionM, όπως κρίνουν χρώμα και ετυμηγορία) ΚΑΙ η άφιξη
 * είναι 'exposed' (κατάμουτρα, από ανοιχτό τομέα), η λέξη ανεβαίνει ΕΝΑ σκαλί: «λίγο κύμα».
 * Μονόδρομη πύλη — αφαιρεί ηρεμία, ποτέ δεν την προσθέτει. Σιωπά σε 'partial', 'protected',
 * ξυστά (SEA_ARRIVAL_GRAZING), undefined («δεν έρχεται πάνω») και 'unknown': κανόνας που κρίνει
 * σε άγνωστα δεδομένα δεν μπαίνει. Αριθμός, χρώμα, ετυμηγορία, κατάταξη: αμετάβλητα.
 *
 * ΓΙΑΤΙ «0,3»+ ΚΑΙ ΟΧΙ ΟΛΗ Η ΒΑΘΜΙΔΑ — ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΜΠΕΙ (scripts/measureWaveWordArrivalGate.mjs,
 * 2.766 παραλίες × 3 ημέρες μελτεμιού, 91.179 ώρες-παραλίας, reports/weather/
 * wave-word-arrival-gate-2026-08-27.json): όλη η βαθμίδα θα γύριζε 7,6% όλων των ωρών, το «0,3»+
 * 5,4% — μέσα στη ζώνη 5-15% που το σπίτι θεωρεί «πληροφορία, όχι ταπετσαρία», και ακριβώς η
 * στιγμή που η οθόνη ΗΔΗ γράφει «0,3 μ.» δίπλα σε «σχεδόν χωρίς κύμα». Η εναλλακτική «λεξιλογίου»
 * (κατώφλι 0,4→0,3 χωρίς άφιξη) απορρίφθηκε: 18% των ωρών, και το 70% από αυτές θάλασσα που
 * περνάει ξυστά — θα έλεγε «λίγο κύμα» στη Φυριπλάκα με 0,34 από τα πλάγια. Μάρτυρες: Συκιά
 * 12:00-13:00 γυρίζει· Φυριπλάκα #1927 (partial/ξυστά) και Γλυφάδα #1993 (ξυστά) κρατούν.
 * Η κατανομή των λέξεων (λάδι 21% · σχεδόν χωρίς 27% · λίγο 32% · αρκετό 12% · μεγάλο 9%)
 * είναι ισορροπημένη — το λεξιλόγιο δεν ήταν το πρόβλημα, η τυφλότητά του στην άφιξη ήταν.
 *
 * Η ΠΥΛΗ: scripts/validateConditionsFeelPhrase.ts ξαναπαίζει Συκιά και Φυριπλάκα ΚΑΙ μέσα από
 * το beachConditionsReadout (η διαδρομή της κάρτας), ώστε το πεδίο να μη χαθεί στον δρόμο όπως
 * χάθηκε το windShadow (§6, 27/08).
 */
export const WAVE_WORD_ARRIVAL_GATE_MIN_PRINTED_M = 0.3;

export const waveFeelLevelWithArrival = (
  metres: number,
  seaArrivalExposureLevel: string | undefined | null
): WaveFeelLevel => {
  const base = waveFeelLevel(metres);
  if (base !== 1 || seaArrivalExposureLevel !== 'exposed') return base;
  const printed = atDisplayedPrecisionM(metres);
  if (typeof printed !== 'number' || printed < WAVE_WORD_ARRIVAL_GATE_MIN_PRINTED_M) return base;
  return 2;
};

export const windFeelLevel = (beaufort: number): WindFeelLevel => {
  if (beaufort <= 2) return 0;
  if (beaufort === 3) return 1;
  if (beaufort === 4) return 2;
  if (beaufort === 5) return 3;
  return 4;
};

type FeelVocabulary = {
  /** Πρώτο μισό — ΞΕΚΙΝΑ τη φράση, άρα κεφαλαίο αρχικό. */
  wind: [string, string, string, string, string];
  /** Δεύτερο μισό — ακολουθεί, άρα πεζό αρχικό. */
  wave: [string, string, string, string, string];
  /** Μπαίνει ΑΝΑΜΕΣΑ στα δύο μισά όταν συμφωνούν. Περιέχει το δικό του κενό/κόμμα. */
  join: string;
  /** Το ίδιο, όταν διαφωνούν. */
  joinContrast: string;
};

/**
 * Οι λέξεις είναι σκόπιμα καθημερινές — «θάλασσα λάδι», όχι «ήπιος κυματισμός». Το τεχνικό
 * λεξιλόγιο («Λίγος κυματισμός», «Έντονος κυματισμός») υπάρχει ήδη στο WaveHeightGraphic για
 * τη σελίδα της παραλίας· εδώ μιλάμε σε κάποιον που κοιτάζει έξι κάρτες στο τηλέφωνο.
 *
 * ΙΔΙΕΣ ΛΕΞΕΙΣ ΜΕ ΤΗ ΛΕΖΑΝΤΑ ΤΟΥ ΧΑΡΤΗ (`utils/conditionToneLabels`), που κάθεται 400 px πιο
 * πάνω στην ίδια οθόνη: «Δυνατός αέρας», «μεγάλο κύμα», «Λίγος αέρας», «Strong wind», «big
 * waves», «hohe Wellen», «grosses vagues», «onde alte». Δύο συνώνυμα για το ίδιο πράγμα σε
 * μία οθόνη διαβάζονται ως δύο διαφορετικά πράγματα — αν αλλάξει η λεζάντα, αλλάζει κι εδώ.
 */
const FEEL_VOCABULARY: LocalizedCopy<FeelVocabulary> = {
  en: {
    wind: ['No wind', 'Light wind', 'Some wind', 'Windy', 'Strong wind'],
    wave: ['flat water', 'almost no waves', 'small waves', 'noticeable waves', 'big waves'],
    join: ', ',
    joinContrast: ' but ',
  },
  gr: {
    wind: ['Χωρίς αέρα', 'Λίγος αέρας', 'Αρκετός αέρας', 'Πολύς αέρας', 'Δυνατός αέρας'],
    wave: ['θάλασσα λάδι', 'σχεδόν χωρίς κύμα', 'λίγο κύμα', 'αρκετό κύμα', 'μεγάλο κύμα'],
    join: ', ',
    joinContrast: ' αλλά ',
  },
  fr: {
    // Η ανώτατη βαθμίδα λέει «Vent fort» επειδή αυτό λέει και η κόκκινη λεζάντα του χάρτη·
    // ένα «Vent très fort» από πάνω της θα ακουγόταν χειρότερο από το χρώμα που το συνοδεύει.
    wind: ['Pas de vent', 'Vent léger', 'Vent modéré', 'Vent soutenu', 'Vent fort'],
    wave: ['mer d’huile', 'presque pas de vagues', 'petites vagues', 'vagues sensibles', 'grosses vagues'],
    join: ', ',
    joinContrast: ' mais ',
  },
  de: {
    wind: ['Windstill', 'Wenig Wind', 'Etwas Wind', 'Viel Wind', 'Starker Wind'],
    wave: ['glatte See', 'kaum Wellen', 'kleine Wellen', 'spürbare Wellen', 'hohe Wellen'],
    join: ', ',
    // Στα γερμανικά το «aber» θέλει κόμμα πριν από αυτό, όχι μόνο κενό.
    joinContrast: ', aber ',
  },
  it: {
    wind: ['Niente vento', 'Poco vento', 'Vento moderato', 'Molto vento', 'Vento forte'],
    wave: ['mare piatto', 'quasi senza onde', 'onde piccole', 'onde evidenti', 'onde alte'],
    join: ', ',
    joinContrast: ' ma ',
  },
};

export interface ConditionsFeelInput {
  /** Τα μποφόρ ΤΗΣ ΠΑΡΑΛΙΑΣ — ό,τι διάβασε και η πινέζα, όχι της περιοχής. */
  beaufort: number;
  /**
   * Το άνω άκρο του ΤΥΠΩΜΕΝΟΥ εύρους («5–6 Μπφ»), όταν η επιφάνεια δείχνει εύρος
   * (utils/beaufortRange, ενεργό από 27/08/2026). Κρίνει ΜΟΝΟ το ταβάνι της ανακούφισης:
   * το «αλλά» δεν λέγεται δίπλα σε τυπωμένο 6, ακόμα κι αν ο μέσος είναι 5 (Γάνεμα #2078,
   * 27/08 — ίδια μέρα και ίδιο σχήμα με το ταβάνι της «απάνεμης» στο BeachAnswerHero).
   * Οι ΛΕΞΕΙΣ μένουν στον μέσο: «Πολύς αέρας» για μέσο 5 είναι σωστό, ο σύνδεσμος όχι.
   */
  beaufortHigh?: number | null;
  /** Το ύψος που ΤΥΠΩΝΕΤΑΙ δίπλα στη φράση. Χωρίς αυτό η φράση μιλά μόνο για τον αέρα. */
  waveM?: number;
  /**
   * Από πού έρχεται η θάλασσα πάνω στην ακτή — `BeachScore.seaArrivalExposureLevel`
   * (utils/seaArrival). Διαβάζεται ΜΟΝΟ από το waveFeelLevelWithArrival (δες εκεί). Παραλείπεται =
   * η λέξη κρίνεται όπως πριν τις 27/08/2026 — καμία επιφάνεια δεν γίνεται πιο ήρεμη αν το ξεχάσει.
   */
  seaArrivalExposureLevel?: string | null;
  language: LanguageCode;
}

export interface ConditionsFeel {
  /** Η έτοιμη φράση, π.χ. «Πολύς αέρας αλλά θάλασσα λάδι». */
  phrase: string;
  /** Το πρώτο μισό μόνο του, π.χ. «Δυνατός αέρας» — για όταν κάθε μισό μπαίνει πάνω από το ΔΙΚΟ
   *  του νούμερο αντί για μία ενιαία γραμμή πάνω από τα δύο (BeachCard.tsx, mobile «why» row). */
  windWord: string;
  /** Το δεύτερο μισό μόνο του, με κεφαλαίο αρχικό — στη φράση ξεκινά πεζό γιατί ακολουθεί τον
   *  αέρα, αλλά εδώ στέκεται μόνο του πάνω από το κύμα, άρα θέλει κεφαλαίο σαν να ξεκινά αυτό. */
  waveWord?: string;
  windLevel: WindFeelLevel;
  waveLevel?: WaveFeelLevel;
  /**
   * ΤΟ ΓΕΓΟΝΟΣ: τα δύο νούμερα δείχνουν σε αντίθετες κατευθύνσεις. Ανεξάρτητο από τον τόνο —
   * ένας θυελλώδης αέρας πάνω από επίπεδο νερό αποκλίνει εξίσου με έναν μέτριο.
   *
   * Αυτό διαβάζει η σελίδα της παραλίας για να αποφασίσει ΑΝ θα γράψει τη γραμμή. Στην πρώτη
   * έκδοση διάβαζε το `contrast` και ο Φάραγγας (6 Μπφ, 0,1 μ.) έμενε σιωπηλός: το ταβάνι που
   * υπάρχει για να ΜΗΝ ακούγεται ανακουφιστικός ο τόνος είχε αρχίσει να κρύβει την πληροφορία.
   */
  divergent: boolean;
  /**
   * Ο ΤΟΝΟΣ: μπήκε «αλλά» αντί για κόμμα. Πάντα `divergent && τυπωμένο-μέγιστο <= RELIEF_MAX_BEAUFORT`
   * (το τυπωμένο μέγιστο είναι το άνω άκρο του εύρους αν δόθηκε, αλλιώς ο μέσος).
   */
  contrast: boolean;
  /** Η λέξη του κύματος ανέβηκε ένα σκαλί επειδή το κύμα πέφτει κατάμουτρα (waveFeelLevelWithArrival). */
  waveWordLiftedByArrival: boolean;
}

export const buildConditionsFeel = ({ beaufort, beaufortHigh, waveM, seaArrivalExposureLevel, language }: ConditionsFeelInput): ConditionsFeel | null => {
  if (!Number.isFinite(beaufort)) return null;
  const vocabulary = getLocalizedCopy(language, FEEL_VOCABULARY);
  const windLevel = windFeelLevel(Math.max(0, Math.round(beaufort)));
  const windWord = vocabulary.wind[windLevel];

  if (typeof waveM !== 'number' || !Number.isFinite(waveM)) {
    return { phrase: windWord, windWord, windLevel, divergent: false, contrast: false, waveWordLiftedByArrival: false };
  }

  const waveLevel = waveFeelLevelWithArrival(Math.max(0, waveM), seaArrivalExposureLevel);
  const waveWordLiftedByArrival = waveLevel !== waveFeelLevel(Math.max(0, waveM));
  const waveWordRaw = vocabulary.wave[waveLevel];
  const waveWord = waveWordRaw.charAt(0).toUpperCase() + waveWordRaw.slice(1);
  const divergent = Math.abs(windLevel - waveLevel) >= CONTRAST_GAP;
  // Το ταβάνι της ανακούφισης κρίνεται στον ΜΕΓΑΛΥΤΕΡΟ τυπωμένο αριθμό — δες ConditionsFeelInput.
  const printedBeaufortMax = Math.max(beaufort, typeof beaufortHigh === 'number' && Number.isFinite(beaufortHigh) ? beaufortHigh : beaufort);
  const contrast = divergent && printedBeaufortMax <= RELIEF_MAX_BEAUFORT;
  const join = contrast ? vocabulary.joinContrast : vocabulary.join;
  return {
    phrase: `${windWord}${join}${waveWordRaw}`,
    windWord,
    waveWord,
    windLevel,
    waveLevel,
    divergent,
    contrast,
    waveWordLiftedByArrival,
  };
};
