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

export const getBeachTouristRecognitionScore = (
  beach: Pick<Beach, 'name' | 'aliases' | 'popularityScore' | 'rating'>
): number => {
  const declaredPopularity = typeof beach.popularityScore === 'number' ? beach.popularityScore : 0;
  const ratingSignal = Math.max(0, Math.min(10, ((beach.rating || 0) - 4) * 10));
  const names = [
    beach.name?.en,
    beach.name?.gr,
    ...(beach.aliases || []),
  ];
  const curatedRecognition = Math.max(
    0,
    ...names.map(name => ICONIC_BEACH_RECOGNITION[normalizeTouristName(name)] || 0)
  );

  return Math.max(declaredPopularity, curatedRecognition) + ratingSignal;
};
