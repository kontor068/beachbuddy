import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { openLegalModal } from './LegalFooter';
import { AnalyticsConsent, getAnalyticsConsent, setAnalyticsConsent, trackEvent } from '../services/analyticsService';
import { LanguageCode } from '../types';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';

interface PrivacyConsentBannerProps {
  language: LanguageCode;
}

const copy: Record<LanguageCode, {
  title: string;
  body: string;
  terms: string;
  privacy: string;
  cookies: string;
  essential: string;
  allow: string;
}> = {
  en: {
    title: 'Privacy choices',
    body: 'Analytics are optional. If you reject them, Google Analytics is not loaded. We do not send precise location to analytics or create personal profiles.',
    terms: 'Terms of Use',
    privacy: 'Privacy',
    cookies: 'Cookies',
    essential: 'Essential only',
    allow: 'Allow analytics',
  },
  gr: {
    title: 'Επιλογές απορρήτου',
    body: 'Τα analytics είναι προαιρετικά και αλλάζουν αργότερα από τις Ρυθμίσεις cookies στο footer. Αν τα απορρίψεις, το Google Analytics δεν φορτώνεται. Δεν στέλνουμε ακριβή τοποθεσία ούτε δημιουργούμε προσωπικά προφίλ.',
    terms: 'Όροι Χρήσης',
    privacy: 'Απόρρητο',
    cookies: 'Cookies',
    essential: 'Μόνο απαραίτητα',
    allow: 'Ναι στα analytics',
  },
  fr: {
    title: 'Choix de confidentialité',
    body: "Les analytics sont facultatifs. Si vous les refusez, Google Analytics n'est pas chargé. Nous n'envoyons pas votre position précise et ne créons pas de profils personnels. Favoris et préférences restent dans ce navigateur.",
    terms: 'Terms of Use',
    privacy: 'Privacy',
    cookies: 'Cookies',
    essential: 'Refuser',
    allow: 'Autoriser',
  },
  de: {
    title: 'Datenschutzoptionen',
    body: 'Analytics sind optional. Wenn du ablehnst, wird Google Analytics nicht geladen. Wir senden keinen genauen Standort und erstellen keine persönlichen Profile. Favoriten und Einstellungen bleiben in diesem Browser.',
    terms: 'Terms of Use',
    privacy: 'Privacy',
    cookies: 'Cookies',
    essential: 'Ablehnen',
    allow: 'Erlauben',
  },
  it: {
    title: 'Scelte privacy',
    body: 'Gli analytics sono facoltativi. Se li rifiuti, Google Analytics non viene caricato. Non inviamo la posizione precisa e non creiamo profili personali. Preferiti e preferenze restano in questo browser.',
    terms: 'Terms of Use',
    privacy: 'Privacy',
    cookies: 'Cookies',
    essential: 'Rifiuta',
    allow: 'Consenti',
  },
};

export const PrivacyConsentBanner: React.FC<PrivacyConsentBannerProps> = ({ language }) => {
  const [choice, setChoice] = useState<AnalyticsConsent | null>(() => getAnalyticsConsent());
  if (choice) return null;

  const c = getLocalizedCopy(language, copy);

  const handleChoice = (value: AnalyticsConsent) => {
    setAnalyticsConsent(value);
    if (value === 'accepted') {
      trackEvent('app_loaded', undefined, {
        locale: languageToLocale(language),
        source: 'consent_accept',
      });
    }
    setChoice(value);
  };

  return (
    <div
      className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-lg rounded-xl border border-slate-200/70 bg-white/95 p-3 shadow-xl shadow-slate-900/15 backdrop-blur-xl md:bottom-5 md:p-4"
      role="dialog"
      aria-labelledby="privacy-consent-title"
      aria-describedby="privacy-consent-description"
    >
      <div className="flex gap-2.5 md:gap-3">
        <div className="mt-0.5 hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 min-[380px]:grid">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="privacy-consent-title" className="text-sm font-bold text-slate-900">{c.title}</h2>
          <p id="privacy-consent-description" className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 md:text-xs md:leading-relaxed">{c.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-extrabold text-sky-700">
            <button type="button" onClick={() => openLegalModal('terms')} className="underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              {c.terms}
            </button>
            <button type="button" onClick={() => openLegalModal('privacy')} className="underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              {c.privacy}
            </button>
            <button type="button" onClick={() => openLegalModal('cookies')} className="underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              {c.cookies}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={() => handleChoice('declined')}
              className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:px-4 sm:text-sm"
            >
              {c.essential}
            </button>
            <button
              type="button"
              onClick={() => handleChoice('accepted')}
              className="min-h-11 rounded-xl bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-700 sm:px-4 sm:text-sm"
            >
              {c.allow}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
