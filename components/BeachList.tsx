import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Beach, LanguageCode, RecommendationConfidence, SortOption, SwimmingComfort, Translation, WarningFlag, WindDirection } from '../types';
import { BeachCard } from './BeachCard';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { ExposureLevel } from '../utils/windExposure';

type BeachListBeach = Beach & {
  exposureLevel?: ExposureLevel;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
  waveHeightM?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  swimmingComfort?: SwimmingComfort;
  lessExposedToday?: boolean;
};

interface BeachListProps {
  beaches: BeachListBeach[];
  language: LanguageCode;
  t: Translation;
  windSpeed: number;
  windDirection: WindDirection;
  waveHeightM?: number;
  temperature?: number;
  selectedDate?: Date;
  islandName: string;
  regionId?: string;
  onBeachClick: (beach: Beach) => void;
  favorites: number[];
  onToggleFavorite: (beachId: number) => void;
  sortBy: SortOption;
  hasShownAlternativeRecommendations: boolean;
  severeWeatherNoSwimming?: boolean;
  noSwimmingReason?: 'rain' | 'conditions';
  hasActiveSearchOrFilters?: boolean;
  onClearSearchAndFilters?: () => void;
  protectedSortNoResults?: boolean;
  protectedSortEmptyCopy?: {
    title: string;
    body: string;
  };
  strongWindContext?: boolean;
}

const noMoreAlternativesMessage = (language: LanguageCode, selectedDate?: Date): string => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  const messages: Record<LanguageCode, string> = {
    en: `No more alternative beaches were found ${day}.`,
    gr: `Δεν βρέθηκαν περισσότερες εναλλακτικές παραλίες ${day}.`,
    fr: 'Aucune autre plage alternative n’a été trouvée.',
    de: 'Keine weiteren alternativen Strände gefunden.',
    it: 'Non sono state trovate altre spiagge alternative.',
  };
  return messages[language];
};

const noSwimmingMessage = (
  language: LanguageCode,
  selectedDate?: Date,
  reason: 'rain' | 'conditions' = 'conditions'
): { title: string; body: string } => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  if (reason === 'rain') {
    const rainMessages: Record<LanguageCode, { title: string; body: string }> = {
      en: {
        title: `No beach is recommended for swimming ${day}.`,
        body: 'Because rain is possible during the main beach hours, we do not recommend any beach for swimming in that window. Check again for a drier part of the day.',
      },
      gr: {
        title: `Δεν προτείνεται καμία παραλία για μπάνιο ${day}.`,
        body: 'Λόγω πιθανής βροχής στις βασικές ώρες παραλίας, δεν προτείνεται καμία παραλία για μπάνιο σε αυτό το διάστημα. Δες ξανά την πρόγνωση για πιο στεγνή ώρα.',
      },
      fr: {
        title: `Aucune plage n est recommandee pour se baigner ${day}.`,
        body: 'De la pluie est possible pendant les principales heures de plage. Nous ne recommandons aucune plage pour se baigner sur ce creneau.',
      },
      de: {
        title: `Kein Strand wird ${day} zum Schwimmen empfohlen.`,
        body: 'Wegen moglichen Regens wahrend der wichtigsten Strandstunden empfehlen wir in diesem Zeitfenster keinen Strand zum Schwimmen.',
      },
      it: {
        title: `Nessuna spiaggia e consigliata per fare il bagno ${day}.`,
        body: 'Per possibile pioggia nelle principali ore da spiaggia, non consigliamo alcuna spiaggia per nuotare in quella finestra.',
      },
    };
    if (language === 'gr') {
      return {
        title: `Δεν προτείνεται καμία παραλία για μπάνιο ${day}.`,
        body: 'Η πρόγνωση δείχνει βροχή στις βασικές ώρες παραλίας, οπότε δεν προτείνεται μπάνιο σε αυτό το διάστημα. Δες ξανά την πρόγνωση για πιο στεγνή ώρα.',
      };
    }

    return rainMessages[language];
  }

  const messages: Record<LanguageCode, { title: string; body: string }> = {
    en: {
      title: `No beach looks good for swimming ${day}.`,
      body: `Wind, waves, or bad weather make the sea uncomfortable ${day}. Choose another activity and check the forecast again later.`,
    },
    gr: {
      title: `Καμία παραλία δεν είναι καλή για μπάνιο ${day}.`,
      body: `Ο άνεμος, το κύμα ή η κακοκαιρία κάνουν τη θάλασσα ακατάλληλη ${day}. Καλύτερα διάλεξε άλλη δραστηριότητα και ξαναδές την πρόγνωση αργότερα.`,
    },
    fr: {
      title: `Aucune plage ne semble bonne pour se baigner ${day}.`,
      body: 'Le vent, les vagues ou le mauvais temps rendent la mer inconfortable aujourd’hui. Choisissez une autre activité et vérifiez à nouveau la météo plus tard.',
    },
    de: {
      title: `Kein Strand eignet sich ${day} gut zum Schwimmen.`,
      body: 'Wind, Wellen oder schlechtes Wetter machen das Meer heute unangenehm. Wähle lieber eine andere Aktivität und prüfe die Vorhersage später erneut.',
    },
    it: {
      title: `Nessuna spiaggia sembra adatta per fare il bagno ${day}.`,
      body: 'Vento, onde o maltempo rendono il mare poco adatto oggi. Scegli un’altra attività e ricontrolla le previsioni più tardi.',
    },
  };
  return messages[language];
};

export const BeachList: React.FC<BeachListProps> = ({
  beaches,
  language,
  t,
  windSpeed,
  waveHeightM,
  temperature,
  selectedDate,
  islandName,
  regionId,
  onBeachClick,
  favorites,
  onToggleFavorite,
  sortBy,
  hasShownAlternativeRecommendations,
  severeWeatherNoSwimming = false,
  noSwimmingReason = 'conditions',
  hasActiveSearchOrFilters = false,
  onClearSearchAndFilters,
  protectedSortNoResults = false,
  protectedSortEmptyCopy,
  strongWindContext = false
}) => {
  if (beaches.length === 0) {
    if (severeWeatherNoSwimming) {
      const message = noSwimmingMessage(language, selectedDate, noSwimmingReason);

      return (
        <div role="status" className="col-span-full rounded-3xl border border-amber-200/80 bg-amber-50/90 px-5 py-8 text-left shadow-sm shadow-amber-900/5 ring-1 ring-white/45 backdrop-blur-xl dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/75 text-amber-700 shadow-sm ring-1 ring-amber-100 dark:bg-slate-900/55 dark:text-amber-300 dark:ring-amber-900/40">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-lg font-black leading-snug text-amber-950 dark:text-amber-100">
                {message.title}
              </p>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                {message.body}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (hasActiveSearchOrFilters) {
      const protectedSortMessage = language === 'gr'
        ? {
          title: 'Δεν βρέθηκαν αρκετές κατάλληλες επιλογές.',
          body: 'Δεν βρέθηκαν αρκετές κατάλληλες επιλογές με τα διαθέσιμα δεδομένα. Δοκίμασε να γυρίσεις στις Όλες.',
        }
        : {
          title: 'Not enough suitable options were found.',
          body: 'Not enough suitable options were found with the available data. Try returning to All.',
        };
      const sortMessage = protectedSortEmptyCopy ?? protectedSortMessage;

      return (
        <div role="status" className="col-span-full rounded-3xl border border-white/60 bg-white/72 px-5 py-12 text-center shadow-sm ring-1 ring-white/35 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/50">
          <p className="font-heading text-lg font-black text-slate-800 dark:text-slate-100">
            {protectedSortNoResults ? sortMessage.title : t.beachSearchFilters.emptyTitle}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {protectedSortNoResults ? sortMessage.body : t.beachSearchFilters.emptyDescription}
          </p>
          {onClearSearchAndFilters && (
            <button
              type="button"
              onClick={onClearSearchAndFilters}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
            >
              {t.beachSearchFilters.clearAll}
            </button>
          )}
        </div>
      );
    }

    const emptyMessage = sortBy === 'recommended' && hasShownAlternativeRecommendations
      ? noMoreAlternativesMessage(language, selectedDate)
      : sortBy === 'recommended'
      ? t.noWeatherRecommendedBeaches
      : t.noShelteredBeaches;

    return (
      <div className="col-span-full text-center py-20 glass dark:glass-dark rounded-3xl">
        <p className="text-slate-500 dark:text-slate-400 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
      {beaches.map((b) => {
        const isProtected = b.exposureLevel === 'protected' && b.canClaimWindProtection === true;
        const isExposed = b.exposureLevel ? b.exposureLevel !== 'protected' : true;
        
        return (
          <div
            key={b.id}
          >
            <BeachCard 
              beach={b} 
              language={language} 
              t={t} 
              windSpeed={windSpeed} 
              temperature={temperature}
              selectedDate={selectedDate}
              favorites={favorites} 
              onToggleFavorite={onToggleFavorite} 
              islandName={islandName} 
              regionId={regionId}
              isCalm={b.seaCalmClaimAllowed === true}
              isExposed={isExposed}
              onClick={() => onBeachClick(b)}
              crowdLevel={b.crowdLevel}
              exposureLevel={b.exposureLevel}
              waveHeightM={b.waveHeightM ?? waveHeightM}
              warnings={b.warnings}
              confidence={b.confidence}
              swimmingComfort={b.swimmingComfort}
              canClaimWindProtection={isProtected}
              seaCalmClaimAllowed={b.seaCalmClaimAllowed}
              strongWindContext={strongWindContext}
              lessExposedToday={b.lessExposedToday}
            />
          </div>
        );
      })}
    </div>
  );
};
