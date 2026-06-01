import React, { useMemo, useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, MapPin, Wind, Waves, Thermometer,
  Clock, Trees, Utensils, Users,
  Navigation, Share2, Heart, ChevronRight, ThumbsUp, ThumbsDown, CheckCircle2, Sparkles,
  Camera, ExternalLink
} from 'lucide-react';
import {
  Beach, LanguageCode, Translation, WindDirection,
  ForecastItem, WeatherData, DailyForecast, UserPreferences, SwimmingComfort
} from '../types';
import {
  calculateBestBeachTime,
  getTopRecommendedBeaches,
  generateBeachExplanation as generateServiceBeachExplanation,
  calculateBeachScore
} from '../services/recommendationService';
import { degToCompass, calculateDistance, getBeaufortLevel, getWaveCondition } from '../utils/weatherUtils';
import { trackEvent, storeFeedback } from '../services/analyticsService';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import { TodayScoreBadge } from '../components/TodayScoreBadge';
import { generateBeachExplanation as generateUiBeachExplanation } from '../utils/beachExplanation';
import { generateBestTimeReason } from '../utils/beachCopy';
import {
  AmenityStatus,
  getAmenityChips,
  getAmenityDisclaimer,
  getAmenityStatusRows,
  shouldShowAmenityDisclaimer,
} from '../utils/amenities';
import { MapLoadBoundary } from '../components/MapLoadBoundary';
import { scrollToPageTop } from '../utils/scroll';
import { buildPhotoSuggestionUrl } from '../utils/photoContribution';
import { getSelectedDayPrefix } from '../utils/dateLabels';

// Lazy load map to avoid blocking main thread
const BeachMap = React.lazy(() => import('../components/BeachMap'));

import { getBeachPhotoLookup } from '../services/beachPhotos';

// Helper to convert ForecastItem to WeatherData for recommendation service
const forecastToWeather = (item: ForecastItem): WeatherData => ({
  wind: { speed: item.wind.speed, deg: item.wind.deg },
  weather: item.weather[0],
  main: { temp: item.main.temp }
});

type RecommendationTone = 'excellent' | 'good' | 'watch' | 'poor';
const getRecommendationTone = (score: number, seaScore: number, isExposed: boolean): RecommendationTone => {
  if (seaScore < 5 || score < 55) return 'poor';
  if (seaScore < 8 || isExposed || score < 75) return 'watch';
  if (score > 85) return 'excellent';
  return 'good';
};

const getDetailBadgeScore = (score: number, seaScore: number, isExposed: boolean): number => {
  if (seaScore >= 8) return Math.max(score, 76);
  if (!isExposed && seaScore >= 5) return Math.max(score, 50);
  return score;
};

const getRecommendationLabel = (tone: RecommendationTone, language: LanguageCode, selectedDate?: Date, windBeaufort?: number): string => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  if (language === 'gr') {
    const labels: Record<RecommendationTone, string> = {
      excellent: `Εξαιρετική επιλογή ${day}`,
      good: `Καλή επιλογή ${day}`,
      watch: windBeaufort === 5 ? 'Καλύτερη επιλογή για τον άνεμο' : `Με προσοχή ${day}`,
      poor: `Όχι ιδανική ${day}`,
    };
    return labels[tone];
  }

  const labels: Record<RecommendationTone, Record<LanguageCode, string>> = {
    excellent: { en: `Excellent ${day}`, gr: '', de: 'Ausgezeichnet', it: 'Eccellente', fr: 'Excellent' },
    good: { en: `Good ${day}`, gr: '', de: 'Gut', it: 'Buona scelta', fr: 'Bon choix' },
    watch: { en: windBeaufort === 5 ? 'Better wind option' : `Use caution ${day}`, gr: '', de: 'Bedingungen prüfen', it: 'Controlla condizioni', fr: 'A verifier' },
    poor: { en: `Not ideal ${day}`, gr: '', de: 'Nicht ideal', it: 'Non ideale', fr: 'Pas ideal' },
  };
  return labels[tone][language];
};

const detailPhotoPlaceholderCopy: Record<LanguageCode, { title: string; body: string }> = {
  en: {
    title: 'Photo coming soon',
    body: 'Until then, we show the key beach details.',
  },
  gr: {
    title: 'Φωτογραφία σύντομα',
    body: 'Μέχρι τότε, δείχνουμε τα βασικά στοιχεία της παραλίας.',
  },
  de: {
    title: 'Foto folgt bald',
    body: 'Bis dahin zeigen wir die wichtigsten Strandinfos.',
  },
  it: {
    title: 'Foto in arrivo',
    body: 'Nel frattempo mostriamo le informazioni essenziali.',
  },
  fr: {
    title: 'Photo bientôt disponible',
    body: 'En attendant, nous affichons les informations clés.',
  },
};

const BeachDetailPhotoPlaceholder: React.FC<{ beachName: string; language: LanguageCode }> = ({ beachName, language }) => {
  const copy = detailPhotoPlaceholderCopy[language] || detailPhotoPlaceholderCopy.en;

  return (
    <div
      className="relative aspect-[16/9] max-h-56 overflow-hidden rounded-[2rem] border border-cyan-100/80 bg-gradient-to-br from-cyan-50 via-sky-50 to-teal-50 shadow-sm shadow-sky-900/5"
      aria-label={`${copy.title}: ${beachName}`}
    >
      <div className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-cyan-200/40 blur-2xl" />
      <div className="absolute right-7 top-7 h-16 w-16 rounded-full border border-white/55 bg-white/34 shadow-inner shadow-white/40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.72),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.38),transparent_45%)]" />
      <div className="absolute left-0 right-0 top-[48%] h-px bg-cyan-200/35" />
      <svg className="absolute inset-x-0 bottom-0 h-full w-full text-cyan-300/58" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 112 C70 106 120 107 190 112 C260 117 320 116 400 110 L400 160 L0 160 Z" fill="currentColor" />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 h-full w-full text-sky-300/46" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 124 C60 116 120 119 190 124 C260 130 320 128 400 120 L400 160 L0 160 Z" fill="currentColor" />
      </svg>
      <svg className="absolute inset-x-0 bottom-0 h-full w-full text-white/88" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 138 C90 132 150 133 230 137 C300 141 350 138 400 134 L400 160 L0 160 Z" fill="currentColor" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-white/54 via-transparent to-white/12" />
      <div className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-2xl border border-cyan-100/90 bg-white/70 text-cyan-700 shadow-sm shadow-sky-900/10 backdrop-blur-md">
        <Waves className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-cyan-100/90 bg-white/78 p-3 shadow-sm shadow-sky-900/10 backdrop-blur-md">
        <p className="text-sm font-bold text-cyan-900">{copy.title}</p>
        <p className="mt-1 text-xs font-semibold leading-snug text-slate-600">{copy.body}</p>
      </div>
    </div>
  );
};

const photoContributionCopy: Record<LanguageCode, {
  title: string;
  body: string;
  button: string;
  buttonLabel: (beachName: string) => string;
}> = {
  en: {
    title: 'Have a photo of this beach?',
    body: 'Send us your own photo or a clearly licensed image. Nothing is published without review.',
    button: 'Suggest a photo',
    buttonLabel: (beachName) => `Suggest a photo for ${beachName}`,
  },
  gr: {
    title: 'Έχεις φωτογραφία αυτής της παραλίας;',
    body: 'Στείλε μας μια δική σου φωτογραφία ή μια εικόνα με ξεκάθαρη άδεια χρήσης. Δεν δημοσιεύεται τίποτα χωρίς έλεγχο.',
    button: 'Πρότεινε φωτογραφία',
    buttonLabel: (beachName) => `Πρότεινε φωτογραφία για την παραλία ${beachName}`,
  },
  de: {
    title: 'Hast du ein Foto von diesem Strand?',
    body: 'Sende uns dein eigenes Foto oder ein klar lizenziertes Bild. Nichts wird ohne Prüfung veröffentlicht.',
    button: 'Foto vorschlagen',
    buttonLabel: (beachName) => `Foto für ${beachName} vorschlagen`,
  },
  it: {
    title: 'Hai una foto di questa spiaggia?',
    body: 'Mandaci una tua foto o un’immagine con licenza chiara. Nulla viene pubblicato senza verifica.',
    button: 'Suggerisci una foto',
    buttonLabel: (beachName) => `Suggerisci una foto per ${beachName}`,
  },
  fr: {
    title: 'Vous avez une photo de cette plage ?',
    body: 'Envoyez votre propre photo ou une image avec une licence claire. Rien n’est publié sans vérification.',
    button: 'Proposer une photo',
    buttonLabel: (beachName) => `Proposer une photo pour ${beachName}`,
  },
};

const PhotoContributionPrompt: React.FC<{
  beachName: string;
  language: LanguageCode;
  suggestionUrl?: string;
  onClick?: () => void;
}> = ({ beachName, language, suggestionUrl, onClick }) => {
  const copy = photoContributionCopy[language] || photoContributionCopy.en;

  return (
    <div className="rounded-[1.5rem] border border-cyan-100/75 bg-white/82 p-3.5 shadow-sm shadow-sky-900/5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
          <Camera className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug text-slate-900">{copy.title}</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{copy.body}</p>
          {suggestionUrl && (
            <a
              href={suggestionUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={copy.buttonLabel(beachName)}
              onClick={onClick}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-100 bg-cyan-600 px-4 text-xs font-bold text-white shadow-sm shadow-cyan-200/70 transition-colors hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              {copy.button}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const getSeaConditionDisplay = (
  seaScore: number,
  isExposed: boolean,
  language: LanguageCode,
  selectedDate?: Date,
  canClaimWindProtection = false,
  seaCalmClaimAllowed = false,
  windBeaufort = 0,
  waveHeightM?: number
) => {
  const day = getSelectedDayPrefix(selectedDate, new Date(), language);
  if (windBeaufort === 5 && !isExposed) {
    return {
      value: { en: 'Better wind option', gr: 'Πιο υπήνεμη επιλογή', de: 'Besser geschutzt', it: 'Piu riparata', fr: 'Mieux abritee' }[language],
      subValue: { en: 'Better option for the wind.', gr: 'Καλύτερη επιλογή για τον άνεμο.', de: 'Besser geschutzte Stellen', it: 'Meglio punti piu riparati', fr: 'Prefere les coins abrites' }[language],
    };
  }

  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    if (waveHeightM >= 1.2) {
      return {
        value: { en: 'Rough sea', gr: 'Έντονος κυματισμός', de: 'Raue See', it: 'Mare mosso', fr: 'Mer agitee' }[language],
        subValue: isExposed
          ? windBeaufort === 5
            ? { en: 'Exposed to wind', gr: 'Εκτεθειμένη στον άνεμο', de: 'Nicht ideal zum entspannten Schwimmen', it: 'Non ideale per nuotare rilassati', fr: 'Pas ideal pour une baignade detendue' }[language]
            : { en: 'Not ideal for relaxed swimming', gr: 'Όχι ιδανικό για ήρεμο μπάνιο', de: 'Nicht ideal zum entspannten Schwimmen', it: 'Non ideale per nuotare rilassati', fr: 'Pas ideal pour une baignade detendue' }[language]
          : windBeaufort === 5
            ? { en: 'The sea will have waves.', gr: 'Η θάλασσα θα έχει κυματισμό.', de: 'Wellen erfordern Vorsicht', it: 'Serve cautela con le onde', fr: 'Prudence avec les vagues' }[language]
            : { en: 'Wave caution still matters', gr: 'Θέλει προσοχή στο κύμα', de: 'Wellen erfordern Vorsicht', it: 'Serve cautela con le onde', fr: 'Prudence avec les vagues' }[language],
      };
    }

    if (windBeaufort <= 3 && waveHeightM < 0.5) {
      return {
        value: { en: 'Manageable sea', gr: 'Ήπια θάλασσα', de: 'Handhabbare See', it: 'Mare gestibile', fr: 'Mer gerable' }[language],
        subValue: isExposed
          ? { en: `This beach is more exposed, but the wind is light ${day}.`, gr: `Η παραλία είναι πιο εκτεθειμένη, αλλά ${day} ο άνεμος είναι ήπιος.`, de: 'Dieser Strand ist offener, aber der Wind ist heute leicht.', it: 'Questa spiaggia e piu esposta, ma oggi il vento e leggero.', fr: 'Cette plage est plus exposee, mais le vent est faible aujourd hui.' }[language]
          : { en: `Wind should not be a major issue ${day}.`, gr: `Ο άνεμος δεν φαίνεται να είναι πρόβλημα ${day}.`, de: 'Wind sollte heute kein Hauptproblem sein.', it: 'Il vento non dovrebbe essere un problema oggi.', fr: 'Le vent ne devrait pas etre un probleme aujourd hui.' }[language],
      };
    }

    if (windBeaufort <= 3 && waveHeightM < 0.8) {
      return {
        value: { en: `Some chop ${day}`, gr: 'Λίγος κυματισμός', de: 'Etwas unruhig', it: 'Un po mosso', fr: 'Un peu de clapot' }[language],
        subValue: { en: 'Use a bit of caution at more open spots.', gr: 'Θέλει λίγη προσοχή σε πιο ανοιχτά σημεία.', de: 'An offeneren Stellen etwas vorsichtig sein.', it: 'Serve un po di cautela nei punti piu aperti.', fr: 'Un peu de prudence dans les zones plus ouvertes.' }[language],
      };
    }

    if (waveHeightM >= 0.8) {
      return {
        value: { en: 'Choppy', gr: 'Κυματισμός', de: 'Unruhig', it: 'Mosso', fr: 'Clapot' }[language],
        subValue: windBeaufort === 5
          ? { en: 'The sea will have some chop.', gr: 'Η θάλασσα θα έχει κυματισμό.', de: 'Vorsicht, besonders mit Kindern.', it: 'Serve cautela, soprattutto con bambini.', fr: 'Prudence, surtout avec des enfants.' }[language]
          : { en: 'Use caution, especially with children.', gr: 'Θέλει προσοχή, ειδικά με παιδιά.', de: 'Vorsicht, besonders mit Kindern.', it: 'Serve cautela, soprattutto con bambini.', fr: 'Prudence, surtout avec des enfants.' }[language],
      };
    }
  }

  if (seaScore >= 8) {
    const verifiedProtectedCalm = canClaimWindProtection && seaCalmClaimAllowed;
    const verifiedShelter = canClaimWindProtection;
    return {
      value: { en: 'Good sea', gr: 'Καλή εικόνα', de: 'Gute See', it: 'Buon mare', fr: 'Bonne mer' }[language],
      subValue: verifiedProtectedCalm
        ? { en: 'Low waves, better sheltered', gr: 'Χαμηλό κύμα, πιο προστατευμένη', de: 'Niedrige Wellen, geschutzter', it: 'Onde basse, piu riparata', fr: 'Vagues basses, mieux abritee' }[language]
        : verifiedShelter
          ? { en: `Better sheltered ${day}`, gr: `Πιο προστατευμένη επιλογή ${day}`, de: 'Heute besser geschutzt', it: 'Piu riparata oggi', fr: 'Mieux abritee aujourd hui' }[language]
          : { en: 'Good sea conditions', gr: 'Καλές συνθήκες θάλασσας', de: 'Gute Meeresbedingungen', it: 'Buone condizioni del mare', fr: 'Bonnes conditions de mer' }[language],
    };
  }

  if (seaScore >= 5) {
    const lightWindCopy = { en: 'Wind should not be a major issue', gr: 'Ο άνεμος δεν φαίνεται να είναι πρόβλημα', de: 'Wind ist kein Hauptfaktor', it: 'Il vento non dovrebbe pesare', fr: 'Le vent ne devrait pas compter' }[language];
    const cautionCopy = isExposed
      ? (windBeaufort >= 5
        ? (windBeaufort === 5
          ? { en: 'Exposed to wind', gr: 'Εκτεθειμένη στον άνεμο', de: 'Wahrscheinlich unruhig', it: 'Probabile mare mosso', fr: 'Clapot probable' }[language]
          : { en: 'Likely choppy', gr: 'Πιθανό κύμα', de: 'Wahrscheinlich unruhig', it: 'Probabile mare mosso', fr: 'Clapot probable' }[language])
        : { en: 'May feel breezy', gr: 'Μπορεί να έχει αέρα', de: 'Kann windig wirken', it: 'Puo essere ventilata', fr: 'Peut etre ventee' }[language])
      : (windBeaufort >= 5
        ? (windBeaufort === 5
          ? { en: 'Better wind option', gr: 'Πιο υπήνεμη επιλογή', de: 'Besser geschutzte Stellen', it: 'Meglio punti piu riparati', fr: 'Prefere les coins abrites' }[language]
          : { en: 'Prefer more sheltered spots', gr: 'Καλύτερα πιο προστατευμένο σημείο', de: 'Besser geschutzte Stellen', it: 'Meglio punti piu riparati', fr: 'Prefere les coins abrites' }[language])
        : { en: 'Some wind - prefer shelter', gr: 'Λίγη έκθεση στον άνεμο', de: 'Etwas Windschutz prufen', it: 'Un po di vento', fr: 'Un peu de vent' }[language]);
    return {
      value: { en: 'Manageable sea', gr: 'Πιο ήπια θάλασσα', de: 'Handhabbare See', it: 'Mare gestibile', fr: 'Mer gerable' }[language],
      subValue: windBeaufort < 4 ? lightWindCopy : cautionCopy,
    };
  }

  return {
    value: windBeaufort === 5
      ? { en: 'Choppy', gr: 'Κυματισμός', de: 'Schlecht', it: 'Scarse', fr: 'Mauvaises' }[language]
      : language === 'gr' ? `Όχι ιδανικές ${getSelectedDayPrefix(selectedDate, new Date(), language)}` : language === 'en' ? `Not ideal ${getSelectedDayPrefix(selectedDate, new Date(), language)}` : { de: 'Schlecht', it: 'Scarse', fr: 'Mauvaises' }[language],
    subValue: windBeaufort === 5
      ? (isExposed
        ? { en: 'Exposed to wind', gr: 'Εκτεθειμένη στον άνεμο', de: 'Wahle einen geschutzteren Strand', it: 'Scegli una spiaggia piu riparata', fr: 'Choisis une plage plus abritee' }[language]
        : { en: 'Better wind option', gr: 'Πιο υπήνεμη επιλογή', de: 'Wahle einen geschutzteren Strand', it: 'Scegli una spiaggia piu riparata', fr: 'Choisis une plage plus abritee' }[language])
      : { en: 'Choose a more sheltered beach', gr: 'Προτίμησε πιο απάνεμη παραλία', de: 'Wahle einen geschutzteren Strand', it: 'Scegli una spiaggia piu riparata', fr: 'Choisis une plage plus abritee' }[language],
  };
};

type SwimmingWindowTone = 'good' | 'caution' | 'avoid';

const getSwimmingWindowDisplay = (
  swimmingComfort: SwimmingComfort,
  windBeaufort: number,
  waveHeightM: number | undefined,
  language: LanguageCode,
  selectedDayPrefix: string
): { title: string; helper: string; tone: SwimmingWindowTone } => {
  const roughOrWindy = windBeaufort >= 5 || (typeof waveHeightM === 'number' && waveHeightM >= 0.8);

  if (swimmingComfort === 'caution' || roughOrWindy) {
    return {
      title: { en: `Most suitable time ${selectedDayPrefix}`, gr: `Καταλληλότερη ώρα ${selectedDayPrefix}`, de: 'Am ehesten machbares Zeitfenster', it: 'Momento piu gestibile', fr: 'Moment le plus gerable' }[language],
      helper: { en: 'This is the better window based on wind and sea conditions.', gr: 'Αυτό είναι το καλύτερο διαθέσιμο διάστημα με βάση τον άνεμο και τη θάλασσα.', de: 'Wenn du gehst, ist dies voraussichtlich das besser handhabbare Zeitfenster, aber Vorsicht bleibt noetig.', it: 'Se vai, questa e probabilmente la fascia piu gestibile, ma serve comunque cautela.', fr: 'Si vous y allez, c est probablement le creneau le plus gerable, mais la prudence reste necessaire.' }[language],
      tone: 'caution',
    };
  }

  return {
    title: { en: `Best swimming time ${selectedDayPrefix}`, gr: `Καλύτερη ώρα για μπάνιο ${selectedDayPrefix}`, de: 'Beste Badezeit', it: 'Ora migliore per nuotare', fr: 'Meilleur moment pour se baigner' }[language],
    helper: '',
    tone: 'good',
  };
};

const getSwimmingWindowToneClasses = (tone: SwimmingWindowTone) => {
  if (tone === 'avoid') {
    return {
      section: 'border-rose-100/80 bg-rose-50/84 shadow-rose-900/5',
      icon: 'bg-rose-500',
      title: 'text-rose-950',
      value: 'text-rose-800',
      helper: 'text-rose-700',
    };
  }

  if (tone === 'caution') {
    return {
      section: 'border-amber-100/80 bg-amber-50/84 shadow-amber-900/5',
      icon: 'bg-amber-500',
      title: 'text-amber-950',
      value: 'text-amber-800',
      helper: 'text-amber-700',
    };
  }

  return {
    section: 'border-emerald-100/80 bg-emerald-50/80 shadow-emerald-900/5',
    icon: 'bg-emerald-500',
    title: 'text-emerald-950',
    value: 'text-emerald-800',
    helper: 'text-emerald-700',
  };
};

const parseClockTimeToMinutes = (value?: string): number | null => {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const getTimeWindowDurationMinutes = (start?: string, end?: string): number | null => {
  const startMinutes = parseClockTimeToMinutes(start);
  const endMinutes = parseClockTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  return endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : (24 * 60 - startMinutes) + endMinutes;
};

const hasUsefulTimeWindow = (start?: string, end?: string): boolean => {
  const durationMinutes = getTimeWindowDurationMinutes(start, end);
  return durationMinutes !== null && durationMinutes > 0;
};

import { openNavigation } from '../utils/navigation';
import { displayBeachName } from '../utils/localization';

interface BeachDetailPageProps {
  beach: Beach;
  allBeaches: Beach[];
  dayForecast: DailyForecast;
  hourlyForecast: ForecastItem[];
  language: LanguageCode;
  t: Translation;
  onBack: () => void;
  onBeachClick: (beach: Beach) => void;
  userLocation?: { lat: number; lon: number };
  favorites: number[];
  onToggleFavorite: (id: number) => void;
  preferences?: UserPreferences;
  islandName?: string;
  detailDataStatus?: 'idle' | 'loading' | 'ready' | 'partial';
}

export const BeachDetailPage: React.FC<BeachDetailPageProps> = ({
  beach,
  allBeaches,
  dayForecast,
  hourlyForecast,
  language,
  t,
  onBack,
  onBeachClick,
  userLocation,
  favorites,
  onToggleFavorite,
  preferences,
  islandName,
  detailDataStatus = 'idle'
}) => {
  const isFavorite = favorites.includes(beach.id);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const beachDisplayName = displayBeachName(beach.name, language);
  const islandDisplayName = islandName || 'Greece';
  const selectedDate = dayForecast.date;
  const selectedDayPrefix = getSelectedDayPrefix(selectedDate, new Date(), language);
  const selectedDayIsToday = selectedDayPrefix === (language === 'gr' ? 'σήμερα' : 'today');
  const copy = {
    whyToday: { en: `Why it's recommended ${selectedDayPrefix}`, gr: `Γιατί προτείνεται ${selectedDayPrefix};`, de: 'Warum dieser Strand?', it: 'Perche questa spiaggia?', fr: 'Pourquoi cette plage ?' },
    sea: { en: 'Sea', gr: 'Θάλασσα', de: 'Meer', it: 'Mare', fr: 'Mer' },
    airTemp: { en: 'Air temperature', gr: 'Θερμοκρασία αέρα', de: 'Lufttemperatur', it: 'Temperatura aria', fr: 'Temperature de l air' },
    bestTime: { en: 'Best Time', gr: 'Ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    toVisit: { en: 'To visit', gr: 'Για επίσκεψη', de: 'Zum Besuch', it: 'Per visitare', fr: 'Pour visiter' },
    bestSwim: { en: `Best swimming time ${selectedDayPrefix}`, gr: `Καλύτερη ώρα για μπάνιο ${selectedDayPrefix}`, de: 'Beste Badezeit', it: 'Ora migliore per nuotare', fr: 'Meilleur moment pour se baigner' },
    feedbackTitle: { en: `How were the conditions ${selectedDayPrefix}?`, gr: `Πώς ήταν οι συνθήκες ${selectedDayPrefix};`, de: 'Wie waren die Bedingungen?', it: 'Com erano le condizioni?', fr: 'Comment etaient les conditions ?' },
    feedbackText: { en: 'Your feedback helps us improve our recommendations for everyone.', gr: 'Η γνώμη σου μας βοηθά να βελτιώνουμε τις προτάσεις για όλους.', de: 'Dein Feedback hilft uns, die Empfehlungen fur alle zu verbessern.', it: 'Il tuo feedback ci aiuta a migliorare i consigli per tutti.', fr: 'Votre avis nous aide a ameliorer les recommandations pour tous.' },
    nearby: { en: 'Nearby Recommendations', gr: 'Κοντινές προτάσεις', de: 'Empfehlungen in der Nahe', it: 'Consigli nelle vicinanze', fr: 'Recommandations proches' },
    decisionSummary: { en: selectedDayIsToday ? 'Today summary' : `Summary ${selectedDayPrefix}`, gr: `Σύνοψη για ${selectedDayPrefix}`, de: 'Kurzfassung', it: 'Riepilogo', fr: 'Resume' },
    conditions: { en: `Conditions ${selectedDayPrefix}`, gr: `Συνθήκες ${selectedDayPrefix}`, de: 'Bedingungen', it: 'Condizioni', fr: 'Conditions' },
    windShort: { en: 'Wind', gr: 'Άνεμος', de: 'Wind', it: 'Vento', fr: 'Vent' },
    temperatureShort: { en: 'Temperature', gr: 'Θερμοκρασία', de: 'Temperatur', it: 'Temperatura', fr: 'Temperature' },
    features: { en: 'Features', gr: 'Χαρακτηριστικά', de: 'Merkmale', it: 'Caratteristiche', fr: 'Caracteristiques' },
    locationTitle: { en: 'Location', gr: 'Πού βρίσκεται', de: 'Lage', it: 'Posizione', fr: 'Localisation' },
    openNavigation: { en: 'Open navigation', gr: 'Άνοιγμα πλοήγησης', de: 'Navigation offnen', it: 'Apri navigazione', fr: 'Ouvrir la navigation' },
    navigation: { en: 'Navigation', gr: 'Πλοήγηση', de: 'Navigation', it: 'Navigazione', fr: 'Navigation' },
    bestWindow: { en: 'Best time', gr: 'Καλύτερα', de: 'Beste Zeit', it: 'Meglio', fr: 'Meilleur moment' },
    visitWindow: { en: 'Good time to visit', gr: 'Καλή ώρα για επίσκεψη', de: 'Gute Besuchszeit', it: 'Buon momento per visitare', fr: 'Bon moment pour visiter' },
    away: { en: 'away', gr: 'μακριά', de: 'entfernt', it: 'di distanza', fr: 'de distance' },
    nearbyIntro: { en: 'If you do not go here, these are the best nearby fallbacks:', gr: 'Αν δεν πας εδώ, αυτές είναι οι καλύτερες κοντινές εναλλακτικές:', de: 'Falls du nicht hierhin gehst, sind das gute Alternativen in der Nahe:', it: 'Se non vai qui, queste sono buone alternative vicine:', fr: 'Si vous ne venez pas ici, voici les meilleures alternatives proches :' },
    noNearby: { en: 'No other beaches nearby.', gr: 'Δεν βρέθηκαν άλλες κοντινές παραλίες.', de: 'Keine weiteren Strande in der Nahe.', it: 'Nessun altra spiaggia vicina.', fr: 'Aucune autre plage a proximite.' },
    share: { en: 'Share', gr: 'Κοινοποίηση', de: 'Teilen', it: 'Condividi', fr: 'Partager' },
    favorite: { en: 'Favorite', gr: 'Αγαπημένο', de: 'Favorit', it: 'Preferito', fr: 'Favori' },
    back: { en: 'Back to beaches', gr: 'Πίσω στις παραλίες', de: 'Zuruck zu den Stranden', it: 'Torna alle spiagge', fr: 'Retour aux plages' },
    mapUnavailable: { en: 'The map could not load right now.', gr: 'Ο χάρτης δεν φορτώθηκε τώρα.', de: 'Die Karte konnte gerade nicht geladen werden.', it: 'La mappa non si e caricata.', fr: 'La carte n a pas pu se charger.' },
  };

  // Scroll to top on mount and track view
  useEffect(() => {
    scrollToPageTop();
    trackEvent('beach_detail_opened', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandDisplayName,
      beach_name: beach.name.en,
      source: 'detail_page',
    });
  }, [beach.id, beach.name.en, beachDisplayName, islandDisplayName, language]);

  // Swipe-right to go back (mobile)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
      // Swipe right > 80px, mostly horizontal
      if (dx > 80 && dy < 60 && touchStartRef.current.x < 50) {
        onBack();
      }
      touchStartRef.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onBack]);

  const handleFeedback = (isAccurate: boolean) => {
    storeFeedback(beach.id, isAccurate ? 'accurate' : 'not_accurate');
    setFeedbackSubmitted(true);
  };

  const handleNavigation = () => {
    trackEvent('navigation_clicked', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandDisplayName,
      beach_name: beach.name.en,
      source: 'detail_page',
    });
    openNavigation(beach);
  };

  // 1. Calculate Conditions & Scores
  const currentWeather = hourlyForecast[0];
  const weatherData = dayForecast || forecastToWeather(currentWeather);
  const displayTemp = 'temp_max' in weatherData ? weatherData.temp_max : weatherData.main.temp;
  const windSpeedKmh = weatherData.wind.speed * 3.6;
  const windDir = degToCompass(weatherData.wind.deg);
  const windDirectionLabel = t.windDirectionsAccusative?.[windDir as WindDirection] || t.windDirections[windDir as WindDirection] || windDir;
  const scoreResult = calculateBeachScore(beach, weatherData, userLocation, preferences);
  const { score, exposureLevel, swimmingComfort, canClaimWindProtection = false, seaCalmClaimAllowed = false } = scoreResult;
  const isExposed = exposureLevel ? exposureLevel !== 'protected' : true;
  const isExposedToTodayWind = exposureLevel ? exposureLevel === 'exposed' : isExposed;
  const waveHeightM = weatherData.marine?.waveHeightM;
  const seaConditionScore = calculateSeaConditionScore(isExposed, windSpeedKmh, exposureLevel, waveHeightM);
  const detailBadgeScore = getDetailBadgeScore(score, seaConditionScore, isExposed);
  const beaufortLevel = getBeaufortLevel(windSpeedKmh);
  const seaConditionDisplay = getSeaConditionDisplay(seaConditionScore, isExposedToTodayWind, language, selectedDate, canClaimWindProtection, seaCalmClaimAllowed, beaufortLevel, waveHeightM);
  const cautionWaterConditions = beaufortLevel >= 5 || (typeof waveHeightM === 'number' && waveHeightM >= 0.8);
  const aiExplanation = generateServiceBeachExplanation(beach, weatherData, score, userLocation, language);
  const waveCondition = getWaveCondition(isExposed, windSpeedKmh);

  // Show only curated beach-specific photos. Region/island fallbacks are hidden
  // because a wrong landmark damages trust more than a polished placeholder.
  const photoLookup = useMemo(() => {
    return getBeachPhotoLookup(beach.name.gr, beach.name.en, beach.id, 5, islandName);
  }, [beach.id, beach.name.en, beach.name.gr, islandName]);
  const realPhotos = photoLookup.source === 'exact' ? (photoLookup.detailPhotos || photoLookup.photos) : [];
  const photoAttribution = photoLookup.metadata?.requiresAttribution ? photoLookup.metadata : undefined;
  const photoSuggestionUrl = useMemo(() => buildPhotoSuggestionUrl({
    beachId: beach.id,
    beachName: beachDisplayName,
    islandName: islandDisplayName,
  }), [beach.id, beachDisplayName, islandDisplayName]);
  const handlePhotoSuggestionClick = () => {
    trackEvent('photo_suggestion_clicked', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandDisplayName,
      beach_name: beach.name.en,
    });
  };
  
  // 2. Best Time & Planner
  const bestTime = useMemo(() => calculateBestBeachTime(hourlyForecast, beach), [beach, hourlyForecast]);
  const usefulBestTimeWindow = Boolean(bestTime && hasUsefulTimeWindow(bestTime.bestStart, bestTime.bestEnd));
  const bestTimeRange = usefulBestTimeWindow && bestTime ? `${bestTime.bestStart} - ${bestTime.bestEnd}` : null;
  const bestTimeLabel = bestTimeRange || { en: 'Morning', gr: 'Πρωί', de: 'Morgen', it: 'Mattina', fr: 'Matin' }[language];
  const bestTimeReason = bestTime
    ? generateBestTimeReason({
      language,
      windBeaufort: beaufortLevel,
      waveHeightM,
      isExposed,
      exposureLevel,
      selectedDate,
    })
    : '';
  const swimWindowDisplay = getSwimmingWindowDisplay(swimmingComfort, beaufortLevel, waveHeightM, language, selectedDayPrefix);
  const swimWindowToneClasses = getSwimmingWindowToneClasses(swimWindowDisplay.tone);
  const isNoIdealSwimmingWindow = swimWindowDisplay.tone === 'avoid';
  const fallbackWindowDurationMinutes = getTimeWindowDurationMinutes(bestTime?.bestStart, bestTime?.bestEnd);
  const hideBroadNoIdealFallbackWindow = Boolean(
    isNoIdealSwimmingWindow &&
    fallbackWindowDurationMinutes !== null &&
    fallbackWindowDurationMinutes >= 360
  );
  const canonicalBestTimeLabel = bestTime
    ? isNoIdealSwimmingWindow
      ? hideBroadNoIdealFallbackWindow
        ? ''
        : `${language === 'gr' ? 'Προτίμησε την καταλληλότερη ώρα' : 'Prefer the most suitable time'}: ${bestTime.bestStart} - ${bestTime.bestEnd}`
      : `${bestTime.bestStart} - ${bestTime.bestEnd}`
    : bestTimeLabel;
  const displayedBestTimeLabel = usefulBestTimeWindow ? canonicalBestTimeLabel : '';
  const swimmingWindowHelper = swimWindowDisplay.helper || bestTimeReason;
  const isCautionFramingDay = swimWindowDisplay.tone !== 'good' || cautionWaterConditions;
  const whyTodayHeading = isCautionFramingDay
    ? {
      en: `Why it's one of the more suitable options ${selectedDayPrefix}`,
      gr: `Γιατί είναι πιο διαχειρίσιμη επιλογή ${selectedDayPrefix}`,
      de: 'Warum sie heute die bessere verfuegbare Option ist',
      it: 'Perche oggi e l opzione piu gestibile',
      fr: 'Pourquoi c est l option la plus gerable aujourd hui',
    }[language]
    : copy.whyToday[language];
  const displayWhyTodayHeading = isCautionFramingDay && language === 'gr'
    ? `Γιατί είναι από τις πιο κατάλληλες επιλογές ${selectedDayPrefix}`
    : whyTodayHeading;
  const detailExplanation = generateUiBeachExplanation({
    beach,
    language,
    isExposed,
    exposureLevel,
    waveCondition,
    waveHeightM,
    bestBeachTime: bestTime || undefined,
    windDirectionLabel,
    windBeaufort: beaufortLevel,
    selectedDate,
    canClaimWindProtection,
    seaCalmClaimAllowed,
  });
  const decisionBullets = detailExplanation.heroBullets.slice(0, 3);
  const amenityChips = getAmenityChips(beach, language);
  const amenityRows = getAmenityStatusRows(beach, language);
  const showAmenityDisclaimer = shouldShowAmenityDisclaimer(beach);
  const topFeatureItems = [
    {
      key: 'sandy',
      icon: <Sparkles size={16} />,
      label: t.filterOptions.sandy,
      active: beach.beachType === 'sandy',
    },
    {
      key: 'shade',
      icon: <Trees size={16} />,
      label: t.filterOptions.naturalShade,
      active: beach.amenities.naturalShade,
    },
    {
      key: 'family',
      icon: <Users size={16} />,
      label: cautionWaterConditions
        ? (beaufortLevel === 5
          ? t.userPreferences.familyFriendly
          : (language === 'gr' ? `Οικογένεια, με προσοχή ${selectedDayPrefix}` : `Family, but caution ${selectedDayPrefix}`))
        : t.userPreferences.familyFriendly,
      active: beach.environment.familyFriendly,
    },
    {
      key: 'facilities',
      icon: <Utensils size={16} />,
      label: amenityChips[0]?.label || { en: 'Facilities unknown', gr: 'Άγνωστες παροχές', de: 'Facilities unknown', it: 'Facilities unknown', fr: 'Facilities unknown' }[language],
      active: amenityChips.length > 0 && amenityChips[0].key !== 'unknownFacilities',
    },
    {
      key: 'protected',
      icon: <Wind size={16} />,
      label: language === 'gr' ? `${selectedDayPrefix}: πιο υπήνεμη` : `${selectedDayPrefix}: better sheltered`,
      active: exposureLevel === 'protected' && canClaimWindProtection,
    },
    {
      key: 'shallow',
      icon: <Waves size={16} />,
      label: language === 'gr' ? 'Ρηχά νερά' : 'Shallow water',
      active: beach.characteristics.shallowWaters,
    },
  ].filter(item => item.active).slice(0, 6);

  // 3. Nearby Beaches
  const nearbyBeaches = useMemo(() => {
    const others = allBeaches.filter(b => b.id !== beach.id);
    const nearby = others.filter(b => {
      const dist = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
      return dist <= 20; // 20km radius
    });

    // Get top 3 from these nearby beaches
    const recommendations = getTopRecommendedBeaches(nearby, weatherData, userLocation, hourlyForecast, preferences);
    return recommendations.slice(0, 3).map(rec => {
      const b = nearby.find(nb => nb.id === rec.beachId);
      if (!b) return null;
      const dist = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
      return { ...rec, beach: b, distance: dist };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [allBeaches, beach, weatherData, userLocation, hourlyForecast, preferences]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        trackEvent('share_clicked', beach.id, {
          locale: language === 'gr' ? 'el' : 'en',
          region: islandDisplayName,
          beach_name: beach.name.en,
          source: 'detail_page',
        });
        await navigator.share({
          title: beachDisplayName,
          text: aiExplanation,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-white pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/70 bg-white/84 px-4 py-4 shadow-sm shadow-sky-900/5 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label={copy.back[language]}
          className="p-2.5 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>
        <h1 className="max-w-[180px] truncate text-base font-semibold text-slate-900 sm:max-w-[300px] sm:text-lg">
          {beachDisplayName}
        </h1>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => onToggleFavorite(beach.id)}
            aria-label={copy.favorite[language]}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors ${isFavorite ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button 
            type="button"
            onClick={handleShare}
            aria-label={copy.share[language]}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100"
          >
            <Share2 className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 md:pt-6 space-y-5 md:space-y-7">
        {detailDataStatus === 'partial' && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {language === 'gr'
              ? 'Δεν φορτώθηκαν όλες οι λεπτομέρειες. Δείχνουμε τα βασικά στοιχεία της παραλίας.'
              : 'Some beach details could not be loaded. Showing the core beach information.'}
          </div>
        )}
        
        {/* 1. Decision summary */}
        <section className="space-y-4 rounded-[2rem] border border-white/75 bg-white/88 p-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-sm sm:p-5">
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-cyan-700 tracking-normal">
              {copy.decisionSummary[language]}
            </p>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="font-heading text-3xl font-bold leading-[1.12] text-slate-950 sm:text-4xl">
                  {beachDisplayName}
                </h2>
                <p className="text-sm text-slate-500 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{islandDisplayName}</span>
                </p>
              </div>
            </div>
          </div>

          <TodayScoreBadge
            score={detailBadgeScore}
            language={language}
            variant="hero"
            selectedDate={selectedDate}
            windBeaufort={beaufortLevel}
            waveHeightM={waveHeightM}
            swimmingComfort={swimmingComfort}
            noIdealSwimmingWindow={swimWindowDisplay.tone === 'avoid'}
            exposureLevel={exposureLevel}
          />

          <div className="space-y-2 rounded-3xl border border-cyan-100/70 bg-cyan-50/45 p-3">
            <h3 className="text-sm font-bold text-slate-900">{displayWhyTodayHeading}</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {decisionBullets.map((bullet, index) => (
                <div key={index} className="flex items-start gap-2 text-sm font-medium leading-relaxed text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-600" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleNavigation}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 font-bold text-white shadow-lg shadow-cyan-200 transition-colors hover:bg-cyan-700"
            >
              <Navigation className="w-5 h-5" />
              {copy.navigation[language]}
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(beach.id)}
              aria-label={copy.favorite[language]}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border transition-colors ${isFavorite ? 'border-red-100 bg-red-50 text-red-500' : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label={copy.share[language]}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* 2. Photo Gallery */}
        <section className="space-y-3">
          {realPhotos.length > 0 ? (
            <>
              <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] border border-white/70 shadow-lg shadow-cyan-900/10 sm:aspect-[4/3]">
                <img
                  src={realPhotos[0]}
                  alt={beachDisplayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  width={960}
                  height={600}
                  sizes="(min-width: 768px) 896px, calc(100vw - 32px)"
                />
              </div>
              {photoAttribution && (
                <p className="px-1 text-[11px] font-medium leading-snug text-slate-500">
                  <a
                    href={photoAttribution.sourcePageUrl || photoAttribution.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-300 underline-offset-2"
                  >
                    {photoAttribution.attributionText}
                  </a>
                </p>
              )}
              {realPhotos.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {realPhotos.slice(1).map((url, i) => (
                    <div key={i} className="flex-shrink-0 w-24 sm:w-32 aspect-square rounded-2xl overflow-hidden shadow-sm">
                      <img
                        src={url}
                        alt={`${beachDisplayName} ${i + 2}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        width={256}
                        height={256}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <BeachDetailPhotoPlaceholder beachName={beachDisplayName} language={language} />
              <PhotoContributionPrompt
                beachName={beachDisplayName}
                language={language}
                suggestionUrl={photoSuggestionUrl}
                onClick={photoSuggestionUrl ? handlePhotoSuggestionClick : undefined}
              />
            </>
          )}
        </section>

        {/* 4. Today's Conditions */}
        <section className="space-y-3">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.conditions[language]}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <ConditionCard
              icon={<Wind className="w-5 h-5 text-blue-500" />}
              label={copy.windShort[language]}
              value={`${windSpeedKmh.toFixed(0)} km/h · ${windDirectionLabel}`}
              subValue={`${beaufortLevel} ${t.units.beaufort}`}
            />
            <ConditionCard
              icon={<Waves className="w-5 h-5 text-cyan-500" />}
              label={copy.sea[language]}
              value={seaConditionDisplay.value}
              subValue={seaConditionDisplay.subValue}
            />
            <ConditionCard
              icon={<Thermometer className="w-5 h-5 text-orange-500" />}
              label={copy.temperatureShort[language]}
              value={`${displayTemp.toFixed(0)}°C`}
              subValue={copy.airTemp[language]}
            />
          </div>
        </section>

        {/* 5. Best Time Today */}
        {bestTime && usefulBestTimeWindow && (
          <section className={`flex items-start gap-3 rounded-[1.75rem] border p-4 shadow-sm ${swimWindowToneClasses.section}`}>
            <div className={`rounded-2xl p-2.5 text-white shadow-sm ${swimWindowToneClasses.icon}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold ${swimWindowToneClasses.title}`}>{swimWindowDisplay.title}</h3>
              {displayedBestTimeLabel && (
                <p className={`text-lg font-bold ${swimWindowToneClasses.value}`}>
                  {displayedBestTimeLabel}
                </p>
              )}
              <p className={`text-sm font-medium mt-1 leading-snug ${swimWindowToneClasses.helper}`}>
                {swimmingWindowHelper}
              </p>
            </div>
          </section>
        )}

        {/* 6. Beach Features */}
        {topFeatureItems.length > 0 && (
          <section className="space-y-3">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.features[language]}</h3>
            <div className="flex flex-wrap gap-2">
              {topFeatureItems.map((item) => (
                <FeatureItem key={item.key} icon={item.icon} label={item.label} />
              ))}
            </div>
          </section>
        )}

        {/* 7. Amenities */}
        <section className="space-y-3">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{t.amenitiesTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {amenityChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex min-h-9 items-center rounded-full border border-white/80 bg-white/88 px-3 text-xs font-semibold text-slate-700 shadow-sm shadow-sky-900/5"
              >
                {chip.label}
              </span>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {amenityRows.map((row) => (
              <div key={row.key} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/88 px-3 py-2 shadow-sm shadow-sky-900/5">
                <span className="min-w-0 text-sm font-bold text-slate-700">{row.label}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${amenityStatusClass(row.status)}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {showAmenityDisclaimer && (
            <p className="px-1 text-xs font-semibold leading-snug text-slate-500">
              {getAmenityDisclaimer(language)}
            </p>
          )}
        </section>

        {/* 8. Map Location */}
        <section className="space-y-3">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.locationTitle[language]}</h3>
          <div className="h-56 w-full overflow-hidden rounded-[2rem] border border-white/75 bg-slate-100 shadow-sm shadow-sky-900/5 sm:h-64">
            <MapLoadBoundary
              resetKey={`${beach.id}-${language}`}
              fallback={
                <div role="alert" className="flex h-full w-full items-center justify-center bg-slate-50 px-4 text-center text-sm font-bold text-slate-600">
                  {copy.mapUnavailable[language]}
                </div>
              }
            >
              <React.Suspense fallback={<div className="w-full h-full bg-slate-100 animate-pulse" />}>
                <BeachMap
                  beaches={[{
                    beachId: beach.id,
                    name: beachDisplayName,
                    score,
                    explanation: aiExplanation,
                    isExposed,
                    beach,
                    bestBeachTime: bestTime
                  }]}
                  userLocation={userLocation}
                  center={[beach.coordinates.lat, beach.coordinates.lon]}
                  zoom={14}
                  windSpeed={weatherData.wind.speed}
                  windDirection={windDir}
                  windDirectionDeg={weatherData.wind.deg}
                  language={language}
                  selectedDate={selectedDate}
                  compact
                />
              </React.Suspense>
            </MapLoadBoundary>
          </div>
          <button 
            type="button"
            onClick={handleNavigation}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 font-bold text-white shadow-md transition-colors hover:bg-cyan-700"
          >
            <Navigation className="w-5 h-5" />
            {copy.openNavigation[language]}
          </button>
        </section>

        {/* Feedback System */}
        <section className="bg-white p-4 rounded-[1.75rem] border border-slate-100 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-heading font-bold text-slate-900">{copy.feedbackTitle[language]}</h3>
            <p className="text-slate-500 text-sm leading-snug">{copy.feedbackText[language]}</p>
          </div>

          {feedbackSubmitted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-emerald-700"
            >
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-bold">{{ en: 'Thank you for your feedback!', gr: 'Ευχαριστούμε για το feedback!', de: 'Danke fur dein Feedback!', it: 'Grazie per il feedback!', fr: 'Merci pour votre avis !' }[language]}</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => handleFeedback(true)}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-100 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
              >
                <ThumbsUp className="w-4 h-4" />
                {{ en: 'Accurate', gr: 'Σωστό', de: 'Stimmt', it: 'Corretto', fr: 'Exact' }[language]}
              </button>
              <button 
                type="button"
                onClick={() => handleFeedback(false)}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-rose-100 text-sm font-bold text-rose-700 transition-all hover:bg-rose-50 active:scale-95"
              >
                <ThumbsDown className="w-4 h-4" />
                {{ en: 'Not accurate', gr: 'Όχι σωστό', de: 'Stimmt nicht', it: 'Non corretto', fr: 'Pas exact' }[language]}
              </button>
            </div>
          )}
        </section>

        {/* 8. Nearby Beaches */}
        <section className="space-y-4">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.nearby[language]}</h3>
          <div className="space-y-3">
            {nearbyBeaches.length > 0 ? (
              <>
                <p className="text-slate-500 text-sm px-1 leading-snug">
                  {copy.nearbyIntro[language]}
                </p>
                <div className="flex flex-col gap-3">
                  {nearbyBeaches.map((item) => {
                    const itemIsExposed = item.exposureLevel ? item.exposureLevel !== 'protected' : true;
                    const itemSeaScore = calculateSeaConditionScore(itemIsExposed, windSpeedKmh, item.exposureLevel, item.waveHeightM ?? waveHeightM);
                    const itemTone = getRecommendationTone(item.score, itemSeaScore, itemIsExposed);
                    const itemExplanation = generateUiBeachExplanation({
                      beach: item.beach,
                      language,
                      isExposed: itemIsExposed,
                      exposureLevel: item.exposureLevel,
                      waveCondition: getWaveCondition(itemIsExposed, windSpeedKmh),
                      waveHeightM: item.waveHeightM ?? waveHeightM,
                      bestBeachTime: bestTime || undefined,
                      windDirectionLabel,
                      windBeaufort: beaufortLevel,
                      selectedDate,
                      canClaimWindProtection: item.canClaimWindProtection,
                      seaCalmClaimAllowed: item.seaCalmClaimAllowed,
                    });
                    const itemPhotoLookup = getBeachPhotoLookup(item.beach.name.gr, item.beach.name.en, item.beachId, 1, islandName);
                    const itemPhoto = itemPhotoLookup.source === 'exact' ? itemPhotoLookup.photos[0] : undefined;

                    return (
                      <button
                        type="button"
                        key={item.beachId}
                        onClick={() => onBeachClick(item.beach)}
                        className="w-full p-3 bg-white rounded-3xl border border-slate-100 flex items-center justify-between gap-3 text-left shadow-sm transition-colors hover:border-cyan-200 group"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {itemPhoto && (
                            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0">
                              <img
                                src={itemPhoto}
                                alt={displayBeachName(item.beach.name, language)}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="min-w-0 space-y-1">
                            <h4 className="truncate font-bold text-slate-950">{displayBeachName(item.beach.name, language)}</h4>
                            <p className="text-xs font-bold text-slate-500">
                              {typeof item.distance === 'number' ? `${item.distance.toFixed(1)} km ${copy.away[language]}` : copy.nearby[language]}
                            </p>
                            <p className="text-xs font-semibold text-slate-600 line-clamp-2">
                              {itemExplanation.cardSummary || getRecommendationLabel(itemTone, language, selectedDate, beaufortLevel)}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 flex-shrink-0 text-slate-300 group-hover:text-cyan-600 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm px-1 italic">{copy.noNearby[language]}</p>
            )}
          </div>
        </section>

      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <button
            type="button"
            onClick={handleNavigation}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 font-bold text-white shadow-lg shadow-cyan-200 active:scale-[0.99]"
          >
            <Navigation className="h-5 w-5" />
            {copy.navigation[language]}
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(beach.id)}
            aria-label={copy.favorite[language]}
            className={`flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border ${isFavorite ? 'border-red-100 bg-red-50 text-red-500' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label={copy.share[language]}
            className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConditionCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
}

const ConditionCard: React.FC<ConditionCardProps> = ({ icon, label, value, subValue }) => (
  <div className="bg-white p-3 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-start text-left gap-1.5 min-w-0">
    <div className="p-2 bg-slate-50 rounded-xl">
      {icon}
    </div>
    <span className="text-[10px] font-bold tracking-normal text-slate-400">{label}</span>
    <span className="text-sm font-bold leading-tight text-slate-900 break-words sm:text-base">{value}</span>
    <span className="text-[11px] font-semibold text-slate-500 leading-tight line-clamp-2">{subValue}</span>
  </div>
);

interface FeatureItemProps {
  icon: React.ReactNode;
  label: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, label }) => (
  <div className="flex min-h-10 items-center gap-2 rounded-full border border-slate-100 bg-white px-3 text-slate-800 shadow-sm">
    <div className="text-cyan-600">
      {icon}
    </div>
    <span className="text-xs font-bold">{label}</span>
  </div>
);

const amenityStatusClass = (status: AmenityStatus): string => {
  switch (status) {
    case 'yes':
      return 'bg-emerald-50 text-emerald-700';
    case 'seasonal':
      return 'bg-amber-50 text-amber-700';
    case 'limited':
      return 'bg-orange-50 text-orange-700';
    case 'no':
      return 'bg-slate-100 text-slate-500';
    case 'unknown':
    default:
      return 'bg-slate-50 text-slate-400';
  }
};
