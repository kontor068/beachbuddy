import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Clock, Wind, X } from 'lucide-react';
import { SuitableBeach, Beach, LanguageCode } from '../types';
import { trackEvent } from '../services/analyticsService';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';
import { getBeachMapCoordinates } from '../utils/mapCoordinates';
import { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel } from '../utils/mapExposure';

interface BeachMapProps {
  beaches: SuitableBeach[];
  userLocation?: { lat: number; lon: number };
  onBeachClick?: (beach: Beach) => void;
  onVisibleBeachIdsChange?: (beachIds: number[]) => void;
  center?: [number, number];
  zoom?: number;
  windSpeed?: number;
  windDirection?: string;
  windDirectionDeg?: number;
  language?: LanguageCode;
  selectedDate?: Date;
  compact?: boolean;
  preview?: boolean;
  topBeachId?: number;
}

const visibleExposureLevel = (
  item: Pick<SuitableBeach, 'exposureLevel' | 'canClaimWindProtection'>
) => item.exposureLevel === 'protected' && item.canClaimWindProtection !== true
  ? 'partial'
  : item.exposureLevel;

// Component to update map center when user location changes
const RecenterMap = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  const [lat, lon] = center;

  useEffect(() => {
    map.setView(center, zoom);
  }, [lat, lon, zoom, map]);

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
  item: Pick<SuitableBeach, 'score' | 'exposureLevel' | 'canClaimWindProtection'>,
  showWindExposureColors = true
) => {
  const exposureLevel = visibleExposureLevel(item);

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
  item: Pick<SuitableBeach, 'score' | 'exposureLevel' | 'canClaimWindProtection'>,
  showWindExposureColors = true,
  isTopPick = false
) => {
  const { colorClass, ringClass } = getRecommendationTone(item, showWindExposureColors);
  const topPickClass = isTopPick ? 'beach-map-top-pick-marker-dot' : '';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="beach-map-marker-dot ${topPickClass} ${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}"></div>`,
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

  if (beaufort >= 7) return tones.red;
  if (beaufort >= 5) return isProtected ? tones.yellow : tones.orange;
  if (beaufort >= 3) return isProtected ? tones.blue : tones.yellow;

  return tones.blue;
};

const windLegendDotClasses = {
  blue: 'bg-sky-500 ring-sky-200',
  yellow: 'bg-yellow-400 ring-yellow-200',
  orange: 'bg-orange-500 ring-orange-200',
  red: 'bg-rose-600 ring-rose-300',
} as const;

type WindLegendDot = keyof typeof windLegendDotClasses;

// Custom marker icons based on exposure
const createExposureIcon = (exposureLevel?: string, showWindExposureColors = true, windBeaufort?: number, isTopPick = false) => {
  const topPickClass = isTopPick ? 'beach-map-top-pick-marker-dot' : '';

  if (!showWindExposureColors) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="beach-map-marker-dot ${topPickClass} bg-sky-500 w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ring-sky-200"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -10]
    });
  }

  const { colorClass, ringClass } = getExposureMarkerTone(exposureLevel, showWindExposureColors, windBeaufort);

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="beach-map-marker-dot ${topPickClass} ${colorClass} w-4 h-4 rounded-full border-2 border-white shadow-lg ring-4 ${ringClass}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10]
  });
};

const UserLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div class="beach-map-marker-dot beach-map-user-marker-dot bg-blue-500 w-5 h-5 rounded-full border-2 border-white shadow-xl ring-4 ring-blue-200 animate-pulse"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
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
      subtext: 'text-slate-500',
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
    subtext: 'text-slate-500',
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
          <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[7px] font-black leading-none text-slate-400 sm:top-1 sm:text-[9px]">{compass.n}</span>
          <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] font-black leading-none text-slate-400 sm:right-1 sm:text-[9px]">{compass.e}</span>
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-black leading-none text-slate-400 sm:bottom-1 sm:text-[9px]">{compass.s}</span>
          <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[7px] font-black leading-none text-slate-400 sm:left-1 sm:text-[9px]">{compass.w}</span>
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
  onBeachClick,
  onVisibleBeachIdsChange,
  center: propCenter,
  zoom: propZoom,
  windSpeed,
  windDirection,
  windDirectionDeg,
  language = 'en',
  selectedDate,
  compact = false,
  preview = false,
  topBeachId
}) => {
  const [mapMode, setMapMode] = useState<'recommendation' | 'wind'>('wind');
  const [selectedBeachId, setSelectedBeachId] = useState<number | null>(null);
  const [beachLabelOpacity, setBeachLabelOpacity] = useState(0);
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
  const showWindExposureColors = windBeaufort !== undefined && windBeaufort >= 3;
  const showRecommendationWindColors = windBeaufort === undefined || windBeaufort >= 4;
  const visibleMapExposureLevels = useMemo(
    () => getConsistentVisibleMapExposureLevels(beaches, windBeaufort, mapWindDirectionDeg),
    [beaches, mapWindDirectionDeg, windBeaufort]
  );
  const getMapExposureLevel = (item: SuitableBeach) => (
    visibleMapExposureLevels.get(item.beach.id) || getVisibleMapExposureLevel(item, windBeaufort, mapWindDirectionDeg)
  );
  const selectedDayPrefix = getSelectedDayPrefix(selectedDate, new Date(), language);
  const exposureLabel = (exposureLevel?: string) => {
    const labels = {
      protected: {
        en: `Less exposed ${selectedDayPrefix}`,
        gr: `Λιγότερο εκτεθειμένη ${selectedDayPrefix}`,
        de: `Weniger exponiert ${selectedDayPrefix}`,
        it: `Meno esposta ${selectedDayPrefix}`,
        fr: `Moins exposée ${selectedDayPrefix}`,
      },
      partial: {
        en: { strong: 'Partly exposed', mild: 'Some wind' },
        gr: { strong: 'Μερική έκθεση στον άνεμο', mild: 'Λίγος αέρας' },
        de: { strong: 'Teilweise exponiert', mild: 'Etwas Wind' },
        it: { strong: 'Parzialmente esposta', mild: 'Un po’ di vento' },
        fr: { strong: 'Partiellement exposée', mild: 'Un peu de vent' },
      },
      exposed: {
        en: { strong: 'Exposed to wind', mild: 'Open to wind' },
        gr: { strong: 'Εκτεθειμένη στον άνεμο', mild: 'Ανοιχτή στον άνεμο' },
        de: { strong: 'Windexponiert', mild: 'Offen zum Wind' },
        it: { strong: 'Esposta al vento', mild: 'Aperta al vento' },
        fr: { strong: 'Exposée au vent', mild: 'Ouverte au vent' },
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
        en: 'Less exposed',
        gr: 'Λιγότερη έκθεση',
        de: 'Weniger exponiert',
        it: 'Meno esposta',
        fr: 'Moins exposee',
      },
      exposed: {
        en: 'More exposed',
        gr: 'Πιο εκτεθειμένες',
        de: 'Starker exponiert',
        it: 'Piu esposte',
        fr: 'Plus exposees',
      },
    };

    return labels[exposureLevel][language];
  };
  const mapCopy = {
    recommendationMode: { en: 'Recommendation Mode', gr: 'Προτάσεις', de: 'Empfehlungen', it: 'Consigli', fr: 'Recommandations' },
    recommendationShort: { en: 'Best', gr: 'Προτάσεις', de: 'Top', it: 'Top', fr: 'Top' },
    windMode: { en: 'Wind Protection Mode', gr: 'Προστασία από άνεμο', de: 'Windschutz', it: 'Protezione dal vento', fr: 'Protection du vent' },
    windShort: { en: 'Wind', gr: 'Άνεμος', de: 'Wind', it: 'Vento', fr: 'Vent' },
    youAreHere: { en: 'You are here', gr: 'Είστε εδώ', de: 'Sie sind hier', it: 'Sei qui', fr: 'Vous etes ici' },
    bestTime: { en: 'Best Time', gr: 'Καλύτερη ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    view: { en: 'View', gr: 'Προβολή', de: 'Ansehen', it: 'Vedi', fr: 'Voir' },
    closeDetails: { en: 'Close beach details', gr: 'Κλείσιμο λεπτομερειών παραλίας', de: 'Stranddetails schliessen', it: 'Chiudi dettagli spiaggia', fr: 'Fermer les details de la plage' },
    suitability: {
      en: `Recommendation ${selectedDayPrefix}`,
      gr: `Πρόταση για ${selectedDayPrefix}`,
      de: 'Empfehlung',
      it: 'Consiglio',
      fr: 'Recommendation',
    },
    excellent: { en: 'Less exposed + high score', gr: 'Λιγότερη έκθεση + υψηλό σκορ', de: 'Besserer Schutz + hoher Wert', it: 'Piu riparata + punteggio alto', fr: 'Mieux abritee + score eleve' },
    good: { en: 'Partial or good fallback', gr: 'Μερική ή εναλλακτική επιλογή', de: 'Teilweise oder Alternative', it: 'Parziale o alternativa', fr: 'Partielle ou alternative' },
    notRecommended: { en: 'Open to wind or low score', gr: 'Ανοιχτή στον άνεμο ή χαμηλό σκορ', de: 'Windoffen oder niedriger Wert', it: 'Esposta o punteggio basso', fr: 'Exposée ou score bas' },
    exposure: { en: 'Wind Exposure', gr: 'Έκθεση στον άνεμο', de: 'Windexposition', it: 'Esposizione al vento', fr: 'Exposition au vent' },
    excellentCalm: {
      en: `High score ${selectedDayPrefix}`,
      gr: `Υψηλό σκορ ${selectedDayPrefix}`,
      de: 'Hoher Wert',
      it: 'Punteggio alto',
      fr: 'Score eleve',
    },
    calmWind: {
      en: `Light wind ${selectedDayPrefix}`,
      gr: `Ήπιος άνεμος ${selectedDayPrefix}`,
      de: 'Leichter Wind',
      it: 'Vento leggero',
      fr: 'Vent leger',
    },
    calmWindNote: { en: 'Wind exposure is not a major factor right now', gr: 'Η έκθεση στον άνεμο δεν επηρεάζει σημαντικά τώρα', de: 'Windexposition ist gerade kein wichtiger Faktor', it: 'L esposizione al vento ora conta poco', fr: 'L exposition au vent compte peu maintenant' },
    current: { en: 'Current', gr: 'Τώρα', de: 'Aktuell', it: 'Ora', fr: 'Actuel' },
    at: { en: 'at', gr: 'στα', de: 'bei', it: 'a', fr: 'a' },
    beaufort: { en: 'Bft', gr: 'μποφόρ', de: 'Bft', it: 'Bft', fr: 'Bft' },
  };
  const windColorGuideCopy = getLocalizedCopy<{
    rows: Array<{
      id: string;
      range: string;
      segments: Array<{
        label: string;
        dot: WindLegendDot;
        colorLabel: string;
      }>;
    }>;
  }>(language, {
    en: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'All beaches', dot: 'blue', colorLabel: 'blue' }] },
        { id: '3-4', range: '3-4 Bft', segments: [{ label: 'Protected', dot: 'blue', colorLabel: 'blue' }, { label: 'Exposed', dot: 'yellow', colorLabel: 'yellow' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Protected', dot: 'yellow', colorLabel: 'yellow' }, { label: 'Exposed', dot: 'orange', colorLabel: 'orange' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'All beaches', dot: 'red', colorLabel: 'red' }] },
      ],
    },
    gr: {
      rows: [
        { id: '0-2', range: '0-2 Μποφόρ', segments: [{ label: 'Όλες', dot: 'blue', colorLabel: 'μπλε' }] },
        { id: '3-4', range: '3-4 Μποφόρ', segments: [{ label: 'Προστατευμένη', dot: 'blue', colorLabel: 'μπλε' }, { label: 'Εκτεθειμένη', dot: 'yellow', colorLabel: 'κίτρινο' }] },
        { id: '5-6', range: '5-6 Μποφόρ', segments: [{ label: 'Προστατευμένη', dot: 'yellow', colorLabel: 'κίτρινο' }, { label: 'Εκτεθειμένη', dot: 'orange', colorLabel: 'πορτοκαλί' }] },
        { id: '7-10', range: '7-10 Μποφόρ', segments: [{ label: 'Όλες', dot: 'red', colorLabel: 'κόκκινο' }] },
      ],
    },
    fr: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Toutes', dot: 'blue', colorLabel: 'bleu' }] },
        { id: '3-4', range: '3-4 Bft', segments: [{ label: 'Protégée', dot: 'blue', colorLabel: 'bleu' }, { label: 'Exposée', dot: 'yellow', colorLabel: 'jaune' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Protégée', dot: 'yellow', colorLabel: 'jaune' }, { label: 'Exposée', dot: 'orange', colorLabel: 'orange' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Toutes', dot: 'red', colorLabel: 'rouge' }] },
      ],
    },
    de: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Alle', dot: 'blue', colorLabel: 'blau' }] },
        { id: '3-4', range: '3-4 Bft', segments: [{ label: 'Geschützt', dot: 'blue', colorLabel: 'blau' }, { label: 'Exponiert', dot: 'yellow', colorLabel: 'gelb' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Geschützt', dot: 'yellow', colorLabel: 'gelb' }, { label: 'Exponiert', dot: 'orange', colorLabel: 'orange' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Alle', dot: 'red', colorLabel: 'rot' }] },
      ],
    },
    it: {
      rows: [
        { id: '0-2', range: '0-2 Bft', segments: [{ label: 'Tutte', dot: 'blue', colorLabel: 'blu' }] },
        { id: '3-4', range: '3-4 Bft', segments: [{ label: 'Protetta', dot: 'blue', colorLabel: 'blu' }, { label: 'Esposta', dot: 'yellow', colorLabel: 'giallo' }] },
        { id: '5-6', range: '5-6 Bft', segments: [{ label: 'Protetta', dot: 'yellow', colorLabel: 'giallo' }, { label: 'Esposta', dot: 'orange', colorLabel: 'arancione' }] },
        { id: '7-10', range: '7-10 Bft', segments: [{ label: 'Tutte', dot: 'red', colorLabel: 'rosso' }] },
      ],
    },
  });

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
  const labelZoomThreshold = compact ? 13 : 12;
  const selectedBeach = selectedBeachId !== null
    ? beaches.find(item => item.beachId === selectedBeachId)
    : null;
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

  const renderBeachInfo = (item: SuitableBeach, variant: 'popup' | 'panel') => {
    const isPanel = variant === 'panel';
    const exposureLevel = mapMode === 'wind'
      ? getMapExposureLevel(item)
      : visibleExposureLevel(item);
    const displayExposureLevel = mapMode === 'wind' && exposureLevel !== 'protected'
      ? 'exposed'
      : exposureLevel;
    const exposureTone = getExposureMarkerTone(displayExposureLevel, showWindExposureColors, windBeaufort);
    const badge = mapMode === 'recommendation' ? (
      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${getRecommendationTone(item, showRecommendationWindColors).badgeClass}`}>
        {item.score}%
      </span>
    ) : (
        <span className={`inline-flex min-w-0 shrink items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${exposureTone.bgClass} ${exposureTone.textClass}`}>
        <Wind className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {showWindExposureColors ? exposureLabel(displayExposureLevel) : mapCopy.calmWind[language]}
        </span>
      </span>
    );

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

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          {item.distance !== undefined ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{item.distance.toFixed(1)} km</span>
            </span>
          ) : (
            <span />
          )}

          {onBeachClick && (
            <button
              type="button"
              onClick={() => onBeachClick(item.beach)}
              className={`${isPanel ? 'min-h-10 px-3' : 'px-2 py-1'} inline-flex items-center justify-center gap-1 rounded-xl bg-cyan-600 text-xs font-black text-white transition-colors hover:bg-cyan-700 cursor-pointer`}
            >
              {mapCopy.view[language]}
              <Navigation className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const protectedTone = getExposureMarkerTone('protected', showWindExposureColors, windBeaufort);
  const exposedTone = getExposureMarkerTone('exposed', showWindExposureColors, windBeaufort);
  const currentWindColorGuideId = typeof windBeaufort === 'number'
    ? windBeaufort >= 7
      ? '7-10'
      : windBeaufort >= 5
        ? '5-6'
        : windBeaufort >= 3
          ? '3-4'
          : '0-2'
    : '0-2';
  const currentWindColorGuideRows = windColorGuideCopy.rows.filter(row => row.id === currentWindColorGuideId);
  const visibleWindColorGuideRows = currentWindColorGuideRows.length > 0
    ? currentWindColorGuideRows
    : windColorGuideCopy.rows.slice(0, 1);

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
            <span className="shrink-0 text-slate-400">-</span>
            <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              {row.segments.map((segment, index) => (
                <React.Fragment key={`${row.id}-${segment.label}-${segment.dot}`}>
                  {index > 0 && <span className="shrink-0 text-slate-400">/</span>}
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="min-w-0">{segment.label}</span>
                    <span
                      aria-label={segment.colorLabel}
                      title={segment.colorLabel}
                      role="img"
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${windLegendDotClasses[segment.dot]}`}
                    />
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
      <div className={`${isPreview ? 'max-w-full' : 'border-t border-slate-200 pt-2 dark:border-slate-700'}`}>
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
            {showWindExposureColors ? mapCopy.exposure[language] : mapCopy.calmWind[language]}
          </h4>
          {windSpeedKmh !== undefined && windDirection && (
            <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-slate-500 sm:mb-2 sm:pb-2 dark:border-slate-700 dark:text-slate-400">
              {mapCopy.current[language]}: {localizedWindDirection} {mapCopy.at[language]} {Math.round(windSpeedKmh)} km/h
              {windBeaufort !== undefined ? ` (${windBeaufort} ${mapCopy.beaufort[language]})` : ''}
            </div>
          )}
          {showWindExposureColors ? (
            <div className="space-y-2">
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
          <span className="truncate">{showWindExposureColors ? mapCopy.exposure[language] : mapCopy.calmWind[language]}</span>
        </h4>
        {windSpeedKmh !== undefined && windDirection && (
          <span className="shrink-0 text-[10px] font-semibold leading-tight text-slate-500 dark:text-slate-400">
            {localizedWindDirection} {Math.round(windSpeedKmh)} km/h
            {windBeaufort !== undefined ? ` · ${windBeaufort} ${mapCopy.beaufort[language]}` : ''}
          </span>
        )}
      </div>
      {showWindExposureColors ? (
        <div className="space-y-2">
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
      <div className={`relative ${
        isCompactPreview
          ? 'h-[19rem] overflow-hidden rounded-[1.1rem] border border-sky-100 sm:h-[26rem] lg:h-[32rem]'
          : compact
            ? 'h-full'
            : preview
              ? 'h-[195px] sm:h-[420px]'
              : 'h-[360px] sm:h-[500px]'
      }`}>
        {/* Map Mode Toggle */}
        {!compact && !preview && (
        <div className="absolute left-3 right-3 top-3 z-[1000] flex overflow-hidden rounded-full border border-white/60 bg-white/80 p-1 shadow-lg shadow-sky-900/10 backdrop-blur-xl sm:left-auto sm:right-4 sm:rounded-xl sm:border-slate-200 sm:p-0 dark:border-slate-700 dark:bg-slate-900/85">
          <button
            type="button"
            onClick={() => setMapMode('recommendation')}
            aria-label={mapCopy.recommendationMode[language]}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:flex-none sm:rounded-none sm:px-3 sm:py-2 sm:text-xs ${mapMode === 'recommendation' ? 'bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-600 hover:bg-white/60 sm:hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            <span className="sm:hidden">{mapCopy.recommendationShort[language]}</span>
            <span className="hidden sm:inline">{mapCopy.recommendationMode[language]}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode('wind')}
            aria-label={mapCopy.windMode[language]}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10px] font-bold transition-colors sm:flex-none sm:rounded-none sm:px-3 sm:py-2 sm:text-xs ${mapMode === 'wind' ? 'bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-900/30 dark:text-cyan-400' : 'text-slate-600 hover:bg-white/60 sm:hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            <span className="sm:hidden">{mapCopy.windShort[language]}</span>
            <span className="hidden sm:inline">{mapCopy.windMode[language]}</span>
          </button>
        </div>
        )}

        <MapContainer
          center={center}
          zoom={zoom}
          boxZoom
          doubleClickZoom
          dragging
          keyboard
          scrollWheelZoom={false}
          touchZoom
          zoomControl={false}
          className="w-full h-full z-0"
          style={{ height: '100%', width: '100%' }}
        >
          <ZoomControl position={preview || compact ? 'topright' : 'bottomright'} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <RecenterMap center={center} zoom={zoom} />
          <VisibleBeachTracker beaches={beaches} center={center} onVisibleBeachIdsChange={onVisibleBeachIdsChange} />
          <ZoomLabelController threshold={labelZoomThreshold} onLabelOpacityChange={setBeachLabelOpacity} />

          {/* User Location Marker */}
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]} icon={UserLocationIcon}>
              <Popup autoPan={false}>
                <div className="text-center">
                  <p className="font-bold text-slate-900">{mapCopy.youAreHere[language]}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Beach Markers */}
          {beaches.map((item, index) => {
            const isTopPickMarker = topBeachId !== undefined
              ? item.beachId === topBeachId
              : index === 0;
            const markerCoordinate = getBeachMapCoordinates(item.beach, { lat: center[0], lon: center[1] });

            return (
            <Marker
              key={item.beachId}
              position={[markerCoordinate.lat, markerCoordinate.lon]}
              icon={mapMode === 'recommendation'
                ? createBeachIcon(item, showRecommendationWindColors, isTopPickMarker)
                : createExposureIcon(getMapExposureLevel(item), showWindExposureColors, windBeaufort, isTopPickMarker)}
              eventHandlers={{
                click: () => {
                  trackEvent('map_marker_clicked', item.beachId, {
                    locale: languageToLocale(language),
                    source: compact ? 'detail_map' : preview ? 'home_map_preview' : 'full_map',
                    map_mode: mapMode,
                    beach_name: item.beach.name.en,
                  });
                  setSelectedBeachId(item.beachId);
                },
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
                    opacity: beachLabelOpacity,
                    transform: `translateY(${7 - beachLabelOpacity * 7}px) scale(${0.9 + beachLabelOpacity * 0.1})`,
                    filter: `blur(${(1 - beachLabelOpacity) * 0.8}px)`,
                    visibility: beachLabelOpacity > 0.02 ? 'visible' : 'hidden',
                  }}
                >
                  {item.name}
                </span>
              </Tooltip>
            </Marker>
            );
          })}
        </MapContainer>

        {mapMode === 'wind' && (
          <WindFlowOverlay
            windDirection={windDirection}
            windDirectionDeg={windDirectionDeg}
            windBeaufort={windBeaufort}
            preview={preview}
          />
        )}

        <WindDirectionGraphic
          windDirection={windDirection}
          windDirectionDeg={windDirectionDeg}
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
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
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

      {isCompactPreview && mapMode === 'wind' && (
        <div className="mt-2 rounded-xl border border-sky-100 bg-white/90 p-1.5 text-left shadow-sm shadow-sky-900/8 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
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
