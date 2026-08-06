import React, { useMemo } from 'react';
import { ChevronRight, Compass } from 'lucide-react';
import { Beach, LanguageCode } from '../types';
import { CALMNESS_ORDER, type CalmnessTone } from '../utils/suitabilityTone';
import { getLocalizedCopy } from '../utils/i18n';
import { beachSentenceName } from '../utils/beachCopy';

/**
 * "Where should we go today?" — the island answered one coast at a time.
 *
 * WHY THIS EXISTS (06/08/2026). The competitor audit found exactly one screen where a rival is
 * genuinely better than us: a coast-level comparison that says "go to the Saronic coast, it is
 * in the lee today" instead of handing the visitor a list of 39 individual beaches to compare
 * themselves. Our own model already knows the answer — every pin on the map is coloured by the
 * wind meeting THAT shore — but the reader had to infer the pattern by eye from a map.
 * This section states the pattern in words.
 *
 * WHAT IT MUST NEVER DO — and the reason this file has no scoring logic at all:
 *  • It does NOT colour anything. Every tone here is READ from `beachTones`, the tones the map
 *    itself reported after painting the pins (App's `mapBeachTones`). The gate
 *    `the-list-does-not-colour-its-own-beaches` exists because the list and the legend were once
 *    two rules over the same evidence; a third rule here would be the same mistake twice.
 *  • It does NOT use a cluster forecast. Decision logged 02/08/2026: cluster readings may say
 *    "windier right here" as local colour, never drive a headline. So the grouping key is the
 *    beach's own committed ORIENTATION — a permanent fact of the coast — and the judgement comes
 *    from the per-beach tone the map already trusts.
 *  • It does NOT rank a coast it cannot see. A group is only shown once enough of its beaches
 *    have a reported tone; before the map reports, this renders nothing rather than guessing.
 *
 * So this component is pure presentation over two inputs the app already trusts. That is the
 * whole design: the moat is in the model, and this is the sentence that finally says it out loud.
 */

/** Sector labels exactly as `orientation.faces` stores them (English, capitalised). */
const FACE_KEYS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'] as const;
type FaceKey = typeof FACE_KEYS[number];

const FACE_LABEL: Record<FaceKey, Record<LanguageCode, string>> = {
  North: { en: 'north-facing shores', gr: 'βόρειες ακτές', de: 'Nordküsten', fr: 'côtes nord', it: 'coste a nord' },
  Northeast: { en: 'north-east shores', gr: 'βορειοανατολικές ακτές', de: 'Nordostküsten', fr: 'côtes nord-est', it: 'coste a nord-est' },
  East: { en: 'east-facing shores', gr: 'ανατολικές ακτές', de: 'Ostküsten', fr: 'côtes est', it: 'coste a est' },
  Southeast: { en: 'south-east shores', gr: 'νοτιοανατολικές ακτές', de: 'Südostküsten', fr: 'côtes sud-est', it: 'coste a sud-est' },
  South: { en: 'south-facing shores', gr: 'νότιες ακτές', de: 'Südküsten', fr: 'côtes sud', it: 'coste a sud' },
  Southwest: { en: 'south-west shores', gr: 'νοτιοδυτικές ακτές', de: 'Südwestküsten', fr: 'côtes sud-ouest', it: 'coste a sud-ovest' },
  West: { en: 'west-facing shores', gr: 'δυτικές ακτές', de: 'Westküsten', fr: 'côtes ouest', it: 'coste a ovest' },
  Northwest: { en: 'north-west shores', gr: 'βορειοδυτικές ακτές', de: 'Nordwestküsten', fr: 'côtes nord-ouest', it: 'coste a nord-ovest' },
};

const copy = {
  en: {
    heading: 'Which side of the island today?',
    intro: 'The same wind is gentle on one coast and rough on the other. This is how today falls across the island.',
    beachesOne: (n: number) => `${n} ${n === 1 ? 'beach' : 'beaches'}`,
    calmHere: 'calmest side today',
    mixed: 'mixed today',
    rough: 'rough today',
    seeBeaches: 'See beaches',
    note: 'Grouped by the direction each shore faces, using the same colours as the map.',
  },
  gr: {
    heading: 'Σε ποια πλευρά του νησιού σήμερα;',
    intro: 'Ο ίδιος άνεμος είναι ήπιος στη μια ακτή και άγριος στην απέναντι. Έτσι πέφτει η σημερινή μέρα στο νησί.',
    beachesOne: (n: number) => `${n} ${n === 1 ? 'παραλία' : 'παραλίες'}`,
    calmHere: 'η πιο ήρεμη πλευρά σήμερα',
    mixed: 'ανάμεικτα σήμερα',
    rough: 'άγρια σήμερα',
    seeBeaches: 'Δες παραλίες',
    note: 'Ομαδοποίηση με βάση το πού κοιτάζει κάθε ακτή, με τα ίδια χρώματα που έχει ο χάρτης.',
  },
};

const TONE_SKIN: Record<CalmnessTone, { dot: string; chip: string }> = {
  blue: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  yellow: { dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  orange: { dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-800 border-orange-200' },
  red: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-800 border-rose-200' },
};

/** Tones that count as "you can go there" — the same two the suitable list is built from. */
const GOOD_TONES: readonly CalmnessTone[] = ['blue', 'yellow'];

interface CoastGroup {
  face: FaceKey;
  total: number;
  good: number;
  /** Roughest tone present, used only to pick the group's dot colour honestly. */
  worst: CalmnessTone;
  /** Calmest tone present — the group's headline colour. */
  best: CalmnessTone;
  sample: Beach[];
}

interface WhereToGoTodayProps {
  language: LanguageCode;
  beaches: Beach[];
  /** The tones the MAP reported. Never recomputed here — see the file header. */
  beachTones: Record<number, CalmnessTone>;
  onSelectBeach: (beachId: number) => void;
  /** Optional: skip beaches the rest of the page is already hiding (boat-only in strong wind…). */
  isListable?: (beach: Beach) => boolean;
}

/** A coast needs this many judged beaches before it is worth a sentence of its own. */
const MIN_BEACHES_PER_COAST = 2;
/** Below this many judged beaches island-wide, the pattern is noise and we say nothing. */
const MIN_JUDGED_BEACHES = 6;

export const WhereToGoToday: React.FC<WhereToGoTodayProps> = ({
  language,
  beaches,
  beachTones,
  onSelectBeach,
  isListable,
}) => {
  const c = getLocalizedCopy(language, copy);

  const groups = useMemo<CoastGroup[]>(() => {
    const byFace = new Map<FaceKey, { beaches: Beach[]; tones: CalmnessTone[] }>();

    for (const beach of beaches) {
      if (!Number.isInteger(beach.id)) continue;
      if (isListable && !isListable(beach)) continue;
      const tone = beachTones[beach.id];
      if (!tone) continue; // the map has not judged it — we do not invent a judgement
      const faces = Array.isArray(beach.orientation?.faces) ? beach.orientation.faces : [];
      // A beach that faces two ways belongs to both groups: it really is on both coasts, and
      // forcing a primary would be a scoring decision this component is not allowed to make.
      for (const face of faces) {
        if (!FACE_KEYS.includes(face as FaceKey)) continue;
        const key = face as FaceKey;
        const entry = byFace.get(key) ?? { beaches: [], tones: [] };
        entry.beaches.push(beach);
        entry.tones.push(tone);
        byFace.set(key, entry);
      }
    }

    const built: CoastGroup[] = [];
    for (const [face, entry] of byFace) {
      if (entry.beaches.length < MIN_BEACHES_PER_COAST) continue;
      const good = entry.tones.filter(tone => GOOD_TONES.includes(tone)).length;
      // CALMNESS_ORDER runs roughest → calmest, so the lowest index is the roughest tone present.
      const sorted = [...entry.tones].sort((a, b) => CALMNESS_ORDER.indexOf(a) - CALMNESS_ORDER.indexOf(b));
      const worst = sorted[0];
      const best = sorted[sorted.length - 1];
      const sample = entry.beaches
        .filter(beach => GOOD_TONES.includes(beachTones[beach.id]))
        .slice(0, 3);
      built.push({ face, total: entry.beaches.length, good, worst, best, sample: sample.length ? sample : entry.beaches.slice(0, 2) });
    }

    // Calmest coast first: share of good beaches, then absolute count so a 2-beach coast does
    // not outrank a 12-beach one on a perfect percentage.
    return built.sort((a, b) => (b.good / b.total) - (a.good / a.total) || b.good - a.good);
  }, [beaches, beachTones, isListable]);

  const judgedCount = useMemo(
    () => beaches.filter(beach => Number.isInteger(beach.id) && beachTones[beach.id]).length,
    [beaches, beachTones],
  );

  // Nothing to say is a valid outcome: before the map reports, or on an island too small for a
  // pattern, an invented headline would be worse than silence.
  if (judgedCount < MIN_JUDGED_BEACHES || groups.length < 2) return null;

  const displayName = (beach: Beach): string => {
    const raw = (language === 'gr' ? beach.name?.gr : beach.name?.en) || beach.name?.en || '';
    return language === 'gr' ? beachSentenceName(raw, 'gr') : raw;
  };

  const verdictFor = (group: CoastGroup, index: number): string => {
    const share = group.good / group.total;
    if (index === 0 && share >= 0.5) return c.calmHere;
    if (share >= 0.34) return c.mixed;
    return c.rough;
  };

  return (
    <section className="space-y-3" aria-labelledby="where-to-go-heading">
      <h3 id="where-to-go-heading" className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
        <Compass className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
        {c.heading}
      </h3>
      <p className="px-1 text-sm leading-relaxed text-slate-600">{c.intro}</p>

      <ul className="space-y-2">
        {groups.slice(0, 4).map((group, index) => {
          const skin = TONE_SKIN[group.best];
          return (
            <li
              key={group.face}
              className="rounded-2xl border border-slate-200/70 bg-white/70 px-3.5 py-3"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${skin.dot}`} aria-hidden="true" />
                <span className="font-heading text-base font-bold text-slate-900">
                  {FACE_LABEL[group.face][language] ?? FACE_LABEL[group.face].en}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${skin.chip}`}>
                  {verdictFor(group, index)}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {c.beachesOne(group.total)}
                </span>
              </div>

              {group.sample.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {group.sample.map(beach => (
                    <li key={beach.id}>
                      <button
                        type="button"
                        onClick={() => onSelectBeach(beach.id)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 transition-colors hover:border-sky-300 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        {displayName(beach)}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <p className="px-1 text-[11px] italic leading-relaxed text-slate-500">{c.note}</p>
    </section>
  );
};
