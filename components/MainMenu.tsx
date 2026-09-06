// ΤΟ ΜΕΝΟΥ ΤΗΣ ΚΕΦΑΛΙΔΑΣ — ό,τι ΔΕΝ είναι η απόφαση του σήμερα.
//
// ΤΙ ΜΠΑΙΝΕΙ ΕΔΩ. Τα άρθρα (που μέχρι σήμερα έπιαναν ~490px στη μέση της
// αρχικής), η προτροπή για φωτογραφία, και το ημερολόγιο «τι φτιάξαμε» — τρία
// πράγματα που ο επισκέπτης ψάχνει ΑΦΟΥ πάρει την απάντησή του, όχι πριν.
//
// ΤΙ ΔΕΝ ΜΠΑΙΝΕΙ, ΠΟΤΕ. Οι περιοχές, το «κοντά μου» και η αναζήτηση. Αυτά είναι
// ο λόγος που ήρθε κάποιος· ό,τι μπαίνει πίσω από κουμπί χάνει το μεγαλύτερο
// μέρος των πατημάτων του, και δεν θάβουμε αυτό που κερδίζει την επίσκεψη.
//
// ΣΧΗΜΑ: ΚΑΤΕΒΑΙΝΕΙ ΑΠΟ ΤΟ ΚΟΥΜΠΙ, ΠΑΝΤΟΥ. Χτίστηκε πρώτα σαν φύλλο από τον
// πάτο στο κινητό (μοτίβο AccountPanel) και απορρίφθηκε την ίδια μέρα
// (06/09/2026, Μίλτος): «δεν φαίνεται από εκεί που το πατάω αλλά από χαμηλά».
// Ένα μενού που ανοίγει 600px μακριά από το κουμπί του δεν διαβάζεται σαν
// συνέχεια του κουμπιού. Τώρα είναι αγκυρωμένο πλαίσιο σε ΚΑΘΕ πλάτος, όπως
// ακριβώς το μενού της γλώσσας δίπλα του — ίδια συμπεριφορά, μηδέν έκπληξη.
// Χωρίς portal, χωρίς κλείδωμα του body: το πάνελ ζει μέσα στην κεφαλίδα.
//
// SEO: ΚΑΝΕΝΑ ΚΟΣΤΟΣ. Τα έξι άρθρα δεν ήταν ποτέ στο στατικό HTML της αρχικής —
// το GuideTopicsSection περίμενε το ευρετήριο περιοχών και γύριζε null μέχρι
// τότε. Ό,τι βλέπει ο crawler στην αρχική το γράφει το prerender (ένα «popular
// beach guides» nav μέσα στο #root, μαζί με /beach-guides/) και δεν το αγγίζει
// αυτή η αλλαγή.

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Camera, Compass, Wrench } from 'lucide-react';
import type { Island, LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';
import { trackEvent } from '../services/analyticsService';
import { getLandingGuideLinks } from '../utils/landingGuideLinks';
import { GUIDES_HUB_LABEL, getGuidesHubLink } from '../utils/beachGuides';
import { changelogShort, formatChangelogDate, latestChangelogEntry } from './landing/changelog';
import { athensDayKey } from '../utils/athensTime';

export interface MainMenuProps {
  language: LanguageCode;
  /** Το ευρετήριο περιοχών — χωρίς αυτό τα άρθρα δεν μπορούν να ονομαστούν. */
  allIslands?: Island[];
  /** Απών ⇒ δεν προσφέρεται καθόλου η φωτογραφία (π.χ. build χωρίς λογαριασμούς). */
  onAddPhoto?: () => void;
  onClose: () => void;
}

type Copy = {
  title: string;
  guides: string;
  photo: string;
  photoHint: string;
  work: string;
};

// Γραμμένο εδώ και όχι στο translations.ts: εκείνο το αρχείο είναι δικό του
// κομμάτι που κατεβάζει ΚΑΘΕ επισκέπτης, και πέντε φράσεις για ένα πάνελ που
// ανοίγει μόνο στο κλικ δεν έχουν θέση μέσα του.
const menuCopy: Record<LanguageCode, Copy> = {
  gr: {
    title: 'Μενού',
    guides: 'Άρθρα ανά περιοχή',
    photo: 'Ανέβασε φωτογραφία',
    photoHint: 'Από παραλία που ξέρεις',
    work: 'Τι φτιάξαμε τελευταία',
  },
  en: {
    title: 'Menu',
    guides: 'Guides by region',
    photo: 'Add a photo',
    photoHint: 'From a beach you know',
    work: 'What we shipped lately',
  },
  de: {
    title: 'Menü',
    guides: 'Strandführer nach Region',
    photo: 'Foto hinzufügen',
    photoHint: 'Von einem Strand, den du kennst',
    work: 'Zuletzt gebaut',
  },
  fr: {
    title: 'Menu',
    guides: 'Guides par région',
    photo: 'Ajouter une photo',
    photoHint: 'Une plage que vous connaissez',
    work: 'Nos dernières nouveautés',
  },
  it: {
    title: 'Menu',
    guides: 'Guide per regione',
    photo: 'Aggiungi una foto',
    photoHint: 'Una spiaggia che conosci',
    work: 'Cosa abbiamo fatto di recente',
  },
};

export const MainMenu: React.FC<MainMenuProps> = ({ language, allIslands, onAddPhoto, onClose }) => {
  const copy = getLocalizedCopy(language, menuCopy);
  const links = useMemo(() => getLandingGuideLinks(allIslands ?? [], language), [allIslands, language]);
  const hub = getGuidesHubLink(language);
  const hubLabel = GUIDES_HUB_LABEL[language] || GUIDES_HUB_LABEL.en;
  const latestWork = latestChangelogEntry();
  const [todayIso] = useState(() => athensDayKey());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      data-main-menu=""
      role="dialog"
      aria-label={copy.title}
      // Το πλάτος δένεται στην οθόνη, όχι σε σταθερό νούμερο: στα 320px ένα
      // w-80 θα κρεμόταν έξω από τη δεξιά άκρη. Το ύψος κόβεται στο ορατό
      // παράθυρο ώστε το πάνελ να κυλάει μέσα του και ποτέ η σελίδα από κάτω.
      className="absolute right-0 top-full z-[60] mt-2 max-h-[calc(100svh-5rem)] w-[min(22rem,calc(100vw-1.75rem))] overflow-y-auto overscroll-contain rounded-2xl border border-cyan-100 bg-white p-2 shadow-xl shadow-sky-900/14 ring-1 ring-white/70"
    >
      {/* ΤΑ ΑΡΘΡΑ. Πλήρεις πλοηγήσεις, όχι διαδρομές της εφαρμογής: είναι
          προ-φτιαγμένες σελίδες, που κάτω από `vite dev` δεν υπάρχουν στον
          δίσκο — γι᾿ αυτό ο σύνδεσμος γίνεται απόλυτος μόνο στο dev
          (utils/beachGuides.ts).
          ΧΩΡΙΣ ΟΡΑΤΗ ΕΠΙΚΕΦΑΛΙΔΑ (06/09/2026, Μίλτος): έξι τίτλοι άρθρων δεν
          χρειάζονται ταμπέλα που λέει ότι είναι άρθρα. Ο τίτλος ζει μόνο στο
          aria-label, για όποιον ακούει τη σελίδα αντί να τη βλέπει. */}
      {links.length > 0 && (
        <nav aria-label={copy.guides} className="px-1">
          <ol>
            {links.map((link, index) => (
              <li key={link.key} className={index === 0 ? '' : 'border-t border-line'}>
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  onClick={() => {
                    trackEvent('menu_guide_clicked', undefined, { guide: link.key, locale: language });
                    onClose();
                  }}
                  className="group flex min-h-[2.9rem] items-center gap-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
                >
                  <span className="min-w-0 flex-1 text-[14px] font-bold leading-snug text-slate-800 transition-colors group-hover:text-[#007a83]">
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

          <a
            href={hub.href}
            target={hub.external ? '_blank' : undefined}
            rel={hub.external ? 'noopener noreferrer' : undefined}
            onClick={() => {
              trackEvent('menu_guide_clicked', undefined, { guide: 'hub', locale: language });
              onClose();
            }}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded border-t border-line pt-2 text-[13px] font-bold text-[#007a83] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            {hubLabel}
          </a>
        </nav>
      )}

      {/* Η ΦΩΤΟΓΡΑΦΙΑ. Δεύτερος δρόμος, όχι ο μοναδικός — η ενότητα στην αρχική
          μένει ακριβώς εκεί που είναι. Ένα αίτημα που ζει μόνο πίσω από κουμπί
          δεν το πατάει κανείς. */}
      {onAddPhoto && (
        <button
          type="button"
          onClick={() => {
            trackEvent('menu_add_photo_clicked', undefined, { locale: language });
            onClose();
            onAddPhoto();
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-sky-50/80 px-3 py-3 text-left ring-1 ring-white/60 transition hover:bg-sky-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
        >
          <Camera className="h-5 w-5 shrink-0 text-[#007a83]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-slate-800">{copy.photo}</span>
            <span className="block text-xs font-medium text-slate-500">{copy.photoHint}</span>
          </span>
        </button>
      )}

      {/* ΤΙ ΦΤΙΑΞΑΜΕ ΤΕΛΕΥΤΑΙΑ. Μία γραμμή, η πιο πρόσφατη εγγραφή — και
          σύνδεσμος στο πλήρες ημερολόγιο της αρχικής, ακριβώς όπως κάνει ήδη
          το υποσέλιδο. Πλήρης πλοήγηση: το RecentWorkLog κυλάει μόνο του όταν
          βρει το #changelog.
          ΟΧΙ ΑΣΤΕΡΑΚΙΑ (06/09/2026, Μίλτος): τα sparkles έχουν γίνει παγκοσμίως
          το σήμα του «αυτό το έγραψε AI». Το ημερολόγιο είναι χειρόγραφο και δεν
          επιτρέπεται να διαβάζεται αλλιώς — εδώ πάει κλειδί, όχι λάμψη. */}
      {latestWork && (
        <a
          href="/#changelog"
          onClick={() => {
            trackEvent('menu_latest_work_clicked', undefined, { locale: language });
            onClose();
          }}
          className="mt-1 flex items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700/30"
        >
          <Wrench className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-slate-800">{copy.work}</span>
            <span className="block text-xs leading-snug text-slate-500">
              <span className="tabular-nums">{formatChangelogDate(latestWork.date, language, todayIso)}</span>
              {' · '}
              {changelogShort(latestWork, language)}
            </span>
          </span>
        </a>
      )}
    </div>
  );
};

export default MainMenu;
