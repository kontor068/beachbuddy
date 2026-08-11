import type { LanguageCode } from '../types';
import { TOP_PICK_WEIGHTS } from './topPickScoreTable';

/**
 * ΤΙ ΚΟΙΤΑΜΕ, ΜΕ ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ — the box beside the Top 3.
 *
 * Third version in one evening, and the history is the explanation:
 *
 *   1. Four fixed bullets naming the criteria. True, identical on every region every day, and
 *      useless for the only question a reader has.
 *   2. A live ladder printing all three picks' values on every rung and marking the one that
 *      decided. Accurate, and rejected by Miltos on sight: «δεν θέλω να έχω έναν υπολογιστή δίπλα
 *      μου». It also stopped being true the moment the ladder became a weighted table.
 *   3. This: the table itself, with its weights, static. Seven lines that say what the site values
 *      and by how much, readable in three seconds and identical everywhere — which is the point,
 *      because it is a statement of policy, not a per-beach calculation.
 *
 * The weights are IMPORTED, never restated. A second copy would drift from the scorer the first
 * time a weight moved, and the failure mode is a page that explains a ranking it is not doing.
 */

export interface TopPickCriterionRow {
  /**
   * No 'distance' row (11/08/2026). The axis exists in the score table but the region podium is
   * hard-wired never to feed it (services/topPickRanking) so that one weather gives one podium to
   * everyone — so printing «Απόσταση από εσένα 10» here would be advertising a criterion that
   * cannot move a single card on this screen. Distance is a «Κοντά μου» rule and lives there.
   */
  key: 'shelter' | 'sea' | 'ownWind' | 'amenities' | 'access' | 'crowd';
  label: string;
  /** Weight out of 100. */
  weight: number;
}

const LABELS: Record<LanguageCode, Record<TopPickCriterionRow['key'], string>> = {
  gr: {
    shelter: 'Προστασία από τον άνεμο',
    ownWind: 'Άνεμος στη δική της ακτή',
    sea: 'Νερό στην ακτή',
    access: 'Πρόσβαση',
    amenities: 'Παροχές',
    crowd: 'Πολυσύχναστη',
  },
  en: {
    shelter: 'Shelter from the wind',
    ownWind: 'Wind on its own shore',
    sea: 'Water at the shore',
    access: 'Access',
    amenities: 'Facilities',
    crowd: 'Crowded',
  },
  de: {
    shelter: 'Schutz vor dem Wind',
    ownWind: 'Wind an dieser Küste',
    sea: 'Wasser am Ufer',
    access: 'Zugang',
    amenities: 'Ausstattung',
    crowd: 'Stark besucht',
  },
  fr: {
    shelter: 'Abri du vent',
    ownWind: 'Vent sur sa propre côte',
    sea: 'Eau au rivage',
    access: 'Accès',
    amenities: 'Services',
    crowd: 'Très fréquentée',
  },
  it: {
    shelter: 'Riparo dal vento',
    ownWind: 'Vento sulla sua costa',
    sea: 'Acqua a riva',
    access: 'Accesso',
    amenities: 'Servizi',
    crowd: 'Affollata',
  },
};

/**
 * Η ΜΙΣΗ ΑΛΗΘΕΙΑ ΠΟΥ ΕΛΕΙΠΕ (11/08/2026).
 *
 * The seven weights read as if the sum decides everything. It does not: four doors run BEFORE any
 * score is computed, and the colour the map painted orders above the whole table. A reader who
 * sees «Προστασία 25» and assumes that is the story has been told something untrue by omission —
 * which is worse here than anywhere else on the site, because this box exists to be believed.
 *
 * Two short lines, one each side of the numbers. Deliberately plain: they describe the rules a
 * person can check against the map in front of them.
 */
export const LADDER_DOORS: Record<LanguageCode, string> = {
  gr: 'Πρώτα βγάζουμε έξω: όπου λέμε να μην κολυμπήσεις, όσες θέλουν εισιτήριο, όσες δεν σε πάνε καρφωτά στον χάρτη.',
  en: 'First we rule out: where we say do not swim, beaches you pay to enter, and any the map cannot take you straight to.',
  de: 'Zuerst fallen weg: wo wir vom Baden abraten, Strände mit Eintritt, und alle ohne genauen Kartenpunkt.',
  fr: "D'abord nous écartons : là où nous déconseillons la baignade, les plages payantes, et celles sans point précis sur la carte.",
  it: 'Prima escludiamo: dove sconsigliamo il bagno, le spiagge a pagamento, e quelle senza un punto preciso sulla mappa.',
};

export const LADDER_COLOUR_FIRST: Record<LanguageCode, string> = {
  gr: 'Το χρώμα του χάρτη προηγείται: μπλε παραλία δεν χάνει ποτέ από κίτρινη.',
  en: 'The map colour comes first: a blue beach never loses to a yellow one.',
  de: 'Die Kartenfarbe zählt zuerst: ein blauer Strand verliert nie gegen einen gelben.',
  fr: "La couleur de la carte prime : une plage bleue ne perd jamais face à une jaune.",
  it: 'Il colore della mappa viene prima: una spiaggia blu non perde mai contro una gialla.',
};

/**
 * Η ΓΡΑΜΜΗ ΤΗΣ ΗΡΕΜΗΣ ΜΕΡΑΣ (11/08/2026, μαζί με το άνοιγμα του podium στα ≤2 Μποφ).
 *
 * The box lists shelter and own-shore wind as the two heaviest rows — 55 of the 100 — and on a day
 * with no wind neither of them separates a single beach: the ranking gives every beach full marks
 * on both. Printing the table unqualified there would be the same half-truth the doors line was
 * added to fix, only worse, because the reader can see for himself that it is not windy.
 *
 * So on calm days the box says which rows are actually deciding. It does not hide the others —
 * they are still the site's priorities, they simply have nothing to do today.
 */
export const LADDER_CALM_DAY: Record<LanguageCode, string> = {
  gr: 'Σήμερα δεν φυσάει, οπότε τα δύο πρώτα δεν χωρίζουν καμία παραλία: αποφασίζουν το νερό στην ακτή, οι παροχές και ο δρόμος.',
  en: 'There is no wind today, so the top two separate nobody: the water at the shore, the facilities and the road decide.',
  de: 'Heute weht kein Wind, also trennen die ersten beiden niemanden: Wasser am Ufer, Ausstattung und Zufahrt entscheiden.',
  fr: "Il n'y a pas de vent aujourd'hui : les deux premiers ne départagent personne, ce sont l'eau au rivage, les services et l'accès qui décident.",
  it: 'Oggi non c\'è vento, quindi i primi due non separano nessuna: decidono l\'acqua a riva, i servizi e la strada.',
};

export const LADDER_HEADING: Record<LanguageCode, string> = {
  gr: 'Τι κοιτάμε, με σειρά προτεραιότητας',
  en: 'What we look at, in order of weight',
  de: 'Worauf wir achten, nach Gewicht',
  fr: 'Ce que nous regardons, par importance',
  it: 'Cosa guardiamo, in ordine di peso',
};

/**
 * The rows, heaviest first. Pure function of the weights — no beach, no forecast, no memo needed.
 */
export const topPickCriteriaRows = (language: LanguageCode): TopPickCriterionRow[] => {
  const words = LABELS[language] ?? LABELS.gr;
  return [
    { key: 'shelter', label: words.shelter, weight: TOP_PICK_WEIGHTS.shelter },
    { key: 'sea', label: words.sea, weight: TOP_PICK_WEIGHTS.sea },
    { key: 'ownWind', label: words.ownWind, weight: TOP_PICK_WEIGHTS.ownWind },
    { key: 'amenities', label: words.amenities, weight: TOP_PICK_WEIGHTS.amenities },
    { key: 'access', label: words.access, weight: TOP_PICK_WEIGHTS.access },
    { key: 'crowd', label: words.crowd, weight: TOP_PICK_WEIGHTS.crowd },
  ];
};
