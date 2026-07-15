import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { openLegalModal } from './LegalFooter';
import { trackEvent } from '../services/analyticsService';
import {
  applyCookieConsent,
  getCookieConsentState,
  COOKIE_CONSENT_CHANGED_EVENT,
} from '../services/legalConsent';
import { LanguageCode } from '../types';
import { getLocalizedCopy, languageToLocale } from '../utils/i18n';

interface PrivacyConsentBannerProps {
  language: LanguageCode;
}

const copy = {
  en: {
    title: 'Cookie choices',
    body: 'We use essential cookies to run the app. With your consent we also use Google Analytics for anonymous usage stats. Nothing non-essential loads until you choose.',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    reject: 'Reject',
    accept: 'Accept',
    customize: 'Customize',
  },
  gr: {
    title: 'Επιλογές cookies',
    body: 'Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία. Με τη συγκατάθεσή σου χρησιμοποιούμε και Google Analytics για ανώνυμα στατιστικά. Τίποτα μη απαραίτητο δεν φορτώνει πριν επιλέξεις.',
    terms: 'Όροι Χρήσης',
    privacy: 'Πολιτική Απορρήτου',
    cookies: 'Πολιτική Cookies',
    reject: 'Απόρριψη',
    accept: 'Αποδοχή',
    customize: 'Προσαρμογή',
  },
};

export const PrivacyConsentBanner: React.FC<PrivacyConsentBannerProps> = ({ language }) => {
  const [choiceMade, setChoiceMade] = useState<boolean>(() => getCookieConsentState() !== null);

  useEffect(() => {
    const onCookieChanged = () => setChoiceMade(getCookieConsentState() !== null);
    document.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onCookieChanged);
    return () => {
      document.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onCookieChanged);
    };
  }, []);

  // Hide once any cookie choice exists.
  if (choiceMade) return null;

  const c = getLocalizedCopy(language, copy);

  const choose = (analytics: boolean) => {
    applyCookieConsent(
      { necessary: true, analytics },
      { choice: analytics ? 'accept_all' : 'reject_all', language, source: 'banner' },
    );
    if (analytics) {
      trackEvent('app_loaded', undefined, {
        locale: languageToLocale(language),
        source: 'consent_accept',
      });
    }
    setChoiceMade(true);
  };

  const linkClass =
    'underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded';

  return (
    <div
      className="fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-lg rounded-xl border border-slate-200/70 bg-white/95 p-3 shadow-xl shadow-slate-900/15 backdrop-blur-xl md:bottom-5 md:p-4"
      data-nosnippet="true"
      role="dialog"
      aria-labelledby="privacy-consent-title"
      aria-describedby="privacy-consent-description"
    >
      <div className="flex gap-3">
        <div className="mt-0.5 hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 sm:grid">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="privacy-consent-title" className="text-sm font-bold text-slate-900">{c.title}</h2>
          <p id="privacy-consent-description" className="mt-0.5 text-[11px] leading-snug text-slate-600 md:text-xs md:leading-relaxed">
            {c.body}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-extrabold text-sky-700">
            <button type="button" onClick={() => openLegalModal('terms')} className={linkClass}>{c.terms}</button>
            <button type="button" onClick={() => openLegalModal('privacy')} className={linkClass}>{c.privacy}</button>
            <button type="button" onClick={() => openLegalModal('cookies')} className={linkClass}>{c.cookies}</button>
          </div>

          {/* Reject and Accept are the SAME size and both first-level (no hidden
              second step), which keeps the choice free and GDPR-defensible. Accept
              carries the primary visual weight (filled) so genuine opt-in isn't
              suppressed by a fully-neutral pair — Reject stays a clear, real button. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => choose(false)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {c.reject}
            </button>
            <button
              type="button"
              onClick={() => choose(true)}
              className="min-h-11 rounded-xl border border-transparent bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            >
              {c.accept}
            </button>
          </div>
          <button
            type="button"
            onClick={() => openLegalModal('cookieSettings')}
            className="mt-2 w-full text-center text-xs font-bold text-sky-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {c.customize}
          </button>
        </div>
      </div>
    </div>
  );
};
