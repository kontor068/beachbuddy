import type { Beach } from '../types';
import { SEA_ARRIVAL_ENCLOSED, SEA_ARRIVAL_GRAZING, SEA_STATE_AMBER_M, seaStateSeverityM } from './waveCharacter';

/**
 * ΤΟ ΙΔΙΟ ΚΥΜΑ ΔΕΝ ΣΠΑΕΙ ΤΟ ΙΔΙΟ ΣΕ ΚΑΘΕ ΠΑΡΑΛΙΑ (13/08/2026).
 *
 * Καβαλικευτά, Λευκάδα, 13/08/2026, 11:30 — a user standing on the beach reported wave while the
 * app read ΙΔΑΝΙΚΗ for that hour. The forecast was not wrong: two independent marine models
 * (`ewam` and `meteofrance_wave`) both put the sea at 0,24–0,38 m. Every wave number the app owns
 * was right, and the reader was still surprised.
 *
 * The missing term is the beach itself. A 0,3 m swell running onto a flat sandy shore spills
 * across tens of metres of shallow water and arrives as nothing. The same 0,3 m onto a steep
 * pebble bank with deep water a few strides out has nowhere to dissipate: it plunges directly on
 * the shore. That is the difference between a spilling and a plunging break (the Iribarren number
 * — beach slope over the square root of wave steepness), and Καβαλικευτά is the textbook second
 * case: our own record says `waterDepth: deep` and `terrain: pebbles, large_stones, rocks`.
 *
 * SO THIS IS A NOTE, NOT A SEVERITY. It changes no colour, no score, no ranking and no swim
 * verdict — deliberately. The sea really is 0,3 m; calling the beach less than ΙΔΑΝΙΚΗ over it
 * would be the app disagreeing with its own measurement, and it would fire on 662 beaches
 * (23,2% of the country) every time a swell turned onshore. What the reader was missing was not a
 * worse verdict, it was the sentence "here, that wave breaks on the shore". So we say that.
 *
 * It stays silent unless all three hold, which is what keeps it from becoming wallpaper:
 *   1. the water is deep right off the beach (our own `waterDepth`) — until 02/09/2026 this also
 *      required a coarse shore (pebbles, stones, rock); see hasSteepCoarseShore for why the
 *      terrain gate was dropped,
 *   2. the sea is genuinely arriving through a sector we have NOT judged protected
 *      (utils/seaArrival.resolveSeaArrivalExposureLevel — the same test the shore-damping uses),
 *   3. there is a wave at all.
 *
 * Gate 2 is what stops it appearing on a flat-calm morning with the swell running the other way,
 * and gate 3 stops it on the days there is simply nothing to break.
 */

/**
 * Below this the sea has nothing to break with — a note about how a wave lands is noise when there
 * is no wave. Deliberately low: the whole point of this rule is the case the app currently calls
 * flat, so a threshold up at the amber line would silence it exactly where it is needed.
 *
 * 0,2 AND NOT 0,25, AND THAT IS NOT A ROUNDING PREFERENCE (13/08/2026). The page prints one
 * decimal. A 0,25 floor sits exactly on the boundary between «0,2 μ.» and «0,3 μ.», so an hourly
 * series that wobbles by a single centimetre crosses it repeatedly: measured on Καβαλικευτά the
 * same afternoon, the note appeared at 07:00, vanished at 08:00 (0,24 m), came back at 09:00, and
 * did the same again at 14:00–15:00 — a sentence blinking on and off as the reader drags the hour
 * slider, over a difference nobody can see and the page does not even display. A threshold has to
 * sit where the printed number is not changing, not in the middle of its rounding step.
 */
export const SHORE_BREAK_MIN_WAVE_M = 0.2;

export interface ShoreBreakInput {
  /** `beach.metadata.waterDepth.type` — our own record of how fast it gets deep. */
  waterDepthType?: string;
  /** `beach.metadata.terrain.types`. */
  terrainTypes?: readonly string[];
  /**
   * utils/seaArrival.resolveSeaArrivalExposureLevel. `undefined` means the sea is not running onto
   * this shore (or we have no geometry to say), and the note stays silent — never "assume it is".
   */
  seaArrivalExposureLevel?: string;
  /** Decision-grade sea state (m) — `BeachScore.seaStateWaveM`, not the display height. */
  seaStateWaveM?: number;
  /** Its period — needed for the severity test below, which is what the colour ladder reads. */
  seaStatePeriodS?: number;
}

/**
 * ΤΟ ΒΑΘΟΣ ΑΡΚΕΙ — ΤΟ ΕΔΑΦΟΣ ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΠΥΛΗ (02/09/2026, Καραβοστάσι Θεσπρωτίας #899).
 *
 * Μέχρι σήμερα η πύλη ζητούσε βαθιά νερά ΚΑΙ χοντρό έδαφος (βότσαλο, πέτρα, βράχο): η άμμος
 * θεωρήθηκε ότι πάντα φτιάχνει την ήπια κλίση που απλώνει το κύμα. Το Καραβοστάσι το διέψευσε
 * με φωτογραφία: μεγάλη αμμουδιά (λεπτή + χοντρή άμμος) που βαθαίνει απότομα, μοντέλο στο 0,3 μ.,
 * σελίδα «λίγο κύμα», και το κύμα να γυρίζει ολόκληρο πάνω στην άμμο — ακριβώς η εικόνα των
 * Καβαλικευτών, σε άμμο. Αυτό που κρατάει το κύμα ολόκληρο μέχρι την ακτή είναι η ΚΛΙΣΗ, όχι το
 * υλικό· το υλικό ήταν απλώς ο μάρτυρας που είχαμε τότε για την κλίση. Το `waterDepth: deep`
 * είναι ο ίδιος μάρτυρας, ειπωμένος πιο άμεσα.
 *
 * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΑΛΛΑΞΕΙ: από τις 741 «βαθιές» παραλίες, 693 περνούσαν ήδη (έχουν και βότσαλο).
 * Οι υπόλοιπες **48** είναι όλες όσες κερδίζουν τη φράση — όχι οι 1.162 με χοντρή άμμο που φόβιζαν
 * την πρώτη έκδοση, γιατί εκείνες στη συντριπτική τους πλειονότητα ΔΕΝ είναι καταγεγραμμένες
 * βαθιές. Οι άλλες τρεις πύλες (άφιξη, ύψος, ταβάνι) μένουν ακριβώς όπως ήταν.
 *
 * Η παράμετρος `terrainTypes` μένει στην υπογραφή ώστε να μη χρειάζεται να αλλάξει κανένας από
 * τους καλούντες (σελίδα, γραφικό, βαθμολογία)· δεν διαβάζεται πια.
 */
export const hasSteepCoarseShore = (
  waterDepthType?: string,
  _terrainTypes?: readonly string[]
): boolean => waterDepthType === 'deep';

export const shoreBreaksOnTheBeach = ({
  waterDepthType,
  terrainTypes,
  seaArrivalExposureLevel,
  seaStateWaveM,
  seaStatePeriodS,
}: ShoreBreakInput): boolean => {
  if (!hasSteepCoarseShore(waterDepthType, terrainTypes)) return false;
  // Same contract as the shore-damping: `undefined` means «the sea is not running onto this
  // shore», and a sector we HAVE judged protected is one the sea does not roll into. Blindness is
  // NOT silence — utils/seaArrival.SEA_ARRIVAL_UNKNOWN matches neither, so a beach whose wave
  // direction we never got is judged on its own steep coarse shore instead of being waved through.
  // `SEA_ARRIVAL_GRAZING` προστέθηκε 22/08/2026 και ΠΡΙΝ από αυτό ερχόταν εδώ σαν `undefined`.
  // Μπαίνει ρητά ώστε η συμπεριφορά αυτής της πύλης να μείνει ΑΚΡΙΒΩΣ όπως ήταν: θάλασσα που
  // περνάει ξυστά δεν σκάει στην ακτή, όπως δεν έσκαγε και χθες.
  // `SEA_ARRIVAL_ENCLOSED` προστέθηκε 29/08/2026 (Λίνδος #2443): θάλασσα που δεν έχει από πού
  // να μπει στον όρμο δεν μπορεί ούτε να σκάσει στην άμμο του. Πριν, η ίδια περίπτωση έφτανε
  // εδώ με το επίπεδο του τομέα της ('partial' στη Λίνδο), δηλαδή περνούσε — η γραμμή μόνο
  // ΑΦΑΙΡΕΙ μια προειδοποίηση που η γεωμετρία διαψεύδει, ποτέ δεν προσθέτει.
  if (seaArrivalExposureLevel === undefined
    || seaArrivalExposureLevel === 'protected'
    || seaArrivalExposureLevel === SEA_ARRIVAL_GRAZING
    || seaArrivalExposureLevel === SEA_ARRIVAL_ENCLOSED) return false;
  if (typeof seaStateWaveM !== 'number' || !Number.isFinite(seaStateWaveM)) return false;
  if (seaStateWaveM < SHORE_BREAK_MIN_WAVE_M) return false;
  /**
   * AND ONLY WHILE THE APP IS OTHERWISE CALLING THIS WATER CALM.
   *
   * Above `SEA_STATE_AMBER_M` the page already says «Λίγο κύμα» / «Υψηλό κύμα», the pin is
   * already yellow or worse, and the reader has been told. Adding "the wave breaks at the shore"
   * on top is a second sentence saying the same thing — the exact duplicate-copy failure this
   * project has already paid for once. The note exists for the case the app calls flat: measured
   * live on 13/08/2026 the unbounded version fired on 222 beaches, many of them sitting under a
   * 1,9 m sea that needed no help being described.
   */
  const severityM = seaStateSeverityM(seaStateWaveM, seaStatePeriodS);
  return typeof severityM !== 'number' || severityM < SEA_STATE_AMBER_M;
};

/** Convenience for callers holding a whole beach record. */
export const beachShoreBreaks = (
  beach: Pick<Beach, 'metadata'> | undefined,
  seaArrivalExposureLevel: string | undefined,
  seaStateWaveM: number | undefined,
  seaStatePeriodS?: number
): boolean => shoreBreaksOnTheBeach({
  waterDepthType: beach?.metadata?.waterDepth?.type,
  terrainTypes: beach?.metadata?.terrain?.types,
  seaArrivalExposureLevel,
  seaStateWaveM,
  seaStatePeriodS,
});
