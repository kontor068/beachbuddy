import React, { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Haze,
  CloudSun,
  Clock3,
  Droplets,
  Flag,
  Footprints,
  Info,
  MapPin,
  Martini,
  MoreHorizontal,
  Mountain,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  ParkingCircle,
  ShowerHead,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sunset,
  Trees,
  Utensils,
  Users,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import type { Beach, DailyForecast, FilterKey, Island, LanguageCode, SortOption, SuitableBeach, Translation, UserPreferences } from '../types';
import { getLocalizedCopy, languageToDateLocale, languageToLocale, type SupportedLanguage } from '../utils/i18n';
import { displayBeachName, localizedAccessLabel, localizedPopularityLabel, localizedLittleKnownLabel } from '../utils/localization';
import { getTopPickDistinguishers, topPickNumberWord } from '../utils/topPickDistinguishers';
import { isInfoOnlyRegionId } from '../utils/infoOnlyRegions';
import type { CalmnessTone } from '../utils/suitabilityTone';
import { getBeachPhotoLookupForBeach } from '../services/beachPhotos';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import { trackEvent } from '../services/analyticsService';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import {
  getPreferenceFilterLabel,
  QUICK_PREFERENCE_FILTERS,
  type QuickPreferenceFilter,
} from '../utils/preferenceFilterLabels';
import { getBeachFilterDirectoryTitle } from '../utils/filterSummary';
import { getSelectedDayOffset, getSelectedDayPrefix, getSelectedDaySentencePrefix } from '../utils/dateLabels';
import { getTopPickTimingLabel } from '../utils/topPickTiming';
import { explainTopPickExclusion, type TopPickExclusionReason } from '../services/recommendationService';
import { MEANINGFUL_WIND_TOP_PICK_BEAUFORT as SHARED_MEANINGFUL_WIND_TOP_PICK_BEAUFORT } from '../services/topPickRanking';
import { athensNow, toAthensWallClock, wallClockDayKey } from '../utils/athensTime';
import { getConsistentVisibleMapExposureLevels, type BeachWindReading } from '../utils/mapExposure';
import { hasBoatOnlyAccess } from '../utils/access';
import { getAccessReasonCopy } from '../utils/accessReasonCopy';
import { EvidenceSignature } from './EvidenceSignature';
import { WeatherSummary } from './WeatherSummary';
import { BeachCard } from './BeachCard';
import { BeachSearchEmptyState } from './BeachSearchEmptyState';
import { SandDotsIcon, SandPebblesIcon, SunbedIcon } from './BeachFeatureIcons';
import { getIslandDestinationPhoto, getIslandStripPhoto } from '../data/destinationPhotoAdapter';
import { getIslandGroupLabel } from '../utils/islandRegionLabels';
import { buildIslandDaySummary } from '../utils/islandDaySummary';
import { CuratedPhotoImage } from './photos';
import { beachMatchesFilterKey, beachMatchesUserPreferences, filterBeaches, getBeachSearchFilterValues } from '../services/recommendationService';
import { isSearchMatch } from '../utils/searchNormalize';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { describeSimpleWindSuitability } from '../utils/windExposureCopy';

import { TopPickLadderPanel } from './TopPickLadderPanel';

export type DirectoryCategory = 'all' | QuickPreferenceFilter;

export type DirectorySearchSuggestion = {
  id: string;
  type: 'region' | 'beach';
  label: string;
  subtitle: string;
  island: Island;
  beachId?: number;
  beach?: Beach;
};

type BeachCardContext = Beach & {
  distance?: number;
  score?: SuitableBeach['score'];
  isExposed?: SuitableBeach['isExposed'];
  bestBeachTime?: SuitableBeach['bestBeachTime'];
  bestTimeWindow?: SuitableBeach['bestTimeWindow'];
  exposureLevel?: SuitableBeach['exposureLevel'];
  waveHeightM?: SuitableBeach['waveHeightM'];
  seaStateWaveM?: SuitableBeach['seaStateWaveM'];
  shoreWaveHeightM?: SuitableBeach['shoreWaveHeightM'];
  shoreDisplayWaveM?: SuitableBeach['shoreDisplayWaveM'];
  shoreWaveFromDepartingSea?: SuitableBeach['shoreWaveFromDepartingSea'];
  seaArrivalExposureLevel?: SuitableBeach['seaArrivalExposureLevel'];
  seaStatePeriodS?: SuitableBeach['seaStatePeriodS'];
  windSpeedKmph?: SuitableBeach['windSpeedKmph'];
  warnings?: SuitableBeach['warnings'];
  confidence?: SuitableBeach['confidence'];
  swimmingComfort?: SuitableBeach['swimmingComfort'];
  canClaimWindProtection?: SuitableBeach['canClaimWindProtection'];
  enclosedCove?: SuitableBeach['enclosedCove'];
  seaCalmClaimAllowed?: SuitableBeach['seaCalmClaimAllowed'];
  lessExposedToday?: boolean;
  simpleWindSuitability?: SuitableBeach['simpleWindSuitability'];
  windExposureReason?: SuitableBeach['windExposureReason'];
};

interface BeachSearcherHomeProps {
  language: SupportedLanguage;
  selectedIsland: Island | null;
  allIslands: Island[];
  /** Plain "calmer in the X of the area today" line, when the region's per-beach
   *  winds show one side clearly calmer. Omitted when conditions are uniform. */
  regionWindNote?: string;
  /** Rain warning for the selected day: it is unsafe to stay in the sea while it
   *  rains, so this is surfaced at the top of the home instead of being buried
   *  in a description line. `isNow` means the rain is falling at this moment. */
  rainWarning?: { title: string; body: string; isNow: boolean };
  /** Saharan-dust advisory for the region's day, display-only: 'elevated' = hazy sky,
   *  'heavy' = dense episode. Absent (the normal case) renders nothing at all. */
  dustLevel?: 'elevated' | 'heavy';
  searchQuery: string;
  activeCategory: DirectoryCategory;
  sortBy: SortOption;
  isMobileViewport?: boolean;
  isAllBeachesPanelOpen?: boolean;
  onAllBeachesPanelOpenChange?: (open: boolean) => void;
  isWeatherPanelOpen?: boolean;
  onWeatherPanelOpenChange?: (open: boolean) => void;
  suitableDistanceSortActive?: boolean;
  locationSortResetKey?: number;
  resultListResetKey?: number;
  preferences: UserPreferences;
  activeFilters?: FilterKey[];
  filterResultCounts?: Partial<Record<keyof UserPreferences, number>>;
  advancedFilterResultCounts?: Partial<Record<FilterKey, number>>;
  sortResultCounts?: Partial<Record<SortOption, number>>;
  filteredResultCount?: number;
  /** True when a search, a filter, a preference or a non-default sort is narrowing the list.
   *  Passed in rather than recomputed so this component and App can never disagree about
   *  whether the visitor asked for something — see App.hasActiveSearchOrFilters. */
  hasActiveSearchOrFilters?: boolean;
  /** Clears the search box AND every filter/preference in one press, for the empty state. */
  onClearSearchAndFilters?: () => void;
  /** Straight-line km to the searched beach when it exists nationally but outside the circle.
   *  (Whether we ARE in Near me is already derived locally — see isNearMeRegion below.) */
  nearMeMissDistanceKm?: number;
  /** Near-me only: back to the beaches around the visitor, keeping the nearest-first order. */
  onBackToNearMe?: () => void;
  /** Count of currently-applied filters (advanced + quick preferences), for the mobile
   *  Filter button badge. Distinct from filteredResultCount (number of matching beaches). */
  activeFilterCount?: number;
  searchSuggestions?: DirectorySearchSuggestion[];
  isSearchSuggesting?: boolean;
  /** Ready-made intent bundles ("Για παιδιά") offered the moment the empty search box is
   *  focused. Already counted and already filtered to count > 0 by App — this component
   *  renders what it is given and never guesses whether a bundle has beaches behind it. */
  intentBundles?: Array<{ key: string; label: string; count: number }>;
  onIntentBundleSelect?: (key: string) => void;
  protectedSortLabel?: string;
  currentBeaufort?: number;
  mapForecastTimeLabel?: string;
  mapDayStrip?: React.ReactNode;
  mapPreview?: React.ReactNode;
  topRecommendationCards?: SuitableBeach[];
  /**
   * Beaches the map painted in the BEST colour on screen today, which the podium could not name.
   *
   * Supplied by App from `mapBeachTones` — never resolved here, same rule as everywhere else
   * (validateConditionToneAgreement forbids this component from deciding a colour). Empty on every
   * ordinary day: it only fills when the reader can SEE the contradiction, i.e. the legend counts
   * an ΙΔΑΝΙΚΗ that no medal above it mentions.
   */
  topColourOutsideTopPicksIds?: ReadonlySet<number>;
  /** The clock App ranked the picks with. Passed in so this component never starts a second one. */
  topPickNow?: Date;
  /** True when nothing cleared the quality bar and the podium is the shelter-ranked last resort.
   *  The block then says so out loud instead of presenting three picks as if they were good. */
  shelteredFallbackPodium?: boolean;
  /** «Δεν κρατάει όλη μέρα — από τις 16:00 χειροτερεύει», about the beach the podium leads with.
   *  Undefined — and therefore silent — whenever the day holds or only improves. */
  dayTurnNote?: string;
  suitableBeachCards?: SuitableBeach[];
  suitableBeachTotalCount?: number;
  /** Localized time-window prefix from the map slider (e.g. "στις 15:00–18:00") used in the suitable/best-beaches headers. */
  suitableTimePrefix?: string;
  /** True when the slider hour IS the current hour (today, no stay window): the podium question
   *  then reads «Πού να πάμε τώρα;» instead of naming the hour like a timetable. */
  suitableTimeIsNow?: boolean;
  /** Colour picked on the map legend, if any. Retitles the list so the heading names the same
   *  thing the cards contain («Δύσκολες παραλίες στις 17:00»). */
  activeToneFilter?: CalmnessTone | null;
  /** Plain line saying which filter was switched off and why — either because nothing in the
   *  picked colour group has it, or because «Ήρεμο νερό» stopped having an answer when the hour
   *  moved. Shown under the list heading, the place the user is already looking, so a choice is
   *  never taken away without a word. The two cases cannot coexist: the colour and the calm-water
   *  filters are mutually exclusive (App.tsx, selectMapToneFilter). */
  filterDropNote?: string;
  /** True only when the list literally holds every beach we would ever list. «Όλες οι παραλίες
   *  κατάλληλες» may not be printed above a selection — a light-wind day with a running sea
   *  leaves plenty of beaches out, and the heading has to say so. */
  suitableListCoversEverything?: boolean;
  onActiveSuitableBeachChange?: (beachId: number | undefined, options?: { resumeFollow?: boolean }) => void;
  /** Discrete signal (nonce-keyed) to centre a specific beach's card in the carousel below the
   *  mobile map — fired when the user picks a beach from search, so they land on map + card. */
  directorySearchCardFocus?: { beachId: number; nonce: number };
  showSuitableBeachSection?: boolean;
  allBeachCards?: BeachCardContext[];
  beachWeatherContexts?: SuitableBeach[];
  /**
   * ΔΕΝ ΥΠΑΡΧΕΙ ΠΙΑ «Top παραλία σήμερα» ΩΣ ΞΕΧΩΡΙΣΤΗ ΚΑΡΤΑ (Μίλτος, 15/08/2026).
   *
   * Τρία props ζούσαν εδώ — `topBeachToday`, `topBeachDescription`, `topBeachTimingLabel` — και
   * τάιζαν μια ολοσέλιδη κάρτα με φωτογραφία, χρυσό «1 ★», ώρα επίσκεψης και παροχές, που
   * ΞΥΠΝΟΥΣΕ ΑΚΡΙΒΩΣ ΟΤΑΝ ΤΟ ΒΑΘΡΟ ΕΜΕΝΕ ΑΔΕΙΟ. Δηλαδή η πιο εντυπωσιακή εμφάνιση της σελίδας
   * έβγαινε τις ΧΕΙΡΟΤΕΡΕΣ ώρες: 20:00 στη Νάξο, καμία «ιδανική» στον χάρτη, «Καλή 1 παραλία» —
   * και από πάνω ένα βάθρο ενός ατόμου να στέφει την παραλία που απλώς έτυχε να είναι πρώτη σε
   * μια λίστα που ο ίδιος ο χάρτης δεν χαρακτήριζε ιδανική.
   *
   * Το πρόβλημα δεν ήταν η θέση της (μετακινήθηκε ήδη μία φορά, 14/08) ούτε το κείμενό της: ήταν
   * ότι η ΕΜΦΑΣΗ δεν αντιστοιχούσε στη σιγουριά. Όταν δεν έχουμε τρεις καλές να προτείνουμε, η
   * τίμια απάντηση είναι η λίστα «Καταλληλότερες παραλίες» με τη σειρά της — όχι μια στέψη.
   *
   * Άρα: όταν το βάθρο είναι άδειο, δεν μπαίνει τίποτα στη θέση του. `weatherBeachCardRankStart`
   * γύρισε σταθερά στο 1 γι' αυτόν ακριβώς τον λόγο. Μην το επαναφέρεις.
   */
  forecastDays?: DailyForecast[];
  selectedDayIndex?: number;
  selectedForecast?: DailyForecast;
  /**
   * The wind at each beach's own shore — the same per-beach reading the map's pins are coloured
   * from (App.perBeachMapWind). Optional: a beach with no local reading falls back to the region
   * wind, exactly as before.
   *
   * Without it the card and the pin describe different winds. From 01/08/2026 the map moved to
   * per-beach wind and this did not, so a card could read «Υπήνεμη» beside a red pin for the
   * same beach on the same screen.
   */
  perBeachMapWind?: Map<number, BeachWindReading>;
  /** Local (Greek) wall-clock hour, 0–23, the map's hour slider is currently on, so the island strip headline tracks the scrubbed hour. */
  mapSelectedHour?: number;
  selectedDate?: Date;
  lastUpdated?: Date | null;
  /** Freshness of the region forecast; 'soft' switches the "updated" chip to an explicit
   *  amber "βάσει πρόγνωσης HH:MM" stamp. (The 'stale' hard cutoff is handled in App.) */
  forecastFreshness?: 'fresh' | 'soft' | 'stale' | 'unknown';
  favorites: number[];
  t: Translation;
  onToggleFavorite: (id: number) => void;
  onSearchChange: (query: string) => void;
  /** Takes the text the visitor actually has in the box; without it a fast Enter searches
   *  for the previous keystroke, because the page's own copy lands a beat later. */
  onSearchSubmit: (query?: string) => void;
  onSearchSuggestionSelect?: (suggestion: DirectorySearchSuggestion) => void;
  onOpenFilters: () => void;
  onOpenIslandSelector: () => void;
  onUseCurrentLocation?: () => void;
  /** Builds the cross-region "Κοντά μου" list from the user's real position (mobile button). */
  onShowNearbyBeaches?: () => void;
  /** Fetches the user's location for distance sorting without changing region. */
  onRequestUserLocation?: () => void;
  onDistanceSortActiveChange?: (active: boolean) => void;
  hasUserLocation?: boolean;
  isFindingCurrentLocation?: boolean;
  currentLocationError?: string | null;
  onCategorySelect: (category: DirectoryCategory) => void;
  onClearAllFilters?: () => void;
  onSortChange: (sort: SortOption) => void;
  onAdvancedFilterToggle?: (filter: FilterKey) => void;
  onForecastDaySelect?: (index: number) => void;
  onBeachClick: (beach: Beach) => void;
  onSelectIsland: (island: Island) => void;
  strongWindContext?: boolean;
  /** True while the region's wind-exposure geometry is still loading. Cards hold back a favourable "sheltered/προστατευμένη" claim until it lands, so they never flash a label the geometry then retracts. */
  isExposureLoading?: boolean;
}

const DRAG_SCROLL_THRESHOLD_PX = 6;

/** Remembers the desktop "full-width map" choice. Cosmetic only, so no consent gate. */
const WEATHER_COLUMN_HIDDEN_KEY = 'calmbeach:desktop-weather-column-hidden';

// From 5 Bft up a boat-only beach (e.g. Κλεφτικό) isn't a real option for the day —
// the boats don't run and you can't drive there — so it must never surface as a "top
// pick". Mirrors the App-level `shouldHideBoatAccessBeaches` chokepoint (PROTECTED_FIRST_BEAUFORT).
const PROTECTED_FIRST_BEAUFORT = 5;
// The wind at which shelter stops being a tie-break and becomes a gate on who enters the podium
// at all (services/topPickRanking.bestShelteredRecommendationGroup). Imported rather than retyped:
// the transparency panel describes that rule in words, and a threshold that drifts in one of the
// two places would leave the page explaining a ranking it no longer performs.
const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = SHARED_MEANINGFUL_WIND_TOP_PICK_BEAUFORT;

const installMouseDragScroll = (element: HTMLElement): (() => void) => {
  let pointerId: number | null = null;
  let startX = 0;
  let startScrollLeft = 0;
  let lastX = 0;
  let lastMoveTime = 0;
  let scrollVelocity = 0;
  let momentumFrame = 0;
  let hasDragged = false;
  let suppressNextClick = false;
  let suppressClickTimeout = 0;

  const stopMomentum = () => {
    if (!momentumFrame) return;
    window.cancelAnimationFrame(momentumFrame);
    momentumFrame = 0;
  };

  const startMomentum = () => {
    stopMomentum();
    if (Math.abs(scrollVelocity) < 0.08) return;

    let previousTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - previousTime;
      previousTime = currentTime;

      element.scrollLeft += scrollVelocity * elapsed;
      scrollVelocity *= Math.pow(0.92, elapsed / 16);

      if (Math.abs(scrollVelocity) < 0.02) {
        momentumFrame = 0;
        return;
      }

      momentumFrame = window.requestAnimationFrame(step);
    };

    momentumFrame = window.requestAnimationFrame(step);
  };

  const clearSuppressedClick = () => {
    if (suppressClickTimeout) {
      window.clearTimeout(suppressClickTimeout);
      suppressClickTimeout = 0;
    }

    suppressClickTimeout = window.setTimeout(() => {
      suppressNextClick = false;
      suppressClickTimeout = 0;
    }, 160);
  };

  const finishDrag = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;

    pointerId = null;
    element.dataset.dragging = 'false';

    try {
      element.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (hasDragged) {
      suppressNextClick = true;
      clearSuppressedClick();
      startMomentum();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.defaultPrevented) return;

    stopMomentum();
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = element.scrollLeft;
    lastX = event.clientX;
    lastMoveTime = performance.now();
    scrollVelocity = 0;
    hasDragged = false;
    element.dataset.dragging = 'true';
    // NOTE: pointer capture is intentionally NOT taken here. Capturing on
    // pointerdown retargets the pointerup/click to the carousel, which swallows
    // clicks on card buttons (Details/Navigate). We only capture once an actual
    // drag begins (see handlePointerMove).
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;

    const deltaX = event.clientX - startX;
    if (!hasDragged && Math.abs(deltaX) < DRAG_SCROLL_THRESHOLD_PX) return;

    if (!hasDragged) {
      // A real drag started — now it's safe to capture the pointer for smooth scrolling.
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort; normal pointer events still work.
      }
    }
    hasDragged = true;
    suppressNextClick = true;
    const now = performance.now();
    const elapsed = now - lastMoveTime;
    if (elapsed > 0) {
      scrollVelocity = -(event.clientX - lastX) / elapsed;
    }
    lastX = event.clientX;
    lastMoveTime = now;
    event.preventDefault();
    element.scrollLeft = startScrollLeft - deltaX;
  };

  const handleClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    suppressNextClick = false;
  };

  element.addEventListener('pointerdown', handlePointerDown);
  element.addEventListener('pointermove', handlePointerMove);
  element.addEventListener('pointerup', finishDrag);
  element.addEventListener('pointercancel', finishDrag);
  element.addEventListener('click', handleClickCapture, true);

  return () => {
    stopMomentum();
    if (suppressClickTimeout) window.clearTimeout(suppressClickTimeout);
    element.removeEventListener('pointerdown', handlePointerDown);
    element.removeEventListener('pointermove', handlePointerMove);
    element.removeEventListener('pointerup', finishDrag);
    element.removeEventListener('pointercancel', finishDrag);
    element.removeEventListener('click', handleClickCapture, true);
  };
};

const filterIcons: Partial<Record<QuickPreferenceFilter, React.ReactNode>> = {
  blueFlag2026: <Flag className="h-5 w-5" />,
  disabledAccess: <Accessibility className="h-5 w-5" />,
  sandy: <SandDotsIcon className="h-5 w-5" />,
  pebbles: <Mountain className="h-5 w-5" />,
  quiet: <VolumeX className="h-5 w-5" />,
  beachBar: <Martini className="h-5 w-5" />,
  easyAccess: <Footprints className="h-5 w-5" />,
  snorkeling: <Search className="h-5 w-5" />,
  familyFriendly: <Users className="h-5 w-5" />,
  deepWater: <Waves className="h-5 w-5" />,
  shallowWater: <Droplets className="h-5 w-5" />,
  surfing: <Waves className="h-5 w-5" />,
};

const desktopAdvancedFilters: Array<{ key: FilterKey; icon: React.ReactNode }> = [
  { key: 'parking', icon: <ParkingCircle className="h-5 w-5" /> },
  { key: 'naturalShade', icon: <Trees className="h-5 w-5" /> },
  { key: 'taverna', icon: <Utensils className="h-5 w-5" /> },
  { key: 'sunbeds', icon: <SunbedIcon className="h-5 w-5" /> },
  { key: 'shower', icon: <ShowerHead className="h-5 w-5" /> },
  { key: 'sandy-pebbles', icon: <SandPebblesIcon className="h-5 w-5" /> },
  { key: 'rocky', icon: <Mountain className="h-5 w-5" /> },
  { key: 'adventure', icon: <MapPin className="h-5 w-5" /> },
  { key: 'sunset', icon: <Sunset className="h-5 w-5" /> },
];
const desktopPrimaryPreferenceFilters = [
  'sandy',
  'pebbles',
  'quiet',
  'easyAccess',
  'familyFriendly',
] as const satisfies readonly QuickPreferenceFilter[];
const desktopPrimaryPreferenceFilterSet = new Set<QuickPreferenceFilter>(desktopPrimaryPreferenceFilters);
const desktopSecondaryPreferenceFilters = QUICK_PREFERENCE_FILTERS.filter(filter => !desktopPrimaryPreferenceFilterSet.has(filter));


type DesktopFilterItem =
  | {
      itemKey: string;
      kind: 'preference';
      key: QuickPreferenceFilter;
      icon: React.ReactNode;
      label: string;
      count?: number;
      isActive: boolean;
    }
  | {
      itemKey: string;
      kind: 'advanced';
      key: FilterKey;
      icon: React.ReactNode;
      label: string;
      count?: number;
      isActive: boolean;
    };

const defaultFilterAvailabilityPreferences: UserPreferences = {
  blueFlag2026: false,
  disabledAccess: false,
  sandy: false,
  pebbles: false,
  quiet: false,
  beachBar: false,
  familyFriendly: false,
  snorkeling: false,
  deepWater: false,
  shallowWater: false,
  surfing: false,
  parking: false,
  easyAccess: false,
};

const beachMatchesPreferenceFilter = (beach: Beach, filter: QuickPreferenceFilter): boolean => (
  beachMatchesUserPreferences(beach, {
    ...defaultFilterAvailabilityPreferences,
    [filter]: true,
  })
);

// Which chips this region can offer is the same question the list answers, so it is answered by
// the same function — see beachMatchesFilterKey. The hand-written copy that used to live here
// read only `amenities` and `characteristics`, had no `disabledAccess` branch, and needed its own
// note explaining that surf spots are seasonal; all of that is now one rule, written once.
const beachMatchesAdvancedFilter = beachMatchesFilterKey;

// When a region is picked from the search suggestions, App keeps the region label in the
// search box (preserveSearchQueryOnRegionChange) so the user still sees e.g. "Μήλος". That
// label must NOT be applied as a per-beach name filter — no beach is named after the island,
// so it would hide every suitable card while the count (computed region-wide) stays. Treat a
// query equal to the selected island's name as "no search filter".
const normalizeBeachSearchQuery = (
  rawQuery: string,
  island: Island | null,
  language: LanguageCode,
): string => {
  const locale = language === 'gr' ? 'el-GR' : undefined;
  const normalized = rawQuery.trim().toLocaleLowerCase(locale);
  if (!normalized || !island) return normalized;
  const islandNames = [island.name.gr, island.name.en, island.name[language]]
    .map(value => value.trim().toLocaleLowerCase(locale));
  return islandNames.includes(normalized) ? '' : normalized;
};

type HomeCopy = {
  greece: string;
  /** Landing-state value proposition, shown only before an island/area is picked. */
  hero: {
    title: string;
    subtitle: string;
    wind: string;
    waves: string;
    weather: string;
  };
  searchPlaceholder: string;
  currentLocation: string;
  /** Deliberately quiet: it sits beside «Κοντά μου» and must not compete with it. */
  findingLocation: string;
  fallbackFeatureCopy: string;
  more: string;
  moreCountSuffix: string;
  changeIsland: string;
  search: string;
  searchRegionLabel: string;
  searchBeachLabel: string;
  searchLoading: string;
  searchNoResults: string;
  filter: string;
  sort: string;
  topChoiceAria: string;
  topChoiceBadge: string;
  beachMapAria: string;
  /** Desktop toggle above the map. Kept as a plain statement of what you get, not "hide the
   *  weather" — the point of the click is the bigger map, not losing the forecast. */
  fullWidthMap: string;
  showWeatherColumn: string;
  bestBeachesToday: string;
  popularDestinations: string;
  islandTitle: (title: string) => string;
  beachCount: (count: number) => string;
  conditionsOverviewAria: string;
  noForecast: string;
  allOtherBeaches: string;
  beachSearchAria: string;
  beachFiltersAria: string;
  updatedJustNow: string;
  updatedMinutes: (minutes: number) => string;
  updatedHours: (hours: number) => string;
  forecastAt: (time: string) => string;
  forecastAtYesterday: (time: string) => string;
  dustWarning: {
    elevatedTitle: string;
    elevatedBody: string;
    heavyTitle: string;
    heavyBody: string;
  };
  beachFeatures: {
    sandy: string;
    pebbles: string;
    sandPebbles: string;
    amenities: string;
    naturalShade: string;
    quiet: string;
    snorkeling: string;
  };
  islandFeatures: {
    sandy: string;
    amenities: string;
    naturalShade: string;
    quiet: string;
    snorkeling: string;
  };
  sea: {
    label: string;
    mild: string;
    missingDetail: string;
    calm: string;
    moderate: string;
    choppy: string;
    rough: string;
  };
  topSignals: {
    protected: string;
    calmWaters: string;
    easyAccess: string;
  };
};

const homeCopy: Record<LanguageCode, HomeCopy> = {
  en: {
    greece: 'Greece',
    hero: {
      title: 'Find the best beach for today',
      subtitle: 'Ranked by today’s wind and sea, and by what you want from a beach.',
      wind: 'Wind',
      waves: 'Waves',
      weather: 'Weather',
    },
    searchPlaceholder: 'Search beaches',
    currentLocation: 'Near me',
    findingLocation: 'Finding location',
    fallbackFeatureCopy: 'Beaches, map and quick filters',
    more: 'More',
    moreCountSuffix: 'more',
    changeIsland: 'Change island or area',
    search: 'Search',
    searchRegionLabel: 'Area',
    searchBeachLabel: 'Beach',
    searchLoading: 'Searching beaches…',
    searchNoResults: 'No close match yet. Press Enter to search.',
    filter: 'Filter',
    sort: 'Sort',
    topChoiceAria: 'Best beach today',
    topChoiceBadge: 'Best beach today',
    beachMapAria: 'Beach map',
    fullWidthMap: 'Wider map',
    showWeatherColumn: 'Show weather',
    bestBeachesToday: 'Best beaches today',
    popularDestinations: 'Popular destinations',
    islandTitle: (title) => title,
    beachCount: (count) => `${count} ${count === 1 ? 'beach' : 'beaches'}`,
    conditionsOverviewAria: 'Conditions overview',
    noForecast: 'No forecast is available for this area.',
    allOtherBeaches: 'All beaches',
    beachSearchAria: 'Beach search',
    beachFiltersAria: 'Beach filters',
    updatedJustNow: 'Updated just now',
    updatedMinutes: (minutes) => `Updated ${minutes} min ago`,
    updatedHours: (hours) => `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`,
    forecastAt: (time) => `Forecast from ${time}`,
    forecastAtYesterday: (time) => `Forecast from ${time} yesterday`,
    dustWarning: {
      elevatedTitle: 'Saharan dust in the air',
      elevatedBody: 'Some desert dust is drifting over — expect a slightly hazy sky. Fine for most people; sensitive groups may feel it.',
      heavyTitle: 'Heavy Saharan dust',
      heavyBody: 'A dense dust cloud sits over the area — hazy, yellowish sky and reduced visibility. Anyone with breathing issues should take it easy outdoors.',
    },
    beachFeatures: {
      sandy: 'Sandy beach',
      pebbles: 'Pebbles',
      sandPebbles: 'Sand and pebbles',
      amenities: 'Amenities',
      naturalShade: 'Natural shade',
      quiet: 'Quieter',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Sandy options',
      amenities: 'Amenities',
      naturalShade: 'Natural shade',
      quiet: 'Quiet coves',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Sea',
      mild: 'Mild',
      missingDetail: 'wave data unavailable',
      calm: 'Calm',
      moderate: 'Moderate',
      choppy: 'Choppy',
      rough: 'Rough',
    },
    topSignals: {
      protected: 'More protected',
      calmWaters: 'Calm waters',
      easyAccess: 'Easy access',
    },
  },
  gr: {
    greece: 'Ελλάδα',
    hero: {
      title: 'Βρες την καλύτερη παραλία για σήμερα',
      subtitle: 'Η σειρά βγαίνει από τον σημερινό άνεμο και τη θάλασσα, και από το τι θες εσύ σε μια παραλία.',
      wind: 'Άνεμος',
      waves: 'Κύμα',
      weather: 'Καιρός',
    },
    searchPlaceholder: 'Αναζήτηση παραλιών',
    currentLocation: 'Κοντά μου',
    findingLocation: 'Εύρεση τοποθεσίας',
    fallbackFeatureCopy: 'Παραλίες, χάρτης και γρήγορα φίλτρα',
    more: 'Περισσότερα',
    moreCountSuffix: 'ακόμη',
    changeIsland: 'Άλλο νησί ή περιοχή',
    search: 'Αναζήτηση',
    searchRegionLabel: 'Περιοχή',
    searchBeachLabel: 'Παραλία',
    searchLoading: 'Ψάχνω παραλίες…',
    searchNoResults: 'Δεν βρέθηκε κοντινό αποτέλεσμα. Πάτα Enter για αναζήτηση.',
    filter: 'Φίλτρο',
    sort: 'Ταξινόμηση',
    topChoiceAria: 'Top επιλογή σήμερα',
    topChoiceBadge: 'Top Παραλία Σήμερα',
    beachMapAria: 'Χάρτης παραλιών',
    fullWidthMap: 'Μεγαλύτερος χάρτης',
    showWeatherColumn: 'Δείξε τον καιρό',
    bestBeachesToday: 'Καταλληλότερες παραλίες σήμερα',
    popularDestinations: 'Δημοφιλείς προορισμοί',
    islandTitle: (title) => `Νησί ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'παραλία' : 'παραλίες'}`,
    conditionsOverviewAria: 'Σύνοψη συνθηκών',
    noForecast: 'Δεν υπάρχει διαθέσιμη πρόγνωση για αυτή την περιοχή.',
    allOtherBeaches: 'Όλες οι παραλίες',
    beachSearchAria: 'Αναζήτηση παραλιών',
    beachFiltersAria: 'Φίλτρα παραλιών',
    updatedJustNow: 'Ενημερώθηκε μόλις τώρα',
    // Singular, like updatedHours right below — Greek is the only locale here that spells
    // the unit out, so it is the only one that can read «πριν 1 λεπτά», and it did.
    updatedMinutes: (minutes) => `Ενημερώθηκε πριν ${minutes} ${minutes === 1 ? 'λεπτό' : 'λεπτά'}`,
    updatedHours: (hours) => `Ενημερώθηκε πριν ${hours} ${hours === 1 ? 'ώρα' : 'ώρες'}`,
    forecastAt: (time) => `Βάσει πρόγνωσης ${time}`,
    forecastAtYesterday: (time) => `Βάσει πρόγνωσης ${time} χθες`,
    dustWarning: {
      elevatedTitle: 'Αφρικανική σκόνη στην ατμόσφαιρα',
      elevatedBody: 'Περνάει σκόνη από τη Σαχάρα — λίγο θολός ουρανός. Για τους περισσότερους δεν αλλάζει κάτι· τα ευαίσθητα άτομα ίσως το νιώσουν.',
      heavyTitle: 'Πολλή αφρικανική σκόνη',
      heavyBody: 'Πυκνή σκόνη πάνω από την περιοχή — θολός, κιτρινωπός ουρανός και περιορισμένη ορατότητα. Όσοι έχουν αναπνευστικό θέμα, με μέτρο έξω.',
    },
    beachFeatures: {
      sandy: 'Αμμώδης ακτή',
      pebbles: 'Βότσαλα',
      sandPebbles: 'Άμμος και βότσαλα',
      amenities: 'Με ανέσεις',
      naturalShade: 'Φυσική σκιά',
      quiet: 'Πιο ήσυχη',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Αμμώδεις επιλογές',
      amenities: 'Με ανέσεις',
      naturalShade: 'Φυσική σκιά',
      quiet: 'Ήσυχες ακτές',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Θάλασσα',
      mild: 'Ήπια',
      missingDetail: 'χωρίς διαθέσιμο κύμα',
      calm: 'Ήρεμη',
      moderate: 'Μέτρια',
      choppy: 'Κυματισμός',
      rough: 'Έντονη',
    },
    topSignals: {
      protected: 'Πιο προστατευμένη',
      calmWaters: 'Ήρεμα νερά',
      easyAccess: 'Εύκολη πρόσβαση',
    },
  },
  fr: {
    greece: 'Grèce',
    hero: {
      title: 'Trouvez la meilleure plage pour aujourd’hui',
      subtitle: 'Le classement suit le vent et la mer du jour, et ce que vous attendez d’une plage.',
      wind: 'Vent',
      waves: 'Vagues',
      weather: 'Météo',
    },
    searchPlaceholder: 'Rechercher des plages',
    currentLocation: 'Autour de moi',
    findingLocation: 'Recherche de position',
    fallbackFeatureCopy: 'Plages, carte et filtres rapides',
    more: 'Plus',
    moreCountSuffix: 'autres',
    changeIsland: "Changer d'île ou de région",
    search: 'Rechercher',
    searchRegionLabel: 'Région',
    searchBeachLabel: 'Plage',
    searchLoading: 'Recherche de plages…',
    searchNoResults: 'Aucune correspondance proche. Appuyez sur Entrée pour chercher.',
    filter: 'Filtre',
    sort: 'Trier',
    topChoiceAria: 'Meilleure plage aujourd’hui',
    topChoiceBadge: 'Meilleure plage aujourd’hui',
    beachMapAria: 'Carte des plages',
    fullWidthMap: 'Carte plus large',
    showWeatherColumn: 'Afficher la météo',
    bestBeachesToday: 'Meilleures plages aujourd’hui',
    popularDestinations: 'Destinations populaires',
    islandTitle: (title) => `Île ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'plage' : 'plages'}`,
    conditionsOverviewAria: 'Aperçu des conditions',
    noForecast: 'Aucune prévision disponible pour cette zone.',
    allOtherBeaches: 'Toutes les plages',
    beachSearchAria: 'Recherche de plages',
    beachFiltersAria: 'Filtres de plages',
    updatedJustNow: 'Mis à jour à l’instant',
    updatedMinutes: (minutes) => `Mis à jour il y a ${minutes} min`,
    updatedHours: (hours) => `Mis à jour il y a ${hours} h`,
    forecastAt: (time) => `Prévision de ${time}`,
    forecastAtYesterday: (time) => `Prévision de ${time} hier`,
    dustWarning: {
      elevatedTitle: 'Poussière du Sahara dans l\'air',
      elevatedBody: 'De la poussière saharienne passe — ciel un peu voilé. Sans effet pour la plupart ; les personnes sensibles peuvent la ressentir.',
      heavyTitle: 'Beaucoup de poussière saharienne',
      heavyBody: 'Nuage de poussière dense sur la région — ciel jaunâtre et visibilité réduite. Les personnes ayant des difficultés respiratoires devraient se ménager.',
    },
    beachFeatures: {
      sandy: 'Plage de sable',
      pebbles: 'Galets',
      sandPebbles: 'Sable et galets',
      amenities: 'Services',
      naturalShade: 'Ombre naturelle',
      quiet: 'Plus calme',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Options sableuses',
      amenities: 'Services',
      naturalShade: 'Ombre naturelle',
      quiet: 'Criques calmes',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Mer',
      mild: 'Douce',
      missingDetail: 'données de vagues indisponibles',
      calm: 'Calme',
      moderate: 'Modérée',
      choppy: 'Clapot',
      rough: 'Agitée',
    },
    topSignals: {
      protected: 'Plus protégée',
      calmWaters: 'Eaux calmes',
      easyAccess: 'Accès facile',
    },
  },
  de: {
    greece: 'Griechenland',
    hero: {
      title: 'Finde heute den besten Strand für dich',
      subtitle: 'Die Reihenfolge folgt dem heutigen Wind und Seegang — und dem, was du am Strand suchst.',
      wind: 'Wind',
      waves: 'Wellen',
      weather: 'Wetter',
    },
    searchPlaceholder: 'Strände suchen',
    currentLocation: 'In der Nähe',
    findingLocation: 'Standort wird gesucht',
    fallbackFeatureCopy: 'Strände, Karte und Schnellfilter',
    more: 'Mehr',
    moreCountSuffix: 'weitere',
    changeIsland: 'Insel oder Region wechseln',
    search: 'Suchen',
    searchRegionLabel: 'Region',
    searchBeachLabel: 'Strand',
    searchLoading: 'Strände werden gesucht…',
    searchNoResults: 'Noch kein guter Treffer. Drücke Enter zum Suchen.',
    filter: 'Filter',
    sort: 'Sortieren',
    topChoiceAria: 'Bester Strand heute',
    topChoiceBadge: 'Bester Strand heute',
    beachMapAria: 'Strandkarte',
    fullWidthMap: 'Größere Karte',
    showWeatherColumn: 'Wetter anzeigen',
    bestBeachesToday: 'Beste Strände heute',
    popularDestinations: 'Beliebte Ziele',
    islandTitle: (title) => `Insel ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'Strand' : 'Strände'}`,
    conditionsOverviewAria: 'Bedingungsübersicht',
    noForecast: 'Für diese Region ist keine Vorhersage verfügbar.',
    allOtherBeaches: 'Alle Strände',
    beachSearchAria: 'Strandsuche',
    beachFiltersAria: 'Strandfilter',
    updatedJustNow: 'Gerade aktualisiert',
    updatedMinutes: (minutes) => `Vor ${minutes} Min. aktualisiert`,
    updatedHours: (hours) => `Vor ${hours} Std. aktualisiert`,
    forecastAt: (time) => `Vorhersage von ${time}`,
    forecastAtYesterday: (time) => `Vorhersage von ${time} gestern`,
    dustWarning: {
      elevatedTitle: 'Saharastaub in der Luft',
      elevatedBody: 'Etwas Wüstenstaub zieht durch — leicht diesiger Himmel. Für die meisten unproblematisch; empfindliche Personen können ihn spüren.',
      heavyTitle: 'Viel Saharastaub',
      heavyBody: 'Dichte Staubwolke über der Region — gelblicher Himmel, eingeschränkte Sicht. Wer Atemprobleme hat, sollte sich draußen schonen.',
    },
    beachFeatures: {
      sandy: 'Sandstrand',
      pebbles: 'Kiesel',
      sandPebbles: 'Sand und Kiesel',
      amenities: 'Ausstattung',
      naturalShade: 'Naturschatten',
      quiet: 'Ruhiger',
      snorkeling: 'Schnorcheln',
    },
    islandFeatures: {
      sandy: 'Sandoptionen',
      amenities: 'Ausstattung',
      naturalShade: 'Naturschatten',
      quiet: 'Ruhige Buchten',
      snorkeling: 'Schnorcheln',
    },
    sea: {
      label: 'Meer',
      mild: 'Mild',
      missingDetail: 'Wellendaten fehlen',
      calm: 'Ruhig',
      moderate: 'Mäßig',
      choppy: 'Wellig',
      rough: 'Rau',
    },
    topSignals: {
      protected: 'Mehr geschützt',
      calmWaters: 'Ruhiges Wasser',
      easyAccess: 'Einfacher Zugang',
    },
  },
  it: {
    greece: 'Grecia',
    hero: {
      title: 'Trova la spiaggia migliore per oggi',
      subtitle: 'L’ordine segue il vento e il mare di oggi, e quello che cerchi in una spiaggia.',
      wind: 'Vento',
      waves: 'Onde',
      weather: 'Meteo',
    },
    searchPlaceholder: 'Cerca spiagge',
    currentLocation: 'Vicino a me',
    findingLocation: 'Ricerca posizione',
    fallbackFeatureCopy: 'Spiagge, mappa e filtri rapidi',
    more: 'Altro',
    moreCountSuffix: 'altri',
    changeIsland: 'Cambia isola o regione',
    search: 'Cerca',
    searchRegionLabel: 'Area',
    searchBeachLabel: 'Spiaggia',
    searchLoading: 'Ricerca spiagge…',
    searchNoResults: 'Nessuna corrispondenza vicina. Premi Invio per cercare.',
    filter: 'Filtro',
    sort: 'Ordina',
    topChoiceAria: 'Migliore spiaggia oggi',
    topChoiceBadge: 'Migliore spiaggia oggi',
    beachMapAria: 'Mappa spiagge',
    fullWidthMap: 'Mappa più grande',
    showWeatherColumn: 'Mostra il meteo',
    bestBeachesToday: 'Migliori spiagge oggi',
    popularDestinations: 'Destinazioni popolari',
    islandTitle: (title) => `Isola ${title}`,
    beachCount: (count) => `${count} ${count === 1 ? 'spiaggia' : 'spiagge'}`,
    conditionsOverviewAria: 'Panoramica condizioni',
    noForecast: 'Nessuna previsione disponibile per questa zona.',
    allOtherBeaches: 'Tutte le spiagge',
    beachSearchAria: 'Ricerca spiagge',
    beachFiltersAria: 'Filtri spiagge',
    updatedJustNow: 'Aggiornato ora',
    updatedMinutes: (minutes) => `Aggiornato ${minutes} min fa`,
    updatedHours: (hours) => `Aggiornato ${hours} h fa`,
    forecastAt: (time) => `Previsione delle ${time}`,
    forecastAtYesterday: (time) => `Previsione delle ${time} di ieri`,
    dustWarning: {
      elevatedTitle: 'Polvere sahariana nell\'aria',
      elevatedBody: 'Sta passando un po\' di polvere dal Sahara — cielo leggermente velato. Per la maggior parte delle persone nessun problema; i soggetti sensibili potrebbero avvertirla.',
      heavyTitle: 'Molta polvere sahariana',
      heavyBody: 'Densa nube di polvere sulla zona — cielo giallastro e visibilità ridotta. Chi ha problemi respiratori dovrebbe limitare gli sforzi all\'aperto.',
    },
    beachFeatures: {
      sandy: 'Spiaggia sabbiosa',
      pebbles: 'Ciottoli',
      sandPebbles: 'Sabbia e ciottoli',
      amenities: 'Servizi',
      naturalShade: 'Ombra naturale',
      quiet: 'Più tranquilla',
      snorkeling: 'Snorkeling',
    },
    islandFeatures: {
      sandy: 'Opzioni sabbiose',
      amenities: 'Servizi',
      naturalShade: 'Ombra naturale',
      quiet: 'Calette tranquille',
      snorkeling: 'Snorkeling',
    },
    sea: {
      label: 'Mare',
      mild: 'Mite',
      missingDetail: 'dati onde non disponibili',
      calm: 'Calmo',
      moderate: 'Moderato',
      choppy: 'Ondoso',
      rough: 'Mosso',
    },
    topSignals: {
      protected: 'Più protetta',
      calmWaters: 'Acque calme',
      easyAccess: 'Accesso facile',
    },
  },
};

const getImageSet = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (!imagePath.endsWith('.jpg')) return `url(${imagePath})`;
  return `image-set(url(${imagePath.replace(/\.jpg$/, '.webp')}) type("image/webp"), url(${imagePath}) type("image/jpeg"))`;
};

const getIslandFeatureLabels = (island: Island, language: LanguageCode): string[] => {
  const copy = getLocalizedCopy(language, homeCopy).islandFeatures;
  const beaches = island.beaches || [];
  if (beaches.length === 0) return [];

  const count = (predicate: (beach: Beach) => boolean) => beaches.filter(predicate).length;
  const labels: string[] = [];
  const threshold = Math.max(2, Math.round(beaches.length * 0.25));

  if (count(beach => beach.beachType === 'sandy' || beach.beachType === 'sandy-pebbles') >= threshold) {
    labels.push(copy.sandy);
  }
  if (count(beach => beach.amenities?.beachBar || beach.amenities?.organized) >= threshold) {
    labels.push(copy.amenities);
  }
  if (count(beach => beach.amenities?.naturalShade) >= threshold) {
    labels.push(copy.naturalShade);
  }
  if (count(beach => beach.environment?.quiet) >= threshold) {
    labels.push(copy.quiet);
  }
  if (count(beach => beach.activities?.snorkeling) >= threshold) {
    labels.push(copy.snorkeling);
  }

  return labels.slice(0, 3);
};

const formatDirectoryDate = (date: Date, language: LanguageCode) => {
  const absoluteDateLabel = new Intl.DateTimeFormat(languageToDateLocale(language), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const dayOffset = getSelectedDayOffset(date);

  if (dayOffset >= 0 && dayOffset <= 2) {
    return `${getSelectedDaySentencePrefix(date, athensNow(), language)}, ${absoluteDateLabel}`;
  }

  return absoluteDateLabel;
};

const formatUpdatedAgo = (lastUpdated: Date | null | undefined, language: LanguageCode) => {
  if (!lastUpdated) return undefined;

  const copy = getLocalizedCopy(language, homeCopy);
  // athens-clock-exempt: age of the forecast in real minutes, not a wall-clock reading.
  const minutes = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 60000));
  if (minutes < 1) return copy.updatedJustNow;
  if (minutes < 60) return copy.updatedMinutes(minutes);
  const hours = Math.round(minutes / 60);
  return copy.updatedHours(hours);
};

const BeachImageFallback: React.FC = () => (
  <div
    className="absolute inset-0 overflow-hidden bg-sky-100"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-sky-50 to-teal-50" />
    <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-cyan-200/40 blur-2xl" />
    <div className="absolute right-6 top-6 h-16 w-16 rounded-full border border-white/55 bg-white/34 shadow-inner shadow-white/40" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.72),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.38),transparent_45%)]" />
    <div className="absolute left-0 right-0 top-[48%] h-px bg-cyan-200/35" />
    <svg className="absolute inset-x-0 bottom-0 h-full w-full text-cyan-300/58" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 112 C70 106 120 107 190 112 C260 117 320 116 400 110 L400 160 L0 160 Z" fill="currentColor" />
    </svg>
    <svg className="absolute inset-x-0 bottom-0 h-full w-full text-sky-300/46" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 122 C60 118 120 119 190 123 C260 127 320 127 400 121 L400 160 L0 160 Z" fill="currentColor" />
    </svg>
    <svg className="absolute inset-x-0 bottom-0 h-full w-full text-white/88" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 135 C90 132 150 133 230 136 C300 139 350 138 400 134 L400 160 L0 160 Z" fill="currentColor" />
    </svg>
    <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100/90 bg-white/95 text-cyan-700 shadow-sm shadow-sky-900/10">
        <Waves className="h-5 w-5" aria-hidden="true" />
      </div>
    </div>
  </div>
);

const getBestBeachesLabel = (language: LanguageCode, selectedDate?: Date, timePrefix?: string, beaufort?: number): string => {
  const day = timePrefix ?? getSelectedDayPrefix(selectedDate, athensNow(), language);

  // From 5 Bft up, the wind dominates the decision: we're no longer ranking the
  // "best" beaches but pointing to the more sheltered ones, so the framing shifts.
  if (typeof beaufort === 'number' && beaufort >= 5) {
    return getLocalizedCopy(language, {
      en: `More sheltered beaches ${day}`,
      gr: `Πιο προστατευμένες παραλίες ${day}`,
      fr: `Plages plus abritées ${day}`,
      de: `Geschütztere Strände ${day}`,
      it: `Spiagge più riparate ${day}`,
    });
  }

  return getLocalizedCopy(language, {
    en: `Best beaches ${day}`,
    gr: `Καταλληλότερες παραλίες ${day}`,
    fr: `Meilleures plages ${day}`,
    de: `Beste Strände ${day}`,
    it: `Migliori spiagge ${day}`,
  });
};

// Neutral heading for calm days (≤2 Bft): the wind doesn't separate beaches, so
// every beach is suitable and there is nothing to rank — calling them the
// "best/most suitable" implies a curated subset that doesn't exist. The
// "καταλληλότερες/best" framing is reserved for the windy regime (≥3 Bft).
const getAllBeachesLabel = (language: LanguageCode, selectedDate?: Date, timePrefix?: string): string => {
  const day = timePrefix ?? getSelectedDayPrefix(selectedDate, athensNow(), language);

  return getLocalizedCopy(language, {
    en: `All beaches suitable ${day}`,
    gr: `Όλες οι παραλίες κατάλληλες ${day}`,
    fr: `Toutes les plages adaptées ${day}`,
    de: `Alle Strände geeignet ${day}`,
    it: `Tutte le spiagge adatte ${day}`,
  });
};

/**
 * Heading for the list while a colour is picked on the map legend — «Δύσκολες παραλίες στις 17:00».
 *
 * Deliberately NOT reused from the legend's own `toneLabel` in BeachMap: that is a singular
 * adjective describing one beach («Δύσκολη»), and a heading needs the plural noun phrase. Sharing
 * one string would produce broken Greek in one place or the other. What must stay in step is the
 * COVERAGE — every tone the ladder can paint needs an entry here in all five languages, which
 * scripts/validateConditionToneAgreement.mjs checks the same way it checks the legend words.
 */
const getToneFilterLabel = (
  tone: CalmnessTone,
  language: LanguageCode,
  selectedDate?: Date,
  timePrefix?: string,
): string => {
  const day = timePrefix ?? getSelectedDayPrefix(selectedDate, athensNow(), language);

  const headings = getLocalizedCopy<Record<CalmnessTone, string>>(language, {
    en: {
      red: `Difficult beaches ${day}`,
      orange: `Fair beaches ${day}`,
      yellow: `Good beaches ${day}`,
      blue: `Excellent beaches ${day}`,
    },
    gr: {
      red: `Δύσκολες παραλίες ${day}`,
      orange: `Μέτριες παραλίες ${day}`,
      yellow: `Καλές παραλίες ${day}`,
      blue: `Ιδανικές παραλίες ${day}`,
    },
    fr: {
      red: `Plages difficiles ${day}`,
      orange: `Plages correctes ${day}`,
      yellow: `Bonnes plages ${day}`,
      blue: `Plages idéales ${day}`,
    },
    de: {
      red: `Schwierige Strände ${day}`,
      orange: `Mäßige Strände ${day}`,
      yellow: `Gute Strände ${day}`,
      blue: `Ideale Strände ${day}`,
    },
    it: {
      red: `Spiagge difficili ${day}`,
      orange: `Spiagge discrete ${day}`,
      yellow: `Buone spiagge ${day}`,
      blue: `Spiagge ideali ${day}`,
    },
  });

  return headings[tone];
};

// Per-beach intra-day exposure shift for the selected-beach strip line. Runs the
// real wind-exposure engine hour by hour (using the beach's geospatial profile),
// so it catches BOTH the wind strengthening and the wind veering to a direction
// the beach is exposed to — not just an island-wide wind rise. Returns a localized
// "calm until HH, then exposed" phrase, or undefined when the day stays steady.
const buildBeachIntradayShift = (
  beach: Beach,
  geospatialProfile: SuitableBeach['geospatialExposure'],
  hourly: DailyForecast['hourly'],
  language: LanguageCode,
): string | undefined => {
  const states = hourly
    .map(item => {
      const hour = new Date(item.dt * 1000).getHours();
      if (hour < 8 || hour > 20) return undefined;
      const beaufort = getBeaufortLevel(item.wind.speed * 3.6);
      if (beaufort <= 2) return { hour, exposed: false };
      const assessment = assessBeachWindExposure({
        beach,
        geospatialProfile,
        windDirectionDeg: item.wind.deg,
        windDirection: degToCompass(item.wind.deg),
        windSpeedKmh: item.wind.speed * 3.6,
        beaufort,
      });
      return { hour, exposed: assessment.exposureLevel === 'exposed' };
    })
    .filter((state): state is { hour: number; exposed: boolean } => Boolean(state))
    .sort((a, b) => a.hour - b.hour);
  if (states.length < 3) return undefined;

  const morningExposed = states[0].exposed;
  for (let i = 1; i < states.length; i++) {
    if (states[i].exposed === morningExposed) continue;
    // Require the new state to hold for ≥2 of the next 3 hours (no single-hour blip).
    const ahead = states.slice(i, i + 3);
    if (ahead.filter(state => state.exposed === states[i].exposed).length < 2) continue;
    const at = `${String(states[i].hour).padStart(2, '0')}:00`;
    return !morningExposed && states[i].exposed
      ? getLocalizedCopy(language, {
        en: `calm until ${at}, then exposed to the wind`,
        gr: `καλά ως τις ${at}, μετά εκτίθεται στον άνεμο`,
        de: `ruhig bis ${at}, danach windexponiert`,
        it: `tranquillo fino alle ${at}, poi esposto al vento`,
        fr: `calme jusqu'à ${at}, puis exposé au vent`,
      })
      : getLocalizedCopy(language, {
        en: `exposed until ${at}, then it settles`,
        gr: `δύσκολα ως τις ${at}, μετά στρώνει`,
        de: `schwierig bis ${at}, danach beruhigt es sich`,
        it: `difficile fino alle ${at}, poi si calma`,
        fr: `difficile jusqu'à ${at}, puis ça se calme`,
      });
  }
  return undefined;
};

/**
 * TIMELESS on purpose (09/08/2026). This is the podium's SUBTITLE, and the question above it now
 * carries the when («τώρα» / «στις 18:00–19:00» / «αύριο»). With the time here too, the block
 * opened by saying the hour twice in two consecutive lines — and the list header below says it a
 * third time. One claim, one place: the when lives in the title, this line counts the picks.
 */
const getTopRecommendationsLabel = (language: LanguageCode, count: number, beaufort?: number): string => {
  const displayCount = Math.max(1, Math.min(3, count));

  // One name in every weather — see topTabLabel for why the >4 Bft rename was dropped.
  if (displayCount === 1) {
    return getLocalizedCopy(language, {
      en: 'Top pick',
      gr: 'Top επιλογή',
      fr: 'Meilleur choix',
      de: 'Top-Empfehlung',
      it: 'Scelta top',
    });
  }

  return getLocalizedCopy(language, {
    en: `Top ${displayCount} picks`,
    gr: `Top ${displayCount} επιλογές`,
    fr: `Top ${displayCount} choix`,
    de: `Top ${displayCount} Empfehlungen`,
    it: `Top ${displayCount} scelte`,
  });
};

/**
 * THE MOBILE PODIUM TITLE — one plain line, no question.
 *
 * 09/08/2026 evening: the question form (getTopRecommendationsQuestion below) shipped to both
 * viewports the same afternoon, and Miltos asked for mobile to go back to a flat statement —
 * «Top 3 Επιλογές στις 16:00–17:00» — with the count and the hour in ONE line and no «Πού να
 * πάμε;» framing. Desktop keeps the question (getTopRecommendationsQuestion); this is mobile-only,
 * selected by `isMobileViewport` at the render site.
 */
const getMobileTopRecommendationsTitle = (
  language: LanguageCode,
  count: number,
  timePrefix: string | undefined,
  beaufort?: number
): string => {
  const displayCount = Math.max(1, Math.min(3, count));
  const when = timePrefix ? ` ${timePrefix}` : '';

  // One name in every weather — see topTabLabel for why the >4 Bft rename was dropped.
  if (displayCount === 1) {
    return getLocalizedCopy(language, {
      en: `Top pick${when}`,
      gr: `Top επιλογή${when}`,
      fr: `Meilleur choix${when}`,
      de: `Top-Empfehlung${when}`,
      it: `Scelta top${when}`,
    });
  }

  return getLocalizedCopy(language, {
    en: `Top ${displayCount} picks${when}`,
    gr: `Top ${displayCount} επιλογές${when}`,
    fr: `Top ${displayCount} choix${when}`,
    de: `Top ${displayCount} Empfehlungen${when}`,
    it: `Top ${displayCount} scelte${when}`,
  });
};

/**
 * THE QUESTION THE PODIUM ANSWERS, printed above it. DESKTOP ONLY as of 09/08/2026 evening — see
 * getMobileTopRecommendationsTitle for the plain mobile line.
 *
 * Until 09/08/2026 the top-3 carried a quiet «Top 3 επιλογές τώρα» in 12px between two hairlines —
 * indistinguishable from the section heading of the list below it, so nothing on the page said
 * that this block IS the answer. A rival ships the same three beaches under an explicit question.
 * We ask it too, and the picks answer it directly underneath.
 *
 * WHEN IT SAYS «ΤΩΡΑ» AND WHEN IT DOES NOT: today with no hour chosen is present tense («τώρα»),
 * never a «σήμερα» stamp — the standing rule against date-stamping dynamic copy. The moment the
 * visitor moves the hour slider or picks another day, the question names that instead, because the
 * cards under it then describe that moment and a stale «τώρα» would be the 31/07/2026 defect
 * («Ήρεμα ΤΩΡΑ» over another hour's numbers) rebuilt one level up.
 */
/**
 * ΜΙΑ ΚΡΙΣΗ ΓΙΑ ΤΟ «ΤΩΡΑ», ΟΧΙ ΜΙΑ ΑΝΑ ΠΡΟΤΑΣΗ (Μίλτος, 12/08/2026).
 *
 * The podium's question asked it here, and the podium's subtitle right underneath said «τώρα»
 * unconditionally — so on tomorrow's forecast the two lines disagreed, and the one that was wrong
 * («Καμία δεν είναι ιδανική τώρα» over tomorrow's picks) was the one making the safety claim.
 * Every line that wants to say «now» asks this.
 */
const isViewedMomentNow = (selectedDate: Date | undefined, isNowHour: boolean): boolean =>
  isNowHour && getSelectedDayOffset(selectedDate, athensNow()) === 0;

const getTopRecommendationsQuestion = (
  language: LanguageCode,
  selectedDate: Date | undefined,
  timePrefix?: string,
  isNowHour = false
): string => {
  const offset = getSelectedDayOffset(selectedDate, athensNow());
  // The slider ALWAYS has a selected hour, so `timePrefix` always exists and the bare-«τώρα»
  // branch below was unreachable — every visitor read «Πού να πάμε στις 16:00–17:00;» even when
  // that hour was simply the one they were standing in. `isNowHour` (computed in App against the
  // slider's own slot-0-is-now contract) is what makes «τώρα» honest: it holds exactly while the
  // cards below describe the present, and drops the moment the slider moves.
  const when = isViewedMomentNow(selectedDate, isNowHour)
    ? undefined
    : timePrefix ?? (offset === 0 ? undefined : getSelectedDayPrefix(selectedDate, athensNow(), language));

  if (!when) {
    return getLocalizedCopy(language, {
      en: 'Where should we go right now?',
      gr: 'Πού να πάμε τώρα;',
      fr: 'Où aller maintenant ?',
      de: 'Wohin sollen wir jetzt?',
      it: 'Dove andiamo adesso?',
    });
  }

  return getLocalizedCopy(language, {
    en: `Where should we go ${when}?`,
    gr: `Πού να πάμε ${when};`,
    fr: `Où aller ${when} ?`,
    de: `Wohin sollen wir ${when}?`,
    it: `Dove andiamo ${when}?`,
  });
};

const getRemainingSuitableLabel = (language: LanguageCode, selectedDate?: Date, timePrefix?: string): string => {
  const day = timePrefix ?? getSelectedDayPrefix(selectedDate, athensNow(), language);

  return getLocalizedCopy(language, {
    en: `Other suitable beaches ${day}`,
    gr: `Υπόλοιπες κατάλληλες ${day}`,
    fr: `Autres plages adaptées ${day}`,
    de: `Weitere passende Strände ${day}`,
    it: `Altre spiagge adatte ${day}`,
  });
};

const withCount = (label: string, count?: number): string => (
  typeof count === 'number' && count > 0 ? `${label} (${count})` : label
);

/** Heading over the ready-made intent bundles. Deliberately an invitation and not a label
 *  («Δοκίμασε», not «Φίλτρα»): the row sits inside the search dropdown, where the user came
 *  to type, so it has to read as a shortcut for what they were about to write. */
const intentPanelLeadCopy: Record<LanguageCode, string> = {
  gr: 'Δοκίμασε',
  en: 'Try',
  de: 'Probier',
  fr: 'Essayez',
  it: 'Prova',
};

export const BeachSearcherHome: React.FC<BeachSearcherHomeProps> = ({
  language,
  hasActiveSearchOrFilters = false,
  onClearSearchAndFilters,
  nearMeMissDistanceKm,
  onBackToNearMe,
  selectedIsland,
  allIslands,
  regionWindNote,
  rainWarning,
  dustLevel,
  searchQuery,
  sortBy,
  isMobileViewport = false,
  isAllBeachesPanelOpen: controlledAllBeachesPanelOpen,
  onAllBeachesPanelOpenChange,
  isWeatherPanelOpen: controlledWeatherPanelOpen,
  onWeatherPanelOpenChange,
  suitableDistanceSortActive = false,
  locationSortResetKey,
  resultListResetKey,
  preferences,
  activeFilters = [],
  filterResultCounts,
  advancedFilterResultCounts,
  filteredResultCount,
  activeFilterCount,
  searchSuggestions = [],
  isSearchSuggesting = false,
  intentBundles = [],
  onIntentBundleSelect,
  protectedSortLabel,
  currentBeaufort,
  mapForecastTimeLabel,
  mapDayStrip,
  mapPreview,
  topRecommendationCards,
  topColourOutsideTopPicksIds,
  topPickNow,
  shelteredFallbackPodium = false,
  dayTurnNote,
  suitableBeachCards,
  suitableBeachTotalCount,
  suitableTimePrefix,
  suitableTimeIsNow = false,
  activeToneFilter = null,
  filterDropNote,
  suitableListCoversEverything = false,
  onActiveSuitableBeachChange,
  directorySearchCardFocus,
  showSuitableBeachSection = true,
  allBeachCards,
  beachWeatherContexts,
  forecastDays,
  selectedDayIndex,
  selectedForecast,
  perBeachMapWind,
  forecastFreshness = 'fresh',
  mapSelectedHour,
  selectedDate,
  lastUpdated,
  favorites,
  t,
  onToggleFavorite,
  onSearchChange,
  onSearchSubmit,
  onSearchSuggestionSelect,
  onOpenFilters,
  onOpenIslandSelector,
  onUseCurrentLocation,
  onShowNearbyBeaches,
  onRequestUserLocation,
  onDistanceSortActiveChange,
  hasUserLocation = false,
  isFindingCurrentLocation = false,
  currentLocationError,
  onCategorySelect,
  onAdvancedFilterToggle,
  onClearAllFilters,
  onForecastDaySelect,
  onBeachClick,
  onSelectIsland,
  strongWindContext = false,
  isExposureLoading = false,
}) => {
  const copy = getLocalizedCopy(language, homeCopy);
  const bestBeachesLabel = getBestBeachesLabel(language, selectedDate, suitableTimePrefix, currentBeaufort);
  const allBeachesLabel = getAllBeachesLabel(language, selectedDate, suitableTimePrefix);
  const [isDirectorySortOpen, setIsDirectorySortOpen] = useState(false);
  const [directoryViewCriteria, setDirectoryViewCriteria] = useState({
    suitable: true,
    distance: false,
  });
  const isDistanceSortActive = directoryViewCriteria.distance || suitableDistanceSortActive;
  const [localAllBeachesPanelOpen, setLocalAllBeachesPanelOpen] = useState(false);
  const [localWeatherPanelOpen, setLocalWeatherPanelOpen] = useState(false);
  const isAllBeachesPanelOpen = controlledAllBeachesPanelOpen ?? localAllBeachesPanelOpen;
  const setIsAllBeachesPanelOpen = onAllBeachesPanelOpenChange ?? setLocalAllBeachesPanelOpen;
  const isWeatherPanelOpen = controlledWeatherPanelOpen ?? localWeatherPanelOpen;
  const setIsWeatherPanelOpen = onWeatherPanelOpenChange ?? setLocalWeatherPanelOpen;
  /**
   * Desktop only: hide the weather column and give its width to the map.
   *
   * Deliberately OPT-OUT, not opt-in. A drawer that starts closed was the first idea, and it
   * is the same shape as the mistake the planner already made here — it asked "how many
   * days?" and 99% of visitors never answered (GA, 28 days), which is why the plan now shows
   * itself. The forecast is the evidence behind the map's colours; hiding it by default would
   * quietly cost every first-time visitor that, to save a click for the few who want a bigger
   * map. So it opens as before, the choice is one click away, and it sticks.
   *
   * Read lazily in the initialiser rather than in an effect: setting it after paint would
   * flash the weather column in for one frame on every load for someone who turned it off.
   */
  const [isWeatherColumnHidden, setIsWeatherColumnHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(WEATHER_COLUMN_HIDDEN_KEY) === 'true';
    } catch {
      // Private mode / blocked storage: the toggle still works, it just won't be remembered.
      return false;
    }
  });
  const toggleWeatherColumn = () => {
    setIsWeatherColumnHidden(previous => {
      const next = !previous;
      try {
        window.localStorage.setItem(WEATHER_COLUMN_HIDDEN_KEY, String(next));
      } catch {
        /* not remembering the preference is not a reason to refuse the click */
      }
      return next;
    });
    // No manual invalidateSize here — BeachMap's own ResizeObserver (MapAutoResize) already
    // watches its container, and the column change resizes it.
  };
  const directorySortRef = useRef<HTMLDivElement>(null);
  const desktopDirectorySortRef = useRef<HTMLDivElement>(null);
  const [isDesktopMoreFiltersOpen, setIsDesktopMoreFiltersOpen] = useState(false);
  const desktopMoreFiltersRef = useRef<HTMLDivElement>(null);
  const desktopFilterRowRef = useRef<HTMLDivElement>(null);
  const desktopFilterMeasureRef = useRef<HTMLDivElement>(null);
  const topRecommendationsCarouselRef = useRef<HTMLDivElement>(null);
  const suitableCarouselRef = useRef<HTMLDivElement>(null);
  /**
   * «Top 3» / «Υπόλοιπες» live in ONE tabbed surface right under the map (Miltos, 09/08 evening):
   * scrolling down to the second list loses sight of the live map, and the map is where you see
   * WHERE each beach is. Both panels stay MOUNTED and the inactive one is CSS-hidden — the
   * pin-highlight machinery attaches scroll/drag listeners to these exact carousel elements via
   * the two refs above, and unmounting a panel would silently detach the pin blink for whichever
   * list is off screen.
   */
  const [activePicksTab, setActivePicksTab] = useState<'top' | 'rest'>('top');
  useEffect(() => {
    setActivePicksTab('top');
  }, [selectedIsland?.id]);
  const directoryCarouselRef = useRef<HTMLDivElement>(null);
  const allBeachesPanelScrollRef = useRef<HTMLDivElement>(null);
  const activeSuitableBeachIdRef = useRef<number | undefined>(undefined);
  const isCarouselScrollingRef = useRef(false);
  const [activeMapLinkedBeachId, setActiveMapLinkedBeachId] = useState<number | undefined>(undefined);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false);
  const [isIntentPanelOpen, setIsIntentPanelOpen] = useState(false);
  const [activeSearchSuggestionIndex, setActiveSearchSuggestionIndex] = useState(-1);
  const activePlaceName = selectedIsland?.name[language] || copy.greece;
  const isNearMeRegion = selectedIsland?.id === 'near-me';
  const regionBeaches = selectedIsland?.beaches || [];
  // Info-only regions (e.g. Milos): show a plain browsable beach list, but no
  // today-recommendation ranking (podium carousel / top-choice hero / rank medals).
  const infoOnly = isInfoOnlyRegionId(selectedIsland?.id);
  const hasRegionFilterAvailabilityData = regionBeaches.length > 0;
  const filterPreferenceForRegion = (filter: QuickPreferenceFilter) => (
    !hasRegionFilterAvailabilityData ||
    preferences[filter] ||
    regionBeaches.some(beach => beachMatchesPreferenceFilter(beach, filter))
  );
  const visibleDesktopPrimaryPreferenceFilters = desktopPrimaryPreferenceFilters.filter(filterPreferenceForRegion);
  const visibleDesktopSecondaryPreferenceFilters = desktopSecondaryPreferenceFilters.filter(filterPreferenceForRegion);
  const visibleDesktopAdvancedFilters = desktopAdvancedFilters.filter(filter => (
    !hasRegionFilterAvailabilityData ||
    activeFilters.includes(filter.key) ||
    regionBeaches.some(beach => beachMatchesAdvancedFilter(beach, filter.key))
  ));
  const buildPreferenceItem = (filter: QuickPreferenceFilter) => ({
    itemKey: `preference-${filter}`,
    kind: 'preference' as const,
    key: filter,
    icon: filterIcons[filter],
    label: getPreferenceFilterLabel(filter, language, t),
    count: filterResultCounts?.[filter],
    isActive: preferences[filter],
  });
  const desktopFilterItems: DesktopFilterItem[] = [
    ...visibleDesktopPrimaryPreferenceFilters.map(buildPreferenceItem),
    ...visibleDesktopAdvancedFilters.map(filter => ({
      itemKey: `advanced-${filter.key}`,
      kind: 'advanced' as const,
      key: filter.key,
      icon: filter.icon,
      label: t.filterOptions[filter.key as keyof typeof t.filterOptions] || String(filter.key),
      count: advancedFilterResultCounts?.[filter.key],
      isActive: activeFilters.includes(filter.key),
    })),
    ...visibleDesktopSecondaryPreferenceFilters.map(buildPreferenceItem),
  ];
  const [desktopVisibleFilterCount, setDesktopVisibleFilterCount] = useState(desktopFilterItems.length);
  const desktopFilterMeasureKey = desktopFilterItems
    .map(item => `${item.itemKey}:${item.label}:${item.count ?? ''}:${item.isActive ? 1 : 0}`)
    .join('|');

  useLayoutEffect(() => {
    const row = desktopFilterRowRef.current;
    const measure = desktopFilterMeasureRef.current;
    if (!row || !measure) return;

    const GAP = 8; // matches gap-2 between chips
    const MORE_RESERVE = 224; // ~13.5rem "More" button + gap

    const compute = () => {
      const containerWidth = row.clientWidth;
      if (containerWidth <= 0) return;

      const chipWidths = Array.from(measure.children).map(
        child => (child as HTMLElement).getBoundingClientRect().width
      );
      const totalCount = chipWidths.length;
      if (totalCount === 0) {
        setDesktopVisibleFilterCount(0);
        return;
      }

      let fullTotal = 0;
      chipWidths.forEach((width, index) => {
        fullTotal += width + (index > 0 ? GAP : 0);
      });
      if (fullTotal <= containerWidth) {
        setDesktopVisibleFilterCount(totalCount);
        return;
      }

      const available = containerWidth - MORE_RESERVE;
      let used = 0;
      let count = 0;
      for (let index = 0; index < totalCount; index += 1) {
        const next = chipWidths[index] + (count > 0 ? GAP : 0);
        if (used + next > available) break;
        used += next;
        count += 1;
      }
      setDesktopVisibleFilterCount(Math.max(1, count));
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(row);
    return () => observer.disconnect();
  }, [desktopFilterMeasureKey]);

  const desktopVisibleFilterItems = desktopFilterItems.slice(0, desktopVisibleFilterCount);
  const desktopHiddenFilterItems = desktopFilterItems.slice(desktopVisibleFilterCount);
  const hasVisibleDesktopMoreFilters = desktopHiddenFilterItems.length > 0;
  const desktopMoreActiveCount = desktopHiddenFilterItems.filter(filter => filter.isActive).length;

  useEffect(() => {
    if (!isAllBeachesPanelOpen && !isWeatherPanelOpen) return undefined;
    if (typeof document === 'undefined') return undefined;

    // iOS Safari ignores `body { overflow: hidden }` for touch scrolling, so the page
    // behind the full-screen panel keeps scrolling and peeks through as the fixed
    // overlay shifts against the dynamic viewport. Pin the body in place instead and
    // restore the scroll position on close — this actually locks the background.
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      // 'instant' spelled out: the two-argument scrollTo obeys `html { scroll-behavior: smooth }`
      // (index.css), so putting the reader back where they were ANIMATED them back — a page that
      // slides on its own the moment a panel closes, instead of simply being where it was.
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
    };
  }, [isAllBeachesPanelOpen, isWeatherPanelOpen]);

  useEffect(() => {
    if (isMobileViewport) return;
    setIsAllBeachesPanelOpen(false);
    setIsWeatherPanelOpen(false);
  }, [isMobileViewport]);

  useEffect(() => {
    setIsAllBeachesPanelOpen(false);
    setIsWeatherPanelOpen(false);
    setActiveMapLinkedBeachId(undefined);
  }, [selectedIsland?.id]);

  /**
   * What is on screen in the box, updated the instant a key is pressed. `searchQuery` is the
   * page's copy and arrives a beat later, on purpose: one keypress used to mean one full
   * re-render — map, pins, every card — before the letter could appear, measured at 342ms
   * for the first character and ~90ms for each one after on a throttled phone. The heavy
   * half now runs as a transition React can abandon when the next key arrives, so only the
   * text the visitor actually stopped on is ever searched for.
   *
   * `lastSentRef` tells our own echo apart from the page changing the text on its own (the
   * clear button, picking a suggestion, a query restored from the address bar); the echo is
   * ignored so it cannot overwrite letters typed since, anything else wins.
   */
  const [searchDraft, setSearchDraft] = useState(searchQuery);
  const lastSentSearchRef = useRef(searchQuery);
  useEffect(() => {
    if (searchQuery === lastSentSearchRef.current) return;
    lastSentSearchRef.current = searchQuery;
    setSearchDraft(searchQuery);
  }, [searchQuery]);
  const pushSearchQuery = (next: string, urgent = false) => {
    setSearchDraft(next);
    lastSentSearchRef.current = next;
    if (urgent) onSearchChange(next);
    else startTransition(() => onSearchChange(next));
  };

  const trimmedSearchQuery = searchQuery.trim();
  // A by-name search means cards are matches, not the day's ranking: suppress the
  // "top beach" medal and instead surface each result's own today-verdict so a
  // looked-up beach shows its status at a glance (handles the 3–4 Bft band too).
  const isNameSearchActive = trimmedSearchQuery.length > 0;
  const canShowSearchSuggestions = trimmedSearchQuery.length >= 2 && Boolean(onSearchSuggestionSelect);
  const shouldRenderSearchSuggestions = isSearchSuggestionsOpen && canShowSearchSuggestions;
  const searchSuggestionListId = 'directory-search-suggestions';
  /* The bundle panel keeps its OWN open flag instead of reusing isSearchSuggestionsOpen.
     That flag is force-closed below on every keystroke that leaves fewer than 2 characters
     — exactly the state the bundle panel lives in — so sharing it would make the panel
     flicker shut the moment it was supposed to appear. */
  const shouldRenderIntentPanel =
    isIntentPanelOpen && trimmedSearchQuery.length === 0 && intentBundles.length > 0 && Boolean(onIntentBundleSelect);

  useEffect(() => {
    if (trimmedSearchQuery.length >= 2) return;
    setIsSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
  }, [trimmedSearchQuery]);

  useEffect(() => {
    if (!isSearchSuggestionsOpen && !isIntentPanelOpen) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!searchBoxRef.current || searchBoxRef.current.contains(event.target as Node)) return;
      setIsSearchSuggestionsOpen(false);
      setIsIntentPanelOpen(false);
      setActiveSearchSuggestionIndex(-1);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isSearchSuggestionsOpen, isIntentPanelOpen]);

  const handleIntentBundleSelect = (key: string) => {
    setIsIntentPanelOpen(false);
    setIsSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
    onIntentBundleSelect?.(key);
  };

  const handleSearchSuggestionSelect = (suggestion: DirectorySearchSuggestion) => {
    setIsSearchSuggestionsOpen(false);
    setActiveSearchSuggestionIndex(-1);
    onSearchSuggestionSelect?.(suggestion);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && canShowSearchSuggestions) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(true);
      setActiveSearchSuggestionIndex(current => {
        if (searchSuggestions.length === 0) return -1;
        if (event.key === 'ArrowDown') return Math.min(current + 1, searchSuggestions.length - 1);
        return current <= 0 ? searchSuggestions.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === 'Enter' && isSearchSuggestionsOpen && activeSearchSuggestionIndex >= 0) {
      const selectedSuggestion = searchSuggestions[activeSearchSuggestionIndex];
      if (selectedSuggestion) {
        event.preventDefault();
        handleSearchSuggestionSelect(selectedSuggestion);
      }
      return;
    }

    if (event.key === 'Escape' && (isSearchSuggestionsOpen || isIntentPanelOpen)) {
      event.preventDefault();
      setIsSearchSuggestionsOpen(false);
      setIsIntentPanelOpen(false);
      setActiveSearchSuggestionIndex(-1);
    }
  };

  useEffect(() => {
    if (!isAllBeachesPanelOpen && !isWeatherPanelOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsAllBeachesPanelOpen(false);
      setIsWeatherPanelOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAllBeachesPanelOpen, isWeatherPanelOpen]);

  const sortedIslandCards = useMemo(() => (
    [...allIslands]
      .filter(island => island.beaches.length > 0 && !isInfoOnlyRegionId(island.id))
      .sort((a, b) => b.beaches.length - a.beaches.length)
      .slice(0, 8)
  ), [allIslands]);

  const popularBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    // popularityScore/rating are synthetic (deterministic hash of the beach id) and must not
    // drive this ordering — rank by real signals: photo coverage, amenity richness, then name.
    const amenityRichness = (beach: Beach) => Object.values(beach.amenities || {}).filter(value => value === true).length;
    // Miltos 2026-06-20: this list is the fallback the suitable carousel renders when no beach
    // is suitable (typically ≥5 Bft), and it gets numbered like top picks. An iconic boat-only
    // beach (e.g. Κλεφτικό) would otherwise rank high here and show as "top pick #1" at strong
    // wind — exactly what we promised never to do. Drop boat-only beaches at ≥5 Bft (kept when
    // the user is actively searching, so they stay findable by name), mirroring the App-level
    // boat-access filter that this fallback path bypasses.
    //
    // 02/08/2026: the 5 Bft is the wind on the beach's OWN shore where we have it, exactly like
    // the App-level filter. A beach with no local reading keeps the region's number.
    const canHideBoatOnly = searchQuery.trim().length === 0;
    const isBoatOnlyBlownOut = (beach: Beach): boolean => {
      if (!hasBoatOnlyAccess(beach)) return false;
      const localBeaufort = perBeachMapWind?.get(beach.id)?.beaufort;
      const beaufort = typeof localBeaufort === 'number' ? localBeaufort : currentBeaufort;
      return typeof beaufort === 'number' && beaufort >= PROTECTED_FIRST_BEAUFORT;
    };
    return [...selectedIsland.beaches]
      .filter(beach => !(canHideBoatOnly && isBoatOnlyBlownOut(beach)))
      .sort((a, b) => {
        const aPhoto = getBeachPhotoLookupForBeach(a, 1, selectedIsland.name[language]).source === 'exact';
        const bPhoto = getBeachPhotoLookupForBeach(b, 1, selectedIsland.name[language]).source === 'exact';
        if (aPhoto !== bPhoto) return bPhoto ? 1 : -1;

        const byRecognition = getBeachTouristRecognitionScore(b) - getBeachTouristRecognitionScore(a);
        if (byRecognition !== 0) return byRecognition;
        const byAmenities = amenityRichness(b) - amenityRichness(a);
        if (byAmenities !== 0) return byAmenities;
        return (a.name.en || '').localeCompare(b.name.en || '');
      })
      .slice(0, 8);
  }, [currentBeaufort, language, searchQuery, selectedIsland, perBeachMapWind]);
  const weatherBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    if (suitableBeachCards && suitableBeachCards.length > 0) {
      const normalizedSearchQuery = normalizeBeachSearchQuery(searchQuery, selectedIsland, language);
      const activeAdvancedFilters = activeFilters.filter(filter => filter !== 'showAll');
      /**
       * «ΛΕΕΙ 6 ΚΑΙ ΔΕΙΧΝΕΙ 0» (Μίλτος, 12/08/2026) — ΤΟ ΙΔΙΟ ΦΙΛΤΡΟ, ΜΙΑ ΦΟΡΑ ΓΡΑΜΜΕΝΟ.
       *
       * This list used to re-filter the cards App had ALREADY filtered, through a second
       * hand-written matcher (`beachMatchesAdvancedFilter`, still used above to decide which
       * chips to offer). The two disagreed on the surface types: the shared `filterBeaches`
       * treats Άμμος / Βότσαλα / Άμμος+Βότσαλα as alternatives — a beach carries exactly one
       * `beachType`, so requiring all three at once can only ever mean "any of these" — while
       * the local copy ANDed every chip together. Tick all three and App counted 6, this list
       * rendered 0, and the same six reappeared the moment you switched to «Όλες».
       *
       * They could differ elsewhere too (beachBar goes through hasBeachBarAmenity there and a
       * raw flag read here), so the fix is not to patch the surface case: the shared matcher is
       * now the only one that decides, and this stays a lookup into its answer.
       */
      const sharedFilterMatchIds = new Set(
        filterBeaches(suitableBeachCards.map(item => item.beach), activeAdvancedFilters, '', language)
          .map(beach => beach.id)
      );
      const matchesCurrentFilters = (beach: Beach) => {
        // isSearchMatch, not naive substring: the typed name is often accent-/spelling-
        // variant («Γυαλός» vs the dataset's «Γιαλος»), and the results list already
        // matches through the same tolerant matcher — the two must agree.
        const matchesSearch = normalizedSearchQuery.length === 0 ||
          isSearchMatch(normalizedSearchQuery, getBeachSearchFilterValues(beach, language));

        if (!matchesSearch) return false;

        /**
         * ΤΟ ΙΔΙΟ ΛΑΘΟΣ, ΤΟ ΔΙΠΛΑΝΟ ΜΟΝΟΠΑΤΙ (Μίλτος, 12/08/2026).
         *
         * Το σχόλιο από πάνω έκλεισε τη διαφωνία στα advanced φίλτρα και άφησε αυτή τη γραμμή
         * να ρωτάει κάθε προτίμηση ΞΕΧΩΡΙΣΤΑ και να τις κάνει AND. Άμμος και Βότσαλα είναι ο
         * ίδιος τύπος παραλίας με δύο τιμές: ο κοινός κανόνας τις διαβάζει ως εναλλακτικές
         * (beachMatchesUserPreferences → typeFiltersActive), αυτό εδώ απαιτούσε και τις δύο
         * μαζί σε μία παραλία που έχει έναν μόνο `beachType`. Πατώντας και τα δύο chips στον
         * desktop: τα chips μετρούσαν 120 και 40, ο χάρτης κρατούσε 160 pins, ο τίτλος έλεγε
         * «Υπόλοιπες κατάλληλες (0)» — και το «Όλες» τις ξανάφερνε όλες.
         *
         * Ένας κανόνας, ο κοινός, με ΟΛΟ το αντικείμενο προτιμήσεων μαζί — όχι μία-μία.
         */
        if (!beachMatchesUserPreferences(beach, preferences)) return false;

        return sharedFilterMatchIds.has(beach.id);
      };

      const getDistance = (item: SuitableBeach): number | undefined => (
        typeof item.distance === 'number' && Number.isFinite(item.distance) ? item.distance : undefined
      );
      const filteredCards = suitableBeachCards.filter(item => matchesCurrentFilters(item.beach));
      const sortedCards = [...filteredCards].sort((a, b) => {
        if (isDistanceSortActive) {
          const aDistance = getDistance(a);
          const bDistance = getDistance(b);
          if (aDistance !== undefined && bDistance !== undefined && aDistance !== bDistance) {
            return aDistance - bDistance;
          }
          if (aDistance !== undefined) return -1;
          if (bDistance !== undefined) return 1;
        }

        return 0;
      });

      return sortedCards.map(item => ({
        beach: item.beach,
        score: Math.max(0, Math.min(100, Math.round(item.score))),
        context: item,
      }));
    }

    // A live name search must never fall through to the island's popular list: right after a
    // cross-region search jump the suitable cards aren't computed yet, so the carousel briefly
    // showed the island's 8 famous beaches (on Kefalonia: Myrtos first) — and the map-follow
    // effect then panned to that first card instead of the searched beach.
    const normalizedSearchQuery = normalizeBeachSearchQuery(searchQuery, selectedIsland, language);
    if (normalizedSearchQuery.length > 0) {
      return selectedIsland.beaches
        .filter(beach => isSearchMatch(normalizedSearchQuery, getBeachSearchFilterValues(beach, language)))
        .map(beach => ({ beach, score: undefined, context: undefined }));
    }

    return popularBeachCards.map(beach => ({ beach, score: undefined, context: undefined }));
  }, [
    activeFilters,
    isDistanceSortActive,
    language,
    popularBeachCards,
    preferences,
    searchQuery,
    selectedIsland,
    suitableBeachCards,
  ]);
  const topRecommendationBeachCards = useMemo(() => (
    (topRecommendationCards || []).map(item => ({
      beach: item.beach,
      score: Math.max(0, Math.min(100, Math.round(item.score))),
      context: item,
      // «Top μέχρι 15:00». Computed once here so the card below the map and the desktop summary
      // beside it can never print two different hours for the same beach. Undefined — and then
      // nothing is rendered — when the beach has no usable window (getTopPickTimingLabel returns
      // undefined on state 'unknown'), which is the honest answer rather than a made-up hour.
      timeLabel: getTopPickTimingLabel(item.bestBeachTime, selectedDate, language, topPickNow),
    }))
  ), [topRecommendationCards, selectedDate, language, topPickNow]);
  /**
   * «Τι κοιτάμε» — the weights table, static (Μίλτος, 10/08/2026). It used to be a live ladder
   * printing all three picks' values; he rejected it («δεν θέλω να έχω έναν υπολογιστή δίπλα μου»)
   * and the ladder it described no longer exists — the podium is now one weighted score. Shown
   * whenever there is a podium to explain.
   */
  const showTopPickCriteria = topRecommendationBeachCards.length > 1;
  // Below the wind that makes shelter mean anything, the two heaviest rows of the weights box are
  // full marks for everybody — the box has to say which rows actually decided (LADDER_CALM_DAY).
  const isCalmPodiumDay = typeof currentBeaufort === 'number' && currentBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT;
  const hasTopRecommendationView = selectedIsland !== null && topRecommendationBeachCards.length > 0;
  const topRecommendationsLabel = getTopRecommendationsLabel(language, topRecommendationBeachCards.length, currentBeaufort);
  const topRecommendationsQuestion = getTopRecommendationsQuestion(language, selectedDate, suitableTimePrefix, suitableTimeIsNow);
  const mobileTopRecommendationsTitle = getMobileTopRecommendationsTitle(language, topRecommendationBeachCards.length, suitableTimePrefix, currentBeaufort);
  /**
   * ONE PANEL, THREE REGIMES — because the RANKING has three (Miltos, 10/08/2026: «άλλο top 3 σε
   * ήρεμο καιρό και άλλο top 3 σε μεγάλα μποφόρ»). He was right that it changes; MEASURED through
   * the real functions before a word was written here (.tmp/probePodiumRegimes.mjs — two fixtures,
   * a plain protected beach at score 65 against a famous organized 'partial' one at score 85):
   *
   *   ≤2 Bft  shelter plays no part. The famous higher-scoring beach wins, and nothing is
   *           filtered out — bestShelteredRecommendationGroup returns the pool untouched.
   *   3-4 Bft the shelter tier becomes a GATE: the pool drops 2→1, the plain protected beach
   *           beats the famous exposed one. But between two equally protected beaches, fame and
   *           score still decide.
   *   ≥5 Bft  same gate, plus the tier added on 10/08: among equally protected beaches the one
   *           with less wind on its OWN shore leads, ahead of recognition and score.
   *
   * The heading/tab above the podium switches at >4 («Πιο προστατευμένες» vs «Top 3»), so the
   * rail's title and lead follow that same line — they must never contradict it. Only the ONE
   * bullet that states the ordering rule reads the true thresholds, because at 3-4 Bft both of
   * the other two sentences would be false.
   */
  const isShelterFirstPodium = typeof currentBeaufort === 'number' && currentBeaufort > 4;
  const podiumOrderingRegime: 'calm' | 'shelter_gate' | 'own_shore_first' = typeof currentBeaufort !== 'number' || currentBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT
    ? 'calm'
    : currentBeaufort < PROTECTED_FIRST_BEAUFORT
      ? 'shelter_gate'
      : 'own_shore_first';
  /**
   * The honesty line for the last-resort podium. It replaces the ordinary «Top 3 …» subtitle
   * rather than joining it: two subtitles, one boasting and one warning, is how a page ends up
   * saying both things at once.
   *
   * 10/08/2026, caught by Miltos: it was ALSO saying the same thing twice by itself. Above 4 Bft
   * the heading right over it already reads «Πιο προστατευμένες στις 13:00–14:00», so
   * «…— αυτές είναι οι πιο προστατευμένες» was the second copy of a claim the visitor had just
   * read one line higher. The half that only this line can say — that none of the three is
   * actually ideal — is what stays. Below 4 Bft the heading says «Top 3», nothing is repeated,
   * and the full sentence still earns its place.
   */
  /**
   * 12/08/2026, caught by Miltos on tomorrow's forecast: it said «τώρα» in every case. After the
   * evening handover — and on any day the visitor picks — the heading right above it reads «Top 2
   * αύριο στις 12:00–13:00» while this line claimed the present. The moment belongs to the heading,
   * which names it once; this line only keeps «τώρα» while «τώρα» is genuinely what is on screen,
   * and otherwise states the warning with no time at all rather than repeating the heading's.
   */
  const topRecommendationsSubtitle = shelteredFallbackPodium
    ? isViewedMomentNow(selectedDate, suitableTimeIsNow)
      ? isShelterFirstPodium
        ? getLocalizedCopy(language, {
          en: 'None of them is ideal right now',
          gr: 'Καμία δεν είναι ιδανική τώρα',
          fr: "Aucune n'est idéale en ce moment",
          de: 'Keiner ist gerade ideal',
          it: 'Nessuna è ideale adesso',
        })
        : getLocalizedCopy(language, {
          en: 'None of them is ideal right now — these are the most sheltered',
          gr: 'Καμία δεν είναι ιδανική τώρα — αυτές είναι οι πιο προστατευμένες',
          fr: "Aucune n'est idéale en ce moment — voici les plus abritées",
          de: 'Keiner ist gerade ideal — das sind die geschütztesten',
          it: 'Nessuna è ideale adesso — queste sono le più riparate',
        })
      : isShelterFirstPodium
        ? getLocalizedCopy(language, {
          en: 'None of them is ideal',
          gr: 'Καμία δεν είναι ιδανική',
          fr: "Aucune n'est idéale",
          de: 'Keiner ist ideal',
          it: 'Nessuna è ideale',
        })
        : getLocalizedCopy(language, {
          en: 'None of them is ideal — these are the most sheltered',
          gr: 'Καμία δεν είναι ιδανική — αυτές είναι οι πιο προστατευμένες',
          fr: "Aucune n'est idéale — voici les plus abritées",
          de: 'Keiner ist ideal — das sind die geschütztesten',
          it: 'Nessuna è ideale — queste sono le più riparate',
        })
    : topRecommendationsLabel;
  // The desktop transparency rail beside the podium (Miltos, 09/08: «θέλω να είναι όλα με
  // διαφάνεια»). Two rules keep it honest: the «πώς» bullets state only criteria, not thresholds
  // or sector rules (decision 06/08: the methodology page draws that same line against copycats),
  // and the per-beach «γιατί» lines are computed, never authored — see below.
  //
  // The first version printed each pick's own `explanation`, and Miltos caught it immediately:
  // on a calm day all three said «φαίνεται πιθανόν πιο προστατευμένη από ανοιχτές παραλίες
  // σήμερα. Ζεστή μέρα στους 36°C» — true, useless, and identical, because that copy compares a
  // beach to the open sea and never to the other two picks. `getTopPickDistinguishers` answers
  // the comparative question instead, and stays silent (plain profile line) when nothing
  // genuinely separates a beach.
  /**
   * Every beach the podium was chosen from today — the three plus the «Υπόλοιπες κατάλληλες»
   * list, which is exactly the pool after the doors have run. It is what makes the rarity claims
   * possible («μόνο 4 από τις 62»), i.e. the answer to «γιατί αυτές και όχι οι άλλες».
   */
  const topPickPoolSize = topRecommendationBeachCards.length + (suitableBeachCards?.length ?? 0);
  const topPickDistinguishers = useMemo(
    () => getTopPickDistinguishers(
      topRecommendationBeachCards.map(({ beach, context }) => ({ beach, context })),
      language,
      selectedDate,
      {
        pool: [
          ...topRecommendationBeachCards.map(({ beach, context }) => ({ beach, context })),
          ...(suitableBeachCards ?? []).map(item => ({ beach: item.beach, context: item })),
        ],
        /**
         * ΟΙ ΚΡΙΤΙΚΕΣ ΜΙΛΑΝΕ ΟΠΟΤΕ ΑΠΟΦΑΣΙΖΟΥΝ — ΚΑΙ ΣΤΑ 3-4 ΜΠΟΦΟΡ ΑΠΟΦΑΣΙΖΟΥΝ (Μίλτος, 11/08/2026).
         *
         * This was `isCalmPodiumDay` (< 3 Bft), and the band it left silent is the one Miltos was
         * looking at: Λήμνος at 3 Bft, 28 suitable beaches, all three picks reading «άμμος, ρηχά
         * νερά, φυσική σκιά» because no other claim was allowed to speak.
         *
         * The original gate's reasoning was right and is kept — a true sentence in the wrong place
         * is still a lie about how we work, and at 5+ Bft the least wind on a beach's own shore is
         * what genuinely orders the podium, so crediting reviews there would misattribute the
         * decision. But 3-4 Bft is not that case: `bestShelteredRecommendationGroup` has already
         * filtered the pool down to the equally sheltered, so the wind GATHERED the candidates
         * without SEPARATING them, and what actually breaks the order from there is the review
         * count — both as the 5-point crowd row of the score table and as the final tie-break
         * (services/topPickRanking). The page was already deciding this way and was forbidden from
         * saying so.
         *
         * Same boundary as the heading above the podium (`isShelterFirstPodium`, > 4 Bft), on
         * purpose: the rail must never credit a different decision than the title over it claims.
         */
        reviewsDecided: podiumOrderingRegime !== 'own_shore_first',
      },
    ),
    [topRecommendationBeachCards, suitableBeachCards, language, selectedDate, podiumOrderingRegime],
  );
  /**
   * ΤΟ ΠΛΗΘΟΣ ΤΟΥ PODIUM ΔΕΝ ΕΙΝΑΙ ΠΑΝΤΑ ΤΡΙΑ (Μίλτος, 11/08/2026).
   *
   * Every line below used to be written as if it always were: the panel printed «Γιατί αυτές οι 3
   * από τις 5;» and «Με τέτοιο αέρα, αυτές οι τρεις…» above a podium of TWO cards, while the tab
   * beside it correctly read «Top 2». The tab was the only place that counted what was on screen.
   *
   * Same expression as `topTabLabel` — deliberately shared, because the two are read together and
   * any drift between them is the bug being fixed here. A region can fill fewer than three seats
   * whenever the pool is thin, a colour filter is on, or the safety floor keeps a beach out.
   */
  const topPickCount = Math.max(1, Math.min(3, topRecommendationBeachCards.length));
  const isSingleTopPick = topPickCount === 1;
  const topPickCountWord = topPickNumberWord(language, topPickCount);
  // The number does the work: it says we looked at sixty-two, not that we picked three at random.
  // Falls back to the bare question when the pool IS the podium (tiny regions, heavy filtering).
  const topPicksWhyTitle = topPickPoolSize > topPickCount
    ? (isSingleTopPick
      ? getLocalizedCopy(language, {
        en: `Why this one of ${topPickPoolSize}?`,
        gr: `Γιατί αυτή η μία από τις ${topPickPoolSize};`,
        de: `Warum dieser eine von ${topPickPoolSize}?`,
        fr: `Pourquoi celle-ci sur ${topPickPoolSize} ?`,
        it: `Perché questa su ${topPickPoolSize}?`,
      })
      : getLocalizedCopy(language, {
        en: `Why these ${topPickCount} of ${topPickPoolSize}?`,
        gr: `Γιατί αυτές οι ${topPickCount} από τις ${topPickPoolSize};`,
        de: `Warum diese ${topPickCount} von ${topPickPoolSize}?`,
        fr: `Pourquoi ces ${topPickCount} sur ${topPickPoolSize} ?`,
        it: `Perché queste ${topPickCount} su ${topPickPoolSize}?`,
      }))
    : (isSingleTopPick
      ? getLocalizedCopy(language, {
        en: 'Why this one?',
        gr: 'Γιατί αυτή;',
        de: 'Warum dieser eine?',
        fr: 'Pourquoi celle-ci ?',
        it: 'Perché questa?',
      })
      : getLocalizedCopy(language, {
        en: `Why these ${topPickCountWord}?`,
        gr: `Γιατί αυτές οι ${topPickCountWord};`,
        de: `Warum diese ${topPickCountWord}?`,
        fr: `Pourquoi ces ${topPickCountWord}-là ?`,
        it: `Perché queste ${topPickCountWord}?`,
      }));
  // The list under the «Γιατί αυτές οι τρεις;» heading answers «ποια από τις τρεις», not «γιατί
  // αυτές και όχι οι άλλες 71» — that second question is what the bullets below answer. One lead
  // line joins them, so the heading is not left writing a cheque the list does not cash.
  const topPicksWhyLead = isShelterFirstPodium
    // NOT «…που αξίζουν ακόμα για μπάνιο», which is what this said first: we measure wind and
    // sea, never whether a swim is worth it, and at 6 Bft that promise is one we cannot keep.
    // The clause borrows the calm variant's own vocabulary instead, which is exactly what the
    // page can prove — and is only ever printed when the three really did clear the bar
    // (`shelteredFallbackPodium` false).
    /**
     * ΤΟ «Η ΜΟΝΗ ΠΟΥ ΠΕΡΝΑ ΤΟΥΣ ΕΛΕΓΧΟΥΣ» ΕΛΕΓΕ ΛΑΘΟΣ ΛΟΓΟ (Μίλτος, 14/08/2026).
     *
     * Νάξος, 5 Μποφ: βάθρο με μία κάρτα, λεζάντα χάρτη «Καλές 3 παραλίες» 400 px πιο πάνω. Οι
     * άλλες δύο ΔΕΝ κόπηκαν στους ελέγχους αέρα/θάλασσας — τους πέρασαν. Κόπηκαν ένα σκαλί πιο
     * κάτω, στη ΒΑΘΜΙΔΑ ΕΚΘΕΣΗΣ: `bestShelteredRecommendationGroup` κρατά μόνο την κορυφαία
     * (`protected` + `canClaimWindProtection`, services/topPickRanking.ts). Άρα η φράση
     * επικαλούνταν ένα φίλτρο που δεν είναι αυτό που έκοψε, και διαψευδόταν από την ίδια οθόνη.
     *
     * Η νέα λέει ΤΙ ΟΝΤΩΣ ΕΓΙΝΕ και τίποτα παραπάνω — «κρατάμε μόνο τις πιο προστατευμένες,
     * σήμερα μία είναι εκεί». Λέει ΛΙΓΟΤΕΡΑ από την προηγούμενη, άρα δεν εισάγει ισχυρισμό.
     * Η πληθυντική από κάτω μένει ως έχει: λέει «οι πιο προστατευμένες», ποτέ «οι μόνες».
     *
     * Δεν αγγίζει τη λέξη «κατάλληλες» της διπλανής καρτέλας — αυτή είναι απόφαση 10/08/2026
     * (PORISMA §7κ) και σημαίνει «κολυμπάς», όχι «καλές συνθήκες».
     *
     * ΚΑΙ ΤΟ ΚΛΕΙΣΙΜΟ: «Να τι την ΞΕΧΩΡΙΖΕΙ» → «Να τι έχει» (Μίλτος, 14/08/2026).
     *
     * «Ξεχωρίζει» υπόσχεται σύγκριση, και με ΜΙΑ κάρτα δεν υπάρχει σύγκριση να γίνει: το
     * `getTopPickDistinguishers` παρατάει ρητά κάθε συγκριτικό άξονα σε μονό pick («a single pick
     * has nothing to be compared against», utils/topPickDistinguishers.ts:665) και πέφτει στη
     * γραμμή προφίλ — «άμμος, ρηχά νερά, πάρκινγκ», που τα έχουν και δεκάδες άλλες. Ο τίτλος
     * έγραφε επιταγή που η λίστα από κάτω δεν εξαργυρώνει, ακριβώς ο κίνδυνος που καταγράφεται
     * 20 γραμμές πιο πάνω. Το «πώς βγήκε αυτή η μία» το λέει ήδη το ΠΡΩΤΟ μισό της ίδιας
     * πρότασης, οπότε το δεύτερο δεν το επαναλαμβάνει (no-duplicate-robot-copy) — απλώς σταματά
     * να ψεύδεται. Ίδιο λεξιλόγιο με την ήρεμη παραλλαγή, που το έλεγε σωστά από την αρχή.
     */
    ? (isSingleTopPick
      ? getLocalizedCopy(language, {
        en: 'With this much wind we keep only the most sheltered beaches — and today just one is in that group. Here is what it has:',
        gr: 'Με τέτοιο αέρα κρατάμε μόνο τις πιο προστατευμένες — και σήμερα μία μόνο είναι εκεί. Να τι έχει:',
        de: 'Bei diesem Wind behalten wir nur die geschütztesten Strände — und heute ist nur einer davon dabei. Das hat er:',
        fr: "Avec ce vent, nous ne gardons que les plages les plus abritées — et aujourd'hui une seule y figure. Voici ce qu'elle a :",
        it: 'Con questo vento teniamo solo le spiagge più riparate — e oggi solo una rientra in quel gruppo. Ecco cosa ha:',
      })
      : getLocalizedCopy(language, {
        en: `With this much wind, these ${topPickCountWord} are the most sheltered ones that still clear the wind and sea checks. Here is what separates them:`,
        gr: `Με τέτοιο αέρα, αυτές οι ${topPickCountWord} είναι οι πιο προστατευμένες που περνούν ακόμα τους ελέγχους για αέρα και θάλασσα. Να τι τις ξεχωρίζει:`,
        de: `Bei diesem Wind sind diese ${topPickCountWord} die geschütztesten, die die Wind- und Seegangsprüfungen noch bestehen. Das unterscheidet sie:`,
        fr: `Avec ce vent, ces ${topPickCountWord}-là sont les plus abritées qui passent encore les contrôles de vent et de mer. Voici ce qui les distingue :`,
        it: `Con questo vento, queste ${topPickCountWord} sono le più riparate che superano ancora i controlli su vento e mare. Ecco cosa le distingue:`,
      }))
    /**
     * ΤΟ ΚΕΝΟ ΠΟΥ ΒΡΗΚΕ Ο ΜΙΛΤΟΣ (11/08/2026): «γιατί αυτές οι 3 και όχι κάποιες από τις άλλες 17;»
     *
     * The old line said all three pass the checks — true, and it left the visitor thinking the
     * other fifty-nine had failed them. They had not: they pass too. What the lead has to carry is
     * the SIZE of the pool and WHY the tie was broken, because on a calm day it was measured that
     * the weather separates nobody (Rhodes, 1-2 Bft: 80 of the 100 points identical for all 62) and
     * the order comes from the review counts.
     */
    : isCalmPodiumDay && topPickPoolSize > topPickCount
      ? (isSingleTopPick
        ? getLocalizedCopy(language, {
          en: `With so little wind none of today's ${topPickPoolSize} suitable beaches stands out on the weather, so the best-known one leads. Here is what it has:`,
          gr: `Με τόσο λίγο αέρα καμία από τις ${topPickPoolSize} κατάλληλες δεν ξεχωρίζει στον καιρό, οπότε προηγείται η πιο δοκιμασμένη. Να τι έχει:`,
          de: `Bei so wenig Wind hebt sich keiner der heute ${topPickPoolSize} geeigneten Strände beim Wetter ab, also führt der bekannteste. Das hat er:`,
          fr: `Avec si peu de vent, aucune des ${topPickPoolSize} plages adaptées ne se démarque sur la météo : la plus éprouvée passe devant. Voici ce qu'elle a :`,
          it: `Con così poco vento nessuna delle ${topPickPoolSize} spiagge adatte spicca sul meteo, quindi guida la più collaudata. Ecco cosa ha:`,
        })
        : getLocalizedCopy(language, {
          en: `With so little wind none of today's ${topPickPoolSize} suitable beaches stands out on the weather, so the best-known ones lead. Here is what each one has:`,
          gr: `Με τόσο λίγο αέρα καμία από τις ${topPickPoolSize} κατάλληλες δεν ξεχωρίζει στον καιρό, οπότε προηγούνται οι πιο δοκιμασμένες. Να τι έχει η καθεμία:`,
          de: `Bei so wenig Wind hebt sich keiner der heute ${topPickPoolSize} geeigneten Strände beim Wetter ab, also führen die bekanntesten. Das hat jeder:`,
          fr: `Avec si peu de vent, aucune des ${topPickPoolSize} plages adaptées ne se démarque sur la météo : les plus éprouvées passent devant. Voici ce qu'a chacune :`,
          it: `Con così poco vento nessuna delle ${topPickPoolSize} spiagge adatte spicca sul meteo, quindi guidano le più collaudate. Ecco cosa ha ciascuna:`,
        }))
      /**
       * 3-4 ΜΠΟΦΟΡ — Η ΖΩΝΗ ΠΟΥ ΔΕΝ ΕΙΧΕ ΔΙΚΗ ΤΗΣ ΠΡΟΤΑΣΗ (Μίλτος, 11/08/2026).
       *
       * It fell through to the generic «Διαλέχτηκαν ανάμεσα σε 28 παραλίες που περνούν τους
       * ελέγχους», which states the pool and explains nothing — and above three picks whose own
       * lines had been silenced by the review gate, the whole panel said nothing at all.
       *
       * What is true in this band and in no other: the shelter tier ran as a GATE
       * (`bestShelteredRecommendationGroup`), so every survivor is equally sheltered. The wind
       * chose the pool and then had nothing left to say about the order — which is exactly what
       * the sentence now tells the visitor, in the words he used himself.
       */
      : podiumOrderingRegime === 'shelter_gate' && topPickPoolSize > topPickCount
        ? (isSingleTopPick
          ? getLocalizedCopy(language, {
            en: `Today's wind narrowed the field to ${topPickPoolSize} equally sheltered beaches — it gathered them, it did not separate them. The best-known one leads. Here is what it has:`,
            gr: `Με τον σημερινό αέρα, οι ${topPickPoolSize} που πέρασαν είναι όλες εξίσου προστατευμένες — ο αέρας τις μάζεψε, δεν τις ξεχώρισε. Μπροστά μπαίνει η πιο δοκιμασμένη. Να τι έχει:`,
            de: `Der heutige Wind hat das Feld auf ${topPickPoolSize} gleich gut geschützte Strände verengt — er hat sie versammelt, nicht unterschieden. Vorn steht der bekannteste. Das hat er:`,
            fr: `Le vent du jour a réduit le champ à ${topPickPoolSize} plages également abritées — il les a rassemblées, il ne les a pas départagées. La plus éprouvée passe devant. Voici ce qu'elle a :`,
            it: `Il vento di oggi ha ristretto il campo a ${topPickPoolSize} spiagge ugualmente riparate — le ha raccolte, non le ha distinte. Guida la più collaudata. Ecco cosa ha:`,
          })
          : getLocalizedCopy(language, {
            en: `Today's wind narrowed the field to ${topPickPoolSize} equally sheltered beaches — it gathered them, it did not separate them. The best-known ones lead. Here is what each one has:`,
            gr: `Με τον σημερινό αέρα, οι ${topPickPoolSize} που πέρασαν είναι όλες εξίσου προστατευμένες — ο αέρας τις μάζεψε, δεν τις ξεχώρισε. Μπροστά μπαίνουν οι πιο δοκιμασμένες. Να τι έχει η καθεμία:`,
            de: `Der heutige Wind hat das Feld auf ${topPickPoolSize} gleich gut geschützte Strände verengt — er hat sie versammelt, nicht unterschieden. Vorn stehen die bekanntesten. Das hat jeder:`,
            fr: `Le vent du jour a réduit le champ à ${topPickPoolSize} plages également abritées — il les a rassemblées, il ne les a pas départagées. Les plus éprouvées passent devant. Voici ce qu'a chacune :`,
            it: `Il vento di oggi ha ristretto il campo a ${topPickPoolSize} spiagge ugualmente riparate — le ha raccolte, non le ha distinte. Guidano le più collaudate. Ecco cosa ha ciascuna:`,
          }))
        : topPickPoolSize > topPickCount
        ? (isSingleTopPick
          ? getLocalizedCopy(language, {
            en: `Chosen from ${topPickPoolSize} beaches that clear today's wind and sea checks. Here is what it has:`,
            gr: `Διαλέχτηκε ανάμεσα σε ${topPickPoolSize} παραλίες που περνούν τους σημερινούς ελέγχους για αέρα και θάλασσα. Να τι έχει:`,
            de: `Ausgewählt aus ${topPickPoolSize} Stränden, die die heutigen Wind- und Seegangsprüfungen bestehen. Das hat er:`,
            fr: `Choisie parmi ${topPickPoolSize} plages qui passent les contrôles du jour (vent et mer). Voici ce qu'elle a :`,
            it: `Scelta tra ${topPickPoolSize} spiagge che superano i controlli di oggi su vento e mare. Ecco cosa ha:`,
          })
          : getLocalizedCopy(language, {
            en: `Chosen from ${topPickPoolSize} beaches that clear today's wind and sea checks. Here is what separates them:`,
            gr: `Διαλέχτηκαν ανάμεσα σε ${topPickPoolSize} παραλίες που περνούν τους σημερινούς ελέγχους για αέρα και θάλασσα. Να τι τις ξεχωρίζει:`,
            de: `Ausgewählt aus ${topPickPoolSize} Stränden, die die heutigen Wind- und Seegangsprüfungen bestehen. Das unterscheidet sie:`,
            fr: `Choisies parmi ${topPickPoolSize} plages qui passent les contrôles du jour (vent et mer). Voici ce qui les distingue :`,
            it: `Scelte tra ${topPickPoolSize} spiagge che superano i controlli di oggi su vento e mare. Ecco cosa le distingue:`,
          }))
        : (isSingleTopPick
          ? getLocalizedCopy(language, {
            en: 'It clears today\'s wind and sea checks. Here is what it has:',
            gr: 'Περνά τους σημερινούς ελέγχους για αέρα και θάλασσα. Να τι έχει:',
            de: 'Er besteht die heutigen Wind- und Seegangsprüfungen. Das hat er:',
            fr: "Elle passe les contrôles du jour (vent et mer). Voici ce qu'elle a :",
            it: 'Supera i controlli di oggi su vento e mare. Ecco cosa ha:',
          })
          : getLocalizedCopy(language, {
            en: `All ${topPickCountWord} clear today's wind and sea checks. Here is what separates them:`,
            gr: `Και οι ${topPickCountWord} περνούν τους σημερινούς ελέγχους για αέρα και θάλασσα. Να τι τις ξεχωρίζει:`,
            // «Alle zwei» is not German; the pair takes its own word.
            de: topPickCount === 2
              ? 'Beide bestehen die heutigen Wind- und Seegangsprüfungen. Das unterscheidet sie:'
              : `Alle ${topPickCountWord} bestehen die heutigen Wind- und Seegangsprüfungen. Das unterscheidet sie:`,
            fr: `Toutes les ${topPickCountWord} passent les contrôles du jour (vent et mer). Voici ce qui les distingue :`,
            it: `Tutte e ${topPickCountWord} superano i controlli di oggi su vento e mare. Ecco cosa le distingue:`,
          }));
  const topPicksHowTitle = isShelterFirstPodium
    ? getLocalizedCopy(language, {
      en: 'How we pick the sheltered ones',
      gr: 'Πώς διαλέγουμε τις πιο προστατευμένες',
      de: 'So wählen wir die geschütztesten',
      fr: 'Comment nous choisissons les plus abritées',
      it: 'Come scegliamo le più riparate',
    })
    : getLocalizedCopy(language, {
      en: `How the Top ${topPickCount} is picked`,
      gr: `Πώς βγαίνει το Top ${topPickCount}`,
      de: `So entsteht die Top ${topPickCount}`,
      fr: `Comment le Top ${topPickCount} est choisi`,
      it: `Come nasce la Top ${topPickCount}`,
    });
  const topPicksHowBullets = [
    getLocalizedCopy(language, {
      en: 'We look at wind, gusts and waves for the hour you are viewing — not a daily average.',
      gr: 'Κοιτάμε τον άνεμο, τις ριπές και το κύμα για την ώρα που βλέπεις — όχι έναν μέσο όρο της ημέρας.',
      de: 'Wir betrachten Wind, Böen und Wellen für die angezeigte Stunde — nicht einen Tagesdurchschnitt.',
      fr: "Nous regardons le vent, les rafales et les vagues pour l'heure affichée — pas une moyenne de la journée.",
      it: "Guardiamo vento, raffiche e onde per l'ora che stai vedendo — non una media della giornata.",
    }),
    getLocalizedCopy(language, {
      en: "We measure how much each beach's coastline shelters it from today's wind direction.",
      gr: 'Μετράμε πόσο προστατεύει κάθε παραλία το σχήμα της ακτής της από τη σημερινή κατεύθυνση του ανέμου.',
      de: 'Wir messen, wie stark die Küstenform jeden Strand vor der heutigen Windrichtung schützt.',
      fr: "Nous mesurons à quel point la forme de la côte abrite chaque plage du vent du jour.",
      it: 'Misuriamo quanto la forma della costa ripara ogni spiaggia dal vento di oggi.',
    }),
    // THE RULE THAT ACTUALLY CHANGES WITH THE WIND — the only sentence on this list that is not
    // true on every day. Each variant states what was measured for its own band; see the regime
    // note above. Never merge these back into one line "for simplicity": the merged version is
    // wrong on two days out of three.
    podiumOrderingRegime === 'own_shore_first'
      ? getLocalizedCopy(language, {
        en: 'When it blows like this, the shelter decides: only the most sheltered beaches make the list. The one with the least wind on its own shore comes first, and only then does it matter how well known or well equipped it is.',
        gr: 'Όταν φυσάει έτσι, αποφασίζει η προστασία: στη λίστα μπαίνουν μόνο οι πιο προστατευμένες. Πρώτη έρχεται όποια έχει τον λιγότερο αέρα στη δική της ακτή, και μετά μετράει το πόσο γνωστή ή οργανωμένη είναι.',
        de: 'Wenn es so weht, entscheidet der Schutz: In die Liste kommen nur die geschütztesten Strände. Vorn steht der mit dem wenigsten Wind am eigenen Ufer, und erst danach zählt, wie bekannt oder gut ausgestattet er ist.',
        fr: "Quand il souffle ainsi, c'est l'abri qui décide : seules les plages les plus abritées entrent dans la liste. Celle qui a le moins de vent sur son propre rivage vient en premier, et sa notoriété ou ses équipements ne comptent qu'ensuite.",
        it: 'Quando soffia così, decide il riparo: nella lista entrano solo le spiagge più riparate. Viene prima quella con meno vento sulla propria riva, e solo dopo conta quanto sia nota o attrezzata.',
      })
      : podiumOrderingRegime === 'shelter_gate'
        ? getLocalizedCopy(language, {
          en: 'With a moderate wind, only the beaches that have that shelter make the list. An exposed beach does not get in because it is beautiful.',
          gr: 'Με μέτριο άνεμο, στη λίστα μπαίνουν μόνο όσες έχουν αυτή την προστασία. Μια εκτεθειμένη παραλία δεν μπαίνει επειδή είναι ωραία.',
          de: 'Bei mäßigem Wind kommen nur die Strände in die Liste, die diesen Schutz haben. Ein offen liegender Strand kommt nicht hinein, weil er schön ist.',
          fr: "Par vent modéré, seules les plages qui ont cet abri entrent dans la liste. Une plage exposée n'y entre pas parce qu'elle est belle.",
          it: 'Con vento moderato, entrano in lista solo le spiagge che hanno questo riparo. Una spiaggia esposta non entra perché è bella.',
        })
        : getLocalizedCopy(language, {
          en: 'With so little wind, shelter is not what decides. The waves and what each beach itself is like matter more.',
          gr: 'Με τόσο λίγο αέρα δεν αποφασίζει η προστασία. Μετράνε περισσότερο το κύμα και τα χαρακτηριστικά της κάθε παραλίας.',
          de: 'Bei so wenig Wind entscheidet nicht der Schutz. Wellengang und die Eigenschaften des Strandes zählen mehr.',
          fr: "Avec si peu de vent, ce n'est pas l'abri qui décide. Les vagues et les caractéristiques de chaque plage comptent davantage.",
          it: 'Con così poco vento non decide il riparo. Contano di più le onde e le caratteristiche di ogni spiaggia.',
        }),
    getLocalizedCopy(language, {
      en: 'Beaches that need a boat or a hard path always rank after the easily accessible ones.',
      gr: 'Παραλίες που θέλουν σκάφος ή δύσκολο μονοπάτι μπαίνουν πάντα μετά τις εύκολα προσβάσιμες.',
      de: 'Strände, die ein Boot oder einen schwierigen Weg erfordern, kommen immer nach den leicht erreichbaren.',
      fr: "Les plages accessibles seulement en bateau ou par un sentier difficile passent toujours après les plages faciles d'accès.",
      it: 'Le spiagge raggiungibili solo in barca o con sentieri difficili vengono sempre dopo quelle facili da raggiungere.',
    }),
    getLocalizedCopy(language, {
      en: 'No beach pays for its spot — the order comes only from the conditions and the beach itself.',
      gr: 'Καμία παραλία δεν πληρώνει για τη θέση της — η σειρά βγαίνει μόνο από τις συνθήκες και τα χαρακτηριστικά της.',
      de: 'Kein Strand bezahlt für seinen Platz — die Reihenfolge ergibt sich nur aus den Bedingungen und dem Strand selbst.',
      fr: "Aucune plage ne paie sa place — l'ordre vient uniquement des conditions et de la plage elle-même.",
      it: "Nessuna spiaggia paga per la sua posizione — l'ordine nasce solo dalle condizioni e dalla spiaggia stessa.",
    }),
  ];
  const topPicksMethodologyPath = language === 'gr' ? '/el/how-we-measure-wind-shelter/' : '/how-we-measure-wind-shelter/';
  const topPicksMethodLinkLabel = getLocalizedCopy(language, {
    en: 'How exactly we measure shelter →',
    gr: 'Πώς ακριβώς μετράμε την προστασία →',
    de: 'Wie genau wir den Schutz messen →',
    fr: "Comment nous mesurons l'abri exactement →",
    it: 'Come misuriamo esattamente il riparo →',
  });
  // A low regional Beaufort is not by itself a licence to say «Όλες οι παραλίες κατάλληλες».
  // Measured on Evia at 3 Bft: 76 of 130 beaches were blue or yellow — the rest were capped by a
  // running sea — so the old wind-only test printed "all of them" above a list of 76. The list
  // must literally hold everything before the heading claims it does.
  const isCalmAllSuitableDay = typeof currentBeaufort === 'number' && currentBeaufort <= 2
    && suitableListCoversEverything;
  const suitableSectionLabel = activeToneFilter
    // The user picked a colour on the map: the list IS that colour, so the heading says so and
    // every other framing (best / all-suitable / the-rest) steps aside. Otherwise the page would
    // show «Καταλληλότερες παραλίες» above a list of the roughest beaches on the island.
    ? getToneFilterLabel(activeToneFilter, language, selectedDate, suitableTimePrefix)
    : infoOnly
      ? allBeachesLabel
      : hasTopRecommendationView
        ? getRemainingSuitableLabel(language, selectedDate, suitableTimePrefix)
        : isCalmAllSuitableDay
          ? allBeachesLabel
          : bestBeachesLabel;
  // Always 1: the list IS the answer now. Until 15/08/2026 an empty podium woke a single
  // full-width «Top παραλία σήμερα» card above it and the numbering started at 2 — see the
  // note on the removed prop in BeachSearcherHomeProps.
  const weatherBeachCardRankStart = 1;
  // The number in the heading is the number of cards under it, full stop. It used to be App's
  // pre-filter total (`suitableBeachTotalCount`) while the carousel below re-filtered locally
  // through matchesCurrentFilters — so with a search or an amenity filter on, the title promised
  // more beaches than it rendered, and the gap grew with every filter the user added.
  const suitableBeachDisplayCount = weatherBeachCards.length;
  const hasSuitableSortOption = Boolean(selectedIsland);
  // "Όλες" from the mobile filter sheet sets sortBy='all' and must always show the full list —
  // viewport-independent, because that sheet is used below the lg breakpoint (1024px) while
  // isMobileViewport only tracks <640px. So: sortBy==='all' → all list everywhere; otherwise
  // fall back to the desktop dropdown's state. (Desktop never sets sortBy='all', so it keeps
  // using directoryViewCriteria.suitable unchanged.)
  const isDirectorySuitableView = hasSuitableSortOption && (
    sortBy === 'all' ? false : directoryViewCriteria.suitable
  );
  // Tabs only make sense when BOTH lists exist for the same moment: a podium on screen and the
  // suitable list in its normal mode. A colour filter or «Όλες» sorting already stands the podium
  // down (or reroutes the list), and then the page keeps its untabbed layout.
  const isTabbedPicksMode = Boolean(selectedIsland && hasTopRecommendationView && !infoOnly && isDirectorySuitableView);
  /**
   * «Υπόλοιπες» ΑΛΛΑ ΟΧΙ «υπόλοιπες ΠΡΟΣΤΑΤΕΥΜΕΝΕΣ» — asked for on 10/08/2026 and deliberately
   * answered with a different word, because this list is not selected by shelter at all.
   * `selectSuitableByTone` (utils/suitabilityTone) takes the beaches the MAP painted ΙΔΑΝΙΚΗ or
   * ΚΑΛΗ — a colour that mixes wind, sea and geometry — and tops the list up with ΜΕΤΡΙΑ when
   * fewer than three qualify. So a member can be calm today simply because no wind reaches it,
   * with no shelter to speak of, and on a thin day it can even be a fair one. «Κατάλληλες» is
   * the word the section heading beneath already uses (getRemainingSuitableLabel) and the only
   * one the membership rule earns.
   *
   * Mobile keeps the bare «Υπόλοιπες»: beside «Πιο προστατευμένες στις 13:00–14:00» the pair
   * wraps to two lines at 320px, and the heading over the list says the full phrase anyway.
   *
   * The last-resort podium used to drop the word too, on the theory that «ΚΑΤΑΛΛΗΛΕΣ» next to
   * «καμία δεν είναι ιδανική» sounded like a better offer than the picks. Reverted 10/08/2026 on
   * Miltos' instruction («και για καιρό με άνεμο»): windy days are exactly when the reader is
   * comparing the two lists, and a tab that changes its name between days reads as two different
   * lists. Membership is the same rule in every wind, so the label is too.
   */
  const restTabLabel = withCount(isMobileViewport
    ? getLocalizedCopy(language, {
      en: 'The rest',
      gr: 'Υπόλοιπες',
      fr: 'Les autres',
      de: 'Weitere',
      it: 'Le altre',
    })
    : getLocalizedCopy(language, {
      en: 'Other suitable',
      gr: 'Υπόλοιπες κατάλληλες',
      fr: 'Autres adaptées',
      de: 'Weitere passende',
      it: 'Altre adatte',
    }), suitableBeachDisplayCount);
  /**
   * ΕΝΑ ΟΝΟΜΑ, ΣΕ ΚΑΘΕ ΚΑΙΡΟ — «Top N» (Μίλτος, 10/08/2026).
   *
   * The tab used to change its own name above 4 Bft, to «Πιο προστατευμένες». The intention was
   * honesty — do not call a hard day's answer a "top" list — but the effect was the opposite of
   * honest: the reader saw a DIFFERENT block on windy days and could not tell whether the list had
   * changed meaning or the site had. It is the same list, ranked by the same rules, every day.
   *
   * The honesty lives where it belongs and is unchanged: the subtitle still says out loud when
   * none of them is ideal, each card still carries what the catch is with that beach, and the
   * safety floor still keeps a «μην κολυμπήσεις» beach out of a seat.
   *
   * The number follows what is actually on screen: «Top 2» when the region could only fill two.
   * The tab is narrower than a heading, so «επιλογές» is dropped — «Top 3 στις 16:00–17:00» fits
   * one line where the full title wrapped to two.
   *
   * ΤΟ «TOP 1» ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΤΕ ΜΕ ΨΗΦΙΟ (Μίλτος, 15/08/2026).
   *
   * «Top 1 στις 08:00–09:00» δίπλα σε «Υπόλοιπες (17)» διαβάζεται ως ισχυρισμός ακρίβειας που
   * δεν έχουμε: «από τις δεκαοκτώ, ακριβώς ΜΙΑ είναι η απάντηση, και το ξέρουμε ανά ώρα». Είναι
   * η ίδια αμαρτία που το `PODIUM_SEA_MEANINGFUL_DIFFERENCE_M` απαγορεύει στη σειρά του βάθρου —
   * να δημοσιεύεις διάκριση κάτω από το σφάλμα σου. Το πλήθος ένα δεν είναι κρίση: είναι ό,τι
   * περίσσεψε αφού μίλησαν οι πύλες.
   *
   * Η επικεφαλίδα του βάθρου το είχε ήδη λύσει (`getTopRecommendationsLabel`, «Top επιλογή»
   * χωρίς ψηφίο) — η καρτέλα απλώς δεν πήρε ποτέ τον κανόνα. Τώρα τον μοιράζονται. Στα 2 και 3
   * το ψηφίο μένει: εκεί μετράει πραγματικά πόσες κάρτες θα δει.
   */
  const topTabLabel = (() => {
    const when = suitableTimePrefix ? ` ${suitableTimePrefix}` : '';
    // Shared with the «Γιατί αυτές…» panel, so the tab and the explanation can never disagree
    // about how many beaches are on screen.
    if (isSingleTopPick) {
      return getLocalizedCopy(language, {
        en: `Top pick${when}`,
        gr: `Top επιλογή${when}`,
        fr: `Meilleur choix${when}`,
        de: `Top-Empfehlung${when}`,
        it: `Scelta top${when}`,
      });
    }
    return `Top ${topPickCount}${when}`;
  })();


  useEffect(() => {
    if (!onActiveSuitableBeachChange) return undefined;

    if (isAllBeachesPanelOpen) {
      return undefined;
    }

    if ((!hasTopRecommendationView && !isDirectorySuitableView) || !selectedIsland || (topRecommendationBeachCards.length === 0 && weatherBeachCards.length === 0)) {
      // In the "Όλες" (all-beaches) view the directory carousel effect owns the map
      // highlight. Don't clear it here: this effect re-runs on nearly every render
      // (the suitable-cards array is rebuilt each render), and clearing would wipe
      // the highlight the directory carousel just set — so the pin would never blink
      // while browsing "Όλες", unlike "Καταλληλότερες".
      const directoryCarouselOwnsHighlight = isMobileViewport && !isDirectorySuitableView && Boolean(selectedIsland);
      const mobileCardScrollOwnsHighlight = isMobileViewport && Boolean(selectedIsland);
      if (!directoryCarouselOwnsHighlight && !mobileCardScrollOwnsHighlight) {
        activeSuitableBeachIdRef.current = undefined;
        setActiveMapLinkedBeachId(undefined);
        onActiveSuitableBeachChange(undefined, { resumeFollow: false });
      }
      return undefined;
    }

    const carousel = topRecommendationsCarouselRef.current || suitableCarouselRef.current;
    if (!carousel) {
      return undefined;
    }

    let animationFrameId = 0;
    let settleTimeoutId: number | undefined;

    const updateActiveBeach = (resumeFollow = true) => {
      animationFrameId = 0;
      const carouselRect = carousel.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;
      const cards = Array.from(carousel.querySelectorAll<HTMLElement>('[data-suitable-beach-id]'));
      let nearestBeachId: number | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cards.forEach(card => {
        const beachId = Number(card.dataset.suitableBeachId);
        if (!Number.isFinite(beachId)) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - carouselCenter);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBeachId = beachId;
        }
      });

      if (activeSuitableBeachIdRef.current === nearestBeachId && !resumeFollow) return;
      activeSuitableBeachIdRef.current = nearestBeachId;
      setActiveMapLinkedBeachId(nearestBeachId);
      onActiveSuitableBeachChange(nearestBeachId, { resumeFollow });
    };

    const scheduleUpdate = (resumeFollow = true) => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(() => updateActiveBeach(resumeFollow));
    };
    const handleCarouselScroll = () => {
      // Keep the map indication aligned with the card currently nearest the center
      // while the user swipes through the carousel.
      isCarouselScrollingRef.current = true;
      scheduleUpdate(true);
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      settleTimeoutId = window.setTimeout(() => {
        isCarouselScrollingRef.current = false;
        scheduleUpdate(true);
      }, 180);
    };
    const handleResize = () => scheduleUpdate(false);

    carousel.addEventListener('scroll', handleCarouselScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      isCarouselScrollingRef.current = false;
      carousel.removeEventListener('scroll', handleCarouselScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [hasTopRecommendationView, isAllBeachesPanelOpen, isDirectorySuitableView, isMobileViewport, onActiveSuitableBeachChange, selectedIsland, topRecommendationBeachCards.length, weatherBeachCards]);

  const directoryAllBeachCards = useMemo(() => {
    if (!selectedIsland) return [];
    return allBeachCards && allBeachCards.length > 0 ? allBeachCards : selectedIsland.beaches;
  }, [allBeachCards, selectedIsland]);
  const directorySuitableOnlyBeachCards = useMemo<BeachCardContext[]>(() => {
    if (!suitableBeachCards || suitableBeachCards.length === 0) {
      return directoryAllBeachCards;
    }

    return weatherBeachCards.map(({ beach, context }) => {
      if (!context) return beach;

      return {
        ...beach,
        distance: context.distance,
        score: context.score,
        isExposed: context.isExposed,
        bestBeachTime: context.bestBeachTime,
        bestTimeWindow: context.bestTimeWindow,
        exposureLevel: context.exposureLevel,
        waveHeightM: context.waveHeightM,
        seaStateWaveM: context.seaStateWaveM,
        shoreWaveHeightM: context.shoreWaveHeightM,
        shoreDisplayWaveM: context.shoreDisplayWaveM,
        shoreWaveFromDepartingSea: context.shoreWaveFromDepartingSea,
        seaArrivalExposureLevel: context.seaArrivalExposureLevel,
        seaStatePeriodS: context.seaStatePeriodS,
        windSpeedKmph: context.windSpeedKmph,
        warnings: context.warnings,
        confidence: context.confidence,
        swimmingComfort: context.swimmingComfort,
        canClaimWindProtection: context.canClaimWindProtection,
        seaCalmClaimAllowed: context.seaCalmClaimAllowed,
        lessExposedToday: true,
      };
    });
  }, [directoryAllBeachCards, suitableBeachCards, weatherBeachCards]);
  const directoryTitle = useMemo(() => getBeachFilterDirectoryTitle({
    activeFilters,
    fallbackTitle: copy.allOtherBeaches,
    language,
    preferences,
    t,
  }), [activeFilters, copy.allOtherBeaches, language, preferences, t]);
  const weatherContextByBeachId = useMemo(() => (
    new Map((beachWeatherContexts || []).map(item => [item.beach.id, item]))
  ), [beachWeatherContexts]);
  const visibleMapExposureLevels = useMemo(() => (
    getConsistentVisibleMapExposureLevels(
      beachWeatherContexts || [],
      selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : undefined,
      selectedForecast?.wind.deg,
      perBeachMapWind
    )
  ), [beachWeatherContexts, selectedForecast, perBeachMapWind]);
  /**
   * WHY A BEACH THE MAP LIKES IS NOT IN THE PICKS (Miltos, 10/08/2026).
   *
   * Computed from the SAME contexts the cards are already drawn from, so no new data crosses the
   * prop boundary and the answer cannot drift from the card beside it. `explainTopPickExclusion`
   * returns null for a beach that cleared every gate and was merely outranked — silence is the
   * honest answer there, and it keeps the line rare enough to be worth reading.
   *
   * Each beach is judged against the wind on ITS OWN shore, like every other gate since 02/08.
   */
  const topPickExclusionByBeachId = useMemo(() => {
    const byId = new Map<number, TopPickExclusionReason>();
    if (!selectedForecast) return byId;

    const windSpeedKmph = selectedForecast.wind.speed * 3.6;
    const regionBeaufort = getBeaufortLevel(windSpeedKmph);
    const waveHeightM = selectedForecast.marine?.waveHeightM;
    (beachWeatherContexts || []).forEach(item => {
      const ownBeaufort = perBeachMapWind?.get(item.beach.id)?.beaufort ?? regionBeaufort;
      const reason = explainTopPickExclusion(item, ownBeaufort, windSpeedKmph, waveHeightM);
      if (reason) byId.set(item.beach.id, reason);
    });
    return byId;
  }, [beachWeatherContexts, selectedForecast, perBeachMapWind]);
  /**
   * One sentence per reason, each naming a property of THE BEACH — never our list.
   *
   * They opened with «Εκτός προτάσεων» until 10/08/2026 evening, and Miltos killed that wording on
   * sight: it appeared under a tab of beaches the same page calls κατάλληλες, and it now also has
   * to read correctly on a podium card, since a thin day fills the empty seats from exactly this
   * set. «Not in the picks» said something about the ranking; «πιο ταραγμένη θάλασσα εδώ σήμερα»
   * says the thing the reader can actually use, and stays true wherever the card is shown.
   *
   * The «σίγουρα στοιχεία» wording is deliberate: that case is about OUR records, not about the
   * beach, and the reader has to be able to tell those two apart — the pin next to it is still
   * coloured from live weather and stays trustworthy.
   */
  const topPickExclusionCopy: Record<TopPickExclusionReason, string> = {
    /**
     * SILENT SINCE 12/08/2026 — classified, never printed (same treatment as `unverified`).
     *
     * «Σήμερα δεν τη συστήνουμε για μπάνιο» was a verdict, not a caption, and it landed on a card
     * that already carries its own colour, its own headline and its own Beaufort. Two voices on the
     * same tile, and the small grey one contradicting the pin beside it, is worse than silence.
     * The safety judgement itself is unchanged: it still keeps the beach off the podium and still
     * colours the pin — it simply stops being narrated a second time in the corner of the card.
     */
    safety: '',
    /**
     * ΤΕΣΣΕΡΙΣ ΠΡΟΤΑΣΕΙΣ ΑΝΤΙ ΓΙΑ ΜΙΑ (Μίλτος, 14/08/2026) — και η μία έλεγε ψέμα σε 1.000 παραλίες.
     *
     * Έγραφε «Θέλει σκάφος ή δύσκολο μονοπάτι» σε **κάθε** παραλία που δεν είναι άσφαλτος: ο
     * Κλειδός και η Σπεδό Νάξου το φόρεσαν με **περπατητό χωματόδρομο**, το Άλιμος Λουτρά με
     * άγνωστο τύπο δρόμου. Ο λόγος έρχεται πλέον χωρισμένος από το `explainTopPickExclusion`,
     * που τον παίρνει από το ίδιο αρχείο που όρισε το φίλτρο (`utils/access.getHardAccessKind`).
     *
     * ΚΑΙ ΕΦΥΓΕ ΤΟ «ΓΙ' ΑΥΤΟ ΜΠΑΙΝΕΙ ΜΕΤΑ ΤΙΣ ΕΥΚΟΛΕΣ». Παραβίαζε τον κανόνα που είναι γραμμένος
     * 20 γραμμές πιο πάνω — «one sentence per reason, each naming a property of THE BEACH, never
     * our list» — και ήταν λάθος: η ταξινόμηση της λίστας βάζει **χρώμα πρώτα**
     * (`utils/suitabilityTone.selectSuitableByTone`, απόφαση 10/08) και η πρόσβαση κρίνει μόνο
     * ΜΕΣΑ στο ίδιο χρώμα. Η φράση περιέγραφε τον κανόνα του ΒΑΘΡΟΥ ενώ τυπωνόταν στη ΛΙΣΤΑ,
     * οπότε ο Μίλτος έβλεπε δύο «δύσκολες» πάνω από μια «εύκολη» και το κείμενο να το διαψεύδει.
     */
    access: getAccessReasonCopy('boat_or_hard_path', language),
    access_dirt: getAccessReasonCopy('dirt_road', language),
    access_walk: getAccessReasonCopy('walk', language),
    /**
     * ΣΙΩΠΗ, με το ίδιο σκεπτικό που σώπασε το `unverified` στις 10/08 — και είναι δική του
     * απόφαση, όχι νέα: αυτή η περίπτωση μιλάει για ΕΜΑΣ («δεν έχουμε ελέγξει τον δρόμο της»),
     * όχι για την παραλία, και ο αναγνώστης δεν μπορεί να κάνει τίποτα με αυτό. Αφορά 212
     * παραλίες, ανάμεσά τους αστικές σαν το Άλιμος Λουτρά, όπου η προηγούμενη λεζάντα ήταν και
     * ψευδής και γελοία. Το να μην πούμε τίποτα είναι καλύτερο από μια δικαιολογία στη θέση της.
     */
    access_unknown: '',
    sea: getLocalizedCopy(language, {
      en: 'Rougher water on its own shore today.',
      gr: 'Πιο ταραγμένη θάλασσα στη δική της ακτή σήμερα.',
      de: 'Heute unruhigeres Wasser an dieser Küste.',
      fr: "Mer plus agitée sur sa propre côte aujourd'hui.",
      it: 'Mare più mosso sulla sua costa oggi.',
    }),
    /**
     * ΣΙΩΠΗ ΕΞ ΟΡΙΣΜΟΥ, ΜΕ ΜΙΑ ΕΞΑΙΡΕΣΗ — ίδιο σκεπτικό με το `unverified` από κάτω (22/08/2026).
     *
     * Μιλάει για ΕΜΑΣ: «το κύμα αυτής της παραλίας το παίρνουμε από κελί που περιγράφει άλλο
     * νερό». Ο αναγνώστης που διαλέγει πού θα κολυμπήσει δεν μπορεί να κάνει τίποτα με αυτό, και
     * σε μια λίστα που η σελίδα λέει «κατάλληλες» θα διαβαζόταν ως αποποίηση ευθύνης δίπλα στις
     * παροχές των άλλων καρτών. Σπάει τη σιωπή του ΜΟΝΟ όταν η αντίφαση είναι ήδη ορατή — η
     * παραλία φοράει το καλύτερο χρώμα της οθόνης και παρ' όλα αυτά δεν πήρε μετάλλιο.
     */
    sea_cell: '',
    /**
     * SILENT SINCE 10/08/2026 — kept as a reason the code can still classify, printed nowhere.
     *
     * It was the only one of the four that describes US rather than the beach, and a reader
     * choosing where to swim cannot do anything with «δεν έχουμε αρκετά στοιχεία». On a list of
     * beaches the page calls κατάλληλες it read as a disclaimer nobody asked for, sitting where
     * the amenities of the OTHER cards are. The pin beside it is coloured from live weather and
     * is trustworthy — which is precisely why the sentence had to explain itself away, and that
     * is the tell that it should not be on a card at all.
     *
     * Where the missing records genuinely matter, they already keep the beach OUT of the strict
     * podium; they do not need to be narrated on the card as well.
     */
    unverified: '',
  };
  /**
   * Η ΣΙΩΠΗ ΤΟΥ `unverified` ΣΠΑΕΙ ΣΕ ΕΝΑ ΜΟΝΟ ΣΗΜΕΙΟ (Μίλτος, 15/08/2026).
   *
   * Η ΑΝΑΦΟΡΑ: «έχεις μια ιδανική που δεν την έχεις ούτε καν να είναι τοπ 2». Η λεζάντα μετράει
   * «Ιδανική 1», και αυτή η μία δεν εμφανίζεται πουθενά στο βάθρο από κάτω. Ο αναγνώστης δεν
   * μπορεί να ξέρει αν φταίει η παραλία, η μέρα, ή εμείς — και υποθέτει ότι κάτι χάλασε.
   *
   * ΓΙΑΤΙ ΔΕΝ ΑΝΑΙΡΕΙ ΤΗΝ ΑΠΟΦΑΣΗ ΤΗΣ 10/08. Τότε το «δεν έχουμε αρκετά στοιχεία» τυπωνόταν σε
   * ΚΑΘΕ ανεπιβεβαίωτη παραλία μιας μεγάλης λίστας — μια αποποίηση ευθύνης που κανείς δεν ζήτησε,
   * στη θέση όπου οι άλλες κάρτες δείχνουν παροχές. Αυτό μένει σβηστό. Μιλάει ΜΟΝΟ όταν η παραλία
   * φοράει το καλύτερο χρώμα της οθόνης και παρ' όλα αυτά δεν πήρε μετάλλιο: εκεί η αντίφαση
   * είναι ήδη ορατή, και η σιωπή δεν την κρύβει — την αφήνει ανεξήγητη.
   *
   * Η ΔΙΑΤΥΠΩΣΗ ΜΙΛΑΕΙ ΓΙΑ ΕΜΑΣ, ΟΧΙ ΓΙΑ ΤΗΝ ΠΑΡΑΛΙΑ, και αυτό είναι σκόπιμο (ίδιο σκεπτικό με
   * το σχόλιο «σίγουρα στοιχεία» πιο πάνω): η κουκκίδα δίπλα της είναι βαμμένη από ζωντανό καιρό
   * και παραμένει αξιόπιστη. Δεν λέει «κακή παραλία» — λέει «δεν την έχουμε ελέγξει αρκετά για να
   * τη συστήσουμε». Καμία ετυμηγορία, καμία λέξη «ιδανική/κατάλληλη» (PORISMA §1703).
   *
   * Το `safety` παραμένει σιωπηλό όπως ήταν από τις 12/08 — δεν το αγγίζει αυτό.
   */
  const topColourUnverifiedNote = getLocalizedCopy(language, {
    en: 'Calm here today — but we have not checked it enough to recommend it.',
    gr: 'Ήρεμη εδώ σήμερα — αλλά δεν την έχουμε ελέγξει αρκετά για να τη συστήσουμε.',
    de: 'Heute ruhig hier — aber noch zu wenig geprüft für eine Empfehlung.',
    fr: "Calme ici aujourd'hui — mais pas assez vérifiée pour la recommander.",
    it: 'Calma qui oggi — ma non abbastanza verificata per consigliarla.',
  });
  /**
   * Η ΑΔΕΛΦΗ ΦΡΑΣΗ ΤΗΣ ΑΠΟ ΠΑΝΩ, ΓΙΑ ΣΥΓΚΕΚΡΙΜΕΝΟ ΛΟΓΟ (22/08/2026). Εκεί λείπουν στοιχεία της
   * παραλίας· εδώ ξέρουμε ακριβώς τι φταίει και το λέμε με το όνομά του: ο αριθμός του κύματος
   * βγαίνει από διπλανό νερό. Δεν κατηγορεί την παραλία και δεν υπόσχεται ότι είναι χειρότερη —
   * λέει πού κοιτάμε, και γιατί δεν βάζουμε το όνομά μας από κάτω.
   */
  const topColourOtherWaterNote = getLocalizedCopy(language, {
    en: 'Calm here today — but its wave is measured in neighbouring water.',
    gr: 'Ήρεμη εδώ σήμερα — αλλά το κύμα της το μετράμε σε διπλανό νερό.',
    de: 'Heute ruhig hier — aber ihr Wellengang wird im Nachbarwasser gemessen.',
    fr: "Calme ici aujourd'hui — mais sa houle est mesurée dans l'eau voisine.",
    it: 'Calma qui oggi — ma la sua onda è misurata in acque vicine.',
  });
  const resolveNotInTopPicksNote = (beachId: number): string | undefined => {
    const reason = topPickExclusionByBeachId.get(beachId);
    if (!reason) return undefined;
    if (reason === 'unverified' && topColourOutsideTopPicksIds?.has(beachId)) {
      return topColourUnverifiedNote;
    }
    if (reason === 'sea_cell' && topColourOutsideTopPicksIds?.has(beachId)) {
      return topColourOtherWaterNote;
    }
    return topPickExclusionCopy[reason] || undefined;
  };
  // Each filter chip shows the honest per-attribute island total (fed by App.tsx's
  // count memos), independent of wind / active filters / suitable-vs-all view. We
  // deliberately do NOT recompute over the wind-filtered `suitableBeachCards` here:
  // that made "Beach bar" read 1 on a windy Milos day (only 1 of 4 beach-bar beaches
  // was "suitable today"), which users read as "the island has 1 beach bar".
  const getDesktopFilterDisplayCount = (item: DesktopFilterItem): number | undefined => item.count;
  const directoryDisplayBeachCards = useMemo(() => {
    const sourceBeachCards = isDirectorySuitableView
      ? directorySuitableOnlyBeachCards
      : directoryAllBeachCards;

    // Distance-first can be driven either by the dropdown option (desktop) or by
    // the dedicated "Κοντά μου" button (mobile, via suitableDistanceSortActive).
    if (!isDistanceSortActive) {
      return sourceBeachCards;
    }

    const getDistance = (beach: Beach): number | undefined => {
      const directDistance = (beach as Beach & { distance?: number }).distance;
      if (typeof directDistance === 'number' && Number.isFinite(directDistance)) return directDistance;

      const contextDistance = weatherContextByBeachId.get(beach.id)?.distance;
      return typeof contextDistance === 'number' && Number.isFinite(contextDistance)
        ? contextDistance
        : undefined;
    };

    return [...sourceBeachCards].sort((a, b) => {
      const aDistance = getDistance(a);
      const bDistance = getDistance(b);
      if (aDistance !== undefined && bDistance !== undefined && aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      if (aDistance !== undefined) return -1;
      if (bDistance !== undefined) return 1;
      return 0;
    });
  }, [directoryAllBeachCards, directorySuitableOnlyBeachCards, isDirectorySuitableView, isDistanceSortActive, weatherContextByBeachId]);
  const firstWeatherBeachId = weatherBeachCards[0]?.beach.id;
  const firstDirectoryBeachId = directoryDisplayBeachCards[0]?.id;

  // Did the list the visitor is ACTUALLY looking at come back empty? The home shows one of
  // two lists — the suitable-sorted carousel or the plain directory — and BOTH render an
  // empty container rather than a message when their array is empty. Checking only the
  // directory (as the first cut of this fix did) misses the default view: verified in the
  // browser on 13/08/2026, a search for «Μπάλος» on Naxos left map + forecast on screen and
  // silently deleted every beach section, exactly as a visitor would have met it.
  const visibleBeachListIsEmpty = isDirectorySuitableView
    ? weatherBeachCards.length === 0
    : directoryDisplayBeachCards.length === 0;

  useEffect(() => {
    if (!isDistanceSortActive) return undefined;

    const firstBeachId = isDirectorySuitableView ? firstWeatherBeachId : firstDirectoryBeachId;
    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        [
          topRecommendationsCarouselRef.current,
          suitableCarouselRef.current,
          directoryCarouselRef.current,
        ].forEach(carousel => {
          if (!carousel) return;
          carousel.scrollLeft = 0;
        });

        isCarouselScrollingRef.current = false;
        if (firstBeachId && onActiveSuitableBeachChange) {
          activeSuitableBeachIdRef.current = firstBeachId;
          setActiveMapLinkedBeachId(firstBeachId);
          onActiveSuitableBeachChange(firstBeachId, { resumeFollow: false });
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [
    firstDirectoryBeachId,
    firstWeatherBeachId,
    isDirectorySuitableView,
    isDistanceSortActive,
    locationSortResetKey,
    onActiveSuitableBeachChange,
    selectedIsland?.id,
  ]);

  useEffect(() => {
    if (!isMobileViewport || !resultListResetKey) return undefined;

    const firstBeachId = isDirectorySuitableView ? firstWeatherBeachId : firstDirectoryBeachId;
    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        allBeachesPanelScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
        [
          topRecommendationsCarouselRef.current,
          suitableCarouselRef.current,
          directoryCarouselRef.current,
        ].forEach(carousel => {
          carousel?.scrollTo({ left: 0, behavior: 'auto' });
        });

        isCarouselScrollingRef.current = false;
        activeSuitableBeachIdRef.current = firstBeachId;
        setActiveMapLinkedBeachId(firstBeachId);
        onActiveSuitableBeachChange?.(firstBeachId, {
          resumeFollow: typeof firstBeachId === 'number',
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [
    firstDirectoryBeachId,
    firstWeatherBeachId,
    isDirectorySuitableView,
    isMobileViewport,
    onActiveSuitableBeachChange,
    resultListResetKey,
  ]);
  const shouldTrackDirectoryCarouselOnMap = Boolean(
    isMobileViewport &&
    directoryDisplayBeachCards.length > 0 &&
    (isAllBeachesPanelOpen || (selectedIsland && !isDirectorySuitableView))
  );

  useEffect(() => {
    if (!isMobileViewport || !selectedIsland || !onActiveSuitableBeachChange) {
      return undefined;
    }

    type CarouselDescriptor = {
      carousel: HTMLDivElement | null;
      cardSelector: string;
      datasetKey: 'suitableBeachId' | 'directoryBeachId';
    };

    const carousels: CarouselDescriptor[] = [
      hasTopRecommendationView
        ? {
          carousel: topRecommendationsCarouselRef.current,
          cardSelector: '[data-suitable-beach-id]',
          datasetKey: 'suitableBeachId',
        }
        : null,
      isDirectorySuitableView
        ? {
          carousel: suitableCarouselRef.current,
          cardSelector: '[data-suitable-beach-id]',
          datasetKey: 'suitableBeachId',
        }
        : null,
      shouldTrackDirectoryCarouselOnMap
        ? {
          carousel: directoryCarouselRef.current,
          cardSelector: '[data-directory-beach-id]',
          datasetKey: 'directoryBeachId',
        }
        : null,
    ].filter((item): item is CarouselDescriptor => Boolean(item?.carousel));

    if (carousels.length === 0) return undefined;

    let animationFrameId = 0;

    const getCardFocusY = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const mapRect = (
        document.getElementById('directory-map-section')
        ?? document.getElementById('map-section')
      )?.getBoundingClientRect();

      if (mapRect && mapRect.bottom > 0 && mapRect.bottom < viewportHeight) {
        return mapRect.bottom + (viewportHeight - mapRect.bottom) * 0.38;
      }

      return viewportHeight * 0.68;
    };

    const getVisibleCarousel = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const focusY = getCardFocusY();
      let bestCarousel: CarouselDescriptor | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      carousels.forEach(item => {
        if (!item.carousel) return;
        const rect = item.carousel.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, 0);
        const visibleBottom = Math.min(rect.bottom, viewportHeight);
        const visibleHeight = visibleBottom - visibleTop;
        if (visibleHeight < 24) return;

        const distance = focusY >= visibleTop && focusY <= visibleBottom
          ? 0
          : Math.min(Math.abs(focusY - visibleTop), Math.abs(focusY - visibleBottom));

        if (distance < bestDistance) {
          bestDistance = distance;
          bestCarousel = item;
        }
      });

      return bestCarousel;
    };

    const getActiveBeachId = () => {
      const activeCarousel = getVisibleCarousel();
      if (!activeCarousel?.carousel) return undefined;

      const carouselRect = activeCarousel.carousel.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;
      const cards = Array.from(activeCarousel.carousel.querySelectorAll<HTMLElement>(activeCarousel.cardSelector));
      let nearestBeachId: number | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cards.forEach(card => {
        const rawBeachId = card.dataset[activeCarousel.datasetKey];
        const beachId = rawBeachId ? Number(rawBeachId) : Number.NaN;
        if (!Number.isFinite(beachId)) return;

        const cardRect = card.getBoundingClientRect();
        const visibleWidth = Math.min(cardRect.right, carouselRect.right) - Math.max(cardRect.left, carouselRect.left);
        if (visibleWidth < Math.min(24, cardRect.width * 0.12)) return;

        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - carouselCenter);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBeachId = beachId;
        }
      });

      return nearestBeachId;
    };

    const updateActiveBeach = (resumeFollow = true) => {
      animationFrameId = 0;
      const nearestBeachId = getActiveBeachId();

      if (activeSuitableBeachIdRef.current === nearestBeachId && !resumeFollow) return;
      activeSuitableBeachIdRef.current = nearestBeachId;
      setActiveMapLinkedBeachId(nearestBeachId);
      onActiveSuitableBeachChange(nearestBeachId, { resumeFollow });
    };

    const scheduleUpdate = (resumeFollow = true) => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(() => updateActiveBeach(resumeFollow));
    };

    const handleScroll = () => scheduleUpdate(true);
    const handleResize = () => scheduleUpdate(false);
    const scrollContainers: Array<Window | HTMLDivElement> = [window];
    if (allBeachesPanelScrollRef.current) {
      scrollContainers.push(allBeachesPanelScrollRef.current);
    }
    carousels.forEach(item => {
      if (item.carousel) scrollContainers.push(item.carousel);
    });

    scrollContainers.forEach(container => {
      container.addEventListener('scroll', handleScroll, { passive: true });
    });
    window.addEventListener('resize', handleResize);
    scheduleUpdate(false);

    return () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      scrollContainers.forEach(container => {
        container.removeEventListener('scroll', handleScroll);
      });
      window.removeEventListener('resize', handleResize);
    };
  }, [
    directoryDisplayBeachCards.length,
    hasTopRecommendationView,
    isDirectorySuitableView,
    isMobileViewport,
    onActiveSuitableBeachChange,
    selectedIsland,
    shouldTrackDirectoryCarouselOnMap,
    topRecommendationBeachCards.length,
    weatherBeachCards.length,
  ]);

  useEffect(() => {
    const carousels = [topRecommendationsCarouselRef.current, suitableCarouselRef.current, directoryCarouselRef.current]
      .filter((carousel): carousel is HTMLDivElement => Boolean(carousel));

    if (carousels.length === 0) return undefined;

    const cleanups = carousels.map(installMouseDragScroll);
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [
    directoryDisplayBeachCards.length,
    isAllBeachesPanelOpen,
    isDirectorySuitableView,
    selectedIsland?.id,
    topRecommendationBeachCards.length,
    weatherBeachCards.length,
  ]);

  // When the user picks a beach from search, App scrolls the page to the map and fires this
  // nonce-keyed signal so we horizontally centre that beach's card in whichever carousel holds
  // it — landing them on "map on top, the beach's card right below". Horizontal-only (scrollBy
  // on the carousel), so it never fights the vertical page scroll to the map.
  useEffect(() => {
    if (!directorySearchCardFocus || !isMobileViewport) return undefined;

    const { beachId } = directorySearchCardFocus;
    let rafId = 0;
    const centreCard = () => {
      const carousels = [
        topRecommendationsCarouselRef.current,
        suitableCarouselRef.current,
        directoryCarouselRef.current,
      ].filter((carousel): carousel is HTMLDivElement => Boolean(carousel));

      for (const carousel of carousels) {
        const card = carousel.querySelector<HTMLElement>(
          `[data-suitable-beach-id="${beachId}"], [data-directory-beach-id="${beachId}"]`
        );
        if (!card) continue;
        const carouselRect = carousel.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const delta = (cardRect.left + cardRect.width / 2) - (carouselRect.left + carouselRect.width / 2);
        if (Math.abs(delta) > 1) {
          carousel.scrollBy({ left: delta, behavior: 'smooth' });
        }
        return;
      }
    };

    // Double rAF: let the name-search-filtered carousels re-render (and, on a cross-region
    // jump, the new island mount) before we measure and centre.
    rafId = window.requestAnimationFrame(() => {
      rafId = window.requestAnimationFrame(centreCard);
    });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [directorySearchCardFocus, isMobileViewport, weatherBeachCards.length, directoryDisplayBeachCards.length]);

  useEffect(() => {
    if (!onActiveSuitableBeachChange) return undefined;

    if (!shouldTrackDirectoryCarouselOnMap) {
      return undefined;
    }

    const carousel = directoryCarouselRef.current;
    if (!carousel) {
      return undefined;
    }

    let animationFrameId = 0;
    let settleTimeoutId: number | undefined;

    const updateActiveBeach = (resumeFollow = true) => {
      animationFrameId = 0;
      const carouselRect = carousel.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;
      const cards = Array.from(carousel.querySelectorAll<HTMLElement>('[data-directory-beach-id]'));
      let nearestBeachId: number | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cards.forEach(card => {
        const beachId = Number(card.dataset.directoryBeachId);
        if (!Number.isFinite(beachId)) return;
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - carouselCenter);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestBeachId = beachId;
        }
      });

      if (activeSuitableBeachIdRef.current === nearestBeachId && !resumeFollow) return;
      activeSuitableBeachIdRef.current = nearestBeachId;
      setActiveMapLinkedBeachId(nearestBeachId);
      onActiveSuitableBeachChange(nearestBeachId, { resumeFollow });
    };

    const scheduleUpdate = (resumeFollow = true) => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(() => updateActiveBeach(resumeFollow));
    };
    const handleCarouselScroll = () => {
      // Keep the map indication aligned with the card currently nearest the center
      // while the user swipes through the carousel.
      isCarouselScrollingRef.current = true;
      scheduleUpdate(true);
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      settleTimeoutId = window.setTimeout(() => {
        isCarouselScrollingRef.current = false;
        scheduleUpdate(true);
      }, 180);
    };
    const handleResize = () => scheduleUpdate(false);

    carousel.addEventListener('scroll', handleCarouselScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      isCarouselScrollingRef.current = false;
      carousel.removeEventListener('scroll', handleCarouselScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [directoryDisplayBeachCards, onActiveSuitableBeachChange, shouldTrackDirectoryCarouselOnMap]);

  const searchPlaceholder = copy.searchPlaceholder;
  const weatherDate = selectedForecast?.date ? formatDirectoryDate(selectedForecast.date, language) : undefined;
  const absoluteWeatherDate = selectedForecast?.date
    ? new Intl.DateTimeFormat(languageToDateLocale(language), {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(selectedForecast.date)
    : undefined;
  const isWeatherPanelMode = isMobileViewport && isWeatherPanelOpen;
  const conditionsOverviewDate = isWeatherPanelMode ? absoluteWeatherDate : weatherDate;
  const mobileWeatherForecastTitle = selectedIsland
    ? `${getLocalizedCopy(language, {
      en: 'Forecast',
      gr: 'Πρόγνωση',
      fr: 'Prévision',
      de: 'Vorhersage',
      it: 'Previsioni',
    })} · ${selectedIsland.name[language]}`
    : undefined;
  const updatedLabel = formatUpdatedAgo(lastUpdated, language);
  // Soft-stale window (60 min–12 h old): make the freshness explicit — an amber
  // "βάσει πρόγνωσης HH:MM" chip instead of the quiet grey "updated X ago".
  const isSoftStaleForecast = forecastFreshness === 'soft';
  // A bare "Βάσει πρόγνωσης 22:00" was fine while the window was 3 h, because 22:00 could
  // only mean today. At 12 h it can mean last night, and then the stamp reads as *more*
  // recent than it is — the one thing this chip exists to prevent. So when the forecast
  // falls on a different Athens calendar day, say so. It can only ever be yesterday: the
  // hard cutoff throws anything older than 12 h away long before it reaches this line.
  const forecastStampLabel = (() => {
    if (!isSoftStaleForecast || !lastUpdated) return updatedLabel;
    const stamp = toAthensWallClock(lastUpdated);
    const time = stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return wallClockDayKey(stamp) === wallClockDayKey(athensNow())
      ? copy.forecastAt(time)
      : copy.forecastAtYesterday(time);
  })();
  const windDirection = selectedForecast ? degToCompass(selectedForecast.wind.deg) : undefined;
  const windBeaufort = selectedForecast ? getBeaufortLevel(selectedForecast.wind.speed * 3.6) : undefined;
  // In the desktop sidebar the panel is a narrow column, so the forecast's wide
  // 3-column header/toggle row would collide. There we keep the hourly forecast
  // permanently expanded (no toggle) and drop the redundant inner header, which
  // also fills the otherwise-empty space at the bottom of the card.
  const inlineForecastInSidebar = isWeatherPanelMode || !isMobileViewport;

  // Region title (replaced the photo hero band, 29/07). The photo was decoration that never
  // earned its place: it showed one beach captioned with the island's name, it cost a licence
  // credit on every region, and in 83 of 108 regions nobody had verified it was even the right
  // place. What the visitor actually needs on landing from Google is one word — where am I.
  // That belongs above the search box, as the page title, in our own type.
  // Breadcrumb-style eyebrow: region (e.g. "Κυκλάδες") is more useful than a generic
  // country label; fall back to country when the group has no mapping.
  const contextStripEyebrow = getIslandGroupLabel(selectedIsland?.group, language) ?? copy.greece;
  // Follow the selected day (today/tomorrow/…) instead of hardcoding "today", since the
  // beach count reflects the selected day's conditions, not necessarily today's.
  const contextStripDayPrefix = getSelectedDayPrefix(selectedDate, athensNow(), language);
  // Hour-by-hour wind for the selected day, so the summary can flag an intra-day
  // shift (calm→windy or a veering wind that flips the sheltered coast) instead
  // of freezing on one snapshot. getHours() returns the Greek wall-clock hour
  // because Open-Meteo serves location-local naive timestamps.
  const contextStripHourlyWind = useMemo(() => {
    if (!selectedForecast?.hourly?.length) return undefined;
    return selectedForecast.hourly.map(item => ({
      hour: new Date(item.dt * 1000).getHours(),
      beaufort: getBeaufortLevel(item.wind.speed * 3.6),
      windDirection: degToCompass(item.wind.deg),
    }));
  }, [selectedForecast]);
  // Plain-language "what's happening today" line: all beaches calm vs. which
  // leeward shore the wind favours. Island-wide narrative derived from the wind at
  // the hour the user is viewing on the map slider (windBeaufort/windDirection are
  // already swapped to that hour upstream). We anchor the look-ahead on that same
  // slider hour so the line tracks the bar as it's dragged and never replays a
  // change that's already behind the viewed moment. mapSelectedHour shares the
  // getHours() basis with contextStripHourlyWind (naive location-local timestamps).
  const contextStripDaySummary = selectedIsland
    ? buildIslandDaySummary({
      language,
      beaufort: windBeaufort,
      windDirection,
      suitableCount: suitableBeachDisplayCount,
      totalCount: selectedIsland.beaches.length,
      hourlyWind: contextStripHourlyWind,
      anchorHour: mapSelectedHour,
      // Anchor the favoured-coast line to the viewed time window (same label the
      // "best beaches στις 15:00–18:00" headings use) so it reads as a snapshot of
      // the slider hour, not an all-day claim — the favoured beaches change as the
      // wind veers later in the day. Absent when no hour is selected (whole-day view).
      timeLabel: suitableTimePrefix,
    })
    : null;
  // When a search/filter narrows the list to a single beach, the generic
  // "N best beaches tomorrow" count line reads wrong ("1 καλύτερες παραλίες").
  // Instead, name that beach and describe its own outlook for the selected day.
  // Phrased around "conditions" (a noun) so the adjective agrees internally and
  // we sidestep Greek beach-name gender ("η Βοϊδοκοιλιά" vs "το Σαρακήνικο").
  const singleMatchedBeachCard = weatherBeachCards.length === 1 ? weatherBeachCards[0] : undefined;
  const searchedBeachStripText = (() => {
    if (!singleMatchedBeachCard) return undefined;
    const name = displayBeachName(singleMatchedBeachCard.beach.name, language);
    // Per-beach intra-day change, computed with the real exposure engine hour by
    // hour (catches the wind strengthening AND veering onto the beach), so we can
    // describe THIS beach instead of leaving the generic island line below.
    const intradayShift = selectedForecast?.hourly?.length
      ? buildBeachIntradayShift(singleMatchedBeachCard.beach, singleMatchedBeachCard.context?.geospatialExposure, selectedForecast.hourly, language)
      : undefined;
    if (intradayShift) {
      return `${name} · ${intradayShift}`;
    }
    if (typeof singleMatchedBeachCard.score !== 'number') return undefined;
    const s = singleMatchedBeachCard.score;
    // The harsh "difficult conditions" wording is reserved for genuinely strong
    // wind (≥5 Bft). A low score on a calm/moderate day (≤4 Bft) usually means
    // light chop or side exposure, not a difficult day — calling that "δύσκολες"
    // overstates it and leaves no stronger word for truly exposed, windy beaches.
    const isGenuinelyRough = (windBeaufort ?? 0) >= 5;
    const condition = s >= 85
      ? { en: 'ideal conditions', gr: 'ιδανικές συνθήκες', de: 'ideale Bedingungen', it: 'condizioni ideali', fr: 'conditions idéales' }
      : s >= 70
        ? { en: 'good conditions', gr: 'καλές συνθήκες', de: 'gute Bedingungen', it: 'buone condizioni', fr: 'bonnes conditions' }
        : s >= 50
          ? { en: 'fair conditions', gr: 'μέτριες συνθήκες', de: 'mäßige Bedingungen', it: 'condizioni discrete', fr: 'conditions moyennes' }
          : isGenuinelyRough
            ? { en: 'tricky conditions', gr: 'δύσκολες συνθήκες', de: 'schwierige Bedingungen', it: 'condizioni difficili', fr: 'conditions difficiles' }
            : { en: 'less-than-ideal conditions', gr: 'όχι ιδανικές συνθήκες', de: 'nicht ideale Bedingungen', it: 'condizioni non ideali', fr: 'conditions pas idéales' };
    return `${name} · ${getLocalizedCopy(language, condition)} ${contextStripDayPrefix}`;
  })();
  // «Κοντά μου» — ένα κουμπί, δύο πιθανές θέσεις.
  //
  // Μέχρι τις 28/08/2026 έπιανε ΔΙΚΗ ΤΟΥ πλήρη σειρά κάτω από το πεδίο αναζήτησης: 40px
  // ύψος για ένα κουμπί δύο λέξεων, ακριβώς στο πιο ακριβό σημείο της οθόνης ενός κινητού
  // 390px — και έσπρωχνε τον χάρτη και τις προτάσεις μια ολόκληρη γραμμή πιο κάτω.
  // Μετακομίζει πάνω στη γραμμή της περιοχής («ΒΟΡΕΙΟ ΑΙΓΑΙΟ»), δεξιά: εκείνη η γραμμή
  // έχει πάντα τα δύο τρίτα της άδεια, γιατί το μακρύτερο group label είναι 13 χαρακτήρες
  // («Αργοσαρωνικός») και ούτως ή άλλως κόβεται με truncate. Σημασιολογικά ανήκει κιόλας
  // εκεί: η γραμμή λέει «πού είσαι», το κουμπί λέει «όχι, δες πού είμαι ΠΡΑΓΜΑΤΙΚΑ».
  //
  // ΓΙΑΤΙ ΟΧΙ δίπλα στον <h1>, που είναι η ακόμα πιο άδεια γραμμή: μετρήθηκε στα 390px και
  // κόβει τη στήλη του τίτλου στη μέση. «Λέσβος» κέρδιζε 40px, αλλά «Παράλια Λάρισας (Αγιά
  // - Κίσσαβος)» τυλιγόταν από 2 σε 4 γραμμές και ΕΧΑΝΕ 28px. Δώδεκα από τις 140 περιοχές
  // έχουν τόσο μακρύ όνομα. Η γραμμή του group label δεν έχει αυτό το πρόβλημα ποτέ.
  //
  // Το κουμπί είναι οπτικά 32px ώστε να μη φουσκώσει τη γραμμή, αλλά η περιοχή αφής μένει
  // 44px μέσω του ::after — δεν κατεβάζουμε στόχο αφής για να κερδίσουμε pixel.
  //
  // Παραμένει mobile-only (`lg:hidden`), όπως ήταν: στο desktop δεν υπήρχε ποτέ.
  const nearMeAction = onShowNearbyBeaches ?? onUseCurrentLocation;
  const nearMeButton = nearMeAction && !isNearMeRegion ? (
    <button
      type="button"
      onClick={nearMeAction}
      disabled={isFindingCurrentLocation}
      className={`relative inline-flex h-8 max-w-[9.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[13px] font-bold leading-none transition after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 ${
        hasUserLocation
          ? 'border-transparent bg-cyan-50 text-[#007a83]'
          /* Ήσυχο, όχι δεύτερο CTA (28/08/2026): ήταν πλατύ γαλάζιο πλαίσιο ακριβώς κάτω
             από το πεδίο αναζήτησης, δηλαδή δύο κουτιά στη σειρά που ζητούσαν το ίδιο
             βάρος προσοχής. */
          : 'border-transparent text-[#007a83] hover:bg-cyan-50'
      } ${isFindingCurrentLocation ? 'cursor-wait opacity-70' : ''}`}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#007a83]" />
      <span className="min-w-0 truncate">
        {isFindingCurrentLocation && !hasUserLocation ? copy.findingLocation : copy.currentLocation}
      </span>
    </button>
  ) : null;

  // Where am I — the page title, in our own type, above the search box.
  //
  // This replaced a full-width photo band (29/07). Losing the photo loses nothing we were
  // entitled to: it was a licensed third-party image, credited in the corner, showing one
  // beach under the island's name, and in most regions unverified as even the right place.
  // Losing it gains the two things that band was costing — vertical space above the fold on
  // a 390px phone, and a first paint that does not wait on an image decode.
  //
  // <h1> deliberately: on a region page the region IS the page. The landing value-prop above
  // the search box steps down to a <p> so there is exactly one.
  const regionTitleBlock = selectedIsland && !isNearMeRegion ? (
    /* Αριστερή στοίχιση και μελανί τίτλος (28/08/2026). Ήταν κεντραρισμένος και σε
       τιρκουάζ: κεντραρισμένο κείμενο πάνω από αριστερά στοιχισμένο περιεχόμενο δίνει
       δύο άξονες ανάγνωσης στην ίδια οθόνη, και το τιρκουάζ στον τίτλο ξόδευε το χρώμα
       της μάρκας εκεί που η ιεραρχία μπορεί να βγει από το μέγεθος. Το τιρκουάζ μένει
       για ό,τι θέλουμε να πατηθεί. Ίδιο κείμενο, ίδια σειρά. */
    <div className="mb-4 px-1 text-left sm:mb-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-slate-500">
          <MapPin className="h-3 w-3 shrink-0 text-[#007a83]/70" aria-hidden="true" />
          <span className="min-w-0 truncate">{contextStripEyebrow}</span>
        </p>
        {nearMeButton && <span className="shrink-0 lg:hidden">{nearMeButton}</span>}
      </div>
      <h1 className="mt-1 font-heading text-[2.15rem] font-extrabold leading-[1] tracking-[-0.03em] text-slate-950 sm:text-[2.75rem]">
        {selectedIsland.name[language]}
      </h1>
      {/* Δύο γραμμές, όχι μία με «…» (29/08/2026). Η φράση είναι «Παραλία Άναξου · καλά ως
          τις 09:00, μετά εκτίθεται στον άνεμο»: 55–65 χαρακτήρες, που σε οθόνη 390px δεν
          χωράνε ΠΟΤΕ σε μία γραμμή στα 14px — άρα το truncate έκοβε πάντα ακριβώς το μισό
          που έχει την πληροφορία («μετά τι γίνεται»), και έμενε ένα «καλά ως τις 09:00,
          μετά εκτίθ…» που δεν λέει τίποτα. Το κόστος είναι μία γραμμή (~18px) και μόνο
          όταν η λίστα έχει πέσει σε μία παραλία· το line-clamp-2 κρατά το φρένο για ακραία
          μακριά ονόματα παραλιών. Στο desktop το max-w-md τη χωράει έτσι κι αλλιώς σε μία
          γραμμή, οπότε εκεί δεν αλλάζει τίποτα. */}
      {searchedBeachStripText && (
        <p className="mt-1.5 line-clamp-2 max-w-md text-sm font-semibold leading-snug text-slate-600">
          {searchedBeachStripText}
        </p>
      )}
      {/* Το σφάλμα εντοπισμού ζει δίπλα στο κουμπί που το προκάλεσε, όχι κάτω από την
          αναζήτηση όπως πριν. Ένας κόμβος μόνο — η φόρμα το δείχνει μόνο όταν ΔΕΝ υπάρχει
          αυτό το μπλοκ, ώστε να μην έχουμε δύο role="alert" για το ίδιο σφάλμα. */}
      {currentLocationError && (
        <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
          {currentLocationError}
        </p>
      )}
    </div>
  ) : null;

  const conditionsOverviewContent = selectedIsland ? (
    <section className="flex flex-col rounded-surface border border-line bg-surface p-3 shadow-surface sm:p-4 lg:absolute lg:inset-0 lg:overflow-hidden" aria-label={copy.conditionsOverviewAria}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 lg:shrink-0">
        <div>
          {isWeatherPanelMode && mobileWeatherForecastTitle && (
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-500 shadow-inner shadow-white/70">
                <CloudSun className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="min-w-0 truncate text-base font-extrabold leading-tight text-slate-950">
                {mobileWeatherForecastTitle}
              </h2>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-700">
            {conditionsOverviewDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {conditionsOverviewDate}
              </span>
            )}
            {forecastStampLabel && (
              <span className={`inline-flex items-center gap-1.5 ${isSoftStaleForecast ? 'rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800 ring-1 ring-amber-200' : ''}`}>
                <Clock3 className="h-3.5 w-3.5" />
                {forecastStampLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {!selectedForecast && (
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-6 text-sm font-semibold text-slate-600">
          {copy.noForecast}
        </div>
      )}

      {forecastDays && forecastDays.length > 0 && typeof selectedDayIndex === 'number' && onForecastDaySelect && (
        <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <WeatherSummary
            forecast={forecastDays}
            selectedDayIndex={selectedDayIndex}
            onDaySelect={onForecastDaySelect}
            t={t}
            islandName={selectedIsland?.name[language]}
            variant="default"
            defaultHourlyExpanded={inlineForecastInSidebar}
            useWeekdayLabels={inlineForecastInSidebar}
            hideHourlyToggle={inlineForecastInSidebar}
            hideForecastHeader={inlineForecastInSidebar}
            stackedPills={inlineForecastInSidebar}
            fillHeight={inlineForecastInSidebar}
          />
        </div>
      )}
    </section>
  ) : null;
  const closeLabel = getLocalizedCopy(language, {
    en: 'Close',
    gr: 'Κλείσιμο',
    fr: 'Fermer',
    de: 'Schließen',
    it: 'Chiudi',
  });
  const weatherPanelTitle = selectedIsland
    ? selectedIsland.name[language]
    : getLocalizedCopy(language, {
      en: 'Weather',
      gr: 'Καιρός',
      fr: 'Meteo',
      de: 'Wetter',
      it: 'Meteo',
    });
  const hasBelowHeroContent = (
    !selectedIsland ||
    hasTopRecommendationView ||
    (isMobileViewport && selectedIsland && Boolean(mapPreview)) ||
    showSuitableBeachSection ||
    (selectedIsland && isDirectorySuitableView && weatherBeachCards.length > 0) ||
    (!isMobileViewport && Boolean(conditionsOverviewContent)) ||
    (!isMobileViewport && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0) ||
    (isMobileViewport && selectedIsland && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0)
  );
  const getMapLinkedCardClassName = (beachId: number, baseClassName: string) => (
    [
      baseClassName,
      'rounded-[1.45rem] transition-shadow duration-200',
      isMobileViewport && selectedIsland && activeMapLinkedBeachId === beachId
        ? 'ring-2 ring-cyan-500/85 ring-offset-2 ring-offset-sky-50 shadow-[0_0_0_1px_rgba(8,145,178,0.18)]'
        : 'ring-0',
    ].join(' ')
  );
  const directorySortOptions: Array<{
    key: SortOption | 'suitable';
    label: string;
    isActive: boolean;
    onSelect: () => void;
    isDisabled?: boolean;
  }> = [
    {
      key: 'all',
      label: t.sortByAll,
      isActive: !directoryViewCriteria.suitable,
      onSelect: () => setDirectoryViewCriteria(current => ({ ...current, suitable: false })),
    },
    ...(hasSuitableSortOption ? [{
      key: 'suitable' as const,
      label: protectedSortLabel ?? t.sortByProtected,
      isActive: directoryViewCriteria.suitable,
      onSelect: () => setDirectoryViewCriteria(current => ({ ...current, suitable: true })),
    }] : []),
    // On mobile the "near me" action has its own dedicated button outside the
    // dropdown, so we drop the redundant distance option here to avoid duplication.
    ...(isMobileViewport ? [] : [{
      key: 'distance' as const,
      label: isFindingCurrentLocation && !hasUserLocation ? copy.findingLocation : t.sortByDistance,
      isActive: isDistanceSortActive,
      onSelect: () => {
        const shouldEnableDistance = !isDistanceSortActive;
        if (shouldEnableDistance) {
          // Refresh location for distance sorting without changing the current region.
          const requestLocation = onUseCurrentLocation ?? onRequestUserLocation;
          requestLocation?.();
        }
        onDistanceSortActiveChange?.(shouldEnableDistance);
        setDirectoryViewCriteria(current => ({ ...current, distance: shouldEnableDistance }));
      },
      isDisabled: isFindingCurrentLocation && !hasUserLocation,
    }]),
  ];
  const activeDirectorySortOptions = directorySortOptions.filter(option => option.isActive);
  const activeDirectorySortLabel = activeDirectorySortOptions.length === 0
    ? copy.sort
    : activeDirectorySortOptions.length === 1
    ? activeDirectorySortOptions[0].label
    : getLocalizedCopy(language, {
      en: `${activeDirectorySortOptions.length} criteria`,
      gr: `${activeDirectorySortOptions.length} επιλογές`,
      fr: `${activeDirectorySortOptions.length} critères`,
      de: `${activeDirectorySortOptions.length} Kriterien`,
      it: `${activeDirectorySortOptions.length} criteri`,
    });

  useEffect(() => {
    if (!isDirectorySortOpen && !isDesktopMoreFiltersOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const isInsideDirectorySort =
        directorySortRef.current?.contains(target) ||
        desktopDirectorySortRef.current?.contains(target);
      if (isDirectorySortOpen && !isInsideDirectorySort) {
        setIsDirectorySortOpen(false);
      }
      if (isDesktopMoreFiltersOpen && !desktopMoreFiltersRef.current?.contains(target)) {
        setIsDesktopMoreFiltersOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDirectorySortOpen(false);
        setIsDesktopMoreFiltersOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktopMoreFiltersOpen, isDirectorySortOpen]);
  const cardWindSpeed = selectedForecast?.wind.speed ?? 0;
  const cardTemperature = selectedForecast?.temp_max;
  const islandCardName = selectedIsland?.name[language] || activePlaceName;
  const getRoundedScore = (value: unknown) => (
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : undefined
  );
  const renderBeachDecisionCard = (
    beach: BeachCardContext,
    options: {
      score?: number;
      context?: SuitableBeach;
      recommendationRank?: number;
      recommendationLabel?: string;
      topPickTimeLabel?: string;
      density?: 'regular' | 'compact';
      showTodayScoreBadge?: boolean;
      forceTodayScoreBadge?: boolean;
      alignExposureToMap?: boolean;
      windExposureMode?: 'none' | 'simple';
      topPickPodium?: boolean;
      notInTopPicksNote?: string;
    } = {}
  ) => {
    const directContext = beach as BeachCardContext;
    const weatherContext = options.context || weatherContextByBeachId.get(beach.id);
    const distance = directContext.distance ?? weatherContext?.distance;
    const rawExposureLevel = options.context?.exposureLevel ?? directContext.exposureLevel ?? weatherContext?.exposureLevel;
    const visibleMapExposureLevel = visibleMapExposureLevels.get(beach.id);
    const alignsToMapProtected = Boolean(options.alignExposureToMap && visibleMapExposureLevel === 'protected');
    const alignsToMapLessExposed = Boolean(options.alignExposureToMap && (
      visibleMapExposureLevel === 'protected' || visibleMapExposureLevel === 'partial'
    ));
    const computedExposureLevel = options.alignExposureToMap && visibleMapExposureLevel
      ? visibleMapExposureLevel
      : rawExposureLevel === 'protected' && visibleMapExposureLevel && visibleMapExposureLevel !== 'protected'
      ? 'partial'
      : rawExposureLevel;
    // Until the region's wind-exposure geometry has loaded, a beach scored only
    // from its authored profile can read protected/partial and flash a favourable
    // "Υπήνεμη/Προστατευμένη" endorsement that the geometry then retracts (escalating
    // it to exposed). Hold the favourable claim back while loading — exposed reads
    // stay, since the geometry only escalates — so a card never shows a sheltered
    // label we immediately take away. Matches how the map hides markers until then.
    const exposureLevel = isExposureLoading && computedExposureLevel !== 'exposed'
      ? undefined
      : computedExposureLevel;
    const isExposed = exposureLevel
      ? exposureLevel !== 'protected'
      : options.context?.isExposed ?? directContext.isExposed ?? false;
    const score = getRoundedScore(options.score ?? directContext.score ?? weatherContext?.score);
    const rawCanClaimWindProtection = options.context?.canClaimWindProtection ?? directContext.canClaimWindProtection ?? weatherContext?.canClaimWindProtection;
    const canClaimWindProtection = exposureLevel === 'protected' && visibleMapExposureLevel !== 'exposed'
      ? alignsToMapProtected || rawCanClaimWindProtection === true
      : false;
    const seaCalmClaimAllowed = options.context?.seaCalmClaimAllowed ?? directContext.seaCalmClaimAllowed ?? weatherContext?.seaCalmClaimAllowed;
    const enclosedCove = options.context?.enclosedCove ?? directContext.enclosedCove ?? weatherContext?.enclosedCove;
    const lessExposedToday = isExposureLoading
      ? false
      : alignsToMapLessExposed
      ? true
      : options.alignExposureToMap && visibleMapExposureLevel === 'exposed'
      ? false
      : directContext.lessExposedToday;
    const rawWarnings = options.context?.warnings ?? directContext.warnings ?? weatherContext?.warnings;
    const cardWarnings = alignsToMapLessExposed
      ? rawWarnings?.filter(warning => warning.type !== 'exposed_to_wind')
      : rawWarnings;
    const simpleWindSuitability =
      options.context?.simpleWindSuitability ??
      directContext.simpleWindSuitability ??
      weatherContext?.simpleWindSuitability;
    const windSuitabilityText =
      options.context?.windExposureReason ??
      directContext.windExposureReason ??
      weatherContext?.windExposureReason ??
      describeSimpleWindSuitability(simpleWindSuitability, language);
    const shouldShowTodayScoreBadge = options.showTodayScoreBadge ?? !isNameSearchActive;
    const shouldForceTodayScoreBadge = shouldShowTodayScoreBadge && options.forceTodayScoreBadge === true;

    return (
      <BeachCard
        beach={{ ...beach, distance }}
        isExposed={isExposed}
        language={language}
        t={t}
        isCalm={seaCalmClaimAllowed === true}
        windSpeed={cardWindSpeed}
        beachWindSpeedKmph={options.context?.windSpeedKmph ?? directContext.windSpeedKmph ?? weatherContext?.windSpeedKmph}
        temperature={cardTemperature}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        islandName={islandCardName}
        regionId={selectedIsland?.id}
        onClick={() => onBeachClick(beach)}
        todayScore={score}
        variant="decision"
        density={options.density}
        recommendationRank={options.recommendationRank}
        recommendationLabel={options.recommendationLabel}
        topPickPodium={options.topPickPodium}
        bestBeachTime={options.context?.bestBeachTime ?? directContext.bestBeachTime ?? weatherContext?.bestBeachTime}
        bestSwimWindow={options.context?.bestTimeWindow ?? directContext.bestTimeWindow ?? weatherContext?.bestTimeWindow}
        topPickTimeLabel={options.topPickTimeLabel}
        notInTopPicksNote={options.notInTopPicksNote}
        selectedDate={selectedDate}
        selectedHour={mapSelectedHour}
        showIslandName={!selectedIsland}
        exposureLevel={exposureLevel}
        waveHeightM={options.context?.waveHeightM ?? directContext.waveHeightM ?? weatherContext?.waveHeightM}
        seaStateWaveM={options.context?.seaStateWaveM ?? directContext.seaStateWaveM ?? weatherContext?.seaStateWaveM}
        shoreWaveHeightM={options.context?.shoreWaveHeightM ?? directContext.shoreWaveHeightM ?? weatherContext?.shoreWaveHeightM}
        shoreDisplayWaveM={options.context?.shoreDisplayWaveM ?? directContext.shoreDisplayWaveM ?? weatherContext?.shoreDisplayWaveM}
        shoreWaveFromDepartingSea={options.context?.shoreWaveFromDepartingSea ?? directContext.shoreWaveFromDepartingSea ?? weatherContext?.shoreWaveFromDepartingSea}
        seaArrivalExposureLevel={options.context?.seaArrivalExposureLevel ?? directContext.seaArrivalExposureLevel ?? weatherContext?.seaArrivalExposureLevel}
        seaStatePeriodS={options.context?.seaStatePeriodS ?? directContext.seaStatePeriodS ?? weatherContext?.seaStatePeriodS}
        warnings={cardWarnings}
        confidence={options.context?.confidence ?? directContext.confidence ?? weatherContext?.confidence}
        swimmingComfort={options.context?.swimmingComfort ?? directContext.swimmingComfort ?? weatherContext?.swimmingComfort}
        canClaimWindProtection={canClaimWindProtection}
        enclosedCove={enclosedCove}
        seaCalmClaimAllowed={seaCalmClaimAllowed}
        strongWindContext={strongWindContext}
        lessExposedToday={lessExposedToday}
        windSuitabilityText={options.windExposureMode ? undefined : windSuitabilityText}
        windSuitabilityColor={simpleWindSuitability?.suitabilityColor}
        windOnlyColor={simpleWindSuitability?.windOnlyColor}
        seaOnlyColor={simpleWindSuitability?.seaOnlyColor}
        windExposureMode={options.windExposureMode}
        hideExposureBadge={options.recommendationRank !== undefined}
        showTodayScoreBadge={shouldShowTodayScoreBadge}
        forceTodayScoreBadge={shouldForceTodayScoreBadge}
      />
    );
  };
  const highlightBeachOnMap = (beachId: number) => {
    if (!onActiveSuitableBeachChange || isCarouselScrollingRef.current) return;
    activeSuitableBeachIdRef.current = beachId;
    setActiveMapLinkedBeachId(beachId);
    onActiveSuitableBeachChange(beachId, { resumeFollow: false });
  };
  const clearBeachHighlightOnMap = () => {
    if (!onActiveSuitableBeachChange || isCarouselScrollingRef.current) return;
    activeSuitableBeachIdRef.current = undefined;
    setActiveMapLinkedBeachId(undefined);
    onActiveSuitableBeachChange(undefined, { resumeFollow: false });
  };
  const beachCardHoverProps = (beachId: number) => ({
    ...(isMobileViewport ? {} : {
      onMouseEnter: () => highlightBeachOnMap(beachId),
      onMouseLeave: clearBeachHighlightOnMap,
    }),
  });
  /**
   * THE THREE PICKS, BESIDE THE MAP — three lines, desktop only.
   *
   * WHY LINES AND NOT THE CARDS. The right column is a fixed 24rem by deliberate design (see the
   * map section below); three full decision cards do not fit in it, and the obvious alternative —
   * moving the weather down to make room — was rejected: the weather is what EXPLAINS the pin
   * colours the visitor is looking at, and separating the two leaves red pins on screen with
   * nothing beside them saying it is blowing 6 Beaufort. So the answer sits above the weather in
   * the same column, compressed to name + hour, and the full cards stay under the map where there
   * is width for them.
   *
   * NOTHING IS RECOMPUTED HERE. The hour is the same `timeLabel` the card below prints, and the
   * Beaufort is `perBeachMapWind` — the reading the map's own pin used. No tone, no colour: the
   * list must never form a condition opinion of its own (validateConditionToneAgreement's
   * the-list-does-not-colour-its-own-beaches), and a number is not a verdict.
   *
   * Hovering a line lights its pin, which is the entire reason this belongs beside the map rather
   * than anywhere else on the page.
   */
  const topPicksSidebarSummary = !isMobileViewport && selectedIsland && hasTopRecommendationView && !infoOnly ? (
    <section
      className="rounded-2xl border border-sky-200 bg-white p-3 shadow-sm shadow-sky-900/5"
      aria-label={topRecommendationsQuestion}
    >
      <h2 className="mb-2 text-[0.82rem] font-extrabold leading-tight text-slate-900">
        {topRecommendationsQuestion}
      </h2>
      <ol className="space-y-1">
        {topRecommendationBeachCards.map(({ beach, timeLabel }, index) => {
          const localBeaufort = perBeachMapWind?.get(beach.id)?.beaufort ?? currentBeaufort;
          const beaufortText = typeof localBeaufort === 'number'
            ? `${localBeaufort} ${language === 'gr' ? 'Μπφ' : 'Bft'}`
            : undefined;
          const detail = [timeLabel, beaufortText].filter(Boolean).join(' · ');

          return (
            <li key={beach.id}>
              <button
                type="button"
                onClick={() => onBeachClick(beach)}
                {...beachCardHoverProps(beach.id)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white shadow-sm ${
                  index === 0 ? 'bg-amber-400' : index === 1 ? 'bg-slate-400' : 'bg-orange-300'
                }`}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.82rem] font-extrabold leading-tight text-slate-950">
                    {displayBeachName(beach.name, language)}
                  </span>
                  {detail && (
                    <span className="block truncate text-[11px] font-bold leading-tight text-slate-500">
                      {detail}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  ) : null;
  const handleDesktopFilterSelect = (item: DesktopFilterItem) => {
    if (item.kind === 'preference') {
      onCategorySelect(item.key);
      return;
    }

    onAdvancedFilterToggle?.(item.key);
  };
  const renderDesktopInlineFilterButton = (item: DesktopFilterItem) => {
    const count = getDesktopFilterDisplayCount(item);
    // A chip whose faceted count is 0 for the current selection would give no results.
    // Fade + disable it (instead of hiding) so the row layout doesn't reshuffle.
    const isUnavailable = typeof count === 'number' && count === 0 && !item.isActive;

    return (
      <button
        key={item.itemKey}
        type="button"
        onClick={() => handleDesktopFilterSelect(item)}
        disabled={isUnavailable}
        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
          item.isActive
            ? 'border-[#007a83] bg-cyan-50 text-[#007a83] shadow-sm shadow-cyan-900/5'
            : 'border-white/70 bg-white/58 text-slate-600 hover:border-cyan-200 hover:bg-white/86 hover:text-slate-950'
        } ${isUnavailable ? 'cursor-not-allowed opacity-40 hover:border-white/70 hover:bg-white/58 hover:text-slate-600' : ''}`}
        aria-pressed={item.isActive}
      >
        <span className={item.isActive ? 'text-[#007a83]' : 'text-slate-700'}>
          {item.icon}
        </span>
        <span className="whitespace-nowrap">{item.label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className={`text-[11px] font-medium leading-none tabular-nums ${item.isActive ? 'text-[#007a83]' : 'text-slate-700'}`}>
            {count}
          </span>
        )}
      </button>
    );
  };
  const renderDesktopMenuFilterButton = (item: DesktopFilterItem) => {
    const count = getDesktopFilterDisplayCount(item);
    // Same rule as the visible row above: a chip that would empty the list is faded and
    // disabled. The overflow menu is where the least-used filters live, so leaving it tappable
    // here is exactly where a dead end goes unnoticed.
    const isUnavailable = typeof count === 'number' && count === 0 && !item.isActive;

    return (
      <button
        key={item.itemKey}
        type="button"
        role="option"
        aria-selected={item.isActive}
        onClick={() => handleDesktopFilterSelect(item)}
        disabled={isUnavailable}
        className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
          item.isActive ? 'bg-cyan-50 text-[#007a83]' : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
        } ${isUnavailable ? 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-600' : ''}`}
      >
        <span className={item.isActive ? 'text-[#007a83]' : 'text-slate-700'}>{item.icon}</span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="shrink-0 text-xs font-extrabold tabular-nums text-slate-700">{count}</span>
        )}
      </button>
    );
  };
  const renderDirectorySortControl = (
    ref: React.RefObject<HTMLDivElement | null>,
    className = 'relative min-w-[12.5rem]'
  ) => (
    <div ref={ref} className={className}>
      <button
        type="button"
        onClick={() => setIsDirectorySortOpen(open => !open)}
        aria-haspopup="menu"
        aria-expanded={isDirectorySortOpen}
        className="inline-flex min-h-10 w-full items-center gap-2.5 rounded-full border border-cyan-300 bg-gradient-to-r from-cyan-50 via-white to-cyan-50/80 px-3 text-sm font-extrabold text-cyan-900 shadow-sm shadow-cyan-900/10 ring-1 ring-white/70 transition hover:border-cyan-400 hover:from-cyan-100 hover:to-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[#007a83] shadow-sm ring-1 ring-cyan-100" aria-hidden="true">
          <ArrowDownUp className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-center">{activeDirectorySortLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#007a83] transition-transform ${isDirectorySortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isDirectorySortOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-full min-w-[14rem] overflow-hidden rounded-2xl border border-cyan-100 bg-white p-1.5 shadow-xl shadow-sky-900/14 ring-1 ring-white/70"
        >
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {t.sortByTitle}
          </p>
          {directorySortOptions.map(option => (
            <button
              key={option.key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={option.isActive}
              onClick={() => {
                if (option.isDisabled) return;
                option.onSelect();
              }}
              disabled={option.isDisabled}
              className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                option.isActive
                  ? 'bg-cyan-50 text-[#007a83]'
                  : 'text-slate-600 hover:bg-cyan-50/70 hover:text-[#007a83]'
              } ${option.isDisabled ? 'cursor-wait opacity-65' : ''
              }`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.isActive && <Check className="h-4 w-4 shrink-0 text-[#007a83]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /**
   * The «Υπόλοιπες κατάλληλες» carousel, built ONCE and rendered in exactly one of two homes:
   * inside the tabbed picks surface (isTabbedPicksMode) or in its classic standalone section.
   * One instance means suitableCarouselRef always points at the real element, wherever it
   * lives — the pin-highlight listeners follow the ref, not the section.
   */
  const suitableBeachesCarouselNode = (
          <div
            ref={suitableCarouselRef}
            className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory items-stretch gap-6 overflow-x-auto overscroll-x-contain pb-3 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none sm:pb-5 lg:snap-none lg:px-5"
          >
            {selectedIsland ? (
              weatherBeachCards.map(({ beach, score, context }, index) => {
                // A name search turns this carousel into a match list, not the day's
                // ranking — so a result must NOT wear the "top beach" medal just for
                // being the first (often only) match. Drop the rank/podium and instead
                // lead the card with its own today-verdict (ideal / good / exposed…),
                // which is what someone looking up a specific beach actually wants.
                // When there's no dedicated top-3 carousel, THIS suitable carousel is the
                // numbered "best picks" surface (cards get rank 1,2,3…), so its first three
                // are the day's de-facto top 3 and earn the podium frame. Ranks 4+ stay plain.
                // BUT when amenity/preference filters are active the list is a filtered subset,
                // not the day's ranking — so a beach must NOT wear a "No 1" medal just because
                // the filter left only a few. Drop the rank/podium then (mirrors how App hides
                // the top-recommendations carousel when hasActiveSearchOrFilters).
                // A colour picked on the map legend is the same situation, and worse: a silver
                // medal on the second-roughest beach of the day reads as «η 2η καλύτερη», which
                // is the opposite of what the heading above it says.
                const hasActiveDirectoryFilters = (activeFilterCount ?? 0) > 0;
                const cardRank = isNameSearchActive || hasTopRecommendationView || hasActiveDirectoryFilters || infoOnly || activeToneFilter
                  ? undefined
                  : weatherBeachCardRankStart + index;
                return (
                <div key={beach.id} data-suitable-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className={getMapLinkedCardClassName(beach.id, `flex min-h-[24rem] w-[17rem] shrink-0 snap-start sm:min-h-[25rem] sm:w-[20rem]`)}>
                  {renderBeachDecisionCard(beach as BeachCardContext, {
                    score,
                    context,
                    recommendationRank: cardRank,
                    topPickPodium: cardRank !== undefined && cardRank <= 3,
                    showTodayScoreBadge: false,
                    forceTodayScoreBadge: false,
                    alignExposureToMap: true,
                    windExposureMode: 'none',
                    // Only here. This carousel is the list sitting right beside the podium, so
                    // «γιατί όχι κι αυτή;» is the question the reader actually has open. On the
                    // «Όλες» directory or a colour-filtered list the same line would state the
                    // obvious on every card.
                    notInTopPicksNote: cardRank === undefined || cardRank > 3
                      ? resolveNotInTopPicksNote(beach.id)
                      : undefined,
                  })}
                </div>
                );
              })
            ) : (
              sortedIslandCards.map(island => {
                const title = island.name[language];
                const features = getIslandFeatureLabels(island, language);
                const destinationCardPhoto = getIslandDestinationPhoto(island.id, 'card');

                if (!destinationCardPhoto) {
                  return (
                    <button
                      key={island.id}
                      type="button"
                      onClick={() => onSelectIsland(island)}
                      className="group w-[13rem] shrink-0 snap-start text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 sm:w-[14rem]"
                    >
                      <div className="relative h-[18.2rem] overflow-hidden rounded-lg bg-sky-100 shadow-md shadow-slate-900/12 transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                        <BeachImageFallback />
                      </div>
                      <div className="mt-3 space-y-1 rounded-2xl border border-white/65 bg-white/95 px-3 py-2.5 shadow-sm shadow-slate-900/8">
                        <h3 className="truncate text-lg font-bold leading-tight text-[#007a83]">
                          {copy.islandTitle(title)}
                        </h3>
                        <p className="text-sm font-semibold text-slate-900">
                          {copy.beachCount(island.beaches.length)}
                        </p>
                        {features.length > 0 && (
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-700">
                            {features.join(' · ')}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                }

                return (
                  <div
                    key={island.id}
                    className="group w-[13rem] shrink-0 snap-start text-left sm:w-[14rem]"
                  >
                    <div
                      className="relative h-[18.2rem] overflow-hidden rounded-lg bg-sky-100 shadow-md shadow-slate-900/12 transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
                    >
                      <CuratedPhotoImage
                        photo={destinationCardPhoto}
                        className="absolute inset-0"
                        imgClassName="h-full w-full object-cover"
                        showAttribution
                        attributionClassName="absolute bottom-2 right-2 z-20 max-w-[calc(100%-1rem)] rounded-full bg-slate-950/95 px-2 py-1 text-[10px] font-semibold leading-none text-white/92 shadow-sm [&_a]:text-white/92 [&_a]:underline-offset-2 hover:[&_a]:underline"
                      />
                      <button
                        type="button"
                        onClick={() => onSelectIsland(island)}
                        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        aria-label={copy.islandTitle(title)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectIsland(island)}
                      className="mt-3 w-full space-y-1 rounded-2xl border border-white/65 bg-white/95 px-3 py-2.5 text-left shadow-sm shadow-slate-900/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
                    >
                      <h3 className="truncate text-lg font-bold leading-tight text-[#007a83]">
                        {copy.islandTitle(title)}
                      </h3>
                      <p className="text-sm font-semibold text-slate-900">
                        {copy.beachCount(island.beaches.length)}
                      </p>
                      {features.length > 0 && (
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-700">
                          {features.join(' · ')}
                        </p>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
  );

  return (
    <section className="relative isolate bg-canvas text-slate-950" aria-label={copy.beachSearchAria} data-nosnippet="true">
      {/* Plain brand-blue field. Was a full-bleed island photo behind two white scrims;
          it only ever rendered for the 2 regions that had no hero strip, and the region
          title now carries the sense of place on its own.

          The colour used to be painted by a `position: fixed inset-0 -z-10` layer sitting
          behind the whole scrolling page — the last remnant of that photo. A full-viewport
          fixed layer under scrolling content is the one thing on this page that forces the
          phone to re-composite the entire document on every scroll frame, and it is the
          prime suspect for the white bands Miltos reported while scrolling a region page up
          and down (22/08). It was also redundant: measured against the section carrying the
          same colour itself, the two are pixel-identical at every scroll position except a
          thin strip below the hero. Section background, no fixed layer. */}

      <div className="relative mx-auto max-w-[110rem] px-4 pb-1 pt-2 sm:px-5 sm:pb-2 sm:pt-6 lg:px-6">
        {regionTitleBlock}
        {/* ΧΩΡΙΣ ΚΑΡΤΑ (28/08/2026). Ήταν λευκό κουτί με περίγραμμα, ring και βαριά σκιά,
            και μέσα του ένα input με ΔΙΚΟ ΤΟΥ περίγραμμα: δύο πλαίσια για ένα πεδίο. Τώρα
            η επιφάνεια είναι το ίδιο το input — ένα κουτί, όχι δύο. */}
        {/* ΧΩΡΙΣ z-index ΣΤΟ ΙΔΙΟ ΤΟ ΚΟΥΤΙ (29/08/2026) — και αυτό ΕΙΝΑΙ η διόρθωση, όχι
            καθάρισμα. Το `z-[120]` έκανε αυτό το section το μόνο στοιχείο της κορυφής με δικό
            του stacking context πάνω από τον διακοσμητικό καμβά (.atmosphere, z-index:-1), και
            ήταν ΑΚΡΙΒΩΣ αυτό που χανόταν: ο χώρος του έμενε σωστός και το περιεχόμενο άβαφο,
            μέχρι το επόμενο σκρολ να το ξαναζωγραφίσει. Μετρημένο από το στιγμιότυπο του Μίλτου
            (Χαλκιδική, 29/08): κενό τίτλου→ημερών 105px CSS, ενώ σε υγιή σελίδα τα ίδια στοιχεία
            απέχουν 82px κουτί (+ leading γλυφών) — δηλαδή τα 60px της μπάρας ήταν στη διάταξη,
            απλώς δεν είχαν βαφτεί. Τρίτο επεισόδιο της ίδιας οικογένειας: λευκές λωρίδες 22/08
            (αφαιρέθηκε στρώμα `fixed inset-0 -z-10`), ξεθωριασμένες μέρες 28/08 (μπλοκ z-30).
            Δύο από τα τρία θύματα είναι τα δύο stacking contexts της κορυφής.

            Το z-index χρειαζόταν μόνο για ένα πράγμα: να περνούν οι λίστες προτάσεων πάνω από
            τον χάρτη (z-30, επόμενο αδερφάκι). Άρα πάει ΕΚΕΙ — z-[130] στα δύο dropdown, που
            ζουν μέσα σε `div.relative` χωρίς δικό του context, οπότε ανταγωνίζονται τον χάρτη
            κατευθείαν μέσα στο εξωτερικό `isolate`. Ίδια στρώση, χωρίς να σηκώνει επίπεδο η
            μπάρα. Επαληθεύτηκε σε πραγματικό Chromium 412×915 ότι και οι δύο λίστες
            εξακολουθούν να ζωγραφίζονται και να πατιούνται πάνω από τον χάρτη. */}
        <section className="relative mx-auto w-full max-w-[110rem] overflow-visible pb-1 sm:pb-2">
        {/* Value proposition: tells a first-time visitor in one glance that CalmBeach ranks
            beaches by today's conditions — not a directory. Shown once to genuine newcomers on
            any entry point (homepage or a region page from search); never shown again to
            returning users, so the decision surface stays clean. */}
        {/* The first-visit value prop ("Βρες την καλύτερη παραλία για σήμερα" + how the order
            is decided) used to sit here, above the search box. Removed 05/08: the region title
            directly above is already the heading, and the explanation of the ranking was a
            paragraph nobody was going to read while looking for a search box. The search box
            and the map start higher because of it. `copy.hero.title/subtitle` are now unused in
            all five languages; left in the copy table rather than deleted, in case the block
            comes back. Nothing else reads them. */}
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setIsSearchSuggestionsOpen(false);
            setActiveSearchSuggestionIndex(-1);
            onSearchSubmit(searchDraft);
          }}
        >
          <nav className="order-2 hidden min-w-0 overflow-visible border-t border-slate-200/80 pt-3 lg:block" aria-label={copy.beachFiltersAria}>
            <div
              ref={desktopFilterMeasureRef}
              aria-hidden="true"
              className="pointer-events-none invisible flex h-0 w-full flex-nowrap items-center gap-2 overflow-hidden"
            >
              {desktopFilterItems.map(renderDesktopInlineFilterButton)}
            </div>
            <div ref={desktopFilterRowRef} className="flex w-full min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-visible">
              <div className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pr-1">
                {desktopVisibleFilterItems.map(renderDesktopInlineFilterButton)}
              </div>
              {onClearAllFilters && desktopFilterItems.some(item => item.isActive) && (
                <button
                  type="button"
                  onClick={onClearAllFilters}
                  className="inline-flex shrink-0 items-center gap-1 px-2 py-1 text-xs font-bold text-slate-600 transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {getLocalizedCopy(language, {
                    en: 'Clear',
                    gr: 'Καθαρισμός',
                    de: 'Löschen',
                    it: 'Cancella',
                    fr: 'Effacer',
                  })}
                </button>
              )}
              {hasVisibleDesktopMoreFilters && (
                <div ref={desktopMoreFiltersRef} className="relative w-[13.5rem] max-w-[38%] shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsDesktopMoreFiltersOpen(open => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isDesktopMoreFiltersOpen}
                    className={`inline-flex min-h-9 w-full max-w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-dashed px-3 py-1.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 ${
                      desktopMoreActiveCount > 0
                        ? 'border-[#007a83] bg-cyan-50/80 text-[#007a83] shadow-sm shadow-cyan-900/5'
                        : 'border-slate-300/80 bg-white/42 text-slate-700 hover:border-cyan-200 hover:bg-white/78 hover:text-slate-800'
                    }`}
                  >
                    <MoreHorizontal className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate tabular-nums">+{desktopHiddenFilterItems.length} {copy.moreCountSuffix}</span>
                    {desktopMoreActiveCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#007a83] px-1.5 text-[11px] font-extrabold text-white">
                        {desktopMoreActiveCount}
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isDesktopMoreFiltersOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {isDesktopMoreFiltersOpen && (
                    <div
                      role="listbox"
                      className="absolute right-0 top-full z-50 mt-2 w-[min(36rem,calc(100vw-4rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/25 ring-1 ring-slate-200/60"
                    >
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {desktopHiddenFilterItems.map(renderDesktopMenuFilterButton)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>

          <label className="sr-only" htmlFor="directory-search">
            {searchPlaceholder}
          </label>
          <div className="order-1 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div ref={searchBoxRef} className="relative min-w-0 flex-1">
              <input
                id="directory-search"
                type="search"
                value={searchDraft}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={shouldRenderSearchSuggestions}
                aria-controls={searchSuggestionListId}
                aria-activedescendant={activeSearchSuggestionIndex >= 0 ? `${searchSuggestionListId}-${activeSearchSuggestionIndex}` : undefined}
                autoComplete="off"
                spellCheck={false}
                inputMode="search"
                onChange={(event) => {
                  pushSearchQuery(event.target.value);
                  setIsSearchSuggestionsOpen(true);
                  setActiveSearchSuggestionIndex(-1);
                }}
                onFocus={() => {
                  if (canShowSearchSuggestions) setIsSearchSuggestionsOpen(true);
                  setIsIntentPanelOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className={`min-h-12 w-full rounded-surface border border-line bg-surface pl-4 text-base font-medium text-slate-800 shadow-surface outline-none transition placeholder:text-slate-700 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 sm:rounded-full sm:pl-5 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${
                  searchDraft.trim().length > 0 ? 'pr-[8.75rem] lg:pr-[6.5rem]' : 'pr-24 lg:pr-14'
                }`}
              />
              {searchDraft.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Urgent: clearing is a decision, not a keystroke — it must be instant.
                    pushSearchQuery('', true);
                    setIsSearchSuggestionsOpen(false);
                    setActiveSearchSuggestionIndex(-1);
                  }}
                  className="absolute right-[5.75rem] top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30 lg:right-14"
                  aria-label={language === 'gr' ? 'Καθαρισμός αναζήτησης' : 'Clear search'}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {/* Το «Φίλτρο» ζει μέσα στο πεδίο αναζήτησης κάτω από `lg`: στο κινητό η δεύτερη
                  σειρά κουμπιών έσπρωχνε τον χάρτη και τις προτάσεις μια ολόκληρη γραμμή πιο
                  κάτω, ενώ το εικονίδιο δίπλα στη λούπα διαβάζεται ως «στένεψε την αναζήτηση».
                  Στο desktop μένει η inline μπάρα φίλτρων, οπότε εδώ κρύβεται. */}
              <button
                type="button"
                onClick={onOpenFilters}
                className="absolute right-[3.35rem] top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#007a83]/35 bg-cyan-50/85 text-[#007a83] transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/40 lg:hidden"
                aria-label={
                  typeof activeFilterCount === 'number' && activeFilterCount > 0
                    ? `${copy.filter} (${activeFilterCount})`
                    : copy.filter
                }
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                {typeof activeFilterCount === 'number' && activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#007a83] px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#007a83] text-white transition hover:bg-[#00646d] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
                aria-label={copy.search}
              >
                <Search className="h-5 w-5" />
              </button>
              {shouldRenderSearchSuggestions && (
                <div
                  id={searchSuggestionListId}
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[130] overflow-hidden rounded-[1.1rem] border border-sky-100 bg-white text-left shadow-xl shadow-sky-950/12 ring-1 ring-white/70"
                >
                  {searchSuggestions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
                      {searchSuggestions.map((suggestion, index) => {
                        const isActive = index === activeSearchSuggestionIndex;
                        const suggestionKindLabel = suggestion.type === 'region' ? copy.searchRegionLabel : copy.searchBeachLabel;
                        return (
                          <button
                            key={suggestion.id}
                            id={`${searchSuggestionListId}-${index}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchSuggestionSelect(suggestion)}
                            className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[0.9rem] px-3 py-2 text-left transition ${
                              isActive ? 'bg-cyan-50 text-slate-950' : 'text-slate-800 hover:bg-sky-50'
                            }`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                              suggestion.type === 'region' ? 'bg-cyan-50 text-[#007a83]' : 'bg-sky-50 text-sky-700'
                            }`}>
                              {suggestion.type === 'region' ? (
                                <MapPin className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Waves className="h-4 w-4" aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-extrabold leading-tight text-slate-950">
                                {suggestion.label}
                              </span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight text-slate-700">
                                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-normal text-slate-700">
                                  {suggestionKindLabel}
                                </span>
                                <span className="min-w-0 truncate">{suggestion.subtitle}</span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm font-semibold text-slate-700">
                      {isSearchSuggesting ? copy.searchLoading : copy.searchNoResults}
                    </div>
                  )}
                  {isSearchSuggesting && searchSuggestions.length > 0 && (
                    <div className="border-t border-sky-50 px-4 py-2 text-xs font-bold text-[#007a83]">
                      {copy.searchLoading}
                    </div>
                  )}
                </div>
              )}
              {/* Έτοιμες προθέσεις, μόνο με άδειο πεδίο. Ζει ΜΕΣΑ στο dropdown της
                  αναζήτησης και όχι σε δική του σειρά κάτω από το κουτί: το 86% των
                  χρηστών είναι σε κινητό και η σειρά των φίλτρων από πάνω έχει ήδη
                  «+11 ακόμη» — μια τέταρτη μόνιμη σειρά θα έσπρωχνε τον χάρτη κάτω από
                  τη μέση. Εμφανίζεται τη στιγμή που ο χρήστης πάει να γράψει, δηλαδή
                  ακριβώς όταν έχει ήδη πρόθεση. */}
              {shouldRenderIntentPanel && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[130] overflow-hidden rounded-[1.1rem] border border-sky-100 bg-white p-2.5 text-left shadow-xl shadow-sky-950/12 ring-1 ring-white/70">
                  <p className="px-1 pb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-600">
                    {intentPanelLeadCopy[language] || intentPanelLeadCopy.en}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {intentBundles.map(bundle => (
                      <button
                        key={bundle.key}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleIntentBundleSelect(bundle.key)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50/70 px-3.5 text-sm font-bold text-[#007a83] transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
                      >
                        <span>{bundle.label}</span>
                        <span className="text-xs font-black tabular-nums text-slate-600">{bundle.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Η σειρά κάτω από το πεδίο ΔΕΝ φιλοξενεί πια το «Κοντά μου» (28/08/2026) — βλ.
                το σχόλιο πάνω από το `nearMeButton`. Μένει εδώ μόνο σαν εφεδρεία, για τη
                στιγμή που δεν υπάρχει μπλοκ τίτλου περιοχής να το φιλοξενήσει (καμία
                επιλεγμένη περιοχή), και για το desktop ταξινόμησης. */}
            {((nearMeButton && !regionTitleBlock)
              || (selectedIsland && directorySortOptions.length > 0)) && (
            <div className="grid grid-cols-1 gap-1.5 sm:flex sm:items-center lg:flex-nowrap lg:justify-end">
              {nearMeButton && !regionTitleBlock && (
                <div className="flex items-center gap-1.5 lg:hidden">
                  {nearMeButton}
                  {/* ΕΦΥΓΕ ΤΟ «Ανέβασε φωτό» (11/08/2026). Καθόταν δίπλα στο «Κοντά μου»,
                      ακριβώς κάτω από την αναζήτηση — δηλαδή πάνω στη γραμμή όπου κάποιος
                      αποφασίζει ΠΟΥ ΘΑ ΠΑΕΙ, και ζητούσε το ακριβώς αντίθετο: κάτι από
                      κάποιον που έχει ήδη πάει. Απόφαση Μίλτου. Η ίδια προσφορά μένει και
                      στα τρία σημεία όπου έχει νόημα — στη σελίδα παραλίας (εκεί που
                      λείπει η φωτογραφία), στο μενού λογαριασμού και στο landing. */}
                </div>
              )}
              {selectedIsland && directorySortOptions.length > 0 && (
                renderDirectorySortControl(desktopDirectorySortRef, 'relative hidden w-[13.5rem] shrink-0 lg:block')
              )}
            </div>
            )}
            {currentLocationError && !regionTitleBlock && (
              <p className="text-xs font-semibold text-rose-600 sm:col-span-2" role="alert">
                {currentLocationError}
              </p>
            )}
          </div>

        </form>

        {/* Rain warning — staying in the sea in the rain is a safety call, not a
            comfort one, so it sits above the map and the recommendations. Amber
            while it is actually raining, blue when the rain is still ahead. */}
        {rainWarning && (
          <div
            role="alert"
            className={`mt-3 flex items-start gap-3 rounded-2xl border p-3 text-left shadow-sm sm:p-3.5 ${
              rainWarning.isNow
                ? 'border-amber-300 bg-amber-50/92 text-amber-900 shadow-amber-900/5'
                : 'border-sky-200 bg-sky-50/90 text-sky-900 shadow-sky-900/5'
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${
                rainWarning.isNow ? 'bg-amber-500' : 'bg-sky-500'
              }`}
            >
              <CloudRain className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black leading-snug">{rainWarning.title}</span>
              <span className="mt-0.5 block text-sm font-semibold leading-snug opacity-90">
                {rainWarning.body}
              </span>
            </span>
          </div>
        )}

        {/* Saharan dust — advisory, not alarm: it informs the day (hazy sky, sensitive
            groups) without contradicting the wind-based verdicts. Amber only for a
            genuinely heavy episode; the common mild pass-over stays low-key. */}
        {dustLevel && (
          <div
            role="status"
            className={`mt-3 flex items-start gap-3 rounded-2xl border p-3 text-left shadow-sm sm:p-3.5 ${
              dustLevel === 'heavy'
                ? 'border-amber-300 bg-amber-50/92 text-amber-900 shadow-amber-900/5'
                : 'border-yellow-200 bg-yellow-50/90 text-yellow-900 shadow-yellow-900/5'
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${
                dustLevel === 'heavy' ? 'bg-amber-500' : 'bg-yellow-500'
              }`}
            >
              <Haze className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black leading-snug">
                {dustLevel === 'heavy' ? copy.dustWarning.heavyTitle : copy.dustWarning.elevatedTitle}
              </span>
              <span className="mt-0.5 block text-sm font-semibold leading-snug opacity-90">
                {dustLevel === 'heavy' ? copy.dustWarning.heavyBody : copy.dustWarning.elevatedBody}
              </span>
            </span>
          </div>
        )}

        {selectedIsland && mapPreview && !isMobileViewport && (
          <section
            id="directory-map-section-desktop"
            className="mt-4 border-t border-slate-200/80 pt-4"
            aria-label={copy.beachMapAria}
          >
            {/* The weather column is a fixed 24rem, not a third of the row. At 1/3 it grew with
                the viewport — on a wide screen it was 540px of mostly empty space between the
                temperature and the Beaufort number, while the map, the thing people actually
                read, stayed cramped. A read-only column has a natural width; past it the extra
                pixels do nothing, so they go to the map instead.

                Hidden entirely (one column) when the visitor has asked for the full-width map.
                Below `lg` this is one column anyway and the toggle is not rendered — on a phone
                the weather is already its own «Καιρός» panel. */}
            <div className={`lg:items-stretch lg:gap-4 ${
              isWeatherColumnHidden ? 'lg:block' : 'lg:grid lg:grid-cols-[minmax(0,1fr)_24rem]'
            }`}>
              <div
                id="directory-map-panel-desktop"
                className="overflow-hidden rounded-surface border border-line bg-surface p-3 text-left shadow-surface sm:p-4"
              >
                {/* Above the map, not floating on it: Leaflet already owns the top-right corner
                    (zoom / layers / recentre) and the top-left carries the wind-direction card,
                    so an overlay would either collide or cover pins. */}
                <div className="mb-2 hidden justify-end lg:flex">
                  <button
                    type="button"
                    onClick={toggleWeatherColumn}
                    aria-pressed={isWeatherColumnHidden}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    {isWeatherColumnHidden ? (
                      <PanelRightOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <PanelRightClose className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    {isWeatherColumnHidden ? copy.showWeatherColumn : copy.fullWidthMap}
                  </button>
                </div>
                <div>
                  {mapPreview}
                </div>
              </div>
              {(conditionsOverviewContent || topPicksSidebarSummary) && (
                <div className={`mt-4 lg:col-span-1 lg:mt-0 lg:relative lg:min-h-0 ${
                  isWeatherColumnHidden ? 'lg:hidden' : ''
                }`}>
                  {/* Answer first, then the weather that explains it — in ONE column, so the
                      Beaufort reading never leaves the side of the pins it accounts for. */}
                  <div className="space-y-3 lg:absolute lg:inset-0 lg:flex lg:flex-col lg:gap-3 lg:space-y-0">
                    {topPicksSidebarSummary && (
                      <div className="lg:shrink-0">{topPicksSidebarSummary}</div>
                    )}
                    {conditionsOverviewContent && (
                      <div className="lg:relative lg:min-h-0 lg:flex-1">
                        {conditionsOverviewContent}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        </section>
      </div>

      {hasBelowHeroContent && (
      <div className="relative">
        <div className="mx-auto max-w-[110rem] px-4 pb-4 pt-0.5 sm:px-5 sm:pb-5 sm:pt-2 lg:px-6">
          {selectedIsland && mapPreview && isMobileViewport && (
            <>
              {/* Static, zero-height twin of the sticky map below, and the ONLY thing anything
                  should measure when it wants to scroll the map into view. A `position: sticky`
                  element reports its STUCK rect — 8px from the viewport top — the moment you are
                  scrolled past its natural place, so "scroll to the map" computed a destination
                  equal to where you already were and did nothing. That is what sent «Κοντά μου»
                  from the landing page to the legal footer: the scroll was a no-op, then the
                  shorter nearby page clamped the old offset to the bottom of the document.

                  ΜΕΤΡΗΘΗΚΕ 29/08/2026, ΚΑΙ ΔΙΑΨΕΥΔΕΙ ΤΗΝ ΠΑΡΑΠΑΝΩ ΠΑΡΑΓΡΑΦΟ: σήμερα το
                  `sticky top-2` ΔΕΝ κολλάει καθόλου. Το `overflow-x: hidden` στο <body>
                  (index.css, με δικό του «KEEP THIS») κάνει το body κουτί κύλισης που δεν
                  κυλάει ποτέ, και αυτό ακυρώνει κάθε position:sticky σε επίπεδο σελίδας.
                  Μετρημένο σε 390×844: το rect του section πάει −25 → −105 → −345 καθώς
                  κατεβαίνει το σκρολ, αντί να σταματήσει στα 8px. Ο χάρτης φεύγει κανονικά
                  προς τα πάνω. Ο anchor μένει γιατί είναι σωστός ούτως ή άλλως — αλλά μην
                  χτίσεις τίποτα πάνω στην υπόθεση ότι κάτι εδώ κολλάει, όπως έγινε μία φορά
                  (υπόθεση επικάλυψης μπάρας-αναζήτησης × χάρτη, που δεν συμβαίνει ποτέ). */}
              <div id="directory-map-anchor" aria-hidden="true" className="h-0 w-full" />
              <section
                id="directory-map-section"
                className="sticky top-2 z-30 mb-1.5 space-y-1.5 sm:mb-4 sm:space-y-2"
                aria-label={copy.beachMapAria}
              >
                {mapDayStrip}
                {/* ΣΥΜΠΑΓΕΣ ΛΕΥΚΟ ΚΑΙ ΕΔΩ, για τον ίδιο λόγο με τις κάρτες των ημερών: η κάρτα
                    του χάρτη είναι το δεύτερο μισό του ίδιου μπλοκ, και ένα 95% λευκό αφήνει
                    το μισοβαμμένο καρέ του σκρολ να φανεί από μέσα. Πάνω σε φόντο sky-100 η
                    διαφορά 95%→100% δεν διαβάζεται με μάτι· το φάντασμα διαβαζόταν. */}
                <div className="relative overflow-hidden rounded-surface bg-surface pb-1 text-left shadow-lifted">
                  {mapPreview}
                </div>
              </section>
            </>
          )}

          {/* THE ANSWER BLOCK. Framed — border, tint, ring — so the three picks read as one thing
              the page is telling you, not as the first three of the list below. The list's own
              heading stays a plain hairline row, and the contrast between the two is the whole
              point: same three beaches as before, but now something on the page says what they ARE. */}
          {selectedIsland && hasTopRecommendationView && !infoOnly && (
            <section
              id="top-recommendations-section"
              className="mb-3 rounded-surface border border-line bg-surface px-3 pb-1 pt-2 shadow-surface scroll-mt-[25rem] sm:mb-5 sm:px-5 sm:pb-2 sm:pt-4 sm:scroll-mt-4"
              aria-label={mobileTopRecommendationsTitle}
            >
              <div className="mb-1.5 space-y-1 text-center sm:mb-3">
                {/* The «Πού να πάμε τώρα;» question dropped off DESKTOP the same evening it was
                    tightened on mobile (Miltos): once the tabs carry «Top 3 στις HH:MM» /
                    «Υπόλοιπες» as their own labels, a full-sentence question above them repeats
                    the same claim in a second, louder voice. The frame — border, tint, ring —
                    is what still marks this block as the answer; it no longer needs to say so
                    in words on EITHER viewport. */}
                {isTabbedPicksMode ? (
                  /* «Top 3» / «Υπόλοιπες» segmented control. Switching never scrolls: both lists
                     live at the SAME height, right under the (sticky, on mobile) map, so the pins
                     stay in view whichever list is open. */
                  <div
                    role="tablist"
                    aria-label={mobileTopRecommendationsTitle}
                    className="mx-auto flex w-fit max-w-full items-center gap-1 rounded-full bg-canvas p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activePicksTab === 'top'}
                      onClick={() => setActivePicksTab('top')}
                      className={`min-h-9 min-w-0 rounded-full px-3 text-xs font-extrabold leading-tight transition sm:px-4 sm:text-sm ${
                        activePicksTab === 'top'
                          ? 'bg-surface text-slate-950 shadow-surface'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {topTabLabel}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activePicksTab === 'rest'}
                      onClick={() => setActivePicksTab('rest')}
                      className={`min-h-9 min-w-0 rounded-full px-3 text-xs font-extrabold leading-tight transition sm:px-4 sm:text-sm ${
                        activePicksTab === 'rest'
                          ? 'bg-surface text-slate-950 shadow-surface'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {restTabLabel}
                    </button>
                  </div>
                ) : (
                  <h2 className={`font-heading font-extrabold leading-tight text-slate-950 [text-wrap:balance] ${
                    isMobileViewport ? 'text-sm' : 'text-lg sm:text-2xl'
                  }`}>
                    {mobileTopRecommendationsTitle}
                  </h2>
                )}
                {/* The honesty/warning lines describe the TOP-3, so they stand down while the
                    visitor is looking at «Υπόλοιπες». */}
                {(!isTabbedPicksMode || activePicksTab === 'top') && (
                  <>
                    {shelteredFallbackPodium && (
                      <p className="text-xs font-bold leading-snug text-amber-900 sm:text-sm">
                        {topRecommendationsSubtitle}
                      </p>
                    )}
                    {/* Amber is a register here ("mind the clock"), NOT a tone claim — no pin sits
                        beside it and the sentence never states a condition level, it states an
                        hour. Silent unless the day genuinely worsens; see App's buildDayTurnNote. */}
                    {dayTurnNote && (
                      <p className="mx-auto max-w-2xl text-xs font-bold leading-snug text-amber-900 sm:text-sm">
                        {dayTurnNote}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div
                ref={topRecommendationsCarouselRef}
                role={isTabbedPicksMode ? 'tabpanel' : undefined}
                className={`beach-card-carousel no-scrollbar -mx-3 flex cursor-grab snap-x snap-mandatory items-stretch gap-6 overflow-x-auto overscroll-x-contain px-3 pb-3 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none sm:-mx-5 sm:px-5 sm:pb-5 lg:snap-none${
                  isTabbedPicksMode && activePicksTab === 'rest' ? ' hidden' : ''
                }`}
              >
                {topRecommendationBeachCards.map(({ beach, score, context, timeLabel }, index) => (
                  <div key={beach.id} data-suitable-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className={getMapLinkedCardClassName(beach.id, `flex min-h-[24rem] w-[17rem] shrink-0 snap-start sm:min-h-[25rem] sm:w-[20rem]`)}>
                    {renderBeachDecisionCard(beach as BeachCardContext, {
                      score,
                      context,
                      recommendationRank: index + 1,
                      topPickPodium: true,
                      showTodayScoreBadge: false,
                      alignExposureToMap: true,
                      windExposureMode: 'none',
                      // «Μέχρι τι ώρα». The card has carried this slot since the top-pick work
                      // (BeachCard's «Καλύτερη ώρα» row) and the region podium simply never fed
                      // it — only the home preview did.
                      topPickTimeLabel: timeLabel,
                      // A podium seat filled from the last-resort list keeps its caveat. Beaches
                      // that cleared every gate have no reason attached, so this stays silent for
                      // them — the line only ever appears where something really is not ideal.
                      // Silent as well when NOTHING here cleared the bar: the subtitle above has
                      // already said it once, for all three.
                      notInTopPicksNote: shelteredFallbackPodium
                        ? undefined
                        : resolveNotInTopPicksNote(beach.id),
                    })}
                  </div>
                ))}
                {/* Desktop transparency rail. Three cards are ~63rem, so wide screens leave a
                    dead column on the right; it now answers the two questions the cards can't:
                    «γιατί αυτές;» (each pick's own explanation, which the podium never surfaced)
                    and «πώς βγαίνει η σειρά;». Gated at 1360px — below that the rail's min
                    width would push the third card into horizontal scroll. */}
                <aside className="hidden w-0 min-w-[16rem] max-w-[26rem] flex-1 flex-col justify-center gap-4 self-stretch rounded-surface border border-line bg-surface p-5 text-left min-[1360px]:flex">
                  <div>
                    <h3 className="mb-1 text-sm font-extrabold text-slate-950">{topPicksWhyTitle}</h3>
                    {!shelteredFallbackPodium && (
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">{topPicksWhyLead}</p>
                    )}
                    <ul className="space-y-2">
                      {topRecommendationBeachCards.map(({ beach }, index) => {
                        const claim = topPickDistinguishers.find(entry => entry.beachId === beach.id)?.claim;
                        if (!claim) return null;
                        return (
                          <li key={beach.id} className="flex gap-2 text-xs leading-snug text-slate-700">
                            <span className="font-extrabold text-[#007a83]">{index + 1}.</span>
                            <span>
                              <strong className="font-bold text-slate-900">{displayBeachName(beach.name, language)}</strong>
                              {' — '}
                              {claim}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="border-t border-sky-100 pt-3">
                    <h3 className="mb-2 text-sm font-extrabold text-slate-950">{topPicksHowTitle}</h3>
                    {showTopPickCriteria ? (
                      <TopPickLadderPanel language={language} isCalmDay={isCalmPodiumDay} className="mb-2" />
                    ) : (
                      <ul className="mb-2 list-disc space-y-1 pl-4 text-xs leading-snug text-slate-700">
                        {topPicksHowBullets.map(bullet => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                    <a
                      href={topPicksMethodologyPath}
                      className="text-xs font-bold text-[#007a83] underline decoration-sky-300 underline-offset-2 hover:text-[#00565d]"
                    >
                      {topPicksMethodLinkLabel}
                    </a>
                  </div>
                </aside>
              </div>
              {/* Η ΥΠΟΓΡΑΦΗ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΟΘΟΝΗ (απόφαση Μίλτου, 22/08/2026). Κάτω από το βάθρο,
                  γιατί εκεί λέμε «πήγαινε εκεί» — κι εκεί θέλει ο κόσμος να ξέρει ποιος το λέει.
                  ΔΕΝ μπαίνει και στο πλαϊνό `topPicksSidebarSummary`: σε οθόνη ≥1024px θα φαινόταν
                  δύο φορές, που είναι ακριβώς η ταπετσαρία που ο κανόνας απαγορεύει.
                  Συμπληρώνει, δεν επαναλαμβάνει, το «Πώς βγαίνει το Top 3» από κάτω: εκείνο εξηγεί
                  τη ΣΕΙΡΑ και είναι κλειστό στο κινητό· αυτή λέει γιατί η ετυμηγορία δεν είναι
                  πρόγνωση καιρού, και είναι πάντα ορατή. */}
              {hasTopRecommendationView && !infoOnly && (
                <EvidenceSignature language={language} className="mt-1 text-center" />
              )}
              {/* Both tab panels come FIRST, so «Πώς βγαίνει το Top 3» below them sits under the
                  cards on EITHER tab (Miltos, 12/08/2026). It used to live between the two, which
                  looks right on «Top 3» and wrong on «Υπόλοιπες»: with the podium carousel hidden,
                  the disclosure collapsed upward and became the first thing under the tabs, so the
                  same control moved as you switched. Only one of the two panels is ever visible,
                  so ordering them back-to-back changes nothing else. */}
              {isTabbedPicksMode && (
                <div role="tabpanel" className={activePicksTab === 'top' ? 'hidden' : undefined}>
                  {suitableBeachesCarouselNode}
                </div>
              )}
              {/* The same ladder for the 86% who never see the rail. Below 1360px it goes UNDER the
                  cards, folded shut: the answer to «πού να πάω» is the three cards, and the answer
                  to «γιατί με αυτή τη σειρά» is a question the reader asks second, if at all. Open
                  by default it would push the list below the fold on a phone. */}
              {showTopPickCriteria && (
                <details className="mt-2 rounded-surface border border-line bg-surface px-3 py-2 text-left min-[1360px]:hidden">
                  <summary className="cursor-pointer list-none text-xs font-extrabold text-slate-800 marker:hidden">
                    {topPicksHowTitle}
                  </summary>
                  <div className="pt-2">
                    {/* «ΓΙΑΤΙ ΑΥΤΕΣ ΚΑΙ ΟΧΙ ΟΙ ΑΛΛΕΣ» ΚΑΙ ΣΤΟ ΚΙΝΗΤΟ (11/08/2026).
                        Until today these per-beach reasons lived only in the ≥1360px rail, i.e.
                        the 14% of visits. The weights table beside them was already duplicated
                        here for exactly that reason; the sentences that answer the visitor's
                        actual question were not, which is the wrong half to leave on desktop. */}
                    <h4 className="mb-1 text-xs font-extrabold text-slate-950">{topPicksWhyTitle}</h4>
                    {!shelteredFallbackPodium && (
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">{topPicksWhyLead}</p>
                    )}
                    <ul className="mb-3 space-y-2">
                      {topRecommendationBeachCards.map(({ beach }, index) => {
                        const claim = topPickDistinguishers.find(entry => entry.beachId === beach.id)?.claim;
                        if (!claim) return null;
                        return (
                          <li key={beach.id} className="flex gap-2 text-[11px] leading-snug text-slate-700">
                            <span className="font-extrabold text-[#007a83]">{index + 1}.</span>
                            <span>
                              <strong className="font-bold text-slate-900">{displayBeachName(beach.name, language)}</strong>
                              {' — '}
                              {claim}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <TopPickLadderPanel language={language} isCalmDay={isCalmPodiumDay} />
                    <a
                      href={topPicksMethodologyPath}
                      className="mt-2 inline-block text-[11px] font-bold text-[#007a83] underline decoration-sky-300 underline-offset-2"
                    >
                      {topPicksMethodLinkLabel}
                    </a>
                  </div>
                </details>
              )}
            </section>
          )}

          {(!selectedIsland || (isDirectorySuitableView && !isTabbedPicksMode)) && (
          <>
          <div id={selectedIsland ? 'suitable-beaches-section' : undefined} className="mb-1.5 flex scroll-mt-[25rem] items-center justify-center gap-3 px-3 sm:mb-3 sm:scroll-mt-4 lg:px-5">
            <span className="hidden h-px flex-1 bg-slate-300/70 min-[430px]:block" aria-hidden="true" />
            <h2 className="line-clamp-2 min-w-0 max-w-full flex-[0_1_auto] text-center text-xs font-extrabold leading-tight tracking-normal text-slate-700 sm:text-sm">
              {selectedIsland ? withCount(suitableSectionLabel, suitableBeachDisplayCount) : copy.popularDestinations}
            </h2>
            <span className="hidden h-px flex-1 bg-slate-300/70 min-[430px]:block" aria-hidden="true" />
          </div>

          {selectedIsland && filterDropNote && (
            <p
              role="status"
              className="mx-3 mb-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-center text-[11px] font-semibold leading-snug text-amber-900 sm:mb-3 sm:text-xs lg:mx-5"
            >
              {filterDropNote}
            </p>
          )}

          {suitableBeachesCarouselNode}
          </>
          )}


          {/* THE DEAD END, fixed 13/08/2026. Every beach list on this screen — the suitable
              carousel above and both directory sections below — renders an empty container
              rather than a message when it has no cards, so a search matching nothing left
              this spot completely blank: no explanation, no way out. Measured 29/07–12/08/2026:
              233 of the 288 people who searched (81%) reached that blank screen, and the card
              that answers them had existed since 28/07 but was unreachable all summer (see the
              note in BeachSearchEmptyState). One block for both viewports and both views —
              whichever list would have rendered here is gone anyway. */}
          {selectedIsland && visibleBeachListIsEmpty && hasActiveSearchOrFilters && (
            <section id="all-beaches-section" className="mt-7 scroll-mt-4">
              <BeachSearchEmptyState
                language={language}
                t={t}
                searchQuery={searchQuery}
                // Wrapped, NOT passed straight through: onSearchSubmit reaches App as
                // handleDirectorySearchSubmit(queryOverride?), so handing it to onClick makes
                // React pass the mouse event as the query and the search dies with
                // "(queryOverride ?? beachSearchQuery).trim is not a function". Caught in the
                // browser on 13/08/2026 — the button rendered fine and did nothing.
                onSearchAllRegions={() => { onSearchSubmit(); }}
                onClearSearchAndFilters={onClearSearchAndFilters}
                isNearMe={isNearMeRegion}
                foundElsewhereKm={nearMeMissDistanceKm}
                onBackToNearMe={onBackToNearMe}
              />
            </section>
          )}

          {selectedIsland && !isMobileViewport && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0 && (
            <section id="all-beaches-section" className="mt-8 scroll-mt-4 rounded-surface border border-line bg-surface p-4 shadow-surface sm:p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight text-slate-950">
                    {directoryTitle}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-extrabold text-[#007a83]">
                    {copy.beachCount(directoryDisplayBeachCards.length)}
                  </span>
                  {renderDirectorySortControl(directorySortRef, 'relative min-w-[12.5rem] lg:hidden')}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {directoryDisplayBeachCards.map(beach => (
                  <div key={beach.id} {...beachCardHoverProps(beach.id)} className="h-full">
                    {renderBeachDecisionCard(beach, { alignExposureToMap: !isDirectorySuitableView, windExposureMode: 'simple' })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {selectedIsland && isMobileViewport && !isDirectorySuitableView && directoryDisplayBeachCards.length > 0 && (
            <section id="all-beaches-section" className="scroll-mt-[25rem]">
              <div className="mb-1.5 flex items-center gap-3 px-3 sm:mb-3">
                <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
                <h2 className="line-clamp-2 min-w-0 max-w-full flex-[0_1_auto] text-center text-xs font-extrabold leading-tight tracking-normal text-slate-700">
                  {withCount(directoryTitle, directoryDisplayBeachCards.length)}
                </h2>
                <span className="h-px flex-1 bg-slate-300/70" aria-hidden="true" />
              </div>

              <div
                ref={directoryCarouselRef}
                className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory items-stretch gap-6 overflow-x-auto overscroll-x-contain pb-3 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none sm:pb-5 lg:snap-none"
              >
                {directoryDisplayBeachCards.map(beach => (
                  <div key={beach.id} data-directory-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className={getMapLinkedCardClassName(beach.id, `flex min-h-[24rem] w-[17rem] shrink-0 snap-start sm:min-h-[25rem] sm:w-[20rem]`)}>
                    {renderBeachDecisionCard(beach, { alignExposureToMap: true, windExposureMode: 'simple' })}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      )}

      {selectedIsland && isMobileViewport && isWeatherPanelOpen && conditionsOverviewContent && (
        <div
          className="fixed inset-0 z-[1200] flex bg-sky-50 text-slate-950 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={weatherPanelTitle}
        >
          <div className="flex min-h-0 w-full flex-col">
            <header className="sticky top-0 z-20 border-b border-sky-100 bg-white px-4 py-3 shadow-sm shadow-sky-900/5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-extrabold leading-tight text-[#007a83]">
                    {weatherPanelTitle}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeatherPanelOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4">
              {conditionsOverviewContent}
            </div>
          </div>
        </div>
      )}

      {selectedIsland && isMobileViewport && isAllBeachesPanelOpen && (
        <div
          className="fixed inset-0 z-[1200] flex bg-sky-50 text-slate-950 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={copy.allOtherBeaches}
        >
          <div className="flex min-h-0 w-full flex-col">
            <header className="sticky top-0 z-20 border-b border-sky-100 bg-white px-4 py-3 shadow-sm shadow-sky-900/5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-extrabold leading-tight text-slate-950">
                    {directoryTitle}
                  </h2>
                  <p className="mt-0.5 text-xs font-bold text-[#007a83]">
                    {copy.beachCount(directoryDisplayBeachCards.length)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllBeachesPanelOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAllBeachesPanelOpen(false);
                    onOpenFilters();
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 text-sm font-extrabold text-[#007a83] transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {copy.filter}
                  {typeof activeFilterCount === 'number' && activeFilterCount > 0 && (
                    <span className="rounded-full bg-[#007a83] px-1.5 py-0.5 text-[11px] font-black leading-none text-white ring-1 ring-cyan-100 tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {renderDirectorySortControl(directorySortRef, 'relative min-w-[9.75rem]')}
              </div>
            </header>
            <div ref={allBeachesPanelScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4">
              <div className="space-y-4">
                {mapPreview && (
                  <div className="overflow-hidden rounded-[1.35rem] border border-sky-100 bg-white/95 p-2 text-left shadow-sm shadow-sky-900/8 ring-1 ring-white/45">
                    {mapPreview}
                  </div>
                )}

                {directoryDisplayBeachCards.length > 0 ? (
                  <>
                    <div
                      ref={directoryCarouselRef}
                      className="beach-card-carousel no-scrollbar flex cursor-grab snap-x snap-mandatory items-stretch gap-6 overflow-x-auto overscroll-x-contain pb-3 select-none active:cursor-grabbing data-[dragging=true]:cursor-grabbing data-[dragging=true]:snap-none sm:pb-5 lg:snap-none"
                    >
                      {directoryDisplayBeachCards.map(beach => (
                        <div key={beach.id} data-directory-beach-id={beach.id} {...beachCardHoverProps(beach.id)} className={getMapLinkedCardClassName(beach.id, `flex min-h-[24rem] w-[17rem] shrink-0 snap-start sm:min-h-[25rem] sm:w-[20rem]`)}>
                          {renderBeachDecisionCard(beach, { alignExposureToMap: !isDirectorySuitableView, windExposureMode: 'simple' })}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-sky-100 bg-white/88 px-4 py-8 text-center text-sm font-semibold text-slate-600 shadow-sm shadow-sky-900/5">
                    {getLocalizedCopy(language, {
                      en: 'No beaches match these filters.',
                      gr: 'Δεν βρέθηκαν παραλίες με αυτά τα φίλτρα.',
                      fr: 'Aucune plage ne correspond à ces filtres.',
                      de: 'Keine Strände passen zu diesen Filtern.',
                      it: 'Nessuna spiaggia corrisponde a questi filtri.',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
