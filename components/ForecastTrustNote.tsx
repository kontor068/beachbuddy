import React, { useState } from 'react';
import { ShieldCheck, Info, ChevronDown, Satellite, MapPin } from 'lucide-react';
import { LanguageCode, WeatherSource, ForecastConfidence } from '../types';

/**
 * Forecast trust / provenance note (Tier-1 "now": timestamped, source-named verdict
 * + receipts panel, merged). Surfaces, in plain language, WHAT the per-beach verdict
 * is built on — a beach-specific cluster forecast vs an island-level estimate — plus
 * our confidence and, honestly, what we could not verify. This is the transparency
 * layer Google's sourceless AI summaries structurally cannot offer for a swim-safety
 * decision. All inputs are already computed by calculateBeachScore; nothing new is
 * fetched. It extends the existing "Εκτίμηση χάρτη" honesty discipline into text.
 */

type Copy = Record<LanguageCode, string>;

const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const SOURCE_LABEL: Record<WeatherSource, Copy> = {
  'beach-cluster': {
    en: 'Per-beach forecast',
    gr: 'Πρόγνωση ανά παραλία',
    de: 'Strandgenaue Vorhersage',
    it: 'Previsione per spiaggia',
    fr: 'Prévision par plage',
  },
  'island-fallback': {
    en: 'Island-level estimate',
    gr: 'Εκτίμηση επιπέδου νησιού',
    de: 'Inselweite Schätzung',
    it: "Stima a livello d'isola",
    fr: "Estimation à l'échelle de l'île",
  },
};

const SOURCE_EXPLANATION: Record<WeatherSource, Copy> = {
  'beach-cluster': {
    en: 'Built from a forecast point close to this beach, then adjusted for how this exact cove faces the wind.',
    gr: 'Στηρίζεται σε σημείο πρόγνωσης κοντά στην παραλία και προσαρμόζεται στο πώς αυτός ο κόλπος δέχεται τον άνεμο.',
    de: 'Basiert auf einem Vorhersagepunkt nahe diesem Strand und wird an die Windlage dieser Bucht angepasst.',
    it: 'Si basa su un punto di previsione vicino alla spiaggia, adattato a come questa insenatura riceve il vento.',
    fr: 'Basé sur un point de prévision proche de la plage, ajusté à la façon dont cette crique reçoit le vent.',
  },
  'island-fallback': {
    en: "Uses the island's general forecast — we don't yet have a forecast point right at this beach, so treat it as an estimate.",
    gr: 'Χρησιμοποιεί τη γενική πρόγνωση του νησιού — δεν έχουμε ακόμη σημείο πρόγνωσης πάνω στην παραλία, οπότε είναι εκτίμηση.',
    de: 'Nutzt die allgemeine Inselvorhersage — noch ohne Vorhersagepunkt direkt am Strand, daher eine Schätzung.',
    it: "Usa la previsione generale dell'isola — non abbiamo ancora un punto proprio su questa spiaggia, quindi è una stima.",
    fr: "Utilise la prévision générale de l'île — sans point de prévision sur la plage même, c'est donc une estimation.",
  },
};

const CONFIDENCE_LABEL: Record<ForecastConfidence, Copy> = {
  high: {
    en: 'High confidence',
    gr: 'Υψηλή αξιοπιστία',
    de: 'Hohe Zuverlässigkeit',
    it: 'Alta affidabilità',
    fr: 'Fiabilité élevée',
  },
  medium: {
    en: 'Moderate confidence',
    gr: 'Μέτρια αξιοπιστία',
    de: 'Mittlere Zuverlässigkeit',
    it: 'Affidabilità media',
    fr: 'Fiabilité moyenne',
  },
  low: {
    en: 'Limited data',
    gr: 'Περιορισμένα δεδομένα',
    de: 'Begrenzte Daten',
    it: 'Dati limitati',
    fr: 'Données limitées',
  },
};

/** Localised copy for the internal confidence-reason codes from windExposureEngine. */
const REASON_COPY: Record<string, Copy> = {
  'local wind exposure profile missing': {
    en: 'No local wind-exposure profile for this beach yet',
    gr: 'Δεν υπάρχει ακόμη τοπικό προφίλ έκθεσης στον άνεμο για την παραλία',
    de: 'Noch kein lokales Wind-Expositionsprofil für diesen Strand',
    it: 'Nessun profilo locale di esposizione al vento per questa spiaggia',
    fr: "Pas encore de profil local d'exposition au vent pour cette plage",
  },
  'wind exposure profile needs verification': {
    en: 'Wind-exposure profile not yet verified',
    gr: 'Το προφίλ έκθεσης στον άνεμο δεν έχει επαληθευτεί',
    de: 'Wind-Expositionsprofil noch nicht verifiziert',
    it: "Profilo di esposizione al vento non ancora verificato",
    fr: "Profil d'exposition au vent non encore vérifié",
  },
  'shelter level unknown': {
    en: 'Shelter from the wind is unknown here',
    gr: 'Άγνωστος βαθμός προστασίας από τον άνεμο',
    de: 'Windschutz hier unbekannt',
    it: 'Riparo dal vento sconosciuto',
    fr: "Abri contre le vent inconnu",
  },
  'fetch exposure unknown': {
    en: 'Exposure to the open sea is unknown',
    gr: 'Άγνωστη έκθεση σε ανοιχτή θάλασσα',
    de: 'Exposition zum offenen Meer unbekannt',
    it: "Esposizione al mare aperto sconosciuta",
    fr: "Exposition à la pleine mer inconnue",
  },
  'beach facing direction not verified': {
    en: 'Beach orientation not verified',
    gr: 'Ο προσανατολισμός της ακτής δεν έχει επαληθευτεί',
    de: 'Ausrichtung des Strandes nicht verifiziert',
    it: "Orientamento della spiaggia non verificato",
    fr: "Orientation de la plage non vérifiée",
  },
  'marine wave data missing': {
    en: 'No measured wave data — using a wind/fetch estimate',
    gr: 'Λείπουν μετρήσεις κύματος — εκτίμηση από άνεμο/fetch',
    de: 'Keine gemessenen Wellendaten — Schätzung aus Wind/Fetch',
    it: 'Nessun dato d’onda misurato — stima da vento/fetch',
    fr: "Pas de données de vagues mesurées — estimation vent/fetch",
  },
};

const HEADINGS = {
  toggle: {
    en: 'How we know',
    gr: 'Πώς το υπολογίζουμε',
    de: 'Woher wir das wissen',
    it: 'Come lo sappiamo',
    fr: 'Comment on le sait',
  } as Copy,
  notVerified: {
    en: "What we couldn't verify",
    gr: 'Τι δεν επιβεβαιώσαμε',
    de: 'Was wir nicht bestätigen konnten',
    it: 'Cosa non abbiamo verificato',
    fr: "Ce que nous n'avons pas pu vérifier",
  } as Copy,
  disclaimer: {
    en: 'Conditions are a model estimate of nature, not an on-the-spot measurement.',
    gr: 'Οι συνθήκες είναι εκτίμηση μοντέλου, όχι μέτρηση επί τόπου.',
    de: 'Bedingungen sind eine Modellschätzung, keine Messung vor Ort.',
    it: 'Le condizioni sono una stima del modello, non una misura sul posto.',
    fr: "Les conditions sont une estimation du modèle, pas une mesure sur place.",
  } as Copy,
};

const CONFIDENCE_TONE: Record<ForecastConfidence, string> = {
  high: 'text-emerald-700',
  medium: 'text-amber-700',
  low: 'text-orange-700',
};

interface ForecastTrustNoteProps {
  language: LanguageCode;
  weatherSource: WeatherSource;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  className?: string;
}

export const ForecastTrustNote: React.FC<ForecastTrustNoteProps> = ({
  language,
  weatherSource,
  forecastConfidence,
  confidenceReasons,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  const sourceLabel = pick(SOURCE_LABEL[weatherSource], language);
  const confidence: ForecastConfidence = forecastConfidence ?? 'medium';
  const confidenceLabel = pick(CONFIDENCE_LABEL[confidence], language);
  const reasons = (confidenceReasons ?? []).filter(Boolean);
  const SourceIcon = weatherSource === 'beach-cluster' ? MapPin : Satellite;

  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left"
      >
        <SourceIcon className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-600">{sourceLabel}</span>
        <span className="text-slate-300" aria-hidden="true">·</span>
        <ShieldCheck className={`h-3.5 w-3.5 flex-shrink-0 ${CONFIDENCE_TONE[confidence]}`} />
        <span className={`text-[11px] font-semibold ${CONFIDENCE_TONE[confidence]}`}>{confidenceLabel}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-cyan-700">
          {pick(HEADINGS.toggle, language)}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <span>{pick(SOURCE_EXPLANATION[weatherSource], language)}</span>
          </p>

          {reasons.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {pick(HEADINGS.notVerified, language)}
              </p>
              <ul className="mt-1 space-y-1">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-600">
                    <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                    <span>{REASON_COPY[reason] ? pick(REASON_COPY[reason], language) : reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] italic leading-relaxed text-slate-500">
            {pick(HEADINGS.disclaimer, language)}
          </p>
        </div>
      )}
    </div>
  );
};
