import React from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { BeachCard } from './BeachCard';
import { LanguageCode, Translation, SuitableBeach, Beach } from '../types';
import { describeSimpleWindSuitability } from '../utils/windExposureCopy';

/**
 * Saved Beaches screen (Tier-1 "now"). A persistent, one-tap home for "my coves — do they
 * work today?". Each saved beach in the active island is rendered with the SAME today
 * verdict the home cards use (reusing BeachCard + the scored SuitableBeach), so the user
 * scans calm/rough at a glance instead of opening each one. Google has no per-user list of
 * obscure coves it re-evaluates daily against per-cove shelter geometry. Saved beaches in
 * other (not-currently-loaded) islands are surfaced as an honest count, since we only show
 * a verdict when we actually hold that island's forecast.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Saved beaches',
  gr: 'Αποθηκευμένες παραλίες',
  de: 'Gespeicherte Strände',
  it: 'Spiagge salvate',
  fr: 'Plages enregistrées',
};

const SUBTITLE: Copy = {
  en: "Today's conditions for your coves, at a glance.",
  gr: 'Οι σημερινές συνθήκες στους όρμους σου, με μια ματιά.',
  de: 'Die heutigen Bedingungen deiner Buchten auf einen Blick.',
  it: 'Le condizioni di oggi delle tue cale, a colpo d’occhio.',
  fr: "Les conditions du jour de vos criques, en un coup d'œil.",
};

const EMPTY: Copy = {
  en: 'No saved beaches yet. Tap the heart on a beach to add it here.',
  gr: 'Δεν έχεις αποθηκεύσει παραλίες ακόμη. Πάτησε την καρδιά σε μια παραλία για να την προσθέσεις εδώ.',
  de: 'Noch keine gespeicherten Strände. Tippe auf das Herz eines Strandes, um ihn hinzuzufügen.',
  it: 'Nessuna spiaggia salvata. Tocca il cuore su una spiaggia per aggiungerla qui.',
  fr: "Aucune plage enregistrée. Touchez le cœur d'une plage pour l'ajouter ici.",
};

const BACK: Copy = {
  en: 'Back',
  gr: 'Πίσω',
  de: 'Zurück',
  it: 'Indietro',
  fr: 'Retour',
};

const otherIslandsNote = (count: number, language: LanguageCode): string => ({
  en: `+${count} saved on other islands. Open that island to see today's conditions for them.`,
  gr: `+${count} αποθηκευμένες σε άλλα νησιά. Άνοιξε το αντίστοιχο νησί για να δεις τις σημερινές συνθήκες τους.`,
  de: `+${count} auf anderen Inseln gespeichert. Öffne die jeweilige Insel, um ihre heutigen Bedingungen zu sehen.`,
  it: `+${count} salvate in altre isole. Apri quell'isola per vederne le condizioni di oggi.`,
  fr: `+${count} enregistrées sur d'autres îles. Ouvrez l'île concernée pour voir leurs conditions du jour.`,
}[language]);

interface SavedBeachesScreenProps {
  language: LanguageCode;
  t: Translation;
  items: SuitableBeach[];
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  onOpenBeach: (beach: Beach) => void;
  onClose: () => void;
  selectedDate?: Date;
  selectedHour?: number;
  windSpeed?: number;
  temperature?: number;
  islandName: string;
  regionId?: string;
  otherIslandsCount: number;
}

export const SavedBeachesScreen: React.FC<SavedBeachesScreenProps> = ({
  language,
  t,
  items,
  favorites,
  onToggleFavorite,
  onOpenBeach,
  onClose,
  selectedDate,
  selectedHour,
  windSpeed = 0,
  temperature,
  islandName,
  regionId,
  otherIslandsCount,
}) => {
  const isEmpty = items.length === 0 && otherIslandsCount === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label={pick(BACK, language)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-700 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-slate-950">
              <Heart className="h-5 w-5 flex-shrink-0 fill-rose-500 text-rose-500" aria-hidden="true" />
              {pick(TITLE, language)}
            </h1>
            <p className="truncate text-xs font-semibold text-slate-600">{pick(SUBTITLE, language)}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        {isEmpty ? (
          <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white/70 px-6 py-12 text-center">
            <Heart className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">{pick(EMPTY, language)}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 sm:gap-6">
                {items.map(item => (
                  <BeachCard
                    key={item.beach.id}
                    beach={{ ...item.beach, distance: item.distance }}
                    isExposed={item.isExposed}
                    language={language}
                    t={t}
                    isCalm={item.seaCalmClaimAllowed === true}
                    windSpeed={windSpeed}
                    temperature={temperature}
                    waveHeightM={item.waveHeightM}
                    favorites={favorites}
                    onToggleFavorite={onToggleFavorite}
                    islandName={islandName}
                    regionId={regionId}
                    onClick={() => onOpenBeach(item.beach)}
                    todayScore={item.score}
                    selectedDate={selectedDate}
                    selectedHour={selectedHour}
                    exposureLevel={item.exposureLevel}
                    warnings={item.warnings}
                    confidence={item.confidence}
                    swimmingComfort={item.swimmingComfort}
                    canClaimWindProtection={item.canClaimWindProtection}
                    seaCalmClaimAllowed={item.seaCalmClaimAllowed}
                    bestBeachTime={item.bestBeachTime}
                    windSuitabilityText={describeSimpleWindSuitability(item.simpleWindSuitability, language)}
                    windSuitabilityColor={item.simpleWindSuitability?.suitabilityColor}
                    forceTodayScoreBadge
                  />
                ))}
              </div>
            )}

            {otherIslandsCount > 0 && (
              <p className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-center text-sm font-semibold leading-relaxed text-slate-600">
                {otherIslandsNote(otherIslandsCount, language)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
