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
];

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'));

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

const localizedPath = (pathName, locale) => {
  const suffix = pathName.startsWith('/') ? pathName : `/${pathName}`;
  return `${locale.pathPrefix}${suffix}`;
};

const canonicalUrlFor = (pathName, locale) => `${siteUrl}${localizedPath(pathName, locale)}`;

const alternateUrlsFor = pathName => [
  ...prerenderLocales.map(locale => ({
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
        title: 'Accessible Beaches in Greece (Seatrac) | CalmBeach',
        description: 'Find Greek beaches with accessibility features for disabled visitors, including Seatrac assisted access where available, then check the day\'s sea.',
        h1: 'Accessible beaches in Greece',
        intro: 'Some Greek beaches offer accessibility features such as ramps, accessible parking or Seatrac assisted-access systems. CalmBeach helps you find them and then check the sea for the day.',
        sections: [
          {
            heading: 'What accessibility can mean',
            body: 'Accessibility varies by beach: step-free access, accessible parking, boardwalks and Seatrac devices that help wheelchair users reach the water. Always confirm that equipment is in service before you travel.',
          },
          {
            heading: 'Conditions still matter',
            body: 'Even on an accessible beach, wind and waves change comfort and safety. CalmBeach pairs accessibility information with today\'s wind, waves and exposure so you can pick a calmer day and spot.',
          },
        ],
        links: [
          { href: '/', label: 'Open CalmBeach Greece' },
          { href: '/family-beaches-greece/', label: 'Family beaches with calmer water' },
          { href: '/best-beaches-greece-today/', label: 'Best beaches in Greece today' },
        ],
      },
      el: {
        title: 'Προσβάσιμες παραλίες ΑμεΑ στην Ελλάδα | CalmBeach',
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
        title: 'Beaches with Camping Nearby in Greece | CalmBeach',
        description: 'Find Greek beaches with a campsite nearby, then check today\'s wind, waves and exposure to plan a calmer day by the sea.',
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

const outputDirForRoute = routePath => path.join(distDir, routePath.replace(/^\/+/, ''));

const beachTypeLabels = new Map([
  ['sandy', { en: 'Sandy', gr: 'Αμμώδης' }],
  ['pebbles', { en: 'Pebbles', gr: 'Βότσαλα' }],
  ['sandy-pebbles', { en: 'Sand & pebbles', gr: 'Άμμος & βότσαλα' }],
  ['rocky', { en: 'Rocky', gr: 'Βραχώδης' }],
]);

const accessTypeLabels = new Map([
  ['asphalt_road', { en: 'Easy road access', gr: 'Πρόσβαση με άσφαλτο' }],
  ['passable_dirt_road', { en: 'Passable dirt road', gr: 'Χωματόδρομος (βατός)' }],
  ['difficult_dirt_road', { en: 'Difficult dirt road', gr: 'Δύσκολος χωματόδρομος' }],
  ['4x4_only', { en: '4x4 access', gr: 'Πρόσβαση με 4x4' }],
  ['hiking_path_easy', { en: 'Easy path', gr: 'Εύκολο μονοπάτι' }],
  ['hiking_path_difficult', { en: 'Difficult access (path)', gr: 'Δύσκολη πρόσβαση (μονοπάτι)' }],
  ['boat_only', { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος' }],
]);

const accessibilityLabels = new Map([
  ['EASY', { en: 'Easy access', gr: 'Εύκολη πρόσβαση' }],
  ['MODERATE', { en: 'Moderate access', gr: 'Μέτρια πρόσβαση' }],
  ['DIFFICULT', { en: 'Difficult access', gr: 'Δύσκολη πρόσβαση' }],
  ['BOAT_ONLY', { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος' }],
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
  `${regionPath(region, island)}${beach.id}-${normalizeSlug(localized(beach.name, `beach-${beach.id}`, 'en'))}/`
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

const staticBeachFallback = (beach, island, canonicalUrl, locale = prerenderLocales[0]) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const beachName = localized(beach.name, `Beach ${beach.id}`, language);
  const islandName = localized(island.name, island.id, language);
  const description = localized(
    beach.description,
    language === 'gr'
      ? `${beachName}, ${islandName}. Δες τον σημερινό άνεμο, το κύμα και τον καιρό πριν πας.`
      : `${beachName} beach in ${islandName}, Greece. Check today's wind, waves, weather and beach exposure before you go.`,
    language
  );
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
        <h1 style="margin:0 0 12px;font-size:32px;line-height:1.1;">${language === 'gr' ? `Παραλία ${escapeHtml(beachName)}, ${escapeHtml(islandName)}` : `${escapeHtml(beachName)} Beach, ${escapeHtml(islandName)}`}</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.55;color:#334155;">${escapeHtml(description)}</p>
        <dl style="display:grid;grid-template-columns:max-content 1fr;gap:8px 14px;margin:0 0 20px;">
          <dt style="font-weight:700;">${escapeHtml(copy.region)}</dt><dd style="margin:0;">${escapeHtml(islandName)}, Greece</dd>
          ${renderDefinitionRow(copy.beachType, readableBeachType(beach, language))}
          ${renderDefinitionRow(copy.access, readableAccess(beach, language))}
          <dt style="font-weight:700;">${escapeHtml(copy.coordinates)}</dt><dd style="margin:0;">${escapeHtml(beach.coordinates?.lat)}, ${escapeHtml(beach.coordinates?.lon)}</dd>
        </dl>
        ${amenityLabels.length > 0 ? `<ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;padding:0;list-style:none;">${amenityLabels.map(label => `<li style="border:1px solid #bae6fd;border-radius:999px;padding:6px 10px;background:white;color:#075985;font-weight:700;font-size:13px;">${escapeHtml(label)}</li>`).join('')}</ul>` : ''}
        <p data-nosnippet="true" style="margin:0;color:#475569;">${escapeHtml(copy.openAppBeach)}</p>
        <p data-nosnippet="true" style="margin:16px 0 0;"><a href="${escapeHtml(canonicalUrl)}" style="color:#0e7490;font-weight:700;">${escapeHtml(copy.viewBeach)}</a></p>
      </main>
    </div>
  `;
};

const staticRegionFallback = (island, region, canonicalUrl, locale = prerenderLocales[0]) => {
  const language = locale.language;
  const copy = getStaticFallbackCopy(language);
  const islandName = localized(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const beachItems = beaches
    .slice(0, 80)
    .map(beach => {
      const beachName = localized(beach.name, `Beach ${beach.id}`, language);
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
    disclaimer: 'Recommendations are indicative and depend on available weather and beach data. Conditions may vary locally.',
  },
  gr: {
    openApp: 'Άνοιγμα',
    related: 'Σχετικές σελίδες CalmBeach',
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
  const localizeHref = href => localizedPath(href, locale);
  const [primaryLink, ...secondaryLinks] = content.links;

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
};
const hubSectionHeading = { en: 'Browse beaches by island & region', gr: 'Δες παραλίες ανά νησί & περιοχή' };
const emptyListNote = { en: 'We are still adding beaches to this guide.', gr: 'Προσθέτουμε ακόμη παραλίες σε αυτόν τον οδηγό.' };
const localeText = (table, locale) => table[locale.language] || table.en;

const renderBeachListSection = (items, locale, category) => {
  const language = locale.language;
  const heading = localeText(listSectionHeadings[category] || {}, locale);

  if (!items.length) {
    return `
        <section style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
          <h2 style="margin:0 0 8px;font-size:22px;line-height:1.2;color:#075985;">${escapeHtml(heading)}</h2>
          <p style="margin:0;color:#475569;">${escapeHtml(localeText(emptyListNote, locale))}</p>
        </section>`;
  }

  const cards = items.map(({ beach, region, island }) => {
    const beachName = localized(beach.name, `Beach ${beach.id}`, language);
    const islandName = localized(island.name, region.id, language);
    const metaParts = [islandName, readableBeachType(beach, language)].filter(Boolean);

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
              ${extra ? `<span style="display:block;margin-top:2px;color:#0e7490;font-size:13px;font-weight:600;">${escapeHtml(extra)}</span>` : ''}
            </a>
          </li>`;
  }).join('');

  return `
        <section style="margin:28px 0;border-top:1px solid #bae6fd;padding-top:18px;">
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
  if (landing.kind === 'regionHub') return renderRegionHubSection(dynamic.hubRegions || [], locale);
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
      { name: 'CalmBeach Greece', url: canonicalUrlFor('/', locale) },
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
        name: localized(item.beach.name, `Beach ${item.beach.id}`, locale.language),
        url: canonicalUrlFor(beachPath(item.region, item.island, item.beach), locale),
      })),
    });
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

const buildHomePage = (baseHtml, locale, imageUrl) => {
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
    alternateUrls: alternateUrlsFor(pathName),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticHomeFallback(canonicalUrl, locale));
};

const buildRegionPage = (baseHtml, island, region, imageUrl, locale = prerenderLocales[0]) => {
  const pathName = regionPath(region, island);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const islandName = localized(island.name, region.id, language);
  const beaches = Array.isArray(island.beaches) ? island.beaches : [];
  const description = language === 'gr'
    ? `${islandName}: σύγκρινε ${beaches.length} παραλίες και δες σημερινό άνεμο, κύμα, καιρό και προτάσεις για μπάνιο.`
    : `${islandName} beaches in Greece. Compare ${beaches.length} beaches by live wind, waves, weather and exposure to find calmer swimming spots today.`;
  const title = language === 'gr'
    ? `Παραλίες: ${islandName} | Calm Beach Greece`
    : `${islandName} Beaches Today | CalmBeach Greece`;
  const regionPageName = `${islandName} beaches`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: language === 'gr' ? `Παραλίες: ${islandName}` : `${islandName} beaches`,
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
        name: localized(beach.name, `Beach ${beach.id}`, language),
        url: canonicalUrlFor(beachPath(region, island, beach), locale),
      })),
    },
  };
  const jsonLd = [
    pageJsonLd,
    breadcrumbJsonLd([
      { name: 'CalmBeach Greece', url: canonicalUrlFor('/', locale) },
      { name: regionPageName, url: canonicalUrl },
    ]),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: language === 'gr' ? `Παραλίες σε ${islandName}` : `${islandName} beaches in Greece`,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName),
    ogType: 'website',
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticRegionFallback(island, region, canonicalUrl, locale));
};

const buildBeachPage = (baseHtml, island, beach, region, imageUrl, locale = prerenderLocales[0]) => {
  const pathName = beachPath(region, island, beach);
  const canonicalUrl = canonicalUrlFor(pathName, locale);
  const language = locale.language;
  const beachName = localized(beach.name, `Beach ${beach.id}`, language);
  const islandName = localized(island.name, region.id, language);
  const description = localized(
    beach.description,
    language === 'gr'
      ? `${beachName}, ${islandName}. Δες τον σημερινό άνεμο, το κύμα και τον καιρό πριν πας.`
      : `${beachName} beach in ${islandName}, Greece. Check today's wind, waves, weather and beach exposure before you go.`,
    language
  );
  const title = language === 'gr'
    ? `Παραλία ${beachName}, ${islandName} | Calm Beach Greece`
    : `${beachName} Beach, ${islandName} | Wind & Waves Today`;
  const beachPageName = `${beachName} Beach`;
  const beachRegionPageName = `${islandName} beaches`;
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: language === 'gr' ? `Παραλία ${beachName}` : `${beachName} Beach`,
    description,
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
      { name: 'CalmBeach Greece', url: canonicalUrlFor('/', locale) },
      { name: beachRegionPageName, url: canonicalUrlFor(regionPath(region, island), locale) },
      { name: beachPageName, url: canonicalUrl },
    ]),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: language === 'gr' ? `Παραλία ${beachName}, ${islandName}` : `${beachName} Beach in ${islandName}, Greece`,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: alternateUrlsFor(pathName),
    jsonLd,
  });

  return htmlWithHead.replace(/<div id="root">\s*<\/div>/i, staticBeachFallback(beach, island, canonicalUrl, locale));
};

const sitemapEntry = (url, imageUrl) => ({ url, imageUrl });

const renderSitemapEntry = (entry, lastmod) => {
  const imageTag = entry.imageUrl
    ? `<image:image><image:loc>${escapeXml(entry.imageUrl)}</image:loc></image:image>`
    : '';

  return `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${lastmod}</lastmod>${imageTag}</url>`;
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

  for (const locale of prerenderLocales) {
    const homeRoutePath = localizedPath('/', locale);
    const homeOutputDir = outputDirForRoute(homeRoutePath);
    await mkdir(homeOutputDir, { recursive: true });
    await writeFile(path.join(homeOutputDir, 'index.html'), buildHomePage(baseHtml, locale, homeOgImageUrl), 'utf8');
    sitemapEntries.push(sitemapEntry(canonicalUrlFor('/', locale), homeSitemapImageUrl));
  }

  // Consolidation 301s for the retired generic landing pages.
  for (const redirect of landingRedirects) {
    for (const locale of prerenderLocales) {
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
      if (beach.environment?.familyFriendly === true) categoryBuckets.family.push(entry);
      // Mirror hasDisabledAccess in services/recommendationService.ts: seatrac may
      // sit on the beach or under metadata, and only an online unit qualifies
      // (wrong info can strand a wheelchair user).
      const seatrac = beach.seatrac ?? beach.metadata?.seatrac;
      if (seatrac?.hasSeatrac === true && seatrac?.status === 'online') categoryBuckets.accessible.push(entry);
      if (Array.isArray(beach.nearbyCamping) && beach.nearbyCamping.length > 0) categoryBuckets.camping.push(entry);
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

  for (const landing of seoLandingPages) {
    const dynamic = landing.kind === 'beachList'
      ? { items: categoryBuckets[landing.category] || [] }
      : landing.kind === 'regionHub'
        ? { hubRegions }
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
    const currentRegionPath = regionPath(region, island);
    const currentLegacyRegionPath = legacyRegionPath(region.id);
    if (currentLegacyRegionPath !== currentRegionPath) {
      redirects.push(`${currentLegacyRegionPath} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath.replace(/\/$/, '')} ${currentRegionPath} 301`);
      redirects.push(`${currentLegacyRegionPath}* ${currentRegionPath}:splat 301`);
    }

    for (const locale of prerenderLocales) {
      const localizedRegionPath = localizedPath(currentRegionPath, locale);
      const regionOutputDir = outputDirForRoute(localizedRegionPath);
      await mkdir(regionOutputDir, { recursive: true });
      await writeFile(path.join(regionOutputDir, 'index.html'), buildRegionPage(baseHtml, island, region, regionOgImageUrl, locale), 'utf8');
      sitemapEntries.push(sitemapEntry(canonicalUrlFor(currentRegionPath, locale), regionSitemapImageUrl));
      regionPageCount += 1;
    }

    for (const beach of island.beaches) {
      if (!Number.isInteger(beach.id) || !beach.name) continue;

      const routePath = beachPath(region, island, beach);
      for (const legacyPath of legacyBeachPaths(region, island, beach)) {
        redirects.push(`${legacyPath} ${routePath} 301`);
        redirects.push(`${legacyPath.replace(/\/$/, '')} ${routePath} 301`);
      }

      for (const locale of prerenderLocales) {
        const localizedRoutePath = localizedPath(routePath, locale);
        const outputDir = outputDirForRoute(localizedRoutePath);
        await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, 'index.html'), buildBeachPage(baseHtml, island, beach, region, regionOgImageUrl, locale), 'utf8');
        sitemapEntries.push(sitemapEntry(canonicalUrlFor(routePath, locale), regionSitemapImageUrl));
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
  console.log(`Prerendered ${prerenderLocales.length} home pages, ${landingPageCount} SEO landing pages, ${regionPageCount} region pages, ${pageCount} beach pages, ${redirects.length} redirects and sitemap.xml`);
};

main().catch(error => {
  console.error('Failed to prerender beach pages.', error);
  process.exitCode = 1;
});
