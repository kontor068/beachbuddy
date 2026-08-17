import type { GeospatialExposureProfile } from '../types';
import { estimateFetchLimitedWaveHeightM } from './waveModel';
import { interpolateSectorGeometry } from './windExposureModel';
import {
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MAX_ONSHORE,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
} from './offshoreFlatWater';

/**
 * ΤΟ ΚΥΜΑ ΜΠΡΟΣΤΑ ΣΤΗΝ ΑΜΜΟ — the number people actually came for.
 *
 * THE PROBLEM, in one screenshot. Σχινιάς, 05/08/2026, 5 Bft from 21° — a northerly blowing
 * straight OFF the land at a shore that faces 173°. Its own geometry reads 0,2 km of fetch and
 * intensity 0,2/100 in that sector; a live webcam showed glass with swimmers standing in it.
 * The page printed «Κύμα ανοιχτά 1,1 μ.» — which is TRUE, and was taken 9,4 km out in the
 * South Evoian Gulf where that same wind has tens of kilometres to work with.
 *
 * The label «ανοιχτά» / "offshore" was our answer to that, and it is not enough: a reader sees
 * a metre figure next to a beach and reads it as the water at the beach. Miltos, 05/08/2026:
 * «το κύμα το θελουμε να το βλεπουμε στην ακτη, ο κοσμος το βλεπει στην ακτη για να καταλαβει
 * αν εχει κυμα η οχι στην παραλια».
 *
 * WHY THIS IS NOT THE THING THAT WAS REJECTED ON 29/07/2026. That decision refused a downward
 * CAP on the displayed open-water number — i.e. printing a smaller figure under the same label,
 * which is how a false calm is manufactured. This adds a SECOND, separately-labelled reading and
 * leaves the open-water one on screen beside it. Nothing that exists today gets smaller; one
 * thing gets added. The wave graphic, the sea verdict, the colour and every gate keep reading
 * exactly the number they read before (docs/team/PORISMA-KAIROS-2026-08.md §4 Σ3 explains why
 * those must stay bound to the printed open-water figure).
 *
 * WHERE IT IS ALLOWED TO SPEAK — the four conditions, all required:
 *   1. The live wind sector is near-totally land-blocked, has essentially no fetch, and the wind
 *      is blowing off the land. These are the IDENTICAL constants the offshore-flat-water lift
 *      uses (utils/offshoreFlatWater), imported rather than restated so they can never drift.
 *      That gate was measured airtight in the dangerous direction: of 4.386 lifted combinations
 *      the maximum sector fetch was 0.
 *   2. High-confidence geometry, no suspect pin. A misread coastline must never produce a calm
 *      claim — the whole reason geospatialProfileConflictsWithAuthoredFacing exists.
 *   3. NO SWELL THAT CAN ARRIVE HERE. This is the one real false-calm risk: ground swell wraps
 *      around headlands and into bays that the wind cannot reach, so a blocked shore can be
 *      perfectly sheltered from the wind and still have a metre of roll arriving. The test is
 *      whether the swell is ONSHORE for this beach (utils/swellExposure), not whether the grid
 *      cell reports one — see `arrivingSwellPresent`. A swell running away from the shore is the
 *      normal state of a lee coast in a meltemi and must not silence this estimate.
 *   4. There is an open-water reading to be quieter than. With no measurement there is nothing
 *      to add a second opinion to.
 *
 * WHAT IT IS, physically: the fetch-limited height our own SMB model gives over the fetch the
 * ray-caster measured in that sector, at the live wind speed — the same textbook formula and the
 * same code path that has always produced the modelled leg of the displayed wave. It is floored
 * at SHORE_DISPLAY_FLOOR_M and capped at the open-water reading, so it can never print more than
 * the sea outside nor claim a flatness finer than the app is willing to draw.
 *
 * WHAT NO ONE CAN CHECK IT AGAINST, and this must stay written down: there is no judge for a
 * shoreline. Copernicus reads a 4,2 km cell — over the two cached meltemi summers its leeward
 * cell sits at a median 0,52 m, but that is open water on the lee side of an island, not the
 * water at an enclosed shore with the wind coming off the hill behind it. So this number is
 * MODELLED and is presented as such (a «~» and its own label), never as a measurement.
 */

/** Never print a flatness finer than this — matches the cove guard's display floor. */
export const SHORE_DISPLAY_FLOOR_M = 0.1;

/**
 * ΤΟ ΚΑΤΩΦΛΙ ΕΓΙΝΕ ΡΑΜΠΑ ΜΕ ΠΛΑΤΦΟΡΜΑ (16/08/2026) — βίβλος §Γ4.
 *
 * Το `onshore` ήταν διακόπτης στο −0,80: από κάτω τυπώναμε το νερό της ακτής, από πάνω το κύμα
 * της ανοιχτής θάλασσας, χωρίς τίποτα ενδιάμεσο. Δύο γειτονικές παραλίες 2 χλμ μακριά, με τον
 * ΙΔΙΟ άνεμο, έπαιρναν αντίθετη απάντηση επειδή η μία έπεφτε 0,001 πάνω από το κατώφλι —
 * μετρημένα, 781 από 2.378 γειτονικά ζευγάρια (32,8%). Τα Λιμανάκια Βουλιαγμένης στο −0,799
 * χρεώνονταν ολόκληρο το 0,68 μ. των ανοιχτών ενώ ο αέρας φυσούσε από τη στεριά.
 *
 * ΓΙΑΤΙ ΠΛΑΤΦΟΡΜΑ ΚΑΙ ΟΧΙ ΣΚΕΤΗ ΡΑΜΠΑ. Μια ράμπα που ξεκινά να ξεφουσκώνει από το −1 τιμωρεί τις
 * παραλίες για τις οποίες ΧΤΙΣΤΗΚΕ η λειτουργία: ο Σχινιάς (onshore −0,834) πήγαινε από 0,17 σε
 * 0,63 μ., δηλαδή θα ξαναλέγαμε «κύμα» εκεί όπου webcam έδειξε λάδι με λουόμενους μέσα
 * (utils/shoreWave, το παράδειγμα που γέννησε το αρχείο). Οπότε το βάρος μένει **καρφωμένο στο 1
 * μέχρι το παλιό κατώφλι** — για κάθε παραλία που μιλάει σήμερα ο κώδικας είναι ΤΑΥΤΟΤΙΚΟΣ — και
 * σβήνει γραμμικά μόνο μέσα στη ζώνη που σήμερα σιωπά.
 *
 * ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ: άνοιγμα, φράξιμο, εμπιστοσύνη, ύποπτο pin, αποθαλασσιά, το δάπεδο εμφάνισης και
 * το καπάκι «ποτέ πιο δυνατά από τη θάλασσα έξω». Μόνο το `onshore` απέκτησε ενδιάμεσο.
 */
export const SHORE_RAMP_FULL_ONSHORE = OFFSHORE_FLAT_MAX_ONSHORE;
export const SHORE_RAMP_SILENT_ONSHORE = -0.5;

/**
 * Πόσο από τον αριθμό είναι η ακτή και πόσο η ανοιχτή θάλασσα. 1 = καθαρά η ακτή (σημερινή
 * συμπεριφορά), 0 = καθαρά τα ανοιχτά (δηλαδή σιωπή, μέσω του καπακιού παρακάτω).
 */
export const shoreRampWeight = (onshore: number): number => {
  if (onshore <= SHORE_RAMP_FULL_ONSHORE) return 1;
  if (onshore >= SHORE_RAMP_SILENT_ONSHORE) return 0;
  const span = SHORE_RAMP_SILENT_ONSHORE - SHORE_RAMP_FULL_ONSHORE;
  return (SHORE_RAMP_SILENT_ONSHORE - onshore) / span;
};

/**
 * ΟΤΑΝ ΔΕΝ ΥΠΑΡΧΕΙ ΝΕΡΟ ΠΡΟΣ ΤΑ ΕΚΕΙ, Η ΓΩΝΙΑ ΤΟΥ ΑΝΕΜΟΥ ΔΕΝ ΚΡΙΝΕΙ ΤΙΠΟΤΑ (17/08/2026 — §Γ21).
 *
 * Η πύλη `onshore` παρακάτω ρωτάει «φυσάει από τη στεριά;». Το ερώτημα που κρίνει αν ΜΠΟΡΕΙ να
 * υπάρξει κύμα εδώ είναι άλλο: «υπάρχει καθόλου νερό προς τα εκεί;». Όσο οι δύο ερωτήσεις
 * συμφωνούν δεν φαίνεται τίποτα· όταν ο κόλπος κοιτάει αλλού από τον άνεμο, χωρίζουν — και τότε
 * μια παραλία που ο ίδιος ο χάρτης μας λέει «Προστατευμένη» τυπώνει από κάτω το νούμερο του
 * πελάγους. Εθνικά: **2.082 τομείς σε 1.318 παραλίες**, οι 1.721 ήδη «Προστατευμένες».
 *
 * ΤΟ «ΜΗΔΕΝ ΑΝΟΙΓΜΑ» ΔΕΝ ΑΡΚΕΙ ΜΟΝΟ ΤΟΥ, ΜΕΤΡΗΜΕΝΑ. Πάνορμος Νάξου (2011) @ S: `fetchKm 0`,
 * `blockedRayRatio 1` — αλλά το στόμιο ΝΔ ανοίγει 6,2 χλμ και ο νότιος σηκώνει κύμα ΕΞΩ από τη
 * ράχη, που μπαίνει από το πλάι. Δεν είναι εξαίρεση: **1.869 από τους 2.082 (89,8%)** έχουν
 * ανοιχτό στόμιο ≥5 χλμ μέσα σε ±90°. Γι' αυτό απαιτείται ΚΑΙ δεύτερη συνθήκη — «κανένα ανοιχτό
 * στόμιο δίπλα» — και το τόξο είναι ±90°, όχι ±45°: στα ±45° περνούσαν **520 τομείς** που είχαν
 * στόμιο >5 χλμ λίγο πιο πέρα, και ο πληθυσμός που κρατούσαν είχε διάμεσο μέγιστο άνοιγμα 10,5 χλμ
 * (δηλαδή ανοιχτές παραλίες με στραμμένο τον άνεμο, όχι όρμους).
 *
 * ΓΙΑΤΙ ΤΟ ΗΜΙΚΥΚΛΙΟ ΕΙΝΑΙ Η ΣΩΣΤΗ ΕΡΩΤΗΣΗ. Ο άνεμος χτίζει κύμα πάνω στο νερό απ' όπου έρχεται.
 * Ανοιχτό νερό στην ΑΝΤΙΘΕΤΗ μεριά (πέρα από 90°) είναι νερό προς το οποίο φυσάει — δηλαδή η
 * κλασική απόγεια περίπτωση, που ήδη καλύπτεται. Επικίνδυνο είναι μόνο ανοιχτό νερό στο ΙΔΙΟ
 * ημικύκλιο με τον άνεμο.
 *
 * ⚠️ ΜΟΝΟΔΡΟΜΗ ΚΑΙ ΕΠΙΒΕΒΑΙΩΜΕΝΑ: μόνο ΠΡΟΣΘΕΤΕΙ περιπτώσεις όπου η εκτίμηση ακτής μιλάει, και
 * το καπάκι «ποτέ πιο δυνατά από τη θάλασσα έξω» σιωπά αν το νούμερο δεν είναι ΜΙΚΡΟΤΕΡΟ. Εθνικά,
 * 110/110 περιοχές × 2.872 παραλίες: **61 πιο ήρεμες (2,1%), 0 πιο άγριες**, 2 αλλαγές ετυμηγορίας
 * (`avoid_swimming → caution`, Άγιος Ιωάννης Πόρτο 2151 και Σταφίδα 2186, Τήνος — και οι δύο ήδη
 * `protected`), podium 5/110. Κλειδωμένο από `scripts/validateDrySectorGate.mjs`.
 */
export const DRY_SECTOR_NEIGHBOUR_HALF_WIDTH_DEG = 90;
export const DRY_SECTOR_NEIGHBOUR_MAX_FETCH_KM = 2;

const DRY_SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

const angularDeltaDeg = (a: number, b: number): number => {
  const normalize = (deg: number) => ((deg % 360) + 360) % 360;
  const diff = Math.abs(normalize(a) - normalize(b));
  return diff > 180 ? 360 - diff : diff;
};

/**
 * Είναι ο ζωντανός τομέας ΞΗΡΟΣ — μηδέν νερό μπροστά ΚΑΙ κανένα ανοιχτό στόμιο στο ίδιο ημικύκλιο;
 *
 * Ο ζωντανός τομέας είναι ΠΑΡΕΜΒΟΛΗ δύο γειτονικών (utils/windExposureModel), οπότε δεν κουβαλάει
 * τους άλλους έξι — γι' αυτό ο έλεγχος γείτονα θέλει το ίδιο το προφίλ. Χωρίς προφίλ ή χωρίς
 * διεύθυνση ανέμου η απάντηση είναι ΟΧΙ: απουσία μάρτυρα δεν είναι απόδειξη.
 */
export const isEnclosedDrySector = (
  sector: { fetchKm?: number; blockedRayRatio?: number } | null | undefined,
  profile: { sectors?: Record<string, { fetchKm?: number } | undefined> } | null | undefined,
  windDirectionDeg: number | null | undefined
): boolean => {
  if (!sector || !profile?.sectors) return false;
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return false;
  const { fetchKm, blockedRayRatio } = sector;
  if (typeof fetchKm !== 'number' || !Number.isFinite(fetchKm) || fetchKm > 0) return false;
  if (typeof blockedRayRatio !== 'number' || blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return false;

  for (let index = 0; index < DRY_SECTOR_ORDER.length; index += 1) {
    if (angularDeltaDeg(index * 45, windDirectionDeg) > DRY_SECTOR_NEIGHBOUR_HALF_WIDTH_DEG + 1e-9) continue;
    const neighbourFetchKm = profile.sectors[DRY_SECTOR_ORDER[index]]?.fetchKm;
    if (typeof neighbourFetchKm !== 'number' || !Number.isFinite(neighbourFetchKm)) return false;
    if (neighbourFetchKm > DRY_SECTOR_NEIGHBOUR_MAX_FETCH_KM) return false;
  }
  return true;
};

/**
 * Η ΒΕΝΤΑΛΙΑ ΔΙΑΣΠΟΡΑΣ: ΣΤΟΝ ΞΗΡΟ ΤΟΜΕΑ, ΤΟ ΝΟΥΜΕΡΟ ΤΟΥ ΣΤΟΜΙΟΥ (18/08/2026 — §Γ22, Στάδιο 0).
 *
 * Ο άνεμος δεν σπρώχνει ενέργεια σε μία γραμμή αλλά σε βεντάλια (cos²ˢ directional spreading).
 * Όταν ο ζωντανός τομέας είναι ΞΗΡΟΣ — μηδέν άνοιγμα, ουσιαστικά όλες οι ακτίνες κομμένες — το
 * «μπορεί να φτάσει κύμα εδώ;» δεν απαντιέται ούτε από τη γωνία του ανέμου (δεν υπάρχει νερό στη
 * γραμμή του) ούτε από τον δυαδικό έλεγχο στομίου του isEnclosedDrySector (ναι/όχι σε κατώφλι
 * 2 χλμ). Απαντιέται από το ολοκλήρωμα:
 *
 *   H_fan² = Σ cos²ˢ(Δθ) · H_SMB(άνοιγμα(θ))² / Σ cos²ˢ(Δθ) ,  |Δθ| < 90°
 *
 * με το άνοιγμα ανά γωνία από την ΙΔΙΑ παρεμβολή που τρέχει ζωντανά (interpolateSectorGeometry)
 * και κανονικοποίηση πάνω σε ΟΛΟΚΛΗΡΗ τη βεντάλια — και στη στεριά, που συνεισφέρει μηδέν. Έτσι
 * ο κλειστός όρμος βγάζει ~0 (→ δάπεδο 0,10, ό,τι έδινε η §Γ21) και ο όρμος με στόμιο βγάζει το
 * κύμα του στομίου ζυγισμένο με τη γωνία του — όχι σιωπή, όχι το πέλαγος, όχι γυμνό δάπεδο.
 *
 * ΓΙΑΤΙ s=2 (~±33° μισής ισχύος): μετρήθηκε εθνικά 18/08 (scripts/measureFanSpreading.mjs,
 * 110/110 περιοχές) — τα s=1/2/3 δίνουν σχεδόν ταυτόσημο αποτέλεσμα (272/273/273 πιο ήρεμες),
 * άρα κρατάμε το μεσαίο, το τυπικό της βιβλιογραφίας για wind-sea. Η απόφαση που μέτρησε ήταν
 * το ΠΕΔΙΟ: ο Μίλτος ενέκρινε ΜΟΝΟ τους ξηρούς τομείς (fan-dry)· το fan-all (αντικατάσταση και
 * της ράμπας onshore) ΔΕΝ εγκρίθηκε — ξαναμετριέται σε μέρα μελτεμιού πριν κριθεί.
 *
 * ΟΙ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ ΤΗΣ, ΚΑΙ ΟΙ ΔΥΟ ΠΡΟΣ ΤΗΝ ΑΛΗΘΕΙΑ:
 *  - Ξηρός + σιωπηλός σήμερα (onshore ≥ −0,5): αποκτά φωνή ΜΙΚΡΟΤΕΡΗ από το πέλαγος που τύπωνε
 *    (98 παραλίες στη μέτρηση της άπνοιας, 0 πιο άγριες, μέγιστο σβησμένο 0,66 μ.).
 *  - Ξηρός + ομιλητής σήμερα (απόγειος): το γυμνό δάπεδο 0,10 γίνεται το νούμερο του στομίου.
 *    Αυτή είναι η κλάση του ατυχήματος του Πανόρμου (2011 @ Ν: σήμερα 0,10 ενώ ο νότιος σηκώνει
 *    κύμα έξω από τη ράχη που μπαίνει από το ΝΔ στόμιο 6,2 χλμ) — η βεντάλια το ΑΝΕΒΑΖΕΙ, που
 *    είναι η ασφαλής κατεύθυνση και ο λόγος που το Στάδιο 0 υπάρχει.
 * Το καπάκι «ποτέ πιο δυνατά από τη θάλασσα έξω», το δάπεδο, η αποθαλασσιά, η εμπιστοσύνη και οι
 * πύλες φραξίματος/ανοίγματος ισχύουν αυτούσια. Κλειδωμένο από scripts/validateDrySectorGate.mjs (5).
 *
 * ΧΩΡΙΣ ΠΛΗΡΕΣ ΠΡΟΦΙΛ (και οι 8 τομείς με αριθμούς) η απάντηση είναι undefined — απουσία μάρτυρα
 * δεν γεννά ισχυρισμό· τότε ισχύει ό,τι ίσχυε (ράμπα + isEnclosedDrySector ως δίχτυ).
 */
export const FAN_SPREAD_EXPONENT = 2;
export const FAN_SPREAD_HALF_WIDTH_DEG = 90;
const FAN_SPREAD_STEP_DEG = 5;
/** Ίδιο κατώφλι «ξηρού» με τη μέτρηση της §Γ20/§Γ21, ώστε τα νούμερα να διασταυρώνονται. */
export const DRY_SECTOR_MIN_BLOCKED_RATIO = 0.95;

export const drySectorFanWaveHeightM = ({
  sector,
  profile,
  windDirectionDeg,
  windSpeedKmh,
}: {
  /** Η ζωντανή (παρεμβλημένη) γεωμετρία — η βεντάλια μιλάει ΜΟΝΟ όταν αυτή είναι ξηρή. */
  sector?: { fetchKm?: number; blockedRayRatio?: number } | null;
  profile?: { sectors?: Record<string, { fetchKm?: number; blockedRayRatio?: number } | undefined> } | null;
  windDirectionDeg?: number | null;
  windSpeedKmh?: number;
}): number | undefined => {
  if (!sector || !profile?.sectors) return undefined;
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return undefined;
  if (typeof windSpeedKmh !== 'number' || !Number.isFinite(windSpeedKmh)) return undefined;
  const { fetchKm, blockedRayRatio } = sector;
  if (typeof fetchKm !== 'number' || !Number.isFinite(fetchKm) || fetchKm > 0) return undefined;
  if (typeof blockedRayRatio !== 'number' || blockedRayRatio < DRY_SECTOR_MIN_BLOCKED_RATIO) return undefined;
  for (const key of DRY_SECTOR_ORDER) {
    const raw = profile.sectors[key];
    if (!raw
      || typeof raw.fetchKm !== 'number' || !Number.isFinite(raw.fetchKm)
      || typeof raw.blockedRayRatio !== 'number' || !Number.isFinite(raw.blockedRayRatio)) {
      return undefined;
    }
  }

  let energy = 0;
  let weightSum = 0;
  for (
    let deltaDeg = -FAN_SPREAD_HALF_WIDTH_DEG + FAN_SPREAD_STEP_DEG / 2;
    deltaDeg < FAN_SPREAD_HALF_WIDTH_DEG;
    deltaDeg += FAN_SPREAD_STEP_DEG
  ) {
    const weight = Math.cos((deltaDeg * Math.PI) / 180) ** (2 * FAN_SPREAD_EXPONENT);
    // Πλήρες προφίλ εγγυημένο από τον βρόχο πάνω — η παρεμβολή δεν θα σκάσει σε λειψό τομέα.
    const { fetchKm: fanFetchKm } = interpolateSectorGeometry(
      profile as GeospatialExposureProfile,
      windDirectionDeg + deltaDeg
    );
    const heightM = estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm: fanFetchKm });
    energy += weight * heightM * heightM;
    weightSum += weight;
  }
  return weightSum > 0 ? Math.sqrt(energy / weightSum) : 0;
};

/**
 * Κάτω από αυτό, ένα συστατικό της θάλασσας δεν κρίνει τίποτα — μετράμε κατευθύνσεις μόνο για
 * νερό που υπάρχει. Ίδιο νούμερο με το δάπεδο εμφάνισης × 1,5: αρκετά πάνω από τον θόρυβο του
 * πλέγματος, αρκετά κάτω από οτιδήποτε θα πρόσεχε κολυμβητής.
 */
export const DEPARTING_SEA_MIN_COMPONENT_M = 0.15;

/**
 * ΟΤΑΝ ΟΛΟ ΤΟ ΝΕΡΟ ΤΑΞΙΔΕΥΕΙ ΜΑΚΡΙΑ, Η ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ ΝΑ ΤΟ ΜΑΝΤΕΨΕΙ (16/08/2026).
 *
 * Οι δύο γεωμετρικές πύλες παρακάτω — φραγμένες ακτίνες και άνοιγμα — υπάρχουν για να απαντήσουν
 * ΕΜΜΕΣΑ σε ένα ερώτημα: «μπορεί να φτάσει κύμα σε αυτή την ακτή;». Όταν το πλέγμα μας δίνει την
 * ΚΑΤΕΥΘΥΝΣΗ κάθε συστατικού, το ερώτημα απαντιέται ΑΜΕΣΑ, και η μέτρηση υπερισχύει της εικασίας.
 *
 * Η ΑΦΟΡΜΗ, με νούμερα. Ελαφονήσι 15/08/2026 16:00, ζωντανή κάμερα με ρηχό ήρεμο νερό και κόσμο
 * όρθιο μέσα· η κάρτα έλεγε 0,7 μ. Η θάλασσα 10 χλμ ΝΝΑ έδινε 1,22 μ., από τα οποία 1,14 μ. ήταν
 * κύμα ανέμου ερχόμενο από 356°. Η παραλία κοιτάει 159,3°: onshore −0,94 για το κύμα, −0,96 για
 * τον άνεμο. Ολόκληρη η θάλασσα έφευγε, και το κελί μέτρησης ήταν 10 χλμ ΚΑΤΑΝΤΗ του ανέμου. Οι
 * δύο πύλες την έκοβαν (άνοιγμα 5,44 χλμ · φραγμένες ακτίνες 0,8) — σωστά ως εικασία, λάθος ως
 * απάντηση, γιατί το νερό που μετρούσαν πήγαινε προς την άλλη μεριά.
 *
 * ΕΙΝΑΙ Η ΙΔΙΑ ΟΙΚΟΓΕΝΕΙΑ με τον Άγιο Προκόπιο της 10/08 (δες `arrivingSwellPresent` παραπάνω):
 * τότε καλύφθηκε η ΑΠΟΘΑΛΑΣΣΙΑ, εδώ το ΚΥΜΑ ΑΝΕΜΟΥ — που στο Ελαφονήσι ήταν το 93% του αριθμού.
 *
 * ΚΑΤΩΦΛΙ −0,8, ΤΟ ΙΔΙΟ ΠΟΥ ΧΡΗΣΙΜΟΠΟΙΕΙ ΗΔΗ ΤΟ OFFSHORE_FLAT_MAX_ONSHORE — πάνω από 143° εκτός
 * μετωπικής. Μετρήθηκε εθνικά (scripts/measureDepartingSeaNationally.mjs, 2.768 παραλίες × 14 ώρες
 * κολύμβησης, ζωντανά 16/08/2026):
 *
 *              κατώφλι −0,5        κατώφλι −0,8
 *   ώρες×παραλία   576                 44
 *   παραλίες       —                    8   (ΟΛΕΣ ήδη «protected» στη γεωμετρία)
 *   μέγιστη πτώση  1,52 μ.             0,96 μ.
 *   πέφτουν από ≥1 μ. στο δάπεδο 0,10:  αρκετές          0
 *
 * Το −0,5 απορρίφθηκε: μπαίνουν περιπτώσεις με onshore −0,52, που είναι «λοξά», όχι «φεύγει», και
 * εκεί ζουν τα άλματα από 1,6 μ. κατευθείαν στο δάπεδο. 1.872 παραλίες την ίδια ώρα έχουν θάλασσα
 * που ΕΡΧΕΤΑΙ και δεν αγγίζονται καθόλου.
 *
 * ΜΕ ΤΙ ΔΕΔΟΜΕΝΑ. Μετρήθηκε και η ακριβή παραλλαγή που ζητούσε ΞΕΧΩΡΙΣΤΑ το `wind_wave_direction`
 * (+30% βάρος σε ΚΑΘΕ κλήση θάλασσας, δες services/forecast/openMeteoProvider.ts): δίνει
 * ΑΚΡΙΒΩΣ το ίδιο σύνολο — 44 ώρες×παραλία, οι ίδιες 8 παραλίες, καμία διαφορά. Άρα ο κανόνας
 * τρέχει με ό,τι ήδη κατεβάζουμε και κοστίζει **μηδέν**. Μην προσθέσεις τη μεταβλητή για αυτό.
 *
 * ΣΙΩΠΗ ΕΙΝΑΙ Η ΑΣΦΑΛΗΣ ΑΠΑΝΤΗΣΗ: συστατικό με ύψος αλλά ΧΩΡΙΣ κατεύθυνση σημαίνει `false` —
 * δεν έχουμε απόδειξη ότι φεύγει, άρα δεν τη διεκδικούμε.
 */
export const isSeaDepartingShore = ({
  facingDeg,
  windDirectionDeg,
  components,
}: {
  facingDeg?: number | null;
  windDirectionDeg?: number;
  components: Array<{ heightM?: number; directionDeg?: number }>;
}): boolean => {
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return false;
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return false;

  const onshoreOf = (fromDeg: number) => Math.cos(((fromDeg - facingDeg) * Math.PI) / 180);

  // Ο άνεμος πρέπει ΚΙ ΑΥΤΟΣ να φεύγει. Αλλιώς χτίζει τοπικό κύμα μπροστά στην ακτή που το κελί
  // μέτρησης, δέκα χιλιόμετρα μακριά, δεν έχει δει ακόμη.
  if (onshoreOf(windDirectionDeg) > OFFSHORE_FLAT_MAX_ONSHORE) return false;

  const measurable = components.filter(
    c => typeof c.heightM === 'number' && Number.isFinite(c.heightM) && c.heightM >= DEPARTING_SEA_MIN_COMPONENT_M
  );
  if (measurable.length === 0) return false;

  return measurable.every(
    c => typeof c.directionDeg === 'number'
      && Number.isFinite(c.directionDeg)
      && onshoreOf(c.directionDeg) <= OFFSHORE_FLAT_MAX_ONSHORE
  );
};

export interface ShoreWaveInput {
  /** The open-water figure the page prints today, in metres. */
  openWaterWaveHeightM?: number;
  /** Live wind speed at the beach, km/h — the SMB input, not a Beaufort proxy. */
  windSpeedKmh?: number;
  /** The live wind sector's committed geometry. */
  sector?: { fetchKm?: number; blockedRayRatio?: number; onshore?: number } | null;
  /** Profile confidence — only 'high' may produce a calm claim. */
  confidence?: string;
  suspectPin?: boolean;
  /**
   * True when meaningful swell can ACTUALLY REACH THIS SHORE — not merely when the grid reports
   * a swell somewhere in the cell.
   *
   * ⚠️ RENAMED AND REDEFINED 10/08/2026, from `swellPresent`, because the old question was the
   * wrong one. Reported by Miltos with a live webcam of Άγιος Προκόπιος, Νάξος, 19:00: a full
   * beach, people standing in glass — and the page saying 1,1 m. The engine's numbers that
   * minute: the shore faces 212°, the wind blew from 5°, the wave came from 360° and the swell
   * from 358° at 6,55 s. Onshore components −0,89 / −0,85 / −0,83. Every single component of
   * that 1,1 m sea was travelling AWAY from the beach, measured in a cell 7,66 km DOWNWIND.
   *
   * This gate refused to speak purely because a swell existed. Its reason for existing is real —
   * ground swell wraps around headlands into bays the wind cannot reach, and that is the one way
   * a shore estimate can invent a false calm — but "a swell exists in the cell" and "a swell
   * arrives here" are different questions, and only the second one is dangerous. Charging the
   * first is how the lee coast of a meltemi, which is exactly what this project exists to find,
   * kept being described by the open sea behind it.
   *
   * Callers must pass an ONSHORE-aware value (services/recommendationService uses
   * utils/swellExposure's `exposed`, which requires onshore > 0,3 AND an open sector) and must
   * pass TRUE when a meaningful swell is present but its direction is unknown — with no direction
   * there is no evidence it is leaving, and silence is the safe answer.
   */
  arrivingSwellPresent?: boolean;
  /**
   * MEASURED proof that every component of the sea is travelling away from this shore — see
   * isSeaDepartingShore above. It replaces the two GEOMETRIC gates (blocked rays, fetch) and
   * nothing else: the ramp, the floor and the never-louder-than-the-sea guard all still apply,
   * so this can lower the printed number and can never raise it.
   */
  departingSea?: boolean;
  /**
   * ΜΕΤΡΗΜΕΝΗ απόδειξη ότι δεν υπάρχει νερό προς τα εκεί — ούτε στον τομέα του ανέμου, ούτε σε
   * κανένα στόμιο του ίδιου ημικυκλίου (δες {@link isEnclosedDrySector}). Παρακάμπτει ΜΟΝΟ τον
   * έλεγχο `onshore` παρακάτω και τίποτα άλλο: το δάπεδο, το καπάκι, η αποθαλασσιά, η εμπιστοσύνη
   * και το ύποπτο pin ισχύουν αυτούσια, οπότε μπορεί μόνο να κατεβάσει το τυπωμένο νούμερο.
   */
  enclosedDrySector?: boolean;
  /**
   * Το ύψος της βεντάλιας διασποράς όταν ο ζωντανός τομέας είναι ΞΗΡΟΣ και το προφίλ πλήρες —
   * βλ. {@link drySectorFanWaveHeightM} (§Γ22). Όταν υπάρχει, παρακάμπτει τον έλεγχο `onshore`
   * (όπως το enclosedDrySector) και γίνεται το ίδιο το μοντελοποιημένο ύψος: ο κλειστός όρμος
   * δίνει ~0 → δάπεδο, ο όρμος με στόμιο δίνει το κύμα του στομίου. Δάπεδο και καπάκι ισχύουν.
   */
  dryFanWaveM?: number;
}

/**
 * The modelled height at the shore, or `undefined` when we are not entitled to an opinion.
 *
 * `undefined` is the normal answer — it means the page behaves exactly as it did before this
 * function existed. Callers must treat it that way and must never substitute a fallback.
 */
export const estimateShoreWaveHeightM = ({
  openWaterWaveHeightM,
  windSpeedKmh,
  sector,
  confidence,
  suspectPin,
  arrivingSwellPresent,
  departingSea,
  enclosedDrySector,
  dryFanWaveM,
}: ShoreWaveInput): number | undefined => {
  if (arrivingSwellPresent) return undefined;
  if (suspectPin) return undefined;
  if (confidence !== 'high') return undefined;
  if (typeof openWaterWaveHeightM !== 'number' || !Number.isFinite(openWaterWaveHeightM)) return undefined;
  if (typeof windSpeedKmh !== 'number' || !Number.isFinite(windSpeedKmh)) return undefined;
  if (!sector) return undefined;

  const { fetchKm, blockedRayRatio, onshore } = sector;
  if (typeof fetchKm !== 'number' || typeof blockedRayRatio !== 'number' || typeof onshore !== 'number') {
    return undefined;
  }
  // Οι δύο γεωμετρικές πύλες ΜΑΝΤΕΥΟΥΝ αν μπορεί να φτάσει κύμα εδώ. Όταν έχουμε μετρημένη
  // απόδειξη ότι όλο το νερό φεύγει, η μέτρηση απαντά στο ίδιο ερώτημα ΑΜΕΣΑ και υπερισχύει.
  // Ο έλεγχος της ράμπας από κάτω ΔΕΝ παρακάμπτεται ποτέ: είναι η ίδια η κλίμακα του βάρους.
  if (!departingSea) {
    if (blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return undefined;
    if (fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return undefined;
  }
  // Ο άξονας `onshore` απαντά ΕΜΜΕΣΑ στο «μπορεί να φτάσει κύμα εδώ;». Όταν η γεωμετρία λέει ότι
  // δεν υπάρχει καθόλου νερό στο ημικύκλιο του ανέμου, το ερώτημα απαντιέται ΑΜΕΣΑ και η γωνία
  // δεν κρίνει τίποτα — δεν υπάρχει επιφάνεια πάνω στην οποία να χτιστεί κύμα, από όποια μεριά
  // κι αν φυσάει. Δες isEnclosedDrySector για το γιατί το τόξο είναι ±90° και όχι ±45°.
  //
  // Από 18/08 (§Γ22) ο ξηρός τομέας απαντά με τη ΒΕΝΤΑΛΙΑ όταν αυτή έχει μάρτυρα (πλήρες προφίλ):
  // το μοντελοποιημένο ύψος γίνεται το H_fan — μηδέν στον κλειστό όρμο, το κύμα του στομίου στον
  // ανοιχτό. Το enclosedDrySector μένει ως δίχτυ για προφίλ που η βεντάλια δεν μπορεί να διαβάσει.
  const fanM = typeof dryFanWaveM === 'number' && Number.isFinite(dryFanWaveM) ? dryFanWaveM : undefined;
  if (fanM === undefined && !enclosedDrySector && onshore >= SHORE_RAMP_SILENT_ONSHORE) return undefined;

  const weight = fanM !== undefined || enclosedDrySector ? 1 : shoreRampWeight(onshore);
  const modelledM = fanM !== undefined
    ? fanM
    : estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm });
  const blendedM = weight * modelledM + (1 - weight) * openWaterWaveHeightM;
  const shoreM = Math.max(SHORE_DISPLAY_FLOOR_M, blendedM);

  // Never louder than the sea outside: if our own model somehow exceeds the grid reading, the
  // grid wins and we stay silent rather than print the larger of two numbers under the calmer
  // label. This is the guard that makes the pair monotonic by construction.
  //
  // ⚠️ ΤΟ ΣΤΡΟΓΓΥΛΟΠΟΙΗΜΕΝΟ ΝΟΥΜΕΡΟ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΚΡΙΝΕΤΑΙ (16/08/2026). Η σύγκριση γινόταν στο
  // ασυστρογγύλευτο και η στρογγυλοποίηση ερχόταν μετά, οπότε 0,1499 έναντι ανοιχτών 0,15 περνούσε
  // την πύλη και τύπωνε «στην ακτή ~0,15» δίπλα σε «ανοιχτά 0,15» — δύο ίδια νούμερα, δύο ετικέτες.
  // Με τον διακόπτη ήταν σχεδόν αόρατο (η ακτή κόλλαγε στο δάπεδο 0,10)· με τη ράμπα το πέτυχε το
  // 1,3% των νέων περιπτώσεων. Σιωπή είναι η σωστή απάντηση: δεν έχουμε δεύτερη γνώμη να δώσουμε.
  const roundedM = Number(shoreM.toFixed(2));
  if (roundedM >= openWaterWaveHeightM) return undefined;

  return roundedM;
};
