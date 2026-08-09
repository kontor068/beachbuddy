import React, { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Mail, Send } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { canTrackAnalytics, sendLandingMessage, trackEvent } from '../../services/analyticsService';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../services/legalConsent';
import { LEGAL_OPERATOR } from '../../utils/legalContent';
import { landingCopy } from './landingCopy';

// The human close. Everything above this point is a machine talking — live
// numbers, geometry, hedged forecasts. This is the one place a person does.
//
// PLACED LAST, right after the dark manifesto band: that section is the
// institutional voice (what we measure, where we stop), so dropping straight
// back into light, first-person prose gives the page its biggest tonal contrast
// and ends the scroll on "help us" rather than on a disclaimer.
//
// SHAPE: a narrow, left-aligned column — a letter, not an About page. The
// manifesto directly above is a wide two-column editorial grid, so repeating
// that here would read as more of the same. Left-aligned beats centred: centred
// prose reads like marketing, ragged-right reads like someone wrote it.
//
// WHY A FORM AND NOT A mailto: 88% of visitors are on a phone, where a mailto:
// either opens an unconfigured mail app or nothing at all — the worst possible
// place to put the one thing we actually want back. An inline box that posts to
// the existing Telegram function converts instead of leaking, and the plain
// address stays underneath so the path never dead-ends.

/**
 * ── PUT YOUR PHOTO HERE ──────────────────────────────────────────────────────
 * Drop a square photo (400×400 or bigger, JPG or WebP) into `public/team/` and
 * set this to its path, e.g. '/team/miltos.jpg'. Nothing else needs changing:
 * the signature swaps the initial for the picture on its own.
 *
 * Left null on purpose rather than pointed at a file that is not there — a
 * missing image is a 404 in the console and a broken frame on the page, and the
 * monogram below is a deliberate design, not a placeholder waiting to be fixed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SIGNATURE_PORTRAIT_SRC: string | null = null;

interface OurStorySectionProps {
  language: LanguageCode;
}

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export const OurStorySection: React.FC<OurStorySectionProps> = ({ language }) => {
  const c = getLocalizedCopy(language, landingCopy).story;
  const mailHref = `mailto:${LEGAL_OPERATOR.contactEmail}?subject=${encodeURIComponent(c.mailSubject)}`;

  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Two sentinels rather than one observer on the section: it is taller than a
  // phone viewport, so a ratio-based observer on the whole thing could never
  // fire. The heading gives us the denominator, the signature an honest
  // read-through rate.
  //
  // Both are held until consent is answered, for the same reason LandingView
  // does it for `landing_viewed`: a first-time visitor meets the banner and this
  // page at once, and scrolling here usually happens BEFORE they answer — firing
  // straight into the consent gate would silently drop exactly the visitors we
  // most need to count.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const seen = new Set<'landing_story_viewed' | 'landing_story_read'>();
    const sent = new Set<string>();

    const flush = () => {
      if (!canTrackAnalytics()) return;
      seen.forEach(event => {
        if (sent.has(event)) return;
        sent.add(event);
        trackEvent(event, undefined, { locale: language });
      });
    };

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          seen.add(entry.target === headingRef.current ? 'landing_story_viewed' : 'landing_story_read');
          observer.unobserve(entry.target);
        });
        flush();
      },
      { threshold: 0.6 },
    );
    if (headingRef.current) observer.observe(headingRef.current);
    if (signatureRef.current) observer.observe(signatureRef.current);

    if (typeof document === 'undefined') return () => observer.disconnect();
    document.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, flush);
    return () => {
      observer.disconnect();
      document.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, flush);
    };
  }, [language]);

  // A half-written first line beats an empty textarea: the chip both names a
  // reportable thing and starts the sentence, which is most of the conversion.
  const applyPrompt = (id: string, seed: string) => {
    setPrompt(id);
    setMessage(current => (current.trim() ? current : seed));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'sending' || message.trim().length < 3) return;

    setState('sending');
    const ok = await sendLandingMessage({ message: message.trim(), replyTo: replyTo.trim(), prompt, language, company });
    if (ok) {
      setState('sent');
      setMessage('');
      setReplyTo('');
      trackEvent('landing_feedback_submitted', undefined, { prompt: prompt || 'none', has_email: replyTo.trim() ? 1 : 0 });
    } else {
      // Never claim it went out when it did not — the mail address below is the
      // real fallback, so say so plainly.
      setState('error');
      trackEvent('landing_feedback_failed');
    }
  };

  // The `id` is so the footer — or any "γράψε μας" link — can deep-link to the ask.
  return (
    <section id="epikoinonia" className="mx-auto w-full max-w-6xl px-5" aria-label={c.overline}>
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-bold text-[#007a83]">{c.overline}</p>
        <h2
          ref={headingRef}
          className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[2rem]"
        >
          {c.title}
        </h2>

        {/* The opening paragraph carries the hook, so it gets a lede's weight —
            without it three equal paragraphs read as a block to skip. */}
        <div className="mt-5 space-y-4">
          {c.paragraphs.map((paragraph, index) => (
            <React.Fragment key={paragraph.slice(0, 24)}>
              <p
                className={
                  index === 0
                    ? 'text-[17px] font-medium leading-relaxed text-slate-700 sm:text-lg'
                    // 16px is the mobile floor for body prose: de-emphasis belongs
                    // in the colour, not in a size people have to squint at.
                    : 'text-base font-normal leading-relaxed text-slate-600'
                }
              >
                {paragraph}
              </p>

              {/* The column's one visual anchor — a skimmer who reads nothing
                  else should still catch the sentence the product is built on. */}
              {index === 1 && (
                <blockquote className="border-l-2 border-[#007a83] py-1 pl-5 text-[17px] font-bold leading-snug text-slate-800 sm:text-xl">
                  {c.pullQuote}
                </blockquote>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Signed, so the letter closes like a letter — and doubles as the
            read-through sentinel: reaching it means the prose was scrolled past.

            NAMED SINCE 09/08/2026. This is the most-read block on the landing —
            85% of the people who reach the heading also reach this line — and it
            used to end «Η ομάδα του CalmBeach», i.e. anonymously. An anonymous
            letter is a strange way to close the one section written in the first
            person, and it is the same thing our own competitor note holds against
            a rival. A face-shaped anchor and a name cost nothing and are the
            cheapest trust on the page.

            The monogram is not a fallback avatar waiting for an upload — it is
            what ships until a real photo is dropped in (see
            SIGNATURE_PORTRAIT_SRC at the top of this file). */}
        <div ref={signatureRef} className="mt-7 flex items-center gap-3.5">
          {SIGNATURE_PORTRAIT_SRC ? (
            <img
              src={SIGNATURE_PORTRAIT_SRC}
              alt={c.signatureName}
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#007a83] text-lg font-black text-white ring-4 ring-[#007a83]/10"
            >
              {c.signatureName.trim().charAt(0)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-tight text-slate-800">{c.signatureName}</span>
            <span className="block text-[13px] font-semibold leading-tight text-slate-500">{c.signatureRole}</span>
          </span>
        </div>

        <div className="mt-8 rounded-3xl border border-white/70 bg-white/72 p-6 shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-xl sm:p-7">
          <h3 className="text-lg font-bold leading-tight text-slate-950">{c.askTitle}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{c.askHint}</p>

          {state === 'sent' ? (
            <p role="status" className="mt-5 flex items-start gap-2.5 text-[15px] font-bold leading-snug text-emerald-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              {c.formSuccess}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="flex flex-wrap gap-2">
                {c.askPrompts.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyPrompt(item.id, item.seed)}
                    aria-pressed={prompt === item.id}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 ${
                      prompt === item.id
                        ? 'border-cyan-300 bg-cyan-50 text-[#007a83]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50/60 hover:text-[#007a83]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={message}
                onChange={event => setMessage(event.target.value)}
                rows={3}
                maxLength={1200}
                required
                placeholder={c.formPlaceholder}
                aria-label={c.askTitle}
                className="mt-3 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-medium leading-relaxed text-slate-800 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />

              <label className="mt-3 block">
                <span className="text-xs font-bold text-slate-500">{c.formEmailLabel}</span>
                <input
                  type="email"
                  value={replyTo}
                  onChange={event => setReplyTo(event.target.value)}
                  placeholder={c.formEmailPlaceholder}
                  autoComplete="email"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[15px] font-medium text-slate-800 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              {/* Honeypot: never shown, never announced to a screen reader. A bot
                  fills every field it finds; a person cannot reach this one. */}
              <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0" style={{ left: '-9999px' }}>
                <label>
                  Company
                  <input type="text" tabIndex={-1} autoComplete="off" value={company} onChange={e => setCompany(e.target.value)} />
                </label>
              </div>

              <button
                type="submit"
                disabled={state === 'sending' || message.trim().length < 3}
                aria-busy={state === 'sending'}
                className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {state === 'sending'
                  ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                  : <Send className="h-4 w-4" aria-hidden="true" />}
                {state === 'sending' ? c.formSending : c.askCta}
              </button>

              {state === 'error' && (
                <p role="alert" className="mt-3 text-[13px] font-semibold leading-snug text-orange-700">
                  {c.formError}{' '}
                  <a href={mailHref} className="underline underline-offset-2">{LEGAL_OPERATOR.contactEmail}</a>
                </p>
              )}
            </form>
          )}

          {/* The address in the clear at all times: some people would simply
              rather write from their own mail than type into someone's box.
              At slate-600/700 and 13-15px, because this is the FALLBACK path for
              the whole section — slate-400 on this glass panel is ~2.6:1 and
              fails AA, i.e. unreadable exactly when the form has failed. */}
          {state !== 'error' && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-slate-600">
              {c.mailFallback}
              <a
                href={mailHref}
                onClick={() => trackEvent('landing_contact_clicked', undefined, { method: 'mailto', locale: language })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded text-[15px] text-slate-700 underline underline-offset-4 transition-colors hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                {LEGAL_OPERATOR.contactEmail}
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default OurStorySection;
