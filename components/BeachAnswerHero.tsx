import React from 'react';
import { MapPin, Clock, Check, X, CalendarClock } from 'lucide-react';
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

const TONE_SKIN: Record<HeroTone, { shell: string; halo: string }> = {
  calm: {
    shell: 'from-teal-50 via-sky-50 to-white border-teal-100',
    halo: 'bg-teal-200/35',
  },
  moderate: {
    shell: 'from-amber-50 via-orange-50/60 to-white border-amber-100',
    halo: 'bg-amber-200/35',
  },
  rough: {
    shell: 'from-rose-50 via-orange-50/50 to-white border-rose-100',
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

// `seaOpen` is the SAME instrument as `sea`, labelled for where the number was actually taken.
//
// The live marine value is a grid cell 9–18 km offshore, not the water in front of the beach.
// Measured nationally 01/08/2026 (2.553 beaches, 15:00): the wave travels AWAY from the shore on
// 1.148 of them (45%) and parallel on 352 (13,8%) — 501 beaches (19,6%) were showing a >= 0,8 m
// figure that never reaches them. Reported as «Βραυρώνα 2,0 m orange vs Ραφήνα 1,3 m red».
//
// The number itself does NOT move (99-decision-log 29/07: a downward cap on a lee shore was
// measured and rejected). Only the word above it changes, and only when the figure really is the
// area grid — see `isOpenWater`, which the cove guard flips off because there the number is our
// own near-shore SMB estimate and «offshore» would be a fresh lie.
const READ_LABELS: Record<LanguageCode, { wind: string; sea: string; seaOpen: string; water: string; sunset: string }> = {
  en: { wind: 'Wind', sea: 'Waves', seaOpen: 'Waves offshore', water: 'Water', sunset: 'Sunset' },
  gr: { wind: 'Άνεμος', sea: 'Κύμα', seaOpen: 'Κύμα ανοιχτά', water: 'Νερό', sunset: 'Δύση' },
  de: { wind: 'Wind', sea: 'Wellen', seaOpen: 'Wellen draußen', water: 'Wasser', sunset: 'Sonne' },
  it: { wind: 'Vento', sea: 'Onde', seaOpen: 'Onde al largo', water: 'Acqua', sunset: 'Tramonto' },
  fr: { wind: 'Vent', sea: 'Vagues', seaOpen: 'Vagues au large', water: 'Eau', sunset: 'Coucher' },
};

/** Shown when the shore reading leads: the label above it, and the «offshore …» note beneath. */
const SHORE_LABELS: Record<LanguageCode, { atShore: string; offshore: (v: string) => string }> = {
  en: { atShore: 'Waves at the shore', offshore: (v) => `${v} offshore` },
  gr: { atShore: 'Κύμα στην ακτή', offshore: (v) => `${v} ανοιχτά` },
  de: { atShore: 'Wellen am Ufer', offshore: (v) => `${v} draußen` },
  it: { atShore: 'Onde a riva', offshore: (v) => `${v} al largo` },
  fr: { atShore: 'Vagues au rivage', offshore: (v) => `${v} au large` },
};

/**
 * How this shore sits in today's wind, in the fewest words that still mean something to a
 * swimmer. Deliberately everyday language, not the scoring vocabulary: «στη σκιά» and
 * «κατάμουτρα» need no glossary, «Προστατευμένη / Εκτεθειμένη» reads like a category.
 *
 * Wired from the MAP-ALIGNED exposure level, so this line and the pin colour are the same
 * fact — that is the whole point. A reader comparing an orange 2,0 m beach with a red 1,3 m
 * one can see the reason without opening anything.
 *
 * Kept in step with INCIDENCE_WORD in utils/windIncidence.ts (de/fr/it reuse its wording).
 */
export const SHELTER_LABEL: Record<LanguageCode, { protected: string; partial: string; exposed: string }> = {
  en: { protected: 'sheltered', partial: 'side-on', exposed: 'head-on' },
  gr: { protected: 'στη σκιά', partial: 'πλάγια', exposed: 'κατάμουτρα' },
  de: { protected: 'geschützt', partial: 'seitlich', exposed: 'frontal' },
  it: { protected: 'riparata', partial: 'di lato', exposed: 'di faccia' },
  fr: { protected: 'abrité', partial: 'de côté', exposed: 'de face' },
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
    <p className="text-[9px] font-bold tracking-wide text-slate-500">{label}</p>
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
  /** Colours the card shell and halo. Same sea verdict the map pin reads — it is no longer
   *  also spelled out in a pill here, only shown (see the note on the location row below). */
  tone: HeroTone;
  bestTimeLabel?: string | null;
  /**
   * One sentence saying how the live wind meets THIS shore, and therefore why the verdict
   * and the wave figure read the way they do. Source: WeatherNowContent.liveSentence — do
   * not compose a new one here; that copy is the measured, five-language, gate-swept text.
   */
  explanation?: string | null;
  wind: {
    beaufort: number;
    speedKmh: number;
    /** Short compass form ("ΒΑ") — the instrument tile is only a quarter-width. */
    directionLabel: string;
    /**
     * How this shore sits in the live wind — «στη σκιά» / «πλάγια» / «κατάμουτρα». This is
     * the SAME fact the map pin is coloured from (the map-aligned exposure level), so the
     * tile can explain the colour instead of merely repeating the compass point.
     */
    shelterLabel?: string | null;
    /** Long adjective ("βορειοανατολικό") for the footnote line. */
    longDirectionLabel?: string;
  } | null;
  /** Air temperature — the footnote line, not an instrument. */
  airTempC?: number | null;
  sea: {
    heightM: number | null;
    label: string;
    /**
     * True when `heightM` is the live marine grid reading (open water, 9–18 km out); false when it
     * is our own near-shore figure — the cove-guard SMB estimate or the modelled fallback, both of
     * which describe THIS shore. Drives the label only; the number is identical either way.
     */
    isOpenWater: boolean;
    /**
     * The modelled height AT THE SHORE (utils/shoreWave), present only where the wind blows off
     * the land into a fetch-free, land-blocked sector with no swell running. When it is here the
     * tile leads with it and demotes `heightM` to a secondary «ανοιχτά …» note — because a metre
     * figure beside a beach name is read as the water at that beach, and on those shores it is
     * not. Absent (the normal case) the tile behaves exactly as before.
     */
    shoreHeightM?: number | null;
  } | null;
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
  /**
   * The facilities list, with its tick / cross / seasonal marks — the one practical fact
   * that is a LIST, not a single value, so it gets a full-width panel instead of being
   * flattened into a quarter-width tile reading "Οργανωμένη". Moved up here whole; the
   * old two-column section further down the page was deleted, not duplicated.
   */
  amenities?: { key: string; label: string; value: string; status: 'yes' | 'seasonal' | 'no' | 'unknown' | 'limited' }[];
  amenitiesTitle?: string;
  amenitiesNote?: string | null;
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
      <p className="text-[9px] font-bold tracking-wide text-slate-500">{tile.label}</p>
      {/* Three lines, not two: the "bring" tile may legitimately carry three short nouns
          ("Νερό, Αντηλιακό, Παπούτσια θαλάσσης") and they must ALL be visible — the tile
          is not clickable, so anything clamped away is simply lost to the reader. */}
      <p className={`${TILE_TEXT} line-clamp-3 text-[11px] min-[380px]:text-[12px] font-black leading-[1.2] text-slate-900`}>
        {tile.value}
      </p>
      {tile.hint && <p className={`${TILE_TEXT} ${TILE_HINT} line-clamp-1`}>{tile.hint}</p>}
    </div>
  );
};

/**
 * Facilities, as a list with marks. This is the one practical fact that is plural, so
 * squeezing it into a quarter-width tile ("Οργανωμένη") threw away exactly what a visitor
 * wants to know — IS there a beach bar, ARE there sunbeds. Full width, two columns, one
 * glyph per row: tick = yes, calendar = seasonal/limited, cross = confirmed absent.
 *
 * Rows whose status is 'unknown' are dropped, not shown greyed: the same rule as the
 * missing tile. "Άγνωστο" next to "Ξαπλώστρες" is read as "there are none".
 */
const AmenityPanel: React.FC<{
  rows: NonNullable<BeachAnswerHeroProps['amenities']>;
  title?: string;
  note?: string | null;
}> = ({ rows, title, note }) => {
  const known = rows.filter((r) => r.status !== 'unknown');
  if (!known.length) return null;
  return (
    <div className="space-y-2">
      {title && <p className="px-1 text-[9px] font-bold tracking-wide text-slate-500">{title}</p>}
      {/* Same grid, same gap, same rounding as the tile rows above — so on desktop each
          facility sits in its own column, flush with the tile over it, instead of floating
          inside one wide box with its own indent (reported 31/07). Two columns on a phone,
          because "Ταβέρνες κοντά" cannot fit a quarter of 430 px without breaking, and a
          broken word is the one thing these tiles never do. */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {known.map((row) => {
          const yes = row.status === 'yes';
          const partial = row.status === 'seasonal' || row.status === 'limited';
          const Glyph = yes ? Check : partial ? CalendarClock : X;
          return (
            <li
              key={row.key}
              className={`flex min-w-0 items-center gap-2 rounded-2xl px-2.5 py-2.5 shadow-sm shadow-sky-900/5 ring-1 ${
                yes
                  ? 'bg-emerald-50/70 ring-emerald-100/80'
                  : partial
                    ? 'bg-amber-50/70 ring-amber-100'
                    : 'bg-white/60 ring-white/60'
              }`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                  yes ? 'bg-emerald-500 text-white' : partial ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Glyph className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block ${TILE_TEXT} line-clamp-2 text-[11px] min-[380px]:text-[12px] font-bold leading-[1.2] ${
                    yes ? 'text-slate-900' : partial ? 'text-slate-800' : 'text-slate-400 line-through'
                  }`}
                >
                  {row.label}
                </span>
                {partial && <span className="block text-[10px] font-semibold text-amber-700">{row.value}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {note && <p className="px-1 text-[10px] font-semibold leading-snug text-slate-500">{note}</p>}
    </div>
  );
};

export const BeachAnswerHero: React.FC<BeachAnswerHeroProps> = ({
  islandName,
  compositionLabel,
  tone,
  bestTimeLabel,
  explanation,
  wind,
  airTempC,
  sea,
  water,
  sunsetTime,
  sunsetOverSea,
  climateNote,
  practical = [],
  amenities = [],
  amenitiesTitle,
  amenitiesNote,
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
      // «Β» alone is a compass point; «Β · στη σκιά» is the reason for the colour. The
      // shelter half is what lets a reader see at a glance why a 2,0 m beach can beat a
      // 1,3 m one — it is the map-aligned exposure level, the same input the pin uses.
      hint: wind.shelterLabel ? `${wind.directionLabel} · ${wind.shelterLabel}` : wind.directionLabel,
    });
  }
  if (sea) {
    const unit = language === 'gr' ? 'μ.' : 'm';
    const metres = (m: number) => `${m.toFixed(1).replace('.', language === 'gr' ? ',' : '.')} ${unit}`;
    // THE SHORE READING LEADS WHEN WE HAVE ONE. Both numbers stay on screen and each says where
    // it was taken — the open-water figure is not hidden, it is demoted to the hint, because it
    // is still the number that justifies the drift warning (the wind pushing a float out there
    // is pushing it toward exactly that sea). The «~» is not decoration: the shore figure is
    // modelled, the offshore one measured, and the tile must not let them look alike.
    const shoreLeads = typeof sea.shoreHeightM === 'number' && Number.isFinite(sea.shoreHeightM);
    const shoreCopy = SHORE_LABELS[language] ?? SHORE_LABELS.en;
    readings.push({
      glyph: <SeaGlyph heightM={sea.heightM} tone={glyphTone} className="h-full w-full" />,
      label: shoreLeads ? shoreCopy.atShore : (sea.isOpenWater ? labels.seaOpen : labels.sea),
      value: shoreLeads
        ? `~${metres(sea.shoreHeightM as number)}`
        : typeof sea.heightM === 'number' ? metres(sea.heightM) : '—',
      hint: shoreLeads && typeof sea.heightM === 'number'
        ? `${sea.label} · ${shoreCopy.offshore(metres(sea.heightM))}`
        : sea.label,
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

        {/* NO VERDICT PILL. It used to lead the card with «Λίγο κύμα στις 15:00» in a big
            coloured badge — and that was one judgement too many: the tiles right below it
            already state the wind, the wave and the hours in numbers, and the shell colour
            already carries the same tone. A pill that re-says in words what the card then
            says in figures reads as a second, competing answer (reported 01/08/2026).
            The judgement is not lost — the tone still colours this card, the map pin and
            the region cards, all from the one sea verdict in utils/seaVerdict. */}
        {bestTimeLabel && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-white/70"
              data-nosnippet="true"
            >
              <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="text-slate-500">{BEST_TIME_LABEL[language] ?? BEST_TIME_LABEL.en}</span>
              <span>{bestTimeLabel}</span>
            </span>
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

        {/* WHY THIS BEACH READS THE WAY IT DOES — the sentence that makes the instruments
            make sense together.

            Without it the card is four numbers and a colour, and the reader has no way to
            reconcile them: Βραυρώνα prints 2,0 m and is ORANGE while Πλαζ Ραφήνας prints
            1,3 m and is RED, because the meltemi goes straight into one and misses the
            other — but nothing on screen said so. Reported 01/08/2026: «δεν καταλαβαίνει
            κάποιος γιατί η μία παραλία είναι καλύτερη».

            The sentence itself is NOT new — utils/weatherNowCopy has built it in five
            languages all along (and the gates sweep it). It stopped being rendered when this
            card replaced the old "weather now" block on 31/07, and the flag it ships with
            (statesShoreIncidence) went on silencing the SECOND copy of the same fact further
            down the page, so the explanation vanished from both places at once. */}
        {explanation && (
          <p className="px-1 text-sm font-medium leading-relaxed text-slate-700" data-nosnippet="true">
            {explanation}
          </p>
        )}

        {practical.length > 0 && (
          <div
            className={`grid gap-2 ${practical.length >= 4 ? 'grid-cols-4' : practical.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            {practical.map((tile) => (
              <Practical key={tile.key} tile={tile} />
            ))}
          </div>
        )}

        <AmenityPanel rows={amenities} title={amenitiesTitle} note={amenitiesNote} />

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
