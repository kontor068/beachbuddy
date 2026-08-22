import { Accessibility, Beach, SuitableBeach } from '../types';
import { hasDifficultTopPickAccess, hasMainstreamTopPickAccess } from '../utils/access';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import { calculateSeaConditionScore, hasPoorSeaConditions } from '../utils/seaConditions';
import { scoreTopPick } from '../utils/topPickScoreTable';

/**
 * TOP-PICK RANKING — the homepage podium's gates and ordering, extracted
 * VERBATIM from App.tsx (2026-07-26) so the trip planner can apply the exact
 * same rules instead of growing a divergent copy. This is a pure move: zero
 * behaviour changes, verified by the recommendation-scenario suite and a
 * before/after planner-report diff.
 *
 * Cycle rule: this module imports ONLY from utils/* and types.ts — never from
 * recommendationService (which has private near-twins of some of these; see
 * the duplication note there).
 */

export const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = 3;
export const PROTECTED_FIRST_BEAUFORT = 5;
/**
 * Πόσες θέσεις έχει το βάθρο. Ζει ΕΔΩ, όχι στο recommendationService, γιατί από 15/08/2026 το
 * χρησιμοποιεί και η επιλογή της ομάδας: μια ομάδα που δεν ξέρει πόσες θέσεις γεμίζει, τις
 * αφήνει άδειες. Το `MAX_TOP_RECOMMENDATION_DISPLAY_LIMIT` το διαβάζει από εδώ.
 */
export const TOP_PICK_PODIUM_SEATS = 3;
/**
 * The smallest sea difference the podium is allowed to reorder on, in metres of swell-equivalent
 * height. Read off our own model's error, not chosen: the worst per-buoy RMSE in
 * reports/wave-model/buoy-comparison.json is 0,251 m (national 0,184). Below its own error bar the
 * model is not measuring a difference, and a podium that reorders there is publishing noise.
 */
export const PODIUM_SEA_MEANINGFUL_DIFFERENCE_M = 0.25;
/**
 * ΠΟΤΕ ΜΕΤΡΑΕΙ ΟΤΙ ΔΙΑΒΑΖΟΥΜΕ ΛΑΘΟΣ ΝΕΡΟ — δηλαδή από ποιο ύψος και πάνω το κύμα είναι αυτό που
 * αποφασίζει (22/08/2026).
 *
 * 255 παραλίες ρωτάνε κελί που περιγράφει άλλο νερό (`marineCellTrusted:false`, ψημένο από το
 * scripts/auditMarineCellTrust.mjs). Σε ήρεμη μέρα αυτό δεν κοστίζει τίποτα: κάθε κελί της
 * περιοχής λέει «λάδι» και η κατάταξη κρίνεται από τον άνεμο. Το λάθος κελί αρχίζει να μετράει
 * όταν ο αριθμός του κύματος κάνει πραγματική δουλειά στη σειρά.
 *
 * ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΕΠΙΛΕΓΕΤΑΙ: **δύο φορές** το περιθώριο σφάλματος του ίδιου μας του μοντέλου.
 * Κάτω από ένα σφάλμα κάθε κελί διαβάζεται το ίδιο· στα δύο σφάλματα η διαφορά ανάμεσα σε δύο
 * κελιά μπορεί να είναι μεγαλύτερη από όλη την ακρίβεια που διεκδικούμε.
 *
 * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΜΠΕΙ (reports/quality/untrusted-cell-podium.json, 110 περιοχές × 5 μέρες):
 * σε αυτό το κατώφλι αλλάζουν **79 θέσεις βάθρου**, φεύγουν **18 λάθος #1**, και **2** βάθρα
 * αδειάζουν. Το «έξω πάντα» θα άδειαζε **6** και θα άλλαζε 178 θέσεις· στο 1,20 μ. ο κανόνας
 * είναι νεκρός (0 αλλαγές — τόσο ψηλά δεν επιβιώνει καμία στο βάθρο ούτως ή άλλως).
 */
export const UNTRUSTED_CELL_SEA_FLOOR_M = 2 * PODIUM_SEA_MEANINGFUL_DIFFERENCE_M;
/**
 * THE WIND AT EACH BEACH'S OWN SHORE (02/08/2026), keyed by beach id — App.perBeachMapWind,
 * built from the same cluster forecasts that already colour the map.
 *
 * Every function below used to take ONE Beaufort for a whole region, measured at its
 * geometric centre. Measured nationally on 02/08 over 8.550 beach-hours: that number is at
 * least one Beaufort away from the beach's own shore 35,9% of the time, and 1.171 distinct
 * beaches landed on the wrong side of a gate at least once. On the podium specifically, 150
 * beach-hours could reach #1 while their own water blew 5 Bft or more, and 47 were pushed
 * down for a wind that was not blowing there (all in Heraklion).
 *
 * Optional on purpose: a surface with no per-beach readings — the trip planner, the
 * prerender, the first paint before the cluster fetch lands — passes nothing and every beach
 * reads the region wind exactly as it did before. Nothing is ever left unranked.
 */
export type PerBeachWindLookup = ReadonlyMap<number, { beaufort: number }>;

type BeachIdentified = { beach?: { id: number }; beachId?: number };

/** The wind on THIS beach's shore, or the region's when it has no reading of its own. */
export const beachOwnBeaufort = (
  item: BeachIdentified,
  regionBeaufort: number,
  perBeachWind?: PerBeachWindLookup
): number => {
  const id = item.beach?.id ?? item.beachId;
  const own = typeof id === 'number' ? perBeachWind?.get(id)?.beaufort : undefined;
  return typeof own === 'number' && Number.isFinite(own) ? own : regionBeaufort;
};

/**
 * The strongest wind actually blowing on any shore in this pool. It replaces the region wind
 * as the branch selector below, which keeps the comparator a single-scalar decision (a sort
 * comparator that switched rules per pair would not be transitive). The per-beach part is
 * carried by the RANKS, not by the branch: see prioritizeProtectedRecommendations.
 */
const strongestBeaufortInPool = (
  items: readonly BeachIdentified[],
  regionBeaufort: number,
  perBeachWind?: PerBeachWindLookup
): number => {
  if (!perBeachWind || items.length === 0) return regionBeaufort;
  return items.reduce(
    (strongest, item) => Math.max(strongest, beachOwnBeaufort(item, regionBeaufort, perBeachWind)),
    0
  );
};
export const MAX_TOP_RECOMMENDATION_BEAUFORT = 6;
export const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;
export const MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE = 5;
export const MIN_REMAINING_TOP_PICK_SCORE = 62;

export const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant || beach.amenities?.parking)
);

export const hasTopPickVisitorServices = (beach: Beach): boolean => {
  const metadataAmenities = beach.metadata?.amenities?.join(' ').toLowerCase() || '';

  return Boolean(
    beach.metadata?.organized === true ||
    beach.amenities?.organized ||
    beach.amenities?.beachBar ||
    beach.amenities?.sunbeds ||
    beach.amenities?.taverna ||
    beach.amenities?.restaurant ||
    /beach bar|sunbed|ξαπλώστρ|ομπρέλ|καφέ|cafe|ταβέρν|taverna|restaurant|εστιατόρ/.test(metadataAmenities)
  );
};

export const hasTouristReadyTopPickProfile = (beach: Beach): boolean => {
  if (!hasMainstreamTopPickAccess(beach)) return false;

  return Boolean(
    hasTopPickVisitorServices(beach) ||
    beach.amenities?.parking ||
    beach.environment?.familyFriendly
  );
};

export const isWindProtectedRecommendation = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel' | 'canClaimWindProtection'>): boolean => {
  return item.exposureLevel === 'protected' && item.canClaimWindProtection === true;
};

export const exposurePriority = (item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel'>): number => {
  if (isWindProtectedRecommendation(item)) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

export const topPickProfilePriority = (item: SuitableBeach): number => {
  return exposurePriority(item);
};

export const topPickPopularityScore = (beach: Beach): number => {
  return getBeachTouristRecognitionScore(beach);
};

export const topPickAccessPriority = (beach: Beach): number => {
  const accessType = beach.metadata?.access?.type;
  if (hasDifficultTopPickAccess(beach)) return 5;
  if (accessType === 'asphalt_road') return 0;
  if (accessType === 'passable_dirt_road') return 1;
  if (accessType === 'hiking_path_easy') return 2;
  if (!accessType && beach.accessibility === Accessibility.EASY) return 0;
  if (!accessType && beach.accessibility === Accessibility.MODERATE) return 1;
  if (hasMainstreamTopPickAccess(beach)) return 3;
  return 4;
};

export const topPickAmenitiesScore = (beach: Beach): number => {
  let score = 0;
  if (hasMainstreamFacilities(beach)) score += 8;
  if (hasTopPickVisitorServices(beach)) score += 6;
  if (beach.amenities?.parking) score += 4;
  if (beach.amenities?.naturalShade) score += 2;
  if (beach.environment?.familyFriendly) score += 2;
  return score;
};

export const compareOptionalDistance = (a: SuitableBeach, b: SuitableBeach): number => {
  const aDistance = typeof a.distance === 'number' && Number.isFinite(a.distance) ? a.distance : undefined;
  const bDistance = typeof b.distance === 'number' && Number.isFinite(b.distance) ? b.distance : undefined;

  if (aDistance === undefined || bDistance === undefined) return 0;
  return aDistance - bDistance;
};

export const compareTouristTopPickPriority = (a: SuitableBeach, b: SuitableBeach): number => {
  const popularityDiff = topPickPopularityScore(b.beach) - topPickPopularityScore(a.beach);
  if (Math.abs(popularityDiff) >= 1) return popularityDiff;

  const accessDiff = topPickAccessPriority(a.beach) - topPickAccessPriority(b.beach);
  if (accessDiff !== 0) return accessDiff;

  const distanceDiff = compareOptionalDistance(a, b);
  if (distanceDiff !== 0) return distanceDiff;

  const amenitiesDiff = topPickAmenitiesScore(b.beach) - topPickAmenitiesScore(a.beach);
  if (amenitiesDiff !== 0) return amenitiesDiff;

  return 0;
};

export const hasHardTopPickAccessBlocker = (beach: Beach): boolean => (
  !hasMainstreamTopPickAccess(beach)
);

/**
 * ΠΟΤΕ ΣΤΙΣ ΤΟΠ 3 ΠΑΡΑΛΙΑ ΠΟΥ ΘΕΛΕΙ ΠΛΗΡΩΜΗ ΓΙΑ ΝΑ ΜΠΕΙΣ (Μίλτος, 10/08/2026).
 *
 * A door, not a weight: no amount of shelter buys a place on the podium for a beach you cannot
 * walk onto for free. The flag was already collected and already shown on the card, the map and
 * the beach page — but no ranking file read it, so a paid beach could and did come first.
 *
 * Deliberately narrow: the beach stays on the map, in search, in the guides and in «Υπόλοιπες»,
 * where its card explains why it is not recommended. This removes it from the three slots that
 * answer «πού να πάμε τώρα», nothing else. If a region has only paid beaches its podium is empty,
 * and that is the correct answer rather than a fallback.
 */
export const hasPaidEntryTopPickBlocker = (beach: Beach): boolean => Boolean(
  beach.paidEntry ?? beach.metadata?.paidEntry
);

/**
 * ΣΤΙΣ ΤΟΠ 3 ΜΟΝΟ ΠΑΡΑΛΙΕΣ ΠΟΥ ΣΕ ΠΑΝΕ ΚΑΡΦΩΤΑ ΣΕ PIN (Μίλτος, 11/08/2026).
 *
 * The fourth door. A recommendation whose «Πλοήγηση» button drops the visitor on a coordinate in
 * the middle of a road, or on a Google search for a name that exists in ten places, is not a
 * recommendation — it is a problem handed over at the worst moment, when someone is in a car.
 *
 * Three states fail, all of them for the same reason: we cannot promise the map will land on THIS
 * beach.
 *   · no navigation record at all (830 beaches)
 *   · `mode: 'coordinates'` — set deliberately by the routing audit where a cross-island name
 *     collision made place search risky, so we already know the pin is not ours (254)
 *   · `status` other than 'verified', or verified with no placeId (73)
 *
 * Measured 11/08 over the built dataset: 1.984 of 3.142 records open a real Google place card, and
 * NO region is left with fewer than three of them, which is why this can be a hard door rather
 * than a preference. The beach keeps its place on the map, in search, in the guides and in
 * «Υπόλοιπες» — this removes it only from the three slots that answer «πού να πάμε τώρα».
 */
export const opensGoogleMapsPin = (beach: Beach): boolean => {
  const nav = beach.googleMapsNavigation ?? beach.metadata?.googleMapsNavigation;
  return Boolean(nav && nav.status === 'verified' && nav.placeId && nav.mode !== 'coordinates');
};

/**
 * ΤΟ ΤΟΠ 3 ΘΕΛΕΙ ΠΑΝΩ ΑΠΟ 4,5 ΑΣΤΕΡΙΑ — ΟΤΑΝ ΓΙΝΕΤΑΙ (Μίλτος, 11/08/2026).
 *
 * A PREFERENCE, not a door, and the difference was measured before it was built. Over 3.264
 * region × wind-sector × Beaufort cases, applying >4,5 as a hard filter:
 *
 *   no threshold   92,2% show a full Top 3    3,9% empty
 *   > 4,2          89,2%                      4,9%
 *   > 4,4          82,4%                      6,9%
 *   > 4,5          71,6%                     12,7% empty
 *
 * One podium in eight would go blank, because 4,5 is the national MEDIAN — it cuts half the
 * country, and on a windy day it cuts from a pool that is already small. «Καμία κατάλληλη σήμερα»
 * on a day when a calm 4,4 beach exists is a worse answer than showing it.
 *
 * There is a second reason not to make it a door: the star rating already punishes things this
 * table weighs separately. A beach rated 4,3 for having no parking would be filtered here AND
 * scored down on the facilities axis — the same fact charged twice.
 *
 * So: when three or more well-rated candidates survive every other rule, the podium is only them.
 * Otherwise the preference stands down and the full pool ranks, which keeps the promise wherever
 * it can be kept without ever printing an empty page. Unrated beaches pass — 46 of them clear the
 * other doors, and «no rating» has never meant «bad» anywhere else in this codebase.
 *
 * ─── THE SECOND ROUTE: 4,2 WITH A CROWD BEHIND IT (Μίλτος, 11/08/2026) ─────
 *
 * «Μπορούν να είναι και από 4,2 και πάνω, απλά να έχουν πάνω από 500 κριτικές.» This is the
 * statistically better rule and the data says so plainly: a 4,3 averaged over 13.211 visits is a
 * far surer bet than a 4,7 averaged over eleven, because the second number is mostly noise. Ratings
 * nationally sit between p25 4,3 and p75 4,6, so at low volume a tenth of a star separates nothing.
 *
 * Measured: the clause adds 311 beaches (776 → 1.087) and the names it recovers are the argument —
 * Κανάλι του Έρωτα (4,3 over 13.211 reviews) and Πρέβελη (4,5 over 10.691) were both being held out
 * of every podium by a threshold that could not see how many people had voted. Only 27 busy beaches
 * fall below 4,2 and stay out, which is the rule doing exactly what it should.
 */
export const TOP_PICK_PREFERRED_RATING = 4.5;
/** The second route: this rating, when this many people have voted on it. */
export const TOP_PICK_TRUSTED_RATING = 4.2;
export const TOP_PICK_TRUSTED_REVIEW_COUNT = 500;

const isWellRated = (beach: Beach): boolean => {
  const popularity = beach.popularity ?? beach.metadata?.popularity;
  const rating = popularity?.rating;
  // No rating on record is not a bad rating — same rule as everywhere else in this codebase.
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return true;
  if (rating > TOP_PICK_PREFERRED_RATING) return true;
  const reviews = popularity?.ratingCount;
  return rating >= TOP_PICK_TRUSTED_RATING
    && typeof reviews === 'number'
    && reviews > TOP_PICK_TRUSTED_REVIEW_COUNT;
};

/**
 * ΠΟΣΟΙ ΤΗΝ ΕΧΟΥΝ ΨΗΦΙΣΕΙ — tie-break only (Μίλτος, 11/08/2026).
 *
 * «Αν όλες είναι καλές και ισοδύναμες, βάλε τοπ 3 τις πιο δημοφιλείς, με φθίνουσα σειρά
 * αξιολογήσεων.» Measured on Rhodes the same morning, at 1-2 Bft: 80 of the table's 100 points are
 * identical for all 62 beaches (no wind to shelter from, 0,1 m everywhere, and 0/1/2 Bft share one
 * bucket), and TEN of them then tie at 16,5/20 on the human block — same 5,5 facilities, same 6
 * access, same 5 crowd tier. The podium's three came out of that ten by the legacy region score,
 * which the sort itself documents as "never as a criterion, only to keep the order deterministic".
 * So the visitor was reading «Γιατί αυτές οι τρεις;» above a choice nobody had made.
 *
 * The count is deliberately NOT a weight. Adding fame to the table is the exact defect found on
 * 10/08 — «η ΦΗΜΗ αποφάσιζε» — where recognition floated an orange 5 Bft beach above a blue 3 Bft
 * one. As a tie-break it can only speak after shelter, sea, own-shore wind, the map colour and the
 * whole comfort block have all come out level, which is the only situation Miltos described.
 */
export const topPickReviewCount = (beach: Beach): number => {
  const reviews = (beach.popularity ?? beach.metadata?.popularity)?.ratingCount;
  return typeof reviews === 'number' && Number.isFinite(reviews) && reviews > 0 ? reviews : 0;
};

/** The preference applied: the well-rated subset when it can fill a podium, otherwise everyone. */
export const preferWellRatedTopPicks = (items: SuitableBeach[]): SuitableBeach[] => {
  const wellRated = items.filter(item => isWellRated(item.beach));
  return wellRated.length >= 3 ? wellRated : items;
};

export const isLessExposedTopPickCandidate = (item: SuitableBeach): boolean => {
  const lessExposed = item.exposureLevel === 'protected' || item.exposureLevel === 'partial';
  if (!lessExposed || hasHardTopPickAccessBlocker(item.beach)) return false;

  return Boolean(
    isWindProtectedRecommendation(item) ||
    hasTopPickVisitorServices(item.beach) ||
    hasTouristReadyTopPickProfile(item.beach) ||
    topPickPopularityScore(item.beach) >= 82
  );
};

export const getWindPriorityTopPickPool = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup
): SuitableBeach[] => {
  const poolBeaufort = strongestBeaufortInPool(items, beaufort, perBeachWind);
  if (poolBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT || items.length === 0) return items;

  // A beach whose own shore is calm is not asked to prove it is sheltered — there is nothing
  // to be sheltered from there today, whatever the rest of the region is doing.
  const lessExposed = items.filter(item => (
    beachOwnBeaufort(item, beaufort, perBeachWind) < MEANINGFUL_WIND_TOP_PICK_BEAUFORT ||
    isLessExposedTopPickCandidate(item)
  ));
  return lessExposed.length > 0 ? lessExposed : items;
};

/**
 * ΤΟ ΦΙΛΤΡΟ ΤΡΕΧΕΙ ΑΠΟ 5 ΜΠΟΦΟΡ, ΟΧΙ ΑΠΟ 3 (14/08/2026) — και ο λόγος είναι μετρημένος.
 *
 * Αυτή η συνάρτηση δεν ταξινομεί: **πετάει έξω**. Κρατάει μόνο την κορυφαία βαθμίδα προστασίας,
 * οπότε μία και μόνη «προστατευμένη» αδειάζει το βάθρο από κάθε «μερική» — ακόμη κι όταν αυτές
 * είναι δεκάδες και μια χαρά. Αυτό ήταν το «Top 1 στην Ανατολική Αττική» (Μίλτος, 14/08): ένα
 * βάθρο με μία επιλογή δίπλα σε χάρτη με έντεκα καλές παραλίες.
 *
 * ΓΙΑΤΙ ΤΟ 3 ΗΤΑΝ ΛΑΘΟΣ ΟΡΙΟ. Με το ίδιο μας το μοντέλο κύματος
 * (utils/waveModel.estimateFetchLimitedWaveHeightM), η διαφορά ανάμεσα σε μια προστατευμένη ακτή
 * (fetch ~0,5 χλμ) και μια ανοιχτή «μερική» (fetch ~8 χλμ) είναι:
 *
 *   3 Μποφ. → 0,07 μ. vs 0,20 μ.  =  **0,13 μ.**
 *   4 Μποφ. → 0,12 μ. vs 0,36 μ.  =  **0,24 μ.**
 *   5 Μποφ. → 0,17 μ. vs 0,53 μ.  =  **0,36 μ.**
 *
 * Και το `PODIUM_SEA_MEANINGFUL_DIFFERENCE_M` ακριβώς από πάνω λέει, με τα δικά του λόγια, ότι
 * κάτω από **0,25 μ.** «the model is not measuring a difference, and a podium that reorders there
 * is publishing noise». Στα 3 και στα 4 Μποφ. η διαφορά είναι μέσα σε αυτό το σφάλμα — δηλαδή
 * πετούσαμε παραλίες έξω από το βάθρο για διαφορά που δεν μπορούμε να μετρήσουμε. Στα 5 βγαίνει
 * έξω από το σφάλμα και η προστασία αρχίζει να σημαίνει κάτι.
 *
 * ΤΟ ΟΡΙΟ ΔΕΝ ΕΙΝΑΙ ΚΑΙΝΟΥΡΓΙΟ: το `PROTECTED_FIRST_BEAUFORT = 5` υπάρχει ήδη σε αυτό το αρχείο
 * και το `scripts/measureRegionWindGating.mjs` τυπώνει εδώ και καιρό «≥5 Bft — PODIUM: exposure
 * outranks score». Η τεκμηρίωση έλεγε 5, ο φραγμός έτρεχε στο 3.
 *
 * ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Η **σειρά** μένει στο `MEANINGFUL_WIND_TOP_PICK_BEAUFORT` (3): από 3 Μποφ. μια
 * προστατευμένη εξακολουθεί να κατατάσσεται ΠΑΝΩ από μια μερική (prioritizeProtectedRecommendations).
 * Άρα στα 3-4 Μποφ. το βάθρο δεν γίνεται πιο επιεικές — γεμίζει, με τις προστατευμένες μπροστά
 * και τις μερικές να παίρνουν τις θέσεις που αλλιώς έμεναν κενές. Καμία αλλαγή σε χρώμα, σε
 * ετυμηγορία κολύμβησης ή σε οποιαδήποτε πύλη ασφαλείας.
 */
export const bestShelteredRecommendationGroup = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup,
  toneRank?: PodiumToneRank
): SuitableBeach[] => {
  const poolBeaufort = strongestBeaufortInPool(items, beaufort, perBeachWind);
  if (poolBeaufort < PROTECTED_FIRST_BEAUFORT || items.length === 0) return items;

  /**
   * ΟΤΑΝ Ο ΧΑΡΤΗΣ ΕΧΕΙ ΗΔΗ ΑΠΑΝΤΗΣΕΙ «ΙΔΑΝΙΚΗ», Ο ΦΡΑΓΜΟΣ ΒΑΘΜΙΔΑΣ ΔΕΝ ΕΧΕΙ ΤΙ ΝΑ ΠΡΟΣΘΕΣΕΙ
   * (Μίλτος, 15/08/2026 — «Νάξος, αύριο 8πμ: Top 1 ενώ ο χάρτης δείχνει 3 μπλε»).
   *
   * ΤΟ ΠΡΟΒΛΗΜΑ. Στα 5 Μποφ. ο φραγμός από κάτω κρατά μόνο την κορυφαία ΒΑΘΜΙΔΑ ΕΚΘΕΣΗΣ, δηλαδή
   * κρίνει με το ΣΧΗΜΑ της παραλίας. Το χρώμα της πινέζας δεν είναι το σχήμα: μια πινέζα είναι
   * μπλε για ΤΡΕΙΣ λόγους μαζί — έκθεση + ο άνεμος σε ΑΥΤΗ την ακτή + η κατάσταση της θάλασσας
   * (το ίδιο τριπλό που περιγράφεται 60 γραμμές πιο κάτω, στο compareTone). Άρα ο φραγμός
   * πετούσε έξω παραλίες για τις οποίες το ίδιο μας το μοντέλο είχε ήδη απαντήσει, με ΠΕΡΙΣΣΟΤΕΡΑ
   * δεδομένα, ότι σήμερα εκεί το νερό είναι ήρεμο. Ένα βάθρο με μία κάρτα, 400 px κάτω από μια
   * λεζάντα που έλεγε «Ιδανικές 3 παραλίες».
   *
   * Ο ΚΑΝΟΝΑΣ. Αν υπάρχει έστω μία παραλία στην κορυφαία ΧΡΩΜΑΤΙΚΗ βαθμίδα (ΙΔΑΝΙΚΗ, rank 0), η
   * ομάδα του βάθρου είναι ακριβώς αυτές. Ο φραγμός βαθμίδας μιλάει μόνο όταν το χρώμα δεν έχει
   * μιλήσει — καμία ΙΔΑΝΙΚΗ πουθενά, ή καμία πινέζα δεν έχει βαφτεί ακόμη (σχεδιαστής ταξιδιού,
   * prerender, πρώτο frame), όπου αυτό είναι σιωπηλό και η προηγούμενη συμπεριφορά μένει ακέραιη.
   *
   * ΓΙΑΤΙ ΕΙΝΑΙ ΣΕ ΑΡΜΟΝΙΑ ΜΕ ΤΗ ΒΙΒΛΟ (PORISMA §Γ8, §Γ6, §7ε/§7στ):
   *
   *   · ΔΕΝ δίνει εξουσία στο `partial`. Το μάθημα του §Γ6 είναι ότι το «μερική» έχει recall 0%
   *     και σημαίνει «δεν ξέρουμε» — γι' αυτό το εισιτήριο ΔΕΝ είναι «είναι μερική», είναι «ο
   *     χάρτης τη μέτρησε ΙΔΑΝΙΚΗ σήμερα, σε αυτή την ακτή». Σήμα με μετρημένο περιεχόμενο, όχι
   *     βαθμίδα χωρίς recall. «Πρώτα μετράς αν το σήμα ξεχωρίζει κάτι, μετά του δίνεις εξουσία.»
   *   · ΣΥΜΦΩΝΕΙ με το §Γ8. Εκείνο κράτησε τον φραγμό στα ≥5 Μποφ. επειδή εκεί η διαφορά
   *     προστατευμένης/μερικής (0,36 μ.) ξεπερνά το σφάλμα του μοντέλου (0,25 μ.). Ο υπολογισμός
   *     όμως υποθέτει «μερική ΑΝΟΙΧΤΗ» με fetch ~8 χλμ, ενώ το §Γ6 μέτρησε ότι το 38% των τομέων
   *     «μερική» έχει fetch <2 χλμ. Το μπλε είναι ακριβώς ο τρόπος να ξεχωρίσεις τις δεύτερες:
   *     δεν ξαναϋπολογίζει τίποτα εδώ — διαβάζει την απάντηση που έχει ήδη δοθεί.
   *   · ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΔΟΓΜΑ με το §7ε/§7στ, που έβαλε το χρώμα να κρίνει πάνω από τη φήμη. Εκεί
   *     το χρώμα ταξινομούσε· εδώ ξεκλειδώνει. Ίδια πηγή (`mapBeachTones`), μία απάντηση.
   *   · ΔΕΝ ΕΙΝΑΙ ΧΑΛΑΡΩΣΗ ΑΣΦΑΛΕΙΑΣ. Καμία πύλη δεν παρακάμπτεται: όποια μπαίνει έχει ήδη
   *     περάσει το `passesTopPickSeaGate` (hourlySeaScore ≥7), το
   *     `isTrustedTopRecommendationCandidate`, τις πόρτες πληρωμής/πλοήγησης και το
   *     `getWindPriorityTopPickPool` (καμία `exposed` δεν φτάνει ως εδώ στα ≥3 Μποφ.). Και προς
   *     την άλλη κατεύθυνση ο κανόνας είναι ΑΥΣΤΗΡΟΤΕΡΟΣ από πριν: μια ΚΙΤΡΙΝΗ προστατευμένη
   *     έβγαινε #1 ενώ δίπλα της υπήρχαν μπλε — τώρα βγαίνει από την ομάδα. Χρώμα, ετυμηγορία
   *     κολύμβησης και κύμα δεν αγγίζονται πουθενά.
   *   · ΚΡΑΤΑΕΙ ΤΗ ΣΕΙΡΑ ΤΟΥ §Γ8. Μέσα στην ομάδα των ΙΔΑΝΙΚΩΝ, η προστατευμένη εξακολουθεί να
   *     κατατάσσεται πάνω από τη μερική (`profileRank` στο prioritizeProtectedRecommendations) —
   *     απλώς τώρα η μερική παίρνει τη θέση που έμενε κενή, αντί να χάνεται.
   */
  const tierGroup = (pool: SuitableBeach[]): SuitableBeach[] => {
    if (pool.length === 0) return pool;
    const bestPriority = Math.min(...pool.map(topPickProfilePriority));
    return pool.filter(item => (
      beachOwnBeaufort(item, beaufort, perBeachWind) < MEANINGFUL_WIND_TOP_PICK_BEAUFORT ||
      topPickProfilePriority(item) === bestPriority
    ));
  };

  const idealByMap = toneRank ? items.filter(item => toneRank(item.beach.id) === 0) : [];
  if (idealByMap.length === 0) return tierGroup(items);
  if (idealByMap.length >= TOP_PICK_PODIUM_SEATS) return idealByMap;

  /**
   * ΜΙΑ ΜΠΛΕ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΑΔΕΙΑΣΕΙ ΤΟ ΒΑΘΡΟ — ΤΟ §Γ8 ΞΑΝΑ, ΜΕ ΑΛΛΟ ΠΑΛΤΟ (15/08/2026).
   *
   * Η ΑΝΑΦΟΡΑ: «να μην είναι ποτέ 1 επιλογή τοπ, ειδικά ανάμεσα σε πολλές κατάλληλες». Λεζάντα
   * «Ιδανική 1 · Καλές 13 · Μέτριες 32» και από κάτω βάθρο με **μία** κάρτα.
   *
   * ΤΟ ΛΑΘΟΣ ΗΤΑΝ ΔΙΚΟ ΜΑΣ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΠΟΥ ΕΙΧΕ ΗΔΗ ΚΛΕΙΣΕΙ. Το §Γ8 (14/08) το γράφει
   * με τα ίδια λόγια για τη ΒΑΘΜΙΔΑ: *«Αυτή η συνάρτηση δεν ταξινομεί: πετάει έξω. Κρατάει μόνο
   * την κορυφαία βαθμίδα, οπότε μία και μόνη "προστατευμένη" αδειάζει το βάθρο από κάθε
   * "μερική"»*. Το §Γ9 (15/08) έλυσε εκείνο και **ξαναέφτιαξε το ίδιο σχήμα με το ΧΡΩΜΑ**: το
   * `return idealByMap` κρατάει μόνο την κορυφαία χρωματική βαθμίδα, οπότε **μία και μόνη μπλε
   * αδειάζει το βάθρο από κάθε κίτρινη**. Δεύτερη φορά σε δύο μέρες που ένα φίλτρο κόβει αντί
   * να ταξινομεί.
   *
   * ΓΙΑΤΙ ΤΟ ΦΙΛΤΡΟ ΔΕΝ ΠΡΟΣΘΕΤΕ ΤΙΠΟΤΑ. Το ίδιο το §Γ9 έβαλε το χρώμα να ταξινομεί ΠΡΩΤΟ
   * (`compareTone`, πριν από `profileRank` και από τον πίνακα). Άρα οι μπλε βγαίνουν μπροστά
   * **ούτως ή άλλως** — το φίλτρο δεν αλλάζει σειρά, μόνο αδειάζει θέσεις. Ακριβώς το επιχείρημα
   * του §Γ9 για τη βαθμίδα, γυρισμένο στο ίδιο του το φίλτρο: *«ο φραγμός μιλάει μόνο όταν το
   * χρώμα δεν έχει μιλήσει»* — εδώ το χρώμα έχει ήδη μιλήσει, στη σειρά.
   *
   * Ο ΚΑΝΟΝΑΣ: οι μπλε κρατούν τις θέσεις τους, και οι **κενές** θέσεις γεμίζουν από την
   * επόμενη ομάδα — που περνάει κανονικά τον φραγμό βαθμίδας του §Γ8, άρα καμία χαλάρωση
   * ασφαλείας. Καμία μπλε δεν χάνει θέση από κίτρινη: το `compareTone` το εγγυάται.
   *
   * ΔΕΝ ΑΝΑΙΡΕΙ ΤΗΝ ΑΠΟΦΑΣΗ ΤΗΣ 14/08 («το βάθρο με μία κάρτα μένει»). Εκεί η μονή κάρτα ήταν
   * ό,τι είχε **πραγματικά** το νησί σε μέρα μελτεμιού. Εδώ δεκατρείς ΚΑΛΕΣ κάθονταν δίπλα και
   * αποκλείονταν από φίλτρο, όχι από τον καιρό. Μονή κάρτα μόνο όταν δεν υπάρχει δεύτερη.
   */
  const idealIds = new Set(idealByMap.map(item => item.beach.id));
  return [...idealByMap, ...tierGroup(items.filter(item => !idealIds.has(item.beach.id)))];
};

/**
 * The rank of the colour the MAP painted this beach (0 = ΙΔΑΝΙΚΗ … 3 = ΔΥΣΚΟΛΗ), or undefined
 * when no pin has reported one yet. Supplied by the caller, never derived here: App.tsx is
 * forbidden from resolving a condition tone (validateConditionToneAgreement), and this module
 * knows nothing about sea state — the whole point is that both surfaces read ONE answer.
 */
export type PodiumToneRank = (beachId: number) => number | undefined;

export const prioritizeProtectedRecommendations = (
  items: SuitableBeach[],
  beaufort: number,
  perBeachWind?: PerBeachWindLookup,
  toneRank?: PodiumToneRank
): SuitableBeach[] => {
  /**
   * Η ΠΛΗΡΩΜΗ ΕΙΝΑΙ ΠΟΡΤΑ. Η ΠΙΝΕΖΑ GOOGLE ΕΓΙΝΕ ΠΡΟΤΙΜΗΣΗ (Μίλτος, 15/08/2026).
   *
   * Η ΑΝΑΦΟΡΑ: βάθρο με **μία** κάρτα δίπλα σε «Υπόλοιπες (14)». Μετρημένο στην Ανατολική
   * Αττική: από τις **59** παραλίες μόνο **8** μπορούσαν ποτέ να μπουν στο βάθρο, και **23**
   * κόβονταν **αποκλειστικά** επειδή δεν έχουμε επιβεβαιωμένο Google placeId. Από τις 8, μία
   * μόνο είχε καλό χρώμα εκείνη την ώρα.
   *
   * ΓΙΑΤΙ Η ΑΙΤΙΟΛΟΓΗΣΗ ΤΗΣ 11/08 ΕΠΑΨΕ ΝΑ ΙΣΧΥΕΙ. Είχε γραφτεί ρητά: *«NO region is left with
   * fewer than three of them, which is why this can be a hard door rather than a preference»*.
   * Αυτό μετρήθηκε για την πόρτα **μόνη της**. Από τότε στοιβάχτηκαν από πάνω της άλλες τρεις —
   * επιβεβαιωμένα στοιχεία, δύσβατη πρόσβαση, και (15/08) ο χρωματικός περιορισμός του §Γ10.
   * Η τομή τους δεν μετρήθηκε ποτέ, και είναι αυτή που αδειάζει το βάθρο. **Μια πόρτα που
   * δικαιολογήθηκε μόνη της δεν είναι δικαιολογημένη μέσα σε στοίβα.**
   *
   * Ο ΚΑΝΟΝΑΣ: όσες ανοίγουν πινέζα μπαίνουν **πρώτες**· οι υπόλοιπες μπαίνουν **μόνο** για να
   * γεμίσουν θέσεις που αλλιώς θα έμεναν άδειες. Όταν οι πινεζωμένες φτάνουν να γεμίσουν το
   * βάθρο, η συμπεριφορά είναι **byte-identical** με πριν — δηλαδή σε κάθε περιοχή που η
   * μέτρηση της 11/08 περιέγραφε, τίποτα δεν αλλάζει.
   *
   * ΜΕΣΑ στο βάθρο κατατάσσει ο ΚΑΙΡΟΣ, όχι η πινέζα: μια μπλε χωρίς πινέζα δικαίως προηγείται
   * μιας κίτρινης με πινέζα (§Γ9, §7ε/§7στ — το χρώμα είναι απόδειξη). Η πινέζα μπαίνει χαμηλά
   * στον συγκριτή, ως ισοπαλία, ώστε ανάμεσα σε ίσες να ηγείται αυτή που πάει τον επισκέπτη
   * καρφωτά. Το «Οδηγίες» των υπολοίπων δείχνει το **δικό μας διορθωμένο σημείο** — το ίδιο που
   * πέρασε από τον πανελλαδικό έλεγχο πινέζας.
   *
   * Η ΠΛΗΡΩΜΗ ΔΕΝ ΑΓΓΙΖΕΤΑΙ: παραμένει σκληρή πόρτα, γιατί δεν είναι έλλειψη δεδομένων — είναι
   * ιδιότητα της παραλίας που ο επισκέπτης θα πληρώσει.
   */
  const affordable = items.filter(item => !hasPaidEntryTopPickBlocker(item.beach));
  const pinned = affordable.filter(item => opensGoogleMapsPin(item.beach));
  const recommendable = pinned.length >= TOP_PICK_PODIUM_SEATS
    ? pinned
    : [...pinned, ...affordable.filter(item => !opensGoogleMapsPin(item.beach))];
  // The rating preference runs AFTER the weather has narrowed the pool, never before: filtering on
  // stars first could leave three well-rated but exposed beaches and drop the sheltered ones the
  // podium exists to find.
  const candidates = preferWellRatedTopPicks(
    bestShelteredRecommendationGroup(recommendable, beaufort, perBeachWind, toneRank)
  );
  const poolBeaufort = strongestBeaufortInPool(candidates, beaufort, perBeachWind);
  // Wind-aware ranks. When the pool is windy somewhere, a beach whose OWN shore is calm is
  // ranked as if it had the pool's best shelter — it is neither rewarded for geometry it does
  // not need today nor punished for exposure to a wind that is not reaching it. Below
  // meaningful wind everywhere, the ranks are the plain ones, so calm days are untouched.
  const poolIsWindy = poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT;
  const bestProfile = candidates.length > 0 ? Math.min(...candidates.map(topPickProfilePriority)) : 0;
  const feelsWind = (item: SuitableBeach): boolean => (
    !poolIsWindy || beachOwnBeaufort(item, beaufort, perBeachWind) >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
  );
  /**
   * The same question the ranks ask, but phrased for the weighted table, and NOT the same answer.
   *
   * `feelsWind` returns true on a calm day (`!poolIsWindy`) because the LADDER only ever consulted
   * it inside the windy branches — below 3 Bft nothing above ran at all. The table has no branches:
   * it scores every beach every day. Feeding it `feelsWind` therefore charged 30 points of shelter
   * on a 1 Bft morning, demoting an exposed beach for a wind that was not blowing anywhere — the
   * exact inversion of the rule this project has held since 02/08. Caught by
   * validatePerBeachWindGates on the calm-day fixture.
   *
   * So: on a calm day nobody feels the wind and shelter cannot separate anyone. When the pool is
   * windy, the per-beach answer decides, exactly as the ranks do.
   */
  const shelterCounts = (item: SuitableBeach): boolean => (
    poolIsWindy && beachOwnBeaufort(item, beaufort, perBeachWind) >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
  );
  const profileRank = (item: SuitableBeach): number => (feelsWind(item) ? topPickProfilePriority(item) : bestProfile);

  /**
   * THE COLOUR THE MAP PAINTED IS EVIDENCE, AND IT RANKS BEFORE FAME (10/08/2026).
   *
   * Found by Miltos on the Attica coast: «πώς βγάζεις top 3 πιο προστατευμένες κάποιες κίτρινες
   * ενώ έχεις και μπλε;». Measured the same afternoon against the live forecast
   * (.tmp/reproAttica.mjs + a real browser in «Κοντά μου»):
   *
   *   Βοτσαλάκια, Φρεαττύδος, Καλαμπάκα, Κράκαρης — ΜΠΛΕ pins, protected, 3 Bft on their own shore
   *   Αστέρα Γλυφάδας, Μεγάλο Καβούρι            — ΚΙΤΡΙΝΑ pins, protected, 4 Bft
   *
   * All six are `protected`, so the exposure tier tied and `compareTouristTopPickPriority` — fame,
   * access, amenities — decided the podium. The two famous yellow ones led; the calmest blue beach
   * in the set came third. The exposure tier cannot see the difference, because a pin is blue for
   * THREE reasons (exposure + the wind on that shore + the sea state) and this sort was reading
   * only the first.
   *
   * So the ranking now reads the tone itself, from the same table the map and the «Υπόλοιπες» list
   * already share (App's `mapBeachTones`) — not a second opinion computed here. One piece of
   * evidence, one answer, exactly the rule that closed the same class of bug on 08/08 and this
   * morning.
   *
   * Silent by construction where it should be: no tone table (planner, prerender, first paint) or
   * either beach unpainted → the tier ties and the previous order stands, untouched.
   */
  const toneOf = (item: SuitableBeach): number | undefined => (toneRank ? toneRank(item.beach.id) : undefined);
  const compareTone = (a: SuitableBeach, b: SuitableBeach): number => {
    const aTone = toneOf(a);
    const bTone = toneOf(b);
    if (typeof aTone !== 'number' || typeof bTone !== 'number') return 0;
    return aTone - bTone;
  };

  /**
   * Ο ΠΙΝΑΚΑΣ ΤΩΝ 100 (Μίλτος, 10/08/2026) — the podium is now the first three rows of one
   * weighted score, not the first three survivors of a ladder.
   *
   * The table itself lives in utils/topPickScoreTable.ts with its weights and its reasoning; this
   * function only feeds it the four things it cannot resolve on its own (the wind on that shore,
   * whether the shore feels the wind at all, and the two comfort priorities) and then sorts.
   *
   * TWO THINGS SURVIVE THE REWRITE, AND THEY ARE NOT DECORATION:
   *
   *   1. THE COLOUR THE MAP PAINTED STILL COMES FIRST. Not as a weight — it would double-count the
   *      very three axes the table already scores (shelter + own-shore wind + sea) — but as an
   *      ordering above the score. This project spent 10/08 making the podium, the «Υπόλοιπες»
   *      list and the legend agree; a sum that can place a yellow pin above a blue one re-opens
   *      exactly that wound, and the reader sees it instantly because both are on the same screen.
   *      Within a colour, the score decides everything. Where no pin has reported a tone (planner,
   *      prerender, first paint) this is silent and the score decides outright.
   *   2. THE PROFILE FLOOR. bestShelteredRecommendationGroup already narrowed the pool; the
   *      profile rank stays above the score so a tourist-unready beach cannot buy its way up.
   *
   * The old ladder's remaining rungs are gone: exposure, own-shore wind, sea and comfort are now
   * points, and `compareTouristTopPickPriority` no longer runs here at all — which is the whole
   * point, since it was two points of parking that ordered the East Attica podium on 10/08.
   *
   * AND `item.distance` IS NOT READ HERE, ON PURPOSE (Μίλτος, 11/08/2026: «ίδιος καιρός, ίδιο
   * podium για όλους»). The table briefly carried a 10-point distance axis; the wiring said it had
   * never once run, because the pool this function is normally given is fetched with no location at
   * all — and the one path that did feed it (an active preference filter swaps in the
   * location-scored pool) simply reordered the cards under the visitor a second after the location
   * prompt was answered. The axis was deleted rather than left neutral, and its points went to
   * facilities and access. Distance is a «Κοντά μου» rule and is applied there, after this chain,
   * on a screen the visitor asked for. If a `distanceKm` argument ever reappears in the call below,
   * assertion H of validateTopPickScoreTable.mjs is the thing that will go red.
   */
  const scoreOf = (item: SuitableBeach): number => scoreTopPick({
    item,
    ownBeaufort: beachOwnBeaufort(item, beaufort, perBeachWind),
    feelsWind: shelterCounts(item),
    accessPriority: topPickAccessPriority(item.beach),
    amenitiesScore: topPickAmenitiesScore(item.beach),
  }).total;

  const scores = new Map<SuitableBeach, number>();
  for (const item of candidates) scores.set(item, scoreOf(item));

  return [...candidates].sort((a, b) => {
    /**
     * ΤΟ ΧΡΩΜΑ ΠΡΙΝ ΑΠΟ ΤΗ ΒΑΘΜΙΔΑ ΕΚΘΕΣΗΣ — Η ΔΕΥΤΕΡΗ ΜΙΣΗ ΤΗΣ ΙΔΙΑΣ ΔΙΟΡΘΩΣΗΣ (15/08/2026).
     *
     * Οι δύο αυτές γραμμές ήταν ανάποδα, και μέχρι τις 14/08 δεν φαινόταν: ο φραγμός βαθμίδας
     * έτρεχε από 3 Μποφ. και ΙΣΟΠΕΔΩΝΕ τα profiles, οπότε το `profileDiff` έβγαινε πάντα 0 και
     * το χρώμα αποφάσιζε ούτως ή άλλως. Το §Γ8 ανέβασε τον φραγμό στα 5, η δεξαμενή των 3-4
     * Μποφ. έγινε μεικτή — και το `profileDiff` ξύπνησε πάνω από το χρώμα. Μετρημένο στο σχήμα
     * της Νάξου: στα 3 και 4 Μποφ. μια ΚΙΤΡΙΝΗ προστατευμένη έβγαινε #2, πάνω από δύο ΜΠΛΕ.
     * Είναι λέξη προς λέξη το εύρημα της 10/08 («πώς βγάζεις top 3 πιο προστατευμένες κάποιες
     * κίτρινες ενώ έχεις και μπλε;»), που είχε κλείσει και ξανάνοιξε από την πλαϊνή πόρτα.
     *
     * Η ΒΙΒΛΟΣ ΤΟ ΕΧΕΙ ΗΔΗ ΑΠΑΝΤΗΣΕΙ (§7στ Α): η βαθμίδα έκθεσης «cannot see the difference,
     * because a pin is blue for THREE reasons — exposure + the wind on that shore + the sea
     * state — and this sort was reading only the first». Η βαθμίδα είναι ΕΝΑΣ από τους τρεις
     * λόγους του χρώματος· δεν έχει λόγο να κρίνει από πάνω του.
     *
     * ΚΑΙ Η ΣΕΙΡΑ ΤΟΥ §Γ8 ΔΕΝ ΘΙΓΕΤΑΙ: «προστατευμένη πάνω από μερική από 3 Μποφ.» ισχύει
     * ακέραιη ΜΕΣΑ στο ίδιο χρώμα, που είναι και η μόνη σύγκριση όπου η βαθμίδα ξέρει κάτι που
     * το χρώμα δεν ξέρει ήδη. Χωρίς πίνακα χρωμάτων (σχεδιαστής, prerender, πρώτο frame) το
     * `compareTone` επιστρέφει 0 και η σειρά είναι byte-identical με πριν.
     */
    const toneDiff = compareTone(a, b);
    if (toneDiff !== 0) return toneDiff;

    const profileDiff = profileRank(a) - profileRank(b);
    if (poolBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && profileDiff !== 0) return profileDiff;

    const tableDiff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    if (tableDiff !== 0) return tableDiff;

    /**
     * ΑΝΑΜΕΣΑ ΣΕ ΙΣΕΣ, ΗΓΕΙΤΑΙ ΑΥΤΗ ΠΟΥ ΣΕ ΠΑΕΙ ΚΑΡΦΩΤΑ (15/08/2026).
     *
     * Από σήμερα η πινέζα Google δεν είναι πόρτα αλλά προτίμηση εισόδου (βλ. `recommendable` πιο
     * πάνω), οπότε μια παραλία χωρίς επιβεβαιωμένο placeId μπορεί να πάρει θέση που αλλιώς θα
     * έμενε άδεια. Όταν όμως ο καιρός έχει πει ό,τι είχε να πει και δύο παραλίες είναι ίσες, το
     * #1 πάει σε αυτή που ανοίγει καρτέλα τόπου: το «Οδηγίες» της είναι το ασφαλέστερο.
     *
     * Κάθεται ΕΔΩ και όχι ψηλότερα επειδή είναι σήμα για τα **δικά μας αρχεία**, όχι για τη
     * θάλασσα. Πάνω από το χρώμα θα άφηνε μια κίτρινη με πινέζα να προσπεράσει μια μπλε χωρίς —
     * ακριβώς το λάθος που το §Γ9 διόρθωσε για τη φήμη.
     */
    const pinDiff = Number(opensGoogleMapsPin(b.beach)) - Number(opensGoogleMapsPin(a.beach));
    if (pinDiff !== 0) return pinDiff;

    /**
     * A GENUINE TIE — AND NOW SOMEBODY DECIDES IT (Μίλτος, 11/08/2026).
     *
     * Every axis landed in the same bucket, so the evidence we hold cannot separate these beaches.
     * Until today the region score broke it "only to keep the sort deterministic, never as a
     * criterion" — which is an honest thing to write and a poor thing to publish: on a calm day in
     * Rhodes that meant three beaches out of ten identical ones, under a heading asking why those
     * three.
     *
     * The count of Google reviews is the tie-break because it is the only signal we hold that is
     * about the BEACH rather than about today, and because it answers the visitor's real fear on a
     * day when everything is fine: not "which is best" but "which won't disappoint me". The same
     * measurement that made the crowd axis positive says so — 5% of crowded beaches sit below 4,3
     * stars against 33% of the secluded ones.
     *
     * Beaches Google has never heard of score 0 here and therefore lose every tie. That is the one
     * real cost, it is deliberate, and it is bounded: it can only ever apply when a beach is
     * otherwise INDISTINGUISHABLE from a famous one, and the whole «Ήσυχη / Λίγο γνωστή» filter
     * exists so that the quiet coastline is found on purpose rather than by accident of a tie.
     */
    const reviewsDiff = topPickReviewCount(b.beach) - topPickReviewCount(a.beach);
    if (reviewsDiff !== 0) return reviewsDiff;

    return b.score - a.score;
  });
};

/**
 * The podium's SEA gate, one implementation for both surfaces: exactly the
 * filter body the homepage applies to its candidates (formerly inline in
 * App.tsx's recommendedSuitableBeaches memo). A beach that fails this is one
 * the podium refuses to show — and the planner must refuse to plan.
 */
export const passesTopPickSeaGate = (
  item: Pick<SuitableBeach, 'isExposed' | 'exposureLevel' | 'waveHeightM' | 'seaStateWaveM' | 'seaStatePeriodS' | 'hourlySeaScore'>,
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): boolean => {
  // Decision-grade sea state, not the cove-guard display value, and with the period so steep
  // chop is not mistaken for the same height of long-period roll.
  const itemWaveHeightM = item.seaStateWaveM ?? item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM, false, item.seaStatePeriodS);
  const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;

  return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
    hasGoodHourlySea &&
    !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM, item.seaStatePeriodS);
};
