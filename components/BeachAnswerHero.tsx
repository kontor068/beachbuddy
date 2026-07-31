import React from 'react';
import { MapPin, Clock } from 'lucide-react';
import type { LanguageCode } from '../types';
import { WindGlyph, SeaGlyph, WaterTempGlyph, SunsetGlyph, type GlyphTone } from './ConditionGlyphs';

/**
 * The answer, above everything else — the whole beach day in one screen.
 *
 * THREE MISTAKES THIS CARD WAS REBUILT TO FIX (reported 31/07, all correct):
 *
 *  1. The beach name appeared TWICE on the first screen — once in the sticky header
 *     (which is the <h1>) and again as the card's own heading, eight lines apart. The
 *     card now opens with the location line only. The name is never repeated.
 *
 *  2. "Ήρεμα τώρα" sat next to "Ιδανική στις 20:00" — two pills, one meaning. The
 *     tiered badge is gone from here; the verdict says it once, and the hours live in
 *     the "best time" section further down where they answer a different question.
 *
 *  3. THE TILES ONLY COVERED WEATHER. A visitor deciding on a beach needs the
 *     practical half just as much: what the road is like, whether there is anything
 *     there, whether they pay, what to pack. Those facts were on the page — scattered
 *     across four separate cards two to four screens down. They are now the second row.
 *
 * So the card is: where you are → one verdict → 4 weather tiles → 4 practical tiles →
 * how today compares with a normal month here. Nothing on it is stated twice.
 */

type HeroTone = 'calm' | 'moderate' | 'rough';

const TONE_SKIN: Record<HeroTone, { shell: string; verdict: string; halo: string }> = {
  calm: {
    shell: 'from-teal-50 via-sky-50 to-white border-teal-100',
    verdict: 'bg-teal-600 text-white shadow-teal-900/15',
    halo: 'bg-teal-200/35',
  },
  moderate: {
    shell: 'from-amber-50 via-orange-50/60 to-white border-amber-100',
    verdict: 'bg-amber-500 text-white shadow-amber-900/15',
    halo: 'bg-amber-200/35',
  },
  rough: {
    shell: 'from-rose-50 via-orange-50/50 to-white border-rose-100',
    verdict: 'bg-rose-600 text-white shadow-rose-900/15',
    halo: 'bg-rose-200/35',
  },
};

const BEST_TIME_LABEL: Record<LanguageCode, string> = {
  en: 'Best hours',
  gr: 'Καλύτερες ώρες',
  de: 'Beste Zeit',
  it: 'Orario migliore',
  fr: 'Meilleures heures',
};

/** Qualifier under the sunset hour when the sun actually sets over the water here. */
const OVER_SEA_HINT: Record<LanguageCode, string> = {
  en: 'over the sea',
  gr: 'στη θάλασσα',
  de: 'über dem Meer',
  it: 'sul mare',
  fr: 'sur la mer',
};

const AIR_TEMP_LABEL: Record<LanguageCode, string> = {
  en: 'air',
  gr: 'αέρας',
  de: 'Luft',
  it: 'aria',
  fr: 'air',
};

const READ_LABELS: Record<LanguageCode, { wind: string; sea: string; water: string; sunset: string }> = {
  en: { wind: 'Wind', sea: 'Waves', water: 'Water', sunset: 'Sunset' },
  gr: { wind: 'Άνεμος', sea: 'Κύμα', water: 'Νερό', sunset: 'Δύση' },
  de: { wind: 'Wind', sea: 'Wellen', water: 'Wasser', sunset: 'Sonne' },
  it: { wind: 'Vento', sea: 'Onde', water: 'Acqua', sunset: 'Tramonto' },
  fr: { wind: 'Vent', sea: 'Vagues', water: 'Eau', sunset: 'Coucher' },
};

interface ReadingProps {
  glyph: React.ReactNode;
  label: string;
  value: string;
  hint?: string | null;
}

/**
 * NO WORD IS EVER BROKEN IN A TILE.
 *
 * Two failed attempts paid for this rule. First `truncate` on one line, which produced
 * "βορειοανατ…" and "Ήπια θάλασ…". Then `overflow-wrap: anywhere`, which produced
 * "Χωματόδρο / μος" — a word split mid-syllable, which reads as a rendering bug and
 * stops the eye dead on a card whose entire purpose is to be glanced at.
 *
 * So: wrapping happens ONLY at spaces (`break-words` and `hyphens` are both off, which
 * is the browser default and must stay the default here), two lines maximum, and any
 * label that cannot survive that is shortened at the source instead. A quarter of a
 * 430 px screen is about 85 px — roughly ten Greek characters per line. Anything longer
 * gets a short form written for the tile, not a smaller font.
 */
const TILE_TEXT = 'w-full [overflow-wrap:normal] [word-break:normal] [hyphens:none]';

/**
 * Tile padding and the qualifier's size are BOTH width-conditional, because the binding
 * constraint is the longest single word in the longest language, and it is measured, not
 * guessed. A 320 px phone (iPhone SE) leaves ~66 px per tile: German "Handhabbare" and
 * Greek "Χωμάτινος" overflowed it by 4–5 px at 12 px type. Since the word may not be
 * broken, the only remaining levers are padding and font size — so both shrink below
 * 380 px and return above it. Verified by measuring scrollWidth vs clientWidth on every
 * [data-tilefit] text node at 320 / 360 / 430 px across all five languages; that probe
 * is the only way to catch this, since it renders fine on the machine you build it on.
 */
const TILE_BOX = 'flex min-w-0 flex-col items-center gap-1 rounded-2xl px-0.5 min-[380px]:px-1 py-3 text-center shadow-sm shadow-sky-900/5 ring-1';
const TILE_HINT = 'text-[9px] min-[380px]:text-[10px] font-semibold leading-[1.25] text-slate-500';

const Reading: React.FC<ReadingProps> = ({ glyph, label, value, hint }) => (
  <div data-tilefit="reading" className={`${TILE_BOX} bg-white/75 ring-white/60`}>
    <div className="h-6 w-9">{glyph}</div>
    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`${TILE_TEXT} text-[14px] min-[380px]:text-[15px] font-black leading-tight text-slate-900 tabular-nums`}>{value}</p>
    {hint && <p className={`${TILE_TEXT} ${TILE_HINT} line-clamp-2`}>{hint}</p>}
  </div>
);

export interface PracticalTile {
  key: string;
  /** Lucide icon component — the practical row uses plain icons, not instruments. */
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string | null;
  /** 'warn' tints the tile amber: dirt road, you-pay, pack-your-own-water. */
  tone?: 'neutral' | 'warn' | 'good';
}

export interface BeachAnswerHeroProps {
  islandName: string;
  compositionLabel?: string | null;
  /** The shared verdict word — same source as the map pin and the region card. */
  verdict: string | null;
  tone: HeroTone;
  bestTimeLabel?: string | null;
  wind: {
    beaufort: number;
    speedKmh: number;
    /** Short compass form ("ΒΑ") — the instrument tile is only a quarter-width. */
    directionLabel: string;
    /** Long adjective ("βορειοανατολικό") for the footnote line. */
    longDirectionLabel?: string;
  } | null;
  /** Air temperature — the footnote line, not an instrument. */
  airTempC?: number | null;
  sea: { heightM: number | null; label: string } | null;
  water: { celsius: number; descriptor: string; tone: HeroTone } | null;
  sunsetTime?: string | null;
  /**
   * "…and it drops into the sea here" — the evergreen orientation fact, not a forecast.
   * Rides as the sunset tile's qualifier rather than a ninth box: the hour and whether
   * it is worth staying for are one thought, and a beach that does NOT face the sunset
   * simply gets no qualifier (we never print the negative).
   */
  sunsetOverSea?: boolean;
  /**
   * "Calmer than a normal July here" — Copernicus monthly climatology for THIS beach.
   * Passed in already-worded; the hero never does the arithmetic.
   */
  climateNote?: { text: string; tone: 'better' | 'typical' | 'worse' } | null;
  /**
   * The practical half of the decision: road, facilities, entry, what to pack.
   * Built by the page so this component never touches the beach record.
   */
  practical?: PracticalTile[];
  language: LanguageCode;
}

/** A practical tile: plain icon, the fact, one qualifier. Same footprint as an instrument. */
const Practical: React.FC<{ tile: PracticalTile }> = ({ tile }) => {
  const Icon = tile.icon;
  return (
    <div
      data-tilefit="practical"
      className={`${TILE_BOX} ${
        tile.tone === 'warn'
          ? 'bg-amber-50/85 ring-amber-100'
          : tile.tone === 'good'
            ? 'bg-emerald-50/70 ring-emerald-100/80'
            : 'bg-white/75 ring-white/60'
      }`}
    >
      <Icon
        className={`h-6 w-6 ${
          tile.tone === 'warn' ? 'text-amber-600' : tile.tone === 'good' ? 'text-emerald-600' : 'text-slate-500'
        }`}
      />
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{tile.label}</p>
      <p className={`${TILE_TEXT} line-clamp-2 text-[11px] min-[380px]:text-[12px] font-black leading-[1.2] text-slate-900`}>
        {tile.value}
      </p>
      {tile.hint && <p className={`${TILE_TEXT} ${TILE_HINT} line-clamp-1`}>{tile.hint}</p>}
    </div>
  );
};

export const BeachAnswerHero: React.FC<BeachAnswerHeroProps> = ({
  islandName,
  compositionLabel,
  verdict,
  tone,
  bestTimeLabel,
  wind,
  airTempC,
  sea,
  water,
  sunsetTime,
  sunsetOverSea,
  climateNote,
  practical = [],
  language,
}) => {
  const skin = TONE_SKIN[tone];
  const labels = READ_LABELS[language] ?? READ_LABELS.en;
  const glyphTone: GlyphTone = tone;

  const readings: ReadingProps[] = [];
  if (wind) {
    readings.push({
      glyph: <WindGlyph beaufort={wind.beaufort} tone={glyphTone} className="h-full w-full" />,
      label: labels.wind,
      value: `${wind.beaufort} ${language === 'gr' ? 'Μπφ' : 'Bft'}`,
      hint: wind.directionLabel,
    });
  }
  if (sea) {
    readings.push({
      glyph: <SeaGlyph heightM={sea.heightM} tone={glyphTone} className="h-full w-full" />,
      label: labels.sea,
      value:
        typeof sea.heightM === 'number'
          ? `${sea.heightM.toFixed(1).replace('.', language === 'gr' ? ',' : '.')} ${language === 'gr' ? 'μ.' : 'm'}`
          : '—',
      hint: sea.label,
    });
  }
  if (water) {
    readings.push({
      glyph: <WaterTempGlyph celsius={water.celsius} tone={water.tone} className="h-full w-full" />,
      label: labels.water,
      value: `${water.celsius.toFixed(0)}°`,
      hint: water.descriptor,
    });
  }
  if (sunsetTime) {
    readings.push({
      glyph: <SunsetGlyph className="h-full w-full" />,
      label: labels.sunset,
      value: sunsetTime,
      // Two words, so it wraps at the space and never breaks. Only ever the positive.
      hint: sunsetOverSea ? (OVER_SEA_HINT[language] ?? OVER_SEA_HINT.en) : null,
    });
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border bg-gradient-to-br ${skin.shell} p-4 shadow-sm shadow-sky-900/5 sm:p-5`}
    >
      {/* A single soft halo behind the verdict, so the eye lands there first. */}
      <div className={`pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full blur-3xl ${skin.halo}`} aria-hidden="true" />

      <div className="relative space-y-3.5">
        {/* Location only. The beach NAME is the sticky header's <h1>, permanently visible
            at every scroll position — printing it again here, eight lines below itself,
            was pure repetition (reported 31/07). */}
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{islandName}</span>
          {compositionLabel && (
            <>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="truncate font-medium text-slate-600">{compositionLabel}</span>
            </>
          )}
        </p>

        {/* ONE verdict. It is the page's CTR hook and the only place the judgement is
            stated, so it stays crawlable (no data-nosnippet) — no more volatile than the
            "τώρα" in the weather card's <h2>, which Google has always been allowed to read.
            The tiered "Ιδανική στις 20:00" badge that used to sit beside it is gone: two
            pills saying the same thing, one screen apart, is exactly what this card exists
            to eliminate. The hours are still answered — in the "best time" section below,
            where they belong to a different question. */}
        {verdict && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center rounded-2xl px-4 py-2 font-heading text-lg font-black leading-none shadow-sm sm:text-xl ${skin.verdict}`}
            >
              {verdict}
            </span>
            {bestTimeLabel && (
              <span
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-white/70"
                data-nosnippet="true"
              >
                <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="text-slate-500">{BEST_TIME_LABEL[language] ?? BEST_TIME_LABEL.en}</span>
                <span>{bestTimeLabel}</span>
              </span>
            )}
          </div>
        )}

        {/* Row 1 — the sea and sky. Row 2 — the practical half of the same decision.
            Both are four tiles of the same size on purpose: "how is the water" and
            "what is the road like" are equally load-bearing for someone choosing where
            to spend the afternoon, and until now the second half was buried two to four
            screens down in four separate cards. */}
        {readings.length > 0 && (
          <div
            className={`grid gap-2 ${readings.length === 4 ? 'grid-cols-4' : readings.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
            data-nosnippet="true"
          >
            {readings.map((r) => (
              <Reading key={r.label} {...r} />
            ))}
          </div>
        )}

        {practical.length > 0 && (
          <div
            className={`grid gap-2 ${practical.length === 4 ? 'grid-cols-4' : practical.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            {practical.map((tile) => (
              <Practical key={tile.key} tile={tile} />
            ))}
          </div>
        )}

        {/* km/h and air temperature stay available but stop competing with the four
            instruments. Air temperature is explicitly labelled: an unlabelled degree
            symbol next to a water reading is how the card once told people the sea was
            36° (fixed 28/07) — every number on this page names what it measures. */}
        {(wind || typeof airTempC === 'number') && (
          <p className="px-0.5 text-[11px] font-semibold text-slate-500" data-nosnippet="true">
            {wind && `${wind.speedKmh.toFixed(0)} km/h · ${wind.longDirectionLabel || wind.directionLabel}`}
            {wind && typeof airTempC === 'number' && ' · '}
            {typeof airTempC === 'number' && `${airTempC.toFixed(0)}°C ${AIR_TEMP_LABEL[language] ?? AIR_TEMP_LABEL.en}`}
          </p>
        )}

        {climateNote && (
          <p
            className={`flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold leading-snug ${
              climateNote.tone === 'better'
                ? 'bg-teal-500/10 text-teal-900'
                : climateNote.tone === 'worse'
                  ? 'bg-amber-500/10 text-amber-900'
                  : 'bg-slate-500/10 text-slate-700'
            }`}
          >
            <span className="mt-px shrink-0" aria-hidden="true">
              {climateNote.tone === 'better' ? '↓' : climateNote.tone === 'worse' ? '↑' : '≈'}
            </span>
            <span>{climateNote.text}</span>
          </p>
        )}
      </div>
    </section>
  );
};
