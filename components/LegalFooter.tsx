import React, { useEffect, useState } from 'react';
import { Cookie, FileText, LifeBuoy, Mail, ShieldCheck, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';
import { getLegalDoc, legalLastUpdated, LEGAL_OPERATOR, LegalKind } from '../utils/legalContent';
import { LegalDocument } from './LegalDocument';
import { CookieSettings } from './CookieSettings';

export type LegalModal = LegalKind;

export const openLegalModal = (modal: LegalModal) => {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent<LegalModal>('calmbeach:openLegalModal', { detail: modal }));
};

interface LegalFooterProps {
  language: LanguageCode;
}

const copy = {
  en: {
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    cookies: 'Cookie Policy',
    cookieSettings: 'Cookie settings',
    faq: 'FAQ',
    close: 'Close',
    weatherData: 'Weather/marine data',
    footerNote:
      'Calm Beach is an informational beach guide. Always check local conditions, warning flags, lifeguards, and official advice before swimming.',
    legalLinks: 'Legal',
    manageCookies: 'Manage cookies',
    contact: 'Contact',
    dataProtection: 'Data protection',
    tagline: 'Discover the best beach for today.',
  },
  gr: {
    terms: 'Όροι Χρήσης',
    privacy: 'Πολιτική Απορρήτου',
    cookies: 'Πολιτική Cookies',
    cookieSettings: 'Ρυθμίσεις Cookies',
    faq: 'Συχνές ερωτήσεις',
    close: 'Κλείσιμο',
    weatherData: 'Καιρός/θάλασσα',
    footerNote:
      'Το Calm Beach είναι οδηγός πληροφόρησης. Πριν κολυμπήσεις, έλεγχε πάντα τις τοπικές συνθήκες, σημαίες, ναυαγοσώστες και επίσημες οδηγίες.',
    legalLinks: 'Νομικά',
    manageCookies: 'Διαχείριση cookies',
    contact: 'Επικοινωνία',
    dataProtection: 'Προσωπικά δεδομένα',
    tagline: 'Βρες την καλύτερη παραλία για σήμερα.',
  },
};

const modalMeta: Record<LegalModal, { icon: typeof FileText }> = {
  terms: { icon: FileText },
  privacy: { icon: ShieldCheck },
  cookies: { icon: Cookie },
};

export const LegalFooter: React.FC<LegalFooterProps> = ({ language }) => {
  const [activeModal, setActiveModal] = useState<LegalModal | null>(null);
  const c = getLocalizedCopy(language, copy);

  useEffect(() => {
    const handleOpenLegalModal = (event: Event) => {
      const modalName = (event as CustomEvent<LegalModal>).detail;
      if (modalName && modalName in modalMeta) {
        setActiveModal(modalName);
      }
    };
    document.addEventListener('calmbeach:openLegalModal', handleOpenLegalModal);
    return () => document.removeEventListener('calmbeach:openLegalModal', handleOpenLegalModal);
  }, []);

  const doc = activeModal ? getLegalDoc(activeModal, language) : null;
  const ModalIcon = activeModal ? modalMeta[activeModal].icon : null;

  // The FAQ is a prerendered static page (built by scripts/prerenderBeachPages.mjs), so it
  // exists in production and in the bundled native app but NOT under `vite dev`/`preview`,
  // where a relative /faq/ falls back to the SPA shell. In dev, open the live page instead so
  // the link always works; prod/native keep the relative path (works offline in the app).
  const faqPath = language === 'gr' ? '/el/faq/' : '/faq/';
  const faqExternal = import.meta.env.DEV;
  const faqHref = faqExternal ? `https://calmbeach.gr${faqPath}` : faqPath;

  const contactLinkClass =
    'group inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded';
  const legalLinkClass =
    'cursor-pointer text-sm font-medium text-slate-600 transition-colors hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded';
  const columnHeadingClass = 'text-xs font-bold uppercase tracking-wider text-slate-500';
  const address = language === 'gr' ? LEGAL_OPERATOR.addressGr : LEGAL_OPERATOR.addressEn;

  return (
    <>
      <footer className="w-full border-t border-slate-200 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <div className="grid gap-9 text-center md:grid-cols-[1.6fr_1fr_1fr] md:gap-12 md:text-left">

            {/* Brand + tagline + safety note */}
            <div>
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <img src="/calmbeach-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" />
                <span className="font-heading text-base font-extrabold tracking-tight text-slate-900">Calm Beach</span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-600">{c.tagline}</p>
              <p className="mt-4 flex items-start justify-center gap-2 text-xs leading-relaxed text-slate-500 md:justify-start">
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-teal-600/80" aria-hidden="true" />
                <span className="max-w-xs">{c.footerNote}</span>
              </p>
            </div>

            {/* Contact */}
            <div>
              <p className={columnHeadingClass}>{c.contact}</p>
              <ul className="mt-4 flex flex-col items-center gap-3 md:items-start">
                <li>
                  <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className={contactLinkClass}>
                    <Mail className="h-4 w-4 shrink-0 text-teal-600 transition-colors group-hover:text-teal-700" aria-hidden="true" />
                    <span>{LEGAL_OPERATOR.contactEmail}</span>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${LEGAL_OPERATOR.privacyEmail}`} className={`${contactLinkClass} items-start`}>
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 transition-colors group-hover:text-teal-700" aria-hidden="true" />
                    <span className="flex flex-col leading-tight">
                      <span>{LEGAL_OPERATOR.privacyEmail}</span>
                      <span className="text-[11px] font-normal text-slate-500">{c.dataProtection}</span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <nav aria-label={c.legalLinks}>
              <p className={columnHeadingClass}>{c.legalLinks}</p>
              <ul className="mt-4 flex flex-col items-center gap-2.5 md:items-start">
                <li><button type="button" onClick={() => setActiveModal('terms')} className={legalLinkClass}>{c.terms}</button></li>
                <li><button type="button" onClick={() => setActiveModal('privacy')} className={legalLinkClass}>{c.privacy}</button></li>
                <li><button type="button" onClick={() => setActiveModal('cookies')} className={legalLinkClass}>{c.cookies}</button></li>
                <li><button type="button" onClick={() => setActiveModal('cookies')} className={legalLinkClass}>{c.cookieSettings}</button></li>
                <li>
                  <a href={faqHref} className={legalLinkClass} target={faqExternal ? '_blank' : undefined} rel={faqExternal ? 'noopener noreferrer' : undefined}>
                    {c.faq}
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Fine print */}
          <div className="mt-10 flex flex-col items-center gap-3 border-t border-slate-200/80 pt-6 text-center text-xs text-slate-500 sm:flex-row sm:justify-between sm:text-left">
            <p>© 2026 Calm Beach Greece · {LEGAL_OPERATOR.legalName} · {address}</p>
            <p className="flex items-center gap-1.5">
              <span>{c.weatherData}:</span>
              <a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-teal-700 hover:underline">Open-Meteo</a>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <a href="https://www.dwd.de/EN/ourservices/opendata/opendata.html" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-teal-700 hover:underline">DWD</a>
            </p>
          </div>
        </div>
      </footer>

      {activeModal && doc && ModalIcon && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <ModalIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="legal-modal-title" className="font-heading text-lg font-extrabold leading-tight text-slate-950">
                  {doc.title}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{legalLastUpdated(language)}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label={c.close}
                title={c.close}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(85vh-5rem)] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {activeModal === 'cookies' && (
                <CookieSettings language={language} source="footer_cookies_modal" />
              )}

              {activeModal === 'privacy' && (
                <button
                  type="button"
                  onClick={() => setActiveModal('cookies')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-sky-700 transition hover:bg-slate-100"
                >
                  {c.manageCookies} →
                </button>
              )}

              <LegalDocument doc={doc} language={language} onOpenModal={setActiveModal} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
