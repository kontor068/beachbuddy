import type { WindSuitabilityColor } from '../types';

/** Shared visual tokens for the map marker and the compact card wave glyph. */
export const WIND_SUITABILITY_TONE_CLASSES: Record<WindSuitabilityColor, {
  marker: string;
  ring: string;
  badge: string;
  wave: string;
}> = {
  green: {
    marker: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    wave: 'text-emerald-500',
  },
  yellow: {
    marker: 'bg-yellow-400',
    ring: 'ring-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    wave: 'text-yellow-400',
  },
  orange: {
    marker: 'bg-orange-500',
    ring: 'ring-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    wave: 'text-orange-500',
  },
  red: {
    marker: 'bg-rose-600',
    ring: 'ring-rose-300',
    badge: 'bg-rose-100 text-rose-700',
    wave: 'text-rose-600',
  },
};
