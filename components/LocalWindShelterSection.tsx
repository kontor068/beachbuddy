import React from 'react';
import { Compass, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';
import type { ExposureLevel } from '../utils/windExposure';
import { beachSentenceName } from '../utils/beachCopy';
import { LOCAL_WIND_SECTION } from '../utils/localWindContext.mjs';

/**
 * Local-summer-wind seasonal shelter atlas (Tier-1 "now"). Every region's copy is
 * regime-specific via `windContext` (meltemi in the Aegean, maistros in the Ionian,
 * the afternoon summer wind on the Thermaic Gulf) — the same single source
 * (utils/localWindContext.mjs) that drives region/intent pages. "How does this cove
 * behave when the local wind blows" is the most useful forward-looking, book-weeks-
 * ahead signal — distinct from today's forecast. Endorsement ("usually sheltered")
 * is reserved for genuinely protected coves; partial/exposed get honest caution.
 */

type LocalWindContext = 'aegean' | 'ionian' | 'thermaic';
type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;
// Boat-only spots (e.g. Kleftiko) aren't "beaches" — use the bare name, and in Greek the neuter
// article "Το" (which then needs the neuter statusBoatGr predicates to agree).
const beachSubject = (beachName: string, language: LanguageCode, isBoatAccess: boolean): string => {
  if (isBoatAccess) return language === 'gr' ? `Το ${beachName}` : beachName;
  return language === 'gr' ? `Η παραλία ${beachSentenceName(beachName, 'gr')}` : beachName;
};

export interface LocalWindShelteredCove {
  id: number;
  name: string;
  distanceKm: number;
}

const AWAY: Copy = {
  en: 'away',
  gr: 'μακριά',
  de: 'entfernt',
  it: 'di distanza',
  fr: 'de distance',
};

const SELF_TONE: Record<ExposureLevel, { badge: string; text: string }> = {
  protected: { badge: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
  partial: { badge: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  exposed: { badge: 'bg-orange-50 border-orange-200', text: 'text-orange-800' },
};

interface LocalWindShelterSectionProps {
  language: LanguageCode;
  windContext: LocalWindContext;
  beachName: string;
  thisExposure?: ExposureLevel;
  shelteredCoves: LocalWindShelteredCove[];
  onSelect: (id: number) => void;
  isBoatAccess?: boolean;
}

export const LocalWindShelterSection: React.FC<LocalWindShelterSectionProps> = ({
  language,
  windContext,
  beachName,
  thisExposure,
  shelteredCoves,
  onSelect,
  isBoatAccess = false,
}) => {
  if (!thisExposure && shelteredCoves.length === 0) return null;
  const copy = LOCAL_WIND_SECTION[windContext] || LOCAL_WIND_SECTION.aegean;

  return (
    <section className="space-y-3" data-nosnippet="true">
      <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
        <Compass className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
        {pick(copy.title, language)}
      </h3>

      <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3.5">
        {/* THIS beach first, the wind lesson after. `intro` is a definition of the local
            summer wind — the same three lines on every beach of the region — and it used to
            open the section, so the one sentence that is about the beach you are looking at
            sat underneath a paragraph you had already read on the previous beach. The
            definition still belongs here (it is what makes "μελτέμι" mean something to a
            visitor), just as the footnote it is. */}
        {thisExposure && (
          <p className={`rounded-xl border px-3 py-2 text-sm font-semibold leading-relaxed ${SELF_TONE[thisExposure].badge} ${SELF_TONE[thisExposure].text}`}>
            {beachSubject(beachName, language, isBoatAccess)} {isBoatAccess && language === 'gr' ? copy.statusBoatGr[thisExposure] : pick(copy.status[thisExposure], language)}
          </p>
        )}

        <p className={`leading-relaxed ${thisExposure ? 'text-xs text-slate-500' : 'text-sm text-slate-600'}`}>{pick(copy.intro, language)}</p>

        {shelteredCoves.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {pick(copy.shelteredHeading, language)}
            </p>
            <ul className="space-y-1.5">
              {shelteredCoves.map(cove => (
                <li key={cove.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(cove.id)}
                    className="flex w-full items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-left transition-colors hover:bg-emerald-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{cove.name}</span>
                    <span className="flex-shrink-0 text-xs font-bold text-slate-500">
                      {cove.distanceKm.toFixed(1)} km {pick(AWAY, language)}
                    </span>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] italic leading-relaxed text-slate-500">{pick(copy.sourceNote, language)}</p>
      </div>
    </section>
  );
};
