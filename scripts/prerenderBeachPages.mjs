import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { amenityTextIncludesAny, SNACK_CANTEEN_AMENITY_TERMS } from '../utils/amenityMatching.js';
import { localWindLabelFor, getRegionWindContext, localWindSectorsFor, LOCAL_WIND_ATOMS } from '../utils/localWindContext.mjs';

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
    homeTitle: 'CalmBeach Greece - Compare Beaches by Wind & Waves',
    homeDescription: 'Compare Greek beaches by wind, waves, weather, beach exposure and protection so you can choose a better spot before you go.',
    homeImageAlt: 'CalmBeach Greece beach recommendations by wind and waves',
  },
  {
    id: 'el',
    language: 'gr',
    htmlLang: 'el',
    hreflang: 'el',
    ogLocale: 'el_GR',
    pathPrefix: '/el',
    homeTitle: 'Calm Beach Greece - Σύγκριση παραλιών με άνεμο και κύμα',
    homeDescription: 'Calm Beach Greece - Σύγκρινε ελληνικές παραλίες με βάση άνεμο, κύμα, καιρό και έκθεση πριν διαλέξεις πού θα πας.',
    homeImageAlt: 'Calm Beach Greece προτάσεις παραλιών',
  },
  {
    id: 'de',
    language: 'de',
    htmlLang: 'de',
    hreflang: 'de',
    ogLocale: 'de_DE',
    pathPrefix: '/de',
    homeTitle: 'CalmBeach Griechenland - Strande nach Wind und Wellen vergleichen',
    homeDescription: 'Vergleiche griechische Strande nach Wind, Wellen, Wetter und Exposition, bevor du deinen Badeplatz auswählst.',
    homeImageAlt: 'CalmBeach Griechenland – Strandempfehlungen nach Wind und Wellen',
  },
  {
    id: 'fr',
    language: 'fr',
    htmlLang: 'fr',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    pathPrefix: '/fr',
    homeTitle: 'CalmBeach Grece - Comparer les plages par vent et vagues',
    homeDescription: 'Comparez les plages grecques selon le vent, les vagues, la meteo et l’exposition avant de choisir ou vous baigner.',
    homeImageAlt: 'CalmBeach Grèce – recommandations de plages selon le vent et les vagues',
  },
  {
    id: 'it',
    language: 'it',
    htmlLang: 'it',
    hreflang: 'it',
    ogLocale: 'it_IT',
    pathPrefix: '/it',
    homeTitle: 'CalmBeach Grecia - Confronta spiagge per vento e onde',
    homeDescription: 'Confronta le spiagge greche per vento, onde, meteo ed esposizione prima di scegliere dove fare il bagno.',
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
// Multilingual rollout by foreign demand. MUST stay 1:1 in sync with
// LOCALIZED_REGION_SLUGS in utils/beachUrls.ts (full region id here, bare URL
// slug there) — a drift makes the client emit /de|fr|it links to pages that were
// never prerendered (404 on reload).
const LOCALIZED_REGIONS = new Set([
  'south-aegean-milos',   // pilot
  // Wave 1 — Cyclades core
  'south-aegean-naxos',
  'south-aegean-paros',
  'south-aegean-mykonos',
  'south-aegean-santorini',
  'south-aegean-ios',
  'south-aegean-sifnos',
  // Wave 2 — top foreign-tourist destinations (Crete + Dodecanese majors + Ionian)
  // Rolled out 2026-07-15 after Wave 1 held healthy for 4 days (de/fr/it impressions
  // rising, de→Germany targeting 0.65, zero errors). Slugs mirror LOCALIZED_REGION_SLUGS.
  'crete-crete-chania',
  'crete-crete-heraklion',
  'crete-crete-rethymno',
  'crete-crete-lasithi',
  'south-aegean-rhodes',
  'south-aegean-kos',
  'ionian-islands-corfu',
  'ionian-islands-zakynthos',
  'ionian-islands-kefalonia',
  'ionian-islands-lefkada',
]);
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
        intro: 'CalmBeach helps you compare Greek beaches by wind, waves, weather, exposure and access before you choose where to swim. Here are the questions people ask most.',
        sections: [],
        faq: [
          {
            q: 'How reliable is the CalmBeach forecast?',
            a: 'Wind, waves and temperature are a live weather forecast, not an on-the-spot measurement. It shows what is likely, so it is more accurate closer to the day than a week ahead. We present it as honestly as we can — for example a wave-height range instead of a false single number — and you should always double-check with your own eyes when you arrive.',
          },
          {
            q: 'What does wind exposure mean and how do you find less exposed beaches?',
            a: 'For each beach we look at shoreline orientation and surrounding terrain to estimate whether wind is likely to blow onshore or whether nearby land may reduce exposure. This helps compare beaches that may feel more manageable with beaches that are likely to pick up chop.',
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
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/accessible-beaches-greece/', label: 'Accessible beaches in Greece' },
        ],
      },
      el: {
        title: 'Συχνές ερωτήσεις | CalmBeach Greece',
        description: 'Συχνές ερωτήσεις για το CalmBeach: πόσο αξιόπιστη είναι η πρόγνωση, τι σημαίνει έκθεση σε άνεμο, πώς υπολογίζεται το κύμα, από πού είναι τα δεδομένα και ασφάλεια στο μπάνιο.',
        h1: 'Συχνές ερωτήσεις',
        intro: 'Το CalmBeach σε βοηθά να συγκρίνεις ελληνικές παραλίες με βάση άνεμο, κύμα, καιρό, έκθεση και πρόσβαση πριν διαλέξεις πού θα κολυμπήσεις. Εδώ είναι οι πιο συχνές ερωτήσεις.',
        sections: [],
        faq: [
          {
            q: 'Πόσο αξιόπιστη είναι η πρόγνωση του CalmBeach;',
            a: 'Ο άνεμος, το κύμα και η θερμοκρασία είναι ζωντανή μετεωρολογική πρόγνωση, όχι μέτρηση επί τόπου. Δείχνει τι είναι πιθανό να επικρατεί, γι\' αυτό είναι πιο ακριβής κοντά στη μέρα παρά μία βδομάδα μπροστά. Την παρουσιάζουμε όσο πιο τίμια γίνεται — π.χ. εύρος κύματος αντί για ένα δήθεν «σίγουρο» νούμερο — και καλό είναι να την ελέγχεις πάντα και με τα μάτια σου φτάνοντας.',
          },
          {
            q: 'Τι σημαίνει «έκθεση σε άνεμο» και πώς βρίσκετε τις πιο ήρεμες παραλίες;',
            a: 'Για κάθε παραλία κοιτάμε τον προσανατολισμό της ακτής και το γύρω ανάγλυφο, ώστε να εκτιμήσουμε αν ο άνεμος πιθανόν τη χτυπάει πιο άμεσα ή αν η στεριά μπορεί να μειώνει την έκθεση. Έτσι συγκρίνουμε παραλίες που μπορεί να είναι πιο διαχειρίσιμες με παραλίες που πιθανόν πιάνουν περισσότερο κύμα.',
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
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
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
        title: 'Compare Greek Beaches by Wind, Waves & Shelter | CalmBeach',
        description: 'Compare Greek beaches by wind, waves, weather, exposure and shelter, then open any beach for live conditions before you choose where to swim.',
        h1: 'Compare Greek beaches by wind, waves and protection',
        intro: 'CalmBeach helps you compare beach options across Greece using the conditions that matter before you swim: wind, waves, weather, exposure, access and beach type.',
        sections: [
          {
            heading: 'How CalmBeach compares beaches',
            body: 'The app combines forecast conditions with static beach information so you can quickly see which beaches may be more suitable for your plans. It avoids treating a famous beach as the obvious choice when wind or waves make another option more practical.',
          },
          {
            heading: 'What to check before you go',
            body: 'Look at the current wind direction, wind strength, wave height, beach exposure, access and amenities. Conditions can vary locally, so CalmBeach keeps recommendations cautious instead of promising perfect conditions.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach beach search' },
          { href: '/family-beaches-greece/', label: 'Family beaches in Greece' },
          { href: '/sheltered-beaches-meltemi/', label: 'Beaches usually better with Meltemi winds' },
          { href: '/faq/', label: 'How CalmBeach works (FAQ)' },
        ],
      },
      el: {
        title: 'Σύγκριση Παραλιών στην Ελλάδα: Άνεμος & Κύμα | CalmBeach',
        description: 'Σύγκρινε ελληνικές παραλίες με άνεμο, κύμα, καιρό, έκθεση και προστασία, και άνοιξε κάθε παραλία για live συνθήκες πριν διαλέξεις πού θα κολυμπήσεις.',
        h1: 'Σύγκριση ελληνικών παραλιών με άνεμο, κύμα και προστασία',
        intro: 'Το CalmBeach σε βοηθά να συγκρίνεις παραλίες σε όλη την Ελλάδα με βάση αυτά που μετράνε πριν το μπάνιο: άνεμος, κύμα, καιρός, έκθεση, πρόσβαση και τύπος παραλίας.',
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
          { href: '/', label: 'Άνοιξε την αναζήτηση CalmBeach' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες' },
          { href: '/sheltered-beaches-meltemi/', label: 'Επιλογές με μελτέμι' },
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
        title: 'More Sheltered Greek Beaches for the Meltemi | CalmBeach',
        description: 'Find Greek beaches oriented away from northerly Meltemi winds, then open any beach for live wind and waves before you go.',
        h1: 'Beaches usually better with Meltemi winds',
        intro: 'In July and August the Meltemi can blow strong from the north across the Aegean. A more comfortable beach is usually one with less exposure to that wind direction, not simply the most popular one.',
        sections: [
          {
            heading: 'Which coasts are often more comfortable',
            body: 'When the Meltemi blows from the north, south and southwest-facing bays may be more protected, while exposed north coasts often pick up wind and chop. The better side changes with wind direction, so check wind and waves before you go.',
          },
          {
            heading: 'A cautious recommendation',
            body: 'CalmBeach treats protection as a cautious signal based on beach orientation, exposure and available data. On strong wind days it prefers caution and reminds you to follow local flags and lifeguard guidance.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach beach search' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/beach-camping-greece/', label: 'Beaches with camping nearby' },
        ],
      },
      el: {
        title: 'Πιο Απάνεμες Παραλίες στο Μελτέμι — Ελλάδα | CalmBeach',
        description: 'Βρες ελληνικές παραλίες με προσανατολισμό μακριά από το βόρειο μελτέμι, και άνοιξε κάθε παραλία για live άνεμο και κύμα πριν πας.',
        h1: 'Παραλίες που συχνά βολεύουν με μελτέμι',
        intro: 'Τον Ιούλιο και τον Αύγουστο το μελτέμι φυσά δυνατά από τον βορρά στο Αιγαίο. Μια πιο άνετη παραλία είναι συνήθως αυτή με μικρότερη έκθεση σε αυτή την κατεύθυνση ανέμου, όχι απλώς η πιο δημοφιλής.',
        sections: [
          {
            heading: 'Ποιες ακτές είναι συχνά πιο άνετες',
            body: 'Όταν το μελτέμι φυσά βόρεια, οι νότιοι και νοτιοδυτικοί κόλποι μπορεί να είναι πιο προστατευμένοι, ενώ οι εκτεθειμένες βόρειες ακτές συχνά πιάνουν αέρα και κύμα. Η καλύτερη πλευρά αλλάζει με την κατεύθυνση, γι\' αυτό έλεγξε τις συνθήκες πριν πας.',
          },
          {
            heading: 'Προσεκτική πρόταση',
            body: 'Το CalmBeach χαρακτηρίζει μια παραλία πιο υπήνεμη μόνο όταν το επιτρέπουν η έκθεση και η πρόγνωση. Σε μέρες με δυνατό αέρα προτιμά την προσοχή και θυμίζει να ακολουθείς τις τοπικές σημαίες και τον ναυαγοσώστη.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε την αναζήτηση CalmBeach' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
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
        title: 'Accessible Beaches in Greece with Seatrac | CalmBeach',
        description: 'Greek beaches with accessible facilities and Seatrac sea-access ramps where available. Open any beach for live wind & waves, and confirm access locally.',
        h1: 'Accessible Beaches in Greece',
        intro: 'Find beaches in Greece with easier access information, wheelchair-friendly facilities, ramps, accessible paths or Seatrac-style access where this information is available. CalmBeach helps you compare beach conditions before you choose where to go.',
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
            a: 'Yes. Each beach card links to its CalmBeach detail page where available conditions, wind, waves and beach exposure help you decide whether it fits your visit.',
          },
        ],
        sections: [
          {
            heading: 'What the cards show',
            body: 'Cards highlight only accessibility details already stored for that beach, such as an online Seatrac sea-access ramp, accessible parking, a boardwalk to the water, accessible WC, changing room or shower when those fields are available.',
          },
          {
            heading: 'Conditions still matter',
            body: 'Even when access information looks useful, wind and waves can change comfort at the beach. Open a beach page to compare wind, waves, weather and exposure before you go.',
          },
        ],
        links: [
          { href: '#accessible-beach-list', label: 'Explore accessible beaches' },
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/family-beaches-greece/', label: 'Family-friendly beaches' },
          { href: '/beaches/milos/', label: 'Browse Milos beaches' },
        ],
      },
      el: {
        title: 'Προσβάσιμες Παραλίες ΑμεΑ στην Ελλάδα (Seatrac) | CalmBeach',
        description: 'Ελληνικές παραλίες με υποδομές ΑμεΑ και συστήματα Seatrac όπου υπάρχουν. Άνοιξε κάθε παραλία για live άνεμο & κύμα και επιβεβαίωσε τοπικά πριν πας.',
        h1: 'Προσβάσιμες παραλίες ΑμεΑ',
        intro: 'Κάποιες ελληνικές παραλίες διαθέτουν υποδομές προσβασιμότητας, όπως ράμπες, προσβάσιμο πάρκινγκ ή συστήματα Seatrac για αυτόνομη πρόσβαση στη θάλασσα. Το CalmBeach σε βοηθά να τις βρεις και να δεις τον καιρό για τη μέρα.',
        sections: [
          {
            heading: 'Τι μπορεί να σημαίνει προσβασιμότητα',
            body: 'Η προσβασιμότητα διαφέρει ανά παραλία: πρόσβαση χωρίς σκαλιά, προσβάσιμο πάρκινγκ, διάδρομοι και συσκευές Seatrac που βοηθούν χρήστες αμαξιδίου να φτάσουν στο νερό. Επιβεβαίωσε πάντα ότι ο εξοπλισμός λειτουργεί πριν ταξιδέψεις.',
          },
          {
            heading: 'Οι συνθήκες πάλι μετράνε',
            body: 'Ακόμη και σε προσβάσιμη παραλία, ο άνεμος και το κύμα αλλάζουν την άνεση. Το CalmBeach συνδυάζει τις πληροφορίες προσβασιμότητας με άνεμο, κύμα και έκθεση, ώστε να συγκρίνεις πριν πας.',
          },
        ],
        links: [
          { href: '/', label: 'Άνοιξε το CalmBeach Greece' },
          { href: '/family-beaches-greece/', label: 'Οικογενειακές παραλίες με ήρεμα νερά' },
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
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
        title: 'Family Beaches in Greece with Shallow Water | CalmBeach',
        description: 'Family-friendly Greek beaches with shallow water and easier access. Open any beach for live wind & waves before you go.',
        h1: 'Family beaches in Greece',
        intro: 'For young children, shallow water and easy access often matter more than a famous name. CalmBeach helps you find family-friendly options and check conditions before you go.',
        sections: [
          {
            heading: 'What makes a beach family-friendly',
            body: 'Helpful features include shallow, gently shelving water, sand underfoot, shade or amenities nearby and easy access without a difficult path. CalmBeach surfaces these alongside wind and sea information.',
          },
          {
            heading: 'Check wind and waves first',
            body: 'Small waves and gusts that are fine for adults can be tiring for children. CalmBeach checks wind, waves and exposure so you can compare less exposed beaches and more comfortable visiting times.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/accessible-beaches-greece/', label: 'Accessible beaches in Greece' },
          { href: '/beach-camping-greece/', label: 'Beaches with camping nearby' },
        ],
      },
      el: {
        title: 'Παραλίες για Οικογένειες & Παιδιά στην Ελλάδα | CalmBeach',
        description: 'Οικογενειακές ελληνικές παραλίες με ρηχά νερά και εύκολη πρόσβαση. Άνοιξε κάθε παραλία για live άνεμο & κύμα πριν πας.',
        h1: 'Οικογενειακές παραλίες με ρηχά νερά',
        intro: 'Για μικρά παιδιά, μια πιο ήρεμη παραλία με ρηχά νερά και εύκολη πρόσβαση συχνά μετράει περισσότερο από ένα διάσημο όνομα. Το CalmBeach σε βοηθά να βρεις οικογενειακές επιλογές και να δεις τις συνθήκες της μέρας.',
        sections: [
          {
            heading: 'Τι κάνει μια παραλία κατάλληλη για οικογένειες',
            body: 'Βοηθούν τα ρηχά νερά με ομαλό βυθό, η άμμος, η σκιά ή οι κοντινές παροχές και η εύκολη πρόσβαση χωρίς δύσκολο μονοπάτι. Το CalmBeach τα δείχνει μαζί με πληροφορίες ανέμου και θάλασσας.',
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
        title: 'Beaches with Campsites Nearby in Greece | CalmBeach',
        description: 'Greek beaches with an official campsite nearby. Open any beach for live wind, waves and exposure to plan your stay before you go.',
        h1: 'Beaches with camping nearby',
        intro: 'If you are travelling with a tent or campervan, a beach with a campsite nearby can shape the whole trip. CalmBeach links beaches to nearby campsites and helps you check wind and sea conditions before you go.',
        sections: [
          {
            heading: 'Camping close to the sea',
            body: 'CalmBeach connects beaches to organised campsites within a short distance, so you can plan where to stay and swim together. It focuses on proper campsites rather than informal or prohibited spots.',
          },
          {
            heading: 'Check conditions before pitching',
            body: 'Exposed beaches can be windy for tents and choppy for swimming. Looking at wind direction, strength and exposure helps you pick a less exposed base for your stay.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/best-beaches-greece-today/', label: 'Compare Greek beaches by conditions' },
          { href: '/family-beaches-greece/', label: 'Family-friendly beaches' },
        ],
      },
      el: {
        title: 'Παραλίες με Κάμπινγκ Κοντά — Ελλάδα | CalmBeach',
        description: 'Ελληνικές παραλίες με κάμπινγκ κοντά. Άνοιξε κάθε παραλία για live άνεμο, κύμα και έκθεση για να σχεδιάσεις τη διαμονή σου πριν πας.',
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
          { href: '/best-beaches-greece-today/', label: 'Σύγκριση παραλιών με συνθήκες' },
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

// Category (per-island guide) titles, en/gr only. Static articles — NO live/
// today wording. Editorial "Best/Καλύτερες" is allowed on snorkeling (it is the
// literal query pattern, backed by a visible curated list); "More sheltered /
// Πιο Απάνεμες" is a comparative, orientation-based claim (protectedFrom), which
// the honesty guards accept via the "more"/"πιο" qualifier. de/fr/it titles stay
// as authored in each intent's copy (honest, Milos pilot only).
// { main } carries island + keyword; { tail } is the droppable qualifier.
const CATEGORY_TITLE = {
  sheltered:  { en: { main: islandName => `More Sheltered Beaches in ${islandName}`, tail: 'for the Meltemi' }, gr: { main: islandName => `${islandName}: Πιο Απάνεμες Παραλίες`, tail: 'στο Μελτέμι' } },
  family:     { en: { main: islandName => `Family Beaches in ${islandName}`, tail: 'with Shallow Water' },      gr: { main: islandName => `${islandName}: Παραλίες για Οικογένειες`, tail: '& Παιδιά' } },
  snorkeling: { en: { main: islandName => `Best Snorkeling Beaches in ${islandName}`, tail: '' },               gr: { main: islandName => `${islandName}: Οι Καλύτερες Παραλίες για Snorkeling`, tail: '' } },
  organized:  { en: { main: islandName => `Organized Beaches in ${islandName}`, tail: 'with Sunbeds' },         gr: { main: islandName => `${islandName}: Οργανωμένες Παραλίες`, tail: 'με Ξαπλώστρες' } },
  secluded:   { en: { main: islandName => `Secluded Beaches in ${islandName}`, tail: 'Away from Crowds' },      gr: { main: islandName => `${islandName}: Απομονωμένες Παραλίες`, tail: 'χωρίς Κόσμο' } },
  sunset:     { en: { main: islandName => `Sunset Beaches in ${islandName}`, tail: 'Facing West' },             gr: { main: islandName => `${islandName}: Παραλίες για Ηλιοβασίλεμα`, tail: '(Δυτικές)' } },
};
// Same deterministic tiers as beach titles: T1 full → T2 drop brand → T3 drop
// qualifier tail → T4 bare "{island}: {keyword}".
const categoryTitleFor = (key, islandName, language) => {
  const spec = CATEGORY_TITLE[key]?.[language];
  if (!spec) return null;
  const main = spec.main(islandName);
  const withTail = spec.tail ? `${main} ${spec.tail}` : main;
  const max = language === 'gr' ? 58 : 60;
  const tiers = [`${withTail} | CalmBeach`, withTail, main];
  for (const tier of tiers) if (tier.length <= max) return tier;
  return main;
};

// Category meta, en/gr only (spec §3.2): "{count} {phrase} — {island}: {basis}.
// {live CTA as a pointer to the per-beach pages}". The count is rebuild-fresh
// (never stale like "today"); the basis is the honest selection reason.
const CATEGORY_META = {
  sheltered:  { en: { phrase: 'sheltered picks',          basis: 'oriented away from northerly Meltemi winds' }, gr: { phrase: 'πιο απάνεμες επιλογές',     basis: 'με προσανατολισμό μακριά από το βόρειο μελτέμι' } },
  family:     { en: { phrase: 'family-friendly beaches',  basis: 'with shallow water and easier access' },       gr: { phrase: 'οικογενειακές παραλίες',    basis: 'με ρηχά νερά και ευκολότερη πρόσβαση' } },
  snorkeling: { en: { phrase: 'snorkeling beaches',       basis: 'with clearer water and rocky seabed' },        gr: { phrase: 'παραλίες για snorkeling',   basis: 'με καθαρότερα νερά και βραχώδη βυθό' } },
  organized:  { en: { phrase: 'organized beaches',        basis: 'with sunbeds, umbrellas and facilities' },     gr: { phrase: 'οργανωμένες παραλίες',      basis: 'με ξαπλώστρες, ομπρέλες και παροχές' } },
  secluded:   { en: { phrase: 'secluded beaches',         basis: 'quieter and harder to reach' },                gr: { phrase: 'απομονωμένες παραλίες',     basis: 'πιο ήσυχες και δύσκολες στην πρόσβαση' } },
  sunset:     { en: { phrase: 'west-facing beaches',      basis: 'that look out toward the sunset' },            gr: { phrase: 'δυτικές παραλίες',          basis: 'με θέα στο ηλιοβασίλεμα' } },
};
const CATEGORY_META_CTA = {
  long:  { en: 'Check live wind & waves for each beach on CalmBeach before you go.', gr: 'Δες live άνεμο & κύμα για κάθε παραλία στο CalmBeach πριν πας.' },
  short: { en: 'Check live wind & waves on CalmBeach.',                              gr: 'Δες live άνεμο & κύμα στο CalmBeach.' },
};
const categoryMetaFor = (key, islandName, count, language) => {
  const spec = CATEGORY_META[key]?.[language];
  if (!spec) return null;
  const head = language === 'en'
    ? `${count} ${spec.phrase} in ${islandName}: ${spec.basis}. `
    : `${count} ${spec.phrase} — ${islandName}: ${spec.basis}. `;
  for (const cta of [CATEGORY_META_CTA.long[language], CATEGORY_META_CTA.short[language]]) {
    const candidate = `${head}${cta}`;
    if (candidate.length <= 155) return candidate;
  }
  return truncateForMeta(`${head}${CATEGORY_META_CTA.short[language]}`, 155);
};

const islandIntents = [
  {
    key: 'sheltered',
    pathPrefix: '/sheltered-beaches',
    // NOTE: the loop special-cases 'sheltered' to use the geospatial meltemi set
    // (getMeltemiShelteredIds), so this per-beach match is a defensive fallback only.
    match: beach => Array.isArray(beach.protectedFrom) && NORTHERLY.some(d => beach.protectedFrom.includes(d)),
    // Wind-aware copy: `regionId` selects the regime word (meltemi / βοριάς /
    // Vardaris). de/fr/it stay on "meltemi" — only Aegean regions are localized.
    copy: (islandName, count, regionId = '') => {
      const w = windWordsFor(regionId);
      const prep = regionPrepGr(regionId, islandName);
      const enMain = `More Sheltered Beaches in ${islandName}`;
      const enWithTail = `${enMain} for ${w.en}`;
      const enTitle = pickUnderLimit([`${enWithTail} | CalmBeach`, enWithTail, enMain], 60);
      const grMain = `${islandName}: Πιο Απάνεμες Παραλίες`;
      const grWithTail = `${grMain} ${w.elIn}`;
      const grTitle = pickUnderLimit([`${grWithTail} | CalmBeach`, grWithTail, grMain], 58);
      return {
      en: {
        title: enTitle,
        description: truncateForMeta(`${count} sheltered beaches in ${islandName}, oriented away from ${w.en}. Check live wind & waves on CalmBeach before you go.`, 155),
        h1: `Beaches in ${islandName} usually better when ${w.enSubject} blows`,
        intro: `When ${w.enSubject} blows, more comfortable beaches in ${islandName} are often bays oriented away from it. These ${count} beaches sit away from it based on the geospatial exposure model — still check live conditions before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} may be better when ${w.enSubject} blows?`, body: `The bays listed here are shielded from ${w.en} in the exposure model, so they may be more comfortable when it blows. Local conditions still vary, so confirm wind and waves before you go.` },
          { heading: 'Does this guarantee low waves?', body: 'No. Shelter shows which coasts are shielded from a wind direction, not guaranteed calm or low waves. On strong-wind days follow local flags and check live wind and waves in the app.' },
        ],
      },
      gr: {
        title: grTitle,
        description: truncateForMeta(`${count} πιο απάνεμες παραλίες ${prep}, προστατευμένες ${w.elFrom}. Δες live άνεμο & κύμα στο CalmBeach πριν πας.`, 155),
        h1: `Παραλίες ${prep} που μένουν υπήνεμες ${w.elIn}`,
        intro: `Όταν φυσά ${w.elNom}, πιο άνετες επιλογές ${prep} είναι συχνά οι κόλποι που προστατεύονται ${w.elFrom}. Αυτές οι ${count} παραλίες είναι υπήνεμες με βάση το γεωχωρικό μοντέλο έκθεσης — έλεγξε ζωντανά τις συνθήκες πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες μένουν υπήνεμες ${w.elIn};`, body: `Οι κόλποι της λίστας προστατεύονται ${w.elFrom} σύμφωνα με το μοντέλο έκθεσης, οπότε μπορεί να είναι πιο άνετοι όταν φυσά. Οι συνθήκες αλλάζουν τοπικά, γι' αυτό έλεγξε άνεμο και κύμα πριν πας.` },
          { heading: 'Σημαίνει σίγουρα χαμηλό κύμα;', body: 'Όχι. Η προστασία δείχνει ποιες ακτές είναι υπήνεμες σε μια κατεύθυνση ανέμου, όχι εγγυημένη γαλήνη ή χαμηλό κύμα. Σε μέρες με δυνατό αέρα ακολούθησε τις τοπικές σημαίες και έλεγξε live άνεμο και κύμα στην εφαρμογή.' },
        ],
      },
      de: {
        title: `Strände auf ${islandName}, die oft besser beim Meltemi liegen | CalmBeach`,
        description: `Finde Strände auf ${islandName}, die vom nördlichen Meltemi abgewandt sind, und prüfe Wind und Wellen, bevor du losfährst.`,
        h1: `Strände auf ${islandName}, die oft besser beim Meltemi liegen`,
        intro: `Wenn der Meltemi aus dem Norden weht, sind auf ${islandName} oft Buchten angenehmer, die von ihm abgewandt liegen. Diese ${count} Strände sind laut vorhandenen Ausrichtungsdaten von Nordwinden abgewandt – prüfe trotzdem die Bedingungen, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} können beim Meltemi besser passen?`, body: `Die hier gelisteten, nach Süden und Westen ausgerichteten Buchten liegen abgewandt von Nordwinden und können beim Meltemi angenehmer sein. Die Bedingungen ändern sich örtlich, prüfe also Wind und Wellen, bevor du losfährst.` },
          { heading: 'Ist das Meer an diesen Stränden immer ruhig?', body: 'Nein. Die Ausrichtung zeigt, wohin eine Küste blickt, keinen garantierten Schutz und keine niedrigen Wellen. An windigen Tagen folge den örtlichen Flaggen und prüfe Wind und Wellen live in der App.' },
        ],
      },
      fr: {
        title: `Plages souvent plus confortables à ${islandName} par meltemi | CalmBeach`,
        description: `Trouvez à ${islandName} des plages orientées à l'opposé du meltemi de nord, puis vérifiez le vent et les vagues avant d'y aller.`,
        h1: `Plages à ${islandName} souvent plus confortables par meltemi`,
        intro: `Quand le meltemi souffle du nord, les baies orientées à l'opposé peuvent être plus confortables à ${islandName}. Ces ${count} plages sont listées selon les données d'orientation disponibles — vérifiez quand même les conditions avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} peuvent mieux convenir par meltemi ?`, body: `Les baies orientées au sud et à l'ouest listées ici sont tournées à l'opposé des vents de nord et peuvent être plus confortables quand le meltemi souffle. Les conditions varient localement, vérifiez donc le vent et les vagues avant d'y aller.` },
          { heading: 'La mer est-elle toujours calme sur ces plages ?', body: "Non. L'orientation indique vers où la côte est tournée, pas un abri garanti ni des vagues faibles. Les jours de vent fort, suivez les drapeaux locaux et vérifiez le vent et les vagues en direct dans l'application." },
        ],
      },
      it: {
        title: `Spiagge a ${islandName} spesso migliori con meltemi | CalmBeach`,
        description: `Trova a ${islandName} spiagge orientate lontano dal meltemi da nord, poi controlla vento e onde prima di andare.`,
        h1: `Spiagge a ${islandName} spesso migliori con meltemi`,
        intro: `Quando il meltemi soffia da nord, a ${islandName} possono essere più comode le insenature orientate dalla parte opposta. Queste ${count} spiagge sono elencate in base ai dati di orientamento disponibili — controlla comunque le condizioni prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} possono andare meglio con meltemi?`, body: `Le insenature esposte a sud e a ovest elencate qui sono orientate lontano dai venti di nord, quindi possono essere più comode quando soffia il meltemi. Le condizioni variano localmente, controlla vento e onde prima di andare.` },
          { heading: 'Il mare è sempre calmo in queste spiagge?', body: "No. L'orientamento indica verso dove guarda la costa, non un riparo garantito o onde basse. Nei giorni di vento forte segui le bandiere locali e controlla vento e onde in tempo reale nell'app." },
        ],
      },
      };
    },
  },
  {
    key: 'family',
    pathPrefix: '/family-beaches',
    match: beach => beach.environment?.familyFriendly === true,
    copy: (islandName, count) => ({
      en: {
        title: categoryTitleFor('family', islandName, 'en'),
        description: categoryMetaFor('family', islandName, count, 'en'),
        h1: `Family beaches in ${islandName}`,
        intro: `Travelling with young children in ${islandName}? These ${count} family-friendly beaches tend to have shallower water and easier access. Check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are family-friendly?`, body: 'The beaches listed here are marked family-friendly, usually with shallower water and easier access. For small children, still check wind and waves before you go.' },
          { heading: 'How do I compare sea conditions?', body: 'CalmBeach checks wind, waves and exposure, so you can compare less exposed beaches and more comfortable visiting times.' },
        ],
      },
      gr: {
        title: categoryTitleFor('family', islandName, 'gr'),
        description: categoryMetaFor('family', islandName, count, 'gr'),
        h1: `Παραλίες για παιδιά — ${islandName}`,
        intro: `Ταξιδεύεις με μικρά παιδιά; Αυτές οι ${count} οικογενειακές παραλίες εδώ (${islandName}) έχουν συνήθως ρηχά νερά και ευκολότερη πρόσβαση. Δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι καλές για οικογένειες;`, body: 'Οι παραλίες της λίστας είναι σημειωμένες ως οικογενειακές, συνήθως με ρηχότερα νερά και ευκολότερη πρόσβαση. Για μικρά παιδιά, διάλεξε πιο ήρεμη και υπήνεμη μέρα.' },
          { heading: 'Πώς ξέρω ότι η θάλασσα θα είναι αρκετά ήρεμη;', body: 'Το CalmBeach ελέγχει άνεμο, κύμα και έκθεση για τη μέρα, ώστε να διαλέξεις πιο υπήνεμη παραλία ή πιο ήρεμη ώρα.' },
        ],
      },
      de: {
        title: `Familienfreundliche Strände auf ${islandName} | CalmBeach`,
        description: `Familienfreundliche Strände auf ${islandName} mit flacherem Wasser und einfacherem Zugang. Prüfe Wind und Wellen, bevor du losfährst.`,
        h1: `Familienstrände auf ${islandName}`,
        intro: `Unterwegs mit kleinen Kindern auf ${islandName}? Diese ${count} familienfreundlichen Strände haben meist flacheres Wasser und einfacheren Zugang. Prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind familienfreundlich?`, body: 'Die hier gelisteten Strände sind als familienfreundlich markiert, meist mit flacherem Wasser und einfacherem Zugang. Prüfe für kleine Kinder trotzdem Wind und Wellen.' },
          { heading: 'Wie vergleiche ich die Meeresbedingungen?', body: 'CalmBeach prüft Wind, Wellen und Lage, sodass du weniger exponierte Strände und angenehmere Besuchszeiten vergleichen kannst.' },
        ],
      },
      fr: {
        title: `Plages familiales à ${islandName} à l'eau calme et peu profonde | CalmBeach`,
        description: `Plages adaptées aux familles à ${islandName}, avec eau généralement peu profonde et accès plus facile. Vérifiez le vent et les vagues avant d'y aller.`,
        h1: `Plages familiales à ${islandName}`,
        intro: `Vous voyagez avec de jeunes enfants à ${islandName} ? Ces ${count} plages familiales ont généralement une eau peu profonde et un accès plus facile. Vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} conviennent aux familles ?`, body: "Les plages listées ici sont marquées comme familiales, généralement avec une eau moins profonde et un accès plus facile. Pour les jeunes enfants, vérifiez quand même le vent et les vagues." },
          { heading: 'Comment comparer les conditions de mer ?', body: "CalmBeach vérifie le vent, les vagues et l'exposition pour comparer les plages moins exposées et les moments plus confortables." },
        ],
      },
      it: {
        title: `Spiagge per famiglie a ${islandName} con acqua calma e bassa | CalmBeach`,
        description: `Spiagge adatte alle famiglie a ${islandName}, con acqua bassa e accesso più facile. Controlla vento e onde prima di andare.`,
        h1: `Spiagge per famiglie a ${islandName}`,
        intro: `Viaggi con bambini piccoli a ${islandName}? Queste ${count} spiagge per famiglie hanno di solito acqua bassa e un accesso più facile. Controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono adatte alle famiglie?`, body: 'Le spiagge elencate qui sono indicate come adatte alle famiglie, di solito con acqua più bassa e accesso più facile. Per i bambini piccoli, controlla comunque vento e onde.' },
          { heading: 'Come confronto le condizioni del mare?', body: 'CalmBeach controlla vento, onde ed esposizione, così puoi confrontare spiagge meno esposte e orari più comodi.' },
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
        title: categoryTitleFor('snorkeling', islandName, 'en'),
        description: categoryMetaFor('snorkeling', islandName, count, 'en'),
        h1: `Snorkeling beaches in ${islandName}`,
        intro: `Want clear water and rocks to explore in ${islandName}? These ${count} beaches are good for snorkeling, usually with clearer water and a rocky or mixed seabed. Visibility is often better on low-wind days — check wind and waves in CalmBeach first.`,
        sections: [
          { heading: `Which beaches in ${islandName} are good for snorkeling?`, body: 'The beaches listed here have rockier seabed and clearer water, where you are more likely to see fish and underwater life. Conditions vary, so check the forecast before you go.' },
          { heading: 'When is snorkeling more comfortable?', body: 'Snorkel close to shore when conditions are mild and avoid strong wind, waves or currents. Check live wind and waves in the app and follow any local flags.' },
        ],
      },
      gr: {
        title: categoryTitleFor('snorkeling', islandName, 'gr'),
        description: categoryMetaFor('snorkeling', islandName, count, 'gr'),
        h1: `Παραλίες για snorkeling — ${islandName}`,
        intro: `Ψάχνεις καθαρά νερά και βράχια για εξερεύνηση; Αυτές οι ${count} παραλίες εδώ (${islandName}) είναι καλές για snorkeling, συνήθως με πιο καθαρά νερά και βραχώδη ή μικτό βυθό. Η ορατότητα είναι συχνά καλύτερη σε μέρες με λίγο αέρα — δες πρώτα άνεμο και κύμα στο CalmBeach.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι καλές για snorkeling;`, body: 'Οι παραλίες της λίστας έχουν πιο βραχώδη βυθό και καθαρότερα νερά, όπου είναι πιο πιθανό να δεις ψάρια και υποθαλάσσια ζωή. Οι συνθήκες αλλάζουν, γι\' αυτό έλεγξε την πρόγνωση πριν πας.' },
          { heading: 'Πότε είναι ασφαλέστερο το snorkeling;', body: 'Κάνε snorkeling κοντά στην ακτή σε ήρεμες μέρες και απόφυγε δυνατό αέρα, κύμα ή ρεύματα. Έλεγξε live άνεμο και κύμα στην εφαρμογή και ακολούθησε τυχόν τοπικές σημαίες.' },
        ],
      },
      de: {
        title: `Schnorchelstrände auf ${islandName} | Klares Wasser & Felsen | CalmBeach`,
        description: `Strände auf ${islandName} mit klarerem Wasser und felsigem Grund zum Schnorcheln. Prüfe Wind und Wellen, bevor du losfährst.`,
        h1: `Schnorchelstrände auf ${islandName}`,
        intro: `Du suchst klares Wasser und Felsen zum Erkunden auf ${islandName}? Diese ${count} Strände eignen sich zum Schnorcheln, meist mit klarerem Wasser und felsigem oder gemischtem Grund. Die Sicht ist oft an windarmen Tagen besser – prüfe zuerst Wind und Wellen in CalmBeach.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} eignen sich zum Schnorcheln?`, body: 'Die hier gelisteten Strände haben felsigeren Grund und klareres Wasser, wo du eher Fische und Unterwasserleben siehst. Die Bedingungen ändern sich, prüfe also die Vorhersage vor dem Besuch.' },
          { heading: 'Wann ist Schnorcheln angenehmer?', body: 'Schnorchle ufernah, wenn die Bedingungen mild sind, und meide starken Wind, Wellen oder Strömungen. Prüfe Wind und Wellen live in der App und folge örtlichen Flaggen.' },
        ],
      },
      fr: {
        title: `Plages de snorkeling à ${islandName} | Eau claire & rochers | CalmBeach`,
        description: `Plages à ${islandName} à l'eau plus claire et au fond rocheux pour le snorkeling. Vérifiez le vent et les vagues avant d'y aller.`,
        h1: `Plages de snorkeling à ${islandName}`,
        intro: `Vous cherchez une eau claire et des rochers à explorer à ${islandName} ? Ces ${count} plages se prêtent au snorkeling, généralement avec une eau plus claire et un fond rocheux ou mixte. La visibilité est souvent meilleure les jours peu ventés — vérifiez d'abord le vent et les vagues dans CalmBeach.`,
        sections: [
          { heading: `Quelles plages de ${islandName} se prêtent au snorkeling ?`, body: "Les plages listées ici ont un fond plus rocheux et une eau plus claire, où vous avez plus de chances de voir des poissons et la vie sous-marine. Les conditions varient, vérifiez le vent et les vagues avant d'y aller." },
          { heading: 'Quand le snorkeling est-il plus confortable ?', body: 'Faites du snorkeling près du rivage quand les conditions sont douces et évitez vent fort, vagues ou courants. Vérifiez le vent et les vagues en direct dans l\'application et suivez les drapeaux locaux.' },
        ],
      },
      it: {
        title: `Spiagge per snorkeling a ${islandName} | Acqua limpida e scogli | CalmBeach`,
        description: `Spiagge a ${islandName} con acqua più limpida e fondale roccioso per lo snorkeling. Controlla vento e onde prima di andare.`,
        h1: `Spiagge per snorkeling a ${islandName}`,
        intro: `Cerchi acqua limpida e scogli da esplorare a ${islandName}? Queste ${count} spiagge sono adatte allo snorkeling, di solito con acqua più limpida e fondale roccioso o misto. La visibilità è spesso migliore nei giorni poco ventosi — controlla prima vento e onde in CalmBeach.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono adatte allo snorkeling?`, body: 'Le spiagge elencate qui hanno fondale più roccioso e acqua più limpida, dove è più probabile vedere pesci e vita sottomarina. Le condizioni variano, controlla le previsioni prima di andare.' },
          { heading: 'Quando lo snorkeling è più comodo?', body: 'Fai snorkeling vicino alla riva quando le condizioni sono miti ed evita vento forte, onde o correnti. Controlla vento e onde in tempo reale nell\'app e segui le bandiere locali.' },
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
        title: categoryTitleFor('organized', islandName, 'en'),
        description: categoryMetaFor('organized', islandName, count, 'en'),
        h1: `Organized beaches in ${islandName}`,
        intro: `Prefer sunbeds, umbrellas and a beach bar in ${islandName}? These ${count} organized beaches usually have facilities and easier access. Check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are organized?`, body: 'The beaches listed here are marked as organized, usually with sunbeds, umbrellas and food or a beach bar nearby. Facilities can change by season, so confirm locally.' },
          { heading: 'Are organized beaches less windy?', body: 'Not necessarily. Facilities do not change the wind or waves — check live conditions in the app and compare less exposed beaches on windy days.' },
        ],
      },
      gr: {
        title: categoryTitleFor('organized', islandName, 'gr'),
        description: categoryMetaFor('organized', islandName, count, 'gr'),
        h1: `Οργανωμένες παραλίες — ${islandName}`,
        intro: `Προτιμάς ξαπλώστρες, ομπρέλες και beach bar; Αυτές οι ${count} οργανωμένες παραλίες εδώ (${islandName}) έχουν συνήθως παροχές και ευκολότερη πρόσβαση. Δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι οργανωμένες;`, body: 'Οι παραλίες της λίστας είναι σημειωμένες ως οργανωμένες, συνήθως με ξαπλώστρες, ομπρέλες και φαγητό ή beach bar κοντά. Οι παροχές αλλάζουν ανά εποχή, γι\' αυτό επιβεβαίωσε επιτόπου.' },
          { heading: 'Είναι πιο ήρεμες οι οργανωμένες παραλίες;', body: 'Όχι απαραίτητα. Οι παροχές δεν αλλάζουν τον άνεμο ή το κύμα — έλεγξε live συνθήκες στην εφαρμογή και διάλεξε πιο υπήνεμη παραλία τις μέρες με αέρα.' },
        ],
      },
      de: {
        title: `Organisierte Strände auf ${islandName} mit Liegen & Einrichtungen | CalmBeach`,
        description: `Organisierte Strände auf ${islandName} mit Liegen, Sonnenschirmen und Einrichtungen. Prüfe Wind und Wellen, bevor du losfährst.`,
        h1: `Organisierte Strände auf ${islandName}`,
        intro: `Du bevorzugst Liegen, Sonnenschirme und eine Beach Bar auf ${islandName}? Diese ${count} organisierten Strände bieten meist Einrichtungen und einfacheren Zugang. Prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind organisiert?`, body: 'Die hier gelisteten Strände sind als organisiert markiert, meist mit Liegen, Sonnenschirmen und Essen oder einer Beach Bar in der Nähe. Die Einrichtungen ändern sich je nach Saison, bestätige sie vor Ort.' },
          { heading: 'Sind organisierte Strände weniger windig?', body: 'Nicht unbedingt. Einrichtungen ändern Wind oder Wellen nicht – prüfe die Live-Bedingungen in der App und vergleiche an windigen Tagen weniger exponierte Strände.' },
        ],
      },
      fr: {
        title: `Plages aménagées à ${islandName} avec transats et services | CalmBeach`,
        description: `Plages aménagées à ${islandName} avec transats, parasols et services. Vérifiez le vent et les vagues avant d'y aller.`,
        h1: `Plages aménagées à ${islandName}`,
        intro: `Vous préférez transats, parasols et un bar de plage à ${islandName} ? Ces ${count} plages aménagées offrent généralement des services et un accès plus facile. Vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont aménagées ?`, body: 'Les plages listées ici sont marquées comme aménagées, généralement avec transats, parasols et restauration ou un bar de plage à proximité. Les services changent selon la saison, confirmez sur place.' },
          { heading: 'Les plages aménagées sont-elles moins ventées ?', body: 'Pas forcément. Les services ne changent ni le vent ni les vagues — vérifiez les conditions en direct dans l\'application et comparez les plages moins exposées les jours de vent.' },
        ],
      },
      it: {
        title: `Spiagge attrezzate a ${islandName} con lettini e servizi | CalmBeach`,
        description: `Spiagge attrezzate a ${islandName} con lettini, ombrelloni e servizi. Controlla vento e onde prima di andare.`,
        h1: `Spiagge attrezzate a ${islandName}`,
        intro: `Preferisci lettini, ombrelloni e un beach bar a ${islandName}? Queste ${count} spiagge attrezzate hanno di solito servizi e un accesso più facile. Controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono attrezzate?`, body: 'Le spiagge elencate qui sono indicate come attrezzate, di solito con lettini, ombrelloni e ristoro o un beach bar nelle vicinanze. I servizi cambiano con la stagione, conferma sul posto.' },
          { heading: 'Le spiagge attrezzate sono meno ventose?', body: 'Non necessariamente. I servizi non cambiano vento o onde — controlla le condizioni in tempo reale nell\'app e confronta spiagge meno esposte nei giorni ventosi.' },
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
        title: categoryTitleFor('secluded', islandName, 'en'),
        description: categoryMetaFor('secluded', islandName, count, 'en'),
        h1: `Secluded beaches in ${islandName}`,
        intro: `Looking to escape the crowds in ${islandName}? These ${count} remote beaches are quieter and harder to reach — often by dirt road, on foot or by boat. Bring water and shade, and check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} are the most secluded?`, body: 'The beaches listed here are remote and usually have no facilities. Access can be rough — a dirt track, a hike or boat-only — so plan ahead and bring supplies.' },
          { heading: 'What should I know before swimming at remote beaches?', body: 'Remote beaches have no lifeguards or services. Avoid strong wind, big waves and swimming alone, and check live wind and waves in the app first.' },
        ],
      },
      gr: {
        title: categoryTitleFor('secluded', islandName, 'gr'),
        description: categoryMetaFor('secluded', islandName, count, 'gr'),
        h1: `Απομονωμένες παραλίες — ${islandName}`,
        intro: `Θες να ξεφύγεις από τον κόσμο; Αυτές οι ${count} απομακρυσμένες παραλίες εδώ (${islandName}) είναι πιο ήσυχες και πιο δύσκολες στην πρόσβαση — συχνά με χωματόδρομο, με τα πόδια ή με σκάφος. Φέρε νερό και σκιά, και δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες είναι οι πιο απομονωμένες;`, body: 'Οι παραλίες της λίστας είναι απομακρυσμένες και συνήθως χωρίς παροχές. Η πρόσβαση μπορεί να είναι δύσκολη — χωματόδρομος, πεζοπορία ή μόνο με σκάφος — οπότε προγραμμάτισε και φέρε προμήθειες.' },
          { heading: 'Είναι ασφαλές το μπάνιο σε απομονωμένες παραλίες;', body: 'Οι απομονωμένες παραλίες δεν έχουν ναυαγοσώστη ή υπηρεσίες. Κολύμπησε μόνο σε ήρεμες συνθήκες, ποτέ μόνος σε μεγάλο κύμα, και έλεγξε πρώτα live άνεμο και κύμα στην εφαρμογή.' },
        ],
      },
      de: {
        title: `Abgelegene Strände auf ${islandName} abseits der Menschenmengen | CalmBeach`,
        description: `Ruhige, abgelegene Strände auf ${islandName} abseits der Menschenmengen. Prüfe Zugang, Wind und Wellen auf CalmBeach.`,
        h1: `Abgelegene Strände auf ${islandName}`,
        intro: `Du möchtest den Menschenmengen auf ${islandName} entkommen? Diese ${count} abgelegenen Strände sind ruhiger und schwerer erreichbar – oft über Schotterpiste, zu Fuß oder per Boot. Bring Wasser und Schatten mit und prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} sind am abgelegensten?`, body: 'Die hier gelisteten Strände sind abgelegen und haben meist keine Einrichtungen. Der Zugang kann rau sein – Schotterpiste, Wanderung oder nur per Boot – plane also voraus und bring Vorräte mit.' },
          { heading: 'Was sollte ich vor dem Schwimmen an abgelegenen Stränden wissen?', body: 'Abgelegene Strände haben keine Rettungsschwimmer oder Dienste. Meide starken Wind, hohe Wellen und Alleinschwimmen, und prüfe zuerst Wind und Wellen live in der App.' },
        ],
      },
      fr: {
        title: `Plages isolées à ${islandName} loin de la foule | CalmBeach`,
        description: `Plages isolées à ${islandName}, loin de la foule. Vérifiez l'accès, le vent et les vagues sur CalmBeach.`,
        h1: `Plages isolées à ${islandName}`,
        intro: `Vous voulez échapper à la foule à ${islandName} ? Ces ${count} plages isolées sont plus difficiles d'accès — souvent par piste, à pied ou en bateau. Apportez eau et ombre, et vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} sont les plus isolées ?`, body: 'Les plages listées ici sont isolées et généralement sans services. L\'accès peut être difficile — piste, randonnée ou bateau uniquement — alors prévoyez et apportez des provisions.' },
          { heading: 'À savoir avant de se baigner sur les plages isolées', body: 'Les plages isolées n\'ont ni surveillants ni services. Évitez vent fort, grosses vagues et baignade seul, et vérifiez d\'abord le vent et les vagues en direct dans l\'application.' },
        ],
      },
      it: {
        title: `Spiagge isolate a ${islandName} lontano dalla folla | CalmBeach`,
        description: `Spiagge tranquille e isolate a ${islandName}, lontano dalla folla. Controlla accesso, vento e onde su CalmBeach.`,
        h1: `Spiagge isolate a ${islandName}`,
        intro: `Vuoi sfuggire alla folla a ${islandName}? Queste ${count} spiagge isolate sono più difficili da raggiungere — spesso su strada sterrata, a piedi o in barca. Porta acqua e ombra e controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} sono le più isolate?`, body: 'Le spiagge elencate qui sono isolate e di solito senza servizi. L\'accesso può essere difficile — sterrato, sentiero o solo in barca — quindi pianifica e porta provviste.' },
          { heading: 'Cosa sapere prima di nuotare nelle spiagge isolate', body: 'Le spiagge isolate non hanno bagnini o servizi. Evita vento forte, onde alte e il nuoto da solo, e controlla prima vento e onde in tempo reale nell\'app.' },
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
        title: categoryTitleFor('sunset', islandName, 'en'),
        description: categoryMetaFor('sunset', islandName, count, 'en'),
        h1: `Sunset beaches in ${islandName}`,
        intro: `Want to watch the sun go down over the sea in ${islandName}? These ${count} west-facing beaches look out toward the sunset. Time your visit for late afternoon — and check wind and waves in CalmBeach before you go.`,
        sections: [
          { heading: `Which beaches in ${islandName} face the sunset?`, body: 'The beaches listed here face west or southwest, so the sun sets over the water in front of you. Arrive before sunset to find a spot and enjoy the light.' },
          { heading: 'Anything to know for an evening visit?', body: 'Wind can pick up or drop in the evening, and remote beaches have no lights. Check live wind and waves in the app and bring a torch for the walk back.' },
        ],
      },
      gr: {
        title: categoryTitleFor('sunset', islandName, 'gr'),
        description: categoryMetaFor('sunset', islandName, count, 'gr'),
        h1: `Παραλίες για ηλιοβασίλεμα — ${islandName}`,
        intro: `Θες να δεις τον ήλιο να δύει στη θάλασσα; Αυτές οι ${count} δυτικές παραλίες εδώ (${islandName}) κοιτούν προς το ηλιοβασίλεμα. Προγραμμάτισε την επίσκεψη αργά το απόγευμα — και δες άνεμο και κύμα στο CalmBeach πριν πας.`,
        sections: [
          { heading: `${islandName}: ποιες παραλίες έχουν το καλύτερο ηλιοβασίλεμα;`, body: 'Οι παραλίες της λίστας κοιτούν δυτικά ή νοτιοδυτικά, οπότε ο ήλιος δύει πάνω από τη θάλασσα μπροστά σου. Έλα πριν τη δύση για να βρεις θέση και να απολαύσεις το φως.' },
          { heading: 'Τι να προσέξω για βραδινή επίσκεψη;', body: 'Ο αέρας μπορεί να δυναμώσει ή να πέσει το βράδυ, και οι απομακρυσμένες παραλίες δεν έχουν φωτισμό. Έλεγξε live άνεμο και κύμα στην εφαρμογή και πάρε φακό για την επιστροφή.' },
        ],
      },
      de: {
        title: `Sonnenuntergangsstrände auf ${islandName} nach Westen | CalmBeach`,
        description: `Nach Westen ausgerichtete Strände auf ${islandName} mit Sonnenuntergangsblick. Prüfe Wind und Wellen, bevor du losfährst.`,
        h1: `Sonnenuntergangsstrände auf ${islandName}`,
        intro: `Du möchtest die Sonne über dem Meer auf ${islandName} untergehen sehen? Diese ${count} nach Westen ausgerichteten Strände blicken zum Sonnenuntergang. Plane deinen Besuch für den späten Nachmittag – und prüfe Wind und Wellen in CalmBeach, bevor du losfährst.`,
        sections: [
          { heading: `Welche Strände auf ${islandName} haben die schönsten Sonnenuntergänge?`, body: 'Die hier gelisteten Strände sind nach Westen oder Südwesten ausgerichtet, sodass die Sonne über dem Wasser vor dir untergeht. Komm vor Sonnenuntergang, um einen Platz zu finden und das Licht zu genießen.' },
          { heading: 'Was sollte ich für einen Besuch am Abend wissen?', body: 'Der Wind kann abends auffrischen oder nachlassen, und abgelegene Strände haben kein Licht. Prüfe Wind und Wellen live in der App und bring eine Taschenlampe für den Rückweg mit.' },
        ],
      },
      fr: {
        title: `Plages de coucher de soleil à ${islandName} face à l'ouest | CalmBeach`,
        description: `Plages orientées à l'ouest à ${islandName} avec une belle vue sur le coucher de soleil. Vérifiez le vent et les vagues avant d'y aller.`,
        h1: `Plages de coucher de soleil à ${islandName}`,
        intro: `Envie de voir le soleil se coucher sur la mer à ${islandName} ? Ces ${count} plages orientées à l'ouest donnent vers le coucher de soleil. Prévoyez votre visite en fin d'après-midi — et vérifiez le vent et les vagues dans CalmBeach avant d'y aller.`,
        sections: [
          { heading: `Quelles plages de ${islandName} offrent les plus beaux couchers de soleil ?`, body: 'Les plages listées ici sont orientées à l\'ouest ou au sud-ouest, le soleil se couche donc sur l\'eau devant vous. Arrivez avant le coucher pour trouver une place et profiter de la lumière.' },
          { heading: 'À savoir pour une visite en soirée ?', body: 'Le vent peut se lever ou tomber le soir, et les plages isolées n\'ont pas d\'éclairage. Vérifiez le vent et les vagues en direct dans l\'application et emportez une lampe pour le retour.' },
        ],
      },
      it: {
        title: `Spiagge per il tramonto a ${islandName} esposte a ovest | CalmBeach`,
        description: `Spiagge esposte a ovest a ${islandName} con vista sul tramonto. Controlla vento e onde prima di andare.`,
        h1: `Spiagge per il tramonto a ${islandName}`,
        intro: `Vuoi vedere il sole tramontare sul mare a ${islandName}? Queste ${count} spiagge esposte a ovest guardano verso il tramonto. Programma la visita nel tardo pomeriggio — e controlla vento e onde in CalmBeach prima di andare.`,
        sections: [
          { heading: `Quali spiagge di ${islandName} hanno i tramonti più belli?`, body: 'Le spiagge elencate qui sono esposte a ovest o sud-ovest, così il sole tramonta sull\'acqua davanti a te. Arriva prima del tramonto per trovare posto e goderti la luce.' },
          { heading: 'Cosa sapere per una visita serale?', body: 'Il vento può rinforzare o calare la sera, e le spiagge isolate non hanno illuminazione. Controlla vento e onde in tempo reale nell\'app e porta una torcia per il ritorno.' },
        ],
      },
    }),
  },
];

// Hand-written, per-region visible intro + H1 for targeted family-beaches pages
// (GR only). These regions have real search demand ("{περιοχή} παραλίες για
// παιδιά") but middling positions; the copy references the page's real beaches
// and explains suitability through our wind-exposure angle. Keyed by region id.
// Every state claim is qualified ("με βάση τον προσανατολισμό / πιο") so it
// passes the honesty guards; only stable, always-true traits are asserted.
// The <h2> family Q&A sections from islandIntents still render below the intro.
const FAMILY_INTRO_OVERRIDES = {
  'thessaly-skopelos': {
    h1: 'Παραλίες για παιδιά στη Σκόπελο',
    intro: `Ψάχνεις παραλίες για παιδιά στη Σκόπελο; Το νησί, καταπράσινο μέχρι τη θάλασσα, κρύβει μια σειρά από μικρούς, οργανωμένους όρμους στη νοτιοανατολική του πλευρά που ταιριάζουν σε οικογένειες με μικρά παιδιά. Ο Στάφυλος και το διπλανό Βελανιό είναι κλειστοί κολπίσκοι με ρηχά νερά, ομαλό βυθό, ξαπλώστρες και beach bar — βολικοί για μια μέρα με παιδιά που θέλουν σκιά και φαγητό κοντά. Λίγο πιο πέρα, η Μηλιά απλώνεται σε μια μεγάλη αμμοβοτσαλώδη ακτή με πάρκινγκ, ενώ το Λιμνονάρι είναι ο μοναδικός πραγματικά αμμώδης, μικρός και κλειστός όρμος — ιδανικός για νήπια που κάνουν τα πρώτα τους μπάνια. Το Γλυστέρι, πιο βόρεια, είναι επίσης οργανωμένο και ρηχό, αλλά κοιτάει προς άλλη κατεύθυνση, οπότε βολεύει άλλες μέρες. Κοινό χαρακτηριστικό όλων: το πευκοδάσος φτάνει σχεδόν ως την ακτή και δίνει φυσική σκιά — κάτι που μετράει όταν τα παιδιά περνούν ώρες στην παραλία — ενώ και οι πέντε απέχουν λίγα λεπτά με το αυτοκίνητο από τη Χώρα, χωρίς κουραστική μετακίνηση με μικρά.

Αυτό που ξεχωρίζει την επιλογή μας δεν είναι η φήμη κάθε παραλίας, αλλά ο προσανατολισμός της. Οι περισσότεροι από αυτούς τους όρμους βλέπουν νοτιοανατολικά και, με βάση τον προσανατολισμό τους, μένουν πιο υπήνεμοι όταν φυσά το μελτέμι από τον βορρά — κάτι που μετράει πολύ όταν κολυμπάνε παιδιά. Η κατάταξη εδώ προκύπτει από πραγματικά δεδομένα έκθεσης στον άνεμο ανά ακτή, όχι από γενικές τουριστικές λίστες.

Πριν ξεκινήσεις, άνοιξε τη σελίδα της παραλίας και δες τον ζωντανό δείκτη ανέμου και κύματος. Αν ο άνεμος γυρίσει νότιος, η πιο προστατευμένη πλευρά αλλάζει, οπότε μια βόρεια επιλογή όπως το Γλυστέρι μπορεί να αποδειχθεί πιο βολική εκείνη τη μέρα. Έτσι διαλέγεις με στοιχεία, όχι στην τύχη.`,
  },
  'ionian-islands-paxos': {
    h1: 'Παραλίες για παιδιά στους Παξούς',
    intro: `Οι Παξοί είναι από τα λίγα μέρη στο Ιόνιο όπου «παραλίες για παιδιά» σημαίνει διάφανα, ρηχά νερά πάνω από λευκό βότσαλο. Το μικρό αυτό νησί δεν έχει πολλές αμμουδιές, γι' αυτό ο πιο οικογενειακός προορισμός του ξεχωρίζει: το Μογγονήσι, στο νότιο άκρο, είναι ένας κλειστός, αμμώδης και πολύ ρηχός όρμος, ενωμένος με τους Παξούς με μια μικρή γέφυρα — από τα λίγα σημεία με άμμο και ομαλό βυθό, ό,τι πρέπει για νήπια. Ο Γιάννας, επίσης οργανωμένος και ρηχός, προσφέρει άμμο με βότσαλο και πάρκινγκ, ενώ το Κανόνι και το Χαράμι, κοντά στον Γάιο, έχουν ξαπλώστρες και εύκολη είσοδο στο νερό για μεγαλύτερα παιδιά. Η Κακή Λαγκάδα κλείνει τη λίστα με beach bar και πάρκινγκ. Καλό είναι να ξέρεις ότι οι Παξοί δεν έχουν αεροδρόμιο· φτάνεις με πλοίο από την Κέρκυρα ή, το καλοκαίρι, από την Πάργα. Κι επειδή οι περισσότερες ακτές είναι βοτσαλωτές, ένα ζευγάρι παπουτσάκια θαλάσσης κάνει την είσοδο στο νερό πιο εύκολη για τα παιδιά.

Το δικό μας κριτήριο δεν είναι απλώς αν μια παραλία είναι «γνωστή», αλλά πώς στέκεται απέναντι στον άνεμο. Στο Ιόνιο κυριαρχεί το καλοκαίρι το απογευματινό βορειοδυτικό μαϊστράλι· όρμοι όπως ο Γιάννας και το Μογγονήσι, με βάση τον προσανατολισμό τους, μένουν πιο υπήνεμοι σε αυτό, ενώ το Χαράμι και το Κανόνι, που βλέπουν βορειοδυτικά, πιάνουν πιο εύκολα το απογευματινό αεράκι. Η κατάταξη προκύπτει από πραγματικά δεδομένα έκθεσης ανά ακτή, όχι από τουριστικές κοινοτοπίες.

Η πρακτική συμβουλή για γονείς: πριν φύγεις, δες τον ζωντανό δείκτη ανέμου στη σελίδα κάθε παραλίας. Αν το μαϊστράλι έχει σηκωθεί το απόγευμα, διάλεξε μια νότια ή ανατολική επιλογή όπως το Μογγονήσι — τα μικρά κουράζονται πιο γρήγορα με το κύμα και τον αέρα απ' ό,τι οι μεγάλοι.`,
  },
  'central-macedonia-pieria-mainland': {
    h1: 'Παραλίες για παιδιά στην Πιερία',
    intro: `«Παραλίες Πιερίας για παιδιά» είναι σχεδόν συνώνυμο με μεγάλες, επίπεδες αμμουδιές που μπαίνουν στο νερό με πολύ ρηχό, ομαλό βυθό — το ιδανικό σκηνικό για οικογένειες. Η ακτή κάτω από τον Όλυμπο είναι στρωμένη με οργανωμένες, αμμώδεις παραλίες που φτάνεις εύκολα με το αυτοκίνητο. Η Ολυμπιακή Ακτή και η Παραλία Κατερίνης είναι οι πιο πολυσύχναστες, με ξαπλώστρες, beach bar, πάρκινγκ και ρηχά νερά που κρατάνε για δεκάδες μέτρα — τα παιδιά περπατάνε πολλή ώρα πριν βαθύνει. Πιο ήσυχες αλλά εξίσου αμμώδεις και ρηχές είναι η Αλυκή, η Πύδνα και οι Αλυκές Κίτρους, όλες οργανωμένες, ενώ η Σκοτίνα δίνει μια πιο χαλαρή εναλλακτική. Είναι από τους πιο βολικούς οικογενειακούς προορισμούς για όποιον ξεκινά από τη Θεσσαλονίκη ή τη βόρεια Ελλάδα — λίγη ώρα δρόμος, με φόντο τον Όλυμπο και παραλίες που πατάς κατευθείαν από το πάρκινγκ. Η αμμώδης, πολύ σταδιακά βαθαίνουσα ακτή είναι ακριβώς το είδος βυθού που ψάχνει ένας γονιός με μικρά.

Εδώ το δικό μας κριτήριο μετράει διπλά. Όλες αυτές οι παραλίες βλέπουν στον ανοιχτό Θερμαϊκό, οπότε η άνεση εξαρτάται από την κατεύθυνση του ανέμου εκείνη τη μέρα. Με βάση τον προσανατολισμό της κάθε ακτής, η Ολυμπιακή Ακτή προστατεύεται περισσότερο από τους βόρειους ανέμους, ενώ η Αλυκή και η Πύδνα κρατούν καλύτερα όταν φυσά από τον νότο. Η κατάταξη δεν βγαίνει από φήμη, αλλά από πραγματικά δεδομένα έκθεσης στον άνεμο ανά σημείο.

Το κλειδί για μια καλή μέρα με παιδιά εδώ είναι η κατεύθυνση του ανέμου. Δες τον ζωντανό δείκτη ανέμου και κύματος στη σελίδα της παραλίας πριν ξεκινήσεις: αν έχει σηκωθεί ο Βαρδάρης —ο βόρειος άνεμος της περιοχής— μια πιο νότια επιλογή θα έχει λιγότερο κύμα στην ακτή, κι ένα ρηχό, πιο μαζεμένο σημείο κάνει τη διαφορά όταν κολυμπάνε μικρά παιδιά.`,
  },
  'central-greece-evia': {
    h1: 'Παραλίες για παιδιά στην Εύβοια',
    intro: `Για οικογένειες από την Αθήνα, η Εύβοια είναι η πιο κοντινή απάντηση στο «παραλίες για παιδιά» — και η βόρεια πλευρά της κρύβει μια ολόκληρη σειρά από ρηχές, οργανωμένες αμμουδιές. Η Παραλία Πευκί είναι η πιο δημοφιλής: μεγάλη, με άμμο και βότσαλο, ξαπλώστρες, beach bar και πάρκινγκ, με ρηχά νερά που βολεύουν παιδιά κάθε ηλικίας. Δίπλα, το Ψαροπούλι (Βασιλικά) και η Χρυσή Ακτή δίνουν παρόμοια εικόνα — αμμώδεις, οργανωμένες, με ομαλό βυθό. Ξεχωριστή περίπτωση το Γρεγολίμανο: ένας κλειστός, ρηχός και οργανωμένος όρμος — από τα πιο μαζεμένα σημεία για νήπια. Αν θέλεις κάτι πιο ήσυχο, η Λευκή Ακτή, οι Αλυκές και η Ψιλή Άμμος δίνουν εξίσου ρηχές, οικογενειακές επιλογές. Η απόσταση διαφέρει και αξίζει να τη μετρήσεις όταν ταξιδεύεις με μικρά: η Χαλκίδα είναι μόλις μία ώρα από την Αθήνα, ενώ το Πευκί και ο βορράς του νησιού θέλουν περίπου τρεις. Στις αμμοβοτσαλωτές, όπως το Πευκί, τα παπουτσάκια θαλάσσης βοηθούν τα παιδικά πόδια.

Αυτό που κάνει τη λίστα μας διαφορετική είναι το κριτήριο πίσω της. Δεν διαλέγουμε με βάση τη φήμη, αλλά με βάση τον προσανατολισμό και την έκθεση κάθε ακτής στον άνεμο. Πολλές από αυτές, όπως το Γρεγολίμανο και η Χρυσή Ακτή, με βάση τον προσανατολισμό τους μένουν πιο υπήνεμες στους βόρειους ανέμους, ενώ άλλες, όπως η Λευκή Ακτή, βολεύουν καλύτερα όταν ο άνεμος γυρίζει. Η κατάταξη στηρίζεται σε πραγματικά δεδομένα, όχι σε γενικές τουριστικές προτάσεις.

Η συμβουλή για τον γονιό: λίγο πριν φύγεις, άνοιξε τη σελίδα της παραλίας και δες τον ζωντανό δείκτη ανέμου. Με τα παιδιά, ένα ρηχό σημείο με λιγότερο κύμα αξίζει περισσότερο από ένα διάσημο όνομα — και η πιο βολική πλευρά της Εύβοιας αλλάζει ανάλογα με τον άνεμο της ημέρας.`,
  },
};

const islandIntentPath = (intent, region, island) => `${intent.pathPrefix}/${encodeURIComponent(regionSlug(region, island))}/`;

// Short chip labels for each guide topic, used in the "beach guides" link blocks
// on region and guide pages (the page <h1>s are too long to use as nav labels).
const INTENT_NAV_LABELS = {
  family:     { en: 'Family beaches',  gr: 'Οικογενειακές',     de: 'Familienstrände',  fr: 'Plages familiales',  it: 'Per famiglie' },
  sheltered:  { en: 'Meltemi wind options', gr: 'Επιλογές με μελτέμι', de: 'Meltemi-Optionen', fr: 'Options meltemi', it: 'Opzioni meltemi' },
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
  { path: '/best-beaches-greece-today/', label: { en: 'Compare beach conditions', gr: 'Σύγκριση συνθηκών' } },
  { path: '/sheltered-beaches-meltemi/', label: { en: 'Meltemi wind options', gr: 'Επιλογές με μελτέμι' } },
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
    openAppBeach: "Open the app for live recommendation score, wind exposure, waves, best time of day and nearby alternatives.",
    openAppRegion: "Weather and sea conditions change. CalmBeach uses the app view for live beach recommendations.",
    viewBeach: 'View this beach in CalmBeach Greece',
    viewRegion: islandName => `View ${islandName} in CalmBeach Greece`,
    regionHeading: islandName => `${islandName} beaches`,
    regionDescription: (islandName, count) => `Compare ${count} beaches in ${islandName}, Greece by wind, waves, weather, beach exposure, access and beach type before you choose where to swim.`,
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
    openAppBeach: 'Άνοιξε την εφαρμογή για live σκορ, άνεμο, κύμα, καλύτερη ώρα και κοντινές εναλλακτικές.',
    openAppRegion: 'Ο καιρός και η θάλασσα αλλάζουν μέσα στη μέρα. Το Calm Beach δείχνει live προτάσεις παραλιών μέσα στην εφαρμογή.',
    viewBeach: 'Δες την παραλία στο Calm Beach Greece',
    viewRegion: islandName => `Δες τις παραλίες για ${islandName} στο Calm Beach Greece`,
    regionHeading: islandName => `Παραλίες: ${islandName}`,
    regionDescription: (islandName, count) => `Σύγκρινε ${count} παραλίες σε ${islandName} με βάση άνεμο, κύμα, καιρό, έκθεση, πρόσβαση και τύπο παραλίας πριν διαλέξεις πού να κολυμπήσεις.`,
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
    openAppBeach: 'Öffne die App für Live-Empfehlungsbewertung, Windexposition, Wellen, beste Tageszeit und Alternativen in der Nähe.',
    openAppRegion: 'Wetter und Meeresbedingungen ändern sich im Tagesverlauf. CalmBeach zeigt Live-Empfehlungen in der App-Ansicht.',
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
    openAppBeach: "Ouvrez l'application pour la note de recommandation en direct, l'exposition au vent, les vagues, les créneaux utiles et les alternatives à proximité.",
    openAppRegion: "La météo et l'état de la mer changent. CalmBeach affiche les recommandations en direct dans l'application.",
    viewBeach: 'Voir cette plage sur CalmBeach Grèce',
    viewRegion: islandName => `Voir ${islandName} sur CalmBeach Grèce`,
    regionHeading: islandName => `Plages : ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Grèce – comparez ${count} plages selon le vent, les vagues, la météo, l'exposition, l'accès et le type de plage avant de choisir où vous baigner.`,
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
    openAppBeach: "Apri l'app per il punteggio consigliato in tempo reale, l'esposizione al vento, le onde, il momento migliore della giornata e le alternative vicine.",
    openAppRegion: "Il meteo e le condizioni del mare cambiano durante la giornata. CalmBeach mostra consigli in tempo reale nella vista app.",
    viewBeach: 'Vedi questa spiaggia su CalmBeach Grecia',
    viewRegion: islandName => `Vedi ${islandName} su CalmBeach Grecia`,
    regionHeading: islandName => `Spiagge: ${islandName}`,
    regionDescription: (islandName, count) => `${islandName}, Grecia - confronta ${count} spiagge in base a vento, onde, meteo, esposizione, accesso e tipo di spiaggia prima di scegliere dove fare il bagno.`,
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
      'Προτάσεις παραλιών με βάση τις συνθήκες',
      'Έλεγχος ανέμου, κύματος και καιρού',
      'Αναζήτηση ανά νησί ή περιοχή',
      'Χάρτης και λεπτομέρειες παραλίας',
    ]
    : [
      'Beach recommendations by conditions',
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
          ? 'Άνοιξε την εφαρμογή για live προτάσεις με βάση άνεμο και θάλασσα.'
          : "Open the app for live recommendations based on wind and sea conditions.")}</p>
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
        tail: `. Orientation only reflects which way the coast faces, not confirmed shelter, so check wind and waves in the app before you go.`,
      },
      gr: {
        leads: [
          `Η παραλία ${beachName} κοιτάζει ${faceWords}`,
          `Ο προσανατολισμός της παραλίας ${beachName} είναι ${faceWords}`,
          `Η παραλία ${beachName} βλέπει ${faceWords}`,
        ],
        prot: w => `, οπότε έχει συνήθως φυσική κάλυψη από ${w} ανέμους`,
        tail: `. Ο προσανατολισμός δείχνει μόνο την πλευρά της ακτής, όχι επιβεβαιωμένη προστασία· έλεγξε άνεμο και κύμα στην εφαρμογή πριν πας.`,
      },
      de: {
        leads: [
          `Der Strand ${beachName} ist nach ${faceWords} ausgerichtet`,
          `${beachName} öffnet sich nach ${faceWords}`,
          `Die Bucht von ${beachName} ist nach ${faceWords} orientiert`,
        ],
        prot: w => `, bietet also meist natürlichen Schutz vor ${w} Winden`,
        tail: `. Die Ausrichtung zeigt nur, wohin die Küste blickt, keinen gesicherten Schutz – prüfe vor dem Besuch Wind und Wellen in der App.`,
      },
      fr: {
        leads: [
          `Le rivage de ${beachName} est orienté vers ${faceWords}`,
          `${beachName} s'ouvre vers ${faceWords}`,
          `La baie de ${beachName} donne vers ${faceWords}`,
        ],
        prot: w => `, et bénéficie donc le plus souvent d'un abri naturel contre les vents ${w}`,
        tail: `. L'orientation indique seulement vers où la côte est tournée, pas un abri garanti — vérifiez le vent et les vagues dans l'application avant d'y aller.`,
      },
      it: {
        leads: [
          `La spiaggia ${beachName} è orientata verso ${faceWords}`,
          `${beachName} si apre verso ${faceWords}`,
          `La baia di ${beachName} guarda verso ${faceWords}`,
        ],
        prot: w => `, quindi di solito ha riparo naturale dai venti ${w}`,
        tail: `. L'orientamento indica solo verso dove guarda la costa, non un riparo garantito: controlla vento e onde nell'app prima di andare.`,
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
    en: 'Nearby beaches oriented away from the Meltemi',
    gr: 'Κοντινές επιλογές μακριά από το μελτέμι',
    de: 'Nahegelegene Strände mit Meltemi-Ausrichtung',
    fr: 'Plages proches orientées contre le meltemi',
    it: 'Spiagge vicine orientate lontano dal meltemi',
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
  en: `See practical info for ${beachName} in ${islandName}, including location, beach type, wind exposure, map and tips to help you decide when to visit.`,
  gr: `Δες πρακτικές πληροφορίες για ${beachName} σε ${islandName}, όπως τοποθεσία, τύπο παραλίας, έκθεση στον άνεμο, χάρτη και χρήσιμες συμβουλές.`,
  de: `Strand ${beachName}, ${islandName} (Griechenland). Prüfe vor dem Besuch Wind, Wellen, Wetter und die Lage des Strandes.`,
  fr: `Plage ${beachName}, ${islandName} (Grèce). Vérifiez le vent, les vagues, la météo et l'exposition de la plage avant d'y aller.`,
  it: `Spiaggia ${beachName}, ${islandName} (Grecia). Controlla vento, onde, meteo ed esposizione della spiaggia prima di andare.`,
});
const hasUnsupportedStaticConditionCopy = text => {
  const value = String(text || '');
  if (!value) return false;
  if (/\b(today|today's|today’s|heute|oggi)\b|aujourd['’]hui|\bdu jour\b|\u03c3\u03ae\u03bc\u03b5\u03c1\u03b1|\u03c3\u03b7\u03bc\u03b5\u03c1\u03b9\u03bd/i.test(value)) return true;
  if (/(?:\bsafe(?:st)?\b|\u03b1\u03c3\u03c6\u03b1\u03bb)/i.test(value) && !/\b(safety|lifeguard|warning flags?|beach flags?|red flags?|yellow flags?|avoid|caution|does not replace|do not replace|not replace|follow)\b/i.test(value)) return true;
  if (/\bguarantee(?:d)?\b/i.test(value) && !/\b(?:not|no|never|without)\s+\w*\s*guarantee/i.test(value)) return true;
  if (/\b(calm|calmer|calmest)\b|\u03ae\u03c1\u03b5\u03bc|\u03b3\u03b1\u03bb\u03ae\u03bd|\u03bd\u03b7\u03bd\u03b5\u03bc/i.test(value) && !/\b(not|avoid|conditions?|mild|low-wind|wind and waves|check)\b|\u03ad\u03bb\u03b5\u03b3\u03be\u03b5|\u03c3\u03c5\u03bd\u03b8\u03ae\u03ba/i.test(value)) return true;
  if (/\b(sheltered|wind-protected|protected from|fully protected)\b|\u03c0\u03c1\u03bf\u03c3\u03c4\u03b1\u03c4\u03b5\u03c5|\u03b1\u03c0\u03ac\u03bd\u03b5\u03bc|\u03c5\u03c0\u03ae\u03bd\u03b5\u03bc/i.test(value) && !/\b(usually|often|may|might|can|more|less|available|orientation|oriented|based on|not guaranteed|check|compare|before you go|conditions vary|depending|signal|data|less exposed|more comfortable)\b|\u03bc\u03c0\u03bf\u03c1\u03b5\u03af|\u03c3\u03c5\u03c7\u03bd|\u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc|\u03c0\u03c1\u03bf\u03c3\u03b1\u03bd\u03b1\u03c4\u03bf\u03bb|\u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd|\u03c0\u03c1\u03b9\u03bd\s+\u03c0\u03b1\u03c2|\u03c0\u03b9\u03bf/i.test(value)) return true;
  return false;
};

const beachDescriptionFor = (beach, beachName, islandName, language) => {
  const fallback = beachFallbackDescription(beachName, islandName, language);
  if (language !== 'en' && language !== 'gr') return fallback;
  const authored = localized(beach.description, '', language);
  return authored && !hasUnsupportedStaticConditionCopy(authored) ? authored : fallback;
};

// Trim a sentence to a meta-description length without cutting a word in half.
const truncateForMeta = (text, max = 160) => {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  // Strip trailing dashes/commas/spaces so we never render "… —…" or "…,…".
  const trimmed = slice.slice(0, lastSpace > 80 ? lastSpace : max).replace(/[\s—–,-]+$/u, '').trim();
  return `${trimmed}…`;
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
    en: 'Pollonia, Milos: a sandy fishing-village beach with sunbeds, parking and tavernas, good for families. Check wind and waves before you go.',
    gr: 'Πολλώνια Μήλου: αμμώδης παραλία σε ψαροχώρι, με ξαπλώστρες, πάρκινγκ και ταβέρνες, καλή για οικογένειες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'south-aegean-milos#1924': {
    en: 'Triades, Milos: remote sand-and-pebble coves on the wild west coast, good for snorkeling, often better in northerly Meltemi winds. Check live wind first.',
    gr: 'Τριάδες Μήλου: τρεις απομακρυσμένοι όρμοι με άμμο και βότσαλο στη δυτική ακτή, καλοί για snorkeling και υπήνεμοι στο μελτέμι. Δες ζωντανά τον άνεμο.',
  },
  'north-aegean-lemnos#1455': {
    en: 'Mikro Fanaraki, Lemnos: organised sandy beach with sunbeds, bar and parking, often better with northerly winds. Check wind and waves.',
    gr: 'Μικρό Φαναράκι, Λήμνος: οργανωμένη αμμώδης παραλία με ξαπλώστρες, bar και πάρκινγκ, υπήνεμη σε βόρειους ανέμους. Δες ζωντανά άνεμο και κύμα.',
  },
  'peloponnese-korinthia-mainland#1528': {
    en: 'Lychnari, Korinthia: a quiet pebble beach good for snorkeling and often better with northerly winds. Check wind and sea before you go.',
    gr: 'Λυχνάρι Κορινθίας: ήσυχη παραλία με βότσαλο, καλή για snorkeling και υπήνεμη σε βόρειους ανέμους. Δες ζωντανά άνεμο και θάλασσα πριν πας.',
  },
  'peloponnese-korinthia-mainland#1523': {
    en: 'Kalogerolimano, Korinthia: a pebble cove good for snorkeling and often better with northerly winds. Check wind and sea before you go.',
    gr: 'Καλογερολίμανο Κορινθίας: προστατευμένος όρμος με βότσαλο, καλός για snorkeling, υπήνεμος σε βόρειους ανέμους. Δες ζωντανά άνεμο και θάλασσα.',
  },
  'west-greece-ileia-mainland#2568': {
    en: 'Kounoupeli, Ileia: a quiet, family-friendly sand-and-pebble beach with sunbeds. Check wind and waves before you go.',
    gr: 'Κουνουπέλι Ηλείας: ήσυχη, οικογενειακή παραλία με άμμο, βότσαλο και ξαπλώστρες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'thessaly-magnesia-mainland---pelion#2721': {
    en: 'Fakistra, Pelion: a secluded pebble cove with clear water, good for snorkeling. Check wind and waves before you go.',
    gr: 'Φακίστρα Πηλίου: απομακρυσμένος όρμος με βότσαλο και καθαρά νερά, καλός για snorkeling. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'south-aegean-paros#2029': {
    en: 'Kalogeros, Paros: a sand-and-pebble beach good for snorkeling and often better with Meltemi winds. Check wind and waves before you go.',
    gr: 'Καλόγερος Πάρου: παραλία με άμμο και βότσαλο, καλή για snorkeling και υπήνεμη στο μελτέμι. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  'crete-crete-chania#574': {
    en: 'Platanias, Chania: a long organised sandy beach near Chania with sunbeds. Check wind and waves before you go.',
    gr: 'Πλατανιάς Χανίων: μεγάλη οργανωμένη αμμώδης παραλία κοντά στα Χανιά, με ξαπλώστρες. Δες ζωντανά άνεμο και κύμα πριν πας.',
  },
  // Ranks well (~pos 9) with impressions but near-zero clicks: no traits/story in
  // data, so the generated meta is the bare live-CTA template. The durable, verified
  // hook the template can't see is the adjacent Diros Caves (Vlychada) in Mani.
  'peloponnese-lakonia-mainland#3071': {
    en: 'Diros Beach, Mani: a pebble cove with clear water right beside the Diros Caves in Laconia. Check live wind & waves before you go.',
    gr: 'Παραλία Διρού, Μάνη: όρμος με βότσαλα και καθαρά νερά, ακριβώς δίπλα στα Σπήλαια Διρού. Δες live άνεμο & κύμα πριν πας.',
  },
  // Same pattern (impressions, ~zero clicks, empty traits): the honest hook is a
  // quiet, natural beach with clear water and tavernas nearby, an easy Saronic
  // escape from Athens — none of which the generated template surfaces.
  'attica-salamina#3056': {
    en: 'Kaki Vigla, Salamina: a quiet natural beach with clear water and tavernas nearby, an easy escape from Athens. Check live wind & waves.',
    gr: 'Κακή Βίγλα, Σαλαμίνα: ήσυχη φυσική παραλία με καθαρά νερά και ταβέρνες δίπλα, κοντά στην Αθήνα. Δες live άνεμο & κύμα πριν πας.',
  },
};

// The live-conditions CTA that closes a beach-page meta description. Allowed
// ONLY on beach pages (they hydrate into the SPA and show live wind/waves) — a
// functional, truthful promise, never on the static category/national articles.
const BEACH_META_CTA = {
  long: {
    en: 'Check live wind, waves and weather before you go — map, access and nearby beaches.',
    gr: 'Δες live άνεμο, κύμα και καιρό πριν πας — χάρτης, πρόσβαση και κοντινές παραλίες.',
  },
  short: {
    en: 'Check live wind, waves and weather before you go.',
    gr: 'Δες live άνεμο, κύμα και καιρό πριν πας.',
  },
  tiny: {
    en: 'Check live wind & waves.',
    gr: 'Δες live άνεμο & κύμα.',
  },
  story: {
    en: 'Check live wind & waves before you go.',
    gr: 'Δες live άνεμο & κύμα πριν πας.',
  },
};

// Comma-joined, data-backed trait clause for the beach meta template (en/gr).
// Priority: type → 1–2 amenities → snorkeling → northerly shelter (qualified).
// Shelter uses "often more / συχνά πιο" so it passes the honesty guards and the
// audit (it is a comparative, orientation-based claim, not a state promise).
const BEACH_TYPE_TRAIT = {
  sandy:           { en: 'Sandy beach',            gr: 'Αμμώδης παραλία' },
  pebbles:         { en: 'Pebble beach',           gr: 'Παραλία με βότσαλο' },
  'sandy-pebbles': { en: 'Sand & pebble beach',    gr: 'Παραλία με άμμο & βότσαλο' },
  rocky:           { en: 'Rocky beach',            gr: 'Βραχώδης παραλία' },
};
const beachTraitSentence = (beach, language) => {
  const lang = language === 'gr' ? 'gr' : 'en';
  const typePhrase = BEACH_TYPE_TRAIT[beach?.beachType]?.[lang];
  const features = [];
  const organized = beach.amenities?.organized === true;
  const sunbeds = beach.amenities?.sunbeds === true;
  if (organized && sunbeds) features.push(lang === 'en' ? 'organised with sunbeds' : 'οργανωμένη με ξαπλώστρες');
  else if (organized) features.push(lang === 'en' ? 'organised' : 'οργανωμένη');
  else if (sunbeds) features.push(lang === 'en' ? 'with sunbeds' : 'με ξαπλώστρες');
  if (beach.amenities?.parking === true) features.push(lang === 'en' ? 'with parking' : 'με πάρκινγκ');
  if (beach.amenities?.restaurant === true || beach.amenities?.taverna === true) features.push(lang === 'en' ? 'with food nearby' : 'με φαγητό κοντά');
  if (beach.environment?.familyFriendly === true) features.push(lang === 'en' ? 'family-friendly' : 'οικογενειακή');
  if (beach.activities?.snorkeling === true) features.push(lang === 'en' ? 'good for snorkeling' : 'καλή για snorkeling');
  if (Array.isArray(beach.protectedFrom) && NORTHERLY.some(d => beach.protectedFrom.includes(d))) {
    features.push(lang === 'en' ? 'often more sheltered in northerly winds' : 'συχνά πιο απάνεμη σε βόρειους ανέμους');
  }
  const parts = [typePhrase, ...features.slice(0, 3)].filter(Boolean);
  if (parts.length === 0) return '';
  return `${parts.join(', ')}.`;
};

// Programmatic beach meta template (en/gr): "{Label}, {island}: {traits} {CTA}".
// de/fr/it keep the existing localized practical-info template (Milos pilot).
const beachTraitMetaDescription = (beach, beachName, islandName, language) => {
  if (language !== 'en' && language !== 'gr') {
    return beachDescriptionFor(beach, beachName, islandName, language);
  }
  const label = localizedBeachLabel(beachName, language);
  const traits = beachTraitSentence(beach, language);
  const head = `${label}, ${islandName}: `;
  // Prefer the richest CTA that fits; keep the traits and the live hook as long
  // as possible, only dropping to a traits-only snippet as the last resort.
  const candidates = [
    traits ? `${head}${traits} ${BEACH_META_CTA.long[language]}` : `${head}${BEACH_META_CTA.long[language]}`,
    traits ? `${head}${traits} ${BEACH_META_CTA.short[language]}` : `${head}${BEACH_META_CTA.short[language]}`,
    traits ? `${head}${traits} ${BEACH_META_CTA.tiny[language]}` : `${head}${BEACH_META_CTA.tiny[language]}`,
    traits ? `${head}${traits}` : `${head}${BEACH_META_CTA.tiny[language]}`,
  ];
  for (const candidate of candidates) if (candidate.length <= 155) return candidate;
  return truncateForMeta(candidates[candidates.length - 1], 155);
};

// Per-beach <head>/JSON-LD description cascade:
//   1. hand-written per-page override (12-page CTR fix), unchanged
//   2. unique editorial story opener + live CTA (en/gr story beaches)
//   3. programmatic trait template + live CTA (en/gr), or the localized
//      practical-info template (de/fr/it).
// The authored `description` data field is no longer used for the meta (it was
// generic across beaches); it still renders in the visible page body.
const beachMetaDescription = (beach, region, beachName, islandName, language) => {
  const override = SEO_META_DESCRIPTION_OVERRIDES[`${region?.id}#${beach.id}`];
  if (override && (language === 'en' || language === 'gr') && override[language] && !hasUnsupportedStaticConditionCopy(override[language])) {
    return override[language];
  }
  const story = getBeachStory(region, beach, language);
  const safeStoryParagraph = story?.paragraphs?.find(paragraph => !hasUnsupportedStaticConditionCopy(paragraph));
  if (safeStoryParagraph) {
    const opener = truncateForMeta(safeStoryParagraph, 115);
    const withCta = `${opener} ${BEACH_META_CTA.story[language]}`;
    if (withCta.length <= 155) return withCta;
    return truncateForMeta(safeStoryParagraph, 155);
  }
  return beachTraitMetaDescription(beach, beachName, islandName, language);
};

// Visible, crawlable editorial section (unique geology/history/character prose)
// rendered into the static beach page body. Its <h2> is the curated, keyword-ish
// story title (e.g. "Το σεληνιακό τοπίο της Μήλου").
const renderBeachStory = (region, beach, language) => {
  const story = getBeachStory(region, beach, language);
  if (!story) return '';
  const safeParagraphs = story.paragraphs.filter(paragraph => !hasUnsupportedStaticConditionCopy(paragraph));
  if (safeParagraphs.length === 0) return '';
  const heading = !hasUnsupportedStaticConditionCopy(story.title) ? story.title : '';
  return `
        <section style="margin:0 0 22px;">
          ${heading ? `<h2 style="margin:0 0 10px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>` : ''}
          ${safeParagraphs.map(p => `<p style="margin:0 0 10px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`).join('')}
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
  const safeLead = story.paragraphs.find(paragraph => !hasUnsupportedStaticConditionCopy(paragraph));
  if (!safeLead) return '';
  const lead = truncateForMeta(safeLead, 150);
  const title = !hasUnsupportedStaticConditionCopy(story.title) ? story.title : '';
  return title ? `${title} — ${lead}` : lead;
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
// The live-conditions hook for beach-page <title>s. This is the whole point of
// the CTR redesign — no competitor in the SERP can truthfully say "live", and
// the beach page delivers it (SPA hydration shows live wind/waves/weather).
const BEACH_TITLE_HOOK = {
  en: 'Live Wind & Waves',
  gr: 'Άνεμος & Κύμα Live',
  de: 'Wind & Wellen live',
  fr: 'Vent & vagues en direct',
  it: 'Vento e onde live',
};
// Greek glyphs are wider, so Google truncates GR titles a few px earlier.
const beachTitleMaxLen = language => (language === 'gr' ? 58 : 60);
const beachH1For = (beachName, islandName, language) =>
  `${localizedBeachLabel(beachName, language)}, ${islandName}`;
// Deterministic overflow tiers (spec §2.2): T1 full → T2 drop brand → T3 drop
// island → T4 bare label. The hook is never dropped before brand/island.
const beachTitleFor = (beachName, islandName, language) => {
  const label = localizedBeachLabel(beachName, language);
  const hook = BEACH_TITLE_HOOK[language] || BEACH_TITLE_HOOK.en;
  const sep = language === 'en' ? ': ' : ' — ';
  const max = beachTitleMaxLen(language);
  const tiers = [
    `${label}, ${islandName}${sep}${hook} | CalmBeach`,
    `${label}, ${islandName}${sep}${hook}`,
    `${label}${sep}${hook}`,
  ];
  for (const tier of tiers) if (tier.length <= max) return tier;
  return label;
};
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

// --- Region-page shelter hook (dataset-driven, differentiates from a plain list) ---
// Count = beaches carrying the baked `shelteredFromLocalWind` flag (computed once by
// scripts/bakeLocalWindShelter.ts via the curated-aware windClimatology, with
// context-specific sectors: meltemi N+NE / maistros NW+W). This is the SINGLE source
// shared with beachGuides + App; the prerender never recomputes it here.
const countShelteredBeaches = beaches =>
  beaches.filter(b => Number.isInteger(b.id) && b.name && b.shelteredFromLocalWind === true).length;

// Wind-regime copy tokens (meltemi / maistros / summer wind) come from the shared
// localWindContext.mjs so the labels never drift between build scripts and runtime.
const windWordsFor = regionId => localWindLabelFor(regionId);

// Explicit Greek declension per region (genitive for "Παραλίες {gen}" + the
// "σε"+accusative phrase "στη/στον/στο/στους/στις/στα {name}" for meta/H1/intro).
// Hand-authored (Greek toponyms have exceptions) — NOT rule-generated. Keyed by
// region id. `en` overrides an unnatural admin display name.
const REGION_DECLENSION = {
  'attica-aegina': { gen: 'Αίγινας', prep: 'στην Αίγινα' },
  'attica-agistri': { gen: 'Αγκιστρίου', prep: 'στο Αγκίστρι' },
  'attica-athens-area-mainland': { gen: 'Αττικής', prep: 'στην Αττική', en: 'Attica' },
  'attica-east-attica-mainland': { gen: 'Ανατολικής Αττικής', prep: 'στην Ανατολική Αττική' },
  'attica-hydra': { gen: 'Ύδρας', prep: 'στην Ύδρα' },
  'attica-kythira': { gen: 'Κυθήρων', prep: 'στα Κύθηρα' },
  'attica-methana': { gen: 'Μεθάνων', prep: 'στα Μέθανα' },
  'attica-piraeus-area': { gen: 'Πειραιά', prep: 'στον Πειραιά', en: 'Piraeus' },
  'attica-poros': { gen: 'Πόρου', prep: 'στον Πόρο' },
  'attica-salamina': { gen: 'Σαλαμίνας', prep: 'στη Σαλαμίνα' },
  'attica-spetses': { gen: 'Σπετσών', prep: 'στις Σπέτσες' },
  'attica-west-attica-mainland': { gen: 'Δυτικής Αττικής', prep: 'στη Δυτική Αττική' },
  'central-greece-evia': { gen: 'Εύβοιας', prep: 'στην Εύβοια' },
  'central-greece-fokida-mainland': { gen: 'Φωκίδας', prep: 'στη Φωκίδα' },
  'central-greece-fthiotida-mainland': { gen: 'Φθιώτιδας', prep: 'στη Φθιώτιδα' },
  'central-greece-skyros': { gen: 'Σκύρου', prep: 'στη Σκύρο' },
  'central-greece-viotia-mainland': { gen: 'Βοιωτίας', prep: 'στη Βοιωτία' },
  'central-macedonia-halkidiki-mainland': { gen: 'Χαλκιδικής', prep: 'στη Χαλκιδική' },
  'central-macedonia-pieria-mainland': { gen: 'Πιερίας', prep: 'στην Πιερία' },
  'central-macedonia-thessaloniki-area': { gen: 'Θεσσαλονίκης', prep: 'στη Θεσσαλονίκη', en: 'Thessaloniki' },
  'crete-crete-chania': { gen: 'Χανίων', prep: 'στα Χανιά' },
  'crete-crete-heraklion': { gen: 'Ηρακλείου', prep: 'στο Ηράκλειο' },
  'crete-crete-lasithi': { gen: 'Λασιθίου', prep: 'στο Λασίθι' },
  'crete-crete-rethymno': { gen: 'Ρεθύμνου', prep: 'στο Ρέθυμνο' },
  'crete-gavdos': { gen: 'Γαύδου', prep: 'στη Γαύδο' },
  'east-macedonia-and-thrace-evros-mainland': { gen: 'Έβρου', prep: 'στον Έβρο' },
  'east-macedonia-and-thrace-kavala-mainland': { gen: 'Καβάλας', prep: 'στην Καβάλα' },
  'east-macedonia-and-thrace-rodopi-mainland': { gen: 'Ροδόπης', prep: 'στη Ροδόπη' },
  'east-macedonia-and-thrace-samothraki': { gen: 'Σαμοθράκης', prep: 'στη Σαμοθράκη' },
  'east-macedonia-and-thrace-thasos': { gen: 'Θάσου', prep: 'στη Θάσο' },
  'east-macedonia-and-thrace-xanthi-mainland': { gen: 'Ξάνθης', prep: 'στην Ξάνθη' },
  'epirus-arta-mainland': { gen: 'Άρτας', prep: 'στην Άρτα' },
  'epirus-preveza-mainland': { gen: 'Πρέβεζας', prep: 'στην Πρέβεζα' },
  'epirus-thesprotia-mainland': { gen: 'Θεσπρωτίας', prep: 'στη Θεσπρωτία' },
  'ionian-islands-antipaxos': { gen: 'Αντίπαξων', prep: 'στους Αντίπαξους' },
  'ionian-islands-corfu': { gen: 'Κέρκυρας', prep: 'στην Κέρκυρα' },
  'ionian-islands-erikoussa': { gen: 'Ερείκουσας', prep: 'στην Ερείκουσα' },
  'ionian-islands-ithaca': { gen: 'Ιθάκης', prep: 'στην Ιθάκη' },
  'ionian-islands-kefalonia': { gen: 'Κεφαλονιάς', prep: 'στην Κεφαλονιά' },
  'ionian-islands-lefkada': { gen: 'Λευκάδας', prep: 'στη Λευκάδα' },
  'ionian-islands-mathraki': { gen: 'Μαθρακίου', prep: 'στο Μαθράκι' },
  'ionian-islands-meganisi': { gen: 'Μεγανησίου', prep: 'στο Μεγανήσι' },
  'ionian-islands-othonoi': { gen: 'Οθωνών', prep: 'στους Οθωνούς' },
  'ionian-islands-paxos': { gen: 'Παξών', prep: 'στους Παξούς' },
  'ionian-islands-zakynthos': { gen: 'Ζακύνθου', prep: 'στη Ζάκυνθο' },
  'north-aegean-agios-efstratios': { gen: 'Αγίου Ευστρατίου', prep: 'στον Άγιο Ευστράτιο' },
  'north-aegean-chios': { gen: 'Χίου', prep: 'στη Χίο' },
  'north-aegean-fournoi': { gen: 'Φούρνων', prep: 'στους Φούρνους' },
  'north-aegean-ikaria': { gen: 'Ικαρίας', prep: 'στην Ικαρία' },
  'north-aegean-lemnos': { gen: 'Λήμνου', prep: 'στη Λήμνο' },
  'north-aegean-lesvos': { gen: 'Λέσβου', prep: 'στη Λέσβο' },
  'north-aegean-oinousses': { gen: 'Οινουσσών', prep: 'στις Οινούσσες' },
  'north-aegean-psara': { gen: 'Ψαρών', prep: 'στα Ψαρά' },
  'north-aegean-samos': { gen: 'Σάμου', prep: 'στη Σάμο' },
  'peloponnese-argolida-mainland': { gen: 'Αργολίδας', prep: 'στην Αργολίδα' },
  'peloponnese-arkadia-mainland': { gen: 'Αρκαδίας', prep: 'στην Αρκαδία' },
  'peloponnese-korinthia-mainland': { gen: 'Κορινθίας', prep: 'στην Κορινθία' },
  'peloponnese-lakonia-mainland': { gen: 'Λακωνίας', prep: 'στη Λακωνία' },
  'peloponnese-messinia-mainland': { gen: 'Μεσσηνίας', prep: 'στη Μεσσηνία' },
  'south-aegean-agathonisi': { gen: 'Αγαθονησίου', prep: 'στο Αγαθονήσι' },
  'south-aegean-amorgos': { gen: 'Αμοργού', prep: 'στην Αμοργό' },
  'south-aegean-anafi': { gen: 'Ανάφης', prep: 'στην Ανάφη' },
  'south-aegean-andros': { gen: 'Άνδρου', prep: 'στην Άνδρο' },
  'south-aegean-antiparos': { gen: 'Αντιπάρου', prep: 'στην Αντίπαρο' },
  'south-aegean-arki': { gen: 'Αρκών', prep: 'στους Αρκούς' },
  'south-aegean-astypalaia': { gen: 'Αστυπάλαιας', prep: 'στην Αστυπάλαια' },
  'south-aegean-donousa': { gen: 'Δονούσας', prep: 'στη Δονούσα' },
  'south-aegean-folegandros': { gen: 'Φολεγάνδρου', prep: 'στη Φολέγανδρο' },
  'south-aegean-halki': { gen: 'Χάλκης', prep: 'στη Χάλκη' },
  'south-aegean-ios': { gen: 'Ίου', prep: 'στην Ίο' },
  'south-aegean-iraklia': { gen: 'Ηρακλειάς', prep: 'στην Ηρακλειά' },
  'south-aegean-kalymnos': { gen: 'Καλύμνου', prep: 'στην Κάλυμνο' },
  'south-aegean-karpathos': { gen: 'Καρπάθου', prep: 'στην Κάρπαθο' },
  'south-aegean-kasos': { gen: 'Κάσου', prep: 'στην Κάσο' },
  'south-aegean-kastellorizo': { gen: 'Καστελλορίζου', prep: 'στο Καστελλόριζο' },
  'south-aegean-kea': { gen: 'Κέας', prep: 'στην Κέα' },
  'south-aegean-kimolos': { gen: 'Κιμώλου', prep: 'στην Κίμωλο' },
  'south-aegean-kos': { gen: 'Κω', prep: 'στην Κω' },
  'south-aegean-koufonisia': { gen: 'Κουφονησίων', prep: 'στα Κουφονήσια' },
  'south-aegean-kythnos': { gen: 'Κύθνου', prep: 'στην Κύθνο' },
  'south-aegean-leros': { gen: 'Λέρου', prep: 'στη Λέρο' },
  'south-aegean-lipsi': { gen: 'Λειψών', prep: 'στους Λειψούς' },
  'south-aegean-marathi': { gen: 'Μαραθίου', prep: 'στο Μαράθι' },
  'south-aegean-milos': { gen: 'Μήλου', prep: 'στη Μήλο' },
  'south-aegean-mykonos': { gen: 'Μυκόνου', prep: 'στη Μύκονο' },
  'south-aegean-naxos': { gen: 'Νάξου', prep: 'στη Νάξο' },
  'south-aegean-nisyros': { gen: 'Νισύρου', prep: 'στη Νίσυρο' },
  'south-aegean-paros': { gen: 'Πάρου', prep: 'στην Πάρο' },
  'south-aegean-patmos': { gen: 'Πάτμου', prep: 'στην Πάτμο' },
  'south-aegean-polyaigos': { gen: 'Πολυαίγου', prep: 'στην Πολύαιγο' },
  'south-aegean-pserimos': { gen: 'Ψερίμου', prep: 'στην Ψέριμο' },
  'south-aegean-rhodes': { gen: 'Ρόδου', prep: 'στη Ρόδο' },
  'south-aegean-santorini': { gen: 'Σαντορίνης', prep: 'στη Σαντορίνη' },
  'south-aegean-schinoussa': { gen: 'Σχοινούσας', prep: 'στη Σχοινούσα' },
  'south-aegean-serifos': { gen: 'Σερίφου', prep: 'στη Σέριφο' },
  'south-aegean-sifnos': { gen: 'Σίφνου', prep: 'στη Σίφνο' },
  'south-aegean-sikinos': { gen: 'Σικίνου', prep: 'στη Σίκινο' },
  'south-aegean-symi': { gen: 'Σύμης', prep: 'στη Σύμη' },
  'south-aegean-syros': { gen: 'Σύρου', prep: 'στη Σύρο' },
  'south-aegean-telendos': { gen: 'Τελένδου', prep: 'στην Τέλενδο' },
  'south-aegean-tilos': { gen: 'Τήλου', prep: 'στην Τήλο' },
  'south-aegean-tinos': { gen: 'Τήνου', prep: 'στην Τήνο' },
  'thessaly-alonissos': { gen: 'Αλοννήσου', prep: 'στην Αλόννησο' },
  'thessaly-larissa-coast-agia---kissavos': { gen: 'Λάρισας', prep: 'στη Λάρισα', en: 'Larissa' },
  'thessaly-magnesia-mainland---pelion': { gen: 'Πηλίου', prep: 'στο Πήλιο', en: 'Pelion' },
  'thessaly-skiathos': { gen: 'Σκιάθου', prep: 'στη Σκιάθο' },
  'thessaly-skopelos': { gen: 'Σκοπέλου', prep: 'στη Σκόπελο' },
  'west-greece-achaia-mainland': { gen: 'Αχαΐας', prep: 'στην Αχαΐα' },
  'west-greece-aetolia-acarnania-mainland': { gen: 'Αιτωλοακαρνανίας', prep: 'στην Αιτωλοακαρνανία' },
  'west-greece-ileia-mainland': { gen: 'Ηλείας', prep: 'στην Ηλεία' },
};
// Greek genitive for the title, falling back to the raw name if unmapped.
const regionGenGr = (regionId, fallbackName) => REGION_DECLENSION[regionId]?.gen || fallbackName;
// Greek "σε"+accusative phrase for meta/H1/intro, falling back to "σε {name}".
const regionPrepGr = (regionId, fallbackName) => REGION_DECLENSION[regionId]?.prep || `σε ${fallbackName}`;
// English display name (override for unnatural admin names), else the dataset name.
const regionDisplayEn = (regionId, fallbackName) => REGION_DECLENSION[regionId]?.en || fallbackName;

// --- Computed geometry intro for the 'sheltered' guide (defeats doorway-page risk) ---
// Instead of a template intro with a swapped toponym, we read the region's
// ray-cast exposure profiles and STATE what the geometry actually shows: how many
// beaches take no open water toward the local wind, which coast they cluster on,
// and the arc they face. Every number is computed; the paragraph cannot survive a
// find-and-replace of the island name. Falls back to the template intro when the
// data is missing or the sheltered set does not cluster cleanly (honesty guard).
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compassBin = deg => COMPASS_8[Math.round(((deg % 360) / 45)) % 8];
const levelRank = level => (level === 'exposed' ? 2 : level === 'partial' ? 1 : 0);
// Coast the shore faces + the wind that then hits it, keyed by 8-point bin.
const COAST_WORD = {
  N:  { gr: 'βόρεια', en: 'north' },        NE: { gr: 'βορειοανατολική', en: 'northeast' },
  E:  { gr: 'ανατολική', en: 'east' },      SE: { gr: 'νοτιοανατολική', en: 'southeast' },
  S:  { gr: 'νότια', en: 'south' },         SW: { gr: 'νοτιοδυτική', en: 'southwest' },
  W:  { gr: 'δυτική', en: 'west' },         NW: { gr: 'βορειοδυτική', en: 'northwest' },
};
const DIR_ABBR_GR = { N: 'Β', NE: 'ΒΑ', E: 'Α', SE: 'ΝΑ', S: 'Ν', SW: 'ΝΔ', W: 'Δ', NW: 'ΒΔ' };
const DIR_ABBR_EN = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };
// "the wind blows from …" — used for the opposite wind that reverses the shelter.
const DIR_FROM = {
  N:  { gr: 'τον βορρά', en: 'the north' },        NE: { gr: 'τα βορειοανατολικά', en: 'the northeast' },
  E:  { gr: 'την ανατολή', en: 'the east' },       SE: { gr: 'τα νοτιοανατολικά', en: 'the southeast' },
  S:  { gr: 'τον νότο', en: 'the south' },          SW: { gr: 'τα νοτιοδυτικά', en: 'the southwest' },
  W:  { gr: 'τη δύση', en: 'the west' },            NW: { gr: 'τα βορειοδυτικά', en: 'the northwest' },
};

// Read + cache a region's ray-cast exposure profiles (may not exist for every region).
const exposureCache = new Map();
const loadExposureProfiles = async regionId => {
  if (exposureCache.has(regionId)) return exposureCache.get(regionId);
  let data = null;
  try {
    data = await readJson(toPublicFilePath(`/data/geospatial/exposure/${regionId}.json`));
  } catch {
    data = null;
  }
  exposureCache.set(regionId, data);
  return data;
};

// Turn the exposure profiles into the handful of numbers the intro asserts.
// Returns { usable:false } when the data can't support a specific, honest claim.
const computeShelterGeometry = (regionId, exposure) => {
  const profiles = exposure?.profiles && typeof exposure.profiles === 'object'
    ? Object.values(exposure.profiles)
    : null;
  if (!Array.isArray(profiles) || profiles.length < 8) return { usable: false };
  const windSectors = localWindSectorsFor(regionId);
  const total = profiles.length;
  const protectedFromWind = [];
  let exposedToWind = 0;
  for (const p of profiles) {
    const s = p.sectors;
    if (!s || !Number.isFinite(p.facingDeg)) continue;
    const worst = Math.max(...windSectors.map(d => levelRank(s[d]?.level)));
    if (windSectors.every(d => s[d]?.level === 'protected')) protectedFromWind.push(p);
    if (worst === 2) exposedToWind += 1;
  }
  if (protectedFromWind.length < 4) return { usable: false };
  // Circular mean of the sheltered set's facing direction → the lee coast.
  let sx = 0, sy = 0;
  for (const p of protectedFromWind) { const r = (p.facingDeg * Math.PI) / 180; sx += Math.cos(r); sy += Math.sin(r); }
  const meanDeg = ((Math.atan2(sy / protectedFromWind.length, sx / protectedFromWind.length) * 180) / Math.PI + 360) % 360;
  const offset = deg => ((deg - meanDeg + 540) % 360) - 180; // signed distance from mean
  const inCluster = protectedFromWind.filter(p => Math.abs(offset(p.facingDeg)) <= 67.5).length;
  const clusterFrac = inCluster / protectedFromWind.length;
  if (clusterFrac < 0.6) return { usable: false }; // scattered → template is more honest
  const offsets = protectedFromWind.map(p => offset(p.facingDeg)).sort((a, b) => a - b);
  const arcStartBin = compassBin((meanDeg + offsets[0] + 360) % 360);
  const arcEndBin = compassBin((meanDeg + offsets[offsets.length - 1] + 360) % 360);
  const meanBin = compassBin(meanDeg);
  return {
    usable: true,
    total,
    protectedCount: protectedFromWind.length,
    exposedCount: exposedToWind,
    leeCoastBin: meanBin,
    arcStartBin,
    arcEndBin,
    windSectors,
  };
};

// Compose the 3-paragraph computed intro (gr/en only; de/fr/it keep the template).
const buildShelteredGeometryIntro = (regionId, geo, language) => {
  if (!geo?.usable || (language !== 'gr' && language !== 'en')) return null;
  const w = windWordsFor(regionId);
  const atoms = LOCAL_WIND_ATOMS[getRegionWindContext(regionId)];
  const windFromAbbr = language === 'gr' ? atoms.dir.gr : atoms.dir.en;
  const coast = COAST_WORD[geo.leeCoastBin][language];
  const arcAbbr = language === 'gr' ? DIR_ABBR_GR : DIR_ABBR_EN;
  const arc = geo.arcStartBin === geo.arcEndBin ? arcAbbr[geo.arcStartBin] : `${arcAbbr[geo.arcStartBin]}–${arcAbbr[geo.arcEndBin]}`;
  const oppFrom = DIR_FROM[geo.leeCoastBin][language]; // the wind that reverses the shelter
  if (language === 'gr') {
    const windNom = w.elNom;         // "το μελτέμι" / "ο μαΐστρος" (nominative)
    const eis = /^[αεηιουω]/i.test(coast) ? 'στην' : 'στη'; // "στην ανατολική" vs "στη νότια"
    return [
      `${windNom.charAt(0).toUpperCase()}${windNom.slice(1)} πνέει από ${windFromAbbr}, και στα δεδομένα μας ο διαχωρισμός φαίνεται καθαρά. Από τις ${geo.total} παραλίες που έχουμε μοντελοποιήσει, οι ${geo.protectedCount} δεν βλέπουν καθόλου ανοιχτό νερό προς ${windFromAbbr}· μαζεύονται ${eis} ${coast} ακτή, με προσανατολισμό σε ένα τόξο ${arc}. Οι πιο σταθερές απ' αυτές είναι στη λίστα πιο κάτω. Αντίθετα, ${geo.exposedCount} παραλίες είναι ορθάνοιχτες σε αυτόν τον άνεμο.`,
      `Ο λόγος είναι η ίδια η μορφολογία: αυτές οι παραλίες έχουν στεριά πίσω τους, από τη μεριά που έρχεται ${windNom}. Δεν είναι απαραίτητα κλειστοί κόλποι — απλώς κάθονται στον άνεμο-σκιά της απέναντι ακτής.`,
      `Το τίμημα το λέμε ανοιχτά: η ίδια ${coast} ακτή είναι ανοιχτή στον αντίθετο άνεμο. Τις μέρες που ο άνεμος γυρίζει από ${oppFrom}, η προστασία αντιστρέφεται και καλύτερη γίνεται η άλλη πλευρά. Γι' αυτό η λίστα περιορίζει την επιλογή — δεν αντικαθιστά την πρόγνωση· δες ζωντανό άνεμο και κύμα στη σελίδα της παραλίας πριν πας.`,
    ].join('\n\n');
  }
  return [
    `${w.en.charAt(0).toUpperCase()}${w.en.slice(1)} blows from ${windFromAbbr}, and the split shows up clearly in the data. Of the ${geo.total} beaches we have modelled, ${geo.protectedCount} take no open water toward ${windFromAbbr}; they cluster on the ${coast} coast, facing an arc of ${arc}. The most reliable of them are listed below. The other ${geo.exposedCount} sit wide open to it.`,
    `The reason is the shape of the coast itself: these beaches have land behind them on the side the wind comes from. They are not necessarily enclosed bays — they simply sit in the wind shadow of the shore opposite.`,
    `The trade-off, plainly: the same ${coast} coast is open to the opposite wind. On days the wind swings from ${oppFrom}, the shelter reverses and the far side is the better call. So this list narrows the choice — it does not replace the forecast; check live wind and waves on the beach page before you go.`,
  ].join('\n\n');
};

// Region-page copy: dataset-driven shelter hook. `sheltered` is the meltemi/βοριάς/
// Vardaris-protected count; `total` the region's beach count. Numberless fallback
// when the count is not compelling (0, 1, or all) so we never write "0 sheltered".
const pickUnderLimit = (tiers, max) => tiers.find(t => t.length <= max) || tiers[tiers.length - 1];
const buildRegionShelterCopy = (regionId, nameEl, nameEn, total, sheltered, language) => {
  const w = windWordsFor(regionId);
  const numberless = sheltered < 2 || sheltered >= total;
  if (language === 'gr') {
    const gen = regionGenGr(regionId, nameEl);
    const prep = regionPrepGr(regionId, nameEl);
    const title = numberless
      ? pickUnderLimit([`Παραλίες ${gen}: σύγκρινε προστασία από τον άνεμο | CalmBeach`, `Παραλίες ${gen}: σύγκρινε προστασία από τον άνεμο`, `Παραλίες ${gen}: προστασία από τον άνεμο`], 50)
      : pickUnderLimit([`Παραλίες ${gen}: ${sheltered} προστατευμένες από τον άνεμο | CalmBeach`, `Παραλίες ${gen}: ${sheltered} προστατευμένες από τον άνεμο`, `Παραλίες ${gen}: ${sheltered} χωρίς αέρα`], 50);
    const description = numberless
      ? `${total} παραλίες ${prep}. Σύγκρινε προστασία ${w.elFrom} και ζωντανό άνεμο και κύμα πριν πας.`
      : `${total} παραλίες ${prep}. Οι ${sheltered} είναι προστατευμένες ${w.elFrom}. Δες ζωντανά άνεμο και κύμα πριν πας.`;
    const h1 = `Ποιες παραλίες ${prep} μένουν υπήνεμες ${w.elIn};`;
    const intro = numberless
      ? `Οι ${total} παραλίες ${prep} διαφέρουν πολύ στην προστασία ${w.elFrom}. Σύγκρινέ τες και δες ζωντανά άνεμο και κύμα πριν πας.`
      : `Από τις ${total} παραλίες ${prep}, οι ${sheltered} δεν είναι εκτεθειμένες ${w.elIn} — αυτές με τις καλύτερες πιθανότητες για μπάνιο μια μέρα με αέρα. Άνοιξε όποια θες για ζωντανό άνεμο και κύμα.`;
    return { title, description, h1, intro };
  }
  // en (+ de/fr/it region pages reuse the en shelter framing with localized copy below)
  const title = numberless
    ? pickUnderLimit([`${nameEn} Beaches: Compare Wind & Wave Shelter | CalmBeach`, `${nameEn} Beaches: Compare Wind & Wave Shelter`, `${nameEn} Beaches: Wind & Wave Shelter`], 60)
    : pickUnderLimit([`${nameEn} Beaches: ${sheltered} Sheltered from the Wind | CalmBeach`, `${nameEn} Beaches: ${sheltered} Sheltered from the Wind`, `${nameEn} Beaches: ${sheltered} Wind-Sheltered`], 60);
  const description = numberless
    ? `${total} beaches in ${nameEn}. Compare each by shelter from ${w.en} and live wind & waves before you go.`
    : `${total} beaches in ${nameEn}, ${sheltered} sheltered from ${w.en}. See live wind & wave conditions for each before you go.`;
  const h1 = `Which ${nameEn} beaches are sheltered from the wind?`;
  const intro = numberless
    ? `The ${total} beaches in ${nameEn} vary widely in shelter from ${w.en}. Compare them and check live wind and waves before you go.`
    : `Of the ${total} beaches in ${nameEn}, ${sheltered} sit away from ${w.en} — the ones likeliest to stay swimmable on a windy day. Open any for live wind and waves before you go.`;
  return { title, description, h1, intro };
};

const staticRegionFallback = (island, region, canonicalUrl, locale = prerenderLocales[0], shelterCopy = null) => {
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
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${escapeHtml(shelterCopy ? shelterCopy.h1 : copy.regionHeading(islandName))}</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(shelterCopy ? shelterCopy.intro : copy.regionDescription(islandName, beaches.length))}</p>
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
  top: { en: 'Popular beaches to compare', gr: 'Δημοφιλείς παραλίες για σύγκριση' },
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
  details: { en: 'Open details for wind and waves', gr: 'Άνοιγμα λεπτομερειών για άνεμο και κύμα' },
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

const buildRegionPage = (baseHtml, island, region, imageUrl, locale = prerenderLocales[0], emittedLocales = baseLocales, sheltered = 0) => {
  const pathName = regionPath(region, island);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const islandName = displayName(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const total = beaches.filter(b => Number.isInteger(b.id) && b.name).length;
  // Dataset-driven shelter hook (meltemi/βοριάς/Vardaris count) — replaces the
  // generic, near-identical "compare N beaches by wind, waves…" copy for en/gr.
  const nameEl = displayName(island.name, region.id, 'gr');
  const nameEn = regionDisplayEn(region.id, displayName(island.name, region.id, 'en'));
  const w = windWordsFor(region.id);
  const numberless = sheltered < 2 || sheltered >= total;
  const shelterCopy = (language === 'en' || language === 'gr')
    ? buildRegionShelterCopy(region.id, nameEl, nameEn, total, sheltered, language)
    : null;
  const description = shelterCopy ? shelterCopy.description : pickLang(language, {
    de: numberless
      ? `${nameEn}, Griechenland: ${total} Strände. Vergleiche sie nach Schutz vor ${w.de} und prüfe Wind und Wellen, bevor du losfährst.`
      : `${nameEn}, Griechenland: ${total} Strände, ${sheltered} vor ${w.de} geschützt. Prüfe Wind und Wellen für jeden, bevor du losfährst.`,
    fr: numberless
      ? `${nameEn}, Grèce : ${total} plages. Comparez leur abri ${w.fr} et vérifiez le vent et les vagues avant d'y aller.`
      : `${nameEn}, Grèce : ${total} plages, ${sheltered} abritées ${w.fr}. Vérifiez le vent et les vagues pour chacune avant d'y aller.`,
    it: numberless
      ? `${nameEn}, Grecia: ${total} spiagge. Confronta il riparo ${w.it} e controlla vento e onde prima di andare.`
      : `${nameEn}, Grecia: ${total} spiagge, ${sheltered} riparate ${w.it}. Controlla vento e onde per ciascuna prima di andare.`,
  });
  const title = shelterCopy ? shelterCopy.title : pickLang(language, {
    de: numberless ? `${nameEn}: Strände nach Windschutz | CalmBeach` : `${nameEn}: ${sheltered} windgeschützte Strände | CalmBeach`,
    fr: numberless ? `${nameEn} : plages à l'abri du vent | CalmBeach` : `${nameEn} : ${sheltered} plages abritées du vent | CalmBeach`,
    it: numberless ? `${nameEn}: spiagge riparate dal vento | CalmBeach` : `${nameEn}: ${sheltered} spiagge riparate dal vento | CalmBeach`,
  });
  const regionPageName = `${islandName} beaches`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: shelterCopy ? shelterCopy.h1 : pickLang(language, { de: `Strände: ${islandName}`, fr: `Plages : ${islandName}`, it: `Spiagge: ${islandName}` }),
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
    imageAlt: pickLang(language, { en: `${nameEn} beaches in Greece`, gr: `Παραλίες ${regionPrepGr(region.id, islandName)}`, de: `Strände – ${nameEn}, Griechenland`, fr: `Plages – ${nameEn}, Grèce`, it: `Spiagge – ${nameEn}, Grecia` }),
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName, emittedLocales),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticRegionFallback(island, region, canonicalUrl, locale, shelterCopy));
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
        ${String(content.intro).split(/\n\n+/).map(paragraph => `<p style="margin:0 0 16px;font-size:17px;line-height:1.6;color:#334155;">${escapeHtml(paragraph.trim())}</p>`).join('')}
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

// Intent-page titles show in the SERP where Google budgets ~60 chars (gr ~58 —
// wider glyphs). en/gr already fit via categoryTitleFor/pickUnderLimit, but the
// de/fr/it intent titles are authored as single strings ending in "| CalmBeach"
// with no overflow tier, so many ran 67–73 chars and truncated. Google renders the
// site name separately on mobile (from the WebSite JSON-LD), so the brand is the
// safe thing to drop when a title is over budget. No-op for titles already fitting.
const INTENT_BRAND_SUFFIX = ' | CalmBeach';
const fitIntentTitle = (title, language) => {
  const max = language === 'gr' ? 58 : 60;
  return title.length > max && title.endsWith(INTENT_BRAND_SUFFIX)
    ? title.slice(0, -INTENT_BRAND_SUFFIX.length)
    : title;
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
    title: fitIntentTitle(content.title, language),
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
  const safeStoryParagraphs = story?.paragraphs?.filter(paragraph => !hasUnsupportedStaticConditionCopy(paragraph)) || [];
  const pageJsonLd = {
    '@context': 'https://schema.org',
    // schema.org/Beach is the precise type; TouristAttraction is kept for
    // consumers that already read it. Neither yields a SERP rich result — the
    // value is entity disambiguation (Knowledge Graph / AI answers / Maps).
    '@type': ['Beach', 'TouristAttraction'],
    name: beachAttractionName(beachName, language),
    description,
    disambiguatingDescription: safeStoryParagraphs.length ? safeStoryParagraphs.join(' ') : undefined,
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
  // No FAQPage here: the beach page shows its facts as a definition list and
  // amenity chips, not as visible question/answer pairs, so FAQPage markup would
  // not match visible content (structured-data guideline). FAQPage stays only on
  // the category/national pages that render Q&A visibly.

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
    const validBeaches = island.beaches.filter(beach => Number.isInteger(beach.id) && beach.name);
    // 'sheltered' uses the baked, curated-aware `shelteredFromLocalWind` flag (one
    // source), so it lists only genuinely sheltered beaches for the region's regime.
    for (const intent of islandIntents) {
      const predicate = intent.key === 'sheltered'
        ? (beach => beach.shelteredFromLocalWind === true)
        : (beach => intent.match(beach));
      const matchedAll = validBeaches.filter(predicate);
      const matches = matchedAll
        .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
        .slice(0, ISLAND_INTENT_CAP);
      // Proportional gate for 'sheltered': a small island where >=25% of beaches are
      // sheltered is useful, not a failure (e.g. Santorini 4/13).
      const passes = intent.key === 'sheltered'
        ? (matchedAll.length >= ISLAND_INTENT_MIN || (validBeaches.length > 0 && matchedAll.length / validBeaches.length >= 0.25))
        : matches.length >= ISLAND_INTENT_MIN;
      if (passes && matches.length > 0) {
        islandIntentPages.push({ intent, region, island, beaches: matches, shelteredCount: intent.key === 'sheltered' ? matchedAll.length : matches.length });
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
    // For the sheltered guide, compute the region's exposure geometry once so the
    // intro states real numbers (which coast the sheltered beaches cluster on, how
    // many take no open water toward the local wind) instead of a template.
    const shelterGeo = page.intent.key === 'sheltered'
      ? computeShelterGeometry(page.region.id, await loadExposureProfiles(page.region.id))
      : null;
    for (const locale of emittedLocales) {
      const islandName = displayName(page.island.name, page.region.id, locale.language);
      const intentCount = page.intent.key === 'sheltered' ? (page.shelteredCount ?? page.beaches.length) : page.beaches.length;
      const localeCopy = page.intent.copy(islandName, intentCount, page.region.id);
      const baseContent = localeCopy[locale.language] || localeCopy.en;
      // Swap in the hand-written GR intro + H1 for targeted family pages; the
      // beach list and the family Q&A sections stay as generated.
      const familyOverride = page.intent.key === 'family' && locale.language === 'gr'
        ? FAMILY_INTRO_OVERRIDES[page.region.id]
        : null;
      // Computed geometry intro for the sheltered guide (gr/en; null → template).
      const shelteredIntro = page.intent.key === 'sheltered'
        ? buildShelteredGeometryIntro(page.region.id, shelterGeo, locale.language)
        : null;
      const content = familyOverride
        ? { ...baseContent, h1: familyOverride.h1, intro: familyOverride.intro }
        : shelteredIntro
          ? { ...baseContent, intro: shelteredIntro }
          : baseContent;
      const intentOutputDir = outputDirForRoute(localizedPath(pathName, locale));
      await mkdir(intentOutputDir, { recursive: true });
      await writeFile(path.join(intentOutputDir, 'index.html'), buildIslandIntentPage(baseHtml, page.intent, content, page.island, page.region, page.beaches, intentOgImageUrl, locale, emittedLocales), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(pathName, locale), intentSitemapImageUrl));
      islandIntentPageCount += 1;
    }
  }
  console.log(`Island intent guides: ${islandIntentPages.length} published (≥${ISLAND_INTENT_MIN} beaches), ${islandIntentBelowMin} island×intent combos skipped below threshold.`);

  // Regions whose sheltered guide is actually published under the new geospatial
  // metric. Regions NOT in this set get a 301 from any previously-indexed
  // /sheltered-beaches/{slug}/ to the region page (never a 404).
  const publishedShelteredRegions = new Set(
    islandIntentPages.filter(p => p.intent.key === 'sheltered').map(p => p.region.id),
  );

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

    // 301 any retired sheltered guide (no longer clears the geospatial gate) to the
    // region page — same beaches, natural parent — so indexed URLs never 404.
    if (!publishedShelteredRegions.has(region.id)) {
      const shelteredPath = `/sheltered-beaches/${encodeURIComponent(regionSlug(region, island))}/`;
      for (const locale of baseLocales) {
        const from = localizedPath(shelteredPath, locale);
        const to = localizedPath(currentRegionPath, locale);
        redirects.push(`${from} ${to} 301`);
        redirects.push(`${from.replace(/\/$/, '')} ${to} 301`);
      }
    }

    const regionShelteredCount = countShelteredBeaches(island.beaches);
    const emittedLocales = localesForRegion(region.id);
    for (const locale of emittedLocales) {
      const localizedRegionPath = localizedPath(currentRegionPath, locale);
      const regionOutputDir = outputDirForRoute(localizedRegionPath);
      await mkdir(regionOutputDir, { recursive: true });
      await writeFile(path.join(regionOutputDir, 'index.html'), buildRegionPage(baseHtml, island, region, regionOgImageUrl, locale, emittedLocales, regionShelteredCount), 'utf8');
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
