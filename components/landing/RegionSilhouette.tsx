import React from 'react';
import silhouetteData from '../../data/regionSilhouettes.generated.json';

// A small line drawing of the region's real coastline, sitting inside its landing
// tile. Traced from the same OSM land mask the exposure geometry uses
// (scripts/buildRegionSilhouettes.mjs), so it is the actual shape of that coast —
// not a generic island doodle. That matters here: the whole product is a claim
// about coastline shape, and a decorative stand-in would be the one illustration
// on the page that isn't true.
//
// Purely decorative in the accessibility sense — the tile's name is the label, so
// this is aria-hidden and adds no reading noise.
//
// Regions without an entry render nothing rather than a placeholder: a missing
// sketch is invisible, a wrong one is a wrong coast.

const PATHS: Record<string, { d: string }> = silhouetteData.regions;
const VIEW = silhouetteData.view;

export const hasRegionSilhouette = (regionId: string): boolean => Boolean(PATHS[regionId]);

interface RegionSilhouetteProps {
  regionId: string;
  className?: string;
}

export const RegionSilhouette: React.FC<RegionSilhouetteProps> = ({ regionId, className }) => {
  const shape = PATHS[regionId];
  if (!shape) return null;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <path
        d={shape.d}
        fill="none"
        stroke="currentColor"
        // Scaled in viewBox units, so the stroke keeps the same visual weight at
        // whatever pixel size the tile renders it.
        // In viewBox units, so it scales WITH the drawing: at the tile's ~36px
        // this lands near a 1px hairline. Deliberately not non-scaling-stroke,
        // which would pin it to 3.2 device pixels and read as a fat blob.
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default RegionSilhouette;
