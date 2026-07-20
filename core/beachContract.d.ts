// TypeScript surface for the canonical beach contract (beachContract.mjs).
// Lets the browser bundle import the SAME validation the build gate uses, with
// full typing and zero duplication. See beachContract.mjs for the rationale.

export const CONTRACT_VERSION: number;

export const BEACH_TYPES: readonly ['sandy', 'pebbles', 'sandy-pebbles', 'rocky', 'unknown'];
export const ACCESSIBILITY: readonly ['EASY', 'MODERATE', 'DIFFICULT', 'BOAT_ONLY'];
export const WATER_DEPTH: readonly ['shallow', 'medium', 'deep'];
export const DATA_CONFIDENCE: readonly ['high', 'medium', 'low'];
export const WIND_DIRECTIONS: readonly [
  'North', 'Northeast', 'East', 'Southeast',
  'South', 'Southwest', 'West', 'Northwest',
];

export const GREECE_BOUNDS: Readonly<{ minLat: number; maxLat: number; minLon: number; maxLon: number }>;

export interface ContractCoordinate { lat: number; lon: number; }
export function isGreeceCoordinate(c: unknown): c is ContractCoordinate;

export interface ContractViolation {
  field: string;
  code: string;
  message: string;
}

export interface ContractResult {
  valid: boolean;
  errors: ContractViolation[];
}

/** Validate a FULL beach record (summary/raw): identity + location mandatory. */
export function validateBeachRecord(beach: unknown): ContractResult;

/** Validate a PARTIAL beach record (detail/override patch): only id required. */
export function validateBeachPatch(beach: unknown): ContractResult;
