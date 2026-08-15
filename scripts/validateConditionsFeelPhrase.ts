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
import { buildConditionsFeel, waveFeelLevel, windFeelLevel } from '../utils/conditionsFeelPhrase';
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
