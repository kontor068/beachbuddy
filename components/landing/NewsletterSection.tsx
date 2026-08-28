import React, { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Mail, Send } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { canTrackAnalytics, subscribeToNewsletter, trackEvent } from '../../services/analyticsService';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../services/legalConsent';
import { LEGAL_OPERATOR } from '../../utils/legalContent';
import { landingCopy } from './landingCopy';

// The only reason a visitor ever comes back on purpose.
//
// Everything above this point answers today's question and then lets the person
// leave. A beach service is used a handful of times a year, so there is no habit
// to fall back on: without a list, every single visit has to be re-earned from
// Google. That is the whole argument for this block, and it is why it exists
// despite the page already asking for two things (a photo, a correction).
//
// PLACED LAST, after the letter. It is the third ask on the page and by far the
// smallest, so it goes where the reading is already finished — a "before you
// go" line rather than something standing between the visitor and the product.
//
// DELIBERATELY NOT A MODAL, and never a timed pop-up. The site's whole
// positioning is that it does not play those games; an exit-intent overlay would
// undo more trust than a list is worth.
//
// The success message is identical for a new subscriber and for an address
// already on the list — see subscribeToNewsletter. Telling the visitor "you are
// already subscribed" turns the form into an oracle for whether any address is
// on it.

interface NewsletterSectionProps {
  language: LanguageCode;
}

type SendState = 'idle' | 'sending' | 'sent' | 'invalid' | 'error';

// Mirrors the server's deliberately permissive rule (netlify/functions/
// newsletter-subscribe.mjs): catch the typo, never argue with a real address.
// The server validates again — this copy only exists so an obvious slip is
// caught without a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

export const NewsletterSection: React.FC<NewsletterSectionProps> = ({ language }) => {
  const c = getLocalizedCopy(language, landingCopy).newsletter;
  const mailHref = `mailto:${LEGAL_OPERATOR.contactEmail}`;

  const [email, setEmail] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [state, setState] = useState<SendState>('idle');

  // Same consent-aware pattern as the rest of the landing: a first-time visitor
  // meets the cookie banner and this page at the same moment, so a plain
  // fire-once effect is swallowed by the gate for exactly the people we need to
  // count. This section sits at the very bottom of a long page, so its view
  // count is the denominator that says whether anyone gets here at all.
  const sectionRef = useRef<HTMLElement>(null);
  const sentRef = useRef(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    let inView = false;

    const flush = () => {
      if (sentRef.current || !inView || !canTrackAnalytics()) return;
      sentRef.current = true;
      trackEvent('landing_newsletter_viewed', undefined, { locale: language });
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        inView = true;
        observer.unobserve(entry.target);
      });
      flush();
    }, { threshold: 0.4 });

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (typeof document === 'undefined') return () => observer.disconnect();

    document.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, flush);
    return () => {
      observer.disconnect();
      document.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, flush);
    };
  }, [language]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'sending') return;

    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setState('invalid');
      return;
    }

    setState('sending');
    const result = await subscribeToNewsletter({ email: value, language, source: 'landing', company });
    if (result.ok) {
      setState('sent');
      setEmail('');
      // `already` is recorded because the two are different events for us even
      // though the visitor sees one message: a high repeat rate means the form
      // is being found twice by the same people, not that the list is growing.
      trackEvent('landing_newsletter_submitted', undefined, {
        locale: language,
        already: result.alreadySubscribed ? 1 : 0,
      });
    } else {
      // Never claim it went out when it did not — the address below is the real
      // fallback, exactly as in the story form.
      setState('error');
      trackEvent('landing_newsletter_failed', undefined, { locale: language });
    }
  };

  return (
    <section ref={sectionRef} className="mx-auto w-full max-w-6xl px-5" aria-label={c.title}>
      <div className="mx-auto max-w-2xl rounded-surface border border-line bg-white/72 p-6 shadow-surface ring-1 ring-white/45 backdrop-blur-xl sm:p-7">
        <p className="text-sm font-bold text-[#007a83]">{c.overline}</p>
        <h2 className="mt-2 text-balance text-xl font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">
          {c.title}
        </h2>
        <p className="mt-2.5 text-[15px] font-normal leading-relaxed text-slate-600">{c.body}</p>

        {state === 'sent' ? (
          <p role="status" className="mt-5 flex items-start gap-2.5 text-[15px] font-bold leading-snug text-emerald-700">
            <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            {c.success}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4" noValidate>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="sr-only">{c.inputLabel}</span>
                <input
                  type="email"
                  value={email}
                  onChange={event => {
                    setEmail(event.target.value);
                    // Clear the complaint the moment they start fixing it —
                    // a red line that outlives the mistake reads as broken.
                    if (state === 'invalid' || state === 'error') setState('idle');
                  }}
                  placeholder={c.placeholder}
                  autoComplete="email"
                  inputMode="email"
                  aria-label={c.inputLabel}
                  aria-invalid={state === 'invalid'}
                  className="min-h-12 w-full rounded-control border border-line bg-white px-4 text-[15px] font-medium text-slate-800 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <button
                type="submit"
                disabled={state === 'sending'}
                aria-busy={state === 'sending'}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lifted transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
              >
                {state === 'sending'
                  ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  : <Send className="h-4 w-4" aria-hidden="true" />}
                {state === 'sending' ? c.sending : c.cta}
              </button>
            </div>

            {/* Honeypot: never shown, never announced to a screen reader. */}
            <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0" style={{ left: '-9999px' }}>
              <label>
                Company
                <input type="text" tabIndex={-1} autoComplete="off" value={company} onChange={e => setCompany(e.target.value)} />
              </label>
            </div>

            {/* BEFORE the button in reading order, not after: consent you read
                once you have already acted is not consent. */}
            <p className="mt-3 text-[13px] font-medium leading-snug text-slate-600">{c.consent}</p>

            {state === 'invalid' && (
              <p role="alert" className="mt-2.5 text-[13px] font-semibold leading-snug text-orange-700">
                {c.invalid}
              </p>
            )}

            {state === 'error' && (
              <p role="alert" className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[13px] font-semibold leading-snug text-orange-700">
                {c.error}
                <a
                  href={mailHref}
                  className="inline-flex min-h-11 items-center gap-1.5 underline underline-offset-2"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {LEGAL_OPERATOR.contactEmail}
                </a>
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
};

export default NewsletterSection;
