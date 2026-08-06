import React, { useEffect, useState } from 'react';
import { Compass, Cookie, FileText, LifeBuoy, Mail, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getGuidesHubLink } from '../utils/beachGuides';
import { getLocalizedCopy } from '../utils/i18n';
import { getLegalDoc, legalLastUpdated, LEGAL_OPERATOR, LegalKind } from '../utils/legalContent';
import { LegalDocument } from './LegalDocument';
import { CookieSettings } from './CookieSettings';
import { WeatherDataAttribution } from './WeatherDataAttribution';

export type LegalModal = LegalKind;
// A modal "view" is either a legal document OR the interactive cookie-settings tool.
export type LegalModalView = LegalKind | 'cookieSettings';

export const openLegalModal = (modal: LegalModalView) => {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent<LegalModalView>('calmbeach:openLegalModal', { detail: modal }));
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
    method: 'How we measure shelter',
    close: 'Close',
    accessData: 'Accessibility',
    blueFlag: 'Blue Flag 2026',
    beachData: 'Beach data',
    beachDataLicence: 'contributors, under the',
    footerNote:
      'Calm Beach is an informational beach guide. Always check local conditions, warning flags, lifeguards, and official advice before swimming.',
    legalLinks: 'Legal',
    manageCookies: 'Manage cookies',
    contact: 'Contact',
    dataProtection: 'Data protection',
    tagline: 'Discover the best beach for today.',
    guides: 'Beach guides',
  },
  gr: {
    terms: 'Όροι Χρήσης',
    privacy: 'Πολιτική Απορρήτου',
    cookies: 'Πολιτική Cookies',
    cookieSettings: 'Ρυθμίσεις Cookies',
    faq: 'Συχνές ερωτήσεις',
    method: 'Πώς μετράμε την προστασία',
    close: 'Κλείσιμο',
    accessData: 'Πρόσβαση ΑμεΑ',
    blueFlag: 'Γαλάζιες Σημαίες 2026',
    beachData: 'Δεδομένα παραλιών',
    beachDataLicence: 'συνεισφέροντες, με άδεια',
    footerNote:
      'Το Calm Beach είναι οδηγός πληροφόρησης. Πριν κολυμπήσεις, έλεγχε πάντα τις τοπικές συνθήκες, σημαίες, ναυαγοσώστες και επίσημες οδηγίες.',
    legalLinks: 'Νομικά',
    manageCookies: 'Διαχείριση cookies',
    contact: 'Επικοινωνία',
    dataProtection: 'Προσωπικά δεδομένα',
    tagline: 'Βρες την ιδανική σου παραλία στην Ελλάδα σήμερα',
    guides: 'Οδηγοί παραλιών',
  },
};

const modalMeta: Record<LegalModal, { icon: typeof FileText }> = {
  terms: { icon: FileText },
  privacy: { icon: ShieldCheck },
  cookies: { icon: Cookie },
};

export const LegalFooter: React.FC<LegalFooterProps> = ({ language }) => {
  const [activeModal, setActiveModal] = useState<LegalModalView | null>(null);
  const c = getLocalizedCopy(language, copy);

  useEffect(() => {
    const validViews: LegalModalView[] = ['terms', 'privacy', 'cookies', 'cookieSettings'];
    const handleOpenLegalModal = (event: Event) => {
      const modalName = (event as CustomEvent<LegalModalView>).detail;
      if (modalName && validViews.includes(modalName)) {
        setActiveModal(modalName);
      }
    };
    document.addEventListener('calmbeach:openLegalModal', handleOpenLegalModal);
    return () => document.removeEventListener('calmbeach:openLegalModal', handleOpenLegalModal);
  }, []);

  // 'cookieSettings' is the interactive consent tool (no legal document); the rest render text.
  const doc = activeModal && activeModal !== 'cookieSettings' ? getLegalDoc(activeModal, language) : null;
  const modalTitle = activeModal === 'cookieSettings' ? c.cookieSettings : doc?.title;
  const ModalIcon = activeModal === 'cookieSettings'
    ? SlidersHorizontal
    : activeModal ? modalMeta[activeModal].icon : null;

  // The FAQ is a prerendered static page (built by scripts/prerenderBeachPages.mjs), so it
  // exists in production and in the bundled native app but NOT under `vite dev`/`preview`,
  // where a relative /faq/ falls back to the SPA shell. In dev, open the live page instead so
  // the link always works; prod/native keep the relative path (works offline in the app).
  const faqPath = language === 'gr' ? '/el/faq/' : '/faq/';
  const faqExternal = import.meta.env.DEV;
  const faqHref = faqExternal ? `https://calmbeach.gr${faqPath}` : faqPath;
  /* The methodology page ("how we measure wind shelter") is the same kind of prerendered
     page as the FAQ and needs the same dev/prod treatment. It shipped on 06/08/2026 linked
     ONLY from the prerendered footer — which React replaces on mount — so for every visitor
     with JavaScript it existed and was unreachable. That is exactly the failure the ODbL
     comment below records from 05/08: a link that satisfies the crawler is not a link a
     person can click. Prerendered footer and this one must be changed together.
     de/fr/it fall back to the English page, like the FAQ. */
  const methodPath = language === 'gr' ? '/el/how-we-measure-wind-shelter/' : '/how-we-measure-wind-shelter/';
  const methodHref = faqExternal ? `https://calmbeach.gr${methodPath}` : methodPath;
  // Same story for the guides hub (and it falls back to the English hub for
  // de/fr/it, where no localized hub is emitted).
  const { href: guidesHref, external: guidesExternal } = getGuidesHubLink(language);

  /* `min-h-[44px]` is not decoration: measured on a real phone 05/08/2026, every link in this
     footer was 19-20 px tall — under half the 44 px both Apple and Google give as the minimum
     touch target, and these are the links a user reaches for when they are annoyed (privacy,
     cookie settings, terms). The height is bought with flex centring rather than padding so
     the visual rhythm of the column is unchanged; only the tappable box grows. Standalone
     links only — the attribution links below stay inline inside their sentence, which is the
     case WCAG 2.5.8 explicitly exempts, and padding them would break the paragraph.

     From `md:` up the target drops to 32 px: that breakpoint is a pointing device, where the
     44 px finger rule does not apply and five stacked 44 px rows made the footer eat a third
     of the viewport. 32 px still clears the 24 px WCAG 2.5.8 minimum with room to spare. */
  const contactLinkClass =
    'group inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded md:min-h-[32px]';
  const legalLinkClass =
    'inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-slate-600 transition-colors hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded md:min-h-[30px]';
  const columnHeadingClass = 'text-xs font-bold uppercase tracking-wider text-slate-500';
  // Attribution links live in the muted fine print, so they carry the same weight as the
  // text around them — a licence credit that shouts is a worse credit.
  const fineLinkClass =
    'font-semibold text-slate-500 underline-offset-4 transition-colors hover:text-teal-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded';

  return (
    <>
      <footer className="w-full border-t border-slate-200 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-7">
          <div className="grid gap-9 text-center md:grid-cols-[1.6fr_1fr_1fr] md:gap-8 md:text-left">

            {/* Brand + tagline + safety note */}
            <div>
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <img src="/calmbeach-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" />
                <span className="font-heading text-base font-extrabold tracking-tight text-slate-900">Calm Beach</span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-600">{c.tagline}</p>
              <a
                href={guidesHref}
                target={guidesExternal ? '_blank' : undefined}
                rel={guidesExternal ? 'noopener noreferrer' : undefined}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-sm font-bold text-teal-700 transition-colors hover:border-teal-300 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
                {c.guides} →
              </a>
              <p className="mt-4 flex items-start justify-center gap-2 text-xs leading-relaxed text-slate-500 md:justify-start">
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-teal-600/80" aria-hidden="true" />
                <span className="max-w-xs">{c.footerNote}</span>
              </p>
            </div>

            {/* Contact */}
            <div>
              <p className={columnHeadingClass}>{c.contact}</p>
              <ul className="mt-2 flex flex-col items-center md:items-start">
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
              {/* The gap shrinks as the targets grow: each row is now 44 px of tappable box
                  instead of 20 px of text, so the column keeps roughly the height it had. */}
              <ul className="mt-2 flex flex-col items-center md:items-start">
                <li><button type="button" onClick={() => setActiveModal('terms')} className={legalLinkClass}>{c.terms}</button></li>
                <li><button type="button" onClick={() => setActiveModal('privacy')} className={legalLinkClass}>{c.privacy}</button></li>
                <li><button type="button" onClick={() => setActiveModal('cookies')} className={legalLinkClass}>{c.cookies}</button></li>
                <li><button type="button" onClick={() => setActiveModal('cookieSettings')} className={legalLinkClass}>{c.cookieSettings}</button></li>
                <li>
                  <a href={faqHref} className={legalLinkClass} target={faqExternal ? '_blank' : undefined} rel={faqExternal ? 'noopener noreferrer' : undefined}>
                    {c.faq}
                  </a>
                </li>
                <li>
                  <a href={methodHref} className={legalLinkClass} target={faqExternal ? '_blank' : undefined} rel={faqExternal ? 'noopener noreferrer' : undefined}>
                    {c.method}
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Fine print */}
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-200/80 pt-5 text-center text-xs text-slate-600 sm:flex-row sm:justify-between sm:text-left md:mt-5 md:pt-4">
            <p>© 2026 Calm Beach · {LEGAL_OPERATOR.legalName}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:justify-end">
              <WeatherDataAttribution language={language} />
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <span>{c.accessData}:</span>
                <a href="https://www.seatrac.gr/" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-teal-700 hover:underline">SEATRAC</a>
              </span>
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">·</span>
              <span>{c.blueFlag}</span>
            </div>
          </div>

          {/* ODbL attribution for the beach dataset — a derivative of OpenStreetMap.
              Its own row, because it is a licence obligation rather than a credit we
              choose to give, and the row above is already three items wide.

              ⚠️ THIS WAS MISSING FOR EVERY VISITOR WITH JAVASCRIPT until 05/08/2026.
              The notice existed only in the prerendered HTML (prerenderBeachPages.mjs,
              `withStaticFooter()`), which React overwrites on mount by design — the
              static footer is injected INSIDE #root precisely so it does not duplicate.
              So the audit that reported "ODbL on 9.499/9.502 pages" was reading the
              build output, not the browser. In the client bundle the words
              OpenStreetMap/ODbL appeared only in BeachMap (tile credit) and
              BeachDetailPage — neither of which the landing page renders, leaving the
              home page with no attribution at all.

              Placed here rather than in WeatherDataAttribution because that component
              covers the FORECAST licences (Open-Meteo CC BY 4.0, DWD, Météo-France);
              this covers the BEACH DATABASE, a different source with a different
              licence, and merging them would make one line responsible for two
              obligations that can change independently. */}
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-600 sm:text-left">
            {c.beachData}: ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className={fineLinkClass}
            >
              OpenStreetMap
            </a>{' '}
            {c.beachDataLicence}{' '}
            <a
              href="https://opendatacommons.org/licenses/odbl/"
              target="_blank"
              rel="noopener noreferrer"
              className={fineLinkClass}
            >
              Open Database License (ODbL)
            </a>
          </p>
        </div>
      </footer>

      {activeModal && modalTitle && ModalIcon && (
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
                  {modalTitle}
                </h2>
                {activeModal !== 'cookieSettings' && (
                  <p className="mt-1 text-xs font-semibold text-slate-500">{legalLastUpdated(language)}</p>
                )}
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
              {activeModal === 'cookieSettings' && (
                <>
                  <CookieSettings language={language} source="footer_cookie_settings" />
                  <button
                    type="button"
                    onClick={() => setActiveModal('cookies')}
                    className="text-sm font-bold text-sky-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {c.cookies} →
                  </button>
                </>
              )}

              {(activeModal === 'cookies' || activeModal === 'privacy') && (
                <button
                  type="button"
                  onClick={() => setActiveModal('cookieSettings')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-bold text-sky-700 transition hover:bg-slate-100"
                >
                  {c.cookieSettings} →
                </button>
              )}

              {doc && <LegalDocument doc={doc} language={language} onOpenModal={setActiveModal} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
