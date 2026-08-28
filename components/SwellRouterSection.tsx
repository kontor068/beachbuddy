import React from 'react';
import { Waves, ShieldCheck, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';
import type { SwellExposure } from '../utils/swellExposure';

/**
 * Swell-window cove router (Tier-2). On a calm-wind day a long-period Atlantic ground swell
 * can still be breaking — and whether it reaches THIS cove is pure geometry (swell direction
 * × coastline orientation). Google's marine widget reports one cell-level swell arrow for the
 * whole sea and has no model of which way a cove faces, so it physically cannot say "swell
 * 270°/9 s, but this east-facing pocket stays flat". We can. This surfaces ONLY on genuine
 * ground swell (assessSwellExposure.meaningful), so it's a strict no-op on the short-period
 * wind-sea of a normal Aegean summer day. It either warns that this cove is secretly breaking
 * despite the calm wind, or reassures it's sheltered — and routes the user to coves still flat.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

export interface SwellShelteredCove {
  id: number;
  name: string;
  distanceKm: number;
}

const TITLE_EXPOSED: Copy = {
  en: 'Hidden swell',
  gr: 'Κρυφός κυματισμός',
  de: 'Verborgene Dünung',
  it: 'Onda lunga nascosta',
  fr: 'Houle cachée',
};
const TITLE_SHELTERED: Copy = {
  en: 'Sheltered from the swell',
  gr: 'Προστατευμένη από τον κυματισμό',
  de: 'Vor der Dünung geschützt',
  it: 'Riparata dall’onda lunga',
  fr: 'Abritée de la houle',
};

/**
 * `from` is the COMPLETE origin phrase («από τα βόρεια», "from the north", "de l'est"), built by
 * utils/weatherNowCopy.directionFromPhrase — not a bare compass word. It used to be
 * `t.windDirections[...]` dropped into «από τα ${dir}», which printed «από τα Βόρειος»: the wind
 * tables hold a masculine adjective for «άνεμος», and no template can decline it into a direction.
 */
const bodyExposed = (beachName: string, h: string, p: number, from: string, calmWind: boolean, language: LanguageCode): string => {
  const calm = {
    en: calmWind ? 'The wind is calm, but ' : '',
    gr: calmWind ? 'Ο άνεμος είναι ήσυχος, αλλά ' : '',
    de: calmWind ? 'Der Wind ist ruhig, aber ' : '',
    it: calmWind ? 'Il vento è calmo, ma ' : '',
    fr: calmWind ? 'Le vent est calme, mais ' : '',
  }[language];
  return {
    en: `${calm}a ~${h} m, ${p}s ground swell is rolling in ${from}. This cove faces it — expect breaking sets despite the light wind.`,
    gr: `${calm}φτάνει εδαφικός κυματισμός ~${h} m, ${p}s ${from}. Αυτός ο όρμος είναι εκτεθειμένος — περίμενε «σπασίματα» παρά τον ελαφρύ αέρα.`,
    de: `${calm}eine ~${h} m, ${p}s Grunddünung kommt ${from}. Diese Bucht ist ihr zugewandt — trotz wenig Wind sind Brecher zu erwarten.`,
    it: `${calm}arriva un'onda lunga di ~${h} m, ${p}s ${from}. Questa cala le è esposta — aspettati frangenti nonostante il vento leggero.`,
    fr: `${calm}une houle de fond de ~${h} m, ${p}s arrive ${from}. Cette crique y est exposée — attendez-vous à des déferlantes malgré le vent faible.`,
  }[language];
};

const bodySheltered = (beachName: string, h: string, p: number, from: string, language: LanguageCode): string => ({
  en: `There's a ~${h} m, ${p}s ground swell ${from} today, but this cove faces away from it — it stays flat. A good pick today.`,
  gr: `Σήμερα έχει εδαφικό κυματισμό ~${h} m, ${p}s ${from}, αλλά αυτός ο όρμος είναι στραμμένος αλλιώς — μένει επίπεδος. Καλή επιλογή σήμερα.`,
  de: `Heute läuft eine ~${h} m, ${p}s Grunddünung ${from}, doch diese Bucht ist abgewandt — sie bleibt flach. Heute eine gute Wahl.`,
  it: `Oggi c'è un'onda lunga di ~${h} m, ${p}s ${from}, ma questa cala è rivolta altrove — resta piatta. Buona scelta oggi.`,
  fr: `Il y a aujourd'hui une houle de ~${h} m, ${p}s ${from}, mais cette crique est orientée à l'écart — elle reste plate. Bon choix aujourd'hui.`,
}[language]);

const SHELTERED_LIST_TITLE: Copy = {
  en: "Coves still flat in today's swell",
  gr: 'Όρμοι με επίπεδη θάλασσα σήμερα',
  de: 'Buchten, die in der Dünung flach bleiben',
  it: "Cale ancora piatte con l'onda di oggi",
  fr: "Criques encore plates dans la houle du jour",
};

const AWAY: Copy = {
  en: 'away', gr: 'μακριά', de: 'entfernt', it: 'di distanza', fr: 'de distance',
};

const SOURCE_NOTE: Copy = {
  en: 'Based on swell direction × coastline orientation (estimate).',
  gr: 'Βάσει κατεύθυνσης κυματισμού × προσανατολισμού ακτής (εκτίμηση).',
  de: 'Basierend auf Dünungsrichtung × Küstenausrichtung (Schätzung).',
  it: "In base a direzione dell'onda × orientamento della costa (stima).",
  fr: "D'après la direction de la houle × l'orientation de la côte (estimation).",
};

interface SwellRouterSectionProps {
  language: LanguageCode;
  beachName: string;
  swell: SwellExposure;
  swellFromLabel: string;
  windBeaufort: number;
  shelteredCoves: SwellShelteredCove[];
  onSelect: (id: number) => void;
}

export const SwellRouterSection: React.FC<SwellRouterSectionProps> = ({
  language,
  beachName,
  swell,
  swellFromLabel,
  windBeaufort,
  shelteredCoves,
  onSelect,
}) => {
  // Strict no-op unless there's a genuine long-period ground swell to talk about.
  if (!swell.meaningful) return null;

  const h = swell.heightM.toFixed(1);
  const p = Math.round(swell.periodS ?? 0);
  const exposed = swell.exposed;

  return (
    <section className="space-y-3" data-nosnippet="true">
      <div className={`flex items-start gap-3 rounded-surface border px-4 py-3.5 shadow-surface ${exposed ? 'border-orange-200 bg-orange-50/70 shadow-orange-900/5' : 'border-emerald-200 bg-emerald-50/60 shadow-emerald-900/5'}`}>
        <div className={`shrink-0 rounded-control p-2.5 text-white shadow-surface ${exposed ? 'bg-orange-500' : 'bg-emerald-500'}`}>
          {exposed ? <Waves className="h-5 w-5" aria-hidden /> : <ShieldCheck className="h-5 w-5" aria-hidden />}
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className={`font-bold ${exposed ? 'text-orange-950' : 'text-emerald-950'}`}>
            {pick(exposed ? TITLE_EXPOSED : TITLE_SHELTERED, language)}
          </h3>
          <p className={`text-sm font-medium leading-relaxed ${exposed ? 'text-orange-900' : 'text-emerald-900'}`}>
            {exposed
              ? bodyExposed(beachName, h, p, swellFromLabel, windBeaufort <= 3, language)
              : bodySheltered(beachName, h, p, swellFromLabel, language)}
          </p>
        </div>
      </div>

      {exposed && shelteredCoves.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {pick(SHELTERED_LIST_TITLE, language)}
          </p>
          <ul className="space-y-1.5">
            {shelteredCoves.map(cove => (
              <li key={cove.id}>
                <button
                  type="button"
                  onClick={() => onSelect(cove.id)}
                  className="flex w-full items-center gap-2 rounded-control border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-left transition-colors hover:bg-emerald-50"
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

      <p className="px-1 text-[11px] italic leading-relaxed text-slate-500">{pick(SOURCE_NOTE, language)}</p>
    </section>
  );
};
