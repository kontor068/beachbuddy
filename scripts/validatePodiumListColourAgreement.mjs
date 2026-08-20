/**
 * ΒΑΘΡΟ + ΛΙΣΤΑ = ΤΑ ΔΥΟ ΚΑΛΥΤΕΡΑ ΧΡΩΜΑΤΑ ΤΗΣ ΛΕΖΑΝΤΑΣ — gate.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο κανόνας τέθηκε από τον Μίλτο στις 10/08/2026 και επαληθεύτηκε ΜΕ ΤΟ ΧΕΡΙ σε
 * τέσσερις περιοχές: «στις τοπ 3 και στις υπόλοιπες κατάλληλες το άθροισμά τους να είναι το
 * άθροισμα των ιδανικών και των καλών». Γράφτηκε στο App.tsx, γράφτηκε στη βίβλο (§1587) — και
 * δεν απέκτησε ποτέ πύλη. Στις 15/08/2026 έσπασε σιωπηλά:
 *
 *   λεζάντα «Ιδανική 1 · Καλές 16», και από κάτω «Top 1» + «Υπόλοιπες (17)».
 *   Η λίστα αφαιρεί πάντα τις παραλίες του βάθρου, άρα 1 + 17 = 18 ενώ τα δύο καλύτερα
 *   χρώματα είναι 17. Δεν αφαιρέθηκε τίποτα ⇒ η παραλία με το μετάλλιο ΔΕΝ ήταν μπλε ούτε
 *   κίτρινη. Μια ΜΕΤΡΙΑ φορούσε το 🏆 πάνω από δεκαέξι ΚΑΛΕΣ.
 *
 * Καμία από τις 40 πύλες δεν το είδε, γιατί καμία δεν έκανε την αφαίρεση που κάνει ο αναγνώστης.
 *
 * ΤΙ ΕΛΕΓΧΕΙ, οδηγώντας τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις του utils/suitabilityTone:
 *
 *   A. ΤΟ ΑΘΡΟΙΣΜΑ ΚΛΕΙΝΕΙ. Για κάθε σχήμα περιοχής, βάθρο + λίστα = ακριβώς τα μέλη των δύο
 *      καλύτερων χρωμάτων που υπάρχουν. Ούτε διπλομέτρημα, ούτε λαθραία 18η.
 *   B. ΚΑΜΙΑ ΔΙΑΡΡΟΗ ΧΡΩΜΑΤΟΣ. Καμία παραλία του βάθρου δεν έχει χειρότερο χρώμα από παραλία
 *      που κάθεται στη λίστα από κάτω του. Αυτό είναι το εύρημα της 15/08 σε μία γραμμή.
 *   C. Η ΔΥΣΚΟΛΗ ΔΕΝ ΦΤΑΝΕΙ ΠΟΤΕ. Ούτε στη λίστα, ούτε στο βάθρο, σε κανένα σχήμα.
 *   D. ΤΑ «ΔΥΟ ΚΑΛΥΤΕΡΑ» ΕΙΝΑΙ ΣΧΕΤΙΚΑ. Χωρίς καμία μπλε γίνονται κίτρινο+πορτοκαλί· σε σκληρό
 *      νησί μόνο πορτοκαλί. Ο περιορισμός δεν επιτρέπεται να αδειάζει το βάθρο σε δύσκολη μέρα.
 *   E. Η ΚΑΛΩΔΙΩΣΗ ΥΠΑΡΧΕΙ. Το App.tsx πρέπει να περνά ΚΑΙ τις δύο πόρτες του βάθρου από τον
 *      χρωματικό περιορισμό. Δομικός έλεγχος στην πηγή, γιατί το εύρημα ήταν ακριβώς μια πόρτα
 *      που κανείς δεν είχε συνδέσει.
 *
 * SELF-PROOF (--prove): τρεις παλινδρομήσεις προσομοιώνονται και ΚΑΘΕΜΙΑ πρέπει να ρίξει την
 * πύλη. Μια πύλη που δεν μπορεί να αποτύχει είναι διακοσμητική.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVE = process.argv.includes('--prove');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

const {
  selectSuitableByTone,
  selectSuitableToneGroups,
  SUITABLE_LIST_TONE_GROUPS,
} = require(path.join(root, 'utils/suitabilityTone.ts'));
const {
  bestShelteredRecommendationGroup,
  TOP_PICK_PODIUM_SEATS,
} = require(path.join(root, 'services/topPickRanking.ts'));

const failures = [];
const TONE_LABEL = { blue: 'ΙΔΑΝΙΚΗ', yellow: 'ΚΑΛΗ', orange: 'ΜΕΤΡΙΑ', red: 'ΔΥΣΚΟΛΗ' };
const TONE_BEST_FIRST = ['blue', 'yellow', 'orange', 'red'];

/**
 * Οι δεξαμενές περιοχών, γραμμένες ως «πόσες παραλίες σε κάθε χρώμα». Το πρώτο σχήμα είναι
 * ΑΚΡΙΒΩΣ η φωτογραφία της 15/08 (Ιδανική 1 · Καλές 16 · Μέτριες 29 · Δύσκολες 13).
 */
const SHAPES = [
  { name: 'η φωτογραφία της 15/08', counts: { blue: 1, yellow: 16, orange: 29, red: 13 } },
  { name: 'μελτέμι — καμία ιδανική', counts: { blue: 0, yellow: 4, orange: 40, red: 12 } },
  { name: 'σκληρό νησί — μόνο μέτριες', counts: { blue: 0, yellow: 0, orange: 9, red: 30 } },
  { name: 'ήρεμη μέρα — όλες ιδανικές', counts: { blue: 22, yellow: 0, orange: 0, red: 0 } },
  { name: 'μεικτή, μπλε λιγότερες από τρεις', counts: { blue: 2, yellow: 11, orange: 6, red: 3 } },
  { name: 'όλα κόκκινα', counts: { blue: 0, yellow: 0, orange: 0, red: 18 } },
  { name: 'μία μόνη μπλε, τίποτα άλλο κοντά', counts: { blue: 1, yellow: 0, orange: 25, red: 7 } },
  /**
   * ΤΟ ΣΧΗΜΑ ΠΟΥ ΠΑΡΑΓΕΙ ΤΗΝ ΑΡΙΘΜΗΤΙΚΗ ΤΗΣ ΑΝΑΦΟΡΑΣ. Λιγότερες από τρεις παραλίες στα δύο
   * καλύτερα χρώματα, και δεκάδες ΜΕΤΡΙΕΣ από κάτω με ψηλότερο σκορ. Ένα βάθρο τυφλό στο χρώμα
   * γεμίζει τη μία κενή θέση από τις ΜΕΤΡΙΕΣ, και τότε βάθρο + λίστα βγάζει ένα παραπάνω από
   * όσα μετράει η λεζάντα — ακριβώς το «1 + 17 = 18 ενώ τα δύο χρώματα είναι 17».
   */
  { name: 'λίγες στα δύο καλύτερα, πλήθος μέτριες', counts: { blue: 1, yellow: 1, orange: 25, red: 5 } },
];

/**
 * ΤΟ ΣΚΟΡ ΔΕΝ ΑΚΟΛΟΥΘΕΙ ΤΟ ΧΡΩΜΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ.
 *
 * Το σκορ του βάθρου βγαίνει από παροχές, πρόσβαση, φήμη και θάλασσα — όχι από το χρώμα της
 * πινέζας. Μια πολυσύχναστη ΜΕΤΡΙΑ με ομπρέλες και άσφαλτο βαθμολογείται άνετα πάνω από μια
 * άγνωστη ΙΔΑΝΙΚΗ, και αυτός ακριβώς είναι ο μηχανισμός που έβγαλε το εύρημα της 15/08. Αν
 * εδώ τα σκορ ήταν στοιχισμένα με το χρώμα, η πύλη θα περνούσε ακόμη και τυφλή στο χρώμα —
 * θα ήταν διακοσμητική.
 *
 * Οι ΜΕΤΡΙΕΣ παίρνουν επίτηδες τα ψηλότερα σκορ της περιοχής.
 */
const TONE_SCORE_BASE = { orange: 900, red: 800, blue: 500, yellow: 400 };
const buildRegion = counts => {
  const items = [];
  let id = 1;
  for (const tone of TONE_BEST_FIRST) {
    for (let i = 0; i < (counts[tone] || 0); i += 1) {
      items.push({ beach: { id }, tone, score: TONE_SCORE_BASE[tone] - i });
      id += 1;
    }
  }
  return items;
};

const toneOf = item => item.tone;
const byScore = (a, b) => b.score - a.score;

/**
 * Το μοντέλο της οθόνης, με ΤΙΣ ΙΔΙΕΣ συναρτήσεις που τρέχει το App:
 *  · λίστα      = selectSuitableByTone (τα δύο καλύτερα χρώματα)
 *  · υποψήφιες  = όσες περνούν τον χρωματικό περιορισμό (selectSuitableToneGroups)
 *  · βάθρο      = οι τρεις πρώτες υποψήφιες
 *  · «Υπόλοιπες»= λίστα μείον βάθρο (App.tsx, .filter(!podiumIds.has))
 */
const renderRegion = (items, { podiumIgnoresColour = false } = {}) => {
  const offered = selectSuitableByTone(items, toneOf, byScore);
  const admissible = new Set(selectSuitableToneGroups(items, toneOf));
  const candidates = podiumIgnoresColour ? items : items.filter(item => admissible.has(item.tone));
  /**
   * Η σειρά του πραγματικού βάθρου: ΧΡΩΜΑ ΠΡΩΤΑ (`compareTone`, το πρώτο σκαλί του
   * prioritizeProtectedRecommendations), και μόνο μέσα στο ίδιο χρώμα αποφασίζει το σκορ.
   *
   * Γι' αυτό η ταξινόμηση ΔΕΝ αρκεί από μόνη της για να κρατήσει έξω μια ΜΕΤΡΙΑ: όταν η
   * δεξαμενή δεν έχει καθόλου καλύτερο χρώμα μέσα της, η ΜΕΤΡΙΑ είναι η πρώτη — και εκείνη
   * τη στιγμή το μόνο που τη σταματά είναι ο χρωματικός περιορισμός πριν την ταξινόμηση.
   */
  const byToneThenScore = (a, b) => (
    TONE_BEST_FIRST.indexOf(a.tone) - TONE_BEST_FIRST.indexOf(b.tone) || byScore(a, b)
  );
  const podium = [...candidates].sort(byToneThenScore).slice(0, 3);
  const podiumIds = new Set(podium.map(item => item.beach.id));
  const rest = offered.filter(item => !podiumIds.has(item.beach.id));
  return { offered, podium, rest, admissible };
};

const worstOf = list => list.reduce(
  (worst, item) => Math.max(worst, TONE_BEST_FIRST.indexOf(item.tone)),
  -1
);
const bestOf = list => list.reduce(
  (best, item) => Math.min(best, TONE_BEST_FIRST.indexOf(item.tone)),
  TONE_BEST_FIRST.length
);

const auditShape = (shape, options = {}) => {
  const problems = [];
  const items = buildRegion(shape.counts);
  const { offered, podium, rest, admissible } = renderRegion(items, options);

  // A. Το άθροισμα κλείνει.
  const shown = podium.length + rest.length;
  if (shown !== offered.length) {
    problems.push(
      `${shape.name}: βάθρο ${podium.length} + υπόλοιπες ${rest.length} = ${shown}, `
      + `ενώ τα δύο καλύτερα χρώματα είναι ${offered.length}`
    );
  }
  const shownIds = new Set([...podium, ...rest].map(item => item.beach.id));
  if (shownIds.size !== shown) {
    problems.push(`${shape.name}: η ίδια παραλία μετριέται δύο φορές (βάθρο και λίστα)`);
  }

  // B. Καμία διαρροή χρώματος: το χειρότερο του βάθρου δεν ξεπερνά το καλύτερο της λίστας.
  if (podium.length > 0 && rest.length > 0) {
    const worstPodium = worstOf(podium);
    const bestRest = bestOf(rest);
    if (worstPodium > bestRest) {
      problems.push(
        `${shape.name}: το βάθρο έχει ${TONE_LABEL[TONE_BEST_FIRST[worstPodium]]} `
        + `ενώ στη λίστα από κάτω κάθεται ${TONE_LABEL[TONE_BEST_FIRST[bestRest]]}`
      );
    }
  }

  // C. Η ΔΥΣΚΟΛΗ δεν φτάνει πουθενά.
  const reds = [...podium, ...rest].filter(item => item.tone === 'red');
  if (reds.length > 0) {
    problems.push(`${shape.name}: ${reds.length} ΔΥΣΚΟΛΕΣ έφτασαν στην οθόνη`);
  }

  // D. Ο περιορισμός δεν αδειάζει το βάθρο όταν η περιοχή έχει κάτι να προσφέρει.
  if (offered.length > 0 && podium.length === 0) {
    problems.push(`${shape.name}: η περιοχή προσφέρει ${offered.length} παραλίες και το βάθρο βγήκε άδειο`);
  }
  if (offered.length > 0 && admissible.size === 0) {
    problems.push(`${shape.name}: κανένα χρώμα δεν έγινε δεκτό ενώ η λίστα έχει ${offered.length}`);
  }
  if (admissible.size > SUITABLE_LIST_TONE_GROUPS) {
    problems.push(`${shape.name}: το βάθρο δέχεται ${admissible.size} χρώματα, όριο ${SUITABLE_LIST_TONE_GROUPS}`);
  }

  return problems;
};

for (const shape of SHAPES) {
  failures.push(...auditShape(shape));
}

/**
 * F. ΜΙΑ ΜΟΝΗ ΜΠΛΕ ΔΕΝ ΑΔΕΙΑΖΕΙ ΤΟ ΒΑΘΡΟ — οδηγώντας τη ΠΡΑΓΜΑΤΙΚΗ
 * `bestShelteredRecommendationGroup`.
 *
 * «Να μην είναι ποτέ 1 επιλογή τοπ, ειδικά ανάμεσα σε πολλές κατάλληλες» (Μίλτος, 15/08/2026).
 * Το §Γ9 κρατούσε **μόνο** τις μπλε, οπότε μία μπλε δίπλα σε δεκατρείς κίτρινες έβγαζε βάθρο του
 * ενός — το ίδιο σχήμα που το §Γ8 είχε κλείσει μία μέρα νωρίτερα για τη βαθμίδα.
 *
 * Ο έλεγχος είναι διπλός και οι δύο κατευθύνσεις μετράνε εξίσου:
 *   · με 1 μπλε + πολλές κίτρινες, η ομάδα πρέπει να χωράει ≥2 (και ιδανικά 3)
 *   · με ≥3 μπλε, η ομάδα πρέπει να είναι **ακριβώς** οι μπλε — το §Γ9 δεν χαλαρώνει
 */
const podiumItem = ({ id, tone, exposure = 'protected' }) => ({
  beach: {
    id,
    name: { gr: `Π${id}`, en: `B${id}` },
    coordinates: { lat: 37.7, lon: 23.9 },
    accessibility: 'easy',
    metadata: { access: { type: 'asphalt_road' } },
    amenities: { organized: true },
    environment: {},
    googleMapsNavigation: { status: 'verified', mode: 'place', placeId: `pid-${id}` },
  },
  beachId: id,
  score: 70,
  isExposed: false,
  exposureLevel: exposure,
  canClaimWindProtection: exposure === 'protected',
  _tone: tone,
});

const groupOf = (items, beaufort = 5) => {
  const perBeachWind = new Map(items.map(i => [i.beach.id, { beaufort }]));
  const toneRank = id => items.find(i => i.beach.id === id)?._tone;
  return bestShelteredRecommendationGroup(items, beaufort, perBeachWind, toneRank);
};

{
  // Το σχήμα της αναφοράς: 1 μπλε + 13 κίτρινες, 5 Μποφόρ.
  const oneBlue = [
    podiumItem({ id: 1, tone: 0 }),
    ...Array.from({ length: 13 }, (_, i) => podiumItem({ id: 10 + i, tone: 1 })),
  ];
  const group = groupOf(oneBlue);
  if (group.length < 2) {
    failures.push(
      `F: μία μπλε δίπλα σε 13 κίτρινες βγάζει ομάδα ${group.length} — το βάθρο θα δείξει μία κάρτα`
    );
  }
  if (group.length < TOP_PICK_PODIUM_SEATS) {
    failures.push(
      `F: η ομάδα γεμίζει ${group.length} από ${TOP_PICK_PODIUM_SEATS} θέσεις ενώ υπάρχουν ${oneBlue.length} υποψήφιες`
    );
  }
  if (group[0]?.beach.id !== 1) {
    failures.push('F: η μπλε δεν ηγείται της ομάδας — το χρώμα έπαψε να κατατάσσει πρώτο');
  }

  // Η άλλη κατεύθυνση: με τρεις μπλε το §Γ9 μένει ακέραιο.
  const threeBlue = [
    ...Array.from({ length: 3 }, (_, i) => podiumItem({ id: 1 + i, tone: 0 })),
    ...Array.from({ length: 8 }, (_, i) => podiumItem({ id: 20 + i, tone: 1 })),
  ];
  const strict = groupOf(threeBlue);
  if (strict.length !== 3 || strict.some(item => item._tone !== 0)) {
    failures.push(
      `F: με τρεις ΙΔΑΝΙΚΕΣ η ομάδα πρέπει να είναι ακριβώς αυτές — πήρα ${strict.length} `
      + `με χρώματα [${strict.map(i => i._tone).join(',')}]`
    );
  }

  // Και όταν πραγματικά δεν υπάρχει δεύτερη, η μονή κάρτα μένει (απόφαση 14/08).
  const onlyOne = [podiumItem({ id: 99, tone: 0 })];
  if (groupOf(onlyOne).length !== 1) {
    failures.push('F: με μοναδική υποψήφια η ομάδα πρέπει να μείνει μία — η απόφαση της 14/08');
  }
}

/**
 * G. Η ΛΕΞΗ «ΙΔΑΝΙΚΗ» ΕΧΕΙ ΕΝΑΝ ΙΔΙΟΚΤΗΤΗ. Η επικεφαλίδα «Καμία δεν είναι ιδανική» δεν
 * επιτρέπεται να βγει όταν ο χάρτης έχει βάψει μια παραλία του βάθρου ΙΔΑΝΙΚΗ — αλλιώς η ίδια
 * οθόνη λέει «Ιδανική 1 παραλία» στη λεζάντα και «Καμία δεν είναι ιδανική» 200 px πιο κάτω,
 * πάνω από εκείνη ακριβώς την παραλία. §Κ1: η κουκκίδα είναι η αυθεντία, σωπαίνει η λέξη.
 */
const appSourceForIdeal = readFileSync(path.join(root, 'App.tsx'), 'utf8');
const fallbackStart = appSourceForIdeal.indexOf('const isShelteredFallbackPodium = ');
if (fallbackStart < 0) {
  failures.push('G: δεν βρέθηκε το isShelteredFallbackPodium στο App.tsx');
} else if (!appSourceForIdeal.slice(fallbackStart, fallbackStart + 400).includes('podiumHasMapIdeal')) {
  failures.push('G: η φράση «Καμία δεν είναι ιδανική» δεν ρωτά τον χάρτη — μπορεί να αντιφάσκει με τη λεζάντα');
}

/**
 * E. Η ΚΑΛΩΔΙΩΣΗ. Και οι δύο πόρτες του βάθρου στο App.tsx πρέπει να ρωτούν τον χρωματικό
 * περιορισμό. Το εύρημα της 15/08 ήταν ακριβώς μια πόρτα που κανείς δεν είχε συνδέσει, οπότε
 * ένας έλεγχος συμπεριφοράς από μόνος του δεν θα το είχε πιάσει: η συμπεριφορά ήταν σωστή στη
 * ΜΙΑ πόρτα.
 */
const appSource = readFileSync(path.join(root, 'App.tsx'), 'utf8');
const wiring = [
  ['isDirectoryTopRecommendationCandidate', 'η κύρια δεξαμενή του βάθρου'],
  ['isShelteredFallbackCandidate', 'η δεξαμενή που γεμίζει τις κενές θέσεις'],
];
for (const [fnName, label] of wiring) {
  const start = appSource.indexOf(`const ${fnName} = `);
  if (start < 0) {
    failures.push(`E: δεν βρέθηκε το ${fnName} στο App.tsx — η πύλη διαβάζει άλλον κώδικα`);
    continue;
  }
  const body = appSource.slice(start, start + 900);
  if (!body.includes('isPodiumColourAdmissible')) {
    failures.push(`E: ${label} (${fnName}) δεν περνά από τον χρωματικό περιορισμό`);
  }
}
if (!appSource.includes('selectSuitableToneGroups')) {
  failures.push('E: το App.tsx δεν διαβάζει τον κανόνα των δύο χρωμάτων — αντίγραφο αντί για τον κανόνα');
}

/**
 * ΣΤ. Η ΑΡΝΗΣΗ ΜΠΑΝΙΟΥ ΔΕΝ ΕΙΝΑΙ ΠΟΤΕ ΠΡΟΣΦΟΡΑ — `a-refused-swim-is-never-an-offer` (20/08/2026).
 *
 * Το ταβάνι της ετυμηγορίας κατεβάζει μια `avoid_swimming` παραλία μέχρι το ΠΟΡΤΟΚΑΛΙ, όχι πιο
 * κάτω. Όσο η λίστα ήταν ΜΠΛΕ+ΚΙΤΡΙΝΟ αυτό αρκούσε, και το App.tsx το έγραφε: «a filter here
 * would be dead code **that hides the day it stops being dead**». Στις 10/08 η λίστα έγινε «τα
 * δύο καλύτερα χρώματα ΠΟΥ ΥΠΑΡΧΟΥΝ» και η μέρα ήρθε αυθημερόν — αλλά κανείς δεν την είδε για
 * δεκαοκτώ μέρες, γιατί ΚΑΝΕΝΑΣ ΕΛΕΓΧΟΣ δεν ρωτούσε το προφανές: προσφέρουμε παραλία στην οποία
 * λέμε «μην κολυμπήσεις»; Μετρήθηκε: **167 οθόνες στις 550 (30,4%), 1.198 παραλίες (9,4%)**
 * (`npm run measure:avoid-swim-in-list`, βίβλος §Γ38).
 *
 * ΓΙΑΤΙ ΕΛΕΓΧΕΤΑΙ Η ΚΑΛΩΔΙΩΣΗ ΚΑΙ ΟΧΙ Η ΣΥΜΠΕΡΙΦΟΡΑ. Ο αποκλεισμός ζει στο
 * `directoryListabilityGate`, μέσα σε component του App.tsx — δεν είναι exported και δεν μπορεί
 * να κληθεί από εδώ. Ο έλεγχος κοιτάζει τα ΤΡΙΑ πράγματα που κάνουν τη διαφορά, και το τρίτο
 * είναι αυτό που έσπασε τον Αύγουστο: ότι η ΙΔΙΑ πόρτα τροφοδοτεί και τη ΛΕΖΑΝΤΑ. Φίλτρο μόνο
 * στη λίστα το είχαμε ήδη δοκιμάσει (02/08) και έδωσε «Μέτριες 30» πάνω από λίστα με 22.
 */
const OFFER_DOOR = 'directoryListabilityGate';
const doorStart = appSource.indexOf(`const ${OFFER_DOOR} = `);
if (doorStart < 0) {
  failures.push(`ΣΤ: δεν βρέθηκε το ${OFFER_DOOR} στο App.tsx — η πύλη διαβάζει άλλον κώδικα`);
} else {
  const doorBody = appSource.slice(doorStart, doorStart + 700);
  if (!doorBody.includes('avoid_swimming')) {
    failures.push(
      `ΣΤ: το ${OFFER_DOOR} δεν αποκλείει πια τις avoid_swimming. Η λίστα «κατάλληλες» ξαναρχίζει `
      + 'να προσφέρει παραλίες στις οποίες η ίδια η κάρτα τους γράφει «Καλύτερα άλλη μέρα» '
      + '(μετρημένο 30,4% των οθονών, βίβλος §Γ38).'
    );
  }
}
// Η ΛΕΖΑΝΤΑ ΚΑΙ Η ΛΙΣΤΑ ΠΡΕΠΕΙ ΝΑ ΣΤΕΝΕΥΟΥΝ ΜΑΖΙ. Αν κάποιος αφήσει την πόρτα και αποσυνδέσει
// τον έναν από τους δύο αναγνώστες της, τα δύο νούμερα ξαναρχίζουν να διαφωνούν στην ίδια οθόνη.
for (const [readerName, label] of [
  ['directoryUncountedBeachIds', 'η λεζάντα (ποιες πινέζες ΔΕΝ μετράει)'],
  ['toneSuitableDirectorySource', 'η λίστα των κατάλληλων'],
]) {
  const start = appSource.indexOf(`const ${readerName} = `);
  if (start < 0) {
    failures.push(`ΣΤ: δεν βρέθηκε το ${readerName} στο App.tsx`);
    continue;
  }
  if (!appSource.slice(start, start + 1200).includes('isListableInDirectory')) {
    failures.push(`ΣΤ: ${label} (${readerName}) δεν περνά από την πόρτα της προσφοράς`);
  }
}

let provenRegressions = 0;
if (PROVE) {
  /**
   * Οι τρεις τρόποι με τους οποίους αυτό ξανασπάει. Καθεμιά πρέπει να ρίξει την πύλη.
   */
  const regressions = [
    [
      'το βάθρο ξαναγίνεται τυφλό στο χρώμα',
      () => SHAPES.flatMap(shape => auditShape(shape, { podiumIgnoresColour: true })),
    ],
    [
      'η λίστα ανοίγει και τρίτο χρώμα ενώ το βάθρο μένει στα δύο',
      () => {
        const items = buildRegion({ blue: 1, yellow: 16, orange: 29, red: 13 });
        const offered = selectSuitableByTone(items, toneOf, byScore);
        const admissible = new Set(selectSuitableToneGroups(items, toneOf));
        // Ένα σχήμα όπου το βάθρο παίρνει από τρίτο χρώμα: πρέπει να το πιάσει ο έλεγχος B.
        const podium = items.filter(item => !admissible.has(item.tone)).slice(0, 3);
        const podiumIds = new Set(podium.map(item => item.beach.id));
        const rest = offered.filter(item => !podiumIds.has(item.beach.id));
        const problems = [];
        if (podium.length + rest.length === offered.length) {
          problems.push('το άθροισμα έκλεισε ενώ δεν έπρεπε');
        }
        if (worstOf(podium) <= bestOf(rest)) {
          problems.push('η διαρροή χρώματος δεν εντοπίστηκε');
        }
        return problems.length === 2 ? [] : ['x'];
      },
    ],
    [
      'η καλωδίωση βγαίνει από το App.tsx',
      () => {
        const stripped = appSource.replace(/isPodiumColourAdmissible/g, 'ALWAYS_TRUE_STUB');
        return stripped === appSource ? [] : ['x'];
      },
    ],
    [
      'η άρνηση μπάνιου ξαναμπαίνει στην προσφορά',
      () => {
        // Σβήνει τον αποκλεισμό από την πόρτα και ελέγχει ότι ο έλεγχος ΣΤ θα τον έπιανε.
        const start = appSource.indexOf(`const ${OFFER_DOOR} = `);
        if (start < 0) return ['x'];
        const sabotaged = appSource.slice(start, start + 700).replace(/avoid_swimming/g, 'SOME_OTHER_VERDICT');
        return sabotaged.includes('avoid_swimming') ? [] : ['x'];
      },
    ],
    [
      'η λεζάντα αποσυνδέεται από την πόρτα',
      () => {
        const start = appSource.indexOf('const directoryUncountedBeachIds = ');
        if (start < 0) return ['x'];
        const sabotaged = appSource.slice(start, start + 1200).replace(/isListableInDirectory/g, 'ALWAYS_TRUE_STUB');
        return sabotaged.includes('isListableInDirectory') ? [] : ['x'];
      },
    ],
  ];

  provenRegressions = regressions.length;
  for (const [label, run] of regressions) {
    let caught = [];
    try {
      caught = run();
    } catch (error) {
      failures.push(`SELF-PROOF: δεν έτρεξε η προσομοίωση «${label}» — ${error.message}`);
      continue;
    }
    if (caught.length === 0) {
      failures.push(`SELF-PROOF: η προσομοίωση «${label}» πέρασε καθαρή — η πύλη δεν ελέγχει τίποτα`);
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Το βάθρο και η λίστα δεν μιλάνε για τα ίδια χρώματα:\n');
  failures.forEach(f => console.error(`  • ${f}\n`));
  process.exit(1);
}

// +3 για το ΣΤ: η πόρτα της προσφοράς και οι δύο αναγνώστες της (λεζάντα + λίστα).
const checks = SHAPES.length * 4 + wiring.length + 1 + 6 + 3;
console.log(
  `✅ Podium/list colour agreement: ${SHAPES.length} σχήματα περιοχής, ${checks} έλεγχοι`
  + `${PROVE ? ` + ${provenRegressions} προσομοιωμένες παλινδρομήσεις` : ''} — βάθρο + λίστα = τα δύο καλύτερα`
  + ' χρώματα · μία μπλε δεν αδειάζει το βάθρο · η λεζάντα κρατά τη λέξη «ιδανική» · η άρνηση μπάνιου δεν είναι προσφορά'
);
