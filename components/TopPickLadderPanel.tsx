import React from 'react';
import type { LanguageCode } from '../types';
import {
  LADDER_DECIDED,
  LADDER_NOTE,
  LADDER_NOT_REACHED,
  LADDER_TIED,
  type LadderRung,
} from '../utils/topPickLadder';

/**
 * ΤΟ ΚΟΥΤΙ «ΠΩΣ ΒΓΗΚΕ ΑΥΤΗ Η ΣΕΙΡΑ» (Μίλτος, 10/08/2026).
 *
 * One row per rung, in the order the comparator reads them, each carrying the three picks' own
 * values — and the rung that actually decided is the only one that gets emphasis. The rungs below
 * it are dimmed and labelled «δεν χρειάστηκε», which is the honest description of a ladder that
 * stops at the first difference: on a windy day the overall score is printed and NOT used, and a
 * reader who sees 76 under the second pick has to be told why that number did not win.
 *
 * Deliberately not a chart. Three short values per line read faster than any graphic at this size,
 * and the block has to survive a 320 px phone beside two other tiles.
 */
export const TopPickLadderPanel: React.FC<{
  rungs: LadderRung[];
  language: LanguageCode;
  className?: string;
}> = ({ rungs, language, className }) => {
  if (rungs.length === 0) return null;
  const tied = LADDER_TIED[language] ?? LADDER_TIED.gr;
  const decided = LADDER_DECIDED[language] ?? LADDER_DECIDED.gr;
  const notReached = LADDER_NOT_REACHED[language] ?? LADDER_NOT_REACHED.gr;
  const note = LADDER_NOTE[language] ?? LADDER_NOTE.gr;

  return (
    <div className={className}>
      <ol className="space-y-1.5">
        {rungs.map((rung, index) => {
          const isDecided = rung.status === 'decided';
          const isNotReached = rung.status === 'not-reached';
          const values = rung.values.filter(value => value.trim().length > 0);
          return (
            <li
              key={rung.key}
              className={`rounded-lg px-2 py-1.5 text-[11px] leading-snug ${
                isDecided
                  ? 'bg-sky-50 ring-1 ring-sky-200'
                  : isNotReached
                    ? 'opacity-55'
                    : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`min-w-0 truncate font-bold ${isDecided ? 'text-slate-950' : 'text-slate-700'}`}>
                  <span className="mr-1 tabular-nums text-slate-400">{index + 1}.</span>
                  {rung.label}
                </span>
                <span
                  className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${
                    isDecided ? 'text-[#007a83]' : 'text-slate-400'
                  }`}
                >
                  {isDecided ? decided : isNotReached ? notReached : tied}
                </span>
              </div>
              {values.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-600">
                  {values.map((value, valueIndex) => (
                    <span key={`${rung.key}-${valueIndex}`} className="tabular-nums">
                      <span className="text-slate-400">{valueIndex + 1}</span> {value}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] leading-snug text-slate-500">{note}</p>
    </div>
  );
};

export default TopPickLadderPanel;
