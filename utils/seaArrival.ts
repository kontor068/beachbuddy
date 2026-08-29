import type { GeospatialExposureProfile, WindSector } from '../types';
import { interpolateSectorGeometry } from './windExposureModel';
import { ARRIVAL_MIN_FETCH_KM, type SeaArrivalGeometry } from './waveModel';
import { SEA_ARRIVAL_ENCLOSED, SEA_ARRIVAL_GRAZING } from './waveCharacter';

export { SEA_ARRIVAL_ENCLOSED, SEA_ARRIVAL_GRAZING };

/**
 * Where a measured sea is arriving from, in this beach's own frame — the input that lets the
 * light-wind cap tell "a real sea running onto this shore" from "a grid cell describing water
 * behind it". Returns undefined when we lack the geometry to judge, in which case the cap falls
 * back to its original direction-blind behaviour.
 *
 * It lives in its own file rather than inside recommendationService for the same reason
 * utils/marineForecastParsing.ts does: a gate could not load it there without dragging in the
 * whole network and analytics graph, and analyticsService uses `import.meta`, which does not
 * compile under the CommonJS build the offline validators run. Decision-grade logic has to be
 * runnable by the thing that checks it. This was found the hard way — scripts/validateEffectiveRanking.ts
 * spent its first run passing `undefined` here, which made its light-wind cap harsher than
 * production's and charged the geometry with harm it does not do.
 */
export const resolveSeaArrival = (
  geospatialProfile: GeospatialExposureProfile | undefined,
  facingDeg: number | null | undefined,
  waveDirectionDeg: number | undefined
): SeaArrivalGeometry | undefined => {
  if (!geospatialProfile) return undefined;
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return undefined;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return undefined;
  return {
    onshore: Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180),
    fetchKm: interpolateSectorGeometry(geospatialProfile, waveDirectionDeg).fetchKm,
  };
};

const SECTOR_ORDER: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Onshore component above which an arriving sea is treated as reaching this shore. The same 0,3
 * utils/swellExposure uses for direct swell — one number for "does the water get in", so the
 * damping and the swell charge cannot disagree about the same wave.
 */
export const SEA_ARRIVAL_ONSHORE_MIN = 0.3;

/**
 * «Δεν ξέρω» — ρητά, και ξεχωριστά από το «ξέρω και η θάλασσα δεν έρχεται εδώ» (που μένει
 * `undefined`). Δεν είναι επίπεδο έκθεσης και δεν πρέπει ποτέ να συγκριθεί με ένα: υπάρχει για
 * να ΜΗΝ ταιριάζει στους ελέγχους `=== undefined || === 'protected'` που δίνουν την έκπτωση
 * καταφυγίου (utils/waveCharacter.shoreSeaStateM, utils/shoreBreak.shoreBreaksOnTheBeach).
 * Ταξιδεύει πάνω στο ίδιο πεδίο ώστε η πινέζα και η κάρτα να μη μπορούν να απαντήσουν
 * διαφορετικά — το μάθημα της πύλης κάρτα-vs-πινέζα.
 */
export const SEA_ARRIVAL_UNKNOWN = 'unknown';

/**
 * Πάνω από αυτό το συνιστάμενο η θάλασσα «μπαίνει» έστω και λοξά· στο 0 ή κάτω περνάει
 * παράλληλα στην ακτή ή φεύγει από αυτήν. Είναι ΑΥΣΤΗΡΟΤΕΡΟ από το `SEA_ARRIVAL_ONSHORE_MIN`
 * (0,3 ≈ 72,5° λοξά) επίτηδες: εκεί το ερώτημα είναι «να αρνηθώ την έκπτωση;», εδώ «να τη
 * ΔΩΣΩ;», και το δεύτερο πρέπει να ζητάει περισσότερα από το πρώτο.
 */
export const SEA_GRAZING_ONSHORE_MAX = 0;

/**
 * Ακριβώς στις 90° το `Math.cos` δεν επιστρέφει 0 αλλά ~6·10⁻¹⁷ — θετικό. Χωρίς αυτή την
 * ανοχή η πιο καθαρή περίπτωση «περνάει ξυστά» που υπάρχει θα έπεφτε έξω από τον κανόνα, και
 * μάλιστα σιωπηλά. 10⁻⁶ αντιστοιχεί σε λιγότερο από ένα δεκάκις χιλιοστό της μοίρας.
 */
const GRAZING_COSINE_EPSILON = 1e-6;


/**
 * ΤΟ ΚΥΜΑ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΕΚΕΙ ΠΟΥ ΦΥΣΑΕΙ (13/08/2026).
 *
 * The exposure level for the direction the SEA is arriving from — not the one today's WIND earned.
 *
 * Why this exists. `shoreSeaStateM` (utils/waveCharacter) discounts an open-water reading by ×0,5
 * when a shore is 'protected', and until today 'protected' meant "sheltered from the wind blowing
 * right now". Those are different questions and they come apart on the most ordinary summer day
 * there is: an offshore breeze. Καβαλικευτά, Λευκάδα, 13/08/2026 — reported by a user standing on
 * the beach. The wind was NE, straight off the land, so every wind test in the app called the
 * beach protected; the sea was arriving from 306–320° into a shore facing 284,8°, through W/NW
 * sectors with 25 km of fetch and `blockedRayRatio` 0. We halved a wave that had a completely open
 * road in.
 *
 * ONE DIRECTION ONLY. This can never grant a discount — it can only refuse one. A 'protected'
 * arrival sector keeps the discount it already had, so the change cannot make any beach in Greece
 * look calmer than it looked yesterday.
 *
 * TWO KINDS OF SILENCE, AND THEY ARE NOT THE SAME (μετρήθηκε 20/08/2026).
 * The first version answered `undefined` to four different situations, and the national
 * measurement (`scripts/measureUnknownSeaArrivalDiscount.mjs`, 8.616 beach-days) showed they are
 * wildly unequal: 3.372 of 3.396 silences were «the sea is not running onto this shore» — an
 * OPINION, and the discount it grants is earned. The remaining 24 were «no wave direction» or
 * «no shore facing» — pure blindness, and there the ×0,5 was being handed out for nothing.
 *
 * So blindness now says so out loud with `SEA_ARRIVAL_UNKNOWN`, and every consumer that treats
 * `undefined`/'protected' as shelter refuses it. Direction: stricter only, on 24 beach-days.
 * The measured alternative — refusing the discount on ALL silence — was rejected: it repaints
 * 240 pins blue→yellow on 180 beaches and cancels 2/3 of the glass-at-four gate, which is a
 * feature recall, not a bug fix. See docs/team/PORISMA-KAIROS-2026-08.md §20/08 (αργά).
 *
 * It reads `sectors[…].level` — the engine's own verdict, saturation ramp and all — rather than a
 * raw `blockedRayRatio` threshold, for the reason utils/swellExposure documents at length: a bare
 * ratio reads a wide-open sector as closed whenever the far shore happens to sit inside the 25 km
 * cap, which is most of the Aegean.
 */
export const resolveSeaArrivalExposureLevel = (
  geospatialProfile: GeospatialExposureProfile | undefined,
  waveDirectionDeg: number | undefined
): string | undefined => {
  if (!geospatialProfile) return SEA_ARRIVAL_UNKNOWN;
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return SEA_ARRIVAL_UNKNOWN;
  const facingDeg = geospatialProfile.facingDeg;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return SEA_ARRIVAL_UNKNOWN;

  const onshore = Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180);
  // A sea running along or away from this shore is not the sea that lands on it. Staying silent
  // here (rather than answering 'protected') is deliberate: silence means "no opinion, keep the
  // old behaviour", while an opinion of 'protected' would be this function actively granting a
  // discount — which is the one thing it must never do.
  // Ξυστά ή φεύγοντας: η θάλασσα δεν πέφτει πάνω σε αυτή την ακτή — και αυτό είναι ΓΝΩΜΗ,
  // βγαλμένη από πλήρη γεωμετρία, όχι σιωπή. Λέγεται με το όνομά της ώστε η ακτή να μπορεί να
  // κερδίσει την έκπτωση, αντί να την παίρνει κρυφά μέσα από ένα `undefined`.
  if (onshore <= SEA_GRAZING_ONSHORE_MAX + GRAZING_COSINE_EPSILON) return SEA_ARRIVAL_GRAZING;
  // Ανάμεσα στο 0 και στο 0,3: μπαίνει πολύ λοξά. Δεν αρνούμαστε ό,τι έδινε το προηγούμενο
  // καθεστώς, αλλά ούτε δίνουμε καινούργιο — σιωπή, όπως πριν.
  if (onshore <= SEA_ARRIVAL_ONSHORE_MIN) return undefined;

  const sector = SECTOR_ORDER[((Math.round(waveDirectionDeg / 45) % 8) + 8) % 8];
  /**
   * Η ΤΣΕΠΗ, ΠΡΙΝ ΑΠΟ ΤΟ ΕΠΙΠΕΔΟ ΤΟΥ ΤΟΜΕΑ (29/08/2026 — Λίνδος #2443, κάμερα: λάδι με
   * λουόμενους κάτω από «1,1 μ. · μην κολυμπήσεις»).
   *
   * Ως εδώ η θάλασσα «έρχεται πάνω» στην ακτή — αλλά αυτό κρίθηκε ΜΟΝΟ από τη γωνία. Το
   * ερώτημα που δεν ρωτήθηκε ποτέ: υπάρχει ΝΕΡΟ σε εκείνη τη γωνία για να τη φέρει; Στη Λίνδο
   * το κελί μετράει 1,1 μ. σε νερό 2,6 χλμ ανοιχτά, ενώ στη γωνία του κύματος ο όρμος ανοίγει
   * 0,2 χλμ και ΠΟΥΘΕΝΑ γύρω του δεν ανοίγει πάνω από 5,3 — εκείνη η θάλασσα δεν χωράει να
   * μπει. Η απάντηση λέγεται με το όνομά της ('enclosed', ορισμός στη σταθερά στο
   * utils/waveCharacter) ώστε η shoreSeaStateM να δώσει την έκπτωση K_d που η ίδια η μηχανή
   * είχε ήδη υπολογίσει (για τσέπη: το δάπεδο 0,1) και μέχρι σήμερα πετούσε όταν ο τομέας του
   * ΑΝΕΜΟΥ δεν έβγαινε 'protected'.
   *
   * ΟΙ ΤΡΕΙΣ ΣΥΝΘΗΚΕΣ, ΟΛΕΣ ΑΠΑΡΑΙΤΗΤΕΣ:
   *   • εμπιστοσύνη 'high' — καμία δήλωση ηρεμίας από μισοδιαβασμένη ακτογραμμή (ίδιος κανόνας
   *     με την εκτίμηση ακτής στο utils/shoreWave)·
   *   • ΤΣΕΠΗ: κανένας τομέας ≥ SHADOW_OPEN_FETCH_KM (10 χλμ) — παραλία με έστω έναν ανοιχτό
   *     διάδρομο ΔΕΝ περνάει ποτέ από εδώ, όσο κλειστή κι αν είναι η γωνία της άφιξης·
   *   • στη γωνία της άφιξης λιγότερο από ARRIVAL_MIN_FETCH_KM (2 χλμ) νερό — το ΙΔΙΟ κατώφλι
   *     με το οποίο η capLightWindMeasuredWaveM αποφασίζει «αυτή η θάλασσα είναι αληθινή»:
   *     τα δύο ερωτήματα είναι καθρέφτες και δεν επιτρέπεται να έχουν διαφορετικό νούμερο.
   *     Ζητιέται με παρεμβολή (interpolateSectorGeometry), όχι με τον στρογγυλεμένο τομέα,
   *     ώστε κύμα στα 22° να διαβάζει και τους δύο γείτονές του.
   *
   * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΜΠΕΙ (scripts/measureShoreShadowGate.mjs, 2.873 προφίλ × 12 διευθύνσεις ×
   * 4 ύψη): αγγίζει 339 παραλίες / 2,8% των συνδυασμών, όλες προς το ηρεμότερο — γι' αυτό οι
   * τρεις συνθήκες, και γι' αυτό η μονόδρομη σκάλα της ετυμηγορίας (swimmingComfortFromScore:
   * η ακτή ανεβάζει το πολύ ΕΝΑ σκαλί) παραμένει το φρένο από πάνω της.
   */
  if (
    geospatialProfile.confidence === 'high'
    && geospatialProfile.sectors
    && !SECTOR_ORDER.some(name => (geospatialProfile.sectors?.[name]?.fetchKm ?? 0) >= SHADOW_OPEN_FETCH_KM)
    && interpolateSectorGeometry(geospatialProfile, waveDirectionDeg).fetchKm < ARRIVAL_MIN_FETCH_KM
  ) {
    return SEA_ARRIVAL_ENCLOSED;
  }
  return geospatialProfile.sectors?.[sector]?.level;
};

/**
 * ─── Η ΕΚΠΤΩΣΗ ΤΗΣ ΠΡΟΣΤΑΤΕΥΜΕΝΗΣ ΑΚΤΗΣ ΕΙΝΑΙ ΓΩΝΙΑ, ΟΧΙ ΣΤΑΘΕΡΑ (24/08/2026) ───
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ. Το ×0,5 του shoreSeaStateM ήταν επίπεδο: ίδια έκπτωση για παραλία
 * λίγο πίσω από τον κάβο της και για παραλία στον πάτο κλειστού κόλπου — και ίδια για παραλία
 * που το κύμα της μπαίνει από ΑΝΟΙΧΤΟ διάδρομο. Η ακτομηχανική (διαγράμματα περίθλασης
 * SPM/Wiegel, ημιάπειρο εμπόδιο) το λέει αλλιώς: στο ΟΡΙΟ της σκιάς φτάνει ~το μισό ύψος
 * (K_d ≈ 0,5 — το παλιό μας νούμερο είναι η τιμή της άκρης), 30° μέσα ≈ 0,25, 60°+ ≈ 0,1,
 * και μέσα στον διάδρομο 1,0 — καμία έκπτωση.
 *
 * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΜΠΕΙ (§Γ35/§7δ): scripts/measureShoreShadowPhysics.mjs (εθνικό replay
 * μελτεμιού, 110/110) + scripts/measureShadowDirectionSweep.mjs (κάθε παραλία × 8 διευθύνσεις):
 * στο 73,6% των συνδυασμών που παίρνουν έκπτωση η φυσική λέει ΚΑΤΩ από το μισό του παλιού
 * νούμερου, στο 2,9% (394 παραλίες σε κάποιον καιρό) λέει ΔΙΠΛΑΣΙΟ — έκπτωση πάνω σε κύμα
 * που μπαίνει από ανοιχτά (π.χ. #3114 Αμυγδαλιά: τύπωνε 1,7 μ. σε θάλασσα 3,4 μ.).
 * Αναφορές: reports/quality/shore-shadow-physics.json / shadow-direction-sweep.json.
 * ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ 24/08/2026, με τα εθνικά νούμερα μπροστά του: «και τα δύο μαζί» — και η
 * άρνηση της έκπτωσης στον διάδρομο (προς την προσοχή) και η βαθύτερη σκιά (προς το ήρεμο).
 *
 * ΤΙ ΔΕΝ ΑΓΓΙΖΕΙ, ΕΠΙΤΗΔΕΣ:
 *  - Το grazing σκέλος του §Γ59 (λοξή θάλασσα ≥90° σε partial ακτή) κρατά το 0,5 του — εκεί
 *    υπάρχει ΜΕΤΡΗΜΕΝΗ μαρτυρία καμερών (Καραβοστάσι/Λυγαριά) και η μαρτυρία κερδίζει το
 *    μοντέλο. Η εξαίρεση ζει στη shoreSeaStateM, όχι εδώ.
 *  - Την ΠΥΛΗ του ποιος δικαιούται έκπτωση (resolveSeaArrivalExposureLevel πιο πάνω) — αυτή
 *    η συνάρτηση αλλάζει μόνο ΤΟ ΠΟΣΟ, ποτέ το ΑΝ.
 *
 * ΟΡΙΑ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΜΠΕΙ: σχήμα πρώτης τάξης (όχι πλήρης λύση περίθλασης)· ανάλυση 45°
 * (8 τομείς) — η γωνία είναι σκαλωτή· η ΠΕΡΙΟΔΟΣ δεν μπαίνει ακόμα (η ρεστία στρίβει
 * περισσότερο — μελλοντική αυστηροποίηση, όχι χαλάρωση)· ο βυθός (θραύση στα ρηχά) είναι
 * επόμενο βήμα. Επαλήθευση στην άμμο: μόνο μάτια/κάμερες — οι λίστες υπόπτων στα reports.
 *
 * `undefined` = δεν ξέρω (χωρίς γεωμετρία ή χωρίς κατεύθυνση κύματος) → ο καλών κρατά το
 * ιστορικό 0,5. Η άγνοια δεν επιτρέπεται ούτε να ηρεμήσει ούτε να αγριέψει μια παραλία.
 */
export const SHADOW_OPEN_FETCH_KM = 10;
export const SHADOW_CORRIDOR_HALF_DEG = 22.5;
export const SHADOW_DECAY_DEG = 45;
export const SHADOW_KD_AT_EDGE = 0.5;
export const SHADOW_KD_FLOOR = 0.1;

/**
 * ─── Η ΠΛΑΓΙΑ ΘΑΛΑΣΣΑ ΣΕ ΑΝΟΙΧΤΗ ΑΚΤΗ ΔΕΝ ΠΑΙΡΝΕΙ ΒΑΘΙΑ ΣΚΙΑ (29/08/2026) ───
 *
 * Η ΑΦΟΡΜΗ: τρεις κάμερες μέσα σε μία ώρα, όλες με κύμα να σκάει κάτω από «θάλασσα λάδι» /
 * «σχεδόν χωρίς κύμα» — Βάι #730 (πόρτα 16,3 χλμ, K_d 0,11), Κιτροπλατεία #746 (12,5 χλμ,
 * K_d 0,11), Αλμυρός #720 (18,3 χλμ, K_d 0,30). Και στις τρεις το μελτέμι περνούσε ΠΛΑΓΙΑ
 * μπροστά από ακτή που έχει κανονική πόρτα στο πέλαγος, και το σχήμα από κάτω τις χρεώνε
 * 60-90° «περίθλασης» σαν να κάθονταν πίσω από μόλο.
 *
 * ΤΟ ΦΥΣΙΚΟ ΛΑΘΟΣ. Το K_d είναι μοντέλο περίθλασης — «πόσο ύψος μένει όταν το κύμα πρέπει να
 * ΣΤΡΙΨΕΙ γύρω από εμπόδιο για να φτάσει εδώ». Σε ακτή με ανοιχτό διάδρομο, θάλασσα που
 * περνάει πλάγια δεν στρίβει γύρω από τίποτα: μπαίνει από την πόρτα και διαθλάται στα ρηχά
 * ΠΑΝΩ στην ακτή — αυτό ακριβώς έδειχναν οι κάμερες. Η βαθιά σκιά (0,1-0,3) έχει νόημα μόνο
 * όταν η θάλασσα ΦΕΥΓΕΙ από την ακτή ή όταν δεν υπάρχει πόρτα καθόλου.
 *
 * Ο ΔΙΑΧΩΡΙΣΤΗΣ, ΜΕΤΡΗΜΕΝΟΣ ΣΤΟΥΣ ΜΑΡΤΥΡΕΣ (θάλασσα από Β, onshore = cos(γωνία−facing)):
 *   κύμα υπάρχει   → Κιτροπλατεία −0,500 · Αλμυρός −0,321 · Βάι +0,082   (πλάγια/πάνω)
 *   γνήσια απάνεμη → Γέρακας −0,768 · Πρέβελη −0,916 · Κουκουναριές −0,997 (φεύγει)
 * Το −0,65 κάθεται ανάμεσα στους δύο πληθυσμούς με περιθώριο και προς τις δύο μεριές
 * (πλησιέστεροι: −0,500 και −0,768) — δεν είναι βαθμονομημένο πάνω σε κανέναν μάρτυρα.
 *
 * ΤΟ ΠΑΤΩΜΑ ΕΙΝΑΙ Η ΑΚΡΗ ΤΗΣ ΣΚΙΑΣ (SHADOW_KD_AT_EDGE = 0,5), ΕΠΙΤΗΔΕΣ ΟΧΙ ΕΚΤΟ ΝΟΥΜΕΡΟ:
 * πλάγια θάλασσα σε ανοιχτή ακτή δεν επιτρέπεται να εκπέσει βαθύτερα απ' όσο η ίδια η άκρη
 * του διαγράμματος περίθλασης — και είναι το ΙΔΙΟ 0,5 που το grazing σκέλος του §Γ59 κρατά
 * με μαρτυρία καμερών, οπότε οι δύο δρόμοι της «λοξής θάλασσας» δίνουν την ίδια έκπτωση.
 *
 * ΜΟΝΟΔΡΟΜΟ ΠΡΟΣ ΤΗΝ ΠΡΟΣΟΧΗ: το πάτωμα μόνο ΑΝΕΒΑΖΕΙ το K_d, δηλαδή μόνο ανεβάζει το
 * τυπωμένο νούμερο. Μετρημένο εθνικά πριν μπει (scripts/measureShoreShadowGate.mjs): 17,1%
 * των συνδυασμών, 2.463 παραλίες, ΟΛΕΣ προς τα πάνω, καμία προς την ηρεμία. Η τσέπη (καμία
 * πόρτα ≥10 χλμ πουθενά) ΔΕΝ πατώνεται — η δική της βαθιά σκιά είναι το σωστό νούμερο, και
 * χωρίς facingDeg δεν κρίνεται τίποτα (το K_d μένει ως έχει).
 */
export const SHADOW_CROSS_SEA_ONSHORE_MIN = -0.65;

const angularDistanceDeg = (a: number, b: number): number =>
  Math.abs((((a - b) % 360) + 540) % 360 - 180);

export const resolveShoreShadowDamping = (
  geospatialProfile: GeospatialExposureProfile | undefined,
  waveDirectionDeg: number | undefined
): number | undefined => {
  if (!geospatialProfile?.sectors) return undefined;
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return undefined;
  let thetaDeg: number | null = null;
  for (let index = 0; index < SECTOR_ORDER.length; index += 1) {
    const sector = geospatialProfile.sectors[SECTOR_ORDER[index]];
    if (!sector || !(sector.fetchKm >= SHADOW_OPEN_FETCH_KM)) continue;
    const d = angularDistanceDeg(waveDirectionDeg, index * 45);
    if (thetaDeg === null || d < thetaDeg) thetaDeg = d;
  }
  // Κανένας ανοιχτός διάδρομος πουθενά = κλειστός κύκλος στεριάς: ό,τι κύμα υπάρχει έχει ήδη
  // στρίψει τουλάχιστον μία ολόκληρη σκιά για να μπει.
  if (thetaDeg === null) return SHADOW_KD_FLOOR;
  if (thetaDeg <= SHADOW_CORRIDOR_HALF_DEG) return 1;
  const kd = Math.max(
    SHADOW_KD_FLOOR,
    SHADOW_KD_AT_EDGE * Math.exp(-(thetaDeg - SHADOW_CORRIDOR_HALF_DEG) / SHADOW_DECAY_DEG)
  );
  // Το πάτωμα της πλάγιας θάλασσας (29/08/2026) — όλη η ιστορία, η φυσική και η μέτρηση στη
  // σταθερά SHADOW_CROSS_SEA_ONSHORE_MIN πιο πάνω. Εδώ φτάνουμε μόνο όταν ΥΠΑΡΧΕΙ πόρτα ≥10 χλμ
  // (η τσέπη επέστρεψε ήδη), οπότε: θάλασσα που δεν φεύγει καθαρά → όχι βαθύτερα από την άκρη.
  const facingDeg = geospatialProfile.facingDeg;
  if (typeof facingDeg === 'number' && Number.isFinite(facingDeg)) {
    const onshore = Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180);
    if (onshore > SHADOW_CROSS_SEA_ONSHORE_MIN) return Math.max(kd, SHADOW_KD_AT_EDGE);
  }
  return kd;
};
