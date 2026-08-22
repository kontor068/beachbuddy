
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShowerHead, MapPin, Star, Share2, Heart, Navigation, Info, Waves, Utensils, Trees, CircleDot, CircleDotDashed, Mountain, Droplets, ArrowDown, BadgeCheck, Leaf, Shield, Users, Clock3, Flag, Footprints, Wind, Tent, Ticket, Euro, Medal, Camera, Accessibility as AccessibilityIcon, Thermometer } from 'lucide-react';
import { SHORE_LABELS, READ_LABELS } from './BeachAnswerHero';
import { Beach, Accessibility, LanguageCode, BeachType, CrowdLevel, WarningFlag, RecommendationConfidence, SwimmingComfort, WindSuitabilityColor, PaidEntryKind } from '../types';
import { Translation } from '../types';

import { canOpenNavigation, getNavigationBadge, openNavigation } from '../utils/navigation';
import { BeachConditionScore } from './BeachConditionScore';
import { TodayScoreBadge } from './TodayScoreBadge';
import { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } from '../utils/waveCharacter';
import { buildBeachConditionsReadout, beachDecisionSeaStateM } from '../utils/beachConditionsReadout';
import { buildWaterTemperatureCardLine } from '../utils/waterTemperatureCopy';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { trackEvent, buildBeachExposureParams } from '../services/analyticsService';
import { ExposureLevel } from '../utils/windExposure';
import { hasBoatOnlyAccess, hasDirtRoadAccess } from '../utils/access';
import { getSeatracOutOfSeasonNote, getSeatracRampState, SeatracRampState } from '../utils/accessibility';
import { isCalmBeachCertified } from '../utils/certifiedBeaches';
import { getSelectedDayPrefix, getSelectedDaySentencePrefix, getSelectedHourPrefix, isSelectedDateToday } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';
import { buildBeachDetailPath, buildBeachShareUrl } from '../utils/beachUrls';
import {
  displayBeachName,
  localizedAccessLabel,
  localizedAccessPrefix,
  localizedBeachDescription,
  localizedShadeLabel,
  localizedTerrainLabel,
  localizedWaterDepthLabel,
  isWaterDepthUnverified,
  localizedPopularityLabel,
  localizedLittleKnownLabel,
  localizedPaidEntryLabel,
  localizedPaidEntryExplanation,
} from '../utils/localization';
import { AmenityChip, AmenityChipKey, AmenityStatusRow, getAmenityChips, getAmenityStatusRows } from '../utils/amenities';
import { SandDotsIcon, SandPebblesIcon, SunbedIcon } from './BeachFeatureIcons';
import { BeachPhotoFallback } from './ShorelineThumbnail';

interface BeachCardProps {
  beach: Beach & { distance?: number };
  isExposed?: boolean;
  language: LanguageCode;
  t: Translation;
  isCalm?: boolean;
  /** Island/region wind (m/s) — the fallback when no beach-specific wind is supplied. */
  windSpeed: number;
  /** This beach's own scored wind (km/h, beach-cluster when available). Preferred over `windSpeed`
   *  so the card's Beaufort matches its same-wind wave value. */
  beachWindSpeedKmph?: number;
  /** Display height (m) — the number shown to the user. */
  waveHeightM?: number;
  /** Decision-grade sea state + period (BeachScore.seaStateWaveM / seaStatePeriodS). Everything
   *  that decides a colour or a word reads these; `waveHeightM` is display only. */
  seaStateWaveM?: number;
  seaStatePeriodS?: number;
  /** Modelled height AT THE SAND (m) where utils/shoreWave is entitled to speak — undefined
   *  everywhere else. This is the figure the podium card prints, because it is the water the
   *  reader is standing in; see the wave line below. */
  shoreWaveHeightM?: number;
  shoreDisplayWaveM?: number;
  shoreWaveFromDepartingSea?: boolean;
  /** Θερμοκρασία νερού (°C) — DISPLAY-ONLY, βλ. utils/waterTemperatureCopy. */
  seaTemperatureC?: number;
  temperature?: number;
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  islandName: string;
  regionId?: string;
  showIslandName?: boolean;
  onClick?: () => void;
  todayScore?: number;
  variant?: 'default' | 'decision';
  density?: 'regular' | 'compact';
  recommendationRank?: number;
  recommendationLabel?: string;
  bestSwimWindow?: string;
  bestBeachTime?: { bestStart?: string; bestEnd?: string };
  topPickTimeLabel?: string;
  /** «Γιατί δεν είναι στις προτάσεις» — computed upstream, printed verbatim, silent when absent. */
  notInTopPicksNote?: string;
  selectedDate?: Date;
  selectedHour?: number;
  crowdLevel?: CrowdLevel;
  exposureLevel?: ExposureLevel;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  swimmingComfort?: SwimmingComfort;
  canClaimWindProtection?: boolean;
  /** Closed-cove (όρμος) morphology — upgrades the sheltered chip/label wording. */
  enclosedCove?: boolean;
  seaCalmClaimAllowed?: boolean;
  strongWindContext?: boolean;
  lessExposedToday?: boolean;
  windSuitabilityText?: string;
  windSuitabilityColor?: WindSuitabilityColor;
  hideExposureBadge?: boolean;
  /**
   * Controls the wind-exposure chip on the card:
   * - 'none': never show it (e.g. "best beaches" — no explanation needed)
   * - 'simple': only show it when a beach is clearly more protected or more exposed
   * - undefined: legacy behaviour
   */
  windExposureMode?: 'none' | 'simple';
  showTodayScoreBadge?: boolean;
  /**
   * Surface the today-verdict pill even in the 3–4 Bft band the badge normally
   * hides, and (on mobile) render it in the header in place of the wind chip.
   * Set on a beach shown for its own sake — e.g. a name-search result — where the
   * card must answer "what's it like there today?" rather than imply a ranking.
   */
  forceTodayScoreBadge?: boolean;
  /**
   * Marks the card as one of the day's curated "Top 3" picks (the podium set).
   * Adds the teal frame + ranked medal so the trio reads as a distinct group,
   * separate from the generic suitable-beach list. Only set this from the
   * top-recommendation surfaces, never from a plain numbered list.
   */
  topPickPodium?: boolean;
}

type CardCopy = {
  shelteredChip: (sentenceDay: string) => string;
  shelteredChipA11y: (sentenceDay: string) => string;
  /** Enclosed-cove (όρμος) variant of the sheltered chip — a MORE protected claim
   *  than plain directional shelter, earned only by genuine cove morphology
   *  (>225° enclosure with a narrow mouth, or a curated iconic cove). */
  enclosedCoveChip: string;
  enclosedCoveChipA11y: string;
  blueFlag: string;
  accessible: string;
  /** Εκτός Ιουν–Σεπτ ο εξοπλισμός συνήθως έχει αφαιρεθεί — το σήμα το λέει, δεν εξαφανίζεται. */
  accessibleSeasonal: string;
  camping: string;
  /** CalmBeach Certified — first-party "we were here and verified it" seal. */
  certified: string;
  certifiedA11y: string;
  dirtRoad: string;
  localExposureCheck: string;
  /** Screen-reader-only clarifier for the compact temperature stat — the glyph alone
   *  cannot say whether a number is air or water. */
  airTemperature: string;
  moreOpenToWind: string;
  exposedToWind: string;
  favorite: string;
  unfavorite: string;
  share: string;
  photoBelow: string;
  warnings: {
    seaEstimate: string;
    highWaves: string;
    someWaves: string;
    /** utils/shoreBreak — deep water + a coarse shore, so a small sea still lands hard. */
    shoreBreak: string;
    /** `heat_uv` info/warning (>32 °C) — η ώρα της ημέρας μετράει περισσότερο από την παραλία. */
    heat: string;
    /** `heat_uv` critical (≥38 °C) — παύει να είναι συμβουλή άνεσης και γίνεται θέμα υγείας. */
    extremeHeat: string;
    /**
     * ΟΙ ΔΕΚΑ ΠΟΥ ΕΛΕΙΠΑΝ (22/08/2026). Μέχρι σήμερα κανένας από αυτούς τους τύπους δεν είχε
     * λεζάντα εδώ, οπότε το `default` του `warningLabel` τύπωνε το αγγλικό μήνυμα του κινητήρα
     * σε Έλληνα, Γάλλο, Γερμανό και Ιταλό επισκέπτη. Η πύλη
     * `scripts/validateWarningLabelCoverage.mjs` δεν αφήνει να ξανασυμβεί.
     *
     * Δεν είναι μεταφράσεις του αγγλικού: το `message` γράφτηκε για μηχανή («High open-water
     * fetch may build chop on this beach») και δεν λέγεται σε παραλιακή κάρτα σε καμία γλώσσα.
     * Τα νούμερα έρχονται από το `WarningFlag.values`, όχι από regex πάνω στο αγγλικό.
     */
    gustyWind: (gustKmph: number) => string;
    offshoreWind: string;
    onshoreChop: string;
    directSwell: (swellHeightM?: number) => string;
    longPeriodSwell: (periodS: number) => string;
    afternoonWindBuild: (peakBeaufort: number, peakHour: number) => string;
    rainAllBeachHours: string;
    rainSomeHours: string;
    waterQualityRisk: string;
    officialWarning: string;
    crowded: string;
    strongWind: string;
    windSportSpot: string;
    exposedToWind: (day: string, isToday: boolean) => string;
    breezy: string;
    difficultAccess: string;
    boatOnly: string;
    lowConfidence: string;
    roughSea: string;
    choppy: string;
  };
  compact: {
    calmWaters: string;
    goodSea: string;
    protected: (sentenceDay: string, isToday: boolean) => string;
    lightWind: string;
    mildlyBreezy: string;
    windyExposed: string;
    partlyShelteredToday: (day: string, isToday: boolean) => string;
    slightlyExposed: string;
    familyFriendly: string;
    shallowWaters: string;
    shallowWatersCaution: string;
    easyAccess: string;
    facilities: string;
    noFacilities: string;
    naturalShade: string;
    goodWithWind: string;
    calmButWindier: string;
    visitorRating: string;
  };
  access: {
    asphaltRoad: string;
    dirtRoad: string;
    difficultDirtRoad: string;
    difficultRoad: string;
    pathAccess: string;
    hardPath: string;
    boatOnly: string;
    moderateAccess: string;
  };
  amenities: Record<AmenityChip['key'], string>;
};

const cardCopy: Record<LanguageCode, CardCopy> = {
  en: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: better sheltered`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: better sheltered option`,
    enclosedCoveChip: 'Enclosed bay',
    enclosedCoveChipA11y: 'Enclosed bay: calmer water even in wind',
    blueFlag: 'Blue Flag',
    accessible: 'Accessible',
    accessibleSeasonal: 'Accessible in summer',
    camping: 'Camping',
    certified: 'CalmBeach Certified',
    certifiedA11y: 'CalmBeach Certified — we visited this beach and verified its details on site',
    dirtRoad: 'Dirt road',
    localExposureCheck: 'Check local shelter',
    airTemperature: 'air temperature',
    moreOpenToWind: 'A bit exposed',
    exposedToWind: 'More exposed to wind',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    share: 'Share',
    photoBelow: 'Photo below',
    warnings: {
      seaEstimate: 'Sea estimate',
      highWaves: 'High waves',
      someWaves: 'Some waves',
      shoreBreak: 'Calm sea, but the waves break a bit harder at the shore',
      heat: 'Very hot — go early morning or late afternoon',
      extremeHeat: 'Extreme heat — avoid the beach 12:00–17:00, bring water and shade',
      gustyWind: (gustKmph) => `Gusts to ${gustKmph} km/h`,
      offshoreWind: 'Wind off the land — it pushes you out',
      onshoreChop: 'Open sea in front — the wind builds chop',
      directSwell: (swellHeightM) => (swellHeightM ? `Swell arrives head-on (~${swellHeightM} m)` : 'Swell arrives head-on'),
      longPeriodSwell: (periodS) => `Long swell (~${periodS} s) — it dumps on the sand`,
      afternoonWindBuild: (peakBeaufort, peakHour) => `Calm now — ${peakBeaufort} Bft by ${peakHour}:00`,
      rainAllBeachHours: 'Rain through the beach hours',
      rainSomeHours: 'Rain likely at times',
      waterQualityRisk: 'Recent rain — water may be murky',
      officialWarning: 'Official warning in force',
      crowded: 'Likely crowded',
      strongWind: 'Strong wind',
      windSportSpot: 'Wind/watersports spot',
      exposedToWind: (day, isToday) => (isToday ? 'More exposed to wind' : `More exposed to wind ${day}`),
      breezy: 'May feel breezy',
      difficultAccess: 'More challenging access',
      boatOnly: 'Boat only',
      lowConfidence: 'Local exposure unverified',
      roughSea: 'Rough sea',
      choppy: 'Choppy',
    },
    compact: {
      calmWaters: 'Low waves',
      goodSea: 'Good sea',
      protected: (moment, isToday) => (isToday ? 'Better sheltered' : `Better sheltered ${moment}`),
      lightWind: 'Light wind',
      mildlyBreezy: 'May feel breezy',
      windyExposed: 'Windy / exposed',
      partlyShelteredToday: (day, isToday) => (isToday ? 'Partial shelter' : `Partial shelter ${day}`),
      slightlyExposed: 'May feel breezy',
      familyFriendly: 'Family',
      shallowWaters: 'Shallow water',
      shallowWatersCaution: 'Shallow water',
      easyAccess: 'Easy access',
      facilities: 'Facilities',
      noFacilities: 'No facilities',
      naturalShade: 'Natural shade',
      goodWithWind: 'Good option, with a little more wind',
      calmButWindier: 'Low waves, but a little windier',
      visitorRating: 'Visitor rating',
    },
    access: {
      asphaltRoad: 'Easy access',
      dirtRoad: 'Dirt road',
      difficultDirtRoad: 'Rough dirt road',
      difficultRoad: 'Difficult road',
      pathAccess: 'Path access',
      hardPath: 'Hard path',
      boatOnly: 'Boat only',
      moderateAccess: 'Moderate access',
    },
    amenities: {
      beachBar: 'Beach bar',
      sunbeds: 'Sunbeds',
      foodNearby: 'Taverna',
      cafeNearby: 'Cafe',
      snackCanteen: 'Canteen',
      parking: 'Parking',
      shower: 'Shower',
      organizedFacilities: 'Facilities',
      noFacilities: 'No facilities',
      seasonalFacilities: 'Seasonal',
      unknownFacilities: 'Unknown',
    },
  },
  gr: {
    shelteredChip: () => 'Πιο προστατευμένη',
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: προστατευμένη επιλογή`,
    enclosedCoveChip: 'Κλειστός όρμος',
    enclosedCoveChipA11y: 'Κλειστός όρμος: πιο ήρεμα νερά ακόμα κι όταν φυσάει',
    blueFlag: 'Γαλάζια Σημαία',
    accessible: 'Προσβάσιμη ΑμεΑ',
    accessibleSeasonal: 'ΑμεΑ το καλοκαίρι',
    camping: 'Camping',
    certified: 'CalmBeach Certified',
    certifiedA11y: 'CalmBeach Certified — το επισκεφθήκαμε κι επαληθεύσαμε επιτόπου τα χαρακτηριστικά του',
    dirtRoad: 'Χωματόδρομος',
    localExposureCheck: 'Έλεγχος τοπικής προστασίας',
    airTemperature: 'θερμοκρασία αέρα',
    moreOpenToWind: 'Λίγο εκτεθειμένη στον άνεμο',
    exposedToWind: 'Πιο εκτεθειμένη στον άνεμο',
    favorite: 'Προσθήκη στα αγαπημένα',
    unfavorite: 'Αφαίρεση από τα αγαπημένα',
    share: 'Κοινοποίηση',
    photoBelow: 'Φωτό πιο κάτω',
    warnings: {
      seaEstimate: 'Εκτίμηση θάλασσας',
      highWaves: 'Υψηλό κύμα',
      someWaves: 'Λίγο κύμα',
      shoreBreak: 'Ήρεμη θάλασσα, αλλά σκάει το κύμα λίγο παραπάνω στην ακτή',
      heat: 'Πολλή ζέστη — πήγαινε νωρίς το πρωί ή αργά το απόγευμα',
      extremeHeat: 'Καύσωνας — απόφυγε την παραλία 12:00–17:00, πάρε νερό και σκιά',
      gustyWind: (gustKmph) => `Ριπές έως ${gustKmph} χλμ/ώρα`,
      offshoreWind: 'Ο αέρας φυσάει από τη στεριά — σε βγάζει ανοιχτά',
      onshoreChop: 'Ανοιχτό πέλαγος μπροστά — σηκώνει κύμα',
      directSwell: (swellHeightM) => (swellHeightM ? `Η φουσκοθαλασσιά έρχεται κατευθείαν (~${swellHeightM} μ.)` : 'Η φουσκοθαλασσιά έρχεται κατευθείαν'),
      longPeriodSwell: (periodS) => `Μακρύ κύμα (~${periodS} δευτ.) — σκάει βαριά στην άμμο`,
      afternoonWindBuild: (peakBeaufort, peakHour) => `Ήρεμα τώρα — ${peakBeaufort} Μποφόρ κατά τις ${peakHour}:00`,
      rainAllBeachHours: 'Βροχή όλες τις ώρες της παραλίας',
      rainSomeHours: 'Πιθανή βροχή κάποιες ώρες',
      waterQualityRisk: 'Πρόσφατη βροχή — ίσως θολό νερό',
      officialWarning: 'Επίσημη προειδοποίηση σε ισχύ',
      crowded: 'Πιθανόν πολύς κόσμος',
      strongWind: 'Δυνατός αέρας',
      windSportSpot: 'Παραλία για wind sports',
      exposedToWind: (day, isToday) => (isToday ? 'Πιο εκτεθειμένη στον άνεμο' : `Πιο εκτεθειμένη στον άνεμο ${day}`),
      breezy: 'Μπορεί να έχει αέρα',
      difficultAccess: 'Πιο δύσκολη πρόσβαση',
      boatOnly: 'Μόνο με σκάφος',
      lowConfidence: 'Θέλει επιβεβαίωση τοπικά',
      roughSea: 'Έντονος κυματισμός',
      choppy: 'Κυματισμός',
    },
    compact: {
      calmWaters: 'Χαμηλό κύμα',
      goodSea: 'Καλή θάλασσα',
      protected: (moment, isToday) => (isToday ? 'Πιο προστατευμένη' : `Πιο προστατευμένη ${moment}`),
      lightWind: 'Ήπιος άνεμος',
      mildlyBreezy: 'Μπορεί να έχει αέρα',
      windyExposed: 'Πιο εκτεθειμένη στον άνεμο',
      partlyShelteredToday: (day, isToday) => (isToday ? 'Μερική προστασία' : `Μερική προστασία ${day}`),
      slightlyExposed: 'Μπορεί να έχει αέρα',
      familyFriendly: 'Για παιδιά',
      shallowWaters: 'Ρηχά νερά',
      shallowWatersCaution: 'Ρηχά νερά',
      easyAccess: 'Εύκολα',
      facilities: 'Παροχές',
      noFacilities: 'Χωρίς παροχές',
      naturalShade: 'Φυσική σκιά',
      goodWithWind: 'Καλή επιλογή, με λίγο περισσότερο αέρα',
      calmButWindier: 'Χαμηλό κύμα, αλλά περισσότερος αέρας',
      visitorRating: 'Βαθμολογία επισκεπτών',
    },
    access: {
      asphaltRoad: 'Εύκολα',
      dirtRoad: 'Χώμα',
      difficultDirtRoad: 'Κακός δρόμος',
      difficultRoad: 'Δύσκολη πρόσβαση',
      pathAccess: 'Μονοπάτι',
      hardPath: 'Δύσκολα',
      boatOnly: 'Με σκάφος',
      moderateAccess: 'Μέτρια πρόσβαση',
    },
    amenities: {
      // «Beach bar» stays Latin on purpose — utils/amenities.ts logged the decision: it is the
      // loanword Greeks actually use. «Πάρκινγκ» is the same decision's OTHER half, which this
      // map never adopted: the app had three spellings and Greek won (2026-08).
      beachBar: 'Beach bar',
      sunbeds: 'Ξαπλώστρες',
      foodNearby: 'Ταβέρνα',
      cafeNearby: 'Καφέ',
      snackCanteen: 'Καντίνα',
      parking: 'Πάρκινγκ',
      shower: 'Ντους',
      organizedFacilities: 'Παροχές',
      noFacilities: 'Χωρίς παροχές',
      seasonalFacilities: 'Εποχικές παροχές',
      unknownFacilities: 'Άγνωστες παροχές',
    },
  },
  fr: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: plus abritée`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: option plus abritée`,
    enclosedCoveChip: 'Baie fermée',
    enclosedCoveChipA11y: 'Baie fermée : eau plus calme même par vent',
    blueFlag: 'Pavillon Bleu',
    accessible: 'Accessible PMR',
    accessibleSeasonal: 'PMR en été',
    camping: 'Camping',
    certified: 'CalmBeach Certified',
    certifiedA11y: 'CalmBeach Certified — nous avons visité cette plage et vérifié ses caractéristiques sur place',
    dirtRoad: 'Piste',
    localExposureCheck: "Exposition locale à vérifier",
    airTemperature: "température de l'air",
    moreOpenToWind: 'Plus ouverte au vent',
    exposedToWind: 'Exposée au vent',
    favorite: 'Ajouter aux favoris',
    unfavorite: 'Retirer des favoris',
    share: 'Partager',
    photoBelow: 'Photo plus bas',
    warnings: {
      seaEstimate: 'Estimation de mer',
      highWaves: 'Vagues hautes',
      someWaves: 'Un peu de clapot',
      shoreBreak: 'Mer calme, mais les vagues déferlent un peu plus au bord',
      heat: 'Très chaud — venez tôt le matin ou en fin d’après-midi',
      extremeHeat: 'Chaleur extrême — évitez la plage 12h–17h, prévoyez eau et ombre',
      gustyWind: (gustKmph) => `Rafales jusqu’à ${gustKmph} km/h`,
      offshoreWind: 'Vent de terre — il pousse vers le large',
      onshoreChop: 'Le large devant — le vent lève du clapot',
      directSwell: (swellHeightM) => (swellHeightM ? `La houle arrive de face (~${swellHeightM} m)` : 'La houle arrive de face'),
      longPeriodSwell: (periodS) => `Houle longue (~${periodS} s) — elle casse fort sur le sable`,
      afternoonWindBuild: (peakBeaufort, peakHour) => `Calme maintenant — ${peakBeaufort} Bft vers ${peakHour} h`,
      rainAllBeachHours: 'Pluie sur toutes les heures de plage',
      rainSomeHours: 'Pluie possible par moments',
      waterQualityRisk: 'Pluie récente — eau peut-être trouble',
      officialWarning: 'Alerte officielle en vigueur',
      crowded: 'Probablement bondée',
      strongWind: 'Vent fort',
      windSportSpot: 'Spot de sports nautiques',
      exposedToWind: (day, isToday) => (isToday ? 'Exposée au vent' : `Exposée au vent ${day}`),
      breezy: 'Peut être venteuse',
      difficultAccess: 'Accès plus difficile',
      boatOnly: 'Bateau uniquement',
      lowConfidence: 'Exposition locale non vérifiée',
      roughSea: 'Mer agitée',
      choppy: 'Clapot',
    },
    compact: {
      calmWaters: 'Vagues basses',
      goodSea: 'Mer correcte',
      protected: (moment, isToday) => (isToday ? 'Plus abritée' : `Plus abritée ${moment}`),
      lightWind: 'Vent léger',
      mildlyBreezy: 'Peut être venteuse',
      windyExposed: 'Venteuse / exposée',
      partlyShelteredToday: (day, isToday) => (isToday ? "Plus à l'abri du vent" : `Plus à l'abri du vent ${day}`),
      slightlyExposed: 'Peut être venteuse',
      familyFriendly: 'Famille',
      shallowWaters: 'Eau peu profonde',
      shallowWatersCaution: 'Eau peu profonde',
      easyAccess: 'Accès facile',
      facilities: 'Services',
      noFacilities: 'Sans services',
      naturalShade: 'Ombre naturelle',
      goodWithWind: 'Bonne option, un peu plus de vent',
      calmButWindier: 'Vagues basses, mais un peu plus de vent',
      visitorRating: 'Note visiteurs',
    },
    access: {
      asphaltRoad: 'Accès facile',
      dirtRoad: 'Piste',
      difficultDirtRoad: 'Piste difficile',
      difficultRoad: 'Route difficile',
      pathAccess: 'Sentier',
      hardPath: 'Sentier difficile',
      boatOnly: 'Bateau uniquement',
      moderateAccess: 'Accès moyen',
    },
    amenities: {
      beachBar: 'Bar de plage',
      sunbeds: 'Transats',
      foodNearby: 'Taverne',
      cafeNearby: 'Café',
      snackCanteen: 'Buvette',
      parking: 'Parking',
      shower: 'Douche',
      organizedFacilities: 'Services',
      noFacilities: 'Sans services',
      seasonalFacilities: 'Saisonnier',
      unknownFacilities: 'Inconnu',
    },
  },
  de: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: geschützter`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: windgeschütztere Option`,
    enclosedCoveChip: 'Geschlossene Bucht',
    enclosedCoveChipA11y: 'Geschlossene Bucht: ruhigeres Wasser auch bei Wind',
    blueFlag: 'Blaue Flagge',
    accessible: 'Barrierefrei',
    accessibleSeasonal: 'Barrierefrei im Sommer',
    camping: 'Camping',
    certified: 'CalmBeach Certified',
    certifiedA11y: 'CalmBeach Certified — wir waren vor Ort und haben die Angaben persönlich geprüft',
    dirtRoad: 'Schotterweg',
    localExposureCheck: 'Lokale Exposition prüfen',
    airTemperature: 'Lufttemperatur',
    moreOpenToWind: 'Offener zum Wind',
    exposedToWind: 'Windexponiert',
    favorite: 'Zu Favoriten hinzufügen',
    unfavorite: 'Aus Favoriten entfernen',
    share: 'Teilen',
    photoBelow: 'Foto weiter unten',
    warnings: {
      seaEstimate: 'Meeres-Schätzung',
      highWaves: 'Hohe Wellen',
      someWaves: 'Etwas Welle',
      shoreBreak: 'Ruhige See, aber die Wellen brechen am Ufer etwas kräftiger',
      heat: 'Sehr heiß — früh morgens oder spät nachmittags hingehen',
      extremeHeat: 'Extreme Hitze — Strand 12–17 Uhr meiden, Wasser und Schatten mitnehmen',
      gustyWind: (gustKmph) => `Böen bis ${gustKmph} km/h`,
      offshoreWind: 'Ablandiger Wind — er treibt dich hinaus',
      onshoreChop: 'Offenes Meer davor — der Wind baut Welle auf',
      directSwell: (swellHeightM) => (swellHeightM ? `Dünung kommt frontal (~${swellHeightM} m)` : 'Dünung kommt frontal'),
      longPeriodSwell: (periodS) => `Lange Dünung (~${periodS} s) — sie bricht hart am Strand`,
      afternoonWindBuild: (peakBeaufort, peakHour) => `Jetzt ruhig — ${peakBeaufort} Bft gegen ${peakHour} Uhr`,
      rainAllBeachHours: 'Regen über die ganzen Strandstunden',
      rainSomeHours: 'Zeitweise Regen möglich',
      waterQualityRisk: 'Kürzlich Regen — Wasser evtl. trüb',
      officialWarning: 'Amtliche Warnung aktiv',
      crowded: 'Vermutlich voll',
      strongWind: 'Starker Wind',
      windSportSpot: 'Wind-/Wassersportspot',
      exposedToWind: (day, isToday) => (isToday ? 'Windexponiert' : `Windexponiert ${day}`),
      breezy: 'Kann windig wirken',
      difficultAccess: 'Schwieriger Zugang',
      boatOnly: 'Nur per Boot',
      lowConfidence: 'Lokale Exposition nicht verifiziert',
      roughSea: 'Raue See',
      choppy: 'Kabbelig',
    },
    compact: {
      calmWaters: 'Niedrige Wellen',
      goodSea: 'Gute See',
      protected: (moment, isToday) => (isToday ? 'Geschützter' : `Geschützter ${moment}`),
      lightWind: 'Leichter Wind',
      mildlyBreezy: 'Kann windig wirken',
      windyExposed: 'Windig / exponiert',
      partlyShelteredToday: (day, isToday) => (isToday ? 'Mehr aus dem Wind' : `Mehr aus dem Wind ${day}`),
      slightlyExposed: 'Kann windig wirken',
      familyFriendly: 'Familie',
      shallowWaters: 'Flaches Wasser',
      shallowWatersCaution: 'Flaches Wasser',
      easyAccess: 'Einfach',
      facilities: 'Ausstattung',
      noFacilities: 'Keine Ausstattung',
      naturalShade: 'Naturschatten',
      goodWithWind: 'Gute Option, etwas windiger',
      calmButWindier: 'Niedrige Wellen, aber etwas windiger',
      visitorRating: 'Besucherwertung',
    },
    access: {
      asphaltRoad: 'Einfach',
      dirtRoad: 'Schotterweg',
      difficultDirtRoad: 'Schwieriger Schotterweg',
      difficultRoad: 'Schwierige Straße',
      pathAccess: 'Fußweg',
      hardPath: 'Schwieriger Fußweg',
      boatOnly: 'Nur Boot',
      moderateAccess: 'Mittlerer Zugang',
    },
    amenities: {
      beachBar: 'Beach Bar',
      sunbeds: 'Liegen',
      foodNearby: 'Taverne',
      cafeNearby: 'Café',
      snackCanteen: 'Imbiss',
      parking: 'Parken',
      shower: 'Dusche',
      organizedFacilities: 'Ausstattung',
      noFacilities: 'Keine Ausstattung',
      seasonalFacilities: 'Saisonal',
      unknownFacilities: 'Unbekannt',
    },
  },
  it: {
    shelteredChip: (sentenceDay) => `${sentenceDay}: più riparata`,
    shelteredChipA11y: (sentenceDay) => `${sentenceDay}: opzione più riparata`,
    enclosedCoveChip: 'Baia chiusa',
    enclosedCoveChipA11y: 'Baia chiusa: acqua più calma anche col vento',
    blueFlag: 'Bandiera Blu',
    accessible: 'Accessibile',
    accessibleSeasonal: "Accessibile d'estate",
    camping: 'Campeggio',
    certified: 'CalmBeach Certified',
    certifiedA11y: 'CalmBeach Certified — abbiamo visitato la spiaggia e verificato le caratteristiche sul posto',
    dirtRoad: 'Strada sterrata',
    localExposureCheck: 'Verifica esposizione locale',
    airTemperature: 'temperatura dell’aria',
    moreOpenToWind: 'Più aperta al vento',
    exposedToWind: 'Esposta al vento',
    favorite: 'Aggiungi ai preferiti',
    unfavorite: 'Rimuovi dai preferiti',
    share: 'Condividi',
    photoBelow: 'Foto più sotto',
    warnings: {
      seaEstimate: 'Stima mare',
      highWaves: 'Onde alte',
      someWaves: 'Un po’ di onda',
      shoreBreak: 'Mare calmo, ma le onde frangono un po’ di più a riva',
      heat: 'Molto caldo — vai la mattina presto o nel tardo pomeriggio',
      extremeHeat: 'Caldo estremo — evita la spiaggia 12:00–17:00, porta acqua e ombra',
      gustyWind: (gustKmph) => `Raffiche fino a ${gustKmph} km/h`,
      offshoreWind: 'Vento da terra — ti spinge al largo',
      onshoreChop: 'Mare aperto davanti — il vento alza onda',
      directSwell: (swellHeightM) => (swellHeightM ? `L’onda lunga arriva di fronte (~${swellHeightM} m)` : 'L’onda lunga arriva di fronte'),
      longPeriodSwell: (periodS) => `Onda lunga (~${periodS} s) — frange forte sulla sabbia`,
      afternoonWindBuild: (peakBeaufort, peakHour) => `Calmo ora — ${peakBeaufort} Bft verso le ${peakHour}`,
      rainAllBeachHours: 'Pioggia per tutte le ore da spiaggia',
      rainSomeHours: 'Possibile pioggia a tratti',
      waterQualityRisk: 'Pioggia recente — acqua forse torbida',
      officialWarning: 'Allerta ufficiale in vigore',
      crowded: 'Probabilmente affollata',
      strongWind: 'Vento forte',
      windSportSpot: 'Spot wind/watersport',
      exposedToWind: (day, isToday) => (isToday ? 'Esposta al vento' : `Esposta al vento ${day}`),
      breezy: 'Può essere ventilata',
      difficultAccess: 'Accesso più difficile',
      boatOnly: 'Solo in barca',
      lowConfidence: 'Esposizione locale non verificata',
      roughSea: 'Mare mosso',
      choppy: 'Mare increspato',
    },
    compact: {
      calmWaters: 'Onde basse',
      goodSea: 'Mare buono',
      protected: (moment, isToday) => (isToday ? 'Più riparata' : `Più riparata ${moment}`),
      lightWind: 'Vento leggero',
      mildlyBreezy: 'Può essere ventilata',
      windyExposed: 'Ventosa / esposta',
      partlyShelteredToday: (day, isToday) => (isToday ? 'Più riparata dal vento' : `Più riparata dal vento ${day}`),
      slightlyExposed: 'Può essere ventilata',
      familyFriendly: 'Famiglia',
      shallowWaters: 'Acqua bassa',
      shallowWatersCaution: 'Acqua bassa',
      easyAccess: 'Facile',
      facilities: 'Servizi',
      noFacilities: 'Senza servizi',
      naturalShade: 'Ombra naturale',
      goodWithWind: 'Buona opzione, un po’ più ventosa',
      calmButWindier: 'Onde basse, ma un po’ più ventosa',
      visitorRating: 'Voto visitatori',
    },
    access: {
      asphaltRoad: 'Facile',
      dirtRoad: 'Sterrato',
      difficultDirtRoad: 'Sterrato difficile',
      difficultRoad: 'Strada difficile',
      pathAccess: 'Sentiero',
      hardPath: 'Sentiero difficile',
      boatOnly: 'Solo barca',
      moderateAccess: 'Accesso medio',
    },
    amenities: {
      beachBar: 'Beach bar',
      sunbeds: 'Lettini',
      foodNearby: 'Taverna',
      cafeNearby: 'Caffè',
      snackCanteen: 'Chiosco',
      parking: 'Parcheggio',
      shower: 'Doccia',
      organizedFacilities: 'Servizi',
      noFacilities: 'Senza servizi',
      seasonalFacilities: 'Stagionale',
      unknownFacilities: 'Sconosciuto',
    },
  },
};

interface StarRatingProps {
  rating: number;
  colorClassName?: string;
  emptyColorClassName?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({ rating, colorClassName = 'text-amber-400', emptyColorClassName = 'text-slate-300' }) => {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const value = i + 1;
    const StarIconPath = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

    if (value <= rating) { // Full star
      return (
        <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${colorClassName}`} viewBox="0 0 20 20" fill="currentColor">
          <path d={StarIconPath} />
        </svg>
      );
    }
    if (value - 0.5 <= rating) { // Half star
      return (
        <div key={i} className="relative">
           <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${emptyColorClassName}`} viewBox="0 0 20 20" fill="currentColor">
            <path d={StarIconPath} />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${colorClassName} absolute top-0 left-0`} viewBox="0 0 20 20" fill="currentColor" style={{ clipPath: 'inset(0 50% 0 0)' }}>
            <path d={StarIconPath} />
          </svg>
        </div>
      );
    }
    // Empty star
    return (
      <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${emptyColorClassName}`} viewBox="0 0 20 20" fill="currentColor">
        <path d={StarIconPath} />
      </svg>
    );
  });

  return (
    <div className="flex items-center" aria-label={`Rating: ${rating} out of 5 stars`}>
      {stars}
    </div>
  );
};


export const BeachCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
    <div className="p-5 flex flex-col">
      <div className="flex justify-between items-start mb-1">
        <div className="h-6 bg-slate-200 rounded w-3/5"></div>
        <div className="h-5 bg-slate-200 rounded-full w-1/4"></div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 bg-slate-200 rounded w-24"></div>
        <div className="h-5 bg-slate-200 rounded w-8"></div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-slate-200 rounded w-full"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-2/5 mb-2"></div>
        <div className="h-8 bg-slate-200 rounded-full w-2/4"></div>
      </div>
       <div className="mb-4 space-y-3">
         <div className="h-4 bg-slate-200 rounded w-2/5 mb-2"></div>
         <div className="flex flex-wrap gap-2">
            <div className="h-6 bg-slate-200 rounded-md w-1/4"></div>
            <div className="h-6 bg-slate-200 rounded-md w-1/3"></div>
         </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex items-center mt-auto">
        <div className="h-10 bg-slate-200 rounded-lg w-full"></div>
      </div>
    </div>
  </div>
);

export const AccessibilityInfo: React.FC<{ accessibility: Accessibility; t: Translation; }> = ({ accessibility, t }) => {
  const getAccessibilityDetails = () => {
    switch (accessibility) {
      case Accessibility.EASY:
        return {
          icon: <Footprints className="h-5 w-5 mr-2 text-green-500" aria-hidden="true" />,
          text: t.accessibility[Accessibility.EASY],
          className: 'text-green-700 bg-green-100/80',
        };
      case Accessibility.MODERATE:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-orange-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
          text: t.accessibility[Accessibility.MODERATE],
          className: 'text-orange-700 bg-orange-100/80',
        };
      case Accessibility.DIFFICULT:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
          text: t.accessibility[Accessibility.DIFFICULT],
          className: 'text-red-700 bg-red-100/80',
        };
      case Accessibility.BOAT_ONLY:
        return {
          icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-teal-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a1 1 0 011 1v1h1.5a.5.5 0 01.5.5v1.5a.5.5 0 01-.5.5H12v2.5a.5.5 0 01-.5.5H8.5a.5.5 0 01-.5-.5V7H6.5a.5.5 0 01-.5-.5V5a.5.5 0 01.5-.5H8V3a1 1 0 011-1h1z" /><path d="M3.5 15.228a1.5 1.5 0 001.295.962h10.41a1.5 1.5 0 001.295-.962l-1.89-6.434H5.39L3.5 15.228zM3 17a1 1 0 01-1-1v-1.586a1 1 0 01.293-.707l1.414-1.414A1 1 0 015.414 12H14.586a1 1 0 01.707.293l1.414 1.414a1 1 0 01.293.707V16a1 1 0 01-1 1H3z" /></svg>,
          text: t.accessibility[Accessibility.BOAT_ONLY],
          className: 'text-teal-700 bg-teal-100/80',
        };
    }
  };

  const details = getAccessibilityDetails();
  if (!details) return null;

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${details.className}`}>
      {details.icon}
      <span>{details.text}</span>
    </div>
  );
};

const amenityChipIcon = (chip: Pick<AmenityChip, 'key'>): React.ReactNode => {
  switch (chip.key) {
    case 'sunbeds':
      return <SunbedIcon className="h-3.5 w-3.5" />;
    case 'foodNearby':
    case 'cafeNearby':
    case 'snackCanteen':
      return <Utensils className="w-3.5 h-3.5" />;
    case 'parking':
      return <MapPin className="w-3.5 h-3.5" />;
    case 'shower':
      return <ShowerHead className="w-3.5 h-3.5" />;
    case 'noFacilities':
      return <Leaf className="w-3.5 h-3.5" />;
    default:
      return <BadgeCheck className="w-3.5 h-3.5" />;
  }
};

const AmenityTags: React.FC<{ beach: Beach; language: LanguageCode }> = ({ beach, language }) => {
  const chips = getAmenityChips(beach, language).slice(0, 2);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(chip => (
        <div key={chip.key} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {amenityChipIcon(chip)}
          <span>{chip.label}</span>
        </div>
      ))}
    </div>
  );
};

const ProtectedBeachMarker: React.FC<{ language: LanguageCode; selectedDate?: Date; enclosedCove?: boolean }> = ({ language, selectedDate, enclosedCove = false }) => {
  const day = getSelectedDaySentencePrefix(selectedDate, athensNow(), language);
  const copy = getLocalizedCopy(language, cardCopy);
  // An enclosed cove (όρμος) reads green like a genuinely calm shore; the waves icon
  // and «Κλειστός όρμος» label carry its distinct identity, not a separate colour.
  const label = enclosedCove ? copy.enclosedCoveChip : copy.shelteredChip(day);
  const accessibleLabel = enclosedCove ? copy.enclosedCoveChipA11y : copy.shelteredChipA11y(day);
  const pillClass = 'inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/75 px-2 py-0.5 text-[10px] font-bold leading-none text-emerald-700';

  return (
    <span
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className={pillClass}
    >
      {enclosedCove
        ? <Waves className="h-3 w-3 shrink-0" aria-hidden="true" />
        : <Shield className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

// "We were here and verified it" — the house seal, in brand teal so it reads as OUR
// first-party guarantee, distinct from the sky (Blue Flag / accessible) credentials.
const CertifiedBadge: React.FC<{ language: LanguageCode; compact?: boolean }> = ({ language, compact = false }) => {
  const copy = getLocalizedCopy(language, cardCopy);

  return (
    <span
      title={copy.certifiedA11y}
      aria-label={copy.certifiedA11y}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-200 bg-white font-bold leading-none text-[#007a83] shadow-sm ring-1 ring-black/5 ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-teal-100 text-[#007a83]" aria-hidden="true" />
      <span className="whitespace-nowrap">{copy.certified}</span>
    </span>
  );
};

const BlueFlagBadge: React.FC<{ language: LanguageCode; compact?: boolean }> = ({ language, compact = false }) => {
  const label = getLocalizedCopy(language, cardCopy).blueFlag;

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-100 bg-white font-bold leading-none text-sky-700 shadow-sm ring-1 ring-black/5 ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <Flag className="h-3.5 w-3.5 shrink-0 fill-sky-100 text-sky-600" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

// Εκτός Ιουν–Σεπτ ο εξοπλισμός συνήθως δεν είναι στο νερό. Το σήμα ΔΕΝ εξαφανίζεται (η
// πληροφορία «εδώ υπάρχει ράμπα το καλοκαίρι» παραμένει σωστή) — αλλάζει λέξη και χρώμα,
// και το tooltip λέει καθαρά να τηλεφωνήσει πρώτα. Ο κανόνας της σεζόν είναι στο
// utils/accessibility, όχι εδώ.
const AccessibilityBadge: React.FC<{ language: LanguageCode; state: SeatracRampState; compact?: boolean }> = ({ language, state, compact = false }) => {
  const copy = getLocalizedCopy(language, cardCopy);
  const outOfSeason = state === 'out-of-season';
  const label = outOfSeason ? copy.accessibleSeasonal : copy.accessible;
  const title = outOfSeason ? `${label} — ${getSeatracOutOfSeasonNote(language)}` : label;
  const tone = outOfSeason
    ? 'border-slate-200 text-slate-600'
    : 'border-sky-100 text-sky-700';

  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border bg-white font-bold leading-none shadow-sm ring-1 ring-black/5 ${tone} ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <AccessibilityIcon className={`h-3.5 w-3.5 shrink-0 ${outOfSeason ? 'text-slate-500' : 'text-sky-600'}`} aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

const CampingBadge: React.FC<{ language: LanguageCode; compact?: boolean }> = ({ language, compact = false }) => {
  const label = getLocalizedCopy(language, cardCopy).camping;

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-100 bg-white font-bold leading-none text-emerald-700 shadow-sm ring-1 ring-black/5 ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <Tent className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

// "You pay to be here" — amber tone (heads-up that it costs money) so it reads apart from the
// sky/emerald "good news" badges. The kind drives the label + the explanation tooltip.
const PaidEntryBadge: React.FC<{ kind: PaidEntryKind; language: LanguageCode; compact?: boolean }> = ({ kind, language, compact = false }) => {
  const label = localizedPaidEntryLabel(kind, language);
  const explanation = localizedPaidEntryExplanation(kind, language);
  const Icon = kind === 'entrance_fee' ? Ticket : Euro;

  return (
    <span
      title={explanation}
      aria-label={`${label} — ${explanation}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-white font-bold leading-none text-amber-700 shadow-sm ring-1 ring-black/5 ${compact ? 'min-h-7 px-2 py-1 text-[10px]' : 'min-h-8 px-2.5 py-1 text-xs'}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
};

const BeachTypeTag: React.FC<{ beachType: BeachType; t: Translation }> = ({ beachType, t }) => {
  if (beachType === 'unknown') return null;

  const icons: Record<BeachType, React.ReactNode> = {
    sandy: <SandDotsIcon className="h-3.5 w-3.5" />,
    pebbles: <CircleDot className="w-3.5 h-3.5" />,
    'sandy-pebbles': <SandPebblesIcon className="h-3.5 w-3.5" />,
    rocky: <Mountain className="w-3.5 h-3.5" />,
    unknown: <Info className="w-3.5 h-3.5" />,
  };
  
  return (
    <div className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-700 dark:text-slate-600 tracking-wider flex items-center gap-1.5">
      {icons[beachType]}
      <span>{t.filterOptions[beachType]}</span>
    </div>
  );
};

const CharacteristicTags: React.FC<{ characteristics: Beach['characteristics']; t: Translation }> = ({ characteristics, t }) => {
  const presentCharacteristics = (Object.keys(characteristics) as Array<keyof typeof characteristics>).filter(key => characteristics[key]);
  if (presentCharacteristics.length === 0) return null;

  return (
    <>
      {presentCharacteristics.map(char => (
        <div key={char as string} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-700 dark:text-slate-600 tracking-wider">
          {t.filterOptions[char as keyof typeof t.filterOptions]}
        </div>
      ))}
    </>
  );
};


// Gradient backgrounds — sheltered vs exposed
const metadataAccessTone: Record<string, { className: string; iconClassName: string }> = {
  asphalt_road: { className: 'text-emerald-700 bg-emerald-100/80', iconClassName: 'text-emerald-500' },
  passable_dirt_road: { className: 'text-amber-700 bg-amber-100/80', iconClassName: 'text-amber-500' },
  '4x4_only': { className: 'text-red-700 bg-red-100/80', iconClassName: 'text-red-500' },
  hiking_path_easy: { className: 'text-sky-700 bg-sky-100/80', iconClassName: 'text-sky-500' },
  hiking_path_difficult: { className: 'text-orange-700 bg-orange-100/80', iconClassName: 'text-orange-500' },
  boat_only: { className: 'text-teal-700 bg-teal-100/80', iconClassName: 'text-teal-500' },
};

const terrainIcons: Record<string, React.ReactNode> = {
  fine_sand: <SandDotsIcon className="h-3.5 w-3.5" />,
  coarse_sand: <CircleDotDashed className="w-3.5 h-3.5" />,
  pebbles: <CircleDot className="w-3.5 h-3.5" />,
  large_stones: <Mountain className="w-3.5 h-3.5" />,
  rocks: <Mountain className="w-3.5 h-3.5" />,
};

const waterDepthStyles: Record<string, string> = {
  shallow: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300',
  medium: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
  deep: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
};

const waterDepthIcons: Record<string, React.ReactNode> = {
  shallow: <Droplets className="w-3.5 h-3.5" />,
  medium: <Waves className="w-3.5 h-3.5" />,
  deep: <ArrowDown className="w-3.5 h-3.5" />,
};

// Static popularity/crowd badge (from Google review count): secluded -> crowded.
const popularityStyles: Record<string, string> = {
  secluded: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  quiet: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  moderate: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  popular: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  crowded: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
};

const MetadataAccessInfo: React.FC<{ metadata: NonNullable<Beach['metadata']>; language: LanguageCode }> = ({ metadata, language }) => {
  if (!metadata.access) return null;

  const isDirtRoad = hasDirtRoadAccess({ metadata });
  const tone = isDirtRoad
    ? metadataAccessTone.passable_dirt_road
    : metadataAccessTone[metadata.access.type] || metadataAccessTone.asphalt_road;
  const copy = getLocalizedCopy(language, cardCopy);
  const label = isDirtRoad
    ? copy.dirtRoad
    : localizedAccessLabel(metadata.access.type, metadata.access.label, language);

  return (
    <div className={`inline-flex items-center text-sm font-medium px-3 py-1 rounded-full ${tone.className}`} title={metadata.access.notes}>
      <Footprints className={`h-4 w-4 mr-2 ${tone.iconClassName}`} />
      <span>{label}</span>
    </div>
  );
};

const MetadataTags: React.FC<{ beach: Beach; language: LanguageCode }> = ({ beach, language }) => {
  const metadata = beach.metadata;
  if (!metadata) return null;
  const terrainTypes = metadata.terrain?.types?.slice(0, 3) || [];
  const waterDepth = metadata.waterDepth;
  const amenityChips = getAmenityChips(beach, language).slice(0, 2);

  return (
    <>
      {terrainTypes.map(type => (
        <div key={type} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-700 dark:text-slate-600 flex items-center gap-1.5">
          {terrainIcons[type] || <CircleDot className="w-3.5 h-3.5" />}
          <span>{localizedTerrainLabel(type, language)}</span>
        </div>
      ))}
      {waterDepth && !isWaterDepthUnverified(waterDepth) && (
        <div
          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 ${waterDepthStyles[waterDepth.type] || waterDepthStyles.shallow}`}
          title={waterDepth.notes}
        >
          {waterDepthIcons[waterDepth.type] || <Droplets className="w-3.5 h-3.5" />}
          <span>{localizedWaterDepthLabel(waterDepth.type, waterDepth.label, language)}</span>
        </div>
      )}
      {metadata.shade && (
        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 rounded text-[10px] font-bold flex items-center gap-1.5">
          <Trees className="w-3.5 h-3.5" />
          <span>{localizedShadeLabel(language)}</span>
        </div>
      )}
      {(beach.popularity ?? metadata.popularity)?.tier ? (() => {
        const pop = beach.popularity ?? metadata.popularity!;
        return (
          <div
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 ${popularityStyles[pop.tier] || popularityStyles.moderate}`}
            title={pop.ratingCount ? `${pop.ratingCount} Google reviews` : undefined}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{localizedPopularityLabel(pop.tier, language)}</span>
          </div>
        );
      })() : beach.environment?.quietEvidence === 'presumed' ? (
        // No Google entry at all. Same slot as the crowd badge — it answers the same question —
        // but its own muted styling, because it is an inference and should not look counted.
        <div className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <Users className="w-3.5 h-3.5" />
          <span>{localizedLittleKnownLabel(language)}</span>
        </div>
      ) : null}
      {amenityChips.map(chip => (
        <div key={chip.key} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-700 dark:text-slate-600 flex items-center gap-1.5">
          {amenityChipIcon(chip)}
          <span>{chip.label}</span>
        </div>
      ))}
    </>
  );
};

const warningLabel = (warning: WarningFlag, language: LanguageCode, selectedDate?: Date, selectedHour?: number): string => {
  const copy = getLocalizedCopy(language, cardCopy).warnings;
  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, athensNow(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const useCurrentPhrase = isToday && !hour;
  switch (warning.type) {
    case 'missing_data':
      return copy.seaEstimate;
    case 'rough_sea':
      return warning.severity === 'critical'
        ? copy.highWaves
        : copy.someWaves;
    case 'shore_break':
      return copy.shoreBreak;
    // Υπήρχε από πάντα στον κινητήρα και ΔΕΝ είχε ποτέ λεζάντα εδώ, οπότε έπεφτε στο
    // `default` και τύπωνε το αγγλικό μήνυμα του κινητήρα σε ελληνική, γαλλική, γερμανική
    // και ιταλική κάρτα. Σπάνιο (μπαίνει 3ο-4ο στη σειρά και η κάρτα δείχνει δύο), αλλά
    // ακριβώς σε ήρεμη καυτή μέρα — τότε που δεν υπάρχει άλλη προειδοποίηση να το κρύψει.
    case 'heat_uv':
      return warning.severity === 'critical' ? copy.extremeHeat : copy.heat;
    // ΟΙ ΔΕΚΑ ΠΟΥ ΕΛΕΙΠΑΝ (22/08/2026). Τα νούμερα βγαίνουν από το `warning.values`, που ο
    // κινητήρας γεμίζει δίπλα στο αγγλικό `message` — ποτέ με ανάγνωση του ίδιου του μηνύματος.
    // Όπου λείπει νούμερο, η λεζάντα το λέει χωρίς αυτό αντί να τυπώσει «undefined».
    case 'gusty_wind':
      return typeof warning.values?.gustKmph === 'number'
        ? copy.gustyWind(warning.values.gustKmph)
        : copy.strongWind;
    case 'offshore_wind':
      return copy.offshoreWind;
    case 'onshore_chop':
      return copy.onshoreChop;
    case 'direct_swell':
      return copy.directSwell(warning.values?.swellHeightM);
    case 'long_period_swell':
      return typeof warning.values?.swellPeriodS === 'number'
        ? copy.longPeriodSwell(warning.values.swellPeriodS)
        : copy.shoreBreak;
    case 'afternoon_wind_build':
      return typeof warning.values?.peakBeaufort === 'number' && typeof warning.values?.peakHour === 'number'
        ? copy.afternoonWindBuild(warning.values.peakBeaufort, warning.values.peakHour)
        : copy.strongWind;
    case 'rain_risk':
      // Ο κινητήρας βάζει 'critical' ΜΟΝΟ όταν βρέχει σε ΟΛΕΣ τις ώρες παραλίας.
      return warning.severity === 'critical' ? copy.rainAllBeachHours : copy.rainSomeHours;
    case 'water_quality_risk':
      return copy.waterQualityRisk;
    case 'official_warning':
      // ΣΚΟΠΙΜΑ σταθερή λεζάντα και όχι το `warning.message`: εκεί κάθεται ο λόγος όπως τον
      // έγραψε η πηγή, σε άγνωστη γλώσσα και σε άγνωστο μήκος. Ο λόγος έχει τη θέση του στη
      // σελίδα της παραλίας, όχι σε ένα τσιπάκι δέκα χαρακτήρων.
      return copy.officialWarning;
    case 'crowded':
      return copy.crowded;
    case 'strong_wind':
      return copy.strongWind;
    case 'wind_sport_spot':
      return copy.windSportSpot;
    case 'exposed_to_wind':
      return warning.severity === 'warning'
        ? copy.exposedToWind(day, useCurrentPhrase)
        : copy.breezy;
    case 'difficult_access':
      return copy.difficultAccess;
    case 'boat_only':
      return copy.boatOnly;
    case 'low_confidence':
      return copy.lowConfidence;
    default:
      return warning.message;
  }
};

/** How many warning chips the card has room for. Was an inline `.slice(0, 2)`. */
const MAX_VISIBLE_WARNINGS = 2;

/**
 * ΤΑ ΔΥΟ ΤΣΙΠΑΚΙΑ ΕΠΙΛΕΓΟΝΤΑΙ, ΔΕΝ ΕΙΝΑΙ ΤΑ ΔΥΟ ΠΡΩΤΑ (13/08/2026).
 *
 * The card has room for two, and it used to take whichever two the scoring pushed first. That is
 * fine while every warning is about the wind — but `shore_break` (utils/shoreBreak) is raised late,
 * after the gust and offshore-wind notes, and it exists for exactly the reader who is looking at a
 * calm-looking card. On Καβαλικευτά, 13/08, it would have landed fourth in a list of five and never
 * reached the screen — a note nobody sees is a note that was not added.
 *
 * So it earns a slot: if it is present but outside the visible pair, it replaces the MILDEST of the
 * two rather than the first. A gust warning or a rough sea is never displaced by it — those are
 * severity, this is context about the water the reader is already being told is calm.
 */
const WARNING_SEVERITY_RANK: Record<WarningFlag['severity'], number> = { critical: 0, warning: 1, info: 2 };

export const pickVisibleWarnings = (warnings: readonly WarningFlag[]): WarningFlag[] => {
  const visible = warnings.slice(0, MAX_VISIBLE_WARNINGS);
  const shoreBreak = warnings.find(warning => warning.type === 'shore_break');
  if (!shoreBreak || visible.includes(shoreBreak)) return visible;

  let mildestIndex = 0;
  for (let index = 1; index < visible.length; index += 1) {
    if (WARNING_SEVERITY_RANK[visible[index].severity] >= WARNING_SEVERITY_RANK[visible[mildestIndex].severity]) {
      mildestIndex = index;
    }
  }
  // Only ever displaces another note, never a warning or a critical.
  if (WARNING_SEVERITY_RANK[visible[mildestIndex].severity] < WARNING_SEVERITY_RANK[shoreBreak.severity]) return visible;

  const picked = [...visible];
  picked[mildestIndex] = shoreBreak;
  return picked;
};

const waveWarningLabel = (warning: WarningFlag, waveHeightM: number | undefined, language: LanguageCode, selectedDate?: Date, selectedHour?: number): string => {
  const copy = getLocalizedCopy(language, cardCopy).warnings;
  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    if (waveHeightM >= 1.2) return copy.roughSea;
    if (waveHeightM >= 0.8) return copy.choppy;
  }

  return warningLabel(warning, language, selectedDate, selectedHour);
};

const warningToneClass = (warning: WarningFlag): string => {
  if (warning.severity === 'critical') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300';
  if (warning.severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300';
  return 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300';
};

const compactLabels = (language: LanguageCode, selectedDate?: Date, selectedHour?: number) => {
  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, athensNow(), language);
  const sentenceDay = hour ?? getSelectedDaySentencePrefix(selectedDate, athensNow(), language);
  const isToday = isSelectedDateToday(selectedDate);
  const useCurrentPhrase = isToday && !hour;
  const copy = getLocalizedCopy(language, cardCopy).compact;

  return ({
  calmWaters: copy.calmWaters,
  goodSea: copy.goodSea,
  protected: copy.protected(sentenceDay, useCurrentPhrase),
  lightWind: copy.lightWind,
  mildlyBreezy: copy.mildlyBreezy,
  windyExposed: copy.windyExposed,
  partlyShelteredToday: copy.partlyShelteredToday(day, useCurrentPhrase),
  slightlyExposed: copy.slightlyExposed,
  familyFriendly: copy.familyFriendly,
  shallowWaters: copy.shallowWaters,
  shallowWatersCaution: copy.shallowWatersCaution,
  easyAccess: copy.easyAccess,
  facilities: copy.facilities,
  noFacilities: copy.noFacilities,
  naturalShade: copy.naturalShade,
  goodWithWind: copy.goodWithWind,
  calmButWindier: copy.calmButWindier,
  visitorRating: copy.visitorRating,
  });
};

const photoCueListeners = new Set<() => void>();
let hasDismissedPhotoCue = false;

const dismissPhotoCue = () => {
  if (hasDismissedPhotoCue) return;
  hasDismissedPhotoCue = true;
  photoCueListeners.forEach(listener => listener());
};

const compactAccessLabel = (
  language: LanguageCode,
  accessibility: Accessibility,
  accessType: string | undefined,
  isDirtRoad: boolean,
  fallback: string
): string => {
  const copy = getLocalizedCopy(language, cardCopy).access;
  const defaultLocalizedAccessLabel = accessType ? localizedAccessLabel(accessType, undefined, language) : '';
  if (accessType?.startsWith('hiking_path') && fallback && fallback !== defaultLocalizedAccessLabel) {
    // `fallback` is the authored Greek label. localizedAccessLabel recognises the ones that
    // describe HOW you get down — «σκαλιά», «κατάβαση», «σχοινί» — and returns a translated
    // phrase for them (utils/localization.getSpecificAccessLabelKey). Returning `fallback`
    // raw would have printed that Greek sentence verbatim on the German and French cards
    // (found 16/08/2026 while marking Απέλλα and Κυρά Παναγιά as stairs-down access).
    return localizedAccessLabel(accessType, fallback, language) || fallback;
  }

  if (isDirtRoad) {
    return copy.dirtRoad;
  }

  const metadataLabels: Record<string, string> = {
    asphalt_road: copy.asphaltRoad,
    passable_dirt_road: copy.dirtRoad,
    difficult_dirt_road: copy.difficultDirtRoad,
    '4x4_only': copy.difficultRoad,
    hiking_path_easy: copy.pathAccess,
    hiking_path_difficult: copy.hardPath,
    boat_only: copy.boatOnly,
  };
  const accessibilityLabels: Record<Accessibility, string> = {
    [Accessibility.EASY]: copy.asphaltRoad,
    [Accessibility.MODERATE]: copy.moderateAccess,
    [Accessibility.DIFFICULT]: copy.difficultRoad,
    [Accessibility.BOAT_ONLY]: copy.boatOnly,
  };
  return (accessType && metadataLabels[accessType]) || accessibilityLabels[accessibility] || fallback;
};

const compactAmenityLabel = (chip: AmenityChip, language: LanguageCode): string => {
  const labels = getLocalizedCopy(language, cardCopy).amenities;
  return labels[chip.key] || chip.label;
};

type CompactFeatureChip = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Rendered faint: the slot exists on every card, this beach just doesn't have it. */
  muted?: boolean;
  /** Hover/screen-reader text that says WHY the slot is faint (absent vs unverified). */
  title?: string;
  /** Bonus chip that is only ever shown when true — takes the full row under the fixed six. */
  fullWidth?: boolean;
  /** Holds the slot open without drawing anything: we have no honest word for it. */
  placeholder?: boolean;
};

const BeachCardImpl: React.FC<BeachCardProps> = ({
  beach,
  isExposed = false,
  language,
  t,
  windSpeed,
  beachWindSpeedKmph,
  waveHeightM,
  seaStateWaveM,
  shoreWaveHeightM,
  shoreDisplayWaveM,
  shoreWaveFromDepartingSea,
  seaTemperatureC,
  seaStatePeriodS,
  temperature,
  favorites,
  onToggleFavorite,
  islandName,
  regionId,
  showIslandName = true,
  onClick,
  todayScore,
  variant = 'decision',
  density = 'regular',
  recommendationRank,
  recommendationLabel,
  bestSwimWindow,
  topPickTimeLabel,
  notInTopPicksNote,
  selectedDate,
  selectedHour,
  crowdLevel,
  exposureLevel,
  warnings = [],
  swimmingComfort,
  canClaimWindProtection = false,
  enclosedCove = false,
  seaCalmClaimAllowed = false,
  strongWindContext = false,
  lessExposedToday,
  windSuitabilityText,
  windSuitabilityColor,
  hideExposureBadge = false,
  windExposureMode,
  showTodayScoreBadge = true,
  forceTodayScoreBadge = false,
  topPickPodium = false,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isPhotoCueDismissed, setIsPhotoCueDismissed] = useState(hasDismissedPhotoCue);
  const cardPhotoAreaRef = useRef<HTMLDivElement | null>(null);
  const isCompact = density === 'compact';
  const { name, amenities, accessibility, distance, beachType, characteristics, metadata } = beach;
  // Honesty: only surface a "visitor rating" when we have a REAL Google rating on record.
  // The legacy `beach.rating` field falls back to a neutral 4.0 for the ~900 beaches with no
  // reviews (see utils/beachRating.ts), and showing that 4.0 as a visitor rating is fabricated.
  // Gate the star chips on the raw popularity.rating, which is present only when it's real.
  const realGoogleRating = metadata?.popularity?.rating ?? beach.popularity?.rating;
  const realVisitorRating = typeof realGoogleRating === 'number' && Number.isFinite(realGoogleRating) ? realGoogleRating : null;
  const beachDisplayName = displayBeachName(name, language);
  const isBoatOnlyBeach = hasBoatOnlyAccess(beach);
  const isCertified = isCalmBeachCertified(beach.id);
  const hasBlueFlag2026 = beach.blueFlag2026?.awarded === true || metadata?.blueFlag2026?.awarded === true;
  // Badge only for currently-active ramps — ίδιος κανόνας με το φίλτρο, μία πηγή, plus την
  // εποχικότητα: εκτός Ιουν–Σεπτ ο εξοπλισμός συνήθως έχει αφαιρεθεί από το νερό.
  const seatracRampState = getSeatracRampState(beach);
  const hasAccessibleRamp = seatracRampState !== 'none';
  const hasNearbyCamping = (beach.nearbyCamping?.length ?? metadata?.nearbyCamping?.length ?? 0) > 0;
  const paidEntry = beach.paidEntry ?? metadata?.paidEntry;
  const isPartlyShelteredToday = exposureLevel === 'partial';
  // Prefer this beach's own scored wind so the Beaufort matches its (same-wind) wave; fall back to
  // the island/region wind only when no beach-specific value was supplied.
  const effectiveWindKmph = typeof beachWindSpeedKmph === 'number' && Number.isFinite(beachWindSpeedKmph)
    ? beachWindSpeedKmph
    : windSpeed * 3.6;
  /**
   * ΤΑ ΔΥΟ ΝΟΥΜΕΡΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΜΙΑ ΠΗΓΗ (20/08/2026) — `utils/beachConditionsReadout`.
   *
   * Το ίδιο ζευγάρι «Μποφόρ · μέτρα» τυπώνεται από σήμερα ΚΑΙ στο ταμπελάκι που ανοίγει όταν
   * πατηθεί μια πινέζα στον χάρτη. Δύο αντίγραφα του ίδιου κανόνα σε δύο επιφάνειες είναι το
   * σφάλμα §Κ1 της βίβλου — και ακριβώς αυτό γέννησε την πύλη «κάρτα vs πινέζα» (§Γ27).
   * Ο υπολογισμός έφυγε από εδώ αυτούσιος· τα σχόλια από κάτω εξηγούν ΓΙΑΤΙ είναι έτσι και
   * μένουν όπου διαβάζονται.
   */
  const conditionsReadout = buildBeachConditionsReadout({
    beachWindSpeedKmph,
    regionWindSpeedMs: windSpeed,
    waveHeightM,
    seaStateWaveM,
    seaStatePeriodS,
    shoreWaveHeightM,
    shoreDisplayWaveM,
    shoreWaveFromDepartingSea,
    language,
  });
  const windBeaufort = conditionsReadout.beaufort;
  // Swell-equivalent sea state: what every colour/word decision on this card compares against.
  // The displayed metres stay `waveHeightM`; a 0.45 m 2.5 s chop and a 0.45 m 8 s roll are the
  // same number to read and a different sea to swim in.
  const cardSeaStateM = beachDecisionSeaStateM(seaStateWaveM, waveHeightM, seaStatePeriodS);
  /**
   * ΤΟ ΚΥΜΑ ΣΤΗΝ ΚΑΡΤΑ — Ο ΧΡΗΣΤΗΣ ΗΤΑΝ ΤΥΦΛΟΣ ΩΣ ΣΗΜΕΡΑ (10/08/2026).
   *
   * The podium card printed a Beaufort and an hour, and nothing at all about the sea. Measured in
   * East Attica the same evening: #1 sat at 1,14 m and #2 at 0,52 m and the two cards were
   * indistinguishable — on a site whose entire promise is «πού είναι ήρεμα σήμερα». The one place
   * that said it («η πιο ήρεμη θάλασσα από τις τρεις») lives in a desktop rail that appears at
   * 1360px and up, i.e. never for the 86% of visitors on a phone.
   *
   * Which number and which words: exactly the pair the beach page has printed since 05/08 — the
   * modelled height AT THE SAND with a «~» where utils/shoreWave is entitled to speak, otherwise
   * the honest open-water reading labelled «ανοιχτά». The strings are imported from
   * BeachAnswerHero rather than retyped, so the card and the beach page cannot drift into
   * describing the same water with different words.
   */
  /**
   * ΕΝΑΣ ΑΡΙΘΜΟΣ ΠΑΝΤΟΥ, ΚΑΙ ΝΑ ΕΙΝΑΙ ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ (Μίλτος, 13/08/2026).
   *
   * Μέχρι σήμερα η κάρτα τύπωνε το ύψος στην ακτή ΜΟΝΟ όπου μιλούσε το `utils/shoreWave` (κλειστός
   * όρμος, απόγειος άνεμος — 647 από 2.854 παραλίες), και παντού αλλού τη θάλασσα του ανοιχτού.
   * Δύο κάρτες δίπλα-δίπλα τύπωναν έτσι δύο ΔΙΑΦΟΡΕΤΙΚΑ ΜΕΓΕΘΗ χωρίς να το λέει τίποτα.
   *
   * `shoreDisplayWaveM` είναι ο ίδιος αριθμός που η ετυμηγορία κολύμβησης διαβάζει από τις 10/08
   * (§7η) και το ταβάνι του χρώματος από τις 01/08 — υπολογισμένος για ΚΑΘΕ παραλία. Μετρήθηκε
   * εθνικά πριν μπει (βίβλος §Γ5, 110/110 περιοχές): **2.104 από 2.854 παραλίες δεν αλλάζουν
   * νούμερο καθόλου** — όλες οι `exposed` και όλες οι `partial`, γιατί εκεί ο συντελεστής είναι
   * 1,0. Αλλάζουν μόνο προστατευμένες ακτές, κατά 0,18 μ. διάμεσα.
   *
   * `shoreWaveHeightM` ΔΕΝ αντικαταστάθηκε και δεν πρέπει: είναι κλειδί απόφασης (25 πόντοι
   * «νερό» στο podium). Η υπόσχεση της μέτρησης ήταν ότι αλλάζει μόνο η οθόνη· το fallback εδώ
   * υπάρχει για κλήσεις που δεν μεταφέρουν ακόμη το νέο πεδίο, ώστε καμία κάρτα να μη γυρίσει
   * σιωπηλά στο ανοιχτό νερό.
   */
  // Ίδιο καπάκι με τη σελίδα της παραλίας (pages/BeachDetailPage): το κύμα στην ακτή δεν
  // τυπώνεται ποτέ μεγαλύτερο από το νερό έξω. Χωρίς αυτό, η κάρτα και η σελίδα έβγαζαν
  // διαφορετικό νούμερο σε όρμους, όπου η display τιμή είναι χαμηλότερη από την effective.
  // Same spelling as the beach page's own tile (BeachAnswerHero): «0,5 μ.» in Greek, «0.5 m»
  // elsewhere, and the «~» only on the modelled shore figure so the two never look alike.
  // Το «~» μόνο όταν ο αριθμός της ακτής ΔΙΑΦΕΡΕΙ από τη μέτρηση του ανοιχτού — αλλιώς είναι η
  // μέτρηση, και ένα «~» θα την υποβάθμιζε σε εκτίμηση. Και τα δύο ζουν πλέον στο
  // `utils/beachConditionsReadout`, ώστε ο χάρτης να μην μπορεί να τυπώσει άλλο νούμερο.
  const cardWaveIsShore = conditionsReadout.waveIsShore;
  const cardWaveM = conditionsReadout.waveM;
  const cardWaveValueText = conditionsReadout.waveText;
  const cardWaveLabel = cardWaveIsShore
    ? SHORE_LABELS[language].atShore
    : READ_LABELS[language].seaOpen;
  /**
   * ΤΟ ΣΚΕΤΟ ΝΟΥΜΕΡΟ ΔΙΑΒΑΖΟΤΑΝ ΩΣ «ΤΟΣΟ ΚΥΜΑ ΕΧΕΙ ΜΠΡΟΣΤΑ ΣΟΥ» (Μίλτος, 13/08/2026).
   *
   * Παραλία Μαραθώνα, βοριάς 6 Μπφ: η κάρτα τύπωνε «1,5 μ.» — που είναι η θάλασσα στο σημείο
   * μέτρησης 10 χλμ ΝΑ ανοιχτά, όχι το νερό στην άμμο (ο άνεμος εκεί είναι απόγειος και ο
   * τομέας του βοριά έχει fetch 0). Ο Σχινιάς 4 χλμ πιο πάνω, όπου το `utils/shoreWave`
   * δικαιούται να μιλήσει, τύπωνε «~0,1 μ.» την ίδια ώρα.
   *
   * Η λέξη «ανοιχτά» ΥΠΗΡΧΕ ήδη εδώ — αλλά μόνο σε `title` (tooltip, δεν υπάρχει σε αφή) και
   * σε `aria-label` (αναγνώστες οθόνης). Δηλαδή για το 86% που μπαίνει από κινητό δεν
   * ζωγραφιζόταν ΠΟΤΕ. Είναι η ίδια κατηγορία σφάλματος που η βίβλος κατέγραψε στις 11/08
   * («καμία πύλη δεν κοιτούσε αν το νούμερο ΦΤΑΝΕΙ στην κάρτα»), ένα σκαλί πιο πέρα: εδώ το
   * νούμερο έφτανε και η λέξη του δεν σχεδιαζόταν.
   *
   * Η βίβλος (§7δ) έδωσε την εξαίρεση για το κύμα ακτής με ρητό όρο — «τα δύο νούμερα μαζί»,
   * «το νούμερο της ανοιχτής θάλασσας μένει στην οθόνη, ΔΙΠΛΑ, ΜΕ ΤΟ ΟΝΟΜΑ ΤΟΥ». Στη σελίδα
   * της παραλίας τηρείται· εδώ δεν τηρούνταν.
   *
   * ⚠️ Η ΛΥΣΗ ΔΕΝ ΗΤΑΝ ΔΕΥΤΕΡΗ ΛΕΞΗ — ΗΤΑΝ ΝΑ ΠΑΨΕΙ Η ΚΑΡΤΑ ΝΑ ΔΕΙΧΝΕΙ ΔΥΟ ΜΕΓΕΘΗ (13/08 βράδυ).
   *
   * Ενδιάμεσα δοκιμάστηκε το προφανές: να γράφει η κάρτα «~0,2 μ. στην ακτή» εκεί που έγραφε
   * «1,4 μ. ανοιχτά». Ο Μίλτος το είδε στο κινητό και το έκοψε — «στο mobile έχει πολύ κείμενο» —
   * και το `validateTileFit` συμφώνησε την ίδια ώρα: στα 390 px η γραμμή κοβόταν.
   *
   * ΚΑΙ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ. Η λέξη υπήρχε για να ξεχωρίζει ο αναγνώστης ΔΥΟ διαφορετικά μεγέθη σε
   * διπλανές κάρτες. Από σήμερα η κάρτα δείχνει ΠΑΝΤΑ το ίδιο μέγεθος — το νερό στην ακτή, για
   * κάθε παραλία (§Γ5) — οπότε δεν υπάρχει τίποτα να ξεχωρίσει. Ένα μέγεθος, καμία λέξη, κανένα
   * μπέρδεμα, και το πλάτος επιστρέφει στον αριθμό όπου ανήκει.
   *
   * Η ΣΕΛΙΔΑ της παραλίας κρατά και τα δύο νούμερα με τα ονόματά τους όπου διαφέρουν — ο όρος της
   * §7δ ζει εκεί, σε οθόνη που έχει τον χώρο γι' αυτόν.
   */
  const cardWaveText = cardWaveValueText;
  const isFavorite = favorites.includes(beach.id);
  const labels = compactLabels(language, selectedDate, selectedHour);
  const localizedCardCopy = getLocalizedCopy(language, cardCopy);
  const visitTimeLabel = getLocalizedCopy(language, {
    en: 'Best time',
    gr: 'Ώρα επίσκεψης',
    fr: 'Meilleur moment',
    de: 'Beste Zeit',
    it: 'Ora migliore',
  });
  // «Άνεμος στην παραλία» — the podium card's why-row. Kept beside visitTimeLabel because the two
  // rows render together and someone changing one wording should see the other.
  const windOnShoreLabel = getLocalizedCopy(language, {
    en: 'Wind at the beach',
    gr: 'Άνεμος στην παραλία',
    fr: 'Vent sur la plage',
    de: 'Wind am Strand',
    it: 'Vento in spiaggia',
  });
  // Same unit spelling as utils/shoreIncidenceCopy's BFT_UNIT — «Μπφ» in Greek, «Bft» elsewhere.
  const beaufortUnitLabel = language === 'gr' ? 'Μπφ' : 'Bft';
  // `noIdealSwimmingWindow` was computed here and threaded to all three badges. It was removed on
  // 02/08/2026 with the input itself: getExperienceTier DECLARED it and never read it, so three
  // call sites were paying for a value the verdict ignored. Everything it tried to express —
  // avoid_swimming, a critical rough-sea warning, a sea over SEA_STATE_ROUGH_M — the badge already
  // learns from `swimmingComfort` and from the colour it is now capped by.
  const favoriteLabel = localizedCardCopy.favorite;
  const unfavoriteLabel = localizedCardCopy.unfavorite;
  const shareLabel = localizedCardCopy.share;
  const detailRegionId = beach.regionId ?? regionId;
  const detailBeach = typeof beach.sourceBeachId === 'number' ? { ...beach, id: beach.sourceBeachId } : beach;
  const detailHref = detailRegionId ? buildBeachDetailPath(detailRegionId, detailBeach, language) : undefined;
  const photoLookup = getBeachPhotoLookup(name.gr, name.en, beach.id, 3, islandName);
  const cardPhotos = photoLookup.source === 'exact' ? photoLookup.photos : [];
  const cardPhoto = photoIndex < cardPhotos.length ? cardPhotos[photoIndex] : null;

  useEffect(() => {
    const listener = () => setIsPhotoCueDismissed(true);
    photoCueListeners.add(listener);
    if (hasDismissedPhotoCue) listener();

    return () => {
      photoCueListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!cardPhoto || isPhotoCueDismissed || typeof IntersectionObserver === 'undefined') return;

    const photoArea = cardPhotoAreaRef.current;
    if (!photoArea) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.3)) {
          dismissPhotoCue();
        }
      },
      { threshold: [0.3] },
    );

    observer.observe(photoArea);

    return () => {
      observer.disconnect();
    };
  }, [cardPhoto, isPhotoCueDismissed]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(beach.id);
  };

  useEffect(() => {
    setPhotoIndex(0);
  }, [beach.id]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // In the cross-region "Κοντά μου" list a beach belongs to its own region and
    // keeps its real id in sourceBeachId (the `id` shown here is synthetic), so
    // share links must use those, not the synthetic region/id.
    const shareUrl = detailRegionId
      ? buildBeachShareUrl(window.location.origin, detailRegionId, detailBeach)
      : window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        trackEvent('share_clicked', beach.id, {
          locale: languageToLocale(language),
          region: islandName,
          beach_name: name.en,
          source: 'beach_card',
          ...buildBeachExposureParams(beach),
        });
        await navigator.share({
          text: t.sharing.text(beachDisplayName),
          url: shareUrl,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') console.error('Error sharing:', error);
      }
    }
  };

  const handleNavigationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canOpenNavigation(beach)) {
      return;
    }

    trackEvent('navigation_clicked', beach.id, {
      locale: languageToLocale(language),
      region: islandName,
      beach_name: name.en,
      source: 'beach_card',
      ...buildBeachExposureParams(beach),
    });
    openNavigation(beach);
  };
  const handleDetailLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onClick?.();
  };
  const canNavigate = canOpenNavigation(beach);
  // Icon-only card buttons have no room for a visible pill; surface the badge reason via the
  // title/aria-label so the boat-only/unverified context still reaches the user (and screen
  // readers) without breaking the tight action grid on mobile.
  const navBadge = getNavigationBadge(beach);
  const navBadgeLabel = navBadge
    ? t.navigationBadge[navBadge === 'boat-access' ? 'boatAccess' : navBadge === 'nav-unavailable' ? 'unavailable' : 'unverified']
    : undefined;
  const navButtonTitle = navBadgeLabel ? `${t.navigate} — ${navBadgeLabel}` : t.navigate;

  const accessType = metadata?.access?.type ?? beach.staticLabels?.accessType;
  const customAccessLabel = metadata?.access?.label ?? beach.staticLabels?.accessLabel;
  const rawAccessLabel = accessType
    ? localizedAccessLabel(accessType, customAccessLabel, language)
    : t.accessibility[accessibility];
  const accessLabel = compactAccessLabel(language, accessibility, accessType, hasDirtRoadAccess(beach), rawAccessLabel);
  const roughSeaWarning = warnings.find(warning => warning.type === 'rough_sea');
  const isProtectedToday = exposureLevel === 'protected' && canClaimWindProtection;
  const cautionWaterConditions = windBeaufort >= 5 || (typeof cardSeaStateM === 'number' && Number.isFinite(cardSeaStateM) && cardSeaStateM >= SEA_STATE_AMBER_M);
  const isLessExposedToday = lessExposedToday ?? (isProtectedToday || isPartlyShelteredToday);
  const strongOpenBeachLabel = localizedCardCopy.exposedToWind;
  const displayStrongOpenBeachLabel = strongOpenBeachLabel;
  const displayOpenBeachLabel = windBeaufort >= 4 || cautionWaterConditions
    ? displayStrongOpenBeachLabel
    : localizedCardCopy.moreOpenToWind;
  const baseProtectionLabel = isProtectedToday
    ? (enclosedCove ? localizedCardCopy.enclosedCoveChip : labels.protected)
    : strongWindContext && isLessExposedToday && isPartlyShelteredToday
      ? labels.partlyShelteredToday
    : strongWindContext
      ? displayOpenBeachLabel
    : windBeaufort < 4
      ? labels.lightWind
      : windBeaufort >= 5
        ? isLessExposedToday && isPartlyShelteredToday
          ? labels.partlyShelteredToday
          : labels.windyExposed
        : labels.mildlyBreezy;
  const protectionLabel = windSuitabilityText || baseProtectionLabel;
  const exposureBadgeLabel = isProtectedToday
    ? (enclosedCove ? localizedCardCopy.enclosedCoveChip : labels.protected)
    : isExposed
      ? displayOpenBeachLabel
      : localizedCardCopy.localExposureCheck;
  const isLightWindConditionChip = windBeaufort < 4 && protectionLabel === labels.lightWind;
  const isExposedConditionChip = !isLightWindConditionChip && !isProtectedToday && (
    exposureLevel === 'exposed' ||
    protectionLabel === displayOpenBeachLabel ||
    protectionLabel === labels.windyExposed
  );
  const forceHideWindChip = windExposureMode === 'none';
  const simpleWindChipOnly = windExposureMode === 'simple';
  // For the simplified chip we only surface clearly protected or clearly exposed beaches.
  const windChipIsMeaningful = isProtectedToday || isExposedConditionChip;
  // The generic "better sheltered" header pill proved too noisy for every protected
  // beach and stays off — but a genuine enclosed cove (όρμος: >225° enclosure with a
  // narrow mouth, or curated) that is verifiably protected TODAY is the rare,
  // high-value signal the card exists to surface, so only that case renders the marker.
  const showHeaderProtectedMarker = enclosedCove && isProtectedToday;
  /**
   * Does the line under the beach name carry anything of its own?
   *
   * On a region page the island name is hidden (you already know which island you are on)
   * and there is no distance, so that line held ONLY the «Κλειστός όρμος» pill — a whole
   * row spent on one small badge, which pushed the amenity chips down far enough to clip
   * the «Πληροφορίες» button off the bottom of the card. When the line has real content
   * the pill rides with it as before; when it would be alone, it moves up beside the name.
   */
  const hasMetaLine = showIslandName || distance !== undefined;
  const windSuitabilityChipTone: Record<WindSuitabilityColor, string> = {
    // 'blue' = genuinely calm. There was a fifth, emerald 'green', for a cove holding flat water
    // while it blew; the cove stopped being a colour on 02/08/2026 and is now a map badge, so a
    // cove's chip is simply the chip its conditions earn.
    blue: 'border-sky-200/80 bg-sky-50/72 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300',
    yellow: 'border-yellow-200/90 bg-yellow-50/78 text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-300',
    orange: 'border-orange-200/90 bg-orange-50/78 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300',
    red: 'border-rose-200/90 bg-rose-50/78 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
  };
  // The shield used to belong to 'green' — the cove tone. The cove's identity on the card is
  // carried by ProtectedBeachMarker (the «Κλειστός όρμος» pill), which is keyed on enclosedCove
  // directly and is unaffected by the tone change.
  const windSuitabilityIcon = windSuitabilityColor === 'orange' || windSuitabilityColor === 'red'
    ? 'caution'
    : 'wind';
  const protectionChipTone = windSuitabilityColor
    ? windSuitabilityChipTone[windSuitabilityColor]
    : isLightWindConditionChip
      ? 'border-cyan-200/80 bg-cyan-50/70 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300'
      : isExposedConditionChip
      ? 'border-rose-200/90 bg-rose-50/78 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
      : isProtectedToday || (strongWindContext && isLessExposedToday)
        ? 'border-emerald-200/80 bg-emerald-50/72 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
        : roughSeaWarning
        ? warningToneClass(roughSeaWarning)
        : 'border-cyan-200/80 bg-cyan-50/70 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-300';
  const hasShallowWater = Boolean(metadata?.waterDepth?.type === 'shallow' || characteristics.shallowWaters);
  const beachTypeFeatureIcons: Record<BeachType, React.ReactNode> = {
    sandy: <SandDotsIcon className="h-3.5 w-3.5 shrink-0" />,
    pebbles: <CircleDot className="h-3.5 w-3.5 shrink-0" />,
    'sandy-pebbles': <SandPebblesIcon className="h-3.5 w-3.5 shrink-0" />,
    rocky: <Mountain className="h-3.5 w-3.5 shrink-0" />,
    unknown: <Info className="h-3.5 w-3.5 shrink-0" />,
  };
  const amenityChipLookup = new Map(
    getAmenityChips(beach, language)
    .filter(chip => chip.key !== 'unknownFacilities')
      .map(chip => [chip.key, chip] as const)
  );
  /**
   * ΤΑ ΙΔΙΑ ΕΞΙ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ ΣΕ ΚΑΘΕ ΚΑΡΤΑ (Μίλτος, 13/08/2026).
   *
   * Πριν, η κάρτα έδειχνε ΜΟΝΟ όσα χαρακτηριστικά είχε η παραλία: μια παραλία με ένα και
   * μόνο chip («Μέτρια πρόσβαση») δίπλα σε μία με έξι δεν διαβαζόταν ως «δεν έχει τα άλλα
   * πέντε» — διαβαζόταν ως «μάλλον δεν τα γράψαμε». Η σιωπή γεννούσε αμφιβολία και άφηνε
   * και μισή κάρτα κενή, αφού όλες οι κάρτες μιας σειράς παίρνουν το ίδιο ύψος.
   *
   * Τώρα οι έξι θέσεις υπάρχουν παντού, με την ίδια σειρά· όσες δεν ισχύουν μένουν αχνές
   * με διακεκομμένο περίγραμμα, οπότε η απουσία είναι ορατή απάντηση αντί για κενό. Το
   * ύψος δεν μεγάλωσε: έξι θέσεις ήταν ήδη το μέγιστο που χωρούσε η κάρτα.
   *
   * ΤΙΜΙΟΤΗΤΑ: το αχνό chip σημαίνει «δεν το έχουμε» ΚΑΙ «δεν το έχουμε επιβεβαιώσει» —
   * τα δεδομένα μας ξεχωρίζουν τα δύο (status 'no' vs 'unknown') αλλά η κάρτα δεν έχει
   * χώρο για δύο βαθμίδες γκρι, οπότε η διάκριση ζει στο tooltip/aria.
   */
  const amenityStatusByKey = new Map<AmenityStatusRow['key'], AmenityStatusRow['status']>(
    getAmenityStatusRows(beach, language).map(row => [row.key, row.status] as const)
  );
  const missingAmenityTitle = (key: AmenityChipKey): string => {
    const status = amenityStatusByKey.get(key as AmenityStatusRow['key']);
    return status === 'no'
      ? getLocalizedCopy(language, {
          en: 'Not available at this beach',
          gr: 'Δεν υπάρχει σε αυτή την παραλία',
          fr: "N'existe pas sur cette plage",
          de: 'An diesem Strand nicht vorhanden',
          it: 'Non presente in questa spiaggia',
        })
      : getLocalizedCopy(language, {
          en: 'Not recorded for this beach',
          gr: 'Δεν το έχουμε καταγράψει εδώ',
          fr: "Non recensé pour cette plage",
          de: 'Für diesen Strand nicht erfasst',
          it: 'Non registrato per questa spiaggia',
        });
  };
  const compactAmenityLabels = localizedCardCopy.amenities;
  /**
   * One fixed slot. `alternateKeys` exists because "food nearby" is one slot in the reader's
   * head but two signals in the data (taverna / café) — either one fills it.
   */
  const amenityFeatureSlot = (key: AmenityChipKey, ...alternateKeys: AmenityChipKey[]): CompactFeatureChip => {
    const presentKey = [key, ...alternateKeys].find(candidate => amenityChipLookup.has(candidate));
    const chip = presentKey ? amenityChipLookup.get(presentKey) : undefined;
    if (chip) {
      return {
        key: `amenity-${key}`,
        label: compactAmenityLabel(chip, language),
        icon: amenityChipIcon(chip),
      };
    }
    return {
      key: `amenity-${key}`,
      label: compactAmenityLabels[key] || key,
      icon: amenityChipIcon({ key }),
      muted: true,
      title: missingAmenityTitle(key),
    };
  };
  /**
   * ΑΝ ΔΕΝ ΞΕΡΟΥΜΕ ΤΟΝ ΒΥΘΟ, ΔΕΝ ΓΡΑΦΟΥΜΕ ΤΙΠΟΤΑ (Μίλτος, 13/08/2026).
   *
   * Οι παροχές είναι δυαδικές — «δεν έχει ξαπλώστρες» είναι χρήσιμη απάντηση. Το είδος της
   * παραλίας δεν είναι: κάθε παραλία ΕΧΕΙ βυθό, απλώς εμείς δεν τον καταγράψαμε, και ένα chip
   * «Άγνωστο» θα διαφήμιζε το κενό μας αντί να πει κάτι για την παραλία. Η θέση μένει κενή
   * αλλά κρατημένη, ώστε οι υπόλοιπες να μη μετακινηθούν και το ύψος της κάρτας να μην αλλάξει.
   */
  const surfaceFeatureChip: CompactFeatureChip = beachType !== 'unknown'
    ? { key: 'surface', label: t.filterOptions[beachType], icon: beachTypeFeatureIcons[beachType] }
    : { key: 'surface', label: '', icon: null, placeholder: true };
  const accessFeatureChip: CompactFeatureChip = {
    key: 'access',
    label: accessLabel,
    icon: <Footprints className="h-3.5 w-3.5 shrink-0" />,
  };
  const featureChips: CompactFeatureChip[] = [
    accessFeatureChip,
    surfaceFeatureChip,
    amenityFeatureSlot('sunbeds'),
    amenityFeatureSlot('beachBar'),
    amenityFeatureSlot('foodNearby', 'cafeNearby', 'snackCanteen'),
    amenityFeatureSlot('parking'),
  ];
  // Τα ρηχά νερά ΔΕΝ γίνονται αχνή θέση: η απουσία σήμανσης «ρηχά» δεν αποδεικνύει βαθιά
  // νερά, οπότε ένα αχνό «Ρηχά νερά» θα έλεγε κάτι που δεν ξέρουμε. Μπαίνει μόνο όταν ισχύει,
  // σε δική του πλήρη γραμμή κάτω από τις έξι σταθερές θέσεις.
  if (hasShallowWater) {
    featureChips.push({
      key: 'shallow',
      label: cautionWaterConditions ? labels.shallowWatersCaution : labels.shallowWaters,
      icon: <Droplets className="h-3.5 w-3.5 shrink-0" />,
      fullWidth: true,
    });
  }
  const featureChipMutedClass = 'border-dashed border-slate-200/90 bg-transparent text-slate-400/90 dark:border-slate-700/70 dark:bg-transparent dark:text-slate-500';
  const featureChipClass = (chip: CompactFeatureChip): string => {
    // Οι έξι σταθερές θέσεις είναι δίστηλο πλέγμα (εικονίδιο | κείμενο) ώστε τα κείμενα να
    // ξεκινούν στην ΙΔΙΑ κάθετη γραμμή σε όλη τη στήλη. Η μοναχική γραμμή των ρηχών νερών δεν
    // έχει με τι να στοιχιστεί — αριστερά άφηνε ένα κενό μισής κάρτας δίπλα της — οπότε εκεί
    // το ζευγάρι εικονίδιο+κείμενο κεντράρεται ως ένα πράγμα.
    const layout = chip.fullWidth
      ? 'col-span-2 flex justify-center'
      : 'grid grid-cols-[1rem_minmax(0,1fr)]';
    if (chip.placeholder) return `${featureChipBase} ${layout} invisible border-transparent bg-transparent`;
    return `${featureChipBase} ${layout}${chip.muted ? ` ${featureChipMutedClass}` : ''}`;
  };
  const featureChipBase = `min-h-8 sm:min-h-7 w-full min-w-0 items-center gap-1.5 rounded-full border border-sky-100/70 bg-white/68 px-2 py-1 text-xs font-semibold leading-tight text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300`;
  const featureChipIconClass = 'flex h-4 w-4 shrink-0 items-center justify-center justify-self-center';
  const featureChipLabelClass = (chip: CompactFeatureChip): string =>
    `min-w-0 whitespace-normal break-words leading-tight ${chip.fullWidth ? 'text-center' : 'text-left'}`;
  const showMobileProtectionChip = forceHideWindChip
    ? false
    : simpleWindChipOnly
      ? !isProtectedToday && windChipIsMeaningful
      : !isProtectedToday && Boolean(windSuitabilityText || isExposedConditionChip);
  // Search-result cards lead with the today-verdict pill (ideal / good / exposed)
  // so the beach reads its own status at a glance. On mobile it takes the wind-chip
  // slot in the header (which is hidden on phones for the score body below).
  const showForcedTodayScoreBadge = forceTodayScoreBadge && showTodayScoreBadge && todayScore !== undefined;
  // Curated "top pick" podium treatment — a teal frame + ranked medal so the
  // highlighted set reads as one group, distinct from the generic suitable list.
  // #1 keeps the strongest (filled) emphasis; #2/#3 are teal-outlined (emphasis,
  // not demotion). The honest "what kind of day it is" claim (Top 3 vs "less
  // exposed") stays in the section heading, so the medal is rank-only and never
  // overstates in a strong-wind regime. Falls back gracefully when not a podium card.
  const isPodium = topPickPodium === true && recommendationRank !== undefined;
  const podiumRankValue = recommendationLabel ?? recommendationRank;
  const podiumMedalAriaLabel = getLocalizedCopy(language, {
    en: `Top pick #${podiumRankValue}`,
    gr: `Κορυφαία επιλογή #${podiumRankValue}`,
    fr: `Choix #${podiumRankValue}`,
    de: `Top-Empfehlung #${podiumRankValue}`,
    it: `Scelta #${podiumRankValue}`,
  });
  const rankMedalBase = 'grid h-8 min-w-8 place-items-center rounded-full text-xs font-extrabold';
  const mobileRankClass = recommendationRank === 1
    ? `${rankMedalBase} bg-[#007a83] text-white ring-1 ring-[#007a83]/30`
    : isPodium
    ? `${rankMedalBase} bg-white text-[#007a83] ring-1 ring-[#007a83]/45`
    : `${rankMedalBase} bg-sky-50 text-cyan-800 ring-1 ring-sky-100`;
  // Podium gets the same Medal-icon pill on mobile as on desktop, so the "top 3"
  // marker is identical across viewports (a bare teal circle was indistinguishable
  // from the pre-existing #1 badge on phones).
  const mobilePodiumPillClass = recommendationRank === 1
    ? 'inline-flex min-h-8 items-center gap-1 rounded-full bg-[#007a83] px-2 py-1 text-xs font-extrabold text-white ring-1 ring-[#007a83]/30'
    : 'inline-flex min-h-8 items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-extrabold text-[#007a83] ring-1 ring-[#007a83]/45';
  /**
   * ΤΑ ΜΠΟΦΟΡ ΚΑΙ ΤΟ ΚΥΜΑ ΜΠΑΙΝΟΥΝ ΣΕ ΙΣΕΣ ΣΤΗΛΕΣ (11/08/2026).
   *
   * Η γραμμή ήταν flex με στοίχιση αριστερά, οπότε ο διαχωριστής έπεφτε αλλού σε κάθε κάρτα —
   * «3 Μπφ | 0,3 μ.» δίπλα σε «5 Μπφ | ~1,1 μ.» δεν διαβάζονταν ως η ίδια πληροφορία. Ένα grid
   * με ίσες στήλες βάζει τον διαχωριστή στο ίδιο σημείο σε όλες τις κάρτες του καρουζέλ.
   */
  /**
   * ΤΑ ΝΟΥΜΕΡΑ ΑΠΟΚΤΟΥΝ ΕΠΙΚΕΦΑΛΙΔΑ ΣΕ ΛΕΞΕΙΣ (Μίλτος, 14/08/2026).
   *
   * «5 Μπφ | ~0,1 μ.» είναι δύο σωστές μετρήσεις που ζητούν από τον επισκέπτη να κάνει μόνος
   * του τη μετάφραση — και το ζευγάρι λέει κάτι που κανένα από τα δύο δεν λέει χωριστά:
   * φυσάει δυνατά ΚΑΙ η θάλασσα μπροστά σου είναι λάδι. Η φράση μπαίνει ΠΑΝΩ από τα νούμερα,
   * δεν τα αντικαθιστά: ο κανόνας της §7δ (τα νούμερα μένουν στην οθόνη) και ο κανόνας του
   * βάθρου (αριθμός, όχι ετυμηγορία) ισχύουν και οι δύο — απλώς τώρα υπάρχει και μια γραμμή
   * που διαβάζεται σε ένα δευτερόλεπτο. Λεξιλόγιο και κατώφλια: utils/conditionsFeelPhrase.
   */
  // Το ΙΔΙΟ νούμερο που τυπώνεται από κάτω — ποτέ το `cardSeaStateM`, που σε όρμο διαβάζει
  // το ανοιχτό νερό και θα έβαζε «μεγάλο κύμα» πάνω από ένα «~0,1 μ.». Το δένει η
  // `buildBeachConditionsReadout`, μία φορά για κάρτα και ταμπελάκι μαζί.
  const conditionsFeel = conditionsReadout.feel;
  const conditionsFeelPhrase = conditionsFeel?.phrase;
  const podiumWhyItems: Array<{
    key: string;
    icon: React.ReactNode;
    text: string;
    title?: string;
    ariaLabel?: string;
    truncate?: boolean;
    /** Η λέξη-αίσθηση ΠΑΝΩ από ΤΟ ΔΙΚΟ ΤΗΣ νούμερο (όχι μία ενιαία γραμμή πάνω από τα δύο μαζί —
     *  αυτό διάβαζε σαν να «μπαίνει η μία στο κουτάκι της άλλης», Μίλτος 15/08/2026). */
    feelWord?: string;
  }> = [
    {
      key: 'wind',
      // 12px εικονίδιο, όχι 14: από τις 14/08 τα νούμερα είναι η ΑΠΟΔΕΙΞΗ κάτω από τη φράση,
      // όχι η επικεφαλίδα, και ένα εικονίδιο μεγαλύτερο από το κείμενό του τραβούσε το μάτι
      // στο λάθος πράγμα.
      icon: <Wind className="h-3 w-3 shrink-0 text-sky-600/90 dark:text-sky-300/90" aria-hidden="true" />,
      // Χωρίς κύμα η φράση λέει μόνο τον αέρα, οπότε από πάνω θα διάβαζε το ίδιο πράγμα δύο
      // φορές· εκεί μπαίνει στην ίδια σειρά με το νούμερο. ΜΕ κύμα, η λέξη μπαίνει σαν
      // `feelWord` πάνω από το ίδιο αυτό νούμερο, όχι εδώ μέσα στο κείμενο.
      text: !cardWaveText && conditionsFeelPhrase
        ? `${conditionsFeelPhrase} · ${windBeaufort} ${beaufortUnitLabel}`
        : `${windBeaufort} ${beaufortUnitLabel}`,
      // Σκέτο «5 Μπφ» σε αναγνώστη οθόνης δεν λέει ΤΙ είναι το 5 — το κύμα δίπλα το λέει από
      // την πρώτη μέρα, ο άνεμος όχι.
      ariaLabel: `${windOnShoreLabel}: ${windBeaufort} ${beaufortUnitLabel}`,
      feelWord: cardWaveText ? conditionsFeel?.windWord : undefined,
    },
  ];
  if (cardWaveText) {
    podiumWhyItems.push({
      key: 'wave',
      icon: <Waves className="h-3 w-3 shrink-0 text-sky-600/90 dark:text-sky-300/90" aria-hidden="true" />,
      text: cardWaveText,
      title: cardWaveLabel,
      // Το αναγνωστικό κείμενο κρατά τον ΤΙΤΛΟ + το σκέτο νούμερο, αλλιώς μετά την αλλαγή
      // παραπάνω θα διαβαζόταν «Κύμα ανοιχτά: 1,5 μ. ανοιχτά».
      ariaLabel: `${cardWaveLabel}: ${cardWaveValueText}`,
      feelWord: conditionsFeel?.waveWord,
    });
  }
  /**
   * ΟΧΙ ΩΡΑ ΣΤΗ ΜΠΡΟΣΤΙΝΗ ΟΨΗ ΤΗΣ ΚΑΡΤΑΣ ΣΤΟ ΚΙΝΗΤΟ (Μίλτος, 13/08/2026).
   *
   * Η ώρα έμπαινε τρίτη σε αυτή τη γραμμή τριών στηλών, οπότε σε τηλέφωνο έπεφτε σε ~1/3 του
   * πλάτους και τυπωνόταν «Top 1…» — μια κομμένη λέξη που δεν λέει τίποτα και τρώει τον χώρο
   * των δύο νούμερων (μποφόρ, κύμα) που όντως διαβάζονται. Η πληροφορία ΔΕΝ χάθηκε: μένει στη
   * σελίδα της παραλίας (καταλληλότερη ώρα) και στην πλήρη γραμμή της κάρτας σε υπολογιστή,
   * όπου υπάρχει πλάτος να γραφτεί ολόκληρη με τον τίτλο της.
   */
  /**
   * ΤΟ ΝΕΡΟ ΔΕΝ ΓΙΝΕΤΑΙ ΤΡΙΤΗ ΣΤΗΛΗ (15/08/2026) — το μάθημα της 13/08 είναι 40 γραμμές πιο πάνω:
   * τρεις στήλες σε τηλέφωνο 320 px δίνουν ~1/3 πλάτος στην καθεμία και κόβουν λέξεις, γι' αυτό
   * ακριβώς βγήκε τότε η ώρα από εδώ. Μπαίνει σε δική του γραμμή από κάτω, και μόνο όταν έχει
   * κάτι να πει (όχι στο «ιδανικό» — βλ. utils/waterTemperatureCopy).
   */
  const waterCardLine = buildWaterTemperatureCardLine(seaTemperatureC, language);
  const podiumWhyColumnsClass = podiumWhyItems.length >= 3
    ? 'grid-cols-3'
    : podiumWhyItems.length === 2
      ? 'grid-cols-2'
      : 'grid-cols-1';
  if (variant === 'decision' || variant === 'default') {
    return (
      <div
        onClick={onClick}
        data-nosnippet="true"
        className={`group relative beach-card flex h-full w-full cursor-pointer flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.995]${isPodium ? ' border-2 border-[#007a83]/45' : ''}`}
      >
        <div className={`order-2 flex min-h-0 flex-1 flex-col overflow-hidden border-b px-3.5 pb-2 pt-3 sm:hidden ${isPodium
          ? 'border-[#007a83]/15 bg-[#007a83]/[0.05] dark:border-[#007a83]/30 dark:bg-[#007a83]/15'
          : 'border-sky-100/70 bg-white dark:border-slate-800 dark:bg-slate-900/90'}`}>
          <div className={`grid min-w-0 items-start gap-2.5 ${isPodium ? 'grid-cols-[auto_minmax(0,1fr)_2.75rem]' : 'grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]'}`}>
            <div className="flex h-11 min-w-11 items-start justify-start" {...(recommendationRank === undefined ? { 'aria-hidden': true } : {})}>
              {recommendationRank !== undefined && (
                isPodium ? (
                  <span className={mobilePodiumPillClass} aria-label={podiumMedalAriaLabel}>
                    <Medal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{recommendationLabel ?? recommendationRank}</span>
                  </span>
                ) : (
                  <span className={mobileRankClass}>
                    {recommendationLabel ?? recommendationRank}
                  </span>
                )
              )}
            </div>

            {/* Where the shelter pill goes depends on whether the meta line exists at all.
                Inside a region page we hide the island name and there is no distance, so the
                pill was the ONLY thing on that line — a full row spent on one small badge,
                which pushed the amenity chips down and clipped the «Πληροφορίες» button off
                the card (reported 31/07). When the line has real content the pill still rides
                with it; when it would be alone, it sits beside the beach name instead. */}
            <div className="min-w-0 pt-0.5 text-center">
              <div className="flex min-h-[2.45rem] flex-wrap items-center justify-center gap-x-1.5">
                <h3 className="line-clamp-2 text-center font-heading text-lg font-extrabold leading-[1.08] text-slate-950 dark:text-white">
                  {beachDisplayName}
                </h3>
                {showHeaderProtectedMarker && !hasMetaLine && (
                  <ProtectedBeachMarker language={language} selectedDate={selectedDate} enclosedCove={enclosedCove && isProtectedToday} />
                )}
              </div>
              {hasMetaLine && (
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-700 dark:text-slate-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {showIslandName && <span className="min-w-0 truncate">{islandName}</span>}
                  {distance !== undefined && <span className="shrink-0 text-primary">{distance.toFixed(1)} km</span>}
                  {showHeaderProtectedMarker && <ProtectedBeachMarker language={language} selectedDate={selectedDate} enclosedCove={enclosedCove && isProtectedToday} />}
                </div>
              )}
              {/* Η γραμμή «γαλάζια σημαία / φωτογραφία» κρατούσε ύψος ακόμη κι όταν ήταν άδεια —
                  ένα κενό 20px ανάμεσα στο όνομα και στα μποφόρ σε ΚΑΘΕ κάρτα χωρίς σημαία.
                  Τώρα υπάρχει μόνο όταν έχει κάτι να πει. */}
              {(hasBlueFlag2026 || (cardPhoto && !isPhotoCueDismissed)) && (
              <div className="mt-1 flex h-4 min-w-0 flex-nowrap items-center justify-center gap-x-2 overflow-hidden text-[11px] font-bold leading-tight text-cyan-800/90">
                  {hasBlueFlag2026 && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{localizedCardCopy.blueFlag}</span>
                    </span>
                  )}
                  {cardPhoto && !isPhotoCueDismissed && (
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-cyan-700">
                      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{localizedCardCopy.photoBelow}</span>
                    </span>
                  )}
              </div>
              )}
            </div>

            <button
              onClick={handleFavoriteClick}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-white hover:text-rose-500 cursor-pointer dark:bg-slate-800 dark:ring-slate-700"
              aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
            >
              <Heart className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          </div>

          <div className="mt-1.5 space-y-1.5">
            {showForcedTodayScoreBadge ? (
              <TodayScoreBadge
                score={todayScore}
                language={language}
                selectedDate={selectedDate}
                windBeaufort={windBeaufort}
                waveHeightM={waveHeightM}
                wavePeriodS={seaStatePeriodS}
                swimmingComfort={swimmingComfort}
                exposureLevel={exposureLevel}
                conditionTone={windSuitabilityColor}
                canClaimWindProtection={canClaimWindProtection}
                selectedHour={selectedHour}
                boatAccess={isBoatOnlyBeach}
                forceShow
              />
            ) : showMobileProtectionChip ? (
              <span className={`inline-flex min-h-9 w-full min-w-0 items-center justify-start gap-1.5 overflow-hidden rounded-xl border px-2.5 py-1.5 text-xs font-semibold leading-tight ${protectionChipTone}`}>
                {windSuitabilityIcon === 'wind' || (!windSuitabilityColor && isLightWindConditionChip) ? (
                  <Wind className="h-3.5 w-3.5 shrink-0" />
                ) : windSuitabilityIcon === 'caution' || (!windSuitabilityColor && isExposedConditionChip) ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 line-clamp-2 leading-tight">{protectionLabel}</span>
              </span>
            ) : null}

            {/* THE MOBILE «WHY» ROW — ONE row for both facts. The desktop column renders the wind
                figure and the «Top μέχρι» hour as two rows, but this body is height-constrained
                (the 31/07 defect was the «Πληροφορίες» button clipped off the card by exactly one
                extra row), so here they share a line. Same rules as the desktop row: the Beaufort
                is the pin's own reading, stated as a number — never a word, never a colour.

                ΤΟ ΚΥΜΑ ΣΕ ΚΑΘΕ ΚΑΡΤΑ, ΟΧΙ ΜΟΝΟ ΣΤΟ ΒΑΘΡΟ (Μίλτος, 13/08/2026). Η γραμμή έδειχνε τα
                δύο νούμερα μόνο στις τρεις κορυφαίες, οπότε η 4η παραλία της λίστας — που ο
                επισκέπτης συγκρίνει με τις τρεις από πάνω — δεν έλεγε πόσο κύμα έχει. Τώρα κάθε
                κάρτα με μετρημένο κύμα δείχνει την ίδια γραμμή· χωρίς κύμα δεν μπαίνει γραμμή
                μόνο για τα μποφόρ, γιατί αυτά τα λέει ήδη το chip από πάνω. */}
            {(isPodium || Boolean(cardWaveText)) && (
              <div className="w-full min-w-0 overflow-hidden rounded-xl border border-sky-100 bg-sky-50/70 px-1.5 py-1 dark:border-sky-900/45 dark:bg-sky-950/25">
                {/* Η ΛΕΞΗ ΠΑΝΩ ΑΠΟ ΤΟ ΔΙΚΟ ΤΗΣ ΝΟΥΜΕΡΟ, ΟΧΙ ΜΙΑ ΓΡΑΜΜΗ ΠΑΝΩ ΑΠΟ ΤΑ ΔΥΟ (15/08/2026).
                    Πριν, «Δυνατός αέρας, θάλασσα λάδι» ήταν ΜΙΑ κεντραρισμένη γραμμή πάνω από ΟΛΟ
                    το πλάτος — δεν ευθυγραμμιζόταν με καμία από τις δύο στήλες από κάτω, οπότε σε
                    στενή οθόνη διάβαζε σαν η μία λέξη να «μπαίνει στο κουτάκι» της άλλης. Τώρα κάθε
                    λέξη κάθεται ΜΕΣΑ στη στήλη του δικού της νούμερου: «Δυνατός αέρας» πάνω από
                    «6 Μπφ», «Θάλασσα λάδι» πάνω από «~0,1 μ.». Χωρίς κύμα δεν υπάρχει δεύτερη
                    στήλη, οπότε η λέξη μπαίνει στην ίδια σειρά με το νούμερο (βλ. `feelWord`
                    πάνω, μόνο όταν υπάρχει `cardWaveText`). */}
                <div className={`grid min-w-0 items-stretch font-bold leading-tight ${cardWaveText
                  ? 'text-[10px] text-slate-600 dark:text-slate-300'
                  : 'min-h-6 text-[11px] text-slate-800 dark:text-slate-200'} ${podiumWhyColumnsClass}`}>
                  {podiumWhyItems.map((item, index) => (
                    <span
                      key={item.key}
                      // `data-tilefit` is the marker scripts/validateTileFit.mjs measures. Added here on
                      // 13/08/2026 together with the «ανοιχτά» word: this row is two columns on a 320 px
                      // phone, and a word that gets cut in half is worse than no word at all.
                      data-tilefit={`podium-why-${item.key}`}
                      // `my-0.5` κρατά τον διαχωριστή κοντύτερο από τη γραμμή: σε κείμενο 10 px μια
                      // κάθετη που φτάνει άκρη-άκρη διαβάζεται πιο βαριά από τα νούμερα που χωρίζει.
                      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1.5 ${index > 0 ? 'my-0.5 border-l border-sky-200/80 dark:border-sky-900/60' : ''}`}
                      title={item.title}
                      aria-label={item.ariaLabel}
                    >
                      {item.feelWord && (
                        <span
                          data-tilefit={`podium-why-${item.key}-feel`}
                          className="block w-full min-w-0 truncate text-center text-[11px] font-extrabold leading-[1.15] text-slate-900 dark:text-white"
                        >
                          {item.feelWord}
                        </span>
                      )}
                      <span className="flex min-w-0 items-center justify-center gap-1">
                        {item.icon}
                        <span className={item.truncate ? 'min-w-0 truncate' : 'min-w-0'}>{item.text}</span>
                      </span>
                    </span>
                  ))}
                </div>
                {waterCardLine && (
                  <div
                    data-tilefit="podium-why-water"
                    className="mt-1 flex min-w-0 items-center justify-center gap-1 text-[10px] font-bold leading-tight text-slate-600 dark:text-slate-300"
                  >
                    <Thermometer className="h-3 w-3 shrink-0 text-sky-600/90 dark:text-sky-300/90" aria-hidden="true" />
                    <span className="min-w-0 truncate">{waterCardLine}</span>
                  </div>
                )}
              </div>
            )}

            {/* Fixed mobile slot mirrors the desktop feature set, including a third row
                when the beach has 5-6 compact chips. */}
            {featureChips.length > 0 ? (
              <div className="grid min-w-0 grid-cols-2 auto-rows-min content-start gap-1.5">
                {featureChips.map(chip => (
                  <span key={chip.key} className={featureChipClass(chip)} title={chip.title} aria-hidden={chip.placeholder || undefined} aria-label={chip.title ? `${chip.label}: ${chip.title}` : undefined}>
                    <span className={featureChipIconClass}>{chip.icon}</span>
                    <span className={featureChipLabelClass(chip)}>{chip.label}</span>
                  </span>
                ))}
              </div>
            ) : !showMobileProtectionChip ? (
              <div className="grid content-start overflow-hidden">
                <span className="inline-flex min-h-9 w-full min-w-0 items-center justify-start gap-1.5 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/70 px-2.5 py-1.5 text-xs font-semibold leading-tight text-slate-600">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 line-clamp-2 leading-tight">{localizedCardCopy.localExposureCheck}</span>
                </span>
              </div>
            ) : null}

          </div>
        </div>

        <div
          ref={cardPhotoAreaRef}
          className={`relative order-1 h-28 shrink-0 overflow-hidden bg-sky-50 sm:order-none sm:h-auto sm:flex-none sm:aspect-[16/9] sm:min-h-36 sm:max-h-44 ${isCompact ? 'lg:min-h-28 lg:max-h-32' : ''}`}
        >
          {cardPhoto ? (
            <img
              src={cardPhoto}
              alt={beachDisplayName}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              width={640}
              height={360}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setPhotoIndex((current) => current + 1)}
            />
          ) : (
            <BeachPhotoFallback
              beach={beach}
              regionId={detailRegionId}
              language={language}
              beachName={beachDisplayName}
            />
          )}
          {cardPhoto && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/0" />}

          <div className="absolute left-3 top-3 z-20 hidden max-w-[calc(100%-4.75rem)] flex-wrap items-center gap-2 sm:flex">
            {recommendationRank !== undefined && (
              isPodium ? (
                <span
                  aria-label={podiumMedalAriaLabel}
                  className={recommendationRank === 1
                    ? 'inline-flex min-h-8 items-center gap-1 rounded-full bg-[#007a83] px-2.5 py-1 text-xs font-extrabold text-white shadow-sm ring-1 ring-white/30'
                    : 'inline-flex min-h-8 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-[#007a83] shadow-sm ring-1 ring-[#007a83]/35'}>
                  <Medal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{podiumRankValue}</span>
                </span>
              ) : (
                <span className={recommendationRank === 1
                  ? 'inline-flex min-h-8 items-center rounded-full bg-[#007a83] px-2.5 py-1 text-xs font-extrabold text-white shadow-sm ring-1 ring-white/30'
                  : 'inline-flex min-h-8 items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-black/5'}>
                  {recommendationLabel ?? recommendationRank}
                </span>
              )
            )}
            {isCertified && <CertifiedBadge language={language} />}
            {hasBlueFlag2026 && <BlueFlagBadge language={language} />}
            {hasAccessibleRamp && <AccessibilityBadge language={language} state={seatracRampState} />}
            {hasNearbyCamping && <CampingBadge language={language} />}
            {paidEntry && <PaidEntryBadge kind={paidEntry.kind} language={language} />}
          </div>

          <button
            onClick={handleFavoriteClick}
            className="absolute right-3 top-3 hidden h-11 w-11 place-items-center rounded-xl bg-white/95 text-slate-700 shadow-sm transition-colors hover:bg-white hover:text-rose-500 cursor-pointer sm:grid"
            aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
          >
            <Heart className={`h-4 w-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        </div>

        <div className={`hidden flex-col sm:flex sm:flex-1 ${isCompact ? 'gap-3 px-3 pb-0 pt-3 sm:px-[1.05rem] sm:pt-[1.05rem] lg:gap-2 lg:px-3 lg:pt-3' : 'gap-3 px-3 pb-0 pt-3 sm:px-[1.05rem] sm:pt-[1.05rem]'}`}>
          <div className={`${isCompact ? 'space-y-1 lg:space-y-0.5' : 'space-y-1'} hidden sm:block`}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
              <h3 className="line-clamp-1 min-w-0 font-heading text-lg font-extrabold leading-[1.12] text-slate-950 transition-colors group-hover:text-primary dark:text-white">
                {beachDisplayName}
              </h3>
              {showHeaderProtectedMarker && !hasMetaLine && (
                <ProtectedBeachMarker language={language} selectedDate={selectedDate} enclosedCove={enclosedCove && isProtectedToday} />
              )}
            </div>
            {hasMetaLine && (
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-slate-700 dark:text-slate-600">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {showIslandName && <span className="min-w-0 flex-1 truncate">{islandName}</span>}
                {distance !== undefined && <span className="shrink-0 text-primary">{distance.toFixed(1)} km</span>}
                {showHeaderProtectedMarker && <ProtectedBeachMarker language={language} selectedDate={selectedDate} enclosedCove={enclosedCove && isProtectedToday} />}
              </div>
            )}
          </div>

          {showTodayScoreBadge && (
          <div className={`grid grid-cols-1 ${isCompact ? 'gap-2 lg:gap-1.5' : 'gap-2'}`}>
            {todayScore !== undefined ? (
              <TodayScoreBadge
                score={todayScore}
                language={language}
                selectedDate={selectedDate}
                windBeaufort={windBeaufort}
                waveHeightM={waveHeightM}
                wavePeriodS={seaStatePeriodS}
                swimmingComfort={swimmingComfort}
                exposureLevel={exposureLevel}
                conditionTone={windSuitabilityColor}
                canClaimWindProtection={canClaimWindProtection}
                selectedHour={selectedHour}
                boatAccess={isBoatOnlyBeach}
                forceShow={forceTodayScoreBadge}
              />
            ) : realVisitorRating !== null ? (
              <div className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" title={labels.visitorRating}>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{realVisitorRating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
          )}

          {/* THE «WHY» ROW — a NUMBER, never a verdict. The podium deliberately silences every
              per-card condition opinion (windExposureMode 'none', hidden exposure badge, hidden
              score badge): the map above is the only surface allowed to colour a beach, and two
              ladders is the defect class this project keeps paying for. What was lost with them is
              any sign of WHY these three lead — the card read like a tourist listing (easy access,
              sunbeds, taverna). A bare Beaufort figure restores the why without reopening the
              ladder: it is the SAME per-beach reading the map pin used (beachWindSpeedKmph ←
              perBeachMapWind), stated as a fact, with no word and no colour attached. Podium cards
              only — the general list keeps its slimmer body. */}
          {/* Η ΙΔΙΑ ΦΡΑΣΗ ΜΕ ΤΟ ΚΙΝΗΤΟ, ΚΑΙ ΕΠΙΤΕΛΟΥΣ ΤΟ ΚΥΜΑ (14/08/2026). Αυτή η γραμμή έδειχνε
              μόνο τα μποφόρ: ο υπολογιστής, που έχει τον περισσότερο χώρο, ήταν η μόνη οθόνη
              όπου το βάθρο δεν έλεγε πόσο κύμα έχει. Τώρα λέει και τα δύο, με την ίδια
              διατύπωση που διαβάζει ο διπλανός στο τηλέφωνο — μία γλώσσα, δύο οθόνες. */}
          {/* ΑΕΡΑΣ ΚΑΙ ΘΑΛΑΣΣΑ, ΔΥΟ ΞΕΧΩΡΙΣΤΑ ΣΗΜΑΤΑ ΚΑΙ ΣΤΟΝ ΥΠΟΛΟΓΙΣΤΗ (20/08/2026).
              Εδώ καθόταν η ενωμένη πρόταση («Πολύς αέρας αλλά θάλασσα λάδι») με τα δύο νούμερα
              από κάτω. Το κινητό είχε ήδη χωρίσει τα δύο σε δικά τους κελιά στις 15/08· ο
              υπολογιστής όχι, οπότε η ΙΔΙΑ παραλία διαβαζόταν διαφορετικά στις δύο οθόνες. Η
              ενωμένη μορφή έχει και δεύτερο κόστος: αφήνει τον αναγνώστη να διαβάσει «αέρας»
              και «κύμα» σαν ένα πράγμα, που είναι ακριβώς η παρανόηση της §Γ14 της βίβλου.
              Ίδια δομή, ίδιο λεξιλόγιο, ίδια εικονίδια με το κινητό — μία γλώσσα, δύο οθόνες.
              Η γραμμή ανοίγει και στις κάρτες εκτός βάθρου όπου υπάρχει κύμα, ακριβώς όπως στο
              κινητό: μέχρι σήμερα ο υπολογιστής δεν έλεγε ΤΙΠΟΤΑ για αέρα/θάλασσα εκτός βάθρου. */}
          {(isPodium || Boolean(cardWaveText)) && (
            <div
              className="flex min-h-9 w-full min-w-0 items-stretch rounded-xl border border-sky-100 bg-sky-50/70 px-1.5 py-1 text-left dark:border-sky-900/45 dark:bg-sky-950/25"
              aria-label={`${windOnShoreLabel}: ${windBeaufort} ${beaufortUnitLabel}${cardWaveText ? `. ${cardWaveLabel}: ${cardWaveValueText}` : ''}`}
            >
              {podiumWhyItems.map((item, index) => (
                <span
                  key={item.key}
                  title={item.title}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 ${index > 0 ? 'my-0.5 border-l border-sky-200/80 dark:border-sky-900/60' : ''}`}
                >
                  {item.feelWord && (
                    <span className="block w-full min-w-0 truncate text-center text-[11px] font-extrabold leading-[1.15] text-slate-900 dark:text-white">
                      {item.feelWord}
                    </span>
                  )}
                  <span className="flex min-w-0 items-center justify-center gap-1 text-[11px] font-bold leading-tight text-slate-600 dark:text-slate-300">
                    {item.icon}
                    <span className="min-w-0 truncate">{item.text}</span>
                  </span>
                </span>
              ))}
            </div>
          )}

          {topPickTimeLabel && (
            <div
              className="flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-xl border border-cyan-200/80 bg-cyan-50/85 px-3 py-2 text-left shadow-sm shadow-sky-900/5 dark:border-cyan-900/45 dark:bg-cyan-950/25"
              aria-label={`${visitTimeLabel}: ${topPickTimeLabel}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/85 text-cyan-700 shadow-sm ring-1 ring-cyan-100/70 dark:bg-slate-900 dark:text-cyan-300 dark:ring-cyan-900/45">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.68rem] font-bold leading-tight text-cyan-700/80 dark:text-cyan-300/80">
                  {visitTimeLabel}
                </span>
                <span className="block truncate text-sm font-extrabold leading-tight text-slate-950 dark:text-white">
                  {topPickTimeLabel}
                </span>
              </span>
            </div>
          )}

          {notInTopPicksNote && (
            /* Slate, not amber: this is an explanation, not a warning. The card beside it may be
               painted ΙΔΑΝΙΚΗ and both statements are true at once — the conditions are good AND
               a rule keeps it out of the picks. Colouring this like a hazard would contradict the
               pin. */
            <p className="w-full rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-left text-[0.68rem] font-semibold leading-snug text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300">
              {notInTopPicksNote}
            </p>
          )}

          {featureChips.length > 0 && (
            <div className="hidden grid-cols-2 auto-rows-min content-start gap-1.5 sm:grid">
              {featureChips.map(chip => (
                <span key={chip.key} className={featureChipClass(chip)} title={chip.title} aria-hidden={chip.placeholder || undefined} aria-label={chip.title ? `${chip.label}: ${chip.title}` : undefined}>
                  <span className={featureChipIconClass}>{chip.icon}</span>
                  <span className={featureChipLabelClass(chip)}>{chip.label}</span>
                </span>
              ))}
            </div>
          )}

        </div>

        <div className={`order-3 mt-auto flex items-center gap-2 border-t border-sky-50 bg-white/74 pt-2 sm:order-none ${isCompact ? 'px-3.5 pb-3.5 sm:px-3 sm:pb-3' : 'px-3.5 pb-3.5 sm:px-4 sm:pb-3'} dark:border-slate-800 dark:bg-slate-900/60`}>
          {detailHref ? (
            <a
              href={detailHref}
              onClick={handleDetailLinkClick}
              data-nosnippet="true"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-heading font-bold text-white shadow-sm shadow-cyan-700/20 transition-colors hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-10 cursor-pointer"
            >
              <Info className="h-4 w-4" />
              <span>{t.learnMore}</span>
              <span className="sr-only"> {beachDisplayName}</span>
            </a>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
              data-nosnippet="true"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-heading font-bold text-white shadow-sm shadow-cyan-700/20 transition-colors hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-10 cursor-pointer"
            >
              <Info className="h-4 w-4" />
              <span>{t.learnMore}</span>
            </button>
          )}
          {canNavigate && (
            <button
              onClick={handleNavigationClick}
              className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-primary transition-colors hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10 sm:w-10 dark:bg-sky-900/20 dark:hover:bg-sky-900/40 cursor-pointer"
              title={navButtonTitle}
              aria-label={t.navigateToLabel(beachDisplayName)}
            >
              <Navigation className="h-4 w-4" />
            </button>
          )}
          {navigator.share && (
            <button
              onClick={handleShare}
              className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10 sm:w-10 dark:bg-slate-800 cursor-pointer"
              aria-label={shareLabel}
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      data-nosnippet="true"
      className="group relative beach-card flex h-fit w-full cursor-pointer flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[16/9] min-h-40 max-h-48 overflow-hidden bg-sky-50">
        {cardPhoto ? (
          <img
            src={cardPhoto}
            alt={beachDisplayName}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            width={640}
            height={360}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setPhotoIndex((current) => current + 1)}
          />
        ) : (
          <BeachPhotoFallback
            beach={beach}
            regionId={detailRegionId}
            language={language}
            beachName={beachDisplayName}
          />
        )}
        {/* Dark overlay for readability when photo is present */}
        {cardPhoto && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/0" />}
        {/* Decorative wave pattern — aggressive for exposed, gentle for sheltered */}
        <svg className="absolute bottom-0 left-0 w-full text-white dark:text-slate-900 opacity-90" viewBox="0 0 400 40" preserveAspectRatio="none">
          {isExposed ? (
            <path d="M0 40 Q50 15 100 30 Q150 45 200 20 Q250 -5 300 25 Q350 45 400 15 L400 40 Z" fill="currentColor"/>
          ) : (
            <path d="M0 40 Q100 30 200 35 Q300 40 400 32 L400 40 Z" fill="currentColor"/>
          )}
        </svg>

        {/* Top badges overlay */}
        <div className="absolute top-3 left-3 flex max-w-[calc(100%-4.25rem)] flex-wrap gap-1.5">
          {!hideExposureBadge && (
            <div className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
              isProtectedToday ? 'bg-emerald-500/90 text-white' :
              isExposed ? 'bg-amber-500/90 text-white' : 'bg-sky-500/90 text-white'
            }`}>
              {isProtectedToday
                ? exposureBadgeLabel
                : (isExposed ? exposureBadgeLabel : localizedCardCopy.localExposureCheck)}
            </div>
          )}
          {isCertified && <CertifiedBadge language={language} compact />}
          {hasBlueFlag2026 && <BlueFlagBadge language={language} compact />}
          {hasAccessibleRamp && <AccessibilityBadge language={language} state={seatracRampState} compact />}
          {hasNearbyCamping && <CampingBadge language={language} compact />}
          {paidEntry && <PaidEntryBadge kind={paidEntry.kind} language={language} compact />}
        </div>

        {/* Favorite button overlay */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 p-2 rounded-xl bg-white/95 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
          aria-label={isFavorite ? unfavoriteLabel : favoriteLabel}
        >
          <Heart
            className={`w-4 h-4 transition-all duration-300 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600 hover:text-red-400'}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Name & Location */}
        <div className="mb-3">
          <h3 className="text-xl font-heading font-bold text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors duration-300">
            {beachDisplayName}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-slate-600">
            <MapPin className="w-3 h-3" />
            <span className="text-xs">{islandName}</span>
            {distance !== undefined && (
              <span className="text-xs text-primary font-medium">{distance.toFixed(1)} km</span>
            )}
          </div>
        </div>

        {/* Rating + Conditions row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {todayScore !== undefined ? (
            <>
              <TodayScoreBadge
                score={todayScore}
                language={language}
                selectedDate={selectedDate}
                windBeaufort={windBeaufort}
                waveHeightM={waveHeightM}
                wavePeriodS={seaStatePeriodS}
                swimmingComfort={swimmingComfort}
                exposureLevel={exposureLevel}
                conditionTone={windSuitabilityColor}
                canClaimWindProtection={canClaimWindProtection}
                selectedHour={selectedHour}
                boatAccess={isBoatOnlyBeach}
                forceShow={forceTodayScoreBadge}
              />
              {realVisitorRating !== null && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-700" title="Visitor rating">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{realVisitorRating.toFixed(1)}</span>
                </div>
              )}
            </>
          ) : realVisitorRating !== null ? (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{realVisitorRating.toFixed(1)}</span>
            </div>
          ) : null}

          {crowdLevel && (
            <span className={`text-[10px] font-bold ${
              crowdLevel === 'low' ? 'text-emerald-600' :
              crowdLevel === 'medium' ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {t.crowdLevels[crowdLevel]}
            </span>
          )}

          {metadata?.access ? <MetadataAccessInfo metadata={metadata} language={language} /> : <AccessibilityInfo accessibility={accessibility} t={t} />}
        </div>

        {metadata?.access?.notes && (
          <div className="mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2">
            <p className="text-[11px] leading-snug text-slate-700 dark:text-slate-600 line-clamp-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">{localizedAccessPrefix(language)}: </span>
              {language === 'gr' ? metadata.access.notes : localizedAccessLabel(metadata.access.type, metadata.access.label, language)}
            </p>
          </div>
        )}

        {/* Best Swim Window */}
        {bestSwimWindow && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-sky-50/80 dark:bg-sky-900/10 rounded-xl">
            <Waves className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{bestSwimWindow}</span>
          </div>
        )}

        {/* Condition Score */}
        <div className="mb-3">
          <BeachConditionScore isExposed={isExposed} windSpeed={effectiveWindKmph} waveHeightM={waveHeightM} seaStateWaveM={seaStateWaveM} seaStatePeriodS={seaStatePeriodS} temperature={temperature} compact={true} exposureLevel={exposureLevel} language={language} selectedDate={selectedDate} selectedHour={selectedHour} canClaimWindProtection={canClaimWindProtection} boatAccess={isBoatOnlyBeach} directSwell={warnings.some(warning => warning.type === 'direct_swell')} enclosedCove={enclosedCove && isProtectedToday} />
        </div>

        {warnings.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {pickVisibleWarnings(warnings).map((warning, index) => (
              <span
                key={`${warning.type}-${index}`}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${warningToneClass(warning)}`}
              >
                {strongWindContext && warning.type === 'exposed_to_wind'
                  ? displayOpenBeachLabel
                  : warningLabel(warning, language, selectedDate, selectedHour)}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <p
          className="text-slate-700 dark:text-slate-600 text-sm leading-relaxed line-clamp-2 mb-4"
          data-nosnippet="true"
        >
          {localizedBeachDescription(beach, language)}
        </p>

        {/* Tags */}
        <div className="mt-auto flex flex-wrap gap-1.5 mb-4">
          {metadata ? (
            <MetadataTags beach={beach} language={language} />
          ) : (
            <>
              <BeachTypeTag beachType={beachType} t={t} />
              <CharacteristicTags characteristics={characteristics} t={t} />
            </>
          )}
        </div>

        {/* Amenities */}
        {!metadata && (
          <div className="mb-4">
            <AmenityTags beach={beach} language={language} />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-5 flex items-center gap-2">
        {detailHref ? (
          <a
            href={detailHref}
            onClick={handleDetailLinkClick}
            data-nosnippet="true"
            className="flex-grow inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-heading font-semibold text-white transition-all duration-300 hover:bg-primary-dark active:scale-[0.98] cursor-pointer"
          >
            <Info className="w-4 h-4" />
            <span className="text-xs">{t.learnMore}</span>
            <span className="sr-only"> {beachDisplayName}</span>
          </a>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            data-nosnippet="true"
            className="flex-grow inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark active:scale-[0.98] text-white font-heading font-semibold rounded-xl transition-all duration-300 cursor-pointer min-h-[44px]"
          >
            <Info className="w-4 h-4" />
            <span className="text-xs">{t.learnMore}</span>
          </button>
        )}

        {canNavigate && (
          <button
            onClick={handleNavigationClick}
            className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-primary hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
            title={navButtonTitle}
            aria-label={t.navigateToLabel(beachDisplayName)}
          >
            <Navigation className="w-4 h-4" />
          </button>
        )}

        {navigator.share && (
          <button
            onClick={handleShare}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 hover:text-primary transition-colors cursor-pointer"
            aria-label={shareLabel}
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS CARD IS MEMOISED.
//
// A region holds up to 133 beaches and every one of them renders this card. The
// search box lives at the top of the app, so a single keystroke re-rendered the
// whole grid twice — once urgently for the letter you just typed, once again for
// the deferred results — even though no card's beach, wind or verdict had moved.
// On a phone that is what "the typing lags" actually was.
//
// The comparison is written GENERICALLY on purpose. Listing the ~45 props by hand
// would mean the next prop somebody adds is silently never compared, and a card
// that keeps showing yesterday's verdict is precisely the failure this project
// cannot afford. Every key is walked; unknown shapes fall through to "changed".
// ─────────────────────────────────────────────────────────────────────────────

const cardValuesMatch = (a: unknown, b: unknown, depth = 0): boolean => {
  if (Object.is(a, b)) return true;
  // Click/toggle handlers are rebuilt inline by the parent on every render and close
  // over the same beach, so their identity says nothing about what the card shows.
  if (typeof a === 'function' && typeof b === 'function') return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  // The props we pass are one level deep: `{...beach, distance}` is a fresh wrapper
  // around unchanged inner references, `warnings` a fresh array of unchanged flags.
  // Anything deeper we do not claim to understand — re-render, which is the safe way
  // to be wrong.
  if (depth >= 1) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => cardValuesMatch(item, b[index], depth + 1));
  }
  const previousKeys = Object.keys(a as Record<string, unknown>);
  const nextKeys = Object.keys(b as Record<string, unknown>);
  return previousKeys.length === nextKeys.length && previousKeys.every(key => cardValuesMatch(
    (a as Record<string, unknown>)[key],
    (b as Record<string, unknown>)[key],
    depth + 1
  ));
};

const beachCardPropsMatch = (previous: BeachCardProps, next: BeachCardProps): boolean => {
  const previousKeys = Object.keys(previous) as (keyof BeachCardProps)[];
  const nextKeys = Object.keys(next) as (keyof BeachCardProps)[];
  if (previousKeys.length !== nextKeys.length) return false;
  return previousKeys.every(key => cardValuesMatch(previous[key], next[key]));
};

export const BeachCard = React.memo(BeachCardImpl, beachCardPropsMatch);
