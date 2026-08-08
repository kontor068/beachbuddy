import React, { useEffect, useRef } from 'react';
import { Camera, ImagePlus, ShieldCheck, Sparkles } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { canTrackAnalytics, trackEvent } from '../../services/analyticsService';
import { COOKIE_CONSENT_CHANGED_EVENT } from '../../services/legalConsent';
import { landingCopy } from './landingCopy';

// The launch announcement for accounts — and the only place on the landing that
// asks the visitor for something rather than giving them something.
//
// PLACED AFTER THE MANIFESTO ON PURPOSE. The dark band directly above has just
// shown our working and admitted what we do not know; that is the moment the
// page has earned the right to ask for a favour. Asking before it, while the
// visitor still has no reason to trust us, is how a sign-in prompt becomes an
// obstacle instead of an invitation.
//
// TINTED, NOT WHITE. Every other light section on this page is white glass. A
// third white panel between the dark band and the letter would read as more of
// the same and get scrolled past — which for a launch announcement is the whole
// failure. The cyan wash and the photo-frame motif mark it as the new thing.
//
// IT RENDERS NOTHING WHEN ACCOUNTS ARE OFF. With no Supabase configuration the
// sign-in button does not exist in the header either, so announcing the feature
// would advertise a door that is not there.

interface CommunityPhotosSectionProps {
  language: LanguageCode;
  /** False when Supabase is unconfigured — the section then does not render at all. */
  isAuthAvailable: boolean;
  isSignedIn: boolean;
  /** Signed out → start sign-in. Signed in → open the upload sheet. */
  onStart: () => void;
}

const stepIcons = [Sparkles, ImagePlus, ShieldCheck];

export const CommunityPhotosSection: React.FC<CommunityPhotosSectionProps> = ({
  language,
  isAuthAvailable,
  isSignedIn,
  onStart,
}) => {
  const c = getLocalizedCopy(language, landingCopy).photos;

  // Same consent-aware pattern as the rest of the landing: a first-time visitor
  // meets the cookie banner and this page at the same moment, so a plain
  // fire-once effect is swallowed by the consent gate for exactly the people
  // this launch needs to measure.
  const sectionRef = useRef<HTMLElement>(null);
  const sentRef = useRef(false);
  useEffect(() => {
    if (!isAuthAvailable || typeof IntersectionObserver === 'undefined') return undefined;
    let inView = false;

    const flush = () => {
      if (sentRef.current || !inView || !canTrackAnalytics()) return;
      sentRef.current = true;
      trackEvent('landing_photos_viewed', undefined, { signed_in: isSignedIn ? 1 : 0 });
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
  }, [isAuthAvailable, isSignedIn]);

  if (!isAuthAvailable) return null;

  // The accent is a verbatim substring of the title (enforced by the copy's own
  // doc comment), so a plain split is safe and needs no markup in the string.
  const accentIndex = c.title.indexOf(c.titleAccent);
  const titleParts = accentIndex >= 0
    ? [c.title.slice(0, accentIndex), c.titleAccent, c.title.slice(accentIndex + c.titleAccent.length)]
    : [c.title, '', ''];

  return (
    <section ref={sectionRef} className="mx-auto w-full max-w-6xl px-5" aria-label={c.overline}>
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-50 via-white to-sky-100 px-6 py-10 ring-1 ring-cyan-200/70 sm:rounded-[2.5rem] sm:px-12 sm:py-14 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <p className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-[#007a83] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.09em] text-white">
                {c.badge}
              </span>
              <span className="text-sm font-bold text-[#007a83]">{c.overline}</span>
            </p>

            <h2 className="mt-4 text-balance text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[2rem]">
              {titleParts[0]}
              <span className="text-[#007a83]">{titleParts[1]}</span>
              {titleParts[2]}
            </h2>

            <p className="mt-4 max-w-md text-[17px] font-medium leading-relaxed text-slate-700">
              {c.body}
            </p>

            {/* The CTA lives in the left column, next to the promise it makes —
                on a phone the two columns stack, so it lands directly under the
                paragraph rather than after three steps nobody has read yet. */}
            <button
              type="button"
              onClick={() => {
                trackEvent('landing_photos_cta_clicked', undefined, { signed_in: isSignedIn ? 1 : 0 });
                onStart();
              }}
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {isSignedIn ? c.ctaSignedIn : c.cta}
            </button>

            <p className="mt-3 max-w-sm text-[13px] font-semibold leading-snug text-slate-600">{c.note}</p>
          </div>

          <div>
            <ol className="divide-y divide-cyan-200/70 border-t border-cyan-200/70 lg:border-t-0">
              {c.steps.map((step, index) => {
                const Icon = stepIcons[index] || Sparkles;
                return (
                  <li key={step.title} className="flex gap-4 py-5 lg:first:pt-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#007a83] ring-1 ring-cyan-200">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold leading-tight text-slate-950">{step.title}</h3>
                      <p className="mt-1.5 text-sm font-normal leading-relaxed text-slate-600">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunityPhotosSection;
