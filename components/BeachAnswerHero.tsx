import React from 'react';
import { MapPin, Clock, Check, X, CalendarClock } from 'lucide-react';
import type { LanguageCode } from '../types';
import { WindGlyph, SeaGlyph, WaterTempGlyph, SunsetGlyph, type GlyphTone } from './ConditionGlyphs';
import { buildConditionsFeel } from '../utils/conditionsFeelPhrase';
import { formatBeaufortLabel } from '../utils/beaufortRange';

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

/* ΕΠΙΠΕΔΗ ΑΠΟΧΡΩΣΗ, ΟΧΙ ΠΛΥΣΗ ΧΡΩΜΑΤΟΣ (28/08/2026). Ο τόνος — ήρεμα / μέτρια /
   φουρτούνα — ΜΕΝΕΙ, γιατί είναι πληροφορία: το ίδιο χρώμα φοράει η πινέζα στον
   χάρτη και η κάρτα στη λίστα, από τη μία ετυμηγορία του utils/seaVerdict.
   Αυτό που φεύγει είναι ο τρόπος: ντεγκραντέ τριών στάσεων σε όλη την κάρτα, με
   ένα θολωμένο φωτοστέφανο από πάνω. Πάνω σε φόντο που έλαμπε ήδη, το αποτέλεσμα
   ήταν ότι έλαμπαν τα πάντα και δεν ξεχώριζε τίποτα — και το `blur-3xl` είναι μια
   ολόκληρη στρώση σύνθεσης στο κινητό, εκεί που το ίδιο αρχείο CSS κόβει το
   backdrop-filter από 40 κάρτες για ακριβώς αυτόν τον λόγο. */
const TONE_SKIN: Record<HeroTone, { shell: string }> = {
  calm: { shell: 'bg-teal-50/80 border-teal-100' },
  moderate: { shell: 'bg-amber-50/80 border-amber-100' },
  rough: { shell: 'bg-rose-50/80 border-rose-100' },
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
export const READ_LABELS: Record<LanguageCode, { wind: string; sea: string; seaOpen: string; water: string; sunset: string }> = {
  en: { wind: 'Wind', sea: 'Waves', seaOpen: 'Waves offshore', water: 'Water', sunset: 'Sunset' },
  gr: { wind: 'Άνεμος', sea: 'Κύμα', seaOpen: 'Κύμα ανοιχτά', water: 'Νερό', sunset: 'Δύση' },
  de: { wind: 'Wind', sea: 'Wellen', seaOpen: 'Wellen draußen', water: 'Wasser', sunset: 'Sonne' },
  it: { wind: 'Vento', sea: 'Onde', seaOpen: 'Onde al largo', water: 'Acqua', sunset: 'Tramonto' },
  fr: { wind: 'Vent', sea: 'Vagues', seaOpen: 'Vagues au large', water: 'Eau', sunset: 'Coucher' },
};

/** Shown when the shore reading leads: the label above it, and the «offshore …» note beneath. */
/**
 * ΜΙΑ ΕΤΙΚΕΤΑ ΤΙΤΛΟΥ ΚΑΙ ΜΙΑ INLINE — ΚΑΙ ΟΧΙ ΤΡΙΤΗ (13/08/2026).
 *
 * Δοκιμάστηκε και μια σύντομη inline μορφή της ακτής («~0,2 μ. στην ακτή») για τις κάρτες του
 * podium. Κόπηκε την ίδια μέρα από τον Μίλτο («στο mobile έχει πολύ κείμενο») και από το
 * `validateTileFit` (κοβόταν στα 390 px) — και αποδείχθηκε περιττή: η κάρτα δείχνει πλέον ΠΑΝΤΑ
 * το νερό της ακτής, ένα μέγεθος για όλες τις παραλίες, οπότε δεν έχει τι να ξεχωρίσει με λέξη.
 * Ο τίτλος `atShore` ζει στο πλακίδιο της σελίδας, όπου υπάρχει χώρος για επικεφαλίδα.
 */
export const SHORE_LABELS: Record<LanguageCode, { atShore: string; offshore: (v: string) => string }> = {
  en: { atShore: 'Waves at the shore', offshore: (v) => `${v} offshore` },
  gr: { atShore: 'Κύμα στην ακτή', offshore: (v) => `${v} ανοιχτά` },
  de: { atShore: 'Wellen am Ufer', offshore: (v) => `${v} draußen` },
  it: { atShore: 'Onde a riva', offshore: (v) => `${v} al largo` },
  fr: { atShore: 'Vagues au rivage', offshore: (v) => `${v} au large` },
};

/**
 * How this shore sits in today's wind, in the fewest words that still mean something to a
 * swimmer. Deliberately everyday language, not the scoring vocabulary: «απάνεμη» and
 * «κατάμουτρα» need no glossary, «Προστατευμένη / Εκτεθειμένη» reads like a category.
 *
 * The Greek word for "protected" used to be «στη σκιά». It was wrong for this site: we also
 * say «σκιά» for actual shade from the sun (amenities, guide copy), so «Β · στη σκιά» read
 * as "there are trees" instead of "the wind misses this shore". «Απάνεμη» cannot be misread.
 *
 * Wired from the MAP-ALIGNED exposure level, so this line and the pin colour are the same
 * fact — that is the whole point. A reader comparing an orange 2,0 m beach with a red 1,3 m
 * one can see the reason without opening anything.
 *
 * Kept in step with INCIDENCE_WORD in utils/windIncidence.ts (de/fr/it reuse its wording).
 *
 * ⚠️ «ΑΠΑΝΕΜΗ» ΕΧΕΙ ΤΑΒΑΝΙ ΜΠΟΦΟΡ (Μίλτος, 14/08/2026 — σχόλιο επισκέπτη, Φυριπλάκα id 1927).
 *
 * Η σελίδα τύπωνε «6 Μπφ» και από κάτω «Β · απάνεμη». Η γεωμετρία ήταν σωστή — η Φυριπλάκα
 * κοιτάει 205°, ο βοριάς της έρχεται από τη στεριά, fetch 0 χλμ., άρα κύμα δεν της φέρνει.
 * Λάθος ήταν η ΛΕΞΗ: «απάνεμη» υπόσχεται «δεν φυσάει», ενώ εμείς εννοούμε «ο αέρας δεν σου
 * φέρνει κύμα». Στα 6 Μποφόρ ο επισκέπτης τρώει άμμο στα μούτρα και διαβάζει «απάνεμη» — και
 * ένας από αυτούς μπήκε στον κόπο να μας το γράψει. Δεν είναι μία παραλία: 1.690 από τις 2.861
 * είναι γεωμετρικά προστατευμένες στον βοριά, δηλαδή ΚΑΘΕ μελτεμιάρα μέρα του Αυγούστου.
 *
 * Από 6 Μποφόρ και πάνω η λέξη γίνεται λοιπόν «φυσάει δυνατά»: ίδια γεωμετρία, καμία
 * υπόσχεση νηνεμίας, και στέκει δίπλα σε κόκκινη πινέζα χωρίς να την αναιρεί. (Ήταν «από
 * πίσω» ως τις 27/08/2026 — ο Μίλτος το έκοψε: «από πίσω» είναι γωνία και δεν λέει τίποτα
 * σε όποιον δεν ξέρει τη γεωμετρία μας· η λέξη λέει τι ΒΙΩΝΕΙ κανείς, όπως και το «φυσάει»
 * του windFelt — ίδια οικογένεια, ένα σκαλί πιο πάνω.) Είναι ο ΙΔΙΟΣ κανόνας
 * που πήρε η κάρτα την ίδια μέρα (RELIEF_MAX_BEAUFORT, utils/conditionsFeelPhrase.ts): μονόδρομη
 * πύλη που μπορεί να αφαιρέσει ανακούφιση, ποτέ να την προσθέσει. Το «κατάμουτρα» δεν το
 * χρειάζεται — δεν υπόσχεται τίποτα εξαρχής.
 *
 * ΤΟ «ΠΛΑΓΙΑ» ΕΓΙΝΕ ΚΛΙΜΑΚΑ ΒΙΩΜΑΤΟΣ (Μίλτος, 27/08/2026, τρίτη ανάγνωση της ίδιας μέρας):
 * «πλάγια» ήταν γωνία, όχι βίωμα. Ο αέρας που περνά από το πλάι σου δεν σου φέρνει μεγάλο
 * κύμα, αλλά τον ΝΙΩΘΕΙΣ — και πόσο, το λέει ο αριθμός δίπλα: στα 3 Μπφ «αεράκι» (η λέξη
 * `partial`), στα 4-5 «φυσάει» (`windFelt`), από 6 «φυσάει δυνατά» (`protectedStrongWind`).
 * Η ΙΔΙΑ τριάδα λέξεων με την υπήνεμη ακτή — ένα λεξιλόγιο στο πλακίδιο, όχι δύο· τη
 * διαφορά στο κύμα τη λένε το διπλανό πλακίδιο και το χρώμα. Κρίνεται στο ΤΥΠΩΜΕΝΟ μέγιστο
 * (BeachDetailPage, printedBeaufortMax), όπως όλα τα ταβάνια της λέξης από σήμερα.
 */
export const SHELTER_LABEL: Record<LanguageCode, { protected: string; partial: string; exposed: string; protectedStrongWind: string; windFelt: string }> = {
  en: { protected: 'sheltered', partial: 'breezy', exposed: 'head-on', protectedStrongWind: 'very windy', windFelt: 'windy' },
  gr: { protected: 'απάνεμη', partial: 'αεράκι', exposed: 'κατάμουτρα', protectedStrongWind: 'φυσάει δυνατά', windFelt: 'φυσάει' },
  de: { protected: 'geschützt', partial: 'leichter Wind', exposed: 'frontal', protectedStrongWind: 'sehr windig', windFelt: 'windig' },
  it: { protected: 'riparata', partial: 'brezza', exposed: 'di faccia', protectedStrongWind: 'molto ventoso', windFelt: 'ventoso' },
  fr: { protected: 'abrité', partial: 'brise', exposed: 'de face', protectedStrongWind: 'très venteux', windFelt: 'venteux' },
};

/**
 * Πάνω από αυτό, «απάνεμη» δεν λέγεται. Ίδιο νούμερο με το RELIEF_MAX_BEAUFORT της κάρτας,
 * και ίδιο με το σημείο όπου ο χάρτης αρχίζει να βάφει κόκκινο.
 *
 * ⚠️ ΑΠΟ 27/08/2026 ΚΡΙΝΕΤΑΙ ΣΤΟΝ ΜΕΓΑΛΥΤΕΡΟ ΤΥΠΩΜΕΝΟ ΑΡΙΘΜΟ, όχι μόνο στο κάτω άκρο:
 * με το εύρος ριπών ζωντανό, το Γάνεμα Σερίφου (#2078) έγραψε «5–6 Μπφ» με «απάνεμη» από
 * κάτω — το 5 περνούσε το ταβάνι, το 6 που έβλεπε ο αναγνώστης όχι. Η λέξη δεσμεύεται από
 * ό,τι τυπώνεται δίπλα της (BeachDetailPage, printedBeaufortMax)· το ίδιο ισχύει και για
 * το κατώφλι του «φυσάει» πιο κάτω.
 */
export const SHELTER_WORD_MAX_BEAUFORT = 5;

/**
 * ⚠️ ΚΑΙ ΚΑΤΩ ΑΠΟ ΤΟ ΤΑΒΑΝΙ, «ΑΠΑΝΕΜΗ» ΜΟΝΟ ΑΝ Ο ΑΝΕΜΟΣ ΟΝΤΩΣ ΗΡΘΕ ΠΑΝΩ ΑΠΟ ΣΤΕΡΙΑ
 * (Μίλτος, 27/08/2026 — σχόλιο επισκέπτη, Γλυφάδα Νάξου id 1993, 09:00).
 *
 * Η σελίδα τύπωνε «4 Μπφ» και «Β · απάνεμη». Η γεωμετρία ήταν σωστή ΓΙΑ ΤΟ ΚΥΜΑ — ο τομέας
 * Β της Γλυφάδας έχει άνοιγμα 0,96 χλμ, κύμα δεν χτίζεται — αλλά το `windShadow` της έλεγε
 * ότι ο βοριάς ΔΕΝ πέρασε πάνω από στεριά: τρέχει κατά μήκος της δυτικής ακτής και χτυπάει
 * τον επισκέπτη αφρέναρος, πλάγια. «Απάνεμη» εκεί υπόσχεται νηνεμία που το δέρμα διαψεύδει
 * — η Φυριπλάκα ξανά (δες το μπλοκ του SHELTER_WORD_MAX_BEAUFORT), απλώς κάτω από τα 6 Μπφ
 * όπου εκείνος ο κανόνας γυρίζει τη λέξη.
 *
 * Η πύλη: επίπεδο 'protected' + άνεμος από αυτό το Μποφόρ και πάνω + high-confidence
 * `windShadow` που λέει «ΔΕΝ ήρθε από στεριά» (utils/offshoreWindNote.windArrivedOverLand,
 * το ίδιο βαθμονομημένο εργαλείο της γραμμής απόγειου ανέμου) → η λέξη γίνεται «φυσάει».
 * Μονόδρομη, όπως όλες οι πύλες της οικογένειας: αφαιρεί υπόσχεση, δεν προσθέτει ποτέ· σε
 * άγνωστο ή ελλιπές windShadow σιωπά και η λέξη μένει ως είχε.
 *
 * Η ΛΕΞΗ ΕΙΝΑΙ «ΦΥΣΑΕΙ», ΟΧΙ «ΠΛΑΓΙΑ» (Μίλτος, 27/08/2026, δεύτερη ανάγνωση): «πλάγια»
 * περιγράφει γωνία και ο επισκέπτης δεν την καταλαβαίνει — η λέξη πρέπει να λέει τι ΒΙΩΝΕΙ.
 * Αυτός που στέκεται στην άμμο με 4-5 Μπφ να τρέχουν δίπλα του βιώνει ένα πράγμα: φυσάει.
 * Ίδια οικογένεια λέξης με το «Β · απάνεμη» — καθημερινή, χωρίς γλωσσάρι.
 *
 * ΚΑΤΩ ΟΡΙΟ 4, ΟΧΙ 3: στα 3 Μπφ η «απάνεμη» δεν ξενίζει κανέναν — ίδια λογική με το
 * WIND_NOTE_MIN_BEAUFORT της γραμμής ανέμου. Μετρημένο πριν μπει
 * (scripts/measureShelterWordLandGate.mjs, reports/weather/shelter-word-land-gate-2026-08-27):
 * οι μάρτυρες κρατούν τη λέξη (Φυριπλάκα #1927, Βάι #730, Λιβάδια #2033 — ο αέρας τους
 * περνά πάνω από ράχη) και τα δύο feedback της γεννούν την αλλαγή (Γλυφάδα #1993 27/08,
 * Ψιλή Άμμος #2017 25/08) γυρίζουν σε «πλάγια».
 */
export const SHELTER_WORD_LAND_GATE_MIN_BEAUFORT = 4;

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
/* 05/08/2026 — THE PROBE ABOVE IS NOW A COMMITTED GATE: scripts/validateTileFit.mjs, in the
   critical set. Written because the labels were raised off 9 px (illegible on a real phone)
   and there was no way to answer "did that break the fit?". It immediately found three words
   still being cut at 320 px, all of them old: «Με αυτοκίνητο» by 8 px, «Παπούτσια θαλάσσης»
   by 6, the German sea hint by 2. Hence: below 380 px the tile gives up its last 2 px of side
   padding and the value and hint each drop one step. Above 380 px nothing changes.

   The LABEL is a flat 10 px at every width, and that is a measurement too, not a compromise.
   At 11 px «Κύμα ανοιχτά» wraps onto a second line, and because a tile is a flex column that
   pushes its number down while the three tiles beside it keep theirs up — the row of figures
   stops being a row. 10 px keeps every label on one line in all five languages at 320-430 px
   and is still a step up from the 9 px it was. */
/* SUBGRID, not flex-column. A tile is four stacked slots (glyph / label / value / hint) and
   with a flex column each tile sizes those slots on its own — so the moment ONE label wraps
   to two lines («Κύμα ανοιχτά» at phone width) that tile's number drops ~12 px below the three
   beside it and the row of figures stops reading as a row (reported 11/08/2026). Spanning the
   parent grid's four rows makes the four slots line up ACROSS tiles: every label row is as tall
   as the tallest label, so the numbers share one baseline whatever the language does to the
   words. `gap-1` here overrides the parent's gap-2 for the tracks the tile spans, so the inside
   of a tile keeps its old 4 px rhythm while the gap between tiles stays 8 px. */
/* ΧΩΡΙΣ ΓΕΜΙΣΜΑ, ΧΩΡΙΣ ΔΑΧΤΥΛΙΔΙ, ΧΩΡΙΣ ΣΚΙΑ (28/08/2026). Οκτώ λευκά κουτάκια, το
   καθένα με δικό του δαχτυλίδι και δική του σκιά, ΜΕΣΑ σε μια ήδη χρωματισμένη κάρτα:
   τρία επίπεδα πλαισίου για μία ένδειξη. Οι μετρήσεις κάθονται τώρα απευθείας πάνω στην
   κάρτα και τις ξεχωρίζει το κενό — όπως οι τρεις αριθμοί κάτω από τον χάρτη στη σελίδα
   περιοχής. ΤΟ ΧΡΩΜΑ ΔΕΝ ΧΑΝΕΤΑΙ: όπου έλεγε κάτι (πράσινο «εντάξει», κεχριμπάρι
   «πρόσεξε»), το λέει τώρα το εικονίδιο και ο ίδιος ο αριθμός, όχι μια γεμάτη πλάκα.
   ΠΡΟΣΟΧΗ: padding και μεγέθη γραμμάτων ΔΕΝ αλλάζουν εδώ — είναι μετρημένα (βλ. σχόλιο
   πιο πάνω) και τα φυλάει το scripts/validateTileFit.mjs. */
const TILE_BOX = 'grid grid-rows-subgrid row-span-4 min-w-0 justify-items-center gap-1 rounded-control px-0 min-[380px]:px-1 py-3 text-center';
const TILE_HINT = 'text-[8px] min-[380px]:text-[10px] font-semibold leading-[1.25] text-slate-500';

const Reading: React.FC<ReadingProps> = ({ glyph, label, value, hint }) => (
  <div data-tilefit="reading" className={TILE_BOX}>
    <div className="h-6 w-9">{glyph}</div>
    <p className="text-[10px] font-bold tracking-wide text-slate-500">{label}</p>
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
  /**
   * The explanation slot carries two different kinds of text and they want opposite
   * typography. The live sentence is a paragraph that explains the instruments — it reads
   * left-aligned, like prose. The calm-day verdict is four words that ARE the answer, and
   * left-aligned at the same weight it read as a stray caption hanging off the edge of the
   * card (reported 05/08/2026). Centred and heavier, it lands where the eye already is:
   * on the axis of the four tiles above it.
   */
  explanationIsVerdict?: boolean;
  wind: {
    beaufort: number;
    /**
     * Άνω άκρο του εύρους («3–4 Μπφ») όταν οι ριπές της ώρας βγάζουν ολόκληρο σκαλί —
     * utils/beaufortRange. Μόνο το τυπωμένο νούμερο το διαβάζει· το γλυφ, η λέξη και το χρώμα
     * μένουν στο `beaufort` (κάτω άκρο). Απουσία = σκέτο νούμερο, όπως πριν.
     */
    beaufortHigh?: number | null;
    speedKmh: number;
    /** Short compass form ("ΒΑ") — the instrument tile is only a quarter-width. */
    directionLabel: string;
    /**
     * How this shore sits in the live wind — «απάνεμη» / «πλάγια» / «κατάμουτρα». This is
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
    /**
     * Από πού έρχεται η θάλασσα (BeachScore.seaArrivalExposureLevel). Κρίνει ΜΟΝΟ τη λέξη του
     * κύματος στη φράση (utils/conditionsFeelPhrase.waveFeelLevelWithArrival, Συκιά #445,
     * 27/08/2026) — ίδια είσοδος με την κάρτα, ώστε οι δύο επιφάνειες να μη διαφωνούν.
     */
    arrivalExposureLevel?: string | null;
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
   * «Σκάει όμως το κύμα λίγο παραπάνω στην ακτή» — utils/shoreBreak, decided by the page.
   *
   * A FULL-WIDTH LINE, AND THAT IS THE THIRD PLACE THIS NOTE WAS TRIED (13/08/2026). It started as
   * a warning chip on the card, where it landed fourth of five and the card shows two. It was then
   * moved to `getSeaConditionDisplay`'s `subValue` — which the four-tile grid does not render at
   * all (only the boat-only row does), so it was invisible again. Both times the mistake was the
   * same: assuming a slot was on screen instead of following the value to the JSX that prints it.
   *
   * Here it sits beside `climateNote`, in the one layout on this page built for a sentence about
   * the sea. It is the only place with room for it and nothing that can push it out.
   */
  shoreBreakNote?: string | null;
  /**
   * «Ο αέρας έρχεται από τη στεριά — μπροστά σου το νερό είναι πιο ήρεμο απ’ ό,τι λέει ο αριθμός»
   * — utils/offshoreWindNote, αποφασισμένη από τη σελίδα και ήδη διατυπωμένη, όπως το
   * `shoreBreakNote` και το `climateNote`.
   *
   * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΚΑΡΤΑ: η κάρτα δοκίμασε δεύτερη γραμμή δίπλα στον αριθμό στις
   * 13/08/2026 και ο Μίλτος την έκοψε («στο mobile έχει πολύ κείμενο»), με το `validateTileFit`
   * να συμφωνεί — στα 390 px η γραμμή κοβόταν. Αυτή είναι η μία διάταξη της σελίδας που είναι
   * χτισμένη για πρόταση περί θάλασσας.
   */
  offshoreWindNote?: string | null;
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
      className={TILE_BOX}
    >
      <Icon
        className={`h-6 w-6 ${
          tile.tone === 'warn' ? 'text-amber-600' : tile.tone === 'good' ? 'text-emerald-600' : 'text-slate-500'
        }`}
      />
      <p className="text-[10px] font-bold tracking-wide text-slate-500">{tile.label}</p>
      {/* Three lines, not two: the "bring" tile may legitimately carry three short nouns
          ("Νερό, Αντηλιακό, Παπούτσια θαλάσσης") and they must ALL be visible — the tile
          is not clickable, so anything clamped away is simply lost to the reader. */}
      <p className={`${TILE_TEXT} line-clamp-3 text-[10px] min-[380px]:text-[12px] font-black leading-[1.2] ${
        tile.tone === 'warn' ? 'text-amber-800' : tile.tone === 'good' ? 'text-emerald-800' : 'text-slate-900'
      }`}>
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
      {title && <p className="px-1 text-[10px] font-bold tracking-wide text-slate-500">{title}</p>}
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
              /* Ίδια λογική με τα πλακίδια από πάνω: το σήμα το δίνει το εικονίδιο —
                 πράσινο τικ, κεχριμπαρένιο ημερολόγιο, γκρι σταυρός — όχι ένα γεμάτο
                 κουτί γύρω από κάθε λέξη. Padding αμετάβλητο. */
              className="flex min-w-0 items-center gap-2 rounded-control px-2.5 py-2.5"
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
                    yes ? 'text-slate-900' : partial ? 'text-slate-800' : 'text-slate-500 line-through'
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
  explanationIsVerdict = false,
  wind,
  airTempC,
  sea,
  water,
  sunsetTime,
  sunsetOverSea,
  climateNote,
  shoreBreakNote,
  offshoreWindNote,
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
      // «3–4 Μπφ» όταν υπάρχει άνω άκρο, αλλιώς «3 Μπφ» — εν-παύλα όπως κάθε εύρος του προϊόντος.
      value: `${formatBeaufortLabel(wind.beaufort, wind.beaufortHigh)} ${language === 'gr' ? 'Μπφ' : 'Bft'}`,
      // «Β» alone is a compass point; «Β · απάνεμη» is the reason for the colour. The
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
    /**
     * ⚠️ ΤΟ ΔΕΥΤΕΡΟ ΝΟΥΜΕΡΟ ΜΠΑΙΝΕΙ ΜΟΝΟ ΟΤΑΝ ΕΙΝΑΙ ΟΝΤΩΣ ΔΕΥΤΕΡΟ (13/08/2026).
     *
     * Από σήμερα το ύψος στην ακτή υπάρχει για ΚΑΘΕ παραλία, όχι μόνο για τους κλειστούς όρμους
     * (βίβλος §Γ5). Και σε 2.104 από τις 2.854 — κάθε εκτεθειμένη και κάθε μερικώς προστατευμένη —
     * είναι ΑΡΙΘΜΗΤΙΚΑ ΤΟ ΙΔΙΟ με το ανοιχτό νερό, γιατί εκεί ο συντελεστής είναι 1,0. Χωρίς αυτό
     * το `differs`, το πλακίδιο τύπωνε «~0,6 μ.» με υπότιτλο «Λίγος κυματισμός · 0,6 μ. ανοιχτά»:
     * το ίδιο νούμερο δύο φορές, με ένα «~» να υπονοεί ότι είναι εκτίμηση ενώ είναι η μέτρηση, και
     * τρεις λέξεις παραπάνω που κόβονταν στα 390 px (το `validateTileFit` το έπιασε αμέσως).
     *
     * Ο κανόνας της §7δ («τα δύο νούμερα μαζί, το ανοιχτό μένει στην οθόνη με το όνομά του»)
     * τηρείται εκεί που έχει νόημα: όταν τα δύο νούμερα ΔΙΑΦΕΡΟΥΝ. Όταν ταυτίζονται δεν υπάρχει
     * δεύτερη ανάγνωση να κρυφτεί — υπάρχει μία, και τη λέμε μία φορά.
     */
    const shoreM = sea.shoreHeightM;
    const hasShore = typeof shoreM === 'number' && Number.isFinite(sea.shoreHeightM);
    const shoreLeads = typeof sea.shoreHeightM === 'number' && Number.isFinite(sea.shoreHeightM)
      && typeof sea.heightM === 'number' && Math.abs((shoreM as number) - sea.heightM) >= 0.05;
    const shoreCopy = SHORE_LABELS[language] ?? SHORE_LABELS.en;
    readings.push({
      glyph: <SeaGlyph heightM={sea.heightM} tone={glyphTone} className="h-full w-full" />,
      /**
       * ΤΟ ΠΛΑΚΙΔΙΟ ΕΚΟΒΕ ΤΟ ΜΟΝΟ ΠΡΑΓΜΑ ΠΟΥ Η ΒΙΒΛΟΣ ΑΠΑΙΤΕΙ ΝΑ ΜΕΝΕΙ (Μίλτος, 14/08/2026).
       *
       * Στιγμιότυπο Πάρου: τίτλος «Κύμα στην ακτή», νούμερο «~0,1 μ.», και από κάτω
       * «Έντονος κυματισμός…» — με αποσιωπητικά. Ο υπότιτλος ήταν
       * `${sea.label} · ${offshore(...)}` = «Έντονος κυματισμός · 0,7 μ. ανοιχτά», 35 χαρακτήρες
       * σε πλακίδιο ~66 px με γραμματοσειρά 8 px και `line-clamp-2`. Ο χαρακτηρισμός έτρωγε τις
       * δύο γραμμές και **ο αριθμός του ανοιχτού κοβόταν έξω** — ακριβώς ο όρος της §7δ («το
       * νούμερο της ανοιχτής θάλασσας μένει στην οθόνη, με το όνομά του») να παραβιάζεται από
       * πλάτος, όχι από σχεδιασμό. Η πύλη πλάτους δεν το έπιασε γιατί μετράει αν κόβεται ΛΕΞΗ,
       * και εδώ κοβόταν ολόκληρη η δεύτερη ανάγνωση, νόμιμα, με `line-clamp`.
       *
       * Λύση που ζήτησε: κόψε τα περιττά. Τίτλος **«Κύμα»** σκέτο (ο αριθμός από κάτω είναι της
       * ακτής — το «~» και ο υπότιτλος «… ανοιχτά» το λένε), και υπότιτλος **μόνο το δεύτερο
       * νούμερο**. Δύο αναγνώσεις, καμία περιγραφή, τίποτα να κοπεί.
       *
       * Ο χαρακτηρισμός («Έντονος κυματισμός») ΔΕΝ χάνεται από τη σελίδα: ζει στο μπλοκ της
       * ετυμηγορίας (`pages/BeachDetailPage.tsx:503-505`), σε γραμμή που έχει χώρο γι' αυτόν.
       * Όταν τα δύο νούμερα ταυτίζονται (~74% των παραλιών) τίποτα εδώ δεν αλλάζει: δεν υπάρχει
       * δεύτερη ανάγνωση, οπότε ο υπότιτλος μένει ο χαρακτηρισμός όπως πάντα.
       */
      label: shoreLeads ? labels.sea : (sea.isOpenWater ? labels.seaOpen : labels.sea),
      // Το «~» σημαίνει «μοντελοποιημένο». Όταν ο αριθμός της ακτής ΕΙΝΑΙ η μέτρηση του ανοιχτού,
      // ένα «~» θα ήταν ψέμα προς την αντίθετη κατεύθυνση: θα υποβάθμιζε μια μέτρηση σε εκτίμηση.
      value: hasShore
        ? `${shoreLeads ? '~' : ''}${metres(shoreM as number)}`
        : typeof sea.heightM === 'number' ? metres(sea.heightM) : '—',
      hint: shoreLeads && typeof sea.heightM === 'number'
        ? shoreCopy.offshore(metres(sea.heightM))
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

  /**
   * ΤΟ ΕΝΑ ΠΡΑΓΜΑ ΠΟΥ ΤΑ ΠΛΑΚΙΔΙΑ ΔΕΝ ΜΠΟΡΟΥΝ ΝΑ ΠΟΥΝ: ΤΗ ΣΧΕΣΗ ΤΟΥΣ (Μίλτος, 14/08/2026).
   *
   * Η κάρτα της λίστας απέκτησε σήμερα μία γραμμή σε λέξεις πάνω από τα δύο νούμερα· ο
   * επισκέπτης που πατάει «Πληροφορίες» έβρισκε πάλι σκέτα «5 Μπφ» και «~0,1 μ.» σε δύο
   * χωριστά κουτάκια.
   *
   * ⚠️ ΓΙΑΤΙ ΜΠΑΙΝΕΙ ΜΟΝΟ ΣΤΗΝ ΑΝΤΙΘΕΣΗ — και γιατί αυτό ΔΕΝ ξανανοίγει την 11/08.
   *
   * Εκείνη τη μέρα διαγράφηκε από αυτή ακριβώς τη θέση μια ζωντανή πρόταση («Με βόρειο άνεμο
   * 4 Μπφ που φυσάει τώρα, εδώ είναι σχετικά προστατευμένα») επειδή **ξανάλεγε με λέξεις ό,τι
   * τα τέσσερα πλακίδια μόλις είχαν πει με νούμερα**. Ο κανόνας που έμεινε: σε αυτό το σημείο
   * γράφεται μόνο ό,τι ΔΕΝ υπάρχει ήδη από πάνω.
   *
   * «Πολύς αέρας αλλά θάλασσα λάδι» περνάει αυτόν τον κανόνα μόνο στη μισή του μορφή. Όταν τα
   * δύο μισά συμφωνούν («Δυνατός αέρας, μεγάλο κύμα») είναι όντως τα δύο πλακίδια ξαναγραμμένα,
   * και σιωπά. Όταν διαφωνούν, λέει το ένα πράγμα που κανένα πλακίδιο δεν ξέρει: ότι ο αριθμός
   * του ανέμου και ο αριθμός του κύματος δείχνουν σε αντίθετες κατευθύνσεις. Αυτή η αντίθεση
   * είναι ο λόγος που η Βραυρώνα στα 2,0 μ. είναι πορτοκαλί και η Ραφήνα στα 1,3 μ. κόκκινη —
   * το παράπονο της 01/08 («δεν καταλαβαίνει κάποιος γιατί η μία παραλία είναι καλύτερη»).
   *
   * Διαβάζει ΤΑ ΙΔΙΑ δύο νούμερα που ζωγραφίζουν τα πλακίδια, όχι κάποιο τρίτο: το ύψος της
   * ακτής όταν αυτό ηγείται, αλλιώς τη μέτρηση του ανοιχτού.
   */
  const feelWaveM = sea
    ? (typeof sea.shoreHeightM === 'number' && Number.isFinite(sea.shoreHeightM)
        ? sea.shoreHeightM
        : (typeof sea.heightM === 'number' && Number.isFinite(sea.heightM) ? sea.heightM : undefined))
    : undefined;
  const conditionsFeel = wind
    // Το beaufortHigh μπαίνει για το ταβάνι του «αλλά» και μόνο: το πλακίδιο από πάνω
    // τυπώνει «5–6 Μπφ», και ανακούφιση δίπλα σε τυπωμένο 6 είναι η Φυριπλάκα ξανά.
    ? buildConditionsFeel({ beaufort: wind.beaufort, beaufortHigh: wind.beaufortHigh, waveM: feelWaveM, seaArrivalExposureLevel: sea?.arrivalExposureLevel, language })
    : null;
  // `divergent`, ΟΧΙ `contrast`: το δεύτερο πέφτει στα 6+ Μποφόρ για να μη μπει «αλλά» δίπλα σε
  // κόκκινη πινέζα — αν το διάβαζε αυτή η γραμμή, ο Φάραγγας (6 Μπφ πάνω από 0,1 μ.) θα ήταν ο
  // πρώτος που θα έχανε την εξήγηση που δικαιολογεί το χρώμα του.
  const contrastLine = conditionsFeel?.divergent ? conditionsFeel.phrase : null;

  return (
    <section
      className={`relative overflow-hidden rounded-surface border ${skin.shell} p-4 shadow-surface sm:p-5`}
    >

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
              className="inline-flex items-center gap-1.5 rounded-control bg-surface px-3 py-2 text-sm font-bold text-slate-800 shadow-surface ring-1 ring-line"
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
            className={`grid grid-rows-[auto_auto_auto_auto] gap-2 ${readings.length === 4 ? 'grid-cols-4' : readings.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
            data-nosnippet="true"
          >
            {readings.map((r) => (
              <Reading key={r.label} {...r} />
            ))}
          </div>
        )}

        {/* Η ΓΡΑΜΜΗ ΤΗΣ ΑΝΤΙΘΕΣΗΣ — βλ. το σκεπτικό στο `contrastLine` παραπάνω. Ίδιο λεξιλόγιο
            με τις κάρτες της λίστας (utils/conditionsFeelPhrase), ώστε ο επισκέπτης που πάτησε
            μια κάρτα να ξαναβρεί εδώ τις ΙΔΙΕΣ λέξεις που τον έφεραν. Δεν είναι ετυμηγορία και
            δεν φέρνει δικό της χρώμα: το κέλυφος της κάρτας χρωματίζει ήδη. */}
        {contrastLine && (
          <p
            className="px-1 text-center text-sm font-extrabold leading-snug text-slate-800"
            data-tilefit="hero-contrast"
            data-testid="conditions-feel"
            data-nosnippet="true"
          >
            {contrastLine}
          </p>
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
        {/* 11/08/2026 — THE LIVE SENTENCE IS NO LONGER PRINTED HERE. «Με βόρειο άνεμο 4 Μπφ
            που φυσάει τώρα, εδώ είναι σχετικά προστατευμένα» re-said in words exactly what the
            four tiles above it had just said in figures (4 Μπφ, Β, «σχετικά προστατευμένα» is
            already the wind tile's own hint), so it read as filler under the numbers rather
            than as an explanation of them. Only the calm-day verdict — the short answer that
            is NOT anywhere else on the card — keeps the slot. */}
        {explanation && explanationIsVerdict && (
          <p className="px-1 text-center text-base font-bold leading-snug text-slate-800" data-nosnippet="true">
            {explanation}
          </p>
        )}

        {practical.length > 0 && (
          <div
            className={`grid grid-rows-[auto_auto_auto_auto] gap-2 ${practical.length >= 4 ? 'grid-cols-4' : practical.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
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
            className={`flex items-start gap-2 rounded-control px-3 py-2.5 text-sm font-semibold leading-snug ${
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

        {offshoreWindNote && (
          // Ουδέτερο μπλε, ΟΧΙ πορτοκαλί σαν το `shoreBreakNote`: εκείνο λέει «θα νιώσεις κάτι»,
          // αυτό λέει «είναι πιο ήρεμα απ’ ό,τι διαβάζεις». Ίδιο χρώμα θα έκανε τα δύο να
          // ακούγονται σαν την ίδια προειδοποίηση δύο φορές. Το γλυφικό είναι ο άνεμος, γιατί για
          // τον άνεμο μιλάει η πρόταση — ο αναγνώστης πρέπει να δει σε ποιο πλακίδιο ανήκει.
          <p className="flex items-start gap-2 rounded-control bg-sky-500/10 px-3 py-2.5 text-sm font-semibold leading-snug text-sky-900">
            <span className="mt-px shrink-0" aria-hidden="true">↝</span>
            <span>{offshoreWindNote}</span>
          </p>
        )}

        {shoreBreakNote && (
          // Amber, like `climateNote`'s 'worse' tone: it is not a warning, but it is the one line
          // on a calm-looking page saying "you will feel something", and a neutral grey would read
          // as trivia. The wave glyph is the same character the sea tile uses, so the reader can
          // see at a glance which figure this sentence belongs to.
          <p className="flex items-start gap-2 rounded-control bg-amber-500/10 px-3 py-2.5 text-sm font-semibold leading-snug text-amber-900">
            <span className="mt-px shrink-0" aria-hidden="true">〜</span>
            <span>{shoreBreakNote}</span>
          </p>
        )}
      </div>
    </section>
  );
};
