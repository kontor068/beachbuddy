import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, MapPin, Wind, Waves, Thermometer, Droplets, Leaf,
  Clock, Sun, Sunset, Backpack,
  Navigation, Share2, Heart, ChevronRight, ThumbsUp, ThumbsDown, CheckCircle2,
  Camera, ExternalLink, Accessibility, AlertTriangle, Tent, Ticket, Euro, ScrollText, Compass, Ship, BadgeCheck,
  CloudRain, XCircle, Car, Umbrella
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
  getWeatherGustKmph,
  type BeachWeatherById
} from '../services/recommendationService';
import { lazyWithChunkRecovery } from '../utils/chunkLoadRecovery';
import { degToCompass, calculateDistance, getBeaufortLevel, getWaveCondition } from '../utils/weatherUtils';
import { trackEvent, storeConditionFeedback, getFeedback, ConditionFeedbackVerdict, ObservedTiming, buildBeachExposureParams } from '../services/analyticsService';
import { formatBeaufortLabel } from '../utils/beaufortRange';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import { TodayScoreBadge } from '../components/TodayScoreBadge';
import { BeachAnswerHero, SHELTER_LABEL, SHELTER_WORD_MAX_BEAUFORT, SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT, type PracticalTile } from '../components/BeachAnswerHero';
import { EvidenceSignature } from '../components/EvidenceSignature';
import { getBeachClimate, describeClimateComparison, type ClimateComparison } from '../data/beachClimate';
import { LocalWindShelterSection, type LocalWindShelteredCove } from '../components/LocalWindShelterSection';
import { GettingThereSection, accessKindShortLabel, classifyAccessKind, ACCESS_KIND_ICON } from '../components/GettingThereSection';
import { SwellRouterSection, type SwellShelteredCove } from '../components/SwellRouterSection';
import { assessSwellExposure, SWELL_MIN_HEIGHT_M } from '../utils/swellExposure';
import { buildSteepSeabedNote, buildSteepSeabedSource } from '../utils/seabedEntry';
import { beachShoreBreaks, hasSteepCoarseShore } from '../utils/shoreBreak';
import { resolveOffshoreWindNote } from '../utils/offshoreWindNote';
import { offshoreWindNotePhrase } from '../utils/conditionToneLabels';
import { SwitchBeachCard } from '../components/SwitchBeachCard';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { AccessibleCalmNearbySection, type AccessibleCalmCove } from '../components/AccessibleCalmNearbySection';
import { ConstraintFitSection, type ConstraintFit } from '../components/ConstraintFitSection';
import { WaveHeightGraphic, type HourlyWavePoint } from '../components/WaveHeightGraphic';
import { resolveCoveAwareWaveHeightM } from '../utils/coveWaveGuard';
// Το δάπεδο των 0,10 μ. στον ΤΥΠΩΜΕΝΟ αριθμό — μία υλοποίηση με την κάρτα και την πινέζα.
import { printedWaveHeightM } from '../utils/waveModel';
import { buildShoreIncidenceLine } from '../utils/shoreIncidenceCopy';
import { buildChoppySeaLine } from '../utils/choppySeaCopy';
import { resolveWaterTemperature } from '../utils/waterTemperatureCopy';
import { CoveConditionsCard } from '../components/CoveConditionsCard';
import { hasBoatOnlyAccess } from '../utils/access';
import { getBeachCertification, localizeCertificationNote } from '../utils/certifiedBeaches';
import { DayPlanSection, type DayPlanStop } from '../components/DayPlanSection';
import { generateBeachExplanation as generateUiBeachExplanation } from '../utils/beachExplanation';
import { describeSimpleWindSuitability, describeWindExposure } from '../utils/windExposureCopy';
import type { ExposureLevel } from '../utils/windExposure';
import { getLocalWindNote } from '../utils/localWindNote';
import { getBeachStory, type BeachStory } from '../data/beachStories';
import { getIslandGuideLinks, getGuidesHubLink, GUIDES_HUB_LABEL } from '../utils/beachGuides';
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
import { getWebcamSectionTitle, getWebcamLead, getWebcamDisclaimer, getWebcamCheckedLabel } from '../utils/webcam';
import { MapLoadBoundary } from '../components/MapLoadBoundary';
import { DeferUntilVisible } from '../components/DeferUntilVisible';
import { scrollToPageTop } from '../utils/scroll';
import { getSunsetTime } from '../utils/sunTimes';
import { sunsetOverSeaWindow, sunsetSeasonRange, type SunsetOverSea } from '../utils/sunsetOverSea';
import { buildPhotoSuggestionUrl } from '../utils/photoContribution';
import { getSelectedDayPrefix, getSelectedHourPrefix } from '../utils/dateLabels';
import { athensNow, toAthensWallClock, wallClockDayKey } from '../utils/athensTime';
import { getBoatRideMotionLevel } from '../utils/boatRideMotion';
import { getRainSwimAdvisory } from '../utils/rainAdvisory';
import { summarizeLocalWindBehavior } from '../utils/windClimatology';
import { getRegionWindContext, LOCAL_WIND_SECTORS } from '../utils/localWindContext.mjs';
import { buildWeatherNowContent, directionFromPhrase } from '../utils/weatherNowCopy';
import { beachSentenceName } from '../utils/beachCopy';
import { getPhotoCredit } from '../utils/photoCredit';
import { LegalFooter } from '../components/LegalFooter';
import { translations } from '../translations';

// Temporarily hidden: the "Σχέδιο ημέρας" (Plan your day) section isn't well
// implemented yet — hiding it until we rework it. Flip back to true to re-enable.
const ENABLE_DAY_PLAN_SECTION = false;

// Lazy load map to avoid blocking main thread.
//
// MUST be lazyWithChunkRecovery, never a bare React.lazy: React reads `.default` off
// whatever the import resolves to, so a chunk that fails to arrive throws
// "Cannot read properties of undefined (reading 'default')" (Safari: "undefined is not
// an object (evaluating 's.default')") from inside React's own initialiser, with a
// minified frame and no recovery. That is exactly what reached Telegram on 03/08/2026
// from /it/beaches/lefkada/1154-afteli/ and /de/beaches/mykonos/1963-merchia/ — the
// visitor got the error screen instead of the beach. App.tsx wraps every other lazy
// component; this second copy of the map was the one that was missed.
// `npm run quality:lazy-recovery` now fails the build if a bare React.lazy comes back.
const BeachMap = lazyWithChunkRecovery(() => import('../components/BeachMap'), 'BeachMap');

import { getBeachPhotoLookup } from '../services/beachPhotos';
import { BeachPhotoFallback, deriveShorelineFeatures, ShorelineThumbnail, useShorelineShape } from '../components/ShorelineThumbnail';
import type { ShorelineShape } from '../services/shorelineShapeService';

const getDetailBadgeScore = (score: number, seaScore: number, isExposed: boolean): number => {
  if (seaScore >= 8) return Math.max(score, 76);
  if (!isExposed && seaScore >= 5) return Math.max(score, 50);
  return score;
};

const shorelineCaptionCopy: Record<LanguageCode, { title: string; body: string }> = {
  en: {
    title: 'The shape of this shore',
    body: 'Mapped from the coastline itself. The sea is at the top.',
  },
  gr: {
    title: 'Το σχήμα αυτής της ακτής',
    body: 'Από τη χαρτογράφηση της ίδιας της ακτογραμμής. Η θάλασσα είναι προς τα πάνω.',
  },
  de: {
    title: 'Die Form dieser Küste',
    body: 'Aus der Küstenlinie selbst kartiert. Das Meer liegt oben.',
  },
  it: {
    title: 'La forma di questa costa',
    body: 'Mappata dalla linea di costa stessa. Il mare è in alto.',
  },
  fr: {
    title: 'La forme de ce littoral',
    body: 'Cartographiée depuis le littoral lui-même. La mer est en haut.',
  },
};

const BeachDetailShorelinePanel: React.FC<{
  shape: ShorelineShape;
  beach: Beach;
  beachName: string;
  language: LanguageCode;
}> = ({ shape, beach, beachName, language }) => {
  const copy = shorelineCaptionCopy[language] || shorelineCaptionCopy.en;

  return (
    <div className="overflow-hidden rounded-surface border border-line bg-sky-100 shadow-surface">
      {/* w-full is load-bearing: aspect-[16/9] plus max-h-56 with no explicit width lets the
          browser shrink the WIDTH (not just clamp height) once max-h-56 caps it below the
          16:9-for-full-width value, carving a blank strip beside the drawing. */}
      <div className="relative aspect-[16/9] max-h-56 w-full">
        <ShorelineThumbnail
          shape={shape}
          beachName={beachName}
          language={language}
          features={deriveShorelineFeatures(beach)}
          seed={beach.id}
          size="full"
        />
      </div>
      <div className="border-t border-line bg-white/90 p-3">
        <p className="text-sm font-bold text-cyan-900">{copy.title}</p>
        <p className="mt-1 text-xs font-semibold leading-snug text-slate-600">
          {copy.body}
        </p>
      </div>
    </div>
  );
};

/**
 * Shown only for the ~7% of beaches with neither a photo nor usable coastline geometry.
 * It says nothing on purpose: the ask for a photo belongs to the contribution prompt right
 * below it, phrased as an invitation, not as an apology stamped over every quiet beach.
 */
const BeachDetailPhotoPlaceholder: React.FC = () => {
  return (
    <div
      className="relative aspect-[16/9] max-h-56 overflow-hidden rounded-surface border border-line bg-gradient-to-br from-cyan-50 via-sky-50 to-teal-50 shadow-surface"
      aria-hidden="true"
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
    </div>
  );
};

// `upload` / `addYours` are the in-app path added with accounts; `button` is the
// older external suggestion link, kept as the fallback for signed-out visitors
// and for builds where accounts are unconfigured.
const photoContributionCopy: Record<LanguageCode, {
  title: string;
  body: string;
  button: string;
  buttonLabel: (beachName: string) => string;
  /** Primary CTA once uploading is possible — replaces the external hand-off. */
  upload: string;
  /** Offered under an existing gallery: this beach has a photo, yours may be better. */
  addYours: string;
  /**
   * The prominent version of the same ask, sitting directly under the main
   * photo. Deliberately the SAME request as the landing page's — one invitation
   * in two places, not two competing campaigns — and phrased for a visitor who
   * is already looking at somebody else's picture of this exact beach.
   */
  betterTitle: string;
  betterBody: string;
  betterCta: string;
}> = {
  en: {
    title: 'Have a photo of this beach?',
    body: 'Send us your own photo or a clearly licensed image. Nothing is published without review.',
    button: 'Suggest a photo',
    buttonLabel: (beachName) => `Suggest a photo for ${beachName}`,
    upload: 'Add your photo',
    addYours: 'Add your own photo',
    betterTitle: 'Let the photographer in you out',
    betterBody: 'Your shot will help the next person looking up this beach see what it is really like before they drive out here.',
    betterCta: 'Send yours',
  },
  gr: {
    title: 'Έχεις φωτογραφία αυτής της παραλίας;',
    body: 'Στείλε μας μια δική σου φωτογραφία ή μια εικόνα με ξεκάθαρη άδεια χρήσης. Δεν δημοσιεύεται τίποτα χωρίς έλεγχο.',
    button: 'Πρότεινε φωτογραφία',
    buttonLabel: (beachName) => `Πρότεινε φωτογραφία για την παραλία ${beachSentenceName(beachName, 'gr')}`,
    upload: 'Ανέβασε τη φωτογραφία σου',
    addYours: 'Πρόσθεσε τη δική σου φωτογραφία',
    betterTitle: 'Βγάλε τον φωτογράφο που έχεις μέσα σου',
    betterBody: 'Η δική σου φωτογραφία θα βοηθήσει τον επόμενο που ψάχνει αυτή την παραλία να δει πώς είναι στ’ αλήθεια, πριν κάνει τον δρόμο.',
    betterCta: 'Στείλε τη δική σου',
  },
  de: {
    title: 'Hast du ein Foto von diesem Strand?',
    body: 'Sende uns dein eigenes Foto oder ein klar lizenziertes Bild. Nichts wird ohne Prüfung veröffentlicht.',
    button: 'Foto vorschlagen',
    buttonLabel: (beachName) => `Foto für ${beachName} vorschlagen`,
    upload: 'Dein Foto hochladen',
    addYours: 'Eigenes Foto hinzufügen',
    betterTitle: 'Lass den Fotografen in dir raus',
    betterBody: 'Dein Bild hilft dem Nächsten, der diesen Strand nachschlägt, zu sehen, wie er wirklich ist — bevor er losfährt.',
    betterCta: 'Schick deins',
  },
  it: {
    title: 'Hai una foto di questa spiaggia?',
    body: 'Mandaci una tua foto o un’immagine con licenza chiara. Nulla viene pubblicato senza verifica.',
    button: 'Suggerisci una foto',
    buttonLabel: (beachName) => `Suggerisci una foto per ${beachName}`,
    upload: 'Carica la tua foto',
    addYours: 'Aggiungi la tua foto',
    betterTitle: 'Fai uscire il fotografo che hai dentro',
    betterBody: 'Il tuo scatto aiuterà chi cercherà questa spiaggia dopo di te a capire com’è davvero, prima di mettersi in viaggio.',
    betterCta: 'Manda la tua',
  },
  fr: {
    title: 'Vous avez une photo de cette plage ?',
    body: 'Envoyez votre propre photo ou une image avec une licence claire. Rien n’est publié sans vérification.',
    button: 'Proposer une photo',
    buttonLabel: (beachName) => `Proposer une photo pour ${beachName}`,
    upload: 'Ajouter votre photo',
    addYours: 'Ajouter votre propre photo',
    betterTitle: 'Libérez le photographe qui est en vous',
    betterBody: 'Votre cliché aidera la prochaine personne qui cherche cette plage à voir à quoi elle ressemble vraiment, avant de faire la route.',
    betterCta: 'Envoyez la vôtre',
  },
};

// WHY THE ORDER FLIPPED: this prompt used to offer only the external suggestion
// link, which sent the one visitor willing to give us a photo away to somebody
// else's product to upload it. With accounts, the in-app upload is the primary
// button and the external link stays underneath as the escape hatch — it is
// still the only path when accounts are unconfigured.
const PhotoContributionPrompt: React.FC<{
  beachName: string;
  language: LanguageCode;
  suggestionUrl?: string;
  onClick?: () => void;
  /** Present only when accounts are configured; opens the upload sheet. */
  onAddPhoto?: () => void;
}> = ({ beachName, language, suggestionUrl, onClick, onAddPhoto }) => {
  const copy = photoContributionCopy[language] || photoContributionCopy.en;

  return (
    <div className="rounded-surface border border-cyan-100/75 bg-white/82 p-3.5 shadow-surface backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-control border border-cyan-100 bg-cyan-50 text-cyan-700">
          <Camera className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug text-slate-900">{copy.title}</h3>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{copy.body}</p>

          {onAddPhoto && (
            <button
              type="button"
              onClick={onAddPhoto}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-600 px-4 text-xs font-bold text-white shadow-surface shadow-cyan-200/70 transition-colors hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.upload}
            </button>
          )}

          {suggestionUrl && (
            onAddPhoto ? (
              <a
                href={suggestionUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={copy.buttonLabel(beachName)}
                onClick={onClick}
                className="ml-3 inline-flex min-h-11 items-center gap-1.5 rounded text-xs font-bold text-cyan-800 underline underline-offset-2 transition-colors hover:text-cyan-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {copy.button}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : (
              <a
                href={suggestionUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={copy.buttonLabel(beachName)}
                onClick={onClick}
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-100 bg-cyan-600 px-4 text-xs font-bold text-white shadow-surface shadow-cyan-200/70 transition-colors hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
              >
                {copy.button}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )
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
  boatAccess = false,
  enclosedCove = false
) => {
  const hour = getSelectedHourPrefix(selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(selectedDate, athensNow(), language);
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
    // An ENCLOSED cove (όρμος) with today's wind genuinely blocked and a measured low wave
    // keeps calm water even at 5-6 Bft — saying "Choppy" here contradicted the calm verdict
    // right above it (Άγιος Ερμογένης at 5 Bft N). The claim stays honest: it needs the
    // enclosure geometry AND today's protection claim AND a genuinely low displayed wave;
    // any real wave (≥0.5 m, e.g. swell wrapping in) falls back to the hedged chop wording.
    const calmEnclosedWater = enclosedCove && canClaimWindProtection &&
      typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM < 0.5;
    if (calmEnclosedWater && !hasBigWaves) {
      // Coastal-safety fact that rides WITH the calm claim (HM Coastguard/NOAA): a
      // protected cove at 5+ Bft means the wind blows from blocked land toward open
      // water — flat surface, but it pushes floats/SUPs/swimmers seaward. The one
      // deceptive-calm hazard of exactly this promotion, so it is never shown apart
      // from it.
      return {
        value: { en: 'Calm water, breezy', gr: 'Ήρεμο νερό, με αέρα', de: 'Ruhiges Wasser, windig', it: 'Acqua calma, ventoso', fr: 'Eau calme, venteux' }[language],
        subValue: {
          en: 'Enclosed bay — the wind blows, the water stays calmer. The wind pushes toward open water: keep inflatables and swimming close to shore',
          gr: 'Κλειστός όρμος — ο αέρας φυσάει, το νερό μένει πιο ήρεμο. Ο αέρας σπρώχνει προς τα ανοιχτά: κράτα φουσκωτά και κολύμπι κοντά στην ακτή',
          de: 'Geschlossene Bucht — windig, aber ruhigeres Wasser. Der Wind drückt seewärts: Luftmatratzen und Schwimmen nah am Ufer halten',
          it: 'Baia chiusa — vento sì, ma acqua più calma. Il vento spinge verso il largo: tieni gonfiabili e nuoto vicino a riva',
          fr: "Baie fermée — du vent, mais une eau plus calme. Le vent pousse vers le large : gardez bouées et baignade près du rivage",
        }[language],
      };
    }
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
import { buildBeachDetailPath } from '../utils/beachUrls';
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
   *  map so the detail map colours the pin identically instead of re-deriving it here. */
  mapExposureLevelOverride?: ExposureLevel;
  /**
   * The wind at this beach's own shore — the SAME cluster reading the region map colours its
   * pin from (App.mapBeachLocalWinds).
   *
   * The level override above pins the exposure LEVEL, but getExposureMarkerTone also keys on
   * Beaufort, so the detail map needs the same Beaufort or the same beach renders in two
   * different colours on two screens. That divergence was the whole reason the override exists;
   * when the region map moved to per-beach wind on 01/08/2026 and this map did not, it came
   * back from the other side.
   */
  mapWind?: { deg: number; speedKmh: number };
  /** The hour the global slider is showing (0-23), so the wave strip marks the right bar. */
  selectedHour?: number;
  /** SAFETY hard cutoff: the region forecast is past the 12 h cutoff and could not be refreshed. When
   *  true, every wind/sea/score/verdict block is blanked and a banner is shown; only the
   *  static content (name, photo, access, map, info) stays. Never show stale conditions. */
  conditionsUnavailable?: boolean;
  /** Real fetch time of the last known forecast, for the "last forecast HH:MM" stamp. */
  lastForecastAt?: Date | null;
  /**
   * Opens the photo-upload sheet for THIS beach. Undefined when accounts are
   * unconfigured, which is what keeps the button from appearing in a build where
   * there is nothing behind it.
   */
  onAddPhoto?: () => void;
}

// "Sunset over the sea" card: localised copy + short month names for every
// LanguageCode (falls back to English). The value is an orientation-based estimate
// (utils/sunsetOverSea.ts), so the note keeps the honesty caveat visible.
const SUNSET_SHORT_MONTHS: Record<LanguageCode, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  gr: ['Ιαν', 'Φεβ', 'Μάρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  fr: ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'],
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
};

// title = badge label · allYear = value when every month qualifies · expect = plain-language
// "what you'll get here" · tip = a practical suggestion · caveat = the honesty note (tiny).
const SUNSET_SEA_COPY: Record<LanguageCode, { title: string; allYear: string; expect: string; tip: string; caveat: string }> = {
  en: {
    title: 'Sunset over the sea', allYear: 'all year',
    expect: 'The sun goes down over the water right in front of you here — one of the nicer spots to watch the sunset.',
    tip: 'Come in the late afternoon and stay for the golden hour; bring a camera and a layer for when the breeze picks up.',
    caveat: 'Based on the shore’s orientation — a headland or island can still block the horizon.',
  },
  gr: {
    title: 'Ηλιοβασίλεμα στη θάλασσα', allYear: 'όλο τον χρόνο',
    expect: 'Εδώ ο ήλιος δύει πάνω στο νερό, μπροστά σου — από τις ωραίες παραλίες για να δεις το ηλιοβασίλεμα.',
    tip: 'Έλα αργά το απόγευμα και μείνε για το χρυσό φως· πάρε φωτογραφική και μια ζακέτα για όταν σηκωθεί αεράκι.',
    caveat: 'Εκτίμηση από τον προσανατολισμό της ακτής — ακρωτήρι ή νησί μπορεί να κρύβει τον ορίζοντα.',
  },
  de: {
    title: 'Sonnenuntergang über dem Meer', allYear: 'ganzjährig',
    expect: 'Hier geht die Sonne direkt vor dir über dem Wasser unter — einer der schöneren Orte für den Sonnenuntergang.',
    tip: 'Komm am späten Nachmittag und bleib zur goldenen Stunde; nimm eine Kamera und etwas Warmes für den Abendwind mit.',
    caveat: 'Geschätzt aus der Ausrichtung der Küste — eine Landzunge oder Insel kann den Horizont verdecken.',
  },
  fr: {
    title: 'Coucher de soleil sur la mer', allYear: 'toute l’année',
    expect: 'Ici le soleil se couche sur l’eau, droit devant vous — l’un des plus beaux endroits pour le coucher de soleil.',
    tip: 'Venez en fin d’après-midi et restez pour l’heure dorée ; prenez un appareil photo et une petite laine pour le vent du soir.',
    caveat: 'Estimé d’après l’orientation du rivage — un cap ou une île peut masquer l’horizon.',
  },
  it: {
    title: 'Tramonto sul mare', allYear: 'tutto l’anno',
    expect: 'Qui il sole tramonta sull’acqua, proprio davanti a te — uno dei posti migliori per il tramonto.',
    tip: 'Vieni nel tardo pomeriggio e resta per l’ora d’oro; porta una macchina fotografica e una felpa per la brezza serale.',
    caveat: 'Stimato dall’orientamento della costa — un promontorio o un’isola può nascondere l’orizzonte.',
  },
};

const formatSunsetSeason = (window: SunsetOverSea, language: LanguageCode): string => {
  const copy = SUNSET_SEA_COPY[language] ?? SUNSET_SEA_COPY.en;
  if (window.allYear) return copy.allYear;
  const range = sunsetSeasonRange(window.months);
  if (!range) return copy.allYear;
  const months = SUNSET_SHORT_MONTHS[language] ?? SUNSET_SHORT_MONTHS.en;
  return range.start === range.end ? months[range.start] : `${months[range.start]}–${months[range.end]}`;
};

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
  mapWind,
  geospatialExposureProfiles,
  weatherSource = 'island-fallback',
  mapExposureLevelOverride,
  selectedHour,
  conditionsUnavailable = false,
  lastForecastAt,
  onAddPhoto
}) => {
  // Hard-cutoff gate: hide every live wind/sea/score/verdict block, keep static content.
  const showConditions = !conditionsUnavailable;
  const isFavorite = favorites.includes(beach.id);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  // Set the moment a verdict button is tapped; the second step ("when were you there?") shows
  // until it resolves to a submit. Kept separate from feedbackSubmitted so the first tap doesn't
  // already read as "done" while we're still waiting on the timing answer.
  const [pendingFeedbackVerdict, setPendingFeedbackVerdict] = useState<ConditionFeedbackVerdict | null>(null);
  /**
   * The id every committed per-beach FILE is keyed by.
   *
   * In «Κοντά μου» the region is synthesised from whatever lies within the radius and every
   * beach is re-numbered 1..60 so the merged set has unique ids; the real one is kept in
   * `sourceBeachId` (App.buildNearbyRegion). Lookups that read a committed file — the climate
   * record, the shoreline drawing — must use the real id or they silently find nothing, and the
   * same beach loses its shoreline graphic and its "is today unusual?" line purely because the
   * reader arrived through Near me. Anything about live conditions keeps using `beach.id`,
   * which is what the in-memory maps for this session are keyed by.
   */
  const committedBeachId = beach.sourceBeachId ?? beach.id;

  /** Η περιοχή που ΑΝΗΚΕΙ η παραλία. Στο «Κοντά μου» το prop `regionId` είναι κενό —
   *  η συγχωνευμένη περιοχή δεν είναι πραγματική — ενώ η ίδια η παραλία κουβαλάει τη
   *  δική της. Ίδιο μοτίβο με το committedBeachId από πάνω. */
  const feedbackRegionId = beach.regionId ?? regionId;
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
  // Copernicus monthly climatology for THIS beach — the "is today unusual?" line in the
  // answer hero. Lazy per region (~3,4 KB), same loader shape as the story above, and
  // null until it lands so the hero simply renders without the line rather than shifting.
  const [beachClimate, setBeachClimate] = useState<Awaited<ReturnType<typeof getBeachClimate>>>(null);
  useEffect(() => {
    let cancelled = false;
    setBeachClimate(null);
    getBeachClimate(committedBeachId, beach.regionId ?? regionId).then(c => { if (!cancelled) setBeachClimate(c); });
    return () => { cancelled = true; };
  }, [committedBeachId, beach.regionId, regionId]);
  const storyLocale: 'gr' | 'en' = language === 'gr' ? 'gr' : 'en';
  const guideLinks = useMemo(() => getIslandGuideLinks(allBeaches, regionId, language, beach), [allBeaches, regionId, language, beach]);
  const guidesHubLink = useMemo(() => getGuidesHubLink(language), [language]);
  const selectedDate = dayForecast.date;
  const selectedDayPrefix = getSelectedDayPrefix(selectedDate, athensNow(), language);
  // Read-back: don't re-ask for feedback on the same beach + day we already have it for
  // (roadmap #7 — the buttons used to reappear after reload because only local state gated them).
  const feedbackDateKey = selectedDate ? wallClockDayKey(selectedDate) : '';
  const feedbackAlreadyGiven = useMemo(
    () => getFeedback().some(f => f.beachId === beach.id && f.conditions?.date === feedbackDateKey),
    [beach.id, feedbackDateKey]
  );
  const selectedDayIsToday = selectedDayPrefix === (language === 'gr' ? 'σήμερα' : 'today');

  /**
   * WHEN the verdict is describing — the fix for "Ήρεμα τώρα" over 08:00's numbers.
   *
   * The page has always known the difference (`live` on the forecast call is exactly
   * `selectedDayIsToday && selectedHour === undefined`), but the verdict only ever asked
   * whether the DAY was today. So opening a beach at 22:00, with the hour slider parked on
   * a daylight hour, printed "Ήρεμα τώρα" above conditions fourteen hours old — the one
   * kind of error this whole site exists not to make.
   *
   * Three cases, in the order they are decided:
   *   today + no hour picked  → "τώρα"           (genuinely the present)
   *   today + an hour picked  → "στις 08:00"
   *   another day             → "αύριο" / "αύριο στις 08:00"
   */
  const verdictMomentLabel = useMemo(() => {
    const hourLabel = getSelectedHourPrefix(selectedHour, language);
    if (selectedDayIsToday) {
      return hourLabel ?? { en: 'right now', gr: 'τώρα', de: 'gerade', it: 'adesso', fr: 'maintenant' }[language];
    }
    const dayLabel = getSelectedDayPrefix(selectedDate, athensNow(), language);
    return hourLabel ? `${dayLabel} ${hourLabel}` : dayLabel;
  }, [selectedDayIsToday, selectedHour, selectedDate, language]);

  const copy = {
    whyToday: { en: `What to expect ${selectedDayPrefix}`, gr: `Τι να περιμένεις ${selectedDayPrefix}`, de: 'Was dich erwartet', it: 'Cosa aspettarsi', fr: `À quoi s'attendre` },
    sea: { en: 'Sea', gr: 'Θάλασσα', de: 'Meer', it: 'Mare', fr: 'Mer' },
    waterTemp: { en: 'Water', gr: 'Νερό', de: 'Wasser', it: 'Acqua', fr: 'Eau' },
    airTemp: { en: 'Air temperature', gr: 'Θερμοκρασία αέρα', de: 'Lufttemperatur', it: 'Temperatura aria', fr: 'Temperature de l air' },
    bestTime: { en: 'Best Time', gr: 'Ώρα', de: 'Beste Zeit', it: 'Ora migliore', fr: 'Meilleur moment' },
    toVisit: { en: 'To visit', gr: 'Για επίσκεψη', de: 'Zum Besuch', it: 'Per visitare', fr: 'Pour visiter' },
    bestSwim: { en: `Best swimming time ${selectedDayPrefix}`, gr: `Καλύτερη ώρα για μπάνιο ${selectedDayPrefix}`, de: 'Beste Badezeit', it: 'Ora migliore per nuotare', fr: 'Meilleur moment pour se baigner' },
    /* Ο τίτλος ρωτούσε «πόσο σωστή ήταν η πρόβλεψη» και τα κουμπιά περιέγραφαν καιρό
       («Είχε κύμα», «Πολύς αέρας»), οπότε ο κόσμος τα πατούσε ως περιγραφή της ημέρας
       — ακόμα κι όταν το είχαμε ήδη πει σωστά. Τώρα η ερώτηση είναι σύγκριση με ό,τι
       του είπαμε και τα κουμπιά είναι συγκριτικά («πιο πολύ», «πιο ήρεμα»), ώστε να
       τα πατάει μόνο όποιος βρήκε κάτι ΔΙΑΦΟΡΕΤΙΚΟ από την πρόβλεψη. */
    feedbackTitle: { en: 'Did it match what we told you?', gr: 'Ταίριαζε με αυτό που σου είπαμε;', de: 'Hat es gestimmt, was wir gesagt haben?', it: 'Corrispondeva a quello che ti abbiamo detto?', fr: 'Cela correspondait-il à notre prévision ?' },
    feedbackText: { en: 'Tap one of the others only if we got it wrong — that is how we fix the recommendations.', gr: 'Πάτα κάτι από τα υπόλοιπα μόνο αν πέσαμε έξω — έτσι διορθώνουμε τις προτάσεις.', de: 'Tippe die anderen nur an, wenn wir danebenlagen — so verbessern wir die Empfehlungen.', it: 'Tocca le altre solo se abbiamo sbagliato — così miglioriamo i consigli.', fr: 'Choisissez une autre réponse seulement si nous nous sommes trompés — cela améliore nos recommandations.' },
    // Second step, shown right after the verdict button. Without it, a report typed at 22:00
    // about a beach visited at 09:00 reads as an evening observation — see ObservedTiming.
    feedbackWhenTitle: { en: 'When were you there?', gr: 'Πότε ήσουν εκεί;', de: 'Wann warst du dort?', it: 'Quando eri lì?', fr: 'Quand y étiez-vous ?' },
    feedbackWhenNow: { en: 'I am there now', gr: 'Τώρα είμαι εκεί', de: 'Ich bin gerade dort', it: 'Sono lì ora', fr: 'J y suis maintenant' },
    feedbackWhenMorning: { en: 'This morning', gr: 'Το πρωί', de: 'Heute Vormittag', it: 'Stamattina', fr: 'Ce matin' },
    feedbackWhenMidday: { en: 'Around midday', gr: 'Το μεσημέρι', de: 'Am Mittag', it: 'A mezzogiorno', fr: 'Vers midi' },
    feedbackWhenEvening: { en: 'Afternoon / evening', gr: 'Απόγευμα / βράδυ', de: 'Nachmittags / abends', it: 'Pomeriggio / sera', fr: 'Après-midi / soir' },
    feedbackWhenSkip: { en: "I don't remember", gr: 'Δεν θυμάμαι', de: 'Weiß ich nicht mehr', it: 'Non ricordo', fr: 'Je ne me souviens plus' },
    nearby: { en: 'Nearby Recommendations', gr: 'Κοντινές προτάσεις', de: 'Empfehlungen in der Nahe', it: 'Consigli nelle vicinanze', fr: 'Recommandations proches' },
    decisionSummary: { en: selectedDayIsToday ? 'Today summary' : `Summary ${selectedDayPrefix}`, gr: `Σύνοψη για ${selectedDayPrefix}`, de: 'Kurzfassung', it: 'Riepilogo', fr: 'Resume' },
    /* Was "Συνθήκες σήμερα" — a heading so general it could have introduced any of the
       twenty blocks below it. What actually follows is one specific thing: the wave
       drawing. Naming the picture instead of the category tells the reader in one word
       whether to stop here.
       It carries the SAME moment label as the verdict, for the same reason: the graphic
       redraws with the hour slider, so a fixed "τώρα" would caption tomorrow's 14:00 sea
       as the present. One source of truth for "when", used by both. */
    conditions: {
      en: `Swell ${verdictMomentLabel}`,
      gr: `Κυματισμός ${verdictMomentLabel}`,
      de: `Wellengang ${verdictMomentLabel}`,
      it: `Onde ${verdictMomentLabel}`,
      fr: `Houle ${verdictMomentLabel}`,
    },
    beachStoryHeading: { en: 'About this beach', gr: 'Πληροφορίες', de: 'Über diesen Strand', it: 'Informazioni', fr: 'À propos' },
    // THE ONE LINE THE CARD KEEPS WHEN EVERY OTHER SIGNAL GOES QUIET (05/08/2026).
    // On a calm, light-wind day three things fall silent at once: the verdict pill (removed
    // 01/08 as a second, competing answer), the live sentence (suppressed at ≤2 Bft the same
    // day, because it only restated the Bft number), and the shelter label (never printed
    // below 3 Bft). What was left on a real phone was eight tiles and a pale mint background —
    // no judgement anywhere, on the one product whose entire promise is a judgement.
    // Deliberately carries NO figure: every number on this line already has a tile. It states
    // the decision the tiles imply and never spell out. Gated hard — see calmDayVerdictLine.
    calmDayVerdict: {
      en: 'A good day to swim here.',
      gr: 'Καλή μέρα για μπάνιο εδώ.',
      de: 'Ein guter Tag zum Schwimmen hier.',
      it: 'Una buona giornata per fare il bagno qui.',
      fr: 'Une bonne journée pour se baigner ici.',
    },
    // The two section breaks that give the scroll a shape. Kept as plain labels rather
    // than headings: they organise, they do not introduce a new topic, and an extra <h2>
    // in the outline would compete with the ones that carry real search intent.
    sectionBeach: { en: 'The beach', gr: 'Η παραλία', de: 'Der Strand', it: 'La spiaggia', fr: 'La plage' },
    sectionNearby: { en: 'Nearby', gr: 'Κοντά εδώ', de: 'In der Nähe', it: 'Nei dintorni', fr: 'À proximité' },
    /* The bottom-bar tabs. These are the ONE place on the page where a label may be
       shorter than the heading it lands on: a tab is ~63 px wide at 320 px and carries
       an icon that does half the naming. The full headings stay where they belong, on
       the sections themselves. Kept deliberately short in every language — German
       "In der Nähe" would wrap to two lines and make the bar taller on every page. */
    tabWave: { en: 'Waves', gr: 'Κύμα', de: 'Wellen', it: 'Onde', fr: 'Vagues' },
    tabStory: { en: 'About', gr: 'Πληροφορίες', de: 'Infos', it: 'Info', fr: 'Infos' },
    /* «Εναλλακτικές», not «Κοντινές» (Miltos, 11/08). The section it lands on is
       headed «Κοντινές προτάσεις», so this is the one tab whose word is chosen for
       what the visitor WANTS rather than for what the heading says: at the moment
       you look at this bar, "somewhere else" is the question — how far away that
       somewhere is comes after. The longest of the four labels by some way, which
       is why the fit gate re-measured it at 320 px. */
    tabNearby: { en: 'Alternatives', gr: 'Εναλλακτικές', de: 'Alternativen', it: 'Alternative', fr: 'Alternatives' },
    tabPhoto: { en: 'Add photo', gr: 'Ανέβασε φωτό', de: 'Foto senden', it: 'Invia foto', fr: 'Envoyer photo' },
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
    certifiedTitle: { en: 'CalmBeach Certified', gr: 'CalmBeach Certified', de: 'CalmBeach Certified', it: 'CalmBeach Certified', fr: 'CalmBeach Certified' },
    certifiedBody: {
      en: 'We have personally been to this beach and confirmed on site that its details — shelter, amenities, access and water — match what we show here.',
      gr: 'Έχουμε πάει οι ίδιοι σε αυτή την παραλία κι επαληθεύσαμε επιτόπου ότι τα χαρακτηριστικά της — προστασία από τον άνεμο, παροχές, πρόσβαση και νερά — ανταποκρίνονται σε όσα δείχνουμε εδώ.',
      de: 'Wir waren persönlich an diesem Strand und haben vor Ort bestätigt, dass die Angaben — Windschutz, Ausstattung, Zugang und Wasser — mit dem übereinstimmen, was wir hier zeigen.',
      it: 'Siamo stati di persona in questa spiaggia e abbiamo verificato sul posto che le caratteristiche — riparo dal vento, servizi, accesso e acqua — corrispondono a quanto mostriamo qui.',
      fr: 'Nous sommes allés en personne sur cette plage et avons vérifié sur place que ses caractéristiques — abri du vent, services, accès et eau — correspondent à ce que nous indiquons ici.',
    },
    certifiedVerifiedOn: { en: 'Verified on site', gr: 'Επιτόπου επαλήθευση', de: 'Vor Ort geprüft', it: 'Verificata sul posto', fr: 'Vérifié sur place' },
  };

  // CalmBeach Certified — first-party "we were here" seal (utils/certifiedBeaches.ts).
  const certification = getBeachCertification(beach.id);
  const certifiedWhen = certification
    ? (() => {
        // Full YYYY-MM-DD → show the day; a YYYY-MM only → month + year.
        const hasDay = /^\d{4}-\d{2}-\d{2}/.test(certification.visitedOn);
        const iso = hasDay ? certification.visitedOn.slice(0, 10) : `${certification.visitedOn.slice(0, 7)}-01`;
        const parsed = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return certification.visitedOn;
        const locale = ({ en: 'en', gr: 'el', de: 'de', it: 'it', fr: 'fr' } as const)[language] ?? 'en';
        return parsed.toLocaleDateString(locale, hasDay
          ? { year: 'numeric', month: 'long', day: 'numeric' }
          : { year: 'numeric', month: 'long' });
      })()
    : null;
  // Our first-person note, rendered in the visitor's language (falls back gr -> en).
  const certifiedNote = localizeCertificationNote(certification?.note, language);

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

  // Step 1: verdict button tapped. Don't submit yet — ask when they were actually there first,
  // so the report isn't stuck with only the click time (see pendingFeedbackVerdict above).
  const handleFeedback = (verdict: ConditionFeedbackVerdict) => {
    setPendingFeedbackVerdict(verdict);
  };

  // Step 2: timing answered (or skipped via observedTiming === undefined). Actually submits.
  const submitFeedback = (verdict: ConditionFeedbackVerdict, observedTiming?: ObservedTiming) => {
    // Pair the observed verdict with the modeled conditions so an offline pass can later
    // calibrate this beach/sector (roadmap #7). exposureLevel/windDir/windSpeedKmh are
    // derived below; this handler only runs on click, after they are initialised.
    // Η ΠΡΑΓΜΑΤΙΚΗ ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΠΑΡΑΛΙΑΣ, ΟΧΙ Η ΘΕΣΗ ΤΗΣ ΣΤΗ ΛΙΣΤΑ (28/08/2026).
    // Στο «Κοντά μου» το App.buildNearbyRegion συγχωνεύει παραλίες από πολλές περιοχές
    // και δίνει στην καθεμία νέο id 1, 2, 3… επειδή τα πραγματικά ids είναι μοναδικά
    // μόνο ΜΕΣΑ σε μια περιοχή. Το σχόλιο έφευγε λοιπόν με «ID παραλίας: 1» και
    // «Νησί/περιοχή: Near me» — και το 1 δεν σημαίνει τίποτα: αύριο, από άλλο σημείο,
    // είναι άλλη παραλία. Ό,τι χρειάζεται υπάρχει ήδη πάνω στο αντικείμενο, ακριβώς
    // γι' αυτόν τον λόγο: committedBeachId (= sourceBeachId) και beach.regionId.
    storeConditionFeedback(committedBeachId, verdict, {
      exposureLevel,
      beaufort: getBeaufortLevel(windSpeedKmh),
      // Ό,τι ΕΙΔΕ ο επισκέπτης («3–4»), ώστε ένα «είχε πιο πολύ αέρα» να κριθεί απέναντι στο άνω
      // άκρο και όχι απέναντι στο κάτω που έκρινε το χρώμα (Νάξος #2017, 25/08/2026).
      beaufortShown: beaufortShownLabel,
      windDir,
      date: selectedDate ? wallClockDayKey(selectedDate) : undefined,
      // The wave side of the record. Without what we CLAIMED the sea was, a "had waves" report
      // can only ever calibrate the wind model. `hour` is the click time, kept only as a
      // fallback — `observedTiming` (below) is what the visitor actually told us, and `live`
      // separates someone standing in the water from someone reading about next Tuesday.
      hour: athensNow().getHours(),
      observedTiming,
      seaStateWaveM: scoreResult.seaStateWaveM,
      seaStatePeriodS: scoreResult.seaStatePeriodS,
      // ...και ο αριθμός που είχε ΜΠΡΟΣΤΑ ΤΟΥ όταν πάτησε το κουμπί. Από τις 13/08/2026 η οθόνη
      // τυπώνει το νερό της ακτής, όχι το ανοιχτό — οπότε χωρίς αυτό το πεδίο η αναφορά
      // βαθμονομείται απέναντι σε νούμερο που δεν είδε ποτέ (Λιά 1958: 1,78 vs ~0,10 μ.).
      shoreDisplayWaveM: scoreResult.shoreDisplayWaveM,
      shoreWaveFromDepartingSea: scoreResult.shoreWaveFromDepartingSea,
      live: selectedDayIsToday && selectedHour === undefined,
    }, {
      // ΠΟΙΑ ΠΑΡΑΛΙΑ. Χωρίς αυτό το e-mail/Telegram έπεφτε πίσω στο Referer, που σε
      // πλοήγηση μέσα στην εφαρμογή είναι συχνά η γενική σελίδα — και το σχόλιο έφτανε
      // με λινκ CalmBeach χωρίς κανένα τρόπο να καταλάβεις για ποια παραλία μιλάει.
      source: 'condition_feedback',
      beachName: beachDisplayName,
      islandName,
      regionId: feedbackRegionId,
      language,
      // Ο σύνδεσμος χτίζεται με το ΠΡΑΓΜΑΤΙΚΟ id, αλλιώς στο «Κοντά μου» θα έδειχνε
      // /beaches/kos/1-mpatis/ — διεύθυνση που δεν υπάρχει. Χωρίς περιοχή δεν
      // εφευρίσκουμε διαδρομή: πέφτουμε στη σελίδα που είναι όντως ανοιχτή.
      pagePath: feedbackRegionId
        ? buildBeachDetailPath(feedbackRegionId, { ...beach, id: committedBeachId }, language)
        : (typeof window !== 'undefined' ? window.location.pathname : ''),
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

  /**
   * Same-page jump for the shortcut chips under today's answer.
   *
   * A <button>, NOT <a href="#…">, on purpose. This app keeps the URL in sync with
   * its own state (region, near-me, filters), so a hash left in the address bar is
   * one more thing that has to be consumed and stripped on the next read — exactly
   * the trap `?near=1` already sprang, where a leftover param re-fired geolocation.
   * Nothing about "I scrolled to the text" needs to survive a reload, so nothing
   * about it belongs in the URL.
   *
   * Focus moves with the scroll. A jump control that only scrolls leaves keyboard
   * focus behind, so the next Tab throws the visitor back to the top of the page —
   * the control would actively hurt the people who need it most. The targets carry
   * tabIndex={-1} for this and nothing else.
   */
  const handleJump = (elementId: string, target: 'wave' | 'story' | 'nearby') => {
    trackEvent('beach_jump_clicked', beach.id, {
      locale: language === 'gr' ? 'el' : 'en',
      region: islandDisplayName,
      beach_name: beach.name.en,
      target,
    });

    const element = document.getElementById(elementId);
    if (!element) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    element.focus({ preventScroll: true });
  };

  // 1. Calculate Conditions & Scores
  // The headline wind, wave and verdict all read from `dayForecast` — which App now hands over
  // carrying THIS beach's own sea (since 01/08/2026) and its own wind (since 02/08). The page
  // and the card that linked to it therefore still show one consistent figure; what changed is
  // whose weather that figure describes. Before, the page printed the region centre's Beaufort
  // under the beach's name: Γιαλισκάρι (Χανιά) read «2 Μπφ — σχεδόν άπνοια» at 08:00 while its
  // own shore blew 4 Bft and its map pin was correctly yellow.
  const beachSpecificWeatherData = beachWeatherById?.[beach.id];
  const weatherData = dayForecast;
  const scoringHourlyForecast = hourlyForecast;
  const scoringWeatherSource: WeatherSource = weatherSource;
  const displayTemp = weatherData.temp_max;
  const windSpeedKmh = weatherData.wind.speed * 3.6;
  const windDir = degToCompass(weatherData.wind.deg);
  const windDirectionLabel = t.windDirectionsAccusative?.[windDir as WindDirection] || t.windDirections[windDir as WindDirection] || windDir;
  // Real shoreline geometry, drawn in the photo slot when this beach has no photo.
  const shorelineShape = useShorelineShape(beach.regionId ?? regionId, committedBeachId);
  const geospatialExposure = geospatialExposureProfiles?.[beach.id];
  const scoreResult = calculateBeachScore(beach, weatherData, userLocation, preferences, {
    weatherSource: scoringWeatherSource,
    hourlyForecast: scoringHourlyForecast,
    geospatialProfile: geospatialExposure,
  });
  const { score, exposureLevel, swimmingComfort, canClaimWindProtection = false, enclosedCove = false, seaCalmClaimAllowed = false } = scoreResult;
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
  // Read the threshold from assessSwellExposure's own constant, never a literal: this page and
  // calculateBeachScore each run their own copy of the guard, and the day the two swell gates
  // disagree the card and its detail page print different wave numbers for the same beach.
  const swellPresent = (weatherData.marine?.swellWaveHeightM ?? 0) >= SWELL_MIN_HEIGHT_M
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
  /**
   * ΕΝΑΣ ΑΡΙΘΜΟΣ ΓΙΑ ΤΟ ΚΥΜΑ, ΟΧΙ ΔΥΟ ΥΠΟΛΟΓΙΣΜΟΙ (11/08/2026).
   *
   * Αυτή η σελίδα ξανα-υπολόγιζε και τις δύο τιμές — τη «display» τιμή του όρμου και το κύμα
   * στην ακτή — με ελαφρώς άλλες εισόδους από το scoring (η μία ξεκινούσε από το display ύψος,
   * η άλλη από το effective). Αποτέλεσμα: η κάρτα του Top 3 έλεγε άλλο νούμερο απ' ό,τι η ίδια
   * η σελίδα της παραλίας που άνοιγε από πάνω της. Και τα δύο βγαίνουν πια από το scoreResult,
   * δηλαδή από τον ΙΔΙΟ υπολογισμό που τροφοδοτεί την κάρτα (services/recommendationService:
   * displayWaveHeightM + shoreModelWaveM), οπότε δεν μπορούν να αποκλίνουν.
   *
   * Ο τοπικός υπολογισμός μένει μόνο ως fallback για την περίπτωση που το scoring δεν έδωσε
   * ύψος καθόλου.
   */
  const displayWaveHeightM = scoreResult.waveHeightM
    ?? (coveWave.coveApplied ? coveWave.waveHeightM : (waveHeightM ?? measuredWaveHeightM));
  // When the cove path is taken we are showing the modeled SMB, not the live grid value → estimate.
  const isWaveEstimate = coveWave.coveApplied || !(typeof measuredWaveHeightM === 'number' && Number.isFinite(measuredWaveHeightM));
  // «Κύμα στην ακτή» — the second, separately-labelled reading (utils/shoreWave, computed inside
  // scoring). Only speaks where the wind blows off the land into a land-blocked, fetch-free sector
  // with no swell. Capped at the open-water figure shown right beside it: the shore reading must
  // never print a bigger sea than the water outside it, and the card applies the same cap.
  //
  // 13/08/2026: διαβάζει πλέον `shoreDisplayWaveM` — τον ΙΔΙΟ αριθμό, υπολογισμένο για ΚΑΘΕ
  // παραλία και όχι μόνο για τους κλειστούς όρμους. Είναι αυτό που η ετυμηγορία κολύμβησης κρίνει
  // από τις 10/08 και που μέχρι σήμερα δεν τυπωνόταν πουθενά (βίβλος §Γ5). Το πλακίδιο της
  // ανοιχτής θάλασσας μένει ΔΙΠΛΑ, με το όνομά του — ο όρος της §7δ δεν χαλαρώνει.
  const shoreSourceM = typeof scoreResult.shoreDisplayWaveM === 'number' && Number.isFinite(scoreResult.shoreDisplayWaveM)
    ? scoreResult.shoreDisplayWaveM
    : scoreResult.shoreWaveHeightM;
  const shoreWaveHeightM = typeof shoreSourceM === 'number' && Number.isFinite(shoreSourceM)
    ? (typeof displayWaveHeightM === 'number' && Number.isFinite(displayWaveHeightM)
        ? Math.min(shoreSourceM, displayWaveHeightM)
        : shoreSourceM)
    : undefined;
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
        const hourSwellPresent = (item.marine?.swellWaveHeightM ?? 0) >= SWELL_MIN_HEIGHT_M
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
  // Water-temperature gradation — 3 coarse buckets on purpose. The Open-Meteo SST is a basin-scale
  // model value (~8 km sea cell), not a nearshore measurement, so wide buckets absorb its error and
  // stay honest; a finer word would over-claim, especially on meltemi days when nearshore upwelling
  // runs colder than the open-sea value. Thresholds tuned to the Greek swimming season: the common
  // summer range (≈ 24-26°C) reads as "ideal" rather than "warm" — the Aegean stays refreshing even
  // then, so "warm" would over-claim — and < 21°C (spring/autumn/cold-snap) reads as cold. Shown
  // with the "κατά προσέγγιση" note + a ~ prefix, so the number stays advisory, not a precise claim.
  // Το λεξιλόγιο ΚΑΙ τα κατώφλια ζουν πλέον στο utils/waterTemperatureCopy — μία φορά, γιατί η
  // κάρτα τα διαβάζει κι αυτή από 15/08/2026. Εδώ υπήρχαν δύο αντίγραφα των ίδιων 21/24 (λέξη
  // εδώ, τόνος 900 γραμμές πιο κάτω)· τρίτο στην κάρτα θα ήταν η §Κ1 της βίβλου.
  const waterReading = resolveWaterTemperature(seaTemperatureC, language);
  const waterTempDescriptor = waterReading?.descriptor;
  // "Calmer than a normal July here." Deliberately fed the UNCORRECTED wave height:
  // the climatology is an open-water 4,2 km cell, so comparing a cove-corrected figure
  // against it would print a false compliment on every enclosed bay, every day.
  // …and fed the two facts it needs to know whether "here" is even true: how far offshore
  // today's reading was sampled, and what colour this beach's own dot is wearing. Without them
  // the amber "rougher than usual" fires on a lee shore all summer (see guard 3 in that file).
  const climateComparison: ClimateComparison | null = useMemo(
    () => describeClimateComparison(beachClimate, {
      openWaterWaveHeightM: waveHeightM ?? measuredWaveHeightM,
      seaTemperatureC,
      date: selectedDate,
      language,
      sampleDistanceKm: geospatialExposure?.marineSamplePoint?.distanceKm,
      mapAlignedExposureLevel,
    }),
    [beachClimate, waveHeightM, measuredWaveHeightM, seaTemperatureC, selectedDate, language,
      geospatialExposure, mapAlignedExposureLevel],
  );
  // R1: mirror the ranking's direct-swell detection so the DISPLAYED sea sub-score drops the
  // protected/partial wave floor exactly when the ranking does — otherwise a west-facing cove on
  // real ground swell shows an optimistic sea score while being correctly down-ranked.
  const directSwellHere = assessSwellExposure(geospatialExposure, scoreResult.facingDeg ?? null, {
    swellDirectionDeg: weatherData.marine?.swellWaveDirectionDeg,
    swellHeightM: weatherData.marine?.swellWaveHeightM,
    swellPeriodS: weatherData.marine?.swellWavePeriodS,
  }).exposed;
  const seaConditionScore = calculateSeaConditionScore(
    isExposed,
    windSpeedKmh,
    exposureLevel,
    scoreResult.seaStateWaveM ?? waveHeightM,
    directSwellHere,
    scoreResult.seaStatePeriodS
  );
  const detailBadgeScore = getDetailBadgeScore(score, seaConditionScore, isExposed);
  const beaufortLevel = getBeaufortLevel(windSpeedKmh);
  // Το άνω άκρο του εύρους («3–4 Μπφ») — display-only, από τη ΣΤΕΡΙΑΝΗ ριπή της ώρας
  // (utils/beaufortRange, 25/08/2026). Ό,τι ΚΡΙΝΕΙ — χρώμα, λέξη ανέμου, κατώφλια, το
  // `beaufort` του feedback — διαβάζει το beaufortLevel, όπως και πριν. Το label πάει σε δύο
  // σημεία της σελίδας (hero + γραμμή πρόσπτωσης) ώστε να μη λένε δύο διαφορετικά νούμερα.
  const beaufortHigh = scoreResult.displayedBeaufortHigh;
  const beaufortShownLabel = formatBeaufortLabel(beaufortLevel, beaufortHigh);
  const gustKmph = getWeatherGustKmph(weatherData, scoringHourlyForecast);
  const isBoatOnlyBeach = hasBoatOnlyAccess(beach);
  /**
   * utils/shoreBreak — evaluated against `displayWaveHeightM`, the exact figure the sea tile
   * prints, so the sentence can never qualify a number the reader is not looking at. On this page
   * that is the hour on screen; on the card it is the day the card shows. One rule, and each
   * surface honest about its own figure.
   */
  const shoreBreaksHere = beachShoreBreaks(
    beach,
    scoreResult.seaArrivalExposureLevel,
    displayWaveHeightM,
    scoreResult.seaStatePeriodS
  );
  /**
   * Starts from «όμως» on purpose: it sits under a tile that has just said the sea is calm, and
   * repeating «ήρεμη θάλασσα» would be a second sentence saying the first one again.
   */
  const shoreBreakSentence = {
    en: 'But the waves break a bit harder right at the shore — the water gets deep fast here.',
    gr: 'Σκάει όμως το κύμα λίγο παραπάνω στην ακτή — εδώ βαθαίνει απότομα.',
    de: 'Am Ufer brechen die Wellen aber etwas kräftiger — hier wird es schnell tief.',
    it: 'A riva però le onde frangono un po’ di più — qui il fondale scende subito.',
    fr: 'Au bord, les vagues déferlent un peu plus — ici, ça devient vite profond.',
  }[language];
  /**
   * Η ΓΡΑΜΜΗ ΤΟΥ ΑΠΟΓΕΙΟΥ ΑΝΕΜΟΥ (utils/offshoreWindNote) — Λυγαριά #636, 16/08 και 21/08/2026.
   *
   * Κρίνεται πάνω στο `displayWaveHeightM`, τον ΙΔΙΟ αριθμό που τυπώνει το πλακίδιο της θάλασσας,
   * για τον ίδιο λόγο που το κάνει και το `shoreBreak` δύο γραμμές πιο πάνω: μια πρόταση που
   * σχολιάζει νούμερο το οποίο ο αναγνώστης δεν βλέπει, σχολιάζει το τίποτα.
   *
   * ΔΕΝ αλλάζει τίποτα — ούτε τον αριθμό, ούτε το χρώμα, ούτε την ετυμηγορία, ούτε την κατάταξη.
   * Τρεις κανόνες που ΑΛΛΑΖΑΝ τον αριθμό μετρήθηκαν εθνικά και απορρίφθηκαν (βίβλος §Μ6 και
   * μπλοκ 21/08). Μετρημένη συχνότητα πριν μπει: **0,8% των ωρών, 3,2% των παραλιών**, διάμεσο
   * 2 ώρες ανά παραλία (`reports/offshore-wind-note/frequency.json`).
   */
  const offshoreWindNoteForm = resolveOffshoreWindNote({
    profile: geospatialExposure,
    windFromDeg: weatherData.wind.deg,
    beaufort: beaufortLevel,
    displayWaveM: displayWaveHeightM,
    swimVerdictAvoid: swimmingComfort === 'avoid_swimming',
  });
  const seaConditionDisplay = getSeaConditionDisplay(seaConditionScore, isExposedForCopy, language, selectedDate, canClaimWindProtectionForCopy, seaCalmClaimAllowed, beaufortLevel, displayWaveHeightM, selectedHour, isBoatOnlyBeach, enclosedCove);
  const boatRideConditionLabel = {
    en: 'Ride',
    gr: 'Συνθήκες πλεύσης',
    de: 'Fahrt',
    it: 'Tragitto',
    fr: 'Trajet',
  }[language];
  // "A bit windier/calmer right here" — and since 02/08/2026 this goes quiet by construction on
  // any beach with a cluster reading, because `dayForecast` now CARRIES that reading: the two
  // sides of the comparison are the same number, so getLocalWindNote returns nothing. That is
  // the right outcome, not an accident. The note existed to explain a headline that belonged to
  // the region; a headline that already belongs to the beach has nothing left to explain, and a
  // line saying "windier here" under a figure that is already the windier one would just read as
  // a contradiction. Beaches with no cluster of their own keep the region wind and, as before,
  // have nothing to compare either.
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
    momentLabel: verdictMomentLabel,
    dataReady: weatherNowDataReady,
    windDir: windDir as WindDirection,
    beaufort: beaufortLevel,
    waveHeightM: displayWaveHeightM,
    wavePeriodS: scoreResult.seaStatePeriodS,
    isWaveEstimate,
    protectedFrom: Array.isArray(beach.protectedFrom) ? beach.protectedFrom : [],
    // Keep the sentence honest against the pin the user sees: use the region-map-aligned
    // exposure override when present, else the scoring level.
    mapExposureLevel: mapExposureLevelOverride ?? exposureLevel,
    faces: beach.orientation?.faces ?? [],
    // The geometry the map pin is coloured from. Without it the shelter test falls
    // back to `orientation.faces`, which on almost every record is derived from the
    // older Natural Earth mask and disagrees with the real coastline ~12% of the
    // time on the cases that decide the sentence.
    facingDeg: scoreResult.facingDeg ?? null,
    canClaimWindProtection,
    isExposedToTodayWind,
    seaConditionScore,
    isBoatAccess: isBoatOnlyBeach,
    // Where the sea came from, when the wind here cannot account for it. The total goes in
    // separately from displayWaveHeightM above: that one is the display value the cove guard may
    // have rewritten, and the share test has to run against the raw reading.
    swellHeightM: weatherData.marine?.swellWaveHeightM,
    swellPeriodS: weatherData.marine?.swellWavePeriodS,
    swellDirectionDeg: weatherData.marine?.swellWaveDirectionDeg,
    seaTotalHeightM: weatherData.marine?.waveHeightM,
  }), [beachDisplayName, language, selectedDayIsToday, weatherNowDataReady, windDir, beaufortLevel, displayWaveHeightM, isWaveEstimate, beach.protectedFrom, beach.orientation?.faces, scoreResult.facingDeg, canClaimWindProtection, isExposedToTodayWind, mapExposureLevelOverride, exposureLevel, seaConditionScore, isBoatOnlyBeach, weatherData.marine?.swellWaveHeightM, weatherData.marine?.swellWavePeriodS, weatherData.marine?.swellWaveDirectionDeg, weatherData.marine?.waveHeightM]);
  const weatherNowToneClass = weatherNow.tone === 'calm'
    ? 'bg-emerald-50 text-emerald-700'
    : weatherNow.tone === 'choppy'
      ? 'bg-orange-50 text-orange-700'
      : 'bg-amber-50 text-amber-700';

  // The line that differs between two beaches on the same island (see the conditions section
  // below). It reuses coveWave.onshore — already computed for every beach from the same geometry
  // the wave figure uses — and the MAP pin level, so it can never contradict the pins.
  //
  // 11/08/2026 — THIS LINE IS NOW THE ONLY PLACE THE FACT IS STATED, so it is never suppressed.
  //
  // It used to be handed `suppressIncidence: weatherNow.statesShoreIncidence`, meaning "stay
  // quiet, the card above already said it in almost the same words". That premise died when the
  // live sentence was removed from the hero (BeachAnswerHero.tsx:528): leaving the suppression in
  // would delete the wind-vs-shore explanation from the WHOLE page — which is exactly the silent
  // double-disappearance of 31/07 that `validateOpenWaterLabel` and the browser gate were written
  // to catch. They caught it again, the same day, from the other direction.
  //
  // Removing the duplicate under the tiles and keeping the explanation further down is the point:
  // the numbers stand on their own where the eye lands, and the sentence that explains them lives
  // in the conditions section, where it is not repeating a figure printed 40 px above it.
  const shoreIncidenceLine = useMemo(() => buildShoreIncidenceLine({
    onshore: coveWave.onshore,
    mapExposureLevel: mapAlignedExposureLevel,
    windDir: windDir as WindDirection,
    beaufort: beaufortLevel,
    // Ίδιο label με το hero: αν εκείνο λέει «3–4 Μπφ», η πρόταση δεν επιτρέπεται να λέει «3 Μπφ».
    beaufortLabel: beaufortShownLabel,
    language,
    suppressIncidence: false,
  }), [coveWave.onshore, mapAlignedExposureLevel, windDir, beaufortLevel, beaufortShownLabel, language]);

  // Το χαμηλό-αλλά-σπαστό νερό, που μέχρι τις 15/08/2026 δεν το ανέφερε τίποτα. Διαβάζει το ΩΜΟ
  // ύψος και την περίοδο — τα ίδια που τρέφουν τη σοβαρότητα — και μιλάει μόνο όταν το χρώμα
  // δίπλα του λέει «ήρεμα». Βλ. utils/choppySeaCopy για τις τρεις πύλες και τα μετρημένα μερίδια.
  const choppySeaLine = useMemo(() => buildChoppySeaLine({
    waveHeightM: scoreResult.seaStateWaveM,
    periodS: scoreResult.seaStatePeriodS,
    tone: scoreResult.simpleWindSuitability?.suitabilityColor,
    language,
  }), [scoreResult.seaStateWaveM, scoreResult.seaStatePeriodS, scoreResult.simpleWindSuitability?.suitabilityColor, language]);

  // Show only curated beach-specific photos. Region/island fallbacks are hidden
  // because a wrong landmark damages trust more than a polished placeholder.
  const photoLookup = useMemo(() => {
    return getBeachPhotoLookup(beach.name.gr, beach.name.en, beach.id, 5, islandName);
  }, [beach.id, beach.name.en, beach.name.gr, islandName]);
  const realPhotos = photoLookup.source === 'exact' ? (photoLookup.detailPhotos || photoLookup.photos) : [];
  const photoAttribution = photoLookup.metadata?.requiresAttribution ? photoLookup.metadata : undefined;
  // Shore composition ("Άμμος + Βότσαλα"), reusing the filter vocabulary so the word
  // matches what the filters already say in all five languages. 'unknown' maps to an
  // empty string there, which is the correct behaviour: no label rather than a guess.
  const beachCompositionLabel = useMemo(() => {
    const key = beach.beachType;
    if (!key || key === 'unknown') return '';
    const options = translations[language]?.filterOptions as Record<string, string> | undefined;
    return options?.[key] || '';
  }, [beach.beachType, language]);

  // Fallback credit for every beach outside Milos — i.e. almost all of them. The
  // `metadata` path above only ever resolves for Milos (services/beachImageService.ts
  // returns undefined for any other island), so 958 photos under licences that
  // REQUIRE naming the creator were rendering with nothing at all. Author + licence
  // come from scripts/harvestPhotoAttribution.mjs (Wikimedia Commons API).
  const photoCredit = useMemo(
    () => (photoAttribution || !realPhotos.length ? null : getPhotoCredit(realPhotos[0], language, beach.id, 0)),
    [photoAttribution, realPhotos, language, beach.id],
  );
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

  // Evergreen "sunset over the sea" window (orientation-based, not forecast-derived,
  // so it shows even when live conditions are hidden). Empty for east-facing beaches.
  const sunsetSea = useMemo(() => sunsetOverSeaWindow(beach), [beach]);

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
  /* THE CALM-DAY VERDICT — the one sentence that keeps the answer card an answer.
     Measured on a real phone 05/08/2026 (Κανάλι του Έρωτα, 1 Bft, both at 12:30 and at
     20:50): the card printed eight tiles and not one word of judgement, because the
     verdict pill, the live sentence and the shelter label all fall silent together at
     light wind — and `bestTime` was null, so «Κατάλληλη όλη μέρα» never rendered either.

     FIVE GATES, ALL POINTING THE SAME WAY, so this line can never be the optimistic half
     of a contradiction. It speaks only when the beach's OWN pin is blue — the 02/08 rule
     that the word may never sit above its own dot applies here exactly as it does to
     TodayScoreBadge — and stays quiet the moment anything else on the page hedges. */
  const calmDayVerdictLine = (
    showConditions
    && weatherNow.tone === 'calm'
    && beaufortLevel <= 2
    && scoreResult.simpleWindSuitability?.suitabilityColor === 'blue'
    && !isNoIdealSwimmingWindow
    && !rainAdvisory?.isRainingNow
  ) ? copy.calmDayVerdict[language] : null;
  /* One place decides what goes in the hero's explanation slot, so the styling below can
     never drift out of step with the text it is styling. */
  const heroLiveSentence = showConditions && weatherNow.tone !== 'unknown' && !(weatherNow.tone === 'calm' && beaufortLevel <= 2)
    ? weatherNow.liveSentence
    : null;
  const heroExplanation = heroLiveSentence || calmDayVerdictLine;
  const heroExplanationIsVerdict = !heroLiveSentence && Boolean(calmDayVerdictLine);
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
  /**
   * What to pack — THREE items maximum, and the whole list is always visible.
   *
   * Two changes on 31/07/2026, both on the owner's call:
   *  - The umbrella entry is gone. Every umbrella / towel / blowing-sand line was removed
   *    from the page the same day; they were wind restated as furniture advice.
   *  - The tile no longer prints "+2". A counter is not information — it told the reader
   *    something was hidden and gave them no way to see it, since a tile is not clickable.
   *    Capping the list at three short nouns instead means the tile can simply show them
   *    all, and nothing is ever withheld.
   *
   * "Παπούτσια θαλάσσης" keeps its full name even in the tile: a bare "Παπούτσια" reads as
   * ordinary shoes and would mislead. It is two words, so it wraps at the space.
   */
  const whatToBringShort = [
    foodConfirmedAbsent && { en: 'Water', gr: 'Νερό', de: 'Wasser', it: 'Acqua', fr: 'Eau' }[language],
    shadeConfirmedAbsent && { en: 'Sunscreen', gr: 'Αντηλιακό', de: 'Sonnencreme', it: 'Crema', fr: 'Crème' }[language],
    hasPebblesOrRocks && { en: 'Water shoes', gr: 'Παπούτσια θαλάσσης', de: 'Badeschuhe', it: 'Scarpe da scoglio', fr: 'Chaussures d eau' }[language],
  ].filter((item): item is string => Boolean(item));

  /**
   * The practical half of the answer hero: road → facilities → entry → what to pack.
   *
   * Every one of these four facts already existed on the page, but two to four screens
   * down, in four separate cards of the same weight as everything else. A visitor
   * choosing an afternoon needs them at the same moment as the wave height, not after
   * scrolling past the photo, the story and the UV strip.
   *
   * WE NEVER PRINT "ΑΓΝΩΣΤΟ" IN A TILE. A tile is a statement, and a small grey box
   * reading "Άγνωστο" under the heading "Παροχές" is read as "this beach has nothing" —
   * the opposite of what it means. When we do not know, the tile is simply absent; the
   * row shrinks. Silence cannot be misread; a hedge can.
   */
  const practicalTiles = useMemo(() => {
    const tiles: PracticalTile[] = [];
    const accessShort = accessKindShortLabel(beach, language);
    const accessKind = classifyAccessKind(beach);
    if (accessKind && accessShort) {
      tiles.push({
        key: 'access',
        icon: ACCESS_KIND_ICON[accessKind],
        label: { en: 'Road', gr: 'Δρόμος', de: 'Weg', it: 'Strada', fr: 'Route' }[language],
        value: accessShort,
        hint: beach.amenities?.parking === true
          ? { en: 'parking', gr: 'πάρκινγκ', de: 'Parkplatz', it: 'parcheggio', fr: 'parking' }[language]
          : null,
        // Only the kinds that change what car you need, or whether you can drive at all.
        tone: accessKind === 'dirt' || accessKind === 'hard' || accessKind === 'boat'
          ? 'warn'
          : accessKind === 'car' ? 'good' : 'neutral',
      });
    }

    /* The summary chip already computed for the amenities section decides WHICH state we
       are in (organised / none / seasonal / unknown), so the tile and the section below
       can never disagree. But the chip's own wording is written for a full-width pill
       ("Χωρίς οργανωμένες παροχές") and a quarter-width tile fits about ten Greek
       characters per line — so the tile gets its own two-word form. Shortening the label
       is the fix; breaking the word is not. */
    /* Facilities are NOT a tile. They are a list — "is there a bar, are there sunbeds" —
       and flattening that to the single word "Οργανωμένη" threw away the answer. They get
       the full-width ticked panel under these tiles instead (AmenityPanel in the hero). */

    tiles.push({
      key: 'entry',
      icon: paidEntry ? Ticket : CheckCircle2,
      label: { en: 'Entry', gr: 'Είσοδος', de: 'Eintritt', it: 'Ingresso', fr: 'Entrée' }[language],
      value: paidEntry
        ? localizedPaidEntryLabel(paidEntry.kind, language)
        : { en: 'Free', gr: 'Ελεύθερη', de: 'Frei', it: 'Libero', fr: 'Libre' }[language],
      hint: paidEntry?.priceText ?? null,
      tone: paidEntry ? 'warn' : 'good',
    });

    tiles.push({
      key: 'bring',
      icon: whatToBringShort.length > 0 ? Backpack : CheckCircle2,
      label: { en: 'Bring', gr: 'Πάρε μαζί', de: 'Mitnehmen', it: 'Porta', fr: 'À prendre' }[language],
      // The WHOLE list, never a "+2". A tile is not clickable and there is no card below
      // it any more, so a counter announced hidden items with no way to reach them. The
      // list is capped at three short nouns precisely so it always fits.
      value: whatToBringShort.length > 0
        ? whatToBringShort.join(', ')
        : { en: 'Nothing extra', gr: 'Τίποτα έξτρα', de: 'Nichts extra', it: 'Niente', fr: 'Rien' }[language],
      hint: null,
      tone: whatToBringShort.length > 0 ? 'warn' : 'good',
    });

    /* UV, moved up from its own strip near the bottom. Same gate as before — only when
       it is high enough to change behaviour (≥6) — because a tile that says "UV 3" is
       noise, and a permanent tile would be one more box competing with the answer.
       The "no shade here" qualifier rides with it, since that is what makes UV 9 matter. */
    if (typeof peakUvIndex === 'number' && peakUvIndex >= 6) {
      tiles.push({
        key: 'uv',
        icon: Sun,
        label: 'UV',
        value: `${peakUvIndex.toFixed(0)} · ${uvDescriptor ?? ''}`.replace(/ · $/, ''),
        hint: shadeConfirmedAbsent
          ? { en: 'no shade', gr: 'χωρίς σκιά', de: 'kein Schatten', it: 'niente ombra', fr: 'pas d ombre' }[language]
          : null,
        tone: 'warn',
      });
    }

    return tiles;
  }, [beach, language, paidEntry, whatToBringShort, peakUvIndex, uvDescriptor, shadeConfirmedAbsent]);

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
  /* Is the regime wind actually blowing right now? Same two facts the atlas is built from —
     its own sectors and a wind strong enough to matter (3 Bft is the floor the shelter label
     uses; below it "sheltered" is a fact about a wind that is not blowing). Used ONLY to
     stop the seasonal panel wearing alarm colours on a calm day — never to edit its text. */
  const localWindBlowingNow = showConditions
    && beaufortLevel >= 3
    && localWindSectors.includes(windDir as string);
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
  // The whole origin phrase, not a compass word: t.windDirections holds the masculine adjective
  // that agrees with «άνεμος», so the old lookup printed «από τα Βόρειος» here.
  const swellFromLabel = thisSwell.directionDeg !== undefined
    ? directionFromPhrase(thisSwell.directionDeg, language)
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

  /**
   * THE BOTTOM BAR BECOMES A TAB BAR (11/08/2026) — and this knowingly narrows the
   * button that 05/08 had just widened to 100%. Miltos's call, made twice; the
   * reasoning that changed my own mind is worth keeping, because the earlier
   * decision is not simply overruled, it turned out to be answering a different
   * question:
   *
   * The 05/08 note is about WEIGHT — `navigation_clicked` is the metric this page
   * is judged on, so nothing may sit beside it at equal weight. That still holds
   * and is still enforced here: navigation is the only filled control, the only
   * cyan one, and takes `flex-[1.6]` against the tabs' `flex-1`.
   *
   * What the note missed is that this bar is FIXED. A shortcut in the page flow is
   * only useful before you have scrolled past it; a shortcut in this bar is on
   * screen at every scroll position, which makes it useful in the direction nobody
   * had considered — BACKWARDS. Four screens down, "show me that wave picture
   * again" is a real request, and until now the only answer was to flick up blind.
   * That is the case the page-flow version could never have served, and it is why
   * the wave tab exists here after being rejected as a chip an hour earlier.
   *
   * Two tabs are conditional, so the bar renders with 2, 3 or 4 controls. That is
   * accepted rather than padded: an always-present tab pointing at a section this
   * beach does not have is worse than a bar of varying width.
   */
  const jumpTabs: Array<{
    target: 'wave' | 'story' | 'nearby';
    elementId: string;
    label: string;
    icon: React.ReactNode;
  }> = [
    ...(showConditions ? [{
      target: 'wave' as const,
      elementId: 'today-conditions',
      label: copy.tabWave[language],
      icon: <Waves className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />,
    }] : []),
    ...(beachStory ? [{
      target: 'story' as const,
      elementId: 'beach-story',
      label: copy.tabStory[language],
      icon: <ScrollText className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />,
    }] : []),
    ...(showConditions && nearbyBeaches.length > 0 ? [{
      target: 'nearby' as const,
      elementId: 'nearby-beaches',
      label: copy.tabNearby[language],
      icon: <MapPin className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />,
    }] : []),
  ];

  // Ίδιος ήρεμος καμβάς με τη σελίδα περιοχής (28/08/2026): ήταν ντεγκραντέ τριών στάσεων,
  // που σε συνδυασμό με λευκές ημιδιάφανες κάρτες έκανε τα πάντα να λάμπουν.
  return (
    <div className="min-h-screen bg-canvas pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-white/84 px-4 py-4 shadow-surface backdrop-blur-md">
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
          <div className="rounded-control border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {language === 'gr'
              ? 'Δεν φορτώθηκαν όλες οι λεπτομέρειες. Δείχνουμε τα βασικά στοιχεία της παραλίας.'
              : 'Some beach details could not be loaded. Showing the core beach information.'}
          </div>
        )}

        {conditionsUnavailable && (
          <section role="status" data-nosnippet="true" className="flex items-start gap-3 rounded-surface border border-slate-300 bg-surface p-4 shadow-surface">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-sm font-black leading-snug text-slate-950">{copy.conditionsUnavailableTitle[language]}</h2>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-600">{copy.conditionsUnavailableBody[language]}</p>
              {lastForecastAt && (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {copy.lastForecastAt[language](toAthensWallClock(lastForecastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                </p>
              )}
            </div>
          </section>
        )}

        {/* 1. THE ANSWER — the whole beach day on one screen, weather AND practicalities.
            What it replaced: a "Decision summary" card that repeated the beach name
            (already the sticky header's <h1>) and carried a small verdict pill, followed
            by a "Weather now" card that stated the wind again as a chip, followed by four
            equal-weight metric cards that stated it a third time in different units —
            while road, facilities, entry and what-to-pack sat two to four screens further
            down in four more cards of exactly the same weight.
            Now: location → 4 weather tiles → 4 practical tiles → how today compares with a
            normal month here (the Copernicus line no competitor can print).
            The verdict pill that used to open the card is gone (01/08/2026): it stated in
            words the same judgement the tiles state in numbers directly beneath it, and the
            two read as two answers. The verdict itself still drives `tone` below, which is
            what colours this card — shown, not spelled out.
            `waterDepth` is still deliberately absent: it exists on all 2.850 records but
            has never been accuracy-checked, and the house rule is to under-claim. */}
        <BeachAnswerHero
          islandName={islandDisplayName}
          compositionLabel={beachCompositionLabel}
          tone={weatherNow.tone === 'choppy' ? 'rough' : weatherNow.tone === 'mixed' ? 'moderate' : 'calm'}
          bestTimeLabel={showConditions ? (displayedBestTimeLabel || null) : null}
          /* The instrument gets the SHORT compass form ("ΒΑ"); the long adjective
             ("βορειοανατολικό") broke across two lines inside a quarter-width tile and
             read as a typo. The long form still appears on the km/h line below. */
          /* The one sentence that makes the four instruments agree with each other. It is
             weatherNowCopy's own text — this card dropped it on 31/07 and nothing else picked
             it up, which is why an orange 2,0 m beach beside a red 1,3 m one looked arbitrary.
             Suppressed at ≤2 Bft AND calm (05/08/2026): that specific sentence only restates
             the Bft number and "calm water" the tiles already show — nothing to disambiguate
             at light wind, so it read as pure filler ("Ο άνεμος είναι μόλις 2 Μπφ τώρα —
             σχεδόν άπνοια, και το νερό είναι ήρεμο."). The ≤2 Bft branch where the sea
             DISAGREES (leftover swell) still explains something real, so it stays. */
          /* …and when that suppression fires, the slot is not left empty: it takes the
             calm-day verdict instead (05/08/2026). The complaint the suppression answered
             was «this sentence only repeats the tiles»; a line with no figure in it, that
             states the decision rather than the reading, is not the thing that was cut. */
          explanation={heroExplanation}
          explanationIsVerdict={heroExplanationIsVerdict}
          wind={showConditions ? {
            beaufort: beaufortLevel,
            beaufortHigh,
            speedKmh: windSpeedKmh,
            directionLabel: t.windDirectionsShort?.[windDir as WindDirection] || windDirectionLabel,
            longDirectionLabel: windDirectionLabel,
            /* Only from ≥3 Bft: below that "sheltered" is a fact about a wind that is not
               blowing, and the light-wind floor in weatherNowCopy makes the same call.
               …and the words that PROMISE calm — «απάνεμη», «αεράκι» — live only AT 3 Μπφ. From
               4 up the shore is still geometrically protected (the wind brings it no waves) but
               it is not calm to stand on, so the tile says the same thing the list card says,
               as a verb: «φυσάει αρκετά» (4) / «φυσάει πολύ» (5) / «φυσάει δυνατά» (6+).
               See SHELTER_LABEL, SHELTER_WORD_MAX_BEAUFORT and
               SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT in BeachAnswerHero for the why. */
            shelterLabel: beaufortLevel >= 3
              ? (() => {
                  const shelterCopy = SHELTER_LABEL[language] ?? SHELTER_LABEL.en;
                  /* ΤΑ ΤΑΒΑΝΙΑ ΤΗΣ ΛΕΞΗΣ ΔΙΑΒΑΖΟΥΝ ΤΟΝ ΜΕΓΑΛΥΤΕΡΟ ΤΥΠΩΜΕΝΟ ΑΡΙΘΜΟ (Γάνεμα
                     Σερίφου #2078, 27/08/2026): το πλακίδιο έγραφε «5–6 Μπφ» και από κάτω
                     «απάνεμη», γιατί το ταβάνι κοίταζε μόνο το κάτω άκρο (5) — αλλά ο
                     αναγνώστης δίπλα σε «απάνεμη» βλέπει το 6, δηλαδή τη Φυριπλάκα ξανά,
                     από την πίσω πόρτα του εύρους ριπών. Όποιος αριθμός τυπώνεται, αυτός
                     δεσμεύει τη λέξη· χρώμα/ετυμηγορία/κατάταξη μένουν στο κάτω άκρο. */
                  const printedBeaufortMax = Math.max(beaufortLevel, beaufortHigh ?? beaufortLevel);
                  /* ΜΙΑ ΚΛΙΜΑΚΑ ΜΕ ΤΗΝ ΚΑΡΤΑ, ΟΧΙ ΔΕΥΤΕΡΟ ΛΕΞΙΛΟΓΙΟ (Μίλτος, 28/08/2026:
                     «θέλω ό,τι λέει η εξωτερική κάρτα να συμβαδίζει με το μέσα»). Πάνω από το
                     κατώφλι της υπόσχεσης, η ακτή που δεν είναι κατάμουτρα —υπήνεμη ή πλάγια—
                     λέει ΤΗΝ ΙΔΙΑ κρίση με τη λέξη της κάρτας, σε ρήμα: «Αρκετός αέρας» →
                     «φυσάει αρκετά», «Πολύς αέρας» → «φυσάει πολύ», «Δυνατός αέρας» → «φυσάει
                     δυνατά». Έτσι η σελίδα δεν μπορεί να πει «δεν φυσάει» κάτω από ένα «4–5 Μπφ»
                     και μια γραμμή που λέει «Αρκετός αέρας». Το «κατάμουτρα» μένει σε κάθε
                     ένταση: δεν υπόσχεται τίποτα και λέει κάτι που ο αριθμός δεν λέει.
                     Δες SHELTER_LABEL και SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT στο
                     BeachAnswerHero — εκεί ζει και τι αντικατέστησε την πύλη στεριάς της 27/08. */
                  if (mapAlignedExposureLevel !== 'exposed' && printedBeaufortMax > SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT) {
                    if (printedBeaufortMax > SHELTER_WORD_MAX_BEAUFORT) return shelterCopy.protectedStrongWind;
                    if (printedBeaufortMax >= SHELTER_WORD_MAX_BEAUFORT) return shelterCopy.windFeltLot;
                    return shelterCopy.windFeltSome;
                  }
                  return shelterCopy[mapAlignedExposureLevel];
                })()
              : null,
          } : null}
          airTempC={showConditions ? displayTemp : null}
          sea={showConditions
            // isOpenWater reuses isWaveEstimate rather than inventing a second notion of "whose
            // water is this": that flag is already exactly the distinction — false only when the
            // figure IS the live marine grid cell (open water), true when the cove guard replaced
            // it with our near-shore SMB or nothing was measured. One source, so the label can
            // never disagree with the number it sits above.
            ? {
                /**
                 * ΤΟ ΔΑΠΕΔΟ ΤΩΝ 0,10 μ. ΜΠΑΙΝΕΙ ΕΔΩ, ΣΤΟ ΣΗΜΕΙΟ ΠΟΥ ΤΥΠΩΝΕΤΑΙ (25/08/2026).
                 *
                 * Λυγιά Λευκάδας, 09:00: «0,0 μ.» δίπλα σε επισκέπτη που έβλεπε νερό να σκάει
                 * στα βότσαλα. Όλη η ιστορία και η εθνική μέτρηση ζουν στο
                 * `utils/waveModel.printedWaveHeightM`. Μπαίνει στα props του πλακιδίου και ΟΧΙ
                 * στο ίδιο το `displayWaveHeightM`: εκείνο κρίνει shore-break, χαρακτηρισμό
                 * θάλασσας και τη ζωντανή πρόταση του καιρού — αν το πείραζα εδώ, θα κουνούσα
                 * αποφάσεις για να διορθώσω μια οθόνη.
                 */
                heightM: printedWaveHeightM(displayWaveHeightM) ?? null,
                label: seaConditionDisplay.value,
                isOpenWater: !isWaveEstimate,
                shoreHeightM: printedWaveHeightM(shoreWaveHeightM),
                // Η ίδια «άφιξη» που διαβάζει η κάρτα — η λέξη «σχεδόν χωρίς κύμα» την κοιτάει από 27/08/2026.
                arrivalExposureLevel: scoreResult.seaArrivalExposureLevel ?? null,
              }
            : null}
          water={showConditions && waterReading
            ? {
                celsius: waterReading.celsius,
                descriptor: waterReading.descriptor,
                tone: waterReading.tone,
              }
            : null}
          sunsetTime={showConditions ? sunsetTime : null}
          sunsetOverSea={sunsetSea.everOverSea}
          climateNote={showConditions ? climateComparison : null}
          // Decided from the SAME height the sea tile prints (displayWaveHeightM), so the sentence
          // always qualifies the figure directly above it — the hour on this page, never the day.
          shoreBreakNote={showConditions && shoreBreaksHere ? shoreBreakSentence : null}
          offshoreWindNote={showConditions && offshoreWindNoteForm ? offshoreWindNotePhrase(offshoreWindNoteForm, language) : null}
          /* The practical half. Not gated on `showConditions`: when the forecast fails we
             hide wind and waves, but the road is still a dirt road and the beach still has
             no shade — those are the facts that stay true and useful on a bad-data day. */
          practical={practicalTiles}
          /* The facilities list, whole, with its ticks — the section that used to carry it
             two screens down was deleted, so this is the only place it appears. */
          amenities={amenityRows}
          amenitiesTitle={t.amenitiesTitle}
          amenitiesNote={showAmenityDisclaimer ? getAmenityDisclaimer(language) : null}
          language={language}
        />
        {/* Η ΥΠΟΓΡΑΦΗ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΟΘΟΝΗ (22/08/2026). Κάτω από την κάρτα και ΕΞΩ από αυτήν:
            η κάρτα λέει ένα πράγμα δυνατά, και μια δεύτερη πρόταση μέσα της θα ανταγωνιζόταν
            την ετυμηγορία. Δες components/EvidenceSignature για το τι επιτρέπεται να πει. */}
        <EvidenceSignature language={language} className="mt-2" />

        {/* The tiered experience badge used to sit on the verdict row saying "Ιδανική στις
            20:00" right next to "Ήρεμα τώρα" — two pills, one meaning (reported 31/07).
            It earns its place only when it says something the verdict cannot: a boat-ride
            judgement, or a day with no good swimming window at all. Otherwise it is
            silent. `forceShow` is deliberately gone — that flag was what made it print on
            days it had nothing to add. */}
        {showConditions && (isBoatOnlyBeach || swimWindowDisplay.tone === 'avoid') && (
          <div className="px-1">
            <TodayScoreBadge
              score={detailBadgeScore}
              language={language}
              selectedDate={selectedDate}
              windBeaufort={beaufortLevel}
              // The badge judges the SAME figure the wave graphic draws below it (cove-corrected
              // where that applies). It used to read the raw scoring height, so in a cove the
              // verdict word and the metres on screen came from two different seas.
              waveHeightM={displayWaveHeightM}
              wavePeriodS={scoreResult.seaStatePeriodS}
              seaConditionScore={seaConditionScore}
              swimmingComfort={swimmingComfort}
              exposureLevel={mapAlignedExposureLevel}
              // The hero prints three readings of the same beach — this word, the map pin, and the
              // conditions chip. The colour is what the other two are built from, so it caps the
              // word here too; without it the hero could say «Καλή» over its own orange pin.
              conditionTone={scoreResult.simpleWindSuitability?.suitabilityColor}
              canClaimWindProtection={canClaimWindProtectionForCopy}
              selectedHour={selectedHour}
              boatAccess={isBoatOnlyBeach}
            />
          </div>
        )}

        {showConditions && (<>
        {/* ===== REMOVED 31/07/2026: the whole "Καιρός στην παραλία {X} τώρα" card. =====
            It carried three things and the hero now says all three, higher and shorter:
            the verdict pill, a live sentence ("Με βορειοανατολικό άνεμο 3 Μπφ που φυσάει
            τώρα, εδώ είναι σχετικά προστατευμένα") and the orientation line ("βλέπει νότια
            και προστατεύεται από βόρειους και ανατολικούς ανέμους"). Between them and the
            hero's verdict + "3 Μπφ ΒΑ" tile, the same fact was stated three times before
            the reader reached a single picture.

            THE SEO ARGUMENT FOR KEEPING IT WAS WRONG, AND THIS IS WHY IT IS WRITTEN DOWN.
            The old comment here claimed the <h2> and the orientation line "must stay in the
            DOM for the καιρός {beach} intent". They never were in it. Measured in the built
            output before removing anything (dist/el/beaches/chania/604-kedrodasos/index.html):
            "Καιρός στην παραλία" → 0 hits, "προστατεύεται" → 0 hits. The card is rendered
            client-side only, so Googlebot's indexed HTML never contained a word of it. What
            actually carries that intent is the <title> — "Παραλία Κεδρόδασος, Χανιά — Καιρός,
            Άνεμος & Κύμα" — which is untouched. Lesson, same as ODbL and the photos: a claim
            about what is on a page is worth nothing until someone greps the built file.

            The orientation fact itself is NOT lost — utils/shoreIncidenceCopy still prints
            the part that adds information (where this shore sits among its neighbours) at
            the top of the conditions section, immediately below. */}

        {/* Today's conditions — now the FIRST thing after the answer, as it should be: a
            picture of the sea beats a paragraph about it.
            The wave graphic used to lead this section, and on a meltemi day it
            prints the SAME figure on every beach of the island (one ~9 km marine cell): 90,5% of
            2.850 beaches nationally, and every beach in 25 of 95 regions. So the section now leads
            with the one thing that genuinely differs between two shores at the same hour — how the
            live wind meets this one, and where it sits among its neighbours. Words only, never
            metres: see utils/shoreIncidenceCopy for why no arithmetic may go here. */}
        {/* Jump target for the «Κύμα» tab in the bottom bar. Unlike the other two this
            one is usually a jump BACKWARDS — the bar is fixed, so it is on screen four
            screens down, where "show me that wave picture again" is a real request. */}
        <section id="today-conditions" tabIndex={-1} className="scroll-mt-24 space-y-3 focus:outline-none" data-nosnippet="true">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.conditions[language]}</h3>
          {shoreIncidenceLine && (
            <p className="px-1 text-sm leading-relaxed text-slate-700">{shoreIncidenceLine}</p>
          )}
          {/* Πάνω από την εικόνα του κύματος, γιατί εξηγεί ΤΗΝ ΕΙΚΟΝΑ: το σχέδιο δείχνει ένα
              χαμηλό κύμα και ο επισκέπτης το διαβάζει ως «ήσυχα». Από κάτω θα ήταν διόρθωση. */}
          {choppySeaLine && (
            <p className="px-1 text-sm leading-relaxed text-slate-700">{choppySeaLine}</p>
          )}
          <WaveHeightGraphic
            variant="full"
            // THE SCENE DRAWS THE WATER SOMEONE WOULD STAND IN (05/08/2026).
            //
            // This card is a person to scale, ankle-deep, under a breaking wave — it answers
            // «πώς θα είναι να μπω», which is a question about the SHORE. Fed the open-water
            // figure it drew a metre of surf beside a paragraph that read «Το νερό μένει
            // επίπεδο» — the card contradicting its own caption, on the shores where the
            // caption was right (Σχινιάς, 5 Bft off the land, webcam showing glass).
            //
            // ⚠️ 13/08/2026 — ΤΟ ΕΥΡΟΣ ΑΛΛΑΞΕ, Η ΛΟΓΙΚΗ ΟΧΙ. Μέχρι σήμερα το `shoreWaveHeightM`
            // ήταν undefined παντού εκτός από κλειστό όρμο με απόγειο άνεμο, οπότε αυτή η γραμμή
            // άλλαζε 647 παραλίες. Τώρα διαβάζει `shoreDisplayWaveM`, που υπάρχει για ΚΑΘΕ
            // παραλία (βίβλος §Γ5) — και αυτό είναι σωστό ακριβώς επειδή αυτό το γραφικό δηλώνει
            // από μόνο του ότι απαντά ερώτηση ΓΙΑ ΤΗΝ ΑΚΤΗ. Σε 2.104 από 2.854 παραλίες ο
            // αριθμός είναι ο ίδιος με πριν (εκτεθειμένες + μερικώς, συντελεστής 1,0)· αλλάζει
            // μόνο σε προστατευμένες, κατά 0,18 μ. διάμεσα.
            //
            // Where it IS defined it replaces the figure
            // wholesale rather than only the drawing, which keeps the card's own documented
            // identity intact: what it draws is what its verdict is judged from. The wind half
            // of that verdict is untouched and still floors the swim feel at 'moderate' from
            // 5 Bft (utils/seaVerdict.getWindSeverity), so a flat lee shore in a blow reads
            // «πιο προστατευμένη, με κυματισμό» — never «calm».
            waveHeightM={shoreWaveHeightM ?? displayWaveHeightM}
            wavePeriodS={scoreResult.seaStatePeriodS}
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
            // The shape of THIS beach, not today's sea: deep water off a coarse shore narrows the
            // drawn surf zone and tilts the bank, so the picture matches the sentence above it.
            steepShore={hasSteepCoarseShore(beach.metadata?.waterDepth?.type, beach.metadata?.terrain?.types)}
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
          {/* The four ConditionCards that used to sit here (wind / sea / water / air) are
              now the four instruments inside the answer hero at the top of the page. They
              were a fourth statement of numbers already given twice above them, in a third
              set of units, at the same visual weight as everything else — the single
              biggest reason the page read as a wall of equal cards. The one figure they
              carried that the hero has no room for is the sea-state qualifier, which now
              rides under the wave graphic that actually draws it.
              For boat-only beaches the sea line is about the RIDE, not the swim, so it
              keeps its own row here rather than being flattened into a wave height. */}
          {isBoatOnlyBeach && (
            <div className="grid grid-cols-1 gap-2.5">
              <ConditionCard
                icon={<Ship className="w-5 h-5 text-cyan-500" />}
                label={boatRideConditionLabel}
                value={seaConditionDisplay.value}
                subValue={seaConditionDisplay.subValue}
              />
            </div>
          )}
          {/* REMOVED 31/07/2026 — the "towel comfort" line ("Η πετσέτα θα μείνει κάτω",
              "στερέωσε καλά πετσέτα και ομπρέλα", "πιθανή ενοχλητική άμμος στον αέρα").
              It was a fourth restatement of the wind, dressed as advice: it read the same
              windSpeedKmh/gustKmph the hero's Beaufort tile already shows and turned it
              into a sentence about beach furniture. Someone who sees "3 Μπφ" does not need
              to be told their towel will stay put. Dropped along with every umbrella /
              towel / blowing-sand line on the page, on the owner's call. */}
          {localWindNote && (
            <p className={`flex items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold ${
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
          {/* THE ATTRIBUTION USED TO BE PRINTED HERE **AND** IN THE FOOTER (removed 05/08/2026).
              The comment that stood here said this page "bypasses the site footer entirely,
              so it's the one surface needing its own copy" — true when it was written, and
              untrue since 30/07/2026, when this page started rendering <LegalFooter> itself
              precisely because it had no footer. Nobody came back to delete the workaround, so
              «Δεδομένα καιρού από την Open-Meteo · Θαλάσσια μοντέλα: DWD EWAM · Météo-France»
              appeared twice on one page, word for word, once mid-scroll and once at the end.
              The footer copy stays: it is the one every other page uses, it is what the
              prerendered HTML carries, and the licence obligation is satisfied once. */}
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

        {/* ---- Section break: today's conditions end, the beach itself begins. ----
            Twenty cards in a row, all the same white, the same radius and the same
            shadow, is why this page read as a wall: nothing told the eye where one
            subject stopped and the next started, so a visitor who wanted "is there
            shade?" had to scan every block. Two hairline rules with a word on them
            cost nothing and give the scroll a shape: ANSWER → THE BEACH → NEARBY. */}
        <SectionBreak label={copy.sectionBeach[language]} />

        {/* 2. Photo Gallery */}
        <section className="space-y-3">
          {realPhotos.length > 0 ? (
            <>
              <div className="relative aspect-[16/10] overflow-hidden rounded-surface border border-line shadow-lifted sm:aspect-[4/3]">
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
              {/* A visitor's own photo has no external page to link to — the
                  permission lives in the form they filled in, not on Commons —
                  so the byline is plain text there. An <a href=""> would reload
                  the page, which is what "click the photographer's name" did. */}
              {photoCredit && (
                <p className="px-1 text-[11px] font-medium leading-snug text-slate-600">
                  {photoCredit.href ? (
                    <a
                      href={photoCredit.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                    >
                      {photoCredit.label}
                    </a>
                  ) : (
                    photoCredit.label
                  )}
                </p>
              )}
              {/* THE ASK, MOVED UP AND GIVEN WEIGHT (08/08/2026, Miltos).
                  It used to be a small underlined link at the very bottom of
                  this section, below the thumbnails — the last thing on a block
                  most people scroll straight past. Photos are the thing we most
                  need from visitors and 63% of beaches still have none, so the
                  request now sits directly under the photo it is talking about,
                  where the comparison is happening anyway.

                  SAME ASK AS THE LANDING PAGE, on purpose: same voice, same
                  button, same sheet. Two differently-worded campaigns for one
                  favour would read as two favours. */}
              {onAddPhoto && (
                <div className="flex flex-col gap-3 rounded-[1.25rem] border border-cyan-100 bg-cyan-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold leading-snug text-slate-900">
                      {(photoContributionCopy[language] || photoContributionCopy.en).betterTitle}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-600">
                      {(photoContributionCopy[language] || photoContributionCopy.en).betterBody}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onAddPhoto}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#007a83] px-4 text-sm font-extrabold text-white shadow-surface transition-colors hover:bg-[#00646c] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/40"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    {(photoContributionCopy[language] || photoContributionCopy.en).betterCta}
                  </button>
                </div>
              )}

              {realPhotos.length > 1 && (
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {realPhotos.slice(1).map((url, i) => (
                    <div key={i} className="flex-shrink-0 w-24 sm:w-32 aspect-square rounded-control overflow-hidden shadow-surface">
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

              {/* The quiet duplicate that used to live here is gone: the same
                  request now sits ABOVE the thumbnails, where it is actually
                  seen. Two buttons for one favour, on one screen, is how a
                  request starts reading as nagging. */}
            </>
          ) : (
            <>
              {shorelineShape ? (
                <BeachDetailShorelinePanel
                  shape={shorelineShape}
                  beach={beach}
                  beachName={beachDisplayName}
                  language={language}
                />
              ) : (
                <BeachDetailPhotoPlaceholder />
              )}
              <PhotoContributionPrompt
                beachName={beachDisplayName}
                language={language}
                suggestionUrl={photoSuggestionUrl}
                onClick={photoSuggestionUrl ? handlePhotoSuggestionClick : undefined}
                onAddPhoto={onAddPhoto}
              />
            </>
          )}
        </section>


        {/* 4a. About this beach — curated history/geology/character (own section so
            the "Συνθήκες" heading stays about today's weather, not beach info) */}
        {beachStory && (
          /* Jump target for the «Πληροφορίες» tab. `scroll-mt-24` (96 px) is not
             decoration: the header is `sticky top-0` and MEASURED 77 px on a 390 px
             phone (not the ~64 I assumed — scroll-mt-20 landed the heading 3 px under
             it, technically visible and visually cramped). Without the margin the
             heading you jumped to hides behind the header entirely and the visitor
             lands on a paragraph starting mid-sentence. tabIndex/outline: see
             handleJump. Both the width and the landing are measured by
             scripts/validateTileFit.mjs, which clicks each tab for real. */
          <section id="beach-story" tabIndex={-1} className="scroll-mt-24 space-y-3 focus:outline-none">
            <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">
              <ScrollText className="h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
              {copy.beachStoryHeading[language]}
            </h3>
            <div className="rounded-control border border-line bg-surface px-4 py-3.5">
              {beachStory.title[storyLocale] && (
                <p className="text-sm font-semibold text-teal-700">{beachStory.title[storyLocale]}</p>
              )}
              {/* The WHOLE story, always. The "Διάβασε περισσότερα" toggle hid every
                  paragraph after the first behind a click — on the one block of the page
                  that is genuinely unique per beach, hand-written, and the reason someone
                  who found us through search stays. Measured 29/07: the median story is
                  621 characters total, first paragraph 234. There was never enough text
                  here to be worth folding, and folding it cost us the part that is not
                  boilerplate. */}
              <div className="mt-2 space-y-2">
                {beachStory.paragraphs[storyLocale].map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-slate-600">{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4b. REMOVED 31/07/2026 — the UV strip is now a practical tile in the answer
            hero, on the same ≥6 gate, carrying the same "καθόλου σκιά εδώ" qualifier. The
            sunset time it used to lead with moved up earlier the same day. Nothing on this
            strip was unique to it, so the strip itself went. */}

        {/* 4b-ii. Sunset over the sea — evergreen orientation fact (NOT forecast-gated),
            our answer to the competitor sun diagram. Hidden for beaches that never face
            the setting sun so we never show a negative. */}
        {sunsetSea.everOverSea && (() => {
          const sunsetCopy = SUNSET_SEA_COPY[language] ?? SUNSET_SEA_COPY.en;
          return (
            <section className="rounded-control border border-amber-100/70 bg-amber-50/70 px-4 py-3.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-800">
                <Sunset className="h-4 w-4 shrink-0 text-orange-500" aria-hidden="true" />
                {sunsetCopy.title}:
                <span className="text-orange-700">{formatSunsetSeason(sunsetSea, language)}</span>
              </span>
              <p className="mt-1.5 text-sm leading-snug text-slate-700">{sunsetCopy.expect}</p>
              <p className="mt-1 text-sm font-medium leading-snug text-slate-600">{sunsetCopy.tip}</p>
              <p className="mt-1.5 text-xs leading-snug text-amber-700/70">{sunsetCopy.caveat}</p>
            </section>
          );
        })()}

        {/* 4c. Rain warning — name the rainy hours and advise leaving the sea then.
             Rain happening right now is a live safety warning (amber), rain later
             today is information you can plan around (blue). */}
        {showConditions && rainAdvisory && (
          <section
            className={`flex items-start gap-3 rounded-surface border p-4 shadow-surface ${
              rainAdvisory.isRainingNow
                ? 'border-amber-300/80 bg-amber-50/80 shadow-amber-900/5'
                : 'border-sky-200/80 bg-sky-50/70 shadow-sky-900/5'
            }`}
            role="alert"
            data-nosnippet="true"
          >
            <div
              className={`shrink-0 rounded-control p-2.5 text-white shadow-surface ${
                rainAdvisory.isRainingNow ? 'bg-amber-500' : 'bg-sky-500'
              }`}
            >
              {rainAdvisory.isRainingNow ? (
                <CloudRain className="h-5 w-5" />
              ) : (
                <Droplets className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold ${rainAdvisory.isRainingNow ? 'text-amber-900' : 'text-sky-900'}`}>
                {rainAdvisory.title}
              </h3>
              <p
                className={`mt-1 text-sm font-medium leading-snug ${
                  rainAdvisory.isRainingNow ? 'text-amber-900/85' : 'text-sky-900/85'
                }`}
              >
                {rainAdvisory.body}
              </p>
            </div>
          </section>
        )}

        {/* 5. Best Time Today */}
        {showConditions && bestTime && (usefulBestTimeWindow || allDaySuitable) && (
          <section className={`flex items-start gap-3 rounded-surface border p-4 shadow-surface ${swimWindowToneClasses.section}`} data-nosnippet="true">
            <div className={`rounded-control p-2.5 text-white shadow-surface ${swimWindowToneClasses.icon}`}>
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

        {/* 6. «ΒΑΘΑΙΝΕΙ ΓΡΗΓΟΡΑ» — Η ΜΕΤΡΗΣΗ ΤΟΥ ΒΥΘΟΥ, ΩΣ ΠΛΗΡΟΦΟΡΙΑ (22/08/2026).
            Στέκεται εδώ, μέσα στην ενότητα της παραλίας και όχι στις σημερινές συνθήκες,
            γιατί δεν αλλάζει με τη μέρα: είναι σταθερό χαρακτηριστικό του βυθού.
            Ουδέτερο χρώμα ΕΠΙΤΗΔΕΣ — δεν είναι προειδοποίηση, είναι γεγονός με νούμερο, και
            το νούμερο αφήνει τον αναγνώστη να κρίνει μόνος του αντί να του πούμε τι να κάνει.
            Το αντίστροφο («ρηχά, ιδανικά για παιδιά») ΔΕΝ λέγεται ποτέ από εδώ: η πηγή
            εξομαλύνει τα ρηχά, άρα μόνο η βαθιά πλευρά της είναι αξιόπιστη.
            Ο δρόμος των πόντων μετρήθηκε και απορρίφθηκε — βλ. utils/seabedEntry. */}
        {typeof beach.steepSeabedDepthM === 'number' && (
          <section className="flex items-start gap-3 rounded-surface border border-line bg-surface p-4 shadow-surface">
            <div className="rounded-control bg-slate-100 p-2.5 text-slate-600">
              <Waves className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-slate-900">
                {buildSteepSeabedNote(language, beach.steepSeabedDepthM)}
              </p>
              <p className="mt-1 text-xs font-medium leading-snug text-slate-500">
                {buildSteepSeabedSource(language)}
              </p>
            </div>
          </section>
        )}

        {/* 7. REMOVED 31/07/2026 — the facilities list moved WHOLE into the answer hero
            as a ticked panel (AmenityPanel), rows and disclaimer included. It was the one
            practical fact that is a list rather than a single value, which is why it did
            not become a tile. Deleted rather than duplicated. */}

        {/* 7a-0. Paid entry — "you pay to be here" (entrance fee / private club / sunbed-only).
            Each kind gets its own honest explanation; never a vague "paid" tag. */}
        {paidEntry && (
          <section className="flex items-start gap-3 rounded-surface border border-amber-200/80 bg-amber-50/70 p-4 shadow-surface shadow-amber-900/5">
            <div className="shrink-0 rounded-control bg-amber-500 p-2.5 text-white shadow-surface">
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

        {/* 7-cert. CalmBeach Certified — the first-party house seal. Shown only for beaches we
            have physically visited and verified (curated in utils/certifiedBeaches.ts). */}
        {certification && (
          <section className="flex items-start gap-3 rounded-surface border border-teal-200/70 bg-teal-50/50 p-4 shadow-surface shadow-teal-900/5">
            <div className="shrink-0 rounded-control bg-[#007a83] p-2.5 text-white shadow-surface">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h3 className="font-bold text-teal-950">{copy.certifiedTitle[language]}</h3>
              <p className="text-sm font-semibold leading-snug text-teal-900">{copy.certifiedBody[language]}</p>
              {certifiedNote && (
                <p className="border-l-2 border-teal-300 pl-3 text-sm font-semibold italic leading-snug text-teal-800">
                  «{certifiedNote}»
                </p>
              )}
              <p className="text-xs font-bold text-teal-700">
                {copy.certifiedVerifiedOn[language]}: {certifiedWhen}
              </p>
            </div>
          </section>
        )}

        {/* 7a-1. REMOVED 31/07/2026 — "Ελεύθερη πρόσβαση" is the ΕΙΣΟΔΟΣ tile in the
            answer hero. The card's two sentences of legal background (public shore by
            law, no fee on record) were the reason it existed; the tile answers the actual
            question — free or pay — where the reader is deciding. */}

        {/* 7a. REMOVED 31/07/2026 — "Τι να φέρεις" is now the fourth practical tile in the
            answer hero, where a visitor sees it while deciding rather than four screens
            after deciding. Keeping the card as well would have been the same duplication
            the whole pass exists to remove: same list, same gates, twice on one page.
            The list itself lives on as whatToBringShort, which now drives the tile and is
            capped at three items so the tile can show all of them. */}

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
                  <div key={camp.id} className="flex min-h-12 items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2 shadow-surface">
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
                      /* h-11 w-11 = 44 px. An icon-only link has no text to enlarge the box,
                         so the box has to be sized deliberately (measured at 36 px, 05/08). */
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
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
              <div role="alert" className="flex items-start gap-2 rounded-control border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold leading-snug text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{getAccessibilityHeadline(beach, language)}</span>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {accessibilityRows.map((row) => (
                <div key={row.key} className="flex min-h-12 items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2 shadow-surface">
                  <span className="min-w-0 text-sm font-bold text-slate-700">{row.label}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${amenityStatusClass(row.status)}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 rounded-control border border-sky-100 bg-sky-50/70 px-3 py-2.5">
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

        {/* 7c. REMOVED 31/07/2026 — "Πώς θα πας" is the ΔΡΟΜΟΣ tile in the answer hero
            (same classifyAccessKind, short form). The tile carries the verdict and the
            parking flag; the longer sentence it used to add was background, not decision.
            components/GettingThereSection.tsx stays: it still owns the classifier and the
            short labels the tile reads. */}

        {/* 7d. Live webcam — a hand-verified third-party public camera (types.ts BeachWebcam).

            Linked, never embedded; the operator is the anchor so the picture is never

            mistaken for ours. Search Console showed the demand (26/08/2026). */}

        {beach.webcam?.url && (

          <section className="space-y-3">

            <h3 className="flex items-center gap-2 px-1 font-heading text-lg font-bold text-slate-950">

              <Camera className="h-5 w-5 text-sky-700" aria-hidden />

              {getWebcamSectionTitle(language)}

            </h3>

            <div className="space-y-1.5 rounded-control border border-sky-100 bg-sky-50/70 px-3 py-2.5">

              <p className="text-sm font-bold text-slate-700">{getWebcamLead(language)}</p>

              <a

                href={beach.webcam.url}

                target="_blank"

                rel="noopener noreferrer"

                className="inline-flex min-h-[44px] items-center gap-1 text-sm font-extrabold text-sky-700 underline decoration-sky-300 underline-offset-2"

              >

                {beach.webcam.operator} <ExternalLink className="h-3.5 w-3.5" aria-hidden />

              </a>

              <p className="text-[11px] font-semibold leading-snug text-slate-600">

                {getWebcamDisclaimer(language)} · {getWebcamCheckedLabel(language)}: {beach.webcam.verifiedAt}

              </p>

            </div>

          </section>

        )}


        {/* 8. Map Location */}
        <section className="space-y-3" data-nosnippet="true">
          <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{copy.locationTitle[language]}</h3>
          <DeferUntilVisible
            className="h-56 w-full overflow-hidden rounded-surface border border-line bg-slate-100 shadow-surface sm:h-64"
            /* Same grey block Suspense already used, so nothing moves when the map arrives. */
            placeholder={<div className="h-full w-full bg-slate-100" />}
          >
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
                    bestBeachTime: bestTime,
                    // THE SEA. Without these three the marker gets seaStateM === undefined, so
                    // the running-sea ceiling in resolveConditionTone never fires here while it
                    // does on the region map — the same beach renders one colour outside and
                    // another inside, on every beach whose sea is at or above SEA_STATE_AMBER_M.
                    // Reported 01/08/2026 ("άλλα μέσα, άλλα έξω, σε πολλές"), which is exactly
                    // the shape this predicts: not all beaches, only the ones the sea capped.
                    // enclosedCove rides along because it is the one sanctioned exemption from
                    // that ceiling (utils/suitabilityTone.coveHoldsCalmWater).
                    seaStateWaveM: scoreResult.seaStateWaveM,
                    seaStatePeriodS: scoreResult.seaStatePeriodS,
                    enclosedCove
                  }]}
                  userLocation={userLocation}
                  campsites={nearbyCampsites.map((c) => ({ id: c.id, name: c.name, lat: c.coordinates.lat, lon: c.coordinates.lon }))}
                  center={[beach.coordinates.lat, beach.coordinates.lon]}
                  zoom={14}
                  // Colour the pin from THE SAME WIND THE REGION MAP USES — this beach's own
                  // cluster reading (mapWind) when we have it, the region wind otherwise.
                  //
                  // The rule has never changed: this pin and the region map's pin must be the
                  // same colour. What "the same" points at did. Until 01/08/2026 the region map
                  // coloured every beach from the island wind, so passing dayForecast here was
                  // correct. That day the region map moved to per-beach cluster wind and this
                  // map did not follow, which reopened the exact divergence the override exists
                  // to prevent — the level was pinned, but getExposureMarkerTone also keys on
                  // Beaufort, so one band of difference repainted the same beach.
                  //
                  // When conditions are stale-blocked, keep the location map but drop the wind so
                  // the pin renders neutral (no stale colour) — matches the region map's behaviour.
                  windSpeed={showConditions ? (mapWind ? mapWind.speedKmh / 3.6 : dayForecast.wind.speed) : undefined}
                  windDirection={showConditions ? degToCompass(mapWind?.deg ?? dayForecast.wind.deg) : undefined}
                  windDirectionDeg={showConditions ? (mapWind?.deg ?? dayForecast.wind.deg) : undefined}
                  language={language}
                  islandName={islandName}
                  selectedDate={selectedDate}
                  exposureLevelOverrides={showConditions && mapExposureLevelOverride ? new Map([[beach.id, mapExposureLevelOverride]]) : undefined}
                  compact
                />
              </React.Suspense>
            </MapLoadBoundary>
          </DeferUntilVisible>
          {canNavigate && (
            <button
              type="button"
              onClick={handleNavigation}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-control bg-slate-900 px-4 font-bold text-white shadow-lifted transition-colors hover:bg-cyan-700"
            >
              <Navigation className="w-5 h-5" />
              {copy.openNavigation[language]}
            </button>
          )}
          {canNavigate && <NavigationBadge beach={beach} language={language} className="mt-2" />}
        </section>

        {/* Feedback System — asks "was our forecast accurate?"; moot when we showed no conditions. */}
        {showConditions && (
        <section className="bg-white p-4 rounded-surface border border-line shadow-surface space-y-4" data-nosnippet="true">
          <div className="space-y-1">
            <h3 className="text-base font-heading font-bold text-slate-900">{copy.feedbackTitle[language]}</h3>
            <p className="text-slate-700 text-sm leading-snug">{copy.feedbackText[language]}</p>
          </div>

          {(feedbackSubmitted || feedbackAlreadyGiven) ? (
            <div
              className="flex items-start gap-3 rounded-control bg-emerald-50 px-4 py-4 text-emerald-800"
              role="status"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{{ en: 'Thank you so much!', gr: 'Σε ευχαριστούμε πολύ!', de: 'Vielen herzlichen Dank!', it: 'Grazie di cuore!', fr: 'Merci beaucoup !' }[language]}</p>
                <p className="text-sm leading-snug text-emerald-700">{{
                  en: 'You help us enormously to get better — you are our eyes on the beach.',
                  gr: 'Μας βοηθάς απίστευτα να γινόμαστε καλύτεροι — είσαι τα μάτια μας στις παραλίες.',
                  de: 'Du hilfst uns enorm, besser zu werden — du bist unsere Augen am Strand.',
                  it: 'Ci aiuti tantissimo a migliorare — sei i nostri occhi in spiaggia.',
                  fr: 'Vous nous aidez énormément à nous améliorer — vous êtes nos yeux sur la plage.',
                }[language]}</p>
              </div>
            </div>
          ) : pendingFeedbackVerdict ? (
            // Step 2: which part of the day the visitor was actually at the beach. Without this,
            // a report typed at 22:00 about a 09:00 visit has no time signal but the click itself.
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900">{copy.feedbackWhenTitle[language]}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => submitFeedback(pendingFeedbackVerdict, 'now')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-line text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  {copy.feedbackWhenNow[language]}
                </button>
                <button
                  type="button"
                  onClick={() => submitFeedback(pendingFeedbackVerdict, 'morning')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-line text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  {copy.feedbackWhenMorning[language]}
                </button>
                <button
                  type="button"
                  onClick={() => submitFeedback(pendingFeedbackVerdict, 'midday')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-line text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  {copy.feedbackWhenMidday[language]}
                </button>
                <button
                  type="button"
                  onClick={() => submitFeedback(pendingFeedbackVerdict, 'evening')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-line text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  {copy.feedbackWhenEvening[language]}
                </button>
              </div>
              <button
                type="button"
                onClick={() => submitFeedback(pendingFeedbackVerdict, 'unsure')}
                className="w-full text-center text-xs font-semibold text-slate-400 underline decoration-dotted hover:text-slate-600"
              >
                {copy.feedbackWhenSkip[language]}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFeedback('accurate')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-emerald-100 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95"
              >
                <ThumbsUp className="w-4 h-4" />
                {{ en: 'It matched', gr: 'Ταίριαζε', de: 'Hat gestimmt', it: 'Corrispondeva', fr: 'Ça correspondait' }[language]}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('had_waves')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-sky-100 text-sm font-bold text-sky-700 transition-all hover:bg-sky-50 active:scale-95"
              >
                <span aria-hidden>🌊</span>
                {{ en: 'More waves', gr: 'Είχε πιο πολύ κύμα', de: 'Mehr Wellen', it: 'Più onde', fr: 'Plus de vagues' }[language]}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('too_windy')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-amber-100 text-sm font-bold text-amber-700 transition-all hover:bg-amber-50 active:scale-95"
              >
                <span aria-hidden>💨</span>
                {{ en: 'More wind', gr: 'Είχε πιο πολύ αέρα', de: 'Mehr Wind', it: 'Più vento', fr: 'Plus de vent' }[language]}
              </button>
              <button
                type="button"
                onClick={() => handleFeedback('calmer')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-control border border-line text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
              >
                <span aria-hidden>😎</span>
                {{ en: 'Calmer than you said', gr: 'Ήταν πιο ήρεμα', de: 'Ruhiger als gesagt', it: 'Più calmo del previsto', fr: 'Plus calme que prévu' }[language]}
              </button>
            </div>
          )}
        </section>
        )}

        {/* ---- Section break: this beach ends, the alternatives begin. ---- */}
        <SectionBreak label={copy.sectionNearby[language]} />

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
          localWindBlowingNow={localWindBlowingNow}
          onSelect={(id) => {
            const target = allBeaches.find(b => b.id === id);
            if (target) onBeachClick(target);
          }}
        />

        {showConditions && nearbyBeaches.length > 0 && (
        /* Jump target for the "Κοντινές προτάσεις" chip — same header-clearance and
           focus reasoning as the story section above. */
        <section id="nearby-beaches" tabIndex={-1} className="scroll-mt-24 space-y-4 focus:outline-none" data-nosnippet="true">
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
                        className="w-full p-3 bg-white rounded-surface border border-line flex items-center justify-between gap-3 text-left shadow-surface transition-colors hover:border-cyan-200 group"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative w-16 h-16 rounded-control overflow-hidden flex-shrink-0">
                            {itemPhoto ? (
                              <img
                                src={itemPhoto}
                                alt={displayBeachName(item.beach.name, language)}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            ) : (
                              <BeachPhotoFallback
                                beach={item.beach}
                                regionId={regionId}
                                language={language}
                                beachName={displayBeachName(item.beach.name, language)}
                                crop="square"
                              />
                            )}
                          </div>
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
                              wavePeriodS={item.seaStatePeriodS}
                              swimmingComfort={item.swimmingComfort}
                              exposureLevel={item.exposureLevel}
                              conditionTone={item.simpleWindSuitability?.suitabilityColor}
                              canClaimWindProtection={item.canClaimWindProtection}
                              selectedHour={selectedHour}
                              boatAccess={hasBoatOnlyAccess(item.beach)}
                              forceShow
                            />
                            {/* POINTS, NOT A PARAGRAPH (11/08/2026).
                                First it was `line-clamp-2`, and on a phone the sentence runs to
                                three lines, so EVERY card ended in «…» — the clamp was buying an
                                even card height by cutting the only line that says why THIS beach
                                and not the one above it. Removing the clamp fixed the truncation
                                and left the other half of the problem: four cards of prose, each
                                opening with the same 45 characters («Αύριο ταιριάζει περισσότερο
                                αν ψάχνεις …»), with the part that actually differs buried inside.
                                A list is read by scanning, so the scaffolding goes and the facts
                                stay. The sentence is still what a single beach's own page uses. */}
                            {itemExplanation.cardPoints.length > 0 ? (
                              <ul className="space-y-0.5 pt-0.5" data-nosnippet="true">
                                {itemExplanation.cardPoints.map((point) => (
                                  <li
                                    key={point}
                                    className="flex gap-1.5 text-xs font-semibold leading-snug text-slate-600"
                                  >
                                    <span className="select-none text-slate-400" aria-hidden="true">·</span>
                                    <span className="min-w-0">{point}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p
                                className="text-xs font-semibold leading-snug text-slate-600"
                                data-nosnippet="true"
                              >
                                {itemExplanation.cardSummary || itemWindSummary}
                              </p>
                            )}
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

        {/* 9. Beach guides — links to the island's "best X beaches" articles,
            plus the hub that collects every guide the site publishes. */}
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
                  /* Same rule as the hub chip beside it, which has always had this:
                     these are prerendered files, so under `vite dev` the path does
                     not exist and a relative href just reboots the SPA. It looked
                     like a dead link with no explanation. resolveGuideHref points
                     dev at the live URL and flags it external. */
                  target={guide.external ? '_blank' : undefined}
                  rel={guide.external ? 'noopener noreferrer' : undefined}
                  /* 34 px measured on a real phone (05/08/2026) — these are standalone
                     pill links, not inline text, so the 44 px minimum applies to them. */
                  className={guide.matches
                    ? 'inline-flex min-h-[44px] items-center rounded-full border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-sm font-extrabold text-teal-800 hover:bg-teal-100'
                    : 'inline-flex min-h-[44px] items-center rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-bold text-teal-700 hover:border-teal-300 hover:bg-teal-50'}
                >
                  {guide.matches ? `✓ ${guide.label}` : guide.label}
                </a>
              ))}
              <a
                href={guidesHubLink.href}
                target={guidesHubLink.external ? '_blank' : undefined}
                rel={guidesHubLink.external ? 'noopener noreferrer' : undefined}
                className="inline-flex min-h-[44px] items-center rounded-full border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-sm font-extrabold text-teal-700 hover:bg-teal-100"
              >
                {GUIDES_HUB_LABEL[language] || GUIDES_HUB_LABEL.en} →
              </a>
            </div>
          </section>
        )}

      </main>

      {/* The page used to end right here, on a row of guide chips.
          App.tsx returns early for view === 'detail', before its own <LegalFooter>
          ever renders, so the ~8.200 beach pages — the exact screen where someone
          decides whether to get in the water — carried no safety note, no Terms or
          Privacy, and no way to contact us. Same component the rest of the site
          uses, so the wording and the cookie controls stay in one place. */}
      <div className="mt-10">
        <LegalFooter language={language} />
      </div>

      {/* ONE ACTION, FULL WIDTH (05/08/2026).
          On 29/07 the ♥/share pair was cut from three places on this page down to two — the
          sticky header and this bar. Seeing it on a real phone showed what the count could
          not: the header does not scroll away, so BOTH survivors are on screen together, at
          every scroll position, all the way down six and a half screens. Two identical hearts
          in one viewport is not a shorter list, it is the same duplication standing still.
          The header keeps them (always reachable, and it is where a title bar's actions
          belong); the bar keeps the one thing it is for. `navigation_clicked` is the metric
          this page is judged on — it now gets the whole width instead of 62% of it.
          When there is nothing to navigate to, the bar has no reason to exist at all.

          ONE BOTTOM BAR VOCABULARY FOR THE WHOLE SITE (11/08/2026, Miltos).
          This bar deliberately copies components/MobileBottomNav.tsx — the same border,
          blur, shadow, `h-16` row, `h-5 w-5` icons and `text-[10px]` labels — because a
          visitor meets that bar on the home page and this one on a beach page, and two
          different-looking bars in the same bottom-of-screen slot read as two different
          apps. MobileBottomNav IS the reference: change it and this must follow.

          What that costs, stated plainly: navigation was a filled cyan pill and is now a
          flat icon like the rest. The 05/08 rule that nothing may sit beside
          `navigation_clicked` at equal weight is now carried by COLOUR alone — it is the
          only control in `text-primary-dark` while every other is `text-slate-600`, which
          is exactly how the home bar already marks its important tab. If
          `navigation_clicked` drops after this, the lever to pull is that one button's
          fill, not the other four. */}
      {(canNavigate || jumpTabs.length > 0 || onAddPhoto) && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(15,23,42,0.14)] backdrop-blur-xl md:hidden">
          {/* data-tabfit: the same measurable hook the answer tiles carry. Five controls
              sharing a 320 px row, with labels in five languages, is the exact shape that
              clipped words in the hero — scripts/validateTileFit.mjs measures both now.
              The `gap`/`padding` juggling this row needed while the buttons were boxes is
              gone with the boxes: flat controls spend their width on words, not on chrome. */}
          <div data-tabfit className="mx-auto flex h-16 max-w-4xl items-center justify-center">
            {canNavigate && (
              <button
                type="button"
                onClick={handleNavigation}
                className="group relative flex h-full max-w-[7rem] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 min-[360px]:px-1"
              >
                <Navigation className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden="true" />
                <span className="text-center text-[9px] tracking-tight min-[360px]:text-[10px] min-[360px]:tracking-normal font-bold leading-tight text-primary-dark">{copy.navigation[language]}</span>
              </button>
            )}
            {jumpTabs.map((tab) => (
              <button
                key={tab.target}
                type="button"
                onClick={() => handleJump(tab.elementId, tab.target)}
                className="group relative flex h-full max-w-[7rem] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 min-[360px]:px-1"
              >
                {tab.icon}
                <span className="text-center text-[9px] tracking-tight min-[360px]:text-[10px] min-[360px]:tracking-normal font-semibold leading-tight text-slate-600">{tab.label}</span>
              </button>
            ))}
            {/* The one control here that is NOT a jump — it opens the upload sheet. Kept last
                (rightmost) so the three shortcuts stay a block and this reads as the odd one
                out, which it is. It fires the existing photo funnel via onAddPhoto (source
                'beach_detail'), so it needs no `beach_jump_clicked`: photo_sheet_opened and
                the rest of that funnel already measure it end to end.

                This is the same offer that came OUT from under the search an hour ago, and the
                move is the point: there it interrupted someone deciding where to go, here it
                sits on the page about a beach they have already been reading about. */}
            {onAddPhoto && (
              <button
                type="button"
                onClick={onAddPhoto}
                className="group relative flex h-full max-w-[7rem] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 min-[360px]:px-1"
              >
                <Camera className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <span className="text-center text-[9px] tracking-tight min-[360px]:text-[10px] min-[360px]:tracking-normal font-semibold leading-tight text-slate-600">{copy.tabPhoto[language]}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * A hairline rule with a word sitting on it. Purely a rhythm device: it separates the
 * three things this page is (today's answer / the beach itself / where else to go)
 * so the reader can skip a whole zone instead of scanning every card in it.
 * Deliberately NOT a heading — see copy.sectionBeach for why the outline stays clean.
 */
const SectionBreak: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 pt-2" aria-hidden="true">
    <span className="text-[11px] font-black tracking-[0.12em] text-slate-600">{label}</span>
    <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
  </div>
);

interface ConditionCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}

const ConditionCard: React.FC<ConditionCardProps> = ({ icon, label, value, subValue }) => (
  <div className="bg-white p-3 rounded-surface border border-line shadow-surface flex flex-col items-start text-left gap-1.5 min-w-0">
    <div className="p-2 bg-slate-50 rounded-control">
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
