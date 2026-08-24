import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BadgeCheck, ShowerHead, Footprints, Navigation, MapPin, Clock, Wind, X, Info, Utensils, Waves, Users, Tent, Ticket, Euro, AlertTriangle, ChevronRight } from 'lucide-react';
import { isSurfSpotInSeason } from '../utils/surfSpots';
import { displayBeachName, localizedPopularityLabel, localizedLittleKnownLabel, localizedPaidEntryLabel, localizedPaidEntryExplanation } from '../utils/localization';
import { SuitableBeach, Beach, LanguageCode, ForecastItem } from '../types';
import { trackEvent, buildBeachExposureParams } from '../services/analyticsService';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { BeachPhotoFallback } from './ShorelineThumbnail';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';
import { conditionToneLabels, conditionToneCountPhrase, causeLinePhrase, type CauseLineWords } from '../utils/conditionToneLabels';
import {
  describeConditionCause, resolveCauseLineForm, causeLineMaySpeak, countCauseLineSplit,
  type ConditionCauseInput, type ConditionCauseReading, type CauseLineForm,
} from '../utils/conditionCause';
import { resolveCalmWaterState, calmWaterFilterCopy, type CalmWaterState } from '../utils/calmWaterFilter';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';
import { getBeachMapCoordinates } from '../utils/mapCoordinates';
import { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel, shouldShowWindExposureColors } from '../utils/mapExposure';
import type { ExposureLevel } from '../utils/windExposure';
import { canOpenNavigation, getNavigationBadge, openNavigation } from '../utils/navigation';
import { AmenityChip, getAmenityChips } from '../utils/amenities';
import { translations } from '../translations';
import { seaStateSeverityM } from '../utils/waveCharacter';
import { buildBeachConditionsReadout } from '../utils/beachConditionsReadout';
import { WIND_SUITABILITY_TONE_CLASSES, resolveConditionTone, showsCoveBadge, CALMNESS_ORDER, LEGEND_TONE_ORDER, type CalmnessTone } from '../utils/suitabilityTone';
import { hasDownwindSeaSample, holdsFlatWaterUnderOffshoreWind, holdsGlassWaterAtFourBeaufort } from '../utils/offshoreFlatWater';

interface BeachMapProps {
  beaches: SuitableBeach[];
  userLocation?: { lat: number; lon: number };
  /** Reported accuracy of the user's location, in metres, for the precision halo. */
  userLocationAccuracy?: number;
  onBeachClick?: (beach: Beach) => void;
  onVisibleBeachIdsChange?: (beachIds: number[]) => void;
  center?: [number, number];
  zoom?: number;
  windSpeed?: number;
  windDirection?: string;
  windDirectionDeg?: number;
  /** Per-beach local wind (direction deg + speed km/h) keyed by beach id, for the
   *  hover card so a differently-coloured beach is self-explanatory. Optional. */
  beachLocalWinds?: Record<number, { deg: number; speedKmh: number }>;
  /** Daytime hour slots for the slider (already filtered to "now onward" for today). */
  hourSlots?: ForecastItem[];
  /** The dt (seconds) of the hour currently selected on the slider. Controlled by the parent. */
  selectedHourDt?: number | null;
  /** Called when the user scrubs the slider to a different hour. Fires once per whole hour crossed. */
  onHourChange?: (dt: number) => void;
  /**
   * Called ONCE when the visitor has finished choosing an hour — finger lifted, arrow
   * clicked, key pressed — and the hour actually ended up different.
   *
   * `onHourChange` fires for every hour the finger crosses on its way, so anything
   * expensive-and-jumpy that should happen after the choice (scrolling the mobile list
   * back to the top, recentring the map on the new first beach) belongs here, not there.
   * Doing it per crossed hour is what made a drag feel like the page was freezing.
   */
  onHourSettled?: () => void;
  /** Whether to render the docked hour slider under the map. */
  enableHourSlider?: boolean;
  /**
   * ΤΟ ΠΑΤΗΜΑ ΤΗΣ ΠΙΝΕΖΑΣ ΑΝΟΙΓΕΙ ΤΑΜΠΕΛΑΚΙ ΑΝΤΙ ΓΙΑ ΤΗ ΣΕΛΙΔΑ (20/08/2026).
   *
   * Ανοιχτό μόνο στον χάρτη της κύριας οθόνης αποτελεσμάτων. Στη σελίδα της παραλίας η πινέζα
   * συνεχίζει να πηγαίνει κατευθείαν στην κάρτα — εκεί ο επισκέπτης έχει ήδη τα δύο νούμερα
   * μπροστά του και ένα ταμπελάκι θα τα έλεγε δεύτερη φορά.
   */
  showMarkerConditions?: boolean;
  /**
   * How long the visitor says they are staying, in hours — `null` means they have not said, which
   * is the untouched "this moment" behaviour. Rendered as chips beside the hour slider because
   * that is where time already lives on this surface; see utils/stayWindow for why it asks one
   * question (duration) and never a second one (arrival).
   */
  stayHours?: 2 | 4 | 8 | null;
  onStayHoursChange?: (hours: 2 | 4 | 8 | null) => void;
  language?: LanguageCode;
  selectedDate?: Date;
  compact?: boolean;
  preview?: boolean;
  /**
   * Whether to offer the street/satellite switch.
   *
   * Defaults to `!preview`, which was the only rule until 29/07 — and it hid the switch on
   * the one map that most needs it. The region map is flagged `preview` (it is embedded, not
   * a route) yet it is the big map a visitor actually reads, so the aerial view never
   * appeared there. Now the caller says so outright instead of it being inferred from a flag
   * that means something else.
   */
  showBasemapToggle?: boolean;
  enableScrollWheelZoom?: boolean;
  isExposureLoading?: boolean;
  topBeachId?: number;
  highlightedBeachId?: number;
  followHighlightedBeach?: boolean;
  fitBoundsToBeaches?: boolean;
  fitBoundsBeaches?: SuitableBeach[];
  fitBoundsKey?: string;
  /** Beach set used to derive the zoom-out floor and pan bounds. Defaults to `beaches`,
   *  but callers can pass the full region set so a name-search that narrows the visible
   *  pins to one beach doesn't trap the user fully zoomed in on it. */
  guardrailBeaches?: SuitableBeach[];
  onUserInteraction?: () => void;
  compactPreviewHeightClassName?: string;
  islandName?: string;
  /** Organized campsites near the focused beach (detail map only); rendered as tent pins. */
  campsites?: Array<{ id: string; name: string; lat: number; lon: number }>;
  /** Authoritative marker exposure level per beach id, overriding this map's own
   *  computation. Used by the detail map so a beach is coloured exactly as it is on
   *  the region map (which uses the single island-level wind), instead of letting
   *  the detail map re-derive a different colour from the per-beach cluster wind. */
  exposureLevelOverrides?: Map<number, ExposureLevel>;
  /** Accepted for caller compatibility (region coastline id). The pre-redesign map does not
   *  render a coastline ribbon, so this is intentionally unused. */
  regionId?: string;
  /** Legend filter: when set, only the pins wearing this colour are drawn. The legend keeps
   *  showing EVERY colour with its full count, so the user can always switch or clear. */
  toneFilter?: CalmnessTone | null;
  /** Turns the legend rows into buttons. Tapping the active row clears the filter. */
  onToneFilterChange?: (tone: CalmnessTone | null) => void;
  /** The colour each beach on this map is wearing, reported so the cards below can be
   *  filtered by the exact same tally the pins and the legend are built from. */
  onBeachTonesChange?: (tones: Record<number, CalmnessTone>) => void;
  /** The region's FULL beach list, used only by `onBeachTonesChange`. The pins, the legend and
   *  its counts still come from `beaches`. It exists because the caller narrows `beaches` by the
   *  active amenity chips: a tone table built from that narrowed list already has the chips
   *  applied to it, so anything downstream that tries to describe a colour group ends up
   *  describing the chips instead. Defaults to `beaches`, i.e. exactly the previous behaviour. */
  toneSourceBeaches?: SuitableBeach[];
  /** Beaches that are drawn on the map but must not surface in ANY browsing count or list
   *  (naturist beaches with the filter off — a policy, not a condition). Excluded from the
   *  legend counts entirely; their pins stay. Since 23/08/2026 this is ONLY that policy set —
   *  condition-based exclusions moved to `unrecommendedBeachIds` below, which stays counted. */
  uncountedBeachIds?: Set<number>;
  /** Beaches the app refuses to RECOMMEND today («μην κολυμπήσεις»; boat-only in ≥5 Bft) but
   *  whose pins the reader can plainly see. COUNTED in the legend — a legend that disagrees
   *  with the pins above it reads as a bug (Λέσβος 23/08: 17 πορτοκαλί πινέζες, «Μέτρια 1»).
   *  The legend does NOT explain them: each such beach says «Δεν το προτείνουμε σήμερα» on its
   *  OWN card (24/08 — a group chip is the wrong place for a per-beach answer). What this set
   *  still does here is keep them out of the calm-water offer, which is a recommendation. */
  unrecommendedBeachIds?: Set<number>;
  /** «Ήρεμο νερό» is on. A SECOND way to cut the same list, so it and `toneFilter` are mutually
   *  exclusive at the caller — see utils/calmWaterFilter for why it does not live inside a colour. */
  calmWaterFilter?: boolean;
  onCalmWaterFilterChange?: (active: boolean) => void;
  /** Which beaches qualify right now, reported upward so the cards below are cut by the exact
   *  same reading the chip counted — never a second opinion computed in App. Carries the REASON
   *  when there is nothing to offer, because that is what the drop message has to say. */
  onCalmWaterStateChange?: (state: CalmWaterState) => void;
}

const visibleExposureLevel = (
  item: Pick<SuitableBeach, 'exposureLevel' | 'canClaimWindProtection'>
) => item.exposureLevel === 'protected' && item.canClaimWindProtection !== true
  ? 'partial'
  : item.exposureLevel;

type HoverPreviewPosition = {
  x: number;
  y: number;
};

type HoverPreviewFeatureChip = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

const HOVER_PREVIEW_WIDTH = 292;
const HOVER_PREVIEW_HEIGHT = 216;

const hoverPreviewAmenityIcon = (chip: Pick<AmenityChip, 'key'>): React.ReactNode => {
  switch (chip.key) {
    case 'foodNearby':
    case 'cafeNearby':
      return <Utensils className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'parking':
      return <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'shower':
      return <ShowerHead className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'sunbeds':
      return <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden="true" />;
    default:
      return <Info className="h-3 w-3 shrink-0" aria-hidden="true" />;
  }
};

const getHoverPreviewAccessLabel = (
  beach: Beach,
  language: LanguageCode,
  fallback: string | undefined
): string | undefined => {
  const labels = getLocalizedCopy(language, {
    en: {
      EASY: 'Easy access',
      MODERATE: 'Moderate access',
      DIFFICULT: 'Difficult road',
      BOAT_ONLY: 'Boat only',
      DIRT_ROAD: 'Dirt road',
      ROUGH_DIRT_ROAD: 'Rough dirt road',
      PATH: 'Path access',
      HARD_PATH: 'Hard path',
    },
    gr: {
      EASY: 'Εύκολη πρόσβαση',
      MODERATE: 'Μέτρια πρόσβαση',
      DIFFICULT: 'Δύσκολος δρόμος',
      BOAT_ONLY: 'Μόνο με σκάφος',
      DIRT_ROAD: 'Χωματόδρομος',
      ROUGH_DIRT_ROAD: 'Δύσβατος χωματόδρομος',
      PATH: 'Με μονοπάτι',
      HARD_PATH: 'Δύσκολο μονοπάτι',
    },
    de: {
      EASY: 'Einfacher Zugang',
      MODERATE: 'Mittlerer Zugang',
      DIFFICULT: 'Schwierige Straße',
      BOAT_ONLY: 'Nur per Boot',
      DIRT_ROAD: 'Feldweg',
      ROUGH_DIRT_ROAD: 'Grober Feldweg',
      PATH: 'Zugang über Weg',
      HARD_PATH: 'Schwieriger Weg',
    },
    it: {
      EASY: 'Accesso facile',
      MODERATE: 'Accesso moderato',
      DIFFICULT: 'Strada difficile',
      BOAT_ONLY: 'Solo in barca',
      DIRT_ROAD: 'Strada sterrata',
      ROUGH_DIRT_ROAD: 'Sterrato accidentato',
      PATH: 'Accesso a piedi',
      HARD_PATH: 'Sentiero difficile',
    },
    fr: {
      EASY: 'Accès facile',
      MODERATE: 'Accès modéré',
      DIFFICULT: 'Route difficile',
      BOAT_ONLY: 'Uniquement en bateau',
      DIRT_ROAD: 'Route en terre',
      ROUGH_DIRT_ROAD: 'Piste accidentée',
      PATH: 'Accès par sentier',
      HARD_PATH: 'Sentier difficile',
    },
  });
  const metadataLabels: Record<string, string> = {
    asphalt_road: labels.EASY,
    passable_dirt_road: labels.DIRT_ROAD,
    difficult_dirt_road: labels.ROUGH_DIRT_ROAD,
    '4x4_only': labels.DIFFICULT,
    hiking_path_easy: labels.PATH,
    hiking_path_difficult: labels.HARD_PATH,
    boat_only: labels.BOAT_ONLY,
  };
  const accessType = beach.metadata?.access?.type;

  return (accessType && metadataLabels[accessType]) || labels[beach.accessibility] || fallback;
};

const getHoverPreviewAmenityLabel = (chip: AmenityChip, language: LanguageCode): string => {
  const labels: Record<string, string> = getLocalizedCopy(language, {
    en: {
      beachBar: 'Beach bar',
      sunbeds: 'Sunbeds',
      foodNearby: 'Taverna',
      cafeNearby: 'Cafe',
      parking: 'Parking',
      organizedFacilities: 'Facilities',
      seasonalFacilities: 'Seasonal',
      noFacilities: 'No facilities',
      unknownFacilities: 'Unknown',
    },
    gr: {
      beachBar: 'Beach bar',
      sunbeds: 'Ξαπλώστρες',
      foodNearby: 'Ταβέρνα',
      cafeNearby: 'Καφέ',
      parking: 'Πάρκινγκ',
      organizedFacilities: 'Οργανωμένη',
      seasonalFacilities: 'Εποχιακά',
      noFacilities: 'Χωρίς παροχές',
      unknownFacilities: 'Άγνωστο',
    },
    de: {
      beachBar: 'Strandbar',
      sunbeds: 'Liegen',
      foodNearby: 'Taverne',
      cafeNearby: 'Café',
      parking: 'Parkplatz',
      organizedFacilities: 'Einrichtungen',
      seasonalFacilities: 'Saisonal',
      noFacilities: 'Keine Einrichtungen',
      unknownFacilities: 'Unbekannt',
    },
    it: {
      beachBar: 'Beach bar',
      sunbeds: 'Lettini',
      foodNearby: 'Taverna',
      cafeNearby: 'Caffè',
      parking: 'Parcheggio',
      organizedFacilities: 'Servizi',
      seasonalFacilities: 'Stagionale',
      noFacilities: 'Nessun servizio',
      unknownFacilities: 'Sconosciuto',
    },
    fr: {
      beachBar: 'Bar de plage',
      sunbeds: 'Transats',
      foodNearby: 'Taverne',
      cafeNearby: 'Café',
      parking: 'Parking',
      organizedFacilities: 'Équipements',
      seasonalFacilities: 'Saisonnier',
      noFacilities: 'Aucun équipement',
      unknownFacilities: 'Inconnu',
    },
  });

  return labels[chip.key] || chip.label;
};

const buildHoverPreviewFeatureChips = (beach: Beach, language: LanguageCode): HoverPreviewFeatureChip[] => {
  const t = translations[language] || translations.en;
  const chips: HoverPreviewFeatureChip[] = [];

  const addChip = (key: string, label: string | undefined, icon: React.ReactNode) => {
    if (!label || chips.some(chip => chip.key === key)) return;
    chips.push({ key, label, icon });
  };

  if (beach.beachType !== 'unknown') {
    addChip(
      'surface',
      t.filterOptions[beach.beachType],
      <Waves className="h-3 w-3 shrink-0" aria-hidden="true" />
    );
  }

  addChip(
    'access',
    getHoverPreviewAccessLabel(beach, language, t.accessibility[beach.accessibility]),
    <Footprints className="h-3 w-3 shrink-0" aria-hidden="true" />
  );

  if (beach.characteristics.shallowWaters) {
    addChip(
      'shallow',
      t.filterOptions.shallowWaters,
      <Waves className="h-3 w-3 shrink-0" aria-hidden="true" />
    );
  } else if (beach.characteristics.deepWaters) {
    addChip(
      'deep',
      t.filterOptions.deepWaters,
      <Waves className="h-3 w-3 shrink-0" aria-hidden="true" />
    );
  }

  if (beach.environment.familyFriendly) {
    addChip(
      'family',
      t.filterOptions.familyFriendly,
      <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
    );
  }

  // Single crowd indicator: the popularity tier (covers quiet as its low end) — no separate
  // "quiet" chip so it never repeats the popularity badge.
  if (beach.popularity?.tier) {
    addChip(
      'popularity',
      localizedPopularityLabel(beach.popularity.tier, language),
      <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
    );
  } else if (beach.environment?.quietEvidence === 'presumed') {
    // Same slot, inferred wording — see localizedLittleKnownLabel.
    addChip(
      'popularity',
      localizedLittleKnownLabel(language),
      <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
    );
  }

  for (const chip of getAmenityChips(beach, language)) {
    if (chips.length >= 4) break;
    if (chip.key === 'unknownFacilities' || chip.status === 'unknown' || chip.status === 'no') continue;
    addChip(`amenity-${chip.key}`, getHoverPreviewAmenityLabel(chip, language), hoverPreviewAmenityIcon(chip));
  }

  return chips.slice(0, 4);
};

const BeachHoverPreviewCard: React.FC<{
  item: SuitableBeach;
  position: HoverPreviewPosition;
  mapViewportRef: React.RefObject<HTMLDivElement>;
  language: LanguageCode;
  photoUrl: string | null;
  featureChips: HoverPreviewFeatureChip[];
  localWind?: { deg: number; speedKmh: number };
  windLabel?: string;
}> = ({ item, position, mapViewportRef, language, photoUrl, featureChips, localWind, windLabel }) => {
  const viewportWidth = mapViewportRef.current?.clientWidth || HOVER_PREVIEW_WIDTH + 32;
  const viewportHeight = mapViewportRef.current?.clientHeight || HOVER_PREVIEW_HEIGHT + 32;
  const preferLeft = position.x + HOVER_PREVIEW_WIDTH + 18 > viewportWidth;
  const candidateLeft = preferLeft
    ? position.x - HOVER_PREVIEW_WIDTH - 18
    : position.x + 18;
  const maxLeft = Math.max(12, viewportWidth - HOVER_PREVIEW_WIDTH - 12);
  const maxTop = Math.max(12, viewportHeight - HOVER_PREVIEW_HEIGHT - 12);
  const left = Math.min(Math.max(candidateLeft, 12), maxLeft);
  const top = Math.min(Math.max(position.y - HOVER_PREVIEW_HEIGHT / 2, 12), maxTop);
  const beachName = item.name || item.beach.name[language] || item.beach.name.en;
  const hoverReadout = buildBeachConditionsReadout({
    beachWindSpeedKmph: localWind?.speedKmh,
    waveHeightM: item.waveHeightM,
    seaStateWaveM: item.seaStateWaveM,
    seaStatePeriodS: item.seaStatePeriodS,
    shoreWaveHeightM: item.shoreWaveHeightM,
    shoreDisplayWaveM: item.shoreDisplayWaveM,
    shoreWaveFromDepartingSea: item.shoreWaveFromDepartingSea,
    language,
  });
  const hoverWaveText = hoverReadout.waveText;
  const hoverWaveWord = hoverReadout.waveWord;

  return (
    <div
      aria-hidden="true"
      data-testid="map-hover-preview-card"
      className="pointer-events-none absolute z-[1150] hidden md:block"
      style={{ left, top, width: HOVER_PREVIEW_WIDTH }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/85 bg-white shadow-2xl shadow-slate-950/20 ring-1 ring-sky-100/80">
        <div className="relative h-20 overflow-hidden bg-gradient-to-br from-cyan-50 via-sky-50 to-teal-50">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <BeachPhotoFallback
              beach={item.beach}
              language={language}
              beachName={displayBeachName(item.beach.name, language)}
              crop="band"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/18 via-transparent to-white/8" aria-hidden="true" />
        </div>

        <div className="p-2.5">
          <h3 className="text-sm font-black leading-snug text-slate-950">
            {beachName}
          </h3>

          {localWind && windLabel && (
            <p className="mt-1 flex items-center gap-1 text-[10px] font-bold leading-tight text-slate-700">
              <Wind className="h-3 w-3 shrink-0 text-sky-600" aria-hidden="true" />
              <span>{windLabel} · {Math.round(localWind.speedKmh)} km/h</span>
            </p>
          )}

          {/* Η ΘΑΛΑΣΣΑ ΔΙΠΛΑ ΣΤΟΝ ΑΕΡΑ, ΠΟΤΕ ΜΑΖΙ ΤΟΥ (20/08/2026). Αυτή η κάρτα έδειχνε μόνο
              αέρα από την πρώτη μέρα, οπότε στον υπολογιστή η αιώρηση πάνω από μια πινέζα
              απαντούσε το μισό ερώτημα. Ίδιο νούμερο με την κάρτα και με το ταμπελάκι της
              πινέζας — μία πηγή, `utils/beachConditionsReadout`. */}
          {hoverWaveText && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold leading-tight text-slate-700">
              <Waves className="h-3 w-3 shrink-0 text-sky-600" aria-hidden="true" />
              <span>{hoverWaveWord ? `${hoverWaveWord} · ` : ''}{hoverWaveText}</span>
            </p>
          )}

          {featureChips.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {featureChips.map(chip => (
                <span
                  key={chip.key}
                  className="flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50/85 px-2 py-1 text-[10px] font-extrabold leading-tight text-slate-700 shadow-sm shadow-sky-900/5"
                >
                  <span className="text-cyan-700">{chip.icon}</span>
                  <span className="min-w-0 whitespace-normal break-normal">{chip.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ΤΟ ΤΑΜΠΕΛΑΚΙ ΤΗΣ ΠΙΝΕΖΑΣ — Ο ΑΕΡΑΣ ΚΑΙ Η ΘΑΛΑΣΣΑ ΧΩΡΙΣΤΑ (20/08/2026).
 *
 * Η βίβλος το άφηνε γραμμένο σαν ανοιχτό κενό στη §Γ14: «Η ΠΙΝΕΖΑ ΜΕΝΕΙ ΒΟΥΒΗ — όποιος
 * κοιτάζει μόνο κουκκίδες δεν παίρνει τίποτα από αυτή τη δουλειά.» Το χρώμα απαντά «πόσο καλή
 * είναι συνολικά η παραλία»· δεν απαντά «τι αέρα και τι κύμα έχει», και ο κόσμος διάβαζε το
 * πορτοκαλί ως κύμα (μετρημένο: στα 6+ Μποφόρ το νερό είναι <0,4 μ. στο 62,2% των περιπτώσεων).
 *
 * ΔΥΟ ΓΡΑΜΜΕΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Η». Ο αέρας και η θάλασσα είναι δύο ανεξάρτητα σήματα και
 * γράφονται χωριστά, με το δικό τους εικονίδιο και το δικό τους νούμερο. Καμία λέξη
 * ετυμηγορίας εδώ μέσα και κανένα χρώμα καταλληλότητας: το χρώμα το κρατάει η κουκκίδα, μία
 * φορά. Τα εικονίδια είναι sky, όπως στην κάρτα — όχι μπλε/κίτρινο/πορτοκαλί/κόκκινο, γιατί
 * δεύτερος χρωματικός κώδικας στην ίδια οθόνη είναι ακριβώς η σύγχυση που λύνουμε.
 *
 * ΤΑ ΝΟΥΜΕΡΑ ΕΙΝΑΙ ΤΑ ΙΔΙΑ ΜΕ ΤΗΣ ΚΑΡΤΑΣ, από την ίδια συνάρτηση
 * (`utils/beachConditionsReadout`) — όχι από δεύτερο υπολογισμό εδώ.
 */
const MarkerConditionsPopup: React.FC<{
  item: SuitableBeach;
  language: LanguageCode;
  windSpeedKmh?: number;
  openLabel: string;
  onOpen?: () => void;
}> = ({ item, language, windSpeedKmh, openLabel, onOpen }) => {
  const readout = buildBeachConditionsReadout({
    beachWindSpeedKmph: windSpeedKmh,
    waveHeightM: item.waveHeightM,
    seaStateWaveM: item.seaStateWaveM,
    seaStatePeriodS: item.seaStatePeriodS,
    shoreWaveHeightM: item.shoreWaveHeightM,
    shoreDisplayWaveM: item.shoreDisplayWaveM,
    shoreWaveFromDepartingSea: item.shoreWaveFromDepartingSea,
    language,
  });
  const beachName = item.name || item.beach.name[language] || item.beach.name.en;

  return (
    <div className="min-w-[8rem] max-w-[12rem]">
      {/* ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ ΤΟ ΚΟΥΜΠΙ (Μίλτος, 20/08/2026: «πιάνει πολύ χάρτη»).
          Ξεχωριστό κουμπί «Δες την παραλία» κόστιζε 34 από τα 145 px του ταμπελακιού, πάνω σε
          χάρτη 214 px στο κινητό — δηλαδή έτρωγε τον χάρτη για να πει κάτι που το όνομα το λέει
          ήδη. Χρώμα μάρκας + βελάκι δείχνουν ότι πατιέται· ο τίτλος κρατά ολόκληρο το πλάτος και
          ύψος αφής (min-h-6), οπότε δεν χάθηκε στόχος. */}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${beachName} — ${openLabel}`}
          className="flex min-h-6 w-full cursor-pointer items-center gap-0.5 text-left text-[12px] font-black leading-tight text-[#007a83] transition hover:text-[#005c63]"
        >
          <span className="min-w-0 truncate">{beachName}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      ) : (
        <p className="truncate text-[12px] font-black leading-tight text-slate-950">{beachName}</p>
      )}
      <div className="mt-0.5">
        <p className="flex items-center gap-1 text-[11px] font-bold leading-tight text-slate-700">
          <Wind className="h-3 w-3 shrink-0 text-sky-600" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {readout.windWord ? `${readout.windWord} · ` : ''}{readout.beaufortText}
          </span>
        </p>
        {readout.waveText && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold leading-tight text-slate-700">
            <Waves className="h-3 w-3 shrink-0 text-sky-600" aria-hidden="true" />
            <span className="min-w-0 truncate">
              {readout.waveWord ? `${readout.waveWord} · ` : ''}{readout.waveText}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

/** Λέει στον γονιό αν υπάρχει ανοιχτό popup — το Leaflet κρατάει ένα κάθε φορά. */
/**
 * ΤΟ ΤΑΜΠΕΛΑΚΙ ΑΚΟΛΟΥΘΕΙ ΤΟ ΣΚΡΟΛ ΤΩΝ ΚΑΡΤΩΝ (21/08/2026).
 *
 * Ο κατάλογος από κάτω κυλάει και η πινέζα της κάρτας που βρίσκεται στο κέντρο φωτίζεται ήδη
 * (highlightedBeachId). Το ανοιχτό ταμπελάκι όμως έμενε καρφωμένο στην πινέζα που πατήθηκε, άρα
 * ο αναγνώστης διάβαζε τις συνθήκες ΑΛΛΗΣ παραλίας από αυτήν που κοιτούσε.
 *
 * Δύο σκόπιμοι περιορισμοί:
 *  • Δεν ΑΝΟΙΓΕΙ ταμπελάκι μόνο του. Αν κανείς δεν ζήτησε λεπτομέρειες, ένα πάνελ που ξεπετάγεται
 *    στο σκρολ σκεπάζει τον μισό χάρτη (ο χάρτης στο κινητό είναι 13,5rem).
 *  • Κρατάει το «ανοιχτό ή όχι» σε ref, όχι σε state: το Leaflet κλείνει το προηγούμενο ταμπελάκι
 *    πριν ανοίξει το επόμενο, οπότε ένα state θα περνούσε στιγμιαία από το false και θα έκοβε την
 *    αλυσίδα στην πρώτη κιόλας κάρτα.
 */
/**
 * The map is allowed to shuffle itself ONCE, to fit a label that has just been opened.
 *
 * Leaflet's `autoPan` is not a one-off: it re-runs every time the popup's layout is touched,
 * and the popup's contents are live (wind, sea, the hour), so every re-render of the page
 * asked the camera to re-fit it. Scrolling the beach list with a label open moved the camera
 * on 48-77 frames of a single scroll — mostly sub-pixel, which is not a pan, it is a shiver,
 * and it is what "τα ταμπελάκια τρέμουν" meant. With no label open the same scroll moved the
 * camera exactly 0 times, which is what pointed here.
 *
 * So: the opening adjustment stays (a label near the edge would otherwise be cut off), and
 * from the next frame the camera is left alone until the label is closed and reopened.
 */
const PopupPansOnlyOnOpen: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const frames = new Set<number>();

    const onOpen = (event: L.PopupEvent) => {
      const popup = event.popup;
      if (!popup?.options?.autoPan) return;
      // Two frames: the first lets Leaflet finish the layout pass it opened with, the second
      // is where any further adjustment would have come from.
      const first = window.requestAnimationFrame(() => {
        const second = window.requestAnimationFrame(() => {
          popup.options.autoPan = false;
          frames.delete(second);
        });
        frames.add(second);
        frames.delete(first);
      });
      frames.add(first);
    };

    // Restored on close so the NEXT label still gets its one adjustment.
    const onClose = (event: L.PopupEvent) => {
      if (event.popup?.options) event.popup.options.autoPan = true;
    };

    map.on('popupopen', onOpen);
    map.on('popupclose', onClose);
    return () => {
      frames.forEach(handle => window.cancelAnimationFrame(handle));
      map.off('popupopen', onOpen);
      map.off('popupclose', onClose);
    };
  }, [map]);

  return null;
};

const MarkerPopupScrollFollower: React.FC<{
  enabled: boolean;
  highlightedBeachId?: number;
  markerRefs: React.MutableRefObject<Map<number, L.Marker>>;
}> = ({ enabled, highlightedBeachId, markerRefs }) => {
  const map = useMap();
  const isPopupOpenRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const open = () => { isPopupOpenRef.current = true; };
    const close = () => { isPopupOpenRef.current = false; };
    map.on('popupopen', open);
    map.on('popupclose', close);
    return () => {
      map.off('popupopen', open);
      map.off('popupclose', close);
    };
  }, [enabled, map]);

  useEffect(() => {
    if (!enabled || !isPopupOpenRef.current) return;
    if (typeof highlightedBeachId !== 'number') return;
    const marker = markerRefs.current.get(highlightedBeachId);
    if (!marker || marker.isPopupOpen()) return;
    marker.openPopup();
  }, [enabled, highlightedBeachId, markerRefs]);

  return null;
};

const MapPopupTracker: React.FC<{ onChange: (open: boolean) => void }> = ({ onChange }) => {
  const map = useMap();

  useEffect(() => {
    const open = () => onChange(true);
    const close = () => onChange(false);
    map.on('popupopen', open);
    map.on('popupclose', close);
    return () => {
      map.off('popupopen', open);
      map.off('popupclose', close);
    };
  }, [map, onChange]);

  return null;
};

// Leaflet caches the container's pixel size at init and only recomputes it on a
// window 'resize'. When this map remounts via SPA back-navigation (the detail
// view is a separate render branch, so going back fully re-mounts the map) or
// its container is revealed/reflowed after an async layout shift (lazy chunk,
// hero strip, scroll restoration), the cached size goes stale — markers and
// tiles are then projected against the wrong origin and look off-centre until a
// manual refresh. react-leaflet doesn't observe the container, so we recompute
// the size after mount and whenever the container actually resizes.
const MapAutoResize = () => {
  const map = useMap();

  useEffect(() => {
    // invalidateSize no-ops if the size is unchanged and while the map isn't
    // loaded yet, so calling it speculatively is cheap and safe.
    const invalidate = () => {
      const container = map.getContainer();
      if (!container || !container.isConnected) return;
      map.invalidateSize({ animate: false });
    };

    // The initial mount plus a few staggered passes catch late layout shifts
    // that settle after the first frame (lazy chunk load, hero image, scroll
    // restoration on back-navigation).
    const frame = requestAnimationFrame(invalidate);
    const timers = [60, 250, 600].map(delay => window.setTimeout(invalidate, delay));

    // Recompute whenever the container resizes without a window 'resize' — e.g.
    // it was revealed after being collapsed, or a parent reflowed.
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(invalidate)
      : null;
    observer?.observe(map.getContainer());

    // Restoring from the bfcache (returning to the tab/page) also leaves Leaflet
    // with a stale size.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) invalidate();
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      observer?.disconnect();
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [map]);

  return null;
};

// Component to update map center when user location changes
/**
 * Applies the caller's `center`/`zoom` — UNLESS the caller also asked for the view to be fitted
 * to its beaches, in which case it stays out of the way entirely.
 *
 * Both components claim the opening view, and this one was winning: the region map opened at the
 * `zoom={11}` prop centred on the region's geometric centre, so on a long island the fit never
 * showed. Measured on Evia 02/08/2026 — 1 of 130 pins inside the viewport on arrival; dropping
 * the prop to 9 as a probe put 38 there, which is how the precedence was proven rather than
 * guessed. `fitBoundsToBeaches` is the caller saying "frame my beaches, not my centre".
 */
const RecenterMap = ({ center, zoom, enabled }: { center: [number, number]; zoom: number; enabled: boolean }) => {
  const map = useMap();
  const [lat, lon] = center;

  useEffect(() => {
    if (!enabled) return;
    map.setView(center, zoom);
  }, [lat, lon, zoom, map, enabled]);

  return null;
};

// Extra buttons live *inside* Leaflet's own zoom bar rather than as separate
// controls, so +/- and everything below them read as one rounded column instead
// of a stack of detached boxes. Leaflet's `.leaflet-bar` styling (borders, radius,
// hover, the 44px touch target we set in index.css) then applies for free.
const attachToZoomBar = (
  map: L.Map,
  build: (bar: HTMLElement) => () => void,
): (() => void) => {
  let frame = 0;
  let attempts = 0;
  let detach: (() => void) | null = null;

  const attach = () => {
    const bar = map.getContainer().querySelector<HTMLElement>('.leaflet-control-zoom');
    if (!bar) {
      // The zoom control mounts in its own effect; retry for a few frames in case
      // ours ran first, then give up quietly rather than throwing.
      if (attempts++ < 30) frame = requestAnimationFrame(attach);
      return;
    }
    detach = build(bar);
  };
  attach();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    detach?.();
  };
};

const makeBarButton = (className: string, title: string, iconSvg: string): HTMLAnchorElement => {
  const link = L.DomUtil.create('a', `leaflet-control-bar-button ${className}`) as HTMLAnchorElement;
  link.href = '#';
  link.title = title;
  link.setAttribute('role', 'button');
  link.setAttribute('aria-label', title);
  link.innerHTML = iconSvg;
  return link;
};

// Small "home" button that snaps the map back to its default center/zoom for the
// place after the user has panned or zoomed far away.
const HOME_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

const HomeControl = ({
  center,
  zoom,
  title,
}: {
  center: [number, number];
  zoom: number;
  title: string;
}) => {
  const map = useMap();
  // Keep the reset target current without re-creating the control on every render.
  const targetRef = useRef<{ center: [number, number]; zoom: number }>({ center, zoom });
  targetRef.current = { center, zoom };

  useEffect(() => {
    return attachToZoomBar(map, (bar) => {
      const link = makeBarButton('leaflet-control-home', title, HOME_ICON_SVG);
      bar.appendChild(link);

      // Only worth offering the button once the user has strayed far enough that the
      // home point (their location, or the region default) has scrolled off the
      // viewport. A small negative pad means it appears just before the point fully
      // leaves the screen. Kept pan-based so it never shows just from the zoom level.
      const isFarFromHome = () => {
        const { center: home } = targetRef.current;
        const homePoint = L.latLng(home[0], home[1]);
        return !map.getBounds().pad(-0.15).contains(homePoint);
      };

      const updateVisibility = () => {
        // The class sits on the shared bar so the button above the home button can
        // take over the rounded bottom corner while it is hidden.
        bar.classList.toggle('leaflet-control-home--visible', isFarFromHome());
      };

      L.DomEvent.on(link, 'click', (event: Event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        const { center: resetCenter, zoom: resetZoom } = targetRef.current;
        map.setView(resetCenter, resetZoom, { animate: true });
      });
      updateVisibility();
      map.on('move zoom moveend zoomend', updateVisibility);

      return () => {
        map.off('move zoom moveend zoomend', updateVisibility);
        bar.classList.remove('leaflet-control-home--visible');
        link.remove();
      };
    });
  }, [map, title]);

  return null;
};

// Satellite / plain-map switch, docked in the same bar as +/- and the home button.
// Esri's World Imagery is used for the aerial view: no API key, no quota to manage
// and no cost — the same "free, no backend" constraint the rest of the site runs on.
// Its labels come as a separate transparent overlay, so place names stay readable
// over the imagery instead of the map turning into an unlabelled photo.
type BasemapId = 'map' | 'satellite';
const BASEMAP_STORAGE_KEY = 'calmbeach.basemap';

/**
 * Lifts the aerial imagery's near-black deep water toward a natural sea blue.
 *
 * Esri's World Imagery renders open sea almost black — measured on the Corfu map at
 * RGB(17,36,49). On a beach site that reads as "void" rather than "deep", and it is the one
 * colour our visitors have an opinion about.
 *
 * Two passes, because one is not enough:
 *
 * 1. `feColorMatrix` separates water from land using the only property that reliably tells
 *    them apart in aerial imagery — how far blue leads red. Sea has B far above R; sand,
 *    rock and roofs have R at or above B. Feeding a negative red coefficient into the blue
 *    and green rows therefore *amplifies* the sea and leaves land almost untouched, which a
 *    brightness or gamma pass cannot do at any strength. Green borrows from blue too, so
 *    shallow water lands on turquoise rather than navy.
 * 2. Per-channel gamma (exponent < 1) then lifts what is still dark, hardest on blue and
 *    barely at all on red, so the water opens up while the shoreline keeps its warmth.
 *
 * Tuned by measuring, not by eye: the water-blue pixels of the region map went
 * RGB(17,36,49) → RGB(20,51,83) with gamma alone → the current values with both passes.
 * If you retune, measure the same way rather than trusting a screenshot on one display.
 *
 * Rendered inside the map so `filter: url(#...)` resolves in the same document.
 */
const AERIAL_FILTER_ID = 'calmbeach-aerial-tone';

const AerialToneFilter = () => (
  <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      <filter id={AERIAL_FILTER_ID} colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="
            1.00  0.00  0.00  0 0
           -0.28  1.00  0.34  0 0
           -0.50  0.00  1.58  0 0
            0     0     0     1 0"
        />
        <feComponentTransfer>
          <feFuncR type="gamma" exponent="0.92" />
          <feFuncG type="gamma" exponent="0.74" />
          <feFuncB type="gamma" exponent="0.60" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
);
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const SATELLITE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/></svg>';
const MAP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4.5 9.5 2 3 4.8v16.4l6.5-2.8 5 2.5 6.5-2.8V1.7z"/><path d="M9.5 2v16.6"/><path d="M14.5 4.9V21.5"/></svg>';

const BasemapControl = ({
  basemap,
  onToggle,
  title,
}: {
  basemap: 'map' | 'satellite';
  onToggle: () => void;
  title: string;
}) => {
  const map = useMap();
  const stateRef = useRef({ basemap, onToggle, title });
  stateRef.current = { basemap, onToggle, title };

  useEffect(() => {
    return attachToZoomBar(map, (bar) => {
      const initial = stateRef.current;
      const link = makeBarButton(
        'leaflet-control-basemap',
        initial.title,
        initial.basemap === 'satellite' ? MAP_ICON_SVG : SATELLITE_ICON_SVG,
      );
      link.dataset.basemapButton = 'true';
      bar.appendChild(link);
      // Marks which button owns the bar's rounded bottom edge while the home
      // button is hidden — the small preview maps have no basemap button at all.
      bar.classList.add('leaflet-control-has-basemap');
      L.DomEvent.on(link, 'click', (event: Event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        stateRef.current.onToggle();
      });
      return () => {
        bar.classList.remove('leaflet-control-has-basemap');
        link.remove();
      };
    });
  }, [map]);

  // Icon and label follow the *next* view the button switches to.
  useEffect(() => {
    const link = map.getContainer().querySelector<HTMLAnchorElement>('[data-basemap-button]');
    if (!link) return;
    link.innerHTML = basemap === 'satellite' ? MAP_ICON_SVG : SATELLITE_ICON_SVG;
    link.title = title;
    link.setAttribute('aria-label', title);
    link.setAttribute('aria-pressed', basemap === 'satellite' ? 'true' : 'false');
  }, [map, basemap, title]);

  return null;
};

const FitBeachBounds = ({
  beaches,
  center,
  enabled,
  fitKey,
}: {
  beaches: SuitableBeach[];
  center: [number, number];
  enabled?: boolean;
  fitKey?: string;
}) => {
  const map = useMap();
  const lastFitKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || beaches.length === 0) return;
    if (fitKey && lastFitKeyRef.current === fitKey) return;

    const fallbackCenter = { lat: center[0], lon: center[1] };
    const points = beaches
      .map(item => getBeachMapCoordinates(item.beach, fallbackCenter))
      .filter(coordinate => (
        Number.isFinite(coordinate.lat) &&
        Number.isFinite(coordinate.lon)
      ));

    if (points.length === 0) return;

    /**
     * Returns false while the map has no real size yet.
     *
     * The map mounts inside a Suspense placeholder, so this effect can run against a container
     * Leaflet still measures as ~0×0. Fitting bounds to a zero-size box produces a meaningless
     * zoom and — worse — marks the fit as done, so the region view was never applied and the map
     * simply kept the `zoom={11}` prop it was created with. Measured on Evia 02/08/2026: 1 of
     * 130 pins inside the viewport on arrival, which is what «εξαφάνισες παραλίες» looked like.
     */
    const applyFit = () => {
      const size = map.getSize();
      if (size.x < 40 || size.y < 40) return false;

      lastFitKeyRef.current = fitKey;

      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lon], Math.max(map.getZoom(), 12), {
          animate: false,
        });
        return true;
      }

      const bounds = L.latLngBounds(points.map(point => [point.lat, point.lon] as [number, number]));
      map.fitBounds(bounds, {
        animate: false,
        padding: [28, 28],
        maxZoom: 12,
      });
      return true;
    };

    if (applyFit()) return;

    const onResize = () => {
      if (applyFit()) map.off('resize', onResize);
    };
    map.on('resize', onResize);
    return () => { map.off('resize', onResize); };
  }, [beaches, center, enabled, fitKey, map]);

  return null;
};

const MapViewportGuardrails = ({
  minZoom,
  maxBounds,
  islandBounds,
}: {
  minZoom: number;
  maxBounds?: L.LatLngBounds;
  islandBounds?: L.LatLngBounds;
}) => {
  const map = useMap();
  const boundsKey = maxBounds?.toBBoxString();
  const islandKey = islandBounds?.toBBoxString();

  useEffect(() => {
    // Cap how far the user can zoom out: never looser than the zoom at which the
    // island fills the current viewport (with a small sea margin). getBoundsZoom is
    // viewport-aware, so wide desktop frames get a tighter cap while narrow phones
    // keep a lower minimum automatically. The formula minZoom stays as a floor.
    let effectiveMinZoom = minZoom;
    if (islandBounds) {
      const fitZoom = map.getBoundsZoom(islandBounds, false, L.point(56, 56));
      // Clamp to 12 (the fit-bounds ceiling) so tiny regions never force an
      // over-zoomed minimum that would trap the user fully zoomed in.
      if (Number.isFinite(fitZoom)) {
        effectiveMinZoom = Math.min(Math.max(minZoom, fitZoom), 12);
      }
    }

    map.setMinZoom(effectiveMinZoom);

    if (map.getZoom() < effectiveMinZoom) {
      map.setZoom(effectiveMinZoom, { animate: false });
    }

    map.setMaxBounds(maxBounds);

    if (maxBounds && !maxBounds.contains(map.getCenter())) {
      map.panInsideBounds(maxBounds, { animate: false });
    }
  }, [boundsKey, islandKey, map, maxBounds, minZoom, islandBounds]);

  return null;
};

const VisibleBeachTracker = ({
  beaches,
  center,
  onVisibleBeachIdsChange,
}: {
  beaches: SuitableBeach[];
  center: [number, number];
  onVisibleBeachIdsChange?: (beachIds: number[]) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!onVisibleBeachIdsChange) return;
    const fallbackCenter = { lat: center[0], lon: center[1] };

    const updateVisibleBeaches = () => {
      const bounds = map.getBounds();
      const visibleIds = beaches
        .filter(item => {
          const coordinate = getBeachMapCoordinates(item.beach, fallbackCenter);
          return bounds.contains(L.latLng(coordinate.lat, coordinate.lon));
        })
        .map(item => item.beach.id)
        .sort((a, b) => a - b);

      onVisibleBeachIdsChange(visibleIds);
    };

    updateVisibleBeaches();
    map.on('moveend zoomend resize', updateVisibleBeaches);

    return () => {
      map.off('moveend zoomend resize', updateVisibleBeaches);
    };
  }, [beaches, center, map, onVisibleBeachIdsChange]);

  return null;
};

const MapUserInteractionTracker = ({
  onUserInteraction,
}: {
  onUserInteraction?: () => void;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!onUserInteraction) return;

    const notifyUserInteraction = () => {
      onUserInteraction();
    };
    const container = map.getContainer();

    container.addEventListener('pointerdown', notifyUserInteraction, { passive: true });
    container.addEventListener('touchstart', notifyUserInteraction, { passive: true });
    map.on('dragstart zoomstart boxzoomstart', notifyUserInteraction);

    return () => {
      container.removeEventListener('pointerdown', notifyUserInteraction);
      container.removeEventListener('touchstart', notifyUserInteraction);
      map.off('dragstart zoomstart boxzoomstart', notifyUserInteraction);
    };
  }, [map, onUserInteraction]);

  return null;
};

const HighlightedBeachFollower = ({
  beaches,
  center,
  highlightedBeachId,
  enabled,
}: {
  beaches: SuitableBeach[];
  center: [number, number];
  highlightedBeachId?: number;
  enabled?: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || typeof highlightedBeachId !== 'number') return;

    const highlightedBeach = beaches.find(item => item.beachId === highlightedBeachId);
    if (!highlightedBeach) return;

    const markerCoordinate = getBeachMapCoordinates(highlightedBeach.beach, {
      lat: center[0],
      lon: center[1],
    });
    const target = L.latLng(markerCoordinate.lat, markerCoordinate.lon);

    /**
     * Only move when moving is worth it.
     *
     * Swiping the row of beaches walks the highlight along neighbours that sit a few pixels
     * apart on the map, and each one used to start its own 0,35s pan. Measured on one swipe:
     * the camera moved on 46 frames, median step 1,8px — a shiver, not a pan, and the map's
     * name labels shook with it (reported from the phone: "τα ταμπελάκια τρέμουν").
     *
     * So the target has to be genuinely off-centre before the camera answers. Inside the
     * middle third the beach is already comfortably in view and there is nothing to fix; the
     * pan is saved for a highlight that is actually drifting to the edge, where it reads as a
     * deliberate move rather than a twitch.
     */
    const size = map.getSize();
    const offset = map.latLngToContainerPoint(target)
      .subtract(map.latLngToContainerPoint(map.getCenter()));
    const slack = Math.max(48, Math.min(size.x, size.y) * 0.22);
    if (Math.abs(offset.x) <= slack && Math.abs(offset.y) <= slack) return;

    map.panTo(target, {
      animate: true,
      duration: 0.35,
      easeLinearity: 0.25,
    });
  }, [beaches, center, enabled, highlightedBeachId, map]);

  return null;
};

const ZoomLabelController = ({
  threshold = 13,
  onLabelOpacityChange,
}: {
  threshold?: number;
  onLabelOpacityChange: (opacity: number) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const updateLabelOpacity = () => {
      const zoom = map.getZoom();
      const fadeStart = threshold - 0.75;
      const fadeEnd = threshold + 0.25;
      const progress = (zoom - fadeStart) / (fadeEnd - fadeStart);
      onLabelOpacityChange(Math.max(0, Math.min(1, progress)));
    };

    updateLabelOpacity();
    map.on('zoom zoomend zoomstart', updateLabelOpacity);

    return () => {
      map.off('zoom zoomend zoomstart', updateLabelOpacity);
    };
  }, [map, onLabelOpacityChange, threshold]);

  return null;
};

const getRecommendationTone = (
  item: Pick<SuitableBeach, 'score' | 'exposureLevel' | 'canClaimWindProtection' | 'simpleWindSuitability'>,
  showWindExposureColors = true
) => {
  const exposureLevel = visibleExposureLevel(item);

  if (showWindExposureColors && item.simpleWindSuitability) {
    const tone = WIND_SUITABILITY_TONE_CLASSES[item.simpleWindSuitability.suitabilityColor];
    return {
      colorClass: tone.marker,
      ringClass: tone.ring,
      badgeClass: tone.badge,
    };
  }

  if (!showWindExposureColors) {
    if (item.score >= 80) {
      return {
        colorClass: 'bg-emerald-500',
        ringClass: 'ring-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-700',
      };
    }

    if (item.score >= 70) {
      return {
        colorClass: 'bg-amber-500',
        ringClass: 'ring-amber-200',
        badgeClass: 'bg-amber-100 text-amber-700',
      };
    }

    return {
      colorClass: 'bg-rose-500',
      ringClass: 'ring-rose-200',
      badgeClass: 'bg-rose-100 text-rose-700',
    };
  }

  if (exposureLevel === 'protected' && item.score >= 80) {
    return {
      colorClass: 'bg-emerald-500',
      ringClass: 'ring-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (exposureLevel === 'protected' || exposureLevel === 'partial' || item.score >= 70) {
    return {
      colorClass: 'bg-amber-500',
      ringClass: 'ring-amber-200',
      badgeClass: 'bg-amber-100 text-amber-700',
    };
  }

  return {
    colorClass: 'bg-rose-500',
    ringClass: 'ring-rose-200',
    badgeClass: 'bg-rose-100 text-rose-700',
  };
};

// Custom marker icons for recommendation mode. Green requires wind protection too.
const createBeachIcon = (
  item: Pick<SuitableBeach, 'score' | 'exposureLevel' | 'canClaimWindProtection' | 'simpleWindSuitability'>,
  showWindExposureColors = true,
  isTopPick = false,
  isHighlighted = false,
  isSurfSpot = false
) => {
  const { colorClass, ringClass } = getRecommendationTone(item, showWindExposureColors);
  const topPickClass = isTopPick ? 'beach-map-top-pick-marker-dot' : '';
  const highlightedClass = isHighlighted ? 'beach-map-active-scroll-marker-dot' : '';
  const surfClass = isSurfSpot ? 'beach-map-marker-surf' : '';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="beach-map-marker-dot ${topPickClass} ${highlightedClass} ${surfClass} ${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

const getExposureMarkerTone = (
  exposureLevel?: string,
  showWindExposureColors = true,
  windBeaufort?: number,
  isEnclosedCove = false,
  // Swell-equivalent sea state (m). Applied as a CEILING only — it can stop a pin being blue,
  // never make a windy pin calmer. Without it the pin was decided by wind and exposure alone,
  // so a beach with light wind and a real running sea was blue by construction.
  seaStateM?: number,
  /** Wind off the land over zero fetch at 5 Bft — utils/offshoreFlatWater. */
  offshoreFlatWater = false,
  /** Offshore wind over zero fetch at 4 Bft with a sea proven quiet — utils/offshoreFlatWater. */
  glassWaterAtFour = false,
  /** The sea reading came from downwind of this shore — utils/offshoreFlatWater.hasDownwindSeaSample. */
  downwindSeaSample = false,
  /** The engine refused a swim here — the colour is capped at ΜΕΤΡΙΑ (utils/suitabilityTone). */
  swimVerdictAvoid = false,
  /** Exposure of the sector the SEA arrives from — utils/seaArrival, carried on the score. */
  seaArrivalExposureLevel?: string,
  /** The km/h `windBeaufort` was rounded from — utils/suitabilityTone.holdsNoBuildableChopAtThree. */
  windSpeedKmh?: number
) => {
  const tones: Record<CalmnessTone, { colorClass: string; ringClass: string; bgClass: string; textClass: string }> = {
    blue: {
      colorClass: 'bg-sky-500',
      ringClass: 'ring-sky-200',
      bgClass: 'bg-sky-50',
      textClass: 'text-sky-700',
    },
    yellow: {
      colorClass: 'bg-yellow-400',
      ringClass: 'ring-yellow-200',
      bgClass: 'bg-yellow-50',
      textClass: 'text-yellow-700',
    },
    orange: {
      colorClass: 'bg-orange-500',
      ringClass: 'ring-orange-200',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
    },
    red: {
      colorClass: 'bg-rose-600',
      ringClass: 'ring-rose-300',
      bgClass: 'bg-rose-50',
      textClass: 'text-rose-700',
    },
  };

  if (!showWindExposureColors) return tones.blue;

  // The ladder itself — wind tone, cove rule and the running-sea ceiling — lives in
  // utils/suitabilityTone. It is deliberately NOT written here any more: this function and
  // the card/list chip (utils/windExposureEngine.getSimpleWindColor) were two separate
  // ladders that disagreed on 38% of the condition grid, always with the card claiming
  // calmer water than this pin. Both now read the same function, so they cannot drift again.
  return tones[resolveConditionTone({
    exposureLevel,
    beaufort: typeof windBeaufort === 'number' ? windBeaufort : 0,
    isEnclosedCove,
    seaStateM,
    offshoreFlatWater,
    glassWaterAtFour,
    downwindSeaSample,
    swimVerdictAvoid,
    seaArrivalExposureLevel,
    windSpeedKmh,
  })];
};

/**
 * Every legend map below is keyed by CalmnessTone, NOT by its own literal set. That is the whole
 * reason removing the cove's 'green' from the ladder produced a compiler error list here instead
 * of five silently-dead entries: the legend cannot describe a colour the ladder cannot paint, and
 * it cannot omit one the ladder can.
 */
type WindLegendDot = CalmnessTone;
type MapExposureEvidence = 'supported' | 'estimated';

const windLegendDotClasses: Record<WindLegendDot, string> = {
  blue: 'bg-sky-500 ring-sky-200',
  yellow: 'bg-yellow-400 ring-yellow-200',
  orange: 'bg-orange-500 ring-orange-200',
  red: 'bg-rose-600 ring-rose-300',
};

/** Selected-state skin for a legend row used as a filter button — the row's own colour, softened. */
const windLegendActiveClasses: Record<WindLegendDot, string> = {
  blue: 'border-sky-400 bg-sky-50 dark:border-sky-400 dark:bg-sky-500/15',
  yellow: 'border-yellow-400 bg-yellow-50 dark:border-yellow-400 dark:bg-yellow-500/15',
  orange: 'border-orange-400 bg-orange-50 dark:border-orange-400 dark:bg-orange-500/15',
  red: 'border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-500/15',
};

// Set once the visitor has actually moved the hour slider, so the first-visit
// nudge (handle wiggle + mobile helper line) never shows again on this device.
const HOUR_SLIDER_HINT_KEY = 'cb.hourSlider.used';

const windSliderTones: Record<WindLegendDot, {
  color: string;
  shadow: string;
  focus: string;
}> = {
  blue: {
    color: '#0ea5e9',
    shadow: 'rgba(14, 165, 233, 0.38)',
    focus: '#38bdf8',
  },
  yellow: {
    color: '#facc15',
    shadow: 'rgba(202, 138, 4, 0.34)',
    focus: '#facc15',
  },
  orange: {
    color: '#f97316',
    shadow: 'rgba(249, 115, 22, 0.38)',
    focus: '#fb923c',
  },
  red: {
    color: '#e11d48',
    shadow: 'rgba(225, 29, 72, 0.38)',
    focus: '#fb7185',
  },
};

/**
 * THE SLIDER AND THE LEGEND ARE BOTH COLOURED BY THE PINS (01/08/2026).
 *
 * The slider used to run `beaufort >= 7 red / >= 5 orange / >= 3 yellow / else blue` — a third
 * independent scale beside the two that utils/suitabilityTone was created to merge. It read
 * only the wind, so it could not see the sea or the shape of any coast: on a day with a 1,4 m
 * swell and 4 Bft it showed a calm yellow thumb above a map of red pins, and the two things
 * the user compares side by side disagreed. The legend had the same defect for the same reason.
 *
 * Miltos settled it: the slider, the legend and the beaches may never show different colours.
 * Both now read this one tally, built from the tones of the beaches actually on the map through
 * the same resolveConditionTone every pin uses.
 *
 * `dominant` breaks ties toward the ROUGHER tone — an hour that is half calm and half rough is
 * not advertised as calm. CALMNESS_ORDER runs roughest → calmest, so scanning it in order does
 * that without a second comparison.
 */
interface MapToneTally {
  counts: Map<CalmnessTone, number>;
  dominant: CalmnessTone | undefined;
  total: number;
}

const tallyMapTones = (tones: CalmnessTone[]): MapToneTally => {
  const counts = new Map<CalmnessTone, number>();
  for (const t of tones) counts.set(t, (counts.get(t) ?? 0) + 1);
  let dominant: CalmnessTone | undefined;
  let bestCount = -1;
  for (const tone of CALMNESS_ORDER) {
    const c = counts.get(tone) ?? 0;
    if (c > bestCount) {
      bestCount = c;
      dominant = tone;
    }
  }
  return { counts, dominant: tones.length ? dominant : undefined, total: tones.length };
};

// Custom marker icons based on exposure
const createExposureIcon = (
  exposureLevel?: string,
  showWindExposureColors = true,
  windBeaufort?: number,
  isTopPick = false,
  evidence: MapExposureEvidence = 'estimated',
  isHighlighted = false,
  isEnclosedCove = false,
  isSurfSpot = false,
  /** Swell-equivalent sea state (m) — ceiling only, see getExposureMarkerTone. */
  seaStateM?: number,
  /** Enclosed-cove badge. Decided by suitabilityTone.showsCoveBadge, never inline here. */
  showCoveBadge = false,
  /** Wind off the land over zero fetch at 5 Bft — utils/offshoreFlatWater. */
  offshoreFlatWater = false,
  /** Offshore wind over zero fetch at 4 Bft with a sea proven quiet — utils/offshoreFlatWater. */
  glassWaterAtFour = false,
  /** The sea reading came from downwind of this shore — utils/offshoreFlatWater.hasDownwindSeaSample. */
  downwindSeaSample = false,
  /** The engine refused a swim here — the pin is capped at ΜΕΤΡΙΑ (utils/suitabilityTone). */
  swimVerdictAvoid = false,
  /** Exposure of the sector the SEA arrives from — utils/seaArrival, carried on the score. */
  seaArrivalExposureLevel?: string,
  /** The km/h behind `windBeaufort` — see getExposureMarkerTone. */
  windSpeedKmh?: number
) => {
  const topPickClass = isTopPick ? 'beach-map-top-pick-marker-dot' : '';
  const surfClass = isSurfSpot ? 'beach-map-marker-surf' : '';
  // A CHILD element, not a pseudo-element. Both ::before and ::after on .beach-map-marker-dot
  // are already spoken for (surf badge and the scroll-highlight ring use ::before, the top-pick
  // radar uses ::after), and a third would silently win or lose a specificity race depending on
  // file order — which is how the surf badge already disappears on a scroll-highlighted marker.
  const coveBadge = showCoveBadge ? '<span class="beach-map-marker-cove" aria-hidden="true"></span>' : '';
  const highlightedClass = isHighlighted ? 'beach-map-active-scroll-marker-dot' : '';
  const evidenceClass = evidence === 'supported'
    ? 'beach-map-marker-evidence-supported'
    : 'beach-map-marker-evidence-estimated';

  if (!showWindExposureColors) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="beach-map-marker-dot ${topPickClass} ${highlightedClass} ${evidenceClass} ${surfClass} bg-sky-500 w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ring-sky-200"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10]
    });
  }

  const { colorClass, ringClass } = getExposureMarkerTone(exposureLevel, showWindExposureColors, windBeaufort, isEnclosedCove, seaStateM, offshoreFlatWater, glassWaterAtFour, downwindSeaSample, swimVerdictAvoid, seaArrivalExposureLevel, windSpeedKmh);
  // REMOVED 01/08/2026: the hollow-centre ("donut") cue on exposed markers.
  //
  // It was a non-colour cue — the shape carried the exposed/not-exposed split so it stayed
  // legible without relying on hue. In practice it did the opposite. Reported the day it
  // shipped, by the person who built the site: two orange pins, one with a little circle and
  // one without, read as two different severities. They are not — the colour is the whole
  // verdict, and the same orange arrives with or without the shape (at 5-6 Bft the wind ladder
  // paints sheltered shores orange too; at 4 Bft a 1,2 m sea caps them down). A cue that makes
  // people ask "is the one with the circle worse?" costs more than the hue-independence it buys.
  //
  // Read this before adding it back: the accessibility need is real and unmet. If it returns it
  // must distinguish things the colour does NOT already say, and it must be legible without a
  // legend entry — because the legend entry was tried here too and did not rescue it.
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="beach-map-marker-dot ${topPickClass} ${highlightedClass} ${evidenceClass} ${surfClass} ${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}">${coveBadge}</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

/**
 * Leaflet rebuilds a marker's DOM element and repositions it every time it is handed a new
 * icon OBJECT — even when that object describes exactly the same dot. The markers were built
 * fresh on every render, so moving the hour bar one step re-made all 44: measured 641ms inside
 * Leaflet's own _setPosition for a single drag across the day, the largest cost of the gesture.
 *
 * Both creators below are pure — the HTML they return is fully determined by their arguments,
 * with nothing per-beach in it. So the same arguments can hand back the same object, and
 * react-leaflet then skips setIcon entirely for every marker whose look did not change. The
 * ones that did change still change; nothing about what is drawn is different.
 */
const markerIconCache = new Map<string, L.DivIcon>();

const cachedDivIcon = (key: string, build: () => L.DivIcon): L.DivIcon => {
  const existing = markerIconCache.get(key);
  if (existing) return existing;
  const made = build();
  // Distinct looks are colour x badges x beaufort — a few hundred at most. The cap is a
  // backstop against an input nobody expected, not a path we plan to hit.
  if (markerIconCache.size > 2000) markerIconCache.clear();
  markerIconCache.set(key, made);
  return made;
};

const beachIconFor = (
  item: Pick<SuitableBeach, 'score' | 'exposureLevel' | 'canClaimWindProtection' | 'simpleWindSuitability'>,
  showWindExposureColors = true,
  isTopPick = false,
  isHighlighted = false,
  isSurfSpot = false
): L.DivIcon => {
  // The only thing the icon reads out of `item` — so it is the whole of its identity here.
  const { colorClass, ringClass } = getRecommendationTone(item, showWindExposureColors);
  const key = `r|${colorClass}|${ringClass}|${isTopPick}|${isHighlighted}|${isSurfSpot}`;
  return cachedDivIcon(key, () => createBeachIcon(item, showWindExposureColors, isTopPick, isHighlighted, isSurfSpot));
};

const exposureIconFor = (...args: Parameters<typeof createExposureIcon>): L.DivIcon =>
  cachedDivIcon(`e|${args.map(value => String(value)).join('|')}`, () => createExposureIcon(...args));

const UserLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div class="beach-map-user-marker-dot grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-blue-600 text-white shadow-xl ring-4 ring-blue-200">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

// Tent pin for organized campsites near the focused beach (detail map). Emerald to read
// as a distinct "amenity" marker against the sky/exposure-coloured beach dots.
const CampsiteIcon = L.divIcon({
  className: 'campsite-icon',
  html: `<div class="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-200">
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/></svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

const directionDegrees: Record<string, number> = {
  North: 0,
  Northeast: 45,
  East: 90,
  Southeast: 135,
  South: 180,
  Southwest: 225,
  West: 270,
  Northwest: 315,
};

const getWindFlowTone = (beaufort?: number) => {
  if (typeof beaufort !== 'number') {
    return {
      color: 'rgba(14, 165, 233, 0.9)',
      glow: 'rgba(255, 255, 255, 0.95)',
      opacity: 0.82,
      speedMultiplier: 1,
    };
  }

  if (beaufort >= 6) {
    return {
      color: 'rgba(244, 63, 94, 0.95)',
      glow: 'rgba(255, 255, 255, 0.95)',
      opacity: 0.9,
      speedMultiplier: 0.74,
    };
  }

  if (beaufort >= 5) {
    return {
      color: 'rgba(249, 115, 22, 0.94)',
      glow: 'rgba(255, 255, 255, 0.96)',
      opacity: 0.88,
      speedMultiplier: 0.84,
    };
  }

  if (beaufort >= 4) {
    return {
      color: 'rgba(245, 158, 11, 0.9)',
      glow: 'rgba(255, 255, 255, 0.94)',
      opacity: 0.84,
      speedMultiplier: 0.96,
    };
  }

  return {
    color: 'rgba(6, 182, 212, 0.82)',
    glow: 'rgba(255, 255, 255, 0.9)',
    opacity: 0.76,
    speedMultiplier: 1.18,
  };
};

type WindParticle = {
  x: number;
  y: number;
  length: number;
  speed: number;
  life: number;
  maxLife: number;
};

const directionShortLabels: Record<LanguageCode, Record<string, string>> = {
  en: { North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SW', West: 'W', Northwest: 'NW' },
  gr: { North: 'Β', Northeast: 'ΒΑ', East: 'Α', Southeast: 'ΝΑ', South: 'Ν', Southwest: 'ΝΔ', West: 'Δ', Northwest: 'ΒΔ' },
  de: { North: 'N', Northeast: 'NO', East: 'O', Southeast: 'SO', South: 'S', Southwest: 'SW', West: 'W', Northwest: 'NW' },
  it: { North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SO', West: 'O', Northwest: 'NO' },
  fr: { North: 'N', Northeast: 'NE', East: 'E', Southeast: 'SE', South: 'S', Southwest: 'SO', West: 'O', Northwest: 'NO' },
};

const compassLetters: Record<LanguageCode, { n: string; e: string; s: string; w: string }> = {
  en: { n: 'N', e: 'E', s: 'S', w: 'W' },
  gr: { n: 'Β', e: 'Α', s: 'Ν', w: 'Δ' },
  de: { n: 'N', e: 'O', s: 'S', w: 'W' },
  it: { n: 'N', e: 'E', s: 'S', w: 'O' },
  fr: { n: 'N', e: 'E', s: 'S', w: 'O' },
};

const getWindTone = (beaufort?: number) => {
  if (typeof beaufort !== 'number') {
    return {
      ring: 'ring-sky-100',
      arrow: '#0284c7',
      dot: 'bg-sky-500',
      text: 'text-sky-800',
      subtext: 'text-slate-700',
      chip: 'bg-sky-50 text-sky-700 border-sky-100',
    };
  }

  if (beaufort >= 6) {
    return {
      ring: 'ring-rose-100',
      arrow: '#e11d48',
      dot: 'bg-rose-500',
      text: 'text-rose-800',
      subtext: 'text-rose-600',
      chip: 'bg-rose-50 text-rose-700 border-rose-100',
    };
  }

  if (beaufort >= 4) {
    return {
      ring: 'ring-amber-100',
      arrow: '#d97706',
      dot: 'bg-amber-500',
      text: 'text-amber-800',
      subtext: 'text-amber-600',
      chip: 'bg-amber-50 text-amber-700 border-amber-100',
    };
  }

  return {
    ring: 'ring-cyan-100',
    arrow: '#0891b2',
    dot: 'bg-cyan-500',
    text: 'text-cyan-800',
    subtext: 'text-slate-700',
    chip: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  };
};

interface WindDirectionGraphicProps {
  windDirection?: string;
  windDirectionDeg?: number;
  windSpeedKmh?: number;
  windBeaufort?: number;
  /** Beaufort actually measured on the shores in view — replaces the single region figure. */
  shoreBeaufortRange?: { min: number; max: number };
  language: LanguageCode;
  compact?: boolean;
  preview?: boolean;
}

const WindFlowOverlay: React.FC<{
  windDirection?: string;
  windDirectionDeg?: number;
  windBeaufort?: number;
  preview?: boolean;
}> = ({ windDirection, windDirectionDeg, windBeaufort, preview = false }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fromDegrees = typeof windDirectionDeg === 'number' && Number.isFinite(windDirectionDeg)
    ? windDirectionDeg
    : windDirection
      ? directionDegrees[windDirection]
      : undefined;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fromDegrees === undefined) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const flowDegrees = (fromDegrees + 180) % 360;
    const flowRadians = (flowDegrees * Math.PI) / 180;
    const dx = Math.sin(flowRadians);
    const dy = -Math.cos(flowRadians);
    const tone = getWindFlowTone(windBeaufort);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particles: WindParticle[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastTime = performance.now();
    let onScreen = true;
    let tabAwake = !document.hidden;
    const shouldRun = () => !reducedMotion && onScreen && tabAwake;

    const randomRange = (min: number, max: number) => min + Math.random() * (max - min);

    const resetParticle = (particle: WindParticle, fromEdge: boolean) => {
      const margin = Math.max(width, height) * 0.18;
      const useHorizontalEdge = Math.abs(dx) > Math.abs(dy);

      if (fromEdge) {
        if (useHorizontalEdge) {
          particle.x = dx >= 0 ? -margin : width + margin;
          particle.y = randomRange(-margin, height + margin);
        } else {
          particle.x = randomRange(-margin, width + margin);
          particle.y = dy >= 0 ? -margin : height + margin;
        }
      } else {
        particle.x = randomRange(-margin, width + margin);
        particle.y = randomRange(-margin, height + margin);
      }

      const beaufort = typeof windBeaufort === 'number' ? windBeaufort : 3;
      particle.length = randomRange(preview ? 26 : 34, preview ? 58 : 78);
      particle.speed = randomRange(22 + beaufort * 7, 40 + beaufort * 11);
      particle.life = 0;
      particle.maxLife = randomRange(1.6, 4.2);
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const targetCount = Math.min(
        preview ? 96 : 128,
        Math.max(preview ? 44 : 58, Math.round((width * height) / (preview ? 5200 : 6200)))
      );

      while (particles.length < targetCount) {
        const particle = {} as WindParticle;
        resetParticle(particle, false);
        particles.push(particle);
      }
      particles.length = targetCount;
    };

    /**
     * Wind, not tadpoles. The old thread was drawn as a comet — a fat bright nose with a tail
     * thinning away behind it — and at this size that shape reads as something swimming, no
     * matter how straight it travels. Weather maps draw wind the opposite way: every thread is
     * the same thin width and the same colour, and what sells the motion is that the picture is
     * never wiped. Each frame only adds the millimetre a particle just moved and dims whatever
     * was already on the canvas, so a soft streak grows behind it and dies out on its own.
     */
    const trailFadeSeconds = 0.32;
    const threadWidth = preview ? 1 : 1.15;

    /** Reduced motion: nothing moves, so no streak can build. Draw the threads full-length once. */
    const drawStaticField = () => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = tone.opacity * 0.5;
      context.strokeStyle = tone.color;
      context.lineWidth = threadWidth;
      context.lineCap = 'butt';
      context.beginPath();
      particles.forEach(particle => {
        context.moveTo(particle.x - dx * particle.length, particle.y - dy * particle.length);
        context.lineTo(particle.x, particle.y);
      });
      context.stroke();
      context.globalAlpha = 1;
    };

    const draw = (time: number) => {
      const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      if (reducedMotion) {
        drawStaticField();
        return;
      }

      // Dim, don't erase. Tied to real elapsed time so a 30 fps phone and a 120 fps laptop
      // show streaks of the same length instead of the phone showing stubs.
      const fade = 1 - Math.exp(-deltaSeconds / trailFadeSeconds);
      context.globalCompositeOperation = 'destination-out';
      context.globalAlpha = 1;
      context.fillStyle = `rgba(0, 0, 0, ${fade.toFixed(3)})`;
      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = tone.opacity * 0.8;
      context.strokeStyle = tone.color;
      context.lineWidth = threadWidth;
      context.lineCap = 'butt';

      const margin = Math.max(width, height) * 0.22;
      // One path for the whole field and a single stroke. The old loop built a fresh gradient,
      // stroked a six-point curve and filled a circle for each of up to 128 particles, every
      // frame; this is three canvas calls in total no matter how many threads there are.
      context.beginPath();
      particles.forEach(particle => {
        particle.life += deltaSeconds;
        const nextX = particle.x + dx * particle.speed * deltaSeconds;
        const nextY = particle.y + dy * particle.speed * deltaSeconds;
        const spent =
          particle.life > particle.maxLife ||
          nextX < -margin ||
          nextX > width + margin ||
          nextY < -margin ||
          nextY > height + margin;

        // Recycling has to jump without drawing, or the reset would rule a line right across
        // the map. The lifetime exists so the field keeps reseeding instead of settling into
        // fixed lanes that the eye starts to read as stripes.
        if (spent) {
          resetParticle(particle, true);
          return;
        }

        context.moveTo(particle.x, particle.y);
        context.lineTo(nextX, nextY);
        particle.x = nextX;
        particle.y = nextY;
      });
      context.stroke();
      context.globalAlpha = 1;

      animationFrame = shouldRun() ? requestAnimationFrame(draw) : 0;
    };

    /**
     * The loop used to start on mount and never stop — it kept redrawing the wind while the
     * visitor was fifty screens down the beach list, or in another tab. Nothing on screen,
     * a phone's battery and main thread still paying for it. Now it sleeps whenever the map
     * is out of sight and wakes on its own.
     */
    const wake = () => {
      if (animationFrame || !shouldRun()) return;
      lastTime = performance.now();
      animationFrame = requestAnimationFrame(draw);
    };

    resizeCanvas();
    draw(lastTime);

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      if (reducedMotion) draw(performance.now());
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      entries => {
        onScreen = entries.some(entry => entry.isIntersecting);
        wake();
      },
      { rootMargin: '80px 0px' }
    );
    intersectionObserver.observe(canvas);

    const onVisibilityChange = () => {
      tabAwake = !document.hidden;
      wake();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelAnimationFrame(animationFrame);
    };
  }, [fromDegrees, preview, windBeaufort]);

  return (
    <div className="wind-flow-overlay" aria-hidden="true">
      <canvas ref={canvasRef} className="wind-flow-canvas" />
    </div>
  );
};

const WindDirectionGraphic: React.FC<WindDirectionGraphicProps> = ({
  windDirection,
  windDirectionDeg,
  windSpeedKmh,
  windBeaufort,
  shoreBeaufortRange,
  language,
  compact = false,
  preview = false,
}) => {
  const fromDegrees = typeof windDirectionDeg === 'number' && Number.isFinite(windDirectionDeg)
    ? windDirectionDeg
    : windDirection
      ? directionDegrees[windDirection]
      : undefined;

  if (fromDegrees === undefined) return null;

  const flowDegrees = (fromDegrees + 180) % 360;
  const fromDirection = windDirection || degToCompass(fromDegrees);
  const toDirection = degToCompass(flowDegrees);
  const fromLabel = directionShortLabels[language]?.[fromDirection] || fromDirection;
  const toLabel = directionShortLabels[language]?.[toDirection] || toDirection;
  const compass = compassLetters[language] || compassLetters.en;
  // The ring follows the strongest shore on screen, not the region point — otherwise a calm
  // ring would frame a range that ends in 6.
  const tone = getWindTone(shoreBeaufortRange?.max ?? windBeaufort);
  const positionClass = compact || preview
    ? 'left-3 top-3'
    : 'left-3 top-[3.75rem] sm:left-4 sm:top-4';
  const copy = getLocalizedCopy(language, {
    en: {
      title: 'Wind flow',
      fromTo: `${fromLabel} to ${toLabel}`,
      from: `From ${fromLabel}`,
      beaufortUnit: 'Bft',
      onShores: 'on the shores',
    },
    gr: {
      title: 'Φορά ανέμου',
      fromTo: `Από ${fromLabel} προς ${toLabel}`,
      from: `Από ${fromLabel}`,
      beaufortUnit: 'μποφ.',
      onShores: 'στις ακτές',
    },
    fr: {
      title: 'Flux du vent',
      fromTo: `${fromLabel} vers ${toLabel}`,
      from: `Depuis ${fromLabel}`,
      beaufortUnit: 'Bft',
      onShores: 'sur les côtes',
    },
    de: {
      title: 'Windverlauf',
      fromTo: `${fromLabel} nach ${toLabel}`,
      from: `Von ${fromLabel}`,
      beaufortUnit: 'Bft',
      onShores: 'an den Küsten',
    },
    it: {
      title: 'Flusso del vento',
      fromTo: `Da ${fromLabel} verso ${toLabel}`,
      from: `Da ${fromLabel}`,
      beaufortUnit: 'Bft',
      onShores: 'sulle coste',
    },
  });
  const title = copy.title;
  const fromTo = copy.fromTo;
  /**
   * THE SINGLE REGION NUMBER LEAVES THE SCREEN (02/08/2026).
   *
   * This line used to read «2 μποφ. · 10 km/h» — one wind, measured at the region's geometric
   * centre, printed in the largest type on the map while every pin beside it had been coloured
   * from its own shore since 01/08. Reported twice in one day: Χανιά showed «2 μποφ.» with red
   * pins along the north coast, and Γιαλισκάρι's pin was yellow at 08:00 over 4 Bft while the
   * widget said 2. Both times the pins were right and this number was the confusion.
   *
   * It is replaced, not deleted. The DIRECTION is a genuinely regional fact — it is what explains
   * which side of an island is sheltered — so it stays. The SPEED becomes the range actually
   * measured on the shores in view: «2–5 μποφ. στις ακτές». One number for a coastline was never
   * true; the range is, and it is the sentence that makes a mixed map read as correct rather than
   * broken. With no per-beach readings (first paint, no geometry, a failed fetch) it falls back
   * to exactly what it printed before.
   */
  const shoreLabel = shoreBeaufortRange
    ? (shoreBeaufortRange.min === shoreBeaufortRange.max
      ? `${shoreBeaufortRange.min} ${copy.beaufortUnit} ${copy.onShores}`
      : `${shoreBeaufortRange.min}–${shoreBeaufortRange.max} ${copy.beaufortUnit} ${copy.onShores}`)
    : undefined;
  const speed = shoreLabel
    ?? (windSpeedKmh !== undefined
      ? `${windBeaufort ?? '-'} ${copy.beaufortUnit} · ${Math.round(windSpeedKmh)} km/h`
      : copy.from);

  return (
    <div className={`pointer-events-none absolute z-[1000] ${positionClass}`}>
      <div className={`flex items-center gap-1.5 rounded-xl border border-white/75 bg-white p-1.5 shadow-lg shadow-sky-900/12 ring-1 ${tone.ring} sm:gap-2 sm:rounded-2xl sm:p-2`}>
        <div className="relative h-10 w-10 shrink-0 rounded-full border border-slate-200/80 bg-gradient-to-b from-white to-sky-50/80 shadow-inner sm:h-[3.65rem] sm:w-[3.65rem]">
          <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[7px] font-black leading-none text-slate-600 sm:top-1 sm:text-[9px]">{compass.n}</span>
          <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] font-black leading-none text-slate-600 sm:right-1 sm:text-[9px]">{compass.e}</span>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-black leading-none text-slate-600 sm:bottom-1 sm:text-[9px]">{compass.s}</span>
          <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[7px] font-black leading-none text-slate-600 sm:left-1 sm:text-[9px]">{compass.w}</span>
          <svg
            viewBox="0 0 64 64"
            className="absolute inset-0"
            style={{ transform: `rotate(${flowDegrees}deg)` }}
            aria-hidden="true"
          >
            <line x1="32" y1="47" x2="32" y2="17" stroke={tone.arrow} strokeWidth="4.5" strokeLinecap="round" />
            <path d="M32 10 L43 24 H21 Z" fill={tone.arrow} />
          </svg>
          <span className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${tone.dot}`} />
        </div>

        <div className={`${compact || preview ? 'hidden sm:block' : 'block'} min-w-0 pr-0.5`}>
          <p className={`whitespace-nowrap text-[11px] font-black leading-tight ${tone.text}`}>{title}</p>
          <p className="mt-0.5 whitespace-nowrap text-[11px] font-bold leading-tight text-slate-700">{fromTo}</p>
          <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black leading-none ${tone.chip}`}>
            {speed}
          </p>
        </div>
      </div>
    </div>
  );
};

const BeachMap: React.FC<BeachMapProps> = ({
  beaches,
  userLocation,
  userLocationAccuracy,
  onBeachClick,
  onVisibleBeachIdsChange,
  center: propCenter,
  zoom: propZoom,
  windSpeed,
  windDirection,
  windDirectionDeg,
  beachLocalWinds,
  hourSlots,
  selectedHourDt = null,
  onHourChange,
  onHourSettled,
  enableHourSlider = false,
  showMarkerConditions = false,
  stayHours = null,
  onStayHoursChange,
  language = 'en',
  selectedDate,
  compact = false,
  preview = false,
  showBasemapToggle,
  enableScrollWheelZoom = false,
  isExposureLoading = false,
  topBeachId,
  highlightedBeachId,
  followHighlightedBeach = false,
  fitBoundsToBeaches = false,
  fitBoundsBeaches,
  fitBoundsKey,
  guardrailBeaches,
  onUserInteraction,
  compactPreviewHeightClassName,
  islandName,
  campsites,
  exposureLevelOverrides,
  toneFilter = null,
  onToneFilterChange,
  onBeachTonesChange,
  toneSourceBeaches,
  uncountedBeachIds,
  unrecommendedBeachIds,
  calmWaterFilter = false,
  onCalmWaterFilterChange,
  onCalmWaterStateChange
}) => {
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const [mapMode, setMapMode] = useState<'recommendation' | 'wind'>('wind');
  // Camping layer: ON by default (per-island counts are small, so it's discoverable, not
  // cluttered); the bottom-left button hides the tent pins for a clean beach-finding map.
  // Plain street map vs satellite imagery. Remembered across visits because it's a
  // personal viewing preference, not part of the recommendation. Read lazily and
  // defensively: this component is also rendered during the static prerender.
  const [basemap, setBasemap] = useState<BasemapId>(() => {
    if (typeof window === 'undefined') return 'map';
    try {
      return window.localStorage.getItem(BASEMAP_STORAGE_KEY) === 'satellite' ? 'satellite' : 'map';
    } catch {
      return 'map';
    }
  });
  const [selectedBeachId, setSelectedBeachId] = useState<number | null>(null);
  // Ζωντανές πινέζες ανά παραλία, ώστε το ανοιχτό ταμπελάκι να μπορεί να μετακομίσει σε άλλη
  // πινέζα όταν κυλάει ο κατάλογος (MarkerPopupScrollFollower).
  const beachMarkerRefs = useRef<Map<number, L.Marker>>(new Map());
  /**
   * ΤΙ ΣΗΜΑΙΝΕΙ ΤΟ ΧΡΩΜΑ — ΜΕ ΠΑΤΗΜΑ, ΟΧΙ ΜΕ ΜΟΝΙΜΟ ΚΕΙΜΕΝΟ (Μίλτος, 20/08/2026).
   *
   * Μόνιμη εξηγητική γραμμή πάνω από το υπόμνημα έχει ήδη απορριφθεί δύο φορές ως «ταπετσαρία»
   * (docs/team/HANDOVER-colour-cause-line.md §1): φαίνεται κάθε μέρα, και τις περισσότερες δεν
   * έχει τίποτα να πει. Ένα ⓘ κοστίζει μηδέν ύψος όταν είναι κλειστό και απαντά στον έναν που
   * αναρωτήθηκε. Δεν είναι «γραμμή αιτίας» — αυτή ζει χωριστά και μιλάει μόνο στα χρώματα που
   * τρομάζουν· αυτό εδώ εξηγεί τον ΡΟΛΟ της κλίμακας, μία φορά, για πάντα.
   */
  const [showToneScaleHint, setShowToneScaleHint] = useState(false);
  /**
   * Η ΠΥΞΙΔΑ ΚΑΝΕΙ ΧΩΡΟ ΣΤΟ ΤΑΜΠΕΛΑΚΙ (20/08/2026).
   *
   * Το popup του Leaflet ζει μέσα στο `.leaflet-map-pane` (z-index 400, δικό του stacking
   * context), οπότε ΔΕΝ μπορεί να ανέβει πάνω από ένα overlay του χάρτη με z-1000 όσο κι αν
   * του αλλάξεις pane — μόνο ανεβάζοντας ΟΛΟ τον χάρτη πάνω από τα κουμπιά zoom, που είναι
   * χειρότερο. Και δεν χρειάζεται: όταν ο επισκέπτης ρωτάει για ΜΙΑ παραλία, η πυξίδα του
   * ανέμου ΤΗΣ ΠΕΡΙΟΧΗΣ δεν είναι αυτό που κοιτάει. Φεύγει όσο διαβάζει, ξαναγυρίζει μετά.
   */
  const [hasOpenBeachPopup, setHasOpenBeachPopup] = useState(false);
  const [hoveredBeachId, setHoveredBeachId] = useState<number | null>(null);
  const [hoverPreviewPosition, setHoverPreviewPosition] = useState<HoverPreviewPosition | null>(null);
  const [beachLabelOpacity, setBeachLabelOpacity] = useState(0);
  const hoveredMarkerElementRef = useRef<HTMLElement | null>(null);
  const markerLeaveHandlerRef = useRef<((event: MouseEvent | PointerEvent) => void) | null>(null);

  // --- Hour slider (controlled by the parent) ---
  // The parent feeds already-filtered hour slots, the selected hour, and an
  // hour-adjusted wind via the wind props — so the map and the recommendations
  // stay in sync. The slider here is just the control surface.
  const sliderHours = hourSlots ?? [];
  const activeHourItem = useMemo(
    () => sliderHours.find(item => item.dt === selectedHourDt) ?? sliderHours[0] ?? null,
    [selectedHourDt, sliderHours]
  );
  const sliderActiveIndex = Math.max(0, sliderHours.findIndex(item => item.dt === activeHourItem?.dt));
  const sliderMaxIndex = Math.max(0, sliderHours.length - 1);
  /**
   * NOTHING about the drag itself lives in React state — reported 14/08/2026 as
   * "the bar sticks, it is not smooth".
   *
   * The cost was never in the slider. Every render of this component walks EVERY
   * beach on the map through beachConditionTone three times over (the legend
   * tally, the tones reported upward, the marker filter) — see the block around
   * `beachTonesById`, none of it memoised on purpose, because those three must be
   * literally the same expression. The old `smoothSliderIndex` state turned one
   * pointermove into one full render, so a finger moving across a phone screen at
   * 120Hz asked for a few hundred passes over the region's beaches per second.
   *
   * So the handle position and the filled track are written straight to the DOM
   * during a drag, and React is told only when the WHOLE HOUR changes: about
   * fifteen renders for a full sweep instead of several hundred. The hour the map
   * paints is unchanged — it was already quantised to whole hours (Math.round on
   * the old display index), so no beach changes colour at a moment it did not before.
   */
  const sliderInputRef = useRef<HTMLInputElement | null>(null);
  const sliderFillRef = useRef<HTMLDivElement | null>(null);
  const scrubIndexRef = useRef(sliderActiveIndex);
  const isScrubbingRef = useRef(false);
  const paintSliderFill = (index: number) => {
    const fill = sliderFillRef.current;
    if (!fill) return;
    const ratio = sliderMaxIndex > 0 ? Math.min(1, Math.max(0, index / sliderMaxIndex)) : 0;
    // Half a handle in from each end, so the fill stops under the handle's centre
    // rather than at the raw percentage of the track.
    fill.style.width = `calc(13px + (100% - 26px) * ${ratio})`;
  };
  // Runs after every render (no dependency list on purpose): whoever changed the
  // hour — the arrows, the keyboard, a new region, the parent — the input and the
  // fill are put back in step with it. During a drag the finger wins.
  useLayoutEffect(() => {
    if (isScrubbingRef.current) {
      paintSliderFill(scrubIndexRef.current);
      return;
    }
    scrubIndexRef.current = sliderActiveIndex;
    if (sliderInputRef.current) sliderInputRef.current.value = String(sliderActiveIndex);
    paintSliderFill(sliderActiveIndex);
  });
  const sliderDisplayBeaufort = activeHourItem
    ? getBeaufortLevel(activeHourItem.wind.speed * 3.6)
    : undefined;
  // sliderTone is derived further down, once the per-beach exposure levels the pins use exist —
  // it must be the same tone as the pins, so it cannot be computed before them.
  // FIRST-VISIT NUDGE (14/08/2026). Reported from the phone: people did not realise
  // the bar could be dragged at all — a coloured track with a dot reads as a progress
  // bar, not as a control. Until a visitor has moved it once, the handle nudges itself
  // three times, the arrows flank it, and the "drag the hours" line is shown on mobile
  // too (it was desktop-only). After the first use the flag is stored and none of it
  // comes back, so the compact mobile layout is the steady state, not the loud one.
  const [hourHintPending, setHourHintPending] = useState(false);
  useEffect(() => {
    if (!enableHourSlider) return;
    try {
      if (window.localStorage.getItem(HOUR_SLIDER_HINT_KEY) === '1') return;
    } catch {
      // Private mode / storage disabled: showing the hint every visit is the safe side.
    }
    setHourHintPending(true);
  }, [enableHourSlider]);
  const dismissHourHint = () => {
    setHourHintPending(previous => {
      if (!previous) return previous;
      try {
        window.localStorage.setItem(HOUR_SLIDER_HINT_KEY, '1');
      } catch {
        // Nothing to do — the hint simply shows again next visit.
      }
      return false;
    });
  };
  // Called while the finger moves. Deliberately touches no state: it paints the
  // fill itself and only wakes React up when the whole hour underneath changes.
  /**
   * How often the map is allowed to actually recompute while a finger is on the bar.
   *
   * Changing the hour re-scores every beach and repaints the pins and the card list. Doing
   * that for every hour the finger crosses meant fourteen full recomputes inside a 1,6s drag
   * — measured 56 of 214 frames dropped and ten freezes past 100ms, and lowering the update's
   * priority barely helped because the commit itself cannot be interrupted once it starts.
   *
   * Four times a second still reads as "the map follows my finger" and leaves the phone room
   * to draw. The hour the drag LANDS on is never throttled: endHourScrub flushes it.
   */
  const SCRUB_COMMIT_MS = 240;
  const lastScrubCommitRef = useRef(0);
  const pendingScrubSlotRef = useRef<number | null>(null);
  const scrubCommitTimerRef = useRef<number | null>(null);

  const commitHourSlot = (dt: number) => {
    lastScrubCommitRef.current = performance.now();
    pendingScrubSlotRef.current = null;
    if (scrubCommitTimerRef.current !== null) {
      window.clearTimeout(scrubCommitTimerRef.current);
      scrubCommitTimerRef.current = null;
    }
    onHourChange?.(dt);
  };

  useEffect(() => () => {
    if (scrubCommitTimerRef.current !== null) window.clearTimeout(scrubCommitTimerRef.current);
  }, []);

  /** Sends whatever hour the finger is sitting on right now, if any is still owed. */
  const flushPendingScrub = () => {
    const pending = pendingScrubSlotRef.current;
    if (pending === null) return;
    commitHourSlot(pending);
  };

  const scrubToIndex = (rawIndex: number) => {
    const clamped = Math.min(sliderMaxIndex, Math.max(0, rawIndex));
    scrubIndexRef.current = clamped;
    paintSliderFill(clamped);
    const slot = sliderHours[Math.round(clamped)];
    if (!slot || slot.dt === activeHourItem?.dt) return;
    dismissHourHint();

    if (!isScrubbingRef.current) {
      commitHourSlot(slot.dt);
      return;
    }

    pendingScrubSlotRef.current = slot.dt;
    const since = performance.now() - lastScrubCommitRef.current;
    if (since >= SCRUB_COMMIT_MS) {
      commitHourSlot(slot.dt);
      return;
    }
    if (scrubCommitTimerRef.current === null) {
      scrubCommitTimerRef.current = window.setTimeout(() => {
        scrubCommitTimerRef.current = null;
        flushPendingScrub();
      }, SCRUB_COMMIT_MS - since);
    }
  };
  // Lands on a whole hour: the arrows, the keyboard, and the snap when a drag ends.
  const goToHourIndex = (index: number) => {
    const clamped = Math.min(sliderMaxIndex, Math.max(0, Math.round(index)));
    scrubIndexRef.current = clamped;
    if (sliderInputRef.current) sliderInputRef.current.value = String(clamped);
    // Glide, but only for a jump the finger is not already driving.
    sliderFillRef.current?.classList.add('beach-map-hour-fill--glide');
    paintSliderFill(clamped);
    dismissHourHint();
    const slot = sliderHours[clamped];
    if (slot && slot.dt !== activeHourItem?.dt) commitHourSlot(slot.dt);
  };
  const scrubStartIndexRef = useRef(sliderActiveIndex);
  const beginHourScrub = () => {
    isScrubbingRef.current = true;
    scrubStartIndexRef.current = sliderActiveIndex;
    // The fill must track the finger, not chase it 300ms behind — that lag was
    // half of what "not smooth" meant.
    sliderFillRef.current?.classList.remove('beach-map-hour-fill--glide');
  };
  const endHourScrub = () => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    // Any hour still owed from the throttle above is dropped: goToHourIndex right below
    // sends the hour the finger actually landed on, which supersedes it.
    pendingScrubSlotRef.current = null;
    if (scrubCommitTimerRef.current !== null) {
      window.clearTimeout(scrubCommitTimerRef.current);
      scrubCommitTimerRef.current = null;
    }
    const landedIndex = Math.min(sliderMaxIndex, Math.max(0, Math.round(scrubIndexRef.current)));
    goToHourIndex(landedIndex);
    // Announced only here, once, and only if the drag actually moved the hour. The
    // per-hour onHourChange above has already repainted the map on the way.
    if (landedIndex !== scrubStartIndexRef.current) onHourSettled?.();
  };
  const stepSliderHour = (direction: 1 | -1) => {
    const before = Math.round(scrubIndexRef.current);
    goToHourIndex(before + direction);
    if (Math.round(scrubIndexRef.current) !== before) onHourSettled?.();
  };
  const hourSliderCopy: Record<LanguageCode, string> = {
    en: 'Conditions by hour',
    gr: 'Συνθήκες ανά ώρα',
    de: 'Bedingungen je Stunde',
    it: 'Condizioni per ora',
    fr: 'Conditions par heure',
  };
  const hourSliderLabel = hourSliderCopy[language];
  const hourSliderHelper: Record<LanguageCode, string> = {
    en: 'Drag the bar to see the beaches hour by hour',
    gr: 'Σύρε την μπάρα και δες τις παραλίες κάθε ώρα',
    de: 'Zieh den Regler und sieh die Strände Stunde für Stunde',
    it: 'Trascina la barra e vedi le spiagge ora per ora',
    fr: 'Faites glisser la barre pour voir les plages heure par heure',
  };
  /**
   * Η ΙΔΙΑ ΟΔΗΓΙΑ ΣΕ ΤΡΕΙΣ ΛΕΞΕΙΣ — μπαίνει ΜΟΝΟ όταν το κουμπί «Ήρεμο νερό» μοιράζεται τη σειρά.
   *
   * Δεν είναι δεύτερη διατύπωση που θα ξεκολλήσει από την πρώτη: κρατάει **το ρήμα**, που είναι
   * όλη η δουλειά της μακράς μορφής (μπήκε 15/08 ακριβώς επειδή «ένα όνομα δεν λέει σε κανέναν
   * ότι η μπάρα σύρεται»). Ό,τι κόβεται είναι το ΑΠΟΤΕΛΕΣΜΑ — «και δες τις παραλίες κάθε ώρα» —
   * το οποίο ο επισκέπτης βλέπει να συμβαίνει τη στιγμή που σύρει.
   */
  const hourSliderHelperShort: Record<LanguageCode, string> = {
    en: 'Drag the bar',
    gr: 'Σύρε την μπάρα',
    de: 'Zieh den Regler',
    it: 'Trascina la barra',
    fr: 'Faites glisser',
  };
  // ONE sentence, not two. There used to be a second, shorter twin here (hourSliderPrompt) for
  // the desktop heading — same instruction, different wording, so the two drifted apart the
  // moment either was edited and a visitor switching devices was told the same thing twice in
  // two voices. So there is only ever this one string, and since 15/08/2026 it is the heading
  // above the bar at EVERY width.
  //
  // KEEP IT TO ONE PHONE LINE (15/08/2026). It was briefly the fully spelled-out version —
  // «…για να δεις τις καιρικές συνθήκες στις παραλίες ανάλογα την ώρα που θα επιλέξεις» — and
  // Miltos read the result as a wall of text: at ~40 characters per line on a 360 px screen it
  // wrapped to three, above a control that is already tall. It says the same three things in
  // half the words (drag it · you get beaches · hour by hour). Anything longer than roughly 45
  // characters in any language wraps again and undoes this.
  const previousHourCopy: Record<LanguageCode, string> = {
    en: 'Previous hour',
    gr: 'Προηγούμενη ώρα',
    de: 'Vorherige Stunde',
    it: 'Ora precedente',
    fr: 'Heure précédente',
  };
  const nextHourCopy: Record<LanguageCode, string> = {
    en: 'Next hour',
    gr: 'Επόμενη ώρα',
    de: 'Nächste Stunde',
    it: 'Ora successiva',
    fr: 'Heure suivante',
  };
  const beaufortUnitLabel = language === 'gr' ? 'μποφ.' : 'Bft';
  const formatSliderHour = (dt: number) => new Date(dt * 1000).toLocaleTimeString(
    language === 'gr' ? 'el-GR' : undefined,
    { hour: '2-digit', minute: '2-digit', hour12: false }
  );
  const directionLabels: Record<LanguageCode, Record<string, string>> = {
    en: {
      North: 'North',
      Northeast: 'Northeast',
      East: 'East',
      Southeast: 'Southeast',
      South: 'South',
      Southwest: 'Southwest',
      West: 'West',
      Northwest: 'Northwest',
    },
    gr: {
      North: 'Βόρειος',
      Northeast: 'Βορειοανατολικός',
      East: 'Ανατολικός',
      Southeast: 'Νοτιοανατολικός',
      South: 'Νότιος',
      Southwest: 'Νοτιοδυτικός',
      West: 'Δυτικός',
      Northwest: 'Βορειοδυτικός',
    },
    fr: {
      North: 'Nord',
      Northeast: 'Nord-est',
      East: 'Est',
      Southeast: 'Sud-est',
      South: 'Sud',
      Southwest: 'Sud-ouest',
      West: 'Ouest',
      Northwest: 'Nord-ouest',
    },
    de: {
      North: 'Nord',
      Northeast: 'Nordost',
      East: 'Ost',
      Southeast: 'Südost',
      South: 'Süd',
      Southwest: 'Südwest',
      West: 'West',
      Northwest: 'Nordwest',
    },
    it: {
      North: 'Nord',
      Northeast: 'Nord-est',
      East: 'Est',
      Southeast: 'Sud-est',
      South: 'Sud',
      Southwest: 'Sud-ovest',
      West: 'Ovest',
      Northwest: 'Nord-ovest',
    },
  };
  const localizedWindDirection = windDirection
    ? (directionLabels[language]?.[windDirection] || windDirection)
    : windDirection;
  const mapWindDirectionDeg = typeof windDirectionDeg === 'number' && Number.isFinite(windDirectionDeg)
    ? windDirectionDeg
    : windDirection
      ? directionDegrees[windDirection]
      : undefined;
  const windSpeedKmh = typeof windSpeed === 'number' ? windSpeed * 3.6 : undefined;
  const windBeaufort = windSpeedKmh !== undefined ? getBeaufortLevel(windSpeedKmh) : undefined;
  const showWindExposureColors = shouldShowWindExposureColors(windBeaufort);
  const showWindExposureStatusLabels = typeof windBeaufort === 'number' && windBeaufort >= 3;
  const showRecommendationWindColors = windBeaufort === undefined || windBeaufort >= 4;
  // The basemap tiles are network images that stream in after the map mounts,
  // while markers are instant DOM overlays — so without coordination the pins
  // pop onto a blank map before the island appears. Hold the pins until the
  // first tile batch has loaded, with a safety timeout so they always show even
  // if the tile server is slow or the load event never fires.
  const [tilesReady, setTilesReady] = useState(false);
  useEffect(() => {
    if (tilesReady) return;
    const fallback = window.setTimeout(() => setTilesReady(true), 2500);
    return () => window.clearTimeout(fallback);
  }, [tilesReady]);
  const shouldRenderBeachMarkers = !isExposureLoading && tilesReady;
  const visibleMapExposureLevels = useMemo(
    () => getConsistentVisibleMapExposureLevels(beaches, windBeaufort, mapWindDirectionDeg),
    [beaches, mapWindDirectionDeg, windBeaufort]
  );
  const hasSupportedMapEvidence = (item: SuitableBeach): boolean => {
    const hasSupportedWindProfile = (
      (item.windProfileSource === 'override' || item.windProfileSource === 'beach' || item.windProfileSource === 'metadata' || item.windProfileSource === 'geospatial') &&
      item.windProfile !== undefined &&
      item.windProfile.confidence !== 'low' &&
      (
        item.windProfile.exposedToWindDirections.length > 0 ||
        item.windProfile.protectedFromWindDirections.length > 0 ||
        item.windProfile.shelterLevel !== 'unknown' ||
        item.windProfile.fetchExposure !== 'unknown' ||
        typeof item.windProfile.beachFacingDirection === 'number'
      )
    );
    const hasSupportedGeospatial = (
      item.geospatialExposure?.confidence === 'high' ||
      item.geospatialExposure?.confidence === 'medium'
    );

    return hasSupportedWindProfile || hasSupportedGeospatial;
  };
  const getMapExposureLevel = (item: SuitableBeach) => {
    // An override is the authoritative colour computed by the region map (single
    // island wind), passed in so the detail map matches it exactly instead of
    // re-deriving a different colour from the per-beach cluster wind.
    const override = exposureLevelOverrides?.get(item.beach.id);
    if (override) return override;

    if (isExposureLoading && !hasSupportedMapEvidence(item)) {
      return 'partial';
    }

    return visibleMapExposureLevels.get(item.beach.id) || getVisibleMapExposureLevel(item, windBeaufort, mapWindDirectionDeg);
  };
  const getMapExposureEvidence = (item: SuitableBeach): MapExposureEvidence => (
    hasSupportedMapEvidence(item) ? 'supported' : 'estimated'
  );

  /**
   * The Beaufort AT this beach, falling back to the region's when there is no local reading.
   *
   * Until 01/08/2026 every pin, the legend and the slider were coloured from `windBeaufort` — one
   * figure measured at the region centre. Live on 02/08 that centre read 1 Bft for Evia while its
   * own shores ran 1–6 Bft, and fifty beaches nationally were painted «Ιδανική» over 5–6 Bft.
   * `beachLocalWinds` was already arriving from the cluster forecasts and being used only for the
   * hover card. Guarded by scripts/validateColourAgainstRealWind.mjs.
   */
  const beachBeaufort = (item: SuitableBeach): number | undefined => {
    const local = beachLocalWinds?.[item.beach.id];
    return typeof local?.speedKmh === 'number' ? getBeaufortLevel(local.speedKmh) : windBeaufort;
  };

  /**
   * The km/h behind `beachBeaufort` — the pair must always describe the SAME reading, because
   * utils/suitabilityTone.holdsNoBuildableChopAtThree splits the 3 Bft band by speed.
   *
   * Mirrors beachBeaufort branch for branch. The region fallback is returned ONLY when
   * beachBeaufort also fell back to the region Beaufort: during a slider drag it uses
   * `sliderDisplayBeaufort` instead, which describes a different hour than `windSpeedKmh` does,
   * and a mismatched pair is worse than no pair. Undefined simply keeps the older behaviour.
   */
  const beachWindSpeedKmh = (item: SuitableBeach): number | undefined => {
    const local = beachLocalWinds?.[item.beach.id];
    if (typeof local?.speedKmh === 'number') return local.speedKmh;
    return typeof windBeaufort === 'number' ? windSpeedKmh : undefined;
  };

  /**
   * Is the wind blowing OFF the land here, over no fetch? See utils/offshoreFlatWater.
   *
   * Fed the beach's OWN bearing (`local.deg`) rather than the region's, for the same reason
   * beachBeaufort exists: the region centre answered for Vai with a northerly at 3 Bft while its
   * own shore had 5 Bft from 295°, and the sector this rule reads is chosen by that bearing. The
   * region direction remains the fallback where a cluster reading never arrived.
   */
  const beachOffshoreFlatWater = (item: SuitableBeach): boolean => holdsFlatWaterUnderOffshoreWind({
    profile: item.geospatialExposure,
    windDirectionDeg: beachLocalWinds?.[item.beach.id]?.deg ?? mapWindDirectionDeg,
    beaufort: beachBeaufort(item),
  });

  /**
   * Is this beach's sea reading coming from DOWNWIND of it? (utils/offshoreFlatWater.
   * hasDownwindSeaSample — Σχοινιάς-class: offshore wind, zero fetch, no swell, so the 1,3 μ.
   * «ανοιχτά» was measured in water this wind is pushing away from the shore.) Fed the beach's
   * own bearing for the same reason beachOffshoreFlatWater is; the swell comes from the beach's
   * own marine forecast, and an absent reading vetoes rather than passes.
   */
  const beachDownwindSeaSample = (item: SuitableBeach): boolean => hasDownwindSeaSample({
    profile: item.geospatialExposure,
    windDirectionDeg: beachLocalWinds?.[item.beach.id]?.deg ?? mapWindDirectionDeg,
    swellWaveHeightM: item.marine?.swellWaveHeightM,
  });

  /**
   * The 4 Bft door (utils/offshoreFlatWater.holdsGlassWaterAtFourBeaufort — Μελιδόνι-class:
   * offshore wind, zero fetch, and a sea proven quiet). Same beach-own bearing and the same
   * `seaStateSeverityM` the ceiling below reads, so the pin, the legend tally and the card chip
   * cannot answer it differently.
   */
  const beachGlassWaterAtFour = (item: SuitableBeach): boolean => holdsGlassWaterAtFourBeaufort({
    profile: item.geospatialExposure,
    windDirectionDeg: beachLocalWinds?.[item.beach.id]?.deg ?? mapWindDirectionDeg,
    beaufort: beachBeaufort(item) ?? sliderDisplayBeaufort ?? 0,
    seaStateM: seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS),
    // The shore discount is applied inside the door, from the same two fields the ceiling reads.
    exposureLevel: getMapExposureLevel(item),
    seaArrivalExposureLevel: item.seaArrivalExposureLevel,
    // Same swell veto hasDownwindSeaSample takes, from the beach's own marine forecast.
    swellWaveHeightM: item.marine?.swellWaveHeightM,
  });

  /**
   * The spread of wind actually blowing on the shores currently drawn — what the compass widget
   * prints instead of the region's single figure.
   *
   * Deliberately over the beaches ON SCREEN, so the sentence describes what the reader is looking
   * at: filter to one island and the range narrows with it. Needs at least three readings before
   * it will claim anything about "the shores"; below that the widget keeps the old wording, which
   * is honest about being one point.
   */
  const shoreBeaufortRange = React.useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let counted = 0;
    beaches.forEach(item => {
      const local = beachLocalWinds?.[item.beach.id];
      if (typeof local?.speedKmh !== 'number' || !Number.isFinite(local.speedKmh)) return;
      const bft = getBeaufortLevel(local.speedKmh);
      if (bft < min) min = bft;
      if (bft > max) max = bft;
      counted += 1;
    });
    return counted >= 3 ? { min, max } : undefined;
  }, [beaches, beachLocalWinds]);

  // ONE tally, read by both the slider thumb and the legend — see tallyMapTones above. The sea
  // state is the one loaded for the selected hour; while the user is mid-drag the wind is the
  // scrubbed hour's and the sea is the loaded one, which is the same approximation the pins
  // themselves show until the drag is committed.
  /**
   * The colour ONE beach is wearing on this map. Extracted so the pins, the legend counts, the
   * legend's filter and the cards below all read the same single expression — the legend was
   * built to be structurally unable to contradict the pins, and a filter derived from a second
   * copy of this ladder would have reintroduced exactly that.
   */
  /**
   * The arguments the ladder is asked with, in ONE place. Split out on 15/08/2026 because the
   * cause line has to ask about the very same moment (utils/conditionCause) — a second literal
   * copy of this object is exactly how the legend and the pins drifted apart before.
   */
  const beachToneInput = (item: SuitableBeach): ConditionCauseInput => ({
    // getMapExposureLevel, unconditionally — the same call the pin itself makes at its icon
    // (see createExposureIcon's `mapExposureLevel` argument). This used to carry a ternary that
    // read `visibleExposureLevel` in wind mode, which is the mode the colour legend renders in:
    // so the counts came from the raw per-item field while every pin came from the union-find
    // consistency pass. The legend was built to be structurally unable to contradict the pins
    // and was quietly contradicting them on any beach where the two disagreed.
    exposureLevel: getMapExposureLevel(item),
    // Same per-beach wind the pin itself uses (beachBeaufort). While the user drags, the
    // scrubbed hour's region Beaufort stands in — the pins show that same approximation until
    // the drag is committed, so the two never disagree on screen.
    beaufort: beachBeaufort(item) ?? sliderDisplayBeaufort ?? 0,
    isEnclosedCove: Boolean(item.enclosedCove),
    seaStateM: seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS),
    offshoreFlatWater: beachOffshoreFlatWater(item),
    glassWaterAtFour: beachGlassWaterAtFour(item),
    downwindSeaSample: beachDownwindSeaSample(item),
    // Straight off the score — the pin, this legend count and the card chip all read the one
    // value calculateBeachScore computed, so none of them can rediscover it differently.
    seaArrivalExposureLevel: item.seaArrivalExposureLevel,
    // A beach the app refuses a swim at cannot be counted as ΙΔΑΝΙΚΗ or ΚΑΛΗ in the legend
    // beside it — the same ceiling the card chip takes (utils/suitabilityTone).
    swimVerdictAvoid: item.swimmingComfort === 'avoid_swimming',
    windSpeedKmh: beachWindSpeedKmh(item),
    // Straight off the score, όπως τα δύο από πάνω (utils/forecastUncertainty).
    forecastUncertain: item.forecastUncertain,
  });

  const beachConditionTone = (item: SuitableBeach): CalmnessTone => resolveConditionTone(beachToneInput(item));

  // Deliberately over EVERY beach on the map, never the filtered subset. The legend DOES collapse
  // to the picked row while a filter is on (see visibleWindColorGuideRows), but that is a display
  // choice made with an explicit way back. This tally must stay complete underneath it: computed
  // over the filtered set instead, every other colour would fall to zero, and the four rows would
  // come back empty — or not at all — when the filter cleared.
  //
  // `beachTonesById` stays COMPLETE — it is what onBeachTonesChange reports, and the "all
  // beaches" list needs a colour for beaches the directory never lists. Only the TALLY drops
  // `uncountedBeachIds` — since 23/08/2026 that is ONLY the policy-hidden set (naturist), so
  // the legend counts every pin the reader can see. The condition-excluded set
  // (`unrecommendedBeachIds`) is counted here and explains itself ON ITS OWN CARD
  // (utils/conditionToneLabels.cardNotRecommendedLabel) — never as a second line under this
  // chip, which is a GROUP surface and cost every reader height to answer a per-beach question
  // (Μίλτος, 24/08: «πολύ κείμενο … βάλ' τα μέσα στις κάρτες»). The fallback covers the
  // degenerate case where every pin is uncountable, which would otherwise leave `dominant`
  // undefined and put a calm blue slider thumb over a red map.
  const beachTonesById = beaches.map(item => ({ beachId: item.beachId, tone: beachConditionTone(item) }));
  const countedTones = beachTonesById.filter(e => !uncountedBeachIds?.has(e.beachId)).map(e => e.tone);
  const mapToneTally = tallyMapTones(countedTones.length ? countedTones : beachTonesById.map(e => e.tone));

  /**
   * WHAT PUT EACH COLOUR HERE, TODAY — the cause line, one per colour group, or nothing.
   *
   * «Όταν βλέπει πορτοκαλί θεωρεί ότι θα έχει πολύ κύμα» (Μίλτος, 15/08/2026). The colour is a
   * wind scale; the reader reads it as a wave scale. This asks the same beaches the tally counts
   * which of the two actually painted them, and lets the chip say so — on the days it has
   * something to say. The rules, the safety gates and the four wordings all live outside this
   * component (utils/conditionCause, utils/conditionToneLabels); nothing is decided here.
   *
   * TWO THINGS THIS LOOP OWNS, AND ONLY THESE TWO:
   *   • the same population as the tally — every beach on the map minus the uncounted ones, never
   *     the filtered subset, so the sentence describes what the chip's own number counts;
   *   • the repetition brake: walking CALMNESS_ORDER puts the ROUGHEST colour first, and a form
   *     already spoken is not repeated. On a Vai-class day orange and red have the identical
   *     story, and two identical lines under two chips read as a rendering bug.
   */
  const causeLineByTone = ((): Map<CalmnessTone, CauseLineWords> => {
    const readings = new Map<CalmnessTone, ConditionCauseReading[]>();
    beaches.forEach(item => {
      if (uncountedBeachIds?.has(item.beachId)) return;
      const reading = describeConditionCause(beachToneInput(item));
      const group = readings.get(reading.tone);
      if (group) group.push(reading);
      else readings.set(reading.tone, [reading]);
    });

    const lines = new Map<CalmnessTone, CauseLineWords>();
    const alreadySaid = new Set<CauseLineForm>();
    CALMNESS_ORDER.forEach(tone => {
      const group = readings.get(tone);
      if (!group?.length) return;
      const form = resolveCauseLineForm(group);
      if (!form || !causeLineMaySpeak(tone, form) || alreadySaid.has(form)) return;
      alreadySaid.add(form);
      lines.set(tone, causeLinePhrase(form, language, countCauseLineSplit(group)));
    });
    return lines;
  })();

  // Report the tally upward so the cards below the map can hide the same beaches the pins hide.
  // Keyed on a signature rather than the object, which is rebuilt on every render.
  //
  // Reported over `toneSourceBeaches` when the caller supplies it — the SAME expression
  // (beachConditionTone), just asked about every beach in the region rather than only the ones
  // the active chips left standing. Without it the table is silently self-referential: filter to
  // «Ξαπλώστρες» and the only beaches that have a colour at all are the ones with sunbeds.
  const reportedToneEntries = toneSourceBeaches
    ? toneSourceBeaches.map(item => ({ beachId: item.beachId, tone: beachConditionTone(item) }))
    : beachTonesById;
  const beachTonesSignature = reportedToneEntries.map(entry => `${entry.beachId}:${entry.tone}`).join(',');
  const beachTonesRef = useRef(reportedToneEntries);
  beachTonesRef.current = reportedToneEntries;
  useEffect(() => {
    if (!onBeachTonesChange) return;
    const record: Record<number, CalmnessTone> = {};
    beachTonesRef.current.forEach(entry => { record[entry.beachId] = entry.tone; });
    onBeachTonesChange(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beachTonesSignature, onBeachTonesChange]);

  /**
   * «ΗΡΕΜΟ ΝΕΡΟ» — ΠΟΙΕΣ ΠΑΡΑΛΙΕΣ, ΚΑΙ ΑΝ ΤΟ CHIP ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΥΠΑΡΞΕΙ (15/08/2026).
   *
   * Ίδιο `beachToneInput` με τις πινέζες και τη γραμμή αιτίας — ένα πέρασμα, μία ανάγνωση του
   * καιρού. Αν το App ξαναρωτούσε μόνο του «ποιο είναι το κύμα εδώ», θα ήταν δεύτερη γνώμη για
   * το ίδιο νερό, που είναι ακριβώς ο τρόπος με τον οποίο η λεζάντα και οι πινέζες είχαν
   * ξεκολλήσει παλιότερα.
   *
   * Πάνω στην ΠΛΗΡΗ δεξαμενή της περιοχής (`toneSourceBeaches`), όχι στα `beaches` που έχουν
   * ήδη περάσει από τα chips παροχών: αλλιώς το «Ήρεμο νερό 9» θα μετρούσε στην πραγματικότητα
   * «9 από όσες έχουν ξαπλώστρες». Ίδιος λόγος και ίδια πηγή με το `reportedToneEntries`.
   * Οι `uncountedBeachIds` ΚΑΙ οι `unrecommendedBeachIds` φεύγουν — το «Ήρεμο νερό» είναι
   * επιφάνεια ΠΡΟΣΦΟΡΑΣ, όχι περιγραφής: μια παραλία όπου λέμε «μην κολυμπήσεις» δεν
   * επιτρέπεται να προσφερθεί από ένα chip ηρεμίας, όσο ήρεμο κι αν είναι το νερό της
   * (απόγειος άνεμος που σε βγάζει ανοιχτά είναι ακριβώς αυτή η περίπτωση). Η λεζάντα από
   * 23/08/2026 τις ΜΕΤΡΑΕΙ — αυτή περιγράφει· εδώ προσφέρουμε.
   */
  const calmWaterSourceBeaches = toneSourceBeaches ?? beaches;
  const calmWaterState = ((): CalmWaterState => {
    const entries = calmWaterSourceBeaches
      .filter(item => !uncountedBeachIds?.has(item.beachId) && !unrecommendedBeachIds?.has(item.beachId))
      .map(item => ({ beachId: item.beachId, reading: describeConditionCause(beachToneInput(item)) }));
    return resolveCalmWaterState(entries);
  })();
  const calmWaterOffer = calmWaterState.status === 'offered' ? calmWaterState : null;
  const calmWaterSignature = calmWaterOffer
    ? `offered:${[...calmWaterOffer.beachIds].join(',')}`
    : `absent:${calmWaterState.status === 'absent' ? calmWaterState.reason : ''}`;
  const calmWaterStateRef = useRef(calmWaterState);
  calmWaterStateRef.current = calmWaterState;
  useEffect(() => {
    onCalmWaterStateChange?.(calmWaterStateRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calmWaterSignature, onCalmWaterStateChange]);

  // A tone the map no longer contains would leave an empty map with no way back, so an
  // orphaned filter is simply ignored.
  const activeToneFilter = toneFilter && (mapToneTally.counts.get(toneFilter) ?? 0) > 0 ? toneFilter : null;
  /**
   * Ίδια δικλείδα με το χρώμα, ένα βήμα πιο κάτω: ένα φίλτρο που η τωρινή ώρα δεν προσφέρει πια
   * αγνοείται αντί να αδειάσει τον χάρτη. Το App το σβήνει κιόλας — και το λέει — αλλά αυτό εδώ
   * φροντίζει να μη δει ποτέ κανείς άδειο χάρτη ούτε για ένα frame.
   */
  const isCalmWaterActive = Boolean(calmWaterFilter && calmWaterOffer);
  const calmWaterCopy = getLocalizedCopy(language, calmWaterFilterCopy);
  const markerBeaches = activeToneFilter
    ? beaches.filter(item => beachConditionTone(item) === activeToneFilter)
    : isCalmWaterActive
      // `calmWaterOffer` is non-null whenever isCalmWaterActive is true — the flag is built from it.
      ? beaches.filter(item => calmWaterOffer?.beachIds.has(item.beachId))
      : beaches;
  /**
   * Does this pin wear the enclosed-cove badge? One expression, read by the marker AND by the
   * legend cue, so the map can never show a badge the legend does not explain (or explain one
   * that is not on screen). The rule itself lives in utils/suitabilityTone.showsCoveBadge —
   * this only feeds it the same exposure and wind the pin's colour is built from.
   */
  const beachCoveBadge = (item: SuitableBeach): boolean => showsCoveBadge(
    Boolean(item.enclosedCove),
    getMapExposureLevel(item),
    beachBeaufort(item) ?? sliderDisplayBeaufort ?? 0
  );
  const sliderTone = windSliderTones[mapToneTally.dominant ?? 'blue'];
  const sliderThumbStyle: React.CSSProperties & Record<string, string> = {
    '--beach-map-hour-slider-thumb': sliderTone.color,
    '--beach-map-hour-slider-shadow': sliderTone.shadow,
    '--beach-map-hour-slider-focus': sliderTone.focus,
  };
  const selectedDayPrefix = getSelectedDayPrefix(selectedDate, athensNow(), language);
  const exposureLabel = (exposureLevel?: string) => {
    const labels = {
      protected: {
        en: `Sheltered ${selectedDayPrefix}`,
        gr: `Προστατευμένη ${selectedDayPrefix}`,
        de: `Geschützt ${selectedDayPrefix}`,
        it: `Riparata ${selectedDayPrefix}`,
        fr: `Abritée ${selectedDayPrefix}`,
      },
      partial: {
        en: { strong: 'Partial shelter', mild: 'Some wind' },
        gr: { strong: 'Μερική προστασία', mild: 'Λίγος αέρας' },
        de: { strong: 'Teilweise geschützt', mild: 'Etwas Wind' },
        it: { strong: 'Riparo parziale', mild: 'Un po’ di vento' },
        fr: { strong: 'Abri partiel', mild: 'Un peu de vent' },
      },
      exposed: {
        en: { strong: 'Exposed to wind', mild: 'A bit exposed' },
        gr: { strong: 'Εκτεθειμένη στον άνεμο', mild: 'Λίγο εκτεθειμένη' },
        de: { strong: 'Windexponiert', mild: 'Etwas exponiert' },
        it: { strong: 'Esposta al vento', mild: 'Un po’ esposta' },
        fr: { strong: 'Exposée au vent', mild: 'Un peu exposée' },
      },
    };
    const level = (exposureLevel || 'exposed') as keyof typeof labels;
    const beaufort = typeof windBeaufort === 'number' ? windBeaufort : 4;
    if (level === 'protected') return labels.protected[language];
    const copy = labels[level][language];
    return beaufort >= 5 ? copy.strong : copy.mild;
  };
  const groupedExposureLabel = (exposureLevel: 'protected' | 'exposed') => {
    const labels = {
      protected: {
        en: 'More sheltered',
        gr: 'Πιο προστατευμένες',
        de: 'Geschützter',
        it: 'Più riparate',
        fr: 'Plus abritées',
      },
      exposed: {
        en: 'More exposed',
        gr: 'Πιο εκτεθειμένες',
        de: 'Stärker exponiert',
        it: 'Più esposte',
        fr: 'Plus exposées',
      },
    };

    return labels[exposureLevel][language];
  };
  const mapCopy = {
    recommendationMode: { en: 'Recommendation Mode', gr: 'Προτάσεις', de: 'Empfehlungen', it: 'Consigli', fr: 'Recommandations' },
    recommendationShort: { en: 'Best', gr: 'Προτάσεις', de: 'Top', it: 'Top', fr: 'Top' },
    windMode: { en: 'Wind Protection Mode', gr: 'Προστασία από άνεμο', de: 'Windschutz', it: 'Protezione dal vento', fr: 'Protection du vent' },
    windShort: { en: 'Wind', gr: 'Άνεμος', de: 'Wind', it: 'Vento', fr: 'Vent' },
    youAreHere: { en: 'You are here', gr: 'Είστε εδώ', de: 'Sie sind hier', it: 'Sei qui', fr: 'Vous êtes ici' },
    openBeach: { en: 'Open this beach', gr: 'Δες την παραλία', de: 'Strand ansehen', it: 'Vedi la spiaggia', fr: 'Voir la plage' },
    toneScaleWhat: { en: 'What do the colours mean?', gr: 'Τι σημαίνουν τα χρώματα;', de: 'Was bedeuten die Farben?', it: 'Cosa significano i colori?', fr: 'Que signifient les couleurs ?' },
    toneScaleHint: {
      // Δεύτερη φορά «παραλία» στην ίδια εξήγηση διαβαζόταν σαν επανάληψη — η πινέζα λέει
      // το ίδιο πράγμα και δείχνει ΠΟΥ να πατήσει ο αναγνώστης για τα δύο χωριστά νούμερα.
      en: 'The colour shows how good the beach is overall. Wind and sea are shown separately on each pin.',
      gr: 'Το χρώμα δείχνει πόσο καλή είναι συνολικά η παραλία. Ο αέρας και η θάλασσα φαίνονται χωριστά σε κάθε πινέζα.',
      de: 'Die Farbe zeigt, wie gut der Strand insgesamt ist. Wind und See stehen bei jeder Markierung getrennt.',
      it: 'Il colore mostra quanto è buona la spiaggia nel complesso. Vento e mare sono indicati separatamente su ogni segnaposto.',
      fr: 'La couleur indique la qualité globale de la plage. Le vent et la mer sont indiqués séparément sur chaque repère.',
    },
    resetView: { en: 'Reset view', gr: 'Επαναφορά θέασης', de: 'Ansicht zurücksetzen', it: 'Ripristina vista', fr: 'Réinitialiser la vue' },
    centerOnMe: { en: 'Center on my location', gr: 'Κέντραρε στη θέση μου', de: 'Auf meinen Standort zentrieren', it: 'Centra sulla mia posizione', fr: 'Centrer sur ma position' },
    showSatelliteView: { en: 'Satellite view', gr: 'Δορυφορική προβολή', de: 'Satellitenansicht', it: 'Vista satellitare', fr: 'Vue satellite' },
    showMapView: { en: 'Map view', gr: 'Προβολή χάρτη', de: 'Kartenansicht', it: 'Vista mappa', fr: 'Vue carte' },
    campingToggle: { en: 'Camping', gr: 'Camping', de: 'Camping', it: 'Campeggi', fr: 'Camping' },
    bestTime: { en: 'Best Time', gr: 'Καλύτερη ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    view: { en: 'View', gr: 'Προβολή', de: 'Ansehen', it: 'Vedi', fr: 'Voir' },
    navigate: { en: 'Navigate', gr: 'Πλοήγηση', de: 'Route', it: 'Naviga', fr: 'Itinéraire' },
    closeDetails: { en: 'Close beach details', gr: 'Κλείσιμο λεπτομερειών παραλίας', de: 'Stranddetails schließen', it: 'Chiudi dettagli spiaggia', fr: 'Fermer les détails de la plage' },
    stayLabel: { en: 'Staying', gr: 'Θα μείνω', de: 'Aufenthalt', it: 'Mi fermo', fr: 'Je reste' },
    stayNow: { en: 'Now', gr: 'Τώρα', de: 'Jetzt', it: 'Ora', fr: 'Maintenant' },
    stay2h: { en: '2 hours', gr: '2 ώρες', de: '2 Stunden', it: '2 ore', fr: '2 heures' },
    stay4h: { en: 'Half a day', gr: 'Μισή μέρα', de: 'Halber Tag', it: 'Mezza giornata', fr: 'Une demi-journée' },
    stay8h: { en: 'All day', gr: 'Όλη μέρα', de: 'Ganzer Tag', it: 'Tutto il giorno', fr: 'Toute la journée' },
    stayHint: {
      en: 'Beaches are judged by the roughest hour you would be there, not by right now',
      gr: 'Οι παραλίες κρίνονται από τη χειρότερη ώρα που θα είσαι εκεί, όχι από τώρα',
      de: 'Strände werden nach der rauesten Stunde Ihres Aufenthalts bewertet, nicht nach jetzt',
      it: 'Le spiagge sono valutate sull’ora peggiore della tua permanenza, non su adesso',
      fr: 'Les plages sont jugées sur l’heure la plus agitée de votre séjour, pas sur maintenant',
    },
    suitability: {
      en: `Recommendation ${selectedDayPrefix}`,
      gr: `Πρόταση για ${selectedDayPrefix}`,
      de: 'Empfehlung',
      it: 'Consiglio',
      fr: 'Recommendation',
    },
    excellent: { en: 'More sheltered + high score', gr: 'Πιο προστατευμένη + υψηλό σκορ', de: 'Besserer Schutz + hoher Wert', it: 'Più riparata + punteggio alto', fr: 'Mieux abritée + score élevé' },
    good: { en: 'Partial or good fallback', gr: 'Μερική ή εναλλακτική επιλογή', de: 'Teilweise oder Alternative', it: 'Parziale o alternativa', fr: 'Partielle ou alternative' },
    notRecommended: { en: 'Exposed or low score', gr: 'Εκτεθειμένη στον άνεμο ή χαμηλό σκορ', de: 'Windoffen oder niedriger Wert', it: 'Esposta o punteggio basso', fr: 'Exposée ou score bas' },
    exposure: { en: 'Wind shelter by beach', gr: 'Προστασία ανά παραλία', de: 'Windexposition je Strand', it: 'Esposizione per spiaggia', fr: 'Exposition par plage' },
    excellentCalm: {
      en: `High score ${selectedDayPrefix}`,
      gr: `Υψηλό σκορ ${selectedDayPrefix}`,
      de: 'Hoher Wert',
      it: 'Punteggio alto',
      fr: 'Score élevé',
    },
    calmWind: {
      en: `Light wind ${selectedDayPrefix}`,
      gr: `Ήπιος άνεμος ${selectedDayPrefix}`,
      de: 'Leichter Wind',
      it: 'Vento leggero',
      fr: 'Vent léger',
    },
    calmWindNote: { en: 'Wind exposure is not a major factor right now', gr: 'Η έκθεση στον άνεμο δεν επηρεάζει σημαντικά τώρα', de: 'Windexposition ist gerade kein wichtiger Faktor', it: 'L’esposizione al vento ora conta poco', fr: 'L’exposition au vent compte peu maintenant' },
    current: { en: 'Current', gr: 'Τώρα', de: 'Aktuell', it: 'Ora', fr: 'Actuel' },
    at: { en: 'at', gr: 'στα', de: 'bei', it: 'a', fr: 'à' },
    beaufort: { en: 'Bft', gr: 'μποφόρ', de: 'Bft', it: 'Bft', fr: 'Bft' },
  };
  const exposureInsightCopy = getLocalizedCopy<{
    fallbackWind: string;
    calm: string;
    severe: string;
    protected: (wind: string) => string;
    partial: (wind: string) => string;
    exposed: (wind: string) => string;
    localShapeNote: string;
    evidence: Record<MapExposureEvidence, string>;
  }>(language, {
    en: {
      fallbackWind: "Today's wind",
      calm: 'Light wind today; exposure is not a major factor.',
      severe: 'Strong wind affects every beach today; use the colours as caution, not a safety guarantee.',
      protected: (wind) => `${wind} is less direct here because of the shore angle or nearby land, so this beach should feel more manageable.`,
      partial: (wind) => `${wind} reaches this beach from the side or with limited open water, so expect some wind or chop.`,
      exposed: (wind) => `${wind} lines up more directly with this shore or has more open water to build chop.`,
      localShapeNote: 'Nearby beaches can differ because each cove, headland and shore angle catches the same wind differently.',
      evidence: { supported: 'Stronger evidence', estimated: 'Map estimate' },
    },
    gr: {
      fallbackWind: 'Ο σημερινός άνεμος',
      calm: 'Ήπιος άνεμος σήμερα· η έκθεση δεν είναι βασικός παράγοντας.',
      severe: 'Δυνατός άνεμος επηρεάζει όλες τις παραλίες σήμερα· τα χρώματα είναι ένδειξη προσοχής, όχι εγγύηση ασφάλειας.',
      protected: (wind) => `${wind} άνεμος δεν μπαίνει τόσο άμεσα εδώ λόγω γωνίας ακτής ή κοντινής στεριάς, άρα δείχνει πιο διαχειρίσιμη.`,
      partial: (wind) => `${wind} άνεμος πιάνει πιο πλάγια ή με περιορισμένο ανοιχτό νερό, άρα μπορεί να έχει λίγο αέρα ή κυματάκι.`,
      exposed: (wind) => `${wind} άνεμος ταιριάζει πιο άμεσα με αυτή την ακτή ή έχει περισσότερο ανοιχτό νερό μπροστά, άρα περίμενε περισσότερο αέρα ή κυματάκι.`,
      localShapeNote: 'Κοντινές παραλίες μπορεί να διαφέρουν, γιατί κάθε κόλπος, κάβος και γωνία ακτής πιάνει αλλιώς τον ίδιο άνεμο.',
      evidence: { supported: 'Ισχυρότερη ένδειξη', estimated: 'Εκτίμηση χάρτη' },
    },
    fr: {
      fallbackWind: "Vent d’aujourd’hui",
      calm: "Vent faible aujourd’hui; l’exposition compte peu.",
      severe: "Vent fort sur toutes les plages aujourd’hui; les couleurs indiquent la prudence, pas une garantie.",
      protected: (wind) => `${wind} arrive moins directement ici grâce à l’angle de côte ou la terre proche; cette plage devrait être plus gérable.`,
      partial: (wind) => `${wind} peut arriver de côté ou avec peu d’eau ouverte; attendez un peu de vent ou de clapot.`,
      exposed: (wind) => `${wind} arrive plus directement sur cette côte ou avec plus d’eau ouverte pour former du clapot.`,
      localShapeNote: "Deux plages proches peuvent différer: chaque crique, cap et angle de côte prend le même vent autrement.",
      evidence: { supported: 'Indice plus fort', estimated: 'Estimation carte' },
    },
    de: {
      fallbackWind: 'Heutiger Wind',
      calm: 'Heute leichter Wind; Exposition ist kein Hauptfaktor.',
      severe: 'Starker Wind betrifft heute alle Strände; Farben bedeuten Vorsicht, keine Garantie.',
      protected: (wind) => `${wind} trifft hier wegen Küstenwinkel oder naher Landmasse weniger direkt; dieser Strand wirkt besser handhabbar.`,
      partial: (wind) => `${wind} kann seitlich oder mit begrenztem offenem Wasser ankommen; etwas Wind oder Kabbelwasser möglich.`,
      exposed: (wind) => `${wind} passt direkter zu dieser Küste oder hat mehr offenes Wasser, um Kabbelwasser aufzubauen.`,
      localShapeNote: 'Nahe Strände können sich unterscheiden, weil Bucht, Kap und Küstenwinkel denselben Wind anders aufnehmen.',
      evidence: { supported: 'Stärkerer Hinweis', estimated: 'Kartenschätzung' },
    },
    it: {
      fallbackWind: 'Vento di oggi',
      calm: "Vento debole oggi; l’esposizione conta poco.",
      severe: 'Vento forte su tutte le spiagge oggi; i colori indicano prudenza, non una garanzia.',
      protected: (wind) => `${wind} arriva meno diretto qui grazie all’angolo della costa o alla terra vicina; questa spiaggia dovrebbe essere più gestibile.`,
      partial: (wind) => `${wind} può arrivare di lato o con poca acqua aperta; aspettati un po’ di vento o chop.`,
      exposed: (wind) => `${wind} arriva più diretto su questa costa o ha più acqua aperta per creare chop.`,
      localShapeNote: 'Spiagge vicine possono differire: ogni baia, capo e angolo di costa prende lo stesso vento in modo diverso.',
      evidence: { supported: 'Indicazione più forte', estimated: 'Stima mappa' },
    },
  });
  const getMapExposureReason = (exposureLevel?: string): string => {
    if (!showWindExposureStatusLabels) return exposureInsightCopy.calm;
    if (typeof windBeaufort === 'number' && windBeaufort >= 7) return exposureInsightCopy.severe;

    const wind = localizedWindDirection || exposureInsightCopy.fallbackWind;
    if (exposureLevel === 'protected') return exposureInsightCopy.protected(wind);
    if (exposureLevel === 'exposed') return exposureInsightCopy.exposed(wind);
    return exposureInsightCopy.partial(wind);
  };
  /**
   * THE LEGEND COUNTS THE PINS. IT DOES NOT DESCRIBE RULES.
   *
   * It used to be five hard-coded rows keyed by Beaufort ("4 Bft — Good / Fair"), of which
   * exactly one was shown, chosen from the wind alone. Two things were wrong with that:
   *
   *   1. It was BLIND TO THE SEA. The swatches called getExposureMarkerTone without the
   *      `isEnclosedCove` and `seaStateM` arguments that every real pin passes, so a legend row
   *      could not physically show a colour the sea had caused. Measured against the real ladder:
   *      at 3 Bft the possible pin colours are blue/yellow/orange/RED and at 4 Bft they are
   *      yellow/orange/RED — and the legend mentioned red in neither. It was wrong on two of its
   *      three everyday rows.
   *   2. Its premise had expired. Keying the guide to Beaufort assumes the wind decides the
   *      colour; since the sea-state ceiling landed (01/08) it does not.
   *
   * Miltos ruled that the legend and the pins may never disagree. The way to guarantee that is
   * not to write better rules — it is to stop describing and start MEASURING: the rows below are
   * generated from the tones of the beaches actually on the map, through the same
   * resolveConditionTone the pins use. A colour with no beaches does not appear; a colour with
   * beaches cannot be omitted. As a bonus it answers a better question than the old table did —
   * not "what would 4 Bft mean" but "how many choices do I have right now".
   */
  // The colour words live in utils/conditionToneLabels.ts rather than inline here, so the gate
  // (validateConditionToneAgreement) can read the real table and fail on an empty or missing word
  // in any of the five languages — a coloured pin the legend cannot explain.
  const toneWords = conditionToneLabels[language] ?? conditionToneLabels.en;
  const windColorGuideCopy = getLocalizedCopy<{
    /** Spoken colour name; aria-label/title only, never rendered as text. */
    colorName: Record<WindLegendDot, string>;
    /** Replaces the counted rows at >=7 Bft, where the wind alone makes every pin red. */
    severeLabel: string;
    severeColorName: string;
  }>(language, {
    en: {
      colorName: { blue: 'blue', yellow: 'yellow', orange: 'orange', red: 'red' },
      severeLabel: 'Unsuitable', severeColorName: 'danger',
    },
    gr: {
      colorName: { blue: 'μπλε', yellow: 'κίτρινο', orange: 'πορτοκαλί', red: 'κόκκινο' },
      severeLabel: 'Ακατάλληλη', severeColorName: 'κίνδυνος',
    },
    fr: {
      colorName: { blue: 'bleu', yellow: 'jaune', orange: 'orange', red: 'rouge' },
      severeLabel: 'Déconseillée', severeColorName: 'danger',
    },
    de: {
      colorName: { blue: 'blau', yellow: 'gelb', orange: 'orange', red: 'rot' },
      severeLabel: 'Ungeeignet', severeColorName: 'danger',
    },
    it: {
      colorName: { blue: 'blu', yellow: 'giallo', orange: 'arancione', red: 'rosso' },
      severeLabel: 'Non adatta', severeColorName: 'danger',
    },
  });

  /**
   * REGION MAPS NO LONGER DRAW CAMPSITES (02/08/2026).
   *
   * The overview map used to derive a tent pin from every beach's `nearbyCamping` and scatter
   * them across the region. On a coast like Evia that is dozens of tents mixed in among the
   * condition pins, and they compete for attention with the only thing this map exists to say —
   * which water is calm today. Miltos: «έχουμε γεμίσει χρώματα στους χάρτες». The information is
   * not lost; it is on the beach's own card and page, where it is attached to a beach the reader
   * has already chosen.
   *
   * The DETAIL map still shows the campsites it is explicitly handed, because there it is one
   * beach's own surroundings rather than a region-wide scatter.
   */
  const renderedCampsites = campsites ?? [];

  // Calculate average center of all beaches if they exist
  let avgCenter: [number, number] | null = null;
  if (beaches.length > 0) {
    const sumLat = beaches.reduce((sum, b) => sum + b.beach.coordinates.lat, 0);
    const sumLon = beaches.reduce((sum, b) => sum + b.beach.coordinates.lon, 0);
    avgCenter = [sumLat / beaches.length, sumLon / beaches.length];
  }

  // Default center (Greece) if no user location
  const defaultCenter: [number, number] = [38.0, 24.0];
  
  const center: [number, number] = propCenter || (avgCenter || (userLocation 
    ? [userLocation.lat, userLocation.lon] 
    : defaultCenter));
  
  const zoom = propZoom || (avgCenter ? 10 : (userLocation ? 10 : 6));

  // The "home" button snaps to the user's own location when we have a GPS fix,
  // zoomed in to a comfortable local view; otherwise it falls back to the region's
  // default framing. Labelled accordingly.
  const homeCenter: [number, number] = userLocation ? [userLocation.lat, userLocation.lon] : center;
  const homeZoom = userLocation ? 13 : zoom;
  const homeTitle = (userLocation ? mapCopy.centerOnMe : mapCopy.resetView)[language];
  const basemapTitle = (basemap === 'satellite' ? mapCopy.showMapView : mapCopy.showSatelliteView)[language];
  const toggleBasemap = () => {
    setBasemap((current) => {
      const next: BasemapId = current === 'satellite' ? 'map' : 'satellite';
      try {
        window.localStorage.setItem(BASEMAP_STORAGE_KEY, next);
      } catch {
        // Private mode / storage disabled: the choice just doesn't persist.
      }
      trackEvent('map_basemap_toggle', undefined, { basemap: next });
      return next;
    });
  };

  const viewportGuardrails = useMemo(() => {
    const fallbackCenter = { lat: center[0], lon: center[1] };
    // Derive the zoom-out floor and pan bounds from the full region set when provided,
    // so narrowing the visible pins (e.g. a name search resolving to one beach) never
    // collapses the span to a point and traps the user fully zoomed in.
    const guardrailSource = guardrailBeaches && guardrailBeaches.length > 0
      ? guardrailBeaches
      : beaches;
    const points = guardrailSource
      .map(item => getBeachMapCoordinates(item.beach, fallbackCenter))
      .filter(coordinate => (
        Number.isFinite(coordinate.lat) &&
        Number.isFinite(coordinate.lon)
      ));

    if (points.length === 0) {
      return {
        minZoom: userLocation ? 6 : 5,
        maxBounds: undefined as L.LatLngBounds | undefined,
        islandBounds: undefined as L.LatLngBounds | undefined,
      };
    }

    const lats = points.map(point => point.lat);
    const lons = points.map(point => point.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latSpan = Math.max(maxLat - minLat, 0.02);
    const lonSpan = Math.max(maxLon - minLon, 0.02);
    const maxSpan = Math.max(latSpan, lonSpan);

    const minZoom = maxSpan <= 0.35
      ? 10
      : maxSpan <= 0.9
        ? 9
        : maxSpan <= 1.8
          ? 8
          : maxSpan <= 3.5
            ? 7
            : 6;

    const latPadding = Math.min(Math.max(latSpan * 0.8, 0.12), 1.25);
    const lonPadding = Math.min(Math.max(lonSpan * 0.8, 0.12), 1.25);

    return {
      minZoom,
      maxBounds: L.latLngBounds(
        [minLat - latPadding, minLon - lonPadding],
        [maxLat + latPadding, maxLon + lonPadding],
      ),
      // Island extent (with the same small-span floor as above) used to cap
      // zoom-out so the island fills the frame on wide desktop viewports instead
      // of floating in empty sea. Centered + floored so a single-beach region
      // doesn't collapse to a point and force an over-zoomed minimum.
      islandBounds: L.latLngBounds(
        [(minLat + maxLat) / 2 - latSpan / 2, (minLon + maxLon) / 2 - lonSpan / 2],
        [(minLat + maxLat) / 2 + latSpan / 2, (minLon + maxLon) / 2 + lonSpan / 2],
      ),
    };
  }, [beaches, guardrailBeaches, center, userLocation]);
  const labelZoomThreshold = compact ? 13 : 12;
  const selectedBeach = selectedBeachId !== null
    ? beaches.find(item => item.beachId === selectedBeachId)
    : null;
  const hoveredBeach = hoveredBeachId !== null
    ? beaches.find(item => item.beachId === hoveredBeachId)
    : null;
  const hoverPreviewPhotoUrl = useMemo(() => {
    if (!hoveredBeach) return null;
    const lookupIslandName = islandName || hoveredBeach.beach.location?.island || hoveredBeach.beach.location?.region;
    const lookup = getBeachPhotoLookup(
      hoveredBeach.beach.name.gr,
      hoveredBeach.beach.name.en,
      hoveredBeach.beach.id,
      1,
      lookupIslandName
    );
    return lookup.source === 'exact' ? lookup.photos[0] ?? null : null;
  }, [hoveredBeach, islandName]);
  const hoverPreviewFeatureChips = useMemo(
    () => hoveredBeach ? buildHoverPreviewFeatureChips(hoveredBeach.beach, language) : [],
    [hoveredBeach, language]
  );
  // Local wind for the hovered beach: its own cluster forecast if available, else
  // the island wind — so the hover explains a beach coloured against the headline.
  const hoverLocalWind = useMemo(() => {
    if (!hoveredBeach) return undefined;
    const perBeach = beachLocalWinds?.[hoveredBeach.beach.id];
    if (perBeach) return perBeach;
    if (typeof mapWindDirectionDeg === 'number' && typeof windSpeedKmh === 'number') {
      return { deg: mapWindDirectionDeg, speedKmh: windSpeedKmh };
    }
    return undefined;
  }, [hoveredBeach, beachLocalWinds, mapWindDirectionDeg, windSpeedKmh]);
  const hoverLocalWindLabel = hoverLocalWind
    ? (directionShortLabels[language]?.[degToCompass(hoverLocalWind.deg)] || degToCompass(hoverLocalWind.deg))
    : undefined;
  const isCompactPreview = compact && preview;
  const beachLabelOpacityLevel = Math.max(0, Math.min(10, Math.round(beachLabelOpacity * 10)));

  useEffect(() => {
    trackEvent('map_viewed', undefined, {
      locale: languageToLocale(language),
      source: compact ? 'detail_map' : preview ? 'home_map_preview' : 'full_map',
      beach_count: beaches.length,
    });
  }, [beaches.length, compact, language, preview]);

  useEffect(() => {
    if (selectedBeachId !== null && !beaches.some(item => item.beachId === selectedBeachId)) {
      setSelectedBeachId(null);
    }
  }, [beaches, selectedBeachId]);

  useEffect(() => {
    if (hoveredBeachId !== null && !beaches.some(item => item.beachId === hoveredBeachId)) {
      setHoveredBeachId(null);
      setHoverPreviewPosition(null);
    }
  }, [beaches, hoveredBeachId]);

  const detachMarkerLeaveHandler = () => {
    if (hoveredMarkerElementRef.current && markerLeaveHandlerRef.current) {
      hoveredMarkerElementRef.current.removeEventListener('pointerleave', markerLeaveHandlerRef.current);
      hoveredMarkerElementRef.current.removeEventListener('mouseleave', markerLeaveHandlerRef.current);
    }
    hoveredMarkerElementRef.current = null;
    markerLeaveHandlerRef.current = null;
  };

  useEffect(() => detachMarkerLeaveHandler, []);

  const clearMarkerHover = (beachId?: number) => {
    detachMarkerLeaveHandler();
    setHoveredBeachId(current => (
      typeof beachId === 'number' && current !== beachId ? current : null
    ));
    setHoverPreviewPosition(null);
  };

  const handleMarkerHover = (event: L.LeafletMouseEvent, beachId: number) => {
    const nextPosition = {
      x: event.containerPoint.x,
      y: event.containerPoint.y,
    };
    const markerElement = (event.target as L.Marker | undefined)?.getElement?.();

    if (markerElement && hoveredMarkerElementRef.current !== markerElement) {
      detachMarkerLeaveHandler();
      const handleNativeMarkerLeave = () => clearMarkerHover(beachId);
      markerElement.addEventListener('pointerleave', handleNativeMarkerLeave);
      markerElement.addEventListener('mouseleave', handleNativeMarkerLeave);
      hoveredMarkerElementRef.current = markerElement;
      markerLeaveHandlerRef.current = handleNativeMarkerLeave;
    }

    setHoveredBeachId(beachId);
    setHoverPreviewPosition(current => (
      current &&
      Math.abs(current.x - nextPosition.x) < 1 &&
      Math.abs(current.y - nextPosition.y) < 1
        ? current
        : nextPosition
    ));
  };

  const handleMarkerHoverEnd = (beachId: number) => {
    clearMarkerHover(beachId);
  };

  const renderBeachInfo = (item: SuitableBeach, variant: 'popup' | 'panel') => {
    const isPanel = variant === 'panel';
    const exposureLevel = mapMode === 'wind'
      ? getMapExposureLevel(item)
      : visibleExposureLevel(item);
    // Same sea ceiling as the marker itself: this badge is what the user sees when they tap that
    // pin, so a yellow pin opening a blue badge would be the pin/word divergence all over again.
    // Same per-beach wind and the same two offshore flags too (10/08/2026): the badge used to sit
    // on the REGION Beaufort with neither flag, so a downwind-relieved yellow pin opened an
    // orange badge — the exact divergence the comment above exists to forbid, one surface later.
    const exposureTone = getExposureMarkerTone(
      exposureLevel,
      showWindExposureColors,
      beachBeaufort(item) ?? windBeaufort,
      Boolean(item.enclosedCove),
      seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS),
      beachOffshoreFlatWater(item),
      beachGlassWaterAtFour(item),
      beachDownwindSeaSample(item),
      item.swimmingComfort === 'avoid_swimming'
    );
    const exposureReason = getMapExposureReason(exposureLevel);
    const badge = mapMode === 'recommendation' ? (
      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${getRecommendationTone(item, showRecommendationWindColors).badgeClass}`}>
        {item.score}%
      </span>
    ) : (
        <span className={`inline-flex min-w-0 shrink items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${exposureTone.bgClass} ${exposureTone.textClass}`}>
        <Wind className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {showWindExposureColors && showWindExposureStatusLabels ? exposureLabel(exposureLevel) : mapCopy.calmWind[language]}
        </span>
      </span>
    );
    const handleNavigationClick = () => {
      if (!canOpenNavigation(item.beach)) {
        return;
      }

      trackEvent('navigation_clicked', item.beach.id, {
        locale: languageToLocale(language),
        source: compact ? 'detail_map' : preview ? 'home_map_preview' : 'full_map',
        map_mode: mapMode,
        beach_name: item.beach.name.en,
        ...buildBeachExposureParams(item.beach, item.simpleWindSuitability?.exposureStatus),
      });
      openNavigation(item.beach);
    };
    const canNavigate = canOpenNavigation(item.beach);
    // Map popup/pin buttons are tiny; surface the badge reason via the button title rather than a
    // visible pill that would overflow the marker callout.
    const navBadge = getNavigationBadge(item.beach);
    const navBadgeLabel = navBadge
      ? (translations[language ?? 'en'] ?? translations.en).navigationBadge[
          navBadge === 'boat-access' ? 'boatAccess' : navBadge === 'nav-unavailable' ? 'unavailable' : 'unverified'
        ]
      : undefined;

    return (
      <div className={isPanel ? 'space-y-2.5' : 'min-w-[200px] p-1'}>
        <div className={`flex min-w-0 items-start justify-between gap-2 ${isPanel ? 'pr-9' : ''}`}>
          <h3 className={`${isPanel ? 'text-base' : 'text-sm'} min-w-0 flex-1 break-words font-black leading-tight text-slate-900`}>
            {item.name}
          </h3>
          {badge}
        </div>

        <p className={`${isPanel ? 'max-h-24 overflow-y-auto pr-1 text-[13px]' : 'line-clamp-3 text-xs'} leading-snug text-slate-600`}>
          {item.explanation}
        </p>

        {mapMode === 'wind' && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-slate-600">
            <div className="flex items-start gap-1.5">
              <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-700" />
              <span>{exposureReason}</span>
            </div>
            {showWindExposureColors && showWindExposureStatusLabels && (
              <p className="mt-1.5 border-t border-slate-200/80 pt-1.5 text-[10px] font-semibold leading-snug text-slate-700">
                {exposureInsightCopy.localShapeNote}
              </p>
            )}
          </div>
        )}

        {item.bestBeachTime && (
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-2.5 py-2">
            <div className="flex items-start gap-1.5 text-[11px] font-black leading-snug text-cyan-700">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {mapCopy.bestTime[language]}: {item.bestBeachTime.bestStart} - {item.bestBeachTime.bestEnd}
              </span>
            </div>
          </div>
        )}

        {(() => {
          const paidEntry = item.beach.paidEntry ?? item.beach.metadata?.paidEntry;
          if (!paidEntry) return null;
          const Icon = paidEntry.kind === 'entrance_fee' ? Ticket : Euro;
          return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2">
              <div className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-800">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  <span className="font-black">{localizedPaidEntryLabel(paidEntry.kind, language)}</span>
                  {' — '}
                  {localizedPaidEntryExplanation(paidEntry.kind, language)}
                </span>
              </div>
            </div>
          );
        })()}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          {item.distance !== undefined ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-slate-700">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{item.distance.toFixed(1)} km</span>
            </span>
          ) : (
            <span />
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            {canNavigate && (
              <button
                type="button"
                onClick={handleNavigationClick}
                aria-label={navBadgeLabel ? `${mapCopy.navigate[language]} — ${navBadgeLabel}` : mapCopy.navigate[language]}
                title={navBadgeLabel ? `${mapCopy.navigate[language]} — ${navBadgeLabel}` : mapCopy.navigate[language]}
                className={`${isPanel ? 'min-h-10 px-3' : 'h-8 w-8 px-0'} inline-flex items-center justify-center gap-1 rounded-xl border border-cyan-100 bg-cyan-50 text-xs font-black text-cyan-700 transition-colors hover:border-cyan-200 hover:bg-cyan-100 cursor-pointer`}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span className={isPanel ? '' : 'sr-only'}>{mapCopy.navigate[language]}</span>
              </button>
            )}

            {onBeachClick && (
              <button
                type="button"
                onClick={() => onBeachClick(item.beach)}
                className={`${isPanel ? 'min-h-10 px-3' : 'px-2 py-1'} inline-flex items-center justify-center gap-1 rounded-xl bg-cyan-600 text-xs font-black text-white transition-colors hover:bg-cyan-700 cursor-pointer`}
              >
                <Info className="h-3.5 w-3.5" />
                {mapCopy.view[language]}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // The two grouped swatches ("more sheltered" / "more exposed") used to call
  // getExposureMarkerTone with NO sea argument, so they could print a colour the map did not
  // contain. They now carry the median sea of the beaches in each group — the colour those
  // beaches are actually wearing right now.
  const medianSeaOfGroup = (wanted: 'protected' | 'exposed'): number | undefined => {
    const seas = beaches
      // Same unconditional getMapExposureLevel as beachConditionTone above — grouping the
      // swatches by one exposure rule while colouring the pins by another put a median sea
      // from the wrong set of beaches into the swatch.
      .filter(item => getMapExposureLevel(item) === wanted)
      .map(item => seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS))
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .sort((a, b) => a - b);
    return seas.length ? seas[Math.floor(seas.length / 2)] : undefined;
  };
  const protectedTone = getExposureMarkerTone('protected', showWindExposureColors, windBeaufort, false, medianSeaOfGroup('protected'));
  const exposedTone = getExposureMarkerTone('exposed', showWindExposureColors, windBeaufort, false, medianSeaOfGroup('exposed'));

  const isSevereWind = typeof windBeaufort === 'number' && windBeaufort >= 7;
  /**
   * Η άδεια εμφάνισης του κουμπιού «Ήρεμο νερό» ζει ΕΔΩ, όχι μέσα στον renderer της λεζάντας: το
   * κουμπί μετακόμισε στη γραμμή του τίτλου της μπάρας ώρας (15/08/2026, εντολή Μίλτου «top
   * filter με εικονίδιο, χωρίς να σπρώχνει τις κάρτες»), που είναι άλλο υποδέντρο του component.
   *
   * `!isSevereWind` γιατί στα ≥7 Μποφόρ δεν υπάρχει λεζάντα με μετρημένα χρώματα — υπάρχει μία
   * γραμμή «ακατάλληλες» — και ένα κουμπί που προτείνει παραλίες δίπλα της θα την αντέφασκε.
   */
  /**
   * ΔΙΑΚΟΠΤΗΣ ΕΜΦΑΝΙΣΗΣ ΤΟΥ «ΗΡΕΜΟ ΝΕΡΟ» — ΣΒΗΣΤΟΣ ΜΕΧΡΙ ΝΑ ΤΟ ΔΕΙ Ο ΜΙΛΤΟΣ (15/08/2026).
   *
   * Εντολή: «βγάλε live όλες τις αλλαγές εκτός από το κουμπί ήρεμο νερό, αυτό θα το ξαναδώ».
   * Το §Γ16 ήταν δεμένο στο ΙΔΙΟ commit με τα §Γ13/§Γ14/§Γ15, σε κοινά αρχεία — ξήλωμα θα
   * ακουμπούσε πέντε αρχεία ξένης δουλειάς για να κρύψει ένα κουμπί.
   *
   * Γι' αυτό σβήνει ΜΟΝΟ Η ΕΜΦΑΝΙΣΗ, εδώ, με μία σταθερά. Ο κανόνας, οι δύο πύλες ασφαλείας και
   * ολόκληρο το `utils/calmWaterFilter` μένουν άθικτα και οι πύλες τους πράσινες — το φίλτρο
   * απλώς δεν προσφέρεται ποτέ στην οθόνη. **Για να ανάψει ξανά: `true`, τίποτα άλλο.**
   */
  const CALM_WATER_CHIP_ENABLED = false;
  const canOfferCalmWater = CALM_WATER_CHIP_ENABLED
    && Boolean(onCalmWaterFilterChange) && !isSevereWind && calmWaterOffer !== null;
  /**
   * One row per colour that is ACTUALLY on the map, roughest first, each with its count. A colour
   * nobody is wearing does not appear; a colour somebody is wearing cannot be left out. This is
   * what makes the legend structurally unable to contradict the pins — see tallyMapTones.
   */
  // Calmest first (LEGEND_TONE_ORDER), NOT CALMNESS_ORDER — that one is the severity scale the
  // sea-state ceiling and the dominant-tone scan depend on, and it runs the other way.
  //
  // WITH A FILTER ON, THE OTHER ROWS GO AWAY (02/08/2026). Each row is two lines — the colour with
  // its count, and the sentence that separates «Μέτρια» from «Καλή» — so four colours cost eight
  // lines of vertical space directly above the beach cards. Miltos: after picking a colour, that
  // space is spent explaining three colours he has just said he does not want, and it pushes the
  // cards far enough down that the horizontal strip he is trying to scroll is off-screen.
  //
  // This is the collapse the tally above is written to survive, not to cause: `mapToneTally` still
  // counts EVERY beach, so the hidden rows keep their real numbers and all four come back intact
  // the moment the filter clears. And the way back is not the hidden rows — it is the explicit
  // «Δείξε όλες τις παραλίες» button in renderWindColorGuidePanel, which only exists while a
  // filter is active. Hiding rows would be a trap without it; that button is what makes it safe.
  const visibleWindColorGuideRows = LEGEND_TONE_ORDER
    .map(tone => ({ tone, count: mapToneTally.counts.get(tone) ?? 0 }))
    .filter(row => row.count > 0)
    .filter(row => !activeToneFilter || row.tone === activeToneFilter);
  const showGroupedExposureLegend = showWindExposureStatusLabels && !isSevereWind;
  // Legend cue turned off (Μίλτος, 15/08/2026) — the surf marker itself (isSurfMarker,
  // below) still shows on the pin, only this explanatory legend line is gone.
  const showSurfLegendCue = false;

  // Tapping a row shows only those beaches — on the map AND in the cards below, which is why the
  // rows are only interactive when the parent actually wired the filter up. On the detail map,
  // where there is nothing to filter, they stay plain text.
  const isToneFilterEnabled = Boolean(onToneFilterChange) && !isSevereWind;
  const toneFilterCopy = getLocalizedCopy<{ showOnly: string; showAll: string }>(language, {
    en: { showOnly: 'Show only these', showAll: 'Show all beaches' },
    gr: { showOnly: 'Δείξε μόνο αυτές', showAll: 'Δείξε όλες τις παραλίες' },
    fr: { showOnly: 'Afficher uniquement celles-ci', showAll: 'Afficher toutes les plages' },
    de: { showOnly: 'Nur diese anzeigen', showAll: 'Alle Strände anzeigen' },
    it: { showOnly: 'Mostra solo queste', showAll: 'Mostra tutte le spiagge' },
  });

  const renderWindColorGuideRows = (variant: 'full' | 'preview') => {
    const isPreview = variant === 'preview';
    // TWO-UP ON A PHONE, FOUR ACROSS ON A WIDE SCREEN (10/08/2026). These rows used to run
    // full-width down the page: four colours, two lines each, and the beach cards started below
    // the fold on a phone. Side by side they cost a quarter of that height. A single row (a
    // filter is on) stays full width rather than sitting in a lonely half-column, and an odd
    // last row spans both phone columns so the strip never ends with a gap.
    // Since 15/08/2026 each cell is ONE line, not two — the per-colour sentence moved to a
    // single caption under the grid — so the same 2×2 costs half the height it used to.
    const rowCount = visibleWindColorGuideRows.length;
    const isSideBySide = !isSevereWind && rowCount > 1;
    const gridClasses = `${isSideBySide ? 'grid grid-cols-2 gap-1 sm:grid-cols-4' : 'grid gap-1'}${isPreview ? ' pr-5' : ''}`;

    return (
      <div
        className={`${gridClasses} ${isPreview ? '' : 'rounded-lg bg-slate-50/80 p-2 dark:bg-slate-800/60'}`}
      >
        {isSevereWind ? (
          <div className={`${isPreview ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'} col-span-full flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold leading-snug text-slate-600 dark:text-slate-300`}>
            <span className="inline-flex min-w-0 items-center gap-1">
              <span className="min-w-0">{windColorGuideCopy.severeLabel}</span>
              <AlertTriangle
                aria-label={windColorGuideCopy.severeColorName}
                role="img"
                className="h-3.5 w-3.5 shrink-0 fill-rose-600 text-white"
              />
            </span>
          </div>
        ) : visibleWindColorGuideRows.map((row, rowIndex) => {
          const isActive = activeToneFilter === row.tone;
          // Three colours in a two-column grid would leave a hole; the last one takes the whole
          // phone row instead. At sm: the grid is four wide and every row fits on one line.
          const spanClasses = isSideBySide && rowCount % 2 === 1 && rowIndex === rowCount - 1
            ? 'col-span-2 sm:col-span-1'
            : '';
          // «Ιδανικές 4 παραλίες», not «Ιδανική 4». The bare number beside a singular adjective
          // was read as a score or a rank; the noun is what makes it a count (12/08/2026, from
          // real reader reports). It survived the 15/08 slimming for exactly that reason: what
          // was cut is the second line under each row on a PHONE, never the noun inside it.
          const countPhrase = conditionToneCountPhrase(row.tone, language, row.count);
          const causeLine = causeLineByTone.get(row.tone);
          const body = (
            <>
              <span className="flex min-w-0 items-start gap-1.5">
                <span
                  aria-label={windColorGuideCopy.colorName[row.tone]}
                  title={windColorGuideCopy.colorName[row.tone]}
                  role="img"
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${windLegendDotClasses[row.tone]}`}
                />
                <span className="min-w-0">
                  {countPhrase.before}
                  <span className="font-extrabold text-slate-700 dark:text-slate-200">{row.count}</span>
                  {countPhrase.after}
                </span>
                {isToneFilterEnabled && (
                  isActive
                    ? <X aria-hidden="true" className="ml-auto mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                    : <ChevronRight aria-hidden="true" className="ml-auto mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                )}
              </span>
              {/* WIDE SCREENS EXPLAIN, PHONES COUNT (15/08/2026, Miltos's call).
                  This is the line that separates «Μέτρια» from «Καλή». On a desktop it is free —
                  the rows sit four across with room under each — so it stays visible and nobody
                  has to tap to learn what a colour means. On a phone the same four sentences are
                  eight stacked lines immediately above the beach cards, which is what he read as
                  crowded; there the legend counts, and the sentence returns as a caption under
                  the grid the moment a single colour is left. Same string either way — the
                  explanation is never rewritten per screen size, only relocated. */}
              {causeLine ? (
                /* TODAY'S CAUSE REPLACES THE SCALE'S SENTENCE — it does not stack on top of it.
                   The static line explains how this colour differs from the one above it, which
                   the reader can learn once; this one says what put THESE beaches here at THIS
                   hour, which they cannot get anywhere else on the screen. On a wide screen the
                   swap costs zero height, and on a phone (where the static line is hidden) it is
                   the only line — about +24 px, and only on the days it fires. */
                <span className="mt-0.5 block text-left text-[10px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
                  <span aria-hidden="true" className="mr-0.5 text-slate-400">▸</span>
                  {causeLine.short}
                </span>
              ) : (
                <span className="mt-0.5 hidden text-left text-[10px] font-medium leading-snug text-slate-500 sm:block dark:text-slate-400">
                  {toneWords[row.tone].meaning}
                </span>
              )}
            </>
          );
          const textClasses = `${isPreview ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'} ${spanClasses} min-w-0 font-semibold leading-snug text-slate-600 dark:text-slate-300`;

          if (!isToneFilterEnabled) {
            return <div key={row.tone} className={textClasses}>{body}</div>;
          }

          return (
            <button
              key={row.tone}
              type="button"
              aria-pressed={isActive}
              /* The spoken label carries the cause too. A blind reader hears the count and the
                 button's action; without this they would be the only ones who never learn that
                 today's orange is wind and not wave. */
              aria-label={`${countPhrase.text}${causeLine ? ` — ${causeLine.short}` : ''} — ${isActive ? toneFilterCopy.showAll : toneFilterCopy.showOnly}`}
              onClick={() => onToneFilterChange?.(isActive ? null : row.tone)}
              className={`${textClasses} w-full cursor-pointer rounded-lg border px-2 py-1.5 text-left transition hover:border-slate-400 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800 ${
                isActive
                  ? `${windLegendActiveClasses[row.tone]} shadow-sm`
                  : 'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/40'
              }`}
            >
              {body}
            </button>
          );
        })}
        {/* The cove's explanatory line used to live here (removed 05/08/2026) — it now rides
            inside the beach cards themselves, next to the wind/wave stats, instead of as a
            standalone caption under the map legend (see BeachConditionScore's enclosedCove
            note). The pin still wears its own badge (beachCoveBadge, above) — that mark is
            unchanged; only the separate legend caption explaining it is gone. */}
        {showSurfLegendCue && (
          <div className={`${isPreview ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'} col-span-full flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold leading-snug text-slate-600 dark:text-slate-300`}>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="beach-map-legend-surf" aria-hidden="true" />
              {/* "known" and "in season", not "good today" — the wind reading is
                  what the marker's colour says, and a surf break is often an
                  exposed one. These two claims must not be confused. */}
              <span className="min-w-0">{getLocalizedCopy(language, {
                en: 'Known surf spot, in season',
                gr: 'Γνωστό σημείο για σερφ, στην εποχή του',
                fr: 'Spot de surf connu, en saison',
                de: 'Bekannter Surfspot, in der Saison',
                it: 'Spot da surf noto, in stagione',
              })}</span>
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderWindColorGuidePanel = (variant: 'full' | 'preview') => {
    const isPreview = variant === 'preview';
    // THE PHONE'S ONE EXPLANATORY LINE (15/08/2026), where four used to hang off four rows.
    //
    // On a phone the rows print the colour and the count only — four sentences stacked under
    // four numbers is what Miltos read as crowded, and they are not four separate facts but ONE
    // ordered scale said four times. The moment a SINGLE colour is left, though — a filter is
    // picked, or the map paints only one — that colour's own `meaning` earns its line and shows
    // up here, because the reader has just asked about precisely that colour.
    //
    // `sm:hidden`, because on a wide screen the rows already carry all four meanings inline
    // (his call: a desktop has the room and should explain without a tap). Without that the
    // filtered desktop legend would print the same sentence twice, one under the other.
    // Never rendered at >=7 Bft: there are no counted rows there, only the "unsuitable" line.
    const soleVisibleTone = visibleWindColorGuideRows.length === 1 ? visibleWindColorGuideRows[0].tone : null;

    return (
      <div className={`relative ${isPreview ? 'max-w-full space-y-1.5' : 'space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700'}`}>
        {/* ΜΗΔΕΝ ΜΟΝΙΜΟ ΥΨΟΣ. Το κουμπί κάθεται απόλυτα στην πάνω-δεξιά γωνία και ο πίνακας
            κρατάει `pr-5` ώστε να μη σκεπάζει ποτέ κελί. Κλειστό, η οθόνη είναι ίδια με χθες. */}
        {isPreview && (
          <button
            type="button"
            onClick={() => setShowToneScaleHint(open => !open)}
            aria-expanded={showToneScaleHint}
            aria-label={mapCopy.toneScaleWhat[language]}
            title={mapCopy.toneScaleWhat[language]}
            className="absolute right-0 top-0 z-10 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {renderWindColorGuideRows(variant)}
        {isPreview && showToneScaleHint && (
          <p className="px-0.5 text-left text-[10px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
            {mapCopy.toneScaleHint[language]}
          </p>
        )}
        {!isSevereWind && soleVisibleTone && (
          /* THE FILTERED COLOUR GETS THE WHOLE SENTENCE. The reader has just tapped this colour,
             so this is the one place with room to finish the thought — «Το χρώμα το φέρνει ο
             αέρας. Το νερό είναι ήρεμο, όμως ο αέρας σε τραβάει ανοιχτά». Not `sm:hidden` like
             the scale's line it replaces: the chips carry the SHORT form, so on a wide screen
             this adds the rest of the sentence rather than repeating it. */
          causeLineByTone.get(soleVisibleTone) ? (
            <p className="px-0.5 text-left text-[10px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
              {causeLineByTone.get(soleVisibleTone)?.full}
            </p>
          ) : (
            <p className="px-0.5 text-left text-[10px] font-medium leading-snug text-slate-500 sm:hidden dark:text-slate-400">
              {toneWords[soleVisibleTone].meaning}
            </p>
          )
        )}
        {/* Μία διέξοδος για ΚΑΘΕ κοπή του χάρτη, όχι μία ανά φίλτρο. Ο επισκέπτης δεν κρατάει
            λογαριασμό ποιο από τα δύο άναψε· θέλει να ξαναδεί όλες τις παραλίες. */}
        {((isToneFilterEnabled && activeToneFilter) || isCalmWaterActive) && (
          <button
            type="button"
            onClick={() => { onToneFilterChange?.(null); onCalmWaterFilterChange?.(false); }}
            className="inline-flex min-h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 text-[10px] font-black text-white transition hover:bg-slate-700"
          >
            <X aria-hidden="true" className="h-3 w-3" />
            {toneFilterCopy.showAll}
          </button>
        )}
      </div>
    );
  };

  const renderLegend = () => (
    <>
      {mapMode === 'recommendation' ? (
        <>
          <h4 className="mb-1.5 font-bold text-slate-900 sm:mb-2 dark:text-white">{mapCopy.suitability[language]}</h4>
          <div className="grid gap-1 sm:flex sm:flex-col sm:gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></div>
              <span className="text-slate-600 dark:text-slate-300">
                {showRecommendationWindColors ? mapCopy.excellent[language] : mapCopy.excellentCalm[language]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-amber-200"></div>
              <span className="text-slate-600 dark:text-slate-300">{mapCopy.good[language]}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-200"></div>
              <span className="text-slate-600 dark:text-slate-300">{mapCopy.notRecommended[language]}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <h4 className="mb-1.5 flex items-center gap-1 font-bold text-slate-900 sm:mb-2 dark:text-white">
            <Wind className="h-3 w-3" />
            {showWindExposureColors && showWindExposureStatusLabels ? mapCopy.exposure[language] : mapCopy.calmWind[language]}
          </h4>
          {windSpeedKmh !== undefined && windDirection && (
            <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-slate-700 sm:mb-2 sm:pb-2 dark:border-slate-700 dark:text-slate-600">
              {mapCopy.current[language]}: {localizedWindDirection} {mapCopy.at[language]} {Math.round(windSpeedKmh)} km/h
              {windBeaufort !== undefined ? ` (${windBeaufort} ${mapCopy.beaufort[language]})` : ''}
            </div>
          )}
          {showWindExposureColors ? (
            <div className="space-y-2">
              {showGroupedExposureLegend && (
                <div className="grid gap-1 sm:flex sm:flex-col sm:gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ring-2 ${protectedTone.colorClass} ${protectedTone.ringClass}`}></div>
                    <span className="text-slate-600 dark:text-slate-300">{groupedExposureLabel('protected')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ring-2 ${exposedTone.colorClass} ${exposedTone.ringClass}`}></div>
                    <span className="text-slate-600 dark:text-slate-300">{groupedExposureLabel('exposed')}</span>
                  </div>
                </div>
              )}
              {renderWindColorGuidePanel('full')}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-sky-500 ring-2 ring-sky-200"></div>
                <span className="text-slate-600 dark:text-slate-300">{mapCopy.calmWindNote[language]}</span>
              </div>
              {renderWindColorGuidePanel('full')}
            </div>
          )}
        </>
      )}
    </>
  );

  const renderPreviewLegend = () => (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h4 className="flex min-w-0 items-center gap-1 text-[11px] font-black leading-tight text-slate-800 dark:text-white">
          <Wind className="h-3 w-3 shrink-0" />
          <span className="truncate">{showWindExposureColors && showWindExposureStatusLabels ? mapCopy.exposure[language] : mapCopy.calmWind[language]}</span>
        </h4>
        {windSpeedKmh !== undefined && windDirection && (
          <span className="shrink-0 text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-600">
            {localizedWindDirection} {Math.round(windSpeedKmh)} km/h
            {windBeaufort !== undefined ? ` · ${windBeaufort} ${mapCopy.beaufort[language]}` : ''}
          </span>
        )}
      </div>
      {showWindExposureColors ? (
        <div className="space-y-2">
          {showGroupedExposureLegend && (
            <div className="grid grid-cols-2 gap-1.5">
              <div className={`flex min-w-0 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[9px] font-bold leading-none ${protectedTone.bgClass} ${protectedTone.textClass}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${protectedTone.colorClass} ${protectedTone.ringClass}`} />
                <span className="whitespace-nowrap">{groupedExposureLabel('protected')}</span>
              </div>
              <div className={`flex min-w-0 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[9px] font-bold leading-none ${exposedTone.bgClass} ${exposedTone.textClass}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${exposedTone.colorClass} ${exposedTone.ringClass}`} />
                <span className="whitespace-nowrap">{groupedExposureLabel('exposed')}</span>
              </div>
            </div>
          )}
          {renderWindColorGuidePanel('preview')}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex min-w-0 items-center justify-center gap-1.5 rounded-full bg-sky-50 px-2 py-1.5 text-[10px] font-bold leading-none text-sky-700">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 ring-1 ring-sky-200" />
            <span className="truncate">{mapCopy.calmWind[language]}</span>
          </div>
          {renderWindColorGuidePanel('preview')}
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative w-full z-0 ${
      isCompactPreview
        ? 'overflow-visible border-0 shadow-none'
        : compact
          ? 'h-full overflow-hidden rounded-3xl border border-slate-200 shadow-none dark:border-slate-800'
          : 'overflow-hidden rounded-2xl border border-slate-200 shadow-lg dark:border-slate-800'
    }`}>
      <div ref={mapViewportRef} className={`relative ${
        isCompactPreview
          ? `${compactPreviewHeightClassName || 'h-[19rem] sm:h-[26rem] lg:h-[32rem]'} overflow-hidden rounded-[1.1rem] border border-sky-100`
          : compact
            ? 'h-full'
            : preview
              ? 'h-[195px] sm:h-[420px]'
              : 'h-[360px] sm:h-[500px]'
      }`}>
        {/* The camping layer toggle stood here. It went with the layer it controlled — see
            renderedCampsites above: the region map no longer scatters tent pins. */}

        {/* Map Mode Toggle */}
        {!compact && !preview && (
        <div className="absolute left-3 right-3 top-3 z-[1000] flex overflow-hidden rounded-full border border-white/60 bg-white/95 p-1 shadow-lg shadow-sky-900/10 sm:left-auto sm:right-4 sm:rounded-xl sm:border-slate-200 sm:p-0 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMapMode('recommendation')}
            aria-label={mapCopy.recommendationMode[language]}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:flex-none sm:rounded-none sm:px-3 sm:py-2 sm:text-xs ${mapMode === 'recommendation' ? 'bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-600 hover:bg-white/60 sm:hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800'}`}
          >
            <span className="sm:hidden">{mapCopy.recommendationShort[language]}</span>
            <span className="hidden sm:inline">{mapCopy.recommendationMode[language]}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode('wind')}
            aria-label={mapCopy.windMode[language]}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:flex-none sm:rounded-none sm:px-3 sm:py-2 sm:text-xs ${mapMode === 'wind' ? 'bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-600 hover:bg-white/60 sm:hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800'}`}
          >
            <span className="sm:hidden">{mapCopy.windShort[language]}</span>
            <span className="hidden sm:inline">{mapCopy.windMode[language]}</span>
          </button>
        </div>
        )}

        <MapContainer
          center={center}
          zoom={zoom}
          minZoom={viewportGuardrails.minZoom}
          maxBounds={viewportGuardrails.maxBounds}
          maxBoundsViscosity={0.85}
          boxZoom
          doubleClickZoom
          dragging
          keyboard
          scrollWheelZoom={enableScrollWheelZoom}
          touchZoom
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full z-0"
          style={{ height: '100%', width: '100%' }}
        >
          {/* One control column: Leaflet's +/- bar, with the satellite switch and the
              "reset view" home button appended into that same bar (see attachToZoomBar)
              so they share its border and rounding instead of floating as loose boxes.
              The home button is last because it only appears once you've panned away —
              anything under it would jump. */}
          <ZoomControl position={preview || compact ? 'topright' : 'bottomright'} />
          {(showBasemapToggle ?? !preview) && (
            <BasemapControl basemap={basemap} onToggle={toggleBasemap} title={basemapTitle} />
          )}
          <HomeControl center={homeCenter} zoom={homeZoom} title={homeTitle} />
          {basemap === 'satellite' ? (
            <>
              <AerialToneFilter />
              <TileLayer
                key="satellite"
                url={SATELLITE_TILE_URL}
                className="calmbeach-aerial"
                maxZoom={19}
                zIndex={1}
                eventHandlers={{ load: () => setTilesReady(true) }}
              />
              <TileLayer key="satellite-labels" url={SATELLITE_LABELS_URL} maxZoom={19} zIndex={2} />
            </>
          ) : (
            <TileLayer
              key="street"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              eventHandlers={{ load: () => setTilesReady(true) }}
            />
          )}

          <MapAutoResize />
          <RecenterMap center={center} zoom={zoom} enabled={!fitBoundsToBeaches} />
          <MapViewportGuardrails
            minZoom={viewportGuardrails.minZoom}
            maxBounds={viewportGuardrails.maxBounds}
            islandBounds={viewportGuardrails.islandBounds}
          />
          <FitBeachBounds
            beaches={fitBoundsBeaches || beaches}
            center={center}
            enabled={fitBoundsToBeaches}
            fitKey={fitBoundsKey}
          />
          <PopupPansOnlyOnOpen />
          <HighlightedBeachFollower
            beaches={beaches}
            center={center}
            highlightedBeachId={highlightedBeachId}
            enabled={followHighlightedBeach}
          />
          {/* markerBeaches, not beaches: "what is in view" has to mean what the user can SEE, or
              a legend filter would leave the desktop viewport list holding hidden pins. */}
          <VisibleBeachTracker beaches={markerBeaches} center={center} onVisibleBeachIdsChange={onVisibleBeachIdsChange} />
          <MapUserInteractionTracker onUserInteraction={onUserInteraction} />
          {showMarkerConditions && <MapPopupTracker onChange={setHasOpenBeachPopup} />}
          {showMarkerConditions && (
            <MarkerPopupScrollFollower
              enabled={showMarkerConditions}
              highlightedBeachId={highlightedBeachId}
              markerRefs={beachMarkerRefs}
            />
          )}
          <ZoomLabelController threshold={labelZoomThreshold} onLabelOpacityChange={setBeachLabelOpacity} />

          {/* User Location Marker */}
          {userLocation && typeof userLocationAccuracy === 'number' && Number.isFinite(userLocationAccuracy) && userLocationAccuracy > 0 && (
            <Circle
              center={[userLocation.lat, userLocation.lon]}
              radius={userLocationAccuracy}
              pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12 }}
            />
          )}
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]} icon={UserLocationIcon}>
              <Popup autoPan={false}>
                <div className="text-center">
                  <p className="font-bold text-slate-900">{mapCopy.youAreHere[language]}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Nearby campsite pins — explicit list on the detail map, toggled layer on the overview map */}
          {renderedCampsites.map((camp) => (
            <Marker key={camp.id} position={[camp.lat, camp.lon]} icon={CampsiteIcon} zIndexOffset={200}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <span className="font-bold">⛺ {camp.name}</span>
              </Tooltip>
            </Marker>
          ))}

          {/* Beach Markers */}
          {shouldRenderBeachMarkers && markerBeaches.map((item) => {
            const activeHighlightBeachId = typeof highlightedBeachId === 'number'
              ? highlightedBeachId
              : hoveredBeachId ?? undefined;
            const hasActiveHighlight = typeof activeHighlightBeachId === 'number';
            const isHighlightedMarker = hasActiveHighlight && item.beachId === activeHighlightBeachId;
            const isTopPickMarker = typeof topBeachId === 'number' && item.beachId === topBeachId && !hasActiveHighlight;
            const markerCoordinate = getBeachMapCoordinates(item.beach, { lat: center[0], lon: center[1] });
            const mapExposureLevel = getMapExposureLevel(item);
            const mapExposureEvidence = getMapExposureEvidence(item);
            // Hovering or scroll-linking a marker reveals its name even when the
            // zoom-based labels are faded out, so the active card is easy to find.
            const isLabelActive = isHighlightedMarker || hoveredBeachId === item.beachId;
            const labelOpacity = isLabelActive ? 1 : beachLabelOpacity;
            // Same predicate the surf filter uses, so the badge and the filter can
            // never disagree about what is a surf spot today.
            const isSurfMarker = isSurfSpotInSeason(item.beach);

            return (
            <Marker
              // Deliberately excludes isTopPickMarker/isHighlightedMarker: those flip the
              // instant a marker is hovered, and remounting the icon under a stationary
              // cursor drops the native mouseover/mouseout the browser needs to ever fire
              // mouseout again, sticking the hover card open. react-leaflet already applies
              // icon changes via marker.setIcon() on prop update, so the visual still updates.
              key={`${item.beachId}-${mapMode}-${mapExposureLevel}`}
              ref={instance => {
                if (instance) beachMarkerRefs.current.set(item.beachId, instance);
                else beachMarkerRefs.current.delete(item.beachId);
              }}
              position={[markerCoordinate.lat, markerCoordinate.lon]}
              zIndexOffset={isHighlightedMarker ? 1000 : isTopPickMarker ? 700 : 0}
              icon={mapMode === 'recommendation'
                ? beachIconFor(item, showRecommendationWindColors, isTopPickMarker, isHighlightedMarker, isSurfMarker)
                : exposureIconFor(mapExposureLevel, showWindExposureColors, beachBeaufort(item), isTopPickMarker, mapExposureEvidence, isHighlightedMarker, Boolean(item.enclosedCove), isSurfMarker, seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS), beachCoveBadge(item), beachOffshoreFlatWater(item), beachGlassWaterAtFour(item), beachDownwindSeaSample(item), item.swimmingComfort === 'avoid_swimming', item.seaArrivalExposureLevel, beachWindSpeedKmh(item))}
              eventHandlers={{
                click: () => {
                  trackEvent('map_marker_clicked', item.beachId, {
                    locale: languageToLocale(language),
                    source: compact ? 'detail_map' : preview ? 'home_map_preview' : 'full_map',
                    map_mode: mapMode,
                    beach_name: item.beach.name.en,
                    ...buildBeachExposureParams(item.beach, item.simpleWindSuitability?.exposureStatus),
                  });
                  // ΜΕ ΤΟ ΤΑΜΠΕΛΑΚΙ ΑΝΟΙΧΤΟ, ΤΟ ΠΑΤΗΜΑ ΔΕΝ ΦΕΥΓΕΙ ΑΠΟ ΤΟΝ ΧΑΡΤΗ (20/08/2026).
                  // Το Leaflet ανοίγει μόνο του το <Popup> του marker και κλείνει το προηγούμενο,
                  // οπότε είναι πάντα ένα ανοιχτό. Η σελίδα ανοίγει από το κουμπί μέσα του.
                  if (showMarkerConditions) return;
                  // Clicking a marker goes straight to the beach card. Maps that
                  // don't wire a handler fall back to the in-map info panel.
                  if (onBeachClick) {
                    onBeachClick(item.beach);
                  } else {
                    setSelectedBeachId(item.beachId);
                  }
                },
                mouseover: event => handleMarkerHover(event, item.beachId),
                mousemove: event => handleMarkerHover(event, item.beachId),
                mouseout: () => handleMarkerHoverEnd(item.beachId),
              }}
            >
              {/* autoPan: στο κινητό ο χάρτης έχει ύψος 13,5rem — μια πινέζα κοντά στην κορυφή θα
                  άνοιγε ταμπελάκι μισό έξω από το κάδρο. Το padding κρατάει τη μετακίνηση μικρή. */}
              {showMarkerConditions && (
                <Popup
                  className="beach-map-conditions-popup"
                  closeButton={false}
                  autoPan
                  autoPanPadding={[12, 12]}
                  minWidth={128}
                  maxWidth={230}
                >
                  <MarkerConditionsPopup
                    item={item}
                    language={language}
                    windSpeedKmh={beachWindSpeedKmh(item)}
                    openLabel={mapCopy.openBeach[language]}
                    onOpen={onBeachClick ? () => onBeachClick(item.beach) : undefined}
                  />
                </Popup>
              )}
              <Tooltip
                key={`${item.beachId}-label-${beachLabelOpacityLevel}`}
                permanent
                direction="top"
                offset={[0, -12]}
                opacity={1}
                className={[
                  'beach-map-label',
                  (compact || preview) ? 'beach-map-label--compact' : '',
                ].filter(Boolean).join(' ')}
              >
                <span
                  className="beach-map-label__inner"
                  style={{
                    opacity: labelOpacity,
                    transform: `translateY(${7 - labelOpacity * 7}px) scale(${0.9 + labelOpacity * 0.1})`,
                    filter: `blur(${(1 - labelOpacity) * 0.8}px)`,
                    visibility: labelOpacity > 0.02 ? 'visible' : 'hidden',
                  }}
                >
                  {item.name}
                </span>
              </Tooltip>
            </Marker>
            );
          })}
        </MapContainer>

        <div className="pointer-events-auto absolute bottom-1.5 right-1.5 z-[900] rounded bg-white/95 px-1.5 py-0.5 text-[8px] font-medium leading-none text-slate-600 shadow-sm shadow-sky-900/5 dark:bg-slate-900/95 dark:text-slate-300">
          <a
            href="https://leafletjs.com"
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            Leaflet
          </a>
          <span> | © </span>
          {basemap === 'satellite' ? (
            <a
              href="https://www.esri.com/en-us/legal/terms/full-master-agreement"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Esri, Maxar, Earthstar Geographics
            </a>
          ) : (
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              OpenStreetMap contributors
            </a>
          )}
        </div>

        {hoveredBeach && hoverPreviewPosition && (
          <BeachHoverPreviewCard
            item={hoveredBeach}
            position={hoverPreviewPosition}
            mapViewportRef={mapViewportRef}
            language={language}
            photoUrl={hoverPreviewPhotoUrl}
            featureChips={hoverPreviewFeatureChips}
            localWind={hoverLocalWind}
            windLabel={hoverLocalWindLabel}
          />
        )}

        {mapMode === 'wind' && (
          <WindFlowOverlay
            windDirection={windDirection}
            windDirectionDeg={mapWindDirectionDeg}
            windBeaufort={windBeaufort}
            preview={preview}
          />
        )}

        {!hasOpenBeachPopup && (
        <WindDirectionGraphic
          windDirection={windDirection}
          windDirectionDeg={mapWindDirectionDeg}
          windSpeedKmh={windSpeedKmh}
          windBeaufort={windBeaufort}
          shoreBeaufortRange={shoreBeaufortRange}
          language={language}
          compact={compact}
          preview={preview}
        />
        )}

        {selectedBeach && (
          <div className="absolute inset-x-2 bottom-2 z-[1000] max-h-[76%] overflow-y-auto rounded-2xl border border-white/80 bg-white p-3 shadow-xl shadow-slate-900/20 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[min(360px,calc(100%-2rem))]">
            <button
              type="button"
              onClick={() => setSelectedBeachId(null)}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              aria-label={mapCopy.closeDetails[language]}
            >
              <X className="h-4 w-4" />
            </button>
            {renderBeachInfo(selectedBeach, 'panel')}
          </div>
        )}

        {/* Legend Overlay */}
        {!compact && !preview && (
        <div className="absolute bottom-4 left-4 z-[1000] hidden max-w-none rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg shadow-sky-900/10 sm:block dark:border-slate-700 dark:bg-slate-900">
          {renderLegend()}
        </div>
        )}

      </div>

      {/* Hour slider docked under the map: colours and recommendations follow the selected hour */}
      {enableHourSlider && sliderHours.length >= 2 && activeHourItem && (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-0 border-t border-slate-200/80 bg-white/92 px-3 py-0 dark:border-slate-700 dark:bg-slate-900/90 sm:gap-x-3 sm:gap-y-1 sm:px-4 sm:py-3"
          onPointerDown={() => onUserInteraction?.()}
        >
          {/* The heading takes its own centred line on every size. It used to share the line with
              the bar and with a second copy of the selected hour — a 26px handle inside a ~150px
              track, squeezed between a label and a clock, was most of the reason nobody realised
              it could be dragged, and on the desktop it left no room for the hour labels either.
              The clock is gone: every hour is now written under its own stop and the one in force
              is the teal one, so repeating it beside the title said nothing new.
              THE PHONE SAYS WHAT TO DO, NOT WHAT THIS IS (15/08/2026, Miltos). It used to print
              the bare name «Συνθήκες ανά ώρα» and keep the instruction for a hint line under the
              bar; a name tells nobody the bar can be dragged, which is the one thing a visitor
              has to work out. Both sizes now read the SAME string — the instruction — so it can
              only ever be edited once, and the separate hint line under the bar is gone with it
              rather than printing the sentence twice on one screen. */}
          {/* «ΗΡΕΜΟ ΝΕΡΟ» ΣΤΗ ΓΡΑΜΜΗ ΤΟΥ ΤΙΤΛΟΥ — ΜΗΔΕΝ ΕΠΙΠΛΕΟΝ ΥΨΟΣ (Μίλτος, 15/08/2026).
              «Βάλ' το σαν top filter με εικονίδιο για να ξεχωρίζει ότι δεν ανήκει στην ίδια
              οικογένεια, αλλά μη σπρώξει προς τα κάτω τις παραλίες.» Τρεις απαιτήσεις που
              συγκρούονται, και μία μόνο θέση τις ικανοποιεί και τις τρεις.
              ΓΙΑΤΙ ΟΧΙ ΜΕΣΑ ΣΤΟ GRID ΤΩΝ ΧΡΩΜΑΤΩΝ: μετρήθηκε πάνω στις 143 σκηνές όπου το chip
              όντως βγαίνει — στο **61%** η λεζάντα δείχνει ΔΥΟ χρώματα, δηλαδή μία γεμάτη σειρά
              δύο στηλών, και ένα τρίτο κελί θα άνοιγε δεύτερη σειρά. Μηδέν κόστος υπάρχει μόνο
              στο 40% (1 ή 3 χρώματα), και ένα στοιχείο που άλλοτε σπρώχνει κι άλλοτε όχι είναι
              χειρότερο από ένα που σπρώχνει πάντα.
              ΑΥΤΗ Η ΣΕΙΡΑ ΥΠΑΡΧΕΙ ΗΔΗ και είναι κεντραρισμένη με μία πρόταση μέσα της. Όταν το
              chip εμφανίζεται, ο τίτλος πέφτει στη ΣΥΝΤΟΜΗ του μορφή («Σύρε την μπάρα») — που
              κρατάει το ρήμα, δηλαδή το μόνο που έπρεπε να μάθει ο επισκέπτης (η μακρά μορφή
              μπήκε την ίδια μέρα ακριβώς επειδή «ένα όνομα δεν λέει σε κανέναν ότι σύρεται») —
              και το κερδισμένο πλάτος το παίρνει το κουμπί. Ύψος σειράς: αμετάβλητο.
              ΞΕΧΩΡΙΖΕΙ ΧΩΡΙΣ ΝΑ ΚΡΙΝΕΙ: εικονίδιο κύματος και γαλάζιο περίγραμμα, ΠΟΤΕ κουκκίδα
              χρώματος — η κουκκίδα ανήκει στην κλίμακα του χάρτη και θα το έβαζε στην ίδια
              οικογένεια, που είναι ακριβώς ό,τι δεν είναι. */}
          <div className="flex basis-full flex-nowrap items-center justify-center gap-2 pt-1.5 sm:pt-0">
            <span className={`text-center text-[11px] font-bold leading-snug text-slate-600 sm:text-[13px] sm:font-extrabold dark:text-slate-300 ${canOfferCalmWater ? 'min-w-0 truncate' : ''}`}>
              {canOfferCalmWater ? hourSliderHelperShort[language] : hourSliderHelper[language]}
            </span>
            {canOfferCalmWater && calmWaterOffer && (
              <button
                type="button"
                aria-pressed={isCalmWaterActive}
                aria-label={`${calmWaterCopy.label} — ${calmWaterOffer.count} — ${calmWaterCopy.hint} — ${isCalmWaterActive ? calmWaterCopy.clear : calmWaterCopy.show}`}
                title={calmWaterCopy.hint}
                onClick={() => onCalmWaterFilterChange?.(!isCalmWaterActive)}
                /* ΚΟΥΜΠΙ, ΟΧΙ ΕΝΔΕΙΞΗ (Μίλτος, 15/08/2026: «τώρα ίσως φαίνεται σαν ένδειξη»).
                   Το γεμάτο παστέλ φόντο είναι η γλώσσα των ταμπελών αυτού του site — τα chips
                   παροχών, τα σήματα «Εκτίμηση θάλασσας» — και ο αναγνώστης το διαβάζει ως κάτι
                   που ΤΟΥ ΛΕΕΙ κάτι, όχι κάτι που πατιέται. Αυτά τα τρία το γυρίζουν σε κουμπί
                   χωρίς να προσθέσουν ούτε ένα pixel ύψους: λευκό φόντο με **διπλό περίγραμμα**
                   (βάθος αντί για γέμισμα), **σκιά**, και **βελάκι** — το ίδιο ChevronRight που
                   φοράνε ήδη οι σειρές της λεζάντας, δηλαδή το ήδη μαθημένο σήμα «αυτό οδηγεί
                   κάπου». Μαζί τους το `active:scale-95`, που είναι το μόνο σήμα αφής που
                   υπάρχει πριν αλλάξει η λίστα. Ενεργό: συμπαγές, με ×, όπως κάθε άλλο
                   πατημένο φίλτρο εδώ μέσα. */
                className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-[11px] font-extrabold leading-snug shadow-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isCalmWaterActive
                    ? 'border-sky-600 bg-sky-600 text-white shadow-sky-900/20'
                    : 'border-sky-500 bg-white text-sky-800 shadow-sky-900/10 hover:bg-sky-50 dark:border-sky-500 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800'
                }`}
              >
                <Waves aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{calmWaterCopy.label}</span>
                <span className={`rounded-full px-1 tabular-nums ${isCalmWaterActive ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100'}`}>
                  {calmWaterOffer.count}
                </span>
                {isCalmWaterActive
                  ? <X aria-hidden="true" className="-mr-0.5 h-3.5 w-3.5 shrink-0" />
                  : <ChevronRight aria-hidden="true" className="-mr-1 h-3.5 w-3.5 shrink-0 text-sky-500" />}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => stepSliderHour(-1)}
            disabled={sliderActiveIndex <= 0}
            aria-label={previousHourCopy[language]}
            // Hidden on the phone: the two 36px buttons plus their gaps ate ~90px of a ~340px
            // row, which is exactly the width the hour labels under the bar need to stay legible.
            // The bar itself already steps hour by hour, so nothing is lost.
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-30 sm:flex dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18 9 12l6-6" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="relative flex w-full items-center">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
            {/* Width is never written by React — paintSliderFill owns it, so a drag
                never has to re-render this component to move the bar. */}
            <div
              ref={sliderFillRef}
              className="beach-map-hour-fill pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: sliderTone.color }}
            />
            {/* One dot per available hour: it reads as "there are stops along here",
                which a plain bar does not. Dropped when the hours are too many to
                stay legible. Inset by half a handle so the ends line up with its travel. */}
            {sliderHours.length <= 16 && (
              <div className="pointer-events-none absolute inset-x-[13px] top-1/2 flex -translate-y-1/2 items-center justify-between">
                {sliderHours.map((item, index) => (
                  <span
                    key={item.dt}
                    className={`h-1 w-1 rounded-full ${index <= sliderActiveIndex ? 'bg-white/80' : 'bg-slate-400/70 dark:bg-slate-500'}`}
                  />
                ))}
              </div>
            )}
            {/* Uncontrolled on purpose: the browser owns the handle position while the
                finger is down, and the layout effect above puts it back in step whenever
                the hour is changed from anywhere else. A `value` prop here would mean one
                React render per pointermove, which is exactly the stutter this fixes. */}
            <input
              ref={sliderInputRef}
              type="range"
              min={0}
              max={sliderMaxIndex}
              step={0.01}
              defaultValue={sliderActiveIndex}
              onPointerDown={beginHourScrub}
              onTouchStart={beginHourScrub}
              onChange={event => {
                scrubToIndex(Number(event.target.value));
              }}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                stepSliderHour(event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1);
              }}
              onPointerUp={endHourScrub}
              onPointerCancel={endHourScrub}
              // Range inputs capture the pointer; if that capture is lost anywhere but over
              // the control, this is the only event that still fires. Without it a drag
              // released off-target leaves the slider stuck in scrub mode and the layout
              // effect stops re-syncing it.
              onLostPointerCapture={endHourScrub}
              onTouchEnd={endHourScrub}
              onTouchCancel={endHourScrub}
              onBlur={endHourScrub}
              aria-label={hourSliderLabel}
              style={sliderThumbStyle}
              className={`beach-map-hour-slider relative z-10 h-10 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent sm:h-11${hourHintPending ? ' beach-map-hour-slider--hint' : ''}`}
            />
          </div>
          {/* THREE HOURS WRITTEN, EVERY HOUR STILL MARKED (15/08/2026).
              Every stop used to be spelled out: fourteen two-digit numbers in a row, all the same
              weight, and the one actually in force — the only one the reader came for — was a
              teal needle in that haystack. Miltos read the whole block as crowded and this was
              half of it.
              The DOTS above are untouched, so "there are stops along here, drag me" still reads
              off the control itself; what goes is the writing on the stops nobody asked about.
              Written now: the first hour, the last hour, and the selected one — the range plus
              where you are, which is what a scale owes its reader.
              An endpoint within two stops of the selection is dropped instead: at ~24px between
              stops a full HH:MM (~26px) would sit on top of its neighbour, and of the two the
              selected hour is never the one to lose. With three labels there is room for the full
              HH:MM at every width, so the old two-digit phone form is gone with them. */}
          {sliderHours.length <= 16 && (
            <div className="pointer-events-none relative -mt-0.5 h-3">
              <div className="absolute inset-x-[13px] top-0 flex items-start justify-between">
                {sliderHours.map((item, index) => {
                  const isActiveStop = index === sliderActiveIndex;
                  const isEndpoint = index === 0 || index === sliderHours.length - 1;
                  const crowdsSelection = Math.abs(index - sliderActiveIndex) <= 2;
                  const isWritten = isActiveStop || (isEndpoint && !crowdsSelection);
                  return (
                    <span key={item.dt} className="relative block h-1 w-1">
                      {isWritten && (
                        <span
                          className={`absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap leading-none tabular-nums ${
                            isActiveStop
                              ? 'text-[11px] font-extrabold text-[#007a83]'
                              : 'text-[9px] font-semibold text-slate-500 sm:text-[10px] dark:text-slate-400'
                          }`}
                        >
                          {formatSliderHour(item.dt)}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          </div>
          <button
            type="button"
            onClick={() => stepSliderHour(1)}
            disabled={sliderActiveIndex >= sliderMaxIndex}
            aria-label={nextHourCopy[language]}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-30 sm:flex dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          {/* The lone hour readout that used to sit here is gone (15/08/2026). It carried the
              region's Beaufort until 02/08/2026 — a figure that contradicted the pins — and after
              that it was just the hour, which the labelled stops under the bar now say in place,
              with the one in force painted teal. The width it freed is what lets those stops fit. */}
          {/* The phone's hint line lived here until 15/08/2026. The heading above the bar now
              carries that exact sentence at every width, so keeping this would have printed the
              same instruction twice on the same screen. The first-use pulse on the handle
              (hourHintPending → beach-map-hour-slider--hint) is untouched: the animation still
              draws the eye to the control, it just no longer needs a paragraph to explain it. */}
          {/*
            HOW LONG ARE YOU STAYING — one question, never two.
            Measured before this was built (scripts/measureIntradayWindowSpread.mjs, 05/08/2026):
            on 41,6% of beach-days a two-hour slot is calmer than the day, and on 33,0% the day
            turns rougher than the hour a visitor arrives in. Arrival time costs two tone steps on
            only 3,6%, which is why the window simply starts now and there is no second chip row
            asking when. "Τώρα" is the default and is exactly the behaviour that existed before,
            so a visitor who ignores this loses nothing.
          */}
          {onStayHoursChange && (
            <div
              className="flex basis-full flex-wrap items-center gap-1.5 pb-2 pt-1 sm:pb-0"
              role="group"
              aria-label={mapCopy.stayHint[language]}
            >
              <span className="shrink-0 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                {mapCopy.stayLabel[language]}
              </span>
              {([
                { value: null, label: mapCopy.stayNow[language] },
                { value: 2 as const, label: mapCopy.stay2h[language] },
                { value: 4 as const, label: mapCopy.stay4h[language] },
                { value: 8 as const, label: mapCopy.stay8h[language] },
              ]).map(option => {
                const isActive = stayHours === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onStayHoursChange(option.value)}
                    aria-pressed={isActive}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[#007a83] bg-[#007a83] text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-[#007a83] hover:text-[#007a83] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isCompactPreview && mapMode === 'wind' && (
        <div className="mt-0 rounded-xl border border-sky-100 bg-white px-2 py-1 text-left shadow-sm shadow-sky-900/8 dark:border-slate-700 dark:bg-slate-900">
          {renderWindColorGuidePanel('preview')}
        </div>
      )}

      {!compact && preview && (
        <div className="border-t border-slate-200/80 bg-white px-3 py-2 shadow-inner shadow-sky-900/5 dark:border-slate-700 dark:bg-slate-900">
          {renderPreviewLegend()}
        </div>
      )}

      {/* Mobile Legend */}
      {!compact && !preview && (
      <div className="border-t border-slate-200 bg-white p-3 text-[11px] shadow-inner shadow-sky-900/5 sm:hidden dark:border-slate-700 dark:bg-slate-900">
        {renderLegend()}
      </div>
      )}
    </div>
  );
};

export default BeachMap;
