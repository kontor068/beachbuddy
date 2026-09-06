import React, { useEffect, useState } from 'react';
import { Compass, Cookie, FileText, Flag, LifeBuoy, Mail, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { LanguageCode } from '../types';
import { getGuidesHubLink } from '../utils/beachGuides';
import { getLocalizedCopy } from '../utils/i18n';
import { trackEvent } from '../services/analyticsService';
import { loadLegalDoc, legalLastUpdated, LEGAL_OPERATOR, LegalDoc, LegalKind } from '../utils/legalContent';
import { changelogShort, formatChangelogDate, latestChangelogEntry } from './landing/changelog';
import { athensDayKey } from '../utils/athensTime';
import { buildReportProblemMailto, currentPagePath } from '../utils/reportProblem';
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
      'CalmBeach is an informational beach guide. Always check local conditions, warning flags, lifeguards, and official advice before swimming.',
    legalLinks: 'Legal',
    manageCookies: 'Manage cookies',
    contact: 'Contact',
    dataProtection: 'Data protection',
    tagline: 'Discover the best beach for today.',
    guides: 'Beach guides',
    reportProblem: 'Something wrong here?',
    reportProblemSubject: 'Wrong data on CalmBeach',
    latestWork: 'Latest improvement',
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
      'Το CalmBeach είναι οδηγός πληροφόρησης. Πριν κολυμπήσεις, έλεγχε πάντα τις τοπικές συνθήκες, σημαίες, ναυαγοσώστες και επίσημες οδηγίες.',
    legalLinks: 'Νομικά',
    manageCookies: 'Διαχείριση cookies',
    contact: 'Επικοινωνία',
    dataProtection: 'Προσωπικά δεδομένα',
    tagline: 'Βρες την ιδανική σου παραλία στην Ελλάδα σήμερα',
    guides: 'Οδηγοί παραλιών',
    reportProblem: 'Κάτι δεν πάει καλά εδώ;',
    reportProblemSubject: 'Λάθος στοιχείο στο CalmBeach',
    latestWork: 'Τελευταία βελτίωση',
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
  const latestWork = latestChangelogEntry();
  const latestWorkToday = athensDayKey();
  // Built at render, not at module load: the SPA changes pathname without remounting the
  // footer, so a value captured once would name whichever page happened to load first.
  const reportProblemHref = buildReportProblemMailto(c.reportProblemSubject, currentPagePath());

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
  // The document bodies live in their own chunk and arrive on the first click (see
  // utils/legalContent.ts). The shell opens at once under the footer's own label; the full
  // title and the text follow when the chunk lands. `loaded` remembers which document it
  // holds so switching Terms → Privacy never shows the old text under the new heading.
  const [loaded, setLoaded] = useState<{ kind: LegalKind; doc: LegalDoc } | null>(null);
  useEffect(() => {
    if (!activeModal || activeModal === 'cookieSettings') return;
    const kind = activeModal;
    let cancelled = false;
    loadLegalDoc(kind, language)
      .then(doc => { if (!cancelled) setLoaded({ kind, doc }); })
      .catch(() => { /* offline before the chunk was ever cached: the shell stays, the text waits for the next open */ });
    return () => { cancelled = true; };
  }, [activeModal, language]);
  const doc = activeModal && activeModal !== 'cookieSettings' && loaded?.kind === activeModal ? loaded.doc : null;
  const modalTitle = activeModal === 'cookieSettings'
    ? c.cookieSettings
    : activeModal ? (doc?.title ?? c[activeModal]) : undefined;
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
        {/* Tightened 10/08/2026 (Miltos: «πιο συμμαζεμένο, πιο σωστά στοιχισμένο, μικρότερο
            ύψος»). The vertical padding and the inter-column gap were both sized for the
            three-band fine print that no longer exists; `items-start` stops the short Contact
            and Legal columns from stretching to the tall brand column's height. */}
        <div className="mx-auto max-w-6xl px-5 py-7 md:px-8 md:py-6">
          <div className="grid items-start gap-7 text-center md:grid-cols-[1.6fr_1fr_1fr] md:gap-8 md:text-left">

            {/* Brand + tagline + safety note */}
            <div>
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <img src="/calmbeach-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" />
                <span className="font-heading text-base font-extrabold tracking-tight text-slate-900">CalmBeach</span>
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
              <p className="mt-3 flex items-start justify-center gap-2 text-xs leading-snug text-slate-500 md:justify-start">
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-teal-600/80" aria-hidden="true" />
                <span className="max-w-sm">{c.footerNote}</span>
              </p>
              {/* «ΓΙΝΕΤΑΙ ΔΟΥΛΕΙΑ» ΣΕ ΚΑΘΕ ΣΕΛΙΔΑ (04/09/2026): το 88% έρχεται από Google κατευθείαν
                  σε σελίδα παραλίας και δεν βλέπει ποτέ τη landing. Μία γραμμή, μικρά γράμματα,
                  η πιο πρόσφατη εγγραφή του ημερολογίου — και σύνδεσμος στο πλήρες, στη landing.
                  Χειρόγραφη εγγραφή, όχι ημερομηνία build: το build τρέχει και για δεδομένα. */}
              <p className="mt-3 text-xs leading-snug text-slate-500">
                <a
                  href="/#changelog"
                  onClick={() => trackEvent('footer_latest_work_clicked', undefined, { locale: language })}
                  className="inline-flex max-w-sm items-start gap-1.5 rounded text-left underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600/80" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-slate-600">{c.latestWork}</span>
                    {' · '}
                    <span className="tabular-nums">{formatChangelogDate(latestWork.date, language, latestWorkToday)}</span>
                    {' · '}
                    {changelogShort(latestWork, language)} →
                  </span>
                </a>
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
                {/*
                 * The beach data is OSM-derived and unverified per field — 483 records carry
                 * confidence:'low' and 334 an access type of 'unknown'. The person standing on
                 * the beach is the only cheap way to find out which ones are wrong, and until
                 * now they had nowhere to say it: the landing form is band 6 of the landing
                 * page, and the two addresses above give no hint that a data correction is
                 * welcome. The footer is the one surface that reaches every page type,
                 * including the ~9.500 prerendered ones (the static twin lives in
                 * prerenderBeachPages.mjs FOOTER_COPY).
                 *
                 * A mailto, not the form: the form lives on the landing page and this link has
                 * to work from a beach page that never mounts it. The path rides in the body so
                 * the report says which page it came from without asking the visitor to explain.
                 */}
                <li>
                  <a href={reportProblemHref} className={contactLinkClass}>
                    <Flag className="h-4 w-4 shrink-0 text-teal-600 transition-colors group-hover:text-teal-700" aria-hidden="true" />
                    <span>{c.reportProblem}</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <nav aria-label={c.legalLinks}>
              <p className={columnHeadingClass}>{c.legalLinks}</p>
              {/* The gap shrinks as the targets grow: each row is now 44 px of tappable box
                  instead of 20 px of text, so the column keeps roughly the height it had. */}
              {/* TWO COLUMNS ON A PHONE. Six links × 44 px of mandatory touch target is 264 px of
                  footer — the single tallest thing on the page's last screen. Pairing them halves
                  that to three rows WITHOUT shrinking a single target: the 44 px rule (measured
                  05/08/2026, when every link here was 19 px) is about the finger, not the layout.
                  Back to one column at `md`, where the three-column grid needs the narrow shape. */}
              <ul className="mt-2 grid grid-cols-2 justify-items-center gap-x-4 md:flex md:flex-col md:justify-items-start md:items-start">
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

          {/* Fine print — ONE band, not three.
              It used to be a justify-between row plus a separate full-width ODbL paragraph
              underneath, and at desktop width that read as three ragged bands: the operator name
              wrapping onto a second line on the left, the credits wrapping independently on the
              right, and a lone licence sentence below them. Now the credits are a single wrapping
              flow that fills the width in reading order and the copyright is the one fixed anchor
              (nowrap — «MARIS AND CO O.E.» is a legal name and must not break across lines).
              `items-baseline` aligns the text, not the boxes, so the two halves sit on one line
              instead of drifting apart. */}
          <div className="mt-5 flex flex-col gap-2 border-t border-slate-200/80 pt-4 text-left text-xs leading-relaxed text-slate-600 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 md:mt-4">
            <p className="shrink-0 sm:whitespace-nowrap">© 2026 CalmBeach · {LEGAL_OPERATOR.legalName}</p>
            {/* LEFT-ALIGNED ON A PHONE, and one single flow.
                Centred fine print looked ragged (Miltos, 10/08): five credits of five different
                lengths, each centred on its own line, gave the block a zig-zag edge on both
                sides. Left alignment buys one straight edge to read down. The `contents` on
                WeatherDataAttribution is the other half of the fix — it is its own flex
                container, so its three credits used to wrap on their own rhythm INSIDE this
                one, and two wrapping systems can never line up. Flattened, every credit is a
                sibling here and they fill each line in order. */}
            <div className="flex flex-wrap items-baseline justify-start gap-x-2.5 gap-y-1 sm:justify-end">
              <WeatherDataAttribution language={language} className="!contents" />
              {/* The «·» is an ::after INSIDE each credit, not a sibling span. As siblings they
                  were wrappable on their own and regularly ended up dangling at the end of a
                  line — or, before the flow was flattened, at the start of one. Inside the item
                  they can only ever sit between two credits, and `last:after:content-none`
                  keeps the final one clean. */}
              <span className="whitespace-nowrap after:ml-2.5 after:text-slate-300 after:content-['·'] last:after:content-none">
                {c.accessData}:{' '}
                <a href="https://www.seatrac.gr/" target="_blank" rel="noopener noreferrer" className={fineLinkClass}>SEATRAC</a>
              </span>
              {/* No separator after this one: the ODbL sentence that follows is long enough to wrap
                  onto its own line at almost every width, which left the dot stranded at the end
                  of the line above. `last:` cannot help — ODbL, not this, is the last child. */}
              <span className="whitespace-nowrap">{c.blueFlag}</span>
              {/* ODbL attribution for the beach dataset — a derivative of OpenStreetMap.
                  It joins the credit flow rather than owning a row: the obligation is that the
                  attribution is PRESENT and legible, not that it sits alone, and a lone row was
                  costing a full line of footer height for one sentence.

                  ⚠️ THIS WAS MISSING FOR EVERY VISITOR WITH JAVASCRIPT until 05/08/2026.
                  The notice existed only in the prerendered HTML (prerenderBeachPages.mjs,
                  `withStaticFooter()`), which React overwrites on mount by design — the static
                  footer is injected INSIDE #root precisely so it does not duplicate. So the audit
                  that reported "ODbL on 9.499/9.502 pages" was reading the build output, not the
                  browser. Keep it in the CLIENT tree, wherever it sits.

                  Separate from WeatherDataAttribution because that covers the FORECAST licences
                  (Open-Meteo CC BY 4.0, DWD, Météo-France); this covers the BEACH DATABASE, a
                  different source under a different licence, and merging them would make one line
                  responsible for two obligations that can change independently. */}
              {/* `basis-full` forces its own line instead of trailing the credits: as a wrapping
                  flex child it would otherwise leave a dangling «·» at the end of the line above
                  whenever it happened to break. Its own line, no separator, no orphan. */}
              <span>
                {c.beachData}: ©{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={fineLinkClass}
                >
                  OpenStreetMap
                </a>{' '}
                {/* «με άδεια ODbL» is kept whole: as loose words the licence name broke onto a
                    line of its own, leaving a two-word orphan under a full-width sentence. */}
                <span className="whitespace-nowrap">
                  {c.beachDataLicence}{' '}
                  <a
                    href="https://opendatacommons.org/licenses/odbl/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={fineLinkClass}
                  >
                    ODbL
                  </a>
                </span>
              </span>
            </div>
          </div>

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
