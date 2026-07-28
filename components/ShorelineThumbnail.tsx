import React, { useEffect, useMemo, useState } from 'react';
import type { Beach, LanguageCode } from '../types';
import {
  loadShorelineRegionIndex,
  loadShorelineShapes,
  SHORELINE_BOX,
  type ShorelineShape,
} from '../services/shorelineShapeService';

/**
 * Draws the beach's own shoreline where a photo would go.
 *
 * The geometry is real: it comes from the OSM coastline we already ship, rotated so the
 * seaward direction is up. Everything drawn on top of it is real too — the shore material
 * and the amenity marks come from the same audited fields the card shows as chips, so the
 * picture never claims anything the text does not.
 *
 * The visual language is deliberately cartographic rather than illustrative. A chart symbol
 * reads as "we surveyed this"; a cartoon parasol reads as "we made this up".
 *
 * Deliberately absent: a wind arrow. It tested as unreadable — an arrow over a coastline
 * needs a caption to explain itself, and anything needing a caption is not carrying its
 * weight in a 272px slot. Today's wind is already stated in words on every surface.
 */

/* ------------------------------------------------------------------ data */

export type ShoreMaterial = 'sand' | 'pebbles' | 'rocks';
export type ShoreDepth = 'shallow' | 'deep';
/** Only the accesses worth warning about. See `deriveShorelineFeatures`. */
export type ShoreAccess = 'track' | 'path' | 'boat';

export type ShorelineFeatures = {
  material: ShoreMaterial | null;
  depth: ShoreDepth | null;
  access: ShoreAccess | null;
  sunbeds: boolean;
  eatery: boolean;
  trees: boolean;
};

const materialFromLabel = (value: unknown): ShoreMaterial | null => {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  if (!text) return null;
  if (text.includes('sand') || text.includes('αμμ')) return 'sand';
  if (text.includes('pebble') || text.includes('shingle') || text.includes('βότσαλ') || text.includes('βοτσαλ')) {
    return 'pebbles';
  }
  if (text.includes('rock') || text.includes('βραχ')) return 'rocks';
  return null;
};

/**
 * Reads the drawing's content off the beach record. Every symbol maps to a field the app
 * already surfaces elsewhere — nothing here is inferred or softened.
 */
export const deriveShorelineFeatures = (beach: Beach): ShorelineFeatures => {
  const terrainTypes = beach.metadata?.terrain?.types;
  const candidates: unknown[] = [
    beach.beachType,
    beach.staticLabels?.beachType,
    ...(Array.isArray(terrainTypes) ? terrainTypes : []),
  ];

  let material: ShoreMaterial | null = null;
  for (const candidate of candidates) {
    material = materialFromLabel(candidate);
    if (material) break;
  }

  const depth: ShoreDepth | null =
    beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow'
      ? 'shallow'
      : beach.characteristics?.deepWaters === true || beach.waterDepth === 'deep'
        ? 'deep'
        : null;

  /**
   * Access is drawn only when getting there is awkward. "Εύκολη πρόσβαση" is frequently an
   * unverified default in the dataset, so an asphalt road earns no mark — drawing a road we
   * never confirmed would be exactly the kind of confident-and-wrong claim this whole
   * picture is supposed to avoid. Silence on the easy ones, a warning on the hard ones.
   */
  const accessType = beach.staticLabels?.accessType ?? beach.metadata?.access?.type;
  const access: ShoreAccess | null =
    accessType === 'boat_only'
      ? 'boat'
      : accessType === 'passable_dirt_road' || accessType === 'difficult_dirt_road'
        ? 'track'
        : accessType === 'hiking_path_easy' || accessType === 'hiking_path_difficult'
          ? 'path'
          : null;

  const amenities = beach.amenities;
  return {
    material,
    depth,
    access,
    sunbeds: amenities?.sunbeds === true || amenities?.organized === true,
    eatery: amenities?.taverna === true || amenities?.beachBar === true || amenities?.restaurant === true,
    trees: amenities?.naturalShade === true,
  };
};

/**
 * Resolves a beach's shoreline shape. Returns undefined while loading and for the ~6% of
 * beaches with no usable geometry, so callers must keep a neutral fallback.
 *
 * `regionId` is only a shortcut. When it is missing or wrong — a synthetic "near-me"
 * region, a saved list spanning several islands, a bare map marker — the national index
 * resolves the beach's real region instead. Treating the caller's region as mandatory is
 * what made the drawing vanish on exactly those screens.
 */
export const useShorelineShape = (
  regionId: string | undefined,
  beachId: number | undefined
): ShorelineShape | undefined => {
  const [shape, setShape] = useState<ShorelineShape | undefined>(undefined);

  useEffect(() => {
    if (beachId === undefined || beachId === null) {
      setShape(undefined);
      return;
    }

    let active = true;

    const resolve = async () => {
      if (regionId) {
        const lookup = await loadShorelineShapes(regionId);
        const hit = lookup?.[beachId];
        if (hit) return hit;
      }

      const index = await loadShorelineRegionIndex();
      const homeRegionId = index?.[beachId];
      if (!homeRegionId || homeRegionId === regionId) return undefined;

      const lookup = await loadShorelineShapes(homeRegionId);
      return lookup?.[beachId];
    };

    resolve().then(resolved => {
      if (active) setShape(resolved);
    });

    return () => {
      active = false;
    };
  }, [regionId, beachId]);

  return shape;
};

/* ------------------------------------------------------------- geometry */

type Point = [number, number];

const parsePoints = (serialized: string): Point[] =>
  serialized
    .split(' ')
    .map(pair => pair.split(',').map(Number) as Point)
    .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));

/** The shoreline is built left-to-right, so the waterline height is a plain lookup. */
const makeLandYAt = (points: Point[]) => (x: number): number => {
  if (points.length === 0) return SHORELINE_BOX.pinY;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (x <= x2) {
      if (x2 === x1) return y2;
      return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
    }
  }
  return points[points.length - 1][1];
};

/* -------------------------------------------------------------- symbols */

const INK_SHORE = '#8d7a55';
const INK_BUILT = '#6f6146';
const INK_TREE = '#6f8a62';
const INK_ROUTE = '#7a6a4a';

/**
 * How far out to sea the depth contours sit. This is the one piece of pure ornament in the
 * drawing, so it earns its place by carrying the water-depth field: contours crowded against
 * the shore read as "deep straight away", spread wide as "you can walk out a long way".
 */
const CONTOUR_OFFSETS: Record<'shallow' | 'medium' | 'deep', number[]> = {
  shallow: [-11, -23, -36],
  medium: [-7, -15, -24],
  deep: [-4, -8.5, -14],
};

/**
 * Grains, shingle or rock, as a chart texture hugging the waterline.
 *
 * Drawn as one tiled pattern clipped to a band, not as hundreds of individual marks: the
 * naive version emitted ~105 SVG nodes per beach, which is 2,000+ nodes on a scrolling list
 * of cards. The band itself is exact — the shoreline is x-monotone, so offsetting it
 * downwards and walking back gives a closed strip with no geometry work.
 */
const TEXTURE_TILES: Record<ShoreMaterial, { size: [number, number]; depth: number; tile: React.ReactNode }> = {
  sand: {
    size: [7, 7],
    depth: 11,
    tile: (
      <>
        <circle cx={1.7} cy={2.1} r={0.62} fill={INK_SHORE} opacity={0.5} />
        <circle cx={5.1} cy={5.3} r={0.55} fill={INK_SHORE} opacity={0.42} />
        <circle cx={4.4} cy={1.2} r={0.4} fill={INK_SHORE} opacity={0.34} />
      </>
    ),
  },
  pebbles: {
    size: [10, 8],
    depth: 11,
    tile: (
      <>
        <ellipse cx={2.6} cy={2.4} rx={1.7} ry={1.2} fill="none" stroke={INK_SHORE} strokeWidth={0.55} opacity={0.6} />
        <ellipse cx={7.4} cy={5.7} rx={2} ry={1.35} fill="none" stroke={INK_SHORE} strokeWidth={0.55} opacity={0.5} />
      </>
    ),
  },
  rocks: {
    size: [16, 12],
    depth: 14,
    tile: (
      <>
        <path d="M1.4 8.4 L4.4 2.6 L7.6 8.4 Z" fill="none" stroke={INK_SHORE} strokeWidth={0.62} strokeLinejoin="round" opacity={0.62} />
        <path d="M8.8 10.6 L11.6 5.4 L14.6 10.6 Z" fill="none" stroke={INK_SHORE} strokeWidth={0.62} strokeLinejoin="round" opacity={0.5} />
      </>
    ),
  },
};

/** The strip of land between the waterline and `depth` units inland. */
const shoreBandPolygon = (points: Point[], depth: number): string => {
  const seaward = points.map(([x, y]) => `${x},${y + 2}`);
  const landward = [...points].reverse().map(([x, y]) => `${x},${y + depth}`);
  return [...seaward, ...landward].join(' ');
};

/** A row of sunbeds, seen from the side: mattress plus raised backrest. */
const SunbedMark: React.FC<{ x: number; y: number; scale: number }> = ({ x, y, scale }) => (
  <g
    transform={`translate(${x} ${y}) scale(${scale})`}
    fill="none"
    stroke={INK_BUILT}
    strokeWidth={1.05}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {[0, 7.5, 15].map(offset => (
      <g key={offset} transform={`translate(${offset} 0)`}>
        <path d="M0 0 H5.4" />
        <path d="M0 0 L-1.9 -3.1" />
        <path d="M1.1 1.9 V0" />
        <path d="M4.6 1.9 V0" />
      </g>
    ))}
  </g>
);

/** A shore taverna: pitched roof on posts, the way a chart marks a building. */
const EateryMark: React.FC<{ x: number; y: number; scale: number }> = ({ x, y, scale }) => (
  <g
    transform={`translate(${x} ${y}) scale(${scale})`}
    fill="none"
    stroke={INK_BUILT}
    strokeWidth={1.15}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M-6.4 -2.2 L0 -7.4 L6.4 -2.2 Z" />
    <path d="M-4.6 -2.2 V2.4" />
    <path d="M4.6 -2.2 V2.4" />
    <path d="M-6.4 2.4 H6.4" />
  </g>
);

/**
 * How you get here, drawn only when it is not a plain road: a dirt track, a footpath, or no
 * land route at all. The route arrives from the bottom of the frame, which is inland.
 */
const AccessMark: React.FC<{ kind: ShoreAccess; landY: number }> = ({ kind, landY }) => {
  if (kind === 'boat') {
    // No route drawn on purpose — the absence is the message. The boat sits offshore.
    return (
      <g transform={`translate(146 ${Math.max(14, landY - 22)})`} aria-hidden="true">
        <path
          d="M-6.4 0 H6.4 L4.4 4 H-4.4 Z"
          fill="none"
          stroke={INK_ROUTE}
          strokeWidth={1.15}
          strokeLinejoin="round"
        />
        <path d="M0 0 V-6.6" stroke={INK_ROUTE} strokeWidth={1.05} strokeLinecap="round" />
        <path d="M0.9 -6.2 L4.6 -1.6 H0.9 Z" fill={INK_ROUTE} fillOpacity={0.22} stroke={INK_ROUTE} strokeWidth={0.9} strokeLinejoin="round" />
      </g>
    );
  }

  const d = `M100 128 C 90 116, 110 100, 100 ${(landY + 4).toFixed(1)}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={INK_ROUTE}
      strokeWidth={kind === 'track' ? 1.5 : 1.2}
      strokeLinecap="round"
      strokeDasharray={kind === 'track' ? '6 4' : '0.5 4'}
      opacity={0.72}
      aria-hidden="true"
    />
  );
};

/** Tamarisks — the tree that actually shades a Greek beach. */
const TreeMark: React.FC<{ x: number; y: number; scale: number }> = ({ x, y, scale }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK_TREE} strokeLinecap="round">
    <path d="M0 2.6 V-2.4" strokeWidth={1.1} fill="none" />
    <path d="M-4.8 -2.6 Q0 -8.4 4.8 -2.6 Z" strokeWidth={1} fill={INK_TREE} fillOpacity={0.16} />
  </g>
);

/* ------------------------------------------------------------ component */

const shorelineAriaLabels: Record<LanguageCode, (beachName: string) => string> = {
  gr: beachName => `Σχεδιάγραμμα της ακτογραμμής στην παραλία ${beachName}`,
  en: beachName => `Diagram of the shoreline at ${beachName}`,
  fr: beachName => `Schéma du littoral à ${beachName}`,
  de: beachName => `Schema der Küstenlinie bei ${beachName}`,
  it: beachName => `Schema della costa a ${beachName}`,
};

type ShorelineThumbnailProps = {
  shape: ShorelineShape;
  beachName: string;
  language: LanguageCode;
  /** Shore material and amenities, from `deriveShorelineFeatures`. */
  features?: ShorelineFeatures;
  /** Seeds the deterministic texture. Use the beach id. */
  seed?: number;
  /** Renders larger marks and a scale bar, for the detail page. */
  size?: 'compact' | 'full';
  /**
   * Crops the drawing for slots whose aspect ratio is nothing like 200x120. `slice` would
   * push the pin out of frame in a 292x80 band, so those slots get an explicit window
   * around the pin instead.
   */
  crop?: 'default' | 'band' | 'square';
  className?: string;
};

export const ShorelineThumbnail: React.FC<ShorelineThumbnailProps> = ({
  shape,
  beachName,
  language,
  features,
  seed = 0,
  size = 'compact',
  crop = 'default',
  className = '',
}) => {
  const rawId = React.useId();
  const gradientId = rawId.replace(/:/g, '');
  const seaGradient = `${gradientId}-sea`;
  const landGradient = `${gradientId}-land`;

  const { width, height, pinX, pinY } = SHORELINE_BOX;
  const isFull = size === 'full';
  const markScale = isFull ? 1 : 0.86;

  // A band keeps the waterline and the pin; a square thumb zooms to the beach itself.
  const viewBox =
    crop === 'band' ? `0 44 ${width} 56` : crop === 'square' ? '38 30 96 96' : `0 0 ${width} ${height}`;
  const contourOffsets = CONTOUR_OFFSETS[features?.depth ?? 'medium'];
  const points = useMemo(() => parsePoints(shape.points), [shape.points]);
  const landYAt = useMemo(() => makeLandYAt(points), [points]);

  // The land polygon is the shoreline closed off along the bottom of the box.
  const landPoints = `${shape.points} ${width + 10},${height + 30} -10,${height + 30}`;

  /**
   * Amenity marks go on the land, well clear of the pin, and only where there is enough
   * dry room below the waterline to sit without colliding with the frame edge.
   */
  const amenityMarks = useMemo(() => {
    // At 64px a taverna glyph is two pixels of noise. The square crop keeps the waterline,
    // the shore material and the pin, and drops everything that needs room to be read.
    if (!features || crop === 'square') return [];
    const wanted: Array<'sunbeds' | 'eatery' | 'trees'> = [];
    if (features.sunbeds) wanted.push('sunbeds');
    if (features.eatery) wanted.push('eatery');
    if (features.trees) wanted.push('trees');
    if (wanted.length === 0) return [];

    const slots = [62, 140, 30, 172];
    const placed: Array<{ kind: string; x: number; y: number }> = [];
    for (const kind of wanted) {
      const slot = slots.find(candidate => {
        if (placed.some(item => Math.abs(item.x - candidate) < 30)) return false;
        const y = landYAt(candidate) + (kind === 'sunbeds' ? 15 : 19);
        return y < height - 5;
      });
      if (slot === undefined) continue;
      placed.push({ kind, x: slot, y: landYAt(slot) + (kind === 'sunbeds' ? 15 : 19) });
    }
    return placed;
  }, [features, landYAt, height, crop]);

  const scaleBarMetres = shape.frameWidthM ? Math.round(shape.frameWidthM / 4 / 50) * 50 : 0;
  const scaleBarUnits = shape.frameWidthM ? (scaleBarMetres / shape.frameWidthM) * width : 0;

  return (
    <svg
      className={`h-full w-full ${className}`}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={shorelineAriaLabels[language](beachName)}
    >
      <defs>
        <linearGradient id={seaGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ebfda" />
          <stop offset="55%" stopColor="#9bd6e7" />
          <stop offset="100%" stopColor="#c9ecf4" />
        </linearGradient>
        <linearGradient id={landGradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2e7cd" />
          <stop offset="55%" stopColor="#e6d8b8" />
          <stop offset="100%" stopColor="#d8ccab" />
        </linearGradient>
        <clipPath id={`${gradientId}-land-clip`}>
          <polygon points={landPoints} />
        </clipPath>
        {features?.material && (
          <pattern
            id={`${gradientId}-texture`}
            patternUnits="userSpaceOnUse"
            width={TEXTURE_TILES[features.material].size[0]}
            height={TEXTURE_TILES[features.material].size[1]}
            // Phase-shift per beach so neighbouring drawings never tile in lockstep.
            patternTransform={`translate(${seed % 7} ${seed % 5})`}
          >
            {TEXTURE_TILES[features.material].tile}
          </pattern>
        )}
      </defs>

      <rect x="0" y="0" width={width} height={height} fill={`url(#${seaGradient})`} />

      {/* Depth contours: the same shoreline stepped out to sea, the way a chart draws them.
          Their spacing is the water-depth field, not decoration. */}
      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
        {contourOffsets.map((offset, index) => (
          <polyline
            key={offset}
            points={shape.points}
            transform={`translate(0,${offset})`}
            strokeWidth={1.6 - index * 0.2}
            opacity={0.32 - index * 0.1}
          />
        ))}
      </g>

      {/* Wet sand: a soft light band hugging the water line. */}
      <polygon points={landPoints} fill="#ffffff" opacity="0.55" transform="translate(0,-2.5)" />
      <polygon points={landPoints} fill={`url(#${landGradient})`} />

      {features?.access === 'boat' && <AccessMark kind="boat" landY={landYAt(146)} />}

      <g clipPath={`url(#${gradientId}-land-clip)`}>
        {features?.access && features.access !== 'boat' && (
          <AccessMark kind={features.access} landY={landYAt(100)} />
        )}
        {features?.material && (
          <polygon points={shoreBandPolygon(points, TEXTURE_TILES[features.material].depth)} fill={`url(#${gradientId}-texture)`} />
        )}
        {amenityMarks.map(mark => {
          if (mark.kind === 'sunbeds') {
            return <SunbedMark key={mark.kind} x={mark.x - 8} y={mark.y} scale={markScale} />;
          }
          if (mark.kind === 'eatery') {
            return <EateryMark key={mark.kind} x={mark.x} y={mark.y} scale={markScale} />;
          }
          return (
            <g key={mark.kind}>
              <TreeMark x={mark.x - 5} y={mark.y} scale={markScale} />
              <TreeMark x={mark.x + 5.5} y={mark.y + 1.4} scale={markScale * 0.82} />
            </g>
          );
        })}
      </g>

      <polyline
        points={shape.points}
        fill="none"
        stroke="#3f8ba3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />


      <circle cx={pinX} cy={pinY} r={(isFull ? 5 : 4.4) + 2.6} fill="#ffffff" opacity="0.9" />
      <circle cx={pinX} cy={pinY} r={isFull ? 5 : 4.4} fill="#0e7490" />
      <circle cx={pinX} cy={pinY} r={(isFull ? 5 : 4.4) - 2} fill="#ffffff" opacity="0.85" />

      {isFull && scaleBarUnits > 12 && (
        <g transform={`translate(12 ${height - 10})`} aria-hidden="true">
          <path
            d={`M0 0 H${scaleBarUnits}`}
            stroke="#4d5f4a"
            strokeWidth="1.3"
            strokeLinecap="butt"
            opacity="0.65"
          />
          <path d="M0 -2.6 V2.6" stroke="#4d5f4a" strokeWidth="1.3" opacity="0.65" />
          <path d={`M${scaleBarUnits} -2.6 V2.6`} stroke="#4d5f4a" strokeWidth="1.3" opacity="0.65" />
          <text x={scaleBarUnits / 2} y="-4" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="#4d5f4a" opacity="0.8">
            {scaleBarMetres} m
          </text>
        </g>
      )}
    </svg>
  );
};

export default ShorelineThumbnail;

/* ------------------------------------------------- shared photo fallback */

/**
 * The quiet ground used where a beach has no photo AND no usable geometry (~7% of them).
 * Deliberately silent: the old "Φωτογραφίες σύντομα" pill apologised on the majority of
 * cards in the app, which read as a half-built product rather than as an invitation.
 */
const NeutralShorePanel: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden bg-sky-100" aria-hidden="true">
    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-sky-50 to-emerald-50" />
    <svg className="absolute inset-0 h-full w-full text-cyan-600/16" viewBox="0 0 400 180" preserveAspectRatio="none">
      <path d="M0 112 C55 98 89 123 142 110 C192 98 220 70 274 78 C322 85 347 116 400 102 L400 180 L0 180 Z" fill="currentColor" />
      <path d="M-20 62 C55 84 105 66 160 82 C215 98 260 80 420 102" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
    <div className="absolute inset-0 bg-gradient-to-t from-white/45 via-white/10 to-white/8" />
  </div>
);

/**
 * The single entry point every photo slot should use when there is no photo. Draws the
 * beach's real shoreline where we have it and a quiet panel where we do not, so all six
 * surfaces stay in step instead of drifting into six different placeholders again.
 */
export const BeachPhotoFallback: React.FC<{
  beach: Beach;
  regionId?: string;
  language: LanguageCode;
  beachName: string;
  size?: 'compact' | 'full';
  crop?: 'default' | 'band' | 'square';
  className?: string;
}> = ({ beach, regionId, language, beachName, size = 'compact', crop = 'default', className = '' }) => {
  const shape = useShorelineShape(beach.regionId ?? regionId, beach.id);
  const features = useMemo(() => deriveShorelineFeatures(beach), [beach]);

  if (!shape) return <NeutralShorePanel />;

  return (
    <div className={`absolute inset-0 overflow-hidden bg-sky-100 ${className}`}>
      <ShorelineThumbnail
        shape={shape}
        beachName={beachName}
        language={language}
        features={features}
        seed={beach.id}
        size={size}
        crop={crop}
      />
    </div>
  );
};
