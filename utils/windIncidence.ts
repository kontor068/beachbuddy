import type { LanguageCode } from '../types';
import type { LocalizedCopy } from './i18n';

/**
 * How today's wind meets THIS shoreline: head-on, side-on, or off the land behind it.
 *
 * This ladder is not new. It was written inside components/CoveConditionsCard.tsx and lived there
 * as a one-line ternary used by exactly one card. A review on 29/07/2026 counted **eleven** private
 * wave/severity ladders already scattered across the page — each read a raw number against its own
 * thresholds, and the drift between them is what produced the contradictions reported that day. So
 * the rule for anything that needs this classification is: import it, do not re-derive it.
 *
 * The thresholds are the card's own, unchanged, so lifting them here is provably a no-op:
 *   onshore  > 0.50   the wind is aimed at the shore
 *   cross   >= 0.15   it grazes it
 *   offshore          it comes off the land behind it
 *
 * `onshore` is cos(windFrom − beachFacing) in [-1,1], the same value the cove guard computes
 * (utils/coveWaveGuard.ts) from the same geometry the wave figure uses.
 *
 * NOTE ON WHAT THIS IS FOR. It describes the WIND against a shoreline. It says nothing about wave
 * height, and nothing here may ever be turned into metres: an offshore wind leaves the local
 * wind-sea near zero but NOT the sea, and two separate attempts on 29/07/2026 to turn this
 * geometry into a smaller per-beach wave figure were refuted by measurement (see
 * docs/team/99-decision-log.md). Words only.
 */
export type WindIncidence = 'onshore' | 'cross' | 'offshore';

/** Above this the wind is aimed at the shore. */
export const INCIDENCE_ONSHORE_MIN = 0.5;
/** At/above this it grazes the shore; below it, it comes off the land. */
export const INCIDENCE_CROSS_MIN = 0.15;

export const getWindIncidence = (onshore: number): WindIncidence => {
  if (!Number.isFinite(onshore)) return 'cross';
  if (onshore > INCIDENCE_ONSHORE_MIN) return 'onshore';
  if (onshore >= INCIDENCE_CROSS_MIN) return 'cross';
  return 'offshore';
};

/** The short adverbial the cove card prints ("κατάμουτρα" / "onshore"). */
export const INCIDENCE_WORD: Record<WindIncidence, LocalizedCopy<string>> = {
  onshore: { en: 'onshore', gr: 'κατάμουτρα', de: 'auflandig', it: 'di faccia', fr: 'de face' },
  cross: { en: 'cross-shore', gr: 'πλάγιος', de: 'seitlich', it: 'laterale', fr: 'de côté' },
  offshore: { en: 'offshore', gr: 'από τη στεριά', de: 'ablandig', it: 'da terra', fr: 'de terre' },
};

export const getWindIncidenceWord = (incidence: WindIncidence, language: LanguageCode): string => (
  INCIDENCE_WORD[incidence][language] ?? INCIDENCE_WORD[incidence].en
);
