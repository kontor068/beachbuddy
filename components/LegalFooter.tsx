import React, { useEffect, useState } from 'react';
import { Accessibility, Cookie, Database, FileText, Settings2, ShieldCheck, X } from 'lucide-react';
import { AnalyticsConsent, getAnalyticsConsent, setAnalyticsConsent } from '../services/analyticsService';
import { LanguageCode } from '../types';

export type LegalModal = 'terms' | 'privacy' | 'cookies' | 'accessibility' | 'sources';

export const openLegalModal = (modal: LegalModal) => {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent<LegalModal>('calmbeach:openLegalModal', { detail: modal }));
};

interface LegalFooterProps {
  language: LanguageCode;
}

const LAST_UPDATED = '23 May 2026';

const copy = {
  en: {
    weatherData: 'Weather/marine data',
    terms: 'Terms of Use',
    privacy: 'Privacy & Cookies',
    cookies: 'Cookies',
    cookieSettings: 'Cookie settings',
    accessibility: 'Accessibility',
    sources: 'Data sources',
    close: 'Close',
    lastUpdated: `Last updated: ${LAST_UPDATED}`,
    footerNote: 'Calm Beach is an informational beach guide. Always check local conditions, warning flags, lifeguards, and official advice before swimming.',
    ownerTodo: 'TODO before public launch: add the legal operator name, registered address, support email, and governing law/jurisdiction.',
    consentTitle: 'Analytics cookie choice',
    consentAllowed: 'Analytics allowed',
    consentDeclined: 'Analytics declined',
    consentUnset: 'No analytics choice yet',
    essentialOnly: 'Use essential only',
    allowAnalytics: 'Allow analytics',
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
        body: 'The app may store selected region, favorites, preferences, language, forecast snapshots, and analytics consent in this browser. If you allow browser location, it is used in the current session to estimate distance and nearby options. Precise location is not sent to analytics.',
      },
      {
        title: 'Controller and contact details',
        body: 'Before public launch, this notice must name the legal operator/controller, contact email, registered address if applicable, and any data protection contact. Do not launch publicly with placeholder operator details.',
      },
      {
        title: 'Purposes and legal basis',
        body: 'Essential local storage is used to provide the app, remember choices, and keep the service fast. Browser location is requested only when the user asks for nearby beaches or distance sorting. Optional analytics are based on consent and help understand aggregate product usage.',
      },
      {
        title: 'Sharing and processors',
        body: 'Weather/marine data providers, map providers, hosting/CDN services, Google Analytics if accepted, and other technical providers may process limited technical data under their own terms or processor arrangements. The app should not sell personal data or send precise location to analytics.',
      },
      {
        title: 'Retention',
        body: 'Local browser preferences stay on the user device until cleared by the user or browser. Analytics consent is stored until changed. Optional analytics retention must match the configured Google Analytics property retention before launch.',
      },
      {
        title: 'Your rights',
        body: 'Users may request access, correction, deletion, restriction, objection, portability, and withdrawal of consent where applicable. Users also have the right to lodge a complaint with their local data protection authority. Real contact details must be published before launch.',
      },
    ],
    cookieSections: [
      {
        title: 'Essential storage',
        body: 'Used for necessary app behavior such as selected language, selected region, favorites, preferences, theme, consent choice, forecast cache, and service stability. These are first-party browser storage items and are needed for a fast app experience.',
      },
      {
        title: 'Analytics cookies',
        body: 'Google Analytics is optional. It loads only after the user allows analytics. If analytics are rejected, analytics storage remains denied, advertising storage remains denied, and local analytics events are removed.',
      },
      {
        title: 'Third-party services',
        body: 'External services such as maps, weather providers, navigation links, and embedded provider pages may have their own terms and privacy/cookie policies when opened or used.',
      },
      {
        title: 'Changing your choice',
        body: 'You can change the analytics choice here at any time. Rejecting analytics does not affect the core beach recommendation experience.',
      },
    ],
    accessibilitySections: [
      {
        title: 'Accessibility commitment',
        body: 'Calm Beach aims to be usable on mobile, keyboard-accessible, readable, and clear for tourists making quick beach decisions. Interactive controls should have visible focus states and understandable labels.',
      },
      {
        title: 'Current status',
        body: 'Before public launch, run a focused accessibility pass for contrast, keyboard navigation, focus order, screen-reader labels, modal behavior, and mobile text fitting.',
      },
      {
        title: 'Feedback',
        body: 'A real support email or contact route must be added before public launch so users can report accessibility or privacy issues.',
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
    cookies: 'Cookies',
    cookieSettings: 'Ρυθμίσεις cookies',
    accessibility: 'Προσβασιμότητα',
    sources: 'Πηγές δεδομένων',
    close: 'Κλείσιμο',
    lastUpdated: 'Τελευταία ενημέρωση: 23 Μαΐου 2026',
    footerNote: 'Το Calm Beach είναι οδηγός πληροφόρησης. Πριν κολυμπήσεις, έλεγχε πάντα τις τοπικές συνθήκες, σημαίες, ναυαγοσώστες και επίσημες οδηγίες.',
    ownerTodo: 'TODO πριν το public launch: συμπλήρωση νομικής επωνυμίας/υπεύθυνου, έδρας, email υποστήριξης και εφαρμοστέου δικαίου/δικαιοδοσίας.',
    consentTitle: 'Επιλογή analytics cookies',
    consentAllowed: 'Τα analytics επιτρέπονται',
    consentDeclined: 'Τα analytics έχουν απορριφθεί',
    consentUnset: 'Δεν υπάρχει ακόμα επιλογή analytics',
    essentialOnly: 'Μόνο απαραίτητα',
    allowAnalytics: 'Ναι στα analytics',
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
        body: 'Η εφαρμογή μπορεί να αποθηκεύει επιλεγμένη περιοχή, αγαπημένα, προτιμήσεις, γλώσσα, στιγμιότυπα πρόγνωσης και επιλογή analytics σε αυτόν τον browser. Αν επιτρέψεις τοποθεσία από τον browser, χρησιμοποιείται στην τρέχουσα συνεδρία για εκτίμηση απόστασης και κοντινών επιλογών. Η ακριβής τοποθεσία δεν αποστέλλεται στα analytics.',
      },
      {
        title: 'Υπεύθυνος επεξεργασίας και επικοινωνία',
        body: 'Πριν το public launch, η πολιτική πρέπει να αναφέρει τον πραγματικό νόμιμο διαχειριστή/υπεύθυνο επεξεργασίας, email επικοινωνίας, έδρα όπου εφαρμόζεται και στοιχεία υπεύθυνου προστασίας δεδομένων όπου απαιτείται. Μην βγει δημόσια με placeholder στοιχεία.',
      },
      {
        title: 'Σκοποί και νομική βάση',
        body: 'Η απαραίτητη τοπική αποθήκευση χρησιμοποιείται για τη λειτουργία της εφαρμογής, τη μνήμη επιλογών και την ταχύτητα. Η τοποθεσία ζητείται μόνο όταν ο χρήστης ζητήσει κοντινές παραλίες ή ταξινόμηση απόστασης. Τα προαιρετικά analytics βασίζονται σε συγκατάθεση.',
      },
      {
        title: 'Κοινοποίηση και πάροχοι',
        body: 'Πάροχοι καιρού/θαλάσσης, χάρτες, hosting/CDN, Google Analytics αν γίνει αποδοχή, και άλλες τεχνικές υπηρεσίες μπορεί να επεξεργάζονται περιορισμένα τεχνικά δεδομένα με τους δικούς τους όρους ή συμφωνίες επεξεργασίας. Η εφαρμογή δεν πρέπει να πουλά προσωπικά δεδομένα ή να στέλνει ακριβή τοποθεσία στα analytics.',
      },
      {
        title: 'Διατήρηση',
        body: 'Οι τοπικές προτιμήσεις μένουν στη συσκευή μέχρι να καθαριστούν από τον χρήστη ή τον browser. Η επιλογή analytics αποθηκεύεται μέχρι να αλλάξει. Η διάρκεια διατήρησης στο Google Analytics πρέπει να επιβεβαιωθεί από τη ρύθμιση του property πριν το launch.',
      },
      {
        title: 'Δικαιώματα χρήστη',
        body: 'Οι χρήστες μπορούν να ζητήσουν πρόσβαση, διόρθωση, διαγραφή, περιορισμό, αντίρρηση, φορητότητα και ανάκληση συγκατάθεσης όπου εφαρμόζεται. Έχουν επίσης δικαίωμα καταγγελίας στην αρμόδια αρχή προστασίας δεδομένων. Πραγματικά στοιχεία επικοινωνίας πρέπει να μπουν πριν το launch.',
      },
    ],
    cookieSections: [
      {
        title: 'Απαραίτητη αποθήκευση',
        body: 'Χρησιμοποιείται για βασική λειτουργία όπως γλώσσα, επιλεγμένη περιοχή, αγαπημένα, προτιμήσεις, theme, επιλογή συγκατάθεσης, cache πρόγνωσης και σταθερότητα υπηρεσίας. Είναι first-party browser storage και βοηθά την εφαρμογή να παραμένει γρήγορη.',
      },
      {
        title: 'Analytics cookies',
        body: 'Το Google Analytics είναι προαιρετικό. Φορτώνει μόνο αφού ο χρήστης επιτρέψει analytics. Αν γίνει απόρριψη, το analytics storage μένει denied, το advertising storage μένει denied και τα τοπικά analytics events αφαιρούνται.',
      },
      {
        title: 'Υπηρεσίες τρίτων',
        body: 'Εξωτερικές υπηρεσίες όπως χάρτες, πάροχοι καιρού, σύνδεσμοι πλοήγησης και σελίδες τρίτων μπορεί να έχουν δικούς τους όρους και πολιτικές privacy/cookies όταν ανοίγονται ή χρησιμοποιούνται.',
      },
      {
        title: 'Αλλαγή επιλογής',
        body: 'Μπορείς να αλλάξεις την επιλογή analytics εδώ οποιαδήποτε στιγμή. Η απόρριψη analytics δεν επηρεάζει τη βασική εμπειρία σύστασης παραλιών.',
      },
    ],
    accessibilitySections: [
      {
        title: 'Δέσμευση προσβασιμότητας',
        body: 'Το Calm Beach στοχεύει να είναι εύχρηστο σε κινητό, προσβάσιμο με πληκτρολόγιο, ευανάγνωστο και καθαρό για τουρίστες που θέλουν γρήγορη απόφαση. Τα διαδραστικά στοιχεία πρέπει να έχουν ορατά focus states και σαφείς ετικέτες.',
      },
      {
        title: 'Τρέχουσα κατάσταση',
        body: 'Πριν το public launch χρειάζεται στοχευμένος έλεγχος για contrast, keyboard navigation, focus order, screen-reader labels, modal behavior και εφαρμογή κειμένων σε κινητό.',
      },
      {
        title: 'Feedback',
        body: 'Πριν το public launch πρέπει να προστεθεί πραγματικό email ή τρόπος επικοινωνίας ώστε οι χρήστες να αναφέρουν θέματα προσβασιμότητας ή απορρήτου.',
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
  cookies: { icon: Cookie, titleKey: 'cookies' },
  accessibility: { icon: Accessibility, titleKey: 'accessibility' },
  sources: { icon: Database, titleKey: 'sources' },
} as const;

export const LegalFooter: React.FC<LegalFooterProps> = ({ language }) => {
  const [activeModal, setActiveModal] = useState<LegalModal | null>(null);
  const [analyticsConsent, setLocalAnalyticsConsent] = useState<AnalyticsConsent | null>(() => getAnalyticsConsent());
  const c = getCopy(language);
  const modal = activeModal ? modalMeta[activeModal] : null;
  const sections = activeModal === 'terms'
    ? c.termsSections
    : activeModal === 'privacy'
      ? c.privacySections
      : activeModal === 'cookies'
        ? c.cookieSections
        : activeModal === 'accessibility'
          ? c.accessibilitySections
          : activeModal === 'sources'
            ? c.sourcesSections
            : [];
  const ModalIcon = modal?.icon;
  const consentStatus = analyticsConsent === 'accepted'
    ? c.consentAllowed
    : analyticsConsent === 'declined'
      ? c.consentDeclined
      : c.consentUnset;

  const updateAnalyticsConsent = (choice: AnalyticsConsent) => {
    setAnalyticsConsent(choice);
    setLocalAnalyticsConsent(choice);
  };

  useEffect(() => {
    if (activeModal === 'privacy' || activeModal === 'cookies') {
      setLocalAnalyticsConsent(getAnalyticsConsent());
    }
  }, [activeModal]);

  useEffect(() => {
    const handleOpenLegalModal = (event: Event) => {
      const modalName = (event as CustomEvent<LegalModal>).detail;
      if (modalName && modalName in modalMeta) {
        setActiveModal(modalName);
      }
    };

    document.addEventListener('calmbeach:openLegalModal', handleOpenLegalModal);
    return () => document.removeEventListener('calmbeach:openLegalModal', handleOpenLegalModal);
  }, []);

  return (
    <>
      <footer className="mx-auto w-[calc(100%-1rem)] max-w-4xl rounded-2xl border border-white/80 bg-white/94 px-4 py-4 text-center text-[11px] font-semibold leading-relaxed text-slate-600 shadow-xl shadow-sky-950/10 ring-1 ring-sky-100/70 backdrop-blur-xl sm:w-[calc(100%-2rem)]">
        <p className="mx-auto max-w-2xl text-slate-700">{c.footerNote}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => setActiveModal('terms')} className="min-h-9 rounded-full border border-slate-200 bg-white/80 px-3 text-xs font-extrabold text-slate-700 shadow-sm shadow-sky-900/5 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            {c.terms}
          </button>
          <button type="button" onClick={() => setActiveModal('privacy')} className="min-h-9 rounded-full border border-slate-200 bg-white/60 px-3 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            {c.privacy}
          </button>
          <button type="button" onClick={() => setActiveModal('cookies')} className="min-h-9 rounded-full border border-slate-200 bg-white/60 px-3 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            {c.cookies}
          </button>
          <button type="button" onClick={() => setActiveModal('cookies')} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white/60 px-3 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <Settings2 className="h-3 w-3" aria-hidden="true" />
            {c.cookieSettings}
          </button>
          <button type="button" onClick={() => setActiveModal('accessibility')} className="min-h-9 rounded-full border border-slate-200 bg-white/60 px-3 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            {c.accessibility}
          </button>
          <button type="button" onClick={() => setActiveModal('sources')} className="min-h-9 rounded-full border border-slate-200 bg-white/60 px-3 text-xs font-bold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            {c.sources}
          </button>
          <span className="px-1 text-slate-500">{c.weatherData}: </span>
          <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline">
            Open-Meteo
          </a>
          <span className="text-slate-400">/</span>
          <a href="https://www.dwd.de/EN/ourservices/opendata/opendata.html" target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline">
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

              {(activeModal === 'privacy' || activeModal === 'cookies') && (
                <section className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-900">{c.consentTitle}</h3>
                    <p className="text-sm font-semibold text-slate-600">{consentStatus}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => updateAnalyticsConsent('declined')}
                      className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:px-4 sm:text-sm"
                    >
                      {c.essentialOnly}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAnalyticsConsent('accepted')}
                      className="min-h-11 rounded-xl bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:px-4 sm:text-sm"
                    >
                      {c.allowAnalytics}
                    </button>
                  </div>
                </section>
              )}

              {(activeModal === 'privacy' || activeModal === 'cookies') && (
                <section className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-900">{language === 'gr' ? 'Χρήσιμοι σύνδεσμοι' : 'Useful links'}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-sky-700">
                    <a href="https://support.google.com/analytics/answer/7318509" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      Google Analytics privacy disclosures
                    </a>
                    <a href="https://commission.europa.eu/cookies-policy_en" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      EU cookie policy example
                    </a>
                    <a href="https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      EDPB consent guidelines
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
