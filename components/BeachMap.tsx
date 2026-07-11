import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BadgeCheck, Footprints, Navigation, MapPin, Clock, Wind, X, Info, Utensils, Waves, Users, Tent, Ticket, Euro, AlertTriangle } from 'lucide-react';
import { localizedPopularityLabel, localizedPaidEntryLabel, localizedPaidEntryExplanation } from '../utils/localization';
import { SuitableBeach, Beach, LanguageCode, ForecastItem } from '../types';
import { trackEvent } from '../services/analyticsService';
import { getBeachPhotoLookup } from '../services/beachPhotos';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';
import { getBeachMapCoordinates } from '../utils/mapCoordinates';
import { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel, shouldShowWindExposureColors } from '../utils/mapExposure';
import type { ExposureLevel } from '../utils/windExposure';
import { canOpenNavigation, getNavigationBadge, openNavigation } from '../utils/navigation';
import { AmenityChip, getAmenityChips } from '../utils/amenities';
import { translations } from '../translations';

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
  /** Called when the user scrubs the slider to a different hour. */
  onHourChange?: (dt: number) => void;
  /** Whether to render the docked hour slider under the map. */
  enableHourSlider?: boolean;
  language?: LanguageCode;
  selectedDate?: Date;
  compact?: boolean;
  preview?: boolean;
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
    },
    gr: {
      EASY: 'Easy access',
      MODERATE: 'Moderate access',
      DIFFICULT: 'Difficult road',
      BOAT_ONLY: 'Boat only',
    },
    de: {
      EASY: 'Easy access',
      MODERATE: 'Moderate access',
      DIFFICULT: 'Difficult road',
      BOAT_ONLY: 'Boat only',
    },
    it: {
      EASY: 'Easy access',
      MODERATE: 'Moderate access',
      DIFFICULT: 'Difficult road',
      BOAT_ONLY: 'Boat only',
    },
    fr: {
      EASY: 'Easy access',
      MODERATE: 'Moderate access',
      DIFFICULT: 'Difficult road',
      BOAT_ONLY: 'Boat only',
    },
  });
  const metadataLabels: Record<string, string> = {
    asphalt_road: labels.EASY,
    passable_dirt_road: 'Dirt road',
    difficult_dirt_road: 'Rough dirt road',
    '4x4_only': labels.DIFFICULT,
    hiking_path_easy: 'Path access',
    hiking_path_difficult: 'Hard path',
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
      sunbeds: 'Sunbeds',
      foodNearby: 'Taverna',
      cafeNearby: 'Cafe',
      parking: 'Parking',
      organizedFacilities: 'Facilities',
      seasonalFacilities: 'Seasonal',
      noFacilities: 'No facilities',
      unknownFacilities: 'Unknown',
    },
    de: {
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
    it: {
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
    fr: {
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
  photosSoonLabel: string;
  featureChips: HoverPreviewFeatureChip[];
  localWind?: { deg: number; speedKmh: number };
  windLabel?: string;
}> = ({ item, position, mapViewportRef, language, photoUrl, photosSoonLabel, featureChips, localWind, windLabel }) => {
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

  return (
    <div
      aria-hidden="true"
      data-testid="map-hover-preview-card"
      className="pointer-events-none absolute z-[1150] hidden md:block"
      style={{ left, top, width: HOVER_PREVIEW_WIDTH }}
    >
      <div className="overflow-hidden rounded-2xl border border-white/85 bg-white/94 shadow-2xl shadow-slate-950/20 ring-1 ring-sky-100/80 backdrop-blur-xl">
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
            <div className="flex h-full w-full items-center justify-center gap-2 text-cyan-700">
              <Waves className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-black">{photosSoonLabel}</span>
            </div>
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
const RecenterMap = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  const [lat, lon] = center;

  useEffect(() => {
    map.setView(center, zoom);
  }, [lat, lon, zoom, map]);

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
    lastFitKeyRef.current = fitKey;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], Math.max(map.getZoom(), 12), {
        animate: false,
      });
      return;
    }

    const bounds = L.latLngBounds(points.map(point => [point.lat, point.lon] as [number, number]));
    map.fitBounds(bounds, {
      animate: false,
      padding: [28, 28],
      maxZoom: 12,
    });
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

    map.panTo([markerCoordinate.lat, markerCoordinate.lon], {
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
    if (item.simpleWindSuitability.suitabilityColor === 'green') {
      return {
        colorClass: 'bg-emerald-500',
        ringClass: 'ring-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-700',
      };
    }

    if (item.simpleWindSuitability.suitabilityColor === 'yellow') {
      return {
        colorClass: 'bg-yellow-400',
        ringClass: 'ring-yellow-200',
        badgeClass: 'bg-yellow-100 text-yellow-700',
      };
    }

    if (item.simpleWindSuitability.suitabilityColor === 'orange') {
      return {
        colorClass: 'bg-orange-500',
        ringClass: 'ring-orange-200',
        badgeClass: 'bg-orange-100 text-orange-700',
      };
    }

    return {
      colorClass: 'bg-rose-600',
      ringClass: 'ring-rose-300',
      badgeClass: 'bg-rose-100 text-rose-700',
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
  isHighlighted = false
) => {
  const { colorClass, ringClass } = getRecommendationTone(item, showWindExposureColors);
  const topPickClass = isTopPick ? 'beach-map-top-pick-marker-dot' : '';
  const highlightedClass = isHighlighted ? 'beach-map-active-scroll-marker-dot' : '';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="beach-map-marker-dot ${topPickClass} ${highlightedClass} ${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

const getExposureMarkerTone = (
  exposureLevel?: string,
  showWindExposureColors = true,
  windBeaufort?: number
) => {
  const tones = {
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

  const beaufort = typeof windBeaufort === 'number' ? windBeaufort : 0;
  const isProtected = exposureLevel === 'protected';

  // Each exposure column climbs cleanly through the four tones as wind builds, so
  // the same colour never repeats down a column. Blue means genuinely calm
  // (0-2 Bft, plus protected/partial shores at 3 Bft where only open coasts feel
  // it) — from 4 Bft up even sheltered shores get visible chop.
  const isExposed = exposureLevel === 'exposed';
  if (beaufort >= 7) return tones.red;
  if (beaufort >= 5) return isExposed ? tones.red : tones.orange;
  // At 4 Bft only genuinely exposed shores escalate to orange; protected and the
  // uncertain "partial" middle get a yellow "mild chop" heads-up.
  if (beaufort >= 4) return isExposed ? tones.orange : tones.yellow;
  // At 3 Bft only genuinely exposed coasts feel a real chop (yellow); protected
  // and the uncertain "partial" middle stay calm enough to read as blue — this
  // keeps the "uncertain partial" from looking worse than a sheltered neighbour.
  if (beaufort >= 3) return isExposed ? tones.yellow : tones.blue;
  return tones.blue;
};

const windLegendDotClasses = {
  blue: 'bg-sky-500 ring-sky-200',
  yellow: 'bg-yellow-400 ring-yellow-200',
  orange: 'bg-orange-500 ring-orange-200',
  red: 'bg-rose-600 ring-rose-300',
} as const;

type WindLegendDot = keyof typeof windLegendDotClasses;
type MapExposureEvidence = 'supported' | 'estimated';

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

const getWindSliderTone = (beaufort?: number): typeof windSliderTones[WindLegendDot] => {
  if (typeof beaufort !== 'number') return windSliderTones.blue;
  if (beaufort >= 7) return windSliderTones.red;
  if (beaufort >= 5) return windSliderTones.orange;
  if (beaufort >= 3) return windSliderTones.yellow;
  return windSliderTones.blue;
};

// Custom marker icons based on exposure
const createExposureIcon = (
  exposureLevel?: string,
  showWindExposureColors = true,
  windBeaufort?: number,
  isTopPick = false,
  evidence: MapExposureEvidence = 'estimated',
  isHighlighted = false
) => {
  const topPickClass = isTopPick ? 'beach-map-top-pick-marker-dot' : '';
  const highlightedClass = isHighlighted ? 'beach-map-active-scroll-marker-dot' : '';
  const evidenceClass = evidence === 'supported'
    ? 'beach-map-marker-evidence-supported'
    : 'beach-map-marker-evidence-estimated';

  if (!showWindExposureColors) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="beach-map-marker-dot ${topPickClass} ${highlightedClass} ${evidenceClass} bg-sky-500 w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ring-sky-200"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10]
    });
  }

  const { colorClass, ringClass } = getExposureMarkerTone(exposureLevel, showWindExposureColors, windBeaufort);
  // Non-colour cue: "more exposed" markers get a hollow centre (donut), so the
  // less-/more-exposed split stays legible without relying on hue alone. Only applied at
  // 3-6 Bft, i.e. exactly where the colour actually splits the two groups (at 0-2 all are
  // calm-blue and at 7+ all are red, so a shape split there would over-signal). Mirrored
  // in the legend swatches via the same `beach-map-marker-exposed-core` element.
  const beaufort = typeof windBeaufort === 'number' ? windBeaufort : 0;
  const isMoreExposed = exposureLevel === 'exposed' && beaufort >= 3 && beaufort < 7;
  const exposedClass = isMoreExposed ? 'beach-map-marker-exposed' : '';
  const exposedCore = isMoreExposed ? '<span class="beach-map-marker-exposed-core"></span>' : '';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="beach-map-marker-dot ${topPickClass} ${highlightedClass} ${evidenceClass} ${exposedClass} ${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}">${exposedCore}</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

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
  width: number;
  alpha: number;
  curve: number;
  phase: number;
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
    const px = -dy;
    const py = dx;
    const tone = getWindFlowTone(windBeaufort);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particles: WindParticle[] = [];
    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastTime = performance.now();

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
      particle.length = randomRange(preview ? 34 : 46, preview ? 82 : 112);
      particle.speed = randomRange(22 + beaufort * 7, 40 + beaufort * 11);
      particle.width = randomRange(1.15, beaufort >= 5 ? 2.35 : 1.95);
      particle.alpha = randomRange(0.18, beaufort >= 5 ? 0.46 : 0.38);
      particle.curve = randomRange(-8, 8);
      particle.phase = randomRange(0, Math.PI * 2);
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

    const drawParticle = (particle: WindParticle, time: number) => {
      const tailX = particle.x - dx * particle.length;
      const tailY = particle.y - dy * particle.length;
      const headX = particle.x;
      const headY = particle.y;
      const gradient = context.createLinearGradient(tailX, tailY, headX, headY);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.24, tone.glow);
      gradient.addColorStop(0.68, tone.color);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');

      context.beginPath();
      for (let step = 0; step <= 7; step += 1) {
        const t = step / 7;
        const baseX = tailX + (headX - tailX) * t;
        const baseY = tailY + (headY - tailY) * t;
        const bend = Math.sin(particle.phase + time * 0.0014 + t * Math.PI) * particle.curve * Math.sin(t * Math.PI);
        const x = baseX + px * bend;
        const y = baseY + py * bend;

        if (step === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.globalAlpha = particle.alpha;
      context.strokeStyle = gradient;
      context.lineWidth = particle.width;
      context.lineCap = 'round';
      context.shadowBlur = 8;
      context.shadowColor = tone.glow;
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    };

    const draw = (time: number) => {
      const deltaSeconds = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'source-over';

      particles.forEach(particle => {
        drawParticle(particle, time);

        if (!reducedMotion) {
          const crossDrift = Math.sin(time * 0.00045 + particle.phase) * 2.2;
          particle.x += (dx * particle.speed + px * crossDrift) * deltaSeconds;
          particle.y += (dy * particle.speed + py * crossDrift) * deltaSeconds;

          const margin = Math.max(width, height) * 0.22;
          if (
            particle.x < -margin ||
            particle.x > width + margin ||
            particle.y < -margin ||
            particle.y > height + margin
          ) {
            resetParticle(particle, true);
          }
        }
      });

      if (!reducedMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    resizeCanvas();
    draw(lastTime);

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      if (reducedMotion) draw(performance.now());
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
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
  const tone = getWindTone(windBeaufort);
  const positionClass = compact || preview
    ? 'left-3 top-3'
    : 'left-3 top-[3.75rem] sm:left-4 sm:top-4';
  const copy = getLocalizedCopy(language, {
    en: {
      title: 'Wind flow',
      fromTo: `${fromLabel} to ${toLabel}`,
      from: `From ${fromLabel}`,
      beaufortUnit: 'Bft',
    },
    gr: {
      title: 'Φορά ανέμου',
      fromTo: `Από ${fromLabel} προς ${toLabel}`,
      from: `Από ${fromLabel}`,
      beaufortUnit: 'μποφ.',
    },
    fr: {
      title: 'Flux du vent',
      fromTo: `${fromLabel} vers ${toLabel}`,
      from: `Depuis ${fromLabel}`,
      beaufortUnit: 'Bft',
    },
    de: {
      title: 'Windverlauf',
      fromTo: `${fromLabel} nach ${toLabel}`,
      from: `Von ${fromLabel}`,
      beaufortUnit: 'Bft',
    },
    it: {
      title: 'Flusso del vento',
      fromTo: `Da ${fromLabel} verso ${toLabel}`,
      from: `Da ${fromLabel}`,
      beaufortUnit: 'Bft',
    },
  });
  const title = copy.title;
  const fromTo = copy.fromTo;
  const speed = windSpeedKmh !== undefined
    ? `${windBeaufort ?? '-'} ${copy.beaufortUnit} · ${Math.round(windSpeedKmh)} km/h`
    : copy.from;

  return (
    <div className={`pointer-events-none absolute z-[1000] ${positionClass}`}>
      <div className={`flex items-center gap-1.5 rounded-xl border border-white/75 bg-white/88 p-1.5 shadow-lg shadow-sky-900/12 ring-1 ${tone.ring} backdrop-blur-xl sm:gap-2 sm:rounded-2xl sm:p-2`}>
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
  enableHourSlider = false,
  language = 'en',
  selectedDate,
  compact = false,
  preview = false,
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
  exposureLevelOverrides
}) => {
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const [mapMode, setMapMode] = useState<'recommendation' | 'wind'>('wind');
  // Camping layer: ON by default (per-island counts are small, so it's discoverable, not
  // cluttered); the bottom-left button hides the tent pins for a clean beach-finding map.
  const [showCamping, setShowCamping] = useState(true);
  const [selectedBeachId, setSelectedBeachId] = useState<number | null>(null);
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
  const [smoothSliderIndex, setSmoothSliderIndex] = useState(sliderActiveIndex);
  const [isScrubbingHour, setIsScrubbingHour] = useState(false);
  useEffect(() => {
    if (isScrubbingHour) return;
    setSmoothSliderIndex(sliderActiveIndex);
  }, [isScrubbingHour, sliderActiveIndex, sliderHours.length]);
  const sliderMaxIndex = Math.max(0, sliderHours.length - 1);
  const sliderDisplayIndex = Math.min(sliderMaxIndex, Math.max(0, smoothSliderIndex));
  const sliderFillPct = sliderHours.length > 1 ? (sliderDisplayIndex / sliderMaxIndex) * 100 : 0;
  const sliderDisplayHourItem = sliderHours[Math.round(sliderDisplayIndex)] ?? activeHourItem;
  const sliderDisplayBeaufort = sliderDisplayHourItem
    ? getBeaufortLevel(sliderDisplayHourItem.wind.speed * 3.6)
    : undefined;
  const sliderTone = getWindSliderTone(sliderDisplayBeaufort);
  const sliderThumbStyle: React.CSSProperties & Record<string, string> = {
    '--beach-map-hour-slider-thumb': sliderTone.color,
    '--beach-map-hour-slider-shadow': sliderTone.shadow,
    '--beach-map-hour-slider-focus': sliderTone.focus,
  };
  const commitSliderIndex = (index: number) => {
    const clampedIndex = Math.min(sliderMaxIndex, Math.max(0, index));
    setSmoothSliderIndex(clampedIndex);
    const slot = sliderHours[Math.round(clampedIndex)];
    if (slot && slot.dt !== activeHourItem?.dt) onHourChange?.(slot.dt);
  };
  const hourSliderCopy: Record<LanguageCode, string> = {
    en: 'Wind by hour',
    gr: 'Άνεμος ανά ώρα',
    de: 'Wind je Stunde',
    it: 'Vento per ora',
    fr: 'Vent par heure',
  };
  const hourSliderLabel = hourSliderCopy[language];
  const hourSliderHelper: Record<LanguageCode, string> = {
    en: 'Drag the hours to update the map and beach recommendations.',
    gr: 'Σύρε τις ώρες για να αλλάξουν ο χάρτης και οι προτεινόμενες παραλίες.',
    de: 'Ziehe die Stunden, um Karte und Strandempfehlungen zu aktualisieren.',
    it: 'Scorri le ore per aggiornare mappa e spiagge consigliate.',
    fr: 'Faites glisser les heures pour mettre à jour la carte et les plages recommandées.',
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
  const selectedDayPrefix = getSelectedDayPrefix(selectedDate, new Date(), language);
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
    campingToggle: { en: 'Camping', gr: 'Camping', de: 'Camping', it: 'Campeggi', fr: 'Camping' },
    bestTime: { en: 'Best Time', gr: 'Καλύτερη ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    view: { en: 'View', gr: 'Προβολή', de: 'Ansehen', it: 'Vedi', fr: 'Voir' },
    navigate: { en: 'Navigate', gr: 'Πλοήγηση', de: 'Route', it: 'Naviga', fr: 'Itinéraire' },
    closeDetails: { en: 'Close beach details', gr: 'Κλείσιμο λεπτομερειών παραλίας', de: 'Stranddetails schließen', it: 'Chiudi dettagli spiaggia', fr: 'Fermer les détails de la plage' },
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
  const windColorGuideCopy = getLocalizedCopy<{
    rows: Array<{
      id: string;
      range: string;
      segments: Array<{
        label: string;
        dot: WindLegendDot;
        colorLabel: string;
        /** Render a danger triangle instead of the colour dot (near-gale "unsuitable" row). */
        alert?: boolean;
      }>;
    }>;
  }>(language, {
    en: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Excellent', dot: 'blue', colorLabel: 'blue' }] },
        { id: '3', range: '3 Bft', segments: [{ label: 'Excellent', dot: 'blue', colorLabel: 'blue' }, { label: 'Good', dot: 'yellow', colorLabel: 'yellow' }] },
        { id: '4', range: '4 Bft', segments: [{ label: 'Good', dot: 'yellow', colorLabel: 'yellow' }, { label: 'Fair', dot: 'orange', colorLabel: 'orange' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Fair', dot: 'orange', colorLabel: 'orange' }, { label: 'Difficult', dot: 'red', colorLabel: 'red' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Unsuitable', dot: 'red', colorLabel: 'danger', alert: true }] },
      ],
    },
    gr: {
      rows: [
        { id: '0-2', range: '0-2 Μποφόρ', segments: [{ label: 'Ιδανική', dot: 'blue', colorLabel: 'μπλε' }] },
        { id: '3', range: '3 Μποφόρ', segments: [{ label: 'Ιδανική', dot: 'blue', colorLabel: 'μπλε' }, { label: 'Καλή', dot: 'yellow', colorLabel: 'κίτρινο' }] },
        { id: '4', range: '4 Μποφόρ', segments: [{ label: 'Καλή', dot: 'yellow', colorLabel: 'κίτρινο' }, { label: 'Μέτρια', dot: 'orange', colorLabel: 'πορτοκαλί' }] },
        { id: '5-6', range: '5-6 Μποφόρ', segments: [{ label: 'Μέτρια', dot: 'orange', colorLabel: 'πορτοκαλί' }, { label: 'Δύσκολη', dot: 'red', colorLabel: 'κόκκινο' }] },
        { id: '7-10', range: '7-10 Μποφόρ', segments: [{ label: 'Ακατάλληλη', dot: 'red', colorLabel: 'κίνδυνος', alert: true }] },
      ],
    },
    fr: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Idéale', dot: 'blue', colorLabel: 'bleu' }] },
        { id: '3', range: '3 Bft', segments: [{ label: 'Idéale', dot: 'blue', colorLabel: 'bleu' }, { label: 'Bonne', dot: 'yellow', colorLabel: 'jaune' }] },
        { id: '4', range: '4 Bft', segments: [{ label: 'Bonne', dot: 'yellow', colorLabel: 'jaune' }, { label: 'Correcte', dot: 'orange', colorLabel: 'orange' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Correcte', dot: 'orange', colorLabel: 'orange' }, { label: 'Difficile', dot: 'red', colorLabel: 'rouge' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Déconseillée', dot: 'red', colorLabel: 'danger', alert: true }] },
      ],
    },
    de: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Ideal', dot: 'blue', colorLabel: 'blau' }] },
        { id: '3', range: '3 Bft', segments: [{ label: 'Ideal', dot: 'blue', colorLabel: 'blau' }, { label: 'Gut', dot: 'yellow', colorLabel: 'gelb' }] },
        { id: '4', range: '4 Bft', segments: [{ label: 'Gut', dot: 'yellow', colorLabel: 'gelb' }, { label: 'Mäßig', dot: 'orange', colorLabel: 'orange' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Mäßig', dot: 'orange', colorLabel: 'orange' }, { label: 'Schwierig', dot: 'red', colorLabel: 'rot' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Ungeeignet', dot: 'red', colorLabel: 'danger', alert: true }] },
      ],
    },
    it: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Ideale', dot: 'blue', colorLabel: 'blu' }] },
        { id: '3', range: '3 Bft', segments: [{ label: 'Ideale', dot: 'blue', colorLabel: 'blu' }, { label: 'Buona', dot: 'yellow', colorLabel: 'giallo' }] },
        { id: '4', range: '4 Bft', segments: [{ label: 'Buona', dot: 'yellow', colorLabel: 'giallo' }, { label: 'Discreta', dot: 'orange', colorLabel: 'arancione' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Discreta', dot: 'orange', colorLabel: 'arancione' }, { label: 'Difficile', dot: 'red', colorLabel: 'rosso' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Non adatta', dot: 'red', colorLabel: 'danger', alert: true }] },
      ],
    },
  });

  // Campsites near the beaches on this map, deduped by id. The detail map passes an
  // explicit `campsites` list (always shown); the overview map derives them from the
  // beaches' nearbyCamping and gates them behind the showCamping toggle.
  const derivedCampsites = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; lat: number; lon: number }>();
    for (const item of beaches) {
      const list = item.beach?.nearbyCamping ?? item.beach?.metadata?.nearbyCamping ?? [];
      for (const c of list) {
        if (!seen.has(c.id)) seen.set(c.id, { id: c.id, name: c.name, lat: c.coordinates.lat, lon: c.coordinates.lon });
      }
    }
    return [...seen.values()];
  }, [beaches]);
  // Show on the browse maps (incl. the compact island map), but never on previews or the
  // detail map (which passes its own `campsites` and always shows them).
  const hasCampingToggle = !preview && !campsites && derivedCampsites.length > 0;
  const renderedCampsites = campsites ?? (showCamping ? derivedCampsites : []);

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
  const hoverPreviewCopy = getLocalizedCopy(language, {
    en: { photosSoon: 'Photos soon' },
    gr: { photosSoon: 'Photos soon' },
    de: { photosSoon: 'Photos soon' },
    it: { photosSoon: 'Photos soon' },
    fr: { photosSoon: 'Photos soon' },
  });
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
    const exposureTone = getExposureMarkerTone(exposureLevel, showWindExposureColors, windBeaufort);
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

  // Legend key swatches follow the same Beaufort bands as the markers.
  const protectedTone = getExposureMarkerTone('protected', showWindExposureColors, windBeaufort);
  const exposedTone = getExposureMarkerTone('exposed', showWindExposureColors, windBeaufort);
  const currentWindColorGuideId = typeof windBeaufort === 'number'
    ? windBeaufort >= 7
      ? '7-10'
      : windBeaufort >= 5
        ? '5-6'
        : windBeaufort >= 4
          ? '4'
          : windBeaufort >= 3
            ? '3'
            : '0-2'
    : '0-2';
  const currentWindColorGuideRows = windColorGuideCopy.rows.filter(row => row.id === currentWindColorGuideId);
  const visibleWindColorGuideRows = currentWindColorGuideRows.length > 0
    ? currentWindColorGuideRows
    : windColorGuideCopy.rows.slice(0, 1);
  const showGroupedExposureLegend = showWindExposureStatusLabels && currentWindColorGuideId !== '7-10';
  // The hollow-centre (donut) shape cue on the "more exposed" swatch only reads as a
  // distinction where the two groups actually differ in colour (3-6 Bft). At 0-2 both are
  // calm-blue, so the shape would imply a split that isn't there. Mirrors createExposureIcon.
  const showExposedShapeCue = currentWindColorGuideId === '3'
    || currentWindColorGuideId === '4'
    || currentWindColorGuideId === '5-6';

  const renderWindColorGuideRows = (variant: 'full' | 'preview') => {
    const isPreview = variant === 'preview';

    return (
      <div
        className={`${isPreview ? 'grid gap-1 sm:grid-cols-2' : 'grid gap-1 rounded-lg bg-slate-50/80 p-2 dark:bg-slate-800/60'}`}
      >
        {visibleWindColorGuideRows.map(row => (
          <div
            key={row.id}
            className={`${isPreview ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'} flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 font-semibold leading-snug text-slate-600 dark:text-slate-300`}
          >
            <span className="shrink-0 font-extrabold text-slate-700 dark:text-slate-200">{row.range}</span>
            <span className="shrink-0 text-slate-600">-</span>
            <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              {row.segments.map((segment, index) => (
                <React.Fragment key={`${row.id}-${segment.label}-${segment.dot}`}>
                  {index > 0 && <span className="shrink-0 text-slate-600">/</span>}
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="min-w-0">{segment.label}</span>
                    {segment.alert ? (
                      <AlertTriangle
                        aria-label={segment.colorLabel}
                        role="img"
                        className="h-3.5 w-3.5 shrink-0 fill-rose-600 text-white"
                      />
                    ) : (
                      <span
                        aria-label={segment.colorLabel}
                        title={segment.colorLabel}
                        role="img"
                        className={`relative h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${windLegendDotClasses[segment.dot]}`}
                      >
                        {row.segments.length > 1 && index === row.segments.length - 1 && (
                          <span className="beach-map-marker-exposed-core" aria-hidden="true" />
                        )}
                      </span>
                    )}
                  </span>
                </React.Fragment>
              ))}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderWindColorGuidePanel = (variant: 'full' | 'preview') => {
    const isPreview = variant === 'preview';

    return (
      <div className={`${isPreview ? 'max-w-full space-y-1.5' : 'space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700'}`}>
        {renderWindColorGuideRows(variant)}
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
                    <div className={`relative h-3 w-3 rounded-full ring-2 ${exposedTone.colorClass} ${exposedTone.ringClass}`}>
                      {showExposedShapeCue && <span className="beach-map-marker-exposed-core" aria-hidden="true" />}
                    </div>
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
                <span className={`relative h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${exposedTone.colorClass} ${exposedTone.ringClass}`}>
                  {showExposedShapeCue && <span className="beach-map-marker-exposed-core" aria-hidden="true" />}
                </span>
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
        {/* Camping layer toggle (overview map only) — left side, below the mode toggle on mobile */}
        {hasCampingToggle && (
          <button
            type="button"
            onClick={() => setShowCamping((v) => !v)}
            aria-label={`${mapCopy.campingToggle[language]}${showCamping ? ' ✓' : ''}`}
            title={mapCopy.campingToggle[language]}
            // Bottom-left: free on the browse map (wind legend is top-left, zoom top-right,
            // the exposure legend is desktop-full-map only, and the hour slider docks below).
            className={`absolute bottom-3 left-3 z-[1000] inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-lg backdrop-blur-xl transition-colors sm:bottom-4 sm:left-4 ${showCamping ? 'border-emerald-300 bg-emerald-600 text-white' : 'border-white/60 bg-white/85 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200'}`}
          >
            <Tent className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {mapCopy.campingToggle[language]}
          </button>
        )}

        {/* Map Mode Toggle */}
        {!compact && !preview && (
        <div className="absolute left-3 right-3 top-3 z-[1000] flex overflow-hidden rounded-full border border-white/60 bg-white/80 p-1 shadow-lg shadow-sky-900/10 backdrop-blur-xl sm:left-auto sm:right-4 sm:rounded-xl sm:border-slate-200 sm:p-0 dark:border-slate-700 dark:bg-slate-900/85">
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
          <ZoomControl position={preview || compact ? 'topright' : 'bottomright'} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ load: () => setTilesReady(true) }}
          />

          <MapAutoResize />
          <RecenterMap center={center} zoom={zoom} />
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
          <HighlightedBeachFollower
            beaches={beaches}
            center={center}
            highlightedBeachId={highlightedBeachId}
            enabled={followHighlightedBeach}
          />
          <VisibleBeachTracker beaches={beaches} center={center} onVisibleBeachIdsChange={onVisibleBeachIdsChange} />
          <MapUserInteractionTracker onUserInteraction={onUserInteraction} />
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
          {shouldRenderBeachMarkers && beaches.map((item) => {
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

            return (
            <Marker
              key={`${item.beachId}-${mapMode}-${mapExposureLevel}-${isTopPickMarker ? 'top' : 'base'}-${isHighlightedMarker ? 'active' : 'idle'}`}
              position={[markerCoordinate.lat, markerCoordinate.lon]}
              zIndexOffset={isHighlightedMarker ? 1000 : isTopPickMarker ? 700 : 0}
              icon={mapMode === 'recommendation'
                ? createBeachIcon(item, showRecommendationWindColors, isTopPickMarker, isHighlightedMarker)
                : createExposureIcon(mapExposureLevel, showWindExposureColors, windBeaufort, isTopPickMarker, mapExposureEvidence, isHighlightedMarker)}
              eventHandlers={{
                click: () => {
                  trackEvent('map_marker_clicked', item.beachId, {
                    locale: languageToLocale(language),
                    source: compact ? 'detail_map' : preview ? 'home_map_preview' : 'full_map',
                    map_mode: mapMode,
                    beach_name: item.beach.name.en,
                  });
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

        <div className="pointer-events-auto absolute bottom-1.5 right-1.5 z-[900] rounded bg-white/70 px-1.5 py-0.5 text-[8px] font-medium leading-none text-slate-600 shadow-sm shadow-sky-900/5 backdrop-blur-sm dark:bg-slate-900/70 dark:text-slate-300">
          <a
            href="https://leafletjs.com"
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            Leaflet
          </a>
          <span> | © </span>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            OpenStreetMap contributors
          </a>
        </div>

        {hoveredBeach && hoverPreviewPosition && (
          <BeachHoverPreviewCard
            item={hoveredBeach}
            position={hoverPreviewPosition}
            mapViewportRef={mapViewportRef}
            language={language}
            photoUrl={hoverPreviewPhotoUrl}
            photosSoonLabel={hoverPreviewCopy.photosSoon}
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

        <WindDirectionGraphic
          windDirection={windDirection}
          windDirectionDeg={mapWindDirectionDeg}
          windSpeedKmh={windSpeedKmh}
          windBeaufort={windBeaufort}
          language={language}
          compact={compact}
          preview={preview}
        />

        {selectedBeach && (
          <div className="absolute inset-x-2 bottom-2 z-[1000] max-h-[76%] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-3 shadow-xl shadow-slate-900/20 backdrop-blur-md sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[min(360px,calc(100%-2rem))]">
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
        <div className="absolute bottom-4 left-4 z-[1000] hidden max-w-none rounded-xl border border-slate-200 bg-white/85 p-3 text-xs shadow-lg shadow-sky-900/10 backdrop-blur-xl sm:block dark:border-slate-700 dark:bg-slate-900/90">
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
          <span className="shrink-0 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">{hourSliderLabel}</span>
          <div className="relative flex min-w-0 flex-1 items-center">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${sliderFillPct}%`, backgroundColor: sliderTone.color }}
            />
            <input
              type="range"
              min={0}
              max={sliderMaxIndex}
              step={0.01}
              value={sliderDisplayIndex}
              onPointerDown={() => setIsScrubbingHour(true)}
              onTouchStart={() => setIsScrubbingHour(true)}
              onChange={event => {
                commitSliderIndex(Number(event.target.value));
              }}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1;
                commitSliderIndex(sliderActiveIndex + direction);
              }}
              onPointerUp={() => {
                commitSliderIndex(Math.round(sliderDisplayIndex));
                setIsScrubbingHour(false);
              }}
              onPointerCancel={() => setIsScrubbingHour(false)}
              onTouchEnd={() => {
                commitSliderIndex(Math.round(sliderDisplayIndex));
                setIsScrubbingHour(false);
              }}
              onTouchCancel={() => setIsScrubbingHour(false)}
              onBlur={() => {
                commitSliderIndex(Math.round(sliderDisplayIndex));
                setIsScrubbingHour(false);
              }}
              aria-label={hourSliderLabel}
              style={sliderThumbStyle}
              className="beach-map-hour-slider relative z-10 h-10 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent sm:h-11"
            />
          </div>
          <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-[#007a83]">
            {formatSliderHour(activeHourItem.dt)} · {getBeaufortLevel(activeHourItem.wind.speed * 3.6)} {beaufortUnitLabel}
          </span>
          <p className="hidden basis-full text-[11px] font-bold leading-snug text-slate-700 sm:block dark:text-slate-600">
            {hourSliderHelper[language]}
          </p>
        </div>
      )}

      {isCompactPreview && mapMode === 'wind' && (
        <div className="mt-0 rounded-xl border border-sky-100 bg-white/90 px-2 py-1 text-left shadow-sm shadow-sky-900/8 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
          {renderWindColorGuidePanel('preview')}
        </div>
      )}

      {!compact && preview && (
        <div className="border-t border-slate-200/80 bg-white/90 px-3 py-2 shadow-inner shadow-sky-900/5 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
          {renderPreviewLegend()}
        </div>
      )}

      {/* Mobile Legend */}
      {!compact && !preview && (
      <div className="border-t border-slate-200 bg-white/88 p-3 text-[11px] shadow-inner shadow-sky-900/5 backdrop-blur-xl sm:hidden dark:border-slate-700 dark:bg-slate-900/90">
        {renderLegend()}
      </div>
      )}
    </div>
  );
};

export default BeachMap;
