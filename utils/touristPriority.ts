import type { Beach } from '../types';

const ICONIC_BEACH_RECOGNITION: Record<string, number> = {
  sarakiniko: 100,
  kleftiko: 98,
  papafragkas: 96,
  papafragas: 96,
  fyriplaka: 94,
  firiplaka: 94,
  tsigkrado: 94,
  tsigrado: 94,
  palaiochori: 92,
  paliochori: 92,
  paleochori: 92,
  fyropotamos: 90,
  'agia kyriaki': 88,
  pollonia: 86,
  provatas: 85,
  achivadolimni: 84,
  plathiena: 82,
};

const normalizeTouristName = (value?: string): string => (
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
);

// popularityScore and rating are synthetic (deterministic hashes of the beach id, see
// buildBeachRegionData.mjs) and must not influence ranking; recognition comes only from
// the curated list above.
export const getBeachTouristRecognitionScore = (
  beach: Pick<Beach, 'name' | 'aliases'>
): number => {
  const names = [
    beach.name?.en,
    beach.name?.gr,
    ...(beach.aliases || []),
  ];

  return Math.max(
    0,
    ...names.map(name => ICONIC_BEACH_RECOGNITION[normalizeTouristName(name)] || 0)
  );
};
