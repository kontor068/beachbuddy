// ─────────────────────────────────────────────────────────────────────────────
// ΤΑ ΣΗΜΑΤΑ ΜΕΣΑ ΣΤΑ ΣΧΟΛΙΑ ΤΩΝ ΕΠΙΣΚΕΠΤΩΝ — μία αριθμητική, δύο αναγνώστες.
//
// Το ίδιο άθροισμα το χρειάζονται δύο μέρη: το `scripts/calibrateFromFeedback.mjs`
// (χειροκίνητο πέρασμα βαθμονόμησης) και η προγραμματισμένη `feedback-watch.mjs`
// (αυτόματος έλεγχος που στέλνει Telegram). Δύο αντίγραφα της ίδιας αριθμητικής θα
// απέκλιναν μέσα σε έναν μήνα — και τότε το μήνυμα στο κινητό θα έλεγε άλλο πράγμα
// από την αναφορά που τρέχεις με το χέρι. Ίδιο μοτίβο με το lib/qualityPriority.mjs.
//
// ΠΟΛΙΤΙΚΗ (ίδια με τον κανόνα απόδειξης του έργου): το επικίνδυνο λάθος είναι το
// λανθασμένο «ήρεμα». Οπότε το σήμα UNDER_WARN (ο επισκέπτης είδε ΧΕΙΡΟΤΕΡΑ απ' ό,τι
// δείχναμε) προτείνεται εύκολα, ενώ το OVER_WARN (μαλάκωμα) θέλει περισσότερα
// δείγματα, μεγαλύτερο ποσοστό, και ΠΟΤΕ δεν εφαρμόζεται αυτόματα.
//
// Καθαρές συναρτήσεις: καμία ανάγνωση αρχείου, κανένα δίκτυο, καμία εξάρτηση από
// Netlify. Ό,τι χρειάζεται ονόματα παραλιών το παίρνει από τον `describe` που του
// δίνει ο καλών.
// ─────────────────────────────────────────────────────────────────────────────

/** «Χειρότερα απ' ό,τι δείχναμε» — το μόνο είδος σχολίου που κρύβει σφάλμα πρόβλεψης. */
export const NEGATIVE_VERDICTS = new Set(['had_waves', 'too_windy', 'not_accurate']);

/** Πόσες αναφορές χρειάζεται ένα κελί (παραλία, άνεμος) πριν πούμε οτιδήποτε. */
export const MIN_SAMPLES = 3;
/** Από πόσο αρνητικές και πάνω γίνεται πρόταση για ΑΥΞΗΣΗ έκθεσης (η ασφαλής φορά). */
export const UNDER_WARN_FRACTION = 0.5;
/** Το μαλάκωμα είναι η λιγότερο συντηρητική φορά — ζητάει περισσότερα. */
export const SOFTEN_MIN_SAMPLES = 6;
export const SOFTEN_FRACTION = 0.66;

/** Οι τιμές που γράφει η εφαρμογή (types.ts WindDirection) σε ανθρώπινα ελληνικά. */
export const WIND_DIR_EL = {
  North: 'βόρειος (Β)',
  Northeast: 'βορειοανατολικός (ΒΑ)',
  East: 'ανατολικός (Α)',
  Southeast: 'νοτιοανατολικός (ΝΑ)',
  South: 'νότιος (Ν)',
  Southwest: 'νοτιοδυτικός (ΝΔ)',
  West: 'δυτικός (Δ)',
  Northwest: 'βορειοδυτικός (ΒΔ)',
};

export const windDirLabel = (sector) => WIND_DIR_EL[sector] || sector || 'άγνωστος άνεμος';

/** Το κλειδί ενός κελιού — ίδιο σε script και συνάρτηση, γιατί πάνω του κρατιέται η μνήμη. */
export const cellKey = (beachId, sector) => `${beachId}|${sector}`;

/**
 * Ένα κελί ανά (παραλία, τομέας ανέμου). Ο τομέας είναι η μονάδα που έχει νόημα:
 * μια παραλία μπορεί να είναι σωστά «ήρεμη» με νοτιά και λάθος «ήρεμη» με βοριά,
 * και ένας μέσος όρος πάνω σε όλους τους ανέμους θα έσβηνε ακριβώς αυτή τη διαφορά.
 *
 * Κρατάει επίσης ό,τι βοηθάει έναν άνθρωπο να πάει στην παραλία: όνομα, μονοπάτι
 * σελίδας και πότε ήρθε η τελευταία αναφορά. Οι παλιές εγγραφές δεν έχουν όνομα —
 * γι' αυτό ο `describe` υπάρχει ως εφεδρεία.
 */
export const aggregateFeedback = (records) => {
  const cells = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (typeof record?.beachId !== 'number' || !Number.isFinite(record.beachId)) continue;
    const sector = record.conditions?.windDir || '?';
    const key = cellKey(record.beachId, sector);
    if (!cells.has(key)) {
      cells.set(key, {
        key,
        beachId: record.beachId,
        sector,
        verdicts: {},
        modeled: {},
        n: 0,
        lastAt: '',
        beachName: '',
        pagePath: '',
      });
    }
    const cell = cells.get(key);
    cell.verdicts[record.feedback] = (cell.verdicts[record.feedback] || 0) + 1;
    if (record.conditions?.exposureLevel) {
      cell.modeled[record.conditions.exposureLevel] = (cell.modeled[record.conditions.exposureLevel] || 0) + 1;
    }
    cell.n += 1;
    const at = String(record.timestamp || '');
    if (at > cell.lastAt) cell.lastAt = at;
    if (!cell.beachName && record.beachName) cell.beachName = String(record.beachName);
    if (!cell.pagePath && record.pagePath) cell.pagePath = String(record.pagePath);
  }
  return cells;
};

const negativeCount = (verdicts) =>
  Object.entries(verdicts).reduce((sum, [verdict, count]) => (NEGATIVE_VERDICTS.has(verdict) ? sum + count : sum), 0);

/**
 * Από τα κελιά στις προτάσεις. `describe(beachId)` επιστρέφει `{ name, region }` —
 * το script το διαβάζει από τα JSON των παραλιών, η συνάρτηση από το ημερολόγιο
 * ποιότητας. Ό,τι κι από τα δύο λείπει, μένει το `#id`, που τουλάχιστον δεν λέει ψέματα.
 */
export const buildProposals = (cells, describe = () => ({})) => {
  const proposals = [];
  for (const cell of cells.values()) {
    const neg = negativeCount(cell.verdicts);
    const calmer = cell.verdicts.calmer || 0;
    // «Δείχναμε ήρεμα» = protected ή partial. Χωρίς αυτό, ένα «είχε κύμα» πάνω σε
    // παραλία που ΗΔΗ τη δείχναμε εκτεθειμένη θα μετρούσε σαν σφάλμα μας.
    const modeledCalm = (cell.modeled.protected || 0) + (cell.modeled.partial || 0);
    const info = describe(cell.beachId) || {};
    const name = cell.beachName || info.name || `#${cell.beachId}`;
    const base = {
      beachId: cell.beachId,
      name,
      region: info.region || '',
      sector: cell.sector,
      samples: cell.n,
      lastAt: cell.lastAt || undefined,
      pagePath: cell.pagePath || undefined,
      key: cell.key,
    };

    if (cell.n >= MIN_SAMPLES && neg / cell.n >= UNDER_WARN_FRACTION && modeledCalm > 0) {
      proposals.push({
        ...base,
        type: 'UNDER_WARN',
        negative: neg,
        autoSafe: true,
        action: `Model showed calm/partial but ${neg}/${cell.n} reported waves/wind from ${cell.sector}. Add '${cell.sector}' to exposedToWindDirections (or raise localWindAmplification) in utils/windProfileOverrides.ts, and lock a 'rough' anchor in scripts/validateWindExposureGroundTruth.mjs.`,
      });
    } else if (cell.n >= SOFTEN_MIN_SAMPLES && calmer / cell.n >= SOFTEN_FRACTION) {
      proposals.push({
        ...base,
        type: 'OVER_WARN',
        calmer,
        autoSafe: false,
        action: `Model showed exposed but ${calmer}/${cell.n} reported calmer from ${cell.sector}. SOFTEN ONLY with a 2nd independent source (manual review per the evidence rule) — never auto-applied.`,
      });
    }
  }

  // Πρώτα όσα έχουν τα περισσότερα δείγματα: εκεί η απόδειξη είναι πιο στέρεη.
  return proposals.sort((a, b) => b.samples - a.samples);
};
