import type { Beach, LanguageCode } from '../types';

/**
 * Naturist (nudist) beaches are a SENSITIVE category (Miltos 2026-07-21): they must
 * never be surfaced proactively in the recommendation/directory/"Κοντά μου" lists.
 * They stay on the map and are findable by an explicit name search or the dedicated
 * "Γυμνιστών" filter (opt-in). This module is the single source of truth for deciding
 * whether a beach is a dedicated naturist beach.
 *
 * IDENTIFICATION — deliberately conservative (reliability mandate):
 * We only treat a beach as naturist when its OWN name (any locale) or an alias carries
 * an explicit naturist marker ("Γυμνιστών", "Γυμνιστική", nudist, naturist, FKK). Mainstream
 * beaches that merely have a naturist *section* or reputation mentioned in notes/sources
 * (e.g. Βελανιό, Μικρή Μπανάνα, Καμπί) are NOT hidden — they are normal beaches and hiding
 * them would strip good, popular options. Curated id lists below let us hand-correct the
 * rare false positive / false negative without loosening the name signal.
 */

const NATURIST_NAME_PATTERN = /(γυμνιστ|nudist|naturist|\bfkk\b|clothing[\s-]?optional)/i;

// Force-INCLUDE beaches that are genuinely dedicated-naturist but whose stored name
// carries no marker. Keep this list tiny and evidence-backed. (id)
const CURATED_NATURIST_IDS = new Set<number>([]);

// Force-EXCLUDE any beach the name pattern would wrongly flag (a normal beach that just
// happens to contain a marker substring). (id)
const CURATED_NON_NATURIST_IDS = new Set<number>([]);

const collectBeachNameStrings = (beach: Beach): string[] => {
  const parts: string[] = [];
  const name = beach.name as unknown;
  if (typeof name === 'string') {
    parts.push(name);
  } else if (name && typeof name === 'object') {
    for (const value of Object.values(name as Record<LanguageCode, string>)) {
      if (typeof value === 'string') parts.push(value);
    }
  }
  for (const alias of beach.aliases || []) {
    if (typeof alias === 'string') parts.push(alias);
  }
  return parts;
};

/**
 * True when the beach is a dedicated naturist beach. Pure and side-effect free so it can
 * be called freely inside render/filter hot paths.
 */
export const isNaturistBeach = (beach: Beach | undefined | null): boolean => {
  if (!beach) return false;
  if (CURATED_NON_NATURIST_IDS.has(beach.id)) return false;
  if (CURATED_NATURIST_IDS.has(beach.id)) return true;
  return collectBeachNameStrings(beach).some(part => NATURIST_NAME_PATTERN.test(part));
};
