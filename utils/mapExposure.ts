import type { Beach, SuitableBeach, WindProfile, WindProfileSource, WindSector } from '../types';
import { WindDirection } from '../types';
import { areInSameShorelineSegment } from './shorelineSegments';
import { calculateDistance } from './weatherUtils';
import {
  calculateWindExposure,
  estimateBeachOrientation,
  windSectorFromDegrees,
  WIND_SECTORS,
  type ExposureLevel,
} from './windExposure';

const windSectors = WIND_SECTORS;

const windSectorToDirection: Record<WindSector, WindDirection> = {
  N: WindDirection.N,
  NE: WindDirection.NE,
  E: WindDirection.E,
  SE: WindDirection.SE,
  S: WindDirection.S,
  SW: WindDirection.SW,
  W: WindDirection.W,
  NW: WindDirection.NW,
};

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;
const ADJACENT_BEACH_MAX_DISTANCE_KM = 0.65;
const SIMILAR_BEACH_FRONT_MAX_DEGREES = 45;

/**
 * The bucketing itself now lives in utils/windExposure, shared with the engine — this wrapper
 * only adds the "no reading, no sector" case the map needs and the engine does not.
 */
const getWindSectorFromDegrees = (degrees?: number): WindSector | undefined => {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return undefined;
  return windSectorFromDegrees(degrees);
};

// Wind-exposure colours are always available; the map tone is decided by the
// current Beaufort band in BeachMap. Kept as a function for call-site compatibility.
export const shouldShowWindExposureColors = (_windBeaufort?: number): boolean => true;

type MapExposureItem = Pick<
  SuitableBeach,
  'exposureLevel' | 'geospatialExposure' | 'orientation' | 'windProfile' | 'windProfileSource' | 'windSector' | 'warnings'
> & {
  beach: Pick<Beach, 'id' | 'coordinates' | 'protectedFrom'>;
};

const hasAuthoritativeWindProfileSource = (source?: WindProfileSource): boolean => (
  source === 'override' || source === 'beach' || source === 'metadata' || source === 'geospatial'
);

const canUseMapWindProfile = (
  profile?: WindProfile,
  source?: WindProfileSource
): profile is WindProfile => (
  hasUsableWindProfile(profile) &&
  (
    hasAuthoritativeWindProfileSource(source) ||
    // Some UI paths pass already-scored beach items where the resolved profile is
    // present but the source field is omitted. Still use the profile so explicit
    // wind-sport/open-exposure warnings are not lost in the map path.
    source === undefined
  )
);

const hasUsableWindProfile = (profile?: WindProfile): profile is WindProfile => Boolean(
  profile &&
  (
    profile.knownWindSportSpot ||
    profile.exposedToWindDirections.length > 0 ||
    profile.protectedFromWindDirections.length > 0 ||
    profile.shelterLevel !== 'unknown' ||
    profile.fetchExposure !== 'unknown' ||
    typeof profile.beachFacingDirection === 'number'
  )
);

const canWindProfileClaimProtected = (
  profile: WindProfile,
  sector?: WindSector
): boolean => Boolean(
  sector &&
  profile.confidence !== 'low' &&
  !profile.knownWindSportSpot &&
  (profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered') &&
  profile.protectedFromWindDirections.includes(sector)
);

const exposureFromWindProfile = (
  profile: WindProfile,
  sector?: WindSector,
  windBeaufort = 0,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  if (profile.knownWindSportSpot && windBeaufort >= 4) return 'exposed';
  if (sector && profile.exposedToWindDirections.includes(sector)) return 'exposed';
  if (canWindProfileClaimProtected(profile, sector)) return 'protected';

  if (
    typeof profile.beachFacingDirection === 'number' &&
    Number.isFinite(profile.beachFacingDirection) &&
    typeof windDirectionDeg === 'number' &&
    Number.isFinite(windDirectionDeg)
  ) {
    const angularExposure = calculateWindExposure(profile.beachFacingDirection, windDirectionDeg).exposureLevel;
    return angularExposure === 'protected' && !canWindProfileClaimProtected(profile, sector)
      ? 'partial'
      : angularExposure;
  }

  if (profile.shelterLevel === 'open') return 'exposed';
  if (profile.shelterLevel === 'semi_sheltered') return 'partial';
  if (profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered') return 'partial';
  if (profile.fetchExposure === 'high') return 'exposed';
  if (profile.fetchExposure === 'medium' || profile.fetchExposure === 'low') return 'partial';

  return undefined;
};

const exposureFromHighPriorityWindProfile = (
  profile: WindProfile,
  sector?: WindSector,
  windBeaufort = 0,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  if (profile.knownWindSportSpot && windBeaufort >= 4) return 'exposed';
  if (sector && profile.exposedToWindDirections.includes(sector)) return 'exposed';
  if (profile.confidence !== 'low') {
    return exposureFromWindProfile(profile, sector, windBeaufort, windDirectionDeg);
  }

  return undefined;
};

const exposureFromExplicitOrientation = (
  orientation?: number | null,
  windDirectionDeg?: number
): ExposureLevel | undefined => (
  typeof orientation === 'number' &&
  Number.isFinite(orientation) &&
  typeof windDirectionDeg === 'number' &&
  Number.isFinite(windDirectionDeg)
    ? calculateWindExposure(orientation, windDirectionDeg).exposureLevel
    : undefined
);

const exposureFromLegacyProtectedFrom = (
  protectedFrom: WindDirection[] | undefined,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  const legacyOrientation = estimateBeachOrientation(protectedFrom || []);
  return exposureFromExplicitOrientation(legacyOrientation, windDirectionDeg);
};

const getMapOrientation = (item: MapExposureItem): number | null => (
  typeof item.orientation === 'number' && Number.isFinite(item.orientation)
    ? item.orientation
    : typeof item.windProfile?.beachFacingDirection === 'number' && Number.isFinite(item.windProfile.beachFacingDirection)
      ? item.windProfile.beachFacingDirection
      : estimateBeachOrientation(item.beach.protectedFrom)
);

const angularDistanceDegrees = (a: number, b: number): number => {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return diff > 180 ? 360 - diff : diff;
};

const protectedFromSignature = (item: MapExposureItem): string => (
  item.beach.protectedFrom || []
).map(String).sort().join('|');

const hasReliableExplicitMorphology = (
  item: MapExposureItem,
  sector?: WindSector,
  windBeaufort = 0
): boolean => {
  const profile = item.windProfile;
  if (!canUseMapWindProfile(profile, item.windProfileSource)) return false;
  if (profile.confidence === 'low') return false;

  if (profile.knownWindSportSpot && windBeaufort >= 4) return true;
  if (sector && profile.exposedToWindDirections.includes(sector)) return true;
  if (sector && profile.protectedFromWindDirections.includes(sector)) return true;
  if (profile.shelterLevel === 'open' && profile.fetchExposure === 'high') return true;

  return false;
};

// Same two numbers the scoring engine uses to let geometry EARN a protected claim
// (utils/windExposureEngine.hasGeometryEnclosedProtection): near-total land blockage plus low
// residual wind energy. They live in both files because the two must agree — see
// isStableProtectedSector below for why that stopped being optional.
const GEOMETRY_PROTECTION_BLOCKED_RATIO = 0.95;
const GEOMETRY_PROTECTION_MAX_INTENSITY = 33;

/**
 * Whether the geometry is strong enough to call this sector protected on its own.
 *
 * The map used to paint a pin protected off the RAW sector level, while the engine additionally
 * required blockage ≥0.95 and intensity <33 before a geospatial-backfill beach could claim
 * shelter — otherwise its profile stays `semi_sheltered` and the level falls to 'partial'.
 * Measured 2026-07-31 across the shipped profiles: 459 of 22,800 beach × sector combinations
 * (2.0%) were geometry-'protected' without passing the strict test, i.e. a green pin over a card
 * that said "partial shelter". Concentrated in Halkidiki (26), Corfu (23), Chania (21), Kos and
 * Rhodes (16 each), Zakynthos (15).
 *
 * The deliberate map-vs-engine asymmetry documented further down is the OTHER direction (pin one
 * band REDDER than the card, 207 cases) — that one is intended and stays. This one never was.
 *
 * A missing `intensity` counts as NOT stable, matching the engine exactly (24 sectors nationally).
 * Under-claiming shelter is cheap; painting a pin green off geometry that cannot support it is the
 * expensive error.
 */
const isStableProtectedSector = (
  geospatialExposure: MapExposureItem['geospatialExposure'],
  sector?: WindSector
): boolean => {
  if (!sector) return false;
  const sectorExposure = geospatialExposure?.sectors?.[sector];
  const confidence = geospatialExposure?.confidence;
  if (!sectorExposure || sectorExposure.level !== 'protected') return false;
  if (confidence !== 'high' && confidence !== 'medium') return false;

  return sectorExposure.blockedRayRatio >= GEOMETRY_PROTECTION_BLOCKED_RATIO
    && typeof sectorExposure.intensity === 'number'
    && sectorExposure.intensity < GEOMETRY_PROTECTION_MAX_INTENSITY;
};

const hasStableGeospatialProtection = (
  item: MapExposureItem,
  sector?: WindSector
): boolean => isStableProtectedSector(item.geospatialExposure, sector);

const hasCuratedSegmentProtectionSupport = (
  item: MapExposureItem,
  group: MapExposureItem[],
  sector?: WindSector
): boolean => (
  // Η ΔΑΝΕΙΚΗ προστασία δεν ταξιδεύει γύρω από ακρωτήρι. Ο γείτονας μιλάει για τη μορφολογία
  // που μοιράζονται, όχι για μια ακτή που το ΔΙΚΟ της σχήμα τη δείχνει να τρώει τον άνεμο
  // κατάμουτρα. Χωρίς αυτόν τον φραγμό, μετρήθηκε 20/08/2026, ο εξομαλυντής έβαφε πιο ήρεμα
  // την Καλησκιά Κέας, τη Μερχιά Μυκόνου, το Γιαλούδι και τον Καλόγερο Σερίφου και την Τσόχα
  // Σίφνου — ακτές με τον άνεμο κατάμουτρα — επειδή ένας επιθεωρημένος όρμος δίπλα τους τους
  // δάνειζε την προστασία του. Δες takesTheWindHeadOn και quality:card-vs-pin.
  !takesTheWindHeadOn(item, sector) &&
  group.some(candidate => (
    candidate.beach.id !== item.beach.id &&
    areInSameShorelineSegment(candidate.beach.id, item.beach.id) &&
    hasStableGeospatialProtection(candidate, sector)
  ))
);

/**
 * Παίρνει ΑΥΤΗ η ακτή τον άνεμο κατάμουτρα, κατά τη δική της γεωμετρία;
 *
 * Ο εξομαλυντής γειτόνων δανείζει προστασία μέσα σε μια ακτογραμμή, κι αυτό είναι σωστό όσο ο
 * δανειστής και ο δανειζόμενος βλέπουν τον ίδιο άνεμο. Μετρήθηκε 20/08/2026 ότι δεν ισχύει
 * πάντα: 89 πινέζες σε 11 παραλίες άλλαζαν ΧΡΩΜΑ προς τα πιο ήρεμα, και σε πέντε από αυτές η
 * ίδια η γεωμετρία της ακτής έλεγε το αντίθετο — Καλησκιά Κέας, Μερχιά Μυκόνου, Γιαλούδι και
 * Καλόγερος Σερίφου, Τσόχα Σίφνου, με τη συνιστώσα onshore στο 0,71-0,83.
 *
 * ΚΡΙΝΕΙ ΜΟΝΟ ΤΟΝ ΑΝΕΜΟ, ΟΧΙ ΤΟ ΝΕΡΟ. Μια πρώτη εκδοχή απαιτούσε και ανοιχτό fetch ≥1 χλμ.
 * Λάθος όριο: το fetch λέει αν χτίζεται ΚΥΜΑ, ενώ αυτό που χρωματίζει εδώ είναι ο ΑΝΕΜΟΣ, και
 * ο άνεμος φτάνει στην ακτή είτε υπάρχει νερό μπροστά της είτε όχι. Η Τσόχα Σίφνου το έδειξε:
 * onshore 0,71 με fetch μόλις 0,24 χλμ, δηλαδή αέρας κατάμουτρα χωρίς θάλασσα να τον χτίσει —
 * και με το όριο του fetch έμενε λάθος βαμμένη.
 *
 * ΤΟ ΑΝΤΙΘΕΤΟ ΔΕΝ ΕΙΝΑΙ ΣΦΑΛΜΑ, και γι᾽ αυτό ο έλεγχος είναι τόσο στενός: στους υπόλοιπους
 * τομείς των ίδιων παραλιών (Φτελιά, Μικρή Βίγλα, Αποθήκες, Λιγαρίδια) η γεωμετρία λέει
 * `protected` με τον άνεμο να φεύγει ΑΠΟ τη στεριά (onshore ως -0,999) — εκεί ο εξομαλυντής
 * έχει δίκιο και η ΚΑΡΤΑ άδικο, οπότε το να τις σκουραίναμε θα χειροτέρευε τον χάρτη για να
 * καλύψει λάθος αλλού. Απόφαση Μίλτου 20/08: δεν το κάνουμε. Ο φραγμός πιάνει μόνο όποια ακτή
 * το ΔΙΚΟ της σχήμα τη δείχνει να τρώει τον αέρα.
 */
const takesTheWindHeadOn = (item: MapExposureItem, sector?: WindSector): boolean => {
  if (!sector) return false;
  const sectorExposure = item.geospatialExposure?.sectors?.[sector];
  if (!sectorExposure || sectorExposure.level === 'protected') return false;
  return typeof sectorExposure.onshore === "number" && sectorExposure.onshore > 0.5;
};

const areLikelySameBeachFront = (a: MapExposureItem, b: MapExposureItem): boolean => {
  const sameCuratedSegment = areInSameShorelineSegment(a.beach.id, b.beach.id);
  const distanceKm = calculateDistance(
    a.beach.coordinates.lat,
    a.beach.coordinates.lon,
    b.beach.coordinates.lat,
    b.beach.coordinates.lon
  );

  if (!sameCuratedSegment && distanceKm > ADJACENT_BEACH_MAX_DISTANCE_KM) return false;

  const aOrientation = getMapOrientation(a);
  const bOrientation = getMapOrientation(b);

  if (typeof aOrientation === 'number' && typeof bOrientation === 'number') {
    return angularDistanceDegrees(aOrientation, bOrientation) <= (
      sameCuratedSegment ? 65 : SIMILAR_BEACH_FRONT_MAX_DEGREES
    );
  }

  if (sameCuratedSegment) return true;

  const aSignature = protectedFromSignature(a);
  return aSignature.length > 0 && aSignature === protectedFromSignature(b);
};

const exposurePriority = (level: ExposureLevel): number => {
  if (level === 'exposed') return 2;
  if (level === 'partial') return 1;
  return 0;
};

const getMoreConservativeExposure = (levels: ExposureLevel[]): ExposureLevel => (
  levels.reduce((current, next) => (
    exposurePriority(next) > exposurePriority(current) ? next : current
  ), 'protected' as ExposureLevel)
);

/**
 * ΕΧΕΙ ΚΕΡΔΙΘΕΙ Η ΑΝΑΚΟΥΦΙΣΗ ΠΟΥ ΕΤΟΙΜΑΖΕΤΑΙ ΝΑ ΔΑΝΕΙΣΤΕΙ ΑΥΤΗ Η ΠΙΝΕΖΑ;
 *
 * Ο φραγμός `takesTheWindHeadOn` του §Γ27β ζούσε ΜΟΝΟ μέσα στο
 * `hasCuratedSegmentProtectionSupport`, δηλαδή μόνο στο μονοπάτι όπου ο στόχος της ομάδας είναι
 * `protected`. Όταν ο στόχος ήταν `partial`, καμία ερώτηση δεν γινόταν: ο **Άγιος Ιωάννης
 * Λευκάδας** στον δυτικό άνεμο — onshore 0,56, γεωμετρία `exposed`, fetch 10,4 χλμ, ένταση 67 —
 * μαλάκωνε από `exposed` σε `partial` επειδή ένας κλειδωμένος γείτονας έλεγε `partial`. Μετρήθηκε
 * 20/08/2026 (PORISMA §Γ28γ): 4 τομεοεντάσεις, όλες ορατές στο χρώμα.
 *
 * Δεύτερος κανόνας, μαζί: **ο γείτονας ΕΝΙΣΧΥΕΙ προστασία, δεν την ΕΦΕΥΡΙΣΚΕΙ.** Άλμα δύο
 * ολόκληρων σκαλιών (`exposed` → `protected`) επιτρέπεται μόνο σε ακτή που η ΔΙΚΗ ΤΗΣ γεωμετρία
 * λέει κι αυτή `protected`. Πιάνει την **Κολυμπήθρα Τήνου** στον ανατολικό: onshore +0,32,
 * γεωμετρία `partial`, ένταση 39,7 — πλάγιος άνεμος πάνω στην ακτή, και η πινέζα πήδαγε από
 * πορτοκαλί σε κίτρινο δανεικά.
 *
 * ΤΟ ΕΥΡΟΣ ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΓΡΑΦΤΕΙ Η ΓΡΑΜΜΗ, σε 91.872 συγκρίσεις: οι δύο κανόνες μαζί πιάνουν
 * **7 τομεοεντάσεις σε 2 παραλίες** και **καμία άλλη πινέζα στη χώρα** — ούτε καν αόρατη. Δεν
 * ακυρώνουν την απόφαση του §Γ27β: οι 49 ΑΠΟΓΕΙΟΙ τομείς των έξι παραλιών, όπου ο χάρτης έχει
 * δίκιο και η κάρτα διορθώθηκε στο §Γ28β, συνεχίζουν να δανείζονται κανονικά.
 *
 * Χωρίς δική της γεωμετρία η πινέζα ΔΕΝ μπλοκάρεται: εκεί ο γείτονας είναι η μόνη μαρτυρία που
 * έχουμε, κι αυτός ήταν πάντα ο λόγος ύπαρξης του εξομαλυντή.
 */
const borrowedReliefIsEarned = (
  item: MapExposureItem,
  sector: WindSector | undefined,
  currentLevel: ExposureLevel,
  targetLevel: ExposureLevel
): boolean => {
  if (exposurePriority(targetLevel) >= exposurePriority(currentLevel)) return true;
  if (!sector) return true;
  if (takesTheWindHeadOn(item, sector)) return false;
  if (exposurePriority(currentLevel) - exposurePriority(targetLevel) < 2) return true;
  const ownSectorLevel = item.geospatialExposure?.sectors?.[sector]?.level;
  if (!ownSectorLevel) return true;
  return ownSectorLevel === 'protected';
};

export const getVisibleMapExposureLevel = (
  item: Pick<SuitableBeach, 'exposureLevel' | 'geospatialExposure' | 'orientation' | 'windProfile' | 'windProfileSource' | 'windSector' | 'warnings'> & { beach: Pick<Beach, 'protectedFrom'> },
  windBeaufort?: number,
  windDirectionDeg?: number
): ExposureLevel => {
  // THE DIRECTION THAT WAS PASSED IN WINS. Until 01/08/2026 this read
  // `item.windSector ?? getWindSectorFromDegrees(windDirectionDeg)`, and because App.tsx always
  // pre-filled windSector from the region assessment, the `??` made the second half dead code:
  // every caller could hand this function a beach's own wind direction and be silently ignored.
  // The geometry lookup below — the main signal — then answered a question about a different wind
  // than the one the caller asked about. Two callers were affected: the map, which since the same
  // day feeds each beach its cluster wind (perBeachMapWind), and the trip planner, which passes a
  // FUTURE day's direction while windSector still described today.
  //
  // windSector stays as the fallback for callers that genuinely have a sector and no degrees
  // (see scripts/dumpRegionExposureEngine.ts), so nothing loses its exposure for lack of an input.
  const sector = getWindSectorFromDegrees(windDirectionDeg) ?? item.windSector;
  const canUseWindProfile = canUseMapWindProfile(item.windProfile, item.windProfileSource);
  // A curated suspectPin means "geometry from this pin is not trusted" (notch/
  // tombolo pins) — the map must not colour from it in ANY branch below; only
  // the authored profile speaks for these beaches.
  const geospatialExposure = sector && !item.windProfile?.suspectPin
    ? item.geospatialExposure?.sectors?.[sector]?.level
    : undefined;

  // Low confidence means the authored profile cannot create user-facing
  // protected/calm claims. It does not invalidate a direct geospatial protected
  // result from bay/headland geometry, which is what the map colour represents.
  // EXCEPT when the curated profile explicitly lists this sector as exposed:
  // explicit exposure claims are trusted at any confidence everywhere else in
  // the engine, and a wrong "protected" is the dangerous direction, so the map
  // must not contradict an explicit curated warning (e.g. the Milos-Kimolos
  // channel beaches, where straight-ray fetch cannot see wind funneling).
  // The same applies when the authored FACING says the live wind is onshore:
  // the engine's angular check calls that 'exposed' at any confidence (it
  // drives the card chip), so the map must not paint geometry-protected
  // against its own card.
  const authoredAngularExposed =
    typeof item.windProfile?.beachFacingDirection === 'number' &&
    Number.isFinite(item.windProfile.beachFacingDirection) &&
    typeof windDirectionDeg === 'number' &&
    Number.isFinite(windDirectionDeg) &&
    calculateWindExposure(item.windProfile.beachFacingDirection, windDirectionDeg).exposureLevel === 'exposed';
  if (
    geospatialExposure === 'protected' &&
    // Raw sector level is not enough to paint a pin green — the engine would score this
    // 'partial'. See isStableProtectedSector.
    isStableProtectedSector(item.geospatialExposure, sector) &&
    item.windProfile?.confidence === 'low' &&
    !authoredAngularExposed &&
    !(item.windProfile.knownWindSportSpot && (windBeaufort ?? 0) >= 4) &&
    !(sector && item.windProfile.exposedToWindDirections.includes(sector))
  ) {
    return 'protected';
  }

  // Curated authored profiles (incl. their known-wind-sport safety flag, handled
  // first inside exposureFromHighPriorityWindProfile) take priority over the raw
  // geometry, preserving the conservative shelter policy.
  const highPriorityProfileExposure = canUseWindProfile
    ? exposureFromHighPriorityWindProfile(item.windProfile, sector, windBeaufort ?? 0, windDirectionDeg)
    : undefined;
  if (highPriorityProfileExposure === 'protected' || highPriorityProfileExposure === 'exposed') {
    return highPriorityProfileExposure;
  }

  const fallbackProfileExposure = canUseWindProfile
    ? exposureFromWindProfile(item.windProfile, sector, windBeaufort ?? 0, windDirectionDeg)
    : undefined;

  // Authored profiles still protect clear wind-sport/open-exposure cases. For
  // low-confidence profiles, direct geospatial protected geometry has already
  // been allowed above; low confidence limits text claims, not map geometry.
  if (fallbackProfileExposure === 'protected' || fallbackProfileExposure === 'exposed') {
    if (
      fallbackProfileExposure === 'protected' &&
      item.windProfile?.confidence === 'low' &&
      geospatialExposure &&
      geospatialExposure !== 'protected'
    ) {
      return geospatialExposure;
    }

    if (
      item.windProfile?.confidence === 'low' &&
      geospatialExposure === 'exposed' &&
      fallbackProfileExposure !== 'exposed'
    ) {
      return 'exposed';
    }

    return fallbackProfileExposure;
  }

  const explicitOrientationExposure = exposureFromExplicitOrientation(item.orientation, windDirectionDeg);
  const legacyExposure = exposureFromLegacyProtectedFrom(item.beach.protectedFrom, windDirectionDeg);
  const directionalFallbackExposure = explicitOrientationExposure || legacyExposure;

  // Geometry signal: the regenerated geospatial profile now carries the improved
  // onshore/offshore-aware sector levels, so reading them here is enough.
  // DELIBERATE asymmetry vs scoring: the map follows a geometry-'exposed' sector at
  // ANY fetch, while the engine escalates authored-partial scoring only at >=8 km
  // high-confidence fetch (Solution B threshold, pinned in the suite). So for a
  // short-fetch open onshore sector the pin can read one band redder than the card —
  // the conservative direction, kept until a Solution-B-style false-positive pass
  // justifies lowering the scoring threshold.
  if (geospatialExposure === 'exposed') return geospatialExposure;
  // A geometry-'protected' sector only paints the pin protected when it passes the same strict
  // test the scoring engine applies; otherwise the pin says exactly what the card says.
  if (geospatialExposure === 'protected') {
    return isStableProtectedSector(item.geospatialExposure, sector)
      ? 'protected'
      : (fallbackProfileExposure || 'partial');
  }
  if (geospatialExposure === 'partial') return fallbackProfileExposure || 'partial';
  if (fallbackProfileExposure) return fallbackProfileExposure;
  if (directionalFallbackExposure === 'exposed' || directionalFallbackExposure === 'protected') {
    return directionalFallbackExposure;
  }
  if (geospatialExposure) return geospatialExposure;
  if (directionalFallbackExposure) return directionalFallbackExposure;

  if (sector && item.beach.protectedFrom?.includes(windSectorToDirection[sector])) return 'partial';

  if (item.exposureLevel) return item.exposureLevel;

  return 'partial';
};

/**
 * The wind AT a beach, when we have it. Keyed by beach id.
 *
 * Added 01/08/2026. Until then every beach in a region was coloured from one wind measured at the
 * region's geometric centre, which in a large region is inland or on the opposite coast. Measured
 * live: 1.532 of 2.850 beaches (53,8%) sit in a different cell of the weather model than that
 * centre, and on 02/08 Evia's centre read 1 Bft while its own shores ran 1–6 Bft. Fifty beaches
 * were being painted "Ιδανική" over 5–6 Bft — see scripts/validateColourAgainstRealWind.mjs,
 * which fails red on the region wind and passes clean on this one.
 *
 * Optional on purpose: the cluster forecast can be missing (first paint, a region with no
 * geometry, a failed fetch), and a beach with no local reading falls back to the region wind —
 * exactly as before. No beach is ever left uncoloured because of this.
 */
export interface BeachWindReading {
  beaufort: number;
  directionDeg: number;
}

export const getConsistentVisibleMapExposureLevels = (
  items: MapExposureItem[],
  windBeaufort?: number,
  windDirectionDeg?: number,
  perBeachWind?: Map<number, BeachWindReading>
): Map<number, ExposureLevel> => {
  const levels = new Map<number, ExposureLevel>();
  items.forEach(item => {
    const local = perBeachWind?.get(item.beach.id);
    levels.set(item.beach.id, getVisibleMapExposureLevel(
      item,
      local?.beaufort ?? windBeaufort,
      local?.directionDeg ?? windDirectionDeg
    ));
  });

  if (items.length < 2) return levels;

  const parent = new Map<number, number>();
  items.forEach(item => parent.set(item.beach.id, item.beach.id));

  const find = (id: number): number => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  const sector = getWindSectorFromDegrees(windDirectionDeg);
  const beaufort = windBeaufort ?? 0;

  // The pass below decides which beaches on one front may overrule the others. It used to ask
  // every question with the REGION wind while the colours it was correcting had already been
  // resolved per beach — a region answer rewriting a per-beach one. Each item is now asked about
  // its own wind, falling back to the region when it has none, so the pass can only harmonise
  // neighbours and never smuggle the region wind back into a colour.
  const sectorOf = (item: MapExposureItem): WindSector | undefined => (
    getWindSectorFromDegrees(perBeachWind?.get(item.beach.id)?.directionDeg) ?? sector
  );
  const beaufortOf = (item: MapExposureItem): number => (
    perBeachWind?.get(item.beach.id)?.beaufort ?? beaufort
  );

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!areLikelySameBeachFront(a, b)) continue;

      const aLocked = hasReliableExplicitMorphology(a, sectorOf(a), beaufortOf(a));
      const bLocked = hasReliableExplicitMorphology(b, sectorOf(b), beaufortOf(b));
      if (aLocked && bLocked && levels.get(a.beach.id) !== levels.get(b.beach.id)) continue;

      union(a.beach.id, b.beach.id);
    }
  }

  const groups = new Map<number, MapExposureItem[]>();
  items.forEach(item => {
    const root = find(item.beach.id);
    const group = groups.get(root) || [];
    group.push(item);
    groups.set(root, group);
  });

  groups.forEach(group => {
    if (group.length < 2) return;

    const currentLevels = group
      .map(item => levels.get(item.beach.id))
      .filter((level): level is ExposureLevel => Boolean(level));
    const uniqueLevels = new Set(currentLevels);
    if (uniqueLevels.size <= 1) return;

    const lockedLevels = group
      .filter(item => hasReliableExplicitMorphology(item, sectorOf(item), beaufortOf(item)))
      .map(item => levels.get(item.beach.id))
      .filter((level): level is ExposureLevel => Boolean(level));
    const uniqueLockedLevels = new Set(lockedLevels);

    const hasProtectedSegmentSupport = group.some(item => (
      levels.get(item.beach.id) === 'protected' &&
      hasStableGeospatialProtection(item, sectorOf(item))
    ));
    const hasLockedNonProtectedLevel = group.some(item => (
      hasReliableExplicitMorphology(item, sectorOf(item), beaufortOf(item)) &&
      levels.get(item.beach.id) !== 'protected'
    ));

    const targetLevel = hasProtectedSegmentSupport && !hasLockedNonProtectedLevel
      ? 'protected'
      : uniqueLockedLevels.size === 1
      ? lockedLevels[0]
      : getMoreConservativeExposure(currentLevels);

    group.forEach(item => {
      if (uniqueLockedLevels.size > 1 && hasReliableExplicitMorphology(item, sectorOf(item), beaufortOf(item))) return;
      if (
        targetLevel === 'protected' &&
        levels.get(item.beach.id) !== 'protected' &&
        (
          hasReliableExplicitMorphology(item, sectorOf(item), beaufortOf(item)) ||
          (
            !hasStableGeospatialProtection(item, sectorOf(item)) &&
            !hasCuratedSegmentProtectionSupport(item, group, sectorOf(item))
          )
        )
      ) {
        return;
      }
      if (
        targetLevel !== 'protected' &&
        hasStableGeospatialProtection(item, sectorOf(item))
      ) return;
      // Ο τελευταίος φραγμός πριν γραφτεί το χρώμα, και ο μόνος που ρωτάει και στα ΔΥΟ μονοπάτια
      // (protected και μη): δες borrowedReliefIsEarned.
      const currentLevel = levels.get(item.beach.id);
      if (currentLevel && !borrowedReliefIsEarned(item, sectorOf(item), currentLevel, targetLevel)) return;
      levels.set(item.beach.id, targetLevel);
    });
  });

  return levels;
};
