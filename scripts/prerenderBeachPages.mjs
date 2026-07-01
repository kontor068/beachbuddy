import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { amenityTextIncludesAny, SNACK_CANTEEN_AMENITY_TERMS } from '../utils/amenityMatching.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');
const indexHtmlPath = path.join(distDir, 'index.html');
const beachIndexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');
const defaultOgImagePath = '/milos-sarakiniko-bg.jpg';
const homeOgImagePath = '/og-image.png';
const defaultRobotsContent = 'index, follow, max-image-preview:large';

const regionOgImageOverrides = new Map([
  ['attica-athens-area-mainland', '/attica-athens-coast-bg.jpg'],
  ['attica-east-attica-mainland', '/attica-east-bg.jpg'],
  ['attica-kythira', '/attica-kythira-bg.jpg'],
  ['attica-piraeus-area', '/attica-piraeus-coast-bg.jpg'],
  ['attica-west-attica-mainland', '/attica-west-bg.jpg'],
  ['central-greece-evia', '/euboea-evia-bg.jpg'],
  ['crete-gavdos', '/crete-chania-bg.jpg'],
  ['south-aegean-milos', defaultOgImagePath],
  ['south-aegean-polyaigos', defaultOgImagePath],
]);

const ogImageGroupPrefixes = new Map([
  ['argosaronic', 'saronic'],
  ['attica', 'attica'],
  ['crete', 'crete'],
  ['cyclades', 'cyclades'],
  ['dodecanese', 'dodecanese'],
  ['euboea', 'euboea'],
  ['ionian', 'ionian'],
  ['sporades', 'sporades'],
]);

const prerenderLocales = [
  {
    id: 'en',
    language: 'en',
    htmlLang: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    pathPrefix: '',
    homeTitle: 'CalmBeach Greece - Best Beach Today by Wind & Waves',
    homeDescription: 'Find a calmer beach in Greece today. CalmBeach compares live wind, waves, weather and beach exposure so you know where to swim with confidence.',
    homeImageAlt: 'CalmBeach Greece beach recommendations by wind and waves',
  },
  {
    id: 'el',
    language: 'gr',
    htmlLang: 'el',
    hreflang: 'el',
    ogLocale: 'el_GR',
    pathPrefix: '/el',
    homeTitle: 'Calm Beach Greece - Καλύτερη Παραλία Σήμερα',
    homeDescription: 'Calm Beach Greece - Βρες την καλύτερη παραλία για σήμερα με βάση άνεμο, κύμα και καιρό.',
    homeImageAlt: 'Calm Beach Greece προτάσεις παραλιών',
  },
  {
    id: 'de',
    language: 'de',
    htmlLang: 'de',
    hreflang: 'de',
    ogLocale: 'de_DE',
    pathPrefix: '/de',
    homeTitle: 'CalmBeach Griechenland – Der ruhigste Strand heute nach Wind & Wellen',
    homeDescription: 'Finde heute einen ruhigeren Strand in Griechenland. CalmBeach vergleicht Wind, Wellen, Wetter und die Lage der Strände, damit du weißt, wo du sicher schwimmen kannst.',
    homeImageAlt: 'CalmBeach Griechenland – Strandempfehlungen nach Wind und Wellen',
  },
  {
    id: 'fr',
    language: 'fr',
    htmlLang: 'fr',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    pathPrefix: '/fr',
    homeTitle: 'CalmBeach Grèce – La plage la plus calme aujourd’hui selon le vent et les vagues',
    homeDescription: 'Trouvez une plage plus calme en Grèce aujourd’hui. CalmBeach compare le vent, les vagues, la météo et l’exposition des plages pour savoir où vous baigner en toute confiance.',
    homeImageAlt: 'CalmBeach Grèce – recommandations de plages selon le vent et les vagues',
  },
  {
    id: 'it',
    language: 'it',
    htmlLang: 'it',
    hreflang: 'it',
    ogLocale: 'it_IT',
    pathPrefix: '/it',
    homeTitle: 'CalmBeach Grecia – La spiaggia più calma oggi in base a vento e onde',
    homeDescription: 'Trova oggi una spiaggia più tranquilla in Grecia. CalmBeach confronta vento, onde, meteo ed esposizione delle spiagge per sapere dove fare il bagno in sicurezza.',
    homeImageAlt: 'CalmBeach Grecia – consigli sulle spiagge in base a vento e onde',
  },
];

// --- Multilingual pilot gating -------------------------------------------------
// SEO penalty risk: emitting de/fr/it hreflang on a page that has no de/fr/it
// file points search engines at 404s. So extra locales are emitted ONLY for
// regions in LOCALIZED_REGIONS, and every page's hreflang lists ONLY the locales
// that page was actually generated in (see localesForRegion + alternateUrlsFor).
// en + el stay national and byte-identical; rollout = add region ids here.
const BASE_LOCALE_IDS = new Set(['en', 'el']);
const baseLocales = prerenderLocales.filter(locale => BASE_LOCALE_IDS.has(locale.id));
const LOCALIZED_REGIONS = new Set(['south-aegean-milos']);
const localesForRegion = regionId =>
  LOCALIZED_REGIONS.has(regionId) ? prerenderLocales : baseLocales;

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'));

// Curated per-beach editorial stories (geology/history/character). Single source
// of truth shared with the runtime (data/beachStories.ts), shaped as
// { regionId: { beachId: { title, paragraphs } } }; authored only in en/gr. We
// bake them into the static beach pages so this unique content is crawlable
// (otherwise it lives only in the client-only React detail page and search
// engines never see it).
const beachStories = await readJson(path.join(projectRoot, 'data', 'beachStories.data.json'));

// Returns { title, paragraphs[] } for a beach, or null. Scoped by region id
// (ids are unique only within a region) and to the locales the story is actually
// authored in (en/gr) so we never leak English onto /de, /fr, /it.
const getBeachStory = (region, beach, language) => {
  if (!region) return null;
  if (language !== 'en' && language !== 'gr') return null;
  const regionStories = beachStories[region.id];
  if (!regionStories) return null;
  const story = regionStories[String(beach.id)];
  const paragraphs = story?.paragraphs?.[language];
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return null;
  return { title: story.title?.[language] || '', paragraphs };
};

const toPublicFilePath = publicPath => path.join(publicDir, publicPath.replace(/^\/+/, ''));

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeXml = escapeHtml;

const normalizeSlug = value => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'beach';
};

const toAbsolutePublicUrl = publicPath => `${siteUrl}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`;

const toSitemapImageUrl = (imageUrl, publicAssets) => {
  const url = new URL(imageUrl);
  const publicPath = url.pathname;
  const webpPath = publicPath.replace(/\.(jpe?g)$/i, '.webp');

  return webpPath !== publicPath && publicAssets.has(webpPath)
    ? toAbsolutePublicUrl(webpPath)
    : imageUrl;
};

const imageTypeFromPath = publicPath => (
  publicPath.endsWith('.webp')
    ? 'image/webp'
    : publicPath.endsWith('.jpg') || publicPath.endsWith('.jpeg')
      ? 'image/jpeg'
      : undefined
);

const listRootPublicAssets = async () => {
  const entries = await readdir(publicDir, { withFileTypes: true });
  return new Set(entries
    .filter(entry => entry.isFile())
    .map(entry => `/${entry.name}`));
};

const uniqueCandidateSlugs = (...values) => Array.from(new Set(values
  .map(value => normalizeSlug(String(value || '').replace(/\s*\([^)]*\)\s*/g, ' ')))
  .filter(Boolean)));

const firstAvailablePublicAsset = (candidates, publicAssets) => (
  candidates.find(candidate => candidate && publicAssets.has(candidate)) || defaultOgImagePath
);

const resolveRegionOgImagePath = (region, island, publicAssets) => {
  const override = regionOgImageOverrides.get(region?.id) || regionOgImageOverrides.get(island?.id);
  const groupPrefix = ogImageGroupPrefixes.get(region?.group || island?.group);
  const slugs = uniqueCandidateSlugs(
    localized(island?.name, ''),
    localized(region?.name, ''),
    region?.prefecture,
    region?.id,
    island?.id,
  );

  const candidates = [
    override,
    ...slugs.flatMap(slug => [
      groupPrefix ? `/${groupPrefix}-${slug}-bg.jpg` : null,
      groupPrefix ? `/${groupPrefix}-${slug}-bg.webp` : null,
      `/${slug}-bg.jpg`,
      `/${slug}-bg.webp`,
    ]),
    defaultOgImagePath,
  ];

  return firstAvailablePublicAsset(Array.from(new Set(candidates.filter(Boolean))), publicAssets);
};

const localized = (value, fallback = '', language = 'en') => {
  if (typeof value === 'string') return value;

  return value?.[language] || value?.en || value?.gr || value?.fr || value?.de || value?.it || fallback;
};

// Per-language string/value picker for prerender copy. Falls back to English for
// any locale that has not been authored, so partial translations never break.
const pickLang = (language, map) => map[language] ?? map.en;

// Place names (beaches, islands) are TRANSLITERATED, never translated: a German
// or French visitor searches "Sarakiniko", and signage/ferries/Maps use the Latin
// form. The data's fr/de/it name fields are Greek copies, so for every non-Greek
// locale we use the romanized English form (which the slug also uses). Greek keeps
// the Greek name. en/gr behaviour is unchanged.
const placeNameLang = language => (language === 'gr' ? 'gr' : 'en');
const displayName = (nameObj, fallback, language) => localized(nameObj, fallback, placeNameLang(language));

const localizedPath = (pathName, locale) => {
  const suffix = pathName.startsWith('/') ? pathName : `/${pathName}`;
  return `${locale.pathPrefix}${suffix}`;
};

const canonicalUrlFor = (pathName, locale) => `${siteUrl}${localizedPath(pathName, locale)}`;

// The home page is only prerendered for the base locales (en, el). de/fr/it
// cluster pages therefore point their breadcrumb "home" at the root home, so the
// link and its JSON-LD never reference a non-existent /de//fr//it/ home. en/gr
// resolve to exactly the same URL as before.
const homePathForLocale = locale => (baseLocales.includes(locale) ? localizedPath('/', locale) : '/');
const homeUrlForLocale = locale => `${siteUrl}${homePathForLocale(locale)}`;

// `locales` MUST be the exact set this page was generated in, so we never emit an
// hreflang link to a file that does not exist. Defaults to the national en+el set.
const alternateUrlsFor = (pathName, locales = baseLocales) => [
  ...locales.map(locale => ({
    hreflang: locale.hreflang,
    href: canonicalUrlFor(pathName, locale),
  })),
  {
    hreflang: 'x-default',
    href: canonicalUrlFor(pathName, prerenderLocales[0]),
  },
];

// Each landing page targets a distinct search intent and is generated in every
// locale that provides content. Greek versions live under /el and reciprocate
// hreflang with their English counterpart. Link hrefs are stored as base
// (English) paths and localized at render time, so a Greek page links to Greek
// pages without duplicating the link table.
const seoLandingPages = [
  {
    // A general site FAQ. kind 'info' → no dynamic beach/region block; the Q&A renders
    // visibly AND becomes FAQPage JSON-LD (buildSeoLandingPage adds it from content.faq).
    pathName: '/faq/',
    kind: 'info',
    locales: {
      en: {
        title: 'Frequently Asked Questions | CalmBeach Greece',
        description: 'Common questions about CalmBeach: how reliable the forecast is, what wind exposure means, how wave height is worked out, where the data comes from and swimming safety.',
        h1: 'Frequently asked questions',
        intro: 'CalmBeach helps you pick a calm beach for today by comparing wind, waves, weather, exposure and access across more than 2,500 Greek beaches. Here are the questions people ask most.',
        sections: [],
        faq: [
          {
            q: 'How reliable is the CalmBeach forecast?',
            a: 'Wind, waves and temperature are a live weather forecast, not an on-the-spot measurement. It shows what is likely, so it is more accurate closer to the day than a week ahead. We present it as honestly as we can — for example a wave-height range instead of a false single number — and you should always double-check with your own eyes when you arrive.',
          },
          {
            q: 'What does wind exposure mean and how do you find the calmest beaches?',
            a: 'For each beach we look at the shoreline orientation and the surrounding terrain to work out whether today\'s wind blows onshore (exposed, with waves) or the land shelters it (leeward, calm water). That is how, on the same day, we can tell which beaches will be calm and which choppy — something a plain weather map will not.',
          },
          {
            q: 'How do you work out the wave height, and what does the graphic show?',
            a: 'We combine the marine forecast with a physical model of how much wave the wind can build at each beach, based on how much open water lies in front of it. The graphic shows a real-scale person (about 1.75 m) and how high the water reaches them, so you grasp the wave size at a glance. The stated height is the average of the bigger waves — occasional sets run higher.',
          },
          {
            q: 'Is CalmBeach free?',
            a: 'Yes, CalmBeach is completely free to use.',
          },
          {
            q: 'How often is the data updated?',
            a: 'The weather and sea forecast is live and refreshes several times a day. Beach details such as location, facilities and access are updated periodically.',
          },
          {
            q: 'Where does the data come from?',
            a: 'Weather and sea conditions come from the Open-Meteo forecast service. Beach details come from open data (OpenStreetMap) plus our own curation and checks. Accessible sea-access (Seatrac) points come from the official seatrac.gr directory.',
          },
          {
            q: 'How many beaches does CalmBeach cover?',
            a: 'CalmBeach covers over 2,500 beaches across Greece, and we keep adding and refining them.',
          },
          {
            q: 'Can I rely on it for swimming safety?',
            a: 'It gives a good sense of how calm or rough the sea will be, but it does not replace your own judgement or a lifeguard. Always watch the waves, currents and local signs — even small waves can create dangerous rip currents.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Best beaches in Greece today' },
          { href: '/accessible-beaches-greece/', label: 'Accessible beaches in Greece' },
        ],
      },
      el: {
        title: 'Συχνές ερωτήσεις | CalmBeach Greece',
        description: 'Συχνές ερωτήσεις για το CalmBeach: πόσο αξιόπιστη είναι η πρόγνωση, τι σημαίνει έκθεση σε άνεμο, πώς υπολογίζεται το κύμα, από πού είναι τα δεδομένα και ασφάλεια στο μπάνιο.',
        h1: 'Συχνές ερωτήσεις',
        intro: 'Το CalmBeach σε βοηθά να διαλέξεις ήρεμη παραλία για σήμερα, συγκρίνοντας άνεμο, κύμα, καιρό, έκθεση και πρόσβαση σε πάνω από 2.500 ελληνικές παραλίες. Εδώ είναι οι πιο συχνές ερωτήσεις.',
        sections: [],
        faq: [
          {
            q: 'Πόσο αξιόπιστη είναι η πρόγνωση του CalmBeach;',
            a: 'Ο άνεμος, το κύμα και η θερμοκρασία είναι ζωντανή μετεωρολογική πρόγνωση, όχι μέτρηση επί τόπου. Δείχνει τι είναι πιθανό να επικρατεί, γι\' αυτό είναι πιο ακριβής κοντά στη μέρα παρά μία βδομάδα μπροστά. Την παρουσιάζουμε όσο πιο τίμια γίνεται — π.χ. εύρος κύματος αντί για ένα δήθεν «σίγουρο» νούμερο — και καλό είναι να την ελέγχεις πάντα και με τα μάτια σου φτάνοντας.',
          },
          {
            q: 'Τι σημαίνει «έκθεση σε άνεμο» και πώς βρίσκετε τις πιο ήρεμες παραλίες;',
            a: 'Για κάθε παραλία κοιτάμε τον προσανατολισμό της ακτής και το γύρω ανάγλυφο, ώστε να δούμε αν ο σημερινός άνεμος φυσάει προς τα μέσα (εκτεθειμένη, με κύμα) ή αν η στεριά την προστατεύει (υπήνεμη, ήρεμα νερά). Έτσι, την ίδια μέρα, ξεχωρίζουμε ποιες παραλίες θα είναι ήρεμες και ποιες αγριεμένες — κάτι που ένας απλός χάρτης καιρού δεν σου λέει.',
          },
          {
            q: 'Πώς υπολογίζετε το ύψος κύματος και τι δείχνει το γραφικό;',
            a: 'Συνδυάζουμε τη θαλάσσια πρόγνωση με ένα φυσικό μοντέλο που εκτιμά πόσο κύμα μπορεί να χτίσει ο άνεμος σε κάθε παραλία, ανάλογα με το πόσο ανοιχτή θάλασσα έχει μπροστά της. Το γραφικό δείχνει έναν άνθρωπο σε πραγματική κλίμακα (περίπου 1,75 μ.) και μέχρι πού του φτάνει το νερό, ώστε να καταλαβαίνεις το μέγεθος του κύματος με μια ματιά. Το αναγραφόμενο ύψος είναι ο μέσος όρος των μεγαλύτερων κυμάτων — κατά διαστήματα κάποια σετ είναι ψηλότερα.',
          },
          {
            q: 'Είναι δωρεάν το CalmBeach;',
            a: 'Ναι, το CalmBeach είναι εντελώς δωρεάν.',
          },
          {
            q: 'Κάθε πότε ανανεώνονται τα δεδομένα;',
            a: 'Η πρόγνωση καιρού και θάλασσας είναι ζωντανή και ανανεώνεται πολλές φορές μέσα στην ημέρα. Τα στοιχεία των παραλιών (τοποθεσία, παροχές, πρόσβαση) ενημερώνονται περιοδικά.',
          },
          {
            q: 'Από πού προέρχονται τα δεδομένα;',
            a: 'Ο καιρός και η θάλασσα από την υπηρεσία πρόγνωσης Open-Meteo. Τα στοιχεία των παραλιών από ανοιχτά δεδομένα (OpenStreetMap) και δική μας επιμέλεια και έλεγχο. Τα σημεία πρόσβασης ΑμεΑ στη θάλασσα (Seatrac) από την επίσημη λίστα του seatrac.gr.',
          },
          {
            q: 'Πόσες παραλίες καλύπτει το CalmBeach;',
            a: 'Το CalmBeach καλύπτει πάνω από 2.500 παραλίες σε όλη την Ελλάδα, και συνεχώς προσθέτουμε και βελτιώνουμε.',
          },
          {
            q: 'Μπορώ να βασιστώ σε αυτό για ασφάλεια στο μπάνιο;',
            a: 'Δίνει καλή εικόνα του πόσο ήρεμη ή αγριεμένη θα είναι η θάλασσα, αλλά δεν αντικαθιστά την κρίση σου ή τον ναυαγοσώστη. Πρόσεχε πάντα τα κύματα, τα ρεύματα και τις τοπικές πινακίδες — ακόμη και μικρά κύματα μπορούν να δημιουργήσουν επικίνδυνα ρεύματα επαναφοράς.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach' },
          { href: '/best-beaches-greece-today/', label: 'Καλύτερες παραλίες σήμερα' },
          { href: '/accessible-beaches-greece/', label: 'Προσβάσιμες παραλίες ΑμεΑ' },
        ],
      },
    },
  },
  {
    pathName: '/best-beaches-greece-today/',
    kind: 'regionHub',
    locales: {
      en: {
        title: 'Best Beaches in Greece Today | CalmBeach',
        description: 'Compare Greek beaches by today\'s wind, waves, weather, exposure, access and beach type before choosing where to swim.',
        h1: 'Best beaches in Greece today',
        intro: 'CalmBeach helps you compare beach options across Greece using the conditions that matter for a swim today: wind, waves, weather, exposure, access and beach type.',
        sections: [
          {
            heading: 'How CalmBeach compares beaches',
            body: 'The app combines forecast conditions with static beach information so you can quickly see which beaches may be more suitable for the day. It avoids treating a famous beach as the best choice when wind or waves make another option more practical.',
          },
          {
            heading: 'What to check before you go',
            body: 'Look at the current wind direction, wind strength, wave height, beach exposure, access and amenities. Conditions can vary locally, so CalmBeach keeps recommendations cautious instead of promising perfect conditions.',
          },
        ],
        links: [
          { href: '/', label: 'Open today\'s beach recommendations' },
          { href: '/family-beaches-greece/', label: 'Family beaches in Greece' },
          { href: '/sheltered-beaches-meltemi/', label: 'Sheltered beaches in the Meltemi' },
          { href: '/faq/', label: 'How CalmBeach works (FAQ)' },
        ],
      },
      el: {
        title: 'Καλύτερες παραλίες στην Ελλάδα σήμερα | CalmBeach',
        description: 'Σύγκρινε ελληνικές παραλίες με βάση τον σημερινό άνεμο, το κύμα, τον καιρό, την έκθεση και την πρόσβαση πριν διαλέξεις πού θα κολυμπήσεις.',
        h1: 'Καλύτερες παραλίες στην Ελλάδα σήμερα',
        intro: 'Το CalmBeach σε βοηθά να συγκρίνεις παραλίες σε όλη την Ελλάδα με βάση αυτά που μετράνε για ένα μπάνιο σήμερα: άνεμος, κύμα, καιρός, έκθεση, πρόσβαση και τύπος παραλίας.',
        sections: [
          {
            heading: 'Πώς συγκρίνει τις παραλίες το CalmBeach',
            body: 'Η εφαρμογή συνδυάζει τις προγνώσεις με σταθερά στοιχεία κάθε παραλίας, ώστε να βλέπεις γρήγορα ποιες ταιριάζουν καλύτερα για τη μέρα. Δεν θεωρεί αυτόματα καλύτερη μια διάσημη παραλία όταν ο άνεμος ή το κύμα κάνουν μια άλλη πιο πρακτική.',
          },
          {
            heading: 'Τι να ελέγξεις πριν πας',
            body: 'Δες την κατεύθυνση και την ένταση του ανέμου, το ύψος κύματος, την έκθεση της παραλίας, την πρόσβαση και τις παροχές. Οι συνθήκες αλλάζουν τοπικά, γι\' αυτό οι προτάσεις μένουν προσεκτικές και δεν υπόσχονται τέλειες συνθήκες.',
          },
        ],
        links: [
          { href: '/', label: 'Δες τις σημερινές προτάσεις' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες' },
          { href: '/sheltered-beaches-meltemi/', label: 'Απάνεμες παραλίες με μελτέμι' },
          { href: '/faq/', label: 'Συχνές ερωτήσεις' },
        ],
      },
    },
  },
  {
    pathName: '/sheltered-beaches-meltemi/',
    kind: 'regionHub',
    locales: {
      en: {
        title: 'Sheltered Beaches in the Meltemi Winds | CalmBeach',
        description: 'Find more sheltered Greek beaches during the summer Meltemi winds. CalmBeach checks beach exposure against today\'s wind direction and strength.',
        h1: 'Sheltered beaches in the Meltemi',
        intro: 'In July and August the Meltemi can blow strong from the north across the Aegean. The right beach is usually one that is sheltered from the current wind direction, not simply the most popular one.',
        sections: [
          {
            heading: 'Which coasts stay calmer',
            body: 'When the Meltemi blows from the north, south and southwest-facing bays are often more protected, while exposed north coasts pick up wind and chop. The sheltered side changes with the wind direction, so CalmBeach checks exposure against today\'s forecast.',
          },
          {
            heading: 'A cautious recommendation',
            body: 'CalmBeach only endorses a beach as more sheltered when the exposure and forecast support it. On strong wind days it prefers caution and reminds you to follow local flags and lifeguard guidance.',
          },
        ],
        links: [
          { href: '/', label: 'Check today\'s recommendations' },
          { href: '/best-beaches-greece-today/', label: 'Best beaches in Greece today' },
          { href: '/beach-camping-greece/', label: 'Beaches with camping nearby' },
        ],
      },
      el: {
        title: 'Απάνεμες παραλίες με μελτέμι | CalmBeach',
        description: 'Βρες πιο απάνεμες ελληνικές παραλίες όταν φυσάει το μελτέμι. Το CalmBeach ελέγχει την έκθεση κάθε παραλίας σε σχέση με τον σημερινό άνεμο.',
        h1: 'Απάνεμες παραλίες με μελτέμι',
        intro: 'Τον Ιούλιο και τον Αύγουστο το μελτέμι φυσά δυνατά από τον βορρά στο Αιγαίο. Η σωστή παραλία είναι συνήθως αυτή που προστατεύεται από τη σημερινή κατεύθυνση του ανέμου, όχι απλώς η πιο δημοφιλής.',
        sections: [
          {
            heading: 'Ποιες ακτές μένουν πιο ήρεμες',
            body: 'Όταν το μελτέμι φυσά βόρεια, οι νότιοι και νοτιοδυτικοί κόλποι είναι συχνά πιο προστατευμένοι, ενώ οι εκτεθειμένες βόρειες ακτές πιάνουν αέρα και κύμα. Η υπήνεμη πλευρά αλλάζει με την κατεύθυνση, γι\' αυτό το CalmBeach ελέγχει την έκθεση με τη σημερινή πρόγνωση.',
          },
          {
            heading: 'Προσεκτική πρόταση',
            body: 'Το CalmBeach χαρακτηρίζει μια παραλία πιο υπήνεμη μόνο όταν το επιτρέπουν η έκθεση και η πρόγνωση. Σε μέρες με δυνατό αέρα προτιμά την προσοχή και θυμίζει να ακολουθείς τις τοπικές σημαίες και τον ναυαγοσώστη.',
          },
        ],
        links: [
          { href: '/', label: 'Δες τις σημερινές προτάσεις' },
          { href: '/best-beaches-greece-today/', label: 'Καλύτερες παραλίες σήμερα' },
          { href: '/beach-camping-greece/', label: 'Παραλίες με camping' },
        ],
      },
    },
  },
  {
    pathName: '/accessible-beaches-greece/',
    kind: 'beachList',
    category: 'accessible',
    locales: {
      en: {
        title: 'Accessible Beaches in Greece with Seatrac Sea Access | CalmBeach',
        description: 'Greek beaches with accessible facilities and Seatrac sea-access ramps where available, plus today’s live wind and sea. Always check locally.',
        h1: 'Accessible Beaches in Greece',
        intro: 'Find beaches in Greece with easier access information, wheelchair-friendly facilities, ramps, accessible paths or Seatrac-style access where this information is available. CalmBeach helps you compare beach conditions and choose a suitable beach for today.',
        trustNote: 'Accessibility information can change by season and municipality. Always check local signage or official local sources before visiting.',
        faqHeading: 'Accessible beaches FAQ',
        faq: [
          {
            q: 'How does CalmBeach identify accessible beaches?',
            a: 'CalmBeach uses accessibility-related fields already present in the current beach dataset, especially active Seatrac sea-access records and listed supporting amenities where available.',
          },
          {
            q: 'Are all accessible beaches in Greece listed here?',
            a: 'No. This guide only shows beaches with accessibility information currently available in CalmBeach, so the list may be incomplete.',
          },
          {
            q: 'Can accessibility information change?',
            a: 'Yes. Accessible equipment and facilities can change by season, municipality or maintenance status, so always confirm locally when accessibility is critical.',
          },
          {
            q: 'Can I also check wind and sea conditions?',
            a: 'Yes. Each beach card links to its CalmBeach detail page where available conditions, wind, waves and beach exposure help you decide whether it is suitable today.',
          },
        ],
        sections: [
          {
            heading: 'What the cards show',
            body: 'Cards highlight only accessibility details already stored for that beach, such as an online Seatrac sea-access ramp, accessible parking, a boardwalk to the water, accessible WC, changing room or shower when those fields are available.',
          },
          {
            heading: 'Conditions still matter',
            body: 'Even when access information looks useful, wind and waves can change comfort at the beach. Open a beach page to compare today\'s wind, waves, weather and exposure before you go.',
          },
        ],
        links: [
          { href: '#accessible-beach-list', label: 'Explore accessible beaches' },
          { href: '/', label: 'Best beaches today' },
          { href: '/best-beaches-greece-today/', label: 'Best beaches in Greece today' },
          { href: '/family-beaches-greece/', label: 'Family beaches with calmer water' },
          { href: '/beaches/milos/', label: 'Browse Milos beaches' },
        ],
      },
      el: {
        title: 'Προσβάσιμες παραλίες ΑμεΑ & Seatrac στην Ελλάδα | CalmBeach',
        description: 'Βρες ελληνικές παραλίες με υποδομές προσβασιμότητας για ΑμεΑ, όπως συστήματα Seatrac όπου υπάρχουν, και έλεγξε τις σημερινές συνθήκες της θάλασσας.',
        h1: 'Προσβάσιμες παραλίες ΑμεΑ',
        intro: 'Κάποιες ελληνικές παραλίες διαθέτουν υποδομές προσβασιμότητας, όπως ράμπες, προσβάσιμο πάρκινγκ ή συστήματα Seatrac για αυτόνομη πρόσβαση στη θάλασσα. Το CalmBeach σε βοηθά να τις βρεις και να δεις τον καιρό για τη μέρα.',
        sections: [
          {
            heading: 'Τι μπορεί να σημαίνει προσβασιμότητα',
            body: 'Η προσβασιμότητα διαφέρει ανά παραλία: πρόσβαση χωρίς σκαλιά, προσβάσιμο πάρκινγκ, διάδρομοι και συσκευές Seatrac που βοηθούν χρήστες αμαξιδίου να φτάσουν στο νερό. Επιβεβαίωσε πάντα ότι ο εξοπλισμός λειτουργεί πριν ταξιδέψεις.',
          },
          {
            heading: 'Οι συνθήκες πάλι μετράνε',
            body: 'Ακόμη και σε προσβάσιμη παραλία, ο άνεμος και το κύμα αλλάζουν την άνεση και την ασφάλεια. Το CalmBeach συνδυάζει τις πληροφορίες προσβασιμότητας με τον σημερινό άνεμο, το κύμα και την έκθεση, για να διαλέξεις πιο ήρεμη μέρα και σημείο.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες με ήρεμα νερά' },
          { href: '/best-beaches-greece-today/', label: 'Καλύτερες παραλίες σήμερα' },
        ],
      },
    },
  },
  {
    pathName: '/family-beaches-greece/',
    kind: 'beachList',
    category: 'family',
    locales: {
      en: {
        title: 'Family Beaches with Calm Shallow Water | CalmBeach',
        description: 'Look for family-friendly Greek beaches with calmer, shallower water and easy access, then check today\'s wind and waves before you go.',
        h1: 'Family beaches in Greece',
        intro: 'For young children, a calmer beach with shallow water and easy access often matters more than a famous name. CalmBeach helps you find family-friendly options and check the day\'s conditions.',
        sections: [
          {
            heading: 'What makes a beach family-friendly',
            body: 'Helpful features include shallow, gently shelving water, sand underfoot, shade or amenities nearby and easy access without a difficult path. CalmBeach surfaces these alongside the daily forecast.',
          },
          {
            heading: 'Pick a calmer day',
            body: 'Small waves and gusts that are fine for adults can be tiring for children. CalmBeach checks wind, waves and exposure so you can choose a more sheltered beach or a calmer time of day.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/accessible-beaches-greece/', label: 'Accessible beaches in Greece' },
          { href: '/beach-camping-greece/', label: 'Beaches with camping nearby' },
        ],
      },
      el: {
        title: 'Οικογενειακές παραλίες με ρηχά νερά | CalmBeach',
        description: 'Βρες οικογενειακές ελληνικές παραλίες με πιο ήρεμα, ρηχά νερά και εύκολη πρόσβαση, και έλεγξε τον σημερινό άνεμο και το κύμα πριν πας.',
        h1: 'Οικογενειακές παραλίες με ρηχά νερά',
        intro: 'Για μικρά παιδιά, μια πιο ήρεμη παραλία με ρηχά νερά και εύκολη πρόσβαση συχνά μετράει περισσότερο από ένα διάσημο όνομα. Το CalmBeach σε βοηθά να βρεις οικογενειακές επιλογές και να δεις τις συνθήκες της μέρας.',
        sections: [
          {
            heading: 'Τι κάνει μια παραλία κατάλληλη για οικογένειες',
            body: 'Βοηθούν τα ρηχά νερά με ομαλό βυθό, η άμμος, η σκιά ή οι κοντινές παροχές και η εύκολη πρόσβαση χωρίς δύσκολο μονοπάτι. Το CalmBeach τα δείχνει μαζί με τη σημερινή πρόγνωση.',
          },
          {
            heading: 'Διάλεξε πιο ήρεμη μέρα',
            body: 'Μικρά κύματα και ριπές που δεν ενοχλούν τους ενήλικες μπορεί να κουράζουν τα παιδιά. Το CalmBeach ελέγχει άνεμο, κύμα και έκθεση, ώστε να διαλέξεις πιο υπήνεμη παραλία ή πιο ήρεμη ώρα.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/accessible-beaches-greece/', label: 'Προσβάσιμες παραλίες ΑμεΑ' },
          { href: '/beach-camping-greece/', label: 'Παραλίες με camping' },
        ],
      },
    },
  },
  {
    pathName: '/beach-camping-greece/',
    kind: 'beachList',
    category: 'camping',
    locales: {
      en: {
        title: 'Beach Camping in Greece: Beaches with Campsites Nearby | CalmBeach',
        description: 'Greek beaches with an official campsite nearby, plus today’s live wind, waves and exposure to plan a calmer day by the sea.',
        h1: 'Beaches with camping nearby',
        intro: 'If you are travelling with a tent or campervan, a beach with a campsite nearby can shape the whole trip. CalmBeach links beaches to nearby campsites and shows the day\'s sea conditions.',
        sections: [
          {
            heading: 'Camping close to the sea',
            body: 'CalmBeach connects beaches to organised campsites within a short distance, so you can plan where to stay and swim together. It focuses on proper campsites rather than informal or prohibited spots.',
          },
          {
            heading: 'Check conditions before pitching',
            body: 'Exposed beaches can be windy for tents and choppy for swimming. Looking at wind direction, strength and exposure helps you pick a more sheltered base for the day.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Best beaches in Greece today' },
          { href: '/family-beaches-greece/', label: 'Family beaches with calmer water' },
        ],
      },
      el: {
        title: 'Παραλίες με camping κοντά στην Ελλάδα | CalmBeach',
        description: 'Βρες ελληνικές παραλίες με κάμπινγκ κοντά και έλεγξε τον σημερινό άνεμο, το κύμα και την έκθεση για να σχεδιάσεις μια πιο ήρεμη μέρα στη θάλασσα.',
        h1: 'Παραλίες με camping κοντά',
        intro: 'Αν ταξιδεύεις με σκηνή ή τροχόσπιτο, μια παραλία με κάμπινγκ κοντά μπορεί να καθορίσει όλο το ταξίδι. Το CalmBeach συνδέει παραλίες με κοντινά κάμπινγκ και δείχνει τις συνθήκες της θάλασσας για τη μέρα.',
        sections: [
          {
            heading: 'Κάμπινγκ δίπλα στη θάλασσα',
            body: 'Το CalmBeach συνδέει παραλίες με οργανωμένα κάμπινγκ σε μικρή απόσταση, ώστε να σχεδιάζεις μαζί πού θα μείνεις και πού θα κολυμπήσεις. Εστιάζει σε κανονικά κάμπινγκ, όχι σε άτυπες ή απαγορευμένες θέσεις.',
          },
          {
            heading: 'Έλεγξε τις συνθήκες πριν στήσεις',
            body: 'Οι εκτεθειμένες παραλίες μπορεί να έχουν αέρα για τις σκηνές και κύμα για το μπάνιο. Κοιτώντας κατεύθυνση, ένταση ανέμου και έκθεση, διαλέγεις πιο υπήνεμη βάση για τη μέρα.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Καλύτερες παραλίες σήμερα' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες με ήρεμα νερά' },
        ],
      },
    },
  },
];

// Programmatic per-island intent pages. Each (island × intent) page is generated
// ONLY when the island has at least ISLAND_INTENT_MIN matching beaches, so we
// never ship near-empty doorway pages. Copy is islandName-specific and the beach
// list is real, so each page is distinct from the national guide and from one
// another. `match` uses static, defensible signals (no live data on a static
// page): sheltered = oriented away from the northerly Meltemi; family = the
// curated family-friendly flag.
const ISLAND_INTENT_MIN = 5;
const ISLAND_INTENT_CAP = 40;
const NORTHERLY = ['North', 'Northeast', 'Northwest'];
const WESTERLY = ['West', 'Northwest', 'Southwest'];

const islandIntents = [
  {
    key: 'sheltered',
    pathPrefix: '/sheltered-beaches',
    match: beach => Array.isArray(beach.protectedFrom) && NORTHERLY.some(d => beach.protectedFrom.includes(d)),
    copy: (islandName, count) => ({
      en: {
        title: `Sheltered Beaches in ${islandName} for the Meltemi | CalmBeach`,
        description: `Find beaches in ${islandName} that face away from the northerly Meltemi winds, then check today's wind and waves on CalmBeach.`,
        h1: `Sheltered beaches in ${islandName}`,
        intro: `When the Meltemi blows from the north, the calmer beaches in ${islandName} are usually the bays oriented away from it. These ${count} beaches face away from northerly winds — still check today's forecast in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are sheltered from the Meltemi?`, body: `The south- and west-facing bays listed here are oriented away from northerly winds, so they tend to stay calmer when the Meltemi blows. Local conditions still vary, so confirm with today's forecast.` },
          { heading: 'Is the sea always calm at these beaches?', body: 'No. Orientation shows which way a coast faces, not guaranteed shelter or low waves. On strong-wind days follow local flags and check live wind and waves in the app.' },
        ],
      },
      gr: {
        title: `${islandName}: απάνεμες παραλίες με μελτέμι | CalmBeach`,
        description: `Παραλίες που κοιτούν μακριά από το βόρειο μελτέμι — ${islandName}. Έλεγξε τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        h1: `Απάνεμες παραλίες με μελτέμι — ${islandName}`,
        intro: `Όταν φυσά το μελτέμι από τον βορρά, οι πιο ήρεμες επιλογές εδώ (${islandName}) είναι συνήθως οι κόλποι που κοιτούν μακριά του. Αυτές οι ${count} παραλίες έχουν προσανατολισμό μακριά από βόρειους ανέμους — δες πάντα τη σημερινή πρόγνωση στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι απάνεμες με μελτέμι;`, body: `Οι νότιοι και δυτικοί κόλποι της λίστας έχουν προσανατολισμό μακριά από βόρειους ανέμους, οπότε μένουν συνήθως πιο ήρεμοι όταν φυσά το μελτέμι. Οι συνθήκες αλλάζουν τοπικά, γι' αυτό επιβεβαίωσε με τη σημερινή πρόγνωση.` },
          { heading: 'Είναι πάντα ήρεμη η θάλασσα σε αυτές τις παραλίες;', body: 'Όχι. Ο προσανατολισμός δείχνει την πλευρά της ακτής, όχι εγγυημένη προστασία ή χαμηλό κύμα. Σε μέρες με δυνατό αέρα ακολούθησε τις τοπικές σημαίες και έλεγξε live άνεμο και κύμα στην εφαρμογή.' },
        ],
      },
      de: {
        title: `Windgeschützte Strände auf ${islandName} beim Meltemi | CalmBeach`,
        description: `Finde Strände auf ${islandName}, die vom nördlichen Meltemi abgewandt sind, und prüfe dann Wind und Wellen von heute auf CalmBeach.`,
        h1: `Windgeschützte Strände auf ${islandName}`,
        intro: `Wenn der Meltemi aus dem Norden weht, sind die ruhigeren Strände auf ${islandName} meist die Buchten, die von ihm abgewandt liegen. Diese ${count} Strände sind von Nordwinden abgewandt – prüfe trotzdem die heutige Vorhersage in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind beim Meltemi windgeschützt?`, body: `Die hier gelisteten, nach Süden und Westen ausgerichteten Buchten liegen abgewandt von Nordwinden und bleiben daher meist ruhiger, wenn der Meltemi weht. Die Bedingungen ändern sich örtlich, prüfe also die heutige Vorhersage.` },
          { heading: 'Ist das Meer an diesen Stränden immer ruhig?', body: 'Nein. Die Ausrichtung zeigt, wohin eine Küste blickt, keinen garantierten Schutz und keine niedrigen Wellen. An windigen Tagen folge den örtlichen Flaggen und prüfe Wind und Wellen live in der App.' },
        ],
      },
      fr: {
        title: `Plages abritées à ${islandName} par vent meltemi | CalmBeach`,
        description: `Trouvez à ${islandName} des plages orientées à l'abri du meltemi de nord, puis vérifiez le vent et les vagues du jour sur CalmBeach.`,
        h1: `Plages abritées à ${islandName}`,
        intro: `Quand le meltemi souffle du nord, les plages les plus calmes à ${islandName} sont généralement les baies orientées à l'opposé. Ces ${count} plages sont abritées des vents de nord — vérifiez tout de même la prévision du jour dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont abritées du meltemi ?`, body: `Les baies orientées au sud et à l'ouest listées ici sont tournées à l'opposé des vents de nord et restent donc généralement plus calmes quand le meltemi souffle. Les conditions varient localement, confirmez avec la prévision du jour.` },
          { heading: 'La mer est-elle toujours calme sur ces plages ?', body: "Non. L'orientation indique vers où la côte est tournée, pas un abri garanti ni des vagues faibles. Les jours de vent fort, suivez les drapeaux locaux et vérifiez le vent et les vagues en direct dans l'application." },
        ],
      },
      it: {
        title: `Spiagge riparate a ${islandName} dal meltemi | CalmBeach`,
        description: `Trova a ${islandName} spiagge orientate al riparo dal meltemi da nord, poi controlla vento e onde di oggi su CalmBeach.`,
        h1: `Spiagge riparate a ${islandName}`,
        intro: `Quando il meltemi soffia da nord, le spiagge più tranquille a ${islandName} sono di solito le insenature orientate dalla parte opposta. Queste ${count} spiagge sono riparate dai venti di nord — controlla comunque le previsioni di oggi in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono riparate dal meltemi?`, body: `Le insenature esposte a sud e a ovest elencate qui sono orientate lontano dai venti di nord, quindi di solito restano più tranquille quando soffia il meltemi. Le condizioni variano localmente, conferma con le previsioni di oggi.` },
          { heading: 'Il mare è sempre calmo in queste spiagge?', body: "No. L'orientamento indica verso dove guarda la costa, non un riparo garantito o onde basse. Nei giorni di vento forte segui le bandiere locali e controlla vento e onde in tempo reale nell'app." },
        ],
      },
    }),
  },
  {
    key: 'family',
    pathPrefix: '/family-beaches',
    match: beach => beach.environment?.familyFriendly === true,
    copy: (islandName, count) => ({
      en: {
        title: `Family Beaches in ${islandName} with Calm, Shallow Water | CalmBeach`,
        description: `Family-friendly beaches in ${islandName} with calmer, shallower water and easier access. Check today's wind and waves on CalmBeach.`,
        h1: `Family beaches in ${islandName}`,
        intro: `Travelling with young children in ${islandName}? These ${count} family-friendly beaches tend to have calmer, shallower water and easier access. Check today's wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are best for families?`, body: 'The beaches listed here are marked family-friendly, usually with shallower water and easier access. For small children, pick a calmer, more sheltered day.' },
          { heading: 'How do I know the sea will be calm enough?', body: 'CalmBeach checks wind, waves and exposure for the day, so you can choose a more sheltered beach or a calmer time of day.' },
        ],
      },
      gr: {
        title: `${islandName}: οικογενειακές παραλίες με ρηχά νερά | CalmBeach`,
        description: `Οικογενειακές παραλίες με πιο ήρεμα, ρηχά νερά και ευκολότερη πρόσβαση — ${islandName}. Έλεγξε τον σημερινό άνεμο και το κύμα στο CalmBeach.`,
        h1: `Οικογενειακές παραλίες με ρηχά νερά — ${islandName}`,
        intro: `Ταξιδεύεις με μικρά παιδιά; Αυτές οι ${count} οικογενειακές παραλίες εδώ (${islandName}) έχουν συνήθως πιο ήρεμα, ρηχά νερά και ευκολότερη πρόσβαση. Δες τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι καλές για οικογένειες;`, body: 'Οι παραλίες της λίστας είναι σημειωμένες ως οικογενειακές, συνήθως με ρηχότερα νερά και ευκολότερη πρόσβαση. Για μικρά παιδιά, διάλεξε πιο ήρεμη και υπήνεμη μέρα.' },
          { heading: 'Πώς ξέρω ότι η θάλασσα θα είναι αρκετά ήρεμη;', body: 'Το CalmBeach ελέγχει άνεμο, κύμα και έκθεση για τη μέρα, ώστε να διαλέξεις πιο υπήνεμη παραλία ή πιο ήρεμη ώρα.' },
        ],
      },
      de: {
        title: `Familienstrände auf ${islandName} mit ruhigem, flachem Wasser | CalmBeach`,
        description: `Familienfreundliche Strände auf ${islandName} mit ruhigerem, flacherem Wasser und einfacherem Zugang. Prüfe Wind und Wellen von heute auf CalmBeach.`,
        h1: `Familienstrände auf ${islandName}`,
        intro: `Unterwegs mit kleinen Kindern auf ${islandName}? Diese ${count} familienfreundlichen Strände haben meist ruhigeres, flacheres Wasser und einfacheren Zugang. Prüfe Wind und Wellen von heute in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} eignen sich am besten für Familien?`, body: 'Die hier gelisteten Strände sind als familienfreundlich markiert, meist mit flacherem Wasser und einfacherem Zugang. Für kleine Kinder wähle einen ruhigeren, windgeschützteren Tag.' },
          { heading: 'Woher weiß ich, dass das Meer ruhig genug ist?', body: 'CalmBeach prüft Wind, Wellen und Lage für den Tag, sodass du einen geschützteren Strand oder eine ruhigere Tageszeit wählen kannst.' },
        ],
      },
      fr: {
        title: `Plages familiales à ${islandName} à l'eau calme et peu profonde | CalmBeach`,
        description: `Plages adaptées aux familles à ${islandName}, à l'eau plus calme et peu profonde et d'accès facile. Vérifiez le vent et les vagues du jour sur CalmBeach.`,
        h1: `Plages familiales à ${islandName}`,
        intro: `Vous voyagez avec de jeunes enfants à ${islandName} ? Ces ${count} plages familiales ont généralement une eau plus calme et peu profonde et un accès plus facile. Vérifiez le vent et les vagues du jour dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} conviennent le mieux aux familles ?`, body: "Les plages listées ici sont marquées comme familiales, généralement avec une eau moins profonde et un accès plus facile. Pour les jeunes enfants, choisissez une journée plus calme et plus abritée." },
          { heading: 'Comment savoir si la mer sera assez calme ?', body: "CalmBeach vérifie le vent, les vagues et l'exposition du jour, pour choisir une plage plus abritée ou un moment plus calme de la journée." },
        ],
      },
      it: {
        title: `Spiagge per famiglie a ${islandName} con acqua calma e bassa | CalmBeach`,
        description: `Spiagge adatte alle famiglie a ${islandName}, con acqua più calma e bassa e accesso più facile. Controlla vento e onde di oggi su CalmBeach.`,
        h1: `Spiagge per famiglie a ${islandName}`,
        intro: `Viaggi con bambini piccoli a ${islandName}? Queste ${count} spiagge per famiglie hanno di solito acqua più calma e bassa e un accesso più facile. Controlla vento e onde di oggi in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono migliori per le famiglie?`, body: 'Le spiagge elencate qui sono indicate come adatte alle famiglie, di solito con acqua più bassa e accesso più facile. Per i bambini piccoli, scegli una giornata più calma e riparata.' },
          { heading: 'Come faccio a sapere che il mare sarà abbastanza calmo?', body: 'CalmBeach controlla vento, onde ed esposizione per la giornata, così puoi scegliere una spiaggia più riparata o un momento più tranquillo.' },
        ],
      },
    }),
  },
  {
    key: 'snorkeling',
    pathPrefix: '/snorkeling-beaches',
    match: beach => beach.activities?.snorkeling === true,
    copy: (islandName, count) => ({
      en: {
        title: `Best Snorkeling Beaches in ${islandName} | Clear Water & Rocks | CalmBeach`,
        description: `Beaches in ${islandName} with clearer water and rocky seabed for snorkeling. Check today's wind and waves on CalmBeach before you go.`,
        h1: `Snorkeling beaches in ${islandName}`,
        intro: `Want clear water and rocks to explore in ${islandName}? These ${count} beaches are good for snorkeling, usually with clearer water and a rocky or mixed seabed. Visibility is best on calm, low-wind days — check today's wind and waves in CalmBeach first.`,
        sections: [
          { heading: `Which beaches in ${islandName} are best for snorkeling?`, body: 'The beaches listed here have rockier seabed and clearer water, where you are more likely to see fish and underwater life. Conditions vary, so confirm with the day\'s forecast.' },
          { heading: 'When is snorkeling safest?', body: 'Snorkel close to shore on calm days and avoid strong wind, waves or currents. Check live wind and waves in the app and follow any local flags.' },
        ],
      },
      gr: {
        title: `${islandName}: καλύτερες παραλίες για snorkeling | CalmBeach`,
        description: `Παραλίες με καθαρότερα νερά και βραχώδη βυθό για snorkeling — ${islandName}. Έλεγξε τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        h1: `Παραλίες για snorkeling — ${islandName}`,
        intro: `Ψάχνεις καθαρά νερά και βράχια για εξερεύνηση; Αυτές οι ${count} παραλίες εδώ (${islandName}) είναι καλές για snorkeling, συνήθως με πιο καθαρά νερά και βραχώδη ή μικτό βυθό. Η ορατότητα είναι καλύτερη σε ήρεμες μέρες με λίγο αέρα — δες πρώτα τον σημερινό άνεμο και το κύμα στο CalmBeach.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι καλές για snorkeling;`, body: 'Οι παραλίες της λίστας έχουν πιο βραχώδη βυθό και καθαρότερα νερά, όπου είναι πιο πιθανό να δεις ψάρια και υποθαλάσσια ζωή. Οι συνθήκες αλλάζουν, γι\' αυτό επιβεβαίωσε με τη σημερινή πρόγνωση.' },
          { heading: 'Πότε είναι ασφαλέστερο το snorkeling;', body: 'Κάνε snorkeling κοντά στην ακτή σε ήρεμες μέρες και απόφυγε δυνατό αέρα, κύμα ή ρεύματα. Έλεγξε live άνεμο και κύμα στην εφαρμογή και ακολούθησε τυχόν τοπικές σημαίες.' },
        ],
      },
      de: {
        title: `Beste Schnorchelstrände auf ${islandName} | Klares Wasser & Felsen | CalmBeach`,
        description: `Strände auf ${islandName} mit klarerem Wasser und felsigem Grund zum Schnorcheln. Prüfe Wind und Wellen von heute auf CalmBeach.`,
        h1: `Schnorchelstrände auf ${islandName}`,
        intro: `Du suchst klares Wasser und Felsen zum Erkunden auf ${islandName}? Diese ${count} Strände eignen sich zum Schnorcheln, meist mit klarerem Wasser und felsigem oder gemischtem Grund. Die Sicht ist an ruhigen, windarmen Tagen am besten – prüfe zuerst Wind und Wellen von heute in CalmBeach.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} eignen sich am besten zum Schnorcheln?`, body: 'Die hier gelisteten Strände haben felsigeren Grund und klareres Wasser, wo du eher Fische und Unterwasserleben siehst. Die Bedingungen ändern sich, prüfe also die heutige Vorhersage.' },
          { heading: 'Wann ist Schnorcheln am sichersten?', body: 'Schnorchle an ruhigen Tagen ufernah und meide starken Wind, Wellen oder Strömungen. Prüfe Wind und Wellen live in der App und folge örtlichen Flaggen.' },
        ],
      },
      fr: {
        title: `Meilleures plages de snorkeling à ${islandName} | Eau claire & rochers | CalmBeach`,
        description: `Plages à ${islandName} à l'eau plus claire et au fond rocheux pour le snorkeling. Vérifiez le vent et les vagues du jour sur CalmBeach.`,
        h1: `Plages de snorkeling à ${islandName}`,
        intro: `Vous cherchez une eau claire et des rochers à explorer à ${islandName} ? Ces ${count} plages se prêtent au snorkeling, généralement avec une eau plus claire et un fond rocheux ou mixte. La visibilité est meilleure les jours calmes et peu ventés — vérifiez d'abord le vent et les vagues du jour dans CalmBeach.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont les meilleures pour le snorkeling ?`, body: 'Les plages listées ici ont un fond plus rocheux et une eau plus claire, où vous avez plus de chances de voir des poissons et la vie sous-marine. Les conditions varient, confirmez avec la prévision du jour.' },
          { heading: 'Quand le snorkeling est-il le plus sûr ?', body: 'Faites du snorkeling près du rivage les jours calmes et évitez vent fort, vagues ou courants. Vérifiez le vent et les vagues en direct dans l\'application et suivez les drapeaux locaux.' },
        ],
      },
      it: {
        title: `Migliori spiagge per snorkeling a ${islandName} | Acqua limpida e scogli | CalmBeach`,
        description: `Spiagge a ${islandName} con acqua più limpida e fondale roccioso per lo snorkeling. Controlla vento e onde di oggi su CalmBeach.`,
        h1: `Spiagge per snorkeling a ${islandName}`,
        intro: `Cerchi acqua limpida e scogli da esplorare a ${islandName}? Queste ${count} spiagge sono adatte allo snorkeling, di solito con acqua più limpida e fondale roccioso o misto. La visibilità è migliore nei giorni calmi e poco ventosi — controlla prima vento e onde di oggi in CalmBeach.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono migliori per lo snorkeling?`, body: 'Le spiagge elencate qui hanno fondale più roccioso e acqua più limpida, dove è più probabile vedere pesci e vita sottomarina. Le condizioni variano, conferma con le previsioni di oggi.' },
          { heading: 'Quando è più sicuro fare snorkeling?', body: 'Fai snorkeling vicino alla riva nei giorni calmi ed evita vento forte, onde o correnti. Controlla vento e onde in tempo reale nell\'app e segui le bandiere locali.' },
        ],
      },
    }),
  },
  {
    key: 'organized',
    pathPrefix: '/organized-beaches',
    match: beach => beach.amenities?.organized === true,
    copy: (islandName, count) => ({
      en: {
        title: `Organized Beaches in ${islandName} with Sunbeds & Facilities | CalmBeach`,
        description: `Organized beaches in ${islandName} with sunbeds, umbrellas and facilities. Check today's wind and waves on CalmBeach before you go.`,
        h1: `Organized beaches in ${islandName}`,
        intro: `Prefer sunbeds, umbrellas and a beach bar in ${islandName}? These ${count} organized beaches usually have facilities and easier access. Check today's wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are organized?`, body: 'The beaches listed here are marked as organized, usually with sunbeds, umbrellas and food or a beach bar nearby. Facilities can change by season, so confirm locally.' },
          { heading: 'Are organized beaches calmer?', body: 'Not necessarily. Facilities do not change the wind or waves — check live conditions in the app and pick a more sheltered beach on windy days.' },
        ],
      },
      gr: {
        title: `${islandName}: οργανωμένες παραλίες με ξαπλώστρες | CalmBeach`,
        description: `Οργανωμένες παραλίες με ξαπλώστρες, ομπρέλες και παροχές — ${islandName}. Έλεγξε τον σημερινό άνεμο και το κύμα στο CalmBeach.`,
        h1: `Οργανωμένες παραλίες — ${islandName}`,
        intro: `Προτιμάς ξαπλώστρες, ομπρέλες και beach bar; Αυτές οι ${count} οργανωμένες παραλίες εδώ (${islandName}) έχουν συνήθως παροχές και ευκολότερη πρόσβαση. Δες τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι οργανωμένες;`, body: 'Οι παραλίες της λίστας είναι σημειωμένες ως οργανωμένες, συνήθως με ξαπλώστρες, ομπρέλες και φαγητό ή beach bar κοντά. Οι παροχές αλλάζουν ανά εποχή, γι\' αυτό επιβεβαίωσε επιτόπου.' },
          { heading: 'Είναι πιο ήρεμες οι οργανωμένες παραλίες;', body: 'Όχι απαραίτητα. Οι παροχές δεν αλλάζουν τον άνεμο ή το κύμα — έλεγξε live συνθήκες στην εφαρμογή και διάλεξε πιο υπήνεμη παραλία τις μέρες με αέρα.' },
        ],
      },
      de: {
        title: `Organisierte Strände auf ${islandName} mit Liegen & Einrichtungen | CalmBeach`,
        description: `Organisierte Strände auf ${islandName} mit Liegen, Sonnenschirmen und Einrichtungen. Prüfe Wind und Wellen von heute auf CalmBeach.`,
        h1: `Organisierte Strände auf ${islandName}`,
        intro: `Du bevorzugst Liegen, Sonnenschirme und eine Beach Bar auf ${islandName}? Diese ${count} organisierten Strände bieten meist Einrichtungen und einfacheren Zugang. Prüfe Wind und Wellen von heute in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind organisiert?`, body: 'Die hier gelisteten Strände sind als organisiert markiert, meist mit Liegen, Sonnenschirmen und Essen oder einer Beach Bar in der Nähe. Die Einrichtungen ändern sich je nach Saison, bestätige sie vor Ort.' },
          { heading: 'Sind organisierte Strände ruhiger?', body: 'Nicht unbedingt. Einrichtungen ändern Wind oder Wellen nicht – prüfe die Live-Bedingungen in der App und wähle an windigen Tagen einen geschützteren Strand.' },
        ],
      },
      fr: {
        title: `Plages aménagées à ${islandName} avec transats et services | CalmBeach`,
        description: `Plages aménagées à ${islandName} avec transats, parasols et services. Vérifiez le vent et les vagues du jour sur CalmBeach.`,
        h1: `Plages aménagées à ${islandName}`,
        intro: `Vous préférez transats, parasols et un bar de plage à ${islandName} ? Ces ${count} plages aménagées offrent généralement des services et un accès plus facile. Vérifiez le vent et les vagues du jour dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont aménagées ?`, body: 'Les plages listées ici sont marquées comme aménagées, généralement avec transats, parasols et restauration ou un bar de plage à proximité. Les services changent selon la saison, confirmez sur place.' },
          { heading: 'Les plages aménagées sont-elles plus calmes ?', body: 'Pas forcément. Les services ne changent ni le vent ni les vagues — vérifiez les conditions en direct dans l\'application et choisissez une plage plus abritée les jours de vent.' },
        ],
      },
      it: {
        title: `Spiagge attrezzate a ${islandName} con lettini e servizi | CalmBeach`,
        description: `Spiagge attrezzate a ${islandName} con lettini, ombrelloni e servizi. Controlla vento e onde di oggi su CalmBeach.`,
        h1: `Spiagge attrezzate a ${islandName}`,
        intro: `Preferisci lettini, ombrelloni e un beach bar a ${islandName}? Queste ${count} spiagge attrezzate hanno di solito servizi e un accesso più facile. Controlla vento e onde di oggi in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono attrezzate?`, body: 'Le spiagge elencate qui sono indicate come attrezzate, di solito con lettini, ombrelloni e ristoro o un beach bar nelle vicinanze. I servizi cambiano con la stagione, conferma sul posto.' },
          { heading: 'Le spiagge attrezzate sono più tranquille?', body: 'Non necessariamente. I servizi non cambiano vento o onde — controlla le condizioni in tempo reale nell\'app e scegli una spiaggia più riparata nei giorni ventosi.' },
        ],
      },
    }),
  },
  {
    key: 'secluded',
    pathPrefix: '/secluded-beaches',
    match: beach => beach.environment?.remote === true,
    copy: (islandName, count) => ({
      en: {
        title: `Secluded Beaches in ${islandName} Away from the Crowds | CalmBeach`,
        description: `Quiet, remote beaches in ${islandName} away from the crowds. Check access, wind and waves on CalmBeach before you go.`,
        h1: `Secluded beaches in ${islandName}`,
        intro: `Looking to escape the crowds in ${islandName}? These ${count} remote beaches are quieter and harder to reach — often by dirt road, on foot or by boat. Bring water and shade, and check today's wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are the most secluded?`, body: 'The beaches listed here are remote and usually have no facilities. Access can be rough — a dirt track, a hike or boat-only — so plan ahead and bring supplies.' },
          { heading: 'Are remote beaches safe to swim?', body: 'Remote beaches have no lifeguards or services. Swim only in calm conditions, never alone in big waves, and check live wind and waves in the app first.' },
        ],
      },
      gr: {
        title: `${islandName}: απομονωμένες παραλίες χωρίς κόσμο | CalmBeach`,
        description: `Ήσυχες, απομονωμένες παραλίες μακριά από τον κόσμο — ${islandName}. Έλεγξε πρόσβαση, άνεμο και κύμα στο CalmBeach πριν πας.`,
        h1: `Απομονωμένες παραλίες — ${islandName}`,
        intro: `Θες να ξεφύγεις από τον κόσμο; Αυτές οι ${count} απομακρυσμένες παραλίες εδώ (${islandName}) είναι πιο ήσυχες και πιο δύσκολες στην πρόσβαση — συχνά με χωματόδρομο, με τα πόδια ή με σκάφος. Φέρε νερό και σκιά, και δες τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι οι πιο απομονωμένες;`, body: 'Οι παραλίες της λίστας είναι απομακρυσμένες και συνήθως χωρίς παροχές. Η πρόσβαση μπορεί να είναι δύσκολη — χωματόδρομος, πεζοπορία ή μόνο με σκάφος — οπότε προγραμμάτισε και φέρε προμήθειες.' },
          { heading: 'Είναι ασφαλές το μπάνιο σε απομονωμένες παραλίες;', body: 'Οι απομονωμένες παραλίες δεν έχουν ναυαγοσώστη ή υπηρεσίες. Κολύμπησε μόνο σε ήρεμες συνθήκες, ποτέ μόνος σε μεγάλο κύμα, και έλεγξε πρώτα live άνεμο και κύμα στην εφαρμογή.' },
        ],
      },
      de: {
        title: `Abgelegene Strände auf ${islandName} abseits der Menschenmengen | CalmBeach`,
        description: `Ruhige, abgelegene Strände auf ${islandName} abseits der Menschenmengen. Prüfe Zugang, Wind und Wellen auf CalmBeach.`,
        h1: `Abgelegene Strände auf ${islandName}`,
        intro: `Du möchtest den Menschenmengen auf ${islandName} entkommen? Diese ${count} abgelegenen Strände sind ruhiger und schwerer erreichbar – oft über Schotterpiste, zu Fuß oder per Boot. Bring Wasser und Schatten mit und prüfe Wind und Wellen von heute in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind am abgelegensten?`, body: 'Die hier gelisteten Strände sind abgelegen und haben meist keine Einrichtungen. Der Zugang kann rau sein – Schotterpiste, Wanderung oder nur per Boot – plane also voraus und bring Vorräte mit.' },
          { heading: 'Ist Schwimmen an abgelegenen Stränden sicher?', body: 'Abgelegene Strände haben keine Rettungsschwimmer oder Dienste. Schwimme nur bei ruhigen Bedingungen, nie allein bei hohen Wellen, und prüfe zuerst Wind und Wellen live in der App.' },
        ],
      },
      fr: {
        title: `Plages isolées à ${islandName} loin de la foule | CalmBeach`,
        description: `Plages calmes et isolées à ${islandName}, loin de la foule. Vérifiez l'accès, le vent et les vagues sur CalmBeach.`,
        h1: `Plages isolées à ${islandName}`,
        intro: `Vous voulez échapper à la foule à ${islandName} ? Ces ${count} plages isolées sont plus calmes et plus difficiles d'accès — souvent par piste, à pied ou en bateau. Apportez eau et ombre, et vérifiez le vent et les vagues du jour dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont les plus isolées ?`, body: 'Les plages listées ici sont isolées et généralement sans services. L\'accès peut être difficile — piste, randonnée ou bateau uniquement — alors prévoyez et apportez des provisions.' },
          { heading: 'Peut-on se baigner en sécurité sur les plages isolées ?', body: 'Les plages isolées n\'ont ni surveillants ni services. Ne nagez que par conditions calmes, jamais seul dans de grosses vagues, et vérifiez d\'abord le vent et les vagues en direct dans l\'application.' },
        ],
      },
      it: {
        title: `Spiagge isolate a ${islandName} lontano dalla folla | CalmBeach`,
        description: `Spiagge tranquille e isolate a ${islandName}, lontano dalla folla. Controlla accesso, vento e onde su CalmBeach.`,
        h1: `Spiagge isolate a ${islandName}`,
        intro: `Vuoi sfuggire alla folla a ${islandName}? Queste ${count} spiagge isolate sono più tranquille e più difficili da raggiungere — spesso su strada sterrata, a piedi o in barca. Porta acqua e ombra e controlla vento e onde di oggi in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono le più isolate?`, body: 'Le spiagge elencate qui sono isolate e di solito senza servizi. L\'accesso può essere difficile — sterrato, sentiero o solo in barca — quindi pianifica e porta provviste.' },
          { heading: 'È sicuro nuotare nelle spiagge isolate?', body: 'Le spiagge isolate non hanno bagnini o servizi. Nuota solo in condizioni calme, mai da solo con onde alte, e controlla prima vento e onde in tempo reale nell\'app.' },
        ],
      },
    }),
  },
  {
    key: 'sunset',
    pathPrefix: '/sunset-beaches',
    match: beach => Array.isArray(beach.orientation?.faces) && WESTERLY.some(d => beach.orientation.faces.includes(d)),
    copy: (islandName, count) => ({
      en: {
        title: `Best Sunset Beaches in ${islandName} Facing West | CalmBeach`,
        description: `West-facing beaches in ${islandName} with great sunset views. Check today's wind and waves on CalmBeach before you go.`,
        h1: `Sunset beaches in ${islandName}`,
        intro: `Want to watch the sun go down over the sea in ${islandName}? These ${count} west-facing beaches look out toward the sunset. Time your visit for late afternoon — and check today's wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} have the best sunsets?`, body: 'The beaches listed here face west or southwest, so the sun sets over the water in front of you. Arrive before sunset to find a spot and enjoy the light.' },
          { heading: 'Anything to know for an evening visit?', body: 'Wind can pick up or drop in the evening, and remote beaches have no lights. Check live wind and waves in the app and bring a torch for the walk back.' },
        ],
      },
      gr: {
        title: `${islandName}: καλύτερες παραλίες για ηλιοβασίλεμα | CalmBeach`,
        description: `Δυτικές παραλίες με θέα στο ηλιοβασίλεμα — ${islandName}. Έλεγξε τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        h1: `Παραλίες για ηλιοβασίλεμα — ${islandName}`,
        intro: `Θες να δεις τον ήλιο να δύει στη θάλασσα; Αυτές οι ${count} δυτικές παραλίες εδώ (${islandName}) κοιτούν προς το ηλιοβασίλεμα. Προγραμμάτισε την επίσκεψη αργά το απόγευμα — και δες τον σημερινό άνεμο και το κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες έχουν το καλύτερο ηλιοβασίλεμα;`, body: 'Οι παραλίες της λίστας κοιτούν δυτικά ή νοτιοδυτικά, οπότε ο ήλιος δύει πάνω από τη θάλασσα μπροστά σου. Έλα πριν τη δύση για να βρεις θέση και να απολαύσεις το φως.' },
          { heading: 'Τι να προσέξω για βραδινή επίσκεψη;', body: 'Ο αέρας μπορεί να δυναμώσει ή να πέσει το βράδυ, και οι απομακρυσμένες παραλίες δεν έχουν φωτισμό. Έλεγξε live άνεμο και κύμα στην εφαρμογή και πάρε φακό για την επιστροφή.' },
        ],
      },
      de: {
        title: `Beste Sonnenuntergangsstrände auf ${islandName} nach Westen | CalmBeach`,
        description: `Nach Westen ausgerichtete Strände auf ${islandName} mit tollem Sonnenuntergang. Prüfe Wind und Wellen von heute auf CalmBeach.`,
        h1: `Sonnenuntergangsstrände auf ${islandName}`,
        intro: `Du möchtest die Sonne über dem Meer auf ${islandName} untergehen sehen? Diese ${count} nach Westen ausgerichteten Strände blicken zum Sonnenuntergang. Plane deinen Besuch für den späten Nachmittag – und prüfe Wind und Wellen von heute in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} haben die schönsten Sonnenuntergänge?`, body: 'Die hier gelisteten Strände sind nach Westen oder Südwesten ausgerichtet, sodass die Sonne über dem Wasser vor dir untergeht. Komm vor Sonnenuntergang, um einen Platz zu finden und das Licht zu genießen.' },
          { heading: 'Was sollte ich für einen Besuch am Abend wissen?', body: 'Der Wind kann abends auffrischen oder nachlassen, und abgelegene Strände haben kein Licht. Prüfe Wind und Wellen live in der App und bring eine Taschenlampe für den Rückweg mit.' },
        ],
      },
      fr: {
        title: `Meilleures plages de coucher de soleil à ${islandName} face à l'ouest | CalmBeach`,
        description: `Plages orientées à l'ouest à ${islandName} avec une belle vue sur le coucher de soleil. Vérifiez le vent et les vagues du jour sur CalmBeach.`,
        h1: `Plages de coucher de soleil à ${islandName}`,
        intro: `Envie de voir le soleil se coucher sur la mer à ${islandName} ? Ces ${count} plages orientées à l'ouest donnent vers le coucher de soleil. Prévoyez votre visite en fin d'après-midi — et vérifiez le vent et les vagues du jour dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} offrent les plus beaux couchers de soleil ?`, body: 'Les plages listées ici sont orientées à l\'ouest ou au sud-ouest, le soleil se couche donc sur l\'eau devant vous. Arrivez avant le coucher pour trouver une place et profiter de la lumière.' },
          { heading: 'À savoir pour une visite en soirée ?', body: 'Le vent peut se lever ou tomber le soir, et les plages isolées n\'ont pas d\'éclairage. Vérifiez le vent et les vagues en direct dans l\'application et emportez une lampe pour le retour.' },
        ],
      },
      it: {
        title: `Migliori spiagge per il tramonto a ${islandName} esposte a ovest | CalmBeach`,
        description: `Spiagge esposte a ovest a ${islandName} con bella vista sul tramonto. Controlla vento e onde di oggi su CalmBeach.`,
        h1: `Spiagge per il tramonto a ${islandName}`,
        intro: `Vuoi vedere il sole tramontare sul mare a ${islandName}? Queste ${count} spiagge esposte a ovest guardano verso il tramonto. Programma la visita nel tardo pomeriggio — e controlla vento e onde di oggi in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} hanno i tramonti più belli?`, body: 'Le spiagge elencate qui sono esposte a ovest o sud-ovest, così il sole tramonta sull\'acqua davanti a te. Arriva prima del tramonto per trovare posto e goderti la luce.' },
          { heading: 'Cosa sapere per una visita serale?', body: 'Il vento può rinforzare o calare la sera, e le spiagge isolate non hanno illuminazione. Controlla vento e onde in tempo reale nell\'app e porta una torcia per il ritorno.' },
        ],
      },
    }),
  },
];

const islandIntentPath = (intent, region, island) => `${intent.pathPrefix}/${encodeURIComponent(regionSlug(region, island))}/`;

// Short chip labels for each guide topic, used in the "beach guides" link blocks
// on region and guide pages (the page <h1>s are too long to use as nav labels).
const INTENT_NAV_LABELS = {
  family:     { en: 'Family beaches',  gr: 'Οικογενειακές',     de: 'Familienstrände',  fr: 'Plages familiales',  it: 'Per famiglie' },
  sheltered:  { en: 'Sheltered (Meltemi)', gr: 'Απάνεμες (μελτέμι)', de: 'Windgeschützt', fr: 'Abritées (meltemi)', it: 'Riparate (meltemi)' },
  snorkeling: { en: 'Snorkeling',      gr: 'Για snorkeling',    de: 'Schnorcheln',      fr: 'Snorkeling',         it: 'Snorkeling' },
  organized:  { en: 'Organized',       gr: 'Οργανωμένες',       de: 'Organisiert',      fr: 'Aménagées',          it: 'Attrezzate' },
  secluded:   { en: 'Secluded',        gr: 'Απομονωμένες',      de: 'Abgelegen',        fr: 'Isolées',            it: 'Isolate' },
  sunset:     { en: 'Sunset',          gr: 'Για ηλιοβασίλεμα',  de: 'Sonnenuntergang',  fr: 'Coucher de soleil',  it: 'Tramonto' },
};

// The guide articles that were actually generated for this island (same ≥MIN
// gate as the page generation), so region/guide pages only link to pages that
// exist. `excludeKey` drops the current page from a "more guides" cross-link.
const getIslandGuides = (island, region, locale, excludeKey = null) => {
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  return islandIntents
    .filter(intent => intent.key !== excludeKey)
    .filter(intent => beaches.filter(b => Number.isInteger(b.id) && b.name && intent.match(b)).length >= ISLAND_INTENT_MIN)
    .map(intent => ({
      href: localizedPath(islandIntentPath(intent, region, island), locale),
      label: INTENT_NAV_LABELS[intent.key]?.[locale.language] || INTENT_NAV_LABELS[intent.key]?.en || intent.key,
    }));
};

// A chip-list "beach guides" block linking to the island's guide articles —
// gives users a clickable way in and threads internal link equity to the guides
// (they were sitemap-only before). Returns '' when the island has no guides.
const renderIslandGuides = (island, region, locale, excludeKey, heading) => {
  const guides = getIslandGuides(island, region, locale, excludeKey);
  if (guides.length === 0) return '';
  const items = guides.map(g =>
    `<li style="margin:0;"><a href="${escapeHtml(g.href)}" style="display:inline-block;border:1px solid #bae6fd;border-radius:999px;padding:7px 13px;background:white;color:#075985;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(g.label)}</a></li>`
  ).join('');
  return `
        <section style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Greece-wide guide backlinks for individual beach pages. Each beach page only
// linked up to its own region's guides, never to the national landing pages
// (so national intent -> beach was one-directional). Only emitted for locales
// where those pages exist (en root + el); /de//fr//it would 404.
const NATIONAL_GUIDE_LINKS = [
  { path: '/best-beaches-greece-today/', label: { en: 'Best beaches today', gr: 'Καλύτερες σήμερα' } },
  { path: '/sheltered-beaches-meltemi/', label: { en: 'Sheltered in the Meltemi', gr: 'Απάνεμες (μελτέμι)' } },
  { path: '/family-beaches-greece/', label: { en: 'Family beaches', gr: 'Οικογενειακές' } },
  { path: '/accessible-beaches-greece/', label: { en: 'Accessible (Seatrac)', gr: 'Προσβάσιμες ΑμεΑ' } },
  { path: '/beach-camping-greece/', label: { en: 'Beach camping', gr: 'Κάμπινγκ σε παραλίες' } },
];
const renderNationalGuides = (locale, heading) => {
  if (!BASE_LOCALE_IDS.has(locale.id)) return '';
  const items = NATIONAL_GUIDE_LINKS.map(g =>
    `<li style="margin:0;"><a href="${escapeHtml(localizedPath(g.path, locale))}" style="display:inline-block;border:1px solid #bae6fd;border-radius:999px;padding:7px 13px;background:white;color:#075985;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(g.label[locale.language] || g.label.en)}</a></li>`
  ).join('');
  return `
        <section style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Pages that used to exist as thin generic gateways and were consolidated into a
// kept, useful page. 301 so the already-submitted URLs never 404; they are also
// excluded from the sitemap (they are simply absent from seoLandingPages now).
const landingRedirects = [
  { from: '/where-to-swim-greece-today/', to: '/best-beaches-greece-today/' },
  { from: '/calm-beaches-greece-windy-day/', to: '/sheltered-beaches-meltemi/' },
  { from: '/best-beaches-milos-today/', to: '/beaches/milos/' },
];

const breadcrumbJsonLd = items => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

// FAQPage from {q, a} pairs. Answers must restate facts already visible on the
// page (dl, amenity chips, narrative, landing sections) — never volatile data.
const faqJsonLd = pairs => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: pairs.map(pair => ({
    '@type': 'Question',
    name: pair.q,
    acceptedAnswer: { '@type': 'Answer', text: pair.a },
  })),
});

const outputDirForRoute = routePath => path.join(distDir, routePath.replace(/^\/+/, ''));

const beachTypeLabels = new Map([
  ['sandy', { en: 'Sandy', gr: 'Αμμώδης', de: 'Sandig', fr: 'Sablonneuse', it: 'Sabbiosa' }],
  ['pebbles', { en: 'Pebbles', gr: 'Βότσαλα', de: 'Kiesel', fr: 'Galets', it: 'Ciottoli' }],
  ['sandy-pebbles', { en: 'Sand & pebbles', gr: 'Άμμος & βότσαλα', de: 'Sand & Kiesel', fr: 'Sable et galets', it: 'Sabbia e ciottoli' }],
  ['rocky', { en: 'Rocky', gr: 'Βραχώδης', de: 'Felsig', fr: 'Rocheuse', it: 'Rocciosa' }],
]);

const accessTypeLabels = new Map([
  ['asphalt_road', { en: 'Easy road access', gr: 'Πρόσβαση με άσφαλτο', de: 'Einfache Zufahrt (Asphalt)', fr: 'Accès facile (route goudronnée)', it: 'Accesso facile (asfalto)' }],
  ['passable_dirt_road', { en: 'Passable dirt road', gr: 'Χωματόδρομος (βατός)', de: 'Befahrbarer Feldweg', fr: 'Piste praticable', it: 'Sterrato percorribile' }],
  ['difficult_dirt_road', { en: 'Difficult dirt road', gr: 'Δύσκολος χωματόδρομος', de: 'Schwieriger Feldweg', fr: 'Piste difficile', it: 'Sterrato difficile' }],
  ['4x4_only', { en: '4x4 access', gr: 'Πρόσβαση με 4x4', de: 'Nur mit 4x4', fr: 'Uniquement en 4x4', it: 'Solo con 4x4' }],
  ['hiking_path_easy', { en: 'Easy path', gr: 'Εύκολο μονοπάτι', de: 'Einfacher Fußweg', fr: 'Sentier facile', it: 'Sentiero facile' }],
  ['hiking_path_difficult', { en: 'Difficult access (path)', gr: 'Δύσκολη πρόσβαση (μονοπάτι)', de: 'Schwieriger Zugang (Pfad)', fr: 'Accès difficile (sentier)', it: 'Accesso difficile (sentiero)' }],
  ['boat_only', { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος', de: 'Nur per Boot', fr: 'Accès uniquement en bateau', it: 'Solo in barca' }],
]);

const accessibilityLabels = new Map([
  ['EASY', { en: 'Easy access', gr: 'Εύκολη πρόσβαση', de: 'Einfacher Zugang', fr: 'Accès facile', it: 'Accesso facile' }],
  ['MODERATE', { en: 'Moderate access', gr: 'Μέτρια πρόσβαση', de: 'Mittlerer Zugang', fr: 'Accès modéré', it: 'Accesso moderato' }],
  ['DIFFICULT', { en: 'Difficult access', gr: 'Δύσκολη πρόσβαση', de: 'Schwieriger Zugang', fr: 'Accès difficile', it: 'Accesso difficile' }],
  ['BOAT_ONLY', { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος', de: 'Nur per Boot', fr: 'Accès uniquement en bateau', it: 'Solo in barca' }],
]);

const readableLabel = (labels, language) => labels?.[language] || labels?.en;

const readableBeachType = (beach, language = 'en') => readableLabel(beachTypeLabels.get(beach?.beachType), language);

const readableAccess = (beach, language = 'en') => (
  readableLabel(accessTypeLabels.get(beach?.staticLabels?.accessType), language) ||
  readableLabel(accessibilityLabels.get(beach?.accessibility), language)
);

const renderDefinitionRow = (term, description) => (
  description
    ? `<dt style="font-weight:700;">${escapeHtml(term)}</dt><dd style="margin:0;">${escapeHtml(description)}</dd>`
    : ''
);

const renderBeachSummaryMeta = (beach, language = 'en') => {
  const labels = [
    readableBeachType(beach, language),
    readableAccess(beach, language),
  ].filter(Boolean);

  return labels.length > 0
    ? `<span style="display:block;margin-top:4px;color:#475569;font-size:14px;">${escapeHtml(labels.join(' - '))}</span>`
    : '';
};

const regionSlug = (region, island) => normalizeSlug(
  localized(region?.name, '', 'en') || localized(island?.name, '', 'en') || region?.id
);

const regionPath = (region, island) => `/beaches/${encodeURIComponent(regionSlug(region, island))}/`;

const beachPath = (region, island, beach) => (
  `${regionPath(region, island)}${beach.id}-${normalizeSlug(displayName(beach.name, `beach-${beach.id}`, 'en'))}/`
);

const legacyBeachPaths = (region, island, beach) => {
  const currentPath = beachPath(region, island, beach);
  const slugs = Array.isArray(beach.legacySlugs) ? beach.legacySlugs : [];

  return Array.from(new Set(slugs
    .map(slug => `${regionPath(region, island)}${beach.id}-${normalizeSlug(slug)}/`)
    .filter(pathName => pathName !== currentPath)));
};

const legacyRegionPath = regionId => `/beaches/${encodeURIComponent(regionId)}/`;

const setOrAppendHeadTag = (html, pattern, tag) => {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
};

const injectBeachHead = (html, meta) => {
  let nextHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  if (meta.htmlLang) {
    nextHtml = nextHtml.replace(/<html\b([^>]*)>/i, (match, attrs) => {
      if (/\slang="[^"]*"/i.test(attrs)) {
        return match.replace(/\slang="[^"]*"/i, ` lang="${escapeHtml(meta.htmlLang)}"`);
      }

      return `<html lang="${escapeHtml(meta.htmlLang)}"${attrs}>`;
    });
  }

  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="robots" content="[^"]*"\s*\/?>/i,
    `<meta name="robots" content="${escapeHtml(meta.robots || defaultRobotsContent)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:type" content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(meta.ogType || 'article')}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:locale" content="[^"]*"\s*\/?>/i,
    `<meta property="og:locale" content="${escapeHtml(meta.ogLocale || 'en_US')}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta property="og:url" content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
  );
  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
  );

  if (meta.imageUrl) {
    const imageType = imageTypeFromPath(meta.imageUrl);
    const imageAlt = meta.imageAlt || meta.title;

    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta property="og:image" content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta property="og:image:secure_url" content="[^"]*"\s*\/?>/i,
      `<meta property="og:image:secure_url" content="${escapeHtml(meta.imageUrl)}" />`
    );
    if (imageType) {
      nextHtml = setOrAppendHeadTag(
        nextHtml,
        /<meta property="og:image:type" content="[^"]*"\s*\/?>/i,
        `<meta property="og:image:type" content="${escapeHtml(imageType)}" />`
      );
    }
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta property="og:image:alt" content="[^"]*"\s*\/?>/i,
      `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta name="twitter:card" content="[^"]*"\s*\/?>/i,
      '<meta name="twitter:card" content="summary_large_image" />'
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta name="twitter:image" content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`
    );
    nextHtml = setOrAppendHeadTag(
      nextHtml,
      /<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`
    );
  }

  nextHtml = setOrAppendHeadTag(
    nextHtml,
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />`
  );
  nextHtml = nextHtml.replace(/\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+"\s*\/?>/gi, '');
  nextHtml = nextHtml.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');

  const jsonLd = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
  const extraHead = [
    ...(meta.alternateUrls || []).map(alternate => (
      `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}" />`
    )),
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ');

  return nextHtml.replace('</head>', `    ${extraHead}\n  </head>`);
};

const staticFallbackCopy = {
  en: {
    brand: 'CalmBeach Greece',
    region: 'Region',
    beachType: 'Beach type',
    access: 'Access',
    coordinates: 'Coordinates',
    organizedBeach: 'Organized beach',
    beachBar: 'Beach bar',
    sunbeds: 'Sunbeds',
    parking: 'Parking',
    foodNearby: 'Food nearby',
    snackCanteen: 'Canteen',
    familyFriendly: 'Family friendly',
    quiet: 'Quiet',
    snorkeling: 'Snorkeling',
    openAppBeach: "Open the app for today's recommendation score, wind exposure, waves, best time of day and nearby alternatives.",
    openAppRegion: "Weather and sea conditions change during the day. CalmBeach uses the app view for today's live beach recommendations.",
    viewBeach: 'View this beach in CalmBeach Greece',
    viewRegion: islandName => `View ${islandName} in CalmBeach Greece`,
    regionHeading: islandName => `${islandName} beaches`,
    regionDescription: (islandName, count) => `Compare ${count} beaches in ${islandName}, Greece by today's wind, waves, weather, beach exposure, access and beach type before you choose where to swim.`,
    home: 'Greek beaches',
    nearbyHeading: islandName => `Other beaches in ${islandName}`,
    aboutHeading: 'About this beach',
  },
  gr: {
    brand: 'Calm Beach Greece',
    region: 'Περιοχή',
    beachType: 'Τύπος παραλίας',
    access: 'Πρόσβαση',
    coordinates: 'Συντεταγμένες',
    organizedBeach: 'Οργανωμένη παραλία',
    beachBar: 'Beach bar',
    sunbeds: 'Ξαπλώστρες',
    parking: 'Parking',
    foodNearby: 'Φαγητό κοντά',
    snackCanteen: 'Καντίνα',
    familyFriendly: 'Κατάλληλη για οικογένειες',
    quiet: 'Πιο ήσυχη',
    snorkeling: 'Snorkeling',
    openAppBeach: 'Άνοιξε την εφαρμογή για σημερινό σκορ, άνεμο, κύμα, καλύτερη ώρα και κοντινές εναλλακτικές.',
    openAppRegion: 'Ο καιρός και η θάλασσα αλλάζουν μέσα στη μέρα. Το Calm Beach δείχνει live προτάσεις παραλιών μέσα στην εφαρμογή.',
    viewBeach: 'Δες την παραλία στο Calm Beach Greece',
    viewRegion: islandName => `Δες τις παραλίες για ${islandName} στο Calm Beach Greece`,
    regionHeading: islandName => `Παραλίες: ${islandName}`,
    regionDescription: (islandName, count) => `Σύγκρινε ${count} παραλίες σε ${islandName} με βάση σημερινό άνεμο, κύμα, καιρό, έκθεση, πρόσβαση και τύπο παραλίας πριν διαλέξεις πού να κολυμπήσεις.`,
    home: 'Παραλίες Ελλάδας',
    nearbyHeading: islandName => `Άλλες παραλίες σε ${islandName}`,
    aboutHeading: 'Σχετικά με την παραλία',
  },
  de: {
    brand: 'CalmBeach Griechenland',
    region: 'Region',
    beachType: 'Strandtyp',
    access: 'Zugang',
    coordinates: 'Koordinaten',
    organizedBeach: 'Organisierter Strand',
    beachBar: 'Beach Bar',
    sunbeds: 'Liegen',
    parking: 'Parkplatz',
    foodNearby: 'Essen in der Nähe',
    snackCanteen: 'Kantine',
    familyFriendly: 'Familienfreundlich',
    quiet: 'Ruhiger',
    snorkeling: 'Schnorcheln',
    openAppBeach: 'Öffne die App für die heutige Empfehlungsbewertung, Windexposition, Wellen, beste Tageszeit und Alternativen in der Nähe.',
    openAppRegion: 'Wetter und Meeresbedingungen ändern sich im Tagesverlauf. CalmBeach zeigt die heutigen Live-Empfehlungen in der App-Ansicht.',
    viewBeach: 'Diesen Strand in CalmBeach Griechenland ansehen',
    viewRegion: islandName => `${islandName} in CalmBeach Griechenland ansehen`,
    regionHeading: islandName => `Strände: ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Griechenland – vergleiche ${count} Strände nach heutigem Wind, Wellen, Wetter, Lage, Zugang und Strandtyp, bevor du entscheidest, wo du schwimmen gehst.`,
    home: 'Strände in Griechenland',
    nearbyHeading: islandName => `Weitere Strände – ${islandName}`,
    aboutHeading: 'Über diesen Strand',
  },
  fr: {
    brand: 'CalmBeach Grèce',
    region: 'Région',
    beachType: 'Type de plage',
    access: 'Accès',
    coordinates: 'Coordonnées',
    organizedBeach: 'Plage aménagée',
    beachBar: 'Bar de plage',
    sunbeds: 'Transats',
    parking: 'Parking',
    foodNearby: 'Restauration à proximité',
    snackCanteen: 'Buvette',
    familyFriendly: 'Adaptée aux familles',
    quiet: 'Plus calme',
    snorkeling: 'Snorkeling',
    openAppBeach: "Ouvrez l'application pour la note de recommandation du jour, l'exposition au vent, les vagues, le meilleur moment de la journée et les alternatives à proximité.",
    openAppRegion: "La météo et l'état de la mer changent au cours de la journée. CalmBeach affiche les recommandations du jour en direct dans l'application.",
    viewBeach: 'Voir cette plage sur CalmBeach Grèce',
    viewRegion: islandName => `Voir ${islandName} sur CalmBeach Grèce`,
    regionHeading: islandName => `Plages : ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Grèce – comparez ${count} plages selon le vent, les vagues, la météo, l'exposition, l'accès et le type de plage du jour avant de choisir où vous baigner.`,
    home: 'Plages de Grèce',
    nearbyHeading: islandName => `Autres plages – ${islandName}`,
    aboutHeading: 'À propos de cette plage',
  },
  it: {
    brand: 'CalmBeach Grecia',
    region: 'Regione',
    beachType: 'Tipo di spiaggia',
    access: 'Accesso',
    coordinates: 'Coordinate',
    organizedBeach: 'Spiaggia attrezzata',
    beachBar: 'Beach bar',
    sunbeds: 'Lettini',
    parking: 'Parcheggio',
    foodNearby: 'Ristoro nelle vicinanze',
    snackCanteen: 'Chiosco',
    familyFriendly: 'Adatta alle famiglie',
    quiet: 'Più tranquilla',
    snorkeling: 'Snorkeling',
    openAppBeach: "Apri l'app per il punteggio consigliato di oggi, l'esposizione al vento, le onde, il momento migliore della giornata e le alternative vicine.",
    openAppRegion: "Il meteo e le condizioni del mare cambiano durante la giornata. CalmBeach mostra i consigli in tempo reale di oggi nella vista app.",
    viewBeach: 'Vedi questa spiaggia su CalmBeach Grecia',
    viewRegion: islandName => `Vedi ${islandName} su CalmBeach Grecia`,
    regionHeading: islandName => `Spiagge: ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Grecia – confronta ${count} spiagge in base a vento, onde, meteo, esposizione, accesso e tipo di spiaggia di oggi prima di scegliere dove fare il bagno.`,
    home: 'Spiagge della Grecia',
    nearbyHeading: islandName => `Altre spiagge – ${islandName}`,
    aboutHeading: 'Informazioni su questa spiaggia',
  },
};

const getStaticFallbackCopy = language => staticFallbackCopy[language] || staticFallbackCopy.en;

const staticHomeFallback = (canonicalUrl, locale = prerenderLocales[0]) => {
  const isGreek = locale.language === 'gr';
  const features = isGreek
    ? [
      'Σημερινές προτάσεις παραλιών',
      'Έλεγχος ανέμου, κύματος και καιρού',
      'Αναζήτηση ανά νησί ή περιοχή',
      'Χάρτης και λεπτομέρειες παραλίας',
    ]
    : [
      "Today's beach recommendations",
      'Wind, waves and weather checks',
      'Search by Greek island or region',
      'Map and beach detail pages',
    ];
  const guideLinks = seoLandingPages
    .filter(landing => landing.locales[locale.id])
    .map(landing => ({
      href: localizedPath(landing.pathName, locale),
      label: landing.locales[locale.id].h1,
    }));
  const guidesHeading = isGreek ? 'Δημοφιλείς οδηγοί παραλιών' : 'Popular beach guides';

  return `
    <div id="root">
      <main data-static-fallback style="max-width:860px;margin:0 auto;padding:40px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:800;">Calm Beach Greece</p>
        <h1 style="margin:0 0 14px;font-size:36px;line-height:1.08;">${escapeHtml(locale.homeTitle)}</h1>
        <p style="margin:0 0 22px;font-size:18px;line-height:1.55;color:#334155;">${escapeHtml(locale.homeDescription)}</p>
        <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0 0 24px;padding:0;list-style:none;">
          ${features.map(feature => `<li style="border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;background:white;color:#075985;font-weight:700;">${escapeHtml(feature)}</li>`).join('')}
        </ul>
        ${guideLinks.length > 0 ? `
        <nav aria-label="${escapeHtml(guidesHeading)}" style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:18px;color:#075985;">${escapeHtml(guidesHeading)}</h2>
          <ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none;">
            ${guideLinks.map(link => `<li><a href="${escapeHtml(link.href)}" style="display:inline-flex;border:1px solid #bae6fd;border-radius:999px;padding:8px 11px;background:white;color:#0e7490;text-decoration:none;font-weight:800;font-size:13px;">${escapeHtml(link.label)}</a></li>`).join('')}
          </ul>
        </nav>
        ` : ''}
        <p data-nosnippet="true" style="margin:0;color:#475569;">${escapeHtml(isGreek
          ? 'Άνοιξε την εφαρμογή για live προτάσεις με βάση τις σημερινές συνθήκες.'
          : "Open the app for live recommendations based on today's conditions.")}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:800;">${escapeHtml(isGreek ? 'Άνοιγμα Calm Beach Greece' : 'Open Calm Beach Greece')}</a></p>
      </main>
    </div>
  `;
};

// Compass direction labels. `face` describes which way the shore looks;
// `wind` is the accusative plural used in "cover from X winds".
// `face` describes which way the shore looks (used as "faces {face}"); `wind` is
// the form used in "cover from {wind} winds". de/fr/it forms are chosen to fit
// the per-language sentences composed in buildBeachNarrative.
const compassFace = new Map([
  ['North', { en: 'north', gr: 'βόρεια', de: 'Norden', fr: 'le nord', it: 'nord' }],
  ['South', { en: 'south', gr: 'νότια', de: 'Süden', fr: 'le sud', it: 'sud' }],
  ['East', { en: 'east', gr: 'ανατολικά', de: 'Osten', fr: "l'est", it: 'est' }],
  ['West', { en: 'west', gr: 'δυτικά', de: 'Westen', fr: "l'ouest", it: 'ovest' }],
  ['Northeast', { en: 'north-east', gr: 'βορειοανατολικά', de: 'Nordosten', fr: 'le nord-est', it: 'nord-est' }],
  ['Northwest', { en: 'north-west', gr: 'βορειοδυτικά', de: 'Nordwesten', fr: 'le nord-ouest', it: 'nord-ovest' }],
  ['Southeast', { en: 'south-east', gr: 'νοτιοανατολικά', de: 'Südosten', fr: 'le sud-est', it: 'sud-est' }],
  ['Southwest', { en: 'south-west', gr: 'νοτιοδυτικά', de: 'Südwesten', fr: 'le sud-ouest', it: 'sud-ovest' }],
]);
const compassWind = new Map([
  ['North', { en: 'northerly', gr: 'βόρειους', de: 'nördlichen', fr: 'de nord', it: 'da nord' }],
  ['South', { en: 'southerly', gr: 'νότιους', de: 'südlichen', fr: 'de sud', it: 'da sud' }],
  ['East', { en: 'easterly', gr: 'ανατολικούς', de: 'östlichen', fr: "d'est", it: 'da est' }],
  ['West', { en: 'westerly', gr: 'δυτικούς', de: 'westlichen', fr: "d'ouest", it: 'da ovest' }],
  ['Northeast', { en: 'north-easterly', gr: 'βορειοανατολικούς', de: 'nordöstlichen', fr: 'de nord-est', it: 'da nord-est' }],
  ['Northwest', { en: 'north-westerly', gr: 'βορειοδυτικούς', de: 'nordwestlichen', fr: 'de nord-ouest', it: 'da nord-ovest' }],
  ['Southeast', { en: 'south-easterly', gr: 'νοτιοανατολικούς', de: 'südöstlichen', fr: 'de sud-est', it: 'da sud-est' }],
  ['Southwest', { en: 'south-westerly', gr: 'νοτιοδυτικούς', de: 'südwestlichen', fr: 'de sud-ouest', it: 'da sud-ovest' }],
]);
const surfaceWord = new Map([
  ['sandy', { en: 'sand', gr: 'άμμο', de: 'Sand', fr: 'du sable', it: 'sabbia' }],
  ['pebbles', { en: 'pebbles', gr: 'βότσαλα', de: 'Kiesel', fr: 'des galets', it: 'ciottoli' }],
  ['sandy-pebbles', { en: 'sand and pebbles', gr: 'άμμο και βότσαλα', de: 'Sand und Kiesel', fr: 'du sable et des galets', it: 'sabbia e ciottoli' }],
  ['rocky', { en: 'rock', gr: 'βράχια', de: 'Felsen', fr: 'des rochers', it: 'rocce' }],
]);

const listJoin = (parts, language) => {
  const clean = parts.filter(Boolean);
  if (clean.length <= 1) return clean.join('');
  const conj = pickLang(language, { en: ' and ', gr: ' και ', de: ' und ', fr: ' et ', it: ' e ' });
  return `${clean.slice(0, -1).join(', ')}${conj}${clean[clean.length - 1]}`;
};

// Compose 1-3 short, unique paragraphs from verified structured fields so the
// 2.740 beach pages stop sharing the same templated description. Each sentence
// is emitted ONLY when its data exists (no filler) and wind wording stays
// cautious: orientation records shore facing, not confirmed shelter.
const buildBeachNarrative = (beach, island, language) => {
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const pick = variants => variants[(beach.id ?? 0) % variants.length];
  const paragraphs = [];

  const faces = Array.isArray(beach.orientation?.faces) ? beach.orientation.faces : [];
  const protectedFrom = Array.isArray(beach.protectedFrom) ? beach.protectedFrom : [];
  const faceWords = listJoin(faces.map(f => readableLabel(compassFace.get(f), language)), language);
  if (faceWords) {
    // Drop directions the shore itself faces (a bay cannot shelter from the way
    // it opens) and cap the list so the prose stays readable and not overstated.
    // Keep the inflected noun and leave the proper name in nominative apposition
    // (gr/de/fr/it) so grammar holds for any beach-name gender. Wind wording stays
    // cautious: orientation = shore facing, not confirmed shelter.
    const protList = protectedFrom.filter(d => !faces.includes(d)).slice(0, 3);
    const protWords = listJoin(protList.map(f => readableLabel(compassWind.get(f), language)), language);
    const orient = pickLang(language, {
      en: {
        leads: [
          `The shoreline at ${beachName} faces ${faceWords}`,
          `${beachName} is oriented towards the ${faceWords}`,
          `The bay at ${beachName} opens to the ${faceWords}`,
        ],
        prot: w => `, so it usually has natural cover from ${w} winds`,
        tail: `. Orientation only reflects which way the coast faces, not confirmed shelter, so check today's wind and waves in the app before you go.`,
      },
      gr: {
        leads: [
          `Η παραλία ${beachName} κοιτάζει ${faceWords}`,
          `Ο προσανατολισμός της παραλίας ${beachName} είναι ${faceWords}`,
          `Η παραλία ${beachName} βλέπει ${faceWords}`,
        ],
        prot: w => `, οπότε έχει συνήθως φυσική κάλυψη από ${w} ανέμους`,
        tail: `. Ο προσανατολισμός δείχνει μόνο την πλευρά της ακτής, όχι επιβεβαιωμένη προστασία· έλεγξε τον σημερινό άνεμο και το κύμα στην εφαρμογή πριν πας.`,
      },
      de: {
        leads: [
          `Der Strand ${beachName} ist nach ${faceWords} ausgerichtet`,
          `${beachName} öffnet sich nach ${faceWords}`,
          `Die Bucht von ${beachName} ist nach ${faceWords} orientiert`,
        ],
        prot: w => `, bietet also meist natürlichen Schutz vor ${w} Winden`,
        tail: `. Die Ausrichtung zeigt nur, wohin die Küste blickt, keinen gesicherten Schutz – prüfe vor dem Besuch Wind und Wellen von heute in der App.`,
      },
      fr: {
        leads: [
          `Le rivage de ${beachName} est orienté vers ${faceWords}`,
          `${beachName} s'ouvre vers ${faceWords}`,
          `La baie de ${beachName} donne vers ${faceWords}`,
        ],
        prot: w => `, et bénéficie donc le plus souvent d'un abri naturel contre les vents ${w}`,
        tail: `. L'orientation indique seulement vers où la côte est tournée, pas un abri garanti — vérifiez le vent et les vagues du jour dans l'application avant d'y aller.`,
      },
      it: {
        leads: [
          `La spiaggia ${beachName} è orientata verso ${faceWords}`,
          `${beachName} si apre verso ${faceWords}`,
          `La baia di ${beachName} guarda verso ${faceWords}`,
        ],
        prot: w => `, quindi di solito ha riparo naturale dai venti ${w}`,
        tail: `. L'orientamento indica solo verso dove guarda la costa, non un riparo garantito: controlla vento e onde di oggi nell'app prima di andare.`,
      },
    });
    const lead = pick(orient.leads);
    paragraphs.push(`${lead}${protWords ? orient.prot(protWords) : ''}${orient.tail}`);
  }

  const surface = readableLabel(surfaceWord.get(beach.beachType), language);
  const shallow = beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow';
  const deep = beach.characteristics?.deepWaters === true || beach.waterDepth === 'deep';
  const family = beach.environment?.familyFriendly === true;
  if (surface || shallow || deep) {
    if (language === 'gr') {
      const familyClause = (shallow && family) ? ' — βολικό για οικογένειες με μικρά παιδιά' : '';
      if (surface) {
        const depthClause = shallow ? ' με ρηχά, ομαλά νερά' : deep ? ' με νερά που βαθαίνουν κοντά στην ακτή' : '';
        paragraphs.push(`Η παραλία έχει ${surface}${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? 'Τα νερά είναι ρηχά και ομαλά' : 'Τα νερά βαθαίνουν κοντά στην ακτή';
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else if (language === 'de') {
      const familyClause = (shallow && family) ? ' – praktisch für Familien mit kleinen Kindern' : '';
      if (surface) {
        const depthClause = shallow ? ' mit flachem, sanft abfallendem Wasser' : deep ? ' mit Wasser, das nahe am Ufer tief wird' : '';
        paragraphs.push(`${beachName} hat ${surface} unter den Füßen${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? 'Das Wasser ist flach und fällt sanft ab' : 'Das Wasser wird nahe am Ufer tief';
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else if (language === 'fr') {
      const familyClause = (shallow && family) ? ' — pratique pour les familles avec de jeunes enfants' : '';
      if (surface) {
        const depthClause = shallow ? ' avec une eau peu profonde en pente douce' : deep ? ' avec une eau qui devient profonde près du rivage' : '';
        paragraphs.push(`${beachName} présente ${surface}${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? "L'eau est peu profonde et en pente douce" : "L'eau devient profonde près du rivage";
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else if (language === 'it') {
      const familyClause = (shallow && family) ? ' — comodo per famiglie con bambini piccoli' : '';
      if (surface) {
        const depthClause = shallow ? ' con acqua bassa e digradante' : deep ? ' con acqua che diventa profonda vicino alla riva' : '';
        paragraphs.push(`${beachName} ha ${surface}${depthClause}${familyClause}.`);
      } else {
        const depthSentence = shallow ? "L'acqua è bassa e digradante" : "L'acqua diventa profonda vicino alla riva";
        paragraphs.push(`${depthSentence}${familyClause}.`);
      }
    } else {
      const surfaceClause = surface ? `${beachName} has ${surface} underfoot` : `${beachName}`;
      const depthClause = shallow ? ' with shallow, gently shelving water' : deep ? ' with water that deepens close to shore' : '';
      const familyClause = (shallow && family) ? ' — handy for families with young children' : '';
      paragraphs.push(`${surfaceClause}${depthClause}${familyClause}.`);
    }
  }

  // Amenities + accessibility + camping. Mirror only what the app already shows
  // (chips / dl), so prose adds no claim the UI does not already make.
  const amen = [
    beach.amenities?.organized ? pickLang(language, { en: 'an organised beach', gr: 'οργάνωση', de: 'einen organisierten Strand', fr: 'une plage aménagée', it: 'una spiaggia attrezzata' }) : null,
    beach.amenities?.beachBar ? pickLang(language, { en: 'a beach bar', gr: 'beach bar', de: 'eine Beach Bar', fr: 'un bar de plage', it: 'un beach bar' }) : null,
    beach.amenities?.sunbeds ? pickLang(language, { en: 'sunbeds', gr: 'ξαπλώστρες', de: 'Liegen', fr: 'des transats', it: 'lettini' }) : null,
    beach.amenities?.naturalShade ? pickLang(language, { en: 'natural shade', gr: 'φυσική σκιά', de: 'natürlichen Schatten', fr: "de l'ombre naturelle", it: 'ombra naturale' }) : null,
    beach.amenities?.parking ? pickLang(language, { en: 'parking nearby', gr: 'πάρκινγκ κοντά', de: 'Parkplätze in der Nähe', fr: 'un parking à proximité', it: 'parcheggio nelle vicinanze' }) : null,
    (beach.amenities?.restaurant || beach.amenities?.taverna) ? pickLang(language, { en: 'food nearby', gr: 'φαγητό κοντά', de: 'Essen in der Nähe', fr: 'de la restauration à proximité', it: 'ristoro nelle vicinanze' }) : null,
  ].filter(Boolean);
  const sentences = [];
  if (amen.length) {
    sentences.push(pickLang(language, {
      en: `For amenities, ${beachName} has ${listJoin(amen, language)}.`,
      gr: `Σε παροχές, η παραλία έχει ${listJoin(amen, language)}.`,
      de: `An Ausstattung bietet ${beachName} ${listJoin(amen, language)}.`,
      fr: `Côté équipements, ${beachName} propose ${listJoin(amen, language)}.`,
      it: `Per i servizi, ${beachName} offre ${listJoin(amen, language)}.`,
    }));
  }
  const seatrac = beach.seatrac ?? beach.metadata?.seatrac;
  if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') {
    sentences.push(pickLang(language, {
      en: 'It has a Seatrac assisted-access unit for accessibility — confirm it is in service before travelling.',
      gr: 'Διαθέτει σύστημα Seatrac για προσβασιμότητα ΑμεΑ — επιβεβαίωσε ότι λειτουργεί πριν πας.',
      de: 'Es gibt eine Seatrac-Anlage für barrierefreien Zugang – bestätige vor der Anreise, dass sie in Betrieb ist.',
      fr: "Elle dispose d'un dispositif Seatrac pour l'accès assisté — confirmez qu'il est en service avant de vous déplacer.",
      it: "Dispone di un sistema Seatrac per l'accesso assistito: verifica che sia in funzione prima di partire.",
    }));
  }
  if (Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) {
    const nearest = beach.nearbyCamping.reduce((a, b) => (b.distanceMeters < a.distanceMeters ? b : a));
    const campName = (language !== 'gr' && nearest.nameEn) ? nearest.nameEn : nearest.name;
    sentences.push(pickLang(language, {
      en: `There is a campsite nearby (${campName}, ~${nearest.distanceMeters} m).`,
      gr: `Κοντά υπάρχει κάμπινγκ (${campName}, ~${nearest.distanceMeters} m).`,
      de: `In der Nähe gibt es einen Campingplatz (${campName}, ~${nearest.distanceMeters} m).`,
      fr: `Un camping se trouve à proximité (${campName}, ~${nearest.distanceMeters} m).`,
      it: `Nelle vicinanze c'è un campeggio (${campName}, ~${nearest.distanceMeters} m).`,
    }));
  }
  if (sentences.length) paragraphs.push(sentences.join(' '));

  return paragraphs;
};

const renderBeachNarrative = (beach, island, language, heading) => {
  const paragraphs = buildBeachNarrative(beach, island, language);
  if (!paragraphs.length) return '';
  return `
        <section style="margin:0 0 22px;">
          <h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          ${paragraphs.map(p => `<p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`).join('')}
        </section>`;
};

// Visible breadcrumb with real <a href> so crawlers (and users without JS) can
// climb back to the region and home; the JSON-LD BreadcrumbList mirrors it.
const renderBeachBreadcrumb = (region, island, beachName, language, locale) => {
  const copy = getStaticFallbackCopy(language);
  const homeHref = homePathForLocale(locale);
  const regionHref = localizedPath(regionPath(region, island), locale);
  const islandName = displayName(island.name, region.id, language);
  const sep = '<span style="color:#94a3b8;"> › </span>';
  return `
        <nav aria-label="breadcrumb" style="margin:0 0 14px;font-size:13px;font-weight:700;">
          <a href="${escapeHtml(homeHref)}" style="color:#0e7490;text-decoration:none;">${escapeHtml(copy.home)}</a>${sep}<a href="${escapeHtml(regionHref)}" style="color:#0e7490;text-decoration:none;">${escapeHtml(copy.regionHeading(islandName))}</a>${sep}<span style="color:#475569;">${escapeHtml(beachName)}</span>
        </nav>`;
};

// Up to 8 sibling beaches on the same island, ranked by popularity, as real
// links so each beach page funnels equity instead of being a crawl dead-end.
const renderNearbyBeaches = (beach, island, region, language, locale) => {
  const copy = getStaticFallbackCopy(language);
  const siblings = (Array.isArray(island.beaches) ? island.beaches : [])
    .filter(other => other.id !== beach.id && Number.isInteger(other.id) && other.name)
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    .slice(0, 8);
  if (!siblings.length) return '';
  const islandName = displayName(island.name, region.id, language);
  const items = siblings.map(other => {
    const otherName = displayName(other.name, `Beach ${other.id}`, language);
    return `
            <li style="margin:0;">
              <a href="${escapeHtml(localizedPath(beachPath(region, island, other), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
                <strong style="color:#0e7490;">${escapeHtml(otherName)}</strong>
                ${renderBeachSummaryMeta(other, language)}
              </a>
            </li>`;
  }).join('');
  return `
        <section style="margin:22px 0 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(copy.nearbyHeading(islandName))}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// "Calmer alternative nearby" as crawlable links: nearby beaches in the same
// region oriented away from the northerly Meltemi (the same static signal the
// sheltered guides use). We deliberately do NOT claim "calmer today" — a static
// page has no live wind — so the copy stays on the durable orientation fact.
const renderShelteredNearby = (beach, island, region, language, locale) => {
  const sheltered = (Array.isArray(island.beaches) ? island.beaches : [])
    .filter(other => other.id !== beach.id && Number.isInteger(other.id) && other.name)
    .filter(other => Array.isArray(other.protectedFrom) && NORTHERLY.some(d => other.protectedFrom.includes(d)))
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    .slice(0, 6);
  if (sheltered.length < 2) return '';
  const heading = pickLang(language, {
    en: 'Sheltered beaches nearby (oriented away from the Meltemi)',
    gr: 'Πιο προστατευμένες παραλίες κοντά (μακριά από το μελτέμι)',
    de: 'Windgeschützte Strände in der Nähe',
    fr: 'Plages abritées à proximité',
    it: 'Spiagge riparate nelle vicinanze',
  });
  const items = sheltered.map(other => {
    const otherName = displayName(other.name, `Beach ${other.id}`, language);
    return `
            <li style="margin:0;">
              <a href="${escapeHtml(localizedPath(beachPath(region, island, other), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
                <strong style="color:#0e7490;">${escapeHtml(otherName)}</strong>
                ${renderBeachSummaryMeta(other, language)}
              </a>
            </li>`;
  }).join('');
  return `
        <section style="margin:22px 0 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Q/A pairs for FAQPage structured data. Each answer restates a fact already
// shown on the page (dl row, amenity chip or narrative sentence) and only
// positive, stable facts are emitted — so the set differs per beach and never
// claims something the page does not display.
const buildBeachFaqPairs = (beach, island, language) => {
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const pairs = [];

  const access = readableAccess(beach, language);
  if (access) {
    pairs.push(pickLang(language, {
      en: { q: `How do you get to ${beachName} beach?`, a: `Access is ${access.toLowerCase()}. See the coordinates and map on CalmBeach.` },
      gr: { q: `Πώς πάω στην παραλία ${beachName};`, a: `Η πρόσβαση είναι: ${access}. Δες τις συντεταγμένες και τον χάρτη στο CalmBeach.` },
      de: { q: `Wie kommt man zum Strand ${beachName}?`, a: `${access}. Koordinaten und Karte findest du in CalmBeach.` },
      fr: { q: `Comment se rendre à la plage ${beachName} ?`, a: `${access}. Retrouvez les coordonnées et la carte sur CalmBeach.` },
      it: { q: `Come si arriva alla spiaggia ${beachName}?`, a: `${access}. Coordinate e mappa su CalmBeach.` },
    }));
  }

  const type = readableBeachType(beach, language);
  const shallow = beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow';
  const deep = beach.characteristics?.deepWaters === true || beach.waterDepth === 'deep';
  if (type || shallow || deep) {
    const depth = pickLang(language, {
      en: shallow ? ' with shallow water' : deep ? ' with deep water' : '',
      gr: shallow ? ' με ρηχά νερά' : deep ? ' με βαθιά νερά' : '',
      de: shallow ? ' mit flachem Wasser' : deep ? ' mit tiefem Wasser' : '',
      fr: shallow ? ' avec une eau peu profonde' : deep ? ' avec une eau profonde' : '',
      it: shallow ? ' con acqua bassa' : deep ? ' con acqua profonda' : '',
    });
    pairs.push(pickLang(language, {
      en: { q: `What is ${beachName} beach like?`, a: `${type ? `A ${type.toLowerCase()} beach${depth}.` : `A beach${depth}.`}`.trim() },
      gr: { q: `Πώς είναι η παραλία ${beachName};`, a: `${type ? `${type}${depth}.` : `Παραλία${depth}.`}`.trim() },
      de: { q: `Wie ist der Strand ${beachName}?`, a: `${type ? `Strandtyp: ${type}${depth}.` : `Strand${depth}.`}`.trim() },
      fr: { q: `À quoi ressemble la plage ${beachName} ?`, a: `${type ? `Plage ${type.toLowerCase()}${depth}.` : `Plage${depth}.`}`.trim() },
      it: { q: `Com'è la spiaggia ${beachName}?`, a: `${type ? `Spiaggia ${type.toLowerCase()}${depth}.` : `Spiaggia${depth}.`}`.trim() },
    }));
  }

  const amen = [
    beach.amenities?.organized ? pickLang(language, { en: 'an organised beach', gr: 'οργάνωση', de: 'einen organisierten Strand', fr: 'une plage aménagée', it: 'una spiaggia attrezzata' }) : null,
    beach.amenities?.beachBar ? pickLang(language, { en: 'a beach bar', gr: 'beach bar', de: 'eine Beach Bar', fr: 'un bar de plage', it: 'un beach bar' }) : null,
    beach.amenities?.sunbeds ? pickLang(language, { en: 'sunbeds', gr: 'ξαπλώστρες', de: 'Liegen', fr: 'des transats', it: 'lettini' }) : null,
    beach.amenities?.parking ? pickLang(language, { en: 'parking nearby', gr: 'πάρκινγκ κοντά', de: 'Parkplätze in der Nähe', fr: 'un parking à proximité', it: 'parcheggio nelle vicinanze' }) : null,
    (beach.amenities?.restaurant || beach.amenities?.taverna) ? pickLang(language, { en: 'food nearby', gr: 'φαγητό κοντά', de: 'Essen in der Nähe', fr: 'de la restauration à proximité', it: 'ristoro nelle vicinanze' }) : null,
  ].filter(Boolean);
  if (amen.length) {
    pairs.push(pickLang(language, {
      en: { q: `What facilities does ${beachName} beach have?`, a: `It has ${listJoin(amen, language)}.` },
      gr: { q: `Τι παροχές έχει η παραλία ${beachName};`, a: `Έχει ${listJoin(amen, language)}.` },
      de: { q: `Welche Ausstattung hat der Strand ${beachName}?`, a: `Es gibt ${listJoin(amen, language)}.` },
      fr: { q: `Quels équipements y a-t-il à la plage ${beachName} ?`, a: `Il y a ${listJoin(amen, language)}.` },
      it: { q: `Quali servizi offre la spiaggia ${beachName}?`, a: `Ci sono ${listJoin(amen, language)}.` },
    }));
  }

  const seatrac = beach.seatrac ?? beach.metadata?.seatrac;
  if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') {
    pairs.push(pickLang(language, {
      en: { q: `Is ${beachName} beach wheelchair accessible?`, a: 'It has a Seatrac assisted-access unit for reaching the water. Confirm it is in service before visiting.' },
      gr: { q: `Είναι προσβάσιμη για ΑμεΑ η παραλία ${beachName};`, a: 'Διαθέτει σύστημα Seatrac για αυτόνομη πρόσβαση στο νερό. Επιβεβαίωσε ότι λειτουργεί πριν πας.' },
      de: { q: `Ist der Strand ${beachName} barrierefrei?`, a: 'Er hat eine Seatrac-Anlage für den selbstständigen Zugang zum Wasser. Bestätige vor dem Besuch, dass sie in Betrieb ist.' },
      fr: { q: `La plage ${beachName} est-elle accessible aux personnes à mobilité réduite ?`, a: "Elle dispose d'un dispositif Seatrac pour accéder à l'eau. Confirmez qu'il est en service avant votre visite." },
      it: { q: `La spiaggia ${beachName} è accessibile alle persone con disabilità?`, a: "Dispone di un sistema Seatrac per raggiungere l'acqua. Verifica che sia in funzione prima della visita." },
    }));
  }

  return pairs;
};

// Shared beach <title>/<h1>/description builders. NOTE on description: the
// beach.description data field is authored only in en/gr; its fr/de/it entries
// are English copies (and accessNotes are Greeklish), so for de/fr/it we compose
// from the localized template instead of leaking English/Greeklish onto /de etc.
// en/gr keep using the authored data exactly as before.
const beachFallbackDescription = (beachName, islandName, language) => pickLang(language, {
  en: `${beachName} beach in ${islandName}, Greece. Check today's wind, waves, weather and beach exposure before you go.`,
  gr: `${beachName}, ${islandName}. Δες τον σημερινό άνεμο, το κύμα και τον καιρό πριν πας.`,
  de: `Strand ${beachName}, ${islandName} (Griechenland). Prüfe vor dem Besuch Wind, Wellen, Wetter und die Lage des Strandes.`,
  fr: `Plage ${beachName}, ${islandName} (Grèce). Vérifiez le vent, les vagues, la météo et l'exposition de la plage avant d'y aller.`,
  it: `Spiaggia ${beachName}, ${islandName} (Grecia). Controlla vento, onde, meteo ed esposizione della spiaggia prima di andare.`,
});
const beachDescriptionFor = (beach, beachName, islandName, language) => {
  const fallback = beachFallbackDescription(beachName, islandName, language);
  return (language === 'en' || language === 'gr')
    ? localized(beach.description, fallback, language)
    : fallback;
};

// Trim a sentence to a meta-description length without cutting a word in half.
const truncateForMeta = (text, max = 160) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 80 ? lastSpace : max).trim()}…`;
};

// Hand-written meta-description overrides for specific beach pages, keyed by
// `${region.id}#${beach.id}`. These pages rank well in Search Console but earn
// almost no clicks: the generated description (built/area template) is identical
// across beaches and gives no reason to click. Each override states the beach's
// own durable, data-backed traits (type, shelter orientation, amenities) plus
// the live-conditions value prop — en/gr only, ≤155 chars. This is the only
// per-page lever that does NOT touch beach data: the SERP description otherwise
// comes from the generated `description` field (or the Milos curated story).
const SEO_META_DESCRIPTION_OVERRIDES = {
  // Milos (override sits ahead of the curated story so the meta leads with a
  // conditions hook; the full editorial story still renders in the page body).
  'south-aegean-milos#1932': {
    en: 'Pollonia, Milos: a sandy fishing-village beach with sunbeds, parking and tavernas, good for families. See today’s live wind and waves before you go.',
    gr: 'Πολλώνια Μήλου: αμμώδης παραλία σε ψαροχώρι, με ξαπλώστρες, πάρκινγκ και ταβέρνες, καλή για οικογένειες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'south-aegean-milos#1924': {
    en: 'Triades, Milos: three remote sand-and-pebble coves on the wild west coast, good for snorkeling and sheltered from the meltemi. Check live wind first.',
    gr: 'Τριάδες Μήλου: τρεις απομακρυσμένοι όρμοι με άμμο και βότσαλο στη δυτική ακτή, καλοί για snorkeling και υπήνεμοι στο μελτέμι. Δες ζωντανά τον άνεμο.',
  },
  'north-aegean-lemnos#1455': {
    en: 'Mikro Fanaraki, Lemnos: organised sandy beach with sunbeds, bar and parking, sheltered from northerly winds. See today’s live wind and waves.',
    gr: 'Μικρό Φαναράκι, Λήμνος: οργανωμένη αμμώδης παραλία με ξαπλώστρες, bar και πάρκινγκ, υπήνεμη σε βόρειους ανέμους. Δες ζωντανά άνεμο και κύμα.',
  },
  'peloponnese-korinthia-mainland#1528': {
    en: 'Lychnari, Korinthia: a quiet pebble beach good for snorkeling, sheltered from northerly winds. Check today’s live wind and sea before you go.',
    gr: 'Λυχνάρι Κορινθίας: ήσυχη παραλία με βότσαλο, καλή για snorkeling και υπήνεμη σε βόρειους ανέμους. Δες ζωντανά άνεμο και θάλασσα πριν πας.',
  },
  'peloponnese-korinthia-mainland#1523': {
    en: 'Kalogerolimano, Korinthia: a sheltered pebble cove good for snorkeling, protected from northerly winds. Check today’s live wind and sea.',
    gr: 'Καλογερολίμανο Κορινθίας: προστατευμένος όρμος με βότσαλο, καλός για snorkeling, υπήνεμος σε βόρειους ανέμους. Δες ζωντανά άνεμο και θάλασσα.',
  },
  'west-greece-ileia-mainland#2568': {
    en: 'Kounoupeli, Ileia: a quiet, family-friendly sand-and-pebble beach with sunbeds. See today’s live wind and waves before you go.',
    gr: 'Κουνουπέλι Ηλείας: ήσυχη, οικογενειακή παραλία με άμμο, βότσαλο και ξαπλώστρες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'thessaly-magnesia-mainland---pelion#2721': {
    en: 'Fakistra, Pelion: a secluded pebble cove with clear water, good for snorkeling. Check today’s live wind and waves before you go.',
    gr: 'Φακίστρα Πηλίου: απομακρυσμένος όρμος με βότσαλο και καθαρά νερά, καλός για snorkeling. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'south-aegean-paros#2029': {
    en: 'Kalogeros, Paros: a sand-and-pebble beach good for snorkeling, sheltered from the meltemi. Check today’s live wind and waves before you go.',
    gr: 'Καλόγερος Πάρου: παραλία με άμμο και βότσαλο, καλή για snorkeling και υπήνεμη στο μελτέμι. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'crete-crete-chania#574': {
    en: 'Platanias, Chania: a long organised sandy beach near Chania with sunbeds. See today’s live wind and waves before you go.',
    gr: 'Πλατανιάς Χανίων: μεγάλη οργανωμένη αμμώδης παραλία κοντά στα Χανιά, με ξαπλώστρες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
};

// Per-beach <head>/JSON-LD description: prefer a hand-written per-page override
// (12-page CTR fix), then the unique editorial opener (so each beach gets a
// distinct, descriptive snippet) and fall back to the existing templated
// description for beaches without a curated story.
const beachMetaDescription = (beach, region, beachName, islandName, language) => {
  const override = SEO_META_DESCRIPTION_OVERRIDES[`${region?.id}#${beach.id}`];
  if (override && (language === 'en' || language === 'gr') && override[language]) {
    return override[language];
  }
  const story = getBeachStory(region, beach, language);
  if (story?.paragraphs?.[0]) return truncateForMeta(story.paragraphs[0]);
  return beachDescriptionFor(beach, beachName, islandName, language);
};

// Visible, crawlable editorial section (unique geology/history/character prose)
// rendered into the static beach page body. Its <h2> is the curated, keyword-ish
// story title (e.g. "Το σεληνιακό τοπίο της Μήλου").
const renderBeachStory = (region, beach, language) => {
  const story = getBeachStory(region, beach, language);
  if (!story) return '';
  const heading = story.title;
  return `
        <section style="margin:0 0 22px;">
          ${heading ? `<h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>` : ''}
          ${story.paragraphs.map(p => `<p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`).join('')}
        </section>`;
};

// Short per-beach blurb for the guide-article beach lists: the curated story
// title (a unique, evocative hook) + a trimmed opening sentence. Only beaches
// with a curated story (Milos, en/gr) get one; others fall back to the plain
// structured meta. Returns inner text or '' (the <p> wrapper is added by the
// caller, outside the <a> so it is body text, not anchor text).
const intentBeachBlurbText = (region, beach, language) => {
  const story = getBeachStory(region, beach, language);
  if (!story) return '';
  const lead = truncateForMeta(story.paragraphs[0], 150);
  return story.title ? `${story.title} — ${lead}` : lead;
};
// Localized "Beach X" / "Παραλία X" label that never doubles the noun when the
// resolved name already contains it (~21% of Greek names already include
// "Παραλία", e.g. "Παραλία Φλοίσβου" was rendering "Παραλία Παραλία Φλοίσβου").
// Mirrors utils/localization.ts#localizedBeachLabel — keep the two in sync.
const BEACH_NOUN_BY_LANG = { en: 'Beach', gr: 'Παραλία', de: 'Strand', fr: 'Plage', it: 'Spiaggia' };
const localizedBeachLabel = (beachName, language) => {
  const noun = BEACH_NOUN_BY_LANG[language] || BEACH_NOUN_BY_LANG.en;
  const alreadyHasNoun = new RegExp(`(^|\\s)${noun}(\\s|$)`, 'i').test(beachName);
  if (alreadyHasNoun) return beachName;
  return language === 'en' ? `${beachName} ${noun}` : `${noun} ${beachName}`;
};
const beachConditionsSuffix = language => pickLang(language, {
  en: 'Wind & Waves Today',
  gr: 'Άνεμος & προστασία σήμερα',
  de: 'Wind & Wellen heute',
  fr: "Vent & vagues aujourd'hui",
  it: 'Vento e onde oggi',
});
const beachH1For = (beachName, islandName, language) =>
  `${localizedBeachLabel(beachName, language)}, ${islandName}`;
const beachTitleFor = (beachName, islandName, language) =>
  `${localizedBeachLabel(beachName, language)}, ${islandName} | ${beachConditionsSuffix(language)}`;
const beachAttractionName = (beachName, language) => localizedBeachLabel(beachName, language);
const beachImageAltFor = (beachName, islandName, language) => {
  const label = localizedBeachLabel(beachName, language);
  return pickLang(language, {
    en: `${label} in ${islandName}, Greece`,
    gr: `${label}, ${islandName}`,
    de: `${label}, ${islandName}, Griechenland`,
    fr: `${label}, ${islandName}, Grèce`,
    it: `${label}, ${islandName}, Grecia`,
  });
};

const staticBeachFallback = (beach, island, region, canonicalUrl, locale = prerenderLocales[0]) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const islandName = displayName(island.name, island.id, language);
  const description = beachDescriptionFor(beach, beachName, islandName, language);
  const amenityLabels = [
    beach.amenities?.organized ? copy.organizedBeach : null,
    beach.amenities?.beachBar ? copy.beachBar : null,
    beach.amenities?.sunbeds ? copy.sunbeds : null,
    beach.amenities?.parking ? copy.parking : null,
    beach.amenities?.restaurant || beach.amenities?.taverna ? copy.foodNearby : null,
    amenityTextIncludesAny(beach.metadata?.amenities, SNACK_CANTEEN_AMENITY_TERMS) ? copy.snackCanteen : null,
    beach.environment?.familyFriendly ? copy.familyFriendly : null,
    beach.environment?.quiet ? copy.quiet : null,
    beach.activities?.snorkeling ? copy.snorkeling : null,
  ].filter(Boolean);

  return `
    <div id="root">
      <main data-static-fallback style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">${escapeHtml(copy.brand)}</p>
        ${renderBeachBreadcrumb(region, island, beachName, language, locale)}
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(beachH1For(beachName, islandName, language))}</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(description)}</p>
        ${renderBeachStory(region, beach, language)}
        <dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 14px;margin:0 0 20px;">
          <dt style="font-weight:700;">${escapeHtml(copy.region)}</dt><dd style="margin:0;">${escapeHtml(islandName)}, Greece</dd>
          ${renderDefinitionRow(copy.beachType, readableBeachType(beach, language))}
          ${renderDefinitionRow(copy.access, readableAccess(beach, language))}
          <dt style="font-weight:700;">${escapeHtml(copy.coordinates)}</dt><dd style="margin:0;">${escapeHtml(beach.coordinates?.lat)}, ${escapeHtml(beach.coordinates?.lon)}</dd>
        </dl>
        ${amenityLabels.length > 0 ? `<ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;padding:0;list-style:none;">${amenityLabels.map(label => `<li style="border:1px solid #bae6fd;border-radius:999px;padding:6px 10px;background:white;color:#075985;font-weight:700;font-size:13px;">${escapeHtml(label)}</li>`).join('')}</ul>` : ''}
        ${renderBeachNarrative(beach, island, language, copy.aboutHeading)}
        <p data-nosnippet="true" style="margin:0;color:#475569;">${escapeHtml(copy.openAppBeach)}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">${escapeHtml(copy.viewBeach)}</a></p>
        ${renderIslandGuides(island, region, locale, null, pickLang(language, {
          en: `${islandName} beach guides`,
          gr: `Οδηγοί παραλιών — ${islandName}`,
          de: `${islandName} Strandführer`,
          fr: `Guides plages — ${islandName}`,
          it: `Guide spiagge — ${islandName}`,
        }))}
        ${renderNationalGuides(locale, pickLang(language, {
          en: 'Beach guides across Greece',
          gr: 'Οδηγοί παραλιών σε όλη την Ελλάδα',
          de: 'Strandführer für ganz Griechenland',
          fr: 'Guides plages dans toute la Grèce',
          it: 'Guide spiagge in tutta la Grecia',
        }))}
        ${renderShelteredNearby(beach, island, region, language, locale)}
        ${renderNearbyBeaches(beach, island, region, language, locale)}
      </main>
    </div>
  `;
};

const staticRegionFallback = (island, region, canonicalUrl, locale = prerenderLocales[0]) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const islandName = displayName(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const beachItems = beaches
    .slice(0, 80)
    .map(beach => {
      const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
      return `
          <li style="margin:0;">
            <a href="${escapeHtml(localizedPath(beachPath(region, island, beach), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
              <strong style="color:#0e7490;">${escapeHtml(beachName)}</strong>
              ${renderBeachSummaryMeta(beach, language)}
            </a>
          </li>
        `;
    })
    .join('');

  return `
    <div id="root">
      <main data-static-fallback style="max-width:840px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">${escapeHtml(copy.brand)}</p>
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(copy.regionHeading(islandName))}</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(copy.regionDescription(islandName, beaches.length))}</p>
        ${beachItems ? `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0 0 20px;padding:0;list-style:none;">${beachItems}</ul>` : ''}
        ${renderIslandGuides(island, region, locale, null, pickLang(language, {
          en: `${islandName} beach guides`,
          gr: `Οδηγοί παραλιών — ${islandName}`,
          de: `${islandName} Strandführer`,
          fr: `Guides plages — ${islandName}`,
          it: `Guide spiagge — ${islandName}`,
        }))}
        <p data-nosnippet="true" style="margin:0;color:#475569;">${escapeHtml(copy.openAppRegion)}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">${escapeHtml(copy.viewRegion(islandName))}</a></p>
      </main>
    </div>
  `;
};

const stripClientScripts = html => html
  .replace(/\s*<link rel="modulepreload"[^>]*>\s*/gi, '')
  .replace(/\s*<script\b(?=[^>]*\btype="module"|\btype='module')[^>]*>[\s\S]*?<\/script>\s*/gi, '');

const landingChromeCopy = {
  en: {
    openApp: 'Open app',
    related: 'Related CalmBeach pages',
    faqLabel: 'Frequently asked questions',
    disclaimer: 'Recommendations are indicative and depend on available weather and beach data. Conditions may vary locally.',
  },
  gr: {
    openApp: 'Άνοιγμα',
    related: 'Σχετικές σελίδες CalmBeach',
    faqLabel: 'Συχνές ερωτήσεις',
    disclaimer: 'Οι προτάσεις είναι ενδεικτικές και εξαρτώνται από τα διαθέσιμα δεδομένα καιρού και παραλιών. Οι συνθήκες μπορεί να διαφέρουν τοπικά.',
  },
};

const staticSeoLandingPage = (content, locale, dynamicHtml = '') => {
  // The first link is always the primary entry into the live app; promote it to
  // a prominent CTA so this page reads as a real CalmBeach gateway, not a stray
  // document. The rest stay as secondary related links. Link hrefs are stored as
  // base paths and localized so a Greek page funnels into Greek routes.
  // `dynamicHtml` is the data-driven section (a real beach list or a region hub)
  // that makes the page deliver on its title instead of being generic prose.
  const chrome = landingChromeCopy[locale.language] || landingChromeCopy.en;
  const homeHref = localizedPath('/', locale);
  const localizeHref = href => href?.startsWith('#') ? href : localizedPath(href, locale);
  const [primaryLink, ...secondaryLinks] = content.links;
  const faqItems = Array.isArray(content.faq) ? content.faq.filter(item => item?.q && item?.a) : [];

  return `
    <div id="root">
      <main style="max-width:880px;margin:0 auto;padding:0 20px 56px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;">
          <a href="${escapeHtml(homeHref)}" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#0e7490;font-weight:800;font-size:18px;">
            <img src="/calmbeach-mark.svg" alt="" width="32" height="32" style="display:block;" />
            CalmBeach Greece
          </a>
          <a href="${escapeHtml(homeHref)}" style="display:inline-flex;align-items:center;border:1px solid #bae6fd;border-radius:999px;padding:8px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(chrome.openApp)}</a>
        </header>
        <section style="padding:24px 0 8px;">
          <h1 style="margin:0 0 14px;font-size:38px;line-height:1.08;">${escapeHtml(content.h1)}</h1>
          <p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:#334155;">${escapeHtml(content.intro)}</p>
          ${primaryLink ? `<a href="${escapeHtml(localizeHref(primaryLink.href))}" style="display:inline-flex;align-items:center;justify-content:center;background:#0e7490;color:white;border-radius:12px;padding:14px 22px;text-decoration:none;font-weight:800;font-size:16px;box-shadow:0 10px 24px -12px rgba(14,116,144,.6);">${escapeHtml(primaryLink.label)} →</a>` : ''}
          ${content.trustNote ? `<p style="margin:14px 0 0;border:1px solid #bae6fd;border-radius:12px;background:#ecfeff;padding:11px 13px;color:#334155;font-size:14px;line-height:1.5;">${escapeHtml(content.trustNote)}</p>` : ''}
        </section>
        ${dynamicHtml}
        <div style="display:grid;gap:16px;margin:28px 0;">
          ${content.sections.map(section => `
            <section style="border-top:1px solid #bae6fd;padding-top:16px;">
              <h2 style="margin:0 0 8px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(section.heading)}</h2>
              <p style="margin:0;font-size:16px;line-height:1.58;color:#334155;">${escapeHtml(section.body)}</p>
            </section>
          `).join('')}
        </div>
        ${faqItems.length > 0 ? `
        <section style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(content.faqHeading || chrome.faqLabel)}</h2>
          <dl style="display:grid;gap:12px;margin:0;">
            ${faqItems.map(item => `
              <div style="border:1px solid #bae6fd;border-radius:12px;background:white;padding:12px 14px;">
                <dt style="margin:0 0 6px;font-size:16px;font-weight:800;color:#0f172a;">${escapeHtml(item.q)}</dt>
                <dd style="margin:0;color:#475569;font-size:15px;line-height:1.55;">${escapeHtml(item.a)}</dd>
              </div>
            `).join('')}
          </dl>
        </section>
        ` : ''}
        ${secondaryLinks.length > 0 ? `
        <nav aria-label="${escapeHtml(chrome.related)}">
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">
            ${secondaryLinks.map(link => `
              <li style="margin:0;">
                <a href="${escapeHtml(localizeHref(link.href))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:800;">${escapeHtml(link.label)}</a>
              </li>
            `).join('')}
          </ul>
        </nav>
        ` : ''}
        <p data-nosnippet="true" style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">${escapeHtml(chrome.disclaimer)}</p>
      </main>
    </div>
  `;
};

// Localized headings for the data-driven sections. Kept here (not in each locale
// block) so the page content stays focused on intent copy.
const listSectionHeadings = {
  accessible: { en: 'Accessible beaches with Seatrac access', gr: 'Προσβάσιμες παραλίες με Seatrac' },
  family: { en: 'Family-friendly beaches', gr: 'Οικογενειακές παραλίες' },
  camping: { en: 'Beaches with a campsite nearby', gr: 'Παραλίες με κάμπινγκ κοντά' },
  top: { en: 'Popular beaches to check today', gr: 'Δημοφιλείς παραλίες για έλεγχο σήμερα' },
};
const hubSectionHeading = { en: 'Browse beaches by island & region', gr: 'Δες παραλίες ανά νησί & περιοχή' };
const emptyListNote = { en: 'We are still adding beaches to this guide.', gr: 'Προσθέτουμε ακόμη παραλίες σε αυτόν τον οδηγό.' };
const localeText = (table, locale) => table[locale.language] || table.en;
const emptyListNoteFor = (category, locale) => {
  if (category === 'accessible') {
    return locale.language === 'gr'
      ? 'Δεν υπάρχουν ακόμα επιβεβαιωμένα δεδομένα προσβασιμότητας για αυτήν την περιοχή. Μπορείς να δεις κοντινές παραλίες και τις πληροφορίες πρόσβασης σε κάθε σελίδα.'
      : 'We don\'t have verified accessibility data for this area yet. You can still explore nearby beaches and check access details on each beach page.';
  }
  return localeText(emptyListNote, locale);
};

const getBeachSeatrac = beach => beach?.seatrac ?? beach?.metadata?.seatrac;

const accessFeatureOrder = ['disabledParking', 'boardwalkToWater', 'accessibleWc', 'changingRoom', 'shower', 'shade'];
const positiveAccessStatuses = new Set(['yes', 'seasonal']);
const accessFeatureCopy = {
  seatrac: { en: 'Seatrac sea-access ramp', gr: 'Ράμπα Seatrac' },
  disabledParking: { en: 'Accessible parking', gr: 'Πάρκινγκ ΑμεΑ' },
  boardwalkToWater: { en: 'Boardwalk to water', gr: 'Διάδρομος προς τη θάλασσα' },
  accessibleWc: { en: 'Accessible WC', gr: 'Προσβάσιμο WC' },
  changingRoom: { en: 'Accessible changing room', gr: 'Προσβάσιμο αποδυτήριο' },
  shower: { en: 'Accessible shower', gr: 'Προσβάσιμο ντους' },
  shade: { en: 'Shaded seating listed', gr: 'Καταγεγραμμένη σκιά' },
  parking: { en: 'Parking listed', gr: 'Καταγεγραμμένο parking' },
  seasonal: { en: 'Seasonal equipment', gr: 'Εποχικός εξοπλισμός' },
  verify: { en: 'Verify before visiting', gr: 'Επιβεβαίωση πριν την επίσκεψη' },
  checked: { en: 'Checked', gr: 'Έλεγχος' },
  details: { en: 'Open details for today\'s wind and waves', gr: 'Άνοιγμα λεπτομερειών για άνεμο και κύμα' },
};

const accessCopy = (key, language) => accessFeatureCopy[key]?.[language] || accessFeatureCopy[key]?.en || key;

const accessibleFeatureLabels = (beach, language) => {
  const seatrac = getBeachSeatrac(beach);
  if (seatrac?.hasSeatrac !== true || seatrac.status !== 'online') return [];

  const labels = [accessCopy('seatrac', language)];
  for (const key of accessFeatureOrder) {
    if (positiveAccessStatuses.has(seatrac.amenities?.[key])) labels.push(accessCopy(key, language));
  }
  if (beach.amenities?.parking === true && !positiveAccessStatuses.has(seatrac.amenities?.disabledParking)) {
    labels.push(accessCopy('parking', language));
  }

  return Array.from(new Set(labels)).slice(0, 6);
};

const accessibleCaveatLabels = (beach, language) => {
  const seatrac = getBeachSeatrac(beach);
  if (!seatrac) return [];

  return [
    seatrac.seasonal ? accessCopy('seasonal', language) : '',
    seatrac.verifiedAt ? `${accessCopy('checked', language)} ${seatrac.verifiedAt}` : '',
    seatrac.needsVerification ? accessCopy('verify', language) : '',
  ].filter(Boolean);
};

const renderBeachListSection = (items, locale, category) => {
  const language = locale.language;
  const heading = localeText(listSectionHeadings[category] || {}, locale);
  const sectionId = category === 'accessible' ? ' id="accessible-beach-list"' : '';

  if (!items.length) {
    return `
        <section${sectionId} style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 8px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <p style="margin:0;color:#475569;">${escapeHtml(emptyListNoteFor(category, locale))}</p>
        </section>`;
  }

  const cards = items.map(({ beach, region, island }) => {
    const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
    const islandName = displayName(island.name, region.id, language);
    const metaParts = [islandName, readableBeachType(beach, language)].filter(Boolean);
    const accessFeatures = category === 'accessible' ? accessibleFeatureLabels(beach, language) : [];
    const accessCaveats = category === 'accessible' ? accessibleCaveatLabels(beach, language) : [];
    const accessFeaturesHtml = accessFeatures.length
      ? `<span style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">${accessFeatures.map(label => `<span style="display:inline-flex;align-items:center;border:1px solid #bae6fd;border-radius:999px;background:#ecfeff;padding:3px 8px;color:#075985;font-size:12px;font-weight:700;">${escapeHtml(label)}</span>`).join('')}</span>`
      : '';
    const accessCaveatHtml = accessCaveats.length
      ? `<span style="display:block;margin-top:7px;color:#64748b;font-size:12px;line-height:1.45;">${escapeHtml(accessCaveats.join(' - '))}</span>`
      : '';
    const detailsHintHtml = category === 'accessible'
      ? `<span style="display:block;margin-top:7px;color:#0e7490;font-size:13px;font-weight:800;">${escapeHtml(accessCopy('details', language))}</span>`
      : '';

    let extra = '';
    if (category === 'camping' && Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) {
      const nearest = beach.nearbyCamping.reduce((closest, candidate) => (
        candidate.distanceMeters < closest.distanceMeters ? candidate : closest
      ));
      const campName = (language === 'en' && nearest.nameEn) ? nearest.nameEn : nearest.name;
      const label = language === 'gr' ? 'κάμπινγκ' : 'campsite';
      extra = `${label}: ${campName} · ${nearest.distanceMeters} m`;
    }

    return `
          <li style="margin:0;">
            <a href="${escapeHtml(localizedPath(beachPath(region, island, beach), locale))}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;background:white;color:#0f172a;text-decoration:none;">
              <strong style="color:#0e7490;">${escapeHtml(beachName)}</strong>
              ${metaParts.length ? `<span style="display:block;margin-top:4px;color:#475569;font-size:14px;">${escapeHtml(metaParts.join(' · '))}</span>` : ''}
              ${accessFeaturesHtml}
              ${accessCaveatHtml}
              ${detailsHintHtml}
              ${extra ? `<span style="display:block;margin-top:2px;color:#0e7490;font-size:13px;font-weight:600;">${escapeHtml(extra)}</span>` : ''}
            </a>
          </li>`;
  }).join('');

  return `
        <section${sectionId} style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">${cards}</ul>
        </section>`;
};

const renderRegionHubSection = (hubRegions, locale) => {
  const language = locale.language;
  const heading = localeText(hubSectionHeading, locale);
  const collator = language === 'gr' ? 'el' : 'en';
  const items = [...hubRegions]
    .sort((a, b) => localized(a.island.name, a.region.id, language)
      .localeCompare(localized(b.island.name, b.region.id, language), collator))
    .map(item => `
          <li style="margin:0;">
            <a href="${escapeHtml(localizedPath(item.path, locale))}" style="display:block;border:1px solid #bae6fd;border-radius:10px;padding:8px 11px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">${escapeHtml(localized(item.island.name, item.region.id, language))}</a>
          </li>`)
    .join('');

  return `
        <section style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0;padding:0;list-style:none;">${items}</ul>
        </section>`;
};

// Pick the data-driven section for a landing based on its kind.
const renderLandingDynamic = (landing, locale, dynamic) => {
  if (landing.kind === 'beachList') return renderBeachListSection(dynamic.items || [], locale, landing.category);
  if (landing.kind === 'regionHub') {
    // best-beaches-greece-today also leads with real, crawlable links to the most
    // popular individual beaches (it used to link regions only — a 2-hop crawl to
    // any beach). Other regionHub pages (sheltered-meltemi) keep the region grid.
    const topBeaches = (dynamic.topBeaches || []).length
      ? renderBeachListSection(dynamic.topBeaches, locale, 'top')
      : '';
    return `${topBeaches}${renderRegionHubSection(dynamic.hubRegions || [], locale)}`;
  }
  return '';
};

const landingAlternateUrls = landing => {
  const supported = prerenderLocales.filter(locale => landing.locales[locale.id]);
  return [
    ...supported.map(locale => ({
      hreflang: locale.hreflang,
      href: canonicalUrlFor(landing.pathName, locale),
    })),
    {
      hreflang: 'x-default',
      href: canonicalUrlFor(landing.pathName, prerenderLocales[0]),
    },
  ];
};

const buildSeoLandingPage = (baseHtml, landing, content, locale, imageUrl, dynamic = {}) => {
  const canonicalUrl = canonicalUrlFor(landing.pathName, locale);
  const imageAlt = locale.language === 'gr'
    ? `${content.h1} — CalmBeach Greece`
    : `${content.h1} on CalmBeach Greece`;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: content.title,
      description: content.description,
      url: canonicalUrl,
      image: imageUrl,
      inLanguage: locale.htmlLang,
      isPartOf: {
        '@type': 'WebSite',
        name: 'CalmBeach Greece',
        url: canonicalUrlFor('/', locale),
      },
    },
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: content.h1, url: canonicalUrl },
    ]),
  ];

  // Beach-list guides expose their list as ItemList structured data, mirroring
  // the region pages, so the curated beaches are machine-readable too.
  if (landing.kind === 'beachList' && Array.isArray(dynamic.items) && dynamic.items.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      numberOfItems: dynamic.items.length,
      itemListElement: dynamic.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: displayName(item.beach.name, `Beach ${item.beach.id}`, locale.language),
        url: canonicalUrlFor(beachPath(item.region, item.island, item.beach), locale),
      })),
    });
  }
  if (Array.isArray(content.faq) && content.faq.length > 0) {
    jsonLd.push(faqJsonLd(content.faq.filter(item => item?.q && item?.a)));
  }

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: content.title,
    description: content.description,
    canonicalUrl,
    imageUrl,
    imageAlt,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: landingAlternateUrls(landing),
    ogType: 'website',
    jsonLd,
  });

  const dynamicHtml = renderLandingDynamic(landing, locale, dynamic);
  return stripClientScripts(htmlWithHead).replace(/<div id="root">\s*<\/div>/i, staticSeoLandingPage(content, locale, dynamicHtml));
};

const buildHomePage = (baseHtml, locale, imageUrl, emittedLocales = baseLocales) => {
  const pathName = '/';
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CalmBeach Greece',
    alternateName: ['Calm Beach Greece', 'CalmBeach'],
    description: locale.homeDescription,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: locale.htmlLang,
  };

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: locale.homeTitle,
    description: locale.homeDescription,
    canonicalUrl,
    imageUrl,
    imageAlt: locale.homeImageAlt,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticHomeFallback(canonicalUrl, locale));
};

const buildRegionPage = (baseHtml, island, region, imageUrl, locale = prerenderLocales[0], emittedLocales = baseLocales) => {
  const pathName = regionPath(region, island);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const islandName = displayName(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const description = pickLang(language, {
    en: `${islandName} beaches in Greece. Compare ${beaches.length} beaches by live wind, waves, weather and exposure to find calmer swimming spots today.`,
    gr: `${islandName}: σύγκρινε ${beaches.length} παραλίες και δες σημερινό άνεμο, κύμα, καιρό και προτάσεις για μπάνιο.`,
    de: `${islandName}, Griechenland – vergleiche ${beaches.length} Strände nach Wind, Wellen, Wetter und Lage und finde heute ruhigere Buchten zum Schwimmen.`,
    fr: `${islandName}, Grèce – comparez ${beaches.length} plages selon le vent, les vagues, la météo et l'exposition pour trouver aujourd'hui des coins plus calmes où vous baigner.`,
    it: `${islandName}, Grecia – confronta ${beaches.length} spiagge in base a vento, onde, meteo ed esposizione per trovare oggi insenature più tranquille dove nuotare.`,
  });
  const title = pickLang(language, {
    en: `${islandName} Beaches Today | CalmBeach Greece`,
    gr: `Παραλίες: ${islandName} | Άνεμος & κύμα σήμερα`,
    de: `Strände: ${islandName} | CalmBeach Griechenland`,
    fr: `Plages : ${islandName} | CalmBeach Grèce`,
    it: `Spiagge: ${islandName} | CalmBeach Grecia`,
  });
  const regionPageName = `${islandName} beaches`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pickLang(language, { en: `${islandName} beaches`, gr: `Παραλίες: ${islandName}`, de: `Strände: ${islandName}`, fr: `Plages : ${islandName}`, it: `Spiagge: ${islandName}` }),
    description,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: locale.htmlLang,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: beaches.length,
      itemListElement: beaches.slice(0, 80).map((beach, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: displayName(beach.name, `Beach ${beach.id}`, language),
        url: canonicalUrlFor(beachPath(region, island, beach), locale),
      })),
    },
  };
  const jsonLd = [
    pageJsonLd,
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: regionPageName, url: canonicalUrl },
    ]),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: pickLang(language, { en: `${islandName} beaches in Greece`, gr: `Παραλίες σε ${islandName}`, de: `Strände – ${islandName}, Griechenland`, fr: `Plages – ${islandName}, Grèce`, it: `Spiagge – ${islandName}, Grecia` }),
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticRegionFallback(island, region, canonicalUrl, locale));
};

const staticIslandIntentFallback = (content, island, region, beaches, canonicalUrl, locale, intent) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const islandName = displayName(island.name, region.id, language);
  const homeHref = homePathForLocale(locale);
  const regionHref = localizedPath(regionPath(region, island), locale);
  const sep = '<span style="color:#94a3b8;"> › </span>';
  const beachItems = beaches.map(beach => {
    const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
    const blurb = intentBeachBlurbText(region, beach, language);
    return `
            <li style="margin:0;border:1px solid #bae6fd;border-radius:12px;background:white;">
              <a href="${escapeHtml(localizedPath(beachPath(region, island, beach), locale))}" style="display:block;padding:10px 12px ${blurb ? '4px' : '10px'};color:#0f172a;text-decoration:none;">
                <strong style="color:#0e7490;">${escapeHtml(beachName)}</strong>
                ${renderBeachSummaryMeta(beach, language)}
              </a>
              ${blurb ? `<p style="margin:0;padding:0 12px 10px;color:#334155;font-size:14px;line-height:1.5;">${escapeHtml(blurb)}</p>` : ''}
            </li>`;
  }).join('');

  return `
    <div id="root">
      <main data-static-fallback style="max-width:840px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <p style="margin:0 0 8px;color:#0e7490;font-weight:700;">${escapeHtml(copy.brand)}</p>
        <nav aria-label="breadcrumb" style="margin:0 0 14px;font-size:13px;font-weight:700;">
          <a href="${escapeHtml(homeHref)}" style="color:#0e7490;text-decoration:none;">${escapeHtml(copy.home)}</a>${sep}<a href="${escapeHtml(regionHref)}" style="color:#0e7490;text-decoration:none;">${escapeHtml(copy.regionHeading(islandName))}</a>${sep}<span style="color:#475569;">${escapeHtml(content.h1)}</span>
        </nav>
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(content.h1)}</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(content.intro)}</p>
        ${beachItems ? `<ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0 0 24px;padding:0;list-style:none;">${beachItems}</ul>` : ''}
        <div style="display:grid;gap:16px;margin:0 0 8px;">
          ${content.sections.map(section => `
            <section style="border-top:1px solid #bae6fd;padding-top:16px;">
              <h2 style="margin:0 0 8px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(section.heading)}</h2>
              <p style="margin:0;font-size:16px;line-height:1.58;color:#334155;">${escapeHtml(section.body)}</p>
            </section>`).join('')}
        </div>
        ${renderIslandGuides(island, region, locale, intent?.key, pickLang(language, {
          en: `More ${islandName} beach guides`,
          gr: `Άλλοι οδηγοί παραλιών — ${islandName}`,
          de: `Weitere ${islandName} Strandführer`,
          fr: `Autres guides plages — ${islandName}`,
          it: `Altre guide spiagge — ${islandName}`,
        }))}
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">${escapeHtml(copy.viewRegion(islandName))}</a></p>
      </main>
    </div>
  `;
};

const buildIslandIntentPage = (baseHtml, intent, content, island, region, beaches, imageUrl, locale, emittedLocales = baseLocales) => {
  const pathName = islandIntentPath(intent, region, island);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const islandName = displayName(island.name, region.id, language);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: content.h1,
      description: content.description,
      url: canonicalUrl,
      image: imageUrl,
      inLanguage: locale.htmlLang,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: beaches.length,
        itemListElement: beaches.map((beach, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: displayName(beach.name, `Beach ${beach.id}`, language),
          description: intentBeachBlurbText(region, beach, language) || undefined,
          url: canonicalUrlFor(beachPath(region, island, beach), locale),
        })),
      },
    },
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: `${islandName} beaches`, url: canonicalUrlFor(regionPath(region, island), locale) },
      { name: content.h1, url: canonicalUrl },
    ]),
    faqJsonLd(content.sections.map(section => ({ q: section.heading, a: section.body }))),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: content.title,
    description: content.description,
    canonicalUrl,
    imageUrl,
    imageAlt: content.h1,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return stripClientScripts(htmlWithHead).replace(/<div id="root">\s*<\/div>/i, staticIslandIntentFallback(content, island, region, beaches, canonicalUrl, locale, intent));
};

const buildBeachPage = (baseHtml, island, beach, region, imageUrl, locale = prerenderLocales[0], emittedLocales = baseLocales) => {
  const pathName = beachPath(region, island, beach);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const beachName = displayName(beach.name, `Beach ${beach.id}`, language);
  const islandName = displayName(island.name, region.id, language);
  const description = beachMetaDescription(beach, region, beachName, islandName, language);
  const title = beachTitleFor(beachName, islandName, language);
  const beachPageName = localizedBeachLabel(beachName, language);
  const beachRegionPageName = `${islandName} beaches`;
  // When a curated editorial story exists, expose its full text as the
  // schema.org disambiguatingDescription so the entity carries the rich,
  // unique narrative (the short `description` stays snippet-length).
  const story = getBeachStory(region, beach, language);
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: beachAttractionName(beachName, language),
    description,
    disambiguatingDescription: story ? story.paragraphs.join(' ') : undefined,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: locale.htmlLang,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GR',
      addressRegion: islandName,
    },
    geo: beach.coordinates ? {
      '@type': 'GeoCoordinates',
      latitude: beach.coordinates.lat,
      longitude: beach.coordinates.lon,
    } : undefined,
  };
  const jsonLd = [
    pageJsonLd,
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: homeUrlForLocale(locale) },
      { name: beachRegionPageName, url: canonicalUrlFor(regionPath(region, island), locale) },
      { name: beachPageName, url: canonicalUrl },
    ]),
  ];
  const faqPairs = buildBeachFaqPairs(beach, island, language);
  if (faqPairs.length >= 2) jsonLd.push(faqJsonLd(faqPairs));

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: beachImageAltFor(beachName, islandName, language),
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticBeachFallback(beach, island, region, canonicalUrl, locale));
};

const sitemapEntry = (url, imageUrl, lastmod) => ({ url, imageUrl, lastmod });

const renderSitemapEntry = (entry, fallbackLastmod) => {
  const imageTag = entry.imageUrl
    ? `<image:image><image:loc>${escapeXml(entry.imageUrl)}</image:loc></image:image>`
    : '';

  return `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastmod || fallbackLastmod}</lastmod>${imageTag}</url>`;
};

const main = async () => {
  const [baseHtml, beachIndex, publicAssets] = await Promise.all([
    readFile(indexHtmlPath, 'utf8'),
    readJson(beachIndexPath),
    listRootPublicAssets(),
  ]);

  const homeOgImageUrl = toAbsolutePublicUrl(publicAssets.has(homeOgImagePath) ? homeOgImagePath : defaultOgImagePath);
  const homeSitemapImageUrl = toSitemapImageUrl(homeOgImageUrl, publicAssets);
  const sitemapEntries = [];
  const redirects = [];
  let pageCount = 0;
  let regionPageCount = 0;
  let landingPageCount = 0;
  let islandIntentPageCount = 0;

  // Home stays national (en + el). Adding /de//fr//it/ home pages would require
  // their guide links (en/el only) to resolve; keep the multilingual cluster
  // scoped to the pilot region instead.
  for (const locale of baseLocales) {
    const homeRoutePath = localizedPath('/', locale);
    const homeOutputDir = outputDirForRoute(homeRoutePath);
    await mkdir(homeOutputDir, { recursive: true });
    await writeFile(path.join(homeOutputDir, 'index.html'), buildHomePage(baseHtml, locale, homeOgImageUrl, baseLocales), 'utf8');
    sitemapEntries.push(sitemapEntry(canonicalUrlFor('/', locale), homeSitemapImageUrl));
  }

  // Consolidation 301s for the retired generic landing pages.
  for (const redirect of landingRedirects) {
    for (const locale of baseLocales) {
      const from = localizedPath(redirect.from, locale);
      const to = localizedPath(redirect.to, locale);
      redirects.push(`${from} ${to} 301`);
      redirects.push(`${from.replace(/\/$/, '')} ${to} 301`);
    }
  }

  // Pre-pass: aggregate beaches across all regions for the data-driven guide
  // pages. Read the full app payload (a superset of the summary) because
  // `campsites` lives only there; region/beach page generation below stays on
  // the summary tier unchanged.
  const categoryBuckets = { accessible: [], family: [], camping: [] };
  const hubRegions = [];
  const topBeaches = [];
  const islandIntentPages = [];
  let islandIntentBelowMin = 0;
  for (const region of beachIndex.regions || []) {
    let appPayload;
    try {
      appPayload = await readJson(toPublicFilePath(region.appDataPath || `/data/beaches/app/${region.id}.json`));
    } catch {
      continue;
    }

    const island = appPayload.island;
    if (!island?.id || !Array.isArray(island.beaches)) continue;

    hubRegions.push({ region, island, path: regionPath(region, island) });

    for (const beach of island.beaches) {
      if (!Number.isInteger(beach.id) || !beach.name) continue;
      const entry = { beach, region, island };
      topBeaches.push(entry);
      if (beach.environment?.familyFriendly === true) categoryBuckets.family.push(entry);
      // Mirror hasDisabledAccess in services/recommendationService.ts: seatrac may
      // sit on the beach or under metadata, and only an online unit qualifies
      // (wrong info can strand a wheelchair user).
      const seatrac = getBeachSeatrac(beach);
      if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') categoryBuckets.accessible.push(entry);
      if (Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) categoryBuckets.camping.push(entry);
    }

    // Per-island intent guides: only emit when the island clears the minimum so
    // we never publish near-empty doorway pages.
    for (const intent of islandIntents) {
      const matches = island.beaches
        .filter(beach => Number.isInteger(beach.id) && beach.name && intent.match(beach))
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, ISLAND_INTENT_CAP);
      if (matches.length >= ISLAND_INTENT_MIN) {
        islandIntentPages.push({ intent, region, island, beaches: matches });
      } else if (matches.length > 0) {
        islandIntentBelowMin += 1;
      }
    }
  }

  // Rank each bucket by crowd popularity (proxy for notability), then cap.
  const LANDING_LIST_CAP = 24;
  for (const key of Object.keys(categoryBuckets)) {
    categoryBuckets[key].sort((a, b) => {
      const byPopularity = (b.beach.popularityScore ?? 0) - (a.beach.popularityScore ?? 0);
      if (byPopularity !== 0) return byPopularity;
      return localized(a.beach.name, '', 'en').localeCompare(localized(b.beach.name, '', 'en'));
    });
    categoryBuckets[key] = categoryBuckets[key].slice(0, LANDING_LIST_CAP);
  }

  // National most-popular beaches, for the best-beaches-greece-today hub.
  topBeaches.sort((a, b) => (b.beach.popularityScore ?? 0) - (a.beach.popularityScore ?? 0));
  const topNationalBeaches = topBeaches.slice(0, LANDING_LIST_CAP);

  for (const landing of seoLandingPages) {
    const dynamic = landing.kind === 'beachList'
      ? { items: categoryBuckets[landing.category] || [] }
      : landing.kind === 'regionHub'
        ? { hubRegions, topBeaches: landing.pathName === '/best-beaches-greece-today/' ? topNationalBeaches : [] }
        : {};

    for (const locale of prerenderLocales) {
      const content = landing.locales[locale.id];
      if (!content) continue;

      const landingOutputDir = outputDirForRoute(localizedPath(landing.pathName, locale));
      await mkdir(landingOutputDir, { recursive: true });
      await writeFile(path.join(landingOutputDir, 'index.html'), buildSeoLandingPage(baseHtml, landing, content, locale, homeOgImageUrl, dynamic), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(landing.pathName, locale), homeSitemapImageUrl));
      landingPageCount += 1;
    }
  }

  // Programmatic per-island intent guides (gated above by ISLAND_INTENT_MIN).
  for (const page of islandIntentPages) {
    const intentOgImageUrl = toAbsolutePublicUrl(resolveRegionOgImagePath(page.region, page.island, publicAssets));
    const intentSitemapImageUrl = toSitemapImageUrl(intentOgImageUrl, publicAssets);
    const pathName = islandIntentPath(page.intent, page.region, page.island);
    const emittedLocales = localesForRegion(page.region.id);
    for (const locale of emittedLocales) {
      const islandName = displayName(page.island.name, page.region.id, locale.language);
      const localeCopy = page.intent.copy(islandName, page.beaches.length);
      const content = localeCopy[locale.language] || localeCopy.en;
      const intentOutputDir = outputDirForRoute(localizedPath(pathName, locale));
      await mkdir(intentOutputDir, { recursive: true });
      await writeFile(path.join(intentOutputDir, 'index.html'), buildIslandIntentPage(baseHtml, page.intent, content, page.island, page.region, page.beaches, intentOgImageUrl, locale, emittedLocales), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(pathName, locale), intentSitemapImageUrl));
      islandIntentPageCount += 1;
    }
  }
  console.log(`Island intent guides: ${islandIntentPages.length} published (≥${ISLAND_INTENT_MIN} beaches), ${islandIntentBelowMin} island×intent combos skipped below threshold.`);

  for (const region of beachIndex.regions || []) {
    const summaryPath = region.summaryDataPath || `/data/beaches/app/summary/${region.id}.json`;
    let payload;

    try {
      payload = await readJson(toPublicFilePath(summaryPath));
    } catch {
      payload = await readJson(toPublicFilePath(region.appDataPath || `/data/beaches/app/${region.id}.json`));
    }

    const island = payload.island;
    if (!island?.id || !Array.isArray(island.beaches)) continue;

    const regionOgImageUrl = toAbsolutePublicUrl(resolveRegionOgImagePath(region, island, publicAssets));
    const regionSitemapImageUrl = toSitemapImageUrl(regionOgImageUrl, publicAssets);
    // Per-page freshness: the region's data-generation date, not a single build
    // stamp for all 5.7k URLs. Falls back to the build date when absent.
    const regionLastmod = (payload.generatedAt || '').slice(0, 10) || undefined;
    const currentRegionPath = regionPath(region, island);
    const currentLegacyRegionPath = legacyRegionPath(region.id);
    if (currentLegacyRegionPath !== currentRegionPath) {
      redirects.push(`${currentLegacyRegionPath} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath.replace(/\/$/, '')} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath}* ${currentRegionPath}:splat 301`);
    }

    const emittedLocales = localesForRegion(region.id);
    for (const locale of emittedLocales) {
      const localizedRegionPath = localizedPath(currentRegionPath, locale);
      const regionOutputDir = outputDirForRoute(localizedRegionPath);
      await mkdir(regionOutputDir, { recursive: true });
      await writeFile(path.join(regionOutputDir, 'index.html'), buildRegionPage(baseHtml, island, region, regionOgImageUrl, locale, emittedLocales), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(currentRegionPath, locale), regionSitemapImageUrl, regionLastmod));
      regionPageCount += 1;
    }

    for (const beach of island.beaches) {
      if (!Number.isInteger(beach.id) || !beach.name) continue;

      const routePath = beachPath(region, island, beach);
      for (const legacyPath of legacyBeachPaths(region, island, beach)) {
        redirects.push(`${legacyPath} ${routePath} 301`);
        redirects.push(`${legacyPath.replace(/\/$/, '')} ${routePath} 301`);
      }

      for (const locale of emittedLocales) {
        const localizedRoutePath = localizedPath(routePath, locale);
        const outputDir = outputDirForRoute(localizedRoutePath);
        await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, 'index.html'), buildBeachPage(baseHtml, island, beach, region, regionOgImageUrl, locale, emittedLocales), 'utf8');
        sitemapEntries.push(sitemapEntry(canonicalUrlFor(routePath, locale), regionSitemapImageUrl, regionLastmod));
        pageCount += 1;
      }
    }
  }

  const lastmod = new Date().toISOString().slice(0, 10);
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...sitemapEntries.map(entry => renderSitemapEntry(entry, lastmod)),
    '</urlset>',
    '',
  ].join('\n');

  await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
  if (redirects.length > 0) {
    await writeFile(path.join(distDir, '_redirects'), `${redirects.join('\n')}\n`, 'utf8');
  }
  console.log(`Prerendered ${baseLocales.length} home pages, ${landingPageCount} SEO landing pages, ${islandIntentPageCount} island intent pages, ${regionPageCount} region pages, ${pageCount} beach pages, ${redirects.length} redirects and sitemap.xml`);
};

main().catch(error => {
  console.error('Failed to prerender beach pages.', error);
  process.exitCode = 1;
});
