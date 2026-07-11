import React, { useEffect, useMemo, useState } from 'react';
import { Polyline } from 'react-leaflet';
import type { ExperienceTier } from '../utils/experienceTier';

/**
 * Coloured-coastline layer: paints the stretches of real OSM coastline near our
 * beaches in the beach's LIVE experience-tier colour, so the island reads as a
 * continuous "where is it good today" ribbon instead of only discrete dots.
 *
 * Geometry is static (public/data/coastline/<region>.json, built by
 * scripts/buildCoastlineRibbons.mjs); colour is resolved at render time from the
 * same per-beach tier map that colours the markers — one source of truth, the two
 * can never disagree. Vertices carry [lat, lon, nearestBeachId, distM]:
 *  - stretches whose nearest beach is missing from the current tier map render in
 *    a neutral grey (never a verdict we can't back), and
 *  - opacity fades with distance from the nearest beach, so coastline far from any
 *    data point stops claiming anything.
 */

type RibbonVertex = [number, number, number, number]; // lat, lon, beachId (-1 none), distM (-1 none)
interface RibbonSlice {
  v: number;
  region: string;
  lines: RibbonVertex[][];
}

interface RibbonRun {
  pts: [number, number][];
  color: string;
  fade: number;
}

const TIER_COLOR: Record<ExperienceTier, string> = {
  excellent: '#10b981', // emerald-500 — matches experienceMarkerTone
  good: '#0ea5e9',      // sky-500
  fair: '#fbbf24',      // amber-400
  skip: '#e11d48',      // rose-600
};
/** Stretches near a beach that has no tier in the current view: neutral, low-key. */
const NEUTRAL_COLOR = '#94a3b8'; // slate-400

/** Distance fade: full strength on the beach itself, dimming out toward the cutoff. */
const fadeBucket = (distM: number): number => {
  if (distM < 0) return 0.25;
  if (distM <= 900) return 1;
  if (distM <= 1500) return 0.55;
  return 0.3;
};

// Per-session slice cache — a region's geometry never changes within a visit.
const sliceCache = new Map<string, RibbonSlice | null>();

interface CoastlineRibbonLayerProps {
  regionId?: string;
  /** beachId → live experience tier, computed by the map (same values as the markers). */
  tierByBeachId: ReadonlyMap<number, ExperienceTier>;
}

const CoastlineRibbonLayer: React.FC<CoastlineRibbonLayerProps> = ({ regionId, tierByBeachId }) => {
  const [slice, setSlice] = useState<RibbonSlice | null>(regionId ? sliceCache.get(regionId) ?? null : null);

  useEffect(() => {
    if (!regionId) { setSlice(null); return; }
    if (sliceCache.has(regionId)) { setSlice(sliceCache.get(regionId) ?? null); return; }
    let alive = true;
    fetch(`/data/coastline/${regionId}.json`)
      .then(response => (response.ok ? (response.json() as Promise<RibbonSlice>) : null))
      .catch(() => null)
      .then(data => {
        const valid = data && data.v === 1 && Array.isArray(data.lines) ? data : null;
        sliceCache.set(regionId, valid);
        if (alive) setSlice(valid);
      });
    return () => { alive = false; };
  }, [regionId]);

  // Split each polyline into runs of constant (colour, fade-bucket). Consecutive
  // runs share their boundary vertex so the ribbon stays visually continuous.
  const runs = useMemo<RibbonRun[]>(() => {
    if (!slice) return [];
    const out: RibbonRun[] = [];
    for (const line of slice.lines) {
      let current: RibbonRun | null = null;
      for (const [lat, lon, beachId, distM] of line) {
        const tier = beachId !== -1 ? tierByBeachId.get(beachId) : undefined;
        const color = tier ? TIER_COLOR[tier] : NEUTRAL_COLOR;
        const fade = tier ? fadeBucket(distM) : 0.25;
        if (current && current.color === color && current.fade === fade) {
          current.pts.push([lat, lon]);
        } else {
          const boundary: [number, number] = [lat, lon];
          if (current && current.pts.length >= 2) {
            current.pts.push(boundary);
            out.push(current);
          } else if (current && current.pts.length === 1) {
            // A 1-point run can't render; merge its point into the next run instead.
            boundary[0] = current.pts[0][0];
            boundary[1] = current.pts[0][1];
          }
          current = { pts: [boundary, [lat, lon]], color, fade };
          // De-dup the seed pair when no boundary merge happened.
          if (current.pts[0][0] === lat && current.pts[0][1] === lon) current.pts = [[lat, lon]];
        }
      }
      if (current && current.pts.length >= 2) out.push(current);
    }
    return out;
  }, [slice, tierByBeachId]);

  if (runs.length === 0) return null;

  return (
    <>
      {runs.map((run, index) => (
        <React.Fragment key={`${slice?.region}-${index}`}>
          {/* soft glow underlay */}
          <Polyline
            positions={run.pts}
            pathOptions={{ color: run.color, weight: 10, opacity: 0.16 * run.fade, lineCap: 'round', lineJoin: 'round', interactive: false }}
          />
          {/* crisp ribbon core */}
          <Polyline
            positions={run.pts}
            pathOptions={{ color: run.color, weight: 4, opacity: 0.72 * run.fade, lineCap: 'round', lineJoin: 'round', interactive: false }}
          />
        </React.Fragment>
      ))}
    </>
  );
};

export default CoastlineRibbonLayer;
