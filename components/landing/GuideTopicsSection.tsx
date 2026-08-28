import React, { useMemo } from 'react';
import { ArrowUpRight, Compass } from 'lucide-react';
import type { Island, LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { trackEvent } from '../../services/analyticsService';
import { getLandingGuideLinks } from '../../utils/landingGuideLinks';
import { GUIDES_HUB_LABEL, getGuidesHubLink } from '../../utils/beachGuides';
import { landingCopy } from './landingCopy';

// The landing's way into the 381 guide articles — which, until this shipped, it
// did not have.
//
// The links were never really "missing": scripts/prerenderBeachPages.mjs has
// emitted a "popular beach guides" nav in the static home fallback all along.
// But that markup lives inside <div id="root">, and index.tsx mounts with
// createRoot, which clears the container — so the links existed for crawlers and
// for literally nobody else. The same trap ate the ODbL footer link in August.
// This component is the human half; the crawler half already works.
//
// NOT A ROW OF CHIPS. A chips row was built for exactly this job on 08/08/2026
// and rejected on sight — and the objection was right: pills read as filters, and
// a visitor who has just been offered thirteen region pills does not need six
// more.
//
// NOT A QUESTIONNAIRE EITHER. The first version asked «Ψάχνεις κάτι
// συγκεκριμένο;» over six bare adjectives beside a place («Απάνεμες · Νάξος»)
// and it failed the only test that matters: nobody could tell these were
// ARTICLES. The question framing made them look like a filter picker, and an
// adjective is not a headline. So the block now says out loud that it is a list
// of articles, and every row carries the article's own title as one readable
// phrase — «Απάνεμες παραλίες στη Νάξο». The rank numbers are not decoration:
// they are the cheapest signal in the language that says "this is a reading
// list, not a control".
//
// WHY IT SITS HERE, between the region band and the photo ask: someone who does
// not recognise a single region name has, up to this point, been offered nothing
// but "share your location". This is the alternative for them, so it belongs
// directly under the thing it is an alternative to — not four screens down.

interface GuideTopicsSectionProps {
  language: LanguageCode;
  allIslands: Island[];
}

export const GuideTopicsSection: React.FC<GuideTopicsSectionProps> = ({ language, allIslands }) => {
  const c = getLocalizedCopy(language, landingCopy).guides;
  const links = useMemo(() => getLandingGuideLinks(allIslands, language), [allIslands, language]);
  const hub = getGuidesHubLink(language);
  const hubLabel = GUIDES_HUB_LABEL[language] || GUIDES_HUB_LABEL.en;

  // The region index arrives asynchronously; a heading over an empty list is
  // worse than no heading, so the whole section waits rather than flashing.
  if (links.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-5" aria-label={c.title}>
      <div className="flex items-baseline gap-3">
        <h2 className="shrink-0 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{c.title}</h2>
        <span className="hidden h-px flex-1 translate-y-[-0.35rem] bg-slate-300/70 sm:block" aria-hidden="true" />
      </div>
      {/* NO SUBTITLE (09/08/2026). It used to name three of the six topics in a
          sentence sitting directly above the six links that name all of them —
          the same list twice, and ~40px of a phone screen for nothing. */}

      {/* Real full navigations, not SPA routes: the app has no route for these
          articles — they are prerendered pages. Under `vite dev` they do not
          exist on disk, which is the documented reason the hub link goes
          absolute in dev only (utils/beachGuides.ts). */}
      {/* An ORDERED list, and not only for looks: the numbers are the reading
          order we chose, so <ol> is what it actually is. Screen readers announce
          "list item 1 of 6", which carries the same "these are articles, ranked"
          message the numerals carry visually. */}
      <ol className="mt-5 grid gap-x-10 border-t border-line sm:mt-6 sm:grid-cols-2">
        {links.map((link, index) => (
          <li key={link.key} className="border-b border-line">
            <a
              href={link.href}
              // In production these are same-origin prerendered pages and this is
              // a plain navigation. Under `vite dev` the file does not exist, so
              // resolveGuideHref hands back the live URL and it opens in a new
              // tab rather than throwing away the dev session.
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              onClick={() => trackEvent('landing_guide_clicked', undefined, { guide: link.key, locale: language })}
              className="group flex min-h-[3.5rem] items-center gap-3.5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
            >
              {/* aria-hidden because the <ol> already numbers these for a screen
                  reader; reading "01" aloud on top of that is duplication.
                  tabular-nums keeps the six titles on one optical left edge. */}
              <span
                aria-hidden="true"
                className="shrink-0 text-[13px] font-bold tabular-nums text-slate-400 transition-colors group-hover:text-[#007a83]"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {/* ONE PHRASE, not topic + separator + place. The old two-span
                  build read as a filter chip and collapsed to «ΑπάνεμεςΝάξος»
                  for a screen reader; the title now arrives from
                  getLandingGuideLinks already inflected per language. */}
              <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-slate-800 transition-colors group-hover:text-[#007a83]">
                {link.articleTitle}
              </span>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-[#007a83]"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ol>

      <p className="mt-5">
        <a
          href={hub.href}
          target={hub.external ? '_blank' : undefined}
          rel={hub.external ? 'noreferrer' : undefined}
          onClick={() => trackEvent('landing_guide_clicked', undefined, { guide: 'hub', locale: language })}
          className="inline-flex min-h-11 items-center gap-2 rounded text-sm font-bold text-[#007a83] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
        >
          <Compass className="h-4 w-4" aria-hidden="true" />
          {hubLabel}
        </a>
      </p>
    </section>
  );
};

export default GuideTopicsSection;
