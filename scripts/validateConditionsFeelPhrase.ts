/**
 * Η ΦΡΑΣΗ ΤΗΣ ΚΑΡΤΑΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΚΟΠΕΙ ΟΥΤΕ ΝΑ ΔΙΑΨΕΥΣΕΙ ΤΟ ΝΟΥΜΕΡΟ ΤΗΣ.
 *
 * Δύο φορές μέσα σε 24 ώρες (13/08 και 14/08/2026) μια περιγραφή δίπλα σε αριθμό κόπηκε στο
 * κινητό — μία στην κάρτα, μία στο πλακίδιο της σελίδας. Και τις δύο φορές το κείμενο ήταν
 * σωστό· το πλάτος δεν ήταν. Αυτή η πύλη κοιτάζει ΚΑΘΕ συνδυασμό ανέμου × κύματος × γλώσσας
 * που μπορεί να παραχθεί, χωρίς φυλλομετρητή, και σταματά τρία πράγματα:
 *
 *   1. Φράση μεγαλύτερη από όσο χωράει σε δύο σειρές των 320 px (το στενότερο τηλέφωνο).
 *   2. Λέξη που διαψεύδει τον αριθμό από κάτω της — «θάλασσα λάδι» πάνω από «1,4 μ.».
 *   3. Κρίση καταλληλότητας μέσα στο λεξιλόγιο. Το βάθρο δεν βγάζει ετυμηγορία· ο χάρτης
 *      είναι η μόνη επιφάνεια που χρωματίζει μια παραλία, και δεύτερη σκάλα αξιολόγησης δεν
 *      μπαίνει ούτε με λέξεις.
 *
 * Run: node scripts/validateConditionsFeelPhrase.mjs
 */
import type { LanguageCode } from '../types';
import { conditionToneLabels, causeLineLabels } from '../utils/conditionToneLabels';
import { resolveWindTone, selectSuitableByTone } from '../utils/suitabilityTone';
import {
  buildConditionsFeel, waveFeelLevel, waveFeelLevelWithArrival, windFeelLevel,
  WAVE_WORD_ARRIVAL_GATE_MIN_PRINTED_M,
} from '../utils/conditionsFeelPhrase';
import { buildBeachConditionsReadout } from '../utils/beachConditionsReadout';
import { SEA_ARRIVAL_GRAZING } from '../utils/waveCharacter';
import { SEA_ARRIVAL_UNKNOWN } from '../utils/seaArrival';
import { SUPPORTED_LANGUAGES } from '../utils/i18n';
import { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } from '../utils/waveCharacter';

/**
 * Το πλαίσιο έχει ~264 px καθαρό πλάτος στα 320 px (κάρτα px-3.5 + πλαίσιο px-1.5 + px-1), σε
 * γραμματοσειρά 12 px extrabold ≈ 6,6 px ανά χαρακτήρα, σε δύο σειρές (`line-clamp-2`). Το
 * όριο κρατιέται συντηρητικό: 40 χαρακτήρες είναι μία γεμάτη σειρά, οπότε 62 αφήνει τη
 * δεύτερη σειρά μισή — αρκετά μακριά από το σημείο που το `line-clamp` αρχίζει να τρώει λέξη.
 */
const MAX_PHRASE_CHARS = 62;
/** Πάνω από αυτό δεν χωράει σε ΜΙΑ σειρά — επιτρεπτό, αλλά αξίζει να το ξέρουμε. */
const SINGLE_LINE_CHARS = 40;

/**
 * ΑΠΟ ΤΙΣ 22/08/2026 Η ΛΕΞΗ ΣΤΕΚΕΙ ΜΟΝΗ ΤΗΣ ΣΕ ΜΙΣΗ ΚΑΡΤΑ — ΚΑΙ ΤΟ ΜΙΣΟ ΠΛΑΤΟΣ ΕΙΝΑΙ ΑΛΛΟ ΟΡΙΟ.
 *
 * Η κάρτα έπαψε να τυπώνει «6 Μπφ» και «~0,1 μ.»: κάθε κελί κρατά μόνο τη λέξη του. Το κελί
 * είναι ΜΙΣΟ πλαίσιο (~140 px στα 320 px) μείον padding 12 px και εικονίδιο+κενό 16 px → ~112 px
 * καθαρό κείμενο, σε 11 px extrabold ≈ 6 px/χαρακτήρα → ~18 χαρακτήρες η σειρά, δύο σειρές
 * (`line-clamp-2`) → 36.
 *
 * Το `MAX_WORD_CHARS` κρατιέται στο 21 ΚΑΙ ΓΙΑ ΔΕΥΤΕΡΟ ΛΟΓΟ: το `scripts/validateTileFit.mjs`
 * χτίζει τη χειρότερη περίπτωσή του με ένεση, από τις σημερινές πιο μακριές λέξεις (η γαλλική
 * «presque pas de vagues», 21 χαρακτήρες). Λέξη μακρύτερη από αυτή δεν θα τη μετρούσε ΚΑΝΕΙΣ
 * στην οθόνη — γι' αυτό σπάει εδώ, όχι εκεί.
 */
const MAX_WORD_CHARS = 21;
/** Ένα ΑΣΠΑΣΤΟ κομμάτι (λέξη χωρίς κενό) πρέπει να χωρά σε μία σειρά του μισού κελιού. */
const MAX_WORD_TOKEN_CHARS = 18;

/** Λέξεις που θα έκαναν τη φράση ετυμηγορία αντί για περιγραφή. */
const VERDICT_WORDS = [
  'ιδανικ', 'κατάλληλ', 'απόφυγ', 'προσοχή', 'καλύτερ', 'χειρότερ', 'άριστ',
  'ideal', 'perfect', 'avoid', 'unsuitable', 'best', 'worst', 'caution',
  'ideale', 'éviter', 'meilleur', 'vermeiden', 'perfekt', 'evita', 'migliore',
];

const WAVE_SAMPLES = [0, 0.05, 0.1, 0.19, 0.2, 0.3, 0.39, 0.4, 0.6, 0.79, 0.8, 1.0, 1.19, 1.2, 1.6, 2.4, 4];
const BEAUFORT_SAMPLES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const failures: string[] = [];

/**
 * Η ΓΡΑΜΜΗ ΑΙΤΙΑΣ ΠΕΡΝΑΕΙ ΑΠΟ ΤΟΝ ΙΔΙΟ ΕΛΕΓΧΟ (15/08/2026).
 *
 * Τα chips του χάρτη απέκτησαν μια γραμμή που λέει τι έβαψε το χρώμα — «Φταίει ο αέρας, όχι το
 * κύμα». Είναι ΠΕΡΙΓΡΑΦΗ, όχι ετυμηγορία: αν κάποια στιγμή δανειστεί λέξη από το λεξιλόγιο της
 * ετυμηγορίας, η οθόνη θα έχει δύο κρίσεις υπολογισμένες χωριστά, που καμία πύλη δεν συμφιλιώνει.
 * Ο κατάλογος των απαγορευμένων λέξεων ζει εδώ και σε ΠΕΝΤΕ γλώσσες, γι' αυτό ο έλεγχος γίνεται
 * εδώ και όχι στο validateConditionToneAgreement, που θα κρατούσε δεύτερο, φτωχότερο αντίγραφο.
 */
for (const [language, forms] of Object.entries(causeLineLabels)) {
  for (const [form, words] of Object.entries(forms)) {
    for (const [slot, text] of Object.entries(words)) {
      const verdict = VERDICT_WORDS.find(word => text.toLowerCase().includes(word));
      if (verdict) {
        failures.push(`[${language}] κρίση «${verdict}» μέσα στη γραμμή αιτίας ${form}.${slot}: «${text}»`);
      }
    }
  }
}

/**
 * Η ΠΑΝΩ ΒΑΘΜΙΔΑ ΤΗΣ ΛΕΞΗΣ ΕΙΝΑΙ ΑΝΟΙΧΤΗ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΑΚΙΝΔΥΝΟ ΜΟΝΟ ΟΣΟ ΙΣΧΥΟΥΝ ΔΥΟ ΓΡΑΜΜΕΣ.
 *
 * Από τις 22/08 (§Γ66) η κάρτα δεν τυπώνει μποφόρ. Το «Δυνατός αέρας» καλύπτει 6, 7, 8, 9 — ενώ
 * το ΧΡΩΜΑ κόβει στη μέση αυτής της βαθμίδας (πορτοκαλί ως 6, κόκκινο από 7). Αν και τα δύο
 * έφταναν στην ίδια οθόνη προτάσεων, η λέξη θα έκρυβε σκαλί κινδύνου.
 *
 * ΔΕΝ ΤΟ ΚΑΝΕΙ, και ο λόγος είναι δομικός, όχι στατιστικός:
 *   1. `resolveWindTone(..., ≥7)` επιστρέφει ΠΑΝΤΑ 'red', σε κάθε βαθμίδα έκθεσης.
 *   2. Η λίστα προτάσεων δεν περιέχει κόκκινο (`SUITABLE_LIST_TONE_RANK`).
 * Άρα όπου ΠΡΟΤΕΙΝΟΥΜΕ, «Δυνατός αέρας» σημαίνει ακριβώς 6.
 *
 * Η μέτρηση της 22/08 (`scripts/measureCardWordResolution.mjs`) έκλεισε το θέμα ΠΑΝΩ ΣΕ ΑΥΤΕΣ
 * ΤΙΣ ΔΥΟ ΓΡΑΜΜΕΣ. Αν κάποιος τις αλλάξει, το κλείσιμο παύει να ισχύει και κανείς δεν θα το
 * έπαιρνε είδηση — γι' αυτό ελέγχονται εδώ, όπου δεν χρειάζονται ούτε δεδομένα ούτε δίκτυο.
 */
for (const level of ['protected', 'partial', 'exposed'] as const) {
  for (const beaufort of [7, 8, 9, 10, 12]) {
    if (resolveWindTone(level, beaufort) !== 'red') {
      failures.push(
        `[${level}] ${beaufort} Μποφόρ δεν βάφει κόκκινο — η πάνω βαθμίδα της λέξης («Δυνατός αέρας») `
        + 'μπορεί πλέον να φτάσει στις προτάσεις πάνω από 6 Μποφόρ, και η κάρτα δεν τυπώνει αριθμό '
        + 'για να το ξεχωρίσει κανείς (§Γ66).'
      );
    }
  }
}
{
  const chosen = selectSuitableByTone(
    [{ tone: 'red' as const }, { tone: 'orange' as const }],
    item => item.tone,
    () => 0,
  );
  if (chosen.some(item => item.tone === 'red')) {
    failures.push(
      'Η λίστα προτάσεων δέχτηκε κόκκινο. Μαζί με τον έλεγχο από πάνω, αυτό σημαίνει ότι μια κάρτα '
      + 'μπορεί να γράψει «Δυνατός αέρας» πάνω σε 9 Μποφόρ μέσα στις προτάσεις (§Γ66).'
    );
  }
}

const longest: Record<string, { phrase: string; chars: number }> = {};
let checked = 0;
let overSingleLine = 0;

for (const language of SUPPORTED_LANGUAGES) {
  for (const beaufort of BEAUFORT_SAMPLES) {
    // Πρώτα η περίπτωση «δεν έχουμε κύμα»: η φράση πρέπει να στέκει και μόνη της.
    const windOnly = buildConditionsFeel({ beaufort, language });
    if (!windOnly || !windOnly.phrase.trim()) {
      failures.push(`[${language}] ${beaufort} Bft χωρίς κύμα: κενή φράση`);
    }

    for (const waveM of WAVE_SAMPLES) {
      checked += 1;
      const feel = buildConditionsFeel({ beaufort, waveM, language });
      if (!feel) {
        failures.push(`[${language}] ${beaufort} Bft / ${waveM} m: καμία φράση`);
        continue;
      }
      const { phrase } = feel;

      if (phrase.length > MAX_PHRASE_CHARS) {
        failures.push(`[${language}] ${beaufort} Bft / ${waveM} m: ${phrase.length} χαρακτήρες — «${phrase}»`);
      }
      if (phrase.length > SINGLE_LINE_CHARS) overSingleLine += 1;
      if (!longest[language] || phrase.length > longest[language].chars) {
        longest[language] = { phrase, chars: phrase.length };
      }

      // ΤΟ ΚΑΘΕ ΜΙΣΟ ΜΟΝΟ ΤΟΥ: από τις 22/08 αυτό ακριβώς ζωγραφίζεται στην κάρτα, χωρίς νούμερο
      // από κάτω του να «γεμίζει» το κελί.
      for (const [half, word] of [['αέρας', feel.windWord], ['κύμα', feel.waveWord]] as const) {
        if (!word) continue;
        if (word.length > MAX_WORD_CHARS) {
          failures.push(`[${language}] ${half}: «${word}» = ${word.length} χαρακτήρες, πάνω από ${MAX_WORD_CHARS} — δεν χωρά στο μισό κελί ΚΑΙ δεν τη μετρά το validateTileFit`);
        }
        const longestToken = word.split(/\s+/).reduce((max, token) => Math.max(max, token.length), 0);
        if (longestToken > MAX_WORD_TOKEN_CHARS) {
          failures.push(`[${language}] ${half}: «${word}» έχει άσπαστο κομμάτι ${longestToken} χαρακτήρων — θα κοπεί, δεν θα αλλάξει σειρά`);
        }
      }

      // Η λέξη πρέπει να συμφωνεί με τον αριθμό που τυπώνεται από κάτω της.
      const expectedWave = waveFeelLevel(waveM);
      if (feel.waveLevel !== expectedWave) {
        failures.push(`[${language}] ${waveM} m περιγράφηκε ως επίπεδο ${feel.waveLevel}, όχι ${expectedWave}`);
      }
      if (feel.windLevel !== windFeelLevel(beaufort)) {
        failures.push(`[${language}] ${beaufort} Bft περιγράφηκε ως επίπεδο ${feel.windLevel}`);
      }

      const lower = phrase.toLowerCase();
      const verdict = VERDICT_WORDS.find(word => lower.includes(word));
      if (verdict) {
        failures.push(`[${language}] κρίση «${verdict}» μέσα σε περιγραφή: «${phrase}»`);
      }

      // Η ίδια φράση δεν επιτρέπεται να βγει και για ήρεμη και για τραχιά θάλασσα.
      if (waveM >= SEA_STATE_ROUGH_M) {
        const calm = buildConditionsFeel({ beaufort, waveM: 0.05, language });
        if (calm && calm.phrase === phrase) {
          failures.push(`[${language}] ${beaufort} Bft: ίδια φράση για 0,05 m και ${waveM} m — «${phrase}»`);
        }
      }
    }
  }
}

// Τα δύο κατώφλια του κύματος ΔΕΝ είναι δικά μας — αν αλλάξουν στο waveCharacter, η λέξη
// πρέπει να ακολουθήσει, αλλιώς η κάρτα λέει «λίγο κύμα» εκεί που η μηχανή κιτρινίζει.
if (waveFeelLevel(SEA_STATE_AMBER_M - 0.01) !== 2 || waveFeelLevel(SEA_STATE_AMBER_M) !== 3) {
  failures.push(`Το κατώφλι «κιτρινίζει» (${SEA_STATE_AMBER_M} m) δεν αλλάζει λέξη`);
}
if (waveFeelLevel(SEA_STATE_ROUGH_M - 0.01) !== 3 || waveFeelLevel(SEA_STATE_ROUGH_M) !== 4) {
  failures.push(`Το κατώφλι «τραχιά» (${SEA_STATE_ROUGH_M} m) δεν αλλάζει λέξη`);
}

// Η περίπτωση για την οποία γράφτηκε το λεξιλόγιο: δυνατός αέρας πάνω από επίπεδο νερό.
for (const language of SUPPORTED_LANGUAGES) {
  const surprise = buildConditionsFeel({ beaufort: 5, waveM: 0.1, language });
  if (!surprise?.contrast) {
    failures.push(`[${language}] 5 Bft με 0,1 m δεν σημάνθηκε ως αντίθεση`);
  }
  // Και η ανάποδη: φουσκοθαλασσιά χωρίς αέρα.
  const swell = buildConditionsFeel({ beaufort: 1, waveM: 1.4, language });
  if (!swell?.contrast) {
    failures.push(`[${language}] 1 Bft με 1,4 m δεν σημάνθηκε ως αντίθεση`);
  }
  // Το ταβάνι της ανακούφισης: στα 6+ Μποφόρ ο χάρτης βάφει κόκκινο και η κάρτα δεν
  // επιτρέπεται να ακούγεται σαν καλά νέα, όσο επίπεδο κι αν είναι το νερό.
  for (const beaufort of [6, 7, 8, 9]) {
    const gale = buildConditionsFeel({ beaufort, waveM: 0.05, language });
    if (gale?.contrast) {
      failures.push(`[${language}] ${beaufort} Bft με 0,05 m ακούγεται ανακουφιστικό: «${gale.phrase}»`);
    }
    // …αλλά το ΓΕΓΟΝΟΣ της απόκλισης μένει, αλλιώς η σελίδα της παραλίας — που κρίνει από
    // αυτό αν θα γράψει τη γραμμή — θα σιωπούσε ακριβώς στις παραλίες που τη χρειάζονται
    // περισσότερο (Φάραγγας, Πάρος: 6 Μπφ πάνω από 0,1 μ.).
    if (!gale?.divergent) {
      failures.push(`[${language}] ${beaufort} Bft με 0,05 m δεν σημάνθηκε ως απόκλιση — η σελίδα θα σιωπήσει`);
    }
  }
}

/**
 * Η λεζάντα του χάρτη κάθεται στην ΙΔΙΑ οθόνη, λίγο πιο πάνω. Δύο συνώνυμα για το ίδιο
 * πράγμα διαβάζονται ως δύο διαφορετικά πράγματα, οπότε οι ακραίες βαθμίδες πρέπει να
 * μοιράζονται λέξεις μαζί της — αλλιώς κάποιος άλλαξε τη μία και ξέχασε την άλλη.
 */
for (const [language, expected] of Object.entries({
  gr: ['Δυνατός αέρας', 'μεγάλο κύμα'],
  en: ['Strong wind', 'big waves'],
  de: ['Starker Wind', 'hohe Wellen'],
  fr: ['Vent fort', 'grosses vagues'],
  it: ['Vento forte', 'onde alte'],
}) as Array<[LanguageCode, string[]]>) {
  const worst = buildConditionsFeel({ beaufort: 8, waveM: 2.0, language });
  const legend = conditionToneLabels[language].red.meaning;
  for (const word of expected) {
    if (!worst?.phrase.includes(word)) {
      failures.push(`[${language}] η χειρότερη φράση δεν λέει «${word}»: «${worst?.phrase}»`);
    }
    if (!legend.includes(word)) {
      failures.push(`[${language}] η λεζάντα του χάρτη δεν λέει πια «${word}» («${legend}») — ξαναδέστε τα μαζί`);
    }
  }
}

/**
 * Η ΛΕΞΗ «ΣΧΕΔΟΝ ΧΩΡΙΣ ΚΥΜΑ» ΚΟΙΤΑΕΙ ΤΗΝ ΑΦΙΞΗ (27/08/2026 — Συκιά Σιθωνίας #445, 13:00).
 *
 * Το πλήρες σκεπτικό και η εθνική μέτρηση ζουν δίπλα στο `waveFeelLevelWithArrival`. Εδώ
 * ξαναπαίζουν οι μάρτυρες, ώστε ο κανόνας να μην μπορεί να ξεστρατίσει σιωπηλά:
 *   • Συκιά: 0,28 μ. (τυπώνεται «0,3»), άφιξη 'exposed' → «λίγο κύμα», σε ΚΑΘΕ γλώσσα.
 *   • Φυριπλάκα: 0,34 μ. με άφιξη partial / protected / ξυστά / «δεν έρχεται» / άγνωστη → μένει
 *     «σχεδόν χωρίς κύμα». Η πύλη σιωπά σε ό,τι δεν είναι ρητά κατάμουτρα.
 *   • Τυπωμένο «0,2» (0,20–0,24) κατάμουτρα → μένει: 0,2 μ. δεν είναι κύμα, από όπου κι αν έρχεται.
 *   • Μονόδρομη: για κάθε ύψος και κάθε άφιξη, η λέξη με άφιξη ≥ λέξη χωρίς — ποτέ πιο ήρεμη.
 *   • Ένα σκαλί το πολύ: ποτέ πάνω από «λίγο κύμα» — «αρκετό κύμα» μένει δουλειά του 0,8.
 *   • ΔΙΟΧΕΤΕΥΣΗ: το ίδιο περνάει ΚΑΙ μέσα από το beachConditionsReadout (η διαδρομή κάρτας και
 *     ταμπελακιού χάρτη). Το windShadow χάθηκε ακριβώς εδώ, στον δρόμο προς την οθόνη (§6, 27/08).
 */
{
  const SYKIA_M = 0.28;
  const FIRIPLAKA_M = 0.34;
  const keepers: Array<string | undefined> = ['partial', 'protected', SEA_ARRIVAL_GRAZING, undefined, SEA_ARRIVAL_UNKNOWN, 'grazing'];
  for (const language of SUPPORTED_LANGUAGES) {
    const sykia = buildConditionsFeel({ beaufort: 3, waveM: SYKIA_M, seaArrivalExposureLevel: 'exposed', language });
    if (sykia?.waveLevel !== 2 || !sykia.waveWordLiftedByArrival) {
      failures.push(`[${language}] Συκιά #445 (0,28 μ. κατάμουτρα) δεν έγινε «λίγο κύμα»: «${sykia?.phrase}»`);
    }
    for (const arrival of keepers) {
      const firiplaka = buildConditionsFeel({ beaufort: 4, waveM: FIRIPLAKA_M, seaArrivalExposureLevel: arrival, language });
      if (firiplaka?.waveLevel !== 1 || firiplaka.waveWordLiftedByArrival) {
        failures.push(`[${language}] Φυριπλάκα (0,34 μ., άφιξη ${String(arrival)}) ανέβηκε λέξη ενώ η θάλασσα δεν πέφτει κατάμουτρα: «${firiplaka?.phrase}»`);
      }
    }
    const low = buildConditionsFeel({ beaufort: 2, waveM: 0.22, seaArrivalExposureLevel: 'exposed', language });
    if (low?.waveLevel !== 1) {
      failures.push(`[${language}] τυπωμένο «0,2» κατάμουτρα ανέβηκε λέξη — το κατώφλι ${WAVE_WORD_ARRIVAL_GATE_MIN_PRINTED_M} δεν κρατά`);
    }
  }
  for (const waveM of [...WAVE_SAMPLES, 0.24, 0.25, 0.26, 0.28, 0.35]) {
    for (const arrival of ['exposed', ...keepers]) {
      const plain = waveFeelLevel(waveM);
      const withArrival = waveFeelLevelWithArrival(waveM, arrival);
      if (withArrival < plain) failures.push(`${waveM} m / ${String(arrival)}: η άφιξη έκανε τη λέξη ΠΙΟ ήρεμη (${plain} → ${withArrival})`);
      if (withArrival > plain + 1 || (withArrival !== plain && withArrival > 2)) failures.push(`${waveM} m / ${String(arrival)}: η άφιξη ανέβασε πάνω από ένα σκαλί / πάνω από «λίγο κύμα» (${plain} → ${withArrival})`);
      if (arrival !== 'exposed' && withArrival !== plain) failures.push(`${waveM} m / ${String(arrival)}: η πύλη μίλησε χωρίς ρητό 'exposed'`);
    }
  }
  // Διοχέτευση: η διαδρομή της κάρτας.
  const viaReadout = buildBeachConditionsReadout({ beachWindSpeedKmph: 13, waveHeightM: SYKIA_M, shoreDisplayWaveM: SYKIA_M, seaArrivalExposureLevel: 'exposed', language: 'gr' });
  if (viaReadout.waveWord !== 'Λίγο κύμα') {
    failures.push(`Η κάρτα (beachConditionsReadout) δεν πέρασε την άφιξη στη λέξη: «${viaReadout.waveWord}» για 0,28 μ. κατάμουτρα`);
  }
  const viaReadoutSilent = buildBeachConditionsReadout({ beachWindSpeedKmph: 13, waveHeightM: SYKIA_M, shoreDisplayWaveM: SYKIA_M, language: 'gr' });
  if (viaReadoutSilent.waveWord !== 'Σχεδόν χωρίς κύμα') {
    failures.push(`Η κάρτα χωρίς άφιξη άλλαξε συμπεριφορά: «${viaReadoutSilent.waveWord}» για 0,28 μ.`);
  }
}

console.log(`Ελέγχθηκαν ${checked} συνδυασμοί σε ${SUPPORTED_LANGUAGES.length} γλώσσες.`);
for (const language of SUPPORTED_LANGUAGES) {
  const record = longest[language];
  if (record) console.log(`  ${language}: μέγιστο ${record.chars} χαρ. — «${record.phrase}»`);
}
console.log(`  ${overSingleLine} από ${checked} φράσεις πιάνουν δεύτερη σειρά στα 320 px.`);
console.log(`  Δείγμα (gr, 5 Bft / 0,1 m): «${buildConditionsFeel({ beaufort: 5, waveM: 0.1, language: 'gr' })?.phrase}»`);

if (failures.length) {
  console.error(`\n❌ ${failures.length} προβλήματα:`);
  for (const failure of failures.slice(0, 25)) console.error(`  • ${failure}`);
  process.exit(1);
}
console.log('\n✅ Καμία φράση δεν κόβεται, δεν διαψεύδει το νούμερό της και δεν βγάζει ετυμηγορία.');
