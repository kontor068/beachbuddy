import React from 'react';
import { Compass, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';
import type { ExposureLevel } from '../utils/windExposure';

/**
 * Meltemi seasonal shelter atlas (Tier-1 "now"). The dominant Aegean summer regime is
 * the Meltemi (N/NE), so "how does this cove behave when the meltemi blows" is the most
 * useful forward-looking, book-weeks-ahead signal — distinct from today's forecast. We
 * already derive each beach's N/NE behaviour from its coastline-orientation profile at
 * zero cost (summarizeMeltemiBehavior); here we surface this cove's seasonal label AND
 * rank the island's reliably-sheltered coves. Google can summarise the island-level
 * cliché ("go south in the meltemi") but cannot rank individual coves — that needs the
 * per-cove geometry. Endorsement ("usually sheltered") is reserved for genuinely
 * protected coves; partial/exposed get honest caution wording.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;
const beachSubject = (beachName: string, language: LanguageCode): string =>
  language === 'gr' ? `Η παραλία ${beachName}` : beachName;

export interface MeltemiShelteredCove {
  id: number;
  name: string;
  distanceKm: number;
}

const TITLE: Copy = {
  en: 'In the meltemi',
  gr: 'Στα μελτέμια',
  de: 'Beim Meltemi',
  it: 'Con il meltemi',
  fr: 'Pendant le meltemi',
};

const INTRO: Copy = {
  en: 'The meltemi is the dry N/NE wind that dominates Aegean summers — the single best guide to how a beach usually behaves from July to September.',
  gr: 'Το μελτέμι είναι ο ξηρός Β/ΒΑ άνεμος που κυριαρχεί το καλοκαίρι στο Αιγαίο — ο πιο αξιόπιστος οδηγός για το πώς συμπεριφέρεται συνήθως μια παραλία από τον Ιούλιο ως τον Σεπτέμβριο.',
  de: 'Der Meltemi ist der trockene N/NO-Wind, der die Ägäis-Sommer prägt — der beste Hinweis darauf, wie sich ein Strand von Juli bis September meist verhält.',
  it: "Il meltemi è il vento secco da N/NE che domina l'estate nell'Egeo — la guida migliore su come si comporta di solito una spiaggia da luglio a settembre.",
  fr: "Le meltemi est le vent sec de N/NE qui domine l'été en mer Égée — le meilleur indice du comportement habituel d'une plage de juillet à septembre.",
};

const SELF_STATUS: Record<ExposureLevel, Copy> = {
  protected: {
    en: 'usually stays sheltered when the meltemi blows.',
    gr: 'συνήθως μένει υπήνεμη όταν φυσά μελτέμι.',
    de: 'bleibt beim Meltemi meist windgeschützt.',
    it: 'di solito resta riparata quando soffia il meltemi.',
    fr: "reste généralement abritée quand le meltemi souffle.",
  },
  partial: {
    en: 'is partly exposed in the meltemi — calm some days, choppy on stronger ones.',
    gr: 'είναι μερικώς εκτεθειμένη στα μελτέμια — κάποιες μέρες ήρεμη, με κυματάκι όταν δυναμώνουν.',
    de: 'ist beim Meltemi teils exponiert — mal ruhig, bei stärkerem Wind kabbelig.',
    it: 'è in parte esposta al meltemi — calma certi giorni, mossa nei più forti.',
    fr: "est en partie exposée au meltemi — calme certains jours, agitée par vent fort.",
  },
  exposed: {
    en: 'is exposed in the meltemi — often choppy on summer N/NE days.',
    gr: 'είναι εκτεθειμένη στα μελτέμια — συχνά με κύμα τις καλοκαιρινές Β/ΒΑ μέρες.',
    de: 'ist beim Meltemi exponiert — an N/NO-Sommertagen oft kabbelig.',
    it: 'è esposta al meltemi — spesso mossa nelle giornate estive da N/NE.',
    fr: "est exposée au meltemi — souvent agitée les jours d'été de N/NE.",
  },
};

const SHELTERED_LIST_TITLE: Copy = {
  en: 'Coves here that stay calm in the meltemi',
  gr: 'Σταθερά υπήνεμες παραλίες εδώ στα μελτέμια',
  de: 'Buchten hier, die beim Meltemi ruhig bleiben',
  it: 'Cale qui che restano calme con il meltemi',
  fr: 'Criques ici qui restent calmes au meltemi',
};

const AWAY: Copy = {
  en: 'away',
  gr: 'μακριά',
  de: 'entfernt',
  it: 'di distanza',
  fr: 'de distance',
};

const SOURCE_NOTE: Copy = {
  en: 'Based on each cove’s coastline orientation to the N/NE — a seasonal guide, not today’s forecast.',
  gr: 'Βάσει του προσανατολισμού της ακτής κάθε όρμου στον Β/ΒΑ — εποχικός οδηγός, όχι η σημερινή πρόγνωση.',
  de: 'Basierend auf der N/NO-Ausrichtung jeder Bucht — ein saisonaler Hinweis, keine heutige Vorhersage.',
  it: "In base all'orientamento della costa di ogni cala verso N/NE — una guida stagionale, non la previsione di oggi.",
  fr: "D'après l'orientation de chaque crique vers le N/NE — un repère saisonnier, pas la prévision du jour.",
};

const SELF_TONE: Record<ExposureLevel, { badge: string; text: string }> = {
  protected: { badge: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
  partial: { badge: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  exposed: { badge: 'bg-orange-50 border-orange-200', text: 'text-orange-800' },
};

interface MeltemiShelterSectionProps {
  language: LanguageCode;
  beachName: string;
  thisExposure?: ExposureLevel;
  shelteredCoves: MeltemiShelteredCove[];
  onSelect: (id: number) => void;
}

export const MeltemiShelterSection: React.FC<MeltemiShelterSectionProps> = ({
  language,
  beachName,
  thisExposure,
  shelteredCoves,
  onSelect,
}) => {
  if (!thisExposure && shelteredCoves.length === 0) return null;

  return (
    <section className="space-y-3" data-nosnippet="true">
      <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
        <Compass className="h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
        {pick(TITLE, language)}
      </h3>

      <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3.5">
        <p className="text-sm leading-relaxed text-slate-600">{pick(INTRO, language)}</p>

        {thisExposure && (
          <p className={`rounded-xl border px-3 py-2 text-sm font-semibold leading-relaxed ${SELF_TONE[thisExposure].badge} ${SELF_TONE[thisExposure].text}`}>
            {beachSubject(beachName, language)} {pick(SELF_STATUS[thisExposure], language)}
          </p>
        )}

        {shelteredCoves.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {pick(SHELTERED_LIST_TITLE, language)}
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

        <p className="text-[11px] italic leading-relaxed text-slate-500">{pick(SOURCE_NOTE, language)}</p>
      </div>
    </section>
  );
};
