import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { landingCopy } from './landingCopy';

// The trust manifesto — our moat, and the one thing the competitor's landing
// has nothing like. Designed as the page's single moment of contrast: a deep
// marine-ink band (sky-950 → slate-950, OUR blue family — deliberately not the
// competitor's dark teal) on an otherwise airy page. Editorial two-column
// composition: the honest statement as a large quote on the left, three
// numbered points with hairline separators on the right. No icon-in-a-box
// cards. Wording mirrors the shipped honesty doctrine (FAQ + methodology) so
// the app and the crawlable pages speak in one voice.

interface HowWeDecideSectionProps {
  language: LanguageCode;
}

export const HowWeDecideSection: React.FC<HowWeDecideSectionProps> = ({ language }) => {
  const c = getLocalizedCopy(language, landingCopy).manifesto;

  // Mirror LegalFooter's FAQ link handling: the FAQ is a prerendered static page
  // that exists in prod / the native app but not under vite dev/preview, so open
  // the live page in dev and keep a relative path in prod.
  const faqPath = language === 'gr' ? '/el/faq/' : '/faq/';
  const faqExternal = import.meta.env.DEV;
  const faqHref = faqExternal ? `https://calmbeach.gr${faqPath}` : faqPath;

  return (
    <section className="mx-auto w-full max-w-6xl px-5" aria-label={c.overline}>
      <div className="overflow-hidden rounded-surface bg-gradient-to-br from-sky-950 to-slate-950 px-6 py-10 sm:rounded-surface sm:px-12 sm:py-14 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <p className="text-sm font-bold text-teal-300">{c.overline}</p>
            <p className="mt-4 max-w-md text-balance text-2xl font-bold leading-snug text-white sm:text-[1.9rem]">
              {c.quote}
            </p>
            <a
              href={faqHref}
              target={faqExternal ? '_blank' : undefined}
              rel={faqExternal ? 'noopener noreferrer' : undefined}
              className="group mt-7 inline-flex items-center gap-2 rounded text-sm font-bold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              {c.more}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>

          <div>
            <ol className="divide-y divide-white/10 border-t border-white/10 lg:border-t-0">
              {c.points.map((point, index) => (
                <li key={point.title} className="flex gap-5 py-5 lg:first:pt-0">
                  <span className="pt-0.5 font-mono text-sm text-teal-300/80" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold leading-tight text-white">{point.title}</h3>
                    <p className="mt-1.5 text-sm font-normal leading-relaxed text-white/65">{point.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Follows straight on from "what we do not know". The form itself
                lives two screens further down, where far fewer people reach — so
                the invitation is made here and jumps them to it. */}
            <a
              href="#epikoinonia"
              className="group mt-5 inline-flex items-center gap-2 rounded text-sm font-bold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              {c.askLink}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowWeDecideSection;
