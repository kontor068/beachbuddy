import React, { useState } from 'react';
import { Database, FileText, ShieldCheck, X } from 'lucide-react';
import { LanguageCode } from '../types';

type LegalModal = 'terms' | 'privacy' | 'sources';

interface LegalFooterProps {
  language: LanguageCode;
}

const LAST_UPDATED = '23 May 2026';

const copy = {
  en: {
    weatherData: 'Weather/marine data',
    terms: 'Terms of Use',
    privacy: 'Privacy & Cookies',
    sources: 'Data sources',
    close: 'Close',
    lastUpdated: `Last updated: ${LAST_UPDATED}`,
    footerNote: 'Calm Beach is an informational beach guide. Always check local conditions, warning flags, lifeguards, and official advice before swimming.',
    ownerTodo: 'TODO before public launch: add the legal operator name, registered address, support email, and governing law/jurisdiction.',
    termsSections: [
      {
        title: '1. Service scope',
        body: 'Calm Beach helps users compare beach options in Greece using weather, wind, marine forecasts, beach metadata, distance, and preferences. It is an informational decision aid, not an official safety, lifeguard, navigation, emergency, or weather authority.',
      },
      {
        title: '2. No swimming safety guarantee',
        body: 'Recommendations can be wrong or become outdated quickly. Wind, waves, currents, storms, rainfall, water quality, access roads, and beach services may differ from the forecast or stored beach data. Do not swim in dangerous conditions and follow local flags, signs, lifeguards, port police, civil protection, and official meteorological warnings.',
      },
      {
        title: '3. Forecasts and beach data',
        body: 'Weather and marine data may come from third-party providers and numerical models. Beach photos, amenities, access notes, coordinates, and local metadata may be incomplete or require review. Unknown or uncertain information should be treated cautiously.',
      },
      {
        title: '4. User responsibilities',
        body: 'You are responsible for your own travel, swimming, route, parking, equipment, children, and personal safety decisions. Use common sense, avoid risky sea conditions, and confirm access and facilities locally before relying on them.',
      },
      {
        title: '5. Acceptable use',
        body: 'Do not misuse the site, interfere with its operation, scrape it aggressively, reverse engineer protected parts, upload unlawful content, or use it in a way that harms users, operators, data providers, or third-party services.',
      },
      {
        title: '6. Intellectual property and third-party services',
        body: 'The app design, code, copy, scoring explanations, and compiled beach data are protected where applicable. Third-party maps, weather data, photos, analytics, and APIs remain subject to their own licences and terms.',
      },
      {
        title: '7. Availability and changes',
        body: 'The service may change, be interrupted, or be discontinued. Terms, data sources, features, scoring rules, and supported regions may be updated as the product evolves.',
      },
      {
        title: '8. Liability',
        body: 'To the maximum extent permitted by law, the service is provided without warranties and the operator is not liable for losses, injuries, travel costs, missed plans, inaccurate forecasts, unavailable beaches, or decisions made from the information shown in the app.',
      },
    ],
    privacySections: [
      {
        title: 'What data is used',
        body: 'The app may store selected region, favorites, preferences, forecast snapshots, and analytics consent in this browser. If you allow browser location, it is used to estimate distance and nearby options. Precise location is not sent to analytics.',
      },
      {
        title: 'Analytics and cookies',
        body: 'Google Analytics is optional and loads only after consent. If analytics are rejected, Google Analytics is disabled and locally stored analytics events are removed. Advertising storage, ad user data, and ad personalization are denied by default.',
      },
      {
        title: 'Local storage',
        body: 'Favorites, preferences, selected region, consent choice, and some app state may be kept in localStorage on your device so the app feels faster and remembers your choices.',
      },
      {
        title: 'Your rights',
        body: 'Before launch, the operator must publish real contact details so users can request access, correction, deletion, restriction, objection, portability, and withdrawal of consent where applicable under data protection law.',
      },
    ],
    sourcesSections: [
      {
        title: 'Weather and marine forecast',
        body: 'Weather and marine forecast information is attributed to Open-Meteo and its upstream providers, including DWD where applicable. Forecasts are model-based and may not match exact shoreline conditions.',
      },
      {
        title: 'Maps, beaches, and photos',
        body: 'Beach metadata should come from verified project data and license-safe sources. Photo attribution and licence fields should be kept where required. Do not treat static beach descriptions as live safety conditions.',
      },
      {
        title: 'Official checks',
        body: 'For safety-critical decisions, users should check official weather warnings, port police/civil protection advice, beach flags, lifeguards, and local signs.',
      },
    ],
  },
  gr: {
    weatherData: 'Καιρός/θάλασσα',
    terms: 'Όροι Χρήσης',
    privacy: 'Απόρρητο & Cookies',
    sources: 'Πηγές δεδομένων',
    close: 'Κλείσιμο',
    lastUpdated: 'Τελευταία ενημέρωση: 23 Μαΐου 2026',
    footerNote: 'Το Calm Beach είναι οδηγός πληροφόρησης. Πριν κολυμπήσεις, έλεγχε πάντα τις τοπικές συνθήκες, σημαίες, ναυαγοσώστες και επίσημες οδηγίες.',
    ownerTodo: 'TODO πριν το public launch: συμπλήρωση νομικής επωνυμίας/υπεύθυνου, έδρας, email υποστήριξης και εφαρμοστέου δικαίου/δικαιοδοσίας.',
    termsSections: [
      {
        title: '1. Πεδίο υπηρεσίας',
        body: 'Το Calm Beach βοηθά τους χρήστες να συγκρίνουν παραλίες στην Ελλάδα με βάση καιρό, άνεμο, θαλάσσια πρόγνωση, στοιχεία παραλίας, απόσταση και προτιμήσεις. Είναι εργαλείο πληροφόρησης και όχι επίσημη υπηρεσία ασφάλειας, ναυαγοσωστικής, πλοήγησης, έκτακτης ανάγκης ή μετεωρολογικής προειδοποίησης.',
      },
      {
        title: '2. Καμία εγγύηση ασφάλειας για κολύμπι',
        body: 'Οι προτάσεις μπορεί να είναι λανθασμένες ή να παλιώσουν γρήγορα. Άνεμος, κύμα, ρεύματα, καταιγίδες, βροχή, ποιότητα νερού, δρόμοι πρόσβασης και παροχές μπορεί να διαφέρουν από την πρόγνωση ή τα αποθηκευμένα δεδομένα. Μην κολυμπάς σε επικίνδυνες συνθήκες και ακολούθησε σημαίες, πινακίδες, ναυαγοσώστες, λιμενικό, πολιτική προστασία και επίσημες προειδοποιήσεις.',
      },
      {
        title: '3. Προγνώσεις και δεδομένα παραλιών',
        body: 'Τα δεδομένα καιρού/θάλασσας μπορεί να προέρχονται από τρίτους παρόχους και αριθμητικά μοντέλα. Φωτογραφίες, παροχές, πρόσβαση, συντεταγμένες και τοπικά στοιχεία παραλιών μπορεί να είναι ελλιπή ή να χρειάζονται έλεγχο. Ό,τι είναι άγνωστο ή αβέβαιο πρέπει να αντιμετωπίζεται με προσοχή.',
      },
      {
        title: '4. Ευθύνη χρήστη',
        body: 'Ο χρήστης έχει την ευθύνη για τις μετακινήσεις, το κολύμπι, τη διαδρομή, το parking, τον εξοπλισμό, τα παιδιά και τις προσωπικές αποφάσεις ασφάλειας. Χρησιμοποίησε κοινή λογική, απόφυγε δύσκολες θαλάσσιες συνθήκες και επιβεβαίωσε τοπικά την πρόσβαση και τις παροχές.',
      },
      {
        title: '5. Επιτρεπτή χρήση',
        body: 'Μη χρησιμοποιείς την εφαρμογή καταχρηστικά, μην παρεμβαίνεις στη λειτουργία της, μην κάνεις επιθετικό scraping, μην παρακάμπτεις προστατευμένα μέρη, μην ανεβάζεις παράνομο περιεχόμενο και μην τη χρησιμοποιείς με τρόπο που βλάπτει χρήστες, διαχειριστές, παρόχους δεδομένων ή τρίτες υπηρεσίες.',
      },
      {
        title: '6. Πνευματική ιδιοκτησία και τρίτες υπηρεσίες',
        body: 'Ο σχεδιασμός, ο κώδικας, τα κείμενα, οι εξηγήσεις scoring και τα συγκεντρωμένα δεδομένα προστατεύονται όπου εφαρμόζεται. Χάρτες, δεδομένα καιρού, φωτογραφίες, analytics και APIs τρίτων υπάγονται στους δικούς τους όρους και άδειες.',
      },
      {
        title: '7. Διαθεσιμότητα και αλλαγές',
        body: 'Η υπηρεσία μπορεί να αλλάξει, να διακοπεί προσωρινά ή να σταματήσει. Όροι, πηγές δεδομένων, λειτουργίες, κανόνες scoring και περιοχές κάλυψης μπορεί να ενημερώνονται καθώς εξελίσσεται το προϊόν.',
      },
      {
        title: '8. Περιορισμός ευθύνης',
        body: 'Στο μέγιστο επιτρεπτό από τον νόμο βαθμό, η υπηρεσία παρέχεται χωρίς εγγυήσεις και ο διαχειριστής δεν ευθύνεται για ζημιές, τραυματισμούς, έξοδα μετακίνησης, αλλαγές σχεδίων, ανακριβείς προγνώσεις, μη διαθέσιμες παραλίες ή αποφάσεις που λαμβάνονται με βάση την πληροφορία της εφαρμογής.',
      },
    ],
    privacySections: [
      {
        title: 'Ποια δεδομένα χρησιμοποιούνται',
        body: 'Η εφαρμογή μπορεί να αποθηκεύει επιλεγμένη περιοχή, αγαπημένα, προτιμήσεις, στιγμιότυπα πρόγνωσης και επιλογή analytics σε αυτόν τον browser. Αν επιτρέψεις τοποθεσία από τον browser, χρησιμοποιείται για εκτίμηση απόστασης και κοντινών επιλογών. Η ακριβής τοποθεσία δεν αποστέλλεται στα analytics.',
      },
      {
        title: 'Analytics και cookies',
        body: 'Το Google Analytics είναι προαιρετικό και φορτώνει μόνο μετά από συγκατάθεση. Αν απορρίψεις τα analytics, το Google Analytics απενεργοποιείται και τα τοπικά analytics events αφαιρούνται. Advertising storage, ad user data και ad personalization είναι denied από προεπιλογή.',
      },
      {
        title: 'Τοπική αποθήκευση',
        body: 'Αγαπημένα, προτιμήσεις, επιλεγμένη περιοχή, επιλογή συγκατάθεσης και μέρος του app state μπορεί να μένουν στο localStorage της συσκευής σου για να είναι η εφαρμογή πιο γρήγορη και να θυμάται τις επιλογές σου.',
      },
      {
        title: 'Δικαιώματα χρήστη',
        body: 'Πριν από το launch πρέπει να δημοσιευτούν πραγματικά στοιχεία επικοινωνίας υπεύθυνου, ώστε οι χρήστες να μπορούν να ζητήσουν πρόσβαση, διόρθωση, διαγραφή, περιορισμό, αντίρρηση, φορητότητα και ανάκληση συγκατάθεσης όπου εφαρμόζεται η νομοθεσία προστασίας δεδομένων.',
      },
    ],
    sourcesSections: [
      {
        title: 'Πρόγνωση καιρού και θάλασσας',
        body: 'Τα δεδομένα καιρού/θάλασσας αποδίδονται στο Open-Meteo και στους upstream παρόχους του, συμπεριλαμβανομένου του DWD όπου εφαρμόζεται. Οι προγνώσεις βασίζονται σε μοντέλα και μπορεί να μην ταιριάζουν ακριβώς με τις συνθήκες στην ακτή.',
      },
      {
        title: 'Χάρτες, παραλίες και φωτογραφίες',
        body: 'Τα στοιχεία παραλιών πρέπει να προέρχονται από verified project data και πηγές με ασφαλή άδεια. Όπου απαιτείται, πρέπει να διατηρούνται attribution και licence fields για φωτογραφίες. Οι στατικές περιγραφές παραλιών δεν πρέπει να θεωρούνται live ένδειξη ασφάλειας.',
      },
      {
        title: 'Επίσημοι έλεγχοι',
        body: 'Για αποφάσεις ασφάλειας οι χρήστες πρέπει να ελέγχουν επίσημες προειδοποιήσεις καιρού, οδηγίες λιμενικού/πολιτικής προστασίας, σημαίες παραλίας, ναυαγοσώστες και τοπικές πινακίδες.',
      },
    ],
  },
};

const getCopy = (language: LanguageCode) => (language === 'gr' ? copy.gr : copy.en);

const modalMeta = {
  terms: { icon: FileText, titleKey: 'terms' },
  privacy: { icon: ShieldCheck, titleKey: 'privacy' },
  sources: { icon: Database, titleKey: 'sources' },
} as const;

export const LegalFooter: React.FC<LegalFooterProps> = ({ language }) => {
  const [activeModal, setActiveModal] = useState<LegalModal | null>(null);
  const c = getCopy(language);
  const modal = activeModal ? modalMeta[activeModal] : null;
  const sections = activeModal === 'terms'
    ? c.termsSections
    : activeModal === 'privacy'
      ? c.privacySections
      : activeModal === 'sources'
        ? c.sourcesSections
        : [];
  const ModalIcon = modal?.icon;

  return (
    <>
      <footer className="mx-auto max-w-4xl px-4 pb-3 pt-2 text-center text-[11px] font-medium leading-relaxed text-slate-400">
        <p className="mx-auto max-w-2xl text-slate-500">{c.footerNote}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <button type="button" onClick={() => setActiveModal('terms')} className="underline-offset-4 hover:text-slate-600 hover:underline">
            {c.terms}
          </button>
          <button type="button" onClick={() => setActiveModal('privacy')} className="underline-offset-4 hover:text-slate-600 hover:underline">
            {c.privacy}
          </button>
          <button type="button" onClick={() => setActiveModal('sources')} className="underline-offset-4 hover:text-slate-600 hover:underline">
            {c.sources}
          </button>
          <span>{c.weatherData}: </span>
          <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-slate-600 hover:underline">
            Open-Meteo
          </a>
          <span>/</span>
          <a href="https://www.dwd.de/EN/ourservices/opendata/opendata.html" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-slate-600 hover:underline">
            DWD
          </a>
        </div>
      </footer>

      {activeModal && modal && ModalIcon && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-6" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
          <div className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <ModalIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="legal-modal-title" className="font-heading text-lg font-extrabold leading-tight text-slate-950">
                  {c[modal.titleKey]}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{c.lastUpdated}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label={c.close}
                title={c.close}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(82vh-5rem)] space-y-4 overflow-y-auto px-4 py-4 text-left sm:px-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-900">
                {c.ownerTodo}
              </div>

              {sections.map(section => (
                <section key={section.title} className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900">{section.title}</h3>
                  <p className="text-sm font-medium leading-relaxed text-slate-600">{section.body}</p>
                </section>
              ))}

              {activeModal === 'privacy' && (
                <section className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900">{language === 'gr' ? 'Χρήσιμοι σύνδεσμοι' : 'Useful links'}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-sky-700">
                    <a href="https://support.google.com/analytics/answer/7318509" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      Google Analytics privacy disclosures
                    </a>
                    <a href="https://commission.europa.eu/law/law-topic/data-protection/what-are-my-rights_en" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      GDPR rights
                    </a>
                  </div>
                </section>
              )}

              {activeModal === 'sources' && (
                <section className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900">{language === 'gr' ? 'Σύνδεσμοι πηγών' : 'Source links'}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-sky-700">
                    <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      Open-Meteo terms
                    </a>
                    <a href="https://www.dwd.de/EN/ourservices/opendata/opendata.html" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      DWD Open Data
                    </a>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
