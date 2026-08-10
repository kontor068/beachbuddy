import type { LanguageCode, SuitableBeach } from '../types';
import { conditionToneLabel } from './conditionToneLabels';
import { seaStateSeverityM } from './waveCharacter';
import { PODIUM_SEA_MEANINGFUL_DIFFERENCE_M } from '../services/topPickRanking';
import type { CalmnessTone } from './suitabilityTone';

/**
 * ΠΩΣ ΒΓΗΚΕ ΑΥΤΗ Η ΣΕΙΡΑ — the ladder, in order, beside the Top 3 (Μίλτος, 10/08/2026).
 *
 * «Στο τοπ 3 βάλε το πώς βγαίνει, σύμφωνα με το τι κοιτάς, με τη σειρά, βγάζοντας ένα σκορ.»
 *
 * The panel that was there before listed the CRITERIA — four bullets, the same four on every
 * region, every day. True, and useless for the question a reader actually has, which is not «what
 * do you look at» but «why THIS one first». The difference matters because the ranking is a
 * ladder, not a sum: it stops at the first rung where two beaches differ, and everything below is
 * never read. On 10/08 that produced a beach scoring 58 above one scoring 76 — and the reason (two
 * points of amenities) was invisible on every surface.
 *
 * So this reports the rungs WITH each pick's value on them, and names the one that actually
 * decided. A tied rung says «ίδιες» rather than pretending to have contributed; the rungs below
 * the deciding one are marked as never reached, because that is the honest description of a
 * lexicographic order.
 *
 * It does not re-rank anything and must never be able to: it reads the same fields
 * prioritizeProtectedRecommendations reads and reports them. If the two ever disagree, this file
 * is wrong and the ranking is right — which is why the sea rung imports the ranking's own
 * threshold instead of restating it.
 */

export type LadderStatus = 'tied' | 'decided' | 'not-reached';

export interface LadderRung {
  key: 'shelter' | 'tone' | 'wind' | 'sea' | 'comfort' | 'score';
  label: string;
  /** One display value per pick, in podium order. */
  values: string[];
  status: LadderStatus;
}

const LABELS: Record<LanguageCode, Record<LadderRung['key'], string>> = {
  gr: {
    shelter: 'Προστασία από τον άνεμο',
    tone: 'Χρώμα στον χάρτη',
    wind: 'Άνεμος στη δική της ακτή',
    sea: 'Νερό στην ακτή',
    comfort: 'Πρόσβαση, παροχές, φήμη',
    score: 'Συνολικό σκορ',
  },
  en: {
    shelter: 'Shelter from the wind',
    tone: 'Colour on the map',
    wind: 'Wind on its own shore',
    sea: 'Water at the shore',
    comfort: 'Access, facilities, fame',
    score: 'Overall score',
  },
  de: {
    shelter: 'Schutz vor dem Wind',
    tone: 'Farbe auf der Karte',
    wind: 'Wind an dieser Küste',
    sea: 'Wasser am Ufer',
    comfort: 'Zugang, Ausstattung, Bekanntheit',
    score: 'Gesamtwertung',
  },
  fr: {
    shelter: 'Abri du vent',
    tone: 'Couleur sur la carte',
    wind: 'Vent sur sa propre côte',
    sea: 'Eau au rivage',
    comfort: 'Accès, services, notoriété',
    score: 'Score global',
  },
  it: {
    shelter: 'Riparo dal vento',
    tone: 'Colore sulla mappa',
    wind: 'Vento sulla sua costa',
    sea: 'Acqua a riva',
    comfort: 'Accesso, servizi, fama',
    score: 'Punteggio totale',
  },
};

const SHELTER_WORDS: Record<LanguageCode, Record<'protected' | 'partial' | 'exposed', string>> = {
  gr: { protected: 'Προστατευμένη', partial: 'Μερική', exposed: 'Εκτεθειμένη' },
  en: { protected: 'Sheltered', partial: 'Partial', exposed: 'Open' },
  de: { protected: 'Geschützt', partial: 'Teilweise', exposed: 'Offen' },
  fr: { protected: 'Abritée', partial: 'Partielle', exposed: 'Exposée' },
  it: { protected: 'Riparata', partial: 'Parziale', exposed: 'Esposta' },
};

export const LADDER_HEADING: Record<LanguageCode, string> = {
  gr: 'Πώς βγήκε αυτή η σειρά',
  en: 'How this order came out',
  de: 'Wie diese Reihenfolge entstand',
  fr: 'Comment cet ordre est sorti',
  it: 'Come è nato questo ordine',
};

export const LADDER_TIED: Record<LanguageCode, string> = {
  gr: 'ίδιες',
  en: 'all the same',
  de: 'alle gleich',
  fr: 'identiques',
  it: 'uguali',
};

export const LADDER_DECIDED: Record<LanguageCode, string> = {
  gr: 'εδώ κρίθηκε',
  en: 'decided here',
  de: 'hier entschieden',
  fr: 'décidé ici',
  it: 'deciso qui',
};

export const LADDER_NOT_REACHED: Record<LanguageCode, string> = {
  gr: 'δεν χρειάστηκε',
  en: 'never needed',
  de: 'nicht nötig',
  fr: 'pas nécessaire',
  it: 'non servito',
};

/**
 * The footnote that keeps the panel honest: the score is the LAST rung, so on most windy days it
 * is reported and not used. Saying so is the whole point — a reader who sees 76 under a beach
 * ranked second must be told why that number did not win.
 */
export const LADDER_NOTE: Record<LanguageCode, string> = {
  gr: 'Κατεβαίνουμε τη σκάλα και σταματάμε στο πρώτο σκαλί που τις ξεχωρίζει. Ό,τι είναι από κάτω δεν το κοιτάμε καν.',
  en: 'We go down the ladder and stop at the first rung that separates them. Anything below it is never read.',
  de: 'Wir gehen die Leiter hinunter und halten bei der ersten Stufe, die sie trennt. Alles darunter wird nie gelesen.',
  fr: "On descend l'échelle et on s'arrête au premier barreau qui les sépare. Ce qui est en dessous n'est jamais lu.",
  it: 'Scendiamo la scala e ci fermiamo al primo gradino che le separa. Tutto ciò che sta sotto non viene mai letto.',
};

const metres = (value: number | undefined, language: LanguageCode, modelled: boolean): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const unit = language === 'gr' ? 'μ.' : 'm';
  const num = value.toFixed(1).replace('.', language === 'gr' ? ',' : '.');
  return `${modelled ? '~' : ''}${num} ${unit}`;
};

/** The height the podium's sea rung actually compares — the sand where we have it. */
const rankingSeaM = (item: SuitableBeach): { value: number | undefined; modelled: boolean } => {
  const decision = item.seaStateWaveM;
  const shore = item.shoreWaveHeightM;
  if (typeof shore === 'number' && Number.isFinite(shore) && (typeof decision !== 'number' || shore <= decision)) {
    return { value: shore, modelled: true };
  }
  return { value: decision, modelled: false };
};

/**
 * Which ADJACENT pairs a rung tells apart — not "are all three the same".
 *
 * A three-beach podium is not one comparison, it is two. The first version of this panel marked a
 * single «εδώ κρίθηκε» rung, which was right for #1 and quietly wrong for #2 vs #3: on Νάξος the
 * colour separated ΙΔΑΝΙΚΗ from ΚΑΛΗ and then said «δεν χρειάστηκε» about every rung that had, in
 * fact, gone on to order the two ΚΑΛΕΣ beneath it. A rung is now marked as deciding when it
 * separates a pair that everything above it left tied — which is exactly what the comparator does.
 */
const separatedPairs = (values: (string | number | undefined)[], stillTied: boolean[]): boolean[] =>
  stillTied.map((tied, index) => tied && values[index] !== values[index + 1]);

export interface TopPickLadderInput {
  picks: SuitableBeach[];
  language: LanguageCode;
  /** The wind on each beach's own shore, exactly as the ranking reads it. */
  beaufortOf: (item: SuitableBeach) => number | undefined;
  /** The colour the map painted, exactly as the ranking reads it. */
  toneOf: (item: SuitableBeach) => CalmnessTone | undefined;
}

export const buildTopPickLadder = ({ picks, language, beaufortOf, toneOf }: TopPickLadderInput): LadderRung[] => {
  if (picks.length < 2) return [];
  const words = LABELS[language] ?? LABELS.gr;
  const shelterWords = SHELTER_WORDS[language] ?? SHELTER_WORDS.gr;

  const shelterKeys = picks.map(item => (
    item.exposureLevel === 'protected' ? 'protected' : item.exposureLevel === 'partial' ? 'partial' : 'exposed'
  ) as 'protected' | 'partial' | 'exposed');
  const toneKeys = picks.map(item => toneOf(item));
  const windValues = picks.map(item => beaufortOf(item));
  const seas = picks.map(rankingSeaM);
  // The sea rung is only «decided» when the ranking itself would have acted on it — the same
  // threshold, imported, because a panel that claims a rung decided something the comparator
  // ignored would be a confident lie.
  const seaSeverities = seas.map(sea => (
    typeof sea.value === 'number' ? (seaStateSeverityM(sea.value, undefined) ?? sea.value) : undefined
  ));
  const seaSeparates = seaSeverities.every(value => typeof value === 'number')
    && Math.max(...(seaSeverities as number[])) - Math.min(...(seaSeverities as number[])) >= PODIUM_SEA_MEANINGFUL_DIFFERENCE_M;

  const bft = (value: number | undefined): string => (
    typeof value === 'number' ? `${value} ${language === 'gr' ? 'Μπφ' : 'Bft'}` : '—'
  );

  const rows: { key: LadderRung['key']; label: string; values: string[]; keys: (string | number | undefined)[]; separates: boolean }[] = [
    {
      key: 'shelter',
      label: words.shelter,
      values: shelterKeys.map(key => shelterWords[key]),
      keys: shelterKeys,
      separates: false,
    },
    {
      key: 'tone',
      label: words.tone,
      values: toneKeys.map(tone => (tone ? conditionToneLabel(tone, language) : '—')),
      keys: toneKeys.every(Boolean) ? toneKeys : picks.map(() => undefined),
      separates: false,
    },
    {
      key: 'wind',
      label: words.wind,
      values: windValues.map(bft),
      keys: windValues.every(value => typeof value === 'number') ? windValues : picks.map(() => undefined),
      separates: false,
    },
    {
      key: 'sea',
      label: words.sea,
      values: seas.map(sea => metres(sea.value, language, sea.modelled)),
      // Bucketed by the ranking's own threshold, so the panel can only claim the sea decided
      // something when the comparator would have acted on the same gap.
      keys: seaSeparates ? seaSeverities.map(v => (typeof v === 'number' ? Math.round(v / PODIUM_SEA_MEANINGFUL_DIFFERENCE_M) : undefined)) : picks.map(() => undefined),
      separates: false,
    },
    {
      key: 'comfort',
      label: words.comfort,
      values: picks.map(() => ''),
      // The catch-all rung: recognition, access, distance, amenities. Whatever is still tied above
      // is resolved here, so it separates every remaining pair by construction.
      keys: picks.map((_, index) => index),
      separates: true,
    },
    {
      key: 'score',
      label: words.score,
      values: picks.map(item => String(Math.round(item.score))),
      keys: picks.map(() => 0),
      separates: false,
    },
  ];

  let stillTied = picks.slice(0, -1).map(() => true);
  return rows.map(row => {
    const decides = separatedPairs(row.keys, stillTied);
    const isDecider = decides.some(Boolean);
    const wasAnythingLeft = stillTied.some(Boolean);
    stillTied = stillTied.map((tied, index) => tied && !decides[index]);
    return {
      key: row.key,
      label: row.label,
      values: row.values,
      status: isDecider ? 'decided' : wasAnythingLeft ? 'tied' : 'not-reached',
    } as LadderRung;
  });
};
