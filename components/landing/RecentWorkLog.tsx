import React, { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { athensDayKey } from '../../utils/athensTime';
import { buildBeachRegionPath } from '../../utils/beachUrls';
import { trackEvent } from '../../services/analyticsService';
import { CHANGELOG, FRESHNESS_MAX_DAYS, changelogRegionName, changelogText, daysSince, formatChangelogDate, type ChangelogTag } from './changelog';
import { landingCopy } from './landingCopy';

// ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΔΟΥΛΕΙΑΣ, κάτω από το γράμμα (04/09/2026, Μίλτος: «να φαίνεται ότι γίνεται
// δουλειά και δεν είναι κάτι που κάναμε μια φορά και τέλος»).
//
// ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΨΗΛΑ: η landing έχει την απόφαση «τίποτα ανάμεσα στο άνοιξα και στο είδα
// παραλία». Το γράμμα τελειώνει σε «βοηθήστε μας»· αυτό λέει «να τι κάναμε με τη βοήθεια», και
// αμέσως μετά το newsletter αποκτά λόγο ύπαρξης. Ίδια στενή στήλη, ίδιος τόνος.
//
// ΤΡΕΙΣ ΓΡΑΜΜΕΣ, όχι λίστα: μία πρόταση η καθεμία, ημερομηνία αριστερά, ταμπελάκι ΝΕΟ /
// ΒΕΛΤΙΩΣΗ / BETA. «Όλα τα νέα» ανοίγει επί τόπου ως 12, με <details> — χωρίς
// JavaScript, χωρίς νέα σελίδα, χωρίς νέο URL.
//
// Ο ΣΚΕΠΤΙΚΙΣΤΗΣ: η φράση «ενημερώθηκε πριν από X μέρες» εμφανίζεται ΜΟΝΟ ως 30 μέρες
// (FRESHNESS_MAX_DAYS). Ένα ημερολόγιο που λέει «πριν από 4 μήνες» είναι χειρότερο από κανένα.

const SHOWN = 3;
const MAX_ALL = 12;

const TAG_CLASS: Record<ChangelogTag, string> = {
  new: 'bg-teal-50 text-teal-700 ring-teal-200',
  improved: 'bg-slate-100 text-slate-600 ring-slate-200',
  beta: 'bg-amber-100 text-amber-800 ring-amber-200',
};

interface RecentWorkLogProps {
  language: LanguageCode;
}

export const RecentWorkLog: React.FC<RecentWorkLogProps> = ({ language }) => {
  const c = getLocalizedCopy(language, landingCopy).workLog;
  // Η «σήμερα» της Αθήνας, μία φορά ανά απόδοση — για το «πριν από X μέρες» και τη χρονιά.
  const [todayIso] = useState(() => athensDayKey());
  const entries = CHANGELOG.slice(0, MAX_ALL);
  const first = entries.slice(0, SHOWN);
  const rest = entries.slice(SHOWN);
  const days = entries.length > 0 ? daysSince(entries[0].date, todayIso) : Number.POSITIVE_INFINITY;
  const freshness = days <= 0 ? c.today : days === 1 ? c.yesterday : days <= FRESHNESS_MAX_DAYS ? c.daysAgo(days) : null;

  // Από το footer κάθε σελίδας φτάνει κανείς εδώ με /#changelog· η landing φορτώνει αργά
  // (lazy), οπότε ο browser δεν βρίσκει την άγκυρα στην ώρα του — κυλάμε εμείς μόλις υπάρξει.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#changelog') return;
    const el = rootRef.current;
    if (!el) return;
    const id = window.setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    return () => window.clearTimeout(id);
  }, []);

  const renderEntry = (entry: (typeof entries)[number]) => {
    const regionName = changelogRegionName(entry, language);
    return (
      <li key={`${entry.date}-${entry.tag}`} className="grid grid-cols-[3.9rem_1fr] gap-x-3 sm:grid-cols-[4.6rem_1fr]">
        <time dateTime={entry.date} className="pt-[3px] text-xs font-semibold tabular-nums text-slate-400">
          {formatChangelogDate(entry.date, language, todayIso)}
        </time>
        <p className="text-[15px] leading-relaxed text-slate-600">
          <span className={`mr-1.5 inline-block -translate-y-px rounded px-1.5 py-px text-[10px] font-black uppercase tracking-[0.12em] ring-1 ring-inset ${TAG_CLASS[entry.tag]}`}>
            {c.tags[entry.tag]}
          </span>
          {changelogText(entry, language)}
          {entry.regionId && regionName && (
            <>
              {' '}
              <a
                href={buildBeachRegionPath(entry.regionId, language)}
                onClick={() => trackEvent('landing_worklog_link_clicked', undefined, { region: entry.regionId, locale: language })}
                className="whitespace-nowrap font-semibold text-[#007a83] underline underline-offset-4 hover:text-cyan-800"
              >
                {regionName} →
              </a>
            </>
          )}
        </p>
      </li>
    );
  };

  if (entries.length === 0) return null;

  return (
    <div ref={rootRef} id="changelog" className="mt-12 scroll-mt-24 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{c.title}</h3>
        {freshness && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" />
            {freshness}
          </span>
        )}
      </div>
      <ol className="mt-4 space-y-3">{first.map(renderEntry)}</ol>
      {rest.length > 0 && (
        <details
          className="group mt-3"
          onToggle={event => {
            if ((event.currentTarget as HTMLDetailsElement).open) trackEvent('landing_worklog_expanded', undefined, { locale: language });
          }}
        >
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-slate-600 underline underline-offset-4 hover:text-[#007a83] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">{c.showAll(entries.length)}</span>
            <span className="hidden group-open:inline">{c.showLess}</span>
          </summary>
          <ol className="mt-2 space-y-3">{rest.map(renderEntry)}</ol>
        </details>
      )}
    </div>
  );
};

export default RecentWorkLog;
