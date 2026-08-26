
import { CrowdLevel } from './services/crowdService';
export type { CrowdLevel };

export enum WindDirection {
  N = 'North',
  NE = 'Northeast',
  E = 'East',
  SE = 'Southeast',
  S = 'South',
  SW = 'Southwest',
  W = 'West',
  NW = 'Northwest',
}

export enum Accessibility {
  EASY = 'EASY',
  MODERATE = 'MODERATE',
  DIFFICULT = 'DIFFICULT',
  BOAT_ONLY = 'BOAT_ONLY',
}

export type LanguageCode = 'en' | 'gr' | 'fr' | 'de' | 'it';
export type WindUnit = 'beaufort' | 'mph';
export type WaveCondition = 'calm' | 'moderate' | 'rough';
export type BeachType = 'sandy' | 'pebbles' | 'sandy-pebbles' | 'rocky' | 'unknown';
export type WaterDepth = 'shallow' | 'medium' | 'deep';
export type BeachAccessType = 'asphalt_road' | 'passable_dirt_road' | 'difficult_dirt_road' | '4x4_only' | 'hiking_path_easy' | 'hiking_path_difficult' | 'boat_only' | 'unknown';
export type BeachTerrainType = 'fine_sand' | 'coarse_sand' | 'pebbles' | 'large_stones' | 'rocks';
export type TravelStyle = 'family' | 'couple' | 'friends' | 'solo';
export type SortOption = 'recommended' | 'all' | 'protected' | 'rating' | 'distance';
export type FilterKey =
  | keyof Beach['amenities']
  | keyof Beach['characteristics']
  | keyof Beach['activities']
  | keyof Beach['environment']
  | 'easyAccess'
  | 'disabledAccess'
  | 'adventure'
  | 'sunset'
  | 'naturist'
  | BeachType
  | 'showAll';
export type Theme = 'light' | 'dark' | 'system';
export type DataConfidence = 'high' | 'medium' | 'low';
export type WeatherSource = 'beach-cluster' | 'island-fallback';
export type ForecastConfidence = DataConfidence;
export type WindSector = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type ShelterLevel = 'open' | 'semi_sheltered' | 'sheltered' | 'very_sheltered' | 'unknown';
export type FetchExposure = 'low' | 'medium' | 'high' | 'unknown';
export type LocalWindAmplification = 'low' | 'medium' | 'high' | 'unknown';
export type SeabedSlope = 'shallow_gradual' | 'moderate' | 'steep' | 'unknown';
export type WaterEntry = 'easy' | 'moderate' | 'difficult' | 'rocks_only' | 'unknown';
export type WaterQualityRiskAfterRain = 'low' | 'medium' | 'high';
export type SwimmingComfort = 'excellent' | 'good' | 'caution' | 'avoid_swimming';
/**
 * Condition tones, roughest → calmest. Identical to the region map's marker palette on purpose:
 * both come from utils/suitabilityTone.resolveConditionTone, so a card and the pin for the same
 * beach cannot state different conditions.
 *
 * 'blue' means genuinely calm (0–2 Bft, plus protected/partial shores at 3 Bft).
 *
 * There used to be a fifth value, 'green', for a verified enclosed cove holding flat water at
 * 5 Bft. It was removed on 02/08/2026: the shape of a bay is a fact about the place, not a rung
 * on a severity scale, and it now shows as a badge on the map marker instead (suitabilityTone
 * .showsCoveBadge) while the beach wears its real conditions.
 */
export type WindSuitabilityColor = 'blue' | 'yellow' | 'orange' | 'red';
export type WindSuitabilityExplanationKey =
  | 'generally_calm'
  | 'protected_from_wind'
  | 'partly_exposed'
  | 'exposed_to_wind'
  | 'avoid_today';

export interface SimpleWindSuitability {
  suitabilityColor: WindSuitabilityColor;
  exposureStatus: 'protected' | 'partial' | 'exposed';
  confidence: DataConfidence;
  explanationKey: WindSuitabilityExplanationKey;
  explanationText: string;
  windSector?: WindSector;
  /** Beaufort of the wind this assessment was built for; lets copy scale its
   *  certainty (a 5–6 Bft day definitely has wind/waves, even on a sheltered shore). */
  windBeaufort?: number;
  /**
   * The km/h `windBeaufort` was rounded from — carried for the same reason `windBeaufort` is:
   * the sea-state pass re-derives the colour and must not be handed a different number than the
   * wind-only colour was built from. Read by utils/suitabilityTone.holdsNoBuildableChopAtThree,
   * where the 3 Bft band's bottom half behaves differently from its top.
   */
  windSpeedKmh?: number;
  /**
   * The wind is blowing off the land over zero fetch at 5 Bft
   * (utils/offshoreFlatWater.holdsFlatWaterUnderOffshoreWind), so the surface is flat despite
   * the speed. Carried on the object — like `exposureStatus` and `windBeaufort` — so the
   * sea-state pass that re-derives the colour reads the exact value the wind-only colour was
   * built from, instead of a call site re-answering the question with different inputs.
   */
  offshoreFlatWater?: boolean;
  /**
   * ΤΑ ΔΥΟ ΣΗΜΑΤΑ ΤΗΣ ΚΑΡΤΑΣ, ΞΕΧΩΡΙΣΤΑ (24/08/2026) — utils/conditionCause.resolveFactorTones.
   *
   * `windOnlyColor` = τι θα ήταν το χρώμα αν η θάλασσα ήταν λάδι· `seaOnlyColor` = πόσο το
   * κατέβασε η θάλασσα ('blue' όταν δεν το κατέβασε). Ταξιδεύουν ΠΑΝΩ ΣΤΟ ΙΔΙΟ αντικείμενο με το
   * `suitabilityColor`, για τον ίδιο λόγο που ταξιδεύουν εκεί το `exposureStatus` και το
   * `windBeaufort`: υπολογίζονται ΜΙΑ φορά, από το ίδιο input που παρήγαγε το τελικό χρώμα, ώστε
   * καμία επιφάνεια να μην μπορεί να τα ξαναϋπολογίσει με άλλα δεδομένα.
   *
   * Προαιρετικά, γιατί τα γεμίζει μόνο το πέρασμα της θάλασσας (`applySeaStateToWindSuitability`):
   * όποιος διαβάζει ένα αντικείμενο πριν από αυτό βλέπει `undefined` και δεν βάφει τίποτα —
   * η ίδια αρχή με κάθε άλλη είσοδο εδώ, η απουσία δεν εφευρίσκει χρώμα.
   */
  windOnlyColor?: WindSuitabilityColor;
  seaOnlyColor?: WindSuitabilityColor;
}

export interface BeachMapCoordinates {
  lat: number;
  lon: number;
  source?: string;
  sourceUrl?: string;
  confidence?: DataConfidence;
  notes?: string;
}

export interface BeachLocation {
  lat: number;
  lon: number;
  country: 'Greece';
  region: string;
  island?: string;
  municipality?: string;
}

export interface BeachOrientation {
  degrees: number | null;
  faces: WindDirection[];
  protectedFrom: WindDirection[];
  confidence: DataConfidence;
  notes?: string;
}

export interface WindProfile {
  beachFacingDirection: number | null;
  shelterLevel: ShelterLevel;
  fetchExposure: FetchExposure;
  exposedToWindDirections: WindSector[];
  protectedFromWindDirections: WindSector[];
  knownWindSportSpot: boolean;
  localWindAmplification: LocalWindAmplification;
  confidence: DataConfidence;
  notes: string;
  /**
   * The beach pin is known/suspected to sit at the wrong spot (wrong cove,
   * name collision, harbour pocket — needs-field-verification list), so
   * geometry derived from it must not override authored knowledge (e.g. the
   * geometry-facing preference rule).
   */
  suspectPin?: boolean;
}

export type WindProfileSource = 'override' | 'beach' | 'metadata' | 'geospatial' | 'unknown';

export interface WeatherConditions {
  timestamp: string;
  windDirection: WindDirection;
  windSpeedKmh: number;
  windGustKmh?: number;
  windGustKnots?: number;
  temperatureC: number;
  cloudCoverPercent?: number;
  rainProbabilityPercent?: number;
  uvIndex?: number;
}

export interface MarineConditions {
  waveHeightM?: number;
  waveCondition: WaveCondition;
  swellDirection?: WindDirection;
  seaTemperatureC?: number;
  isComfortableForSwimming: boolean;
  notes?: string;
}

export interface MarineForecast {
  waveHeightM?: number;
  waveDirectionDeg?: number;
  wavePeriodS?: number;
  swellWaveHeightM?: number;
  swellWaveDirectionDeg?: number;
  swellWavePeriodS?: number;
  seaSurfaceTemperatureC?: number;
  /**
   * Which wave model these six values came from. `ewam` (0.05°) is preferred wherever it
   * reports; `meteofrance_wave` (0.08°) covers days 4-6 and the basins ewam's grid cannot
   * resolve. Traceability only — nothing scores, colours or ranks off this field. The height,
   * direction and period always come from the SAME model, never mixed.
   */
  waveModel?: 'ewam' | 'meteofrance_wave';
  source?: 'open-meteo-marine';
}

export interface RecommendationConfidence {
  level: DataConfidence;
  score: number;
  source: WeatherSource;
  reasons: string[];
}

export interface RecommendationExplanation {
  summary: string;
  topReasons: string[];
  tradeoffs: string[];
  touristAdvice: string;
}

export type WarningFlagType =
  | 'strong_wind'
  | 'gusty_wind'
  | 'rough_sea'
  | 'afternoon_wind_build'
  | 'exposed_to_wind'
  | 'offshore_wind'
  | 'onshore_chop'
  | 'direct_swell'
  | 'shore_break'
  | 'long_period_swell'
  | 'difficult_access'
  | 'boat_only'
  | 'crowded'
  | 'missing_data'
  | 'rain_risk'
  | 'water_quality_risk'
  | 'official_warning'
  | 'heat_uv'
  | 'low_confidence'
  | 'wind_sport_spot';

export interface WarningFlag {
  type: WarningFlagType;
  severity: 'info' | 'warning' | 'critical';
  /**
   * ΑΓΓΛΙΚΑ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΓΙΑ ΤΗΝ ΟΘΟΝΗ. Το γράφει ο κινητήρας για τον εαυτό του, τα εργαλεία
   * μέτρησης και τις αναφορές. Ό,τι διαβάζει επισκέπτης περνάει από το `warningLabel`
   * (components/BeachCard.tsx), που έχει `case` για κάθε τύπο σε πέντε γλώσσες — και μια πύλη
   * που σκάει αν λείψει έστω ένας (`scripts/validateWarningLabelCoverage.mjs`). Μέχρι τις
   * 22/08/2026 έλειπαν έντεκα, και το `default` τύπωνε ΑΥΤΗ τη γραμμή σε Έλληνα επισκέπτη.
   */
  message: string;
  /**
   * Τα νούμερα που το αγγλικό `message` έχει ήδη μπλέξει μέσα στην πρότασή του, ξεχωριστά,
   * ώστε η ελληνική/γαλλική/γερμανική/ιταλική λεζάντα να τα ξαναχτίσει αντί να τα ψαρέψει με
   * regex από αγγλικό κείμενο. Μπαίνει μόνο όπου υπάρχει νούμερο να πει.
   */
  values?: {
    /** `gusty_wind`: η ριπή σε χλμ/ώρα. */
    gustKmph?: number;
    /** `afternoon_wind_build`: η κορυφή σε Μποφόρ και η ώρα της. */
    peakBeaufort?: number;
    peakHour?: number;
    /** `direct_swell` / `long_period_swell`: ύψος σε μέτρα, περίοδος σε δευτερόλεπτα. */
    swellHeightM?: number;
    swellPeriodS?: number;
  };
}

export interface BeachScore {
  beachId: number;
  total: number;
  swimmingScore?: number;
  experienceScore?: number;
  preferenceScore?: number;
  finalSuitabilityScore?: number;
  swimmingComfort?: SwimmingComfort;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  windProtection: number;
  seaComfort: number;
  weatherComfort: number;
  preferenceMatch: number;
  distance: number;
  amenities: number;
  explanation: RecommendationExplanation;
  warnings: WarningFlag[];
}

export interface UserPreferences {
  blueFlag2026: boolean;
  disabledAccess: boolean;
  sandy: boolean;
  pebbles: boolean;
  quiet: boolean;
  beachBar: boolean;
  familyFriendly: boolean;
  snorkeling: boolean;
  deepWater: boolean;
  shallowWater: boolean;
  surfing: boolean;
  parking: boolean;
  easyAccess: boolean;
}

/**
 * The "what I like in a beach" profile, chosen once inside the account and kept
 * there. Deliberately NOT the same state as the filter chips: a chip is a
 * question about today ("show me only sandy ones on Naxos"), while this is a
 * standing answer that follows the person across islands and devices.
 */
export interface BeachProfile {
  /**
   * Off until asked for. A saved list that silently reorders the site the first
   * time someone signs in is a surprise, and surprises here look like bugs.
   */
  enabled: boolean;
  /** Same vocabulary as the chips, so nobody has to learn a second one. */
  wishes: UserPreferences;
}

export interface Beach {
  id: number;
  rating: number;
  name: { [key in LanguageCode]: string };
  description: { [key in LanguageCode]: string };
  detailedDescription?: { [key in LanguageCode]?: string };
  accessNotes?: { [key in LanguageCode]?: string };
  protectedFrom: WindDirection[];
  orientation?: BeachOrientation;
  accessibility: Accessibility;
  amenities: { 
    organized: boolean; 
    naturalShade: boolean; 
    taverna: boolean; 
    beachBar: boolean;
    sunbeds: boolean;
    restaurant: boolean;
    parking: boolean;
    /** Beach has a rinse shower (from OSM amenity=shower on/at the beach). Under-claimed:
     *  true only for high-confidence OSM matches; false/absent means "not that we know of". */
    shower: boolean;
  };
  characteristics: {
    shallowWaters: boolean;
    deepWaters: boolean;
  };
  beachType: BeachType;
  waterDepth: WaterDepth;
  activities: {
    snorkeling: boolean;
    /**
     * Curated in data/surfSpots.json from named outside surf guides — never
     * inferred. Was a hash of the beach id until 2026-07, which flagged 543
     * beaches at random.
     */
    surfing: boolean;
  };
  /**
   * Months (1-12) the surf break actually works, for beaches where
   * `activities.surfing` is true. Greek surf splits hard by season: the western
   * breaks are November–April, the Aegean ones are meltemi-driven summer. Without
   * this a July search for surf returns winter-only spots.
   */
  surfMonths?: number[];
  environment: {
    quiet: boolean;
    remote: boolean;
    familyFriendly: boolean;
    /**
     * How `quiet` was arrived at. 'measured' = a Google review count below the threshold.
     * 'presumed' = no Google identity at all, and the beach passed the developed / famous /
     * urban gates in buildBeachRegionData.mjs. Absent = a hand-written override, or not quiet.
     * The UI must never print the measured wording over a presumed flag.
     */
    quietEvidence?: 'measured' | 'presumed';
  };
  popularityScore: number;
  /** Static crowd/popularity badge (from Google review count); surfaced top-level for summary/detail data. */
  popularity?: {
    tier: 'secluded' | 'quiet' | 'moderate' | 'popular' | 'crowded';
    rating?: number | null;
    ratingCount?: number;
    source?: string;
    checkedAt?: string;
  };
  /**
   * Trimmed navigation record, surfaced top-level for the summary/detail tiers (the metadata copy
   * is not shipped to them). Read by opensGoogleMapsPin: only 'verified' + a placeId + a mode that
   * is not 'coordinates' means the «Πλοήγηση» button lands on THIS beach's Google place card.
   */
  googleMapsNavigation?: {
    status: 'verified' | 'unresolved' | 'needs-review' | 'blocked';
    mode?: 'place' | 'coordinates';
    placeId?: string;
  };
  coordinates: { lat: number; lon: number; };
  /**
   * The weather-model grid cell Open-Meteo actually answers this beach from, as `lat_lon` of the
   * cell centre — MEASURED once by scripts/bakeForecastModelCells.mjs, not derived. It cannot be
   * derived: the default `cell_selection=land` walks a 90 m elevation model to pick a land cell
   * of similar height, and a plain geometric snap predicts the real cell for only ~49% of
   * beaches. utils/beachForecastClusters.ts is the only consumer — it refuses to let one
   * forecast point speak for beaches sitting in different cells.
   */
  forecastCell?: string;
  /**
   * The grid cell OVER THE WATER that gives this beach its wind DIRECTION, as `lat_lon` of the
   * cell centre — measured by scripts/bakeSeaWindCells.mjs with `cell_selection=sea`, for the
   * same reason `forecastCell` is measured rather than derived.
   *
   * PRESENT ONLY PAST THE 3 km GATE. A beach whose land cell already sits on top of it has no
   * entry at all, because PORISMA §Γ29 found no gain there and a measured LOSS on speed. Absence
   * is therefore the "leave this beach alone" instruction, and it is data, not code — re-bake
   * with a different gate and the whole thing moves.
   *
   * Direction AND speed ride on it (speed since 25/08/2026 — §Γ51/§Γ52, decision Miltos):
   * utils/overWaterWind.ts is the sole consumer. The gust and every gust-spread threshold stay on
   * `forecastCell`'s land feed, which is what they were calibrated on.
   */
  seaWindCell?: string;
  mapCoordinates?: BeachMapCoordinates;
  location?: Partial<BeachLocation>;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  fetchExposure?: FetchExposure;
  seabedSlope?: SeabedSlope;
  waterEntry?: WaterEntry;
  waterQualityRiskAfterRain?: WaterQualityRiskAfterRain;
  nearStreamOrDrain?: boolean;
  nearPort?: boolean;
  urbanRunoffRisk?: boolean;
  officialWarningOverride?: boolean;
  officialWarningReason?: string;
  windProfile?: WindProfile;
  blueFlag2026?: BeachMetadata['blueFlag2026'];
  seatrac?: BeachMetadata['seatrac'];
  webcam?: BeachWebcam;
  nearbyCamping?: NearbyCampsite[];
  paidEntry?: BeachPaidEntry;
  // Categorical: sheltered from the region's local SUMMER wind (meltemi / maistros),
  // baked by scripts/bakeLocalWindShelter.ts via the curated-aware windClimatology.
  // Single source for region-page counts, the sheltered guide gate, and the chip.
  shelteredFromLocalWind?: boolean;
  // The full three-level verdict behind that flag (protected/partial/exposed),
  // baked by the same single computation. Absent when the model abstains
  // (suspect pin / no profile) — absent means "make no claim", not "exposed".
  localWindStatus?: 'protected' | 'partial' | 'exposed';
  // MEASURED depth (m) 100 m out in the direction the beach faces, baked by
  // scripts/bakeSeabedEntry.ts from EMODnet bathymetry — present ONLY when it is deep enough
  // to state and no other record disagrees. Absent means "make no claim", never "shallow":
  // the source smooths shallow water, so only the deep side of it is trustworthy.
  // It is INFORMATION, not a score — see utils/seabedEntry for why the scoring route was
  // measured and dropped.
  steepSeabedDepthM?: number;
  aliases?: string[];
  staticLabels?: {
    beachType?: string;
    accessType?: string;
    accessLabel?: string;
    terrain?: string;
    waterDepth?: string;
  };
  metadata?: BeachMetadata;
  /**
   * Id of the region this beach belongs to. Normally implicit (a beach is loaded
   * as part of its region), but set explicitly when beaches from several regions
   * are merged into one list — e.g. the cross-region "Κοντά μου" view — so detail
   * data can still be loaded from the beach's real region.
   */
  regionId?: string;
  /**
   * The beach's original (region-scoped) id. Beach ids are only unique *within* a
   * region, so when regions are merged for the "Κοντά μου" view we reassign `id`
   * to a globally-unique value and keep the real id here for detail lookups.
   */
  sourceBeachId?: number;
}

export type BeachAmenities = Beach['amenities'];

/**
 * Disability / wheelchair sea-access (Seatrac and supporting amenities).
 * Distinct from `Accessibility` (which is terrain difficulty to *reach* the beach).
 *
 * SAFETY NOTE: this data can physically strand a wheelchair user if wrong. Equipment is
 * seasonal and leased annually; "listed" never implies "operational". seatrac.gr is the
 * authoritative live source — every bulk-imported record carries `needsVerification: true`.
 */
export type SeatracStatus = 'online' | 'uninstalled' | 'listed-unverified';
/** Tri-state on purpose: 'no' = confirmed absent, 'unknown' = not stated (never imply absence). */
export type AccessFeatureStatus = 'yes' | 'seasonal' | 'no' | 'unknown';

export interface BeachSeatracAccess {
  /** A Seatrac (or equivalent autonomous sea-access ramp) is associated with this beach. */
  hasSeatrac: boolean;
  /** Operational reality, NOT mere listing. Safe default when unconfirmed: 'listed-unverified'. */
  status: SeatracStatus;
  /** Equipment is seasonal (installed ~June, removed Sept/Oct). Default true. */
  seasonal: boolean;
  /** Supporting amenities for a full accessible set — each tri-state, never a bare boolean. */
  amenities: {
    disabledParking: AccessFeatureStatus;
    /** Boardwalk / accessible track to the waterline (διάδρομος). */
    boardwalkToWater: AccessFeatureStatus;
    accessibleWc: AccessFeatureStatus;
    changingRoom: AccessFeatureStatus;
    shower: AccessFeatureStatus;
    shade: AccessFeatureStatus;
  };
  /** True only when all six amenities are 'yes'/'seasonal' (the ~11% fully-accessible case). Derived. */
  fullSet: boolean;
  source: string;
  /** Include https://seatrac.gr/... when known (the authoritative live source). */
  sourceUrls: string[];
  /** ISO date this accessibility record was last confirmed. */
  verifiedAt: string;
  /** Confidence in the accessibility claim specifically (independent of beach-level confidence). */
  confidence: DataConfidence;
  /** SAFETY GATE: when true, UI shows "verify before visiting". Default true for bulk imports. */
  needsVerification: boolean;
  /** Region/list the source placed it under, for audit traceability. */
  region?: string;
  notes?: string;
  /** Provenance of the name→record match, mirroring blueFlag2026.officialEntries. */
  match?: { officialNameGr?: string; officialNameEn?: string; matchMethod: string; matchScore: number };
}

/**
 * An organized/licensed campsite near a beach (≤ 2.5 km), sourced from OpenStreetMap
 * (`tourism=camp_site`). Wild camping is illegal in Greece, so this only ever lists real
 * campgrounds. Source-derived and recomputed on each link run — never hand-edited.
 */
export interface NearbyCampsite {
  /** Stable OSM key, e.g. "osm-node-123" / "osm-way-456". */
  id: string;
  /** Best display name (Greek preferred, then English, then raw OSM name). */
  name: string;
  nameEn?: string;
  coordinates: { lat: number; lon: number };
  /** Beach pin → campsite distance, rounded metres. */
  distanceMeters: number;
  website?: string;
  phone?: string;
  /** From OSM tags (caravans=yes / tents=yes) when stated. */
  caravans?: boolean;
  source: 'osm';
  /** https://www.openstreetmap.org/<type>/<id> */
  osmUrl: string;
  /** ISO date this link was last computed. */
  checkedAt: string;
}

/**
 * "You pay to be here." Greek foreshore is public/free by law, so this flags the
 * exceptions where access effectively costs money. The `kind` drives a SEPARATE,
 * honest explanation per case — never a vague "paid" label.
 *
 * SAFETY NOTE: we are publicly telling people "this beach charges". The risk is the
 * false positive (calling a free beach paid). Every bulk/OSM-derived record carries
 * `needsVerification: true`; the UI softens the wording until a human confirms it.
 */
export type PaidEntryKind =
  /** εισιτήριο εισόδου: you pay an admission fee just to step onto the beach (e.g. Astir Beach). */
  | 'entrance_fee'
  /** ιδιωτική παραλία / beach club: private/customers-only; consumption or a booking is required. */
  | 'private_club'
  /** μόνο με ξαπλώστρα: effectively no free space — you need a paid sunbed set to stay. */
  | 'sunbed_required';

export interface BeachPaidEntry {
  paid: true;
  /** Which kind of payment applies — selects the label + the honest explanation. */
  kind: PaidEntryKind;
  /** Free-text indicative price/range, localized as authored, e.g. "€5 είσοδος" or "15–25€ σετ". */
  priceText?: string;
  /** Numeric hint when known (entrance fee or sunbed-set price). */
  amount?: number;
  currency?: string;
  source: string;
  sourceUrls?: string[];
  /** https://www.openstreetmap.org/<type>/<id> when harvested from OSM. */
  osmUrl?: string;
  /** ISO date this claim was last confirmed. */
  verifiedAt: string;
  confidence: DataConfidence;
  /** SAFETY GATE: true for OSM/bulk imports → UI softens to "φέρεται να χρεώνει / verify". */
  needsVerification: boolean;
  notes?: string;
  /** Region the source placed it under, for audit traceability. */
  region?: string;
  /** Provenance of the name→record match, mirroring seatrac/blueFlag2026. */
  match?: { officialNameGr?: string; officialNameEn?: string; matchMethod: string; matchScore: number };
}

/**
 * A third-party PUBLIC webcam that shows this beach. Always linked, never embedded
 * (no CSP change, no bandwidth, no licence question). Added 26/08/2026 after Search
 * Console showed ~700 impressions/90d for «<beach> κάμερα / live cam» landing on beach
 * pages that had no camera to offer. Only pages a person opened and saw a live image
 * of THIS beach on go in — `verifiedAt` is that date, not a guess.
 */
export interface BeachWebcam {
  /** The camera's page (not the stream URL). */
  url: string;
  /** Who runs it, shown next to the link so the reader knows it is not ours. */
  operator: string;
  /** ISO date someone opened the page and saw a live image of this beach. */
  verifiedAt: string;
  source: 'manual';
}

export interface BeachMetadata {
  access: {
    type: BeachAccessType;
    label: string;
    notes: string;
    /** Set by the OSM access-road audit when a confident "asphalt" claim could not be
     * corroborated (nearest paved road far, only a track/footpath nearby). The UI then
     * shows honest "likely easy — not verified" instead of confident "paved road". */
    roadSurfaceUnverified?: boolean;
  };
  terrain: {
    types: BeachTerrainType[];
    label: string;
  };
  waterDepth?: {
    type: WaterDepth;
    label: string;
    notes?: string;
  };
  fetchExposure?: FetchExposure;
  seabedSlope?: SeabedSlope;
  waterEntry?: WaterEntry;
  waterQualityRiskAfterRain?: WaterQualityRiskAfterRain;
  nearStreamOrDrain?: boolean;
  nearPort?: boolean;
  urbanRunoffRisk?: boolean;
  officialWarningOverride?: boolean;
  officialWarningReason?: string;
  organized: boolean;
  shade: boolean;
  amenities: string[];
  environment?: {
    quiet?: boolean;
    remote?: boolean;
    familyFriendly?: boolean;
    notes?: string;
  };
  blueFlag2026?: {
    awarded: true;
    year: 2026;
    awardCount: number;
    source: string;
    sourceUrl: string;
    importedAt: string;
    officialEntries: Array<{
      officialNameGr: string;
      officialNameEn: string;
      regionalUnitGr: string;
      regionalUnitEn: string;
      municipalityGr: string;
      municipalityEn: string;
      officialLat?: number;
      officialLon?: number;
      matchMethod: string;
      matchScore: number;
      matchDistanceKm?: number;
    }>;
  };
  seatrac?: BeachSeatracAccess;
  /** Hand-verified public webcam page. Source of truth read by the build. */
  webcam?: BeachWebcam;
  /** Organized campsites within ~2.5 km (OpenStreetMap). Source of truth read by the build. */
  nearbyCamping?: NearbyCampsite[];
  /** "You pay to be here" flag (entrance fee / private club / sunbed-only). Source of truth read by the build. */
  paidEntry?: BeachPaidEntry;
  sourceUrls?: string[];
  sourceNotes?: string | string[];
  googleMapsNavigation?: {
    status: 'verified' | 'unresolved' | 'needs-review' | 'blocked';
    /** Preferred navigation destination: name search vs raw coordinates (set when a cross-island name collision makes place search risky). */
    mode?: 'place' | 'coordinates';
    checkedAt?: string;
    /** Audit pipeline that produced the status, e.g. 'osm-nav-audit-v1'. */
    method?: string;
    query?: string;
    placeId?: string;
    reason?: string;
  };
  /** Crowd/popularity badge derived from Google review count (proxy for how visited a beach is). */
  popularity?: {
    tier: 'secluded' | 'quiet' | 'moderate' | 'popular' | 'crowded';
    rating?: number | null;
    ratingCount?: number;
    source?: string;
    checkedAt?: string;
  };
  mapCoordinates?: BeachMapCoordinates;
  orientation?: Partial<BeachOrientation>;
  windProfile?: WindProfile;
  confidence?: 'high' | 'medium' | 'low';
  language?: string;
  batch?: string;
}

import { ExposureLevel } from './utils/windExposure';

export interface GeospatialExposureSector {
  level: ExposureLevel;
  fetchKm: number;
  blockedRayRatio: number;
  /** Onshore wind component for this sector, -1 (offshore) .. 1 (onshore). */
  onshore?: number;
  /** Continuous exposure intensity 0-100 (0 = calm, 100 = fully exposed). */
  intensity?: number;
}

export type GeospatialExposureSource = 'natural-earth-baseline' | 'high-res-coastline';

export interface GeospatialExposureProfile {
  beachId: number;
  /** Direction the beach faces (seaward shoreline normal), 0-360, or null. */
  facingDeg?: number | null;
  sectors: Record<WindSector, GeospatialExposureSector>;
  confidence: DataConfidence;
  source: GeospatialExposureSource;
  /**
   * Where to ask the wave model about this beach — a point pushed offshore along the beach's own
   * open fetch (scripts/buildMarineSamplePoints.mjs). The pin itself is on the coast, so the
   * marine grid's nearest sea cell can land in a different body of water entirely. Absent for
   * enclosed coves, which have no open-water cell that describes their water.
   */
  marineSamplePoint?: { lat: number; lon: number; bearingDeg: number; distanceKm: number };
  /**
   * FALSE when our own audit found the wave cell this beach ends up asking describes OTHER water
   * — another bay, or a cell too far away (scripts/auditMarineCellTrust.mjs, 255 beaches).
   * Trusted beaches carry no flag at all, so absence means "nothing wrong was found".
   */
  marineCellTrusted?: boolean;
  /**
   * ΠΟΥ ΕΧΕΙ ΣΤΕΡΙΑ ΚΟΝΤΑ, ΑΝΑ 15° — 24 χαρακτήρες '0'/'1', θέση 0 = 0°, '1' = στεριά μέσα στα
   * πρώτα 300 μ. προς τα εκεί (utils/offshoreWindNote.WIND_SHADOW_LAND_KM).
   *
   * Δεν είναι δεύτερο `fetchKm`. Οι 8 φέτες απαντούν «πόσο ανοιχτή θάλασσα υπάρχει» με βήμα
   * ακτίνας 200 μ.· αυτό απαντάει «ήρθε ο άνεμος πάνω από στεριά;» με βήμα 50 μ., που είναι η
   * μόνη ανάλυση στην οποία φαίνεται μια ράχη 100-150 μ. Μετρημένη διαφορά στη Λυγαριά #636:
   * φέτα ΒΔ = 5,00 χλμ, πραγματικό = 0,13 (38,5×, reports/geometry/ray-step-aliasing.json).
   *
   * ΤΟ ΔΙΑΒΑΖΕΙ ΜΟΝΟ ΜΗ-ΒΑΘΜΟΛΟΓΙΚΟ ΚΑΝΑΛΙ (utils/offshoreWindNote). Καμία βαθμολογία, κανένα
   * χρώμα, καμία ετυμηγορία δεν το αγγίζει — και δεν επιτρέπεται να αρχίσουν χωρίς εθνική
   * μέτρηση, γιατί κάθε τέτοιος κανόνας μετρήθηκε τρεις φορές και απορρίφθηκε (βίβλος §Μ6).
   */
  windShadow?: string;
}

/**
 * Unified, always-definite wind-exposure outcome for one beach under one live
 * wind. The resolver guarantees a concrete `level` and `reason`; `confidence`
 * is internal (sorting/tiebreaks) and is never surfaced to the user as doubt.
 */
export interface WindExposureResult {
  level: ExposureLevel;
  intensity: number;
  facingDeg: number | null;
  effectiveFetchKm: number;
  onshore: number;
  modeledWaveHeightM: number;
  reason: string;
  confidence: DataConfidence;
}

export interface SuitableBeach {
  beachId: number;
  name: string;
  score: number;
  swimmingScore?: number;
  experienceScore?: number;
  preferenceScore?: number;
  finalSuitabilityScore?: number;
  swimmingComfort?: SwimmingComfort;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  explanation: string;
  distance?: number;
  beach: Beach;
  bestBeachTime?: any;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  isExposed: boolean;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
  marine?: MarineForecast;
  /** Display height (m). Rewritten by the cove guard — never make a decision from it. */
  waveHeightM?: number;
  /** Decision-grade sea state (m) + its period. See BeachScore.seaStateWaveM. */
  seaStateWaveM?: number;
  /**
   * TRUE when the wave cell behind this item's sea describes other water (GeospatialExposure
   * Profile.marineCellTrusted === false). Read by the podium's trust gate, and only on days the
   * sea is doing the talking — see UNTRUSTED_CELL_SEA_FLOOR_M.
   */
  marineCellUntrusted?: boolean;
  seaStatePeriodS?: number;
  /**
   * THE MODELLED HEIGHT AT THE SAND (m), or undefined — which is the normal answer.
   *
   * Present only where the wind blows OFF the land into a land-blocked, essentially fetch-free
   * sector with no swell and high-confidence geometry (utils/shoreWave, four gates). It is the
   * same value the beach page has printed as «Κύμα στην ακτή» since 05/08/2026, carried onto the
   * card and into the podium's ranking so all three read one number instead of three.
   *
   * Unlike `waveHeightM` this one IS a decision input — see the podium's sea tier in
   * services/topPickRanking. It is modelled, never measured, and it says so on screen with a «~».
   */
  shoreWaveHeightM?: number;
  /**
   * ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ ΓΙΑ ΚΑΘΕ ΠΑΡΑΛΙΑ (m) — ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΤΥΠΩΝΕΤΑΙ. DISPLAY-ONLY.
   *
   * Ο Μίλτος, 13/08/2026, με στιγμιότυπο δύο καρτών δίπλα-δίπλα («1,4 μ. ανοιχτά» και «~0,2 μ.»):
   * «θέλω να μετράνε το ίδιο, όχι να λένε διαφορετικά πράγματα· θέλω να βλέπω στην ακτή τι γίνεται
   * εκεί». Δύο κάρτες τύπωναν δύο ΔΙΑΦΟΡΕΤΙΚΑ ΜΕΓΕΘΗ — θάλασσα 10 χλμ έξω vs νερό στην άμμο — και
   * τίποτα πάνω στην οθόνη δεν το έλεγε.
   *
   * ΔΕΝ ΕΙΝΑΙ ΝΕΟ ΜΟΝΤΕΛΟ. Είναι το `shoreWaveM` που το scoring υπολογίζει ήδη για κάθε παραλία
   * (services/recommendationService) και που η ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ διαβάζει από τις 10/08 (§7η),
   * όπως και το ταβάνι του χρώματος (utils/suitabilityTone). Μέχρι σήμερα δεν έβγαινε ποτέ στην
   * οθόνη: η εφαρμογή ΤΥΠΩΝΕ ένα νούμερο και ΕΚΡΙΝΕ με άλλο.
   *
   * ⚠️ ΓΙΑΤΙ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ ΠΕΔΙΟ ΚΑΙ ΔΕΝ ΕΝΩΘΗΚΕ ΜΕ ΤΟ `shoreWaveHeightM`. Εκείνο είναι DECISION
   * KEY — μπαίνει στους 25 πόντους «νερό» του podium (utils/topPickScoreTable) και στον κλάδο
   * ακτής της ετυμηγορίας. Αν το πλάταινε κανείς ώστε να μιλάει για κάθε παραλία, θα άλλαζε η
   * ΣΕΙΡΑ ΤΩΝ ΠΡΟΤΑΣΕΩΝ σε όλη τη χώρα. Μετρήθηκε εθνικά (βίβλος §Γ5, 110/110 περιοχές, 2.854
   * παραλίες) και η υπόσχεση ήταν ρητή: αλλάζει ΜΟΝΟ η οθόνη. Άρα: ΠΟΤΕ σε scoring, ΠΟΤΕ σε
   * κατάταξη, ΠΟΤΕ σε χρώμα, ΠΟΤΕ σε ετυμηγορία — μόνο σε τυπωμένο αριθμό.
   *
   * ΤΙ ΕΙΝΑΙ ΦΥΣΙΚΑ: εκτεθειμένη ή μερικώς προστατευμένη ακτή → ΙΔΙΟ με το ανοιχτό νερό (2.104 από
   * 2.854 παραλίες δεν αλλάζουν καθόλου νούμερο)· προστατευμένη ΚΑΙ από τη μεριά που έρχεται η
   * θάλασσα → ο μισός (§Γ2)· κλειστός όρμος με απόγειο άνεμο → η εκτίμηση SMB της §7δ.
   *
   * ΤΟ ΟΡΙΟ, ΓΡΑΜΜΕΝΟ: ο συντελεστής 0,5 είναι παραδοχή του σπιτιού από 01/08, ΟΧΙ μέτρηση — για
   * ακτογραμμή δεν υπάρχει κριτής (§7δ). Γι' αυτό τυπώνεται με «~» και με τη δική του ετικέτα.
   */
  shoreDisplayWaveM?: number;
  /**
   * Η γωνιακή έκπτωση σκιάς K_d (utils/seaArrival.resolveShoreShadowDamping, 24/08/2026) που
   * εφάρμοσε/θα εφάρμοζε το protected σκέλος της shoreSeaStateM. Ταξιδεύει με το score ώστε
   * πινέζα, κάρτα και ετυμηγορία να διαβάζουν τον ΙΔΙΟ συντελεστή — passed, not derived.
   * undefined = χωρίς γεωμετρία/κατεύθυνση → όλα πέφτουν στο ιστορικό 0,5.
   */
  shoreShadowDamping?: number;
  /** Ο αριθμός ακτής ήρθε από μετρημένη απόδειξη ότι το νερό φεύγει, όχι από την έκπτωση ×0,5 (§Γ55/§Γ56). */
  shoreWaveFromDepartingSea?: boolean;
  /** Θερμοκρασία νερού (°C) — DISPLAY-ONLY. Βλ. utils/waterTemperatureCopy. */
  seaTemperatureC?: number;
  /**
   * Exposure of the sector TODAY'S SEA is arriving from — utils/seaArrival.resolveSeaArrivalExposureLevel.
   * Not the wind's exposure: an offshore breeze makes a shore 'protected' while a swell rolls in
   * through a wide-open sector (Καβαλικευτά, 13/08/2026). Carried on the score so the map pin, the
   * card chip and the swim verdict all refuse the ×0,5 shelter discount on the same evidence.
   * `undefined` = no opinion, and every consumer then behaves exactly as it did before.
   */
  seaArrivalExposureLevel?: string;
  /**
   * Τα σενάρια της πρόγνωσης διαφωνούν για τη ΜΕΡΑ που βαθμολογήθηκε
   * (utils/forecastUncertainty). Ταξιδεύει ως την πινέζα ώστε χάρτης και κάρτα να
   * φρενάρουν μαζί. Απουσία = δεν ξέρουμε = καμία αλλαγή.
   */
  forecastUncertain?: boolean;
  /** Wind (km/h) this beach was scored with, so its card Beaufort matches its same-wind wave. */
  windSpeedKmph?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  weatherSource?: WeatherSource;
  hourlySeaScore?: number;
  windProfile?: WindProfile;
  windProfileSource?: WindProfileSource;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  /** Closed-cove (όρμος) morphology: >225° contiguous enclosure with a narrow (≤135°)
   *  mouth, or a curated iconic cove (wind-sport spots vetoed). With
   *  canClaimWindProtection true, the cove genuinely stays calm today. */
  enclosedCove?: boolean;
  seaCalmClaimAllowed?: boolean;
  simpleWindSuitability?: SimpleWindSuitability;
  geospatialExposure?: GeospatialExposureProfile;
  /** How this beach behaves in a typical Meltemi (N/NE summer wind). */
  meltemiExposure?: ExposureLevel;
  /** Localised, directional one-line explanation of today's wind exposure. */
  windExposureReason?: string;
}

export interface BeachForecastContext {
  forecast: DailyForecast[];
  source: WeatherSource;
  clusterKey: string;
  /** epoch ms when this forecast's raw data was fetched from Open-Meteo (freshness gate). */
  fetchedAt?: number;
}

export interface SecretBeach {
  beachId: number;
  name: string;
  explanation: string;
  secretScore: number;
  distance?: number;
  isExposed: boolean;
  crowdLevel?: CrowdLevel;
  beach: Beach;
}

export interface Island {
  id: string;
  name: { [key in LanguageCode]: string };
  group: 'cyclades' | 'dodecanese' | 'sporades' | 'north_aegean' | 'crete' | 'ionian' | 'attica' | 'argosaronic' | 'euboea' | 'mainland_peloponnese' | 'mainland_central' | 'mainland_thessaly' | 'mainland_epirus' | 'mainland_macedonia' | 'mainland_thrace' | 'mainland_west_greece' | 'other';
  coordinates: { lat: number; lon: number; };
  beaches: Beach[];
  // Total beaches in the region, taken from the region index. Present on lazily
  // loaded "shell" islands (whose `beaches` array is still empty until the region
  // is opened) so surfaces like the landing can show an accurate count without
  // forcing every region's beach data to load up front.
  beachCount?: number;
}

export interface WeatherData {
  wind: { speed: number; deg: number; gust?: number; gustKnots?: number; windGustKnots?: number; speedBeforeGustFloor?: number; speedBeforeOverWater?: number; };
  weather: { main: string; description: string; icon: string; };
  main: { temp: number; };
  marine?: MarineForecast;
}

export interface ForecastItem {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number; pressure: number; sea_level: number; grnd_level: number; humidity: number; temp_kf: number; };
  weather: { id: number; main: string; description: string; icon: string; }[];
  clouds: { all: number; };
  wind: {
    speed: number;
    deg: number;
    gust: number;
    gustKnots?: number;
    /**
     * The LAND cell's hourly mean EXACTLY as Open-Meteo reported it, before utils/windGustFloor
     * raised it. Present only when the floor actually fired.
     *
     * Exists for one reason: five thresholds judge "is it gusty" from gust MINUS mean
     * (recommendationService GUST_*_SPREAD_KMH, waveModel WIND_CHOP_GUST_NOTE_SPREAD_KMH).
     * Raising the mean shrinks that difference, which would silently DELETE gust warnings —
     * measured nationally at 918 beach-hours losing the wave/note gate and 366 losing the
     * effective-Beaufort bump. Gustiness is a property of the real flow, so it must be measured
     * against the real mean, never the corrected one.
     *
     * It stays the LAND mean even after utils/overWaterWind swaps the sea cell's speed in
     * (25/08/2026): the gust on this item is still the land gust, so the spread must be
     * land-minus-land. Readers fall back `speedBeforeGustFloor ?? speedBeforeOverWater ?? speed`.
     */
    speedBeforeGustFloor?: number;
    /**
     * The direction EXACTLY as the land forecast cell reported it, before utils/overWaterWind
     * swapped in the direction over the water in front of the beach. Present only when the swap
     * actually happened.
     *
     * Same contract as `speedBeforeGustFloor` above: the corrected value is what every colour,
     * word and wave reads, and the original stays reachable so a gate can measure the swap
     * instead of guessing at it. See utils/overWaterWind.ts and PORISMA §Γ29/§Γ37β for the
     * measurement — the sea cell reads the right 45° sector 1,4-1,5× more often than the land
     * cell whenever the two disagree and the land cell sits 3 km or more away.
     */
    degBeforeOverWater?: number;
    /**
     * The speed (m/s) that was on screen before utils/overWaterWind swapped in the sea cell's
     * speed — i.e. the LAND cell's mean AFTER the gust floor / decompression. Present only when
     * the swap actually moved the number.
     *
     * Measurement: reports/weather/sea-cell-speed-by-distance-*.json (§Γ51, two independent
     * windows) and sea-cell-production-21d.json (§Γ52, production vs production, re-judged
     * 25/08/2026 against the decompressed land leg). Decision Miltos 25/08/2026: sea speed for
     * every beach whose land cell sits ≥3 km away.
     *
     * Two jobs: (1) a gate can measure the swap instead of guessing at it; (2) the gust-spread
     * readers use it as the fallback mean when `speedBeforeGustFloor` is absent, because the
     * gust on this item is the land gust and a land gust minus a sea mean is not a spread.
     */
    speedBeforeOverWater?: number;
  };
  rain?: { '3h'?: number };
  visibility: number;
  pop: number;
  /** Open-Meteo hourly precipitation probability as a 0–1 fraction, when available. */
  precipitationProbability?: number;
  sys: { pod: 'd' | 'n'; };
  dt_txt: string;
  marine?: MarineForecast;
  uvIndex?: number;
}

export interface DailyForecast {
  date: Date;
  wind: { speed: number; deg: number; gust?: number; gustKnots?: number; windGustKnots?: number; speedBeforeGustFloor?: number; speedBeforeOverWater?: number; };
  weather: { main: string; description: string; icon: string; };
  temp_min: number;
  temp_max: number;
  hourly: ForecastItem[];
  marine?: MarineForecast;
  /**
   * Τα 51 σενάρια του ECMWF διαφωνούν για αυτή τη μέρα σε αυτή την περιοχή — δες
   * utils/forecastUncertainty. Μπαίνει ΜΟΝΟ από αύριο και μετά, ποτέ σήμερα, και το μόνο που
   * κάνει είναι να απαγορεύει το «ΙΔΑΝΙΚΗ»/«ιδανικά». Απουσία = δεν ξέρουμε = καμία αλλαγή.
   */
  forecastUncertain?: boolean;
}

export interface SavedItinerary {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export type Translation = {
  headerTitlePart1: string;
  headerTitlePart2: string;
  headerStudioName: string;
  headerSubtitle: string;
  currentWind: string;
  location: string;
  direction: string;
  speed: string;
  windStrength: string;
  shelteredTitle: string;
  shelteredDescription: (windDirection: WindDirection, dayContext: string, isToday: boolean) => string;
  noShelteredBeaches: string;
  noWeatherRecommendedBeaches: string;
  exposedTitle: string;
  exposedDescription: (windDirection: WindDirection, dayContext: string, isToday: boolean) => string;
  allBeachesSheltered: string;
  calmWindTitle: (dayContext: string) => string;
  calmWindTitleWithShift: (dayContext: string) => string;
  calmWindDescription: (windStrength: string, dayContext: string, isToday: boolean) => string;
  calmWindDescriptionWithShift: (windStrength: string, shiftTime: string, beaches: string) => string;
  nightSwimTitle: string;
  nightSwimDescription: string;
  dayOverMessageTitle: string;
  dayOverMessageDescription: string;
  earlyMorningMessageTitle: string;
  earlyMorningMessageDescription: string;
  footer: string;
  loading: string;
  errorTitle: string;
  defaultErrorMessage: string;
  tryAgain: string;
  access: string;
  accessNotesTitle: string;
  navigate: string;
  shelteredTooltip: string;
  exposedTooltip: string;
  refresh: string;
  refreshing: string;
  lastUpdated: string;
  mockDataTitle: string;
  mockDataMessage: string;
  amenitiesTitle: string;
  organizedTooltip: string;
  filterTitle: string;
  filterExplanation: string;
  filterAll: string;
  clearFiltersLabel: string;
  toggleFilterForLabel: string;
  beachCharacteristicsTitle: string;
  waveConditionsTitle: string;
  forecastTitle: string;
  today: string;
  tomorrow: string;
  onDay: (dayName: string) => string;
  forecastFor: string;
  locale: string;
  itineraryPlannerTitle: string;
  itineraryPlannerDescription: string;
  durationLabel: string;
  days: (count: number) => string;
  generateButton: string;
  generatingMessage: string;
  itineraryError: string;
  sortByTitle: string;
  sortByRecommended: string;
  sortByAll: string;
  sortByProtected: string;
  sortByTopRated: string;
  sortByDistance: string;
  sortedByDistance: string;
  beachSearchFilters: {
    searchLabel: string;
    searchPlaceholder: string;
    resultCount: (count: number) => string;
    activeFiltersLabel: string;
    clearAll: string;
    clearSearch: string;
    removeFilter: (label: string) => string;
    emptyTitle: string;
    emptyDescription: string;
    // Empty state for a SEARCH that matched nothing, as opposed to filters that
    // matched nothing. Most people who reach the empty list never touched a filter —
    // they searched a beach that belongs to another region — so the generic
    // "no beaches match these filters" was telling them to undo something they had
    // not done. See docs/team/12-growth-analytics.md (diagnosed 2026-07-28).
    emptySearchTitle: (query: string) => string;
    emptySearchDescription: string;
    searchAllRegions: string;
    // Same miss, but the visitor is in "Near me" — a circle around their GPS, not a
    // region they chose. "In this area" names nothing they picked, and "it may belong
    // to another region" is usually false: the beach is often in the SAME prefecture,
    // just further than we looked. Measured 11-12/08/2026: Near me was the single
    // largest bucket of empty results (26%).
    nearMeSearchTitle: (query: string) => string;
    // Preferred form: we can price the miss in kilometres for free, because the name
    // index and the geo index are both already in memory when the card renders.
    nearMeSearchTitleWithDistance: (query: string, km: number) => string;
    nearMeSearchDescription: string;
    // "Clear all" talks about filters the Near-me visitor never set; the action they
    // actually want is to go back to the beaches around them.
    backToNearMe: string;
  };
  gettingLocation: string;
  locationErrorPermission: string;
  locationErrorUnavailable: string;
  locationErrorTimeout: string;
  locationErrorGeneric: string;
  distanceAway: (dist: string) => string;
  favoritesTitle: string;
  noFavoriteBeaches: string;
  favoriteBeachesDescription: string;
  closeModalLabel: string;
  openFiltersLabel: string;
  filtersButtonLabel: string;
  travelStyleTitle: string;
  beachOfTheDayTitle: string;
  beachOfTheDayDescription: (beachName: string) => string;
  learnMore: string;
  chatTitle: string;
  chatInitial: string;
  chatPlaceholder: string;
  chatWarning: string;
  newChat: string;
  showMore: string;
  showLess: string;
  gettingLocationForChat: string;
  locationShared: string;
  locationErrorForChat: string;
  retryLocation: string;
  resetFilters: string;
  applyFilters: string;
  ratingSourceGoogle: string;
  viewGoogleReviews: string;
  accuracyLabel: string;
  relativeTime: {
    now: string;
    minuteAgo: string;
    minutesAgo: (minutes: number) => string;
    hourAgo: string;
    hoursAgo: (hours: number) => string;
    yesterday: string;
    daysAgo: (days: number) => string;
  };
  temperatureLabel: string;
  conditionLabel: string;
  weatherConditions: Record<string, string>;
  navigateToLabel: (beachName: string) => string;
  navigationBadge: {
    boatAccess: string;
    unavailable: string;
    unverified: string;
  };
  windUnitSelectionLabel: string;
  units: {
    beaufort: string;
    mph: string;
    beaufortFull: string;
    mphFull: string;
  };
  windDirections: { [key in WindDirection]: string };
  windDirectionsAccusative: { [key in WindDirection]: string };
  windDirectionsShort: { [key in WindDirection]: string };
  accessibility: { [key in Accessibility]: string };
  filterOptions: {
    organized: string;
    naturalShade: string;
    taverna: string;
    beachBar: string;
    sunbeds: string;
    restaurant: string;
    parking: string;
    shower: string;
    sandy: string;
    pebbles: string;
    quiet: string;
    snorkeling: string;
    adventure: string;
    sunset: string;
    naturist: string;
    familyFriendly: string;
    'sandy-pebbles': string;
    rocky: string;
    unknown: string;
    deepWaters: string;
    shallowWaters: string;
    easyAccess: string;
    disabledAccess: string;
    showAll: string;
  };
  waveConditions: {
    calm: string;
    moderate: string;
    rough: string;
  };
  beaufortScale: (speedKmph: number) => string;
  travelStyles: {
    family: string;
    couple: string;
    friends: string;
    solo: string;
  },
  filterByCharacteristics: string;
  clearCharacteristicFiltersLabel: string;
  characteristics: {
    deepWaters: string;
    shallowWaters: string;
  };
  beachDetailModal: {
    whyToday: string;
    localsTip: string;
    whatToPack: string;
  };
  audioGuide: {
    title: (beachName: string) => string;
    playButton: string;
    stopButton: string;
    dismiss: string;
    loading: string;
  };
  hourlyForecast: {
    title: string;
    time: string;
    direction: string;
    strength: string;
    showDetails: string;
    hideDetails: string;
  };
  sharing: {
    buttonLabel: string;
    title: string;
    text: (beachName: string) => string;
  };
  savedItineraries: {
    title: string;
    saveButton: string;
    planSaved: string;
    noSavedPlans: string;
    noSavedPlansDesc: string;
    savedOn: (date: string) => string;
    deleteButton: string;
    shareButton: string;
    viewPlan: string;
    sharingText: (planName: string) => string;
    editButton: string;
    saveChangesButton: string;
    cancelButton: string;
    editNameLabel: string;
    editContentLabel: string;
  };
  weatherAlert: {
    title: string;
    message: (beaufortLevel: number, windDirection: string) => string;
  };
  winterSwimming: {
    seasonActive: string;
    waterTempNote: string;
    safeConditionsTitle: string;
    safeConditionsDescription: (windStrength: string) => string;
    unsafeConditionsTitle: string;
    unsafeConditionsDescription: string;
    tipsTitle: string;
    tip1: string;
    tip2: string;
    tip3: string;
    tip4: string;
    tip5: string;
  };
  confirmation: {
    deleteItineraryTitle: string;
    deleteItineraryMessage: string;
    resetFiltersTitle: string;
    resetFiltersMessage: string;
    confirmButton: string;
    cancelButton: string;
  };
  islandSelector: {
    title: string;
    searchPlaceholder: string;
    showingFor: string;
    changeIsland: string;
    useCurrentLocation: string;
    groups: {
      cyclades: string;
      dodecanese: string;
      sporades: string;
      north_aegean: string;
      crete: string;
      ionian: string;
      attica: string;
      argosaronic: string;
      euboea: string;
      mainland_peloponnese: string;
      mainland_central: string;
      mainland_thessaly: string;
      mainland_epirus: string;
      mainland_macedonia: string;
      mainland_thrace: string;
    }
  };
  notifications: {
    permissionRequestMessage: string;
    subscribedMessage: string;
    blockedMessage: string;
    alreadySubscribed: string;
    unsubscribed: string;
    subscriptionError: string;
  };
  themeToggle: {
    light: string;
    dark: string;
  };
  suggestionChips: {
    beachOfTheDay: (beachName: string) => string;
    calmDayBeach: string;
    windyDayActivity: string;
    food: string;
    boatTrip: string;
    hiddenGem: string;
    altBeach: (beachName: string) => string;
    planMorning: string;
    sunset: string;
    dinner: string;
    eveningWalk: string;
    tomorrowWeather: string;
    planTomorrow: string;
  };
  userPreferences: {
    title: string;
    subtitle: string;
    blueFlag2026?: string;
    disabledAccess?: string;
    sandy: string;
    pebbles: string;
    quiet: string;
    beachBar: string;
    familyFriendly: string;
    snorkeling: string;
    deepWater: string;
    shallowWater: string;
    surfing: string;
    parking: string;
    easyAccess: string;
  };
  crowdLevels: {
    low: string;
    medium: string;
    high: string;
  };
};
