import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, MapPin, Wind, Waves, Thermometer, Droplets, Leaf,
  Clock, Sun, Backpack,
  Navigation, Share2, Heart, ChevronRight, ThumbsUp, ThumbsDown, CheckCircle2,
  Camera, ExternalLink, Accessibility, AlertTriangle, Tent, Ticket, Euro, ScrollText, Compass, Ship
} from 'lucide-react';
import {
  Beach, LanguageCode, Translation, WindDirection,
  ForecastItem, DailyForecast, UserPreferences, SwimmingComfort,
  GeospatialExposureProfile, WeatherSource
} from '../types';
import {
  calculateBestBeachTime,
  getTopRecommendedBeaches,
  generateBeachExplanation as generateServiceBeachExplanation,
  calculateBeachScore,
  computeHourlyEffectiveWaves,
  type BeachWeatherById
} from '../services/recommendationService';
import { degToCompass, calculateDistance, getBeaufortLevel, getWaveCondition } from '../utils/weatherUtils';
import { trackEvent, storeConditionFeedback, getFeedback, ConditionFeedbackVerdict, buildBeachExposureParams } from '../services/analyticsService';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import { TodayScoreBadge } from '../components/TodayScoreBadge';
import { LocalWindShelterSection, type LocalWindShelteredCove } from '../components/LocalWindShelterSection';
import { GettingThereSection } from '../components/GettingThereSection';
import { SwellRouterSection, type SwellShelteredCove } from '../components/SwellRouterSection';
import { assessSwellExposure } from '../utils/swellExposure';
import { SwitchBeachCard } from '../components/SwitchBeachCard';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { AccessibleCalmNearbySection, type AccessibleCalmCove } from '../components/AccessibleCalmNearbySection';
import { ConstraintFitSection, type ConstraintFit } from '../components/ConstraintFitSection';
import { WaveHeightGraphic, type HourlyWavePoint } from '../components/WaveHeightGraphic';
import { resolveCoveAwareWaveHeightM } from '../utils/coveWaveGuard';
import { CoveConditionsCard } from '../components/CoveConditionsCard';
import { hasBoatOnlyAccess } from '../utils/access';
import { DayPlanSection, type DayPlanStop } from '../components/DayPlanSection';
import { generateBeachExplanation as generateUiBeachExplanation } from '../utils/beachExplanation';
import { describeSimpleWindSuitability, describeWindExposure } from '../utils/windExposureCopy';
import type { ExposureLevel } from '../utils/windExposure';
import { getLocalWindNote } from '../utils/localWindNote';
import { getBeachStory, type BeachStory } from '../data/beachStories';
import { getIslandGuideLinks } from '../utils/beachGuides';
import {
  AmenityStatus,
  getAmenityChips,
  getAmenityDisclaimer,
  getAmenityStatusRows,
  shouldShowAmenityDisclaimer,
} from '../utils/amenities';
import {
  getSeatracAccess,
  hasSeatracInfo,
  getAccessibilityStatusRows,
  getAccessibilityHeadline,
  getAccessibilitySeasonalNote,
  getAccessibilityVerifyNote,
  getAccessibilitySectionTitle,
  getAccessibilityCheckedLabel,
} from '../utils/accessibility';
import { MapLoadBoundary } from '../components/MapLoadBoundary';
import { scrollToPageTop } from '../utils/scroll';
import { getSunsetTime } from '../utils/sunTimes';
import { buildPhotoSuggestionUrl } from '../utils/photoContribution';
import { getSelectedDayPrefix, getSelectedHourPrefix } from '../utils/dateLabels';
import { getBoatRideMotionLevel } from '../utils/boatRideMotion';
import { getRainSwimAdvisory } from '../utils/rainAdvisory';
import { summarizeLocalWindBehavior } from '../utils/windClimatology';
import { getRegionWindContext, LOCAL_WIND_SECTORS } from '../utils/localWindContext.mjs';
import { buildWeatherNowContent } from '../utils/weatherNowCopy';

// Temporarily hidden: the "Σχέδιο ημέρας" (Plan your day) section isn't well
// implemented yet — hiding it until we rework it. Flip back to true to re-enable.
const ENABLE_DAY_PLAN_SECTION = false;

// Lazy load map to avoid blocking main thread
const BeachMap = React.lazy(() => import('../components/BeachMap'));

import { getBeachPhotoLookup } from '../services/beachPhotos';

const getDetailBadgeScore = (score: number, seaScore: number, isExposed: boolean): number => {
  if (seaScore >= 8) return Math.max(score, 76);
  if (!isExposed && seaScore >= 5) return Math.max(score, 50);
  return score;
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

const sentenceCase = (value: string): string =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

const getSeaConditionDisplay = (
  seaScore: number,
  isExposed: boolean,
  language: LanguageCode,
  selectedDate?: Date,
  canClaimWindProtection = false,
  seaCalmClaimAllowed = false,
  windBeaufort = 0,
  waveHeightM?: number,
  selectedHour?: number,
  boatAccess = false
) => {
  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, new Date(), language);
  const momentSuffix = hour ? ` ${day}` : '';
  const exposedWindLabel = {
    en: `More exposed to wind${momentSuffix}`,
    gr: `Πιο εκτεθειμένη στον άνεμο${momentSuffix}`,
    de: `Windexponiert${momentSuffix}`,
    it: `Più esposta al vento${momentSuffix}`,
    fr: `Plus exposée au vent${momentSuffix}`,
  }[language];
  const shelteredWindLabel = {
    en: `Better sheltered${momentSuffix}`,
    gr: `Πιο προστατευμένη επιλογή${momentSuffix}`,
    de: `Besser geschützt${momentSuffix}`,
    it: `Più riparata${momentSuffix}`,
    fr: `Mieux abritée${momentSuffix}`,
  }[language];
  const lowWavesShelteredLabel = {
    en: `Low waves, better sheltered${momentSuffix}`,
    gr: `Χαμηλό κύμα, πιο προστατευμένη${momentSuffix}`,
    de: `Niedrige Wellen, geschützter${momentSuffix}`,
    it: `Onde basse, più riparata${momentSuffix}`,
    fr: `Vagues faibles, mieux abritée${momentSuffix}`,
  }[language];

  if (boatAccess) {
    const boatCopy = {
      en: {
        value: {
          smooth: 'Ideal conditions',
          light: 'A little motion',
          bumpy: 'Bumpy ride',
          rough: 'Very bumpy',
        },
        atHour: (hourPrefix: string) => sentenceCase(hourPrefix),
        subValue: {
          smooth: 'Low motion expected on the ride.',
          light: 'Expect a little motion on the ride.',
          bumpy: 'The ride may feel less comfortable.',
          rough: 'Check the trip before setting off.',
        },
      },
      gr: {
        value: {
          smooth: 'Ιδανικές συνθήκες',
          light: 'Λίγο κούνημα',
          bumpy: 'Κουνάει αρκετά',
          rough: 'Πολύ κούνημα',
        },
        atHour: (hourPrefix: string) => sentenceCase(hourPrefix),
        subValue: {
          smooth: 'Με βάση άνεμο και κύμα.',
          light: 'Με βάση άνεμο και κύμα.',
          bumpy: 'Η διαδρομή μπορεί να είναι πιο άβολη.',
          rough: 'Καλύτερα επιβεβαίωσε τη διαδρομή πριν ξεκινήσεις.',
        },
      },
      de: {
        value: {
          smooth: 'Ideale Bedingungen',
          light: 'Etwas Bewegung',
          bumpy: 'Unruhige Fahrt',
          rough: 'Sehr unruhig',
        },
        atHour: (hourPrefix: string) => sentenceCase(hourPrefix),
        subValue: {
          smooth: 'Wenig Bewegung auf der Fahrt.',
          light: 'Rechne mit leichter Bewegung auf der Fahrt.',
          bumpy: 'Die Fahrt kann weniger bequem sein.',
          rough: 'Prüfe die Fahrt vor dem Losfahren.',
        },
      },
      it: {
        value: {
          smooth: 'Condizioni ideali',
          light: 'Un po’ di movimento',
          bumpy: 'Tragitto mosso',
          rough: 'Molto mosso',
        },
        atHour: (hourPrefix: string) => sentenceCase(hourPrefix),
        subValue: {
          smooth: 'Poco movimento previsto nel tragitto.',
          light: 'Aspettati un po’ di movimento durante il tragitto.',
          bumpy: 'Il tragitto può essere meno comodo.',
          rough: 'Verifica il tragitto prima di partire.',
        },
      },
      fr: {
        value: {
          smooth: 'Conditions idéales',
          light: 'Un peu de mouvement',
          bumpy: 'Trajet agité',
          rough: 'Très agité',
        },
        atHour: (hourPrefix: string) => sentenceCase(hourPrefix),
        subValue: {
          smooth: 'Peu de mouvement prévu sur le trajet.',
          light: 'Prévois un peu de mouvement pendant le trajet.',
          bumpy: 'Le trajet peut être moins confortable.',
          rough: 'Vérifie le trajet avant de partir.',
        },
      },
    }[language];
    const level = getBoatRideMotionLevel(waveHeightM, windBeaufort);

    return {
      value: boatCopy.value[level],
      subValue: hour ? boatCopy.atHour(hour) : boatCopy.subValue[level],
    };
  }

  // Strong wind (≥5 Bft — meltemi territory): even a genuinely sheltered beach gets real chop,
  // so never imply low/little waves here. Keep the honest "relatively more sheltered" framing,
  // but make clear the sea will have waves.
  if (windBeaufort >= 5 && !isExposed) {
    const hasBigWaves = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 1.2;
    const value = hasBigWaves
      ? { en: 'Rough sea', gr: 'Έντονος κυματισμός', de: 'Raue See', it: 'Mare mosso', fr: 'Mer agitée' }[language]
      : { en: 'Choppy', gr: 'Κυματισμός', de: 'Unruhig', it: 'Mosso', fr: 'Clapot' }[language];
    const subValue = canClaimWindProtection
      ? { en: 'More sheltered, but still some chop', gr: 'Πιο προστατευμένη, αλλά θα έχει κύμα', de: 'Geschützter, aber mit Welle', it: 'Più riparata, ma con onda', fr: 'Plus abritée, mais avec du clapot' }[language]
      : { en: 'Prefer a more sheltered spot', gr: 'Καλύτερα πιο προστατευμένο σημείο', de: 'Besser geschützte Stellen', it: 'Meglio punti più riparati', fr: 'Préfère les coins abrités' }[language];
    return { value, subValue };
  }

  if (typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)) {
    if (waveHeightM >= 1.2) {
      return {
        value: { en: 'Rough sea', gr: 'Έντονος κυματισμός', de: 'Raue See', it: 'Mare mosso', fr: 'Mer agitée' }[language],
        subValue: isExposed
          ? windBeaufort === 5
            ? exposedWindLabel
            : { en: 'Use caution for relaxed swimming', gr: 'Θέλει προσοχή για ήρεμο μπάνιο', de: 'Vorsicht beim entspannten Schwimmen', it: 'Serve cautela per nuotare rilassati', fr: 'Prudence pour une baignade detendue' }[language]
          : windBeaufort === 5
            ? { en: 'The sea will have waves.', gr: 'Η θάλασσα θα έχει κυματισμό.', de: 'Wellen erfordern Vorsicht', it: 'Serve cautela con le onde', fr: 'Prudence avec les vagues' }[language]
            : { en: 'Wave caution still matters', gr: 'Θέλει προσοχή στο κύμα', de: 'Wellen erfordern Vorsicht', it: 'Serve cautela con le onde', fr: 'Prudence avec les vagues' }[language],
      };
    }

    if (windBeaufort <= 3 && waveHeightM < 0.5) {
      return {
        value: { en: 'Manageable sea', gr: 'Ήπια θάλασσα', de: 'Handhabbare See', it: 'Mare gestibile', fr: 'Mer gérable' }[language],
        subValue: undefined,
      };
    }

    if (windBeaufort <= 3 && waveHeightM < 0.8) {
      return {
        value: { en: `Some chop ${day}`, gr: 'Λίγος κυματισμός', de: 'Etwas unruhig', it: 'Un po mosso', fr: 'Un peu de clapot' }[language],
        subValue: { en: 'Use a bit of caution at more open spots.', gr: 'Θέλει λίγη προσοχή σε πιο ανοιχτά σημεία.', de: 'An offeneren Stellen etwas vorsichtig sein.', it: 'Serve un po’ di cautela nei punti più aperti.', fr: 'Un peu de prudence dans les zones plus ouvertes.' }[language],
      };
    }

    if (waveHeightM >= 0.8) {
      return {
        value: { en: 'Choppy', gr: 'Κυματισμός', de: 'Unruhig', it: 'Mosso', fr: 'Clapot' }[language],
        // The stronger "caution, especially with children" line is reserved for 4 Bft+. At <=3 Bft
        // the wind is light, so a 0.8 m reading is mild swell — that warning overstated the risk.
        subValue: windBeaufort === 5
          ? { en: 'The sea will have some chop.', gr: 'Η θάλασσα θα έχει κυματισμό.', de: 'Vorsicht, besonders mit Kindern.', it: 'Serve cautela, soprattutto con bambini.', fr: 'Prudence, surtout avec des enfants.' }[language]
          : windBeaufort <= 3
            ? { en: 'Use a bit of caution at more open spots.', gr: 'Θέλει λίγη προσοχή σε πιο ανοιχτά σημεία.', de: 'An offeneren Stellen etwas vorsichtig sein.', it: 'Serve un po’ di cautela nei punti più aperti.', fr: 'Un peu de prudence dans les zones plus ouvertes.' }[language]
            : { en: 'Use caution, especially with children.', gr: 'Θέλει προσοχή, ειδικά με παιδιά.', de: 'Vorsicht, besonders mit Kindern.', it: 'Serve cautela, soprattutto con bambini.', fr: 'Prudence, surtout avec des enfants.' }[language],
      };
    }
  }

  if (seaScore >= 8) {
    // isExposed here is the map-aligned flag (see caller): never call a red-pin beach
    // "sheltered", even if its static protection claim and a calm score would allow it.
    const verifiedProtectedCalm = canClaimWindProtection && seaCalmClaimAllowed && !isExposed;
    const verifiedShelter = canClaimWindProtection && !isExposed;
    return {
      value: { en: 'Good sea', gr: 'Καλή εικόνα', de: 'Gute See', it: 'Buon mare', fr: 'Bonne mer' }[language],
      subValue: verifiedProtectedCalm
        ? lowWavesShelteredLabel
        : verifiedShelter
          ? shelteredWindLabel
          : { en: 'Good sea conditions', gr: 'Καλές συνθήκες θάλασσας', de: 'Gute Meeresbedingungen', it: 'Buone condizioni del mare', fr: 'Bonnes conditions de mer' }[language],
    };
  }

  if (seaScore >= 5) {
    const lightWindCopy = { en: 'Wind should not be a major issue', gr: 'Ο άνεμος δεν φαίνεται να είναι πρόβλημα', de: 'Wind ist kein Hauptfaktor', it: 'Il vento non dovrebbe pesare', fr: 'Le vent ne devrait pas compter' }[language];
    const cautionCopy = isExposed
      ? (windBeaufort >= 5
        ? (windBeaufort === 5
          ? exposedWindLabel
          : { en: 'Likely choppy', gr: 'Πιθανό κύμα', de: 'Wahrscheinlich unruhig', it: 'Probabile mare mosso', fr: 'Clapot probable' }[language])
        : { en: 'May feel breezy', gr: 'Μπορεί να έχει αέρα', de: 'Kann windig wirken', it: 'Può essere ventilata', fr: 'Peut être ventee' }[language])
      : (windBeaufort >= 5
        ? (windBeaufort === 5
          ? shelteredWindLabel
          : { en: 'Prefer more sheltered spots', gr: 'Καλύτερα πιο προστατευμένο σημείο', de: 'Besser geschützte Stellen', it: 'Meglio punti più riparati', fr: 'Préfère les coins abrités' }[language])
        : { en: 'Some wind - prefer shelter', gr: 'Λίγη έκθεση στον άνεμο', de: 'Etwas Windschutz prufen', it: 'Un po’ di vento', fr: 'Un peu de vent' }[language]);
    return {
      value: { en: 'Manageable sea', gr: 'Πιο ήπια θάλασσα', de: 'Handhabbare See', it: 'Mare gestibile', fr: 'Mer gérable' }[language],
      subValue: windBeaufort < 4 ? lightWindCopy : cautionCopy,
    };
  }

  return {
    value: windBeaufort === 5
      ? { en: 'Choppy', gr: 'Κυματισμός', de: 'Schlecht', it: 'Scarse', fr: 'Mauvaises' }[language]
      : language === 'gr' ? `Θέλει προσοχή ${day}` : language === 'en' ? `Use caution ${day}` : { de: 'Vorsicht', it: 'Prudenza', fr: 'Prudence' }[language],
    subValue: windBeaufort === 5
      ? (isExposed
        ? exposedWindLabel
        : shelteredWindLabel)
      : { en: 'Choose a more sheltered beach', gr: 'Προτίμησε πιο απάνεμη παραλία', de: 'Wähle einen geschützteren Strand', it: 'Scegli una spiaggia più riparata', fr: 'Choisis une plage plus abritée' }[language],
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
      title: { en: `Most suitable time ${selectedDayPrefix}`, gr: `Καταλληλότερη ώρα ${selectedDayPrefix}`, de: 'Am ehesten machbares Zeitfenster', it: 'Momento più gestibile', fr: 'Moment le plus gérable' }[language],
      helper: { en: 'This is the better window based on wind and sea conditions.', gr: 'Αυτό είναι το καλύτερο διαθέσιμο διάστημα με βάση τον άνεμο και τη θάλασσα.', de: 'Wenn du gehst, ist dies voraussichtlich das besser handhabbare Zeitfenster, aber Vorsicht bleibt noetig.', it: 'Se vai, questa e probabilmente la fascia più gestibile, ma serve comunque cautela.', fr: 'Si vous y allez, c est probablement le creneau le plus gérable, mais la prudence reste necessaire.' }[language],
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

import { canOpenNavigation, openNavigation } from '../utils/navigation';
import { NavigationBadge } from '../components/NavigationBadge';
import { displayBeachName, localizedPaidEntryLabel, localizedPaidEntryExplanation, localizedPaidEntryVerifyNote, localizedFreeAccessLabel, localizedFreeAccessExplanation } from '../utils/localization';

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
  /** Real region id of this beach's island (e.g. "south-aegean-milos"); used to
   *  build links to the island's pre-rendered guide articles. Omitted for the
   *  cross-region "Κοντά μου" view, where there is no single island. */
  regionId?: string;
  detailDataStatus?: 'idle' | 'loading' | 'ready' | 'partial';
  beachWeatherById?: BeachWeatherById;
  geospatialExposureProfiles?: Record<number, GeospatialExposureProfile>;
  weatherSource?: WeatherSource;
  /** Authoritative map-marker exposure level for this beach, taken from the region
   *  map (single island wind) so the detail map colours the pin identically instead
   *  of re-deriving a different colour from the per-beach cluster wind. */
  mapExposureLevelOverride?: ExposureLevel;
  /** The hour the global slider is showing (0-23), so the wave strip marks the right bar. */
  selectedHour?: number;
  /** SAFETY hard cutoff: the region forecast is >3 h old and could not be refreshed. When
   *  true, every wind/sea/score/verdict block is blanked and a banner is shown; only the
   *  static content (name, photo, access, map, info) stays. Never show stale conditions. */
  conditionsUnavailable?: boolean;
  /** Real fetch time of the last known forecast, for the "last forecast HH:MM" stamp. */
  lastForecastAt?: Date | null;
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
  regionId,
  detailDataStatus = 'idle',
  beachWeatherById,
  geospatialExposureProfiles,
  weatherSource = 'island-fallback',
  mapExposureLevelOverride,
  selectedHour,
  conditionsUnavailable = false,
  lastForecastAt
}) => {
  // Hard-cutoff gate: hide every live wind/sea/score/verdict block, keep static content.
  const showConditions = !conditionsUnavailable;
  const isFavorite = favorites.includes(beach.id);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const beachDisplayName = displayBeachName(beach.name, language);
  const islandDisplayName = islandName || 'Greece';
  const [storyExpanded, setStoryExpanded] = useState(false);
  // The editorial corpus is lazy-loaded (kept out of the eager detail bundle), so the story
  // resolves asynchronously; the "Πληροφορίες" section streams in once it's ready. Null while
  // loading and when the beach has no story. Reset on beach change so the old text can't flash.
  const [beachStory, setBeachStory] = useState<BeachStory | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBeachStory(null);
    getBeachStory(beach, regionId).then(story => { if (!cancelled) setBeachStory(story); });
    return () => { cancelled = true; };
  }, [beach.id, beach.regionId, beach.sourceBeachId, regionId]);
  const storyLocale: 'gr' | 'en' = language === 'gr' ? 'gr' : 'en';
  const guideLinks = useMemo(() => getIslandGuideLinks(allBeaches, regionId, language), [allBeaches, regionId, language]);
  const selectedDate = dayForecast.date;
  const selectedDayPrefix = getSelectedDayPrefix(selectedDate, new Date(), language);
  // Read-back: don't re-ask for feedback on the same beach + day we already have it for
  // (roadmap #7 — the buttons used to reappear after reload because only local state gated them).
  const feedbackDateKey = selectedDate ? selectedDate.toISOString().slice(0, 10) : '';
  const feedbackAlreadyGiven = useMemo(
    () => getFeedback().some(f => f.beachId === beach.id && f.conditions?.date === feedbackDateKey),
    [beach.id, feedbackDateKey]
  );
  const selectedDayIsToday = selectedDayPrefix === (language === 'gr' ? 'σήμερα' : 'today');
  const copy = {
    whyToday: { en: `What to expect ${selectedDayPrefix}`, gr: `Τι να περιμένεις ${selectedDayPrefix}`, de: 'Was dich erwartet', it: 'Cosa aspettarsi', fr: `À quoi s'attendre` },
    sea: { en: 'Sea', gr: 'Θάλασσα', de: 'Meer', it: 'Mare', fr: 'Mer' },
    waterTemp: { en: 'Water', gr: 'Νερό', de: 'Wasser', it: 'Acqua', fr: 'Eau' },
    airTemp: { en: 'Air temperature', gr: 'Θερμοκρασία αέρα', de: 'Lufttemperatur', it: 'Temperatura aria', fr: 'Temperature de l air' },
    bestTime: { en: 'Best Time', gr: 'Ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    toVisit: { en: 'To visit', gr: 'Για επίσκεψη', de: 'Zum Besuch', it: 'Per visitare', fr: 'Pour visiter' },
    bestSwim: { en: `Best swimming time ${selectedDayPrefix}`, gr: `Καλύτερη ώρα για μπάνιο ${selectedDayPrefix}`, de: 'Beste Badezeit', it: 'Ora migliore per nuotare', fr: 'Meilleur moment pour se baigner' },
    feedbackTitle: { en: 'How accurate was our forecast?', gr: 'Πόσο σωστή ήταν η πρόβλεψή μας;', de: 'Wie genau war unsere Vorhersage?', it: 'Quanto era accurata la previsione?', fr: 'À quel point notre prévision était-elle juste ?' },
    feedbackText: { en: 'Your feedback helps us improve our recommendations for everyone.', gr: 'Η γνώμη σου μας βοηθά να βελτιώνουμε τις προτάσεις για όλους.', de: 'Dein Feedback hilft uns, die Empfehlungen für alle zu verbessern.', it: 'Il tuo feedback ci aiuta a migliorare i consigli per tutti.', fr: 'Votre avis nous aide a ameliorer les recommandations pour tous.' },
    nearby: { en: 'Nearby Recommendations', gr: 'Κοντινές προτάσεις', de: 'Empfehlungen in der Nahe', it: 'Consigli nelle vicinanze', fr: 'Recommandations proches' },
    decisionSummary: { en: selectedDayIsToday ? 'Today summary' : `Summary ${selectedDayPrefix}`, gr: `Σύνοψη για ${selectedDayPrefix}`, de: 'Kurzfassung', it: 'Riepilogo', fr: 'Resume' },
    conditions: { en: `Conditions ${selectedDayPrefix}`, gr: `Συνθήκες ${selectedDayPrefix}`, de: 'Bedingungen', it: 'Condizioni', fr: 'Conditions' },
    beachStoryHeading: { en: 'About this beach', gr: 'Πληροφορίες', de: 'Über diesen Strand', it: 'Informazioni', fr: 'À propos' },
    conditionsUnavailableTitle: { en: 'Conditions are not available right now', gr: 'Οι συνθήκες δεν είναι διαθέσιμες τώρα', de: 'Die Bedingungen sind derzeit nicht verfügbar', it: 'Le condizioni non sono disponibili al momento', fr: 'Les conditions ne sont pas disponibles pour le moment' },
    conditionsUnavailableBody: { en: 'We could not refresh the forecast, so wind and sea conditions are hidden to avoid an out-of-date reading. Beach info below is still accurate.', gr: 'Δεν μπορέσαμε να ανανεώσουμε την πρόγνωση, γι’ αυτό κρύβουμε άνεμο και θάλασσα ώστε να μη δώσουμε παρωχημένη εικόνα. Οι πληροφορίες της παραλίας παρακάτω ισχύουν.', de: 'Wir konnten die Vorhersage nicht aktualisieren, daher sind Wind- und Seebedingungen ausgeblendet. Die Strandinfos unten bleiben gültig.', it: 'Non siamo riusciti ad aggiornare la previsione, quindi vento e mare sono nascosti. Le info sulla spiaggia restano valide.', fr: 'Nous n’avons pas pu actualiser la prévision ; le vent et la mer sont masqués. Les infos plage ci-dessous restent valables.' },
    lastForecastAt: { en: (time: string) => `Last forecast: ${time}`, gr: (time: string) => `Τελευταία πρόγνωση: ${time}`, de: (time: string) => `Letzte Vorhersage: ${time}`, it: (time: string) => `Ultima previsione: ${time}`, fr: (time: string) => `Dernière prévision : ${time}` },
    guidesHeading: { en: 'Beach guides', gr: 'Οδηγοί παραλιών', de: 'Strandführer', it: 'Guide spiagge', fr: 'Guides plages' },
    readMore: { en: 'Read more', gr: 'Διάβασε περισσότερα', de: 'Mehr lesen', it: 'Leggi di più', fr: 'Lire plus' },
    readLess: { en: 'Show less', gr: 'Λιγότερα', de: 'Weniger', it: 'Meno', fr: 'Moins' },
    windShort: { en: 'Wind', gr: 'Άνεμος', de: 'Wind', it: 'Vento', fr: 'Vent' },
    temperatureShort: { en: 'Temperature', gr: 'Θερμοκρασία', de: 'Temperatur', it: 'Temperatura', fr: 'Temperature' },
    locationTitle: { en: 'Location', gr: 'Πού βρίσκεται', de: 'Lage', it: 'Posizione', fr: 'Localisation' },
    openNavigation: { en: 'Open navigation', gr: 'Άνοιγμα πλοήγησης', de: 'Navigation offnen', it: 'Apri navigazione', fr: 'Ouvrir la navigation' },
    navigation: { en: 'Navigation', gr: 'Πλοήγηση', de: 'Navigation', it: 'Navigazione', fr: 'Navigation' },
    bestWindow: { en: 'Best time', gr: 'Καλύτερα', de: 'Beste Zeit', it: 'Meglio', fr: 'Meilleur moment' },
    visitWindow: { en: 'Good time to visit', gr: 'Καλή ώρα για επίσκεψη', de: 'Gute Besuchszeit', it: 'Buon momento per visitare', fr: 'Bon moment pour visiter' },
    away: { en: 'away', gr: 'μακριά', de: 'entfernt', it: 'di distanza', fr: 'de distance' },
    nearbyIntro: { en: 'If you do not go here, these are the best nearby fallbacks:', gr: 'Αν δεν πας εδώ, αυτές είναι οι καλύτερες κοντινές εναλλακτικές:', de: 'Falls du nicht hierhin gehst, sind das gute Alternativen in der Nahe:', it: 'Se non vai qui, queste sono buone alternative vicine:', fr: 'Si vous ne venez pas ici, voici les meilleures alternatives proches :' },
    share: { en: 'Share', gr: 'Κοινοποίηση', de: 'Teilen', it: 'Condividi', fr: 'Partager' },
    favorite: { en: 'Favorite', gr: 'Αγαπημένο', de: 'Favorit', it: 'Preferito', fr: 'Favori' },
    back: { en: 'Back to beaches', gr: 'Πίσω στις παραλίες', de: 'Zuruck zu den Stranden', it: 'Torna alle spiagge', fr: 'Retour aux plages' },
    mapUnavailable: { en: 'The map could not load right now.', gr: 'Ο χάρτης δεν φορτώθηκε τώρα.', de: 'Die Karte konnte gerade nicht geladen werden.', it: 'La mappa non si e caricata.', fr: 'La carte n a pas pu se charger.' },
    campingTitle: { en: 'Camping nearby', gr: 'Camping κοντά', de: 'Camping in der Nahe', it: 'Campeggi nelle vicinanze', fr: 'Camping a proximite' },
    campingWebsite: { en: 'Website', gr: 'Ιστότοπος', de: 'Website', it: 'Sito web', fr: 'Site web' },
    campingSource: { en: 'Campsite data from OpenStreetMap.', gr: 'Δεδομένα camping από το OpenStreetMap.', de: 'Campingplatz-Daten von OpenStreetMap.', it: 'Dati dei campeggi da OpenStreetMap.', fr: 'Donnees des campings via OpenStreetMap.' },
    paidEntrySource: { en: 'Source', gr: 'Πηγή', de: 'Quelle', it: 'Fonte', fr: 'Source' },
  };

  // Organized campsites within ~2.5 km (OSM). Detail metadata carries the full list (≤3);
  // the top-level field may be the summary-trimmed single — prefer whichever is richer.
  const nearbyCampsites = (beach.metadata?.nearbyCamping?.length ? beach.metadata.nearbyCamping : beach.nearbyCamping) ?? [];
  const paidEntry = beach.paidEntry ?? beach.metadata?.paidEntry;

  // Scroll to top on mount and track view
  useEffect(() => {
    scrollToPageTop();
    trackEvent('beach_detail_opened', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandDisplayName,
      beach_name: beach.name.en,
      source: 'detail_page',
      ...buildBeachExposureParams(beach),
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

  const handleFeedback = (verdict: ConditionFeedbackVerdict) => {
    // Pair the observed verdict with the modeled conditions so an offline pass can later
    // calibrate this beach/sector (roadmap #7). exposureLevel/windDir/windSpeedKmh are
    // derived below; this handler only runs on click, after they are initialised.
    storeConditionFeedback(beach.id, verdict, {
      exposureLevel,
      beaufort: getBeaufortLevel(windSpeedKmh),
      windDir,
      date: selectedDate ? selectedDate.toISOString().slice(0, 10) : undefined,
    });
    setFeedbackSubmitted(true);
  };

  const handleNavigation = () => {
    if (!canOpenNavigation(beach)) {
      return;
    }

    trackEvent('navigation_clicked', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandDisplayName,
      beach_name: beach.name.en,
      source: 'detail_page',
      ...buildBeachExposureParams(beach),
    });
    openNavigation(beach);
  };
  const canNavigate = canOpenNavigation(beach);

  // 1. Calculate Conditions & Scores
  // The per-beach cluster forecast is kept ONLY for the "a bit windier/calmer right here"
  // note (see localWindNote below). The headline wind, wave and verdict all read from the
  // AREA (island) forecast so the detail page shows the SAME figure as the card — one
  // consistent number, immediately, instead of a per-beach value that contradicts the list.
  const beachSpecificWeatherData = beachWeatherById?.[beach.id];
  const weatherData = dayForecast;
  const scoringHourlyForecast = hourlyForecast;
  const scoringWeatherSource: WeatherSource = weatherSource;
  const displayTemp = weatherData.temp_max;
  const windSpeedKmh = weatherData.wind.speed * 3.6;
  const windDir = degToCompass(weatherData.wind.deg);
  const windDirectionLabel = t.windDirectionsAccusative?.[windDir as WindDirection] || t.windDirections[windDir as WindDirection] || windDir;
  const geospatialExposure = geospatialExposureProfiles?.[beach.id];
  const scoreResult = calculateBeachScore(beach, weatherData, userLocation, preferences, {
    weatherSource: scoringWeatherSource,
    hourlyForecast: scoringHourlyForecast,
    geospatialProfile: geospatialExposure,
  });
  const { score, exposureLevel, swimmingComfort, canClaimWindProtection = false, seaCalmClaimAllowed = false } = scoreResult;
  const isExposed = exposureLevel ? exposureLevel !== 'protected' : true;
  const isExposedToTodayWind = exposureLevel ? exposureLevel === 'exposed' : isExposed;
  // The map pin the user sees can read one band redder than the scoring engine (see
  // utils/mapExposure). Any user-facing "sheltered/protected" wording must respect the pin,
  // so reconcile copy inputs to the pin's level — never to the sea SCORE, which stays on the
  // engine level above. Mirrors how the home cards gate their labels (BeachSearcherHome).
  // mapExposureLevelOverride is the region-map-aligned level App feeds in.
  const mapAlignedExposureLevel = mapExposureLevelOverride ?? exposureLevel;
  const isExposedForCopy = isExposedToTodayWind || mapAlignedExposureLevel === 'exposed';
  // Never let a red-pin beach claim wind protection in copy, even if its authored profile /
  // scoring would allow it (same gate as BeachSearcherHome).
  const canClaimWindProtectionForCopy = canClaimWindProtection && mapAlignedExposureLevel !== 'exposed';
  const measuredWaveHeightM = weatherData.marine?.waveHeightM;
  const waveHeightM = scoreResult.waveHeightM ?? measuredWaveHeightM;
  // Cove-aware DISPLAY wave (utils/coveWaveGuard): in a genuinely enclosed cove (blocked shore,
  // short fetch) the live-marine grid cell sits offshore and OVER-reads the near-shore height, so
  // max(measured, modeled) surfaces the wrong (larger) number. There we show the fetch-limited SMB
  // instead — UNLESS meaningful swell is present (it can wrap into the bay, the one real false-calm
  // risk), where we keep max(). DISPLAY ONLY: scoring / level / colour / ranking are untouched
  // (they still use scoreResult.waveHeightM below). swellPresent mirrors assessSwellExposure's
  // hasSwell (presence, not the geometric 'exposed' flag which is structurally false for a blocked
  // cove and would reopen the wrap-in false-calm).
  const swellPresent = (weatherData.marine?.swellWaveHeightM ?? 0) >= 0.5
    && typeof weatherData.marine?.swellWaveDirectionDeg === 'number';
  const coveWave = resolveCoveAwareWaveHeightM({
    geospatialProfile: geospatialExposure,
    facingDeg: scoreResult.facingDeg ?? null,
    windDirectionDeg: weatherData.wind.deg,
    windSpeedKmh,
    measuredWaveHeightM,
    appModeledWaveHeightM: scoreResult.modeledWaveHeightM ?? 0,
    swellPresent,
  });
  // Only OVERRIDE when the cove path is actually taken; otherwise keep the exact prior value so
  // non-cove beaches are byte-for-byte unchanged. The effective value (max of measured + wind-chop
  // floor) is what the verdict badge and the list cards already use, so the figure matches them.
  const displayWaveHeightM = coveWave.coveApplied ? coveWave.waveHeightM : (waveHeightM ?? measuredWaveHeightM);
  // When the cove path is taken we are showing the modeled SMB, not the live grid value → estimate.
  const isWaveEstimate = coveWave.coveApplied || !(typeof measuredWaveHeightM === 'number' && Number.isFinite(measuredWaveHeightM));
  // Swim-hours (08–21) wave series for the selected day. Each hour runs the SAME effective-wave
  // rule as the headline figure (directional fetch + damped SMB + wind-chop floor, then the live
  // marine value when present), so a bar can never contradict the big wave meter beside it.
  const selectedDayKey = selectedDate ? selectedDate.toDateString() : undefined;
  const hourlyWave: HourlyWavePoint[] = useMemo(() => {
    if (!selectedDayKey) return [];
    const dayHours = scoringHourlyForecast.filter(item => {
      const when = new Date(item.dt * 1000);
      if (when.toDateString() !== selectedDayKey) return false;
      const hour = when.getHours();
      return hour >= 8 && hour <= 21;
    });
    const hourItems = new Map(dayHours.map(item => [new Date(item.dt * 1000).getHours(), item]));
    const points: HourlyWavePoint[] = [];
    for (const point of computeHourlyEffectiveWaves(beach, dayHours, geospatialExposure)) {
      // Apply the SAME cove-aware guard per hour so a bar can never contradict the big meter above:
      // where the cove path fires for that hour, the bar shows the fetch-limited SMB, not the
      // offshore grid over-read. Non-cove hours stay exactly as computeHourlyEffectiveWaves gives.
      let waveM = point.effectiveWaveHeightM;
      const item = hourItems.get(point.hour);
      if (item && geospatialExposure) {
        const hourSwellPresent = (item.marine?.swellWaveHeightM ?? 0) >= 0.5
          && typeof item.marine?.swellWaveDirectionDeg === 'number';
        const hourCove = resolveCoveAwareWaveHeightM({
          geospatialProfile: geospatialExposure,
          facingDeg: scoreResult.facingDeg ?? null,
          windDirectionDeg: item.wind.deg,
          windSpeedKmh: item.wind.speed * 3.6,
          measuredWaveHeightM: item.marine?.waveHeightM,
          appModeledWaveHeightM: 0,
          swellPresent: hourSwellPresent,
        });
        if (hourCove.coveApplied) waveM = hourCove.waveHeightM;
      }
      // A truly flat hour with no measured value carries no signal — leave it out so the strip
      // shows up only when there is something to read.
      if (!point.hasMeasured && waveM <= 0) continue;
      if (points.some(existing => existing.hour === point.hour)) continue;
      points.push({ hour: point.hour, waveHeightM: waveM });
    }
    return points;
  }, [beach, scoringHourlyForecast, geospatialExposure, selectedDayKey, scoreResult.facingDeg]);
  const seaTemperatureC = weatherData.marine?.seaSurfaceTemperatureC;
  const waterTempDescriptor = typeof seaTemperatureC === 'number'
    ? seaTemperatureC < 20
      ? { en: 'cold', gr: 'κρύο', de: 'kalt', it: 'fredda', fr: 'froide' }[language]
      : seaTemperatureC < 23
        ? { en: 'cool', gr: 'δροσερό', de: 'kühl', it: 'fresca', fr: 'fraîche' }[language]
        : seaTemperatureC <= 26
          ? { en: 'pleasant', gr: 'ιδανικό', de: 'angenehm', it: 'piacevole', fr: 'agréable' }[language]
          : { en: 'warm', gr: 'ζεστό', de: 'warm', it: 'calda', fr: 'chaude' }[language]
    : undefined;
  // R1: mirror the ranking's direct-swell detection so the DISPLAYED sea sub-score drops the
  // protected/partial wave floor exactly when the ranking does — otherwise a west-facing cove on
  // real ground swell shows an optimistic sea score while being correctly down-ranked.
  const directSwellHere = assessSwellExposure(geospatialExposure, scoreResult.facingDeg ?? null, {
    swellDirectionDeg: weatherData.marine?.swellWaveDirectionDeg,
    swellHeightM: weatherData.marine?.swellWaveHeightM,
    swellPeriodS: weatherData.marine?.swellWavePeriodS,
  }).exposed;
  const seaConditionScore = calculateSeaConditionScore(isExposed, windSpeedKmh, exposureLevel, waveHeightM, directSwellHere);
  const detailBadgeScore = getDetailBadgeScore(score, seaConditionScore, isExposed);
  const beaufortLevel = getBeaufortLevel(windSpeedKmh);
  const isBoatOnlyBeach = hasBoatOnlyAccess(beach);
  const seaConditionDisplay = getSeaConditionDisplay(seaConditionScore, isExposedForCopy, language, selectedDate, canClaimWindProtection, seaCalmClaimAllowed, beaufortLevel, displayWaveHeightM, selectedHour, isBoatOnlyBeach);
  const boatRideConditionLabel = {
    en: 'Ride',
    gr: 'Συνθήκες πλεύσης',
    de: 'Fahrt',
    it: 'Tragitto',
    fr: 'Trajet',
  }[language];
  // Compare the beach-specific cluster forecast with the area-wide forecast only
  // when they genuinely differ — "a bit windier/calmer right here".
  const localWindNote = getLocalWindNote(dayForecast.wind.speed, beachSpecificWeatherData?.wind.speed, language);
  const aiExplanation = generateServiceBeachExplanation(beach, weatherData, score, userLocation, language, geospatialExposure);
  const waveCondition = getWaveCondition(isExposed, windSpeedKmh);

  // "Weather & sea now" block copy — targets the "καιρός/weather {beach}" query.
  // Client-only + hydrated with live values, so "now" wording is truthful and it
  // never enters the prerendered static HTML the SEO honesty guards scan. The
  // dynamic text varies per beach from orientation/protectedFrom (no boilerplate
  // across ~2.700 pages). dataReady gates the live numbers so no fake values show.
  const weatherNowDataReady = Number.isFinite(weatherData?.wind?.speed) && Number.isFinite(weatherData?.wind?.deg);
  const weatherNow = useMemo(() => buildWeatherNowContent({
    beachName: beachDisplayName,
    language,
    isToday: selectedDayIsToday,
    dataReady: weatherNowDataReady,
    windDir: windDir as WindDirection,
    beaufort: beaufortLevel,
    waveHeightM: displayWaveHeightM,
    isWaveEstimate,
    protectedFrom: Array.isArray(beach.protectedFrom) ? beach.protectedFrom : [],
    // Keep the sentence honest against the pin the user sees: use the region-map-aligned
    // exposure override when present, else the scoring level.
    mapExposureLevel: mapExposureLevelOverride ?? exposureLevel,
    faces: beach.orientation?.faces ?? [],
    canClaimWindProtection,
    isExposedToTodayWind,
    seaConditionScore,
    isBoatAccess: isBoatOnlyBeach,
  }), [beachDisplayName, language, selectedDayIsToday, weatherNowDataReady, windDir, beaufortLevel, displayWaveHeightM, isWaveEstimate, beach.protectedFrom, beach.orientation?.faces, canClaimWindProtection, isExposedToTodayWind, mapExposureLevelOverride, exposureLevel, seaConditionScore, isBoatOnlyBeach]);
  const weatherNowToneClass = weatherNow.tone === 'calm'
    ? 'bg-emerald-50 text-emerald-700'
    : weatherNow.tone === 'choppy'
      ? 'bg-orange-50 text-orange-700'
      : 'bg-amber-50 text-amber-700';

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
  
  // Peak UV during core beach hours (10:00–17:00). Only surfaced when actionable (≥6).
  const peakUvIndex = useMemo(() => {
    const beachHourUv = scoringHourlyForecast
      .filter(item => {
        const hour = new Date(item.dt * 1000).getHours();
        return hour >= 10 && hour <= 17 && typeof item.uvIndex === 'number';
      })
      .map(item => item.uvIndex as number);
    return beachHourUv.length > 0 ? Math.max(...beachHourUv) : undefined;
  }, [scoringHourlyForecast]);
  const uvDescriptor = typeof peakUvIndex === 'number'
    ? peakUvIndex >= 11
      ? { en: 'extreme', gr: 'ακραίο', de: 'extrem', it: 'estremo', fr: 'extrême' }[language]
      : peakUvIndex >= 8
        ? { en: 'very high', gr: 'πολύ υψηλό', de: 'sehr hoch', it: 'molto alto', fr: 'très élevé' }[language]
        : { en: 'high', gr: 'υψηλό', de: 'hoch', it: 'alto', fr: 'élevé' }[language]
    : undefined;
  const sunsetTime = useMemo(() => {
    // All beaches are in Greece, so anchor sunset to Athens wall-clock (handles DST)
    // rather than the viewer's timezone — a tourist abroad still sees Greek local time.
    const athensOffsetMinutes = Math.round(
      (new Date(selectedDate.toLocaleString('en-US', { timeZone: 'Europe/Athens' })).getTime()
        - new Date(selectedDate.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) / 60000
    );
    const sunset = getSunsetTime(beach.coordinates.lat, beach.coordinates.lon, selectedDate, athensOffsetMinutes);
    if (!sunset) return undefined;
    const hh = String(sunset.getHours()).padStart(2, '0');
    const mm = String(sunset.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [beach.coordinates.lat, beach.coordinates.lon, selectedDate]);

  // Rain warning: name the hours it is expected to rain and advise against
  // staying in the sea then (lightning/storm safety).
  const rainAdvisory = useMemo(
    () => getRainSwimAdvisory(scoringHourlyForecast, selectedDate, language),
    [scoringHourlyForecast, selectedDate, language],
  );

  // 2. Best Time & Planner
  const bestTime = useMemo(() => calculateBestBeachTime(scoringHourlyForecast, beach), [beach, scoringHourlyForecast]);
  const usefulBestTimeWindow = Boolean(bestTime && hasUsefulTimeWindow(bestTime.bestStart, bestTime.bestEnd));
  const bestTimeReason = bestTime
    ? {
      en: 'Use this window before the wind reaches 4 Beaufort or more later.',
      gr: 'Προτίμησε αυτό το διάστημα πριν ο άνεμος ανέβει σε 4 μποφόρ ή παραπάνω.',
      de: 'Nutze dieses Zeitfenster, bevor der Wind später 4 Bft oder mehr erreicht.',
      it: 'Preferisci questa fascia prima che il vento salga a 4 Beaufort o oltre.',
      fr: 'Privilégie ce créneau avant que le vent monte à 4 Beaufort ou plus.',
    }[language]
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
    : '';
  const displayedBestTimeLabel = usefulBestTimeWindow ? canonicalBestTimeLabel : '';
  const swimmingWindowHelper = swimWindowDisplay.helper || bestTimeReason;
  // Calm day: no narrow "best window" exists because every hour is suitable. Instead of
  // hiding the section entirely (a value gap), affirm that any time works.
  const allDaySuitable = Boolean(bestTime) && !usefulBestTimeWindow && swimWindowDisplay.tone === 'good';
  const allDaySwimCopy = {
    title: { en: `Good to swim all day`, gr: `Κατάλληλη όλη μέρα`, de: 'Den ganzen Tag gut', it: 'Adatta tutto il giorno', fr: 'Bonne toute la journée' }[language],
    helper: { en: 'Calm conditions with no strong wind today — any time works.', gr: 'Ήρεμες συνθήκες χωρίς δυνατό άνεμο σήμερα — οποιαδήποτε ώρα είναι καλή.', de: 'Ruhige Bedingungen ohne starken Wind heute.', it: 'Condizioni calme senza vento forte oggi.', fr: 'Conditions calmes sans vent fort aujourd’hui.' }[language],
  };
  const amenityChips = getAmenityChips(beach, language);
  // Per-facility chips (parking/beachBar/…) always mirror a yes/no row below, so we
  // keep only the summary chips that carry information the rows don't.
  const summaryAmenityChips = amenityChips.filter(chip =>
    chip.key === 'organizedFacilities' || chip.key === 'noFacilities'
    || chip.key === 'seasonalFacilities' || chip.key === 'unknownFacilities');
  const amenityRows = getAmenityStatusRows(beach, language);
  const showAmenityDisclaimer = shouldShowAmenityDisclaimer(beach);

  // "What to bring" — derived only from THIS beach's real gaps, never generic.
  // Each item appears solely when the facility is CONFIRMED absent (status 'no'),
  // never when it is merely unknown — we don't tell people to pack for ignorance.
  const amenityAvailable = (key: 'beachBar' | 'sunbeds' | 'foodNearby' | 'cafeNearby' | 'snackCanteen') =>
    amenityRows.some(row => row.key === key && (row.status === 'yes' || row.status === 'seasonal' || row.status === 'limited'));
  const amenityConfirmedAbsent = (key: 'beachBar' | 'sunbeds' | 'foodNearby' | 'cafeNearby' | 'snackCanteen') =>
    amenityRows.some(row => row.key === key && row.status === 'no');
  const hasFoodOnSite = amenityAvailable('beachBar') || amenityAvailable('foodNearby')
    || amenityAvailable('cafeNearby') || amenityAvailable('snackCanteen');
  const foodConfirmedAbsent = !hasFoodOnSite
    && (amenityConfirmedAbsent('beachBar') || amenityConfirmedAbsent('foodNearby') || amenityConfirmedAbsent('cafeNearby'));
  // naturalShade is a definite boolean in the dataset, so `=== false` is confirmed.
  const shadeConfirmedAbsent = beach.amenities.naturalShade === false && !amenityAvailable('sunbeds');
  const hasPebblesOrRocks = beach.beachType === 'pebbles' || beach.beachType === 'sandy-pebbles' || beach.beachType === 'rocky';
  const whatToBringItems = [
    foodConfirmedAbsent && { en: 'Water & snacks', gr: 'Νερό & σνακ', de: 'Wasser & Snacks', it: 'Acqua e snack', fr: 'Eau et snacks' }[language],
    shadeConfirmedAbsent && { en: 'Umbrella or shade', gr: 'Ομπρέλα ή σκίαση', de: 'Sonnenschirm oder Schatten', it: 'Ombrellone o riparo', fr: 'Parasol ou ombre' }[language],
    shadeConfirmedAbsent && { en: 'Sunscreen', gr: 'Αντηλιακό', de: 'Sonnencreme', it: 'Crema solare', fr: 'Crème solaire' }[language],
    hasPebblesOrRocks && { en: 'Water shoes', gr: 'Παπούτσια θαλάσσης', de: 'Badeschuhe', it: 'Scarpe da scoglio', fr: 'Chaussures d eau' }[language],
  ].filter((item): item is string => Boolean(item));
  const whatToBringTitle = { en: 'What to bring', gr: 'Τι να φέρεις', de: 'Was mitnehmen', it: 'Cosa portare', fr: 'Quoi apporter' }[language];

  const seatracAccess = getSeatracAccess(beach);
  const showAccessibilitySection = hasSeatracInfo(beach);
  const accessibilityRows = showAccessibilitySection ? getAccessibilityStatusRows(beach, language) : [];
  // 3. Nearby Beaches
  const nearbyBeaches = useMemo(() => {
    const others = allBeaches.filter(b => b.id !== beach.id);
    const nearby = others.filter(b => {
      const dist = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
      return dist <= 20; // 20km radius
    });

    // Get proportional nearby recommendations from these beaches.
    const recommendations = getTopRecommendedBeaches(
      nearby,
      dayForecast,
      userLocation,
      hourlyForecast,
      preferences,
      language,
      // No cluster map: nearby cards read the AREA wind, same as the main headline.
      undefined,
      geospatialExposureProfiles
    );
    return recommendations.map(rec => {
      const b = nearby.find(nb => nb.id === rec.beachId);
      if (!b) return null;
      const dist = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
      return { ...rec, beach: b, distance: dist, geospatialExposure: geospatialExposureProfiles?.[b.id] };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [allBeaches, beach, dayForecast, userLocation, hourlyForecast, preferences, language, geospatialExposureProfiles]);

  // Local-summer-wind seasonal shelter atlas: this cove's behaviour in the region's
  // regime (meltemi N+NE / maistros NW+W) + the island's reliably-sheltered coves.
  // Endorsement is gated to genuinely 'protected' profiles with non-low confidence —
  // forward-looking climatology, not today's wind. Curated knowledge vetoes raw
  // geometry: wind-sport spots / explicit exposures / suspect pins never appear.
  const windContext = getRegionWindContext(regionId ?? '');
  const localWindSectors = LOCAL_WIND_SECTORS[windContext];
  const localWindExposure = summarizeLocalWindBehavior(geospatialExposure, beach, localWindSectors);
  const localWindShelteredCoves = useMemo<LocalWindShelteredCove[]>(() => {
    return allBeaches
      .filter(b => b.id !== beach.id)
      .map(b => {
        const profile = geospatialExposureProfiles?.[b.id];
        if (!profile || profile.confidence === 'low') return null;
        if (summarizeLocalWindBehavior(profile, b, localWindSectors) !== 'protected') return null;
        const distanceKm = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
        return { id: b.id, name: displayBeachName(b.name, language), distanceKm };
      })
      .filter((c): c is LocalWindShelteredCove => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [allBeaches, beach.id, beach.coordinates.lat, beach.coordinates.lon, geospatialExposureProfiles, language, localWindSectors]);

  // Swell-window router: assess THIS cove against today's ground swell (geometry-based), and —
  // only when a genuine long-period ground swell is running — rank the island's swell-flat coves.
  const thisSwell = assessSwellExposure(geospatialExposure, scoreResult.facingDeg ?? null, {
    swellDirectionDeg: weatherData.marine?.swellWaveDirectionDeg,
    swellHeightM: weatherData.marine?.swellWaveHeightM,
    swellPeriodS: weatherData.marine?.swellWavePeriodS,
  });
  const swellFromLabel = thisSwell.directionDeg !== undefined
    ? (t.windDirections[degToCompass(thisSwell.directionDeg) as WindDirection] || degToCompass(thisSwell.directionDeg))
    : '';
  const swellShelteredCoves = useMemo<SwellShelteredCove[]>(() => {
    if (!thisSwell.meaningful) return [];
    const swellInput = {
      swellDirectionDeg: weatherData.marine?.swellWaveDirectionDeg,
      swellHeightM: weatherData.marine?.swellWaveHeightM,
      swellPeriodS: weatherData.marine?.swellWavePeriodS,
    };
    return allBeaches
      .filter(b => b.id !== beach.id)
      .map(b => {
        const profile = geospatialExposureProfiles?.[b.id];
        if (!profile || profile.confidence === 'low') return null;
        if (assessSwellExposure(profile, profile.facingDeg ?? null, swellInput).exposed) return null;
        const distanceKm = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
        return { id: b.id, name: displayBeachName(b.name, language), distanceKm };
      })
      .filter((c): c is SwellShelteredCove => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [thisSwell.meaningful, weatherData.marine?.swellWaveDirectionDeg, weatherData.marine?.swellWaveHeightM, weatherData.marine?.swellWavePeriodS, allBeaches, beach.id, beach.coordinates.lat, beach.coordinates.lon, geospatialExposureProfiles, language]);

  // "Switch beach": when THIS beach can't claim shelter from today's (meaningful) wind, find the
  // nearest reachable beach that genuinely CAN — under the same live wind, via its own 8-sector
  // geometry. Gated on canClaimProtected (same bar as the "πιο προστατευμένη επιλογή" endorsement) so we
  // never send someone to a beach that isn't actually calmer; capped to a reachable radius.
  const switchBeach = useMemo<{ beach: Beach; distanceKm: number } | null>(() => {
    if (canClaimWindProtection || beaufortLevel < 4) return null;
    const windDeg = weatherData.wind.deg;
    const windDir = degToCompass(windDeg) as WindDirection;
    const waveM = weatherData.marine?.waveHeightM;
    const candidates = allBeaches
      .filter(b => b.id !== beach.id)
      .map(b => {
        const profile = geospatialExposureProfiles?.[b.id];
        if (!profile || profile.confidence === 'low') return null;
        const distanceKm = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
        if (distanceKm > 25) return null;
        const assessment = assessBeachWindExposure({
          beach: b,
          geospatialProfile: profile,
          windDirectionDeg: windDeg,
          windDirection: windDir,
          windSpeedKmh,
          beaufort: beaufortLevel,
          waveHeightMeters: waveM,
        });
        if (!assessment.canClaimProtected) return null;
        return { beach: b, distanceKm };
      })
      .filter((c): c is { beach: Beach; distanceKm: number } => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return candidates[0] ?? null;
  }, [canClaimWindProtection, beaufortLevel, weatherData.wind.deg, windSpeedKmh, weatherData.marine?.waveHeightM, allBeaches, beach.id, beach.coordinates.lat, beach.coordinates.lon, geospatialExposureProfiles]);
  const switchBeachWindLabel = switchBeach
    ? (t.windDirectionsAccusative?.[degToCompass(weatherData.wind.deg) as WindDirection] || t.windDirections[degToCompass(weatherData.wind.deg) as WindDirection] || degToCompass(weatherData.wind.deg))
    : '';

  // Accessible + calm + reachable TODAY: only on accessible beaches, list nearby beaches that
  // are BOTH verified-accessible (Seatrac, ramp not uninstalled) AND sheltered from today's
  // wind (canClaimProtected; on light-wind days any accessible beach qualifies). Nearest first.
  const accessibleCalmNearby = useMemo<AccessibleCalmCove[]>(() => {
    if (!showAccessibilitySection) return [];
    const windDeg = weatherData.wind.deg;
    const windDir = degToCompass(windDeg) as WindDirection;
    const waveM = weatherData.marine?.waveHeightM;
    return allBeaches
      .filter(b => b.id !== beach.id)
      .map(b => {
        const access = getSeatracAccess(b);
        if (!access?.hasSeatrac || access.status === 'uninstalled') return null;
        const profile = geospatialExposureProfiles?.[b.id];
        let calm: boolean;
        if (profile && profile.confidence !== 'low') {
          const a = assessBeachWindExposure({
            beach: b, geospatialProfile: profile, windDirectionDeg: windDeg, windDirection: windDir,
            windSpeedKmh, beaufort: beaufortLevel, waveHeightMeters: waveM,
          });
          calm = a.canClaimProtected || a.exposureLevel === 'protected';
        } else {
          calm = beaufortLevel <= 3;
        }
        if (!calm) return null;
        const distanceKm = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
        return { id: b.id, name: displayBeachName(b.name, language), distanceKm };
      })
      .filter((c): c is AccessibleCalmCove => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
  }, [showAccessibilitySection, weatherData.wind.deg, weatherData.marine?.waveHeightM, windSpeedKmh, beaufortLevel, allBeaches, beach.id, beach.coordinates.lat, beach.coordinates.lon, geospatialExposureProfiles, language]);

  // Constraint-fit TODAY: show a use-case only when this beach genuinely clears it today —
  // toddler-safe (shallow/family + calm + no rain-at-swim), snorkeling (flat water), or a
  // sunset swim (west-facing + calm). Static guides can't make these live intersections.
  const constraintFits = useMemo<ConstraintFit[]>(() => {
    const fits: ConstraintFit[] = [];
    // "Calm" here is a claim that the SEA is genuinely mild — only true in light wind with a
    // small wave. Being merely wind-sheltered (canClaimWindProtection) is NOT enough: at 4-6 Bft
    // even a protected beach can see ~1+ m waves, so we never call it "ήρεμα" at that wind.
    const calm = beaufortLevel <= 3 && (typeof waveHeightM !== 'number' || waveHeightM <= 0.5);
    const lowWaves = (waveHeightM ?? 1) < 0.4;
    const shallow = beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow';
    const family = beach.environment?.familyFriendly === true;
    if ((shallow || family) && calm && !rainAdvisory) fits.push({ key: 'kids' });
    if (beach.activities?.snorkeling === true && (lowWaves || calm)) fits.push({ key: 'snorkel' });
    const facing = scoreResult.facingDeg;
    if (typeof facing === 'number' && facing >= 200 && facing <= 340 && calm) fits.push({ key: 'sunset' });
    return fits;
  }, [canClaimWindProtection, beaufortLevel, waveHeightM, rainAdvisory, beach, scoreResult.facingDeg]);

  // Day-plan sequencer (sunset leg): if THIS beach isn't itself a west-facing cove that's calm
  // today, pair it with the nearest one that is — "swim here now, sunset swim there". West-facing
  // is facingDeg 200–340; calm uses today's wind via each cove's own geometry. Reachable radius.
  const sunsetLeg = useMemo<{ beach: Beach; distanceKm: number } | null>(() => {
    const thisFacing = scoreResult.facingDeg;
    const thisCalm = canClaimWindProtection || beaufortLevel <= 3;
    if (typeof thisFacing === 'number' && thisFacing >= 200 && thisFacing <= 340 && thisCalm) return null;
    const windDeg = weatherData.wind.deg;
    const windDir = degToCompass(windDeg) as WindDirection;
    const waveM = weatherData.marine?.waveHeightM;
    const candidates = allBeaches
      .filter(b => b.id !== beach.id)
      .map(b => {
        const profile = geospatialExposureProfiles?.[b.id];
        if (!profile || profile.confidence === 'low') return null;
        const facing = profile.facingDeg;
        if (typeof facing !== 'number' || facing < 200 || facing > 340) return null;
        const distanceKm = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
        if (distanceKm > 25) return null;
        const a = assessBeachWindExposure({
          beach: b, geospatialProfile: profile, windDirectionDeg: windDeg, windDirection: windDir,
          windSpeedKmh, beaufort: beaufortLevel, waveHeightMeters: waveM,
        });
        if (!a.canClaimProtected) return null;
        return { beach: b, distanceKm };
      })
      .filter((c): c is { beach: Beach; distanceKm: number } => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return candidates[0] ?? null;
  }, [scoreResult.facingDeg, canClaimWindProtection, beaufortLevel, weatherData.wind.deg, weatherData.marine?.waveHeightM, windSpeedKmh, allBeaches, beach.id, beach.coordinates.lat, beach.coordinates.lon, geospatialExposureProfiles]);

  // 3-stop day plan: morning swim here (if swimmable today) → midday shade & food (here or the
  // nearest beach with both) → sunset swim (here if west-facing+calm, else the sunset leg above).
  const dayPlanStops = useMemo<DayPlanStop[]>(() => {
    const stops: DayPlanStop[] = [];
    const hasShadeFood = (b: Beach) => b.amenities?.naturalShade === true && (b.amenities?.taverna === true || b.amenities?.restaurant === true);

    if (swimmingComfort !== 'avoid_swimming') {
      stops.push({ slot: 'morning', beachName: beachDisplayName, isHere: true });
    }

    if (hasShadeFood(beach)) {
      stops.push({ slot: 'midday', beachName: beachDisplayName, isHere: true });
    } else {
      let best: { beach: Beach; distanceKm: number } | null = null;
      for (const b of allBeaches) {
        if (b.id === beach.id || !hasShadeFood(b)) continue;
        const d = calculateDistance(beach.coordinates.lat, beach.coordinates.lon, b.coordinates.lat, b.coordinates.lon);
        if (d > 25) continue;
        if (!best || d < best.distanceKm) best = { beach: b, distanceKm: d };
      }
      if (best) {
        const lunch = best;
        stops.push({ slot: 'midday', beachName: displayBeachName(lunch.beach.name, language), isHere: false, distanceKm: lunch.distanceKm, onOpen: () => onBeachClick(lunch.beach) });
      }
    }

    const thisFacing = scoreResult.facingDeg;
    const thisIsSunset = typeof thisFacing === 'number' && thisFacing >= 200 && thisFacing <= 340 && (canClaimWindProtection || beaufortLevel <= 3);
    if (thisIsSunset) {
      stops.push({ slot: 'sunset', beachName: beachDisplayName, isHere: true });
    } else if (sunsetLeg) {
      stops.push({ slot: 'sunset', beachName: displayBeachName(sunsetLeg.beach.name, language), isHere: false, distanceKm: sunsetLeg.distanceKm, onOpen: () => onBeachClick(sunsetLeg.beach) });
    }

    // Only a real itinerary if it involves moving to at least one other cove.
    return stops.some(s => !s.isHere) ? stops : [];
  }, [swimmingComfort, beach, beachDisplayName, allBeaches, language, scoreResult.facingDeg, canClaimWindProtection, beaufortLevel, sunsetLeg, onBeachClick]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        trackEvent('share_clicked', beach.id, {
          locale: language === 'gr' ? 'el' : 'en',
          region: islandDisplayName,
          beach_name: beach.name.en,
          source: 'detail_page',
          ...buildBeachExposureParams(beach),
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
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors ${isFavorite ? 'text-red-500 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Heart className={`w-6 h-6 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button 
            type="button"
            onClick={handleShare}
            aria-label={copy.share[language]}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
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

        {conditionsUnavailable && (
          <section role="status" data-nosnippet="true" className="flex items-start gap-3 rounded-[1.75rem] border border-slate-300 bg-white/95 p-4 shadow-sm shadow-slate-900/5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-sm font-black leading-snug text-slate-950">{copy.conditionsUnavailableTitle[language]}</h2>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-600">{copy.conditionsUnavailableBody[language]}</p>
              {lastForecastAt && (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {copy.lastForecastAt[language](lastForecastAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                </p>
              )}
            </div>
          </section>
        )}

        {/* 1. Decision summary */}
        <section className="space-y-4 rounded-[2rem] border border-white/75 bg-white/88 p-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-sm sm:p-5" data-nosnippet="true">
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-cyan-700 tracking-normal">
              {copy.decisionSummary[language]}
            </p>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="font-heading text-3xl font-bold leading-[1.12] text-slate-950 sm:text-4xl">
                  {beachDisplayName}
                </h2>
                <p className="text-sm text-slate-700 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{islandDisplayName}</span>
                </p>
              </div>
            </div>
          </div>

          {showConditions && (
          <TodayScoreBadge
            score={detailBadgeScore}
            language={language}
            selectedDate={selectedDate}
            windBeaufort={beaufortLevel}
            waveHeightM={waveHeightM}
            swimmingComfort={swimmingComfort}
            noIdealSwimmingWindow={swimWindowDisplay.tone === 'avoid'}
            exposureLevel={mapAlignedExposureLevel}
            canClaimWindProtection={canClaimWindProtectionForCopy}
            selectedHour={selectedHour}
            boatAccess={isBoatOnlyBeach}
            forceShow
          />
          )}

          <div className="hidden md:flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(beach.id)}
              aria-label={copy.favorite[language]}
              className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border transition-colors ${isFavorite ? 'border-red-100 bg-red-50 text-red-500' : 'border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              aria-label={copy.share[language]}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </section>

        {showConditions && (<>
        {/* Weather & sea now — targets the "καιρός/weather {beach}" intent. The
            <h2>, the orientation description and the verdict pill are stable or
            no more volatile than the "τώρα" in the heading, so they stay crawlable
            (snippet-eligible — the verdict is the CTR hook). Only the raw numbers
            (wind Bft, wave m) and the live sentence carry data-nosnippet, so
            Google never freezes a stale value into a SERP snippet. Client-only:
            this never enters the static prerendered HTML, so "now/live" wording
            stays out of what the SEO honesty guards scan. No JSON-LD — the honest
            answer includes live values we must not put in structured data. */}
        <section className="space-y-3 rounded-[2rem] border border-sky-100 bg-white/90 p-4 shadow-sm shadow-sky-900/5 sm:p-5">
          <h2 className="font-heading text-xl font-bold leading-tight text-slate-950">{weatherNow.heading}</h2>
          <p className="text-sm leading-relaxed text-slate-700">{weatherNow.stableDescription}</p>
          {weatherNow.tone === 'unknown' ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" aria-hidden="true" />
              {weatherNow.loadingLabel}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Verdict is the CTR hook and no more volatile than the "τώρα" in
                    the <h2> — kept crawlable/snippet-eligible for the same reason. */}
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${weatherNowToneClass}`}>
                  {weatherNow.verdict}
                </span>
                {/* Only the raw numbers carry data-nosnippet, so Google never
                    freezes a stale "5 Bft" / "~0.9 m" into a SERP snippet. */}
                <span data-nosnippet="true" className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-900">
                  <Wind className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{weatherNow.windLabel}: </span>{weatherNow.windValue}
                </span>
                <span data-nosnippet="true" className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-900">
                  <Waves className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">{weatherNow.waveLabel}: </span>{weatherNow.waveValue}
                </span>
              </div>
              {/* Live sentence names the current wind/Bft → volatile, nosnippet. */}
              <p data-nosnippet="true" className="text-sm leading-relaxed text-slate-700">{weatherNow.liveSentence}</p>
            </div>
          )}
        </section>

        {/* Today's conditions — surfaced right under the verdict, led by the wave graphic. */}
        <section className="space-y-3" data-nosnippet="true">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.conditions[language]}</h3>
          <WaveHeightGraphic
            variant="full"
            waveHeightM={displayWaveHeightM}
            isEstimate={isWaveEstimate}
            estimateHeightM={coveWave.coveApplied ? coveWave.waveHeightM : scoreResult.modeledWaveHeightM}
            hourly={hourlyWave}
            language={language}
            selectedDate={selectedDate}
            selectedHour={selectedHour}
            boatAccess={isBoatOnlyBeach}
            windBeaufort={beaufortLevel}
            exposureLevel={mapAlignedExposureLevel}
            canClaimWindProtection={canClaimWindProtectionForCopy}
          />
          {/* Two-dimensional "calm water / strong wind" cove card — display only, renders only in
              the decoupling case (enclosed cove + strong wind). Explains why the pin reads breezy
              while the water is flat; never recommends. See utils/coveWaveGuard. */}
          {coveWave.coveApplied && beaufortLevel >= 4 && typeof coveWave.fetchKm === 'number' && (
            <CoveConditionsCard
              beachId={beach.id}
              waveHeightM={displayWaveHeightM}
              windSpeedKmh={windSpeedKmh}
              windBeaufort={beaufortLevel}
              onshore={coveWave.onshore ?? 0}
              fetchKm={coveWave.fetchKm}
              fetchDirectionLabel={t.windDirections[windDir as WindDirection] || windDir}
              language={language}
            />
          )}
          <div className={`grid grid-cols-2 gap-2.5 ${typeof seaTemperatureC === 'number' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            <ConditionCard
              icon={<Wind className="w-5 h-5 text-blue-500" />}
              label={copy.windShort[language]}
              value={`${windSpeedKmh.toFixed(0)} km/h · ${windDirectionLabel}`}
              subValue={`${beaufortLevel} ${t.units.beaufort}`}
            />
            <ConditionCard
              icon={isBoatOnlyBeach ? <Ship className="w-5 h-5 text-cyan-500" /> : <Waves className="w-5 h-5 text-cyan-500" />}
              label={isBoatOnlyBeach ? boatRideConditionLabel : copy.sea[language]}
              value={seaConditionDisplay.value}
              subValue={seaConditionDisplay.subValue}
            />
            {typeof seaTemperatureC === 'number' && (
              <ConditionCard
                icon={<Droplets className="w-5 h-5 text-sky-500" />}
                label={copy.waterTemp[language]}
                value={`${seaTemperatureC.toFixed(0)}°C`}
                subValue={waterTempDescriptor}
              />
            )}
            <ConditionCard
              icon={<Thermometer className="w-5 h-5 text-orange-500" />}
              label={copy.temperatureShort[language]}
              value={`${displayTemp.toFixed(0)}°C`}
              subValue={copy.airTemp[language]}
            />
          </div>
          {localWindNote && (
            <p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
              localWindNote.tone === 'windier'
                ? 'bg-amber-50/70 text-amber-800'
                : 'bg-teal-50/70 text-teal-800'
            }`}>
              {localWindNote.tone === 'windier'
                ? <Wind className="h-4 w-4 shrink-0" aria-hidden="true" />
                : <Leaf className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{localWindNote.text}</span>
            </p>
          )}
        </section>

        {/* 1b. Swell-window router — surfaces only on genuine ground swell: warns when this
            cove is secretly breaking despite calm wind, or routes to coves still flat today. */}
        <SwellRouterSection
          language={language}
          beachName={beachDisplayName}
          swell={thisSwell}
          swellFromLabel={swellFromLabel}
          windBeaufort={beaufortLevel}
          shelteredCoves={swellShelteredCoves}
          onSelect={(id) => {
            const target = allBeaches.find(b => b.id === id);
            if (target) onBeachClick(target);
          }}
        />

        {/* 1c. Switch beach — nearest beach sheltered from today's wind, when this one isn't. */}
        {switchBeach && (
          <SwitchBeachCard
            language={language}
            targetName={displayBeachName(switchBeach.beach.name, language)}
            distanceKm={switchBeach.distanceKm}
            windFromLabel={switchBeachWindLabel}
            onOpen={() => onBeachClick(switchBeach.beach)}
          />
        )}

        {/* 1d. Constraint-fit today — kids / snorkeling / sunset, only when it genuinely fits. */}
        <ConstraintFitSection language={language} fits={constraintFits} />
        </>)}

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
                <p className="px-1 text-[11px] font-medium leading-snug text-slate-700">
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


        {/* 4a. About this beach — curated history/geology/character (own section so
            the "Συνθήκες" heading stays about today's weather, not beach info) */}
        {beachStory && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
              <ScrollText className="h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
              {copy.beachStoryHeading[language]}
            </h3>
            <div className="rounded-2xl border border-slate-200/70 bg-white/55 px-4 py-3.5">
              {beachStory.title[storyLocale] && (
                <p className="text-sm font-semibold text-teal-700">{beachStory.title[storyLocale]}</p>
              )}
              <div className="mt-2 space-y-2">
                {(storyExpanded ? beachStory.paragraphs[storyLocale] : beachStory.paragraphs[storyLocale].slice(0, 1)).map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-slate-600">{paragraph}</p>
                ))}
              </div>
              {beachStory.paragraphs[storyLocale].length > 1 && (
                <button
                  type="button"
                  onClick={() => setStoryExpanded((prev) => !prev)}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:text-teal-800"
                  aria-expanded={storyExpanded}
                >
                  {storyExpanded ? copy.readLess[language] : copy.readMore[language]}
                  <ChevronRight className={`h-4 w-4 transition-transform ${storyExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        )}

        {/* 4b. Sun & light — sunset always, peak UV only when actionable (≥6). Hidden with
            conditions since peak UV is forecast-derived (stale). */}
        {showConditions && (sunsetTime || (typeof peakUvIndex === 'number' && peakUvIndex >= 6)) && (
          <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-amber-100/70 bg-amber-50/45 px-4 py-3" data-nosnippet="true">
            {sunsetTime && (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                <Sun className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                {{ en: 'Sunset', gr: 'Δύση', de: 'Sonnenuntergang', it: 'Tramonto', fr: 'Coucher' }[language]} {sunsetTime}
              </span>
            )}
            {typeof peakUvIndex === 'number' && peakUvIndex >= 6 && (
              <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-900">
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-extrabold text-white tabular-nums">
                  {peakUvIndex.toFixed(0)}
                </span>
                {{ en: 'UV', gr: 'UV', de: 'UV', it: 'UV', fr: 'UV' }[language]} {uvDescriptor}
                {shadeConfirmedAbsent && ` · ${{ en: 'no shade here', gr: 'καθόλου σκιά εδώ', de: 'kein Schatten hier', it: 'niente ombra qui', fr: 'pas d ombre ici' }[language]}`}
              </span>
            )}
          </section>
        )}

        {/* 4c. Rain warning — name the rainy hours and advise leaving the sea then */}
        {showConditions && rainAdvisory && (
          <section
            className="flex items-start gap-3 rounded-[1.75rem] border border-sky-200/80 bg-sky-50/70 p-4 shadow-sm shadow-sky-900/5"
            role="alert"
            data-nosnippet="true"
          >
            <div className="shrink-0 rounded-2xl bg-sky-500 p-2.5 text-white shadow-sm">
              <Droplets className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sky-900">{rainAdvisory.title}</h3>
              <p className="mt-1 text-sm font-medium leading-snug text-sky-900/85">
                {rainAdvisory.body}
              </p>
            </div>
          </section>
        )}

        {/* 5. Best Time Today */}
        {showConditions && bestTime && (usefulBestTimeWindow || allDaySuitable) && (
          <section className={`flex items-start gap-3 rounded-[1.75rem] border p-4 shadow-sm ${swimWindowToneClasses.section}`} data-nosnippet="true">
            <div className={`rounded-2xl p-2.5 text-white shadow-sm ${swimWindowToneClasses.icon}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold ${swimWindowToneClasses.title}`}>
                {allDaySuitable ? allDaySwimCopy.title : swimWindowDisplay.title}
              </h3>
              {!allDaySuitable && displayedBestTimeLabel && (
                <p className={`text-lg font-bold ${swimWindowToneClasses.value}`}>
                  {displayedBestTimeLabel}
                </p>
              )}
              <p className={`text-sm font-medium mt-1 leading-snug ${swimWindowToneClasses.helper}`}>
                {allDaySuitable ? allDaySwimCopy.helper : swimmingWindowHelper}
              </p>
            </div>
          </section>
        )}

        {/* 7. Amenities */}
        <section className="space-y-3">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{t.amenitiesTitle}</h3>
          {/* Only summary chips (organized / none / seasonal / unknown) — per-facility
              chips like "Parking nearby" would just duplicate the yes/no rows below. */}
          {summaryAmenityChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {summaryAmenityChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex min-h-9 items-center rounded-full border border-white/80 bg-white/88 px-3 text-xs font-semibold text-slate-700 shadow-sm shadow-sky-900/5"
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {amenityRows.filter((row) => row.status !== 'unknown').map((row) => (
              <div key={row.key} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/88 px-3 py-2 shadow-sm shadow-sky-900/5">
                <span className="min-w-0 text-sm font-bold text-slate-700">{row.label}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${amenityStatusClass(row.status)}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {showAmenityDisclaimer && (
            <p className="px-1 text-xs font-semibold leading-snug text-slate-700">
              {getAmenityDisclaimer(language)}
            </p>
          )}
        </section>

        {/* 7a-0. Paid entry — "you pay to be here" (entrance fee / private club / sunbed-only).
            Each kind gets its own honest explanation; never a vague "paid" tag. */}
        {paidEntry && (
          <section className="flex items-start gap-3 rounded-[1.75rem] border border-amber-200/80 bg-amber-50/70 p-4 shadow-sm shadow-amber-900/5">
            <div className="shrink-0 rounded-2xl bg-amber-500 p-2.5 text-white shadow-sm">
              {paidEntry.kind === 'entrance_fee'
                ? <Ticket className="h-5 w-5" aria-hidden />
                : <Euro className="h-5 w-5" aria-hidden />}
            </div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="font-bold text-amber-950">{localizedPaidEntryLabel(paidEntry.kind, language)}</h3>
              <p className="text-sm font-semibold leading-snug text-amber-900">
                {localizedPaidEntryExplanation(paidEntry.kind, language)}
              </p>
              {paidEntry.priceText && (
                <p className="text-sm font-bold text-amber-950">{paidEntry.priceText}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs font-semibold text-amber-800">
                {paidEntry.needsVerification && <span>{localizedPaidEntryVerifyNote(language)}</span>}
                {(paidEntry.sourceUrls?.[0] || paidEntry.osmUrl) && (
                  <a
                    href={paidEntry.sourceUrls?.[0] ?? paidEntry.osmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
                  >
                    {copy.paidEntrySource[language]} <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 7a-1. Free / public access — the honest counterpart to the paid badge. Shown when we
            hold NO paid-entry record. Not a verified per-beach claim: it states the Greek legal
            default (public shore) plus an explicit "no fee on record" caveat, so "free or pay?"
            always has an answer without overclaiming on un-audited beaches. */}
        {!paidEntry && (
          <section className="flex items-start gap-3 rounded-[1.75rem] border border-emerald-200/70 bg-emerald-50/50 p-4 shadow-sm shadow-emerald-900/5">
            <div className="shrink-0 rounded-2xl bg-emerald-500 p-2.5 text-white shadow-sm">
              <Waves className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="font-bold text-emerald-950">{localizedFreeAccessLabel(language)}</h3>
              <p className="text-sm font-semibold leading-snug text-emerald-900">
                {localizedFreeAccessExplanation(language)}
              </p>
            </div>
          </section>
        )}

        {/* 7a. What to bring — derived from amenity gaps */}
        {whatToBringItems.length > 0 && (
          <section className="flex items-start gap-3 rounded-[1.75rem] border border-amber-100/80 bg-amber-50/70 p-4 shadow-sm shadow-amber-900/5">
            <div className="rounded-2xl bg-amber-400 p-2.5 text-white shadow-sm">
              <Backpack className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-amber-950">{whatToBringTitle}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {whatToBringItems.map((item) => (
                  <span key={item} className="inline-flex min-h-8 items-center rounded-full border border-amber-200 bg-white/80 px-3 text-xs font-bold text-amber-900">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 7a-2. Camping nearby (organized campsites within ~2.5 km, from OSM) */}
        {nearbyCampsites.length > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
              <Tent className="h-5 w-5 text-emerald-700" aria-hidden />
              {copy.campingTitle[language]}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {nearbyCampsites.map((camp) => {
                const distanceLabel = camp.distanceMeters < 1000
                  ? `${Math.round(camp.distanceMeters / 10) * 10} m`
                  : `${(camp.distanceMeters / 1000).toFixed(1)} km`;
                return (
                  <div key={camp.id} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/88 px-3 py-2 shadow-sm shadow-sky-900/5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{camp.name}</p>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {distanceLabel} {copy.away[language]}
                        {camp.website && (
                          <>
                            {' · '}
                            <a
                              href={camp.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-sky-700 underline decoration-sky-300 underline-offset-2"
                            >
                              {copy.campingWebsite[language]}
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${camp.coordinates.lat},${camp.coordinates.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${copy.openNavigation[language]}: ${camp.name}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Navigation className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                );
              })}
            </div>
            <p className="px-1 text-[11px] font-semibold leading-snug text-slate-500">{copy.campingSource[language]}</p>
          </section>
        )}

        {/* 7b. Accessibility (disabled / wheelchair sea-access) */}
        {showAccessibilitySection && seatracAccess && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
              <Accessibility className="h-5 w-5 text-sky-700" aria-hidden />
              {getAccessibilitySectionTitle(language)}
            </h3>
            <p className="px-1 text-sm font-bold text-slate-700">{getAccessibilityHeadline(beach, language)}</p>

            {seatracAccess.status === 'uninstalled' && (
              <div role="alert" className="flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold leading-snug text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{getAccessibilityHeadline(beach, language)}</span>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {accessibilityRows.map((row) => (
                <div key={row.key} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/88 px-3 py-2 shadow-sm shadow-sky-900/5">
                  <span className="min-w-0 text-sm font-bold text-slate-700">{row.label}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${amenityStatusClass(row.status)}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2.5">
              {seatracAccess.seasonal && (
                <p className="text-xs font-semibold leading-snug text-slate-600">{getAccessibilitySeasonalNote(language)}</p>
              )}
              {seatracAccess.needsVerification && (
                <p className="text-xs font-semibold leading-snug text-slate-600">{getAccessibilityVerifyNote(language)}</p>
              )}
              {(seatracAccess.verifiedAt || seatracAccess.sourceUrls?.length) && (
                <p className="flex flex-wrap items-center gap-1 pt-0.5 text-[11px] font-bold text-slate-700">
                  {seatracAccess.verifiedAt && (
                    <span>{getAccessibilityCheckedLabel(language)}: {seatracAccess.verifiedAt}</span>
                  )}
                  {seatracAccess.sourceUrls?.[0] && (
                    <a
                      href={seatracAccess.sourceUrls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-700 underline decoration-sky-300 underline-offset-2"
                    >
                      seatrac.gr <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </p>
              )}
            </div>
          </section>
        )}

        {/* 7b-1. Accessible + calm today: nearby beaches that clear both the accessibility and
            the live-shelter gate. Shown only on accessible beaches. Live-shelter → hidden with conditions. */}
        {showConditions && (
        <AccessibleCalmNearbySection
          language={language}
          items={accessibleCalmNearby}
          onSelect={(id) => {
            const target = allBeaches.find(b => b.id === id);
            if (target) onBeachClick(target);
          }}
        />
        )}

        {/* 7c. Getting there — honest access labels (boat / dirt / 4x4 / hike / car) with a
            caveat where "easy" is only an unverified default. Sits between accessibility and
            the map so the "how do I reach it" answers are grouped. */}
        <GettingThereSection beach={beach} language={language} />

        {/* 8. Map Location */}
        <section className="space-y-3" data-nosnippet="true">
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
                    exposureLevel,
                    orientation: scoreResult.orientation,
                    marine: scoreResult.marine,
                    waveHeightM: scoreResult.waveHeightM,
                    warnings: scoreResult.warnings,
                    confidence: scoreResult.confidence,
                    swimmingComfort,
                    windProfile: scoreResult.windProfile,
                    windProfileSource: scoreResult.windProfileSource,
                    windSector: scoreResult.windSector,
                    canClaimWindProtection,
                    seaCalmClaimAllowed,
                    geospatialExposure,
                    beach,
                    bestBeachTime: bestTime
                  }]}
                  userLocation={userLocation}
                  campsites={nearbyCampsites.map((c) => ({ id: c.id, name: c.name, lat: c.coordinates.lat, lon: c.coordinates.lon }))}
                  center={[beach.coordinates.lat, beach.coordinates.lon]}
                  zoom={14}
                  // Colour the pin from the ISLAND/selected-day wind (dayForecast), the
                  // same basis the region map and the exposure-level override use — NOT the
                  // per-beach cluster wind (weatherData), which drives the score/headline but
                  // would tone the pin off a different Beaufort. The override pins the exposure
                  // LEVEL, but getExposureMarkerTone also keys on Beaufort, so a cluster wind
                  // one band lower (e.g. 2 Bft vs the island's 3) rendered the same beach blue
                  // in the detail map while the region map showed it yellow.
                  // When conditions are stale-blocked, keep the location map but drop the wind so
                  // the pin renders neutral (no stale colour) — matches the region map's behaviour.
                  windSpeed={showConditions ? dayForecast.wind.speed : undefined}
                  windDirection={showConditions ? degToCompass(dayForecast.wind.deg) : undefined}
                  windDirectionDeg={showConditions ? dayForecast.wind.deg : undefined}
                  language={language}
                  islandName={islandName}
                  selectedDate={selectedDate}
                  exposureLevelOverrides={showConditions && mapExposureLevelOverride ? new Map([[beach.id, mapExposureLevelOverride]]) : undefined}
                  compact
                />
              </React.Suspense>
            </MapLoadBoundary>
          </div>
          {canNavigate && (
            <button
              type="button"
              onClick={handleNavigation}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 font-bold text-white shadow-md transition-colors hover:bg-cyan-700"
            >
              <Navigation className="w-5 h-5" />
              {copy.openNavigation[language]}
            </button>
          )}
          {canNavigate && <NavigationBadge beach={beach} language={language} className="mt-2" />}
        </section>

        {/* Feedback System — asks "was our forecast accurate?"; moot when we showed no conditions. */}
        {showConditions && (
        <section className="bg-white p-4 rounded-[1.75rem] border border-slate-100 shadow-sm space-y-4" data-nosnippet="true">
          <div className="space-y-1">
            <h3 className="text-base font-heading font-bold text-slate-900">{copy.feedbackTitle[language]}</h3>
            <p className="text-slate-700 text-sm leading-snug">{copy.feedbackText[language]}</p>
          </div>

          {(feedbackSubmitted || feedbackAlreadyGiven) ? (
            <div
              className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-emerald-700"
            >
              <CheckCircle2 className="w-5 h-5" />
              <p className="font-bold">{{ en: 'Thank you for your feedback!', gr: 'Ευχαριστούμε για το feedback!', de: 'Danke für dein Feedback!', it: 'Grazie per il feedback!', fr: 'Merci pour votre avis !' }[language]}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFeedback('accurate')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-100 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
              >
                <ThumbsUp className="w-4 h-4" />
                {{ en: 'Accurate', gr: 'Σωστό', de: 'Stimmt', it: 'Corretto', fr: 'Exact' }[language]}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('had_waves')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-sky-100 text-sm font-bold text-sky-700 transition-all hover:bg-sky-50 active:scale-95"
              >
                <span aria-hidden>🌊</span>
                {{ en: 'Had waves', gr: 'Είχε κύμα', de: 'Wellen', it: 'Onde', fr: 'Des vagues' }[language]}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('too_windy')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-amber-100 text-sm font-bold text-amber-700 transition-all hover:bg-amber-50 active:scale-95"
              >
                <span aria-hidden>💨</span>
                {{ en: 'Too windy', gr: 'Πολύς αέρας', de: 'Zu windig', it: 'Troppo vento', fr: 'Trop venteux' }[language]}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('calmer')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
              >
                <span aria-hidden>😎</span>
                {{ en: 'Calmer', gr: 'Πιο ήρεμα', de: 'Ruhiger', it: 'Più calmo', fr: 'Plus calme' }[language]}
              </button>
            </div>
          )}
        </section>
        )}

        {/* 8. Nearby Beaches */}
        {/* Day-plan sequencer — morning → midday shade & food → sunset.
            Temporarily hidden via ENABLE_DAY_PLAN_SECTION until reworked. */}
        {ENABLE_DAY_PLAN_SECTION && <DayPlanSection language={language} stops={dayPlanStops} />}

        <LocalWindShelterSection
          language={language}
          windContext={windContext}
          beachName={beachDisplayName}
          thisExposure={localWindExposure}
          shelteredCoves={localWindShelteredCoves}
          isBoatAccess={isBoatOnlyBeach}
          onSelect={(id) => {
            const target = allBeaches.find(b => b.id === id);
            if (target) onBeachClick(target);
          }}
        />

        {showConditions && nearbyBeaches.length > 0 && (
        <section className="space-y-4" data-nosnippet="true">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.nearby[language]}</h3>
          <div className="space-y-3">
            <>
                <p className="text-slate-700 text-sm px-1 leading-snug">
                  {copy.nearbyIntro[language]}
                </p>
                <div className="flex flex-col gap-3">
                  {nearbyBeaches.map((item) => {
                    const itemIsExposed = item.exposureLevel ? item.exposureLevel !== 'protected' : true;
                    const itemWeatherData = dayForecast;
                    const itemWindSpeedKmh = itemWeatherData.wind.speed * 3.6;
                    const itemBeaufortLevel = getBeaufortLevel(itemWindSpeedKmh);
                    const itemWindDir = degToCompass(itemWeatherData.wind.deg);
                    const itemWindDirectionLabel = t.windDirectionsAccusative?.[itemWindDir as WindDirection] || t.windDirections[itemWindDir as WindDirection] || itemWindDir;
                    const itemWaveHeightM = item.waveHeightM ?? itemWeatherData.marine?.waveHeightM ?? waveHeightM;
                    const itemProfile = geospatialExposureProfiles?.[item.beach.id];
                    const itemDirectSwell = itemProfile
                      ? assessSwellExposure(itemProfile, itemProfile.facingDeg ?? null, {
                          swellDirectionDeg: itemWeatherData.marine?.swellWaveDirectionDeg,
                          swellHeightM: itemWeatherData.marine?.swellWaveHeightM,
                          swellPeriodS: itemWeatherData.marine?.swellWavePeriodS,
                        }).exposed
                      : false;
                    const itemSeaScore = calculateSeaConditionScore(itemIsExposed, itemWindSpeedKmh, item.exposureLevel, itemWaveHeightM, itemDirectSwell);
                    const itemBadgeScore = getDetailBadgeScore(item.score, itemSeaScore, itemIsExposed);
                    const itemWindSummary = describeSimpleWindSuitability(item.simpleWindSuitability, language);
                    const itemExplanation = generateUiBeachExplanation({
                      beach: item.beach,
                      language,
                      isExposed: itemIsExposed,
                      exposureLevel: item.exposureLevel,
                      waveCondition: getWaveCondition(itemIsExposed, itemWindSpeedKmh),
                      waveHeightM: itemWaveHeightM,
                      bestBeachTime: bestTime || undefined,
                      windDirectionLabel: itemWindDirectionLabel,
                      windBeaufort: itemBeaufortLevel,
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
                            <p className="text-xs font-bold text-slate-700">
                              {typeof item.distance === 'number' ? `${item.distance.toFixed(1)} km ${copy.away[language]}` : copy.nearby[language]}
                            </p>
                            <TodayScoreBadge
                              score={itemBadgeScore}
                              language={language}
                              selectedDate={selectedDate}
                              windBeaufort={itemBeaufortLevel}
                              waveHeightM={itemWaveHeightM}
                              swimmingComfort={item.swimmingComfort}
                              noIdealSwimmingWindow={item.swimmingComfort === 'avoid_swimming'}
                              exposureLevel={item.exposureLevel}
                              canClaimWindProtection={item.canClaimWindProtection}
                              selectedHour={selectedHour}
                              boatAccess={hasBoatOnlyAccess(item.beach)}
                              forceShow
                            />
                            <p
                              className="text-xs font-semibold text-slate-600 line-clamp-2"
                              data-nosnippet="true"
                            >
                              {itemExplanation.cardSummary || itemWindSummary}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 flex-shrink-0 text-slate-300 group-hover:text-cyan-600 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </>
          </div>
        </section>
        )}

        {/* 9. Beach guides — links to the island's "best X beaches" articles */}
        {guideLinks.length > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
              <Compass className="h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
              {copy.guidesHeading[language]}{islandName ? ` — ${islandName}` : ''}
            </h3>
            <div className="flex flex-wrap gap-2">
              {guideLinks.map((guide) => (
                <a
                  key={guide.key}
                  href={guide.href}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-bold text-teal-700 hover:border-teal-300 hover:bg-teal-50"
                >
                  {guide.label}
                </a>
              ))}
            </div>
          </section>
        )}

      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          {canNavigate && (
            <button
              type="button"
              onClick={handleNavigation}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 font-bold text-white shadow-lg shadow-cyan-200 active:scale-[0.99]"
            >
              <Navigation className="h-5 w-5" />
              {copy.navigation[language]}
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleFavorite(beach.id)}
            aria-label={copy.favorite[language]}
            className={`flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border ${isFavorite ? 'border-red-100 bg-red-50 text-red-500' : 'border-slate-100 bg-slate-50 text-slate-700'}`}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label={copy.share[language]}
            className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-700"
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
  subValue?: string;
}

const ConditionCard: React.FC<ConditionCardProps> = ({ icon, label, value, subValue }) => (
  <div className="bg-white p-3 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-start text-left gap-1.5 min-w-0">
    <div className="p-2 bg-slate-50 rounded-xl">
      {icon}
    </div>
    <span className="text-[10px] font-bold tracking-normal text-slate-600">{label}</span>
    <span className="text-sm font-bold leading-tight text-slate-900 break-words sm:text-base">{value}</span>
    {subValue && <span className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2">{subValue}</span>}
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
      return 'bg-slate-100 text-slate-700';
    case 'unknown':
    default:
      return 'bg-slate-50 text-slate-600';
  }
};
