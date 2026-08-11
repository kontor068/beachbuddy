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
  // OBSERVES THE HEADING, NOT THE WHOLE SECTION (changed 09/08/2026). With a
  // ratio threshold on the section itself, "seen" meant "40% of however tall
  // this card happens to be" — so halving the card moved the trigger point and
  // would have shown up in the data as a jump in interest that nobody caused.
  // A heading is the same height whatever the card does, which is also why
  // OurStorySection has always sentinelled on its own heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
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
    }, { threshold: 0.6 });

    if (headingRef.current) observer.observe(headingRef.current);
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
    <section className="mx-auto w-full max-w-6xl px-5" aria-label={c.overline}>
      {/* HALVED 09/08/2026. This was the tallest block on the landing — a full
          phone screen and then some — and it is the only one that ASKS instead of
          giving, aimed at a first-time visitor from Google who has not been to
          the beach yet. It keeps its place (Miltos moved it up on 08/08, straight
          after the region band) and loses its bulk: tighter padding, a smaller
          heading, one paragraph instead of two, and the three steps as a row
          rather than a divided column.
          WHAT DID NOT GET CUT: all three steps, in full. The copy's own note
          says they are load-bearing — dropping "a person checks it first" turns
          an approval queue into a broken promise the first time a photo does not
          appear — so the shrink came out of spacing and type size, not truth. */}
      <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-cyan-50 via-white to-sky-100 px-5 py-7 ring-1 ring-cyan-200/70 sm:rounded-[2rem] sm:px-9 sm:py-9">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12">
          <div>
            <p className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#007a83] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.09em] text-white">
                {c.badge}
              </span>
              <span className="text-[13px] font-bold text-[#007a83]">{c.overline}</span>
            </p>

            <h2 ref={headingRef} className="mt-2.5 text-balance text-xl font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">
              {titleParts[0]}
              <span className="text-[#007a83]">{titleParts[1]}</span>
              {titleParts[2]}
            </h2>

            <p className="mt-2.5 max-w-md text-[15px] font-medium leading-relaxed text-slate-700">
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
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cta px-5 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {c.cta}
            </button>

            <p className="mt-2.5 max-w-sm text-[12px] font-semibold leading-snug text-slate-600">{c.note}</p>
          </div>

          {/* The height came out of the CHROME, not the content: all three steps
              keep their full title and body. Gone are the 36px icon tiles, the
              dividers and the 20px vertical padding per row — the icon is now
              inline with the title and the rows sit on a 12px rhythm.

              STILL ONE COLUMN ON A PHONE. Three across was tried and is wrong at
              320-375px: the columns land at ~85px while the longest step titles
              ("Choisissez la plage", "Ein Mensch schaut es an") need roughly
              95px, so they wrap to three ragged lines each and the strip ends up
              taller than the list it replaced. Three columns only from `sm:` up,
              where a column is ~180px.
              (The sign-in step that used to set this width was removed on
              11/08/2026 — guest uploads. The constraint survives it.) */}
          <ol className="grid gap-3 border-t border-cyan-200/70 pt-4 sm:grid-cols-3 sm:gap-x-5 lg:border-t-0 lg:pt-0">
            {c.steps.map((step, index) => {
              const Icon = stepIcons[index] || Sparkles;
              return (
                <li key={step.title} className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[13px] font-bold leading-tight text-slate-950">
                    <Icon className="h-4 w-4 shrink-0 text-[#007a83]" aria-hidden="true" />
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[12px] font-normal leading-snug text-slate-600">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default CommunityPhotosSection;
