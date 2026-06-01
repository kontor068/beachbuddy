import { WarningFlag, WaveCondition } from '../types';
import { generateBeachCopy, type BeachCopyInput } from './beachCopy';

type BestBeachTime = {
  bestStart?: string;
  bestEnd?: string;
};

type BeachExplanationInput = BeachCopyInput & {
  waveCondition?: WaveCondition;
  bestBeachTime?: BestBeachTime;
  warnings?: WarningFlag[];
};

interface BeachExplanation {
  heroTitle: string;
  heroBullets: string[];
  cardSummary: string;
  tradeoffText?: string;
}

export const generateBeachCardInsight = (
  input: Omit<BeachExplanationInput, 'bestBeachTime'>
): { insight: string; tradeoffText?: string } => {
  const copy = generateBeachCopy(input);
  return {
    insight: copy.cardSummary,
    tradeoffText: copy.tradeoffText,
  };
};

export const generateBeachExplanation = (input: BeachExplanationInput): BeachExplanation => {
  const copy = generateBeachCopy(input);

  return {
    heroTitle: copy.heroTitle,
    heroBullets: copy.detailBullets,
    cardSummary: copy.cardSummary,
    tradeoffText: copy.tradeoffText,
  };
};
