import React, { startTransition, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Beach, LanguageCode, RecommendationConfidence, SimpleWindSuitability, SortOption, SwimmingComfort, Translation, WarningFlag, WindDirection } from '../types';
import { BeachCard } from './BeachCard';
import { BeachSearchEmptyState } from './BeachSearchEmptyState';
import { getSelectedDayPrefix } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';
import { ExposureLevel } from '../utils/windExposure';

type BeachListBeach = Beach & {
  exposureLevel?: ExposureLevel;
  canClaimWindProtection?: boolean;
  enclosedCove?: boolean;
  seaCalmClaimAllowed?: boolean;
  waveHeightM?: number;
  /** Decision-grade sea state (m) + period — see BeachScore.seaStateWaveM. */
  seaStateWaveM?: number;
  /** Modelled height at the sand (m) where utils/shoreWave speaks — see BeachScore. */
  shoreWaveHeightM?: number;
  shoreDisplayWaveM?: number;
  shoreWaveFromDepartingSea?: boolean;
  seaStatePeriodS?: number;
  windSpeedKmph?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  swimmingComfort?: SwimmingComfort;
  lessExposedToday?: boolean;
  windExposureReason?: string;
  simpleWindSuitability?: SimpleWindSuitability;
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
  selectedHour?: number;
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
  /**
   * The settled search text behind the current result set. Only used to tell a search
   * miss apart from a filter miss in the empty state — see the comment there.
   */
  searchQuery?: string;
  /** Runs the same whole-of-Greece search as pressing Enter in the search box. */
  onSearchAllRegions?: () => void;
  protectedSortNoResults?: boolean;
  protectedSortEmptyCopy?: {
    title: string;
    body: string;
  };
  strongWindContext?: boolean;
}

const noMoreAlternativesMessage = (language: LanguageCode, selectedDate?: Date): string => {
  const day = getSelectedDayPrefix(selectedDate, athensNow(), language);
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
  const day = getSelectedDayPrefix(selectedDate, athensNow(), language);
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
        title: `Aucune plage n’est recommandée pour se baigner ${day}.`,
        body: 'De la pluie est possible pendant les principales heures de plage. Nous ne recommandons aucune plage pour se baigner sur ce créneau.',
      },
      de: {
        title: `Kein Strand wird ${day} zum Schwimmen empfohlen.`,
        body: 'Wegen möglichen Regens während der wichtigsten Strandstunden empfehlen wir in diesem Zeitfenster keinen Strand zum Schwimmen.',
      },
      it: {
        title: `Nessuna spiaggia è consigliata per fare il bagno ${day}.`,
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

/** Cards painted in the first React pass — roughly two phone screens. */
const FIRST_WAVE = 12;

/**
 * A region page can hold 133 cards and BeachCard is a heavy component. Building the whole
 * grid in one React pass measured 400-700ms of blocked main thread on a throttled phone,
 * on top of the app's own ~1.6s boot: for those seconds a tap or a scroll does nothing and
 * the page feels stuck. `content-visibility` on `.beach-grid-deferred > *` already skips
 * PAINT for off-screen cards, but React still builds every one of them — that is the part
 * that blocks.
 *
 * So the grid arrives in two waves: a screenful immediately, the rest as a low-priority
 * update the browser is allowed to interrupt for a tap or a scroll. Nothing is hidden from
 * search engines — a region page's crawlable copy is written by scripts/prerenderBeachPages
 * and ships zero `.beach-card` in its HTML, so this grid is visitors-only.
 *
 * The wave is skipped when the visitor has already scrolled into the list: shrinking a list
 * under someone's thumb would yank the page, and down there the render cost is already paid.
 */
const useWaveRender = (total: number): number => {
  const [rendered, setRendered] = useState(() => Math.min(total, FIRST_WAVE));

  useEffect(() => {
    if (total <= FIRST_WAVE) {
      setRendered(total);
      return;
    }

    const scrolledIntoList = typeof window !== 'undefined' && window.scrollY > 400;
    if (scrolledIntoList) {
      setRendered(total);
      return;
    }

    setRendered(Math.min(total, FIRST_WAVE));

    let cancelled = false;
    const release = () => {
      if (cancelled) return;
      // startTransition: React may abandon this render half-way to answer a tap.
      startTransition(() => setRendered(total));
    };

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const handle = w.requestIdleCallback(release, { timeout: 500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(handle);
      };
    }
    const timer = window.setTimeout(release, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [total]);

  return Math.min(rendered, total);
};

export const BeachList: React.FC<BeachListProps> = ({
  beaches,
  language,
  t,
  windSpeed,
  waveHeightM,
  temperature,
  selectedDate,
  selectedHour,
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
  searchQuery = '',
  onSearchAllRegions,
  protectedSortNoResults = false,
  protectedSortEmptyCopy,
  strongWindContext = false
}) => {
  const renderedCount = useWaveRender(beaches.length);

  if (beaches.length === 0) {
    if (severeWeatherNoSwimming) {
      const message = noSwimmingMessage(language, selectedDate, noSwimmingReason);

      return (
        <div role="status" className="col-span-full rounded-3xl border border-amber-200/80 bg-amber-50 px-5 py-8 text-left shadow-sm shadow-amber-900/5 ring-1 ring-white/45 dark:border-amber-900/50 dark:bg-amber-950/95">
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
      // The card itself lives in BeachSearchEmptyState so the forecast home renders the
      // exact same words — see the note at the top of that file for why that matters.
      return (
        <BeachSearchEmptyState
          language={language}
          t={t}
          searchQuery={searchQuery}
          onSearchAllRegions={onSearchAllRegions}
          onClearSearchAndFilters={onClearSearchAndFilters}
          protectedSortNoResults={protectedSortNoResults}
          protectedSortEmptyCopy={protectedSortEmptyCopy}
        />
      );
    }

    const emptyMessage = sortBy === 'recommended' && hasShownAlternativeRecommendations
      ? noMoreAlternativesMessage(language, selectedDate)
      : sortBy === 'recommended'
      ? t.noWeatherRecommendedBeaches
      : t.noShelteredBeaches;

    return (
      <div className="col-span-full text-center py-20 glass dark:glass-dark rounded-3xl">
        <p className="text-slate-700 dark:text-slate-600 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="beach-grid-deferred grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
      {beaches.slice(0, renderedCount).map((b) => {
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
              beachWindSpeedKmph={b.windSpeedKmph}
              temperature={temperature}
              selectedDate={selectedDate}
              selectedHour={selectedHour}
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
              seaStateWaveM={b.seaStateWaveM}
              shoreWaveHeightM={b.shoreWaveHeightM}
              shoreDisplayWaveM={b.shoreDisplayWaveM}
              shoreWaveFromDepartingSea={b.shoreWaveFromDepartingSea}
              seaStatePeriodS={b.seaStatePeriodS}
              warnings={b.warnings}
              confidence={b.confidence}
              swimmingComfort={b.swimmingComfort}
              canClaimWindProtection={isProtected}
              enclosedCove={b.enclosedCove}
              seaCalmClaimAllowed={b.seaCalmClaimAllowed}
              strongWindContext={strongWindContext}
              lessExposedToday={b.lessExposedToday}
              windSuitabilityText={b.windExposureReason}
              windSuitabilityColor={b.simpleWindSuitability?.suitabilityColor}
            />
          </div>
        );
      })}
    </div>
  );
};
