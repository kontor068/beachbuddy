/**
 * «ΠΟΤΕ ΕΙΝΑΙ ΗΡΕΜΗ Η ΘΑΛΑΣΣΑ ΕΔΩ;» — ΤΟ ΕΝΑ ΕΡΩΤΗΜΑ ΠΟΥ Η ΕΦΑΡΜΟΓΗ ΔΕΝ ΑΠΑΝΤΟΥΣΕ.
 *
 * Η εφαρμογή απαντά άριστα στο «πώς είναι σήμερα». Ο επισκέπτης που κλείνει εισιτήρια τον
 * Μάρτιο ρωτάει κάτι άλλο: τι να περιμένω. Αυτό το module μετατρέπει την κλιματολογία των
 * 10 ετών (scripts/buildWaveClimatology.py) σε μία παράγραφο ανά νησί, για τους οδηγούς
 * πρόθεσης — τις σελίδες που φέρνουν ~14 φορές περισσότερα κλικ από μια σελίδα παραλίας.
 *
 * Γιατί είναι .mjs και όχι .ts: το prerender είναι απλό Node script και εισάγει ήδη έτσι
 * (utils/localWindContext.mjs). Έτσι το ίδιο αρχείο τρέχει και στο build και στην πύλη
 * που το ελέγχει, χωρίς βήμα μεταγλώττισης — άρα η πύλη δοκιμάζει ΤΟΝ ΙΔΙΟ κώδικα που
 * γράφει τις σελίδες, όχι ένα αντίγραφό του.
 *
 * ΤΡΕΙΣ ΚΑΝΟΝΕΣ ΤΙΜΙΟΤΗΤΑΣ, και οι τρεις επιβάλλονται με κώδικα παρακάτω:
 *
 *   1. Το νούμερο περιγράφει ΤΗ ΘΑΛΑΣΣΑ ΜΠΡΟΣΤΑ, όχι την παραλία. Το κελί των 4,2 χλμ.
 *      δεν βλέπει τον όρμο ή τον κάβο που κόβει το κύμα, άρα για προστατευμένες παραλίες
 *      διαβάζει πιο άγριο απ' ό,τι είναι. Η διατύπωση δεν επιτρέπεται να το ξεχάσει.
 *   2. Ένα νησί χρειάζεται τουλάχιστον MIN_BEACHES παραλίες με δεδομένα. Ένα ποσοστό
 *      βγαλμένο από μία παραλία δεν είναι προφίλ νησιού· είναι ένα κελί με σοβαρό ύφος.
 *   3. Χρειάζονται ΟΛΟΙ οι μήνες της ιστορίας. Μισή σεζόν βγάζει «ο Ιούλιος είναι ήρεμος»
 *      χωρίς το «ο Σεπτέμβρης πιο ήρεμος», που είναι ακριβώς η χρήσιμη πληροφορία.
 */

import { getRegionWindContext, LOCAL_WIND_ATOMS, LOCAL_WIND_LABEL } from './localWindContext.mjs';

/** Χωρίς τόσες παραλίες, το νούμερο δεν δημοσιεύεται καθόλου. */
export const MIN_BEACHES = 3;

/** Οι μήνες που πρέπει να υπάρχουν όλοι για να βγει η παράγραφος. */
export const REQUIRED_MONTHS = [6, 7, 8, 9];

/**
 * Ο πιο ήρεμος μήνας ψάχνεται ΜΟΝΟ μέσα στην υψηλή σεζόν.
 *
 * Με ολόκληρο το Μάιο-Οκτώβριο στο παιχνίδι, η απάντηση είναι σχεδόν πάντα «ο Μάιος» — και
 * είναι αληθής και εντελώς άχρηστη για κάποιον που ρωτάει πότε να κλείσει το καλοκαίρι
 * του. Ιούνιος-Σεπτέμβριος είναι το διάστημα όπου η απάντηση αλλάζει ανά νησί και
 * μεταφράζεται σε πραγματική απόφαση («έλα Σεπτέμβρη αντί Αύγουστο»).
 */
export const PEAK_SEASON = [6, 7, 8, 9];

export const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Το τυπικό προφίλ ενός νησιού ανά μήνα, ή null όταν δεν υπάρχει αρκετή κάλυψη.
 *
 * Διάμεσος και όχι μέσος όρος: μία παραλία σε ακραία εκτεθειμένο κάβο θα τραβούσε τον
 * μέσο όρο ενός ολόκληρου νησιού προς τα κάτω και ο οδηγός θα έλεγε «ταραγμένα» για
 * νησί που δεν είναι.
 */
export const summariseIslandSeason = (beachIds, climatology) => {
  const table = climatology?.beaches;
  if (!table || !Array.isArray(beachIds)) return null;

  // Δύο σχήματα, γιατί το ωριαίο σύνολο κοστίζει ώρες και το μηνιαίο λεπτά (δες την
  // επικεφαλίδα του scripts/buildWaveClimatology.py). Το `kind` ΔΕΝ μαντεύεται από τα
  // πεδία: διαβάζεται από το ίδιο το αρχείο, ώστε ένα μισοσυμπληρωμένο αρχείο να μη
  // διαβαστεί ποτέ ως το άλλο είδος και να βγάλει ποσοστά που κανείς δεν μέτρησε.
  const kind = climatology?.source?.kind === 'hourly-percentiles' ? 'percentiles' : 'typical';

  const perMonth = new Map();
  let covered = 0;
  for (const id of beachIds) {
    const entry = table[String(id)];
    if (!entry?.months) continue;
    let usable = false;
    for (const [month, stats] of Object.entries(entry.months)) {
      const value = kind === 'percentiles' ? stats?.calmPct : stats?.typicalM;
      if (typeof value !== 'number') continue;
      usable = true;
      if (!perMonth.has(month)) perMonth.set(month, []);
      perMonth.get(month).push(value);
    }
    if (usable) covered += 1;
  }
  if (covered < MIN_BEACHES) return null;

  const months = {};
  for (const [month, values] of perMonth) {
    months[month] = kind === 'percentiles'
      ? { calmPct: Math.round(median(values)), beaches: values.length }
      : { typicalM: Number(median(values).toFixed(2)), beaches: values.length };
  }
  if (!REQUIRED_MONTHS.every((m) => months[String(m)])) return null;

  // Ο πιο ήρεμος μήνας της σεζόν είναι η μισή απάντηση στο «πότε να έρθω» — και είναι
  // συχνά ο Σεπτέμβριος, που είναι ακριβώς η μη-προφανής πληροφορία που κανείς οδηγός
  // ταξιδιού δεν δίνει με νούμερο.
  const calmerOf = (a, b) => (kind === 'percentiles'
    ? (a[1].calmPct > b[1].calmPct ? a : b)
    : (a[1].typicalM < b[1].typicalM ? a : b));
  const seasonal = Object.entries(months).filter(([m]) => PEAK_SEASON.includes(Number(m)));
  const calmest = seasonal.reduce((best, cur) => calmerOf(cur, best));

  return {
    kind,
    months,
    beaches: covered,
    calmestMonth: Number(calmest[0]),
    resolutionKm: climatology?.source?.resolutionKm ?? null,
    years: climatology?.source?.years ?? null,
  };
};

const MONTH_NAMES = {
  en: [, 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  gr: [, 'Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο', 'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο'],
  de: [, 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  fr: [, 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  it: [, 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
};

export const monthName = (month, language) => (MONTH_NAMES[language] || MONTH_NAMES.en)[month];

/**
 * Δεκαδικός με το σημείο που χρησιμοποιεί η γλώσσα, πάντα δύο ψηφία.
 *
 * Δύο λάθη που φαίνονται μικρά και δεν είναι, γιατί εμφανίζονται σε εκατοντάδες σελίδες:
 * «0.88 μ.» με αγγλική υποδιαστολή μέσα σε ελληνικό κείμενο διαβάζεται ως αμετάφραστο, και
 * `Number(1.0).toFixed(2)` περασμένο από Number() ξαναγίνεται «1» — «τυπικά 1 μ.» δίπλα σε
 * «0,88 μ.» μοιάζει με στρογγυλοποίηση που δεν κάναμε.
 */
export const decimal = (value, language, digits = 2) => {
  const text = Number(value).toFixed(digits);
  return language === 'en' ? text : text.replace('.', ',');
};

/**
 * Η παράγραφος, έτοιμη για ενότητα άρθρου — ή null όταν δεν υπάρχει προφίλ.
 *
 * Κάθε γλώσσα λέει τα ίδια τέσσερα πράγματα με την ίδια σειρά: τα νούμερα ανά μήνα, ποιος
 * μήνας είναι ο πιο ήρεμος, από πού βγήκε ο αριθμός, και τι ΔΕΝ δείχνει. Το τελευταίο δεν
 * είναι νομική διατύπωση για την ησυχία μας — είναι η διαφορά ανάμεσα σε «η θάλασσα εδώ»
 * και «αυτή η παραλία», και ο χρήστης που θα πάει σε προστατευμένο όρμο θα βρει καλύτερα
 * νερά από το νούμερο, ποτέ χειρότερα.
 */
export const seaSeasonSection = (profile, language, regionId = '') => {
  if (!profile) return null;
  const { months, calmestMonth, beaches, kind } = profile;
  const years = profile.years ? `${profile.years[0]}–${profile.years[1]}` : '';
  // ΤΟ ΜΕΛΤΕΜΙ ΔΕΝ ΦΥΣΑΕΙ ΠΑΝΤΟΥ. Η πρώτη έκδοση έγραφε «τον Αύγουστο που το μελτέμι είναι
  // στα δυνατά του» σε ΚΑΘΕ σελίδα — και στην Κέρκυρα, όπου ο καλοκαιρινός άνεμος είναι ο
  // μαΐστρος. Ίδιο λάθος με τα de/fr/it των υπήνεμων οδηγών, που είχε ήδη διορθωθεί μία
  // φορά· εδώ αποφεύγεται διαβάζοντας το ίδιο καθεστώς ανέμου αντί να υποτεθεί το Αιγαίο.
  const regime = getRegionWindContext(regionId);
  const wind = LOCAL_WIND_ATOMS[regime].word;
  const windWord = wind[language] || wind.en;
  // Τα ελληνικά χρειάζονται το άρθρο ΜΑΖΙ με τη λέξη: το μελτέμι είναι ουδέτερο, ο
  // μαΐστρος αρσενικός. Ένα σταθερό «ο» μπροστά έβγαζε «ο μελτέμι» σε κάθε αιγαιακή
  // σελίδα. Το `elNom` κουβαλάει ήδη το σωστό άρθρο ανά καθεστώς, οπότε δεν το μαντεύουμε.
  const windSubjectGr = LOCAL_WIND_LABEL[regime].elNom;

  // Η μία διατύπωση λέει «τις 82% των ημερών», η άλλη «τυπικά 0,55 μ.». Ποτέ η πρώτη πάνω
  // σε δεδομένα της δεύτερης: ένα ποσοστό βγαλμένο από μέσο όρο θα ήταν εφευρεμένος
  // αριθμός με πειστικό ντύσιμο, και ο αναγνώστης δεν έχει τρόπο να το ξεχωρίσει.
  const numbers = kind === 'percentiles'
    ? {
      en: `calm on about ${months['6'].calmPct}% of days in June, ${Math.round((months['7'].calmPct + months['8'].calmPct) / 2)}% in July and August when the ${windWord} is at its strongest, and ${months['9'].calmPct}% in September`,
      gr: `ήρεμη περίπου τις ${months['6'].calmPct}% των ημερών τον Ιούνιο, ${Math.round((months['7'].calmPct + months['8'].calmPct) / 2)}% τον Ιούλιο και τον Αύγουστο που ${windSubjectGr} είναι στα δυνατά του, και ${months['9'].calmPct}% τον Σεπτέμβριο`,
      de: `an rund ${months['6'].calmPct}% der Tage im Juni ruhig, an ${Math.round((months['7'].calmPct + months['8'].calmPct) / 2)}% im Juli und August, wenn der ${windWord} am kräftigsten weht, und an ${months['9'].calmPct}% im September`,
      fr: `calme environ ${months['6'].calmPct}% des jours en juin, ${Math.round((months['7'].calmPct + months['8'].calmPct) / 2)}% en juillet et août quand le ${windWord} souffle le plus fort, et ${months['9'].calmPct}% en septembre`,
      it: `calmo circa il ${months['6'].calmPct}% dei giorni a giugno, il ${Math.round((months['7'].calmPct + months['8'].calmPct) / 2)}% a luglio e agosto quando il ${windWord} soffia più forte, e il ${months['9'].calmPct}% a settembre`,
    }
    : {
      en: `typically ${decimal(months['6'].typicalM, 'en')} m in June, ${decimal(months['7'].typicalM, 'en')} m in July and ${decimal(months['8'].typicalM, 'en')} m in August when the ${windWord} is at its strongest, and ${decimal(months['9'].typicalM, 'en')} m in September`,
      gr: `τυπικά ${decimal(months['6'].typicalM, 'gr')} μ. τον Ιούνιο, ${decimal(months['7'].typicalM, 'gr')} μ. τον Ιούλιο και ${decimal(months['8'].typicalM, 'gr')} μ. τον Αύγουστο που ${windSubjectGr} είναι στα δυνατά του, και ${decimal(months['9'].typicalM, 'gr')} μ. τον Σεπτέμβριο`,
      de: `typischerweise ${decimal(months['6'].typicalM, 'de')} m im Juni, ${decimal(months['7'].typicalM, 'de')} m im Juli und ${decimal(months['8'].typicalM, 'de')} m im August, wenn der ${windWord} am kräftigsten weht, und ${decimal(months['9'].typicalM, 'de')} m im September`,
      fr: `typiquement ${decimal(months['6'].typicalM, 'fr')} m en juin, ${decimal(months['7'].typicalM, 'fr')} m en juillet et ${decimal(months['8'].typicalM, 'fr')} m en août quand le ${windWord} souffle le plus fort, et ${decimal(months['9'].typicalM, 'fr')} m en septembre`,
      it: `tipicamente ${decimal(months['6'].typicalM, 'it')} m a giugno, ${decimal(months['7'].typicalM, 'it')} m a luglio e ${decimal(months['8'].typicalM, 'it')} m ad agosto quando il ${windWord} soffia più forte, e ${decimal(months['9'].typicalM, 'it')} m a settembre`,
    };

  const lead = {
    en: `Across ${beaches} of the beaches on this page, the open water in front of them is `,
    gr: `Στις ${beaches} από τις παραλίες αυτής της σελίδας, η θάλασσα μπροστά τους είναι `,
    de: `Vor ${beaches} der Strände auf dieser Seite ist das offene Wasser `,
    fr: `Devant ${beaches} des plages de cette page, le large est `,
    it: `Davanti a ${beaches} delle spiagge di questa pagina, il mare aperto è `,
  };
  const tail = {
    en: `. ${monthName(calmestMonth, 'en')} is the calmest month of the season. Figures come from the European Copernicus wave model at ${decimal(profile.resolutionKm, 'en', 1)} km resolution${years ? `, ${years}` : ''}. They describe the sea offshore, not the shelter of an individual cove — a bay protected by a headland will usually be calmer than this.`,
    gr: `. Ο πιο ήρεμος μήνας της σεζόν είναι ο ${monthName(calmestMonth, 'gr')}ς. Τα νούμερα βγαίνουν από το ευρωπαϊκό κυματικό μοντέλο Copernicus, ανάλυσης ${decimal(profile.resolutionKm, 'gr', 1)} χλμ.${years ? ` (${years})` : ''} Δείχνουν το ανοιχτό νερό, όχι την προστασία του κάθε όρμου — ένας κόλπος πίσω από κάβο είναι συνήθως πιο ήρεμος από αυτό.`,
    de: `. Der ruhigste Monat der Saison ist der ${monthName(calmestMonth, 'de')}. Die Zahlen stammen aus dem europäischen Copernicus-Wellenmodell mit ${decimal(profile.resolutionKm, 'de', 1)} km Auflösung${years ? `, ${years}` : ''}. Sie beschreiben das Meer vor der Küste, nicht den Schutz einer einzelnen Bucht — eine Bucht hinter einer Landzunge ist meist ruhiger.`,
    fr: `. Le mois le plus calme de la saison est ${monthName(calmestMonth, 'fr')}. Les chiffres proviennent du modèle de vagues européen Copernicus à ${decimal(profile.resolutionKm, 'fr', 1)} km de résolution${years ? `, ${years}` : ''}. Ils décrivent la mer au large, pas l'abri d'une crique — une baie protégée par un cap est en général plus calme.`,
    it: `. Il mese più calmo della stagione è ${monthName(calmestMonth, 'it')}. I dati vengono dal modello ondoso europeo Copernicus a ${decimal(profile.resolutionKm, 'it', 1)} km di risoluzione${years ? `, ${years}` : ''}. Descrivono il mare al largo, non il riparo di una singola cala — una baia protetta da un promontorio è di solito più calma.`,
  };
  const heading = {
    en: 'When is the sea calmest here?',
    gr: 'Πότε είναι πιο ήρεμη η θάλασσα εδώ;',
    de: 'Wann ist das Meer hier am ruhigsten?',
    fr: 'Quand la mer est-elle la plus calme ici ?',
    it: 'Quando il mare è più calmo qui?',
  };

  const lang = heading[language] ? language : 'en';
  return { heading: heading[lang], body: `${lead[lang]}${numbers[lang]}${tail[lang]}` };
};

/** Προσθέτει την ενότητα στο τέλος του άρθρου· επιστρέφει το content ανέπαφο όταν λείπει. */
export const withSeaSeasonSection = (content, beachIds, climatology, language, regionId = '') => {
  const section = seaSeasonSection(
    summariseIslandSeason(beachIds, climatology), language, regionId,
  );
  if (!section) return content;
  return { ...content, sections: [...(content.sections || []), section] };
};
