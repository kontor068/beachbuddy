import type { LanguageCode } from '../types';
import { TOP_PICK_WEIGHTS, CROWD_PENALTY_MAX } from './topPickScoreTable';

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
 *   3. This: the table itself, with its weights, static. Six lines that say what the site values
 *      and by how much, readable in three seconds and identical everywhere — which is the point,
 *      because it is a statement of policy, not a per-beach calculation.
 *
 * The weights are IMPORTED, never restated. A second copy would drift from the scorer the first
 * time a weight moved, and the failure mode is a page that explains a ranking it is not doing.
 */

export interface TopPickCriterionRow {
  key: 'shelter' | 'ownWind' | 'sea' | 'access' | 'amenities' | 'crowd';
  label: string;
  /** Signed weight out of 100. Negative for the crowd penalty. */
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

export const LADDER_HEADING: Record<LanguageCode, string> = {
  gr: 'Τι κοιτάμε, με σειρά προτεραιότητας',
  en: 'What we look at, in order of weight',
  de: 'Worauf wir achten, nach Gewicht',
  fr: 'Ce que nous regardons, par importance',
  it: 'Cosa guardiamo, in ordine di peso',
};

/** The one line that is not a row: the door no score can open. */
export const LADDER_NOTE: Record<LanguageCode, string> = {
  gr: 'Δεν προτείνουμε ποτέ παραλία με είσοδο επί πληρωμή.',
  en: 'We never recommend a beach you pay to enter.',
  de: 'Strände mit Eintritt empfehlen wir nie.',
  fr: 'Nous ne recommandons jamais une plage payante.',
  it: 'Non consigliamo mai una spiaggia a pagamento.',
};

/**
 * The rows, heaviest first, with the crowd penalty last because it is the only one that subtracts.
 * Pure function of the weights — no beach, no forecast, no memo needed.
 */
export const topPickCriteriaRows = (language: LanguageCode): TopPickCriterionRow[] => {
  const words = LABELS[language] ?? LABELS.gr;
  return [
    { key: 'shelter', label: words.shelter, weight: TOP_PICK_WEIGHTS.shelter },
    { key: 'ownWind', label: words.ownWind, weight: TOP_PICK_WEIGHTS.ownWind },
    { key: 'sea', label: words.sea, weight: TOP_PICK_WEIGHTS.sea },
    { key: 'access', label: words.access, weight: TOP_PICK_WEIGHTS.access },
    { key: 'amenities', label: words.amenities, weight: TOP_PICK_WEIGHTS.amenities },
    { key: 'crowd', label: words.crowd, weight: -CROWD_PENALTY_MAX },
  ];
};
