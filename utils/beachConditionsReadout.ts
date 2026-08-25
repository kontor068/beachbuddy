import type { LanguageCode } from '../types';
import { getBeaufortLevel } from './weatherUtils';
import { printedWaveHeightM } from './waveModel';
import { seaStateSeverityM } from './waveCharacter';
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
  /** Το ανοιχτό νερό, όπως το μετράει το μοντέλο. Ταβάνι του τυπωμένου αριθμού, ποτέ ο ίδιος. */
  waveHeightM?: number;
  /** Decision-grade ύψος + περίοδος. Γίνονται δεκτά για σταθερότητα των κλήσεων· από 24/08/2026
   *  ΔΕΝ επηρεάζουν το τυπωμένο νούμερο — τα χρώματα τα κρίνουν μέσω `beachDecisionSeaStateM`. */
  seaStateWaveM?: number;
  seaStatePeriodS?: number;
  /** Το νερό στην ακτή: κλειδί απόφασης. Δεν αντικαθίσταται από το display. */
  shoreWaveHeightM?: number;
  /** Το νερό στην ακτή, όπως ΤΥΠΩΝΕΤΑΙ (§Γ5). Προηγείται όπου υπάρχει. */
  shoreDisplayWaveM?: number;
  /**
   * Προέλευση του αριθμού ακτής (utils/shoreWave.isSeaDepartingShore). Γίνεται δεκτό για
   * σταθερότητα των κλήσεων και για το analytics· από 24/08/2026 ΔΕΝ αλλάζει το τυπωμένο
   * νούμερο — ο φράχτης της γραμμής ηρεμίας που το διάβαζε αφαιρέθηκε (απόφαση Μίλτου, Βάι).
   */
  shoreWaveFromDepartingSea?: boolean;
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
  const cappedWaveM = waveIsShore
    ? (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
        ? Math.min(shoreM as number, waveHeightM)
        : shoreM)
    : waveHeightM;
  /**
   * ΤΟ ΔΑΠΕΔΟ ΤΩΝ 0,10 μ., ΕΠΙΤΕΛΟΥΣ ΕΦΑΡΜΟΣΜΕΝΟ (25/08/2026 — Λυγιά Λευκάδας, 09:00).
   *
   * Η πλήρης ιστορία και η μέτρηση ζουν δίπλα στο `utils/waveModel.printedWaveHeightM`, ώστε
   * να μην ξαναγραφτεί εδώ και ξεσυγχρονιστεί. Σε δύο γραμμές: ο αέρας ΗΤΑΝ άπνοια και η
   * θάλασσα ΗΤΑΝ λάδι — αλλά «0,0 μ.» δεν είναι ήρεμη θάλασσα, είναι χαλασμένη ένδειξη, και
   * ο ίδιος ο κώδικας το έγραφε σε τρία σημεία χωρίς να το εφαρμόζει σε αυτή τη διαδρομή.
   *
   * ΤΟ ΔΑΠΕΔΟ ΜΠΑΙΝΕΙ ΚΑΙ ΣΤΑ ΔΥΟ ΝΟΥΜΕΡΑ, ΕΠΙΤΗΔΕΣ. Αν έμπαινε μόνο στο νούμερο της ακτής,
   * η σελίδα της παραλίας θα τύπωνε «στην ακτή ~0,1 μ.» δίπλα σε «ανοιχτά 0,0 μ.» — δηλαδή θα
   * γεννούσε ψεύτικη διαφορά (και ένα «~») εκεί που δεν υπάρχει καμία. Με το ίδιο δάπεδο και
   * στα δύο, οι δύο αναγνώσεις ταυτίζονται και η οθόνη λέει έναν αριθμό, μία φορά.
   */
  const waveM = printedWaveHeightM(cappedWaveM);
  const openWaterPrintedM = printedWaveHeightM(waveHeightM);
  /**
   * ΤΟ ΝΟΥΜΕΡΟ ΕΙΝΑΙ ΠΑΝΤΑ ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ (24/08/2026, απόφαση Μίλτου — βλ. gate
   * scripts/validateShoreBandJump.mjs για το πλήρες ιστορικό).
   *
   * Εδώ ζούσε από τις 21/08 ο «φράχτης της γραμμής ηρεμίας» (§Γ47/§Γ49): όταν ο αριθμός ακτής
   * έπεφτε κάτω από τη γραμμή AMBER ενώ το ανοιχτό νερό όχι, ανέβαζε το τυπωμένο νούμερο ως τη
   * γραμμή. Το σκεπτικό του ήταν η ευθυγράμμιση με το χρώμα της πινέζας· το σύμπτωμά του
   * φάνηκε στο Βάι (24/08/2026): ανοιχτά ~1,1 μ., ακτή 0,1 μ., και η κάρτα τύπωνε «~0,8 μ.» —
   * ένα νούμερο που δεν ήταν ΟΥΤΕ η θάλασσα έξω ΟΥΤΕ το νερό στην άμμο, δίπλα σε σελίδα
   * παραλίας που έλεγε το σωστό 0,1. Ο Μίλτος αποφάσισε: το νούμερο λέει την αλήθεια της
   * ακτής· την προειδοποίηση την κουβαλούν το χρώμα της πινέζας και η ετυμηγορία, που κρίνουν
   * ΟΠΩΣ ΚΑΙ ΠΡΙΝ με το decision-grade `seaStateM` — καμία απόφαση δεν άλλαξε εδώ.
   *
   * Ό,τι μένει από τον φράχτη: το ταβάνι από πάνω (η ακτή δεν τυπώνεται ποτέ πάνω από το
   * ανοιχτό νερό) και το «~» από κάτω (φαίνεται ότι ο αριθμός είναι εκτίμηση όταν διαφέρει από
   * τη μέτρηση του ανοιχτού). Το ×0,5 της προστατευμένης ακτής παραμένει αβαθμονόμητο (§7δ) —
   * αυτό δεν το έλυνε ούτε ο φράχτης· τύπωνε απλώς ένα τρίτο, δικό του νούμερο από πάνω.
   */
  const waveDiffers = waveIsShore
    && typeof openWaterPrintedM === 'number' && typeof waveM === 'number'
    && Math.abs(waveM - openWaterPrintedM) >= WAVE_DIFFERS_M;
  const waveText = typeof waveM === 'number' && Number.isFinite(waveM)
    ? `${waveDiffers ? '~' : ''}${waveM.toFixed(1).replace('.', language === 'gr' ? ',' : '.')} ${language === 'gr' ? 'μ.' : 'm'}`
    : undefined;

  const feel = buildConditionsFeel({
    beaufort,
    // Το ΙΔΙΟ νούμερο που τυπώνεται από κάτω — ποτέ το severity-corrected `seaStateM`, που σε
    // όρμο διαβάζει το ανοιχτό νερό και θα έβαζε «μεγάλο κύμα» πάνω από ένα «~0,1 μ.».
    waveM: typeof waveM === 'number' && Number.isFinite(waveM) && waveText ? waveM : undefined,
    language,
  });

  return {
    beaufort,
    beaufortText: `${beaufort} ${beaufortUnit(language)}`,
    windWord: feel?.windWord,
    waveM: typeof waveM === 'number' && Number.isFinite(waveM) ? waveM : undefined,
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
