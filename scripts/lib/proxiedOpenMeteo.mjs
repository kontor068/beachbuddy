/**
 * ΔΕΥΤΕΡΟΣ ΔΡΟΜΟΣ ΠΡΟΣ ΤΟ ΠΛΗΡΩΜΕΝΟ ΠΑΚΕΤΟ, ΟΤΑΝ ΤΟ ΚΛΕΙΔΙ ΔΕΝ ΕΙΝΑΙ ΣΤΟ ΜΗΧΑΝΗΜΑ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το `paidOpenMeteo.mjs` θέλει `OPEN_METEO_API_KEY` στο περιβάλλον, που κανονικά
 * έρχεται από `netlify env:get`. Σε μηχάνημα χωρίς συνδεδεμένο Netlify CLI (ή σε συνεδρία που δεν
 * μπορεί να κάνει login) η μέτρηση θα έπεφτε σιωπηλά στο ΔΩΡΕΑΝ πακέτο — και το δωρεάν πακέτο
 * εξαντλείται μέσα σε μία εθνική σάρωση, οπότε το αποτέλεσμα βγαίνει μισό χωρίς να φανεί ότι είναι.
 *
 * ΤΙ ΚΑΝΕΙ. Ξαναγράφει τους δωρεάν κόμβους του Open-Meteo προς τη ΔΙΚΗ ΜΑΣ πύλη
 * (`netlify/functions/forecast`), δηλαδή ακριβώς τη διαδρομή που ακολουθεί ο browser κάθε
 * επισκέπτη. Το κλειδί μένει εκεί που ήταν — server-side, στο Netlify — και δεν περνάει ποτέ από
 * αυτό το μηχάνημα. Η πύλη έχει και δική της cache, οπότε μια δεύτερη εκτέλεση κοστίζει σχεδόν
 * τίποτα σε κλήσεις μοντέλου.
 *
 * ⚠️ ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑ ΤΟ `paidOpenMeteo`. Αν υπάρχει κλειδί, εκείνο κερδίζει: είναι απευθείας, δεν
 * φορτώνει την παραγωγή και δεν εξαρτάται από το να είναι όρθιο το site. Αυτό εδώ είναι εφεδρεία.
 *
 *     import './lib/paidOpenMeteo.mjs';
 *     import './lib/proxiedOpenMeteo.mjs';   // μπαίνει μόνο αν το πρώτο δεν είχε κλειδί
 */

const PROXY_BASE = process.env.FORECAST_PROXY_BASE || 'https://calmbeach.gr/api/forecast';

/** Δωρεάν κόμβος → τμήμα διαδρομής της πύλης (netlify/functions/forecast.mjs PROVIDERS). */
const PROVIDER_BY_HOST = {
  'api.open-meteo.com': 'open-meteo',
  'marine-api.open-meteo.com': 'open-meteo-marine',
  'air-quality-api.open-meteo.com': 'open-meteo-air-quality',
};

/**
 * Η πύλη χωρίζει το κύμα από τη θερμοκρασία νερού σε δύο παρόχους με διαφορετική διάρκεια cache,
 * αν και χτυπάνε τον ίδιο κόμβο. Ξεχωρίζουν από το τι ζητάει το `hourly`.
 */
const marineProviderFor = (url) => (
  /sea_surface_temperature/.test(url.searchParams.get('hourly') || '')
    ? 'open-meteo-marine-sst'
    : 'open-meteo-marine'
);

const alreadyPaid = Boolean(process.env.OPEN_METEO_API_KEY);
const originalFetch = globalThis.fetch;
let redirected = 0;

if (alreadyPaid) {
  console.log('[proxiedOpenMeteo] υπάρχει κλειδί — δεν μπαίνω στη μέση.');
} else {
  globalThis.fetch = (input, init) => {
    const raw = typeof input === 'string' ? input : input?.url;
    if (typeof raw !== 'string') return originalFetch(input, init);

    let url;
    try { url = new URL(raw); } catch { return originalFetch(input, init); }

    const provider = PROVIDER_BY_HOST[url.hostname];
    if (!provider) return originalFetch(input, init);

    const resolved = provider === 'open-meteo-marine' ? marineProviderFor(url) : provider;
    redirected += 1;
    return originalFetch(`${PROXY_BASE}/${resolved}${url.pathname}${url.search}`, init);
  };

  console.log(`[proxiedOpenMeteo] χωρίς κλειδί — οι κλήσεις πάνε μέσω ${PROXY_BASE}`);
  process.on('exit', () => console.log(`[proxiedOpenMeteo] ανακατευθύνθηκαν ${redirected} κλήσεις`));
}
