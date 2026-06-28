import React from 'react';
import { Navigation2, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';

/**
 * "Switch beach" — live leeward swap (Tier-2). When you're looking at a beach that is exposed
 * to today's wind, one tap names the nearest beach that is genuinely sheltered FROM today's
 * exact wind direction. This is the canonical real-time decision query Google suppresses
 * synthesis for: it requires fusing the live wind vector with each nearby cove's 8-sector
 * geometry, a per-cove fact that is on no web page. We only ever point at a beach whose own
 * assessment can claim wind protection today (same gate as the "πιο υπήνεμη επιλογή"
 * endorsement), so we never send someone to a beach that isn't actually calmer.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Calmer option nearby',
  gr: 'Πιο υπήνεμη επιλογή κοντά',
  de: 'Ruhigere Option in der Nähe',
  it: 'Opzione più riparata vicino',
  fr: 'Option plus abritée à proximité',
};

const body = (windFromLabel: string, targetName: string, km: string, language: LanguageCode): string => ({
  en: `It's exposed to the ${windFromLabel} wind here today. ${targetName} (${km} km) is sheltered from it — switch there.`,
  gr: `Εδώ είναι εκτεθειμένη στον ${windFromLabel} άνεμο σήμερα. Η ${targetName} (${km} km) είναι προστατευμένη από αυτόν — πήγαινε εκεί.`,
  de: `Hier heute dem ${windFromLabel}-Wind ausgesetzt. ${targetName} (${km} km) ist davor geschützt — wechsle dorthin.`,
  it: `Oggi qui è esposta al vento da ${windFromLabel}. ${targetName} (${km} km) ne è riparata — spostati lì.`,
  fr: `Exposée au vent de ${windFromLabel} ici aujourd'hui. ${targetName} (${km} km) en est abritée — changez pour celle-ci.`,
}[language]);

const CTA: Copy = {
  en: 'See it', gr: 'Δες την', de: 'Ansehen', it: 'Vedi', fr: 'Voir',
};

interface SwitchBeachCardProps {
  language: LanguageCode;
  targetName: string;
  distanceKm: number;
  windFromLabel: string;
  onOpen: () => void;
}

export const SwitchBeachCard: React.FC<SwitchBeachCardProps> = ({
  language,
  targetName,
  distanceKm,
  windFromLabel,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex w-full items-center gap-3 rounded-[1.5rem] border border-sky-200 bg-sky-50/70 px-4 py-3.5 text-left shadow-sm shadow-sky-900/5 transition-colors hover:bg-sky-50"
  >
    <div className="shrink-0 rounded-2xl bg-sky-600 p-2.5 text-white shadow-sm">
      <Navigation2 className="h-5 w-5" aria-hidden />
    </div>
    <div className="min-w-0 flex-1 space-y-0.5">
      <h3 className="font-bold text-sky-950">{pick(TITLE, language)}</h3>
      <p className="text-sm font-medium leading-relaxed text-sky-900">
        {body(windFromLabel, targetName, distanceKm.toFixed(1), language)}
      </p>
    </div>
    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-sky-700">
      {pick(CTA, language)}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </span>
  </button>
);
