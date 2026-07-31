/**
 * «ΚΑΝΕΙ ΓΙΑ ΜΠΑΝΙΟ ΤΟΝ ΜΑΙΟ;» — Η ΘΕΡΜΟΚΡΑΣΙΑ ΤΟΥ ΝΕΡΟΥ ΑΝΑ ΜΗΝΑ.
 *
 * Η κάρτα «Νερό» της σελίδας παραλίας δείχνει τη ΣΗΜΕΡΙΝΗ τιμή. Κανείς που κλείνει
 * εισιτήρια τον Μάρτιο δεν τη βλέπει ποτέ. Αυτό το module βάζει το κλιματολογικό προφίλ
 * (scripts/buildWaterClimatology.py — 5 χρόνια δορυφορικής μέτρησης, κελί ~5 χλμ.) στους
 * ίδιους οδηγούς πρόθεσης που πήραν ήδη το κύμα.
 *
 * ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΑΞΙΖΕΙ ΤΗΝ ΠΑΡΑΓΡΑΦΟ: σε μεγάλο μέρος της Ελλάδας το νερό είναι πιο ζεστό
 * τον ΟΚΤΩΒΡΙΟ παρά τον ΙΟΥΝΙΟ — η θάλασσα αργεί να ζεσταθεί και αργεί να κρυώσει.
 * Αντι-διαισθητικό, το ψάχνει όποιος σκέφτεται διακοπές εκτός αιχμής, και κανένας οδηγός
 * ταξιδιού δεν το λέει με νούμερο. Λέγεται ΜΟΝΟ όπου ισχύει, υπολογισμένο ανά νησί, και
 * μόνο όταν η διαφορά ξεπερνά τον μισό βαθμό — κάτω από αυτό είναι μέσα στο σφάλμα του
 * πλέγματος και δεν αξίζει πρόταση.
 *
 * ΟΙ ΛΕΞΕΙΣ ΕΙΝΑΙ ΟΙ ΛΕΞΕΙΣ ΤΗΣ ΣΕΛΙΔΑΣ. «κρύο / μέτριο / ιδανικό» με τα ίδια ακριβώς
 * κατώφλια που χρησιμοποιεί το pages/BeachDetailPage.tsx. Προσοχή στο ανοιχτό άκρο: η
 * εφαρμογή λέει «μέτριο» για <= 24 και «ιδανικό» μόνο για > 24. Η πρώτη έκδοση του Python
 * έγραφε >= 24 και **164 μήνες** είχαν λάθος ταξινόμηση — ο οδηγός θα έλεγε «ιδανικό» για
 * μήνα που η σελίδα της παραλίας βάφει «μέτριο», χωρίς τίποτα να σκάσει.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΝΟΥΜΕΡΟ: κελί ~5 χλμ. ανοιχτά, όχι μέτρηση στην ακρογιαλιά. Οι
 * ρηχοί κλειστοί κόλποι τρέχουν πιο ζεστοί. Άρα το λάθος πέφτει προς τα κάτω — ο χρήστης
 * βρίσκει το νερό καλύτερο απ' ό,τι είπαμε, ποτέ χειρότερο — και η διατύπωση το λέει.
 */

import {
  MIN_BEACHES, PEAK_SEASON, decimal, median, monthName,
} from './seaSeasonProfile.mjs';

/** Ίδια κατώφλια με pages/BeachDetailPage.tsx· «ιδανικό» ΠΑΝΩ από 24, όχι από 24. */
export const WATER_COLD_BELOW_C = 21;
export const WATER_IDEAL_ABOVE_C = 24;

/** Οι μήνες που πρέπει να υπάρχουν όλοι για να βγει η παράγραφος. */
export const REQUIRED_WATER_MONTHS = [5, 6, 7, 8, 9];

/** Πόσο πρέπει να ξεπερνά ο Οκτώβριος τον Ιούνιο για να ειπωθεί (°C). */
const LATE_SEASON_MIN_DELTA_C = 0.5;

const waterTier = (celsius) => (
  celsius < WATER_COLD_BELOW_C ? 'cold' : celsius > WATER_IDEAL_ABOVE_C ? 'ideal' : 'moderate'
);

const TIER_WORDS = {
  cold: { en: 'cold', gr: 'κρύο', de: 'kalt', fr: 'froide', it: 'fredda' },
  moderate: { en: 'mild', gr: 'μέτριο', de: 'mild', fr: 'tempérée', it: 'tiepida' },
  ideal: { en: 'ideal', gr: 'ιδανικό', de: 'ideal', fr: 'idéale', it: 'ideale' },
};

/**
 * Το τυπικό προφίλ θερμοκρασίας ενός νησιού, ή null όταν λείπει κάλυψη.
 *
 * Διάμεσος και όχι μέσος όρος, για τον ίδιο λόγο με το κύμα: μία παραλία σε ασυνήθιστο
 * κελί δεν επιτρέπεται να σύρει ολόκληρο νησί.
 */
export const summariseIslandWater = (beachIds, climatology) => {
  const table = climatology?.beaches;
  if (!table || !Array.isArray(beachIds)) return null;

  const perMonth = new Map();
  let covered = 0;
  for (const id of beachIds) {
    const months = table[String(id)]?.temperature?.months;
    if (!months) continue;
    let usable = false;
    for (const [month, stats] of Object.entries(months)) {
      if (typeof stats?.medianC !== 'number') continue;
      usable = true;
      if (!perMonth.has(month)) perMonth.set(month, []);
      perMonth.get(month).push(stats.medianC);
    }
    if (usable) covered += 1;
  }
  if (covered < MIN_BEACHES) return null;

  const months = {};
  for (const [month, values] of perMonth) {
    const celsius = Number(median(values).toFixed(1));
    // Η βαθμίδα υπολογίζεται ΕΔΩ από τη διάμεσο του νησιού, όχι διαβάζεται από το αρχείο:
    // το `tier` εκεί περιγράφει ένα κελί, και η διάμεσος πολλών κελιών μπορεί να πέφτει
    // σε άλλη βαθμίδα από την πλειοψηφία τους.
    months[month] = { medianC: celsius, tier: waterTier(celsius), beaches: values.length };
  }
  if (!REQUIRED_WATER_MONTHS.every((m) => months[String(m)])) return null;

  const warmest = Object.entries(months)
    .filter(([m]) => Number(m) >= 5 && Number(m) <= 10)
    .reduce((best, cur) => (cur[1].medianC > best[1].medianC ? cur : best));
  const swimmable = [5, ...PEAK_SEASON, 10]
    .filter((m) => months[String(m)] && months[String(m)].tier !== 'cold')
    .sort((a, b) => a - b);

  const june = months['6']?.medianC;
  const october = months['10']?.medianC;

  return {
    months,
    beaches: covered,
    warmestMonth: Number(warmest[0]),
    firstSwimmableMonth: swimmable.length ? swimmable[0] : null,
    octoberBeatsJune: (typeof june === 'number' && typeof october === 'number'
      && october - june >= LATE_SEASON_MIN_DELTA_C),
    years: climatology?.sources?.temperature?.years ?? null,
    resolutionKm: climatology?.sources?.temperature?.resolutionKm ?? null,
  };
};

/** Η παράγραφος θερμοκρασίας, έτοιμη για ενότητα άρθρου — ή null. */
export const waterSeasonSection = (profile, language) => {
  if (!profile) return null;
  const { months, warmestMonth, beaches } = profile;
  const lang = TIER_WORDS.cold[language] ? language : 'en';
  const c = (m) => decimal(months[String(m)].medianC, lang, 1);
  const word = (m) => TIER_WORDS[months[String(m)].tier][lang];
  const years = profile.years ? `${profile.years[0]}–${profile.years[1]}` : '';
  const km = profile.resolutionKm ? decimal(profile.resolutionKm, lang, 0) : null;
  const october = months['10'];
  const beatsJune = Boolean(october) && profile.octoberBeatsJune;

  const late = {
    en: !october ? '' : beatsJune
      ? ` In October it is still ${c(10)} °C — warmer than June.`
      : ` By October it is ${c(10)} °C.`,
    gr: !october ? '' : beatsJune
      ? ` Τον Οκτώβριο είναι ακόμα ${c(10)} °C — πιο ζεστό από τον Ιούνιο.`
      : ` Τον Οκτώβριο πέφτει στους ${c(10)} °C.`,
    de: !october ? '' : beatsJune
      ? ` Im Oktober sind es noch ${c(10)} °C — wärmer als im Juni.`
      : ` Im Oktober sind es ${c(10)} °C.`,
    fr: !october ? '' : beatsJune
      ? ` En octobre elle est encore à ${c(10)} °C — plus chaude qu’en juin.`
      : ` En octobre elle est à ${c(10)} °C.`,
    it: !october ? '' : beatsJune
      ? ` A ottobre è ancora ${c(10)} °C — più calda che a giugno.`
      : ` A ottobre è ${c(10)} °C.`,
  };

  const source = {
    en: `Satellite measurements${years ? `, ${years}` : ''}${km ? `, from a sea cell about ${km} km offshore` : ''}; shallow bays usually run warmer than this.`,
    gr: `Δορυφορικές μετρήσεις${years ? `, ${years}` : ''}${km ? `, από κελί ~${km} χλμ. ανοιχτά` : ''}· οι ρηχοί κόλποι είναι συνήθως πιο ζεστοί από αυτό.`,
    de: `Satellitenmessungen${years ? `, ${years}` : ''}${km ? `, aus einer Meereszelle etwa ${km} km vor der Küste` : ''}; flache Buchten sind meist wärmer.`,
    fr: `Mesures satellite${years ? `, ${years}` : ''}${km ? `, dans une cellule marine à environ ${km} km au large` : ''} ; les baies peu profondes sont en général plus chaudes.`,
    it: `Misure satellitari${years ? `, ${years}` : ''}${km ? `, da una cella marina a circa ${km} km al largo` : ''}; le baie poco profonde sono di solito più calde.`,
  };

  const copy = {
    en: {
      heading: 'How warm is the water, month by month?',
      body: `Off ${beaches} of the beaches on this page the sea is typically ${c(5)} °C in May, ${c(6)} °C in June, ${c(7)} °C in July, ${c(8)} °C in August and ${c(9)} °C in September — ${word(8)} at the height of summer, ${word(6)} in June.${late.en} ${monthName(warmestMonth, 'en')} is the warmest month. ${source.en}`,
    },
    gr: {
      heading: 'Πόσο ζεστό είναι το νερό, μήνα με μήνα;',
      body: `Ανοιχτά από ${beaches} από τις παραλίες αυτής της σελίδας η θάλασσα είναι τυπικά ${c(5)} °C τον Μάιο, ${c(6)} °C τον Ιούνιο, ${c(7)} °C τον Ιούλιο, ${c(8)} °C τον Αύγουστο και ${c(9)} °C τον Σεπτέμβριο — ${word(8)} στην καρδιά του καλοκαιριού, ${word(6)} τον Ιούνιο.${late.gr} Ο πιο ζεστός μήνας είναι ο ${monthName(warmestMonth, 'gr')}ς. ${source.gr}`,
    },
    de: {
      heading: 'Wie warm ist das Wasser, Monat für Monat?',
      body: `Vor ${beaches} der Strände auf dieser Seite liegt das Meer typischerweise bei ${c(5)} °C im Mai, ${c(6)} °C im Juni, ${c(7)} °C im Juli, ${c(8)} °C im August und ${c(9)} °C im September — im Hochsommer ${word(8)}, im Juni ${word(6)}.${late.de} Der wärmste Monat ist der ${monthName(warmestMonth, 'de')}. ${source.de}`,
    },
    fr: {
      heading: 'Quelle est la température de l’eau, mois par mois ?',
      body: `Au large de ${beaches} des plages de cette page, la mer est typiquement à ${c(5)} °C en mai, ${c(6)} °C en juin, ${c(7)} °C en juillet, ${c(8)} °C en août et ${c(9)} °C en septembre — ${word(8)} au cœur de l’été, ${word(6)} en juin.${late.fr} Le mois le plus chaud est ${monthName(warmestMonth, 'fr')}. ${source.fr}`,
    },
    it: {
      heading: 'Quanto è calda l’acqua, mese per mese?',
      body: `Al largo di ${beaches} delle spiagge di questa pagina il mare è tipicamente a ${c(5)} °C a maggio, ${c(6)} °C a giugno, ${c(7)} °C a luglio, ${c(8)} °C ad agosto e ${c(9)} °C a settembre — ${word(8)} nel cuore dell’estate, ${word(6)} a giugno.${late.it} Il mese più caldo è ${monthName(warmestMonth, 'it')}. ${source.it}`,
    },
  };
  return copy[lang];
};

/** Προσθέτει την ενότητα θερμοκρασίας· content ανέπαφο όταν λείπουν δεδομένα. */
export const withWaterSeasonSection = (content, beachIds, climatology, language) => {
  const section = waterSeasonSection(summariseIslandWater(beachIds, climatology), language);
  if (!section) return content;
  return { ...content, sections: [...(content.sections || []), section] };
};
