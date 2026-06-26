// Shared beach-coverage matching/classification helpers.
//
// The canonical implementation lives in scripts/auditBeachDataset.mjs (the deep
// `audit:beaches` coverage engine). This module re-exports that exact surface so
// the national gap tooling (harvestBeachesOsm.mjs, buildNationalGapReport.mjs)
// shares identical thresholds + OSM-candidate logic and can never silently
// diverge from the audit. Importing this does NOT run the audit — its main() is
// guarded to direct invocation only.
export {
  // matching thresholds (metres)
  coverageNearbyMatchMeters,
  coveragePossibleAliasMeters,
  coverageNeedsSourceReviewMeters,
  coverageCoordinateMismatchMeters,
  likelyDuplicateNameDistanceMeters,
  greeceBounds,
  // base utils
  normalize,
  isNonEmptyString,
  isFiniteNumber,
  isGreeceCoordinate,
  getLocalizedName,
  // name-key / greeklish helpers
  normalizeBeachNameForCoverage,
  toGreeklishLoose,
  getCoverageNameKeys,
  hasSpecificCoverageName,
  nameKeySetsOverlap,
  getBeachCoverageNameKeys,
  // geo helpers
  haversineMeters,
  isCoordinateInsideBox,
  knownIslandCoordinateBounds,
  isWithinKnownIslandBounds,
  getKnownIslandCoordinateRegion,
  // OSM-candidate helpers
  osmElementUrl,
  getOsmElementCoordinates,
  getOsmElementName,
  toCoverageCandidate,
  dedupeCoverageCandidates,
  // classification (likely_missing / alias / coordinate-mismatch buckets)
  getExternalCandidateReview,
  // already-adjudicated OSM candidates (accepted sections / deferred), to suppress in reports
  externalCoverageReviewDecisions,
  halkidikiAcceptedSectionUrls,
  rhodesAcceptedSectionUrls,
  thesprotiaAcceptedSectionUrls,
  thessalonikiAcceptedSectionUrls,
} from '../auditBeachDataset.mjs';
