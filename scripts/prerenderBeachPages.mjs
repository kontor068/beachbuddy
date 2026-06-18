import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const seoLandingPages = [
  {
    pathName: '/best-beaches-greece-today/',
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
      { href: '/where-to-swim-greece-today/', label: 'Where to swim in Greece today' },
      { href: '/best-beaches-milos-today/', label: 'Best beaches in Milos today' },
    ],
  },
  {
    pathName: '/where-to-swim-greece-today/',
    title: 'Where to Swim in Greece Today | CalmBeach',
    description: 'Find practical beach options in Greece today with wind, waves, weather, map and beach detail checks from CalmBeach.',
    h1: 'Where to swim in Greece today',
    intro: 'Use CalmBeach when you want a quick beach decision instead of reading raw weather data. The app translates wind, waves and exposure into simple beach guidance.',
    sections: [
      {
        heading: 'A fast beach decision screen',
        body: 'CalmBeach focuses on the top recommendation, suitable alternatives and a map view so tourists can make a choice quickly on mobile.',
      },
      {
        heading: 'Why conditions matter',
        body: 'A beach can be excellent on one day and uncomfortable on another. Wind direction, wave height, beach orientation and local exposure can change the right choice.',
      },
    ],
    links: [
      { href: '/', label: 'Open CalmBeach Greece' },
      { href: '/calm-beaches-greece-windy-day/', label: 'Find options on a windy day' },
      { href: '/beaches/milos/', label: 'Explore Milos beaches' },
    ],
  },
  {
    pathName: '/calm-beaches-greece-windy-day/',
    title: 'Calm Beaches in Greece on a Windy Day | CalmBeach',
    description: 'Use CalmBeach to look for more sheltered Greek beach options when wind and waves make exposed beaches less comfortable.',
    h1: 'Calm beaches in Greece on a windy day',
    intro: 'On windy days, the best beach choice is often about finding a more sheltered or less exposed option, not simply choosing the most famous beach.',
    sections: [
      {
        heading: 'Shelter is directional',
        body: 'A beach may be better protected from one wind direction and exposed to another. CalmBeach checks beach exposure together with today\'s forecast before ranking options.',
      },
      {
        heading: 'No false guarantees',
        body: 'The app does not claim that a beach is safe, calm or protected unless the available data supports a cautious recommendation. Always follow local warnings and judge conditions in person.',
      },
    ],
    links: [
      { href: '/', label: 'Check today\'s recommendations' },
      { href: '/best-beaches-greece-today/', label: 'Best beaches in Greece today' },
      { href: '/where-to-swim-greece-today/', label: 'Where to swim today' },
    ],
  },
  {
    pathName: '/best-beaches-milos-today/',
    title: 'Best Beaches in Milos Today | Wind & Waves | CalmBeach',
    description: 'Compare Milos beaches by today\'s wind, waves, weather, exposure, access and beach type before choosing where to swim.',
    h1: 'Best beaches in Milos today',
    intro: 'Milos has very different beach exposures, so wind direction and waves can change the best choice for the day. CalmBeach compares Milos beaches with today\'s conditions.',
    sections: [
      {
        heading: 'Milos beach conditions change by side of the island',
        body: 'North, south and bay-facing beaches can behave differently in the same forecast. CalmBeach looks at beach exposure and practical access instead of only listing popular beaches.',
      },
      {
        heading: 'Use the Milos beach page for live guidance',
        body: 'The Milos page includes current recommendations, beach cards, map context and detail pages for individual beaches.',
      },
    ],
    links: [
      { href: '/beaches/milos/', label: 'Open Milos beaches' },
      { href: '/', label: 'Open CalmBeach Greece' },
      { href: '/calm-beaches-greece-windy-day/', label: 'Windy day beach guidance' },
    ],
  },
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
  const guideLinks = isGreek ? [] : seoLandingPages.map(landing => ({
    href: landing.pathName,
    label: landing.h1,
  }));

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
        <nav aria-label="Popular CalmBeach guides" style="margin:0 0 24px;">
          <h2 style="margin:0 0 10px;font-size:18px;color:#075985;">Popular beach guides</h2>
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

const staticSeoLandingPage = landing => {
  // The first link is always the primary entry into the live app; promote it to
  // a prominent CTA so this page reads as a real CalmBeach gateway, not a stray
  // document. The rest stay as secondary related links.
  const [primaryLink, ...secondaryLinks] = landing.links;

  return `
    <div id="root">
      <main style="max-width:880px;margin:0 auto;padding:0 20px 56px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;">
        <header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;">
          <a href="/" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#0e7490;font-weight:800;font-size:18px;">
            <img src="/calmbeach-mark.svg" alt="" width="32" height="32" style="display:block;" />
            CalmBeach Greece
          </a>
          <a href="/" style="display:inline-flex;align-items:center;border:1px solid #bae6fd;border-radius:999px;padding:8px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:700;font-size:14px;">Open app</a>
        </header>
        <section style="padding:24px 0 8px;">
          <h1 style="margin:0 0 14px;font-size:38px;line-height:1.08;">${escapeHtml(landing.h1)}</h1>
          <p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:#334155;">${escapeHtml(landing.intro)}</p>
          ${primaryLink ? `<a href="${escapeHtml(primaryLink.href)}" style="display:inline-flex;align-items:center;justify-content:center;background:#0e7490;color:white;border-radius:12px;padding:14px 22px;text-decoration:none;font-weight:800;font-size:16px;box-shadow:0 10px 24px -12px rgba(14,116,144,.6);">${escapeHtml(primaryLink.label)} →</a>` : ''}
        </section>
        <div style="display:grid;gap:16px;margin:28px 0;">
          ${landing.sections.map(section => `
            <section style="border-top:1px solid #bae6fd;padding-top:16px;">
              <h2 style="margin:0 0 8px;font-size:20px;line-height:1.2;color:#075985;">${escapeHtml(section.heading)}</h2>
              <p style="margin:0;font-size:16px;line-height:1.58;color:#334155;">${escapeHtml(section.body)}</p>
            </section>
          `).join('')}
        </div>
        ${secondaryLinks.length > 0 ? `
        <nav aria-label="Related CalmBeach pages">
          <ul style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:0;padding:0;list-style:none;">
            ${secondaryLinks.map(link => `
              <li style="margin:0;">
                <a href="${escapeHtml(link.href)}" style="display:block;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;background:white;color:#0e7490;text-decoration:none;font-weight:800;">${escapeHtml(link.label)}</a>
              </li>
            `).join('')}
          </ul>
        </nav>
        ` : ''}
        <p data-nosnippet="true" style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">Recommendations are indicative and depend on available weather and beach data. Conditions may vary locally.</p>
      </main>
    </div>
  `;
};

const buildSeoLandingPage = (baseHtml, landing, imageUrl) => {
  const locale = prerenderLocales[0];
  const canonicalUrl = canonicalUrlFor(landing.pathName, locale);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: landing.title,
      description: landing.description,
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
      { name: landing.h1, url: canonicalUrl },
    ]),
  ];

  const htmlWithHead = injectBeachHead(baseHtml, {
    title: landing.title,
    description: landing.description,
    canonicalUrl,
    imageUrl,
    imageAlt: `${landing.h1} on CalmBeach Greece`,
    htmlLang: locale.htmlLang,
    ogLocale: locale.ogLocale,
    alternateUrls: [
      { hreflang: locale.hreflang, href: canonicalUrl },
      { hreflang: 'x-default', href: canonicalUrl },
    ],
    ogType: 'website',
    jsonLd,
  });

  return stripClientScripts(htmlWithHead).replace(/<div id="root">\s*<\/div>/i, staticSeoLandingPage(landing));
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

  for (const landing of seoLandingPages) {
    const landingOutputDir = outputDirForRoute(landing.pathName);
    await mkdir(landingOutputDir, { recursive: true });
    await writeFile(path.join(landingOutputDir, 'index.html'), buildSeoLandingPage(baseHtml, landing, homeOgImageUrl), 'utf8');
    sitemapEntries.push(sitemapEntry(canonicalUrlFor(landing.pathName, prerenderLocales[0]), homeSitemapImageUrl));
    landingPageCount += 1;
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
