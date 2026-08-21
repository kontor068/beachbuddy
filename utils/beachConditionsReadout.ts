import type { LanguageCode } from '../types';
import { getBeaufortLevel } from './weatherUtils';
import {
  seaStateSeverityM, choppinessFactor, SEA_STATE_AMBER_M,
} from './waveCharacter';
import { buildConditionsFeel, type ConditionsFeel } from './conditionsFeelPhrase';

/**
 * ΕΝΑΣ ΑΝΕΜΟΣ ΚΑΙ ΜΙΑ ΘΑΛΑΣΣΑ ΓΙΑ ΜΙΑ ΠΑΡΑΛΙΑ — ΥΠΟΛΟΓΙΣΜΕΝΑ ΜΙΑ ΦΟΡΑ (20/08/2026).
 *
 * Το ζευγάρι «5 Μπφ · ~0,1 μ.» ζούσε μέσα στο BeachCard, γραμμές 1258-1360. Από σήμερα το
 * ίδιο ζευγάρι τυπώνεται ΚΑΙ πάνω στον χάρτη, όταν ο επισκέπτης πατήσει μια πινέζα. Δύο
 * αντίγραφα του ίδιου κανόνα σε δύο επιφάνειες είναι ακριβώς η κατηγορία σφάλματος που η
 * βίβλος καταγράφει ως §Κ1 και που γέννησε την πύλη «κάρτα vs πινέζα» (§Γ27, 20/08/2026):
 * η λέξη της κάρτας και το χρώμα της πινέζας έβγαιναν από δύο μηχανές και καμία πύλη δεν τις
 * αντιπαρέβαλλε. Δεν ανοίγει δεύτερη τέτοια πληγή για τα ΝΟΥΜΕΡΑ.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ: δεν είναι ετυμηγορία, δεν είναι χρώμα, δεν είναι βαθμολογία. Δεν αγγίζει
 * κανένα κατώφλι του `utils/suitabilityTone`. Περιγράφει με λέξεις τα δύο νούμερα που
 * τυπώνονται δίπλα του — τίποτα άλλο.
 *
 * Ο ΑΝΕΜΟΣ ΚΑΙ Η ΘΑΛΑΣΣΑ ΜΕΝΟΥΝ ΧΩΡΙΣΤΑ. Επιστρέφονται σαν δύο ανεξάρτητα σήματα
 * (`windWord`+`beaufortText`, `waveWord`+`waveText`) και ΠΟΤΕ σαν μία πρόταση με «ή»: μια
 * παραλία μπορεί να έχει 6 Μποφόρ και νερό λάδι (Βάι), και το «αέρας ή κύμα» αφήνει τον
 * αναγνώστη να μαντέψει — μαντεύει κύμα (βίβλος §Γ14). Η ενωμένη φράση υπάρχει ακόμη στο
 * `feel.phrase` για όποιον τη χρειάζεται, αλλά δεν είναι η προεπιλογή καμιάς επιφάνειας.
 */
export interface BeachConditionsReadoutInput {
  /** Τα km/h ΤΗΣ ΠΑΡΑΛΙΑΣ. Αν λείπει, πέφτει στον άνεμο της περιοχής. */
  beachWindSpeedKmph?: number;
  /** Ο άνεμος της περιοχής σε m/s — το ίδιο fallback που είχε η κάρτα. */
  regionWindSpeedMs?: number;
  /** Το ανοιχτό νερό, όπως το μετράει το μοντέλο. */
  waveHeightM?: number;
  /** Decision-grade ύψος + περίοδος — μπαίνουν ΜΟΝΟ στο `seaStateM`, ποτέ στην οθόνη. */
  seaStateWaveM?: number;
  seaStatePeriodS?: number;
  /** Το νερό στην ακτή: κλειδί απόφασης. Δεν αντικαθίσταται από το display. */
  shoreWaveHeightM?: number;
  /** Το νερό στην ακτή, όπως ΤΥΠΩΝΕΤΑΙ (§Γ5). Προηγείται όπου υπάρχει. */
  shoreDisplayWaveM?: number;
  language: LanguageCode;
}

export interface BeachConditionsReadout {
  beaufort: number;
  /** «3 Μπφ» / «3 Bft» — έτοιμο για οθόνη. */
  beaufortText: string;
  /** «Λίγος αέρας» — στέκεται μόνο του, πάνω από το δικό του νούμερο. */
  windWord?: string;
  /** Το ύψος που ΤΥΠΩΝΕΤΑΙ. Undefined όταν δεν έχουμε κύμα να πούμε. */
  waveM?: number;
  /** «~0,1 μ.» / «0.1 m». Το «~» μόνο όταν η ακτή διαφέρει από τη μέτρηση του ανοιχτού. */
  waveText?: string;
  /** «Θάλασσα λάδι» — κεφαλαίο αρχικό, στέκεται μόνο του. */
  waveWord?: string;
  /** True όταν το νούμερο είναι το νερό της ακτής και όχι το ανοιχτό. */
  waveIsShore: boolean;
  /** Ολόκληρο το αντικείμενο της φράσης, για όποιον χρειάζεται το `divergent`/`contrast`. */
  feel: ConditionsFeel | null;
}

/** Η μονάδα, με τη γραφή κάθε γλώσσας. Ίδια λέξη με την κάρτα από τις 14/08. */
const beaufortUnit = (language: LanguageCode): string => (language === 'gr' ? 'Μπφ' : 'Bft');

/**
 * Το «~» μπαίνει μόνο όταν ο αριθμός της ακτής ΔΙΑΦΕΡΕΙ από τη μέτρηση του ανοιχτού — αλλιώς
 * είναι η μέτρηση, και ένα «~» θα την υποβάθμιζε σε εκτίμηση. Ίδιος κανόνας με τη σελίδα της
 * παραλίας (BeachAnswerHero) και με την κάρτα.
 */
const WAVE_DIFFERS_M = 0.05;

export const buildBeachConditionsReadout = ({
  beachWindSpeedKmph,
  regionWindSpeedMs,
  waveHeightM,
  seaStateWaveM,
  seaStatePeriodS,
  shoreWaveHeightM,
  shoreDisplayWaveM,
  language,
}: BeachConditionsReadoutInput): BeachConditionsReadout => {
  // Prefer this beach's own scored wind so the Beaufort matches its (same-wind) wave; fall back to
  // the island/region wind only when no beach-specific value was supplied.
  const effectiveWindKmph = typeof beachWindSpeedKmph === 'number' && Number.isFinite(beachWindSpeedKmph)
    ? beachWindSpeedKmph
    : (typeof regionWindSpeedMs === 'number' && Number.isFinite(regionWindSpeedMs) ? regionWindSpeedMs * 3.6 : 0);
  const beaufort = getBeaufortLevel(effectiveWindKmph);

  /**
   * `shoreDisplayWaveM` είναι ο ίδιος αριθμός που η ετυμηγορία κολύμβησης διαβάζει από τις 10/08
   * (§7η) και το ταβάνι του χρώματος από τις 01/08 — υπολογισμένος για ΚΑΘΕ παραλία.
   * `shoreWaveHeightM` ΔΕΝ αντικαταστάθηκε: είναι κλειδί απόφασης (25 πόντοι «νερό» στο βάθρο).
   * Το fallback υπάρχει για κλήσεις που δεν μεταφέρουν ακόμη το νέο πεδίο, ώστε καμία επιφάνεια
   * να μη γυρίσει σιωπηλά στο ανοιχτό νερό.
   */
  const shoreM = typeof shoreDisplayWaveM === 'number' && Number.isFinite(shoreDisplayWaveM)
    ? shoreDisplayWaveM
    : shoreWaveHeightM;
  const waveIsShore = typeof shoreM === 'number' && Number.isFinite(shoreM);
  // Ίδιο καπάκι με τη σελίδα της παραλίας: το κύμα στην ακτή δεν τυπώνεται ποτέ μεγαλύτερο από
  // το νερό έξω. Χωρίς αυτό, η κάρτα και η σελίδα έβγαζαν διαφορετικό νούμερο σε όρμους.
  const waveM = waveIsShore
    ? (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
        ? Math.min(shoreM as number, waveHeightM)
        : shoreM)
    : waveHeightM;
  /**
   * ΤΟ ΝΟΥΜΕΡΟ ΔΕΝ ΛΕΕΙ «ΗΡΕΜΑ» ΟΤΑΝ Η ΘΑΛΑΣΣΑ ΕΞΩ ΔΕΝ ΕΙΝΑΙ (21/08/2026, βίβλος §Γ47/§Γ49).
   *
   * Ο επισκέπτης δεν διαβάζει εκατοστά — διαβάζει ΖΩΝΗ: «ήρεμα» κάτω από SEA_STATE_AMBER_M,
   * «κύμα» ως SEA_STATE_ROUGH_M, «φουρτούνα» πάνω. Η έκπτωση ×0,5 της προστατευμένης ακτής
   * (waveCharacter.SHORE_DAMPING_BY_EXPOSURE) περνάει τη γραμμή της ηρεμίας χωρίς να το ξέρει
   * κανείς: η Παραλία Μαραθώνα τύπωνε 0,69 μ. — «ήρεμα» — πάνω από θάλασσα 1,38 μ., με την
   * ετυμηγορία «μην κολυμπήσεις» και πορτοκαλί πινέζα. Τρία μηνύματα, το πιο συγκεκριμένο ψεύτικο.
   *
   * ⚠️ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΑΥΤΟΥ ΤΟΥ ΦΡΑΧΤΗ ΗΤΑΝ ΠΟΛΥ ΣΤΕΝΗ, ΚΑΙ ΤΟ ΙΔΙΟ ΤΟ ΣΧΟΛΙΟ ΕΛΕΓΕ ΨΕΜΑ.
   * Έπιανε μόνο το ΔΙΠΛΟ άλμα («φουρτούνα → ήρεμα») και δικαιολογούσε την εξαίρεση των μονών
   * πτώσεων με τη φράση «εκεί η ετυμηγορία είναι συνήθως καλή». Αυτό ήταν **υπόθεση, γραμμένη σαν
   * μέτρηση** — και όταν μετρήθηκε (2η μέρα μελτεμιού, 2024-06-29, 110/110 περιοχές) βγήκε
   * **ακριβώς αντίστροφη**: από τις 121 μονές πτώσεις, **61 avoid_swimming + 47 caution = 108
   * (89%)** φέρουν προειδοποίηση και μόνο **13** λένε «καλή».
   *
   * ΜΕΤΡΗΘΗΚΕ ΕΘΝΙΚΑ, ΔΥΟ ΠΑΡΑΘΥΡΑ (110/110 περιοχές, 2.873 παραλίες, μέσω lib/replayOpenMeteo):
   *   2022-09-06 → 105 παραλίες περνούν στο «ήρεμα» (3,7%)· 2024-06-29 → 178 (6,2%).
   *   **Και στα δύο, το 100% αυτών έχει πινέζα που ΔΕΝ είναι ήρεμη** (orange/yellow/red).
   * Δηλαδή δεν υπάρχει ούτε μία περίπτωση όπου το «ήρεμα» του αριθμού να το επιβεβαιώνει το χρώμα
   * δίπλα του. Γι' αυτό ο φράχτης πιάνει ΚΑΘΕ πτώση στο «ήρεμα», όχι μόνο τη διπλή: δεν είναι
   * υπερ-αυστηρότητα (το λάθος του `quality:over-caution`), είναι ευθυγράμμιση με το χρώμα.
   *
   * ΜΟΝΟΔΡΟΜΟ: μόνο ΑΝΕΒΑΖΕΙ το τυπωμένο νούμερο, ποτέ δεν το κατεβάζει, και ποτέ πάνω από το
   * ανοιχτό νερό (το καπάκι από πάνω έχει ήδη εφαρμοστεί και το δάπεδο είναι ακριβώς η γραμμή
   * `AMBER`, που το ανοιχτό έχει ήδη περάσει). Δεν αγγίζει ΚΑΜΙΑ απόφαση: το `shoreWaveHeightM`
   * που βαθμολογεί το βάθρο και το `shoreDisplayWaveM` που διαβάζει η ετυμηγορία μένουν ως έχουν
   * — διόρθωση ΟΘΟΝΗΣ, ακριβώς όπως ήταν και η υπόσχεση του §Γ5.
   *
   * ΔΕΝ διορθώνει το ×0,5 — αυτό παραμένει αβαθμονόμητο και χωρίς κριτή (§7δ). Είναι φράχτης
   * γύρω από το χειρότερο σύμπτωμά του, όχι απάντηση στην αιτία.
   */
  const openSeverityM = seaStateSeverityM(seaStateWaveM ?? waveHeightM, seaStatePeriodS);
  const shownSeverityM = seaStateSeverityM(waveM, seaStatePeriodS);
  const fallsIntoCalm = waveIsShore
    && typeof openSeverityM === 'number' && openSeverityM >= SEA_STATE_AMBER_M
    && typeof shownSeverityM === 'number' && shownSeverityM < SEA_STATE_AMBER_M;
  const guardedWaveM = fallsIntoCalm
    ? Number((SEA_STATE_AMBER_M / choppinessFactor(seaStatePeriodS)).toFixed(2))
    : waveM;

  const waveDiffers = waveIsShore
    && typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
    && Math.abs((guardedWaveM as number) - waveHeightM) >= WAVE_DIFFERS_M;
  const waveText = typeof guardedWaveM === 'number' && Number.isFinite(guardedWaveM)
    ? `${waveDiffers ? '~' : ''}${guardedWaveM.toFixed(1).replace('.', language === 'gr' ? ',' : '.')} ${language === 'gr' ? 'μ.' : 'm'}`
    : undefined;

  const feel = buildConditionsFeel({
    beaufort,
    // Το ΙΔΙΟ νούμερο που τυπώνεται από κάτω — ποτέ το severity-corrected `seaStateM`, που σε
    // όρμο διαβάζει το ανοιχτό νερό και θα έβαζε «μεγάλο κύμα» πάνω από ένα «~0,1 μ.».
    waveM: typeof guardedWaveM === 'number' && Number.isFinite(guardedWaveM) && waveText ? guardedWaveM : undefined,
    language,
  });

  return {
    beaufort,
    beaufortText: `${beaufort} ${beaufortUnit(language)}`,
    windWord: feel?.windWord,
    waveM: typeof guardedWaveM === 'number' && Number.isFinite(guardedWaveM) ? guardedWaveM : undefined,
    waveText,
    waveWord: waveText ? feel?.waveWord : undefined,
    waveIsShore,
    feel,
  };
};

/**
 * Το severity-corrected ύψος που κρίνουν τα ΧΡΩΜΑΤΑ — χωριστή συνάρτηση επίτηδες, ώστε καμία
 * επιφάνεια να μην μπερδέψει «τι δείχνω» με «τι κρίνω». Ένα 0,45 μ. στα 2,5 s και ένα 0,45 μ.
 * στα 8 s είναι το ίδιο νούμερο να διαβάσεις και άλλη θάλασσα να κολυμπήσεις.
 */
export const beachDecisionSeaStateM = (
  seaStateWaveM: number | undefined,
  waveHeightM: number | undefined,
  seaStatePeriodS: number | undefined,
): number | undefined => seaStateSeverityM(seaStateWaveM ?? waveHeightM, seaStatePeriodS)
  ?? (seaStateWaveM ?? waveHeightM);
