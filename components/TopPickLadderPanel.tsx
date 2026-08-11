import React from 'react';
import type { LanguageCode } from '../types';
import { LADDER_CALM_DAY, LADDER_COLOUR_FIRST, LADDER_DOORS, topPickCriteriaRows } from '../utils/topPickLadder';

/**
 * ΤΟ ΚΟΥΤΙ «ΤΙ ΚΟΙΤΑΜΕ» (Μίλτος, 10/08/2026).
 *
 * A weights table, not a calculation. The previous version printed all three picks' values on
 * every rung and marked the deciding one; Miltos rejected it in one sentence — «δεν θέλω να έχω
 * έναν υπολογιστή δίπλα μου» — and he was right twice over, because the ladder it described
 * stopped existing the same evening.
 *
 * So: six lines, the same six everywhere, every day. What the site values and by how much. The
 * numbers come from utils/topPickScoreTable via topPickCriteriaRows and are never restated here.
 *
 * Deliberately not a chart. Six labelled numbers read faster than any graphic at this size, and
 * the block has to survive a 320 px phone beside two other tiles.
 */
export const TopPickLadderPanel: React.FC<{
  language: LanguageCode;
  /**
   * True below the wind that makes shelter mean anything (3 Bft). The two heaviest rows score full
   * marks for every beach there, so the box says so rather than letting the reader believe a
   * criterion decided something it did not — see LADDER_CALM_DAY.
   */
  isCalmDay?: boolean;
  className?: string;
}> = ({ language, isCalmDay = false, className }) => {
  const rows = topPickCriteriaRows(language);
  const doors = LADDER_DOORS[language] ?? LADDER_DOORS.gr;
  const colourFirst = LADDER_COLOUR_FIRST[language] ?? LADDER_COLOUR_FIRST.gr;
  const calmDay = LADDER_CALM_DAY[language] ?? LADDER_CALM_DAY.gr;

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] leading-snug text-slate-500">{doors}</p>
      <ol className="space-y-1">
        {rows.map(row => {
          const isPenalty = row.weight < 0;
          return (
            <li
              key={row.key}
              className="flex items-baseline justify-between gap-3 text-[11px] leading-snug"
            >
              <span className={`min-w-0 truncate font-bold ${isPenalty ? 'text-slate-500' : 'text-slate-700'}`}>
                {row.label}
              </span>
              <span
                className={`shrink-0 tabular-nums font-black ${isPenalty ? 'text-slate-400' : 'text-[#007a83]'}`}
              >
                {isPenalty ? row.weight : row.weight}
              </span>
            </li>
          );
        })}
      </ol>
      {isCalmDay && <p className="mt-2 text-[10px] leading-snug text-slate-500">{calmDay}</p>}
      <p className="mt-2 text-[10px] leading-snug text-slate-500">{colourFirst}</p>
    </div>
  );
};

export default TopPickLadderPanel;
