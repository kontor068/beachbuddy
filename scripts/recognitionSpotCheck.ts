/**
 * Spot-check for the id-keyed ICONIC_BEACH_RECOGNITION rollout (approved 2026-06-12).
 * Simulates the CALM band (<3 Bft) of compareRecommendationPriority with flat equal
 * scores — the worst case for "recognition dominance", since every pair is a tie and
 * the tourist tiebreak decides everything. BEFORE replicates the old name-keyed
 * Milos-only map; AFTER imports the real new map. All other helpers are shared, so
 * any difference shown comes from recognition alone.
 *
 * Run: node scripts/recognitionSpotCheck.mjs
 */
import { readFileSync } from 'node:fs';
import { hasDifficultTopPickAccess, hasMainstreamTopPickAccess } from '../utils/access';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import type { Beach } from '../types';

// --- OLD recognition (verbatim from the pre-2026-06-12 name-keyed map) ---
const OLD_MAP: Record<string, number> = {
  sarakiniko: 100, kleftiko: 98, papafragkas: 96, papafragas: 96, fyriplaka: 94, firiplaka: 94,
  tsigkrado: 94, tsigrado: 94, palaiochori: 92, paliochori: 92, paleochori: 92, fyropotamos: 90,
  'agia kyriaki': 88, pollonia: 86, provatas: 85, achivadolimni: 84, plathiena: 82,
};
const normalizeTouristName = (value?: string): string => (
  (value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
);
const oldRecognition = (beach: Beach): number => Math.max(
  0,
  ...[beach.name?.en, beach.name?.gr, ...(beach.aliases || [])].map(n => OLD_MAP[normalizeTouristName(n)] || 0)
);
// NOTE: the old function also added max(declaredPopularity, ...) + ratingSignal from the
// SYNTHETIC popularityScore/rating fields; that part was removed in e551ad4 and is not
// replicated — BEFORE here is the state after e551ad4 (curated names only).

// --- shared comparator helpers (verbatim replicas of recommendationService internals) ---
const hasTopPickVisitorServices = (beach: Beach): boolean => {
  const metadataAmenities = beach.metadata?.amenities?.join(' ').toLowerCase() || '';
  return Boolean(
    beach.metadata?.organized === true || beach.amenities?.organized || beach.amenities?.beachBar ||
    beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant ||
    /beach bar|sunbed|ξαπλώστρ|ομπρέλ|καφέ|cafe|ταβέρν|taverna|restaurant|εστιατόρ/.test(metadataAmenities)
  );
};
const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant)
);
const topPickAccessPriority = (beach: Beach): number => {
  const accessType = beach.metadata?.access?.type;
  if (hasDifficultTopPickAccess(beach)) return 5;
  if (accessType === 'asphalt_road') return 0;
  if (accessType === 'passable_dirt_road') return 1;
  if (accessType === 'hiking_path_easy') return 2;
  if (!accessType && (beach as { accessibility?: string }).accessibility === 'EASY') return 0;
  if (!accessType && (beach as { accessibility?: string }).accessibility === 'MODERATE') return 1;
  if (hasMainstreamTopPickAccess(beach)) return 3;
  return 4;
};
const topPickAmenitiesScore = (beach: Beach): number => {
  let score = 0;
  if (hasMainstreamFacilities(beach)) score += 8;
  if (hasTopPickVisitorServices(beach)) score += 6;
  if (beach.amenities?.parking) score += 4;
  if (beach.amenities?.naturalShade) score += 2;
  if (beach.environment?.familyFriendly) score += 2;
  return score;
};

// Calm-band comparator (<3 Bft, flat scores => every pair hits the tourist tiebreak).
const calmCompare = (a: Beach, b: Beach, recognition: (x: Beach) => number): number => {
  const popularityDiff = recognition(b) - recognition(a);
  if (Math.abs(popularityDiff) >= 1) return popularityDiff;
  const accessPriorityDiff = topPickAccessPriority(a) - topPickAccessPriority(b);
  if (accessPriorityDiff !== 0) return accessPriorityDiff;
  const amenitiesDiff = topPickAmenitiesScore(b) - topPickAmenitiesScore(a);
  if (amenitiesDiff !== 0) return amenitiesDiff;
  return a.id - b.id;
};

for (const region of ['ionian-islands-lefkada', 'east-macedonia-and-thrace-thasos', 'south-aegean-milos']) {
  const data = JSON.parse(readFileSync(`public/data/beaches/app/${region}.json`, 'utf8'));
  const beaches: Beach[] = data.island.beaches;
  const before = [...beaches].sort((a, b) => calmCompare(a, b, oldRecognition));
  const after = [...beaches].sort((a, b) => calmCompare(a, b, getBeachTouristRecognitionScore));
  console.log(`\n=== ${region} (calm <3 Bft, flat scores) ===`);
  console.log('  BEFORE: ' + before.slice(0, 5).map(b => `${b.name.en}(${oldRecognition(b) || '-'})`).join(' · '));
  console.log('  AFTER : ' + after.slice(0, 5).map(b => `${b.name.en}(${getBeachTouristRecognitionScore(b) || '-'})`).join(' · '));
}
console.log('\nNote: >=5 Bft ordering is structurally unchanged - exposure class still sorts first;');
console.log('recognition only breaks ties inside the same exposure class (comparator code untouched).');
