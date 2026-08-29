import shelterData from '../data/landingShelter.generated.json';

/**
 * ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΚΑΘΕ ΠΕΡΙΟΧΗΣ ΕΙΝΑΙ ΠΡΟΣΤΑΤΕΥΜΕΝΕΣ ΑΠΟ ΤΟΝ ΣΗΜΕΡΙΝΟ ΑΝΕΜΟ.
 *
 * Ο αριθμός δεν υπολογίζεται εδώ — είναι ψημένος στο build (scripts/buildLandingShelter.mjs)
 * από τον ΙΔΙΟ μηχανισμό που χρωματίζει τις πινέζες του χάρτη, για 24 κατευθύνσεις ανέμου.
 * Αυτό το αρχείο κάνει μόνο τη μετάφραση «μοίρες ανέμου → κουβαδάκι» και την κατάταξη.
 *
 * ΓΙΑΤΙ ΨΗΜΕΝΟΣ ΚΑΙ ΟΧΙ ΖΩΝΤΑΝΟΣ: για να τον υπολογίσει η landing στον αέρα θα χρειαζόταν τα
 * γεωχωρικά προφίλ και των 13 περιοχών — 9,9 MB — σε μια σελίδα που το 88,7% των επισκεπτών
 * ανοίγει από κινητό. Ψημένος κοστίζει 901 bytes gzipped.
 *
 * ΤΙ ΔΕΝ ΕΙΝΑΙ: πρόγνωση. Δεν κουβαλάει ταχύτητα ανέμου, άρα δεν λέει «ήρεμες» — λέει πόσες
 * ακτές γυρίζουν την πλάτη τους στη σημερινή κατεύθυνση, με τη λέξη που χρησιμοποιεί ήδη ο
 * χάρτης («Προστατευμένη»). Η διαφορά είναι σκόπιμη και τη φυλάει πύλη
 * (scripts/validateLandingShelterBound.mjs).
 */

interface BakedRegion {
  /** Παραλίες με πραγματική γεωμετρία — ΑΥΤΟΣ είναι ο παρονομαστής, όχι το σύνολο. */
  total: number;
  /** Όλες οι παραλίες της περιοχής, για να μη χαθεί το νούμερο αν χρειαστεί αλλού. */
  beachCount: number;
  /** Πλήθος προστατευμένων ανά κουβαδάκι κατεύθυνσης, από 0° και ανά `stepDeg`. */
  sheltered: number[];
}

const REGIONS = shelterData.regions as Record<string, BakedRegion>;
const STEP_DEG = shelterData.stepDeg;

export interface RegionShelter {
  regionId: string;
  sheltered: number;
  total: number;
  /** 0..1 — ΑΥΤΟ κατατάσσει, όχι το απόλυτο πλήθος. Δες `sortRegionsByShelter`. */
  share: number;
}

/**
 * Το πλήθος προστατευμένων για μία περιοχή, με τον άνεμο να έρχεται από `windFromDeg`.
 * Επιστρέφει null όταν δεν ξέρουμε την κατεύθυνση ή δεν έχουμε ψημένη την περιοχή — ο καλών
 * τότε δείχνει σκέτο όνομα. Ποτέ μηδέν ως «δεν ξέρω»: το 0 σημαίνει «καμία προστατευμένη»,
 * που είναι εντελώς άλλη πρόταση.
 */
export const shelterForWind = (regionId: string, windFromDeg: number | null): RegionShelter | null => {
  if (typeof windFromDeg !== 'number' || !Number.isFinite(windFromDeg)) return null;
  const region = REGIONS[regionId];
  if (!region || region.total <= 0) return null;

  const buckets = region.sheltered.length;
  const bucket = Math.round((((windFromDeg % 360) + 360) % 360) / STEP_DEG) % buckets;
  const sheltered = region.sheltered[bucket];
  if (typeof sheltered !== 'number') return null;

  return { regionId, sheltered, total: region.total, share: sheltered / region.total };
};

/**
 * ΚΑΤΑΤΑΞΗ ΚΑΤΑ ΠΟΣΟΣΤΟ, ΟΧΙ ΚΑΤΑ ΠΛΗΘΟΣ — και αυτό μετρήθηκε πριν επιλεγεί (29/08/2026).
 *
 * Με το απόλυτο πλήθος, η σειρά είναι σχεδόν η ίδια σε βοριά, νοτιά, ανατολικό και δυτικό
 * άνεμο: πρώτες βγαίνουν πάντα η Χαλκιδική (133 παραλίες) και η Κέρκυρα (105), επειδή είναι οι
 * μεγαλύτερες — δηλαδή η λωρίδα θα ξανάλεγε κάτι που δεν αλλάζει, που είναι ακριβώς ο λόγος που
 * την ξαναπιάσαμε. Με το ποσοστό η σειρά αλλάζει πραγματικά με τον καιρό: στον βοριά μπροστά
 * Ρόδος και Πάτμος, στον ανατολικό Λέσβος και Λήμνος, στον νοτιά Λήμνος και Μαγνησία.
 *
 * Οι περιοχές χωρίς αριθμό πάνε στο τέλος με τη σειρά που ήρθαν (μετρημένη ζήτηση), αντί να
 * θεωρηθούν μηδενικές.
 */
export const sortRegionsByShelter = <T extends { id: string }>(
  regions: T[],
  shelterById: Map<string, RegionShelter>,
): T[] => (
  regions
    .map((region, index) => ({ region, index, shelter: shelterById.get(region.id) }))
    .sort((a, b) => {
      if (a.shelter && b.shelter) {
        if (b.shelter.share !== a.shelter.share) return b.shelter.share - a.shelter.share;
        // Ίδιο ποσοστό: μπροστά η περιοχή με τις περισσότερες παραλίες, γιατί προσφέρει
        // περισσότερες πραγματικές επιλογές για την ίδια πιθανότητα.
        if (b.shelter.sheltered !== a.shelter.sheltered) return b.shelter.sheltered - a.shelter.sheltered;
      } else if (a.shelter || b.shelter) {
        return a.shelter ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(entry => entry.region)
);

/**
 * Ο άνεμος της ημέρας ως ΕΝΑΣ τομέας πυξίδας (0 = Β, 1 = ΒΑ, …), ή null όταν η χώρα δεν
 * συμφωνεί.
 *
 * Η landing μπαίνει στον πειρασμό να πει «σήμερα φυσάει βοριάς» επειδή ακούγεται ωραία. Σε
 * μέρα που το Ιόνιο έχει νοτιά και το Αιγαίο βοριά, αυτό είναι απλώς λάθος για τον μισό
 * επισκέπτη — και ο μισός επισκέπτης είναι πολύς.
 *
 * ΓΙΑΤΙ ΚΥΚΛΙΚΟΣ ΜΕΣΟΣ ΚΑΙ ΟΧΙ «Ο ΠΙΟ ΣΥΧΝΟΣ ΤΟΜΕΑΣ» (διορθώθηκε πριν φύγει, 29/08/2026). Η
 * πρώτη γραφή μετρούσε ψήφους ανά τομέα 45° και ζητούσε απλή πλειοψηφία. Δοκιμάστηκε με 7
 * περιοχές στον βοριά και 6 στον νοτιά — την ακριβώς διχασμένη μέρα που το null υπάρχει για
 * να πιάσει — και **πέρασε**, ανακοινώνοντας «βόρειος» στους μισούς λάθος. Χειρότερα, το ίδιο
 * μέτρημα κόβει και την αντίθετη περίπτωση: ένα πραγματικό μελτέμι μοιρασμένο σε Β και ΒΑ
 * είναι συμφωνία, αλλά δύο διαφορετικοί «τομείς», άρα θα έβγαινε «μεικτό».
 *
 * Οι μοίρες είναι κυκλικές, οπότε η σωστή πράξη είναι διανυσματική: βρες τον κυκλικό μέσο και
 * ρώτα πόσες μετρήσεις πέφτουν μέσα σε μισό τομέα (45°) από αυτόν. Δύο αντίθετοι άνεμοι
 * αλληλοαναιρούνται και κόβονται· ο Β/ΒΑ διχασμός μαζεύεται σωστά σε έναν μέσο.
 */
export const WIND_AGREEMENT_SHARE = 0.7;
/** Μισός τομέας πυξίδας — όσο απέχει μια μέτρηση από τον μέσο και ακόμη λέει το ίδιο πράγμα. */
const WIND_AGREEMENT_TOLERANCE_DEG = 45;

export const dominantWindSector = (directions: Array<number | null>): number | null => {
  const known = directions.filter((deg): deg is number => typeof deg === 'number' && Number.isFinite(deg));
  if (known.length === 0) return null;

  const toRad = Math.PI / 180;
  const meanDeg = ((Math.atan2(
    known.reduce((sum, deg) => sum + Math.sin(deg * toRad), 0),
    known.reduce((sum, deg) => sum + Math.cos(deg * toRad), 0),
  ) / toRad) + 360) % 360;

  const agreeing = known.filter(deg => {
    const delta = Math.abs(deg - meanDeg) % 360;
    return Math.min(delta, 360 - delta) <= WIND_AGREEMENT_TOLERANCE_DEG;
  }).length;

  if (agreeing / known.length < WIND_AGREEMENT_SHARE) return null;
  return Math.round(meanDeg / 45) % 8;
};
