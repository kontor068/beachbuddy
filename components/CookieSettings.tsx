import React, { useState } from 'react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';
import { applyCookieConsent, getCookieConsentState } from '../services/legalConsent';

interface CookieSettingsProps {
  language: LanguageCode;
  /** Where this instance lives, recorded in the consent log (e.g. 'banner', 'footer'). */
  source: string;
  onSaved?: () => void;
}

const copy = {
  en: {
    heading: 'Cookie settings',
    intro: 'Non-essential cookies stay off until you allow them. You can change this at any time.',
    rejectAll: 'Reject all',
    acceptAll: 'Accept all',
    saveChoices: 'Save choices',
    necessary: 'Strictly necessary',
    necessaryDesc: 'Required for the app to work (language, region, favourites, security). Always on.',
    alwaysOn: 'Always on',
    analytics: 'Statistics (Google Analytics)',
    analyticsDesc: 'Anonymous usage stats to improve the app. Loads only if you allow it.',
    statusAccepted: 'Current choice: statistics allowed.',
    statusDeclined: 'Current choice: essential only.',
    statusUnset: 'No choice saved yet.',
    saved: 'Saved.',
  },
  gr: {
    heading: 'Ρυθμίσεις Cookies',
    intro: 'Τα μη απαραίτητα cookies παραμένουν ανενεργά μέχρι να τα επιτρέψεις. Μπορείς να το αλλάξεις οποτεδήποτε.',
    rejectAll: 'Απόρριψη όλων',
    acceptAll: 'Αποδοχή όλων',
    saveChoices: 'Αποθήκευση επιλογών',
    necessary: 'Απολύτως απαραίτητα',
    necessaryDesc: 'Απαραίτητα για τη λειτουργία (γλώσσα, περιοχή, αγαπημένα, ασφάλεια). Πάντα ενεργά.',
    alwaysOn: 'Πάντα ενεργά',
    analytics: 'Στατιστικά (Google Analytics)',
    analyticsDesc: 'Ανώνυμα στατιστικά χρήσης για βελτίωση. Φορτώνει μόνο αν το επιτρέψεις.',
    statusAccepted: 'Τρέχουσα επιλογή: επιτρέπονται τα στατιστικά.',
    statusDeclined: 'Τρέχουσα επιλογή: μόνο απαραίτητα.',
    statusUnset: 'Δεν έχει αποθηκευτεί επιλογή ακόμα.',
    saved: 'Αποθηκεύτηκε.',
  },
};

export const CookieSettings: React.FC<CookieSettingsProps> = ({ language, source, onSaved }) => {
  const c = getLocalizedCopy(language, copy);
  const initial = getCookieConsentState();
  const [analytics, setAnalytics] = useState<boolean>(initial?.analytics ?? false);
  const [saved, setSaved] = useState(false);

  const persist = (analyticsAllowed: boolean, choice: 'accept_all' | 'reject_all' | 'custom') => {
    applyCookieConsent({ necessary: true, analytics: analyticsAllowed }, { choice, language, source });
    setAnalytics(analyticsAllowed);
    setSaved(true);
    onSaved?.();
  };

  const status = (() => {
    const current = getCookieConsentState();
    if (!current) return c.statusUnset;
    return current.analytics ? c.statusAccepted : c.statusDeclined;
  })();

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-extrabold text-slate-900">{c.heading}</h3>
        <p className="text-xs font-medium leading-relaxed text-slate-600">{c.intro}</p>
      </div>

      {/* First-level, equal-weight choices (EDPB: reject as easy as accept). */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => persist(false, 'reject_all')}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {c.rejectAll}
        </button>
        <button
          type="button"
          onClick={() => persist(true, 'accept_all')}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {c.acceptAll}
        </button>
      </div>

      {/* Per-category customization. */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{c.necessary}</p>
            <p className="text-xs font-medium leading-snug text-slate-600">{c.necessaryDesc}</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">{c.alwaysOn}</span>
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{c.analytics}</p>
            <p className="text-xs font-medium leading-snug text-slate-600">{c.analyticsDesc}</p>
          </div>
          <input
            type="checkbox"
            checked={analytics}
            onChange={event => {
              setAnalytics(event.target.checked);
              setSaved(false);
            }}
            className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-sky-600"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500" aria-live="polite">{saved ? c.saved : status}</p>
        <button
          type="button"
          onClick={() => persist(analytics, 'custom')}
          className="min-h-10 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {c.saveChoices}
        </button>
      </div>
    </section>
  );
};
